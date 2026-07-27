// Lo que este archivo cuida es la mitad del determinismo que no se ve correr: la
// forma de una intención, quién decide su compromiso, y que el orden entre dos
// intenciones sea TOTAL — o sea que nunca haya que preguntarle a la estabilidad
// del `sort` del motor quién va primero.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, SEED_PROCESSES } from '@anima/physics'
import type { Intent } from '../src/intent.js'
import { CELL_LIMIT, inWorld, keyOfCell } from '../src/cell.js'
import {
  apply,
  chebyshev,
  commitmentOf,
  compararIntenciones,
  compararTexto,
  COMMITMENT_OF,
  drop,
  eat,
  enRango,
  explore,
  goTo,
  ordenarIntenciones,
  ordenarRoles,
  permite,
  place,
  put,
  revisarCompromiso,
  take,
  wait,
  WORLD_MAX,
  WORLD_MIN,
} from '../src/intent.js'

const phys = buildSeedPhysics()
const quien = { by: 'ana', seq: 0 }

describe('la clave de celda', () => {
  it('es inyectiva sobre el mundo entero', () => {
    const vistos = new Set<number>()
    for (const x of [WORLD_MIN, -1, 0, 1, 999, WORLD_MAX]) {
      for (const y of [WORLD_MIN, -1, 0, 1, 999, WORLD_MAX]) {
        const k = keyOfCell({ x, y })
        expect(Number.isSafeInteger(k)).toBe(true)
        expect(vistos.has(k)).toBe(false)
        vistos.add(k)
      }
    }
  })

  it('el límite del mundo es UNO SOLO: `enRango` e `inWorld` no pueden discrepar', () => {
    // Los dos números se escribieron por separado y coincidían por casualidad.
    // Ahora `WORLD_MIN`/`WORLD_MAX` se derivan de `CELL_LIMIT`, y este test es el
    // que se pondría rojo si alguien volviera a escribir el límite a mano.
    expect(WORLD_MIN).toBe(-CELL_LIMIT)
    expect(WORLD_MAX).toBe(CELL_LIMIT - 1)
    for (const v of [WORLD_MIN - 1, WORLD_MIN, -1, 0, WORLD_MAX, WORLD_MAX + 1, 0.5, NaN]) {
      expect(enRango({ x: v, y: 0 })).toBe(inWorld(v, 0))
    }
    // Y el que está afuera no tiene clave: `keyOfCell` lanza en vez de recortar,
    // porque recortar teletransporta al borde y nadie se entera.
    expect(() => keyOfCell({ x: WORLD_MAX + 1, y: 0 })).toThrow(RangeError)
  })

  it('rechaza lo que no es una celda', () => {
    expect(enRango({ x: 0, y: 0 })).toBe(true)
    expect(enRango({ x: 0.5, y: 0 })).toBe(false)
    expect(enRango({ x: NaN, y: 0 })).toBe(false)
    expect(enRango({ x: WORLD_MAX + 1, y: 0 })).toBe(false)
  })

  it('la distancia es de Chebyshev: la diagonal cuesta un paso', () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3)
    expect(chebyshev({ x: 0, y: 0 }, { x: -3, y: 1 })).toBe(3)
  })
})

describe('el compromiso lo declara el mundo', () => {
  it('la tabla cubre todas las intenciones menos `apply`', () => {
    // `apply` no está a propósito: su compromiso lo declara el PROCESO, y una
    // segunda copia acá sería el bug de `DSL_REFERENCE` de Ánima I.
    expect(Object.keys(COMMITMENT_OF).sort()).toEqual(
      ['drop', 'eat', 'explore', 'goTo', 'place', 'put', 'take', 'wait'].sort(),
    )
  })

  it('los constructores ponen el compromiso que el mundo va a recalcular', () => {
    const todas: Intent[] = [
      wait(quien, 1),
      goTo(quien, { x: 1, y: 1 }),
      explore(quien, 5),
      take(quien, 'c'),
      drop(quien, 'c'),
      put(quien, 'c', { x: 0, y: 0 }),
      eat(quien, 'c'),
      place(quien, 'choza', { x: 0, y: 0 }),
    ]
    for (const i of todas) expect(commitmentOf(i, phys)).toBe(i.commitment)
  })

  it('comer es irreversible y caminar no', () => {
    expect(commitmentOf(eat(quien, 'c'), phys)).toBe('irreversible')
    expect(commitmentOf(goTo(quien, { x: 1, y: 0 }), phys)).toBe('reversible')
  })

  it('el de `apply` sale del catálogo y de ningún otro lado', () => {
    for (const p of SEED_PROCESSES) {
      const i = apply(quien, phys, p.id, [])
      expect(i?.commitment).toBe(p.commitment)
    }
  })

  it('un proceso que no existe no tiene compromiso, y eso no es cero', () => {
    // Devolver el grado más suave abriría la puerta a ejecutar cualquier cosa con
    // un id inventado; devolver el más duro haría que «no existe» se lea como
    // «no tenés permiso». Es `undefined`, y el que llama decide.
    const i: Intent = {
      k: 'apply',
      by: 'ana',
      seq: 0,
      commitment: 'reversible',
      process: 'inventado',
      roles: [],
    }
    expect(commitmentOf(i, phys)).toBeUndefined()
    expect(revisarCompromiso(i, phys, 'irreversible')?.k).toBe('proceso-desconocido')
  })

  it('el portón pregunta en orden: qué es, si mintió, y recién ahí si puede', () => {
    const mentira = { ...eat(quien, 'c'), commitment: 'reversible' } as Intent
    // Con permiso total igual se rechaza: primero se verifica la declaración.
    expect(revisarCompromiso(mentira, phys, 'irreversible')?.k).toBe('mal-declarado')
    // Y con la declaración correcta, lo que falla es el permiso.
    expect(revisarCompromiso(eat(quien, 'c'), phys, 'reversible')?.k).toBe('sin-permiso')
    expect(revisarCompromiso(eat(quien, 'c'), phys, 'irreversible')).toBeUndefined()
  })

  it('los tres grados están ordenados y el portón los respeta', () => {
    expect(permite('reversible', 'reversible')).toBe(true)
    expect(permite('reversible', 'costly')).toBe(false)
    expect(permite('costly', 'reversible')).toBe(true)
    expect(permite('costly', 'irreversible')).toBe(false)
    expect(permite('irreversible', 'irreversible')).toBe(true)
  })
})

