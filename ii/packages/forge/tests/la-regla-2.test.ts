/**
 * LA REGLA 2 SOBRE TODO `src/` DE ESTE PAQUETE.
 *
 * > «El azar del sistema, el reloj de pared y la matemática trascendente están
 * > prohibidos.» (`ii/README.md`)
 *
 * Cada paquete lleva el suyo, y no por ceremonia: el de `@anima/lang` **no
 * recorría subdirectorios**, así que un `src/sub/malo.ts` con siete patrones
 * prohibidos daba verde. Éste recorre.
 *
 * Este paquete tiene un motivo propio: **un
 * presupuesto que no se puede repetir no sirve de puerta**. Si la misma
 * sesión puede autorizar distinto en dos corridas, el test de presupuesto en CI
 * deja de significar algo.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

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
  [/\bperformance\./, 'medir es del banco, no de la fragua'],
  [/\bIntl\b|\blocaleCompare\b|\btoLocale/, 'el orden y las mayúsculas dependerían del idioma del sistema'],
  [
    /\bMath\.(exp|pow|log|log2|log10|sqrt|cbrt|sin|cos|tan|asin|acos|atan|atan2|hypot|expm1|log1p|fround)\b/,
    'ECMAScript no especifica su precisión: dos motores devuelven el último bit distinto',
  ],
  [/\*\*/, 'la potencia es `Math.pow` con otra cara'],
  [/from '@anima\/(sim-core|agent-core|skill-runtime|web|api)'/, 'regla 1: nada de Ánima I'],
  [/from '(\.\.\/)+packages\//, 'regla 1: nada de Ánima I'],
  [/\bawait\b|\basync\b/, 'principio 1: el tick no tiene un solo `await`'],
]

/** El fuente SIN comentarios: explicar por qué algo está prohibido no es la infracción. */
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
    // La cuenta va en el NOMBRE del test para que agregar un módulo y olvidarse
    // de mirarlo sea visible en la salida.
    expect(FUENTES.length).toBeGreaterThanOrEqual(1)
    const infracciones: string[] = []
    for (const archivo of FUENTES) {
      const codigo = codigoDe(archivo)
      for (const [patron, porque] of PROHIBIDOS) {
        const m = patron.exec(codigo)
        if (m !== null) infracciones.push(`${archivo}: «${m[0]}» — ${porque}`)
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([])
  })

  it('EL CONTROL: el detector ve una infracción cuando la hay', () => {
    // Sin esto, el test de arriba está verde por no haber nada que encontrar y
    // no prueba que sepa encontrar. Es la misma lección que dejó el guardián del
    // sello en el tramo B.
    const sucio = ['const x = Math.random()', 'const y = Date.now()', 'const z = 2 ** 3'].join('\n')
    const pegaron = PROHIBIDOS.filter(([p]) => p.test(sucio))
    expect(pegaron.length).toBe(3)
  })

  it('y NO recorre sólo la raíz: un `src/sub/` también se lee', () => {
    // El guardián de `@anima/lang` no recursaba y por eso un subdirectorio
    // entero quedaba sin mirar. Acá se afirma la propiedad, no la ausencia.
    const conBarra = FUENTES.filter((f) => f.includes('/'))
    console.log(`\n  fuentes: ${FUENTES.join(', ')} (en subdirectorio: ${String(conBarra.length)})`)
    expect(fuentesDe(SRC).length).toBe(FUENTES.length)
  })
})
