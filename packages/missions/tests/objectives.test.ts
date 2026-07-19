import { describe, expect, it } from 'vitest';
import { createWorld, spawn, stepWorld } from '@anima/sim-core';
import type { WorldState } from '@anima/sim-core';
import type { Mission } from '../src/map.js';
import { MissionTracker } from '../src/tracker.js';

function worldWithPet(): { world: WorldState; petId: string } {
  const world = createWorld({ width: 6, height: 3, seed: 1 });
  const petId = spawn(world, 'pet', {
    position: { x: 0, y: 1 },
    collider: { solid: true },
    strength: { value: 2 },
    inventory: { items: [], capacity: 4 },
    agent: { name: 'Anima', perceptionRange: 5 },
  }).id;
  return { world, petId };
}

function mission(objectives: Mission['objectives']): Mission {
  return {
    id: 'prueba',
    name: 'prueba',
    briefing: '',
    tests: [],
    zones: [{ id: 'meta', label: 'la meta', x: 5, y: 0, width: 1, height: 3 }],
    objectives,
  };
}

describe('el juez de misiones', () => {
  it('no cuenta como creado lo que ya estaba sembrado', () => {
    const { world, petId } = worldWithPet();
    spawn(world, 'tronco', { position: { x: 2, y: 1 }, portable: {} });
    const tracker = new MissionTracker(
      mission([
        {
          id: 'algo-nuevo',
          describe: 'algo nacido en la partida',
          kind: 'entity-exists',
          query: { createdDuringRun: true },
        },
      ]),
      world,
      petId,
    );
    expect(tracker.evaluate(world).completed).toBe(false);

    // Nace una entidad después de arrancar: eso sí cuenta.
    spawn(world, 'tronco', { position: { x: 3, y: 1 }, portable: {} });
    expect(tracker.evaluate(world).completed).toBe(true);
  });

  it('no cuenta como tipo nuevo lo que una receta sembrada ya sabía producir', () => {
    const world = createWorld({ width: 4, height: 3, seed: 1 }, {
      recipes: [
        {
          id: 'silla',
          ingredients: [{ kind: 'tronco', count: 1 }],
          outcomes: [{ weight: 1, output: { kind: 'silla', components: { portable: {} } } }],
        },
      ],
    });
    const petId = spawn(world, 'pet', { position: { x: 0, y: 0 }, agent: { name: 'A', perceptionRange: 3 } }).id;
    const tracker = new MissionTracker(
      mission([
        {
          id: 'tipo-nuevo',
          describe: 'un tipo que no existía',
          kind: 'entity-exists',
          query: { kindIsNew: true },
        },
      ]),
      world,
      petId,
    );
    spawn(world, 'silla', { position: { x: 1, y: 0 }, portable: {} });
    expect(tracker.evaluate(world).completed).toBe(false);

    spawn(world, 'balsa', { position: { x: 2, y: 0 }, portable: {} });
    expect(tracker.evaluate(world).completed).toBe(true);
  });

  it('distingue colocar de soltar: solo `place` cuenta como colocado', () => {
    const { world, petId } = worldWithPet();
    const pet = world.entities[petId]!;
    const tabla = spawn(world, 'tabla', { portable: {} });
    pet.components.inventory!.items.push(tabla.id);
    const tracker = new MissionTracker(
      mission([
        {
          id: 'colocado',
          describe: 'algo colocado',
          kind: 'entity-exists',
          query: { placed: true },
        },
      ]),
      world,
      petId,
    );

    tracker.observe(stepWorld(world, [{ actorId: petId, intent: { type: 'drop', itemId: tabla.id } }]));
    expect(tracker.evaluate(world).completed).toBe(false);

    // Se la vuelve a levantar y ahora se COLOCA.
    tracker.observe(
      stepWorld(world, [{ actorId: petId, intent: { type: 'pickup', targetId: tabla.id } }]),
    );
    tracker.observe(
      stepWorld(world, [{ actorId: petId, intent: { type: 'place', itemId: tabla.id, at: { x: 1, y: 0 } } }]),
    );
    expect(tracker.evaluate(world).completed).toBe(true);
  });

  it('`path-open` usa la misma física que el motor: el agua corta el paso', () => {
    const { world, petId } = worldWithPet();
    for (let y = 0; y < 3; y++) spawn(world, 'agua', { position: { x: 3, y }, water: {} });
    const tracker = new MissionTracker(
      mission([
        {
          id: 'paso',
          describe: 'hay paso',
          kind: 'path-open',
          from: { x: 0, y: 1 },
          to: { x: 5, y: 1 },
        },
      ]),
      world,
      petId,
    );
    expect(tracker.evaluate(world).completed).toBe(false);

    // El motor tampoco deja pasar: la comprobación no es una opinión aparte.
    const events = stepWorld(world, [{ actorId: petId, intent: { type: 'move', dir: 'right' } }]);
    stepWorld(world, [{ actorId: petId, intent: { type: 'move', dir: 'right' } }]);
    const blocked = stepWorld(world, [{ actorId: petId, intent: { type: 'move', dir: 'right' } }]);
    expect(events.length).toBeGreaterThan(0);
    expect(blocked.some((e) => e.type === 'action.resolved' && e.data.reason === 'water')).toBe(true);
  });

  it('una secuencia rechaza el orden invertido', () => {
    const { world, petId } = worldWithPet();
    const tracker = new MissionTracker(
      mission([
        {
          id: 'llego',
          describe: 'llegó a la meta',
          kind: 'agent-in-zone',
          zone: 'meta',
        },
        {
          id: 'construyo',
          describe: 'construyó algo',
          kind: 'entity-exists',
          query: { createdDuringRun: true },
        },
        {
          id: 'en-orden',
          describe: 'construyó antes de llegar',
          kind: 'sequence',
          of: ['construyo', 'llego'],
        },
      ]),
      world,
      petId,
    );

    // Llega primero...
    world.entities[petId]!.components.position = { x: 5, y: 1 };
    world.tick = 5;
    tracker.evaluate(world);
    // ...y construye después: la secuencia queda incumplida para siempre.
    world.tick = 9;
    spawn(world, 'muro', { position: { x: 2, y: 0 } });
    const status = tracker.evaluate(world);
    expect(status.objectives.find((o) => o.id === 'llego')?.met).toBe(true);
    expect(status.objectives.find((o) => o.id === 'construyo')?.met).toBe(true);
    expect(status.objectives.find((o) => o.id === 'en-orden')?.met).toBe(false);
    expect(status.completed).toBe(false);
  });

  it('transformar no es destruir: romper la entidad no cumple el objetivo', () => {
    const { world, petId } = worldWithPet();
    const brote = spawn(world, 'brote-seco', {
      position: { x: 1, y: 1 },
      durability: { current: 1, max: 1 },
      hardness: { value: 0 },
    });
    const objectives: Mission['objectives'] = [
      {
        id: 'sin-brote-seco',
        describe: 'no queda brote seco',
        kind: 'no-entity',
        query: { kind: 'brote-seco' },
      },
      {
        id: 'transformado',
        describe: 'lo que ya estaba cambió a un tipo nuevo',
        kind: 'entity-exists',
        query: { createdDuringRun: false, kindIsNew: true },
      },
    ];

    const roto = new MissionTracker(mission(objectives), world, petId);
    const hacha = spawn(world, 'hacha', { tool: { power: 5 } });
    world.entities[petId]!.components.inventory!.items.push(hacha.id);
    roto.observe(
      stepWorld(world, [
        { actorId: petId, intent: { type: 'useItem', itemId: hacha.id, targetId: brote.id } },
      ]),
    );
    const status = roto.evaluate(world);
    expect(status.objectives.find((o) => o.id === 'sin-brote-seco')?.met).toBe(true);
    // Se rompió, no se transformó: la misión NO está superada.
    expect(status.objectives.find((o) => o.id === 'transformado')?.met).toBe(false);
    expect(status.completed).toBe(false);
  });

  it('una entidad preexistente que cambia de tipo sí cuenta como transformada', () => {
    const { world, petId } = worldWithPet();
    const brote = spawn(world, 'brote-seco', { position: { x: 1, y: 1 } });
    const tracker = new MissionTracker(
      mission([
        {
          id: 'transformado',
          describe: 'lo que ya estaba cambió a un tipo nuevo',
          kind: 'entity-exists',
          query: { createdDuringRun: false, kindIsNew: true },
        },
      ]),
      world,
      petId,
    );
    expect(tracker.evaluate(world).completed).toBe(false);
    brote.kind = 'brote-regado';
    expect(tracker.evaluate(world).completed).toBe(true);
  });

  it('lo que Ánima diga no mueve la aguja', () => {
    const { world, petId } = worldWithPet();
    const tracker = new MissionTracker(
      mission([
        {
          id: 'llego',
          describe: 'llegó a la meta',
          kind: 'agent-in-zone',
          zone: 'meta',
        },
      ]),
      world,
      petId,
    );
    tracker.observe(
      stepWorld(world, [{ actorId: petId, intent: { type: 'speak', text: 'ya llegué a la meta' } }]),
    );
    expect(tracker.evaluate(world).completed).toBe(false);
  });
});
