// ─── @anima/world/dios.ts ────────────────────────────────────────────────────
//
// LA COSTURA ENTRE EL MUNDO Y EL DIOS.
//
// Antes de este archivo, `grep -rln "@anima/oracle" packages --include=*.ts` no
// devolvía ni un archivo de `world/src`: **el mundo y el dios no se conocían**.
// Los chunks del mundo nacían en ambiente (`CELL_FIELD_AMBIENT`), el terreno que
// el dios decretaba no lo veía nadie, `WorldRng` era un tipo sin fábrica, y el
// techo calórico del Hito 3 —medido al 100,00% sobre 314 chunks— estaba cobrado
// en un camino que en la partida no recorría nadie.
//
// ─── 1. La flecha va del mundo al dios, y no al revés ───────────────────────
//
// `@anima/oracle` NO depende de `@anima/world` y eso es a propósito: está escrito
// en `extraccion.ts`, donde `MundoConDado` declara el mínimo del mundo por
// ESTRUCTURA (`{ phys, rng, calorias }`) justamente para no importar
// `WorldState`. Con las dos flechas habría un ciclo de paquetes.
//
// Así que la dirección que quedaba libre es ésta, y es además la correcta por el
// contenido: el mundo es el árbitro y el dios es una fuente de hechos que el
// árbitro consulta. Verificado: `oracle/package.json` depende sólo de
// `@anima/physics`, y `world/package.json` ahora depende de los dos.
//
// ─── 2. El estado del dios vive ADENTRO del `WorldState` ────────────────────
//
// Es la decisión más delicada del frente y la razón es una sola: **si vive
// afuera, el replay diverge**. El journal reconstruye las intenciones; la suerte
// no es una intención. Un dado con estado externo haría que reproducir una
// partida diera un mundo coherente y distinto, sin causa visible — exactamente el
// modo de falla que `pasoDelMundoA` existe para atajar con la frecuencia.
//
// Estando adentro, entra al hash y entra al snapshot, y las dos cosas son
// necesarias: dos mundos gemelos que tiraron el dado distinta cantidad de veces
// NO son el mismo mundo, y un guardado que no lleva el dado se reanuda con otra
// suerte.
//
// Y por eso `EstadoDelDios` es DATO PLANO: números, texto, `Map` y arreglos.
// `hashWorld` lanza con una función o una clase, y un guardado tiene que
// sobrevivir a `JSON.stringify`. De ahí las tres traducciones que hace este
// archivo:
//
//   `Seed` es `bigint`     → viaja como TEXTO (`pregunta.ts` ya lo dice: «un
//                            bigint NO entra en hashWorld, al journal va como
//                            texto»);
//   `WorldRng` es clausura → viaja como el ENTERO de su estado, y la clausura se
//                            arma al empezar el tick y se tira al terminarlo;
//   `LibroCalorico` es clase → viaja como su DIARIO de cobros, que es lo que su
//                            propio encabezado nombra como «el estado que viaja».
//
// ─── 3. El terreno NO se copia a las celdas del mundo ───────────────────────
//
// Esto es lo que resuelve «el río se seca solo». La otra forma —copiar el
// `Terreno` decretado a `WorldState.cells` al pisar un chunk— tiene tres
// problemas y ninguno es chico:
//
//   a. **materializar cambiaría el hash**. Escribir 256 celdas con `wet` distinto
//      del ambiente hace que dos partidas gemelas exploradas en distinto orden
//      difieran, y «el mismo mundo explorado en dos órdenes da el mismo hash» es
//      un criterio verificable escrito del Hito 3;
//   b. **el río se secaría**. `wet` relaja al ambiente a 0,2/s por catálogo
//      (`quality.ts`), así que un lago copiado a las celdas se evapora en cinco
//      segundos salvo que algo lo reponga todos los ticks. (MEDIDO: hoy no se
//      seca, porque **ningún sistema del mundo relaja las celdas** — `d.cells` se
//      lee en `celdaDe` y se copia en `cerrar`, y no se escribe en ningún otro
//      lado. O sea que el peligro es futuro y no presente, y esta decisión lo
//      cierra antes de que exista);
//   c. **costaría 256 celdas por chunk pisado**, para guardar algo que ya es una
//      función pura de la semilla.
//
// Acá el decreto es el PISO y `WorldState.cells` es lo que el mundo escribió
// ENCIMA. `celdaDe` lee la propia si está y el decreto si no. El río está donde
// el dios dice, se ve desde cualquier celda, cruza los bordes de chunk sin
// costura —el 88,8% de los chunks de `agua-dulce` está enteramente inundado, o
// sea que la orilla es casi siempre del chunk vecino— y no se puede secar porque
// no está guardado en ningún lado que se pueda secar.
//
// Determinismo: acá no hay `Math.random`, `Date`, `performance`, `Intl`,
// `localeCompare` ni `Math` trascendente.

