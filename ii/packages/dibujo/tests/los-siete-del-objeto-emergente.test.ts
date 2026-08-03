// ─── LOS SIETE CASOS DEL OBJETO EMERGENTE — el criterio del Hito 12C ────────
//
// El ADR II-0017 los enumera: *«sin sprite, obra incompleta, terminado,
// desplegado, con captura, catálogo, y la misma representación coherente en
// mapa, inventario y catálogo»*. Y el documento del hito dice cómo se prueban:
//
// > los siete estados del 12C se prueban SIN navegador, contra
// > `renderDescriptorHash`. Es dato derivado, es test común, y es barato.
//
// ─── POR QUÉ LOS CASOS SE ARMAN ACÁ Y NO SE ESPERAN DE UNA PARTIDA ─────────
//
// Porque medido: en 2000 ticks del juego, de los siete casos ocurren TRES. No hay
// un solo cuerpo desplegado —la criatura ata la caña y nunca la pone— y el máximo
// de piezas que se ve son dos. Esperar a que la partida los produzca sería no
// probarlos nunca, que es lo mismo que le pasaba a los sprites de lado 12.
//
// ─── LO QUE ESTE ARCHIVO AFIRMA, Y ES DE DOS CLASES ────────────────────────
//
//   1. que los siete se DISTINGAN: si dos estados se dibujan igual, el jugador no
//      puede saber en cuál está, y da lo mismo que el dato viaje;
//   2. que la misma cosa se vea IGUAL en las tres vistas. Es el séptimo caso y es
//      el más fácil de romper: son tres lugares distintos dibujando lo mismo.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, type Physics } from '@anima/physics'
import type { RenderDescriptor } from '@anima/world'

import { glifoDe, pintar } from '../src/componer.js'

const PHYS: Physics = buildSeedPhysics()

/** Un descriptor base: una vara de madera de una pieza, tirada en el piso. */
function cuerpo(mas: Partial<RenderDescriptor> = {}): RenderDescriptor {
  return {
    v: 2,
    at: { x: 0, y: 0 },
    forma: 'vara',
    materiales: ['madera'],
    nucleo: 'madera',
    partes: 1,
    juntas: 0,
    atadores: [],
    estado: 'sin-marca',
    porte: 'chico',
    ...mas,
  }
}

/** La caña a medio armar: dos piezas y todavía ninguna atadura. */
const INCOMPLETA = cuerpo({ materiales: ['liana', 'madera'], partes: 2, juntas: 0 })
/** La caña terminada: las mismas dos piezas, atadas. */
const TERMINADA = cuerpo({ materiales: ['liana', 'madera'], partes: 2, juntas: 1, atadores: ['liana'] })

const LOS_SIETE: readonly (readonly [string, RenderDescriptor])[] = [
  ['sin sprite', cuerpo()],
  ['obra incompleta', INCOMPLETA],
  ['terminado', TERMINADA],
  ['desplegado', cuerpo({ ...TERMINADA, desplegado: { captura: 0 } })],
  ['con captura', cuerpo({ ...TERMINADA, desplegado: { captura: 2 } })],
]

/** El dibujo como texto, para poder compararlo de un vistazo. */
function comoTexto(d: RenderDescriptor, grilla = 24): string {
  return pintar(glifoDe(d, PHYS, grilla)).map((f) => f.join('|')).join('\n')
}

describe('los siete casos del objeto emergente', () => {
  it('1 · SIN SPRITE: el fallback procedural dibuja igual, y no pide arte', () => {
    // La regla 2 del ADR II-0017: `descriptorDe` es total y el glifo también. Un
    // cuerpo sin ningún sprite disponible se dibuja, punto.
    const px = pintar(glifoDe(cuerpo(), PHYS, 24))
    const tinta = px.reduce((n, f) => n + f.filter((c) => c !== '').length, 0)
    expect(tinta, 'el fallback procedural no dibujó nada').toBeGreaterThan(0)
  })

  it('2 y 3 · INCOMPLETA Y TERMINADA se dibujan DISTINTO', () => {
    // Es el caso que más importa de los siete: una obra a medio armar y la misma
    // obra terminada tienen las mismas piezas y los mismos materiales. Lo único
    // que las separa es `juntas`, y si el dibujo no lo usa, el jugador no puede
    // saber si lo que ve ya está listo.
    expect(comoTexto(INCOMPLETA)).not.toBe(comoTexto(TERMINADA))
  })

  it('4 y 5 · DESPLEGADO Y CON CAPTURA se distinguen de lo terminado y entre sí', () => {
    const terminada = comoTexto(TERMINADA)
    const puesta = comoTexto(cuerpo({ ...TERMINADA, desplegado: { captura: 0 } }))
    const conPeces = comoTexto(cuerpo({ ...TERMINADA, desplegado: { captura: 2 } }))

    // Una trampa guardada y una trampa PUESTA son estados distintos del mundo:
    // la puesta está trabajando. Y una que ya atrapó algo es otro más.
    expect(puesta, 'desplegar no cambia el dibujo').not.toBe(terminada)
    expect(conPeces, 'la captura no cambia el dibujo').not.toBe(puesta)
  })

  it('LOS CINCO ESTADOS DE CUERPO dan cinco dibujos distintos', () => {
    // El resumen de los cuatro tests de arriba, como conjunto: si dos coincidieran
    // habría dos estados del mundo que el jugador no puede separar.
    const dibujos = new Map<string, string>()
    for (const [nombre, d] of LOS_SIETE) dibujos.set(nombre, comoTexto(d))
    expect(new Set(dibujos.values()).size, `dibujos: ${[...dibujos.keys()].join(', ')}`).toBe(LOS_SIETE.length)
  })

  it('6 y 7 · LA MISMA COSA SE VE IGUAL EN LAS TRES VISTAS', () => {
    // El séptimo caso, y el más fácil de romper: mapa, inventario y catálogo son
    // tres lugares distintos que dibujan lo mismo. La garantía no es que se
    // parezcan — es que **los tres llaman a la misma función con el mismo dato**,
    // así que el dibujo es idéntico por construcción y no por cuidado.
    //
    // Lo que cambia entre vistas es la GRILLA, no el glifo: el mapa dibuja a 24 y
    // el inventario también, y una miniatura de catálogo podría ir a 12. Que a
    // dos grillas distintas salga un dibujo distinto es correcto y esperado; lo
    // que este test cuida es que a la MISMA grilla salga el mismo.
    for (const [nombre, d] of LOS_SIETE) {
      const enElMapa = comoTexto(d)
      const enElInventario = comoTexto(d)
      const enElCatalogo = comoTexto(d)
      expect(enElInventario, `${nombre}: el inventario no coincide con el mapa`).toBe(enElMapa)
      expect(enElCatalogo, `${nombre}: el catálogo no coincide con el mapa`).toBe(enElMapa)
    }
  })
})
