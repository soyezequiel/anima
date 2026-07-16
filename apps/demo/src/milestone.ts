import { AnimaAgent, GOAL_RESTORE_ENERGY, runAgentInWorld, SKILL_REACH_BLOCKED_FOOD } from '@anima/agent-core';
import type { AgentEvent } from '@anima/agent-core';
import { MockModelProvider } from '@anima/model-providers';
import type { SimEvent, WorldState } from '@anima/sim-core';
import { getEntity } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import type { SkillDefinition } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { foodBehindWall, MVP_SCENARIOS } from '@anima/test-scenarios';

export interface MilestoneReport {
  success: boolean;
  ticks: number;
  energy: { initial: number; final: number };
  timeline: { tick: number; type: string; detail: string }[];
  skills: SkillDefinition[];
  regressions: { scenarioName: string; seed: number; description: string }[];
  facts: string[];
  hypotheses: { statement: string; confidence: number; resolved: string }[];
  petExplanation: string;
  modelCalls: { propose: number; revise: number; interpret: number };
}

const TIMELINE_AGENT_EVENTS = new Set<AgentEvent['type']>([
  'guidance.shown',
  'hypothesis.updated',
  'goal.created',
  'goal.selected',
  'goal.completed',
  'goal.suspended',
  'strategy.selected',
  'strategy.failed',
  'strategy.forbidden',
  'skill.requested',
  'skill.created',
  'skill.test.started',
  'skill.test.failed',
  'skill.test.passed',
  'skill.promoted',
  'skill.rejected',
  'skill.used',
  'memory.consolidated',
  'help.requested',
]);

const TIMELINE_WORLD_EVENTS = new Set<SimEvent['type']>([
  'energy.low',
  'entity.destroyed',
  'item.consumed',
  'agent.spoke',
  'pet.died',
]);

function describe(event: { type: string; data: Record<string, unknown> }): string {
  const d = event.data;
  switch (event.type) {
    case 'guidance.shown':
      return `experiencia guiada: ${String(d.hint)}`;
    case 'goal.selected':
      return `objetivo seleccionado: ${String(d.description)}`;
    case 'hypothesis.updated':
      if (d.statement === undefined) {
        return `evidencia ${String(d.evidence)} para la hipótesis (${String(d.source)})`;
      }
      return `hipótesis: "${String(d.statement)}" (confianza ${String(Math.round((d.confidence as number) * 100) / 100)})`;
    case 'goal.created':
      return `objetivo creado: ${String(d.description)} [${String(d.source)}]`;
    case 'goal.completed':
      return `objetivo completado con ${String(d.strategy)}`;
    case 'strategy.selected':
      return `estrategia: ${String(d.strategy)}`;
    case 'strategy.failed':
      return `estrategia fallida: ${String(d.strategy)} (${String(d.reason ?? d.outcome)})`;
    case 'strategy.forbidden':
      return `prohibido repetir sin cambios: ${String(d.strategy)}`;
    case 'skill.requested':
      return `necesita una habilidad: ${String(d.purpose)}`;
    case 'skill.created':
      return `candidata v${String(d.version)}: ${String(d.rationale)}`;
    case 'skill.test.started':
      return `evaluando v${String(d.version)} en ${String((d.scenarios as string[]).join(', '))} × semillas ${String((d.seeds as number[]).join(','))} (+${String(d.regressions)} regresiones)`;
    case 'skill.test.failed':
      return `v${String(d.version)} RECHAZADA (éxito ${String(Math.round((d.successRate as number) * 100))}%): ${String((d.observations as string[]).join('; '))}`;
    case 'skill.test.passed':
      return `v${String(d.version)} supera todas las pruebas (éxito ${String(Math.round((d.successRate as number) * 100))}%)`;
    case 'skill.promoted':
      return `PROMOVIDA a estable: ${String(d.name)} v${String(d.version)}`;
    case 'skill.used':
      return `habilidad usada en el mundo real (${d.success ? 'éxito' : 'fallo'})`;
    case 'item.consumed':
      return `consumió ${String(d.itemKind)}: energía ${String(Math.round((d.energyBefore as number) * 10) / 10)} -> ${String(Math.round((d.energyAfter as number) * 10) / 10)}`;
    case 'entity.destroyed':
      return `destruyó ${String(d.kind)}`;
    case 'agent.spoke':
      return `dice: "${String(d.text)}"`;
    case 'energy.low':
      return `señal del mundo: energía baja (${String(d.current)}/${String(d.max)})`;
    case 'memory.consolidated':
      return `memoria consolidada: ${String((d.confirmed as string[]).join('; '))}`;
    default:
      return JSON.stringify(d);
  }
}

/**
 * Primer hito: la historia completa de aprendizaje, headless y sin IA
 * externa. Devuelve un reporte estructurado; `main.ts` lo imprime.
 */
export async function runMilestone(seed = 5): Promise<MilestoneReport> {
  const provider = new MockModelProvider();
  const library = new SkillLibrary();
  const regressions = new RegressionStore();
  const bundle = foodBehindWall.build(seed);
  const world: WorldState = bundle.world;

  const initialEnergy = getEntity(world, bundle.petId)?.components.energy?.current ?? 0;

  const agent = new AnimaAgent({
    petId: bundle.petId,
    petName: 'Anima',
    provider,
    library,
    regressions,
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11, 22, 33],
    guidanceEnabled: true,
  });

  const result = await runAgentInWorld(world, agent, {
    maxTicks: 400,
    stopWhen: (_w, a) => a.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed',
  });

  // Deja que la mascota diga su explicación final.
  await runAgentInWorld(world, agent, { maxTicks: 3 });

  const timeline = [
    ...agent.events.events
      .filter((e) => TIMELINE_AGENT_EVENTS.has(e.type))
      .map((e) => ({ tick: e.tick, type: e.type, detail: describe(e) })),
    ...result.worldEvents
      .filter((e) => TIMELINE_WORLD_EVENTS.has(e.type))
      .map((e) => ({ tick: e.tick, type: e.type, detail: describe(e) })),
  ].sort((a, b) => a.tick - b.tick);

  const finalEnergy = getEntity(world, bundle.petId)?.components.energy?.current ?? 0;
  const stable = library.findStable(SKILL_REACH_BLOCKED_FOOD);

  return {
    success:
      agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed' &&
      stable !== undefined &&
      finalEnergy > initialEnergy,
    ticks: result.ticks,
    energy: { initial: initialEnergy, final: finalEnergy },
    timeline,
    skills: library.all(),
    regressions: regressions.all().map((r) => ({
      scenarioName: r.scenarioName,
      seed: r.seed,
      description: r.description,
    })),
    facts: agent.memory.factList().map((f) => f.statement),
    hypotheses: agent.memory.hypothesisList().map((h) => ({
      statement: h.statement,
      confidence: Math.round(h.confidence * 100) / 100,
      resolved: h.resolved,
    })),
    petExplanation: agent.explainLearning(),
    modelCalls: {
      propose: provider.callCount('skill.propose'),
      revise: provider.callCount('skill.revise'),
      interpret: provider.callCount('interpret.signal'),
    },
  };
}
