import { describe, expect, it } from 'vitest'

import { InvariantError, Ledger, waterBodyKey } from '../src/ledger.js'
import { WaterBodies, compareCells, parseWaterCellKey, waterCellKey, type WaterCell } from '../src/compromiso.js'

/**
 * Los tests de la granularidad del compromiso.
 *
 * Lo que están cuidando, en una línea: **no puede haber pescado en un tile y
 * ninguno en el de al lado**, y **dos lagos que se juntan no pueden hacer que el
 * dios se desdiga de nada que alguien haya visto**.
 *
 * Los tres casos de la fusión tienen su describe cada uno, porque son tres
 * reglas distintas y la que más fácil se rompe —los dos con testigo— es
 * justamente la que ninguna de las propuestas originales tenía.
 */

/** La ley: función pura de la clave, como manda la regla madre. */
function ley(id: string): string {
  return `fauna-de-${id}`
}

function nuevo(): { l: Ledger; w: WaterBodies } {
  const l = new Ledger()
  return { l, w: new WaterBodies(l) }
}

function celdas(...pares: readonly (readonly [number, number])[]): WaterCell[] {
  return pares.map(([x, y]) => ({ x, y }))
}

describe('la componente conexa', () => {
  it('dos celdas pegadas son UN cuerpo', () => {
    const { w } = nuevo()
    w.addWater(0, 0)
    w.addWater(1, 0)
    expect(w.bodyAt(1, 0)).toBe(w.bodyAt(0, 0))
    expect(w.bodies()).toHaveLength(1)
  })

  it('dos celdas separadas son DOS cuerpos', () => {
    const { w } = nuevo()
    w.addWater(0, 0)
    w.addWater(5, 0)
    expect(w.bodyAt(5, 0)).not.toBe(w.bodyAt(0, 0))
    expect(w.bodies()).toHaveLength(2)
  })

  it('en diagonal NO se juntan: por una esquina no pasa el agua', () => {
    const { w } = nuevo()
    w.addWater(0, 0)
    w.addWater(1, 1)
    expect(w.bodies()).toHaveLength(2)
  })

  it('declarar la misma celda dos veces no cambia nada', () => {
    const { w } = nuevo()
    const a = w.addWater(2, 2)
    expect(w.addWater(2, 2)).toBe(a)
    expect(w.body(a)?.cells).toHaveLength(1)
  })

  it('una celda en el medio junta las dos mitades', () => {
    const { w } = nuevo()
    w.addWaters(celdas([0, 0], [1, 0], [3, 0], [4, 0]))
    expect(w.bodies()).toHaveLength(2)
    w.addWater(2, 0)
    expect(w.bodies()).toHaveLength(1)
    expect(w.body(w.bodyAt(4, 0) as string)?.cells).toHaveLength(5)
  })

  it('el id de un cuerpo sin testigo es su celda canónicamente menor', () => {
    const { w } = nuevo()
    w.addWaters(celdas([5, 5], [5, 4], [6, 4]))
    expect(w.bodyAt(6, 4)).toBe('5,4')
  })

  it('si crece hacia una celda menor, se rebautiza y la respuesta vieja se descarta', () => {
    const { l, w } = nuevo()
    const antes = w.addWater(5, 5)
    expect(antes).toBe('5,5')
    w.ask(antes, () => ley(antes))
    expect(l.get('w:5,5')?.answer).toBe('fauna-de-5,5')

    const despues = w.addWater(5, 4)
    expect(despues).toBe('5,4')
    expect(w.bodyAt(5, 5)).toBe('5,4')
    // Nadie lo había visto: se puede reescribir, y la respuesta se re-pregunta
    // bajo la clave nueva en vez de mudarse (mudarla rompería la regla madre).
    expect(l.get('w:5,5')).toBeNull()
    expect(l.entries().map((e) => e.event)).toEqual(['decidido', 'descartado'])
    expect(w.ask(despues, () => ley(despues))).toBe('fauna-de-5,4')
    l.verify()
  })
})

describe('fusión de dos lagos — NINGUNO tiene testigo', () => {
  it('se fusionan en uno solo, con el id canónico, y el perdedor se reescribe', () => {
    const { l, w } = nuevo()
    w.addWaters(celdas([0, 0], [1, 0]))
    w.addWaters(celdas([4, 0], [5, 0]))
    const a = w.bodyAt(0, 0) as string
    const b = w.bodyAt(4, 0) as string
    w.ask(a, () => ley(a))
    w.ask(b, () => ley(b))

    w.addWater(2, 0)
    w.addWater(3, 0)

    expect(w.bodies()).toHaveLength(1)
    expect(w.bodyAt(5, 0)).toBe('0,0')
    expect(l.get(waterBodyKey(a))?.answer).toBe('fauna-de-0,0')
    expect(l.get(waterBodyKey(b))).toBeNull()
    l.verify()
  })
})

