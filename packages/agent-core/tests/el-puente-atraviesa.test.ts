import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { Blueprint, EntityId, Recipe, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * Un puente que ROZA el agua no cruza nada.
 *
 * El sitio de la obra se elegía preguntando «¿alguna pieza cae sobre lo que me
 * pidieron?». Para un adorno sobre una roca alcanza; para un cruce es la
 * pregunta equivocada. Visto en vivo en el mapa del cauce: plano de 5 celdas en
 * fila —largo de sobra para un río de 4— plantado de manera que 4 celdas caían
 * en el pasto y UNA sola en la primera columna de agua. El plano servía; el
 * sitio no.
 *
 * Cruzar es tapar el obstáculo entero en la dirección en que corre la obra.
 */

/**
 * Cinco tablas en fila delante suyo: parada en la orilla, el tendido sale de
 * sus pies hacia el agua. El ancla es donde ELLA se para, así que no puede caer
 * en el cauce — por eso las celdas van todas para un lado.
 */
const BRIDGE: Blueprint = {
  id: 'puente',
  placements: [1, 2, 3, 4, 5].map((x) => ({ kind: 'tabla', offset: { x, y: 0 } })),
};

/** La tabla se pisa: es lo que vuelve caminable una celda de agua. */
const PLANK_RECIPE: Recipe = {
  id: 'tabla',
  outcomes: [
    {
      weight: 1,
      output: {
        kind: 'tabla',
        components: { portable: {}, footing: {}, collider: { solid: false } },
      },
    },
  ],
  ingredients: [{ kind: 'tronco', count: 1 }],
};

const INTERPRET: ModelResponse = {
  kind: 'command.interpretation',
  command: {
    action: 'sequence',
    steps: [
      { action: 'craft-item', recipeId: 'puente' },
      { action: 'place-item', targetKind: 'puente', onKind: 'agua' },
    ],
  },
};

/**
 * Un cauce de 4 celdas de ancho (columnas 6..9), con la mascota en la orilla
 * izquierda. Es la forma del mapa real, reducida a lo que importa.
 */
function riverWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld(
    { width: 16, height: 9, seed: 7 },
    { blueprints: [BRIDGE], recipes: [PLANK_RECIPE] },
  );
  const petId = spawn(world, 'pet', {
    position: { x: 3, y: 4 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 16 },
  }).id;
  for (let x = 6; x <= 9; x++) {
    for (let y = 0; y < 9; y++) {
      spawn(world, 'agua', { position: { x, y }, water: {} });
    }
  }
  for (let i = 0; i < 6; i++) {
    spawn(world, 'tabla', {
      position: { x: 1 + (i % 4), y: 6 + Math.floor(i / 4) },
      portable: {},
      footing: {},
      collider: { solid: false },
    });
  }
  return { world, petId };
}

function makeAgent(petId: EntityId): AnimaAgent {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider: new ScriptedModelProvider([INTERPRET], { interpretsLanguage: true }),
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

/** Las columnas de agua que el tendido deja tapadas, en su fila. */
function coveredColumns(cells: { x: number; y: number }[]): number[] {
  return cells
    .filter((c) => c.x >= 6 && c.x <= 9)
    .map((c) => c.x)
    .sort((a, b) => a - b);
}

describe('el puente atraviesa el cauce, no lo roza', () => {
  it('el sitio elegido tapa las cuatro columnas de agua', async () => {
    const { world: w, petId } = riverWorld();
    const agent = makeAgent(petId);

    agent.receiveUserMessage('fabricá un puente y ponelo sobre el agua');
    await run(w, petId, agent, 30);

    const plan = agent
      .plannedStructures(buildPerception(w, petId))
      .find((p) => p.blueprintId === 'puente');
    expect(plan).toBeDefined();

    // Las cuatro columnas del cauce quedan cubiertas. Antes se conformaba con
    // una: cuatro tablas en el pasto y una mojada.
    expect(coveredColumns(plan!.cells)).toEqual([6, 7, 8, 9]);
  });

  it('sin que el encargo nombre el agua, el tendido igual la atraviesa', async () => {
    // La otra puerta al mismo sitio. «Tendelo hasta la otra orilla» se traduce
    // en un craft-item pelado, sin destino: ahí el imán no es lo que le
    // pidieron sino la obra misma, que trae piezas que se pisan. Esa rama tenía
    // la misma pregunta floja —«alguna tabla mojándose»— y el mismo final.
    const { world: w, petId } = riverWorld();
    const agent = new AnimaAgent({
      petId,
      petName: 'Anima',
      provider: new ScriptedModelProvider(
        [{ kind: 'command.interpretation', command: { action: 'craft-item', recipeId: 'puente' } }],
        { interpretsLanguage: true },
      ),
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      warmthScenarios: COLD_SCENARIOS,
      evaluationSeeds: [11],
      guidanceEnabled: false,
      now: () => '2026-07-20T00:00:00Z',
    });

    agent.receiveUserMessage('tendé un puente hasta la otra orilla');

    // Se muestrea mientras trabaja: la silueta se borra en cuanto el encargo
    // se cierra (ADR 0059), y mirar solo el final la pierde.
    const muestras: number[][] = [];
    for (let i = 0; i < 10; i++) {
      await run(w, petId, agent, 4);
      const plan = agent
        .plannedStructures(buildPerception(w, petId))
        .find((p) => p.blueprintId === 'puente');
      if (plan) muestras.push(coveredColumns(plan.cells));
    }

    expect(muestras.length).toBeGreaterThan(0);
    // Todas las veces que se la vio, el tendido tapaba el cauce entero.
    for (const cubiertas of muestras) expect(cubiertas).toEqual([6, 7, 8, 9]);
  });
});
