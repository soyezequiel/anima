import type { EventLog, Vec2 } from '@anima/shared';
import { chebyshev, countedKindLabel, createEventLog, isFeminineKind, kindLabel, kindWithArticle, manhattan } from '@anima/shared';
import type { ActionIntent, Direction, EntityId, Perception, Recipe, SimEvent } from '@anima/sim-core';
import {
  blueprintCounts,
  expandRecipeCost,
  missingIngredients,
  recipeProduces,
  recipeProducing,
  recipeProduct,
  validateRecipe,
} from '@anima/sim-core';
import type { MemoryData, MemoryStore } from '@anima/memory';
import { MemoryStore as MemoryStoreImpl } from '@anima/memory';
import type { CommandInterpretation, ModelProvider, ModelRequest } from '@anima/model-providers';
import type { EvaluationCriterion, SkillDefinition, SkillLibrary, SkillProgram } from '@anima/skill-runtime';
import {
  describeCriterion,
  SkillExecution,
  SpatialMemory,
  validateSuccessCriteria,
} from '@anima/skill-runtime';
import type { NamedScenario, RegressionStore } from '@anima/skill-evaluator';
import type { AgentEvent } from './events.js';
import type { Goal, GoalManagerData, GoalUserRequest, LearningContract } from './goals.js';
import { GoalManager } from './goals.js';
import type { PersonalityTrait } from './personality.js';
import { derivePersonality } from './personality.js';
import type { PlaceMemoryData } from './place-memory.js';
import { PlaceMemory } from './place-memory.js';
import type { ProgressData } from './progress.js';
import { ProgressController } from './progress.js';
import type { RequestDecision, UserRequest } from './refusal.js';
import {
  displayMissing,
  evaluateUserRequest,
  isAffirmativeReply,
  isContinuationMessage,
  isNegativeReply,
  parseUserMessage,
} from './refusal.js';
import type { SkillContract, SkillDevOutcome } from './skill-dev.js';
import { developSkill, evaluateAndApply } from './skill-dev.js';
import { InventionEngine } from './invention.js';
import {
  GOAL_BE_SAFE,
  GOAL_RESTORE_ENERGY,
  GOAL_RESTORE_WARMTH,
  normalizeSkillName,
  SKILL_GET_WARM,
  SKILL_REACH_BLOCKED_FOOD,
} from './names.js';
import {
  buildFireProgram,
  DIRECT_APPROACH_PROGRAM,
  heldCounts,
  rememberedFoodProgram,
  rememberedHeatProgram,
  retreatProgram,
  SHELTER_APPROACH_PROGRAM,
  stepsToward,
  WARMTH_APPROACH_PROGRAM,
} from './programs.js';
import type { UserRequestProgramDeps } from './user-request-programs.js';
import { completionReply, programForUserRequest } from './user-request-programs.js';

const LOW_ENERGY_FRACTION = 0.35;
const LOW_TEMPERATURE_FRACTION = 0.35;
/**
 * Bajo esta fracción de salud, con el peligro todavía al alcance, el dolor
 * deja de ser un reflejo de un paso y pasa a ser un motivo: nace el objetivo
 * de ponerse a salvo, por encima del hambre — morirse ahora le gana a comer
 * después.
 */
const LOW_HEALTH_FRACTION = 0.5;
/**
 * Distancia (Chebyshev) a la que lo que daña deja de alcanzarla. Es la misma
 * distancia prudente del fuego (calienta a 2, quema a 1, ADR 0017): exigir
 * más chocaría con calentarse, que ocurre exactamente a 2.
 */
const SAFE_DISTANCE = 2;

/**
 * Verbo del recuerdo de acción según lo destruido (ADR 0033): romper una
 * pared y talar un árbol son gestos distintos aunque el evento sea el mismo.
 */
const DEED_VERBS: Record<string, string> = {
  tree: 'talé',
};

/** Prioridad y urgencia por tipo de petición: los objetivos son estructuras. */
const USER_REQUEST_WEIGHTS: Record<
  GoalUserRequest['kind'],
  { priority: number; urgency: number }
> = {
  'consume-item': { priority: 1, urgency: 0.8 },
  'move-direction': { priority: 1, urgency: 0.75 },
  'run-skill': { priority: 1, urgency: 0.7 },
  'craft-item': { priority: 1, urgency: 0.7 },
  'interact-entity': { priority: 1, urgency: 0.7 },
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
  | { kind: 'learn-skill'; summary: string; raw: string }
  | { kind: 'rename-pet'; name: string; raw: string }
  /** El cuidador describe un objeto nuevo para que exista en el mundo. */
  | { kind: 'describe-entity'; description: string; raw: string };

/**
 * Una descripción del cuidador ya traducida a receta y aceptada por la puerta.
 * La receta viaja CRUDA: al confirmarse va al mundo por `proposeRecipe` y
 * step.ts vuelve a validarla — la vista previa no es un permiso.
 */
interface InventionProposal {
  recipe: unknown;
  recipeId: string;
  outputKind: string;
}

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
  /** Dónde vio por última vez lo que le importa. Falta en guardados viejos. */
  places?: PlaceMemoryData;
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
  /** Rasgos derivados de la historia de la antecesora ("curiosa", ...). */
  traits?: string[];
}

interface Activity {
  goalId: string;
  strategy: string;
  exec: SkillExecution;
  purpose: 'restore-energy' | 'user-request' | 'be-safe';
  completionReply?: string;
  requestRaw?: string;
  skillId?: string;
  /** Recuerdo que esta actividad fue a comprobar: se invalida si mintió. */
  rememberedPlaceId?: string;
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
  /** Memoria espacial: construida SOLO con percepciones pasadas. */
  readonly places = new PlaceMemory();
  /**
   * Huellas y golpes: celdas pisadas y celdas que el mundo rechazó. Una sola
   * instancia para todas las ejecuciones de skills, así lo aprendido buscando
   * comida sirve al explorar después — y viceversa.
   */
  readonly spatial = new SpatialMemory();
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
  /** El pipeline de invención: recetas e interacciones, un solo triaje. */
  private readonly invention: InventionEngine;
  /** Vista previa esperando el sí o el no del cuidador. Efímera: no persiste. */
  private pendingInvention: InventionProposal | null = null;
  /** Idea confirmada que el próximo think() lleva al mundo como intención. */
  private inventionToPropose: InventionProposal | null = null;
  /** Propuesta confirmada en vuelo: su veredicto del mundo se cuenta en el chat. */
  private awaitingInventionVerdict: { recipeId: string; outputKind: string } | null = null;
  /**
   * Contrato de una habilidad enseñada esperando el sí o el no del cuidador
   * (ADR 0030). El criterio de un pedido son palabras, y las palabras no tienen
   * firma en el mundo: nada se aprende contra una vara que una persona no miró.
   * Efímero, como la vista previa de una receta: no persiste.
   */
  private pendingContract: LearningContract | null = null;
  /** Qué la dañó en el último tick: dispara el reflejo de apartarse. */
  private lastPain: { sourceId: string; sourceKind: string; tick: number } | null = null;
  private lastSelectedGoalId: string | null = null;
  private lastUserRequest: UserRequest | null = null;
  /** Su nombre actual. La identidad persiste fuera; esto alimenta su habla. */
  private petName: string;
  /** Comestibles visibles al suspender cada objetivo: reactivar exige uno NUEVO. */
  private suspensionEdibles = new Map<string, Set<string>>();
  private tick = 0;

  constructor(config: AgentConfig) {
    this.config = {
      maxSkillDevAttempts: 1,
      // Un modelo real suele necesitar más iteraciones que el mock: las
      // versiones inválidas no consumen intento, pero las rechazadas sí. Con
      // la revisión informada (historia + resultados por mundo) cada intento
      // extra tiene con qué corregir, así que el crédito es más alto.
      maxVersionsPerDev: 8,
      ...config,
    };
    this.petName = config.petName;
    // El pipeline no recibe la clase entera: solo los órganos que necesita,
    // por funciones — así queda a la vista qué puede tocar y qué no.
    this.invention = new InventionEngine({
      provider: this.config.provider,
      memory: this.memory,
      goals: this.goals,
      progress: this.progress,
      emit: (type, data) => this.emit(type, data),
      reply: (text) => this.reply(text),
      currentTick: () => this.tick,
    });
  }

  /** Lo que los programas de peticiones necesitan saber del agente. */
  private userProgramDeps(perception: Perception): UserRequestProgramDeps {
    return {
      library: this.config.library,
      findInteraction: (verb, targetKind, p) =>
        this.invention.findInteractionFor(verb, targetKind, p),
      // La memoria de lugares aporta el destino cuando el material no se ve
      // pero se recuerda (ADR 0025): mismo puente que ya usan la comida y el
      // calor recordados, ahora para juntar y construir. Solo el destino —
      // recoger sigue exigiendo percibirlo al llegar.
      rememberedWalk: (kind) => {
        const remembered = this.places.recall({ kind }, perception)[0];
        return remembered
          ? this.walkStepsAvoidingHazards(perception, remembered.position, 1)
          : undefined;
      },
    };
  }

  /**
   * Sus rasgos, derivados en el momento de su historia real (eventos y
   * episodios, que ya persisten): no hay nada extra que guardar y ningún
   * modelo que consultar. Misma vida, misma personalidad. Ver ADR 0021.
   */
  personality(): PersonalityTrait[] {
    return derivePersonality({
      events: this.events.events,
      episodes: this.memory.episodeList({ includeArchived: true }),
      hypotheses: this.memory.hypothesisList(),
    });
  }

  /** Sincroniza el nombre al restaurar una sesión. No es un bautismo: ni
   * episodio ni evento — la mascota ya vivió ese momento. */
  setName(name: string): void {
    if (name.trim()) this.petName = name.trim();
  }

