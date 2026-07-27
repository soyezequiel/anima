// Lo que este archivo cuida no es que la criatura camine: cuida que el paso del
// mundo sea PURO, que el orden en que juzga las intenciones no dependa de nada
// que no sea el id del actor, y que el compromiso lo decida el mundo y no quien
// escribió la habilidad.

import { describe, expect, it } from 'vitest'
import { dtDeFrecuencia, OXIGENO_QUE_HACE_CENIZA, qualityOf } from '@anima/physics'
import type { Intent } from '../src/intent.js'
import { apply, drop, eat, goTo, put, take, wait } from '../src/intent.js'
import { keyOfCell } from '../src/cell.js'
import type { SimEvent, WorldState } from '../src/step.js'
import { COSTO_POR_CELDA, OCLUSION_CORTA_OXIGENO, shelteredDe, stepWorld } from '../src/step.js'
import { revisarInvariantes } from '../src/invariants.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, huella, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number) => ({ x, y })

function base(): WorldState {
  return mundo({
    bodies: [
      enElPiso(criatura('ana'), EN(0, 0)),
      enElPiso(cuerpo('c0', 'madera', 1), EN(3, 0)),
      enElPiso(cuerpo('c1', 'liana', 0.4), EN(1, 0)),
      enElPiso(cuerpo('c2', 'pescado', 1), EN(0, 1)),
    ],
    actors: [actor('ana')],
  })
}

function motivos(events: readonly SimEvent[]): string[] {
  return events.filter((e) => e.k === 'rechazada').map((e) => e.por)
}

describe('el paso es puro', () => {
  it('no toca el estado que le dan', () => {
    const s = base()
    const antes = huella(s)
    const tamaños = [s.bodies.size, s.actors.size]
    stepWorld(s, [goTo({ by: 'ana', seq: 0 }, EN(3, 0))])
    expect(huella(s)).toBe(antes)
    expect([s.bodies.size, s.actors.size]).toEqual(tamaños)
  })

  it('dos corridas del mismo tick dan el mismo estado', () => {
    const s = base()
    const is = [goTo({ by: 'ana', seq: 0 }, EN(3, 0))]
    expect(huella(stepWorld(s, is).state)).toBe(huella(stepWorld(s, is).state))
  })

  it('el tick avanza de a uno', () => {
    expect(stepWorld(base(), []).state.tick).toBe(1)
  })
})

describe('el orden total', () => {
  it('no depende del orden en que llegaron las intenciones', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(criatura('beto'), EN(2, 2)),
        enElPiso(cuerpo('c0', 'madera', 1), EN(1, 1)),
      ],
      actors: [actor('ana'), actor('beto')],
    })
    // Las dos quieren la misma madera. Gane quien gane, tiene que ganar siempre
    // la misma, y no la que su mente contestó primero.
    const a = take({ by: 'ana', seq: 0 }, 'c0')
    const b = take({ by: 'beto', seq: 0 }, 'c0')
    const uno = stepWorld(s, [a, b])
    const otro = stepWorld(s, [b, a])
    expect(huella(uno.state)).toBe(huella(otro.state))
    // Y gana `ana`, porque 'ana' < 'beto' por unidad de código. No es justicia:
    // es lo único estable que hay.
    expect(uno.state.actors.get('ana')?.holding).toEqual(['c0'])
    expect(uno.state.actors.get('beto')?.holding).toEqual([])
  })

  it('dos intenciones del mismo actor con el mismo seq se rechazan las dos', () => {
    const r = stepWorld(base(), [
      wait({ by: 'ana', seq: 0 }, 1),
      goTo({ by: 'ana', seq: 0 }, EN(3, 0)),
    ])
    expect(motivos(r.events)).toEqual(['orden-duplicado', 'orden-duplicado'])
  })

  it('un actor actúa una vez por tick', () => {
    const r = stepWorld(base(), [
      goTo({ by: 'ana', seq: 0 }, EN(3, 0)),
      goTo({ by: 'ana', seq: 1 }, EN(0, 3)),
    ])
    expect(motivos(r.events)).toEqual(['ya-actuo'])
  })
})

