import { describe, expect, it } from 'vitest';
import { findByKind, removeEntity, spawn, stepWorld } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

/**
 * El productor periódico genérico: un árbol que suelta ramas sin que nadie lo
 * tale. Madera renovable que no cuesta la fuente de alimento (ADR 0019: la
 * mascota se niega a talar árboles que cree necesitar, y negarse necesitaba
 * una salida).
 */

const BRANCH_ARCHETYPE = {
  kind: 'branch',
  components: { portable: {}, tool: { power: 1 }, durability: { current: 8, max: 8 } },
};

function addBranchTree(world: ReturnType<typeof buildTestWorld>['world'], interval: number) {
  return spawn(world, 'tree', {
    position: { x: 5, y: 2 },
    collider: { solid: true },
    itemSource: { intervalTicks: interval, nextSpawnAtTick: 3, output: BRANCH_ARCHETYPE },
  });
}

describe('productor periódico de objetos (ramas que caen)', () => {
  it('suelta el objeto declarado en una celda libre adyacente al vencer el intervalo', () => {
    const { world, pet } = buildTestWorld();
    addBranchTree(world, 10);
    let spawned = 0;
    for (let i = 0; i < 3; i++) {
      const events = stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
      spawned += events.filter((e) => e.type === 'entity.spawned').length;
    }
    expect(spawned).toBe(1);
    const branches = findByKind(world, 'branch');
    expect(branches).toHaveLength(1);
    // La rama nace como la declara el arquetipo: herramienta débil y portátil.
    expect(branches[0]?.components.tool?.power).toBe(1);
    expect(branches[0]?.components.portable).toBeDefined();
    // Adyacente al árbol.
    const pos = branches[0]!.components.position!;
    expect(Math.max(Math.abs(pos.x - 5), Math.abs(pos.y - 2))).toBeLessThanOrEqual(1);
  });

  it('no suelta nada si todas las celdas adyacentes están ocupadas', () => {
    const { world, pet } = buildTestWorld();
    addBranchTree(world, 5);
    // Rodeado por completo: piedras en las 8 celdas vecinas.
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        if (dx === 0 && dy === 0) continue;
        spawn(world, 'flint', { position: { x: 5 + dx, y: 2 + dy }, portable: {} });
      }
    }
    for (let i = 0; i < 12; i++) {
      stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    }
    expect(findByKind(world, 'branch')).toHaveLength(0);
  });

  it('no acumula: mientras la rama anterior siga cerca, no cae otra', () => {
    const { world, pet } = buildTestWorld();
    addBranchTree(world, 5);
    for (let i = 0; i < 30; i++) {
      stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    }
    expect(findByKind(world, 'branch')).toHaveLength(1);
  });

  it('recogerla es lo que hace que vuelva a producir', () => {
    const { world, pet } = buildTestWorld();
    addBranchTree(world, 5);
    for (let i = 0; i < 6; i++) stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    const first = findByKind(world, 'branch')[0]!;
    removeEntity(world, first.id);
    for (let i = 0; i < 6; i++) stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(findByKind(world, 'branch')).toHaveLength(1);
  });

  it('la saturación es por tipo: una rama ajena cerca no frena al alimento, y viceversa', () => {
    const { world, pet } = buildTestWorld();
    const tree = addBranchTree(world, 5);
    tree.components.foodSource = { intervalTicks: 5, nutrition: 10, nextSpawnAtTick: 3 };
    for (let i = 0; i < 12; i++) {
      stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    }
    // Cada fuente produjo lo suyo: la rama no cuenta como alimento ni al revés.
    expect(findByKind(world, 'branch')).toHaveLength(1);
    expect(findByKind(world, 'food')).toHaveLength(1);
  });
});
