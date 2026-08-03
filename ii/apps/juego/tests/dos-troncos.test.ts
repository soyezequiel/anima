// ─── C3-C · «JUNTÁ DOS TRONCOS», DE PUNTA A PUNTA ──────────────────────────
//
// La primera de las tres partes de la frase del criterio, la única que se puede
// hoy. Lo que se afirma no es que la lea: es que **no se dé por cumplida con
// uno**, que es lo que pasaba en silencio.
//
// ─── EL HALLAZGO QUE ESTE ARCHIVO GUARDA ───────────────────────────────────
//
// El planificador NO sabe contar y no hizo falta enseñarle. `plan()` sabe
// conseguir UNO —`agarrarLoQueYaHay`— y la mente replanifica mientras la meta
// siga sin cumplirse, así que juntar dos sale de repetir lo que ya sabía. La
// cuenta vive en el OBJETIVO y no en el plan, y ésa es la razón de que agregarla
// haya costado un campo y no un planificador nuevo.
//
// Medido: con dos en la mano la meta se cumple, y la criatura después las ATA
// —«madera con liana»— porque el drive del cuidador compite con lo suyo y no lo
// reemplaza. El encargo ya estaba cerrado para entonces.

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'

import { Ordenes } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

const QUIEN = 'ana'
const SEMILLA = 20260727n

interface Sesion {
  readonly p: Partida
  readonly o: Ordenes
}

function nueva(): Sesion {
  const { state } = arrancar(SEMILLA)
  const p = new Partida(state)
  return { p, o: new Ordenes(p, QUIEN, PHYS) }
}

/** Cuántas cosas fibrosas tiene en la mano, leído del MUNDO y no del encargo. */
function fibrososEnLaMano(p: Partida): number {
  const a = p.state.actors.get(QUIEN)
  let n = 0
  for (const id of a?.holding ?? []) {
    const b = p.state.bodies.get(id)
    const esFibroso = b?.body.parts.some(
      (x) => p.state.phys.substances.get(x.substance)?.tags.includes('fibroso') === true,
    )
    if (esFibroso === true) n++
  }
  return n
}

/**
 * Corre hasta que el encargo se cierra, y devuelve cuántos fibrosos tenía EN ESE
 * MOMENTO. `-1` si no se cerró.
 */
function fibrososAlCerrar(s: Sesion, tope: number): number {
  for (let k = 0; k < tope; k++) {
    s.o.antesDelTick(s.p.state.tick)
    if (s.o.encargo === undefined) return fibrososEnLaMano(s.p)
    vivir(s.p, s.o.mentes, 1)
    s.o.despuesDelTick()
  }
  return -1
}

describe('C3 · «juntá dos troncos» pide dos', () => {
  it('(1) LA FRASE SE LEE CON SU NÚMERO, y el catálogo dice que hay camino', () => {
    const s = nueva()
    s.o.decir('juntá dos troncos')
    const c = s.o.ultimaLectura?.clausulas[0]
    expect(c?.firma).toBe('holding(tag:fibroso,count>=2)')
    expect(c?.grado).toBe('entendida')
    expect(s.o.charla[1]?.texto).toBe('dale, voy')
  })

  it('(2) Y NO SE DA POR CUMPLIDA CON UNO — que es lo que pasaba', () => {
    const s = nueva()
    s.o.decir('juntá dos troncos')
    const cuando = fibrososAlCerrar(s, 400)
    expect(cuando, 'el encargo no se cerró en 400 ticks').toBeGreaterThanOrEqual(0)
    expect(cuando, 'se dio por cumplido sin tener dos').toBeGreaterThanOrEqual(2)
  })

  it('(3) EL CONTROL: sin número pide uno, y con uno cierra', () => {
    // Sin esto, «no cierra con uno» podría querer decir «no cierra nunca», que
    // se vería igual desde afuera.
    const s = nueva()
    s.o.decir('juntá un tronco')
    expect(s.o.ultimaLectura?.clausulas[0]?.firma).toBe('holding(tag:fibroso)')
    expect(fibrososAlCerrar(s, 400)).toBeGreaterThanOrEqual(1)
  })

  it('(4) el número también se escribe con dígitos', () => {
    const s = nueva()
    s.o.decir('juntá 3 troncos')
    expect(s.o.ultimaLectura?.clausulas[0]?.firma).toBe('holding(tag:fibroso,count>=3)')
  })

  it('(5) y la meta se dice en castellano con el número adelante', () => {
    const s = nueva()
    s.o.decir('juntá dos troncos')
    s.o.antesDelTick(s.p.state.tick)
    expect(s.o.enCurso?.meta).toContain('dos')
  })
})
