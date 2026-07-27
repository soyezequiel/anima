import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { CELDA_AL_AIRE, CELL_QUALITIES, cellSpecOf, FIXED_MAX, fx, type Fixed } from '@anima/physics'

import {
  CELL_FIELD_AMBIENT,
  CELL_FIELD_RANGE,
  CELL_FIELDS,
  CELL_LIMIT,
  CHUNK_AREA,
  CHUNK_BITS,
  CHUNK_MASK,
  CHUNK_SIZE,
  cellAtLocal,
  cellFromKey,
  cellKey,
  chunkCoord,
  chunkFromKey,
  chunkKey,
  chunkKeyOfCell,
  clampField,
  compareCells,
  COVER,
  FIELD_COUNT,
  fieldIndex,
  IDX_COVER,
  IDX_OXYGEN,
  IDX_TEMPERATURE,
  IDX_WET,
  inWorld,
  keyOfCell,
  localCoord,
  localIndex,
  sameCell,
  shelteredFrom,
  type Cell,
} from '../src/cell.js'

/**
 * Lo que se prueba acá no es que la grilla ande: es que la GEOMETRÍA sea
 * biyectiva y que el layout salga del catálogo. Las dos cosas fallan en silencio
 * — una celda que se mapea a dos índices o un campo que se corrió una posición no
 * lanzan nada, escriben en el lugar equivocado y el mundo queda torcido.
 */

