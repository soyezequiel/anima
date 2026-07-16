import type { EventLog } from '@anima/shared';
import { createEventLog } from '@anima/shared';
import type { ActionIntent, EntityId, Perception, SimEvent } from '@anima/sim-core';
import type { MemoryData, MemoryStore } from '@anima/memory';
import { MemoryStore as MemoryStoreImpl } from '@anima/memory';
import type { CommandInterpretation, ModelProvider, ModelRequest } from '@anima/model-providers';
import type { SkillDefinition, SkillLibrary, SkillProgram } from '@anima/skill-runtime';
import { describeCriterion, SkillExecution, validateSuccessCriteria } from '@anima/skill-runtime';
import type { NamedScenario, RegressionStore } from '@anima/skill-evaluator';
import type { AgentEvent } from './events.js';
import type { Goal, GoalManagerData, GoalUserRequest, LearningContract } from './goals.js';
import { GoalManager } from './goals.js';
import type { ProgressData } from './progress.js';
import { ProgressController } from './progress.js';
import type { RequestDecision, UserRequest } from './refusal.js';
import { evaluateUserRequest, parseUserMessage } from './refusal.js';
import type { SkillContract, SkillDevOutcome } from './skill-dev.js';
import { developSkill, evaluateAndApply } from './skill-dev.js';

export const GOAL_RESTORE_ENERGY = 'recuperar energía';
export const GOAL_RESTORE_WARMTH = 'recuperar calor';
export const SKILL_REACH_BLOCKED_FOOD = 'alcanzar-alimento-bloqueado';
/**
 * Como SKILL_REACH_BLOCKED_FOOD: nombre reservado para la necesidad del
 * cuerpo, para que un contrato enseñado no pueda secuestrar la habilidad de
 * no morirse de frío (ADR 0016).
 */
export const SKILL_GET_WARM = 'conseguir-calor';

const LOW_ENERGY_FRACTION = 0.35;
const LOW_TEMPERATURE_FRACTION = 0.35;
/**
 * Cuántas veces puede intentar inventar algo antes de rendirse y pedir ayuda.
 * Inventar cuesta una consulta al modelo por intento: sin tope, un mundo donde
 * nada sirve la dejaría proponiendo para siempre.
 */
const MAX_RECIPE_ATTEMPTS = 3;

/** Prioridad y urgencia por tipo de petición: los objetivos son estructuras. */
const USER_REQUEST_WEIGHTS: Record<
  GoalUserRequest['kind'],
  { priority: number; urgency: number }
> = {
  'consume-item': { priority: 1, urgency: 0.8 },
  'move-direction': { priority: 1, urgency: 0.75 },
  'run-skill': { priority: 1, urgency: 0.7 },
  'craft-item': { priority: 1, urgency: 0.7 },
  'fetch-item': { priority: 0.6, urgency: 0.35 },
  'destroy-entity': { priority: 0.6, urgency: 0.35 },
  'wait-here': { priority: 0.6, urgency: 0.35 },
};

/**
 * Mensaje del usuario ya clasificado. Además de una orden ejecutable o una
 * enseñanza, puede ser el pedido de una conducta que la mascota todavía no
 * tiene: eso no es un callejón sin salida, es el disparador del aprendizaje.
 */
type InterpretedMessage =
  | UserRequest
  | { kind: 'explanation'; raw: string }
  | { kind: 'learn-skill'; summary: string; raw: string };

/** Nombre de habilidad utilizable: kebab-case sin acentos, corto y estable. */
function normalizeSkillName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

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

/**
 * Aproximación primitiva al calor: acercarse a lo que irradia sin pegarse.
 * Busca por `warm` y no por tipo: la mascota percibe qué da calor, no sabe
 * que eso se llama fogata. El `stopAtDistance: 2` es un reflejo prudente
 * incorporado, no conocimiento adquirido (ver ADR 0017).
 */
const WARMTH_APPROACH_PROGRAM: SkillProgram = [
  { op: 'findEntities', query: { warm: true }, store: 'heatSources' },
  { op: 'selectTarget', from: 'heatSources', strategy: 'nearest', store: 'heat' },
  { op: 'moveToward', target: 'heat', maxSteps: 30, stopAtDistance: 2 },
  {
    op: 'branch',
    if: { type: 'lastMoveBlocked' },
    then: [{ op: 'abort', reason: 'camino-bloqueado' }],
  },
  // Quedarse el tiempo suficiente para que el calor haga efecto.
  { op: 'wait', ticks: 20 },
];

export interface AgentConfig {
  petId: EntityId;
  petName: string;
  provider: ModelProvider;
  library: SkillLibrary;
  regressions: RegressionStore;
  /** Escenarios que el evaluador usa como mundos de prueba aislados. */
  evaluationScenarios: NamedScenario[];
  /**
   * Mundos donde practica lo que el cuidador le enseña. Por defecto, los
   * mismos de evaluación: una conducta que no funciona en su propio mundo no
   * le sirve. Conviene incluir alguno espacioso, para que una habilidad de
   * movimiento tenga dónde demostrarse.
   */
  practiceScenarios?: NamedScenario[];
  /**
   * Mundos donde se juzga una habilidad de abrigo. Tienen que tener frío: sin
   * el componente `temperature` el criterio `temperatureIncreased` no se puede
   * cumplir y la habilidad se rechazaría siempre, por buena que fuera. Si no
   * se inyectan, la mascota no intenta fabricar abrigo (pide ayuda en su
   * lugar): mejor no aprender que aprender contra una vara imposible.
   */
  warmthScenarios?: NamedScenario[];
  evaluationSeeds: number[];
  /** Experiencia guiada: si el usuario no explica, el sistema muestra pistas. */
  guidanceEnabled: boolean;
  maxSkillDevAttempts?: number;
  maxVersionsPerDev?: number;
  now?: () => string;
}

/** Estado persistible del agente. La actividad en curso no se guarda: al
 * restaurar, el agente replanifica desde su memoria y objetivos. */
export interface AgentPersistentState {
  goals: GoalManagerData;
  progress: ProgressData;
  memory: MemoryData;
  events: AgentEvent[];
  energyHypothesisId: string | null;
  lastSelectedGoalId: string | null;
  /** Última orden explícita, para resolver referencias como "hacelo igual". */
  lastUserRequest?: UserRequest | null;
}

/**
 * Testimonio que una sucesora recibe de un legado. No son recuerdos propios:
 * el conocimiento entra como hipótesis (puede confiar, dudar o verificar) y
 * las habilidades se re-evalúan en su propio mundo antes de promoverse.
 */
export interface LegacyTestimony {
  fromName: string;
  generation: number;
  knowledge: { statement: string; confidence: number }[];
  skills: SkillDefinition[];
  message?: string;
}

interface Activity {
  goalId: string;
  strategy: string;
  exec: SkillExecution;
  purpose: 'restore-energy' | 'user-request';
  completionReply?: string;
  requestRaw?: string;
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

  private readonly config: Required<
    Pick<AgentConfig, 'maxSkillDevAttempts' | 'maxVersionsPerDev'>
  > &
    AgentConfig;
  private activity: Activity | null = null;
  private pendingSpeech: string[] = [];
  private pendingUserMessages: string[] = [];
  private pendingExplanation: string | null = null;
  private energyHypothesisId: string | null = null;
  /** Rechazos del mundo a sus inventos: viajan al siguiente intento. */
  private recipeRejections: string[] = [];
  private recipeAttempts = 0;
  private lastSelectedGoalId: string | null = null;
  private lastUserRequest: UserRequest | null = null;
  /** Comestibles visibles al suspender cada objetivo: reactivar exige uno NUEVO. */
  private suspensionEdibles = new Map<string, Set<string>>();
  private tick = 0;

