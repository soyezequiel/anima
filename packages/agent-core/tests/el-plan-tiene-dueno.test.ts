import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn } from '@anima/sim-core';
import { MemoryStore } from '@anima/memory';
import { GoalManager } from '../src/goals.js';
import { InventionEngine } from '../src/invention.js';
import { ProgressController } from '../src/progress.js';

/**
 * Una idea es de quien la pidió.
 *
 * El plan a medio proponer vivía suelto en el motor: `pendingPlan`,
 * `pendingBlueprint` y `pendingProblem` eran campos de la clase, no del
 * objetivo. `nextPlanStep` se llama desde el camino del hambre y desde el del
 * encargo del cuidador sin mirar de dónde venía el plan, así que una idea
 * nacida del frío seguía entrando al mundo por el encargo, y al revés.
 *
 * Importa más allá de la prolijidad: cualquier regla que mire «para qué
 * objetivo se está inventando» —el crédito de intentos, la materia
 * comprometida— se podía saltear por ese agujero, porque la segunda pieza del
 * plan ya no pasaba por el objetivo que la había pedido.
 */

/** Un plan de dos recetas: la primera entra, la segunda queda pendiente. */
const PLAN: ModelResponse = {
  kind: 'recipe-plan',
  recipes: [
    {
      id: 'tabla',
      output: { kind: 'tabla', components: { portable: {} } },
      ingredients: [{ kind: 'tronco', count: 1 }],
    },
    {
      id: 'banco',
      output: { kind: 'banco', components: { portable: {} } },
      ingredients: [{ kind: 'tabla', count: 2 }],
    },
  ],
  rationale: 'para sentarme',
} as ModelResponse;

const JUDGE_OK: ModelResponse = { kind: 'judgement', willing: true, reason: 'va' } as ModelResponse;

function world(): { world: WorldState; petId: EntityId } {
  const w = createWorld({ width: 10, height: 7, seed: 4 });
  const petId = spawn(w, 'pet', {
    position: { x: 2, y: 3 },
    collider: { solid: true },
    energy: { current: 40, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  spawn(w, 'tronco', { position: { x: 4, y: 3 }, portable: {} });
  return { world: w, petId };
}

function engine(responses: ModelResponse[]): InventionEngine {
  return new InventionEngine({
    provider: new ScriptedModelProvider(responses, { interpretsLanguage: true }),
    memory: new MemoryStore(),
    goals: new GoalManager(),
    progress: new ProgressController(),
    emit: () => {},
    reply: () => {},
    currentTick: () => 1,
  });
}

describe('el plan de invención es del objetivo que lo pidió', () => {
  it('otro objetivo no continúa el plan que abrió el primero', async () => {
    const { world: w, petId } = world();
    const invention = engine([PLAN, JUDGE_OK, JUDGE_OK, JUDGE_OK]);
    const perception = buildPerception(w, petId);

    // El objetivo del frío abre el plan y emite su primera receta.
    const first = await invention.inventRecipe('tengo frío', perception, { goalId: 'goal-frio' });
    expect(first?.type).toBe('proposeRecipe');

    // El encargo del cuidador pasa por acá y NO se lleva puesta la que sigue:
    // ese plan no es suyo. Antes se la llevaba, y con ella se colaban al mundo
    // piezas que nadie había pedido desde este objetivo.
    const ajeno = await invention.nextPlanStep(perception, 'goal-encargo');
    expect(ajeno).toBeNull();

    // Su dueño sí lo sigue: el plan no se perdió, sigue esperándolo.
    const propio = await invention.nextPlanStep(perception, 'goal-frio');
    expect(propio?.type).toBe('proposeRecipe');
  });

  it('sin dueño anotado, seguir el plan es de cualquiera (compatibilidad)', async () => {
    const { world: w, petId } = world();
    const invention = engine([PLAN, JUDGE_OK, JUDGE_OK, JUDGE_OK]);
    const perception = buildPerception(w, petId);

    await invention.inventRecipe('tengo frío', perception, { goalId: 'goal-frio' });
    // Sin decir de parte de quién se pregunta, contesta como siempre: el
    // parámetro es opcional y no rompe a quien todavía no lo pasa.
    const anonimo = await invention.nextPlanStep(perception);
    expect(anonimo?.type).toBe('proposeRecipe');
  });
});
