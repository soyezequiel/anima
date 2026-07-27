// ─── Los tests de la resolubilidad ───────────────────────────────────────────
//
// La garantía que se prueba acá tapa un fallo SILENCIOSO, y eso manda sobre la
// forma de los tests: no alcanza con que `ensureSolvable` no lance. Hay que
// mostrar, con la física en la mano, que **la criatura puede sacar algo carnoso
// del agua con lo que quedó tirado alrededor** — armando la herramienta en el
// test, con `unir` de `@anima/physics`, sin usar ninguna función de este
// paquete para juzgar el resultado. Si el juicio lo diera el mismo código que
// hace la siembra, el test estaría de acuerdo consigo mismo y con nadie más.

import { describe, expect, it } from 'vitest'

import type { Body, Physics, Process, Substance } from '@anima/physics'
import { buildSeedPhysics, cumpleRol, EXTRACCION, fx, qualityOf, SEED_PROCESSES, unir } from '@anima/physics'

import type { ChunkSembrable, SueltaSembrable } from '../src/resolubilidad.js'
import {
  armables,
  chebyshev,
  ensureSolvable,
  esNucleoDeCarne,
  faltantesParaResolver,
  formaDeLoSuelto,
  PREDICADO_DE_CARNE,
  RADIO_DE_COPRESENCIA,
  rolesDelSuelo,
  sembrablesDelChunk,
} from '../src/resolubilidad.js'
import type { DiosRng } from '../src/pregunta.js'
import { mulberry32 } from '../src/pregunta.js'
import { CANTERA_DEL_MUNDO } from '../src/bioma.js'

const PHYS = buildSeedPhysics()

/** La cantera con la que decreta el mundo de verdad. Los tests de acá la usan
 *  tal cual: una cantera de test sería una garantía de test. */
const CANTERA = CANTERA_DEL_MUNDO

function chunkAcuatico(sueltas: SueltaSembrable[] = [], canteraLocal: readonly string[] = []): ChunkSembrable {
  return {
    cx: 3,
    cy: -7,
    acuatico: true,
    ancla: { x: 10, y: 10 },
    sueltas,
    cantera: CANTERA,
    canteraLocal,
  }
}

/** Un dado del dios que además cuenta las tiradas. La cuenta es dato: que no se
 *  tire cuando no falta nada es la mitad de la regla madre. */
function dadoContado(semilla: number): { rng: DiosRng; tiradas: () => number } {
  const base = mulberry32(semilla)
  let n = 0
  const f = ((): number => {
    n += 1
    return base()
  }) as DiosRng
  return { rng: f, tiradas: () => n }
}

function cuerpo(id: string, substance: string, form: Body['form'], mass: number): Body {
  return { id, form, parts: [{ substance, mass, q: {} }], joints: [], state: {} }
}

/** El rol `gear` de `extraccion`: `reach >= 2` y `catch > 0`. */
const GEAR = EXTRACCION.roles.find((r) => r.name === 'gear')!

/**
 * ¿Con estas sueltas se puede tener en la mano algo que sirva de aparejo?
 *
 * Escrito EN EL TEST y a mano: cuerpos sueltos, y cuerpos atados de a dos con
 * `unir` de la física. No usa `armables` del paquete a propósito.
 */
function hayAparejo(sueltas: readonly SueltaSembrable[], phys: Physics): boolean {
  const cuerpos = sueltas.map((s, i) => cuerpo(`x${String(i)}`, s.substance, s.form, s.mass))
  for (const b of cuerpos) if (cumpleRol(b, GEAR, phys)) return true
  for (const a of cuerpos) {
    for (const b of cuerpos) {
      if (a === b) continue
      const e = unir(a, undefined, b, phys, 'ensamble')
      if (e !== undefined && cumpleRol(e, GEAR, phys)) return true
    }
  }
  return false
}

