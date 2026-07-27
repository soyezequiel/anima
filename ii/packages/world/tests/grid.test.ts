import { describe, expect, it } from 'vitest'

import { CELDA_AL_AIRE, fx, unfx } from '@anima/physics'

import { CELL_LIMIT, CHUNK_SIZE, chunkFromKey, localIndex, type Cell } from '../src/cell.js'
import { chunkIsPristine, type Chunk, type ChunkSnapshot } from '../src/chunk.js'
import {
  addCell,
  addCover,
  bodiesAt,
  bodyCount,
  celdaAt,
  cellOf,
  chunkAt,
  chunkCount,
  chunkKeysInOrder,
  createGrid,
  deserializeGrid,
  ensureChunk,
  forEachBodyNear,
  gridInvariants,
  hasBody,
  placeBody,
  pruneChunks,
  readCell,
  removeBody,
  serializeGrid,
  shelteredAt,
  writeCell,
  type Grid,
} from '../src/grid.js'

const EN: Cell = { x: 3, y: 5 }

/** El chunk del origen quedó indistinguible de uno recién creado. */
function impecable(g: Grid): boolean {
  const ch = chunkAt(g, 0, 0)
  return ch !== undefined && chunkIsPristine(ch)
}

describe('los chunks se materializan por demanda, y mirar no materializa', () => {
  it('leer una celda de un chunk que no existe da el ambiente y no crea nada', () => {
    const g = createGrid()
    expect(readCell(g, { x: 1000, y: -1000 }, 'oxygen')).toBe(fx(CELDA_AL_AIRE.oxygen))
    expect(readCell(g, { x: 1000, y: -1000 }, 'temperature')).toBe(fx(CELDA_AL_AIRE.ambiente))
    expect(bodiesAt(g, { x: 1000, y: -1000 })).toEqual([])
    expect(shelteredAt(g, { x: 1000, y: -1000 })).toBe(0)
    expect(chunkCount(g)).toBe(0)
  })

  it('escribir materializa, y una sola vez por chunk', () => {
    const g = createGrid()
    writeCell(g, EN, 'temperature', fx(300))
    expect(chunkCount(g)).toBe(1)
    writeCell(g, { x: EN.x + 1, y: EN.y }, 'temperature', fx(300))
    expect(chunkCount(g)).toBe(1)
    writeCell(g, { x: EN.x + CHUNK_SIZE, y: EN.y }, 'temperature', fx(300))
    expect(chunkCount(g)).toBe(2)
    expect(readCell(g, EN, 'temperature')).toBe(fx(300))
    expect(chunkAt(g, 0, 0)).toBeDefined()
    expect(chunkAt(g, 9, 9)).toBeUndefined()
  })

  it('los chunks se recorren por clave, no por orden de materialización', () => {
    // El `Map` de JS conserva el orden de inserción, y por eso es una trampa
    // cómoda: el orden de inserción es el orden de EXPLORACIÓN.
    const g = createGrid()
    ensureChunk(g, 5, 0)
    ensureChunk(g, -1, 0)
    ensureChunk(g, 0, -1)
    const claves = chunkKeysInOrder(g)
    expect(claves.length).toBe(3)
    expect([...claves].sort((a, b) => a - b)).toEqual([...claves])
    expect(claves).not.toEqual([...g.chunks.keys()])
    expect(claves.map((k) => chunkFromKey(k))).toEqual([
      { cx: 0, cy: -1 },
      { cx: -1, cy: 0 },
      { cx: 5, cy: 0 },
    ])
  })

  it('los chunks que quedaron impecables se pueden tirar', () => {
    const g = createGrid()
    ensureChunk(g, 1, 1)
    writeCell(g, EN, 'wet', fx(0.5))
    expect(chunkCount(g)).toBe(2)
    expect(pruneChunks(g)).toBe(1)
    expect(chunkCount(g)).toBe(1)
    expect(readCell(g, EN, 'wet')).toBe(fx(0.5))
  })
})

