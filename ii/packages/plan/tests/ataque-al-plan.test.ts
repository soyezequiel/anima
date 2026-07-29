// ─── ATAQUE AL PLAN — los diez hallazgos, y qué contesta el paquete hoy ──────
//
//   pnpm --filter @anima/plan test ataque-al-plan
//
// Este archivo NO prueba que el planificador ande. Eso lo hacen los otros ocho.
// Este archivo nació PINANDO DEFECTOS: cada `expect` afirmaba lo que el paquete
// hacía sabiendo que estaba mal, para que arreglar uno pusiera el archivo en
// rojo. Se arreglaron, así que el archivo se dio vuelta y ahora cada caso pina
// LO CONTRARIO —la conducta reparada— con el defecto viejo escrito al lado y con
// el mismo escenario que lo encontró. Los casos no se borraron: un hallazgo que
// se arregla y se borra vuelve.
//
// ─── LA REGLA DEL ARCHIVO ───────────────────────────────────────────────────
//
// Un defecto que termina en «el mundo lo rechaza» se demuestra CONTRA EL MUNDO,
// no contra una vista de mentira: se arma un `WorldState` con `stepWorld`, se le
// da al planificador una `VistaDelPlan` leída de ESE mundo con `qualityOf`, y el
// plan que sale se ejecuta ahí mismo. Un `Motivo` del mundo no se puede discutir.
// Y la reparación se prueba igual: el plan nuevo se ejecuta en el mismo mundo y
// se afirma que la lista de rechazos está VACÍA. Que no haya plan es fácil; que
// el plan que sale lo acepte el mundo es lo que había que conseguir.
//
// ─── LO QUE AGUANTÓ DESDE EL PRINCIPIO ──────────────────────────────────────
//
// El anytime. 105 escenarios (7 metas × 5 vistas × 3 tablas) cortados de a 1, 2,
// 3, 5 y 7 expansiones y reanudados hasta terminar: 525 comparaciones, CERO
// divergencias contra la corrida entera. Está abajo, corriendo, y no de adorno:
// es el invariante del que depende que D4 entre en el tick. Sigue en cero
// divergencias después de las siete reparaciones, incluida la que le sacó un
// campo a la frontera.

import { describe, expect, it } from 'vitest'

import type { Body, Physics, QualityId } from '@anima/physics'
import {
  HZ_DE_REFERENCIA,
  T_AMBIENTE,
  buildSeedPhysics,
  evalQuality,
  nameOf,
  qualityOf,
  tagsDe,
  specOf,
  unir,
} from '@anima/physics'
import {
  apply,
  chebyshev,
  goTo,
  mapaDeActores,
  mapaDeCuerpos,
  stepWorld,
  take,
  type CellKey,
  type CellState,
  type Placement,
  type SimEvent,
  type WorldBody,
  type WorldState,
} from '@anima/world'
import type { BodyId, BodyView, Cell, CellQuality, Clock, SelfView, Tag, Where } from '@anima/skills'

import { ESQUEMAS } from '../src/esquemas.js'
import { plan } from '../src/regresion.js'
import type { ConstructionSchema, GoalNode, PlanResult, Predicado, Step, VistaDelPlan } from '../src/tipos.js'

// ─── El mundito de mentira, para los defectos que no llegan al mundo ────────

type Cualidades = Partial<Record<QualityId, number>>

function cuerpo(id: string, x: number, y: number, tags: readonly Tag[] = []): BodyView {
  // `tags` es lo que la superficie publica de la MATERIA (`tagsDe(body, phys)`),
  // y acá no hay materia: un cuerpo de mentira no está hecho de nada, así que por
  // omisión no tiene ninguna clase. Los tests que prueban `holding(tag:…)` la pasan.
  return { id, at: { x, y }, name: id, tags, madeByMe: false, joints: [] }
}

function criatura(o?: { at?: Cell; holding?: readonly BodyView[]; stamina?: number; capacity?: number }): SelfView {
  return {
    id: 'yo',
    at: o?.at ?? { x: 0, y: 0 },
    name: 'criatura',
    // En este mundito nada tiene sustancia, asi que nada tiene clase de materia:
    // `[]` es la respuesta honesta y es la misma que da `cuerpo()` por omision. En
    // la partida la vista lo saca de `tagsDe(body, phys)`.
    tags: [],
    madeByMe: false,
    joints: [],
    holding: o?.holding ?? [],
    capacity: o?.capacity ?? 3,
    stamina: o?.stamina ?? 1000,
    permits: 'reversible',
  }
}

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

function compara(a: number, op: '>=' | '<=' | '>' | '<', v: number): boolean {
  return op === '>=' ? a >= v : op === '<=' ? a <= v : op === '>' ? a > v : a < v
}

/**
 * `portable` la contesta EL MOTOR y no el fixture: desde que la regresión se la
 * pide a todo rol de un proceso `held`, la vista de mentira tiene que saber
 * contestarla, y escribir el tope de 8 kg acá sería su segunda copia.
 */
function portableDe(mass: number): number {
  const d = specOf('portable').derived
  if (d === undefined) throw new Error('`portable` dejó de ser derivada: el arnés se quedó viejo')
  const noHace = (): never => {
    throw new RangeError('`portable` sólo depende de `own(mass)`')
  }
  return evalQuality(d, { own: (q) => (q === 'mass' ? mass : 0), geom: noHace, sumParts: noHace, maxParts: noHace, substance: noHace })
}

