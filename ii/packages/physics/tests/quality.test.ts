import { describe, expect, it } from 'vitest'

import {
  CELL_QUALITIES,
  CONSERVED,
  QUALITIES,
  QUALITY_IDS,
  cellSpecOf,
  clampToRange,
  derivedValue,
  evalQuality,
  isConserved,
  isDerived,
  rangeFixed,
  specOf,
  type ExprContext,
  type GeomFn,
  type QualityExpr,
  type QualityId,
  type QualityVector,
  type SubstanceFn,
} from '../src/quality.js'
import { fx, rate, RATE_MAX } from '../src/fixed.js'

/**
 * Los tests del catálogo. Lo que se prueba acá NO es que los números estén bien
 * —eso lo prueba el barrido térmico y lo va a probar el mundo—: es que el
 * catálogo sea CERRADO y CONSISTENTE, que es lo único que hace que una sustancia
 * inventada mañana se comporte sin fila propia.
 */

/** Un contexto de expresión armado a mano, sin `Body`: las cualidades tienen que poder testearse sin cuerpos. */
function ctxOf(o: {
  own?: QualityVector
  parts?: readonly QualityVector[]
  geom?: Partial<Record<GeomFn, number>>
  substance?: Partial<Record<SubstanceFn, number>>
}): ExprContext {
  const parts = o.parts ?? []
  return {
    own: (q) => o.own?.[q] ?? 0,
    sumParts: (q) => parts.reduce((acc, p) => acc + (p[q] ?? 0), 0),
    maxParts: (q) => parts.reduce((acc, p) => Math.max(acc, p[q] ?? 0), 0),
    geom: (f) => o.geom?.[f] ?? 0,
    substance: (f) => o.substance?.[f] ?? 0,
  }
}

/** Todas las cualidades que una expresión toca, para poder preguntar por ciclos. */
function referenced(e: QualityExpr, out: QualityId[] = []): QualityId[] {
  switch (e.k) {
    case 'own':
    case 'sumParts':
    case 'maxParts':
      out.push(e.q)
      break
    case 'op':
      referenced(e.a, out)
      referenced(e.b, out)
      break
    default:
      break
  }
  return out
}

describe('el catálogo está cerrado y cuadra', () => {
  it('son 29 de cuerpo y 4 de celda: 33', () => {
    expect(QUALITIES.length).toBe(29)
    expect(CELL_QUALITIES.length).toBe(4)
  })

  it('4 conservadas, 8 derivadas, 17 con ley', () => {
    expect(CONSERVED).toEqual(['mass', 'nutrition', 'stamina', 'fuelEnergy'])
    const derivadas = QUALITY_IDS.filter(isDerived)
    expect(derivadas.length).toBe(8)
    expect(derivadas).toContain('heatCapacity')
    expect(QUALITIES.length - CONSERVED.length - derivadas.length).toBe(17)
  })

  it('no hay ids repetidos y specOf encuentra a todas', () => {
    expect(new Set(QUALITY_IDS).size).toBe(QUALITIES.length)
    for (const q of QUALITY_IDS) expect(specOf(q).id).toBe(q)
  })

  it('specOf lanza con una cualidad que no existe', () => {
    // Devolver `undefined` dejaría propagarse el error hasta un NaN en el estado
    // del mundo, muy lejos de donde estuvo la causa.
    expect(() => specOf('cañaDePescar' as QualityId)).toThrow()
  })

  it('los rangos están bien orientados y contienen al cero o lo declaran', () => {
    for (const s of QUALITIES) expect(s.range[0]).toBeLessThan(s.range[1])
  })
})

