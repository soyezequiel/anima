// ─── CAZA DE LA CACHÉ MAL INVALIDADA ─────────────────────────────────────────
//
// La optimización del tick metió CINCO memoizaciones, y todas se justifican con
// el mismo argumento: «los cuerpos son inmutables y la `Physics` también, así que
// esto no puede quedar viejo». El argumento es correcto. Pero un argumento
// correcto sobre una precondición que nadie verifica es exactamente el modo de
// falla de este tipo de optimización, así que acá se verifica.
//
// Las cinco, y de qué depende cada una:
//
//   1. `LecturaPerezosa`  ...... del CUERPO. Muere con él.
//   2. `TAGS_POR_PARTES`  ...... del array de PARTES (WeakMap) + la `Physics`.
//   3. `sustanciaDe`      ...... memo de UNA entrada, módulo global: (Physics, id).
//   4. `indiceDe`         ...... memo de UNA entrada, módulo global: Physics.
//   5. `CONSERVADAS_SE_GUARDAN`  WeakMap por Physics.
//
// Las dos memos de UNA entrada (3 y 4) son estado global mutable adentro de un
// paquete que promete determinismo. Que sean puras es la única razón por la que
// se pueden tener, y «pura» quiere decir: **el resultado de leer un cuerpo no
// puede depender de qué cuerpo se leyó justo antes**. Eso es lo que prueban los
// tests de INTERLEAVING de más abajo, y es la propiedad que ningún test unitario
// de corrección estaba mirando.

import { describe, expect, it } from 'vitest'
import {
  buildSeedPhysics,
  CELDA_TAPADA,
  conSustancia,
  paso,
  qualityOf,
  QUALITY_IDS,
  SUSTANCIAS_SEMILLA,
  T_AMBIENTE,
  tagsDe,
} from '../src/index.js'
import type { Body, Entorno, Part, Physics, QualityVector, Substance } from '../src/index.js'

const PHYS = buildSeedPhysics()
const AIRE: Entorno = { celda: { oxygen: 1, wet: 0, ambiente: T_AMBIENTE } }
const HORNO: Entorno = {
  celda: { oxygen: 1, wet: 0, ambiente: T_AMBIENTE },
  fuente: { potencia: 900, distancia: 0, montaje: 'contacto' },
}

function cuerpo(id: string, substance: string, mass: number, state: QualityVector = {}): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state }
}

/** Todas las cualidades de un cuerpo, en el orden del catálogo. La foto completa. */
function foto(b: Body, phys: Physics): number[] {
  return QUALITY_IDS.map((q) => qualityOf(b, q, phys))
}

/** El cuerpo entero, como texto comparable bit a bit. */
function texto(b: Body): string {
  return JSON.stringify({
    id: b.id,
    form: b.form,
    parts: b.parts,
    joints: b.joints,
    // Las claves ordenadas Y las presentes-pero-`undefined` marcadas: dos estados
    // que difieren solo en que uno tiene la clave y el otro no son DISTINTOS para
    // este test, aunque `JSON.stringify` los aplane al mismo texto.
    claves: Object.keys(b.state).sort(),
    state: Object.keys(b.state)
      .sort()
      .map((k) => [k, b.state[k as keyof QualityVector] ?? 'AUSENTE']),
  })
}

// ─── 1 · Un cuerpo que cambia de masa y se vuelve a leer ─────────────────────

