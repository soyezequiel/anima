import { describe, expect, it } from 'vitest'

import { HASH_VACIO, hashWorld, worldHashFromHex } from '../src/hash.js'

/**
 * Los tests de `hash.ts`. Cuatro clases, y las cuatro hacen falta:
 *
 *   1. LO QUE NO PUEDE CAMBIAR EL HASH — orden de inserción, orden de un `Map`,
 *      orden de un `Set`, `-0`, una propiedad `undefined`, un viaje por JSON.
 *      Cada uno de éstos, si fallara, produciría una divergencia FALSA: dos
 *      mundos iguales declarados distintos, y el juez rechazando partidas
 *      correctas.
 *   2. LO QUE SÍ TIENE QUE CAMBIARLO — un valor, un tipo, un largo, una clase de
 *      arreglo tipado. Si fallara, produciría una divergencia INVISIBLE, que es
 *      el error caro: dos mundos distintos declarados iguales.
 *   3. LO QUE TIENE QUE LANZAR — lo que no tiene representación canónica. Un
 *      hash que se traga lo que no entiende es una fuente de falsos «son
 *      iguales».
 *   4. LA HUELLA — una constante escrita a mano. Es la única forma de saber que
 *      el algoritmo no cambió sin que nadie lo dijera, y es la misma prueba que
 *      tendría que dar Chrome, Firefox y Node para que el criterio del Hito 2
 *      («el mismo hash en dos motores») quiera decir algo.
 */

describe('hash — lo que NO puede cambiarlo', () => {
  it('el mismo valor da el mismo hash dos veces', () => {
    const v = { a: 1, b: [1, 2, 3], c: { d: 'x' } }
    expect(hashWorld(v)).toBe(hashWorld(v))
    expect(hashWorld(v)).toBe(hashWorld({ a: 1, b: [1, 2, 3], c: { d: 'x' } }))
  })

  it('el orden de inserción de las claves no cambia nada', () => {
    const a: Record<string, number> = {}
    a['zeta'] = 1
    a['alfa'] = 2
    a['medio'] = 3
    const b: Record<string, number> = {}
    b['medio'] = 3
    b['alfa'] = 2
    b['zeta'] = 1
    expect(hashWorld(a)).toBe(hashWorld(b))
  })

  it('las claves que parecen enteros tampoco', () => {
    // `Object.keys` saca «2» y «10» ADELANTE y en orden numérico, sin importar
    // cuándo se insertaron. O sea que el orden de inserción ni siquiera es
    // consistente consigo mismo, y por eso hay que ordenar siempre.
    const a: Record<string, number> = {}
    a['x'] = 1
    a['10'] = 2
    a['2'] = 3
    const b: Record<string, number> = {}
    b['2'] = 3
    b['x'] = 1
    b['10'] = 2
    expect(hashWorld(a)).toBe(hashWorld(b))
  })

  it('el orden de un Map de claves de texto no cambia nada', () => {
    const a = new Map([
      ['b17', { calor: 3 }],
      ['b2', { calor: 9 }],
    ])
    const b = new Map([
      ['b2', { calor: 9 }],
      ['b17', { calor: 3 }],
    ])
    expect(hashWorld(a)).toBe(hashWorld(b))
  })

  it('el orden de un Map de claves que no son texto tampoco', () => {
    const a = new Map<number, string>([
      [7, 'siete'],
      [1, 'uno'],
    ])
    const b = new Map<number, string>([
      [1, 'uno'],
      [7, 'siete'],
    ])
    expect(hashWorld(a)).toBe(hashWorld(b))
  })

  it('el orden de un Set no cambia nada, ni siquiera sacando y volviendo a poner', () => {
    const a = new Set(['pez', 'vara', 'hebra'])
    const b = new Set(['hebra', 'pez', 'vara'])
    expect(hashWorld(a)).toBe(hashWorld(b))

    // Sacar un elemento y volver a ponerlo lo manda al final del orden de
    // inserción. Si el hash dependiera de ese orden, tocar el conjunto sin
    // cambiarlo cambiaría el mundo.
    a.delete('pez')
    a.add('pez')
    expect(hashWorld(a)).toBe(hashWorld(b))
  })

  it('`-0` hashea como `0`', () => {
    // Tienen bits distintos pero son el mismo número. Una resta que da cero
    // negativo no puede cambiar el hash del mundo.
    expect(hashWorld(-0)).toBe(hashWorld(0))
    expect(hashWorld({ t: -0 })).toBe(hashWorld({ t: 0 }))
  })

  it('una propiedad `undefined` hashea igual que la propiedad ausente', () => {
    expect(hashWorld({ a: 1, b: undefined })).toBe(hashWorld({ a: 1 }))
  })

  it('un viaje de ida y vuelta por JSON no cambia el hash', () => {
    // Es la propiedad que sostiene al legado: guardar la partida y volver a
    // cargarla tiene que dar EL MISMO mundo. Si el hash cambiara al pasar por
    // JSON, cargar una partida la volvería inauditable.
    const estado = {
      tick: 412,
      bichos: [
        { id: 'b1', calor: 20, agua: 0, mote: undefined },
        { id: 'b2', calor: -0, agua: 13.5 },
      ],
      vacio: {},
      lista: [],
    }
    const ida = JSON.parse(JSON.stringify(estado)) as unknown
    expect(hashWorld(ida)).toBe(hashWorld(estado))
  })
})

