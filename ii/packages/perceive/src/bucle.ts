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
//
//      ─── CÓMO SE LLEVA LA CUENTA, y por qué NO es un vencimiento que marcha ──
//
//      La primera versión llevaba un instante de vencimiento y le sumaba UNA
//      ventana por tick pase lo que pase, sin volver a anclarlo cuando el tick
//      terminaba antes. O sea que un bucle que corre más rápido que el tiempo real
//      —que es todo bucle sin `sleep`, o sea todos los de este repositorio—
//      **acumulaba crédito sin tope**: a 20 Hz, cada tick que tarda 1 ms en vez de
//      50 guardaba 49 ms de holgura, y sobre los 2000 ticks del criterio del Hito
//      5 eso eran 98 SEGUNDOS de colchón. El adversario del tramo lo midió con el
//      MISMO tick de 1000 ms puesto en dos lugares de la misma corrida: 20 al
//      principio y 0 en el tick 101. **Un contador cuyo valor depende de lo bien
//      que veníamos no mide nada**, y el `ticksPerdidos === 0` del criterio no
//      distinguía «llegamos a horario» de «nunca llegamos a estar en deuda».
//
//      Lo que hay ahora es el acumulador de un motor de paso fijo, con la única
//      línea que lo hace honesto: **el atraso se satura en cero**. Cada tick suma
//      `(cuánto pasó de reloj) − (una ventana)` y si el resultado es negativo se
//      lo lleva a cero, porque adelantarse no es un crédito que se pueda gastar
//      después: el mundo no puede correr dos ticks de física en un cuadro. Cada
//      ventana entera de atraso acumulada es un tick perdido y se descuenta.
//
//      Las dos consecuencias, dichas:
//
//        · **el mismo tick lento cuenta lo mismo esté donde esté**, que es lo que
//          el contador tenía que cumplir para significar algo;
//        · lo que se mide es de un `fin` al `fin` anterior —no `fin − arranque`—
//          o sea que el tiempo que el llamador pasa ENTRE ticks también cuenta. Es
//          correcto por la definición de arriba: la ventana pasa igual, la esté
//          gastando el tick o quien lo llama.
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

import type { ActorId, Intent, SimEvent, Violacion, WorldBody, WorldState } from '@anima/world'
import {
  dadoDe,
  describir,
  mapaDeCuerpos,
  PREFIJO_POZO,
  PREFIJO_SUELTA,
  revisarEstado,
  stepWorld,
} from '@anima/world'
import type { Skill } from '@anima/skills'
import { hashTrace } from '@anima/skills'
import type { WorldRng } from '@anima/oracle'
import { dadoDelMundo, type DadoDelMundo } from '@anima/oracle'

