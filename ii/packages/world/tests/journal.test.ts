import { describe, expect, it } from 'vitest'

import { hashWorld } from '../src/hash.js'
import { createJournal, journalFromData, replay } from '../src/journal.js'
import type { JournalData } from '../src/journal.js'
import { createSnapshotChain } from '../src/snapshot.js'
import type { Bicho, Intencion, Mundo } from './mundo-de-juguete.js'
import { mundoInicial, paso } from './mundo-de-juguete.js'

const calentar = (id: string, cuanto = 10): Intencion => ({ k: 'calentar', id, cuanto })

describe('journal — append-only', () => {
  it('escribe en orden y numera el `seq` dentro de cada tick', () => {
    const j = createJournal<Intencion>()
    j.append(0, calentar('1'))
    j.append(0, calentar('2'))
    j.append(3, calentar('3'))
    expect(j.entries().map((e) => [e.tick, e.seq])).toEqual([
      [0, 0],
      [0, 1],
      [3, 0],
    ])
    expect(j.length).toBe(3)
    expect(j.lastTick).toBe(3)
  })

  it('un tick hacia atrás se rechaza', () => {
    // Es lo que hace que «reproducir la partida desde el principio» sea verdad y
    // no una intención: a un journal donde se puede meter algo en el medio no se
    // le puede pedir que reproduzca nada.
    const j = createJournal<Intencion>()
    j.append(5, calentar('1'))
    expect(() => j.append(4, calentar('1'))).toThrow(/append-only/)
    expect(() => j.append(-1, calentar('1'))).toThrow(/inválido/)
    expect(() => j.append(1.5, calentar('1'))).toThrow(/inválido/)
    expect(j.length).toBe(1)
  })

  it('una intención que no se puede hashear se rechaza EN EL MOMENTO', () => {
    // El efecto de segundo orden de la cadena, y es el que más vale: una
    // intención con una función adentro no es reproducible, y eso se descubre en
    // el tick en que se emitió y no tres semanas después, cuando alguien intenta
    // cargar la partida.
    const j = createJournal<unknown>()
    expect(() => j.append(0, { k: 'raro', f: () => 1 })).toThrow(/function/)
    expect(() => j.append(0, { k: 'raro', cuando: new Date(0) })).toThrow(/solo entran/)
    expect(j.length).toBe(0)
  })

  it('`at` y `since` encuentran lo de cada tick, incluso los vacíos', () => {
    const j = createJournal<Intencion>()
    j.append(1, calentar('a'))
    j.append(1, calentar('b'))
    j.append(4, calentar('c'))
    expect(j.at(1).map((e) => e.seq)).toEqual([0, 1])
    expect(j.at(2)).toEqual([]) // un tick sin intenciones existe igual
    expect(j.at(4).length).toBe(1)
    expect(j.since(2).length).toBe(1)
    expect(j.since(0).length).toBe(3)
    expect(j.since(99)).toEqual([])
  })
})

describe('journal — la cadena de hashes', () => {
  it('la cadena avanza con cada entrada y dos journals iguales dan lo mismo', () => {
    const a = createJournal<Intencion>()
    const b = createJournal<Intencion>()
    const antes = a.chain
    a.append(0, calentar('1'))
    expect(a.chain).not.toBe(antes)
    b.append(0, calentar('1'))
    expect(b.chain).toBe(a.chain)
  })

  it('cambiar una intención vieja cambia la cadena', () => {
    const a = createJournal<Intencion>()
    const b = createJournal<Intencion>()
    for (const j of [a, b]) {
      j.append(0, calentar('1'))
      j.append(1, calentar('2'))
    }
    expect(a.chain).toBe(b.chain)

    const c = createJournal<Intencion>()
    c.append(0, calentar('1', 11)) // uno distinto, al principio
    c.append(1, calentar('2'))
    expect(c.chain).not.toBe(a.chain)
  })

  it('la misma intención en otro tick es otra partida', () => {
    const a = createJournal<Intencion>()
    a.append(0, calentar('1'))
    const b = createJournal<Intencion>()
    b.append(1, calentar('1'))
    expect(a.chain).not.toBe(b.chain)
  })
})

