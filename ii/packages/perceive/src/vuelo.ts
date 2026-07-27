// ─── @anima/perceive/vuelo.ts ────────────────────────────────────────────────
//
// UNA HABILIDAD EN VUELO SOBRE EL MUNDO DE VERDAD. Acá vive **la costura más
// grande que el Hito 4 dejó abierta**: la repetición.
//
// El mundo da UN PASO por intención. `intencionCaminar` avanza una celda;
// `intencionExplorar` avanza una celda en un rumbo que sale del reloj;
// `intencionAplicar` suma un `dt` a la actividad. Y las quince innatas están
// escritas contra otra cosa: `ir` espera que `goTo` conteste `arrived`, `unir`
// espera que un solo `apply('union')` devuelva el ensamble en `r.got[0]`, y
// `explorar` espera `found` o `timeout` — dos estados **que `stepWorld` no
// produce jamás** (`grep -rn "'found'" world/src` da cero).
//
// Quien repite es el EJECUTOR. Es lo que hoy hace el mundito, que lo dice en un
// comentario: «el mundito hace de ejecutor acá… es exactamente la costura que
// falta» (`skills/tests/mundito.ts:371-375`).
//
// ─── LA REGLA, una sola, para las cuatro clases que se repiten ──────────────
//
// **Se reemite mientras el mundo siga diciendo que está pasando y el objetivo no
// se haya cumplido; se corta en el PRIMER rechazo.** El ejecutor no discute con
// el mundo: si `stepWorld` dijo `celda-ocupada`, el resultado sube con
// `rejected` y ese motivo, y quien decide si vale la pena insistir es la mente
// —`ir` lo hace, y su comentario explica por qué `celda-ocupada` sí se reintenta
// y `sin-fuerza` no—. Un ejecutor que reintentara solo le sacaría esa decisión a
// la habilidad sin decírselo.
//
// ─── El `seq` NO se mueve al reemitir, y eso es lo que hace que funcione ────
//
// Se reemite el MISMO objeto `Intent`, con el mismo par `(by, seq)` que estampó
// `SkillRun`. Tres cosas dependen de eso:
//
//   - `desenlaceDe(events, {by, seq})` correlaciona por el par. Con un `seq`
//     nuevo por tick, la respuesta de una espera abierta —que llega ticks
//     después de que se la pidió— no le correspondería a nadie;
//   - `esperar()` del mundo CONTINÚA una espera con el mismo pedido en vez de
//     reiniciarla, y actualiza el `seq` a «quien acaba de preguntar»;
//   - `stepWorld` rechaza dos intenciones del mismo actor con el mismo `seq` EN
//     EL MISMO TICK. En ticks distintos no hay empate, y acá nunca hay dos.

import type { Physics } from '@anima/physics'
import type { ActorId, BodyId, Intent, Placement, SimEvent, WorldState } from '@anima/world'
import { chebyshev, desenlaceDe } from '@anima/world'
import type { BodyView, Outcome, Skill, StepResult } from '@anima/skills'
import { SkillRun, type SavedSkillState, type Step } from '@anima/skills'
import type { FuelCell } from '@anima/skills'

import type { Contexto } from './contexto.js'
import { resultado, traducir } from './puente.js'
import type { Proyeccion } from './vista.js'

/**
 * Cuánta holgura se le da a un viaje sobre la distancia en línea recta.
 *
 * `intencionCaminar` camina en diagonal hacia el destino, así que un viaje sin
 * estorbos cuesta EXACTAMENTE la distancia de Chebyshev. El 2× es para los
 * rodeos que el mundo todavía no sabe hacer —hoy un estorbo se rechaza, no se
 * bordea— y el +8 es para que un `goTo` a la celda de al lado tenga margen. No
 * es una calibración: es una cota superior generosa cuyo único trabajo es que
 * una habilidad rota no se lleve la partida puesta. El día que haya pathfinding,
 * la cota correcta es el largo del camino y esto se borra.
 */
export const HOLGURA_DE_VIAJE = 2
export const PISO_DE_VIAJE = 8