import type { Body, Celda, Physics } from '@anima/physics'
import { fixedFromRaw, unfx } from '@anima/physics'
import type { Cobro, Seed, Stock } from '@anima/oracle'
import {
  CELDAS_DE_LADO,
  LibroCalorico,
  dadoDelMundo,
  decretarChunk,
  formaDeLoSuelto,
  stockDeAgua,
  waterCellKey,
  type ChunkDecretado,
  type DadoDelMundo,
  type Suelta,
} from '@anima/oracle'

import { chunkCoord, localCoord, CHUNK_SIZE, type Cell } from './cell.js'
import type { BodyId } from './intent.js'
import type { CellState } from './step.js'

// ─── El lado del chunk tiene que ser el mismo de los dos lados ──────────────

/**
 * Los dos paquetes tienen su propio 16 —`CHUNK_SIZE` acá, `CELDAS_DE_LADO`
 * allá— y esta línea es lo único que impide que se separen.
 *
 * No es paranoia: los dos números están calibrados por razones distintas (acá,
 * el costo de materializar 4 KB de terreno; allá, cuántas celdas entran en una
 * respuesta del dios) y nada más que esto los ata. Si alguien mueve uno, el
 * índice local del decreto y el índice local del mundo dejan de nombrar la misma
 * celda, y el agua aparece espejada dentro del chunk sin que nada falle.
 */
if (CHUNK_SIZE !== CELDAS_DE_LADO) {
  throw new RangeError(
    `el chunk del mundo tiene ${String(CHUNK_SIZE)} celdas de lado y el del dios ${String(CELDAS_DE_LADO)}`,
  )
}

// ─── El estado del dios, como dato plano ────────────────────────────────────

/**
 * Lo que el mundo lleva del dios, y que por lo tanto entra al hash, al snapshot
 * y al journal.
 *
 * Los cuatro campos son los cuatro hechos que NO se pueden recalcular de la
 * semilla: la semilla misma, cuántas veces se tiró el dado, cuánto queda en cada
 * pozo, y cuánto entregó cada chunk. Todo lo demás —el terreno, el bioma, la
 * capacidad de un pozo, el techo de un chunk— es función pura y se vuelve a
 * calcular; guardarlo sería una segunda copia que se puede desincronizar.
 */
/** Un pozo del que alguien ya sacó algo: el banco que lo representa y lo que le
 *  queda. Un objeto y no un par `[id, stock]` porque un par de dos elementos
 *  vuelve de JSON como arreglo y hay que acordarse de cuál era cuál. */
export interface PozoTocado {
  readonly banco: BodyId
  readonly stock: Stock
}

/** Los pozos en orden canónico por id de banco. Se llama en un solo lugar y
 *  existe para que ese orden esté escrito una vez: dos partidas que llegaron al
 *  mismo reparto por caminos distintos tienen que hashear igual. */
export function ordenarPozos(ps: readonly PozoTocado[]): readonly PozoTocado[] {
  return [...ps].sort((a, b) => (a.banco < b.banco ? -1 : a.banco > b.banco ? 1 : 0))
}