function vista(m: {
  self?: SelfView
  cuerpos?: readonly BodyView[]
  qs?: ReadonlyMap<BodyId, Cualidades>
  /** Las celdas de agua franca. Sin ellas no hay pozo: ver `cellHints` en `esquemas.ts`. */
  mojadas?: readonly Cell[]
}): VistaDelPlan {
  const self = m.self ?? criatura()
  const cuerpos = m.cuerpos ?? []
  const mojadas = m.mojadas ?? []
  const qde = (b: BodyView, q: QualityId): number => {
    if (b.id === self.id && q === 'stamina') return self.stamina
    const puesta = m.qs?.get(b.id)?.[q]
    if (puesta !== undefined) return puesta
    return q === 'portable' ? portableDe(qde(b, 'mass')) : 0
  }
  return {
    see: (w: Where) => cuerpos.filter((b) => w.every((t) => compara(qde(b, t.q), t.op, t.v))),
    recall: () => [],
    q: qde,
    qAt: (at: Cell, q: CellQuality) =>
      q === 'wet' && mojadas.some((c) => c.x === at.x && c.y === at.y) ? 1 : 0,
    self,
    clock: RELOJ,
  }
}

function meta(goal: Predicado): GoalNode {
  return { id: 'g0', goal, after: [], porque: 'test' }
}

const COMER: Predicado = { k: 'sostiene', tag: 'carnoso' }
const ARDER: Predicado = { k: 'cualidad', test: { q: 'temperature', op: '>=', v: 400 } }
const SIN_CORTE = 500

function refCorto(r: { readonly k: string } & Record<string, unknown>): string {
  if (r.k === 'id') return String(r['id'])
  if (r.k === 'rinde') return 'lo-que-hice'
  if (r.k === 'yo') return 'yo'
  return r.k
}

function resumir(pasos: readonly Step[]): readonly string[] {
  return pasos.map((s) => {
    switch (s.k) {
      case 'ir':
        return `ir(${refCorto(s.a)})`
      case 'sostener':
        return `sostener(${refCorto(s.que)})`
      case 'unir':
        return `unir(binder=${refCorto(s.binder)}, a=${refCorto(s.a)}${s.b === undefined ? '' : `, b=${refCorto(s.b)}`})`
      case 'deshilachar':
        return `deshilachar(${refCorto(s.fuente)}, ${String(s.cuantas)})`
      case 'frotar':
        return `frotar(a=${refCorto(s.a)}, b=${refCorto(s.b)}, hasta=${String(s.hasta ?? 0)})`
      case 'aplicar':
        return `aplicar(${s.proceso}, {${Object.keys(s.roles)
          .sort()
          .map((r) => `${r}=${refCorto(s.roles[r] as { readonly k: string } & Record<string, unknown>)}`)
          .join(', ')}})`
      default:
        return s.k
    }
  })
}

function pasosDe(r: PlanResult): readonly Step[] {
  if (r.k !== 'plan') throw new Error(`se esperaba un plan y salió ${r.k}`)
  return r.steps
}

function elRio(): VistaDelPlan {
  return vista({
    cuerpos: [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0)],
    qs: new Map<BodyId, Cualidades>([
      ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
      ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
      ['pozo', { mass: 50 }],
    ]),
    mojadas: [{ x: 8, y: 0 }],
  })
}

function elLeno(): VistaDelPlan {
  return vista({
    cuerpos: [cuerpo('leno', 3, 0)],
    qs: new Map<BodyId, Cualidades>([
      ['leno', { rigidity: 0.7, heatCapacity: 1.7, tensile: 0.55, flexibility: 0.2, mass: 1, temperature: 15 }],
    ]),
  })
}

// ─── El mundo de verdad ─────────────────────────────────────────────────────
//
// El armado es el mismo de `los-esquemas-contra-el-mundo.test.ts` —copiado a
// propósito, porque los `tests/` no se exportan y compartirlo exigiría mover el
// arnés a `src/`—. Lo que se copia es el ARMADO: ni una regla ni un número.

const PHYS: Physics = buildSeedPhysics()
const ANA = 'ana'
const CUERPO_DE_ANA = `${ANA}-cuerpo`

function cuerpoReal(id: string, substance: string, mass: number, form: Body['form']): Body {
  return { id, form, parts: [{ substance, mass, q: {} }], joints: [], state: { temperature: T_AMBIENTE } }
}

function mundo(o: { capacity: number; at: Placement; cuerpos: readonly WorldBody[]; enMano?: readonly BodyId[] }): WorldState {
  const ella: Body = {
    id: CUERPO_DE_ANA,
    form: 'bloque',
    parts: [{ substance: 'carne', mass: 2, q: {} }],
    joints: [],
    state: { stamina: 1000, temperature: T_AMBIENTE },
  }
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos([{ body: ella, at: o.at }, ...o.cuerpos]),
    actors: mapaDeActores([
      { id: ANA, body: CUERPO_DE_ANA, holding: o.enMano ?? [], capacity: o.capacity, permits: 'irreversible' },
    ]),
    cells: new Map<CellKey, CellState>(),
    nextId: 1,
  }
}

