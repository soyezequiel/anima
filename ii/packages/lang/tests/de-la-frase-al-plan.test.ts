/**
 * DE LA FRASE AL PLAN — la costura soldada, corrida entera.
 *
 * Es el test que hace que este paquete signifique algo. Todos los demás miden
 * pedazos; éste agarra una frase en castellano, la lee, la convierte en grafo de
 * objetivos y le pide un plan al planificador de verdad, contra la escena
 * canónica del Hito 5.
 *
 * Antes de este tramo, medido: **cero llamadas a `goalGraph` en producción** y
 * **un solo sitio** que construía un `GoalNode`, un literal con `after: []` y
 * sin `binds`. El planificador sabía leer un `binds` y la mente nunca le mandaba
 * uno.
 */

import { buildSeedPhysics } from '@anima/physics'
import { ESQUEMAS, catalogoDe, plan } from '@anima/plan'
import { describe, expect, it } from 'vitest'
import { PUENTE } from '../src/alias.js'
import { faltaDe } from '../src/falta.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { objetivosDe } from '../src/objetivos.js'
import { elRio } from './rio.js'

const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const catalogo = catalogoDe(ESQUEMAS)

const ESTABLECIBLES = new Set<string>()
for (const e of ESQUEMAS) ESTABLECIBLES.add(e.establishes)
const OPC = { phys, lexico, sabeElCatalogo: (f: string): boolean => ESTABLECIBLES.has(f) }

const PRESUPUESTO = 400

/** La frase entera, del castellano a los pasos. */
function pedir(frase: string): {
  nodos: number
  pasos: readonly string[]
  gap?: string
  aviso: string
} {
  const l = leer(frase, OPC)
  const p = objetivosDe(l)
  const primero = p.nodos[0]
  if (primero === undefined) return { nodos: 0, pasos: [], aviso: p.aviso }
  const r = plan(primero, elRio(), PRESUPUESTO)
  if (r.k === 'plan') {
    return { nodos: p.nodos.length, pasos: r.steps.map((s) => s.k), aviso: p.aviso }
  }
  if (r.k === 'gap') return { nodos: p.nodos.length, pasos: [], gap: r.missing, aviso: p.aviso }
  return { nodos: p.nodos.length, pasos: [], gap: 'parcial', aviso: p.aviso }
}

describe('EL CASO DE ACEPTACIÓN, corrido de punta a punta', () => {
  it('«fabricá una trampa para peces» sale como plan de verdad', () => {
    const r = pedir('fabricá una trampa para peces')
    console.log(`\n  «fabricá una trampa para peces»`)
    console.log(`     ${String(r.nodos)} objetivo(s) → ${r.pasos.join(' · ')}\n`)
    expect(r.nodos).toBe(1)
    expect(r.gap).toBeUndefined()
    expect(r.pasos.length).toBeGreaterThan(0)
    // Y la prueba de que no se nombró la solución: el plan lo armó la regresión
    // sobre `catch>0`, no una fila que diga «trampa».
    expect(r.pasos).toContain('unir')
  })

  it('y el mismo pedido dicho de otra forma da el mismo plan', () => {
    // Si dos formas de pedir lo mismo dieran planes distintos, el léxico estaría
    // decidiendo cosas que no le tocan.
    const a = pedir('fabricá una trampa para peces')
    const b = pedir('hacé un aparejo')
    expect(b.pasos).toEqual(a.pasos)
  })
})

describe('la costura entrega planes', () => {
  const CASOS: readonly (readonly [frase: string, esperaPlan: boolean])[] = [
    ['hacé fuego', true],
    ['pescá algo', true],
    ['conseguí comida', true],
    ['fabricá una trampa para peces', true],
    ['construi una ahoguera', true],
    // Las que NO tienen que dar plan, y por motivos distintos.
    ['andá al río', false],
    ['traé un palo', false],
    ['xyzzy plugh', false],
  ]

  it('las ocho, con su resultado al lado', () => {
    const filas: string[] = []
    for (const [frase, esperaPlan] of CASOS) {
      const r = pedir(frase)
      filas.push(
        `  ${frase.padEnd(30)} ${String(r.nodos)} nodo(s)  ${
          r.pasos.length > 0 ? r.pasos.join('·') : `— ${r.gap ?? r.aviso}`
        }`,
      )
      expect(r.pasos.length > 0, `«${frase}» esperaba plan=${String(esperaPlan)}`).toBe(esperaPlan)
    }
    console.log('\n── DE LA FRASE AL PLAN ──')
    for (const f of filas) console.log(f)
    console.log('')
  })
})

