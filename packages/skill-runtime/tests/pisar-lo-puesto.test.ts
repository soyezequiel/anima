import { describe, expect, it } from 'vitest';
import type { EntityId, WorldState } from '@anima/sim-core';
import { createWorld, spawn } from '@anima/sim-core';
import { runSkillProgram } from '../src/index.js';

/**
 * La regla de qué se puede pisar vive en el motor (`impedimentAt`), pero el
 * agente lleva su propia copia para planificar: el BFS de `moveToward`/`gpsTo`
 * y el mapa mental de `SpatialMemory`.
 *
 * Cuando las dos copias no coinciden, pasa lo que se vio en una partida real:
 * Ánima construyó una balsa, la puso sobre el río, el paso se abrió DE VERDAD
 * —el motor lo confirmaba— y ella se quedó del lado de acá, muriéndose de
 * hambre, porque su propio mapa mental seguía diciendo "eso es agua".
 *
 * Estas pruebas fijan que las dos copias digan lo mismo.
 */
function riverWorld(): { world: WorldState; petId: EntityId } {
  // Un río en x=2, de borde a borde: sin rodeo posible.
  const world = createWorld({ width: 6, height: 3, seed: 1 });
  const petId = spawn(world, 'pet', {
    position: { x: 0, y: 1 },
    collider: { solid: true },
    energy: { current: 40, max: 50, decayPerTick: 0 },
    health: { current: 10, max: 10 },
    inventory: { items: [], capacity: 4 },
    agent: { name: 'Test', perceptionRange: 12 },
  }).id;
  for (let y = 0; y < 3; y++) spawn(world, 'agua', { position: { x: 2, y }, water: {} });
  spawn(world, 'food', {
    position: { x: 5, y: 1 },
    portable: {},
    edible: {},
    nutrition: { value: 20 },
  });
  return { world, petId };
}

const GO_EAT = [
  { op: 'findEntities' as const, query: { kind: 'food' }, store: 'foods' },
  { op: 'selectTarget' as const, from: 'foods', strategy: 'nearest' as const, store: 'food' },
  { op: 'moveToward' as const, target: 'food', maxSteps: 20 },
  { op: 'consume' as const, target: 'food' },
];

describe('el agente sabe pisar lo que puso', () => {
  it('sin nada puesto, el río la frena: no hay camino y no come', () => {
    const { world, petId } = riverWorld();
    const report = runSkillProgram(world, petId, GO_EAT, { maxTicks: 30 });
    expect(world.entities[petId]!.components.position!.x).toBeLessThan(2);
    expect(report.events.some((e) => e.type === 'item.consumed')).toBe(false);
  });

  it('con algo que ofrece dónde pisar, planifica por ahí y cruza', () => {
    const { world, petId } = riverWorld();
    // Alguien puso una tabla sobre el río: no importa quién — lo que se prueba
    // es que su planificador la use.
    spawn(world, 'tabla', { position: { x: 2, y: 1 }, footing: {} });

    const report = runSkillProgram(world, petId, GO_EAT, { maxTicks: 30 });
    expect(report.events.some((e) => e.type === 'item.consumed')).toBe(true);
    expect(world.entities[petId]!.components.position!.x).toBeGreaterThan(2);
  });

  it('el mapa mental deja de contar esa celda como obstáculo en cuanto la ve', () => {
    const { world, petId } = riverWorld();
    // Primero la ve como río: el recuerdo de "acá no se pasa" se forma.
    runSkillProgram(world, petId, GO_EAT, { maxTicks: 8 });
    // Y ahora hay tabla. Una ejecución nueva no arrastra el recuerdo viejo,
    // pero la regla que se prueba es la misma que lo desmiente en vivo.
    spawn(world, 'tabla', { position: { x: 2, y: 1 }, footing: {} });
    const report = runSkillProgram(world, petId, GO_EAT, { maxTicks: 30 });
    expect(report.events.some((e) => e.type === 'item.consumed')).toBe(true);
  });
});