/** La vista del planificador, leída de un mundo de verdad con `qualityOf`. */
function vistaDeMundo(w: WorldState): VistaDelPlan {
  const mio = w.bodies.get(CUERPO_DE_ANA)
  const actor = w.actors.get(ANA)
  if (mio === undefined || actor === undefined) throw new Error('mundo sin ana')
  const ver = (c: WorldBody): BodyView => ({
    id: c.body.id,
    at: c.at,
    name: nameOf(c.body, w.phys),
    tags: tagsDe(c.body, w.phys),
    madeByMe: false,
    joints: c.body.joints.map((j) => ({ a: j.a, b: j.b, strength: j.strength })),
  })
  const q = (b: BodyView, id: QualityId): number => {
    const c = w.bodies.get(b.id)
    if (c === undefined) throw new Error(`el mundo no tiene ${b.id}`)
    return qualityOf(c.body, id, w.phys)
  }
  const self: SelfView = {
    ...ver(mio),
    holding: actor.holding.map((id) => {
      const c = w.bodies.get(id)
      if (c === undefined) throw new Error(`mano con un cuerpo que no existe: ${id}`)
      return ver(c)
    }),
    capacity: actor.capacity,
    stamina: qualityOf(mio.body, 'stamina', w.phys),
    permits: actor.permits,
  }
  return {
    see: (where: Where) => {
      const out: BodyView[] = []
      for (const c of w.bodies.values()) {
        if (c.body.id === CUERPO_DE_ANA) continue
        const b = ver(c)
        if (where.every((t) => compara(q(b, t.q), t.op, t.v))) out.push(b)
      }
      return out
    },
    recall: () => [],
    q,
    qAt: () => 0,
    self,
    clock: RELOJ,
  }
}

interface Corrida {
  readonly w: WorldState
  /** Los motivos de rechazo, en orden, con el paso que los provocó. */
  readonly rechazos: readonly string[]
}

/**
 * Ejecuta los pasos de un plan CONTRA EL MUNDO, y devuelve lo que el mundo dijo.
 *
 * Sólo `ir` y `sostener`: son los dos pasos que este archivo necesita llevar
 * hasta el mundo, y los dos son los baratos —el que camina y el que agarra—. Un
 * `apply` se emite aparte donde hace falta, porque necesita el id del cuerpo
 * recién nacido y eso no está en el `Step`.
 */
function ejecutar(inicial: WorldState, pasos: readonly Step[]): Corrida {
  let w = inicial
  let seq = 0
  const rechazos: string[] = []
  const motivos = (evs: readonly SimEvent[], que: string): void => {
    for (const e of evs) if (e.k === 'rechazada') rechazos.push(`${que}: ${e.por}`)
  }
  for (const s of pasos) {
    if (s.k === 'ir' && s.a.k === 'id') {
      const destino = w.bodies.get(s.a.id)?.at
      if (destino === undefined) throw new Error(`ir hacia un cuerpo que el mundo no tiene: ${s.a.id}`)
      for (let t = 0; t < 60; t++) {
        const mio = w.bodies.get(CUERPO_DE_ANA)
        if (mio !== undefined && chebyshev(mio.at, destino) <= (s.within ?? 1)) break
        const out = stepWorld(w, [goTo({ by: ANA, seq: seq++ }, destino, s.within ?? 1)])
        w = out.state
        motivos(out.events, `ir(${s.a.id})`)
      }
    } else if (s.k === 'sostener' && s.que.k === 'id') {
      const out = stepWorld(w, [take({ by: ANA, seq: seq++ }, s.que.id)])
      w = out.state
      motivos(out.events, `sostener(${s.que.id})`)
    }
  }
  return { w, rechazos }
}

// ─── (1) Lo que el plan manda a hacer y el mundo rechaza ────────────────────

