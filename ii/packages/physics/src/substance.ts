// ─── @anima/physics/substance.ts ─────────────────────────────────────────────
//
// Una sustancia es «de qué está hecho», y NADA más. Abierta: el oráculo agrega
// cuantas quiera y el modelo también, sin que nadie toque este archivo.
//
// LO QUE NO ESTÁ ACÁ, Y ES LA DECISIÓN ENTERA
//
// No hay `transitions: [{ under: ProcessId, into: SubstanceId }]`. Eso sería la
// tabla de recetas indexada al revés: el costo de autoría es el mismo o peor
// (N sustancias × 12 leyes en vez de M recetas) y, sobre todo, una sustancia
// nueva no se comportaría bien hasta que alguien le escriba su fila. Acá las
// transformaciones se resuelven por TAG, una sola vez, en las leyes. Un hongo
// que el dios inventó ayer se piroliza igual sin fila propia.
//
// Tampoco hay `edible`, ni `kind`, ni `protected`. Que algo alimente no es un
// permiso: es `nutrition > 0` y `nutrition` es conservada, así que ninguna ley
// puede subirla. Eso es lo que reemplaza a `PROTECTED_KINDS` de Ánima I, que
// era un string repetido en cinco archivos.

import type { QualityVector } from './quality.js'

export type SubstanceId = string

/**
 * Los tags son la superficie por la que las leyes agarran a la materia. Son
 * pocos y CERRADOS a propósito: cada tag nuevo es una rama nueva en cada ley
 * que lo mire, y multiplicar tags es volver a tener una fila por sustancia con
 * otro nombre.
 *
 * No son excluyentes: el hueso es `organico` y `mineral` a la vez, y por eso
 * arde mal pero se astilla en filo.
 */
export type Tag =
  | 'organico'
  | 'vegetal'
  | 'mineral'
  | 'fibroso'
  | 'carnoso'
  | 'carbonoso'
  | 'liquido'

/** Enumeración en dato, para que los tests puedan barrer cobertura de tags. */
export const TAGS: readonly Tag[] = [
  'organico',
  'vegetal',
  'mineral',
  'fibroso',
  'carnoso',
  'carbonoso',
  'liquido',
]

/**
 * Cómo se dice. Vive en la sustancia y no en un diccionario aparte porque un
 * diccionario aparte se desincroniza: es el bug de `DSL_REFERENCE` de Ánima I,
 * una referencia mantenida a mano que divergió del código.
 *
 * Ojo: esto nombra la MATERIA, no el cuerpo. 'pescado crudo' y 'pescado asado'
 * son el mismo cuerpo de la misma sustancia con distinta `digestibility`, y esa
 * diferencia la pone `nameOf` (body.ts), que es una vista, no un tipo.
 */
export interface Lexeme {
  nombre: string
  genero: 'm' | 'f'
  sinonimos: readonly string[]
}

/** Quién la puso en el mundo. El juez necesita distinguir semilla de invento. */
export interface Provenance {
  by: 'semilla' | 'oraculo' | 'modelo'
  atTick?: number
}

export interface Substance {
  id: SubstanceId
  lexeme: Lexeme
  tags: readonly Tag[]
  /**
   * El vector de cualidades de UNA unidad de masa de esta sustancia.
   *
   * Las extensivas (`nutrition`, `fuelEnergy`) se leen literalmente por unidad
   * de masa: un cuerpo de masa 3 de carne tiene 27 de nutrition. Las intensivas
   * (`moisture`, `rigidity`, `denaturesAt`…) no escalan con la masa: son el
   * valor que le toca a cualquier trozo, grande o chico.
   *
   * `mass` NO va acá — sería circular; la masa vive en `Part.mass`.
   * `temperature` tampoco — es estado del cuerpo y relaja al ambiente.
   */
  perUnitMass: QualityVector
  /**
   * Calor específico: cuánta energía cuesta subirle un grado a una unidad de
   * masa. `heatCapacity = mass × specificHeat` es derivada y sale de acá.
   *
   * Es campo propio y no una entrada más de `perUnitMass` porque la ley 1 lo
   * necesita para TODA sustancia sin excepción: si pudiera faltar, habría que
   * inventarle un default, y un default en la ley térmica es una calibración
   * escondida.
   */
  specificHeat: number
  provenance: Provenance
}

/** Las claves legales de una sustancia. El test las usa para probar que ninguna
 *  contrabandea una tabla de transiciones con otro nombre. */
export const SUBSTANCE_FIELDS: readonly string[] = [
  'id',
  'lexeme',
  'tags',
  'perUnitMass',
  'specificHeat',
  'provenance',
]