import { Contexto } from './contexto.js'
import { IndiceDelTick } from './indice.js'
import { LibroDeLugares, dondeEsta } from './lugares.js'
import type { VueloAnotado } from './reejecucion.js'
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
  /**
   * El estado del dado de la mente **para los mundos SIN dios**, y nada más.
   *
   * Con dios, el dado que la habilidad ve es el del mundo (`state.dios.dado`) y
   * esta opción se ignora: ver `Partida.dado`. Se ignora en silencio a propósito
   * —lanzar rompería a todo el que arma una `Partida` con semilla por costumbre—
   * pero queda dicho acá porque es la clase de opción que uno cree que manda.
   */
  readonly semilla?: number
  readonly reloj?: RelojDePared
  /**
   * ENCENDER EL ARNÉS DE INVARIANTES SOBRE CADA TICK.
   *
   * ─── Por qué existe esta opción, dicho con el número ────────────────────────
   *
   * `grep exigirInvariantes ii/` devolvía DOS archivos: el que lo define y su
   * propio test. **Ninguna corrida real de `ii/` lo llamaba** — ni la del criterio
   * del Hito 5, ni el juez de la emergencia, ni el banco. El encabezado de
   * `world/src/invariants.ts` dice que un invariante por tick «es lo único que
   * convierte "el modelo escribe comportamiento" en algo que se puede sostener», y
   * estaba apagado de hecho. Medido por el adversario: el actor sin cuerpo que
   * dejaba `eat` sobre uno mismo producía `inventario-inconsistente` en los 500
   * ticks siguientes, uno por tick, y nadie lo escuchaba.
   *
   * ─── Por qué `revisarEstado` y no `revisarInvariantes` ─────────────────────
   *
   * Son las cinco preguntas que un estado puede contestar SOLO —orden, espacio,
   * referencias, inventarios y rangos de cualidad—. La sexta, la conservación,
   * necesita comparar con el estado anterior y **todavía no se puede encender en
   * una partida CON DIOS**, pero por mucho menos que antes.
   *
   * Antes eran TRES los caminos por los que el dios materializaba materia sin
   * emitir un evento que el guardián supiera leer: abrir un chunk, extraer del
   * banco, y reponer el stock. El evento `decreta` de `world/src/step.ts` cerró el
   * primero y el tercero —medido: 96 y 21 violaciones en 400 ticks pasaron a 0 y
   * 0—. Queda el segundo, y **ya no es un problema de declaración**: lo que sale
   * del banco no tiene la misma nutrición por kilo que el banco (la masa cuadra al
   * bit), así que el aumento es real y taparlo con un `decreta` sería mentir.
   * Acusa una vez por pesca, y la partida del criterio pesca. El `it.fails` con la
   * medición nueva está en `tests/ataque-a-la-costura.test.ts` y pide un ADR de
   * modelo, no de crónica.
   *
   * `revisarEstado` no depende de la conservación, así que ese bloqueante no la
   * alcanza — y habría cazado igual el fantasma.
   *
   * ─── Por qué NO viene encendida por omisión ────────────────────────────────
   *
   * Cuesta O(cuerpos + celdas) por tick, y el criterio (3) del Hito 5 —el p99 del
   * tick con 5000 cuerpos— ya está 6,2× por encima de su techo y aceptado así.
   * Encenderla de fábrica sería empeorar en silencio el criterio que peor anda.
   * Va encendida donde el costo es irrelevante y el valor es máximo: las corridas
   * de criterio y las del juez, que tienen ~130 cuerpos.
   */
  readonly vigilar?: boolean
  /**
   * ANOTAR CADA VUELO QUE ATERRIZA, con el hash de su traza. Hito 10, puntos 2 y 3.
   *
   * Apagada por omisión y barata cuando está encendida: un `hashTrace` por vuelo
   * TERMINADO, no por tick. La corrida del criterio del Hito 5 son 20.000 ticks y
   * unos cientos de vuelos.
   *
   * Lo que compra está medido en el criterio del Hito 10 (M2): el replay del
   * journal replaya INTENCIONES, así que una habilidad con una fuente de
   * no-determinismo adentro lo pasa sin despeinarse porque nunca corre. Esto es
   * lo único que mira lo que la habilidad HIZO, y ve una clase de divergencia
   * que el hash del mundo no puede ver: una fase no toca ningún cuerpo.
   */
  readonly anotarVuelos?: boolean
}

/** El informe de una corrida. Todo número que el criterio del Hito 5 nombra sale de acá. */
export interface Informe {
  readonly ticks: number
  readonly ticksPerdidos: number
  readonly porTiempo: number
  readonly porFalla: number
  /** Los errores que `stepWorld` lanzó, con el tick en que pasó. */
  readonly fallas: readonly { readonly tick: number; readonly why: string }[]
  /**
   * Los estados ilegales que el arnés vio, con el tick en que aparecieron. Vacío
   * cuando `vigilar` no está puesta — y eso NO quiere decir «no hubo», quiere
   * decir «no se miró». Los dos ceros se distinguen con `vigilada`.
   */
  readonly violaciones: readonly { readonly tick: number; readonly v: Violacion }[]
  /** ¿Se corrió el arnés? Sin esto, `violaciones: []` sería un cero ambiguo. */
  readonly vigilada: boolean
}