describe('un cuerpo que cambia de masa', () => {
  it('la lectura sigue a la masa nueva, no a la vieja', () => {
    const a = cuerpo('m1', 'pescado', 4)
    expect(qualityOf(a, 'mass', PHYS)).toBe(4)
    // El cuerpo nuevo, hecho como lo hacen las leyes: partes nuevas.
    const b: Body = { ...a, parts: [{ substance: 'pescado', mass: 1, q: {} }] }
    expect(qualityOf(b, 'mass', PHYS)).toBe(1)
    // Y el viejo no se contagió.
    expect(qualityOf(a, 'mass', PHYS)).toBe(4)
    // Las calorías son derivadas de la masa: si algo hubiera memoizado la masa
    // por id o por sustancia, esto lo diría.
    expect(qualityOf(b, 'calories', PHYS) * 4).toBeCloseTo(qualityOf(a, 'calories', PHYS), 10)
  })

  it('la masa que la ley 5 evapora se ve en el MISMO tick, no en el siguiente', () => {
    // La ley 5 baja la masa reconstruyendo las partes, y después el candado de
    // conservación tiene que leer la masa NUEVA para comparar el total. Si el
    // candado leyera la vieja, dejaría pasar nutrición inventada.
    const crudo = cuerpo('p1', 'pescado', 2, { moisture: 0.9 })
    const r = paso(crudo, HORNO, PHYS)
    const mAntes = qualityOf(crudo, 'mass', PHYS)
    const mDespues = qualityOf(r.body, 'mass', PHYS)
    expect(mDespues).toBeLessThan(mAntes)
    // El total conservado no subió, que es lo que el candado promete.
    const nAntes = qualityOf(crudo, 'nutrition', PHYS) * mAntes
    const nDespues = qualityOf(r.body, 'nutrition', PHYS) * mDespues
    expect(nDespues).toBeLessThanOrEqual(nAntes)
  })

  it('cincuenta ticks de evaporación: la masa baja monótona y nadie inventa nutrición', () => {
    let b = cuerpo('p2', 'pescado', 3, { moisture: 1 })
    let masa = qualityOf(b, 'mass', PHYS)
    let total = qualityOf(b, 'nutrition', PHYS) * masa
    for (let i = 0; i < 50; i++) {
      b = paso(b, HORNO, PHYS).body
      const m = qualityOf(b, 'mass', PHYS)
      const t = qualityOf(b, 'nutrition', PHYS) * m
      expect(m).toBeLessThanOrEqual(masa)
      expect(t).toBeLessThanOrEqual(total + 1e-9)
      masa = m
      total = t
    }
    expect(masa).toBeLessThan(3)
  })
})

// ─── 2 · Una parte que se agrega ─────────────────────────────────────────────

describe('una parte que se agrega', () => {
  it('con un array NUEVO —como lo hace todo el código— los tags se recalculan', () => {
    const solaPiedra = cuerpo('t1', 'piedra', 1)
    const tags1 = tagsDe(solaPiedra, PHYS)
    expect(tags1).not.toContain('organico')
    // Lo que hace `unir`: un array nuevo con la parte agregada.
    const conCarne: Body = {
      ...solaPiedra,
      parts: [...solaPiedra.parts, { substance: 'carne', mass: 1, q: {} }],
    }
    expect(tagsDe(conCarne, PHYS)).toContain('organico')
    // Y el original no se movió.
    expect(tagsDe(solaPiedra, PHYS)).not.toContain('organico')
  })

  it('EL AGUJERO, documentado: mutar el array de partes EN SU LUGAR deja los tags viejos', () => {
    // `TAGS_POR_PARTES` está indexada por el ARRAY de partes. El contrato del
    // paquete dice que las partes no se mutan nunca —toda operación construye un
    // array nuevo— y eso está verificado por barrido en el test de más abajo.
    // Pero si alguien lo mutara, la memo mentiría, y conviene que eso esté escrito
    // y probado en vez de ser una nota al pie.
    const partes: Part[] = [{ substance: 'piedra', mass: 1, q: {} }]
    const b: Body = { id: 't2', form: 'vara', parts: partes, joints: [], state: {} }
    expect(tagsDe(b, PHYS)).not.toContain('organico')
    partes.push({ substance: 'carne', mass: 1, q: {} })
    // ESTO ES LO QUE PASA HOY. No es lo correcto —el cuerpo ES orgánico— y es
    // la razón por la que la inmutabilidad de las partes tiene que seguir siendo
    // un invariante y no una costumbre.
    expect(tagsDe(b, PHYS)).not.toContain('organico')
    // Con un array nuevo del mismo contenido, la respuesta correcta vuelve.
    expect(tagsDe({ ...b, parts: [...partes] }, PHYS)).toContain('organico')
  })

  it('ninguna función del paquete muta un array de partes que le dieron', () => {
    // El barrido que sostiene el invariante de arriba: se corren las leyes sobre
    // un corpus ancho y se comprueba que ni el array ni las partes que entraron
    // salieron distintas.
    const antes: Body[] = []
    for (let i = 0; i < 60; i++) {
      antes.push(
        cuerpo(`z${i}`, SUSTANCIAS_SEMILLA[i % SUSTANCIAS_SEMILLA.length]!.id, 1 + (i % 4) * 0.5, {
          temperature: -20 + i * 15,
          moisture: (i % 10) / 10,
          charred: (i % 5) / 5,
        }),
      )
    }
    const copias = antes.map((b) => texto(b))
    for (const e of [AIRE, HORNO, { celda: CELDA_TAPADA }]) {
      for (const b of antes) paso(b, e, PHYS)
    }
    for (let i = 0; i < antes.length; i++) expect(texto(antes[i]!)).toBe(copias[i])
  })
})

