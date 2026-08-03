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
import type { PlannerCatalogView, PredicateSignature, Ref, Step, VistaDelPlan } from '@anima/plan'
import type { ActorId, BodyId, BodyView, Clock, SelfView } from '@anima/skills'

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

/**
 * UN BOCADO YA PRECIADO: el cuerpo, lo que deja, y con cuánto veneno se banca.
 *
 * Es lo que convierte una oportunidad en un ACTO en vez de en una meta. Ver el
 * encabezado de `oportunidades.ts`, sección «tener comida no es la meta».
 */
export interface Bocado {
  /** Qué cuerpo se traga. Viaja como `Ref` recién cuando la escalera lo emite. */
  readonly id: BodyId
  /**
   * Cuánta `stamina` deja NETA: lo acreditado (topado por lo que todavía entra
   * en el tanque) menos lo que el veneno cobra. Siempre `> 0` — un bocado que no
   * deja nada no es una oportunidad, es un error.
   */
  readonly neto: number
  /**
   * Hasta cuánta `toxicity` se banca ESTE bocado, calculado y no heredado.
   *
   * Es lo que va a `comer(ctx, { toxicidadTolerada })`, y sale de la misma
   * desigualdad que `neto`: el `0,2` por omisión de la innata es una constante, y
   * una constante no sabe que a la criatura llena el veneno le sale igual de caro
   * y la comida le rinde menos.
   */
  readonly toxicidadTolerada: number
}

export interface Opportunity {
  /** Qué se querría tener. Es lo que se le pasa a `plan()`. */
  readonly meta: PredicateSignature
  /** `p · satisfaccion / costo`. Ordena, y nada más: no es una probabilidad. */
  readonly valor: number
  /** Para el desempate y para el «por qué». Único dentro de un tick. */
  readonly id: string
  /** Legible: «creo que el río rinde carnoso (p=0,50, n=3)». */
  readonly porque: string
  /**
   * Si esta oportunidad se cierra de un mordisco y no de un plan, cuál.
   *
   * Presente ⇒ `meta` NO se le pasa a `plan()`: es la firma de lo que `comer`
   * promete en su contrato, y está para que la lista se pueda leer y comparar,
   * no para que la busque nadie. Ver `losBocados` en `oportunidades.ts`.
   */
  readonly bocado?: Bocado
  /**
   * DE DÓNDE SALIÓ ESTA APUESTA: el casillero de creencias que la sostiene.
   *
   * ─── POR QUÉ ESTE CAMPO EXISTE, y no es una comodidad ───────────────────────
   *
   * Porque sin él **la mente nunca le devolvía evidencia a las creencias**. El
   * hueco estuvo escrito y medido desde el Hito 5, con su `it.fails`:
   *
   *   > `AffordanceMemory.observe(ctx, rinde, ok)` existe y esta mente no lo
   *   > llama nunca, porque **no sabe con qué llamarlo** […] MEDIDO: la corrida
   *   > saca doce pescados del mismo banco y `cuantasVeces` sigue dando 0.
   *
   * Una criatura que pescaba doce veces informaba la misma confianza que antes de
   * pescar por primera vez. Aprender era imposible por falta de un dato, no por
   * falta de un mecanismo: `observe` estaba escrito desde el principio.
   *
   * El dato es éste. `opportunities()` YA tiene las dos mitades cuando arma la
   * fila —llama a `m.belief(ctx, tag)` para calcular la `p`— así que acá no se
   * calcula nada nuevo: se deja de tirar lo que ya estaba en la mano.
   *
   * Opcional porque los bocados no salen de un casillero: `losBocados` mira lo
   * que hay en la mano y no apuesta a nada.
   */
  readonly deDonde?: { readonly ctx: ContextKey; readonly rinde: string }
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
 * LAS DOS PRIMERAS NO LLEVAN PARÁMETROS, y es deliberado: `huirDelDolor` y
 * `guarecerse` traen sus radios y sus umbrales por omisión, medidos y comentados
 * en su propio archivo. Repetirlos acá sería cablear dos veces el mismo número,
 * que es exactamente el modo de falla que la escalera evita leyendo
 * `CONTRATO_HUIR_DEL_DOLOR` en vez de escribir un 60.
 *
 * ─── Y LA TERCERA SÍ, QUE ES TODO EL PUNTO: `tragar` ────────────────────────
 *
 * `Step` YA tiene un `comer` —`{ k:'comer', bocado?: Ref, porQue }`— y esta
 * conducta no lo reemplaza: lo completa. La diferencia es UN número, y es el
 * número entero del ADR II-0013:
 *
 *   `comer(ctx, args)` acepta `toxicidadTolerada`, y sin él se autoimpone 0,2.
 *   `Step.comer` no tiene dónde llevarlo, porque `Step` es el vocabulario de
 *   `@anima/plan` y esta mente no lo escribe.
 *
 * O sea que un plan que diga «comé» come con la prudencia de fábrica, y esa
 * prudencia es una CONSTANTE: no sabe que a la criatura llena el veneno le sale
 * igual de caro mientras la comida le rinde menos, ni que a la flaca le conviene
 * bancarse más. La mente sí lo sabe, porque lee `calories`, `mass` y `toxicity`
 * del bocado y el tanque de su propio cuerpo. Así que emite `tragar` con el
 * número que le dio la cuenta.
 *
 * QUEDA DICHO COMO HUECO, porque la reparación no es de este paquete: el día que
 * `Step.comer` sepa llevar una tolerancia, `tragar` se borra y la mente emite un
 * `Step` como todo el mundo. Mientras tanto son dos `k` distintas a propósito
 * —`comer` y `tragar` colisionarían en el `switch` exhaustivo si compartieran
 * la etiqueta—, y no una sola con un campo opcional que el planificador no
 * llenaría nunca.
 *
 * Las tres `k` son ajenas a las diez de `Step`, así que `Intencion` sigue siendo
 * una unión discriminada por `k` y un `switch` exhaustivo la cubre entera.
 */
export type Conducta =
  | { readonly k: 'huir'; readonly porQue: string }
  | { readonly k: 'guarecerse'; readonly porQue: string }
  | {
      readonly k: 'tragar'
      /** Cuál. NUNCA se deja elegir a la innata: la cuenta se hizo sobre ÉSTE. */
      readonly bocado: Ref
      readonly toxicidadTolerada: number
      readonly porQue: string
    }

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
  /**
   * CUÁL, cuando el cuidador señaló uno. Viaja tal cual a `GoalNode.sobre`.
   *
   * Es el canal que faltaba y que este archivo declaraba faltando: `meta` es una
   * firma de texto, o sea EXISTENCIAL —«algo que…»— así que «traé el otro
   * tronco» y «traé un tronco» llegaban acá idénticos y el planificador elegía
   * el más cercano. La corrección del cuidador se perdía entre la lectura y el
   * plan.
   *
   * Es una preferencia y no un filtro: si el señalado ya no está, el plan sigue
   * con el que sirva. Ver `GoalNode.sobre`.
   */
  readonly sobre?: BodyId
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
    ganchos?: unknown,
    catalogo?: PlannerCatalogView,
  ) => readonly Opportunity[]
  /**
   * EL CATÁLOGO DE ESTA PARTIDA: core inmutable más el overlay de la sesión.
   *
   * Por omisión, `CATALOGO_CORE` — que es lo que la criatura sabe hacer de
   * fábrica y es exactamente lo que la mente usaba antes, así que el default no
   * cambia ninguna conducta.
   *
   * Va acá y no en `VistaDeLaMente` a propósito: la vista es lo que la criatura
   * **ve** y el catálogo es lo que **sabe hacer**. `MenteOptions` ya es la bolsa
   * de lo segundo —lleva `memoria`, que es lo aprendido— y mezclarlo con la
   * percepción haría que un test de paisaje tuviera que hablar del catálogo.
   */
  readonly catalogo?: PlannerCatalogView
  /**
   * LA COSTURA CON LA FRAGUA: a quién se le avisa cuando el plan no llega.
   *
   * Ver `PedidoALaFragua`. Por omisión no hay nadie escuchando, y eso es lo
   * correcto para el Hito 9: la biblioteca semilla tiene que alcanzar SOLA.
   */
  readonly costura?: (p: PedidoALaFragua) => void
}

