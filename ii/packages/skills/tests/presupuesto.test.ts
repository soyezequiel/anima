import { performance } from 'node:perf_hooks'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import {
  FRACCION_COMPUTO,
  FRACCION_INSTRUMENTAR,
  FUEL_POR_PASO,
  HZ_DE_REFERENCIA,
  instrument,
  mount,
  tickMs,
} from '../src/combustible.js'

/**
 * EL PRESUPUESTO — el criterio del ADR II-0005, re-medido sobre el código de
 * PRODUCCIÓN y no sobre el prototipo del banco.
 *
 *   costo de instrumentar    ≤  2% del tick
 *   cómputo de una habilidad ≤ 10% del tick
 *
 * y el tick es el del ADR II-0007: una FRACCIÓN y no milisegundos, con 20 Hz
 * —50 ms— como frecuencia de referencia del ADR II-0008. Los tres números salen
 * de `combustible.ts` y no están escritos acá: quien mide no elige contra qué.
 *
 * ─── Por qué este archivo usa `performance.now` ─────────────────────────────
 *
 * La regla 2 prohíbe el reloj de pared en los paquetes deterministas, y este
 * test lo usa. No es una excepción cómoda: la regla prohíbe que el MUNDO lea el
 * reloj, porque eso hace divergir el replay. Un banco que mide milisegundos
 * tiene que leer milisegundos, y su resultado no entra a ningún estado ni a
 * ningún hash. El banco del Hito 0 hace exactamente lo mismo por la misma razón.
 *
 * ─── El arnés, esta vez, no cobra ───────────────────────────────────────────
 *
 * El ADR II-0007 avisa que medir bajo vitest infla ~30% (`paso()` da 7,7 ms bajo
 * vitest contra 5,9 en node suelto), así que estos números se cruzaron contra
 * los mismos montajes corridos en node suelto: 0,272 ms crudo y 0,366
 * instrumentado allá, contra 0,254 y 0,352 acá. La diferencia está en el ruido.
 * El motivo es que lo que se mide corre adentro de un `new Function` propio y no
 * pasa por el transformador de módulos del arnés.
 */

// La misma carga realista del banco del Hito 0: un generador que recorre la
// percepción, puntúa candidatos y cede el tick. No es un bucle numérico apretado
// —eso sobreestimaría el overhead— ni algo con I/O —eso lo escondería.
const CARGA = `
export function* habilidad(ctx, pasos) {
  let hechos = 0
  for (let i = 0; i < pasos; i++) {
    const vistos = ctx.see()
    let mejor = null
    let puntaje = -1
    for (const b of vistos) {
      const p = b.masa * b.nutricion * (1 - b.toxicidad)
      if (p > puntaje) { puntaje = p; mejor = b }
    }
    if (!mejor) return hechos
    yield { tipo: 'ir', a: mejor }
    hechos++
  }
  return hechos
}
`

const opciones = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }

/** Sin instrumentar, pero con el MISMO envoltorio: se mide la inyección sola. */
const crudo = mount(ts.transpileModule(CARGA, { compilerOptions: opciones }).outputText, {})
const conCombustible = mount(instrument(ts, CARGA).js, {})

// Datos deterministas: nada de `Math.random`, ni acá.
let semilla = 12345
const siguiente = (): number => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const vistos = Array.from({ length: 40 }, () => ({
  masa: siguiente(),
  nutricion: siguiente() * 10,
  toxicidad: siguiente() * 0.3,
}))
const ctxFalso = { see: () => vistos }
const PASOS = 4000

type Fabrica = (ctx: unknown, pasos: number) => Generator<unknown, number, unknown>

const correr = (m: typeof crudo): void => {
  m.cell.refill(1e9)
  const g = (m.exports['habilidad'] as Fabrica)(ctxFalso, PASOS)
  let r = g.next()
  while (!r.done) r = g.next()
}

const mediana = (xs: number[]): number => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0

