import { describe, expect, it } from 'vitest';
import { allEntities, canStandAt, spawn } from '@anima/sim-core';
import { cauce } from '../src/index.js';
import { MissionTracker } from '../src/tracker.js';

/**
 * Un mapa que no se puede ganar no es difícil: está roto.
 *
 * El vado enseñó eso por las malas — su materia alcanzaba justo, y una tirada
 * perdida en un craft lo volvía imposible sin que nadie se enterara. Estas
 * pruebas son el chequeo que le faltaba a ese mapa: que la forma del mundo
 * admita una solución, y que el juez la reconozca cuando ocurre.
 *
 * No se prueba que Ánima lo resuelva —eso es asunto suyo y de su modelo— sino
 * que el mapa no le esté mintiendo.
 */

describe('el cauce ancho es un mapa ganable', () => {
  it('el cauce mide cuatro celdas de agua, de borde a borde', () => {
    const { world } = cauce.build(1);
    for (let y = 0; y < 9; y++) {
      for (const x of [6, 7, 8, 9]) {
        expect(canStandAt(world, { x, y })).toBe(false);
      }
    }
    // Y no hay rodeo: las cuatro columnas van de arriba abajo.
    const agua = allEntities(world).filter((e) => e.components.water);
    expect(agua.length).toBe(4 * 9);
  });

  it('las dos orillas son caminables y están de verdad separadas', () => {
    const { world, petId } = cauce.build(1);
    // Ignorando a la propia mascota, que es sólida y ocupa su celda.
    expect(canStandAt(world, { x: 2, y: 4 }, petId)).toBe(true);
    expect(canStandAt(world, { x: 14, y: 4 })).toBe(true);
    // Sin nada tendido, el juez tiene que ver que NO hay paso.
    const tracker = new MissionTracker(cauce.mission, world, petId);
    const paso = tracker.evaluate(world).objectives.find((o) => o.id === 'paso-abierto');
    expect(paso?.met).toBe(false);
  });

  /** Tiende `celdas` piezas pisables por el cauce, como lo haría una partida. */
  function tender(xs: number[]) {
    const { world, petId } = cauce.build(1);
    // El tracker se construye ANTES de que existan: es lo que las vuelve
    // "nacidas en la partida" a sus ojos.
    const tracker = new MissionTracker(cauce.mission, world, petId);
    for (const x of xs) {
      // Un tipo que el mundo no tenía. No se llama puente ni balsa a propósito:
      // al juez le da igual la forma, y este test no debería saberla tampoco.
      const pieza = spawn(world, 'lo-que-sea', { position: { x, y: 4 }, footing: {} });
      tracker.observe([
        { type: 'item.placed', tick: world.tick, data: { itemId: pieza.id } },
      ] as never);
    }
    return { world, petId, tracker };
  }

  it('cuatro cosas que se pisen, puestas en el cauce, abren el paso y cumplen la misión', () => {
    const { world, petId, tracker } = tender([6, 7, 8, 9]);
    world.entities[petId]!.components.position = { x: 14, y: 4 };

    const met = new Map(tracker.evaluate(world).objectives.map((o) => [o.id, o.met]));
    expect(met.get('invento-existe')).toBe(true);
    expect(met.get('tendido-completo')).toBe(true);
    expect(met.get('paso-abierto')).toBe(true);
    expect(met.get('cruzo')).toBe(true);
  });

  it('tres no alcanzan: el tendido corto deja el paso cerrado', () => {
    const { world, tracker } = tender([6, 7, 8]);
    const met = new Map(tracker.evaluate(world).objectives.map((o) => [o.id, o.met]));
    expect(met.get('tendido-completo')).toBe(false);
    expect(met.get('paso-abierto')).toBe(false);
  });

  it('la materia alcanza para tender el cauce por cualquiera de los dos caminos', () => {
    const { world } = cauce.build(1);
    const cuenta = (kind: string) =>
      allEntities(world).filter((e) => e.kind === kind && e.components.position).length;
    // Cuatro celdas por el camino barato (una tabla por celda) son 4 troncos;
    // por el caro (una obra de piezas de dos tablas) son 8. Con 10 sueltos más
    // los árboles, las dos rutas entran y todavía queda margen para una tirada
    // perdida — que es justo lo que al vado le faltaba.
    expect(cuenta('tronco')).toBeGreaterThanOrEqual(8);
    expect(cuenta('arbol')).toBeGreaterThanOrEqual(3);
    expect(cuenta('fibra')).toBeGreaterThanOrEqual(8);
    expect(cuenta('resina')).toBeGreaterThanOrEqual(4);
  });

  it('toda la comida está del otro lado: cruzar no es opcional', () => {
    const { world } = cauce.build(1);
    const comida = allEntities(world).filter((e) => e.kind === 'food' && e.components.position);
    expect(comida.length).toBeGreaterThan(0);
    for (const bocado of comida) {
      expect(bocado.components.position!.x).toBeGreaterThan(9);
    }
  });
});
