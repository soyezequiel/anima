// ═══ BORRADOR DE MEDICIÓN — se reescribe entero al final ════════════════════

import { describe, expect, it } from 'vitest'

import type { QualityId } from '@anima/physics'
// Los seis nombres que este archivo importaba y no usaba —`EXPOSICION`,
// `H_PERDIDA`, `T_AMBIENTE`, `Step`, `SCHEMA_INDEX` y `textoDe`— quedaron de
// cuando la medición despejaba la ley 1 a mano. Se los saca y no se los "usa
// para que compile": lo que este archivo mide hoy no los necesita, y un import
// muerto en un borrador es lo que puso `pnpm ii:typecheck` en exit 2.
import { formFactor, MONTAJES, qualityOf, specOf, SUSTANCIAS_SEMILLA, temperaturaDeEquilibrio } from '@anima/physics'
import { Contexto, Partida } from '@anima/perceive'
import type { ConstructionSchema, EsquemaDeLey, GoalNode, PlanResult } from '@anima/plan'
import { ESQUEMAS, EXPANSIONES_POR_TICK, FIRMA_DE_LO_COCIDO, firmaDe, implica, interpretar, plan } from '@anima/plan'
import type { WorldState } from '@anima/world'
import { apply, COSTO_POR_TOXICIDAD_Y_KILO, stepWorld, STAMINA_POR_CALORIA } from '@anima/world'

import { Creencias } from '../src/creencias.js'
import { sinVocabulario } from '../src/escalera.js'
import { Mente, vivir } from '../src/mente.js'
import { alientoDelEsquema } from '../src/oportunidades.js'
import type { VistaDeLaMente } from '../src/tipos.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, laOrilla, mundo, PHYS } from './mundo.js'

const d4 = (x: number): string => x.toFixed(4)
const log = (l: readonly string[]): void => {
  console.log(['', ...l, ''].join('\n'))
}

function vistaDe(p: Partida, quien: string): VistaDeLaMente {
  return new Contexto(p.proyeccion, { actor: quien, rng: p.dado.tirar, lugares: p.lugares }).ctx
}
function q(s: WorldState, id: string, cual: QualityId): number {
  const b = s.bodies.get(id)
  return b === undefined ? Number.NaN : qualityOf(b.body, cual, s.phys)
}
function aliento(s: WorldState, quien: string): number {
  const b = s.bodies.get(`${quien}-cuerpo`)
  return b === undefined ? 0 : qualityOf(b.body, 'stamina', s.phys)
}
function planDe(
  texto: string,
  v: VistaDeLaMente,
  exp = EXPANSIONES_POR_TICK * 8,
  esquemas?: readonly ConstructionSchema[],
): PlanResult {
  const p = interpretar(texto)
  if (p === undefined) throw new Error(`el intérprete no lee «${texto}»`)
  const g: GoalNode = { id: 'meta', goal: p, after: [], porque: 'el adversario' }
  return esquemas === undefined ? plan(g, v, exp) : plan(g, v, exp, undefined, { esquemas })
}
const LEYES: readonly EsquemaDeLey[] = ESQUEMAS.filter((e): e is EsquemaDeLey => e.k === 'ley')

function quienEstablece(valor: string): string {
  const p = interpretar(firmaDe(valor))
  if (p === undefined) return 'NO LEE'
  const nombres: string[] = []
  for (const otro of ESQUEMAS) {
    const pr = interpretar(firmaDe(otro.establishes))
    if (pr !== undefined && implica(pr, p)) nombres.push(otro.establishes)
  }
  return nombres.length === 0 ? 'NADIE' : nombres.join(' | ')
}

