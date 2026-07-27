// ─── @anima/world/step.ts ────────────────────────────────────────────────────
//
// El paso del mundo. Es el corazón del determinismo y por eso es el archivo con
// más comentarios por línea de todo el paquete: acá cualquier orden que dependa
// de un `Object.keys`, de la estabilidad de un `sort` o de un `Map` armado en
// otro orden se convierte, cuatrocientos ticks después, en dos mundos gemelos con
// distinto hash y en un juez que no sirve.
//
// El tick tiene DOS mitades y el orden entre ellas es contrato:
//
//   1. las INTENCIONES, en orden total por id de actor. Lo que la criatura
//      quiere. Cada una se juzga contra el mundo tal como está.
//   2. los SISTEMAS, en orden fijo. Lo que el mundo hace pase lo que pase: las
//      doce leyes de `@anima/physics` sobre cada cuerpo, y el metabolismo.
//
// Primero las intenciones y después las leyes, y no al revés: si las leyes
// corrieran primero, la criatura actuaría sobre un mundo que ya se movió y que
// ella no vio —su percepción se congela al principio del tick— y «saqué el
// pescado del fuego a tiempo» dependería de un tick de suerte.
//
// ─── Sobre la firma ─────────────────────────────────────────────────────────
//
// El documento de arquitectura escribe `stepWorld(state, intents): SimEvent[]`.
// Acá devuelve `{ state, events }`, y la diferencia es a propósito: `WorldState`
// es inmutable, así que devolver SOLO los eventos obligaría a que alguien
// reconstruya el estado aplicándolos, o sea a escribir una SEGUNDA implementación
// de la misma transición. Dos implementaciones de la misma cuenta divergen —el
// paquete de física ya se comió esa lección con `capacidadTermica`— y acá
// divergir significa que el journal y el mundo dejan de contar lo mismo, que es
// justo lo que el journal existe para garantizar. Los eventos son la NARRACIÓN
// del tick, no su definición.

import type {
  Body,
  Commitment,
  Part,
  Physics,
  Process,
  ProcessId,
  QualityId,
  QualityVector,
  Role,
  Substance,
  Yield,
} from '@anima/physics'
import {
  baseRoleName,
  clampToRange,
  conSustancia,
  cumpleRol,
  dtDeFrecuencia,
  isOptionalRole,
  paso,
  porPaso,
  qualityOf,
  seg,
  sumarPaso,
  T_AMBIENTE,
  unir,
} from '@anima/physics'
import type { Celda, Dt, Duracion, Entorno, Fuente, Montaje } from '@anima/physics'
import type { ActorId, BodyId, Intent, IntentKind, Placement, RoleBinding } from './intent.js'
import {
  chebyshev,
  compararTexto,
  enRango,
  ordenarIntenciones,
  revisarCompromiso,
} from './intent.js'
// La clave de celda es la de `cell.ts`, que es la única del paquete: las claves
// que este archivo pone en `WorldState.cells` son las MISMAS que indexan el
// terreno de la grilla, así que `cellFromKey` funciona sobre las dos y un mundo
// no puede terminar con dos numeraciones de sus propias celdas.
import type { CellKey } from './cell.js'
import { keyOfCell } from './cell.js'

// ─── El estado ───────────────────────────────────────────────────────────────

/**
 * Las tres cualidades de celda que se GUARDAN (`quality.ts`, `CELL_QUALITIES`).
 * `sheltered` no está porque es derivada: sale de la oclusión de lo que haya
 * puesto encima y se calcula al leerla, que es toda la decisión del ADR II-0002.
 */
export interface CellState {
  readonly wet: number
  readonly oxygen: number
  readonly temperature: number
}

/**
 * Lo que hay en una celda de la que nadie dijo nada. Es el aire libre: seco, con
 * todo el oxígeno, a temperatura ambiente. Coincide con `CELDA_AL_AIRE` de la
 * física, y coincidir importa: si el mundo tuviera otro «por omisión», las doce
 * leyes se calibrarían contra un ambiente y correrían contra otro.
 */
export const CELDA_POR_OMISION: CellState = { wet: 0, oxygen: 1, temperature: T_AMBIENTE }

/**
 * Un cuerpo EN el mundo: el cuerpo de la física más sus relaciones espaciales.
 *
 * Las relaciones viven acá y no adentro de `Body` porque son del mundo y no de la
 * materia: la misma vara, con las mismas partes y las mismas cualidades, apoyada
 * en el piso o sostenida sobre las brasas es el mismo cuerpo en dos situaciones.
 * Meterlas en `Body` obligaría a `@anima/physics` a saber que existe un mapa.
 */
export interface WorldBody {
  readonly body: Body
  readonly at: Placement
  /** En la mano de quién. Un cuerpo en la mano se mueve con su actor. */
  readonly heldBy?: ActorId
  /** Ley 8: sobre qué se apoya. La parrilla vive acá. */
  readonly supportedBy?: BodyId
  /** Ley 12 (ADR II-0002): a qué está TAPANDO. Es lo que hace el carbón. */
  readonly covering?: BodyId
}

/** Un proceso en curso. Es lo único que un actor arrastra de un tick al otro. */
export interface Activity {
  readonly process: ProcessId
  readonly roles: readonly RoleBinding[]
  /**
   * Cuántos SEGUNDOS DE MUNDO lleva, no cuántos ticks (ADR II-0008).
   * `completion.at` dice cuántos hacen falta, y también está en segundos: atar
   * tarda un segundo a 20 Hz y a 100 Hz, y lo único que cambia es en cuántas
   * muestras se parte.
   *
   * Se acumula con `sumarPaso` y no con `+= dt`, porque veinte veces 0,05 da
   * 0,9999999999999999 y atar pasaría a tardar un tick de más, siempre, sin que
   * ningún test dijera por qué.
   */
  readonly segundos: Duracion
}

export interface Actor {
  readonly id: ActorId
  /** La criatura ES un cuerpo: `SelfView extends BodyView`. Su posición es la de él. */
  readonly body: BodyId
  readonly holding: readonly BodyId[]
  /** Cuántas cosas le entran en las manos. Lo fija el cuidador, no la habilidad. */
  readonly capacity: number
  /**
   * Hasta dónde le está permitido comprometer al mundo. Una candidata que solo
   * pasó el smoke test entra con `reversible` y no puede quemar la casa que la
   * criatura construyó en la vida anterior.
   */
  readonly permits: Commitment
  readonly doing?: Activity
}

/**
 * El mundo entero como dato.
 *
 * `bodies` y `actors` son `Map`, y el orden de iteración de un `Map` de JS es el
 * de inserción: **los dos se mantienen SIEMPRE ordenados por id**, y hay un
 * invariante que lo verifica. Es la única forma de tener a la vez búsqueda O(1)
 * —el mundo mira un cuerpo por id muchas veces por tick— y un recorrido canónico
 * que no dependa de en qué orden se fueron creando las cosas. Ordenar 5000 ids en
 * cada tick costaría alrededor de un milisegundo del presupuesto de cuatro; con
 * el mapa ya ordenado, el recorrido es gratis y solo se paga al crear o destruir.
 */
export interface WorldState {
  readonly tick: number
  /**
   * La FRECUENCIA del mundo, en Hz. Gobierna el RENDIMIENTO —cuánto tiempo de CPU
   * hay por paso— y nada más: el ritmo lo gobiernan las tasas de las leyes, que
   * son por segundo (ADR II-0007 y II-0008).
   *
   * Está en el estado y no en un parámetro de `stepWorld` porque es parte de la
   * IDENTIDAD de la partida: dos mundos con la misma semilla y distinta
   * frecuencia muestrean la misma física con distinta finura y no producen la
   * misma traza. Eso es correcto y esperado, y por eso la frecuencia va en el
   * journal y cargar un guardado con otra es un error explícito.
   *
   * Solo son admisibles las que dan un `dt = 1/Hz` exacto en la escala de las
   * tasas: ver `esFrecuenciaAdmisible`. `crearMundo` las rechaza.
   */
  readonly hz: number
  readonly phys: Physics
  readonly bodies: ReadonlyMap<BodyId, WorldBody>
  readonly actors: ReadonlyMap<ActorId, Actor>
  readonly cells: ReadonlyMap<CellKey, CellState>
  /** El contador de ids. No hay azar en el mundo: los nombres también se cuentan. */
  readonly nextId: number
}

// ─── Los eventos ─────────────────────────────────────────────────────────────

export type Motivo =
  | 'actor-desconocido'
  | 'proceso-desconocido'
  | 'compromiso-mal-declarado'
  | 'sin-permiso'
  | 'orden-duplicado'
  | 'ya-actuo'
  | 'cuerpo-desconocido'
  | 'fuera-de-rango'
  | 'no-esta-a-mano'
  | 'no-lo-tiene'
  | 'no-portable'
  | 'manos-llenas'
  | 'celda-ocupada'
  | 'sin-fuerza'
  | 'rol-sin-cuerpo'
  | 'rol-no-cumple'
  | 'arreglo-incorrecto'
  | 'compuerta-cerrada'
  | 'nada-que-comer'
  | 'no-implementado'

