// Un arnés que nunca salta no es un arnés: es una función que devuelve la lista
// vacía. Cada test de acá ROMPE a propósito una de las cinco preguntas y verifica
// que la violación aparece, con su nombre; y al final hay uno que verifica lo
// contrario —que una partida honesta no dispara ninguna—, porque un invariante
// que salta con todo tampoco sirve para nada.

import { describe, expect, it } from 'vitest'
import { CONSERVED, qualityOf } from '@anima/physics'
import { apply, eat, goTo, take } from '../src/intent.js'
import type { WorldState } from '../src/step.js'
import { mapaDeCuerpos, stepWorld } from '../src/step.js'
import {
  exigirInvariantes,
  InvariantError,
  revisarEstado,
  revisarInvariantes,
  totales,
} from '../src/invariants.js'
import {
  actor,
  criatura,
  cuerpo,
  enElPiso,
  enLaMano,
  intencionesAlAzar,
  lcg,
  mundo,
} from './mundo-minimo.js'

const EN = (x: number, y: number) => ({ x, y })
const clases = (s: WorldState): string[] => revisarEstado(s).map((v) => v.k)

describe('la forma canónica', () => {
  it('un mapa de cuerpos fuera de orden es una violación', () => {
    const s = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 1), EN(0, 0))] })
    const desordenado: WorldState = {
      ...s,
      bodies: new Map([
        ['z', { body: cuerpo('z', 'madera', 1), at: EN(5, 0) }],
        ['a', { body: cuerpo('a', 'madera', 1), at: EN(0, 0) }],
      ]),
    }
    expect(clases(desordenado)).toContain('orden-no-canonico')
    // Y el mismo contenido, ordenado, no lo es. La violación es del ORDEN.
    expect(clases({ ...desordenado, bodies: mapaDeCuerpos([...desordenado.bodies.values()]) })).toEqual(
      [],
    )
  })
})

describe('el espacio', () => {
  it('una posición fraccionaria no existe', () => {
    const s = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 1), { x: 0.5, y: 0 })] })
    expect(clases(s)).toContain('posicion-invalida')
  })

  it('dos sólidos no comparten celda', () => {
    const s = mundo({
      bodies: [
        enElPiso(cuerpo('a', 'madera', 1), EN(0, 0)),
        enElPiso(cuerpo('b', 'piedra', 1), EN(0, 0)),
      ],
    })
    expect(clases(s)).toContain('solidos-solapados')
  })

  it('salvo que uno esté apoyado sobre el otro: la parrilla existe', () => {
    const s = mundo({
      bodies: [
        enElPiso(cuerpo('a', 'madera', 1), EN(0, 0)),
        { body: cuerpo('b', 'piedra', 1), at: EN(0, 0), supportedBy: 'a' },
      ],
    })
    expect(clases(s)).toEqual([])
  })

  it('o tapándolo: la losa sobre la fogata tampoco es un solapamiento', () => {
    const s = mundo({
      bodies: [
        enElPiso(cuerpo('a', 'madera', 1), EN(0, 0)),
        { body: cuerpo('b', 'piedra', 1), at: EN(0, 0), covering: 'a' },
      ],
    })
    expect(clases(s)).toEqual([])
  })

  it('un apoyo que no apunta a nada es una violación', () => {
    const s = mundo({
      bodies: [{ body: cuerpo('a', 'madera', 1), at: EN(0, 0), supportedBy: 'fantasma' }],
    })
    expect(clases(s)).toContain('referencia-colgada')
  })

  it('y un ciclo de apoyos también, en vez de colgar el tick', () => {
    const s = mundo({
      bodies: [
        { body: cuerpo('a', 'madera', 1), at: EN(0, 0), supportedBy: 'b' },
        { body: cuerpo('b', 'madera', 1), at: EN(0, 0), supportedBy: 'a' },
      ],
    })
    expect(clases(s)).toContain('apoyo-circular')
  })
})

describe('los inventarios cierran por los dos lados', () => {
  it('lo que el actor dice tener tiene que existir', () => {
    const s = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0))],
      actors: [actor('ana', { holding: ['fantasma'] })],
    })
    expect(clases(s)).toContain('inventario-inconsistente')
  })

  it('y el cuerpo tiene que saberlo', () => {
    const s = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('c', 'liana', 0.4), EN(0, 0))],
      actors: [actor('ana', { holding: ['c'] })],
    })
    expect(clases(s)).toContain('inventario-inconsistente')
  })

  it('un cuerpo en una mano que no lo tiene es materia que se evaporó', () => {
    // El bug caro: no está en el piso ni en el inventario. No se ve en pantalla.
    const s = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enLaMano(cuerpo('c', 'liana', 0.4), EN(0, 0), 'ana')],
      actors: [actor('ana')],
    })
    expect(clases(s)).toContain('inventario-inconsistente')
  })

  it('dos actores no tienen el mismo cuerpo en la mano', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(criatura('beto'), EN(1, 0)),
        enLaMano(cuerpo('c', 'liana', 0.4), EN(0, 0), 'ana'),
      ],
      actors: [actor('ana', { holding: ['c'] }), actor('beto', { holding: ['c'] })],
    })
    expect(clases(s)).toContain('inventario-inconsistente')
  })

  it('nadie se lleva a sí misma en la mano', () => {
    const s = mundo({
      bodies: [enLaMano(criatura('ana'), EN(0, 0), 'ana')],
      actors: [actor('ana', { holding: ['ana-cuerpo'] })],
    })
    expect(clases(s)).toContain('inventario-inconsistente')
  })
})