describe('la garantía se cumple', () => {
  it('un chunk acuático pelado queda resoluble', () => {
    const chunk = chunkAcuatico()
    expect(faltantesParaResolver(chunk, SEED_PROCESSES, PHYS).length).toBeGreaterThan(0)

    const sembradas = ensureSolvable(chunk, SEED_PROCESSES, mulberry32(1), PHYS)

    expect(sembradas.length).toBeGreaterThan(0)
    expect(faltantesParaResolver(chunk, SEED_PROCESSES, PHYS)).toEqual([])
  })

  it('EL CRITERIO: con lo que quedó se arma un aparejo que la física acepta', () => {
    // Lo mismo que arriba, pero juzgado desde afuera: se arma la herramienta con
    // `unir` y se la mide con `cumpleRol`, que son las dos funciones con las que
    // el mundo va a juzgar a la criatura cuando intente pescar.
    for (let semilla = 0; semilla < 40; semilla++) {
      const chunk = chunkAcuatico()
      ensureSolvable(chunk, SEED_PROCESSES, mulberry32(semilla), PHYS)
      const cerca = chunk.sueltas.filter((s) => chebyshev(s.at, chunk.ancla) <= RADIO_DE_COPRESENCIA)
      expect(hayAparejo(cerca, PHYS)).toBe(true)
    }
  })

  it('ni la vara sola ni la hebra sola llenan el rol: por eso emerge la caña', () => {
    // Este test es el que explica el diseño. Una vara alcanza pero no engancha;
    // una hebra engancha pero no alcanza. Nadie escribió «caña» en ningún lado:
    // la caña es la única salida de esta aritmética.
    const vara = cuerpo('vara', 'madera', 'vara', 1)
    const hebra = cuerpo('hebra', 'liana', 'hebra', 0.3)

    expect(qualityOf(vara, 'reach', PHYS)).toBeGreaterThanOrEqual(2)
    expect(qualityOf(vara, 'catch', PHYS)).toBe(0)
    expect(qualityOf(hebra, 'catch', PHYS)).toBeGreaterThan(0)
    expect(qualityOf(hebra, 'reach', PHYS)).toBeLessThan(2)

    expect(cumpleRol(vara, GEAR, PHYS)).toBe(false)
    expect(cumpleRol(hebra, GEAR, PHYS)).toBe(false)

    const cana = unir(vara, undefined, hebra, PHYS, 'cana')!
    expect(cumpleRol(cana, GEAR, PHYS)).toBe(true)
  })

  it('barrido de 200 semillas: siempre resoluble y siempre a mano', () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const chunk = chunkAcuatico()
      const sembradas = ensureSolvable(chunk, SEED_PROCESSES, mulberry32(semilla), PHYS)
      expect(faltantesParaResolver(chunk, SEED_PROCESSES, PHYS)).toEqual([])
      for (const s of sembradas) {
        expect(chebyshev(s.at, chunk.ancla)).toBeLessThanOrEqual(RADIO_DE_COPRESENCIA)
      }
    }
  })
})

describe('el dado del dios y la regla madre', () => {
  it('el mismo dado siembra exactamente lo mismo', () => {
    const a = chunkAcuatico()
    const b = chunkAcuatico()
    ensureSolvable(a, SEED_PROCESSES, mulberry32(12345), PHYS)
    ensureSolvable(b, SEED_PROCESSES, mulberry32(12345), PHYS)
    expect(a.sueltas).toEqual(b.sueltas)
  })

  it('dos dados distintos pueden sembrar distinto (si no, el dado sería adorno)', () => {
    const vistos = new Set<string>()
    for (let semilla = 0; semilla < 60; semilla++) {
      const chunk = chunkAcuatico()
      ensureSolvable(chunk, SEED_PROCESSES, mulberry32(semilla), PHYS)
      vistos.add(JSON.stringify(chunk.sueltas))
    }
    expect(vistos.size).toBeGreaterThan(1)
  })

  it('volver a preguntar no siembra nada y NO TIRA EL DADO', () => {
    const chunk = chunkAcuatico()
    ensureSolvable(chunk, SEED_PROCESSES, mulberry32(7), PHYS)
    const cuantas = chunk.sueltas.length

    const segundo = dadoContado(7)
    const otra = ensureSolvable(chunk, SEED_PROCESSES, segundo.rng, PHYS)

    expect(otra).toEqual([])
    expect(chunk.sueltas.length).toBe(cuantas)
    expect(segundo.tiradas()).toBe(0)
  })

  it('tres tiradas por cosa sembrada: elegir, x, y', () => {
    const chunk = chunkAcuatico()
    const dado = dadoContado(99)
    const sembradas = ensureSolvable(chunk, SEED_PROCESSES, dado.rng, PHYS)
    expect(dado.tiradas()).toBe(3 * sembradas.length)
  })
})

