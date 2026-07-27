/**
 * LA CELDA — el terreno, y por qué no es una entidad.
 *
 * El documento de arquitectura le reprocha a Ánima I que «el agua deja de ser 80
 * entidades». Ese es literalmente el trabajo de este archivo: un charco no es una
 * lista de cuerpos con `id`, `parts` y `state` — es un número por celda, en un
 * `Int32Array`. Un lago de 4000 celdas cuesta 16 KB y cero recorridos; como
 * entidades costaría 4000 objetos que hay que filtrar diez veces por tick.
 *
 * Acá no hay almacenamiento: hay la GEOMETRÍA y el LAYOUT que `chunk.ts` y
 * `grid.ts` usan. Está separado porque el layout es lo que tiene que ser estable
 * —lo lee el serializador, lo lee el hash, lo va a leer el render— y mezclarlo
 * con el contenedor haría que cambiar una estructura de datos moviera el formato
 * de guardado.
 *
 * ─── Las cuatro cualidades de celda salen del catálogo, no de acá ───────────
 *
 * `wet`, `oxygen`, `temperature` y `sheltered` las declara `quality.ts` de
 * `@anima/physics` (ADR II-0002). Este archivo NO las vuelve a escribir: filtra
 * las que se guardan del catálogo y les agrega UN campo propio, `cover`, que es
 * el lugar de la ley 12. Si mañana el catálogo suma una cualidad de celda, el
 * layout la toma sola y el test de abajo lo verifica; si alguien la agrega
 * derivada, el test falla y hay que decidir a mano, que es lo correcto.
 *
 * ─── Por qué `cover` y no `sheltered` guardado ──────────────────────────────
 *
 * El ADR II-0002 es explícito: `sheltered` es DERIVADA, y guardarla la
 * convertiría en una propiedad que hay que resincronizar cada vez que algo se
 * mueve. Pero la oclusión que la produce sí es un acumulado que alguien tiene que
 * escribir: la ley 12 suma cuando se coloca un cuerpo tapando y resta cuando se
 * saca. Entonces se guarda LA CAUSA (`cover`, cuánta oclusión aportan los cuerpos
 * de encima) y se calcula EL EFECTO (`sheltered`) al leerlo. El número que se
 * suma lo pone la ley —la calibración no es de la grilla—; el lugar donde va lo
 * pone este archivo.
 */

import {
  CELDA_AL_AIRE,
  CELL_QUALITIES,
  cellSpecOf,
  fclamp,
  FIXED_MAX,
  fx,
  type CellQuality,
  type Fixed,
} from '@anima/physics'

// ─── El lugar ───────────────────────────────────────────────────────────────

/**
 * Una celda del mundo. Enteros, sin fracción: la grilla es discreta y la posición
 * de un cuerpo es una celda, no un punto. Misma forma que el `Cell` que
 * `skill-api.d.ts` le muestra a las habilidades, a propósito — la criatura y el
 * mundo hablan del mismo lugar con el mismo tipo.
 */
export interface Cell {
  readonly x: number
  readonly y: number
}

/**
 * La clave numérica de una celda. Es un `number` y el alias existe para que se
 * lea en las firmas: un `Map<CellKey, …>` dice que se indexa por celda, y un
 * `Map<number, …>` no dice nada.
 */
export type CellKey = number

/**
 * 16×16 celdas por chunk. El número no es libre:
 *
 * - **Abajo**: un chunk demasiado chico multiplica los `Map.get` (uno por celda
 *   vecina que se lee) y el costo por celda pasa a ser el del contenedor.
 * - **Arriba**: un chunk demasiado grande hace cara la materialización por
 *   demanda. Con 16, entrar a un chunk nuevo cuesta 4 KB (256 celdas × 4 campos
 *   × 4 bytes); con 64 costaría 64 KB por cada paso que cruza un borde, y
 *   caminar diez celdas materializaría medio megabyte de terreno que nadie mira.
 *
 * Es potencia de dos porque `>>` y `&` son exactos y baratos para coordenadas
 * negativas: `-1 >> 4` es −1 (piso, no truncado) y `-1 & 15` es 15. Con una
 * división habría que elegir entre `Math.floor` y `Math.trunc` en cada sitio, y
 * el error de elegir mal solo aparece del lado negativo del mundo.
 */
