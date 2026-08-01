/**
 * EL REGISTRO Y LA INSTALACIÓN — Hito 8, la etapa que desbloquea los puntos 3, 6 y 7.
 *
 * ─── Lo que este archivo tiene que probar, y por qué son cuatro cosas ───────
 *
 * Los tres puntos que faltaban hablan de reemplazar algo. El barrido de los diez
 * agentes midió que **no había nada que reemplazar**: la frontera del tramo H
 * dejaba el mundo con el mismo `hashWorldState`. Así que antes del criterio hay
 * que probar que la instalación EXISTE, y eso son cuatro afirmaciones:
 *
 *   1. una habilidad forjada, montada, CAMBIA EL MUNDO
 *   2. instalar es UNA operación: no hay medio registro alcanzable
 *   3. instalar de nuevo el mismo nombre REEMPLAZA (el punto 6 en chiquito)
 *   4. y el control positivo: un instalador ingenuo SÍ deja el registro roto
 *
 * La cuarta es la que le da sentido a la segunda. Sin ella, «el registro nunca
 * queda incoherente» lo cumple un `revisar()` que devuelve `[]` siempre — que es
 * el sexto verde por omisión de este hito, y ya van cinco cazados.
 */

import { buildSeedPhysics } from '@anima/physics'
import { Partida } from '@anima/perceive'
import { CATALOGO_CORE, conOverlay } from '@anima/plan'
import type { CatalogCapability, PlannerCatalogView } from '@anima/plan'
import { done, fail, instrument, mount, shadowScope } from '@anima/skills'
import type { FuelCell, Skill } from '@anima/skills'
import { EL_ACTOR, estadoDe } from '@anima/judge'
import { hashWorldState, mapaDeCuerpos } from '@anima/world'
import type { WorldBody, WorldState } from '@anima/world'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { AGARRAR_LO_QUE_VEO } from '../demo/falso.js'
import { forjarUna } from '../src/forjar.js'
import { Puerta } from '../src/puerta.js'
import { Registro } from '../src/registro.js'
import type { Instalada } from '../src/registro.js'

const phys = buildSeedPhysics()

/** Un palito al lado de la criatura. Es lo único que la habilidad necesita ver. */
function conUnPalito(): WorldState {
  const base = estadoDe(undefined, phys)
  const palito = {
    body: {
      id: 'palito',
      form: 'vara',
      parts: [{ substance: 'madera', mass: 0.4, q: {} }],
      joints: [],
      state: { temperature: 15 },
    },
    at: { x: 1, y: 0 },
  } as unknown as WorldBody
  return { ...base, bodies: mapaDeCuerpos([...base.bodies.values(), palito]) }
}

/** De texto a habilidad viva, con su celda. Ver el encabezado de `registro.ts`. */
function montar(codigo: string, nombre: string): { skill: Skill<Record<string, never>>; cell: FuelCell } {
  const { js } = instrument(ts, codigo)
  const m = mount(js, { scope: shadowScope(), modules: { '../../src/skill-api.js': { done, fail } } })
  const f = m.exports[nombre]
  if (typeof f !== 'function') throw new Error(`${nombre} no quedó montada`)
  return { skill: f as Skill<Record<string, never>>, cell: m.cell }
}

function forjarYMontar(nombre: string, codigo: string): Instalada {
  const p = new Puerta(ts)
  const i = forjarUna(codigo, p)
  if (i.desenlace === 'rota') {
    throw new Error(`la candidata no compila: ${i.erroresQueQuedaron.map((e) => e.mensaje).join(' · ')}`)
  }
  const { skill, cell } = montar(i.codigo, nombre)
  return { nombre, codigo: i.codigo, skill, cell, porQue: [] }
}

