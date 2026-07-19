import type { Components, EntityId, EntityKind, WorldState } from '@anima/sim-core';
import { spawn } from '@anima/sim-core';
import type { Vec2 } from '@anima/shared';

/**
 * Sembradores compartidos por los mapas. Son atajos de escritura, no reglas:
 * cada uno arma componentes que el motor ya entiende, y ninguno conoce
 * ninguna misión. Un mapa es una disposición de materia, y esto es la mano
 * que la reparte.
 */

export function put(
  world: WorldState,
  kind: EntityKind,
  at: Vec2,
  components: Components = {},
): EntityId {
  return spawn(world, kind, { position: { ...at }, ...components }).id;
}

export function putMany(
  world: WorldState,
  kind: EntityKind,
  spots: readonly Vec2[],
  components: Components = {},
): void {
  for (const spot of spots) put(world, kind, spot, structuredClone(components));
}

export const PORTABLE: Components = { portable: {} };

/** Materia suelta que se levanta y se usa como ingrediente. */
export function material(world: WorldState, kind: EntityKind, spots: readonly Vec2[]): void {
  putMany(world, kind, spots, PORTABLE);
}

/** Agua: se ve, no tapa la vista, y nadie sabe nadar. */
export function water(world: WorldState, spots: readonly Vec2[]): void {
  putMany(world, 'agua', spots, { water: {} });
}

/** Roca: sólida, dura, y deja piedra al romperse. */
export function rock(world: WorldState, at: Vec2, hardness = 4): EntityId {
  return put(world, 'roca', at, {
    collider: { solid: true },
    hardness: { value: hardness },
    durability: { current: 12, max: 12 },
    drops: [{ kind: 'piedra', components: { portable: {} } }],
  });
}

export function tree(world: WorldState, at: Vec2): EntityId {
  return put(world, 'arbol', at, {
    collider: { solid: true },
    hardness: { value: 2 },
    durability: { current: 8, max: 8 },
    drops: [
      { kind: 'tronco', components: { portable: {} } },
      { kind: 'tronco', components: { portable: {} } },
    ],
    itemSource: {
      intervalTicks: 220,
      nextSpawnAtTick: 220,
      output: { kind: 'rama', components: { portable: {} } },
    },
  });
}

export function food(world: WorldState, at: Vec2, nutrition = 20): EntityId {
  return put(world, 'food', at, {
    portable: {},
    edible: {},
    nutrition: { value: nutrition },
  });
}

export function pet(world: WorldState, at: Vec2, options: { energy?: number; range?: number } = {}): EntityId {
  return spawn(world, 'pet', {
    position: { ...at },
    collider: { solid: true },
    energy: { current: options.energy ?? 30, max: 50, decayPerTick: 0.05 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: options.range ?? 14 },
  }).id;
}

export function column(x: number, fromY: number, toY: number): Vec2[] {
  const out: Vec2[] = [];
  for (let y = fromY; y <= toY; y++) out.push({ x, y });
  return out;
}

export function row(y: number, fromX: number, toX: number): Vec2[] {
  const out: Vec2[] = [];
  for (let x = fromX; x <= toX; x++) out.push({ x, y });
  return out;
}