describe('hash — lo que SÍ tiene que cambiarlo', () => {
  it('valores distintos, hashes distintos', () => {
    expect(hashWorld({ t: 20 })).not.toBe(hashWorld({ t: 21 }))
    expect(hashWorld({ t: 20 })).not.toBe(hashWorld({ t: 20.000001 }))
  })

  it('tipos distintos con la misma pinta no colisionan', () => {
    const hs = [
      hashWorld(1),
      hashWorld('1'),
      hashWorld([1]),
      hashWorld({ '0': 1 }),
      hashWorld(true),
      hashWorld(null),
      hashWorld(new Map([['0', 1]])),
      hashWorld(new Set([1])),
      hashWorld(new Int32Array([1])),
      hashWorld([[1]]),
    ]
    expect(new Set(hs).size).toBe(hs.length)
  })

  it('el largo va adelante, así que la concatenación no es ambigua', () => {
    expect(hashWorld(['ab', 'c'])).not.toBe(hashWorld(['a', 'bc']))
    expect(hashWorld({ ab: 1, c: 2 })).not.toBe(hashWorld({ a: 1, bc: 2 }))
  })

  it('un arreglo tipado no es el arreglo común con los mismos números', () => {
    expect(hashWorld(new Int32Array([1, 2, 3]))).not.toBe(hashWorld([1, 2, 3]))
    expect(hashWorld(new Int32Array([1, 2, 3]))).not.toBe(hashWorld(new Float64Array([1, 2, 3])))
    expect(hashWorld(new Int32Array([1, 2, 3]))).not.toBe(hashWorld(new Int16Array([1, 2, 3])))
    expect(hashWorld(new Int32Array([1, 2, 3]))).not.toBe(hashWorld(new Int32Array([1, 2, 4])))
  })

  it('un campo de terreno de 4096 celdas nota un cambio de una celda', () => {
    const a = new Int32Array(4096)
    for (let i = 0; i < a.length; i++) a[i] = (i * 37) % 1000
    const b = Int32Array.from(a)
    b[2731] = (b[2731] as number) + 1
    expect(hashWorld(a)).not.toBe(hashWorld(b))
  })

  it('diez mil estados distintos dan diez mil hashes distintos', () => {
    // No es una prueba de resistencia criptográfica: es la única forma barata de
    // ver que los dos carriles están vivos. Con un solo carril de 32 bits esto
    // pasaría igual —10⁴ es chico— así que además está el test de abajo.
    const hs = new Set<string>()
    for (let i = 0; i < 10_000; i++) hs.add(hashWorld({ id: `b${i}`, calor: i % 97, agua: (i * 13) % 101 }))
    expect(hs.size).toBe(10_000)
  })

  it('los dos carriles no son el mismo carril escrito dos veces', () => {
    // Si los dos carriles arrancaran iguales o compartieran primo, las dos
    // mitades del hash serían idénticas y el hash valdría 32 bits, no 64.
    for (const v of [0, 1, 'pez', { a: 1 }, [1, 2, 3]]) {
      const h = hashWorld(v)
      expect(h.slice(0, 8)).not.toBe(h.slice(8, 16))
    }
  })
})