export type SimEvent =
  | { readonly k: 'rechazada'; readonly by: ActorId; readonly seq: number; readonly que: IntentKind; readonly por: Motivo }
  | { readonly k: 'movio'; readonly by: ActorId; readonly de: Placement; readonly a: Placement }
  | { readonly k: 'tomo'; readonly by: ActorId; readonly what: BodyId }
  | { readonly k: 'solto'; readonly by: ActorId; readonly what: BodyId; readonly at: Placement }
  | { readonly k: 'puso'; readonly by: ActorId; readonly what: BodyId; readonly at: Placement }
  | { readonly k: 'comio'; readonly by: ActorId; readonly what: BodyId; readonly calorias: number }
  /**
   * Una cuenta conservada que se convirtió en otra. Es el ÚNICO permiso para que
   * un total conservado suba, y por eso es un evento y no un detalle interno: el
   * invariante de conservación lo lee y verifica que lo acreditado nunca supere
   * lo gastado. Sin este evento, comer sería indistinguible de inventar energía.
   */
  | {
      readonly k: 'convierte'
      readonly by: ActorId
      readonly de: QualityId
      readonly a: QualityId
      readonly gastado: number
      readonly acreditado: number
    }
  | { readonly k: 'proceso'; readonly by: ActorId; readonly process: ProcessId; readonly segundos: Duracion; readonly completo: boolean }
  | { readonly k: 'nacio'; readonly id: BodyId; readonly por: 'rendimiento' }
  | { readonly k: 'murio'; readonly id: BodyId; readonly por: 'comido' | 'consumido' }
  | { readonly k: 'sustancia'; readonly id: string }
  | { readonly k: 'espero'; readonly by: ActorId }

export interface StepOutcome {
  readonly state: WorldState
  readonly events: readonly SimEvent[]
}

// ─── Calibración, con nombre y con porqué ────────────────────────────────────

/**
 * Cuánta `stamina` cuesta un paso. Es la razón por la que caminar hasta el río
 * tiene precio y por la que explorar sin comer termina mal.
 */
export const COSTO_PASO = 0.05

/** Lo que cuesta estar vivo un tick, hambre incluida. El motor de la historia. */
export const COSTO_VIVIR = 0.01

/**
 * La oclusión de un cuerpo que TAPA, en función de su permeabilidad, y lo que la
 * oclusión total le corta al oxígeno de la celda.
 *
 * El 0.8 NO es un número elegido: sale de que la física ya publica
 * `CELDA_TAPADA.oxygen === 0.2` como la celda tapada de referencia. Una celda al
 * aire tiene oxígeno 1; tapada del todo con algo impermeable tiene que dar 0.2,
 * o sea `1 × (1 − 1 × 0.8)`. Y 0.2 está por debajo de `OXIGENO_QUE_HACE_CENIZA`
 * (0.35), que es lo único que separa el carbón de la ceniza. Si esto se toca, se
 * mueve la técnica emblema de toda la arquitectura.
 */
export const OCLUSION_CORTA_OXIGENO = 0.8

/**
 * Cuánto rinde una unidad de `calories` en `stamina`.
 *
 * Es 1 y no es una perilla: `calories = nutrition × mass × digestibility` y la
 * digestibilidad tiene techo 0.95, así que la conversión ya paga su ineficiencia
 * ahí adentro. Poner otro número acá sería cobrarla dos veces —o, peor, menos de
 * una vez— y el invariante de conservación lo rechazaría con razón. Que la
 * eficiencia de comer SEA la digestibilidad es lo que hace que cocinar valga la
 * pena sin que nadie escriba «cocinar rinde más».
 */
export const STAMINA_POR_CALORIA = 1

/** Qué fracción de la masa se lleva una hebra al deshilachar. */
export const FRACCION_DE_HEBRA = 0.1

/** Cuánta masa saca del stock una extracción lograda. */
export const MASA_POR_EXTRACCION = 0.5

// ─── Utilidades de estado ────────────────────────────────────────────────────

function mapaOrdenado<V>(pares: readonly (readonly [string, V])[]): Map<string, V> {
  const orden = [...pares].sort((a, b) => compararTexto(a[0], b[0]))
  const m = new Map<string, V>()
  for (const [k, v] of orden) m.set(k, v)
  return m
}

/** Un mapa de cuerpos en orden canónico de id. */
export function mapaDeCuerpos(cuerpos: readonly WorldBody[]): ReadonlyMap<BodyId, WorldBody> {
  return mapaOrdenado(cuerpos.map((c) => [c.body.id, c] as const)) as ReadonlyMap<BodyId, WorldBody>
}

/** Un mapa de actores en orden canónico de id. */
export function mapaDeActores(actores: readonly Actor[]): ReadonlyMap<ActorId, Actor> {
  return mapaOrdenado(actores.map((a) => [a.id, a] as const)) as ReadonlyMap<ActorId, Actor>
}

/**
 * El mundo mutable de UN tick.
 *
 * `stepWorld` es puro hacia afuera —no toca el `WorldState` que le dan— y por
 * dentro trabaja sobre esta copia. La alternativa, reconstruir el estado entero
 * en cada intención, cuesta una copia de 5000 entradas por cada cosa que la
 * criatura hace; y la alternativa opuesta, mutar el estado de entrada, rompe la
 * garantía que sostiene el replay. La copia se hace UNA vez, al entrar.
 */
interface Borrador {
  tick: number
  /** La frecuencia del mundo. Viaja del estado de entrada al de salida sin tocarse. */
  hz: number
  /** El paso de tiempo de este tick, en segundos. Sale de `state.hz`. */
  dt: Dt
  phys: Physics
  bodies: Map<BodyId, WorldBody>
  actors: Map<ActorId, Actor>
  cells: Map<CellKey, CellState>
  nextId: number
  /** Si cambió el juego de ids, el mapa hay que volver a ordenarlo al salir. */
  reordenar: boolean
  events: SimEvent[]
}

function abrir(s: WorldState): Borrador {
  return {
    tick: s.tick,
    hz: s.hz,
    // Acá, y no en cada ley: `dtDeFrecuencia` LANZA si la frecuencia no es
    // admisible, y el único momento honesto para enterarse es antes de que el
    // paso escriba nada.
    dt: dtDeFrecuencia(s.hz),
    phys: s.phys,
    bodies: new Map(s.bodies),
    actors: new Map(s.actors),
    cells: new Map(s.cells),
    nextId: s.nextId,
    reordenar: false,
    events: [],
  }
}

function cerrar(d: Borrador): StepOutcome {
  const bodies = d.reordenar ? mapaDeCuerpos([...d.bodies.values()]) : d.bodies
  return {
    state: {
      tick: d.tick + 1,
      hz: d.hz,
      phys: d.phys,
      bodies,
      actors: d.actors,
      cells: d.cells,
      nextId: d.nextId,
    },
    events: d.events,
  }
}

function nuevoId(d: Borrador): BodyId {
  // Con relleno a la izquierda para que el orden por id sea el de creación hasta
  // el cuerpo 10^9. Sin el relleno, `w10` iría antes que `w9` en orden de unidad
  // de código y el recorrido canónico dejaría de parecerse a la historia.
  const n = d.nextId
  d.nextId = n + 1
  return `w${String(n).padStart(9, '0')}`
}

function ponerCuerpo(d: Borrador, c: WorldBody): void {
  if (!d.bodies.has(c.body.id)) d.reordenar = true
  d.bodies.set(c.body.id, c)
}

function sacarCuerpo(d: Borrador, id: BodyId): void {
  // Sobre qué se apoyaba, LEÍDO ANTES DE BORRARLO: es lo que hereda la pila.
  const abajo = d.bodies.get(id)?.supportedBy
  if (d.bodies.delete(id)) d.reordenar = true
  olvidar(d, id, abajo)
  desenmanar(d, id)
}

/**
 * Lo saca de TODA mano, no solo de la de quien lo hizo desaparecer.
 *
 * Lo encontró el arnés de invariantes en el tick 42 de una partida de diez
 * actores peleándose por seis cosas: la criatura A come algo que la criatura B
 * tenía en la mano —`aMano` alcanza con estar en una celda vecina, y comer no
 * pregunta de quién es—, el cuerpo se borra del mundo y el `holding` de B sigue
 * nombrándolo. El resultado es un inventario que apunta a la nada: materia que
 * para el invariante se evaporó, y para la percepción de B una cosa que tiene y
 * no existe.
 *
 * Va acá y no en cada sitio que destruye un cuerpo por la misma razón que
 * `olvidar`: hay tres lugares que sacan cuerpos —comer, `join` y lo que venga— y
 * el que se olvide de limpiar no da error, deja un fantasma.
 */
function desenmanar(d: Borrador, id: BodyId): void {
  for (const a of d.actors.values()) {
    if (!a.holding.includes(id)) continue
    d.actors.set(a.id, { ...a, holding: a.holding.filter((x) => x !== id) })
  }
}