export const CHUNK_BITS = 4
export const CHUNK_SIZE = 1 << CHUNK_BITS
export const CHUNK_MASK = CHUNK_SIZE - 1
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE

/**
 * El mundo va de −2²⁰ a 2²⁰−1 en las dos direcciones: 2 millones de celdas de
 * lado, o sea 4.4 × 10¹² celdas. No es «infinito» —el dios perezoso lo llama así
 * y a la escala del juego lo es— pero es un límite ESCRITO, y eso es lo que
 * importa: las claves de celda y de chunk son productos que tienen que caer por
 * debajo de 2⁵³ para que el double las represente EXACTO. Sin la cota, una
 * partida muy vieja empezaría a colisionar claves en silencio.
 */
export const CELL_LIMIT = 1 << 20
const CELL_SPAN = CELL_LIMIT * 2
const CHUNK_LIMIT = CELL_LIMIT >> CHUNK_BITS
const CHUNK_SPAN = CHUNK_LIMIT * 2

/** La coordenada de chunk que contiene a `v`. Piso, también para los negativos. */
export function chunkCoord(v: number): number {
  return v >> CHUNK_BITS
}

/** La coordenada dentro del chunk, siempre en [0, CHUNK_SIZE). */
export function localCoord(v: number): number {
  return v & CHUNK_MASK
}

/** El índice de la celda dentro de los arreglos del chunk. Orden por filas. */
export function localIndex(x: number, y: number): number {
  return (localCoord(y) << CHUNK_BITS) | localCoord(x)
}

/**
 * La celda que ocupa el índice local `i` dentro del chunk `(cx, cy)`. El inverso
 * exacto de `localIndex`, y existe para que nadie vuelva a escribir el
 * desplazamiento a mano: el par «índice ↔ celda» tiene que ser uno solo, porque
 * un desarme mal escrito en el cargador pondría los cuerpos en la celda espejada
 * y el mundo cargaría torcido sin que nada falle.
 */
export function cellAtLocal(cx: number, cy: number, i: number): Cell {
  return { x: (cx << CHUNK_BITS) + (i & CHUNK_MASK), y: (cy << CHUNK_BITS) + (i >> CHUNK_BITS) }
}

export function inWorld(x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= -CELL_LIMIT &&
    x < CELL_LIMIT &&
    y >= -CELL_LIMIT &&
    y < CELL_LIMIT
  )
}

/**
 * Clave numérica de una celda. Monótona en (y, x), así que ordenar claves por
 * número es ordenar celdas por filas — el orden canónico de todo el paquete.
 *
 * Numérica y no `` `${x},${y}` `` por dos razones, y la segunda es la que duele:
 * una clave de texto obliga a un hash de cadena en cada `Map.get` del tick, y
 * ordenar claves de texto es comparar caracteres, que es exactamente el
 * `entitiesAt = Object.values().sort()` con ids parseados que el documento le
 * reprocha a Ánima I.
 *
 * **Lanza** fuera del mundo, en vez de recortar. Recortar teletransportaría el
 * cuerpo al borde sin que nadie se entere; una coordenada afuera es un error de
 * quien generó el movimiento, y el que tiene que decidir qué hacer con el borde
 * es él, no la grilla. `inWorld()` está para preguntar antes.
 */
export function cellKey(x: number, y: number): CellKey {
  if (!inWorld(x, y)) throw new RangeError(`celda fuera del mundo: ${x},${y}`)
  return (y + CELL_LIMIT) * CELL_SPAN + (x + CELL_LIMIT)
}

/**
 * La clave de la celda de un lugar. **Es la única forma canónica del paquete**, y
 * eso hubo que ganárselo: hasta el pase de integración había DOS `cellKey`, una
 * acá con orden por filas y otra en `intent.ts` con orden por columnas, sobre el
 * mismo mundo y con el mismo span. Dos formas canónicas de la misma cosa en el
 * mismo paquete no son una molestia de nombres: son dos hashes distintos para el
 * mismo mundo esperando a que alguien mezcle los dos caminos. Quedó ésta —la de
 * `cell.ts`— porque es la que ordena por filas, que es el orden en que el terreno
 * está guardado adentro del chunk.
 */
