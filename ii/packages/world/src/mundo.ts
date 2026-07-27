// ─── @anima/world/mundo.ts ───────────────────────────────────────────────────
//
// EL PUENTE. Los tres agentes que escribieron este paquete dejaron tres cosas que
// no se tocaban:
//
//   `step.ts`      un `WorldState` inmutable con cuerpos, actores y celdas;
//   `hash.ts`      un `hashWorld` que hashea cualquier dato de forma canónica;
//   `snapshot.ts`  una cadena de deltas sobre un mundo visto como RANURAS.
//
// Y por lo tanto el criterio del Hito 2 —«dos mundos gemelos con 10⁵ intenciones
// producen el mismo `hashWorld`»— estaba verificado dos veces sobre dos cosas
// distintas: con una huella local en el mundo de verdad, y con `hashWorld` sobre
// un mundo de juguete. Ninguna de las dos era la frase del documento.
//
// Este archivo es la frase del documento. Traduce el `WorldState` a lo que las
// otras dos piezas saben leer, y no agrega ni una regla de mundo: no decide nada,
// solo dice cómo se mira.
//
// ─── La física no se hashea entera cada vez ─────────────────────────────────
//
// `WorldState.phys` es el catálogo: veintinueve cualidades, treinta sustancias y
// los procesos. Es inmutable y compartido, y cambia solo cuando la ley 4
// transmuta y da de alta una sustancia nueva. Hashearlo en cada checkpoint sería
// pagar el catálogo entero por cada foto del mundo, así que se memoriza POR
// IDENTIDAD en un `WeakMap`: identidad distinta, hash nuevo. Es correcto porque
// `conSustancia` construye una `Physics` NUEVA en vez de mutar la vieja — o sea
// que la identidad del objeto ya es la versión del catálogo.
//
// ─── El catálogo se hashea ORDENADO, y eso es una decisión ──────────────────
//
// `phys.substances` es un `Map` y su orden es el de ALTA. Dos partidas que
// llegaron al mismo catálogo por caminos distintos —una carbonizó el junco antes
// que la corteza y la otra al revés— lo tienen en distinto orden. `hashWorld`
// ordena las claves de un `Map` de texto, así que las dos hashean IGUAL, y eso es
// lo que se quiere: el catálogo es un conjunto de sustancias, no una historia de
// altas. Si algún día el orden de alta importara para algo, dejaría de ser cierto
// y habría que escribirlo en el estado a propósito.
//
// Determinismo: acá no hay `Date`, `Math.random`, `performance`, `Intl`,
// `localeCompare` ni `Math` trascendente.

import type { Physics, Process, QualitySpec, Substance } from '@anima/physics'
import { buildSeedPhysics } from '@anima/physics'

import type { CellKey } from './cell.js'
import { hashWorld } from './hash.js'
import type { WorldHash } from './hash.js'
import type { Intent } from './intent.js'
import type { Slots } from './snapshot.js'
import type { Actor, CellState, WorldBody, WorldState } from './step.js'
import { mapaDeActores, mapaDeCuerpos, stepWorld } from './step.js'

// ─── El hash del mundo ───────────────────────────────────────────────────────

const HUELLA_DE_FISICA = new WeakMap<Physics, WorldHash>()

/**
 * El hash del catálogo. Memorizado por identidad del objeto `Physics`.
 *
 * Se expone porque el juez lo va a querer: «¿los dos motores corrieron contra la
 * misma física?» es la primera pregunta ante una divergencia, y es más barata de
 * contestar que comparar dos mundos.
 */
export function hashPhysics(phys: Physics): WorldHash {
  const memo = HUELLA_DE_FISICA.get(phys)
  if (memo !== undefined) return memo
  const h = hashWorld({
    version: phys.version,
    // El array de cualidades va EN SU ORDEN, y no ordenado: es el catálogo
    // cerrado y su orden es dato (`CONSERVED` y `QUALITY_IDS` salen de él).
    qualities: phys.qualities,
    substances: phys.substances,
    processes: phys.processes,
  })
  HUELLA_DE_FISICA.set(phys, h)
  return h
}

