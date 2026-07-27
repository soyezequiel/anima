// TANDA 3 · capacidad 2 — «dejar-marcas-que-ella-misma-lee»
// Dos versiones: la natural (marca CON significado) y la degenerada (la que sí
// compila, y por qué miente).

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

// ── (1) NATURAL: dejar una marca que SIGNIFICA algo ──────────────────────────
export function* dejarMarcaConSignificado(
  ctx: Ctx,
  args: { vara: BodyView; aqui: Cell },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('marcar')
  yield ctx.put(args.vara, args.aqui)
  ctx.mark(args.aqui, 'el-rio-esta-al-este') // ← esperado: TS2339
  return done()
}

// ── (2) NATURAL: recuperar el significado meses después ──────────────────────
export function* leerMarca(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('recordar')
  const marcas = ctx.recall([{ q: 'charred', op: '>=', v: 0.8 }])
  const m = marcas[0]
  if (!m) return fail('no recuerdo ninguna marca')
  const queQuiseDecir = m.tag // ← esperado: TS2339
  const cuandoLaPuse = m.tick // ← esperado: TS2339
  const cuerpo: BodyView = m.what // ← esperado: TS2339
  yield ctx.goTo(m.at)
  return done(cuerpo) && queQuiseDecir === cuandoLaPuse ? done() : done()
}

// ── (3) DEGENERADA: la que SÍ compila ────────────────────────────────────────
// El significado no vive en el mundo: vive en `ctx.memory`, que es del ejecutor
// y no del lugar. El cuerpo puesto es decorativo — nadie puede leerlo como marca.
export function* dejarMarcaQueCompila(
  ctx: Ctx,
  args: { vara: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('marcar')
  yield ctx.put(args.vara, ctx.self.at)
  const previas = ctx.memory.get<{ at: Cell; dice: string }[]>('marcas') ?? []
  ctx.memory.set('marcas', previas.concat([{ at: ctx.self.at, dice: 'rio-al-este' }]))
  return done()
}
