import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * Una receta que no entra en las manos no es cara: es imposible.
 *
 * El caso real, en la corrida del vado con el modelo de verdad. Propuso una
 * balsa de 4 tablas, 2 fibras y 1 resina —siete cosas— y sus manos son seis.
 * Todas las comprobaciones la aprobaron con razón: no crea materia, no gira en
 * círculos, sale en un paso honesto. Y era imposible desde el primer segundo,
 * porque construir consume los ingredientes del inventario y hay que tenerlos
 * TODOS a la vez.
 *
 * Lo que se vio: juntó las 4 tablas y las 2 fibras, llenó las seis ranuras
 * exactas, y se quedó dando vueltas con tres resinas a la vista que no podía
 * levantar. Ninguna regla de hacer lugar podía salvarla —no le sobraba nada,
 * soltar cualquier cosa rompía la receta— y su mensaje culpaba al mundo: «me
 * falta una resina y no veo más por acá», con tres delante.
 *
 * Va en la puerta del agente y no en la del mundo porque no es física: con una
 * mochila más grande la misma receta se construye perfectamente.
 */

class ScriptedModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
  readonly seen: ModelRequest[] = [];
  constructor(private scripted: Partial<Record<ModelRequest['kind'], ModelResponse>>) {
    super();
  }
  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    const canned = this.scripted[request.kind];
    if (canned) return Promise.resolve(canned);
    return super.complete(request);
  }
}

function worldWithCapacity(capacity: number): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 9, height: 6, seed: 3 });
  const petId = spawn(world, 'pet', {
    position: { x: 2, y: 2 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    // El frío es lo que la pone a inventar, igual que en `recipe-judge.test.ts`:
    // acá se mide la puerta, no de dónde salió la idea.
    temperature: { current: 10, max: 50, lossPerTick: 0.1 },
    strength: { value: 2 },
    inventory: { items: [], capacity },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  for (const at of [
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 3 },
  ]) {
    spawn(world, 'tronco', { position: at, portable: {} });
  }
  spawn(world, 'fibra', { position: { x: 3, y: 3 }, portable: {} });
  spawn(world, 'resina', { position: { x: 4, y: 2 }, portable: {} });
  return { world, petId };
}

/** La balsa de la corrida real: siete piezas en la mano. */
const BALSA: ModelResponse = {
  kind: 'recipe',
  recipe: {
    id: 'balsa',
    output: {
      kind: 'balsa',
      components: {
        portable: {},
        footing: {},
        hardness: { value: 2 },
        durability: { current: 18, max: 18 },
      },
    },
    ingredients: [
      { kind: 'tabla', count: 4 },
      { kind: 'fibra', count: 2 },
      { kind: 'resina', count: 1 },
    ],
  },
  rationale: 'ato cuatro tablas con fibra y las sello con resina',
};

function makeAgent(petId: EntityId, provider: MockModelProvider) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-19T00:00:00Z',
  });
}

async function run(world: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(world, petId));
    if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
  }
}

describe('una receta que no entra en las manos se rechaza antes de intentarla', () => {
  it('siete ingredientes con seis ranuras: rechazada, y el motivo habla de las manos', async () => {
    const { world, petId } = worldWithCapacity(6);
    const provider = new ScriptedModel({ 'recipe.propose': BALSA });
    const agent = makeAgent(petId, provider);

    await run(world, petId, agent, 8);

    const rejected = agent.events.ofType('recipe.rejected');
    expect(rejected.length).toBeGreaterThan(0);
    const reason = String(rejected[0]!.data.reason);
    expect(reason).toContain('7 ingredientes');
    expect(reason).toContain('6');
    // No llegó al mundo, y no se gastó al juez en algo imposible.
    expect(world.recipes.some((r) => r.id === 'balsa')).toBe(false);
    expect(provider.seen.some((r) => r.kind === 'recipe.judge')).toBe(false);
  });

  it('con manos más grandes la MISMA receta pasa: es su cuerpo, no la física', async () => {
    const { world, petId } = worldWithCapacity(8);
    const provider = new ScriptedModel({
      'recipe.propose': BALSA,
      'recipe.judge': { kind: 'judgement', willing: true, reason: 'va' },
    });
    const agent = makeAgent(petId, provider);

    await run(world, petId, agent, 8);

    const rejected = agent.events
      .ofType('recipe.rejected')
      .filter((e) => String(e.data.reason).includes('ingredientes de una vez'));
    expect(rejected).toEqual([]);
    // Y llegó hasta el juez, que es quien decide de acá en adelante.
    expect(provider.seen.some((r) => r.kind === 'recipe.judge')).toBe(true);
  });
});
