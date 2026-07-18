import { describe, expect, it } from 'vitest';
import {
  createWorld,
  GLYPH_SIZE,
  MAX_GLYPHS,
  restoreSnapshot,
  spawn,
  stepWorld,
  takeSnapshot,
  validateGlyph,
} from '../src/index.js';

/**
 * La quinta puerta: el dibujo que propone la IA Dios. No juzga si el dibujo se
 * PARECE a la cosa —ninguna regla determinista puede— sino si es dibujable.
 */

/** Un glifo válido: un bloque macizo en el medio. */
function solid(): string[] {
  return Array.from({ length: GLYPH_SIZE }, (_, y) =>
    y >= 4 && y < 12 ? '0000111111110000' : '0'.repeat(GLYPH_SIZE),
  );
}

describe('la puerta de los dibujos', () => {
  it('acepta una grilla de la medida exacta con índices de paleta', () => {
    const result = validateGlyph({ kind: 'cuchillo', rows: solid() });
    expect(result.ok).toBe(true);
  });

  it('rechaza lo que no tiene la medida exacta', () => {
    expect(validateGlyph({ kind: 'x', rows: solid().slice(1) }).ok).toBe(false);
    expect(validateGlyph({ kind: 'x', rows: [...solid().slice(1), '1'.repeat(17)] }).ok).toBe(false);
    expect(validateGlyph({ kind: 'x', rows: 'no soy una grilla' }).ok).toBe(false);
    expect(validateGlyph(null).ok).toBe(false);
  });

  it('rechaza colores: solo entran índices de paleta', () => {
    // El 4 no existe: hay tres tonos y el vacío. Que el alfabeto sea cerrado es
    // lo que hace imposible que un dibujo salga de un color que no le toca.
    const rows = [...solid().slice(1), '4'.repeat(GLYPH_SIZE)];
    expect(validateGlyph({ kind: 'x', rows }).ok).toBe(false);
    const hex = [...solid().slice(1), '#ff00ff'.padEnd(GLYPH_SIZE, '0')];
    expect(validateGlyph({ kind: 'x', rows: hex }).ok).toBe(false);
  });

  it('rechaza un lienzo casi vacío: sería un objeto invisible', () => {
    const empty = Array.from({ length: GLYPH_SIZE }, () => '0'.repeat(GLYPH_SIZE));
    expect(validateGlyph({ kind: 'x', rows: empty }).ok).toBe(false);
    const speck = [...empty.slice(1), '1110000000000000'];
    expect(validateGlyph({ kind: 'x', rows: speck }).ok).toBe(false);
  });

  it('un tipo se dibuja una sola vez', () => {
    const result = validateGlyph({ kind: 'cuchillo', rows: solid() }, ['cuchillo']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('ya sé cómo se ve');
  });

  it('un mundo no admite dibujos infinitos', () => {
    const full = Array.from({ length: MAX_GLYPHS }, (_, i) => `cosa-${i}`);
    expect(validateGlyph({ kind: 'una-mas', rows: solid() }, full).ok).toBe(false);
  });

  it('lo que entra no comparte referencia con lo que propuso el modelo', () => {
    const rows = solid();
    const result = validateGlyph({ kind: 'cuchillo', rows });
    expect(result.ok).toBe(true);
    if (result.ok) {
      rows[5] = '0'.repeat(GLYPH_SIZE);
      expect(result.value.rows[5]).not.toBe(rows[5]);
    }
  });
});

describe('el dibujo es estado del mundo', () => {
  it('entra por el intent y queda registrado por tipo', () => {
    const world = createWorld({ width: 5, height: 5, seed: 1 });
    const pet = spawn(world, 'pet', { position: { x: 1, y: 1 } });
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeGlyph', glyph: { kind: 'cuchillo', rows: solid() } } },
    ]);
    expect(events.some((e) => e.type === 'glyph.learned')).toBe(true);
    expect(world.glyphs['cuchillo']).toEqual(solid());
  });

  it('un dibujo inválido se rechaza con motivo y no toca el mundo', () => {
    const world = createWorld({ width: 5, height: 5, seed: 1 });
    const pet = spawn(world, 'pet', { position: { x: 1, y: 1 } });
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeGlyph', glyph: { kind: 'x', rows: ['basura'] } } },
    ]);
    const rejected = events.find((e) => e.type === 'glyph.rejected');
    expect(rejected).toBeDefined();
    // El motivo viaja de vuelta al modelo como corrección, no es decorativo.
    expect(String(rejected?.data.reason)).toContain('Dibujo inválido');
    expect(Object.keys(world.glyphs)).toHaveLength(0);
  });

  it('sobrevive al guardado, y un mundo viejo restaura sin dibujos', () => {
    const world = createWorld({ width: 5, height: 5, seed: 1 });
    world.glyphs['cuchillo'] = solid();
    expect(restoreSnapshot(takeSnapshot(world)).glyphs['cuchillo']).toEqual(solid());

    // Un guardado anterior a esta puerta no tiene el campo: no puede explotar.
    const old = takeSnapshot(createWorld({ width: 5, height: 5, seed: 1 }));
    delete (old.state as { glyphs?: unknown }).glyphs;
    expect(restoreSnapshot(old).glyphs).toEqual({});
  });
});
