import { describe, expect, it } from 'vitest';
import type { Blueprint } from '../src/index.js';
import {
  GLYPH_SIZE,
  createWorld,
  restoreSnapshot,
  spawn,
  stepWorld,
  takeSnapshot,
  validateWorkGlyphs,
  workGlyphFor,
} from '../src/index.js';

/**
 * Una obra no es un montón de piezas: es una forma.
 *
 * El registro de dibujos de siempre contesta «¿cómo se ve un tablón?» y es
 * `Record<tipo, dibujo>` a propósito — un tipo, un dibujo. Estas pruebas fijan
 * la otra pregunta, la que ese registro no puede contestar sin romperse:
 * «¿cómo se ve el tablón que va en la punta de un puente?». Y sobre todo fijan
 * que contestar la segunda no borra la primera: el tablón suelto tiene que
 * seguir viéndose como el día que lo dibujó.
 */

/** Un dibujo cualquiera pero legal: mitad lleno, sobrado de tinta. */
function anyGlyph(fill = '1'): string[] {
  return Array.from({ length: GLYPH_SIZE }, (_, y) =>
    y < GLYPH_SIZE / 2 ? fill.repeat(GLYPH_SIZE) : '0'.repeat(GLYPH_SIZE),
  );
}

const PUENTE: Blueprint = {
  id: 'puente',
  placements: [
    { kind: 'tablon', offset: { x: -1, y: 0 } },
    { kind: 'tablon', offset: { x: 1, y: 0 } },
  ],
};

function bridgeWorld() {
  const world = createWorld({ width: 8, height: 6, seed: 1 }, { blueprints: [PUENTE] });
  const pet = spawn(world, 'pet', {
    position: { x: 3, y: 2 },
    collider: { solid: true },
    inventory: { items: [], capacity: 4 },
  });
  return { world, petId: pet.id };
}

describe('la puerta de los dibujos de obra', () => {
  it('la misma pieza en dos celdas son dos dibujos distintos, y eso es el punto', () => {
    const result = validateWorkGlyphs(
      {
        blueprintId: 'puente',
        pieces: [
          { offset: { x: -1, y: 0 }, rows: anyGlyph('1') },
          { offset: { x: 1, y: 0 }, rows: anyGlyph('2') },
        ],
      },
      PUENTE,
    );
    expect(result.ok).toBe(true);
  });

  it('rechaza una celda que el plano no tiene', () => {
    const result = validateWorkGlyphs(
      { blueprintId: 'puente', pieces: [{ offset: { x: 5, y: 5 }, rows: anyGlyph() }] },
      PUENTE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('no tiene la celda');
  });

  it('rechaza la misma celda dibujada dos veces', () => {
    const result = validateWorkGlyphs(
      {
        blueprintId: 'puente',
        pieces: [
          { offset: { x: 1, y: 0 }, rows: anyGlyph('1') },
          { offset: { x: 1, y: 0 }, rows: anyGlyph('2') },
        ],
      },
      PUENTE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('dos veces');
  });

  it('acepta ilustrar solo parte de la obra: lo que falte cae al dibujo suelto', () => {
    const result = validateWorkGlyphs(
      { blueprintId: 'puente', pieces: [{ offset: { x: 1, y: 0 }, rows: anyGlyph() }] },
      PUENTE,
    );
    expect(result.ok).toBe(true);
  });
});

describe('el mundo guarda el aspecto de una obra sin tocar el de sus piezas', () => {
  it('acepta los dibujos y los deja consultables por celda', () => {
    const { world, petId } = bridgeWorld();
    stepWorld(world, [
      {
        actorId: petId,
        intent: {
          type: 'proposeWorkGlyphs',
          blueprintId: 'puente',
          glyphs: {
            blueprintId: 'puente',
            pieces: [
              { offset: { x: -1, y: 0 }, rows: anyGlyph('1') },
              { offset: { x: 1, y: 0 }, rows: anyGlyph('2') },
            ],
          },
        },
      },
    ]);
    expect(workGlyphFor(world.workGlyphs, 'puente', { x: -1, y: 0 })).toEqual(anyGlyph('1'));
    expect(workGlyphFor(world.workGlyphs, 'puente', { x: 1, y: 0 })).toEqual(anyGlyph('2'));
    // Y el registro de siempre queda intacto: el tablón suelto no cambió.
    expect(world.glyphs['tablon']).toBeUndefined();
  });

  it('no ilustra un plano que no conoce', () => {
    const { world, petId } = bridgeWorld();
    const events = stepWorld(world, [
      {
        actorId: petId,
        intent: {
          type: 'proposeWorkGlyphs',
          blueprintId: 'castillo',
          glyphs: { blueprintId: 'castillo', pieces: [] },
        },
      },
    ]);
    expect(events.some((e) => e.type === 'workGlyphs.rejected')).toBe(true);
    expect(world.workGlyphs['castillo']).toBeUndefined();
  });

  it('sobrevive al guardado, y un guardado viejo restaura sin ninguno', () => {
    const { world, petId } = bridgeWorld();
    stepWorld(world, [
      {
        actorId: petId,
        intent: {
          type: 'proposeWorkGlyphs',
          blueprintId: 'puente',
          glyphs: {
            blueprintId: 'puente',
            pieces: [{ offset: { x: 1, y: 0 }, rows: anyGlyph('3') }],
          },
        },
      },
    ]);
    const restored = restoreSnapshot(takeSnapshot(world));
    expect(workGlyphFor(restored.workGlyphs, 'puente', { x: 1, y: 0 })).toEqual(anyGlyph('3'));

    // Un mundo anterior a esto no trae el campo y tiene que restaurar igual.
    const old = takeSnapshot(world) as unknown as { state: Record<string, unknown> };
    delete old.state['workGlyphs'];
    expect(restoreSnapshot(old as never).workGlyphs).toEqual({});
  });
});

describe('una pieza sabe de qué obra es parte, y deja de saberlo al salir', () => {
  it('colocar con `partOf` deja la marca escrita en la pieza', () => {
    const { world, petId } = bridgeWorld();
    const tablon = spawn(world, 'tablon', { position: { x: 3, y: 3 }, portable: {} });
    stepWorld(world, [{ actorId: petId, intent: { type: 'pickup', targetId: tablon.id } }]);
    stepWorld(world, [
      {
        actorId: petId,
        intent: {
          type: 'place',
          itemId: tablon.id,
          at: { x: 4, y: 2 },
          partOf: { blueprintId: 'puente', offset: { x: 1, y: 0 } },
        },
      },
    ]);
    expect(world.entities[tablon.id]?.components.partOfWork).toEqual({
      blueprintId: 'puente',
      offset: { x: 1, y: 0 },
    });
  });

  it('colocar algo suelto no le inventa ninguna pertenencia', () => {
    const { world, petId } = bridgeWorld();
    const piedra = spawn(world, 'piedra', { position: { x: 3, y: 3 }, portable: {} });
    stepWorld(world, [{ actorId: petId, intent: { type: 'pickup', targetId: piedra.id } }]);
    stepWorld(world, [
      { actorId: petId, intent: { type: 'place', itemId: piedra.id, at: { x: 4, y: 2 } } },
    ]);
    expect(world.entities[piedra.id]?.components.partOfWork).toBeUndefined();
  });
});
