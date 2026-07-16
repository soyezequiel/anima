import { AnimaAgent, GOAL_RESTORE_ENERGY } from '@anima/agent-core';
import type { AgentEvent } from '@anima/agent-core';
import { MockModelProvider } from '@anima/model-providers';
import type { SimEvent, WorldState } from '@anima/sim-core';
import { buildPerception, getEntity, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import type { SkillOp } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { foodBehindWall, MVP_SCENARIOS } from '@anima/test-scenarios';
import type {
  ChatEntry,
  DevEventView,
  ExperimentView,
  GameView,
  GoalView,
  SkillView,
} from './view.js';

const BASE_TICKS_PER_SECOND = 4;
const SPEECH_VISIBLE_TICKS = 14;
const DEV_EVENT_LIMIT = 400;

export interface SessionOptions {
  seed?: number;
  speed?: number;
  autostart?: boolean;
  petColor?: string;
}

/**
 * Sesión de juego que corre la simulación en el navegador: mundo + agente +
 * loop con pausa y velocidad. Es UI-agnóstica (también corre en Vitest).
 * React y Phaser solo consumen el GameView inmutable que produce.
 */
export class GameSession {
  private world!: WorldState;
  private agent!: AnimaAgent;
  private provider!: MockModelProvider;
  private library!: SkillLibrary;
  private regressions!: RegressionStore;

  private listeners = new Set<() => void>();
  private view!: GameView;
  private chat: ChatEntry[] = [];
  private devEvents: DevEventView[] = [];
  private devSeq = 0;
  private agentEventCursor = 0;
  private lastSpeech: { text: string; tick: number } | null = null;
  private lastAction: string | null = null;

  private running = false;
  private speed = 1;
  private seed = 5;
  private petColor = '#f59e0b';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stepping = false;
  private disposed = false;

  constructor(options: SessionOptions = {}) {
    if (options.speed !== undefined) this.speed = options.speed;
    if (options.petColor !== undefined) this.petColor = options.petColor;
    this.reset(options.seed ?? 5);
    if (options.autostart !== false) this.start();
  }

  // ---- ciclo de vida --------------------------------------------------------

  reset(seed: number): void {
    this.seed = seed;
    const bundle = foodBehindWall.build(seed);
    this.world = bundle.world;
    this.provider = new MockModelProvider();
    this.library = new SkillLibrary();
    this.regressions = new RegressionStore();
    this.agent = new AnimaAgent({
      petId: bundle.petId,
      petName: 'Ánima',
      provider: this.provider,
      library: this.library,
      regressions: this.regressions,
      evaluationScenarios: MVP_SCENARIOS,
      evaluationSeeds: [11, 22, 33],
      guidanceEnabled: true,
    });
    this.chat = [
      { from: 'system', text: `Mundo creado (semilla ${seed}). La energía irá bajando…`, tick: 0 },
    ];
    this.devEvents = [];
    this.devSeq = 0;
    this.agentEventCursor = 0;
    this.lastSpeech = null;
    this.lastAction = null;
    this.rebuildView();
    this.notify();
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.rebuildView();
    this.notify();
    this.scheduleNext();
  }

  pause(): void {
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.rebuildView();
    this.notify();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.rebuildView();
    this.notify();
  }

  setPetColor(color: string): void {
    this.petColor = color;
    this.rebuildView();
    this.notify();
  }

  dispose(): void {
    this.disposed = true;
    this.pause();
    this.listeners.clear();
  }

  private scheduleNext(): void {
    if (!this.running || this.disposed) return;
    this.timer = setTimeout(() => {
      void this.stepOnce().then(() => this.scheduleNext());
    }, 1000 / (BASE_TICKS_PER_SECOND * this.speed));
  }

  /** Avanza exactamente un tick de simulación (usable también en pausa). */
  async stepOnce(): Promise<void> {
    if (this.stepping || this.disposed) return;
    this.stepping = true;
    try {
      const pet = getEntity(this.world, this.agent.petId);
      if (!pet || pet.components.dead) {
        this.pause();
        return;
      }
      const perception = buildPerception(this.world, this.agent.petId);
      const intent = await this.agent.think(perception);
      const events = stepWorld(
        this.world,
        intent ? [{ actorId: this.agent.petId, intent }] : [],
      );
      this.agent.observe(events);
      this.ingestWorldEvents(events);
      this.ingestAgentEvents();
      this.rebuildView();
      this.notify();
    } finally {
      this.stepping = false;
    }
  }

  // ---- entrada del usuario --------------------------------------------------

  sendUserMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.chat.push({ from: 'user', text: trimmed, tick: this.world.tick });
    this.agent.receiveUserMessage(trimmed);
    this.rebuildView();
    this.notify();
  }

  // ---- suscripción ------------------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getView(): GameView {
    return this.view;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  // ---- ingestión de eventos ---------------------------------------------------

  private pushDev(source: 'world' | 'agent', event: { type: string; tick: number; data: unknown }): void {
    this.devEvents.push({
      seq: this.devSeq++,
      tick: event.tick,
      source,
      type: event.type,
      json: JSON.stringify(event.data),
    });
    if (this.devEvents.length > DEV_EVENT_LIMIT) {
      this.devEvents.splice(0, this.devEvents.length - DEV_EVENT_LIMIT);
    }
  }

  private ingestWorldEvents(events: SimEvent[]): void {
    for (const event of events) {
      this.pushDev('world', event);
      if (event.type === 'agent.spoke') {
        const text = String(event.data.text);
        this.lastSpeech = { text, tick: event.tick };
        this.chat.push({ from: 'pet', text, tick: event.tick });
      }
      if (event.type === 'action.requested') {
        const intent = event.data.intent as { type: string };
        this.lastAction = intent.type;
      }
      if (event.type === 'pet.died') {
        this.chat.push({ from: 'system', text: 'La mascota ha muerto.', tick: event.tick });
      }
    }
  }

  private ingestAgentEvents(): void {
    const events = this.agent.events.events;
    for (; this.agentEventCursor < events.length; this.agentEventCursor++) {
      const event = events[this.agentEventCursor]!;
      this.pushDev('agent', event);
    }
  }

  // ---- construcción del view model ---------------------------------------------

  private experimentsFromEvents(): ExperimentView[] {
    const experiments: ExperimentView[] = [];
    const push = (
      event: AgentEvent,
      kind: ExperimentView['kind'],
      detail: string,
    ): void => {
      experiments.push({
        tick: event.tick,
        skillName: String(event.data.name ?? event.data.skillId ?? ''),
        version: typeof event.data.version === 'number' ? event.data.version : null,
        kind,
        detail,
      });
    };
    for (const event of this.agent.events.events) {
      const d = event.data;
      switch (event.type) {
        case 'skill.requested':
          push(event, 'requested', `Necesita una habilidad: ${String(d.purpose)}`);
          break;
        case 'skill.created':
          push(event, 'created', String(d.rationale));
          break;
        case 'skill.test.started':
          push(
            event,
            'test-started',
            `Escenarios: ${(d.scenarios as string[]).join(', ')} × semillas ${(d.seeds as number[]).join(',')} (+${String(d.regressions)} regresiones)`,
          );
          break;
        case 'skill.test.failed':
          push(
            event,
            'test-failed',
            `Éxito ${Math.round((d.successRate as number) * 100)}%. ${(d.observations as string[]).join('; ')}`,
          );
          break;
        case 'skill.test.passed':
          push(event, 'test-passed', `Éxito ${Math.round((d.successRate as number) * 100)}%`);
          break;
        case 'skill.promoted':
          push(event, 'promoted', (d.reasons as string[]).join('; '));
          break;
        case 'skill.rejected':
          push(event, 'rejected', String(d.reason));
          break;
        default:
          break;
      }
    }
    return experiments;
  }

  private summarizeOps(ops: SkillOp[], depth = 0): string[] {
    const pad = '  '.repeat(depth);
    const lines: string[] = [];
    for (const op of ops) {
      switch (op.op) {
        case 'branch':
          lines.push(`${pad}si ${op.if.type}:`);
          lines.push(...this.summarizeOps(op.then, depth + 1));
          if (op.else) {
            lines.push(`${pad}si no:`);
            lines.push(...this.summarizeOps(op.else, depth + 1));
          }
          break;
        case 'repeatWithLimit':
          lines.push(`${pad}repetir hasta ${op.max}×${op.until ? ` (hasta ${op.until.type})` : ''}:`);
          lines.push(...this.summarizeOps(op.body, depth + 1));
          break;
        case 'findEntities':
          lines.push(`${pad}buscar ${JSON.stringify(op.query)} -> ${op.store}`);
          break;
        case 'selectTarget':
          lines.push(`${pad}elegir ${op.strategy} de ${op.from} -> ${op.store}`);
          break;
        case 'moveToward':
          lines.push(`${pad}ir hacia ${op.target} (máx ${op.maxSteps} pasos)`);
          break;
        case 'useItem':
          lines.push(`${pad}usar ${op.item} sobre ${op.target}`);
          break;
        default:
          lines.push(`${pad}${op.op}${'target' in op ? ` ${String(op.target)}` : ''}`);
          break;
      }
    }
    return lines;
  }

  private skillViews(): SkillView[] {
    return this.library.all().map((skill) => ({
      id: skill.id,
      name: skill.name,
      version: skill.version,
      status: skill.status,
      description: skill.description,
      motivation: skill.motivation,
      expectedOutcome: skill.expectedOutcome,
      successCriteria: skill.successCriteria.map((c) => (c.kind ? `${c.type}:${c.kind}` : c.type)),
      lastEvaluationSuccessRate: skill.metrics.lastEvaluationSuccessRate ?? null,
      totalRuns: skill.metrics.totalRuns,
      successfulRuns: skill.metrics.successfulRuns,
      knownFailures: skill.knownFailures.map((f) => f.description),
      parentVersionId: skill.parentVersionId ?? null,
      programSummary: this.summarizeOps(skill.program),
    }));
  }

  private rebuildView(): void {
    const pet = getEntity(this.world, this.agent.petId);
    const petPos = pet?.components.position;
    const goals: GoalView[] = this.agent.goals.all().map((g) => ({
      id: g.id,
      description: g.description,
      status: g.status,
      source: g.source,
    }));
    const activeGoal = this.agent.goals.selectActive();

    const strategyEvents = this.agent.events.ofType('strategy.selected');
    const lastStrategy = strategyEvents[strategyEvents.length - 1];

    const entities = Object.values(this.world.entities)
      .filter((e) => e.id !== this.agent.petId && e.components.position)
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        x: e.components.position!.x,
        y: e.components.position!.y,
      }));

    const speechFresh =
      this.lastSpeech && this.world.tick - this.lastSpeech.tick <= SPEECH_VISIBLE_TICKS
        ? this.lastSpeech
        : null;

    this.view = {
      seed: this.seed,
      tick: this.world.tick,
      running: this.running,
      speed: this.speed,
      petColor: this.petColor,
      worldSize: { width: this.world.config.width, height: this.world.config.height },
      entities,
      pet:
        pet && petPos
          ? {
              id: pet.id,
              x: petPos.x,
              y: petPos.y,
              alive: !pet.components.dead,
              energy: {
                current: pet.components.energy?.current ?? 0,
                max: pet.components.energy?.max ?? 1,
              },
              health: {
                current: pet.components.health?.current ?? 0,
                max: pet.components.health?.max ?? 1,
              },
              inventory: (pet.components.inventory?.items ?? []).map((id) => ({
                id,
                kind: getEntity(this.world, id)?.kind ?? '?',
              })),
            }
          : null,
      goals,
      currentGoal: activeGoal
        ? {
            id: activeGoal.id,
            description: activeGoal.description,
            status: activeGoal.status,
            source: activeGoal.source,
          }
        : null,
      currentStrategy: lastStrategy ? String(lastStrategy.data.strategy) : null,
      lastAction: this.lastAction,
      speech: speechFresh,
      chat: [...this.chat],
      skills: this.skillViews(),
      experiments: this.experimentsFromEvents(),
      devEvents: [...this.devEvents],
      regressions: this.regressions.all().map((r) => ({
        scenarioName: r.scenarioName,
        seed: r.seed,
        description: r.description,
      })),
      facts: this.agent.memory.factList().map((f) => f.statement),
      hypotheses: this.agent.memory.hypothesisList().map((h) => ({
        statement: h.statement,
        confidence: Math.round(h.confidence * 100) / 100,
        resolved: h.resolved,
      })),
      storyCompleted:
        this.agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed',
    };
  }
}
