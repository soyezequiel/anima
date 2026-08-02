import { describe, expect, it } from 'vitest'

import { fixedFromRaw } from '@anima/physics'

import { CONTRA_EL_RELOJ, NO_SE_AFIRMA } from './reloj-de-pared.js'

import { CELL_FIELDS, COVER, type Cell, type CellField } from '../src/cell.js'
import { hashWorld } from '../src/hash.js'
import {
  addCover,
  bodyCount,
  chunkCount,
  createGrid,
  deserializeGrid,
  ensureChunk,
  gridInvariants,
  placeBody,
  readCell,
  removeBody,
  serializeGrid,
  writeCell,
  type Grid,
} from '../src/grid.js'

/**
 * EL CRITERIO DEL HITO 2, la parte que le toca a la grilla.
 *
 *   «dos mundos gemelos con 10⁵ intenciones producen el mismo `hashWorld`»
 *   «restaurar a mitad reproduce el final exacto»
 *
 * El hash es el de `hash.ts` —no hay un segundo hash en el paquete— y lo que se
 * hashea es `serializeGrid`, que es la FORMA CANÓNICA: chunks por clave, sin los
 * impecables y sin el índice, que es derivado.
 *
 * El azar de las intenciones sale de un LCG y no de `Math.random`: un test de
 * determinismo que no es determinista él mismo no prueba nada, y además la regla
 * 2 de `ii/README.md` lo prohíbe.
 */

type Op =
  | { readonly k: 'place'; readonly id: string; readonly at: Cell }
  | { readonly k: 'remove'; readonly id: string }
  | { readonly k: 'field'; readonly at: Cell; readonly f: CellField; readonly v: number }
  | { readonly k: 'cover'; readonly at: Cell; readonly d: number }

/**
 * Un LCG y un dado que usa los BITS ALTOS.
 *
 * Los bits bajos de un LCG módulo 2³² tienen período cortísimo —el último bit
 * alterna, los dos últimos ciclan cada 4— así que `r() % 4` no sortea nada:
 * devuelve siempre la misma rueda de cuatro. Se descubrió acá, y de la peor
 * manera posible para un test: el barrido «al azar» resultaba ser
 * poner-sacar-poner-sacar y terminaba con exactamente 100 cuerpos, un número
 * demasiado redondo. Un test de determinismo con un barrido degenerado prueba
 * mucho menos de lo que parece.
 */
function lcg(semilla: number): () => number {
  let s = semilla >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s >>> 16
  }
}

const GUARDADOS: readonly CellField[] = CELL_FIELDS.filter((f) => f !== COVER)

function intenciones(n: number, semilla: number): readonly Op[] {
  const r = lcg(semilla)
  const ops: Op[] = []
  for (let i = 0; i < n; i++) {
    const at: Cell = { x: (r() % 81) - 40, y: (r() % 81) - 40 }
    const id = `b${r() % 400}`
    switch (r() % 4) {
      case 0:
        ops.push({ k: 'place', id, at })
        break
      case 1:
        ops.push({ k: 'remove', id })
        break
      case 2: {
        const f = GUARDADOS[r() % GUARDADOS.length] as CellField
        ops.push({ k: 'field', at, f, v: (r() % 4000) - 2000 })
        break
      }
      default:
        ops.push({ k: 'cover', at, d: (r() % 1600) - 800 })
    }
  }
  return ops
}

function aplicar(g: Grid, ops: readonly Op[]): void {
  for (const op of ops) {
    switch (op.k) {
      case 'place':
        placeBody(g, op.id, op.at)
        break
      case 'remove':
        removeBody(g, op.id)
        break
      case 'field':
        writeCell(g, op.at, op.f, fixedFromRaw(op.v))
        break
      case 'cover':
        addCover(g, op.at, fixedFromRaw(op.d))
        break
    }
  }
}

function hashDe(g: Grid): string {
  return hashWorld(serializeGrid(g))
}

const CIEN_MIL = 100_000

describe('dos mundos gemelos con 10⁵ intenciones dan el mismo hash', () => {
  const ops = intenciones(CIEN_MIL, 20260727)

  it('las intenciones son de verdad 10⁵ y mueven el mundo', () => {
    const g = createGrid()
    aplicar(g, ops)
    expect(ops.length).toBe(CIEN_MIL)
    expect(bodyCount(g)).toBeGreaterThan(100)
    expect(chunkCount(g)).toBeGreaterThan(20)
    expect(gridInvariants(g)).toEqual([])
  })

  it('mismo hash, y no es el hash del mundo vacío', () => {
    const a = createGrid()
    const b = createGrid()
    aplicar(a, ops)
    aplicar(b, ops)
    expect(hashDe(a)).toBe(hashDe(b))
    expect(hashDe(a)).not.toBe(hashDe(createGrid()))
  })

  it('una sola intención distinta da un hash distinto', () => {
    // Un hash que no cambia cuando el mundo cambia no prueba nada.
    const a = createGrid()
    const b = createGrid()
    aplicar(a, ops)
    aplicar(b, [...ops.slice(0, CIEN_MIL - 1), { k: 'place', id: 'colado', at: { x: 7, y: 7 } }])
    expect(hashDe(a)).not.toBe(hashDe(b))
  })

  it('explorar no cambia el hash: materializar y leer no son hechos del mundo', () => {
    // Es lo que permite el pre-decreto del anillo de chunks vecinos en tiempo
    // ocioso, y lo que el Hito 3 va a exigir como criterio propio.
    const a = createGrid()
    const b = createGrid()
    aplicar(a, ops)
    aplicar(b, ops)
    for (let cx = -10; cx <= 10; cx++) for (let cy = -10; cy <= 10; cy++) ensureChunk(b, cx, cy)
    for (let i = 0; i < 1000; i++) readCell(b, { x: i - 500, y: 500 - i }, 'wet')
    expect(chunkCount(b)).toBeGreaterThan(chunkCount(a))
    expect(hashDe(b)).toBe(hashDe(a))
  })
})

