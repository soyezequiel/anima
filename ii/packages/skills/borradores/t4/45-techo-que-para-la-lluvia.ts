// TANDA 4 · «Sabe hacerse un techo y saber que la tapa» — SONDA.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* techoQueParaLaLluvia(
  ctx: Ctx,
  args: { postes: readonly BodyView[]; cubierta: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('construir')

  // ✗ 1 — no hay lluvia. 'wet' existe como cualidad de celda (y ni siquiera
  //   declarada: HUECO 1), pero no hay fenómeno que moje desde arriba, ni
  //   forma de preguntar si está lloviendo.
  if (ctx.see([{ q: 'raining', op: '>', v: 0 }]).length > 0) ctx.say('llueve')

  // ✗ 2 — no hay oclusión. Nada dice «esto tapa a esto otro». La ley 11 sabe
  //   que el agua moja lo que TOCA y que el sol seca; no calcula cobertura.
  const bajoTecho = ctx.see([{ q: 'sheltered', op: '>=', v: 0.8 }])
  const tapado = ctx.q(args.cubierta, 'covers')

  // ✗ 3 — no existe `place`/`Blueprint` (ADR 0032): no hay forma de declarar
  //   una obra de varios cuerpos con posiciones relativas. Solo `put` de a uno.
  yield ctx.place({ blueprint: 'techo', at: ctx.self.at })

  // ✗ 4 — 'cavar' tampoco es ProcessId, así que la otra forma obvia de
  //   refugio —un hoyo, una cueva— tampoco se puede.
  yield ctx.apply('cavar', { ground: args.cubierta, actor: args.cubierta })

  return done()
}

// ── LO QUE COMPILA Y MIENTE ────────────────────────────────────────────────
// Apilar sí compila: `put(b, at, { onTopOf })` existe y la ley 8 sostiene.
// O sea que la criatura PUEDE construir la cosa con forma de techo, y no
// puede saber —ni el mundo puede decirle— que la tapa. Se comporta «como si
// funcionara» por fe del autor, no por física: deja la fibra abajo y la
// fibra se moja igual. El compilador no lo atrapa; la grilla tampoco, porque
// sin lluvia no hay escenario adverso donde falle.
//
// Y hay un techo estructural adicional: postes + travesaño + cubierta es
// profundidad 3 de ensamble contra MAX_ASSEMBLY_DEPTH = 2, cota que el propio
// apéndice admite que no está verificada en ningún test.
export function* apilarYCreerQueTapa(
  ctx: Ctx,
  args: { postes: readonly BodyView[]; cubierta: BodyView },
): Generator<Intent, Outcome, StepResult> {
  const poste = args.postes[0]
  if (!poste) return fail('sin postes')
  const r = yield ctx.put(args.cubierta, poste.at, { onTopOf: poste })
  if (r.status !== 'done') return fail('no se apoyó')
  ctx.memory.set('miTecho', args.cubierta.id)
  return done(args.cubierta)
}
