// ─── @anima/perceive/contexto.ts ─────────────────────────────────────────────
//
// EL `WorldCtx` DE PRODUCCIÓN. Lo que hasta hoy sólo existía en
// `skills/tests/mundito.ts`, un juguete declarado como tal en su encabezado.
//
// El contrato que gobierna este archivo está escrito en `skills/src/ejecutor.ts`
// y hay que respetarlo al pie:
//
//   «el mundo entrega UN objeto por habilidad en vuelo y lo REFRESCA EN SU LUGAR
//    cada tick. No puede entregar uno nuevo por paso, porque el generador se
//    quedó con la referencia del primero y no hay forma de cambiársela. Y no
//    puede compartir uno entre dos habilidades, porque `ctx.memory` es de cada
//    una.»
//
// Acá eso se cumple de la única forma que lo hace verdadero: **hay un objeto por
// vuelo, y `tick`, `clock` y `self` son GETTERS**. La proyección se cambia con
// `refrescar()` y todo lo demás se lee de ella en el momento del acceso. Un
// spread de este objeto evaluaría los getters una vez y congelaría la percepción
// para siempre — que es exactamente lo que el test del Hito 4 esquivaba a mano
// copiando descriptores uno por uno.

import type { Physics, Process, QualityId } from '@anima/physics'
import {
  baseRoleName,
  cumpleRol,
  fexp,
  fln,
  fpow,
  fx,
  isOptionalRole,
  qualityOf,
  unfx,
} from '@anima/physics'
import type {
  Actor,
  ActorId,
  Intent,
  Motivo,
  Placement,
  RoleBinding,
  WorldBody,
  WorldState,
} from '@anima/world'
import {
  chebyshev,
  COMMITMENT_OF,
  keyOfCell,
  ordenarRoles,
  relojDe,
} from '@anima/world'
import type {
  BodyView,
  Cell,
  CellQuality,
  Clock,
  DetMath,
  PerceptionView,
  PlaceMemory,
  RolesOf,
  SeedProcessId,
  SelfView,
  Verdict,
  Where,
  WhereCell,
} from '@anima/skills'
import type { WorldCtx } from '@anima/skills'
import type { WorldRng } from '@anima/oracle'

import { RADIO_DE_PERCEPCION } from './indice.js'
import type { Proyeccion } from './vista.js'
import type { LibroDeLugares } from './lugares.js'

/**
 * El campo que lleva el `explore` para que su clausura no se pierda.
 *
 * ─── El problema, dicho entero ──────────────────────────────────────────────
 *
 * `ctx.explore({ until, maxTicks })` devuelve un `Intent` de `@anima/world`, y
 * ese tipo es `{ k:'explore', maxTicks }`: **la clausura no tiene dónde viajar**.
 * Y no alcanza con guardarla en una ranura del contexto y buscarla al recibir el
 * `yield`, porque `SkillRun.step()` hace `{ ...cedido, by, seq }` — o sea que la
 * intención que llega al ejecutor **no es el mismo objeto** que devolvió el
 * constructor, y una `WeakMap` por identidad no la encuentra.
 *
 * ─── Por qué un NÚMERO y no la función ──────────────────────────────────────
 *
 * Un campo con la función adentro sobreviviría al spread (es una propiedad
 * propia y enumerable) y sería más corto. No se hace: `hashWorld` LANZA ante una
 * función, y aunque hoy ninguna intención llega al hash ni al journal
 * —verificado: `grep Intent world/src/journal.ts` da cero—, meter una clausura
 * en el dato que el mundo juzga es la clase de cosa que explota tres hitos
 * después, cuando alguien decida guardar las intenciones del tick. Un entero no
 * explota nunca: `canonico()` lo serializa, `stepWorld` lo ignora, y el hash de
 * la traza sigue siendo función de la corrida porque el contador también lo es.
 */
export const CAMPO_UNTIL = '__until'

export type Until = (v: PerceptionView) => boolean

export function untilDe(i: Intent): number | undefined {
  const n = (i as unknown as Record<string, unknown>)[CAMPO_UNTIL]
  return typeof n === 'number' ? n : undefined
}

// ─── El ensayo en seco de un proceso ────────────────────────────────────────

