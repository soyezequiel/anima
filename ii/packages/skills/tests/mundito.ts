/**
 * MUNDITO — un mundo de juguete para CORRER las quince innatas.
 *
 * POR QUÉ NO ES `stepWorld` DE VERDAD: el ejecutor de generadores del Hito 4 no
 * existe todavía (lo está escribiendo otro), y sin ejecutor no hay quien
 * traduzca un `Intent` en un `StepResult`. Este archivo es esa traducción,
 * mínima y de juguete, escrita para poder responder UNA pregunta: ¿las quince
 * corren, emiten las intenciones que dicen que emiten, y terminan?
 *
 * Lo que este mundito NO prueba, y hay que decirlo: que las habilidades
 * FUNCIONEN. Eso necesita el mundo de verdad, la física de verdad y el juez —
 * Hitos 2, 1 y 7. Prueba que se puedan EXPRESAR y EJECUTAR, que es la misma
 * distinción que el arnés de los 28 borradores hace entre compilar y andar.
 *
 * Las reglas de rechazo copian las de `stepWorld` donde importan, y están
 * anotadas con la línea de la que salen. Donde el mundito difiere, lo dice.
 */

import type {
  BodyView,
  Cell,
  CellQuality,
  Clock,
  Commitment,
  Ctx,
  DetMath,
  Intent,
  Motivo,
  Outcome,
  PlaceMemory,
  QualityId,
  SelfView,
  SkillMemory,
  StepResult,
  Verdict,
  Where,
  WhereCell,
} from '../src/ctx.js'

export interface CuerpoDeJuguete {
  id: string
  at: Cell
  name: string
  madeByMe?: boolean
  heldBy?: string | undefined
  q: Partial<Record<QualityId, number>>
  /** Cuánto se mueve cada cualidad por segundo. Lo que devuelve `rateOf`. */
  tasa?: Partial<Record<QualityId, number>>
  vivo?: boolean
}

export interface Guion {
  cuerpos: CuerpoDeJuguete[]
  celdas?: Record<string, Partial<Record<CellQuality, number>>>
  /** Lo que contesta `qAt` de una celda que nadie declaró. Existe porque el
   *  campo de celda es CONTINUO y un mundo donde toda celda no declarada vale 0
   *  hace que huir del calor sea trivial: cualquier vecina sirve. */
  ambiente?: Partial<Record<CellQuality, number>>
  yo?: { at?: Cell; stamina?: number; capacity?: number; permits?: Commitment; holding?: string[] }
  clock?: Partial<Clock>
  hz?: number
  /** Motivos forzados por clase de intención, para probar las ramas de rechazo. */
  rechaza?: Partial<Record<Intent['k'], Motivo>>
}

const ACTOR = 'ella'
const clave = (c: Cell): string => `${c.x},${c.y}`
const cheby = (a: Cell, b: Cell): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** La tabla del mundo (`world/src/intent.ts:188`). `eat` y `place` son irreversibles. */
const COMPROMISO: Record<Intent['k'], Commitment> = {
  wait: 'reversible',
  goTo: 'reversible',
  explore: 'reversible',
  take: 'reversible',
  drop: 'reversible',
  put: 'reversible',
  eat: 'irreversible',
  place: 'irreversible',
  apply: 'costly',
}

/** Las cotas de rol de los cuatro procesos, tal cual `physics/src/process.ts`.
 *  Están acá y no en la habilidad a propósito: es lo que `can()` sabe y la
 *  habilidad no. */
interface TestDeRol {
  q: QualityId
  op: '>=' | '>'
  v: number
}
// Ojo con `}>>>`: esbuild lo lexa como corrimiento de bits. Por eso el alias.
type CotasDeProceso = Record<string, readonly TestDeRol[]>

const ROLES: Record<string, CotasDeProceso> = {
  friccion: {
    a: [{ q: 'rigidity', op: '>=', v: 0.5 }],
    b: [{ q: 'rigidity', op: '>=', v: 0.5 }],
    actor: [{ q: 'stamina', op: '>=', v: 1 }],
  },
  union: {
    binder: [
      { q: 'flexibility', op: '>=', v: 0.8 },
      { q: 'tensile', op: '>=', v: 0.3 },
    ],
    a: [],
    b: [],
  },
  deshilachar: {
    source: [{ q: 'tensile', op: '>=', v: 0.3 }],
    actor: [{ q: 'stamina', op: '>=', v: 3 }],
  },
  extraccion: {
    gear: [
      { q: 'reach', op: '>=', v: 2 },
      { q: 'catch', op: '>', v: 0 },
    ],
    source: [{ q: 'mass', op: '>', v: 0 }],
  },
}

