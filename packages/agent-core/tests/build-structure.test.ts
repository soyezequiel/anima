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

  it('una casa más grande que las manos se levanta en tandas (ADR 0034)', async () => {
    // El caso real reportado, pero al derecho: una casa de 7 paredes y capacidad
    // 6. Antes el mundo la rechazaba ("no me entra en los brazos"); ahora la
    // construye de a un bloque volviendo al ancla, sin el tope de las manos. La
    // puerta va al SUR (offset 0,1 libre): por ahí sale a buscar y vuelve.
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
        { kind: 'pared-de-tronco', offset: { x: 1, y: 1 } },
      ],
    });
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'casa' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    // El ancla es donde arranca la obra: la posición al pedirla.
    const base = { ...world.entities[petId]!.components.position! };
    agent.receiveUserMessage('construí una casa');
    for (let i = 0; i < 400; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }
    // Las 7 paredes quedaron puestas, aunque nunca cupieran las 7 en la mano.
    const paredes = allEntities(world).filter(
      (e) => e.kind === 'pared-de-tronco' && e.components.position,
    );
    expect(paredes.length).toBe(7);
    // Y cada una en su celda del plano (ancla base + offset), no donde quedó
    // parada la mascota: la obra es una disposición en el mundo, no a su lado.
    const expected = new Set(
      world.blueprints
        .find((b) => b.id === 'casa')!
        .placements.map((p) => `${base.x + p.offset.x},${base.y + p.offset.y}`),
    );
    for (const pared of paredes) {
      const pos = pared.components.position!;
      expect(expected.has(`${pos.x},${pos.y}`)).toBe(true);
    }
  });

  it('obra grande: camina hasta celdas lejos del ancla, no solo su alrededor (ADR 0035)', async () => {
    // Una pared larga hacia el norte: 6 celdas en fila a dos filas de distancia,
    // más allá del alcance del brazo. La mascota tiene que CAMINAR hasta cada una.
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
    // Fila a y = base-2 (fuera del 3×3), de x = base-2 a base+3: seis paredes que
    // el viejo footprint jamás habría permitido.
    world.blueprints.push({
      id: 'muralla',
      placements: [-2, -1, 0, 1, 2, 3].map((dx) => ({
        kind: 'pared-de-tronco',
        offset: { x: dx, y: -2 },
      })),
    });
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'muralla' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    const base = { ...world.entities[petId]!.components.position! };
    agent.receiveUserMessage('construí una muralla');
    for (let i = 0; i < 400; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }
    const paredes = allEntities(world).filter(
      (e) => e.kind === 'pared-de-tronco' && e.components.position,
    );
    // Las seis, cada una en su columna, todas a dos filas del ancla — imposible
    // sin caminar hasta ellas.
    expect(paredes.length).toBe(6);
    const cells = new Set(paredes.map((p) => `${p.components.position!.x},${p.components.position!.y}`));
    for (const dx of [-2, -1, 0, 1, 2, 3]) {
      expect(cells.has(`${base.x + dx},${base.y - 2}`)).toBe(true);
    }
  });

  it('retomar sin repetir: no reconstruye las paredes que ya están puestas', async () => {
    // Idempotencia de la obra (ADR 0034): si dos celdas del plano ya tienen su
    // pared —una tanda anterior, o un guardado a medias—, la mascota las saltea
    // (`blockAt`) y solo levanta las que faltan, sin recogerlas ni rehacerlas.
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
        { kind: 'pared-de-tronco', offset: { x: 0, y: -1 } },
        { kind: 'pared-de-tronco', offset: { x: -1, y: 0 } },
        { kind: 'pared-de-tronco', offset: { x: 1, y: 0 } },
        { kind: 'pared-de-tronco', offset: { x: 0, y: 1 } },
      ],
    });
    // Dos paredes YA puestas (a medias): en el norte y el oeste del ancla (7,5),
    // sin `portable` — son parte de la obra, no materia suelta.
    const pet0 = world.entities[petId]!.components.position!;
    const preplaced: Array<[number, number]> = [
      [0, -1],
      [-1, 0],
    ];
    for (const [dx, dy] of preplaced) {
      spawn(world, 'pared-de-tronco', {
        position: { x: pet0.x + dx, y: pet0.y + dy },
        collider: { solid: true },
      });
    }
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'casa' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    agent.receiveUserMessage('construí una casa');
    let placed = 0;
    for (let i = 0; i < 300; i++) {
      const intent = await agent.think(perception());
      if (intent) {
        const events = stepWorld(world, [{ actorId: petId, intent }]);
        agent.observe(events);
        placed += events.filter((e) => e.type === 'item.placed').length;
      }
    }
    // Las 4 celdas terminaron con su pared…
    const paredes = allEntities(world).filter(
      (e) => e.kind === 'pared-de-tronco' && e.components.position,
    );
    expect(paredes.length).toBe(4);
    // …pero solo colocó las 2 que faltaban: las otras dos ya estaban.
    expect(placed).toBe(2);
  });
});
