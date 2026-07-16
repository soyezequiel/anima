import { describe, expect, it } from 'vitest';
import { spawn } from '@anima/sim-core';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { MockModelProvider } from '@anima/model-providers';
import { foodBehindWall, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, GOAL_RESTORE_ENERGY, runAgentInWorld } from '../src/index.js';

/**
 * Cuando el problema es la falta del recurso (no de capacidad), crear una
 * habilidad no ayuda: la mascota pide ayuda, suspende, y reactiva el objetivo
 * cuando el entorno cambia.
 */
describe('recurso faltante', () => {
  it('sin comida: pide ayuda sin fabricar skills, suspende y se reactiva al reaparecer alimento', async () => {
    const provider = new MockModelProvider();
    const bundle = foodBehindWall.build(5);
    // Un mundo sin nada comestible ni árbol que produzca.
    for (const entity of Object.values(bundle.world.entities)) {
      if (entity.kind === 'food' || entity.kind === 'tree') {
        delete bundle.world.entities[entity.id];
      }
    }
    const agent = new AnimaAgent({
      petId: bundle.petId,
      petName: 'Anima',
      provider,
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      evaluationSeeds: [11, 22, 33],
      guidanceEnabled: true,
      now: () => '2026-07-16T00:00:00Z',
    });

    await runAgentInWorld(bundle.world, agent, {
      maxTicks: 100,
      stopWhen: (_w, a) => a.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'suspended',
    });

    const types = agent.events.events.map((e) => e.type);
    expect(types).toContain('help.requested');
    expect(types).toContain('goal.suspended');
    // No fabricó ninguna habilidad: el fallo era por recurso, no por capacidad.
    expect(provider.callCount('skill.propose')).toBe(0);
    expect(types).not.toContain('skill.requested');

    // El entorno cambia: aparece alimento a la vista, del lado de la mascota.
    spawn(bundle.world, 'food', {
      position: { x: 2, y: 2 },
      portable: {},
      edible: {},
      nutrition: { value: 30 },
    });
    await runAgentInWorld(bundle.world, agent, {
      maxTicks: 60,
      stopWhen: (_w, a) => a.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed',
    });

    expect(agent.events.events.map((e) => e.type)).toContain('goal.reactivated');
    expect(agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status).toBe('completed');
    // Sigue sin necesitar el modelo para nada de esto.
    expect(provider.callCount('skill.propose')).toBe(0);
  });
});
