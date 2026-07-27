// ─── @anima/perceive/indice.ts ───────────────────────────────────────────────
//
// EL ÍNDICE DE UN TICK. Uno solo, compartido por todas las criaturas vivas.
//
// Es la respuesta a la primera de las tres preguntas que este paquete tenía que
// contestar con un número adelante: **`see(w)` no puede ser O(cuerpos del
// mundo)**. Con 5000 cuerpos y una habilidad que mira diez veces por tick, eso
// es el tick entero — y no por el recorrido sino por lo que hay adentro:
// `qualityOf` no es un `get`, arma la agregación del cuerpo por sus partes.
//
// ─── Las tres opciones, y por qué ganó ésta ─────────────────────────────────
//
//   A. `see()` recorre `state.bodies` en cada llamada. Es lo que hace el
//      mundito. O(cuerpos × llamadas × predicados), y cada evaluación es un
//      `qualityOf`. Medido en `tests/banco-la-vista.test.ts`.
//   B. la `Grid` de `world/src/grid.ts` (`bodiesAt`, `forEachBodyNear`).
//      **DESCARTADA, y no por gusto**: `placeBody` MATERIALIZA el chunk de
//      terreno, o sea que indexar un cuerpo asigna los arreglos de 1024 celdas
//      de su chunk — y el propio encabezado de `grid.ts` dice que leer no
//      materializa justamente porque materializar hace que dos partidas
//      exploradas en distinto orden difieran. Además `WorldState` no tiene una
//      `Grid`: habría que armarla por tick (1,50 ms contra 0,80 del `Map`, ya
//      medido en `world/src/step.ts:IndiceDeCeldas`) o meterla en el estado, que
//      le cambia el hash al mundo entero y es un ADR, no una optimización. Es
//      exactamente el mismo razonamiento por el que `step.ts` no la usa.
//   C. **ésta**: un índice de celda a cuerpos, armado UNA VEZ POR TICK y
//      compartido por todas las criaturas, más un RADIO de percepción. El radio
//      es lo que convierte `see()` en O(radio²) en vez de O(cuerpos), y el
//      índice compartido es lo que hace que el O(cuerpos) del armado se pague
//      una vez y no una por criatura.
//
// ─── Y adentro de (C), la consulta elige el camino barato ───────────────────
//
// Un disco de radio 12 son 625 celdas. En un mundo de 5000 cuerpos, mirar 625
// celdas es más barato que mirar 5000 cuerpos; en un mundo de 20, es veinte
// veces más caro. Así que la consulta compara los dos tamaños y elige — no es
// una heurística con umbral, es la cuenta exacta de cuántas búsquedas hace cada
// camino.
//
// ─── Lo que muere con el tick ───────────────────────────────────────────────
//
// Todo. El índice, el mapa de oclusión y la caché de vistas nacen con el
// `WorldState` de un tick y se tiran con él, que es la mitad de los modos de
// falla de una caché cerrada por construcción: **un índice que no sobrevive al
// tick no puede quedar viejo entre ticks**. Es la misma disciplina que
// `Borrador` en `world/src/step.ts`, y por la misma razón.

import type { Physics } from '@anima/physics'
import { qualityOf, T_AMBIENTE } from '@anima/physics'
import type { BodyId, Cell, CellKey, CellState, WorldBody, WorldState } from '@anima/world'
import { celdaDecretada, CELDA_POR_OMISION, keyOfCell, OCLUSION_CORTA_OXIGENO } from '@anima/world'

/**
 * Hasta dónde ve la criatura, en celdas de Chebyshev.
 *
 * El 12 sale de las quince innatas y de ningún gusto: el barrido más ancho que
 * alguna hace es el disco de radio 6 de `explorar` (para el campo de celda), y
 * el segundo es el anillo de radio 4 de `guarecerse`. Doce es el doble del más
 * ancho, o sea que una habilidad ve una cosa ANTES de caminarle encima, que es
 * lo mínimo para que buscar signifique algo.
 *
 * Y es un techo con consecuencia medida: (2·12+1)² = 625 celdas, contra los 5000
 * cuerpos del mundo del banco. Ver `cuerposCerca`.
 */
export const RADIO_DE_PERCEPCION = 12

