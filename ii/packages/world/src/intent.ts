// ─── @anima/world/intent.ts ──────────────────────────────────────────────────
//
// Una intención es lo ÚNICO que entra al mundo desde afuera. La mente, las
// habilidades que escriba el modelo y el cuidador que teclea una orden emiten
// todos lo mismo, y el mundo las juzga a todas igual. «Código real y aislado no
// significa código privilegiado»: una habilidad no muta nada, emite una `Intent`
// que `stepWorld` juzga exactamente igual que si viniera de cualquier otro lado.
//
// Este archivo tiene tres responsabilidades y ninguna más:
//
//   1. la FORMA de una intención — un union cerrado, no un `{ type, payload }`;
//   2. el COMPROMISO de cada una, que lo declara el mundo y no quien la emite;
//   3. el ORDEN TOTAL en que se procesan, que es la mitad del determinismo.
//
// Regla de la carpeta: nada de acá importa de `packages/` ni de `apps/`.

import type { Commitment, Physics, ProcessId } from '@anima/physics'
import { CELL_LIMIT, inWorld } from './cell.js'

// ─── Identidades y lugar ─────────────────────────────────────────────────────

export type ActorId = string
export type BodyId = string

/**
 * Una celda del mundo. Enteros, siempre.
 *
 * No es una comodidad: una posición fraccionaria haría que la comparación de dos
 * mundos gemelos dependa del orden en que se acumularon los desplazamientos, y el
 * criterio del Hito 2 es que dos mundos gemelos den el MISMO hash. Con enteros,
 * moverse es sumar, y sumar enteros no acumula error en ninguna máquina.
 */
export interface Placement {
  readonly x: number
  readonly y: number
}

/**
 * El límite del mundo. Existe para que el invariante «posiciones en rango» tenga
 * un rango que verificar, y es una potencia de dos para que la clave de celda
 * quepa holgada en un entero de 53 bits.
 *
 * **Se DERIVA de `CELL_LIMIT` de `cell.ts` y no se vuelve a escribir.** Los dos
 * números eran iguales por casualidad —los escribieron dos agentes distintos— y
 * un límite del mundo mantenido a mano en dos archivos es la clase de dato que
 * diverge sin que nada falle: la grilla lanzaría en el borde y el paso del mundo
 * no, o al revés, y el error solo se vería del lado negativo del mapa.
 */
export const WORLD_MIN = -CELL_LIMIT
export const WORLD_MAX = CELL_LIMIT - 1

/**
 * `enRango` y `inWorld` son la MISMA pregunta y ahora tienen una sola respuesta.
 * El nombre se conserva porque es el que usan las intenciones; lo que se fue es
 * la segunda implementación.
 */
export function enRango(at: Placement): boolean {
  return inWorld(at.x, at.y)
}

// La clave de celda —`cellKey`, `keyOfCell`, `CellKey`— vive en `cell.ts` y en
// ningún otro lado. Este archivo tenía la suya, con orden por columnas contra el
// orden por filas de aquélla, y las dos sobre el mismo mundo de ±2²⁰: dos formas
// canónicas de la misma cosa, o sea dos hashes posibles para el mismo mundo.
// `Placement` y `Cell` son estructuralmente idénticos, así que `keyOfCell(at)`
// se lee igual y contesta una sola verdad.

/** Distancia de Chebyshev: moverse en diagonal cuesta un paso, como caminar. */
export function chebyshev(a: Placement, b: Placement): number {
  const dx = a.x > b.x ? a.x - b.x : b.x - a.x
  const dy = a.y > b.y ? a.y - b.y : b.y - a.y
  return dx > dy ? dx : dy
}

// ─── Ligaduras de rol ────────────────────────────────────────────────────────

/**
 * Qué cuerpo llena qué rol de un proceso.
 *
 * Es un ARRAY de pares y no un `Record<string, BodyId>`, y la razón es el
 * determinismo y no el gusto: el orden de `Object.keys` de un objeto depende de
 * cómo se construyó —las claves que parecen enteros saltan al principio, las
 * demás quedan en orden de inserción—, así que dos habilidades que arman el mismo
 * `{ a, b }` en distinto orden recorrerían los roles distinto. Acá el orden es
 * dato, se normaliza una vez con `ordenarRoles`, y deja de depender de nadie.
 */
