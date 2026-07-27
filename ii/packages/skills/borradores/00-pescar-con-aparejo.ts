// Borrador 0 — el ejemplo del propio documento de arquitectura.
// Test de humo del `skill-api.d.ts`.
//
// Fuente: docs/architecture/remake-anima-ii.md, «La API que ve el código
// generado (firmas reales)».
//
// ─── HALLAZGO 1: el ejemplo de referencia NO COMPILA como está publicado ────
//
// Copiado literal, `tsc` tira tres errores bajo `noUncheckedIndexedAccess`,
// que es la configuración que Ánima I ya usa hoy (tsconfig.base.json:8):
//
//   28:26 TS18048  'agua' is possibly 'undefined'
//   29:29 TS2345   'BodyView | undefined' no es asignable a 'BodyView | Cell'
//   36:63 TS2322   'BodyView | undefined' no es asignable a 'BodyView'
//
// Causa: `ctx.see(...)[0]` es `BodyView | undefined`, y la reasignación
// después del `explore` no estrecha el tipo. Hizo falta agregar la guarda
// marcada abajo con «AGREGADO».
//
// Por qué importa: el documento presenta este código como «del tipo que el
// modelo escribe bien». Si el ejemplo canónico —escrito por nosotros, sin
// apuro— no pasa el compilador, el presupuesto de «10 reparaciones
// deterministas sin gastar viaje» del Hito 8 está estimado sobre una muestra
// optimista. `see()[0]` va a ser el error más frecuente del corpus generado, y
// conviene resolverlo en la API (un `seeFirst(w): BodyView | null`, o que
// `see()` devuelva un tipo con acceso seguro) en vez de esperar que cada
// habilidad se acuerde de la guarda.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../src/skill-api.js'
import { done, fail } from '../src/skill-api.js'

export function* pescarConAparejo(
  ctx: Ctx,
  args: { con: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('buscar-agua')
  let agua = ctx.see([{ q: 'wet', op: '>=', v: 0.9 }])[0]
  if (!agua) {
    const r = yield ctx.explore({
      until: (v) => v.see([{ q: 'wet', op: '>=', v: 0.9 }]).length > 0,
      maxTicks: 400,
    })
    if (r.status !== 'found') return fail('no encontré agua')
    agua = ctx.see([{ q: 'wet', op: '>=', v: 0.9 }])[0]
    if (!agua) return fail('encontré agua y se me perdió') // AGREGADO — ver HALLAZGO 1
  }

  ctx.phase('ir')
  ctx.memory.set('pozo', agua.at)
  const ir = yield ctx.goTo(agua, { within: 1 })
  if (ir.status !== 'arrived') return fail('no llegué')

  ctx.phase('pescar')
  const yaIntenté = ctx.memory.get<number>('intentos') ?? 0
  for (let i = yaIntenté; i < 40; i++) {
    ctx.memory.set('intentos', i)
    const o = yield ctx.apply('extraccion', { gear: args.con, source: agua })
    if (o.got.length > 0) {
      ctx.memory.del('intentos')
      return done(o.got[0])
    }
  }
  return fail('no picó')
}