/**
 * EL MUNDO DEL TICK 0, CON LO QUE EL DIOS PONE YA PUESTO.
 *
 * ─── El agujero, dicho entero ───────────────────────────────────────────────
 *
 * Quien materializa lo que el dios decretó —los bancos de peces— es
 * `materializarPozos`, y corre ADENTRO de `stepWorld`. La `Partida` construía su
 * proyección en el constructor, sobre el `WorldState` crudo del tick 0, donde el
 * banco todavía NO EXISTE; y `Vuelo.intencionDelTick()` avanza el generador ANTES
 * del primer `stepWorld`, que es el orden correcto para todo lo demás («la
 * criatura actúa sobre el mundo que vio»). Resultado medido sobre la orilla de la
 * semilla 20260727n:
 *
 *   paso 1 de la habilidad veía: ana-cuerpo, cana
 *   paso 2 veía:                 ana-cuerpo, cana, pozo:-6:-6
 *
 * DOCE de las quince innatas arrancan con un `see()` —o con un `goTo` derivado de
 * un `see()`— en la primera línea del generador. Una criatura que abría los ojos
 * en la orilla no veía el banco de peces y se rendía con «no veo el pozo» sin que
 * nada fallara: el criterio del Hito 5 dependía de que la habilidad tuviera un
 * `yield` de más al principio.
 *
 * ─── Por qué se materializa con `stepWorld` y no con `decretoDe` ────────────
 *
 * Reconstruir el banco acá —`decretoDe` + `population` + `cuerpoDePozo`, que están
 * los tres exportados— sería copiar una ley del mundo a la capa de percepción, que
 * es exactamente lo que este repositorio castiga (`DSL_REFERENCE` de Ánima I): la
 * copia se llevaría el anillo de nueve chunks alrededor de cada actor, y el día
 * que el mundo cambie a dónde llega el dios, la vista y el mundo dirían cosas
 * distintas sin que nada se ponga rojo.
 *
 * Así que se le pregunta AL MUNDO: se da un paso **en sombra** —`stepWorld` con
 * cero intenciones, sobre una copia que se tira— y se le sacan ÚNICAMENTE los
 * cuerpos del dios que no estaban. No se copia ninguna ley, y lo que se ve es por
 * construcción lo que el mundo va a materializar un instante después.
 *
 * Lo incómodo, y hay que decirlo:
 *
 *   · **cuesta un `stepWorld` entero**, una vez por partida y sólo si hay dios. Un
 *     mundo sin dios —el banco de 5000 cuerpos, el mundito, los ocho archivos de
 *     test del paquete— sale por la primera línea sin pagar nada;
 *   · los cuerpos que se traen pasaron por las leyes de ese paso de sombra, o sea
 *     que sus cualidades son las del tick 1 y no las del 0. Para un banco de peces
 *     quieto en el agua eso no mueve la masa, que es lo único que `see()` filtra y
 *     lo único que el rol `source` de `extraccion` mira. Lo que NO cambia es el
 *     mundo de verdad: `#state` sigue siendo el que entró, el paso de sombra se
 *     tira, y el `stepWorld` del primer tick vuelve a materializar el banco desde
 *     el decreto como si nada hubiera pasado.
 *
 * La alternativa limpia es que el mundo separe «materializar» de «dar un paso»
 * —una `materializarWorld(state)` exportada por `world/src/step.ts`— y entonces
 * esto son dos líneas sin paso de sombra. Queda anotado como hueco.
 */
