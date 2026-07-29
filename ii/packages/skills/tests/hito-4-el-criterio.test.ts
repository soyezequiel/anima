import { readFileSync, readdirSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { scanDeterminism, shadowScope } from '../src/aislamiento.js'
import {
  FUEL_POR_PASO,
  HZ_DE_REFERENCIA,
  OutOfFuel,
  instrument,
  mount,
  tickMs,
  unirCeldas,
  type FuelCell,
} from '../src/combustible.js'
import * as API from '../src/ctx.js'
import { SkillRun, type Step, type WorldCtx } from '../src/ejecutor.js'
import type { Cell, Intent, Outcome, StepResult } from '../src/ctx.js'
import { ACTOR, Mundito } from './mundito.js'

/**
 * EL CRITERIO DEL HITO 4, LOS SEIS, EN UN SOLO LUGAR.
 *
 * El documento de arquitectura los escribe en una línea:
 *
 *   «las quince corren dentro del presupuesto; un `while(true)` plantado se
 *    corta sin caer un frame; una recursión infinita también; una habilidad
 *    corrida dos veces da el mismo hash; una habilidad interrumpida por un
 *    guardado converge (test de continuidad); un programa mal tipado se rechaza
 *    en menos de 250 ms sin viaje.»
 *
 * Los seis se verifican acá, y (a) y (f) NO ESTABAN VERIFICADOS EN NINGÚN LADO
 * antes de este archivo:
 *
 * - (a) las quince se corrían con un driver de juguete (`correr()` de
 *   `mundito.ts`) que ni instrumenta ni pone tanque: medía que TERMINEN, no que
 *   entren en el presupuesto. Acá se instrumentan de verdad con el transformer,
 *   se montan en el alcance sombreado, y las avanza el ejecutor real.
 * - (f) el banco del Hito 0 medía el typecheck sobre los borradores, o sea el
 *   camino feliz. El criterio habla del camino de RECHAZO, que es el que la
 *   fragua del Hito 8 recorre diez veces por reparación.
 *
 * Los otros cuatro tienen su prueba fina en `combustible.test.ts` y
 * `ejecutor.test.ts`; acá se re-verifican de punta a punta y CON RELOJ, porque
 * «sin caer un frame» es una afirmación en milisegundos y hasta ahora no se
 * había medido ninguno.
 */

const TICK = tickMs() // 50 ms a 20 Hz (ADR II-0007 / II-0008)
const INNATAS_DIR = resolve(__dirname, '../src/innatas')

// ─── El cargador: las quince, instrumentadas y montadas de verdad ────────────
//
// No se importan como módulos de Node: se leen del disco, se pasan por el
// transformer de combustible y se montan con `mount()` en el alcance sombreado,
// que es EXACTAMENTE el camino por el que va a entrar el código que escriba el
// modelo. Importarlas con `import` habría probado que el TypeScript compila y
// nada más — y compilar ya lo prueba el typecheck del paquete.
//
// El registro resuelve los `require` entre archivos (`./comun.js`,
// `./tantear.js`, …) montando en profundidad. No hay ciclos: `index.ts` es el
// único agregador y no se monta.

const montados = new Map<string, Record<string, unknown>>()
const celdas = new Map<string, FuelCell>()
/** Qué módulos entran en cada habilidad. Es lo que hay que recargar junto. */
const grafo = new Map<string, Set<string>>()

function cargar(modulo: string): Record<string, unknown> {
  const hit = montados.get(modulo)
  if (hit) return hit
  const fuente = readFileSync(join(INNATAS_DIR, `${modulo}.ts`), 'utf8')
  const { js } = instrument(ts, fuente, { fileName: `${modulo}.ts` })
  const ids = [...fuente.matchAll(/from '(\.[^']+)'/g)].map((m) => m[1] ?? '')
  const modules: Record<string, unknown> = {}
  const propios = new Set<string>([modulo])
  for (const id of new Set(ids)) {
    // `../ctx.js` es la superficie: la sirve el paquete, no el sandbox. Es de
    // donde salen `done` y `fail`, que son las dos únicas funciones de verdad
    // que la superficie exporta.
    if (id === '../ctx.js') {
      modules[id] = API
      continue
    }
    const dep = id.replace('./', '').replace('.js', '')
    modules[id] = cargar(dep)
    for (const x of grafo.get(dep) ?? []) propios.add(x)
  }
  const m = mount(js, { scope: shadowScope(), modules })
  montados.set(modulo, m.exports)
  celdas.set(modulo, m.cell)
  grafo.set(modulo, propios)
  return m.exports
}

type Generadora = (ctx: unknown, args: unknown) => Generator<Intent, Outcome, StepResult>

function innata(modulo: string, nombre: string): { skill: Generadora; cell: FuelCell } {
  const exports = cargar(modulo)
  const f = exports[nombre]
  if (typeof f !== 'function') throw new Error(`${modulo}.${nombre} no es una función montada`)
  // UNA celda por habilidad, no por archivo. Sin esto, once de las quince mueren
  // por `OutOfFuel` en la primera llamada a un ayudante de `comun.js`: cada
  // `mount()` tiene su propio `__fuelLeft` y el ejecutor recarga uno solo. Ver
  // `unirCeldas` en `combustible.ts`, y el test que lo deja pinchado más abajo.
  const cells = [...(grafo.get(modulo) ?? [modulo])].map((x) => celdas.get(x)).filter((c): c is FuelCell => !!c)
  return { skill: f as Generadora, cell: unirCeldas(cells) }
}

/**
 * El `Ctx` del mundito, menos las dos cosas que instala el ejecutor.
 *
 * Los descriptores se copian UNO POR UNO y no con un spread, y eso importa: en
 * el mundito `tick`, `clock` y `self` son GETTERS, y un spread los evaluaría una
 * sola vez y congelaría la percepción para siempre. Cinco de las quince se
 * rompen con la percepción congelada, y no es una hipótesis: está medido en
 * `innatas.test.ts`.
 */
function worldCtx(m: Mundito): WorldCtx {
  const base = m.ctx() as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(base)) {
    if (k === 'memory' || k === 'phase') continue
    const d = Object.getOwnPropertyDescriptor(base, k)
    if (d) Object.defineProperty(out, k, { ...d, configurable: true, enumerable: true })
  }
  return out as unknown as WorldCtx
}

