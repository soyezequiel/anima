/**
 * EL PAQUETE QUE LA FRAGUA PRODUCE — Hito 8, tramo G.
 *
 * El caso de aceptación lo dice con estas palabras:
 *
 *   > La fragua deja de producir un archivo y produce **un paquete**:
 *   > `BlueprintCandidate + BuildSkillCandidate + UseSkillCandidate`
 *
 * ─── Por qué son TRES y no uno ──────────────────────────────────────────────
 *
 * Porque **se rompen por separado**, y el juez del Hito 7 ya sabe puntuarlas
 * así: sus cuatro cargos son `plano · construccion · uso · utilidad`, y su
 * encabezado dice la frase que lo justifica —*«construir algo no demuestra que
 * funcione, y un `BuildSkill` verde con `UseSkill` rojo es un resultado
 * legítimo»*—.
 *
 * Un archivo suelto no se puede puntuar así. El paquete sí.
 *
 * ─── Y el plano NO se inventa acá: ya existe en la física ───────────────────
 *
 * `BlueprintDefinition` vive en `@anima/physics` desde el gate 5→6, con su
 * `revision` sellada y su `physicsVersion` adentro del hash. **La candidata
 * lleva la definición tal cual**, no una copia con otra forma: dos formas del
 * mismo plano es exactamente la duplicación que el guardián del sello (Hito 7,
 * tramo B) existe para atajar.
 *
 * Lo que la candidata agrega alrededor es lo que el plano NO sabe: quién la
 * escribió, en qué vuelta, y qué código la construye y la usa.
 */

import type { BlueprintDefinition } from '@anima/physics'
import type { Contrato } from '@anima/skills/innatas'

/**
 * EL CÓDIGO DE UNA HABILIDAD, tal como salió del modelo.
 *
 * `fuente` es texto y no una función a propósito: **entre que sale del modelo y
 * que corre hay tres puertas** —el typecheck, la reparación y el sandbox— y
 * ninguna puede trabajar sobre algo ya evaluado. Evaluarlo antes de revisarlo
 * es exactamente lo que el sandbox del Hito 4 existe para impedir.
 */
export interface HabilidadCandidata {
  /** Cómo se llama la función exportada. Hace falta para poder montarla. */
  readonly nombre: string
  readonly fuente: string
}

/**
 * LO QUE LA FRAGUA ENTREGA, entero.
 *
 * `plano` es opcional y no es descuido: **hay habilidades que no construyen
 * nada**. Las 17 innatas del corpus no tienen plano y son habilidades igual;
 * exigirlo obligaría a inventar uno vacío, que es peor que no tenerlo — un plano
 * vacío entra al catálogo y ocupa lugar.
 */
export interface Candidata {
  /** De qué encargo salió, y en qué vuelta. Es lo que hace rastreable un fallo. */
  readonly gap: string
  readonly vuelta: number
  readonly plano?: BlueprintDefinition
  readonly construir?: HabilidadCandidata
  readonly usar?: HabilidadCandidata
  /**
   * LO QUE LA CANDIDATA DICE QUE HACE — las «capacidades publicadas» del caso
   * de aceptación.
   *
   * ─── Por qué no se puede juzgar sin esto ────────────────────────────────
   *
   * Porque `juzgar()` arranca preguntándole al contrato qué mundos hacen falta:
   * `bancoDe(contrato, phys)` sale de las `precondiciones`, y `establece` es lo
   * que después se verifica CONTRA EL MUNDO. Sin contrato no hay banco, y sin
   * banco no hay nada que correr — el juez devolvería `injuzgable` y el
   * veredicto hablaría del arnés y no de la habilidad.
   *
   * ─── Y es lo que hace posible que el juez la BAJE ───────────────────────
   *
   * Es la mitad cara del punto 9. Una candidata que compila y no sirve sólo se
   * puede detectar comparando lo que PROMETIÓ contra lo que dejó cierto. Sin
   * promesa publicada no hay con qué comparar, y «compiló» pasaría por «anda».
   *
   * Es opcional por la misma razón que `plano`: una habilidad puede llegar sin
   * él, y eso es un resultado —vino incompleta— y no un error del arnés.
   */
  readonly contrato?: Contrato
}

/**
 * LAS PIEZAS QUE TRAE, para poder decir «vino incompleta» sin adivinar.
 *
 * Se cuenta y no se asume: una candidata sin `usar` no es un error del arnés, es
 * un resultado —el modelo no escribió esa parte— y el juez tiene que poder
 * distinguirlo de una que sí la trajo y falló.
 */
export function piezasDe(c: Candidata): readonly string[] {
  const out: string[] = []
  if (c.plano !== undefined) out.push('plano')
  if (c.construir !== undefined) out.push('construir')
  if (c.usar !== undefined) out.push('usar')
  return out
}

/** Todo lo que se puede pasar por la puerta. Vacío si no trajo código. */
export function fuentesDe(c: Candidata): readonly HabilidadCandidata[] {
  const out: HabilidadCandidata[] = []
  if (c.construir !== undefined) out.push(c.construir)
  if (c.usar !== undefined) out.push(c.usar)
  return out
}
