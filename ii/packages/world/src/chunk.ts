/**
 * EL CHUNK — 256 celdas de terreno en arreglos paralelos, y el índice de cuerpos
 * de esas 256 celdas.
 *
 * Un chunk es la unidad de tres cosas a la vez, y que sean la misma no es
 * casualidad:
 *
 *   - **materialización**: el mundo es infinito, la memoria no. Un chunk nace
 *     cuando alguien escribe en él y no antes (`grid.ts`);
 *   - **serialización**: un chunk se guarda y se carga SOLO, sin el resto del
 *     mundo. Eso es lo que hace posible el snapshot por delta del Hito 2 —se
 *     guardan los chunks que cambiaron— y lo que le va a permitir al dios
 *     perezoso del Hito 3 resolver un chunk y escribirlo sin tocar nada más;
 *   - **localidad**: las 256 celdas de un campo son 1 KB contiguo. Recorrer el
 *     terreno de un chunk es recorrer un `Int32Array`, no perseguir punteros.
 *
 * ─── Arreglos paralelos, no un arreglo de celdas ────────────────────────────
 *
 * Un `Int32Array` POR CAMPO —todos de 256— y no un `Int32Array` de 1024 con las
 * cuatro cualidades intercaladas. La diferencia se nota en el tick: casi todo lo
 * que corre sobre el terreno toca UN campo sobre muchas celdas (la relajación de
 * la temperatura, el secado, la difusión del oxígeno), no las cuatro cualidades
 * de una celda. Intercalado, cada línea de caché traería tres campos que nadie
 * va a mirar.
 *
 * Y `Int32Array` y no `Float64Array` porque lo que se guarda son `Fixed` (ADR
 * II-0006): enteros escalados por 1000. Un `Float64Array` ocuparía el doble y
 * abriría la puerta a que alguien guarde un valor con fracción, que es
 * exactamente el invariante que el punto fijo compra.
 *
 * ─── Mutación en el lugar, y por qué no contradice a `stepWorld` puro ───────
 *
 * Los chunks se escriben en el lugar. Copiar el terreno por tick para conservar
 * la pureza costaría 4 KB por chunk vivo y por tick: con veinte chunks cargados
 * son 80 KB por tick a 30 Hz, 2.4 MB por segundo de basura, y el criterio son 4
 * ms por tick para 5000 cuerpos. La reproducibilidad no se sostiene copiando: se
 * sostiene con el journal de intenciones y el snapshot, que es lo que dice el
 * documento. La frontera de la pureza es el tick, no la celda.
 */

import { fadd, fixedFromRaw, type Fixed } from '@anima/physics'

import {
  CELL_FIELD_AMBIENT,
  CELL_FIELDS,
  CHUNK_AREA,
  clampField,
  FIELD_COUNT,
  type CellField,
} from './cell.js'

/**
 * Lo que hay en una celda ocupada. Un arreglo de ids y no un `Set` porque las
 * cubetas son diminutas —una celda con más de una decena de cuerpos ya es un
 * caso raro— y para diez elementos el arreglo gana en todo: en memoria, en
 * recorrido y en tener un ORDEN, que un `Set` también tiene pero no dice cuál.
 */
type Bucket = string[]

const SIN_CUERPOS: readonly string[] = Object.freeze([])

export interface Chunk {
  readonly cx: number
  readonly cy: number
  /** Un arreglo por campo, en el orden de `CELL_FIELDS`, todos de `CHUNK_AREA`. */
  readonly fields: readonly Int32Array[]
  /**
   * Índice por celda: `CHUNK_AREA` cubetas, `undefined` mientras la celda esté
   * vacía. Vacía es el caso abrumador —un mundo de 5000 cuerpos tiene millones
   * de celdas sin nada— y un arreglo vacío por celda serían 256 objetos por
   * chunk que no guardan nada.
   */
  readonly bodies: (Bucket | undefined)[]
  /** Cuántos cuerpos hay en el chunk. Se mantiene al poner y sacar. */
  bodyCount: number
}

/**
 * Un chunk recién materializado: todas las celdas al aire libre y sin nadie.
 *
 * `fill` con el valor de ambiente y no `new Int32Array(...)` a secas: un chunk
 * nuevo tiene que ser INDISTINGUIBLE de una celda que nunca se materializó, y el
 * cero no es el ambiente —el oxígeno al aire vale 1 y la temperatura 15—. Si el
 * chunk naciera en cero, caminar hacia un lugar nuevo lo dejaría helado y sin
 * aire, y peor: el mundo cambiaría por el solo hecho de mirarlo.
 */