  constructor(config: AgentConfig) {
    this.config = {
      maxSkillDevAttempts: 1,
      // Un modelo real suele necesitar más iteraciones que el mock: las
      // versiones inválidas no consumen intento, pero las rechazadas sí.
      maxVersionsPerDev: 4,
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

  // ---- persistencia ---------------------------------------------------------

  exportState(): AgentPersistentState {
    return structuredClone({
      goals: this.goals.serialize(),
      progress: this.progress.serialize(),
      memory: this.memory.serialize(),
      events: this.events.events,
      energyHypothesisId: this.energyHypothesisId,
      lastSelectedGoalId: this.lastSelectedGoalId,
      lastUserRequest: this.lastUserRequest,
    });
  }

  importState(state: AgentPersistentState): void {
    const clone = structuredClone(state);
    this.goals.loadFrom(clone.goals);
    this.progress.loadFrom(clone.progress);
    this.memory.loadFrom(clone.memory);
    this.events.events.length = 0;
    this.events.events.push(...clone.events);
    this.energyHypothesisId = clone.energyHypothesisId;
    this.lastSelectedGoalId = clone.lastSelectedGoalId;
    if (clone.lastUserRequest !== undefined) {
      this.lastUserRequest = clone.lastUserRequest;
    } else {
      // Compatibilidad con guardados anteriores: reconstruir la última orden
      // explícita del historial, incluso si el agente la había rechazado.
      this.lastUserRequest = null;
      for (const turn of [...this.memory.working.conversation].reverse()) {
        if (turn.from !== 'user') continue;
        const parsed = parseUserMessage(turn.text);
        if (
          parsed.kind !== 'unknown' &&
          parsed.kind !== 'explanation' &&
          (parsed.kind === 'wait-here' ||
            parsed.kind === 'move-direction' ||
            ('targetKind' in parsed && parsed.targetKind !== 'unknown'))
        ) {
          this.lastUserRequest = structuredClone(parsed);
          break;
        }
      }
      if (!this.lastUserRequest) {
        const recentGoal = [...this.goals.all()].reverse().find((goal) => goal.userRequest);
        this.lastUserRequest = recentGoal?.userRequest
          ? (structuredClone(recentGoal.userRequest) as UserRequest)
          : null;
      }
    }
    // La actividad en curso y las colas efímeras no se persisten.
    this.activity = null;
    this.pendingSpeech = [];
    this.pendingUserMessages = [];
    this.pendingExplanation = null;
  }

  // ---- legado ---------------------------------------------------------------

  /**
   * Recibe el testimonio de una antecesora. El conocimiento entra como
   * hipótesis "según X, ..." (no como hechos propios) y cada habilidad
   * heredada se re-evalúa en mundos aislados antes de poder promoverse.
   */
  adoptLegacy(testimony: LegacyTestimony): {
    adoptedSkills: { name: string; version: number; promoted: boolean }[];
  } {
    this.emit('legacy.read', {
      fromName: testimony.fromName,
      generation: testimony.generation,
      knowledgeEntries: testimony.knowledge.length,
      skillArtifacts: testimony.skills.length,
    });
    this.memory.recordEpisode({
      kind: 'legacy',
      summary: `leí el informe de ${testimony.fromName} (generación ${testimony.generation})`,
      tick: this.tick,
      importance: 0.9,
    });

    for (const entry of testimony.knowledge) {
      const hypothesis = this.memory.addHypothesis(
        `según ${testimony.fromName}, ${entry.statement}`,
        this.tick,
        Math.min(0.65, entry.confidence),
      );
      if (entry.statement.includes('recupera energía')) {
        this.energyHypothesisId = hypothesis.id;
      }
      this.emit('hypothesis.updated', {
        hypothesisId: hypothesis.id,
        statement: hypothesis.statement,
        confidence: hypothesis.confidence,
        source: 'legacy-testimony',
      });
    }

    const adoptedSkills: { name: string; version: number; promoted: boolean }[] = [];
    for (const artifact of testimony.skills) {
      const candidate = this.config.library.addExperimental({
        name: artifact.name,
        description: artifact.description,
        motivation: `heredada de ${testimony.fromName} (generación ${testimony.generation}); debe demostrar que funciona en mi propio mundo`,
        program: structuredClone(artifact.program),
        expectedOutcome: artifact.expectedOutcome,
        successCriteria: structuredClone(artifact.successCriteria),
        createdAt: this.now(),
      });
      this.emit('skill.created', {
        skillId: candidate.id,
        name: candidate.name,
        version: candidate.version,
        rationale: `artefacto heredado de ${testimony.fromName}`,
      });
      const { promoted } = evaluateAndApply(
        candidate,
        {
          library: this.config.library,
          regressions: this.config.regressions,
          scenarios: this.config.evaluationScenarios,
          seeds: this.config.evaluationSeeds,
          maxTicksPerCase: 200,
          now: () => this.now(),
        },
        this.events,
        this.tick,
      );
      adoptedSkills.push({ name: candidate.name, version: candidate.version, promoted });
    }

    if (testimony.message !== undefined && testimony.message.length > 0) {
      this.reply(`Mi antecesora me dejó un mensaje: "${testimony.message}"`);
    }
    return { adoptedSkills };
  }

  /** Un paso de decisión. Devuelve la intención para este tick (o ninguna). */
  async think(perception: Perception): Promise<ActionIntent | null> {
    this.tick = perception.tick;

    await this.processUserMessages(perception);
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

  /**
   * Acredita evidencia de "comer recupera energía" a una hipótesis cuyo
   * enunciado realmente hable de eso. Si la interpretación de turno fue otra
   * (p. ej. "dormir recupera energía"), esa NO recibe el crédito: la mascota
   * crea su propia hipótesis por observación directa y la interpretada queda
   * pendiente hasta tener evidencia propia. (Limitación cerrada del ADR 0011.)
   */
  private creditEatingEvidence(source: string): void {
    const aboutEating = (statement: string): boolean =>
      /consum|comer|comida|aliment/i.test(statement) && /energ/i.test(statement);

    let hypothesis = this.memory
      .hypothesisList()
      .find((h) => h.resolved !== 'discarded' && aboutEating(h.statement));
    if (!hypothesis) {
      hypothesis = this.memory.addHypothesis('consumir alimento recupera energía', this.tick, 0.5);
      this.emit('hypothesis.updated', {
        hypothesisId: hypothesis.id,
        statement: hypothesis.statement,
        confidence: hypothesis.confidence,
        source: 'observación directa',
      });
    }
    this.memory.addEvidence(hypothesis.id, true, this.tick);
    this.emit('hypothesis.updated', {
      hypothesisId: hypothesis.id,
      evidence: 'positive',
      source,
    });
  }

  /** Retroalimentación del mundo tras aplicar la intención. */
  observe(events: SimEvent[]): void {
    this.activity?.exec.observe(events);
    for (const event of events) {
      if (event.type === 'item.consumed' && event.data.actorId === this.petId) {
        if (this.activity) this.activity.consumedFood = true;
        // La evidencia se atribuye por afinidad semántica: comer solo puede
        // respaldar una hipótesis que hable de comer, no la que esté de turno.
        const energyRose =
          typeof event.data.energyAfter === 'number' &&
          typeof event.data.energyBefore === 'number' &&
          event.data.energyAfter > event.data.energyBefore;
        if (energyRose) this.creditEatingEvidence('item.consumed');
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
      // El mundo rechazó un invento: el motivo se recuerda y viaja al próximo
      // intento. Sin esto insistiría con la misma idea imposible para siempre.
      if (event.type === 'recipe.rejected' && event.data.actorId === this.petId) {
        const reason = String(event.data.reason);
        if (!this.recipeRejections.includes(reason)) this.recipeRejections.push(reason);
        this.emit('recipe.rejected', { reason });
      }
      // Lo que el mundo aceptó pasa a ser conocimiento suyo, y sobrevive a su
      // muerte: la receta vive en el mundo, el saber que existe en su memoria.
      if (event.type === 'recipe.learned' && event.data.actorId === this.petId) {
        const fact = this.memory.addFact(
          `puedo construir ${String(event.data.outputKind)}`,
          this.tick,
        );
        this.emit('memory.created', { kind: 'fact', statement: fact.statement });
        this.emit('recipe.learned', {
          recipeId: event.data.recipeId,
          outputKind: event.data.outputKind,
        });
        this.memory.recordEpisode({
          kind: 'recipe-invented',
          summary: `se me ocurrió cómo construir ${String(event.data.outputKind)} y funcionó`,
          tick: this.tick,
          importance: 0.9,
        });
      }
    }
  }

  // ---- señales internas ---------------------------------------------------

  private async processSignals(perception: Perception): Promise<void> {
    await this.processEnergySignal(perception);
    await this.processColdSignal(perception);
  }

  /**
   * El frío es una necesidad del cuerpo, como el hambre: su contrato es fijo y
   * nace de ella, no de una conversación (ver ADR 0016). Tampoco nace sabiendo
   * qué significa tener frío: interpreta la señal igual que la del hambre.
   */
  private async processColdSignal(perception: Perception): Promise<void> {
    const temperature = perception.self.temperature;
    // Quien no siente frío no tiene señal que interpretar.
    if (!temperature) return;
    const fraction = temperature.current / temperature.max;
    if (fraction >= LOW_TEMPERATURE_FRACTION) return;
    if (this.goals.findOpen(GOAL_RESTORE_WARMTH)) return;

    const alreadyUnderstands =
      this.memory.factList().some((f) => f.statement.includes('calor')) ||
      this.memory.hypothesisList().some((h) => h.statement.includes('calor'));
    if (!alreadyUnderstands) {
      if (this.config.guidanceEnabled) {
        this.emit('guidance.shown', {
          signal: 'temperature-low',
          hint: 'evidencia histórica: criaturas que pierden todo su calor dejan de moverse',
        });
      }
      try {
        const interpretation = await this.config.provider.complete({
          kind: 'interpret.signal',
          signal: 'temperature-low',
        });
        if (interpretation.kind === 'interpretation') {
          const hypothesis = this.memory.addHypothesis(
            interpretation.hypothesis,
            this.tick,
            interpretation.confidence,
          );
          this.emit('hypothesis.updated', {
            hypothesisId: hypothesis.id,
            statement: hypothesis.statement,
            confidence: hypothesis.confidence,
            source: 'internal-signal',
          });
        }
      } catch (error) {
        // Sin interpretación igual tiene frío: el objetivo nace lo mismo, y el
        // cuerpo no espera a que el modelo conteste.
        this.emit('provider.error', {
          provider: this.config.provider.name,
          operation: 'interpret.signal',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      this.memory.recordEpisode({
        kind: 'signal',
        summary: 'estoy perdiendo calor y necesito entender cómo recuperarlo',
        tick: this.tick,
        importance: 0.8,
      });
    }

    const goal = this.goals.create(
      {
        description: GOAL_RESTORE_WARMTH,
        source: 'internal-signal',
        priority: 0.95,
        urgency: Math.min(1, 1 - fraction),
        expectedValue: 1,
        preconditions: [],
        successCriteria: ['el calor corporal sube por encima del nivel de alerta'],
        failureCriteria: ['el calor corporal llega a cero'],
      },
      this.tick,
    );
    this.emit('goal.created', {
      goalId: goal.id,
      description: goal.description,
      source: goal.source,
    });
  }

  private async processEnergySignal(perception: Perception): Promise<void> {
    const energy = perception.self.energy;
    if (!energy) return;
    const fraction = energy.current / energy.max;
    if (fraction >= LOW_ENERGY_FRACTION) return;
    const open = this.goals.findOpen(GOAL_RESTORE_ENERGY);
    if (open) {
      // Cambio relevante del entorno: solo reactiva si hay alimento NUEVO,
      // distinto del que ya veía (y no alcanzaba) cuando se suspendió.
      if (open.status === 'suspended') {
        const seenAtSuspension = this.suspensionEdibles.get(open.id) ?? new Set<string>();
        const freshFood = perception.visibleEntities.some(
          (e) => e.edible && !seenAtSuspension.has(e.id),
        );
        if (freshFood) {
          this.goals.reactivate(open.id);
          this.progress.resetGoal(open.id);
          this.suspensionEdibles.delete(open.id);
          this.emit('goal.reactivated', { goalId: open.id, reason: 'alimento nuevo visible' });
        }
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

  private async processUserMessages(perception: Perception): Promise<void> {
    const text = this.pendingUserMessages.shift();
    if (text === undefined) return;

    this.emit('user.message.received', { text });
    this.memory.noteConversation('user', text, this.tick);

    // Quién interpreta el chat depende del proveedor. Un modelo que entiende
    // lenguaje interpreta TODO (distingue "¿para qué sirve?" de "para" como
    // orden, y una pregunta sobre comida de una lección sobre comida). El
    // parser determinista manda solo con proveedores que no interpretan
    // (el mock), y queda de red de seguridad si el modelo falla.
    const fromParser = this.config.provider.interpretsLanguage
      ? null
      : this.contextualizeUserMessage(parseUserMessage(text), text, perception);

    const parsed: InterpretedMessage | null =
      fromParser && fromParser.kind !== 'unknown'
        ? fromParser
        : await this.interpretWithModel(text, perception);
    if (parsed === null) return; // El modelo ya respondió (charla, negativa o fallo).

    if (parsed.kind === 'explanation') {
      await this.learnFromExplanation(text);
      return;
    }

    if (parsed.kind === 'learn-skill') {
      await this.startLearning(parsed.summary, text, perception);
      return;
    }

    if (
      parsed.kind === 'wait-here' ||
      parsed.kind === 'move-direction' ||
      parsed.kind === 'run-skill' ||
      ('targetKind' in parsed && parsed.targetKind !== 'unknown')
    ) {
      this.lastUserRequest = structuredClone(parsed);
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

  /**
   * Lo que el cuidador enseña tiene que sobrevivir al turno en que lo dijo, o
   * no es aprendizaje: es cortesía. Entra como hipótesis y no como hecho
   * porque el cuidador puede equivocarse — la mascota la confirmará o la
   * descartará con su propia experiencia. Desde ahí queda disponible para el
   * diálogo, para decidir y para diseñar habilidades.
   */
  private async learnFromExplanation(text: string): Promise<void> {
    // Sigue sirviendo para interpretar la señal de energía si aún no la entiende.
    this.pendingExplanation = text;
    // Si un objetivo se suspendió por falta de ideas, la nueva información
    // del usuario es motivo para reintentar.
    for (const goal of this.goals.all()) {
      if (goal.status === 'suspended') {
        this.goals.reactivate(goal.id);
        this.progress.resetGoal(goal.id);
        this.suspensionEdibles.delete(goal.id);
        this.emit('goal.reactivated', {
          goalId: goal.id,
          reason: 'nueva información del usuario',
        });
      }
    }

    // Un proveedor que no entiende lenguaje no puede destilar nada: guarda la
    // enseñanza literal, que es honesto y no inventa comprensión.
    let statement = text;
    let confidence = 0.6;
    if (this.config.provider.interpretsLanguage) {
      try {
        const response = await this.config.provider.complete({
          kind: 'distill.knowledge',
          text,
          conversation: this.dialogueHistory(),
        });
        if (response.kind !== 'knowledge') {
          throw new Error(`respuesta inesperada del proveedor: ${response.kind}`);
        }
        statement = response.statement;
        confidence = response.confidence;
      } catch (error) {
        this.emit('provider.error', {
          provider: this.config.provider.name,
          operation: 'distill.knowledge',
          message: error instanceof Error ? error.message : String(error),
          recoveredWith: 'enseñanza literal',
        });
      }
    }

    const hypothesis = this.memory.addHypothesis(statement, this.tick, confidence);
    // Que el cuidador lo afirme es evidencia, pero solo si no contradice lo
    // que la mascota ya observó: en ese caso queda anotada y pendiente.
    if (confidence >= 0.5) this.memory.addEvidence(hypothesis.id, true, this.tick);
    this.emit('hypothesis.updated', {
      hypothesisId: hypothesis.id,
      statement: hypothesis.statement,
      confidence: hypothesis.confidence,
      source: 'user-teaching',
    });
    this.memory.recordEpisode({
      kind: 'teaching',
      summary: `mi cuidador me enseñó: ${hypothesis.statement}`,
      tick: this.tick,
      importance: 0.7,
    });
    this.reply(`Anoté esto: ${hypothesis.statement}. Voy a ver si me pasa lo mismo.`);
  }

  /**
   * El cuidador pidió una conducta que la mascota no tiene. Antes de intentar
   * nada hay que acordar qué significaría lograrlo: sin contrato, "aprender"
   * sería decir que sí y no cambiar en nada. El contrato se le muestra.
   */
  private async startLearning(
    summary: string,
    raw: string,
    perception: Perception,
  ): Promise<void> {
    let contract: LearningContract;
    try {
      contract = await this.deriveLearningContract(summary, raw, perception);
    } catch (error) {
      this.emit('provider.error', {
        provider: this.config.provider.name,
        operation: 'skill.contract',
        message: error instanceof Error ? error.message : String(error),
      });
      this.reply(
        `Quiero aprender eso, pero no consigo imaginar en qué se notaría que lo logré. ¿Me lo explicas con lo que tendría que hacer paso a paso?`,
      );
      return;
    }

    const existing = this.goals
      .all()
      .find(
        (goal) =>
          goal.source === 'learning' &&
          goal.learning?.name === contract.name &&
          goal.status === 'active',
      );
    if (existing) return; // Ya está en ello: no abrir el ciclo dos veces.

    const goal = this.goals.create(
      {
        description: `aprender: ${contract.name}`,
        source: 'learning',
        priority: 0.7,
        urgency: 0.5,
        expectedValue: 0.8,
        preconditions: [],
        successCriteria: [contract.expectedOutcome],
        failureCriteria: [],
        learning: contract,
      },
      this.tick,
    );
    this.emit('goal.created', {
      goalId: goal.id,
      description: goal.description,
      source: goal.source,
    });
    this.emit('skill.contract.agreed', {
      goalId: goal.id,
      name: contract.name,
      purpose: contract.purpose,
      criteria: contract.successCriteria.map(describeCriterion),
    });
    this.reply(
      `Todavía no sé hacerlo, pero quiero aprenderlo. Para mí "${contract.name}" va a estar ` +
        `logrado cuando ${contract.successCriteria.map(describeCriterion).join(', y cuando ')}. ` +
        `Déjame probarlo en mundos imaginados.`,
    );
  }

  /** Traduce lo que el cuidador pidió a un contrato que el evaluador sepa medir. */
  private async deriveLearningContract(
    summary: string,
    raw: string,
    perception: Perception,
  ): Promise<LearningContract> {
    const response = await this.config.provider.complete({
      kind: 'skill.contract',
      request: summary || raw,
      conversation: this.dialogueHistory(),
      facts: this.dialogueFacts(perception),
    });
    if (response.kind !== 'skill.contract') {
      throw new Error(`respuesta inesperada del proveedor: ${response.kind}`);
    }

    const name = normalizeSkillName(response.contract.name);
    if (!name) throw new Error('el contrato no propone un nombre usable');
    if (name === SKILL_REACH_BLOCKED_FOOD) {
      // Reusar ese nombre mezclaría versiones de dos habilidades distintas y
      // dejaría la de sobrevivir sujeta a un contrato ajeno.
      throw new Error(`el contrato reutiliza el nombre reservado ${SKILL_REACH_BLOCKED_FOOD}`);
    }
    // Los criterios vienen de un modelo: pasan por la misma puerta que los
    // programas, o el contrato podría ser inmedible o trivial de aprobar.
    const criteria = validateSuccessCriteria(response.contract.successCriteria);
    if (!criteria.ok) throw new Error(criteria.error);

    const purpose = response.contract.purpose.trim() || summary || raw;
    return {
      name,
      purpose,
      expectedOutcome: response.contract.expectedOutcome.trim() || purpose,
      successCriteria: criteria.value,
      raw,
      context: [
        `mi cuidador me pidió: "${raw}"`,
        ...this.dialogueFacts(perception),
        ...this.memory
          .hypothesisList()
          .filter((h) => h.resolved !== 'discarded')
          .slice(-4)
          .map((h) => `creo que ${h.statement}`),
      ],
    };
  }

  /**
   * Pide al modelo que clasifique el mensaje. Devuelve la petición
   * estructurada, o null cuando ya se respondió al usuario (charla, acción
   * fuera del catálogo, o fallo del proveedor sin red de seguridad).
   */
  private async interpretWithModel(
    text: string,
    perception: Perception,
  ): Promise<InterpretedMessage | null> {
    let command: CommandInterpretation;
    try {
      const interpretation = await this.config.provider.complete({
        kind: 'interpret.command',
        text,
        facts: this.dialogueFacts(perception),
        history: this.dialogueHistory(),
        // Su repertorio no es fijo: lo que aprendió también se puede pedir.
        skills: this.learnedSkills(),
        // Ni su mundo: lo que se puede construir sale de las recetas que rigen.
        recipes: perception.recipes.map((recipe) => ({
          id: recipe.id,
          ingredients: recipe.ingredients.map((i) => `${i.count}x ${i.kind}`).join(' + '),
        })),
      });
      if (interpretation.kind !== 'command.interpretation') {
        throw new Error(`respuesta inesperada del proveedor: ${interpretation.kind}`);
      }
      command = interpretation.command;
    } catch (error) {
      // Red de seguridad: si el modelo no responde, el parser determinista
      // todavía reconoce una orden clara. Solo si él tampoco entiende, el
      // fallo llega al usuario.
      const fallback = this.contextualizeUserMessage(parseUserMessage(text), text, perception);
      if (fallback.kind !== 'unknown') {
        this.emit('provider.error', {
          provider: this.config.provider.name,
          operation: 'interpret.command',
          message: error instanceof Error ? error.message : String(error),
          recoveredWith: 'parser',
        });
        return fallback;
      }
      this.replyProviderError('interpret.command', error);
      return null;
    }

    if (command.action === 'learn-skill') {
      return {
        kind: 'learn-skill',
        summary: command.summary.replace(/\s+/g, ' ').trim().slice(0, 300),
        raw: text,
      };
    }

    if (command.action === 'unsupported') {
      const summary = command.summary.replace(/\s+/g, ' ').trim().slice(0, 160);
      // El modelo debe nombrar lo pedido con una frase nominal, pero a veces
      // devuelve la explicación entera ("Crear X no es posible: el mundo..."):
      // incrustada en la plantilla sale una frase ilegible. Ante la duda, una
      // negativa honesta y genérica antes que una mal pegada.
      const isPhrase =
        summary.length > 0 && summary.length <= 60 && !/[.:;]/.test(summary);
      const reason = isPhrase
        ? `Entiendo que me pides ${summary}, pero mi cuerpo no da para eso: no hay forma de lograrlo con lo que sé hacer.`
        : 'Entiendo lo que me pides, pero mi cuerpo no da para eso: no hay forma de lograrlo con lo que sé hacer.';
      this.emit('user.request.refused', {
        request: { kind: 'unknown', raw: text, interpretedAs: summary },
        classification: 'cannot',
        reason,
      });
      // Que no pueda no la exime de recordarlo: es algo que su cuidador quiso.
      this.memory.recordEpisode({
        kind: 'unmet-request',
        summary: `mi cuidador me pidió ${summary || text} y mi cuerpo no da para eso`,
        tick: this.tick,
        importance: 0.5,
      });
      this.reply(reason);
      return null;
    }

    if (command.action === 'explanation') return { kind: 'explanation', raw: text };

    if (command.action === 'not-command') {
      try {
        const response = await this.config.provider.complete({
          kind: 'dialogue',
          topic: text,
          facts: this.dialogueFacts(perception),
          history: this.dialogueHistory(),
        });
        if (response.kind !== 'dialogue') {
          throw new Error(`respuesta inesperada del proveedor: ${response.kind}`);
        }
        this.reply(response.text);
      } catch (error) {
        this.replyProviderError('dialogue', error);
      }
      return null;
    }

    // El modelo ya resolvió referencias con el historial, pero si dejó el
    // objetivo sin identificar, el contexto local todavía puede completarlo.
    return this.contextualizeUserMessage(
      this.userRequestFromInterpretation(command, text),
      text,
      perception,
    );
  }

  private dialogueFacts(perception: Perception): string[] {
    const facts = this.memory
      .factList()
      .slice(-6)
      .map((fact) => fact.statement);
    // Lo que le enseñaron y aún no verificó también es suyo: si no puede
    // nombrarlo, para el cuidador es indistinguible de no haberlo aprendido.
    facts.push(
      ...this.memory
        .hypothesisList()
        .filter((h) => h.resolved !== 'discarded')
        .slice(-4)
        .map((h) => `creo (sin confirmar) que ${h.statement}`),
    );
    const learned = this.learnedSkills();
    if (learned.length > 0) {
      facts.push(`sé hacer estas habilidades: ${learned.map((s) => s.name).join(', ')}`);
    }
    const visibleKinds = [...new Set(perception.visibleEntities.map((entity) => entity.kind))];
    if (visibleKinds.length > 0) facts.push(`ahora veo: ${visibleKinds.join(', ')}`);
    if (perception.self.heldItems.length > 0) {
      facts.push(
        `llevo conmigo: ${perception.self.heldItems
          .map((item) =>
            item.toolPower === undefined
              ? item.kind
              : `${item.kind} (herramienta, poder ${item.toolPower})`,
          )
          .join(', ')}`,
      );
    }
    const energy = perception.self.energy;
    if (energy) facts.push(`mi energía actual es ${Math.round(energy.current)} de ${energy.max}`);
    return facts;
  }

  private userRequestFromInterpretation(
    command: Exclude<
      CommandInterpretation,
      { action: 'unsupported' | 'not-command' | 'explanation' | 'learn-skill' }
    >,
    raw: string,
  ): UserRequest {
    switch (command.action) {
      case 'destroy-entity':
      case 'fetch-item':
      case 'consume-item':
        return { kind: command.action, targetKind: command.targetKind, raw };
      case 'wait-here':
        return { kind: 'wait-here', raw };
      case 'move-direction':
        return { kind: 'move-direction', directions: [...command.directions], raw };
      case 'run-skill':
        return { kind: 'run-skill', skillName: normalizeSkillName(command.skillName), raw };
      case 'craft-item':
        return { kind: 'craft-item', recipeId: command.recipeId, raw };
    }
  }

  /** Habilidades estables: lo que de verdad sabe hacer, una entrada por nombre. */
  private learnedSkills(): { name: string; description: string }[] {
    const seen = new Set<string>();
    const skills: { name: string; description: string }[] = [];
    for (const skill of this.config.library.all()) {
      if (skill.status !== 'stable' || seen.has(skill.name)) continue;
      seen.add(skill.name);
      skills.push({ name: skill.name, description: skill.description });
    }
    return skills;
  }

  private replyProviderError(operation: ModelRequest['kind'], error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.emit('provider.error', {
      provider: this.config.provider.name,
      operation,
      message,
    });
    const compact = message.replace(/\s+/g, ' ').trim();
    const visibleError = compact.length > 280 ? `${compact.slice(0, 277)}...` : compact;
    const providerName =
      this.config.provider.name === 'codex' ? 'Codex' : this.config.provider.name;
    this.reply(`No pude consultar a ${providerName}: ${visibleError || 'error desconocido'}`);
  }

  private dialogueHistory(): { from: 'user' | 'pet'; text: string }[] {
    // El turno actual ya se envió como `topic`; no lo duplicamos en el historial.
    return this.memory.working.conversation
      .slice(0, -1)
      .slice(-8)
      .map(({ from, text }) => ({ from, text }));
  }

  private contextualizeUserMessage(
    parsed: ReturnType<typeof parseUserMessage>,
    text: string,
    perception: Perception,
  ): ReturnType<typeof parseUserMessage> {
    if (parsed.kind === 'explanation') return parsed;

    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const repeatsLastRequest =
      /\b(hacelo|hazlo|hace eso|intentalo|intenta de nuevo|probalo|proba de nuevo)\b/.test(
        normalized,
      );
    if (parsed.kind === 'unknown' && repeatsLastRequest && this.lastUserRequest) {
      return { ...structuredClone(this.lastUserRequest), raw: text };
    }

    if ('targetKind' in parsed && parsed.targetKind === 'unknown') {
      const previous = this.lastUserRequest;
      if (
        previous &&
        previous.kind === parsed.kind &&
        'targetKind' in previous &&
        previous.targetKind !== 'unknown'
      ) {
        return { ...parsed, targetKind: previous.targetKind };
      }
      if (parsed.kind === 'consume-item') {
        const visibleFood = perception.visibleEntities.find((entity) => entity.edible);
        if (visibleFood) return { ...parsed, targetKind: visibleFood.kind };
      }
    }
    return parsed;
  }

  decideOnRequest(request: UserRequest, perception: Perception): RequestDecision {
    const decision = evaluateUserRequest(
      request,
      perception,
      this.memory,
      this.goals.selectActive(),
      this.learnedSkills().map((skill) => skill.name),
    );
    if (decision.classification === 'accepted' && request.kind !== 'unknown') {
      const weights = USER_REQUEST_WEIGHTS[request.kind];
      const goal = this.goals.create(
        {
          description: `petición del usuario: ${request.raw}`,
          source: 'user-request',
          priority: weights.priority,
          urgency: weights.urgency,
          expectedValue: 0.6,
          preconditions: [],
          successCriteria: ['la petición queda satisfecha'],
          failureCriteria: [],
          userRequest: {
            kind: request.kind,
            ...('targetKind' in request ? { targetKind: request.targetKind } : {}),
            ...('directions' in request ? { directions: request.directions } : {}),
            ...('skillName' in request ? { skillName: request.skillName } : {}),
            ...('recipeId' in request ? { recipeId: request.recipeId } : {}),
            raw: request.raw,
          },
        },
        this.tick,
      );
      this.emit('goal.created', {
        goalId: goal.id,
        description: goal.description,
        source: goal.source,
      });
    }
    return decision;
  }

  private reply(text: string): void {
    this.pendingSpeech.push(text);
    this.memory.noteConversation('pet', text, this.tick);
  }

  // ---- persecución de objetivos --------------------------------------------

  private async pursueGoal(goal: Goal, perception: Perception): Promise<ActionIntent | null> {
    if (goal.source === 'learning' && goal.learning) {
      return this.pursueLearning(goal, goal.learning);
    }
    if (goal.source === 'user-request' && goal.userRequest) {
      const program = this.programForUserRequest(goal.userRequest);
      this.startUserActivity(goal, program, this.completionReply(goal.userRequest), perception);
      return this.continueActivity(perception);
    }
    if (goal.description === GOAL_RESTORE_WARMTH) {
      return this.pursueWarmth(goal, perception);
    }
    if (goal.description !== GOAL_RESTORE_ENERGY) {
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
    this.suspensionEdibles.set(
      goal.id,
      new Set(perception.visibleEntities.filter((e) => e.edible).map((e) => e.id)),
    );
    this.emit('goal.suspended', { goalId: goal.id, reason: 'sin estrategias viables' });
    this.lastSelectedGoalId = null;
    return null;
  }

  /**
   * Inventar un objeto que su mundo no sabe construir. El modelo propone; la
   * intención va al mundo, que valida y decide. Un rechazo no se pierde: se
   * recuerda y viaja al siguiente intento, para que corrija en vez de insistir.
   * Devuelve la intención de proponer, o null si no hay nada que proponer.
   */
  private async inventRecipe(
    problem: string,
    perception: Perception,
  ): Promise<ActionIntent | null> {
    const materials = [
      ...new Set([
        ...perception.self.heldItems.map((item) => `${item.kind} (lo llevo encima)`),
        ...perception.visibleEntities.filter((e) => e.portable).map((e) => `${e.kind} (lo veo)`),
      ]),
    ];
    // Sin materiales no hay nada que inventar: es falta de recurso, no de idea.
    if (materials.length === 0) return null;

    this.recipeAttempts += 1;
    try {
      const response = await this.config.provider.complete({
        kind: 'recipe.propose',
        problem,
        materials,
        existingRecipes: perception.recipes.map(
          (recipe) =>
            `${recipe.id} (${recipe.ingredients.map((i) => `${i.count}x ${i.kind}`).join(' + ')})`,
        ),
        ...(this.recipeRejections.length > 0 ? { rejections: [...this.recipeRejections] } : {}),
      });
      if (response.kind !== 'recipe') {
        throw new Error(`respuesta inesperada del proveedor: ${response.kind}`);
      }
      this.emit('recipe.proposed', { rationale: response.rationale });
      return { type: 'proposeRecipe', recipe: response.recipe };
    } catch (error) {
      this.emit('provider.error', {
        provider: this.config.provider.name,
        operation: 'recipe.propose',
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Perseguir el calor tiene la misma forma que perseguir el alimento: skill
   * estable, si no aproximación primitiva, y si todo está prohibido, el ciclo
   * cerrado. La diferencia está en qué falta cuando falla: sin nada que dé
   * calor no hay skill que valga (ADR 0008), pero SÍ puede construirlo si
   * tiene los ingredientes — por eso fabricar una habilidad es una salida
   * legítima aquí y no lo era para el alimento.
   */
  private async pursueWarmth(goal: Goal, perception: Perception): Promise<ActionIntent | null> {
    const stable = this.config.library.findStable(SKILL_GET_WARM);
    const strategies: { label: string; program: SkillProgram; skillId?: string }[] = [];
    if (stable) {
      strategies.push({
        label: `stable-skill:${stable.name}@v${stable.version}`,
        program: stable.program,
        skillId: stable.id,
      });
    }
    strategies.push({ label: 'warmth-approach', program: WARMTH_APPROACH_PROGRAM });

    const viable = strategies.find((s) => !this.progress.isForbidden(goal.id, s.label));
    if (viable) {
      this.startActivity(goal, viable.label, viable.program, perception, viable.skillId);
      return this.continueActivity(perception);
    }

    // Si nada de lo que sabe construir da calor, quizá pueda inventarlo. Es
    // el paso previo a rendirse: primero la idea, después la habilidad.
    const knowsFire = perception.recipes.some(
      (recipe) => recipe.output.components.heatSource !== undefined,
    );
    if (!knowsFire && this.recipeAttempts < MAX_RECIPE_ATTEMPTS) {
      const invention = await this.inventRecipe(
        'tengo frío y no tengo nada que dé calor',
        perception,
      );
      if (invention) return invention;
    }

    // Puede construir fuego, así que fabricar una habilidad no es absurdo
    // aunque no vea ninguno: lo que hace falta es tener con qué. Pero sin
    // mundos fríos donde probarla, la vara sería imposible: mejor pedir ayuda.
    const scenarios = this.config.warmthScenarios ?? [];
    const canBuildFire =
      scenarios.length > 0 &&
      perception.recipes.some((recipe) => recipe.output.components.heatSource !== undefined);
    const step =
      (this.progress.blockedByMissingResource(goal.id) && !canBuildFire) || scenarios.length === 0
        ? this.progress.helpRequestedFor(goal.id)
          ? 'suspend'
          : 'ask-help'
        : this.progress.escalate(goal.id, {
            maxSkillDevAttempts: this.config.maxSkillDevAttempts,
          });

    if (step === 'create-skill') {
      const contract: SkillContract = {
        name: SKILL_GET_WARM,
        purpose: 'dejar de perder calor: acercarse a una fuente de calor o construir una',
        motivation: 'tengo frío y lo que sé hacer no alcanza',
        expectedOutcome: 'su calor corporal sube y no se quema en el intento',
        successCriteria: [{ type: 'temperatureIncreased' }, { type: 'noDamageTaken' }],
      };
      const context = [
        ...perception.recipes.map(
          (recipe) =>
            `puedo construir "${recipe.id}" con ${recipe.ingredients
              .map((i) => `${i.count}x ${i.kind}`)
              .join(' + ')}`,
        ),
        ...perception.visibleEntities.map(
          (e) => `veo: ${e.kind}${e.warmth !== undefined ? ' (da calor)' : ''}`,
        ),
        'el fuego calienta a distancia pero quema al que se le pega',
      ];
      const outcome = await this.runSkillDevelopment(contract, context, scenarios);
      this.progress.recordSkillDevAttempt(goal.id);
      if (outcome.stableSkill) {
        this.startActivity(
          goal,
          `stable-skill:${outcome.stableSkill.name}@v${outcome.stableSkill.version}`,
          outcome.stableSkill.program,
          perception,
          outcome.stableSkill.id,
        );
        return this.continueActivity(perception);
      }
      return null;
    }

    if (step === 'ask-help') {
      this.progress.markHelpRequested(goal.id);
      this.emit('help.requested', { goalId: goal.id });
      return {
        type: 'speak',
        text: 'Tengo frío y no veo nada que dé calor. ¿Puedes ayudarme?',
      };
    }

    this.goals.suspend(
      goal.id,
      'sin estrategias viables tras pedir ayuda',
      'nueva información del usuario o algo que dé calor',
    );
    this.emit('goal.suspended', { goalId: goal.id, reason: 'sin estrategias viables' });
    this.lastSelectedGoalId = null;
    return null;
  }

  /**
   * Corre el ciclo cerrado para un contrato cualquiera. Es el mismo mecanismo
   * para la necesidad que nace de su cuerpo (recuperar energía) y para la que
   * nace de su cuidador (una conducta enseñada): lo único que cambia es quién
   * escribió el contrato y en qué mundos se practica.
   */
  private async runSkillDevelopment(
    contract: SkillContract,
    context: string[],
    scenarios: NamedScenario[],
  ): Promise<SkillDevOutcome> {
    const outcome = await developSkill(
      contract,
      context,
      {
        provider: this.config.provider,
        library: this.config.library,
        regressions: this.config.regressions,
        scenarios,
        seeds: this.config.evaluationSeeds,
        maxTicksPerCase: 200,
        maxVersions: this.config.maxVersionsPerDev,
        now: () => this.now(),
      },
      this.events,
      this.tick,
    );
    this.harvestSkillDevFacts(outcome);
    return outcome;
  }

  /** Lo aprendido en los experimentos queda en memoria aunque la skill falle. */
  private harvestSkillDevFacts(outcome: SkillDevOutcome): void {
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
  }

  private practiceScenarios(): NamedScenario[] {
    return this.config.practiceScenarios ?? this.config.evaluationScenarios;
  }

  /**
   * Aprender lo que el cuidador pidió: diseñar, probar en mundos imaginados y
   * aceptar el veredicto. Si sale bien, la conducta queda en la biblioteca con
   * su nombre y se puede pedir para siempre; si sale mal, se dice con qué se
   * chocó, y los fallos quedan como regresiones que un intento futuro deberá
   * superar. Lo que no puede pasar es que "aprender" sea decir que sí.
   */
  private async pursueLearning(
    goal: Goal,
    contract: LearningContract,
  ): Promise<ActionIntent | null> {
    this.lastSelectedGoalId = null;

    const already = this.config.library.findStable(contract.name);
    if (already) {
      // Ya la sabe (la aprendió antes o la heredó): no hay nada que desarrollar.
      this.goals.complete(goal.id);
      this.emit('goal.completed', { goalId: goal.id, strategy: `ya-sabía:${contract.name}` });
      this.queueSkillRun(contract.name, contract.raw);
      return null;
    }

    const outcome = await this.runSkillDevelopment(
      {
        name: contract.name,
        purpose: contract.purpose,
        motivation: `mi cuidador me pidió: "${contract.raw}"`,
        expectedOutcome: contract.expectedOutcome,
        successCriteria: contract.successCriteria,
      },
      contract.context,
      this.practiceScenarios(),
    );

    if (outcome.stableSkill) {
      this.memory.recordEpisode({
        kind: 'skill-learned',
        summary: `mi cuidador me enseñó "${contract.name}" y lo aprendí tras ${outcome.versionsTried} intento(s)`,
        tick: this.tick,
        importance: 0.9,
      });
      this.goals.complete(goal.id);
      this.emit('goal.completed', { goalId: goal.id, strategy: `aprendizaje:${contract.name}` });
      this.reply(
        `¡Lo aprendí! "${contract.name}" (v${outcome.stableSkill.version}): ${contract.expectedOutcome}. ` +
          `Lo probé en mundos imaginados y pasó todas las pruebas. Ya puedo repetirlo cuando me lo pidas.`,
      );
      this.queueSkillRun(contract.name, contract.raw);
      return null;
    }

    this.memory.recordEpisode({
      kind: 'skill-failed',
      summary: `no logré aprender "${contract.name}", que mi cuidador me pidió con: "${contract.raw}"`,
      tick: this.tick,
      importance: 0.7,
    });
    this.goals.fail(goal.id);
    this.reply(
      `Intenté aprender "${contract.name}" y no me salió: ${this.describeLearningFailure(outcome)}. ` +
        `¿Me lo explicas de otra manera, o con pasos más concretos?`,
    );
    return null;
  }

  /** Por qué no lo logró, con lo que midió el evaluador y no con excusas. */
  private describeLearningFailure(outcome: SkillDevOutcome): string {
    const last = outcome.reports[outcome.reports.length - 1];
    if (!last) return 'no se me ocurrió ningún plan que fuera siquiera válido';
    const observations = last.failureObservations.slice(0, 4);
    if (observations.length === 0) return 'ninguno de mis planes pasó las pruebas';
    return `probé ${outcome.versionsTried} plan(es) y en las pruebas fallaba (${observations.join(', ')})`;
  }

  /** Deja pedido hacer la habilidad: el cuidador la pidió, no solo enseñarla. */
  private queueSkillRun(skillName: string, raw: string): void {
    const weights = USER_REQUEST_WEIGHTS['run-skill'];
    const goal = this.goals.create(
      {
        description: `petición del usuario: ${raw}`,
        source: 'user-request',
        priority: weights.priority,
        urgency: weights.urgency,
        expectedValue: 0.6,
        preconditions: [],
        successCriteria: ['la petición queda satisfecha'],
        failureCriteria: [],
        userRequest: { kind: 'run-skill', skillName, raw },
      },
      this.tick,
    );
    this.emit('goal.created', {
      goalId: goal.id,
      description: goal.description,
      source: goal.source,
    });
  }

  private async attemptSkillCreation(
    goal: Goal,
    perception: Perception,
  ): Promise<ActionIntent | null> {
    const failures = this.progress
      .strategiesTried(goal.id)
      .filter((s) => s.forbidden)
      .map((s) => `estrategia fallida: ${s.strategy} (${s.failures} fallos)`);
    const contract: SkillContract = {
      name: SKILL_REACH_BLOCKED_FOOD,
      purpose: 'llegar hasta el alimento aunque el camino directo esté bloqueado, y consumirlo',
      motivation: failures.join('; ') || 'el camino directo al alimento falló repetidamente',
      expectedOutcome: 'la mascota consume el alimento y su energía aumenta',
      successCriteria: [{ type: 'consumedKind', kind: 'food' }, { type: 'energyIncreased' }],
    };
    const context = [
      ...failures,
      ...perception.visibleEntities.map(
        (e) => `veo: ${e.kind}${e.toolPower ? ` (herramienta, poder ${e.toolPower})` : ''}`,
      ),
    ];

    const outcome = await this.runSkillDevelopment(
      contract,
      context,
      this.config.evaluationScenarios,
    );
    // El intento se consume solo si el ciclo corrió: una excepción del
    // proveedor (red, timeout) habría abortado antes de llegar aquí y debe
    // poder reintentarse.
    this.progress.recordSkillDevAttempt(goal.id);

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

  private programForUserRequest(request: GoalUserRequest): SkillProgram {
    const targetKind = request.targetKind ?? 'unknown';
    switch (request.kind) {
      case 'wait-here':
        return [{ op: 'wait', ticks: 6 }];

      case 'craft-item':
        // La decisión de si puede ya la tomó evaluateUserRequest con los
        // ingredientes a la vista; aquí solo se expresa la intención y el
        // mundo vuelve a comprobarlo por su cuenta.
        return request.recipeId
          ? [{ op: 'craft', recipeId: request.recipeId }]
          : [{ op: 'abort', reason: 'no-sé-qué-construir' }];

      case 'run-skill': {
        const stable = request.skillName
          ? this.config.library.findStable(request.skillName)
          : undefined;
        // Solo se ejecuta lo que pasó por el evaluador: una habilidad que ya
        // no está estable (deprecada por una versión peor, archivada) no se
        // corre por inercia.
        return stable
          ? [{ op: 'runSkill', skillId: stable.id }]
          : [{ op: 'abort', reason: 'no-conozco-esa-habilidad' }];
      }

      case 'move-direction': {
        const program: SkillProgram = [];
        for (const direction of request.directions ?? []) {
          program.push(
            { op: 'moveStep', dir: direction },
            {
              op: 'branch',
              if: { type: 'lastActionFailed' },
              then: [{ op: 'abort', reason: 'camino-bloqueado' }],
            },
          );
        }
        return program.length > 0
          ? program
          : [{ op: 'abort', reason: 'dirección-no-especificada' }];
      }

      case 'fetch-item':
        return [
          { op: 'findEntities', query: { kind: targetKind }, store: 'requestedItems' },
          {
            op: 'selectTarget',
            from: 'requestedItems',
            strategy: 'nearest',
            store: 'requestedItem',
          },
          {
            op: 'branch',
            if: { type: 'not', cond: { type: 'holding', target: 'requestedItem' } },
            then: [
              { op: 'moveToward', target: 'requestedItem', maxSteps: 40 },
              {
                op: 'branch',
                if: { type: 'lastMoveBlocked' },
                then: [{ op: 'abort', reason: 'camino-bloqueado' }],
              },
              { op: 'pickup', target: 'requestedItem' },
              {
                op: 'branch',
                if: { type: 'lastActionFailed' },
                then: [{ op: 'abort', reason: 'no-pude-recogerlo' }],
              },
            ],
          },
        ];

      case 'consume-item': {
        const stable =
          targetKind === 'food'
            ? this.config.library.findStable(SKILL_REACH_BLOCKED_FOOD)
            : undefined;
        if (stable) return [{ op: 'runSkill', skillId: stable.id }];
        return [
          { op: 'findEntities', query: { kind: targetKind }, store: 'requestedFoods' },
          {
            op: 'selectTarget',
            from: 'requestedFoods',
            strategy: 'nearest',
            store: 'requestedFood',
          },
          {
            op: 'branch',
            if: { type: 'not', cond: { type: 'holding', target: 'requestedFood' } },
            then: [
              { op: 'moveToward', target: 'requestedFood', maxSteps: 40 },
              {
                op: 'branch',
                if: { type: 'lastMoveBlocked' },
                then: [{ op: 'abort', reason: 'camino-bloqueado' }],
              },
            ],
          },
          { op: 'consume', target: 'requestedFood' },
          {
            op: 'branch',
            if: { type: 'lastActionFailed' },
            then: [{ op: 'abort', reason: 'no-pude-comerlo' }],
          },
        ];
      }

      case 'destroy-entity':
        return [
          { op: 'findEntities', query: { kind: targetKind }, store: 'requestedTargets' },
          {
            op: 'selectTarget',
            from: 'requestedTargets',
            strategy: 'nearest',
            store: 'requestedTarget',
          },
          { op: 'findEntities', query: { tool: true }, store: 'availableTools' },
          {
            op: 'selectTarget',
            from: 'availableTools',
            strategy: 'strongestTool',
            store: 'bestTool',
          },
          {
            op: 'branch',
            if: { type: 'not', cond: { type: 'holding', target: 'bestTool' } },
            then: [
              { op: 'moveToward', target: 'bestTool', maxSteps: 40 },
              { op: 'pickup', target: 'bestTool' },
              {
                op: 'branch',
                if: { type: 'lastActionFailed' },
                then: [{ op: 'abort', reason: 'no-pude-recoger-la-herramienta' }],
              },
            ],
          },
          { op: 'moveToward', target: 'requestedTarget', maxSteps: 40 },
          {
            op: 'branch',
            if: { type: 'lastMoveBlocked' },
            then: [{ op: 'abort', reason: 'camino-bloqueado' }],
          },
          {
            op: 'repeatWithLimit',
            max: 20,
            until: { type: 'entityGone', ref: 'requestedTarget' },
            body: [{ op: 'useItem', item: 'bestTool', target: 'requestedTarget' }],
          },
          {
            op: 'branch',
            if: { type: 'not', cond: { type: 'entityGone', ref: 'requestedTarget' } },
            then: [{ op: 'abort', reason: 'objetivo-resistió' }],
          },
        ];
    }
  }

  private completionReply(request: GoalUserRequest): string {
    const target =
      {
        food: 'el alimento',
        wall: 'el muro',
        branch: 'la rama',
        hammer: 'el martillo',
        tree: 'el árbol',
      }[request.targetKind ?? ''] ?? 'eso';
    switch (request.kind) {
      case 'wait-here':
        return 'Listo, esperé aquí un momento.';
      case 'run-skill':
        return `Listo, hice "${request.skillName ?? 'eso'}".`;
      case 'craft-item':
        return 'Listo, ya está construida.';
      case 'move-direction': {
        const labels = {
          up: 'hacia arriba',
          down: 'hacia abajo',
          left: 'a la izquierda',
          right: 'a la derecha',
        } as const;
        const destination = (request.directions ?? [])
          .map((direction) => labels[direction])
          .join(' y ');
        return `Listo, me moví ${destination}.`;
      }
      case 'fetch-item':
        return `Listo, recogí ${target}.`;
      case 'consume-item':
        return `Listo, comí ${target}.`;
      case 'destroy-entity':
        return `Listo, destruí ${target}.`;
    }
  }

  private startUserActivity(
    goal: Goal,
    program: SkillProgram,
    completionReply: string,
    perception: Perception,
  ): void {
    this.emit('strategy.selected', { goalId: goal.id, strategy: 'petición-del-usuario' });
    this.activity = {
      goalId: goal.id,
      strategy: 'petición-del-usuario',
      exec: new SkillExecution(program, this.petId, { library: this.config.library }),
      purpose: 'user-request',
      completionReply,
      requestRaw: goal.userRequest?.raw ?? goal.description,
      consumedFood: false,
      energyAtStart: perception.self.energy?.current ?? 0,
    };
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
      purpose: 'restore-energy',
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

    if (activity.purpose === 'user-request') {
      const success = out.result.outcome === 'completed';
      if (success) {
        this.goals.complete(activity.goalId);
        this.emit('goal.completed', { goalId: activity.goalId, strategy: activity.strategy });
        this.memory.recordEpisode({
          kind: 'promise-kept',
          summary: `cumplí la petición: ${activity.requestRaw ?? activity.strategy}`,
          tick: this.tick,
          importance: 0.7,
        });
        this.reply(activity.completionReply ?? 'Listo.');
      } else {
        this.goals.fail(activity.goalId);
        this.emit('strategy.failed', {
          goalId: activity.goalId,
          strategy: activity.strategy,
          outcome: out.result.outcome,
          reason: out.result.reason ?? null,
        });
        this.memory.recordEpisode({
          kind: 'failure',
          summary: `no pude cumplir la petición ${activity.requestRaw ?? ''}: ${out.result.reason ?? out.result.outcome}`,
          tick: this.tick,
          importance: 0.6,
        });
        this.reply(
          `No pude completar eso: ${this.describeActivityFailure(out.result.reason ?? out.result.outcome)}.`,
        );
      }
      this.lastSelectedGoalId = null;
      return null;
    }

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
      const firstDiscovery = !this.memory
        .episodeList()
        .some((episode) => episode.kind === 'discovery');
      this.creditEatingEvidence('goal-completed');
      const consolidation = this.memory.consolidate(this.tick);
      if (consolidation.hypothesesConfirmed.length > 0) {
        this.emit('memory.consolidated', { confirmed: consolidation.hypothesesConfirmed });
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
      if (firstDiscovery) this.reply(this.explainLearning());
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

  private describeActivityFailure(reason: string): string {
    if (reason.startsWith('no-candidates:')) return 'no encuentro el objeto';
    const descriptions: Record<string, string> = {
      'no-conozco-esa-habilidad': 'ya no tengo esa habilidad disponible',
      'camino-bloqueado': 'el camino está bloqueado',
      'no-pude-recogerlo': 'no pude recoger el objeto',
      'no-pude-comerlo': 'no pude comer el alimento',
      'no-pude-recoger-la-herramienta': 'no pude recoger la herramienta',
      'objetivo-resistió': 'el objeto resistió mis intentos',
      completed: 'la acción no produjo el resultado esperado',
      aborted: 'tuve que detenerme',
    };
    return descriptions[reason] ?? reason.replaceAll('-', ' ');
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
