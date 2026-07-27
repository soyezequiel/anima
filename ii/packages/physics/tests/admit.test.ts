// La puerta, probada por lo que RECHAZA. Un juez que solo se prueba con lo que
// admite no es un juez: es un `return true` con ceremonia.
//
// Los dos rechazos que el documento de arquitectura pide por nombre están acá y
// tienen su propio `describe`: «frotar produce calor infinito» citando
// `poweredBy`, y «atar dos palos produce un pescado» citando conservación.

import { describe, expect, it } from 'vitest'
import {
  MAX_EFFICIENCY,
  admit,
  admitSubstance,
  ciclosPor,
  consumedRoles,
  envolventeDe,
  porQue,
  saldoDeclarado,
  tieneCodigo,
  tieneReparo,
  type Codigo,
  type Verdict,
} from '../src/admit.js'
import { buildSeedPhysics } from '../src/physics.js'
import {
  DESHILACHAR,
  EXTRACCION,
  FRICCION,
  PHYSICS_VERSION,
  SEED_PROCESSES,
  UNION,
  type Process,
} from '../src/process.js'
import { seg } from '../src/fixed.js'
import type { Substance } from '../src/substance.js'

const phys = buildSeedPhysics()

/** Los códigos de rechazo, para poder afirmar sobre el conjunto entero. */
const codigos = (v: Verdict): readonly Codigo[] => v.razones.map((r) => r.codigo)

const razonPorCodigo = (v: Verdict, c: Codigo) => {
  const r = v.razones.find((x) => x.codigo === c)
  if (r === undefined) throw new Error(`no hay razón «${c}»; hay ${codigos(v).join(', ')}`)
  return r
}

/** Un proceso plausible al que después le rompemos una cosa por vez. */
const plantilla = (id: string, extra: Partial<Process> = {}): Process => ({
  id,
  lexeme: { nombre: id },
  roles: [{ name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] }],
  arrangement: { k: 'held' },
  gate: [],
  effects: [],
  establishes: [],
  commitment: 'reversible',
  trust: 'borrador',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'modelo' },
  ...extra,
})

// ─── Lo que tiene que pasar ──────────────────────────────────────────────────

describe('la semilla pasa su propia puerta', () => {
  it('los cuatro procesos aplicables entran', () => {
    for (const p of SEED_PROCESSES) {
      const v = admit(p, phys)
      // El id adentro del `expect` para que el fallo diga CUÁL, no solo que uno falló.
      expect([p.id, codigos(v)]).toEqual([p.id, []])
    }
  })

  it('las treinta sustancias semilla entran', () => {
    for (const s of phys.substances.values()) {
      expect([s.id, admitSubstance(s, phys).razones.map((r) => r.codigo)]).toEqual([s.id, []])
    }
  })

  it('readmitir el mismo proceso es revalidar, no chocar de id', () => {
    expect(admit(FRICCION, phys).ok).toBe(true)
    // Otro objeto con el mismo id sí es un choque: le taparía el proceso al
    // mundo sin que nadie se entere de que hay dos.
    const impostor: Process = { ...FRICCION, lexeme: { nombre: 'frotar (bis)' } }
    expect(tieneCodigo(admit(impostor, phys), 'id-repetido')).toBe(true)
  })
})

describe('qué se consume se DERIVA, no se declara', () => {
  it('lo consumido es lo que el rendimiento hereda', () => {
    // Ésta es la línea que cerraba la bomba de materia: con un campo `consume`
    // escrito por quien propone, una entrada intacta contaba como aporte.
    expect(consumedRoles(UNION)).toEqual(['a', 'b?', 'binder'])
    expect(consumedRoles(DESHILACHAR)).toEqual(['source'])
    expect(consumedRoles(EXTRACCION)).toEqual(['source'])
  })

  it('el actor de frotar NO se consume: paga con stamina y sigue entero', () => {
    expect(consumedRoles(FRICCION)).toEqual([])
  })
})

// ─── Regla 2 · «frotar produce calor infinito» ───────────────────────────────

