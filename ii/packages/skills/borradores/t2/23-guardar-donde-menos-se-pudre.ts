// Tanda 2 · capacidad «guardar-donde-menos-se-pudre» — SONDA IDEAL.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export function* guardarDondeMenosSePudre(
  ctx: Ctx,
  args: { excedente: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('elegir-lugar')

  // (1) Comparar LUGARES por humedad y temperatura. `recall` filtra por
  //     cualidad y devuelve `PlaceMemory`, que sólo tiene `at`: no se puede
  //     ordenar por «cuán seco», ni saber de cuándo es ese recuerdo.
  const secos = ctx.recall([{ q: 'wet', op: '<=', v: 0.1 }])
  const ranking = secos
    .map((p) => ({ at: p.at, humedad: p.q('wet'), temperatura: p.q('temperature'), visto: p.atTick }))
    .sort((a, b) => a.humedad * a.temperatura - b.humedad * b.temperatura)

  const elegido = ranking[0]
  if (!elegido) return fail('no recuerdo ningún lugar seco')

  // (2) Y el lugar donde estoy parada, del que no hay ningún cuerpo que
  //     preguntar: es una celda vacía.
  const acaHumedad = ctx.qAt(ctx.self.at, 'wet')
  const acaTemp = ctx.qAt(ctx.self.at, 'temperature')
  if (acaHumedad * acaTemp <= elegido.humedad * elegido.temperatura) {
    yield ctx.put(args.excedente, ctx.self.at)
    ctx.memory.set('deposito', { at: ctx.self.at, id: args.excedente.id })
    return done()
  }

  ctx.phase('llevar')
  const ir = yield ctx.goTo(elegido.at)
  if (ir.status !== 'arrived') return fail('no llegué al lugar seco')
  yield ctx.put(args.excedente, elegido.at)
  ctx.memory.set('deposito', { at: elegido.at, id: args.excedente.id, desdeTick: ctx.tick })

  // (3) Volver antes de que se pase: `decay` del cuerpo sí es legible, pero
  //     sólo si el cuerpo está a la vista. A distancia no hay forma.
  ctx.phase('vigilar')
  const guardado = ctx.memory.get<{ at: Cell; id: string; desdeTick: number }>('deposito')
  if (!guardado) return done()
  if (ctx.tick - guardado.desdeTick > 600) {
    const vuelta = yield ctx.goTo(guardado.at)
    if (vuelta.status !== 'arrived') return fail('no volví')
    const ahi = ctx.see([]).find((b) => b.id === guardado.id)
    if (ahi && ctx.q(ahi, 'decay') < 0.5 && chebyshev(ahi.at, guardado.at) === 0) {
      yield ctx.take(ahi)
    }
  }
  return done()
}
