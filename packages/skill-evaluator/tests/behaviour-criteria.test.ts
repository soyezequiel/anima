import { describe, expect, it } from 'vitest';
import { practiceRoom } from '@anima/test-scenarios';
import type { EvaluationCriterion, SkillProgram } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { evaluateSkill } from '../src/index.js';

/**
 * Criterios de conducta. Sin ellos el evaluador solo sabía juzgar habilidades
 * sobre recursos (comer, energía), así que cualquier cosa que el cuidador
 * quisiera enseñar —un baile, una ronda, una retirada— era imposible de
 * aprobar por más bien hecha que estuviera.
 */

const SEEDS = [11, 22];

function evaluate(program: SkillProgram, successCriteria: EvaluationCriterion[]) {
  const library = new SkillLibrary();
  const skill = library.addExperimental({
    name: 'conducta',
    description: 'una conducta cualquiera',
    motivation: 'prueba',
    program,
    expectedOutcome: 'la conducta ocurre',
    successCriteria,
    createdAt: '2026-07-16T00:00:00Z',
  });
  return evaluateSkill(skill, {
    scenarios: [practiceRoom],
    seeds: SEEDS,
    maxTicks: 60,
    library,
  });
}

const DANCE: SkillProgram = [
  { op: 'moveStep', dir: 'right' },
  { op: 'moveStep', dir: 'left' },
  { op: 'moveStep', dir: 'right' },
  { op: 'moveStep', dir: 'left' },
];

describe('criterios de conducta', () => {
  it('aprueba un baile: se mueve lo pedido y vuelve al punto de partida', () => {
    const report = evaluate(DANCE, [{ type: 'minMoves', value: 4 }, { type: 'returnedToStart' }]);
    expect(report.successRate).toBe(1);
  });

  it('quedarse quieto no cuenta como bailar', () => {
    const report = evaluate([{ op: 'wait', ticks: 4 }], [
      { type: 'minMoves', value: 4 },
      { type: 'returnedToStart' },
    ]);
    expect(report.successRate).toBe(0);
    expect(report.failureObservations).toContain('criteria-failed:minMoves');
    // La medición vuelve al diseñador: sin ella, revisaría a ciegas.
    expect(report.failureObservations).toContain('moves-made:0');
  });

  it('irse y no volver tampoco: returnedToStart distingue un baile de una caminata', () => {
    const walkAway: SkillProgram = [
      { op: 'moveStep', dir: 'right' },
      { op: 'moveStep', dir: 'right' },
      { op: 'moveStep', dir: 'right' },
      { op: 'moveStep', dir: 'right' },
    ];
    const report = evaluate(walkAway, [
      { type: 'minMoves', value: 4 },
      { type: 'returnedToStart' },
    ]);
    expect(report.successRate).toBe(0);
    expect(report.failureObservations).toContain('criteria-failed:returnedToStart');
    expect(report.failureObservations).toContain('net-displacement:4');
  });

  it('netDisplacementAtLeast mide alejarse de verdad, no ir y volver', () => {
    const away: SkillProgram = [
      { op: 'moveStep', dir: 'right' },
      { op: 'moveStep', dir: 'right' },
      { op: 'moveStep', dir: 'right' },
    ];
    expect(evaluate(away, [{ type: 'netDisplacementAtLeast', value: 3 }]).successRate).toBe(1);
    expect(evaluate(DANCE, [{ type: 'netDisplacementAtLeast', value: 3 }]).successRate).toBe(0);
  });

  it('visitedDistinctCells no se deja engañar por ir y volver sobre lo mismo', () => {
    // El baile pisa 2 casillas distintas aunque haga 4 movimientos.
    expect(evaluate(DANCE, [{ type: 'visitedDistinctCells', value: 2 }]).successRate).toBe(1);
    expect(evaluate(DANCE, [{ type: 'visitedDistinctCells', value: 4 }]).successRate).toBe(0);
  });

  it('holdingKind comprueba lo que terminó llevando, no lo que pasó cerca', () => {
    const fetchHammer: SkillProgram = [
      { op: 'findEntities', query: { kind: 'hammer' }, store: 'tools' },
      { op: 'selectTarget', from: 'tools', strategy: 'nearest', store: 'tool' },
      { op: 'moveToward', target: 'tool', maxSteps: 20 },
      { op: 'pickup', target: 'tool' },
    ];
    expect(evaluate(fetchHammer, [{ type: 'holdingKind', kind: 'hammer' }]).successRate).toBe(1);
    // Llegar al lado no es llevarlo.
    const walkToHammer: SkillProgram = [
      { op: 'findEntities', query: { kind: 'hammer' }, store: 'tools' },
      { op: 'selectTarget', from: 'tools', strategy: 'nearest', store: 'tool' },
      { op: 'moveToward', target: 'tool', maxSteps: 20 },
    ];
    expect(evaluate(walkToHammer, [{ type: 'holdingKind', kind: 'hammer' }]).successRate).toBe(0);
  });

  it('un movimiento bloqueado no cuenta como movimiento hecho', () => {
    // Contra el borde izquierdo del mundo: la intención existe, el paso no.
    const intoTheEdge: SkillProgram = [
      { op: 'moveStep', dir: 'left' },
      { op: 'moveStep', dir: 'left' },
      { op: 'moveStep', dir: 'left' },
      { op: 'moveStep', dir: 'left' },
      { op: 'moveStep', dir: 'left' },
      { op: 'moveStep', dir: 'left' },
    ];
    // La mascota arranca en x=5: solo 5 pasos son posibles, el sexto choca.
    expect(evaluate(intoTheEdge, [{ type: 'minMoves', value: 5 }]).successRate).toBe(1);
    expect(evaluate(intoTheEdge, [{ type: 'minMoves', value: 6 }]).successRate).toBe(0);
  });
});