// ─── 3 · Dos cuerpos distintos con el mismo id ───────────────────────────────

describe('dos cuerpos distintos con el mismo id', () => {
  it('nada se indexa por id: dos cuerpos homónimos se leen distinto', () => {
    const a = cuerpo('mismo', 'pescado', 2, { temperature: 10 })
    const b = cuerpo('mismo', 'piedra', 9, { temperature: 800 })
    expect(qualityOf(a, 'mass', PHYS)).toBe(2)
    expect(qualityOf(b, 'mass', PHYS)).toBe(9)
    expect(qualityOf(a, 'temperature', PHYS)).toBe(10)
    expect(qualityOf(b, 'temperature', PHYS)).toBe(800)
    expect(tagsDe(a, PHYS)).not.toEqual(tagsDe(b, PHYS))
    // Y alternando, cien veces, por si la memo de una entrada se confundiera.
    for (let i = 0; i < 100; i++) {
      expect(qualityOf(a, 'nutrition', PHYS)).toBeGreaterThan(0)
      expect(qualityOf(b, 'nutrition', PHYS)).toBe(0)
    }
  })

  it('un paso sobre cada uno da resultados distintos, en cualquier orden', () => {
    const a = cuerpo('gemelo', 'pescado', 2, { temperature: 10 })
    const b = cuerpo('gemelo', 'piedra', 9, { temperature: 800 })
    const ab = [texto(paso(a, HORNO, PHYS).body), texto(paso(b, HORNO, PHYS).body)]
    const ba = [texto(paso(b, HORNO, PHYS).body), texto(paso(a, HORNO, PHYS).body)]
    expect(ab[0]).toBe(ba[1])
    expect(ab[1]).toBe(ba[0])
    expect(ab[0]).not.toBe(ab[1])
  })
})

// ─── 4 · Un cuerpo mutado después de leerlo ──────────────────────────────────

describe('un cuerpo mutado después de leerlo', () => {
  it('mutar `state` en su lugar se ve en la lectura siguiente', () => {
    // `qualityOf` no memoiza nada por cuerpo: lee `state` cada vez. Es lo que
    // hace segura a `LecturaPerezosa`, que sí memoiza pero muere dentro de un
    // `paso()` y nunca sobrevive a un cambio del cuerpo.
    const state: QualityVector = { temperature: 10 }
    const b: Body = { id: 'mut', form: 'vara', parts: [{ substance: 'piedra', mass: 1, q: {} }], joints: [], state }
    expect(qualityOf(b, 'temperature', PHYS)).toBe(10)
    state.temperature = 500
    expect(qualityOf(b, 'temperature', PHYS)).toBe(500)
  })

  it('un paso NO puede ver una mutación posterior a su propia entrada', () => {
    // Y al revés: el resultado de `paso()` no cambia si después le mutan el
    // cuerpo de entrada. Si la `LecturaPerezosa` se filtrara fuera de `paso()`
    // —guardada en un mapa, por ejemplo— esto es lo que lo agarraría.
    const state: QualityVector = { temperature: 300, moisture: 0.1 }
    const b: Body = { id: 'mut2', form: 'vara', parts: [{ substance: 'madera', mass: 1, q: {} }], joints: [], state }
    const r1 = texto(paso(b, AIRE, PHYS).body)
    state.temperature = 300
    const r2 = texto(paso(b, AIRE, PHYS).body)
    expect(r2).toBe(r1)
    state.temperature = 900
    expect(texto(paso(b, AIRE, PHYS).body)).not.toBe(r1)
  })
})

// ─── 5 · La `Physics`: dos catálogos, la memo de una entrada ─────────────────

function conMadera(fuel: number): Physics {
  const otras = SUSTANCIAS_SEMILLA.filter((s) => s.id !== 'madera')
  const madera = SUSTANCIAS_SEMILLA.find((s) => s.id === 'madera') as Substance
  return buildSeedPhysics({
    substances: [...otras, { ...madera, perUnitMass: { ...madera.perUnitMass, fuelEnergy: fuel } }],
  })
}

