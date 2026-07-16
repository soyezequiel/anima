import { describe, expect, it } from 'vitest';
import { getEntity, spawn } from '@anima/sim-core';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { reachBlockedResourceProgram, ScriptedModelProvider } from '@anima/model-providers';
import { foodBehindWall, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, GOAL_RESTORE_ENERGY, runAgentInWorld } from '../src/index.js';

/**
 * Atribución semántica de evidencia (cierre de la limitación del ADR 0011):
 * comer solo respalda hipótesis que hablen de comer. Si el modelo interpretó
 * la señal como "dormir recupera energía", esa hipótesis NO se confirma por
 * comidas; la mascota forma la suya propia por observación directa.
 */
describe('atribución semántica de evidencia', () => {
  it('una interpretación equivocada no se confirma comiendo', async () => {
    const provider = new ScriptedModelProvider([
      {
        kind: 'interpretation',
        hypothesis: 'dormir un rato podría recuperar la energía',
        confidence: 0.6,
      },
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'ir por la herramienta más fuerte',
      },
    ]);
    const agent = new AnimaAgent({
      petId: 'e1',
      petName: 'Anima',
      provider,
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      evaluationSeeds: [11, 22, 33],
      guidanceEnabled: true,
      now: () => '2026-07-16T00:00:00Z',
    });
    const bundle = foodBehindWall.build(5);

    await runAgentInWorld(bundle.world, agent, {
      maxTicks: 300,
      stopWhen: (_w, a) => a.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed',
    });

    const hypotheses = agent.memory.hypothesisList();
    const wrong = hypotheses.find((h) => h.statement.includes('dormir'))!;
    const canonical = hypotheses.find((h) =>
      h.statement.includes('consumir alimento recupera energía'),
    )!;

    // La equivocada solo tiene la evidencia inicial de la interpretación.
    expect(wrong.resolved).toBe('pending');
    expect(wrong.positiveEvidence).toBeLessThanOrEqual(1);
    // La correcta nació de la observación directa y acumuló el crédito.
    expect(canonical.positiveEvidence).toBeGreaterThanOrEqual(2);

    // Segundo ciclo de hambre: come otra vez y la correcta se confirma.
    const pet = getEntity(bundle.world, 'e1')!;
    pet.components.energy!.current = 12;
    spawn(bundle.world, 'food', {
      position: { x: 7, y: 1 },
      portable: {},
      edible: {},
      nutrition: { value: 30 },
    });
    await runAgentInWorld(bundle.world, agent, {
      maxTicks: 120,
      stopWhen: (_w, a) =>
        a.goals.all().filter((g) => g.description === GOAL_RESTORE_ENERGY && g.status === 'completed')
          .length >= 2,
    });

    expect(canonical.resolved).toBe('confirmed');
    expect(agent.memory.factList().map((f) => f.statement)).toContain(
      'consumir alimento recupera energía',
    );
    expect(wrong.resolved).toBe('pending');
    // Y no volvió a consultar al modelo para nada de esto.
    expect(provider.remaining()).toBe(0);
  });
});
