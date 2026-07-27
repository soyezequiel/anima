/**
 * LA GRILLA — los chunks que se materializan por demanda y el índice espacial
 * que se mantiene INCREMENTALMENTE.
 *
 * El documento de arquitectura tiene una línea sobre Ánima I que es el pliego de
 * condiciones de este archivo:
 *
 *   `entitiesAt` = `Object.values().sort().filter()` — `allEntities()` diez veces
 *   por tick, con un `sort` que parsea ids de texto.
 *
 * O sea: O(entidades · log entidades) por consulta, diez veces por tick, para
 * contestar «qué hay en esta celda». Acá esa pregunta es un `Map.get` y un índice
 * de arreglo, y no depende de cuántos cuerpos haya en el mundo. Lo que lo hace
 * posible no es la estructura sino la DISCIPLINA: el índice se actualiza en el
 * momento en que un cuerpo se mueve —`placeBody` es el único camino— y nunca se
 * reconstruye recorriendo el mundo. Un índice que se reconstruye es un índice que
 * alguien va a reconstruir adentro de un bucle.
 *
 * ─── Materializar no cambia el mundo ────────────────────────────────────────
 *
 * LEER NO MATERIALIZA. `readCell` sobre un chunk que no existe devuelve el
 * ambiente sin crear nada; solo escribir materializa. Y `serializeGrid` saltea
 * los chunks impecables. Las dos cosas juntas dan la propiedad que el Hito 3 va a
 * necesitar: mirar el mundo no lo cambia, y dos partidas que exploraron en
 * distinto orden tienen el mismo estado guardado y el mismo hash.
 *
 * ─── Qué NO está acá ────────────────────────────────────────────────────────
 *
 * No hay hash propio. `hashWorld` de `hash.ts` ya sabe hashear objetos planos,
 * `Map` y arreglos tipados de forma canónica; lo que esta grilla aporta es la
 * FORMA canónica —`serializeGrid`— y el hash del mundo se toma sobre ella. Dos
 * hashes distintos en el mismo paquete serían dos verdades sobre lo mismo.
 */

import { unfx, type Celda, type Fixed } from '@anima/physics'

import {
  CELL_FIELD_AMBIENT,
  CELL_LIMIT,
  cellAtLocal,
  cellFromKey,
  cellKey,
  chunkCoord,
  chunkKey,
  chunkKeyOfCell,
  fieldIndex,
  FIELD_COUNT,
  IDX_COVER,
  IDX_OXYGEN,
  IDX_TEMPERATURE,
  IDX_WET,
  localIndex,
  shelteredFrom,
  type Cell,
  type CellField,
} from './cell.js'
import {
  chunkAdd,
  chunkAddBody,
  chunkBodiesAt,
  chunkGet,
  chunkIsPristine,
  chunkRemoveBody,
  chunkSet,
  createChunk,
  deserializeChunk,
  serializeChunk,
  type Chunk,
  type ChunkSnapshot,
} from './chunk.js'

/**
 * `chunks` va por clave numérica de chunk y `where` es EL índice: de cuerpo a
 * clave de celda.
 *
 * `where` es lo que hace O(1) a mover. Sin él, sacar un cuerpo de donde estaba
 * obligaría a buscarlo —o a que el llamador recuerde la posición anterior y no se
 * equivoque nunca, que es la misma apuesta pero peor: el error sería un cuerpo
 * fantasma en una celda vieja, invisible hasta que algo lo pise.
 *
 * Y `where` NO se guarda: se reconstruye al cargar. Un índice guardado puede
 * mentir sobre el estado que indexa, y entonces habría dos verdades sobre dónde
 * está un cuerpo. Las cubetas son la verdad; `where` es su atajo.
 */
export interface Grid {
  readonly chunks: Map<number, Chunk>
  readonly where: Map<string, number>
}

export function createGrid(): Grid {
  return { chunks: new Map(), where: new Map() }
}

/** La celda vacía, compartida y congelada: no se asigna un arreglo por consulta. */
const SIN_CUERPOS: readonly string[] = Object.freeze([])

