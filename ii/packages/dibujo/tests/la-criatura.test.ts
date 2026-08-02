// ─── LA CRIATURA NO PARECE UNA ROCA ─────────────────────────────────────────
//
// El usuario lo dijo así: «el personaje no parece un personaje, parece una
// roca, eso está mal». Tenía dos causas y las dos están acá afirmadas.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type Physics } from '@anima/physics'
import type { RenderDescriptor } from '@anima/world'

import { celdasDistintas, glifoDe, pintar } from '../src/componer.js'
import { encargoDe } from '../src/pedido.js'
import { DE_FABRICA } from '../src/semillas.js'
import { claveDeCriatura, claveDePieza, revisarSprite, spritesEnMemoria } from '../src/sprite.js'

const PHYS: Physics = buildSeedPhysics()

const cuerpoDeCarne: RenderDescriptor = {
  v: 2,
  at: { x: 0, y: 0 },
  forma: 'bloque',
  materiales: ['carne'],
  nucleo: 'carne',
  partes: 1,
  juntas: 0,
  atadores: [],
  estado: 'sin-marca',
  porte: 'mediano',
}

describe('(a) la criatura pide un dibujo de criatura', () => {
  it('LA CAUSA 1: pedía la misma clave que un trozo de carne tirado en el piso', () => {
    const comoAgente = spritesEnMemoria()
    const comoCosa = spritesEnMemoria()
    glifoDe(cuerpoDeCarne, PHYS, 24, comoAgente, true)
    glifoDe(cuerpoDeCarne, PHYS, 24, comoCosa, false)

    expect(comoAgente.loQueFalta()).toEqual([claveDeCriatura('carne', 24)])
    expect(comoCosa.loQueFalta()).toEqual([claveDePieza('bloque', 'carne', 24)])
  })

  it('LA CAUSA 2: el encargo le decía «una pieza suelta», que era el peor de los 540', () => {
    const e = encargoDe(claveDeCriatura('carne', 24), PHYS)
    expect(e?.prompt).toContain('una criatura viva, de pie, de frente')
    expect(e?.prompt).not.toContain('pedazo suelto')
  })
})

describe('(b) y no se le pide a nadie: viene con el juego', () => {
  it('LA CRIATURA DE FÁBRICA PASA LA MISMA PUERTA QUE TODO LO DEMÁS', () => {
    // Un dibujo de fábrica mal hecho sería peor que uno del modelo, porque nadie
    // lo estaría mirando con desconfianza.
    for (const s of DE_FABRICA) {
      const v = revisarSprite({ filas: s.filas }, s.clave, s.lado)
      expect(v.ok, v.ok ? '' : `${s.clave}: ${v.porque}`).toBe(true)
    }
  })

  it('y tiene HUECOS de verdad, que es lo único que la saca de ser un terrón', () => {
    // No el color ni la textura: el cuello, el aire entre los brazos y el
    // cuerpo, y el hueco entre las piernas. Un bulto con patas pintadas encima
    // sigue siendo un bulto.
    const criatura = DE_FABRICA.find((s) => s.clave === claveDeCriatura('carne', 24))
    expect(criatura).toBeDefined()
    if (criatura === undefined) return

    // La fila del cuello: entre la cabeza y los hombros hay tinta sólo en el
    // medio, o sea que a los costados se ve el suelo.
    const cuello = criatura.filas[7] ?? ''
    expect(cuello.startsWith('000'), 'la cabeza está pegada al torso').toBe(true)

    // Y entre las dos piernas hay un 0 en las filas de abajo.
    const piernas = criatura.filas[19] ?? ''
    expect(piernas.slice(8, 16)).toContain('0')
  })

  it('EL CONTROL: se ve DISTINTA de un trozo de carne del mismo tamaño', () => {
    const sprites = spritesEnMemoria(DE_FABRICA)
    const laCriatura = pintar(glifoDe(cuerpoDeCarne, PHYS, 24, sprites, true))
    const unTrozo = pintar(glifoDe(cuerpoDeCarne, PHYS, 24, sprites, false))
    // Es el test que resume el pedido del usuario en un número.
    expect(celdasDistintas(laCriatura, unTrozo)).toBeGreaterThan(100)
  })
})
