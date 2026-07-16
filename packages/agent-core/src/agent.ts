import type { EventLog } from '@anima/shared';
import { createEventLog } from '@anima/shared';
import type { ActionIntent, EntityId, Perception, SimEvent } from '@anima/sim-core';
import type { MemoryStore } from '@anima/memory';
import { MemoryStore as MemoryStoreImpl } from '@anima/memory';
import type { ModelProvider } from '@anima/model-providers';
import type { SkillLibrary, SkillProgram } from '@anima/skill-runtime';
import { SkillExecution } from '@anima/skill-runtime';
import type { NamedScenario, RegressionStore } from '@anima/skill-evaluator';
import type { AgentEvent } from './events.js';
import type { Goal } from './goals.js';
import { GoalManager } from './goals.js';
import { ProgressController } from './progress.js';
import type { RequestDecision, UserRequest } from './refusal.js';
import { evaluateUserRequest, parseUserMessage } from './refusal.js';
import type { SkillContract } from './skill-dev.js';
import { developSkill } from './skill-dev.js';

export const GOAL_RESTORE_ENERGY = 'recuperar energía';
export const SKILL_REACH_BLOCKED_FOOD = 'alcanzar-alimento-bloqueado';

const LOW_ENERGY_FRACTION = 0.35;

/** Estrategia primitiva: ir directo al alimento y comerlo. Sin herramientas. */
const DIRECT_APPROACH_PROGRAM: SkillProgram = [
  { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
  { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
  { op: 'moveToward', target: 'food', maxSteps: 30 },
  {
    op: 'branch',
    if: { type: 'lastMoveBlocked' },
    then: [{ op: 'abort', reason: 'camino-bloqueado' }],
  },
  { op: 'consume', target: 'food' },
];

export interface AgentConfig {
  petId: EntityId;
  petName: string;
  provider: ModelProvider;
  library: SkillLibrary;
  regressions: RegressionStore;
  /** Escenarios que el evaluador usa como mundos de prueba aislados. */
  evaluationScenarios: NamedScenario[];
  evaluationSeeds: number[];
  /** Experiencia guiada: si el usuario no explica, el sistema muestra pistas. */
  guidanceEnabled: boolean;
  maxSkillDevAttempts?: number;
  maxVersionsPerDev?: number;
  now?: () => string;
}

interface Activity {
  goalId: string;
  strategy: string;
  exec: SkillExecution;
  skillId?: string;
  consumedFood: boolean;
  energyAtStart: number;
}

/**
 * El agente cognitivo. Nunca accede al WorldState: recibe percepciones y
 * devuelve intenciones. Las consultas al modelo ocurren solo en momentos
 * cognitivos (señal nueva, creación de habilidad, mensaje del usuario), nunca
 * por tick: la actividad normal es ejecución local de programas ya conocidos.
 */
export class AnimaAgent {
  readonly memory: MemoryStore = new MemoryStoreImpl();
  readonly goals = new GoalManager();
  readonly progress = new ProgressController();
  readonly events: EventLog<AgentEvent> = createEventLog<AgentEvent>();

  private readonly config: Required<Pick<AgentConfig, 'maxSkillDevAttempts' | 'maxVersionsPerDev'>> &
    AgentConfig;
  private activity: Activity | null = null;
  private pendingSpeech: string[] = [];
  private pendingUserMessages: string[] = [];
  private pendingExplanation: string | null = null;
  private energyHypothesisId: string | null = null;
  private lastSelectedGoalId: string | null = null;
  private tick = 0;

  constructor(config: AgentConfig) {
    this.config = {
      maxSkillDevAttempts: 1,
      maxVersionsPerDev: 3,
      ...config,
    };
  }

  get petId(): EntityId {
    return this.config.petId;
  }

  private now(): string {
    return this.config.now ? this.config.now() : new Date().toISOString();
  }

  private emit(type: AgentEvent['type'], data: Record<string, unknown>): void {
    this.events.emit({ type, tick: this.tick, data });
  }

  receiveUserMessage(text: string): void {
    this.pendingUserMessages.push(text);
  }

  /** Un paso de decisión. Devuelve la intención para este tick (o ninguna). */
  async think(perception: Perception): Promise<ActionIntent | null> {
    this.tick = perception.tick;

    this.processUserMessages(perception);
    await this.processSignals(perception);

    const speech = this.pendingSpeech.shift();
    if (speech !== undefined) return { type: 'speak', text: speech };

    if (this.activity) return this.continueActivity(perception);

    const goal = this.goals.selectActive();
    if (!goal) return null; // Observación pasiva.
    if (goal.id !== this.lastSelectedGoalId) {
      this.lastSelectedGoalId = goal.id;
      this.emit('goal.selected', { goalId: goal.id, description: goal.description });
    }
    return this.pursueGoal(goal, perception);
  }

  /** Retroalimentación del mundo tras aplicar la intención. */
  observe(events: SimEvent[]): void {
    this.activity?.exec.observe(events);
    for (const event of events) {
      if (event.type === 'item.consumed' && event.data.actorId === this.petId) {
        if (this.activity) this.activity.consumedFood = true;
        if (this.energyHypothesisId) {
          this.memory.addEvidence(this.energyHypothesisId, true, this.tick);
          this.emit('hypothesis.updated', {
            hypothesisId: this.energyHypothesisId,
            evidence: 'positive',
            source: 'item.consumed',
          });
        }
      }
      if (
        event.type === 'entity.damaged' &&
        event.data.byId === this.petId &&
        typeof event.data.damage === 'number' &&
        event.data.damage > 0
      ) {
        const fact = this.memory.addFact(
          `la herramienta ${String(event.data.itemKind)} puede dañar un ${String(event.data.targetKind)}`,
          this.tick,
        );
        this.emit('memory.created', { kind: 'fact', statement: fact.statement });
      }
    }
  }

  // ---- señales internas ---------------------------------------------------

  private async processSignals(perception: Perception): Promise<void> {
    const energy = perception.self.energy;
    if (!energy) return;
    const fraction = energy.current / energy.max;
    if (fraction >= LOW_ENERGY_FRACTION) return;
    const open = this.goals.findOpen(GOAL_RESTORE_ENERGY);
    if (open) {
      // Cambio relevante del entorno: si el objetivo se suspendió y ahora
      // vuelve a haber alimento a la vista, se reactiva con estrategias limpias.
      if (open.status === 'suspended' && perception.visibleEntities.some((e) => e.edible)) {
        this.goals.reactivate(open.id);
        this.progress.resetGoal(open.id);
        this.emit('goal.reactivated', { goalId: open.id, reason: 'alimento visible de nuevo' });
      }
      return;
    }

    // La mascota no nace sabiendo qué significa la señal: la interpreta con
    // ayuda del usuario o de la experiencia guiada. Pero solo la primera vez:
    // si ya tiene una hipótesis o un hecho sobre cómo recuperar energía, no
    // vuelve a consultar nada — el conocimiento quedó incorporado.
    const alreadyUnderstands =
      this.memory.factList().some((f) => f.statement.includes('recupera energía')) ||
      this.memory.hypothesisList().some((h) => h.statement.includes('energía'));
    if (alreadyUnderstands) {
      this.createEnergyGoal(fraction);
      return;
    }

    const explanation = this.pendingExplanation;
    this.pendingExplanation = null;
    if (explanation === null && !this.config.guidanceEnabled) return;

    if (explanation === null) {
      this.emit('guidance.shown', {
        signal: 'energy-low',
        hint: 'evidencia histórica: criaturas que llegan a cero energía dejan de funcionar',
      });
    }
    const interpretRequest: Parameters<ModelProvider['complete']>[0] = {
      kind: 'interpret.signal',
      signal: 'energy-low',
      ...(explanation !== null ? { userMessage: explanation } : {}),
    };
    const interpretation = await this.config.provider.complete(interpretRequest);
    if (interpretation.kind === 'interpretation') {
      const hypothesis = this.memory.addHypothesis(
        interpretation.hypothesis,
        this.tick,
        interpretation.confidence,
      );
      this.energyHypothesisId = hypothesis.id;
      // La explicación del usuario o la demostración guiada es en sí misma
      // una primera evidencia a favor de la hipótesis.
      this.memory.addEvidence(hypothesis.id, true, this.tick);
      this.emit('hypothesis.updated', {
        hypothesisId: hypothesis.id,
        statement: hypothesis.statement,
        confidence: hypothesis.confidence,
        source: explanation !== null ? 'user-explanation' : 'guided-experience',
      });
    }

    this.createEnergyGoal(fraction);
    this.memory.recordEpisode({
      kind: 'signal',
      summary: 'mi energía está bajando y creo que debo investigar cómo recuperarla',
      tick: this.tick,
      importance: 0.8,
    });
  }

  private createEnergyGoal(fraction: number): void {
    const goal = this.goals.create(
      {
        description: GOAL_RESTORE_ENERGY,
        source: 'internal-signal',
        priority: 0.9,
        urgency: Math.min(1, 1 - fraction),
        expectedValue: 1,
        preconditions: [],
        successCriteria: ['la energía sube por encima del nivel de alerta'],
        failureCriteria: ['la energía llega a cero'],
      },
      this.tick,
    );
    this.emit('goal.created', {
      goalId: goal.id,
      description: goal.description,
      source: goal.source,
    });
  }

  // ---- mensajes del usuario -----------------------------------------------

  private processUserMessages(perception: Perception): void {
    for (const text of this.pendingUserMessages.splice(0)) {
      this.emit('user.message.received', { text });
      this.memory.noteConversation('user', text, this.tick);

      const parsed = parseUserMessage(text);
      if (parsed.kind === 'explanation') {
        this.pendingExplanation = text;
        // Si el objetivo se suspendió por falta de ideas, la nueva
        // información del usuario es motivo para reintentar.
        for (const goal of this.goals.all()) {
          if (goal.status === 'suspended') {
            this.goals.reactivate(goal.id);
            this.progress.resetGoal(goal.id);
            this.emit('goal.reactivated', { goalId: goal.id, reason: 'nueva información del usuario' });
          }
        }
        this.reply('Gracias, eso me ayuda a entender qué me pasa.');
        continue;
      }
      const decision = this.decideOnRequest(parsed, perception);
      const eventType =
        decision.classification === 'accepted' ? 'user.request.accepted' : 'user.request.refused';
      this.emit(eventType, {
        request: parsed,
        classification: decision.classification,
        reason: decision.reason,
      });
      this.reply(
        decision.alternative ? `${decision.reason} ${decision.alternative}` : decision.reason,
      );
    }
  }

  decideOnRequest(request: UserRequest, perception: Perception): RequestDecision {
    const decision = evaluateUserRequest(
      request,
      perception,
      this.memory,
      this.goals.selectActive(),
    );
    if (decision.classification === 'accepted' && request.kind !== 'wait-here') {
      const goal = this.goals.create(
        {
          description: `petición del usuario: ${request.raw}`,
          source: 'user-request',
          priority: 0.5,
          urgency: 0.3,
          expectedValue: 0.6,
          preconditions: [],
          successCriteria: ['la petición queda satisfecha'],
          failureCriteria: [],
        },
        this.tick,
      );
      this.emit('goal.created', { goalId: goal.id, description: goal.description, source: goal.source });
    }
    return decision;
  }

  private reply(text: string): void {
    this.pendingSpeech.push(text);
    this.memory.noteConversation('pet', text, this.tick);
  }

  // ---- persecución de objetivos --------------------------------------------

  private async pursueGoal(goal: Goal, perception: Perception): Promise<ActionIntent | null> {
    if (goal.description !== GOAL_RESTORE_ENERGY) {
      // El MVP solo persigue activamente el objetivo de energía; otros
      // objetivos quedan registrados y visibles pero sin plan propio aún.
      return null;
    }

    // Jerarquía: primero una habilidad estable aplicable, luego la
    // aproximación primitiva. Solo crear una skill si hay evidencia de que
    // falta una capacidad (todas las estrategias conocidas prohibidas).
    const stable = this.config.library.findStable(SKILL_REACH_BLOCKED_FOOD);
    const strategies: { label: string; program: SkillProgram; skillId?: string }[] = [];
    if (stable) {
      strategies.push({
        label: `stable-skill:${stable.name}@v${stable.version}`,
        program: stable.program,
        skillId: stable.id,
      });
    }
    strategies.push({ label: 'direct-approach', program: DIRECT_APPROACH_PROGRAM });

    const viable = strategies.find((s) => !this.progress.isForbidden(goal.id, s.label));
    if (viable) {
      this.startActivity(goal, viable.label, viable.program, perception, viable.skillId);
      return this.continueActivity(perception);
    }

    // Si todo falló por falta del recurso (no de capacidad), fabricar otra
    // habilidad no ayudaría: se pide ayuda y luego se suspende.
    const step = this.progress.blockedByMissingResource(goal.id)
      ? this.progress.helpRequestedFor(goal.id)
        ? 'suspend'
        : 'ask-help'
      : this.progress.escalate(goal.id, {
          maxSkillDevAttempts: this.config.maxSkillDevAttempts,
        });
    if (step === 'create-skill') {
      return this.attemptSkillCreation(goal, perception);
    }
    if (step === 'ask-help') {
      this.progress.markHelpRequested(goal.id);
      this.emit('help.requested', { goalId: goal.id });
      return {
        type: 'speak',
        text: 'No consigo llegar al alimento y ya probé todo lo que sé. ¿Puedes ayudarme?',
      };
    }
    this.goals.suspend(
      goal.id,
      'sin estrategias viables tras pedir ayuda',
      'nueva información del usuario o cambio en el entorno',
    );
    this.emit('goal.suspended', { goalId: goal.id, reason: 'sin estrategias viables' });
    this.lastSelectedGoalId = null;
    return null;
  }

  private async attemptSkillCreation(
    goal: Goal,
    perception: Perception,
  ): Promise<ActionIntent | null> {
    this.progress.recordSkillDevAttempt(goal.id);

    const failures = this.progress
      .strategiesTried(goal.id)
      .filter((s) => s.forbidden)
      .map((s) => `estrategia fallida: ${s.strategy} (${s.failures} fallos)`);
    const contract: SkillContract = {
      name: SKILL_REACH_BLOCKED_FOOD,
      purpose: 'llegar hasta el alimento aunque el camino directo esté bloqueado, y consumirlo',
      motivation: failures.join('; ') || 'el camino directo al alimento falló repetidamente',
      expectedOutcome: 'la mascota consume el alimento y su energía aumenta',
      successCriteria: [
        { type: 'consumedKind', kind: 'food' },
        { type: 'energyIncreased' },
      ],
    };
    const context = [
      ...failures,
      ...perception.visibleEntities.map((e) => `veo: ${e.kind}${e.toolPower ? ` (herramienta, poder ${e.toolPower})` : ''}`),
    ];

    const outcome = await developSkill(
      contract,
      context,
      {
        provider: this.config.provider,
        library: this.config.library,
        regressions: this.config.regressions,
        scenarios: this.config.evaluationScenarios,
        seeds: this.config.evaluationSeeds,
        maxTicksPerCase: 200,
        maxVersions: this.config.maxVersionsPerDev,
        now: () => this.now(),
      },
      this.events,
      this.tick,
    );

    // Lo aprendido en los experimentos queda en memoria aunque falle.
    for (const report of outcome.reports) {
      for (const observation of report.failureObservations) {
        if (observation.startsWith('no-damage-dealt:')) {
          const pairs = observation.slice('no-damage-dealt:'.length).split(',');
          for (const pair of pairs) {
            const [item, target] = pair.split('->');
            if (item && target) {
              const fact = this.memory.addFact(
                `la herramienta ${item} no puede dañar un ${target}`,
                this.tick,
              );
              this.emit('memory.created', { kind: 'fact', statement: fact.statement });
            }
          }
        }
      }
    }

    if (outcome.stableSkill) {
      this.memory.recordEpisode({
        kind: 'skill-created',
        summary: `desarrollé la habilidad ${outcome.stableSkill.name} (v${outcome.stableSkill.version}) tras ${outcome.versionsTried} intentos`,
        tick: this.tick,
        importance: 0.9,
      });
      this.startActivity(
        goal,
        `stable-skill:${outcome.stableSkill.name}@v${outcome.stableSkill.version}`,
        outcome.stableSkill.program,
        perception,
        outcome.stableSkill.id,
      );
      return this.continueActivity(perception);
    }
    this.memory.recordEpisode({
      kind: 'skill-failed',
      summary: `no logré desarrollar una habilidad para: ${contract.purpose}`,
      tick: this.tick,
      importance: 0.7,
    });
    return null;
  }

  private startActivity(
    goal: Goal,
    strategy: string,
    program: SkillProgram,
    perception: Perception,
    skillId?: string,
  ): void {
    this.emit('strategy.selected', { goalId: goal.id, strategy });
    this.activity = {
      goalId: goal.id,
      strategy,
      exec: new SkillExecution(program, this.petId, { library: this.config.library }),
      ...(skillId !== undefined ? { skillId } : {}),
      consumedFood: false,
      energyAtStart: perception.self.energy?.current ?? 0,
    };
  }

  private continueActivity(perception: Perception): ActionIntent | null {
    const activity = this.activity!;
    const out = activity.exec.next(perception);
    if (out.kind === 'intent') return out.intent;

    // La actividad terminó: comparar expectativa y realidad.
    this.activity = null;
    const energyNow = perception.self.energy?.current ?? 0;
    const success =
      out.result.outcome === 'completed' &&
      activity.consumedFood &&
      energyNow > activity.energyAtStart;

    const record = this.progress.record(
      activity.goalId,
      activity.strategy,
      success,
      out.result.reason,
    );
    if (activity.skillId) {
      this.config.library.recordUse(activity.skillId, success, this.now());
      this.emit('skill.used', { skillId: activity.skillId, success });
    }

    if (success) {
      if (this.energyHypothesisId) {
        this.memory.addEvidence(this.energyHypothesisId, true, this.tick);
        const consolidation = this.memory.consolidate(this.tick);
        if (consolidation.hypothesesConfirmed.length > 0) {
          this.emit('memory.consolidated', { confirmed: consolidation.hypothesesConfirmed });
        }
      }
      this.memory.recordEpisode({
        kind: 'discovery',
        summary: `conseguí alimento usando la estrategia ${activity.strategy} y mi energía subió`,
        tick: this.tick,
        importance: 0.9,
      });
      this.goals.complete(activity.goalId);
      this.emit('goal.completed', { goalId: activity.goalId, strategy: activity.strategy });
      this.lastSelectedGoalId = null;
      this.reply(this.explainLearning());
      return null;
    }

    this.memory.recordEpisode({
      kind: 'failure',
      summary: `la estrategia ${activity.strategy} no me llevó al alimento (${out.result.reason ?? out.result.outcome})`,
      tick: this.tick,
      importance: 0.6,
    });
    this.emit('strategy.failed', {
      goalId: activity.goalId,
      strategy: activity.strategy,
      outcome: out.result.outcome,
      reason: out.result.reason ?? null,
    });
    if (record.forbidden) {
      this.emit('strategy.forbidden', { goalId: activity.goalId, strategy: activity.strategy });
    }
    return null;
  }

  /** Explicación breve generada desde datos estructurados, no razonamiento crudo. */
  explainLearning(): string {
    const facts = this.memory
      .factList()
      .slice(-3)
      .map((f) => f.statement);
    const stable = this.config.library.findStable(SKILL_REACH_BLOCKED_FOOD);
    const parts: string[] = [];
    if (facts.length > 0) parts.push(`Aprendí que ${facts.join('; y que ')}.`);
    if (stable) {
      parts.push(
        `Ahora tengo la habilidad "${stable.name}" (v${stable.version}) y puedo repetirlo sin pensar tanto.`,
      );
    }
    return parts.join(' ') || 'Todavía estoy aprendiendo cómo funciona este mundo.';
  }
}