describe('fusión de dos lagos — UNO tiene testigo', () => {
  it('el fusionado hereda el id y la respuesta del que se vio, aunque su ancla no sea la menor', () => {
    const { l, w } = nuevo()
    w.addWaters(celdas([0, 0], [1, 0]))
    w.addWaters(celdas([4, 0], [5, 0]))
    const sinVer = w.bodyAt(0, 0) as string
    const visto = w.bodyAt(4, 0) as string
    w.ask(sinVer, () => ley(sinVer))
    w.ask(visto, () => ley(visto))
    expect(w.witness(visto, 'fina')).toBe(true)

    w.addWater(2, 0)
    w.addWater(3, 0)

    expect(w.bodies()).toHaveLength(1)
    // El id del que alguien vio, y NO el canónico: el testigo congela el id.
    expect(w.bodyAt(0, 0)).toBe('4,0')
    expect(w.body('4,0')?.anchor).toEqual({ x: 0, y: 0 })
    expect(l.get(waterBodyKey(visto))?.answer).toBe('fauna-de-4,0')
    expect(l.get(waterBodyKey(sinVer))).toBeNull()
    l.verify()
  })

  it('y no vuelve a rebautizarse nunca, aunque siga creciendo hacia abajo', () => {
    const { l, w } = nuevo()
    const id = w.addWater(5, 5)
    w.ask(id, () => ley(id))
    w.witness(id, 'fina')
    w.addWaters(celdas([5, 4], [5, 3], [4, 3]))
    expect(w.bodyAt(4, 3)).toBe('5,5')
    expect(w.body('5,5')?.anchor).toEqual({ x: 4, y: 3 })
    expect(l.get('w:5,5')?.answer).toBe('fauna-de-5,5')
    l.verify()
  })
})

describe('fusión de dos lagos — LOS DOS tienen testigo', () => {
  const armar = (): { l: Ledger; w: WaterBodies } => {
    const { l, w } = nuevo()
    w.addWaters(celdas([0, 0], [1, 0]))
    w.addWaters(celdas([4, 0], [5, 0]))
    for (const id of ['0,0', '4,0']) {
      w.ask(id, () => ley(id))
      w.witness(id, 'fina')
    }
    w.addWater(2, 0)
    w.addWater(3, 0)
    return { l, w }
  }

  it('siguen siendo DOS stocks lógicos compartiendo agua', () => {
    const { w } = armar()
    expect(w.bodies().map((b) => b.id)).toEqual(['0,0', '4,0'])
    expect(w.populationsOf('0,0')).toEqual(['0,0', '4,0'])
    expect(w.regionOf('4,0')).toBe('0,0')
    expect(w.regionOf('0,0')).toBe(w.regionOf('4,0'))
  })

  it('ninguna de las dos respuestas se toca', () => {
    const { l } = armar()
    expect(l.get('w:0,0')?.answer).toBe('fauna-de-0,0')
    expect(l.get('w:4,0')?.answer).toBe('fauna-de-4,0')
    expect(l.entries().some((e) => e.event === 'descartado')).toBe(false)
    l.verify()
  })

  it('cada celda sigue teniendo un dueño y uno solo', () => {
    const { w } = armar()
    expect(w.bodyAt(1, 0)).toBe('0,0')
    expect(w.bodyAt(5, 0)).toBe('4,0')
    // Las celdas nuevas del puente entran en el vecino canónicamente menor.
    expect(w.bodyAt(2, 0)).toBe('0,0')
    expect(w.bodyAt(3, 0)).toBe('0,0')
    const total = w.bodies().reduce((n, b) => n + b.cells.length, 0)
    expect(total).toBe(6)
  })

  it('el agua que se agrega después no borra a ninguno de los dos', () => {
    const { l, w } = armar()
    w.addWaters(celdas([6, 0], [7, 0], [-1, 0]))
    expect(w.bodies()).toHaveLength(2)
    expect(l.get('w:0,0')?.answer).toBe('fauna-de-0,0')
    expect(l.get('w:4,0')?.answer).toBe('fauna-de-4,0')
    l.verify()
  })
})

