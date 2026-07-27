// ─── @anima/oracle/ledger.ts ─────────────────────────────────────────────────
//
// EL LIBRO DEL DIOS. Acá vive la única promesa que el dios perezoso le hace al
// jugador: **lo que dijo una vez, lo sostiene**. No porque sea prolijo, sino
// porque el motor no lo deja desdecirse.
//
// El ledger NO es la fuente del determinismo —eso sería frágil, y la primera
// partida que se guarde a mitad lo demostraría—. La fuente del determinismo es
// que la respuesta de la ley sea una FUNCIÓN de la clave y de la semilla
// (`rngFor` en `pregunta.ts`). El ledger es dos cosas mucho más modestas: la
// AUTORIDAD para lo que la ley no puede reproducir —lo que enmendó el oráculo—
// y una CACHÉ para todo lo demás. Si mañana se borrara entero, el mundo tendría
// que volver a decir exactamente lo mismo sobre todo lo que decidió la ley.
//
// ─── Los DOS GRANOS, que es lo que las tres propuestas tenían mal ───────────
//
// La falla, escrita sin vueltas: si el disparador de RESOLUCIÓN y el de
// COMPROMISO son el mismo evento, el oráculo —que tarda segundos— nunca puede
// enmendar nada. La ventana tiene ancho cero y el nivel oracular entero es
// código muerto que igual hay que mantener.
//
//   Grano GRUESO — «hay agua acá», «esto es bosque húmedo»: se compromete AL
//   VERLO. Es lo que la percepción entrega de lejos y no se puede negociar:
//   negarlo después sería que el agua desaparece cuando te acercás.
//
//   Grano FINO — «qué especie vive en este cuerpo de agua», «cuánto stock»,
//   «qué hay adentro de la cueva»: se compromete AL INTERACTUAR. Acercarse,
//   inspeccionar, meter la mano.
//
// De lejos veo agua y de cerca veo que hay mojarras son DOS HECHOS DISTINTOS, y
// el juego mejora si lo son. Entre los dos hay minutos de reloj de pared: ésa es
// la ventana del oráculo, y existe por diseño y no por casualidad.
//
// La regla operativa que sale de ahí, y que es todo lo que hay que recordar:
// **mirar de lejos NO sella un hecho fino**. `witness(key, 'gruesa')` sobre una
// clave fina no hace nada y devuelve `false`. Si sellara, volveríamos a la
// ventana de ancho cero por la puerta de atrás.
//
// ─── El invariante duro ─────────────────────────────────────────────────────
//
// Escribir una respuesta DISTINTA para una clave existente lanza. No devuelve
// un error, no loguea, no gana el último: lanza. Un mundo que se contradice
// dejó de ser un mundo, y seguir corriendo desde ahí solo hace que el síntoma
// aparezca a mil ticks del error, en otro archivo y sin relación aparente.
//
// La ÚNICA puerta para cambiar una respuesta es `amend`, y sólo antes del
// testigo. No es una restricción incómoda: es la definición de «se establece».

import { keyOf, type Question, type WaterBodyId, fnv1a } from './pregunta.js'

// ─── Los granos ─────────────────────────────────────────────────────────────

/** Los dos granos de compromiso. Ver el encabezado: no son un detalle. */
export type Grain = 'gruesa' | 'fina'

/**
 * Quién decidió. `ley` es el procedural (barato, puro, reproducible); `oraculo`
 * es el nivel 2 (caro, asincrónico, y NO escribe números: elige forma y nombre).
 *
 * Se guarda porque es la diferencia entre «esto se puede recalcular si se pierde
 * el guardado» y «esto es irrecuperable». La ley se re-deriva; el oráculo no.
 */
export type Author = 'ley' | 'oraculo'

/**
 * Una respuesta del dios. `unknown` a propósito: el ledger NO sabe ni tiene que
 * saber qué hay adentro de un `ChunkFacts` o de un stock. Lo único que exige es
 * que tenga FORMA CANÓNICA (ver `canonicalize`), porque sin eso no puede
 * detectar una contradicción, que es su razón de existir.
 */
export type Answer = unknown

/**
 * Qué le pasó a una clave. El log es narrativa —el panel de auditoría del Hito 3
 * lee esto— y también es la prueba: `verify()` reconstruye el estado entero
 * replayando estos eventos y lo compara contra el mapa vivo.
 */