describe('las reglas que el catálogo no puede violar', () => {
  it('ninguna conservada relaja: nada se repone solo', () => {
    // Si la stamina o la nutrición volvieran por su cuenta, la regla 2 de
    // `admit()` («nada sube gratis») quedaría rota desde el catálogo, y el hambre
    // dejaría de doler en el tick 300.
    for (const s of QUALITIES) if (s.conserved) expect(s.relaxesTo).toBeUndefined()
  })

  it('ninguna derivada es conservada', () => {
    // Conservar algo que no se guarda no significa nada: la conservación se
    // chequea sobre cuentas, y una vista no es una cuenta.
    for (const q of QUALITY_IDS) if (isDerived(q)) expect(isConserved(q)).toBe(false)
  })

  it('ninguna derivada se apoya en otra derivada', () => {
    // Con esto, el evaluador no puede entrar en un ciclo NUNCA, y no hace falta
    // ni detección de ciclos ni memoización: es una propiedad del catálogo, no
    // una defensa del código.
    for (const s of QUALITIES) {
      if (s.derived === undefined) continue
      for (const q of referenced(s.derived)) expect(isDerived(q)).toBe(false)
    }
  })

  it('hay UNA sola forma de preguntar si algo es derivado (ADR II-0006)', () => {
    // Antes había dos —`isDerived(q)` y `spec.derived !== undefined`— y no
    // coincidían: `heatCapacity` era derivada sin expresión, así que quien
    // preguntara por el campo la dejaba escribible, se guardaba y quedaba vieja
    // apenas el cuerpo perdiera masa evaporando. Con el nodo `substance` en la
    // gramática las dos preguntas son la misma, y este test lo prueba para las
    // 29, no solo para la que dio problema.
    for (const q of QUALITY_IDS) expect(isDerived(q)).toBe(specOf(q).derived !== undefined)
    expect(specOf('heatCapacity').derived).toBeDefined()
    expect(isDerived('heatCapacity')).toBe(true)
  })

  it('heatCapacity se declara como cualquier otra derivada', () => {
    // `mass × specificHeat`, y `specificHeat` sale del nodo nuevo. Ya no hay
    // función aparte ni lista aparte: `derivedValue` la contesta como a las otras
    // siete.
    expect(derivedValue('heatCapacity', ctxOf({ own: { mass: 2 }, substance: { specificHeat: 3.5 } })))
      .toBeCloseTo(7, 10)
  })
})

describe('el evaluador', () => {
  it('step es el único comparador, y compara a ≥ b', () => {
    const e: QualityExpr = {
      k: 'op',
      f: 'step',
      a: { k: 'own', q: 'temperature' },
      b: { k: 'const', v: 100 },
    }
    expect(evalQuality(e, ctxOf({ own: { temperature: 99 } }))).toBe(0)
    expect(evalQuality(e, ctxOf({ own: { temperature: 100 } }))).toBe(1)
    expect(evalQuality(e, ctxOf({ own: { temperature: 101 } }))).toBe(1)
  })

  it('dividir por cero da 0 y no Infinity', () => {
    // Un Infinity suelto se vuelve NaN en la primera resta y envenena el estado
    // del mundo muchos ticks después de la causa.
    const e: QualityExpr = { k: 'op', f: '/', a: { k: 'const', v: 5 }, b: { k: 'const', v: 0 } }
    expect(evalQuality(e, ctxOf({}))).toBe(0)
  })

  it('sumParts suma y maxParts toma el máximo', () => {
    const ctx = ctxOf({
      parts: [
        { mass: 2, sharpness: 0.1 },
        { mass: 3, sharpness: 0.7 },
      ],
    })
    expect(evalQuality({ k: 'sumParts', q: 'mass' }, ctx)).toBe(5)
    expect(evalQuality({ k: 'maxParts', q: 'sharpness' }, ctx)).toBeCloseTo(0.7, 10)
  })

  it('recorta al rango declarado', () => {
    expect(clampToRange('digestibility', 3)).toBe(1)
    expect(clampToRange('digestibility', -1)).toBe(0)
    expect(derivedValue('solid', ctxOf({ own: { rigidity: 0.9 } }))).toBe(1)
  })
})

