// ─── @anima/skills/ctx.ts ────────────────────────────────────────────────────
//
// EL CONTEXTO: todo lo que una habilidad puede hacer, y nada más.
//
// Una habilidad NO muta el mundo. Lee la percepción congelada del tick con
// métodos puros, construye `Intent` con los constructores de acá, y las entrega
// con `yield`. `stepWorld` las juzga exactamente igual que si vinieran del
// cuidador tecleando una orden — código real y aislado no significa código
// privilegiado.
//
// Este archivo importa SOLO de `./tipos.js`, y es a propósito: la emisión del
// `skill-api.d.ts` cose las dos declaraciones en un archivo, y que ésta no
// tenga imports externos propios hace que coser sea borrar una línea y no
// mezclar listas de imports. Ver `banco/emitir-skill-api.mjs`.

import type {
  BodyView,
  Cell,
  CellQuality,
  Clock,
  DetMath,
  Intent,
  Outcome,
  PerceptionView,
  PlaceMemory,
  QualityId,
  RolesOf,
  Rng,
  SeedProcessId,
  SelfView,
  SkillMemory,
  StepResult,
  Verdict,
  Where,
  WhereCell,
} from './tipos.js'

export * from './tipos.js'

export interface Ctx {
  /**
   * El contador de PASOS: cuántas veces llamaron a esta habilidad. No es tiempo.
   * Cuánto tiempo pasó se pregunta con `clock`, y cuánto tiempo esperar se dice
   * con `wait(segundos)` (ADR II-0008).
   */
  readonly tick: number

  /**
   * La frecuencia del mundo, en Hz. Está acá porque la API mezcla las dos
   * unidades y sin esto no se pueden relacionar: `wait` va en SEGUNDOS porque
   * esperar es ritmo, y `explore.maxTicks` va en TICKS porque es un presupuesto
   * de cómputo, o sea cuántas veces se llama a la mente. Sólo son admisibles las
   * que dan un `dt = 1/Hz` exacto: 10, 20, 25, 50 y 100.
   */
  readonly hz: number

  /** El día y la noche (ADR 0085 de Ánima I, en segundos por el ADR II-0008). */
  readonly clock: Clock

  /**
   * La criatura. `SelfView extends BodyView`, así que se puede pasar a sí misma
   * como rol de un proceso — que es cómo enciende el primer fuego de la partida.
   *
   * El `.d.ts` a mano tenía además un `ctx.me: BodyView` para eso mismo. Se fue:
   * con la herencia es literalmente el mismo objeto, y dos nombres para una cosa
   * son dos formas de escribirla mal.
   */
  readonly self: SelfView

  // ─── Cómputo puro sobre la percepción congelada. No cruza nada. ───────────

  /**
   * Los CUERPOS que cumplen el predicado. Cualidades de cuerpo, las 29 del
   * catálogo.
   *
   * OJO, y esto rompió el ejemplo canónico del documento de arquitectura: el
   * agua NO es un cuerpo. Es un campo de la celda (`wet`), porque un lago de
   * 4000 celdas como entidades son 4000 objetos que hay que filtrar diez veces
   * por tick. Buscar agua es `qAt` o `recall`, nunca `see`.
   */
  see(w: Where): BodyView[]

  /** Los lugares recordados que cumplen un predicado de CELDA. Ver `PlaceMemory`. */
  recall(w: WhereCell): PlaceMemory[]

  /** Una cualidad de un cuerpo, ya agregada según su `extent` y sus partes. */
  q(b: BodyView, q: QualityId): number

  /**
   * Una cualidad de la CELDA. Cuatro de las doce leyes actúan acá: la 1 relaja
   * hacia el ambiente, la 3 se modula por el oxígeno de la celda, la 4 lo lee
   * para decidir carbón o ceniza, y la 11 vive en `wet`.
   *
   * Sin esto, tapar la fogata —la técnica emblema de toda la arquitectura—
   * compilaba y producía ceniza siempre: `q(fogata, 'oxygen')` typechequea y
   * contesta el oxígeno DEL CUERPO, mientras la ley 4 lee el DE LA CELDA.
   */
  qAt(at: Cell, q: CellQuality): number

  /**
   * ADR II-0004 — la tasa instantánea con la que las leyes están moviendo esa
   * cualidad AHORA, en unidades por SEGUNDO de mundo. No simula: lee lo que el
   * motor ya calculó este tick. Cero si ninguna ley la está tocando.
   *
   * Con esto, «¿me conviene esperar?» se contesta con una división y sin
   * proyectar el mundo: `(objetivo − actual) / rateOf(...)`. El supuesto «si
   * nada cambia» queda a la vista de quien lo escribe, que es donde el juez lo
   * puede castigar. Una habilidad no simula el futuro; el planificador sí.
   */
  rateOf(b: BodyView, q: QualityId): number

