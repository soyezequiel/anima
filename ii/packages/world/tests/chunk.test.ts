import { describe, expect, it } from 'vitest'

import { fx, type Fixed } from '@anima/physics'

import {
  CELL_FIELD_AMBIENT,
  CELL_FIELDS,
  CHUNK_AREA,
  FIELD_COUNT,
  IDX_COVER,
  IDX_OXYGEN,
  IDX_TEMPERATURE,
  IDX_WET,
  localIndex,
} from '../src/cell.js'
import {
  chunkAdd,
  chunkAddBody,
  chunkBodiesAt,
  chunkGet,
  chunkIsPristine,
  chunkRemoveBody,
  chunkSet,
  createChunk,
  deserializeChunk,
  serializeChunk,
  type ChunkSnapshot,
} from '../src/chunk.js'

const I = localIndex(3, 5)

describe('un chunk nace al aire libre', () => {
  it('todas sus celdas valen el ambiente, no cero', () => {
    // Si naciera en cero, caminar a un lugar nuevo lo dejaría helado y sin aire:
    // el mundo cambiaría por el solo hecho de mirarlo.
    const ch = createChunk(2, -3)
    expect(ch.cx).toBe(2)
    expect(ch.cy).toBe(-3)
    expect(ch.fields.length).toBe(FIELD_COUNT)
    for (let f = 0; f < FIELD_COUNT; f++) {
      expect(ch.fields[f]?.length).toBe(CHUNK_AREA)
      for (let i = 0; i < CHUNK_AREA; i++) expect(chunkGet(ch, f, i)).toBe(CELL_FIELD_AMBIENT[f])
    }
    expect(ch.bodyCount).toBe(0)
    expect(chunkIsPristine(ch)).toBe(true)
  })

  it('leer un campo es la identidad sobre el entero guardado', () => {
    // `chunkGet` pasa por `fixedFromRaw`, la puerta del ADR II-0006. Por
    // construcción no cambia nada —todo lo que entró pasó por `clampField`— y
    // esto lo clava: si algún día truncara o saturara de más, se nota acá.
    const ch = createChunk(0, 0)
    for (const v of [0, 1, -1, 999, 1000, -100000, 2000000]) {
      chunkSet(ch, IDX_TEMPERATURE, I, v as Fixed)
      expect(chunkGet(ch, IDX_TEMPERATURE, I)).toBe(ch.fields[IDX_TEMPERATURE]?.[I])
    }
  })
})

describe('el terreno se recorta al rango de su campo', () => {
  it('el oxígeno no pasa de 1 ni baja de 0, por más que se lo empuje', () => {
    const ch = createChunk(0, 0)
    expect(chunkSet(ch, IDX_OXYGEN, I, fx(5))).toBe(fx(1))
    expect(chunkSet(ch, IDX_OXYGEN, I, fx(-5))).toBe(fx(0))
    expect(chunkGet(ch, IDX_OXYGEN, I)).toBe(0)
  })

  it('sumar es la operación de las leyes, y también recorta', () => {
    const ch = createChunk(0, 0)
    chunkSet(ch, IDX_WET, I, fx(0.5))
    expect(chunkAdd(ch, IDX_WET, I, fx(0.25))).toBe(fx(0.75))
    expect(chunkAdd(ch, IDX_WET, I, fx(10))).toBe(fx(1))
  })

  it('`cover` no tiene techo: poner tres y sacar dos deja exactamente uno', () => {
    // Es la propiedad que el tope habría roto. Con un tope en 1, tres capas
    // saturarían y sacar dos dejaría cero: destapar de más, y el estado
    // dependería del ORDEN en que se puso cada cosa.
    const ch = createChunk(0, 0)
    chunkAdd(ch, IDX_COVER, I, fx(1))
    chunkAdd(ch, IDX_COVER, I, fx(1))
    chunkAdd(ch, IDX_COVER, I, fx(1))
    expect(chunkGet(ch, IDX_COVER, I)).toBe(fx(3))
    chunkAdd(ch, IDX_COVER, I, fx(-1))
    chunkAdd(ch, IDX_COVER, I, fx(-1))
    expect(chunkGet(ch, IDX_COVER, I)).toBe(fx(1))
  })

  it('un índice o un campo fuera del chunk lanzan', () => {
    const ch = createChunk(0, 0)
    expect(() => chunkGet(ch, 0, CHUNK_AREA)).toThrow(RangeError)
    expect(() => chunkGet(ch, 0, -1)).toThrow(RangeError)
    expect(() => chunkGet(ch, FIELD_COUNT, 0)).toThrow(RangeError)
  })
})

describe('el índice de cuerpos del chunk', () => {
  it('conserva el orden de llegada y no ordena al leer', () => {
    const ch = createChunk(0, 0)
    for (const id of ['z', 'a', 'm']) chunkAddBody(ch, I, id)
    // Si ordenara, esto sería ['a','m','z'] — y ordenar al leer es exactamente
    // el `entitiesAt` de Ánima I.
    expect(chunkBodiesAt(ch, I)).toEqual(['z', 'a', 'm'])
    expect(ch.bodyCount).toBe(3)
  })

  it('el mismo cuerpo dos veces en la misma celda no entra dos veces', () => {
    const ch = createChunk(0, 0)
    expect(chunkAddBody(ch, I, 'a')).toBe(true)
    expect(chunkAddBody(ch, I, 'a')).toBe(false)
    expect(chunkBodiesAt(ch, I)).toEqual(['a'])
    expect(ch.bodyCount).toBe(1)
  })

  it('sacar del medio conserva el orden de los demás', () => {
    // Con el truco de «pisar con el último», acá quedaría ['z','m'] y el orden
    // pasaría a depender de la historia de bajas.
    const ch = createChunk(0, 0)
    for (const id of ['z', 'a', 'm']) chunkAddBody(ch, I, id)
    expect(chunkRemoveBody(ch, I, 'a')).toBe(true)
    expect(chunkBodiesAt(ch, I)).toEqual(['z', 'm'])
    expect(chunkRemoveBody(ch, I, 'a')).toBe(false)
    expect(ch.bodyCount).toBe(2)
  })

  it('la celda vacía no asigna nada y devuelve siempre el mismo arreglo', () => {
    const ch = createChunk(0, 0)
    expect(chunkBodiesAt(ch, 0)).toEqual([])
    expect(chunkBodiesAt(ch, 0)).toBe(chunkBodiesAt(ch, 7))
    expect(ch.bodies[0]).toBeUndefined()
  })
})

