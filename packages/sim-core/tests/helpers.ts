import type { Entity, WorldState } from '../src/index.js';
import { createWorld, spawn } from '../src/index.js';

export interface TestWorld {
  world: WorldState;
  pet: Entity;
}

/** Mundo mínimo 7x5 con una mascota en (1,2). */
export function buildTestWorld(seed = 1): TestWorld {
  const world = createWorld({ width: 7, height: 5, seed });
  const pet = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 20, max: 50, decayPerTick: 0.1 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 4 },
    agent: { name: 'Test', perceptionRange: 10 },
  });
  return { world, pet };
}

export function spawnWall(world: WorldState, x: number, y: number): Entity {
  return spawn(world, 'wall', {
    position: { x, y },
    collider: { solid: true },
    hardness: { value: 5 },
    durability: { current: 10, max: 10 },
  });
}

export function spawnFood(world: WorldState, x: number, y: number): Entity {
  return spawn(world, 'food', {
    position: { x, y },
    portable: {},
    edible: {},
    nutrition: { value: 25 },
  });
}

export function spawnBranch(world: WorldState, x: number, y: number): Entity {
  return spawn(world, 'branch', {
    position: { x, y },
    portable: {},
    tool: { power: 1 },
    durability: { current: 8, max: 8 },
  });
}

export function spawnHammer(world: WorldState, x: number, y: number): Entity {
  return spawn(world, 'hammer', {
    position: { x, y },
    portable: {},
    tool: { power: 8 },
    durability: { current: 20, max: 20 },
  });
}