export class Mundito {
  readonly emitidas: Intent[] = []
  readonly dicho: string[] = []
  readonly fases: string[] = []
  private seq = 0
  tickN = 0
  private readonly cuerpos = new Map<string, CuerpoDeJuguete>()
  private readonly celdas = new Map<string, Partial<Record<CellQuality, number>>>()
  private readonly kv = new Map<string, unknown>()
  private readonly recuerdos: { at: Cell; atTick: number; what: string[]; q: Partial<Record<CellQuality, number>> }[] =
    []
  yo: { at: Cell; stamina: number; capacity: number; permits: Commitment; holding: string[] }
  reloj: Clock
  private readonly hz: number
  private readonly rechaza: Partial<Record<Intent['k'], Motivo>>
  private readonly ambiente: Partial<Record<CellQuality, number>>
  /** Nuevas hebras/ensambles que produce `apply`. Contador para ids estables. */
  private nacidos = 0

  constructor(g: Guion) {
    for (const c of g.cuerpos) this.cuerpos.set(c.id, { vivo: true, ...c })
    for (const [k, v] of Object.entries(g.celdas ?? {})) this.celdas.set(k, v)
    this.yo = {
      at: g.yo?.at ?? { x: 0, y: 0 },
      stamina: g.yo?.stamina ?? 100,
      capacity: g.yo?.capacity ?? 3,
      permits: g.yo?.permits ?? 'irreversible',
      holding: [...(g.yo?.holding ?? [])],
    }
    for (const id of this.yo.holding) {
      const b = this.cuerpos.get(id)
      if (b) b.heldBy = ACTOR
    }
    this.reloj = { phase: 'dia', secondsToNightfall: 300, dayLength: 600, ...g.clock }
    this.hz = g.hz ?? 20
    this.rechaza = g.rechaza ?? {}
    this.ambiente = g.ambiente ?? {}
  }

  recordar(at: Cell, q: Partial<Record<CellQuality, number>>, what: string[] = []): void {
    this.recuerdos.push({ at, atTick: this.tickN, what, q })
  }

  cuerpo(id: string): CuerpoDeJuguete | undefined {
    return this.cuerpos.get(id)
  }

  existe(id: string): boolean {
    return this.cuerpos.get(id)?.vivo === true
  }

  get stamina(): number {
    return this.yo.stamina
  }

  get posicion(): Cell {
    return this.yo.at
  }

  get manos(): readonly string[] {
    return this.yo.holding
  }

  // ─── La vista ─────────────────────────────────────────────────────────────

  private vista(c: CuerpoDeJuguete): BodyView {
    const v: { -readonly [K in keyof BodyView]: BodyView[K] } = {
      id: c.id,
      at: c.at,
      name: c.name,
      madeByMe: c.madeByMe ?? false,
      joints: [],
    }
    if (c.heldBy !== undefined) v.heldBy = c.heldBy
    return v
  }

  private qDe(id: string, q: QualityId): number {
    const c = this.cuerpos.get(id)
    if (!c) return 0
    if (q === 'calories') {
      const propio = c.q.calories
      if (propio !== undefined) return propio
      return (c.q.nutrition ?? 0) * (c.q.mass ?? 0) * (c.q.digestibility ?? 0)
    }
    return c.q[q] ?? 0
  }

  private self(): SelfView {
    const holding = this.yo.holding.map((id) => this.cuerpos.get(id)).filter((c): c is CuerpoDeJuguete => c !== undefined)
    return {
      id: ACTOR,
      at: this.yo.at,
      name: 'ella',
      madeByMe: false,
      joints: [],
      holding: holding.map((c) => this.vista(c)),
      capacity: this.yo.capacity,
      stamina: this.yo.stamina,
      permits: this.yo.permits,
    }
  }

  private cumple(id: string, w: Where): boolean {
    return w.every((t) => {
      const v = this.qDe(id, t.q)
      return t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
    })
  }

  // ─── El contexto que ve la habilidad ──────────────────────────────────────