describe('journal — guardar y cargar', () => {
  it('ida y vuelta por JSON', () => {
    const j = createJournal<Intencion>()
    j.append(0, calentar('1'))
    j.append(2, { k: 'nacer', id: '9' })
    j.append(2, { k: 'morir', id: '1' })
    const viaje = JSON.parse(JSON.stringify(j.toData())) as JournalData<Intencion>
    const vuelto = journalFromData(viaje)
    expect(vuelto.chain).toBe(j.chain)
    expect(vuelto.entries()).toEqual(j.entries())
    // Y se le puede seguir escribiendo, con el `seq` retomado donde estaba.
    expect(vuelto.append(2, calentar('9')).seq).toBe(2)
  })

  it('un journal manoseado no carga', () => {
    const j = createJournal<Intencion>()
    j.append(0, calentar('1'))
    j.append(1, calentar('2'))
    const data = JSON.parse(JSON.stringify(j.toData())) as JournalData<Intencion>

    const roto = { ...data, entries: [{ ...data.entries[0]!, intent: calentar('1', 999) }, data.entries[1]!] }
    expect(() => journalFromData(roto)).toThrow(/corrupto/)

    const desordenado = { ...data, entries: [data.entries[1]!, data.entries[0]!] }
    expect(() => journalFromData(desordenado)).toThrow(/después del|seq/)

    expect(() => journalFromData({ ...data, version: 2 as unknown as 1 })).toThrow(/versión/)
    expect(() => journalFromData({ ...data, chain: 'no-es-un-hash' })).toThrow(/largo|inválido/)
  })
})

