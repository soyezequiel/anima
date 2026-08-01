/**
 * LA ABLACIÓN — punto 4 del criterio.
 *
 * > una **precondición espuria se borra** por ablación
 *
 * El sujeto es `sostener`, y no se eligió por cómodo: **chequea su precondición
 * en código** —`if (ctx.q(args.que, 'portable') < 1) return fail(...)`— así que
 * es un control negativo con la respuesta conocida de antemano. La ablación
 * TIENE que decir que no es espuria, y si dijera lo contrario el que está roto
 * es el juez.
 *
 * El control positivo se fabrica: se le agrega al contrato una precondición que
 * la habilidad **nunca lee**. La ablación tiene que encontrarla.
 *
 * Los dos sobre la misma habilidad y la misma máquina. Un juez que sólo acierta
 * el caso que le conviene no sirve.
 */

import { buildSeedPhysics } from '@anima/physics'
import { Contexto, Partida } from '@anima/perceive'
import type { BodyView } from '@anima/skills'
import { CONTRATO_SOSTENER, sostener } from '@anima/skills/innatas'
import type { Contrato } from '@anima/skills/innatas'
import { describe, expect, it } from 'vitest'
import { ablacionar, correrEn } from '../src/ablacion.js'
import type { Sujeto } from '../src/ablacion.js'
import { bancoDe } from '../src/banco.js'
import { EL_ACTOR } from '../src/escena.js'

const phys = buildSeedPhysics()

/**
 * Los args de `sostener`, mirando el mundo.
 *
 * Es el hueco medido del encabezado de `ablacion.ts` hecho carne: el juez no
 * puede adivinar que esta habilidad pide `{ que: BodyView }`, así que lo trae
 * quien acusa. Se elige el cuerpo que NO es la criatura, que en esta escena es
 * exactamente uno.
 */
function argsDeSostener(p: Partida): { que: BodyView } | undefined {
  const ctx = new Contexto(p.proyeccion, { actor: EL_ACTOR, rng: p.dado.tirar, lugares: p.lugares }).ctx
  const otros = ctx.see([]).filter((b) => b.id !== `${EL_ACTOR}-cuerpo`)
  return otros[0] === undefined ? undefined : { que: otros[0] }
}

const sujetoDe = (contrato: Contrato): Sujeto<{ que: BodyView }> => ({
  acusada: { nombre: contrato.nombre, contrato },
  skill: sostener,
  argsDe: argsDeSostener,
})

describe('ANTES DE ABLACIONAR: ¿la habilidad corre?', () => {
  it('`sostener` LLEGA en el mundo holgado — si no, todo lo de abajo mide aire', () => {
    const banco = bancoDe(CONTRATO_SOSTENER, phys)
    const holgado = banco.find((m) => m.clase === 'holgado')
    expect(holgado, 'el banco no produjo mundo holgado').toBeDefined()

    const c = correrEn(sujetoDe(CONTRATO_SOSTENER), holgado!, phys)
    console.log(`\n    holgado (${holgado!.id.split('·')[2] ?? ''}) → ${c.desenlace} en ${String(c.ticks)} ticks`)
    expect(c.desenlace).toBe('llego')
  })

  it('y NO llega en el mundo que viola su precondición', () => {
    const banco = bancoDe(CONTRATO_SOSTENER, phys)
    const abajo = banco.find((m) => m.clase === 'justo-abajo')
    expect(abajo, 'el banco no produjo `justo-abajo`').toBeDefined()

    const c = correrEn(sujetoDe(CONTRATO_SOSTENER), abajo!, phys)
    console.log(`    justo-abajo (${abajo!.id.split('·')[2] ?? ''}) → ${c.desenlace} en ${String(c.ticks)} ticks`)
    expect(c.desenlace).not.toBe('llego')
  })
})

describe('EL CONTROL NEGATIVO: una precondición que la habilidad SÍ usa', () => {
  it('`portable>=1` no es espuria, y se sabía de antemano', () => {
    const r = ablacionar(sujetoDe(CONTRATO_SOSTENER), phys)
    console.log(`\n  ── sostener, tal como está escrita ──`)
    for (const a of r) console.log(`    ${a.precondicion.padEnd(14)} ${a.espuria ? 'ESPURIA' : 'la usa '} · ${a.porque}`)
    expect(r.length).toBe(1)
    expect(r[0]?.precondicion).toBe('portable>=1')
    expect(r[0]?.espuria).toBe(false)
  })
})