export function keyOfCell(c: Cell): CellKey {
  return cellKey(c.x, c.y)
}

export function cellFromKey(k: CellKey): Cell {
  const y = Math.floor(k / CELL_SPAN)
  return { x: k - y * CELL_SPAN - CELL_LIMIT, y: y - CELL_LIMIT }
}

/** Clave numérica de un chunk. Monótona en (cy, cx), igual que la de celda. */
export function chunkKey(cx: number, cy: number): number {
  if (
    !Number.isInteger(cx) ||
    !Number.isInteger(cy) ||
    cx < -CHUNK_LIMIT ||
    cx >= CHUNK_LIMIT ||
    cy < -CHUNK_LIMIT ||
    cy >= CHUNK_LIMIT
  ) {
    throw new RangeError(`chunk fuera del mundo: ${cx},${cy}`)
  }
  return (cy + CHUNK_LIMIT) * CHUNK_SPAN + (cx + CHUNK_LIMIT)
}

export function chunkFromKey(k: number): { readonly cx: number; readonly cy: number } {
  const cy = Math.floor(k / CHUNK_SPAN)
  return { cx: k - cy * CHUNK_SPAN - CHUNK_LIMIT, cy: cy - CHUNK_LIMIT }
}

/** La clave del chunk que contiene a la celda. Sin construir el par intermedio. */
export function chunkKeyOfCell(x: number, y: number): number {
  return chunkKey(chunkCoord(x), chunkCoord(y))
}

/**
 * Orden canónico de celdas: por filas. Es una comparación de números, no de
 * texto — `localeCompare` está prohibido y `<` sobre cadenas ordena por unidades
 * UTF-16, que también funcionaría pero cuesta más y no dice nada mejor.
 */
export function compareCells(a: Cell, b: Cell): number {
  return keyOfCell(a) - keyOfCell(b)
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y
}

// ─── El layout de los campos ────────────────────────────────────────────────

/**
 * Las cualidades de celda que SE GUARDAN. `sheltered` no está: es derivada.
 *
 * El `Exclude` escribe el nombre una sola vez y dice por qué está excluido; el
 * filtro de abajo lo verifica contra el catálogo en tiempo de ejecución, y el
 * test compara las dos cosas. Es la misma disciplina que `isDerived()` en
 * `quality.ts`: una sola pregunta sobre si algo se guarda.
 */
export type StoredCellQuality = Exclude<CellQuality, 'sheltered'>

/**
 * El campo de la ley 12 (ADR II-0002): cuánta oclusión aportan los cuerpos
 * colocados sobre esta celda, en `Fixed`. No es una cualidad del catálogo porque
 * no se lee como cualidad —lo que se lee es `sheltered`, que sale de él— pero se
 * guarda igual que las otras tres y viaja en el mismo arreglo.
 */
export const COVER = 'cover'

export type CellField = StoredCellQuality | typeof COVER

const STORED: readonly StoredCellQuality[] = CELL_QUALITIES.filter((s) => !s.derived).map(
  // El `as` está cubierto por el test «los campos guardados son los del
  // catálogo»: si alguien agrega una cualidad de celda derivada nueva, o vuelve
  // guardada a `sheltered`, esa prueba se pone roja antes que nada más.
  (s) => s.id as StoredCellQuality,
)

/**
 * El orden de los campos, y con él el orden de los arreglos en el snapshot. Sale
 * del catálogo (que es estable y está versionado) más `cover` al final, para que
 * agregar un campo propio nunca corra los índices de los que ya existen.
 */
export const CELL_FIELDS: readonly CellField[] = [...STORED, COVER]

export const FIELD_COUNT = CELL_FIELDS.length

const FIELD_INDEX: ReadonlyMap<CellField, number> = new Map(CELL_FIELDS.map((f, i) => [f, i]))

/** Lanza si el campo no existe, por la misma razón que `specOf` en `quality.ts`. */
export function fieldIndex(f: CellField): number {
  const i = FIELD_INDEX.get(f)
  if (i === undefined) throw new RangeError(`campo de celda desconocido: ${String(f)}`)
  return i
}

/**
 * Los índices de los cuatro campos, resueltos una vez. El camino caliente del
 * tick no debería pagar un `Map.get` por celda para saber dónde vive el oxígeno.
 */
