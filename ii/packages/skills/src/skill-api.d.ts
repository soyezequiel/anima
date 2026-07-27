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
 *
 * ─── PASE 2 ─────────────────────────────────────────────────────────────────
 * Cinco reparaciones, y SOLO cinco, para que la diferencia contra los 112
 * errores del pase 1 sea atribuible. Salen de `ii/docs/huecos-medidos.md`,
 * que las ordena por cuántos borradores distintos las piden:
 *
 *   1. `SelfView extends BodyView`  — 7 borradores, 9 sitios
 *   2. `SelfView.stamina` / `.hunger` — 8 borradores
 *   3. `Ctx.qAt` + `CellQuality`    — 6 borradores, 8 sitios
 *   4. `Ctx.eat`                    — 3 borradores, 8 sitios
 *   5. `Ctx.wait`                   — 5 borradores
 *
 * Deliberadamente NO se tocó nada más. `clock`, `place`, `drop`,
 * `PlaceMemory.atTick`, los roles tipados por proceso y las cualidades que
 * exigen leyes nuevas quedan afuera: cada uno se mide por separado o no se
 * mide. Un pase 2 que arregla todo no prueba nada.
 *
 * ─── PASE 3 ─────────────────────────────────────────────────────────────────
 * El pase 2 dejó siete borradores a UNA sola cosa de compilar, y esas siete
 * cosas ya no eran firmas que faltaban: eran decisiones sin tomar. Se tomaron,
 * en `ii/docs/decisions/`, y acá están sus consecuencias:
 *
 *   II-0001  encender no es una acción → `combustion` NO entra a ProcessId,
 *            y no se agrega nada. La decisión fue no agregar.
 *   II-0002  la ley 12, `oclusion` → `put(covering:)`, `sheltered` como
 *            cualidad de celda, `coveredBy` en BodyView.
 *   II-0003  autoría y no propiedad → `BodyView.madeByMe`, no `ctx.mine`.
 *   II-0004  la habilidad lee el presente, el planificador razona el futuro
 *            → `rateOf()`, no `project()`.
 *
 * Más los faltantes mecánicos con ADR de Ánima I que los respalda: `clock`
 * (0085), `place` (0032), `capacity` (0070), `drop`, y los campos de
 * `PlaceMemory` sin los cuales recordar un lugar no dice nada de él.
 *
 * Y `RolesOf<P>`, que es la reparación del ÁRBITRO y no de la superficie: hoy
 * `apply(p, roles: Record<string, BodyView>)` acepta cualquier objeto, así que
 * de veinte llamadas malformadas `tsc` rechaza CERO. Se espera que este cambio
 * SUBA el número de errores. Un pase que sube los errores porque el árbitro
 * empezó a funcionar vale más que uno que los baja.
 *
 * SIGUEN AFUERA, y a propósito: `raining`, `covers`, `smoke`, `threat`,
 * `buoyancy`, `flow`, y los procesos `cubrir`, `cavar`, `afilar`, `ahumar`,
 * `arrastrar`. Son huecos de FÍSICA. La superficie solo puede declarar lo que
 * alguna ley pone en el mundo.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─── Cualidades ─────────────────────────────────────────────────────────────
// El único vocabulario cerrado del sistema, y es física, no objetos.

/**
 * REPARACIÓN (pase 3) — `denaturesAt` y `pyrolysisAt`, los dos bordes de la
 * ventana de cocción. El documento los usa (`s.denaturesAt` en la ley 5) como
 * propiedad de la sustancia, y por eso no eran legibles desde una habilidad.
 * Pero `sacarlo-antes-de-que-se-queme` trata **exactamente** de conocer esos
 * bordes: sin ellos, la única forma de escribirla es cablear 63 y 280 adentro,
 * que es el hardcodeo que el ejercicio existe para no permitir.
 */

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
  | 'denaturesAt' // pase 3 — borde inferior de la ventana de cocción
  | 'pyrolysisAt' // pase 3 — borde superior; pasado esto se quema
  | 'permeability' // pase 3 — cuánto deja pasar cuando ocluye (ADR II-0002)

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

/**
 * REPARACIÓN 3 (pase 2) — «Ctx.qAt» (6 borradores, 8 sitios). El hallazgo
 * estructural del ejercicio: CUATRO DE LAS ONCE LEYES ACTÚAN SOBRE CELDAS
 * —la 1 relaja hacia `ambient`, la 3 se modula por el `oxygen` de la celda,
 * la 4 lee `w.oxygenAt(b.at)`, la 11 vive en `wet`— y la superficie tenía
 * CERO lecturas de celda: `ctx.q()` exige un `BodyView` y `Cell` no tiene id.
 *
 * Por eso `tapar-la-fogata-para-hacer-carbon` —la técnica emblema de toda la
 * arquitectura— compilaba entera y producía ceniza siempre:
 * `ctx.q(fogata, 'oxygen')` typechequea y contesta el oxígeno DEL CUERPO,
 * mientras la ley 4 lee el DE LA CELDA.
 *
 * Solo entran las tres que las once leyes ya ponen en la celda. `sheltered`
 * NO entra: eso es la ley 12 (`oclusion`), que no está escrita. Agregarlo acá
 * sería tapar un hueco de FÍSICA con superficie, que es exactamente lo que
 * este ejercicio existe para no hacer.
 */