const vista = (m: Mundito, id: string): API.BodyView => {
  const c = m.cuerpo(id)
  if (!c) throw new Error(`no existe ${id}`)
  const v: { -readonly [K in keyof API.BodyView]: API.BodyView[K] } = {
    id: c.id,
    at: c.at,
    name: c.name,
    tags: c.tags ?? [],
    madeByMe: c.madeByMe ?? false,
    joints: [],
  }
  if (c.heldBy !== undefined) v.heldBy = c.heldBy
  return v
}

interface Corrida {
  readonly nombre: string
  /** El peor paso, en ms. Es contra lo que se mide el 10% del tick. */
  readonly peorPaso: number
  readonly totalMs: number
  readonly pasos: number
  readonly suspensiones: number
  /** Lo más que gastó de tanque en un solo paso. */
  readonly peorTanque: number
  readonly estado: string
  readonly ok: boolean
}

/**
 * Corre una innata de punta a punta con el ejecutor real y devuelve su costo.
 *
 * `resolver` es el mundito haciendo de mundo: el ejecutor NO tiene el bucle —lo
 * tiene el mundo, que es el único que sabe cuándo un `goTo` terminó de
 * resolverse— así que el bucle es de acá.
 */
function correrConPresupuesto(
  nombre: string,
  m: Mundito,
  modulo: string,
  fn: string,
  args: unknown,
  tope = 400,
): Corrida {
  const { skill, cell } = innata(modulo, fn)
  const run = new SkillRun(skill as never, worldCtx(m), args as never, { by: ACTOR, cell, maxStalls: 40 })
  let peorPaso = 0
  let peorTanque = 0
  let total = 0
  let suspensiones = 0
  let pasos = 0
  let resultado: StepResult | undefined
  let paso: Step
  for (;;) {
    const t = performance.now()
    paso = run.step(resultado)
    const dt = performance.now() - t
    pasos++
    total += dt
    if (dt > peorPaso) peorPaso = dt
    if (cell.spent > peorTanque) peorTanque = cell.spent
    resultado = undefined
    if (paso.k === 'terminada' || paso.k === 'rota') break
    if (paso.k === 'suspendida') suspensiones++
    else resultado = m.juzgar(paso.intent)
    if (pasos > tope) break
  }
  return {
    nombre,
    peorPaso,
    totalMs: total,
    pasos,
    suspensiones,
    peorTanque,
    estado: paso.k,
    ok: paso.k === 'terminada' && (paso.outcome.ok as boolean),
  }
}