/**
 * La oclusión de una celda tapada, y la celda que ven las leyes.
 *
 * **ES UN ESPEJO DE `celdaDe` Y `oclusiones` DE `world/src/step.ts`, que no se
 * exportan.** Copiar una ley de la física es exactamente lo que este repositorio
 * castiga —`DSL_REFERENCE` de Ánima I—, así que la copia no se sostiene con un
 * comentario: `tests/la-vista.test.ts` («los espejos de lo que se copió del
 * mundo») compara celda por celda contra `shelteredDe`, que sí está exportada,
 * sobre mundos al azar. Si el mundo cambia la ley 12, el espejo se rompe en rojo.
 *
 * Por qué hay que copiarla en vez de llamar a `shelteredDe`: esa función llama a
 * `oclusiones`, que recorre TODOS los cuerpos, y la llama UNA VEZ POR CELDA
 * PREGUNTADA. `guarecerse` barre 80 celdas por vuelta, o sea 400.000
 * comparaciones por vuelta en un mundo de 5000 cuerpos. Acá el mapa se arma una
 * vez por tick y la consulta es un `Map.get`.
 */
function armarOclusiones(bodies: ReadonlyMap<BodyId, WorldBody>, phys: Physics): Map<CellKey, number> {
  const productos = new Map<CellKey, number>()
  for (const c of bodies.values()) {
    if (c.covering === undefined) continue
    const k = keyOfCell(c.at)
    const p = qualityOf(c.body, 'permeability', phys)
    const limpio = p < 0 ? 0 : p > 1 ? 1 : p
    productos.set(k, (productos.get(k) ?? 1) * limpio)
  }
  const out = new Map<CellKey, number>()
  for (const [k, prod] of productos) {
    const s = 1 - prod
    out.set(k, s < 0 ? 0 : s > 1 ? 1 : s)
  }
  return out
}

/** Las cuatro cualidades de celda, ya ocluidas. Espejo de `celdaDe`. */
export interface CeldaVista {
  readonly wet: number
  readonly oxygen: number
  readonly temperature: number
  readonly sheltered: number
}

export class IndiceDelTick {
  readonly state: WorldState
  #porCelda: Map<CellKey, BodyId[]> | undefined
  #oclusion: Map<CellKey, number> | undefined
  /**
   * De cuerpo tapado a quién lo tapa. Es el DUAL de `WorldBody.covering`, y el
   * lado que la habilidad necesita («¿ya está tapada la fogata?»). El mundo
   * guarda sólo la dirección de ida.
   */
  #tapadoPor: Map<BodyId, BodyId> | undefined

  constructor(state: WorldState) {
    this.state = state
  }