export interface EstadoDelDios {
  /**
   * La semilla, EN TEXTO. `Seed` es `bigint` y `hashWorld` lanza con un bigint a
   * propósito; `pregunta.ts` ya declara que al journal va como texto.
   */
  readonly semilla: string
  /** El estado del dado del mundo. Un entero de 32 bits: ver `dadoDelMundo`. */
  readonly dado: number
  /**
   * Los pozos que ALGUIEN YA TOCÓ, en orden canónico por el id del banco.
   *
   * Es un ARREGLO y no un `Map`, y eso lo decidió un test: `EstadoDelDios` viaja
   * adentro de una ranura de `worldSlots`, y una ranura tiene que sobrevivir a
   * `JSON.stringify`. **Un `Map` no sobrevive**: sale como `{}`, o sea que
   * guardar la partida y volver a cargarla le devolvía a cada río su población
   * entera — la fuente infinita por la puerta de atrás del guardado, que es
   * exactamente el agujero que el libro calórico existe para tapar. Lo encontró
   * el criterio (d) de `tests/hito-5-la-pesca.test.ts` en el primer intento de
   * ida y vuelta por JSON, y no lo habría encontrado un ida y vuelta en memoria.
   *
   * Los pozos que nadie tocó NO están: se recalculan del decreto, que es función
   * pura de la semilla. Acá vive sólo la DESVIACIÓN, igual que `cells` guarda
   * sólo lo que el mundo escribió sobre el terreno.
   *
   * Se indexa por el id del CUERPO —el banco de peces— y no por `Stock.id`
   * porque es lo que el mundo tiene en la mano cuando alguien pesca:
   * `drawFromStock` recibe el cuerpo del rol `source`. El `Stock.id` de adentro
   * sigue siendo el del dios —la celda de agua canónicamente menor— porque es con
   * ése que se le pregunta.
   *
   * El orden es canónico por construcción (`ordenarPozos`), así que dos partidas
   * que llegaron al mismo reparto por caminos distintos hashean igual.
   */
  readonly stocks: readonly PozoTocado[]
  /**
   * EL DIARIO DEL LIBRO CALÓRICO. Es lo que `LibroCalorico` nombra como «el
   * estado que hay que guardar con la partida»: sin él, cargar un guardado le
   * devuelve a cada chunk su techo entero y la criatura se vuelve a comer el
   * mismo río — la fuente infinita por la puerta de atrás del guardado.
   */
  readonly cobros: readonly Cobro[]
  /**
   * LOS CHUNKS QUE YA SE ABRIERON: aquellos cuyas `sueltas` el mundo ya convirtió
   * en cuerpos. Claves de `chunkKey`, en orden numérico ascendente.
   *
   * Es la MISMA idea que `stocks` y por la misma razón: acá vive sólo la
   * DESVIACIÓN de lo que la semilla dice por su cuenta. El decreto es función pura
   * y siempre contesta «en este chunk hay estas diez cosas»; lo que no es función
   * pura es si el mundo ya las trajo, porque una vez traídas la criatura las
   * quema, se las come y las ata, y ninguna de esas tres cosas se puede recalcular
   * de la semilla.
   *
   * ─── Por qué no alcanza con preguntar si el cuerpo está ─────────────────────
   *
   * La idempotencia barata sería `if (d.bodies.has(id)) continue`. **Miente en el
   * único caso que importa**: la criatura frota dos varas, las quema, y el cuerpo
   * desaparece del mundo. Al tick siguiente `d.bodies` ya no lo tiene y el chunk
   * volvería a parirlo — leña infinita por la puerta de atrás, que es exactamente
   * el agujero que el libro calórico existe para tapar del lado de la pesca.
   * Guardar el chunk y no el cuerpo dice lo que de verdad pasó: **el chunk ya dio
   * lo que tenía**.
   *
   * OPCIONAL, y omitido mientras esté vacío. `hashWorld` saltea las propiedades
   * `undefined` de un objeto y `JSON.stringify` también, así que un mundo donde
   * nadie abrió un chunk —los ocho paquetes están llenos de ellos— hashea
   * EXACTAMENTE igual que antes de que este campo existiera. Un arreglo vacío no:
   * ése cuenta como clave y habría movido el hash de todos los mundos con dios sin
   * que ninguno cambiara.
   */
  readonly sembrados?: readonly number[]
}

/** Un dios recién nacido: la semilla, el dado en su estado inicial y nada más.
 *  Sin `sembrados`: nadie abrió ningún chunk todavía, y el campo ausente es lo
 *  que hace que su hash sea el de siempre. */
export function crearDios(semilla: Seed, dado = 0): EstadoDelDios {
  return { semilla: String(semilla), dado: dado | 0, stocks: [], cobros: [] }
}

/** La semilla de vuelta a `bigint`. `BigInt` sobre un entero en texto es exacto
 *  y no depende del locale. */