describe('frotar produce calor infinito', () => {
  const drive = FRICCION.effects[0]
  if (drive?.k !== 'drive') throw new Error('friccion tiene que traer un drive')

  it('sin poweredBy no entra, y el rechazo dice la cualidad y el nombre del campo', () => {
    const infinito = plantilla('frotar-infinito', {
      roles: FRICCION.roles,
      effects: [{ k: 'drive', q: 'temperature', on: 'a', toward: 400, porSegundo: 120 }],
      establishes: FRICCION.establishes,
    })
    const v = admit(infinito, phys)
    expect(v.ok).toBe(false)
    const r = razonPorCodigo(v, 'sube-gratis')
    expect(r.regla).toBe(2)
    expect(r.q).toBe('temperature')
    expect(r.rol).toBe('a')
    expect(r.encontrado).toBe(400)
    expect(r.mensaje).toContain('poweredBy')

    // Y encima domina a `friccion`: promete lo mismo y no paga nada. Las dos
    // reglas lo agarran, que es lo que uno quiere de una puerta.
    expect(tieneCodigo(v, 'dominancia')).toBe(true)
  })

  it('con eficiencia > 1 tampoco, y el rechazo trae los dos números', () => {
    const magico = plantilla('frotar-magico', {
      roles: FRICCION.roles,
      effects: [{ ...drive, poweredBy: { from: 'actor', q: 'stamina', efficiency: 1.4 } }],
      establishes: FRICCION.establishes,
    })
    const r = razonPorCodigo(admit(magico, phys), 'eficiencia')
    expect(r.encontrado).toBe(1.4)
    expect(r.cota).toBe(MAX_EFFICIENCY)
    expect(r.q).toBe('stamina')
  })

  it('drenar algo que no es una cuenta conservada no es pagar', () => {
    const trucho = plantilla('frotar-con-humedad', {
      roles: FRICCION.roles,
      effects: [{ ...drive, poweredBy: { from: 'actor', q: 'moisture', efficiency: 0.35 } }],
      establishes: FRICCION.establishes,
    })
    const r = razonPorCodigo(admit(trucho, phys), 'fuente-no-conservada')
    expect(r.q).toBe('moisture')
  })

  it('drenar stamina DE UNA PIEDRA es el mismo calor gratis con la declaración puesta', () => {
    // El agujero más fino de la regla 2: el `poweredBy` existe, apunta a una
    // cuenta conservada y la eficiencia es legal. Pero el rol del que drena es
    // una vara, y una vara no tiene aliento: el trabajo sale de la nada igual.
    const piedra = plantilla('frotar-contra-la-piedra', {
      roles: FRICCION.roles,
      effects: [{ ...drive, poweredBy: { from: 'b', q: 'stamina', efficiency: 0.35 } }],
      establishes: FRICCION.establishes,
    })
    const r = razonPorCodigo(admit(piedra, phys), 'fuente-sin-respaldo')
    expect(r.q).toBe('stamina')
    expect(r.rol).toBe('b')
  })

  it('bajar es libre: enfriar no necesita declarar de dónde saca nada', () => {
    const enfriar = plantilla('enfriar', {
      arrangement: { k: 'contact' },
      effects: [{ k: 'drive', q: 'temperature', on: 'a', toward: -100, porSegundo: 20 }],
      establishes: ['temperature<=0'],
    })
    const v = admit(enfriar, phys)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)
  })
})

// ─── Regla 1 · «atar dos palos produce un pescado» ───────────────────────────

