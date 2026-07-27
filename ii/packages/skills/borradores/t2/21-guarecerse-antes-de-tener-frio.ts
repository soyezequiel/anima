// Tanda 2 · capacidad «guarecerse-antes-de-tener-frio» — SONDA IDEAL.
//
// Se escribe como la escribiría el modelo si la superficie fuera la que la
// capacidad necesita. Los errores que tira `tsc` SON el resultado del ejercicio.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export function* guarecerseAntesDeTenerFrio(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('leer-el-reloj')

  // (1) ¿Cuánto falta para la noche?  HUECO 11.
  const faltaParaLaNoche = ctx.clock.ticksToNightfall
  const esDeNoche = ctx.clock.phase === 'noche'

  // (2) ¿Cómo estoy YO?  HUECO 5.
  const miTemperatura = ctx.q(ctx.self, 'temperature')
  const miStamina = ctx.self.stamina
  const miHambre = ctx.self.hunger

  // (3) ¿Cuánto me cuesta llegar al reparo? No hay estimador de costo de viaje;
  //     lo único expresable es aritmética sobre celdas.
  const fuegos = ctx.see([{ q: 'emitsPower', op: '>', v: 0 }])
  const fuego = fuegos[0]
  if (!fuego) return fail('no hay nada que caliente')
  const ticksDeViaje = chebyshev(ctx.self.at, fuego.at) * 2

  if (faltaParaLaNoche > ticksDeViaje + 30 && miTemperatura > 35 && !esDeNoche) {
    return done() // todavía hay luz y no tengo frío: sigo con lo mío
  }

  ctx.phase('ir-al-reparo')
  const ir = yield ctx.goTo(fuego, { within: 1 })
  if (ir.status !== 'arrived') return fail('no llegué al reparo')
  if (miStamina < 1 || miHambre > 0.8) ctx.say('llegué justo')
  return done()
}