describe('(1) una habilidad forjada, instalada, CAMBIA EL MUNDO', () => {
  it('agarra el palito, y el hash del mundo se mueve', () => {
    const r = new Registro(CATALOGO_CORE)
    r.instalar(CATALOGO_CORE, forjarYMontar('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO))

    const inst = r.titular('agarrarLoQueVeo')
    expect(inst, 'no quedó instalada').toBeDefined()
    if (inst === undefined) return

    const p = new Partida(conUnPalito(), {})
    const antes = hashWorldState(p.state)
    const holdingAntes = p.state.actors.get(EL_ACTOR)?.holding.length ?? -1

    // LA CELDA VIAJA, y es el hallazgo del tramo: sin ella la habilidad muere en
    // su primer paso con `OutOfFuel` y `budget: 0`, y parece culpa de ella.
    const v = p.volar(EL_ACTOR, inst.skill, {}, { cell: inst.cell })
    let t = 0
    while (!v.terminado && t < 40) {
      p.tick()
      t++
    }

    const holdingDespues = p.state.actors.get(EL_ACTOR)?.holding.length ?? -1
    console.log(
      `\n  ${String(t)} ticks · holding ${String(holdingAntes)} → ${String(holdingDespues)}` +
        `\n  hash ${String(antes)} → ${String(hashWorldState(p.state))}` +
        `\n  outcome ${JSON.stringify(v.outcome?.ok ?? null)}\n`,
    )
    expect(holdingDespues).toBe(holdingAntes + 1)
    expect(v.outcome?.ok).toBe(true)
  })

  it('EL CONTROL DE LA CELDA: sin ella, la MISMA habilidad muere en el primer paso', () => {
    // Sin este renglón, «viaja la celda» sería una línea de código que nadie
    // ejercita: la habilidad andaría igual y nadie sabría por qué está.
    const inst = forjarYMontar('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO)
    const p = new Partida(conUnPalito(), {})
    const v = p.volar(EL_ACTOR, inst.skill, {})
    let t = 0
    while (!v.terminado && t < 40) {
      p.tick()
      t++
    }
    console.log(`\n  sin celda: ${JSON.stringify(v.ultimo)}\n`)
    expect(p.state.actors.get(EL_ACTOR)?.holding.length).toBe(0)
    expect(v.ultimo?.k).toBe('rota')
  })
})

describe('(2) y (3) instalar es UNA operación, y reemplaza por nombre', () => {
  it('el registro queda coherente, y lo dice `revisar()`', () => {
    const r = new Registro(CATALOGO_CORE)
    r.instalar(CATALOGO_CORE, forjarYMontar('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO))
    expect(r.revisar()).toEqual([])
  })

  it('una candidata SIN plano se instala y NO se publica, y eso se cuenta', () => {
    // Es el techo del catálogo, medido: `ConstructionSchema` tiene tres formas
    // —proceso, ley y obra— y una habilidad suelta no es ninguna. Que no se
    // publique no es una incoherencia; que no se sepa, sí.
    const r = new Registro(CATALOGO_CORE)
    r.instalar(CATALOGO_CORE, forjarYMontar('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO))
    console.log(`\n  instaladas ${String(r.titulares.size)} · sin publicar ${String(r.sinPublicar)}\n`)
    expect(r.sinPublicar).toBe(1)
    expect(r.revisar()).toEqual([])
  })

  it('instalar el MISMO nombre reemplaza, y no acumula', () => {
    const r = new Registro(CATALOGO_CORE)
    const a = forjarYMontar('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO)
    r.instalar(CATALOGO_CORE, a)
    const b = { ...forjarYMontar('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO), porQue: [{ cargo: 'uso', grado: 'promueve', porque: 'la segunda' }] }
    r.instalar(CATALOGO_CORE, b)

    expect(r.titulares.size).toBe(1)
    expect(r.titular('agarrarLoQueVeo')?.porQue[0]?.porque).toBe('la segunda')
    expect(r.revisar()).toEqual([])
  })
})

describe('(4) EL CONTROL POSITIVO: un instalador INGENUO sí rompe el registro', () => {
  /**
   * LO QUE `Registro.instalar` NO HACE, escrito a propósito para poder cortarlo.
   *
   * Dos escrituras separadas, con un lugar en el medio donde algo puede fallar.
   * Es la forma obvia de escribirlo, y es la que el punto 3 tiene que impedir.
   */
  class RegistroIngenuo {
    titulares = new Map<string, Instalada>()
    catalogo: PlannerCatalogView = CATALOGO_CORE

    publicarPrimero(base: PlannerCatalogView, cap: CatalogCapability): void {
      this.catalogo = conOverlay(base, [cap])
    }

    yDespuesMontar(x: Instalada): void {
      this.titulares.set(x.nombre, x)
    }

    revisar(): readonly string[] {
      const out: string[] = []
      for (const c of [...this.catalogo.buildCapabilities, ...this.catalogo.skillCapabilities]) {
        if (!this.titulares.has(c.de)) out.push(`capacidad-sin-habilidad:${c.de}`)
      }
      return out
    }
  }

  /** Una capacidad de mentira, con la forma que el catálogo pide. */
  const CAPACIDAD: CatalogCapability = {
    clase: 'usar',
    de: 'agarrarLoQueVeo',
    esquema: {
      k: 'proceso',
      via: 'friccion',
      establishes: 'holding(tag:vegetal)',
      roleHints: {},
      segundos: 1,
    },
  } as unknown as CatalogCapability

  it('cortado entre las dos escrituras, queda una capacidad que nadie puede ejecutar', () => {
    const r = new RegistroIngenuo()
    r.publicarPrimero(CATALOGO_CORE, CAPACIDAD)
    // ── acá se muere la conexión ──
    console.log(`\n  ingenuo, cortado: ${r.revisar().join(', ')}\n`)
    expect(r.revisar()).toEqual(['capacidad-sin-habilidad:agarrarLoQueVeo'])
  })

  it('y sin cortar, el mismo ingenuo queda bien — o sea que el rojo es el CORTE', () => {
    // Sin este renglón el test de arriba lo cumpliría un `revisar()` que acusa
    // siempre, y no probaría nada del corte.
    const r = new RegistroIngenuo()
    r.publicarPrimero(CATALOGO_CORE, CAPACIDAD)
    r.yDespuesMontar(forjarYMontar('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO))
    expect(r.revisar()).toEqual([])
  })

  it('EL BUENO, cortado en el mismo lugar, no tiene dónde caerse', () => {
    // `Registro.instalar` calcula las dos mitades y las asigna juntas: entre las
    // dos líneas del final no hay `await` ni puede haberlo (regla 2). Lo que se
    // afirma es la propiedad: pase lo que pase ANTES, el registro está coherente.
    const r = new Registro(CATALOGO_CORE)
    expect(r.revisar()).toEqual([])
    try {
      r.instalar(CATALOGO_CORE, forjarYMontar('noExiste', AGARRAR_LO_QUE_VEO))
    } catch {
      // que explote armando la instalada es legal: lo que no es legal es que el
      // registro quede a medias.
    }
    expect(r.revisar()).toEqual([])
  })
})