describe('qué mira la garantía y qué no', () => {
  it('un chunk seco no se toca: la garantía es del bioma acuático', () => {
    const seco: ChunkSembrable = {
      cx: 0,
      cy: 0,
      acuatico: false,
      ancla: { x: 0, y: 0 },
      sueltas: [],
      cantera: CANTERA,
      canteraLocal: [],
    }
    const dado = dadoContado(3)
    expect(ensureSolvable(seco, SEED_PROCESSES, dado.rng, PHYS)).toEqual([])
    expect(seco.sueltas).toEqual([])
    expect(dado.tiradas()).toBe(0)
  })

  it('lo que está lejos no cuenta: co-presencia quiere decir en el lugar', () => {
    // Una vara y una liana perfectas, a cinco celdas. Con eso se armaría la caña
    // — pero no están «acá», así que la garantía tiene que sembrar igual.
    const lejos: SueltaSembrable[] = [
      { substance: 'madera', form: 'vara', mass: 1, at: { x: 16, y: 10 }, por: 'ruido' },
      { substance: 'liana', form: 'hebra', mass: 0.3, at: { x: 16, y: 11 }, por: 'ruido' },
    ]
    const chunk = chunkAcuatico([...lejos])
    expect(faltantesParaResolver(chunk, SEED_PROCESSES, PHYS).length).toBeGreaterThan(0)

    ensureSolvable(chunk, SEED_PROCESSES, mulberry32(4), PHYS)
    expect(chunk.sueltas.length).toBeGreaterThan(lejos.length)
    expect(faltantesParaResolver(chunk, SEED_PROCESSES, PHYS)).toEqual([])
  })

  it('si ya hay con qué, no siembra: el ruido amable se respeta', () => {
    const chunk = chunkAcuatico([
      { substance: 'madera', form: 'vara', mass: 1, at: { x: 11, y: 10 }, por: 'ruido' },
      { substance: 'liana', form: 'hebra', mass: 0.3, at: { x: 10, y: 9 }, por: 'ruido' },
    ])
    const dado = dadoContado(5)
    expect(ensureSolvable(chunk, SEED_PROCESSES, dado.rng, PHYS)).toEqual([])
    expect(dado.tiradas()).toBe(0)
  })

  it('el rol del actor lo llena la criatura, no el suelo', () => {
    // Un proceso núcleo que además pide un actor con stamina. Ninguna materia
    // tirada tiene stamina: sin la excepción, la garantía buscaría para siempre
    // y terminaría lanzando por algo que no está roto.
    const conActor: Process = {
      ...EXTRACCION,
      id: 'extraccion-con-actor',
      roles: [...EXTRACCION.roles, { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] }],
    }
    expect(rolesDelSuelo(conActor).map((r) => r.name)).toEqual(['gear', 'source'])

    const chunk = chunkAcuatico()
    expect(() => ensureSolvable(chunk, [conActor], mulberry32(1), PHYS)).not.toThrow()
    expect(faltantesParaResolver(chunk, [conActor], PHYS)).toEqual([])
  })

  it('el núcleo se reconoce por lo que ESTABLECE, no por su id', () => {
    expect(esNucleoDeCarne(EXTRACCION)).toBe(true)
    expect(EXTRACCION.establishes).toContain(PREDICADO_DE_CARNE)
    // Un proceso inventado mañana, con otro id, entra en la garantía solo con
    // declarar lo mismo.
    const inventado: Process = { ...EXTRACCION, id: 'arponear', establishes: [PREDICADO_DE_CARNE] }
    expect(esNucleoDeCarne(inventado)).toBe(true)
    // Y uno que no establece carne no la mira.
    const otro: Process = { ...EXTRACCION, id: 'sacar-piedras', establishes: ['holding(tag:mineral)'] }
    expect(esNucleoDeCarne(otro)).toBe(false)
    expect(faltantesParaResolver(chunkAcuatico(), [otro], PHYS)).toEqual([])
  })
})

