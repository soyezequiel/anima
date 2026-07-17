import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, GOAL_BE_SAFE, GOAL_RESTORE_ENERGY } from '../src/index.js';

/**
 * El dolor como MOTIVO, no solo como reflejo: cuando la salud cae bajo el
 * umbral y el peligro sigue al alcance, nace el objetivo «ponerse a salvo»,
 * por encima del hambre. El reflejo de un paso (painReflex) queda intacto:
 * esto es lo que pasa cuando ese paso no existe.
 */

function hurtWorld(options: { health?: number; energy?: number } = {}): {
  world: WorldState;
  petId: EntityId;
} {
  const world = createWorld({ width: 9, height: 5, seed: 1 });
  const petId = spawn(world, 'pet', {
    // Pegada al fuego, con la única escapada de un paso tapada: el reflejo
    // no alcanza (los pasos laterales siguen a distancia 1) y hace falta un
    // plan de más de un paso.
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: options.energy ?? 45, max: 50, decayPerTick: 0.01 },
    health: { current: options.health ?? 4, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  spawn(world, 'campfire', {
    position: { x: 2, y: 2 },
    heatSource: { warmthPerTick: 0.3, range: 2 },
    hazard: { damagePerTick: 1 },
  });
  spawn(world, 'wall', {
    position: { x: 0, y: 2 },
    collider: { solid: true },
    hardness: { value: 5 },
    durability: { current: 10, max: 10 },
  });
  return { world, petId };
}

/** Encerrada del todo: muros arriba, abajo y a la izquierda; fuego a la derecha. */
function boxedWorld(): { world: WorldState; petId: EntityId } {
  const { world, petId } = hurtWorld();
  for (const pos of [{ x: 1, y: 1 }, { x: 1, y: 3 }]) {
    spawn(world, 'wall', {
      position: pos,
      collider: { solid: true },
      hardness: { value: 5 },
      durability: { current: 10, max: 10 },
    });
  }
  return { world, petId };
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
  return intent;
}

describe('el dolor como motivo', () => {
  it('con la salud baja y el peligro al alcance nace «ponerse a salvo»', async () => {
    const { world, petId } = hurtWorld();
    const agent = makeAgent(petId);

    for (let i = 0; i < 3 && !agent.goals.byDescription(GOAL_BE_SAFE); i++) {
      await tick(world, petId, agent);
    }

    const goal = agent.goals.byDescription(GOAL_BE_SAFE);
    expect(goal).toBeDefined();
    expect(goal?.source).toBe('internal-signal');
    // Interpretó la señal como interpreta el frío: con una hipótesis.
    expect(agent.memory.hypothesisList().some((h) => h.statement.includes('alejar'))).toBe(true);
  });

  it('ponerse a salvo le gana al hambre: morirse ahora vence a comer después', async () => {
    const { world, petId } = hurtWorld({ energy: 15 });
    spawn(world, 'food', {
      position: { x: 6, y: 2 },
      portable: {},
      edible: {},
      nutrition: { value: 30 },
    });
    const agent = makeAgent(petId);

    for (let i = 0; i < 4 && !agent.goals.byDescription(GOAL_BE_SAFE); i++) {
      await tick(world, petId, agent);
    }

    const safety = agent.goals.byDescription(GOAL_BE_SAFE);
    const hunger = agent.goals.byDescription(GOAL_RESTORE_ENERGY);
    expect(safety).toBeDefined();
    expect(hunger).toBeDefined();
    if (safety?.status === 'active') {
      expect(agent.goals.selectActive()?.description).toBe(GOAL_BE_SAFE);
    }
    expect(safety!.priority + safety!.urgency).toBeGreaterThan(
      hunger!.priority + hunger!.urgency,
    );
  });

  it('se retira a distancia segura, la salud deja de bajar y el objetivo se cumple', async () => {
    const { world, petId } = hurtWorld();
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;

    for (let i = 0; i < 12; i++) await tick(world, petId, agent);

    expect(pet.components.dead).toBeUndefined();
    const distance = Math.max(
      Math.abs(pet.components.position!.x - 2),
      Math.abs(pet.components.position!.y - 2),
    );
    expect(distance).toBeGreaterThanOrEqual(2);
    expect(agent.goals.byDescription(GOAL_BE_SAFE)?.status).toBe('completed');
    // A esa distancia el fuego ya no la alcanza: la salud se estabilizó.
    const healthAtEnd = pet.components.health!.current;
    for (let i = 0; i < 5; i++) await tick(world, petId, agent);
    expect(pet.components.health!.current).toBe(healthAtEnd);
  });

  it('acorralada, pide ayuda: no hay habilidad que fabrique espacio', async () => {
    const { world, petId } = boxedWorld();
    const agent = makeAgent(petId);

    let asked: string | null = null;
    for (let i = 0; i < 10 && asked === null; i++) {
      const intent = await tick(world, petId, agent);
      if (intent?.type === 'speak' && intent.text.includes('apartarme')) asked = intent.text;
    }

    expect(asked).toContain('¿Puedes ayudarme?');
    expect(agent.events.ofType('help.requested').length).toBeGreaterThan(0);
    // El ciclo de skills no se abrió: apartarse no es una capacidad que falte.
    expect(agent.events.ofType('skill.requested')).toHaveLength(0);
  });

  it('el reflejo sigue intacto: en campo abierto se aparta en un paso y no hay objetivo', async () => {
    const { world, petId } = hurtWorld();
    // Sin el muro a la izquierda el reflejo alcanza: quita el muro.
    const wall = Object.values(world.entities).find((e) => e.kind === 'wall');
    delete world.entities[wall!.id];
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;

    for (let i = 0; i < 6; i++) await tick(world, petId, agent);

    expect(agent.events.ofType('pain.reflex').length).toBeGreaterThan(0);
    expect(agent.goals.byDescription(GOAL_BE_SAFE)).toBeUndefined();
    const distance = Math.max(
      Math.abs(pet.components.position!.x - 2),
      Math.abs(pet.components.position!.y - 2),
    );
    expect(distance).toBeGreaterThanOrEqual(2);
  });
});