describe('atar dos palos produce un pescado', () => {
  /** El rendimiento de la unión, tal cual, para colgarle encima la trampa. */
  const ATADURA = UNION.completion!

  it('subir nutrition se rechaza por conservación, con lo que sale y lo que entra', () => {
    const pescado = plantilla('atar-nutritivo', {
      roles: UNION.roles,
      completion: ATADURA,
      effects: [{ k: 'drive', q: 'nutrition', on: 'a', toward: 9, porSegundo: 10 }],
      establishes: UNION.establishes,
    })
    const v = admit(pescado, phys)
    expect(v.ok).toBe(false)
    const r = razonPorCodigo(v, 'conservacion-drive')
    expect(r.regla).toBe(1)
    expect(r.q).toBe('nutrition')
    expect(r.rol).toBe('a')
    expect(r.encontrado).toBe(9) // sale
    expect(r.cota).toBe(0) // entra: dos palos y una hebra no traen nutrición
    expect(r.mensaje).toContain('sale 9, entra 0')
  })

  it('el mismo pescado por transferencia: mover lo que el origen no tiene', () => {
    // Más astuto que el `drive`: un `transfer` conserva la suma POR DEFINICIÓN,
    // así que pasa cualquier chequeo que solo mire el tipo de efecto. Lo que no
    // conserva es sacar de un rol que puede estar lleno de liana, que tiene
    // `nutrition` cero.
    const trasvase = plantilla('atar-trasvase', {
      roles: UNION.roles,
      completion: ATADURA,
      effects: [{ k: 'transfer', q: 'nutrition', from: 'binder', to: 'a', porSegundo: 10 }],
      establishes: UNION.establishes,
    })
    const r = razonPorCodigo(admit(trasvase, phys), 'conservacion-transfer')
    expect(r.q).toBe('nutrition')
    expect(r.rol).toBe('binder')
    expect(r.encontrado).toBe(10) // 0.5 por tick durante los 20 de la unión
    expect(r.cota).toBe(0)
  })

  it('el mismo pescado con un signo: un drain negativo es un drive disfrazado', () => {
    const alReves = plantilla('atar-al-reves', {
      roles: UNION.roles,
      completion: ATADURA,
      effects: [{ k: 'drain', q: 'nutrition', on: 'a', porSegundo: -10 }],
      establishes: UNION.establishes,
    })
    const r = razonPorCodigo(admit(alReves, phys), 'tasa-negativa')
    expect(r.regla).toBe(1)
    expect(r.encontrado).toBe(-10)
  })

  it('un couple sobre una conservada la escribe sin cota', () => {
    const acoplado = plantilla('atar-acoplado', {
      roles: UNION.roles,
      completion: ATADURA,
      effects: [
        { k: 'couple', q: 'nutrition', on: 'a', follows: { q: 'digestibility', of: 'binder' } },
      ],
      establishes: UNION.establishes,
    })
    expect(tieneCodigo(admit(acoplado, phys), 'conservacion-couple')).toBe(true)
  })

  it('sacar de un stock sin exigirle masa es materia de la nada', () => {
    const magia = plantilla('atar-y-pescar', {
      roles: UNION.roles,
      completion: { at: seg(1), yields: [{ k: 'drawFromStock', of: 'a', into: 'hands' }] },
      establishes: UNION.establishes,
    })
    const r = razonPorCodigo(admit(magia, phys), 'materia-sin-origen')
    expect(r.q).toBe('mass')
    expect(r.rol).toBe('a')
  })

  it('y sin embargo `extraccion` sí entra: su fuente declara mass > 0', () => {
    // La diferencia entera entre pescar y hacer aparecer un pescado es esa
    // línea del rol `source`. El agujero del dios existe, pero declarado.
    expect(EXTRACCION.roles.find((r) => r.name === 'source')?.where).toEqual([
      { q: 'mass', op: '>', v: 0 },
    ])
    expect(admit(EXTRACCION, phys).ok).toBe(true)
  })
})

// ─── Regla 3 · envolventes derivadas del catálogo ────────────────────────────

const nueva = (id: string, tags: Substance['tags'], perUnitMass: Substance['perUnitMass'], specificHeat = 2): Substance => ({
  id,
  lexeme: { nombre: id, genero: 'f', sinonimos: [] },
  tags,
  perUnitMass,
  specificHeat,
  provenance: { by: 'oraculo', atTick: 300 },
})

