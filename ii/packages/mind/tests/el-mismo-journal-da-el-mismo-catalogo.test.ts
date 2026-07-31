// ─── PUNTO 10 DEL GATE 5→6 ──────────────────────────────────────────────────
//
//   > el **mismo journal produce el mismo mundo y el mismo catálogo**
//
// La primera mitad era cierta desde el Hito 2. La segunda **no existía**: el
// catálogo de una partida vivía en una variable que alguien pasaba de mano en
// mano, así que restaurar una partida devolvía el mundo de la partida con el
// catálogo del proceso. Un plan que dependía de una capacidad registrada en el
// tick 400 salía distinto al reproducirlo, y no había con qué notarlo.
//
// ─── ESTE ARCHIVO VIVE EN `@anima/mind` POR UNA RAZÓN DE GRAFO ─────────────
//
// Es el único paquete que depende de los DOS: `@anima/world` tiene el journal y
// `stepWorld`, `@anima/plan` tiene el catálogo, y el punto 10 habla de los dos a
// la vez. Poner el test en cualquiera de los dos habría obligado a abrir una
// arista que el diagrama no tiene — que es exactamente el motivo por el que el
// catálogo no vive adentro de `WorldState`.
//
// ─── LAS SEIS COSAS QUE SE MIDEN ───────────────────────────────────────────
//
//   (a) una crónica con las dos clases de renglón adentro se pliega DOS veces, y
//       las dos veces da lo mismo: mismo `worldHash` y mismo `registryDigest`;
//   (b) el ORDEN importa: el catálogo al comienzo del tick t tiene lo registrado
//       ANTES de t y no lo de t;
//   (c) el mundo NO se entera del catálogo: un renglón de registro no llega a
//       `stepWorld` y no mueve el `worldHash`;
//   (d) y el catálogo no se entera del mundo: mil intenciones no lo mueven;
//   (e) la crónica sobrevive al ARCHIVO: pasa por JSON, se revalida la cadena, y
//       las dos huellas siguen siendo las mismas;
//   (f) y la crónica DICE contra qué física se corrió, y lo hace cumplir al abrir.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type Physics } from '@anima/physics'
import {
  CATALOGO_CORE,
  capacidadDe,
  catalogoDeLaCronica,
  catalogoHasta,
  esRegistro,
  registrar,
  sinRegistros,
  type CatalogCapability,
  type RegistroDeCatalogo,
} from '@anima/plan'
import {
  CRONICA_POR_OMISION,
  createJournal,
  goTo,
  hashWorldState,
  journalFromData,
  replay,
  stepWorld,
  take,
  type Intent,
  type WorldState,
} from '@anima/world'
import { definirPlano, sellarHabilidad, type BlueprintCandidate, type BlueprintDefinition } from '@anima/physics'

import { actor, cuerpo, criatura, enElPiso, mundo, PHYS } from './mundo.js'

// ─── El candidato fijo del gate ─────────────────────────────────────────────

