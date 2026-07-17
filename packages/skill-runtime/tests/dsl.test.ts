import { describe, expect, it } from 'vitest';
import { MAX_REPEAT_LIMIT, validateSkillProgram } from '../src/index.js';

describe('validación de la DSL', () => {
  it('acepta un programa válido', () => {
    const result = validateSkillProgram([
      { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
      { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
      { op: 'moveToward', target: 'food', maxSteps: 20 },
      { op: 'consume', target: 'food' },
    ]);
    expect(result.ok).toBe(true);
  });

  it('acepta explore con until sees, con los mismos límites de la repetición', () => {
    const ok = validateSkillProgram([
      {
        op: 'explore',
        maxSteps: 50,
        until: { type: 'sees', query: { kind: 'branch', held: false } },
      },
    ]);
    expect(ok.ok).toBe(true);

    const tooLong = validateSkillProgram([
      { op: 'explore', maxSteps: MAX_REPEAT_LIMIT + 1 },
    ]);
    expect(tooLong.ok).toBe(false);

    const emptyQuery = validateSkillProgram([
      { op: 'explore', maxSteps: 10, until: { type: 'sees', query: {} } },
    ]);
    expect(emptyQuery.ok).toBe(false);
  });

  it('rechaza operaciones fuera de la lista cerrada', () => {
    const result = validateSkillProgram([{ op: 'evalJavascript', code: 'alert(1)' }]);
    expect(result.ok).toBe(false);
  });

  it('rechaza propiedades extra en operaciones conocidas', () => {
    const result = validateSkillProgram([
      { op: 'wait', ticks: 1, sideEffect: 'fetch("http://x")' },
    ]);
    expect(result.ok).toBe(false);
  });

  it('rechaza repeticiones sin límite válido', () => {
    expect(
      validateSkillProgram([
        { op: 'repeatWithLimit', max: MAX_REPEAT_LIMIT + 1, body: [{ op: 'wait' }] },
      ]).ok,
    ).toBe(false);
    expect(
      validateSkillProgram([{ op: 'repeatWithLimit', max: 0, body: [{ op: 'wait' }] }]).ok,
    ).toBe(false);
    // Sin la propiedad max, directamente no valida.
    expect(validateSkillProgram([{ op: 'repeatWithLimit', body: [{ op: 'wait' }] }]).ok).toBe(
      false,
    );
  });

  it('rechaza anidamiento excesivo', () => {
    let program: unknown = [{ op: 'wait' }];
    for (let i = 0; i < 8; i++) {
      program = [{ op: 'branch', if: { type: 'always' }, then: program }];
    }
    const result = validateSkillProgram(program);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('profundidad');
  });

  it('rechaza programas vacíos', () => {
    expect(validateSkillProgram([]).ok).toBe(false);
  });
});
