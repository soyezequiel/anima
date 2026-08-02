// ─── EL VIEW MODEL DEL HITO 12A, PROBADO SIN UN PÍXEL ───────────────────────
//
// El Hito 12A pide «datos de mapa · criatura · cuerpos · objetos · relaciones ·
// obras · dispositivos · **deltas deterministas** · descriptor visual canónico ·
// `renderDescriptorHash` · fallback procedural».
//
// La mitad ya existía (`el-descriptor-visual.test.ts`, tramo D·quater). Este
// archivo mide la otra mitad, y la mide **antes** de que exista la UI por el
// mismo motivo por el que el gate exige el descriptor sin pantalla: es dato
// derivado del estado. Un view model que sólo se pueda probar mirando la pantalla
// no se prueba nunca, y para cuando la pantalla exista ya va a tener adentro tres
// decisiones que nadie midió.
//
// ─── LO QUE SE MIDE, EN CINCO BLOQUES ──────────────────────────────────────
//
//   (a) EL MAPA: las tres cualidades guardadas más `sheltered`, y las TRES CAPAS
//       —lo escrito, lo decretado, el aire libre— en el orden correcto;
//   (b) EL ENCUADRE: qué entra y qué no, y por qué el área es un cuadrado;
//   (c) LAS RELACIONES Y LA CRIATURA: las tres que el mundo guarda, y `inside`
//       ausente a propósito;
//   (d) EL ORDEN: la misma escena sale igual sin importar cómo se armó el mundo;
//   (e) LOS DELTAS, con la propiedad que los hace confiables:
//
//           aplicarDelta(a, deltaEntre(a, b))  ===  b
//
//       afirmada por HASH y no campo por campo, porque comparar campo por campo
//       se olvida del campo que alguien agregue mañana.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type Physics } from '@anima/physics'

import { keyOfCell } from '../src/cell.js'
import { crearDios, decretoDe } from '../src/dios.js'
import {
  VERSION_DE_LA_ESCENA,
  aplicarDelta,
  deltaEntre,
  escenaDe,
  escenaHash,
  type Escena,
} from '../src/escena.js'
import { drop, goTo, take } from '../src/intent.js'
import { CELDA_POR_OMISION, shelteredDe, stepWorld, type WorldState } from '../src/step.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, mundo } from './mundo-minimo.js'

const PHYS: Physics = buildSeedPhysics()
const CENTRO = { x: 0, y: 0 }

function escena(w: WorldState, radio = 2): Escena {
  return escenaDe(w, CENTRO, radio)
}

/** Una criatura en el origen con una vara al lado. Sin dios: el aire libre. */
function base(): WorldState {
  return mundo({
    phys: PHYS,
    bodies: [enElPiso(criatura('yo'), CENTRO), enElPiso(cuerpo('vara', 'madera', 0.5), { x: 1, y: 0 })],
    actors: [actor('yo', { holding: [], capacity: 4 })],
  })
}

// ─── (a) El mapa ────────────────────────────────────────────────────────────

