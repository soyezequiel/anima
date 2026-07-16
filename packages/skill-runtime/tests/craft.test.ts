import { describe, expect, it } from 'vitest';
import type { EntityId, Recipe, WorldState } from '@anima/sim-core';
import { allEntities, createWorld, spawn } from '@anima/sim-core';
import { runSkillProgram, validateSkillProgram } from '../src/index.js';

const CAMPFIRE: Recipe = {
  id: 'campfire',
  output: {
    kind: 'campfire',
    components: { heatSource: { warmthPerTick: 3, range: 2 }, hazard: { damagePerTick: 1 } },
  },
  ingredients: [
    { kind: 'log', count: 2 },
    { kind: 'flint', count: 1 },
  ],
};

function coldWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 9, height: 5, seed: 1 }, { recipes: [CAMPFIRE] });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 30, max: 50, decayPerTick: 0.05 },
    health: { current: 10, max: 10 },
    temperature: { current: 10, max: 50, lossPerTick: 0.1 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Test', perceptionRange: 12 },
  }).id;
  return { world, petId };
}

function give(world: WorldState, petId: EntityId, kind: string, times = 1): void {
  for (let i = 0; i < times; i++) {
    const item = spawn(world, kind, { portable: {} });
    world.entities[petId]!.components.inventory!.items.push(item.id);
  }
}

describe('op craft', () => {
  it('un programa puede construir con lo que lleva encima', () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    give(world, petId, 'flint');

    const report = runSkillProgram(world, petId, [{ op: 'craft', recipeId: 'campfire' }], {
      maxTicks: 10,
    });

    expect(report.outcome).toBe('completed');
    expect(allEntities(world).some((e) => e.kind === 'campfire')).toBe(true);
    expect(report.events.some((e) => e.type === 'item.crafted')).toBe(true);
  });

  it('sin ingredientes el mundo lo rechaza: el programa no revienta ni miente', () => {
    const { world, petId } = coldWorld();

    const report = runSkillProgram(world, petId, [{ op: 'craft', recipeId: 'campfire' }], {
      maxTicks: 10,
    });

    // El programa "terminó" (hizo lo que decía), pero el mundo no construyó nada.
    expect(allEntities(world).some((e) => e.kind === 'campfire')).toBe(false);
    const failed = report.events.find(
      (e) => e.type === 'action.resolved' && e.data.action === 'craft',
    );
    expect(failed?.data.success).toBe(false);
    expect(failed?.data.reason).toBe('missing-ingredients');
  });

  it('recoger del suelo y construir: la historia mínima en un solo programa', () => {
    const { world, petId } = coldWorld();
    spawn(world, 'log', { position: { x: 2, y: 2 }, portable: {} });
    spawn(world, 'log', { position: { x: 1, y: 1 }, portable: {} });
    spawn(world, 'flint', { position: { x: 1, y: 3 }, portable: {} });

    const report = runSkillProgram(
      world,
      petId,
      [
        // "held: false" es lo que permite juntar DOS troncos: sin él, la
        // segunda búsqueda devuelve el que ya lleva en la mano.
        {
          op: 'repeatWithLimit',
          max: 2,
          body: [
            { op: 'findEntities', query: { kind: 'log', held: false }, store: 'logs' },
            { op: 'selectTarget', from: 'logs', strategy: 'nearest', store: 'log' },
            { op: 'moveToward', target: 'log', maxSteps: 10 },
            { op: 'pickup', target: 'log' },
          ],
        },
        { op: 'findEntities', query: { kind: 'flint', held: false }, store: 'flints' },
        { op: 'selectTarget', from: 'flints', strategy: 'nearest', store: 'flint' },
        { op: 'moveToward', target: 'flint', maxSteps: 10 },
        { op: 'pickup', target: 'flint' },
        { op: 'branch', if: { type: 'canCraft', recipeId: 'campfire' }, then: [{ op: 'craft', recipeId: 'campfire' }] },
      ],
      { maxTicks: 60 },
    );

    expect(report.outcome).toBe('completed');
    expect(allEntities(world).some((e) => e.kind === 'campfire')).toBe(true);
  });
});

