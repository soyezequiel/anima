// ─── @anima/physics/physics.ts ───────────────────────────────────────────────
//
// `Physics` es el mundo entero como dato: el catálogo cerrado de cualidades, el
// catálogo ABIERTO de sustancias, los cuatro procesos aplicables y una versión.
//
// Es un valor, no un módulo con estado. Dos partidas con la misma `Physics` y la
// misma semilla dan el mismo mundo, y una recalibración produce una `Physics`
// nueva con otra `version` en vez de mutar la vieja — que es lo que invalida los
// sellos de los procesos sin que nadie se acuerde de invalidarlos.

import type { QualityId, QualitySpec } from './quality.js'
import { QUALITIES } from './quality.js'
import type { Substance, SubstanceId } from './substance.js'
import type { Process, ProcessId } from './process.js'
import { PHYSICS_VERSION, SEED_PROCESSES } from './process.js'
import { SUSTANCIAS_SEMILLA } from './data/sustancias.js'

export interface Physics {
  qualities: readonly QualitySpec[]
  substances: ReadonlyMap<SubstanceId, Substance>
  processes: ReadonlyMap<ProcessId, Process>
  version: number
}

export interface SeedPhysicsInput {
  /** Por omisión, el catálogo cerrado de `quality.ts`. Solo se pisa en tests. */
  qualities?: readonly QualitySpec[]
  /**
   * Por omisión, las sustancias semilla. Pero el parámetro existe y es el punto
   * entero: el catálogo de sustancias es ABIERTO —el oráculo agrega cuantas
   * quiera en vivo— y la que agregue entra por acá y se comporta bien sin fila
   * propia, porque las transformaciones se resuelven por TAG. Si esto fuera un
   * import fijo, «sustancia nueva» significaría «editar el paquete».
   */
  substances?: readonly Substance[]
  /** Por omisión, los cuatro aplicables. */
  processes?: readonly Process[]
  version?: number
}

/**
 * Arma la física semilla. Falla ruidosamente ante ids repetidos: dos sustancias
 * con el mismo id significan que una le está tapando la otra al mundo, y eso no
 * da error en ningún lado hasta que la criatura come lo que no era.
 */
export function buildSeedPhysics(input: SeedPhysicsInput = {}): Physics {
  const qualities = input.qualities ?? QUALITIES
  const substances = input.substances ?? SUSTANCIAS_SEMILLA
  const processes = input.processes ?? SEED_PROCESSES

  assertUniqueIds(
    'cualidad',
    qualities.map((q) => q.id),
  )
  assertUniqueIds(
    'sustancia',
    substances.map((s) => s.id),
  )
  assertUniqueIds(
    'proceso',
    processes.map((p) => p.id),
  )

  // Los Map se construyen recorriendo los arrays en orden: el orden de
  // iteración de un Map de JS es el de inserción, así que cualquier recorrido
  // río abajo es reproducible sin tener que ordenar de nuevo.
  const bySubstance = new Map<SubstanceId, Substance>()
  for (const s of substances) bySubstance.set(s.id, s)
  const byProcess = new Map<ProcessId, Process>()
  for (const p of processes) byProcess.set(p.id, p)

  return {
    qualities,
    substances: bySubstance,
    processes: byProcess,
    version: input.version ?? PHYSICS_VERSION,
  }
}

/** La spec de una cualidad, o `undefined` si no está en el catálogo. */
export function specIn(phys: Physics, q: QualityId): QualitySpec | undefined {
  for (const s of phys.qualities) if (s.id === q) return s
  return undefined
}

/**
 * Las cuentas conservadas, en el orden del catálogo.
 *
 * La regla que cuelga de acá es la que cierra las máquinas de movimiento
 * perpetuo: nada que suba una cualidad no conservada lo hace gratis, declara de
 * cuál de éstas drena y con qué eficiencia ≤ 1. Sin eso, «frotar dos piedras»
 * produce calor infinito y el hambre deja de doler en el tick 300.
 */
export function conservedIn(phys: Physics): readonly QualityId[] {
  const out: QualityId[] = []
  for (const s of phys.qualities) if (s.conserved) out.push(s.id)
  return out
}

function assertUniqueIds(what: string, ids: readonly string[]): void {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`${what} repetida en el catálogo: ${id}`)
    seen.add(id)
  }
}
