import { describe, expect, it } from 'vitest';
import type { Interaction } from '../src/index.js';
import {
  MAX_INTERACTIONS,
  restoreSnapshot,
  spawn,
  stepWorld,
  takeSnapshot,
  validateInteraction,
} from '../src/index.js';
import type { WorldSnapshot } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

/**
 * Interacciones inventadas (ADR 0027): Ánima propone, la puerta determinista
 * filtra la física, y el mundo guarda la regla. Una vez adentro, ejecutarla es
 * física de siempre: postura, objetivo y requisitos se comprueban de nuevo
 * cada vez — saber la interacción no exime de estar donde hay que estar.
 */

const SCOOP_WATER: Interaction = {
  id: 'juntar-agua',
  description: 'juntar agua con un balde',
  stance: 'beside',
  target: { wet: true },
  requires: { heldKind: 'balde' },
  effects: [{ type: 'transform-held', kind: 'balde-con-agua', components: { portable: {} } }],
};

describe('validateInteraction: la puerta de la física', () => {
  it('acepta una interacción coherente con las cotas', () => {
    const result = validateInteraction(SCOOP_WATER);
    expect(result.ok).toBe(true);
  });

  it('rechaza duplicados y el tope del mundo', () => {
    const dup = validateInteraction(SCOOP_WATER, [structuredClone(SCOOP_WATER)]);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toContain('ya existe');

    const full = Array.from({ length: MAX_INTERACTIONS }, (_, i) => ({
      ...structuredClone(SCOOP_WATER),
      id: `interaccion-${i}`,
    }));
    const overflow = validateInteraction(SCOOP_WATER, full);
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.error).toContain('no admite más');
  });

  it('sin efectos solo valen las posturas: al lado no pasa nada', () => {
    const idle = validateInteraction({
      id: 'mirar-piedra',
      description: 'mirar una piedra',
      stance: 'beside',
      target: { kind: 'stone' },
      effects: [],
    });
    expect(idle.ok).toBe(false);

    const mount = validateInteraction({
      id: 'subirse-piedra',
      description: 'subirse a una piedra',
      stance: 'on-top',
      target: { kind: 'stone' },
      effects: [],
    });
    expect(mount.ok).toBe(true);
  });

  it('transformar lo que lleva exige declarar qué lleva', () => {
    const result = validateInteraction({
      ...structuredClone(SCOOP_WATER),
      id: 'juntar-sin-balde',
      requires: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('requires');
  });

  it('nada se transforma en lo protegido ni gana componentes de cuerpo', () => {
    const intoFood = validateInteraction({
      id: 'convertir-en-comida',
      description: 'convertir una rama en comida',
      stance: 'held',
      target: { kind: 'branch' },
      requires: { heldKind: 'branch' },
      effects: [{ type: 'transform-held', kind: 'food', components: { portable: {} } }],
    });
    expect(intoFood.ok).toBe(false);

    const edible = validateInteraction({
      id: 'endulzar-rama',
      description: 'endulzar una rama',
      stance: 'held',
      target: { kind: 'branch' },
      requires: { heldKind: 'branch' },
      effects: [
        { type: 'transform-held', kind: 'golosina', components: { edible: {} } as never },
      ],
    });
    expect(edible.ok).toBe(false);
  });
});

describe('proponer e interactuar en el mundo', () => {
  function worldWithPondAndBucket() {
    const built = buildTestWorld();
    const water = spawn(built.world, 'water', { position: { x: 3, y: 2 }, water: {} });
    const bucket = spawn(built.world, 'balde', { portable: {} });
    built.pet.components.inventory!.items.push(bucket.id);
    return { ...built, water, bucket };
  }

  it('proposeInteraction pasa por la puerta y aprende; interact transforma el balde', () => {
    const { world, pet, water, bucket } = worldWithPondAndBucket();

    let events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeInteraction', interaction: SCOOP_WATER } },
    ]);
    expect(events.some((e) => e.type === 'interaction.learned')).toBe(true);
    expect(world.interactions.map((i) => i.id)).toEqual(['juntar-agua']);

    // Pegada a la orilla (pet en (1,2), agua en (3,2)): primero acercarse.
    pet.components.position = { x: 2, y: 2 };
    events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: { type: 'interact', interactionId: 'juntar-agua', targetId: water.id },
      },
    ]);
    const performed = events.find((e) => e.type === 'interaction.performed');
    expect(performed).toBeDefined();
    expect(world.entities[bucket.id]!.kind).toBe('balde-con-agua');
    // El estanque no se gasta: el agua es terreno, no un recurso.
    expect(world.entities[water.id]!.components.water).toBeDefined();
  });

  it('la postura se comprueba cada vez: lejos falla, sin balde falla', () => {
    const { world, pet, water, bucket } = worldWithPondAndBucket();
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeInteraction', interaction: SCOOP_WATER } },
    ]);

    // Lejos del agua: out-of-reach.
    let events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: { type: 'interact', interactionId: 'juntar-agua', targetId: water.id },
      },
    ]);
    let resolution = events.find((e) => e.type === 'action.resolved' && e.data.action === 'interact');
    expect(resolution?.data.success).toBe(false);
    expect(resolution?.data.reason).toBe('out-of-reach');

    // Al lado pero sin el balde: missing-required-item.
    pet.components.position = { x: 2, y: 2 };
    pet.components.inventory!.items.length = 0;
    delete world.entities[bucket.id];
    events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: { type: 'interact', interactionId: 'juntar-agua', targetId: water.id },
      },
    ]);
    resolution = events.find((e) => e.type === 'action.resolved' && e.data.action === 'interact');
    expect(resolution?.data.success).toBe(false);
    expect(resolution?.data.reason).toBe('missing-required-item');
  });

  it('el agua no se transforma: la guardia de ejecución la protege', () => {
    const { world, pet, water } = worldWithPondAndBucket();
    const freeze: Interaction = {
      id: 'congelar-agua',
      description: 'congelar el agua a voluntad',
      stance: 'beside',
      target: { wet: true },
      effects: [{ type: 'transform-target', kind: 'hielo', components: { collider: { solid: true } } }],
    };
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeInteraction', interaction: freeze } },
    ]);
    pet.components.position = { x: 2, y: 2 };
    const events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: { type: 'interact', interactionId: 'congelar-agua', targetId: water.id },
      },
    ]);
    const resolution = events.find((e) => e.type === 'action.resolved' && e.data.action === 'interact');
    expect(resolution?.data.success).toBe(false);
    expect(resolution?.data.reason).toBe('target-immutable');
    expect(world.entities[water.id]!.kind).toBe('water');
  });

  it('on-top: llegar al lado alcanza, el acto la sube — también sobre sólidos', () => {
    const { world, pet } = buildTestWorld();
    // Sólida a propósito: caminando sería impisable, pero subirse ES la
    // interacción (la cama, la silla). Sin esto, "subite a la silla" — el
    // ejemplo del ADR 0027 — no existiría.
    const stone = spawn(world, 'stone', {
      position: { x: 4, y: 2 },
      collider: { solid: true },
    });
    const mount: Interaction = {
      id: 'subirse-piedra',
      description: 'subirse a una piedra',
      stance: 'on-top',
      target: { kind: 'stone' },
      effects: [],
    };
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeInteraction', interaction: mount } },
    ]);

    // Lejos no alcanza: hay que llegar hasta el objeto.
    pet.components.position = { x: 1, y: 2 };
    let events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: { type: 'interact', interactionId: 'subirse-piedra', targetId: stone.id },
      },
    ]);
    const missed = events.find((e) => e.type === 'action.resolved' && e.data.action === 'interact');
    expect(missed?.data.reason).toBe('not-on-target');
    expect(pet.components.position).toEqual({ x: 1, y: 2 });

    // Adyacente sí: la interacción la sube a la celda del objeto y el evento
    // conserva la postura para que el dibujo la respete.
    pet.components.position = { x: 3, y: 2 };
    events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: { type: 'interact', interactionId: 'subirse-piedra', targetId: stone.id },
      },
    ]);
    const performed = events.find((e) => e.type === 'interaction.performed');
    expect(performed?.data.stance).toBe('on-top');
    expect(pet.components.position).toEqual({ x: 4, y: 2 });
  });

  it('sobre el agua no hay postura que valga', () => {
    const { world, pet } = buildTestWorld();
    const pond = spawn(world, 'water', { position: { x: 4, y: 2 }, water: {} });
    const walk: Interaction = {
      id: 'pararse-agua',
      description: 'pararse sobre el agua',
      stance: 'on-top',
      target: { wet: true },
      effects: [],
    };
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeInteraction', interaction: walk } },
    ]);
    pet.components.position = { x: 3, y: 2 };
    const events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: { type: 'interact', interactionId: 'pararse-agua', targetId: pond.id },
      },
    ]);
    const resolution = events.find(
      (e) => e.type === 'action.resolved' && e.data.action === 'interact',
    );
    expect(resolution?.data.success).toBe(false);
    expect(resolution?.data.reason).toBe('target-not-mountable');
    expect(pet.components.position).toEqual({ x: 3, y: 2 });
  });

  it('el mundo rechaza lo que la puerta no admite, con el motivo', () => {
    const { world, pet } = buildTestWorld();
    const events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: { type: 'proposeInteraction', interaction: { id: 'x' } },
      },
    ]);
    const rejected = events.find((e) => e.type === 'interaction.rejected');
    expect(rejected).toBeDefined();
    expect(String(rejected?.data.reason)).toContain('Interacción inválida');
    expect(world.interactions).toHaveLength(0);
  });

  it('las interacciones viajan en el snapshot, y un guardado viejo llega sin ninguna', () => {
    const { world, pet } = worldWithPondAndBucket();
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeInteraction', interaction: SCOOP_WATER } },
    ]);

    const restored = restoreSnapshot(takeSnapshot(world));
    expect(restored.interactions.map((i) => i.id)).toEqual(['juntar-agua']);

    // Un snapshot anterior a las interacciones no trae el campo.
    const legacy = structuredClone(takeSnapshot(world)) as unknown as {
      version: 1;
      state: Record<string, unknown>;
    };
    delete legacy.state.interactions;
    expect(restoreSnapshot(legacy as unknown as WorldSnapshot).interactions).toEqual([]);
  });
});