export function semillaDe(d: EstadoDelDios): Seed {
  return BigInt(d.semilla)
}

/**
 * El libro calórico de este estado, reconstruido de su diario.
 *
 * **Se reconstruye y no se memoiza**, y hay que decir lo que cuesta: es O(cobros)
 * cada vez que alguien pesca. Una caché por identidad del arreglo (el recurso de
 * `hashPhysics`) NO sirve acá y por una razón fina: `LibroCalorico.cobros()`
 * devuelve su diario POR REFERENCIA y `cobrar` le hace `push`, o sea que la
 * identidad del arreglo no cambia al cobrar. Memoizar por esa clave dejaría la
 * entrada vieja apuntando a un libro que ya cobró de más, y un replay desde el
 * estado anterior arrancaría con una calorías fantasma.
 *
 * Lo que cuesta, medido con la aritmética: una partida de cinco días con una
 * criatura pescando sin parar entrega del orden de 600 piezas, o sea 600 tickets
 * de reconstrucción de un diario que crece hasta 600 — 180 000 `Map.set` en toda
 * la partida, unos pocos milisegundos repartidos en 20 000 ticks. Es el precio de
 * que el estado sea dato plano, y es barato.
 */
export function libroDe(d: EstadoDelDios): LibroCalorico {
  return new LibroCalorico(semillaDe(d), d.cobros)
}

/** El dado del mundo de este estado. La clausura vive UN tick: ver el encabezado. */
export function dadoDe(d: EstadoDelDios): DadoDelMundo {
  return dadoDelMundo(d.dado)
}

// ─── El decreto, memoizado ──────────────────────────────────────────────────

/**
 * Un chunk decretado, con las celdas del mundo ya traducidas.
 *
 * Las 256 `CellState` se arman UNA vez por chunk y se COMPARTEN: `celdaDe` corre
 * una vez por cuerpo y por tick, y armar un objeto por lectura era —medido en el
 * Hito 2 para el caso del aire libre— la mitad del costo que el mundo le agrega a
 * la física. Son de sólo lectura y nadie las muta.
 */
export interface Decreto {
  readonly chunk: ChunkDecretado
  /** Una por índice local, en el orden por filas que comparten los dos paquetes. */
  readonly celdas: readonly CellState[]
  /**
   * Las mismas 256, con la forma que las doce leyes leen (`Celda` de la física).
   *
   * Es la MISMA información escrita dos veces, y eso normalmente es un pecado
   * acá; se paga a propósito y por una razón medida: `celdaDe` corre una vez por
   * cuerpo y por tick —5000 veces— y traducir al vuelo asignaría un objeto en cada
   * una. En el Hito 2 esa sola asignación era la mitad del costo que el mundo le
   * agrega a la física, y por eso existe `CELDA_LIBRE` compartido. Las dos copias
   * se arman de un solo recorrido, en la misma función, así que no hay dos
   * cuentas que puedan divergir: hay una cuenta y dos formas.
   */
  readonly entornos: readonly Celda[]
  /**
   * El pozo del chunk como el mundo lo necesita: dónde va el banco de peces y
   * qué stock le corresponde. `undefined` cuando el chunk no tiene agua, o
   * cuando la tiene y no vive nada extraíble en ella (un charco en la pradera).
   */
  readonly pozo: { readonly at: Cell; readonly stock: Stock } | undefined
}

/**
 * La caché de decretos.
 *
 * ─── Por qué una caché acá no puede mentir ──────────────────────────────────
 *
 * `decretarChunk` es una función PURA de `(seed, cx, cy, core, phys)`, así que una
 * caché sobre ella sólo puede ser lenta, nunca incorrecta: no hay invalidación
 * que se pueda hacer mal, porque no hay nada que invalidar. Es el argumento
 * opuesto al de `resolveChunk`, que se niega a memoizar —«una caché sería una
 * segunda fuente de verdad»—: allá la caché sería del DIOS y viviría al lado del
 * ledger, que es quien lleva el compromiso; acá es del MUNDO y no decide nada.
 *
 * La clave de primer nivel es la `Physics` POR IDENTIDAD, con el mismo `WeakMap`
 * que usan `hashPhysics` y `MENOR_IGNICION`. Hace falta porque la garantía de
 * resolubilidad juzga con `cumpleRol` contra el catálogo, así que un catálogo al
 * que la ley 4 le dio de alta una sustancia es, en principio, otro decreto. En la
 * práctica no cambia nada —la garantía sólo siembra de `CANTERA_DEL_MUNDO`, que
 * sale de la tabla de biomas y no del catálogo vivo— pero apoyarse en eso sería
 * apoyarse en un detalle de otro paquete.
 *
 * El tope existe para que una partida muy caminadora no se coma la memoria. Se
 * VACÍA entera al pasarse en vez de tirar la entrada más vieja: un desalojo por
 * antigüedad necesita orden de uso, y el orden de uso depende de la historia. Que
 * la caché se vacíe no cambia ni un bit del mundo —vuelve a calcular lo mismo—
 * pero que dependiera de la historia sería una invitación a que algún día algo
 * más sí lo haga.
 */