export type LedgerEvent = 'decidido' | 'enmendado' | 'testigo' | 'descartado'

const GRAIN_RANK: Record<Grain, number> = { gruesa: 0, fina: 1 }

/**
 * El grano de compromiso de cada pregunta. Vive acá y no en `pregunta.ts` porque
 * es una decisión sobre CUÁNDO se sella, no sobre qué se pregunta.
 *
 * Es una función total sobre las cuatro variantes y no una tabla suelta: cuando
 * mañana aparezca una quinta pregunta, `tsc` va a exigir decir su grano en vez
 * de dejarla caer en un `default` silencioso. Una tabla paralela se desincroniza;
 * un `switch` exhaustivo no puede.
 */
export function grainOf(q: Question): Grain {
  switch (q.k) {
    case 'chunk':
      // El bioma y el agua se ven de lejos. Que un chunk resuelto pueda cambiar
      // después de que alguien lo miró es el agua que desaparece al acercarse.
      return 'gruesa'
    case 'waterBody':
      // Qué especie vive acá: hay que acercarse. Es el caso que el documento usa
      // como ejemplo y el que le da al oráculo su ventana.
      return 'fina'
    case 'draw':
      // Meter la mano ES la interacción.
      return 'fina'
    case 'novelty':
      // La novedad la propone el oráculo; sellarla de lejos sería sellarla antes
      // de que el oráculo conteste, que es exactamente el bug que evitamos.
      return 'fina'
  }
}

// ─── Lo que se rompe cuando el dios se contradice ───────────────────────────

/**
 * Las formas de romper el libro. Discriminadas y con los datos adentro: un
 * mensaje de texto sirve para leer, un dato sirve para testear.
 */
export type Contradiction =
  | { readonly k: 'respuesta-distinta'; readonly key: string; readonly previa: string; readonly nueva: string }
  | { readonly k: 'testigo-sin-hecho'; readonly key: string }
  | { readonly k: 'cambio-despues-del-testigo'; readonly key: string; readonly evento: LedgerEvent }
  | { readonly k: 'clave-ocupada'; readonly key: string }
  | { readonly k: 'evento-sin-hecho'; readonly key: string; readonly evento: LedgerEvent }
  | { readonly k: 'tick-hacia-atras'; readonly de: number; readonly a: number }
  | { readonly k: 'estado-fuera-del-log'; readonly key: string; readonly por: string }
  | { readonly k: 'sin-forma-canonica'; readonly que: string }
  | { readonly k: 'testigo-borrado'; readonly key: string }

function describe(c: Contradiction): string {
  switch (c.k) {
    case 'respuesta-distinta':
      return `«${c.key}» ya decía ${c.previa} y se quiso escribir ${c.nueva}`
    case 'testigo-sin-hecho':
      return `se quiso sellar «${c.key}», que nadie decidió`
    case 'cambio-despues-del-testigo':
      return `«${c.key}» cambió (${c.evento}) después de tener testigo`
    case 'clave-ocupada':
      return `«${c.key}» se decidió dos veces`
    case 'evento-sin-hecho':
      return `«${c.key}» tiene un ${c.evento} sin hecho previo`
    case 'tick-hacia-atras':
      return `el tick fue del ${String(c.de)} al ${String(c.a)}`
    case 'estado-fuera-del-log':
      return `«${c.key}» no coincide con el log: ${c.por}`
    case 'sin-forma-canonica':
      return `una respuesta sin forma canónica: ${c.que}`
    case 'testigo-borrado':
      return `se quiso borrar «${c.key}», que tiene testigo`
  }
}

/**
 * Se lanza y no se devuelve, y eso es a propósito. Es el mismo nombre y la misma
 * decisión que `InvariantError` de `@anima/world`: un invariante roto no es un
 * resultado del que se pueda seguir. Que «el dios no pueda contradecirse porque
 * el motor no lo deja» es literalmente esta clase.
 */
export class InvariantError extends Error {
  readonly reason: Contradiction
  constructor(reason: Contradiction) {
    super(`el libro del dios se contradice: ${describe(reason)}`)
    this.name = 'InvariantError'
    this.reason = reason
  }
}

// ─── La forma canónica de una respuesta ─────────────────────────────────────

