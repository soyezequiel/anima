// ─── PUNTOS 3 Y 6 DEL GATE 5→6: la capacidad de un plano llega al planificador ──
//
// El punto 3 pide «publicación de capacidades al planificador», y desde el tramo A
// **cumplía para esquemas y no para planos**: una fila entraba por el overlay y la
// regresión la consumía igual que una del core, pero no había forma de convertir
// «esta obra se sabe construir» en una fila.
//
// El punto 6 pide separar construir de usar. `CatalogCapability.clase` los separa
// en el DATO desde el tramo A, y hasta acá **no los juzgaba nadie**: nada impedía
// publicar las dos con el mismo sello, que es tener un solo juicio con dos nombres.
//
// ─── EL CASO QUE HACE QUE EL PUNTO 6 SIGNIFIQUE ALGO ────────────────────────
//
// El asimétrico: **una obra bien construida cuyo uso no se demostró**. Publica
// capacidad de construir y ninguna de usar. Es literalmente la frase del §2 del
// criterio —«construir algo no demuestra que funcione»— vuelta un número.
//
// ─── Y EL PUNTO 3 NO CIERRA, Y ESE ES EL HALLAZGO ──────────────────────────
//
// Publicar quiere decir que el planificador PLANIFIQUE distinto: una fila que
// entra al catálogo y no cambia ningún plan no está publicada, está guardada.
//
// Este archivo pidió una meta que el core no sabe establecer, publicó la
// capacidad, y el planificador **la alcanzó y la rechazó**:
//
//   > el esquema de «reach>=5» por «union» no nombra «binder» ni «a», que «union»
//   > necesita sí o sí
//
// Un `ConstructionSchema` es UNA aplicación de UN proceso; armar un plano son
// **N−1 uniones encadenadas** con los roles del PLANO. La capacidad de construir
// no se puede decir con las dos clases de esquema que existen, y la salida fácil
// —publicar la fila con los roles de `union`— es una mentira medible.
//
// Queda como `it.fails` con el porqué medido, que es la regla del proyecto. Ver
// el bloque (3).

import { describe, expect, it } from 'vitest'

import {
  buildSeedPhysics,
  definirPlano,
  sellarHabilidad,
  type BlueprintCandidate,
  type BlueprintDefinition,
  type Physics,
  type QualityId,
} from '@anima/physics'
import type { BodyId, BodyView, Cell, CellQuality, Clock, SelfView, Tag, Where } from '@anima/skills'

import {
  CATALOGO_CORE,
  capacidadDe,
  conOverlay,
  esquemasDe,
  pedidosDelPlano,
  type CatalogCapability,
  type PlannerCatalogView,
} from '../src/catalogo.js'
import { plan } from '../src/regresion.js'
import type { ConstructionSchema, GoalNode, PlanResult, Predicado, VistaDelPlan } from '../src/tipos.js'

const PHYS: Physics = buildSeedPhysics()
/** La misma física con el número corrido. Es todo lo que el punto 9 necesita. */
const OTRA_FISICA: Physics = { ...PHYS, version: PHYS.version + 1 }

// ─── El candidato fijo del gate ─────────────────────────────────────────────
//
// Sin proveedor y sin fragua (§4 del criterio). Tres piezas y dos juntas, descritas
// en cualidades: no hay dónde escribir una sustancia, así que no hay dónde escribir
// un nombre especial.

