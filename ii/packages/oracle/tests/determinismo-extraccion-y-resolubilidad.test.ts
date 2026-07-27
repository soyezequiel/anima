// ─── El barrido de las dos reglas, sobre estos dos archivos ──────────────────
//
// La regla 2 de `ii/README.md` prohíbe el reloj, el azar del sistema y el `Math`
// trascendente, y la razón no es estética: ECMAScript no especifica la precisión
// de `Math.exp`, `Math.pow` ni `Math.log`, así que dos motores pueden devolver el
// último bit distinto y el replay diverge en el tick 400. Un comentario que diga
// «acá no hay nada de eso» envejece; este test, no.
//
// La regla 1 se barre igual: el oráculo no importa de `packages/` ni de `apps/`
// (eso es Ánima I) y **tampoco de `@anima/world`** — la flecha va del mundo al
// dios, y en los dos sentidos sería un ciclo de paquetes.
//
// El barrido cubre los dos archivos de la extracción y la resolubilidad. Los
// otros archivos del paquete tienen sus dueños y sus tests.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const MIOS = ['src/resolubilidad.ts', 'src/extraccion.ts'] as const

/**
 * El código sin comentarios.
 *
 * Hace falta porque los comentarios de estos dos archivos NOMBRAN lo prohibido
 * para explicar por qué está prohibido: un barrido sobre el texto crudo daría
 * rojo por la documentación, y el arreglo sería borrar la explicación. Al revés
 * de lo que se quiere.
 */
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//')
      return i >= 0 ? l.slice(0, i) : l
    })
    .join('\n')
}

const PROHIBIDO: readonly { readonly qué: string; readonly re: RegExp }[] = [
  { qué: 'Math.random', re: /\bMath\s*\.\s*random\b/ },
  { qué: 'Date', re: /\bDate\s*\.\s*now\b|\bnew\s+Date\b/ },
  { qué: 'performance', re: /\bperformance\s*\./ },
  { qué: 'Intl', re: /\bIntl\s*\./ },
  { qué: 'localeCompare', re: /\blocaleCompare\b/ },
  { qué: 'toLocale*', re: /\btoLocale[A-Z]\w*\s*\(/ },
  {
    qué: 'Math trascendente',
    re: /\bMath\s*\.\s*(exp|pow|log|log2|log10|sqrt|cbrt|hypot|sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|expm1|log1p)\b/,
  },
  { qué: 'el operador **', re: /\*\*/ },
]

describe('las dos reglas de ii/, verificadas sobre las fuentes', () => {
  for (const archivo of MIOS) {
    const código = sinComentarios(readFileSync(new URL(`../${archivo}`, import.meta.url), 'utf8'))

    it(`${archivo} no toca el reloj ni el azar del sistema`, () => {
      const encontrados = PROHIBIDO.filter((p) => p.re.test(código)).map((p) => p.qué)
      expect(encontrados).toEqual([])
    })

    it(`${archivo} no importa de Ánima I ni del mundo`, () => {
      const imports = [...código.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!)
      expect(imports.length).toBeGreaterThan(0)
      for (const i of imports) {
        expect(i.startsWith('@anima/physics') || i.startsWith('./') || i.startsWith('../')).toBe(true)
        expect(i).not.toContain('@anima/world')
        expect(i).not.toContain('sim-core')
        expect(i).not.toContain('agent-core')
        expect(i).not.toContain('skill-runtime')
      }
    })
  }

  it('el barrido sabe encontrar lo que busca', () => {
    // Un test de barrido que no puede fallar no vale nada: se lo prueba con un
    // caso plantado. Si mañana alguien rompe el stripper de comentarios, esto se
    // entera antes que la regla de verdad.
    const plantado = sinComentarios('const x = Math.random() // Math.random en un comentario no cuenta\n')
    expect(PROHIBIDO.some((p) => p.re.test(plantado))).toBe(true)
    expect(sinComentarios('// Math.random\n').includes('random')).toBe(false)
  })
})