function conLoQueElDiosPone(state: WorldState): WorldState {
  if (state.dios === undefined) return state
  let sombra: WorldState
  try {
    sombra = stepWorld(state, []).state
  } catch {
    // Un mundo que no puede dar un paso tampoco puede materializar nada, y el
    // tick 1 lo va a contar como `porFalla`. Que la proyección explote acá sería
    // cambiarle el modo de falla a la partida entera.
    return state
  }
  let nuevos: WorldBody[] | undefined
  for (const [id, c] of sombra.bodies) {
    // LOS DOS PREFIJOS DEL DIOS, y el segundo llegó tarde y a propósito: el mundo
    // pasó a materializar también las `sueltas` del decreto —la leña, la corteza,
    // el junco— y con la lista vieja el paso 1 veía el banco de peces en un
    // desierto. Medido en `tests/ataque-a-la-costura.test.ts`, bloque 2: el paso 1
    // traía 3 cuerpos y el paso 2 traía 17.
    //
    // El filtro es por PREFIJO y no «todo lo que el paso de sombra agregó» porque
    // el paso de sombra también hace correr las leyes, y un cuerpo que nació de la
    // ley 4 en el tick de sombra no es una cosa que el dios puso: es una cosa que
    // pasó en un mundo que se va a tirar.
    if (!id.startsWith(PREFIJO_POZO) && !id.startsWith(PREFIJO_SUELTA)) continue
    if (state.bodies.has(id)) continue
    if (nuevos === undefined) nuevos = [...state.bodies.values()]
    nuevos.push(c)
  }
  if (nuevos === undefined) return state
  // Por `mapaDeCuerpos` y no por `new Map`: el orden del mapa de cuerpos es
  // canónico y `see()` promete el mismo orden en dos corridas gemelas.
  return { ...state, bodies: mapaDeCuerpos(nuevos) }
}

export class Partida {
  #state: WorldState
  #anterior: WorldState | undefined
  #proy: Proyeccion
  readonly #vuelos = new Map<ActorId, Vuelo<unknown>>()
  readonly lugares = new LibroDeLugares()
  readonly #reloj: RelojDePared | undefined
  /**
   * EL DADO QUE VE LA HABILIDAD POR `ctx.rng`, y **es el del mundo cuando hay
   * dios**.
   *
   * ─── Eran DOS, y era un agujero de guardado ────────────────────────────────
   *
   * La versión anterior construía uno propio (`dadoDelMundo(o.semilla ?? 0)`) que
   * no vivía en ningún lado del estado. El mundo tiene el suyo adentro de
   * `WorldState.dios`, y ése sí entra en `hashWorldState` y sí sobrevive a
   * `JSON.stringify` (medido en `tests/ataque-a-la-costura.test.ts`, bloque 4).
   * Medido después de pescar: dado del mundo `1831565813`, dado de la `Partida`
   * todavía en el `7` que le pasaron. Consecuencia: **guardar y cargar a mitad de
   * partida le reiniciaba la suerte a la mente**. Hoy no se nota porque ninguna de
   * las quince innatas usa `ctx.rng`; se nota el día que una elija a dónde caminar
   * tirando el dado, que es la primera cosa que va a hacer una mente sin LLM.
   *
   * Así que hay UNA ranura y no dos: `#tirar` lee `state.dios.dado`, lo hace
   * avanzar y lo escribe de vuelta en el estado, que es la ranura que el snapshot
   * ya guarda. La mente y el mundo comparten la sucesión — el orden es el del
   * tick, primero las mentes (fase 1) y después `stepWorld`— y la consecuencia hay
   * que decirla: **una habilidad que tira el dado le corre la suerte al mundo**.
   * Es lo correcto: son la misma partida y el mismo azar, y lo contrario es
   * exactamente el estado paralelo que se acaba de sacar.
   *
   * Y el hueco que queda: **un mundo SIN dios no tiene dónde guardar el entero**,
   * así que ahí se cae al dado propio de `o.semilla` y el agujero sigue abierto tal
   * cual — con su `it.fails` en `tests/el-bucle.test.ts`, medido sobre un mundo sin
   * dios que es justo el caso donde el hash del mundo no puede distinguirlos.
   */
  readonly dado: DadoDelMundo
  /** El dado de los mundos sin dios. Ver `dado`: ahí no hay ranura donde guardarlo. */
  readonly #propio: DadoDelMundo
  #ticks = 0
  #porTiempo = 0
  #porFalla = 0
  readonly #fallas: { tick: number; why: string }[] = []
  /** Ver `PartidaOptions.vigilar`. Apagada por omisión, y el informe lo dice. */
  readonly #vigilar: boolean
  readonly #violaciones: { tick: number; v: Violacion }[] = []
  /** Ver `PartidaOptions.anotarVuelos`. */
  readonly #anotarVuelos: boolean
  readonly #anotados: VueloAnotado[] = []
  /**
   * Los vuelos que ya se anotaron, por identidad del objeto.
   *
   * Es un `WeakSet` y no una bandera adentro de `Vuelo` porque anotar es asunto
   * de la partida y no del vuelo: un `Vuelo` volado a mano, fuera de una
   * `Partida`, no tiene por qué cargar con un campo que nadie le escribe. Y por
   * identidad y no por `(tick, actor)` porque un actor puede aterrizar dos
   * vuelos distintos en el mismo tick — el segundo despega en el mismo tick en
   * que el primero terminó (decisión 3 de la escalera).
   */
  readonly #yaAnotados = new WeakSet<object>()
  /** El instante en que terminó el tick anterior. Sólo con reloj de pared. */
  #ultimoFin: number | undefined
  /** Cuánto tiempo de pared se debe, en milisegundos. Saturado en cero: ver el encabezado. */
  #atraso = 0