describe('lo que el plan manda a hacer, ejecutado en el mundo de verdad', () => {
  /** Las dos varas de 0,2 kg del caso de `capacity`, con la mano que se le pase. */
  function dosVaras(capacity: number): WorldState {
    return mundo({
      capacity,
      at: { x: 0, y: 0 },
      cuerpos: [
        { body: cuerpoReal('vara-1', 'madera', 0.2, 'vara'), at: { x: 1, y: 0 } },
        { body: cuerpoReal('vara-2', 'madera', 0.2, 'vara'), at: { x: 2, y: 0 } },
      ],
    })
  }

  it('ARREGLADO — con UNA sola mano no hay plan, y el motivo dice que no entra', () => {
    // ANTES: el plan salía «ir(vara-1)·sostener(vara-1)·ir(vara-2)·sostener(vara-2)
    // ·frotar», con `capacity: 1`, y el mundo lo rechazaba con `manos-llenas` en el
    // segundo `sostener`. `grep capacity src/` no devolvía NADA, aunque
    // `VistaDelPlan.self.capacity` estaba ahí, en la vista que `plan()` recibe.
    //
    // `friccion` tiene `arrangement: {k:'held'}` y el mundo lo hace cumplir en
    // `arregloOk`: los DOS cuerpos tienen que estar en la mano AL MISMO TIEMPO. Con
    // una mano no se puede, y ahora el planificador lo dice en vez de mandar a
    // hacer un viaje al pedo.
    const inicial = dosVaras(1)
    const r = plan(meta(ARDER), vistaDeMundo(inicial), SIN_CORTE)
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toContain('necesita «vara-2» en la mano y no entra')
    expect(r.why).toContain('la mano ya lleva 1 y la capacidad es 1')
    // Y lo que ofrece mientras tanto SÍ se puede: ir y agarrar la primera.
    expect(resumir(r.nearest)).toEqual(['ir(vara-1)', 'sostener(vara-1)', 'ir(vara-2)', 'sostener(vara-2)'])
  })

  it('ARREGLADO — con DOS manos el plan sale y el mundo no rechaza nada', () => {
    // El control positivo, que es la mitad que importa: rechazar todo también
    // «arregla» el defecto. Con `capacity: 2` los mismos cinco pasos salen, se
    // ejecutan contra `stepWorld`, y la lista de rechazos queda VACÍA.
    for (const cap of [2, 3]) {
      const inicial = dosVaras(cap)
      const r = plan(meta(ARDER), vistaDeMundo(inicial), SIN_CORTE)
      expect(resumir(pasosDe(r)), `con capacidad ${String(cap)}`).toEqual([
        'ir(vara-1)',
        'sostener(vara-1)',
        'ir(vara-2)',
        'sostener(vara-2)',
        'frotar(a=vara-1, b=vara-2, hasta=400)',
      ])
      const corrida = ejecutar(inicial, pasosDe(r))
      expect(corrida.rechazos, `con capacidad ${String(cap)}`).toEqual([])
      expect(corrida.w.actors.get(ANA)?.holding).toEqual(['vara-1', 'vara-2'])
    }
  })

  it('ARREGLADO — el tronco de 20 kg ya no entra en ningún rol de un proceso `held`', () => {
    // ANTES: el plan salía «ir(ramita)·sostener(ramita)·ir(tronco)·sostener(tronco)
    // ·frotar» y el mundo contestaba `no-portable`. El rol `b` de `friccion` sólo
    // pide `rigidity >= 0.5`, así que el tronco calificaba, y como estaba más cerca
    // que la ramita, ganaba.
    //
    // AHORA la regresión le agrega `portable > 0` a todo rol de un proceso `held`,
    // y no lo saca de una fila de la tabla sino del `arrangement` del catálogo —así
    // lo hereda solo el proceso que escriba el modelo—. El tronco deja de ser
    // candidato, la ramita se lleva el rol `a` (es la única con `heatCapacity` bajo
    // el techo) y para `b` no queda nadie: no hay plan, y el `why` dice que lo que
    // falta es un proceso que fabrique rigidez.
    const inicial = mundo({
      capacity: 3,
      at: { x: 0, y: 0 },
      cuerpos: [
        { body: cuerpoReal('tronco', 'madera', 20, 'vara'), at: { x: 1, y: 0 } },
        { body: cuerpoReal('ramita', 'madera', 0.2, 'vara'), at: { x: 4, y: 0 } },
      ],
    })
    const tronco = inicial.bodies.get('tronco')?.body
    if (tronco === undefined) throw new Error('sin tronco')
    expect(qualityOf(tronco, 'portable', PHYS)).toBe(0)
    expect(qualityOf(tronco, 'rigidity', PHYS)).toBeGreaterThanOrEqual(0.5)

    const r = plan(meta(ARDER), vistaDeMundo(inicial), SIN_CORTE)
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.missing).toBe('rigidity>=0.5')
    expect(r.why).toContain('ningún esquema conocido establece «rigidity>=0.5»')
    // Y el `nearest` NO manda a levantar el tronco: manda a buscar la ramita, que
    // es lo único que se puede levantar. Antes ofrecía el tronco.
    expect(resumir(r.nearest)).toEqual(['ir(ramita)', 'sostener(ramita)'])
    expect(ejecutar(inicial, r.nearest).rechazos).toEqual([])
  })

  it('ARREGLADO — la piedra de al lado ya no se convierte en el pozo: el pozo está en el agua', () => {
    // ANTES: con una piedra de 5 kg a UNA celda y el río a ocho, el plan salía
    // «... unir(matorral, vara) · ir(piedra) · aplicar(extraccion, source=piedra)».
    // El rol `source` de `extraccion` pide `mass > 0` y nada más, el esquema lo
    // dejaba con el `roleHint` vacío, y `elegirCuerpo` desempata por CERCANÍA. O
    // sea que la pesca del Hito 5 salía bien porque el mundito del test tiene
    // exactamente tres cuerpos y `union` se come dos: el tercero quedaba de pozo
    // POR DESCARTE, no porque el planificador supiera qué es un pozo.
    //
    // AHORA la fila de `extraccion` lleva `cellHints: { source: [wet >= 0.9] }` y
    // `elegirCuerpo` lo pregunta con `v.qAt`, que estaba en la vista sin usar. La
    // piedra está en tierra seca y deja de calificar; el pozo sigue.
    const conPiedra = vista({
      cuerpos: [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0), cuerpo('piedra', 1, 0)],
      qs: new Map<BodyId, Cualidades>([
        ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
        ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
        ['pozo', { mass: 50 }],
        ['piedra', { mass: 5, rigidity: 0.9 }],
      ]),
      mojadas: [{ x: 8, y: 0 }],
    })
    expect(resumir(pasosDe(plan(meta(COMER), conPiedra, SIN_CORTE)))).toEqual([
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(binder=matorral, a=vara)',
      'ir(pozo)',
      'aplicar(extraccion, {gear=lo-que-hice, source=pozo})',
    ])

    // Y LO QUE LA CONDICIÓN DE CELDA NO COMPRA, que queda medido igual porque es
    // lo que va a seguir mordiendo: `wet >= 0.9` es NECESARIA y no suficiente. Una
    // piedra tirada adentro del agua sigue calificando, y ahí manda el mundo. Esto
    // es lo que contesta cuando se pesca en algo que no es un banco decretado: la
    // caña se ata de verdad —con `unir` del motor—, se la sostiene, y el `apply`
    // sale rechazado.
    const vara = cuerpoReal('vara', 'madera', 1, 'vara')
    const hebra = cuerpoReal('hebra', 'liana', 0.2, 'hebra')
    const cana = unir(vara, undefined, hebra, PHYS, 'cana')
    if (cana === undefined) throw new Error('`unir` no ató la caña')
    expect(qualityOf(cana, 'catch', PHYS)).toBeGreaterThan(0)
    expect(qualityOf(cana, 'reach', PHYS)).toBeGreaterThanOrEqual(2)
    const w = mundo({
      capacity: 3,
      at: { x: 0, y: 0 },
      enMano: ['cana'],
      cuerpos: [
        { body: cana, at: { x: 0, y: 0 }, heldBy: ANA },
        { body: cuerpoReal('piedra', 'piedra', 5, 'bloque'), at: { x: 1, y: 0 } },
      ],
    })
    const i = apply({ by: ANA, seq: 0 }, PHYS, 'extraccion', [
      { name: 'gear', body: 'cana' },
      { name: 'source', body: 'piedra' },
    ])
    if (i === undefined) throw new Error('el catálogo no tiene `extraccion`')
    let estado = w
    const motivos: string[] = []
    for (let t = 0; t < 40; t++) {
      const out = stepWorld(estado, [i])
      estado = out.state
      for (const e of out.events) if (e.k === 'rechazada') motivos.push(String(e.por))
    }
    expect(motivos).toContain('sin-pozo')
  })
})

