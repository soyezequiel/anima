import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { CAMPFIRE_RECIPE, MVP_SCENARIOS, withoutChance } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * El dolor es un reflejo del cuerpo: apartarse de lo que daña va antes que
 * conversar, planificar o continuar cualquier actividad. Sin esto, la mascota
 * se quedaba pegada a un fuego perdiendo salud hasta morir — incluida la
 * fogata que ella misma acababa de construir.
 */

function worldWithPet(): { world: WorldState; petId: EntityId } {
  // Sin tirada: el reflejo ante el fuego no puede depender de que el fuego
  // haya prendido esta vez.
  const world = createWorld(
    { width: 9, height: 5, seed: 1 },
    { recipes: [withoutChance(CAMPFIRE_RECIPE)] },
  );
  const petId = spawn(world, 'pet', {
    position: { x: 4, y: 2 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  return { world, petId };
}

function addFire(world: WorldState, x: number, y: number): EntityId {
  return spawn(world, 'campfire', {
    position: { x, y },
    heatSource: { warmthPerTick: 0.3, range: 2 },
    hazard: { damagePerTick: 1 },
  }).id;
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
    guidanceEnabled: false,
    now: () => '2026-07-16T00:00:00Z',
  });
}

async function tick(world: WorldState, petId: EntityId, agent: AnimaAgent) {
  const intent = await agent.think(buildPerception(world, petId));
  agent.observe(stepWorld(world, [{ actorId: petId, intent: intent ?? { type: 'wait' } }]));
}

describe('reflejo de dolor', () => {
  it('pegada a un fuego: se quema UNA vez, se aparta y no vuelve a quemarse', async () => {
    const { world, petId } = worldWithPet();
    addFire(world, 5, 2); // adyacente
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;

    for (let i = 0; i < 6; i++) await tick(world, petId, agent);

    // Un solo golpe: el del tick en que aún no sabía. Después, distancia.
    expect(pet.components.health!.current).toBe(9);
    const distance = Math.max(
      Math.abs(pet.components.position!.x - 5),
      Math.abs(pet.components.position!.y - 2),
    );
    expect(distance).toBeGreaterThan(1);
    expect(agent.events.ofType('pain.reflex').length).toBeGreaterThan(0);
  });

  it('construir una fogata ya no es quedarse a morir junto a ella', async () => {
    const { world, petId } = worldWithPet();
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;
    for (const kind of ['log', 'log', 'flint']) {
      const item = spawn(world, kind, { portable: {} });
      pet.components.inventory!.items.push(item.id);
    }

    // Construye (queda adyacente al fuego) y vive los ticks siguientes.
    agent.observe(stepWorld(world, [{ actorId: petId, intent: { type: 'craft', recipeId: 'campfire' } }]));
    for (let i = 0; i < 8; i++) await tick(world, petId, agent);

    expect(pet.components.dead).toBeUndefined();
    expect(pet.components.health!.current).toBeGreaterThanOrEqual(8);
  });

  it('el dolor deja conocimiento: sabe que ese tipo de cosa daña de cerca', async () => {
    const { world, petId } = worldWithPet();
    addFire(world, 5, 2);
    const agent = makeAgent(petId);

    for (let i = 0; i < 4; i++) await tick(world, petId, agent);

    expect(
      agent.memory.factList().some((f) => f.statement === 'estar pegado a un fogata hace daño'),
    ).toBe(true);
  });

  it('el reflejo interrumpe pero no cancela: la actividad del usuario continúa', async () => {
    const { world, petId } = worldWithPet();
    const fireId = addFire(world, 5, 2);
    const agent = makeAgent(petId);

    // Orden en curso mientras se quema: primero se aparta, después obedece.
    agent.receiveUserMessage('espera un momento');
    for (let i = 0; i < 8; i++) await tick(world, petId, agent);

    expect(agent.events.ofType('pain.reflex').length).toBeGreaterThan(0);
    // La petición no se perdió: la respuesta de completada llegó igual.
    expect(agent.events.ofType('user.request.accepted')).toHaveLength(1);
    expect(world.entities[fireId]).toBeDefined();
  });

  it('sin daño no hay reflejo: el calor sin hazard no la espanta', async () => {
    const { world, petId } = worldWithPet();
    spawn(world, 'torch', {
      position: { x: 5, y: 2 },
      heatSource: { warmthPerTick: 0.2, range: 1 },
    });
    const agent = makeAgent(petId);

    for (let i = 0; i < 4; i++) await tick(world, petId, agent);

    expect(agent.events.ofType('pain.reflex')).toHaveLength(0);
  });
});
