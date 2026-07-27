// Tanda 2 · capacidad «retirar-lo-suyo-del-alcance-del-fuego» — SONDA IDEAL.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

// ¿Está ardiendo? La ley 3 no se expone; se INFIERE de cualidades declaradas.
function arde(ctx: Ctx, b: BodyView): boolean {
  return ctx.q(b, 'temperature') >= ctx.q(b, 'ignitionPoint') && ctx.q(b, 'moisture') < 0.45
}

export function* retirarLoSuyoDelFuego(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('mirar-el-fuego')

  const ardiendo = ctx.see([]).filter((b) => arde(ctx, b))
  if (ardiendo.length === 0) return done()

  // (1) ¿Cuánto calor llega a la celda donde dejé mis cosas? No hay campo
  //     térmico consultable: sólo la temperatura de un CUERPO.
  const foco = ardiendo[0]
  if (!foco) return fail('no hay foco')
  const calorEnMiCelda = ctx.qAt(ctx.self.at, 'temperature')

  // (2) ¿Estoy YO por recalentarme?  HUECO 5.
  const miTemperatura = ctx.q(ctx.self, 'temperature')
  if (miTemperatura > 39 || calorEnMiCelda > 60) {
    const lejos: Cell = { x: ctx.self.at.x + 3, y: ctx.self.at.y }
    yield ctx.goTo(lejos)
  }

  // (3) Retirar lo mío: lo que tengo en la mano se puede leer.
  ctx.phase('retirar')
  for (const mio of ctx.self.holding) {
    const margen = ctx.q(mio, 'ignitionPoint') - ctx.q(mio, 'temperature')
    if (margen > 40) continue
    const destino: Cell = { x: foco.at.x + 4, y: foco.at.y + 4 }
    // ¿Es una celda donde se puede pisar/apoyar algo? No hay forma de saberlo.
    const r = yield ctx.put(mio, destino)
    if (r.status !== 'done') return fail('no pude retirarlo')
  }

  // (4) Lo que NO tengo en la mano y dejé cerca del fuego: `recall` devuelve
  //     lugares sin contenido, así que sólo sirve lo que esté a la vista.
  for (const suelto of ctx.see([{ q: 'portable', op: '>', v: 0 }])) {
    if (chebyshev(suelto.at, foco.at) > 2) continue
    if (!ctx.mine(suelto)) continue
    yield ctx.take(suelto)
  }
  return done()
}
