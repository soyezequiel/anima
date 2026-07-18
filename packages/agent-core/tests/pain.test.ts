import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { CAMPFIRE_RECIPE, MVP_SCENARIOS, withoutChance } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * El dolor es un reflejo del cuerpo: salirse de lo que daña va antes que
 * conversar, planificar o continuar cualquier actividad. Sin esto, la mascota
 * se quedaba dentro de un fuego perdiendo salud hasta morir — incluida la
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

/**
 * Un tick de quemarse antes de que el agente piense. El fuego solo lastima a
 * quien está encima (ADR 0041), así que para probar el reflejo hay que
 * ponerla adentro: el golpe que lo dispara tiene que existir.
 */
function burnOnce(world: WorldState, petId: EntityId, agent: AnimaAgent): void {
  agent.observe(stepWorld(world, [{ actorId: petId, intent: { type: 'wait' } }]));
}

describe('reflejo de dolor', () => {
  it('dentro de un fuego: se quema UNA vez, se sale y no vuelve a quemarse', async () => {
    const { world, petId } = worldWithPet();
    addFire(world, 4, 2); // debajo de sus pies
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;

    burnOnce(world, petId, agent);
    for (let i = 0; i < 6; i++) await tick(world, petId, agent);

    // Un solo golpe: el del tick en que aún no sabía. Después, afuera.
    expect(pet.components.health!.current).toBe(9);
    const distance = Math.max(
      Math.abs(pet.components.position!.x - 4),
      Math.abs(pet.components.position!.y - 2),
    );
    expect(distance).toBeGreaterThanOrEqual(1);
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

  it('el dolor deja conocimiento: sabe que meterse en esa cosa daña', async () => {
    const { world, petId } = worldWithPet();
    addFire(world, 4, 2);
    const agent = makeAgent(petId);

    burnOnce(world, petId, agent);
    for (let i = 0; i < 4; i++) await tick(world, petId, agent);

    expect(
      agent.memory.factList().some((f) => f.statement === 'estar encima de un fogata hace daño'),
    ).toBe(true);
  });

  it('el reflejo interrumpe pero no cancela: la actividad del usuario continúa', async () => {
    const { world, petId } = worldWithPet();
    const fireId = addFire(world, 4, 2);
    const agent = makeAgent(petId);

    // Orden en curso mientras se quema: primero se aparta, después obedece.
    agent.receiveUserMessage('espera un momento');
    burnOnce(world, petId, agent);
    for (let i = 0; i < 8; i++) await tick(world, petId, agent);

    expect(agent.events.ofType('pain.reflex').length).toBeGreaterThan(0);
    // La petición no se perdió: la respuesta de completada llegó igual.
    expect(agent.events.ofType('user.request.accepted')).toHaveLength(1);
    expect(world.entities[fireId]).toBeDefined();
  });

  /**
   * La muerte de la corrida real (semilla 5, tick 980): el pedernal que le
   * faltaba para la antorcha estaba en la celda de al lado de su propia
   * fogata. Con el daño por adyacencia, cada paso hacia el pedernal costaba
   * salud, el reflejo la sacaba y el plan la volvía a meter — ocho tics hasta
   * morir. Con el fuego quemando solo por dentro (ADR 0041) el recurso es
   * alcanzable y no hay oscilación posible.
   */
  it('un recurso pegado al fuego se puede juntar sin perder salud', async () => {
    const { world, petId } = worldWithPet();
    const pet = world.entities[petId]!;
    pet.components.position = { x: 4, y: 3 };
    addFire(world, 5, 2);
    const flint = spawn(world, 'flint', { position: { x: 4, y: 2 }, portable: {} });
    const agent = makeAgent(petId);

    for (let i = 0; i < 20; i++) await tick(world, petId, agent);

    expect(pet.components.dead).toBeUndefined();
    expect(pet.components.health!.current).toBe(10);
    expect(agent.events.ofType('pain.reflex')).toHaveLength(0);
    // El pedernal sigue ahí para quien lo quiera: el mundo ya no lo custodia.
    expect(world.entities[flint.id]).toBeDefined();
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