  ctx(): Ctx {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- los getters
    // de abajo son funciones propias y necesitan la instancia por nombre.
    const mundo = this
    const memory: SkillMemory = {
      get: <T,>(k: string) => this.kv.get(k) as T | undefined,
      set: <T,>(k: string, v: T) => void this.kv.set(k, v),
      del: (k: string) => void this.kv.delete(k),
    }
    // `math` y `rng` no los usa ninguna de las quince, y eso también es un dato:
    // el determinismo de una habilidad sale de no tener azar, no de tener el
    // azar correcto.
    const math: DetMath = { exp: (x) => x, log: (x) => x, pow: (a) => a }
    // ── HUECO: `self`, `tick` y `clock` SON PROPIEDADES, NO MÉTODOS ─────────
    // Un generador recibe `ctx` UNA vez y lo sigue teniendo después de cada
    // `yield`. Si `ctx.self` fuera un objeto calculado al construir el `Ctx`,
    // quedaría congelado para siempre: la habilidad no vería que acaba de
    // levantar algo, ni que se movió, ni que anocheció. Con `see()` y `q()` no
    // pasa porque son métodos y se vuelven a llamar.
    //
    // La API no dice cuál de las dos lecturas vale. Acá se implementa la ÚNICA
    // que hace que el ejemplo canónico del documento funcione —refresco en cada
    // acceso, con `get`— y el test «la vista congelada» de `innatas.test.ts`
    // deja escrito que es una suposición del mundito y no una garantía del
    // contrato. Si el ejecutor real congela, cinco de las quince se rompen.
    return {
      get tick() {
        return mundo.tickN
      },
      hz: this.hz,
      get clock() {
        return mundo.reloj
      },
      get self() {
        return mundo.self()
      },
      see: (w: Where) =>
        [...this.cuerpos.values()].filter((c) => c.vivo && this.cumple(c.id, w)).map((c) => this.vista(c)),
      recall: (w: WhereCell): PlaceMemory[] =>
        this.recuerdos
          .filter((r) =>
            w.every((t) => {
              const v = r.q[t.q] ?? 0
              return t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
            }),
          )
          .map((r) => ({ at: r.at, atTick: r.atTick, what: r.what, q: (q: CellQuality) => r.q[q] ?? 0 })),
      q: (b: BodyView, q: QualityId) => (b.id === ACTOR ? (q === 'stamina' ? this.yo.stamina : 0) : this.qDe(b.id, q)),
      qAt: (at: Cell, q: CellQuality) => this.celdas.get(clave(at))?.[q] ?? this.ambiente[q] ?? 0,
      rateOf: (b: BodyView, q: QualityId) => this.cuerpos.get(b.id)?.tasa?.[q] ?? 0,
      can: (p, roles) => this.puede(p, roles as Record<string, BodyView | undefined>),
      goTo: (t, o) => this.intent({ k: 'goTo', to: 'at' in t ? t.at : t, within: o?.within ?? 0 }),
      take: (b) => this.intent({ k: 'take', what: b.id }),
      put: (b, at, o) => {
        const i: { k: 'put'; what: string; at: Cell; onTopOf?: string; covering?: string } = {
          k: 'put',
          what: b.id,
          at,
        }
        if (o?.onTopOf) i.onTopOf = o.onTopOf.id
        if (o?.covering) i.covering = o.covering.id
        return this.intent(i)
      },
      drop: (b) => this.intent({ k: 'drop', what: b.id }),
      place: (bp) => this.intent({ k: 'place', blueprint: bp.id, at: bp.at }),
      apply: (p, roles) => {
        const rs = Object.entries(roles as Record<string, BodyView | undefined>)
          .filter((e): e is [string, BodyView] => e[1] !== undefined)
          .map(([name, b]) => ({ name, body: b.id }))
        return this.intent({ k: 'apply', process: p, roles: rs })
      },
      explore: (o) => this.intent({ k: 'explore', maxTicks: o.maxTicks }),
      eat: (b) => this.intent({ k: 'eat', what: b.id }),
      wait: (s) => this.intent({ k: 'wait', segundos: s }),
      say: (t) => void this.dicho.push(t),
      phase: (n) => void this.fases.push(n),
      memory,
      rng: (() => 0.5) as Ctx['rng'],
      math,
    }
  }

  private intent(base: Record<string, unknown> & { k: Intent['k'] }): Intent {
    return { by: ACTOR, seq: this.seq++, commitment: COMPROMISO[base.k], ...base } as unknown as Intent
  }