describe('las cláusulas que no se pueden representar se DICEN', () => {
  it('una frase mitad y mitad avisa qué se perdió', () => {
    // «Hacé fuego y andá al río»: la primera es meta, la segunda no se puede
    // representar. Lo que NO puede pasar es que entregue un grafo de uno y se
    // calle: el cuidador se quedaría creyendo que se entendió todo.
    const p = objetivosDe(leer('hacé fuego y andá al río', OPC))
    expect(p.nodos.length).toBe(1)
    expect(p.descartes.length).toBe(1)
    expect(p.aviso).not.toBe('')
    console.log(`  «hacé fuego y andá al río» → ${p.aviso}`)
  })

  it('y una cláusula NEGADA no se convierte en objetivo', () => {
    // Es la trampa que este archivo cuida. `GoalNode` no tiene signo, así que
    // convertir «no hagas fuego» en la meta `emitsPower>0` mandaría a la
    // criatura a hacer exactamente lo que le prohibieron.
    const p = objetivosDe(leer('no hagas fuego', OPC))
    expect(p.nodos.length).toBe(0)
    expect(p.descartes.length).toBe(1)
    console.log(`  «no hagas fuego» → ${p.aviso}`)
  })
})

describe('el `bindeaSlot` no se adivina nunca', () => {
  it('sólo se liga el par medido, y ninguno más', () => {
    // Medido antes de escribir el archivo: con el slot correcto el plan sale de
    // 5 pasos y sin él de 12; con un slot inventado sale IDÉNTICO al de sin
    // binds (se evapora en silencio) y con uno plausible-pero-equivocado sale
    // verde pidiendo un disparate.
    const p = objetivosDe(leer('pescá algo y después asá el pescado', OPC))
    expect(p.nodos.length).toBe(2)
    const segundo = p.nodos[1]
    expect(segundo?.binds?.slot).toBe('comida')
    expect(segundo?.binds?.from).toBe('g0')
    console.log(`  «pescá algo y después asá el pescado» → g1 liga «comida» ← ${String(segundo?.binds?.from)}`)
  })

  it('y una meta sin par medido sale SIN ligadura', () => {
    const p = objetivosDe(leer('hacé fuego y después pescá algo', OPC))
    expect(p.nodos.length).toBe(2)
    expect(p.nodos[1]?.binds).toBeUndefined()
  })
})

describe('las CUATRO clases de lo que falta', () => {
  it('se distinguen, y no son la misma respuesta cuatro veces', () => {
    const casos: readonly (readonly [firma: string, esperada: string])[] = [
      // El agua EXISTE y es `liquido`, así que la materia está. Lo que no hay es
      // ninguna ley que la ponga en una mano: ni `friccion`, ni `union`, ni
      // `deshilachar`, ni `extraccion` la establecen. Escribí `habilidad` acá y
      // el test tenía razón en rebotarme: decirle al cuidador «falta que alguien
      // escriba el cómo» lo mandaría a esperar a la fragua por algo que la
      // fragua no puede resolver, porque no hay ley abajo.
      ['holding(tag:liquido)', 'proceso'],
      // El fuego SÍ está publicado: lo que falta son las condiciones.
      ['emitsPower>0', 'habilidad'],
      // Geometría con ley detrás → falta la forma.
      ['jointCount>=3', 'plano'],
    ]
    const filas: string[] = []
    for (const [firma, esperada] of casos) {
      const f = faltaDe(firma, phys, catalogo)
      filas.push(`  ${firma.padEnd(28)} ${f.clase.padEnd(10)} «${f.enVozAlta}»`)
      expect(f.clase, `${firma} → ${f.clase}`).toBe(esperada)
    }
    console.log('\n── QUÉ FALTA ──')
    for (const f of filas) console.log(f)
    console.log('')
  })

  it('y una cualidad que este mundo no tiene sale como FÍSICA', () => {
    // El control de que `fisica` significa algo: se pregunta por una cualidad
    // inventada y la respuesta no puede ser «falta una habilidad».
    const f = faltaDe('magnetismo>=1', phys, catalogo)
    expect(f.clase).toBe('fisica')
    console.log(`  «magnetismo>=1» → ${f.clase}: ${f.enVozAlta}`)
  })
})