describe('los roles son un array y no un objeto', () => {
  it('se ordenan por nombre, para que no dependa de cómo los armó quien llama', () => {
    // El orden de `Object.keys` depende de cómo se construyó el objeto —las
    // claves que parecen enteros saltan al principio—, así que dos habilidades
    // que arman el mismo juego de roles en distinto orden recorrerían distinto.
    const uno = ordenarRoles([
      { name: 'source', body: 'x' },
      { name: 'actor', body: 'y' },
    ])
    const otro = ordenarRoles([
      { name: 'actor', body: 'y' },
      { name: 'source', body: 'x' },
    ])
    expect(uno).toEqual(otro)
    expect(uno.map((r) => r.name)).toEqual(['actor', 'source'])
  })

  it('`apply` los normaliza al construirse', () => {
    const i = apply(quien, phys, 'deshilachar', [
      { name: 'source', body: 'x' },
      { name: 'actor', body: 'y' },
    ])
    expect(i?.k === 'apply' ? i.roles.map((r) => r.name) : []).toEqual(['actor', 'source'])
  })
})

describe('el orden total', () => {
  it('primero por actor y después por número de emisión', () => {
    const a = wait({ by: 'ana', seq: 5 }, 1)
    const b = wait({ by: 'ana', seq: 2 }, 1)
    const c = wait({ by: 'beto', seq: 0 }, 1)
    expect(ordenarIntenciones([c, a, b]).map((i) => `${i.by}/${i.seq}`)).toEqual([
      'ana/2',
      'ana/5',
      'beto/0',
    ])
  })

  it('la comparación es antisimétrica y transitiva', () => {
    const is = [
      wait({ by: 'ana', seq: 1 }, 1),
      wait({ by: 'ana', seq: 2 }, 1),
      wait({ by: 'beto', seq: 0 }, 1),
      wait({ by: 'Beto', seq: 0 }, 1),
    ]
    const signo = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0)
    for (const x of is) {
      for (const y of is) {
        expect(signo(compararIntenciones(x, y)) + signo(compararIntenciones(y, x))).toBe(0)
      }
    }
    // Y total: entre dos intenciones distintas nunca hay empate, así que la
    // estabilidad del `sort` del motor no decide nada.
    for (const x of is) {
      for (const y of is) {
        if (x === y) continue
        expect(compararIntenciones(x, y)).not.toBe(0)
      }
    }
  })

  it('el texto se compara por unidad de código y no por locale', () => {
    // `localeCompare` depende del ICU del motor: dos navegadores ordenarían
    // distinto y el replay divergiría. `'Z' < 'a'` por unidad de código, y eso
    // tiene que valer igual en todos lados.
    expect(compararTexto('Z', 'a')).toBe(-1)
    expect(compararTexto('a', 'a')).toBe(0)
    expect(compararTexto('ñ', 'z')).toBe(1)
  })

  it('ordenar no toca el arreglo que le dan', () => {
    const is = [wait({ by: 'beto', seq: 0 }, 1), wait({ by: 'ana', seq: 0 }, 1)]
    const copia = [...is]
    ordenarIntenciones(is)
    expect(is).toEqual(copia)
  })
})

describe('los campos opcionales no viajan como `undefined`', () => {
  it('`put` sin apoyo ni tapa no trae las claves', () => {
    // `exactOptionalPropertyTypes` distingue ausente de presente-y-undefined, y
    // un `covering: undefined` explícito viajaría al hash como una clave más.
    const i = put(quien, 'c', { x: 0, y: 0 })
    expect(Object.keys(i).includes('covering')).toBe(false)
    expect(Object.keys(i).includes('onTopOf')).toBe(false)
  })

  it('y con los dos, trae los dos', () => {
    const i = put(quien, 'c', { x: 0, y: 0 }, { onTopOf: 'a', covering: 'b' })
    expect(i.k === 'put' ? [i.onTopOf, i.covering] : []).toEqual(['a', 'b'])
  })
})
