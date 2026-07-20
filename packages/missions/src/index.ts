export * from './map.js';
export * from './objectives.js';
export * from './tracker.js';
export * from './terrain.js';
export { vado } from './maps/vado.js';
export { brote } from './maps/brote.js';
export { vigia } from './maps/vigia.js';
export { cauce } from './maps/cauce.js';

import type { GameMap } from './map.js';
import { vado } from './maps/vado.js';
import { brote } from './maps/brote.js';
import { vigia } from './maps/vigia.js';
import { cauce } from './maps/cauce.js';

/** Los mapas jugables, en orden de dificultad. */
export const MAPS: readonly GameMap[] = [vado, brote, vigia, cauce];

export function mapById(id: string): GameMap | undefined {
  return MAPS.find((m) => m.id === id);
}