describe('dos Physics con las mismas sustancias y distintos números', () => {
  const p18 = conMadera(18)
  const p2 = conMadera(2)

  it('leer el mismo cuerpo con una y con otra da lo que cada catálogo dice', () => {
    const b = cuerpo('leña', 'madera', 1)
    expect(qualityOf(b, 'fuelEnergy', p18)).toBe(18)
    expect(qualityOf(b, 'fuelEnergy', p2)).toBe(2)
  })

  it('ALTERNANDO mil veces: la memo de una entrada nunca contesta por la otra', () => {
    // Éste es el test que la memo global de `sustanciaDe` necesita. Alternar es
    // el peor caso para una caché de una entrada: cada llamada la falla. Lo que
    // importa no es que sea lenta, es que no mienta.
    const b = cuerpo('leña', 'madera', 1)
    for (let i = 0; i < 1000; i++) {
      expect(qualityOf(b, 'fuelEnergy', p18)).toBe(18)
      expect(qualityOf(b, 'fuelEnergy', p2)).toBe(2)
    }
  })

  it('los tags también, alternando: la memo por partes lleva su `Physics` adentro', () => {
    const sinTag = buildSeedPhysics({
      substances: SUSTANCIAS_SEMILLA.map((s) =>
        s.id === 'pescado' ? { ...s, tags: [] } : s,
      ),
    })
    const b = cuerpo('pez', 'pescado', 1)
    for (let i = 0; i < 200; i++) {
      expect(tagsDe(b, PHYS)).toContain('organico')
      expect(tagsDe(b, sinTag)).toEqual([])
    }
  })

  it('un paso con cada catálogo da cuerpos distintos, en cualquier orden', () => {
    const b = cuerpo('leña', 'madera', 1, { temperature: 700 })
    const a1 = texto(paso(b, AIRE, p18).body)
    const b1 = texto(paso(b, AIRE, p2).body)
    // Al revés, y desde una memo cargada con el otro catálogo.
    const b2 = texto(paso(b, AIRE, p2).body)
    const a2 = texto(paso(b, AIRE, p18).body)
    expect(a2).toBe(a1)
    expect(b2).toBe(b1)
    expect(a1).not.toBe(b1)
  })
})

// ─── 6 · La propiedad que sostiene TODAS las memos globales ──────────────────

describe('el resultado no depende de qué cuerpo se leyó justo antes', () => {
  function corpus(): Body[] {
    let s = 20260727 >>> 0
    const r = (): number => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s >>> 16
    }
    const out: Body[] = []
    for (let i = 0; i < 200; i++) {
      const nPartes = 1 + (r() % 3)
      const parts: Part[] = []
      for (let k = 0; k < nPartes; k++) {
        const q: QualityVector = {}
        if (r() % 4 === 0) q.moisture = (r() % 100) / 100
        parts.push({
          substance: SUSTANCIAS_SEMILLA[r() % SUSTANCIAS_SEMILLA.length]!.id,
          mass: 0.1 + (r() % 300) / 100,
          q,
        })
      }
      const joints = []
      for (let k = 1; k < parts.length; k++) {
        joints.push({ a: 0, b: k, via: 'liana', strength: (r() % 100) / 100 })
      }
      out.push({
        id: `c${i}`,
        form: 'vara',
        parts,
        joints,
        state: { temperature: -20 + (r() % 900), charred: (r() % 100) / 100 },
      })
    }
    return out
  }

  it('doscientos cuerpos: al derecho, al revés y salteado dan lo mismo', () => {
    // La memo de `sustanciaDe` y la de `indiceDe` son de UNA entrada y viven en el
    // módulo. Si alguna se filtrara entre cuerpos, el resultado de leer el cuerpo
    // 100 dependería de si antes se leyó el 99 o el 101. Recorrer el corpus en
    // tres órdenes distintos y exigir el mismo resultado cuerpo por cuerpo es la
    // prueba directa de que no se filtra.
    const cs = corpus()
    const derecho = new Map<string, string>()
    for (const b of cs) derecho.set(b.id, texto(paso(b, HORNO, PHYS).body))

    for (let i = cs.length - 1; i >= 0; i--) {
      const b = cs[i]!
      expect(texto(paso(b, HORNO, PHYS).body)).toBe(derecho.get(b.id))
    }
    for (let i = 0; i < cs.length; i++) {
      const b = cs[(i * 97) % cs.length]!
      expect(texto(paso(b, HORNO, PHYS).body)).toBe(derecho.get(b.id))
    }
  })

  it('y las 29 cualidades leídas, en los tres órdenes', () => {
    const cs = corpus()
    const derecho = new Map<string, string>()
    for (const b of cs) derecho.set(b.id, foto(b, PHYS).join(','))
    for (let i = cs.length - 1; i >= 0; i--) {
      const b = cs[i]!
      expect(foto(b, PHYS).join(',')).toBe(derecho.get(b.id))
    }
    // Y con una `Physics` distinta metida en el medio de cada lectura, que es lo
    // que hace la ley 4 cuando transmuta a mitad de una partida.
    const otra = conMadera(2)
    for (const b of cs) {
      foto(b, otra)
      expect(foto(b, PHYS).join(',')).toBe(derecho.get(b.id))
    }
  })

  it('una transmutación en el medio no ensucia la lectura de los demás', () => {
    // La ley 4 devuelve una sustancia nueva y el mundo arma una `Physics` nueva
    // con `conSustancia`. A partir de ahí conviven dos catálogos, y la memo de
    // una entrada se pasa la partida entera fallando entre los dos.
    const brasa = cuerpo('brasa', 'madera', 1, { temperature: 700, charred: 0.95 })
    const testigo = cuerpo('testigo', 'pescado', 2, { temperature: 20 })
    const esperado = foto(testigo, PHYS).join(',')

    let phys = PHYS
    for (let i = 0; i < 20; i++) {
      const r = paso(i === 0 ? brasa : cuerpo(`b${i}`, 'madera', 1, { temperature: 700, charred: 0.95 }), { celda: CELDA_TAPADA }, phys)
      if (r.nueva !== undefined) phys = conSustancia(phys, r.nueva)
      // El testigo no participa de nada de esto y tiene que leerse igual siempre.
      expect(foto(testigo, PHYS).join(',')).toBe(esperado)
    }
    expect(phys.substances.size).toBeGreaterThan(PHYS.substances.size)
  })
})