describe('la geometría es biyectiva', () => {
  it('índice local y celda son inversos, y también del lado negativo del mundo', () => {
    for (const [cx, cy] of [
      [0, 0],
      [1, -3],
      [-1, -1],
      [-100, 250],
    ] as const) {
      for (let i = 0; i < CHUNK_AREA; i++) {
        const c = cellAtLocal(cx, cy, i)
        expect(localIndex(c.x, c.y)).toBe(i)
        expect(chunkCoord(c.x)).toBe(cx)
        expect(chunkCoord(c.y)).toBe(cy)
      }
    }
  })

  it('el piso y el resto funcionan con negativos: −1 vive en el chunk −1, celda 15', () => {
    // Es el bug clásico de la división con truncado: con `Math.trunc`, −1 caería
    // en el chunk 0 y el chunk 0 tendría 17 columnas.
    expect(chunkCoord(-1)).toBe(-1)
    expect(localCoord(-1)).toBe(CHUNK_MASK)
    expect(chunkCoord(-CHUNK_SIZE)).toBe(-1)
    expect(localCoord(-CHUNK_SIZE)).toBe(0)
    expect(CHUNK_SIZE).toBe(1 << CHUNK_BITS)
    expect(CHUNK_AREA).toBe(CHUNK_SIZE * CHUNK_SIZE)
  })

  it('clave de celda y celda son inversas en todo el mundo, bordes incluidos', () => {
    const casos: readonly Cell[] = [
      { x: 0, y: 0 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: CELL_LIMIT - 1, y: CELL_LIMIT - 1 },
      { x: -CELL_LIMIT, y: -CELL_LIMIT },
      { x: -CELL_LIMIT, y: CELL_LIMIT - 1 },
      { x: 12345, y: -67890 },
    ]
    for (const c of casos) {
      const k = keyOfCell(c)
      expect(Number.isSafeInteger(k)).toBe(true)
      expect(cellFromKey(k)).toEqual(c)
    }
  })

  it('la clave ordena por filas, que es el orden canónico de todo el paquete', () => {
    const desordenadas: readonly Cell[] = [
      { x: 2, y: 1 },
      { x: -5, y: 1 },
      { x: 0, y: 0 },
      { x: 9, y: -2 },
      { x: -9, y: -2 },
    ]
    const ordenadas = [...desordenadas].sort(compareCells)
    expect(ordenadas).toEqual([
      { x: -9, y: -2 },
      { x: 9, y: -2 },
      { x: 0, y: 0 },
      { x: -5, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(sameCell({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true)
    expect(sameCell({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false)
  })

  it('dos celdas distintas nunca comparten clave (barrido de 40 000 pares)', () => {
    const vistas = new Set<number>()
    for (let y = -100; y < 100; y++) {
      for (let x = -100; x < 100; x++) {
        const k = cellKey(x, y)
        expect(vistas.has(k)).toBe(false)
        vistas.add(k)
      }
    }
    expect(vistas.size).toBe(40000)
  })

  it('clave de chunk y chunk son inversas, y la de la celda es la de su chunk', () => {
    for (const [cx, cy] of [
      [0, 0],
      [-1, 5],
      [7, -7],
    ] as const) {
      expect(chunkFromKey(chunkKey(cx, cy))).toEqual({ cx, cy })
    }
    expect(chunkKeyOfCell(-1, -1)).toBe(chunkKey(-1, -1))
    expect(chunkKeyOfCell(CHUNK_SIZE, 0)).toBe(chunkKey(1, 0))
  })

  it('fuera del mundo LANZA, en vez de recortar en silencio', () => {
    // Recortar teletransportaría el cuerpo al borde y nadie se enteraría.
    expect(inWorld(0, 0)).toBe(true)
    expect(inWorld(CELL_LIMIT, 0)).toBe(false)
    expect(inWorld(0, -CELL_LIMIT - 1)).toBe(false)
    expect(inWorld(0.5, 0)).toBe(false)
    expect(inWorld(Number.NaN, 0)).toBe(false)
    expect(() => cellKey(CELL_LIMIT, 0)).toThrow(RangeError)
    expect(() => cellKey(0, -CELL_LIMIT - 1)).toThrow(RangeError)
    expect(() => cellKey(0.5, 0)).toThrow(RangeError)
  })
})

describe('el layout de los campos sale del catálogo, no de una lista', () => {
  it('los campos guardados son exactamente las cualidades de celda no derivadas, más `cover`', () => {
    // Éste es el test que cubre el `as StoredCellQuality` de `cell.ts`: si el
    // catálogo suma una cualidad de celda, o vuelve guardada a `sheltered`, esta
    // prueba se pone roja antes que ninguna otra cosa.
    const guardadas = CELL_QUALITIES.filter((s) => !s.derived).map((s) => s.id)
    expect(CELL_FIELDS).toEqual([...guardadas, COVER])
    expect(CELL_FIELDS).not.toContain('sheltered')
    expect(FIELD_COUNT).toBe(CELL_FIELDS.length)
    expect(new Set(CELL_FIELDS).size).toBe(FIELD_COUNT)
  })

  it('`sheltered` es la única cualidad de celda derivada, y por eso no tiene campo', () => {
    const derivadas = CELL_QUALITIES.filter((s) => s.derived).map((s) => s.id)
    expect(derivadas).toEqual(['sheltered'])
  })

  it('los índices resueltos coinciden con la búsqueda por nombre', () => {
    expect(IDX_WET).toBe(fieldIndex('wet'))
    expect(IDX_OXYGEN).toBe(fieldIndex('oxygen'))
    expect(IDX_TEMPERATURE).toBe(fieldIndex('temperature'))
    expect(IDX_COVER).toBe(fieldIndex(COVER))
    expect(CELL_FIELDS[IDX_OXYGEN]).toBe('oxygen')
    // Un campo que no existe es un error de programa, igual que en `specOf`.
    expect(() => fieldIndex('sheltered' as never)).toThrow(RangeError)
  })

  it('`cover` va ÚLTIMO, para que agregar un campo propio no corra los del catálogo', () => {
    expect(CELL_FIELDS[FIELD_COUNT - 1]).toBe(COVER)
  })
})

describe('el ambiente y los rangos no inventan números', () => {
  it('una celda que nadie tocó vale lo que `CELDA_AL_AIRE` de la física', () => {
    expect(CELL_FIELD_AMBIENT[IDX_WET]).toBe(fx(CELDA_AL_AIRE.wet))
    expect(CELL_FIELD_AMBIENT[IDX_OXYGEN]).toBe(fx(CELDA_AL_AIRE.oxygen))
    // `Celda.ambiente` y la cualidad de celda `temperature` son la MISMA
    // magnitud: la ley 1 relaja hacia ella.
    expect(CELL_FIELD_AMBIENT[IDX_TEMPERATURE]).toBe(fx(CELDA_AL_AIRE.ambiente))
    expect(CELL_FIELD_AMBIENT[IDX_COVER]).toBe(0)
  })

  it('los rangos de los tres campos con catálogo son los del catálogo', () => {
    for (const q of ['wet', 'oxygen', 'temperature'] as const) {
      const [lo, hi] = cellSpecOf(q).range
      expect(CELL_FIELD_RANGE[fieldIndex(q)]).toEqual([fx(lo), fx(hi)])
    }
  })

  it('`cover` no tiene techo propio: un tope rompería la simetría de poner y sacar', () => {
    expect(CELL_FIELD_RANGE[IDX_COVER]).toEqual([0, FIXED_MAX])
  })

  it('escribir fuera de rango recorta, y recorta al rango del campo', () => {
    expect(clampField(IDX_OXYGEN, fx(2))).toBe(fx(1))
    expect(clampField(IDX_WET, fx(-1))).toBe(0)
    expect(clampField(IDX_TEMPERATURE, fx(9999))).toBe(fx(2000))
    expect(clampField(IDX_TEMPERATURE, fx(-9999))).toBe(fx(-100))
    expect(() => clampField(99, fx(1))).toThrow(RangeError)
  })
})

describe('`sheltered` se calcula, nunca se guarda (ADR II-0002)', () => {
  it('es la oclusión saturada en el rango del catálogo', () => {
    const [lo, hi] = cellSpecOf('sheltered').range
    expect(shelteredFrom(0 as Fixed)).toBe(fx(lo))
    expect(shelteredFrom(fx(0.4))).toBe(fx(0.4))
    expect(shelteredFrom(fx(1))).toBe(fx(hi))
    // Tres cosas encima no tapan más que una que ya tapa del todo…
    expect(shelteredFrom(fx(3))).toBe(fx(1))
    // …pero el acumulado sí guarda que eran tres, y por eso sacar una no destapa.
    expect(shelteredFrom(fx(2))).toBe(shelteredFrom(fx(3)))
    expect(shelteredFrom(fx(-1))).toBe(fx(0))
  })
})

// ─── El guardián de la regla 2 de `ii/README.md` ────────────────────────────
//
// Igual que en `@anima/physics`: la regla dice «prohibidas por lint» y el lint no
// cubre `ii/`. Una regla que nadie corre no es una regla. Éste mira SOLO los tres
// archivos de este agente; los demás los cuida quien los escribió.

const PROHIBIDAS: readonly { patron: RegExp; que: string }[] = [
  { patron: /\bMath\s*\.\s*exp\b/, que: 'Math.exp' },
  { patron: /\bMath\s*\.\s*pow\b/, que: 'Math.pow' },
  { patron: /\bMath\s*\.\s*log\b/, que: 'Math.log' },
  { patron: /\bMath\s*\.\s*random\b/, que: 'Math.random' },
  { patron: /\bMath\s*\.\s*sqrt\b/, que: 'Math.sqrt' },
  { patron: /\bMath\s*\.\s*sin\b/, que: 'Math.sin' },
  { patron: /\bMath\s*\.\s*cos\b/, que: 'Math.cos' },
  { patron: /\*\*/, que: 'el operador de potencia' },
  { patron: /\bnew\s+Date\b|\bDate\s*\.\s*now\b/, que: 'Date' },
  { patron: /\bperformance\s*\.\s*now\b/, que: 'performance.now' },
  { patron: /\bIntl\b/, que: 'Intl' },
  { patron: /\blocaleCompare\b/, que: 'localeCompare' },
  { patron: /\btoLocaleString\b/, que: 'toLocaleString' },
]

function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

describe('la grilla no usa nada que ECMAScript no especifique', () => {
  it('`cell.ts`, `chunk.ts` y `grid.ts` están limpios', () => {
    const sucios: string[] = []
    for (const nombre of ['cell.ts', 'chunk.ts', 'grid.ts']) {
      const ruta = fileURLToPath(new URL(`../src/${nombre}`, import.meta.url))
      const codigo = soloCodigo(readFileSync(ruta, 'utf8'))
      for (const { patron, que } of PROHIBIDAS) {
        if (patron.test(codigo)) sucios.push(`${nombre}: ${que}`)
      }
    }
    expect(sucios).toEqual([])
  })

  it('y el detector detecta: un guardián que no puede fallar no guarda nada', () => {
    const carnada = [
      'const a = Math.exp(1) + Math.pow(2, 3) + Math.log(4)',
      'const b = Math.random() + Math.sqrt(2) + Math.sin(1) + Math.cos(1)',
      'const c = 2 ' + '** 10',
      'const d = new Date()',
      'const e = performance.now()',
      'const f = new Intl.NumberFormat()',
      'const g = "a".localeCompare("b") + (1).toLocaleString()',
    ].join('\n')
    const encontradas = PROHIBIDAS.filter(({ patron }) => patron.test(carnada)).map((p) => p.que)
    expect(encontradas.length).toBe(PROHIBIDAS.length)
  })
})
