/**
 * BANCO DE LATENCIA DEL HITO 0 — la mitad del typecheck.
 *
 * El plan de construcción declara un criterio de corte, escrito de antemano:
 *
 *   «si `ts.createProgram` en frío pasa de 3 s, el plan del sandbox cambia ACÁ
 *    y no después de construirle encima.»
 *
 * Y el camino del mensaje presupuesta, para el caso frío del Hito 8:
 *
 *   etapa 12   typecheck incremental (Program tibio)   p50 90 ms · p95 250 ms
 *   etapa 12'  typecheck en frío (crear Program)       p50 600 ms · p95 2.5 s
 *
 * Esto los mide. Correr desde la raíz del repo:
 *
 *   node ii/packages/skills/banco/typecheck.mjs
 */
import ts from 'typescript'
import { performance } from 'node:perf_hooks'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const AQUI = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const PAQUETE = resolve(AQUI, '..')
const API = join(PAQUETE, 'src/skill-api.d.ts')

const OPCIONES = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noEmit: true,
  skipLibCheck: true,
  lib: ['lib.es2022.d.ts'], // sin DOM, como los paquetes deterministas de ii/
  types: [],
}

const borradores = ['t1', 't2', 't3', 't4'].flatMap((t) =>
  readdirSync(join(PAQUETE, 'borradores', t))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(PAQUETE, 'borradores', t, f)),
)

const p = (xs, q) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))]
const ms = (x) => `${x.toFixed(0)} ms`

console.log(`\nBanco de typecheck — ${borradores.length} borradores, API en ${API.split(/[\\/]/).pop()}\n`)

// ── FRÍO: crear el Program desde cero, incluida la carga de lib.d.ts ─────────
// Es lo que pasa en la PRIMERA consulta de la sesión. El criterio de corte
// mide esto.
const t0 = performance.now()
const programaFrio = ts.createProgram([API, borradores[0]], OPCIONES)
programaFrio.getSemanticDiagnostics()
const frio = performance.now() - t0

// ── TIBIO (ingenuo): reusar el Program y pedir TODOS los diagnósticos.
// Es la forma obvia y es la que arruina el presupuesto.
const tibios = []
let anterior = programaFrio
for (const b of borradores) {
  const t = performance.now()
  const prog = ts.createProgram([API, b], OPCIONES, undefined, anterior)
  prog.getSemanticDiagnostics()
  tibios.push(performance.now() - t)
  anterior = prog
}

// ── TIBIO (dirigido): reusar el Program y pedir los diagnósticos SOLO del
// archivo nuevo. Es lo único que la fragua necesita saber: si la candidata
// compila. Los demás no cambiaron.
const dirigidos = []
let anterior2 = ts.createProgram([API, borradores[0]], OPCIONES)
for (const b of borradores) {
  const t = performance.now()
  const prog = ts.createProgram([API, b], OPCIONES, undefined, anterior2)
  const sf = prog.getSourceFile(b)
  prog.getSemanticDiagnostics(sf)
  prog.getSyntacticDiagnostics(sf)
  dirigidos.push(performance.now() - t)
  anterior2 = prog
}

console.log('┌─────────────────────────────────────────────────────────────────┐')
console.log('│ FRÍO — crear el Program (primera consulta de la sesión)          │')
console.log('└─────────────────────────────────────────────────────────────────┘')
console.log(`  medido            ${ms(frio)}`)
console.log(`  presupuesto p50   600 ms      ${frio <= 600 ? '✔ dentro' : '✘ EXCEDIDO'}`)
console.log(`  presupuesto p95   2500 ms     ${frio <= 2500 ? '✔ dentro' : '✘ EXCEDIDO'}`)
console.log(`  CRITERIO DE CORTE 3000 ms     ${frio <= 3000 ? '✔ el plan del sandbox sigue en pie' : '✘ EL PLAN DEL SANDBOX CAMBIA ACÁ'}`)

// ── RANURA FIJA: un LanguageService con la candidata siempre en el MISMO
// path, del que solo cambia el contenido y la versión. Es lo que la fragua
// hace de verdad: no agrega archivos, reemplaza el que está a prueba.
// Cambiar la lista de archivos raíz —lo que hacen las dos variantes de
// arriba— invalida la reutilización de estructura de TypeScript, y ahí se va
// todo el presupuesto.
// TypeScript normaliza los paths a barras: la ranura tiene que estar escrita
// igual o `getValidSourceFile` no la encuentra.
const CANDIDATA = join(PAQUETE, 'banco', '__candidata.ts').split('\\').join('/')
const versiones = new Map([
  [API, '1'],
  [CANDIDATA, '0'],
])
const contenidos = new Map([[CANDIDATA, '']])