// Calentamiento del JIT: sin esto se mide la compilación y no el código. La
// primera versión del banco del Hito 0 midió −20% de overhead —o sea que lo
// instrumentado salía más rápido que lo crudo, que es imposible— porque el ruido
// del timer dominaba corridas de 0,077 ms. Corridas de milisegundos, variantes
// INTERCALADAS y mediana.
for (let i = 0; i < 10; i++) {
  correr(crudo)
  correr(conCombustible)
}

const muestras: Record<'crudo' | 'fuel', number[]> = { crudo: [], fuel: [] }
for (let r = 0; r < 40; r++) {
  const orden: ['crudo' | 'fuel', typeof crudo][] =
    r % 2 === 0
      ? [
          ['crudo', crudo],
          ['fuel', conCombustible],
        ]
      : [
          ['fuel', conCombustible],
          ['crudo', crudo],
        ]
  for (const [nombre, m] of orden) {
    const t0 = performance.now()
    correr(m)
    muestras[nombre].push(performance.now() - t0)
  }
}

const tCrudo = mediana(muestras.crudo)
const tFuel = mediana(muestras.fuel)
const TICK = tickMs(HZ_DE_REFERENCIA)
const costo = tFuel - tCrudo

describe(`el presupuesto contra el tick de ${TICK} ms (${HZ_DE_REFERENCIA} Hz)`, () => {
  it(`instrumentar cuesta menos del ${FRACCION_INSTRUMENTAR * 100}% del tick`, () => {
    console.log(
      `  instrumentar: ${costo.toFixed(3)} ms = ${((costo / TICK) * 100).toFixed(2)}% del tick ` +
        `(tope ${(TICK * FRACCION_INSTRUMENTAR).toFixed(2)} ms, margen ${((TICK * FRACCION_INSTRUMENTAR) / costo).toFixed(1)}×)`,
    )
    expect(costo).toBeLessThanOrEqual(TICK * FRACCION_INSTRUMENTAR)
  })

  it(`la habilidad instrumentada computa menos del ${FRACCION_COMPUTO * 100}% del tick`, () => {
    // El segundo umbral, y el que hay que vigilar: el margen de hoy es con UNA
    // habilidad viva. Con varias, más cuerpos a la vista y percepciones más
    // grandes, este número sube y el otro no.
    console.log(
      `  cómputo:      ${tFuel.toFixed(3)} ms = ${((tFuel / TICK) * 100).toFixed(2)}% del tick ` +
        `(tope ${(TICK * FRACCION_COMPUTO).toFixed(2)} ms, margen ${((TICK * FRACCION_COMPUTO) / tFuel).toFixed(1)}×)`,
    )
    expect(tFuel).toBeLessThanOrEqual(TICK * FRACCION_COMPUTO)
  })

  it('instrumentar no cambia el resultado', () => {
    // Un banco que mide dos programas distintos no mide nada.
    crudo.cell.refill(1e9)
    conCombustible.cell.refill(1e9)
    const a = (crudo.exports['habilidad'] as Fabrica)(ctxFalso, 7)
    const b = (conCombustible.exports['habilidad'] as Fabrica)(ctxFalso, 7)
    let ra = a.next()
    let rb = b.next()
    while (!ra.done && !rb.done) {
      expect(rb.value).toEqual(ra.value)
      ra = a.next()
      rb = b.next()
    }
    expect(rb.done).toBe(true)
    expect(rb.value).toBe(ra.value)
  })

  it('el tanque por paso es del orden de medio milisegundo de cómputo', () => {
    // `FUEL_POR_PASO` se justifica con una medición y no con un número redondo:
    // lo que se afirma es que agotarlo cuesta bastante menos que el 10% del tick,
    // o sea que una habilidad que lo agota no está pensando, está colgada.
    conCombustible.cell.refill(FUEL_POR_PASO)
    const t0 = performance.now()
    const g = (conCombustible.exports['habilidad'] as Fabrica)(ctxFalso, PASOS)
    let r = g.next()
    while (!r.done && conCombustible.cell.left > 0) r = g.next()
    const gastado = performance.now() - t0
    console.log(`  ${FUEL_POR_PASO} de combustible ≈ ${gastado.toFixed(3)} ms`)
    expect(gastado).toBeLessThanOrEqual(TICK * FRACCION_COMPUTO)
  })
})