  /**
   * El cuidador le pone nombre (por chat o desde la interfaz). Es un momento
   * significativo: queda como episodio, se anuncia con un evento para que la
   * capa de identidad lo persista, y ella lo estrena en voz alta.
   */
  receiveNameFromCaretaker(rawName: string): void {
    const name = rawName.replace(/\s+/g, ' ').trim().slice(0, 24).trim();
    if (!name) {
      this.reply('¿Y cómo querés llamarme? No escuché ningún nombre.');
      return;
    }
    const previousName = this.petName;
    this.petName = name;
    this.emit('pet.renamed', { name, previousName });
    this.memory.recordEpisode({
      kind: 'caretaker',
      summary: `mi cuidador me puso el nombre ${name}`,
      tick: this.tick,
      importance: 0.85,
    });
    this.reply(
      previousName === name
        ? `Ya me llamo ${name}, ¡y me gusta!`
        : `¡${name}! Me gusta ese nombre. Desde ahora soy ${name}.`,
    );
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
      places: this.places.serialize(),
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
    // Un guardado anterior a la memoria de lugares llega sin el campo: se
    // restaura como lo que era, una mascota que aún no recordaba lugares.
    this.places.loadFrom(clone.places ?? { places: [] });
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
            parsed.kind === 'craft-item' ||
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
    // La actividad en curso y las colas efímeras no se persisten. La vista
    // previa también muere aquí: una confirmación no puede sobrevivir a la
    // sesión en la que se mostró lo que confirmaba.
    this.activity = null;
    this.pendingSpeech = [];
    this.pendingUserMessages = [];
    this.pendingExplanation = null;
    this.pendingInvention = null;
    this.inventionToPropose = null;
    this.awaitingInventionVerdict = null;
    this.pendingContract = null;
  }

  // ---- legado ---------------------------------------------------------------

  /**
   * Recibe el testimonio de una antecesora. El conocimiento entra como
   * hipótesis "según X, ..." (no como hechos propios) y cada habilidad
   * heredada se re-evalúa en mundos aislados antes de poder promoverse.
   */
  adoptLegacy(testimony: LegacyTestimony): {
    adoptedSkills: {
      name: string;
      version: number;
      promoted: boolean;
      /** Legado de pedido (o de origen ausente) esperando que la cuidadora
       * confirme su criterio antes de promoverse (ADR 0030 fase E). */
      needsConfirmation?: boolean;
    }[];
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
    // La personalidad no se hereda — se gana viviendo —, pero saber cómo era
    // la antecesora sí es parte del testimonio: "mi antecesora era curiosa".
    if (testimony.traits && testimony.traits.length > 0) {
      this.memory.recordEpisode({
        kind: 'legacy-traits',
        summary: `mi antecesora ${testimony.fromName} era ${testimony.traits.join(', ')}`,
        tick: this.tick,
        importance: 0.7,
      });
    }

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

    const adoptedSkills: {
      name: string;
      version: number;
      promoted: boolean;
      needsConfirmation?: boolean;
    }[] = [];
    let awaitingConfirmation = 0;
    for (const artifact of testimony.skills) {
      const candidate = this.config.library.addExperimental({
        name: artifact.name,
        description: artifact.description,
        motivation: `heredada de ${testimony.fromName} (generación ${testimony.generation}); debe demostrar que funciona en mi propio mundo`,
        program: structuredClone(artifact.program),
        expectedOutcome: artifact.expectedOutcome,
        successCriteria: structuredClone(artifact.successCriteria),
        // El origen de la vara viaja con el legado (ADR 0030): una skill de
        // motivo se re-certifica sola en el mundo de la heredera; una de pedido
        // arrastra la vara que su antecesora ya confirmó. Ausente = artefacto
        // anterior al ADR, y así queda anotado para re-confirmarse.
        ...(artifact.criterionSource !== undefined
          ? { criterionSource: artifact.criterionSource }
          : {}),
        createdAt: this.now(),
      });
      this.emit('skill.created', {
        skillId: candidate.id,
        name: candidate.name,
        version: candidate.version,
        rationale: `artefacto heredado de ${testimony.fromName}`,
      });

      // El criterio de un motivo (hambre, frío) es una constante del motor: la
      // heredera lo re-derivaría igual y no admite trampa, así que se re-evalúa
      // en su propio mundo y se promueve sola. El de un PEDIDO —o el AUSENTE, de
      // un guardado anterior al ADR 0030— nació de palabras que la heredera no
      // miró: promoverlo re-certificaría contra una vara que nadie confirmó, y
      // el error se lavaría generación tras generación. Ese se adopta como
      // experimental y espera que la cuidadora confirme su criterio (fase E).
      if (artifact.criterionSource === 'motive') {
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
        continue;
      }

      awaitingConfirmation += 1;
      this.emit('skill.inherited.unconfirmed', {
        skillId: candidate.id,
        name: candidate.name,
        version: candidate.version,
        criteria: candidate.successCriteria.map(describeCriterion),
        origin: artifact.criterionSource ?? 'ausente',
      });
      this.memory.recordEpisode({
        kind: 'legacy',
        summary: `heredé la conducta "${candidate.name}" pero su criterio necesita que mi cuidadora lo confirme`,
        tick: this.tick,
        importance: 0.6,
      });
      adoptedSkills.push({
        name: candidate.name,
        version: candidate.version,
        promoted: false,
        needsConfirmation: true,
      });
    }

    if (testimony.message !== undefined && testimony.message.length > 0) {
      this.reply(`Mi antecesora me dejó un mensaje: "${testimony.message}"`);
    }
    // Las conductas heredadas por pedido no se dan por probadas hasta que su
    // cuidadora confirme el criterio: se re-confirman re-enseñándolas (vuelven a
    // pasar por el portón de la fase D). Decirlo evita que parezcan perdidas.
    if (awaitingConfirmation > 0) {
      const plural = awaitingConfirmation === 1;
      this.reply(
        `Heredé ${awaitingConfirmation} conducta${plural ? '' : 's'} que mi antecesora aprendió por ` +
          `pedido. No ${plural ? 'la' : 'las'} doy por prob${plural ? 'ada' : 'adas'} hasta que ` +
          `me ${plural ? 'la' : 'las'} vuelvas a enseñar y confirmes su criterio.`,
      );
    }
    return { adoptedSkills };
  }