describe('EL CONTROL POSITIVO: una precondición que nadie lee', () => {
  /**
   * `moisture<0.9` no aparece en una sola línea de `sostener.ts`. La habilidad
   * mira `portable`, `heldBy`, `capacity` y `calories`, y nada más.
   *
   * Se eligió una cualidad que el catálogo puede violar sin violar `portable`,
   * porque si no el banco no puede armar el mundo aislado y la ablación diría
   * «NO SE PROBÓ» en vez de «espuria» — que es un resultado distinto y correcto,
   * pero no es el que este control quiere.
   */
  const CON_UNA_FALSA: Contrato = {
    ...CONTRATO_SOSTENER,
    precondiciones: [
      ...CONTRATO_SOSTENER.precondiciones,
      { sujeto: 'el-objetivo', q: 'moisture', op: '<', v: 0.9 },
    ],
  }

  it('la ablación la encuentra', () => {
    const r = ablacionar(sujetoDe(CON_UNA_FALSA), phys)
    console.log(`\n  ── sostener con una precondición inventada ──`)
    for (const a of r) {
      console.log(`    ${a.precondicion.padEnd(14)} ${a.espuria ? 'ESPURIA' : 'la usa '} · ${a.porque}`)
      for (const c of a.corridas) console.log(`        ${c.mundo} → ${c.desenlace}`)
    }

    const falsa = r.find((a) => a.precondicion === 'moisture<0.9')
    const buena = r.find((a) => a.precondicion === 'portable>=1')
    expect(falsa?.espuria, 'no encontró la inventada').toBe(true)
    // Y la de verdad NO se marca: un ablacionador que marca todo no ablaciona.
    expect(buena?.espuria, 'marcó como espuria la que sí se usa').toBe(false)
  })
})

/**
 * SINTETIZAR Y ABLACIONAR FALLAN EN PUNTAS OPUESTAS, y el primer intento de
 * escribir este bloque lo tuvo al revés.
 *
 * Se probó `toxicity>=0.6` esperando un «NO SE PROBÓ», razonando que el catálogo
 * llega a 0,55 y por lo tanto no hay con qué. **Esa cuenta vale para sintetizar,
 * no para ablacionar**, y son la operación inversa:
 *
 * | | busca materia que… | falla cuando… |
 * |---|---|---|
 * | sintetizar | **cumpla** el predicado | nadie llega — `toxicity>=0.6` |
 * | ablacionar | **lo viole** | nadie lo viola — `toxicity>=0` |
 *
 * O sea que un predicado imposible es el MÁS fácil de ablacionar: lo viola todo
 * el catálogo. Los dos casos están abajo, y el error queda escrito porque es la
 * clase de simetría falsa que se cuela sola.
 */
describe('las dos puntas: lo imposible y lo universal', () => {
  const con = (p: Contrato['precondiciones'][number]): Contrato => ({
    ...CONTRATO_SOSTENER,
    precondiciones: [...CONTRATO_SOSTENER.precondiciones, p],
  })

  it('un predicado que NADIE cumple es espurio, y bien: la habilidad anda sin él', () => {
    // `toxicity>=0.6` no lo alcanza ninguna materia (techo 0,55). Que el contrato
    // lo pida y la habilidad ande igual quiere decir exactamente lo que la
    // ablación dice: no lo estaba usando.
    const r = ablacionar(sujetoDe(con({ sujeto: 'el-objetivo', q: 'toxicity', op: '>=', v: 0.6 })), phys)
    const a = r.find((x) => x.precondicion === 'toxicity>=0.6')
    console.log(`\n    toxicity>=0.6 (nadie lo cumple) → ${a?.espuria === true ? 'ESPURIA' : 'la usa'}`)
    expect(a?.espuria).toBe(true)
  })

  it('un predicado que TODOS cumplen sale «NO SE PROBÓ», no «no espuria»', () => {
    // `toxicity>=0` lo cumple toda la materia, así que **no hay mundo que lo
    // viole** y no hay nada que correr. Declararlo «no espurio» sería el verde
    // por omisión que este hito viene encontrando en todos lados. Se distingue.
    const r = ablacionar(sujetoDe(con({ sujeto: 'el-objetivo', q: 'toxicity', op: '>=', v: 0 })), phys)
    const a = r.find((x) => x.precondicion === 'toxicity>=0')
    console.log(`    toxicity>=0 (lo cumplen todos) → ${a?.porque ?? '?'}`)
    expect(a?.porque).toContain('NO SE PROBÓ')
    expect(a?.corridas).toEqual([])
    expect(a?.espuria).toBe(false)
  })
})

describe('DETERMINISMO: ablacionar dos veces da lo mismo', () => {
  it('mismo veredicto y mismos ticks', () => {
    const a = ablacionar(sujetoDe(CONTRATO_SOSTENER), phys)
    const b = ablacionar(sujetoDe(CONTRATO_SOSTENER), phys)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })
})
