import { describe, expect, it } from 'vitest'
import {
  DESHILACHAR,
  EXTRACCION,
  FRICCION,
  PHYSICS_VERSION,
  SEED_PROCESSES,
  UNION,
  baseRoleName,
  isOptionalRole,
  unknownRoleRefs,
  type Process,
} from '../src/process.js'
import { CANA, VARA, mundo } from './mundo-de-prueba.js'
import { qualityOf } from '../src/body.js'

describe('el catálogo de aplicables', () => {
  it('son exactamente cuatro, y combustion no es uno de ellos', () => {
    // ADR II-0001: encender no es una acción, es una consecuencia. Si este test
    // se rompe porque alguien agregó `combustion`, el que lo agregó tiene que
    // leer el ADR antes de tocar la línea de abajo.
    expect(SEED_PROCESSES.map((p) => p.id)).toEqual(['friccion', 'union', 'deshilachar', 'extraccion'])
  })

  it('todos son semilla, estables y de la misma versión de física', () => {
    for (const p of SEED_PROCESSES) {
      expect(p.provenance.by).toBe('semilla')
      expect(p.trust).toBe('estable')
      // Una sola definición de la versión: si `physicsVersion` se copiara a
      // mano en otro archivo, divergiría en silencio. Éste es el trinquete.
      expect(p.physicsVersion).toBe(PHYSICS_VERSION)
    }
  })

  it('ningún efecto ni rendimiento apunta a un rol que no existe', () => {
    for (const p of SEED_PROCESSES) expect([p.id, unknownRoleRefs(p)]).toEqual([p.id, []])
  })

  it('todos declaran al menos un rol y una disposición', () => {
    for (const p of SEED_PROCESSES) {
      expect(p.roles.length).toBeGreaterThan(0)
      expect(p.arrangement.k).toBeTruthy()
    }
  })
})

describe('nada sube gratis', () => {
  it('todo drive que empuja hacia arriba declara de qué cuenta drena', () => {
    // Es la regla que cierra las máquinas de movimiento perpetuo. Sin ella,
    // «frotar dos piedras» produce calor infinito y el hambre deja de doler.
    for (const p of SEED_PROCESSES) {
      for (const e of p.effects) {
        if (e.k !== 'drive') continue
        expect(e.poweredBy, `${p.id}: ${e.q} sube sin fuente`).toBeDefined()
        expect(e.poweredBy!.efficiency).toBeLessThanOrEqual(1)
        expect(e.poweredBy!.efficiency).toBeGreaterThan(0)
      }
    }
  })

  it('la fricción es la calibración del documento, no otra', () => {
    const drive = FRICCION.effects.find((e) => e.k === 'drive')
    expect(drive).toBeDefined()
    if (drive?.k !== 'drive') throw new Error('imposible')
    expect(drive.q).toBe('temperature')
    expect(drive.toward).toBe(400)
    // 120 grados POR SEGUNDO (ADR II-0008), que a la frecuencia de referencia
    // son los 6 por tick con los que el documento la calibró. Ahora frotar sube
    // la madera de 15 a 375 °C en tres segundos a cualquier frecuencia.
    expect(drive.porSegundo).toBe(120)
    expect(drive.poweredBy).toEqual({ from: 'actor', q: 'stamina', efficiency: 0.35 })
  })

  it('frotar cuesta stamina, que es conservada', () => {
    const actor = FRICCION.roles.find((r) => r.name === 'actor')
    expect(actor?.where).toEqual([{ q: 'stamina', op: '>=', v: 1 }])
  })
})

