import { describe, expect, it } from 'vitest';
import type { EntityId, WorldState } from '@anima/sim-core';
import { createWorld, spawn } from '@anima/sim-core';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, runAgentInWorld } from '../src/index.js';

/**
 * Reaccionar ante el fracaso en vez de quedarse quieta (#2 del diagnóstico).
 * Antes, pedirle romper algo imposible terminaba en un "no pude" seco y a la
 * espera: 20 golpes al vacío y silencio. Ahora el fracaso se vuelve aprendizaje
 * (un hecho: "no se puede romper") y una oferta concreta (recogerlo, moverlo).
 */

/** Proveedor guionado por tipo, con cola por tipo; cae al mock si no hay. */
class ByKindModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
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
 * La mascota, un martillo a un paso y un pedernal a dos. El pedernal es
 * portable pero SIN durabilidad: como en el reporte real, ninguna herramienta
 * lo afecta (el mundo responde 'target-unaffected'). Energía alta: nada la
 * distrae del pedido.
 */
function petHammerAndFlint(): { world: WorldState; petId: EntityId; flint: EntityId } {
  const world = createWorld({ width: 9, height: 5, seed: 1 });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 4 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  spawn(world, 'hammer', {
    position: { x: 2, y: 2 },
    portable: {},
    tool: { power: 8 },
    durability: { current: 20, max: 20 },
  });
  const flint = spawn(world, 'flint', { position: { x: 3, y: 2 }, portable: {} }).id;
  return { world, petId, flint };
}

describe('ante un pedido imposible, aprende y ofrece un plan B en vez de callarse', () => {
  it('romper lo irrompible deja un hecho aprendido y una oferta, no un "no pude" mudo', async () => {
    const provider = new ByKindModel({
      'interpret.command': [
        {
          kind: 'command.interpretation',
          command: { action: 'destroy-entity', targetKind: 'flint' },
        },
      ],
      'judge.destruction': [{ kind: 'judgement', willing: true, reason: 'Puedo intentarlo.' }],
    });
    const { world, petId, flint } = petHammerAndFlint();
    const agent = new AnimaAgent({
      petId,
      petName: 'Anima',
      provider,
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      evaluationSeeds: [11],
      guidanceEnabled: true,
      now: () => '2026-07-16T00:00:00Z',
    });

    const { worldEvents } = await runAgentInWorld(world, agent, {
      maxTicks: 60,
      userMessagesAt: { 0: 'rompe la piedra' },
    });

    // Falló por lo correcto: inmune, no el genérico "resistió".
    const failed = agent.events.ofType('strategy.failed');
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.at(-1)?.data.reason).toBe('objetivo-inmune');

    // Aprendió un hecho: no volverá a estrellarse contra lo irrompible.
    expect(agent.memory.factList().some((f) => f.statement.includes('no se puede romper'))).toBe(
      true,
    );

    // Y lo dijo con una oferta concreta, no un silencio a la espera.
    const said = worldEvents
      .filter((e) => e.type === 'agent.spoke')
      .map((e) => String(e.data.text));
    expect(said.some((t) => t.includes('no se puede romper'))).toBe(true);
    expect(said.some((t) => /recoger|llevar/.test(t))).toBe(true);

    // El pedernal sigue ahí: imposible de romper, pero tampoco quedó en bucle.
    expect(world.entities[flint]).toBeDefined();
  });

  /**
   * La mascota, una rama débil en mano (poder 1: con fuerza 2 da 3), un tronco
   * en el suelo (materia para inventar) y una roca dura (durabilidad 6, dureza
   * 5: la rama no le hace mella, un pico sí).
   */
  function petWeakToolHardRock(): { world: WorldState; petId: EntityId; rock: EntityId } {
    const world = createWorld({ width: 9, height: 5, seed: 1 });
    const petId = spawn(world, 'pet', {
      position: { x: 1, y: 2 },
      collider: { solid: true },
      energy: { current: 45, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      strength: { value: 2 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Anima', perceptionRange: 12 },
    }).id;
    const branch = spawn(world, 'branch', {
      portable: {},
      tool: { power: 1 },
      durability: { current: 8, max: 8 },
    });
    world.entities[petId]!.components.inventory!.items.push(branch.id);
    spawn(world, 'log', { position: { x: 2, y: 2 }, portable: {} });
    const rock = spawn(world, 'rock', {
      position: { x: 3, y: 2 },
      durability: { current: 6, max: 6 },
      hardness: { value: 5 },
    }).id;
    return { world, petId, rock };
  }

  it('ante algo muy duro, inventa y fabrica una herramienta más fuerte sola, y lo rompe', async () => {
    const provider = new ByKindModel({
      'interpret.command': [
        {
          kind: 'command.interpretation',
          command: { action: 'destroy-entity', targetKind: 'rock' },
        },
      ],
      'judge.destruction': [{ kind: 'judgement', willing: true, reason: 'Puedo intentarlo.' }],
      // Su idea ante la roca: un pico más fuerte. El mundo la valida (poder 8 es
      // el techo, el tronco es materia que hay) y queda como receta suya.
      'recipe.propose': [
        {
          kind: 'recipe',
          recipe: {
            id: 'pico',
            output: { kind: 'pico', components: { portable: {}, tool: { power: 8 } } },
            ingredients: [{ kind: 'log', count: 1 }],
          },
          rationale: 'algo más fuerte para la roca',
        },
      ],
    });
    const { world, petId, rock } = petWeakToolHardRock();
    const agent = new AnimaAgent({
      petId,
      petName: 'Anima',
      provider,
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      evaluationSeeds: [11],
      guidanceEnabled: true,
      now: () => '2026-07-16T00:00:00Z',
    });

    const { worldEvents } = await runAgentInWorld(world, agent, {
      maxTicks: 120,
      userMessagesAt: { 0: 'rompe la roca' },
    });

    // Inventó una herramienta por su cuenta (nadie le pidió fabricar nada).
    expect(agent.events.ofType('recipe.proposed').length).toBeGreaterThan(0);
    // La fabricó...
    expect(worldEvents.some((e) => e.type === 'item.crafted')).toBe(true);
    // ...y con ella rompió la roca que su herramienta vieja no vencía.
    expect(
      worldEvents.some((e) => e.type === 'entity.destroyed' && e.data.id === rock),
    ).toBe(true);
    expect(world.entities[rock]).toBeUndefined();

    // Autonomía real: el único mensaje del cuidador fue "rompe la roca". Inventar,
    // fabricar y reintentar lo decidió ella, sin pedir permiso.
    expect(agent.events.ofType('user.message.received')).toHaveLength(1);
  });
});