  /** Un paso de decisión. Devuelve la intención para este tick (o ninguna). */
  async think(perception: Perception): Promise<ActionIntent | null> {
    this.tick = perception.tick;
    // Cada percepción alimenta la memoria de lugares: dónde vio por última
    // vez lo que le importa. Es lo único que puede apuntar fuera de su vista.
    this.places.update(perception);

    // Mantenimiento periódico de la memoria (ADR 0033): consolidar solo en
    // los éxitos de meta dejaba que una vida sin éxitos acumulara episodios
    // sin techo. Cada tanto, la memoria se ordena sola.
    if (this.tick > 0 && this.tick % 100 === 0) {
      const consolidation = this.memory.consolidate(this.tick);
      if (consolidation.hypothesesConfirmed.length > 0) {
        this.emit('memory.consolidated', { confirmed: consolidation.hypothesesConfirmed });
      }
    }

    // El dolor manda: antes de conversar, planificar o continuar nada, el
    // cuerpo se aparta de lo que lo está dañando. Es un reflejo, no una
    // decisión — como detenerse a distancia del fuego, viene de fábrica.
    const reflex = this.painReflex(perception);
    if (reflex) return reflex;

    await this.processUserMessages(perception);
    await this.processSignals(perception);

    const speech = this.pendingSpeech.shift();
    if (speech !== undefined) return { type: 'speak', text: speech };

    // La idea que el cuidador confirmó viaja al mundo como cualquier invento
    // propio: por `proposeRecipe`, para que step.ts la vuelva a juzgar. No hay
    // camino a world.recipes que se salte esa puerta, tampoco para él.
    if (this.inventionToPropose) {
      const invention = this.inventionToPropose;
      this.inventionToPropose = null;
      this.awaitingInventionVerdict = {
        recipeId: invention.recipeId,
        outputKind: invention.outputKind,
      };
      return { type: 'proposeRecipe', recipe: invention.recipe };
    }

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
   * Apartarse de lo que la está dañando. Un paso, en la dirección que más la
   * aleje de la fuente, evitando sólidos visibles. Si está acorralada no hay
   * paso que dar y el reflejo cede el turno al resto de la mente.
   *
   * Sin esto, la mascota se quedaba pegada a un fuego perdiendo 1 de salud
   * por tick hasta morir — incluida la fogata que ella misma acababa de
   * construir, porque craftear la deja adyacente a lo construido.
   */
  private painReflex(perception: Perception): ActionIntent | null {
    const pain = this.lastPain;
    if (!pain || this.tick - pain.tick > 1) return null;
    this.lastPain = null;

    const source = perception.visibleEntities.find((e) => e.id === pain.sourceId);
    const selfPos = perception.self.position;
    if (!source?.position) return null;
    const sourcePos = source.position;
    if (Math.max(Math.abs(sourcePos.x - selfPos.x), Math.abs(sourcePos.y - selfPos.y)) > 1) {
      return null; // Ya está fuera de alcance: no hay de qué huir.
    }

    const candidates = [
      { dir: 'up', delta: { x: 0, y: -1 } },
      { dir: 'down', delta: { x: 0, y: 1 } },
      { dir: 'left', delta: { x: -1, y: 0 } },
      { dir: 'right', delta: { x: 1, y: 0 } },
    ] as const;
    const escape = candidates
      .map(({ dir, delta }) => {
        const dest = { x: selfPos.x + delta.x, y: selfPos.y + delta.y };
        return {
          dir,
          gain: Math.max(Math.abs(sourcePos.x - dest.x), Math.abs(sourcePos.y - dest.y)),
          blocked: perception.visibleEntities.some(
            (e) => e.solid && e.position && e.position.x === dest.x && e.position.y === dest.y,
          ),
        };
      })
      .filter((option) => !option.blocked && option.gain > 1)
      .sort((a, b) => b.gain - a.gain)[0];
    if (!escape) return null;

    this.emit('pain.reflex', { sourceId: pain.sourceId, sourceKind: pain.sourceKind });
    return { type: 'move', dir: escape.dir };
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
    // `entity.destroyed` no dice con qué se rompió, pero el `entity.damaged`
    // del mismo lote sí: el golpe fatal siempre viaja justo antes de la
    // destrucción. El mapa reconstruye la herramienta del recuerdo.
    const damagedWith = new Map<string, string>();
    for (const event of events) {
      if (
        event.type === 'entity.damaged' &&
        event.data.byId === this.petId &&
        typeof event.data.id === 'string' &&
        typeof event.data.itemKind === 'string'
      ) {
        damagedWith.set(event.data.id, event.data.itemKind);
      }
    }
    for (const event of events) {
      // Lo que ella misma consumió, recogió o destruyó ya no está donde lo
      // recordaba: la memoria de lugares se corrige con lo que hizo su propio
      // cuerpo (solo lo suyo: los eventos ajenos no son percepción).
      if (
        (event.type === 'item.consumed' || event.type === 'item.pickedUp') &&
        event.data.actorId === this.petId &&
        typeof event.data.itemId === 'string'
      ) {
        this.places.forget(event.data.itemId);
      }
      if (
        event.type === 'entity.destroyed' &&
        event.data.byId === this.petId &&
        typeof event.data.id === 'string'
      ) {
        this.places.forget(event.data.id);
        // Recuerdo de acción propia (ADR 0033): "rompí un wall con hammer".
        // El summary es estable a propósito: repetir la acción no crea otro
        // recuerdo, incrementa el conteo del mismo.
        const targetKind = String(event.data.kind);
        const verb = DEED_VERBS[targetKind] ?? 'rompí';
        const itemKind = damagedWith.get(event.data.id);
        this.recordDeed(
          itemKind !== undefined
            ? `${verb} un ${targetKind} con ${itemKind}`
            : `${verb} un ${targetKind}`,
          0.6,
          { targetKind, ...(itemKind !== undefined ? { itemKind } : {}) },
        );
      }
      if (event.type === 'item.crafted' && event.data.actorId === this.petId) {
        const itemKind = String(event.data.itemKind);
        this.recordDeed(`construí un ${itemKind}`, 0.6, {
          itemKind,
          recipeId: event.data.recipeId,
        });
      }
      if (event.type === 'item.placed' && event.data.actorId === this.petId) {
        const itemKind = String(event.data.itemKind);
        this.recordDeed(`coloqué un ${itemKind}`, 0.5, { itemKind });
      }
      if (event.type === 'item.consumed' && event.data.actorId === this.petId) {
        this.recordDeed(`comí un ${String(event.data.itemKind)}`, 0.35, {
          itemKind: event.data.itemKind,
        });
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
      // Dolor recibido: dispara el reflejo de apartarse en el próximo think()
      // y deja conocimiento — el reflejo pasa, lo aprendido queda.
      if (
        event.type === 'entity.damaged' &&
        event.data.id === this.petId &&
        typeof event.data.byId === 'string' &&
        typeof event.data.damage === 'number' &&
        event.data.damage > 0
      ) {
        const sourceKind = String(event.data.itemKind);
        this.lastPain = { sourceId: event.data.byId, sourceKind, tick: this.tick };
        const statement = `estar pegado a un ${kindLabel(sourceKind)} hace daño`;
        if (!this.memory.factList().some((f) => f.statement === statement)) {
          const fact = this.memory.addFact(statement, this.tick);
          this.emit('memory.created', { kind: 'fact', statement: fact.statement });
          this.memory.recordEpisode({
            kind: 'pain',
            summary: `me lastimé con ${kindLabel(sourceKind)} y me aparté`,
            tick: this.tick,
            importance: 0.8,
          });
        }
      }
      // El mundo rechazó un invento: el motivo se recuerda y viaja al próximo
      // intento. Sin esto insistiría con la misma idea imposible para siempre.
      if (event.type === 'recipe.rejected' && event.data.actorId === this.petId) {
        const reason = String(event.data.reason);
        this.invention.recordWorldRejection('recipe', reason);
        // Una idea confirmada por el cuidador que el mundo aun así rechazó
        // (solo posible si el mundo cambió entre la vista previa y el sí):
        // decirlo, en vez de dejar la confirmación sin respuesta.
        if (this.awaitingInventionVerdict) {
          this.awaitingInventionVerdict = null;
          this.reply(`Al final mi mundo no la aceptó: ${reason}`);
        }
      }
      // Interacciones (ADR 0027): mismo trato que las recetas. El rechazo del
      // mundo viaja al próximo intento; lo aceptado queda como regla y como
      // recuerdo — y nunca más hay que inventarlo.
      if (event.type === 'interaction.rejected' && event.data.actorId === this.petId) {
        this.invention.recordWorldRejection('interaction', String(event.data.reason));
      }
      // Planos (ADR 0032): el mundo rechazó una obra (demasiado grande para sus
      // brazos, un bloque imposible). El motivo viaja a la próxima idea para
      // que proponga una casa que sí pueda levantar, en vez de reintentar la
      // misma. Sin esto, la obra rechazada se repetía hasta gastar el crédito.
      if (event.type === 'blueprint.rejected' && event.data.actorId === this.petId) {
        this.invention.recordWorldRejection('blueprint', String(event.data.reason));
      }
      if (event.type === 'interaction.learned' && event.data.actorId === this.petId) {
        const interactionId = String(event.data.interactionId);
        const description = String(event.data.description ?? interactionId);
        const fact = this.memory.addFact(`aprendí a ${description}`, this.tick);
        this.emit('memory.created', { kind: 'fact', statement: fact.statement });
        this.emit('interaction.learned', { interactionId, description });
        this.memory.recordEpisode({
          kind: 'interaction-invented',
          summary: `inventé una interacción y mi mundo la aceptó: ${description}`,
          tick: this.tick,
          importance: 0.85,
        });
        this.reply(
          `¡Mi mundo lo aceptó! Ya sé ${description}, y quedó aprendido: no hace falta inventarlo de nuevo.`,
        );
      }
      // Lo que el mundo aceptó pasa a ser conocimiento suyo, y sobrevive a su
      // muerte: la receta vive en el mundo, el saber que existe en su memoria.
      if (event.type === 'recipe.learned' && event.data.actorId === this.petId) {
        const outputKind = String(event.data.outputKind);
        const fact = this.memory.addFact(`puedo construir ${outputKind}`, this.tick);
        this.emit('memory.created', { kind: 'fact', statement: fact.statement });
        this.emit('recipe.learned', {
          recipeId: event.data.recipeId,
          outputKind: event.data.outputKind,
        });
        const fromCaretaker = this.awaitingInventionVerdict?.recipeId === event.data.recipeId;
        if (fromCaretaker) {
          // La idea nació de la descripción del cuidador: es un recuerdo del
          // vínculo, y la confirmación merece un cierre en el chat.
          this.awaitingInventionVerdict = null;
          this.memory.recordEpisode({
            kind: 'caretaker',
            summary: `mi cuidador me describió ${kindLabel(outputKind)} y ahora es parte de mi mundo`,
            tick: this.tick,
            importance: 0.85,
          });
          this.reply(
            `¡Listo! Ya sé construir ${kindWithArticle(outputKind)}. ` +
              `Pedime «hacé ${kindWithArticle(outputKind)}» cuando quieras.`,
          );
        } else {
          this.memory.recordEpisode({
            kind: 'recipe-invented',
            summary: `se me ocurrió cómo construir ${outputKind} y funcionó`,
            tick: this.tick,
            importance: 0.9,
          });
        }
      }
    }
  }

  // ---- señales internas ---------------------------------------------------

  private async processSignals(perception: Perception): Promise<void> {
    // El dolor primero: si está malherida junto a un peligro, entender el
    // hambre puede esperar un tick.
    await this.processPainSignal(perception);
    await this.processEnergySignal(perception);
    await this.processColdSignal(perception);
  }

  /** Le duele tocarlo: lo aprendió con su cuerpo («estar pegado a...»). */
  private hurtsToTouch(kind: string): boolean {
    const statement = `estar pegado a un ${kindLabel(kind)} hace daño`;
    return this.memory.factList().some((f) => f.statement === statement);
  }

  /**
   * Posiciones de los peligros que CONOCE: los que ve ahora y los que
   * recuerda. Conocer viene de los hechos de dolor, no del motor: un peligro
   * que nunca la lastimó no está en esta lista, y eso es correcto.
   */
  private knownHazardPositions(perception: Perception): Vec2[] {
    const positions: Vec2[] = [];
    const visibleIds = new Set<string>();
    for (const entity of perception.visibleEntities) {
      visibleIds.add(entity.id);
      if (entity.position && this.hurtsToTouch(entity.kind)) positions.push(entity.position);
    }
    for (const place of this.places.all()) {
      if (!visibleIds.has(place.entityId) && this.hurtsToTouch(place.kind)) {
        positions.push(place.position);
      }
    }
    return positions;
  }

  /**
   * Pasos hacia una posición evitando TERMINAR pegada a lo que sabe que daña.
   * La consulta de los hechos de dolor vive aquí, al generar el programa: el
   * intérprete de la DSL no se entera y sigue igual de simple. De las dos
   * variantes deterministas del camino se prefiere la que no acaba junto a un
   * peligro; si ninguna lo evita, llegar importa más que el rasguño (y el
   * reflejo sigue existiendo).
   */
  private walkStepsAvoidingHazards(perception: Perception, to: Vec2, stopAt: number): Direction[] {
    const hazards = this.knownHazardPositions(perception);
    const risky = (cell: Vec2): boolean => hazards.some((h) => chebyshev(h, cell) <= 1);
    const variants = (['x', 'y'] as const).map((axis) =>
      stepsToward(perception.self.position, to, stopAt, axis),
    );
    return (variants.find((v) => !risky(v.end)) ?? variants[0]!).dirs;
  }

  /**
   * El dolor sostenido es una señal del cuerpo, como el frío (ADR 0017):
   * cuando la salud cae bajo el umbral Y un peligro conocido sigue al
   * alcance, apartarse deja de ser el reflejo de un paso y pasa a ser un
   * objetivo con prioridad por encima del hambre. El reflejo (painReflex)
   * queda intacto: esto es lo que pasa cuando el reflejo no alcanzó.
   */
  private async processPainSignal(perception: Perception): Promise<void> {
    const health = perception.self.health;
    if (!health) return;
    const fraction = health.current / health.max;
    if (fraction >= LOW_HEALTH_FRACTION) return;
    // Sin un peligro conocido al alcance no hay de qué ponerse a salvo: la
    // salud también se agota por hambre o por frío, y esas señales ya tienen
    // su propio objetivo.
    const selfPos = perception.self.position;
    const nearHazard = this.knownHazardPositions(perception).some(
      (h) => chebyshev(selfPos, h) < SAFE_DISTANCE,
    );
    if (!nearHazard) return;
    if (this.goals.findOpen(GOAL_BE_SAFE)) return;

    const alreadyUnderstands =
      this.memory.factList().some((f) => f.statement.includes('a salvo') || f.statement.includes('alejar')) ||
      this.memory
        .hypothesisList()
        .some((h) => h.statement.includes('a salvo') || h.statement.includes('alejar'));
    if (!alreadyUnderstands) {
      if (this.config.guidanceEnabled) {
        this.emit('guidance.shown', {
          signal: 'health-low',
          hint: 'evidencia histórica: criaturas que siguen junto a lo que las daña dejan de existir',
        });
      }
      try {
        const interpretation = await this.config.provider.complete({
          kind: 'interpret.signal',
          signal: 'health-low',
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
        // Sin interpretación igual le duele: el objetivo nace lo mismo, y el
        // cuerpo no espera a que el modelo conteste.
        this.emit('provider.error', {
          provider: this.config.provider.name,
          operation: 'interpret.signal',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      this.memory.recordEpisode({
        kind: 'signal',
        summary: 'estoy malherida y necesito ponerme a salvo',
        tick: this.tick,
        importance: 0.9,
      });
    }

    const goal = this.goals.create(
      {
        description: GOAL_BE_SAFE,
        source: 'internal-signal',
        // 1.5 + urgencia mínima (0.5 al cruzar el umbral) supera el máximo
        // alcanzable por hambre (0.9+1), frío (0.95+1) y peticiones (1+0.8):
        // morirse ahora le gana a comer después.
        priority: 1.5,
        urgency: Math.min(1, 1 - fraction),
        expectedValue: 1,
        preconditions: [],
        successCriteria: ['ningún peligro conocido queda al alcance y la salud deja de bajar'],
        failureCriteria: ['la salud llega a cero'],
      },
      this.tick,
    );
    this.emit('goal.created', {
      goalId: goal.id,
      description: goal.description,
      source: goal.source,
    });
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

    // Una vista previa espera el sí o el no ANTES que cualquier modelo (y que
    // la continuación: acá "dale" es una confirmación). Cualquier otro tema la
    // descarta: nada entra al mundo por silencio ni por un "sí" viejo.
    if (this.pendingInvention) {
      const pending = this.pendingInvention;
      this.pendingInvention = null;
      if (isAffirmativeReply(text)) {
        this.inventionToPropose = pending;
        return;
      }
      if (isNegativeReply(text)) {
        this.reply(
          `Entendido: ${kindLabel(pending.outputKind)} queda en una idea, nada más.`,
        );
        return;
      }
    }

    // Un contrato de habilidad enseñada espera el mismo sí o no, y por la misma
    // razón (ADR 0030): el criterio de un pedido lo confirma el cuidador antes
    // de que se pruebe o se prometa nada. El "no" es información de primera —
    // le pide una vara mejor, no cierra la puerta.
    if (this.pendingContract) {
      const pending = this.pendingContract;
      this.pendingContract = null;
      if (isAffirmativeReply(text)) {
        this.confirmLearningContract(pending);
        return;
      }
      if (isNegativeReply(text)) {
        this.emit('skill.contract.declined', { name: pending.name });
        this.memory.recordEpisode({
          kind: 'unmet-request',
          summary: `propuse aprender "${pending.name}" pero mi cuidador no aceptó ese criterio`,
          tick: this.tick,
          importance: 0.4,
        });
        this.reply(
          `De acuerdo, no lo aprendo así. ¿Cómo sabrías vos que logré "${pending.name}"? ` +
            `Decímelo y lo intento con esa vara.`,
        );
        return;
      }
    }

    // "continua" / "seguí" / "dale" se resuelve ANTES de cualquier modelo y
    // siempre igual: la misma palabra no puede unas veces repetir la última
    // orden, otras saludar y otras depender del humor del proveedor. Si hay
    // una tarea del cuidador en curso, la confirma (la actividad sigue sola);
    // si no, repite la última orden explícita.
    let parsed: InterpretedMessage | null = null;
    if (isContinuationMessage(text)) {
      const pending = this.goals
        .all()
        .find(
          (goal) =>
            goal.status === 'active' &&
            ((goal.source === 'user-request' && goal.userRequest) ||
              (goal.source === 'learning' && goal.learning)),
        );
      if (pending) {
        this.reply(
          `Sigo con eso: "${pending.userRequest?.raw ?? pending.learning?.raw ?? pending.description}".`,
        );
        return;
      }
      if (this.lastUserRequest) {
        // Conserva el texto de la orden original: la meta se llama "construí
        // una fogata", no "continua" — el panel y la restauración se leen así.
        parsed = structuredClone(this.lastUserRequest);
      } else {
        this.reply('No tengo nada pendiente ahora mismo. ¿Qué hacemos?');
        return;
      }
    }

    // Quién interpreta el chat depende del proveedor. Un modelo que entiende
    // lenguaje interpreta TODO (distingue "¿para qué sirve?" de "para" como
    // orden, y una pregunta sobre comida de una lección sobre comida). El
    // parser determinista manda solo con proveedores que no interpretan
    // (el mock), y queda de red de seguridad si el modelo falla.
    if (parsed === null) {
      const fromParser = this.config.provider.interpretsLanguage
        ? null
        : this.contextualizeUserMessage(parseUserMessage(text), text, perception);
      parsed =
        fromParser && fromParser.kind !== 'unknown'
          ? fromParser
          : await this.interpretWithModel(text, perception);
    }
    if (parsed === null) return; // El modelo ya respondió (charla, negativa o fallo).

    if (parsed.kind === 'rename-pet') {
      this.receiveNameFromCaretaker(parsed.name);
      return;
    }

    if (parsed.kind === 'explanation') {
      await this.learnFromExplanation(text);
      return;
    }

    if (parsed.kind === 'learn-skill') {
      await this.startLearning(parsed.summary, text, perception);
      return;
    }

    if (parsed.kind === 'describe-entity') {
      await this.describeEntity(parsed.description, perception);
      return;
    }

    if (
      parsed.kind === 'wait-here' ||
      parsed.kind === 'move-direction' ||
      parsed.kind === 'run-skill' ||
      parsed.kind === 'craft-item' ||
      ('targetKind' in parsed && parsed.targetKind !== 'unknown')
    ) {
      this.lastUserRequest = structuredClone(parsed);
    }

    const decision = await this.decideOnRequest(parsed, perception);
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
        // Si había pedido ayuda y esta explicación llegó, el cuidador vino a
        // ayudarla: eso es un recuerdo del vínculo, no solo un dato.
        if (this.progress.helpRequestedFor(goal.id)) {
          this.memory.recordEpisode({
            kind: 'caretaker-help',
            summary: 'pedí ayuda y mi cuidador vino a explicarme cómo seguir',
            tick: this.tick,
            importance: 0.8,
          });
        }
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
      // Que no encuentre cómo no la exime de recordarlo: su cuidador lo quiso.
      this.memory.recordEpisode({
        kind: 'unmet-request',
        summary: `mi cuidador me pidió ${summary || raw} y todavía no encuentro cómo aprenderlo`,
        tick: this.tick,
        importance: 0.5,
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

    // La vara nació de palabras, así que todavía no promueve nada (ADR 0030):
    // se muestra el criterio y se espera el sí del cuidador. `crear-casa` anunció
    // "logrado cuando termina llevando un martillo" palabra por palabra — el bug
    // estuvo siempre a la vista en el chat, faltaba que fuera un sí de verdad.
    this.pendingContract = contract;
    this.emit('skill.contract.preview', {
      name: contract.name,
      purpose: contract.purpose,
      criteria: contract.successCriteria.map(describeCriterion),
    });
    this.reply(
      `Todavía no sé hacerlo, pero quiero aprenderlo. Para mí "${contract.name}" va a estar ` +
        `logrado cuando ${contract.successCriteria.map(describeCriterion).join(', y cuando ')}. ` +
        `¿Lo confirmás así? Decime «sí» y me pongo a probarlo en mundos imaginados.`,
    );
  }

  /**
   * El cuidador confirmó el criterio (ADR 0030): recién ahora nace el objetivo
   * de aprender. Antes de esto no había nada que perseguir — un contrato sin
   * confirmar es una propuesta, no una empresa.
   */
  private confirmLearningContract(contract: LearningContract): void {
    // Entre la propuesta y el sí pudo abrirse otro ciclo del mismo nombre (dos
    // enseñanzas seguidas): no se abre dos veces.
    const existing = this.goals
      .all()
      .find(
        (goal) =>
          goal.source === 'learning' &&
          goal.learning?.name === contract.name &&
          goal.status === 'active',
      );
    if (existing) return;

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
      `¡Dale! Me pongo a aprender "${contract.name}" y lo pruebo en mundos imaginados.`,
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
    const consult = async (): Promise<CommandInterpretation> => {
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
      return interpretation.command;
    };

    let command: CommandInterpretation;
    try {
      // Un reintento inmediato antes de rendirse: un corte de red de un
      // instante no debería costarle al cuidador su orden. Uno solo, para no
      // martillar a un proveedor caído con la cola de mensajes.
      try {
        command = await consult();
      } catch {
        command = await consult();
      }
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

    if (command.action === 'rename-pet') {
      return { kind: 'rename-pet', name: command.name, raw: text };
    }

    if (command.action === 'learn-skill') {
      return {
        kind: 'learn-skill',
        summary: command.summary.replace(/\s+/g, ' ').trim().slice(0, 300),
        raw: text,
      };
    }

    if (command.action === 'describe-entity') {
      const description = command.description.replace(/\s+/g, ' ').trim().slice(0, 400);
      return { kind: 'describe-entity', description: description || text, raw: text };
    }

    if (command.action === 'unsupported') {
      // Lo que no está codeado no se rechaza de antemano: se intenta APRENDER
      // en el momento — contrato, práctica en mundos imaginados y veredicto
      // del evaluador. "Sentarse en la silla" no existe como primitiva, pero
      // ir hasta la silla y quedarse ahí sí se puede componer; y si de verdad
      // es imposible (volar), lo dirán las pruebas, no una tabla.
      const summary = command.summary.replace(/\s+/g, ' ').trim().slice(0, 300);
      return { kind: 'learn-skill', summary: summary || text, raw: text };
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
    const facts = [`me llamo ${this.petName}`];
    // Sus rasgos viajan como hechos derivados: el modelo puede ponerles voz
    // ("soy curiosa, ya me conocés"), pero nunca decidirlos (ADR 0021).
    const traits = this.personality();
    if (traits.length > 0) {
      facts.push(`mi historia dice que soy ${traits.map((t) => t.label).join(', ')}`);
    }
    // Los recuerdos con su cuidador también son suyos: sin esto no podría
    // decir "vos me enseñaste que..." y el vínculo sería indistinguible de
    // no existir. Presupuesto corto: los 3 más recientes.
    facts.push(...this.caretakerMemories().map((memory) => `recuerdo que ${memory}`));
    // Lo que hizo también es suyo: sin esto, "¿por qué rompiste la pared?"
    // solo podía responderse con reglas genéricas, nunca con memoria propia.
    facts.push(...this.deedMemories());
    facts.push(
      ...this.memory
        .factList()
        .slice(-6)
        .map((fact) => fact.statement),
    );
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
    // Lo pendiente del cuidador es contexto de primera: "¿y la silla?" tiene
    // que entenderse aunque la orden original ya haya salido de la ventana de
    // turnos recientes del historial.
    const pending = this.goals
      .all()
      .filter(
        (goal) =>
          (goal.status === 'active' || goal.status === 'suspended') &&
          ((goal.source === 'user-request' && goal.userRequest) ||
            (goal.source === 'learning' && goal.learning)),
      )
      .slice(-3);
    for (const goal of pending) {
      facts.push(
        `tengo pendiente lo que me pediste: "${goal.userRequest?.raw ?? goal.learning?.raw ?? goal.description}"`,
      );
    }
    return facts;
  }

  /**
   * Recuerdo de acción propia (ADR 0033): nace de un SimEvent observado,
   * nunca de lo que el modelo diga. El summary estable hace que repetir la
   * acción incremente el conteo del mismo recuerdo en vez de crear otro.
   */
  private recordDeed(summary: string, importance: number, data: Record<string, unknown>): void {
    this.memory.recordEpisode({ kind: 'deed', summary, tick: this.tick, importance, data });
    this.emit('memory.created', { kind: 'episode', statement: summary });
  }

  /**
   * Lo que hizo con sus manos, contado: "rompí un wall con hammer (×3)".
   * Presupuesto propio para el diálogo — no compite con el vínculo
   * (caretakerMemories) ni con los hechos del mundo.
   */
  private deedMemories(limit = 4): string[] {
    return this.memory
      .episodeList()
      .filter((episode) => episode.kind === 'deed')
      .sort((a, b) => b.lastTick - a.lastTick)
      .slice(0, limit)
      .map((episode) =>
        episode.occurrences > 1
          ? `hice: ${episode.summary} (×${episode.occurrences})`
          : `hice: ${episode.summary}`,
      );
  }

  /**
   * Experiencia pasada relevante a un propósito (ADR 0033): lo que hizo y lo
   * que le falló, recuperado por afinidad de términos. Alimenta las propuestas
   * de habilidades para que la idea nueva no ignore la historia.
   */
  private experienceContext(query: string): string[] {
    return this.memory
      .retrieve(query, 3)
      .episodes.filter((e) => e.kind === 'deed' || e.kind === 'failure')
      .map((e) =>
        e.occurrences > 1
          ? `experiencia previa: ${e.summary} (×${e.occurrences})`
          : `experiencia previa: ${e.summary}`,
      );
  }

  /**
   * Episodios significativos con el cuidador (enseñanzas, pedidos cumplidos,
   * ayudas, el bautismo, lo que dejó su antecesora), los más recientes
   * primero. Es la memoria del vínculo, no telemetría.
   */
  private caretakerMemories(limit = 3): string[] {
    const kinds = new Set([
      'teaching',
      'promise-kept',
      'caretaker',
      'caretaker-help',
      'skill-learned',
      'legacy-traits',
    ]);
    return this.memory
      .episodeList()
      .filter((episode) => kinds.has(episode.kind))
      .sort((a, b) => b.lastTick - a.lastTick)
      .slice(0, limit)
      .map((episode) =>
        episode.occurrences > 1 ? `${episode.summary} (×${episode.occurrences})` : episode.summary,
      );
  }

  private userRequestFromInterpretation(
    command: Exclude<
      CommandInterpretation,
      {
        action:
          | 'unsupported'
          | 'not-command'
          | 'explanation'
          | 'learn-skill'
          | 'rename-pet'
          | 'describe-entity';
      }
    >,
    raw: string,
  ): UserRequest {
    switch (command.action) {
      case 'fetch-item':
        return {
          kind: command.action,
          targetKind: command.targetKind,
          ...(command.amount !== undefined && command.amount > 1
            ? { amount: command.amount }
            : {}),
          raw,
        };
      case 'destroy-entity':
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
      case 'interact-entity':
        return {
          kind: 'interact-entity',
          verb: normalizeSkillName(command.verb) || 'usar',
          targetKind: command.targetKind,
          raw,
        };
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
    this.reply(
      `No pude consultar a ${providerName}: ${visibleError || 'error desconocido'}. ` +
        `Vuelve a pedírmelo en un momento, o dame una orden simple (buscar, traer, construir).`,
    );
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
    if (parsed.kind === 'explanation' || parsed.kind === 'rename-pet') return parsed;

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
      // "conseguilos" después de una silla frustrada: lo que falta lo dice la
      // última receta pedida, con su cantidad exacta — ni uno de menos (quedaba
      // corta) ni de más (recogía troncos que nadie necesitaba).
      const lastRequest = this.lastUserRequest;
      if (parsed.kind === 'fetch-item' && lastRequest?.kind === 'craft-item') {
        const recipe = perception.recipes.find((r) => r.id === lastRequest.recipeId);
        if (recipe) {
          const held = new Map<string, number>();
          for (const item of perception.self.heldItems) {
            held.set(item.kind, (held.get(item.kind) ?? 0) + 1);
          }
          const firstMissing = missingIngredients(recipe, held)[0];
          if (firstMissing) {
            return {
              ...parsed,
              targetKind: firstMissing.kind,
              amount: firstMissing.need - firstMissing.have,
            };
          }
        }
      }
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

  /**
   * "¿Quiero?" es lo único que el modelo puede repensar. Nunca "¿puedo?".
   *
   * `evaluateUserRequest` corre PRIMERO y entero: la física, los recursos y las
   * prioridades del cuerpo se deciden con código determinista. Solo un
   * `will_not` —el único juicio de VALORES del catálogo— llega hasta aquí, y
   * solo para destruir. Un `cannot` (no tengo herramienta), un `not_now`
   * (me estoy muriendo de hambre) o un `needs_information` (no sé dónde está)
   * jamás se consultan: no hay nada que opinar sobre un hecho.
   *
   * Por eso este camino no puede autorizar un imposible aunque el modelo
   * quiera: para cuando se le pregunta, el mundo ya dijo que se puede, y la
   * única duda que queda es si vale la pena. Ver ADR 0019.
   */
  private async reconsiderRefusal(
    request: UserRequest,
    perception: Perception,
    decision: RequestDecision,
  ): Promise<RequestDecision> {
    if (decision.classification !== 'will_not') return decision;
    if (request.kind !== 'destroy-entity') return decision;
    if (!this.config.provider.interpretsLanguage) return decision;

    try {
      const response = await this.config.provider.complete({
        kind: 'judge.destruction',
        request: request.raw,
        targetKind: request.targetKind,
        facts: this.destructionFacts(request.targetKind, perception),
        conversation: this.dialogueHistory(),
      });
      if (response.kind !== 'judgement') {
        throw new Error(`respuesta inesperada del proveedor: ${response.kind}`);
      }
      this.emit('judgement.made', {
        targetKind: request.targetKind,
        willing: response.willing,
        reason: response.reason,
      });
      return response.willing
        ? { classification: 'accepted', reason: response.reason }
        : { classification: 'will_not', reason: response.reason };
    } catch (error) {
      // Sin juicio, la negativa determinista se mantiene: ante la duda, no
      // destruye. Es el lado seguro del error.
      this.emit('provider.error', {
        provider: this.config.provider.name,
        operation: 'judge.destruction',
        message: error instanceof Error ? error.message : String(error),
        recoveredWith: 'refusal',
      });
      return decision;
    }
  }

  /**
   * Los hechos con los que se juzga si vale la pena destruir algo. Todos
   * verificables en la percepción o en su memoria: el modelo pesa, no inventa.
   */
  private destructionFacts(targetKind: string, perception: Perception): string[] {
    const sameKind = perception.visibleEntities.filter((e) => e.kind === targetKind);
    const facts = [
      sameKind.length === 1
        ? `solo veo 1 ${targetKind}: es el único que tengo a la vista`
        : `veo ${sameKind.length} ${targetKind} distintos`,
    ];
    const energy = perception.self.energy;
    if (energy) {
      facts.push(
        `mi energía es ${Math.round(energy.current)} de ${energy.max}` +
          (energy.current / energy.max < LOW_ENERGY_FRACTION ? ' (tengo hambre)' : ' (estoy bien)'),
      );
    }
    const edibles = perception.visibleEntities.filter((e) => e.edible);
    facts.push(
      edibles.length > 0
        ? `veo ${edibles.length} cosa(s) comestible(s) ahora mismo`
        : 'no veo nada comestible ahora mismo',
    );
    facts.push(
      ...this.memory
        .factList()
        .filter((f) => f.statement.includes(targetKind))
        .slice(-3)
        .map((f) => `sé que ${f.statement}`),
      ...this.memory
        .hypothesisList()
        .filter((h) => h.resolved !== 'discarded' && h.statement.includes(targetKind))
        .slice(-2)
        .map((h) => `creo (sin confirmar) que ${h.statement}`),
    );
    // Lo que ya rompió pesa en el juicio (ADR 0033): destruir "otro más" no
    // es lo mismo que destruir el primero.
    const priorDeeds = this.memory
      .episodeList()
      .filter((e) => e.kind === 'deed' && e.data.targetKind === targetKind);
    if (priorDeeds.length > 0) {
      const total = priorDeeds.reduce((sum, e) => sum + e.occurrences, 0);
      facts.push(`ya rompí ${total} ${targetKind} antes`);
    }
    return facts;
  }

  async decideOnRequest(
    request: UserRequest,
    perception: Perception,
  ): Promise<RequestDecision> {
    let decision = evaluateUserRequest(
      request,
      perception,
      this.memory,
      this.goals.selectActive(),
      this.learnedSkills().map((skill) => skill.name),
    );
    decision = await this.reconsiderRefusal(request, perception, decision);
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
            ...('verb' in request ? { verb: request.verb } : {}),
            ...('amount' in request && request.amount !== undefined
              ? { amount: request.amount }
              : {}),
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
      // Le pidieron construir algo que su mundo todavía no sabe hacer. Eso no
      // es un imposible: es una idea que no tuvo. Primero la propone y deja
      // que el mundo la juzgue; si entra, el próximo tick ya hay receta y
      // construir vuelve a ser el programa de siempre.
      const invention = await this.inventForRequest(goal, perception);
      if (invention) return invention;
      // Lo mismo con las interacciones (ADR 0027): reuso primero — si ya está
      // en world.interactions no cuesta ni una consulta —, inventar después,
      // y solo si la puerta y la IA Dios dicen que sí.
      if (goal.userRequest.kind === 'interact-entity') {
        const proposal = await this.invention.inventInteraction(goal, perception);
        if (proposal) return proposal;
        // El juez pudo haber vetado (el objetivo quedó suspendido): no hay
        // programa que ejecutar sobre un veto.
        if (this.goals.get(goal.id)?.status !== 'active') {
          this.lastSelectedGoalId = null;
          return null;
        }
      }
      const program = programForUserRequest(goal.userRequest, perception, this.userProgramDeps(perception));
      this.startUserActivity(goal, program, completionReply(goal.userRequest), perception);
      return this.continueActivity(perception);
    }
    if (goal.description === GOAL_BE_SAFE) {
      return this.pursueSafety(goal, perception);
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
    const strategies: {
      label: string;
      program: SkillProgram;
      skillId?: string;
      rememberedPlaceId?: string;
    }[] = [];
    if (stable) {
      strategies.push({
        label: `stable-skill:${stable.name}@v${stable.version}`,
        program: stable.program,
        skillId: stable.id,
      });
    }
    strategies.push({ label: 'direct-approach', program: DIRECT_APPROACH_PROGRAM });
    // Sin nada comestible al alcance de los sentidos, perseguir lo visible es
    // abortar en el acto: si recuerda dónde HABÍA comida, ir a mirar va
    // primero. Si el recuerdo miente, se invalida y el fallo queda registrado.
    if (!perception.visibleEntities.some((e) => e.edible)) {
      const remembered = this.places.recall({ edible: true }, perception)[0];
      if (remembered) {
        strategies.unshift({
          label: `comida-recordada:${remembered.entityId}`,
          program: rememberedFoodProgram(
            this.walkStepsAvoidingHazards(perception, remembered.position, 1),
          ),
          rememberedPlaceId: remembered.entityId,
        });
      }
    }

    const viable = strategies.find((s) => !this.progress.isForbidden(goal.id, s.label));
    if (viable) {
      this.startActivity(goal, viable.label, viable.program, perception, {
        ...(viable.skillId !== undefined ? { skillId: viable.skillId } : {}),
        ...(viable.rememberedPlaceId !== undefined
          ? { rememberedPlaceId: viable.rememberedPlaceId }
          : {}),
      });
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
      // Llegar aquí por la vía de la CAPACIDAD (no del recurso) significa que ya
      // agotó aprender una conducta con lo que tiene y sigue trabada por algo
      // físico. Ese fracaso propio le da permiso de tener una idea: lo que falta
      // puede ser un objeto que todavía no existe (ADR 0036), así que intenta
      // inventarlo antes de rendirse a pedir ayuda. Por la vía del recurso no:
      // ahí no falta una idea, falta materia, y ninguna receta la conjura.
      if (
        !this.progress.blockedByMissingResource(goal.id) &&
        this.invention.attemptsLeft(goal.id)
      ) {
        const invention = await this.inventForObstacle(goal, perception);
        if (invention) return invention;
      }
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
   * Inventar desde el propio fracaso (ADR 0036). Las estrategias que sabe
   * quedaron prohibidas por CAPACIDAD —un muro que sus herramientas no dentan,
   * un paso que no logra abrir—, no por falta de recurso. Ese es exactamente el
   * momento de tener una idea: lo que falta puede ser un objeto que todavía no
   * existe. Hasta hoy solo el frío y el pedido del cuidador le daban permiso de
   * inventar; su hambre bloqueada, no. Reusa el mismo pipeline (mismo crédito
   * por objetivo, misma puerta del mundo) que el frío y las recetas por encargo.
   *
   * Si el mundo acepta el objeto, queda como receta suya y la conducta que la
   * escalada fabrica después puede fabricarlo y usarlo. Si no hay materiales o
   * ya gastó el crédito, devuelve null y la escalada sigue con su camino de
   * siempre — inventar es un intento más, nunca un callejón.
   */
  private async inventForObstacle(
    goal: Goal,
    perception: Perception,
  ): Promise<ActionIntent | null> {
    // Un plan a medio proponer sigue entrando, hoja por hoja (ADR 0031).
    const pending = this.invention.nextPlanStep(perception);
    if (pending) return pending;
    // Lo que su cuerpo aprendió que NO puede vencer hace la idea concreta —
    // "algo que rompa el muro" en vez de un deseo vago. Sin barrera conocida,
    // el problema es igual de honesto: lo que sabe usar no alcanza.
    const barriers = this.memory
      .factList()
      .filter((f) => f.statement.includes('no puede dañar'))
      .slice(-3)
      .map((f) => f.statement);
    const problem =
      'no logro llegar al alimento: lo que sé usar no vence lo que me bloquea' +
      (barriers.length > 0 ? ` (${barriers.join('; ')})` : '');
    return this.invention.inventRecipe(problem, perception, { goalId: goal.id });
  }

  /**
   * El cuidador pidió construir algo para lo que no hay receta. Antes esto
   * moría en dos lugares a la vez: la interpretación lo declaraba `unsupported`
   * («construir algo que no tiene receta») y terminaba aprendiendo una CONDUCTA
   * para un pedido que era de FÍSICA — así fue como «crea una casa» derivó en
   * una habilidad que recogía un martillo.
   *
   * Pedir algo que su mundo no sabe hacer es exactamente el momento de tener
   * una idea, y es el disparador más natural que existe: no hace falta que
   * tenga frío para que se le ocurra algo, alcanza con que alguien le pida
   * algo que todavía no sabe.
   *
   * La idea lleva el nombre que usó el cuidador (`wantedId`): si la bautizara
   * distinto, la petición seguiría sin encontrar su receta y volvería a
   * inventar hasta quedarse sin crédito, sin entender por qué.
   */
  private async inventForRequest(
    goal: Goal,
    perception: Perception,
  ): Promise<ActionIntent | null> {
    const request = goal.userRequest;
    if (request?.kind !== 'craft-item' || !request.recipeId) return null;
    // Un plan a medio entrar sigue entrando: las hojas antes que el tronco, una
    // receta por tick, cada una por la puerta del mundo (ADR 0031). Va antes
    // que el "ya sabe hacerlo" porque lo que falta son las piezas de abajo, no
    // la casa: la casa es justamente la que todavía no puede entrar.
    const pending = this.invention.nextPlanStep(perception);
    if (pending) return pending;
    // Ya sabe hacerlo: no hay nada que inventar, hay que ponerse a construir.
    // "Saberlo" es tener la receta (un objeto) O el plano (una obra, ADR 0032):
    // sin mirar los planos, una casa ya aprendida se re-inventaría cada tick.
    if (
      perception.recipes.some((r) => r.id === request.recipeId) ||
      perception.blueprints.some((b) => b.id === request.recipeId)
    ) {
      return null;
    }
    return this.invention.inventRecipe(
      `mi cuidador me pidió construir ${kindWithArticle(request.recipeId)}`,
      perception,
      { goalId: goal.id, wantedId: request.recipeId },
    );
  }

  /**
   * IA Dios (ADR 0024): el cuidador describió un objeto y la mascota lo
   * traduce a una receta con el modelo. La MISMA puerta que juzga sus propios
   * inventos (validateRecipe) juzga la traducción — describir no es poder, ni
   * siquiera para el cuidador. Aquí la puerta solo decide si vale la pena
   * preguntar: si la idea es imposible, la respuesta honesta es el motivo del
   * rechazo; si es posible, se muestra la vista previa y NADA entra al mundo
   * sin confirmación. La entrada real va después por `proposeRecipe`, donde
   * step.ts vuelve a validar: no existe camino que se salte esa puerta.
   */
  private async describeEntity(description: string, perception: Perception): Promise<void> {
    const knownKinds = [
      ...new Set([
        ...perception.self.heldItems.map((item) => item.kind),
        ...perception.visibleEntities.map((entity) => entity.kind),
      ]),
    ];
    let proposal: { recipe: unknown; rationale: string };
    try {
      const response = await this.config.provider.complete({
        kind: 'entity.describe',
        description,
        knownKinds,
        existingRecipes: perception.recipes.map(
          (recipe) =>
            `${recipe.id} (${recipe.ingredients.map((i) => `${i.count}x ${i.kind}`).join(' + ')})`,
        ),
      });
      if (response.kind !== 'recipe') {
        throw new Error(`respuesta inesperada del proveedor: ${response.kind}`);
      }
      proposal = response;
    } catch (error) {
      // Sin modelo que entienda la descripción, no hay traducción que fingir:
      // se dice, y el mundo queda como estaba.
      const message = error instanceof Error ? error.message : String(error);
      this.emit('provider.error', {
        provider: this.config.provider.name,
        operation: 'entity.describe',
        message,
      });
      this.reply(
        `Me encantaría imaginar eso, pero no pude traducir tu descripción (${message}). ` +
          `Podés volver a intentarlo en un momento.`,
      );
      return;
    }

    const validated = validateRecipe(proposal.recipe, perception.recipes);
    if (!validated.ok) {
      this.emit('recipe.rejected', { reason: validated.error, source: 'entity.describe' });
      this.reply(`Lo imaginé, pero mi mundo no lo acepta: ${validated.error}`);
      return;
    }

    const product = recipeProduct(validated.value);
    if (!product) {
      // La puerta exige componentes, así que esto es casi imposible; aún así,
      // sin producto no hay nada que previsualizar ni que confirmar.
      this.reply('Lo imaginé, pero no logro ver qué produciría. Mejor lo dejamos.');
      return;
    }

    this.pendingInvention = {
      recipe: proposal.recipe,
      recipeId: validated.value.id,
      outputKind: product.kind,
    };
    // La vista previa muestra el arquetipo (el mejor desenlace): lo que la
    // mascota INTENTA construir, no lo que cada tirada promete.
    this.emit('recipe.preview', {
      recipeId: validated.value.id,
      outputKind: product.kind,
      components: structuredClone(product.components),
      ingredients: validated.value.ingredients.map((i) => ({ kind: i.kind, count: i.count })),
      rationale: proposal.rationale,
    });
    const pronoun = isFeminineKind(product.kind) ? 'La' : 'Lo';
    this.reply(
      `Así me imagino ${kindWithArticle(product.kind)} con lo que hay en mi mundo. ` +
        `¿${pronoun} hago parte de mi mundo?`,
    );
  }

  /**
   * El dolor como motivo, no el reflejo: alejarse de lo que sabe que daña
   * hasta la distancia segura y quedarse ahí hasta que la salud deje de
   * bajar. Estrategias deterministas (celda segura + camino de pasos); la
   * escalada habla el mismo idioma que el frío y el hambre (ADR 0008), pero
   * sin el paso de crear una habilidad: apartarse no es una capacidad que
   * falte — si no hay celda a donde ir, lo que falta es espacio, y eso solo
   * lo arregla el cuidador.
   */
  private pursueSafety(goal: Goal, perception: Perception): ActionIntent | null {
    const selfPos = perception.self.position;
    const hazards = this.knownHazardPositions(perception);
    const minDistance = hazards.reduce(
      (min, hazard) => Math.min(min, chebyshev(selfPos, hazard)),
      Infinity,
    );
    if (minDistance >= SAFE_DISTANCE) {
      // Fuera del alcance del daño la salud deja de bajar (el peligro del
      // motor solo alcanza a los adyacentes): estar lejos ES estar a salvo.
      this.goals.complete(goal.id);
      this.emit('goal.completed', { goalId: goal.id, strategy: 'ya-a-salvo' });
      this.memory.recordEpisode({
        kind: 'safety',
        summary: 'me aparté de lo que me estaba dañando y me puse a salvo',
        tick: this.tick,
        importance: 0.8,
      });
      this.lastSelectedGoalId = null;
      return null;
    }

    // Celdas candidatas: cercanas, sin sólidos visibles encima y lejos de
    // TODO peligro conocido. Orden determinista: la más cercana primero.
    const solids = new Set(
      perception.visibleEntities
        .filter((e) => e.solid && e.position)
        .map((e) => `${e.position!.x},${e.position!.y}`),
    );
    const candidates: Vec2[] = [];
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const cell = { x: selfPos.x + dx, y: selfPos.y + dy };
        if (cell.x < 0 || cell.y < 0) continue;
        if (solids.has(`${cell.x},${cell.y}`)) continue;
        if (hazards.some((hazard) => chebyshev(hazard, cell) < SAFE_DISTANCE)) continue;
        candidates.push(cell);
      }
    }
    candidates.sort(
      (a, b) => manhattan(selfPos, a) - manhattan(selfPos, b) || a.y - b.y || a.x - b.x,
    );

    // Un plan que pisa un sólido que VE (o el peligro mismo) es un plan que
    // ya sabe fallido: se descarta al planificar, no caminando. Lo que no ve
    // (bordes del mundo, sólidos lejanos) lo dirá el mundo con
    // `camino-bloqueado`, como siempre.
    const planPath = (cell: Vec2): Direction[] | null => {
      for (const axis of ['x', 'y'] as const) {
        const { dirs } = stepsToward(selfPos, cell, 0, axis);
        const walked = { ...selfPos };
        let knownBlocked = false;
        for (const dir of dirs) {
          walked.x += dir === 'right' ? 1 : dir === 'left' ? -1 : 0;
          walked.y += dir === 'down' ? 1 : dir === 'up' ? -1 : 0;
          if (
            solids.has(`${walked.x},${walked.y}`) ||
            hazards.some((hazard) => hazard.x === walked.x && hazard.y === walked.y)
          ) {
            knownBlocked = true;
            break;
          }
        }
        if (!knownBlocked) return dirs;
      }
      return null;
    };

    const viable = candidates
      .map((cell) => ({ cell, dirs: planPath(cell), label: `retirada:${cell.x},${cell.y}` }))
      .find(
        (candidate) =>
          candidate.dirs !== null && !this.progress.isForbidden(goal.id, candidate.label),
      );
    if (viable) {
      this.startActivity(goal, viable.label, retreatProgram(viable.dirs!), perception, {
        purpose: 'be-safe',
      });
      return this.continueActivity(perception);
    }

    // Acorralada: ninguna celda segura que intentar. Mismo idioma que el
    // resto de las necesidades: pedir ayuda una vez, después suspender.
    if (!this.progress.helpRequestedFor(goal.id)) {
      this.progress.markHelpRequested(goal.id);
      this.emit('help.requested', { goalId: goal.id });
      return {
        type: 'speak',
        text: 'Algo me está haciendo daño y no encuentro por dónde apartarme. ¿Puedes ayudarme?',
      };
    }
    this.goals.suspend(
      goal.id,
      'sin salida a la vista tras pedir ayuda',
      'nueva información del usuario o cambio en el entorno',
    );
    this.emit('goal.suspended', { goalId: goal.id, reason: 'sin salida a la vista' });
    this.lastSelectedGoalId = null;
    return null;
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
    const strategies: {
      label: string;
      program: SkillProgram;
      skillId?: string;
      rememberedPlaceId?: string;
    }[] = [];
    if (stable) {
      strategies.push({
        label: `stable-skill:${stable.name}@v${stable.version}`,
        program: stable.program,
        skillId: stable.id,
      });
    }
    strategies.push({ label: 'warmth-approach', program: WARMTH_APPROACH_PROGRAM });
    // Si su mundo sabe hacer fuego (de fábrica o porque ella lo inventó),
    // construirlo es una aproximación primitiva más: juntar y craftear.
    for (const recipe of perception.recipes) {
      if (!recipeProduces(recipe, 'heatSource')) continue;
      strategies.push({
        label: `build-fire:${recipe.id}`,
        program: buildFireProgram(recipe, heldCounts(perception), perception.recipes),
      });
    }
    // Después del fuego, no antes: el fuego recupera calor y el refugio solo
    // deja de perderlo. Y solo si VE alguno — un refugio hipotético no es una
    // estrategia, y ofrecerla en mundos sin refugio retrasaría lo que sigue
    // (inventar, pedir ayuda) un ciclo entero para nada.
    if (perception.visibleEntities.some((e) => e.shelter)) {
      strategies.push({ label: 'shelter-approach', program: SHELTER_APPROACH_PROGRAM });
    }
    // Sin nada cálido al alcance de los sentidos, ir a donde RECUERDA que
    // había calor va primero: caminar hasta un fuego que ya existe es más
    // barato que construir uno nuevo.
    if (!perception.visibleEntities.some((e) => e.warmth !== undefined)) {
      const remembered = this.places.recall({ warm: true }, perception)[0];
      if (remembered) {
        strategies.unshift({
          label: `calor-recordado:${remembered.entityId}`,
          program: rememberedHeatProgram(
            this.walkStepsAvoidingHazards(perception, remembered.position, 2),
          ),
          rememberedPlaceId: remembered.entityId,
        });
      }
    }

    const viable = strategies.find((s) => !this.progress.isForbidden(goal.id, s.label));
    if (viable) {
      this.startActivity(goal, viable.label, viable.program, perception, {
        ...(viable.skillId !== undefined ? { skillId: viable.skillId } : {}),
        ...(viable.rememberedPlaceId !== undefined
          ? { rememberedPlaceId: viable.rememberedPlaceId }
          : {}),
      });
      return this.continueActivity(perception);
    }

    // Si nada de lo que sabe construir da calor, quizá pueda inventarlo. Es
    // el paso previo a rendirse: primero la idea, después la habilidad.
    const knowsFire = perception.recipes.some((recipe) => recipeProduces(recipe, 'heatSource'));
    if (!knowsFire && this.invention.attemptsLeft(goal.id)) {
      const invention = await this.invention.inventRecipe(
        'tengo frío y no tengo nada que dé calor',
        perception,
        { goalId: goal.id },
      );
      if (invention) return invention;
    }

    // Construir el fuego ya se intentó como estrategia (build-fire): si eso
    // también falló por no-candidates, lo que falta es el RECURSO y ninguna
    // habilidad lo conjura (ADR 0008) — se pide ayuda. Solo los fallos de
    // capacidad (camino bloqueado, etc.) abren el ciclo de skills, y solo si
    // hay mundos fríos donde juzgarlas: sin ellos la vara sería imposible.
    const scenarios = this.config.warmthScenarios ?? [];
    const step =
      this.progress.blockedByMissingResource(goal.id) || scenarios.length === 0
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
        // El criterio lo dicta el motivo, no un modelo (ADR 0030): tener frío
        // tiene firma objetiva en el mundo, así que la vara se escribe sola.
        successCriteria: [{ type: 'temperatureIncreased' }, { type: 'noDamageTaken' }],
        criterionSource: 'motive',
      };
      const context = [
        ...this.experienceContext(contract.purpose),
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
          { skillId: outcome.stableSkill.id },
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
   * Mundos de práctica que contienen aquello de lo que habla el contrato: una
   * habilidad sobre sillas no se puede juzgar donde no hay sillas — la vara
   * sería imposible por diseño, como pasaba con el abrigo sin mundos fríos
   * (ADR 0016). Si ningún mundo lo contiene, se practica en todos y el
   * veredicto (honesto) lo da el evaluador.
   */
  private practiceScenariosFor(criteria: EvaluationCriterion[]): NamedScenario[] {
    const scenarios = this.practiceScenarios();
    const kinds = [...new Set(criteria.map((c) => c.kind).filter((k): k is string => !!k))];
    if (kinds.length === 0) return scenarios;
    const probeSeed = this.config.evaluationSeeds[0] ?? 1;
    const fitting = scenarios.filter((scenario) => {
      try {
        const { world } = scenario.build(probeSeed);
        return kinds.every((kind) =>
          Object.values(world.entities).some((entity) => entity.kind === kind),
        );
      } catch {
        return false;
      }
    });
    return fitting.length > 0 ? fitting : scenarios;
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
        // La vara nació de un pedido y la confirmó el cuidador antes de abrir
        // este ciclo (ADR 0030): sin esa confirmación no habría objetivo que
        // perseguir, así que llegar aquí ya implica un criterio mirado.
        criterionSource: 'caretaker',
      },
      contract.context,
      this.practiceScenariosFor(contract.successCriteria),
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
      // Motivo (hambre): la vara la escribe el motor, no un modelo (ADR 0030).
      successCriteria: [{ type: 'consumedKind', kind: 'food' }, { type: 'energyIncreased' }],
      criterionSource: 'motive',
    };
    const context = [
      ...failures,
      ...this.experienceContext(contract.purpose),
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
        { skillId: outcome.stableSkill.id },
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
      exec: new SkillExecution(program, this.petId, {
        library: this.config.library,
        spatial: this.spatial,
      }),
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
    options: {
      skillId?: string;
      rememberedPlaceId?: string;
      purpose?: 'restore-energy' | 'be-safe';
    } = {},
  ): void {
    this.emit('strategy.selected', { goalId: goal.id, strategy });
    this.activity = {
      goalId: goal.id,
      strategy,
      exec: new SkillExecution(program, this.petId, {
        library: this.config.library,
        spatial: this.spatial,
      }),
      purpose: options.purpose ?? 'restore-energy',
      ...(options.skillId !== undefined ? { skillId: options.skillId } : {}),
      ...(options.rememberedPlaceId !== undefined
        ? { rememberedPlaceId: options.rememberedPlaceId }
        : {}),
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
          `No pude completar eso: ${this.describeActivityFailure(
            out.result.reason ?? out.result.outcome,
            activity,
            perception,
          )}.`,
        );
      }
      this.lastSelectedGoalId = null;
      return null;
    }

    if (activity.purpose === 'be-safe') {
      // A salvo es un estado del mundo, no del programa: se mide con la
      // percepción actual, no con que el paseo haya terminado sin tropiezos.
      const selfPos = perception.self.position;
      const minDistance = this.knownHazardPositions(perception).reduce(
        (min, hazard) => Math.min(min, chebyshev(selfPos, hazard)),
        Infinity,
      );
      const safe = minDistance >= SAFE_DISTANCE;
      const record = this.progress.record(
        activity.goalId,
        activity.strategy,
        safe,
        out.result.reason,
      );
      if (safe) {
        this.goals.complete(activity.goalId);
        this.emit('goal.completed', { goalId: activity.goalId, strategy: activity.strategy });
        this.memory.recordEpisode({
          kind: 'safety',
          summary: 'me aparté de lo que me estaba dañando y me puse a salvo',
          tick: this.tick,
          importance: 0.8,
        });
      } else {
        this.emit('strategy.failed', {
          goalId: activity.goalId,
          strategy: activity.strategy,
          outcome: out.result.outcome,
          reason: out.result.reason ?? null,
        });
        if (record.forbidden) {
          this.emit('strategy.forbidden', { goalId: activity.goalId, strategy: activity.strategy });
        }
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
    // El recuerdo prometía algo ahí y al llegar no había nada de eso: el
    // recuerdo era mentira, se descarta, y el fallo ya quedó registrado
    // arriba con su razón (`no-candidates`: falta el recurso, ADR 0008).
    if (
      activity.rememberedPlaceId !== undefined &&
      out.result.reason?.startsWith('no-candidates:remembered') === true
    ) {
      this.places.forget(activity.rememberedPlaceId);
      this.emit('place.invalidated', {
        entityId: activity.rememberedPlaceId,
        strategy: activity.strategy,
      });
      this.memory.recordEpisode({
        kind: 'memory-stale',
        summary: 'fui a buscar algo donde lo recordaba y ya no estaba',
        tick: this.tick,
        importance: 0.5,
      });
    }
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

  /**
   * Quedarse sin material a mitad de construir tiene una respuesta muchísimo
   * mejor que «no encuentro el objeto»: ella SABE qué le falta y cuánto,
   * porque se lo dice el mundo (`missingIngredients`, la misma fuente con la
   * que acepta o se niega). Sin esto, el cuidador escucha un fracaso opaco y
   * no tiene forma de ayudarla — y era peor todavía con las recetas que ella
   * inventa, donde nadie más que ella sabe qué lleva.
   */
  private missingForCraft(activity: Activity, perception: Perception): string | null {
    const request = this.goals.get(activity.goalId)?.userRequest;
    if (request?.kind !== 'craft-item' || !request.recipeId) return null;
    // Una obra (ADR 0032) no tiene receta con su nombre: falla distinto y se
    // explica distinto. Sin esto, no poder levantar una casa se contaba como
    // «no encuentro el objeto», que no le decía nada al cuidador.
    const structure = this.missingForStructure(request.recipeId, perception);
    if (structure) return structure;
    const recipe = perception.recipes.find((r) => r.id === request.recipeId);
    if (!recipe) return null;
    const tree = this.missingDownTheTree(recipe, perception);
    if (tree) return tree;
    const missing = missingIngredients(recipe, heldCounts(perception));
    if (missing.length === 0) return null;
    const total = missing.reduce((sum, m) => sum + (m.need - m.have), 0);
    const falta = total === 1 ? 'me falta' : 'me faltan';
    // Manos llenas, no ceguera: si lo que falta lo TIENE a la vista pero no le
    // entra en los brazos (inventario lleno), el fallo es de capacidad y no de
    // recurso —el mismo trato honesto que una obra que no entra
    // (`missingForStructure`). Sin esto, "tengo las manos llenas" se contaba
    // como "no veo más por acá" y el cuidador salía a buscar un pedernal que la
    // mascota tenía justo al lado (recogerlo fallaba en silencio por lleno).
    const freeSlots = perception.self.inventoryCapacity - perception.self.heldItems.length;
    const visibleMissing = missing.filter((m) =>
      perception.visibleEntities.some((e) => e.kind === m.kind),
    );
    if (freeSlots < total && visibleMissing.length > 0) {
      const lo = total === 1 ? 'lo' : 'los';
      return (
        `veo ${displayMissing(visibleMissing)} cerca, pero tengo las manos llenas ` +
        `(cargo ${perception.self.inventoryCapacity} cosas): necesito soltar algo para juntar${lo}`
      );
    }
    // Abortó por `no-candidates`: buscó y no había más. Decirlo evita que el
    // cuidador salga a buscar lo que no existe.
    return `${falta} ${displayMissing(missing)} y no veo más por acá`;
  }

  /**
   * Por qué no pudo levantar una obra. Desde el ADR 0034 la obra se construye de
   * a un bloque volviendo al ancla, así que las manos ya no son el techo: si
   * falla, es porque no consiguió la materia de los bloques (o no pudo volver al
   * sitio a colocarla). Nombra el bloque y el número — nunca «no encuentro el
   * objeto», que no le sirve a nadie.
   */
  private missingForStructure(recipeId: string, perception: Perception): string | null {
    const blueprint = perception.blueprints.find((b) => b.id === recipeId);
    if (!blueprint) return null;
    const counts = [...blueprintCounts(blueprint)];
    const blocks = counts.map(([kind, n]) => countedKindLabel(kind, n)).join(' y ');
    return `no pude reunir ${blocks} para ${kindWithArticle(recipeId)}`;
  }

  /**
   * Lo mismo, pero para lo que se hace de otras cosas (ADR 0031). Decir «me
   * faltan 8 paredes» cuando sabe hacer paredes sería mentir dos veces: no le
   * faltan paredes, le faltan los troncos de las tablas de las paredes — y el
   * cuidador saldría a buscar paredes, que no existen tiradas en ningún lado.
   *
   * La cadena se dice entera porque es la respuesta a la pregunta que el
   * número solo deja peor: por qué una casa cuesta 16 troncos. Un costo grande
   * sin su porqué suena a capricho; con la cadena, es una casa.
   */
  private missingDownTheTree(recipe: Recipe, perception: Perception): string | null {
    const cost = expandRecipeCost(recipe, perception.recipes);
    // Un solo paso es la receta de siempre: la explicación de siempre le queda
    // mejor que una cadena de un eslabón.
    if (cost.truncated || cost.steps.length <= 1) return null;

    // Lo que lleva encima vale por la materia que costó: ocho tablas en la
    // mano son ocho troncos que no hay que volver a juntar. Es el mismo
    // `expandRecipeCost` mirando para el otro lado — si el costo se deriva, lo
    // que ya tiene también.
    const credited = new Map<string, number>();
    const credit = (kind: string, count: number): void => {
      credited.set(kind, (credited.get(kind) ?? 0) + count);
    };
    for (const [kind, count] of heldCounts(perception)) {
      const made = recipeProducing(perception.recipes, kind);
      if (!made) {
        credit(kind, count);
        continue;
      }
      for (const [base, n] of expandRecipeCost(made, perception.recipes, { times: count }).base) {
        credit(base, n);
      }
    }

    const missing = [...cost.base]
      .map(([kind, need]) => ({ kind, need, have: credited.get(kind) ?? 0 }))
      .filter((m) => m.have < m.need);
    if (missing.length === 0) return null;

    // Del tronco a las hojas: "una casa son 8 paredes; una pared son 2 tablas;
    // y una tabla, 1 tronco".
    const chain = [...cost.steps]
      .reverse()
      .map((step) => {
        const stepRecipe = perception.recipes.find((r) => r.id === step.recipeId);
        if (!stepRecipe) return null;
        const product = recipeProduct(stepRecipe)?.kind ?? step.recipeId;
        const parts = stepRecipe.ingredients
          .map((i) => countedKindLabel(i.kind, i.count))
          .join(' y ');
        const total = stepRecipe.ingredients.reduce((sum, i) => sum + i.count, 0);
        return `${kindWithArticle(product)} ${total === 1 ? 'es' : 'son'} ${parts}`;
      })
      .filter((part): part is string => part !== null);

    const total = missing.reduce((sum, m) => sum + (m.need - m.have), 0);
    const falta = total === 1 ? 'me falta' : 'me faltan';
    return `${chain.join('; ')}. En total ${falta} ${displayMissing(missing)} y no veo más por acá`;
  }

  private describeActivityFailure(
    reason: string,
    activity: Activity,
    perception: Perception,
  ): string {
    if (reason.startsWith('no-candidates:')) {
      return this.missingForCraft(activity, perception) ?? 'no encuentro el objeto';
    }
    const descriptions: Record<string, string> = {
      'no-conozco-esa-habilidad': 'ya no tengo esa habilidad disponible',
      'camino-bloqueado': 'el camino está bloqueado',
      'no-pude-recogerlo': 'no pude recoger el objeto',
      'no-pude-comerlo': 'no pude comer el alimento',
      'no-pude-recoger-la-herramienta': 'no pude recoger la herramienta',
      'objetivo-resistió': 'el objeto resistió mis intentos',
      'sin-interaccion': 'no se me ocurrió una forma de hacerlo que mi mundo acepte',
      'no-pude-interactuar': 'el mundo no aceptó la interacción en ese momento',
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
