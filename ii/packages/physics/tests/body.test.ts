import { describe, expect, it } from 'vitest'
import {
  MAX_ASSEMBLY_DEPTH,
  MAX_JOINTS,
  MAX_PARTS,
  assemblyDepthOf,
  assertWithinCaps,
  nameOf,
  qualityOf,
  violationsOf,
  type Body,
  type Joint,
} from '../src/body.js'
import { CANA, CANA_CON_ANZUELO, VARA, cuerpo, mundo, parte } from './mundo-de-prueba.js'

const phys = mundo()

describe('qualityOf — de dónde sale cada número', () => {
  it('las extensivas se suman por parte y escalan con la masa', () => {
    // pescado: nutrition 9 por unidad de masa, medio kilo → 4.5
    const pescado = cuerpo('p', 'filete', [parte('pescado', 0.5)])
    expect(qualityOf(pescado, 'nutrition', phys)).toBeCloseTo(4.5, 10)
    expect(qualityOf(pescado, 'mass', phys)).toBeCloseTo(0.5, 10)
  })

  it('las intensivas se promedian pesadas por masa, no se suman', () => {
    const mixto = cuerpo('m', 'vara', [parte('madera', 3, { temperature: 100 }), parte('fibra', 1, { temperature: 20 })])
    // (100·3 + 20·1) / 4 = 80. Sumarlas daría 120, que es la clase de error que
    // hace que dos ramas tibias enciendan un fuego.
    expect(qualityOf(mixto, 'temperature', phys)).toBeCloseTo(80, 10)
  })

  it('el estado del cuerpo le gana al agregado de las partes', () => {
    const crudo = cuerpo('p', 'filete', [parte('pescado', 0.5)])
    const cocido = { ...crudo, state: { digestibility: 0.91 } }
    expect(qualityOf(crudo, 'digestibility', phys)).toBeCloseTo(0.35, 10)
    expect(qualityOf(cocido, 'digestibility', phys)).toBeCloseTo(0.91, 10)
  })

  it('clampea al rango de la spec', () => {
    const raro = cuerpo('r', 'filete', [parte('pescado', 0.5, { digestibility: 3 })])
    expect(qualityOf(raro, 'digestibility', phys)).toBe(1)
  })

  it('una cualidad que no está en el catálogo del cuerpo da cero, no NaN', () => {
    const vacio = cuerpo('v', 'bloque', [parte('madera', 1)])
    expect(qualityOf(vacio, 'sharpness', phys)).toBe(0)
  })

  it('calories es nutrition × mass × digestibility, y es derivada', () => {
    const crudo = cuerpo('p', 'filete', [parte('pescado', 0.4)])
    // 9 × 0.4 × 0.35 = 1.26, el número del documento. La masa entra una sola
    // vez, por `nutrition`, que es extensiva porque es conservada.
    expect(qualityOf(crudo, 'calories', phys)).toBeCloseTo(1.26, 10)
    const asado = { ...crudo, state: { digestibility: 0.91 } }
    expect(qualityOf(asado, 'calories', phys)).toBeGreaterThan(2 * qualityOf(crudo, 'calories', phys))
  })

  it('una derivada circular tira en vez de colgarse', () => {
    const enfermo = {
      ...phys,
      qualities: [
        { id: 'reach', range: [0, 10], extent: 'intensive', conserved: false, derived: { k: 'own', q: 'catch' } },
        { id: 'catch', range: [0, 10], extent: 'intensive', conserved: false, derived: { k: 'own', q: 'reach' } },
      ],
    } as unknown as typeof phys
    expect(() => qualityOf(VARA, 'reach', enfermo)).toThrow(/circular/)
  })
})

describe('la caña, que nadie escribió', () => {
  it('la vara sola alcanza pero no engancha: no califica como aparejo', () => {
    expect(qualityOf(VARA, 'reach', phys)).toBeGreaterThanOrEqual(2)
    expect(qualityOf(VARA, 'catch', phys)).toBe(0)
  })

  it('vara + hebra atada de un solo lado sí califica', () => {
    expect(qualityOf(CANA, 'reach', phys)).toBeGreaterThanOrEqual(2)
    expect(qualityOf(CANA, 'catch', phys)).toBeGreaterThan(0)
  })

  it('la espina en la punta sube el catch sin sacarle la punta libre', () => {
    expect(qualityOf(CANA_CON_ANZUELO, 'catch', phys)).toBeGreaterThan(qualityOf(CANA, 'catch', phys))
  })

  it('una hebra tirante entre dos varas no engancha nada', () => {
    const tensa = cuerpo(
      'tensa',
      'vara',
      [parte('madera', 0.5), parte('fibra', 0.2), parte('madera', 0.5)],
      [
        { a: 0, b: 1, via: 'fibra', strength: 0.4 },
        { a: 1, b: 2, via: 'fibra', strength: 0.4 },
      ],
    )
    expect(qualityOf(tensa, 'catch', phys)).toBe(0)
  })

  it('el trípode no pesca: tres varas rígidas, ninguna punta suelta', () => {
    const tripode = cuerpo(
      'tripode',
      'vara',
      [parte('madera', 0.6), parte('madera', 0.6), parte('madera', 0.6)],
      [
        { a: 0, b: 1, via: 'fibra', strength: 0.5 },
        { a: 1, b: 2, via: 'fibra', strength: 0.5 },
      ],
    )
    expect(qualityOf(tripode, 'catch', phys)).toBe(0)
  })
})