  private puede(p: string, roles: Record<string, BodyView | undefined>): Verdict {
    const spec = ROLES[p]
    if (!spec) return { ok: false, por: 'proceso-desconocido', why: `no existe ${p}` }
    for (const [nombre, tests] of Object.entries(spec)) {
      const b = roles[nombre]
      if (!b) continue // los opcionales pueden faltar
      for (const t of tests) {
        const v = b.id === ACTOR ? (t.q === 'stamina' ? this.yo.stamina : 0) : this.qDe(b.id, t.q)
        if (!(t.op === '>=' ? v >= t.v : v > t.v)) {
          return { ok: false, por: 'rol-no-cumple', why: `${nombre} no cumple ${t.q}` }
        }
      }
    }
    return { ok: true }
  }

  // ─── El juicio de una intención ───────────────────────────────────────────

  private ok(got: BodyView[] = [], status: StepResult['status'] = 'done'): StepResult {
    return { status, got }
  }

  private no(por: Motivo): StepResult {
    return { status: 'rejected', got: [], por }
  }

  juzgar(i: Intent): StepResult {
    this.tickN++
    this.emitidas.push(i)
    const forzado = this.rechaza[i.k]
    if (forzado) return this.no(forzado)

    switch (i.k) {
      case 'wait':
        this.correrTiempo(i.segundos)
        return this.ok()

      case 'goTo': {
        const d = cheby(this.yo.at, i.to)
        if (d <= i.within) return this.ok([], 'arrived')
        if (this.yo.stamina <= 0) return this.no('sin-fuerza')
        this.yo.at = { x: i.to.x, y: i.to.y }
        this.yo.stamina -= 0.1 * d
        return this.ok([], 'arrived')
      }

      case 'explore': {
        // El mundo da UN PASO por intención (`world/src/step.ts:872`); quien
        // repite y evalúa `until` es el ejecutor. El mundito hace de ejecutor
        // acá, y por eso puede devolver `found`/`timeout` — que `stepWorld` no
        // produce jamás. Es exactamente la costura que falta.
        this.yo.at = { x: this.yo.at.x + 1, y: this.yo.at.y }
        this.yo.stamina -= 0.1
        return this.ok([], 'timeout')
      }

      case 'take': {
        const c = this.cuerpos.get(i.what)
        if (!c?.vivo) return this.no('cuerpo-desconocido')
        if (c.heldBy === ACTOR) return this.ok([this.vista(c)])
        if ((c.q.portable ?? 0) < 1) return this.no('no-portable')
        if (cheby(this.yo.at, c.at) > 1) return this.no('no-esta-a-mano')
        if (this.yo.holding.length >= this.yo.capacity) return this.no('manos-llenas')
        c.heldBy = ACTOR
        this.yo.holding.push(c.id)
        return this.ok([this.vista(c)])
      }

      case 'drop': {
        const c = this.cuerpos.get(i.what)
        if (!c || c.heldBy !== ACTOR) return this.no('no-lo-tiene')
        c.heldBy = undefined
        c.at = { ...this.yo.at }
        this.yo.holding = this.yo.holding.filter((x) => x !== c.id)
        return this.ok([this.vista(c)])
      }

      case 'put': {
        const c = this.cuerpos.get(i.what)
        if (!c) return this.no('cuerpo-desconocido')
        if (c.heldBy !== ACTOR) return this.no('no-lo-tiene')
        if (cheby(this.yo.at, i.at) > 1) return this.no('fuera-de-rango')
        c.heldBy = undefined
        c.at = { x: i.at.x, y: i.at.y }
        this.yo.holding = this.yo.holding.filter((x) => x !== c.id)
        // La ley 12 sobre una CELDA. Que tapar a la criatura no haga nada es
        // la conducta que `guarecerse` sospecha y no puede verificar de otro modo.
        if (i.covering !== undefined && i.covering !== ACTOR) {
          const k = clave(c.at)
          this.celdas.set(k, { ...this.celdas.get(k), sheltered: 1, oxygen: 0 })
        }
        return this.ok([this.vista(c)])
      }

      case 'eat': {
        const c = this.cuerpos.get(i.what)
        if (!c?.vivo) return this.no('cuerpo-desconocido')
        if (c.heldBy !== ACTOR && cheby(this.yo.at, c.at) > 1) return this.no('no-esta-a-mano')
        const cal = this.qDe(c.id, 'calories')
        if (cal <= 0) return this.no('nada-que-comer')
        this.yo.stamina += cal // STAMINA_POR_CALORIA = 1
        c.vivo = false
        this.yo.holding = this.yo.holding.filter((x) => x !== c.id)
        return this.ok()
      }

      case 'place':
        // `stepWorld` lo rechaza así, con nombre: las obras no existen todavía.
        return this.no('no-implementado')

      case 'apply':
        return this.aplicar(i)
    }
  }