export interface RoleBinding {
  readonly name: string
  readonly body: BodyId
}

/** Los roles en orden canónico: por nombre, por unidad de código UTF-16. */
export function ordenarRoles(roles: readonly RoleBinding[]): readonly RoleBinding[] {
  return [...roles].sort((a, b) => compararTexto(a.name, b.name))
}

/**
 * Comparación de texto por unidad de código, que es lo que hacen `<` y `>` de
 * JavaScript. **No** se usa `localeCompare`: su orden depende del ICU del motor,
 * o sea que dos navegadores ordenarían distinto y el replay divergiría — que es
 * exactamente la regla 2 de `ii/README.md`.
 */
export function compararTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ─── La intención ────────────────────────────────────────────────────────────

export type IntentKind =
  | 'wait'
  | 'goTo'
  | 'explore'
  | 'take'
  | 'drop'
  | 'put'
  | 'eat'
  | 'apply'
  | 'place'

/** Lo que toda intención trae, venga de donde venga. */
interface IntentBase {
  /** Quién la emite. El orden total del tick se arma con esto primero. */
  readonly by: ActorId
  /** Orden de emisión dentro del tick. Desempata y hace reproducible el rechazo. */
  readonly seq: number
  /**
   * Lo que quien la emite DICE que compromete. No se le cree: `stepWorld` lo
   * recalcula con `commitmentOf` y rechaza la intención si no coincide. Está en
   * el dato igual, porque una mentira que no se puede ver no se puede castigar.
   */
  readonly commitment: Commitment
}

export type Intent =
  /**
   * Esperar es un concepto de RITMO y no de muestreo, así que va en segundos y
   * no en ticks (ADR II-0008): `wait(2)` son dos segundos de mundo a cualquier
   * frecuencia. `explore.maxTicks` sigue en ticks a propósito — es un
   * presupuesto de CÓMPUTO, o sea cuántas veces se llama a la mente, y eso sí es
   * muestreo.
   */
  | (IntentBase & { readonly k: 'wait'; readonly segundos: number })
  | (IntentBase & { readonly k: 'goTo'; readonly to: Placement; readonly within: number })
  | (IntentBase & { readonly k: 'explore'; readonly maxTicks: number })
  | (IntentBase & { readonly k: 'take'; readonly what: BodyId })
  | (IntentBase & { readonly k: 'drop'; readonly what: BodyId })
  | (IntentBase & {
      readonly k: 'put'
      readonly what: BodyId
      readonly at: Placement
      /** Ley 8: se APOYA encima. Sostiene peso y no tapa. */
      readonly onTopOf?: BodyId
      /** Ley 12 (ADR II-0002): TAPA. Ocluye el intercambio y no sostiene. */
      readonly covering?: BodyId
    })
  | (IntentBase & { readonly k: 'eat'; readonly what: BodyId })
  | (IntentBase & {
      readonly k: 'apply'
      readonly process: ProcessId
      readonly roles: readonly RoleBinding[]
    })
  | (IntentBase & { readonly k: 'place'; readonly blueprint: string; readonly at: Placement })

// ─── El compromiso, que lo declara el mundo ──────────────────────────────────

/**
 * Qué compromete cada clase de intención. **La tabla es del mundo.**
 *
 * El documento de arquitectura lo dice sin vueltas: «toda `Intent` lleva
 * `commitment`, y eso lo verifica `stepWorld`, no la cortesía del código
 * generado». Una habilidad que se declare `reversible` para colarse por el portón
 * de una candidata que solo pasó el smoke test no consigue nada: acá se recalcula.
 *
 * Los tres grados, y por qué cada intención cae donde cae:
 *
 *   - `reversible`  — deshacerlo cuesta a lo sumo otro tanto. Caminar, agarrar,
 *     soltar, poner, esperar, explorar. Nada de eso destruye nada.
 *   - `costly`      — se puede deshacer, pero se pagó algo que no vuelve: los
 *     ticks y la `stamina`. Ninguna intención cae acá por sí sola; caen los
 *     procesos que lo declaran (`deshilachar`, `extraccion`).
 *   - `irreversible` — no hay vuelta. Comer destruye el cuerpo comido; levantar
 *     una obra ocupa el terreno de forma permanente.
 *
 * `apply` NO está en la tabla a propósito: su compromiso es el del PROCESO, que
 * lo declara el catálogo y lo audita `admit()`. Duplicarlo acá sería una segunda
 * copia mantenida a mano del mismo número — el bug de `DSL_REFERENCE` de Ánima I.
 */