describe('medición', () => {
  it('A · las filas de ley con los valores CRUDOS', () => {
    const filas: string[] = []
    for (const e of LEYES) {
      filas.push(`  pila [${e.pila.join(' > ')}] d=${String(e.distancia)}`)
      for (const [rol, w] of Object.entries(e.roleHints)) {
        for (const t of w) {
          const crudo = `${t.q}${t.op}${String(t.v)}`
          filas.push(`      ${rol}: ${crudo}  → ${rol === 'fuego' ? quienEstablece(crudo) : '(no se fabrica)'}`)
        }
        if (w.length === 0) filas.push(`      ${rol}: (nada)`)
      }
    }
    log(filas)
    expect(LEYES.length).toBe(2)
  })

  it('B · qué sustancia puede ser parrilla: ignitionPoint > 507', () => {
    const umbral = (LEYES.find((e) => e.pila.includes('parrilla'))?.roleHints['parrilla'] ?? [])[0]
    const filas: string[] = [`  umbral: ${String(umbral?.q)}${String(umbral?.op)}${String(umbral?.v)}`]
    for (const s of SUSTANCIAS_SEMILLA) {
      const ip = s.perUnitMass.ignitionPoint
      filas.push(`  ${s.id.padEnd(14)} ignitionPoint ${ip === undefined ? 'AUSENTE' : d4(ip)} · tags [${s.tags.join(',')}]`)
    }
    filas.push(`  specOf('ignitionPoint').range = ${JSON.stringify(specOf('ignitionPoint').range)}`)
    // Y lo que el motor contesta para un cuerpo de piedra, que es lo que ve el plan.
    const s0 = mundo({ bodies: [enElPiso(cuerpo('losa', 'piedra', 0.5, {}, 'bloque'), { x: 0, y: 0 })] })
    filas.push(`  cuerpo de piedra → ignitionPoint ${d4(q(s0, 'losa', 'ignitionPoint'))}`)
    const s1 = mundo({ bodies: [enElPiso(cuerpo('vara', 'madera', 0.5, {}, 'vara'), { x: 0, y: 0 })] })
    filas.push(`  cuerpo de madera → ignitionPoint ${d4(q(s1, 'vara', 'ignitionPoint'))}`)
    log(filas)
    expect(umbral).toBeDefined()
  })

  it('C · cuánto vive un fuego de la ventana del contacto, y si aguanta una cocción', () => {
    // La yesca mínima de la fila de encender del contacto: 0,3506875 kg de madera.
    const filas: string[] = []
    for (const masa of [0.3507, 0.42, 0.4871, 0.6, 1.2]) {
      let s = mundo({
        hz: 20,
        bodies: [
          enElPiso(cuerpo('fuego', 'madera', masa, { temperature: 700 }, 'vara'), { x: 0, y: 0 }),
          { ...enElPiso(cuerpo('pez', 'pescado', 2, {}, 'bloque'), { x: 0, y: 0 }), supportedBy: 'fuego' },
        ],
      })
      const p0 = q(s, 'fuego', 'emitsPower')
      let cocido: number | undefined
      let salio: number | undefined
      let murio: number | undefined
      let maxTemp = 0
      let maxChar = 0
      for (let t = 1; t <= 1200; t++) {
        s = stepWorld(s, []).state
        if (s.bodies.get('fuego') === undefined) {
          murio ??= t
          break
        }
        const pot = q(s, 'fuego', 'emitsPower')
        if (salio === undefined && pot < 105.41666666666673) salio = t
        const tp = q(s, 'pez', 'temperature')
        if (tp > maxTemp) maxTemp = tp
        const ch = q(s, 'pez', 'charred')
        if (ch > maxChar) maxChar = ch
        if (cocido === undefined && q(s, 'pez', 'digestibility') >= 0.85 && q(s, 'pez', 'toxicity') <= 0.05) cocido = t
      }
      filas.push(
        `  masa ${d4(masa)} → emitsPower0 ${d4(p0)} · sale de la ventana en ${String(salio)} · cuerpo desaparece en ${String(murio)} · cocido en ${String(cocido)} · Tmax ${d4(maxTemp)} · charredMax ${d4(maxChar)}`,
      )
    }
    log(filas)
    expect(true).toBe(true)
  })

  it('D · el plan de lo cocido sobre una escena con fuego ya prendido', () => {
    const o = laOrilla()
    const p0 = o.parada
    const escena = (): WorldState =>
      mundo({
        dios: o.dios,
        bodies: [
          enLaMano(criatura('ana', 1000), p0, 'ana'),
          enLaMano(cuerpo('pez', 'pescado', 2, {}, 'bloque'), p0, 'ana'),
          enElPiso(cuerpo('fogata', 'madera', 0.42, { temperature: 700 }, 'vara'), { x: p0.x + 1, y: p0.y }),
          enElPiso(cuerpo('losa', 'piedra', 0.5, {}, 'bloque'), { x: p0.x + 1, y: p0.y }),
        ],
        actors: [actor('ana', { holding: ['pez'], capacity: 3 })],
      })
    const part = new Partida(escena())
    const v = vistaDe(part, 'ana')
    const r = planDe(FIRMA_DE_LO_COCIDO, v, EXPANSIONES_POR_TICK * 60)
    const filas: string[] = [`  plan → ${r.k}`]
    if (r.k === 'plan') {
      for (const s of r.steps) filas.push(`      ${JSON.stringify(s)}`)
    } else if (r.k === 'gap') {
      filas.push(`      missing «${r.missing}»`)
      filas.push(`      why ${r.why}`)
      for (const s of r.nearest) filas.push(`      nearest ${JSON.stringify(s)}`)
    }
    // Y el mismo plan con la fogata YA con la losa apoyada encima.
    const s2 = escena()
    const conLosa = new Map(s2.bodies)
    const l = conLosa.get('losa')
    if (l !== undefined) conLosa.set('losa', { ...l, supportedBy: 'fogata' })
    const part2 = new Partida({ ...s2, bodies: conLosa })
    const r2 = planDe(FIRMA_DE_LO_COCIDO, vistaDe(part2, 'ana'), EXPANSIONES_POR_TICK * 60)
    filas.push(`  con la losa YA apoyada → ${r2.k}: ${r2.k === 'plan' ? r2.steps.map((x) => x.k).join(' → ') : ''}`)
    log(filas)
    expect(true).toBe(true)
  })

  it('E · alejarse: la fila sintética a distancia 1, y las metas de enfriar', () => {
    const contacto = LEYES.find((e) => !e.pila.includes('parrilla'))
    if (contacto === undefined) throw new Error('no hay fila de contacto')
    const lejos: EsquemaDeLey = { ...contacto, distancia: 1 }
    const o = laOrilla()
    const p0 = o.parada
    const part = new Partida(
      mundo({
        dios: o.dios,
        bodies: [
          enLaMano(criatura('ana', 1000), p0, 'ana'),
          enLaMano(cuerpo('pez', 'pescado', 2, {}, 'bloque'), p0, 'ana'),
          enElPiso(cuerpo('fogata', 'madera', 0.42, { temperature: 700 }, 'vara'), { x: p0.x + 1, y: p0.y }),
        ],
        actors: [actor('ana', { holding: ['pez'], capacity: 3 })],
      }),
    )
    const r = planDe(
      FIRMA_DE_LO_COCIDO,
      vistaDe(part, 'ana'),
      EXPANSIONES_POR_TICK * 60,
      [...ESQUEMAS.filter((e) => e.k !== 'ley'), lejos],
    )
    const filas: string[] = [`  con SÓLO la fila a d=1 → ${r.k}`]
    if (r.k === 'gap') filas.push(`      why ${r.why}`)
    // Las metas de enfriar y de mover.
    for (const m of ['temperature<=100', 'temperature<100', 'charred<=0', 'emitsPower<=0', 'emitsPower<105']) {
      filas.push(`  sinVocabulario(«${m}») = ${String(sinVocabulario(firmaDe(m)))} · establece: ${quienEstablece(m)}`)
    }
    // Y el mundo: la misma fogata en los tres lugares.
    const pot = 125.0
    for (const m of MONTAJES) {
      for (const d of [0, 1, 2]) {
        filas.push(`  ${m}@${String(d)} → formFactor ${d4(formFactor(d, m))} · T_eq ${d4(temperaturaDeEquilibrio(pot, d, m))}`)
      }
    }
    log(filas)
    expect(true).toBe(true)
  })

  it('F · el precio: lo que la mente cotiza contra lo que cuesta', () => {
    const pc = interpretar(FIRMA_DE_LO_COCIDO)
    if (pc === undefined) throw new Error('no lee la firma de lo cocido')
    const filas: string[] = [`  alientoDelEsquema(lo cocido) = ${d4(alientoDelEsquema(pc))}`]
    for (const f of ['emitsPower>=105.41666666666673', 'emitsPower<170.83333333333343', 'temperature>=400', 'emitsPower>0']) {
      const p = interpretar(f)
      if (p !== undefined) filas.push(`  alientoDelEsquema(«${f}») = ${d4(alientoDelEsquema(p))}`)
    }
    // Lo que cuesta de verdad encender la yesca mínima del contacto.
    for (const masa of [0.3507, 0.42, 0.4871]) {
      let s = mundo({
        bodies: [
          enElPiso(criatura('ana', 2000), { x: 0, y: 0 }),
          enLaMano(cuerpo('yesca', 'madera', masa, {}, 'vara'), { x: 0, y: 0 }, 'ana'),
          enLaMano(cuerpo('base', 'madera', 1, {}, 'vara'), { x: 0, y: 0 }, 'ana'),
        ],
        actors: [actor('ana', { holding: ['yesca', 'base'], capacity: 3 })],
      })
      const antes = aliento(s, 'ana')
      let ticks = 0
      let pot = 0
      for (let t = 0; t < 2000; t++) {
        const i = apply({ by: 'ana', seq: t + 1 }, PHYS, 'friccion', [
          { name: 'a', body: 'yesca' },
          { name: 'b', body: 'base' },
          { name: 'actor', body: 'ana-cuerpo' },
        ])
        if (i === undefined) throw new Error('friccion no existe')
        s = stepWorld(s, [i]).state
        ticks++
        if (s.bodies.get('yesca') === undefined) break
        pot = q(s, 'yesca', 'emitsPower')
        if (pot > 0) break
        if (aliento(s, 'ana') <= 0) break
      }
      filas.push(`  encender ${d4(masa)} kg → ${String(ticks)} ticks · costó ${d4(antes - aliento(s, 'ana'))} · emitsPower ${d4(pot)}`)
    }
    // Y lo que rinde un pescado cocido de 2 kg.
    const sc = mundo({ bodies: [enElPiso(cuerpo('pez', 'pescado', 2, { digestibility: 0.9, toxicity: 0.01 }, 'bloque'), { x: 0, y: 0 })] })
    filas.push(
      `  pescado cocido 2 kg → calorías ${d4(q(sc, 'pez', 'calories'))} · neto ${d4(q(sc, 'pez', 'calories') * STAMINA_POR_CALORIA - q(sc, 'pez', 'toxicity') * 2 * COSTO_POR_TOXICIDAD_Y_KILO)}`,
    )
    log(filas)
    expect(true).toBe(true)
  })

  it('G · el fardo: masa y cantidad como meta', () => {
    const filas: string[] = []
    for (const t of [
      'mass>=1',
      'mass>1',
      'holding(tag:carnoso,mass>=1)',
      'count>=2',
      'holding(count>=2)',
      'parts>=2',
      'holding(tag:fibroso)',
    ]) {
      const p = interpretar(firmaDe(t))
      filas.push(
        `  «${t.padEnd(30)}» → ${p === undefined ? 'NO LO LEE' : `lee (${p.k})`}${p === undefined ? '' : ` · sinVocabulario ${String(sinVocabulario(firmaDe(t)))} · establece: ${quienEstablece(t)}`}`,
      )
    }
    filas.push(`  specOf('mass').extent = ${specOf('mass').extent}`)
    // La corteza y sus tags.
    for (const s of SUSTANCIAS_SEMILLA) {
      if (s.id !== 'corteza' && s.id !== 'madera' && s.id !== 'piedra' && s.id !== 'pescado') continue
      filas.push(`  ${s.id}: tags [${s.tags.join(',')}] · fuelEnergy ${String(s.perUnitMass.fuelEnergy)} · ignitionPoint ${String(s.perUnitMass.ignitionPoint)} · specificHeat ${String(s.specificHeat)}`)
    }
    // Y el plan de una meta de masa.
    const part = new Partida(
      mundo({
        bodies: [
          enElPiso(criatura('ana', 1000), { x: 0, y: 0 }),
          enElPiso(cuerpo('c1', 'corteza', 0.5, {}, 'hebra'), { x: 1, y: 0 }),
          enElPiso(cuerpo('c2', 'corteza', 0.5, {}, 'hebra'), { x: 1, y: 1 }),
          enElPiso(cuerpo('liana', 'liana', 0.2, {}, 'hebra'), { x: 0, y: 1 }),
        ],
        actors: [actor('ana', { capacity: 3 })],
      }),
    )
    const r = planDe('mass>=1', vistaDe(part, 'ana'), EXPANSIONES_POR_TICK * 20)
    filas.push(`  plan(«mass>=1») → ${r.k}${r.k === 'gap' ? ` · missing «${r.missing}» · ${r.why}` : ''}`)
    log(filas)
    expect(true).toBe(true)
  })

  it('H · esperar: cuántos ticks queda la mente clavada', () => {
    const o = laOrilla()
    const p0 = o.parada
    const part = new Partida(
      mundo({
        dios: o.dios,
        bodies: [
          enLaMano(criatura('ana', 1000), p0, 'ana'),
          enLaMano(cuerpo('pez', 'pescado', 2, {}, 'bloque'), p0, 'ana'),
          enElPiso(cuerpo('fogata', 'madera', 0.42, { temperature: 700 }, 'vara'), { x: p0.x + 1, y: p0.y }),
        ],
        actors: [actor('ana', { holding: ['pez'], capacity: 3 })],
      }),
    )
    const m = new Mente({ actor: 'ana', memoria: new Creencias() })
    const mentes = new Map([['ana', m]])
    const conteo = new Map<string, number>()
    const filas: string[] = []
    for (let t = 1; t <= 700; t++) {
      vivir(part, mentes, 1)
      const d = m.ultimoDespegue ?? `(sin despegue: ${m.tropiezo ?? String(m.ultima?.k)})`
      const clave = d.split('(')[0] ?? d
      conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
    }
    for (const [k, n] of [...conteo.entries()].sort((a, b) => b[1] - a[1])) filas.push(`  ${k.padEnd(40)} ${String(n)}`)
    filas.push(`  dig del pez ${d4(q(part.state, 'pez', 'digestibility'))} · tox ${d4(q(part.state, 'pez', 'toxicity'))}`)
    filas.push(`  aliento final ${d4(aliento(part.state, 'ana'))}`)
    log(filas)
    expect(true).toBe(true)
  })

  it('I · DOS pescados en el mismo fuego, uno detrás del otro', () => {
    let s: WorldState = mundo({
      hz: 20,
      bodies: [
        enElPiso(cuerpo('fuego', 'madera', 0.42, { temperature: 700 }, 'vara'), { x: 0, y: 0 }),
        { ...enElPiso(cuerpo('p1', 'pescado', 2, {}, 'bloque'), { x: 0, y: 0 }), supportedBy: 'fuego' },
        enElPiso(cuerpo('p2', 'pescado', 2, {}, 'bloque'), { x: 1, y: 0 }),
      ],
    })
    const filas: string[] = []
    let c1: number | undefined
    for (let t = 1; t <= 300; t++) {
      s = stepWorld(s, []).state
      if (c1 === undefined && q(s, 'p1', 'digestibility') >= 0.85 && q(s, 'p1', 'toxicity') <= 0.05) c1 = t
    }
    filas.push(
      `  al terminar los 300 ticks del \`mientras\`: p1 cocido en ${String(c1)} · fuego emitsPower ${d4(q(s, 'fuego', 'emitsPower'))} · masa ${d4(q(s, 'fuego', 'mass'))}`,
    )
    // Ahora el segundo, apoyado sobre el mismo fuego.
    const b = s.bodies.get('p2')
    if (b === undefined) throw new Error('se fue p2')
    const m2 = new Map(s.bodies)
    m2.set('p2', { ...b, at: { x: 0, y: 0 }, supportedBy: 'fuego' })
    s = { ...s, bodies: m2 }
    let c2: number | undefined
    let tmax = 0
    for (let t = 301; t <= 1200; t++) {
      s = stepWorld(s, []).state
      const tp = q(s, 'p2', 'temperature')
      if (tp > tmax) tmax = tp
      if (c2 === undefined && q(s, 'p2', 'digestibility') >= 0.85 && q(s, 'p2', 'toxicity') <= 0.05) c2 = t
    }
    filas.push(
      `  p2 sobre el MISMO fuego → cocido en ${String(c2)} · Tmax ${d4(tmax)} · dig ${d4(q(s, 'p2', 'digestibility'))} · emitsPower final ${d4(q(s, 'fuego', 'emitsPower'))}`,
    )
    log(filas)
    expect(true).toBe(true)
  })

  it('J · replanificar para el segundo pescado con el fuego ya gastado', () => {
    const o = laOrilla()
    const p0 = o.parada
    // El fuego después de 300 ticks: se corre el mundo y se planifica sobre lo que quedó.
    let s: WorldState = mundo({
      dios: o.dios,
      hz: 20,
      bodies: [
        enLaMano(criatura('ana', 1000), p0, 'ana'),
        enLaMano(cuerpo('pez', 'pescado', 2, {}, 'bloque'), p0, 'ana'),
        enElPiso(cuerpo('fogata', 'madera', 0.42, { temperature: 700 }, 'vara'), { x: p0.x + 1, y: p0.y }),
        enElPiso(cuerpo('vara', 'madera', 0.42, {}, 'vara'), { x: p0.x + 1, y: p0.y + 1 }),
      ],
      actors: [actor('ana', { holding: ['pez'], capacity: 3 })],
    })
    const filas: string[] = []
    for (const t of [0, 84, 300]) {
      let w = s
      for (let k = 0; k < t; k++) w = stepWorld(w, []).state
      const part = new Partida(w)
      const r = planDe(FIRMA_DE_LO_COCIDO, vistaDe(part, 'ana'), EXPANSIONES_POR_TICK * 60)
      filas.push(
        `  tick ${String(t)} · fogata emitsPower ${d4(q(w, 'fogata', 'emitsPower'))} → plan ${r.k}: ` +
          (r.k === 'plan' ? r.steps.map((x) => x.k).join(' → ') : r.k === 'gap' ? `missing «${r.missing}»` : ''),
      )
      if (r.k === 'gap') filas.push(`        why ${r.why}`)
    }
    log(filas)
    expect(true).toBe(true)
  })

  it('K · el fardo: la meta de masa y quién la cumple', () => {
    const part = new Partida(
      mundo({
        bodies: [
          enElPiso(criatura('ana', 1000), { x: 0, y: 0 }),
          enElPiso(cuerpo('c1', 'corteza', 0.5, {}, 'hebra'), { x: 1, y: 0 }),
          enElPiso(cuerpo('c2', 'corteza', 0.5, {}, 'hebra'), { x: 1, y: 1 }),
          enElPiso(cuerpo('liana', 'liana', 0.2, {}, 'hebra'), { x: 0, y: 1 }),
        ],
        actors: [actor('ana', { capacity: 3 })],
      }),
    )
    const v = vistaDe(part, 'ana')
    const filas: string[] = []
    for (const meta of ['mass>=1', 'mass>=3', 'holding(tag:fibroso,mass>=1)', 'holding(tag:vegetal)', 'fuelEnergy>=16']) {
      const r = planDe(meta, v, EXPANSIONES_POR_TICK * 20)
      filas.push(
        `  «${meta}» → ${r.k}${r.k === 'plan' ? ` [${r.steps.map((x) => x.k).join(' → ')}] (${String(r.steps.length)} pasos)` : r.k === 'gap' ? ` missing «${r.missing}»` : ''}`,
      )
      if (r.k === 'gap') filas.push(`      why ${r.why}`)
    }
    filas.push(`  el cuerpo de ana pesa ${d4(q(part.state, 'ana-cuerpo', 'mass'))}: es lo que cumple «mass>=1»`)
    log(filas)
    expect(true).toBe(true)
  })

  it('L · por qué NO planifica prender un fuego nuevo cuando el viejo se gastó', () => {
    const o = laOrilla()
    const p0 = o.parada
    let s: WorldState = mundo({
      dios: o.dios,
      hz: 20,
      bodies: [
        enLaMano(criatura('ana', 1000), p0, 'ana'),
        enLaMano(cuerpo('pez', 'pescado', 2, {}, 'bloque'), p0, 'ana'),
        enElPiso(cuerpo('fogata', 'madera', 0.42, { temperature: 700 }, 'vara'), { x: p0.x + 1, y: p0.y }),
        enElPiso(cuerpo('vara', 'madera', 0.42, {}, 'vara'), p0),
        enElPiso(cuerpo('base', 'madera', 0.42, {}, 'vara'), p0),
      ],
      actors: [actor('ana', { holding: ['pez'], capacity: 3 })],
    })
    for (let k = 0; k < 300; k++) s = stepWorld(s, []).state
    const part = new Partida(s)
    const v = vistaDe(part, 'ana')
    const soloContacto = ESQUEMAS.filter((e) => e.k !== 'ley' || !e.pila.includes('parrilla'))
    const filas: string[] = []
    for (const [nombre, tabla] of [
      ['todos los esquemas', ESQUEMAS],
      ['sin la fila de la parrilla', soloContacto],
    ] as const) {
      const r = planDe(FIRMA_DE_LO_COCIDO, v, EXPANSIONES_POR_TICK * 120, tabla)
      filas.push(`  ${nombre} → ${r.k}`)
      if (r.k === 'plan') filas.push(`      ${r.steps.map((x) => x.k).join(' → ')}`)
      if (r.k === 'gap') {
        filas.push(`      missing «${r.missing}»`)
        filas.push(`      why ${r.why}`)
        filas.push(`      nearest ${r.nearest.map((x) => x.k).join(' → ')}`)
      }
    }
    // Y la meta del fuego sola, para ver si se puede prender la vara nueva.
    const r2 = planDe('emitsPower>=105.41666666666673', v, EXPANSIONES_POR_TICK * 40)
    filas.push(`  «emitsPower>=105.41666666666673» solo → ${r2.k}${r2.k === 'plan' ? `: ${r2.steps.map((x) => x.k).join(' → ')}` : ''}`)
    if (r2.k === 'gap') filas.push(`      why ${r2.why}`)
    filas.push(`  capacidad de la mano ${String(v.self.capacity)} · lleva ${String(v.self.holding.length)}`)
    log(filas)
    expect(true).toBe(true)
  })

  it('M · con un fuego de 300 a la vista, ¿elige la piedra o la vara para la parrilla?', () => {
    const part = new Partida(
      mundo({
        hz: 20,
        bodies: [
          enLaMano(criatura('ana', 1000), { x: 0, y: 0 }, 'ana'),
          enLaMano(cuerpo('pez', 'pescado', 2, {}, 'bloque'), { x: 0, y: 0 }, 'ana'),
          // Un leño de 1 kg ardiendo: emitsPower 300,60, dentro de [253 ; 410).
          enElPiso(cuerpo('fogata', 'madera', 1, { temperature: 700 }, 'vara'), { x: 1, y: 0 }),
          // Y las dos candidatas a parrilla, la de madera MÁS CERCA que la de piedra.
          enElPiso(cuerpo('varita', 'madera', 0.3, {}, 'vara'), { x: 1, y: 0 }),
          enElPiso(cuerpo('losa', 'piedra', 0.3, {}, 'bloque'), { x: 3, y: 3 }),
        ],
        actors: [actor('ana', { holding: ['pez'], capacity: 3 })],
      }),
    )
    const v = vistaDe(part, 'ana')
    const filas: string[] = [`  fogata emitsPower ${d4(q(part.state, 'fogata', 'emitsPower'))}`]
    const r = planDe(FIRMA_DE_LO_COCIDO, v, EXPANSIONES_POR_TICK * 120)
    filas.push(`  todos los esquemas → ${r.k}: ${r.k === 'plan' ? r.steps.map((x) => JSON.stringify(x)).join('\n        ') : ''}`)
    if (r.k === 'gap') filas.push(`      why ${r.why}`)
    // Y forzando SÓLO la fila de la parrilla.
    const soloParrilla = ESQUEMAS.filter((e) => e.k !== 'ley' || e.pila.includes('parrilla'))
    const r2 = planDe(FIRMA_DE_LO_COCIDO, v, EXPANSIONES_POR_TICK * 120, soloParrilla)
    filas.push(`  sólo la fila de la parrilla → ${r2.k}`)
    if (r2.k === 'plan') for (const x of r2.steps) filas.push(`      ${JSON.stringify(x)}`)
    if (r2.k === 'gap') filas.push(`      why ${r2.why}`)
    log(filas)
    expect(true).toBe(true)
  })

  it('N · L otra vez, EN SECO: la humedad de la orilla contaminaba la medición', () => {
    // Sin dios y sin orilla: las celdas de `mundo()` no mojan nada.
    let s: WorldState = mundo({
      hz: 20,
      bodies: [
        enLaMano(criatura('ana', 1000), { x: 0, y: 0 }, 'ana'),
        enLaMano(cuerpo('pez', 'pescado', 2, {}, 'bloque'), { x: 0, y: 0 }, 'ana'),
        enElPiso(cuerpo('fogata', 'madera', 0.42, { temperature: 700 }, 'vara'), { x: 1, y: 0 }),
        enElPiso(cuerpo('vara', 'madera', 0.42, {}, 'vara'), { x: 0, y: 0 }),
        enElPiso(cuerpo('base', 'madera', 0.42, {}, 'vara'), { x: 0, y: 0 }),
      ],
      actors: [actor('ana', { holding: ['pez'], capacity: 3 })],
    })
    const filas: string[] = []
    for (const t of [0, 84, 300]) {
      let w = s
      for (let k = 0; k < t; k++) w = stepWorld(w, []).state
      const part = new Partida(w)
      const v = vistaDe(part, 'ana')
      const r = planDe(FIRMA_DE_LO_COCIDO, v, EXPANSIONES_POR_TICK * 120)
      filas.push(
        `  tick ${String(t)} · fogata ${d4(q(w, 'fogata', 'emitsPower'))} · vara moisture ${d4(q(w, 'vara', 'moisture'))} → ${r.k}: ` +
          (r.k === 'plan' ? r.steps.map((x) => x.k).join(' → ') : `missing «${r.k === 'gap' ? r.missing : ''}»`),
      )
      if (r.k === 'gap') filas.push(`      why ${r.why}`)
    }
    // Y la misma escena en la ORILLA, para aislar la humedad como causa.
    const o = laOrilla()
    let w2: WorldState = mundo({
      dios: o.dios,
      hz: 20,
      bodies: [
        enLaMano(criatura('ana', 1000), o.parada, 'ana'),
        enLaMano(cuerpo('pez', 'pescado', 2, {}, 'bloque'), o.parada, 'ana'),
        enElPiso(cuerpo('vara', 'madera', 0.42, {}, 'vara'), o.parada),
      ],
      actors: [actor('ana', { holding: ['pez'], capacity: 3 })],
    })
    for (let k = 0; k < 300; k++) w2 = stepWorld(w2, []).state
    filas.push(`  en la ORILLA, a los 300 ticks: vara moisture ${d4(q(w2, 'vara', 'moisture'))} (apaga en ${String(0.45)})`)
    log(filas)
    expect(true).toBe(true)
  })

  it('O · la parrilla YA apoyada: ¿la vuelve a poner?', () => {
    const base = mundo({
      hz: 20,
      bodies: [
        enLaMano(criatura('ana', 1000), { x: 0, y: 0 }, 'ana'),
        enLaMano(cuerpo('pez', 'pescado', 2, {}, 'bloque'), { x: 0, y: 0 }, 'ana'),
        enElPiso(cuerpo('fogata', 'madera', 1, { temperature: 700 }, 'vara'), { x: 1, y: 0 }),
        { ...enElPiso(cuerpo('losa', 'piedra', 0.3, {}, 'bloque'), { x: 1, y: 0 }), supportedBy: 'fogata' },
      ],
      actors: [actor('ana', { holding: ['pez'], capacity: 3 })],
    })
    const part = new Partida(base)
    const r = planDe(FIRMA_DE_LO_COCIDO, vistaDe(part, 'ana'), EXPANSIONES_POR_TICK * 120)
    const filas: string[] = [`  losa ya apoyada sobre la fogata → ${r.k}`]
    if (r.k === 'plan') for (const x of r.steps) filas.push(`      ${JSON.stringify(x)}`)
    log(filas)
    expect(true).toBe(true)
  })

  it('P · el 0,60 kg prohibido: cocina dos veces y no quema', () => {
    const filas: string[] = []
    for (const masa of [0.4871, 0.6]) {
      let s: WorldState = mundo({
        hz: 20,
        bodies: [
          enElPiso(cuerpo('fuego', 'madera', masa, { temperature: 700 }, 'vara'), { x: 0, y: 0 }),
          { ...enElPiso(cuerpo('p1', 'pescado', 2, {}, 'bloque'), { x: 0, y: 0 }), supportedBy: 'fuego' },
          enElPiso(cuerpo('p2', 'pescado', 2, {}, 'bloque'), { x: 1, y: 0 }),
        ],
      })
      let c1: number | undefined
      for (let t = 1; t <= 300; t++) {
        s = stepWorld(s, []).state
        if (c1 === undefined && q(s, 'p1', 'digestibility') >= 0.85 && q(s, 'p1', 'toxicity') <= 0.05) c1 = t
      }
      const b = s.bodies.get('p2')
      if (b === undefined) throw new Error('no está p2')
      const m2 = new Map(s.bodies)
      m2.set('p2', { ...b, at: { x: 0, y: 0 }, supportedBy: 'fuego' })
      s = { ...s, bodies: m2 }
      let c2: number | undefined
      for (let t = 301; t <= 1500; t++) {
        s = stepWorld(s, []).state
        if (c2 === undefined && q(s, 'p2', 'digestibility') >= 0.85 && q(s, 'p2', 'toxicity') <= 0.05) c2 = t
      }
      filas.push(
        `  masa ${d4(masa)} → p1 cocido ${String(c1)} · p2 cocido ${String(c2)} · charred p1 ${d4(q(s, 'p1', 'charred'))} / p2 ${d4(q(s, 'p2', 'charred'))} · dig p2 ${d4(q(s, 'p2', 'digestibility'))}`,
      )
    }
    log(filas)
    expect(true).toBe(true)
  })

  it('Q · los bordes: quién pone el techo, y qué tanque hay', () => {
    const filas: string[] = []
    let piso = Number.NEGATIVE_INFINITY
    let quienPiso = ''
    let techo = Number.POSITIVE_INFINITY
    let quienTecho = ''
    for (const s of SUSTANCIAS_SEMILLA) {
      if (!s.tags.includes('carnoso') || !s.tags.includes('organico')) continue
      const d = s.perUnitMass.denaturesAt
      const ig = s.perUnitMass.ignitionPoint
      if (d === undefined || ig === undefined) continue
      if (d > piso) {
        piso = d
        quienPiso = s.id
      }
      if (ig < techo) {
        techo = ig
        quienTecho = s.id
      }
      filas.push(`  ${s.id.padEnd(10)} denaturesAt ${d4(d)} · ignitionPoint ${d4(ig)}`)
    }
    filas.push(`  ventana del tag «carnoso» = [${d4(piso)} ; ${d4(techo)}) · piso de ${quienPiso} · techo de ${quienTecho}`)
    filas.push(`  temperatura de trabajo = ${d4((piso + techo) / 2)}`)
    filas.push(`  TANQUE (specOf stamina) = ${JSON.stringify(specOf('stamina').range)}`)
    // ¿Cocina un fuego que está 0,2 por debajo del piso de la fila?
    for (const pot of [105.21, 105.4167]) {
      const masa = pot / (18 * 16.7)
      let s: WorldState = mundo({
        hz: 20,
        bodies: [
          enElPiso(cuerpo('fuego', 'madera', masa, { temperature: 700 }, 'vara'), { x: 0, y: 0 }),
          { ...enElPiso(cuerpo('pez', 'pescado', 2, {}, 'bloque'), { x: 0, y: 0 }), supportedBy: 'fuego' },
        ],
      })
      const p0 = q(s, 'fuego', 'emitsPower')
      let cocido: number | undefined
      for (let t = 1; t <= 600; t++) {
        s = stepWorld(s, []).state
        if (cocido === undefined && q(s, 'pez', 'digestibility') >= 0.85 && q(s, 'pez', 'toxicity') <= 0.05) cocido = t
      }
      filas.push(`  fuego de ${d4(masa)} kg (emitsPower ${d4(p0)}) → cocido en ${String(cocido)}`)
    }
    // Y encender con el tanque de la escena del criterio.
    for (const tanque of [310, 1000]) {
      let s: WorldState = mundo({
        bodies: [
          enElPiso(criatura('ana', tanque), { x: 0, y: 0 }),
          enLaMano(cuerpo('yesca', 'madera', 0.3507, {}, 'vara'), { x: 0, y: 0 }, 'ana'),
          enLaMano(cuerpo('base', 'madera', 1, {}, 'vara'), { x: 0, y: 0 }, 'ana'),
        ],
        actors: [actor('ana', { holding: ['yesca', 'base'], capacity: 3 })],
      })
      let pot = 0
      for (let t = 0; t < 500; t++) {
        const i = apply({ by: 'ana', seq: t + 1 }, PHYS, 'friccion', [
          { name: 'a', body: 'yesca' },
          { name: 'b', body: 'base' },
          { name: 'actor', body: 'ana-cuerpo' },
        ])
        if (i === undefined) throw new Error('friccion no existe')
        s = stepWorld(s, [i]).state
        if (s.bodies.get('yesca') === undefined) break
        pot = q(s, 'yesca', 'emitsPower')
        if (pot > 0) break
        if (aliento(s, 'ana') <= 0) break
      }
      filas.push(`  con tanque ${String(tanque)} → emitsPower ${d4(pot)} · aliento ${d4(aliento(s, 'ana'))}`)
    }
    log(filas)
    expect(true).toBe(true)
  })
})
