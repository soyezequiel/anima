// ─── @anima/world/snapshot.ts ────────────────────────────────────────────────
//
// SNAPSHOT POR DELTA. Un guardado no copia el mundo: guarda LO QUE CAMBIÓ desde
// el guardado anterior.
//
// ─── Contra qué se escribió esto ────────────────────────────────────────────
//
// El documento de arquitectura acusa a Ánima I de usar `structuredClone` como
// aislamiento por defecto —«percepción, snapshot por tick, goals, progress,
// save»— y lo llama por su nombre: **un impuesto que crece con la partida**.
// Ése es exactamente el problema: el costo de un `structuredClone` es
// proporcional al TAMAÑO DEL MUNDO, y el tamaño del mundo crece toda la partida,
// mientras que lo que cambia entre dos guardados no crece: son los cuerpos que
// se movieron en esos N ticks, y ésos son más o menos los mismos en el tick 200
// que en el 20.000. Con snapshot completo, guardar cuesta cada vez más y la
// partida larga —la única que importa, porque el legado es de eso— es la que
// peor anda.
//
// ─── El mundo como RANURAS ──────────────────────────────────────────────────
//
// Este archivo no sabe qué es un cuerpo ni qué es un chunk, y eso es a
// propósito: sabe que el mundo se puede ver como pares `clave → valor`
// —`"body:b17"`, `"chunk:3,-2"`, `"field:humedad"`— y nada más. Con eso alcanza
// para diferenciar, y a cambio el snapshot no se rompe cada vez que el mundo
// gana un campo nuevo. Quien arma el mundo decide el grano de la ranura; el
// grano es el tamaño mínimo del delta, así que conviene que una ranura sea la
// unidad que cambia junta.
//
// ─── Comparar por HASH o por IDENTIDAD, y por qué el default es el caro ──────
//
// Detectar qué cambió tiene dos formas:
//
//   'identidad'  `anterior.get(k) !== valor`. Es O(1) por ranura y sirve solo si
//                el mundo es de copia-al-escribir: si mutás un cuerpo en el
//                lugar, la referencia es la misma, el delta sale VACÍO y el
//                cambio se pierde para siempre.
//   'hash'       compara el hash de cada ranura. Cuesta recorrerla entera, pero
//                no se puede equivocar.
//
// El default es `'hash'`. La elección no es por gusto: los dos errores no son
// simétricos. Con `'hash'` de más, un guardado tarda unos milisegundos más —y
// pasa FUERA del tick, en el worker de fondo, donde nadie lo espera. Con
// `'identidad'` de más, la partida se guarda mal EN SILENCIO y el jugador se
// entera cuando carga y le falta media casa. Un default que puede perder datos
// en silencio no es un default: es una trampa. Quien tenga un mundo de veras
// inmutable y lo pueda demostrar, que pida `'identidad'` a mano y escriba por
// qué.
//
// ─── El delta guarda REFERENCIAS, no copias, y eso es un contrato ───────────
//
// Un delta se queda con el valor que le pasaron, tal cual. No lo clona: clonarlo
// sería `structuredClone`, o sea el impuesto que este archivo existe para no
// pagar. La consecuencia hay que decirla completa, porque es una trampa real y
// se descubrió probándola:
//
//   **una ranura que entró a un delta no se puede mutar nunca más.**
//
// Si se muta, el delta VIEJO cambia con ella y la historia se reescribe sola: se
// guardó `calor: 1` y al restaurar aparece `calor: 2`, sin que nadie haya
// guardado nada. `'hash'` no salva de esto —protege la DETECCIÓN de cambios, no
// el contenido de lo ya guardado—; lo único que salva es que el mundo sea de
// copia-al-escribir, que es como está escrito el mundo.
//
// Lo que sí hace el hash de cada delta es que la trampa se caiga RUIDOSAMENTE:
// al restaurar un eslabón viejo, el hash guardado no coincide con el estado que
// sale y se lanza ahí. Hay un test que muta a propósito y verifica que salte.
//
// ─── El hash de cada delta ──────────────────────────────────────────────────
//
// Cada delta lleva el hash del estado COMPLETO que queda después de aplicarlo.
// No es adorno: es lo que convierte a «restaurar a mitad reproduce el final
// exacto» de una esperanza en una verificación. Al restaurar, se recalcula y se
// compara; si no da, se lanza ahí mismo, con el índice del delta que rompió.
// Sin eso, una cadena corrupta se descubre 3000 ticks después como una
// divergencia de replay sin causa visible.
//
// ─── Lo que cuesta, MEDIDO ──────────────────────────────────────────────────
//
// Un `take()` sobre 5000 ranuras con 50 cambiadas, en Node 24:
//
//   modo 'hash'        18.6 ms      dos recorridos: el de cada ranura y el total
//   modo 'identidad'    7.7 ms      uno solo, el del hash total del delta
//
// Los dos están MUY por encima de los 4 ms del tick, y los dos están bien: un
// snapshot no cae dentro del tick. Cae en el worker de fondo, cada N ticks, y
// nadie lo espera. Lo que el número dice es lo otro: que la diferencia entre los
// dos modos son 11 ms cada N ticks, o sea que elegir `'identidad'` para ahorrar
// eso es cambiar 11 ms fuera del camino crítico por la posibilidad de perder la
// partida en silencio. Por eso el default es el caro.
//
// Los dos recorridos del modo 'hash' se podrían fusionar guardando los bytes
// canónicos de cada ranura en vez del hash, pero eso es guardar el mundo
// serializado entero —el impuesto de vuelta— así que no se hace.
//
// Determinismo: acá no hay `Date`, `Math.random`, `performance` ni `Math`
// trascendente. El tick lo pone quien llama; el orden de las claves se ORDENA,
// nunca se hereda del `Map`.

