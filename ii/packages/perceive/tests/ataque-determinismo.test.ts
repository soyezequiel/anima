/**
 * EL GUARDIÁN DE LA REGLA 2, para un paquete que nació sin uno.
 *
 * «Ningún paquete determinista toca el reloj ni el azar del sistema.
 *  `Math.random`, `Date`, `performance`, `Intl`, `localeCompare` y `Math`
 *  trascendente están prohibidos.» (`ii/README.md`)
 *
 * Y hay que decir la parte incómoda: **esa regla no la hace cumplir ningún
 * lint** — `grep -rn "no-restricted"` sobre el repo da cero. La cuidan copias de
 * esta lista de regex en tests de cada paquete, o sea que **un paquete nuevo nace
 * SIN guardián**. Éste nació con el suyo, y está copiado de
 * `world/tests/ataque-determinismo.test.ts:294` a propósito: una lista de
 * prohibidos mantenida en un solo lugar y compartida entre paquetes sería un
 * import de test a test, que es peor.
 *
 * Lee `readdirSync(src/)`, así que **un archivo nuevo entra solo**. La cota de
 * cuántos hay está para que BORRAR uno también se note.
 *
 * ─── La excepción declarada: el reloj de pared ──────────────────────────────
 *
 * `src/bucle.ts` necesita saber si un tick llegó tarde, y eso es tiempo de
 * pared. **No lo llama**: lo recibe por parámetro (`RelojDePared`), y por eso
 * este guardián pasa sin ninguna excepción escrita. La frontera con el reloj del
 * sistema es el llamador; adentro de `src/` no hay ni un `Date.now`.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const FUENTES = readdirSync(SRC).filter((f) => f.endsWith('.ts'))

const PROHIBIDOS: readonly (readonly [RegExp, string])[] = [
  [/\bMath\.random\b/, 'el azar del sistema no se puede reproducir'],
  [/\bnew Date\b|\bDate\.now\b/, 'el reloj del mundo es el contador de ticks'],
  [/\bperformance\./, 'medir es del banco, no de la percepción'],
  [/\bIntl\b|\blocaleCompare\b|\btoLocaleString\b/, 'el orden dependería del idioma del sistema'],
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
 * El fuente SIN comentarios: este paquete EXPLICA por qué `Math.exp` está
 * prohibido y por qué no hay `await`, y explicarlo no puede ser la infracción.
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
    expect(FUENTES.length).toBeGreaterThanOrEqual(7)
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
    ]
    for (const linea of carnada) {
      const pegó = PROHIBIDOS.some(([p]) => p.test(linea))
      expect(pegó, `el guardián no vio «${linea}»`).toBe(true)
    }
  })

  it('y NO detecta lo que sí está permitido', () => {
    // El control negativo. Sin él, un patrón demasiado ancho —`/Math\./`— pasaría
    // el test de arriba y volvería inusable el paquete.
    const inocentes: readonly string[] = [
      'const d = Math.max(a, b)',
      'const n = Math.abs(x)',
      'const t = Math.ceil(at * hz)',
      'const f = Math.floor(ms / ventana)',
      'const h = Math.imul(a, b)',
      "import { stepWorld } from '@anima/world'",
      'const reloj: RelojDePared | undefined = o.reloj',
    ]
    for (const linea of inocentes) {
      const pegó = PROHIBIDOS.filter(([p]) => p.test(linea))
      expect(pegó.map(([p]) => String(p)), `el guardián rebotó «${linea}»`).toEqual([])
    }
  })
})
