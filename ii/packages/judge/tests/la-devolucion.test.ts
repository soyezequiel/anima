/**
 * LA DEVOLUCIÓN QUE SE PUEDE USAR — Hito 8, la segunda mitad del punto 9.
 *
 * El porqué de las tres reglas está en `src/devolucion.ts`. Acá se afirma lo
 * único que importa: que la pista **diga qué arreglar** y que **no nombre ningún
 * mundo**.
 *
 * ─── Los dos controles ──────────────────────────────────────────────────────
 *
 *   · una habilidad SANA no genera pistas — si las generara, el mecanismo estaría
 *     inventando patrones donde no hay ninguno, que es peor que no tenerlo;
 *   · una habilidad cuyo fallo NO tiene forma de propiedad tampoco. Es el caso
 *     de `mentirosa`: su problema no es la materia, es que no mira nada.
 */

import { buildSeedPhysics } from '@anima/physics'
import { Contexto, Partida } from '@anima/perceive'
import type { BodyView, Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import { done, fail } from '@anima/skills'
import { CONTRATO_SOSTENER, sostener } from '@anima/skills/innatas'
import { describe, expect, it } from 'vitest'
import { bancoDe } from '../src/banco.js'
import { loQueTenianEnComun, pistasDe } from '../src/devolucion.js'
import { EL_ACTOR } from '../src/escena.js'
import { correrElBanco, juzgar } from '../src/juzgar.js'

const phys = buildSeedPhysics()

function argsDe(p: Partida): { que: BodyView } | undefined {
  const ctx = new Contexto(p.proyeccion, { actor: EL_ACTOR, rng: p.dado.tirar, lugares: p.lugares }).ctx
  const otros = ctx.see([]).filter((b) => b.id !== `${EL_ACTOR}-cuerpo`)
  return otros[0] === undefined ? undefined : { que: otros[0] }
}

/**
 * LA QUE SÓLO SABE AGARRAR VARAS.
 *
 * Es el sujeto que importa: **compila, corre, y resuelve un caso en vez del
 * problema**. Ningún desenlace de la puerta la distingue de una buena — hace
 * falta el juez, y hace falta que el juez diga POR QUÉ.
 */
function* soloVaras(ctx: Ctx, args: { que: BodyView }): Generator<Intent, Outcome, StepResult> {
  ctx.phase('solo-varas')
  const ir = yield ctx.goTo(args.que, { within: 1 })
  if (ir.status !== 'arrived') return fail('no llegué')
  if (!args.que.id.includes('/vara/')) return fail('esto no es una vara')
  const t = yield ctx.take(args.que)
  return t.status === 'done' ? done(args.que) : fail('no lo pude tomar')
}

/** La que dice que sí sin hacer nada. Su fallo NO tiene forma de propiedad. */
function* mentirosa(ctx: Ctx, args: { que: BodyView }): Generator<Intent, Outcome, StepResult> {
  ctx.phase('mentirosa')
  return done(args.que)
}

const s = (nombre: string, skill: unknown) =>
  ({ acusada: { nombre, contrato: CONTRATO_SOSTENER }, skill, argsDe }) as never

describe('LA PISTA DICE QUÉ ARREGLAR', () => {
  const cs = correrElBanco(s('soloVaras', soloVaras), phys)

  it('la que sólo sabe agarrar varas: la devolución lo nombra', () => {
    const dicho = loQueTenianEnComun(cs, CONTRATO_SOSTENER, phys)
    console.log(`\n  ${String(cs.filter((c) => !c.comoDebia).length)} de ${String(cs.length)} mal`)
    for (const d of dicho) console.log(`    ${d}`)

    expect(dicho.length).toBeGreaterThan(0)
    const todo = dicho.join(' ')
    // Nombra el eje, dice con qué SÍ anda, y lo dice en castellano.
    expect(todo).toContain('forma')
    expect(todo).toContain('vara')
    expect(todo).toContain('Estás resolviendo un caso')
  })

  it('y entra al cargo `construccion`, que es lo que viaja al encargo', () => {
    const d = juzgar(s('soloVaras', soloVaras), phys)
    const c = d.cargos.find((x) => x.cargo === 'construccion')
    console.log(`\n  ${c?.porque ?? ''}\n`)
    expect(c?.grado).toBe('no-promueve')
    expect(c?.porque).toContain('forma')
  })

  it('EL GUARDIÁN: no nombra ni un mundo del banco', () => {
    // Es la trampa del punto 9 llevada a este archivo: una pista que nombre un
    // mundo le enseña el banco en vez de la habilidad. Se afirma contra los ids
    // de verdad, no contra una lista escrita a mano.
    const dicho = loQueTenianEnComun(cs, CONTRATO_SOSTENER, phys).join(' ')
    for (const m of bancoDe(CONTRATO_SOSTENER, phys)) {
      expect(dicho.includes(m.id), `se filtró el mundo ${m.id}`).toBe(false)
    }
  })
})

describe('LOS CONTROLES: cuándo NO se dice nada', () => {
  it('una habilidad sana no genera ninguna pista', () => {
    // Sin este renglón, «la pista aparece» lo cumpliría un mecanismo que inventa
    // patrones siempre — y una devolución que le señala un problema a quien no
    // lo tiene es peor que no tener devolución.
    const cs = correrElBanco(s('sostener', sostener), phys)
    expect(cs.filter((c) => !c.comoDebia).length).toBe(0)
    expect(pistasDe(cs, CONTRATO_SOSTENER, phys)).toEqual([])
  })

  it('y una cuyo fallo NO es de la materia tampoco: `mentirosa`', () => {
    // Falla en 5 mundos y ninguna propiedad los separa: su único acierto entre
    // los adversos es `sin-nada`, que no tiene materia con qué contrastar.
    // Decirlo así es más honesto que inventarle una correlación.
    const cs = correrElBanco(s('mentirosa', mentirosa), phys)
    const mal = cs.filter((c) => !c.comoDebia)
    console.log(`\n  mentirosa: ${String(mal.length)} mal · pistas: ${String(pistasDe(cs, CONTRATO_SOSTENER, phys).length)}\n`)
    expect(mal.length).toBeGreaterThan(0)
    expect(pistasDe(cs, CONTRATO_SOSTENER, phys)).toEqual([])

    // Y aun así el cargo dice algo accionable, por otro camino: nombra el
    // contrato que ella misma publicó.
    const c = juzgar(s('mentirosa', mentirosa), phys).cargos.find((x) => x.cargo === 'construccion')
    expect(c?.porque).toContain('su propio contrato')
  })
})