  constructor(state: WorldState, o: PartidaOptions = {}) {
    this.#state = state
    // La proyección del tick 0 se arma sobre el mundo CON lo que el dios pone, y
    // `#state` sigue crudo: ver `conLoQueElDiosPone`.
    this.#proy = new Proyeccion(new IndiceDelTick(conLoQueElDiosPone(state)))
    this.#propio = dadoDelMundo(o.semilla ?? 0)
    // Un objeto estable con dos clausuras: `volar` le entrega `tirar` a la
    // habilidad UNA vez, en el constructor del `Contexto`, así que la función no
    // puede cambiar de identidad cuando el estado se reemplaza tick a tick.
    this.dado = {
      tirar: (() => this.#tirar()) as WorldRng,
      estado: () => this.#estadoDelDado(),
    }
    this.#reloj = o.reloj
    this.#vigilar = o.vigilar ?? false
    this.#anotarVuelos = o.anotarVuelos ?? false
    // El tick 0 también se mira: un mundo que ENTRA roto no lo rompió ningún tick,
    // y descubrirlo en el tick 1 haría culpar al paso equivocado.
    if (this.#vigilar) this.#anotarViolaciones(this.#state)
  }

  /**
   * Las cinco preguntas sobre el estado que salió del paso. No lanza: junta.
   *
   * Lanzar cortaría la corrida en el primer estado ilegal, y lo que hace falta es
   * lo contrario — llegar hasta el final con la lista entera, porque un invariante
   * roto suele romper el siguiente y saber cuántos y desde qué tick es la mitad
   * del diagnóstico. Quien quiera el corte duro tiene `exigirInvariantes` en
   * `@anima/world`, que es exactamente eso.
   */
  #anotarViolaciones(s: WorldState): void {
    const v = revisarEstado(s)
    for (const x of v) this.#violaciones.push({ tick: s.tick, v: x })
  }

  #estadoDelDado(): number {
    const d = this.#state.dios
    return d === undefined ? this.#propio.estado() : d.dado
  }

