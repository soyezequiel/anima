// TANDA 4 · «Sabe defenderse de algo que la quiere a ella» — SONDA.

import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* ponerDistanciaConLoQueLaPersigue(
  ctx: Ctx,
  args: { vara: import('../../src/skill-api.js').BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('detectar')

  // ✗ 1 — no hay cualidad que diga «esto es un bicho y viene hacia mí».
  //   La fauna es `{ q: 'stock', op: '>', v: 0 }` dentro de un cuerpo de agua:
  //   un número, no un cuerpo. No hay 'threat', ni 'alive', ni velocidad.
  const bicho = ctx.see([{ q: 'threat', op: '>', v: 0 }])[0]
  if (!bicho) return fail('no veo peligro')

  // ✗ 2 — 'afilar' no es ProcessId (HUECO 2). `sharpness` existe como
  //   cualidad con ley, pero NINGÚN proceso invocable la sube: friccion mueve
  //   temperature, union junta, deshilachar parte al hilo, extraccion saca de
  //   un stock. Sin afilar no hay lanza.
  yield ctx.apply('afilar', { blank: args.vara, actor: args.vara })

  // ✗ 3 — no hay forma de saber si el otro se acerca entre tick y tick:
  //   BodyView no tiene velocidad ni rumbo (HUECO 4), y `see()` es una foto.
  if (ctx.velocityOf(bicho) > 0) ctx.say('me sigue')

  // ✗ 4 — «ponerse detrás del fuego» necesita línea de vista y ocupación:
  //   no hay geometría de bloqueo en Ctx.
  const refugio = ctx.behind(bicho, { of: args.vara })

  return done()
}

// ── LO QUE SÍ COMPILA ──────────────────────────────────────────────────────
// Correr compila: `goTo(cell)` con una celda lejana. Y elegir terreno
// también, porque 'footing' es cualidad derivada y existe. O sea: de las tres
// ramas de la conducta, la única expresable es huir — y huir de nada, porque
// no hay nada que persiga. La asimetría es total: `extraccion` deja que ella
// coma fauna; ninguna ley deja que la fauna la coma a ella.
export function* huirHaciaBuenPiso(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  const firme = ctx.see([{ q: 'footing', op: '>=', v: 0.8 }])[0]
  if (!firme) return fail('no hay dónde')
  const r = yield ctx.goTo(firme, { within: 0 })
  return r.status === 'arrived' ? done() : fail('no llegué')
}