describe('hash — lo que tiene que lanzar', () => {
  it('un número no finito', () => {
    // `NaN` no tiene UNA representación de bits, y un no finito en el estado es
    // un bug de física: `fixed.ts` satura justamente para que no aparezca.
    expect(() => hashWorld(NaN)).toThrow(/no finito/)
    expect(() => hashWorld({ t: Infinity })).toThrow(/no finito/)
    expect(() => hashWorld(new Float64Array([1, NaN]))).toThrow(/no finito/)
  })

  it('`undefined` suelto o dentro de un arreglo', () => {
    // Dentro de un arreglo, `JSON.stringify` lo convierte en `null`: si se
    // aceptara, guardar y cargar la partida cambiaría el hash.
    expect(() => hashWorld(undefined)).toThrow(/undefined/)
    expect(() => hashWorld([1, undefined, 3])).toThrow(/undefined/)
  })

  it('una fecha, una expresión regular y una instancia de clase', () => {
    // Éste es el test que justifica la lista blanca: un `Date` no tiene claves
    // propias enumerables, así que un hash permisivo lo confundiría con `{}` y
    // dos estados con fechas distintas hashearían igual EN SILENCIO.
    class Bicho {
      constructor(public calor: number) {}
    }
    expect(() => hashWorld(new Date(0))).toThrow(/solo entran/)
    expect(() => hashWorld(/pez/)).toThrow(/solo entran/)
    expect(() => hashWorld(new Bicho(20))).toThrow(/Bicho/)
  })

  it('una función, un símbolo y un bigint', () => {
    expect(() => hashWorld(() => 1)).toThrow(/function/)
    expect(() => hashWorld(Symbol('x'))).toThrow(/symbol/)
    expect(() => hashWorld(10n)).toThrow(/bigint/)
  })

  it('un ciclo, y también un ciclo que pasa por un Set', () => {
    // Sin la cota de profundidad esto no sería un error sino un cuelgue del
    // worker del mundo, sin mensaje y sin tick.
    const a: Record<string, unknown> = {}
    a['yo'] = a
    expect(() => hashWorld(a)).toThrow(/profundo|ciclo/)

    const s = new Set<unknown>()
    const b: Record<string, unknown> = { s }
    s.add(b)
    expect(() => hashWorld(b)).toThrow(/profundo|ciclo/)
  })

  it('un arreglo tipado que no está en la lista', () => {
    expect(() => hashWorld(new DataView(new ArrayBuffer(8)))).toThrow(/no soportado/)
  })
})

describe('hash — la huella y la puerta', () => {
  it('la huella no se movió', () => {
    // Estas constantes están escritas a mano y clavan el algoritmo. Si alguna
    // cambia, el hash cambió: puede estar bien —a veces se cambia a propósito—
    // pero tiene que ser una decisión con nombre y no una deriva. Y son la
    // referencia que tiene que dar cualquier otro motor de JS: el criterio «el
    // mismo hash en Chrome y en Firefox» se verifica corriendo ESTE test allá.
    expect(hashWorld(null)).toBe('040c5b8c31c4682b')
    expect(hashWorld(0)).toBe('43c27e335bd59aa8')
    expect(hashWorld('pez')).toBe('ffa6e4c4b197f983')
    expect(hashWorld({ id: 'b1', calor: 20, agua: 0 })).toBe('7b6b7fd6a6d5ff8b')
    expect(hashWorld(new Int32Array([1, 2, 3]))).toBe('6f750358d8de39d9')
  })

  it('HASH_VACIO es el hash de `null`', () => {
    expect(HASH_VACIO).toBe(hashWorld(null))
  })

  it('la puerta desde texto pelado valida', () => {
    expect(worldHashFromHex('040c5b8c31c4682b')).toBe(HASH_VACIO)
    expect(() => worldHashFromHex('040c5b8c')).toThrow(/largo/)
    expect(() => worldHashFromHex('040C5B8C31C4682B')).toThrow(/inválido/) // mayúsculas no
    expect(() => worldHashFromHex('040c5b8c31c4682g')).toThrow(/inválido/)
  })
})