// Los quince escenarios. Son los mismos mundos de `innatas.test.ts`, escritos
// para que cada habilidad llegue a hacer lo suyo: medir el presupuesto de una
// habilidad que se va por la rama de fallo en el primer paso no mide nada.
function escenarios(): Corrida[] {
  const out: Corrida[] = []

  {
    const m = new Mundito({ cuerpos: [{ id: 'p', at: { x: 9, y: 3 }, name: 'piedra', q: {} }] })
    out.push(correrConPresupuesto('ir', m, 'ir', 'ir', { a: vista(m, 'p'), within: 1 }))
  }
  {
    const m = new Mundito({ cuerpos: [], celdas: { '3,0': { wet: 1 } } })
    out.push(
      correrConPresupuesto('explorar', m, 'explorar', 'explorar', {
        buscoEnLaCelda: { q: 'wet', op: '>=', v: 0.9 },
        maxTicks: 50,
        radio: 4,
      }),
    )
  }
  {
    const m = new Mundito({
      cuerpos: [
        { id: 'a', at: { x: 1, y: 0 }, name: 'vara', q: { rigidity: 0.9, portable: 1 } },
        { id: 'b', at: { x: 2, y: 0 }, name: 'vara', q: { rigidity: 0.9, portable: 1 } },
        { id: 'c', at: { x: 3, y: 0 }, name: 'vara', q: { rigidity: 0.9, portable: 1 } },
      ],
    })
    out.push(
      correrConPresupuesto('juntar', m, 'juntar', 'juntar', {
        que: [{ q: 'rigidity', op: '>=', v: 0.5 }],
        cuantos: 5,
      }),
    )
  }
  {
    const m = new Mundito({
      cuerpos: [
        { id: 'pez', at: { x: 1, y: 0 }, name: 'pescado', q: { nutrition: 8, mass: 0.6, digestibility: 0.6 } },
      ],
    })
    out.push(correrConPresupuesto('comer', m, 'comer', 'comer', {}))
  }
  {
    const m = new Mundito({
      cuerpos: [
        { id: 'heb', at: { x: 0, y: 0 }, name: 'hebra', q: { flexibility: 0.9, tensile: 0.5, portable: 1 } },
        { id: 'vara', at: { x: 0, y: 0 }, name: 'vara', q: { rigidity: 0.9, portable: 1 } },
      ],
      yo: { holding: ['heb', 'vara'] },
    })
    out.push(correrConPresupuesto('unir', m, 'unir', 'unir', { binder: vista(m, 'heb'), a: vista(m, 'vara') }))
  }
  {
    const m = new Mundito({
      cuerpos: [{ id: 'mat', at: { x: 0, y: 0 }, name: 'matorral', q: { tensile: 0.5, mass: 4 } }],
    })
    out.push(
      correrConPresupuesto('deshilachar', m, 'deshilachar', 'deshilachar', { fuente: vista(m, 'mat'), cuantas: 2 }),
    )
  }
  {
    const m = new Mundito({
      cuerpos: [
        { id: 'a', at: { x: 0, y: 0 }, name: 'vara', q: { rigidity: 0.9 } },
        { id: 'b', at: { x: 0, y: 0 }, name: 'tabla', q: { rigidity: 0.9 } },
      ],
    })
    out.push(
      correrConPresupuesto('aplicar-proceso', m, 'aplicar-proceso', 'aplicarProceso', {
        proceso: 'friccion',
        roles: { a: vista(m, 'a'), b: vista(m, 'b'), actor: vista(m, 'a') },
        intentos: 2,
      }),
    )
  }
  {
    const m = new Mundito({ cuerpos: [{ id: 'p', at: { x: 2, y: 0 }, name: 'piedra', q: { portable: 1 } }] })
    out.push(correrConPresupuesto('poner', m, 'poner', 'poner', { que: vista(m, 'p'), en: { x: 3, y: 0 } }))
  }
  {
    const m = new Mundito({
      cuerpos: [
        { id: 'v1', at: { x: 0, y: 0 }, name: 'vara', q: { portable: 1 } },
        { id: 'nueva', at: { x: 0, y: 0 }, name: 'caña', q: { portable: 1 } },
      ],
      yo: { capacity: 1, holding: ['v1'] },
    })
    out.push(correrConPresupuesto('sostener', m, 'sostener', 'sostener', { que: vista(m, 'nueva') }))
  }
  {
    const m = new Mundito({
      cuerpos: [
        { id: 'a', at: { x: 0, y: 0 }, name: 'vara', q: { rigidity: 0.9, moisture: 0 } },
        { id: 'b', at: { x: 0, y: 0 }, name: 'tabla', q: { rigidity: 0.9, moisture: 0 } },
      ],
    })
    out.push(correrConPresupuesto('frotar', m, 'frotar', 'frotar', { a: vista(m, 'a'), b: vista(m, 'b') }))
  }
  {
    const m = new Mundito({
      cuerpos: [{ id: 'x', at: { x: 3, y: 0 }, name: 'cosa', q: { mass: 2, rigidity: 0.4 } }],
    })
    out.push(correrConPresupuesto('tantear', m, 'tantear', 'tantear', { que: vista(m, 'x') }))
  }
  {
    const m = new Mundito({
      cuerpos: [],
      celdas: { '0,0': { temperature: 300 }, '3,0': { temperature: 18 } },
      ambiente: { temperature: 300 },
    })
    out.push(correrConPresupuesto('huir-del-dolor', m, 'huir-del-dolor', 'huirDelDolor', { radio: 3 }))
  }
  {
    const m = new Mundito({ cuerpos: [], celdas: { '2,1': { sheltered: 0.9 } } })
    out.push(correrConPresupuesto('guarecerse', m, 'guarecerse', 'guarecerse', { radio: 4 }))
  }
  {
    const m = new Mundito({
      cuerpos: [{ id: 'pez', at: { x: 0, y: 0 }, name: 'pescado', q: { digestibility: 0.1 }, tasa: { digestibility: 0.05 } }],
    })
    out.push(
      correrConPresupuesto('esperar', m, 'esperar', 'esperar', {
        segundos: 30,
        mirando: { b: vista(m, 'pez'), q: 'digestibility', llegaA: 0.85 },
      }),
    )
  }
  {
    const m = new Mundito({ cuerpos: [] })
    out.push(
      correrConPresupuesto(
        'seguir-orden-de-movimiento',
        m,
        'seguir-orden-de-movimiento',
        'seguirOrdenDeMovimiento',
        { orden: { verbo: 'ir', a: { x: 5, y: 5 } } },
      ),
    )
  }

  return out
}

// ─── (a) LAS QUINCE CORREN DENTRO DEL PRESUPUESTO ───────────────────────────

