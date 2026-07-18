import { describe, expect, it } from 'vitest';
import type { ActorIntent } from '@anima/sim-core';
import { checkInvariants, getEntity, stepWorld } from '@anima/sim-core';
import { coldNight } from '../src/index.js';

/**
 * La historia del frío a nivel motor (el agente aún no sabe reaccionar;
 * eso llega con la fogata crafteable). Reglas que el mundo ya garantiza:
 * congelarse mata, el fuego cerca salva, el fuego encima quema (ADR 0041).
 */
describe('escenario cold-night', () => {
  const wait = (petId: string): ActorIntent[] => [
    { actorId: petId, intent: { type: 'wait' } },
  ];

  it('lejos del fuego, la mascota termina muriendo de hipotermia', () => {
    const { world, petId } = coldNight.build(1);
    for (let i = 0; i < 400 && !getEntity(world, petId)?.components.dead; i++) {
      stepWorld(world, wait(petId));
    }
    expect(getEntity(world, petId)?.components.dead?.cause).toBe('hypothermia');
    expect(checkInvariants(world)).toEqual([]);
  });

  it('a distancia 2 de la fogata se calienta sin quemarse', () => {
    const { world, petId } = coldNight.build(1);
    const pet = getEntity(world, petId)!;
    pet.components.position = { x: 4, y: 2 }; // fogata en (6,2): distancia 2
    const before = pet.components.temperature!.current;
    const healthBefore = pet.components.health!.current;
    stepWorld(world, wait(petId));
    expect(pet.components.temperature!.current).toBeGreaterThan(before);
    expect(pet.components.health!.current).toBe(healthBefore);
  });

  it('pegado a la fogata se calienta y NO se quema: arrimarse es lo correcto', () => {
    const { world, petId } = coldNight.build(1);
    const pet = getEntity(world, petId)!;
    pet.components.position = { x: 5, y: 2 }; // adyacente: dentro del rango de calor
    const before = pet.components.temperature!.current;
    const healthBefore = pet.components.health!.current;
    stepWorld(world, wait(petId));
    expect(pet.components.temperature!.current).toBeGreaterThan(before);
    expect(pet.components.health!.current).toBe(healthBefore);
  });

  it('dentro de la fogata se quema: el castigo es meterse, no arrimarse', () => {
    const { world, petId } = coldNight.build(1);
    const pet = getEntity(world, petId)!;
    pet.components.position = { x: 6, y: 2 }; // la celda de la fogata
    const healthBefore = pet.components.health!.current;
    stepWorld(world, wait(petId));
    expect(pet.components.health!.current).toBeLessThan(healthBefore);
  });

  it('el mismo seed produce el mismo mundo (determinismo del escenario)', () => {
    const a = coldNight.build(7);
    const b = coldNight.build(7);
    expect(a.world.entities).toEqual(b.world.entities);
  });
});
