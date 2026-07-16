import { describe, expect, it } from 'vitest';
import { stepWorld } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

describe('sistema de energía', () => {
  it('la energía decae por tick', () => {
    const { world, pet } = buildTestWorld();
    for (let i = 0; i < 10; i++) stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.energy?.current).toBeCloseTo(19, 5);
  });

  it('emite energy.low una sola vez al cruzar el umbral', () => {
    const { world, pet } = buildTestWorld();
    pet.components.energy = { current: 18, max: 50, decayPerTick: 1 };
    const all = [];
    for (let i = 0; i < 5; i++) {
      all.push(...stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]));
    }
    expect(all.filter((e) => e.type === 'energy.low')).toHaveLength(1);
  });

  it('energía en cero degrada la salud hasta la muerte', () => {
    const { world, pet } = buildTestWorld();
    pet.components.energy = { current: 1, max: 50, decayPerTick: 1 };
    pet.components.health = { current: 3, max: 10 };
    const all = [];
    for (let i = 0; i < 6; i++) {
      all.push(...stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]));
    }
    expect(all.filter((e) => e.type === 'energy.depleted')).toHaveLength(1);
    expect(all.filter((e) => e.type === 'pet.died')).toHaveLength(1);
    expect(pet.components.dead?.cause).toBe('starvation');
    // Una mascota muerta ya no actúa.
    const after = stepWorld(world, [{ actorId: pet.id, intent: { type: 'move', dir: 'right' } }]);
    expect(after.find((e) => e.type === 'action.resolved')?.data.reason).toBe('actor-unavailable');
  });
});
