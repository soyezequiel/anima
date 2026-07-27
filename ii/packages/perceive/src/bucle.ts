// ─── @anima/perceive/bucle.ts ────────────────────────────────────────────────
//
// EL BUCLE DE RELOJ. El principio 1 del documento de arquitectura hecho código:
// **«el tick no tiene un solo `await`»**.
//
// No hay una sola función `async` en este archivo, y no es estilo: un `await` en
// el camino del tick significa que entre que se leyó el mundo y que se escribió
// pasó el planificador de tareas, o sea que dos corridas de la misma partida
// pueden intercalar distinto. Todo lo que corre acá —recolectar intenciones,
// `stepWorld`, refrescar las vistas, resolver los vuelos— es síncrono y en el
// mismo hilo que hospeda el mundo, que es exactamente lo que el Hito 4 compró
// cuando descartó QuickJS.
//
// ═══ `ticksPerdidos`: LA DEFINICIÓN, porque un contador sin definición no mide
// ═══ nada y el criterio del Hito 5 dice `ticksPerdidos === 0`
//
// El bucle divide la corrida en VENTANAS de un tick, de `1000/hz` milisegundos
// cada una. **Un tick está PERDIDO cuando su ventana pasó sin que el mundo
// avanzara.** Hay exactamente dos formas de que eso ocurra y se cuentan por
// separado, porque se arreglan distinto:
//
//   1. **`porTiempo`** — el trabajo de un tick tardó más que su ventana. Cuando
//      termina, ya hay N ventanas vencidas y esas N no las va a correr nadie: el
//      mundo no puede «recuperar» ticks sin correr la física dos veces en un
//      cuadro, que es cómo se rompe un motor determinista de verdad. Se mide
//      contra un `RelojDePared` **inyectado**, y ésa es la única frontera con el
//      reloj del sistema en todo el paquete: sin reloj —el caso por omisión, y el
//      de todo test determinista— este contador no se puede mover, y es correcto,
//      porque sin reloj de pared no hay ninguna ventana que vencer.
//   2. **`porFalla`** — se pidió avanzar un tick y el mundo no avanzó: `stepWorld`
//      lanzó. Es determinista y no necesita ningún reloj.
//
// **Contra qué reloj se cuenta**: contra el DEL BUCLE, no contra el del mundo.
// `state.tick` sube de a uno pase lo que pase, así que un contador que se
// comparara contra él sería idénticamente cero por construcción — mediría que el
// mundo sabe contar, no que la partida llegó a horario. Es la razón por la que
// `grep ticksPerdidos ii/` daba cero coincidencias antes de este archivo: no había
// nada que pudiera perder un tick.
//
// **Y el contador se puede mover**: `tests/el-bucle.test.ts` le inyecta un reloj
// de pared falso que hace que cada tick tarde el doble de su ventana, y exige que
// `ticksPerdidos` suba. Un contador que nadie pudo hacer subir es un cero que no
// significa nada.
//
// ─── Regla 2 de `ii/README.md` ──────────────────────────────────────────────
//
// No hay `Date`, `performance`, `Math.random` ni `Math` trascendente en ninguna
// línea de la lógica: el reloj de pared entra por parámetro y sólo se lo llama en
// `avanzar`, entre ticks. Lo vigila `tests/ataque-determinismo.test.ts`, que lee
// el directorio de `src/` y por lo tanto se entera solo de los archivos nuevos —
// un paquete nuevo nace SIN guardián, y éste nació con el suyo.

import type { ActorId, Intent, SimEvent, WorldState } from '@anima/world'
import { stepWorld } from '@anima/world'
import type { Skill } from '@anima/skills'
import type { WorldRng } from '@anima/oracle'
import { dadoDelMundo, type DadoDelMundo } from '@anima/oracle'

import { Contexto } from './contexto.js'
import { IndiceDelTick } from './indice.js'
import { LibroDeLugares, dondeEsta } from './lugares.js'
import { Proyeccion } from './vista.js'
import { Vuelo, type VueloOptions } from './vuelo.js'

/**
 * El reloj de pared, EN LA FRONTERA. Devuelve milisegundos.
 *
 * Es la única puerta por la que entra el tiempo del sistema, y entra por
 * parámetro para que la lógica no pueda llamarlo: `Date.now` y
 * `performance.now` no aparecen en `src/`, y el guardián de la regla 2 lo
 * verifica leyendo los fuentes.
 */
