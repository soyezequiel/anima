// ─── EL INVENTARIO ES EL PRIMER LUGAR DONDE SE DIBUJA LO COMPUESTO ──────────
//
// El registro decía «faltan los sprites de lado 12 y 8, así que todo objeto de
// dos o más piezas se dibuja procedural». Medido sobre 400 ticks del juego: **de
// las once claves que se piden, las once son de lado 24**.
//
// No era que se dibujaran mal: es que no se dibujaban en ningún lado. En todo el
// mundo hay UN cuerpo de varias piezas —la caña que la criatura ata— y está en la
// mano; el mapa no dibuja lo que está en una mano, y era el único que dibujaba.
//
// Este test afirma las dos mitades: que el mapa solo NO pide lados chicos, y que
// dibujar lo que la criatura lleva SÍ los pide. Sin la primera mitad, la segunda
// no probaría que el inventario aportó algo.

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import { escenaDe, relojDe } from '@anima/world'
import { DE_FABRICA, glifoDe, mapaDe, pintar, spritesEnMemoria } from '@anima/dibujo'

import { Ordenes } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

/** Corre el juego y devuelve qué claves quedaron pedidas, dibujando lo que se le diga. */
function correr(conInventario: boolean): readonly string[] {
  const { state, parada } = arrancar(20260727n)
  const p = new Partida(state)
  const o = new Ordenes(p, 'ana', PHYS)
  const sprites = spritesEnMemoria(DE_FABRICA)
  for (let k = 0; k < 400; k++) {
    o.antesDelTick(p.state.tick)
    vivir(p, o.mentes, 1)
    const foco = p.state.bodies.get('ana-cuerpo')?.at ?? parada
    const e = escenaDe(p.state, foco, 7)
    mapaDe(e, PHYS, relojDe(p.state), sprites)
    if (conInventario) {
      for (const id of e.actores[0]?.holding ?? []) {
        const c = e.cuerpos.get(id)
        if (c !== undefined) pintar(glifoDe(c.d, PHYS, 24, sprites))
      }
    }
  }
  return sprites.loQueFalta()
}

const ladoDe = (clave: string): string => clave.split('/')[2] ?? '?'

describe('los sprites de las piezas chicas', () => {
  it('EL CONTROL: con el mapa solo, no se pide un solo lado que no sea 24', () => {
    const claves = correr(false)
    expect(claves.length).toBeGreaterThan(0)
    expect([...new Set(claves.map(ladoDe))]).toEqual(['24'])
  })

  it('DIBUJANDO LO QUE LLEVA, aparecen los lados chicos', () => {
    const claves = correr(true)
    const lados = new Set(claves.map(ladoDe))
    // La caña son dos piezas, y a dos piezas `layout` les da media grilla: 12.
    expect([...lados].sort(), `claves: ${claves.join(' ')}`).toContain('12')
  })
})