/** Orden por unidad de código UTF-16. NUNCA `localeCompare`: depende del locale
 *  del sistema, y con eso dos máquinas ordenarían distinto las mismas claves. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * El texto canónico de una respuesta. Existe para UNA cosa: poder preguntar «¿es
 * la misma respuesta que ya había?» sin depender de la identidad del objeto.
 *
 * `JSON.stringify` no sirve, y no es purismo. Recorre las claves en orden de
 * INSERCIÓN, así que dos respuestas iguales armadas por caminos distintos —una
 * decidida por la ley, otra recargada de un guardado— se escriben distinto y el
 * ledger declararía una contradicción que no existe. Eso es lo peor de los dos
 * errores posibles: el mundo se cae, y se cae en la carga de una partida buena.
 *
 * Lo que NO tiene forma canónica **lanza** en vez de pasar de largo. `undefined`
 * y una función se serializarían como ausencia, o sea que dos respuestas
 * distintas serían iguales — un falso «no hay contradicción», que es el error
 * silencioso. Y una respuesta del dios que no se puede escribir tampoco se puede
 * guardar: si no entra acá, no entra en el guardado, y mejor enterarse ahora.
 */
export function canonicalize(v: Answer): string {
  if (v === null) return 'z'
  switch (typeof v) {
    case 'boolean':
      return v ? 'b1' : 'b0'
    case 'number':
      // NaN e Infinity no tienen forma en JSON y no sobreviven a un guardado.
      if (!Number.isFinite(v)) throw new InvariantError({ k: 'sin-forma-canonica', que: String(v) })
      // `-0` y `0` son el mismo número para todo el resto del motor (`-0 === 0`),
      // así que si se escribieran distinto el ledger vería una contradicción
      // entre dos respuestas que nadie puede distinguir.
      return `n${String(v === 0 ? 0 : v)}`
    case 'bigint':
      return `g${String(v)}`
    case 'string':
      // `JSON.stringify` de un string sí es canónico: el escape está
      // especificado y no hay orden de claves de por medio.
      return `s${JSON.stringify(v)}`
    case 'object': {
      if (Array.isArray(v)) return `[${v.map((x: unknown) => canonicalize(x)).join(',')}]`
      const o = v as Record<string, unknown>
      const keys = Object.keys(o).sort(byCodeUnit)
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(o[k])}`).join(',')}}`
    }
    default:
      throw new InvariantError({ k: 'sin-forma-canonica', que: typeof v })
  }
}

// ─── La huella ──────────────────────────────────────────────────────────────

const LANE_B_OFFSET = 0x9dc5811c | 0
const LANE_B_PRIME = 0x85ebca6b

/**
 * Dos carriles de FNV-1a, no uno.
 *
 * Un carril de 32 bits da una colisión ciega cada 4·10⁹ comparaciones, y en una
 * prueba de equivalencia una colisión es un FALSO NEGATIVO: dos mundos que YA
 * divergieron se declaran iguales y el test pasa en verde. Con las corridas
 * largas del Hito 5 no es un riesgo teórico.
 *
 * El primer carril es `fnv1a` de `pregunta.ts` —el mismo, no una copia— y el
 * segundo cambia offset y primo. No es un hash criptográfico de 64 bits y no
 * pretende serlo: es una cota de colisión accidental muchísimo mejor que 2⁻³²
 * por el costo de un `imul` más por carácter.
 */
export function textFingerprint(s: string): string {
  let h = LANE_B_OFFSET
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h = Math.imul(h ^ ((c >>> 8) & 0xff), LANE_B_PRIME)
    h = Math.imul(h ^ (c & 0xff), LANE_B_PRIME)
  }
  return fnv1a(s).toString(16).padStart(8, '0') + (h >>> 0).toString(16).padStart(8, '0')
}

// ─── El compromiso ──────────────────────────────────────────────────────────

/**
 * Una entrada del libro. Es a la vez el ESTADO de una clave (la última entrada
 * de esa clave manda) y un renglón de la NARRATIVA («tick 4021: el mundo decidió
 * que este arroyo tenía mojarras»).
 */
export interface Commitment {
  readonly key: string
  readonly answer: Answer
  /** El grano del HECHO —lo fija la pregunta—, no el de quien lo miró. */
  readonly grain: Grain
  /** Cuándo se decidió por primera vez. Sobrevive a las enmiendas. */
  readonly decidedAtTick: number
  readonly by: Author
  readonly witnessed: boolean
  /** Qué pasó en ESTE renglón. */
  readonly event: LedgerEvent
  /** Cuándo pasó ESTE renglón. */
  readonly atTick: number
  /** Por qué, cuando hace falta contarlo. Es narrativa, no estado. */
  readonly note: string | null
}