describe('el compromiso lo verifica el mundo', () => {
  it('una intención que miente sobre su compromiso se rechaza', () => {
    // `eat` es irreversible. Declararla reversible es lo que haría una candidata
    // que solo pasó el smoke test para colarse por el portón.
    const mentira = { ...eat({ by: 'ana', seq: 0 }, 'c2'), commitment: 'reversible' } as Intent
    const r = stepWorld(base(), [mentira])
    expect(motivos(r.events)).toEqual(['compromiso-mal-declarado'])
    expect(r.state.bodies.has('c2')).toBe(true)
  })

  it('un actor con permiso reversible no puede comer', () => {
    const s = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('c2', 'pescado', 1), EN(0, 1))],
      actors: [actor('ana', { permits: 'reversible' })],
    })
    const r = stepWorld(s, [eat({ by: 'ana', seq: 0 }, 'c2')])
    expect(motivos(r.events)).toEqual(['sin-permiso'])
  })

  it('pero sí puede caminar', () => {
    const s = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0))],
      actors: [actor('ana', { permits: 'reversible' })],
    })
    const r = stepWorld(s, [goTo({ by: 'ana', seq: 0 }, EN(3, 0))])
    expect(motivos(r.events)).toEqual([])
  })

  it('el compromiso de `apply` sale del catálogo, no de la tabla del mundo', () => {
    const s = base()
    const i = apply({ by: 'ana', seq: 0 }, s.phys, 'deshilachar', [])
    // `deshilachar` es `costly` en `process.ts`. Si alguien lo cambia allá, esto
    // cambia solo: no hay una segunda copia del número.
    expect(i?.commitment).toBe(s.phys.processes.get('deshilachar')?.commitment)
    expect(apply({ by: 'ana', seq: 0 }, s.phys, 'inventado', [])).toBeUndefined()
  })
})

describe('moverse', () => {
  it('un paso por tick, en diagonal cuando conviene', () => {
    const r = stepWorld(base(), [goTo({ by: 'ana', seq: 0 }, EN(3, 3))])
    expect(r.state.bodies.get('ana-cuerpo')?.at).toEqual(EN(1, 1))
  })

  it('caminar cuesta stamina', () => {
    const s = base()
    const antes = qualityOf(s.bodies.get('ana-cuerpo')!.body, 'stamina', s.phys)
    const r = stepWorld(s, [goTo({ by: 'ana', seq: 0 }, EN(3, 0))])
    const despues = qualityOf(r.state.bodies.get('ana-cuerpo')!.body, 'stamina', r.state.phys)
    expect(antes - despues).toBeGreaterThanOrEqual(COSTO_POR_CELDA)
  })

  it('sin fuerza no se camina', () => {
    const s = mundo({
      bodies: [enElPiso(criatura('ana', 0), EN(0, 0))],
      actors: [actor('ana')],
    })
    expect(motivos(stepWorld(s, [goTo({ by: 'ana', seq: 0 }, EN(3, 0))]).events)).toEqual([
      'sin-fuerza',
    ])
  })

  it('lo que lleva en la mano viaja con ella', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enLaMano(cuerpo('c1', 'liana', 0.4), EN(0, 0), 'ana'),
      ],
      actors: [actor('ana', { holding: ['c1'] })],
    })
    const r = stepWorld(s, [goTo({ by: 'ana', seq: 0 }, EN(4, 0))])
    expect(r.state.bodies.get('c1')?.at).toEqual(EN(1, 0))
  })
})

