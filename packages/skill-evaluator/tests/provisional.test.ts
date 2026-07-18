import { describe, expect, it } from 'vitest';
import type { EvaluationReport } from '../src/index.js';
import { SkillLibrary } from '@anima/skill-runtime';
import { applyEvaluation, RegressionStore } from '../src/index.js';

/**
 * ADR 0050. El umbral para promover es 100%, y está bien: una habilidad estable
 * se ejecuta después sin pensar, y una poco confiable es una trampa silenciosa.
 *
 * Pero tirar a la basura un programa que funciona 19 de cada 20 veces mientras
 * el frío que ese programa resuelve la está matando es peor. Una generación
 * murió congelada en el tick 1417 justo después de alcanzar por fin la versión
 * perfecta: tenía la solución en la mano y no la usaba.
 */

const now = () => '2026-07-18T00:00:00Z';

function makeSkill(library: SkillLibrary, name = 'conseguir-calor') {
  return library.addExperimental({
    name,
    description: 'entrar en calor',
    motivation: 'tengo frío',
    program: [{ op: 'wait', ticks: 1 }],
    expectedOutcome: 'sube la temperatura',
    successCriteria: [{ type: 'temperatureIncreased' }],
    criterionSource: 'motive',
    createdAt: now(),
  });
}

/** Un informe con la tasa pedida, sin correr mundos: acá se mide la POLÍTICA. */
function reportWith(
  successRate: number,
  options: { invariantViolations?: number; inconclusive?: number; cases?: number } = {},
): EvaluationReport {
  const total = options.cases ?? 20;
  const failed = Math.round(total * (1 - successRate));
  return {
    skillId: 'x',
    successRate,
    cases: Array.from({ length: total }, (_, i) => ({
      scenario: 'cold-night',
      seed: i,
      verdict: i < failed ? 'failed' : 'passed',
      observations: i < failed ? ['criteria-failed:temperatureIncreased'] : [],
      runOutcome: 'completed',
      fromRegression: false,
      ticks: 10,
      intents: 5,
    })),
    inconclusiveCases: options.inconclusive ?? 0,
    invariantViolations: options.invariantViolations ?? 0,
    failureObservations: ['criteria-failed:temperatureIncreased'],
  } as unknown as EvaluationReport;
}

describe('lo mejor que tengo mientras sigo puliendo (ADR 0050)', () => {
  it('una versión al 95% no se promueve, pero queda usable', () => {
    const library = new SkillLibrary();
    const skill = makeSkill(library);

    const decision = applyEvaluation(skill, reportWith(0.95), library, new RegressionStore(), {
      now,
    });

    // Sigue sin ser estable: la vara de lo probado no se toca.
    expect(decision.verdict).toBe('rejected');
    expect(library.findStable('conseguir-calor')).toBeUndefined();
    // Pero deja de ser basura: es lo mejor que tiene y puede usarla.
    expect(decision.provisional).toBe(true);
    expect(library.get(skill.id)?.status).toBe('provisional');
    expect(library.findUsable('conseguir-calor')?.id).toBe(skill.id);
  });

  it('lo que apenas funciona se archiva, como antes', () => {
    const library = new SkillLibrary();
    const skill = makeSkill(library);

    const decision = applyEvaluation(skill, reportWith(0.3), library, new RegressionStore(), {
      now,
    });

    expect(decision.provisional).toBeFalsy();
    expect(library.get(skill.id)?.status).toBe('archived');
    expect(library.findUsable('conseguir-calor')).toBeUndefined();
  });

  it('violar invariantes del mundo nunca es "usable", por buena que sea la tasa', () => {
    const library = new SkillLibrary();
    const skill = makeSkill(library);

    const decision = applyEvaluation(
      skill,
      reportWith(0.98, { invariantViolations: 1 }),
      library,
      new RegressionStore(),
      { now },
    );

    // Romper reglas del mundo no es "imperfecto", es inadmisible: usarlo por
    // urgencia sería el atajo que el evaluador independiente existe para
    // impedir.
    expect(decision.provisional).toBeFalsy();
    expect(library.get(skill.id)?.status).toBe('archived');
  });

  it('sin casos concluyentes no hay nada que guardar', () => {
    const library = new SkillLibrary();
    const skill = makeSkill(library);

    const decision = applyEvaluation(
      skill,
      reportWith(0, { inconclusive: 20, cases: 20 }),
      library,
      new RegressionStore(),
      { now },
    );

    // No es que fallara: es que el mundo no dejó medir. Guardar eso como "lo
    // mejor que tengo" sería inventar evidencia.
    expect(decision.provisional).toBeFalsy();
    expect(library.get(skill.id)?.status).toBe('archived');
  });

  it('la estable siempre le gana a la provisional', () => {
    const library = new SkillLibrary();
    const flojita = makeSkill(library);
    applyEvaluation(flojita, reportWith(0.9), library, new RegressionStore(), { now });
    expect(library.findUsable('conseguir-calor')?.id).toBe(flojita.id);

    const buena = makeSkill(library);
    applyEvaluation(buena, reportWith(1), library, new RegressionStore(), { now });

    expect(library.findStable('conseguir-calor')?.id).toBe(buena.id);
    expect(library.findUsable('conseguir-calor')?.id).toBe(buena.id);
  });

  it('entre provisionales gana la que mejor midió, no la más nueva', () => {
    const library = new SkillLibrary();
    const mejor = makeSkill(library);
    applyEvaluation(mejor, reportWith(0.95), library, new RegressionStore(), { now });
    const peor = makeSkill(library);
    applyEvaluation(peor, reportWith(0.7), library, new RegressionStore(), { now });

    // Una v2 que empeoró no destrona a la v1: "lo mejor que tengo" es lo mejor
    // medido, no lo último intentado.
    expect(library.findUsable('conseguir-calor')?.id).toBe(mejor.id);
    expect(library.get(peor.id)?.status).toBe('archived');
  });
});