// ─── Chunks ─────────────────────────────────────────────────────────────────

export function chunkAt(g: Grid, cx: number, cy: number): Chunk | undefined {
  return g.chunks.get(chunkKey(cx, cy))
}

/** Materializa si hace falta. El ÚNICO lugar donde nace un chunk. */
export function ensureChunk(g: Grid, cx: number, cy: number): Chunk {
  const k = chunkKey(cx, cy)
  const hay = g.chunks.get(k)
  if (hay !== undefined) return hay
  const nuevo = createChunk(cx, cy)
  g.chunks.set(k, nuevo)
  return nuevo
}

/** Las claves de los chunks vivos, en orden canónico (por filas de chunks). */
export function chunkKeysInOrder(g: Grid): readonly number[] {
  // Ordenar por número y no confiar en el orden de inserción del `Map`: el orden
  // de inserción es el orden de EXPLORACIÓN, y dos partidas iguales que
  // caminaron distinto lo tienen distinto. El `Map` de JS sí conserva el orden
  // de inserción, y por eso es una trampa cómoda: funciona en los tests fáciles
  // y falla en el criterio del hito.
  return [...g.chunks.keys()].sort((a, b) => a - b)
}

export function chunkCount(g: Grid): number {
  return g.chunks.size
}

/**
 * Tira los chunks que quedaron indistinguibles de recién creados. Devuelve
 * cuántos se fueron.
 *
 * No hace falta para que el mundo sea correcto —`serializeGrid` y el hash ya los
 * ignoran— pero sí para que no crezca sin techo: una criatura que camina mil
 * celdas materializa chunks que nunca vuelve a ver. Es una operación de
 * mantenimiento, y por eso es explícita: si corriera sola dentro del tick,
 * cuándo corre pasaría a ser parte del estado.
 */
export function pruneChunks(g: Grid): number {
  let n = 0
  for (const k of chunkKeysInOrder(g)) {
    const ch = g.chunks.get(k)
    if (ch !== undefined && chunkIsPristine(ch)) {
      g.chunks.delete(k)
      n++
    }
  }
  return n
}

// ─── El terreno ─────────────────────────────────────────────────────────────

/**
 * Lee un campo de la celda. **No materializa**: si el chunk no existe, la celda
 * vale lo que vale el aire libre. Es lo que hace que mirar sea gratis y que
 * mirar no cambie el mundo.
 */
export function readCell(g: Grid, c: Cell, f: CellField): Fixed {
  const fi = fieldIndex(f)
  const ch = g.chunks.get(chunkKeyOfCell(c.x, c.y))
  if (ch === undefined) return CELL_FIELD_AMBIENT[fi] as Fixed
  return chunkGet(ch, fi, localIndex(c.x, c.y))
}

/** Escribe un campo de la celda, recortado al rango. Materializa el chunk. */
export function writeCell(g: Grid, c: Cell, f: CellField, v: Fixed): Fixed {
  const ch = ensureChunk(g, chunkCoord(c.x), chunkCoord(c.y))
  return chunkSet(ch, fieldIndex(f), localIndex(c.x, c.y), v)
}

/** Suma al campo de la celda. La operación de las leyes que aportan al terreno. */
export function addCell(g: Grid, c: Cell, f: CellField, d: Fixed): Fixed {
  const ch = ensureChunk(g, chunkCoord(c.x), chunkCoord(c.y))
  return chunkAdd(ch, fieldIndex(f), localIndex(c.x, c.y), d)
}

// ─── El lugar de la ley 12 (ADR II-0002) ────────────────────────────────────

/**
 * La oclusión acumulada de la celda. La ley 12 la escribe con `addCover` cuando
 * un cuerpo se coloca tapando y la resta cuando se saca; cuánto suma cada cuerpo
 * sale de su `permeability` y de cuánto cubre, y eso es física, no grilla.
 */
export function coverAt(g: Grid, c: Cell): Fixed {
  const ch = g.chunks.get(chunkKeyOfCell(c.x, c.y))
  if (ch === undefined) return CELL_FIELD_AMBIENT[IDX_COVER] as Fixed
  return chunkGet(ch, IDX_COVER, localIndex(c.x, c.y))
}

