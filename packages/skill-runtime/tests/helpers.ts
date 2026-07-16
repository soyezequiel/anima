import type { EntityId, WorldState } from '@anima/sim-core';
import { createWorld, spawn } from '@anima/sim-core';

export interface RuntimeTestWorld {
  world: WorldState;
  petId: EntityId;
}

export function smallWorld(seed = 1): RuntimeTestWorld {
  const world = createWorld({ width: 9, height: 5, seed });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 15, max: 50, decayPerTick: 0.05 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 4 },
    agent: { name: 'Test', perceptionRange: 12 },
  }).id;
  return { world, petId };
}

export function addFood(world: WorldState, x: number, y: number): EntityId {
  return spawn(world, 'food', {
    position: { x, y },
    portable: {},
    edible: {},
    nutrition: { value: 30 },
  }).id;
}

export function addWallColumn(world: WorldState, x: number): void {
  for (let y = 0; y < world.config.height; y++) {
    spawn(world, 'wall', {
      position: { x, y },
      collider: { solid: true },
      hardness: { value: 5 },
      durability: { current: 10, max: 10 },
    });
  }
}

export function addHammer(world: WorldState, x: number, y: number): EntityId {
  return spawn(world, 'hammer', {
    position: { x, y },
    portable: {},
    tool: { power: 8 },
    durability: { current: 20, max: 20 },
  }).id;
}