describe('el índice espacial se mantiene incrementalmente', () => {
  it('poner, encontrar y mover: la vieja queda vacía y la nueva tiene el cuerpo', () => {
    const g = createGrid()
    placeBody(g, 'vara', EN)
    expect(bodiesAt(g, EN)).toEqual(['vara'])
    expect(cellOf(g, 'vara')).toEqual(EN)
    expect(hasBody(g, 'vara')).toBe(true)
    expect(bodyCount(g)).toBe(1)

    const alla: Cell = { x: 40, y: -40 }
    placeBody(g, 'vara', alla)
    expect(bodiesAt(g, EN)).toEqual([])
    expect(bodiesAt(g, alla)).toEqual(['vara'])
    expect(cellOf(g, 'vara')).toEqual(alla)
    expect(bodyCount(g)).toBe(1)
    expect(gridInvariants(g)).toEqual([])
  })

  it('mover a la misma celda no reordena la cubeta', () => {
    // Si sacara y volviera a poner, el cuerpo saltaría al final y el orden de
    // llegada dejaría de ser el orden de llegada.
    const g = createGrid()
    placeBody(g, 'a', EN)
    placeBody(g, 'b', EN)
    placeBody(g, 'a', EN)
    expect(bodiesAt(g, EN)).toEqual(['a', 'b'])
  })

  it('sacar lo saca del índice y de la celda', () => {
    const g = createGrid()
    placeBody(g, 'a', EN)
    expect(removeBody(g, 'a')).toBe(true)
    expect(removeBody(g, 'a')).toBe(false)
    expect(bodiesAt(g, EN)).toEqual([])
    expect(cellOf(g, 'a')).toBeUndefined()
    expect(bodyCount(g)).toBe(0)
    // El chunk quedó como estaba: poner y sacar no deja rastro.
    expect(impecable(g)).toBe(true)
  })

  it('un cuerpo no puede estar en dos celdas: `placeBody` es alta y mudanza a la vez', () => {
    const g = createGrid()
    placeBody(g, 'a', { x: 0, y: 0 })
    placeBody(g, 'a', { x: 1, y: 0 })
    placeBody(g, 'a', { x: 2, y: 0 })
    expect(bodiesAt(g, { x: 0, y: 0 })).toEqual([])
    expect(bodiesAt(g, { x: 1, y: 0 })).toEqual([])
    expect(bodiesAt(g, { x: 2, y: 0 })).toEqual(['a'])
    expect(gridInvariants(g)).toEqual([])
  })

  it('la consulta no depende de cuántos cuerpos haya en el mundo', () => {
    // No es una medición de tiempo: es que la cubeta devuelta sea la de la celda
    // y solo la de la celda, con 5000 cuerpos desparramados alrededor.
    const g = createGrid()
    for (let i = 0; i < 5000; i++) placeBody(g, `b${i}`, { x: i % 200, y: (i / 200) | 0 })
    expect(bodyCount(g)).toBe(5000)
    expect(bodiesAt(g, { x: 7, y: 3 })).toEqual([`b${3 * 200 + 7}`])
    expect(gridInvariants(g)).toEqual([])
  })
})

describe('el vecindario cuesta el radio, no el mundo', () => {
  it('devuelve lo que está adentro del cuadrado, en orden por filas', () => {
    const g = createGrid()
    placeBody(g, 'centro', { x: 0, y: 0 })
    placeBody(g, 'arriba', { x: 0, y: -1 })
    placeBody(g, 'lejos', { x: 5, y: 0 })
    placeBody(g, 'borde', { x: 1, y: 1 })
    const vistos: string[] = []
    forEachBodyNear(g, { x: 0, y: 0 }, 1, (id) => vistos.push(id))
    expect(vistos).toEqual(['arriba', 'centro', 'borde'])
  })

  it('se recorta contra el borde del mundo en vez de lanzar', () => {
    const g = createGrid()
    const esquina: Cell = { x: -CELL_LIMIT, y: -CELL_LIMIT }
    placeBody(g, 'a', esquina)
    const vistos: string[] = []
    forEachBodyNear(g, esquina, 3, (id) => vistos.push(id))
    expect(vistos).toEqual(['a'])
  })

  it('aguanta que la función mueva el cuerpo que acaba de recibir', () => {
    // Mutar la cubeta mientras se la recorre saltea elementos, y mover cosas es
    // lo que hace el mundo mientras percibe.
    const g = createGrid()
    placeBody(g, 'a', { x: 0, y: 0 })
    placeBody(g, 'b', { x: 0, y: 0 })
    const vistos: string[] = []
    forEachBodyNear(g, { x: 0, y: 0 }, 0, (id) => {
      vistos.push(id)
      placeBody(g, id, { x: 50, y: 50 })
    })
    expect(vistos).toEqual(['a', 'b'])
    expect(bodiesAt(g, { x: 50, y: 50 })).toEqual(['a', 'b'])
  })
})

describe('el lugar de la ley 12 (ADR II-0002)', () => {
  it('`sheltered` se calcula al leer: destapar tiene efecto en el mismo tick', () => {
    const g = createGrid()
    expect(shelteredAt(g, EN)).toBe(0)
    addCover(g, EN, fx(0.6))
    expect(shelteredAt(g, EN)).toBe(fx(0.6))
    addCover(g, EN, fx(0.9))
    // Dos cosas encima tapan del todo, aunque el acumulado siga contando 1.5.
    expect(shelteredAt(g, EN)).toBe(fx(1))
    addCover(g, EN, fx(-0.9))
    expect(shelteredAt(g, EN)).toBe(fx(0.6))
    addCover(g, EN, fx(-0.6))
    expect(shelteredAt(g, EN)).toBe(0)
    expect(impecable(g)).toBe(true)
  })
})

