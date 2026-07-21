import { describe, expect, it } from 'vitest';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { SkillExecution } from '@anima/skill-runtime';
import type { CausalAction, CausalFact } from '../src/index.js';
import {
  causalFluent,
  causalPlanToSkillProgram,
  causalState,
  deriveCausalWorldModel,
  factValue,
  holdingCausalGoal,
  planCausally,
  replanCausally,
  validateCausalPlan,
  validateObservedStep,
} from '../src/index.js';

function fact(fluent: string, value: number): CausalFact {
  return { fluent, value, knowledge: 'known', authority: 'world' };
}

function action(
  id: string,
  preconditions: CausalAction['preconditions'],
  effects: CausalAction['effects'],
  cost = 1,
): CausalAction {
  return {
    id,
    description: id,
    authority: 'world',
    knowledge: 'known',
    preconditions,
    effects,
    cost,
    risk: 0,
  };
}

describe('planificador causal general', () => {
  it('descubre recoger materiales → fabricar herramienta → transformar fuente → recoger recurso', () => {
    const world = createWorld(
      { width: 8, height: 6, seed: 3 },
      {
        recipes: [
          {
            id: 'stone-axe',
            ingredients: [
              { kind: 'stone', count: 1 },
              { kind: 'fiber', count: 1 },
            ],
            outcomes: [
              {
                weight: 1,
                output: {
                  kind: 'stone-axe',
                  components: {
                    portable: {},
                    tool: { power: 5 },
                    durability: { current: 10, max: 10 },
                  },
                },
              },
            ],
          },
        ],
      },
    );
    const pet = spawn(world, 'pet', {
      position: { x: 2, y: 2 },
      inventory: { items: [], capacity: 6 },
      strength: { value: 1 },
      agent: { name: 'Anima', perceptionRange: 8 },
    });
    spawn(world, 'stone', { position: { x: 1, y: 2 }, portable: {} });
    spawn(world, 'fiber', { position: { x: 2, y: 1 }, portable: {} });
    spawn(world, 'tree', {
      position: { x: 3, y: 2 },
      collider: { solid: true },
      hardness: { value: 3 },
      durability: { current: 6, max: 6 },
      drops: [{ kind: 'log', components: { portable: {} } }],
    });

    const model = deriveCausalWorldModel(buildPerception(world, pet.id));
    const result = planCausally(model.initial, holdingCausalGoal('log'), model.actions);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.confidence).toBe('known');
    expect(result.plan.steps.map((step) => step.id)).toEqual([
      'pickup:fiber',
      'pickup:stone',
      'craft:stone-axe:stone-axe',
      'pickup:stone-axe',
      expect.stringMatching(/^harvest:.+:with:stone-axe$/),
      'pickup:log',
    ]);

    const program = causalPlanToSkillProgram(result.plan);
    expect(program).not.toBeNull();
    const execution = new SkillExecution(program!, pet.id);
    for (let tick = 0; tick < 80; tick++) {
      const output = execution.next(buildPerception(world, pet.id));
      if (output.kind === 'done') break;
      const events = stepWorld(world, [{ actorId: pet.id, intent: output.intent }]);
      execution.observe(events);
    }
    const inventory = world.entities[pet.id]!.components.inventory!.items;
    expect(inventory.map((id) => world.entities[id]?.kind)).toContain('log');
  });

  it('elige el recurso suelto barato en vez de destruir y fabricar', () => {
    const initial = causalState([
      fact('loose:log', 1),
      fact('inventory:log', 0),
      fact('inventory:axe', 0),
      fact('tree', 1),
    ]);
    const pickup = action(
      'pickup-log',
      [{ fluent: 'loose:log', comparison: 'at-least', value: 1 }],
      [
        { fluent: 'loose:log', operation: 'decrease', value: 1, knowledge: 'known' },
        { fluent: 'inventory:log', operation: 'increase', value: 1, knowledge: 'known' },
      ],
      1,
    );
    const expensive = action(
      'fell-tree',
      [
        { fluent: 'tree', comparison: 'at-least', value: 1 },
        { fluent: 'inventory:axe', comparison: 'at-least', value: 1 },
      ],
      [{ fluent: 'loose:log', operation: 'increase', value: 1, knowledge: 'known' }],
      9,
    );
    const result = planCausally(initial, holdingCausalGoal('log'), [pickup, expensive]);
    expect(result.ok && result.plan.steps.map((step) => step.id)).toEqual(['pickup-log']);
  });

  it('rechaza un plan que tala antes de tener herramienta', () => {
    const initial = causalState([fact('tree', 1), fact('inventory:axe', 0)]);
    const fell = action(
      'fell-tree',
      [
        { fluent: 'tree', comparison: 'at-least', value: 1 },
        { fluent: 'inventory:axe', comparison: 'at-least', value: 1 },
      ],
      [{ fluent: 'inventory:log', operation: 'increase', value: 1, knowledge: 'known' }],
    );
    const validation = validateCausalPlan(initial, holdingCausalGoal('log'), [fell]);

    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'false-precondition', detail: expect.stringContaining('axe') }),
        expect.objectContaining({ kind: 'goal-unmet' }),
      ]),
    );
  });

  it('no deja que el LLM marque una hipótesis física como conocida', () => {
    const invented: CausalAction = {
      ...action(
        'sing-to-create-log',
        [],
        [{ fluent: 'inventory:log', operation: 'increase', value: 1, knowledge: 'known' }],
      ),
      authority: 'model',
    };
    const result = planCausally(
      causalState([fact('inventory:log', 0)]),
      holdingCausalGoal('log'),
      [invented],
    );

    expect(result).toMatchObject({ ok: false, reason: 'invalid-model' });
    if (!result.ok) expect(result.diagnostics.join(' ')).toContain('modelo');
  });

  it('mantiene las hipótesis separadas y sólo las usa con permiso explícito', () => {
    const hypothesis: CausalAction = {
      id: 'search-log',
      description: 'quizá encuentre un tronco',
      authority: 'model',
      knowledge: 'hypothetical',
      preconditions: [],
      effects: [
        {
          fluent: 'inventory:log',
          operation: 'increase',
          value: 1,
          knowledge: 'hypothetical',
        },
      ],
      cost: 2,
      risk: 0.4,
    };
    const initial = causalState([fact('inventory:log', 0)]);

    expect(planCausally(initial, holdingCausalGoal('log'), [hypothesis])).toMatchObject({
      ok: false,
      reason: 'no-plan',
    });
    const provisional = planCausally(initial, holdingCausalGoal('log'), [hypothesis], {
      allowHypothetical: true,
    });
    expect(provisional.ok && provisional.plan.confidence).toBe('hypothetical');
  });

  it('detecta un efecto ausente y replantea desde lo observado', () => {
    const initial = causalState([fact('material', 1), fact('product', 0), fact('loose:product', 1)]);
    const craft = action(
      'craft',
      [{ fluent: 'material', comparison: 'at-least', value: 1 }],
      [
        { fluent: 'material', operation: 'decrease', value: 1, knowledge: 'known' },
        { fluent: 'product', operation: 'increase', value: 1, knowledge: 'known' },
      ],
    );
    const pickup = action(
      'pickup-alternative',
      [{ fluent: 'loose:product', comparison: 'at-least', value: 1 }],
      [
        { fluent: 'loose:product', operation: 'decrease', value: 1, knowledge: 'known' },
        { fluent: 'product', operation: 'increase', value: 1, knowledge: 'known' },
      ],
      3,
    );
    const observed = causalState([
      fact('material', 0),
      fact('product', 0),
      fact('loose:product', 1),
    ]);
    expect(validateObservedStep(craft, initial, observed)).toEqual({
      valid: false,
      reason: 'effect-missing',
      fluent: 'product',
    });

    const revised = replanCausally(
      observed,
      { conditions: [{ fluent: 'product', comparison: 'at-least', value: 1 }] },
      [craft, pickup],
      new Set(['craft']),
    );
    expect(revised.ok && revised.plan.steps.map((step) => step.id)).toEqual([
      'pickup-alternative',
    ]);
  });

  it('incluye navegación e interacciones aprendidas sin tratarlas como verbos especiales', () => {
    const world = createWorld(
      { width: 7, height: 5, seed: 1 },
      {
        interactions: [
          {
            id: 'fill-bucket',
            description: 'llenar el balde en agua',
            stance: 'beside',
            target: { wet: true },
            requires: { heldKind: 'bucket' },
            effects: [
              {
                type: 'transform-held',
                kind: 'water-bucket',
                components: { portable: {} },
              },
            ],
          },
        ],
      },
    );
    const bucket = spawn(world, 'bucket', { portable: {} });
    const pet = spawn(world, 'pet', {
      position: { x: 1, y: 1 },
      inventory: { items: [bucket.id], capacity: 4 },
      agent: { name: 'Anima', perceptionRange: 7 },
    });
    const water = spawn(world, 'water', { position: { x: 4, y: 1 }, water: {} });
    const model = deriveCausalWorldModel(buildPerception(world, pet.id));
    const goal = holdingCausalGoal('water-bucket');
    const result = planCausally(model.initial, goal, model.actions, {
      allowHypothetical: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.steps.map((step) => step.id)).toEqual([
      `approach:${water.id}`,
      `interact:fill-bucket:${water.id}:0`,
    ]);
    expect(factValue(result.plan.finalState, causalFluent.inventory('water-bucket')).value).toBe(1);
  });
});