// ─── (2) El índice sólo sabe la letra exacta ────────────────────────────────

describe('el índice se compara por texto, y la regresión por IMPLICACIÓN', () => {
  it('ARREGLADO — `temperature>=400` sale, y `399`, `300`, `100` y `20` también', () => {
    // ANTES: `esquemasQueAportan` decidía si un esquema aporta con
    // `pedido.includes(textoDe(p))` —comparación de TEXTO— así que el planificador
    // sabía hacer exactamente los seis strings de la tabla y nada que se les
    // pareciera. Un objetivo ESTRICTAMENTE MÁS DÉBIL, que cualquier plan válido
    // para el fuerte también cumple, no tenía plan.
    //
    // AHORA la pregunta es `implica`: `temperature>=400` GARANTIZA
    // `temperature>=399`. El índice sigue comparándose por texto —hay dos promesas
    // de la semilla que no parsean— y sólo cambió quién pregunta.
    const fuerte = plan(meta({ k: 'cualidad', test: { q: 'temperature', op: '>=', v: 400 } }), elLeno(), SIN_CORTE)
    expect(resumir(pasosDe(fuerte))).toEqual([
      'ir(leno)',
      'sostener(leno)',
      'deshilachar(leno, 1)',
      'frotar(a=lo-que-hice, b=leno, hasta=400)',
    ])
    for (const v of [399, 300, 100, 20]) {
      const flojo = plan(meta({ k: 'cualidad', test: { q: 'temperature', op: '>=', v } }), elLeno(), SIN_CORTE)
      // Los mismos cuatro pasos, con el `hasta` del objetivo que se persigue y no
      // el del esquema: frotar hasta 300 alcanza para 300 y cuesta menos aliento.
      expect(resumir(pasosDe(flojo)), `a ${String(v)} grados`).toEqual([
        'ir(leno)',
        'sostener(leno)',
        'deshilachar(leno, 1)',
        `frotar(a=lo-que-hice, b=leno, hasta=${String(v)})`,
      ])
    }
  })

  it('ARREGLADO — `catch>0.0001` SIGUE sin plan, que es lo correcto, y ahora el `why` no miente', () => {
    // Éste es el hallazgo que era medio cierto, y la mitad falsa importa: un
    // esquema que promete `catch > 0` NO garantiza `catch > 0.0001` —el 0,00005
    // cumple el primero y no el segundo— así que el `gap` está bien. Lo que estaba
    // mal era el mensaje: decía «ningún esquema conocido establece «catch»», que
    // es falso —el puente está dos filas más arriba en la misma tabla— y el Hito 8
    // lee ese `why` para pedirle procesos a la fragua. Le habría pedido que
    // inventara el enganche, cuando lo que hace falta es un aparejo MEJOR.
    expect(plan(meta({ k: 'cualidad', test: { q: 'catch', op: '>', v: 0 } }), elRio(), SIN_CORTE).k).toBe('plan')
    const g = plan(meta({ k: 'cualidad', test: { q: 'catch', op: '>', v: 0.0001 } }), elRio(), SIN_CORTE)
    expect(g.k).toBe('gap')
    if (g.k !== 'gap') throw new Error('se esperaba gap')
    expect(g.why).toBe(
      'ningún esquema conocido establece «catch>0.0001» (lo más cerca que llega el catálogo es «catch>0»)',
    )
  })
})

// ─── (3) La memoria de la búsqueda, que era global y ahora es del linaje ────

