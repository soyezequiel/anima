import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ActionIntent, WorldState } from '../src/index.js';
import {
  deserializeSnapshot,
  hashWorld,
  restoreSnapshot,
  serializeSnapshot,
  stepWorld,
  takeSnapshot,
} from '../src/index.js';
import { buildTestWorld, spawnBranch, spawnFood, spawnHammer, spawnWall } from './helpers.js';

function buildScenario(seed: number): { world: WorldState; petId: string } {
  const { world, pet } = buildTestWorld(seed);
  spawnWall(world, 3, 1);
  spawnWall(world, 3, 2);
  spawnWall(world, 3, 3);
  spawnFood(world, 5, 2);
  spawnBranch(world, 1, 1);
  spawnHammer(world, 1, 3);
  return { world, petId: pet.id };
}

function runActions(world: WorldState, petId: string, intents: ActionIntent[]): void {
  for (const intent of intents) {
    stepWorld(world, [{ actorId: petId, intent }]);
  }
}

const arbitraryIntent: fc.Arbitrary<ActionIntent> = fc.oneof(
  fc.constant<ActionIntent>({ type: 'wait' }),
  fc.constantFrom<ActionIntent>(
    { type: 'move', dir: 'up' },
    { type: 'move', dir: 'down' },
    { type: 'move', dir: 'left' },
    { type: 'move', dir: 'right' },
  ),
  // Ids arbitrarios: la mayoría fallará, y también debe fallar igual siempre.
  fc.constantFrom('e2', 'e3', 'e4', 'e5', 'e6', 'e99').map(
    (id): ActionIntent => ({ type: 'pickup', targetId: id }),
  ),
  fc.constantFrom('e5', 'e6').map((id): ActionIntent => ({ type: 'consume', targetId: id })),
);

describe('determinismo', () => {
  it('mismo estado inicial + mismas acciones => mismo estado final (propiedad)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.array(arbitraryIntent, { maxLength: 60 }),
        (seed, intents) => {
          const a = buildScenario(seed);
          const b = buildScenario(seed);
          runActions(a.world, a.petId, intents);
          runActions(b.world, b.petId, intents);
          expect(hashWorld(a.world)).toEqual(hashWorld(b.world));
        },
      ),
      { numRuns: 30 },
    );
  });

  it('semillas distintas no rompen la reproducibilidad de cada corrida', () => {
    const a = buildScenario(1);
    const b = buildScenario(2);
    expect(hashWorld(a.world)).not.toEqual(hashWorld(b.world));
  });

  it('restaurar un snapshot a mitad de corrida reproduce el mismo final', () => {
    const original = buildScenario(42);
    const prefix: ActionIntent[] = [
      { type: 'move', dir: 'right' },
      { type: 'move', dir: 'up' },
      { type: 'pickup', targetId: 'e6' },
    ];
    const suffix: ActionIntent[] = [
      { type: 'move', dir: 'down' },
      { type: 'move', dir: 'down' },
      { type: 'move', dir: 'right' },
    ];
    runActions(original.world, original.petId, prefix);

    const snapshot = deserializeSnapshot(serializeSnapshot(takeSnapshot(original.world)));
    const restored = restoreSnapshot(snapshot);

    runActions(original.world, original.petId, suffix);
    runActions(restored, original.petId, suffix);
    expect(hashWorld(restored)).toEqual(hashWorld(original.world));
  });

  it('el snapshot es una copia independiente', () => {
    const { world, petId } = buildScenario(7);
    const snapshot = takeSnapshot(world);
    runActions(world, petId, [{ type: 'move', dir: 'right' }]);
    const restored = restoreSnapshot(snapshot);
    expect(restored.entities[petId]?.components.position).toEqual({ x: 1, y: 2 });
    expect(world.entities[petId]?.components.position).toEqual({ x: 2, y: 2 });
  });
});
