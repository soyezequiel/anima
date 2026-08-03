// ─── LAS CUATRO REGLAS DEL CAJÓN, COMO TABLA ────────────────────────────────
//
// Los `el-cajon.spec.ts` prueban que el CABLE llegue: que la charla de verdad se
// corra, que el tirador la traiga, que el punto se prenda. Eso sólo se puede ver
// en un navegador y tarda veinte segundos.
//
// Lo que se prueba acá es la DECISIÓN, y son seis filas de tabla. La diferencia
// vale porque el caso que más importa —la misma pantalla de 900 px con la charla
// abierta o cerrada según cómo llegaste— en el navegador son dos tests de
// catorce líneas cada uno y acá son dos renglones que se leen juntos.

import { describe, expect, it } from 'vitest'
import { laCharlaQueda } from '../src/el-umbral.js'

describe('qué le pasa a la charla al cruzar el umbral', () => {
  it('LA PRIMERA MEDICIÓN NO ES UN CRUCE, y por eso arranca abierta en angosto', () => {
    // Es la regla 1. Sin ella, la primera pantalla que ve alguien que abre el
    // juego en un teléfono es un tirador que no explica nada.
    expect(laCharlaQueda({ esAngosto: true, eraAngosto: false, abierta: true, primera: true })).toBe(true)
    expect(laCharlaQueda({ esAngosto: false, eraAngosto: false, abierta: true, primera: true })).toBe(true)
  })

  it('DE ANCHO A ANGOSTO SE CIERRA: taparía la pantalla principal', () => {
    expect(laCharlaQueda({ esAngosto: true, eraAngosto: false, abierta: true, primera: false })).toBe(false)
  })

  it('y de angosto a ancho SE ABRE, que es la simétrica', () => {
    expect(laCharlaQueda({ esAngosto: false, eraAngosto: true, abierta: false, primera: false })).toBe(true)
  })

  it('SIN CRUCE NO PASA NADA, y es la fila que evita el bug más molesto', () => {
    // Con `if (esAngosto) cerrar`, cada píxel de `resize` abajo del umbral
    // volvería a cerrar la charla que la persona acaba de abrir con el tirador.
    // Arrastrar el borde de la ventana la haría inusable.
    expect(laCharlaQueda({ esAngosto: true, eraAngosto: true, abierta: true, primera: false })).toBe(true)
    expect(laCharlaQueda({ esAngosto: true, eraAngosto: true, abierta: false, primera: false })).toBe(false)
    expect(laCharlaQueda({ esAngosto: false, eraAngosto: false, abierta: false, primera: false })).toBe(false)
  })

  it('LA MISMA PANTALLA, DOS RESULTADOS — y ésa es toda la razón de este archivo', () => {
    // Las dos filas terminan en angosto y difieren en cómo llegaron. Ningún
    // ancho determina el estado, y por eso el estado no puede vivir en una regla
    // de ancho: un `@media` sabe DÓNDE estás, no DE DÓNDE VENÍS.
    const llegandoDeCero = { esAngosto: true, eraAngosto: false, abierta: true, primera: true }
    const llegandoAchicando = { esAngosto: true, eraAngosto: false, abierta: true, primera: false }
    expect(laCharlaQueda(llegandoDeCero)).toBe(true)
    expect(laCharlaQueda(llegandoAchicando)).toBe(false)
  })
})
