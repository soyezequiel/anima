import type { Vec2 } from '@anima/shared';
import { createRng, nextInt } from '@anima/shared';
import type { EntityId, WorldState } from '@anima/sim-core';
import { createWorld, spawn } from '@anima/sim-core';

export interface ScenarioBundle {
  world: WorldState;
  petId: EntityId;
  meta: { name: string; seed: number };
}

export type ScenarioFactory = (seed: number) => ScenarioBundle;

export interface ScenarioSpec {
  name: string;
  build: ScenarioFactory;
}

function spawnPet(world: WorldState, pos: Vec2, energy: number): EntityId {
  return spawn(world, 'pet', {
    position: pos,
    collider: { solid: true },
    energy: { current: energy, max: 50, decayPerTick: 0.05 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 4 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
}

function spawnFood(world: WorldState, pos: Vec2): void {
  spawn(world, 'food', {
    position: pos,
    portable: {},
    edible: {},
    nutrition: { value: 30 },
  });
}

function spawnBranch(world: WorldState, pos: Vec2): void {
  spawn(world, 'branch', {
    position: pos,
    portable: {},
    tool: { power: 1 },
    durability: { current: 8, max: 8 },
  });
}

function spawnHammer(world: WorldState, pos: Vec2): void {
  spawn(world, 'hammer', {
    position: pos,
    portable: {},
    tool: { power: 8 },
    durability: { current: 20, max: 20 },
  });
}

/**
 * Escenario principal del MVP: el alimento está detrás de un muro completo.
 * No hay ruta libre: la única salida es romper el muro con una herramienta
 * suficientemente fuerte. La rama (cercana, débil) es una trampa plausible.
 * La semilla varía las posiciones de las herramientas del lado de la mascota.
 */
export const foodBehindWall: ScenarioSpec = {
  name: 'food-behind-wall',
  build(seed) {
    const world = createWorld({ width: 9, height: 5, seed });
    const rng = createRng(seed * 7919 + 17);
    const petId = spawnPet(world, { x: 1, y: 2 }, 15);

    for (let y = 0; y < 5; y++) {
      spawn(world, 'wall', {
        position: { x: 4, y },
        collider: { solid: true },
        hardness: { value: 5 },
        durability: { current: 10, max: 10 },
      });
    }
    spawnFood(world, { x: 7, y: 2 });
    // El árbol produce alimento nuevo cada tanto: el mundo es habitable a
    // largo plazo. El primer brote (tick 400) es posterior al maxTicks de
    // cualquier evaluación (200), así que no altera las pruebas de skills.
    spawn(world, 'tree', {
      position: { x: 7, y: 4 },
      collider: { solid: true },
      foodSource: { intervalTicks: 400, nutrition: 30, nextSpawnAtTick: 400 },
    });

    // La rama siempre queda más cerca de la mascota que el martillo.
    const branchSpots: Vec2[] = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 3 },
    ];
    const hammerSpots: Vec2[] = [
      { x: 3, y: 0 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
    ];
    const branchIndex = nextInt(rng, 0, branchSpots.length - 1);
    const hammerIndex = nextInt(rng, 0, hammerSpots.length - 1);
    const branchSpot = branchSpots[branchIndex] ?? branchSpots[0]!;
    const hammerSpot = hammerSpots[hammerIndex] ?? hammerSpots[0]!;
    spawnBranch(world, branchSpot);
    spawnHammer(world, hammerSpot);

    return { world, petId, meta: { name: 'food-behind-wall', seed } };
  },
};

/**
 * Caso normal sin obstáculo: cualquier habilidad de "alcanzar y comer"
 * también debe funcionar cuando no hay muro de por medio.
 */
export const openField: ScenarioSpec = {
  name: 'open-field',
  build(seed) {
    const world = createWorld({ width: 9, height: 5, seed });
    const rng = createRng(seed * 104729 + 3);
    const petId = spawnPet(world, { x: 1, y: 2 }, 15);
    const foodSpots: Vec2[] = [
      { x: 6, y: 1 },
      { x: 7, y: 2 },
      { x: 6, y: 3 },
    ];
    const foodIndex = nextInt(rng, 0, foodSpots.length - 1);
    spawnFood(world, foodSpots[foodIndex] ?? foodSpots[0]!);
    spawnBranch(world, { x: 2, y: 1 });
    spawnHammer(world, { x: 3, y: 3 });
    return { world, petId, meta: { name: 'open-field', seed } };
  },
};

export const MVP_SCENARIOS: ScenarioSpec[] = [openField, foodBehindWall];
