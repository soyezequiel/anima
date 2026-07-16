import { describe, expect, it } from 'vitest';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import type { SkillProgram } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { applyEvaluation, evaluateSkill, RegressionStore } from '../src/index.js';

const now = () => '2026-07-16T00:00:00Z';
const SEEDS = [11, 22, 33];

/** Estrategia defectuosa: elige la herramienta más cercana (la rama débil). */
function reachFoodProgram(strategy: 'nearest' | 'strongestTool'): SkillProgram {
  return [
    { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
    { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
    { op: 'moveToward', target: 'food', maxSteps: 30 },
    {
      op: 'branch',
      if: { type: 'lastMoveBlocked' },
      then: [
        { op: 'findEntities', query: { tool: true }, store: 'tools' },
        { op: 'selectTarget', from: 'tools', strategy, store: 'tool' },
        { op: 'moveToward', target: 'tool', maxSteps: 30 },
        { op: 'pickup', target: 'tool' },
        { op: 'findEntities', query: { kind: 'wall' }, store: 'walls' },
        { op: 'selectTarget', from: 'walls', strategy: 'nearest', store: 'wall' },
        { op: 'moveToward', target: 'wall', maxSteps: 30 },
        {
          op: 'repeatWithLimit',
          max: 6,
          until: { type: 'entityGone', ref: 'wall' },
          body: [{ op: 'useItem', item: 'tool', target: 'wall' }],
        },
        { op: 'moveToward', target: 'food', maxSteps: 30 },
      ],
    },
    { op: 'consume', target: 'food' },
  ];
}

function makeSkill(library: SkillLibrary, strategy: 'nearest' | 'strongestTool', parentId?: string) {
  return library.addExperimental(
    {
      name: 'alcanzar-alimento-bloqueado',
      description: 'Llega hasta el alimento aunque haya un obstáculo y lo consume',
      motivation: 'el camino directo al alimento falló repetidamente',
      program: reachFoodProgram(strategy),
      expectedOutcome: 'la energía de la mascota aumenta tras consumir el alimento',
      successCriteria: [
        { type: 'consumedKind', kind: 'food' },
        { type: 'energyIncreased' },
      ],
      createdAt: now(),
    },
    parentId,
  );
}

describe('evaluador de skills', () => {
  it('rechaza la v1 defectuosa y conserva los fallos como regresiones', () => {
    const library = new SkillLibrary();
    const regressions = new RegressionStore();
    const v1 = makeSkill(library, 'nearest');

    const report = evaluateSkill(v1, { scenarios: MVP_SCENARIOS, seeds: SEEDS, maxTicks: 200 });
    // Funciona en campo abierto pero fracasa con el muro.
    expect(report.successRate).toBeGreaterThan(0);
    expect(report.successRate).toBeLessThan(1);
    expect(report.failureObservations.some((o) => o.startsWith('no-damage-dealt'))).toBe(true);

    const decision = applyEvaluation(v1, report, library, regressions, { now });
    expect(decision.verdict).toBe('rejected');
    expect(decision.regressionsAdded).toBeGreaterThan(0);
    expect(library.get(v1.id)?.status).toBe('archived');
    expect(regressions.forSkill(v1.name).length).toBeGreaterThan(0);
    expect(regressions.forSkill(v1.name).every((r) => r.scenarioName === 'food-behind-wall')).toBe(
      true,
    );
  });

  it('promueve la v2 corregida tras superar también las regresiones', () => {
    const library = new SkillLibrary();
    const regressions = new RegressionStore();
    const v1 = makeSkill(library, 'nearest');
    const reportV1 = evaluateSkill(v1, { scenarios: MVP_SCENARIOS, seeds: SEEDS, maxTicks: 200 });
    applyEvaluation(v1, reportV1, library, regressions, { now });

    const v2 = makeSkill(library, 'strongestTool', v1.id);
    expect(v2.version).toBe(2);
    const reportV2 = evaluateSkill(v2, {
      scenarios: MVP_SCENARIOS,
      seeds: SEEDS,
      regressions: regressions.forSkill(v2.name),
      maxTicks: 200,
    });
    expect(reportV2.successRate).toBe(1);

    const decision = applyEvaluation(v2, reportV2, library, regressions, {
      now,
      baseline: reportV1,
    });
    expect(decision.verdict).toBe('promoted');
    expect(library.get(v2.id)?.status).toBe('stable');
    expect(library.findStable('alcanzar-alimento-bloqueado')?.id).toBe(v2.id);
  });

  it('la evaluación es reproducible: dos corridas dan el mismo reporte', () => {
    const library = new SkillLibrary();
    const skill = makeSkill(library, 'strongestTool');
    const a = evaluateSkill(skill, { scenarios: MVP_SCENARIOS, seeds: SEEDS, maxTicks: 200 });
    const b = evaluateSkill(skill, { scenarios: MVP_SCENARIOS, seeds: SEEDS, maxTicks: 200 });
    expect(a.cases).toEqual(b.cases);
    expect(a.successRate).toEqual(b.successRate);
  });

  it('una nueva versión que empeora a la anterior no se promueve', () => {
    const library = new SkillLibrary();
    const regressions = new RegressionStore();
    const good = makeSkill(library, 'strongestTool');
    const goodReport = evaluateSkill(good, { scenarios: MVP_SCENARIOS, seeds: SEEDS, maxTicks: 200 });
    applyEvaluation(good, goodReport, library, regressions, { now });

    const worse = makeSkill(library, 'nearest', good.id);
    const worseReport = evaluateSkill(worse, { scenarios: MVP_SCENARIOS, seeds: SEEDS, maxTicks: 200 });
    const decision = applyEvaluation(worse, worseReport, library, regressions, {
      now,
      baseline: goodReport,
    });
    expect(decision.verdict).toBe('rejected');
    // La versión estable sigue siendo la buena.
    expect(library.findStable('alcanzar-alimento-bloqueado')?.id).toBe(good.id);
  });
});
