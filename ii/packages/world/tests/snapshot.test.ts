import { describe, expect, it } from 'vitest'

import { hashWorld } from '../src/hash.js'
import { compact, createSnapshotChain, hashSlots, restoreAt } from '../src/snapshot.js'
import type { SnapshotDelta } from '../src/snapshot.js'

/**
 * Los tests de `snapshot.ts`.
 *
 * El que más importa no es ninguno de los de corrección: es
 * «el delta no crece con la partida». Ésa es la afirmación entera del snapshot
 * por delta contra el `structuredClone` de Ánima I —«un impuesto que crece con
 * la partida»— y si no se mide, es marketing.
 */

interface Bicho {
  readonly calor: number
}

function mundo(pares: readonly (readonly [string, number])[]): Map<string, Bicho> {
  return new Map(pares.map(([k, calor]) => [k, { calor }]))
}

describe('snapshot — la base y los deltas', () => {
  it('el primer eslabón trae todo y no borra nada', () => {
    const c = createSnapshotChain<Bicho>()
    const d = c.take(0, mundo([['a', 1], ['b', 2]]))
    expect(d.index).toBe(0)
    expect(d.set.length).toBe(2)
    expect(d.del).toEqual([])
  })

  it('el segundo trae SOLO lo que cambió', () => {
    const c = createSnapshotChain<Bicho>()
    c.take(0, mundo([['a', 1], ['b', 2], ['c', 3]]))
    const d = c.take(10, mundo([['a', 1], ['b', 99], ['c', 3]]))
    expect(d.set.map(([k]) => k)).toEqual(['b'])
    expect(d.del).toEqual([])
  })

  it('lo que desaparece se anota como borrado', () => {
    const c = createSnapshotChain<Bicho>()
    c.take(0, mundo([['a', 1], ['b', 2]]))
    const d = c.take(1, mundo([['a', 1]]))
    expect(d.set).toEqual([])
    expect(d.del).toEqual(['b'])
  })

  it('claves y borrados salen ORDENADOS, no en orden de inserción', () => {
    // El delta se guarda en disco: si el orden dependiera del orden de
    // inserción del `Map`, dos partidas idénticas producirían archivos distintos
    // y el diff entre dos guardados dejaría de ser legible.
    const c = createSnapshotChain<Bicho>()
    c.take(0, mundo([['zeta', 1], ['alfa', 1], ['medio', 1]]))
    const d = c.take(1, mundo([['zeta', 2], ['alfa', 2], ['medio', 2]]))
    expect(d.set.map(([k]) => k)).toEqual(['alfa', 'medio', 'zeta'])

    const e = c.take(2, mundo([]))
    expect(e.del).toEqual(['alfa', 'medio', 'zeta'])
  })

  it('el hash del delta es el del estado completo, no el del delta', () => {
    const c = createSnapshotChain<Bicho>()
    c.take(0, mundo([['a', 1], ['b', 2]]))
    const m = mundo([['a', 1], ['b', 3]])
    const d = c.take(1, m)
    expect(d.hash).toBe(hashSlots(m))
    expect(d.hash).toBe(hashWorld(m))
  })
})

describe('snapshot — restaurar', () => {
  it('restaurar cualquier eslabón da el estado de ese momento', () => {
    const c = createSnapshotChain<Bicho>()
    const estados = [
      mundo([['a', 1]]),
      mundo([['a', 2], ['b', 1]]),
      mundo([['b', 1], ['c', 7]]),
      mundo([['b', 1], ['c', 7], ['d', 0]]),
    ]
    estados.forEach((m, i) => c.take(i, m))
    for (let i = 0; i < estados.length; i++) {
      expect(hashSlots(restoreAt(c.deltas, i))).toBe(hashSlots(estados[i]!))
    }
    expect(hashSlots(c.restore())).toBe(hashSlots(estados[3]!))
  })

  it('restaurar VERIFICA el hash y una cadena corrupta lanza', () => {
    // Sin esta verificación, un eslabón corrupto produce un mundo coherente y
    // falso, y la partida diverge 3000 ticks más tarde sin causa visible.
    const c = createSnapshotChain<Bicho>()
    c.take(0, mundo([['a', 1]]))
    c.take(1, mundo([['a', 2]]))
    const rotos = c.deltas.map((d) => ({ ...d }))
    rotos[1] = { ...rotos[1]!, set: [['a', { calor: 999 }]] }
    expect(() => restoreAt(rotos as SnapshotDelta<Bicho>[], 1)).toThrow(/corrupto/)
  })

  it('una cadena desordenada lanza antes de aplicar nada', () => {
    const c = createSnapshotChain<Bicho>()
    c.take(0, mundo([['a', 1]]))
    c.take(1, mundo([['a', 2]]))
    const alReves = [c.deltas[1]!, c.deltas[0]!]
    expect(() => restoreAt(alReves, 1)).toThrow(/desordenada/)
  })

  it('una cadena vacía o un eslabón que no existe lanzan', () => {
    expect(() => restoreAt([], 0)).toThrow(/vacía/)
    const c = createSnapshotChain<Bicho>()
    c.take(0, mundo([['a', 1]]))
    expect(() => restoreAt(c.deltas, 5)).toThrow(/fuera de la cadena/)
  })

  it('un delta que llegó de un archivo restaura igual', () => {
    // `restoreAt` es pura a propósito: quien guarda es el worker de fondo y
    // quien restaura suele ser otro proceso, otra pestaña o el juez.
    const c = createSnapshotChain<Bicho>()
    c.take(0, mundo([['a', 1], ['b', 2]]))
    c.take(1, mundo([['a', 5]]))
    const viaje = JSON.parse(JSON.stringify(c.deltas)) as SnapshotDelta<Bicho>[]
    expect(hashSlots(restoreAt(viaje, 1))).toBe(c.deltas[1]!.hash)
  })
})