export const COMMITMENT_OF: Readonly<Record<Exclude<IntentKind, 'apply'>, Commitment>> = {
  wait: 'reversible',
  goTo: 'reversible',
  explore: 'reversible',
  take: 'reversible',
  drop: 'reversible',
  put: 'reversible',
  eat: 'irreversible',
  place: 'irreversible',
}

/**
 * El compromiso REAL de esta intención, según el mundo.
 *
 * `undefined` significa «no lo sé», y solo pasa con un `apply` a un proceso que
 * no está en el catálogo. Devolver un grado por omisión sería peor: el más suave
 * abriría la puerta a ejecutar cualquier cosa declarándola con un id inventado, y
 * el más duro haría que un proceso ausente se lea como un permiso denegado en vez
 * de como lo que es, un proceso que no existe.
 */
export function commitmentOf(i: Intent, phys: Physics): Commitment | undefined {
  if (i.k !== 'apply') return COMMITMENT_OF[i.k]
  return phys.processes.get(i.process)?.commitment
}

/** El orden de los tres grados. Sube de suave a definitivo. */
export const RANGO_DE_COMPROMISO: Readonly<Record<Commitment, number>> = {
  reversible: 0,
  costly: 1,
  irreversible: 2,
}

/**
 * ¿Un actor con permiso hasta `techo` puede emitir algo que compromete `c`?
 *
 * Es el portón del documento: pasar el smoke test de 4 mundos «te habilita a
 * entrar a la grilla completa y a tocar el mundo con actos reversibles — no a
 * quemar la casa que ella construyó en la vida anterior».
 */
export function permite(techo: Commitment, c: Commitment): boolean {
  return RANGO_DE_COMPROMISO[c] <= RANGO_DE_COMPROMISO[techo]
}

/** Por qué el mundo rechazó una intención antes siquiera de mirarla. */
export type FalloDeCompromiso =
  | { readonly k: 'proceso-desconocido'; readonly process: ProcessId }
  | { readonly k: 'mal-declarado'; readonly dice: Commitment; readonly es: Commitment }
  | { readonly k: 'sin-permiso'; readonly es: Commitment; readonly techo: Commitment }

/**
 * Las tres preguntas del portón, en este orden y no en otro: primero si el mundo
 * sabe qué es esto, después si quien lo emitió dijo la verdad, y recién al final
 * si tiene permiso. Al revés, un actor con permiso amplio nunca se enteraría de
 * que está declarando mal sus intenciones.
 */
export function revisarCompromiso(
  i: Intent,
  phys: Physics,
  techo: Commitment,
): FalloDeCompromiso | undefined {
  const es = commitmentOf(i, phys)
  if (es === undefined) {
    return { k: 'proceso-desconocido', process: i.k === 'apply' ? i.process : '' }
  }
  if (es !== i.commitment) return { k: 'mal-declarado', dice: i.commitment, es }
  if (!permite(techo, es)) return { k: 'sin-permiso', es, techo }
  return undefined
}

// ─── El orden total ──────────────────────────────────────────────────────────

/**
 * El orden en que el tick procesa las intenciones: por id de actor, y a igualdad
 * por número de emisión.
 *
 * Es un orden TOTAL sobre las intenciones bien formadas de un tick, y esa palabra
 * es el criterio entero: si dos intenciones pudieran quedar «empatadas», quién va
 * primero lo decidiría la estabilidad del `sort` del motor, y ahí se acabó el
 * mismo hash en dos navegadores. Por eso `stepWorld` además RECHAZA dos
 * intenciones del mismo actor con el mismo `seq` en vez de desempatarlas de
 * alguna forma: un empate es un error de quien las emitió, no algo que el mundo
 * tenga que resolver a escondidas.
 *
 * Por actor y no por cercanía, ni por prioridad, ni por quién llegó antes: el id
 * de actor es lo único estable que hay: la cercanía cambia sola y el orden de
 * llegada depende de cuánto tardó cada mente en contestar.
 */