describe('envolventes por tag, derivadas y no escritas a mano', () => {
  it('la envolvente sale del catálogo: el techo es el máximo medido más la holgura', () => {
    // `grasa` es lo más calórico que hay entre lo orgánico, con 30.
    const env = envolventeDe(phys, ['organico'], 'fuelEnergy')
    expect(env?.hi).toBe(45)
  })

  it('y se mueve sola cuando el catálogo cambia: no hay número escrito en ningún lado', () => {
    const conBrea = buildSeedPhysics({
      substances: [...phys.substances.values(), nueva('brea', ['organico'], { fuelEnergy: 40 })],
    })
    expect(envolventeDe(conBrea, ['organico'], 'fuelEnergy')?.hi).toBe(60)
  })

  it('algo organico no puede tener el poder calorífico del plutonio', () => {
    const plutonio = nueva('madera-de-plutonio', ['organico', 'vegetal', 'fibroso'], {
      fuelEnergy: 80,
      rigidity: 0.7,
    })
    const r = razonPorCodigo(admitSubstance(plutonio, phys), 'fuera-de-envolvente')
    expect(r.regla).toBe(3)
    expect(r.q).toBe('fuelEnergy')
    expect(r.encontrado).toBe(80)
    expect(r.cota).toBe(45)
  })

  it('ni el oráculo puede inventar piedra nutritiva', () => {
    // Las cuatro sustancias minerales del catálogo declaran `nutrition: 0`, así
    // que la envolvente mineral de `nutrition` es [0, 0] y no hay holgura que
    // valga: multiplicar cero por lo que sea da cero. Es la misma prohibición
    // que el documento pide para «madera nutritiva», derivada en vez de escrita.
    const r = razonPorCodigo(
      admitSubstance(nueva('piedra-de-pan', ['mineral'], { nutrition: 5 }), phys),
      'fuera-de-envolvente',
    )
    expect(r.q).toBe('nutrition')
    expect(r.cota).toBe(0)
  })

  it('una sustancia plausible que el oráculo invente sí entra', () => {
    const hongo = nueva(
      'hongo-de-tronco',
      ['organico', 'vegetal'],
      {
        nutrition: 4,
        digestibility: 0.28,
        toxicity: 0.4,
        moisture: 0.8,
        fuelEnergy: 1.5,
        denaturesAt: 60,
        pyrolysisAt: 250,
        ignitionPoint: 250,
        toughness: 0.3,
        rigidity: 0.1,
      },
      3.2,
    )
    expect(admitSubstance(hongo, phys).razones).toEqual([])
  })

  it('sin tags no la agarra ninguna ley, y eso no es una sustancia', () => {
    expect(tieneCodigo(admitSubstance(nueva('cosa', [], { rigidity: 0.5 }), phys), 'sin-tags')).toBe(true)
  })

  it('calor específico cero es una división por cero en la ley 1', () => {
    const r = razonPorCodigo(
      admitSubstance(nueva('vacio', ['mineral'], { rigidity: 0.5 }, 0), phys),
      'calor-especifico',
    )
    expect(r.encontrado).toBe(0)
  })

  it('una sustancia no declara masa ni temperatura: eso es estado del cuerpo', () => {
    const v = admitSubstance(nueva('rara', ['mineral'], { mass: 3, temperature: 20 }), phys)
    expect(codigos(v).filter((c) => c === 'cualidad-de-estado').length).toBe(2)
  })

  it('ni cualidades derivadas, que no se guardan', () => {
    expect(
      tieneCodigo(admitSubstance(nueva('falsa', ['mineral'], { calories: 12 }), phys), 'cualidad-derivada'),
    ).toBe(true)
  })

  it('un proceso tampoco puede empujar una cualidad más allá de su clase', () => {
    // `hoja-seca` es lo más inflamable de lo vegetal; nada organico llega a 900.
    const brujeria = plantilla('endurecer-la-madera', {
      roles: [{ name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.6 }] }],
      effects: [
        {
          k: 'drive',
          q: 'ignitionPoint',
          on: 'a',
          toward: 1800,
          porSegundo: 20,
          poweredBy: { from: 'a', q: 'stamina', efficiency: 0.5 },
        },
      ],
      establishes: ['ignitionPoint>=1800'],
    })
    const r = razonPorCodigo(admit(brujeria, phys), 'fuera-de-envolvente')
    expect(r.q).toBe('ignitionPoint')
    expect(r.encontrado).toBe(1800)
    expect(r.cota).toBeLessThan(1800)
  })
})

// ─── Regla 4 · cierre dimensional, cotas, no-dominancia, realizabilidad ──────

describe('cierre dimensional y cotas de rango', () => {
  it('un umbral fuera del rango de su cualidad se rechaza con los tres números', () => {
    const p = plantilla('rigido-imposible', {
      roles: [{ name: 'a', where: [{ q: 'rigidity', op: '>=', v: 5 }] }],
    })
    const r = razonPorCodigo(admit(p, phys), 'fuera-de-rango')
    expect(r.q).toBe('rigidity')
    expect(r.encontrado).toBe(5)
    expect(r.cota).toBe(1)
  })

  it('un NaN en una constante física se rechaza antes de envenenar el tick 400', () => {
    const p = plantilla('frotar-nan', {
      roles: FRICCION.roles,
      effects: [{ k: 'drive', q: 'temperature', on: 'a', toward: Number.NaN, porSegundo: 120, poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.35 } }],
    })
    expect(tieneCodigo(admit(p, phys), 'numero-no-finito')).toBe(true)
  })

  it('no se acopla una cualidad a otra que no le entra en el rango', () => {
    const p = plantilla('quemar-por-acople', {
      effects: [{ k: 'couple', q: 'charred', on: 'a', follows: { q: 'temperature', of: 'a' } }],
    })
    const r = razonPorCodigo(admit(p, phys), 'acople-inconmensurable')
    expect(r.q).toBe('charred')
    expect(r.encontrado).toBe(2000)
    expect(r.cota).toBe(1)
  })

  it('ni una intensiva a una extensiva', () => {
    const p = plantilla('rigidez-por-masa', {
      effects: [{ k: 'couple', q: 'rigidity', on: 'a', follows: { q: 'mass', of: 'a' } }],
    })
    expect(tieneCodigo(admit(p, phys), 'acople-inconmensurable')).toBe(true)
  })

  it('una cualidad que el catálogo no tiene no entra por la puerta de atrás', () => {
    const p = plantilla('inventar-cualidad', {
      roles: [{ name: 'a', where: [{ q: 'magia' as never, op: '>=', v: 1 }] }],
    })
    expect(tieneCodigo(admit(p, phys), 'cualidad-fuera-del-catalogo')).toBe(true)
  })

  it('un sello contra otra versión de la física no vale en ésta', () => {
    const r = razonPorCodigo(admit(plantilla('viejo', { physicsVersion: 99 }), phys), 'version-de-fisica')
    expect(r.encontrado).toBe(99)
    expect(r.cota).toBe(PHYSICS_VERSION)
  })
})

