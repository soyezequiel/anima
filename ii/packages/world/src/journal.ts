// ─── @anima/world/journal.ts ─────────────────────────────────────────────────
//
// LA CRÓNICA. El journal de intenciones y la función que lo cierra: `replay`.
//
// ─── Qué se guarda, y por qué NO se guarda el estado ────────────────────────
//
// Una partida no se guarda como una sucesión de mundos: se guarda como la
// sucesión de INTENCIONES que la produjeron, más el mundo inicial. El mundo se
// vuelve a calcular. Eso vale exactamente lo que valga el determinismo del
// motor —si `stepWorld` no es puro, el replay es ficción— y por eso este archivo
// y `hash.ts` son la misma apuesta escrita dos veces: el journal dice cómo
// volver a llegar, el hash dice si llegaste.
//
// Lo que se compra con eso: una partida de 20.000 ticks pesa lo que pesan sus
// intenciones —unos pocos cientos de KB— en vez de lo que pesan 20.000 mundos;
// el juez puede correr la misma partida con otro código y ver qué cambió; y el
// legado de una vida a la otra es un archivo de texto que se puede leer.
//
// ─── APPEND-ONLY quiere decir que no hay forma de borrar ────────────────────
//
// No es una convención ni un comentario pidiendo por favor: la interfaz no
// expone el arreglo mutable, no hay `remove`, no hay `set`, y `append` RECHAZA
// un tick menor al último escrito. Un journal al que se le puede meter una
// intención en el medio no reproduce nada: reproduce otra partida parecida.
//
// La cadena de hashes es la otra mitad. Cada entrada mezcla el hash de la
// anterior, así que cambiar una intención vieja cambia la cadena entera y
// `journalFromData` lo ve al cargar. No es criptografía —cualquiera que edite el
// archivo puede recalcular la cadena— y no pretende serlo: sirve contra la
// corrupción y contra el bug, que es de lo que hay que defenderse acá.
//
// Y hay un efecto de segundo orden que se buscó a propósito: la cadena obliga a
// HASHEAR CADA INTENCIÓN EN EL MOMENTO DE ESCRIBIRLA. Una intención que lleve
// una función, una fecha o una instancia de clase revienta ahí, en el tick en
// que se emitió, con el nombre de lo que la rompió — y no tres semanas después,
// cuando alguien intenta cargar la partida y se encuentra con que nunca fue
// reproducible.
//
// ─── La convención del tick, que es de donde salen los errores de uno ───────
//
// `tick: t` en una entrada quiere decir: esta intención se consume DURANTE el
// tick t. Y un estado «en el tick t» es el estado AL COMIENZO del tick t, o sea
// con los ticks anteriores ya corridos y el t sin correr. Con esa convención,
// restaurar un snapshot y seguir es `replay(j, { tick: d.tick, state }, step)`,
// sin sumar ni restar uno en ningún lado. Un corrimiento de un tick es una
// divergencia de hash exactamente igual de fatal que mil, y es muchísimo más
// difícil de ver.
//
// Determinismo: acá no hay `Date`, `Math.random`, `performance` ni `Math`
// trascendente. El tick lo pone quien llama; el reloj del mundo es el contador
// de ticks y nada más.

import { esFrecuenciaAdmisible, FRECUENCIAS_ADMISIBLES, HZ_DE_REFERENCIA } from '@anima/physics'

import { HASH_VACIO, hashWorld, worldHashFromHex } from './hash.js'
import type { WorldHash } from './hash.js'

// ─── La cabecera: con qué se corrió esta partida ─────────────────────────────
//
// Una crónica de intenciones no reproduce nada por sí sola: reproduce lo que la
// misma física, la misma semilla y el mismo MUESTREO vuelvan a calcular. La
// semilla ya estaba implícita —el mundo inicial la trae—; la frecuencia no
// estaba en ningún lado, y sin ella dos motores corriendo la misma crónica a
// 20 y a 25 Hz dan dos mundos coherentes y distintos, sin ninguna causa visible
// (ADR II-0008).

/** Con qué se corrió la partida. Va en el archivo, junto a las intenciones. */
export interface CronicaDe {
  /**
   * La frecuencia del mundo, en Hz. Tiene que ser admisible: a una frecuencia
   * cuyo `dt` no es exacto la partida no se puede reproducir ni siquiera contra
   * sí misma.
   */
  readonly hz: number
  /**
   * La semilla del dios perezoso. Va acá y no en el mundo inicial porque es lo
   * OTRO que hay que volver a tener para llegar al mismo lado, y las dos cosas
   * que hay que reproducir tienen que vivir juntas o alguien va a guardar una y
   * olvidarse de la otra.
   */
  readonly semilla: number
}