describe('cuando no se puede, se dice', () => {
  it('lanza si el catálogo no tiene con qué enganchar', () => {
    // Un mundo de piedra: nada tiene flexibilidad, o sea que nada tiene punta
    // suelta, o sea que `catch` es cero en todo cuerpo posible. Eso es un mundo
    // donde no se puede pescar, y hay que enterarse AL DECRETARLO.
    const piedra = [...PHYS.substances.values()].find((s: Substance) => s.id === 'piedra')!
    const dePiedra = buildSeedPhysics({ substances: [piedra] })
    expect(() => ensureSolvable(chunkAcuatico(), SEED_PROCESSES, mulberry32(1), dePiedra)).toThrow(
      /no hay con qué llenar/,
    )
  })

  it('el mensaje dice qué rol y en qué chunk', () => {
    const piedra = [...PHYS.substances.values()].find((s: Substance) => s.id === 'piedra')!
    const dePiedra = buildSeedPhysics({ substances: [piedra] })
    try {
      ensureSolvable(chunkAcuatico(), SEED_PROCESSES, mulberry32(1), dePiedra)
      expect.unreachable('tenía que lanzar')
    } catch (e) {
      expect(String(e)).toContain('extraccion.gear')
      expect(String(e)).toContain('3,-7')
    }
  })
})

describe('las dos apuestas que este archivo hace sobre la física', () => {
  it('la flexibilidad no cambia con la masa: por eso deshilachar no agrega atadores', () => {
    // El cierre de `armables` no incluye deshilachar, y la razón es ésta:
    // `partir` a favor del grano escala la masa, y `flexibility` es intensiva.
    // Si algún día partir cambiara una intensiva, este test falla y el cierre se
    // quedó corto.
    const entera = cuerpo('corteza', 'corteza', 'vara', 1)
    const hebra = cuerpo('hebra', 'corteza', 'hebra', 0.1)
    expect(qualityOf(hebra, 'flexibility', PHYS)).toBe(qualityOf(entera, 'flexibility', PHYS))
    expect(qualityOf(hebra, 'flexibility', PHYS)).toBeLessThan(0.8)
  })

  it('atar es lo que fabrica el enganche, y por eso el cierre llega hasta ahí', () => {
    const cerca: SueltaSembrable[] = [
      { substance: 'madera', form: 'vara', mass: 1, at: { x: 10, y: 10 } },
      { substance: 'liana', form: 'hebra', mass: 0.3, at: { x: 10, y: 10 } },
    ]
    const cuerpos = armables(cerca, PHYS)
    // Cuatro: las dos sueltas y las dos formas de atarlas.
    expect(cuerpos.length).toBe(4)
    expect(cuerpos.filter((b) => cumpleRol(b, GEAR, PHYS)).length).toBeGreaterThan(0)
    expect(cuerpos.slice(0, 2).filter((b) => cumpleRol(b, GEAR, PHYS)).length).toBe(0)
  })
})

