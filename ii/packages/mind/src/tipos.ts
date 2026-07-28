// ─── @anima/mind/tipos.ts ────────────────────────────────────────────────────
//
// EL CONTRATO COMPARTIDO de la mente. Cuatro decisiones viven acá:
//
//   1. LOS PRESUPUESTOS DE LA ESCALERA SON ESTRUCTURALES, NO MICROSEGUNDOS. El
//      documento de arquitectura le pone 5 µs a D0, 1 ms a D3 y 8 ms a D4, y esos
//      números son honestos en tiempo de pared — pero medirlos ADENTRO exige
//      `performance.now()`, que la regla 2 prohíbe, y haría que la misma partida
//      decidiera distinto en una máquina cargada. Es exactamente el ADR II-0012,
//      aplicado un piso más arriba: cada peldaño hace una cantidad ACOTADA de
//      trabajo (cuántos candidatos mira, cuántas expansiones pide), y que esa
//      cota entre en su presupuesto lo mide un banco aparte.
//
//   2. NUNCA SE BAJA DEL ÚLTIMO PELDAÑO SIN UNA INTENCIÓN. D5 no puede devolver
//      `undefined`. Una mente que a veces no decide nada es una criatura que a
//      veces se queda tildada, y en 20.000 ticks eso pasa seguro.
//
//   3. LAS CREENCIAS VIVEN AL LADO DEL MUNDO, NO ADENTRO. Es el precedente de
//      `LibroDeLugares` (`@anima/perceive`), que ya guarda los 512 lugares
//      recordados fuera de `WorldState`. La consecuencia hay que decirla: un
//      replay desde el journal reconstruye el mundo y NO las creencias. La
//      criatura revivida se acuerda de dónde estaban las cosas y no de si le
//      rindieron. Queda anotado como hueco.
//
//   4. EL ORDEN DE `opportunities()` ES TOTAL Y ESTABLE. Se ordena por valor, que
//      es un float, y los empates se rompen por un id. Un `sort` por float sin
//      desempate depende del orden de llegada, y el orden de llegada depende del
//      índice del tick: no-determinismo con cara de heurística.

import type { QualityId } from '@anima/physics'
import type { PredicateSignature, Step, VistaDelPlan } from '@anima/plan'
import type { ActorId, BodyView, Clock, SelfView } from '@anima/skills'

// ─── Necesidades ─────────────────────────────────────────────────────────────

/**
 * Cuánto duele cada cosa, en [0, 1]. Cero es «no duele nada».
 *
 * `energia` es la única que hoy tiene un motor real: sale de `stamina`, que la
 * ley del metabolismo drena sola y que sólo comer repone (ADR II-0009). Las otras
 * dos existen porque el mundo ya las puede mover —`temperature` del propio cuerpo
 * y el reloj de día y noche— y porque una escalera con una sola necesidad no es
 * una escalera: D2 y D3 no se distinguirían nunca.
 *
 * NO hay una necesidad `hunger`: no existe esa cualidad en la física, y el
 * `.d.ts` a mano que la prometía ya fue corregido una vez. Lo que duele es la
 * `stamina`.
 */
export interface NeedVector {
  readonly energia: number
  readonly calor: number
  readonly refugio: number
}

// ─── Creencias ───────────────────────────────────────────────────────────────

/**
 * El contexto sobre el que se cree algo. Es una CLAVE, no un objeto: dos
 * situaciones con la misma clave comparten evidencia, y elegir la clave es
 * elegir cuánto generaliza la criatura.
 *
 * Hoy la clave es el bioma más la forma de lo que se ve. Más fina, la criatura no
 * aprende nunca (cada celda es un mundo nuevo); más gruesa, aprende mal.
 */
export type ContextKey = string

/** Una Beta. `a` son los éxitos más el prior, `b` los fracasos más el prior. */
export interface Beta {
  readonly a: number
  readonly b: number
}