/**
 * `arrangement`: dónde tienen que estar los cuerpos.
 *
 * **ES UN ESPEJO de `arregloOk` (`world/src/step.ts`), que no se exporta**, y la
 * copia no se sostiene con este comentario: `tests/el-puente.test.ts` («`can()`
 * contesta lo mismo que `stepWorld`») corre las mismas ligaduras por los dos
 * caminos y exige que contesten lo mismo. Si el mundo cambia una regla de
 * arreglo, el espejo se rompe en rojo y no en silencio.
 *
 * Por qué no se puede llamar al del mundo: `can()` es un ENSAYO EN SECO —«no
 * ejecuta y no cuesta nada», dice la superficie— y `stepWorld` es el paso. Pedir
 * el veredicto corriendo el paso costaría el tick entero y encima lo aplicaría.
 */
function arregloOk(
  state: WorldState,
  a: Actor,
  p: Process,
  cuerpos: readonly WorldBody[],
): boolean {
  const mio = state.bodies.get(a.body)
  if (mio === undefined) return false
  switch (p.arrangement.k) {
    case 'held':
      return cuerpos.every((c) => c.heldBy === a.id || c.body.id === mio.body.id)
    case 'within': {
      const r = p.arrangement.radius
      return cuerpos.every((c) => chebyshev(mio.at, c.at) <= r)
    }
    case 'contact': {
      const k = keyOfCell(cuerpos[0]?.at ?? mio.at)
      return cuerpos.every((c) => keyOfCell(c.at) === k)
    }
    case 'supported':
      return cuerpos.every((c) => c.supportedBy !== undefined || c.heldBy === a.id)
    case 'inside':
      return cuerpos.every((c) => c.covering !== undefined || c.heldBy === a.id)
  }
}

/** Espejo de `compuertaOk`. Ninguno de los cuatro semilla la usa; el modelo puede. */
function compuertaOk(phys: Physics, p: Process, cuerpos: readonly WorldBody[]): boolean {
  if (p.gate.length === 0) return true
  const primero = cuerpos[0]
  if (primero === undefined) return false
  for (const t of p.gate) {
    const v = qualityOf(primero.body, t.q, phys)
    const ok = t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
    if (!ok) return false
  }
  return true
}

function noPuede(por: Motivo, why: string): Verdict {
  return { ok: false, por, why }
}

// ─── El contexto ────────────────────────────────────────────────────────────

export interface ContextoOptions {
  readonly actor: ActorId
  readonly rng: WorldRng
  readonly lugares: LibroDeLugares
  readonly radio?: number
}

/**
 * El contexto de UNA habilidad en vuelo. Se construye una vez y se refresca en
 * su lugar con `refrescar()` en cada tick.
 *
 * `ctx.tick` NO es el reloj del mundo: la superficie lo declara «el contador de
 * PASOS: cuántas veces llamaron a esta habilidad». Lo lleva `pasos`, que sube el
 * ejecutor.
 */
export class Contexto {
  readonly ctx: WorldCtx
  readonly actor: ActorId
  #proy: Proyeccion
  /** El estado del tick ANTERIOR, y nada más. Es todo lo que `rateOf` necesita. */
  #antes: WorldState | undefined
  #pasos = 0
  #seqUntil = 0
  readonly #untils = new Map<number, Until>()
  readonly #dicho: string[] = []
  readonly #radio: number
  readonly #lugares: LibroDeLugares

  constructor(proy: Proyeccion, o: ContextoOptions) {
    this.#proy = proy
    this.actor = o.actor
    this.#radio = o.radio ?? RADIO_DE_PERCEPCION
    this.#lugares = o.lugares
    this.ctx = this.#armar(o.rng)
  }

  /** Lo que se dijo. Canal de habla: no cuesta turno del cuerpo. */
  get dicho(): readonly string[] {
    return this.#dicho
  }

  get pasos(): number {
    return this.#pasos
  }

  contarPaso(): void {
    this.#pasos += 1
  }

  /**
   * EL REFRESCO EN SU LUGAR. No devuelve un contexto nuevo: cambia la proyección
   * de la que cuelgan todos los getters del objeto que la habilidad ya tiene.
   */
  refrescar(proy: Proyeccion): void {
    this.#antes = this.#proy.state
    this.#proy = proy
  }

  get proyeccion(): Proyeccion {
    return this.#proy
  }

