import { describe, expect, it } from 'vitest';
import { isMadeFrom } from '@anima/sim-core';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { Blueprint, EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * ADR 0058. No romper algo para sacarle la materia de la que está hecho.
 *
 * Partida real: escuela de 5 paredes + 1 pizarrón, `pared-aula = 1x log`. Al
 * romperse, una pared deja su tronco — así que una pared FIGURA como fuente de
 * troncos. Y como cosechar prefiere lo más blando, y una pared (dureza ~2)
 * cuesta menos golpes que un árbol (dureza 5), las cuatro fuentes más baratas
 * que veía eran **sus propias paredes ya colocadas**.
 *
 * Para conseguir el tronco con el que hacer la quinta pared, demolía una de las
 * cuatro que ya había levantado. Un círculo perfecto: la escuela nunca pasaba
 * de cuatro paredes por más ticks que corriera.
 */

const SCHOOL: Blueprint = {
  id: 'escuela',
  placements: [
    { kind: 'pared-aula', offset: { x: -1, y: 0 } },
    { kind: 'pared-aula', offset: { x: 1, y: 0 } },
  ],
};

const WALL_RECIPE = {
  id: 'pared-aula',
  ingredients: [{ kind: 'log', count: 1 }],
  outcomes: [
    {
      weight: 1,
      output: {
        kind: 'pared-aula',
        components: {
          portable: {},
          collider: { solid: true },
          hardness: { value: 2 },
          durability: { current: 6, max: 6 },
          // Lo que la vuelve una trampa: devuelve el tronco que costó.
          drops: [{ kind: 'log', components: { portable: {} } }],
        },
      },
    },
  ],
};

/** Un refugio cuesta TRES troncos: romperlo por uno es el peor negocio. */
const SHELTER_RECIPE = {
  id: 'shelter',
  ingredients: [{ kind: 'log', count: 3 }],
  outcomes: [
    { weight: 1, output: { kind: 'shelter', components: { shelter: { range: 1 } } } },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'escuela' },
};

/**
 * El señuelo es un REFUGIO, no una pared: hecho de tres troncos, blando y
 * cerca. Si fuera una pared, recogerla sería legítimo (es justo el bloque que
 * necesita) y no probaría nada. El refugio solo sirve roto — y romperlo cuesta
 * tres troncos para ganar uno.
 */
function schoolWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld(
    { width: 16, height: 9, seed: 6 },
    { recipes: [WALL_RECIPE, SHELTER_RECIPE], blueprints: [SCHOOL] },
  );
  const pet = spawn(world, 'pet', {
    position: { x: 3, y: 4 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 3 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 16 },
  });
  const hammer = spawn(world, 'hammer', { portable: {}, tool: { power: 8 } });
  pet.components.inventory!.items = [hammer.id];
  // Blando y al lado: lo que el orden por dureza elegía primero.
  spawn(world, 'shelter', {
    position: { x: 5, y: 4 },
    shelter: { range: 1 },
    hardness: { value: 2 },
    durability: { current: 6, max: 6 },
    drops: [
      { kind: 'log', components: { portable: {} } },
      { kind: 'log', components: { portable: {} } },
      { kind: 'log', components: { portable: {} } },
    ],
  });
  // Los árboles: más duros y más lejos, pero son la fuente HONESTA.
  for (let i = 0; i < 3; i++) {
    spawn(world, 'tree', {
      position: { x: 11 + i, y: 7 },
      hardness: { value: 5 },
      durability: { current: 8, max: 8 },
      drops: [{ kind: 'log', components: { portable: {} } }],
    });
  }
  return { world, petId: pet.id };
}

function makeAgent(petId: EntityId) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider: new ScriptedModelProvider([INTERPRET_BUILD], { interpretsLanguage: true }),
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-18T00:00:00Z',
  });
}

describe('no se rompe lo hecho para sacar de qué está hecho (ADR 0058)', () => {
  it('la regla, sola: una pared no es fuente de los troncos que la componen', () => {
    const recipes = [WALL_RECIPE];
    expect(isMadeFrom('pared-aula', 'log', recipes)).toBe(true);
    // Al revés no: un tronco no está hecho de paredes.
    expect(isMadeFrom('log', 'pared-aula', recipes)).toBe(false);
    // Y un árbol no se hace de nada: romperlo es legítimo.
    expect(isMadeFrom('tree', 'log', recipes)).toBe(false);
  });

  it('sigue la cadena entera, no solo el primer paso', () => {
    const tabla = {
      id: 'tabla',
      ingredients: [{ kind: 'log', count: 1 }],
      outcomes: [{ weight: 1, output: { kind: 'tabla', components: { portable: {} } } }],
    };
    const muro = {
      id: 'muro',
      ingredients: [{ kind: 'tabla', count: 2 }],
      outcomes: [{ weight: 1, output: { kind: 'muro', components: { portable: {} } } }],
    };
    // El muro se hace de tablas, que se hacen de troncos: romperlo por troncos
    // deshace DOS capas de trabajo, no una.
    expect(isMadeFrom('muro', 'log', [tabla, muro])).toBe(true);
  });

  it('tala el árbol duro y lejano antes que romper el refugio blando de al lado', async () => {
    const { world, petId } = schoolWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una escuela');

    const enPie = (kind: string) =>
      Object.values(world.entities).filter((e) => e.kind === kind && e.components.position).length;

    for (let i = 0; i < 500 && enPie('pared-aula') < 2; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    // El refugio sigue en pie: está hecho de troncos, así que no es una fuente
    // de troncos. Romperlo habría costado tres para ganar uno.
    expect(enPie('shelter')).toBe(1);
    // Y la madera salió de donde tenía que salir.
    expect(enPie('tree')).toBeLessThan(3);
    expect(enPie('pared-aula')).toBe(2);
  });
});