/** Lo que una crónica supone cuando no dice nada: la frecuencia de referencia. */
export const CRONICA_POR_OMISION: CronicaDe = { hz: HZ_DE_REFERENCIA, semilla: 0 }

function exigirCronica(c: CronicaDe): CronicaDe {
  if (!esFrecuenciaAdmisible(c.hz)) {
    throw new RangeError(
      `frecuencia inadmisible en la crónica: ${String(c.hz)} Hz. Admisibles: ${FRECUENCIAS_ADMISIBLES.join(', ')}`,
    )
  }
  if (!Number.isInteger(c.semilla)) {
    throw new RangeError(`semilla inválida en la crónica: ${String(c.semilla)}`)
  }
  return { hz: c.hz, semilla: c.semilla }
}

/** Una intención escrita en la crónica. */
export interface JournalEntry<I> {
  /** El tick durante el cual se consume. */
  readonly tick: number
  /**
   * El orden dentro del tick, desde 0. Redundante con la posición en el
   * arreglo, y así y todo va escrito: el orden entre dos intenciones del mismo
   * tick es parte del resultado —dos criaturas que agarran el mismo palo no dan
   * lo mismo en un orden que en el otro—, y dejarlo implícito en la posición
   * significa que cualquier herramienta que reordene, filtre o fusione journals
   * puede romperlo sin que se note.
   */
  readonly seq: number
  readonly intent: I
}

/** El journal como dato plano, que es como se guarda y como viaja. */
export interface JournalData<I> {
  readonly version: 1
  /** Con qué se corrió: frecuencia y semilla. Ver `CronicaDe`. */
  readonly de: CronicaDe
  readonly entries: readonly JournalEntry<I>[]
  /** El último eslabón de la cadena de hashes. */
  readonly chain: string
}

export interface Journal<I> {
  /** Con qué se corrió esta partida. No cambia nunca: es de la crónica entera. */
  readonly de: CronicaDe
  /**
   * Escribe una intención. Devuelve la entrada que quedó escrita.
   *
   * Lanza si el tick no es un entero no negativo o si es MENOR al último
   * escrito. Igual no monótono se acepta a propósito: en un tick entran varias
   * intenciones.
   */
  append(tick: number, intent: I): JournalEntry<I>
  readonly length: number
  /** El último tick escrito, o −1 si el journal está vacío. */
  readonly lastTick: number
  /** El eslabón actual de la cadena. Cambia con cada `append`. */
  readonly chain: WorldHash
  entries(): readonly JournalEntry<I>[]
  /** Las intenciones de un tick exacto, en orden. */
  at(tick: number): readonly JournalEntry<I>[]
  /** Todo lo que se consume desde `tick` en adelante, ese tick incluido. */
  since(tick: number): readonly JournalEntry<I>[]
  toData(): JournalData<I>
}

function siguienteEslabon(chain: WorldHash, e: JournalEntry<unknown>): WorldHash {
  // Se hashea la entrada COMPLETA, tick y seq incluidos: la misma intención en
  // otro tick es otra partida, y la cadena tiene que verlo.
  return hashWorld([chain, e.tick, e.seq, e.intent])
}

/**
 * Busca la primera entrada con `tick >= t`. Binaria, porque los ticks vienen no
 * decrecientes por el invariante de `append` — o sea que el arreglo YA está
 * ordenado y no hace falta índice auxiliar. Un `Map` de tick a entradas sería
 * más rápido de leer y costaría memoria proporcional a los ticks vividos, que es
 * justo el impuesto que crece con la partida que el Hito 2 vino a sacar.
 */
