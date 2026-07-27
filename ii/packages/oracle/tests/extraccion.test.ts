// ─── Los tests de la extracción ──────────────────────────────────────────────
//
// Tres cosas se prueban acá, y las tres son separaciones que, si se borran, no
// dan error sino divergencia:
//
//   1. **el dado es del mundo y se tira UNA vez**: estimar es gratis, sacar
//      cuesta. Si pensar consumiera el dado, dos partidas con la misma semilla y
//      las mismas órdenes divergirían según cuánto dudó la criatura.
//   2. **un intento fallido no toca el stock**: la reposición se integra desde
//      la marca, así que re-anclarla al fallar haría que el río se repusiera más
//      lento cuanto más lo intentaran.
//   3. **ver agua no revela el stock**: un `WaterBody` no tiene por dónde.

import { describe, expect, it } from 'vitest'

import type { Body } from '@anima/physics'
import { buildSeedPhysics, fx, qualityOf, seg, unir } from '@anima/physics'

import type { WaterBody } from '../src/compromiso.js'
import type { MundoConDado } from '../src/extraccion.js'
import { clamp01, draw, probabilidadDePicar, resolverAlPescar } from '../src/extraccion.js'
import type { Stock } from '../src/ley.js'
import { crearStock, population } from '../src/ley.js'
import type { WorldRng } from '../src/pregunta.js'
import { mulberry32 } from '../src/pregunta.js'

const PHYS = buildSeedPhysics()

function cuerpo(id: string, substance: string, form: Body['form'], mass: number): Body {
  return { id, form, parts: [{ substance, mass, q: {} }], joints: [], state: {} }
}

const VARA = cuerpo('vara', 'madera', 'vara', 1)
const HEBRA = cuerpo('hebra', 'liana', 'hebra', 0.3)
/** La caña: vara con una hebra atada de un solo lado. Nadie la llamó caña. */
const CANA = unir(VARA, undefined, HEBRA, PHYS, 'cana')!

/**
 * Un dado del MUNDO de mentira, que devuelve lo que se le dice y cuenta las
 * tiradas. El `as` es el único lugar donde se fabrica un `WorldRng`: cuando el
 * mundo tenga el suyo, el molde es éste, y el `as` vive ahí y en ningún otro
 * lado.
 */
function mundo(valores: readonly number[]): { w: MundoConDado; tiradas: () => number } {
  let i = 0
  const f = ((): number => {
    const v = valores[i % valores.length]!
    i += 1
    return v
  }) as WorldRng
  return { w: { phys: PHYS, rng: f }, tiradas: () => i }
}

function stock(p: Partial<Stock> = {}): Stock {
  return crearStock({
    id: 'pozo',
    yields: 'pescado',
    capacity: 10,
    perMillePorSegundo: 0,
    depth: fx(2),
    atSecond: seg(0),
    amount: 10,
    ...p,
  })
}

describe('el dado es del mundo, y pensar no lo toca', () => {
  it('estimar mil veces no consume ni una tirada', () => {
    const { w, tiradas } = mundo([0])
    for (let i = 0; i < 1000; i++) probabilidadDePicar(stock(), CANA, w.phys, seg(5))
    expect(tiradas()).toBe(0)
  })

  it('sacar consume exactamente una tirada', () => {
    const { w, tiradas } = mundo([0.9])
    draw(w, stock(), CANA, seg(0))
    expect(tiradas()).toBe(1)
  })

  it('con el pozo vacío no se tira: no hay resultado que valga una tirada', () => {
    const { w, tiradas } = mundo([0])
    const r = draw(w, stock({ amount: 0 }), CANA, seg(0))
    expect(r.yields).toBeNull()
    expect(r.tiro).toBe(false)
    expect(tiradas()).toBe(0)
  })

  it('dos mundos gemelos sacan lo mismo', () => {
    const secuencia = (semilla: number): (string | null)[] => {
      const base = mulberry32(semilla)
      const w: MundoConDado = { phys: PHYS, rng: (() => base()) as WorldRng }
      const s = stock({ amount: 10, perMillePorSegundo: 100 })
      const salidas: (string | null)[] = []
      for (let t = 0; t < 50; t++) salidas.push(draw(w, s, CANA, seg(t)).yields)
      return salidas
    }
    expect(secuencia(2024)).toEqual(secuencia(2024))
    // Y con otro dado, otra partida: si no, el dado no estaría haciendo nada.
    expect(secuencia(2024)).not.toEqual(secuencia(7))
  })
})

