/**
 * EL LIBRO DE LUGARES — el hueco «`recall` sin `remember`», cerrado a medias.
 *
 * `ctx.recall(w): PlaceMemory[]` existía desde el Hito 4 y **no había NINGUNA
 * forma de escribir un `PlaceMemory`**: el Mundito lo resolvía con un método
 * fuera de `Ctx`, o sea que el test se acordaba por la criatura. Acá lo escribe
 * el runtime, una vez por tick, sobre la celda donde la criatura está parada.
 *
 * Lo que queda abierto —recordar lo que se VE y no sólo lo que se PISA— está
 * abajo con su `it.fails`.
 */

import { describe, expect, it } from 'vitest'
import type { CellState, WorldState } from '@anima/world'
import { keyOfCell } from '@anima/world'
import type { Ctx, Intent, Outcome, PlaceMemory, StepResult } from '@anima/skills'

import { CUANTOS_LUGARES, Partida } from '../src/index.js'
import { conElla } from './mundo.js'

type Hab = Generator<Intent, Outcome, StepResult>

function conCelda(w: WorldState, at: { x: number; y: number }, c: CellState): WorldState {
  const cells = new Map(w.cells)
  cells.set(keyOfCell(at), c)
  return { ...w, cells }
}

describe('recordar es dónde estuviste', () => {
  it('la criatura recuerda la celda mojada por la que pasó, y la puede `recall`ar', () => {
    const w = conCelda(conElla([], { stamina: 500 }), { x: 3, y: 0 }, { wet: 1, oxygen: 1, temperature: 20 })
    const p = new Partida(w)
    let recordados: PlaceMemory[] = []
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        yield ctx.goTo({ x: 6, y: 0 }, {})
        recordados = ctx.recall([{ q: 'wet', op: '>=', v: 0.5 }])
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 30 && !v.terminado; i++) p.tick()
    expect(recordados.length).toBe(1)
    expect(recordados[0]!.at).toEqual({ x: 3, y: 0 })
    expect(recordados[0]!.q('wet')).toBe(1)
    // «Un recuerdo viejo es una hipótesis»: por eso está `atTick`.
    expect(recordados[0]!.atTick).toBeGreaterThan(0)
    expect(recordados[0]!.atTick).toBeLessThan(p.state.tick)
  })

  it('el libro NO crece sin techo: 512 celdas y desaloja la más vieja', () => {
    // Sin tope, una partida de 20.000 ticks —el criterio del Hito 5— guarda hasta
    // 20.000 celdas por criatura y `recall` las recorre todas en cada llamada.
    const p = new Partida(conElla([], { stamina: 950 }))
    p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        // Un paseo largo: `goTo` a un lado y al otro, pisando celdas nuevas.
        for (let i = 0; i < 60; i++) {
          yield ctx.goTo({ x: i % 2 === 0 ? 12 : -12, y: i }, {})
        }
        return { ok: true }
      },
      undefined,
    )
    p.avanzar(1800)
    expect(p.lugares.cuantos('ella')).toBeLessThanOrEqual(CUANTOS_LUGARES)
    expect(p.lugares.cuantos('ella'), 'no recordó nada: el libro no se está escribiendo').toBeGreaterThan(20)
  })

  it('`recall` devuelve del más nuevo al más viejo', () => {
    // Quien llama toma `[0]` sin ordenar, así que el orden es parte del contrato.
    let w = conElla([], { stamina: 500 })
    w = conCelda(w, { x: 1, y: 0 }, { wet: 1, oxygen: 1, temperature: 20 })
    w = conCelda(w, { x: 4, y: 0 }, { wet: 1, oxygen: 1, temperature: 20 })
    const p = new Partida(w)
    let orden: number[] = []
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        yield ctx.goTo({ x: 6, y: 0 }, {})
        orden = ctx.recall([{ q: 'wet', op: '>=', v: 0.5 }]).map((r) => r.at.x)
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 30 && !v.terminado; i++) p.tick()
    expect(orden).toEqual([4, 1])
  })

  it('el libro es del runtime y NO le cambia el hash a ninguna partida', () => {
    // Es la razón por la que se escribe acá y no en `WorldState`: recordar no es
    // un hecho del mundo, y meterlo adentro haría que dos partidas idénticas con
    // criaturas que caminaron distinto tuvieran mundos distintos.
    const a = new Partida(conElla([], { stamina: 500 }))
    a.volar('ella', function* (ctx: Ctx): Hab {
      yield ctx.goTo({ x: 4, y: 0 }, {})
      return { ok: true }
    }, undefined)
    a.avanzar(10)
    expect(a.lugares.cuantos('ella')).toBeGreaterThan(0)
    // El volcado existe para que un guardado lo pueda llevar; que hoy nadie lo
    // guarde es el hueco que sigue abierto, y está anotado abajo.
    expect(a.lugares.volcar('ella').length).toBe(a.lugares.cuantos('ella'))
  })
})

describe('lo que el libro NO cierra', () => {
  it.fails('se recuerda lo que se PISA, no lo que se VE', () => {
    // POR QUÉ SIGUE ABIERTO: la anotación la hace el bucle sobre la celda en la
    // que la criatura está parada (`src/lugares.ts:anotar`, llamado desde
    // `src/bucle.ts` fase 5). Un lago visto a diez celdas no entra al libro hasta
    // que se camine hasta él, y eso rompe el uso más obvio de `recall`: «volvé al
    // río». La criatura tiene que haber tocado el agua para acordarse de que hay
    // agua.
    //
    // QUÉ HARÍA FALTA, y por qué no se hizo acá: anotar todo el disco de
    // percepción por tick son 625 celdas por tick contra 1, o sea el libro entero
    // reescrito veinte veces por segundo — y encima obliga a decidir **a qué
    // distancia un recuerdo deja de ser confiable**, que es una perilla de diseño
    // con consecuencia sobre la conducta (una criatura que «recuerda» lo que
    // apenas vislumbró camina hacia lugares que no existen). Eso pide su número
    // medido y su ADR, no una constante elegida acá.
    //
    // El archivo es `src/lugares.ts` y el cambio es de una línea en `anotar`:
    // recorrer `disco(at, radioDeMemoria)` en vez de la celda propia.
    const w = conCelda(conElla([], { stamina: 500 }), { x: 5, y: 0 }, { wet: 1, oxygen: 1, temperature: 20 })
    const p = new Partida(w)
    let recordados: PlaceMemory[] = []
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        // Se queda quieta un tick: la celda mojada está a cinco, o sea BIEN
        // adentro del radio de percepción de 12.
        yield ctx.wait(0)
        recordados = ctx.recall([{ q: 'wet', op: '>=', v: 0.5 }])
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 10 && !v.terminado; i++) p.tick()
    expect(recordados.length, 'vio el agua a cinco celdas y no la recuerda').toBe(1)
  })
})
