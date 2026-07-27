// TANDA 3 · las versiones DEGENERADAS, aisladas para confirmar que typechequean.
// Compilan las tres. Ninguna hace lo que la capacidad pide.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

// (2) marca: el cuerpo puesto es decorativo, el significado vive en ctx.memory.
export function* marcaDegenerada(
  ctx: Ctx,
  args: { vara: BodyView },
): Generator<Intent, Outcome, StepResult> {
  yield ctx.put(args.vara, ctx.self.at)
  const previas = ctx.memory.get<{ at: Cell; dice: string }[]>('marcas') ?? []
  ctx.memory.set('marcas', previas.concat([{ at: ctx.self.at, dice: 'rio-al-este' }]))
  const leidas = ctx.memory.get<{ at: Cell; dice: string }[]>('marcas') ?? []
  const primera = leidas[0]
  if (primera) yield ctx.goTo(primera.at)
  return done()
}

// (4) explore rebanado: compila, pero entre rebanadas solo puede mirar afuera.
export function* busquedaRebanadaDegenerada(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  for (let i = 0; i < 20; i++) {
    const r = yield ctx.explore({
      until: (v) => v.see([{ q: 'wet', op: '>=', v: 0.9 }]).length > 0,
      maxTicks: 20,
    })
    if (r.status === 'found') return done()
  }
  return fail('nada')
}

// (5) carbón: compila entero, y las dos lecturas clave son mentira o ruido.
export function* carbonDegenerado(
  ctx: Ctx,
  args: { fogata: BodyView; tapa: BodyView },
): Generator<Intent, Outcome, StepResult> {
  const oxi = ctx.q(args.fogata, 'oxygen') // el del cuerpo, no el de la celda
  yield ctx.put(args.tapa, args.fogata.at, { onTopOf: args.fogata }) // apila, no tapa
  const listo = ctx.q(args.fogata, 'charred') >= 0.8
  if (!listo || oxi > 1e9) return fail('todavía no')
  yield ctx.take(args.tapa)
  const residuo = ctx.see([{ q: 'charred', op: '>=', v: 0.8 }])[0]
  return residuo ? done(residuo) : fail('ceniza')
}

// (3) aviso: lo único que sobrevive es el compromiso, sin número y sin respuesta.
export function* avisoDegenerado(
  ctx: Ctx,
  args: { a: BodyView; b: BodyView; binder: BodyView },
): Generator<Intent, Outcome, StepResult> {
  const plan = ctx.apply('union', { a: args.a, b: args.b, binder: args.binder })
  if (plan.commitment !== 'reversible') ctx.say('esto es caro, aviso')
  const r = yield plan
  return r.status === 'done' ? done() : fail('no salió')
}
