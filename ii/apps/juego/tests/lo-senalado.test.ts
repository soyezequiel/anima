// ─── LO QUE SE SEÑALA CON EL MOUSE, SIN NAVEGADOR ───────────────────────────
//
// El cartel del hover y el panel «Lo que miraste» dicen lo mismo porque llaman a
// la misma función. Eso es lo que se prueba acá, y es la única forma de que siga
// siendo cierto: mientras la cuenta vivía adentro del `click`, la segunda vista
// tenía que copiarla, y una copia diverge el día que alguien arregla una sola.
//
// Las cuatro decisiones que este archivo protege:
//
//   1. de una pila, se nombra la MÁS GRANDE — es la que el mapa dibuja encima, o
//      sea la que la persona creyó estar señalando;
//   2. lo que está en una mano NO se señala desde el mapa: no se dibuja en el
//      suelo, así que sería nombrar algo que no está ahí;
//   3. lo de la mano SÍ se describe desde el inventario, con el mismo texto;
//   4. el cartel se da vuelta contra los bordes de la ventana. Ese caso se ve una
//      vez cada diez hover en pantalla y siempre acá.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, nameOf } from '@anima/physics'
import type { Body } from '@anima/physics'
import { descriptorDe } from '@anima/world'
import type { Escena, RenderDescriptor } from '@anima/world'

import { describir, firmaDe, loSenaladoEn, ubicarElCartel } from '../src/lo-senalado.js'

const PHYS = buildSeedPhysics()

function cuerpo(d: Partial<RenderDescriptor> & { at: { x: number; y: number } }): RenderDescriptor {
  return {
    v: 1,
    forma: 'vara',
    materiales: ['madera'],
    nucleo: 'madera',
    partes: 1,
    juntas: 0,
    atadores: [],
    estado: 'sin-marca',
    porte: 'chico',
    ...d,
  }
}

/** Una escena mínima: lo único que `loSenaladoEn` mira son cuerpos y actores. */
function escena(
  cuerpos: readonly (readonly [string, { d: RenderDescriptor; heldBy?: string }])[],
  actores: readonly string[] = [],
): Escena {
  return {
    v: 2,
    tick: 0,
    foco: { x: 0, y: 0 },
    radio: { x: 7, y: 7 },
    celdas: [],
    cuerpos: new Map(cuerpos),
    actores: actores.map((body) => ({ body })),
  } as unknown as Escena
}

describe('qué hay en la celda que estás señalando', () => {
  it('EL MÁS GRANDE MANDA, y dice cuántos más hay debajo', () => {
    // El dios siembra hasta trece cuerpos en una misma celda. Mostrar sólo el de
    // arriba sin decir que hay más haría creer que ahí hay una cosa.
    const e = escena([
      ['grano-1', { d: cuerpo({ at: { x: 3, y: 4 }, forma: 'grano', porte: 'menudo' }) }],
      ['tronco', { d: cuerpo({ at: { x: 3, y: 4 }, forma: 'bloque', porte: 'grande' }) }],
      ['hebra-1', { d: cuerpo({ at: { x: 3, y: 4 }, forma: 'hebra', porte: 'chico' }) }],
    ])

    const s = loSenaladoEn(e, { x: 3, y: 4 }, PHYS)
    expect(s?.id).toBe('tronco')
    expect(s?.titulo).toBe('madera (y 2 más acá)')
  })

  it('en una celda vacía no hay nada que señalar', () => {
    const e = escena([['vara-1', { d: cuerpo({ at: { x: 0, y: 0 } }) }]])
    expect(loSenaladoEn(e, { x: 9, y: 9 }, PHYS)).toBeUndefined()
  })

  it('LO QUE ESTÁ EN UNA MANO NO SE SEÑALA: el mapa no lo dibuja en el suelo', () => {
    const e = escena([['vara-1', { d: cuerpo({ at: { x: 2, y: 2 } }), heldBy: 'ana' }]])
    expect(loSenaladoEn(e, { x: 2, y: 2 }, PHYS)).toBeUndefined()
  })

  it('la criatura se nombra como la criatura', () => {
    const e = escena(
      [['ana-cuerpo', { d: cuerpo({ at: { x: 1, y: 1 }, forma: 'malla', materiales: ['carne'], nucleo: 'carne', estado: 'crudo' }) }]],
      ['ana-cuerpo'],
    )
    expect(loSenaladoEn(e, { x: 1, y: 1 }, PHYS)?.titulo).toBe('carne cruda (la criatura)')
  })
})

describe('EL NOMBRE ES EL DEL MUNDO, no uno que se arma la pantalla', () => {
  // Éste es el test que importa de los de acá, y sale de un bug que se vio en
  // pantalla: el cartel decía **«bloque»** —la forma geométrica— donde el mundo
  // dice «tubérculo crudo». Lo que se afirma es que el cartel y el registro de
  // la charla llaman a la misma función, comparándolos sobre el mismo cuerpo.
  const casos: readonly (readonly [string, Body])[] = [
    [
      'un tubérculo, que es lo que destapó el bug',
      { id: 'papa', form: 'bloque', parts: [{ substance: 'tuberculo', mass: 0.4, q: {} }], joints: [], state: {} },
    ],
    [
      'una vara de madera, que no tiene adjetivo ninguno',
      { id: 'vara', form: 'vara', parts: [{ substance: 'madera', mass: 0.5, q: {} }], joints: [], state: {} },
    ],
    [
      'una caña atada: dos sustancias, y la que manda es la de más masa',
      {
        id: 'cana',
        form: 'vara',
        parts: [
          { substance: 'liana', mass: 0.05, q: {} },
          { substance: 'madera', mass: 0.9, q: {} },
        ],
        joints: [{ a: 0, b: 1, via: 'liana', strength: 1 }],
        state: {},
      },
    ],
    [
      'carne ardiendo: el adjetivo sale de la banda y no de la temperatura',
      {
        id: 'bicho',
        form: 'malla',
        parts: [{ substance: 'carne', mass: 2, q: {} }],
        joints: [],
        state: { temperature: 400 },
      },
    ],
  ]

  for (const [que, b] of casos) {
    it(que, () => {
      const d = descriptorDe({ body: b, at: { x: 0, y: 0 } }, PHYS)
      expect(describir(b.id, d, PHYS, { mas: 0, esAgente: false }).titulo).toBe(nameOf(b, PHYS))
    })
  }
})

