import { describe, expect, it } from 'vitest';
import { spawn, stepWorld } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

/**
 * Un espinillo que no bloquea: se puede pisar, y pisarlo es lo que duele
 * (ADR 0041). Un peligro sólido sería inofensivo por construcción, porque
 * nadie puede meterse en su celda.
 */
function addCactus(world: ReturnType<typeof buildTestWorld>['world'], x: number, y: number) {
  return spawn(world, 'cactus', {
    position: { x, y },
    hazard: { damagePerTick: 2 },
  });
}

describe('peligros del mundo', () => {
  it('daña cada tick a quien está ENCIMA y emite el evento', () => {
    const { world, pet } = buildTestWorld();
    addCactus(world, 1, 2); // la mascota está en (1,2): la misma celda
    const events = stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.health?.current).toBe(8);
    const damaged = events.find((e) => e.type === 'entity.damaged');
    expect(damaged?.data.itemKind).toBe('cactus');
    expect(damaged?.data.damage).toBe(2);
  });

  it('estar al lado no duele: el peligro no alcanza a los adyacentes', () => {
    const { world, pet } = buildTestWorld();
    addCactus(world, 2, 2); // adyacente a la mascota, que está en (1,2)
    const events = stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.health?.current).toBe(10);
    expect(events.find((e) => e.type === 'entity.damaged')).toBeUndefined();
  });

  it('salirse detiene el daño', () => {
    const { world, pet } = buildTestWorld();
    addCactus(world, 1, 2);
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'move', dir: 'left' } }]);
    const before = pet.components.health!.current;
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.health?.current).toBe(before);
  });

  it('la salud agotada por heridas mata con causa "injuries", no inanición', () => {
    const { world, pet } = buildTestWorld();
    pet.components.health = { current: 4, max: 10 };
    addCactus(world, 1, 2);
    const all = [];
    for (let i = 0; i < 3; i++) {
      all.push(...stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]));
    }
    expect(pet.components.dead?.cause).toBe('injuries');
    const died = all.find((e) => e.type === 'pet.died');
    expect(died?.data.cause).toBe('injuries');
    // La energía nunca llegó a cero: no fue hambre.
    expect(pet.components.energy!.current).toBeGreaterThan(0);
  });
});
