// ─── @anima/oracle/presupuesto.ts ────────────────────────────────────────────
//
// EL TECHO CALÓRICO, COBRADO.
//
// Éste es el agujero de la conservación, y estaba escrito con todas las letras
// en el riesgo 4 del documento de arquitectura:
//
//   «`nutrition` es conservada, pero el oráculo puede sembrar peces. Si el
//    presupuesto calórico por chunk está mal calibrado, la criatura tiene una
//    fuente infinita de comida siempre que pueda caminar hasta el chunk
//    siguiente — y ahí el hambre, que es el motor de toda la historia, deja de
//    doler.»
//
// La mitad de la mitigación ya estaba: `caloricBudget` es una función pura del
// bioma y de la fertilidad, o sea de la SEMILLA, y no la toca ningún sorteo ni
// ninguna propuesta del oráculo. La otra mitad no existía: **nadie leía ese
// número**. Medido antes de este archivo, un pozo de capacidad 12 que se repone
// medio pez por segundo entregaba 1806 peces en una hora de mundo —5490
// calorías contra un techo de 1776, o sea 3,1 veces el techo— sin que nada se
// quejara.
//
// Este archivo es el otro lado del techo: **lo aportado se acumula por chunk y
// se compara**. No es una advertencia ni un log: `cobrar` devuelve `false` y no
// escribe nada cuando lo que se pide no entra, y `draw` no entrega lo que no
// pudo cobrar.
//
// ─── Por qué NO vive adentro del `Ledger` ───────────────────────────────────
//
// Porque el `Ledger` es append-only y su invariante duro es que **escribir una
// respuesta distinta para una clave existente lanza**. Un acumulado es, por
// definición, una respuesta que cambia: meterlo ahí obligaría a exceptuar la
// única regla que hace que el libro sirva de algo.
//
// Lo que sí se copia del ledger, porque es lo que lo hace confiable, es la
// FORMA: un diario append-only de cobros, un mapa vivo de totales, y un
// `verificar()` que rehace los totales replayando el diario y los compara. Dos
// representaciones de lo mismo que se chequean entre sí; el día que un método
// toque una y se olvide de la otra, el invariante lo dice.
//
// ─── Milicalorías enteras, y no calorías reales ─────────────────────────────
//
// El techo es entero por decisión de `caloricBudget` («un techo en punto
// flotante se acumularía con error y el invariante duro dejaría de ser decidible
// en el borde»). Pero lo que sale de un stock son calorías REALES —`nutrition ·
// masa · digestibility` da 3,04 para un pescado de un kilo—, así que la cuenta
// se lleva en milicalorías ENTERAS: la suma de enteros es exacta, y con el techo
// más alto de la tabla (4400 cal = 4,4·10⁶ milicalorías) y un millón de cobros
// no se acerca a 2⁵³ ni de lejos.
//
// El redondeo del costo de un bocado es **hacia arriba**. La dirección importa y
// no es simétrica: redondear hacia abajo afloja el techo un poco en cada cobro,
// y «un poco en cada cobro» es exactamente cómo se fabrica una fuente infinita.
//
// Determinismo: acá no hay `Math.random`, `Date`, `performance`, `Intl`,
// `localeCompare` ni `Math` trascendente. `Math.ceil` sobre un producto de
// dobles está especificado bit a bit en ECMAScript.

import type { Body, Duracion, Fixed, Physics, SubstanceId } from '@anima/physics'
import { qualityOf, unfx } from '@anima/physics'

import { InvariantError, textFingerprint } from './ledger.js'
import { presupuestoCaloricoDeChunk } from './ley.js'
import { keyOf, type Seed } from './pregunta.js'

// ─── La unidad de cuenta ────────────────────────────────────────────────────

/**
 * La escala de la contabilidad calórica. Mil, como la de `Fixed`, y por la misma
 * razón: una milésima de caloría es más fina que cualquier bocado del catálogo
 * (el más flaco es una hoja seca, que no alimenta) y la suma sigue siendo entera.
 */
export const MILICALORIAS_POR_CALORIA = 1000

/**
 * Las calorías de una pieza, en milicalorías enteras, **redondeadas hacia
 * arriba**.
 *
 * La cuenta no está acá: está en la cualidad derivada `calories` de
 * `@anima/physics` (`nutrition · mass · digestibility`), y se la pregunta
 * armando el cuerpo que sería la pieza. Es la MISMA función con la que el mundo
 * va a contestar cuánto rinde ese bocado cuando alguien se lo coma, y ésa es
 * toda la gracia: si mañana cocinar sube la digestibilidad, lo que el chunk paga
 * y lo que la criatura gana se mueven juntos, porque son el mismo número.
 *
 * La forma es `bloque` y da lo mismo cuál sea: `calories` sale de tres cualidades
 * `own` y no toca la geometría. Se elige la más neutra a propósito, para que
 * nadie lea una intención donde no la hay.
 */