describe('(a) el mapa: las tres guardadas más `sheltered`', () => {
  it('un mundo SIN dios da el aire libre en todas las celdas', () => {
    // La tercera capa. Sin ella, un mundo de laboratorio tendría el mapa vacío y
    // no se podría dibujar nada hasta que hubiera un dios.
    const e = escena(base())
    expect(e.celdas.length).toBe(25)
    for (const c of e.celdas) {
      expect(c.wet).toBe(CELDA_POR_OMISION.wet)
      expect(c.oxygen).toBe(CELDA_POR_OMISION.oxygen)
      expect(c.temperature).toBe(CELDA_POR_OMISION.temperature)
    }
  })

  it('lo que el mundo ESCRIBIÓ manda sobre lo demás', () => {
    // La primera capa: una fogata que secó el suelo, o el agua que alguien volcó.
    const w: WorldState = {
      ...base(),
      cells: new Map([[keyOfCell({ x: 1, y: 1 }), { wet: 0.8, oxygen: 0.5, temperature: 90 }]]),
    }
    const c = escena(w).celdas.find((x) => x.at.x === 1 && x.at.y === 1)
    expect(c?.wet).toBe(0.8)
    expect(c?.temperature).toBe(90)
    // Y no se le pega a la de al lado.
    expect(escena(w).celdas.find((x) => x.at.x === 2 && x.at.y === 1)?.wet).toBe(0)
  })

  it('y lo que el DIOS decretó, cuando el mundo no dijo nada — comparado contra el decreto', () => {
    // La segunda capa, y el control que hace que este archivo no sea un segundo
    // lector que inventa. Se lee la MISMA celda de las dos formas: por la escena y
    // por el decreto del dios, y tienen que dar el mismo número.
    //
    // Es la deuda que `celdaGuardadaEn` declara en su comentario: son dos lectores
    // de las mismas tres fuentes, y el precio se paga acá. Si algún día divergen,
    // se pone rojo en este test y no en la pantalla.
    const dios = crearDios(20260727n)
    const w: WorldState = { ...base(), dios }
    const e = escena(w, 3)
    const dec = decretoDe(dios, PHYS, 0, 0)
    let comparadas = 0
    for (const c of e.celdas) {
      if (c.at.x < 0 || c.at.y < 0) continue
      const i = c.at.y * 16 + c.at.x
      const suya = dec.celdas[i] as { wet: number; oxygen: number; temperature: number }
      expect(c.wet, `wet en ${JSON.stringify(c.at)}`).toBe(suya.wet)
      expect(c.oxygen).toBe(suya.oxygen)
      expect(c.temperature).toBe(suya.temperature)
      comparadas++
    }
    expect(comparadas, 'no se comparó ninguna celda: el barrido está mal escrito').toBeGreaterThan(10)
  })

  it('`sheltered` sale de la oclusión de verdad, no de un cero fijo', () => {
    // Es la cuarta cualidad y es DERIVADA, así que hay que probar que no es una
    // constante disfrazada. Una losa tapando algo ocluye su celda.
    const losa = cuerpo('losa', 'piedra', 5)
    const debajo = cuerpo('brasa', 'madera', 0.5)
    const w = mundo({
      phys: PHYS,
      bodies: [enElPiso(debajo, { x: 1, y: 1 }), { body: losa, at: { x: 1, y: 1 }, covering: 'brasa' }],
    })
    const c = escena(w).celdas.find((x) => x.at.x === 1 && x.at.y === 1)
    expect(c?.sheltered).toBeGreaterThan(0)
    expect(c?.sheltered).toBe(shelteredDe(w, keyOfCell({ x: 1, y: 1 })))
    // Y una celda sin nada encima sigue en cero: la oclusión no se derrama.
    expect(escena(w).celdas.find((x) => x.at.x === 2 && x.at.y === 2)?.sheltered).toBe(0)
  })
})

// ─── (b) El encuadre ────────────────────────────────────────────────────────