describe(`(a) las quince corren dentro del presupuesto · tick de ${TICK} ms a ${HZ_DE_REFERENCIA} Hz`, () => {
  const corridas = escenarios()
  const TOPE_PASO = TICK * 0.1 // ADR II-0005: 10% del tick por paso de habilidad

  it('las quince están, y son las quince', () => {
    expect(corridas.map((c) => c.nombre)).toEqual([
      'ir',
      'explorar',
      'juntar',
      'comer',
      'unir',
      'deshilachar',
      'aplicar-proceso',
      'poner',
      'sostener',
      'frotar',
      'tantear',
      'huir-del-dolor',
      'guarecerse',
      'esperar',
      'seguir-orden-de-movimiento',
    ])
  })

  it('las quince pasan por el transformer, se montan en el alcance sombreado y CORREN', () => {
    // Que el TypeScript compile ya lo dice el typecheck del paquete. Lo que se
    // verifica acá es lo otro: que sobrevivan a que les inyecten combustible en
    // cada back-edge y a que les tapen `Date`, `Math.random` y `globalThis`.
    // Una habilidad que use `Math.sqrt` compila perfecto y muere acá.
    const rotas = corridas.filter((c) => c.estado === 'rota').map((c) => c.nombre)
    expect(rotas, `se rompieron adentro del sandbox: ${rotas.join(', ')}`).toEqual([])
    const noTerminaron = corridas.filter((c) => c.estado !== 'terminada').map((c) => c.nombre)
    expect(noTerminaron, `no terminaron: ${noTerminaron.join(', ')}`).toEqual([])
  })

  it(`ningún paso de ninguna se come más del 10% del tick (${TOPE_PASO} ms)`, () => {
    const tabla = corridas
      .slice()
      .sort((a, b) => b.peorPaso - a.peorPaso)
      .map(
        (c) =>
          `  ${c.nombre.padEnd(28)} peor paso ${c.peorPaso.toFixed(3).padStart(6)} ms  ` +
          `(${((c.peorPaso / TICK) * 100).toFixed(2)}% del tick) · ${c.pasos} pasos · total ${c.totalMs.toFixed(3)} ms`,
      )
    console.log(`\nlas quince innatas, instrumentadas y corridas por el ejecutor:\n${tabla.join('\n')}`)
    const peor = corridas.reduce((a, b) => (a.peorPaso > b.peorPaso ? a : b))
    console.log(
      `\n  PEOR DE LAS QUINCE: ${peor.nombre} con ${peor.peorPaso.toFixed(3)} ms = ` +
        `${((peor.peorPaso / TICK) * 100).toFixed(2)}% del tick (tope ${TOPE_PASO} ms, margen ${(TOPE_PASO / peor.peorPaso).toFixed(1)}×)`,
    )
    for (const c of corridas) {
      expect(c.peorPaso, `${c.nombre} se pasó del 10% del tick`).toBeLessThan(TOPE_PASO)
    }
  })

  it('las quince juntas, en un tick, no llegan al tick', () => {
    // El número que el ADR II-0005 dejó anotado para vigilar: «el margen es de
    // hoy, con UNA habilidad». Con quince vivas a la vez —que no es el caso
    // real, pero es la cota— el peor paso de cada una sumado tiene que seguir
    // entrando en un cuadro.
    const suma = corridas.reduce((n, c) => n + c.peorPaso, 0)
    console.log(
      `\n  las quince a la vez, cada una en su peor paso: ${suma.toFixed(3)} ms = ${((suma / TICK) * 100).toFixed(1)}% del tick`,
    )
    expect(suma).toBeLessThan(TICK)
  })

  it('ninguna se acerca a agotar el tanque: no están pensando, están actuando', () => {
    // El tanque son 200.000 unidades por paso (`FUEL_POR_PASO`). Una habilidad
    // honesta gasta tres órdenes de magnitud menos: lo que hace es mirar diez
    // cuerpos y ceder. Si alguna se acercara al tanque sería la señal de que
    // está simulando el futuro, que es justo lo que el ADR II-0004 prohíbe.
    const peor = corridas.reduce((a, b) => (a.peorTanque > b.peorTanque ? a : b))
    console.log(
      `\n  peor consumo de tanque: ${peor.nombre} con ${peor.peorTanque} de ${FUEL_POR_PASO} ` +
        `(${((peor.peorTanque / FUEL_POR_PASO) * 100).toFixed(2)}%)`,
    )
    for (const c of corridas) {
      expect(c.peorTanque, `${c.nombre} gastó ${c.peorTanque}`).toBeLessThan(FUEL_POR_PASO / 10)
    }
    // Y ninguna suspendió: suspender está bien, pero una innata que suspende es
    // una innata que computa de más.
    expect(corridas.filter((c) => c.suspensiones > 0).map((c) => c.nombre)).toEqual([])
  })
})

// ─── (b) y (c) EL CORTE, CON RELOJ ──────────────────────────────────────────

/** Monta un fuente crudo con el tanque del ejecutor. Sin sombras: acá se mide el corte. */
function montarCrudo(fuente: string): { skill: Generadora; cell: FuelCell } {
  const { js } = instrument(ts, fuente)
  const m = mount(js, {})
  return { skill: m.exports['habilidad'] as Generadora, cell: m.cell }
}

const mundoMudo = (): WorldCtx => ({}) as unknown as WorldCtx

describe('(b) y (c) el corte, medido con reloj contra el cuadro', () => {
  it(`(b) un \`while (true)\` plantado se corta en mucho menos de un cuadro (${TICK} ms)`, () => {
    // Dos formas, y las dos tienen que cortar: en el CUERPO del generador cede
    // (y es reanudable, que es lo que QuickJS no podía dar), y en una función
    // común lanza `OutOfFuel` porque la gramática de ECMAScript no deja poner un
    // `yield` ahí.
    const { skill: cede, cell: c1 } = montarCrudo(`
      export function* habilidad(ctx) {
        let n = 0
        while (true) { n++ }
      }
    `)
    const r1 = new SkillRun(cede as never, mundoMudo(), undefined as never, { by: ACTOR, cell: c1, maxStalls: 3 })
    const t1 = performance.now()
    const p1 = r1.step()
    const ms1 = performance.now() - t1

    const { skill: lanza, cell: c2 } = montarCrudo(`
      function girar() { let n = 0; while (true) { n++ } }
      export function* habilidad(ctx) { ctx.phase('girar'); girar() }
    `)
    const r2 = new SkillRun(lanza as never, mundoMudo(), undefined as never, { by: ACTOR, cell: c2 })
    const t2 = performance.now()
    const p2 = r2.step()
    const ms2 = performance.now() - t2

    console.log(
      `\n  while(true) en el cuerpo   → ${p1.k} en ${ms1.toFixed(3)} ms (${((ms1 / TICK) * 100).toFixed(1)}% del cuadro)` +
        `\n  while(true) en una función → ${p2.k} en ${ms2.toFixed(3)} ms (${((ms2 / TICK) * 100).toFixed(1)}% del cuadro)`,
    )
    expect(p1.k).toBe('suspendida')
    expect(p2.k).toBe('rota')
    if (p2.k === 'rota') expect(p2.why).toMatch(/combustible/)
    expect(ms1).toBeLessThan(TICK)
    expect(ms2).toBeLessThan(TICK)
  })

  const RECURSIVA = `
      function hondo(n) { return hondo(n + 1) }
      export function* habilidad(ctx) { ctx.phase('cavar'); hondo(0) }
    `

  it('(c) una recursión infinita también se corta, con su fase y en menos de un cuadro', () => {
    // Con el tanque DE PRODUCCIÓN, que es el que va a estar puesto.
    const { skill, cell } = montarCrudo(RECURSIVA)
    const run = new SkillRun(skill as never, mundoMudo(), undefined as never, { by: ACTOR, cell })
    const t = performance.now()
    const paso = run.step()
    const ms = performance.now() - t
    console.log(
      `\n  recursión infinita, tanque de producción (${FUEL_POR_PASO}) → ${paso.k} en ${ms.toFixed(3)} ms ` +
        `(${((ms / TICK) * 100).toFixed(1)}% del cuadro)`,
    )
    expect(paso.k).toBe('rota')
    // Lo que el criterio compra es que el corte sea ADMINISTRABLE: llega con su
    // fase, y por eso el carril de mejora puede decir «muere en cavar» en vez de
    // «se rompió».
    if (paso.k === 'rota') {
      expect(paso.phase).toBe('cavar')
      expect(paso.why).toMatch(/recursión sin fondo/)
    }
    expect(ms).toBeLessThan(TICK)
  })

  it('(c) EL NÚMERO QUE FALTABA: con el tanque de producción la mata la PILA, no el combustible', () => {
    // El ADR II-0005 dejó escrito que la recursión infinita «muere por
    // combustible y no por RangeError», y conservó por eso la instrumentación de
    // las entradas de función. Es cierto — y tiene una condición que nadie había
    // medido: **el tanque tiene que ser más chico que la pila**.
    //
    // Se barre el tanque y se busca dónde cambia la causa de muerte. El número
    // no es una constante del proyecto: es de este motor y de este entorno, y por
    // eso se mide acá en vez de escribirse en un comentario.
    const causaCon = (tanque: number): string => {
      const { js } = instrument(ts, 'export function hondo(n) { return hondo(n + 1) }')
      const m = mount(js, {})
      m.cell.refill(tanque)
      try {
        ;(m.exports['hondo'] as (n: number) => number)(0)
        return 'no murió'
      } catch (e) {
        return e instanceof OutOfFuel ? 'combustible' : e instanceof RangeError ? 'pila' : 'otra'
      }
    }
    const barrido = [1_000, 5_000, 10_000, 20_000, 50_000, FUEL_POR_PASO].map((t) => ({ t, causa: causaCon(t) }))
    console.log(
      `\n  causa de muerte de la recursión infinita, por tamaño de tanque:\n` +
        barrido.map((b) => `  ${String(b.t).padStart(7)} → ${b.causa}`).join('\n'),
    )
    // Con tanques chicos gana el combustible; con el de producción gana la pila.
    expect(barrido.find((b) => b.t === 1_000)?.causa).toBe('combustible')
    expect(barrido.find((b) => b.t === 10_000)?.causa).toBe('combustible')
    expect(barrido.find((b) => b.t === FUEL_POR_PASO)?.causa).toBe('pila')
    // Y en los dos casos el ejecutor corta con la fase, que es lo que importa:
    // lo verifica el test de arriba. Lo que se pierde con el tanque grande es el
    // NOMBRE del error, no el corte.
  })
})

