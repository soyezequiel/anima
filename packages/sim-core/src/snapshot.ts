import { hashValue } from '@anima/shared';
import type { WorldState } from './world.js';

export interface WorldSnapshot {
  version: 1;
  state: WorldState;
}

/** Copia profunda e independiente del mundo. */
export function takeSnapshot(world: WorldState): WorldSnapshot {
  return { version: 1, state: structuredClone(world) };
}

export function restoreSnapshot(snapshot: WorldSnapshot): WorldState {
  return structuredClone(snapshot.state);
}

export function serializeSnapshot(snapshot: WorldSnapshot): string {
  return JSON.stringify(snapshot);
}

export function deserializeSnapshot(raw: string): WorldSnapshot {
  const parsed = JSON.parse(raw) as WorldSnapshot;
  if (parsed.version !== 1) {
    throw new Error(`Versión de snapshot no soportada: ${String(parsed.version)}`);
  }
  return parsed;
}

/** Hash estable del estado completo, para pruebas de determinismo. */
export function hashWorld(world: WorldState): string {
  return hashValue(world);
}