/**
 * El libro.
 *
 * Sincrónico de punta a punta: `ask` NUNCA espera. El oráculo tarda segundos y
 * el tick dura 50 ms; si preguntar pudiera bloquear, el mundo se pararía a
 * esperar a un modelo y el jugador vería el freno. El oráculo llega por `amend`,
 * después, y sólo si nadie interactuó todavía.
 */
export class Ledger {
  readonly #current = new Map<string, Commitment>()
  readonly #log: Commitment[] = []
  #tick: number

  constructor(tick = 0) {
    this.#tick = tick
  }

  /** El tick que el libro cree que corre. Es sólo para fechar los renglones. */
  get tick(): number {
    return this.#tick
  }

  /**
   * Adelanta el reloj del libro. **Monótono**: no se puede volver atrás.
   *
   * El tick no entra en la huella (ver `fingerprint`), así que esto no es una
   * defensa del determinismo sino de la NARRATIVA: un log cuyos ticks van y
   * vienen no se puede leer como historia, y el panel de auditoría del Hito 3 es
   * medio hito.
   */
  advanceTo(tick: number): void {
    if (tick < this.#tick) throw new InvariantError({ k: 'tick-hacia-atras', de: this.#tick, a: tick })
    this.#tick = tick
  }

  /**
   * La pregunta. Si ya hay compromiso, devuelve el compromiso y **no llama a
   * `byLaw`**: no es una optimización, es la diferencia entre un dios que se
   * sostiene y uno que reevalúa. Si no lo hay, la ley contesta y eso queda
   * escrito.
   *
   * `byLaw` tiene que ser una función pura de la clave y de la semilla. Si mira
   * el reloj o el dado del mundo, este método devuelve algo distinto según
   * cuándo se preguntó, y toda la regla madre se cae. `pregunta.ts` da las
   * herramientas para que no haga falta: `rngFor(q, seed)` no tiene estado.
   */
  ask<T>(q: Question, byLaw: () => T): T {
    const key = keyOf(q)
    const had = this.#current.get(key)
    if (had !== undefined) return had.answer as T
    const answer = byLaw()
    this.#write(key, answer, grainOf(q), 'ley')
    return answer
  }

  /**
   * Escribir directo, sin pregunta. Es la puerta de abajo: la usa `ask` y la usa
   * quien ya tiene la clave en la mano.
   *
   * **El invariante duro vive acá.** Escribir la MISMA respuesta es idempotente
   * y no deja renglón nuevo (re-preguntar no es un evento). Escribir una
   * DISTINTA lanza, tenga testigo o no. Cambiar de opinión antes del testigo es
   * legítimo, pero tiene su propia puerta y se llama `amend`: que el cambio sea
   * explícito es lo que hace que el log se pueda leer y auditar.
   */
  establish(key: string, answer: Answer, grain: Grain, by: Author = 'ley'): Commitment {
    return this.#write(key, answer, grain, by)
  }

  #write(key: string, answer: Answer, grain: Grain, by: Author): Commitment {
    // Se canoniza SIEMPRE, también cuando la clave es nueva y no hay nada con
    // qué comparar. Si sólo se canonizara al detectar un choque, una respuesta
    // que no se puede escribir entraría al libro en silencio y explotaría mil
    // ticks después —al guardar, o al preguntar de nuevo—, lejos de quien la
    // escribió. Cuesta una serialización por hecho decidido, y los hechos se
    // deciden una sola vez en toda la partida.
    const now = canonicalize(answer)
    const previous = this.#current.get(key)
    if (previous !== undefined) {
      const before = canonicalize(previous.answer)
      if (before !== now) {
        throw new InvariantError({ k: 'respuesta-distinta', key, previa: before, nueva: now })
      }
      return previous
    }
    const c: Commitment = {
      key,
      answer,
      grain,
      decidedAtTick: this.#tick,
      by,
      witnessed: false,
      event: 'decidido',
      atTick: this.#tick,
      note: null,
    }
    this.#current.set(key, c)
    this.#log.push(c)
    return c
  }

