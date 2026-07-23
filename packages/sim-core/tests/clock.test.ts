import { describe, expect, it } from 'vitest';
import {
  createWorld,
  daylight,
  restoreSnapshot,
  secondsToTicks,
  takeSnapshot,
  TICKS_PER_SECOND,
  timeOfDay,
} from '../src/index.js';

describe('reloj determinista del mundo', () => {
  it('un mundo sin reloj es siempre de día', () => {
    const world = createWorld({ width: 3, height: 3, seed: 1 });
    world.tick = 0;
    expect(timeOfDay(world)).toBe('day');
    world.tick = 999;
    expect(timeOfDay(world)).toBe('day');
  });

  it('deriva la hora del tick según el ciclo, no de un temporizador', () => {
    const world = createWorld(
      { width: 3, height: 3, seed: 1 },
      { clock: { dayTicks: 3, nightTicks: 2 } },
    );
    // Ciclo de 5: [día, día, día, noche, noche], y vuelve a empezar.
    const phases = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((tick) => {
      world.tick = tick;
      return timeOfDay(world);
    });
    expect(phases).toEqual([
      'day', 'day', 'day', 'night', 'night',
      'day', 'day', 'day', 'night', 'night',
    ]);
  });

  it('el desfase permite arrancar de noche y ver amanecer', () => {
    const world = createWorld(
      { width: 3, height: 3, seed: 1 },
      // offset 3: el tick 0 cae en la parte de noche del ciclo.
      { clock: { dayTicks: 3, nightTicks: 2, offset: 3 } },
    );
    world.tick = 0;
    expect(timeOfDay(world)).toBe('night');
    world.tick = 1;
    expect(timeOfDay(world)).toBe('night');
    // Amanece: pasa a día tras la noche.
    world.tick = 2;
    expect(timeOfDay(world)).toBe('day');
  });

  it('la hora sobrevive a guardar y restaurar (viaja en el snapshot)', () => {
    const world = createWorld(
      { width: 3, height: 3, seed: 7 },
      { clock: { dayTicks: 4, nightTicks: 4, offset: 4 } },
    );
    world.tick = 10;
    const before = timeOfDay(world);
    const restored = restoreSnapshot(takeSnapshot(world));
    expect(restored.clock).toEqual(world.clock);
    expect(restored.tick).toBe(10);
    expect(timeOfDay(restored)).toBe(before);
  });

  it('la luz es continua: pleno día, plena noche y rampas de amanecer/atardecer', () => {
    // Ciclo de 24: día [0,16), noche [16,24). ramp = min(16,8)*0.25 = 2.
    const world = createWorld(
      { width: 3, height: 3, seed: 1 },
      { clock: { dayTicks: 16, nightTicks: 8 } },
    );
    const light = (tick: number): number => {
      world.tick = tick;
      return daylight(world);
    };
    expect(light(0)).toBe(1); // pleno día
    expect(light(13)).toBe(1); // sigue pleno día
    expect(light(15)).toBeCloseTo(0.5); // atardece a medias (rampa 1→0)
    expect(light(16)).toBe(0); // plena noche
    expect(light(20)).toBe(0); // sigue de noche
    expect(light(23)).toBeCloseTo(0.5); // amanece a medias (rampa 0→1)
    // Un mundo sin reloj es pleno día siempre.
    const sinReloj = createWorld({ width: 3, height: 3, seed: 1 });
    sinReloj.tick = 999;
    expect(daylight(sinReloj)).toBe(1);
  });

  it('traduce segundos a ticks con el ritmo del mundo', () => {
    expect(TICKS_PER_SECOND).toBeGreaterThan(0);
    expect(secondsToTicks(10)).toBe(10 * TICKS_PER_SECOND);
    expect(secondsToTicks(0)).toBe(0);
    expect(secondsToTicks(-5)).toBe(0);
  });
});