/**
 * Borra toda relación que apunte a este cuerpo, y **deja caer la pila un
 * escalón**: lo que se apoyaba en él pasa a apoyarse en lo que él se apoyaba, si
 * eso sigue en la misma celda.
 *
 * Se llama al sacarlo del mundo, al levantarlo y al mudarlo: lo que estaba
 * apoyado sobre algo que ya no está en el piso no está apoyado en nada, y lo que
 * tapaba una fogata deja de taparla en cuanto se lo llevan. Sin esto, la relación
 * queda colgada y el efecto es peor que un puntero suelto: la ley 12 seguiría
 * contando una tapa que ya no está, y la criatura haría carbón desde el otro lado
 * del mapa.
 *
 * ─── Por qué se HEREDA el apoyo y no se borra ───────────────────────────────
 *
 * Lo encontró el arnés en el tick 811: en la celda (1,−1) había una pila legal de
 * tres criaturas —hilda en el piso, cira sobre hilda, ana sobre cira— y cira se
 * fue caminando. Con el borrado a secas, ana quedaba apoyada en nada, o sea DOS
 * cosas sueltas en la misma celda: un solapamiento que ninguna intención pidió y
 * que nadie podía deshacer. Sacar un bloque del medio de una pila hace que lo de
 * arriba baje, no que quede flotando.
 *
 * La tapa NO se hereda, y la asimetría es física: apoyarse es contra lo que haya
 * abajo, y siempre hay algo. Tapar es tapar A ALGO; si ese algo se fue, la tapa
 * no tapa nada nuevo — la losa sobre la fogata no pasa a tapar la piedra que
 * había debajo de la fogata.
 */
function olvidar(d: Borrador, id: BodyId, abajo?: BodyId): void {
  for (const c of [...d.bodies.values()]) {
    if (c.supportedBy !== id && c.covering !== id) continue
    const { supportedBy: _s, covering: _c, ...resto } = c
    const heredado = c.supportedBy === id ? soporteQueHereda(d, abajo, c) : c.supportedBy
    const conApoyo =
      heredado !== undefined && heredado !== id ? { ...resto, supportedBy: heredado } : resto
    const limpio = c.covering !== undefined && c.covering !== id
      ? { ...conApoyo, covering: c.covering }
      : conApoyo
    d.bodies.set(c.body.id, limpio)
  }
}

/**
 * Sobre qué queda apoyado el huérfano. `undefined` es una respuesta legítima: se
 * apoya en el piso, que no es un cuerpo.
 *
 * Las tres condiciones son las tres formas de mentir con una herencia: que lo
 * heredado ya no exista, que esté en otra celda —apoyarse en algo que está a tres
 * pasos es la misma mentira que el `supportedBy` viejo que esto vino a arreglar—,
 * o que sea el propio huérfano, que sería un cuerpo apoyado en sí mismo.
 */
function soporteQueHereda(d: Borrador, abajo: BodyId | undefined, c: WorldBody): BodyId | undefined {
  if (abajo === undefined || abajo === c.body.id) return undefined
  const base = d.bodies.get(abajo)
  if (base === undefined || base.heldBy !== undefined) return undefined
  return base.at.x === c.at.x && base.at.y === c.at.y ? abajo : undefined
}

// ─── La celda, con la ley 12 adentro ─────────────────────────────────────────

/**
 * La ley 12, `oclusion` (ADR II-0002), y vive acá y no en `@anima/physics` por
 * una razón estructural: es la única de las doce que **no habla de un cuerpo sino
 * de una celda**, y una celda es un concepto del mundo. `@anima/physics` no sabe
 * que hay un mapa; le entregamos la `Celda` ya ocluida y sus leyes 1, 3, 4 y 11
 * la leen sin enterarse de nada.
 *
 * `sheltered = 1 − Π permeabilidad(tapas)`. Es una ley general y no una tabla por
 * situación: tapar con una hoja (permeable) y tapar con una losa (impermeable) no
 * dan lo mismo, dos tapas multiplican, y una tapa perfectamente permeable no tapa
 * nada. Eso es lo que le da función a la malla y al tejido, que hoy son formas sin
 * consecuencia, y es lo que hace que la criatura tenga algo que descubrir.
 */
interface ConCuerpos {
  readonly bodies: ReadonlyMap<BodyId, WorldBody>
  readonly phys: Physics
}

/**
 * La oclusión de TODAS las celdas tapadas, en una sola pasada.
 *
 * Se calcula una vez por tick y no una vez por cuerpo, y la diferencia no es de
 * estilo: preguntar «¿cuánto tapa esta celda?» recorriendo los cuerpos cuesta
 * O(n) y hay que preguntarlo por cada cuerpo, o sea O(n²) — con 5000 cuerpos son
 * veinticinco millones de comparaciones por tick, y el presupuesto entero del
 * criterio del Hito 2 son cuatro milisegundos. El mapa solo tiene entradas para
 * las celdas donde alguien puso algo encima, que en cualquier mundo real son un
 * puñado.
 */
function oclusiones(d: ConCuerpos): ReadonlyMap<CellKey, number> {
  const productos = new Map<CellKey, number>()
  for (const c of d.bodies.values()) {
    if (c.covering === undefined) continue
    const k = keyOfCell(c.at)
    const p = qualityOf(c.body, 'permeability', d.phys)
    const limpio = p < 0 ? 0 : p > 1 ? 1 : p
    productos.set(k, (productos.get(k) ?? 1) * limpio)
  }
  const out = new Map<CellKey, number>()
  for (const [k, prod] of productos) {
    const s = 1 - prod
    out.set(k, s < 0 ? 0 : s > 1 ? 1 : s)
  }
  return out
}

/** Cuánto tapa UNA celda. Es la consulta suelta; el tick usa `oclusiones`. */
export function shelteredDe(d: ConCuerpos, celda: CellKey): number {
  return oclusiones(d).get(celda) ?? 0
}

/**
 * La `Celda` que ven las leyes, con la oclusión ya aplicada. Las tres
 * consecuencias del ADR II-0002 salen de la MISMA cuenta, que es el punto:
 *
 *   - baja el `oxygen` → la ley 3 arde peor y la ley 4 da carbonoso: **carbón**;
 *   - acerca el `ambiente` de la ley 1 a lo que la celda ya tiene: **reparo**;
 *   - baja el `wet` que la ley 11 le pasa a lo que esté ahí: **techo**.
 *
 * Queda un hueco y conviene decirlo: el «reparo» correcto sería bajar el
 * ACOPLAMIENTO térmico con el ambiente, y `H_PERDIDA` no es alcanzable desde
 * `Entorno` —la única perilla que la física expone es la temperatura objetivo—.
 * Mover el objetivo da el mismo signo y no la misma curva.
 */
/**
 * La celda y el entorno de una celda de la que nadie dijo nada, compartidos.
 *
 * Son de solo lectura y las leyes no los mutan, así que reusarlos es sano. Y hace
 * falta: sin esto, un mundo de 5000 cuerpos al aire libre asigna dos objetos por
 * cuerpo y por tick, o sea 300 000 objetos por segundo a 30 Hz — todos iguales,
 * todos basura. Medido, esa sola asignación era la mitad del costo que el mundo
 * le agrega a la física.
 */
const CELDA_LIBRE: Celda = {
  oxygen: CELDA_POR_OMISION.oxygen,
  wet: CELDA_POR_OMISION.wet,
  ambiente: CELDA_POR_OMISION.temperature,
}
const ENTORNO_LIBRE: Entorno = { celda: CELDA_LIBRE }

function celdaDe(d: Borrador, at: Placement, ocl: ReadonlyMap<CellKey, number>): Celda {
  const k = keyOfCell(at)
  const propia = d.cells.get(k)
  const s = ocl.get(k) ?? 0
  if (propia === undefined && s === 0) return CELDA_LIBRE
  const base = propia ?? CELDA_POR_OMISION
  if (s === 0) return { oxygen: base.oxygen, wet: base.wet, ambiente: base.temperature }
  return {
    oxygen: base.oxygen * (1 - s * OCLUSION_CORTA_OXIGENO),
    wet: base.wet * (1 - s),
    ambiente: T_AMBIENTE + s * (base.temperature - T_AMBIENTE),
  }
}

// ─── Las fuentes de calor ────────────────────────────────────────────────────

/**
 * El punto de ignición más bajo de todo el catálogo, memorizado por `Physics`.
 *
 * Sirve para una criba SANA antes de preguntar `emitsPower`, que es una cualidad
 * derivada y cuesta: medida sobre 5000 cuerpos, preguntarla a todos son 3,15 ms
 * de un presupuesto de tick de 4. Y la criba es sana porque `emitsPower` lleva un
 * `step(temperature ≥ ignitionPoint)` adentro: ningún cuerpo cuya temperatura sea
 * menor que el mínimo del catálogo puede estar emitiendo. No se saltea ninguna
 * fogata; se saltea preguntar por 4980 piedras frías.
 */
const MENOR_IGNICION = new WeakMap<Physics, number>()