describe('tomar, soltar y poner', () => {
  it('tomar lo que está a mano', () => {
    const r = stepWorld(base(), [take({ by: 'ana', seq: 0 }, 'c1')])
    expect(r.state.actors.get('ana')?.holding).toEqual(['c1'])
    expect(r.state.bodies.get('c1')?.heldBy).toBe('ana')
  })

  it('no lo que está lejos', () => {
    expect(motivos(stepWorld(base(), [take({ by: 'ana', seq: 0 }, 'c0')]).events)).toEqual([
      'no-esta-a-mano',
    ])
  })

  it('no lo que no se puede levantar', () => {
    const s = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('roca', 'piedra', 400), EN(1, 0))],
      actors: [actor('ana')],
    })
    expect(motivos(stepWorld(s, [take({ by: 'ana', seq: 0 }, 'roca')]).events)).toEqual([
      'no-portable',
    ])
  })

  it('con las manos llenas, no', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enLaMano(cuerpo('c1', 'liana', 0.4), EN(0, 0), 'ana'),
        enElPiso(cuerpo('c3', 'liana', 0.4), EN(1, 0)),
      ],
      actors: [actor('ana', { holding: ['c1'], capacity: 1 })],
    })
    expect(motivos(stepWorld(s, [take({ by: 'ana', seq: 0 }, 'c3')]).events)).toEqual(['manos-llenas'])
  })

  it('soltar deja el cuerpo A LOS PIES, no encima: la celda la ocupa ella', () => {
    // Lo encontró el arnés de invariantes en el tick 116 de una partida al azar:
    // soltar en la propia celda dejaba a la criatura solapada con lo que soltó.
    // Dos sólidos no comparten celda, y la criatura es un sólido.
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(2, 2)),
        enLaMano(cuerpo('c1', 'liana', 0.4), EN(2, 2), 'ana'),
      ],
      actors: [actor('ana', { holding: ['c1'] })],
    })
    const r = stepWorld(s, [drop({ by: 'ana', seq: 0 }, 'c1')])
    const donde = r.state.bodies.get('c1')!.at
    expect(donde).not.toEqual(EN(2, 2))
    expect(Math.abs(donde.x - 2) <= 1 && Math.abs(donde.y - 2) <= 1).toBe(true)
    expect(r.state.bodies.get('c1')?.heldBy).toBeUndefined()
    expect(r.state.actors.get('ana')?.holding).toEqual([])
    expect(revisarInvariantes(s, r.state, r.events)).toEqual([])
  })

  it('poner sobre un sólido exige decir sobre qué se apoya', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enLaMano(cuerpo('c1', 'liana', 0.4), EN(0, 0), 'ana'),
        enElPiso(cuerpo('c0', 'madera', 1), EN(1, 0)),
      ],
      actors: [actor('ana', { holding: ['c1'] })],
    })
    expect(motivos(stepWorld(s, [put({ by: 'ana', seq: 0 }, 'c1', EN(1, 0))]).events)).toEqual([
      'celda-ocupada',
    ])
    const r = stepWorld(s, [put({ by: 'ana', seq: 0 }, 'c1', EN(1, 0), { onTopOf: 'c0' })])
    expect(motivos(r.events)).toEqual([])
    expect(r.state.bodies.get('c1')?.supportedBy).toBe('c0')
  })

  it('levantar algo borra las relaciones que apuntaban a él', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(cuerpo('c0', 'madera', 1), EN(1, 0)),
        { body: cuerpo('c1', 'liana', 0.4), at: EN(1, 0), supportedBy: 'c0' },
      ],
      actors: [actor('ana')],
    })
    const r = stepWorld(s, [take({ by: 'ana', seq: 0 }, 'c0')])
    expect(r.state.bodies.get('c1')?.supportedBy).toBeUndefined()
  })
})

describe('comer, que es la única conversión', () => {
  it('convierte nutrición en fuerza y destruye la comida', () => {
    const s = base()
    const antes = qualityOf(s.bodies.get('ana-cuerpo')!.body, 'stamina', s.phys)
    const r = stepWorld(s, [eat({ by: 'ana', seq: 0 }, 'c2')])
    expect(r.state.bodies.has('c2')).toBe(false)
    const despues = qualityOf(r.state.bodies.get('ana-cuerpo')!.body, 'stamina', r.state.phys)
    expect(despues).toBeGreaterThan(antes)
    const conv = r.events.find((e) => e.k === 'convierte')
    expect(conv).toBeDefined()
    // La eficiencia ES la digestibilidad, y por eso cocinar rinde más sin que
    // nadie escriba «cocinar rinde más».
    if (conv?.k === 'convierte') expect(conv.acreditado).toBeLessThan(conv.gastado)
  })

  it('lo cocido rinde más que lo crudo, y nadie escribió cocinar', () => {
    const crudo = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('c2', 'pescado', 1), EN(0, 1))],
      actors: [actor('ana')],
    })
    const cocido = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(cuerpo('c2', 'pescado', 1, { digestibility: 0.9 }), EN(0, 1)),
      ],
      actors: [actor('ana')],
    })
    const cal = (s: WorldState): number => {
      const e = stepWorld(s, [eat({ by: 'ana', seq: 0 }, 'c2')]).events.find((x) => x.k === 'comio')
      return e?.k === 'comio' ? e.calorias : 0
    }
    expect(cal(cocido)).toBeGreaterThan(cal(crudo))
  })
})

