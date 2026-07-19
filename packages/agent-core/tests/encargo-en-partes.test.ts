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
 * Un cuidador habla como se habla: «traé un tronco, comé algo y esperá ahí»
 * son tres encargos en una frase. Antes, la traducción se quedaba con el
 * primer verbo y tiraba el resto — y lo peor no era dejar cosas sin hacer,
 * sino dar el encargo por CUMPLIDO al terminar la primera parte.
 *
 * Estas pruebas fijan las dos mitades de la regla: que las partes existan
 * todas, y que vayan en el orden en que se dijeron.
 */
const SEQUENCE: ModelResponse = {
  kind: 'command.interpretation',
  command: {
    action: 'sequence',
    steps: [
      { action: 'fetch-item', targetKind: 'tronco' },
      { action: 'consume-item', targetKind: 'food' },
      { action: 'wait-here' },
    ],
  },
};

function world(): { world: WorldState; petId: EntityId } {
  const w = createWorld({ width: 10, height: 7, seed: 4 });
  const petId = spawn(w, 'pet', {
    position: { x: 2, y: 3 },
    collider: { solid: true },
    energy: { current: 40, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  spawn(w, 'tronco', { position: { x: 5, y: 3 }, portable: {} });
  spawn(w, 'food', {
    position: { x: 7, y: 5 },
    portable: {},
    edible: {},
    nutrition: { value: 10 },
  });
  return { world: w, petId };
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
    now: () => '2026-07-19T00:00:00Z',
  });
}

async function run(w: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
  }
}

describe('un encargo dicho en varias partes', () => {
  it('crea un objetivo por parte, no uno solo', async () => {
    const { world: w, petId } = world();
    const agent = makeAgent(petId, [SEQUENCE]);
    agent.receiveUserMessage('traé un tronco, comé algo y esperá ahí');
    await run(w, petId, agent, 3);

    const requests = agent.goals.all().filter((g) => g.source === 'user-request' && !g.parentGoalId);
    expect(requests.map((g) => g.userRequest?.kind)).toEqual([
      'fetch-item',
      'consume-item',
      'wait-here',
    ]);
  });

  it('las partes van en fila: la segunda espera a que se cierre la primera', async () => {
    const { world: w, petId } = world();
    const agent = makeAgent(petId, [SEQUENCE]);
    agent.receiveUserMessage('traé un tronco, comé algo y esperá ahí');
    await run(w, petId, agent, 3);

    const [primera, segunda, tercera] = agent.goals
      .all()
      .filter((g) => g.source === 'user-request' && !g.parentGoalId);
    expect(primera?.afterGoalId).toBeUndefined();
    expect(segunda?.afterGoalId).toBe(primera?.id);
    expect(tercera?.afterGoalId).toBe(segunda?.id);

    // Mientras la primera siga abierta, es la única elegible: el orden que
    // pidió el cuidador no lo desempata la prioridad.
    expect(agent.goals.selectActive()?.id).toBe(primera?.id);

    agent.goals.complete(primera!.id);
    expect(agent.goals.selectActive()?.id).toBe(segunda?.id);
  });

  it('una parte que fracasa no deja colgadas a las que vienen detrás', async () => {
    const { world: w, petId } = world();
    const agent = makeAgent(petId, [SEQUENCE]);
    agent.receiveUserMessage('traé un tronco, comé algo y esperá ahí');
    await run(w, petId, agent, 3);

    const abiertos = agent.goals
      .all()
      .filter((g) => g.source === 'user-request' && !g.parentGoalId);
    agent.goals.fail(abiertos[0]!.id);
    expect(agent.goals.selectActive()?.id).toBe(abiertos[1]?.id);
  });

  it('un encargo de una sola parte sigue siendo un encargo simple', async () => {
    const { world: w, petId } = world();
    const agent = makeAgent(petId, [
      {
        kind: 'command.interpretation',
        command: { action: 'sequence', steps: [{ action: 'fetch-item', targetKind: 'tronco' }] },
      },
    ]);
    agent.receiveUserMessage('traé un tronco');
    await run(w, petId, agent, 3);

    const requests = agent.goals.all().filter((g) => g.source === 'user-request' && !g.parentGoalId);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.afterGoalId).toBeUndefined();
  });
});

/**
 * Un pedido pierde datos entre que se acepta y que se ejecuta si alguien se
 * olvida de copiarlos al objetivo. Pasó de verdad con `onKind`: la orden decía
 * "poné la balsa sobre el agua", el objetivo guardaba solo "la balsa", y el
 * programa salía a buscar un tipo llamado `unknown` — cincuenta ticks de
 * caminata para abortar con un motivo que mentía.
 *
 * El objetivo es lo único que sobrevive a un guardado: lo que no llega ahí, no
 * existe.
 */
describe('un pedido no pierde datos al volverse objetivo', () => {
  it('«poné X sobre Y» conserva las dos partes', async () => {
    const { world: w, petId } = world();
    const agent = makeAgent(petId, [
      {
        kind: 'command.interpretation',
        command: { action: 'place-item', targetKind: 'tabla', onKind: 'agua' },
      },
    ]);
    agent.receiveUserMessage('poné la tabla sobre el agua');
    await run(w, petId, agent, 3);

    const goal = agent.goals.all().find((g) => g.userRequest?.kind === 'place-item');
    expect(goal?.userRequest?.targetKind).toBe('tabla');
    expect(goal?.userRequest?.onKind).toBe('agua');
  });
});