export function milicaloriasDe(substance: SubstanceId, masa: Fixed, phys: Physics): number {
  const pieza: Body = {
    id: 'pieza',
    form: 'bloque',
    parts: [{ substance, mass: unfx(masa), q: {} }],
    joints: [],
    state: {},
  }
  const cal = qualityOf(pieza, 'calories', phys)
  if (!Number.isFinite(cal) || cal < 0) {
    throw new RangeError(`calorías imposibles para ${substance}: ${String(cal)}`)
  }
  return Math.ceil(cal * MILICALORIAS_POR_CALORIA)
}

// ─── Un cobro ───────────────────────────────────────────────────────────────

/**
 * Lo que un chunk entregó una vez. Es a la vez contabilidad y narrativa: «este
 * pozo dio doce peces de dos kilos entre el segundo 40 y el 300» se lee de acá.
 */
export interface Cobro {
  readonly cx: number
  readonly cy: number
  /** Qué salió. */
  readonly substance: SubstanceId
  /** Con qué masa, en `Fixed`. */
  readonly masa: Fixed
  /** Cuánto le costó al chunk, en milicalorías enteras. */
  readonly milicalorias: number
  /** El segundo de MUNDO en que se cobró (ADR II-0008). */
  readonly at: Duracion
}

/** El estado vivo de un chunk que ya entregó algo. */
export interface EstadoDeChunk {
  readonly cx: number
  readonly cy: number
  readonly aportado: number
  readonly techo: number
}

// ─── El libro ───────────────────────────────────────────────────────────────

/**
 * EL LIBRO CALÓRICO: cuánto entregó cada chunk, contra cuánto puede entregar.
 *
 * El techo es una función pura de la semilla y no se guarda en ningún lado que
 * alguien pueda escribir: se calcula, se memoiza, y la memoización no se puede
 * equivocar porque la función no tiene estado. Lo único que este libro guarda de
 * verdad es lo APORTADO, que sí es historia.
 *
 * ─── Lo que hay que guardar con la partida ──────────────────────────────────
 *
 * Los cobros. Sin ellos, cargar un guardado le devuelve a cada chunk su techo
 * entero y la criatura vuelve a comerse el mismo río — la fuente infinita otra
 * vez, por la puerta de atrás del guardado. Por eso el constructor los acepta y
 * `cobros()` los entrega: es el estado que viaja.
 */
export class LibroCalorico {
  readonly #seed: Seed
  readonly #aportado = new Map<string, number>()
  readonly #techos = new Map<string, number>()
  readonly #log: Cobro[] = []

  constructor(seed: Seed, previos: readonly Cobro[] = []) {
    this.#seed = seed
    for (const c of previos) {
      if (!this.cobrar(c)) {
        throw new InvariantError({
          k: 'techo-calorico',
          chunk: keyOf({ k: 'chunk', cx: c.cx, cy: c.cy }),
          techo: this.techo(c.cx, c.cy),
          aportado: this.aportado(c.cx, c.cy) + c.milicalorias,
        })
      }
    }
  }

