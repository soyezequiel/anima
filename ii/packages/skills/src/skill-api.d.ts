/**
 * @anima/skills — la superficie que ve el código que escribe el modelo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ESTO ES TEMPORAL Y MUERE EN EL HITO 4.
 *
 * El documento de arquitectura dice que este archivo se EMITE con
 * `tsc --declaration` del código real, justamente para que no pueda divergir:
 * «la clase entera de bugs "la referencia quedó vieja" desaparece por
 * construcción». Un `.d.ts` escrito a mano es exactamente el bug que
 * `DSL_REFERENCE` en `codex.ts` ya tiene (le faltan 6 operaciones y 5
 * condiciones, y por eso hoy el modelo no puede inventar nada que coloque
 * bloques).
 *
 * Existe por una sola razón: sin código de Ánima II, es el único árbitro
 * mecánico disponible para decidir si una capacidad se puede siquiera
 * EXPRESAR. No dice si una habilidad funciona — eso necesita mundo, y el
 * mundo es el Hito 2.
 *
 * Fuente: docs/architecture/remake-anima-ii.md, «La API que ve el código
 * generado (firmas reales)». Nada acá se inventó: lo que el documento no
 * define está marcado como HUECO y NO se completó a ojo.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─── Cualidades ─────────────────────────────────────────────────────────────
// El único vocabulario cerrado del sistema, y es física, no objetos.

/** Conservadas (4): su suma total no puede aumentar salvo aporte del dios. */
export type ConservedQuality = 'mass' | 'nutrition' | 'stamina' | 'fuelEnergy'

/** Con ley (14): las mueven los procesos. */
export type LawfulQuality =
  | 'temperature'
  | 'ignitionPoint'
  | 'moisture'
  | 'oxygen'
  | 'charred'
  | 'rigidity'
  | 'toughness'
  | 'flexibility'
  | 'tensile'
  | 'sharpness'
  | 'cohesion'
  | 'digestibility'
  | 'toxicity'
  | 'decay'

/** Derivadas (8): no se guardan, se calculan. */
export type DerivedQuality =
  | 'reach'
  | 'catch'
  | 'calories'
  | 'solid'
  | 'portable'
  | 'footing'
  | 'emitsPower'
  | 'heatCapacity'

/**
 * HUECO 1 — el catálogo cerrado no cierra en su propio documento.
 *
 * El documento dice «22 cualidades» y enumera 4 + 14 + 8 = 26. Y además usa
 * en sus propios ejemplos tres cualidades que no están en ninguna de las tres
 * listas:
 *
 *   'wet'      en `pescarConAparejo`: ctx.see([{ q: 'wet', op: '>=', v: 0.9 }])
 *   'stock'    en el rol `source` de EXTRACCION: { q: 'stock', op: '>', v: 0 }
 *   'fibrous'  en el rol `source` de DESHILACHAR: { q: 'fibrous', op: '>=', v: 0.5 }
 *
 * Se incluyen acá porque sin ellas el ejemplo del propio documento no compila.
 * Pero son de naturaleza distinta a las otras: 'wet' es de la celda, 'stock' es
 * del recurso del dios, 'fibrous' parece un tag y no una magnitud. Hay que
 * decidir si son cualidades, tags, o campos aparte. NO se decidió acá.
 */
export type UndeclaredQuality = 'wet' | 'stock' | 'fibrous'

export type QualityId = ConservedQuality | LawfulQuality | DerivedQuality | UndeclaredQuality

// ─── Predicados sobre cualidades ────────────────────────────────────────────

export interface QualityTest {
  readonly q: QualityId
  readonly op: '>=' | '<=' | '>' | '<'
  readonly v: number
}

export type Where = readonly QualityTest[]

// ─── Procesos ───────────────────────────────────────────────────────────────

/**
 * Procesos APLICABLES: los que la criatura puede invocar con `ctx.apply()`.
 * Son los cuatro que el documento define con roles, arrangement y effects.
 */
export type ProcessId = 'friccion' | 'union' | 'deshilachar' | 'extraccion'

/**
 * Leyes AMBIENTE: corren solas por tick sobre lo que califique. La criatura
 * no las invoca — las provoca poniendo las cosas en la situación correcta.
 * No son argumento válido de `ctx.apply()`.
 */
export type AmbientLawId =
  | 'termica'
  | 'combustion'
  | 'transmutacion'
  | 'desnaturalizacion'
  | 'descomposicion'
  | 'estructura'
  | 'metabolismo'
  | 'humedad'

/**
 * HUECO 2 — el documento no separa «ley que corre sola» de «proceso que la
 * criatura aplica». Su tabla enumera las once juntas como «leyes», pero solo
 * cuatro traen `roles` + `arrangement` + `effects`, que es lo que hace falta
 * para invocarlas. La separación de arriba es una lectura, no una cita.
 *
 * Consecuencia práctica, y es grande: el repertorio de transformaciones
 * INVOCABLES son cuatro. Cortar, afilar, cavar, machacar, tejer, perforar y
 * moler no existen ni como proceso ni como primitiva de `Ctx`.
 */

// ─── Geometría y lugar ──────────────────────────────────────────────────────

export interface Cell {
  readonly x: number
  readonly y: number
}

/** HUECO 3 — el documento nombra `Placement` pero nunca declara su forma. */
export type Placement = Cell

// ─── Lo que la criatura ve ──────────────────────────────────────────────────

