// TANDA 4 · «Sabe mover lo que no puede levantar» — SONDA DE COMPILACIÓN.

import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* moverLoQueNoEntraEnLasManos(
  ctx: Ctx,
  args: { tronco: import('../../src/skill-api.js').BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('evaluar')

  // ✓ DETECTAR el problema sí compila: 'portable' es cualidad derivada.
  if (ctx.q(args.tronco, 'portable') >= 1) {
    yield ctx.take(args.tronco)
    return done(args.tronco)
  }

  // ✗ 1 — 'arrastrar' no es ProcessId. Tampoco 'rodar', ni 'empujar'.
  yield ctx.apply('arrastrar', { load: args.tronco, actor: args.tronco })

  // ✗ 2 — no hay primitiva de empuje en Ctx: hay take/put/goTo/apply/explore.
  yield ctx.drag(args.tronco, { x: 4, y: 9 })

  // ✗ 3 — la flotación no es ninguna de las 26 cualidades, así que «tirarlo
  //   al río para que baje» no se puede ni consultar.
  if (ctx.q(args.tronco, 'buoyancy') > 0.5) ctx.say('flota')

  // ✗ 4 — tampoco hay corriente: 'wet' dice mojado, no dice hacia dónde.
  const rio = ctx.see([{ q: 'flow', op: '>', v: 0 }])

  return fail('no lo puedo mover')
}

// ── LO QUE COMPILA Y NO ALCANZA ────────────────────────────────────────────
// `put(b, at)` acepta una celda arbitraria, así que la tentación es «poner»
// el tronco en la celda de al lado en bucle y llamarle arrastrar. Compila.
// Pero `put` presupone tener el cuerpo en las manos —lo que `take` acaba de
// negar— así que el mundo va a rechazar cada intención y la habilidad va a
// pasar el typecheck y morir en la grilla. Es el peor de los casos: no falla
// en el compilador, falla en el juez, y cuesta segundos de LLM.
export function* fingirArrastre(
  ctx: Ctx,
  args: { tronco: import('../../src/skill-api.js').BodyView },
): Generator<Intent, Outcome, StepResult> {
  for (let i = 0; i < 10; i++) {
    const r = yield ctx.put(args.tronco, { x: args.tronco.at.x + 1, y: args.tronco.at.y })
    if (r.status === 'rejected') return fail('no lo tengo en las manos')
  }
  return done()
}