const CANDIDATO: BlueprintCandidate = {
  parts: [
    { rol: 'brazo', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'cola', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
    { rol: 'atadura', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
  ],
  joints: [{ a: 'brazo', b: 'cola', binder: 'atadura' }],
}

function definicion(phys: Physics = PHYS): BlueprintDefinition {
  const d = definirPlano(CANDIDATO, phys)
  if (d.k !== 'ok') throw new Error('el candidato del gate no se define')
  return d.def
}

function capacidad(clase: 'construir' | 'usar', firma: string): CatalogCapability {
  const s = sellarHabilidad(clase, definicion(), `traza-de-${clase}`, PHYS)
  if (s.k !== 'ok') throw new Error('no selló')
  const p = capacidadDe(
    s.sello,
    { k: 'proceso', establishes: firma, via: 'union', roleHints: { a: [], binder: [] }, segundos: 1 },
    PHYS,
  )
  if (p.k !== 'ok') throw new Error('no publicó')
  return p.cap
}

// ─── La crónica: intenciones y registros mezclados, en un solo orden ────────

/** Lo que viaja en el journal de una partida: las dos clases de renglón. */
type Renglon = Intent | RegistroDeCatalogo

const REGISTRO_TEMPRANO = 3
const REGISTRO_TARDIO = 7
const ULTIMO_TICK = 10

/**
 * La crónica de la partida, escrita una sola vez y usada por los dos lectores.
 *
 * Los registros caen en el 3 y en el 7, con intenciones antes, en el medio y
 * después: si el pliegue del catálogo dependiera de la POSICIÓN en el arreglo en
 * vez del tick, esto lo mostraría.
 */
function cronica(): ReturnType<typeof createJournal<Renglon>> {
  const j = createJournal<Renglon>()
  j.append(0, goTo({ by: 'ana', seq: 0 }, { x: 3, y: 0 }, 0))
  j.append(1, goTo({ by: 'ana', seq: 0 }, { x: 3, y: 0 }, 0))
  j.append(REGISTRO_TEMPRANO, registrar(capacidad('construir', 'reach>=5')))
  j.append(4, take({ by: 'ana', seq: 0 }, 'vara'))
  j.append(REGISTRO_TARDIO, registrar(capacidad('usar', 'catch>0.1')))
  j.append(9, goTo({ by: 'ana', seq: 0 }, { x: 0, y: 0 }, 0))
  return j
}

function escena(): WorldState {
  return mundo({
    bodies: [enElPiso(criatura('ana', 2000), { x: 0, y: 0 }), enElPiso(cuerpo('vara', 'madera', 0.5), { x: 3, y: 0 })],
    actors: [actor('ana', { capacity: 4 })],
  })
}

/** El pliegue del MUNDO: los renglones de catálogo no llegan a `stepWorld`. */
function mundoDe(j: ReturnType<typeof createJournal<Renglon>>, hasta = ULTIMO_TICK): WorldState {
  return replay(
    sinRegistros(j.entries()),
    { tick: 0, state: escena() },
    (s, is, _t) => stepWorld(s, is as readonly Intent[]).state,
    { hasta },
  )
}

// ─── (a) Las dos huellas, dos veces ─────────────────────────────────────────

describe('(a) la misma crónica da el mismo mundo Y el mismo catálogo', () => {
  it('dos pliegues independientes coinciden en las DOS huellas', () => {
    const a = cronica()
    const b = cronica()
    expect(hashWorldState(mundoDe(a))).toBe(hashWorldState(mundoDe(b)))
    expect(catalogoDeLaCronica(CATALOGO_CORE, a.entries()).registryDigest).toBe(
      catalogoDeLaCronica(CATALOGO_CORE, b.entries()).registryDigest,
    )
  })

  it('y el catálogo del final NO es el core: la partida registró de verdad', () => {
    // El control. Sin esto, el bloque de arriba lo cumpliría una función que
    // ignorara la crónica entera y devolviera siempre el core.
    const v = catalogoDeLaCronica(CATALOGO_CORE, cronica().entries())
    expect(v.registryDigest).not.toBe(CATALOGO_CORE.registryDigest)
    expect(v.buildCapabilities.length).toBe(1)
    expect(v.skillCapabilities.length).toBe(1)
  })
})

// ─── (b) El orden ───────────────────────────────────────────────────────────

describe('(b) el catálogo al comienzo del tick t tiene lo de ANTES de t', () => {
  it('la línea de tiempo entera, tick por tick', () => {
    const j = cronica()
    const cuantas = (t: number): number => {
      const v = catalogoHasta(CATALOGO_CORE, j.entries(), t)
      return v.buildCapabilities.length + v.skillCapabilities.length
    }
    const filas: string[] = []
    for (let t = 0; t <= ULTIMO_TICK; t++) filas.push(`  tick ${String(t).padStart(2)} → ${String(cuantas(t))}`)
    console.log(`\n─── CUÁNTAS CAPACIDADES TENÍA EN CADA TICK ───\n${filas.join('\n')}\n`)

    // Antes del primer registro: ninguna.
    expect(cuantas(REGISTRO_TEMPRANO)).toBe(0)
    // Justo después: una. El registro del tick 3 se consume DURANTE el 3.
    expect(cuantas(REGISTRO_TEMPRANO + 1)).toBe(1)
    expect(cuantas(REGISTRO_TARDIO)).toBe(1)
    expect(cuantas(REGISTRO_TARDIO + 1)).toBe(2)
  })

  it('y un corrimiento de UN tick cambia el catálogo, que es por qué la convención importa', () => {
    // La convención es la misma del journal del mundo —`tick: t` se consume
    // DURANTE t— y acá se afirma que no es cosmética: con el corrimiento, la
    // criatura planificaría con una capacidad que todavía no tiene. Eso no da un
    // error: da un plan coherente y equivocado.
    const j = cronica()
    const enT = catalogoHasta(CATALOGO_CORE, j.entries(), REGISTRO_TEMPRANO)
    const enTmas1 = catalogoHasta(CATALOGO_CORE, j.entries(), REGISTRO_TEMPRANO + 1)
    expect(enT.catalogEpoch).not.toBe(enTmas1.catalogEpoch)
  })
})

// ─── (c) y (d) Los dos lectores no se pisan ─────────────────────────────────

describe('(c) el mundo no se entera del catálogo', () => {
  it('los renglones de registro no llegan a `stepWorld`', () => {
    // `sinRegistros` es la única puerta, y acá se afirma que filtra lo que dice.
    const j = cronica()
    expect(j.entries().length).toBe(6)
    expect(sinRegistros(j.entries()).length).toBe(4)
    expect(sinRegistros(j.entries()).some((r) => esRegistro(r.intent))).toBe(false)
  })

  it('y el `worldHash` es el mismo con y sin los registros adentro de la crónica', () => {
    // La afirmación fuerte: registrar una capacidad NO mueve la huella del mundo.
    // Si la moviera, una partida en la que no pasó nada físico tendría otro hash y
    // el juez del determinismo no podría distinguir un bug de un registro.
    const conRegistros = cronica()
    const soloMundo = createJournal<Renglon>()
    for (const e of sinRegistros(conRegistros.entries())) soloMundo.append(e.tick, e.intent)
    expect(hashWorldState(mundoDe(conRegistros))).toBe(hashWorldState(mundoDe(soloMundo)))
  })
})

describe('(d) el catálogo no se entera del mundo', () => {
  it('agregar intenciones no mueve el `registryDigest`', () => {
    const j = cronica()
    const antes = catalogoDeLaCronica(CATALOGO_CORE, j.entries()).registryDigest
    for (let t = ULTIMO_TICK; t < ULTIMO_TICK + 200; t++) {
      j.append(t, goTo({ by: 'ana', seq: 0 }, { x: 1, y: 1 }, 0))
    }
    expect(catalogoDeLaCronica(CATALOGO_CORE, j.entries()).registryDigest).toBe(antes)
  })
})

// ─── (e) La ida y vuelta por el archivo ─────────────────────────────────────

describe('(e) la crónica sobrevive al archivo, con las dos huellas', () => {
  it('por JSON, revalidando la cadena, y las dos huellas siguen iguales', () => {
    // Por JSON A PROPÓSITO y no clonando objetos: un guardado de verdad pasa por
    // texto, y ahí es donde un `Map` se vuelve `{}` en silencio. Es el mismo
    // criterio con el que se cerró el punto 8.
    const original = cronica()
    const vuelto = journalFromData<Renglon>(JSON.parse(JSON.stringify(original.toData())) as never)

    expect(vuelto.chain).toBe(original.chain)
    expect(hashWorldState(mundoDe(vuelto))).toBe(hashWorldState(mundoDe(original)))
    expect(catalogoDeLaCronica(CATALOGO_CORE, vuelto.entries()).registryDigest).toBe(
      catalogoDeLaCronica(CATALOGO_CORE, original.entries()).registryDigest,
    )
  })

  it('y `esRegistro` no le cree a lo que viene del archivo: lo comprueba', () => {
    // Lo que vuelve de un JSON no tiene tipos. Un `as` acá sería una afirmación
    // sin nada que la sostenga, y el síntoma de equivocarse es un `undefined`
    // adentro del catálogo mil ticks después.
    expect(esRegistro({ k: 'registrar', clase: 'construir', de: 'x', esquema: {} })).toBe(true)
    expect(esRegistro({ k: 'registrar', clase: 'otra', de: 'x', esquema: {} })).toBe(false)
    expect(esRegistro({ k: 'registrar', clase: 'construir', de: 'x' })).toBe(false)
    expect(esRegistro(goTo({ by: 'ana', seq: 0 }, { x: 0, y: 0 }, 0))).toBe(false)
    expect(esRegistro(null)).toBe(false)
    expect(esRegistro('registrar')).toBe(false)
  })

  it('y ninguna clase de `Intent` del mundo se llama `registrar`', () => {
    // ─── EL GUARDIAN, Y ESTUVO ESCRITO MAL ────────────────────────────────────
    //
    // La primera version comparaba contra un arreglo literal escrito tres lineas
    // mas arriba en el mismo test. Eso es cierto por construccion y no puede
    // fallar nunca: el dia que el mundo agregara una decima clase llamada
    // `registrar`, el guardian habria seguido verde.
    //
    // Ahora lee LA FUENTE del mundo y saca las clases de ahi. Es un guardian de
    // texto, igual que el de los nombres especiales y el de los caracteres de
    // control, y por el mismo motivo: `Intent['k']` es un tipo, y un tipo no
    // existe en tiempo de ejecucion para poder recorrerlo.
    const fuente = readFileSync(fileURLToPath(new URL('../../world/src/intent.ts', import.meta.url)), 'utf8')
    const clases = [...fuente.matchAll(/readonly k: '([a-zA-Z-]+)'/g)].map((m) => m[1])
    // El control de que el guardian sabe leer: si el regex dejara de encontrar
    // nada, el `not.toContain` de abajo pasaria sin haber mirado nada.
    expect(clases).toContain('place')
    expect(clases).toContain('apply')
    expect(clases.length).toBeGreaterThanOrEqual(9)
    expect(clases).not.toContain('registrar')
  })
})

// ─── (f) La crónica dice contra qué FÍSICA se corrió ───────────────────────
//
// Era un hueco marcado con `it.fails` y se cerró en el mismo tramo. El argumento
// es el mismo con el que entró la semilla, y está escrito en `CronicaDe`: es LO
// OTRO que hay que volver a tener para llegar al mismo lado.
//
// El síntoma que tapa es de este punto y de ningún otro: la crónica lleva ahora
// los REGISTROS de catálogo, cada uno nombra una revisión de plano, y una revisión
// lleva la versión de física adentro del hash. Cargarla contra otra física
// reconstruye un catálogo cuyas revisiones no nombran ningún plano existente. No
// falla: da una partida coherente y equivocada.

describe('(f) la crónica dice contra qué física se corrió, y lo hace cumplir', () => {
  it('el campo está, y vale la versión de la física semilla', () => {
    expect(cronica().toData().de.physicsVersion).toBe(buildSeedPhysics().version)
  })

  it('cargarla contra OTRA física revienta al abrirla, no mil ticks después', () => {
    const data = JSON.parse(JSON.stringify(cronica().toData())) as never
    const otra = { ...CRONICA_POR_OMISION, physicsVersion: PHYS.version + 1 }
    expect(() => journalFromData<Renglon>(data, otra)).toThrow(/física/)
    expect(() => journalFromData<Renglon>(data, otra)).toThrow(/revisiones de plano/)
    // Y contra la suya, entra sin chistar.
    expect(journalFromData<Renglon>(data, CRONICA_POR_OMISION).length).toBe(6)
  })

  it('y una crónica SIN el campo tampoco se carga: no se le adivina la física', () => {
    // Rellenarlo con un default es exactamente el modo de falla que el campo vino
    // a sacar. Un archivo de antes de este campo es un archivo del que no se sabe
    // contra qué corrió, y lo correcto es que reviente al abrirlo.
    const data = cronica().toData()
    const viejo = { ...data, de: { hz: data.de.hz, semilla: data.de.semilla } }
    expect(() => journalFromData<Renglon>(viejo as never)).toThrow(/versión de física/)
  })
})
