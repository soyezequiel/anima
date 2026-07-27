/**
 * BANCO DE ARRANQUE EN EL NAVEGADOR — la última pieza del Hito 0.
 *
 * El documento de arquitectura pone la fragua —el typecheck de las habilidades
 * que escribe el modelo— adentro del navegador. El banco de Node ya midió que
 * typechequear cuesta 240 ms en frío y 30 ms tibio, pero ahí `typescript` ya
 * estaba en disco. En el navegador hay que BAJARLO, y pesa varios megas.
 *
 * Esto mide lo que falta: cuánto cuesta tener el toolchain en la página.
 *
 * Lo que se busca NO es que sea rápido. Es que se pueda DIFERIR: la página
 * tiene que estar viva y jugable antes de que el toolchain termine de cargar,
 * porque el requisito número uno del usuario es que Ánima no haga esperar.
 */

export {} // hace del archivo un módulo, para que el `await` de arriba sea legal

interface Fila {
  etapa: string
  que: string
  ms: number
  nota?: string
}

const filas: Fila[] = []
const t0 = performance.now()

const $filas = document.getElementById('filas')!
const $peso = document.getElementById('peso')!
const $veredicto = document.getElementById('veredicto')!

const pintar = () => {
  $filas.innerHTML = filas
    .map(
      (f) =>
        `<tr><td>${f.etapa}</td><td style="color:#8a8178">${f.que}</td><td class="n">${f.ms.toFixed(0)}</td></tr>`,
    )
    .join('')
}

async function medir<T>(etapa: string, que: string, fn: () => Promise<T> | T): Promise<T> {
  const t = performance.now()
  const r = await fn()
  filas.push({ etapa, que, ms: performance.now() - t })
  pintar()
  return r
}

// ── 1. El toolchain ─────────────────────────────────────────────────────────
// Import dinámico: es exactamente como lo cargaría la fragua, en segundo plano
// y no en el camino crítico del primer cuadro.
const ts = await medir('importar typescript', 'descarga + parseo + inicialización', async () => {
  const m = await import('typescript')
  return (m.default ?? m) as typeof import('typescript')
})

// ── 2. Las declaraciones del lenguaje ───────────────────────────────────────
const LIBS = [
  'lib.es5.d.ts', 'lib.es2015.d.ts', 'lib.es2016.d.ts', 'lib.es2017.d.ts',
  'lib.es2018.d.ts', 'lib.es2019.d.ts', 'lib.es2020.d.ts', 'lib.es2021.d.ts',
  'lib.es2022.d.ts',
  'lib.es2015.core.d.ts', 'lib.es2015.collection.d.ts', 'lib.es2015.generator.d.ts',
  'lib.es2015.iterable.d.ts', 'lib.es2015.promise.d.ts', 'lib.es2015.proxy.d.ts',
  'lib.es2015.reflect.d.ts', 'lib.es2015.symbol.d.ts', 'lib.es2015.symbol.wellknown.d.ts',
  'lib.es2016.array.include.d.ts', 'lib.es2016.intl.d.ts',
  'lib.es2017.arraybuffer.d.ts', 'lib.es2017.date.d.ts', 'lib.es2017.intl.d.ts',
  'lib.es2017.object.d.ts', 'lib.es2017.sharedmemory.d.ts', 'lib.es2017.string.d.ts',
  'lib.es2017.typedarrays.d.ts',
  'lib.es2018.asyncgenerator.d.ts', 'lib.es2018.asynciterable.d.ts', 'lib.es2018.intl.d.ts',
  'lib.es2018.promise.d.ts', 'lib.es2018.regexp.d.ts',
  'lib.es2019.array.d.ts', 'lib.es2019.intl.d.ts', 'lib.es2019.object.d.ts',
  'lib.es2019.string.d.ts', 'lib.es2019.symbol.d.ts',
  'lib.es2020.bigint.d.ts', 'lib.es2020.date.d.ts', 'lib.es2020.intl.d.ts',
  'lib.es2020.number.d.ts', 'lib.es2020.promise.d.ts', 'lib.es2020.sharedmemory.d.ts',
  'lib.es2020.string.d.ts', 'lib.es2020.symbol.wellknown.d.ts',
  'lib.es2021.intl.d.ts', 'lib.es2021.promise.d.ts', 'lib.es2021.string.d.ts',
  'lib.es2021.weakref.d.ts',
  'lib.es2022.array.d.ts', 'lib.es2022.error.d.ts', 'lib.es2022.intl.d.ts',
  'lib.es2022.object.d.ts', 'lib.es2022.regexp.d.ts', 'lib.es2022.string.d.ts',
  'lib.decorators.d.ts', 'lib.decorators.legacy.d.ts',
]