describe('el hallazgo que salió de montar las quince de verdad: un tanque por MÓDULO', () => {
  it('sin `unirCeldas`, una habilidad partida en dos módulos muere en la primera llamada al ayudante', () => {
    // El contador `__fuelLeft` es una variable del alcance de cada `mount()`. El
    // ejecutor recarga UNA celda. En cuanto la habilidad llama a un ayudante que
    // vive en otro módulo, ese módulo arranca en cero y lanza `OutOfFuel` en su
    // primera vuelta de bucle — y el informe dice «se pasó del presupuesto»
    // sobre una habilidad que no gastó nada.
    //
    // Es literalmente lo que pasó: ONCE de las quince innatas murieron así la
    // primera vez que se las montó de verdad, todas en `comun.js`.
    const ayudante = mount(instrument(ts, 'export function sumar(n) { let s = 0; for (let i = 0; i < n; i++) s += i; return s }').js, {})
    const principal = mount(
      instrument(ts, `import { sumar } from './comun.js'\nexport function* habilidad(ctx) { ctx.phase('sumar'); const s = sumar(50); yield { k: 'wait' }; return { ok: true, got: s } }`).js,
      { modules: { './comun.js': ayudante.exports } },
    )
    const skill = principal.exports['habilidad'] as Generadora

    const sinUnir = new SkillRun(skill as never, mundoMudo(), undefined as never, { by: ACTOR, cell: principal.cell })
    const roto = sinUnir.step()
    expect(roto.k).toBe('rota')
    if (roto.k === 'rota') {
      expect(roto.why).toMatch(/combustible/)
      expect(roto.phase).toBe('sumar')
    }
    console.log(`\n  sin unirCeldas: ${roto.k} · gastado del tanque que sí se recarga: ${principal.cell.spent}`)

    const conUnir = new SkillRun(skill as never, mundoMudo(), undefined as never, {
      by: ACTOR,
      cell: unirCeldas([principal.cell, ayudante.cell]),
    })
    const bien = conUnir.step()
    expect(bien.k).toBe('intent')
  })
})

// ─── (d) y (e) SOBRE UNA INNATA DE VERDAD ───────────────────────────────────