  /**
   * Sella para siempre. `grain` es CUÁN DE CERCA se miró, no el grano del hecho.
   *
   *   - Mirar de lejos (`gruesa`) sella los hechos gruesos y **no toca los
   *     finos**: devuelve `false` y el oráculo sigue teniendo su ventana.
   *   - Interactuar (`fina`) sella todo, porque ya no hay nada más cerca.
   *
   * Sellar dos veces es idempotente y devuelve `true`: dos criaturas mirando el
   * mismo río no es una contradicción.
   *
   * Sellar una clave que nadie decidió **lanza**. No es defensivo por gusto: el
   * único orden correcto es preguntar y después mirar, y un testigo colgado de
   * una clave inexistente es un llamador que se equivocó de clave —un dedazo que
   * si no lanza acá, aparece dentro de mil ticks como un hecho que no se selló.
   */
  witness(key: string, grain: Grain): boolean {
    const c = this.#current.get(key)
    if (c === undefined) throw new InvariantError({ k: 'testigo-sin-hecho', key })
    if (c.witnessed) return true
    if (GRAIN_RANK[grain] < GRAIN_RANK[c.grain]) return false
    const sealed: Commitment = { ...c, witnessed: true, event: 'testigo', atTick: this.#tick, note: null }
    this.#current.set(key, sealed)
    this.#log.push(sealed)
    return true
  }

  /**
   * La enmienda del oráculo. Devuelve `false` si ya hay testigo —y ése es todo
   * el mecanismo—: lo que alguien vio no se toca.
   *
   * Devuelve `false` también si la clave no existe. El oráculo tarda segundos y
   * el mundo sigue; que vuelva hablando de algo que el mundo ya olvidó (dos
   * charcos que se fusionaron, ver `compromiso.ts`) es normal, no es un error, y
   * la respuesta correcta es «llegaste tarde», no una excepción.
   *
   * Enmendar con la MISMA respuesta igual deja renglón: el oráculo confirmó, y
   * eso es información distinta de que nadie contestó.
   */
  amend(key: string, answer: Answer, note: string | null = null): boolean {
    const c = this.#current.get(key)
    if (c === undefined) return false
    if (c.witnessed) return false
    // Se canoniza ahora y no al leer: una respuesta que no se puede escribir no
    // puede entrar al libro ni siquiera de la mano del oráculo.
    canonicalize(answer)
    const amended: Commitment = {
      ...c,
      answer,
      by: 'oraculo',
      event: 'enmendado',
      atTick: this.#tick,
      note,
    }
    this.#current.set(key, amended)
    this.#log.push(amended)
    return true
  }

  /**
   * Olvidar una clave. Devuelve `false` si tiene testigo: **lo que alguien vio
   * no se borra**, que es la misma regla que `amend` mirada del otro lado.
   *
   * Existe para la fusión de dos lagos: cuando dos charcos que nadie vio se
   * juntan, uno de los dos ids deja de nombrar nada. No se puede «mover» la
   * respuesta al id ganador, y esto es fino y vale escribirlo: la respuesta de la
   * ley es función de la CLAVE, así que la respuesta de `w:5,5` mudada a `w:0,0`
   * no es la que la ley daría para `w:0,0`, y dos partidas que exploraron en
   * distinto orden terminarían con respuestas distintas para la misma clave.
   * Descartar y dejar que se re-pregunte es lo único que preserva la regla madre.
   */
  discard(key: string, note: string | null = null): boolean {
    const c = this.#current.get(key)
    if (c === undefined) return false
    if (c.witnessed) return false
    const dropped: Commitment = { ...c, event: 'descartado', atTick: this.#tick, note }
    this.#current.delete(key)
    this.#log.push(dropped)
    return true
  }

  get(key: string): Commitment | null {
    return this.#current.get(key) ?? null
  }

  has(key: string): boolean {
    return this.#current.has(key)
  }

  hasWitness(key: string): boolean {
    return this.#current.get(key)?.witnessed ?? false
  }

  /**
   * El log entero, append-only. **Es narrativa**: el panel de auditoría del Hito
   * 3 lee esto y muestra «tick 4021: el mundo decidió que este arroyo tenía
   * mojarras». Por eso una enmienda agrega renglón en vez de pisar el anterior:
   * el libro cuenta lo que pasó, no sólo lo que quedó.
   */
  entries(): readonly Commitment[] {
    return this.#log
  }

  /**
   * El estado vivo, en orden canónico de clave. Es lo que hay que comparar entre
   * dos partidas: el log depende de la historia, esto no.
   */
  state(): readonly Commitment[] {
    return [...this.#current.values()].sort((a, b) => byCodeUnit(a.key, b.key))
  }

  /**
   * La huella del libro, **sin los ticks**.
   *
   * Y ahí está el criterio del Hito 3: «el mismo mundo explorado en dos órdenes y
   * con dos historias distintas entre medio produce el mismo hash». Si el tick
   * entrara en la huella eso sería falso por construcción —explorar en otro orden
   * decide las mismas cosas en otros ticks— y el criterio no mediría nada.
   *
   * Los ticks son historia; las respuestas son mundo.
   */
  fingerprint(): string {
    const text = this.state()
      .map((c) => `${c.key}|${c.grain}|${c.by}|${c.witnessed ? '1' : '0'}|${canonicalize(c.answer)}`)
      .join('\n')
    return textFingerprint(text)
  }

  /**
   * El invariante duro, verificado de punta a punta. Está pensado para correrse
   * UNA VEZ POR TICK, igual que los invariantes de `@anima/world`.
   *
   * Rehace el estado replayando el log y lo compara contra el mapa vivo. No es
   * ceremonia: `#current` y `#log` son dos representaciones de lo mismo, y el
   * día que un método toque una y se olvide de la otra, el libro empieza a
   * mentirle al panel de auditoría o al guardado, y sin esto nadie se entera.
   *
   * Además chequea lo que ningún método puede chequear solo, porque son
   * propiedades de la SECUENCIA: que nada cambió después de su testigo, que
   * ninguna clave se decidió dos veces, y que los ticks no van hacia atrás.
   */
  verify(): void {
    interface Live {
      answer: string
      witnessed: boolean
      grain: Grain
    }
    const rebuilt = new Map<string, Live>()
    let lastTick: number | null = null
    for (const e of this.#log) {
      if (lastTick !== null && e.atTick < lastTick) {
        throw new InvariantError({ k: 'tick-hacia-atras', de: lastTick, a: e.atTick })
      }
      lastTick = e.atTick
      const live = rebuilt.get(e.key)
      switch (e.event) {
        case 'decidido':
          if (live !== undefined) throw new InvariantError({ k: 'clave-ocupada', key: e.key })
          rebuilt.set(e.key, { answer: canonicalize(e.answer), witnessed: false, grain: e.grain })
          break
        case 'enmendado':
        case 'testigo':
        case 'descartado': {
          if (live === undefined) throw new InvariantError({ k: 'evento-sin-hecho', key: e.key, evento: e.event })
          if (live.witnessed && e.event !== 'testigo') {
            throw new InvariantError({ k: 'cambio-despues-del-testigo', key: e.key, evento: e.event })
          }
          if (e.event === 'enmendado') live.answer = canonicalize(e.answer)
          else if (e.event === 'testigo') live.witnessed = true
          else rebuilt.delete(e.key)
          break
        }
      }
    }
    for (const [key, live] of rebuilt) {
      const c = this.#current.get(key)
      if (c === undefined) throw new InvariantError({ k: 'estado-fuera-del-log', key, por: 'el log lo tiene y el estado no' })
      if (canonicalize(c.answer) !== live.answer) {
        throw new InvariantError({ k: 'estado-fuera-del-log', key, por: 'la respuesta viva no es la del log' })
      }
      if (c.witnessed !== live.witnessed) {
        throw new InvariantError({ k: 'estado-fuera-del-log', key, por: 'el testigo vivo no es el del log' })
      }
    }
    for (const key of this.#current.keys()) {
      if (!rebuilt.has(key)) {
        throw new InvariantError({ k: 'estado-fuera-del-log', key, por: 'el estado lo tiene y el log no' })
      }
    }
  }
}

/**
 * La clave de un cuerpo de agua. Está acá y no en `compromiso.ts` para que haya
 * UNA sola forma de nombrar un cuerpo de agua en el ledger: dos formas de armar
 * la misma clave es la semilla exacta de un hecho que se decide dos veces.
 */
export function waterBodyKey(id: WaterBodyId): string {
  return keyOf({ k: 'waterBody', id })
}