describe('lo que el oráculo escribió sobre lo que nadie vio', () => {
  /** Dos charcos y el puente que los junta, con la historia como parámetro. */
  function partida(historia: (l: Ledger, w: WaterBodies) => void): { agua: string; libro: string } {
    const l = new Ledger()
    const w = new WaterBodies(l)
    w.addWaters(celdas([0, 0], [1, 0]))
    w.addWaters(celdas([4, 0], [5, 0]))
    historia(l, w)
    w.addWater(2, 0)
    w.addWater(3, 0)
    const id = w.bodyAt(0, 0) as string
    w.ask(id, () => ley(id))
    l.verify()
    return { agua: w.fingerprint(), libro: l.fingerprint() }
  }

  it('no deja rastro cuando el charco se fusiona: llegó tarde a algo que nadie miró', () => {
    const callada = partida(() => {})
    const conOraculo = partida((l, w) => {
      for (const id of ['0,0', '4,0']) w.ask(id, () => ley(id))
      l.advanceTo(30)
      expect(l.amend('w:4,0', 'truchas', 'el oráculo se tomó su tiempo')).toBe(true)
    })
    expect(conOraculo.agua).toBe(callada.agua)
    expect(conOraculo.libro).toBe(callada.libro)
  })

  it('pero sobrevive entera a la fusión cuando alguien SÍ la vio', () => {
    const conTestigo = partida((l, w) => {
      w.ask('4,0', () => ley('4,0'))
      l.advanceTo(30)
      l.amend('w:4,0', 'truchas', 'el oráculo llegó antes que la mano')
      w.witness('4,0', 'fina')
    })
    const callada = partida(() => {})
    expect(conTestigo.agua).not.toBe(callada.agua)
    expect(conTestigo.libro).not.toBe(callada.libro)
  })

  it('y el cuerpo fusionado sigue diciendo lo que dijo el oráculo', () => {
    const l = new Ledger()
    const w = new WaterBodies(l)
    w.addWaters(celdas([0, 0], [1, 0]))
    w.addWaters(celdas([4, 0], [5, 0]))
    w.ask('4,0', () => ley('4,0'))
    l.amend('w:4,0', 'truchas')
    w.witness('4,0', 'fina')
    w.addWaters(celdas([2, 0], [3, 0]))
    expect(w.bodyAt(0, 0)).toBe('4,0')
    expect(l.get('w:4,0')?.answer).toBe('truchas')
    expect(l.get('w:4,0')?.by).toBe('oraculo')
    l.verify()
  })
})

describe('el cruce de cuatro charcos', () => {
  /**
   * El caso feo: una celda que toca CUATRO cuerpos, dos con testigo y dos sin.
   * Es donde una implementación descuidada absorbe un cuerpo con testigo o deja
   * una celda sin dueño, y las dos cosas son el dios contradiciéndose.
   */
  const armar = (): { l: Ledger; w: WaterBodies } => {
    const { l, w } = nuevo()
    for (const [x, y] of [
      [1, 0],
      [0, 1],
      [2, 1],
      [1, 2],
    ] as const) {
      const id = w.addWater(x, y)
      w.ask(id, () => ley(id))
    }
    w.witness('1,0', 'fina') // el de arriba
    w.witness('2,1', 'fina') // el de la derecha
    w.addWater(1, 1) // y ahora se tocan los cuatro
    return { l, w }
  }

  it('los dos con testigo sobreviven; los dos sin testigo se absorben', () => {
    const { w } = armar()
    expect(w.bodies().map((b) => b.id)).toEqual(['1,0', '2,1'])
    expect(w.populationsOf('1,0')).toEqual(['1,0', '2,1'])
  })

  it('ninguna celda queda sin dueño y ninguna tiene dos', () => {
    const { w } = armar()
    const vistas = new Set<string>()
    for (const b of w.bodies()) {
      for (const c of b.cells) {
        expect(vistas.has(waterCellKey(c.x, c.y))).toBe(false)
        vistas.add(waterCellKey(c.x, c.y))
        expect(w.bodyAt(c.x, c.y)).toBe(b.id)
      }
    }
    expect(vistas.size).toBe(5)
  })

  it('las dos respuestas selladas siguen enteras y el libro cierra', () => {
    const { l } = armar()
    expect(l.get('w:1,0')?.answer).toBe('fauna-de-1,0')
    expect(l.get('w:2,1')?.answer).toBe('fauna-de-2,1')
    expect(l.get('w:0,1')).toBeNull()
    expect(l.get('w:1,2')).toBeNull()
    l.verify()
  })
})

