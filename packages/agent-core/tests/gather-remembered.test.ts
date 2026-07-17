import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { allEntities, buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * El caso reportado (corrida t202): la mascota comió del lado derecho y, al
 * pedirle una casa, necesitaba troncos que quedaron en su taller a la
 * IZQUIERDA, tras un muro. La vista exige línea despejada (ADR 0025), así que
 * no los veía; el `explore` a ciegas nunca daba con el único hueco del muro y
 * abortaba con "no pude reunir muros" teniendo el bosque al lado. Pero SÍ
 * recordaba dónde estaban (los juntó ahí antes): la memoria de lugares es el
 * puente que faltaba para volver a buscarlos.
 */

class FakeLanguageModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
  constructor(private scripted: Partial<Record<ModelRequest['kind'], ModelResponse>>) {
    super();
  }
  override complete(request: ModelRequest): Promise<ModelResponse> {
    const canned = this.scripted[request.kind];
    if (canned) return Promise.resolve(canned);
    return super.complete(request);
  }
}

function hold(world: WorldState, petId: EntityId, kind: string, comps: Record<string, unknown>): void {
  const e = spawn(world, kind, comps as never);
  delete e.components.position;
  world.entities[petId]!.components.inventory!.items.push(e.id);
}

describe('juntar materiales que recuerda pero no ve (memoria de lugares)', () => {
  it('con los troncos tras el muro, vuelve a donde los vio y arma la casa', async () => {
    // Mapa 13×7 con muro completo en x=5 salvo el hueco (5,2) que ya rompió.
    const world = createWorld({ width: 13, height: 7, seed: 5 });
    world.recipes.push({
      id: 'muro',
      outcomes: [
        {
          weight: 1,
          output: { kind: 'muro', components: { portable: {}, collider: { solid: true } } },
        },
      ],
      ingredients: [{ kind: 'log', count: 1 }],
    });
    world.blueprints.push({
      id: 'casa',
      placements: [
        { kind: 'muro', offset: { x: 0, y: -1 } },
        { kind: 'muro', offset: { x: -1, y: 0 } },
        { kind: 'muro', offset: { x: 1, y: 0 } },
        { kind: 'muro', offset: { x: -1, y: -1 } },
        { kind: 'muro', offset: { x: 1, y: -1 } },
      ],
    });
    // Arranca en su taller, a la IZQUIERDA, donde están los troncos.
    const petId = spawn(world, 'pet', {
      position: { x: 1, y: 4 },
      collider: { solid: true },
      energy: { current: 40, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      strength: { value: 2 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Anima', perceptionRange: 12 },
    }).id;
    hold(world, petId, 'hammer', { portable: {}, tool: { power: 8 }, durability: { current: 20, max: 20 } });
    hold(world, petId, 'muro', { portable: {}, collider: { solid: true } });
    hold(world, petId, 'muro', { portable: {}, collider: { solid: true } });
    hold(world, petId, 'muro', { portable: {}, collider: { solid: true } });

    for (let y = 0; y < 7; y++) {
      if (y === 2) continue; // el hueco que rompió con el martillo
      spawn(world, 'wall', {
        position: { x: 5, y },
        collider: { solid: true },
        hardness: { value: 5 },
        durability: { current: 10, max: 10 },
      });
    }
    // Dos troncos: alcanzan para los 2 muros que faltan (ya lleva 3).
    spawn(world, 'log', { position: { x: 1, y: 6 }, portable: {} });
    spawn(world, 'log', { position: { x: 3, y: 6 }, portable: {} });

    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'casa' },
      },
    });
    const agent = new AnimaAgent({
      petId,
      petName: 'Anima',
      provider,
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      evaluationSeeds: [11],
      guidanceEnabled: false,
      now: () => '2026-07-16T00:00:00Z',
    });

    // Un tick del lado izquierdo: percibe los troncos y los recuerda.
    await agent.think(buildPerception(world, petId));
    // Cruza a la derecha (fue a comer): ahora el muro le tapa la vista de los
    // troncos, pero los recuerda.
    world.entities[petId]!.components.position = { x: 9, y: 2 };

    agent.receiveUserMessage('construí una casa');
    const said: string[] = [];
    for (let i = 0; i < 320; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (!intent) continue;
      if (intent.type === 'speak') said.push(intent.text);
      agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // Volvió a buscar los troncos que recordaba y levantó la casa.
    const muros = allEntities(world).filter((e) => e.kind === 'muro' && e.components.position);
    expect(muros.length).toBe(5);
    // No terminó rindiéndose con el bosque al lado.
    expect(said.find((t) => t.includes('No pude'))).toBeUndefined();
  });
});