/**
 * EL HASH DEL MUNDO, el que nombra el criterio del Hito 2.
 *
 * Es `hashWorld` sobre la forma canónica del `WorldState`, y no una cuenta
 * paralela: si esta función tuviera su propio mezclador habría dos verdades sobre
 * qué significa «el mismo mundo» y el juez tendría que elegir una.
 *
 * `bodies` y `actors` entran como los `Map` que son y `hashWorld` los ordena por
 * clave; que además `step.ts` los mantenga ordenados por id no es redundante —eso
 * es para que el RECORRIDO del tick sea canónico, esto es para que el hash lo sea
 * aunque alguien construya el mapa de otra forma—.
 */
export function hashWorldState(s: WorldState): WorldHash {
  return hashWorld({
    tick: s.tick,
    nextId: s.nextId,
    fisica: hashPhysics(s.phys),
    bodies: s.bodies,
    actors: s.actors,
    cells: s.cells,
  })
}

// ─── El mundo como ranuras ───────────────────────────────────────────────────
//
// El grano de una ranura es el tamaño mínimo del delta, así que una ranura tiene
// que ser lo que cambia junto:
//
//   `mundo`          el reloj y el contador de ids. Cambia todos los ticks, y es
//                    una sola ranura de tres números.
//   `cualidades`     el catálogo cerrado, en su orden. No cambia nunca: entra en
//                    el delta base y no vuelve a aparecer.
//   `proceso:<id>`   uno por proceso. Crecen cuando el modelo escribe uno.
//   `sustancia:<id>` una por sustancia. Crecen cuando la ley 4 transmuta, y por
//                    eso van de a una y no todas juntas: una transmutación no
//                    tiene por qué reescribir las otras veintinueve.
//   `cuerpo:<id>`    uno por cuerpo. Es la unidad que se mueve.
//   `actor:<id>`     uno por actor.
//   `celda:<clave>`  una por celda escrita.
//
// Los prefijos existen para que las siete familias no puedan pisarse: un cuerpo
// que se llamara `cualidades` no tendría cómo colisionar con el catálogo.

export const PREFIJO_PROCESO = 'proceso:'
export const PREFIJO_SUSTANCIA = 'sustancia:'
export const PREFIJO_CUERPO = 'cuerpo:'
export const PREFIJO_ACTOR = 'actor:'
export const PREFIJO_CELDA = 'celda:'
export const RANURA_MUNDO = 'mundo'
export const RANURA_CUALIDADES = 'cualidades'

/** La cabecera: lo que el mundo tiene y no es ni un cuerpo ni una celda. */
export interface CabeceraDeMundo {
  readonly tick: number
  readonly nextId: number
  readonly version: number
}

/**
 * El mundo entero como ranuras, listo para `createSnapshotChain`.
 *
 * Es una vista, no una copia: los valores son los objetos del estado. Eso es lo
 * que `snapshot.ts` documenta como contrato —«una ranura que entró a un delta no
 * se puede mutar nunca más»— y se cumple porque `stepWorld` es copia-al-escribir:
 * nunca reescribe un `WorldBody`, lo reemplaza. Hay un test que lo ataca.
 */
export function worldSlots(s: WorldState): Slots<unknown> {
  const out = new Map<string, unknown>()
  const cabecera: CabeceraDeMundo = { tick: s.tick, nextId: s.nextId, version: s.phys.version }
  out.set(RANURA_MUNDO, cabecera)
  out.set(RANURA_CUALIDADES, s.phys.qualities)
  for (const [id, p] of s.phys.processes) out.set(PREFIJO_PROCESO + id, p)
  for (const [id, sub] of s.phys.substances) out.set(PREFIJO_SUSTANCIA + id, sub)
  for (const [id, c] of s.bodies) out.set(PREFIJO_CUERPO + id, c)
  for (const [id, a] of s.actors) out.set(PREFIJO_ACTOR + id, a)
  for (const [k, c] of s.cells) out.set(PREFIJO_CELDA + String(k), c)
  return out
}