  /**
   * EL TECHO, en milicalorías. Función pura de la semilla y de la coordenada:
   * ningún sorteo, ninguna historia y ninguna propuesta del oráculo lo mueven.
   */
  techo(cx: number, cy: number): number {
    const key = keyOf({ k: 'chunk', cx, cy })
    let v = this.#techos.get(key)
    if (v === undefined) {
      v = presupuestoCaloricoDeChunk(this.#seed, cx, cy) * MILICALORIAS_POR_CALORIA
      this.#techos.set(key, v)
    }
    return v
  }

  /** Lo que este chunk ya entregó, en milicalorías. */
  aportado(cx: number, cy: number): number {
    return this.#aportado.get(keyOf({ k: 'chunk', cx, cy })) ?? 0
  }

  /** Lo que le queda por entregar, jamás negativo. */
  disponible(cx: number, cy: number): number {
    const resto = this.techo(cx, cy) - this.aportado(cx, cy)
    return resto > 0 ? resto : 0
  }

  /**
   * ¿Entra este bocado entero?
   *
   * Entero y no a medias: un cobro parcial sería un pescado más flaco que el que
   * el stock dice tener, o sea el dios entregando una cosa y anotando otra. Lo
   * que no entra, no sale — y el chunk queda con un resto que nadie puede gastar,
   * que es lo correcto: un lugar exprimido no da medio pez.
   */
  alcanza(cx: number, cy: number, milicalorias: number): boolean {
    return validarMilicalorias(milicalorias) <= this.disponible(cx, cy)
  }

  /**
   * COBRAR. Devuelve `false` y **no escribe nada** si no entra.
   *
   * Un cobro de cero milicalorías —arcilla, piedra, cualquier cosa que no
   * alimente— entra siempre y deja renglón igual: el techo es CALÓRICO, así que
   * sacar barro de un pozo no compite con la comida, pero que salió del pozo es
   * un hecho del mundo y la crónica lo quiere.
   */
  cobrar(c: Cobro): boolean {
    const key = keyOf({ k: 'chunk', cx: c.cx, cy: c.cy })
    const pedido = validarMilicalorias(c.milicalorias)
    const aportado = this.#aportado.get(key) ?? 0
    if (aportado + pedido > this.techo(c.cx, c.cy)) return false
    this.#aportado.set(key, aportado + pedido)
    this.#log.push(c)
    return true
  }

  /** El diario entero, append-only, en el orden en que pasó. Es narrativa y es
   *  la prueba: `verificar()` lo replaya. */
  cobros(): readonly Cobro[] {
    return this.#log
  }

  /** El estado vivo, en orden canónico de clave: lo que hay que comparar entre
   *  dos partidas. El diario depende de la historia; esto no. */
  chunks(): readonly EstadoDeChunk[] {
    return [...this.#aportado.keys()]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((key) => {
        const { cx, cy } = coordsDeClave(key)
        return { cx, cy, aportado: this.#aportado.get(key) ?? 0, techo: this.techo(cx, cy) }
      })
  }

  /** La huella del libro, sin el diario: dos partidas que llegaron al mismo
   *  reparto por caminos distintos tienen que dar lo mismo. */
  fingerprint(): string {
    return textFingerprint(
      this.chunks()
        .map((c) => `${String(c.cx)}:${String(c.cy)}|${String(c.aportado)}|${String(c.techo)}`)
        .join('\n'),
    )
  }

  /**
   * EL INVARIANTE, verificado de punta a punta. Pensado para correrse una vez
   * por tick, igual que `Ledger.verify()` y que los invariantes de
   * `@anima/world`.
   *
   * Rehace los totales replayando el diario y los compara contra el mapa vivo, y
   * después chequea lo único que importa de verdad: **ningún chunk aportó más de
   * su techo**. Que sea un replay y no una relectura del mapa es el punto: si
   * alguien sumara al mapa sin dejar renglón —o dejara renglón sin sumar— esto
   * lo dice, y sin esto nadie se enteraría nunca.
   */
  verificar(): void {
    const rehecho = new Map<string, number>()
    for (const c of this.#log) {
      const key = keyOf({ k: 'chunk', cx: c.cx, cy: c.cy })
      rehecho.set(key, (rehecho.get(key) ?? 0) + validarMilicalorias(c.milicalorias))
    }
    for (const [key, total] of rehecho) {
      const vivo = this.#aportado.get(key)
      if (vivo === undefined || vivo !== total) {
        throw new InvariantError({ k: 'estado-fuera-del-log', key, por: 'el total vivo no es el del diario' })
      }
    }
    for (const [key, vivo] of this.#aportado) {
      if (!rehecho.has(key)) {
        throw new InvariantError({ k: 'estado-fuera-del-log', key, por: 'el estado lo tiene y el diario no' })
      }
      const { cx, cy } = coordsDeClave(key)
      const techo = this.techo(cx, cy)
      if (vivo > techo) throw new InvariantError({ k: 'techo-calorico', chunk: key, techo, aportado: vivo })
    }
  }
}

// ─── Adentro ────────────────────────────────────────────────────────────────

function validarMilicalorias(v: number): number {
  if (!Number.isInteger(v) || v < 0) {
    throw new RangeError(`milicalorías inválidas: ${String(v)} (un entero >= 0)`)
  }
  return v
}

/** La vuelta de `keyOf({k:'chunk',...})`: `c:cx:cy`. Está acá y no en
 *  `pregunta.ts` porque es un detalle de este libro —el mapa se indexa por la
 *  clave canónica para que haya UNA sola forma de nombrar un chunk— y no una
 *  operación que el resto del paquete necesite. */
function coordsDeClave(key: string): { cx: number; cy: number } {
  const partes = key.split(':')
  if (partes.length !== 3 || partes[0] !== 'c') throw new RangeError(`no es clave de chunk: ${key}`)
  return { cx: Number(partes[1]), cy: Number(partes[2]) }
}
