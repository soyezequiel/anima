import { describe, expect, it } from 'vitest';
import type { WorldSnapshot } from '../src/index.js';
import { createWorld, deserializeSnapshot, restoreSnapshot, spawn, stepWorld, takeSnapshot } from '../src/index.js';

/**
 * Compatibilidad hacia atrás: los guardados y las regresiones archivadas antes
 * de que existieran las recetas no traen el campo. Restaurarlos no puede
 * reventar; un mundo viejo simplemente no admite ninguna receta.
 */
describe('restaurar mundos anteriores a las recetas', () => {
  /** Un snapshot tal como lo escribía la versión previa: sin `recipes`. */
  function legacySnapshot(): WorldSnapshot {
    const world = createWorld({ width: 5, height: 5, seed: 1 });
    spawn(world, 'pet', {
      position: { x: 1, y: 2 },
      inventory: { items: [], capacity: 4 },
      agent: { name: 'Vieja', perceptionRange: 5 },
      health: { current: 10, max: 10 },
    });
    const snapshot = takeSnapshot(world);
    delete (snapshot.state as Partial<typeof snapshot.state>).recipes;
    return snapshot;
  }

  it('restaurar un snapshot viejo deja un mundo con recetas vacías, no undefined', () => {
    const world = restoreSnapshot(legacySnapshot());
    expect(world.recipes).toEqual([]);
  });

  it('craftear en un mundo viejo falla limpio en vez de romperse', () => {
    const world = restoreSnapshot(legacySnapshot());
    const petId = Object.keys(world.entities)[0]!;
    const events = stepWorld(world, [
      { actorId: petId, intent: { type: 'craft', recipeId: 'campfire' } },
    ]);
    const resolvedEvent = events.find((e) => e.type === 'action.resolved');
    expect(resolvedEvent?.data.success).toBe(false);
    expect(resolvedEvent?.data.reason).toBe('unknown-recipe');
  });

  it('lo mismo por el camino serializado (JSON de un guardado viejo)', () => {
    const raw = JSON.stringify(legacySnapshot());
    expect(raw).not.toContain('recipes');
    const world = restoreSnapshot(deserializeSnapshot(raw));
    expect(world.recipes).toEqual([]);
  });
});