describe('el corte de ciclos es del LINAJE del nodo y no de toda la búsqueda', () => {
  it('ARREGLADO — lo mismo SÍ se puede fabricar dos veces cuando fabricarlo no consume nada', () => {
    // ANTES: `regresar` hacía `cerrados.push(nodo.falta)` sobre UNA lista
    // compartida por todas las ramas, y mataba cualquier nodo cuya firma ya
    // estuviera ahí con el mensaje «ya se había abierto MÁS ARRIBA EN ESTA MISMA
    // BÚSQUEDA». En este escenario la firma no estaba más arriba: estaba en el rol
    // HERMANO, y la primera hebra YA SE HABÍA FABRICADO.
    //
    // La forma del problema: `friccion` necesita dos cuerpos rígidos, no hay
    // ninguno a la vista, y `deshilachar` sabe fabricarlos. `deshilachar` usa
    // `split`, que NO consume la fuente —el resto vuelve al mundo con el mismo id,
    // y por eso `consumidosPor` lo deja afuera a propósito—, así que sacarle dos
    // hebras al mismo matorral es legal en el mundo.
    const tabla: readonly ConstructionSchema[] = [
      ...ESQUEMAS.map((e) => (e.establishes === 'temperature>=400' ? { ...e, roleHints: { a: [], b: [], actor: [] } } : e)),
      {
        k: 'proceso',
        establishes: 'rigidity>=0.5',
        via: 'deshilachar',
        roleHints: { source: [], actor: [] },
        segundos: 2,
      },
    ]
    const v = vista({
      cuerpos: [cuerpo('fibra', 3, 0)],
      qs: new Map<BodyId, Cualidades>([['fibra', { rigidity: 0.1, tensile: 0.55, mass: 1 }]]),
    })
    const pasos = pasosDe(plan(meta(ARDER), v, SIN_CORTE, undefined, { esquemas: tabla }))
    expect(resumir(pasos)).toEqual([
      'ir(fibra)',
      'sostener(fibra)',
      'deshilachar(fibra, 1)',
      'deshilachar(fibra, 1)',
      'frotar(a=lo-que-hice, b=lo-que-hice, hasta=400)',
    ])

    // ─── Y LAS DOS HEBRAS SON DOS, no la misma nombrada dos veces ───────────
    //
    // Esto lo destapó el arreglo y no la lectura: la llave del rendimiento era
    // `firma@profundidad`, y dos marcos hermanos a la misma altura estableciendo
    // la misma firma rendían bajo la MISMA llave — el plan salía frotando la hebra
    // contra sí misma, que es lo mismo que `friccion` con `a === b`. Ahora la
    // llave lleva el camino de roles.
    const frotar = pasos.find((s) => s.k === 'frotar')
    if (frotar === undefined || frotar.k !== 'frotar') throw new Error('sin frotar')
    expect(frotar.a).toEqual({ k: 'rinde', de: 'rigidity>=0.5@./a' })
    expect(frotar.b).toEqual({ k: 'rinde', de: 'rigidity>=0.5@./b' })
    expect(frotar.a).not.toEqual(frotar.b)
  })
})

// ─── (4) Un esquema al que le falta un rol obligatorio ──────────────────────

describe('`armarMarco` revisa TRES cosas del esquema, y la tercera es la que faltaba', () => {
  // Revisaba que todos los esquemas de una misma aplicación nombraran los MISMOS
  // roles, y que cada rol nombrado EXISTIERA en el proceso. No revisaba que
  // estuvieran todos los que el proceso necesita. Y `roleHints` es lo que va a
  // escribir la fragua del Hito 8, no una constante de este repo: una fila
  // mutilada es entrada esperable y no un accidente de laboratorio.

  it('ARREGLADO — un esquema sin el rol `source` se rechaza en vez de pescar sin río', () => {
    // ANTES: salía un plan VERDE de seis pasos que terminaba en
    // `aplicar(extraccion, {gear=lo-que-hice})` —sin la clave `source`, sin ningún
    // `ir` hasta el pozo— y el mundo lo rechazaba con `rol-sin-cuerpo`.
    //
    // La fila de la COCCIÓN se saca de la tabla, y no por comodidad: también
    // establece algo que implica `holding(tag:carnoso)`, así que con ella adentro el
    // nodo raíz TIENE un hijo vivo —el marco de la ley— y los `rechazos` de las
    // otras vías no llegan a ser `RamaMuerta`. El `why` que sale es el del ciclo de
    // la ley, que es correcto y es sobre otra cosa. Es una propiedad del diseño y
    // conviene decirla: **un motivo de rechazo sólo se ve cuando NINGUNA vía sirve**.
    const cojo: readonly ConstructionSchema[] = ESQUEMAS.filter((e) => e.k !== 'ley').map((e) =>
      e.establishes === 'holding(tag:carnoso)' ? { ...e, roleHints: { gear: [] } } : e,
    )
    const r = plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: cojo })
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toBe(
      'el esquema de «holding(tag:carnoso)» por «extraccion» no nombra «source», que «extraccion» necesita sí o sí',
    )
  })

  it('ARREGLADO — un esquema sin el rol `b` tampoco LANZA: contesta `gap` y nombra el rol', () => {
    // ANTES esto tiraba desde `exigirRef`, en el medio de la búsqueda. Y eso
    // contradecía lo que este mismo paquete argumenta en `predicado.ts` para que
    // `cumpleCuerpo` devuelva `false` en vez de tirar: «una excepción en el medio
    // de la búsqueda voltea el tick de las 5000 criaturas por un predicado mal
    // escrito». Lo volteaba una FILA mal escrita.
    //
    // `b` es el caso fino: `union` declara el suyo como `'b?'` y omitirlo es LA
    // CAÑA ENTERA, mientras que el de `friccion` se llama `'b'` y es obligatorio.
    // La diferencia sale de `isOptionalRole` del catálogo, no de una lista de acá.
    const cojo: readonly ConstructionSchema[] = ESQUEMAS.map((e) =>
      e.establishes === 'temperature>=400' ? { ...e, roleHints: { a: e.roleHints['a'] ?? [], actor: [] } } : e,
    )
    const r = plan(meta(ARDER), elLeno(), SIN_CORTE, undefined, { esquemas: cojo })
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toBe(
      'el esquema de «temperature>=400» por «friccion» no nombra «b», que «friccion» necesita sí o sí',
    )
    // Y el rol opcional de `union` sigue pudiendo faltar: la tabla real, intacta,
    // sigue dando la caña. Sin esto, la guarda nueva mataría la pesca.
    expect(pasosDe(plan(meta(COMER), elRio(), SIN_CORTE)).some((s) => s.k === 'unir' && s.b === undefined)).toBe(true)
  })
})

