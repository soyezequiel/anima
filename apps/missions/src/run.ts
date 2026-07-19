import { AnimaAgent, runAgentInWorld } from '@anima/agent-core';
import type { GameMap, MissionStatus } from '@anima/missions';
import { MissionTracker } from '@anima/missions';
import type { ModelProvider } from '@anima/model-providers';
import { getEntity } from '@anima/sim-core';
import { RegressionStore, sampleSeeds } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS, PRACTICE_SCENARIOS } from '@anima/test-scenarios';
import { MissionTrace, traced } from './trace.js';

export interface MissionRunOptions {
  map: GameMap;
  provider: ModelProvider;
  seed: number;
  maxTicks: number;
  tracePath: string;
  /**
   * Ayuda humana, por el canal de siempre: mensajes del cuidador en ticks
   * concretos. No tocan el mundo ni el código — dicen algo, y ella hace lo que
   * quiera con eso, igual que en una partida.
   */
  hintsAt?: Record<number, string>;
  /** Tick en el que el cuidador plantea la misión. */
  briefingAtTick?: number;
}

export interface MissionRunReport {
  mapId: string;
  seed: number;
  ticks: number;
  status: MissionStatus;
  died: boolean;
  modelCalls: number;
  tracePath: string;
  /** Motivos con que el mundo rechazó propuestas: el diagnóstico empieza acá. */
  rejections: { tick: number; gate: string; reason: string }[];
  /** Lo que intentó hacer y el mundo no le dejó, agrupado por motivo. */
  failedActions: Record<string, number>;
  speech: { tick: number; text: string }[];
}

/**
 * Corre un mapa de punta a punta con el agente real y el mundo real. No hay
 * atajos: la misión se plantea por el chat, las acciones pasan por `stepWorld`
 * y el veredicto lo da el juez mirando el estado, nunca lo que ella diga.
 */
export async function runMission(options: MissionRunOptions): Promise<MissionRunReport> {
  const { map, seed, maxTicks } = options;
  const bundle = map.build(seed);
  const world = bundle.world;
  const trace = new MissionTrace(options.tracePath);
  const provider = traced(options.provider, trace, () => world.tick);

  const tracker = new MissionTracker(map.mission, world, bundle.petId);
  trace.add(0, 'mision', 'mapa', {
    id: map.id,
    name: map.name,
    briefing: map.mission.briefing,
    objetivos: map.mission.objectives.map((o) => ({ id: o.id, describe: o.describe })),
    tests: map.mission.tests,
  });

  const library = new SkillLibrary();
  const agent = new AnimaAgent({
    petId: bundle.petId,
    petName: 'Anima',
    provider,
    library,
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    practiceScenarios: PRACTICE_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: sampleSeeds(seed),
    guidanceEnabled: true,
  });

  const briefingAt = options.briefingAtTick ?? 1;
  const messages: Record<number, string> = {
    [briefingAt]: map.mission.briefing,
    ...(options.hintsAt ?? {}),
  };
  for (const [tick, text] of Object.entries(messages)) {
    trace.add(Number(tick), 'nota', 'mensaje-del-cuidador', { text });
  }

  let agentEventIndex = 0;
  let status = tracker.evaluate(world);

  const result = await runAgentInWorld(world, agent, {
    maxTicks,
    userMessagesAt: messages,
    onDecision: (perception, intent) => {
      trace.add(perception.tick, 'percepcion', 'vio', {
        posicion: perception.self.position,
        energia: perception.self.energy,
        salud: perception.self.health,
        enMano: perception.self.heldItems.map((i) => i.kind),
        visibles: perception.visibleEntities.map((e) => ({
          kind: e.kind,
          at: e.position,
          wet: e.wet,
          solid: e.solid,
          portable: e.portable,
        })),
        reglas: {
          recetas: perception.recipes.map((r) => r.id),
          interacciones: perception.interactions.map((i) => i.id),
          planos: perception.blueprints.map((b) => b.id),
        },
      });
      trace.add(perception.tick, 'intencion', intent ? intent.type : 'nada', intent);
    },
    onTick: (w, events) => {
      trace.events(w.tick, 'mundo', events);
      const fresh = agent.events.events.slice(agentEventIndex);
      agentEventIndex = agent.events.events.length;
      trace.events(w.tick, 'agente', fresh);
      tracker.observe(events);
      tracker.observe(fresh);
      const before = status;
      status = tracker.evaluate(w);
      for (const objective of status.objectives) {
        const was = before.objectives.find((o) => o.id === objective.id);
        if (objective.met && was && !was.met) {
          trace.add(w.tick, 'mision', 'objetivo-cumplido', {
            id: objective.id,
            describe: objective.describe,
            detail: objective.detail,
          });
        }
      }
    },
    stopWhen: (w) => tracker.evaluate(w).completed,
  });

  status = tracker.evaluate(world);
  trace.add(world.tick, 'mision', status.completed ? 'superada' : 'no-superada', status);

  const rejections = trace
    .all()
    .filter((e) => e.channel === 'mundo' && e.type.endsWith('.rejected'))
    .map((e) => ({
      tick: e.tick,
      gate: e.type.replace('.rejected', ''),
      reason: String((e.data as { reason?: unknown }).reason ?? ''),
    }));

  const failedActions: Record<string, number> = {};
  for (const entry of trace.all()) {
    if (entry.channel !== 'mundo' || entry.type !== 'action.resolved') continue;
    const data = entry.data as { success?: boolean; action?: string; reason?: string };
    if (data.success) continue;
    const key = `${data.action ?? '?'}:${data.reason ?? '?'}`;
    failedActions[key] = (failedActions[key] ?? 0) + 1;
  }

  const pet = getEntity(world, bundle.petId);
  return {
    mapId: map.id,
    seed,
    ticks: result.ticks,
    status,
    died: pet?.components.dead !== undefined,
    modelCalls: options.provider.callCount(),
    tracePath: options.tracePath,
    rejections,
    failedActions,
    speech: trace
      .all()
      .filter((e) => e.type === 'agent.spoke')
      .map((e) => ({ tick: e.tick, text: String((e.data as { text?: unknown }).text ?? '') })),
  };
}