describe('(d) y (e) el hash y la continuidad, sobre una innata de verdad', () => {
  /** El mismo mundo, dos veces. Determinista por construcción: nadie tira dados. */
  const mundoDeJuntar = (): Mundito =>
    new Mundito({
      cuerpos: [
        { id: 'a', at: { x: 1, y: 0 }, name: 'vara', q: { rigidity: 0.9, portable: 1 } },
        { id: 'b', at: { x: 2, y: 0 }, name: 'vara', q: { rigidity: 0.9, portable: 1 } },
        { id: 'c', at: { x: 3, y: 0 }, name: 'vara', q: { rigidity: 0.9, portable: 1 } },
      ],
    })

  function correrJuntar(cuantos: number, saved?: { phase: string; memory: Readonly<Record<string, unknown>> }) {
    const m = mundoDeJuntar()
    const { skill, cell } = innata('juntar', 'juntar')
    const o = saved === undefined ? { by: ACTOR, cell } : { by: ACTOR, cell, saved }
    const run = new SkillRun(skill as never, worldCtx(m), { que: [{ q: 'rigidity', op: '>=', v: 0.5 }], cuantos } as never, o)
    let resultado: StepResult | undefined
    let paso: Step
    let n = 0
    for (;;) {
      paso = run.step(resultado)
      resultado = undefined
      if (paso.k === 'terminada' || paso.k === 'rota' || ++n > 200) break
      if (paso.k === 'intent') resultado = m.juzgar(paso.intent)
    }
    return { run, m, paso, pasos: n }
  }

  it('(d) `juntar` corrida dos veces sobre el mismo mundo da el mismo hash', () => {
    const a = correrJuntar(3)
    const b = correrJuntar(3)
    console.log(`\n  hash de juntar: ${a.run.hash()} y ${b.run.hash()}`)
    expect(a.run.hash()).toBe(b.run.hash())
    expect(a.run.hash()).toMatch(/^[0-9a-f]{16}$/)
  })

  it('(d) y una corrida distinta da OTRO hash: un hash que siempre da igual no mide nada', () => {
    const a = correrJuntar(3)
    const c = correrJuntar(1)
    expect(a.run.hash()).not.toBe(c.run.hash())
  })

  it('(e) interrumpida por un guardado, `ir` retoma su presupuesto, llega, y no repite lo gastado', () => {
    // El criterio del documento NO es comparar hashes: es que el objetivo se
    // ALCANCE y que REPITA POCO. Un generador suspendido no se serializa en
    // ningún motor de JS, así que al cargar la partida la habilidad arranca de
    // arriba — lo único que sobrevive es `ctx.memory` y la fase.
    //
    // El escenario es el que hace que la diferencia se pueda ver: la criatura
    // choca contra algo (`celda-ocupada` es el único motivo que MEJORA
    // esperando, y por eso `ir` reintenta) y se guarda a mitad de los reintentos.
    const { skill } = innata('ir', 'ir')
    const conObstaculo = (): Mundito =>
      new Mundito({
        cuerpos: [{ id: 'p', at: { x: 9, y: 3 }, name: 'piedra', q: {} }],
        rechaza: { goTo: 'celda-ocupada' },
      })

    // ── Antes del guardado: tres reintentos quemados contra el obstáculo ────
    const m1 = conObstaculo()
    const primera = new SkillRun(skill as never, worldCtx(m1), { a: vista(m1, 'p'), within: 1, reintentos: 8 } as never, { by: ACTOR })
    let res: StepResult | undefined
    for (let i = 0; i < 3; i++) {
      const p = primera.step(res)
      res = p.k === 'intent' ? m1.juzgar(p.intent) : undefined
    }
    const guardado = primera.save()
    const gastadosAntes = m1.emitidas.length
    expect(gastadosAntes).toBe(3)
    expect(guardado.phase).toBe('ir')

    // ── Se carga la partida. El obstáculo se fue (el mundo siguió andando) ──
    const m2 = new Mundito({
      cuerpos: [{ id: 'p', at: { x: 9, y: 3 }, name: 'piedra', q: {} }],
      yo: { at: { x: 5, y: 2 } },
    })
    const segunda = new SkillRun(skill as never, worldCtx(m2), { a: vista(m2, 'p'), within: 1, reintentos: 8 } as never, {
      by: ACTOR,
      saved: guardado,
    })
    let paso: Step
    let n = 0
    res = undefined
    for (;;) {
      paso = segunda.step(res)
      res = undefined
      if (paso.k === 'terminada' || paso.k === 'rota' || ++n > 50) break
      if (paso.k === 'intent') res = m2.juzgar(paso.intent)
    }
    // CONVERGE: alcanzó el objetivo.
    expect(paso.k).toBe('terminada')
    if (paso.k === 'terminada') expect(paso.outcome.ok).toBe(true)
    const p = m2.cuerpo('p')
    expect(p).toBeDefined()
    if (p) {
      const d = Math.max(Math.abs(m2.posicion.x - p.at.x), Math.abs(m2.posicion.y - p.at.y))
      expect(d, 'no llegó').toBeLessThanOrEqual(1)
    }

    // ── Y REPITE POCO, con número: el presupuesto de reintentos NO se resetea ──
    // Se mide contra el contrafáctico: la misma habilidad cargada SIN el
    // guardado, en el mismo mundo con el obstáculo puesto, gasta los ocho. Con
    // el guardado gasta los cinco que le quedaban. Los tres ya pagados no se
    // vuelven a pagar, que es lo que «no repite» significa acá.
    const gastar = (saved?: typeof guardado): number => {
      const m = conObstaculo()
      const o = saved === undefined ? { by: ACTOR } : { by: ACTOR, saved }
      const r = new SkillRun(skill as never, worldCtx(m), { a: vista(m, 'p'), within: 1, reintentos: 8 } as never, o)
      let x: StepResult | undefined
      for (let i = 0; i < 40; i++) {
        const s = r.step(x)
        if (s.k !== 'intent') break
        x = m.juzgar(s.intent)
      }
      return m.emitidas.length
    }
    const desdeCero = gastar()
    const desdeGuardado = gastar(guardado)
    console.log(
      `\n  ir, interrumpida por un guardado en la fase "${guardado.phase}" con ${JSON.stringify(guardado.memory)}:` +
        `\n    llega al objetivo en ${n} pasos` +
        `\n    reintentos que gasta desde cero        : ${desdeCero}` +
        `\n    reintentos que gasta desde el guardado : ${desdeGuardado} (los ${gastadosAntes} de antes no se repiten)`,
    )
    expect(desdeCero).toBe(8)
    expect(desdeGuardado).toBe(8 - gastadosAntes)
  })

  it('(e) el contraste: lo que NO sobrevive es lo que vive en una local', () => {
    // La otra mitad de la medición. `ir` converge porque su cuenta de reintentos
    // vive en `ctx.memory`. Con la misma cuenta en una variable local, el
    // guardado sale vacío y al cargar se repite todo — y el test lo muestra en
    // vez de afirmarlo.
    const conMemoria = montarCrudo(`
      export function* habilidad(ctx) {
        ctx.phase('contar')
        let i = ctx.memory.get('i') || 0
        for (; i < 10; i++) { ctx.memory.set('i', i); yield { k: 'wait' } }
        return { ok: true }
      }
    `)
    const conLocal = montarCrudo(`
      export function* habilidad(ctx) {
        ctx.phase('contar')
        for (let i = 0; i < 10; i++) { yield { k: 'wait' } }
        return { ok: true }
      }
    `)
    const respuesta: StepResult = { status: 'done', got: [] }
    const avanzar = (r: SkillRun<unknown>, n: number): void => {
      let res: StepResult | undefined
      for (let i = 0; i < n; i++) {
        const p = r.step(res)
        res = p.k === 'intent' ? respuesta : undefined
        if (p.k !== 'intent') break
      }
    }
    // OJO con el `cell`: sin él, `__fuelLeft` arranca en 0 y el primer
    // `--__fuelLeft < 0` cede la suspensión antes de la primera línea. Una
    // habilidad montada y corrida sin su celda no falla: se queda suspendida
    // para siempre, y a las N suspensiones el ejecutor la declara trabada.
    const a = new SkillRun(conMemoria.skill as never, mundoMudo(), undefined as never, { by: ACTOR, cell: conMemoria.cell })
    avanzar(a, 11)
    const b = new SkillRun(conLocal.skill as never, mundoMudo(), undefined as never, { by: ACTOR, cell: conLocal.cell })
    avanzar(b, 11)
    console.log(
      `\n  guardado con la cuenta en ctx.memory: ${JSON.stringify(a.save().memory)}` +
        `\n  guardado con la cuenta en una local : ${JSON.stringify(b.save().memory)}`,
    )
    expect(Object.keys(a.save().memory)).toEqual(['i'])
    expect(Object.keys(b.save().memory)).toEqual([])
  })
})

