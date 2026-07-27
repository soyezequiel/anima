// ─── @anima/perceive/lugares.ts ──────────────────────────────────────────────
//
// EL LIBRO DE LUGARES. La reparación del hueco «`recall` sin `remember`».
//
// La superficie tiene `ctx.recall(w): PlaceMemory[]` y **no tiene ninguna forma
// de escribir un `PlaceMemory`**. El mundito lo resolvía con un método fuera de
// `Ctx` (`Mundito.recordar`), o sea que el test se acordaba por la criatura.
//
// ─── La decisión: recordar NO es un acto ────────────────────────────────────
//
// Se podría haber agregado `ctx.remember(...)` a la superficie. No se hizo, y no
// por conservadurismo: **una habilidad que tiene que acordarse de acordarse es
// una habilidad que se va a olvidar**, y el modo de falla es silencioso —
// `recall` devuelve vacío y la criatura vuelve a explorar un lugar que ya
// conoce, sin que nada falle—. Además abriría una tercera sede de estado que
// sobrevive a un guardado, cuando el ejecutor se pasó el Hito 4 diciendo que hay
// UNA (`ctx.memory`).
//
// Acá el libro lo escribe EL RUNTIME, una vez por tick y por criatura, sobre la
// celda en la que está parada: **lo que recordás es dónde estuviste**. No hace
// falta pedirlo y no se puede mentir. Y como lo escribe el bucle, es dato del
// runtime y no del mundo: no entra en `hashWorldState` ni le cambia el hash a
// ninguna partida.
//
// ─── Lo que queda abierto, dicho ────────────────────────────────────────────
//
// No se recuerda lo que se VIO de lejos, sólo lo que se pisó. Un lago visto
// desde diez celdas no entra al libro hasta que la criatura camine hasta él, lo
// cual es un problema real para «volvé al río» y está anotado con su `it.fails`
// en `tests/los-lugares.test.ts`. La reparación pide decidir a qué distancia un
// recuerdo deja de ser confiable, y eso es una perilla de diseño que merece su
// número medido, no una elegida acá.

import type { ActorId, BodyId, CellKey, WorldState } from '@anima/world'
import { cellFromKey, keyOfCell } from '@anima/world'
import type { Cell, CellQuality, PlaceMemory, WhereCell } from '@anima/skills'

import type { Proyeccion } from './vista.js'

/**
 * Cuántas celdas recuerda una criatura.
 *
 * Es un tope y no una estimación: sin él, una partida de 20.000 ticks —el
 * criterio del Hito 5— guarda hasta 20.000 celdas por criatura, y `recall`
 * las recorre todas en cada llamada. Con 512 el barrido es despreciable y
 * alcanza para el radio en el que una criatura trabaja: 512 celdas es un disco
 * de radio 11.
 *
 * Se desaloja la MÁS VIEJA por tick de anotación, no la menos usada: «un
 * recuerdo viejo es una hipótesis» ya está escrito en `PlaceMemory.atTick`, y
 * desalojar por antigüedad es la única política que no depende del orden en que
 * alguien preguntó — o sea la única que no rompe el determinismo.
 */
export const CUANTOS_LUGARES = 512

interface Anotacion {
  readonly at: Cell
  atTick: number
  what: BodyId[]
  q: Record<CellQuality, number>
}

export class LibroDeLugares {
  /** Por actor y por celda. Un `Map` conserva el orden de inserción: es la edad. */
  readonly #porActor = new Map<ActorId, Map<CellKey, Anotacion>>()

  #deActor(a: ActorId): Map<CellKey, Anotacion> {
    let m = this.#porActor.get(a)
    if (m === undefined) {
      m = new Map<CellKey, Anotacion>()
      this.#porActor.set(a, m)
    }
    return m
  }

  /** Cuántas celdas tiene anotadas esta criatura. Para los tests y el banco. */
  cuantos(a: ActorId): number {
    return this.#porActor.get(a)?.size ?? 0
  }

  /**
   * Anota la celda donde está parada la criatura. La llama el bucle, una vez por
   * tick y por criatura viva.
   *
   * Reanotar la misma celda la MUEVE al final del orden de inserción —se borra y
   * se vuelve a poner—, así que la política de desalojo es por última visita y
   * no por primera. Una criatura que vive en su cueva no la olvida por vieja.
   */
  anotar(proy: Proyeccion, a: ActorId, at: Cell): void {
    const m = this.#deActor(a)
    const k = keyOfCell(at)
    const celda = proy.indice.celda(at)
    const what: BodyId[] = []
    // El disco de radio 0 es la celda propia: lo que hay ACÁ. `cuerposCerca` ya
    // devuelve en orden canónico de id, así que la anotación es reproducible.
    for (const id of proy.indice.cuerposCerca(at, 0)) what.push(id)
    m.delete(k)
    m.set(k, {
      at: Object.freeze({ x: at.x, y: at.y }),
      atTick: proy.state.tick,
      what,
      q: { wet: celda.wet, oxygen: celda.oxygen, temperature: celda.temperature, sheltered: celda.sheltered },
    })
    while (m.size > CUANTOS_LUGARES) {
      const viejo = m.keys().next()
      if (viejo.done === true) break
      m.delete(viejo.value)
    }
  }

  /** Los lugares recordados que cumplen un predicado de CELDA, del más nuevo al más viejo. */
  recall(a: ActorId, w: WhereCell): PlaceMemory[] {
    const m = this.#porActor.get(a)
    if (m === undefined) return []
    const out: PlaceMemory[] = []
    for (const an of m.values()) {
      let ok = true
      for (const t of w) {
        const v = an.q[t.q]
        const pasa = t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
        if (!pasa) {
          ok = false
          break
        }
      }
      if (!ok) continue
      const q = an.q
      out.push({
        at: an.at,
        atTick: an.atTick,
        what: an.what,
        q: (id: CellQuality) => q[id],
      })
    }
    // Del más reciente al más viejo: el orden de inserción es el de última
    // visita, así que basta invertirlo. Un recuerdo fresco vale más que uno de
    // hace mil ticks, y quien llama toma `[0]` sin ordenar.
    out.reverse()
    return out
  }

  /** Lo que hay que guardar para que un guardado no pierda la memoria de lugares. */
  volcar(a: ActorId): readonly { at: Cell; atTick: number; what: readonly BodyId[] }[] {
    const m = this.#porActor.get(a)
    if (m === undefined) return []
    return [...m.entries()].map(([k, an]) => ({
      at: cellFromKey(k),
      atTick: an.atTick,
      what: an.what,
    }))
  }
}

/** Para el bucle: la celda donde está parada una criatura, o `undefined`. */
export function dondeEsta(state: WorldState, a: ActorId): Cell | undefined {
  const act = state.actors.get(a)
  if (act === undefined) return undefined
  return state.bodies.get(act.body)?.at
}
