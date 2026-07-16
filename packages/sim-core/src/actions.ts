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
  | { type: 'consume'; targetId: EntityId }
  | { type: 'useItem'; itemId: EntityId; targetId: EntityId }
  | { type: 'speak'; text: string };

export interface ActorIntent {
  actorId: EntityId;
  intent: ActionIntent;
}