/** Suma (o resta, con `d` negativo) oclusión. Devuelve el acumulado nuevo. */
export function addCover(g: Grid, c: Cell, d: Fixed): Fixed {
  const ch = ensureChunk(g, chunkCoord(c.x), chunkCoord(c.y))
  return chunkAdd(ch, IDX_COVER, localIndex(c.x, c.y), d)
}

/**
 * `sheltered`, la cualidad de celda que NO se guarda: se calcula cada vez que se
 * lee, a partir de `cover`. Por eso sacar lo que tapaba tiene efecto en el mismo
 * tick y sin que nadie resincronice nada (ADR II-0002).
 */
export function shelteredAt(g: Grid, c: Cell): Fixed {
  return shelteredFrom(coverAt(g, c))
}

/**
 * El puente a las leyes: la celda como la ve `leyes.ts`, en reales.
 *
 * Dos cosas pasan acá y en ningún otro lado. Una: la traducción de nombres —lo
 * que la grilla llama `temperature` la ley lo llama `ambiente`, y son la misma
 * magnitud vista desde los dos lados del intercambio—. Dos: la salida del punto
 * fijo, porque `leyes.ts` y `process.ts` corren en doubles (ADR II-0006, la
 * migración del motor de leyes a punto fijo es otro trabajo). Que la conversión
 * esté en UNA función es lo que va a hacer barata esa migración: se cambia acá.
 *
 * Un solo `Map.get` para los tres campos, a propósito. Es el camino caliente
 * —una vez por cuerpo y por tick, 5000 veces— y tres llamadas a `readCell`
 * pagarían tres veces la búsqueda del chunk.
 */
export function celdaAt(g: Grid, c: Cell): Celda {
  const ch = g.chunks.get(chunkKeyOfCell(c.x, c.y))
  if (ch === undefined) {
    return {
      oxygen: unfx(CELL_FIELD_AMBIENT[IDX_OXYGEN] as Fixed),
      wet: unfx(CELL_FIELD_AMBIENT[IDX_WET] as Fixed),
      ambiente: unfx(CELL_FIELD_AMBIENT[IDX_TEMPERATURE] as Fixed),
    }
  }
  const i = localIndex(c.x, c.y)
  return {
    oxygen: unfx(chunkGet(ch, IDX_OXYGEN, i)),
    wet: unfx(chunkGet(ch, IDX_WET, i)),
    ambiente: unfx(chunkGet(ch, IDX_TEMPERATURE, i)),
  }
}

// ─── El índice espacial ─────────────────────────────────────────────────────

/** Qué hay en la celda. O(1), sin copiar y sin ordenar. */
export function bodiesAt(g: Grid, c: Cell): readonly string[] {
  const ch = g.chunks.get(chunkKeyOfCell(c.x, c.y))
  if (ch === undefined) return SIN_CUERPOS
  return chunkBodiesAt(ch, localIndex(c.x, c.y))
}

/** Dónde está el cuerpo, o `undefined` si la grilla no lo tiene. O(1). */
export function cellOf(g: Grid, id: string): Cell | undefined {
  const k = g.where.get(id)
  return k === undefined ? undefined : cellFromKey(k)
}

export function hasBody(g: Grid, id: string): boolean {
  return g.where.has(id)
}

export function bodyCount(g: Grid): number {
  return g.where.size
}

/**
 * Pone el cuerpo en la celda: alta si no estaba, mudanza si estaba en otra.
 *
 * Es el único camino de escritura del índice, y por eso es donde vive la
 * consistencia: sacar de la cubeta vieja y poner en la nueva pasan siempre
 * juntos. Que «poner» y «mover» sean la misma función no es economía de líneas:
 * dos funciones dejarían que alguien llame a la de alta sobre un cuerpo que ya
 * estaba, y el resultado sería un cuerpo en dos celdas — el fantasma que
 * `gridInvariants` busca.
 *
 * Mover a la misma celda no toca nada: si sacara y volviera a poner, el cuerpo
 * saltaría al final de la cubeta y el orden de llegada dejaría de ser el orden de
 * llegada.
 */
