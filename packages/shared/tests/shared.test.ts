import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, hashValue, manhattan, isAdjacent } from '../src/index.js';

describe('rng', () => {
  it('produce la misma secuencia con la misma semilla', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => nextFloat(a));
    const seqB = Array.from({ length: 20 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
  });

  it('produce secuencias distintas con semillas distintas', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(nextFloat(a)).not.toEqual(nextFloat(b));
  });

  it('nextInt respeta los límites inclusive', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const n = nextInt(rng, 3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
});

describe('hash', () => {
  it('es estable ante orden de claves', () => {
    expect(hashValue({ a: 1, b: { c: 2, d: 3 } })).toEqual(hashValue({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it('cambia cuando cambia el contenido', () => {
    expect(hashValue({ a: 1 })).not.toEqual(hashValue({ a: 2 }));
  });
});

describe('vec2', () => {
  it('manhattan y adyacencia', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 2, y: 3 })).toBe(5);
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(true);
    expect(isAdjacent({ x: 1, y: 1 }, { x: 3, y: 1 })).toBe(false);
  });
});