describe('union: el rol b es opcional, y ahí está la caña', () => {
  it('declara binder, a y un b opcional', () => {
    expect(UNION.roles.map((r) => r.name)).toEqual(['binder', 'a', 'b?'])
    expect(isOptionalRole('b?')).toBe(true)
    expect(isOptionalRole('a')).toBe(false)
    expect(baseRoleName('b?')).toBe('b')
    expect(baseRoleName('a')).toBe('a')
  })

  it('exactamente un rol opcional, y es el que el rendimiento marca opcional', () => {
    const opcionales = UNION.roles.filter((r) => isOptionalRole(r.name))
    expect(opcionales.map((r) => r.name)).toEqual(['b?'])
    const join = UNION.completion?.yields[0]
    if (join?.k !== 'join') throw new Error('union tiene que rendir un join')
    // El nombre y el rendimiento dicen lo mismo: el rol que el yield pone en su
    // campo opcional es el que el nombre marca opcional. Si divergieran, el
    // mundo pediría dos cuerpos y la caña no existiría.
    expect(join.b).toBe('b?')
    expect(join.a).toBe('a')
    expect(join.via).toBe('binder')
  })

  it('el binder pide flexibilidad y tracción: sirve cualquier hebra', () => {
    const binder = UNION.roles.find((r) => r.name === 'binder')
    expect(binder?.where).toEqual([
      { q: 'flexibility', op: '>=', v: 0.8 },
      { q: 'tensile', op: '>=', v: 0.3 },
    ])
  })

  it('el rol a no pide nada: se ata lo que sea', () => {
    expect(UNION.roles.find((r) => r.name === 'a')?.where).toEqual([])
  })

  it('completa en un segundo y es reversible', () => {
    // En segundos y no en ticks (ADR II-0008): eran 20 ticks, que a 20 Hz son
    // exactamente este segundo y a 10 Hz habrían sido dos.
    expect(UNION.completion?.at).toBe(1)
    expect(UNION.commitment).toBe('reversible')
  })
})

describe('deshilachar y extraccion', () => {
  it('deshilachar corta contra el grano y cuesta stamina', () => {
    // Dos segundos y 2 de stamina por segundo: eran 40 ticks a 0,1 por tick, o
    // sea el mismo gasto total en el mismo tiempo de reloj (ADR II-0008).
    expect(DESHILACHAR.completion?.at).toBe(2)
    expect(DESHILACHAR.completion?.yields).toEqual([{ k: 'split', role: 'source', at: 'grain' }])
    expect(DESHILACHAR.effects).toEqual([{ k: 'drain', q: 'stamina', on: 'actor', porSegundo: 2 }])
    expect(DESHILACHAR.commitment).toBe('costly')
  })

  it('deshilachar establece justo lo que union pide del binder', () => {
    // El acople que hace que la cadena hebra → caña sea descubrible: lo que
    // deshilachar promete es literalmente el predicado del rol `binder`.
    const binder = UNION.roles.find((r) => r.name === 'binder')!
    const promesas = new Set(DESHILACHAR.establishes)
    for (const t of binder.where) expect(promesas.has(`${t.q}${t.op}${t.v}`)).toBe(true)
  })

  it('extraccion pide alcance y enganche, a un radio de 1', () => {
    expect(EXTRACCION.roles.find((r) => r.name === 'gear')?.where).toEqual([
      { q: 'reach', op: '>=', v: 2 },
      { q: 'catch', op: '>', v: 0 },
    ])
    expect(EXTRACCION.arrangement).toEqual({ k: 'within', radius: 1 })
    // Segundo y medio: eran 30 ticks. Y medio segundo es una duración legal,
    // mientras que medio tick no lo era.
    expect(EXTRACCION.completion?.at).toBe(1.5)
    expect(EXTRACCION.completion?.yields).toEqual([{ k: 'drawFromStock', of: 'source', into: 'hands' }])
  })
})

describe('los roles se prueban contra cuerpos de verdad', () => {
  const phys = mundo()
  const cumple = (p: Process, rol: string, b: Parameters<typeof qualityOf>[0]): boolean => {
    const r = p.roles.find((x) => x.name === rol)!
    return r.where.every((t) => {
      const v = qualityOf(b, t.q, phys)
      switch (t.op) {
        case '>=':
          return v >= t.v
        case '<=':
          return v <= t.v
        case '>':
          return v > t.v
        case '<':
          return v < t.v
      }
    })
  }

  it('la vara sola no es aparejo; la caña sí', () => {
    expect(cumple(EXTRACCION, 'gear', VARA)).toBe(false)
    expect(cumple(EXTRACCION, 'gear', CANA)).toBe(true)
  })

  it('la vara sí sirve para frotar, y la hebra no', () => {
    expect(cumple(FRICCION, 'a', VARA)).toBe(true)
    const hebra = { ...CANA, parts: [CANA.parts[1]!], joints: [] }
    expect(cumple(FRICCION, 'a', hebra)).toBe(false)
  })

  it('la hebra sí sirve de binder, y la vara no', () => {
    const hebra = { ...CANA, parts: [CANA.parts[1]!], joints: [] }
    expect(cumple(UNION, 'binder', hebra)).toBe(true)
    expect(cumple(UNION, 'binder', VARA)).toBe(false)
  })

  it('la madera sirve de fuente para deshilachar: tiene tracción a lo largo del grano', () => {
    expect(cumple(DESHILACHAR, 'source', VARA)).toBe(true)
  })
})
