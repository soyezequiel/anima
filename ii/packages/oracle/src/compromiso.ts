// ─── @anima/oracle/compromiso.ts ─────────────────────────────────────────────
//
// LA GRANULARIDAD DEL COMPROMISO: QUÉ COSA es la que se decide.
//
// El ledger sabe sostener una respuesta. Este archivo contesta la pregunta de
// antes: ¿de qué se está hablando cuando el dios dice «acá hay mojarras»?
//
// No de una celda. **No puede haber pescado en un tile y ninguno en el de al
// lado.** El stock es de la POBLACIÓN, no del agua: si la unidad de decisión
// fuera la celda, el jugador vería un río a rayas —muerde acá, no muerde un paso
// más allá— y la ficción se cae en el primer minuto. La unidad es la COMPONENTE
// CONEXA de celdas mojadas, y eso pide un union-find.
//
// ─── El caso difícil: la fusión de dos lagos ────────────────────────────────
//
// El mapa se resuelve al caminar, así que dos charcos que hoy son dos cuerpos
// mañana pueden ser uno solo, cuando se resuelva el chunk que los une. Y ahí hay
// tres casos, no uno:
//
//   NINGUNO tiene testigo → nadie los vio, no hay nada que contradecir. Se
//   fusionan en uno solo, con el id canónico (la celda menor), y la respuesta
//   del perdedor se DESCARTA. No se muda: la respuesta de la ley es función de
//   la clave, así que mudarla haría que dos partidas con distinto orden de
//   exploración terminaran con respuestas distintas para la misma clave. Se
//   descarta y se re-pregunta; es gratis, porque es perezoso.
//
//   UNO tiene testigo → el fusionado HEREDA su id y su respuesta, aunque su
//   ancla no sea la menor. El testigo congela el id. El otro se reescribe:
//   nadie lo vio, no hay contradicción posible.
//
//   LOS DOS tienen testigo → siguen siendo **DOS STOCKS LÓGICOS COMPARTIENDO
//   AGUA**. Y esto no es una concesión técnica para no romper el invariante: es
//   lo que pasa. Una población no se mezcla instantáneamente porque se juntaron
//   los charcos. Los peces de allá siguen siendo los peces de allá hasta que
//   nadan, y eso lleva tiempo que el juego puede simular después.
//
// ─── Por qué el id es la celda menor, y por qué eso alcanza ─────────────────
//
// El id tiene que ser función del CONJUNTO de celdas y no de la historia: si
// dependiera de cuál se resolvió primero, dos jugadores con la misma semilla
// tendrían claves distintas para el mismo lago y el ledger de uno no serviría
// para el otro. Por eso un cuerpo SIN testigo lleva siempre como id su celda
// canónicamente menor, y se rebautiza si crece hacia una menor —usando el mismo
// argumento que la fusión: nadie lo vio, se puede reescribir—. Un cuerpo CON
// testigo congela su id para siempre, que es lo que «se establece» quiere decir.

import { Ledger, InvariantError, textFingerprint, waterBodyKey, type Grain } from './ledger.js'
import type { WaterBodyId } from './pregunta.js'

/** Una celda mojada. Coordenadas enteras absolutas, no relativas al chunk. */
export interface WaterCell {
  readonly x: number
  readonly y: number
}

/** Una región hidrológica: el agua físicamente conexa. Se nombra con el id
 *  canónicamente menor de los cuerpos lógicos que la comparten. */
export type RegionId = WaterBodyId

/**
 * La clave de texto de una celda. Coma y no dos puntos a propósito: `:` y `|`
 * son los separadores de las claves del dios (`pregunta.ts` los prohíbe adentro
 * de un id), y un id de cuerpo de agua ES una clave de celda.
 */
export function waterCellKey(x: number, y: number): string {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new RangeError(`celda de agua no entera: (${String(x)}, ${String(y)})`)
  }
  return `${String(x)},${String(y)}`
}

/** La vuelta. `Number` sobre un entero en texto es exacto y no depende del locale. */
export function parseWaterCellKey(key: string): WaterCell {
  const i = key.indexOf(',')
  if (i < 0) throw new RangeError(`no es clave de celda: ${key}`)
  return { x: Number(key.slice(0, i)), y: Number(key.slice(i + 1)) }
}

/**
 * El orden canónico de las celdas: por fila y después por columna, como se lee
 * un mapa. Numérico y nunca por texto: por texto, «-3» iría antes que «10» y el
 * orden dependería de cómo se escribieron los números.
 */
export function compareCells(a: WaterCell, b: WaterCell): number {
  return a.y !== b.y ? a.y - b.y : a.x - b.x
}