export function createChunk(cx: number, cy: number): Chunk {
  const fields: Int32Array[] = []
  for (let f = 0; f < FIELD_COUNT; f++) {
    const a = new Int32Array(CHUNK_AREA)
    a.fill(CELL_FIELD_AMBIENT[f] as number)
    fields.push(a)
  }
  return { cx, cy, fields, bodies: new Array<Bucket | undefined>(CHUNK_AREA), bodyCount: 0 }
}

// ─── El terreno ─────────────────────────────────────────────────────────────

function fieldArray(ch: Chunk, fi: number): Int32Array {
  const a = ch.fields[fi]
  if (a === undefined) throw new RangeError(`campo de celda fuera de rango: ${fi}`)
  return a
}

function checkIndex(i: number): number {
  if (!Number.isInteger(i) || i < 0 || i >= CHUNK_AREA) {
    throw new RangeError(`índice de celda fuera del chunk: ${i}`)
  }
  return i
}

/**
 * Lee un campo. Pasa por `fixedFromRaw` porque un `Int32Array` devuelve `number`
 * pelado: es LA PUERTA declarada por el ADR II-0006 para lo que viene de afuera,
 * y sin ella cada llamador se inventaría su propio `as Fixed`. Por construcción
 * es una identidad —todo lo que entró pasó por `clampField`— y de eso hay test.
 */
export function chunkGet(ch: Chunk, fi: number, i: number): Fixed {
  return fixedFromRaw(fieldArray(ch, fi)[checkIndex(i)] as number)
}

/** Escribe un campo, recortado al rango. Devuelve lo que quedó guardado. */
export function chunkSet(ch: Chunk, fi: number, i: number, v: Fixed): Fixed {
  const q = clampField(fi, v)
  fieldArray(ch, fi)[checkIndex(i)] = q
  return q
}

/**
 * Suma al campo. No es azúcar sobre `chunkGet` + `chunkSet`: es la operación de
 * la ley 12 —tapar suma cobertura, destapar resta— y de cualquier ley que aporte
 * al terreno. Que exista una sola función para «acumular» es lo que hace que el
 * recorte se aplique una vez y en el mismo lugar.
 */
export function chunkAdd(ch: Chunk, fi: number, i: number, d: Fixed): Fixed {
  return chunkSet(ch, fi, i, fadd(chunkGet(ch, fi, i), d))
}

// ─── El índice de cuerpos ───────────────────────────────────────────────────

/**
 * Los cuerpos que hay en la celda, SIN COPIAR. Devolverlo `readonly` es lo que
 * hace que sea O(1) de verdad: copiar sería O(k) por consulta y la consulta
 * corre muchas veces por tick.
 *
 * El orden es el de llegada (ver `chunkRemoveBody`). No se ordena al leer: eso
 * es exactamente el `entitiesAt = Object.values().sort().filter()` que el
 * documento le reprocha a Ánima I, un `sort` que además parseaba ids de texto.
 */
export function chunkBodiesAt(ch: Chunk, i: number): readonly string[] {
  return ch.bodies[checkIndex(i)] ?? SIN_CUERPOS
}

/** Verdadero si el cuerpo se agregó; falso si ya estaba. */
export function chunkAddBody(ch: Chunk, i: number, id: string): boolean {
  const k = checkIndex(i)
  const b = ch.bodies[k]
  if (b === undefined) {
    ch.bodies[k] = [id]
    ch.bodyCount++
    return true
  }
  // El mismo cuerpo dos veces en la misma celda sería un cuerpo que se cuenta
  // dos veces en todo lo que recorra la celda. La grilla lo evita manteniendo
  // `where`, pero el chunk no puede confiar en eso: es su propio invariante.
  if (b.includes(id)) return false
  b.push(id)
  ch.bodyCount++
  return true
}

/**
 * Saca un cuerpo. Devuelve si estaba.
 *
 * `splice` y no el truco de «pisar con el último y acortar»: con el truco, el
 * orden de la cubeta pasa a depender de la historia de bajas, y dos partidas que
 * llegaron al mismo estado por caminos distintos tendrían cubetas en distinto
 * orden. Con `splice`, el orden es siempre una subsecuencia del orden de
 * llegada, que es una propiedad que se puede enunciar y testear. La cubeta tiene
 * unos pocos elementos, así que el costo es el mismo.
 */
export function chunkRemoveBody(ch: Chunk, i: number, id: string): boolean {
  const k = checkIndex(i)
  const b = ch.bodies[k]
  if (b === undefined) return false
  const at = b.indexOf(id)
  if (at < 0) return false
  b.splice(at, 1)
  // La cubeta vacía se borra para que el chunk pueda volver a estar impecable:
  // si quedara un arreglo vacío, poner y sacar un cuerpo dejaría rastro y el
  // mundo no volvería a su estado anterior.
  if (b.length === 0) ch.bodies[k] = undefined
  ch.bodyCount--
  return true
}

