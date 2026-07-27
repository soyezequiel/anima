/**
 * EL CONTRATO DE UNA HABILIDAD — Hito 4.
 *
 * Por qué existe como DATO y no sólo como comentario: el juez del Hito 7 hace
 * **ablación de precondiciones** («para cada `requires` candidato se corren N
 * mundos donde esa condición no se cumple; si la habilidad funciona igual, la
 * precondición era espuria y se borra»). Una precondición escrita en prosa
 * dentro de un comentario no se puede ablacionar. Escrita acá, sí.
 *
 * Y `establece` es la llave del índice de la biblioteca —«la biblioteca se
 * indexa por lo que establece, no por su nombre»—, así que tampoco puede vivir
 * en un comentario.
 *
 * Los predicados se escriben con el MISMO vocabulario que `Where` y `WhereCell`:
 * cualidad, operador, valor. No es azar: lo que una habilidad establece tiene
 * que poder ser lo que otra busca, o el circuito no cierra.
 */

import type { CellQuality, Commitment, QualityId } from '../ctx.js'

/**
 * Un predicado del contrato.
 *
 * `sujeto` existe porque `Where` no lo dice: un `QualityTest` habla de «un
 * cuerpo», sin decir cuál. Y `q` admite cuatro nombres que NO son cualidades
 * —`holding`, `at`, `existe`, `permits`— que son las relaciones que el mundo
 * guarda y la física no. Que haya que ensancharlo a mano es un dato: no hay
 * vocabulario de predicados sobre RELACIONES, sólo sobre magnitudes.
 */
export interface Predicado {
  readonly sujeto: 'yo' | 'el-objetivo' | 'lo-que-devuelve' | 'la-celda'
  readonly q: QualityId | CellQuality | 'holding' | 'at' | 'existe' | 'permits'
  readonly op: '>=' | '<=' | '>' | '<' | '=='
  readonly v: number
}

export interface Contrato {
  readonly nombre: string
  /** Qué es verdad después, si devolvió `{ ok: true }`. La llave del índice. */
  readonly establece: readonly Predicado[]
  /** Qué tiene que ser verdad antes. Candidatas a ablación, no verdades. */
  readonly precondiciones: readonly Predicado[]
  /** Qué gasta. En unidades del mundo, no en prosa. */
  readonly cuesta: {
    /** Segundos de mundo (ADR II-0008), no ticks. Cota superior, 0 si no espera. */
    readonly segundos: number
    /** El PEOR compromiso que esta habilidad puede llegar a emitir. Si es mayor
     *  que `self.permits`, el mundo la rechaza con `sin-permiso` antes de mirarla. */
    readonly commitment: Commitment
  }
  /**
   * Dónde la API no alcanzó. Cada entrada es un hallazgo medido, no una
   * opinión: le corresponde una sonda en `tests/innatas-huecos.test.ts` que
   * corre `tsc` de verdad sobre el código que uno querría escribir y muestra el
   * error — o la ausencia de error, que en dos casos es peor.
   */
  readonly huecos: readonly string[]
}
