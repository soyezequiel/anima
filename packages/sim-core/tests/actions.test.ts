import { describe, expect, it } from 'vitest';
import { stepWorld } from '../src/index.js';
import {
  buildTestWorld,
  spawnBranch,
  spawnFood,
  spawnHammer,
  spawnWall,
} from './helpers.js';

describe('movimiento y colisiones', () => {
  it('mueve a una celda libre', () => {
    const { world, pet } = buildTestWorld();
    const events = stepWorld(world, [{ actorId: pet.id, intent: { type: 'move', dir: 'right' } }]);
    expect(pet.components.position).toEqual({ x: 2, y: 2 });
    expect(events.some((e) => e.type === 'entity.moved')).toBe(true);
  });

  it('no puede atravesar una pared', () => {
    const { world, pet } = buildTestWorld();
    spawnWall(world, 2, 2);
    const events = stepWorld(world, [{ actorId: pet.id, intent: { type: 'move', dir: 'right' } }]);
    expect(pet.components.position).toEqual({ x: 1, y: 2 });
    const resolvedEvent = events.find((e) => e.type === 'action.resolved');
    expect(resolvedEvent?.data.success).toBe(false);
    expect(resolvedEvent?.data.reason).toBe('blocked');
    expect(resolvedEvent?.data.blockerKind).toBe('wall');
  });

  it('no puede salir del mapa', () => {
    const { world, pet } = buildTestWorld();
    pet.components.position = { x: 0, y: 0 };
    const events = stepWorld(world, [{ actorId: pet.id, intent: { type: 'move', dir: 'left' } }]);
    expect(pet.components.position).toEqual({ x: 0, y: 0 });
    expect(events.find((e) => e.type === 'action.resolved')?.data.reason).toBe('blocked');
  });
});

describe('inventario', () => {
  it('recoge y suelta conservando la entidad', () => {
    const { world, pet } = buildTestWorld();
    const branch = spawnBranch(world, 2, 2);

    stepWorld(world, [{ actorId: pet.id, intent: { type: 'pickup', targetId: branch.id } }]);
    expect(pet.components.inventory?.items).toEqual([branch.id]);
    expect(branch.components.position).toBeUndefined();

    stepWorld(world, [{ actorId: pet.id, intent: { type: 'drop', itemId: branch.id } }]);
    expect(pet.components.inventory?.items).toEqual([]);
    expect(branch.components.position).toEqual(pet.components.position);
  });

  it('no recoge fuera de alcance ni sin capacidad', () => {
    const { world, pet } = buildTestWorld();
    const far = spawnFood(world, 5, 4);
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'pickup', targetId: far.id } },
    ]);
    expect(events.find((e) => e.type === 'action.resolved')?.data.reason).toBe('out-of-reach');

    pet.components.inventory = { items: [], capacity: 0 };
    const near = spawnFood(world, 1, 1);
    const events2 = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'pickup', targetId: near.id } },
    ]);
    expect(events2.find((e) => e.type === 'action.resolved')?.data.reason).toBe('inventory-full');
  });

  it('no recoge una pared', () => {
    const { world, pet } = buildTestWorld();
    const wall = spawnWall(world, 1, 1);
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'pickup', targetId: wall.id } },
    ]);
    expect(events.find((e) => e.type === 'action.resolved')?.data.reason).toBe('not-portable');
  });
});

describe('consumo y energía', () => {
  it('consumir alimento recupera energía y destruye el item', () => {
    const { world, pet } = buildTestWorld();
    const food = spawnFood(world, 1, 1);
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'consume', targetId: food.id } },
    ]);
    const consumed = events.find((e) => e.type === 'item.consumed');
    expect(consumed?.data.nutrition).toBe(25);
    expect(pet.components.energy?.current).toBeCloseTo(45 - 0.1, 5);
    expect(world.entities[food.id]).toBeUndefined();
  });

  it('la energía se satura en el máximo', () => {
    const { world, pet } = buildTestWorld();
    pet.components.energy = { current: 49, max: 50, decayPerTick: 0 };
    const food = spawnFood(world, 1, 1);
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'consume', targetId: food.id } }]);
    expect(pet.components.energy.current).toBe(50);
  });

  it('no consume algo no comestible', () => {
    const { world, pet } = buildTestWorld();
    const branch = spawnBranch(world, 1, 1);
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'consume', targetId: branch.id } },
    ]);
    expect(events.find((e) => e.type === 'action.resolved')?.data.reason).toBe('not-edible');
  });
});

describe('herramientas y daño', () => {
  it('una rama no daña una pared más dura que su poder efectivo', () => {
    const { world, pet } = buildTestWorld();
    const wall = spawnWall(world, 2, 2);
    const branch = spawnBranch(world, 1, 1);
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'pickup', targetId: branch.id } }]);

    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: branch.id, targetId: wall.id } },
    ]);
    const damaged = events.find((e) => e.type === 'entity.damaged');
    // fuerza 2 + poder 1 = 3 < dureza 5 => daño 0
    expect(damaged?.data.damage).toBe(0);
    expect(wall.components.durability?.current).toBe(10);
    // La rama se desgasta aunque no cause daño.
    expect(branch.components.durability?.current).toBe(7);
  });

  it('un martillo destruye la pared en dos golpes', () => {
    const { world, pet } = buildTestWorld();
    const wall = spawnWall(world, 2, 2);
    const hammer = spawnHammer(world, 1, 1);
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'pickup', targetId: hammer.id } }]);

    // fuerza 2 + poder 8 = 10 - dureza 5 => daño 5 por golpe, durabilidad 10.
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: hammer.id, targetId: wall.id } },
    ]);
    expect(wall.components.durability?.current).toBe(5);
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: hammer.id, targetId: wall.id } },
    ]);
    expect(events.some((e) => e.type === 'entity.destroyed')).toBe(true);
    expect(world.entities[wall.id]).toBeUndefined();
  });

  it('la herramienta se rompe al agotar su durabilidad', () => {
    const { world, pet } = buildTestWorld();
    const wall = spawnWall(world, 2, 2);
    wall.components.durability = { current: 1000, max: 1000 };
    const branch = spawnBranch(world, 1, 1);
    branch.components.durability = { current: 2, max: 2 };
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'pickup', targetId: branch.id } }]);

    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: branch.id, targetId: wall.id } },
    ]);
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: branch.id, targetId: wall.id } },
    ]);
    expect(events.some((e) => e.type === 'tool.broke')).toBe(true);
    expect(world.entities[branch.id]).toBeUndefined();
    expect(pet.components.inventory?.items).toEqual([]);
  });

  it('no usa un item que no tiene en el inventario', () => {
    const { world, pet } = buildTestWorld();
    const wall = spawnWall(world, 2, 2);
    const hammer = spawnHammer(world, 1, 1);
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: hammer.id, targetId: wall.id } },
    ]);
    expect(events.find((e) => e.type === 'action.resolved')?.data.reason).toBe('item-not-held');
  });
});
