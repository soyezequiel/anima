import { describe, expect, it } from 'vitest';
import { createEventLog } from '@anima/shared';
import { ScriptedModelProvider, reachBlockedResourceProgram } from '@anima/model-providers';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import type { AgentEvent } from '../src/index.js';
import { developSkill } from '../src/index.js';

const now = () => '2026-07-16T00:00:00Z';

function devConfig(provider: ScriptedModelProvider) {
  return {
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    scenarios: MVP_SCENARIOS,
    seeds: [11, 22, 33],
    maxTicksPerCase: 200,
    maxVersions: 2,
    now,
  };
}

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
