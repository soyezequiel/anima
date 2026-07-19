import type { StructuredEvent } from '@anima/shared';

export type SimEventType =
  | 'action.requested'
  | 'action.resolved'
  | 'entity.moved'
  | 'entity.damaged'
  | 'entity.destroyed'
  | 'item.pickedUp'
  | 'item.dropped'
  | 'item.placed'
  | 'item.consumed'
  | 'item.crafted'
  /** El intento salió mal: gastó ingredientes y no produjo nada. */
  | 'craft.failed'
  | 'recipe.learned'
  | 'recipe.rejected'
  /** El mundo aceptó una interacción propuesta: desde ahora es una regla. */
  | 'interaction.learned'
  /** El mundo rechazó la interacción propuesta, con el motivo. */
  | 'interaction.rejected'
  /** Una interacción aprendida acaba de ejecutarse sobre un objetivo. */
  | 'interaction.performed'
  /** El mundo aceptó un plano propuesto: desde ahora es una obra construible. */
  | 'blueprint.learned'
  /** El mundo rechazó el plano propuesto, con el motivo. */
  | 'blueprint.rejected'
  /** El mundo aceptó una descomposición: desde ahora ese tipo deja eso al romperse. */
  | 'decomposition.learned'
  /** El mundo rechazó la descomposición propuesta, con el motivo. */
  | 'decomposition.rejected'
  /** El mundo aceptó un dibujo: desde ahora ese tipo se ve así. */
  | 'glyph.learned'
  /** El mundo rechazó el dibujo propuesto, con el motivo. */
  | 'glyph.rejected'
  /** El mundo aceptó los dibujos de una obra: sus celdas ya tienen aspecto. */
  | 'workGlyphs.learned'
  /** El mundo rechazó los dibujos de una obra, con el motivo. */
  | 'workGlyphs.rejected'
  | 'tool.broke'
  | 'agent.spoke'
  | 'entity.spawned'
  | 'energy.low'
  | 'energy.depleted'
  | 'temperature.low'
  | 'temperature.depleted'
  | 'pet.died';

export type SimEvent = StructuredEvent<SimEventType>;

export function simEvent(
  type: SimEventType,
  tick: number,
  data: Record<string, unknown>,
): SimEvent {
  return { type, tick, data };
}