/** Lo que se ve de un cuerpo de agua desde afuera. Copia, no vista mutable. */
export interface WaterBody {
  readonly id: WaterBodyId
  /** La celda canónicamente menor. Para un cuerpo sin testigo, ES el id. */
  readonly anchor: WaterCell
  readonly cells: readonly WaterCell[]
  readonly witnessed: boolean
  /** La región hidrológica que ocupa. Distinta del id sólo después de una
   *  fusión de dos cuerpos que los dos tenían testigo. */
  readonly region: RegionId
}

interface MutableBody {
  id: WaterBodyId
  anchor: WaterCell
  readonly cells: Set<string>
}

/**
 * El agua del mundo, en componentes conexas, con el compromiso del ledger
 * adentro.
 *
 * No es un union-find clásico sobre celdas y hay una razón: un union-find puro
 * no puede representar el tercer caso de la fusión —dos poblaciones compartiendo
 * agua— porque su invariante es que una componente es un conjunto. Acá hay dos
 * capas: los CUERPOS LÓGICOS (cada celda pertenece a exactamente uno, y ésa es
 * la parte union-find) y las REGIONES hidrológicas (uno o más cuerpos lógicos
 * que se tocan). Mientras nadie mire de cerca, las dos capas coinciden y esto se
 * comporta exactamente como el union-find del documento; la segunda capa
 * aparece sólo cuando el mundo ya se comprometió dos veces.
 */
export class WaterBodies {
  readonly #ledger: Ledger
  /** celda → cuerpo lógico que la gobierna. */
  readonly #ownerOf = new Map<string, WaterBodyId>()
  readonly #bodies = new Map<WaterBodyId, MutableBody>()
  /** cuerpo lógico → región hidrológica. */
  readonly #regionOfBody = new Map<WaterBodyId, RegionId>()
  /** región → los cuerpos lógicos que comparten esa agua. */
  readonly #members = new Map<RegionId, Set<WaterBodyId>>()

  constructor(ledger: Ledger) {
    this.#ledger = ledger
  }

  // ─── Resolver agua ────────────────────────────────────────────────────────

  /**
   * Declara que hay agua en una celda, y devuelve el cuerpo que la gobierna.
   *
   * Idempotente: declarar dos veces la misma celda no cambia nada, que es lo que
   * hace seguro re-resolver un chunk.
   *
   * Vecindad de 4 y no de 8. Dos lagunas que se tocan sólo en una esquina no son
   * una laguna: por esa esquina no pasa el agua, y si las uniéramos el jugador
   * vería un stock compartido entre dos charcos que no se comunican.
   */
  addWater(x: number, y: number): WaterBodyId {
    const key = waterCellKey(x, y)
    const already = this.#ownerOf.get(key)
    if (already !== undefined) return already

    const cell: WaterCell = { x, y }
    const neighbours = this.#neighbourBodies(x, y)
    if (neighbours.length === 0) return this.#mint(cell)

    // La celda nueva entra en el vecino canónicamente menor. Cualquier regla
    // determinista serviría; ésta además es estable ante el orden en que se
    // miren los vecinos, que es lo único que hace falta.
    const host = neighbours[0] as WaterBodyId
    this.#attach(host, cell)
    let surviving = host
    for (let i = 1; i < neighbours.length; i++) {
      surviving = this.#merge(surviving, neighbours[i] as WaterBodyId)
    }
    this.#normalize(surviving)
    return this.#ownerOf.get(key) as WaterBodyId
  }

  /**
   * Un puñado de celdas de una vez —lo que devuelve resolver un chunk—. Las
   * ordena antes de agregarlas: el resultado no depende del orden (ver el test
   * de exploración en dos órdenes), pero la NARRATIVA sí, y un log reproducible
   * vale lo que cuesta ordenar.
   */
  addWaters(cells: Iterable<WaterCell>): void {
    for (const c of [...cells].sort(compareCells)) this.addWater(c.x, c.y)
  }

  // ─── Preguntar y mirar ────────────────────────────────────────────────────

  /**
   * Qué dice el dios de este cuerpo de agua. Grano FINO: preguntar no compromete
   * hasta que alguien interactúe, y ahí está la ventana del oráculo.
   */
  ask<T>(id: WaterBodyId, byLaw: () => T): T {
    return this.#ledger.ask({ k: 'waterBody', id }, byLaw)
  }

  /**
   * Alguien miró. `grain` es cuán de cerca: de lejos (`gruesa`) se ve el agua
   * pero no la especie, así que **no sella** y devuelve `false`. Sólo meter la
   * mano (`fina`) congela el hecho y con él el id del cuerpo.
   */
  witness(id: WaterBodyId, grain: Grain): boolean {
    return this.#ledger.witness(waterBodyKey(id), grain)
  }