describe('las cuatro frases', () => {
  it('una parte no dice «1 partes», y las juntas se cuentan aparte', () => {
    const uno = describir('x', cuerpo({ at: { x: 0, y: 0 } }), PHYS, { mas: 0, esAgente: false })
    expect(uno.piezas).toBe('1 parte')

    const dos = describir(
      'y',
      cuerpo({ at: { x: 0, y: 0 }, partes: 2, juntas: 1, materiales: ['liana', 'madera'] }),
      PHYS,
      { mas: 0, esAgente: false },
    )
    expect(dos.piezas).toBe('2 partes, 1 atada')
    // Y el nombre menciona a la otra: «madera con liana», igual que en la charla.
    // Por eso la línea de materiales queda vacía: no tiene nada que agregar.
    expect(dos.titulo).toBe('madera con liana')
    expect(dos.de).toBe('')
  })

  it('CON TRES SUSTANCIAS la línea de materiales vuelve, porque el nombre deja una afuera', () => {
    const tres = describir(
      'z',
      cuerpo({ at: { x: 0, y: 0 }, partes: 3, juntas: 2, materiales: ['carne', 'liana', 'madera'] }),
      PHYS,
      { mas: 0, esAgente: false },
    )
    expect(tres.titulo).toBe('madera con carne')
    expect(tres.de).toBe('carne · liana · madera')
  })

  it('LA FORMA Y EL PORTE VAN JUNTOS, y la banda ya no está: se mudó al nombre', () => {
    const s = describir('x', cuerpo({ at: { x: 0, y: 0 }, forma: 'bloque', materiales: ['tuberculo'], nucleo: 'tuberculo', estado: 'crudo' }), PHYS, {
      mas: 0,
      esAgente: false,
    })
    expect(s.titulo).toBe('tubérculo crudo')
    expect(s.comoEs).toBe('bloque · chico')
  })

  it('lo podrido se dice, y lo dice el nombre', () => {
    const feo = describir(
      'y',
      cuerpo({ at: { x: 0, y: 0 }, materiales: ['carne'], nucleo: 'carne', estado: 'crudo', podrido: true }),
      PHYS,
      { mas: 0, esAgente: false },
    )
    expect(feo.titulo).toBe('carne cruda podrida')
  })

  it('LA FIRMA CAMBIA CUANDO CAMBIA LO QUE SE LEE, y no cuando no', () => {
    // Es lo que decide si el cartel se reescribe. Sin esto, el DOM se rearma
    // sesenta veces por segundo mientras el mouse está quieto.
    const cruda = describir('x', cuerpo({ at: { x: 0, y: 0 }, estado: 'crudo' }), PHYS, { mas: 0, esAgente: false })
    const misma = describir('x', cuerpo({ at: { x: 4, y: 9 }, estado: 'crudo' }), PHYS, { mas: 0, esAgente: false })
    const ardiendo = describir('x', cuerpo({ at: { x: 0, y: 0 }, estado: 'ardiendo' }), PHYS, {
      mas: 0,
      esAgente: false,
    })

    // Moverse de celda no cambia lo que dice el cartel: es la misma vara.
    expect(firmaDe(misma)).toBe(firmaDe(cruda))
    expect(firmaDe(ardiendo)).not.toBe(firmaDe(cruda))
    expect(firmaDe(undefined)).toBe('')
  })
})

describe('dónde va el cartel', () => {
  const CARTEL = { ancho: 200, alto: 60 }
  const VENTANA = { ancho: 1000, alto: 800 }

  it('abajo y a la derecha del puntero, que es donde el ojo ya está', () => {
    expect(ubicarElCartel({ x: 300, y: 300 }, CARTEL, VENTANA)).toEqual({ left: 316, top: 316 })
  })

  it('SE DA VUELTA CONTRA EL BORDE DERECHO, en vez de desbordar la página', () => {
    const { left } = ubicarElCartel({ x: 950, y: 300 }, CARTEL, VENTANA)
    expect(left).toBe(950 - 16 - 200)
    expect(left + CARTEL.ancho).toBeLessThan(VENTANA.ancho)
  })

  it('y contra el de abajo, que es el que más pasa: el mapa llega hasta ahí', () => {
    const { top } = ubicarElCartel({ x: 300, y: 780 }, CARTEL, VENTANA)
    expect(top).toBe(780 - 16 - 60)
  })

  it('EN UNA VENTANA MÁS ANGOSTA QUE EL CARTEL las dos ramas dan negativo', () => {
    // Sin el tope, el texto se corta por la izquierda y no hay forma de leerlo.
    const chica = { ancho: 180, alto: 140 }
    const { left, top } = ubicarElCartel({ x: 170, y: 130 }, CARTEL, chica)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(top).toBeGreaterThanOrEqual(0)
  })
})
