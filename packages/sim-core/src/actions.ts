import type { EntityId } from './components.js';

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTION_DELTAS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * Intenciones primitivas que un agente puede pedir al mundo. El mundo decide
 * las consecuencias; el agente solo expresa qué intenta hacer.
 */
export type ActionIntent =
  | { type: 'wait' }
  | { type: 'move'; dir: Direction }
  | { type: 'pickup'; targetId: EntityId }
  | { type: 'drop'; itemId: EntityId }
  /**
   * Colocar un bloque que se lleva encima en una celda elegida (ADR 0032). Es
   * `drop` con puntería: en vez de soltarlo a los pies, lo pone en una celda
   * adyacente, vacía y dentro del mapa. La primitiva con la que se levantan las
   * obras — una casa es sus paredes puestas donde van.
   */
  | { type: 'place'; itemId: EntityId; at: { x: number; y: number } }
  | { type: 'consume'; targetId: EntityId }
  | { type: 'useItem'; itemId: EntityId; targetId: EntityId }
  | { type: 'craft'; recipeId: string }
  /**
   * Proponerle al mundo una receta nueva. El agente no la añade: la propone, y
   * el mundo la valida y decide. La física sigue siendo del mundo.
   */
  | { type: 'proposeRecipe'; recipe: unknown }
  /**
   * Proponerle al mundo una interacción nueva (ADR 0027). El mismo trato que
   * las recetas: viaja cruda y la puerta de step.ts decide. El juicio de
   * coherencia (la IA Dios) ya ocurrió del lado del agente, pero no reemplaza
   * a esta validación — la física no se delega.
   */
  | { type: 'proposeInteraction'; interaction: unknown }
  /**
   * Proponerle al mundo un plano nuevo (ADR 0032). Mismo trato que recetas e
   * interacciones: viaja crudo y la puerta de step.ts valida y decide.
   */
  | { type: 'proposeBlueprint'; blueprint: unknown }
  /**
   * Proponerle al mundo en qué se deshace un tipo al romperse (la cuarta puerta,
   * ADR 0027). Mismo trato: viaja cruda y la puerta de step.ts valida y decide.
   * La materia base que no tiene receta no desaparece al destruirse — deja lo
   * que esta regla, una vez aprendida, diga.
   */
  | { type: 'proposeDecomposition'; decomposition: unknown }
  /** Ejecutar una interacción que el mundo ya admite, sobre un objetivo. */
  | { type: 'interact'; interactionId: string; targetId: EntityId }
  | { type: 'speak'; text: string };

export interface ActorIntent {
  actorId: EntityId;
  intent: ActionIntent;
}