  /** El `until` que corresponde a esta intención `explore`, si lo hay. */
  untilDeIntencion(i: Intent): Until | undefined {
    const n = untilDe(i)
    return n === undefined ? undefined : this.#untils.get(n)
  }

  olvidarUntil(i: Intent): void {
    const n = untilDe(i)
    if (n !== undefined) this.#untils.delete(n)
  }

  #actorActual(): Actor | undefined {
    return this.#proy.state.actors.get(this.actor)
  }

  /**
   * La criatura. Si el actor ya no está —se murió de hambre— se devuelve la
   * ÚLTIMA vista conocida con `stamina: 0`, y no se lanza: una habilidad en
   * vuelo que lee `ctx.self` en el mismo paso en que su criatura se murió no
   * tiene que romperse con un `TypeError` del runtime, tiene que ver una
   * criatura sin fuerzas y decidir. El ejecutor la corta igual (ver `vuelo.ts`).
   */
  #self(): SelfView {
    const a = this.#actorActual()
    const v = a === undefined ? undefined : this.#proy.self(a)
    if (v !== undefined) return v
    return this.#muerta
  }

  /**
   * Congelada entera, y no sólo su `at`: es la MISMA vista para todos los pasos
   * de todas las habilidades de este contexto —se construye una vez y se devuelve
   * por identidad— así que sin congelarla, una habilidad que le escribiera un
   * campo se lo dejaría escrito a todas las demás lecturas. Es el mismo argumento
   * de la DECISIÓN 4 de `vista.ts`, agravado porque acá el objeto no muere ni con
   * el tick.
   */
  readonly #muerta: SelfView = Object.freeze({
    id: '',
    at: Object.freeze({ x: 0, y: 0 }),
    name: '',
    // Sin cuerpo no hay partes, y sin partes no hay materia de ninguna clase: `[]`
    // es la respuesta y no un relleno. Es la misma que da `tagsDe` sobre un cuerpo
    // sin partes, así que la muerta no miente sobre lo que era.
    tags: Object.freeze([]) as readonly [],
    madeByMe: false,
    joints: Object.freeze([]) as readonly [],
    holding: Object.freeze([]) as readonly [],
    capacity: 0,
    stamina: 0,
    permits: 'reversible' as const,
  })

  #see(w: Where): BodyView[] {
    const self = this.#self()
    const phys = this.#proy.phys
    const out: BodyView[] = []
    for (const b of this.#proy.aLaVista(self.at, this.actor, this.#radio)) {
      const c = this.#proy.state.bodies.get(b.id)
      if (c === undefined) continue
      let ok = true
      for (const t of w) {
        const v = qualityOf(c.body, t.q, phys)
        const pasa = t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
        if (!pasa) {
          ok = false
          break
        }
      }
      if (ok) out.push(b)
    }
    return out
  }

  #qAt(at: Cell, q: CellQuality): number {
    return this.#proy.indice.celda(at)[q]
  }

  #q(b: BodyView, q: QualityId): number {
    const c = this.#proy.state.bodies.get(b.id)
    return c === undefined ? 0 : qualityOf(c.body, q, this.#proy.phys)
  }

  /**
   * ADR II-0004 — la tasa con la que las leyes están moviendo esa cualidad, en
   * unidades por SEGUNDO de mundo.
   *
   * ─── Cómo se contesta, y qué NO es ──────────────────────────────────────
   *
   * `@anima/world` no publica ninguna tasa: `paso()` devuelve el cuerpo nuevo y
   * se termina ahí. Así que lo honesto —y lo único disponible sin tocar la
   * física— es **la diferencia medida contra el tick anterior, dividida por el
   * dt**. No simula nada y no proyecta nada: es exactamente «lo que el motor ya
   * movió», que es lo que el ADR pide, leído por la resta en vez de por un campo.
   *
   * Las dos consecuencias, dichas:
   *
   *   - es la tasa del tick PASADO y no la del que viene. Con las leyes que hay
   *     —relajación exponencial— las dos difieren en un `dt`, y el supuesto «si
   *     nada cambia» que el ADR pone a la vista de quien escribe ya cubre eso;
   *   - en el primer tick de la partida no hay contra qué restar y devuelve 0,
   *     que es lo mismo que devuelve una cualidad que nadie está tocando. Es
   *     correcto: en el tick 0 ninguna ley corrió todavía.
   */
  #rateOf(b: BodyView, q: QualityId): number {
    const antes = this.#antes
    if (antes === undefined) return 0
    const viejo = antes.bodies.get(b.id)
    const nuevo = this.#proy.state.bodies.get(b.id)
    if (viejo === undefined || nuevo === undefined) return 0
    const a = qualityOf(viejo.body, q, antes.phys)
    const z = qualityOf(nuevo.body, q, this.#proy.phys)
    if (a === z) return 0
    const ticks = this.#proy.state.tick - antes.tick
    if (ticks <= 0) return 0
    // `dt = ticks/hz`, y se divide una sola vez: la tasa es por segundo de mundo
    // y no por muestra (ADR II-0008).
    return ((z - a) * this.#proy.state.hz) / ticks
  }

  #can<P extends SeedProcessId>(p: P, roles: RolesOf<P>): Verdict {
    const state = this.#proy.state
    const proceso = state.phys.processes.get(p)
    if (proceso === undefined) return noPuede('proceso-desconocido', `no existe el proceso ${p}`)
    const a = this.#actorActual()
    if (a === undefined) return noPuede('actor-desconocido', 'esta criatura ya no está en el mundo')
    const dados = roles as unknown as Record<string, BodyView | undefined>
    const cuerpos: WorldBody[] = []
    for (const role of proceso.roles) {
      const base = baseRoleName(role.name)
      const v = dados[base] ?? dados[role.name]
      if (v === undefined) {
        if (isOptionalRole(role.name)) continue
        return noPuede('rol-sin-cuerpo', `falta el rol ${base}`)
      }
      const c = state.bodies.get(v.id)
      if (c === undefined) return noPuede('cuerpo-desconocido', `${v.id} ya no existe`)
      if (!cumpleRol(c.body, role, state.phys)) {
        return noPuede('rol-no-cumple', `${v.name} no cumple lo que ${base} pide`)
      }
      cuerpos.push(c)
    }
    if (!arregloOk(state, a, proceso, cuerpos)) {
      return noPuede('arreglo-incorrecto', `${p} pide un arreglo ${proceso.arrangement.k}`)
    }
    if (!compuertaOk(state.phys, proceso, cuerpos)) {
      return noPuede('compuerta-cerrada', `la compuerta de ${p} está cerrada`)
    }
    return { ok: true }
  }

  #vistaDePercepcion(): PerceptionView {
    // Se arma una vez y sus tres miembros leen la proyección VIVA, que es lo
    // mismo que hace el `ctx`. Es la vista que recibe el `until` de `explore`, y
    // el criterio dice «con la vista NUEVA de cada tick»: si esto capturara la
    // proyección del tick en que se construyó, `explore` nunca encontraría nada.
    const self = (): SelfView => this.#self()
    const ver = (w: Where): BodyView[] => this.#see(w)
    const qAt = (at: Cell, q: CellQuality): number => this.#qAt(at, q)
    const v = {
      see: ver,
      qAt,
      get self(): SelfView {
        return self()
      },
    }
    return v as PerceptionView
  }

  get percepcion(): PerceptionView {
    return this.#vistaDePercepcion()
  }

  #intencion(base: Record<string, unknown> & { k: Intent['k'] }): Intent {
    // El `commitment` lo pone la tabla DEL MUNDO (`COMMITMENT_OF`) y no esta
    // capa: `stepWorld` lo recalcula y castiga la mentira. Copiarlo a mano acá
    // sería la segunda copia que diverge — el bug de `DSL_REFERENCE`.
    // `apply` no está en la tabla porque su compromiso es el del PROCESO.
    const commitment =
      base.k === 'apply'
        ? this.#proy.state.phys.processes.get(base['process'] as string)?.commitment ?? 'irreversible'
        : COMMITMENT_OF[base.k as Exclude<Intent['k'], 'apply'>]
    // `by` y `seq` los estampa `SkillRun` (la firma de la casa, agujero 6 del
    // ataque al sandbox). Van en cero acá sólo para que el objeto tenga la forma
    // de un `Intent`; el ejecutor los pisa siempre.
    return { by: this.actor, seq: 0, commitment, ...base } as unknown as Intent
  }

  #armar(rng: WorldRng): WorldCtx {
    const yo = this
    const math: DetMath = {
      // Las tres envolturas en doubles del punto fijo de `@anima/physics`, tal
      // como la superficie las declara. NO son `Math.exp`/`Math.log`/`Math.pow`:
      // ECMAScript no especifica su precisión, dos motores devuelven el último
      // bit distinto y el replay diverge en el tick 400 (regla 2 de
      // `ii/README.md`). El `fx`/`unfx` de ida y vuelta es el precio de que la
      // superficie hable en doubles y la física en punto fijo — y es el precio
      // correcto: lo que se pierde es precisión más allá de 1/1000, y lo que se
      // gana es el mismo bit en toda máquina.
      exp: (x: number) => unfx(fexp(fx(x))),
      log: (x: number) => unfx(fln(fx(x))),
      pow: (b: number, e: number) => unfx(fpow(fx(b), fx(e))),
    }
    const base = {
      hz: this.#proy.state.hz,
      get tick(): number {
        return yo.#pasos
      },
      get clock(): Clock {
        return relojDe(yo.#proy.state)
      },
      get self(): SelfView {
        return yo.#self()
      },
      see: (w: Where): BodyView[] => yo.#see(w),
      recall: (w: WhereCell): PlaceMemory[] => yo.#lugares.recall(yo.actor, w),
      q: (b: BodyView, q: QualityId): number => yo.#q(b, q),
      qAt: (at: Cell, q: CellQuality): number => yo.#qAt(at, q),
      rateOf: (b: BodyView, q: QualityId): number => yo.#rateOf(b, q),
      can: <P extends SeedProcessId>(p: P, roles: RolesOf<P>): Verdict => yo.#can(p, roles),
      goTo: (t: BodyView | Cell, o?: { within?: number }): Intent =>
        yo.#intencion({
          k: 'goTo',
          to: ('at' in t ? t.at : t) as Placement,
          within: o?.within ?? 0,
        }),
      take: (b: BodyView): Intent => yo.#intencion({ k: 'take', what: b.id }),
      put: (b: BodyView, at: Cell, o?: { onTopOf?: BodyView; covering?: BodyView }): Intent => {
        const i: Record<string, unknown> & { k: 'put' } = { k: 'put', what: b.id, at }
        // Campo por campo: con `exactOptionalPropertyTypes` un `covering:
        // undefined` explícito no es lo mismo que la clave ausente, y viajaría.
        if (o?.onTopOf !== undefined) i['onTopOf'] = o.onTopOf.id
        if (o?.covering !== undefined) i['covering'] = o.covering.id
        return yo.#intencion(i)
      },
      drop: (b: BodyView): Intent => yo.#intencion({ k: 'drop', what: b.id }),
      place: (b: BodyView, at: Cell, revision?: string): Intent =>
        yo.#intencion(
          revision === undefined
            ? { k: 'place', what: b.id, at }
            : { k: 'place', what: b.id, at, revision },
        ),
      apply: <P extends SeedProcessId>(p: P, roles: RolesOf<P>): Intent => {
        const rs: RoleBinding[] = []
        for (const [name, b] of Object.entries(roles as Record<string, BodyView | undefined>)) {
          if (b !== undefined) rs.push({ name, body: b.id })
        }
        // `ordenarRoles` es del mundo, y se usa el del mundo: el orden de
        // `Object.entries` depende de cómo se construyó el objeto, así que dos
        // habilidades que arman el mismo `{a,b}` en distinto orden emitirían
        // intenciones distintas y `mismosRoles` no las vería continuar.
        return yo.#intencion({ k: 'apply', process: p, roles: ordenarRoles(rs) })
      },
      explore: (o: { until: Until; maxTicks: number }): Intent => {
        const n = yo.#seqUntil++
        yo.#untils.set(n, o.until)
        return yo.#intencion({ k: 'explore', maxTicks: o.maxTicks, [CAMPO_UNTIL]: n })
      },
      eat: (b: BodyView): Intent => yo.#intencion({ k: 'eat', what: b.id }),
      wait: (segundos: number): Intent => yo.#intencion({ k: 'wait', segundos }),
      say: (t: string): void => {
        yo.#dicho.push(t)
      },
      rng,
      math,
    }
    return base as unknown as WorldCtx
  }
}
