// TANDA 3 · capacidad 4 — «cortar-la-busqueda-cuando-cambia-la-urgencia»
// Abandonar un explore de 400 ticks si cruza el hambre o se larga a llover.

import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

// ── (1) NATURAL: el corte va en el `until` del propio explore ────────────────
export function* buscarConCorte(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('buscar')
  const r = yield ctx.explore({
    until: (v) =>
      v.see([{ q: 'wet', op: '>=', v: 0.9 }]).length > 0 ||
      v.self.stamina < 8 || // ← esperado: TS2339 (PerceptionView no tiene self)
      v.need.energy > 0.8 || // ← esperado: TS2339
      v.wetAt(v.self.at) > 0.5, // ← esperado: TS2339 (no hay cualidad de celda)
    maxTicks: 400,
  })
  return r.status === 'found' ? done() : fail('nada')
}

// ── (2) NATURAL: interrumpir una intención ya entregada ──────────────────────
export function* buscarConAborto(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  const i = ctx.explore({ until: () => false, maxTicks: 400 })
  yield i
  ctx.abort(i) // ← esperado: TS2339 — no hay forma de interrumpir en vuelo
  return done()
}

// ── (3) DEGENERADA: rebanar el explore y chequear entre rebanadas ────────────
// COMPILA. Y es inútil: lo único que puede chequear entre rebanadas es la
// percepción, que es justo lo que NO cambió de urgencia.
export function* buscarRebanado(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('buscar')
  for (let i = 0; i < 20; i++) {
    const r = yield ctx.explore({
      until: (v) => v.see([{ q: 'wet', op: '>=', v: 0.9 }]).length > 0,
      maxTicks: 20,
    })
    if (r.status === 'found') return done()
    // acá querría preguntar «¿sigo teniendo tiempo?». No hay a quién.
    const cansada = ctx.self.stamina < 8 // ← esperado: TS2339
    if (cansada) return fail('me quedé sin aliento')
  }
  return fail('nada')
}
