// TANDA 3 · capacidad 1 — «comer-ahora-o-esperar-la-coccion»
// Expresión NATURAL: comparar rendimiento de comer crudo ya vs. cocido en 300
// ticks, contra la stamina que le queda, y elegir.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* comerAhoraOEsperar(
  ctx: Ctx,
  args: { pieza: BodyView; fuego: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('evaluar')

  // (A) rendimiento actual: ESTO SÍ se expresa. `calories` es derivada.
  const ahora = ctx.q(args.pieza, 'calories')
  const veneno = ctx.q(args.pieza, 'toxicity')

  // (B) ¿cuánta stamina me queda? — `SelfView` no la tiene.
  const stamina1 = ctx.self.stamina // ← esperado: TS2339
  // y `self` no es un cuerpo, así que tampoco vale el camino largo:
  const stamina2 = ctx.q(ctx.self, 'stamina') // ← esperado: TS2345

  // (C) ¿cuánto hambre tengo? — no hay vector de necesidad en ninguna parte.
  const hambre = ctx.self.hunger // ← esperado: TS2339

  // (D) proyección: ¿cuánto rendiría en 300 ticks sobre el fuego?
  //     No hay simulación ni predicción; el 300 es un número cableado.
  const luego = ahora * 2.14

  if (stamina1 < 6 || hambre > 0.9) {
    // (E) comer. NO EXISTE.
    yield ctx.eat(args.pieza) // ← esperado: TS2339
    return done()
  }

  ctx.phase('esperar-coccion')
  yield ctx.put(args.pieza, args.fuego.at)
  while (ctx.q(args.pieza, 'digestibility') < 0.85) {
    // (F) tampoco hay forma de "esperar N ticks": no hay ctx.wait ni
    //     intención de espera. `explore` con until falso es el único bucle
    //     que consume ticks, y eso la hace caminar.
    yield ctx.wait(30) // ← esperado: TS2339
  }
  yield ctx.eat(args.pieza) // ← esperado: TS2339
  return stamina2 > 0 && veneno < 1 && luego > 0 ? done() : fail('nunca')
}