describe('realizabilidad: el fallo silencioso', () => {
  it('un rol que ninguna sustancia puede llenar se rechaza en vez de no encontrar entradas nunca', () => {
    // Sin esto `admit` pasa, el proceso jamás encuentra con qué, y Ánima queda
    // tanteando sin que nadie sepa por qué. Es el peor modo de falla que hay:
    // silencioso y a mitad de partida.
    const p = plantilla('afilar-lo-nutritivo', {
      roles: [
        {
          name: 'a',
          where: [
            { q: 'rigidity', op: '>=', v: 0.9 },
            { q: 'nutrition', op: '>=', v: 5 },
          ],
        },
      ],
    })
    const r = razonPorCodigo(admit(p, phys), 'rol-irrealizable')
    expect(r.rol).toBe('a')
    expect(r.mensaje).toContain('rigidity >= 0.9')
  })

  it('un rol que se contradice a sí mismo', () => {
    const p = plantilla('ni-una-cosa-ni-la-otra', {
      roles: [
        {
          name: 'a',
          where: [
            { q: 'rigidity', op: '>=', v: 0.8 },
            { q: 'rigidity', op: '<=', v: 0.2 },
          ],
        },
      ],
    })
    const r = razonPorCodigo(admit(p, phys), 'rol-contradictorio')
    expect(r.encontrado).toBe(0.8)
    expect(r.cota).toBe(0.2)
  })

  it('un efecto sobre un rol que no existe no falla en el mundo: no hace nada', () => {
    const p = plantilla('frotar-el-aire', {
      effects: [{ k: 'drain', q: 'stamina', on: 'fantasma', porSegundo: 2 }],
    })
    expect(tieneCodigo(admit(p, phys), 'rol-desconocido')).toBe(true)
  })

  it('completar en cero ticks no es completar', () => {
    const p = plantilla('instantaneo', {
      completion: { at: seg(0), yields: [{ k: 'split', role: 'a', at: 'grain' }] },
    })
    expect(tieneCodigo(admit(p, phys), 'completion-invalida')).toBe(true)
  })

  it('deshilachar entra, y la puerta igual avisa que pide 4 de stamina y garantiza 3', () => {
    // Reparo y no rechazo: que quien empiece con lo justo no llegue a terminar
    // es la distancia entre querer y poder, no una violación de la física. Pero
    // el número tiene que estar dicho.
    const v = admit(DESHILACHAR, phys)
    expect(v.ok).toBe(true)
    expect(tieneReparo(v, 'costo-mayor-que-la-garantia')).toBe(true)
    const r = v.advertencias.find((x) => x.codigo === 'costo-mayor-que-la-garantia')!
    expect(r.encontrado).toBeCloseTo(4, 6)
    expect(r.cota).toBe(3)
  })
})

describe('lo que la puerta rechaza sin ceremonia', () => {
  it('un proceso sin roles no se puede aplicar a nada', () => {
    expect(tieneCodigo(admit(plantilla('nada', { roles: [] }), phys), 'sin-roles')).toBe(true)
  })

  it('dos roles con el mismo nombre base: el sufijo `?` no los distingue', () => {
    const p = plantilla('doble', {
      roles: [
        { name: 'a', where: [] },
        { name: 'a?', where: [] },
      ],
    })
    expect(tieneCodigo(admit(p, phys), 'rol-repetido')).toBe(true)
  })

  it('una sustancia sin nombre no se puede decir, y el mundo se habla', () => {
    const muda: Substance = {
      id: 'x',
      lexeme: { nombre: '', genero: 'f', sinonimos: [] },
      tags: ['mineral'],
      perUnitMass: { rigidity: 0.5 },
      specificHeat: 1,
      provenance: { by: 'oraculo' },
    }
    expect(tieneCodigo(admitSubstance(muda, phys), 'sin-nombre')).toBe(true)
  })
})