describe('las doce leyes corren acá', () => {
  it('un cuerpo caliente se enfría solo, sin que nadie lo pida', () => {
    const s = mundo({ bodies: [enElPiso(cuerpo('c0', 'piedra', 1, { temperature: 300 }), EN(0, 0))] })
    const r = stepWorld(s, [])
    const t = qualityOf(r.state.bodies.get('c0')!.body, 'temperature', r.state.phys)
    expect(t).toBeLessThan(300)
  })

  it('tapar baja el oxígeno de la celda por debajo del umbral del carbón', () => {
    // La técnica emblema de toda la arquitectura, y no aparece la palabra
    // «carbón» en ninguna parte: hay una losa encima y un número que baja.
    //
    // El 0.35 es `OXIGENO_QUE_HACE_CENIZA` de la física, la única línea que
    // separa las dos técnicas. Que la celda tapada quede DEBAJO no es una
    // coincidencia: `OCLUSION_CORTA_OXIGENO` está calibrado contra
    // `CELDA_TAPADA.oxygen`, que la física ya publicaba.
    const tapado = mundo({
      bodies: [
        enElPiso(cuerpo('fuego', 'madera', 2, { temperature: 400 }), EN(0, 0)),
        { body: cuerpo('losa', 'piedra', 3), at: EN(0, 0), covering: 'fuego' },
      ],
    })
    const abierto = mundo({
      bodies: [enElPiso(cuerpo('fuego', 'madera', 2, { temperature: 400 }), EN(0, 0))],
    })
    const sTapado = shelteredDe(tapado, keyOfCell(EN(0, 0)))
    expect(sTapado).toBeGreaterThan(0.9)
    expect(1 * (1 - sTapado * OCLUSION_CORTA_OXIGENO)).toBeLessThan(OXIGENO_QUE_HACE_CENIZA)
    expect(shelteredDe(abierto, keyOfCell(EN(0, 0)))).toBe(0)

    // Y se ve en el tick: con menos aire, la llama se lleva menos combustible.
    const fuel = (s: WorldState): number => {
      const r = stepWorld(s, [])
      return qualityOf(r.state.bodies.get('fuego')!.body, 'fuelEnergy', r.state.phys)
    }
    expect(fuel(tapado)).toBeGreaterThan(fuel(abierto))
  })

  it('una hoja tapa menos que una losa, y por eso tejer va a valer la pena', () => {
    const con = (sustancia: string): number => {
      const s = mundo({
        bodies: [
          enElPiso(cuerpo('fuego', 'madera', 2, { temperature: 400 }), EN(0, 0)),
          { body: cuerpo('tapa', sustancia, 1), at: EN(0, 0), covering: 'fuego' },
        ],
      })
      return shelteredDe(s, keyOfCell(EN(0, 0)))
    }
    expect(con('piedra')).toBeGreaterThan(con('hoja'))
  })
})