function menorIgnicion(phys: Physics): number {
  const memo = MENOR_IGNICION.get(phys)
  if (memo !== undefined) return memo
  let min = Number.POSITIVE_INFINITY
  for (const s of phys.substances.values()) {
    const v = s.perUnitMass.ignitionPoint
    if (v !== undefined && v < min) min = v
  }
  const r = min === Number.POSITIVE_INFINITY ? 0 : min
  MENOR_IGNICION.set(phys, r)
  return r
}

/**
 * Cota SUPERIOR de la temperatura del cuerpo, leída sin agregar nada.
 *
 * `qualityOf` para una intensiva devuelve el valor guardado si está, y si no el
 * promedio pesado por masa de las partes — y un promedio nunca supera al máximo.
 * Ninguna de las treinta sustancias semilla declara `temperature` en su
 * `perUnitMass` (la temperatura es estado, no materia), así que el máximo entre
 * lo que escribió el cuerpo y lo que escribieron sus partes acota de verdad.
 */
function temperaturaTecho(b: Body): number {
  let max = b.state.temperature ?? 0
  for (const p of b.parts) {
    const t = p.q.temperature
    if (t !== undefined && t > max) max = t
  }
  return max
}

interface FuenteEnMundo {
  readonly at: Placement
  readonly id: BodyId
  readonly potencia: number
}

function fuentes(d: Borrador): readonly FuenteEnMundo[] {
  const piso = menorIgnicion(d.phys)
  const out: FuenteEnMundo[] = []
  for (const c of d.bodies.values()) {
    if (temperaturaTecho(c.body) < piso) continue
    const p = qualityOf(c.body, 'emitsPower', d.phys)
    if (p > 0) out.push({ at: c.at, id: c.body.id, potencia: p })
  }
  return out
}

/**
 * Cómo mira este cuerpo a esa fuente. Los tres montajes de la física salen de la
 * geometría que el mundo ya tiene, y de ninguna tabla:
 *
 *   - `contacto` — está apoyado sobre la fuente misma, o tapándola;
 *   - `parrilla` — está apoyado sobre algo que está en la celda de la fuente;
 *   - `piso`     — todo lo demás.
 *
 * Que la parrilla salga de «apoyado sobre algo que está sobre el fuego» y no de
 * un campo `esParrilla` es lo que permite que cualquier cosa sirva de parrilla.
 */
function montajeDe(d: Borrador, c: WorldBody, f: FuenteEnMundo): Montaje {
  if (c.supportedBy === f.id || c.covering === f.id) return 'contacto'
  if (c.supportedBy !== undefined) {
    const sobre = d.bodies.get(c.supportedBy)
    if (sobre !== undefined && keyOfCell(sobre.at) === keyOfCell(f.at)) return 'parrilla'
  }
  return 'piso'
}

/**
 * El entorno de un cuerpo: su celda ocluida más la fuente que más lo calienta.
 *
 * UNA fuente y no la suma de todas, porque `Entorno` de la física acepta una
 * sola. Se elige la de mayor potencia y, a igualdad, la de id menor: con dos
 * fogatas idénticas a la misma distancia, quedarse con «la primera que apareció
 * en el mapa» haría que el resultado dependiera del orden de creación.
 */
function entornoDe(
  d: Borrador,
  c: WorldBody,
  fs: readonly FuenteEnMundo[],
  ocl: ReadonlyMap<CellKey, number>,
): Entorno {
  const celda = celdaDe(d, c.at, ocl)
  if (fs.length === 0) return celda === CELDA_LIBRE ? ENTORNO_LIBRE : { celda }
  let mejor: Fuente | undefined
  let mejorId = ''
  for (const f of fs) {
    if (f.id === c.body.id) continue
    const dist = chebyshev(c.at, f.at)
    const cand: Fuente = { potencia: f.potencia, distancia: dist, montaje: montajeDe(d, c, f) }
    if (mejor === undefined || cand.potencia > mejor.potencia) {
      mejor = cand
      mejorId = f.id
    } else if (cand.potencia === mejor.potencia && compararTexto(f.id, mejorId) < 0) {
      mejor = cand
      mejorId = f.id
    }
  }
  return mejor === undefined ? { celda } : { celda, fuente: mejor }
}

// ─── Lectura y escritura de cualidades sobre un cuerpo del mundo ─────────────

function conCualidad(b: Body, q: QualityId, v: number): Body {
  const state: QualityVector = { ...b.state }
  state[q] = clampToRange(q, v)
  return { ...b, state }
}

/** Escala la masa de todas las partes. La masa vive en las partes y en ningún otro lado. */
function escalarMasa(b: Body, factor: number): Body {
  const f = factor > 0 ? factor : 0
  const parts: Part[] = b.parts.map((p) => {
    const q: QualityVector = { ...p.q }
    if (q.mass !== undefined) q.mass = q.mass * f
    return { substance: p.substance, mass: p.mass * f, q }
  })
  const state: QualityVector = { ...b.state }
  if (state.mass !== undefined) state.mass = state.mass * f
  return { ...b, parts, state }
}

function masaDe(b: Body, phys: Physics): number {
  return qualityOf(b, 'mass', phys)
}

// ─── Las intenciones ─────────────────────────────────────────────────────────

function rechazo(d: Borrador, i: Intent, por: Motivo): void {
  d.events.push({ k: 'rechazada', by: i.by, seq: i.seq, que: i.k, por })
}

/** El cuerpo de un actor, o `undefined` si el mundo lo perdió. */
function cuerpoDe(d: Borrador, a: Actor): WorldBody | undefined {
  return d.bodies.get(a.body)
}

/** ¿Está al alcance de la mano? Misma celda o adyacente. */
function aMano(d: Borrador, a: Actor, c: WorldBody): boolean {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) return false
  if (c.heldBy === a.id) return true
  return chebyshev(mio.at, c.at) <= 1
}

/**
 * ¿Puede este cuerpo entrar a esa celda sin solaparse con otro sólido?
 *
 * Dos sólidos no ocupan la misma celda, salvo que uno esté apoyado o tapando al
 * otro. Es la mitad de la ley 8 que el mundo puede sostener: apilar es una
 * relación explícita, no un accidente de coordenadas. Y por eso la criatura puede
 * caminar sobre algo que tenga `footing`, que sale de rigidez y cohesión y no de
 * ninguna lista de superficies caminables.
 */
function estorbo(d: Borrador, at: Placement, quien: BodyId, phys: Physics): WorldBody | undefined {
  const k = keyOfCell(at)
  for (const c of d.bodies.values()) {
    if (c.body.id === quien) continue
    if (c.heldBy !== undefined) continue
    if (keyOfCell(c.at) !== k) continue
    if (c.supportedBy === quien || c.covering === quien) continue
    if (qualityOf(c.body, 'solid', phys) <= 0) continue
    return c
  }
  return undefined
}

/**
 * La primera celda libre a partir de una, en un orden fijo: la propia y después
 * los ocho rumbos.
 *
 * Existe porque soltar algo a los pies no es «ponerlo donde estoy»: donde estoy
 * estoy yo, y dos sólidos no comparten celda. Sin esto, soltar cualquier cosa
 * dejaba al cuerpo de la criatura solapado con lo que soltó — y lo encontró el
 * arnés de invariantes en el tick 116 de una partida al azar, que es exactamente
 * para lo que el arnés existe.
 *
 * El orden de los rumbos es fijo y no depende de nada del mundo: dos partidas
 * gemelas sueltan en la misma celda.
 */
function celdaLibreCerca(d: Borrador, desde: Placement, quien: BodyId): Placement | undefined {
  if (enRango(desde) && estorbo(d, desde, quien, d.phys) === undefined) return desde
  for (const r of OCHO_RUMBOS) {
    const c = { x: desde.x + r.x, y: desde.y + r.y }
    if (!enRango(c)) continue
    if (estorbo(d, c, quien, d.phys) === undefined) return c
  }
  return undefined
}

function moverActor(d: Borrador, a: Actor, destino: Placement): void {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) return
  // MUDARSE SUELTA LAS RELACIONES ESPACIALES, en las dos direcciones: no se
  // apoya en lo que dejó atrás, y lo que se apoyaba en ella deja de tener sobre
  // qué. Llevarlas puestas produce dos daños, y el arnés encontró los dos:
  //
  //   - un `supportedBy` viejo que `montajeDe` lee como `contacto`, o sea que la
  //     criatura cocinaría sobre una fogata desde el otro lado del mapa;
  //   - un CICLO: A pisa a B y después B pisa a A, y las dos quedan apoyadas una
  //     en la otra. `revisarReferencias` recorre esa cadena con una cota, y la
  //     cota existe justamente porque sin ella el tick no termina.
  //
  // Es lo mismo que hace `intencionTomar` al levantar algo, mirado desde el que
  // se va en vez de desde el que se lo llevan.
  const { supportedBy: _apoyo, covering: _tapa, ...suelto } = mio
  ponerCuerpo(d, { ...suelto, at: destino })
  olvidar(d, mio.body.id, mio.supportedBy)
  // Lo que lleva en la mano viaja con ella. Si no, la criatura camina y la caña
  // se queda donde estaba, que es el bug que se descubre pescando en seco.
  for (const id of a.holding) {
    const c = d.bodies.get(id)
    if (c !== undefined) ponerCuerpo(d, { ...c, at: destino })
  }
}