function exigir<T>(v: T | undefined, que: string): T {
  if (v === undefined) throw new RangeError(`al mundo guardado le falta ${que}`)
  return v
}

/**
 * El camino de vuelta: ranuras a `WorldState`.
 *
 * Es autosuficiente a propósito —**no recibe una `Physics` de afuera**—, y eso es
 * lo que hace que «restaurar a mitad reproduce el final exacto» pruebe algo. Si
 * el catálogo se lo pasara quien restaura, el test estaría reusando la variable
 * viva del mundo que dice haber guardado, y una sustancia que la ley 4 dio de
 * alta a mitad de la partida entraría por la puerta de atrás.
 *
 * Los tres mapas se arman en ORDEN CANÓNICO —los ids por unidad de código, las
 * celdas por clave numérica— y no en el orden en que vinieron las ranuras: un
 * estado restaurado tiene que ser indistinguible del original, y el orden de
 * iteración de un `Map` es parte de lo que se ve desde afuera.
 */
export function restoreWorld(slots: Slots<unknown>): WorldState {
  const cabecera = exigir(slots.get(RANURA_MUNDO), `la ranura «${RANURA_MUNDO}»`) as CabeceraDeMundo
  const qualities = exigir(
    slots.get(RANURA_CUALIDADES),
    `la ranura «${RANURA_CUALIDADES}»`,
  ) as readonly QualitySpec[]

  const substances: Substance[] = []
  const processes: Process[] = []
  const bodies: WorldBody[] = []
  const actors: Actor[] = []
  const celdas: [CellKey, CellState][] = []

  // Las claves se recorren ORDENADAS, y no en el orden del `Map`: las ranuras
  // pueden venir de una cadena de deltas, o sea del orden en que se escribieron,
  // que es la historia y no el estado.
  for (const k of [...slots.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const v = slots.get(k)
    if (k.startsWith(PREFIJO_SUSTANCIA)) substances.push(v as Substance)
    else if (k.startsWith(PREFIJO_PROCESO)) processes.push(v as Process)
    else if (k.startsWith(PREFIJO_CUERPO)) bodies.push(v as WorldBody)
    else if (k.startsWith(PREFIJO_ACTOR)) actors.push(v as Actor)
    else if (k.startsWith(PREFIJO_CELDA)) {
      const clave = Number(k.slice(PREFIJO_CELDA.length))
      if (!Number.isSafeInteger(clave)) throw new RangeError(`clave de celda inválida: ${k}`)
      celdas.push([clave, v as CellState])
    }
  }

  const cells = new Map<CellKey, CellState>()
  for (const [clave, c] of celdas.sort((a, b) => a[0] - b[0])) cells.set(clave, c)

  return {
    tick: cabecera.tick,
    nextId: cabecera.nextId,
    phys: buildSeedPhysics({ qualities, substances, processes, version: cabecera.version }),
    bodies: mapaDeCuerpos(bodies),
    actors: mapaDeActores(actors),
    cells,
  }
}

// ─── El paso, con la forma que `replay` espera ───────────────────────────────

/**
 * `stepWorld` visto como el `StepFn` de `journal.ts`: entra un estado, sale un
 * estado, y los eventos quedan afuera —el replay reconstruye el mundo, no la
 * narración—.
 *
 * Y verifica el tick, que es la mitad del valor de esta función. `replay` lleva
 * su propio contador y el mundo lleva el suyo; si se corren uno respecto del
 * otro, el resultado no es un error sino un mundo COHERENTE con un tick de menos
 * —un `explore` que eligió el otro rumbo, porque el rumbo sale del reloj— y una
 * divergencia de hash sin causa visible. Restaurar un snapshot y arrancar el
 * replay en el tick equivocado es exactamente cómo pasa.
 */
export function pasoDelMundo(
  state: WorldState,
  intents: readonly Intent[],
  tick?: number,
): WorldState {
  if (tick !== undefined && tick !== state.tick) {
    throw new RangeError(`el replay va por el tick ${tick} y el mundo por el ${state.tick}`)
  }
  return stepWorld(state, intents).state
}
