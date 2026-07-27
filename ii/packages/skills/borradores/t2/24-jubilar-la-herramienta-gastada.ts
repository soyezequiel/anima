// Tanda 2 · capacidad «jubilar-la-herramienta-gastada» — SONDA IDEAL.
// Es el borrador 00 con la vigilancia del aparejo que al borrador 00 le falta.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* pescarSinInsistirConUnPaloPelado(
  ctx: Ctx,
  args: { con: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('buscar-agua')
  const agua = ctx.see([{ q: 'wet', op: '>=', v: 0.9 }])[0]
  if (!agua) return fail('no veo agua')

  ctx.phase('ir')
  const ir = yield ctx.goTo(agua, { within: 1 })
  if (ir.status !== 'arrived') return fail('no llegué')

  ctx.phase('pescar')
  const catchInicial = ctx.q(args.con, 'catch')
  for (let i = 0; i < 40; i++) {
    // (1) Re-resolver el aparejo: si la atadura cedió, el cuerpo compuesto ya
    //     no existe y `args.con` es un handle viejo. ¿`ctx.self.holding` se
    //     refresca entre yields? La superficie no lo dice.
    const enMano = ctx.self.holding.find((b) => b.id === args.con.id)
    if (!enMano) return fail('se me deshizo el aparejo')

    // (2) Vigilar la degradación: `catch` y `reach` SON cualidades derivadas.
    const enganche = ctx.q(enMano, 'catch')
    const alcance = ctx.q(enMano, 'reach')
    if (enganche <= 0 || alcance < 2) return fail('el aparejo dejó de servir')
    if (enganche < catchInicial * 0.5) ctx.say('la atadura está cediendo')

    // (3) Mirar la junta de frente, y no por su consecuencia derivada.
    const atadura = enMano.joints[0]
    if (atadura && atadura.strength < 0.2) return fail('la atadura no aguanta otra')

    // (4) ¿Sigue habiendo pescado? Distinguir «no pica» de «no hay».
    const quedan = ctx.q(agua, 'stock')
    if (quedan <= 0) return fail('el río se agotó')

    const o = yield ctx.apply('extraccion', { gear: enMano, source: agua })
    if (o.got.length > 0) return done(o.got[0])
  }
  return fail('no picó')
}
