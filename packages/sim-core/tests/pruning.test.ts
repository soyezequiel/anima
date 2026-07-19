import { describe, expect, it } from 'vitest';
import { applyPrune, planPrune, prunePlanSize, spawn } from '../src/index.js';
import type { WorldState } from '../src/index.js';
import { buildTestWorld, spawnBranch } from './helpers.js';

/**
 * La poda del cuidador (ADR 0075). Lo que se prueba acá no es que borre —eso
 * es un `filter`— sino las dos promesas que la hacen usable: que el plan diga
 * la verdad ANTES de tocar nada, y que después de aplicarlo el mundo no quede
 * hablando de cosas que ya no existen.
 */

function worldWithRules(): WorldState {
  const { world } = buildTestWorld();
  world.recipes = [
    {
      id: 'tabla',
      ingredients: [{ kind: 'branch', count: 2 }],
      outcomes: [{ weight: 1, output: { kind: 'plank', components: { portable: {} } } }],
    },
    {
      id: 'silla',
      ingredients: [{ kind: 'plank', count: 3 }],
      outcomes: [{ weight: 1, output: { kind: 'chair', components: { collider: { solid: true } } } }],
    },
  ];
  world.interactions = [
    {
      id: 'sentarse',
      description: 'sentarse en la silla',
      stance: 'on-top',
      target: { kind: 'chair' },
      effects: [],
    },
    {
      id: 'mojarse',
      description: 'meter la mano en el agua',
      stance: 'beside',
      target: { wet: true },
      effects: [],
    },
  ];
  world.blueprints = [{ id: 'comedor', placements: [{ kind: 'chair', offset: { x: 1, y: 0 } }] }];
  world.decompositions = [
    { id: 'romper-silla', targetKind: 'chair', drops: [{ kind: 'plank', components: {} }] },
  ];
  world.glyphs = { chair: ['0000', '0000', '0000', '0000'] };
  return world;
}

describe('planPrune: mirar antes de tocar', () => {
  it('podar una regla hoja no se lleva nada más', () => {
    const world = worldWithRules();
    const plan = planPrune(world, { type: 'interaction', id: 'mojarse' });
    expect(plan.interactions).toEqual(['mojarse']);
    expect(prunePlanSize(plan)).toBe(1);
  });

  it('quitar la receta de la tabla no borra las tablas ya hechas', () => {
    const world = worldWithRules();
    spawn(world, 'plank', { position: { x: 3, y: 3 }, portable: {} });
    const plan = planPrune(world, { type: 'recipe', id: 'tabla' });
    // Deja de saber HACER más, que es lo que se pidió. Las que existen siguen
    // siendo tablas y la silla se sigue pudiendo armar con ellas.
    expect(plan.recipes).toEqual(['tabla']);
    expect(plan.entities).toEqual([]);
    expect(plan.recipes).not.toContain('silla');
  });

  it('quitar un tipo arrastra todo lo que lo nombra', () => {
    const world = worldWithRules();
    const plan = planPrune(world, { type: 'kind', id: 'chair' });
    // La receta que la produce y la que la pediría; la interacción que la
    // apunta, pero no la que habla de rasgos; el plano que la coloca; su
    // descomposición; su dibujo.
    expect(plan.recipes).toEqual(['silla']);
    expect(plan.interactions).toEqual(['sentarse']);
    expect(plan.blueprints).toEqual(['comedor']);
    expect(plan.decompositions).toEqual(['romper-silla']);
    expect(plan.glyphs).toEqual(['chair']);
  });

  it('el arrastre no sigue de largo: la tabla sobrevive a que se caiga la rama', () => {
    const world = worldWithRules();
    const plan = planPrune(world, { type: 'kind', id: 'branch' });
    // 'tabla' cae porque pide ramas. 'silla' NO: las tablas que ya existan
    // siguen sirviendo, y encadenar hasta ahí vaciaría medio mundo.
    expect(plan.recipes).toEqual(['tabla']);
    expect(plan.kinds).toEqual(['branch']);
  });

  it('no deja podar la materia con la que está hecho el juego', () => {
    const world = worldWithRules();
    const plan = planPrune(world, { type: 'kind', id: 'pet' });
    expect(plan.blocked).toBeDefined();
    expect(prunePlanSize(plan)).toBe(0);
  });

  it('avisa cuando lo que se pide podar no existe', () => {
    const world = worldWithRules();
    expect(planPrune(world, { type: 'recipe', id: 'inexistente' }).blocked).toBeDefined();
  });
});

describe('applyPrune: el mundo no queda hablando de fantasmas', () => {
  it('un plan bloqueado no toca nada', () => {
    const world = worldWithRules();
    applyPrune(world, planPrune(world, { type: 'kind', id: 'pet' }));
    expect(world.recipes).toHaveLength(2);
    expect(Object.values(world.entities).some((e) => e.kind === 'pet')).toBe(true);
  });

  it('saca los ejemplares del mapa y también de la mochila', () => {
    const { world, pet } = buildTestWorld();
    const carried = spawnBranch(world, 1, 2);
    delete carried.components.position;
    pet.components.inventory!.items.push(carried.id);
    const onFloor = spawnBranch(world, 4, 2);

    const plan = planPrune(world, { type: 'kind', id: 'branch' });
    expect(plan.entities).toHaveLength(2);
    applyPrune(world, plan);

    expect(world.entities[carried.id]).toBeUndefined();
    expect(world.entities[onFloor.id]).toBeUndefined();
    // Un id que ya no resuelve a nada es un objeto que la mascota cree llevar.
    expect(pet.components.inventory!.items).toEqual([]);
  });

  it('deja el mundo sin reglas que nombren lo que se fue', () => {
    const world = worldWithRules();
    applyPrune(world, planPrune(world, { type: 'kind', id: 'chair' }));
    expect(world.recipes.map((r) => r.id)).toEqual(['tabla']);
    expect(world.interactions.map((i) => i.id)).toEqual(['mojarse']);
    expect(world.blueprints).toEqual([]);
    expect(world.decompositions).toEqual([]);
    expect(world.glyphs.chair).toBeUndefined();
  });
});