// ─── (f) EL RECHAZO, EN MENOS DE 250 ms Y SIN VIAJE ─────────────────────────

describe('(f) un programa mal tipado se rechaza en menos de 250 ms sin viaje al modelo', () => {
  // La ranura fija: un `LanguageService` con la candidata SIEMPRE en el mismo
  // path, del que solo cambian el contenido y la versión. Es lo que la fragua
  // del Hito 8 hace de verdad, y es lo que el banco del Hito 0 midió: cambiar la
  // lista de archivos raíz invalida la reutilización de estructura de TypeScript
  // y ahí se va todo el presupuesto.
  const PAQUETE = resolve(__dirname, '..')
  const API_DTS = join(PAQUETE, 'src/skill-api.d.ts').split('\\').join('/')
  const RANURA = join(PAQUETE, 'src/__candidata.ts').split('\\').join('/')

  const OPCIONES: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noEmit: true,
    skipLibCheck: true,
    lib: ['lib.es2022.d.ts'],
    types: [],
  }

  const versiones = new Map<string, string>([
    [API_DTS, '1'],
    [RANURA, '0'],
  ])
  const contenidos = new Map<string, string>([[RANURA, '']])

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [API_DTS, RANURA],
    getScriptVersion: (f) => versiones.get(f) ?? '1',
    getScriptSnapshot: (f) => {
      const propio = contenidos.get(f)
      if (propio !== undefined) return ts.ScriptSnapshot.fromString(propio)
      return ts.sys.fileExists(f) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(f) ?? '') : undefined
    },
    getCurrentDirectory: () => PAQUETE,
    getCompilationSettings: () => OPCIONES,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (f) => contenidos.has(f) || ts.sys.fileExists(f),
    readFile: (f) => contenidos.get(f) ?? ts.sys.readFile(f),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  }
  const servicio = ts.createLanguageService(host, ts.createDocumentRegistry())

  /** La puerta completa: escáner de determinismo + typecheck. Sin red. */
  function portón(fuente: string): { hallazgos: number; errores: string[]; ms: number } {
    contenidos.set(RANURA, fuente)
    versiones.set(RANURA, String(Number(versiones.get(RANURA)) + 1))
    const t = performance.now()
    const hallazgos = scanDeterminism(ts, fuente, '__candidata.ts')
    const diags = [
      ...servicio.getSyntacticDiagnostics(RANURA),
      ...servicio.getSemanticDiagnostics(RANURA),
    ]
    const ms = performance.now() - t
    return {
      hallazgos: hallazgos.length,
      errores: diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')),
      ms,
    }
  }

  const CABECERA = `import type { BodyView, Ctx, Intent, Outcome, StepResult } from './skill-api.js'\nimport { done, fail } from './skill-api.js'\n`

  // Se calienta con una candidata sana. La PRIMERA consulta de la sesión crea el
  // Program y carga `lib.es2022.d.ts`: eso lo mide el banco del Hito 0 y su
  // criterio de corte son 3 s. Éste mide la consulta 2 en adelante, que es la que
  // el bucle de reparación paga diez veces.
  portón(`${CABECERA}export function* sana(ctx: Ctx): Generator<Intent, Outcome, StepResult> {\n  yield ctx.wait(1)\n  return done()\n}\n`)

  /** Seis formas de estar mal tipado, una por clase de error que el corpus produjo. */
  const MALOS: readonly { readonly nombre: string; readonly fuente: string; readonly espera: RegExp }[] = [
    {
      nombre: 'una cualidad que no existe',
      fuente: `${CABECERA}export function* f(ctx: Ctx): Generator<Intent, Outcome, StepResult> {\n  const a = ctx.see([{ q: 'wet', op: '>=', v: 0.9 }])[0]\n  return a ? done(a) : fail('no')\n}\n`,
      espera: /QualityId/,
    },
    {
      nombre: 'un campo que la superficie no tiene',
      fuente: `${CABECERA}export function* f(ctx: Ctx): Generator<Intent, Outcome, StepResult> {\n  return ctx.self.hunger > 5 ? done() : fail('no')\n}\n`,
      espera: /hunger/,
    },
    {
      nombre: 'un rol mal escrito',
      fuente: `${CABECERA}export function* f(ctx: Ctx, a: BodyView): Generator<Intent, Outcome, StepResult> {\n  yield ctx.apply('extraccion', { gera: a, source: a })\n  return done()\n}\n`,
      espera: /gera/,
    },
    {
      nombre: 'un rol que falta',
      fuente: `${CABECERA}export function* f(ctx: Ctx, a: BodyView): Generator<Intent, Outcome, StepResult> {\n  yield ctx.apply('friccion', { a, b: a })\n  return done()\n}\n`,
      espera: /actor/,
    },
    {
      nombre: 'un proceso que no existe',
      fuente: `${CABECERA}export function* f(ctx: Ctx, a: BodyView): Generator<Intent, Outcome, StepResult> {\n  yield ctx.apply('afilar', { a, b: a, actor: a })\n  return done()\n}\n`,
      espera: /afilar/,
    },
    {
      nombre: 'el índice sin guarda (el error más frecuente del corpus)',
      fuente: `${CABECERA}export function* f(ctx: Ctx): Generator<Intent, Outcome, StepResult> {\n  const b = ctx.see([{ q: 'mass', op: '>=', v: 1 }])[0]\n  yield ctx.take(b)\n  return done(b)\n}\n`,
      espera: /undefined/,
    },
  ]

  it('los seis se rechazan, y el error dice cuál es el problema', () => {
    for (const m of MALOS) {
      const r = portón(m.fuente)
      expect(r.errores.length, `${m.nombre} NO fue rechazado`).toBeGreaterThan(0)
      expect(r.errores.join(' | '), `${m.nombre}: el error no nombra el problema`).toMatch(m.espera)
    }
  })

  it('y se rechazan en menos de 250 ms cada uno, sin salir de la máquina', () => {
    const tiempos = MALOS.map((m) => ({ nombre: m.nombre, ms: portón(m.fuente).ms }))
    const peor = tiempos.reduce((a, b) => (a.ms > b.ms ? a : b))
    console.log(
      `\n  el portón (escáner de determinismo + typecheck en ranura fija):\n` +
        tiempos.map((t) => `  ${t.nombre.padEnd(46)} ${t.ms.toFixed(1).padStart(6)} ms`).join('\n') +
        `\n\n  PEOR: ${peor.ms.toFixed(1)} ms contra el presupuesto de 250 ms (margen ${(250 / peor.ms).toFixed(0)}×).` +
        `\n  Un viaje al modelo son 6000 a 25000 ms.`,
    )
    for (const t of tiempos) expect(t.ms, `${t.nombre} tardó ${t.ms.toFixed(1)} ms`).toBeLessThan(250)
  })

  it('lo que el typecheck no ve lo ve el escáner, y también sin viaje', () => {
    // `Math.random()` typechequea PERFECTO: es JavaScript válido y tipado. Lo que
    // lo rechaza es el escáner de determinismo, y por eso corre ANTES y no
    // después. Sin él, ese programa llegaría al mundo y haría divergir el replay
    // en el tick 400 — el modo de falla que la regla 2 de `ii/` existe para
    // evitar.
    const fuente = `${CABECERA}export function* f(ctx: Ctx): Generator<Intent, Outcome, StepResult> {\n  const x = Math.random() ** 2\n  return x > 0.5 ? done() : fail('no')\n}\n`
    const r = portón(fuente)
    expect(r.errores).toEqual([])
    expect(r.hallazgos).toBeGreaterThanOrEqual(2) // `Math.random` y `**`
    console.log(`\n  Math.random() ** 2 → 0 errores de tipos, ${r.hallazgos} hallazgos del escáner, ${r.ms.toFixed(1)} ms`)
    expect(r.ms).toBeLessThan(250)
  })

  it('una habilidad sana pasa el portón: una puerta que rechaza todo no mide nada', () => {
    const sana = `${CABECERA}export function* f(ctx: Ctx, args: { con: BodyView }): Generator<Intent, Outcome, StepResult> {\n  ctx.phase('pescar')\n  const pozo = ctx.recall([{ q: 'wet', op: '>=', v: 0.9 }])[0]\n  if (!pozo) return fail('no me acuerdo de ningún pozo')\n  const ir = yield ctx.goTo(pozo.at, { within: 1 })\n  if (ir.status !== 'arrived') return fail('no llegué')\n  for (let i = 0; i < 40; i++) {\n    const o = yield ctx.apply('extraccion', { gear: args.con, source: args.con })\n    const p = o.got[0]\n    if (p) return done(p)\n  }\n  return fail('no picó')\n}\n`
    const r = portón(sana)
    expect(r.errores).toEqual([])
    expect(r.hallazgos).toBe(0)
  })
})