/**
 * Ticks de margen sobre lo que el catálogo dice que tarda un proceso.
 *
 * `completion.at` está en SEGUNDOS (ADR II-0008), así que el presupuesto es
 * `at × hz` ticks, DERIVADO y no elegido. Los dos de más son el tick en que se
 * abre la actividad y el redondeo de `sumarPaso`.
 */
export const MARGEN_DE_PROCESO = 2

/** Lo mismo para una espera: `segundos × hz`, más el tick de apertura y el cierre. */
export const MARGEN_DE_ESPERA = 4

interface Repeticion {
  /** El objeto EXACTO que se reemite, con `by` y `seq` ya estampados. */
  readonly intent: Intent
  /** Si hay que volver a mandarla al mundo, o sólo escuchar (`wait`). */
  readonly reemite: boolean
  /** Cuántos ticks lleva en vuelo. Es lo que se compara contra `tope`. */
  ticks: number
  readonly tope: number
  /** `goTo`: adónde y con cuánta tolerancia. */
  readonly to?: Placement
  readonly within: number
  /** `goTo`: la distancia al final del tick anterior, para ver si hay avance. */
  distancia: number
  /** `apply`: si el proceso declara `completion`. Sin ella no completa NUNCA. */
  readonly completa: boolean
  /** Lo que nació en el camino. Se acumula: un proceso largo rinde al final. */
  readonly nacidos: BodyId[]
}

export interface VueloOptions {
  readonly by: ActorId
  readonly fuelPerStep?: number
  readonly maxStalls?: number
  readonly cell?: FuelCell
  readonly saved?: SavedSkillState
}

/**
 * Una habilidad corriendo contra el mundo, tick a tick.
 *
 * El `SkillRun` no cambia: sigue siendo la máquina de cuatro estados del Hito 4.
 * Lo que se le agrega alrededor es la repetición, que es lo que convierte «un
 * paso del mundo» en «llegué».
 */
export class Vuelo<A> {
  readonly run: SkillRun<A>
  readonly ctx: Contexto
  readonly by: ActorId
  #pendiente: Repeticion | undefined
  /** El resultado que le toca al próximo avance del generador. */
  #aEntregar: StepResult | undefined
  /** La intención que se mandó al mundo en este tick, para correlacionarla. */
  #enMesa: Intent | undefined
  #terminado = false
  #ticksEnVuelo = 0

  constructor(skill: Skill<A>, ctx: Contexto, args: A, o: VueloOptions) {
    this.ctx = ctx
    this.by = o.by
    const opciones = {
      by: o.by,
      ...(o.fuelPerStep === undefined ? {} : { fuelPerStep: o.fuelPerStep }),
      ...(o.maxStalls === undefined ? {} : { maxStalls: o.maxStalls }),
      ...(o.cell === undefined ? {} : { cell: o.cell }),
      ...(o.saved === undefined ? {} : { saved: o.saved }),
    }
    this.run = new SkillRun(skill, ctx.ctx, args, opciones)
  }

  get terminado(): boolean {
    return this.#terminado
  }

  get outcome(): Outcome | undefined {
    return this.run.outcome
  }

  /** Cuántos ticks del mundo consumió este vuelo. No es `ctx.tick`, que son PASOS. */
  get ticks(): number {
    return this.#ticksEnVuelo
  }

  /** El último paso del ejecutor, para el informe de fallo. */
  #ultimo: Step | undefined
  get ultimo(): Step | undefined {
    return this.#ultimo
  }