describe('restaurar a mitad reproduce el final exacto', () => {
  const ops = intenciones(CIEN_MIL, 4242)

  it('guardar en la mitad, cargar y seguir da el mismo hash que no haber parado', () => {
    const mitad = CIEN_MIL / 2
    const seguido = createGrid()
    aplicar(seguido, ops.slice(0, mitad))
    const guardado = JSON.parse(JSON.stringify(serializeGrid(seguido))) as ReturnType<
      typeof serializeGrid
    >
    const cortado = deserializeGrid(guardado)
    // El estado justo después de cargar ya tiene que ser el mismo…
    expect(hashDe(cortado)).toBe(hashDe(seguido))
    aplicar(seguido, ops.slice(mitad))
    aplicar(cortado, ops.slice(mitad))
    // …y el final, exacto.
    expect(hashDe(cortado)).toBe(hashDe(seguido))
    expect(bodyCount(cortado)).toBe(bodyCount(seguido))
    expect(gridInvariants(cortado)).toEqual([])
  })

  it('el índice se reconstruye de las cubetas, no se guarda', () => {
    // Si `where` viajara en el snapshot habría dos verdades sobre dónde está un
    // cuerpo, y una podría mentir.
    const g = createGrid()
    aplicar(g, ops.slice(0, 5000))
    const s = serializeGrid(g)
    expect(JSON.stringify(s)).not.toContain('where')
    const b = deserializeGrid(s)
    expect(bodyCount(b)).toBe(bodyCount(g))
    expect(gridInvariants(b)).toEqual([])
  })
})

describe('el índice no se degrada con la cantidad de cuerpos', () => {
  it('5000 cuerpos moviéndose 20 ticks, sin recorrer el mundo ni una vez', () => {
    // NO es la medición del criterio —«5000 cuerpos a menos de 4 ms por tick» se
    // mide sobre el tick entero, con física adentro, y esto es solo el índice—.
    // Es el detector de que alguien volvió a poner un recorrido O(mundo) adentro
    // de mover: con `entitiesAt = Object.values().sort()`, 100 000 mudanzas
    // tardarían minutos en vez de milisegundos, y la cota de abajo es tan holgada
    // que ninguna máquina la falla por estar ocupada.
    //
    // Lo medido en esta máquina, para que el número esté escrito y no estimado:
    //   mudanza real (cambia de celda)   273 ns  → 1.4 ms si se mueven los 5000
    //   mudanza a la misma celda          39 ns
    //   consulta `bodiesAt`               61 ns  → 0.3 ms por 5000 consultas
    // El caso de arriba —los 5000 cuerpos mudándose TODOS los ticks— no es el
    // mundo real, donde se mueve un puñado; está para que la cota sea la peor.
    const g = createGrid()
    const N = 5000
    for (let i = 0; i < N; i++) placeBody(g, `b${i}`, { x: i % 100, y: (i / 100) | 0 })

    const t0 = process.hrtime.bigint()
    for (let t = 1; t <= 20; t++) {
      for (let i = 0; i < N; i++) placeBody(g, `b${i}`, { x: (i + t) % 100, y: ((i / 100) | 0) + t })
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6

    expect(bodyCount(g)).toBe(N)
    expect(gridInvariants(g)).toEqual([])

    // ─── Y EL RELOJ, DETRÁS DE SU PUERTA ────────────────────────────────────
    //
    // La cota es holguísima —1000 ms para 100.000 mudanzas que miden 145— y aun
    // así es el reloj de pared: en un runner compartido, una pausa del
    // recolector o un vecino ruidoso la puede cruzar, y entonces EL archivo de
    // determinismo se pondría rojo por la máquina. Ver `./reloj-de-pared.ts`.
    console.log(`  100.000 mudanzas en ${ms.toFixed(1)} ms ${CONTRA_EL_RELOJ ? '' : NO_SE_AFIRMA}`)
    if (CONTRA_EL_RELOJ) expect(ms).toBeLessThan(1000)
  })
})