import { hashWorld } from './hash.js'
import type { WorldHash } from './hash.js'

/**
 * El mundo visto como ranuras. Es todo lo que el snapshot necesita saber.
 *
 * La clave es texto y el orden del `Map` NO importa: todo lo que sale de acá
 * —deltas y hashes— se ordena por clave antes de tocar nada.
 */
export type Slots<V> = ReadonlyMap<string, V>

/** Un par de una ranura escrita, siempre en tuplas y no en objeto, para que un
 *  delta guardado en JSON vuelva idéntico sin tabla de campos. */
export type SlotPair<V> = readonly [key: string, value: V]

/**
 * Un eslabón de la cadena de guardado.
 *
 * El de índice 0 es la BASE: `set` trae todas las ranuras y `del` está vacío.
 * Los demás son deltas contra el anterior. Restaurar el índice k es aplicar 0..k
 * en orden — por eso la cadena es una lista y no un conjunto.
 */
export interface SnapshotDelta<V> {
  /** Posición en la cadena. 0 es la base. */
  readonly index: number
  /**
   * El tick al COMIENZO del cual vale este estado, o sea el próximo que hay que
   * correr. Un snapshot con `tick: 41` restaura un mundo al que ya le corrieron
   * los ticks 0..40 y le falta el 41. La misma convención que usa `replay` en
   * `journal.ts`, para que restaurar y seguir sea `replay(j, { tick: d.tick, … })`
   * sin sumar ni restar uno — que es de donde salen los errores de un tick, y un
   * tick de corrimiento es una divergencia de hash igual que mil.
   */
  readonly tick: number
  /** Ranuras escritas o cambiadas, ORDENADAS por clave. */
  readonly set: readonly SlotPair<V>[]
  /** Ranuras borradas, ORDENADAS. */
  readonly del: readonly string[]
  /** El hash del estado completo DESPUÉS de aplicar este delta. */
  readonly hash: WorldHash
}

export type SnapshotCompare = 'hash' | 'identidad'

export interface SnapshotOptions {
  /** Ver el comentario de arriba. El default `'hash'` es el que no puede perder
   *  datos en silencio. */
  readonly compare?: SnapshotCompare
}

export interface SnapshotChain<V> {
  /**
   * Toma un eslabón contra el estado anterior. El primero sale base.
   *
   * `slots` NO se guarda por referencia: se copia lo que hace falta para poder
   * diferenciar contra el próximo. Si se guardara la referencia, un mundo mutable
   * haría que el «anterior» cambie solo y el delta siguiente saliera vacío.
   */
  take(tick: number, slots: Slots<V>): SnapshotDelta<V>
  readonly deltas: readonly SnapshotDelta<V>[]
  /** Restaura el estado del eslabón `index` (por defecto, el último). */
  restore(index?: number): Map<string, V>
}

/** Orden por unidad de código UTF-16, igual que en `hash.ts`. Nada de
 *  `localeCompare`: el orden de las claves de un delta es parte del dato que se
 *  guarda, y no puede depender del idioma del sistema del jugador. */
function compareKeys(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0
}

/**
 * El hash de un estado dado como ranuras.
 *
 * Es `hashWorld` del `Map`, y `hashWorld` ya ordena las claves de un `Map` de
 * texto. Existe como función con nombre para que quien restaure y quien guarde
 * estén obligados a usar LA MISMA cuenta: si cada lado escribiera su propia
 * versión, la primera vez que una de las dos cambie, la cadena entera se
 * invalida sin que nadie haya tocado el mundo.
 */
export function hashSlots<V>(slots: Slots<V>): WorldHash {
  return hashWorld(slots)
}