describe('snapshot — comparar por hash o por identidad', () => {
  it('el default NO se pierde una mutación en el lugar', () => {
    // Éste es el test que decide el default. Un mundo que muta un cuerpo sin
    // reemplazarlo es un bug, pero es un bug que existe; con `'identidad'`, el
    // guardado lo pierde EN SILENCIO y el jugador se entera cuando carga.
    const bicho = { calor: 1 }
    const m = new Map([['a', bicho]])
    const c = createSnapshotChain<{ calor: number }>()
    c.take(0, m)
    ;(bicho as { calor: number }).calor = 2
    const d = c.take(1, m)
    expect(d.set.map(([k]) => k)).toEqual(['a'])
    expect(restoreAt(c.deltas, 1).get('a')).toEqual({ calor: 2 })
  })

  it("con 'identidad' esa misma mutación se pierde, y por eso no es el default", () => {
    const bicho = { calor: 1 }
    const m = new Map([['a', bicho]])
    const c = createSnapshotChain<{ calor: number }>({ compare: 'identidad' })
    c.take(0, m)
    bicho.calor = 2
    const d = c.take(1, m)
    expect(d.set).toEqual([]) // no vio nada
  })

  it('mutar una ranura ya guardada REESCRIBE el pasado, y el hash lo denuncia', () => {
    // El delta se queda con la referencia, no con una copia —copiar sería el
    // `structuredClone` que este archivo existe para no pagar—, así que mutar
    // una ranura vieja cambia lo que dice el snapshot que ya se tomó. No es
    // hipotético: apareció escribiendo el test de arriba.
    //
    // Contra eso no protege ningún modo de comparación: protege que el mundo sea
    // de copia-al-escribir. Lo que sí hace el hash guardado es que se caiga acá,
    // fuerte y con el número del eslabón, en vez de dentro de tres mil ticks.
    const bicho = { calor: 1 }
    const c = createSnapshotChain<{ calor: number }>()
    c.take(0, new Map([['a', bicho]]))
    bicho.calor = 2
    expect(() => restoreAt(c.deltas, 0)).toThrow(/corrupto/)
  })

  it("con 'identidad' y copia al escribir, el resultado es el mismo que con hash", () => {
    const paso = (m: Map<string, Bicho>): Map<string, Bicho> => {
      const out = new Map(m)
      out.set('b', { calor: (m.get('b') as Bicho).calor + 1 }) // se REEMPLAZA
      return out
    }
    const porHash = createSnapshotChain<Bicho>()
    const porId = createSnapshotChain<Bicho>({ compare: 'identidad' })
    let m = mundo([['a', 1], ['b', 1], ['c', 1]])
    for (let t = 0; t < 5; t++) {
      porHash.take(t, m)
      porId.take(t, m)
      m = paso(m)
    }
    expect(porId.deltas.map((d) => d.hash)).toEqual(porHash.deltas.map((d) => d.hash))
    expect(porId.deltas[4]!.set.map(([k]) => k)).toEqual(['b'])
  })
})

describe('snapshot — el impuesto que NO crece con la partida', () => {
  it('el mundo crece 200 veces y el delta se queda quieto', () => {
    // La afirmación entera del snapshot por delta, medida. Con
    // `structuredClone` el costo de guardar sería proporcional al tamaño del
    // mundo —que crece toda la partida— y no a lo que cambió, que no crece.
    const c = createSnapshotChain<Bicho>()
    const m = new Map<string, Bicho>()
    const tamanos: number[] = []
    for (let t = 0; t < 200; t++) {
      m.set(`b:${t}`, { calor: t }) // nace uno
      m.set('b:0', { calor: t }) // y uno cambia
      const d = c.take(t, m)
      tamanos.push(d.set.length + d.del.length)
    }
    expect(m.size).toBe(200)
    expect(tamanos[0]).toBe(1) // la base, con el mundo de un solo bicho
    // De ahí en más, siempre dos: el que nació y el que cambió. Que el último
    // delta pese lo mismo que el segundo, con el mundo cien veces más grande, es
    // el punto entero.
    const resto = tamanos.slice(2)
    expect(Math.max(...resto)).toBe(2)
    expect(Math.min(...resto)).toBe(2)
    expect(hashSlots(c.restore())).toBe(hashSlots(m))
  })
})

describe('snapshot — aplastar', () => {
  it('la cadena aplastada da exactamente el mismo estado', () => {
    const c = createSnapshotChain<Bicho>()
    c.take(0, mundo([['a', 1], ['b', 2]]))
    c.take(1, mundo([['a', 9], ['c', 3]]))
    c.take(2, mundo([['a', 9], ['c', 4], ['d', 0]]))

    const base = compact(c.deltas)
    expect(base.index).toBe(0)
    expect(base.del).toEqual([])
    expect(base.tick).toBe(2)
    expect(hashSlots(restoreAt([base], 0))).toBe(c.deltas[2]!.hash)
  })

  it('aplastar hasta la mitad da el estado de la mitad, y se le puede seguir la cadena', () => {
    const c = createSnapshotChain<Bicho>()
    c.take(0, mundo([['a', 1]]))
    c.take(1, mundo([['a', 2], ['b', 1]]))
    c.take(2, mundo([['b', 1]]))

    const base = compact(c.deltas, 1)
    const seguida = [base, { ...c.deltas[2]!, index: 1 }]
    expect(hashSlots(restoreAt(seguida, 1))).toBe(c.deltas[2]!.hash)
  })
})
