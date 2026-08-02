// ─── ¿SE PUEDE CONTAR? El criterio que el estilo elegido tiene que pagar ────
//
// El usuario eligió el glifo sabiendo su contra: **aplana la estructura**. Este
// archivo es la cuenta de esa deuda, y no la afirma con una opinión sino con un
// número: cuántas celdas cambian cuando una obra pasa de N piezas a N+1.
//
// ─── POR QUÉ EL UMBRAL ES 30 Y NO UN NÚMERO LINDO ───────────────────────────
//
// Sale de una medición adversarial sobre el layout ANTERIOR, que dejaba el hueco
// al final en vez de centrar la última fila. Con aquél, cinco piezas contra seis
// daban **16 · 18 · 22 · 38 · 40 · 62** según la forma, y el mínimo —la vara—
// es 2,8% de 576: invisible. Con la fila centrada el mínimo sube a 30, así que
// 30 es «lo que la reparación compró», no una aspiración.
//
// **Si este test se pone rojo, no se afloja el umbral: se arregla el layout.**
// Bajarlo sería volver exactamente al bug que lo motivó.
//
// ─── Y UN TEST QUE HABRÍA DADO VERDE MIDIENDO LO QUE NO SE USA ──────────────
//
// El adversario encontró algo peor que el bug: el invariante que tenía que
// cazarlo comparaba los patrones de 24×24 contra la esbeltez de la física, y a
// esa escala todo cumple. Pero **un cuerpo compuesto nunca dibuja a 24**: con
// dos piezas dibuja a 12 y con cinco a 8. Por eso el bloque (b) de acá barre las
// escalas que se usan de verdad, y no la que queda linda.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type FormId, type Physics } from '@anima/physics'
import type { RenderDescriptor } from '@anima/world'

import { celdasDistintas, glifoDe, pintar } from '../src/componer.js'
import { FORMAS, siluetaDe } from '../src/forma.js'

const PHYS: Physics = buildSeedPhysics()
const GRILLA = 24

/** Una obra de `n` piezas de la MISMA sustancia: el peor caso para contar. */
function obra(forma: FormId, n: number, juntas = 0, atador = 'liana'): RenderDescriptor {
  return {
    v: 2,
    at: { x: 0, y: 0 },
    forma,
    materiales: ['madera'],
    nucleo: 'madera',
    partes: n,
    juntas,
    atadores: new Array<string>(juntas).fill(atador),
    estado: 'sin-marca',
    porte: 'chico',
  }
}

const dibujo = (d: RenderDescriptor) => pintar(glifoDe(d, PHYS, GRILLA))

// ─── (a) Contar ─────────────────────────────────────────────────────────────

describe('(a) una pieza más se VE, en las seis formas', () => {
  const UMBRAL = 30

  for (const forma of FORMAS) {
    it(`${forma}: cada salto de N a N+1 mueve al menos ${String(UMBRAL)} celdas`, () => {
      const medidas: string[] = []
      let peor = Number.MAX_SAFE_INTEGER
      for (let n = 1; n < 6; n++) {
        // MISMA sustancia en las dos: si difirieran de material, el número diría
        // que se distinguen por COLOR y no por estructura, que es lo que se mide.
        const d = celdasDistintas(dibujo(obra(forma, n)), dibujo(obra(forma, n + 1)))
        medidas.push(`${String(n)}→${String(n + 1)}: ${String(d)}`)
        if (d < peor) peor = d
      }
      console.log(`  ${forma.padEnd(7)} ${medidas.join('  ')}`)
      expect(peor, `${forma}: el peor salto mueve ${String(peor)} celdas`).toBeGreaterThanOrEqual(UMBRAL)
    })
  }

  it('EL CONTROL: el mismo cuerpo contra sí mismo mueve CERO', () => {
    // Sin esto, un `celdasDistintas` roto —comparando por referencia, o contando
    // el lienzo entero— dejaría los seis de arriba en verde sin mirar nada.
    expect(celdasDistintas(dibujo(obra('vara', 4)), dibujo(obra('vara', 4)))).toBe(0)
  })

  it('y EL CONTROL DE CEGUERA: dos glifos que difieren sólo en el vacío dan cero', () => {
    // El índice 0 no pinta. Si una diferencia que sólo vive en el vacío contara,
    // todos los números de arriba estarían inflados.
    const a = dibujo(obra('bloque', 2))
    const b = dibujo(obra('bloque', 2))
    expect(celdasDistintas(a, b)).toBe(0)
  })
})

// ─── (b) La proporción, EN LAS ESCALAS QUE SE USAN ──────────────────────────