export function createSnapshotChain<V>(options: SnapshotOptions = {}): SnapshotChain<V> {
  const compare: SnapshotCompare = options.compare ?? 'hash'
  const deltas: SnapshotDelta<V>[] = []

  // El estado anterior, tal como quedó. En modo 'hash' además se guarda el hash
  // de cada ranura, que es lo único que hace falta comparar y evita rehashear
  // las 5000 ranuras viejas en cada guardado: se rehashean solo las de ahora.
  let prev = new Map<string, V>()
  let prevHashes = new Map<string, WorldHash>()

  function take(tick: number, slots: Slots<V>): SnapshotDelta<V> {
    if (!Number.isInteger(tick) || tick < 0) {
      throw new RangeError(`tick de snapshot inválido: ${String(tick)}`)
    }

    const set: SlotPair<V>[] = []
    const del: string[] = []
    const hashes = compare === 'hash' ? new Map<string, WorldHash>() : prevHashes

    const keys = [...slots.keys()].sort(compareKeys)
    for (const k of keys) {
      const val = slots.get(k) as V
      if (compare === 'hash') {
        const h = hashWorld(val)
        hashes.set(k, h)
        if (prevHashes.get(k) !== h) set.push([k, val])
      } else if (!prev.has(k) || prev.get(k) !== val) {
        set.push([k, val])
      }
    }

    for (const k of prev.keys()) if (!slots.has(k)) del.push(k)
    del.sort(compareKeys)

    // La copia del estado anterior se arma a partir de `slots`, no se muta la
    // vieja: así el delta que se acaba de devolver sigue describiendo el salto
    // entre dos fotos y no entre una foto y algo que se siguió moviendo.
    prev = new Map(slots)
    if (compare === 'hash') prevHashes = hashes

    const delta: SnapshotDelta<V> = {
      index: deltas.length,
      tick,
      set,
      del,
      hash: hashSlots(slots),
    }
    deltas.push(delta)
    return delta
  }

  return {
    take,
    get deltas() {
      return deltas
    },
    restore(index?: number) {
      return restoreAt(deltas, index ?? deltas.length - 1)
    },
  }
}

export interface RestoreOptions {
  /** Verificar el hash del estado restaurado contra el que trae el delta.
   *  Default `true`: la verificación es la razón por la que el hash está ahí. */
  readonly verificar?: boolean
}

/**
 * Reconstruye el estado del eslabón `hasta` aplicando la cadena desde la base.
 *
 * Es PURA: no toca la cadena, no depende de quién la haya creado y funciona
 * sobre deltas que vinieron de un archivo. Ésa es la mitad del valor — el
 * `SnapshotChain` vive en el worker que guarda, y quien restaura suele ser otro
 * proceso, otra pestaña o el juez.
 */
export function restoreAt<V>(
  deltas: readonly SnapshotDelta<V>[],
  hasta: number,
  options: RestoreOptions = {},
): Map<string, V> {
  if (deltas.length === 0) throw new RangeError('cadena de snapshots vacía')
  if (!Number.isInteger(hasta) || hasta < 0 || hasta >= deltas.length) {
    throw new RangeError(`eslabón ${String(hasta)} fuera de la cadena de ${deltas.length}`)
  }

  const state = new Map<string, V>()
  for (let i = 0; i <= hasta; i++) {
    const d = deltas[i] as SnapshotDelta<V>
    // El índice se verifica en vez de confiarse: una cadena que llegó de un
    // archivo puede venir con un eslabón de menos, y un delta aplicado sobre el
    // estado equivocado produce un mundo COHERENTE y falso, que es peor que uno
    // roto porque no se nota.
    if (d.index !== i) throw new RangeError(`la cadena está desordenada: eslabón ${i} dice ser ${d.index}`)
    if (i === 0 && d.del.length > 0) throw new RangeError('el eslabón base no puede borrar ranuras')
    for (const k of d.del) state.delete(k)
    for (const [k, v] of d.set) state.set(k, v)
  }

  if (options.verificar !== false) {
    const h = hashSlots(state)
    const esperado = (deltas[hasta] as SnapshotDelta<V>).hash
    if (h !== esperado) {
      throw new Error(`snapshot corrupto en el eslabón ${hasta}: esperaba ${esperado} y dio ${h}`)
    }
  }

  return state
}

/**
 * Aplasta la cadena hasta `hasta` en una sola base equivalente.
 *
 * Para qué: la cadena crece con la partida, y restaurar cuesta recorrerla
 * entera. Cada tanto —al cerrar la pestaña, al heredar— se aplasta y la partida
 * vieja se puede tirar. El estado que devuelve es idéntico al de `restoreAt`, y
 * eso está clavado con un test: si aplastar cambiara aunque sea una ranura, el
 * legado empezaría a mentir justo en la transición entre dos vidas.
 */
export function compact<V>(deltas: readonly SnapshotDelta<V>[], hasta?: number): SnapshotDelta<V> {
  const fin = hasta ?? deltas.length - 1
  const state = restoreAt(deltas, fin)
  const keys = [...state.keys()].sort(compareKeys)
  return {
    index: 0,
    tick: (deltas[fin] as SnapshotDelta<V>).tick,
    set: keys.map((k) => [k, state.get(k) as V] as SlotPair<V>),
    del: [],
    hash: (deltas[fin] as SnapshotDelta<V>).hash,
  }
}
