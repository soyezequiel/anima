// ─── EL MOTOR CUMPLE LA REGLA QUE LE EXIGE AL MODELO ────────────────────────
//
// La puerta de `revisarSprite` rechaza un dibujo del modelo si tiene una celda de
// LUZ tocando el vacío: *«el contorno va todo en sombra, la luz va una celda
// adentro»*. Es la regla 3, y existe porque un sprite iluminado al revés convive
// mal con las veintiuna sustancias que se dibujan procedurales.
//
// ─── LA PREGUNTA QUE NADIE HABÍA HECHO ─────────────────────────────────────
//
// ¿Y el motor la cumple? Nadie se lo preguntaba: la puerta corre sobre lo que
// manda el modelo, y lo que dibuja `siluetaDe` entra sin pasar por ahí.
//
// No la cumplía. `trazo()` —la silueta de una vara, o sea la forma más común del
// catálogo después del bloque— escribía un `3` en la columna 0 de cada fila, que
// es su borde izquierdo. Un sprite de vara escrito así lo rechaza la propia
// puerta; el que dibujaba el motor entraba igual porque nadie se lo preguntaba.
//
// Este archivo le hace la pregunta a todas las formas, a todos los tamaños que el
// juego usa, y con las cuatro tramas del catálogo.

import { describe, expect, it } from 'vitest'
import type { FormId } from '@anima/physics'

import { siluetaDe } from '../src/forma.js'
import type { Trama } from '../src/paleta.js'

/** Las seis del catálogo cerrado. */
const FORMAS: readonly FormId[] = ['vara', 'hebra', 'bloque', 'filete', 'grano', 'malla']

/** Los tres lados que `layout` produce sobre la grilla de 24: 1, 2 y 3+ piezas. */
const LADOS = [24, 12, 8]

/** Las cuatro esquinas del espacio de tramas. */
const TRAMAS: readonly Trama[] = [
  { grano: 0, veta: 0 },
  { grano: 2, veta: 0 },
  { grano: 0, veta: 2 },
  { grano: 2, veta: 2 },
]

/** Las celdas de luz que tocan el vacío. Cero es lo que la regla 3 exige. */
function luzAfuera(m: readonly string[]): number {
  const alto = m.length
  const vacio = (x: number, y: number): boolean => {
    if (y < 0 || y >= alto || x < 0) return true
    const f = m[y]
    if (f === undefined || x >= f.length) return true
    return f.charAt(x) === '0'
  }
  let cuantas = 0
  for (let y = 0; y < alto; y++) {
    const f = m[y]
    if (f === undefined) continue
    for (let x = 0; x < f.length; x++) {
      if (f.charAt(x) !== '3') continue
      if (vacio(x - 1, y) || vacio(x + 1, y) || vacio(x, y - 1) || vacio(x, y + 1)) cuantas++
    }
  }
  return cuantas
}

describe('el motor cumple la regla que le exige al modelo', () => {
  it('NINGUNA silueta pone luz tocando el vacío, en ninguna forma ni tamaño', () => {
    const fallan: string[] = []
    for (const forma of FORMAS) {
      for (const lado of LADOS) {
        for (const trama of TRAMAS) {
          const n = luzAfuera(siluetaDe(forma, lado, trama))
          if (n > 0) fallan.push(`${forma}/${String(lado)} grano${String(trama.grano)} veta${String(trama.veta)}: ${String(n)}`)
        }
      }
    }
    expect(fallan, `siluetas con luz en el borde:\n  ${fallan.join('\n  ')}`).toEqual([])
  })

  it('y las siluetas siguen teniendo luz ADENTRO: la regla no se cumple apagándola', () => {
    // El control negativo, y hace falta: una silueta sin un solo `3` cumple la
    // regla 3 por vacuidad y se ve plana. Lo que se quiere es la luz movida hacia
    // adentro, no borrada.
    //
    // No se le pide a todas: `grano` son puntos sueltos de una celda y `malla`
    // es hilo cruzado, así que a lado chico pueden no tener adentro. Se le pide a
    // las que sí tienen cuerpo, que son las que se ven grandes en el mapa.
    for (const forma of ['vara', 'bloque'] as const) {
      const m = siluetaDe(forma, 24, { grano: 0, veta: 2 })
      const luz = m.reduce((n, f) => n + [...f].filter((c) => c === '3').length, 0)
      expect(luz, `«${forma}» quedó sin luz`).toBeGreaterThan(0)
    }
  })
})
