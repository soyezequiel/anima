import { describe, expect, it, vi } from 'vitest';
import type { SkillDefinition } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import {
  cachingEvaluator,
  evaluationCacheKey,
  inProcessEvaluator,
  type EvaluationRequest,
  type EvaluatorPort,
} from '../src/index.js';

function skill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    id: 'skill-1',
    name: 'comer',
    version: 1,
    status: 'experimental',
    description: 'comer algo',
    motivation: 'hambre',
    inputsSchema: {},
    preconditions: [],
    program: [{ op: 'wait', ticks: 1 }],
    expectedOutcome: 'come',
    successCriteria: [{ type: 'energyIncreased' }],
    safetyInvariants: [],
    dependencies: [],
    metrics: { totalRuns: 0, successfulRuns: 0 },
    knownFailures: [],
    createdAt: '2026-07-25T00:00:00Z',
    ...overrides,
  } as SkillDefinition;
}

function request(overrides: Partial<EvaluationRequest> = {}): EvaluationRequest {
  return {
    skill: skill(),
    scenarioNames: MVP_SCENARIOS.map((scenario) => scenario.name),
    seeds: [1, 2],
    regressions: [],
    maxTicks: 20,
    ...overrides,
  };
}

describe('el puerto de evaluación', () => {
  it('mide lo mismo que el evaluador de siempre, resolviendo en el acto', async () => {
    const port = inProcessEvaluator(MVP_SCENARIOS);
    const report = await port.evaluate(request());
    expect(report.skillName).toBe('comer');
    expect(report.cases.length).toBe(MVP_SCENARIOS.length * 2);
  });

  it('la huella cambia con el programa, con el criterio y con el banco de pruebas', () => {
    const base = evaluationCacheKey(request());
    expect(evaluationCacheKey(request())).toBe(base);
    expect(
      evaluationCacheKey(request({ skill: skill({ program: [{ op: 'wait', ticks: 2 }] }) })),
    ).not.toBe(base);
    expect(
      evaluationCacheKey(
        request({ skill: skill({ successCriteria: [{ type: 'noDamageTaken' }] }) }),
      ),
    ).not.toBe(base);
    expect(evaluationCacheKey(request({ seeds: [1, 2, 3] }))).not.toBe(base);
    // La versión NO entra: dos artefactos con el mismo programa y el mismo
    // contrato dan el mismo veredicto, y volver a correr cuarenta mundos para
    // reconfirmarlo es tiempo de vida de la mascota tirado.
    expect(evaluationCacheKey(request({ skill: skill({ id: 'skill-9', version: 4 }) }))).toBe(base);
  });

  it('no vuelve a medir lo que ya midió, y devuelve una copia', async () => {
    const inner = {
      evaluate: vi.fn(inProcessEvaluator(MVP_SCENARIOS).evaluate),
    } satisfies EvaluatorPort;
    const port = cachingEvaluator(inner);

    const first = await port.evaluate(request());
    const second = await port.evaluate(request());
    expect(inner.evaluate).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    // Copia y no la misma referencia: un informe cacheado es una lectura del
    // pasado, y quien lo reciba no debería alterar lo que verá el siguiente.
    expect(second).not.toBe(first);

    // Un programa distinto sí se mide de verdad.
    await port.evaluate(request({ skill: skill({ program: [{ op: 'wait', ticks: 3 }] }) }));
    expect(inner.evaluate).toHaveBeenCalledTimes(2);
  });

  it('un escenario que el puerto no conoce se omite en vez de inventarse', async () => {
    const port = inProcessEvaluator(MVP_SCENARIOS);
    const report = await port.evaluate(request({ scenarioNames: ['open-field', 'mundo-inventado'] }));
    expect(report.cases.every((testCase) => testCase.scenario === 'open-field')).toBe(true);
  });
});