  /**
   * PEREZOSO, igual que `indiceDeCeldas` del mundo y por la misma razón: un tick
   * donde ninguna habilidad mira no paga la pasada.
   */
  #celdas(): Map<CellKey, BodyId[]> {
    const hay = this.#porCelda
    if (hay !== undefined) return hay
    const m = new Map<CellKey, BodyId[]>()
    // Se recorre `state.bodies` en su orden —que el mundo mantiene canónico por
    // id— así que cada cubeta sale ya ordenada y `see()` devuelve siempre lo
    // mismo sin ordenar nada. Sin esto, dos corridas de la misma habilidad
    // podrían elegir cuerpos distintos y se cae el criterio (d) del Hito 4.
    for (const c of this.state.bodies.values()) {
      const k = keyOfCell(c.at)
      const cubeta = m.get(k)
      if (cubeta === undefined) m.set(k, [c.body.id])
      else cubeta.push(c.body.id)
    }
    this.#porCelda = m
    return m
  }

  #oclusiones(): Map<CellKey, number> {
    const hay = this.#oclusion
    if (hay !== undefined) return hay
    const m = armarOclusiones(this.state.bodies, this.state.phys)
    this.#oclusion = m
    return m
  }

  tapadoPor(id: BodyId): BodyId | undefined {
    let m = this.#tapadoPor
    if (m === undefined) {
      m = new Map<BodyId, BodyId>()
      for (const c of this.state.bodies.values()) {
        if (c.covering !== undefined) m.set(c.covering, c.body.id)
      }
      this.#tapadoPor = m
    }
    return m.get(id)
  }

  /**
   * Los ids que hay a Chebyshev ≤ `radio` del centro, en orden canónico.
   *
   * Los dos caminos dan EXACTAMENTE la misma lista —lo verifica un test— y se
   * elige el que hace menos búsquedas: `(2r+1)²` celdas contra `bodies.size`
   * cuerpos. No hay umbral que calibrar; es la cuenta.
   */
  cuerposCerca(centro: Cell, radio: number): BodyId[] {
    const lado = 2 * radio + 1
    const celdas = lado * lado
    const out: BodyId[] = []
    if (celdas <= this.state.bodies.size) {
      const idx = this.#celdas()
      // Por filas y después por columnas, que es el orden de `cellKey`. Recorrer
      // el disco en otro orden daría la misma lista desordenada.
      for (let y = centro.y - radio; y <= centro.y + radio; y++) {
        for (let x = centro.x - radio; x <= centro.x + radio; x++) {
          const cubeta = idx.get(keyOfCell({ x, y }))
          if (cubeta !== undefined) for (const id of cubeta) out.push(id)
        }
      }
      // El recorrido por celdas sale en orden de celda; el otro camino sale en
      // orden de id. Se ordena por id para que los dos den lo mismo: `see()` no
      // promete orden, pero SÍ tiene que prometer el MISMO orden en dos corridas
      // gemelas, y «depende de cuál de los dos caminos eligió la cuenta» no es
      // eso.
      out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      return out
    }
    for (const c of this.state.bodies.values()) {
      const dx = c.at.x - centro.x
      const dy = c.at.y - centro.y
      const d = Math.max(dx < 0 ? -dx : dx, dy < 0 ? -dy : dy)
      if (d <= radio) out.push(c.body.id)
    }
    return out
  }

  /**
   * LA CELDA DE ABAJO DE TODO, en las mismas TRES capas que `celdaDe` del mundo:
   * lo que el mundo escribió, lo que el dios decretó, y el aire libre.
   *
   * La capa del medio faltaba, y no era un detalle de prolijidad: sin ella una
   * criatura parada ADENTRO del río leía `qAt(at,'wet') === 0`. Medido antes de
   * arreglarlo, sobre la semilla 20260727n: el decreto decía 1 y la vista decía 0,
   * y `recall([{q:'wet',op:'>=',v:0.5}])` devolvía la lista vacía después de
   * caminar por el agua. O sea que **el primer criterio del Hito 5 —«con hambre y
   * un río a la vista»— no se podía ni intentar por acá**: `explorar` busca el
   * agua con `qAt` (es lo que el propio `Ctx` manda: «buscar agua es `qAt` o
   * `recall`, nunca `see`»), y el agua es un campo de celda que sólo existe en el
   * decreto — `WorldState.cells` guarda ÚNICAMENTE lo que el mundo escribió
   * encima, y en una partida recién empezada está vacío.
   *
   * Por qué no lo vio nadie: el espejo que vigila esta función
   * (`tests/la-vista.test.ts`, «los espejos de lo que se copió del mundo»)
   * compara contra `shelteredDe`, que es la única mitad de `celdaDe` que el mundo
   * exporta — y `sheltered` es justamente la que NO pasa por el decreto. Y los
   * ocho archivos de test del paquete arman sus mundos con `cells` escritas a
   * mano y sin `dios`. Un espejo que sólo mira el pedazo que ya estaba no es un
   * espejo.
   *
   * No asigna: `celdaDecretada` devuelve el MISMO objeto para la misma celda
   * mientras la caché de decretos lo tenga, que es la misma razón por la que el
   * mundo la puede llamar una vez por cuerpo y por tick.
   */
  #base(at: Cell, k: CellKey): CellState {
    const propia = this.state.cells.get(k)
    if (propia !== undefined) return propia
    const dios = this.state.dios
    if (dios === undefined) return CELDA_POR_OMISION
    return celdaDecretada(dios, this.state.phys, at.x, at.y)
  }

  /**
   * La celda como la ven las leyes: ocluida.
   *
   * Y no la guardada, que es la decisión: `celdaDe` de `step.ts` le entrega a las
   * leyes 1, 3, 4 y 11 la celda YA OCLUIDA, así que si la criatura leyera la
   * cruda estaría mirando un mundo distinto del que la castiga. Tapar la fogata
   * —la técnica emblema de toda la arquitectura— sería invisible desde adentro:
   * `qAt(at,'oxygen')` seguiría dando 1 mientras la ley 4 hace carbón con 0,2.
   */
  celda(at: Cell): CeldaVista {
    const k = keyOfCell(at)
    const propia: CellState = this.#base(at, k)
    const s = this.#oclusiones().get(k) ?? 0
    if (s === 0) {
      return { wet: propia.wet, oxygen: propia.oxygen, temperature: propia.temperature, sheltered: 0 }
    }
    return {
      wet: propia.wet * (1 - s),
      oxygen: propia.oxygen * (1 - s * OCLUSION_CORTA_OXIGENO),
      temperature: T_AMBIENTE + s * (propia.temperature - T_AMBIENTE),
      sheltered: s,
    }
  }
}