describe('(b) qué entra en el área visible', () => {
  it('el área es un CUADRADO, con (2·radio+1)² celdas', () => {
    // Y no un círculo, porque la distancia del mundo es Chebyshev: tocar algo es
    // estar a 1 en el máximo de las dos coordenadas. Una vista circular mostraría
    // celdas que no se pueden alcanzar y escondería celdas que sí — la forma de lo
    // que se ve tiene que ser la forma de lo que se puede hacer.
    for (const r of [0, 1, 3, 5]) {
      expect(escena(base(), r).celdas.length).toBe((2 * r + 1) * (2 * r + 1))
    }
  })

  it('un cuerpo de afuera no entra, y el de adentro sí', () => {
    const w = mundo({
      phys: PHYS,
      bodies: [enElPiso(cuerpo('cerca', 'madera', 1), { x: 2, y: 0 }), enElPiso(cuerpo('lejos', 'madera', 1), { x: 9, y: 0 })],
    })
    const e = escena(w)
    expect(e.cuerpos.has('cerca')).toBe(true)
    expect(e.cuerpos.has('lejos')).toBe(false)
  })

  it('lo que está EN LA MANO viaja con quien lo lleva', () => {
    // Un cuerpo en la mano está en la celda de su actor, así que entra o sale con
    // él. Es lo correcto y conviene afirmarlo: la alternativa —dibujarlo en la
    // celda donde lo levantaron— es un bug que sólo se ve mirando.
    const w = mundo({
      phys: PHYS,
      bodies: [enElPiso(criatura('yo'), { x: 9, y: 9 }), enLaMano(cuerpo('vara', 'madera', 1), { x: 9, y: 9 }, 'yo')],
      actors: [actor('yo', { holding: ['vara'], capacity: 4 })],
    })
    expect(escena(w).cuerpos.has('vara')).toBe(false)
    expect(escenaDe(w, { x: 9, y: 9 }, 2).cuerpos.get('vara')?.heldBy).toBe('yo')
  })
})

// ─── (c) Las relaciones y la criatura ───────────────────────────────────────

describe('(c) las tres relaciones que el mundo guarda, y ni una más', () => {
  it('`heldBy`, `supportedBy` y `covering` viajan; ausentes si no hay nada que decir', () => {
    const w = mundo({
      phys: PHYS,
      bodies: [
        enElPiso(cuerpo('fuego', 'madera', 2), CENTRO),
        { body: cuerpo('parrilla', 'piedra', 1), at: CENTRO, supportedBy: 'fuego' },
        { body: cuerpo('losa', 'piedra', 3), at: { x: 1, y: 0 }, covering: 'fuego' },
      ],
    })
    const e = escena(w)
    expect(e.cuerpos.get('parrilla')?.supportedBy).toBe('fuego')
    expect(e.cuerpos.get('losa')?.covering).toBe('fuego')
    // Y una vara suelta no lleva ninguna clave: un `undefined` explícito viajaría
    // al hash como una clave más. Misma razón que en el descriptor.
    expect(Object.keys(e.cuerpos.get('fuego') ?? {})).toEqual(['d'])
  })

  it('`inside` NO está, y es la mitad del ADR II-0002', () => {
    // El mundo evalúa `inside` como «tiene algo encima o lo sostiene alguien».
    // Publicarlo haría que la pantalla afirme una CONTENCIÓN que la física no
    // tiene: el jugador vería una jaula donde hay un estado.
    const e = escena(base())
    for (const c of e.cuerpos.values()) {
      for (const prohibida of ['inside', 'contiene', 'dentro', 'orientacion', 'sprite']) {
        expect(Object.keys(c), `apareció «${prohibida}»`).not.toContain(prohibida)
      }
    }
  })

  it('la criatura publica id, cuerpo, manos, capacidad y aliento — y NO `permits`', () => {
    // `permits` es la cuarentena de una habilidad candidata, o sea de la fragua, no
    // del mundo visible. Que no esté es una decisión, no un olvido.
    //
    // `haciendo` y `esperando` TAMPOCO están acá, y por la misma razón que una
    // vara suelta no lleva `heldBy`: sin nada que decir, la clave no viaja. Un
    // `undefined` explícito entraría al hash como una clave más.
    const e = escena(base())
    expect(e.actores.length).toBe(1)
    expect(Object.keys(e.actores[0] ?? {}).sort()).toEqual(['aliento', 'body', 'capacity', 'holding', 'id'])
  })

  it('EL ALIENTO VA EN ENTEROS, y el máximo no viaja: lo tiene el catálogo', () => {
    // Los catorce decimales de una resta de flotantes no se ven en ninguna barra,
    // y hacían que la lista de actores viajara en el 100% de los ticks porque el
    // metabolismo drena en todos. Medido en `banco-el-delta-de-actores`.
    const w = mundo({ phys: PHYS, bodies: [enElPiso(criatura('yo', 617.4), CENTRO)], actors: [actor('yo')] })
    expect(escena(w).actores[0]?.aliento).toBe(617)

    // Y el 1000 de la barra sale de acá, no de la escena: es el `range` que
    // `stamina` declara, y comer se recorta contra él.
    expect(PHYS.qualities.find((q) => q.id === 'stamina')?.range[1]).toBe(1000)
  })
})