export type CellQuality = 'wet' | 'oxygen' | 'temperature' | 'sheltered'
// `sheltered` entra en el pase 3, y solo porque el ADR II-0002 escribió la ley
// 12 (`oclusion`) que lo produce. Antes habría sido un número que typechequea y
// vale 0 para siempre, que es peor que un error de compilación.

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
 * REPARACIÓN DEL ÁRBITRO (pase 3) — roles tipados por proceso.
 *
 * Con `roles: Record<string, BodyView>`, un corpus de veinte llamadas
 * malformadas —roles faltantes, de más, mal escritos, proceso equivocado con
 * roles correctos— era rechazado CERO veces. El compilador como juez estaba
 * apagado justo donde más se lo necesita.
 *
 * Los roles son los que declara cada proceso en el documento de arquitectura.
 * Cuando exista `@anima/process`, esto se EMITE del catálogo; hasta entonces
 * está a mano y es deuda anotada.
 *
 * ARIDAD DE `union`, que el documento se contradecía: su criterio verificable
 * del Hito 1 dice `union(vara, hebra)` —dos cuerpos— contra un `Process` de
 * tres roles. Se resuelve con `b` opcional: atar `a` con `binder` a un segundo
 * cuerpo, o atarle `binder` a `a` y nada más. La caña es el segundo caso, y por
 * eso le queda una punta de hebra libre — que es de donde sale `catch`
 * (`freeStrandEnds`). Con `b` obligatorio, la caña no existe.
 */
export type RolesOf<P extends ProcessId> = P extends 'friccion'
  ? { a: BodyView; b: BodyView; actor: BodyView }
  : P extends 'union'
    ? { binder: BodyView; a: BodyView; b?: BodyView }
    : P extends 'deshilachar'
      ? { source: BodyView; actor: BodyView }
      : P extends 'extraccion'
        ? { gear: BodyView; source: BodyView }
        : never

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
  /** ADR II-0003 — autoría, no propiedad. Sale de `Provenance`, no se mantiene. */
  readonly madeByMe: boolean
  /** ADR II-0002 — qué la está tapando, si algo. El dual de `put(covering:)`. */
  readonly coveredBy?: BodyView
  /** Pase 3 — profundidad de percepción (HUECO 4). Sin esto no se puede saber
   *  que una atadura se aflojó, que es de lo que trata jubilar una herramienta. */
  readonly joints: readonly JointView[]
}

export interface JointView {
  readonly a: BodyView
  readonly b: BodyView
  readonly strength: number
}

/**
 * REPARACIÓN 1 y 2 (pase 2) — «SelfView no es BodyView» (7 borradores,
 * 9 sitios) y «SelfView.stamina» (8 borradores).
 *
 * La criatura ES un cuerpo. Que `SelfView` no fuera asignable a `BodyView`
 * significaba que no podía pasarse a sí misma como rol de un proceso: no podía
 * frotar dos palos declarándose como el cuerpo que paga la stamina, que es el
 * paso 1 del ejemplo (a) del documento — cómo enciende el primer fuego de la
 * partida.
 *
 * `stamina` y `nutrition` no son campos nuevos: son cualidades que ya existen
 * en el catálogo y que ahora se leen con el mismo verbo que las de cualquier
 * otro cuerpo, `ctx.q(ctx.me, 'stamina')`. Se dejan además como atajos porque
 * ocho borradores los pidieron por nombre.
 */
export interface SelfView extends BodyView {
  readonly holding: readonly BodyView[]
  readonly stamina: number
  readonly hunger: number
  /** Pase 3 — cuántas cosas le entran en las manos. El tamaño lo fija el
   *  cuidador (ADR 0070 de Ánima I), no la habilidad. */
  readonly capacity: number
}

/** Pase 3 — ADR 0085 de Ánima I portado. El día y la noche existen. */
export interface Clock {
  readonly phase: 'dia' | 'noche'
  readonly ticksToNightfall: number
  readonly dayLength: number
}

/** Pase 3 — ADR 0032 de Ánima I: lo grande es una obra, no un bloque. */
export interface Blueprint {
  readonly id: string
  readonly at: Cell
}

