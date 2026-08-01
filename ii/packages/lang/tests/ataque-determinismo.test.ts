/**
 * EL GUARDIÁN DE LA REGLA 2, para el paquete que nace en el Hito 6.
 *
 * «Ningún paquete determinista toca el reloj ni el azar del sistema.
 *  `Math.random`, `Date`, `performance`, `Intl`, `localeCompare` y `Math`
 *  trascendente están prohibidos.» (`ii/README.md`)
 *
 * Está copiado de `perceive/tests/ataque-determinismo.test.ts` a propósito, con
 * la misma razón que ese archivo declara: la regla **no la hace cumplir ningún
 * lint**, la cuidan copias de esta lista en cada paquete, y una lista compartida
 * sería un import de test a test, que es peor. Un paquete nuevo nace SIN
 * guardián; éste nace con el suyo, escrito antes que su primer módulo.
 *
 * ─── Y para ESTE paquete la regla pega más fuerte que para los otros ─────────
 *
 * `@anima/lang` es el único que manipula TEXTO, y ahí viven dos trampas que en
 * los otros ocho ni aparecen:
 *
 * - **`localeCompare` y `toLocaleLowerCase`.** Ordenar o bajar a minúscula
 *   «según el idioma del sistema» es exactamente lo que hay que no hacer:
 *   `'i'.toLocaleUpperCase('tr')` da `'İ'`, y una máquina turca leería otro
 *   léxico que una argentina. Se usa `toLowerCase()` a secas, que es la tabla
 *   Unicode fija, y se desempata con `<` / `>` sobre el string.
 * - **`Intl.Segmenter` / `Intl.Collator`.** Tentadores para partir palabras y
 *   comparar sin acentos, y los dos dependen de la ICU que traiga el motor.
 *
 * Las dos están adentro del mismo patrón que ya prohibía `Intl`, así que no hace
 * falta una regla nueva: hace falta no borrar la que hay. Por eso el patrón se
 * amplía con `toLocale` a secas, que engancha `toLocaleLowerCase`,
 * `toLocaleUpperCase` y `toLocaleDateString` de una.
 *
 * `String.prototype.normalize` sí está permitido y se usa: NFD/NFC son tablas
 * Unicode fijas, sin locale adentro. Su control negativo está abajo.
 *
 * Lee `readdirSync(src/)`, así que **un archivo nuevo entra solo**. La cota de
 * cuántos hay está para que BORRAR uno también se note.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

/**
 * Los `.ts` de `src/`, RECURSIVO.
 *
 * ─── POR QUÉ RECURSIVO, y lo encontró un adversario ─────────────────────────
 *
 * La primera versión hacía `readdirSync(SRC).filter(...)`, o sea **un solo
 * nivel**. Se probó plantando `src/sub/malo.ts` con `Math.random`, `Date.now`,
 * `performance.now`, `localeCompare`, `Math.sqrt`, `2 ** 3` y `async/await`
 * adentro: el guardián dio **verde**, y el nombre del test siguió diciendo el
 * mismo número de fuentes.
 *
 * No es hipotético: en esta base las subcarpetas de `src/` son costumbre
 * —`physics/src/data/`, `skills/src/innatas/`— así que «sobre todo `src/`» era
 * en realidad «sobre el primer nivel de `src/`».
 */
function fuentesDe(dir: string): readonly string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...fuentesDe(`${dir}${e.name}/`).map((f) => `${e.name}/${f}`))
    else if (e.name.endsWith('.ts')) out.push(e.name)
  }
  return out
}

const FUENTES = fuentesDe(SRC)