function lowerBound<I>(entries: readonly JournalEntry<I>[], t: number): number {
  let lo = 0
  let hi = entries.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((entries[mid] as JournalEntry<I>).tick < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

function crear<I>(
  inicial: readonly JournalEntry<I>[],
  chainInicial: WorldHash,
  de: CronicaDe,
): Journal<I> {
  // El arreglo vive en el cierre y NUNCA se devuelve: `entries()` devuelve una
  // vista de solo lectura del mismo arreglo. Es de solo lectura por tipo, no por
  // congelamiento: `Object.freeze` por entrada costaría en el camino caliente y
  // el tipo ya alcanza para que un `push` de afuera no compile.
  const entries: JournalEntry<I>[] = [...inicial]
  let chain = chainInicial
  let lastTick = entries.length === 0 ? -1 : (entries[entries.length - 1] as JournalEntry<I>).tick
  let seqEnTick = 0
  for (let i = entries.length - 1; i >= 0; i--) {
    if ((entries[i] as JournalEntry<I>).tick !== lastTick) break
    seqEnTick++
  }

  return {
    de,
    append(tick: number, intent: I): JournalEntry<I> {
      if (!Number.isInteger(tick) || tick < 0) {
        throw new RangeError(`tick inválido en el journal: ${String(tick)}`)
      }
      if (tick < lastTick) {
        throw new RangeError(`el journal es append-only: llegó el tick ${tick} después del ${lastTick}`)
      }
      if (tick !== lastTick) {
        lastTick = tick
        seqEnTick = 0
      }
      const e: JournalEntry<I> = { tick, seq: seqEnTick++, intent }
      // El hash va ANTES del push: si la intención no es hasheable, el journal
      // no queda con una entrada que no se puede reproducir.
      chain = siguienteEslabon(chain, e)
      entries.push(e)
      return e
    },
    get length() {
      return entries.length
    },
    get lastTick() {
      return lastTick
    },
    get chain() {
      return chain
    },
    entries() {
      return entries
    },
    at(tick: number) {
      const desde = lowerBound(entries, tick)
      const hasta = lowerBound(entries, tick + 1)
      return entries.slice(desde, hasta)
    },
    since(tick: number) {
      return entries.slice(lowerBound(entries, tick))
    },
    toData(): JournalData<I> {
      return { version: 1, de, entries: [...entries], chain }
    },
  }
}

export function createJournal<I>(de: CronicaDe = CRONICA_POR_OMISION): Journal<I> {
  return crear<I>([], HASH_VACIO, exigirCronica(de))
}

/**
 * Carga un journal guardado y REVALIDA la cadena entera.
 *
 * Recalcular 10⁵ hashes al cargar cuesta unos milisegundos y se paga una vez por
 * partida; a cambio, una partida que se corrompió en el disco se descubre al
 * abrirla y no en el tick 12.000 de un replay que ya nadie sabe por qué diverge.
 * Además valida el orden de los ticks y de los `seq`, que es lo que `append`
 * garantiza en vivo y un archivo puede no cumplir.
 */
export function journalFromData<I>(data: JournalData<I>, esperada?: CronicaDe): Journal<I> {
  if (data.version !== 1) throw new RangeError(`journal de versión desconocida: ${String(data.version)}`)
  const de = exigirCronica(data.de ?? CRONICA_POR_OMISION)
  // CARGAR CON OTRA FRECUENCIA ES UN ERROR EXPLÍCITO (ADR II-0008), y no una
  // divergencia silenciosa: la misma crónica muestreada más fina da otro mundo,
  // coherente y distinto, y el síntoma sería un hash que no cierra mil ticks
  // después. Lo mismo vale para la semilla.
  if (esperada !== undefined) {
    if (esperada.hz !== de.hz) {
      throw new Error(
        `la crónica se escribió a ${String(de.hz)} Hz y se está cargando a ${String(esperada.hz)}: son dos muestreos distintos del mismo mundo y no dan la misma traza`,
      )
    }
    if (esperada.semilla !== de.semilla) {
      throw new Error(
        `la crónica se escribió con semilla ${String(de.semilla)} y se está cargando con ${String(esperada.semilla)}`,
      )
    }
  }

  let chain = HASH_VACIO
  let tickAnterior = -1
  let seqEsperado = 0
  for (let i = 0; i < data.entries.length; i++) {
    const e = data.entries[i] as JournalEntry<I>
    if (!Number.isInteger(e.tick) || e.tick < 0) throw new RangeError(`entrada ${i}: tick inválido`)
    if (e.tick < tickAnterior) throw new RangeError(`entrada ${i}: tick ${e.tick} después del ${tickAnterior}`)
    if (e.tick !== tickAnterior) {
      tickAnterior = e.tick
      seqEsperado = 0
    }
    if (e.seq !== seqEsperado) {
      throw new RangeError(`entrada ${i}: seq ${e.seq} donde correspondía ${seqEsperado}`)
    }
    seqEsperado++
    chain = siguienteEslabon(chain, e)
  }

  const esperado = worldHashFromHex(data.chain)
  if (chain !== esperado) {
    throw new Error(`journal corrupto: la cadena da ${chain} y el archivo dice ${esperado}`)
  }
  return crear(data.entries, chain, de)
}

// ─── replay ──────────────────────────────────────────────────────────────────

/**
 * Un tick del mundo. `state` entra, `state` sale.
 *
 * Se recibe por parámetro en vez de importarse porque `replay` no tiene por qué
 * saber qué es un mundo: así se prueba con un mundo de juguete de tres líneas
 * —donde una divergencia es un bug DE ACÁ y no del motor— y así el juez puede
 * reproducir la misma partida con dos versiones distintas de `stepWorld`, que es
 * literalmente para lo que existe el juez.
 */
export type StepFn<S, I> = (state: S, intents: readonly I[], tick: number) => S

/** Desde dónde arranca el replay: un estado y el tick que le falta correr. */
export interface ReplayStart<S> {
  readonly tick: number
  readonly state: S
}

export interface ReplayOptions<S> {
  /**
   * Último tick a correr, incluido. Por defecto, el último tick CON INTENCIÓN
   * del journal — que no es lo mismo que el último tick que vivió el mundo.
   *
   * Si la partida siguió corriendo después de la última intención, el journal no
   * tiene cómo saberlo y el replay termina antes, con menos física corrida y un
   * hash distinto sin causa visible. En el mundo de verdad no muerde, porque la
   * cola de intenciones «siempre tiene algo» y nunca hay un tick sin intención;
   * en un journal filtrado o cortado sí. Ante la duda, se pasa a mano.
   */
  readonly hasta?: number
  /** Hashes conocidos por tick, para cortar en la primera divergencia. */
  readonly checkpoints?: ReadonlyMap<number, WorldHash>
  readonly hashOf?: (state: S) => WorldHash
}

/**
 * Reproduce la partida desde `desde` hasta `hasta`.
 *
 * ─── Corre TODOS los ticks, no solo los que tienen intenciones ──────────────
 *
 * Es la decisión que hace que esta función sea correcta y la ingenua no. Las
 * doce leyes de `@anima/physics` corren SOLAS: el pescado se seca, la brasa se
 * enfría y la fibra mojada sigue mojándose sin que nadie quiera nada. Un replay
 * que saltara del tick 100 al 140 porque en el medio no hubo intenciones
 * reproduciría un mundo donde esos 39 ticks de física no pasaron, y el error no
 * sería un hash distinto: sería un mundo COHERENTE y equivocado, con el pescado
 * más húmedo de lo que debía. Por eso el bucle va tick por tick y llama a `step`
 * con el arreglo vacío cuando no hay nada que hacer.
 *
 * ─── Los checkpoints, y por qué valen tanto ─────────────────────────────────
 *
 * Sin ellos, una divergencia se manifiesta como «los dos hashes finales no
 * coinciden» y hay que bisecar 20.000 ticks a mano. Con ellos, `replay` corta en
 * el PRIMER tick que no da y lo dice en el mensaje. La diferencia entre
 * encontrar un bug de determinismo en diez minutos y no encontrarlo nunca suele
 * ser exactamente ésta.
 */
export function replay<S, I>(
  journal: Journal<I> | readonly JournalEntry<I>[],
  desde: ReplayStart<S>,
  step: StepFn<S, I>,
  options: ReplayOptions<S> = {},
): S {
  const entries: readonly JournalEntry<I>[] = Array.isArray(journal)
    ? (journal as readonly JournalEntry<I>[])
    : (journal as Journal<I>).entries()

  if (!Number.isInteger(desde.tick) || desde.tick < 0) {
    throw new RangeError(`tick de arranque inválido: ${String(desde.tick)}`)
  }

  const ultimo = entries.length === 0 ? desde.tick - 1 : (entries[entries.length - 1] as JournalEntry<I>).tick
  const hasta = options.hasta ?? ultimo
  if (!Number.isInteger(hasta)) throw new RangeError(`tick final inválido: ${String(hasta)}`)
  if (hasta < desde.tick - 1) {
    throw new RangeError(`no se puede reproducir hacia atrás: desde ${desde.tick} hasta ${hasta}`)
  }

  const { checkpoints, hashOf } = options
  if (checkpoints !== undefined && hashOf === undefined) {
    throw new TypeError('hay checkpoints pero no `hashOf`: no habría con qué compararlos')
  }

  function verificar(tick: number, state: S): void {
    if (checkpoints === undefined || hashOf === undefined) return
    const esperado = checkpoints.get(tick)
    if (esperado === undefined) return
    const dio = hashOf(state)
    if (dio !== esperado) {
      throw new Error(`el replay divergió al comienzo del tick ${tick}: esperaba ${esperado} y dio ${dio}`)
    }
  }

  let state = desde.state
  // Las entradas anteriores a `desde.tick` ya están adentro del estado que
  // recibimos —eso es lo que significa restaurar un snapshot— así que el cursor
  // arranca donde arranca el trabajo.
  let cursor = lowerBound(entries, desde.tick)

  for (let tick = desde.tick; tick <= hasta; tick++) {
    verificar(tick, state)
    const inicio = cursor
    while (cursor < entries.length && (entries[cursor] as JournalEntry<I>).tick === tick) cursor++
    const intents: I[] = []
    for (let i = inicio; i < cursor; i++) intents.push((entries[i] as JournalEntry<I>).intent)
    state = step(state, intents, tick)
  }
  // El estado final vale «al comienzo de hasta + 1», y ahí también puede haber
  // un checkpoint: es el más útil de todos, el del final de la partida.
  verificar(hasta + 1, state)

  return state
}
