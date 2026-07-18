import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { Blueprint, EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * ADR 0057. Una pieza que se FABRICA necesita lugar para sus ingredientes.
 *
 * Partida real: escuela de 5 paredes + 1 pizarrón. La mascota llevaba el
 * martillo y cuatro paredes —cinco de seis ranuras— y el pizarrón pide DOS
 * arcillas, que la receta consume de la mano y por lo tanto hay que tener a la
 * vez. Con una sola ranura libre no entraban nunca.
 *
 * Y no se descargaba, porque la regla era «descargá si la mochila está LLENA»
 * y no lo estaba: quedaba lugar para una cosa. Lugar para una cosa cuando hace
 * falta lugar para dos es exactamente igual de inútil que no tener lugar.
 *
 * Encima quedaba suspendida «hasta que aparezca un pizarrón» — algo que no
 * aparece nunca, porque se fabrica. Dormida para siempre con la arcilla a
 * cuatro pasos.
 */

const SCHOOL: Blueprint = {
  id: 'escuela',
  placements: [
    { kind: 'pared-aula', offset: { x: -1, y: 0 } },
    { kind: 'pared-aula', offset: { x: 1, y: 0 } },
    { kind: 'pizarron', offset: { x: 0, y: -1 } },
  ],
};

const WALL_RECIPE = {
  id: 'pared-aula',
  ingredients: [{ kind: 'log', count: 1 }],
  outcomes: [
    {
      weight: 1,
      output: { kind: 'pared-aula', components: { portable: {}, collider: { solid: true } } },
    },
  ],
};

/** La pieza cara: DOS arcillas en la mano al mismo tiempo. */
const BOARD_RECIPE = {
  id: 'pizarron',
  ingredients: [{ kind: 'clay', count: 2 }],
  outcomes: [
    {
      weight: 1,
      output: { kind: 'pizarron', components: { portable: {}, collider: { solid: true } } },
    },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'escuela' },
};

/**
 * La trampa exacta de la partida real: capacidad 4, y ya lleva encima el
 * martillo y las dos paredes que hizo antes. Le queda UNA ranura libre, y el
 * pizarrón pide DOS arcillas al mismo tiempo.
 */
function schoolWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld(
    { width: 16, height: 9, seed: 3 },
    { recipes: [WALL_RECIPE, BOARD_RECIPE], blueprints: [SCHOOL] },
  );
  const pet = spawn(world, 'pet', {
    position: { x: 3, y: 4 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 4 },
    agent: { name: 'Anima', perceptionRange: 16 },
  });
  const petId = pet.id;
  // Lo que ya carga: el martillo con el que consigue material, y las dos
  // paredes que el plano pide. Tres de cuatro ranuras ocupadas.
  const hammer = spawn(world, 'hammer', { portable: {}, tool: { power: 6 } });
  const wallA = spawn(world, 'pared-aula', { portable: {}, collider: { solid: true } });
  const wallB = spawn(world, 'pared-aula', { portable: {}, collider: { solid: true } });
  pet.components.inventory!.items = [hammer.id, wallA.id, wallB.id];
  for (let i = 0; i < 4; i++) {
    spawn(world, 'clay', { position: { x: 6 + i, y: 1 }, portable: {} });
  }
  return { world, petId };
}

function makeAgent(petId: EntityId) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider: new ScriptedModelProvider([INTERPRET_BUILD], { interpretsLanguage: true }),
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-18T00:00:00Z',
  });
}

async function run(w: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
  }
}

describe('una pieza que se fabrica necesita lugar para sus ingredientes (ADR 0057)', () => {
  it('levanta la escuela entera, pizarrón incluido, con la mochila justa', async () => {
    const { world, petId } = schoolWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una escuela');

    // Se mide contra el MUNDO y no contra el plan: el plan desaparece apenas
    // el encargo se completa, así que mirarlo ahí diría "2 de 3" justo cuando
    // acaba de terminar.
    const enElSuelo = (kind: string) =>
      Object.values(world.entities).filter((e) => e.kind === kind && e.components.position).length;

    for (let i = 0; i < 400 && enElSuelo('pizarron') === 0; i++) {
      await run(world, petId, agent, 1);
    }

    // La prueba de fuego es el PIZARRÓN: es la pieza que pide dos ranuras y la
    // que se quedaba sin hacer para siempre.
    expect(enElSuelo('pizarron')).toBeGreaterThan(0);
    expect(enElSuelo('pared-aula')).toBe(2);
  });

  it('si se suspende, espera la ARCILLA y no el pizarrón que nunca aparece', async () => {
    // Un mundo sin arcilla a la vista: se queda sin material de verdad.
    const world = createWorld(
      { width: 12, height: 7, seed: 4 },
      { recipes: [WALL_RECIPE, BOARD_RECIPE], blueprints: [SCHOOL] },
    );
    const petId = spawn(world, 'pet', {
      position: { x: 2, y: 3 },
      collider: { solid: true },
      energy: { current: 48, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      strength: { value: 2 },
      inventory: { items: [], capacity: 4 },
      agent: { name: 'Anima', perceptionRange: 12 },
    }).id;
    for (let i = 0; i < 3; i++) {
      spawn(world, 'log', { position: { x: 5 + i, y: 5 }, portable: {} });
    }
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una escuela');

    let suspendido;
    for (let i = 0; i < 300 && !suspendido; i++) {
      await run(world, petId, agent, 1);
      suspendido = agent.goals
        .all()
        .find((g) => g.userRequest?.kind === 'craft-item' && g.status === 'suspended');
    }
    expect(suspendido).toBeDefined();
    // Lo que espera es materia que EXISTE en el mundo, no una pieza fabricable:
    // «aparezca un pizarrón» es una espera que no termina nunca.
    expect(suspendido!.reactivateWhen).toContain('arcilla');
    expect(suspendido!.reactivateWhen).not.toContain('pizarron');
  });
});
