import { describe, expect, it } from 'vitest';
import type { ActorIntent } from '@anima/sim-core';
import { checkInvariants, getEntity, stepWorld } from '@anima/sim-core';
import { foodBehindWall } from '../src/index.js';

/**
 * El mundo jugable con sus tres entidades nuevas (ADR 0026): agua que da
 * forma a los caminos, un refugio ya construido y árboles que sueltan ramas.
 * Lo que estas pruebas custodian es la MESURA: nada de esto puede adelantarse
 * a la historia del hambre ni asomar dentro de los 200 ticks de una
 * evaluación de skill.
 */
describe('escenario food-behind-wall', () => {
  const wait = (petId: string): ActorIntent[] => [
    { actorId: petId, intent: { type: 'wait' } },
  ];

  it('tiene agua, refugio y árboles que sueltan ramas', () => {
    const { world } = foodBehindWall.build(1);
    const kinds = Object.values(world.entities).map((e) => e.kind);
    expect(kinds).toContain('water');
    expect(kinds).toContain('shelter');
    const trees = Object.values(world.entities).filter((e) => e.kind === 'tree');
    expect(trees.length).toBeGreaterThan(0);
    for (const tree of trees) {
      expect(tree.components.itemSource?.output.kind).toBe('branch');
    }
    expect(world.recipes.some((r) => r.id === 'shelter')).toBe(true);
  });

  it('nada nuevo brota dentro del horizonte de una evaluación (200 ticks)', () => {
    const { world } = foodBehindWall.build(1);
    for (const entity of Object.values(world.entities)) {
      if (entity.components.itemSource) {
        expect(entity.components.itemSource.nextSpawnAtTick).toBeGreaterThan(200);
      }
      if (entity.components.foodSource) {
        expect(entity.components.foodSource.nextSpawnAtTick).toBeGreaterThan(200);
      }
    }
  });

  it('pasado el primer intervalo, los árboles sueltan ramas: la madera se renueva sin talar', () => {
    const { world, petId } = foodBehindWall.build(1);
    const branchesBefore = Object.values(world.entities).filter((e) => e.kind === 'branch').length;
    for (let i = 0; i < 360; i++) stepWorld(world, wait(petId));
    const branchesAfter = Object.values(world.entities).filter((e) => e.kind === 'branch').length;
    expect(branchesAfter).toBeGreaterThan(branchesBefore);
    expect(checkInvariants(world)).toEqual([]);
  });

  it('caminar al agua falla con su propio motivo y la mascota no avanza', () => {
    const { world, petId } = foodBehindWall.build(1);
    const pet = getEntity(world, petId)!;
    pet.components.position = { x: 7, y: 1 }; // agua en (7,0)
    const events = stepWorld(world, [{ actorId: petId, intent: { type: 'move', dir: 'up' } }]);
    const resolution = events.find((e) => e.type === 'action.resolved');
    expect(resolution?.data.success).toBe(false);
    expect(resolution?.data.reason).toBe('water');
    expect(pet.components.position).toEqual({ x: 7, y: 1 });
  });

  it('al lado del refugio, el calor corporal deja de perderse', () => {
    const { world, petId } = foodBehindWall.build(1);
    const pet = getEntity(world, petId)!;
    pet.components.position = { x: 1, y: 5 }; // refugio en (0,6): distancia 1
    const before = pet.components.temperature!.current;
    stepWorld(world, wait(petId));
    expect(pet.components.temperature!.current).toBe(before);
  });

  it('el mismo seed produce el mismo mundo (determinismo del escenario)', () => {
    const a = foodBehindWall.build(7);
    const b = foodBehindWall.build(7);
    expect(a.world.entities).toEqual(b.world.entities);
  });
});