describe('(b) la esbeltez sobrevive al tamaño chico', () => {
  /** Ancho y alto de la tinta de una máscara. */
  function caja(m: readonly string[]): { ancho: number; alto: number } {
    let x0 = 999
    let x1 = -1
    let y0 = 999
    let y1 = -1
    for (let y = 0; y < m.length; y++) {
      const f = m[y]
      if (f === undefined) continue
      for (let x = 0; x < f.length; x++) {
        if (f.charAt(x) === '0') continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
    return { ancho: x1 - x0 + 1, alto: y1 - y0 + 1 }
  }

  const LADOS = [24, 12, 8]
  const TRAMA = { grano: 1, veta: 1 } as const

  it('LA HEBRA ES MÁS ESBELTA QUE LA VARA EN LAS TRES ESCALAS, y era el bug', () => {
    // El bug medido en el layout anterior: al reducir un patrón de 24 a 8, la
    // regla «es tinta si alguna celda lo es» ENGORDA los trazos finos, y la
    // hebra terminaba con razón 3,56 contra 4,00 de la vara — o sea MENOS
    // esbelta que la vara, al revés de lo que la física declara (6 contra 4).
    for (const lado of LADOS) {
      const h = caja(siluetaDe('hebra', lado, TRAMA))
      const v = caja(siluetaDe('vara', lado, TRAMA))
      const razonH = h.alto / h.ancho
      const razonV = v.alto / v.ancho
      console.log(`  lado ${String(lado).padStart(2)}  hebra ${razonH.toFixed(2)}  vara ${razonV.toFixed(2)}`)
      expect(razonH, `a lado ${String(lado)} la hebra no es más esbelta que la vara`).toBeGreaterThan(razonV)
    }
  })

  it('y una vara es más esbelta que un bloque, también en las tres', () => {
    for (const lado of LADOS) {
      const v = caja(siluetaDe('vara', lado, TRAMA))
      const b = caja(siluetaDe('bloque', lado, TRAMA))
      expect(v.alto / v.ancho).toBeGreaterThan(b.alto / b.ancho)
    }
  })

  it('EL CONTROL: `caja` mide de verdad, no devuelve siempre lo mismo', () => {
    const v = caja(siluetaDe('vara', 24, TRAMA))
    const b = caja(siluetaDe('bloque', 24, TRAMA))
    expect(v.ancho).not.toBe(b.ancho)
    expect(b.ancho).toBe(24)
  })
})

// ─── (c) Los nudos se ven, y son del color de su atador ─────────────────────

describe('(c) las juntas se ven, y de qué se ató', () => {
  it('CINCO NUDOS DE JUNCO sobre seis yescas: el junco aparece en el dibujo', () => {
    // Es el caso del proyecto: la criatura ata seis yescas para armar el fardo
    // que enciende el fuego que cocina. `Joint.via` existía desde el Hito 1 y
    // ninguna vista lo leyó nunca.
    const conJunco = dibujo(obra('bloque', 6, 5, 'junco'))
    const sinJuntas = dibujo(obra('bloque', 6, 0))
    expect(celdasDistintas(conJunco, sinJuntas)).toBeGreaterThan(0)
  })

  it('y atar con OTRA cosa se ve distinto: no es «hay un nudo», es «hay un nudo de esto»', () => {
    const junco = dibujo(obra('bloque', 6, 5, 'junco'))
    const tendon = dibujo(obra('bloque', 6, 5, 'tendon'))
    expect(celdasDistintas(junco, tendon)).toBeGreaterThan(0)
  })

  it('EL CONTROL: atar con lo mismo dos veces da el mismo dibujo', () => {
    expect(celdasDistintas(dibujo(obra('bloque', 6, 5, 'junco')), dibujo(obra('bloque', 6, 5, 'junco')))).toBe(0)
  })
})

// ─── (d) Lo que le pasa a una cosa se ve ────────────────────────────────────

describe('(d) el estado se ve, y no borra de qué está hecha', () => {
  const conEstado = (e: RenderDescriptor['estado']) => dibujo({ ...obra('bloque', 2), estado: e })

  it('ardiendo, chamuscado y mojado son tres dibujos distintos entre sí y del normal', () => {
    const normal = conEstado('sin-marca')
    const vistos = new Set<string>()
    for (const e of ['sin-marca', 'ardiendo', 'chamuscado', 'mojado'] as const) {
      vistos.add(JSON.stringify(conEstado(e)))
      if (e !== 'sin-marca') expect(celdasDistintas(conEstado(e), normal), e).toBeGreaterThan(0)
    }
    expect(vistos.size).toBe(4)
  })

  it('y lo PODRIDO se suma a la banda en vez de reemplazarla', () => {
    const asado = dibujo({ ...obra('bloque', 2), estado: 'asado' })
    const podrido = dibujo({ ...obra('bloque', 2), estado: 'asado', podrido: true })
    expect(celdasDistintas(asado, podrido)).toBeGreaterThan(0)
  })
})

// ─── (e) Total y determinista ───────────────────────────────────────────────

describe('(e) todo descriptor da un glifo, y siempre el mismo', () => {
  it('las seis formas × una a seis partes: ninguna combinación se queda sin dibujo', () => {
    for (const forma of FORMAS) {
      for (let n = 1; n <= 6; n++) {
        const g = glifoDe(obra(forma, n, n - 1), PHYS, GRILLA)
        expect(g.capas.length, `${forma} con ${String(n)} partes`).toBeGreaterThan(0)
        // Y ninguna capa se sale del lienzo por arriba o por la izquierda.
        for (const c of g.capas) {
          expect(c.x).toBeGreaterThanOrEqual(0)
          expect(c.y).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('un cuerpo con más partes que MAX_PARTS se dibuja igual, sin romperse', () => {
    // Total quiere decir total: un descriptor imposible tampoco puede tirar.
    expect(glifoDe(obra('vara', 99, 0), PHYS, GRILLA).capas.length).toBeGreaterThan(0)
    expect(glifoDe(obra('vara', 0, 0), PHYS, GRILLA).capas.length).toBeGreaterThan(0)
  })

  it('y mil dibujos del mismo descriptor son el mismo dibujo', () => {
    const primero = JSON.stringify(dibujo(obra('bloque', 5, 4)))
    for (let i = 0; i < 1000; i++) expect(JSON.stringify(dibujo(obra('bloque', 5, 4)))).toBe(primero)
  })
})