describe('la costura con lo que decreta el chunk', () => {
  it('lo flexible cae hecho hebra, lo rígido y no mineral hecho vara, lo demás bloque', () => {
    expect(formaDeLoSuelto('liana', PHYS)).toBe('hebra')
    expect(formaDeLoSuelto('madera', PHYS)).toBe('vara')
    expect(formaDeLoSuelto('hoja', PHYS)).toBe('bloque')
    expect(() => formaDeLoSuelto('unicornio', PHYS)).toThrow(/no conoce/)
  })

  it('lo mineral va a bloque aunque sea rigidísimo, y eso es a propósito', () => {
    // Adivinar de más —llamarle vara a un canto rodado— haría que la garantía
    // crea que el rol ya está lleno y no siembre: un chunk injugable, en
    // silencio. Adivinar de menos cuesta una suelta de más.
    expect(formaDeLoSuelto('piedra', PHYS)).toBe('bloque')
    expect(formaDeLoSuelto('pedernal', PHYS)).toBe('bloque')
  })

  it('el índice local se abre en x e y, y la masa deja de ser Fixed', () => {
    const sueltas = sembrablesDelChunk(
      [
        { substance: 'madera', i: 0, masa: fx(2) },
        { substance: 'liana', i: 17, masa: fx(0.5) },
      ],
      16,
      { x: 100, y: 200 },
      PHYS,
    )
    expect(sueltas[0]).toEqual({
      substance: 'madera',
      form: 'vara',
      mass: 2,
      at: { x: 100, y: 200 },
      por: 'ruido',
    })
    // 17 con 16 de lado es la fila 1, columna 1: el orden por filas del chunk.
    expect(sueltas[1]!.at).toEqual({ x: 101, y: 201 })
    expect(sueltas[1]!.form).toBe('hebra')
  })

  it('una celda fuera del chunk se dice, no se envuelve', () => {
    expect(() => sembrablesDelChunk([{ substance: 'madera', i: 256, masa: fx(1) }], 16, { x: 0, y: 0 }, PHYS)).toThrow(
      /fuera del chunk/,
    )
    expect(() => sembrablesDelChunk([], 0, { x: 0, y: 0 }, PHYS)).toThrow(/no es un chunk/)
  })

  it('de punta a punta: lo decretado alcanza y no hace falta sembrar', () => {
    // Una rama y una liana caídas en las dos celdas de al lado de la orilla. Con
    // la costura puesta, la garantía las ve, arma la caña y no agrega nada.
    const decretadas = sembrablesDelChunk(
      [
        { substance: 'madera', i: 16 * 10 + 10, masa: fx(1) },
        { substance: 'liana', i: 16 * 10 + 11, masa: fx(0.3) },
      ],
      16,
      { x: 0, y: 0 },
      PHYS,
    )
    const chunk: ChunkSembrable = {
      cx: 1,
      cy: 1,
      acuatico: true,
      ancla: { x: 10, y: 10 },
      sueltas: decretadas,
      cantera: CANTERA,
      canteraLocal: [],
    }
    const dado = dadoContado(1)
    expect(ensureSolvable(chunk, SEED_PROCESSES, dado.rng, PHYS)).toEqual([])
    expect(dado.tiradas()).toBe(0)
    expect(hayAparejo(chunk.sueltas, PHYS)).toBe(true)
  })
})

// ─── La cantera: qué puede caer del cielo y qué no ──────────────────────────
//
// El agujero que esto cierra estaba medido en `ataque-al-dios.test.ts`: la
// garantía buscaba en el catálogo ENTERO y dejaba en la orilla `agua/hebra`,
// `savia/hebra`, `pluma/hebra`, `piel/hebra` y `tendon/hebra`. Un hilo de agua
// atado a una vara llena el rol `gear` perfectamente —`agua` tiene
// `flexibility: 1`, así que `formaDeLoSuelto` la hace hebra y la hebra tiene
// `catch`—, y ése es justamente el punto: **llenar el rol no alcanza**. Lo que
// el dios deja tirado tiene que ser algo que ese mundo deje tirado.