const CANDIDATO: BlueprintCandidate = {
  parts: [
    { rol: 'brazo', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'cola', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
    { rol: 'punta', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
    { rol: 'atadura', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
  ],
  joints: [
    { a: 'brazo', b: 'cola', binder: 'atadura' },
    { a: 'cola', b: 'punta', binder: 'atadura' },
  ],
}

function definicion(phys: Physics = PHYS): BlueprintDefinition {
  const d = definirPlano(CANDIDATO, phys)
  if (d.k !== 'ok') throw new Error('el candidato del gate no se define')
  return d.def
}

// ─── Lo que la obra logra, según la corrida que lo demostró ─────────────────
//
// `reach >= 5` y no otra cosa: está medido en
// `physics/tests/la-obra-es-el-plano.test.ts` que esa obra mide **5,40** de alcance
// mientras cada hebra suelta mide 1,20. Y el core **no sabe establecerlo**: su fila
// más alta es `reach>=2`. O sea que esta capacidad agrega algo que antes no existía,
// que es la única forma de que «publicar» se pueda medir.

const LO_QUE_LOGRA = 'reach>=5'

function esquemaDeLaObra(def: BlueprintDefinition): ConstructionSchema {
  return {
    k: 'proceso',
    establishes: LO_QUE_LOGRA,
    via: 'union',
    // ─── EL ÚNICO PUENTE QUE SE DERIVA DEL PLANO ────────────────────────────
    // El resto lo trae la corrida. Ver el porqué en `capacidadDe`.
    roleHints: pedidosDelPlano(def),
    // Dos juntas, un segundo de mundo cada una. Medido en el tramo C·bis: una obra
    // de N piezas son N−1 uniones y cada `union` tarda un segundo.
    segundos: 2,
  }
}

// ─── La escena, calcada de `el-catalogo-es-una-vista` ───────────────────────

type Cualidades = Partial<Record<QualityId, number>>

function cuerpo(id: BodyId, x: number, y: number, tags: readonly Tag[] = []): BodyView {
  return { id, at: { x, y }, name: id, tags, madeByMe: false, joints: [] }
}

function criatura(): SelfView {
  return {
    id: 'yo',
    at: { x: 0, y: 0 },
    name: 'criatura',
    tags: [],
    madeByMe: false,
    joints: [],
    holding: [],
    capacity: 4,
    stamina: 1000,
    permits: 'reversible',
  }
}

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

/** Lo que hay en la orilla: una vara rígida y tres hebras flexibles. */
const CUERPOS: readonly BodyView[] = [
  cuerpo('vara', 1, 0),
  cuerpo('hebra-a', 2, 0),
  cuerpo('hebra-b', 3, 0),
  cuerpo('hebra-c', 4, 0),
]

const QS = new Map<BodyId, Cualidades>([
  ['vara', { rigidity: 0.7, flexibility: 0.2, tensile: 0.55, reach: 4, mass: 0.5 }],
  ['hebra-a', { rigidity: 0.15, flexibility: 0.9, tensile: 0.72, reach: 1.2, mass: 0.2 }],
  ['hebra-b', { rigidity: 0.15, flexibility: 0.9, tensile: 0.72, reach: 1.2, mass: 0.2 }],
  ['hebra-c', { rigidity: 0.15, flexibility: 0.9, tensile: 0.72, reach: 1.2, mass: 0.2 }],
])

function vista(): VistaDelPlan {
  const self = criatura()
  const qde = (b: BodyView, q: QualityId): number => {
    if (b.id === self.id && q === 'stamina') return self.stamina
    return QS.get(b.id)?.[q] ?? (q === 'portable' ? 1 : 0)
  }
  return {
    see: (w: Where): readonly BodyView[] =>
      CUERPOS.filter((b) =>
        w.every((t) => {
          const v = qde(b, t.q)
          return t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
        }),
      ),
    recall: () => [],
    q: qde,
    qAt: (_at: Cell, _q: CellQuality): number => 0,
    self,
    clock: RELOJ,
  }
}

/** La meta que el core NO sabe establecer: llegar a cinco. */
const ALCANZAR: Predicado = { k: 'cualidad', test: { q: 'reach', op: '>=', v: 5 } }

function meta(): GoalNode {
  return { id: 'g0', goal: ALCANZAR, after: [], porque: 'el criterio del gate' }
}

function planearCon(catalogo: PlannerCatalogView): PlanResult {
  return plan(meta(), vista(), 500, undefined, { catalogo })
}

// ─── Los sellos ─────────────────────────────────────────────────────────────

function sello(clase: 'construir' | 'usar', phys: Physics = PHYS) {
  const s = sellarHabilidad(clase, definicion(phys), `traza-de-${clase}`, phys)
  if (s.k !== 'ok') throw new Error(`no selló ${clase}`)
  return s.sello
}

function publicar(clase: 'construir' | 'usar', phys: Physics = PHYS): CatalogCapability {
  const p = capacidadDe(sello(clase, phys), esquemaDeLaObra(definicion(phys)), phys)
  if (p.k !== 'ok') throw new Error(`no publicó ${clase}`)
  return p.cap
}

// ─── (6) La asimetría: construir sin usar ───────────────────────────────────

describe('(6) construir y usar se publican por separado', () => {
  it('EL CASO QUE IMPORTA: se demostró construir y NO usar', () => {
    // Construir algo no demuestra que funcione. Con un solo sello, el catálogo
    // dice que se sabe armar y NO dice que sirva — que es la verdad, y es lo que
    // el juez del Hito 7 va a necesitar poder decir.
    const v = conOverlay(CATALOGO_CORE, [publicar('construir')])
    expect(v.buildCapabilities.length).toBe(1)
    expect(v.skillCapabilities).toEqual([])
    expect(v.buildCapabilities[0]?.de).toBe(definicion().revision)
  })

  it('y con los dos sellos, cada uno cae en su lista', () => {
    const v = conOverlay(CATALOGO_CORE, [publicar('construir'), publicar('usar')])
    expect(v.buildCapabilities.map((c) => c.clase)).toEqual(['construir'])
    expect(v.skillCapabilities.map((c) => c.clase)).toEqual(['usar'])
    // La misma revisión en las dos: son dos afirmaciones sobre el MISMO plano.
    expect(v.buildCapabilities[0]?.de).toBe(v.skillCapabilities[0]?.de)
  })

  it('y las dos clases NO dan el mismo catálogo: la identidad las distingue', () => {
    // Si el digest no mirara la clase, un catálogo que sabe construir y otro que
    // sabe usar serían el mismo, y una frontera guardada con uno se retomaría con
    // el otro.
    const soloConstruir = conOverlay(CATALOGO_CORE, [publicar('construir')])
    const soloUsar = conOverlay(CATALOGO_CORE, [publicar('usar')])
    expect(soloConstruir.registryDigest).not.toBe(soloUsar.registryDigest)
    expect(soloConstruir.catalogEpoch).not.toBe(soloUsar.catalogEpoch)
  })
})

// ─── (3) La fila LLEGA al planificador… y el planificador no la puede usar ──
//
// ─── EL HUECO QUE ESTE BLOQUE MIDIÓ, Y ES EL HALLAZGO DEL TRAMO F ───────────
//
// La fila entra, el planificador la ALCANZA —la expande, la considera— y la
// rechaza con una frase que hay que leer entera:
//
//   > el esquema de «reach>=5» por «union» no nombra «binder» ni «a», que «union»
//   > necesita sí o sí
//
// Un `ConstructionSchema` es **una aplicación de un proceso**, y sus `RoleName`
// son los de ESE proceso. Los roles de un plano son los del plano —`brazo`,
// `cola`, `punta`— y armar la obra son **N−1 uniones encadenadas**, no una.
//
// O sea que la capacidad de construir un plano NO SE PUEDE DECIR con las dos
// clases de esquema que existen. Y la salida fácil es una mentira medible:
// publicar la fila con los roles de `union` diría que un solo `union` alcanza
// para llegar a cinco, y la criatura ataría dos cosas y se quedaría a mitad de
// camino sin que nada se ponga rojo.
//
// Lo que el punto 3 necesita para cerrar es una **tercera clase de
// `ConstructionSchema` cuyo paso no sea `apply` sino «correr esta habilidad»**, y
// eso es la fragua del Hito 8 — no un ajuste de este archivo.

describe('(3) la capacidad del plano llega al planificador', () => {
  it('el core NO sabe llegar a cinco: sale `gap`', () => {
    // El control. Sin esto, lo de abajo mediría que el planificador funciona, no
    // que la fila nueva sea alcanzable.
    const r = planearCon(CATALOGO_CORE)
    expect(r.k).toBe('gap')
  })

  it('la fila publicada ENTRA al catálogo que el planificador lee', () => {
    const v = conOverlay(CATALOGO_CORE, [publicar('construir')])
    const filas = esquemasDe(v)
    expect(filas.length).toBe(CATALOGO_CORE.coreSchemas.length + 1)
    expect(filas.some((e) => e.establishes === LO_QUE_LOGRA)).toBe(true)
    // Y el catálogo cambió de identidad, que es lo que hace vencer una frontera.
    expect(v.catalogEpoch).not.toBe(CATALOGO_CORE.catalogEpoch)
  })

  it('y el planificador la ALCANZA: la expande y explica por qué no le sirve', () => {
    // La diferencia entre «la fila no está» y «la fila está y no se puede usar».
    // Sin esta distinción, el hueco de abajo se confundiría con no haber publicado.
    const r = planearCon(conOverlay(CATALOGO_CORE, [publicar('construir')]))
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.missing).toBe(LO_QUE_LOGRA)
    expect(r.why).toContain('union')
    expect(r.why).toContain('binder')
  })

  it.fails('HUECO — con la capacidad publicada tendría que salir plan', () => {
    // ─── EL HUECO, CON SU PORQUÉ MEDIDO ──────────────────────────────────────
    //
    // Marcado con `it.fails` y no borrado, que es la regla del proyecto para un
    // hueco abierto. Lo que falta no es código de este archivo: es que exista una
    // clase de esquema cuyo paso sea «correr la habilidad `construir` con este
    // plano» en vez de «aplicar este proceso con estos roles».
    //
    // Se pone verde solo el día que esa clase exista, y entonces hay que sacarle
    // el `.fails` — que es justamente para lo que sirve que esté escrito.
    const r = planearCon(conOverlay(CATALOGO_CORE, [publicar('construir')]))
    expect(r.k).toBe('plan')
  })

  it('`pedidosDelPlano` es el `pide` del plano REINDEXADO, no una copia a mano', () => {
    // Lo que SÍ se deriva del plano, y le sirve a quien tiene sus roles: el
    // constructor. Sin esto, quien construya transcribe las condiciones a mano y
    // una transcripción que diverge manda a juntar los ingredientes de otra obra.
    const def = definicion()
    const pedidos = pedidosDelPlano(def)
    expect(Object.keys(pedidos).sort()).toEqual(['atadura', 'brazo', 'cola', 'punta'])
    for (const p of def.parts) expect(pedidos[p.rol]).toBe(p.pide)
  })

  it('y el rol de ATADOR también viaja: hay que ir a buscarlo aunque se consuma', () => {
    // Medido en el tramo C·bis: una obra de N piezas gasta N−1 atadores, y son
    // cuerpos de verdad. Una lista sin el atador manda a la criatura a construir
    // con dos tercios de lo que necesita.
    expect(pedidosDelPlano(definicion())['atadura']).toEqual([{ q: 'flexibility', op: '>=', v: 0.8 }])
  })
})

// ─── (9) El sello vencido no entra ──────────────────────────────────────────

describe('(9) un sello contra otra física no se publica', () => {
  it('`capacidadDe` lo rechaza, con `version-de-fisica`', () => {
    const p = capacidadDe(sello('construir'), esquemaDeLaObra(definicion()), OTRA_FISICA)
    expect(p.k).toBe('rechazado')
    if (p.k !== 'rechazado') return
    expect(p.verdict.razones.map((r) => r.codigo)).toEqual(['version-de-fisica'])
  })

  it('y las DOS clases mueren juntas: no hay una que sobreviva a la otra', () => {
    for (const clase of ['construir', 'usar'] as const) {
      expect(capacidadDe(sello(clase), esquemaDeLaObra(definicion()), OTRA_FISICA).k).toBe('rechazado')
    }
  })

  it('el catálogo que queda es el core pelado, y el planificador vuelve a no saber', () => {
    // La consecuencia, dicha entera: al morir el sello no queda una fila huérfana
    // en el catálogo. La meta vuelve a ser inalcanzable, que es lo correcto — la
    // obra sigue existiendo, lo que ya no vale es la promesa sobre ella.
    const vivas: CatalogCapability[] = []
    for (const clase of ['construir', 'usar'] as const) {
      const p = capacidadDe(sello(clase), esquemaDeLaObra(definicion()), OTRA_FISICA)
      if (p.k === 'ok') vivas.push(p.cap)
    }
    const v = conOverlay(CATALOGO_CORE, vivas)
    expect(esquemasDe(v)).toBe(CATALOGO_CORE.coreSchemas)
    expect(planearCon(v).k).toBe('gap')
  })
})