describe('las cualidades guardadas', () => {
  it('fuera de su rango declarado, es una violación', () => {
    const s = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 1, { moisture: 4 }), EN(0, 0))] })
    expect(clases(s)).toContain('cualidad-fuera-de-rango')
  })

  it('un NaN también', () => {
    const s = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 1, { moisture: NaN }), EN(0, 0))] })
    expect(clases(s)).toContain('cualidad-fuera-de-rango')
  })

  it('una derivada guardada es un dato que va a quedar viejo', () => {
    // `qualityOf` calcula `heatCapacity` y no mira `state`, así que este número
    // no cambia nada... salvo para el snapshot, el hash y el juez, que leen el
    // dato crudo. Es la misma clase de bug que `isDerived` cerró en la física.
    const s = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 1, { heatCapacity: 99 }), EN(0, 0))] })
    expect(clases(s)).toContain('cualidad-derivada-guardada')
  })
})

describe('ninguna cuenta conservada sube', () => {
  it('inventar masa entre dos estados salta', () => {
    const antes = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 1), EN(0, 0))] })
    const despues = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 2), EN(0, 0))], tick: 1 })
    const v = revisarInvariantes(antes, despues)
    expect(v.map((x) => x.k)).toContain('conservada-aumento')
  })

  it('perderla no', () => {
    const antes = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 2), EN(0, 0))] })
    const despues = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 1), EN(0, 0))], tick: 1 })
    expect(revisarInvariantes(antes, despues)).toEqual([])
  })

  it('comer sube la stamina, y está bien, porque la conversión está declarada', () => {
    const s = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('c2', 'pescado', 1), EN(0, 1))],
      actors: [actor('ana')],
    })
    const r = stepWorld(s, [eat({ by: 'ana', seq: 0 }, 'c2')])
    const st = (w: WorldState): number =>
      qualityOf(w.bodies.get('ana-cuerpo')!.body, 'stamina', w.phys)
    expect(st(r.state)).toBeGreaterThan(st(s))
    expect(revisarInvariantes(s, r.state, r.events)).toEqual([])
  })

  it('pero la misma subida SIN el evento de conversión es materia inventada', () => {
    const s = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('c2', 'pescado', 1), EN(0, 1))],
      actors: [actor('ana')],
    })
    const r = stepWorld(s, [eat({ by: 'ana', seq: 0 }, 'c2')])
    const sinDeclarar = r.events.filter((e) => e.k !== 'convierte')
    expect(revisarInvariantes(s, r.state, sinDeclarar).map((x) => x.k)).toContain(
      'conservada-aumento',
    )
  })

  it('una conversión con eficiencia mayor que 1 se rechaza aunque esté declarada', () => {
    const antes = mundo({ bodies: [enElPiso(criatura('ana'), EN(0, 0))] })
    const v = revisarInvariantes(antes, { ...antes, tick: 1 }, [
      { k: 'convierte', by: 'ana', de: 'nutrition', a: 'stamina', gastado: 1, acreditado: 5 },
    ])
    expect(v.map((x) => x.k)).toContain('conversion-sin-respaldo')
  })

  it('los totales se suman en orden canónico y las cuatro cuentas están', () => {
    const s = mundo({
      bodies: [
        enElPiso(cuerpo('b', 'madera', 1), EN(0, 0)),
        enElPiso(cuerpo('a', 'pescado', 1), EN(1, 0)),
      ],
    })
    const t = totales(s)
    for (const q of CONSERVED) expect(t.has(q)).toBe(true)
    expect(t.get('mass')).toBeCloseTo(2, 12)
  })
})

describe('exigir lanza', () => {
  it('con el tick adentro del mensaje', () => {
    const antes = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 1), EN(0, 0))] })
    const despues = mundo({ bodies: [enElPiso(cuerpo('a', 'madera', 9), EN(0, 0))], tick: 7 })
    expect(() => exigirInvariantes(antes, despues)).toThrow(InvariantError)
    try {
      exigirInvariantes(antes, despues)
    } catch (e) {
      expect((e as InvariantError).message).toContain('tick 7')
      expect((e as InvariantError).violaciones.length).toBeGreaterThan(0)
    }
  })

  it('y no lanza cuando el mundo se porta bien', () => {
    const s = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('c', 'liana', 0.4), EN(1, 0))],
      actors: [actor('ana')],
    })
    const r = stepWorld(s, [take({ by: 'ana', seq: 0 }, 'c')])
    expect(() => exigirInvariantes(s, r.state, r.events)).not.toThrow()
  })
})

