import { describe, expect, it } from 'vitest';
import { SkillExecution } from '../src/index.js';
import type { Perception } from '@anima/sim-core';

/**
 * Juntar de más no es prolijidad: es un candado.
 *
 * El caso real, en la corrida del vado con el modelo de verdad. La obra pedía
 * tablones; cada tablón sale de 2 tablas, 1 pilote y 1 amarre. Ánima terminó
 * con 5 tablas y 1 pilote en 6 ranuras — le sobraban 3 tablas y le faltaba el
 * amarre, que son 4 piezas más y no tenía UNA sola mano libre.
 *
 * Y no se destrabó nunca: `makeRoom` protegía por TIPO, así que la quinta tabla
 * era tan intocable como la primera, no había nada que se creyera autorizada a
 * soltar, y cada `pickup` moría con «no me entra». Se la vio caminando el mismo
 * circuito de doce celdas indefinidamente.
 *
 * Lo que estas pruebas fijan: el excedente de un ingrediente es lastre, no
 * materia — y lo que la receta necesita sigue siendo sagrado.
 */

function held(kinds: string[]) {
  return kinds.map((kind, i) => ({ id: `i${i}`, kind, portable: true, held: true }));
}

function perceptionWith(kinds: string[], capacity = 6): Perception {
  return {
    tick: 1,
    self: {
      id: 'e1',
      position: { x: 0, y: 0 },
      heldItems: held(kinds),
      inventoryCapacity: capacity,
    },
    visibleEntities: [],
    bounds: { width: 8, height: 8 },
    recipes: [],
    interactions: [],
    blueprints: [],
    decompositions: [],
    drawnKinds: [],
    illustratedWorks: [],
  } as unknown as Perception;
}

/** Qué suelta (si suelta) el primer paso de un programa de un solo `makeRoom`. */
function dropped(op: unknown, kinds: string[]): string | null {
  const run = new SkillExecution([op] as never, 'e1');
  const out = run.next(perceptionWith(kinds));
  if (out.kind !== 'intent' || out.intent.type !== 'drop') return null;
  const index = Number(out.intent.itemId.slice(1));
  return kinds[index] ?? null;
}

describe('hacer lugar sabe cuánto hace falta, no solo de qué', () => {
  it('con las manos llenas de un ingrediente que sobra, suelta el excedente', () => {
    // 5 tablas + 1 pilote en 6 ranuras, para algo que pide 2 tablas y 1 pilote.
    const kinds = ['tabla', 'tabla', 'tabla', 'tabla', 'pilote', 'tabla'];
    const suelta = dropped(
      { op: 'makeRoom', keep: ['tabla', 'pilote', 'amarre'], atMost: { tabla: 2, pilote: 1, amarre: 1 } },
      kinds,
    );
    expect(suelta).toBe('tabla');
  });

  it('sin `atMost` se traba igual que antes: es lo que fija el arreglo', () => {
    const kinds = ['tabla', 'tabla', 'tabla', 'tabla', 'pilote', 'tabla'];
    const suelta = dropped({ op: 'makeRoom', keep: ['tabla', 'pilote', 'amarre'] }, kinds);
    expect(suelta).toBeNull();
  });

  it('nunca suelta lo que la receta necesita de verdad', () => {
    // Justo lo que pide, ni uno de más: no hay excedente que soltar.
    const kinds = ['tabla', 'tabla', 'pilote', 'amarre'];
    const suelta = dropped(
      {
        op: 'makeRoom',
        keep: ['tabla', 'pilote', 'amarre'],
        atMost: { tabla: 2, pilote: 1, amarre: 1 },
      },
      kinds,
    );
    expect(suelta).toBeNull();
  });

  it('lo inútil se suelta antes que el excedente de lo útil', () => {
    const kinds = ['tabla', 'tabla', 'tabla', 'piedra', 'pilote', 'amarre'];
    const suelta = dropped(
      {
        op: 'makeRoom',
        keep: ['tabla', 'pilote', 'amarre'],
        atMost: { tabla: 2, pilote: 1, amarre: 1 },
      },
      kinds,
    );
    expect(suelta).toBe('piedra');
  });

  it('con lugar de sobra no suelta nada, aunque le sobren tablas', () => {
    const kinds = ['tabla', 'tabla', 'tabla'];
    const suelta = dropped(
      { op: 'makeRoom', keep: ['tabla'], atMost: { tabla: 2 } },
      kinds,
    );
    expect(suelta).toBeNull();
  });
});