const DECRETOS = new WeakMap<Physics, Map<string, Decreto>>()
export const TOPE_DE_DECRETOS_EN_CACHE = 4096

function cacheDe(phys: Physics): Map<string, Decreto> {
  let m = DECRETOS.get(phys)
  if (m === undefined) {
    m = new Map()
    DECRETOS.set(phys, m)
  }
  return m
}

/**
 * EL DECRETO DE UN CHUNK, tal como el mundo lo ve.
 *
 * `core` son los procesos del catálogo vivo, que es lo que la garantía de
 * resolubilidad necesita para juzgar si con lo que hay se puede armar un aparejo.
 * Salen del `Physics` que se pasa, así que el mundo no elige nada: el mismo
 * catálogo con el que juzga a la criatura es el que el dios usa para no dejarla
 * en una trampa.
 */
export function decretoDe(d: EstadoDelDios, phys: Physics, cx: number, cy: number): Decreto {
  const cache = cacheDe(phys)
  const clave = `${String(cx)}:${String(cy)}`
  const memo = cache.get(clave)
  if (memo !== undefined) return memo
  const semilla = semillaDe(d)
  const chunk = decretarChunk(semilla, cx, cy, [...phys.processes.values()], phys)
  const { celdas, entornos } = celdasDe(chunk)
  const nuevo: Decreto = { chunk, celdas, entornos, pozo: pozoDe(semilla, phys, chunk, cx, cy) }
  if (cache.size >= TOPE_DE_DECRETOS_EN_CACHE) cache.clear()
  cache.set(clave, nuevo)
  return nuevo
}

/**
 * El `Terreno` del dios traducido a las celdas del mundo.
 *
 * `wet` y `oxigeno` son `Fixed` allá y reales acá, y `unfx` es la única puerta
 * declarada para cruzar (ADR II-0006). La temperatura ya viene en grados.
 *
 * **`cover` se pierde y hay que decirlo.** El decreto trae cuánto tapa el follaje
 * y `CellState` no tiene dónde ponerlo: el mundo guarda `wet`, `oxygen` y
 * `temperature` y calcula `sheltered` de la oclusión de los CUERPOS colocados
 * encima (`oclusiones`), que es la decisión del ADR II-0002. Meterlo pide un campo
 * más en `CellState`, o sea otro campo en el hash y otro en cada delta. Queda
 * como hueco abierto y medido en `tests/hito-5-la-pesca.test.ts`.
 */
function celdasDe(c: ChunkDecretado): {
  readonly celdas: readonly CellState[]
  readonly entornos: readonly Celda[]
} {
  const celdas: CellState[] = []
  const entornos: Celda[] = []
  const t = c.terreno
  const oxygen = unfx(c.terreno.oxigeno)
  for (let i = 0; i < CELDAS_DE_LADO * CELDAS_DE_LADO; i++) {
    const wet = unfx(fixedFromRaw(t.wet[i] as number))
    celdas.push({ wet, oxygen, temperature: t.temperatura })
    entornos.push({ wet, oxygen, ambiente: t.temperatura })
  }
  return { celdas, entornos }
}

/**
 * Dónde va el banco y qué stock le toca.
 *
 * El id del pozo es la clave de la celda de agua (`waterCellKey`), que es la
 * misma regla de nombre que usa el union-find de `compromiso.ts`: el día que el
 * pozo por chunk se reemplace por la componente conexa, los ids de los pozos de
 * una celda no se mueven y el ledger de una partida vieja los sigue encontrando.
 */
