import { describe, expect, it } from 'vitest';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * Inventar desde el propio fracaso (ADR 0036). Hasta ahora Ánima solo se daba
 * permiso de inventar por el frío o por un pedido del cuidador; su hambre
 * bloqueada, no. Cuando el alimento queda detrás de algo que sus herramientas
 * no vencen y aprender una conducta con lo que tiene tampoco alcanza, lo que
 * falta puede ser un objeto que todavía no existe: y esa idea nace de ella, no
 * de una orden.
 */

/** Proveedor guionado por tipo, con una cola por tipo (cae al mock si no hay). */
class ByKindModel extends MockModelProvider {
  readonly seen: ModelRequest[] = [];
  constructor(private byKind: Partial<Record<ModelRequest['kind'], ModelResponse[]>>) {
    super();
  }
  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    const next = this.byKind[request.kind]?.shift();
    if (next) {
      this.recordCall(request.kind);
      return Promise.resolve(next);
    }
    return super.complete(request);
  }
}

/**
 * Alimento a la vista pero detrás de un muro completo de dureza 5, y del lado
 * de la mascota solo una rama (poder 1): no lo denta. Lleva un par de troncos
 * encima — materia con la que inventar. No hay martillo: por diseño, lo que
 * sabe usar no alcanza.
 */
function hungryBehindWall(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 9, height: 5, seed: 1 });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 12, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  // Muro completo en x=4: no hay ruta libre al alimento.
  for (let y = 0; y < 5; y++) {
    spawn(world, 'wall', {
      position: { x: 4, y },
      collider: { solid: true },
      hardness: { value: 5 },
      durability: { current: 20, max: 20 },
    });
  }
  spawn(world, 'food', {
    position: { x: 6, y: 2 },
    portable: {},
    edible: {},
    nutrition: { value: 30 },
  });
  spawn(world, 'branch', {
    position: { x: 2, y: 2 },
    portable: {},
    tool: { power: 1 },
    durability: { current: 8, max: 8 },
  });
  for (let i = 0; i < 2; i++) {
    const log = spawn(world, 'log', { portable: {} });
    world.entities[petId]!.components.inventory!.items.push(log.id);
  }
  return { world, petId };
}

describe('inventa desde su propio fracaso, sin que se lo pidan', () => {
  it('el hambre bloqueada por capacidad le da permiso de inventar un objeto', async () => {
    const provider = new ByKindModel({
      'interpret.signal': [
        { kind: 'interpretation', hypothesis: 'comer recupera energía', confidence: 0.6 },
      ],
      // La conducta que intenta aprender no resuelve nada (se queda quieta):
      // agotar este intento es lo que la lleva a pensar en un objeto.
      'skill.propose': [
        { kind: 'skill.program', program: [{ op: 'wait', ticks: 1 }], rationale: 'quieta' },
      ],
      // Su idea: una herramienta capaz de vencer el muro. La forma exacta la
      // juzga el mundo; acá solo importa que la propuesta nazca de ella.
      'recipe.propose': [
        {
          kind: 'recipe',
          recipe: {
            id: 'pico',
            output: { kind: 'pico', components: { portable: {}, tool: { power: 8 } } },
            ingredients: [{ kind: 'log', count: 1 }],
          },
          rationale: 'algo más fuerte para pasar el muro',
        },
      ],
    });
    const { world, petId } = hungryBehindWall();
    const agent = new AnimaAgent({
      petId,
      petName: 'Anima',
      provider,
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      evaluationSeeds: [11],
      guidanceEnabled: true,
      // Un solo intento de conducta: agotarlo es rápido y determinista.
      maxSkillDevAttempts: 1,
      maxVersionsPerDev: 1,
      now: () => '2026-07-16T00:00:00Z',
    });

    // Nadie le pide nada en toda la corrida: lo único que la empuja es su hambre.
    for (let i = 0; i < 120; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // Intentó aprender una conducta ANTES de inventar un objeto: el orden es
    // parte del diseño (primero lo que sabe, después lo que no existe).
    expect(provider.callCount('skill.propose')).toBeGreaterThan(0);
    // Y desde su propio fracaso, inventó: propuso un objeto al mundo.
    expect(provider.callCount('recipe.propose')).toBeGreaterThan(0);
    expect(agent.events.ofType('recipe.proposed').length).toBeGreaterThan(0);

    // La idea nació de un objetivo interno (hambre), no de un pedido: no hubo
    // ni un mensaje del cuidador en toda la corrida.
    expect(agent.events.ofType('user.message.received')).toHaveLength(0);
  });
});
