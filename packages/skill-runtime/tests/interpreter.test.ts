import { describe, expect, it } from 'vitest';
import { getEntity, spawn } from '@anima/sim-core';
import type { SkillProgram } from '../src/index.js';
import { runSkillProgram, SkillLibrary } from '../src/index.js';
import { addFood, addHammer, addWallColumn, smallWorld } from './helpers.js';

const reachAndEat: SkillProgram = [
  { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
  { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
  { op: 'moveToward', target: 'food', maxSteps: 30 },
  { op: 'consume', target: 'food' },
];

describe('intérprete de skills', () => {
  it('alcanza y consume alimento en campo abierto', () => {
    const { world, petId } = smallWorld();
    addFood(world, 6, 2);
    const report = runSkillProgram(world, petId, reachAndEat, { maxTicks: 60 });
    expect(report.outcome).toBe('completed');
    expect(report.energyDelta).toBeGreaterThan(20);
    expect(report.events.some((e) => e.type === 'item.consumed')).toBe(true);
    expect(report.invariantViolations).toEqual([]);
  });

  it('el movimiento directo contra un muro termina bloqueado, no en bucle', () => {
    const { world, petId } = smallWorld();
    addWallColumn(world, 4);
    addFood(world, 7, 2);
    const program: SkillProgram = [
      { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
      { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
      { op: 'moveToward', target: 'food', maxSteps: 30 },
      {
        op: 'branch',
        if: { type: 'lastMoveBlocked' },
        then: [{ op: 'abort', reason: 'camino-bloqueado' }],
      },
      { op: 'consume', target: 'food' },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 60 });
    expect(report.outcome).toBe('aborted');
    expect(report.reason).toBe('camino-bloqueado');
    // No atravesó el muro.
    const pet = getEntity(world, petId);
    expect(pet?.components.position?.x).toBeLessThan(4);
  });

  it('rompe el muro con un martillo y llega al alimento', () => {
    const { world, petId } = smallWorld();
    addWallColumn(world, 4);
    addFood(world, 7, 2);
    addHammer(world, 2, 3);
    const program: SkillProgram = [
      { op: 'findEntities', query: { tool: true }, store: 'tools' },
      { op: 'selectTarget', from: 'tools', strategy: 'strongestTool', store: 'tool' },
      { op: 'moveToward', target: 'tool', maxSteps: 20 },
      { op: 'pickup', target: 'tool' },
      { op: 'findEntities', query: { kind: 'wall' }, store: 'walls' },
      { op: 'selectTarget', from: 'walls', strategy: 'nearest', store: 'wall' },
      { op: 'moveToward', target: 'wall', maxSteps: 20 },
      {
        op: 'repeatWithLimit',
        max: 6,
        until: { type: 'entityGone', ref: 'wall' },
        body: [{ op: 'useItem', item: 'tool', target: 'wall' }],
      },
      { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
      { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
      { op: 'moveToward', target: 'food', maxSteps: 30 },
      { op: 'consume', target: 'food' },
    ];
    const report = runSkillProgram(world, petId, program, {
      maxTicks: 120,
      checkInvariantsEachTick: true,
    });
    expect(report.outcome).toBe('completed');
    expect(report.events.some((e) => e.type === 'entity.destroyed')).toBe(true);
    expect(report.events.some((e) => e.type === 'item.consumed')).toBe(true);
    expect(report.invariantViolations).toEqual([]);
  });

  it('repeatWithLimit se detiene en el límite aunque la condición nunca se cumpla', () => {
    const { world, petId } = smallWorld();
    const program: SkillProgram = [
      {
        op: 'repeatWithLimit',
        max: 5,
        until: { type: 'energyBelow', value: -1 },
        body: [{ op: 'wait' }],
      },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 100 });
    expect(report.outcome).toBe('completed');
    expect(report.ticks).toBe(5);
  });

  it('cancela por límite de intents', () => {
    const { world, petId } = smallWorld();
    const program: SkillProgram = [
      {
        op: 'repeatWithLimit',
        max: 50,
        body: [{ op: 'repeatWithLimit', max: 50, body: [{ op: 'wait' }] }],
      },
    ];
    const report = runSkillProgram(world, petId, program, {
      maxTicks: 5000,
      limits: { maxIntents: 40 },
    });
    expect(report.outcome).toBe('limit-exceeded');
    expect(report.reason).toBe('max-intents');
  });

  it('cancela por timeout del driver', () => {
    const { world, petId } = smallWorld();
    const program: SkillProgram = [
      { op: 'repeatWithLimit', max: 50, body: [{ op: 'wait', ticks: 50 }] },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 10 });
    expect(report.outcome).toBe('timeout');
    expect(report.ticks).toBe(10);
  });

  it('rodea el agua visible sin siquiera intentar pisarla', () => {
    const { world, petId } = smallWorld(); // mascota en (1,2)
    // Un estanque de 2×2 en el camino diagonal hacia el alimento: el lookahead
    // trata las celdas mojadas que ve como sólidos, así que esquiva por arriba
    // sin gastar ni un intento fallido contra la orilla.
    const wetCells = ['3,1', '4,1', '3,2', '4,2'];
    for (const cell of wetCells) {
      const [x, y] = cell.split(',').map(Number);
      spawn(world, 'water', { position: { x: x!, y: y! }, water: {} });
    }
    addFood(world, 7, 0);
    const report = runSkillProgram(world, petId, reachAndEat, { maxTicks: 60 });
    expect(report.outcome).toBe('completed');
    expect(report.events.some((e) => e.type === 'item.consumed')).toBe(true);
    // Ningún movimiento terminó en el agua…
    const wet = new Set(wetCells);
    const steps = report.events.filter((e) => e.type === 'entity.moved');
    expect(
      steps.every((e) => {
        const to = e.data.to as { x: number; y: number };
        return !wet.has(`${to.x},${to.y}`);
      }),
    ).toBe(true);
    // …y ninguno lo intentó: el agua se esquiva por percepción, no a golpes.
    expect(
      report.events.filter((e) => e.type === 'action.resolved' && e.data.reason === 'water'),
    ).toHaveLength(0);
    expect(report.invariantViolations).toEqual([]);
  });

  it('aborta si una variable no existe', () => {
    const { world, petId } = smallWorld();
    const report = runSkillProgram(world, petId, [{ op: 'consume', target: 'nada' }], {
      maxTicks: 10,
    });
    expect(report.outcome).toBe('aborted');
    expect(report.reason).toBe('target-missing:nada');
  });

  it('aborta si selectTarget no tiene candidatos', () => {
    const { world, petId } = smallWorld();
    const report = runSkillProgram(
      world,
      petId,
      [
        { op: 'findEntities', query: { kind: 'unicornio' }, store: 'list' },
        { op: 'selectTarget', from: 'list', strategy: 'nearest', store: 'x' },
      ],
      { maxTicks: 10 },
    );
    expect(report.outcome).toBe('aborted');
    expect(report.reason).toBe('no-candidates:list');
  });
});

describe('composición de skills', () => {
  it('runSkill ejecuta una habilidad de la biblioteca', () => {
    const { world, petId } = smallWorld();
    addFood(world, 5, 2);
    const library = new SkillLibrary();
    const inner = library.addExperimental({
      name: 'comer-cercano',
      description: 'come el alimento más cercano',
      motivation: 'test',
      program: reachAndEat,
      expectedOutcome: 'energía recuperada',
      successCriteria: [{ type: 'energyIncreased' }],
      createdAt: '2026-01-01T00:00:00Z',
    });
    const report = runSkillProgram(
      world,
      petId,
      [{ op: 'speak', text: 'voy a comer' }, { op: 'runSkill', skillId: inner.id }],
      { maxTicks: 60, library },
    );
    expect(report.outcome).toBe('completed');
    expect(report.energyDelta).toBeGreaterThan(20);
  });

  it('aborta si la skill llamada no existe', () => {
    const { world, petId } = smallWorld();
    const report = runSkillProgram(world, petId, [{ op: 'runSkill', skillId: 'fantasma' }], {
      maxTicks: 10,
      library: new SkillLibrary(),
    });
    expect(report.outcome).toBe('aborted');
    expect(report.reason).toBe('skill-not-found:fantasma');
  });

  it('corta la recursión por profundidad de llamadas', () => {
    const { world, petId } = smallWorld();
    const library = new SkillLibrary();
    const skill = library.addExperimental({
      name: 'recursiva',
      description: 'se llama a sí misma',
      motivation: 'test',
      program: [{ op: 'wait' }],
      expectedOutcome: 'nada',
      successCriteria: [],
      createdAt: '2026-01-01T00:00:00Z',
    });
    // Reescribe el programa para que se llame a sí misma (solo posible en test).
    skill.program = [{ op: 'runSkill', skillId: skill.id }];
    const report = runSkillProgram(world, petId, skill.program, { maxTicks: 50, library });
    expect(report.outcome).toBe('limit-exceeded');
    expect(report.reason).toBe('call-depth');
  });
});