// ─── El inventario, para que el criterio no se pueda declarar a ojo ─────────

describe('el inventario del Hito 4', () => {
  it('las quince innatas existen como archivos, y son quince', () => {
    const archivos = readdirSync(INNATAS_DIR)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => !['index.ts', 'contrato.ts', 'comun.ts'].includes(f))
    expect(archivos.length).toBe(15)
  })

  it('las quince se montan sin que ninguna toque un global prohibido', () => {
    // Montar YA corrió el cuerpo de cada módulo adentro del alcance sombreado, y
    // el escáner mira lo que el alcance no puede tapar (`**`, `localeCompare`,
    // `toLocaleString`). Las dos mitades, sobre el código de verdad.
    const sucias: string[] = []
    for (const f of readdirSync(INNATAS_DIR).filter((x) => x.endsWith('.ts'))) {
      const hallazgos = scanDeterminism(ts, readFileSync(join(INNATAS_DIR, f), 'utf8'), f)
      if (hallazgos.length > 0) sucias.push(`${f}: ${hallazgos.map((h) => h.what).join(', ')}`)
    }
    expect(sucias, `usan algo no determinista: ${sucias.join(' · ')}`).toEqual([])
  })
})

// Un tipo que el archivo usa y `tsc` tiene que ver aunque no se instancie.
export type _Cell = Cell
