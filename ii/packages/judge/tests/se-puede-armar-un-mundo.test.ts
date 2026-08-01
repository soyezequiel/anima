/**
 * ¿SE PUEDE ARMAR UN MUNDO DONDE PROBAR ESTO? — el punto 3 del criterio.
 *
 * > un contrato **insintetizable** devuelve `injuzgable` y **no siembra
 * > regresiones**
 *
 * Y lo primero que hubo que averiguar es si «insintetizable» era una categoría
 * de verdad o una rama teórica sin ejemplo. Es de verdad, y el motivo está
 * medido acá abajo: **el catálogo tiene techos**.
 */

import { buildSeedPhysics, QUALITY_IDS, qualityOf } from '@anima/physics'
import type { Body, QualityId } from '@anima/physics'
import { INNATAS } from '@anima/skills/innatas'
import type { Contrato, Predicado } from '@anima/skills/innatas'
import { describe, expect, it } from 'vitest'
import { materiaPara, sintetizable } from '../src/sintetizar.js'
import { elPeor } from '../src/tipos.js'

const phys = buildSeedPhysics()

function contrato(nombre: string, precondiciones: readonly Predicado[]): Contrato {
  return { nombre, establece: [], precondiciones, cuesta: { segundos: 0, commitment: 'reversible' }, huecos: [] }
}

describe('las 17 innatas', () => {
  it('CUÁNTAS se pueden sintetizar, y con qué materia', () => {
    const noSePuede: string[] = []
    console.log(`\n  ── LA MATERIA QUE CADA CONTRATO NECESITA ──\n`)
    for (const c of INNATAS) {
      const s = sintetizable(c, phys)
      if (s.k === 'si') {
        const m = s.objetivo
        const dice = m.substance === '—' ? 'no pide materia (todo es del arnés)' : `${m.substance}/${m.form} × ${String(m.mass)} kg`
        console.log(`    ${c.nombre.padEnd(28)} ${dice}`)
      } else {
        noSePuede.push(c.nombre)
        console.log(`    ${c.nombre.padEnd(28)} ← INJUZGABLE · ${s.porque}`)
      }
    }
    console.log(`\n    sintetizables: ${String(INNATAS.length - noSePuede.length)} de ${String(INNATAS.length)}`)

    // Que las 17 se puedan sintetizar es el resultado, y hay que decirlo así:
    // significa que las innatas NO sirven de ejemplo de `injuzgable`. El sujeto
    // del punto 3 hay que fabricarlo, y los dos tests de abajo lo fabrican
    // apoyándose en un techo REAL del catálogo, no en un número inventado.
    expect(noSePuede).toEqual([])
  })

  it('LA CONJUNCIÓN es lo que se mide, y `unir` es el caso que la exige', () => {
    // La primera medición probó cada precondición por separado y dio 8 de 8.
    // Está mal: `unir` pide flexibility>=0.8 Y tensile>=0.3 sobre EL MISMO
    // cuerpo, y dos conjuntos no vacíos pueden no cruzarse. Acá se separa.
    const flex: Predicado = { sujeto: 'el-objetivo', q: 'flexibility', op: '>=', v: 0.8 }
    const tens: Predicado = { sujeto: 'el-objetivo', q: 'tensile', op: '>=', v: 0.3 }

    const soloFlex = materiaPara([flex], phys)
    const soloTens = materiaPara([tens], phys)
    const juntas = materiaPara([flex, tens], phys)
    console.log(`\n    flexibility>=0.8 sola     ${soloFlex?.substance ?? 'NINGUNA'}`)
    console.log(`    tensile>=0.3 sola         ${soloTens?.substance ?? 'NINGUNA'}`)
    console.log(`    LAS DOS JUNTAS            ${juntas?.substance ?? 'NINGUNA'}`)

    expect(soloFlex).toBeDefined()
    expect(soloTens).toBeDefined()
    // Y acá está el valor de la corrección: si esto fuera `undefined`, `unir`
    // sería injuzgable y la primera medición habría dicho que no.
    expect(juntas).toBeDefined()
  })
})

