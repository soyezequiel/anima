import { describe, expect, it } from 'vitest';
import { spawn, stepWorld } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

function addTemperature(
  pet: ReturnType<typeof buildTestWorld>['pet'],
  current = 20,
  lossPerTick = 1,
) {
  pet.components.temperature = { current, max: 50, lossPerTick };
}

function addCampfire(world: ReturnType<typeof buildTestWorld>['world'], x: number, y: number) {
  return spawn(world, 'campfire', {
    position: { x, y },
    heatSource: { warmthPerTick: 3, range: 2 },
  });
}

describe('temperatura', () => {
  it('el calor corporal decae cada tick lejos de toda fuente', () => {
    const { world, pet } = buildTestWorld();
    addTemperature(pet, 20);
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.temperature?.current).toBe(19);
  });

  it('una fuente de calor en rango revierte la pérdida, sin superar el máximo', () => {
    const { world, pet } = buildTestWorld();
    addTemperature(pet, 49); // mascota en (1,2)
    addCampfire(world, 3, 2); // distancia Chebyshev 2: dentro del rango
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    // -1 de pérdida +3 de fogata = +2, pero el máximo es 50.
    expect(pet.components.temperature?.current).toBe(50);
  });

  it('fuera del rango de la fuente no hay calor', () => {
    const { world, pet } = buildTestWorld();
    addTemperature(pet, 20);
    addCampfire(world, 5, 2); // distancia 4 > rango 2
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.temperature?.current).toBe(19);
  });

  it('una fuente de calor en el inventario calienta a quien la lleva', () => {
    const { world, pet } = buildTestWorld();
    addTemperature(pet, 20);
    // Una antorcha sostenida: sin posición propia, irradia desde la mascota.
    const torch = spawn(world, 'torch', {
      portable: {},
      heatSource: { warmthPerTick: 3, range: 1 },
    });
    pet.components.inventory!.items.push(torch.id);
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    // -1 de pérdida +3 de antorcha: llevarla es la manera de usarla.
    expect(pet.components.temperature?.current).toBe(22);
  });

  it('la antorcha de otro también calienta si está al lado', () => {
    const { world, pet } = buildTestWorld();
    addTemperature(pet, 20);
    const carrier = spawn(world, 'pet', {
      position: { x: 2, y: 2 }, // adyacente a la mascota (1,2)
      inventory: { items: [], capacity: 2 },
      agent: { name: 'Otra', perceptionRange: 5 },
    });
    const torch = spawn(world, 'torch', {
      portable: {},
      heatSource: { warmthPerTick: 3, range: 1 },
    });
    carrier.components.inventory!.items.push(torch.id);
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.temperature?.current).toBe(22);
  });

  it('emite temperature.low al cruzar el umbral, una sola vez', () => {
    const { world, pet } = buildTestWorld();
    addTemperature(pet, 18); // umbral: 50 * 0.35 = 17.5
    const first = stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(first.some((e) => e.type === 'temperature.low')).toBe(true);
    const second = stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(second.some((e) => e.type === 'temperature.low')).toBe(false);
  });

  it('con el calor en cero, la salud decae y la muerte es por "hypothermia"', () => {
    const { world, pet } = buildTestWorld();
    addTemperature(pet, 1);
    pet.components.health = { current: 2, max: 10 };
    const all = [];
    for (let i = 0; i < 3; i++) {
      all.push(...stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]));
    }
    expect(all.some((e) => e.type === 'temperature.depleted')).toBe(true);
    expect(pet.components.dead?.cause).toBe('hypothermia');
    const died = all.find((e) => e.type === 'pet.died');
    expect(died?.data.cause).toBe('hypothermia');
    // No fue hambre: la energía sigue por encima de cero.
    expect(pet.components.energy!.current).toBeGreaterThan(0);
  });

  it('sin componente de temperatura, nada cambia (los mundos sin frío quedan intactos)', () => {
    const { world, pet } = buildTestWorld();
    addCampfire(world, 2, 2);
    const events = stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.temperature).toBeUndefined();
    expect(events.some((e) => e.type === 'temperature.low')).toBe(false);
  });
});

function addShelter(world: ReturnType<typeof buildTestWorld>['world'], x: number, y: number) {
  return spawn(world, 'shelter', { position: { x, y }, shelter: { range: 1 } });
}

/**
 * El refugio es la contraparte serena de la fogata: adentro no se pierde
 * calor, pero tampoco se recupera. No calienta, no quema, no hay distancia
 * prudente que aprender.
 */
describe('refugio', () => {
  it('al alcance del refugio, el calor corporal deja de perderse', () => {
    const { world, pet } = buildTestWorld(); // mascota en (1,2)
    addTemperature(pet, 20);
    addShelter(world, 2, 2); // distancia 1: dentro del rango
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.temperature?.current).toBe(20);
  });

  it('no calienta: parado el sangrado, el calor no sube', () => {
    const { world, pet } = buildTestWorld();
    addTemperature(pet, 20);
    addShelter(world, 2, 2);
    for (let i = 0; i < 10; i++) stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.temperature?.current).toBe(20);
  });

  it('fuera del rango, la pérdida sigue como siempre', () => {
    const { world, pet } = buildTestWorld();
    addTemperature(pet, 20);
    addShelter(world, 4, 2); // distancia 3 > rango 1
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(pet.components.temperature?.current).toBe(19);
  });

  it('una fogata en rango sí calienta a quien está refugiado', () => {
    const { world, pet } = buildTestWorld();
    addTemperature(pet, 20);
    addShelter(world, 2, 2);
    addCampfire(world, 3, 2); // distancia 2: dentro del rango del fuego
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    // Sin pérdida (refugio) y +3 de fogata: las dos reglas conviven.
    expect(pet.components.temperature?.current).toBe(23);
  });
});
