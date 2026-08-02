/**
 * LA REGLA 2 EN EL ÚNICO PAQUETE DONDE `await` ES LEGAL — y por eso hace falta
 * escribir el guardián a mano en vez de copiar el de al lado.
 *
 * La regla 2 prohíbe el `await` en `src/` para proteger AL TICK: una espera
 * adentro del tick hace que la partida dependa de cuánto tardó el disco, y con
 * eso el replay muere.
 *
 * Guardar no pasa por el tick —el plan lo dice con esas palabras, *«en IndexedDB
 * fuera del tick»*— así que acá el `await` no sólo es legal: es el motivo de que
 * este paquete exista. Es la misma frontera del ADR II-0024: el paquete de
 * adentro describe, el de afuera espera.
 *
 * **Todo lo demás sigue prohibido**, y una en particular importa más acá que en
 * ningún otro lado: `Date.now`. Un guardado estampado con el reloj del sistema
 * haría que dos guardados de la misma partida NO fueran el mismo dato, y
 * comparar dos saves es la mitad de «el mismo journal produce el mismo mundo».
 * Quien quiera una fecha, la pasa por parámetro.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const FUENTES = readdirSync(SRC).filter((f) => f.endsWith('.ts'))

const PROHIBIDOS: readonly (readonly [RegExp, string])[] = [
  [/\bMath\.random\b/, 'el azar del sistema no se puede reproducir'],
  [/\bnew Date\b|\bDate\.now\b/, 'un guardado estampado con el reloj no es comparable con otro'],
  [/\bperformance\./, 'medir es del banco'],
  [/\bIntl\b|\blocaleCompare\b|\btoLocaleString\b/, 'el orden dependería del idioma del sistema'],
  [
    /\bMath\.(exp|pow|log|log2|log10|sqrt|cbrt|sin|cos|tan|asin|acos|atan|atan2|hypot|expm1|log1p|fround)\b/,
    'ECMAScript no especifica su precisión',
  ],
  [/\*\*/, 'la potencia es `Math.pow` con otra cara'],
  [/from '@anima\/(sim-core|agent-core|skill-runtime|web|api)'/, 'regla 1: nada de Ánima I'],
  [/from '(\.\.\/)+packages\//, 'regla 1: nada de Ánima I'],
  // Y la propia de este paquete: **el store no importa la percepción ni el
  // planificador**. Guardar tiene que poder correr sin que exista una `Partida`,
  // porque lo que se guarda es el ESTADO y no la corrida. El día que esto se
  // rompa, guardar va a necesitar un mundo vivo y dejará de servir para un
  // replay desde el disco.
  [/from '@anima\/(perceive|plan)'/, 'guardar es del estado, no de la corrida'],
]

function codigoDe(archivo: string): string {
  return readFileSync(SRC + archivo, 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

describe('la regla 2, con su única excepción declarada', () => {
  it(`los ${String(FUENTES.length)} fuentes del paquete, leídos del directorio`, () => {
    expect(FUENTES.length).toBeGreaterThanOrEqual(3)
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
    // equivocado, o con una expresión que no engancha nada, y da verde siempre.
    const carnada: readonly string[] = [
      'const x = Math.random()',
      'const t = Date.now()',
      'const t = new Date()',
      'performance.now()',
      'a.localeCompare(b)',
      'Math.sqrt(2)',
      'const y = x ** 2',
      "import { x } from '@anima/web'",
      "import { y } from '@anima/perceive'",
    ]
    for (const linea of carnada) {
      const pica = PROHIBIDOS.some(([p]) => p.test(linea))
      expect(pica, `nadie caza «${linea}»`).toBe(true)
    }
  })

  it('LA EXCEPCIÓN, afirmada y no supuesta: acá SÍ hay `await`, y está en `guardar.ts`', () => {
    // Si algún día alguien saca el `await` de este paquete «para que sea igual a
    // los otros», el paquete deja de tener sentido: su razón de ser es ser el
    // lado que espera. Esto lo dice en voz alta.
    const conAwait = FUENTES.filter((f) => /\bawait\b/.test(codigoDe(f)))
    console.log(`  fuentes con await: ${conAwait.join(', ')}`)
    expect(conAwait.length).toBeGreaterThan(0)
  })
})