/**
 * Pase 3 — HUECO 6 cerrado. Con solo `at`, recordar un lugar no decía NADA de
 * él: se podía ordenar por cercanía y por nada más. Guardar comida donde menos
 * se pudre es exactamente comparar sitios, y sin estos tres campos la capacidad
 * no se puede ni escribir.
 *
 * `atTick` además es lo que separa «no había» de «hace mucho que no vengo», que
 * es la distinción que el análisis marcó como pendiente y que el Beta solo no
 * puede hacer.
 */
export interface PlaceMemory {
  readonly at: Placement
  /** Cuándo lo vio por última vez. Un recuerdo viejo es una hipótesis. */
  readonly atTick: number
  /** Qué había. Vacío si vino y no había nada: eso también es información. */
  readonly what: readonly string[]
  /** Cualidad de celda recordada. Puede estar vieja; por eso está `atTick`. */
  q(q: CellQuality): number
}

/**
 * La vista congelada del tick. El documento la usa dentro de `explore`:
 *   until: (v) => v.see([{ q: 'wet', op: '>=', v: 0.9 }]).length > 0
 * y le atribuye `features` en `opportunities()`.
 */
export interface PerceptionView {
  see(w: Where): BodyView[]
  readonly features: readonly PerceivedFeature[]
  /** Pase 3 — el predicado de corte de `explore` solo podía hablar del paisaje.
   *  Sin esto, no se puede dejar de buscar porque a una se le acabó la fuerza. */
  readonly self: SelfView
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

  /** REPARACIÓN 1 — la criatura como cuerpo, para poder pasarse como rol. */
  readonly me: BodyView

  /** Cómputo puro sobre la percepción congelada del tick. No cruza nada. */
  see(w: Where): BodyView[]
  recall(w: Where): PlaceMemory[]
  q(b: BodyView, q: QualityId): number

  /** REPARACIÓN 3 — leer la celda, no el cuerpo. Ver `CellQuality`. */
  qAt(at: Placement, q: CellQuality): number

  /**
   * ADR II-0004 — la tasa instantánea con la que las leyes están moviendo esa
   * cualidad, ahora. NO simula: lee lo que el motor ya calculó este tick. Cero
   * si ninguna ley la está tocando.
   *
   * Con esto, «¿me conviene esperar?» se contesta con una división y sin
   * proyectar el mundo: `(objetivo - actual) / rateOf(...)`. El supuesto «si
   * nada cambia» queda a la vista de quien lo escribe, que es donde el juez lo
   * puede castigar.
   */
  rateOf(b: BodyView, q: QualityId): number

  /** Pase 3 — el día y la noche existen (ADR 0085 de Ánima I). */
  readonly clock: Clock

  /** ¿Puedo? Verifica roles y arrangement contra el mundo. No ejecuta. */
  can<P extends ProcessId>(p: P, roles: RolesOf<P>): Verdict

  /** Constructores puros de Intent. `yield` los entrega al mundo. */
  goTo(t: BodyView | Cell, o?: { within?: number }): Intent
  take(b: BodyView): Intent
  /**
   * ADR II-0002 — `onTopOf` APOYA (ley 8: sostiene peso); `covering` TAPA
   * (ley 12: ocluye intercambio con el ambiente). No son lo mismo: la parrilla
   * apoya sin tapar, la losa tapa sin sostener. Confundirlos haría que cocinar
   * sobre la parrilla ahogue el fuego.
   */
  put(b: BodyView, at: Cell, o?: { onTopOf?: BodyView; covering?: BodyView }): Intent

  /** Pase 3 — HUECO 9. Soltar es soltar; `put` es elegir dónde. */
  drop(b: BodyView): Intent

  /** Pase 3 — ADR 0032 de Ánima I: lo grande es una obra, no un bloque. */
  place(bp: Blueprint): Intent

  apply<P extends ProcessId>(p: P, roles: RolesOf<P>): Intent
  explore(o: { until: (v: PerceptionView) => boolean; maxTicks: number }): Intent

  /**
   * REPARACIÓN 4 — «Ctx.eat» (3 borradores, 8 sitios). Era el HUECO 8: el
   * documento dice que «`eat` SIEMPRE está permitido» y lista «comer» entre
   * las quince habilidades innatas del Hito 4, y no había forma de comer.
   * Comer no es un permiso: siempre se puede, y lo que varía es cuánto rinde
   * (`nutrition × mass × digestibility`) y cuánto enferma (`toxicity`).
   */
  eat(b: BodyView): Intent

  /**
   * REPARACIÓN 5 — «Ctx.wait» (5 borradores). «Esperar» está en las quince
   * innatas del Hito 4. Sin esto, la única forma de dejar pasar el tiempo era
   * `yield ctx.goTo(ctx.self.at)` —caminar hasta donde ya estoy—, la
   * deformidad que sostenía la secuencia estrella del Hito 5.
   */
  wait(ticks: number): Intent

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
 * HUECO 8 — CERRADO en el pase 2. Ver `eat()` arriba.
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