describe('los reparos: cosas raras que no cierran la puerta', () => {
  it('algo más seco que todo lo orgánico del catálogo se admite con reparo', () => {
    // Por abajo es reparo y no rechazo: de tener POCO de algo no sale ninguna
    // máquina de movimiento perpetuo. Lo que rompe el mundo es tener de más.
    // (Lo más seco que hay entre lo orgánico es la hojarasca, con 0.06.)
    const seca = nueva('carne-desecada', ['organico', 'carnoso'], { moisture: 0.01 }, 3.4)
    const v = admitSubstance(seca, phys)
    expect(v.ok).toBe(true)
    const r = v.advertencias.find((x) => x.codigo === 'envolvente-por-abajo')!
    expect(r.q).toBe('moisture')
    expect(r.cota).toBeCloseTo(0.03, 6)
  })

  it('drenar una cualidad que el rol no tiene garantizada se avisa', () => {
    const p = plantilla('frotar-el-aliento-de-un-palo', {
      effects: [{ k: 'drain', q: 'stamina', on: 'a', porSegundo: 2 }],
    })
    const v = admit(p, phys)
    expect(v.ok).toBe(true)
    expect(tieneReparo(v, 'drenaje-sin-respaldo')).toBe(true)
  })

  it('una tasa más grande que el rango entero hace el efecto instantáneo', () => {
    const p = plantilla('secar-de-golpe', {
      effects: [{ k: 'drain', q: 'moisture', on: 'a', porSegundo: 100 }],
    })
    const r = admit(p, phys).advertencias.find((x) => x.codigo === 'tasa-mayor-que-el-rango')!
    expect(r.encontrado).toBe(100)
    expect(r.cota).toBe(1)
  })

  it('una completion sin rendimientos no hace nada al terminar', () => {
    const p = plantilla('esperar', { completion: { at: seg(0.5), yields: [] } })
    expect(tieneReparo(admit(p, phys), 'completion-sin-rendimientos')).toBe(true)
  })
})

describe('no-dominancia: la última puerta del almuerzo gratis', () => {
  it('la misma técnica con el costo bajado a mano no entra', () => {
    // Pasa las reglas 1, 2 y 3 sin despeinarse: declara `poweredBy`, drena una
    // cuenta conservada y la eficiencia es ≤ 1. Y sin embargo es `friccion` con
    // el precio cambiado. Abaratar el mundo es recalibrar la física, que sube
    // `version` e invalida los sellos, no proponer un clon.
    const drive = FRICCION.effects[0]
    if (drive?.k !== 'drive') throw new Error('friccion tiene que traer un drive')
    const barata = plantilla('frotar-barato', {
      roles: FRICCION.roles,
      effects: [{ ...drive, poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.9 } }],
      establishes: FRICCION.establishes,
    })
    const r = razonPorCodigo(admit(barata, phys), 'dominancia')
    expect(r.proceso).toBe('friccion')
    expect(r.q).toBe('stamina')
    expect(r.encontrado).toBeCloseTo(6.667, 3)
    expect(r.cota).toBeCloseTo(17.143, 3)
  })

  it('pero una técnica que pide MÁS no domina a nadie', () => {
    const drive = FRICCION.effects[0]
    if (drive?.k !== 'drive') throw new Error('friccion tiene que traer un drive')
    const exigente = plantilla('frotar-con-pedernal', {
      roles: [
        { name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.95 }] },
        { name: 'b', where: [{ q: 'rigidity', op: '>=', v: 0.95 }] },
        { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
      ],
      effects: [{ ...drive, poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.9 } }],
      establishes: FRICCION.establishes,
    })
    expect(codigos(admit(exigente, phys))).toEqual([])
  })
})

// ─── Regla 5 · ciclos ────────────────────────────────────────────────────────

const COSECHA: Process = {
  id: 'cosecha',
  lexeme: { nombre: 'cosechar' },
  roles: [
    { name: 'source', where: [{ q: 'mass', op: '>', v: 0 }] },
    { name: 'gear', where: [{ q: 'sharpness', op: '>=', v: 0.3 }] },
  ],
  arrangement: { k: 'within', radius: 1 },
  gate: [],
  effects: [],
  completion: { at: seg(0.5), yields: [{ k: 'drawFromStock', of: 'source', into: 'hands' }] },
  establishes: ['tensile>=0.5'],
  commitment: 'costly',
  trust: 'borrador',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'modelo' },
}

