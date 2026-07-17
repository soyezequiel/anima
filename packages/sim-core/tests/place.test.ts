import { describe, expect, it } from 'vitest';
import { entitiesAt, spawn, stepWorld } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

/**
 * `place`: la primitiva de colocar (ADR 0032). Es `drop` con puntería — pone un
 * bloque que se lleva encima en una celda elegida, siempre que esté al alcance
 * del brazo, vacía y dentro del mapa. Sin trampas: no hay teletransporte de
 * materia.
 */
function giveBlock(world: ReturnType<typeof buildTestWorld>, kind = 'pared'): string {
  const block = spawn(world.world, kind, { portable: {}, collider: { solid: true } });
  world.pet.components.inventory!.items.push(block.id);
  return block.id;
}

describe('place: colocar un bloque', () => {
  it('pone el bloque en la celda adyacente y lo saca del inventario', () => {
    const w = buildTestWorld();
    const blockId = giveBlock(w);
    // La mascota está en (1,2); coloca a su derecha, en (2,2).
    const events = stepWorld(w.world, [
      { actorId: w.pet.id, intent: { type: 'place', itemId: blockId, at: { x: 2, y: 2 } } },
    ]);
    expect(events.some((e) => e.type === 'item.placed')).toBe(true);
    expect(w.pet.components.inventory!.items).not.toContain(blockId);
    expect(entitiesAt(w.world, { x: 2, y: 2 }).map((e) => e.id)).toEqual([blockId]);
  });

  it('no coloca lo que no lleva encima', () => {
    const w = buildTestWorld();
    const loose = spawn(w.world, 'pared', { position: { x: 3, y: 3 }, portable: {} });
    const events = stepWorld(w.world, [
      { actorId: w.pet.id, intent: { type: 'place', itemId: loose.id, at: { x: 2, y: 2 } } },
    ]);
    expect(events.find((e) => e.type === 'action.resolved')?.data.reason).toBe('not-held');
  });

  it('no coloca fuera del alcance del brazo: la materia no se teletransporta', () => {
    const w = buildTestWorld();
    const blockId = giveBlock(w);
    // (4,2) está a tres celdas: fuera de adyacencia.
    const events = stepWorld(w.world, [
      { actorId: w.pet.id, intent: { type: 'place', itemId: blockId, at: { x: 4, y: 2 } } },
    ]);
    expect(events.find((e) => e.type === 'action.resolved')?.data.reason).toBe('out-of-reach');
    expect(w.pet.components.inventory!.items).toContain(blockId);
  });

  it('no coloca en una celda ocupada: dos bloques no comparten lugar', () => {
    const w = buildTestWorld();
    const blockId = giveBlock(w);
    spawn(w.world, 'tree', { position: { x: 2, y: 2 }, collider: { solid: true } });
    const events = stepWorld(w.world, [
      { actorId: w.pet.id, intent: { type: 'place', itemId: blockId, at: { x: 2, y: 2 } } },
    ]);
    expect(events.find((e) => e.type === 'action.resolved')?.data.reason).toBe('cell-occupied');
    expect(w.pet.components.inventory!.items).toContain(blockId);
  });

  it('no coloca fuera del mapa', () => {
    const w = buildTestWorld();
    const blockId = giveBlock(w);
    // La mascota en (1,2); (0,1) es válido, probemos el borde: mover a (0,2) no.
    // (1,2) → arriba-izquierda sería (0,1), dentro. Usamos un borde real:
    w.pet.components.position = { x: 0, y: 0 };
    const events = stepWorld(w.world, [
      { actorId: w.pet.id, intent: { type: 'place', itemId: blockId, at: { x: -1, y: 0 } } },
    ]);
    expect(events.find((e) => e.type === 'action.resolved')?.data.reason).toBe('out-of-bounds');
  });
});