describe('impecable: el chunk que se puede tirar', () => {
  it('poner y sacar un cuerpo devuelve el chunk a su estado inicial', () => {
    // Si la cubeta vacía quedara, el mundo no volvería a su estado anterior y el
    // hash guardaría un rastro de algo que ya no está.
    const ch = createChunk(0, 0)
    chunkAddBody(ch, I, 'a')
    expect(chunkIsPristine(ch)).toBe(false)
    chunkRemoveBody(ch, I, 'a')
    expect(chunkIsPristine(ch)).toBe(true)
  })

  it('mide el ESTADO y no la historia: escribir y volver a escribir lo mismo no deja huella', () => {
    // Ésta es la diferencia con una bandera `sucio`, que diría que sí para
    // siempre y haría que el hash dependiera de por dónde se caminó.
    const ch = createChunk(0, 0)
    const antes = chunkGet(ch, IDX_TEMPERATURE, I)
    chunkSet(ch, IDX_TEMPERATURE, I, fx(300))
    expect(chunkIsPristine(ch)).toBe(false)
    chunkSet(ch, IDX_TEMPERATURE, I, antes)
    expect(chunkIsPristine(ch)).toBe(true)
  })
})

describe('un chunk se guarda y se carga SOLO', () => {
  function conCosas(): ReturnType<typeof createChunk> {
    const ch = createChunk(-2, 7)
    chunkSet(ch, IDX_TEMPERATURE, localIndex(1, 1), fx(420))
    chunkSet(ch, IDX_WET, localIndex(2, 9), fx(0.75))
    chunkAdd(ch, IDX_COVER, localIndex(3, 3), fx(0.6))
    chunkAddBody(ch, localIndex(3, 3), 'fogata')
    chunkAddBody(ch, localIndex(3, 3), 'losa')
    chunkAddBody(ch, localIndex(0, 0), 'vara')
    return ch
  }

  it('sobrevive al viaje por JSON y vuelve idéntico', () => {
    // Un snapshot que no aguanta `JSON.stringify` no sirve para el journal ni
    // para IndexedDB, y eso se descubre tarde.
    const ch = conCosas()
    const s = serializeChunk(ch)
    const viajado = JSON.parse(JSON.stringify(s)) as ChunkSnapshot
    const vuelto = deserializeChunk(viajado)
    expect(serializeChunk(vuelto)).toEqual(s)
    expect(vuelto.bodyCount).toBe(ch.bodyCount)
    expect(chunkBodiesAt(vuelto, localIndex(3, 3))).toEqual(['fogata', 'losa'])
    expect(chunkGet(vuelto, IDX_TEMPERATURE, localIndex(1, 1))).toBe(fx(420))
  })

  it('las celdas ocupadas van por índice ascendente, no por orden de materialización', () => {
    const ch = createChunk(0, 0)
    chunkAddBody(ch, localIndex(9, 9), 'tarde')
    chunkAddBody(ch, localIndex(1, 0), 'temprano')
    const s = serializeChunk(ch)
    expect(s.bodies.map(([i]) => i)).toEqual([localIndex(1, 0), localIndex(9, 9)])
  })

  it('el snapshot lleva su layout, y un layout ajeno se rechaza', () => {
    // Cargar un guardado viejo con los campos corridos escribiría la humedad en
    // la temperatura. Mejor un error que un mundo torcido.
    const s = serializeChunk(createChunk(0, 0))
    expect(s.layout).toEqual([...CELL_FIELDS])
    const corrido: ChunkSnapshot = { ...s, layout: [...CELL_FIELDS].reverse() }
    expect(() => deserializeChunk(corrido)).toThrow(RangeError)
    const corto: ChunkSnapshot = { ...s, layout: [...CELL_FIELDS].slice(1) }
    expect(() => deserializeChunk(corto)).toThrow(RangeError)
    const campoCorto: ChunkSnapshot = { ...s, fields: [[1], ...s.fields.slice(1)] }
    expect(() => deserializeChunk(campoCorto)).toThrow(RangeError)
  })

  it('lo que viene de afuera se recorta al rango: un snapshot es dato, no verdad', () => {
    const s = serializeChunk(createChunk(0, 0))
    const roto: ChunkSnapshot = {
      ...s,
      fields: s.fields.map((campo, f) =>
        f === IDX_OXYGEN ? campo.map((_, i) => (i === I ? 999999 : 1000)) : [...campo],
      ),
    }
    expect(chunkGet(deserializeChunk(roto), IDX_OXYGEN, I)).toBe(fx(1))
  })

  it('un chunk impecable se serializa y vuelve impecable', () => {
    expect(chunkIsPristine(deserializeChunk(serializeChunk(createChunk(4, 4))))).toBe(true)
  })
})