export type RelojDePared = () => number

export interface PartidaOptions {
  /** El estado del dado DEL MUNDO. Ver `dado` abajo por qué vive acá y no en `WorldState`. */
  readonly semilla?: number
  readonly reloj?: RelojDePared
}

/** El informe de una corrida. Todo número que el criterio del Hito 5 nombra sale de acá. */
export interface Informe {
  readonly ticks: number
  readonly ticksPerdidos: number
  readonly porTiempo: number
  readonly porFalla: number
  /** Los errores que `stepWorld` lanzó, con el tick en que pasó. */
  readonly fallas: readonly { readonly tick: number; readonly why: string }[]
}

export class Partida {
  #state: WorldState
  #anterior: WorldState | undefined
  #proy: Proyeccion
  readonly #vuelos = new Map<ActorId, Vuelo<unknown>>()
  readonly lugares = new LibroDeLugares()
  readonly #reloj: RelojDePared | undefined
  /**
   * EL DADO DEL MUNDO, y vive acá porque no tiene dónde más vivir hoy:
   * `@anima/world` no importa `@anima/oracle` en ninguna línea, así que
   * `WorldState` no tiene el estado del dado. La consecuencia hay que decirla
   * entera y está clavada con su `it.fails` en `tests/el-bucle.test.ts`:
   * **`hashWorldState` no cubre la suerte**, o sea que restaurar un snapshot del
   * mundo sin restaurar este entero reproduce las intenciones y no las tiradas.
   * La reparación es un campo en `WorldState`, y eso es un ADR.
   */
  readonly dado: DadoDelMundo
  #ticks = 0
  #porTiempo = 0
  #porFalla = 0
  readonly #fallas: { tick: number; why: string }[] = []
  /** El instante en que vencía la ventana del último tick. Sólo con reloj de pared. */
  #vence: number | undefined

  constructor(state: WorldState, o: PartidaOptions = {}) {
    this.#state = state
    this.#proy = new Proyeccion(new IndiceDelTick(state))
    this.dado = dadoDelMundo(o.semilla ?? 0)
    this.#reloj = o.reloj
  }

  get state(): WorldState {
    return this.#state
  }

  get proyeccion(): Proyeccion {
    return this.#proy
  }

  get informe(): Informe {
    return {
      ticks: this.#ticks,
      ticksPerdidos: this.#porTiempo + this.#porFalla,
      porTiempo: this.#porTiempo,
      porFalla: this.#porFalla,
      fallas: this.#fallas,
    }
  }

  get ticksPerdidos(): number {
    return this.#porTiempo + this.#porFalla
  }

  vuelo(a: ActorId): Vuelo<unknown> | undefined {
    return this.#vuelos.get(a)
  }

  get vuelos(): readonly Vuelo<unknown>[] {
    return [...this.#vuelos.values()]
  }

  /**
   * Pone una habilidad en vuelo para una criatura.
   *
   * UNA por actor, y no es una limitación de esta clase: `SkillRun` numera sus
   * intenciones desde cero **por corrida**, así que dos habilidades del mismo
   * actor vivas en el mismo tick emiten las dos `seq: 0` y `stepWorld` rechaza a
   * las dos con `orden-duplicado`. Está dicho con todas las letras en
   * `skills/src/ejecutor.ts:#seq`, junto con qué habría que cambiar el día que
   * haga falta. Acá se hace explícito en vez de dejar que el mundo lo descubra.
   */
  volar<A>(a: ActorId, skill: Skill<A>, args: A, o: Omit<VueloOptions, 'by'> = {}): Vuelo<A> {
    const previo = this.#vuelos.get(a)
    if (previo !== undefined && !previo.terminado) {
      throw new Error(
        `${a} ya tiene una habilidad en vuelo: dos corridas del mismo actor emiten el mismo seq y stepWorld rechaza a las dos`,
      )
    }
    const ctx = new Contexto(this.#proy, {
      actor: a,
      rng: this.dado.tirar as WorldRng,
      lugares: this.lugares,
    })
    const v = new Vuelo(skill, ctx, args, { by: a, ...o })
    this.#vuelos.set(a, v as unknown as Vuelo<unknown>)
    return v
  }

