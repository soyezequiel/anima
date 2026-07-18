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
 * ADR 0063. Lo que está delante de los ojos se dibuja aunque esté ocupada.
 *
 * Dibujar un tipo nuevo ocurría solo en los ticks OCIOSOS —dibujar no cambia el
 * mundo, así que no debía robarle turnos al hambre ni al cuidador—. Pero
 * construyendo una escuela no hay ticks ociosos en cientos de turnos, y los
 * tipos que nacen ahí son justamente los que el cuidador está mirando
 * levantarse: los muros se quedaban con su dibujo genérico un rato larguísimo.
 */

const MURO_RECIPE = {
  id: 'muro-de-aula',
  ingredients: [{ kind: 'log', count: 1 }],
  outcomes: [
    {
      weight: 1,
      output: { kind: 'muro-de-aula', components: { portable: {}, collider: { solid: true } } },
    },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'muro-de-aula' },
};

/**
 * Un muro de 16x16 en el alfabeto cerrado de la quinta puerta: 0 vacío, 1 base,
 * 2 sombra, 3 luz. Los índices y no colores son lo que permite que la puerta
 * del mundo sea tan corta — el peor dibujo posible sigue teniendo el color de
 * su material.
 */
const GLYPH: ModelResponse = {
  kind: 'glyph',
  glyph: {
    kind: 'muro-de-aula',
    rows: [
      '3111111131111111',
      '3111111131111111',
      '3111111131111111',
      '2222222222222222',
      '1111311111113111',
      '1111311111113111',
      '1111311111113111',
      '2222222222222222',
      '3111111131111111',
      '3111111131111111',
      '3111111131111111',
      '2222222222222222',
      '1111311111113111',
      '1111311111113111',
      '1111311111113111',
      '2222222222222222',
    ],
  },
  rationale: 'ladrillos trabados con una sombra al pie',
};

function world(): { world: WorldState; petId: EntityId } {
  const w = createWorld({ width: 10, height: 6, seed: 4 }, { recipes: [MURO_RECIPE] });
  const petId = spawn(w, 'pet', {
    position: { x: 2, y: 3 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 10 },
  }).id;
  for (let i = 0; i < 3; i++) {
    spawn(w, 'log', { position: { x: 4 + i, y: 3 }, portable: {} });
  }
  return { world: w, petId };
}

function makeAgent(petId: EntityId, responses: ModelResponse[]) {
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
    now: () => '2026-07-18T00:00:00Z',
  });
}

describe('lo que tiene delante se dibuja sin esperar a estar ociosa (ADR 0063)', () => {
  it('con un encargo en marcha, igual le pone cara a lo que acaba de fabricar', async () => {
    const { world: w, petId } = world();
    const agent = makeAgent(petId, [INTERPRET_BUILD, GLYPH]);
    // La cola de dibujo se llena cuando el MUNDO acepta algo que ella inventó.
    // Se simula ese momento: lo que se prueba acá es qué hace después, no el
    // camino de la invención (que ya tiene sus pruebas).
    agent.observe([
      {
        type: 'recipe.learned',
        tick: 0,
        data: { actorId: petId, recipeId: 'muro-de-aula', outputKind: 'muro-de-aula' },
      },
    ]);
    agent.receiveUserMessage('hacé un muro de aula');

    // No alcanza con que se dibuje ALGUNA VEZ: en un mundo chico el encargo
    // termina rápido y el camino viejo (los ticks ociosos) también lo dibuja.
    // Lo que se mide es CUÁNDO: si el encargo seguía abierto en ese momento.
    let encargoAbiertoAlDibujar: boolean | null = null;
    for (let i = 0; i < 120 && encargoAbiertoAlDibujar === null; i++) {
      const abierto = agent.goals
        .all()
        .some(
          (g) =>
            g.userRequest?.kind === 'craft-item' &&
            (g.status === 'active' || g.status === 'suspended'),
        );
      const intent = await agent.think(buildPerception(w, petId));
      agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
      if (Object.keys(w.glyphs).includes('muro-de-aula')) encargoAbiertoAlDibujar = abierto;
    }

    expect(encargoAbiertoAlDibujar).toBe(true);
  });

  it('lo que NO tiene delante sigue esperando: no interrumpe por algo que ni ve', async () => {
    const { world: w, petId } = world();
    const agent = makeAgent(petId, [INTERPRET_BUILD, GLYPH]);
    // Un tipo que aprendió pero que no existe en ningún lado del mapa.
    agent.observe([
      {
        type: 'recipe.learned',
        tick: 0,
        data: { actorId: petId, recipeId: 'farol-lejano', outputKind: 'farol-lejano' },
      },
    ] as never);
    agent.receiveUserMessage('hacé un muro de aula');

    // Mientras el encargo está en marcha, un dibujo de algo invisible no le
    // roba el turno: para eso están los ticks ociosos de siempre.
    for (let i = 0; i < 15; i++) {
      const intent = await agent.think(buildPerception(w, petId));
      agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
      const trabajando = agent.goals
        .all()
        .some((g) => g.userRequest?.kind === 'craft-item' && g.status === 'active');
      if (trabajando) expect(Object.keys(w.glyphs)).not.toContain('farol-lejano');
    }
  });
});

describe('la intención de dibujar sobrevive a la recarga (ADR 0064)', () => {
  it('la cola viaja en el guardado', () => {
    const { petId } = world();
    const agent = makeAgent(petId, []);
    agent.observe([
      {
        type: 'recipe.learned',
        tick: 0,
        data: { actorId: petId, recipeId: 'muro-de-aula', outputKind: 'muro-de-aula' },
      },
    ] as never);

    // Guardar y restaurar en otro agente: es lo que hace recargar la página.
    const otro = makeAgent(petId, []);
    otro.importState(agent.exportState());
    expect(otro.exportState().pendingGlyphs).toContain('muro-de-aula');
  });

  it('se le puede volver a pedir un dibujo perdido, sin duplicar los que ya espera', () => {
    const { petId } = world();
    const agent = makeAgent(petId, []);
    agent.requestGlyphsFor(['muro-de-aula', 'pizarra-escuela']);
    agent.requestGlyphsFor(['muro-de-aula']);
    expect(agent.exportState().pendingGlyphs).toEqual(['muro-de-aula', 'pizarra-escuela']);
  });

  it('un guardado viejo, sin el campo, carga como una cola vacía', () => {
    const { petId } = world();
    const agent = makeAgent(petId, []);
    const viejo = agent.exportState();
    delete viejo.pendingGlyphs;
    agent.importState(viejo);
    expect(agent.exportState().pendingGlyphs).toEqual([]);
  });
});
