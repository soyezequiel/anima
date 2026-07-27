// TANDA 4 · «Sabe hacerse encontrar cuando está lejos» — SONDA DE COMPILACIÓN.

import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* hacerseVerDeLejos(
  ctx: Ctx,
  args: { lena: readonly [] },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('decidir-senal')

  // ✗ 1 — no hay reloj de mundo más allá de `ctx.tick`: no hay día ni noche
  //   (HUECO 11), así que «de día humo / de noche fuego» no se puede decidir.
  if (ctx.isNight()) ctx.say('hago fuego alto')

  // ✗ 2 — 'smoke' no existe en QualityId. Ni ver humo, ni medirlo.
  const humo = ctx.see([{ q: 'smoke', op: '>=', v: 0.3 }])
  const cuanto = ctx.q(humo[0]!, 'smoke')

  // ✗ 3 — 'ahumar' no es ProcessId: los aplicables son cuatro.
  yield ctx.apply('ahumar', { source: humo[0]! })

  // ✗ 4 — no hay forma de saber hasta dónde llega la percepción propia ni la
  //   ajena, que es LA magnitud de esta capacidad: «se ve más lejos que un
  //   cuerpo» no es expresable.
  if (ctx.perceptionRadius() < 20) return fail('no me van a ver')

  return done()
}

// ── LO QUE SÍ COMPILA ──────────────────────────────────────────────────────
// Hacer una fogata grande es expresable (friccion + union + put). Lo que no
// es expresable es que eso SEA UNA SEÑAL: no hay quién la vea (no hay otro
// cuerpo en el mundo), no hay noche que la haga valer, y no hay columna que
// suba por encima del radio de visión. Compila una fogata; no compila una
// señal.
export function* fogataGrandeQueNadieVe(
  ctx: Ctx,
): Generator<Intent, Outcome, StepResult> {
  const a = ctx.see([{ q: 'rigidity', op: '>=', v: 0.5 }])[0]
  const b = ctx.see([{ q: 'rigidity', op: '>=', v: 0.5 }])[1]
  if (!a || !b) return fail('sin varas')
  yield ctx.apply('friccion', { a, b, actor: a })
  return done()
}