describe('la probabilidad dice tres cosas', () => {
  it('sin punta suelta no se pesca, aunque se llegue', () => {
    // La vara alcanza de sobra y no engancha nada: `catch` cero, `p` cero. Es la
    // mano pelada del ejemplo, sin que nadie escriba «mano».
    expect(qualityOf(VARA, 'reach', PHYS)).toBeGreaterThanOrEqual(2)
    expect(qualityOf(VARA, 'catch', PHYS)).toBe(0)
    expect(probabilidadDePicar(stock(), VARA, PHYS, seg(0))).toBe(0)
    expect(probabilidadDePicar(stock(), CANA, PHYS, seg(0))).toBeGreaterThan(0)
  })

  it('el pozo vaciándose rinde menos', () => {
    const lleno = probabilidadDePicar(stock({ amount: 10 }), CANA, PHYS, seg(0))
    const medio = probabilidadDePicar(stock({ amount: 5 }), CANA, PHYS, seg(0))
    const vacio = probabilidadDePicar(stock({ amount: 0 }), CANA, PHYS, seg(0))
    expect(medio).toBeLessThan(lleno)
    expect(vacio).toBe(0)
  })

  it('llegar más lejos que la profundidad no ayuda más', () => {
    const alcance = qualityOf(CANA, 'reach', PHYS)
    const justo = probabilidadDePicar(stock({ depth: fx(alcance) }), CANA, PHYS, seg(0))
    const desobra = probabilidadDePicar(stock({ depth: fx(0.1) }), CANA, PHYS, seg(0))
    const corto = probabilidadDePicar(stock({ depth: fx(100) }), CANA, PHYS, seg(0))
    expect(desobra).toBe(justo)
    expect(corto).toBeLessThan(justo)
  })

  it('profundidad cero no produce NaN', () => {
    const p = probabilidadDePicar(stock({ depth: fx(0) }), CANA, PHYS, seg(0))
    expect(Number.isNaN(p)).toBe(false)
    expect(p).toBeGreaterThan(0)
  })

  it('clamp01 manda el NaN a cero, que es el agujero que regalaba comida', () => {
    // Con `p = NaN`, `rng() >= p` es SIEMPRE falso y la extracción tiene éxito
    // siempre: un error que no lanza y que da comida infinita.
    expect(clamp01(Number.NaN)).toBe(0)
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(37)).toBe(1)
    expect(clamp01(0.5)).toBe(0.5)
  })
})

describe('sacar cambia el mundo, no sacar no lo cambia', () => {
  it('cuando pica, sale la sustancia y queda uno menos', () => {
    const { w } = mundo([0])
    const s = stock({ amount: 10 })
    const r = draw(w, s, CANA, seg(12))
    expect(r.yields).toBe('pescado')
    expect(r.tiro).toBe(true)
    expect(s.amount).toBe(9)
    expect(s.atSecond).toBe(seg(12))
  })

  it('cuando no pica, el stock queda exactamente como estaba', () => {
    const { w } = mundo([0.99])
    const s = stock({ amount: 10 })
    const r = draw(w, s, CANA, seg(12))
    expect(r.yields).toBeNull()
    expect(r.tiro).toBe(true)
    expect(s.amount).toBe(10)
    expect(s.atSecond).toBe(seg(0))
  })

  it('intentar y fallar no frena la reposición', () => {
    // La reposición se integra desde la marca. Si un intento fallido la
    // re-anclara —cosa que parece inofensiva, porque la población es la misma en
    // ese instante— el río se repondría más lento cuanto más lo intentaran, y
    // nadie encontraría eso mirando el código de la reposición.
    const s = stock({ amount: 1, capacity: 5, perMillePorSegundo: 300 })
    const { w } = mundo([0.99])
    for (let t = 0; t < 4; t++) expect(draw(w, s, CANA, seg(t)).yields).toBeNull()
    expect(population(s, seg(4))).toBe(2)

    // Y así se vería el bug, para que quede escrito qué se está evitando.
    const rebasado = stock({ amount: 1, capacity: 5, perMillePorSegundo: 300 })
    for (let t = 0; t < 4; t++) {
      rebasado.amount = population(rebasado, seg(t))
      rebasado.atSecond = seg(t)
    }
    expect(population(rebasado, seg(4))).toBe(1)
  })

  it('el tiempo es en SEGUNDOS de mundo, no en ticks (ADR II-0008)', () => {
    // El mismo segundo de mundo repone lo mismo, se lo haya partido en 20 o en
    // 100 muestras. Si esto contara ticks, bajar la frecuencia para que el juego
    // corriera mejor haría que el río rindiera menos.
    const a = stock({ amount: 0, capacity: 5, perMillePorSegundo: 500 })
    expect(population(a, seg(2))).toBe(1)
    const { w } = mundo([0])
    expect(draw(w, a, CANA, seg(2)).yields).toBe('pescado')
    expect(a.amount).toBe(0)
  })
})

describe('ver agua no revela el stock', () => {
  const agua: WaterBody = {
    id: '3,4',
    anchor: { x: 3, y: 4 },
    cells: [
      { x: 3, y: 4 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
    ],
    witnessed: false,
    region: '3,4',
  }

  it('lo que la percepción entrega no tiene por dónde leer una población', () => {
    expect(Object.keys(agua).sort()).toEqual(['anchor', 'cells', 'id', 'region', 'witnessed'])
  })

  it('y no se puede sacar de un cuerpo de agua: lo dice tsc, no un comentario', () => {
    const { w } = mundo([0])
    // @ts-expect-error un `WaterBody` no es un `Stock`: de lejos se ve agua, y
    // cuánto hay adentro es otro hecho, que se decide al meter la mano.
    expect(() => draw(w, agua, CANA, seg(0))).toThrow()
  })

  it('la misma agua, vista igual, puede tener adentro cosas distintas', () => {
    // Dos ríos idénticos a los ojos: uno con pescado y otro vacío. La
    // expectativa es creencia de la criatura, y por eso puede equivocarse — que
    // a veces no haya es lo que hace que la vez que sí hay valga algo.
    const conPescado = resolverAlPescar(agua, () => stock({ id: 'a', amount: 8 }))
    const vacio = resolverAlPescar(agua, () => stock({ id: 'b', amount: 0 }))

    const { w } = mundo([0])
    expect(draw(w, conPescado, CANA, seg(0)).yields).toBe('pescado')
    expect(draw(w, vacio, CANA, seg(0)).yields).toBeNull()
  })

  it('lo que el grano fino comprometa se revisa al entrar', () => {
    // Un stock incoherente tiene que morir en la puerta y no adentro de una
    // probabilidad: con la capacidad rota, `p` sería `NaN` y la extracción
    // tendría éxito siempre.
    expect(() => resolverAlPescar(agua, () => ({ ...stock(), amount: 99 }))).toThrow(/cantidad inválida/)
  })
})