const AFILAR: Process = {
  id: 'afilar',
  lexeme: { nombre: 'afilar' },
  roles: [
    { name: 'hoja', where: [{ q: 'tensile', op: '>=', v: 0.5 }] },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
  ],
  arrangement: { k: 'held' },
  gate: [],
  effects: [
    {
      k: 'drive',
      q: 'sharpness',
      on: 'hoja',
      toward: 0.4,
      porSegundo: 0.2,
      poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.5 },
    },
  ],
  establishes: ['sharpness>=0.4'],
  commitment: 'costly',
  trust: 'borrador',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'modelo' },
}

/** Una vieja que hoy no pasaría: transfiere `stamina` desde una piedra caliente. */
const PIEDRA_BATERIA: Process = {
  id: 'piedra-bateria',
  lexeme: { nombre: 'sacarle aliento a la piedra' },
  roles: [
    { name: 'piedra', where: [{ q: 'temperature', op: '>=', v: 400 }] },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
  ],
  arrangement: { k: 'held' },
  gate: [],
  effects: [{ k: 'transfer', q: 'stamina', from: 'piedra', to: 'actor', porSegundo: 200 }],
  completion: { at: seg(0.5), yields: [] },
  establishes: ['stamina>=100'],
  commitment: 'reversible',
  trust: 'borrador',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'modelo' },
}

const FROTAR_PARA_LA_BATERIA: Process = {
  id: 'frotar-para-la-bateria',
  lexeme: { nombre: 'frotar fuerte' },
  roles: [
    { name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 50 }] },
  ],
  arrangement: { k: 'held' },
  gate: [],
  effects: [
    {
      k: 'drive',
      q: 'temperature',
      on: 'a',
      toward: 400,
      porSegundo: 120,
      poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.35 },
    },
  ],
  establishes: ['temperature>=400'],
  commitment: 'reversible',
  trust: 'borrador',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'modelo' },
}

describe('ciclos rentables', () => {
  it('los cuatro semilla no forman ninguno, y la búsqueda no se trunca', () => {
    for (const p of SEED_PROCESSES) {
      const b = ciclosPor(p, phys)
      expect([p.id, b.ciclos.filter((c) => c.aportes.length > 0).length, b.truncada]).toEqual([
        p.id,
        0,
        false,
      ])
    }
  })

  it('un ciclo que pasa por el aporte del dios se ADVIERTE, no se rechaza', () => {
    // Y tiene que ser así: `extraccion` es un ciclo rentable en `nutrition` por
    // construcción —para eso se pesca— y rechazarlo sería cerrar la única forma
    // de comer. Que rinda o no depende del stock y de su reposición, que son
    // estado del mundo, no propiedades del grafo.
    expect(admit(COSECHA, phys).ok).toBe(true)
    const conCosecha = buildSeedPhysics({ processes: [...SEED_PROCESSES, COSECHA] })
    const v = admit(AFILAR, conCosecha)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)
    expect(tieneReparo(v, 'ciclo-con-aporte')).toBe(true)
    const r = v.advertencias.find((x) => x.codigo === 'ciclo-con-aporte')!
    expect(r.mensaje).toContain('afilar → cosecha → afilar')
    expect(r.mensaje).toContain('estado del mundo')
  })

  it('un ciclo rentable SIN aporte sí se rechaza, con la cuenta y el número', () => {
    // La piedra-batería no pasaría hoy la regla 1, y así se comprueba primero.
    expect(tieneCodigo(admit(PIEDRA_BATERIA, phys), 'conservacion-transfer')).toBe(true)

    // Pero una física puede traer procesos viejos, admitidos bajo otra
    // calibración. El proceso nuevo no hace nada ilegal por su cuenta: lo único
    // que hace es CERRAR el lazo. Ése es el caso que la regla 5 atrapa y que
    // ninguna de las otras cuatro puede ver, porque no está en un proceso.
    const conVieja = buildSeedPhysics({ processes: [...SEED_PROCESSES, PIEDRA_BATERIA] })
    const v = admit(FROTAR_PARA_LA_BATERIA, conVieja)
    expect(v.ok).toBe(false)
    const r = razonPorCodigo(v, 'ciclo-rentable')
    expect(r.regla).toBe(5)
    expect(r.q).toBe('stamina')
    expect(r.encontrado).toBeCloseTo(82.857, 3)
    expect(r.mensaje).toContain('frotar-para-la-bateria → piedra-bateria → frotar-para-la-bateria')
  })

  it('un grafo que no se puede recorrer entero se corta y lo DICE', () => {
    // Enumerar caminos simples es exponencial. Grafo completo entre 30 procesos
    // al que se entra y del que no se vuelve: 30! caminos y ni un solo ciclo.
    // Sin presupuesto, la puerta no contesta nunca; con presupuesto, contesta y
    // avisa que no miró todo. Un juez que se cuelga es peor que uno que avisa.
    const muchos: Process[] = []
    for (let i = 0; i < 30; i++) {
      muchos.push(
        plantilla(`q${i}`, {
          roles: [{ name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.1 }] }],
          establishes: ['rigidity>=0.9'],
        }),
      )
    }
    const entrada = plantilla('entrada', {
      // Nadie puede volver acá: ningún `establishes` promete `toughness`.
      roles: [{ name: 'a', where: [{ q: 'toughness', op: '>=', v: 0.5 }] }],
      establishes: ['rigidity>=0.95'],
    })
    const grande = buildSeedPhysics({ processes: [...SEED_PROCESSES, ...muchos] })
    const b = ciclosPor(entrada, grande)
    expect(b.ciclos).toEqual([])
    expect(b.truncada).toBe(true)
    const v = admit(entrada, grande)
    expect(v.ok).toBe(true)
    expect(tieneReparo(v, 'ciclo-busqueda-truncada')).toBe(true)
  })

  it('el saldo declarado de todo semilla es ≤ 0 en toda cuenta conservada', () => {
    // Es la demostración de por qué la regla 5 no puede prometer más de lo que
    // promete: bajo las reglas 1 y 2 ningún proceso sube una conservada, así que
    // ningún ciclo puede ser rentable salvo por el agujero del dios.
    for (const p of SEED_PROCESSES) {
      for (const q of ['mass', 'nutrition', 'stamina', 'fuelEnergy'] as const) {
        expect([p.id, q, saldoDeclarado(p, q, phys) <= 0]).toEqual([p.id, q, true])
      }
    }
  })
})