  /**
   * Una tirada, con el estado escrito de vuelta EN EL MUNDO.
   *
   * Se reemplaza `#state` en el acto y no al final del tick: la fase 1 del tick
   * pasa por acá antes de `stepWorld`, y si la escritura esperara, el paso del
   * mundo arrancaría desde el dado viejo y las dos sucesiones se pisarían.
   */
  #tirar(): number {
    const s = this.#state
    const dios = s.dios
    if (dios === undefined) return this.#propio.tirar()
    const d = dadoDe(dios)
    const v = d.tirar()
    this.#state = { ...s, dios: { ...dios, dado: d.estado() } }
    return v
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
      violaciones: this.#violaciones,
      vigilada: this.#vigilar,
    }
  }

  /**
   * Lo que el arnés vio, ya escrito para leer. Vacío si `vigilar` está apagada.
   *
   * Sale `describir` de `@anima/world` y no un `JSON.stringify`: la frase que
   * arma es la que ya usa `InvariantError`, así que un estado ilegal se lee igual
   * lo haya cazado el corte duro o esta lista.
   */
  get violaciones(): readonly string[] {
    return this.#violaciones.map((x) => `tick ${String(x.tick)}: ${describir(x.v)}`)
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
      rng: this.dado.tirar,
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

    // 2b. EL ARNÉS, cuando está encendido. Va acá y no al final del tick porque lo
    //     que se juzga es el estado que produjo `stepWorld`: las fases 3 a 6 no
    //     tocan el mundo, sólo lo miran. Ver `PartidaOptions.vigilar`.
    if (this.#vigilar) this.#anotarViolaciones(this.#state)

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

    // 7. ANOTAR LO QUE ATERRIZÓ. Va al final del tick y no adentro del bucle de
    //    arriba, porque un vuelo puede terminar en la fase 6 (`resolver`) o
    //    haberse abortado antes; mirar el estado final es el único lugar donde
    //    los dos caminos ya pasaron. Ver `PartidaOptions.anotarVuelos`.
    if (this.#anotarVuelos) this.#anotarLosQueAterrizaron()
    return events
  }

  /**
   * Los vuelos terminados que todavía no se anotaron, en orden canónico de actor.
   *
   * El orden importa y es el de `#vuelos`, que es orden de inserción — el mismo
   * que la fase 1 usa para juntar intenciones. Dos corridas del mismo mundo
   * insertan en el mismo orden, así que la lista de anotados es comparable
   * posición por posición, que es lo que `compararVuelos` necesita.
   */
  #anotarLosQueAterrizaron(): void {
    for (const [a, v] of this.#vuelos) {
      if (!v.terminado || this.#yaAnotados.has(v)) continue
      this.#yaAnotados.add(v)
      this.#anotados.push({
        tick: this.#state.tick,
        actor: a,
        nombre: v.nombre,
        traza: hashTrace(v.run.trace),
        pasos: v.run.steps,
        ok: v.outcome?.ok ?? false,
      })
    }
  }

  /**
   * QUÉ VOLÓ Y QUÉ DEJÓ CADA VUELO, para comparar dos corridas.
   *
   * Vacío cuando `anotarVuelos` no está puesta, y eso NO quiere decir «no voló
   * nada»: quiere decir «no se miró». Es el mismo cero ambiguo que `violaciones`
   * resuelve con `vigilada`, y acá se resuelve igual con `anotandoVuelos`.
   */
  get vuelosAnotados(): readonly VueloAnotado[] {
    return this.#anotados
  }

  /** ¿Se estuvo anotando? Sin esto, `vuelosAnotados: []` sería un cero ambiguo. */
  get anotandoVuelos(): boolean {
    return this.#anotarVuelos
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
      if (this.#ultimoFin === undefined) this.#ultimoFin = arranque
      this.tick()
      const fin = reloj()
      const ventana = 1000 / this.#state.hz
      // Lo que pasó de reloj desde que terminó el tick anterior, menos lo que
      // teníamos presupuestado. Ver el encabezado: la SATURACIÓN EN CERO es la
      // línea entera de la reparación —adelantarse no es crédito— y sin ella el
      // contador dependía de lo bien que veníamos en vez de lo tarde que llegamos.
      this.#atraso += fin - this.#ultimoFin - ventana
      this.#ultimoFin = fin
      if (this.#atraso < 0) this.#atraso = 0
      // Cada ventana ENTERA de atraso es un tick que nadie va a correr. Lo que
      // sobra queda debiéndose: dos ticks de media ventana tarde son uno perdido,
      // que es lo mismo que dice la definición de arriba.
      const vencidas = Math.floor(this.#atraso / ventana)
      if (vencidas > 0) {
        this.#porTiempo += vencidas
        this.#atraso -= vencidas * ventana
      }
    }
    return this.informe
  }

  /** El estado del tick anterior. Es lo que `rateOf` mira, y lo expone el banco. */
  get anterior(): WorldState | undefined {
    return this.#anterior
  }
}
