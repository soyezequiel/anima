// TANDA 3 · capacidad 5 — «tapar-la-fogata-para-hacer-carbon»
// La técnica emblema del documento: bajar el oxígeno de la CELDA para que la
// ley 4 dé residuo carbonoso en vez de mineral.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* taparLaFogata(
  ctx: Ctx,
  args: { fogata: BodyView; tapa: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('tapar')

  // (A) LO QUE COMPILA Y MIENTE: `oxygen` es QualityId, así que esto typechequea.
  //     Pero pregunta el oxígeno del CUERPO, y la ley 4 lee `w.oxygenAt(b.at)`,
  //     que es el de la CELDA. Son dos números distintos con el mismo nombre.
  const oxiDelCuerpo = ctx.q(args.fogata, 'oxygen')

  // (B) LO QUE HARÍA FALTA: leer la cualidad de una celda. No existe.
  const oxiDeLaCelda = ctx.qAt(args.fogata.at, 'oxygen') // ← esperado: TS2339

  // (C) TAPAR. `put` apila (`onTopOf`); en ningún lado dice que apilar tape.
  //     No hay `covering`, no hay arrangement 'inside' del lado de la habilidad.
  yield ctx.put(args.tapa, args.fogata.at, { onTopOf: args.fogata }) // compila
  yield ctx.put(args.tapa, args.fogata.at, { covering: args.fogata }) // ← esperado: TS2353

  // (D) esperar a que `charred` pase 0.8 — la lectura SÍ se expresa,
  //     la espera no (ver borrador 01, hueco de `ctx.wait`).
  ctx.phase('esperar')
  while (ctx.q(args.fogata, 'charred') < 0.8) {
    yield ctx.wait(30) // ← esperado: TS2339
  }
  if (oxiDeLaCelda >= 0.35 || oxiDelCuerpo < 0) return fail('quedó ceniza')

  // (E) destapar a tiempo y recuperar el residuo. Esto sí se expresa.
  ctx.phase('destapar')
  yield ctx.take(args.tapa)
  const residuo = ctx.see([{ q: 'charred', op: '>=', v: 0.8 }])[0]
  if (!residuo) return fail('no quedó nada')
  const donde: Cell = residuo.at
  yield ctx.goTo(donde)
  yield ctx.take(residuo)
  return done(residuo)
}