describe('las cotas, que ahora sí producen error', () => {
  const cadena = (n: number): Body => {
    const parts = Array.from({ length: n }, () => parte('madera', 0.4))
    const joints: Joint[] = []
    for (let i = 0; i + 1 < n; i++) joints.push({ a: i, b: i + 1, via: 'fibra', strength: 0.5 })
    return cuerpo(`cadena-${n}`, 'vara', parts, joints)
  }

  it('una parte suelta tiene profundidad 0 y la caña 1', () => {
    expect(assemblyDepthOf(VARA)).toBe(0)
    expect(assemblyDepthOf(CANA)).toBe(1)
  })

  it('parrilla-sobre-trípode es profundidad 3: existe con la cota en 3 y no con 2', () => {
    const obra = cadena(4)
    expect(assemblyDepthOf(obra)).toBe(3)
    expect(MAX_ASSEMBLY_DEPTH).toBe(3)
    expect(violationsOf(obra)).toEqual([])
    expect(() => assertWithinCaps(obra)).not.toThrow()
  })

  it('un ensamble más profundo que la cota se reporta y tira', () => {
    const obra = cadena(5)
    expect(assemblyDepthOf(obra)).toBe(4)
    expect(violationsOf(obra)).toContainEqual({ k: 'depth', found: 4, max: MAX_ASSEMBLY_DEPTH })
    expect(() => assertWithinCaps(obra)).toThrow(/profundidad/)
  })

  it('demasiadas partes o demasiadas juntas se reportan', () => {
    const gordo = cuerpo(
      'gordo',
      'bloque',
      Array.from({ length: MAX_PARTS + 1 }, () => parte('madera', 0.1)),
    )
    expect(violationsOf(gordo)).toContainEqual({ k: 'parts', found: MAX_PARTS + 1, max: MAX_PARTS })

    const atadisimo = cuerpo(
      'atadisimo',
      'bloque',
      [parte('madera', 0.1), parte('madera', 0.1)],
      Array.from({ length: MAX_JOINTS + 1 }, () => ({ a: 0, b: 1, via: 'fibra', strength: 0.1 })),
    )
    expect(violationsOf(atadisimo)).toContainEqual({ k: 'joints', found: MAX_JOINTS + 1, max: MAX_JOINTS })
  })

  it('una junta que apunta afuera o a sí misma se reporta', () => {
    const rota = cuerpo('rota', 'vara', [parte('madera', 0.5)], [{ a: 0, b: 7, via: 'fibra', strength: 0.1 }])
    expect(violationsOf(rota)).toContainEqual({ k: 'joint-out-of-range', joint: 0 })

    const sola = cuerpo('sola', 'vara', [parte('madera', 0.5)], [{ a: 0, b: 0, via: 'fibra', strength: 0.1 }])
    expect(violationsOf(sola)).toContainEqual({ k: 'joint-self', joint: 0 })
  })

  it('las juntas rotas no rompen la geometría: se ignoran, no explotan', () => {
    const rota = cuerpo('rota', 'vara', [parte('madera', 0.5)], [{ a: 0, b: 7, via: 'fibra', strength: 0.1 }])
    expect(qualityOf(rota, 'reach', phys)).toBeCloseTo(2, 10)
  })
})

describe('nameOf — el mismo cuerpo, distinto nombre', () => {
  const crudo = cuerpo('pez-1', 'filete', [parte('pescado', 0.4)])

  it('pescado crudo y pescado asado son el MISMO cuerpo', () => {
    const asado: Body = { ...crudo, state: { digestibility: 0.91 } }
    expect(nameOf(crudo, phys)).toBe('pescado crudo')
    expect(nameOf(asado, phys)).toBe('pescado asado')
    expect(asado.id).toBe(crudo.id)
    expect(asado.parts).toBe(crudo.parts)
  })

  it('a medio hacer también tiene nombre', () => {
    expect(nameOf({ ...crudo, state: { digestibility: 0.6 } }, phys)).toBe('pescado a medio cocinar')
  })

  it('concuerda en género con el lexema de la sustancia', () => {
    const carne = cuerpo('carne-1', 'filete', [parte('carne', 0.4)])
    expect(nameOf(carne, phys)).toBe('carne cruda')
    expect(nameOf({ ...carne, state: { digestibility: 0.9 } }, phys)).toBe('carne asada')
  })

  it('la madera no está cruda: lo que no alimenta no se cocina', () => {
    expect(nameOf(VARA, phys)).toBe('madera')
  })

  it('quemado le gana a asado, y ardiendo le gana a todo', () => {
    expect(nameOf({ ...crudo, state: { charred: 0.9, digestibility: 0.91 } }, phys)).toBe('pescado quemado')
    expect(nameOf({ ...crudo, state: { temperature: 300, charred: 0.9 } }, phys)).toBe('pescado ardiendo')
  })

  it('podrido se acumula con el estado de cocción', () => {
    expect(nameOf({ ...crudo, state: { decay: 0.7 } }, phys)).toBe('pescado crudo podrido')
  })

  it('un compuesto se nombra por sus dos sustancias, y no se llama caña', () => {
    expect(nameOf(CANA, phys)).toBe('madera con fibra')
  })

  it('la madera mojada se dice mojada, porque es lo que decide si prende', () => {
    expect(nameOf({ ...VARA, state: { moisture: 0.8 } }, phys)).toBe('madera mojada')
  })
})