describe('los dos modos de ser INJUZGABLE, y son distintos', () => {
  it('(1) pide algo que NO EXISTE — el techo del catálogo', () => {
    // `toxicity` llega a 0,55 en las 30 sustancias semilla. Un contrato que pida
    // 0,6 no se puede probar en ningún mundo, y no por un error de la habilidad.
    const c = contrato('veneno-imposible', [{ sujeto: 'el-objetivo', q: 'toxicity', op: '>=', v: 0.6 }])
    const s = sintetizable(c, phys)
    console.log(`\n    ${s.k === 'no' ? s.porque : 'SE PUDO (mal)'}`)
    expect(s.k).toBe('no')
    if (s.k === 'no') expect(s.culpables).toEqual(['toxicity>=0.6'])
  })

  it('(2) pide dos cosas que existen y NO CONVIVEN', () => {
    // Las dos por separado se cumplen; juntas, no hay materia. El mensaje tiene
    // que distinguirlo del caso (1) o la fragua repara lo que no está roto.
    const seca: Predicado = { sujeto: 'el-objetivo', q: 'moisture', op: '<', v: 0.05 }
    const mojada: Predicado = { sujeto: 'el-objetivo', q: 'moisture', op: '>', v: 0.9 }
    expect(materiaPara([seca], phys), 'nada seco en el catálogo').toBeDefined()
    expect(materiaPara([mojada], phys), 'nada mojado en el catálogo').toBeDefined()

    const s = sintetizable(contrato('seca-y-mojada', [seca, mojada]), phys)
    console.log(`    ${s.k === 'no' ? s.porque : 'SE PUDO (mal)'}`)
    expect(s.k).toBe('no')
    if (s.k === 'no') expect(s.porque).toContain('JUNTAS')
  })

  it('y los dos mensajes NO son el mismo, que es para lo único que sirve la distinción', () => {
    const a = sintetizable(contrato('a', [{ sujeto: 'el-objetivo', q: 'toxicity', op: '>=', v: 0.6 }]), phys)
    const b = sintetizable(
      contrato('b', [
        { sujeto: 'el-objetivo', q: 'moisture', op: '<', v: 0.05 },
        { sujeto: 'el-objetivo', q: 'moisture', op: '>', v: 0.9 },
      ]),
      phys,
    )
    expect(a.k === 'no' && b.k === 'no' && a.porque !== b.porque).toBe(true)
  })
})

describe('EL TECHO DEL CATÁLOGO — de dónde sale que «insintetizable» exista', () => {
  it('qué alcanza un cuerpo de UNA parte, cualidad por cualidad', () => {
    // QUÉ CUALIDADES ENTRAN, y el filtro no es cosmético.
    //
    // Sólo las que la MATERIA declara: las que aparecen en el `perUnitMass` de
    // alguna sustancia, más las derivadas de ésas. Las de estado quedan afuera
    // —`temperature` y `oxygen` dan 0,000 en esta sonda porque el cuerpo nace
    // frío y `oxygen` es de la celda— y publicarlas como «techo del catálogo»
    // sería vender un límite del arnés como si fuera del mundo. El mundo las
    // sube: la ley 1 calienta.
    const declaradas = new Set<string>()
    for (const s of phys.substances.values()) for (const k of Object.keys(s.perUnitMass)) declaradas.add(k)
    const esDeLaMateria = (id: string): boolean => {
      const spec = phys.qualities.find((x) => x.id === id)
      return declaradas.has(id) || spec?.derived !== undefined
    }
    console.log(`\n  ${'cualidad'.padEnd(16)} ${'rango'.padEnd(16)} alcanzado`)
    const conTecho: string[] = []
    for (const q of QUALITY_IDS) {
      const spec = phys.qualities.find((x) => x.id === q)
      if (spec === undefined) continue
      if (!esDeLaMateria(q)) continue
      let hi = -Infinity
      for (const s of phys.substances.values()) {
        for (const form of ['vara', 'hebra', 'filete', 'malla', 'bloque', 'grano']) {
          for (const mass of [0.05, 1, 20]) {
            const b = { id: 'x', parts: [{ substance: s.id, mass, q: {} }], joints: [], state: {}, form } as unknown as Body
            let v: number
            try {
              v = qualityOf(b, q as QualityId, phys)
            } catch {
              continue
            }
            if (Number.isFinite(v) && v > hi) hi = v
          }
        }
      }
      if (!Number.isFinite(hi)) continue
      // Sólo las INTENSIVAS: las extensivas (`calories`, `mass`, `heatCapacity`)
      // no tienen techo de catálogo, tienen techo de sonda — con una pieza más
      // grande llegan más arriba, y este barrido corta en 20 kg. Meterlas acá
      // sería publicar un límite del arnés como si fuera del mundo.
      if (spec.extent !== 'intensive') continue
      const tope = spec.range[1]
      if (hi < tope * 0.995) conTecho.push(`${q}: ${hi.toFixed(3)} de ${String(tope)}`)
      console.log(`  ${q.padEnd(16)} ${`[${String(spec.range[0])}, ${String(tope)}]`.padEnd(16)} ${hi.toFixed(3)}`)
    }
    console.log(`\n  INTENSIVAS con techo por debajo de su rango: ${String(conTecho.length)}`)
    for (const x of conTecho) console.log(`    ${x}`)

    // Éste es el hallazgo que hace real al punto 3: si el catálogo llegara a
    // todo, `injuzgable` sería una rama sin ejemplo posible.
    expect(conTecho.length).toBeGreaterThan(0)
  })
})

describe('el peor de los cargos manda, y no el promedio', () => {
  it('un `uso` rojo se lleva puesto un `construccion` verde', () => {
    expect(elPeor(['promueve', 'no-promueve'])).toBe('no-promueve')
    expect(elPeor(['promueve', 'promueve'])).toBe('promueve')
    expect(elPeor(['no-promueve', 'inconcluso'])).toBe('no-promueve')
    // `injuzgable` gana sobre todo: si no se pudo armar el mundo, un verde de
    // otro cargo se midió contra otra cosa.
    expect(elPeor(['promueve', 'injuzgable', 'no-promueve'])).toBe('injuzgable')
    expect(elPeor([])).toBe('promueve')
  })
})
