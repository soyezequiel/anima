import type { Components, Entity, EntityKind } from './components.js';

/**
 * Interacción: una regla del mundo, hermana de `Recipe`. Declara QUÉ se puede
 * hacer con un objeto (juntar agua con un balde, subirse a una piedra) y qué
 * pasa cuando se hace. Es dato puro, vive en `WorldState.interactions` y viaja
 * en los snapshots: una vez aprendida, no hay que inventarla de nuevo — ni en
 * esta sesión ni en un mundo restaurado.
 *
 * Nace en tiempo de ejecución (Ánima la propone, ADR 0027) pero se aplica
 * igual a objetos del código y a objetos inventados: el selector de objetivo
 * habla de tipos y de rasgos, no de orígenes.
 */

/**
 * La forma espacial de la interacción — DÓNDE tiene que estar el cuerpo
 * respecto del objeto para que ocurra:
 *
 * - `beside`: al lado (Chebyshev ≤ 1, la misma adyacencia de recoger/usar).
 * - `on-top`: parada en la celda del objeto, ella por encima. Basta LLEGAR a
 *   una celda adyacente: subirse es parte del acto — así los sólidos (silla,
 *   cama) admiten que se les suban aunque caminar a través de ellos siga
 *   prohibido. Sobre el agua no hay postura que valga.
 * - `underneath`: la celda del objeto, ella por debajo (meterse bajo algo).
 *   Para el motor 2D es la misma condición que `on-top`; la diferencia es de
 *   representación, y el evento la conserva para que el dibujo la respete.
 * - `held`: el objetivo va en su inventario — la interacción es con algo que
 *   lleva encima.
 */
export type InteractionStance = 'beside' | 'on-top' | 'underneath' | 'held';

/**
 * A qué se aplica. Por tipo, por rasgos, o ambos: `{ wet: true }` alcanza a
 * toda agua presente y futura; `{ kind: 'chair' }` solo a las sillas. Hablar
 * de rasgos es lo que hace que una interacción sirva igual para lo hardcodeado
 * y para lo que un modelo invente mañana con otro nombre.
 */
export interface InteractionTarget {
  kind?: EntityKind;
  /** Agua: celdas que no se pisan. */
  wet?: boolean;
  solid?: boolean;
  portable?: boolean;
  /** Irradia calor. */
  warm?: boolean;
  shelter?: boolean;
}

/**
 * Lo que la interacción HACE. Catálogo cerrado y deliberadamente corto: las
 * interacciones transforman OBJETOS, nunca cuerpos. No dan energía, ni calor,
 * ni comida — esa puerta ya la cerró el ADR 0018 y esta no la reabre.
 *
 * Conservación de materia: cada transformación es 1→1 (el objeto se vuelve
 * otro objeto), y el esquema de la puerta no admite `drops`, así que tampoco
 * puede fabricar materia para después, al romperse.
 */
export type InteractionEffect =
  /** El objetivo se convierte en otra cosa (dentro de las cotas del mundo). */
  | { type: 'transform-target'; kind?: EntityKind; components: Components }
  /**
   * Lo que lleva en la mano se convierte en otra cosa: el balde vacío que toca
   * el agua se vuelve un balde lleno. Exige `requires.heldKind`.
   */
  | { type: 'transform-held'; kind?: EntityKind; components: Components };

export interface Interaction {
  id: string;
  /** Qué es, en voz humana: "juntar agua del estanque con un balde". */
  description: string;
  stance: InteractionStance;
  target: InteractionTarget;
  /** Qué debe llevar encima para poder hacerlo (el balde para el agua). */
  requires?: { heldKind: EntityKind };
  /**
   * Puede estar vacío SOLO en posturas posicionales (`on-top`/`underneath`):
   * ahí la interacción ES estar ahí. En el resto, sin efectos no hay nada.
   */
  effects: InteractionEffect[];
}

/** true si la entidad es de lo que la interacción declara como objetivo. */
export function matchesInteractionTarget(entity: Entity, target: InteractionTarget): boolean {
  if (target.kind !== undefined && entity.kind !== target.kind) return false;
  const c = entity.components;
  if (target.wet !== undefined && (c.water !== undefined) !== target.wet) return false;
  if (target.solid !== undefined && (c.collider?.solid ?? false) !== target.solid) return false;
  if (target.portable !== undefined && (c.portable !== undefined) !== target.portable) return false;
  if (target.warm !== undefined && (c.heatSource !== undefined) !== target.warm) return false;
  if (target.shelter !== undefined && (c.shelter !== undefined) !== target.shelter) return false;
  return true;
}