  /**
   * FASE A del tick: qué le manda esta habilidad al mundo.
   *
   * Se llama ANTES de `stepWorld` y con la proyección del estado actual, que es
   * el mundo que la criatura vio — «la criatura actúa sobre el mundo que vio, no
   * sobre el que quedó después de que la física se moviera» (`world/src/step.ts`).
   */
  intencionDelTick(): Intent | undefined {
    this.#enMesa = undefined
    if (this.#terminado) return undefined
    this.#ticksEnVuelo += 1

    const p = this.#pendiente
    if (p !== undefined) {
      p.ticks += 1
      if (!p.reemite) return undefined
      this.#enMesa = p.intent
      return p.intent
    }

    this.ctx.contarPaso()
    const paso = this.run.step(this.#aEntregar)
    this.#aEntregar = undefined
    this.#ultimo = paso
    switch (paso.k) {
      case 'terminada':
      case 'rota':
        this.#terminado = true
        return undefined
      case 'suspendida':
        // Se le acabó el tanque computando. No manda nada y se la reanuda el tick
        // que viene EN EL MISMO PUNTO. No es un tick perdido: el mundo avanzó.
        return undefined
      case 'intent': {
        this.#pendiente = this.#abrir(paso.intent)
        this.#enMesa = paso.intent
        return paso.intent
      }
    }
  }

  /**
   * FASE B del tick: qué le contesta el mundo.
   *
   * Se llama DESPUÉS de `stepWorld` y del refresco de la vista, así que el
   * `until` de `explore` y la distancia de `goTo` se evalúan contra el mundo
   * NUEVO, que es el criterio (d).
   */
  resolver(events: readonly SimEvent[], proy: Proyeccion): void {
    const p = this.#pendiente
    if (p === undefined || this.#terminado) return
    const d = desenlaceDe(events, { by: p.intent.by, seq: p.intent.seq })
    for (const id of d.nacidos) if (!p.nacidos.includes(id)) p.nacidos.push(id)

    if (d.k === 'rechazado') {
      this.#cerrar(resultado('rejected', this.#vistas(p.nacidos, proy), d.por))
      return
    }

    switch (p.intent.k) {
      case 'goTo':
        this.#resolverViaje(p, proy)
        return
      case 'explore':
        this.#resolverExploracion(p, proy)
        return
      case 'apply':
        this.#resolverProceso(p, d.k === 'en-curso', proy)
        return
      case 'wait':
        if (d.k === 'en-curso') {
          if (p.ticks >= p.tope) this.#cerrar(resultado('timeout', [], undefined))
          return
        }
        // `sin-respuesta` sobre una espera abierta significa que la espera ya no
        // existe: el actor gastó el turno en otra cosa, o se murió. Es
        // exactamente lo que `Desenlace` nombra, y `blocked` es su traducción.
        this.#cerrar(traducir(d, []) ?? resultado('done'))
        return
      default: {
        const r = traducir(d, this.#vistas(p.nacidos, proy))
        this.#cerrar(r ?? resultado('done', this.#vistas(p.nacidos, proy)))
        return
      }
    }
  }

  /** Corta el vuelo desde afuera. La criatura se murió, la partida se cierra. */
  abortar(why: string): void {
    if (this.#terminado) return
    this.#ultimo = this.run.abort(why)
    this.#terminado = true
    this.#pendiente = undefined
  }

  // ─── Las cuatro repeticiones ──────────────────────────────────────────────

  #resolverViaje(p: Repeticion, proy: Proyeccion): void {
    const ahora = this.#dondeEstoy(proy.state)
    const destino = p.to
    if (ahora === undefined || destino === undefined) {
      this.#cerrar(resultado('blocked'))
      return
    }
    const d = chebyshev(ahora, destino)
    if (d <= p.within) {
      this.#cerrar(resultado('arrived'))
      return
    }
    if (d >= p.distancia) {
      // Ni rechazo ni avance: el mundo no dijo que no y la criatura no se acercó.
      // Es el ÚNICO caso que el mundo no puede nombrar —sabe si algo pasó, si lo
      // rechazó o si sigue pasando— y por eso es donde `blocked` significa algo.
      // Hoy `intencionCaminar` no lo produce (o mueve, o rechaza); lo va a
      // producir el día que caminar tenga velocidad sub-celda.
      this.#cerrar(resultado('blocked'))
      return
    }
    p.distancia = d
    if (p.ticks >= p.tope) this.#cerrar(resultado('timeout'))
  }

  #resolverExploracion(p: Repeticion, proy: Proyeccion): void {
    const until = this.ctx.untilDeIntencion(p.intent)
    // La vista NUEVA: `ctx.refrescar()` ya corrió, así que `percepcion` cuelga
    // del estado de este tick. Es la mitad del criterio (d).
    if (until !== undefined && until(this.ctx.percepcion)) {
      this.ctx.olvidarUntil(p.intent)
      this.#cerrar(resultado('found', this.#vistas(p.nacidos, proy)))
      return
    }
    if (p.ticks >= p.tope) {
      this.ctx.olvidarUntil(p.intent)
      this.#cerrar(resultado('timeout'))
    }
  }

  #resolverProceso(p: Repeticion, enCurso: boolean, proy: Proyeccion): void {
    if (!p.completa) {
      // Un proceso SIN `completion` —`friccion` es el caso— no completa nunca:
      // `intencionAplicar` calcula `completo = at !== undefined && …`. Repetirlo
      // sería un bucle infinito, así que cierra en un tick y quien quiera seguir
      // frotando lo reemite él (que es literalmente lo que hace `frotar`).
      this.#cerrar(resultado('done', this.#vistas(p.nacidos, proy)))
      return
    }
    if (!enCurso) {
      this.#cerrar(resultado('done', this.#vistas(p.nacidos, proy)))
      return
    }
    if (p.ticks >= p.tope) this.#cerrar(resultado('timeout', this.#vistas(p.nacidos, proy)))
  }

  // ─── Armado y cierre ──────────────────────────────────────────────────────

  #abrir(i: Intent): Repeticion {
    const state = this.ctx.proyeccion.state
    const base = {
      intent: i,
      ticks: 1,
      within: 0,
      distancia: Number.POSITIVE_INFINITY,
      completa: false,
      nacidos: [] as BodyId[],
    }
    switch (i.k) {
      case 'goTo': {
        const desde = this.#dondeEstoy(state)
        const d = desde === undefined ? 0 : chebyshev(desde, i.to)
        return {
          ...base,
          reemite: true,
          to: i.to,
          within: i.within,
          distancia: Number.POSITIVE_INFINITY,
          tope: HOLGURA_DE_VIAJE * d + PISO_DE_VIAJE,
        }
      }
      case 'explore':
        return {
          ...base,
          reemite: true,
          // EXACTAMENTE `maxTicks`, que es la mitad del criterio (d). No
          // `maxTicks + 1` por el tick de apertura: el primer tick YA explora.
          tope: i.maxTicks,
        }
      case 'apply': {
        const p: Physics = state.phys
        const at = p.processes.get(i.process)?.completion?.at
        return {
          ...base,
          reemite: true,
          completa: at !== undefined,
          tope: at === undefined ? 1 : Math.ceil(at * state.hz) + MARGEN_DE_PROCESO,
        }
      }
      case 'wait':
        return {
          ...base,
          // NO se reemite, y es lo que el mundo pide: «una habilidad puede emitir
          // `wait(2)` UNA vez y callarse — es el uso previsto». `avanzarEsperas`
          // contesta todos los ticks con el `seq` de la `Espera`, así que
          // escuchar alcanza. Reemitir tampoco rompería —el mundo continúa una
          // espera con el mismo pedido— pero gastaría el turno del cuerpo.
          reemite: false,
          tope: Math.ceil((Number.isFinite(i.segundos) && i.segundos > 0 ? i.segundos : 0) * state.hz) + MARGEN_DE_ESPERA,
        }
      default:
        return { ...base, reemite: false, tope: 1 }
    }
  }

  #cerrar(r: StepResult): void {
    this.#pendiente = undefined
    this.#aEntregar = r
  }

  #dondeEstoy(state: WorldState): Placement | undefined {
    const a = state.actors.get(this.by)
    if (a === undefined) return undefined
    return state.bodies.get(a.body)?.at
  }

  #vistas(ids: readonly BodyId[], proy: Proyeccion): BodyView[] {
    const out: BodyView[] = []
    for (const id of ids) {
      const v = proy.cuerpo(id, this.by)
      if (v !== undefined) out.push(v)
    }
    return out
  }

  /** La intención que este vuelo puso en la mesa de este tick, si puso alguna. */
  get enMesa(): Intent | undefined {
    return this.#enMesa
  }
}
