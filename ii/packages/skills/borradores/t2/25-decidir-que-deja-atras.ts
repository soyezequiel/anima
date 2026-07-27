// Tanda 2 · capacidad «decidir-que-deja-atras» — SONDA IDEAL.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* decidirQueDejaAtras(
  ctx: Ctx,
  args: { monton: readonly BodyView[]; destino: Cell },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('ordenar-el-monton')

  // (1) ¿Cuántas manos tengo? La superficie no lo declara: `holding` es una
  //     lista sin tope. El «2» de «dos manos» sale de la cabeza del modelo.
  const manos = ctx.self.capacity

  // (2) Ordenar por lo que DESBLOQUEA. `can()` verifica roles Y arrangement
  //     contra el mundo, así que no puede responder «¿serviría si lo tuviera
  //     en la mano?» sobre algo que está en el piso.
  const utiles = args.monton
    .filter((b) => ctx.q(b, 'portable') > 0)
    .map((b) => ({
      b,
      sirve: ctx.qualifies('union', 'binder', b) || ctx.qualifies('extraccion', 'gear', b),
      masa: ctx.q(b, 'mass'),
    }))
    .sort((x, y) => Number(y.sirve) - Number(x.sirve) || x.masa - y.masa)

  const seLleva = utiles.slice(0, manos)
  const seQueda = utiles.slice(manos)

  ctx.phase('cargar')
  for (const u of seLleva) {
    const t = yield ctx.take(u.b)
    if (t.status !== 'done') return fail('no pude levantarlo')
  }

  // (3) Soltar lo que no entra en un lugar al que pueda volver. HUECO 9: no
  //     está dicho que `put` en la propia celda sea soltar, ni hay `drop`.
  ctx.phase('dejar-lo-que-no-entra')
  const acopio: Cell = { x: ctx.self.at.x, y: ctx.self.at.y }
  for (const u of seQueda) {
    if (ctx.self.holding.some((h) => h.id === u.b.id)) {
      const d = yield ctx.drop(u.b)
      if (d.status !== 'done') return fail('no pude soltarlo')
    }
  }
  ctx.memory.set('acopio', { at: acopio, ids: seQueda.map((u) => u.b.id), tick: ctx.tick })

  ctx.phase('viaje')
  const ir = yield ctx.goTo(args.destino)
  if (ir.status !== 'arrived') return fail('no llegué')
  for (const u of seLleva) yield ctx.put(u.b, args.destino)

  // (4) ¿Vuelvo por el resto? Depende de si me alcanza la stamina para otro
  //     viaje — y la stamina propia no es legible.
  if (ctx.self.stamina > 20 && seQueda.length > 0) {
    const vuelta = yield ctx.goTo(acopio)
    if (vuelta.status !== 'arrived') return fail('no pude volver al acopio')
  }
  return done()
}
