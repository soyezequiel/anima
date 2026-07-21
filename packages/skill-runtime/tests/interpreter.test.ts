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

  it('moveToward rodea un muro con hueco: el camino existe y lo encuentra', () => {
    const { world, petId } = smallWorld();
    // Columna de muro con un hueco en y=0: rodear exige ALEJARSE del objetivo
    // (subir hasta el hueco), lo que el movimiento voraz de antes jamás hacía.
    for (let y = 1; y < world.config.height; y++) {
      spawn(world, 'wall', {
        position: { x: 4, y },
        collider: { solid: true },
        hardness: { value: 5 },
        durability: { current: 10, max: 10 },
      });
    }
    addFood(world, 7, 2);
    const report = runSkillProgram(world, petId, reachAndEat, { maxTicks: 60 });
    expect(report.outcome).toBe('completed');
    expect(report.events.some((e) => e.type === 'item.consumed')).toBe(true);
    // Pasó por el hueco: alguna posición del camino pisa la columna del muro.
    expect(report.path.some((p) => p.x === 4 && p.y === 0)).toBe(true);
  });

  it('moveTo alcanza una celda fija rodeando obstáculos conocidos', () => {
    const { world, petId } = smallWorld();
    for (let y = 1; y < world.config.height; y++) {
      spawn(world, 'wall', {
        position: { x: 4, y },
        collider: { solid: true },
        hardness: { value: 5 },
        durability: { current: 10, max: 10 },
      });
    }
    const program: SkillProgram = [{ op: 'moveTo', position: { x: 7, y: 2 }, maxSteps: 30 }];

    const report = runSkillProgram(world, petId, program, { maxTicks: 60 });

    expect(report.outcome).toBe('completed');
    expect(getEntity(world, petId)?.components.position).toEqual({ x: 7, y: 2 });
    expect(report.path.some((position) => position.x === 4 && position.y === 0)).toBe(true);
  });

  it('miope, aprende del choque contra lo que no ve y replanifica el rodeo', () => {
    const { world, petId } = smallWorld();
    // Rango 1: el muro de (3,2) no se percibe desde (1,2). El plan optimista
    // choca, el rechazo se aprende y el siguiente plan lo rodea.
    getEntity(world, petId)!.components.agent!.perceptionRange = 1;
    spawn(world, 'wall', {
      position: { x: 3, y: 2 },
      collider: { solid: true },
      hardness: { value: 5 },
      durability: { current: 10, max: 10 },
    });
    const food = addFood(world, 6, 2);
    const program: SkillProgram = [
      { op: 'explore', maxSteps: 50, until: { type: 'sees', query: { kind: 'food' } } },
      { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
      { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
      { op: 'moveToward', target: 'food', maxSteps: 30 },
      { op: 'consume', target: 'food' },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 120 });
    expect(report.outcome).toBe('completed');
    expect(report.events.some((e) => e.type === 'item.consumed' && e.data.itemId === food)).toBe(
      true,
    );
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

  // El loop de "romper" con corte al primer golpe inútil: mismo cuerpo que arma
  // programForUserRequest para destroy-entity. Antes repetía el mismo no-op 20
  // veces y terminaba en "objetivo-resistió"; ahora corta y dice la verdad.
  const strikeProgram = (targetKind: string): SkillProgram => [
    { op: 'findEntities', query: { tool: true }, store: 'tools' },
    { op: 'selectTarget', from: 'tools', strategy: 'strongestTool', store: 'tool' },
    { op: 'moveToward', target: 'tool', maxSteps: 20 },
    { op: 'pickup', target: 'tool' },
    { op: 'findEntities', query: { kind: targetKind }, store: 'targets' },
    { op: 'selectTarget', from: 'targets', strategy: 'nearest', store: 'target' },
    { op: 'moveToward', target: 'target', maxSteps: 20 },
    {
      op: 'repeatWithLimit',
      max: 20,
      until: { type: 'entityGone', ref: 'target' },
      body: [
        { op: 'useItem', item: 'tool', target: 'target' },
        {
          op: 'branch',
          if: { type: 'lastActionUnaffected' },
          then: [{ op: 'abort', reason: 'objetivo-inmune' }],
        },
        {
          op: 'branch',
          if: { type: 'lastStrikeIneffective' },
          then: [{ op: 'abort', reason: 'objetivo-muy-duro' }],
        },
      ],
    },
    {
      op: 'branch',
      if: { type: 'not', cond: { type: 'entityGone', ref: 'target' } },
      then: [{ op: 'abort', reason: 'objetivo-resistió' }],
    },
  ];

  const useItemAttempts = (report: { events: { type: string; data: Record<string, unknown> }[] }) =>
    report.events.filter((e) => e.type === 'action.resolved' && e.data.action === 'useItem').length;

  it('un objetivo inmune (sin durabilidad) corta al primer golpe, no a los veinte', () => {
    const { world, petId } = smallWorld();
    addHammer(world, 2, 3);
    // Un pedernal: portable pero sin durabilidad — como el del reporte real.
    // Ninguna herramienta lo afecta: el mundo responde 'target-unaffected'.
    const flint = spawn(world, 'flint', { position: { x: 3, y: 2 }, portable: {} }).id;
    const report = runSkillProgram(world, petId, strikeProgram('flint'), { maxTicks: 120 });
    expect(report.outcome).toBe('aborted');
    expect(report.reason).toBe('objetivo-inmune');
    // Lo que arreglamos: un solo intento, no el loop pegado de 20.
    expect(useItemAttempts(report)).toBe(1);
    // El pedernal sigue ahí: no se rompió (imposible) pero tampoco quedó en bucle.
    expect(getEntity(world, flint)).toBeDefined();
  });

  it('un objetivo demasiado duro (la herramienta no hace mella) también corta al primer golpe', () => {
    const { world, petId } = smallWorld();
    addHammer(world, 2, 3); // poder 8; fuerza de la mascota 2 → poder efectivo 10
    // Dureza 100: 10 - 100 < 0 → daño 0. Pega, pero no le quita durabilidad.
    const rock = spawn(world, 'rock', {
      position: { x: 3, y: 2 },
      durability: { current: 10, max: 10 },
      hardness: { value: 100 },
    }).id;
    const report = runSkillProgram(world, petId, strikeProgram('rock'), { maxTicks: 120 });
    expect(report.outcome).toBe('aborted');
    expect(report.reason).toBe('objetivo-muy-duro');
    expect(useItemAttempts(report)).toBe(1);
    // No perdió durabilidad: el golpe no hizo nada, y no insistió.
    expect(getEntity(world, rock)?.components.durability?.current).toBe(10);
  });

  it('un objetivo que sí cede se rompe: el progreso real no se corta', () => {
    const { world, petId } = smallWorld();
    addHammer(world, 2, 3);
    // Dureza 0, durabilidad baja: cada golpe hace mella y termina destruyéndolo.
    spawn(world, 'rock', {
      position: { x: 3, y: 2 },
      durability: { current: 5, max: 5 },
      hardness: { value: 0 },
    });
    const report = runSkillProgram(world, petId, strikeProgram('rock'), { maxTicks: 120 });
    expect(report.outcome).toBe('completed');
    expect(report.events.some((e) => e.type === 'entity.destroyed')).toBe(true);
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

  it('explore recorre el mapa hasta VER lo que busca, y entonces lo alcanza', () => {
    const { world, petId } = smallWorld();
    // Miope a propósito: la rama existe pero queda fuera del rango sensorial.
    // Sin explore, findEntities devolvería vacío y el programa abortaría con
    // "no-candidates" sin haber dado un solo paso.
    getEntity(world, petId)!.components.agent!.perceptionRange = 2;
    const branch = spawn(world, 'branch', {
      position: { x: 7, y: 1 },
      portable: {},
      tool: { power: 1 },
    });
    const program: SkillProgram = [
      {
        op: 'explore',
        maxSteps: 50,
        until: { type: 'sees', query: { kind: 'branch', held: false } },
      },
      { op: 'findEntities', query: { kind: 'branch', held: false }, store: 'branches' },
      { op: 'selectTarget', from: 'branches', strategy: 'nearest', store: 'branch' },
      { op: 'moveToward', target: 'branch', maxSteps: 40 },
      { op: 'pickup', target: 'branch' },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 120 });
    expect(report.outcome).toBe('completed');
    const pet = getEntity(world, petId);
    expect(pet?.components.inventory?.items).toContain(branch.id);
  });

  it('explore no cuesta ni un tick si ya lo ve (o lo lleva encima)', () => {
    const { world, petId } = smallWorld();
    addFood(world, 2, 2); // pegada: visible desde el arranque
    const program: SkillProgram = [
      { op: 'explore', maxSteps: 50, until: { type: 'sees', query: { edible: true } } },
      { op: 'findEntities', query: { edible: true }, store: 'foods' },
      { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
      { op: 'consume', target: 'food' },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 10 });
    expect(report.outcome).toBe('completed');
    // Sin pasos de exploración: la mascota nunca se movió de (1,2).
    expect(report.events.filter((e) => e.type === 'entity.moved')).toHaveLength(0);
  });

  it('explore sin hallazgo agota sus pasos y el programa aborta honesto', () => {
    const { world, petId } = smallWorld();
    const program: SkillProgram = [
      { op: 'explore', maxSteps: 12, until: { type: 'sees', query: { kind: 'unicornio' } } },
      { op: 'findEntities', query: { kind: 'unicornio' }, store: 'list' },
      { op: 'selectTarget', from: 'list', strategy: 'nearest', store: 'x' },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 60 });
    expect(report.outcome).toBe('aborted');
    expect(report.reason).toBe('no-candidates:list');
    // Pero buscó de verdad: caminó antes de rendirse.
    expect(report.events.filter((e) => e.type === 'entity.moved').length).toBeGreaterThan(6);
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

describe('gpsTo: el GPS hacia un recurso (ADR 0038)', () => {
  it('a la vista: llega rodeando obstáculos y store deja el ejemplar listo', () => {
    const { world, petId } = smallWorld();
    // El mismo muro con hueco del test de moveToward: el GPS hereda su BFS.
    for (let y = 1; y < world.config.height; y++) {
      spawn(world, 'wall', {
        position: { x: 4, y },
        collider: { solid: true },
        hardness: { value: 5 },
        durability: { current: 10, max: 10 },
      });
    }
    addFood(world, 7, 2);
    const program: SkillProgram = [
      { op: 'gpsTo', kind: 'food', maxSteps: 40, store: 'food' },
      { op: 'consume', target: 'food' },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 60 });
    expect(report.outcome).toBe('completed');
    expect(report.events.some((e) => e.type === 'item.consumed')).toBe(true);
  });

  it('fuera de la vista pero recordado: camina hasta el lugar y la vista remata', () => {
    const { world, petId } = smallWorld();
    getEntity(world, petId)!.components.agent!.perceptionRange = 2;
    const foodId = addFood(world, 7, 2);
    // La memoria de lugares del agente, en miniatura: recuerda dónde vio la
    // comida mientras no la tenga a la vista (recall excluye lo visible).
    const places = {
      recall: (kind: string, perception: { visibleEntities: { id: string }[] }) =>
        kind === 'food' && !perception.visibleEntities.some((e) => e.id === foodId)
          ? [{ entityId: foodId, position: { x: 7, y: 2 } }]
          : [],
      forget: () => {},
    };
    const program: SkillProgram = [
      { op: 'gpsTo', kind: 'food', maxSteps: 40, store: 'food' },
      { op: 'consume', target: 'food' },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 60, places });
    expect(report.outcome).toBe('completed');
    expect(report.events.some((e) => e.type === 'item.consumed' && e.data.itemId === foodId)).toBe(
      true,
    );
  });

  it('el recuerdo que mentía se descarta al llegar, no antes ni desde lejos', () => {
    const { world, petId } = smallWorld();
    getEntity(world, petId)!.components.agent!.perceptionRange = 2;
    // Un recuerdo falso y ningún alimento real: va hasta el lugar, no
    // encuentra nada, lo desmiente, y la búsqueda sigue (explora) hasta
    // agotarse — el final honesto de siempre.
    let forgotten: string | null = null;
    const places = {
      recall: (kind: string) =>
        kind === 'food' && forgotten === null
          ? [{ entityId: 'e999', position: { x: 7, y: 0 } }]
          : [],
      forget: (entityId: string) => {
        forgotten = entityId;
      },
    };
    const program: SkillProgram = [
      { op: 'gpsTo', kind: 'food', maxSteps: 30, store: 'food' },
      {
        op: 'branch',
        if: { type: 'lastMoveBlocked' },
        then: [{ op: 'abort', reason: 'no-lo-encontré' }],
      },
      { op: 'consume', target: 'food' },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 200, places });
    expect(report.outcome).toBe('aborted');
    expect(report.reason).toBe('no-lo-encontré');
    expect(forgotten).toBe('e999');
    // Pasó de verdad por el lugar del recuerdo antes de desmentirlo…
    expect(report.path.some((p) => Math.abs(p.x - 7) <= 1 && Math.abs(p.y - 0) <= 1)).toBe(true);
    // …y después siguió buscando: caminó más pasos que el viaje al recuerdo.
    expect(report.events.filter((e) => e.type === 'entity.moved').length).toBeGreaterThan(8);
  });

  it('sin vista ni recuerdo: explora hasta ver y entonces alcanza', () => {
    const { world, petId } = smallWorld();
    getEntity(world, petId)!.components.agent!.perceptionRange = 2;
    const foodId = addFood(world, 7, 2);
    const program: SkillProgram = [
      { op: 'gpsTo', kind: 'food', maxSteps: 50, store: 'food' },
      { op: 'consume', target: 'food' },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 200 });
    expect(report.outcome).toBe('completed');
    expect(report.events.some((e) => e.type === 'item.consumed' && e.data.itemId === foodId)).toBe(
      true,
    );
  });

  it('si el mapa no lo tiene, agota sus pasos y el programa aborta honesto', () => {
    const { world, petId } = smallWorld();
    const program: SkillProgram = [
      { op: 'gpsTo', kind: 'unicornio', maxSteps: 12 },
      {
        op: 'branch',
        if: { type: 'lastMoveBlocked' },
        then: [{ op: 'abort', reason: 'no-lo-encontré' }],
      },
    ];
    const report = runSkillProgram(world, petId, program, { maxTicks: 60 });
    expect(report.outcome).toBe('aborted');
    expect(report.reason).toBe('no-lo-encontré');
    // Pero buscó de verdad: caminó antes de rendirse.
    expect(report.events.filter((e) => e.type === 'entity.moved').length).toBeGreaterThan(6);
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
      [
        { op: 'speak', text: 'voy a comer' },
        { op: 'runSkill', skillId: inner.id },
      ],
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

  /**
   * ADR 0055. Las variables son de quien ejecuta, no de la ejecución entera.
   *
   * Antes había UNA sola bolsa para todo el programa: una habilidad llamada
   * que guardara en "objetivo" le pisaba el "objetivo" a quien la llamó, en
   * silencio y con la forma de un bug de comportamiento, no de un error. Con
   * `runSkill` usado solo como programa de un op nunca se notó; en cuanto el
   * modelo empezó a componer, era cuestión de tiempo.
   */
  it('una habilidad llamada no le pisa las variables a quien la llama', () => {
    const { world, petId } = smallWorld();
    addFood(world, 5, 2);
    // Un muro lejos, sin tapar el camino: le da a la hija algo que mirar.
    addWallColumn(world, 8);
    const library = new SkillLibrary();
    const inner = library.addExperimental({
      name: 'mira-una-pared',
      description: 'guarda una pared en "objetivo"',
      motivation: 'test',
      // Usa el MISMO nombre de variable que la madre, con otra cosa adentro.
      program: [
        { op: 'findEntities', query: { kind: 'wall' }, store: 'candidatos' },
        { op: 'selectTarget', from: 'candidatos', strategy: 'nearest', store: 'objetivo' },
      ],
      expectedOutcome: 'nada',
      successCriteria: [],
      createdAt: '2026-01-01T00:00:00Z',
    });
    const report = runSkillProgram(
      world,
      petId,
      [
        { op: 'findEntities', query: { kind: 'food' }, store: 'candidatos' },
        { op: 'selectTarget', from: 'candidatos', strategy: 'nearest', store: 'objetivo' },
        { op: 'runSkill', skillId: inner.id },
        // Si la hija hubiera pisado "objetivo", esto caminaría hasta la pared
        // y el consume fallaría: la comida seguiría intacta.
        { op: 'moveToward', target: 'objetivo', maxSteps: 40 },
        { op: 'consume', target: 'objetivo' },
      ],
      { maxTicks: 80, library },
    );
    expect(report.outcome).toBe('completed');
    expect(report.energyDelta).toBeGreaterThan(20);
  });

  it('runSkill por nombre toma la mejor versión, no una congelada', () => {
    const { world, petId } = smallWorld();
    addFood(world, 5, 2);
    const library = new SkillLibrary();
    // Una versión vieja que no hace nada, y una nueva que sí come.
    const vieja = library.addExperimental({
      name: 'comer',
      description: 'v1',
      motivation: 'test',
      program: [{ op: 'wait' }],
      expectedOutcome: '',
      successCriteria: [],
      createdAt: '2026-01-01T00:00:00Z',
    });
    library.markPromoted(vieja.id);
    const nueva = library.addExperimental({
      name: 'comer',
      description: 'v2',
      motivation: 'test',
      program: reachAndEat,
      expectedOutcome: '',
      successCriteria: [],
      createdAt: '2026-01-02T00:00:00Z',
    });
    library.markPromoted(nueva.id);

    const report = runSkillProgram(world, petId, [{ op: 'runSkill', skillName: 'comer' }], {
      maxTicks: 60,
      library,
    });
    expect(report.outcome).toBe('completed');
    expect(report.energyDelta).toBeGreaterThan(20);
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