// ─── Impecable: el chunk que se puede tirar ─────────────────────────────────

/**
 * Verdadero si el chunk es indistinguible de uno recién creado.
 *
 * Es lo que permite que MATERIALIZAR NO CAMBIE EL MUNDO. Sin esto, dos partidas
 * idénticas que exploraron en distinto orden tendrían distinta cantidad de
 * chunks vivos y distinto hash — y «el mismo mundo explorado en dos órdenes da
 * el mismo hash» es un criterio verificable escrito, el del Hito 3.
 *
 * Se CALCULA y no se lleva en una bandera `sucio`. Una bandera diría que sí a un
 * chunk que se escribió y se volvió a dejar como estaba, o sea que el hash
 * dependería de la historia y no del estado. Cuesta 1024 comparaciones, y solo
 * se paga al serializar y al hashear, nunca en el tick.
 */
export function chunkIsPristine(ch: Chunk): boolean {
  if (ch.bodyCount !== 0) return false
  for (let f = 0; f < FIELD_COUNT; f++) {
    const a = fieldArray(ch, f)
    const amb = CELL_FIELD_AMBIENT[f] as number
    for (let i = 0; i < CHUNK_AREA; i++) if (a[i] !== amb) return false
  }
  return true
}

// ─── Guardar y cargar un chunk, solo ────────────────────────────────────────

/**
 * La forma serializada. Objetos planos, números y texto: nada de `Int32Array` ni
 * de `Map`, para que sobreviva a `JSON.stringify` y vuelva IGUAL. Un snapshot
 * que no aguanta el viaje por JSON no sirve para el journal ni para IndexedDB, y
 * eso se descubre tarde.
 */
export interface ChunkSnapshot {
  readonly cx: number
  readonly cy: number
  /** Los campos en el orden de `CELL_FIELDS`, cada uno de `CHUNK_AREA` enteros. */
  readonly fields: readonly (readonly number[])[]
  /** Solo las celdas ocupadas: `[índice local, ids en su orden]`, por índice. */
  readonly bodies: readonly (readonly [number, readonly string[]])[]
  /** Los nombres de los campos, para que cargar un guardado viejo se note. */
  readonly layout: readonly CellField[]
}

export function serializeChunk(ch: Chunk): ChunkSnapshot {
  const fields: number[][] = []
  for (let f = 0; f < FIELD_COUNT; f++) fields.push(Array.from(fieldArray(ch, f)))
  const bodies: [number, string[]][] = []
  // Por índice ascendente: el orden canónico de las celdas dentro del chunk. Sin
  // esto el snapshot dependería del orden en que se materializaron las cubetas.
  for (let i = 0; i < CHUNK_AREA; i++) {
    const b = ch.bodies[i]
    if (b !== undefined && b.length > 0) bodies.push([i, [...b]])
  }
  return { cx: ch.cx, cy: ch.cy, fields, bodies, layout: [...CELL_FIELDS] }
}

/**
 * Reconstruye el chunk. Todo lo que entra pasa por `clampField`: un snapshot es
 * dato de afuera —vino de un disco, de otra versión, de una partida ajena— y la
 * grilla es el árbitro, no un lector confiado.
 */
export function deserializeChunk(s: ChunkSnapshot): Chunk {
  if (s.layout.length !== FIELD_COUNT) {
    throw new RangeError(`el chunk guardado tiene ${s.layout.length} campos y el mundo ${FIELD_COUNT}`)
  }
  for (let f = 0; f < FIELD_COUNT; f++) {
    if (s.layout[f] !== CELL_FIELDS[f]) {
      throw new RangeError(
        `el campo ${f} del chunk guardado es «${String(s.layout[f])}» y el del mundo «${String(CELL_FIELDS[f])}»`,
      )
    }
  }
  const ch = createChunk(s.cx, s.cy)
  for (let f = 0; f < FIELD_COUNT; f++) {
    const src = s.fields[f]
    if (src === undefined || src.length !== CHUNK_AREA) {
      throw new RangeError(`el campo ${f} del chunk guardado no tiene ${CHUNK_AREA} celdas`)
    }
    for (let i = 0; i < CHUNK_AREA; i++) chunkSet(ch, f, i, fixedFromRaw(src[i] as number))
  }
  for (const [i, ids] of s.bodies) for (const id of ids) chunkAddBody(ch, i, id)
  return ch
}