// ─── 7 · `recortar`, donde el «mirar antes de construir» PODRÍA haber cambiado ─

describe('`recortar` mira antes de construir, y eso no cambió nada', () => {
  // La sospecha era ésta: el `recortar` de antes armaba siempre un `state` nuevo
  // salteando las claves cuyo valor fuera `undefined`, o sea que las BORRABA de
  // paso; el de ahora mira primero y devuelve el cuerpo tal cual cuando no hay
  // nada fuera de rango. Una clave presente-pero-`undefined` no cambia ninguna
  // lectura —`qualityOf` pregunta por `!== undefined`— pero sí cambia
  // `Object.keys(state)`, y las huellas de los tests recorren las claves.
  //
  // NO ES UNA DIFERENCIA, y conviene decir por qué: el `recortar` viejo también
  // terminaba en `cambio ? {...b, state} : b`, así que cuando no había nada que
  // recortar devolvía el cuerpo intacto igual que el nuevo; y cuando SÍ había algo
  // que recortar, el bucle de construcción del nuevo tiene el mismo
  // `if (v === undefined) continue` y borra la clave igual que el viejo. Los dos
  // casos están abajo, y los dos se verificaron contra las fuentes de 11b49ae.
  //
  // Y hay una segunda razón, más fuerte que la primera: `tsconfig` tiene
  // `exactOptionalPropertyTypes: true`, así que un `QualityVector` con una clave
  // en `undefined` NO SE PUEDE ESCRIBIR — `tsc` lo rechaza. Estos dos tests tienen
  // que forzar el estado con un `as` para poder existir. O sea que el caso no es
  // solo improbable: es inexpresable en código tipado.

  /** Un estado con una clave presente y en `undefined`, que el tipo no deja escribir. */
  function conClaveVacia(base: QualityVector, clave: string): QualityVector {
    const s = { ...base } as Record<string, number | undefined>
    s[clave] = undefined
    return s as QualityVector
  }

  it('sin nada fuera de rango, la clave `undefined` sobrevive — en las dos versiones', () => {
    const b: Body = {
      id: 'u1',
      form: 'vara',
      parts: [{ substance: 'piedra', mass: 1, q: {} }],
      joints: [],
      state: conClaveVacia({ temperature: 15 }, 'decay'),
    }
    const salida = paso(b, AIRE, PHYS).body
    expect(Object.keys(salida.state).sort()).toContain('decay')
    expect(salida.state.decay).toBeUndefined()
    expect(qualityOf(salida, 'decay', PHYS)).toBe(qualityOf(b, 'decay', PHYS))
  })

  it('CON algo fuera de rango, la clave `undefined` se borra — en las dos versiones', () => {
    // Éste es el caso donde las dos implementaciones podrían haberse separado: el
    // recorte dispara, se construye un `state` nuevo, y ahí se decide si la clave
    // sobrevive. Las dos la borran.
    //
    // Hacer que el recorte dispare cuesta trabajo, y ése es el hallazgo lateral:
    // las leyes recortan lo que escriben y `qualityOf` recorta lo que devuelve, así
    // que para que quede algo fuera de rango en `state` hace falta una cualidad que
    // NINGUNA ley reescriba en este tick. `decay` sobre una piedra sirve: la ley 6
    // se va por `nutrition <= 0` sin tocar nada.
    const b: Body = {
      id: 'u2',
      form: 'vara',
      parts: [{ substance: 'piedra', mass: 1, q: {} }],
      joints: [],
      state: conClaveVacia({ temperature: 15, decay: 5 }, 'toxicity'),
    }
    const salida = paso(b, AIRE, PHYS).body
    expect(salida.state.decay).toBe(1)
    expect(Object.keys(salida.state)).not.toContain('toxicity')
  })

  it('lo fuera de rango se sigue recortando, y lo no finito se sigue poniendo en cero', () => {
    const b: Body = {
      id: 'u3',
      form: 'vara',
      parts: [{ substance: 'piedra', mass: 1, q: {} }],
      joints: [],
      state: { temperature: 15, moisture: 9, decay: Number.NaN },
    }
    const salida = paso(b, AIRE, PHYS).body
    expect(salida.state.moisture).toBeLessThanOrEqual(1)
    expect(salida.state.decay).toBe(0)
  })
})

