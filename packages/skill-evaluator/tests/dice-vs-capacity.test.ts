import { describe, expect, it } from 'vitest';
import type { EntityId, Recipe, WorldState } from '@anima/sim-core';
import { createWorld, spawn } from '@anima/sim-core';
import type { SkillProgram } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { evaluateSkill, RegressionStore, applyEvaluation } from '../src/index.js';

const now = () => '2026-07-17T00:00:00Z';

/**
 * Una receta que SIEMPRE pierde la tirada: su único desenlace no produce nada.
 * Es la fogata del ADR 0020 con el dado cargado, para que el caso sea sobre lo
 * que hace la mascota después de perder y no sobre la probabilidad de perder.
 */
function alwaysFailingRecipe(spares: Recipe['ingredients']): Recipe {
  return {
    id: 'prender-fuego',
    ingredients: [
      { kind: 'log', count: 1 },
      { kind: 'flint', count: 1 },
    ],
    outcomes: [{ weight: 1, ...(spares.length > 0 ? { spares } : {}) }],
  };
}

/** Mundo mínimo: la mascota con los ingredientes ya en la mano. */
function buildWorld(
  recipe: Recipe,
  hand: { logs: number; flints: number },
): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 5, height: 5, seed: 1 }, { recipes: [recipe] });
  const pet = spawn(world, 'pet', {
    position: { x: 2, y: 2 },
    collider: { solid: true },
    energy: { current: 40, max: 50, decayPerTick: 0 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  });
  for (let i = 0; i < hand.logs; i++) {
    pet.components.inventory!.items.push(spawn(world, 'log', { portable: {} }).id);
  }
  for (let i = 0; i < hand.flints; i++) {
    pet.components.inventory!.items.push(spawn(world, 'flint', { portable: {} }).id);
  }
  return { world, petId: pet.id };
}

const CRAFT_ONCE: SkillProgram = [{ op: 'craft', recipeId: 'prender-fuego' }];

function makeSkill(library: SkillLibrary, program: SkillProgram) {
  return library.addExperimental({
    name: 'prender-fuego',
    description: 'Prende una fogata con lo que lleva',
    motivation: 'tengo frío',
    program,
    expectedOutcome: 'aparece una fogata',
    successCriteria: [{ type: 'craftedKind', kind: 'campfire' }],
    createdAt: now(),
  });
}

/**
 * El ADR 0030 en dos casos. La tirada perdida es idéntica en los dos: lo único
 * que cambia es si le quedó pedernal para volver a intentar. Esa diferencia es
 * toda la diferencia entre «el mundo no dio» y «se rindió».
 */
describe('suerte contra capacidad (ADR 0030)', () => {
  it('sin material para reintentar, la tirada perdida no cuenta: inconcluyente', () => {
    // El desenlace fallido se lleva todo: no hay con qué volver a intentar.
    const recipe = alwaysFailingRecipe([]);
    const skill = makeSkill(new SkillLibrary(), CRAFT_ONCE);
    const report = evaluateSkill(skill, {
      scenarios: [{ name: 'fragua', build: () => buildWorld(recipe, { logs: 1, flints: 1 }) }],
      seeds: [1],
    });

    expect(report.cases[0]?.verdict).toBe('inconclusive');
    expect(report.inconclusiveCases).toBe(1);
    // Sin un solo caso concluyente no hay tasa que reportar, y eso NO es 0%
    // de capacidad: es ausencia de evidencia.
    expect(report.successRate).toBe(0);
    // Y no se le pide al modelo que corrija la suerte.
    expect(report.failureObservations).toEqual([]);
  });

  it('con material de sobra, rendirse después de la tirada sí es suyo: fallo', () => {
    // La fogata real del ADR 0020: el fallo quema el tronco pero deja el
    // pedernal. Con un tronco de repuesto en la mano, podía volver a intentar
    // y paró igual — y «se pierde el material, nunca la posibilidad».
    const recipe = alwaysFailingRecipe([{ kind: 'flint', count: 1 }]);
    const skill = makeSkill(new SkillLibrary(), CRAFT_ONCE);
    const report = evaluateSkill(skill, {
      scenarios: [{ name: 'fragua', build: () => buildWorld(recipe, { logs: 2, flints: 1 }) }],
      seeds: [1],
    });

    expect(report.cases[0]?.verdict).toBe('failed');
    expect(report.inconclusiveCases).toBe(0);
    expect(report.failureObservations.length).toBeGreaterThan(0);
  });

  it('un caso inconcluyente no se archiva como regresión', () => {
    const library = new SkillLibrary();
    const skill = makeSkill(library, CRAFT_ONCE);
    const regressions = new RegressionStore();
    const report = evaluateSkill(skill, {
      scenarios: [
        { name: 'fragua', build: () => buildWorld(alwaysFailingRecipe([]), { logs: 1, flints: 1 }) },
      ],
      seeds: [1],
    });

    const decision = applyEvaluation(skill, report, library, regressions, { now });

    // Se rechaza —no hay evidencia para promover— pero no deja una prueba
    // que ninguna versión futura podría aprobar: la tirada no se supera.
    expect(decision.verdict).toBe('rejected');
    expect(decision.reasons.join(' ')).toContain('sin evidencia concluyente');
    expect(decision.regressionsAdded).toBe(0);
    expect(regressions.all()).toEqual([]);
  });
});
