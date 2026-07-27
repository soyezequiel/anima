/**
 * BANCO DE COMBUSTIBLE — el segundo criterio de corte del Hito 0.
 *
 * El criterio original del plan de construcción decía:
 *
 *   «si el transformer de combustible cuesta más del 15% de overhead, el plan
 *    del sandbox cambia ACÁ y no después de construirle encima.»
 *
 * Se midió, se pasó (22–52%), y el ADR II-0005 lo REEMPLAZÓ: el presupuesto se
 * mide contra el tick y no contra sí mismo. Una razón sobre un número chico no
 * describe ningún problema del producto — 22% de 0.25 ms son 0.13 ms en un
 * cuadro de 33. Los umbrales de hoy son absolutos y están abajo.
 *
 * La razón vieja se sigue reportando porque es informativa; ya no manda.
 *
 * Mide tres cosas, y las tres importan:
 *   1. el overhead en tiempo de ejecución del código instrumentado
 *   2. que un bucle infinito EFECTIVAMENTE se corte (si no, el transformer no
 *      sirve por más barato que sea)
 *   3. que la suspensión sea reanudable, que es lo que QuickJS no podía dar
 *
 *   node ii/packages/skills/banco/combustible.mjs
 */
import ts from 'typescript'
import { performance } from 'node:perf_hooks'
import { crearTransformerDeCombustible, contarPuntosDeInyeccion } from './fuel-transformer.mjs'

// ─── LA CARGA DE TRABAJO ────────────────────────────────────────────────────
// Tiene que parecerse a lo que hace una habilidad de verdad, no a un benchmark
// de laboratorio: recorrer la percepción, filtrar por cualidades, puntuar
// candidatos, elegir. Bucles anidados sobre arrays chicos y aritmética simple.
// Si midiéramos un bucle numérico apretado, el overhead saldría enorme y sería
// mentira; si midiéramos algo con I/O, saldría cero y también.
const CARGA = `
export function correr(cuerpos, veces) {
  let elegido = -1
  let mejor = -1
  for (let vuelta = 0; vuelta < veces; vuelta++) {
    for (let i = 0; i < cuerpos.length; i++) {
      const c = cuerpos[i]
      if (c.temperatura < 60) continue
      if (c.humedad > 0.45) continue
      const k = (c.temperatura - c.desnaturaliza) / 100
      if (k <= 0) continue
      const tasa = (0.01 * k) / (0.2 + c.dureza)
      const puntaje = puntuar(c, tasa)
      if (puntaje > mejor) { mejor = puntaje; elegido = i }
    }
  }
  return elegido
}

function puntuar(c, tasa) {
  let acc = 0
  for (const p of c.partes) acc += p.masa * p.nutricion
  return acc * tasa * (1 - c.toxicidad)
}
`

const opciones = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }

const crudo = ts.transpileModule(CARGA, { compilerOptions: opciones }).outputText
const instrumentado = ts.transpileModule(CARGA, {
  compilerOptions: opciones,
  transformers: { before: [crearTransformerDeCombustible(ts)] },
}).outputText

const enLinea = ts.transpileModule(CARGA, {
  compilerOptions: opciones,
  transformers: { before: [crearTransformerDeCombustible(ts, { modo: 'inline' })] },
}).outputText

const puntos = contarPuntosDeInyeccion(ts, CARGA)

// ─── MONTAJE ────────────────────────────────────────────────────────────────
const aModulo = (src) => 'data:text/javascript;base64,' + Buffer.from(src).toString('base64')

// El contador real: lo más barato posible, porque va en el camino caliente.
// Un entero y una comparación. Cuando se agota, lanza un objeto centinela que
// el ejecutor distingue de un error del programa.
const PRELUDIO = `
let __fuelLeft = 0
export class SinCombustible { constructor(g) { this.gastado = g } }
export function __fuelOut() { throw new SinCombustible(0) }
export function __fuel() { if (--__fuelLeft < 0) __fuelOut() }
export function __setFuel(n) { __fuelLeft = n }
export function __fuelUsed(n) { return n - __fuelLeft }
`

const modCrudo = await import(aModulo(crudo))
const modInstr = await import(aModulo(PRELUDIO + instrumentado))
const modLinea = await import(aModulo(PRELUDIO + enLinea))

// ─── DATOS ──────────────────────────────────────────────────────────────────
// Deterministas: nada de Math.random, ni acá.
const cuerpos = []
let semilla = 12345
const siguiente = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
for (let i = 0; i < 200; i++) {
  const partes = []
  for (let j = 0; j < 3; j++) partes.push({ masa: siguiente(), nutricion: siguiente() * 10 })
  cuerpos.push({
    temperatura: 20 + siguiente() * 200,
    humedad: siguiente(),
    desnaturaliza: 40 + siguiente() * 60,
    dureza: siguiente(),
    toxicidad: siguiente() * 0.3,
    partes,
  })
}