  /**
   * ¿Puedo? Verifica roles y arrangement contra el mundo. NO ejecuta y no cuesta
   * nada. El `Motivo` del veredicto es el mismo con el que `stepWorld` rechaza.
   */
  can<P extends SeedProcessId>(p: P, roles: RolesOf<P>): Verdict

  // ─── Constructores puros de Intent. `yield` los entrega al mundo. ─────────

  goTo(t: BodyView | Cell, o?: { within?: number }): Intent
  take(b: BodyView): Intent

  /**
   * ADR II-0002 — `onTopOf` APOYA (ley 8: sostiene peso); `covering` TAPA
   * (ley 12: ocluye el intercambio con el ambiente). No son lo mismo: la
   * parrilla apoya sin tapar, la losa tapa sin sostener. Confundirlos haría que
   * cocinar sobre la parrilla ahogue el fuego.
   */
  put(b: BodyView, at: Cell, o?: { onTopOf?: BodyView; covering?: BodyView }): Intent

  /** Soltar es soltar. `put` es elegir dónde. */
  drop(b: BodyView): Intent

  /**
   * DEJAR UNA OBRA PUESTA Y FUNCIONANDO. No construye nada ([ADR II-0022]).
   *
   * Tomaba un `Blueprint` —`{ id, at }`— y significaba «levantá este plano acá».
   * El tramo C·bis del Gate 5→6 midió que eso no se sostiene: armar un plano son
   * N−1 uniones encadenadas —once cuerpos para una obra de seis piezas— y cuando
   * algo se puede desplegar el plano YA se realizó. Lo que hay en la mano es un
   * cuerpo.
   *
   * Construir sigue siendo `apply('union', …)` encadenado, y que no tenga verbo
   * propio es correcto: uno nuevo tendría que justificar qué hace que `union` ya
   * no haga.
   *
   * `revision`, si se pasa, es de qué plano salió. El mundo no la usa para nada:
   * la anota, porque el juez necesita a qué plano atribuirle un resultado y
   * porque guardar y restaurar tiene que conservarla.
   */
  place(b: BodyView, at: Cell, revision?: string): Intent

  apply<P extends SeedProcessId>(p: P, roles: RolesOf<P>): Intent

  /**
   * `maxTicks` en TICKS y no en segundos, a diferencia de `wait`: es un
   * presupuesto de CÓMPUTO —cuántas veces se evalúa `until`— y eso sí es
   * muestreo. Ver `ctx.hz` para pasar de uno al otro.
   */
  explore(o: { until: (v: PerceptionView) => boolean; maxTicks: number }): Intent

  /**
   * Comer SIEMPRE está permitido. No es un permiso: lo que varía es cuánto rinde
   * (`calories = nutrition · mass · digestibility`) y cuánto enferma
   * (`toxicity`). `edible` no existe como cualidad ni como puerta, y ésa fue una
   * decisión de la física, no una omisión de esta superficie.
   */
  eat(b: BodyView): Intent

  /**
   * Esperar, en SEGUNDOS de mundo y no en ticks (ADR II-0008): esperar es ritmo,
   * no muestreo, y `wait(2)` son dos segundos a 20 Hz y a 100 Hz.
   *
   * Sin esto, la única forma de dejar pasar el tiempo era `yield
   * ctx.goTo(ctx.self.at)` — caminar hasta donde ya estoy.
   */
  wait(segundos: number): Intent

  // ─── Lo que no es una intención ───────────────────────────────────────────

  /** Canal de habla. No cuesta turno del cuerpo. */
  say(text: string): void

  /**
   * Punto de re-entrada tras cargar la partida, y de paso el informe de fallo:
   * al reanudar, la habilidad arranca de arriba y se saltea a su fase leyendo
   * `memory`. Es lo que convierte un «falló» en un «muere en `buscar-agua` 9 de
   * 10 veces», que es lo que hace corregible una habilidad.
   */
  phase(name: string): void

  /** La ÚNICA sede de estado que sobrevive a un guardado. Las locales no. */
  readonly memory: SkillMemory

  /** Determinismo: no hay `Math.random` ni `Date` en el scope. */
  readonly rng: Rng
  readonly math: DetMath
}

/**
 * La firma de una habilidad. Un generador al idiom `redux-saga`: emite
 * intenciones con `yield`, recibe el resultado del mundo, y termina con
 * `done()` o `fail()`.
 */
export type Skill<A> = (ctx: Ctx, args: A) => Generator<Intent, Outcome, StepResult>
