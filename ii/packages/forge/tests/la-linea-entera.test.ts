/**
 * LA LÍNEA ENTERA, con el modelo de mentira — puntos 1, 2 y 9 del criterio.
 *
 * > dado el gap «conseguir alimento de un cuerpo de agua», **al menos una de dos
 * > candidatas compila sin reparación y al menos una compila con reparación**
 *
 * Y lo que hace posible probarlo es el muñeco: el modelo de verdad son ~14 s y
 * US$ 0,0158 por candidata, y **contesta distinto cada vez**. Un test que dice
 * «funciona» un día y «falla» al otro sin que nadie toque nada dejó de ser un
 * test.
 *
 * Acá la línea corre entera, gratis y siempre igual.
 */

import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { dosCandidatas, laQueInventa } from '../demo/falso.js'
import { fuentesDe, piezasDe } from '../src/candidata.js'
import { conceptosDe, loQueFalloDe, otraVuelta, primerEncargo, textoDe } from '../src/encargo.js'
import { Puerta } from '../src/puerta.js'
import { reparar } from '../src/reparar.js'
import type { Cambio } from '../src/reparar.js'

const GAP = 'conseguir alimento de un cuerpo de agua'
const VOCABULARIO = ['madera', 'liana', 'carne', 'agua']

type Desenlace = 'compila-sola' | 'compila-reparada' | 'no-se-pudo'

/** La línea, tal como la va a correr la fragua. Devuelve qué pasó y con qué. */
function porLaLinea(
  fuente: string,
  p: Puerta,
): { desenlace: Desenlace; cambios: readonly Cambio[]; conceptos: readonly string[] } {
  const antes = p.revisar(fuente)
  if (antes.k === 'compila') return { desenlace: 'compila-sola', cambios: [], conceptos: [] }

  const r = reparar(fuente, antes.errores, p)
  if (r.k === 'sin-arreglo') {
    return { desenlace: 'no-se-pudo', cambios: [], conceptos: conceptosDe(antes.errores) }
  }

  const despues = p.revisar(r.codigo)
  if (despues.k === 'compila') return { desenlace: 'compila-reparada', cambios: r.cambios, conceptos: [] }
  return { desenlace: 'no-se-pudo', cambios: r.cambios, conceptos: conceptosDe(despues.errores) }
}

describe('EL PUNTO 1 Y EL 2, con las dos candidatas de un viaje', () => {
  const p = new Puerta(ts)
  const dos = dosCandidatas(GAP)
  const resultados = dos.map((c) => {
    const f = fuentesDe(c)[0]
    return { nombre: f?.nombre ?? '?', ...porLaLinea(f?.fuente ?? '', p) }
  })

  it('el cuadro de las dos', () => {
    console.log(`\n  gap: ${GAP}\n`)
    for (const r of resultados) {
      const arreglo = r.cambios.map((c) => `${c.de} → ${c.a}`).join(', ')
      console.log(`  ${r.nombre.padEnd(18)} ${r.desenlace.padEnd(18)} ${arreglo || (r.conceptos.join(', ') || '—')}`)
    }
    expect(resultados.length).toBe(2)
  })

  it('AL MENOS UNA compila sin reparación', () => {
    expect(resultados.some((r) => r.desenlace === 'compila-sola')).toBe(true)
  })

  it('y AL MENOS UNA compila CON reparación', () => {
    const conArreglo = resultados.find((r) => r.desenlace === 'compila-reparada')
    expect(conArreglo, 'ninguna necesitó reparación: el muñeco no está probando nada').toBeDefined()
    // Y el arreglo es el que se esperaba, no cualquiera: si el corte cambiara y
    // empezara a reemplazar otra cosa, esto se pone rojo.
    expect(conArreglo?.cambios[0]?.de).toBe('ticksToNightfall')
    expect(conArreglo?.cambios[0]?.a).toBe('secondsToNightfall')
  })

  it('EL CONTROL: las dos son DISTINTAS — un muñeco que devuelve lo mismo no prueba', () => {
    expect(resultados[0]?.desenlace).not.toBe(resultados[1]?.desenlace)
  })

  it('y es DETERMINISTA: dos corridas dan lo mismo', () => {
    // Es la razón principal del muñeco. El modelo de verdad le dio a la misma
    // frase dos metas distintas, medido en vivo en el Hito 6.
    const q = new Puerta(ts)
    const otra = dosCandidatas(GAP).map((c) => porLaLinea(fuentesDe(c)[0]?.fuente ?? '', q).desenlace)
    expect(otra).toEqual(resultados.map((r) => r.desenlace))
  })
})

describe('EL PUNTO 9: la que inventa un concepto alimenta al segundo intento', () => {
  const p = new Puerta(ts)
  const c = laQueInventa(GAP)
  const r = porLaLinea(fuentesDe(c)[0]?.fuente ?? '', p)

  it('no se puede reparar, y se sabe QUÉ pidió que no existe', () => {
    console.log(`\n  ${r.desenlace} · conceptos: ${r.conceptos.join(', ')}`)
    expect(r.desenlace).toBe('no-se-pudo')
    expect(r.conceptos).toContain('hunger')
  })

  it('y el encargo de la segunda vuelta lo dice', () => {
    const dos = otraVuelta(primerEncargo(GAP, VOCABULARIO), loQueFalloDe([], r.conceptos))
    const t = textoDe(dos)
    console.log(`\n${t}\n`)
    expect(t).toContain('Intento 2')
    expect(t).toContain('hunger')
    expect(t).toContain('No son errores de tipeo')
  })
})

describe('el paquete, y lo que NO se exige', () => {
  it('una candidata sin plano sigue siendo una candidata', () => {
    // Las 17 innatas no tienen plano y son habilidades igual. Exigirlo obligaría
    // a inventar uno vacío, que es peor: un plano vacío entra al catálogo y
    // ocupa lugar.
    const c = dosCandidatas(GAP)[0]
    expect(c).toBeDefined()
    expect(piezasDe(c!)).toEqual(['usar'])
    expect(c?.plano).toBeUndefined()
  })

  it('y trae de qué encargo salió, que es lo que hace rastreable un fallo', () => {
    const c = laQueInventa(GAP, 3)
    expect(c.gap).toBe(GAP)
    expect(c.vuelta).toBe(3)
  })
})
