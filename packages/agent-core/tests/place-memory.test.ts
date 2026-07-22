import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, Perception, PerceivedEntity, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, removeEntity, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, PLACE_MEMORY_CAP, PlaceMemory } from '../src/index.js';

/**
 * Memoria de lugares: la mascota recuerda dónde vio por última vez lo que le
 * importa, construida SOLO con percepciones pasadas. Puede mentir —el mundo
 * cambia a sus espaldas— y descubrirlo invalida el recuerdo y cuenta como
 * fallo honesto ante el controlador de progreso.
 */

function smallWorld(): { world: WorldState; petId: EntityId; foodId: EntityId } {
  const world = createWorld({ width: 10, height: 5, seed: 1 });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    // Rango corto a propósito: lo recordado tiene que poder salirse de él.
    agent: { name: 'Anima', perceptionRange: 3 },
  }).id;
  const foodId = spawn(world, 'food', {
    position: { x: 4, y: 2 },
    portable: {},
    edible: {},
    nutrition: { value: 30 },
  }).id;
  return { world, petId, foodId };
}

function makeAgent(petId: EntityId) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider: new MockModelProvider(),
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: true,
    now: () => '2026-07-16T00:00:00Z',
  });
}

async function tick(world: WorldState, petId: EntityId, agent: AnimaAgent) {
  const intent = await agent.think(buildPerception(world, petId));
  agent.observe(stepWorld(world, [{ actorId: petId, intent: intent ?? { type: 'wait' } }]));
}

/** Ve la comida, se aleja de ella (fuera de rango) y le baja la energía. */
async function seeFoodThenMoveAway(
  world: WorldState,
  petId: EntityId,
  agent: AnimaAgent,
): Promise<void> {
  await tick(world, petId, agent); // percibe y recuerda
  const pet = world.entities[petId]!;
  pet.components.position = { x: 8, y: 2 };
  pet.components.energy!.current = 15;
}

describe('memoria de lugares', () => {
  it('recuerda dónde vio la comida y vuelve a buscarla cuando tiene hambre', async () => {
    const { world, petId, foodId } = smallWorld();
    const agent = makeAgent(petId);
    await seeFoodThenMoveAway(world, petId, agent);

    for (let i = 0; i < 15 && world.entities[foodId]; i++) await tick(world, petId, agent);

    // Fue a donde la recordaba y se la comió, sin haberla visto al planificar.
    expect(world.entities[foodId]).toBeUndefined();
    const strategies = agent.events
      .ofType('strategy.selected')
      .map((e) => String(e.data.strategy));
    expect(strategies.some((s) => s.startsWith('comida-recordada:'))).toBe(true);
  });

  it('si al llegar ya no está, el recuerdo se invalida y el fallo queda registrado', async () => {
    const { world, petId, foodId } = smallWorld();
    const agent = makeAgent(petId);
    await seeFoodThenMoveAway(world, petId, agent);
    removeEntity(world, foodId); // el mundo cambió a sus espaldas

    for (let i = 0; i < 15; i++) await tick(world, petId, agent);

    expect(agent.events.ofType('place.invalidated').length).toBeGreaterThan(0);
    expect(agent.places.all().some((p) => p.entityId === foodId)).toBe(false);
    // El fallo alimentó al controlador de progreso, con su razón honesta.
    const failed = agent.events
      .ofType('strategy.failed')
      .filter((e) => String(e.data.strategy).startsWith('comida-recordada:'));
    expect(failed.length).toBeGreaterThan(0);
    expect(String(failed[0]?.data.reason)).toContain('no-candidates');
  });

  it('lo que come con sus propias manos se borra del mapa mental', async () => {
    const { world, petId, foodId } = smallWorld();
    const agent = makeAgent(petId);
    world.entities[petId]!.components.energy!.current = 15;

    for (let i = 0; i < 12 && world.entities[foodId]; i++) await tick(world, petId, agent);

    expect(world.entities[foodId]).toBeUndefined();
    expect(agent.places.all().some((p) => p.entityId === foodId)).toBe(false);
  });

  it('la memoria de lugares sobrevive a guardar y restaurar', async () => {
    const { world, petId, foodId } = smallWorld();
    const agent = makeAgent(petId);
    await tick(world, petId, agent);
    expect(agent.places.all().some((p) => p.entityId === foodId)).toBe(true);

    const successor = makeAgent(petId);
    successor.importState(agent.exportState());

    expect(successor.places.all().some((p) => p.entityId === foodId)).toBe(true);
  });

  it('un guardado anterior a la memoria de lugares se restaura sin recuerdos', () => {
    const { petId } = smallWorld();
    const agent = makeAgent(petId);
    const state = agent.exportState();
    delete (state as { places?: unknown }).places;

    const successor = makeAgent(petId);
    successor.importState(state);

    expect(successor.places.all()).toHaveLength(0);
  });

  it('tiene tope: al superarlo olvida lo visto hace más tiempo', () => {
    const memory = new PlaceMemory();
    const fakePerception = (tick: number, entities: PerceivedEntity[]): Perception => ({
      tick,
      timeOfDay: 'day',
      self: { id: 'e1', position: { x: 0, y: 0 }, heldItems: [], inventoryCapacity: 6 },
      drawnKinds: [],
      illustratedWorks: [],
      visibleEntities: entities,
      recipes: [],
      interactions: [],
      blueprints: [],
      decompositions: [],
    });
    for (let i = 0; i < PLACE_MEMORY_CAP + 6; i++) {
      memory.update(
        fakePerception(i, [
          { id: `e${i + 2}`, kind: 'food', position: { x: i, y: 0 }, edible: true },
        ]),
      );
    }

    expect(memory.all()).toHaveLength(PLACE_MEMORY_CAP);
    // Los primeros seis, los más viejos, fueron olvidados.
    expect(memory.all().some((p) => p.entityId === 'e2')).toBe(false);
    expect(memory.all().some((p) => p.entityId === `e${PLACE_MEMORY_CAP + 7}`)).toBe(true);
  });
});