// ─── (d) El orden ───────────────────────────────────────────────────────────

describe('(d) la misma escena sale igual sin importar cómo se armó el mundo', () => {
  it('dos mundos con los cuerpos en distinto orden dan el mismo hash', () => {
    // Sin el ordenado por id, un `Map` recorrido en orden de inserción produciría
    // dos escenas distintas del mismo mundo y `escenaHash` no significaría nada.
    const a = mundo({
      phys: PHYS,
      bodies: [enElPiso(cuerpo('z', 'madera', 1), CENTRO), enElPiso(cuerpo('a', 'madera', 1), { x: 1, y: 0 })],
    })
    const b = mundo({
      phys: PHYS,
      bodies: [enElPiso(cuerpo('a', 'madera', 1), { x: 1, y: 0 }), enElPiso(cuerpo('z', 'madera', 1), CENTRO)],
    })
    expect(escenaHash(escena(a))).toBe(escenaHash(escena(b)))
    expect([...escena(a).cuerpos.keys()]).toEqual(['a', 'z'])
  })

  it('la versión entra en el hash: dos clientes distintos no coinciden', () => {
    const e = escena(base())
    expect(e.v).toBe(VERSION_DE_LA_ESCENA)
    expect(escenaHash({ ...e, v: e.v + 1 })).not.toBe(escenaHash(e))
  })

  it('y el hash SE MUEVE cuando se mueve el mundo: no es una constante', () => {
    // El control del control. Sin esto, `escenaHash` podría devolver siempre lo
    // mismo y los dos tests de arriba pasarían igual.
    const w = base()
    const despues = stepWorld(w, [take({ by: 'yo', seq: 0 }, 'vara')]).state
    expect(escenaHash(escena(despues))).not.toBe(escenaHash(escena(w)))
  })
})

// ─── (e) Los deltas ─────────────────────────────────────────────────────────