/**
 * HUECO 4 — el documento nunca declara `BodyView`. Estos campos son el mínimo
 * que sus propios ejemplos usan (`agua.at`, `f.name`). Todo lo demás —masa,
 * partes, juntas, si está ardiendo, quién lo sostiene— es desconocido, y
 * cualquier habilidad que lo necesite tiene que decirlo en voz alta.
 */
export interface BodyView {
  readonly id: string
  readonly at: Placement
  readonly name: string
}

/** HUECO 5 — el documento no declara los campos de `SelfView`. */
export interface SelfView {
  readonly at: Placement
  readonly holding: readonly BodyView[]
}

/** HUECO 6 — el documento no declara los campos de `PlaceMemory`. */
export interface PlaceMemory {
  readonly at: Placement
}

/**
 * La vista congelada del tick. El documento la usa dentro de `explore`:
 *   until: (v) => v.see([{ q: 'wet', op: '>=', v: 0.9 }]).length > 0
 * y le atribuye `features` en `opportunities()`.
 */
export interface PerceptionView {
  see(w: Where): BodyView[]
  readonly features: readonly PerceivedFeature[]
}

/** HUECO 7 — `features` aparece en `opportunities()` con `.ctx` y `.name`, y no se declara. */
export interface PerceivedFeature {
  readonly name: string
  readonly ctx: string
}

// ─── Intenciones y resultados ───────────────────────────────────────────────

export type Commitment = 'reversible' | 'costly' | 'irreversible'

/**
 * Una intención es opaca para el código generado: se construye con los
 * constructores de `Ctx` y se entrega con `yield`. El mundo la juzga.
 */
export interface Intent {
  readonly commitment: Commitment
  readonly __opaque: unique symbol
}

/**
 * Lo que el mundo devuelve al `yield`. Los campos salen de los usos del
 * documento: `r.status !== 'found'`, `ir.status !== 'arrived'`, `o.got.length`.
 */
export interface StepResult {
  readonly status: 'arrived' | 'found' | 'done' | 'blocked' | 'rejected' | 'timeout'
  readonly got: readonly BodyView[]
}

export type Outcome = { readonly ok: true; readonly got?: BodyView } | { readonly ok: false; readonly why: string }

export declare function done(got?: BodyView): Outcome
export declare function fail(why: string): Outcome

export type Verdict = { readonly ok: true } | { readonly ok: false; readonly why: string }

// ─── Memoria, azar y aritmética ─────────────────────────────────────────────

export interface SkillMemory {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  del(key: string): void
}

export type Rng = () => number

/** Punto fijo: mismos bits en toda máquina. `Math.exp` y `Math.pow` no lo garantizan. */
export interface DetMath {
  exp(x: number): number
  pow(x: number, y: number): number
  log(x: number): number
  sin(x: number): number
}

// ─── El contexto ────────────────────────────────────────────────────────────

export interface Ctx {
  readonly tick: number
  readonly self: SelfView

  /** Cómputo puro sobre la percepción congelada del tick. No cruza nada. */
  see(w: Where): BodyView[]
  recall(w: Where): PlaceMemory[]
  q(b: BodyView, q: QualityId): number

  /** ¿Puedo? Verifica roles y arrangement contra el mundo. No ejecuta. */
  can(p: ProcessId, roles: Record<string, BodyView>): Verdict

  /** Constructores puros de Intent. `yield` los entrega al mundo. */
  goTo(t: BodyView | Cell, o?: { within?: number }): Intent
  take(b: BodyView): Intent
  put(b: BodyView, at: Cell, o?: { onTopOf?: BodyView }): Intent
  apply(p: ProcessId, roles: Record<string, BodyView>): Intent
  explore(o: { until: (v: PerceptionView) => boolean; maxTicks: number }): Intent

  /** Canal de habla. No cuesta turno del cuerpo. */
  say(text: string): void

  /** Punto de re-entrada tras cargar la partida. */
  phase(name: string): void

  /** La ÚNICA sede de estado que sobrevive a un guardado. Las locales no. */
  readonly memory: SkillMemory

  /** Determinismo: no hay `Math.random` ni `Date` en el scope. */
  readonly rng: Rng
  readonly math: DetMath
}

/**
 * HUECO 8 — no hay forma de comer.
 *
 * El documento dice que «`eat` SIEMPRE está permitido» y que
 * `energía += calories(b)`, y el Hito 4 lista «comer» entre las quince
 * habilidades innatas. Pero `Ctx` no tiene `eat`, y 'metabolismo' es ley
 * ambiente, no proceso aplicable. Con esta superficie, la criatura no puede
 * comer. Es el hueco más grande y no se tapó a propósito.
 *
 * HUECO 9 — no hay forma de soltar. Hay `take`, hay `put(b, at)`. Si `put`
 * cubre soltar en el piso, no está dicho.
 *
 * HUECO 10 — no hay forma de romper un ensamble. El documento lo nombra como
 * conducta emergente esperada («romper el ensamble para recuperar la vara») y
 * `Yield` tiene `split`, pero ningún proceso aplicable lo produce.
 *
 * HUECO 11 — no hay acceso al reloj del mundo más allá de `ctx.tick`, ni al
 * ciclo día/noche que el ADR 0085 introdujo en Ánima I.
 */

// ─── La firma de una habilidad ──────────────────────────────────────────────

export type Skill<A> = (ctx: Ctx, args: A) => Generator<Intent, Outcome, StepResult>
