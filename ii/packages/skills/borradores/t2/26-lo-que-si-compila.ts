// Tanda 2 · residuo: lo que la superficie ACTUAL sí deja expresar.
// Todo este archivo compila. Se escribe para que el veredicto no exagere.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* residuoTanda2(
  ctx: Ctx,
  args: { con: BodyView; excedente: BodyView },
): Generator<Intent, Outcome, StepResult> {
  // (a) «¿esto está ardiendo?» NO necesita el HUECO 4: sale de tres cualidades
  //     declaradas y de la compuerta que la ley 3 publica en el documento.
  const arde = (b: BodyView): boolean =>
    ctx.q(b, 'temperature') >= ctx.q(b, 'ignitionPoint') && ctx.q(b, 'moisture') < 0.45
  const fuegos = ctx.see([]).filter(arde)

  // (b) «¿mi aparejo dejó de servir?» tampoco necesita ver juntas: `catch` y
  //     `reach` son cualidades DERIVADAS y `ctx.q` las acepta.
  const enganche = ctx.q(args.con, 'catch')
  const alcance = ctx.q(args.con, 'reach')
  const sirve = enganche > 0 && alcance >= 2

  // (c) `ctx.q` acepta CUALQUIER `QualityId`, incluida 'stock' — el número
  //     secreto del dios. Esto compila, y contradice «ver agua no revela el
  //     stock» del propio documento.
  const agua = ctx.see([{ q: 'wet', op: '>=', v: 0.9 }])[0]
  const pecesQueQuedan = agua ? ctx.q(agua, 'stock') : 0

  // (d) soltar-en-el-piso TIPA (no está dicho que SIGNIFIQUE soltar).
  const miCelda: Cell = { x: ctx.self.at.x, y: ctx.self.at.y }
  const soltar = yield ctx.put(args.excedente, miCelda)
  if (soltar.status !== 'done') return fail('put no soltó')

  // (e) el commitment de una intención es legible ANTES de entregarla.
  const irreversible = ctx.goTo(miCelda).commitment === 'irreversible'

  // (f) `recall` filtra lugares por cualidad, pero devuelve sólo coordenadas:
  //     se puede quedar con el más cercano, nunca con el más seco.
  const secos = ctx.recall([{ q: 'wet', op: '<=', v: 0.1 }])
  const cerca = secos
    .map((p) => ({ at: p.at, d: Math.abs(p.at.x - ctx.self.at.x) + Math.abs(p.at.y - ctx.self.at.y) }))
    .sort((a, b) => a.d - b.d)[0]

  if (!sirve || fuegos.length > 0 || pecesQueQuedan <= 0 || irreversible || !cerca) return done()
  return done(args.con)
}