export const IDX_WET = fieldIndex('wet')
export const IDX_OXYGEN = fieldIndex('oxygen')
export const IDX_TEMPERATURE = fieldIndex('temperature')
export const IDX_COVER = fieldIndex(COVER)

/**
 * El valor de cada campo en una celda que nadie tocó.
 *
 * Sale de `CELDA_AL_AIRE` de `leyes.ts` y NO de números nuevos. Es importante que
 * sea así: «al aire libre» ya está definido del lado de la física —oxígeno 1,
 * seco, temperatura ambiente— y si la grilla se inventara su propio ambiente
 * habría dos definiciones de aire y las leyes correrían contra la que no es.
 */
export const CELL_FIELD_AMBIENT: readonly Fixed[] = CELL_FIELDS.map((f) => ambientOf(f))

function ambientOf(f: CellField): Fixed {
  switch (f) {
    case 'wet':
      return fx(CELDA_AL_AIRE.wet)
    case 'oxygen':
      return fx(CELDA_AL_AIRE.oxygen)
    // `Celda.ambiente` y la cualidad de celda `temperature` son LA MISMA
    // magnitud: la ley 1 relaja hacia ella. Se llaman distinto porque la ley la
    // ve como «el ambiente del cuerpo» y la grilla como «la temperatura de acá».
    // La traducción vive en este switch y en `celdaAt()`, en ningún otro lado.
    case 'temperature':
      return fx(CELDA_AL_AIRE.ambiente)
    case COVER:
      // Nada tapa nada hasta que alguien ponga algo encima.
      return 0 as Fixed
  }
}

/**
 * El rango de cada campo, en `Fixed`. Los tres primeros salen del catálogo; el de
 * `cover` es todo el rango positivo.
 *
 * Por qué `cover` no tiene techo propio: el techo tendría que ser una constante
 * de calibración («cuatro capas ya no tapan más que tres») y rompería la simetría
 * de poner y sacar — con un tope, sumar tres coberturas y sacar dos no devolvería
 * el valor de una, y el estado dependería del ORDEN en que se pusieron las cosas.
 * Que dos historias distintas den estados distintos es exactamente lo que el
 * criterio del hito prohíbe. La saturación se hace donde no duele: al leer
 * `sheltered`, que sí está acotado en [0, 1] por el catálogo.
 */
export const CELL_FIELD_RANGE: readonly (readonly [Fixed, Fixed])[] = CELL_FIELDS.map((f) =>
  f === COVER ? ([0 as Fixed, FIXED_MAX] as const) : rangeOfStored(f),
)

function rangeOfStored(q: StoredCellQuality): readonly [Fixed, Fixed] {
  const [lo, hi] = cellSpecOf(q).range
  return [fx(lo), fx(hi)]
}

/** Recorta al rango del campo. Nada entra a un chunk sin pasar por acá. */
export function clampField(fi: number, v: Fixed): Fixed {
  const r = CELL_FIELD_RANGE[fi]
  if (r === undefined) throw new RangeError(`campo de celda fuera de rango: ${fi}`)
  return fclamp(v, r[0], r[1])
}

// ─── La única cualidad de celda que no se guarda ────────────────────────────

const SHELTERED_RANGE: readonly [Fixed, Fixed] = ((): readonly [Fixed, Fixed] => {
  const [lo, hi] = cellSpecOf('sheltered').range
  return [fx(lo), fx(hi)]
})()

/**
 * `sheltered` a partir de la oclusión acumulada. Es una saturación y nada más, y
 * eso es a propósito: la forma de la curva —cuánto tapa una malla contra una
 * losa— la decide `permeability` cuando la ley 12 calcula lo que suma a `cover`,
 * no la grilla al leerlo. Si la curva viviera acá, la grilla estaría calibrando
 * física y habría dos lugares donde tocar el mismo fenómeno.
 *
 * Se calcula al leer, nunca se guarda (ADR II-0002): así no puede quedar vieja
 * cuando alguien saca lo que tapaba.
 */
export function shelteredFrom(cover: Fixed): Fixed {
  return fclamp(cover, SHELTERED_RANGE[0], SHELTERED_RANGE[1])
}