// ─── El veredicto se lee ─────────────────────────────────────────────────────

describe('un rechazo que no se explica es inútil para la fragua', () => {
  it('junta TODAS las razones, no corta en la primera', () => {
    const desastre = plantilla('todo-mal', {
      roles: [{ name: 'a', where: [{ q: 'rigidity', op: '>=', v: 5 }] }],
      effects: [
        { k: 'drive', q: 'temperature', on: 'a', toward: 400, porSegundo: 120 },
        { k: 'drive', q: 'nutrition', on: 'a', toward: 50, porSegundo: 20 },
      ],
      physicsVersion: 42,
    })
    const v = admit(desastre, phys)
    expect(v.razones.length).toBeGreaterThanOrEqual(4)
    for (const c of ['fuera-de-rango', 'sube-gratis', 'conservacion-drive', 'version-de-fisica'] as const) {
      expect([c, tieneCodigo(v, c)]).toEqual([c, true])
    }
  })

  it('el texto trae la cualidad y los dos números', () => {
    const infinito = plantilla('frotar-infinito-2', {
      roles: FRICCION.roles,
      effects: [{ k: 'drive', q: 'temperature', on: 'a', toward: 400, porSegundo: 120 }],
      establishes: FRICCION.establishes,
    })
    const texto = porQue(admit(infinito, phys))
    expect(texto).toContain('RECHAZADO')
    expect(texto).toContain('regla 2')
    expect(texto).toContain('temperature')
    expect(texto).toContain('poweredBy')
  })

  it('y cuando admite, lo dice igual de claro', () => {
    expect(porQue(admit(UNION, phys))).toContain('ADMITIDO')
  })
})

describe('el paquete tiene puerta de entrada', () => {
  it('lo que el mundo va a importar sale por `index.ts`', async () => {
    // `export *` excluye en silencio los nombres que chocan entre módulos, así
    // que el typecheck de este `import` es la verificación: si dos archivos
    // exportaran lo mismo, el nombre desaparecería de la API pública sin que
    // nadie viera un error.
    const api = await import('../src/index.js')
    const nombres = [
      'admit',
      'admitSubstance',
      'buildSeedPhysics',
      'qualityOf',
      'nameOf',
      'specOf',
      'QUALITIES',
      'SEED_PROCESSES',
      'SUSTANCIAS_SEMILLA',
      'MAX_PARTS',
      'fx',
      'unfx',
    ] as const
    for (const n of nombres) expect([n, api[n] !== undefined]).toEqual([n, true])
  })
})