describe('la cantera: la garantía siembra de lo que el mundo deja tirado', () => {
  it('lo que no está en la cantera NO cae, aunque llenaría el rol solo', () => {
    // La prueba es sobre `agua` a propósito, que es la que aparecía medida: una
    // cantera de dos sustancias, y el agua afuera.
    const chunk = chunkAcuatico([], [])
    const conDos: ChunkSembrable = { ...chunk, cantera: ['liana', 'madera'] }
    const sembradas = ensureSolvable(conDos, SEED_PROCESSES, dadoContado(11).rng, PHYS)
    expect(sembradas.length).toBeGreaterThan(0)
    expect(sembradas.every((s) => s.substance === 'liana' || s.substance === 'madera')).toBe(true)
    expect(hayAparejo(conDos.sueltas, PHYS)).toBe(true)

    // Y con el agua ADENTRO de la cantera sí caería: si no, este test estaría
    // pasando porque el agua no sirve y no porque la cantera la deja afuera.
    const conAgua: ChunkSembrable = { ...chunkAcuatico([], []), cantera: ['agua'] }
    const conElAgua = ensureSolvable(conAgua, SEED_PROCESSES, dadoContado(11).rng, PHYS)
    expect(conElAgua.length).toBeGreaterThan(0)
    expect(conElAgua.every((s) => s.substance === 'agua')).toBe(true)
  })

  it('una cantera con la que no se puede armar nada LANZA, y dice cuántas miró', () => {
    // La piedra no da `catch` de ninguna forma: ni como hebra (le falta
    // flexibilidad para tener puntas sueltas) ni como vara ni atada a sí misma.
    // La garantía no puede rendirse en silencio, que es todo el punto del
    // archivo: un chunk injugable tiene que doler al decretarlo.
    const soloPiedra: ChunkSembrable = { ...chunkAcuatico([], []), cantera: ['piedra'] }
    expect(() => ensureSolvable(soloPiedra, SEED_PROCESSES, dadoContado(4).rng, PHYS)).toThrow(/cantera/)
  })

  it('la cantera del lugar DESEMPATA y no restringe', () => {
    // Mismo chunk, mismo dado, misma cantera: lo único que cambia es qué da este
    // lugar. Con `junco` preferido sale junco; con `liana`, liana.
    function conPreferencia(local: readonly string[]): readonly string[] {
      const chunk = chunkAcuatico([], local)
      return ensureSolvable(chunk, SEED_PROCESSES, dadoContado(5).rng, PHYS).map((s) => s.substance)
    }
    const conJunco = conPreferencia(['junco', 'madera'])
    const conLiana = conPreferencia(['liana', 'madera'])
    expect(conJunco).toContain('junco')
    expect(conJunco).not.toContain('liana')
    expect(conLiana).toContain('liana')
    expect(conLiana).not.toContain('junco')

    // Y NO restringe: una preferencia por algo que no sirve para nada no puede
    // hacer que la garantía deje de cerrar. Si restringiera, esto lanzaría.
    const inutil = chunkAcuatico([], ['piedra'])
    expect(ensureSolvable(inutil, SEED_PROCESSES, dadoContado(5).rng, PHYS).length).toBeGreaterThan(0)
    expect(hayAparejo(inutil.sueltas, PHYS)).toBe(true)

    // Ni una preferencia vacía, que es el caso de siempre.
    const sinPreferencia = chunkAcuatico([], [])
    expect(ensureSolvable(sinPreferencia, SEED_PROCESSES, dadoContado(5).rng, PHYS).length).toBeGreaterThan(0)
    expect(hayAparejo(sinPreferencia.sueltas, PHYS)).toBe(true)
  })

  it('lo sembrado SIRVE: sin ello el rol no se llena, y con ello sí', () => {
    // «Que de verdad sirva para el rol que dice cubrir», medido: se le saca a un
    // chunk lo que la garantía puso y el aparejo desaparece. Si lo sembrado
    // fuera decorativo, el aparejo estaría igual sin ello.
    const chunk = chunkAcuatico([], [])
    const sembradas = ensureSolvable(chunk, SEED_PROCESSES, dadoContado(9).rng, PHYS)
    expect(sembradas.length).toBeGreaterThan(0)
    const puestas = new Set(sembradas)
    const sinLoSembrado = chunk.sueltas.filter((s) => !puestas.has(s))
    expect(hayAparejo(sinLoSembrado, PHYS)).toBe(false)
    expect(hayAparejo(chunk.sueltas, PHYS)).toBe(true)
    // Y no siembra de más: lo que puso es lo mínimo que hizo falta, o sea que
    // sacándole cualquiera de las piezas el aparejo se cae.
    for (const s of sembradas) {
      const menosUna = chunk.sueltas.filter((x) => x !== s)
      expect(hayAparejo(menosUna, PHYS)).toBe(false)
    }
    expect(faltantesParaResolver(chunk, SEED_PROCESSES, PHYS)).toEqual([])
  })
})