describe('replay', () => {
  function partida(ticks: number): { j: ReturnType<typeof createJournal<Intencion>>; fin: Mundo; inicial: Mundo } {
    const inicial = mundoInicial(12)
    const j = createJournal<Intencion>()
    let m = inicial
    for (let t = 0; t < ticks; t++) {
      const intents: Intencion[] = []
      // Intenciones cada tres ticks: los dos tercios restantes son ticks vacíos,
      // que es donde vive el bug que este test busca.
      if (t % 3 === 0) {
        const i = calentar(`${t % 12}`, 30)
        j.append(t, i)
        intents.push(i)
      }
      m = paso(m, intents, t)
    }
    return { j, fin: m, inicial }
  }

  it('reproducir desde el principio da el mismo mundo', () => {
    const { j, fin, inicial } = partida(50)
    // `hasta: 49` explícito: la partida corrió 50 ticks y el último con una
    // intención fue el 48. El default de `hasta` es lo último que el journal
    // SABE, que no es lo mismo que lo último que pasó — ver el test de abajo.
    const rehecho = replay(j, { tick: 0, state: inicial }, paso, { hasta: 49 })
    expect(hashWorld(rehecho)).toBe(hashWorld(fin))
  })

  it('el default de `hasta` es el último tick CON intención, y hay que saberlo', () => {
    // Apareció como un test rojo y se deja escrito, porque es un error de uno de
    // esos que no se ven: si la partida siguió corriendo después de la última
    // intención, el journal no tiene cómo enterarse y el replay termina antes.
    //
    // En el mundo de verdad no muerde —el documento de arquitectura dice que la
    // cola «siempre tiene algo» y que «nunca hay un tick sin intención»—, pero un
    // journal filtrado o cortado sí, y ahí la diferencia es un mundo con menos
    // física corrida y un hash distinto sin causa visible.
    const { j, fin, inicial } = partida(50)
    expect(j.lastTick).toBe(48)
    const corto = replay(j, { tick: 0, state: inicial }, paso)
    expect(hashWorld(corto)).not.toBe(hashWorld(fin))
    expect(hashWorld(replay(j, { tick: 0, state: inicial }, paso, { hasta: 49 }))).toBe(hashWorld(fin))
  })

  it('corre TODOS los ticks, no solo los que tienen intenciones', () => {
    // El bug que mata al replay ingenuo. La física corre sola: el bicho se
    // enfría y se seca sin que nadie quiera nada. Un replay que saltara del tick
    // 3 al 6 porque en el medio no hubo intenciones produciría un mundo
    // COHERENTE y equivocado, que es peor que uno roto porque no se nota.
    const vistos: number[] = []
    const espia = (m: Mundo, i: readonly Intencion[], t: number): Mundo => {
      vistos.push(t)
      return paso(m, i, t)
    }
    const j = createJournal<Intencion>()
    j.append(0, calentar('1'))
    j.append(7, calentar('1'))
    replay(j, { tick: 0, state: mundoInicial(3) }, espia)
    expect(vistos).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('el orden dentro de un tick se respeta', () => {
    const orden: number[] = []
    const espia = (m: Mundo, i: readonly Intencion[]): Mundo => {
      for (const x of i) orden.push((x as { cuanto: number }).cuanto)
      return m
    }
    const j = createJournal<Intencion>()
    j.append(4, calentar('1', 1))
    j.append(4, calentar('1', 2))
    j.append(4, calentar('1', 3))
    replay(j, { tick: 4, state: mundoInicial(2) }, espia)
    expect(orden).toEqual([1, 2, 3])
  })

  it('restaurar a mitad y seguir da el final EXACTO', () => {
    // El criterio del Hito 2, en chico. La versión con 10⁵ intenciones está en
    // `cronica-el-criterio.test.ts`.
    const inicial = mundoInicial(12)
    const j = createJournal<Intencion>()
    const snaps = createSnapshotChain<Bicho>()
    let m = inicial
    let mitad: { tick: number; index: number } | null = null
    for (let t = 0; t < 60; t++) {
      if (t === 30) {
        const d = snaps.take(t, m)
        mitad = { tick: t, index: d.index }
      }
      const intents: Intencion[] = []
      if (t % 4 === 0) {
        const i = calentar(`${t % 12}`, 25)
        j.append(t, i)
        intents.push(i)
      }
      m = paso(m, intents, t)
    }
    const restaurado = snaps.restore(mitad!.index)
    const desdeMitad = replay(j, { tick: mitad!.tick, state: restaurado }, paso, { hasta: 59 })
    expect(hashWorld(desdeMitad)).toBe(hashWorld(m))
  })

  it('los checkpoints cortan en el PRIMER tick que no da', () => {
    // Sin esto, una divergencia se manifiesta como «los hashes finales no
    // coinciden» y hay que bisecar veinte mil ticks a mano.
    const inicial = mundoInicial(6)
    const j = createJournal<Intencion>()
    for (let t = 0; t < 20; t += 5) j.append(t, calentar(`${t % 6}`, 40))

    const checkpoints = new Map<number, ReturnType<typeof hashWorld>>()
    let m = inicial
    for (let t = 0; t <= 20; t++) {
      checkpoints.set(t, hashWorld(m))
      m = paso(
        m,
        j.at(t).map((e) => e.intent),
        t,
      )
    }

    // Con el motor bueno, pasa entero.
    expect(() =>
      replay(j, { tick: 0, state: inicial }, paso, { hasta: 19, checkpoints, hashOf: hashWorld }),
    ).not.toThrow()

    // Con un motor que se desvía en el tick 12, corta al comienzo del 13.
    const torcido = (s: Mundo, i: readonly Intencion[], t: number): Mundo => {
      const out = paso(s, i, t)
      if (t === 12) out.set('b:0', { id: '0', calor: 12345, agua: 0 })
      return out
    }
    expect(() => replay(j, { tick: 0, state: inicial }, torcido, { hasta: 19, checkpoints, hashOf: hashWorld })).toThrow(
      /divergió al comienzo del tick 13/,
    )
  })

  it('los bordes', () => {
    const inicial = mundoInicial(3)
    const j = createJournal<Intencion>()
    j.append(5, calentar('1'))

    // Un journal vacío no mueve nada.
    expect(hashWorld(replay(createJournal<Intencion>(), { tick: 0, state: inicial }, paso))).toBe(hashWorld(inicial))

    // Hacia atrás no se reproduce.
    expect(() => replay(j, { tick: 10, state: inicial }, paso, { hasta: 3 })).toThrow(/hacia atrás/)
    expect(() => replay(j, { tick: -1, state: inicial }, paso)).toThrow(/inválido/)

    // Checkpoints sin con qué compararlos.
    expect(() => replay(j, { tick: 0, state: inicial }, paso, { checkpoints: new Map() })).toThrow(/hashOf/)

    // `hasta` más allá del último tick del journal corre ticks vacíos, que es
    // exactamente lo que hace falta para «seguí corriendo el mundo 100 ticks».
    const vistos: number[] = []
    replay(j, { tick: 5, state: inicial }, (m, i, t) => {
      vistos.push(t)
      return paso(m, i, t)
    }, { hasta: 9 })
    expect(vistos).toEqual([5, 6, 7, 8, 9])

    // Y un arreglo pelado de entradas sirve igual que el journal.
    expect(hashWorld(replay(j.entries(), { tick: 0, state: inicial }, paso))).toBe(
      hashWorld(replay(j, { tick: 0, state: inicial }, paso)),
    )
  })
})
