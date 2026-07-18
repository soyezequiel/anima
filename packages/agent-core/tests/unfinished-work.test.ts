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
 * El encargo que se queda sin materia espera, no fracasa (ADR 0046).
 *
 * El caso observado: le pidieron una escuela (5 muros + 1 pizarra), juntó
 * cuatro muros, se quedó sin tronco y el objetivo se marcó FALLIDO. Conseguir
 * después el tronco que faltaba no retomaba nada, porque la obra ya estaba
 * muerta: el cuidador tenía que decir "seguí" en cada pieza. Tres de las cinco
 * intervenciones evitables de esa partida fueron exactamente eso.
 */

const CABIN: Blueprint = {
  id: 'cabana',
  placements: [
    { kind: 'wall', offset: { x: 1, y: 0 } },
    { kind: 'wall', offset: { x: 2, y: 0 } },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'cabana' },
};

function siteWorld(walls: number): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 12, height: 5, seed: 1 }, { blueprints: [CABIN] });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  // Menos muros de los que el plano pide: la obra se queda a mitad.
  for (let i = 0; i < walls; i++) {
    spawn(world, 'wall', {
      position: { x: 3 + i, y: 4 },
      portable: {},
      hardness: { value: 1 },
      durability: { current: 4, max: 4 },
    });
  }
  return { world, petId };
}

function makeAgent(petId: EntityId, responses: ModelResponse[]) {
  const provider = new ScriptedModelProvider(responses, { interpretsLanguage: true });
  const agent = new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-18T00:00:00Z',
  });
  return { agent, provider };
}

async function run(
  world: WorldState,
  petId: EntityId,
  agent: AnimaAgent,
  ticks: number,
): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(world, petId));
    agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
  }
}

describe('una obra sin materia espera, no fracasa (ADR 0046)', () => {
  it('quedarse sin material suspende el encargo en vez de matarlo', async () => {
    const { world, petId } = siteWorld(1);
    const { agent } = makeAgent(petId, [INTERPRET_BUILD]);

    agent.receiveUserMessage('construí una cabaña');
    await run(world, petId, agent, 60);

    const goal = agent.goals.byDescription('petición del usuario: construí una cabaña');
    // Antes esto era 'failed' y el encargo moría ahí.
    expect(goal?.status).toBe('suspended');
    expect(agent.events.ofType('goal.suspended').length).toBeGreaterThan(0);
  });

  it('retoma sola cuando aparece el material, sin que el cuidador diga nada', async () => {
    const { world, petId } = siteWorld(1);
    const { agent } = makeAgent(petId, [INTERPRET_BUILD]);

    agent.receiveUserMessage('construí una cabaña');
    await run(world, petId, agent, 60);
    expect(agent.goals.byDescription('petición del usuario: construí una cabaña')?.status).toBe(
      'suspended',
    );

    // Aparece el muro que faltaba. Nadie le dice "seguí".
    spawn(world, 'wall', {
      position: { x: 2, y: 3 },
      portable: {},
      hardness: { value: 1 },
      durability: { current: 4, max: 4 },
    });
    await run(world, petId, agent, 60);

    const revived = agent.events.ofType('goal.reactivated');
    expect(revived.some((e) => e.data.reason === 'apareció el material que faltaba')).toBe(true);
    // Y la terminó: la obra se retomó desde donde estaba, sin recolocar nada.
    const placed = Object.values(world.entities).filter(
      (e) => e.kind === 'wall' && e.components.position?.y === 2,
    );
    expect(placed.length).toBeGreaterThan(0);
  });

  it('avisa que queda pendiente, no que fracasó', async () => {
    const { world, petId } = siteWorld(1);
    const { agent } = makeAgent(petId, [INTERPRET_BUILD]);

    const said: string[] = [];
    agent.receiveUserMessage('construí una cabaña');
    for (let i = 0; i < 60; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') said.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    expect(said.some((t) => t.includes('sigo apenas consiga lo que falta'))).toBe(true);
  });

  it('el faltante que anuncia descuenta lo que ya lleva encima', async () => {
    // Un muro de los dos ya en la mano: lo que falta es UNO, no los dos del
    // plano. Antes decía "no pude reunir 2 muros" con uno en el inventario.
    const { world, petId } = siteWorld(1);
    const { agent } = makeAgent(petId, [INTERPRET_BUILD]);

    const said: string[] = [];
    agent.receiveUserMessage('construí una cabaña');
    for (let i = 0; i < 60; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') said.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    const failure = said.find((t) => t.includes('no pude reunir'));
    expect(failure).toBeDefined();
    expect(failure).toContain('1 muro');
    expect(failure).not.toContain('2 muros');
  });
});
