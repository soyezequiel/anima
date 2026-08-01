/**
 * EL VEREDICTO — puntos 1 y 6 del criterio.
 *
 * > el juez evalúa **por separado**: plano · construcción · uso · utilidad. Un
 * > `BuildSkill` verde con `UseSkill` rojo es un resultado legítimo.
 *
 * > una habilidad que **sólo funciona donde la corrigieron** no promueve.
 *
 * Tres sujetos, y dos son mentirosos fabricados a propósito. Un juez que sólo
 * acierta con la habilidad honesta no sirve para nada — es exactamente el verde
 * por omisión que este hito viene encontrando en cada tramo.
 */

import { buildSeedPhysics, qualityOf } from '@anima/physics'
import { Contexto, Partida } from '@anima/perceive'
import type { BodyView, Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import { done, fail } from '@anima/skills'
import { CONTRATO_SOSTENER, sostener } from '@anima/skills/innatas'
import type { Contrato } from '@anima/skills/innatas'
import { describe, expect, it } from 'vitest'
import type { Sujeto } from '../src/ablacion.js'
import { EL_ACTOR } from '../src/escena.js'
import { bancoDe } from '../src/banco.js'
import { juzgar } from '../src/juzgar.js'
import type { Dictamen } from '../src/tipos.js'

const phys = buildSeedPhysics()

function argsDe(p: Partida): { que: BodyView } | undefined {
  const ctx = new Contexto(p.proyeccion, { actor: EL_ACTOR, rng: p.dado.tirar, lugares: p.lugares }).ctx
  const otros = ctx.see([]).filter((b) => b.id !== `${EL_ACTOR}-cuerpo`)
  return otros[0] === undefined ? undefined : { que: otros[0] }
}

type Args = { que: BodyView }
const sujeto = (
  nombre: string,
  skill: Sujeto<Args>['skill'],
  contrato: Contrato = CONTRATO_SOSTENER,
): Sujeto<Args> => ({ acusada: { nombre, contrato }, skill, argsDe })

function mostrar(d: Dictamen): void {
  console.log(`\n  ── ${d.habilidad} → ${d.grado.toUpperCase()} ──`)
  for (const c of d.cargos) {
    const n = c.corrida.mundos === 0 ? '' : ` [${String(c.corrida.aprobados)}/${String(c.corrida.mundos)}]`
    console.log(`    ${c.cargo.padEnd(13)} ${c.grado.padEnd(12)}${n}  ${c.porque}`)
  }
  if (d.regresiones.length > 0) {
    console.log(`    regresiones: ${d.regresiones.map((r) => `${r.semilla} (${r.queSeEspera})`).join(' · ')}`)
  }
}

describe('LA HONESTA: `sostener`, tal como está escrita', () => {
  const d = juzgar(sujeto('sostener', sostener), phys)

  it('los CUATRO cargos salen por separado, con su propio grado', () => {
    mostrar(d)
    expect(d.cargos.map((c) => c.cargo)).toEqual(['plano', 'construccion', 'uso', 'utilidad'])
    // Cuatro grados distintos posibles sobre la MISMA habilidad: es el punto 6.
    expect(new Set(d.cargos.map((c) => c.grado)).size).toBeGreaterThan(1)
  })

  it('llega donde debe y se planta donde no debe', () => {
    const c = d.cargos.find((x) => x.cargo === 'construccion')
    expect(c?.grado).toBe('promueve')
    expect(c?.corrida.adversos).toBeGreaterThan(0)
    expect(c?.corrida.adversosAprobados).toBe(c?.corrida.adversos)
  })

  it('y su promesa se verifica CONTRA EL MUNDO, no contra lo que ella dice', () => {
    const u = d.cargos.find((x) => x.cargo === 'uso')
    expect(u?.grado).toBe('promueve')
    expect(u?.porque).toContain('verificadas contra el mundo')
  })

  it('`utilidad` sale `inconcluso`, y es el primer productor de ese grado', () => {
    expect(d.cargos.find((x) => x.cargo === 'utilidad')?.grado).toBe('inconcluso')
  })

  it('no siembra regresiones porque no falló nada', () => {
    expect(d.regresiones).toEqual([])
  })
})

/**
 * LA MENTIROSA. Dice que sí y no hace nada.
 *
 * Es el control que justifica el cargo `uso` entero: hasta este tramo el juez
 * leía `outcome.ok`, o sea **lo que la habilidad dice de sí misma**, y esta
 * habilidad pasaba completa.
 */
function* mentirosa(_ctx: Ctx, _args: Args): Generator<Intent, Outcome, StepResult> {
  return done()
}

describe('LA MENTIROSA: dice que sí sin tocar el mundo', () => {
  const d = juzgar(sujeto('mentirosa', mentirosa), phys)

  it('el cargo `uso` la agarra', () => {
    mostrar(d)
    const u = d.cargos.find((x) => x.cargo === 'uso')
    expect(u?.grado).toBe('no-promueve')
    expect(u?.porque).toContain('DIJO QUE SÍ Y NO ES CIERTO')
    expect(u?.porque).toContain('holding')
  })

  it('y el dictamen entero NO promueve', () => {
    expect(d.grado).toBe('no-promueve')
  })

  it('además falla `construccion`: anduvo donde su contrato dice que no puede', () => {
    // Como devuelve `done()` siempre, «llega» hasta en los mundos adversos.
    const c = d.cargos.find((x) => x.cargo === 'construccion')
    expect(c?.grado).toBe('no-promueve')
    expect(c?.porque).toContain('su propio contrato dice que no puede')
  })
})

/**
 * LA SOBREAJUSTADA — el punto 1, y el sujeto se fabrica a propósito.
 *
 * Anda sólo con la materia exacta del mundo `holgado`. Es literalmente «funciona
 * donde la corrigieron»: en cuanto el banco le cambia la masa, se cae.
 */
function* sobreajustada(ctx: Ctx, args: Args): Generator<Intent, Outcome, StepResult> {
  // El número sale de la corrida real: el `holgado` de `sostener` es
  // `tuberculo/vara/1`. Cualquier otra cosa, y se rinde.
  if (ctx.q(args.que, 'mass') !== 1) return fail('esto no es lo que practiqué')
  return yield* sostener(ctx, args)
}

describe('LA SOBREAJUSTADA: sólo funciona donde la corrigieron (punto 1)', () => {
  const d = juzgar(sujeto('sobreajustada', sobreajustada), phys)

  it('NO PROMUEVE, y el porqué lo dice con esas palabras', () => {
    mostrar(d)
    const c = d.cargos.find((x) => x.cargo === 'construccion')
    expect(c?.grado).toBe('no-promueve')
    expect(c?.porque).toContain('SÓLO FUNCIONA DONDE LE CONVIENE')
  })

  it('y deja regresión de CADA mundo donde se cayó, no de uno', () => {
    // ─── Esta aserción cambió con el banco grande, y para mejor ────────────
    //
    // Antes decía `regresiones[0].semilla` contiene 'al-borde', que era frágil:
    // afirmaba CUÁL mundo salió primero, no la propiedad. Con el banco de 5
    // mundos había un solo `holgado` y era justamente el que esta habilidad
    // tiene aprendido, así que en su casa aprobaba.
    //
    // Con cuatro por clase deja de aprobar ahí: hoy caen 2 `holgado` y 2
    // `al-borde`. O sea que el banco grande **la caza en más lugares**, que es
    // exactamente para lo que se agrandó.
    const clases = d.regresiones.map((r) => r.semilla.split('·')[1] ?? '')
    console.log(`
    regresiones por clase: ${clases.join(', ')}`)
    expect(d.regresiones.length).toBeGreaterThan(1)
    // `al-borde` es la clase que caza al sobreajuste: cumple por el pelo, así
    // que una habilidad que depende de su margen se cae ahí.
    expect(clases).toContain('al-borde')
    // Y toda regresión nombra un mundo del banco de verdad, no una etiqueta.
    const ids = new Set(bancoDe(CONTRATO_SOSTENER, phys).map((m) => m.id))
    for (const r of d.regresiones) expect(ids.has(r.semilla), `${r.semilla} no está en el banco`).toBe(true)
  })

  it('EL CONTRASTE: la honesta pasa el mismo banco', () => {
    // Sin este renglón, «no promueve» podría ser que el banco es imposible.
    const honesta = juzgar(sujeto('sostener', sostener), phys)
    expect(honesta.cargos.find((x) => x.cargo === 'construccion')?.grado).toBe('promueve')
  })
})

describe('EL INJUZGABLE no siembra regresiones (punto 3, ahora desde el veredicto)', () => {
  it('un contrato que no se puede sintetizar corta antes de correr nada', () => {
    const imposible: Contrato = {
      ...CONTRATO_SOSTENER,
      nombre: 'pide-lo-que-no-existe',
      precondiciones: [{ sujeto: 'el-objetivo', q: 'toxicity', op: '>=', v: 0.6 }],
    }
    const d = juzgar(sujeto('pide-lo-que-no-existe', sostener, imposible), phys)
    mostrar(d)
    expect(d.grado).toBe('injuzgable')
    expect(d.regresiones).toEqual([])
    // Un solo cargo: no se juzga lo que no se pudo probar.
    expect(d.cargos.length).toBe(1)
  })
})

describe('DETERMINISMO', () => {
  it('juzgar dos veces da el mismo dictamen', () => {
    const a = juzgar(sujeto('sostener', sostener), phys)
    const b = juzgar(sujeto('sostener', sostener), phys)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })
})

describe('el catálogo no miente sobre la masa del holgado', () => {
  it('la sobreajustada se apoya en un número REAL, no en uno inventado', () => {
    // Si el banco cambiara de materia, `sobreajustada` dejaría de estar
    // sobreajustada y el test de arriba pasaría a verde por el motivo
    // equivocado. Se ancla acá.
    const q = qualityOf(
      { id: 'x', parts: [{ substance: 'tuberculo', mass: 1, q: {} }], joints: [], state: {}, form: 'vara' } as never,
      'mass',
      phys,
    )
    expect(q).toBe(1)
  })
})