function cobrarStamina(d: Borrador, a: Actor, cuanto: number): boolean {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) return false
  const tiene = qualityOf(mio.body, 'stamina', d.phys)
  if (tiene < cuanto) return false
  ponerCuerpo(d, { ...mio, body: conCualidad(mio.body, 'stamina', tiene - cuanto) })
  return true
}

function intencionCaminar(d: Borrador, a: Actor, i: Intent & { k: 'goTo' }): void {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  if (!enRango(i.to)) {
    rechazo(d, i, 'fuera-de-rango')
    return
  }
  if (chebyshev(mio.at, i.to) <= i.within) {
    d.events.push({ k: 'espero', by: a.id })
    return
  }
  const destino = unPasoHacia(mio.at, i.to)
  const choque = estorbo(d, destino, mio.body.id, d.phys)
  // Se puede pisar lo que sostiene el peso: `footing` sale de rigidez y cohesión.
  if (choque !== undefined && qualityOf(choque.body, 'footing', d.phys) <= 0) {
    rechazo(d, i, 'celda-ocupada')
    return
  }
  if (!cobrarStamina(d, a, COSTO_PASO)) {
    rechazo(d, i, 'sin-fuerza')
    return
  }
  moverActor(d, a, destino)
  if (choque !== undefined) {
    const ahora = d.bodies.get(mio.body.id)
    if (ahora !== undefined) ponerCuerpo(d, { ...ahora, supportedBy: choque.body.id })
  }
  d.events.push({ k: 'movio', by: a.id, de: mio.at, a: destino })
}

/**
 * Un paso hacia el destino. Los dos ejes se mueven a la vez cuando conviene, que
 * es lo que hace que la distancia de Chebyshev sea la distancia de verdad: la
 * diagonal cuesta un paso, como caminar.
 */
export function unPasoHacia(desde: Placement, hasta: Placement): Placement {
  const sx = hasta.x > desde.x ? 1 : hasta.x < desde.x ? -1 : 0
  const sy = hasta.y > desde.y ? 1 : hasta.y < desde.y ? -1 : 0
  return { x: desde.x + sx, y: desde.y + sy }
}

/**
 * Explorar: un paso en una dirección que depende del tick y del id, y de nada
 * más. No hay azar en el mundo, así que «vagar» es una función del reloj.
 *
 * Es deliberadamente pobre y está anotado como tal: la exploración con memoria y
 * con frontera es del Hito 3, cuando exista el dios perezoso que decide qué hay
 * en el chunk de al lado. Lo que acá importa es que consuma el tick, cueste
 * `stamina` y sea reproducible bit a bit.
 */
const OCHO_RUMBOS: readonly Placement[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
]