function pozoDe(
  semilla: Seed,
  phys: Physics,
  c: ChunkDecretado,
  cx: number,
  cy: number,
): Decreto['pozo'] {
  if (c.pozo === null) return undefined
  const at: Cell = {
    x: cx * CELDAS_DE_LADO + (c.pozo % CELDAS_DE_LADO),
    y: cy * CELDAS_DE_LADO + Math.floor(c.pozo / CELDAS_DE_LADO),
  }
  const stock = stockDeAgua(semilla, { id: waterCellKey(at.x, at.y), cx, cy, celdas: c.celdasDeAgua }, phys)
  return stock === null ? undefined : { at, stock }
}

/**
 * LA CELDA QUE EL DIOS DECRETA para `(x, y)`. El piso sobre el que el mundo
 * escribe.
 *
 * Devuelve el MISMO objeto para la misma celda mientras la caché lo tenga, que es
 * lo que hace que leerlo en el bucle de las leyes no asigne nada.
 */
export function celdaDecretada(d: EstadoDelDios, phys: Physics, x: number, y: number): CellState {
  const dec = decretoDe(d, phys, chunkCoord(x), chunkCoord(y))
  return dec.celdas[indiceDelMundo(x, y)] as CellState
}

/** La misma celda con la forma que leen las doce leyes. Ver `Decreto.entornos`. */
export function entornoDecretado(d: EstadoDelDios, phys: Physics, x: number, y: number): Celda {
  const dec = decretoDe(d, phys, chunkCoord(x), chunkCoord(y))
  return dec.entornos[indiceDelMundo(x, y)] as Celda
}

/** El índice local, en el orden por filas que comparten `localIndex` de `cell.ts`
 *  e `indiceLocal` de `ley.ts`. La igualdad de los dos lados la sostiene el
 *  chequeo de `CHUNK_SIZE` de arriba. */
function indiceDelMundo(x: number, y: number): number {
  return localCoord(y) * CELDAS_DE_LADO + localCoord(x)
}

// ─── El banco de peces, que es un cuerpo ────────────────────────────────────

/**
 * El prefijo de los cuerpos que pone el dios.
 *
 * Los ids del dios NO salen de `nuevoId` —el contador del mundo— y ésa es toda la
 * decisión: con el contador, el nombre de un banco dependería de CUÁNTOS chunks
 * se pisaron antes, o sea del camino que hizo la criatura. Dos partidas gemelas
 * que exploraron el mismo mundo en distinto orden tendrían el mismo pozo con dos
 * nombres, y con eso dos hashes. Derivándolo del chunk, el nombre es del lugar.
 *
 * `p` antes que `w` en orden de unidad de código, así que los cuerpos del dios
 * quedan primero en el recorrido canónico. Da igual cuál sea el orden mientras sea
 * uno; lo que importa es que ninguno de los dos espacios de nombres pueda pisar al
 * otro, y `w` seguido de nueve dígitos no empieza con `pozo:`.
 */
export const PREFIJO_POZO = 'pozo:'

/** El id del banco de peces del chunk `(cx, cy)`. Función del lugar y de nada más. */
export function idDePozo(cx: number, cy: number): BodyId {
  return `${PREFIJO_POZO}${String(cx)}:${String(cy)}`
}

/**
 * EL BANCO DE PECES COMO CUERPO, con la masa que le queda al pozo.
 *
 * `process.ts` ya lo había escrito: «un banco de peces es un cuerpo con masa, y
 * cuando se lo vaciaron la masa es cero». El rol `source` de `extraccion` pide
 * `mass > 0`, así que ésta es la forma en que un pozo agotado deja de calificar
 * sin que nadie escriba una regla de «pozo vacío».
 *
 * La masa es DERIVADA: `población × masa por pieza`. El `Stock` es el que manda y
 * el cuerpo es su proyección — una sola verdad, con una sola dirección. Que se
 * resincronice cada tick es lo que hace que la reposición se vea desde afuera.
 *
 * `form: 'bloque'` y no `'vara'`: la forma entra en cualidades geométricas
 * (`reach`, `freeStrandEnds`) y el banco no tiene que parecerse a una herramienta.
 */