describe('aplicar un proceso', () => {
  it('acumula ticks mientras se repita, y se reinicia si se cambia de cuerpo', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enLaMano(cuerpo('c1', 'liana', 0.4), EN(0, 0), 'ana'),
        enLaMano(cuerpo('c3', 'liana', 0.4), EN(0, 0), 'ana'),
      ],
      actors: [actor('ana', { holding: ['c1', 'c3'], capacity: 4 })],
    })
    const conC1 = (seq: number): Intent =>
      apply({ by: 'ana', seq }, s.phys, 'deshilachar', [
        { name: 'actor', body: 'ana-cuerpo' },
        { name: 'source', body: 'c1' },
      ])!
    let w = s
    for (let i = 0; i < 3; i++) w = stepWorld(w, [conC1(i)]).state
    // Tres pasos a 20 Hz son 0,15 s de mundo. La actividad acumula SEGUNDOS
    // (ADR II-0008), no ticks: a 10 Hz los mismos tres pasos serían 0,3.
    expect(w.actors.get('ana')?.doing?.segundos).toBe(0.15)
    const otro = apply({ by: 'ana', seq: 9 }, s.phys, 'deshilachar', [
      { name: 'actor', body: 'ana-cuerpo' },
      { name: 'source', body: 'c3' },
    ])!
    expect(stepWorld(w, [otro]).state.actors.get('ana')?.doing?.segundos).toBe(0.05)
  })

  it('la actividad se pierde si el actor no actúa', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enLaMano(cuerpo('c1', 'liana', 0.4), EN(0, 0), 'ana'),
      ],
      actors: [actor('ana', { holding: ['c1'] })],
    })
    const i = apply({ by: 'ana', seq: 0 }, s.phys, 'deshilachar', [
      { name: 'actor', body: 'ana-cuerpo' },
      { name: 'source', body: 'c1' },
    ])!
    const w = stepWorld(s, [i]).state
    expect(w.actors.get('ana')?.doing?.segundos).toBe(0.05)
    expect(stepWorld(w, []).state.actors.get('ana')?.doing).toBeUndefined()
  })

  it('un rol que no cumple se rechaza sin correr nada', () => {
    // `deshilachar` pide `tensile >= 0.3` en `source`. La piedra no da.
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enLaMano(cuerpo('roca', 'piedra', 1), EN(0, 0), 'ana'),
      ],
      actors: [actor('ana', { holding: ['roca'] })],
    })
    const i = apply({ by: 'ana', seq: 0 }, s.phys, 'deshilachar', [
      { name: 'actor', body: 'ana-cuerpo' },
      { name: 'source', body: 'roca' },
    ])!
    expect(motivos(stepWorld(s, [i]).events)).toEqual(['rol-no-cumple'])
  })

  it('el arreglo importa: `held` exige tenerlo en la mano', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(cuerpo('c1', 'liana', 0.4), EN(1, 0)),
      ],
      actors: [actor('ana')],
    })
    const i = apply({ by: 'ana', seq: 0 }, s.phys, 'deshilachar', [
      { name: 'actor', body: 'ana-cuerpo' },
      { name: 'source', body: 'c1' },
    ])!
    expect(motivos(stepWorld(s, [i]).events)).toEqual(['arreglo-incorrecto'])
  })

  it('al completarse, deshilachar deja una hebra y no inventa masa', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana', 1000), EN(0, 0)),
        enLaMano(cuerpo('c1', 'corteza', 1), EN(0, 0), 'ana'),
      ],
      actors: [actor('ana', { holding: ['c1'] })],
    })
    // Los dos segundos que dura `deshilachar`, muestreados a la frecuencia del
    // mundo: cuarenta pasos a 20 Hz (ADR II-0008).
    const pasos = Math.round(
      s.phys.processes.get('deshilachar')!.completion!.at / dtDeFrecuencia(s.hz),
    )
    let w = s
    let nacio: string | undefined
    for (let i = 0; i < pasos; i++) {
      const r = stepWorld(
        w,
        [
          apply({ by: 'ana', seq: i }, w.phys, 'deshilachar', [
            { name: 'actor', body: 'ana-cuerpo' },
            { name: 'source', body: 'c1' },
          ])!,
        ],
      )
      w = r.state
      for (const e of r.events) if (e.k === 'nacio') nacio = e.id
    }
    expect(nacio).toBeDefined()
    const hebra = w.bodies.get(nacio!)
    expect(hebra?.body.form).toBe('hebra')
    // La materia se movió: lo que salió es lo que el resto perdió.
    const total =
      qualityOf(w.bodies.get('c1')!.body, 'mass', w.phys) +
      qualityOf(hebra!.body, 'mass', w.phys)
    expect(total).toBeCloseTo(1, 9)
  })
})
