import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, GOAL_RESTORE_ENERGY } from '../src/index.js';

/**
 * ADR 0062. Sentir hambre sin tener hambre es un fantasma.
 *
 * Un objetivo del cuerpo nacía con la carencia, pero solo se cerraba si lo
 * resolvía ELLA. Si el cuidador la alimentaba —o el sol la entibiaba, o el modo
 * creativo le llenaba el cuerpo— «recuperar energía» seguía abierto: compitiendo
 * en la fila y apareciendo en pantalla por un hambre que ya no existía.
 */

function hungryWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 10, height: 6, seed: 3 });
  const petId = spawn(world, 'pet', {
    position: { x: 2, y: 2 },
    collider: { solid: true },
    // Por debajo del umbral: el objetivo nace solo.
    energy: { current: 10, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 10 },
  }).id;
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
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: true,
    now: () => '2026-07-18T00:00:00Z',
  });
}

async function run(w: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
  }
}

describe('el cuerpo satisfecho suelta su objetivo (ADR 0062)', () => {
  it('si alguien le llena la energía, deja de perseguirla', async () => {
    const { world, petId } = hungryWorld();
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;

    await run(world, petId, agent, 12);
    expect(agent.goals.findOpen(GOAL_RESTORE_ENERGY)).toBeDefined();

    // El cuidador la alimenta (o el modo creativo la repone): el cuerpo ya no
    // pide nada, y nadie tuvo que resolverlo POR la vía de ella.
    pet.components.energy!.current = pet.components.energy!.max;
    // Margen para que la tarea en curso termine: no se la corta a la mitad
    // —ahí es donde ella aprende— pero apenas termina, el objetivo se suelta.
    for (let i = 0; i < 40 && agent.goals.findOpen(GOAL_RESTORE_ENERGY); i++) {
      pet.components.energy!.current = pet.components.energy!.max;
      await run(world, petId, agent, 1);
    }

    expect(agent.goals.findOpen(GOAL_RESTORE_ENERGY)).toBeUndefined();
    expect(agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status).toBe('completed');
  });

  it('un cuerpo en el borde no abre y cierra en bucle', async () => {
    const { world, petId } = hungryWorld();
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;

    await run(world, petId, agent, 12);
    // Justo por encima del umbral que lo enciende (0.35) pero lejos del que lo
    // da por satisfecho: la zona donde antes habría oscilado cada tick.
    pet.components.energy!.current = pet.components.energy!.max * 0.4;
    await run(world, petId, agent, 5);

    // Sigue abierto: no está satisfecha, solo dejó de estar en rojo.
    expect(agent.goals.findOpen(GOAL_RESTORE_ENERGY)).toBeDefined();
    const cerrados = agent.events
      .ofType('goal.completed')
      .filter((e) => e.data.strategy === 'el cuerpo dejó de pedirlo');
    expect(cerrados).toHaveLength(0);
  });
});