// ─── 8 · El guardia del atajo del candado de conservación ───────────────────

describe('el atajo del candado, con una `Physics` donde una conservada ES derivada', () => {
  // `conservar` lee una sola vez cuando los dos cuerpos comparten el array de
  // partes y el mismo `state[q]`. El razonamiento vale porque una cualidad
  // GUARDADA mira exactamente esas dos cosas — y NO vale para una derivada, que
  // puede mirar las juntas, la forma o cualquier otra cualidad. `conservar` se
  // protege con `conservadasSeGuardan(phys)`, que es una `WeakMap` por `Physics`.
  //
  // El catálogo cerrado nunca entra por ese camino, así que si el guardia
  // estuviera mal escrito ningún test del árbol se enteraría. Éste entra.
  const conNutricionDerivada = buildSeedPhysics({
    qualities: PHYS.qualities.map((q) =>
      q.id === 'nutrition'
        ? {
            ...q,
            derived: {
              k: 'op' as const,
              f: '*' as const,
              a: { k: 'sumParts' as const, q: 'nutrition' as const },
              b: { k: 'const' as const, v: 1 },
            },
          }
        : q,
    ),
  })

  it('la física de prueba de verdad declara `nutrition` como derivada', () => {
    const spec = conNutricionDerivada.qualities.find((q) => q.id === 'nutrition')
    expect(spec?.derived).toBeDefined()
  })

  it('con la conservada derivada, el candado sigue sin dejar subir el total', () => {
    let b = cuerpo('d1', 'pescado', 2, { moisture: 1, temperature: 300 })
    let techo = qualityOf(b, 'nutrition', conNutricionDerivada) * qualityOf(b, 'mass', conNutricionDerivada)
    for (let i = 0; i < 40; i++) {
      b = paso(b, HORNO, conNutricionDerivada).body
      const t =
        qualityOf(b, 'nutrition', conNutricionDerivada) *
        qualityOf(b, 'mass', conNutricionDerivada)
      expect(t).toBeLessThanOrEqual(techo + 1e-9)
      techo = t
    }
  })

  it('y alternando con el catálogo cerrado, cada uno da lo suyo', () => {
    const b = cuerpo('d2', 'pescado', 2, { moisture: 1, temperature: 300 })
    const a1 = texto(paso(b, HORNO, PHYS).body)
    const c1 = texto(paso(b, HORNO, conNutricionDerivada).body)
    for (let i = 0; i < 50; i++) {
      expect(texto(paso(b, HORNO, PHYS).body)).toBe(a1)
      expect(texto(paso(b, HORNO, conNutricionDerivada).body)).toBe(c1)
    }
  })
})