describe('el puente a las leyes', () => {
  it('una celda virgen se le presenta a las leyes como `CELDA_AL_AIRE`', () => {
    const g = createGrid()
    expect(celdaAt(g, EN)).toEqual(CELDA_AL_AIRE)
    expect(chunkCount(g)).toBe(0)
  })

  it('y una celda escrita se le presenta con lo que tiene, en reales', () => {
    const g = createGrid()
    writeCell(g, EN, 'oxygen', fx(0.2))
    addCell(g, EN, 'wet', fx(0.5))
    writeCell(g, EN, 'temperature', fx(420))
    const c = celdaAt(g, EN)
    expect(c.oxygen).toBe(0.2)
    expect(c.wet).toBe(0.5)
    expect(c.ambiente).toBe(420)
    expect(c.ambiente).toBe(unfx(readCell(g, EN, 'temperature')))
  })
})

describe('los invariantes se pueden preguntar, y encuentran lo que hay', () => {
  it('una grilla sana no tiene nada que decir', () => {
    const g = createGrid()
    for (let i = 0; i < 50; i++) placeBody(g, `b${i}`, { x: i % 7, y: i % 5 })
    for (let i = 0; i < 25; i++) removeBody(g, `b${i * 2}`)
    expect(gridInvariants(g)).toEqual([])
  })

  it('un cuerpo metido a mano en una cubeta sale como fantasma', () => {
    const g = createGrid()
    placeBody(g, 'a', EN)
    const ch = chunkAt(g, 0, 0) as Chunk
    ch.bodies[localIndex(EN.x, EN.y)]?.push('fantasma')
    ch.bodyCount++
    const malas = gridInvariants(g)
    expect(malas.length).toBe(1)
    expect(malas[0]).toContain('fantasma')
  })

  it('un cuerpo en el índice y en ninguna celda también sale', () => {
    const g = createGrid()
    placeBody(g, 'a', EN)
    g.where.set('huerfano', 1)
    expect(gridInvariants(g).some((m) => m.includes('huerfano'))).toBe(true)
  })
})

describe('guardar y cargar la grilla', () => {
  function conMundo(): Grid {
    const g = createGrid()
    writeCell(g, EN, 'temperature', fx(300))
    addCover(g, { x: 40, y: 40 }, fx(0.7))
    placeBody(g, 'fogata', EN)
    placeBody(g, 'losa', EN)
    placeBody(g, 'vara', { x: -20, y: 33 })
    return g
  }

  it('vuelve igual, y reconstruye el índice de las cubetas', () => {
    const g = conMundo()
    const s = JSON.parse(JSON.stringify(serializeGrid(g))) as ReturnType<typeof serializeGrid>
    const b = deserializeGrid(s)
    expect(serializeGrid(b)).toEqual(serializeGrid(g))
    expect(cellOf(b, 'vara')).toEqual({ x: -20, y: 33 })
    expect(bodiesAt(b, EN)).toEqual(['fogata', 'losa'])
    expect(bodyCount(b)).toBe(3)
    expect(gridInvariants(b)).toEqual([])
    expect(readCell(b, EN, 'temperature')).toBe(fx(300))
    expect(shelteredAt(b, { x: 40, y: 40 })).toBe(fx(0.7))
  })

  it('materializar chunks no cambia lo que se guarda', () => {
    // Es la propiedad que el Hito 3 necesita: dos partidas idénticas que
    // exploraron en distinto orden tienen el mismo estado guardado.
    const g = conMundo()
    const antes = serializeGrid(g)
    for (let cx = -3; cx <= 3; cx++) for (let cy = -3; cy <= 3; cy++) ensureChunk(g, cx, cy)
    for (let i = 0; i < 100; i++) readCell(g, { x: i * 17, y: -i * 13 }, 'oxygen')
    expect(serializeGrid(g)).toEqual(antes)
  })

  it('un cuerpo que viene en dos celdas se rechaza al cargar', () => {
    const g = conMundo()
    const s = serializeGrid(g)
    const doble = {
      chunks: s.chunks.map((c): ChunkSnapshot =>
        c.bodies.length > 0 ? { ...c, bodies: [...c.bodies, [0, ['fogata']]] } : c,
      ),
    }
    expect(() => deserializeGrid(doble)).toThrow(RangeError)
  })
})

describe('el terreno no es una entidad', () => {
  it('un lago de 4000 celdas son cuatro números por celda y cero cuerpos', () => {
    // La frase del documento sobre Ánima I: «el agua deja de ser 80 entidades».
    const g = createGrid()
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 80; x++) writeCell(g, { x, y }, 'wet', fx(1))
    }
    expect(bodyCount(g)).toBe(0)
    expect(readCell(g, { x: 79, y: 49 }, 'wet')).toBe(fx(1))
    expect(readCell(g, { x: 80, y: 49 }, 'wet')).toBe(0)
    // 80×50 celdas viven en 5×4 chunks: 20 objetos, no 4000.
    expect(chunkCount(g)).toBe(20)
  })
})