  /**
   * UN TICK. Las seis fases, en este orden y no en otro.
   *
   * El orden entre la 1 y la 2 es el del mundo y por la misma razón: «la criatura
   * actúa sobre el mundo que vio, no sobre el que quedó después de que la física
   * se moviera». Y el orden entre la 4 y la 6 es el criterio (d): el `until` de
   * `explore` y la distancia de `goTo` se evalúan con la vista NUEVA.
   */
  tick(): readonly SimEvent[] {
    // 1. lo que cada habilidad le pide al mundo, con la vista de ANTES del paso.
    //    En orden canónico de actor: `#vuelos` se recorre en orden de inserción,
    //    y `stepWorld` reordena igual por `(by, seq)`, así que el orden de acá no
    //    puede mover el hash. Se deja estable de todos modos, porque el orden en
    //    que se AVANZAN los generadores sí es observable desde `ctx.rng`.
    const intents: Intent[] = []
    for (const v of this.#vuelos.values()) {
      const i = v.intencionDelTick()
      if (i !== undefined) intents.push(i)
    }

    // 2. el mundo. Si lanza, el tick está perdido POR FALLA y la partida sigue:
    //    tirar la corrida entera porque un tick se rompió haría que el criterio
    //    del Hito 5 no se pueda ni medir.
    let events: readonly SimEvent[] = []
    try {
      const r = stepWorld(this.#state, intents)
      this.#anterior = this.#state
      this.#state = r.state
      events = r.events
      this.#ticks += 1
    } catch (e) {
      this.#porFalla += 1
      this.#fallas.push({ tick: this.#state.tick, why: e instanceof Error ? e.message : String(e) })
      return []
    }

    // 3. la proyección del tick nuevo. UNA para todas las criaturas: el índice de
    //    celdas se arma a lo sumo una vez por tick, no una por criatura.
    this.#proy = new Proyeccion(new IndiceDelTick(this.#state))

    // 4. EL REFRESCO EN SU LUGAR. Cada `ctx` es el mismo objeto que la habilidad
    //    tiene desde que arrancó; lo que cambia es de dónde cuelgan sus getters.
    for (const v of this.#vuelos.values()) v.ctx.refrescar(this.#proy)

    // 5. lo que la criatura recuerda: la celda donde está parada. Ver `lugares.ts`.
    for (const a of this.#vuelos.keys()) {
      const at = dondeEsta(this.#state, a)
      if (at !== undefined) this.lugares.anotar(this.#proy, a, at)
    }

    // 6. qué le contesta el mundo a cada una, y quién se murió.
    for (const [a, v] of this.#vuelos) {
      if (v.terminado) continue
      if (!this.#state.actors.has(a)) {
        // ADR II-0009: la criatura se quedó sin `stamina` y el actor se fue del
        // mundo. Cortar el vuelo NO es cortesía: sin esto la habilidad seguiría
        // emitiendo intenciones que `stepWorld` rechaza con `actor-desconocido`
        // hasta el fin de los tiempos, y la partida no terminaría nunca.
        v.abortar('se murió de hambre')
        continue
      }
      v.resolver(events, this.#proy)
    }
    return events
  }

  /**
   * Avanza `n` ticks y cuenta los que se perdieron.
   *
   * El reloj de pared se lee DOS veces por tick y sólo acá: antes y después. La
   * lógica del tick no lo ve ni lo puede llamar.
   */
  avanzar(n: number): Informe {
    for (let k = 0; k < n; k++) {
      const reloj = this.#reloj
      if (reloj === undefined) {
        this.tick()
        continue
      }
      const arranque = reloj()
      // La primera ventana se abre cuando arranca el primer tick: antes de eso no
      // había nada que llegara tarde.
      if (this.#vence === undefined) this.#vence = arranque
      this.tick()
      const fin = reloj()
      const ventana = 1000 / this.#state.hz
      this.#vence += ventana
      if (fin > this.#vence) {
        // Cuántas ventanas ENTERAS pasaron de largo. `floor` y no `ceil`: la
        // ventana en la que terminamos todavía es nuestra, y la que se pierde es
        // la siguiente que ya venció cuando fuimos a empezarla.
        const vencidas = Math.floor((fin - this.#vence) / ventana) + 1
        this.#porTiempo += vencidas
        this.#vence += vencidas * ventana
      }
    }
    return this.informe
  }

  /** El estado del tick anterior. Es lo que `rateOf` mira, y lo expone el banco. */
  get anterior(): WorldState | undefined {
    return this.#anterior
  }
}
