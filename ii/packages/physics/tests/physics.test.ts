import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, conservedIn, specIn } from '../src/physics.js'
import { PHYSICS_VERSION, SEED_PROCESSES } from '../src/process.js'
import { qualityOf, nameOf } from '../src/body.js'
import { CUALIDADES, SUSTANCIAS, cuerpo, mundo, parte } from './mundo-de-prueba.js'

describe('buildSeedPhysics', () => {
  it('trae los cuatro aplicables y la versión de la física', () => {
    const phys = buildSeedPhysics({ qualities: CUALIDADES, substances: SUSTANCIAS })
    expect(phys.version).toBe(PHYSICS_VERSION)
    expect([...phys.processes.keys()]).toEqual(SEED_PROCESSES.map((p) => p.id))
  })

  it('el orden de los mapas es el de los catálogos, no el del azar', () => {
    // El orden de iteración de un Map de JS es el de inserción. Si se
    // construyera desde un objeto, sería el de las claves, que depende de si
    // parecen enteros. Un replay que dependa de eso diverge sin aviso.
    const phys = buildSeedPhysics({ qualities: CUALIDADES, substances: SUSTANCIAS })
    expect([...phys.substances.keys()]).toEqual(SUSTANCIAS.map((s) => s.id))
  })

  it('un id repetido en el catálogo es un error ruidoso, no un pisado silencioso', () => {
    const dup = SUSTANCIAS[0]!
    expect(() => buildSeedPhysics({ qualities: CUALIDADES, substances: [dup, dup] })).toThrow(/sustancia/)
    expect(() => buildSeedPhysics({ qualities: [...CUALIDADES, CUALIDADES[0]!], substances: [] })).toThrow(
      /cualidad/,
    )
  })

  it('sin argumentos arma la semilla entera, con sus sustancias y sus cuatro procesos', () => {
    const phys = buildSeedPhysics()
    expect(phys.version).toBe(PHYSICS_VERSION)
    expect(phys.processes.size).toBe(4)
    expect(phys.substances.size).toBeGreaterThan(0)
  })

  it('con una lista vacía también arma: el catálogo de sustancias es abierto', () => {
    const phys = buildSeedPhysics({ qualities: CUALIDADES, substances: [] })
    expect(phys.substances.size).toBe(0)
    expect(phys.processes.size).toBe(4)
  })

  it('specIn y conservedIn leen el catálogo que se le pasó', () => {
    const phys = buildSeedPhysics({ qualities: CUALIDADES, substances: SUSTANCIAS })
    expect(specIn(phys, 'mass')?.conserved).toBe(true)
    expect(specIn(phys, 'temperature')?.conserved).toBe(false)
    expect(conservedIn(phys)).toEqual(['mass', 'nutrition', 'stamina', 'fuelEnergy'])
  })
})

describe('una sustancia que nadie escribió se comporta igual', () => {
  // La prueba semántica del documento, en lo que este paquete puede sostener
  // sin motor: una sustancia inventada al vuelo, sin fila propia en ningún
  // lado, tiene que dar los mismos nombres y las mismas cuentas que el pescado.
  const inventada = {
    id: 'bicho-de-rio',
    lexeme: { nombre: 'bicho', genero: 'm' as const, sinonimos: [] },
    tags: ['organico', 'carnoso'] as const,
    specificHeat: 3.1,
    perUnitMass: { nutrition: 7, digestibility: 0.3, moisture: 0.7, ignitionPoint: 270, denaturesAt: 50 },
    provenance: { by: 'oraculo' as const, atTick: 4120 },
  }
  const phys = buildSeedPhysics({ qualities: CUALIDADES, substances: [...SUSTANCIAS, inventada] })
  const crudo = cuerpo('b1', 'filete', [parte('bicho-de-rio', 0.4)])

  it('se nombra crudo y asado sin que nadie le escriba una fila', () => {
    expect(nameOf(crudo, phys)).toBe('bicho crudo')
    expect(nameOf({ ...crudo, state: { digestibility: 0.9 } }, phys)).toBe('bicho asado')
  })

  it('sus calorías salen de la misma cuenta derivada', () => {
    expect(qualityOf(crudo, 'calories', phys)).toBeCloseTo(7 * 0.4 * 0.3, 10)
  })

  it('nada de esto depende del id de la sustancia', () => {
    const pescado = cuerpo('p1', 'filete', [parte('pescado', 0.4)])
    const ratio = qualityOf(crudo, 'calories', phys) / qualityOf(pescado, 'calories', mundo())
    expect(Number.isFinite(ratio)).toBe(true)
    expect(ratio).toBeGreaterThan(0)
  })
})