/**
 * LO QUE LA MENTE LE PEDIRÍA A LA FRAGUA, cuando el catálogo no alcanza.
 *
 * ─── POR QUÉ ESTE DATO EXISTE, y no es una comodidad de test ────────────────
 *
 * `PlanResult.gap` dice, escrito en su propio contrato desde el gate 5→6:
 * *«El Hito 8 lee esto y le pide a la fragua un proceso nuevo»*. **Nadie lo
 * leía así.** Medido en el Hito 9 (M1): ningún `package.json` de `ii/` declara
 * `@anima/forge`, o sea que «la fragua no se despierta ni una vez» era cierto
 * porque no había por dónde despertarla — el verde por omisión otra vez.
 *
 * Esto es ese por dónde, y es lo único que hace que la afirmación se pueda
 * poner ROJA: quien escucha cuenta, y si alguna vez cuenta uno, la biblioteca
 * no alcanzó.
 *
 * ─── LO QUE NO TRAE, Y ES A PROPÓSITO: EL VOCABULARIO ───────────────────────
 *
 * `Encargo` de `@anima/forge` pide `seSabeNombrar` —los nombres de sustancia
 * que esta partida tiene— y acá no está, porque **la mente no ve la física**:
 * `VistaDeLaMente` es lo que la criatura percibe, no el catálogo de materia del
 * mundo. Inventarle una lista sería adivinar, y el Hito 8 ya pagó ese error una
 * vez en el otro sentido (el modelo usó el vocabulario del encargo como si
 * fueran `tags`).
 *
 * Es la misma frontera del ADR II-0024: **el paquete DESCRIBE, el llamador
 * completa y manda**. Quien tenga la `Physics` arma el `Encargo` con esto
 * adentro; acá no hay un `await` ni una credencial ni un nombre de mundo.
 */
export interface PedidoALaFragua {
  /** La firma que no se supo establecer. Es el `gap` del `Encargo`. */
  readonly gap: PredicateSignature
  /** Para qué se la quería. Sin esto, el pedido no se puede priorizar. */
  readonly meta: PredicateSignature
  /** Lo que el planificador contestó, en sus palabras. */
  readonly porQue: string
  /** En qué tick de esta partida se pidió. */
  readonly tick: number
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
