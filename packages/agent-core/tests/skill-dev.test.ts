import { describe, expect, it } from 'vitest';
import { createEventLog } from '@anima/shared';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider, reachBlockedResourceProgram } from '@anima/model-providers';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import type { AgentEvent } from '../src/index.js';
import { developSkill } from '../src/index.js';

const now = () => '2026-07-16T00:00:00Z';

/** Guionado, pero conservando cada petición: para inspeccionar qué vio el modelo. */
class RecordingProvider extends ScriptedModelProvider {
  readonly seen: ModelRequest[] = [];

  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    return super.complete(request);
  }
}

function devConfig(provider: ScriptedModelProvider, maxVersions = 2) {
  return {
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    scenarios: MVP_SCENARIOS,
    seeds: [11, 22, 33],
    maxTicksPerCase: 200,
    maxVersions,
    now,
  };
}

/**
 * Aproximación directa: funciona en campo abierto y fracasa con el muro.
 * Sirve como "mejor versión parcial" (50%) en las pruebas del ciclo.
 */
const DIRECT_APPROACH = [
  { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
  { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
  { op: 'moveToward', target: 'food', maxSteps: 40 },
  { op: 'consume', target: 'food' },
];

/** No consume nada: fracasa en todos los mundos (0%). */
const DO_NOTHING = [{ op: 'wait', ticks: 2 }];

const CONTRACT = {
  name: 'alcanzar-alimento-bloqueado',
  purpose: 'llegar hasta el alimento y consumirlo',
  motivation: 'test',
  expectedOutcome: 'energía recuperada',
  successCriteria: [
    { type: 'consumedKind', kind: 'food' } as const,
    { type: 'energyIncreased' } as const,
  ],
};

describe('desarrollo de skills con propuestas inválidas', () => {
  it('un programa inválido no consume intento y el error vuelve como feedback', async () => {
    const provider = new ScriptedModelProvider([
      // Propuesta 1: inválida (op desconocida). No debe consumir intento.
      { kind: 'skill.program', program: [{ op: 'volar' }], rationale: 'v inválida' },
      // Revisión con el feedback de validación: válida y correcta.
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'corregida',
      },
    ]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider), events, 0);

    expect(outcome.stableSkill).not.toBeNull();
    expect(outcome.stableSkill?.version).toBe(1);
    // La segunda llamada fue una revisión que recibió el error de validación.
    expect(provider.callCount('skill.propose')).toBe(1);
    expect(provider.callCount('skill.revise')).toBe(1);
    const rejected = events.ofType('skill.rejected');
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.data.reason)).toContain('programa inválido');
  });

  it('corta tras varias propuestas inválidas seguidas (sin bucle)', async () => {
    const invalid = { kind: 'skill.program', program: { no: 'es-arreglo' }, rationale: '' } as const;
    const provider = new ScriptedModelProvider([invalid, invalid, invalid, invalid]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider), events, 0);
    expect(outcome.stableSkill).toBeNull();
    expect(events.ofType('skill.rejected').length).toBe(3);
    // Nunca llegó a simular nada.
    expect(events.ofType('skill.test.started')).toHaveLength(0);
  });
});

describe('el ciclo de revisión itera con memoria', () => {
  it('la revisión parte de la MEJOR versión, con historia y resultados por mundo', async () => {
    const provider = new RecordingProvider([
      // v1: parcial (pasa campo abierto, falla el muro).
      { kind: 'skill.program', program: DIRECT_APPROACH, rationale: 'directo' },
      // v2: peor que v1 (no consume nada en ningún mundo).
      { kind: 'skill.program', program: DO_NOTHING, rationale: 'esperar' },
      // v3: correcta.
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'romper el muro con la herramienta fuerte',
      },
    ]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, ['veo: hammer'], devConfig(provider, 4), events, 0);

    expect(outcome.stableSkill).not.toBeNull();
    expect(outcome.stableSkill?.version).toBe(3);

    const revisions = provider.seen.filter(
      (r): r is Extract<ModelRequest, { kind: 'skill.revise' }> => r.kind === 'skill.revise',
    );
    expect(revisions).toHaveLength(2);

    // Toda revisión conoce el objetivo, la vara y el contexto original.
    expect(revisions[0]?.problem).toBe(CONTRACT.purpose);
    expect(revisions[0]?.successCriteria?.length).toBeGreaterThan(0);
    expect(revisions[0]?.context).toEqual(['veo: hammer']);
    expect(revisions[0]?.maxAttempts).toBe(4);

    // La primera revisión ve dónde pasó y dónde falló la v1, mundo por mundo.
    const cases = revisions[0]?.caseResults ?? [];
    expect(cases.some((c) => c.verdict === 'passed')).toBe(true);
    expect(cases.some((c) => c.verdict === 'failed')).toBe(true);

    // La segunda revisión NO parte de la v2 (que empeoró): parte de la v1,
    // la mejor hasta ahora, y lleva la historia completa de lo intentado.
    expect(revisions[1]?.previousProgram).toEqual(DIRECT_APPROACH);
    expect(revisions[1]?.baseVersion).toBe(1);
    expect(revisions[1]?.history?.map((h) => h.version)).toEqual([1, 2]);
    expect(revisions[1]?.history?.[1]?.successRate).toBe(0);
  });

  it('una propuesta repetida vuelve como feedback sin gastar intento, y el ciclo sigue', async () => {
    const provider = new RecordingProvider([
      { kind: 'skill.program', program: DIRECT_APPROACH, rationale: 'directo' },
      // "Nueva" versión idéntica a la v1: antes esto mataba el ciclo.
      { kind: 'skill.program', program: DIRECT_APPROACH, rationale: 'insisto' },
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'ahora sí distinto',
      },
    ]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider, 4), events, 0);

    expect(outcome.stableSkill).not.toBeNull();
    // La repetición no consumió versión: la corrección real es la v2.
    expect(outcome.stableSkill?.version).toBe(2);

    const rejected = events.ofType('skill.rejected');
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.data.reason)).toContain('idéntica a la v1');

    // El feedback de repetición viajó al modelo en la revisión siguiente.
    const revisions = provider.seen.filter(
      (r): r is Extract<ModelRequest, { kind: 'skill.revise' }> => r.kind === 'skill.revise',
    );
    expect(
      revisions[1]?.failureObservations.some((o) => o.startsWith('propuesta-repetida')),
    ).toBe(true);
  });

  it('insistir con la misma propuesta agota los reintentos y corta el ciclo', async () => {
    const repeat = { kind: 'skill.program', program: DIRECT_APPROACH, rationale: '' } as const;
    const provider = new RecordingProvider([repeat, repeat, repeat, repeat]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider, 4), events, 0);

    expect(outcome.stableSkill).toBeNull();
    // Solo la primera se simuló; las tres repeticiones se rechazaron sin simular.
    expect(outcome.versionsTried).toBe(1);
    expect(events.ofType('skill.rejected')).toHaveLength(3);
    expect(events.ofType('skill.test.started')).toHaveLength(1);
  });
});