// ─── (5) Lo que `goalGraph` produce, y ahora sí lee alguien ─────────────────

describe('la ligadura diferida entre NODOS del grafo', () => {
  it('ARREGLADO — con `binds` el rol se liga al rendimiento del otro nodo y no se busca', () => {
    // ANTES: `plan(conBind, …)` daba EL MISMO OBJETO que `plan(sinBind, …)`,
    // medido con `toEqual`. `objetivos.ts` le dedica su decisión 2 entera a
    // `GoalNode.binds` —«sin eso, "el pescado" se resuelve contra la vista de hoy,
    // no encuentra nada y el plan se cae en el paso tres; ése es EXACTAMENTE el
    // bug que el ADR 0082 arregló»— y `regresion.ts` no lo mencionaba ni una vez.
    //
    // AHORA el rol nombrado por `binds.slot` se resuelve a `{k:'rinde', de:from}`
    // en el marco RAÍZ, que es el único donde `slot` nombra algo: es un rol del
    // proceso que cumple ESTE objetivo, no de los subobjetivos que la regresión
    // inventa por el camino.
    const conBind: GoalNode = {
      id: 'g1',
      goal: COMER,
      after: ['g0'],
      binds: { slot: 'source', from: 'g0' },
      porque: 'asá el pescado',
    }
    const conB = plan(conBind, elRio(), SIN_CORTE)
    const sinB = plan(meta(COMER), elRio(), SIN_CORTE)
    expect(conB).not.toEqual(sinB)

    const pasos = pasosDe(conB)
    const ultimo = pasos[pasos.length - 1]
    if (ultimo === undefined || ultimo.k !== 'aplicar') throw new Error('el plan no termina en `aplicar`')
    expect(ultimo.roles['source']).toEqual({ k: 'rinde', de: 'g0' })
    // Y no camina hasta el pozo: lo que va a pescar ya lo trajo el nodo anterior.
    expect(resumir(pasos)).not.toContain('ir(pozo)')
    // La caña, en cambio, la sigue haciendo la aritmética: el `gear` no está
    // ligado y se fabrica igual.
    expect(ultimo.roles['gear']).toEqual({ k: 'rinde', de: 'catch>0&reach>=2@./gear' })
  })
})

// ─── (6) Lo que el módulo dice que hace y no hace ───────────────────────────

describe('dos afirmaciones de los comentarios, medidas', () => {
  it('SIGUE SIENDO FALSO — «un leño de 20 kg... la regresión lo deshilacha dos veces»', () => {
    // `esquemas.ts`, fila del puente `heatCapacity<=0.9`: «El `heatCapacity <= 9`
    // del `source` es el techo de arriba dividido por la fracción que se lleva la
    // hebra. Un leño de 20 kg no entra, y entonces la regresión lo deshilacha dos
    // veces, que es lo que hay que hacer.»
    //
    // No lo deshilacha ninguna vez, y este hallazgo NO se arregló: es un hueco de
    // diseño y no un bug del módulo. La segunda vuelta pediría `heatCapacity<=9`
    // como RESIDUO al rol material, `heatCapacity` es extensiva, y el residuo
    // extensivo se rechaza —con razón—. El techo de 9 no es el primer escalón de
    // una escalera: es un tope duro. Para que hubiera escalera haría falta que el
    // esquema supiera decir «lo que salga pesa una décima de lo que entre», y eso
    // es aritmética sobre los rendimientos que `ConstructionSchema` no tiene.
    //
    // Lo que SÍ cambió es cuál rama muere primero: con el corte por linaje, el
    // nodo se muere antes de llegar al residuo, porque su pedido ya implica lo que
    // el marco de abajo venía a establecer.
    const v = vista({
      cuerpos: [cuerpo('tronco', 3, 0)],
      qs: new Map<BodyId, Cualidades>([
        ['tronco', { rigidity: 0.7, heatCapacity: 34, tensile: 0.55, flexibility: 0.2, mass: 20 }],
      ]),
    })
    const r = plan(meta(ARDER), v, SIN_CORTE)
    if (r.k !== 'gap') throw new Error(`se esperaba gap y salió ${r.k}`)
    expect(r.missing).toBe('heatCapacity<=9&rigidity>=0.5&tensile>=0.3')
    expect(r.why).toContain('ya está en el linaje de este nodo')
    // Y el `nearest` YA NO ofrece levantar un tronco de 20 kg que el mundo no deja
    // levantar (`portable = step(8, 20) = 0`): ofrece nada, que es la verdad.
    expect(r.nearest).toEqual([])
  })

  it('ARREGLADO — el `nearest` manda a caminar al POZO y no a pescar en la vara', () => {
    // El `gap` sin el puente de `catch>0`. `pasosPosibles` completa los roles
    // PENDIENTES con lo que se vea, y para el `source` de `extraccion` —`mass>0`—
    // lo más cercano que quedaba era la VARA: la materia de la caña que esta misma
    // rama no supo hacer. Con la condición de celda el único candidato es el agua.
    const r = plan(meta(COMER), elRio(), SIN_CORTE, undefined, {
      esquemas: ESQUEMAS.filter((e) => e.establishes !== 'catch>0'),
    })
    if (r.k !== 'gap') throw new Error('se esperaba gap')
    expect(r.nearest).toEqual([
      { k: 'ir', a: { k: 'id', id: 'matorral' }, within: 1, porQue: 'flexibility>=0.8&tensile>=0.3' },
      { k: 'sostener', que: { k: 'id', id: 'matorral' }, porQue: 'flexibility>=0.8&tensile>=0.3' },
      // El pozo, a ocho celdas, gana igual: es el único que está en el agua.
      { k: 'ir', a: { k: 'id', id: 'pozo' }, within: 1, porQue: 'mass>0' },
    ])
  })
})

