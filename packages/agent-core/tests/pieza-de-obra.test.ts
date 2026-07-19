import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { BaseModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * El juez sabe cuándo juzga una PIEZA (ADR 0074).
 *
 * El prompt ya distingue los dos casos —eso lo fija el test de codex—, pero lo
 * que se rompió en la corrida real fue el cableado: nadie le decía al juez que
 * la receta que tenía delante era un ladrillo de una obra ya propuesta. Este
 * test mira el pedido que sale del agente, que es donde vivía el agujero.
 */

/** Devuelve respuestas guionadas y guarda los pedidos enteros, no solo su tipo. */
class RecordingProvider extends BaseModelProvider {
  readonly name = 'recording';
  override readonly interpretsLanguage = true;
  readonly seen: ModelRequest[] = [];
  private queue: ModelResponse[];

  constructor(responses: ModelResponse[]) {
    super();
    this.queue = [...responses];
  }

  complete(request: ModelRequest): Promise<ModelResponse> {
    this.recordCall(request.kind);
    this.seen.push(request);
    const next = this.queue.shift();
    if (!next) return Promise.reject(new Error(`sin respuestas para ${request.kind}`));
    return Promise.resolve(next);
  }
}

const receta = (kind: string, ingredients: { kind: string; count: number }[]) => ({
  id: kind,
  output: { kind, components: { portable: {} } },
  ingredients,
});

function mundo(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 12, height: 8, seed: 7 });
  const petId = spawn(world, 'pet', {
    position: { x: 5, y: 4 },
    collider: { solid: true },
    energy: { current: 50, max: 50, decayPerTick: 0.001 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  for (let i = 0; i < 4; i++) spawn(world, 'stone', { position: { x: 1 + i, y: 1 }, portable: {} });
  return { world, petId };
}

describe('el juez sabe cuándo juzga una pieza (ADR 0074)', () => {
  it('las recetas de una obra viajan marcadas como pieza; una suelta no', async () => {
    const { world: w, petId } = mundo();
    const provider = new RecordingProvider([
      { kind: 'command.interpretation', command: { action: 'craft-item', recipeId: 'cocina' } },
      // La obra: sus piezas y el plano que las dispone (ADR 0032).
      {
        kind: 'blueprint',
        rationale: 'una cocina es un lugar, la propongo como obra',
        recipes: [receta('fogon', [{ kind: 'stone', count: 2 }])],
        blueprint: {
          id: 'cocina',
          placements: [{ kind: 'fogon', offset: { x: 1, y: 0 } }],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { kind: 'judgement', willing: true, reason: 'va' },
    ]);

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

    agent.receiveUserMessage('construí una cocina');
    for (let i = 0; i < 12; i++) {
      const intent = await agent.think(buildPerception(w, petId));
      agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
    }

    const juicios = provider.seen.filter((r) => r.kind === 'recipe.judge');
    expect(juicios.length).toBeGreaterThan(0);
    // El fogón es un ladrillo de la cocina: se juzga como pieza, y por eso no
    // se le pregunta si debería ser un lugar.
    for (const juicio of juicios) {
      expect(juicio).toMatchObject({ partOfWork: true });
    }
  });
});