describe('explorar en dos órdenes', () => {
  /**
   * EL CRITERIO DEL HITO 3, del lado del agua: el mismo mundo explorado en dos
   * órdenes —y preguntando por el camino, que es lo que hace difícil el test—
   * termina con las mismas componentes, los mismos ids y el mismo libro.
   *
   * Lo que lo hace pasar es la regla de la fusión: mientras nadie mire, el dios
   * puede reescribir, así que cada respuesta intermedia que quedó bajo una clave
   * que dejó de existir se descarta en vez de mudarse.
   */
  const forma = celdas(
    // El lago grande, con dos brazos que se juntan tarde.
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [2, 0],
    [2, 2],
    [3, 2],
    [-1, 1],
    [-1, 2],
    [-1, 3],
    [0, 3],
    [1, 3],
    [2, 3],
    [3, 3],
    [4, 3],
    [4, 2],
    // La laguna de arriba a la derecha.
    [7, 7],
    [7, 8],
    [8, 8],
    [8, 7],
    [9, 7],
    // Un charco que en la mitad de los órdenes nace suelto y en la otra mitad
    // nace pegado, y que termina colgando del lago grande por una lengua de dos
    // celdas: es el que más rebautizos provoca.
    [5, 5],
    [5, 4],
    [5, 3],
    // Y uno que no se junta con nada, para que el test también mire eso.
    [12, 1],
  )

  function explorar(orden: readonly WaterCell[]): { agua: string; libro: string; ids: readonly string[] } {
    const l = new Ledger()
    const w = new WaterBodies(l)
    for (const c of orden) {
      l.advanceTo(l.tick + 1)
      const id = w.addWater(c.x, c.y)
      w.ask(id, () => ley(id))
      l.verify()
    }
    return { agua: w.fingerprint(), libro: l.fingerprint(), ids: w.bodies().map((b) => b.id) }
  }

  /** Un barajado determinista. Nada de `Math.random`: es la regla 2 de `ii/`. */
  function barajar(xs: readonly WaterCell[], semilla: number): WaterCell[] {
    const out = [...xs]
    let s = semilla | 0
    for (let i = out.length - 1; i > 0; i--) {
      s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) | 0
      const j = (s >>> 0) % (i + 1)
      const a = out[i] as WaterCell
      const b = out[j] as WaterCell
      out[i] = b
      out[j] = a
    }
    return out
  }

  it('doce órdenes distintos dan el mismo agua, los mismos ids y el mismo libro', () => {
    const base = explorar([...forma].sort(compareCells))
    // Tres componentes: el lago grande —con la lengua y el charco de (5,5)
    // colgando—, el charco solo de (12,1) y la laguna de arriba a la derecha. El
    // id de cada uno es su celda menor leyendo el mapa por filas.
    expect(base.ids).toEqual(['0,0', '12,1', '7,7'])
    for (let s = 1; s <= 12; s++) {
      const otro = explorar(barajar(forma, s * 7919))
      expect(otro.ids).toEqual(base.ids)
      expect(otro.agua).toBe(base.agua)
      expect(otro.libro).toBe(base.libro)
    }
  })

  it('y al revés también, que es el orden que más rebautiza', () => {
    const base = explorar([...forma].sort(compareCells))
    const alReves = explorar([...forma].sort((a, b) => compareCells(b, a)))
    expect(alReves.agua).toBe(base.agua)
    expect(alReves.libro).toBe(base.libro)
  })
})

describe('la enmienda del oráculo sobre un cuerpo de agua', () => {
  it('llega a tiempo si nadie metió la mano, y tarde si alguien la metió', () => {
    const { l, w } = nuevo()
    const id = w.addWater(3, 3)
    w.ask(id, () => ley(id))

    // Ver el agua de lejos no sella la especie.
    expect(w.witness(id, 'gruesa')).toBe(false)
    expect(l.amend(waterBodyKey(id), 'mojarras')).toBe(true)

    expect(w.witness(id, 'fina')).toBe(true)
    expect(l.amend(waterBodyKey(id), 'bagres')).toBe(false)
    expect(w.ask(id, () => 'nunca se llama')).toBe('mojarras')
    l.verify()
  })
})

describe('el orden de las dos puertas', () => {
  it('mirar de cerca algo que el mundo todavía no decidió lanza: primero se pregunta', () => {
    const { w } = nuevo()
    const id = w.addWater(3, 3)
    expect(() => w.witness(id, 'fina')).toThrow(InvariantError)
  })
})

describe('las claves de celda', () => {
  it('van y vuelven', () => {
    expect(parseWaterCellKey(waterCellKey(-12, 40))).toEqual({ x: -12, y: 40 })
  })

  it('no llevan los separadores de las claves del dios', () => {
    expect(waterCellKey(1, 2)).not.toContain(':')
    expect(waterCellKey(1, 2)).not.toContain('|')
  })

  it('una celda no entera lanza: media celda de agua no existe', () => {
    expect(() => waterCellKey(1.5, 2)).toThrow(RangeError)
  })

  it('el orden canónico es por fila y después por columna, y numérico', () => {
    expect(celdas([10, 0], [-3, 0], [0, -1]).sort(compareCells)).toEqual(celdas([0, -1], [-3, 0], [10, 0]))
  })
})