// ─── (7) El presupuesto ─────────────────────────────────────────────────────

describe('el presupuesto', () => {
  it('DEFECTO menor — un presupuesto NEGATIVO no es un error: es cero disfrazado', () => {
    // `enEstaLlamada >= presupuesto` con `presupuesto` negativo es verdadero
    // desde la primera vuelta. Quien llame con -1 recibe un `parcial` que no
    // avanzó nada, y si su bucle es «mientras sea parcial, seguí», gira para
    // siempre sin expandir un solo nodo.
    for (const p of [0, -1, -1000]) {
      const r = plan(meta(COMER), elRio(), p)
      expect(r.k).toBe('parcial')
      expect(r.expansiones).toBe(0)
    }
    // Y con un objetivo YA CUMPLIDO tampoco contesta «ya está»: contesta
    // `parcial`. Cuesta dos expansiones enterarse de que no hay nada que hacer.
    const ardiendo = vista({
      cuerpos: [cuerpo('brasa', 1, 0)],
      qs: new Map<BodyId, Cualidades>([['brasa', { temperature: 900 }]]),
    })
    expect(plan(meta(ARDER), ardiendo, 0).k).toBe('parcial')
    expect(plan(meta(ARDER), ardiendo, SIN_CORTE)).toEqual({ k: 'plan', steps: [], expansiones: 2 })
  })
})

// ─── (8) Lo que aguantó: el anytime ─────────────────────────────────────────

describe('el anytime, atacado en serio', () => {
  it('105 escenarios × 5 tamaños de corte: 525 comparaciones y CERO divergencias', () => {
    const metas: Predicado[] = [
      COMER,
      ARDER,
      { k: 'cualidad', test: { q: 'catch', op: '>', v: 0 } },
      { k: 'cualidad', test: { q: 'reach', op: '>=', v: 2 } },
      { k: 'cualidad', test: { q: 'flexibility', op: '>=', v: 0.8 } },
      { k: 'geometria', f: 'freeStrandEnds', op: '>=', v: 1 },
      { k: 'cualidad', test: { q: 'temperature', op: '>=', v: 300 } },
    ]
    const vistas: VistaDelPlan[] = [
      elRio(),
      elLeno(),
      vista({}),
      vista({ self: criatura({ stamina: 2 }), cuerpos: [cuerpo('leno', 3, 0)], qs: new Map([['leno', { rigidity: 0.7, heatCapacity: 1.7, tensile: 0.55, mass: 1 }]]) }),
      vista({
        cuerpos: [cuerpo('m1', 1, 0), cuerpo('m2', 1, 1), cuerpo('vara', 3, 0), cuerpo('pozo', 4, 0)],
        qs: new Map<BodyId, Cualidades>([
          ['m1', { flexibility: 0.9, tensile: 0.72, mass: 3 }],
          ['m2', { flexibility: 0.9, tensile: 0.72, mass: 3 }],
          ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, mass: 1, heatCapacity: 0.5 }],
          ['pozo', { mass: 50 }],
        ]),
      }),
    ]
    const tablas: (readonly ConstructionSchema[])[] = [
      ESQUEMAS,
      ESQUEMAS.filter((e) => e.establishes !== 'catch>0'),
      ESQUEMAS.filter((e) => e.establishes !== 'heatCapacity<=0.9'),
    ]

    let comparaciones = 0
    const divergen: string[] = []
    for (const m of metas) {
      for (const [iv, v] of vistas.entries()) {
        for (const [it_, esquemas] of tablas.entries()) {
          const o = { esquemas }
          const entero = plan(meta(m), v, SIN_CORTE, undefined, o)
          for (const k of [1, 2, 3, 5, 7]) {
            let r = plan(meta(m), v, k, undefined, o)
            let vueltas = 0
            while (r.k === 'parcial' && vueltas < 500) {
              r = plan(meta(m), v, k, r.frontera, o)
              vueltas++
            }
            comparaciones++
            if (JSON.stringify(r) !== JSON.stringify(entero)) {
              divergen.push(`${JSON.stringify(m)}|vista ${String(iv)}|tabla ${String(it_)}|corte ${String(k)}`)
            }
          }
        }
      }
    }
    expect(comparaciones).toBe(525)
    expect(divergen).toEqual([])
  })
})
