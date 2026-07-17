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
 * Eje B del árbol de crafteo (ADR 0032): lo grande no es un objeto, es una
 * obra. Pedirle una casa ya no hace un «bloque casa» — junta las paredes y las
 * coloca en el suelo, formando una casa hecha de bloques.
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

function openWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 15, height: 11, seed: 3 });
  const petId = spawn(world, 'pet', {
    position: { x: 7, y: 5 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  // Un bosque de troncos lejos del sitio de obra: 5 paredes = 10 tablas = 10
  // troncos, más margen para los intentos que fallan (ADR 0020).
  let placed = 0;
  for (let y = 9; y <= 10 && placed < 14; y++) {
    for (let x = 1; x < 14 && placed < 14; x++) {
      spawn(world, 'log', { position: { x, y }, portable: {} });
      placed++;
    }
  }
  return { world, petId };
}

function makeAgent(world: WorldState, petId: EntityId, provider: MockModelProvider) {
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
  return { agent, perception: () => buildPerception(world, petId) };
}

describe('construir una casa es levantar una obra, no hacer un bloque', () => {
  it('junta las paredes y las coloca: la casa son bloques en el suelo, no una entidad', async () => {
    const { world, petId } = openWorld();
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'casa' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    agent.receiveUserMessage('construí una casa');

    for (let i = 0; i < 260; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // No existe ninguna entidad "casa": la casa no es una cosa (ADR 0032).
    expect(allEntities(world).some((e) => e.kind === 'casa')).toBe(false);
    // El plano entró al mundo, y las piezas también.
    expect(world.blueprints.map((b) => b.id)).toContain('casa');
    expect(world.recipes.map((r) => r.id)).toEqual(
      expect.arrayContaining(['tabla', 'pared']),
    );

    // Y quedaron paredes COLOCADAS en el suelo, formando la obra. El mock
    // propone 5, con la puerta hacia abajo.
    const paredes = allEntities(world).filter(
      (e) => e.kind === 'pared' && e.components.position,
    );
    expect(paredes.length).toBe(5);

    // Alrededor de la mascota (footprint 3×3): cada pared está a distancia 1.
    const pet = world.entities[petId]!.components.position!;
    for (const pared of paredes) {
      const dx = Math.abs(pared.components.position!.x - pet.x);
      const dy = Math.abs(pared.components.position!.y - pet.y);
      expect(Math.max(dx, dy)).toBe(1);
    }
  });

  it('una obra ya aprendida no se re-inventa: se construye directo', async () => {
    const { world, petId } = openWorld();
    // Un mundo que YA sabe la obra y sus piezas (como tras restaurar un
    // guardado): pedirla no debe gastar ni una consulta de invención.
    world.recipes.push({
      id: 'tabla',
      outcomes: [{ weight: 1, output: { kind: 'tabla', components: { portable: {} } } }],
      ingredients: [{ kind: 'log', count: 1 }],
    });
    world.recipes.push({
      id: 'pared',
      outcomes: [
        {
          weight: 1,
          output: {
            kind: 'pared',
            components: { portable: {}, collider: { solid: true } },
          },
        },
      ],
      ingredients: [{ kind: 'tabla', count: 2 }],
    });
    world.blueprints.push({
      id: 'casa',
      placements: [
        { kind: 'pared', offset: { x: 0, y: -1 } },
        { kind: 'pared', offset: { x: -1, y: 0 } },
        { kind: 'pared', offset: { x: 1, y: 0 } },
      ],
    });
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'casa' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    agent.receiveUserMessage('construí una casa');

    for (let i = 0; i < 200; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // No propuso nada nuevo: la obra ya existía.
    expect(agent.events.ofType('recipe.proposed').length).toBe(0);
    const paredes = allEntities(world).filter(
      (e) => e.kind === 'pared' && e.components.position,
    );
    expect(paredes.length).toBe(3);
  });

  it('una obra vieja que no le entra en los brazos falla con motivo, no con "no encuentro el objeto"', async () => {
    // El caso real reportado: un guardado con una casa de 7 paredes y capacidad
    // 6. La obra ya está aprendida (la puerta de hoy la rechazaría, pero esta
    // se guardó antes). Al construirla, la mascota dice por qué no puede.
    const { world, petId } = openWorld();
    world.recipes.push({
      id: 'pared-de-tronco',
      outcomes: [
        {
          weight: 1,
          output: { kind: 'pared-de-tronco', components: { portable: {}, collider: { solid: true } } },
        },
      ],
      ingredients: [{ kind: 'log', count: 1 }],
    });
    world.blueprints.push({
      id: 'casa',
      placements: [
        { kind: 'pared-de-tronco', offset: { x: -1, y: -1 } },
        { kind: 'pared-de-tronco', offset: { x: 0, y: -1 } },
        { kind: 'pared-de-tronco', offset: { x: 1, y: -1 } },
        { kind: 'pared-de-tronco', offset: { x: -1, y: 0 } },
        { kind: 'pared-de-tronco', offset: { x: 1, y: 0 } },
        { kind: 'pared-de-tronco', offset: { x: -1, y: 1 } },
        { kind: 'pared-de-tronco', offset: { x: 0, y: 1 } },
      ],
    });
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'casa' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    agent.receiveUserMessage('construí una casa');
    const said: string[] = [];
    for (let i = 0; i < 260; i++) {
      const intent = await agent.think(perception());
      if (!intent) continue;
      if (intent.type === 'speak') said.push(intent.text);
      agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }
    const failure = said.find((t) => t.startsWith('No pude completar eso'));
    expect(failure).toBeDefined();
    // Nombra la casa, el número de bloques y el límite de sus brazos — nunca el
    // opaco "no encuentro el objeto" que el cuidador vio en la corrida real.
    expect(failure).toContain('son 7');
    expect(failure).toContain('solo puedo cargar 6');
    expect(failure).not.toContain('no encuentro el objeto');
  });

  it('si el mundo rechaza una obra por grande, el motivo vuelve al modelo para que proponga una más chica', async () => {
    const { world, petId } = openWorld();
    // Un modelo que primero propone una casa de 7 paredes (no entra) y, con el
    // rechazo del mundo como dato, corrige a una de 5. Prueba el lazo entero:
    // puerta → rechazo → memoria → propuesta más chica → obra construida.
    let attempt = 0;
    const paredRecipe = {
      id: 'pared-de-tronco',
      output: { kind: 'pared-de-tronco', components: { portable: {}, collider: { solid: true } } },
      ingredients: [{ kind: 'log', count: 1 }],
    };
    const ring = (n: number) =>
      [
        { x: -1, y: -1 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: -1, y: 1 },
        { x: 0, y: 1 },
      ]
        .slice(0, n)
        .map((offset) => ({ kind: 'pared-de-tronco', offset }));
    class Adaptive extends MockModelProvider {
      override readonly interpretsLanguage = true;
      override complete(request: ModelRequest): Promise<ModelResponse> {
        if (request.kind === 'interpret.command') {
          return Promise.resolve({
            kind: 'command.interpretation',
            command: { action: 'craft-item', recipeId: 'casa' },
          });
        }
        if (request.kind === 'recipe.propose') {
          attempt += 1;
          // Primer intento: 7 paredes (rechazada). Después: 5.
          const n = attempt === 1 ? 7 : 5;
          return Promise.resolve({
            kind: 'blueprint',
            recipes: [paredRecipe],
            blueprint: { id: 'casa', placements: ring(n) },
            rationale: 'una casa de paredes',
          });
        }
        return super.complete(request);
      }
    }
    const { agent, perception } = makeAgent(world, petId, new Adaptive());
    agent.receiveUserMessage('construí una casa');
    for (let i = 0; i < 320; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }
    // El mundo rechazó la primera (grande) y aceptó una obra al final.
    expect(agent.events.ofType('blueprint.rejected').length).toBeGreaterThan(0);
    const paredes = allEntities(world).filter(
      (e) => e.kind === 'pared-de-tronco' && e.components.position,
    );
    expect(paredes.length).toBe(5);
  });
});
