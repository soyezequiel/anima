import { describe, expect, it } from 'vitest';
import { buildPerception, spawn } from '../src/index.js';
import { buildTestWorld, spawnFood, spawnHammer, spawnWall } from './helpers.js';

/**
 * La percepción deja de ver a través de los muros: la vista exige línea
 * despejada (Bresenham). Lo comestible y lo que irradia calor se perciben
 * igual —olfato y calor no rebotan en un muro—, que es lo que sostiene la
 * historia del MVP: la comida tras el muro se desea sin verse (ADR 0025).
 */

describe('línea de visión', () => {
  it('un muro completo tapa lo que hay detrás', () => {
    const { world, pet } = buildTestWorld();
    for (let y = 0; y < 5; y++) spawnWall(world, 3, y);
    const hammer = spawnHammer(world, 5, 2);

    const perception = buildPerception(world, pet.id);

    expect(perception.visibleEntities.some((e) => e.id === hammer.id)).toBe(false);
    // El muro mismo sí se ve: solo las celdas intermedias tapan.
    expect(perception.visibleEntities.filter((e) => e.kind === 'wall')).toHaveLength(5);
  });

  it('sin obstáculo intermedio, lo mismo se ve', () => {
    const { world, pet } = buildTestWorld();
    const hammer = spawnHammer(world, 5, 2);

    const perception = buildPerception(world, pet.id);

    expect(perception.visibleEntities.some((e) => e.id === hammer.id)).toBe(true);
  });

  it('la comida tras el muro se sigue percibiendo: se huele, no se ve', () => {
    const { world, pet } = buildTestWorld();
    for (let y = 0; y < 5; y++) spawnWall(world, 3, y);
    const food = spawnFood(world, 5, 2);

    const perceived = buildPerception(world, pet.id).visibleEntities.find(
      (e) => e.id === food.id,
    );

    expect(perceived).toBeDefined();
    expect(perceived?.position).toEqual({ x: 5, y: 2 });
  });

  it('una fuente de calor tras el muro también se siente', () => {
    const { world, pet } = buildTestWorld();
    for (let y = 0; y < 5; y++) spawnWall(world, 3, y);
    const fire = spawn(world, 'campfire', {
      position: { x: 5, y: 2 },
      heatSource: { warmthPerTick: 0.3, range: 2 },
      hazard: { damagePerTick: 1 },
    });

    expect(
      buildPerception(world, pet.id).visibleEntities.some((e) => e.id === fire.id),
    ).toBe(true);
  });

  it('lo que lleva encima no depende de la vista', () => {
    const { world, pet } = buildTestWorld();
    for (let y = 0; y < 5; y++) spawnWall(world, 3, y);
    const held = spawn(world, 'log', { portable: {} });
    pet.components.inventory!.items.push(held.id);

    const perception = buildPerception(world, pet.id);

    expect(perception.self.heldItems.some((e) => e.id === held.id)).toBe(true);
  });

  it('un sólido no se tapa a sí mismo ni a lo que tiene al lado del observador', () => {
    const { world, pet } = buildTestWorld();
    // Muro pegado a la mascota: la sección adyacente se ve.
    const wall = spawnWall(world, 2, 2);

    expect(
      buildPerception(world, pet.id).visibleEntities.some((e) => e.id === wall.id),
    ).toBe(true);
  });
});