const PROHIBIDOS: readonly (readonly [RegExp, string])[] = [
  [/\bMath\.random\b/, 'el azar del sistema no se puede reproducir'],
  [/\bnew Date\b|\bDate\.now\b/, 'el reloj del mundo es el contador de ticks'],
  [/\bperformance\./, 'medir es del banco, no del léxico'],
  [
    /\bIntl\b|\blocaleCompare\b|\btoLocale/,
    'el orden y las mayúsculas dependerían del idioma del sistema',
  ],
  [
    /\bMath\.(exp|pow|log|log2|log10|sqrt|cbrt|sin|cos|tan|asin|acos|atan|atan2|hypot|expm1|log1p|fround)\b/,
    'ECMAScript no especifica su precisión: dos motores devuelven el último bit distinto',
  ],
  [/\*\*/, 'la potencia es `Math.pow` con otra cara'],
  [/from '@anima\/(sim-core|agent-core|skill-runtime|web|api)'/, 'regla 1: nada de Ánima I'],
  [/from '(\.\.\/)+packages\//, 'regla 1: nada de Ánima I'],
  [/\bawait\b|\basync\b/, 'principio 1: el tick no tiene un solo `await`'],
]

/**
 * El fuente SIN comentarios: este paquete EXPLICA por qué `toLocaleLowerCase`
 * está prohibido, y explicarlo no puede ser la infracción.
 */
function codigoDe(archivo: string): string {
  return readFileSync(SRC + archivo, 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

describe('la regla 2, sobre todo `src/`', () => {
  it(`los ${String(FUENTES.length)} fuentes del paquete, leídos del directorio`, () => {
    // La cuenta va en el nombre del test para que agregar un módulo y olvidarse
    // de mirarlo sea visible en la salida.
    expect(FUENTES.length).toBeGreaterThanOrEqual(1)
    const infracciones: string[] = []
    for (const archivo of FUENTES) {
      const codigo = codigoDe(archivo)
      for (const [patron, porque] of PROHIBIDOS) {
        const m = codigo.match(patron)
        if (m !== null) infracciones.push(`${archivo}: «${m[0]}» — ${porque}`)
      }
    }
    expect(infracciones).toEqual([])
  })

  it('y el detector detecta: carnada para cada patrón', () => {
    // Un guardián que no se prueba a sí mismo puede estar leyendo el archivo
    // equivocado, o con una expresión que no engancha nada, y siempre da verde.
    const carnada: readonly string[] = [
      'const x = Math.random()',
      'const t = Date.now()',
      'const t = new Date()',
      'performance.now()',
      'a.localeCompare(b)',
      'Math.pow(2, 3)',
      'const y = 2 ** 3',
      "import x from '@anima/sim-core'",
      'await algo()',
      // Las tres del texto, que son las que este paquete puede escribir sin
      // querer y los otros ocho no.
      'const s = palabra.toLocaleLowerCase()',
      'const s = palabra.toLocaleUpperCase("tr")',
      'const seg = new Intl.Segmenter("es")',
    ]
    for (const linea of carnada) {
      const pegó = PROHIBIDOS.some(([p]) => p.test(linea))
      expect(pegó, `el guardián no vio «${linea}»`).toBe(true)
    }
  })

  it('y NO detecta lo que sí está permitido', () => {
    // El control negativo. Sin él, un patrón demasiado ancho —`/Math\./` o
    // `/locale/i`— pasaría el test de arriba y volvería inusable el paquete.
    const inocentes: readonly string[] = [
      'const d = Math.max(a, b)',
      'const n = Math.abs(x)',
      'const t = Math.ceil(at * hz)',
      'const f = Math.floor(ms / ventana)',
      'const h = Math.imul(a, b)',
      "import { plan } from '@anima/plan'",
      // Las cuatro que este paquete SÍ necesita y que un patrón ancho mataría.
      'const s = palabra.toLowerCase()',
      "const d = texto.normalize('NFD')",
      "const c = texto.normalize('NFC')",
      'const orden = a < b ? -1 : a > b ? 1 : 0',
    ]
    for (const linea of inocentes) {
      const pegó = PROHIBIDOS.filter(([p]) => p.test(linea))
      expect(pegó.map(([p]) => String(p)), `el guardián rebotó «${linea}»`).toEqual([])
    }
  })
})