  // ─── Leer ─────────────────────────────────────────────────────────────────

  bodyAt(x: number, y: number): WaterBodyId | null {
    return this.#ownerOf.get(waterCellKey(x, y)) ?? null
  }

  body(id: WaterBodyId): WaterBody | null {
    const b = this.#bodies.get(id)
    return b === undefined ? null : this.#view(b)
  }

  /** Todos los cuerpos, en orden canónico. Es lo que se compara entre partidas. */
  bodies(): readonly WaterBody[] {
    return [...this.#bodies.values()].sort(compareBodies).map((b) => this.#view(b))
  }

  regionOf(id: WaterBodyId): RegionId | null {
    return this.#regionOfBody.get(id) ?? null
  }

  /**
   * Los cuerpos lógicos que comparten esta agua, en orden canónico. Devuelve más
   * de uno exactamente cuando dos poblaciones con testigo se juntaron: son dos
   * stocks, y la interfaz tiene que poder decirlo.
   */
  populationsOf(id: WaterBodyId): readonly WaterBodyId[] {
    const region = this.#regionOfBody.get(id)
    if (region === undefined) return []
    const members = this.#members.get(region)
    if (members === undefined) return []
    return [...members].sort((a, b) => this.#compareIds(a, b))
  }

  /**
   * La huella del agua: ids, testigos, regiones y celdas. Sin ticks y sin orden
   * de llegada — es lo que tiene que dar igual cuando el mismo mundo se explora
   * en dos órdenes distintos.
   */
  fingerprint(): string {
    const text = this.bodies()
      .map(
        (b) =>
          `${b.id}|${b.witnessed ? '1' : '0'}|${b.region}|${b.cells.map((c) => waterCellKey(c.x, c.y)).join(' ')}`,
      )
      .join('\n')
    return textFingerprint(text)
  }

  // ─── Adentro ──────────────────────────────────────────────────────────────

  #view(b: MutableBody): WaterBody {
    return {
      id: b.id,
      anchor: b.anchor,
      cells: [...b.cells].map(parseWaterCellKey).sort(compareCells),
      witnessed: this.#frozen(b.id),
      region: this.#regionOfBody.get(b.id) ?? b.id,
    }
  }

  /** Un cuerpo con testigo tiene el id congelado: eso es «se establece». */
  #frozen(id: WaterBodyId): boolean {
    return this.#ledger.hasWitness(waterBodyKey(id))
  }