describe('el arnés puesto sobre una partida entera', () => {
  it('mil ticks de intenciones arbitrarias sin romper un solo invariante', () => {
    // Éste es el test que justifica todos los de arriba: la mitad de las
    // intenciones son basura —cuerpos que no existen, compromisos mal
    // declarados—, y ninguna deja el mundo en un estado imposible.
    const r = lcg(20260727)
    let s = mundo({
      bodies: [
        enElPiso(criatura('ana', 500), EN(0, 0)),
        enElPiso(criatura('beto', 500), EN(4, 4)),
        enElPiso(cuerpo('c0', 'madera', 1), EN(2, 0)),
        enElPiso(cuerpo('c1', 'liana', 0.4), EN(0, 2)),
        enElPiso(cuerpo('c2', 'pescado', 1), EN(2, 2)),
        enElPiso(cuerpo('c3', 'corteza', 1), EN(-2, 1)),
        enElPiso(cuerpo('c4', 'hoja', 0.3), EN(1, -2)),
        enElPiso(cuerpo('c5', 'piedra', 2), EN(-3, -3)),
      ],
      actors: [actor('ana', { capacity: 3 }), actor('beto', { capacity: 3 })],
    })
    const vistos = new Set<string>()
    for (let t = 0; t < 1000; t++) {
      const paso = stepWorld(s, intencionesAlAzar(r, ['ana', 'beto'], 3))
      const v = revisarInvariantes(s, paso.state, paso.events)
      if (v.length > 0) throw new InvariantError(paso.state.tick, v)
      for (const e of paso.events) vistos.add(e.k)
      s = paso.state
    }
    expect(s.tick).toBe(1000)
    // Y el barrido tiene que haber PASADO por los caminos caros, o no probó nada:
    // un arnés sobre mil ticks de intenciones todas rechazadas es un arnés sobre
    // nada.
    for (const k of ['rechazada', 'movio', 'tomo', 'solto', 'comio', 'convierte', 'proceso', 'murio']) {
      expect([...vistos]).toContain(k)
    }
    // `nacio` NO está en la lista, y el porqué es un hallazgo del propio barrido:
    // una conducta al azar **nunca completa un proceso**. `union` pide veinte
    // ticks seguidos con los mismos cuerpos en los mismos roles, y quien elige al
    // azar cambia de idea al segundo. Los rendimientos se prueban con intención,
    // en el test de acá abajo, y no confiando en que el ruido pase por ahí.
    expect(vistos.has('nacio')).toBe(false)
  })

  it('armar una caña, con el arnés puesto en cada uno de los veinte ticks', () => {
    // El camino más caro del mundo: `join` consume tres cuerpos, crea uno, y lo
    // tiene que meter en una mano que acaba de quedar libre. Es donde más fácil
    // se inventa o se pierde materia.
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana', 500), EN(0, 0)),
        enLaMano(cuerpo('vara', 'madera', 1), EN(0, 0), 'ana'),
        enLaMano(cuerpo('hebra', 'liana', 0.3), EN(0, 0), 'ana'),
      ],
      actors: [actor('ana', { holding: ['vara', 'hebra'], capacity: 3 })],
    })
    const at = s.phys.processes.get('union')!.completion!.at
    let w = s
    let nacio: string | undefined
    for (let t = 0; t < at; t++) {
      const i = apply({ by: 'ana', seq: t }, w.phys, 'union', [
        { name: 'a', body: 'vara' },
        { name: 'binder', body: 'hebra' },
      ])!
      const paso = stepWorld(w, [i])
      expect(revisarInvariantes(w, paso.state, paso.events)).toEqual([])
      for (const e of paso.events) if (e.k === 'nacio') nacio = e.id
      w = paso.state
    }
    expect(nacio).toBeDefined()
    // Sin `b`, el atador SOBREVIVE como parte y le queda una punta suelta: eso es
    // `freeStrandEnds`, y `freeStrandEnds` es lo único que da `catch`. O sea que
    // esto es la caña, y nadie escribió la palabra.
    const cana = w.bodies.get(nacio!)!
    expect(cana.heldBy).toBe('ana')
    expect(qualityOf(cana.body, 'catch', w.phys)).toBeGreaterThan(0)
    expect(cana.body.madeBy).toBe('ana')
    // Y las tres piezas dejaron de existir por separado.
    expect(w.bodies.has('vara')).toBe(false)
    expect(w.bodies.has('hebra')).toBe(false)
  })

  it('y con `goTo` a la misma celda mil veces, tampoco', () => {
    let s = mundo({
      bodies: [enElPiso(criatura('ana', 500), EN(0, 0)), enElPiso(cuerpo('c0', 'madera', 1), EN(3, 3))],
      actors: [actor('ana')],
    })
    for (let t = 0; t < 200; t++) {
      const paso = stepWorld(s, [goTo({ by: 'ana', seq: 0 }, EN(3, 3))])
      expect(revisarInvariantes(s, paso.state, paso.events)).toEqual([])
      s = paso.state
    }
  })
})