function huellaDeTexto(s: string): number {
  // FNV-1a de 32 bits, entero puro. No es criptografía: es una forma barata y
  // determinista de que dos actores no exploren siempre en el mismo rumbo.
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

function intencionExplorar(d: Borrador, a: Actor, i: Intent & { k: 'explore' }): void {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  if (i.maxTicks <= 0) {
    d.events.push({ k: 'espero', by: a.id })
    return
  }
  const r = OCHO_RUMBOS[(d.tick + huellaDeTexto(a.id)) % OCHO_RUMBOS.length]!
  const destino = { x: mio.at.x + r.x, y: mio.at.y + r.y }
  if (!enRango(destino)) {
    rechazo(d, i, 'fuera-de-rango')
    return
  }
  if (estorbo(d, destino, mio.body.id, d.phys) !== undefined) {
    rechazo(d, i, 'celda-ocupada')
    return
  }
  if (!cobrarStamina(d, a, COSTO_PASO)) {
    rechazo(d, i, 'sin-fuerza')
    return
  }
  moverActor(d, a, destino)
  d.events.push({ k: 'movio', by: a.id, de: mio.at, a: destino })
}

function intencionTomar(d: Borrador, a: Actor, i: Intent & { k: 'take' }): void {
  const c = d.bodies.get(i.what)
  if (c === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  if (c.heldBy !== undefined) {
    rechazo(d, i, c.heldBy === a.id ? 'no-lo-tiene' : 'no-esta-a-mano')
    return
  }
  if (!aMano(d, a, c)) {
    rechazo(d, i, 'no-esta-a-mano')
    return
  }
  if (qualityOf(c.body, 'portable', d.phys) <= 0) {
    rechazo(d, i, 'no-portable')
    return
  }
  if (a.holding.length >= a.capacity) {
    rechazo(d, i, 'manos-llenas')
    return
  }
  const mio = cuerpoDe(d, a)
  // Al levantar algo se sueltan sus relaciones espaciales: lo que estaba apoyado
  // sobre otra cosa deja de estarlo, y lo que tapaba deja de tapar. Arrastrar la
  // relación en la mano haría que la criatura tape una fogata desde el otro lado
  // del mapa.
  const suelto: WorldBody = {
    body: c.body,
    at: mio?.at ?? c.at,
    heldBy: a.id,
  }
  ponerCuerpo(d, suelto)
  olvidar(d, c.body.id, c.supportedBy)
  d.actors.set(a.id, { ...a, holding: [...a.holding, c.body.id] })
  d.events.push({ k: 'tomo', by: a.id, what: c.body.id })
}

function soltar(d: Borrador, a: Actor, id: BodyId, at: Placement, o?: { onTopOf?: BodyId; covering?: BodyId }): void {
  const c = d.bodies.get(id)
  if (c === undefined) return
  const base = { body: c.body, at }
  const conApoyo = o?.onTopOf !== undefined ? { ...base, supportedBy: o.onTopOf } : base
  const puesto = o?.covering !== undefined ? { ...conApoyo, covering: o.covering } : conApoyo
  ponerCuerpo(d, puesto)
  d.actors.set(a.id, { ...a, holding: a.holding.filter((x) => x !== id) })
}

function intencionSoltar(d: Borrador, a: Actor, i: Intent & { k: 'drop' }): void {
  if (!a.holding.includes(i.what)) {
    rechazo(d, i, 'no-lo-tiene')
    return
  }
  const mio = cuerpoDe(d, a)
  if (mio === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  // A los pies, no encima: la celda donde está la criatura la ocupa ella.
  const donde = celdaLibreCerca(d, mio.at, i.what)
  if (donde === undefined) {
    rechazo(d, i, 'celda-ocupada')
    return
  }
  soltar(d, a, i.what, donde)
  d.events.push({ k: 'solto', by: a.id, what: i.what, at: donde })
}

function intencionPoner(d: Borrador, a: Actor, i: Intent & { k: 'put' }): void {
  if (!a.holding.includes(i.what)) {
    rechazo(d, i, 'no-lo-tiene')
    return
  }
  const mio = cuerpoDe(d, a)
  if (mio === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  if (!enRango(i.at) || chebyshev(mio.at, i.at) > 1) {
    rechazo(d, i, 'fuera-de-rango')
    return
  }
  // `onTopOf` y `covering` tienen que existir y estar donde se dice, o el mundo
  // guardaría una relación colgada: un cuerpo apoyado sobre nada.
  for (const ref of [i.onTopOf, i.covering]) {
    if (ref === undefined) continue
    const r = d.bodies.get(ref)
    if (r === undefined || keyOfCell(r.at) !== keyOfCell(i.at)) {
      rechazo(d, i, 'cuerpo-desconocido')
      return
    }
  }
  // Apoyar o tapar es la ÚNICA forma de compartir celda con un sólido. Sin
  // ninguna de las dos, la celda tiene que estar libre.
  if (i.onTopOf === undefined && i.covering === undefined) {
    if (estorbo(d, i.at, i.what, d.phys) !== undefined) {
      rechazo(d, i, 'celda-ocupada')
      return
    }
  }
  const o: { onTopOf?: BodyId; covering?: BodyId } = {}
  if (i.onTopOf !== undefined) o.onTopOf = i.onTopOf
  if (i.covering !== undefined) o.covering = i.covering
  soltar(d, a, i.what, i.at, o)
  d.events.push({ k: 'puso', by: a.id, what: i.what, at: i.at })
}

/**
 * Comer. Es la conversión: `nutrition · mass` deja de existir como comida y
 * aparece como `stamina` de quien comió, y lo que se pierde en el camino es
 * exactamente `1 − digestibility`.
 *
 * Es la única operación del mundo que hace SUBIR una cuenta conservada, y por eso
 * emite un evento `convierte` que el invariante audita. Todo lo demás baja.
 */
function intencionComer(d: Borrador, a: Actor, i: Intent & { k: 'eat' }): void {
  const c = d.bodies.get(i.what)
  if (c === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  if (!aMano(d, a, c)) {
    rechazo(d, i, 'no-esta-a-mano')
    return
  }
  const mio = cuerpoDe(d, a)
  if (mio === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  const nutricion = qualityOf(c.body, 'nutrition', d.phys)
  const masa = masaDe(c.body, d.phys)
  const gastado = nutricion * masa
  const calorias = qualityOf(c.body, 'calories', d.phys)
  if (gastado <= 0 || calorias <= 0) {
    rechazo(d, i, 'nada-que-comer')
    return
  }
  const acreditado = calorias * STAMINA_POR_CALORIA
  const stamina = qualityOf(mio.body, 'stamina', d.phys)
  ponerCuerpo(d, { ...mio, body: conCualidad(mio.body, 'stamina', stamina + acreditado) })
  // `sacarCuerpo` lo saca de todas las manos, incluida la de quien come y la de
  // cualquier otro que lo tuviera. Antes acá se filtraba solo `a.holding`, y por
  // eso comerle algo de la mano a otro le dejaba el inventario roto.
  sacarCuerpo(d, c.body.id)
  d.events.push({ k: 'comio', by: a.id, what: c.body.id, calorias })
  d.events.push({
    k: 'convierte',
    by: a.id,
    de: 'nutrition',
    a: 'stamina',
    gastado,
    acreditado,
  })
  d.events.push({ k: 'murio', id: c.body.id, por: 'comido' })
}

// ─── `apply`: los cuatro procesos ────────────────────────────────────────────

interface Ligadura {
  readonly role: Role
  readonly cuerpo: WorldBody | undefined
}

/** Ata cada rol declarado con el cuerpo que le mandaron. Los `?` pueden faltar. */
function ligar(d: Borrador, p: Process, roles: readonly RoleBinding[]): Ligadura[] | Motivo {
  const out: Ligadura[] = []
  for (const role of p.roles) {
    const base = baseRoleName(role.name)
    const lig = roles.find((r) => r.name === base || r.name === role.name)
    if (lig === undefined) {
      if (isOptionalRole(role.name)) {
        out.push({ role, cuerpo: undefined })
        continue
      }
      return 'rol-sin-cuerpo'
    }
    const c = d.bodies.get(lig.body)
    if (c === undefined) return 'cuerpo-desconocido'
    out.push({ role, cuerpo: c })
  }
  return out
}

/**
 * `arrangement`: dónde tienen que estar los cuerpos para que el proceso corra.
 *
 * No es decoración. Es lo que hace que frotar dos palos exija tenerlos en la mano
 * y que pescar exija estar al lado del agua, sin que ninguna habilidad tenga que
 * acordarse de comprobarlo: el mundo no negocia.
 */
function arregloOk(d: Borrador, a: Actor, p: Process, ligs: readonly Ligadura[]): boolean {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) return false
  const cuerpos = ligs.map((l) => l.cuerpo).filter((c): c is WorldBody => c !== undefined)
  switch (p.arrangement.k) {
    case 'held':
      // El cuerpo de la propia criatura cuenta como «en la mano»: es ella.
      return cuerpos.every((c) => c.heldBy === a.id || c.body.id === mio.body.id)
    case 'within': {
      const r = p.arrangement.radius
      return cuerpos.every((c) => chebyshev(mio.at, c.at) <= r)
    }
    case 'contact': {
      const k = keyOfCell(cuerpos[0]?.at ?? mio.at)
      return cuerpos.every((c) => keyOfCell(c.at) === k)
    }
    case 'supported':
      return cuerpos.every((c) => c.supportedBy !== undefined || c.heldBy === a.id)
    case 'inside':
      return cuerpos.every((c) => c.covering !== undefined || c.heldBy === a.id)
  }
}

/**
 * La compuerta del proceso, evaluada contra el cuerpo del PRIMER rol declarado.
 *
 * HUECO ANOTADO: el contrato de `Process` no dice sobre qué se evalúa `gate`.
 * Ninguno de los cuatro procesos semilla la usa, así que hoy no cambia nada, pero
 * el día que el modelo escriba uno con compuerta esta lectura hay que confirmarla
 * o cambiarla — y está acá, en un solo lugar, para que se pueda.
 */
function compuertaOk(d: Borrador, p: Process, ligs: readonly Ligadura[]): boolean {
  if (p.gate.length === 0) return true
  const primero = ligs[0]?.cuerpo
  if (primero === undefined) return false
  for (const t of p.gate) {
    const v = qualityOf(primero.body, t.q, d.phys)
    const ok =
      t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
    if (!ok) return false
  }
  return true
}

function mismosRoles(a: readonly RoleBinding[], b: readonly RoleBinding[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (x.name !== y.name || x.body !== y.body) return false
  }
  return true
}

function intencionAplicar(d: Borrador, a: Actor, i: Intent & { k: 'apply' }): void {
  const p = d.phys.processes.get(i.process)
  if (p === undefined) {
    rechazo(d, i, 'proceso-desconocido')
    return
  }
  const ligs = ligar(d, p, i.roles)
  if (!Array.isArray(ligs)) {
    rechazo(d, i, ligs)
    return
  }
  for (const l of ligs) {
    if (l.cuerpo === undefined) continue
    if (!cumpleRol(l.cuerpo.body, l.role, d.phys)) {
      rechazo(d, i, 'rol-no-cumple')
      return
    }
  }
  if (!arregloOk(d, a, p, ligs)) {
    rechazo(d, i, 'arreglo-incorrecto')
    return
  }
  if (!compuertaOk(d, p, ligs)) {
    rechazo(d, i, 'compuerta-cerrada')
    return
  }

  // La actividad continúa si es LA MISMA: mismo proceso y mismos cuerpos en los
  // mismos roles. Cambiar de palo a mitad de frotar empieza de cero, y así tiene
  // que ser: el calor acumulado está en el palo, no en la voluntad.
  const sigue =
    a.doing !== undefined && a.doing.process === i.process && mismosRoles(a.doing.roles, i.roles)
  const segundos = sumarPaso(sigue && a.doing !== undefined ? a.doing.segundos : seg(0), d.dt)

  aplicarEfectos(d, p, ligs)

  const at = p.completion?.at
  const completo = at !== undefined && segundos >= at
  if (completo) {
    for (const y of p.completion?.yields ?? []) rendir(d, a, y, ligs)
    d.actors.set(a.id, quitarActividad(d.actors.get(a.id) ?? a))
  } else {
    const actual = d.actors.get(a.id) ?? a
    d.actors.set(a.id, { ...actual, doing: { process: i.process, roles: i.roles, segundos } })
  }
  d.events.push({ k: 'proceso', by: a.id, process: i.process, segundos, completo })
}

function quitarActividad(a: Actor): Actor {
  const { doing: _descartado, ...resto } = a
  return resto
}

function cuerpoDeRol(ligs: readonly Ligadura[], nombre: string): WorldBody | undefined {
  for (const l of ligs) if (baseRoleName(l.role.name) === baseRoleName(nombre)) return l.cuerpo
  return undefined
}

/**
 * Los cuatro efectos, en UN PASO.
 *
 * Las tasas del proceso son POR SEGUNDO (ADR II-0008) y `porPaso` las lleva al
 * paso. A la frecuencia de referencia da exactamente lo que daba la tasa por
 * tick de antes: `friccion` empuja 120 grados por segundo, o sea 6 por paso a
 * 20 Hz, que es el número con el que se calibró.
 *
 *
 * `drive` con `poweredBy` es la única forma de que algo suba sin que sea gratis, y
 * la cuenta está escrita para que no pueda ser una máquina de movimiento
 * perpetuo: la energía que hace falta para subir `ΔT` grados es
 * `heatCapacity × ΔT` —la misma `heatCapacity` que divide la ley 1— y lo que se
 * cobra es esa energía DIVIDIDA por la eficiencia. Con eficiencia 0.35 entra
 * casi el triple del trabajo que sale de calor. Y si no hay con qué pagar, sube
 * lo que se pueda pagar y nada más: ésa es la distancia entre querer y poder.
 */
function aplicarEfectos(d: Borrador, p: Process, ligs: readonly Ligadura[]): void {
  for (const e of p.effects) {
    switch (e.k) {
      case 'drain': {
        const c = cuerpoDeRol(ligs, e.on)
        if (c === undefined) break
        const actual = d.bodies.get(c.body.id)
        if (actual === undefined) break
        const v = qualityOf(actual.body, e.q, d.phys)
        ponerCuerpo(d, {
          ...actual,
          body: conCualidad(actual.body, e.q, v - porPaso(e.porSegundo, d.dt)),
        })
        break
      }
      case 'drive': {
        const c = cuerpoDeRol(ligs, e.on)
        if (c === undefined) break
        const actual = d.bodies.get(c.body.id)
        if (actual === undefined) break
        const v = qualityOf(actual.body, e.q, d.phys)
        const rumbo = e.toward > v ? 1 : -1
        const falta = rumbo > 0 ? e.toward - v : v - e.toward
        const empuje = porPaso(e.porSegundo, d.dt)
        let delta = falta < empuje ? falta : empuje
        if (delta <= 0) break
        if (e.poweredBy !== undefined) {
          const fuente = cuerpoDeRol(ligs, e.poweredBy.from)
          if (fuente === undefined) break
          const actualF = d.bodies.get(fuente.body.id)
          if (actualF === undefined) break
          const cap = qualityOf(actual.body, 'heatCapacity', d.phys)
          const efic = e.poweredBy.efficiency > 0 ? e.poweredBy.efficiency : 1
          const pedido = (cap > 0 ? cap : 1) * delta / efic
          const hay = qualityOf(actualF.body, e.poweredBy.q, d.phys)
          if (hay <= 0) break
          const pagado = hay < pedido ? hay : pedido
          delta = (pagado * efic) / (cap > 0 ? cap : 1)
          ponerCuerpo(d, {
            ...actualF,
            body: conCualidad(actualF.body, e.poweredBy.q, hay - pagado),
          })
        }
        const despues = d.bodies.get(actual.body.id) ?? actual
        ponerCuerpo(d, { ...despues, body: conCualidad(despues.body, e.q, v + rumbo * delta) })
        break
      }
      case 'transfer': {
        const de = cuerpoDeRol(ligs, e.from)
        const a = cuerpoDeRol(ligs, e.to)
        if (de === undefined || a === undefined) break
        const cd = d.bodies.get(de.body.id)
        const ca = d.bodies.get(a.body.id)
        if (cd === undefined || ca === undefined) break
        const hay = qualityOf(cd.body, e.q, d.phys)
        const mover = porPaso(e.porSegundo, d.dt)
        const mueve = hay < mover ? hay : mover
        if (mueve <= 0) break
        ponerCuerpo(d, { ...cd, body: conCualidad(cd.body, e.q, hay - mueve) })
        const cb = d.bodies.get(ca.body.id) ?? ca
        ponerCuerpo(d, {
          ...cb,
          body: conCualidad(cb.body, e.q, qualityOf(cb.body, e.q, d.phys) + mueve),
        })
        break
      }
      case 'couple': {
        const c = cuerpoDeRol(ligs, e.on)
        const seguido = cuerpoDeRol(ligs, e.follows.of)
        if (c === undefined || seguido === undefined) break
        const actual = d.bodies.get(c.body.id)
        if (actual === undefined) break
        const v = qualityOf(seguido.body, e.follows.q, d.phys)
        // El acople inverso es el ESPEJO dentro del rango declarado, no `-v`:
        // una cualidad con rango [0,1] no tiene valores negativos que espejar.
        ponerCuerpo(d, { ...actual, body: conCualidad(actual.body, e.q, e.follows.inverse === true ? espejo(e.follows.q, v) : v) })
        break
      }
    }
  }
}

function espejo(q: QualityId, v: number): number {
  // `clampToRange` ya conoce el rango; se lo pide dos veces y se arma el espejo
  // con los extremos que él mismo devuelve para los infinitos.
  const lo = clampToRange(q, Number.NEGATIVE_INFINITY)
  const hi = clampToRange(q, Number.POSITIVE_INFINITY)
  return lo + hi - v
}

/**
 * Dónde puede caer algo que acaba de nacer: en la mano, o en una celda libre.
 *
 * `undefined` significa «no hay dónde», y es una respuesta legítima: la mano
 * llena y el suelo ocupado son un mundo que no tiene lugar para una cosa más.
 * Devolver la celda del actor igual sería inventar una celda con dos sólidos, que
 * es la mitad de una bomba de materia — el cuerpo queda ahí, invisible para
 * cualquier cosa que recorra el suelo.
 */
function destinoDeUnNacido(
  d: Borrador,
  a: Actor,
  cerca: Placement,
): { readonly mano: true } | { readonly mano: false; readonly at: Placement } | undefined {
  const actual = d.actors.get(a.id) ?? a
  if (actual.holding.length < actual.capacity) return { mano: true }
  const libre = celdaLibreCerca(d, cerca, '')
  return libre === undefined ? undefined : { mano: false, at: libre }
}

function guardar(
  d: Borrador,
  a: Actor,
  body: Body,
  donde: { readonly mano: true } | { readonly mano: false; readonly at: Placement },
): void {
  const actual = d.actors.get(a.id) ?? a
  if (donde.mano) {
    const at = d.bodies.get(a.body)?.at ?? { x: 0, y: 0 }
    ponerCuerpo(d, { body, at, heldBy: a.id })
    d.actors.set(a.id, { ...actual, holding: [...actual.holding, body.id] })
    return
  }
  ponerCuerpo(d, { body, at: donde.at })
}

/** Los rendimientos del `completion`. Ninguno inventa masa: todos la mueven. */
function rendir(d: Borrador, a: Actor, y: Yield, ligs: readonly Ligadura[]): void {
  switch (y.k) {
    case 'join': {
      const ca = cuerpoDeRol(ligs, y.a)
      const cbinder = cuerpoDeRol(ligs, y.via)
      if (ca === undefined || cbinder === undefined) return
      const cb = y.b === undefined ? undefined : cuerpoDeRol(ligs, y.b)
      const id = nuevoId(d)
      const nuevo = unir(ca.body, cb?.body, cbinder.body, d.phys, id)
      if (nuevo === undefined) return
      // Primero se sacan las piezas —del mundo y de las manos— y RECIÉN DESPUÉS
      // se busca dónde va el ensamble. Al revés, la caña no entraría en la mano
      // que acaba de dejar libre la vara con la que se hizo.
      const enMano = a.holding.includes(ca.body.id)
      sacarCuerpo(d, ca.body.id)
      if (cb !== undefined) sacarCuerpo(d, cb.body.id)
      sacarCuerpo(d, cbinder.body.id)
      const previo = d.actors.get(a.id) ?? a
      d.actors.set(a.id, {
        ...previo,
        holding: previo.holding.filter(
          (x) => x !== ca.body.id && x !== cbinder.body.id && x !== cb?.body.id,
        ),
      })
      const donde = enMano
        ? destinoDeUnNacido(d, a, ca.at)
        : ({ mano: false, at: ca.at } as const)
      if (donde === undefined) return
      guardar(d, a, { ...nuevo, madeBy: a.id }, donde)
      d.events.push({ k: 'nacio', id, por: 'rendimiento' })
      return
    }
    case 'split': {
      const c = cuerpoDeRol(ligs, y.role)
      if (c === undefined) return
      const actual = d.bodies.get(c.body.id)
      if (actual === undefined) return
      // Se busca dónde va a caer ANTES de partir: si no hay lugar, no se parte.
      // Partir primero y no saber dónde poner el pedazo sería materia sin celda.
      const donde = destinoDeUnNacido(d, a, actual.at)
      if (donde === undefined) {
        d.events.push({ k: 'rechazada', by: a.id, seq: -1, que: 'apply', por: 'celda-ocupada' })
        return
      }
      const hijo = partir(d, actual.body, y.at)
      if (hijo === undefined) return
      ponerCuerpo(d, { ...actual, body: hijo.resto })
      guardar(d, a, { ...hijo.parte, madeBy: a.id }, donde)
      d.events.push({ k: 'nacio', id: hijo.parte.id, por: 'rendimiento' })
      return
    }
    case 'drawFromStock': {
      const c = cuerpoDeRol(ligs, y.of)
      if (c === undefined) return
      const actual = d.bodies.get(c.body.id)
      if (actual === undefined) return
      const masa = masaDe(actual.body, d.phys)
      const saca = masa < MASA_POR_EXTRACCION ? masa : MASA_POR_EXTRACCION
      if (saca <= 0) return
      const cuna = d.bodies.get(a.body)?.at ?? actual.at
      const donde = destinoDeUnNacido(d, a, cuna)
      if (donde === undefined) {
        d.events.push({ k: 'rechazada', by: a.id, seq: -1, que: 'apply', por: 'celda-ocupada' })
        return
      }
      const sacado: Body = { ...escalarMasa(actual.body, saca / masa), id: nuevoId(d), joints: [] }
      ponerCuerpo(d, { ...actual, body: escalarMasa(actual.body, (masa - saca) / masa) })
      guardar(d, a, sacado, donde)
      d.events.push({ k: 'nacio', id: sacado.id, por: 'rendimiento' })
      return
    }
    case 'transmute':
      // La transmutación de la ley 4 la hace `paso()` sola, cuando el carbonizado
      // pasa su umbral; ningún proceso semilla la rinde. Un `transmute` escrito
      // por el modelo entraría por acá, y no está: rendir algo a medias sería
      // peor que decir que no está hecho.
      d.events.push({ k: 'rechazada', by: a.id, seq: -1, que: 'apply', por: 'no-implementado' })
      return
  }
}

/**
 * Partir un cuerpo. Es la mitad de `split` que conserva materia: lo que sale
 * tiene la masa que lo que queda perdió, ni un gramo más.
 */
function partir(
  d: Borrador,
  b: Body,
  donde: 'joint' | 'grain',
): { resto: Body; parte: Body } | undefined {
  const masa = masaDe(b, d.phys)
  if (masa <= 0) return undefined
  if (donde === 'grain') {
    // A favor del grano: sale una hebra, que es una fracción de la misma materia.
    const f = FRACCION_DE_HEBRA
    const parte: Body = { ...escalarMasa(b, f), id: nuevoId(d), form: 'hebra', joints: [] }
    return { resto: escalarMasa(b, 1 - f), parte }
  }
  // Por la junta: se recupera la ÚLTIMA parte atada, que es la que se agregó
  // último. Romper el ensamble para recuperar la vara es una conducta esperada.
  if (b.parts.length < 2 || b.joints.length === 0) return undefined
  const ultima = b.parts[b.parts.length - 1]!
  const resto: Body = {
    ...b,
    parts: b.parts.slice(0, -1),
    joints: b.joints.filter((j) => j.a < b.parts.length - 1 && j.b < b.parts.length - 1),
  }
  const parte: Body = {
    id: nuevoId(d),
    form: b.form,
    parts: [ultima],
    joints: [],
    state: {},
  }
  return { resto, parte }
}

// ─── El despacho de una intención ────────────────────────────────────────────

function despachar(d: Borrador, a: Actor, i: Intent): void {
  switch (i.k) {
    case 'wait':
      d.events.push({ k: 'espero', by: a.id })
      return
    case 'goTo':
      intencionCaminar(d, a, i)
      return
    case 'explore':
      intencionExplorar(d, a, i)
      return
    case 'take':
      intencionTomar(d, a, i)
      return
    case 'drop':
      intencionSoltar(d, a, i)
      return
    case 'put':
      intencionPoner(d, a, i)
      return
    case 'eat':
      intencionComer(d, a, i)
      return
    case 'apply':
      intencionAplicar(d, a, i)
      return
    case 'place':
      // Las obras son el ADR 0032 de Ánima I y no existen todavía en Ánima II.
      // Rechazar con nombre es mejor que fingir: una habilidad que las use se
      // entera hoy, no el día que alguien note que no pasaba nada.
      rechazo(d, i, 'no-implementado')
      return
  }
}

// ─── Los sistemas ────────────────────────────────────────────────────────────

/**
 * Las doce leyes, sobre cada cuerpo, en orden canónico de id.
 *
 * El orden importa aunque `paso()` sea independiente por cuerpo: cuando la ley 4
 * transmuta, da de alta una sustancia NUEVA en la `Physics`, y el orden en que se
 * dan de alta es parte del estado. Recorrer un `Map` en orden de inserción haría
 * que dos mundos que llegaron al mismo estado por caminos distintos registraran
 * las sustancias en distinto orden.
 *
 * COSTO MEDIDO, y hay que decirlo porque es el criterio del Hito 2: `paso()` sobre
 * 5000 cuerpos cuesta ~41 ms en esta máquina, y el techo del criterio es 4 ms.
 * El grueso no está acá: `paso()` llama a `leer()` cinco veces y cada `leer()` son
 * doce `qualityOf`, o sea unas sesenta lecturas por cuerpo y por tick; medido
 * aparte, un solo `leer()` sobre los 5000 ya cuesta 6,4 ms. El techo no se alcanza
 * bajando el costo del bucle sino el de `qualityOf`, y eso es trabajo dentro de
 * `@anima/physics`. Está clavado con números en `tests/banco.test.ts`.
 */
function sistemaLeyes(d: Borrador): void {
  const fs = fuentes(d)
  const ocl = oclusiones(d)
  const nuevas: Substance[] = []
  // Se recorre el `Map` en vivo y no una copia: este bucle solo REEMPLAZA claves
  // que ya existen —ningún cuerpo nace ni muere por una ley que no sea la 4, y la
  // 4 solo cambia la sustancia de sus partes—, y reemplazar una clave existente
  // durante la iteración de un `Map` está especificado y es seguro. Copiar el
  // arreglo serían 5000 punteros más por tick, y el tick tiene cuatro
  // milisegundos.
  for (const c of d.bodies.values()) {
    const r = paso(c.body, entornoDe(d, c, fs, ocl), d.phys, d.dt)
    if (r.body !== c.body) d.bodies.set(c.body.id, { ...c, body: r.body })
    if (r.nueva !== undefined) nuevas.push(r.nueva)
  }
  for (const s of nuevas) {
    d.phys = conSustancia(d.phys, s)
    d.events.push({ k: 'sustancia', id: s.id })
  }
}

/**
 * Estar vivo cuesta. `stamina` es conservada y no relaja: lo que se gasta no
 * vuelve solo, y por eso el hambre duele. Si volviera, el motor de toda la
 * historia se apagaría en el tick 300.
 */
function sistemaMetabolismo(d: Borrador): void {
  for (const a of d.actors.values()) {
    const c = d.bodies.get(a.body)
    if (c === undefined) continue
    const s = qualityOf(c.body, 'stamina', d.phys)
    if (s <= 0) continue
    d.bodies.set(c.body.id, { ...c, body: conCualidad(c.body, 'stamina', s - COSTO_VIVIR) })
  }
}

/**
 * El registro de sistemas. Es una lista y no un `Set` ni un mapa por nombre: lo
 * único que importa de un sistema es CUÁNDO corre, y un contenedor sin orden
 * declarado es una divergencia esperando a que alguien agregue el sistema trece.
 */
export const SISTEMAS: readonly { readonly nombre: string; readonly correr: (d: Borrador) => void }[] =
  [
    { nombre: 'leyes', correr: sistemaLeyes },
    { nombre: 'metabolismo', correr: sistemaMetabolismo },
  ]

// ─── El paso ─────────────────────────────────────────────────────────────────

/**
 * Un tick de mundo. Puro: mismo estado y mismas intenciones, mismos bits, en
 * cualquier máquina y en cualquier motor de JavaScript.
 *
 * Lo que hace, en este orden y no en otro:
 *
 *   1. ordena las intenciones por id de actor y número de emisión — orden TOTAL;
 *   2. rechaza las que mienten sobre su compromiso o no tienen permiso;
 *   3. deja actuar a lo sumo una vez a cada actor;
 *   4. corre los sistemas registrados.
 *
 * El portón del punto 2 es lo que hace que dejar que un LLM escriba conducta sea
 * seguro: nada de lo que devuelve el modelo se ejecuta, el modelo PROPONE y el
 * mundo determinista valida y aplica.
 */
export function stepWorld(state: WorldState, intents: readonly Intent[]): StepOutcome {
  const d = abrir(state)
  const ordenadas = ordenarIntenciones(intents)

  // ─── Los empates, marcados ANTES de despachar nada ────────────────────────
  //
  // Dos intenciones del mismo actor con el mismo número de emisión no tienen
  // orden entre sí, y el mundo no se lo inventa: las dos se rechazan y quien las
  // emitió se entera. Desempatarlas por dentro sería elegir con la estabilidad
  // del `sort`, que es exactamente lo que no puede decidir nada acá.
  //
  // Esta pasada previa existe porque la versión que detectaba el empate AL VUELO
  // no cumplía lo que decía. Con ella, la primera del par ya se había despachado
  // cuando aparecía la segunda: se movía, gastaba `stamina`, y recién entonces
  // las dos salían «rechazadas». O sea que el mundo dependía de CUÁL DE LAS DOS
  // LLEGÓ ANTES en el arreglo de entrada — y eso es justo lo que decide la
  // estabilidad del `sort` del motor, que ECMAScript garantiza desde 2019 pero
  // que acá no debería decidir nada porque el orden de llegada es el orden en que
  // contestaron las mentes. Lo encontró `tests/ataque-determinismo.test.ts`, y es
  // el único agujero de determinismo real que quedaba en el paso del mundo.
  const empatada = new Set<number>()
  for (let i = 1; i < ordenadas.length; i++) {
    const a = ordenadas[i - 1] as Intent
    const b = ordenadas[i] as Intent
    if (a.by === b.by && a.seq === b.seq) {
      empatada.add(i - 1)
      empatada.add(i)
    }
  }

  const yaActuo = new Set<ActorId>()
  for (let idx = 0; idx < ordenadas.length; idx++) {
    const i = ordenadas[idx] as Intent
    if (empatada.has(idx)) {
      rechazo(d, i, 'orden-duplicado')
      continue
    }

    const a = d.actors.get(i.by)
    if (a === undefined) {
      rechazo(d, i, 'actor-desconocido')
      continue
    }
    const mal = revisarCompromiso(i, d.phys, a.permits)
    if (mal !== undefined) {
      rechazo(
        d,
        i,
        mal.k === 'proceso-desconocido'
          ? 'proceso-desconocido'
          : mal.k === 'mal-declarado'
            ? 'compromiso-mal-declarado'
            : 'sin-permiso',
      )
      continue
    }
    // Un cuerpo tiene un turno por tick. Hablar no gasta turno porque hablar no
    // es una intención: es UI, y no debería costarle un tick al cuerpo.
    if (yaActuo.has(i.by)) {
      rechazo(d, i, 'ya-actuo')
      continue
    }
    yaActuo.add(i.by)
    despachar(d, a, i)
  }

  // Quien no actuó pierde la actividad en curso. Frotar es frotar todos los
  // ticks: si se distrae, el palo se enfría solo por la ley 1 y hay que empezar
  // de nuevo. Sin esto, una actividad quedaría acumulando ticks sin que nadie la
  // esté haciendo.
  for (const a of d.actors.values()) {
    if (a.doing !== undefined && !yaActuo.has(a.id)) d.actors.set(a.id, quitarActividad(a))
  }

  for (const s of SISTEMAS) s.correr(d)
  return cerrar(d)
}