  #compareIds(a: WaterBodyId, b: WaterBodyId): number {
    const ba = this.#bodies.get(a)
    const bb = this.#bodies.get(b)
    if (ba !== undefined && bb !== undefined) return compareBodies(ba, bb)
    return a < b ? -1 : a > b ? 1 : 0
  }

  #neighbourBodies(x: number, y: number): readonly WaterBodyId[] {
    const found: WaterBodyId[] = []
    for (const [dx, dy] of NEIGHBOURS) {
      const id = this.#ownerOf.get(waterCellKey(x + dx, y + dy))
      if (id !== undefined && !found.includes(id)) found.push(id)
    }
    return found.sort((a, b) => this.#compareIds(a, b))
  }

  #mint(cell: WaterCell): WaterBodyId {
    const id = waterCellKey(cell.x, cell.y)
    this.#bodies.set(id, { id, anchor: cell, cells: new Set([id]) })
    this.#ownerOf.set(id, id)
    this.#regionOfBody.set(id, id)
    this.#members.set(id, new Set([id]))
    return id
  }

  #anchorOf(id: WaterBodyId): WaterCell {
    return (this.#bodies.get(id) as MutableBody).anchor
  }

  #attach(id: WaterBodyId, cell: WaterCell): void {
    const b = this.#bodies.get(id) as MutableBody
    b.cells.add(waterCellKey(cell.x, cell.y))
    this.#ownerOf.set(waterCellKey(cell.x, cell.y), id)
    if (compareCells(cell, b.anchor) < 0) b.anchor = cell
  }

  /**
   * Los tres casos de la fusión, que es el corazón de este archivo. Devuelve el
   * cuerpo que sobrevive gobernando las celdas de `a`.
   */
  #merge(a: WaterBodyId, b: WaterBodyId): WaterBodyId {
    if (a === b) return a
    // El agua se junta siempre: la hidrología no pregunta quién miró.
    this.#mergeRegions(a, b)

    const wa = this.#frozen(a)
    const wb = this.#frozen(b)
    // Los dos con testigo: dos stocks lógicos compartiendo agua. Nadie absorbe a
    // nadie y ninguna de las dos respuestas se toca.
    if (wa && wb) return a

    let winner: WaterBodyId
    let loser: WaterBodyId
    if (wa || wb) {
      // El testigo manda sobre la canonicidad: el id que alguien vio no se
      // toca, aunque el ancla del fusionado termine siendo la del otro.
      winner = wa ? a : b
      loser = wa ? b : a
    } else {
      // Ninguno tiene testigo: gana el ancla canónicamente menor. Como un cuerpo
      // sin testigo tiene por id su celda menor, el ganador es —y esto es lo que
      // hace que el resultado no dependa del orden de exploración— el que ya
      // tiene el id que le va a corresponder al fusionado.
      const first = compareCells(this.#anchorOf(a), this.#anchorOf(b)) <= 0
      winner = first ? a : b
      loser = first ? b : a
    }

    this.#absorb(winner, loser)
    return winner
  }

  #absorb(winner: WaterBodyId, loser: WaterBodyId): void {
    // Cinturón: por construcción el perdedor nunca tiene testigo. Si alguna vez
    // lo tuviera, borrarlo sería el dios desdiciéndose de algo que alguien vio,
    // y eso no se degrada: se rompe acá y con nombre.
    if (this.#frozen(loser)) throw new InvariantError({ k: 'testigo-borrado', key: waterBodyKey(loser) })

    const w = this.#bodies.get(winner) as MutableBody
    const l = this.#bodies.get(loser) as MutableBody
    this.#ledger.discard(
      waterBodyKey(loser),
      `los charcos se juntaron y a éste no lo había visto nadie: pasa a ser ${winner}`,
    )
    for (const c of l.cells) {
      w.cells.add(c)
      this.#ownerOf.set(c, winner)
    }
    if (compareCells(l.anchor, w.anchor) < 0) w.anchor = l.anchor
    this.#bodies.delete(loser)
    this.#dropFromRegion(loser)
  }

  /**
   * Le devuelve a un cuerpo sin testigo el id que le corresponde por su celda
   * menor. Es la misma regla de la fusión aplicada al crecimiento: si nadie lo
   * vio, se puede reescribir, y la respuesta vieja se descarta para que la ley
   * la vuelva a dar bajo la clave nueva.
   */
  #normalize(id: WaterBodyId): WaterBodyId {
    const b = this.#bodies.get(id)
    if (b === undefined || this.#frozen(id)) return id
    const should = waterCellKey(b.anchor.x, b.anchor.y)
    if (should === id) return id

    this.#ledger.discard(waterBodyKey(id), `creció hasta una celda menor y nadie lo había visto: pasa a ser ${should}`)
    this.#bodies.delete(id)
    b.id = should
    this.#bodies.set(should, b)
    for (const c of b.cells) this.#ownerOf.set(c, should)
    this.#renameInRegion(id, should)
    return should
  }

  // ─── Las regiones hidrológicas ────────────────────────────────────────────

  #mergeRegions(a: WaterBodyId, b: WaterBodyId): void {
    const ra = this.#regionOfBody.get(a) as RegionId
    const rb = this.#regionOfBody.get(b) as RegionId
    if (ra === rb) return
    const merged = new Set([...(this.#members.get(ra) ?? []), ...(this.#members.get(rb) ?? [])])
    this.#members.delete(ra)
    this.#members.delete(rb)
    this.#reseat(merged)
  }

  #dropFromRegion(id: WaterBodyId): void {
    const r = this.#regionOfBody.get(id)
    this.#regionOfBody.delete(id)
    if (r === undefined) return
    const members = this.#members.get(r)
    if (members === undefined) return
    members.delete(id)
    this.#members.delete(r)
    if (members.size > 0) this.#reseat(members)
  }

  #renameInRegion(from: WaterBodyId, to: WaterBodyId): void {
    const r = this.#regionOfBody.get(from)
    this.#regionOfBody.delete(from)
    if (r === undefined) return
    const members = this.#members.get(r)
    if (members === undefined) return
    members.delete(from)
    members.add(to)
    this.#members.delete(r)
    this.#reseat(members)
  }

  /**
   * Le pone a una región el nombre de su miembro canónicamente menor. Se
   * recalcula entero en vez de mantenerse incremental porque una región tiene un
   * miembro casi siempre y dos en el único caso raro: el costo es nada y un
   * nombre derivado no puede quedar viejo.
   */
  #reseat(members: Set<WaterBodyId>): void {
    let name: WaterBodyId | null = null
    for (const m of members) {
      if (name === null || this.#compareIds(m, name) < 0) name = m
    }
    if (name === null) return
    this.#members.set(name, members)
    for (const m of members) this.#regionOfBody.set(m, name)
  }
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
]

function compareBodies(a: MutableBody, b: MutableBody): number {
  const c = compareCells(a.anchor, b.anchor)
  return c !== 0 ? c : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