describe('nadie escribió «caña»', () => {
  // El requisito 3 del documento: las afordancias salen de la geometría de
  // partes, no de un tipo. Ninguna línea de estos tests nombra un objeto.
  it('una cosa larga con una hebra colgando ya atrapa algo', () => {
    const canaCruda = ctxOf({ geom: { longestAxis: 3, freeStrandEnds: 1 }, parts: [{}, {}] })
    expect(derivedValue('reach', canaCruda)).toBe(3)
    expect(derivedValue('catch', canaCruda)).toBeCloseTo(0.15, 10)
  })

  it('y si la punta tiene filo, atrapa más', () => {
    const conAnzuelo = ctxOf({
      geom: { longestAxis: 3, freeStrandEnds: 1 },
      parts: [{ sharpness: 0 }, { sharpness: 0.6 }],
    })
    expect(derivedValue('catch', conAnzuelo)).toBeCloseTo(0.45, 10)
  })

  it('a mano no se pesca: reach 0 no califica el rol de la ley 9', () => {
    const mano = ctxOf({ geom: { longestAxis: 0, freeStrandEnds: 0 } })
    expect(derivedValue('reach', mano)).toBe(0)
    expect(derivedValue('catch', mano)).toBe(0)
  })
})

describe('comer es una función derivada, no un permiso', () => {
  // El ejemplo (b) del documento, con sus números.
  const crudo = ctxOf({ own: { nutrition: 9, mass: 0.4, digestibility: 0.35 } })
  const asado = ctxOf({ own: { nutrition: 9, mass: 0.33, digestibility: 0.91 } })

  it('asado rinde más del doble que crudo, y perdió masa', () => {
    const c = derivedValue('calories', crudo)!
    const a = derivedValue('calories', asado)!
    expect(c).toBeCloseTo(1.26, 6) // 9 × 0.40 × 0.35
    expect(a).toBeCloseTo(2.7027, 6) // 9 × 0.33 × 0.91, el «2.70» del documento
    expect(a).toBeGreaterThan(2 * c)
  })

  it('la madera no puede alimentar por más que se la cocine', () => {
    // `nutrition` es conservada y la madera tiene 0. Ninguna ley la puede subir,
    // así que no hay técnica ni habilidad que convierta un palo en comida. Ésta
    // es la puerta que el ADR 0018 de Ánima I cerraba con una lista de tipos
    // protegidos; acá la cierra la física.
    const madera = ctxOf({ own: { nutrition: 0, mass: 5, digestibility: 0.95 } })
    expect(derivedValue('calories', madera)).toBe(0)
    expect(isConserved('nutrition')).toBe(true)
  })

  it('quemado hasta el final no rinde nada: el mundo no negocia', () => {
    const carbonizado = ctxOf({ own: { nutrition: 0, mass: 0.1, digestibility: 0.9 } })
    expect(derivedValue('calories', carbonizado)).toBe(0)
  })
})

describe('encender no es una acción, es una consecuencia (ADR II-0001)', () => {
  it('por debajo del punto de ignición no emite nada', () => {
    const frio = ctxOf({ own: { temperature: 299, ignitionPoint: 300, fuelEnergy: 18, mass: 1 } })
    expect(derivedValue('emitsPower', frio)).toBe(0)
  })

  it('por encima emite, y da la fogata del documento', () => {
    // 18 de fuelEnergy por unidad de masa, una unidad de masa: 300 de potencia,
    // que es exactamente el `emitsPower` con el que está calibrado el barrido.
    const ardiendo = ctxOf({
      own: { temperature: 375, ignitionPoint: 300, fuelEnergy: 18, mass: 1 },
    })
    expect(derivedValue('emitsPower', ardiendo)).toBeCloseTo(300.6, 6)
  })

  it('una fogata más grande emite más, sin que nadie escriba «hoguera»', () => {
    const grande = ctxOf({
      own: { temperature: 375, ignitionPoint: 300, fuelEnergy: 18, mass: 2 },
    })
    const chica = ctxOf({ own: { temperature: 375, ignitionPoint: 300, fuelEnergy: 18, mass: 1 } })
    expect(derivedValue('emitsPower', grande)!).toBeGreaterThan(derivedValue('emitsPower', chica)!)
  })
})