export function cuerpoDePozo(id: BodyId, stock: Stock, poblacion: number): Body {
  return {
    id,
    form: 'bloque',
    parts: [{ substance: stock.yields, mass: poblacion * unfx(stock.masaPorUnidad), q: {} }],
    joints: [],
    state: {},
  }
}

// ─── Lo que está tirado en el piso, que también son cuerpos ─────────────────

/**
 * El prefijo de las cosas sueltas que el dios sembró.
 *
 * Mismo argumento entero que `PREFIJO_POZO`, y hace falta repetirlo porque acá el
 * riesgo es peor: hay ~10 sueltas por chunk y con `nuevoId` el nombre de cada una
 * dependería de cuántas se materializaron antes, o sea del camino. Dos partidas
 * gemelas que abrieran los mismos chunks en otro orden tendrían la misma rama con
 * dos nombres, dos órdenes canónicos y dos hashes. Acá el nombre es
 * `(chunk, posición en el decreto)`, que es función pura de la semilla.
 *
 * `p` < `s` < `w` en unidades de código, así que el recorrido canónico deja
 * primero los pozos, después lo sembrado y último lo que fabricó la partida.
 * `w` seguido de nueve dígitos no empieza con `suelta:`, y `pozo:` tampoco.
 */
export const PREFIJO_SUELTA = 'suelta:'

/**
 * El id de la suelta número `n` del chunk `(cx, cy)`. Función del lugar y del
 * ÍNDICE DENTRO DEL DECRETO, no de la celda: `scatter` sortea celdas CON
 * REPOSICIÓN, así que dos sueltas del mismo chunk comparten celda con toda
 * naturalidad y un id por celda las haría colisionar de nombre.
 */
export function idDeSuelta(cx: number, cy: number, n: number): BodyId {
  return `${PREFIJO_SUELTA}${String(cx)}:${String(cy)}:${String(n)}`
}

/**
 * UNA COSA TIRADA EN EL PISO, COMO CUERPO.
 *
 * ─── La forma, que es lo único que el decreto no siempre dice ───────────────
 *
 * `Suelta.form` viene puesto en lo que `ensureSolvable` sembró —ahí la forma ES
 * la razón de la siembra: una rama hecha vara alcanza dos celdas y hecha bloque
 * no— y viene `undefined` en lo que dejó `scatter`. Cuando falta se infiere con
 * `formaDeLoSuelto` del oráculo, que es la MISMA función con la que el dios juzgó
 * si el chunk era jugable. Se importa en vez de reescribirse: dos copias de esa
 * regla harían que el mundo materialice con una forma lo que el dios garantizó
 * con otra, y el chunk quedaría injugable en silencio.
 *
 * ─── Y la temperatura, que el pozo no escribe y ésta sí ─────────────────────
 *
 * Un cuerpo con `state: {}` vale 0 °C para `qualityOf`, y una rama tirada en un
 * chunk a 15 °C no está a cero: está a lo que el lugar diga. Sin esto la ley 1
 * la relaja hacia el ambiente durante los primeros ticks, o sea que el mundo
 * entrega piedras heladas que se templan solas mientras la criatura las mira — un
 * transitorio que nadie pidió y que además le mueve el hash a los primeros ticks
 * de toda partida. El ambiente sale del DECRETO del chunk (`terreno.temperatura`)
 * y no de `T_AMBIENTE`: el chunk polar y el chunk cálido no están a lo mismo.
 *
 * (El banco de peces sigue con `state: {}` y no se toca acá: su masa es una
 * proyección que se reescribe cada tick, y meterle una temperatura obligaría a
 * decidir qué pasa cuando esa reescritura la pisa. Queda anotado.)
 */
export function cuerpoDeSuelta(
  id: BodyId,
  s: Suelta,
  phys: Physics,
  ambiente: number,
): Body {
  return {
    id,
    form: s.form ?? formaDeLoSuelto(s.substance, phys),
    parts: [{ substance: s.substance, mass: unfx(s.masa), q: {} }],
    joints: [],
    state: { temperature: ambiente },
  }
}

/** La celda del mundo donde el decreto puso su suelta número `i` local. */
export function celdaDeSuelta(cx: number, cy: number, i: number): Cell {
  return {
    x: cx * CELDAS_DE_LADO + (i % CELDAS_DE_LADO),
    y: cy * CELDAS_DE_LADO + Math.floor(i / CELDAS_DE_LADO),
  }
}
