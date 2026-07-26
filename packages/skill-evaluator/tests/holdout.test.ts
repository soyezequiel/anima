import { describe, expect, it } from 'vitest';
import type { SkillDefinition, SkillProgram } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { applyEvaluation, evaluateSkill, RegressionStore, splitSeeds } from '../src/index.js';

/**
 * Aprender no es memorizar el examen.
 *
 * El ciclo de corrección le muestra al diseñador en qué mundo falló y le pide
 * otra versión. Ocho vueltas de eso, contra los MISMOS cuarenta mundos con los
 * que después se lo juzga, y lo que sale no es una habilidad que funcione: es
 * una que aprendió esos cuarenta. Luce perfecta, se promueve, y se rompe en el
 * primero que no estaba en la lista.
 *
 * La reserva corta eso por lo sano: un cuarto de los mundos se mide igual y
 * cuenta para promover, pero sus observaciones nunca vuelven al diseñador.
 */

const EAT: SkillProgram = [
  { op: 'findEntities', query: { edible: true }, store: 'food' },
  { op: 'selectTarget', from: 'food', strategy: 'nearest', store: 'meal' },
  { op: 'moveToward', target: 'meal', maxSteps: 30 },
  { op: 'consume', target: 'meal' },
];

function library(): { library: SkillLibrary; skill: SkillDefinition } {
  const lib = new SkillLibrary();
  const skill = lib.addExperimental({
    name: 'comer',
    description: 'comer algo',
    motivation: 'hambre',
    program: EAT,
    expectedOutcome: 'come',
    successCriteria: [{ type: 'energyIncreased' }],
    createdAt: '2026-07-25T00:00:00Z',
  });
  return { library: lib, skill };
}

describe('mundos de práctica y mundos reservados', () => {
  it('reparte la grilla de forma determinista y sin solaparse', () => {
    const { practice, holdout } = splitSeeds(7, 20);
    expect(practice).toHaveLength(15);
    expect(holdout).toHaveLength(5);
    expect(new Set([...practice, ...holdout]).size).toBe(20);
    // La misma partida da siempre el mismo reparto: barajarlo en cada
    // evaluación dejaría que, versión tras versión, el diseñador los viera
    // todos y la reserva dejara de reservar nada.
    expect(splitSeeds(7, 20)).toEqual({ practice, holdout });
    expect(splitSeeds(8, 20).holdout).not.toEqual(holdout);
  });

  it('los reservados se miden y se cuentan aparte', () => {
    const { skill } = library();
    const report = evaluateSkill(skill, {
      scenarios: MVP_SCENARIOS,
      seeds: [1, 2, 3],
      holdoutSeeds: [90, 91],
      maxTicks: 60,
    });

    const holdoutCases = report.cases.filter((testCase) => testCase.holdout === true);
    expect(holdoutCases).toHaveLength(MVP_SCENARIOS.length * 2);
    expect(report.holdoutConclusiveCases).toBeGreaterThan(0);
    expect(report.holdoutSuccessRate).not.toBeNull();
  });

  it('lo que falló en un mundo reservado NO vuelve al diseñador', () => {
    const { skill } = library();
    // Un programa que aborta siempre: todos los casos fallan, así se puede ver
    // de dónde salen (y de dónde no salen) las observaciones.
    skill.program = [{ op: 'abort', reason: 'a-proposito' }];
    const report = evaluateSkill(skill, {
      scenarios: MVP_SCENARIOS,
      seeds: [1],
      holdoutSeeds: [90],
      maxTicks: 20,
    });

    const failedHoldout = report.cases.filter(
      (testCase) => testCase.holdout === true && testCase.verdict === 'failed',
    );
    expect(failedHoldout.length).toBeGreaterThan(0);
    // Sus observaciones existen en el caso —el veredicto es completo— pero no
    // se agregan al resumen con el que se pide la corrección.
    expect(failedHoldout[0]!.observations.length).toBeGreaterThan(0);
    const practiceObservations = report.cases
      .filter((testCase) => testCase.holdout !== true && testCase.verdict === 'failed')
      .flatMap((testCase) => testCase.observations);
    expect(report.failureObservations.sort()).toEqual([...new Set(practiceObservations)].sort());
  });

  it('sin reservados, no se afirma nada sobre ellos', () => {
    const { skill } = library();
    const report = evaluateSkill(skill, { scenarios: MVP_SCENARIOS, seeds: [1], maxTicks: 40 });
    expect(report.holdoutSuccessRate).toBeNull();
    expect(report.holdoutConclusiveCases).toBe(0);
  });

  it('no se promueve lo que funciona donde la corrigieron y falla donde no', () => {
    const { library: lib, skill } = library();
    const report = evaluateSkill(skill, { scenarios: MVP_SCENARIOS, seeds: [1], maxTicks: 60 });
    // Se fuerza el caso que importa: perfecta en práctica, floja en reserva.
    const rigged = {
      ...report,
      successRate: 1,
      invariantViolations: 0,
      holdoutSuccessRate: 0.6,
      holdoutConclusiveCases: 5,
      cases: report.cases.map((testCase) => ({ ...testCase, verdict: 'passed' as const })),
    };

    const decision = applyEvaluation(skill, rigged, lib, new RegressionStore(), {
      now: () => '2026-07-25T00:00:00Z',
    });

    expect(decision.verdict).toBe('rejected');
    expect(decision.reasons.join(' ')).toContain('mundos reservados');
    expect(lib.findStable('comer')).toBeUndefined();
  });
});