describe('condición canCraft', () => {
  const probe = (world: WorldState, petId: EntityId) =>
    runSkillProgram(
      world,
      petId,
      [
        {
          op: 'branch',
          if: { type: 'canCraft', recipeId: 'campfire' },
          then: [{ op: 'speak', text: 'puedo' }],
          else: [{ op: 'speak', text: 'me falta algo' }],
        },
      ],
      { maxTicks: 5 },
    );

  const said = (report: ReturnType<typeof runSkillProgram>): unknown =>
    report.events.find((e) => e.type === 'agent.spoke')?.data.text;

  it('es cierta cuando tiene todos los ingredientes', () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    give(world, petId, 'flint');
    expect(said(probe(world, petId))).toBe('puedo');
  });

  it('es falsa cuando falta uno: es la pregunta «¿tengo con qué encenderla?»', () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    expect(said(probe(world, petId))).toBe('me falta algo');
  });

  it('es falsa si el mundo no admite la receta', () => {
    const world = createWorld({ width: 9, height: 5, seed: 1 }); // sin recetas
    const petId = spawn(world, 'pet', {
      position: { x: 1, y: 2 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Test', perceptionRange: 12 },
      health: { current: 10, max: 10 },
    }).id;
    give(world, petId, 'log', 2);
    give(world, petId, 'flint');
    expect(said(probe(world, petId))).toBe('me falta algo');
  });
});

describe('condición temperatureBelow', () => {
  const probe = (world: WorldState, petId: EntityId) =>
    runSkillProgram(
      world,
      petId,
      [
        {
          op: 'branch',
          if: { type: 'temperatureBelow', value: 20 },
          then: [{ op: 'speak', text: 'tengo frío' }],
          else: [{ op: 'speak', text: 'estoy bien' }],
        },
      ],
      { maxTicks: 5 },
    );
  const said = (report: ReturnType<typeof runSkillProgram>): unknown =>
    report.events.find((e) => e.type === 'agent.spoke')?.data.text;

  it('es cierta con el calor por debajo del umbral', () => {
    const { world, petId } = coldWorld(); // temperatura 10
    expect(said(probe(world, petId))).toBe('tengo frío');
  });

  it('quien no siente frío no tiene frío (distinto de tener cero)', () => {
    const { world, petId } = coldWorld();
    delete world.entities[petId]!.components.temperature;
    expect(said(probe(world, petId))).toBe('estoy bien');
  });
});

describe('validación del op craft', () => {
  it('acepta un craft bien formado', () => {
    expect(validateSkillProgram([{ op: 'craft', recipeId: 'campfire' }]).ok).toBe(true);
  });

  it('rechaza craft sin receta o con campos de más', () => {
    expect(validateSkillProgram([{ op: 'craft' }]).ok).toBe(false);
    expect(validateSkillProgram([{ op: 'craft', recipeId: '' }]).ok).toBe(false);
    expect(validateSkillProgram([{ op: 'craft', recipeId: 'x', extra: 1 }]).ok).toBe(false);
  });

  it('acepta el filtro held en las búsquedas', () => {
    expect(
      validateSkillProgram([
        { op: 'findEntities', query: { kind: 'log', held: false }, store: 'x' },
      ]).ok,
    ).toBe(true);
  });

  it('rechaza condiciones mal formadas', () => {
    expect(
      validateSkillProgram([
        { op: 'branch', if: { type: 'canCraft' }, then: [{ op: 'wait' }] },
      ]).ok,
    ).toBe(false);
    expect(
      validateSkillProgram([
        { op: 'branch', if: { type: 'temperatureBelow' }, then: [{ op: 'wait' }] },
      ]).ok,
    ).toBe(false);
  });
});
