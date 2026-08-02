// ─── ¿SE VE SOBRE EL SUELO? ─────────────────────────────────────────────────
//
// La paleta de las nueve familias se eligió sobre fondo neutro. Este archivo
// pregunta lo que faltaba: **si se sigue viendo sobre el suelo del mapa**, en
// los tres suelos y en las dos fases del reloj.
//
// El caso que motiva todo tiene nombre y está escrito en `paleta.ts`: la familia
// `tizon` no usa un negro real en su base porque **el pedernal desaparecía justo
// de noche**, y el pedernal es lo único que corta en el catálogo semilla. Este
// test es lo que impide que esa reparación se pierda en la próxima recalibración
// de colores.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type Physics } from '@anima/physics'

import { PALETAS, aspectoDe, type Familia } from '../src/paleta.js'
import { CONTRASTE_MINIMO, contraste, fondoDe, luma, mezclar, sueloDe, SUELOS } from '../src/mundo.js'

const PHYS: Physics = buildSeedPhysics()

const CELDAS = [
  { nombre: 'seca', c: { wet: 0.1, sheltered: 0 } },
  { nombre: 'mojada', c: { wet: 0.7, sheltered: 0 } },
  { nombre: 'bajo techo', c: { wet: 0.1, sheltered: 0.8 } },
] as const

const FASES = [{ phase: 'dia' as const }, { phase: 'noche' as const }]
const FAMILIAS = Object.keys(PALETAS) as Familia[]

describe('(a) el suelo sale de lo que la escena publica', () => {
  it('mojado es exactamente donde la ley 3 apaga un fuego', () => {
    expect(sueloDe({ wet: 0.44, sheltered: 0 })).toBe('seco')
    expect(sueloDe({ wet: 0.45, sheltered: 0 })).toBe('mojado')
  })

  it('y bajo techo manda sobre mojado: si hay algo encima, lo que se ve es la sombra', () => {
    expect(sueloDe({ wet: 0.9, sheltered: 0.5 })).toBe('bajo-techo')
  })

  it('EL CONTROL: los tres suelos son tres colores distintos', () => {
    expect(new Set(Object.values(SUELOS)).size).toBe(3)
  })
})

describe('(b) la noche oscurece y no rompe', () => {
  it('de noche todo baja de luma, en los tres suelos', () => {
    for (const { nombre, c } of CELDAS) {
      const dia = luma(fondoDe(c, FASES[0] ?? { phase: 'dia' }))
      const noche = luma(fondoDe(c, FASES[1] ?? { phase: 'noche' }))
      expect(noche, `${nombre}: la noche no oscureció`).toBeLessThan(dia)
    }
  })

  it('la mezcla es entera y estable: mil veces da el mismo hex', () => {
    const primero = mezclar('#b4afa3', '#0a1533', 150)
    for (let i = 0; i < 1000; i++) expect(mezclar('#b4afa3', '#0a1533', 150)).toBe(primero)
    expect(primero).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('EL CONTROL: mezclar con k=0 y k=255 devuelve los extremos', () => {
    // Sin esto, una mezcla que ignorara `k` pasaría el test de arriba igual.
    expect(mezclar('#b4afa3', '#0a1533', 0)).toBe('#b4afa3')
    expect(mezclar('#b4afa3', '#0a1533', 255)).toBe('#0a1533')
  })
})

describe('(c) las nueve familias se ven sobre los seis fondos', () => {
  it('LA TABLA DE CONTRASTE, y su peor par', () => {
    console.log('\n─── CONTRASTE DE CADA FAMILIA CONTRA CADA FONDO ───')
    const cabecera = CELDAS.flatMap(({ nombre }) => FASES.map((f) => `${nombre[0] ?? ''}${f.phase[0] ?? ''}`))
    console.log(`  familia   ${cabecera.map((h) => h.padStart(5)).join('')}   peor`)

    let peor = { n: 999, quien: '' }
    for (const familia of FAMILIAS) {
      const base = PALETAS[familia].base
      const fila: number[] = []
      for (const { c } of CELDAS) {
        for (const f of FASES) fila.push(contraste(base, fondoDe(c, f)))
      }
      const min = Math.min(...fila)
      if (min < peor.n) peor = { n: min, quien: familia }
      console.log(`  ${familia.padEnd(9)} ${fila.map((v) => String(v).padStart(5)).join('')}   ${String(min).padStart(3)}`)
    }
    console.log(`\n  el peor par: ${peor.quien} contra su fondo más parecido = ${String(peor.n)}`)
    console.log(`  el piso: ${String(CONTRASTE_MINIMO)}\n`)

    expect(peor.n, `${peor.quien} se pierde contra el fondo`).toBeGreaterThanOrEqual(CONTRASTE_MINIMO)
  })

  it('EL PEDERNAL SE VE DE NOCHE, que es el caso que motivó la familia entera', () => {
    // La reparación escrita en `paleta.ts`: la base de `tizon` no es negra
    // porque con un negro real quedaba pegada al fondo nocturno. Si alguien la
    // «arregla» poniéndole el negro que parece correcto, esto se pone rojo.
    const pedernal = aspectoDe('pedernal', PHYS)
    const deNoche = fondoDe({ wet: 0.1, sheltered: 0 }, { phase: 'noche' })
    expect(contraste(pedernal.paleta.base, deNoche)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO)
  })

  it('EL CONTROL: `contraste` puede dar bajo — dos colores iguales dan cero', () => {
    // Sin esto, un `contraste` que devolviera siempre un número grande dejaría
    // toda la tabla en verde sin comparar nada.
    expect(contraste('#2c3126', '#2c3126')).toBe(0)
    expect(contraste(SUELOS.seco, SUELOS.seco)).toBeLessThan(CONTRASTE_MINIMO)
  })
})