  private aplicar(i: Intent & { k: 'apply' }): StepResult {
    const de = (n: string): CuerpoDeJuguete | undefined => {
      const l = i.roles.find((r) => r.name === n)
      return l ? this.cuerpos.get(l.body) : undefined
    }
    switch (i.process) {
      case 'friccion': {
        const a = de('a')
        if (!a) return this.no('rol-sin-cuerpo')
        if (this.yo.stamina < 1) return this.no('sin-fuerza')
        a.q.temperature = (a.q.temperature ?? 0) + 120
        a.tasa = { ...a.tasa, temperature: 120 }
        this.yo.stamina -= 16
        return this.ok()
      }
      case 'deshilachar': {
        const s = de('source')
        if (!s) return this.no('rol-sin-cuerpo')
        if (this.yo.stamina < 3) return this.no('sin-fuerza')
        this.yo.stamina -= 4
        const h: CuerpoDeJuguete = {
          id: `hebra-${++this.nacidos}`,
          at: { ...this.yo.at },
          name: 'hebra',
          madeByMe: true,
          q: { flexibility: 0.9, tensile: 0.5, mass: 0.05, portable: 1 },
        }
        this.cuerpos.set(h.id, { vivo: true, ...h })
        return this.ok([this.vista(h)])
      }
      case 'union': {
        const a = de('a')
        const binder = de('binder')
        if (!a || !binder) return this.no('rol-sin-cuerpo')
        const e: CuerpoDeJuguete = {
          id: `ensamble-${++this.nacidos}`,
          at: { ...this.yo.at },
          name: 'caña',
          madeByMe: true,
          heldBy: ACTOR,
          q: { reach: 3, catch: 1, mass: 0.5, portable: 1, rigidity: 0.6 },
        }
        this.cuerpos.set(e.id, { vivo: true, ...e })
        this.yo.holding = this.yo.holding.filter((x) => x !== a.id && x !== binder.id)
        this.yo.holding.push(e.id)
        a.vivo = false
        binder.vivo = false
        return this.ok([this.vista(e)])
      }
      case 'extraccion': {
        const s = de('source')
        if (!s) return this.no('rol-sin-cuerpo')
        if ((s.q.mass ?? 0) <= 0) return this.no('rol-no-cumple')
        s.q.mass = (s.q.mass ?? 0) - 1
        const p: CuerpoDeJuguete = {
          id: `pieza-${++this.nacidos}`,
          at: { ...this.yo.at },
          name: 'pescado',
          q: { nutrition: 8, mass: 0.6, digestibility: 0.6, portable: 1, toxicity: 0 },
        }
        this.cuerpos.set(p.id, { vivo: true, ...p })
        return this.ok([this.vista(p)])
      }
      default:
        return this.no('proceso-desconocido')
    }
  }

  private correrTiempo(segundos: number): void {
    for (const c of this.cuerpos.values()) {
      for (const [q, t] of Object.entries(c.tasa ?? {})) {
        c.q[q as QualityId] = (c.q[q as QualityId] ?? 0) + t * segundos
      }
    }
    this.reloj = {
      ...this.reloj,
      secondsToNightfall: Math.max(0, this.reloj.secondsToNightfall - segundos),
      phase: this.reloj.secondsToNightfall - segundos <= 0 ? 'noche' : this.reloj.phase,
    }
  }
}

/**
 * Corre una habilidad hasta que termina. `tope` existe porque una habilidad que
 * no termina es un bug de la habilidad, no del mundo, y el test tiene que
 * distinguirlos: si se corta por tope, se sabe.
 */
export function correr(
  m: Mundito,
  gen: Generator<Intent, Outcome, StepResult>,
  tope = 200,
): { outcome: Outcome; pasos: number; cortada: boolean } {
  let paso = gen.next()
  let n = 0
  while (!paso.done) {
    if (++n > tope) return { outcome: { ok: false, why: 'no terminó' }, pasos: n, cortada: true }
    paso = gen.next(m.juzgar(paso.value))
  }
  return { outcome: paso.value, pasos: n, cortada: false }
}