// ─── MEDICIÓN ───────────────────────────────────────────────────────────────
// La primera versión de este banco usaba VUELTAS=60, que daba corridas de
// 0.077 ms, y la variante en línea salía 20% MÁS RÁPIDA que el código sin
// instrumentar. Eso es imposible, y era la señal de que el ruido del timer y
// del JIT dominaba la medida. Con corridas de milisegundos y las tres
// variantes INTERCALADAS en cada ronda, el sesgo sistemático desaparece.
const VUELTAS = 2000
const RONDAS = 60
const mediana = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]

const cronometrar = (fn) => {
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

// Calentamiento del JIT: sin esto se mide la compilación, no el código.
for (let i = 0; i < 12; i++) {
  modCrudo.correr(cuerpos, VUELTAS)
  modInstr.__setFuel(1e9)
  modInstr.correr(cuerpos, VUELTAS)
  modLinea.__setFuel(1e9)
  modLinea.correr(cuerpos, VUELTAS)
}

const muestras = { crudo: [], llamada: [], linea: [] }
for (let r = 0; r < RONDAS; r++) {
  // Intercaladas y con el orden rotando, para que ninguna variante se lleve
  // sistemáticamente el mismo estado de caché o de recolector.
  const orden = [
    ['crudo', () => modCrudo.correr(cuerpos, VUELTAS)],
    ['llamada', () => { modInstr.__setFuel(1e9); modInstr.correr(cuerpos, VUELTAS) }],
    ['linea', () => { modLinea.__setFuel(1e9); modLinea.correr(cuerpos, VUELTAS) }],
  ]
  for (let i = 0; i < 3; i++) {
    const [nombre, fn] = orden[(r + i) % 3]
    muestras[nombre].push(cronometrar(fn))
  }
}

const tCrudo = mediana(muestras.crudo)
const tInstr = mediana(muestras.llamada)
const tLinea = mediana(muestras.linea)
const overhead = (tInstr / tCrudo - 1) * 100
const overheadLinea = (tLinea / tCrudo - 1) * 100

// ─── LA CARGA REALISTA ──────────────────────────────────────────────────────
// La de arriba es el PEOR CASO: puro cómputo apretado, sin ceder nunca. Una
// habilidad de verdad es un generador que hace un poco de cuenta y cede el tick
// con un yield; el mundo hace el resto. El overhead del combustible se paga
// sobre la parte que computa la habilidad, no sobre el tick entero, así que
// medir solo el peor caso sobreestima el costo real.
const CARGA_YIELD = `
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
const yCrudo = ts.transpileModule(CARGA_YIELD, { compilerOptions: opciones }).outputText
const yLinea = ts.transpileModule(CARGA_YIELD, {
  compilerOptions: opciones,
  transformers: { before: [crearTransformerDeCombustible(ts, { modo: 'inline' })] },
}).outputText
const ySoloBucles = ts.transpileModule(CARGA_YIELD, {
  compilerOptions: opciones,
  transformers: { before: [crearTransformerDeCombustible(ts, { modo: 'inline', conFunciones: false })] },
}).outputText
const modYCrudo = await import(aModulo(yCrudo))
const modYBucles = await import(aModulo(PRELUDIO + ySoloBucles))
const modYLinea = await import(aModulo(PRELUDIO + yLinea))

// Un contexto de percepción del tamaño que el documento presupuesta.
const vistos = cuerpos.slice(0, 40).map((c) => ({ masa: c.partes[0].masa, nutricion: c.partes[0].nutricion, toxicidad: c.toxicidad }))
const ctxFalso = { see: () => vistos }
const PASOS = 4000

const correrGen = (mod) => {
  const g = mod.habilidad(ctxFalso, PASOS)
  let r = g.next()
  while (!r.done) r = g.next() // el mundo "resuelve" la intención y devuelve
}

for (let i = 0; i < 8; i++) {
  correrGen(modYCrudo)
  modYLinea.__setFuel(1e9)
  correrGen(modYLinea)
  modYBucles.__setFuel(1e9)
  correrGen(modYBucles)
}
const mY = { crudo: [], linea: [], bucles: [] }
for (let r = 0; r < RONDAS; r++) {
  const orden = [
    ['crudo', () => correrGen(modYCrudo)],
    ['linea', () => { modYLinea.__setFuel(1e9); correrGen(modYLinea) }],
    ['bucles', () => { modYBucles.__setFuel(1e9); correrGen(modYBucles) }],
  ]
  for (let i = 0; i < 3; i++) {
    const [nombre, fn] = orden[(r + i) % 3]
    mY[nombre].push(cronometrar(fn))
  }
}
const tYCrudo = mediana(mY.crudo)
const tYLinea = mediana(mY.linea)
const tYBucles = mediana(mY.bucles)
const overheadYield = (tYLinea / tYCrudo - 1) * 100
const overheadBucles = (tYBucles / tYCrudo - 1) * 100

// ─── ¿DE VERDAD CORTA? ──────────────────────────────────────────────────────
// Un transformer barato que no corta un bucle infinito no sirve para nada.
const BUCLE_INFINITO = `export function colgar() { let n = 0; while (true) { n++ } ; return n }`
const infInstr = ts.transpileModule(BUCLE_INFINITO, {
  compilerOptions: opciones,
  transformers: { before: [crearTransformerDeCombustible(ts)] },
}).outputText
const modInf = await import(aModulo(PRELUDIO + infInstr))

modInf.__setFuel(50_000)
let corto = false
const tCorte0 = performance.now()
try {
  modInf.colgar()
} catch (e) {
  corto = e instanceof modInf.SinCombustible
}
const tCorte = performance.now() - tCorte0

// Recursión infinita, que no tiene back-edge y por eso necesita el otro punto.
const RECURSION = `export function hondo(n) { return hondo(n + 1) }`
const recInstr = ts.transpileModule(RECURSION, {
  compilerOptions: opciones,
  transformers: { before: [crearTransformerDeCombustible(ts)] },
}).outputText
const modRec = await import(aModulo(PRELUDIO + recInstr))
modRec.__setFuel(2_000)
let cortoRec = false
try {
  modRec.hondo(0)
  var recError = null
} catch (e) {
  cortoRec = e instanceof modRec.SinCombustible
  recError = e && e.constructor ? e.constructor.name : String(e)
}

// ─── INFORME ────────────────────────────────────────────────────────────────
const ms = (x) => `${x.toFixed(3)} ms`
console.log('\nBanco de combustible — Hito 0\n')
console.log(`  Puntos de inyección en la carga:   ${puntos}`)
console.log(`  Tamaño crudo / instrumentado:      ${crudo.length} → ${instrumentado.length} chars (+${((instrumentado.length / crudo.length - 1) * 100).toFixed(0)}%)`)
console.log('')
console.log('┌─────────────────────────────────────────────────────────────────┐')
console.log('│ OVERHEAD DE EJECUCIÓN                                            │')
console.log('└─────────────────────────────────────────────────────────────────┘')
console.log(`  sin instrumentar   ${ms(tCrudo)}`)

console.log(`  con llamada        ${ms(tInstr)}   overhead ${overhead.toFixed(1)}%`)
console.log(`  en linea           ${ms(tLinea)}   overhead ${overheadLinea.toFixed(1)}%`)
console.log('')
console.log('  CARGA REALISTA — generador que cede el tick, 40 cuerpos a la vista')
console.log(`  sin instrumentar   ${ms(tYCrudo)}`)
console.log(`  bucles + funciones ${ms(tYLinea)}   overhead ${overheadYield.toFixed(1)}%`)
console.log(`  solo bucles        ${ms(tYBucles)}   overhead ${overheadBucles.toFixed(1)}%`)
console.log('')

// ─── EL CRITERIO, SEGÚN EL ADR II-0005 ──────────────────────────────────────
// Dejó de ser una razón y pasó a ser un presupuesto absoluto contra el tick.
// La razón se sigue reportando arriba porque es informativa, pero ya no manda:
// un porcentaje sobre un número chico no describe ningún problema del producto.
const TICK_MS = 1000 / 30
const TOPE_OVERHEAD = TICK_MS * 0.02 // 0.66 ms — lo que puede costar instrumentar
const TOPE_COMPUTO = TICK_MS * 0.1 // 3.30 ms — lo que puede computar la habilidad

const costoAbsoluto = tYLinea - tYCrudo
const pctOverhead = (costoAbsoluto / TICK_MS) * 100
const pctComputo = (tYLinea / TICK_MS) * 100

console.log('┌─────────────────────────────────────────────────────────────────┐')
console.log('│ CRITERIO DE CORTE (ADR II-0005) — contra el tick de 33.3 ms      │')
console.log('└─────────────────────────────────────────────────────────────────┘')
console.log(
  `  costo de instrumentar   ${ms(costoAbsoluto)}  = ${pctOverhead.toFixed(2)}% del tick   tope 2%    ${costoAbsoluto <= TOPE_OVERHEAD ? `✔ margen ${(TOPE_OVERHEAD / costoAbsoluto).toFixed(1)}×` : '✘ EXCEDIDO'}`,
)
console.log(
  `  computo de habilidad    ${ms(tYLinea)}  = ${pctComputo.toFixed(2)}% del tick   tope 10%   ${tYLinea <= TOPE_COMPUTO ? `✔ margen ${(TOPE_COMPUTO / tYLinea).toFixed(1)}×` : '✘ EXCEDIDO'}`,
)
console.log('')
console.log('┌─────────────────────────────────────────────────────────────────┐')
console.log('│ ¿DE VERDAD CORTA?                                                │')
console.log('└─────────────────────────────────────────────────────────────────┘')
console.log(`  while(true) con 50k de combustible   ${corto ? `✔ cortó en ${ms(tCorte)}` : '✘ NO CORTÓ'}`)
console.log(`  recursión infinita con 2k            ${cortoRec ? '✔ cortó por combustible' : '✘ murió por ' + recError}`)

const ok = costoAbsoluto <= TOPE_OVERHEAD && tYLinea <= TOPE_COMPUTO && corto && cortoRec
console.log(
  `\n${ok ? '✔' : '✘'} ${
    ok
      ? 'El transformer de combustible es viable: cuesta 0.4% del tick y corta lo que tiene que cortar.'
      : 'Revisar el plan del sandbox ANTES de construirle encima.'
  }\n`,
)
process.exit(ok ? 0 : 1)