describe('las otras afordancias', () => {
  it('portable: la criatura levanta hasta cierto punto y después no', () => {
    expect(derivedValue('portable', ctxOf({ own: { mass: 3 } }))).toBe(1)
    expect(derivedValue('portable', ctxOf({ own: { mass: 8 } }))).toBe(1)
    expect(derivedValue('portable', ctxOf({ own: { mass: 9 } }))).toBe(0)
  })

  it('solid: el agua no es sólida, la madera sí', () => {
    expect(derivedValue('solid', ctxOf({ own: { rigidity: 0 } }))).toBe(0)
    expect(derivedValue('solid', ctxOf({ own: { rigidity: 0.7 } }))).toBe(1)
  })

  it('footing: un montón de grano rígido no es piso', () => {
    expect(derivedValue('footing', ctxOf({ own: { rigidity: 0.9, cohesion: 0.8 } }))).toBeCloseTo(
      0.9,
      10,
    )
    expect(derivedValue('footing', ctxOf({ own: { rigidity: 0.9, cohesion: 0.1 } }))).toBe(0)
  })

  it('heatCapacity: una hoja se enfría antes que una piedra, y nadie escribió ninguna', () => {
    // Los mismos números de antes del ADR II-0006, ahora por la gramática y no
    // por `heatCapacityOf()`. `substance('specificHeat')` es el calor específico
    // pesado por masa, así que sobre un ensamble el producto con la masa total
    // da `Σ (masa · calor específico)` — la parrilla de tres varas de masa 1 y
    // calor específico 1.7 sigue dando 5.1.
    const hc = (mass: number, specificHeat: number): number =>
      derivedValue('heatCapacity', ctxOf({ own: { mass }, substance: { specificHeat } }))!
    expect(hc(0.02, 1.7)).toBeLessThan(hc(8, 0.9))
    expect(hc(3, 1.7)).toBeCloseTo(5.1, 10)
  })
})

describe('las cualidades de celda (ADR II-0002)', () => {
  it('sheltered es derivada y las otras tres relajan al ambiente', () => {
    // Guardar `sheltered` convertiría una relación en una propiedad, y habría
    // que resincronizarla cada vez que algo se mueve.
    expect(cellSpecOf('sheltered').derived).toBe(true)
    expect(cellSpecOf('sheltered').relaxesTo).toBeUndefined()
    for (const q of ['wet', 'oxygen', 'temperature'] as const) {
      expect(cellSpecOf(q).derived).toBe(false)
      expect(cellSpecOf(q).relaxesTo?.target).toBe('ambient')
    }
  })

  it('el oxígeno de la celda vuelve solo, y por eso taparse no asfixia sin aviso', () => {
    expect(cellSpecOf('oxygen').relaxesTo!.perTick).toBeGreaterThan(0)
  })

  it('cellSpecOf lanza con una cualidad que no existe', () => {
    expect(() => cellSpecOf('techo' as never)).toThrow()
  })
})

describe('puente al punto fijo', () => {
  it('los rangos se convierten una sola vez, en un solo lugar', () => {
    expect(rangeFixed('digestibility')).toEqual([0, fx(1)])
    expect(rangeFixed('temperature')).toEqual([fx(-100), fx(2000)])
  })

  it('las tasas que el catálogo declara caben en `Rate`, y no todas en `Fixed`', () => {
    // ADR II-0006 medido contra el catálogo mismo, no contra tres literales
    // copiados a mano. Un `relaxesTo.perTick` es la definición literal de una
    // tasa: cuánto cambia una magnitud en un tick.
    const tasas: number[] = []
    for (const s of QUALITIES) if (s.relaxesTo !== undefined) tasas.push(s.relaxesTo.perTick)
    for (const s of CELL_QUALITIES) if (s.relaxesTo !== undefined) tasas.push(s.relaxesTo.perTick)
    expect(tasas.length).toBeGreaterThan(0)
    for (const t of tasas) {
      expect(rate(t), `${t} no es representable como tasa`).toBeGreaterThan(0)
      expect(rate(t), `${t} satura el techo de las tasas`).toBeLessThan(RATE_MAX)
    }

    // Y la más lenta del catálogo está EN EL PISO de la escala de las
    // magnitudes: 0.001 es exactamente un ulp de `Fixed`. Cualquier ley que
    // quiera relajar más lento que eso es CERO ahí — y las hay: el secado de la
    // ley 11 corre a 2e-5 por grado y la descomposición a 4e-4 por tick. Ésa es
    // la razón entera de que las tasas tengan escala propia.
    expect(fx(specOf('moisture').relaxesTo!.perTick)).toBe(1)
    expect(fx(0.00002)).toBe(0)
    expect(rate(0.00002)).toBe(20)
  })
})
