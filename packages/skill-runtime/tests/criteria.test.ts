import { describe, expect, it } from 'vitest';
import { describeCriterion, validateSuccessCriteria } from '../src/index.js';

/**
 * Los criterios de éxito de un contrato son tan poco confiables como un
 * programa cuando vienen de un modelo: definen la vara con la que el evaluador
 * juzga, así que un criterio inmedible o trivial equivaldría a aprobarse solo.
 */

describe('validateSuccessCriteria', () => {
  it('acepta criterios bien formados y los devuelve tipados', () => {
    const result = validateSuccessCriteria([
      { type: 'minMoves', value: 4 },
      { type: 'returnedToStart' },
      { type: 'consumedKind', kind: 'food' },
    ]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toHaveLength(3);
  });

  it('rechaza un criterio sin el dato que el evaluador necesita para medirlo', () => {
    expect(validateSuccessCriteria([{ type: 'consumedKind' }]).ok).toBe(false);
    expect(validateSuccessCriteria([{ type: 'minMoves' }]).ok).toBe(false);
    // Y también el dato de más: un tipo sin kind no puede traer uno.
    expect(validateSuccessCriteria([{ type: 'returnedToStart', kind: 'food' }]).ok).toBe(false);
  });

  it('rechaza tipos inventados y valores fuera de rango', () => {
    expect(validateSuccessCriteria([{ type: 'esBonito' }]).ok).toBe(false);
    expect(validateSuccessCriteria([{ type: 'minMoves', value: 0 }]).ok).toBe(false);
    expect(validateSuccessCriteria([{ type: 'minMoves', value: 5000 }]).ok).toBe(false);
    expect(validateSuccessCriteria([{ type: 'minMoves', value: 2.5 }]).ok).toBe(false);
  });

  it('rechaza una lista vacía: un contrato sin criterios lo cumple cualquiera', () => {
    expect(validateSuccessCriteria([]).ok).toBe(false);
    expect(validateSuccessCriteria(null).ok).toBe(false);
    expect(validateSuccessCriteria('minMoves').ok).toBe(false);
  });

  it('rechaza un contrato que solo acota el costo: no describe ningún logro', () => {
    const result = validateSuccessCriteria([
      { type: 'maxTicks', value: 50 },
      { type: 'maxIntents', value: 20 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('logro observable');
    // Con un logro de verdad al lado, las cotas sí valen.
    expect(
      validateSuccessCriteria([{ type: 'maxTicks', value: 50 }, { type: 'returnedToStart' }]).ok,
    ).toBe(true);
  });

  it('rechaza criterios repetidos', () => {
    const result = validateSuccessCriteria([
      { type: 'minMoves', value: 4 },
      { type: 'minMoves', value: 8 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('repetidos');
  });
});

describe('describeCriterion', () => {
  it('pone el contrato en palabras que el cuidador puede leer', () => {
    expect(describeCriterion({ type: 'minMoves', value: 4 })).toBe(
      'hace al menos 4 movimientos efectivos',
    );
    expect(describeCriterion({ type: 'returnedToStart' })).toBe(
      'termina en la misma casilla donde empezó',
    );
    expect(describeCriterion({ type: 'consumedKind', kind: 'food' })).toBe(
      'consume un objeto de tipo food',
    );
  });
});
