import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { EntityId, Recipe, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * Un plano que no puede cruzar desde NINGÚN lado no entra al mundo.
 *
 * El mundo mide lo que se puede medir de un plano —que quepa, que sus bloques
 * existan, que no sea spam— pero no si sirve para lo que nació. Un puente de
 * cinco celdas repartidas alrededor de ella pasa todas esas validaciones y no
 * cruza nada: como se para siempre en tierra firme, el medio del tendido cae en
 * la orilla y contra un cauce de cuatro tapa dos.
 *
 * Se la vio hacerlo tres corridas seguidas, incluso con la instrucción escrita
 * con todas las letras en el texto de invención («TODA PARA EL MISMO LADO»).
 * Decírselo no alcanzó. Medirlo sí: el motivo viaja con números a la próxima
 * idea, que es lo que la vuelve corregible.
 */

const TABLA: Recipe = {
  id: 'tabla',
  ingredients: [{ kind: 'tronco', count: 1 }],
  outcomes: [
    {
      weight: 1,
      output: {
        kind: 'tabla',
        components: { portable: {}, footing: {}, collider: { solid: false } },
      },
    },
  ],
};

/** El plano imposible: cinco celdas repartidas alrededor de ella. */
const SIMETRICO = {
  id: 'puente',
  placements: [-2, -1, 0, 1, 2].map((x) => ({ kind: 'tabla', offset: { x, y: 1 } })),
};

/** El que sí puede: cuatro celdas seguidas saliendo de sus pies hacia un lado. */
const HACIA_UN_LADO = {
  id: 'puente',
  placements: [1, 2, 3, 4].map((x) => ({ kind: 'tabla', offset: { x, y: 0 } })),
};

function propuesta(blueprint: unknown): ModelResponse {
  return { kind: 'blueprint', recipes: [], blueprint, rationale: 'para cruzar' } as ModelResponse;
}

const PEDIDO: ModelResponse = {
  kind: 'command.interpretation',
  command: {
    action: 'sequence',
    steps: [
      { action: 'craft-item', recipeId: 'puente' },
      { action: 'place-item', targetKind: 'puente', onKind: 'agua' },
    ],
  },
};

/** Cauce de 4 celdas de ancho (columnas 6..9), ella en la orilla izquierda. */
function riverWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 16, height: 9, seed: 7 }, { recipes: [TABLA] });
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
    for (let y = 0; y < 9; y++) spawn(world, 'agua', { position: { x, y }, water: {} });
  }
  for (let i = 0; i < 4; i++) {
    spawn(world, 'tronco', { position: { x: 1 + i, y: 7 }, portable: {} });
  }
  return { world, petId };
}