export function placeBody(g: Grid, id: string, c: Cell): void {
  const k = cellKey(c.x, c.y)
  const antes = g.where.get(id)
  if (antes === k) return
  if (antes !== undefined) desindexar(g, antes, id)
  const ch = ensureChunk(g, chunkCoord(c.x), chunkCoord(c.y))
  chunkAddBody(ch, localIndex(c.x, c.y), id)
  g.where.set(id, k)
}

/** Devuelve si el cuerpo estaba. */
export function removeBody(g: Grid, id: string): boolean {
  const k = g.where.get(id)
  if (k === undefined) return false
  desindexar(g, k, id)
  g.where.delete(id)
  return true
}

function desindexar(g: Grid, key: number, id: string): void {
  const c = cellFromKey(key)
  const ch = g.chunks.get(chunkKeyOfCell(c.x, c.y))
  // Si el chunk no está, el índice y el terreno se separaron: es un bug de este
  // archivo, no un dato faltante, y silenciarlo dejaría un cuerpo fantasma.
  if (ch === undefined) throw new RangeError(`el cuerpo ${id} apunta a un chunk que no existe`)
  chunkRemoveBody(ch, localIndex(c.x, c.y), id)
}

/**
 * Recorre los cuerpos que hay en el cuadrado de lado `2·radio + 1` centrado en
 * `c`, en orden canónico por filas, y para cada uno llama a `fn`.
 *
 * Cuesta O(celdas del cuadrado + cuerpos encontrados), NO O(cuerpos del mundo).
 * Esa es la diferencia entera con `allEntities().filter()`: la percepción de la
 * criatura mira un radio chico, y lo que tiene que costar es el radio.
 *
 * Se recorta al mundo en vez de lanzar: un radio de percepción que se pasa del
 * borde es normal —la criatura camina hasta el borde—, y ahí lo correcto es que
 * no haya nada, no que se caiga el tick.
 */
export function forEachBodyNear(
  g: Grid,
  c: Cell,
  radio: number,
  fn: (id: string, at: Cell) => void,
): void {
  const r = radio < 0 ? 0 : Math.trunc(radio)
  const x0 = Math.max(c.x - r, -CELL_LIMIT)
  const x1 = Math.min(c.x + r, CELL_LIMIT - 1)
  const y0 = Math.max(c.y - r, -CELL_LIMIT)
  const y1 = Math.min(c.y + r, CELL_LIMIT - 1)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ch = g.chunks.get(chunkKeyOfCell(x, y))
      if (ch === undefined) {
        // Un chunk sin materializar no tiene cuerpos por definición: los cuerpos
        // solo entran por `placeBody`, que materializa. Saltear el chunk entero
        // sería mejor todavía; no se hace porque complicaría el recorrido por una
        // ganancia que solo aparece con radios enormes.
        continue
      }
      const b = chunkBodiesAt(ch, localIndex(x, y))
      if (b.length === 0) continue
      const at: Cell = { x, y }
      // Copia del arreglo antes de iterar: `fn` puede mover el cuerpo que acaba
      // de recibir, y mutar la cubeta mientras se la recorre saltea elementos.
      for (const id of [...b]) fn(id, at)
    }
  }
}

// ─── Los invariantes ────────────────────────────────────────────────────────

/**
 * Todo lo que está mal en la grilla, en orden fijo. Devuelve una lista y no un
 * booleano por la misma razón que `violationsOf` en `body.ts`: quien la llama
 * tiene que poder decir QUÉ está mal.
 *
 * El documento pide «invariantes por tick». Esto recorre el mundo entero, así que
 * NO es para correr en cada tick de una partida: es para los tests, para el juez
 * y para un modo de depuración. Un chequeo O(mundo) adentro del tick es la
 * primera cosa que alguien desactiva cuando mide, y entonces deja de existir.
 */