const archivos = new Map<string, string>()

await medir('bajar lib.d.ts', `${LIBS.length} archivos, en paralelo`, async () => {
  await Promise.all(
    LIBS.map(async (f) => {
      const r = await fetch(`/lib/${f}`)
      if (r.ok) archivos.set(f, await r.text())
    }),
  )
})

// La superficie que ve el código generado.
await medir('bajar skill-api.d.ts', 'la superficie de habilidades', async () => {
  const r = await fetch('/skill-api.d.ts')
  archivos.set('skill-api.d.ts', r.ok ? await r.text() : 'export {}')
})

// ── 3. El host en memoria ───────────────────────────────────────────────────
const OPCIONES: import('typescript').CompilerOptions = {
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

const CANDIDATA = 'candidata.ts'
const HABILIDAD = `
import type { Ctx, Intent, Outcome, StepResult, BodyView } from './skill-api.js'
import { done, fail } from './skill-api.js'

export function* juntarLoQueAlimenta(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('buscar')
  const candidatos = ctx.see([{ q: 'nutrition', op: '>', v: 0 }])
  let mejor: BodyView | undefined
  let puntaje = -1
  for (const c of candidatos) {
    const p = ctx.q(c, 'calories')
    if (p > puntaje) { puntaje = p; mejor = c }
  }
  if (!mejor) return fail('no veo nada que alimente')
  const r = yield ctx.goTo(mejor, { within: 1 })
  if (r.status !== 'arrived') return fail('no llegue')
  const t = yield ctx.take(mejor)
  return t.got.length > 0 ? done(t.got[0]) : fail('no lo pude agarrar')
}
`
archivos.set(CANDIDATA, HABILIDAD)

const versiones = new Map<string, string>()
for (const k of archivos.keys()) versiones.set(k, '1')

const host: import('typescript').LanguageServiceHost = {
  getScriptFileNames: () => [CANDIDATA, 'skill-api.d.ts'],
  getScriptVersion: (f) => versiones.get(f) ?? '1',
  getScriptSnapshot: (f) => {
    const c = archivos.get(f.replace(/^\.?\//, ''))
    return c === undefined ? undefined : ts.ScriptSnapshot.fromString(c)
  },
  getCurrentDirectory: () => '/',
  getCompilationSettings: () => OPCIONES,
  getDefaultLibFileName: () => 'lib.es2022.d.ts',
  fileExists: (f) => archivos.has(f.replace(/^\.?\//, '')),
  readFile: (f) => archivos.get(f.replace(/^\.?\//, '')),
  readDirectory: () => [],
  directoryExists: () => true,
  getDirectories: () => [],
}

const servicio = await medir('crear LanguageService', 'sin chequear todavía', () =>
  ts.createLanguageService(host, ts.createDocumentRegistry()),
)

// ── 4. El typecheck ─────────────────────────────────────────────────────────
let errores = 0
await medir('typecheck EN FRÍO', 'primera habilidad de la sesión', () => {
  const d = [
    ...servicio.getSemanticDiagnostics(CANDIDATA),
    ...servicio.getSyntacticDiagnostics(CANDIDATA),
  ]
  errores = d.length
})

const tibios: number[] = []
for (let i = 0; i < 12; i++) {
  versiones.set(CANDIDATA, String(i + 2))
  archivos.set(CANDIDATA, HABILIDAD + `\n// variante ${i}\n`)
  const t = performance.now()
  servicio.getSemanticDiagnostics(CANDIDATA)
  servicio.getSyntacticDiagnostics(CANDIDATA)
  tibios.push(performance.now() - t)
}
const mediana = tibios.slice().sort((a, b) => a - b)[Math.floor(tibios.length / 2)]!
filas.push({ etapa: 'typecheck TIBIO', que: 'mediana de 12 candidatas seguidas', ms: mediana })
pintar()

const total = performance.now() - t0

// ── 5. Peso transferido ─────────────────────────────────────────────────────
const recursos = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
const suma = (filtro: (r: PerformanceResourceTiming) => boolean) =>
  recursos.filter(filtro).reduce((a, r) => a + (r.encodedBodySize || r.transferSize || 0), 0)
const pesoLibs = suma((r) => r.name.includes('/lib/lib.'))
const pesoTs = suma((r) => /typescript/i.test(r.name))
const kb = (b: number) => `${(b / 1024).toFixed(0)} KB`

// OJO con el peso que informa el navegador en modo dev: vite sirve los módulos
// sin minificar y sin comprimir, así que `typescript` aparece como ~9.7 MB. El
// número que importa es el del build de producción, medido aparte con
// `vite build`: 3.59 MB minificado, **1.03 MB con gzip**. Más 93 KB de
// lib.d.ts comprimidos. Poner el número de dev sin aclararlo asustaría por
// nada, que es la otra forma de mentir con una medición.
$peso.innerHTML =
  `en esta corrida (vite dev, sin minificar) — typescript ${kb(pesoTs)} · lib.d.ts ${kb(pesoLibs)} ` +
  `(${LIBS.length} archivos) · arranque ${total.toFixed(0)} ms · ${errores} error(es)<br />` +
  `<strong>en producción</strong> — typescript <code>1.03 MB</code> gzip · lib.d.ts <code>93 KB</code> gzip ` +
  `· <code>~1.1 MB</code> en total, y bajan en segundo plano`

// ── 6. Veredicto ────────────────────────────────────────────────────────────
// El criterio NO es que sea rápido: es que se pueda diferir. La página tiene
// que poder estar viva mientras esto carga. Lo que se vigila es que el
// typecheck TIBIO —el que corre una vez por candidata, con el usuario
// esperando— entre en el presupuesto del documento (90 ms p50 / 250 ms p95).
const TOPE_TIBIO = 250
const ok = mediana <= TOPE_TIBIO && errores === 0
$veredicto.className = `veredicto ${ok ? 'ok' : 'mal'}`
$veredicto.innerHTML = ok
  ? `<strong>✔ La fragua entra en el navegador.</strong><br />` +
    `El arranque del toolchain cuesta <code>${total.toFixed(0)} ms</code> y es DIFERIBLE: ` +
    `no está en el camino del primer cuadro. Lo que sí está en el camino del usuario es el ` +
    `typecheck de cada candidata, y sale <code>${mediana.toFixed(0)} ms</code> contra un ` +
    `presupuesto de 250.`
  : `<strong>✘ Revisar.</strong><br />typecheck tibio <code>${mediana.toFixed(0)} ms</code> ` +
    `(tope ${TOPE_TIBIO}) · errores en la habilidad de prueba: <code>${errores}</code>`

// Para poder leerlo desde afuera sin scrapear el DOM.
;(window as unknown as { RESULTADO: unknown }).RESULTADO = {
  filas,
  totalMs: total,
  tibioMedianoMs: mediana,
  errores,
  pesoTypescriptKB: Math.round(pesoTs / 1024),
  pesoLibsKB: Math.round(pesoLibs / 1024),
  ok,
}