const host = {
  getScriptFileNames: () => [API, CANDIDATA],
  getScriptVersion: (f) => versiones.get(f) ?? '1',
  getScriptSnapshot: (f) => {
    const propio = contenidos.get(f)
    if (propio !== undefined) return ts.ScriptSnapshot.fromString(propio)
    return ts.sys.fileExists(f) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(f)) : undefined
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

const ranura = []
const { readFileSync } = await import('node:fs')
for (const b of borradores) {
  // El import relativo cambia de profundidad; se normaliza a la ranura.
  contenidos.set(CANDIDATA, readFileSync(b, 'utf8').replace(/\.\.\/\.\.\/src\//g, '../src/'))
  versiones.set(CANDIDATA, String(Number(versiones.get(CANDIDATA)) + 1))
  const t = performance.now()
  servicio.getSemanticDiagnostics(CANDIDATA)
  servicio.getSyntacticDiagnostics(CANDIDATA)
  ranura.push(performance.now() - t)
}

console.log('\n┌─────────────────────────────────────────────────────────────────┐')
console.log('│ TIBIO INGENUO — reusar Program, pedir TODOS los diagnósticos     │')
console.log('└─────────────────────────────────────────────────────────────────┘')
console.log(`  p50               ${ms(p(tibios, 0.5))}   presupuesto 90 ms    ${p(tibios, 0.5) <= 90 ? '✔' : '✘ EXCEDIDO'}`)
console.log(`  p95               ${ms(p(tibios, 0.95))}   presupuesto 250 ms   ${p(tibios, 0.95) <= 250 ? '✔' : '✘ EXCEDIDO'}`)

console.log('\n┌─────────────────────────────────────────────────────────────────┐')
console.log('│ TIBIO DIRIGIDO — diagnósticos SOLO del archivo nuevo             │')
console.log('└─────────────────────────────────────────────────────────────────┘')
console.log(`  p50               ${ms(p(dirigidos, 0.5))}   presupuesto 90 ms    ${p(dirigidos, 0.5) <= 90 ? '✔' : '✘ EXCEDIDO'}`)
console.log(`  p95               ${ms(p(dirigidos, 0.95))}   presupuesto 250 ms   ${p(dirigidos, 0.95) <= 250 ? '✔' : '✘ EXCEDIDO'}`)
console.log(`  peor              ${ms(Math.max(...dirigidos))}`)
console.log(`  mejor             ${ms(Math.min(...dirigidos))}`)
console.log(`\n  Lo que cuesta pedir de más: ${ms(p(tibios, 0.5) - p(dirigidos, 0.5))} por candidata (${(p(tibios, 0.5) / p(dirigidos, 0.5)).toFixed(1)}×).`)
console.log('  Casi nada: el costo NO está en los diagnósticos, está en createProgram.')

console.log('\n┌─────────────────────────────────────────────────────────────────┐')
console.log('│ RANURA FIJA — LanguageService, la candidata siempre en el mismo  │')
console.log('│ path. Es lo que la fragua hace de verdad.                        │')
console.log('└─────────────────────────────────────────────────────────────────┘')
console.log(`  p50               ${ms(p(ranura, 0.5))}   presupuesto 90 ms    ${p(ranura, 0.5) <= 90 ? '✔' : '✘ EXCEDIDO'}`)
console.log(`  p95               ${ms(p(ranura, 0.95))}   presupuesto 250 ms   ${p(ranura, 0.95) <= 250 ? '✔' : '✘ EXCEDIDO'}`)
console.log(`  peor              ${ms(Math.max(...ranura))}`)
console.log(`  mejor             ${ms(Math.min(...ranura))}`)
console.log(
  `\n  Contra el tibio ingenuo: ${(p(tibios, 0.5) / p(ranura, 0.5)).toFixed(0)}× más rápido. La forma de llamar a la API es el presupuesto.`,
)

const veredicto = frio <= 3000 && p(ranura, 0.95) <= 250
console.log(`\n${veredicto ? '✔' : '✘'} ${veredicto ? 'El typecheck local es viable como puerta antes del viaje al modelo.' : 'Revisar el plan del sandbox ANTES de construirle encima.'}`)
console.log(
  `  Contexto: reparar y rechazar acá cuesta ${ms(p(dirigidos, 0.5))}; un viaje al modelo son 6 a 25 s.\n`,
)

process.exit(veredicto ? 0 : 1)
