// TANDA 3 · capacidad 3 — «avisar-antes-de-gastarse»
// Avisar ANTES, con el costo estimado, y seguir salvo que le digan que no.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* avisarAntesDeGastarse(
  ctx: Ctx,
  args: { a: BodyView; b: BodyView; binder: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('presupuestar')

  const plan = ctx.apply('union', { a: args.a, b: args.b, binder: args.binder })

  // (A) la mitad que SÍ se expresa: el compromiso viaja en la Intent.
  const irreversible = plan.commitment === 'irreversible'

  // (B) ¿cuánto cuesta? — no hay estimador en `Ctx`. `estimateTicks` vive en
  //     la mente (`opportunities()`), del otro lado de la frontera.
  const ticks = ctx.estimate(plan).ticks // ← esperado: TS2339
  const gasto = ctx.cost(plan, 'stamina') // ← esperado: TS2339

  // (C) ¿contra qué lo comparo? — no hay lectura del propio estado.
  const mia = ctx.self.stamina // ← esperado: TS2339

  if (irreversible || gasto > mia * 0.4) {
    ctx.say(`esto me va a costar ${gasto} de aliento y ${ticks} ticks. Voy salvo que me digas que no.`)

    // (D) escuchar la respuesta — `say` es de una sola vía. No hay bandeja.
    const respuesta = ctx.heard() // ← esperado: TS2339
    if (respuesta.some((u) => u.polarity === 'no')) return fail('me dijeron que no')
  }

  const r = yield plan
  return r.status === 'done' ? done() : fail('no salió')
}