/** La media del posterior: `a / (a + b)`. Es una división y nada más. */
export function media(β: Beta): number {
  return β.a / (β.a + β.b)
}

/** Cuánta evidencia PROPIA hay detrás. Los priors valen 2 y no cuentan. */
export function cuantasVeces(β: Beta): number {
  return β.a + β.b - 2
}

export interface AffordanceMemory {
  belief(ctx: ContextKey, rinde: string): Beta
  observe(ctx: ContextKey, rinde: string, ok: boolean): void
  seed(ctx: ContextKey, rinde: string, prior: Beta, por: 'instinto' | 'modelo'): void
  /** Los tags que alguna vez se creyó que rinden acá. Orden estable. */
  tagsDe(ctx: ContextKey): readonly string[]
}

// ─── Oportunidades ───────────────────────────────────────────────────────────

export interface Opportunity {
  /** Qué se querría tener. Es lo que se le pasa a `plan()`. */
  readonly meta: PredicateSignature
  /** `p · satisfaccion / costo`. Ordena, y nada más: no es una probabilidad. */
  readonly valor: number
  /** Para el desempate y para el «por qué». Único dentro de un tick. */
  readonly id: string
  /** Legible: «creo que el río rinde carnoso (p=0,50, n=3)». */
  readonly porque: string
}

// ─── La escalera ─────────────────────────────────────────────────────────────

export type Peldano = 'D0' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5'

/**
 * LAS CONDUCTAS QUE EL PLANIFICADOR NO EMITE, Y LA ESCALERA SÍ.
 *
 * `@anima/plan` dice, en el encabezado de su `Step`, que de las quince innatas
 * su vocabulario cubre diez, y que de las cinco que faltan cuatro «son conducta
 * y no plan — **las emite la escalera de decisión**, no la regresión».
 *
 * Y el andamio de este archivo escribía `Decision.volar.paso: Step`, o sea que
 * la escalera no podía emitir ninguna de las cuatro: **D0 no podía huir y D5 no
 * podía guarecerse**, que son justo las dos conductas que el documento de
 * arquitectura les pone en la fila. Por eso `paso` es `Intencion` y no `Step`.
 *
 * Son DOS y no cuatro porque son las dos que la escalera de hoy usa. `esperar` y
 * `seguirOrdenDeMovimiento` entran el día que haya un peldaño que las pida —el
 * segundo es del Hito 6, cuando el chat mande a caminar— y entran acá, no en un
 * tercer tipo paralelo.
 *
 * NO LLEVAN PARÁMETROS, y es deliberado: `huirDelDolor` y `guarecerse` traen sus
 * radios y sus umbrales por omisión, medidos y comentados en su propio archivo.
 * Repetirlos acá sería cablear dos veces el mismo número, que es exactamente el
 * modo de falla que la escalera evita leyendo `CONTRATO_HUIR_DEL_DOLOR` en vez
 * de escribir un 60.
 *
 * Las dos `k` son ajenas a las diez de `Step`, así que `Intencion` sigue siendo
 * una unión discriminada por `k` y un `switch` exhaustivo la cubre entera.
 */
export type Conducta =
  | { readonly k: 'huir'; readonly porQue: string }
  | { readonly k: 'guarecerse'; readonly porQue: string }

/** Lo que la escalera le puede entregar al ejecutor: un paso de plan o una conducta. */
export type Intencion = Step | Conducta