function makeAgent(petId: EntityId, responses: ModelResponse[]): AnimaAgent {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider: new ScriptedModelProvider(responses, { interpretsLanguage: true }),
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

describe('un plano que no puede cruzar no entra al mundo', () => {
  it('el tendido repartido alrededor suyo se rechaza antes de juntar materia', async () => {
    const { world: w, petId } = riverWorld();
    const agent = makeAgent(petId, [PEDIDO, propuesta(SIMETRICO)]);

    agent.receiveUserMessage('fabricá un puente y ponelo sobre el agua');
    await run(w, petId, agent, 30);

    // El plano imposible no llegó al mundo.
    expect(w.blueprints.map((b) => b.id)).not.toContain('puente');

    // Y el motivo quedó registrado CON LA MEDIDA, que es lo que lo vuelve
    // corregible: sin los números, «no sirve» no le dice qué cambiar.
    const rechazo = agent.events.events.find((e) => e.type === 'blueprint.rejected');
    expect(rechazo).toBeDefined();
    const motivo = String(rechazo?.data.reason ?? '');
    expect(motivo).toContain('no cruza desde ningún lado');
    // Su tramo seguido es 5, pero repartido: contra un cauce de 4 no alcanza
    // porque el medio cae en la orilla. El motivo nombra las dos medidas.
    expect(motivo).toContain('mide 4');
    expect(motivo).toContain('UN solo lado');
    expect(motivo).toContain('tramo seguido más largo es de 5');
  });

  it('el que sale de sus pies hacia un lado pasa sin que nadie lo moleste', async () => {
    const { world: w, petId } = riverWorld();
    const agent = makeAgent(petId, [PEDIDO, propuesta(HACIA_UN_LADO)]);

    agent.receiveUserMessage('fabricá un puente y ponelo sobre el agua');
    await run(w, petId, agent, 30);

    // Cuatro celdas seguidas hacia un lado tapan el cauce entero desde la
    // orilla: el juez no tiene nada que objetar.
    expect(w.blueprints.map((b) => b.id)).toContain('puente');
    expect(agent.events.events.some((e) => e.type === 'blueprint.rejected')).toBe(false);
  });

  it('una obra que no se camina no pasa por este juez', async () => {
    // La casa no cruza nada, y exigirle que tape el río sería absurdo. El juez
    // solo se mete con obras hechas de piezas que se pisan.
    const muro: Recipe = {
      id: 'muro',
      ingredients: [{ kind: 'tronco', count: 1 }],
      outcomes: [
        {
          weight: 1,
          output: { kind: 'muro', components: { portable: {}, collider: { solid: true } } },
        },
      ],
    };
    const w = createWorld({ width: 16, height: 9, seed: 7 }, { recipes: [muro] });
    const petId = spawn(w, 'pet', {
      position: { x: 3, y: 4 },
      collider: { solid: true },
      energy: { current: 48, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      strength: { value: 2 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Anima', perceptionRange: 16 },
    }).id;
    for (let x = 6; x <= 9; x++) {
      for (let y = 0; y < 9; y++) spawn(w, 'agua', { position: { x, y }, water: {} });
    }
    for (let i = 0; i < 4; i++) spawn(w, 'tronco', { position: { x: 1 + i, y: 7 }, portable: {} });

    const casa = {
      id: 'choza',
      placements: [-1, 0, 1].map((x) => ({ kind: 'muro', offset: { x, y: 1 } })),
    };
    const agent = makeAgent(petId, [
      { kind: 'command.interpretation', command: { action: 'craft-item', recipeId: 'choza' } },
      propuesta(casa),
    ]);

    agent.receiveUserMessage('construí una choza');
    await run(w, petId, agent, 30);

    expect(w.blueprints.map((b) => b.id)).toContain('choza');
  });

  it('un obstáculo más ancho que su alcance se dice imposible, no mal diseñado', async () => {
    // Un cauce de 9 columnas: no hay forma de tendido que lo cruce, porque una
    // obra no llega más allá de 4 desde donde se planta. Decirle «diseñaste
    // mal» sería mandarla a corregir lo incorregible y quemarle los tres
    // intentos contra una pared.
    const w = createWorld({ width: 22, height: 9, seed: 7 }, { recipes: [TABLA] });
    const petId = spawn(w, 'pet', {
      position: { x: 3, y: 4 },
      collider: { solid: true },
      energy: { current: 48, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      strength: { value: 2 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Anima', perceptionRange: 22 },
    }).id;
    for (let x = 6; x <= 14; x++) {
      for (let y = 0; y < 9; y++) spawn(w, 'agua', { position: { x, y }, water: {} });
    }
    for (let i = 0; i < 4; i++) spawn(w, 'tronco', { position: { x: 1 + i, y: 7 }, portable: {} });

    const agent = makeAgent(petId, [PEDIDO, propuesta(HACIA_UN_LADO)]);
    agent.receiveUserMessage('fabricá un puente y ponelo sobre el agua');
    await run(w, petId, agent, 30);

    const rechazo = agent.events.events.find((e) => e.type === 'blueprint.rejected');
    const motivo = String(rechazo?.data.reason ?? '');
    expect(motivo).toContain('no es que la hayas diseñado mal');
    expect(motivo).toContain('mide 9 celdas');
    expect(motivo).toContain('otra idea, no otro puente');
  });
});
