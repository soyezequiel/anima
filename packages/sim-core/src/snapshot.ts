import { hashValue } from '@anima/shared';
import { normalizeRecipe } from './recipes.js';
import type { WorldState } from './world.js';

export interface WorldSnapshot {
  version: 1;
  state: WorldState;
}

/** Copia profunda e independiente del mundo. */
export function takeSnapshot(world: WorldState): WorldSnapshot {
  return { version: 1, state: structuredClone(world) };
}

/**
 * Restaura un mundo desde un snapshot. Es la frontera por donde entran datos
 * viejos (guardados de sesión, regresiones archivadas), así que normaliza los
 * campos que no existían cuando se escribieron: un mundo anterior a las
 * recetas simplemente no admite ninguna, y uno anterior a los desenlaces trae
 * recetas de `output` único, que se leen como lo que eran — un solo desenlace
 * seguro. Sin esto, un legado guardado antes de la tirada dejaría de craftear.
 */
export function restoreSnapshot(snapshot: WorldSnapshot): WorldState {
  const state = structuredClone(snapshot.state) as WorldState & {
    recipes?: WorldState['recipes'];
    interactions?: WorldState['interactions'];
    blueprints?: WorldState['blueprints'];
  };
  return {
    ...state,
    recipes: (state.recipes ?? []).map(normalizeRecipe),
    // Un mundo anterior a las interacciones simplemente no admite ninguna.
    interactions: state.interactions ?? [],
    // Ni a los planos: un legado viejo restaura sin obras y las aprende igual.
    blueprints: state.blueprints ?? [],
  };
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
