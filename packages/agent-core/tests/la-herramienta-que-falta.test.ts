import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * Una herramienta que falta es un PASO MÁS, no un callejón.
 *
 * Partida real, mapa del cauce: a un bloque de terminar el puente, con cuatro
 * árboles a la vista y ningún tronco suelto. Abortaba con
 * `no-candidates:tool-tronco` y se dormía «esperando que aparezca un tronco».
 * Los troncos estaban ahí — adentro de los árboles. Lo que faltaba era con qué
 * sacarlos.
 *
 * Y dormirse era lo caro: un encargo suspendido no compite en `selectActive`,
 * así que la ventana se la quedaban los antojos, que además se gastaban la
 * materia que el encargo estaba esperando. Diez recetas después no quedaba con
 * qué cruzar nada.
 *
 * Es la misma escalada que ya existía para romper (`escalateDestroyIfBlocked`),
 * aplicada a cosechar: si su mundo sabe hacer una herramienta, se la hace.
 */

/** La tabla sale del tronco, y el tronco solo sale de talar. */
const PLANK_RECIPE = {
  id: 'tabla',
  ingredients: [{ kind: 'log', count: 1 }],
  outcomes: [{ weight: 1, output: { kind: 'tabla', components: { portable: {} } } }],
};

/** Su mundo YA sabe hacer un hacha: no hay nada que inventar, solo que hacerla. */
const AXE_RECIPE = {
  id: 'hacha',
  ingredients: [{ kind: 'piedra', count: 1 }],
  outcomes: [
    {
      weight: 1,
      output: {
        kind: 'hacha',
        components: { portable: {}, tool: { power: 5 }, durability: { current: 20, max: 20 } },
      },
    },
  ],
};

const PEDIR_TABLA: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'tabla' },
};

/**
 * Bosque sin herramienta y sin troncos sueltos: la única madera está en los
 * árboles, y no hay con qué sacarla. Hay piedra, que es de lo que sale el hacha.
 */
function forestWithoutTools(options: { recipes?: unknown[] } = {}): {
  world: WorldState;
  petId: EntityId;
} {
  const world = createWorld(
    { width: 12, height: 7, seed: 3 },
    { recipes: (options.recipes ?? [PLANK_RECIPE, AXE_RECIPE]) as never },
  );
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 3 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  for (let i = 0; i < 3; i++) {
    spawn(world, 'tree', {
      position: { x: 5 + i * 2, y: 3 },
      hardness: { value: 2 },
      durability: { current: 4, max: 4 },
      drops: [{ kind: 'log', components: { portable: {} } }],
    });
  }
  for (let i = 0; i < 2; i++) {
    spawn(world, 'piedra', { position: { x: 2 + i, y: 5 }, portable: {} });
  }
  return { world, petId };
}

function makeAgent(petId: EntityId): AnimaAgent {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider: new ScriptedModelProvider([PEDIR_TABLA], { interpretsLanguage: true }),
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-20T00:00:00Z',
  });
}

async function run(w: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
  }
}

describe('una herramienta que falta es un paso más, no un callejón', () => {
  it('se hace el hacha en vez de dormirse esperando un tronco', async () => {
    const { world: w, petId } = forestWithoutTools();
    const agent = makeAgent(petId);

    agent.receiveUserMessage('hacé una tabla');
    await run(w, petId, agent, 120);

    // Consiguió una herramienta: la fabricó ella, porque en este mundo no había
    // ninguna tirada. Antes esto no pasaba nunca — se dormía antes de intentarlo.
    const hachas = Object.values(w.entities).filter((e) => e.kind === 'hacha');
    expect(hachas.length).toBeGreaterThan(0);

    // Y el encargo NO quedó suspendido esperando que apareciera un tronco: lo
    // que faltaba tenía camino, así que siguió trabajando.
    const encargo = agent.goals
      .all()
      .find((g) => g.source === 'user-request' && g.userRequest?.kind === 'craft-item');
    expect(encargo?.status).not.toBe('suspended');
  });

  it('con una herramienta a la vista no se desvía a fabricar otra', async () => {
    // La otra mitad: el desvío es para cuando NO tiene con qué. Si ya hay un
    // martillo tirado, hacerse un hacha sería trabajo inventado.
    const { world: w, petId } = forestWithoutTools();
    spawn(w, 'hammer', {
      position: { x: 2, y: 3 },
      portable: {},
      tool: { power: 8 },
      durability: { current: 40, max: 40 },
    });
    const agent = makeAgent(petId);

    agent.receiveUserMessage('hacé una tabla');
    await run(w, petId, agent, 120);

    const hachas = Object.values(w.entities).filter((e) => e.kind === 'hacha');
    expect(hachas).toHaveLength(0);
    // Y con el martillo taló igual: hay tabla, o al menos hay tronco.
    const consiguio = Object.values(w.entities).some(
      (e) => e.kind === 'tabla' || e.kind === 'log',
    );
    expect(consiguio).toBe(true);
  });
});