/**
 * Lo que la mente decide en un tick.
 *
 * `seguir` es la respuesta de D1 y es la más común —el documento estima ~60% de
 * los ticks—: la habilidad en vuelo sigue siendo válida y no hay nada que hacer.
 * Que sea una variante explícita y no un `undefined` es lo que permite contar
 * cuántas veces se subió a cada peldaño, que es lo que el banco mide.
 *
 * ─── QUÉ TIENE QUE HACER QUIEN EJECUTA, con cada una ────────────────────────
 *
 *   `seguir`   nada. La habilidad en vuelo sigue.
 *   `volar`    **cortar lo que esté volando** y poner `paso`.
 *   `plan`     lo mismo con `pasos[0]`; del resto ya se acordó la escalera.
 *   `abortar`  cortar y no poner nada.
 *
 * El corte es parte de `volar` y no una decisión aparte porque `Partida.volar`
 * LANZA si el actor ya tiene algo en vuelo —dos corridas del mismo actor emiten
 * el mismo `seq` y `stepWorld` rechaza a las dos—, o sea que quien ejecuta tiene
 * que abortar antes de todos modos. Si el corte fuera una `Decision` propia, un
 * reflejo costaría dos ticks: uno para cortar y otro para huir.
 */
export type Decision =
  | { readonly k: 'seguir'; readonly por: Peldano; readonly porque: string }
  | { readonly k: 'volar'; readonly por: Peldano; readonly paso: Intencion; readonly porque: string }
  | {
      readonly k: 'plan'
      readonly por: Peldano
      readonly pasos: readonly Step[]
      readonly meta: PredicateSignature
      readonly porque: string
    }
  | { readonly k: 'abortar'; readonly por: Peldano; readonly porque: string }

/** El drive que el chat asigna. Hasta el Hito 6 lo pone un test. */
export interface Drive {
  readonly meta: PredicateSignature
  /** Cuánto vale contra lo que la criatura elegiría sola, en [0, 1]. */
  readonly peso: number
  readonly desdeTick: number
}

export interface MenteOptions {
  readonly actor: ActorId
  readonly memoria?: AffordanceMemory
  /** El drive del cuidador, si hay. */
  readonly drive?: Drive
  /**
   * Cuántos nodos expande D4 por tick. Por omisión, `EXPANSIONES_POR_TICK`.
   *
   * Existe por el mismo motivo que `OpcionesDePlan` en `@anima/plan`: **una
   * escalera que sólo sabe leer la constante del módulo no se puede interrogar
   * sobre su propio corte**. El camino anytime —guardar la frontera, seguir el
   * tick que viene, terminar con el mismo plan— no se puede probar con un
   * presupuesto que le entra de sobra a todo, y a la pesca le entran seis
   * expansiones en sesenta y cuatro.
   */
  readonly presupuesto?: number
  /**
   * La costura de D3, inyectable. El default es `opportunities` de verdad.
   *
   * Está para poder probar LA HISTÉRESIS y no la tabla de afordancias: el
   * requisito es «dos metas con valores que se cruzan de a poco», y armar ese
   * cruce moviendo cuerpos por el mapa probaría el costo, la creencia y la
   * satisfacción a la vez — y rompería por las tres.
   */
  readonly oportunidades?: (
    v: VistaDeLaMente,
    m: AffordanceMemory,
    n: NeedVector,
  ) => readonly Opportunity[]
}

// ─── Los números de la escalera ──────────────────────────────────────────────

/**
 * D2 no cambia de idea por una diferencia chica ni antes de 8 ticks. Los dos
 * números son del documento de arquitectura y son ANTI-OSCILACIÓN: sin ellos, dos
 * oportunidades casi empatadas se alternan cada tick y la criatura tiembla en el
 * lugar sin avanzar en ninguna de las dos.
 */
export const MARGEN_DE_HISTERESIS = 0.15
export const PERMANENCIA_EN_TICKS = 8

/**
 * Cuántas oportunidades mira D3 antes de cortar. Es la cota estructural que
 * reemplaza al «1 ms» del documento (ver decisión 1 del encabezado).
 */
export const OPORTUNIDADES_QUE_MIRA = 12

/** Lo que la mente ve. Es el mismo subconjunto que el planificador, más nada. */
export type VistaDeLaMente = VistaDelPlan

export type { BodyView, Clock, SelfView, QualityId }
