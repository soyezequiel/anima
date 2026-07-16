import { AnimaAgent, GOAL_RESTORE_ENERGY } from '@anima/agent-core';
import type { AgentEvent } from '@anima/agent-core';
import type { ModelProvider } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { SimEvent, WorldState } from '@anima/sim-core';
import { buildPerception, getEntity, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import type { SkillOp } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { foodBehindWall, MVP_SCENARIOS } from '@anima/test-scenarios';
import type { KeyValueStore, LegacyReport, PetIdentity, SessionSaveData } from '@anima/persistence';
import {
  appendLegacy,
  applySessionSave,
  buildLegacyReport,
  captureSession,
  clearSession,
  loadLegacies,
  loadSession,
  MemoryKeyValueStore,
  saveSession,
  successorIdentity,
  testimonyFromLegacy,
  WebStorageKeyValueStore,
} from '@anima/persistence';
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
const AUTOSAVE_EVERY_TICKS = 40;
const RECENT_ACTIONS_LIMIT = 12;

export interface SessionOptions {
  seed?: number;
  speed?: number;
  autostart?: boolean;
  petColor?: string;
  store?: KeyValueStore;
  /** true: ignora cualquier guardado previo y empieza de cero. */
  fresh?: boolean;
  /** Proveedor de modelo (por defecto, MockModelProvider determinista). */
  provider?: ModelProvider;
}

interface SessionUiState {
  chat: ChatEntry[];
  petColor: string;
}

function defaultStore(): KeyValueStore {
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  return storage ? new WebStorageKeyValueStore(storage) : new MemoryKeyValueStore();
}

function newIdentity(name: string): PetIdentity {
  return {
    id: `pet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    generation: 1,
    bornAt: new Date().toISOString(),
  };
}

/**
 * Sesión de juego que corre la simulación en el navegador: mundo + agente +
 * loop con pausa y velocidad, autoguardado, informe de legado al morir y
 * creación de sucesoras. Es UI-agnóstica (también corre en Vitest).
 * React y Phaser solo consumen el GameView inmutable que produce.
 */
export class GameSession {
  private world!: WorldState;
  private agent!: AnimaAgent;
  private provider!: ModelProvider;
  private externalProvider: ModelProvider | null = null;
  private aiBusy = false;
  private library!: SkillLibrary;
  private regressions!: RegressionStore;
  private identity: PetIdentity = newIdentity('Ánima');

  private readonly store: KeyValueStore;
  private listeners = new Set<() => void>();
  private view!: GameView;
  private chat: ChatEntry[] = [];
  private devEvents: DevEventView[] = [];
  private devSeq = 0;
  private agentEventCursor = 0;
  private lastSpeech: { text: string; tick: number } | null = null;
  private lastAction: string | null = null;
  private recentActions: string[] = [];
  private deathReport: LegacyReport | null = null;
  private legacyCount = 0;
  private storyWasCompleted = false;

  private consecutiveThinkErrors = 0;
  private running = false;
  private speed = 1;
  private seed = 5;
  private petColor = '#f59e0b';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stepping = false;
  private disposed = false;

  private constructor(options: SessionOptions) {
    this.store = options.store ?? defaultStore();
    if (options.speed !== undefined) this.speed = options.speed;
    if (options.petColor !== undefined) this.petColor = options.petColor;
    if (options.provider !== undefined) this.externalProvider = options.provider;
    this.seed = options.seed ?? 5;
  }

  /** Crea la sesión: restaura el guardado si existe (salvo `fresh`). */
  static async create(options: SessionOptions = {}): Promise<GameSession> {
    const session = new GameSession(options);
    if (options.fresh) {
      await clearSession(session.store);
    }
    const saved = options.fresh ? null : await loadSession(session.store);
    if (saved) {
      session.buildFreshRuntime(saved.seed);
      session.applySave(saved);
    } else {
      session.resetToNewPet(session.seed);
    }
    session.legacyCount = (await loadLegacies(session.store)).length;
    session.rebuildView();
    if (options.autostart !== false && !session.deathReport) session.start();
    return session;
  }

  // ---- ciclo de vida --------------------------------------------------------

  /** Mundo, agente y biblioteca nuevos. No toca identidad ni chat. */
  private buildFreshRuntime(seed: number): void {
    this.seed = seed;
    const bundle = foodBehindWall.build(seed);
    this.world = bundle.world;
    this.provider = this.externalProvider ?? new MockModelProvider();
    this.library = new SkillLibrary();
    this.regressions = new RegressionStore();
    this.agent = new AnimaAgent({
      petId: bundle.petId,
      petName: this.identity.name,
      provider: this.provider,
      library: this.library,
      regressions: this.regressions,
      evaluationScenarios: MVP_SCENARIOS,
      evaluationSeeds: [11, 22, 33],
      guidanceEnabled: true,
    });
    this.devEvents = [];
    this.devSeq = 0;
    this.agentEventCursor = 0;
    this.lastSpeech = null;
    this.lastAction = null;
    this.recentActions = [];
    this.deathReport = null;
    this.storyWasCompleted = false;
  }

  private resetToNewPet(seed: number): void {
    this.identity = newIdentity('Ánima');
    this.buildFreshRuntime(seed);
    this.chat = [
      { from: 'system', text: `Mundo creado (semilla ${seed}). La energía irá bajando…`, tick: 0 },
    ];
    this.rebuildView();
    this.notify();
  }

  reset(seed: number): void {
    this.resetToNewPet(seed);
    void this.save();
  }

  /** Borra el guardado y arranca una mascota nueva de generación 1. */
  async restartFresh(): Promise<void> {
    await clearSession(this.store);
    this.resetToNewPet(this.seed);
    this.start();
    await this.save();
  }

  private applySave(data: SessionSaveData): void {
    this.identity = structuredClone(data.identity);
    this.world = applySessionSave(data, {
      agent: this.agent,
      library: this.library,
      regressions: this.regressions,
    });
    const ui = data.ui as Partial<SessionUiState> | undefined;
    this.chat = ui?.chat ?? [];
    if (ui?.petColor !== undefined) this.petColor = ui.petColor;
    this.agentEventCursor = this.agent.events.events.length;
    this.storyWasCompleted =
      this.agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed';
    const pet = getEntity(this.world, this.agent.petId);
    if (pet?.components.dead) {
      // Restaurar una sesión con mascota muerta: recuperar su informe.
      void loadLegacies(this.store).then((legacies) => {
        this.deathReport = legacies.find((l) => l.identity.id === this.identity.id) ?? null;
        this.rebuildView();
        this.notify();
      });
    }
    this.chat.push({
      from: 'system',
      text: `Sesión restaurada (tick ${this.world.tick}).`,
      tick: this.world.tick,
    });
  }

  async save(): Promise<void> {
    const data = captureSession({
      seed: this.seed,
      identity: this.identity,
      world: this.world,
      agent: this.agent,
      library: this.library,
      regressions: this.regressions,
      ui: { chat: this.chat, petColor: this.petColor } satisfies SessionUiState,
      now: () => new Date().toISOString(),
    });
    try {
      await saveSession(this.store, data);
    } catch (error) {
      // Con almacenamiento remoto, un corte de red no debe romper el loop:
      // el siguiente autoguardado reintenta.
      this.pushDev('agent', {
        type: 'save.failed',
        tick: this.world.tick,
        data: { message: error instanceof Error ? error.message : String(error) },
      });
    }
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
    void this.save();
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

  /** Señal externa de "el modelo está pensando" (proveedores lentos). */
  setAiBusy(busy: boolean): void {
    if (this.aiBusy === busy) return;
    this.aiBusy = busy;
    this.rebuildView();
    this.notify();
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
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
        if (this.running) this.pause();
        return;
      }
      const perception = buildPerception(this.world, this.agent.petId);
      let intent = null;
      try {
        intent = await this.agent.think(perception);
        this.consecutiveThinkErrors = 0;
      } catch (error) {
        // Un proveedor real puede fallar (red, timeout, JSON inválido). Se
        // registra y se reintenta; tras varios fallos seguidos, pausa
        // automática para no lanzar consultas en bucle.
        const message = error instanceof Error ? error.message : String(error);
        this.consecutiveThinkErrors += 1;
        this.pushDev('agent', {
          type: 'agent.error',
          tick: this.world.tick,
          data: { message, consecutive: this.consecutiveThinkErrors },
        });
        if (this.consecutiveThinkErrors >= 3) {
          this.consecutiveThinkErrors = 0;
          this.chat.push({
            from: 'system',
            text: `El proveedor de IA está fallando (${message.slice(0, 160)}). Pausa automática: revisa la conexión o vuelve al modo simulado.`,
            tick: this.world.tick,
          });
          this.pause();
          return;
        }
      }
      const events = stepWorld(
        this.world,
        intent ? [{ actorId: this.agent.petId, intent }] : [],
      );
      this.agent.observe(events);
      this.ingestWorldEvents(events);
      this.ingestAgentEvents();

      if (events.some((e) => e.type === 'pet.died')) {
        await this.handleDeath();
      } else {
        const completed =
          this.agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed';
        if (
          (completed && !this.storyWasCompleted) ||
          this.world.tick % AUTOSAVE_EVERY_TICKS === 0
        ) {
          await this.save();
        }
        this.storyWasCompleted = completed;
      }

      this.rebuildView();
      this.notify();
    } finally {
      this.stepping = false;
    }
  }

  // ---- muerte y sucesión -----------------------------------------------------

  private async handleDeath(): Promise<void> {
    const report = buildLegacyReport({
      identity: this.identity,
      world: this.world,
      petId: this.agent.petId,
      agent: this.agent,
      library: this.library,
      recentActions: this.recentActions,
      now: () => new Date().toISOString(),
    });
    this.deathReport = report;
    this.legacyCount += 1;
    await appendLegacy(this.store, report);
    this.pushDev('agent', {
      type: 'legacy.created',
      tick: this.world.tick,
      data: { legacyId: report.id, cause: report.cause },
    });
    await this.save();
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Nace la siguiente generación: mundo nuevo y testimonio del legado. */
  async createSuccessor(): Promise<void> {
    const legacy = this.deathReport;
    if (!legacy) return;
    const testimony = testimonyFromLegacy(legacy);
    this.identity = successorIdentity(legacy, { now: () => new Date().toISOString() });
    this.buildFreshRuntime(this.seed);
    const result = this.agent.adoptLegacy(testimony);
    this.ingestAgentEvents();

    const adopted = result.adoptedSkills
      .map((s) => `${s.name} (${s.promoted ? 'verificada y promovida' : 'rechazada en sus pruebas'})`)
      .join('; ');
    this.chat = [
      {
        from: 'system',
        text:
          `Nace ${this.identity.name}, generación ${this.identity.generation}. ` +
          `Ha leído el informe de su antecesora.` +
          (adopted ? ` Habilidades heredadas: ${adopted}.` : ''),
        tick: 0,
      },
    ];
    await this.save();
    this.rebuildView();
    this.notify();
    this.start();
  }

  /**
   * Herramienta de modo desarrollador: colapsa energía y salud para poder
   * observar el flujo de muerte y sucesión sin esperar la inanición real.
   */
  devKill(): void {
    const pet = getEntity(this.world, this.agent.petId);
    if (!pet || pet.components.dead) return;
    if (pet.components.energy) pet.components.energy.current = 0;
    if (pet.components.health) pet.components.health.current = 1;
    this.pushDev('agent', {
      type: 'dev.kill',
      tick: this.world.tick,
      data: { note: 'muerte forzada desde el modo desarrollador' },
    });
    if (!this.running) void this.stepOnce();
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

  private pushDev(
    source: 'world' | 'agent',
    event: { type: string; tick: number; data: unknown },
  ): void {
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
        this.recentActions.push(intent.type);
        if (this.recentActions.length > RECENT_ACTIONS_LIMIT) this.recentActions.shift();
      }
      if (event.type === 'pet.died') {
        this.chat.push({
          from: 'system',
          text: `${this.identity.name} ha muerto. Su informe de legado está disponible.`,
          tick: event.tick,
        });
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
    const push = (event: AgentEvent, kind: ExperimentView['kind'], detail: string): void => {
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
          lines.push(
            `${pad}repetir hasta ${op.max}×${op.until ? ` (hasta ${op.until.type})` : ''}:`,
          );
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
      aiProvider: this.provider.name,
      aiBusy: this.aiBusy,
      identity: {
        name: this.identity.name,
        generation: this.identity.generation,
        ancestorId: this.identity.ancestorId ?? null,
      },
      death: this.deathReport,
      legacyCount: this.legacyCount,
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
