// TANDA 4 · «Sabe cuidar de vuelta» — SONDA DE COMPILACIÓN.
//
// Este archivo NO PRETENDE COMPILAR. Es el árbitro mecánico: cada bloque
// marcado con ✗ es un error de tipos, y el error ES el hallazgo.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* guardarleAlgoAlCuidador(
  ctx: Ctx,
  _args: Record<string, never>,
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('ver-si-esta')

  // ✗ 1 — no hay ninguna cualidad que distinga un agente de una piedra.
  //   'presence' no está en QualityId.
  const cuidador = ctx.see([{ q: 'presence', op: '>', v: 0 }])[0]

  // ✗ 2 — tampoco hay canal de escucha: `say` es de salida y no hay entrada.
  const ultimoMensaje = ctx.heard()

  // ✗ 3 — no hay forma de entregarle algo a nadie.
  if (cuidador) yield ctx.give(cuidador, ctx.self.holding[0])

  // ✗ 4 — no hay forma de NO comer algo que se está comiendo, porque no hay
  //   forma de comer: HUECO 8. Sin `eat`, «una porción que no tocó teniendo
  //   hambre» no es falsable desde una habilidad.
  yield ctx.eat(ctx.self.holding[0])

  // ✗ 5 — el motivo no puede salir de acá: `Ctx` no expone el NeedVector,
  //   así que una habilidad no puede siquiera LEER que tiene hambre para
  //   decidir aguantarse.
  if (ctx.needs.energy > 0.8) return fail('tengo demasiada hambre')

  return done()
}

// ── LO QUE SÍ COMPILA, Y POR ESO ES EL PELIGRO ─────────────────────────────
// Esto pasa `tsc` entero y es exactamente la trampa: `BodyView.name` es un
// string libre (`nameOf()` deriva sustancia+forma), así que el modelo puede
// escribir una habilidad que «reconoce al cuidador» comparando strings.
// Compila, se promueve, y miente: en el mundo no hay ningún cuerpo llamado
// así. Es `PROTECTED_KINDS = ['pet','food','tree']` renacido dentro de una
// habilidad, donde ningún validador del motor lo ve.
export function* guardarleAlgoAlCuidadorPeroMintiendo(
  ctx: Ctx,
): Generator<Intent, Outcome, StepResult> {
  const alguien = ctx.see([]).find((b: BodyView) => b.name === 'cuidador')
  if (!alguien) return fail('no está')
  const visto = ctx.memory.get<number>('ultimoVisto') ?? ctx.tick
  ctx.memory.set('ultimoVisto', ctx.tick)
  if (ctx.tick - visto > 600) ctx.say('te guardé esto')
  return done()
}