export function compararIntenciones(a: Intent, b: Intent): number {
  const porActor = compararTexto(a.by, b.by)
  if (porActor !== 0) return porActor
  return a.seq - b.seq
}

/** Una copia ordenada. No toca el array que le dan: `stepWorld` es puro. */
export function ordenarIntenciones(intents: readonly Intent[]): readonly Intent[] {
  return [...intents].sort(compararIntenciones)
}

// ─── Constructores ───────────────────────────────────────────────────────────
//
// Existen para que nadie escriba el `commitment` a mano. Que igual se verifique
// en `stepWorld` no los hace redundantes: el constructor evita el error honesto,
// la verificación ataja el deshonesto, y hacen falta los dos.

interface Quien {
  readonly by: ActorId
  readonly seq: number
}

export function wait(w: Quien, segundos: number): Intent {
  return { k: 'wait', by: w.by, seq: w.seq, commitment: COMMITMENT_OF.wait, segundos }
}

export function goTo(w: Quien, to: Placement, within = 0): Intent {
  return { k: 'goTo', by: w.by, seq: w.seq, commitment: COMMITMENT_OF.goTo, to, within }
}

export function explore(w: Quien, maxTicks: number): Intent {
  return { k: 'explore', by: w.by, seq: w.seq, commitment: COMMITMENT_OF.explore, maxTicks }
}

export function take(w: Quien, what: BodyId): Intent {
  return { k: 'take', by: w.by, seq: w.seq, commitment: COMMITMENT_OF.take, what }
}

export function drop(w: Quien, what: BodyId): Intent {
  return { k: 'drop', by: w.by, seq: w.seq, commitment: COMMITMENT_OF.drop, what }
}

/**
 * `onTopOf` APOYA y `covering` TAPA, y no son lo mismo (ADR II-0002): la parrilla
 * apoya sin tapar y la losa tapa sin sostener. Confundirlos haría que cocinar
 * sobre la parrilla ahogue el fuego.
 */
export function put(
  w: Quien,
  what: BodyId,
  at: Placement,
  o?: { onTopOf?: BodyId; covering?: BodyId },
): Intent {
  // Se arma campo por campo en vez de con un spread del opcional porque
  // `exactOptionalPropertyTypes` distingue «ausente» de «presente y undefined», y
  // un `covering: undefined` explícito viajaría hasta el hash como una clave más.
  const base = { k: 'put', by: w.by, seq: w.seq, commitment: COMMITMENT_OF.put, what, at } as const
  if (o?.onTopOf !== undefined && o.covering !== undefined) {
    return { ...base, onTopOf: o.onTopOf, covering: o.covering }
  }
  if (o?.onTopOf !== undefined) return { ...base, onTopOf: o.onTopOf }
  if (o?.covering !== undefined) return { ...base, covering: o.covering }
  return base
}

export function eat(w: Quien, what: BodyId): Intent {
  return { k: 'eat', by: w.by, seq: w.seq, commitment: COMMITMENT_OF.eat, what }
}

export function place(w: Quien, blueprint: string, at: Placement): Intent {
  return { k: 'place', by: w.by, seq: w.seq, commitment: COMMITMENT_OF.place, blueprint, at }
}

/**
 * `apply` es el único constructor que necesita la física, porque es el único cuyo
 * compromiso no lo decide la clase de intención sino el proceso. Devuelve
 * `undefined` si el proceso no está en el catálogo: inventar un compromiso para
 * un id desconocido sería exactamente la mentira que el portón existe para
 * atajar.
 */
export function apply(
  w: Quien,
  phys: Physics,
  process: ProcessId,
  roles: readonly RoleBinding[],
): Intent | undefined {
  const p = phys.processes.get(process)
  if (p === undefined) return undefined
  return {
    k: 'apply',
    by: w.by,
    seq: w.seq,
    commitment: p.commitment,
    process,
    roles: ordenarRoles(roles),
  }
}