export function gridInvariants(g: Grid): readonly string[] {
  const malas: string[] = []
  const vistos = new Map<string, number>()

  for (const k of chunkKeysInOrder(g)) {
    const ch = g.chunks.get(k)
    if (ch === undefined) continue
    if (chunkKey(ch.cx, ch.cy) !== k) {
      malas.push(`el chunk ${ch.cx},${ch.cy} está guardado bajo la clave ${k}`)
    }
    let cuenta = 0
    for (let i = 0; i < ch.bodies.length; i++) {
      const b = ch.bodies[i]
      if (b === undefined) continue
      if (b.length === 0) {
        malas.push(`cubeta vacía sin borrar en el chunk ${ch.cx},${ch.cy} celda ${i}`)
        continue
      }
      cuenta += b.length
      for (const id of b) {
        const celda = cellAtLocal(ch.cx, ch.cy, i)
        const key = cellKey(celda.x, celda.y)
        const antes = vistos.get(id)
        if (antes !== undefined) malas.push(`el cuerpo ${id} está en dos celdas a la vez`)
        vistos.set(id, key)
        const dice = g.where.get(id)
        if (dice === undefined) malas.push(`el cuerpo ${id} está en una celda y no en el índice`)
        else if (dice !== key) malas.push(`el cuerpo ${id} está en una celda distinta de la indexada`)
      }
    }
    if (cuenta !== ch.bodyCount) {
      malas.push(`el chunk ${ch.cx},${ch.cy} dice tener ${ch.bodyCount} cuerpos y tiene ${cuenta}`)
    }
    for (let f = 0; f < FIELD_COUNT; f++) {
      const a = ch.fields[f]
      if (a === undefined || a.length !== ch.bodies.length) {
        malas.push(`el campo ${f} del chunk ${ch.cx},${ch.cy} no tiene el largo del chunk`)
      }
    }
  }

  for (const id of [...g.where.keys()].sort()) {
    if (!vistos.has(id)) malas.push(`el cuerpo ${id} está en el índice y en ninguna celda`)
  }
  return malas
}

// ─── Guardar y cargar ───────────────────────────────────────────────────────

/**
 * La forma canónica de la grilla, y lo que se hashea.
 *
 * Dos decisiones, las dos por el mismo criterio del hito:
 *
 * - los chunks van EN ORDEN de clave, no en orden de materialización;
 * - los chunks impecables NO van. Materializar es una consecuencia de por dónde
 *   caminó la criatura, no un hecho del mundo, y si entrara al snapshot dos
 *   partidas idénticas exploradas en distinto orden tendrían hashes distintos.
 *
 * El índice `where` tampoco va: se reconstruye de las cubetas al cargar.
 */
export interface GridSnapshot {
  readonly chunks: readonly ChunkSnapshot[]
}

export function serializeGrid(g: Grid): GridSnapshot {
  const chunks: ChunkSnapshot[] = []
  for (const k of chunkKeysInOrder(g)) {
    const ch = g.chunks.get(k)
    if (ch === undefined || chunkIsPristine(ch)) continue
    chunks.push(serializeChunk(ch))
  }
  return { chunks }
}

export function deserializeGrid(s: GridSnapshot): Grid {
  const g = createGrid()
  for (const cs of s.chunks) {
    const ch = deserializeChunk(cs)
    const k = chunkKey(ch.cx, ch.cy)
    if (g.chunks.has(k)) throw new RangeError(`el chunk ${ch.cx},${ch.cy} viene dos veces`)
    g.chunks.set(k, ch)
    for (const [i, ids] of cs.bodies) {
      for (const id of ids) {
        const at = cellAtLocal(ch.cx, ch.cy, i)
        const key = cellKey(at.x, at.y)
        // Un id repetido haría que `where` apunte a una sola de las dos celdas y
        // la otra quedaría con un fantasma. Es dato de afuera: se rechaza acá y
        // no se descubre veinte ticks después.
        if (g.where.has(id)) throw new RangeError(`el cuerpo ${id} viene en dos celdas`)
        g.where.set(id, key)
      }
    }
  }
  return g
}