describe('(e) los deltas: la propiedad que los hace confiables', () => {
  /** Corre `n` ticks con estas intenciones en el primero. */
  function correr(w: WorldState, is: Parameters<typeof stepWorld>[1], n: number): WorldState {
    let s = stepWorld(w, is).state
    for (let i = 1; i < n; i++) s = stepWorld(s, []).state
    return s
  }

  it('LA PROPIEDAD: `aplicarDelta(a, deltaEntre(a, b))` da exactamente `b`', () => {
    // Por HASH y no campo por campo, porque comparar campo por campo se olvida del
    // campo que alguien agregue mañana. Un delta que pierda información hace que el
    // cliente se desincronice DESPACIO: no falla, muestra un mundo cada vez más
    // viejo, y nadie sabe desde cuándo.
    const w0 = base()
    const w1 = correr(w0, [take({ by: 'yo', seq: 0 }, 'vara')], 3)
    const a = escena(w0)
    const b = escena(w1)
    expect(escenaHash(aplicarDelta(a, deltaEntre(a, b)))).toBe(escenaHash(b))
  })

  it('y vale también cuando un cuerpo ENTRA, cuando SALE y cuando CAMBIA', () => {
    const w0 = base()
    // Sale: la criatura se lleva la vara fuera del encuadre.
    const conVara = stepWorld(w0, [take({ by: 'yo', seq: 0 }, 'vara')]).state
    let lejos = conVara
    for (let t = 0; t < 20; t++) lejos = stepWorld(lejos, [goTo({ by: 'yo', seq: t }, { x: 12, y: 0 }, 0)]).state
    // Entra: vuelve y la suelta.
    let vuelve = lejos
    for (let t = 0; t < 30; t++) vuelve = stepWorld(vuelve, [goTo({ by: 'yo', seq: t }, CENTRO, 0)]).state
    const soltada = stepWorld(vuelve, [drop({ by: 'yo', seq: 0 }, 'vara')]).state

    const pasos = [w0, conVara, lejos, vuelve, soltada].map((w) => escena(w))
    const cuentas: string[] = []
    for (let i = 1; i < pasos.length; i++) {
      const a = pasos[i - 1] as Escena
      const b = pasos[i] as Escena
      const d = deltaEntre(a, b)
      cuentas.push(
        `  t${String(a.tick)}→t${String(b.tick)}: +${String(d.entraron.length)} −${String(d.salieron.length)} ` +
          `~${String(d.cambiaron.length)} · celdas ${String(d.celdas.length)}/${String(b.celdas.length)}`,
      )
      expect(escenaHash(aplicarDelta(a, d)), `el paso ${String(i)} no reconstruye`).toBe(escenaHash(b))
    }
    console.log(`\n─── LOS DELTAS DE LA HISTORIA ───\n${cuentas.join('\n')}\n`)

    // Y el control de que los tres casos ocurrieron de verdad, no que la propiedad
    // valga porque nunca pasó nada.
    const todos = pasos.slice(1).map((b, i) => deltaEntre(pasos[i] as Escena, b))
    expect(todos.some((d) => d.salieron.length > 0), 'ningún cuerpo salió del encuadre').toBe(true)
    expect(todos.some((d) => d.entraron.length > 0), 'ningún cuerpo entró al encuadre').toBe(true)
  })

  it('un delta contra el MISMO estado está vacío, y no manda las 25 celdas', () => {
    // La mitad que justifica que los deltas existan: en un cuadro donde no pasó
    // nada, no viaja nada. Si viajaran las celdas iguales, el delta pesaría lo
    // mismo que la escena y no serviría para nada.
    const a = escena(base())
    const d = deltaEntre(a, escena(base()))
    expect(d.entraron).toEqual([])
    expect(d.salieron).toEqual([])
    expect(d.cambiaron).toEqual([])
    expect(d.celdas).toEqual([])
    expect(d.actores).toBeUndefined()
  })

  it('y NO se pueden diferenciar dos escenas de distinto encuadre', () => {
    // Devolver un delta vacío sería devolver basura, y un delta vacío es
    // indistinguible de «no pasó nada»: el cliente se quedaría con la grilla vieja
    // creyendo que está al día.
    const w = base()
    expect(() => deltaEntre(escenaDe(w, CENTRO, 2), escenaDe(w, CENTRO, 3))).toThrow(/encuadre/)
    expect(() => deltaEntre(escenaDe(w, CENTRO, 2), escenaDe(w, { x: 5, y: 5 }, 2))).toThrow(/encuadre/)
  })

  it('el orden de los cuerpos sobrevive al delta: reconstruir no los deja al final', () => {
    // El bug que `aplicarDelta` reordena a propósito: un cuerpo que ENTRA quedaría
    // último en el `Map` heredado, y dos clientes que llegaron al mismo estado por
    // caminos distintos hashearían distinto. Eso es exactamente lo que un delta no
    // puede hacer.
    const w0 = mundo({ phys: PHYS, bodies: [enElPiso(cuerpo('z', 'madera', 1), CENTRO)] })
    const w1 = mundo({
      phys: PHYS,
      bodies: [enElPiso(cuerpo('z', 'madera', 1), CENTRO), enElPiso(cuerpo('a', 'madera', 1), { x: 1, y: 0 })],
    })
    const a = escena(w0)
    const b = escena(w1)
    const reconstruida = aplicarDelta(a, deltaEntre(a, b))
    expect([...reconstruida.cuerpos.keys()]).toEqual(['a', 'z'])
    expect(escenaHash(reconstruida)).toBe(escenaHash(b))
  })
})
