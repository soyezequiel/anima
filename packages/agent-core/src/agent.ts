import type { EventLog, Vec2 } from '@anima/shared';
import {
  chebyshev,
  countedKindLabel,
  createEventLog,
  displayKindList,
  isFeminineKind,
  kindLabel,
  kindWithArticle,
  manhattan,
} from '@anima/shared';
import type {
  ActionIntent,
  Blueprint,
  BlueprintPlacement,
  Direction,
  EntityId,
  Perception,
  PerceivedEntity,
  Recipe,
  SimEvent,
} from '@anima/sim-core';
import {
  blueprintCounts,
  MAX_BLUEPRINT_OFFSET,
  expandRecipeCost,
  groundKey,
  isMadeFrom,
  MAX_RECIPE_DEPTH,
  missingIngredients,
  perceivedGround,
  recipeProduces,
  recipeProducing,
  recipeProduct,
  validateRecipe,
} from '@anima/sim-core';
import type { KnowledgeAssessment, MemoryData, MemoryStore } from '@anima/memory';
import { MemoryStore as MemoryStoreImpl } from '@anima/memory';
import type {
  CommandInterpretation,
  EpistemicContextItem,
  ModelProvider,
  ModelRequest,
} from '@anima/model-providers';
import type {
  EvaluationCriterion,
  GpsPlaces,
  SkillDefinition,
  SkillLibrary,
  SkillProgram,
} from '@anima/skill-runtime';
import {
  describeCriterion,
  SkillExecution,
  SpatialMemory,
  validateSuccessCriteria,
} from '@anima/skill-runtime';
import type { EvaluationCaseHook, NamedScenario, RegressionStore } from '@anima/skill-evaluator';
import type { AgentEvent } from './events.js';
import { planCausalRequest } from './causal-world-model.js';
import {
  conditionForUserRequest,
  evaluateGoalCondition,
  type GoalCondition,
  type GoalConditionEvaluation,
} from './goal-conditions.js';
import type {
  Goal,
  GoalManagerData,
  GoalStep,
  GoalUserRequest,
  LearningContract,
} from './goals.js';
import { GoalManager } from './goals.js';
import type { PersonalityTrait } from './personality.js';
import { derivePersonality } from './personality.js';
import type { PlaceMemoryData } from './place-memory.js';
import { PlaceMemory } from './place-memory.js';
import type { ReferenceMemoryData } from './reference-resolver.js';
import { resolveEntityReference } from './reference-resolver.js';
import type { ProgressData, StrategyRecord } from './progress.js';
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
import { InventionEngine, inventionCreditKey } from './invention.js';
import {
  GOAL_BE_SAFE,
  GOAL_RESTORE_ENERGY,
  GOAL_RESTORE_WARMTH,
  normalizeSkillName,
  SKILL_GET_WARM,
  SKILL_REACH_BLOCKED_FOOD,
} from './names.js';
import {
  breakThroughProgram,
  buildFireProgram,
  countPlacements,
  DIRECT_APPROACH_PROGRAM,
  gatherAndCraftProgram,
  heldCounts,
  rememberedFoodProgram,
  rememberedHeatProgram,
  retreatProgram,
  SEEK_FOOD_PROGRAM,
  SEEK_SHELTER_PROGRAM,
  SEEK_WARMTH_PROGRAM,
  SHELTER_APPROACH_PROGRAM,
  stepsToward,
  WARMTH_APPROACH_PROGRAM,
} from './programs.js';
import type { UserRequestProgramDeps } from './user-request-programs.js';
import { completionReply, programForUserRequest } from './user-request-programs.js';
import { groundSpatialRequest } from './spatial-goals.js';

const LOW_ENERGY_FRACTION = 0.35;
const LOW_TEMPERATURE_FRACTION = 0.35;
/**
 * A partir de dónde una necesidad del cuerpo se da por SATISFECHA y su
 * objetivo se cierra, aunque no lo haya resuelto ella (ADR 0062).
 *
 * Cómodamente por encima del umbral que la enciende (0.35) a propósito: con
 * los dos en el mismo número, un cuerpo oscilando alrededor de la línea abriría
 * y cerraría el objetivo cada tick. Esa distancia ES la histéresis.
 */
const RECOVERED_NEED_FRACTION = 0.6;
/**
 * Cada cuántos ticks un encargo que se quedó sin material vuelve a salir a
 * buscarlo (ADR 0065). Suficiente para que no sea un bucle de reintentos —el
 * programa explora hasta cincuenta pasos cada vez— y poco para que una obra a
 * medias no se quede a medias para siempre.
 */
const RETRY_SEARCH_TICKS = 120;
/**
 * Cuántas veces, como mucho, se abre paso a golpes por un mismo encargo (ADR
 * 0067). Dos o tres aperturas alcanzan para cruzar un mapa partido; a partir de
 * ahí, que la materia siga sin aparecer significa que el problema no era el
 * camino, y seguir rompiendo es demoler el mundo por nada.
 */
const MAX_PATH_OPENINGS = 3;
/**
 * Cuánto tiene que empeorar una necesidad del cuerpo, desde que se rindió, para
 * que vuelva a intentarlo sola (ADR 0046). Es una fracción del máximo: perder
 * otro 10% de calor después de haber dicho "no puedo" es información nueva
 * sobre el mundo — el motivo no solo sigue vivo, está ganando.
 *
 * No es cero a propósito: reactivar en cada tick sería el mismo bucle que el
 * ADR 0028 evita. Cada reactivación re-arma la marca en el valor nuevo, así que
 * los reintentos se espacian solos a medida que el cuerpo se apaga.
 */
const WORSENED_MOTIVE_DROP = 0.1;
/**
 * Bajo esta fracción, una necesidad del cuerpo deja de esperar su turno y le
 * saca la actividad en curso a lo que el cuidador pidió (ADR 0048). Es más
 * bajo que el umbral de alerta (0.35) a propósito: entre uno y otro ella
 * atiende el problema pero termina lo que estaba haciendo — recién acá el
 * cuerpo pasa por encima de la palabra.
 */
const CRITICAL_NEED_FRACTION = 0.2;
/** Cuán lejos busca un claro donde plantar una obra, en celdas (ADR 0049). */
const STRUCTURE_SITE_SEARCH = 6;
/**
 * Bajo esta fracción de salud, con el peligro todavía al alcance, el dolor
 * deja de ser un reflejo de un paso y pasa a ser un motivo: nace el objetivo
 * de ponerse a salvo, por encima del hambre — morirse ahora le gana a comer
 * después.
 */
const LOW_HEALTH_FRACTION = 0.5;
/**
 * Distancia (Chebyshev) a la que lo que daña deja de alcanzarla. El peligro
 * solo lastima a quien está ENCIMA (ADR 0041), así que salirse de la celda ya
 * es estar a salvo. Antes valía 2 y peleaba contra el calor: la fogata calienta
 * hasta 2 y quemaba a 1, de modo que «a salvo» y «en calor» no tenían ninguna
 * celda en común y la mascota oscilaba entre las dos hasta morir.
 */
const SAFE_DISTANCE = 1;

/**
 * El hecho que deja el dolor en la memoria. Dice «encima» y no «pegado»
 * porque desde el ADR 0041 eso es literalmente lo que pasa: al lado del fuego
 * se está en calor, dentro del fuego se está en problemas.
 */
function hazardFact(kind: string): string {
  return `estar encima de un ${kindLabel(kind)} hace daño`;
}

/**
 * Qué obra levanta este encargo, si levanta alguna. Los dos pasos en que se
 * parte «fabricá un puente y ponelo sobre el agua» (ADR 0078) nombran el mismo
 * plano en campos distintos: el que construye lo llama `recipeId` y el que
 * coloca, `targetKind`. Contestar lo mismo para los dos es lo que los deja
 * compartir una sola obra.
 */
function structureBlueprintIdOf(goal: Goal): string | undefined {
  const request = goal.userRequest;
  if (request?.kind === 'craft-item') return request.recipeId ?? undefined;
  if (request?.kind === 'place-item') return request.targetKind;
  return undefined;
}

/**
 * La redacción anterior, cuando el daño alcanzaba a los adyacentes. Sigue
 * contando como saber que eso duele: una mascota que aprendió con el cuerpo
 * viejo no debería olvidarse del fuego porque cambió la física.
 */
function legacyHazardFact(kind: string): string {
  return `estar pegado a un ${kindLabel(kind)} hace daño`;
}

/**
 * Verbo del recuerdo de acción según lo destruido (ADR 0033): romper una
 * pared y talar un árbol son gestos distintos aunque el evento sea el mismo.
 */
const DEED_VERBS: Record<string, string> = {
  tree: 'talé',
};

type VisibleEntity = Perception['self']['heldItems'][number];

/**
 * Cómo se le nombra una cosa vista al diseñador de una habilidad: no solo su
 * tipo, también lo que el motor sabe de ella y él necesita para razonar —si
 * sirve de herramienta y con cuánta fuerza, si se come, y si es un sólido que
 * cierra el paso y con qué dureza cede. Un muro descripto solo como "veo: wall"
 * se lee como algo a rodear; dicho "sólido, cierra el paso, se rompe (dureza
 * 5)" se lee como lo que es: un obstáculo que una herramienta fuerte abre.
 */
function describeVisibleEntity(e: VisibleEntity): string {
  const notes: string[] = [];
  if (e.edible) notes.push('comestible');
  if (e.toolPower !== undefined) notes.push(`herramienta, poder ${e.toolPower}`);
  if (e.solid) {
    notes.push(
      e.hardness !== undefined
        ? `sólido, cierra el paso, se rompe con una herramienta más fuerte que su dureza ${e.hardness}`
        : 'sólido, cierra el paso',
    );
  }
  return `veo: ${e.kind}${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`;
}

/** Prioridad y urgencia por tipo de petición: los objetivos son estructuras. */
const USER_REQUEST_WEIGHTS: Record<GoalUserRequest['kind'], { priority: number; urgency: number }> =
  {
    'consume-item': { priority: 1, urgency: 0.8 },
    'move-direction': { priority: 1, urgency: 0.75 },
    'spatial-relation': { priority: 1, urgency: 0.75 },
    'run-skill': { priority: 1, urgency: 0.7 },
    'craft-item': { priority: 1, urgency: 0.7 },
    'interact-entity': { priority: 1, urgency: 0.7 },
    // Colocar pesa como construir: es el remate de un trabajo, no un recado.
    'place-item': { priority: 1, urgency: 0.7 },
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
  | { kind: 'describe-entity'; description: string; raw: string }
  /**
   * El cuidador pidió varias cosas encadenadas. Cada parte es un encargo de
   * verdad, con su objetivo propio, y van en fila: la segunda espera a que la
   * primera se cierre.
   */
  | { kind: 'sequence'; requests: UserRequest[]; raw: string };

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
  /**
   * Oyente de los mundos imaginados durante una evaluación: recibe la traza
   * de cada caso (escenografía + camino) para que la UI pueda dibujar lo que
   * la mascota sueña mientras desarrolla una habilidad. Sin oyente, nada se
   * captura y nada cambia.
   */
  onEvaluationCase?: EvaluationCaseHook;
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
  /** Identidades salientes del diálogo y de las acciones propias. */
  references?: ReferenceMemoryData;
  /**
   * Dónde está plantada cada obra en curso (ADR 0049). Persiste porque el sitio
   * es del MUNDO, no del plan: si se recalculara al retomar, una obra a medias
   * se mudaría y dejaría sus bloques viejos tirados donde estaban.
   */
  structureSites?: { goalId?: string; blueprintId: string; anchor: Vec2 }[];
  /** Tipos que todavía espera dibujar (ADR 0064). Falta en guardados viejos. */
  pendingGlyphs?: string[];
  /** Obras que todavía espera dibujar. Falta en guardados viejos. */
  pendingWorkGlyphs?: string[];
  /**
   * Qué materia espera cada encargo dormido, y desde cuándo (ADR 0066). Sin
   * esto, recargar la página dejaba huérfano a todo encargo suspendido: sin la
   * lista, ningún camino podía despertarlo — ni ver el material, ni recordarlo,
   * ni volver a salir a buscarlo.
   */
  suspensionMaterials?: { goalId: string; kinds: string[]; sinceTick: number }[];
  /**
   * Cuántas veces se abrió paso por cada encargo (ADR 0068). Se guarda porque
   * es un TOPE: en memoria, cada recarga lo volvía a cero y el límite dejaba de
   * existir — cinco recargas son cinco veces el presupuesto de demolición.
   */
  pathOpenings?: { goalId: string; count: number }[];
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
  /**
   * De qué murió, qué dejó a medias y qué le recomendaría a quien venga (ADR
   * 0047). El informe ya calculaba las tres cosas y las mostraba en la pantalla
   * de muerte, pero las descartaba al heredar: la sucesora nacía sin la única
   * lección que le habría salvado la vida. Entra como MEMORIA —episodios e
   * hipótesis—, nunca como objetivo: su vida la elige ella.
   */
  cause?: string;
  unfinishedGoals?: string[];
  recommendations?: string[];
}

interface Activity {
  goalId: string;
  strategy: string;
  exec: SkillExecution;
  /**
   * `open-path` (ADR 0066) es trabajo AL SERVICIO de un encargo, no el encargo:
   * abrirse paso no cumple nada por sí solo. Termine como termine, el objetivo
   * queda vivo para que el próximo tick vuelva a intentar lo que quería hacer,
   * ahora con el camino despejado.
   */
  purpose: 'restore-energy' | 'user-request' | 'be-safe' | 'open-path';
  completionReply?: string;
  requestRaw?: string;
  skillId?: string;
  /** Recuerdo que esta actividad fue a comprobar: se invalida si mintió. */
  rememberedPlaceId?: string;
  consumedFood: boolean;
  energyAtStart: number;
}

/** Cómo retomar el objetivo cuando llegue el veredicto de una práctica. */
type SkillDevResume = (
  outcome: SkillDevOutcome,
  perception: Perception,
) => Promise<ActionIntent | null>;

/**
 * Una práctica de habilidad corriendo en segundo plano (ADR 0043): el ciclo
 * propose→evaluate→revise sigue en su imaginación mientras ella vive — chatea,
 * se aparta del dolor, atiende otros objetivos. `settled` se llena cuando el
 * ciclo termina; un think posterior lo consume con `resume`. Efímera como la
 * actividad: no se persiste — al restaurar, el objetivo sigue activo y el
 * ciclo se reabre solo.
 */
interface SkillDevRun {
  goalId: string;
  name: string;
  settled: { status: 'ok'; outcome: SkillDevOutcome } | { status: 'error'; error: unknown } | null;
  resume: SkillDevResume;
}

/**
 * Una materia que un objetivo pide y todavía no está reunida (ADR 0052).
 * `need` es cuánta hace falta para lo que QUEDA por hacer; `have`, cuánta lleva
 * encima. La resta es lo que hay que salir a buscar.
 */
export interface GoalNeed {
  kind: string;
  need: number;
  have: number;
  /** Hay uno suelto y levantable a la vista: puede ir sola a buscarlo. */
  visible: boolean;
  /** De qué se saca rompiéndolo ("tree"), cuando no hay ninguno suelto. */
  from?: string;
}

/** Lo que le falta a un objetivo abierto, para dibujarlo. */
export interface GoalPlan {
  goalId: string;
  needs: GoalNeed[];
  /** Si el objetivo es una obra: cuántos bloques puestos de cuántos. */
  structure?: { blueprintId: string; placed: number; total: number };
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
  /** La práctica de habilidad en segundo plano, como mucho una a la vez:
   * los mundos imaginados no son reentrantes y una mente alcanza. */
  private skillDevRun: SkillDevRun | null = null;
  private pendingSpeech: string[] = [];
  /** Número de planes causales intentados por objetivo (efímero; al restaurar se replanifica). */
  private readonly causalPlanAttempts = new Map<string, number>();
  /**
   * Tipos que aparecieron y todavía no tienen dibujo (la quinta puerta). Se
   * vacía en los ratos ociosos, nunca compitiendo con una necesidad.
   */
  private pendingGlyphs: string[] = [];
  /**
   * Obras aprendidas que todavía no tienen aspecto propio. Cola aparte de la de
   * tipos porque es otra unidad de trabajo: un plano entero por consulta.
   */
  private pendingWorkGlyphs: string[] = [];
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
  /**
   * El último "no" del mundo, con su motivo. Es memoria de un tick, no un
   * archivo: lo que se conserva de verdad son los HECHOS que se derivan de él.
   */
  private lastWorldRefusal: { reason: string; targetId?: string; tick: number } | null = null;
  private lastSelectedGoalId: string | null = null;
  private lastUserRequest: UserRequest | null = null;
  private references: ReferenceMemoryData = {
    lastMentioned: [],
    lastUsed: [],
    createdByMe: [],
  };
  /** Su nombre actual. La identidad persiste fuera; esto alimenta su habla. */
  private petName: string;
  /** Comestibles visibles al suspender cada objetivo: reactivar exige uno NUEVO. */
  private suspensionEdibles = new Map<string, Set<string>>();
  /**
   * Fuentes de calor visibles al suspender, y cuán frío tenía en ese momento
   * (ADR 0046). Es el gemelo de `suspensionEdibles`, más la marca del motivo:
   * sin ella, "el frío empeoró" no se puede medir contra nada y el objetivo
   * dormía para siempre. Transitorio como el resto de las marcas de progreso.
   */
  private suspensionWarmth = new Map<string, { sources: Set<string>; fraction: number }>();
  /** Cuán apretaba el hambre al suspender: la misma marca, para el otro motivo. */
  private suspensionFractions = new Map<string, number>();
  /**
   * Materia que le faltaba al suspender un pedido del cuidador (ADR 0046). Un
   * encargo que se queda sin material no está fracasado, está esperando: cuando
   * eso aparece —porque lo juntó, porque lo fabricó, porque el cuidador se lo
   * trajo— la obra se retoma sola desde donde quedó.
   */
  private suspensionMaterials = new Map<string, string[]>();
  /**
   * Qué tenía a la vista al suspender cada encargo: reactivar exige algo NUEVO.
   *
   * Es el gemelo de `suspensionEdibles` para la materia, y faltaba. Sin él,
   * «apareció el material que faltaba» se cumplía con lo que ya estaba ahí
   * cuando se rindió: se dormía esperando ver una piedra, la piedra nunca se
   * había ido, y al tick siguiente se despertaba, fallaba igual y se volvía a
   * dormir. Medido en vivo en el cauce ancho: 100 suspensiones y 100
   * reactivaciones en 100 ticks, sin una sola acción en el medio.
   *
   * Esperar algo que ya tenés delante no es esperar: es girar en el lugar.
   */
  private suspensionSeen = new Map<string, Set<string>>();
  /**
   * Cuándo se rindió cada encargo por falta de materia (ADR 0065). Es lo que
   * permite volver a INTENTARLO al rato en vez de esperar para siempre a que
   * el material aparezca solo delante de sus ojos.
   */
  private suspensionTick = new Map<string, number>();
  /** Cuántas veces se abrió paso por cada encargo (ADR 0067): su tope. */
  private pathOpenings = new Map<string, number>();
  /**
   * Lo último que pidió por cada encargo (ADR 0068). Pedir lo mismo cada dos
   * minutos es ruido: se vuelve a pedir cuando la lista CAMBIA — porque
   * consiguió parte, o porque ahora le falta otra cosa.
   */
  private lastAskedFor = new Map<string, string>();
  /**
   * Dónde quedó plantada cada obra, POR PLANO (ADR 0049). Se elige una vez, al
   * empezar, y no se vuelve a mover: es lo que hace que retomar una obra sea
   * seguir la misma y no empezar otra al lado.
   *
   * La clave es el plano y no el objetivo porque una obra es una obra: «fabricá
   * un puente» y «ponelo sobre el agua» son dos encargos encadenados (ADR 0078)
   * del MISMO puente. Indexado por objetivo, cada uno abría su propia ancla y se
   * repartían los tablones — se la vio levantar medio puente en (5,4) y medio en
   * (5,5), sin terminar ninguno.
   */
  private structureSites = new Map<string, Vec2>();
  /** Lo último que dijo, para no decirlo dos veces seguidas (ADR 0073). */
  private lastReplyText: string | null = null;
  /**
   * Poder de la herramienta que ya NO hizo mella al romper, por objetivo. Es la
   * marca de "muy duro": mientras exista, el objetivo de romper no vuelve a
   * golpear con lo mismo — busca (o inventa) algo más fuerte antes. Transitorio
   * como la actividad: si se restaura un guardado, se re-aprende al reintentar.
   */
  private destroyToolFloor = new Map<string, number>();
  /**
   * Encargos que se trabaron por no tener HERRAMIENTA con qué cosechar, y de
   * qué querían sacar materia. Se anota acá porque quien lo descubre
   * (`continueActivity`) es síncrono y hacerse una herramienta puede requerir
   * inventarla: el camino que decide, que sí es asíncrono, lo consume al tick
   * siguiente. Es el mismo mecanismo con el que `destroyToolFloor` escala un
   * golpe que no hizo mella.
   */
  private harvestToolBlocked = new Map<string, string>();
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

  /**
   * La ventana de la memoria de lugares que el GPS de la DSL puede mirar
   * (ADR 0038): recordar dónde había un tipo y desmentir el recuerdo tras ir
   * y no encontrar nada. El intérprete no recibe la memoria entera.
   */
  private gpsPlaces(): GpsPlaces {
    return {
      recall: (kind, perception) =>
        this.places
          .recall({ kind }, perception)
          .map((p) => ({ entityId: p.entityId, position: p.position })),
      forget: (entityId) => this.places.forget(entityId),
    };
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
      rememberedWalkForEntity: (entityId) => {
        const remembered = this.places.all().find((place) => place.entityId === entityId);
        return remembered
          ? this.walkStepsAvoidingHazards(perception, remembered.position, 1)
          : undefined;
      },
      harvestSource: (kind) => this.harvestSourceFor(kind, perception),
      structureSite: (blueprint) => {
        const goalId = this.activeStructureGoalId(blueprint);
        if (goalId === null) return null;
        const anchor = this.siteFor(goalId, blueprint, perception);
        if (!anchor) return null;
        // El mismo camino con el que se validó el sitio (ADR 0071). Si desde
        // acá ya no se llega —el sitio se eligió con lo que veía y apareció
        // algo en el medio—, no hay aproximación que dar: el programa aborta
        // con `camino-bloqueado` en vez de plantar la obra donde se trabe.
        const approach = this.clearWalkTo(perception, anchor, 0);
        return {
          approach: approach ?? this.walkStepsAvoidingHazards(perception, anchor, 0),
          pending: this.pendingPlacements(blueprint, anchor, perception),
        };
      },
    };
  }

  private rememberReference(bucket: keyof ReferenceMemoryData, entityId: string): void {
    const previous = this.references[bucket];
    this.references[bucket] = [entityId, ...previous.filter((id) => id !== entityId)].slice(0, 8);
  }

  /**
   * Las obras plantadas y cómo van, para que se puedan DIBUJAR (ADR 0049).
   * Cada celda dice qué bloque le toca y si ya está puesto: con eso la pantalla
   * muestra la silueta de lo que va a levantar antes de que exista. Es lectura
   * pura — nada de lo que pase acá cambia el mundo ni sus objetivos.
   */
  plannedStructures(perception: Perception): {
    goalId: string;
    blueprintId: string;
    cells: { kind: string; x: number; y: number; done: boolean }[];
  }[] {
    const planned: {
      goalId: string;
      blueprintId: string;
      cells: { kind: string; x: number; y: number; done: boolean }[];
    }[] = [];
    for (const [blueprintId, anchor] of this.structureSites) {
      const blueprint = perception.blueprints.find((b) => b.id === blueprintId);
      if (!blueprint) continue;
      // Sin encargo abierto que la pida, la obra deja de estar en curso y su
      // silueta se borra (ADR 0059). Cualquiera de los encargos encadenados
      // sirve: es el mismo puente.
      const goalId = this.activeStructureGoalId(blueprint);
      if (goalId === null) continue;
      const pending = new Set(
        this.pendingPlacements(blueprint, anchor, perception).map(
          (p) => `${p.kind}@${p.offset.x},${p.offset.y}`,
        ),
      );
      planned.push({
        goalId,
        blueprintId: blueprint.id,
        cells: blueprint.placements.map((placement) => ({
          kind: placement.kind,
          x: anchor.x + placement.offset.x,
          y: anchor.y + placement.offset.y,
          done: !pending.has(`${placement.kind}@${placement.offset.x},${placement.offset.y}`),
        })),
      });
    }
    return planned;
  }

  /**
   * Lo que cada objetivo abierto necesita que alguien consiga, en DATOS (ADR
   * 0052). Es la misma cuenta con la que se suspende y se retoma sola
   * (`neededCountsFor`), pero sin volverse frase: la pantalla necesita el tipo y
   * el número para dibujarlos, no una oración para leerlos.
   *
   * Cada faltante viaja con de dónde sale (`from`) y si hay uno suelto a la
   * vista (`visible`). Esa diferencia es la que convierte «le falta un tronco»
   * en algo accionable: si hay uno tirado, ella va sola; si no, alguien tiene
   * que talar un árbol o traérselo.
   */
  goalPlans(perception: Perception): GoalPlan[] {
    const plans: GoalPlan[] = [];
    for (const goal of this.goals.all()) {
      if (goal.status !== 'active' && goal.status !== 'suspended') continue;
      const needs: GoalNeed[] = this.neededCountsFor(goal, perception).map((count) => {
        const visible = perception.visibleEntities.some(
          (e) => e.kind === count.kind && e.held !== true && e.portable === true,
        );
        const from = visible ? undefined : this.harvestSourceFor(count.kind, perception);
        return { ...count, visible, ...(from ? { from } : {}) };
      });
      const blueprintId = structureBlueprintIdOf(goal);
      const anchor = blueprintId === undefined ? undefined : this.structureSites.get(blueprintId);
      const blueprint = blueprintId
        ? perception.blueprints.find((b) => b.id === blueprintId)
        : undefined;
      const structure =
        anchor && blueprint
          ? {
              blueprintId: blueprint.id,
              total: blueprint.placements.length,
              placed:
                blueprint.placements.length -
                this.pendingPlacements(blueprint, anchor, perception).length,
            }
          : undefined;
      plans.push({ goalId: goal.id, needs, ...(structure ? { structure } : {}) });
    }
    return plans;
  }

  /**
   * Qué materia pide un encargo y cuánta lleva ya encima. Una sola cuenta para
   * los tres que la necesitan: la frase honesta del cuidador, el retomar solo
   * cuando aparece el material, y la pantalla. Tenerla escrita tres veces era
   * pedir que las tres dijeran cosas distintas del mismo objetivo.
   *
   * Para una obra, lo que pide es lo que falta LEVANTAR (no el plano entero):
   * con cuatro muros ya puestos, los muros puestos no se vuelven a juntar.
   */
  private neededCountsFor(
    goal: Goal | undefined,
    perception: Perception,
  ): { kind: string; need: number; have: number }[] {
    const request = goal?.userRequest;
    if (!request) return [];
    const held = heldCounts(perception);
    // Traer o romper algo que no está: lo que falta es ese tipo, sin más cuenta
    // que hacer. Romper no se acredita con lo que lleva encima —tener un tronco
    // no tala el árbol—, así que ahí `have` es siempre cero.
    if (request.kind === 'fetch-item' || request.kind === 'destroy-entity') {
      if (!request.targetKind) return [];
      return [
        {
          kind: request.targetKind,
          need: request.amount ?? 1,
          have: request.kind === 'fetch-item' ? (held.get(request.targetKind) ?? 0) : 0,
        },
      ];
    }
    const recipeId = request.recipeId;
    if (request.kind !== 'craft-item' || !recipeId) return [];
    const blueprint = perception.blueprints.find((b) => b.id === recipeId);
    if (blueprint) return this.blueprintNeeds(blueprint, perception);
    const recipe = perception.recipes.find((r) => r.id === recipeId);
    if (!recipe) return [];
    return missingIngredients(recipe, held).map((m) => ({
      kind: m.kind,
      need: m.need,
      have: m.have,
    }));
  }

  /**
   * Los pasos de un encargo, plantados como objetivos hijos (ADR 0053): un
   * «conseguir N× tal cosa» por cada materia que el plan pide, y un remate
   * («levantar la obra» / «armarlo»). Son objetivos de verdad —persisten, se
   * ven, se completan— pero no compiten en la fila: quien trabaja es el
   * programa del padre; los hijos son el mapa de ese trabajo.
   *
   * Idempotente a propósito: se llama en cada arranque y reanudación, y solo
   * repone lo que falte — si una receta inventada a mitad de camino agrega una
   * materia nueva, su paso aparece; los ya creados no se duplican.
   */
  private ensureRequestSteps(goal: Goal, perception: Perception): void {
    const request = goal.userRequest;
    if (request?.kind !== 'craft-item' || !request.recipeId) return;
    const existing = this.goals.childrenOf(goal.id);
    const asStep = (step: GoalStep, description: string): void => {
      const child = this.goals.create(
        {
          description,
          source: goal.source,
          priority: goal.priority,
          urgency: goal.urgency,
          expectedValue: goal.expectedValue,
          preconditions: [],
          parentGoalId: goal.id,
          step,
        },
        this.tick,
      );
      this.emit('goal.created', {
        goalId: child.id,
        description,
        source: goal.source,
        parentGoalId: goal.id,
      });
    };
    for (const count of this.neededCountsFor(goal, perception)) {
      if (count.have >= count.need) continue;
      if (existing.some((c) => c.step?.kind === 'gather' && c.step.targetKind === count.kind)) {
        continue;
      }
      // "4× pared escuela" y no "4 pared escuelas": el plural español de un
      // nombre compuesto va en la cabeza ("paredes escuela"), y el pluralizador
      // —que no puede saber si la segunda palabra es sustantivo o adjetivo—
      // se lo pegaba al final. La notación con × esquiva la gramática y dice
      // lo mismo, además de leerse igual que los chips de materia.
      asStep(
        { kind: 'gather', targetKind: count.kind, need: count.need },
        `conseguir ${count.need}× ${kindLabel(count.kind)}`,
      );
    }
    if (!existing.some((c) => c.step?.kind === 'assemble')) {
      const isStructure = perception.blueprints.some((b) => b.id === request.recipeId);
      asStep(
        { kind: 'assemble' },
        isStructure
          ? `levantar ${kindWithArticle(request.recipeId)}`
          : `armar ${kindWithArticle(request.recipeId)}`,
      );
    }
  }

  /**
   * Da por cumplidos los pasos que el mundo ya cumplió (ADR 0053). La vara es
   * la MISMA cuenta con la que el encargo se suspende y retoma
   * (`neededCountsFor`): un paso de juntar se cierra cuando esa materia ya no
   * falta — porque la juntó, se la trajeron, o la obra ya la tiene puesta. El
   * remate no se cierra acá: lo cierra el padre al completarse, en cascada.
   *
   * Cerrado es cerrado: si después suelta el material, el paso no revive — el
   * encargo entero se volverá a suspender con la lista fresca, que es el
   * mecanismo que ya existe para eso.
   */
  private settleRequestSteps(perception: Perception): void {
    for (const goal of this.goals.all()) {
      if (goal.status !== 'active' && goal.status !== 'suspended') continue;
      if (goal.userRequest?.kind !== 'craft-item') continue;
      const children = this.goals
        .childrenOf(goal.id)
        .filter((c) => c.status === 'active' || c.status === 'suspended');
      if (children.length === 0) continue;
      const counts = new Map(
        this.neededCountsFor(goal, perception).map((c) => [c.kind, c] as const),
      );
      for (const child of children) {
        if (child.step?.kind !== 'gather') continue;
        const count = counts.get(child.step.targetKind);
        if (count && count.have < count.need) continue;
        this.goals.complete(child.id);
        this.emit('goal.step.completed', {
          goalId: child.id,
          parentGoalId: goal.id,
          description: child.description,
        });
      }
    }
  }

  private evaluateGoal(goal: Goal, perception: Perception): GoalConditionEvaluation | undefined {
    if (!goal.successCondition) return undefined;
    return evaluateGoalCondition(goal.successCondition, {
      perception,
      ...(goal.bindings ? { bindings: goal.bindings } : {}),
      absentEntityIds: new Set(goal.absentEntityIds ?? []),
      facts: new Set(goal.observedFacts ?? []),
      counters: goal.counters ?? {},
      blueprintComplete: (blueprintId) => {
        const blueprint = perception.blueprints.find((candidate) => candidate.id === blueprintId);
        const anchor = this.structureSites.get(blueprintId);
        if (!blueprint || !anchor) return undefined;
        return this.pendingPlacements(blueprint, anchor, perception).length === 0;
      },
      stableSkillExists: (name) => this.config.library.findStable(name) !== undefined,
    });
  }

  /** Cierra o falla metas solo con predicados verificables del mundo. */
  private settleDeclarativeGoals(perception: Perception): void {
    for (const goal of this.goals.all()) {
      if (goal.status !== 'active' && goal.status !== 'suspended') continue;
      // Los motivos del cuerpo y el aprendizaje ya tienen ciclos propios. La
      // migración se aplica donde se confundía el fin de la DSL con cumplir un
      // encargo físico.
      if (goal.source !== 'user-request') continue;
      // Una actividad en curso conserva el turno hasta que la DSL entregue su
      // resultado; ahí se comparan explícitamente ambos ejes y se responde una
      // sola vez. La condición igual se mide con la percepción fresca.
      if (this.activity?.goalId === goal.id) continue;
      if (goal.failureCondition) {
        const failure = evaluateGoalCondition(goal.failureCondition, {
          perception,
          ...(goal.bindings ? { bindings: goal.bindings } : {}),
          absentEntityIds: new Set(goal.absentEntityIds ?? []),
          facts: new Set(goal.observedFacts ?? []),
          counters: goal.counters ?? {},
        });
        if (failure.status === 'met') {
          this.goals.fail(goal.id);
          if (this.activity?.goalId === goal.id) this.activity = null;
          continue;
        }
      }
      const success = this.evaluateGoal(goal, perception);
      if (goal.mode !== 'achievement' || success?.status !== 'met') continue;
      this.goals.complete(goal.id);
      if (this.activity?.goalId === goal.id) this.activity = null;
      this.progress.resetGoal(goal.id);
      this.emit('goal.completed', { goalId: goal.id, strategy: 'condición-del-mundo' });
    }
  }

  /**
   * ¿Quedó la obra a medias? (ADR 0059). Se pregunta al MUNDO —qué celdas del
   * plano siguen vacías— y no al programa, que solo sabe si llegó al final de
   * sus operaciones sin abortar.
   *
   * Solo aplica a los encargos que son obras: un «traé un tronco» no tiene
   * celdas que revisar, y ahí terminar el programa sí es haberlo cumplido.
   */
  private unfinishedStructure(goalId: string, perception: Perception): boolean {
    const goal = this.goals.get(goalId);
    const recipeId = goal?.userRequest?.recipeId;
    if (goal?.userRequest?.kind !== 'craft-item' || !recipeId) return false;
    const blueprint = perception.blueprints.find((b) => b.id === recipeId);
    const anchor = this.structureSites.get(recipeId);
    if (!blueprint || !anchor) return false;
    return this.pendingPlacements(blueprint, anchor, perception).length > 0;
  }

  /**
   * Lo que pide una obra descontando lo ya levantado. Sin sitio elegido todavía
   * la cuenta es el plano entero: nada está puesto porque no hay dónde.
   */
  private blueprintNeeds(
    blueprint: Blueprint,
    perception: Perception,
  ): { kind: string; need: number; have: number }[] {
    const anchor = this.structureSites.get(blueprint.id);
    const remaining = anchor
      ? countPlacements(this.pendingPlacements(blueprint, anchor, perception))
      : blueprintCounts(blueprint);
    const held = heldCounts(perception);
    return [...remaining].map(([kind, need]) => ({ kind, need, have: held.get(kind) ?? 0 }));
  }

  /**
   * El objetivo que está levantando este plano, si hay uno abierto.
   *
   * Cuentan los dos pasos que pueden pedir la obra: el que la construye y el
   * que la deja puesta en algún lado. Para una obra son el mismo trabajo, y si
   * el segundo no encontrara sitio abortaría con `sin-sitio` teniendo la obra
   * a medio levantar delante.
   */
  private activeStructureGoalId(blueprint: Blueprint): string | null {
    const goal = this.goals
      .all()
      .find(
        (candidate) =>
          (candidate.status === 'active' || candidate.status === 'suspended') &&
          structureBlueprintIdOf(candidate) === blueprint.id,
      );
    return goal?.id ?? null;
  }

  /**
   * El sitio de esta obra: el ya elegido si lo hay, o uno nuevo. Guardarlo es
   * lo que hace que retomar sea seguir la misma obra y no empezar otra al lado
   * (ADR 0049). Si el plano cambió (ella lo reinventó), el sitio viejo no vale.
   */
  private siteFor(goalId: string, blueprint: Blueprint, perception: Perception): Vec2 | null {
    const onto = this.destinationKindFor(goalId);
    const known = this.structureSites.get(blueprint.id);
    if (known) {
      // El sitio se eligió con lo que VEÍA, y la vista exige línea despejada
      // (ADR 0025): una roca detrás de otra no estaba en el mapa que miró. Al
      // acercarse aparece, y entonces el claro no era tal.
      //
      // Mudarse solo es legítimo mientras no haya puesto nada: una vez que hay
      // un bloque en el suelo, el sitio es ese y lo que estorba se resuelve de
      // otra forma. Sin esta condición, descubrir un obstáculo a mitad de obra
      // dejaría media choza abandonada y empezaría otra al lado.
      const untouched =
        this.pendingPlacements(blueprint, known, perception).length === blueprint.placements.length;
      // Mientras no haya puesto nada, un sitio que NO da al destino que le
      // pidieron se puede abandonar: al elegirlo quizá no veía el río todavía.
      const serves = onto === undefined || this.siteServes(blueprint, known, onto, perception);
      if (!untouched || (serves && this.siteFits(blueprint, known, perception))) {
        return known;
      }
    }
    const chosen = this.chooseStructureSite(blueprint, perception, onto);
    if (!chosen) return known ?? null;
    this.structureSites.set(blueprint.id, chosen);
    return chosen;
  }

  /**
   * Sobre QUÉ le pidieron dejar esta obra, si el encargo lo dijo.
   *
   * «Fabricá algo, ponelo sobre el agua y cruzá» se parte en pasos (ADR 0078):
   * el que construye y el que coloca son objetivos distintos, encadenados por
   * `afterGoalId`. El dato de dónde va vive en el SEGUNDO, así que el primero
   * elegía sitio a ciegas — y elegir a ciegas es elegir el más cercano. Se la
   * vio armar el puente entero en el pasto, a cinco celdas del río, con el
   * "sobre el agua" escrito en su propio plan y sin que nadie lo leyera.
   */
  private destinationKindFor(goalId: string): string | undefined {
    const all = this.goals.all();
    // El paso que coloca lleva el destino encima: cuando el activo es ése, no
    // hay que buscar más adelante.
    const own = all.find((g) => g.id === goalId)?.userRequest;
    if (own?.kind === 'place-item' && own.onKind !== undefined) return own.onKind;
    const seen = new Set<string>([goalId]);
    let current = goalId;
    for (;;) {
      const next = all.find((g) => g.afterGoalId === current && !seen.has(g.id));
      if (!next) return undefined;
      if (next.userRequest?.kind === 'place-item' && next.userRequest.onKind !== undefined) {
        return next.userRequest.onKind;
      }
      seen.add(next.id);
      current = next.id;
    }
  }

  /**
   * ¿Esta obra, plantada acá, usa para algo las piezas que ofrecen dónde pisar?
   *
   * Es el destino que la obra declara sin que nadie se lo diga. Un piso existe
   * para volver pisable lo que no lo era: plantado sobre suelo firme no hace
   * absolutamente nada, y la misma obra corrida unas celdas abre un paso. Así
   * que cuando el plano trae piezas con `footing`, el sitio que las apoya sobre
   * el agua sirve y el que las apoya en el pasto no — sin que el encargo tenga
   * que nombrar el agua.
   *
   * Hace falta porque el destino explícito se perdía por cómo se hablaba. «Ponelo
   * sobre el agua» se traduce en un paso que lleva el destino adentro; «tendelo
   * hasta la otra orilla» dice exactamente lo mismo para cualquier persona y se
   * traduce en un `craft-item` pelado, sin destino. El imán se apagaba en
   * silencio y volvía a ganar «el claro más cercano», o sea sus propios pies: se
   * la vio levantar el puente en la orilla, a cuatro celdas del cauce.
   *
   * Una obra sin piezas que se pisen (una casa, un fogón) no tiene destino que
   * declarar, así que esto devuelve false y todo sigue como antes: el sitio más
   * cercano al que pueda llegar.
   */
  private siteUsesFooting(blueprint: Blueprint, anchor: Vec2, perception: Perception): boolean {
    // Y no alcanza con mojar una tabla: el tendido tiene que CRUZAR el agua.
    // Preguntando «¿alguna pieza cae sobre el agua?» el mejor sitio del mapa
    // era el que rozaba la primera columna del cauce, y ahí se quedaba.
    return this.siteCrosses(
      blueprint,
      anchor,
      perceivedGround(perception.visibleEntities).water,
      perception,
    );
  }

  /**
   * Deja anotado lo que tenía a la vista al rendirse, para que reactivar exija
   * una novedad. Se guarda TODO lo visible y no solo lo que le falta: el
   * material que espera puede cambiar entre una suspensión y la siguiente, y
   * una lista parcial dejaría colar como novedad algo que ya estaba.
   */
  private noteWhatSheSaw(goalId: string, perception: Perception): void {
    this.suspensionSeen.set(goalId, new Set(perception.visibleEntities.map((e) => e.id)));
  }

  /**
   * El tramo SEGUIDO más largo de un conjunto de celdas, a lo largo de un eje.
   * Un tendido con un hueco en el medio no es una fila de seis: son dos de tres,
   * y contra un obstáculo lo que vale es el tramo entero.
   */
  private longestRun(cells: Vec2[], horizontal: boolean): number {
    const lines = new Map<number, number[]>();
    for (const cell of cells) {
      const line = horizontal ? cell.y : cell.x;
      const along = horizontal ? cell.x : cell.y;
      lines.set(line, [...(lines.get(line) ?? []), along]);
    }
    let best = 0;
    for (const alongs of lines.values()) {
      const sorted = [...new Set(alongs)].sort((a, b) => a - b);
      let run = 0;
      for (let i = 0; i < sorted.length; i++) {
        run = i > 0 && sorted[i] === sorted[i - 1]! + 1 ? run + 1 : 1;
        best = Math.max(best, run);
      }
    }
    return best;
  }

  /**
   * Por qué esta obra no puede cruzar NUNCA, o null si puede.
   *
   * El juez geométrico, hermano de los que ya cuidan las otras puertas: el
   * mundo mide lo que se puede medir de un plano —que quepa, que sus bloques
   * existan— pero no si SIRVE para lo que nació. Un puente de cinco celdas
   * repartidas alrededor de ella pasa todas las validaciones y no cruza nada:
   * como se para siempre en tierra firme, el medio del tendido cae en la orilla
   * y contra un cauce de cuatro tapa dos.
   *
   * Se la vio hacerlo tres corridas seguidas, incluso con el pedido escrito con
   * todas las letras en el texto de invención. Decirlo no alcanzó; medirlo sí.
   *
   * El motivo viaja con NÚMEROS a la próxima idea (ADR 0018): «tu tramo seguido
   * más largo es 3 y el obstáculo mide 4» es corregible; «hacelo mejor» no.
   *
   * Solo juzga obras que se CAMINAN y que tienen algo que cruzar. Una casa no
   * cruza nada y acá no se la molesta.
   */
  private crossingRejection(
    blueprint: Blueprint,
    goalId: string,
    perception: Perception,
  ): string | null {
    const walkable = blueprint.placements.filter((p) => this.bringsFooting(p.kind, perception));
    if (walkable.length === 0) return null;

    const onto = this.destinationKindFor(goalId);
    const obstacle =
      onto !== undefined
        ? this.targetCells(onto, perception)
        : perceivedGround(perception.visibleEntities).water;
    if (obstacle.size === 0) return null;

    // ¿Existe algún sitio, de todos a los que puede llegar, donde esta obra
    // cruce? Si hay uno, el plano sirve y no hay nada que objetar.
    if (this.bestStructureSite(blueprint, perception, onto)?.serves === true) return null;

    // No hay ninguno: hay que decirle POR QUÉ, con la medida.
    const cells = [...obstacle].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x: x ?? 0, y: y ?? 0 };
    });
    const xs = blueprint.placements.map((p) => p.offset.x);
    const ys = blueprint.placements.map((p) => p.offset.y);
    const horizontal = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
    // Los dos se miden en el MISMO eje: el que la obra recorre. Cuántas celdas
    // de obstáculo seguidas hay que pisar para pasar al otro lado, contra
    // cuántas seguidas ofrece el tendido. Medir el obstáculo en el eje cruzado
    // daba el LARGO del río (9 filas) en vez de su ancho (4 columnas).
    const ancho = this.longestRun(cells, horizontal);
    const tramo = this.longestRun(
      walkable.map((p) => ({ x: p.offset.x, y: p.offset.y })),
      horizontal,
    );
    // Ancho mayor que el alcance: NINGUNA obra cruza esto, por bien diseñada
    // que esté. Decirle "diseñaste mal" sería mandarla a corregir lo
    // incorregible y quemar sus tres intentos contra una pared. El motivo
    // nombra el techo para que la próxima idea sea de otra clase, no otra
    // variante de la misma.
    if (ancho > MAX_BLUEPRINT_OFFSET) {
      return (
        `no es que la hayas diseñado mal: lo que hay que cruzar mide ${ancho} celdas y ` +
        `una obra no llega más allá de ${MAX_BLUEPRINT_OFFSET} desde donde la plantás. ` +
        `Ninguna forma de tendido cruza eso — hace falta otra idea, no otro puente.`
      );
    }
    const lado = walkable.every((p) => (horizontal ? p.offset.x : p.offset.y) > 0)
      ? ''
      : ' Y vos te parás en el 0,0, que es tierra firme: un tendido repartido a los dos lados deja la mitad en la orilla. Tiene que salir de tus pies hacia UN solo lado.';
    return (
      `esa obra no cruza desde ningún lado: su tramo seguido más largo es de ${tramo} ` +
      `celda${tramo === 1 ? '' : 's'} y lo que hay que cruzar mide ${ancho}.${lado}`
    );
  }

  /**
   * Qué le corta el paso y cuánto mide, medido de lo que VE.
   *
   * Es la medida del problema, en datos, antes de imaginar la solución. Sin
   * esto la mascota diseñaba a ciegas y el juez la corregía después, quemando
   * intentos: el cauce salía bien en parte porque el propio encargo del
   * cuidador decía «cuatro pasos», y eso es depender del enunciado. Un mapa que
   * no lo diga la deja adivinando otra vez.
   *
   * El ancho es el del CRUCE, no el del obstáculo: una barrera se cruza por su
   * parte más angosta, así que de los dos ejes vale el menor. Un río de 4
   * columnas y 9 filas mide 4 para quien lo quiere cruzar, no 9.
   *
   * No nombra ríos ni puentes: el tipo sale del encargo (o del agua que ve) y
   * el número sale de contar celdas. En otro mapa es otro obstáculo y otro
   * número.
   */
  private obstacleFor(
    goalId: string,
    perception: Perception,
  ): { kind: string; width: number } | undefined {
    const onto = this.destinationKindFor(goalId);
    const ground = perceivedGround(perception.visibleEntities);
    const keys = onto !== undefined ? this.targetCells(onto, perception) : ground.water;
    if (keys.size === 0) return undefined;
    const cells = [...keys].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x: x ?? 0, y: y ?? 0 };
    });
    const width = Math.min(this.longestRun(cells, true), this.longestRun(cells, false));
    if (width === 0) return undefined;
    return { kind: onto ?? 'agua', width };
  }

  /** Las celdas de lo que le pidieron como destino, a la vista. */
  private targetCells(onto: string, perception: Perception): Set<string> {
    const target = new Set<string>();
    for (const entity of perception.visibleEntities) {
      if (entity.kind === onto && entity.position && entity.held !== true) {
        target.add(groundKey(entity.position));
      }
    }
    return target;
  }

  /**
   * ¿Sirve el sitio para lo que le pidieron? Depende de qué clase de obra sea.
   *
   * Una obra que se CAMINA (sus piezas se pisan) tiene que ATRAVESAR el
   * destino: un puente que apenas lo roza no lleva a ninguna parte. Una que
   * solo se apoya —algo puesto sobre una roca— con tocarlo alcanza; exigirle
   * cruzar sería pedirle que tape la roca entera.
   */
  private siteServes(
    blueprint: Blueprint,
    anchor: Vec2,
    onto: string,
    perception: Perception,
  ): boolean {
    const target = this.targetCells(onto, perception);
    if (target.size === 0) return false;
    const walks = blueprint.placements.some((p) => this.bringsFooting(p.kind, perception));
    if (walks) return this.siteCrosses(blueprint, anchor, target, perception);
    return this.siteReaches(blueprint, anchor, target);
  }

  /** ¿Alguna pieza de la obra, plantada acá, cae sobre el destino pedido? */
  private siteReaches(blueprint: Blueprint, anchor: Vec2, target: ReadonlySet<string>): boolean {
    return blueprint.placements.some((placement) =>
      target.has(groundKey({ x: anchor.x + placement.offset.x, y: anchor.y + placement.offset.y })),
    );
  }

  /**
   * ¿ATRAVIESA la obra el obstáculo, o apenas lo roza?
   *
   * Un puente de cinco tablas es inútil si cuatro caen en el pasto y una en el
   * agua: cumple el plano al pie de la letra y no cruza nada. Se la vio hacer
   * exactamente eso — plano de 5 celdas, ancho de cauce 4, plantado de forma
   * que solo pisaba la primera columna de agua. El plano alcanzaba; la
   * puntería no.
   *
   * Cruzar es tapar el obstáculo ENTERO en la dirección en que la obra corre:
   * desde cualquier celda suya que pise el obstáculo, avanzando para los dos
   * lados, no se puede salir de la obra sin haber salido antes del obstáculo.
   * Una sola celda de agua descubierta en el medio corta el paso ahí.
   */
  private siteCrosses(
    blueprint: Blueprint,
    anchor: Vec2,
    obstacle: ReadonlySet<string>,
    perception: Perception,
  ): boolean {
    if (obstacle.size === 0) return false;
    // Solo cuentan las piezas que se pisan: una obra se cruza caminándola, y un
    // bloque sólido en el medio del tendido es un tapón, no un tramo.
    const walkable = new Set<string>();
    const over: Vec2[] = [];
    for (const placement of blueprint.placements) {
      if (!this.bringsFooting(placement.kind, perception)) continue;
      const cell = { x: anchor.x + placement.offset.x, y: anchor.y + placement.offset.y };
      const key = groundKey(cell);
      walkable.add(key);
      if (obstacle.has(key)) over.push(cell);
    }
    if (over.length === 0) return false;

    // La dirección en que corre la obra es su lado más largo. Un puente
    // este-oeste sobre un río norte-sur tiene que taparlo a lo ANCHO: mirar el
    // otro eje sería pedirle que cubra el río a lo largo, que no termina nunca.
    const xs = blueprint.placements.map((p) => p.offset.x);
    const ys = blueprint.placements.map((p) => p.offset.y);
    const horizontal = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
    const bounds = perception.bounds;

    for (const start of over) {
      for (const dir of [1, -1]) {
        let { x, y } = start;
        for (;;) {
          x += horizontal ? dir : 0;
          y += horizontal ? 0 : dir;
          // Se acabó el mapa y todavía era obstáculo: de este lado no hay orilla
          // donde apoyar el pie.
          if (bounds && (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height)) return false;
          const key = groundKey({ x, y });
          // Salió del obstáculo: de este lado el tendido llega a tierra.
          if (!obstacle.has(key)) break;
          // Sigue sobre el obstáculo y la obra ya no lo cubre: el paso se corta.
          if (!walkable.has(key)) return false;
        }
      }
    }
    return true;
  }

  /**
   * Lo que le falta levantar de una obra: las celdas que todavía no tienen su
   * bloque. Volver a pedir lo ya puesto era lo que trababa la obra — con dos
   * muros colocados y cuatro en la mano, exigía cinco en la mano y no entraban.
   */
  private pendingPlacements(
    blueprint: Blueprint,
    anchor: Vec2,
    perception: Perception,
  ): BlueprintPlacement[] {
    return blueprint.placements.filter((placement) => {
      const x = anchor.x + placement.offset.x;
      const y = anchor.y + placement.offset.y;
      return !perception.visibleEntities.some(
        (e) =>
          e.kind === placement.kind &&
          e.held !== true &&
          e.position?.x === x &&
          e.position?.y === y,
      );
    });
  }

  /**
   * Dónde plantar una obra: un ancla desde la que TODAS las celdas del plano
   * caen en suelo libre (ADR 0049).
   *
   * Antes el ancla era «donde esté parada cuando arranque», así que la obra se
   * replantaba sola en cada reanudación —dejando bloques sueltos de intentos
   * anteriores por el mapa— y podía pedirle al mundo celdas ya ocupadas, que el
   * motor rechazaba una por una sin que ella entendiera por qué.
   *
   * Elegido una vez, el sitio se guarda: la obra vuelve siempre al mismo lugar.
   * Se prefiere lo más cerca posible, para no caminar de más con las manos
   * llenas.
   */
  private chooseStructureSite(
    blueprint: Blueprint,
    perception: Perception,
    onto?: string,
  ): Vec2 | null {
    return this.bestStructureSite(blueprint, perception, onto)?.anchor ?? null;
  }

  /**
   * El mejor sitio Y si además SIRVE. Son dos preguntas distintas y hasta ahora
   * viajaban pegadas: al elegir alcanza con el mejor, pero para juzgar un plano
   * hace falta saber si existe algún sitio donde la obra haga lo que promete.
   * Un puente que no cruza desde ninguna parte es un plano imposible, y eso se
   * puede saber ANTES de juntar la materia.
   */
  private bestStructureSite(
    blueprint: Blueprint,
    perception: Perception,
    onto?: string,
  ): { anchor: Vec2; serves: boolean } | null {
    const bounds = perception.bounds;
    const self = perception.self.position;
    let best: { anchor: Vec2; serves: boolean; distance: number } | null = null;
    for (let dy = -STRUCTURE_SITE_SEARCH; dy <= STRUCTURE_SITE_SEARCH; dy++) {
      for (let dx = -STRUCTURE_SITE_SEARCH; dx <= STRUCTURE_SITE_SEARCH; dx++) {
        const anchor = { x: self.x + dx, y: self.y + dy };
        if (
          bounds &&
          (anchor.x < 0 || anchor.y < 0 || anchor.x >= bounds.width || anchor.y >= bounds.height)
        ) {
          continue;
        }
        if (!this.siteFits(blueprint, anchor, perception)) continue;
        // Libre no alcanza: tiene que poder LLEGAR (ADR 0071). El claro más
        // cercano puede estar del otro lado de un muro, y el caminante greedy
        // no lo rodea — elegirlo era condenar la obra antes de empezarla.
        if (this.clearWalkTo(perception, anchor, 0) === null) continue;
        // Que la obra SIRVA pesa más que estar cerca. Sin esto, "lo más cerca
        // posible" gana siempre y una pasarela para cruzar un río se levanta en
        // tierra firme: cumple el plano al pie de la letra y no sirve para nada.
        //
        // Si el encargo dijo sobre qué va, eso manda. Si no lo dijo, la obra lo
        // dice sola: ver `siteUsesFooting`.
        const serves =
          onto !== undefined
            ? this.siteServes(blueprint, anchor, onto, perception)
            : this.siteUsesFooting(blueprint, anchor, perception);
        const distance = Math.abs(dx) + Math.abs(dy);
        const better = !best || (serves !== best.serves ? serves : distance < best.distance);
        if (better) best = { anchor, serves, distance };
      }
    }
    return best ? { anchor: best.anchor, serves: best.serves } : null;
  }

  /**
   * ¿Entra la obra acá? Todas sus celdas dentro del mapa y sobre suelo que no
   * estorbe. Lo mira con lo que VE: la vista exige línea despejada (ADR 0025),
   * así que esto es "hasta donde sé", no una verdad del mundo — por eso el
   * sitio se revalida al llegar.
   */
  private siteFits(blueprint: Blueprint, anchor: Vec2, perception: Perception): boolean {
    const bounds = perception.bounds;
    const ground = perceivedGround(perception.visibleEntities);
    // Estorba lo sólido y lo que está puesto. Lo suelto y recogible no: se
    // levanta del piso y la celda queda libre. El agua NO entra acá: no es un
    // estorbo sino terreno, y se juzga abajo contra la pieza que va encima.
    const blocked = new Set<string>();
    for (const entity of perception.visibleEntities) {
      if (entity.position === undefined || entity.held === true) continue;
      if (entity.wet === true || entity.footing === true) continue;
      if (entity.solid === true || entity.portable !== true) {
        blocked.add(`${entity.position.x},${entity.position.y}`);
      }
    }
    return blueprint.placements.every((placement) => {
      const x = anchor.x + placement.offset.x;
      const y = anchor.y + placement.offset.y;
      if (bounds && (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height)) return false;
      // La celda que ya tiene SU bloque cuenta como resuelta: así una obra a
      // medias se retoma en su sitio en vez de mudarse.
      const already = perception.visibleEntities.some(
        (e) =>
          e.kind === placement.kind &&
          e.held !== true &&
          e.position?.x === x &&
          e.position?.y === y,
      );
      if (already) return true;
      const key = `${x},${y}`;
      if (blocked.has(key)) return false;
      // El agua no veta a una pieza HECHA para el agua. El motor ya la deja
      // apoyar —`resolvePlace` no cuenta el agua como ocupante, es el suelo
      // mojado de abajo— y una vez puesta su `footing` vuelve caminable la
      // celda. Vetarla acá era la única razón por la que un puente no podía
      // plantarse sobre un río: la mascota inventaba las piezas, las fabricaba
      // y terminaba armando el puente en el pasto, a cinco celdas del agua.
      //
      // La que no trae piso sigue vetada, y eso importa tanto como lo otro: un
      // plano que manda una baranda al agua no abre ningún paso.
      if (ground.water.has(key)) return this.bringsFooting(placement.kind, perception);
      return true;
    });
  }

  /**
   * ¿Lo que sale de esta receta se puede pisar? Se pregunta al plano ANTES de
   * construir, que es cuando todavía se puede elegir otro sitio. Sin receta
   * conocida la respuesta es no: apoyar sobre el agua algo de lo que no se
   * sabe nada es tirar la pieza al río.
   */
  private bringsFooting(kind: string, perception: Perception): boolean {
    const recipe = recipeProducing(perception.recipes, kind);
    if (!recipe) return false;
    return recipeProduct(recipe)?.components.footing !== undefined;
  }

  /**
   * De qué romper lo que ninguna receta hace. Un tronco no sale de una receta:
   * sale de talar un árbol, y hasta ahora eso no era una conducta que el
   * planificador supiera componer — abortaba «no hay troncos» rodeada de
   * árboles y el cuidador tenía que decírselo.
   *
   * Prefiere lo más blando de lo que ve: si un arbusto y un árbol dejan lo
   * mismo, romper el arbusto cuesta menos golpes, y los golpes son ticks que el
   * hambre o el frío están corriendo en contra. Solo mira lo que TIENE a la
   * vista: prometer una cosecha de algo que no ve sería un plan sobre un
   * recuerdo, y para eso ya está el GPS.
   */
  /**
   * Qué la está ENCERRANDO (ADR 0066): un sólido que ve, que se puede romper, y
   * que tiene detrás una celda del mapa donde nunca estuvo.
   *
   * Es la diferencia entre «no hay» y «hay pero no llego», que desde adentro de
   * su cabeza se parecen. Buscó y no encontró; si además hay una pared tapando
   * mundo sin pisar, lo que falta no es materia: es camino. La partida que lo
   * motivó tenía una columna de muro sin abertura partiendo el mapa en dos, con
   * toda la madera del otro lado.
   *
   * No toca lo que ella misma levanta —los bloques de sus obras— ni lo que no
   * tiene con qué romper: para eso está el veredicto del propio golpe.
   */
  private frontierBlocker(perception: Perception): string | undefined {
    const mine = new Set(perception.blueprints.flatMap((b) => b.placements.map((p) => p.kind)));
    const visited = this.spatial.visits;
    const bounds = perception.bounds;
    if (!bounds) return undefined;
    const hidesUnwalkedGround = (at: Vec2): boolean =>
      [
        { x: at.x + 1, y: at.y },
        { x: at.x - 1, y: at.y },
        { x: at.x, y: at.y + 1 },
        { x: at.x, y: at.y - 1 },
      ].some(
        (cell) =>
          cell.x >= 0 &&
          cell.y >= 0 &&
          cell.x < bounds.width &&
          cell.y < bounds.height &&
          !visited.has(`${cell.x},${cell.y}`),
      );
    const candidates = perception.visibleEntities.filter(
      (entity) =>
        entity.solid === true &&
        entity.held !== true &&
        entity.hardness !== undefined &&
        !mine.has(entity.kind) &&
        entity.position !== undefined &&
        hidesUnwalkedGround(entity.position),
    );
    return candidates.sort(
      (a, b) => (a.hardness ?? 0) - (b.hardness ?? 0) || (a.distance ?? 0) - (b.distance ?? 0),
    )[0]?.kind;
  }

  private harvestSourceFor(kind: string, perception: Perception): string | undefined {
    const sources = perception.visibleEntities.filter(
      (entity) =>
        entity.held !== true &&
        entity.kind !== kind &&
        (entity.dropKinds ?? []).includes(kind) &&
        // Y NUNCA algo hecho de lo que busca (ADR 0058). Romper una pared para
        // sacarle el tronco del que está hecha es deshacer trabajo propio: se
        // recupera lo que costó, se pierde la pared, y el saldo es negativo
        // siempre. Peor todavía porque es lo más BLANDO que ve —una pared
        // cuesta menos golpes que un árbol—, así que ganaba el orden y se
        // elegía primero: se la vio demoliendo su escuela para juntar los
        // troncos con los que levantar su escuela, en un círculo perfecto.
        !isMadeFrom(entity.kind, kind, perception.recipes),
    );
    if (sources.length === 0) return undefined;
    return sources.sort(
      (a, b) => (a.hardness ?? 0) - (b.hardness ?? 0) || (a.distance ?? 0) - (b.distance ?? 0),
    )[0]?.kind;
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

  /**
   * true mientras una práctica de habilidad sigue corriendo en segundo plano.
   * La sesión lo mira para aplicarle el mismo presupuesto biológico que a un
   * pensamiento en vuelo (ADR 0040): pasado el presupuesto, el tiempo se
   * sostiene hasta el veredicto — pensar cuesta ticks, no la vida.
   */
  get skillDevInFlight(): boolean {
    return this.skillDevRun !== null && this.skillDevRun.settled === null;
  }

  private now(): string {
    return this.config.now ? this.config.now() : new Date().toISOString();
  }

  private emit(type: AgentEvent['type'], data: Record<string, unknown>): void {
    this.events.emit({ type, tick: this.tick, data });
  }

  receiveUserMessage(text: string): void {
    this.pendingUserMessages.push(text);
    // El cuidador habló: lo que venga ya no es repetirse sola, es contestar
    // (ADR 0073). Aunque diga exactamente lo mismo que la última vez.
    this.lastReplyText = null;
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
      references: this.references,
      // La intención de dibujar también se guarda (ADR 0064). Era la única
      // cola que vivía solo en memoria: recargar la página la borraba, y los
      // tipos inventados antes de la recarga se quedaban sin cara para
      // siempre — nadie volvía a proponerlos nunca.
      pendingGlyphs: [...this.pendingGlyphs],
      pendingWorkGlyphs: [...this.pendingWorkGlyphs],
      pathOpenings: [...this.pathOpenings.entries()].map(([goalId, count]) => ({ goalId, count })),
      suspensionMaterials: [...this.suspensionMaterials.entries()].map(([goalId, kinds]) => ({
        goalId,
        kinds: [...kinds],
        sinceTick: this.suspensionTick.get(goalId) ?? this.tick,
      })),
      structureSites: [...this.structureSites.entries()].map(([blueprintId, anchor]) => ({
        blueprintId,
        anchor: { ...anchor },
      })),
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
    this.references = clone.references ?? {
      lastMentioned: [],
      lastUsed: [],
      createdByMe: [],
    };
    this.pendingGlyphs = clone.pendingGlyphs ?? [];
    this.pendingWorkGlyphs = clone.pendingWorkGlyphs ?? [];
    this.pathOpenings = new Map(
      (clone.pathOpenings ?? []).map((entry) => [entry.goalId, entry.count]),
    );
    this.suspensionMaterials = new Map(
      (clone.suspensionMaterials ?? []).map((entry) => [entry.goalId, entry.kinds]),
    );
    this.suspensionTick = new Map(
      (clone.suspensionMaterials ?? []).map((entry) => [entry.goalId, entry.sinceTick]),
    );
    // Guardados anteriores al sitio fijo no lo traen: la obra elegirá uno la
    // próxima vez que la retome, como hacía siempre.
    //
    // Un guardado viejo puede traer DOS anclas del mismo plano, una por
    // objetivo: es justo el reparto que este índice vino a terminar. Gana la
    // primera y la otra se olvida — la obra vuelve a ser una.
    this.structureSites = new Map();
    for (const site of clone.structureSites ?? []) {
      if (this.structureSites.has(site.blueprintId)) continue;
      this.structureSites.set(site.blueprintId, site.anchor);
    }
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
    // La práctica en vuelo tampoco: su objetivo sigue activo y el ciclo se
    // reabre solo; un veredicto de otra vida no puede tocar esta.
    this.skillDevRun = null;
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
  /**
   * Adopta artefactos de habilidad que vienen de OTRO mundo — de una
   * antecesora (ADR 0047) o del catálogo del cuidador (ADR 0076). El origen
   * cambia el relato, nunca el trato: toda conducta que llega de afuera entra
   * como `experimental` y tiene que volver a rendir acá.
   *
   * Y el criterio decide cómo rinde (ADR 0030). El de un MOTIVO —hambre,
   * frío— es una constante del motor: este mundo lo re-derivaría igual y no
   * admite trampa, así que se re-evalúa solo y se promueve solo. El de un
   * PEDIDO, o el AUSENTE de un artefacto viejo, nació de palabras que nadie de
   * acá miró: promoverlo re-certificaría contra una vara sin confirmar, y el
   * error se lavaría mundo tras mundo. Ese espera a que el cuidador confirme.
   */
  private adoptSkillArtifacts(
    artifacts: readonly SkillDefinition[],
    motivation: string,
    rationale: string,
  ): {
    adoptedSkills: {
      name: string;
      version: number;
      promoted: boolean;
      needsConfirmation?: boolean;
    }[];
    awaitingConfirmation: number;
  } {
    const adoptedSkills: {
      name: string;
      version: number;
      promoted: boolean;
      needsConfirmation?: boolean;
    }[] = [];
    let awaitingConfirmation = 0;
    for (const artifact of artifacts) {
      const candidate = this.config.library.addExperimental({
        name: artifact.name,
        description: artifact.description,
        motivation,
        program: structuredClone(artifact.program),
        expectedOutcome: artifact.expectedOutcome,
        successCriteria: structuredClone(artifact.successCriteria),
        ...(artifact.criterionSource !== undefined
          ? { criterionSource: artifact.criterionSource }
          : {}),
        createdAt: this.now(),
      });
      this.emit('skill.created', {
        skillId: candidate.id,
        name: candidate.name,
        version: candidate.version,
        rationale,
      });

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
            ...(this.config.onEvaluationCase ? { onCase: this.config.onEvaluationCase } : {}),
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
    return { adoptedSkills, awaitingConfirmation };
  }

  /**
   * Adopta lo que el cuidador guardó en su catálogo (ADR 0076). A diferencia
   * del legado, no viene con testimonio: no hay antecesora que dejó un
   * mensaje, ni causa de muerte, ni hipótesis "según ella…". Es solo la
   * conducta, que igual tiene que volver a demostrarse acá.
   */
  adoptCatalogSkills(artifacts: readonly SkillDefinition[]): {
    adoptedSkills: {
      name: string;
      version: number;
      promoted: boolean;
      needsConfirmation?: boolean;
    }[];
  } {
    const { adoptedSkills } = this.adoptSkillArtifacts(
      artifacts,
      'guardada en el catálogo del cuidador; debe demostrar que funciona en este mundo',
      'artefacto del catálogo',
    );
    return { adoptedSkills };
  }

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

    // Cómo murió su antecesora y qué dejó sin terminar (ADR 0047). Va como
    // episodio de FRACASO a propósito: es el tipo que `experienceContext`
    // levanta al escribir el contrato de una habilidad, así que la lección
    // llega justo donde se decide cómo intentarlo — no es solo color.
    if (testimony.cause) {
      const pending =
        testimony.unfinishedGoals && testimony.unfinishedGoals.length > 0
          ? `, con ${testimony.unfinishedGoals.join(' y ')} sin terminar`
          : '';
      this.memory.recordEpisode({
        kind: 'failure',
        summary: `mi antecesora ${testimony.fromName} murió de ${testimony.cause}${pending}`,
        tick: this.tick,
        importance: 0.95,
      });
    }
    // Lo que le recomendó a quien viniera después. Es testimonio, no verdad
    // propia: entra con el mismo techo de confianza que el resto de lo heredado
    // y ella tendrá que comprobarlo en su mundo.
    for (const advice of testimony.recommendations ?? []) {
      const hypothesis = this.memory.addHypothesis(
        `según ${testimony.fromName}, ${advice}`,
        this.tick,
        0.65,
        {
          source: { kind: 'legacy', description: `testimonio de ${testimony.fromName}` },
          evidence: advice,
        },
      );
      this.emit('hypothesis.updated', {
        hypothesisId: hypothesis.id,
        statement: hypothesis.statement,
        confidence: hypothesis.confidence,
        source: 'legacy-testimony',
      });
    }

    for (const entry of testimony.knowledge) {
      const hypothesis = this.memory.addHypothesis(
        `según ${testimony.fromName}, ${entry.statement}`,
        this.tick,
        Math.min(0.65, entry.confidence),
        {
          source: { kind: 'legacy', description: `testimonio de ${testimony.fromName}` },
          evidence: entry.statement,
        },
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

    const { adoptedSkills, awaitingConfirmation } = this.adoptSkillArtifacts(
      testimony.skills,
      `heredada de ${testimony.fromName} (generación ${testimony.generation}); debe demostrar que funciona en mi propio mundo`,
      `artefacto heredado de ${testimony.fromName}`,
    );

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
  /**
   * Lo próximo que valga la pena dibujar, o null si no queda nada.
   *
   * La cola se llena cuando el mundo acepta algo nuevo — una receta, una
   * descomposición — porque ahí es donde nacen los tipos que nadie dibujó. Se
   * saltea lo que ya está dibujado por si el tipo entró por dos caminos: la
   * cola es una intención, no una verdad, y la percepción manda sobre ella.
   */
  /**
   * Dibujar lo que TIENE A LA VISTA y todavía no tiene cara (ADR 0063).
   *
   * Es la misma puerta que `drawSomethingNew`, adelantada. Aquella espera un
   * tick ocioso, y con eso alcanza para los tipos que aparecen mientras no
   * pasa nada; pero los que nacen en medio de una obra —los muros de la
   * escuela— no ven un tick ocioso en cientos de turnos. Justo lo que el
   * cuidador está mirando levantarse era lo último en dejar de ser un bloque
   * genérico.
   *
   * Dos condiciones para no romper la razón por la que dibujar iba último:
   * que el tipo esté DELANTE de ella (si no se ve, puede esperar) y que el
   * cuerpo no esté en rojo (el hambre y el frío siguen mandando).
   */
  /**
   * Vuelve a poner en la cola tipos que quedaron sin dibujo (ADR 0064).
   *
   * La cola se llenaba solo en el instante en que el mundo aceptaba algo nuevo.
   * Ese instante no vuelve: si se perdió —porque la cola no se guardaba, o
   * porque el tipo lo inventó una antecesora y se heredó con el mundo— nadie
   * volvía a proponer ese dibujo nunca. Quien sabe cuáles son «los inventados»
   * es la app (el motor no distingue una receta de fábrica de una inventada),
   * así que se lo pasa desde afuera.
   */
  requestGlyphsFor(kinds: readonly string[]): void {
    for (const kind of kinds) {
      if (!this.pendingGlyphs.includes(kind)) this.pendingGlyphs.push(kind);
    }
  }

  /**
   * Convierte la foto perceptiva en conocimiento con alcance y caducidad. La
   * posicion de otro cuerpo dura mas que un frame, pero no para siempre; una
   * nueva observacion del mismo topic conserva la revision anterior.
   */
  private recordPerceptionKnowledge(perception: Perception): void {
    const source = { kind: 'perception' as const, description: 'percepcion directa' };
    this.memory.recordKnowledge({
      topic: 'position',
      content: `${this.petName} esta en (${perception.self.position.x},${perception.self.position.y})`,
      status: 'observed',
      source,
      confidence: 1,
      acquiredAtTick: perception.tick,
      expiresAtTick: perception.tick + 1,
      scope: { kind: 'entity', entityId: this.petId },
    });
    for (const entity of perception.visibleEntities) {
      if (entity.position) {
        this.memory.recordKnowledge({
          topic: 'position',
          content: `${entity.kind} ${entity.id} esta en (${entity.position.x},${entity.position.y})`,
          status: 'observed',
          source,
          confidence: 1,
          acquiredAtTick: perception.tick,
          expiresAtTick: perception.tick + 100,
          scope: { kind: 'entity', entityId: entity.id },
        });
      }
      if (entity.portable !== undefined) {
        this.memory.recordKnowledge({
          topic: 'portable',
          content: `${entity.kind} ${entity.portable ? 'se puede' : 'no se puede'} llevar`,
          status: 'observed',
          source,
          confidence: 1,
          acquiredAtTick: perception.tick,
          scope: { kind: 'type', typeId: entity.kind },
        });
      }
    }
  }

  /** Frontera de diagnostico comun para UI, dialogo y planificacion. */
  diagnoseKnowledge(content: string, atTick = this.tick): KnowledgeAssessment {
    return this.memory.assessKnowledge({ content, atTick });
  }

  private async drawWhatIsInSight(perception: Perception): Promise<ActionIntent | null> {
    if (this.pendingGlyphs.length === 0 || this.bodyInTheRed(perception)) return null;
    const atHand = (kind: string): boolean =>
      perception.visibleEntities.some((e) => e.kind === kind) ||
      perception.self.heldItems.some((e) => e.kind === kind);
    for (let i = 0; i < this.pendingGlyphs.length; i++) {
      const kind = this.pendingGlyphs[i]!;
      // Ya dibujado por otra vía: sale de la cola sin gastar consulta.
      if (perception.drawnKinds.includes(kind)) {
        this.pendingGlyphs.splice(i, 1);
        i -= 1;
        continue;
      }
      if (!atHand(kind)) continue;
      this.pendingGlyphs.splice(i, 1);
      const intent = await this.invention.inventGlyph(kind, perception);
      if (intent) return intent;
      return null;
    }
    return null;
  }

  /**
   * Dibujar la obra que aprendió, celda por celda y en un solo viaje.
   *
   * Una obra no es un montón de piezas: es una forma. Seis tablones correctos
   * puestos en fila se ven como seis tablones, no como una pasarela — y el
   * dibujo suelto de cada pieza, que está bien para la que llevás en la mano,
   * no puede saber qué le toca ser dentro del conjunto. Por eso se pide el
   * plano entero de una: quien dibuja necesita ver a los vecinos.
   */
  private async drawTheWork(perception: Perception): Promise<ActionIntent | null> {
    if (this.pendingWorkGlyphs.length === 0 || this.bodyInTheRed(perception)) return null;
    while (this.pendingWorkGlyphs.length > 0) {
      const blueprintId = this.pendingWorkGlyphs.shift();
      if (blueprintId === undefined) break;
      const blueprint = perception.blueprints.find((b) => b.id === blueprintId);
      // El plano no está (lo podaron, o es de un guardado que ya no lo trae):
      // no hay nada que ilustrar y la cola sigue.
      if (!blueprint) continue;
      if (perception.illustratedWorks.includes(blueprintId)) continue;
      const intent = await this.invention.inventWorkGlyphs(blueprint, perception);
      if (intent) return intent;
    }
    return null;
  }

  private async drawSomethingNew(perception: Perception): Promise<ActionIntent | null> {
    while (this.pendingGlyphs.length > 0) {
      const kind = this.pendingGlyphs.shift();
      if (kind === undefined) break;
      if (perception.drawnKinds.includes(kind)) continue;
      const intent = await this.invention.inventGlyph(kind, perception);
      if (intent) return intent;
    }
    return null;
  }

  async think(perception: Perception): Promise<ActionIntent | null> {
    this.tick = perception.tick;
    // Cada percepción alimenta la memoria de lugares: dónde vio por última
    // vez lo que le importa. Es lo único que puede apuntar fuera de su vista.
    this.places.update(perception);
    this.recordPerceptionKnowledge(perception);
    if (this.activity) {
      const running = this.goals.get(this.activity.goalId);
      if (running?.source === 'user-request') this.goals.increment(running.id, 'ticks');
      if (running?.userRequest?.kind === 'run-skill') {
        const visit = `visited:${perception.self.position.x},${perception.self.position.y}`;
        if (!running.observedFacts?.includes(visit)) {
          this.goals.observeFact(running.id, visit);
          this.goals.increment(running.id, 'visited-cells');
        }
      }
    }

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
    // Un encargo que esperaba materia vuelve solo apenas esa materia existe
    // (ADR 0046). Va después de las señales del cuerpo y antes de elegir
    // objetivo: hambre y frío siguen mandando sobre lo que le pidieron.
    this.reviveSuppliedRequests(perception);
    // Los pasos cumplidos se marcan con la misma foto del mundo (ADR 0053):
    // después de revivir, para que un encargo recién despertado ya muestre
    // tachado lo que consiguió mientras esperaba.
    this.settleRequestSteps(perception);
    // El cierre pertenece al estado del mundo, no al ciclo de la DSL. Esto
    // también acredita cambios hechos por otro actor mientras la meta esperaba.
    // Los mantenimientos se evalúan, pero nunca se cierran por estar ciertos.
    this.settleDeclarativeGoals(perception);

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

    // El veredicto de una práctica en segundo plano (ADR 0043) se consume
    // apenas llega: retoma el objetivo que la abrió con percepción fresca.
    const devIntent = await this.consumeSkillDevVerdict(perception);
    if (devIntent) return devIntent;

    // Una urgencia del cuerpo puede sacarle el turno a lo que está haciendo
    // (ADR 0048). Va acá, justo antes de continuar la actividad: si no, la
    // actividad se queda con el turno para siempre y las prioridades declaradas
    // no llegan a compararse nunca.
    this.yieldActivityToUrgentNeed(perception);
    // Ponerle cara a lo que ya está DELANTE de los ojos (ADR 0063). Un tipo
    // nuevo se dibujaba solo en los ticks ociosos, y construyendo una escuela
    // no hay ninguno: lo que el cuidador está mirando levantarse era
    // justamente lo que más tardaba en tener dibujo. Cuesta un tick, una vez
    // por tipo, contra los cientos que dura una obra — y no se cobra nunca con
    // el cuerpo en rojo.
    const sketch = await this.drawWhatIsInSight(perception);
    if (sketch) return sketch;
    // Y ponerle cara a la OBRA que acaba de imaginar, antes de levantarla. Va
    // acá por el mismo motivo que la de arriba y con la misma cautela (nunca
    // con el cuerpo en rojo): si esperara a un rato ocioso, la obra se
    // levantaría entera con las piezas sueltas y recién después se acomodaría.
    // Dibujarla primero es lo que hace que se vea armada desde el primer
    // bloque. Cuesta UNA consulta por plano, no una por pieza.
    const workSketch = await this.drawTheWork(perception);
    if (workSketch) return workSketch;
    if (this.activity) return this.continueActivity(perception);

    const goal = this.goals.selectActive();
    if (!goal) {
      // Sin nada urgente que hacer, se pone a imaginar cómo se ven las cosas
      // que todavía no dibujó (la quinta puerta). Va acá y no antes a
      // propósito: dibujar no cambia el mundo, así que solo ocupa los ticks
      // que de otro modo se irían en no hacer nada. Nunca le quita un turno al
      // hambre, al frío ni a lo que le pidió el cuidador.
      const drawing = await this.drawSomethingNew(perception);
      if (drawing) return drawing;
      return null; // Observación pasiva.
    }
    if (goal.id !== this.lastSelectedGoalId) {
      this.lastSelectedGoalId = goal.id;
      this.emit('goal.selected', { goalId: goal.id, description: goal.description });
    }
    return this.pursueGoal(goal, perception);
  }

  /**
   * Soltar lo que está haciendo cuando el cuerpo se lo exige (ADR 0048).
   *
   * `think` continuaba la actividad ANTES de re-elegir objetivo, así que quien
   * agarraba el turno se lo quedaba hasta terminar. Las prioridades estaban
   * bien puestas —el frío puntúa más que un encargo— pero no llegaban a
   * compararse nunca: se la vio juntando troncos para el cuidador con el calor
   * en 6 de 50, y morirse de frío cumpliendo un pedido.
   *
   * Solo cede ante lo CRÍTICO, no ante cualquier bajón: interrumpir una obra
   * larga cada vez que el hambre pica la dejaría sin terminar nada. Y el
   * encargo interrumpido no se pierde — queda suspendido y vuelve solo cuando
   * la urgencia pasa, con la misma maquinaria del ADR 0046.
   */
  /** Alguna necesidad del cuerpo en rojo: por debajo de esto no se negocia. */
  private bodyInTheRed(perception: Perception): boolean {
    const critical = (signal: { current: number; max: number } | undefined): boolean =>
      signal !== undefined &&
      signal.max > 0 &&
      signal.current / signal.max <= CRITICAL_NEED_FRACTION;
    return critical(perception.self.temperature) || critical(perception.self.energy);
  }

  private yieldActivityToUrgentNeed(perception: Perception): void {
    const activity = this.activity;
    // El cuerpo no se interrumpe a sí mismo: comer y abrigarse SON la urgencia.
    if (!activity || activity.purpose !== 'user-request') return;

    if (!this.bodyInTheRed(perception)) return;

    // Que la necesidad exista como objetivo activo es lo que decide: si el
    // cuerpo está en rojo pero nadie abrió el objetivo (o ya está suspendido
    // sin estrategias), interrumpir no la ayudaría en nada.
    const urgent = this.goals
      .all()
      .find(
        (goal) =>
          goal.status === 'active' &&
          goal.source === 'internal-signal' &&
          goal.id !== activity.goalId,
      );
    if (!urgent) return;

    const interrupted = this.goals.get(activity.goalId);
    this.activity = null;
    this.lastSelectedGoalId = null;
    if (interrupted && interrupted.status === 'active') {
      this.goals.suspend(
        interrupted.id,
        'lo dejé a medias por una urgencia del cuerpo',
        'el cuerpo deje de estar en rojo',
      );
      // Sin materia pendiente: lo que lo despierta es que la urgencia pase, y
      // de eso se encarga la revisión de encargos suspendidos.
      this.suspensionMaterials.delete(interrupted.id);
      this.emit('goal.suspended', {
        goalId: interrupted.id,
        reason: 'urgencia del cuerpo',
      });
      this.reply(`Dejo esto un momento: ${urgent.description} y no puedo seguir así.`);
    }
  }

  /**
   * Lo único que el cuerpo hace solo mientras la mente está afuera (ADR
   * 0043): el reflejo de apartarse de lo que la daña. La sesión lo llama en
   * los ticks pasivos de un pensamiento en vuelo, con percepción fresca. Es
   * seguro por construcción: no toca objetivos, actividad ni colas — solo lee
   * el dolor del último tick y devuelve (a lo sumo) un paso.
   *
   * La actividad en curso NO continúa desde acá, a propósito: el think en
   * vuelo la retomará con su propia percepción, y pisarla desde afuera
   * duplicaría pasos del programa y fabricaría fallos falsos que terminan
   * como regresiones de uso real.
   */
  reflexIntent(perception: Perception): ActionIntent | null {
    return this.painReflex(perception);
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
    if (chebyshev(sourcePos, selfPos) >= SAFE_DISTANCE) {
      return null; // Ya está fuera de alcance: no hay de qué huir.
    }

    // Salir de este fuego para caer en otro no es escapar. El reflejo mide
    // contra todos los peligros que conoce, no solo contra el que la quemó.
    const others = this.knownHazardPositions(perception);
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
          gain: Math.min(chebyshev(sourcePos, dest), ...others.map((h) => chebyshev(h, dest))),
          blocked: perception.visibleEntities.some(
            (e) => e.solid && e.position && e.position.x === dest.x && e.position.y === dest.y,
          ),
        };
      })
      .filter((option) => !option.blocked && option.gain >= SAFE_DISTANCE)
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
    const activityGoal = this.activity ? this.goals.get(this.activity.goalId) : undefined;
    const request = activityGoal?.userRequest;
    if (activityGoal && request) {
      for (const event of events) {
        if (
          request.kind === 'run-skill' &&
          event.type === 'action.resolved' &&
          event.data.actorId === this.petId
        ) {
          this.goals.increment(activityGoal.id, 'intents');
          if (event.data.action === 'move' && event.data.success === true) {
            this.goals.increment(activityGoal.id, 'moves');
          }
        }
        if (
          event.type === 'item.pickedUp' &&
          event.data.actorId === this.petId &&
          typeof event.data.itemId === 'string' &&
          (request.kind === 'fetch-item' ||
            request.kind === 'consume-item' ||
            request.kind === 'place-item')
        ) {
          this.goals.bind(activityGoal.id, 'target', event.data.itemId);
        }
        if (
          event.type === 'item.placed' &&
          event.data.actorId === this.petId &&
          typeof event.data.itemId === 'string' &&
          request.kind === 'place-item'
        ) {
          this.goals.bind(activityGoal.id, 'target', event.data.itemId);
        }
        if (
          event.type === 'item.crafted' &&
          event.data.actorId === this.petId &&
          typeof event.data.itemId === 'string'
        ) {
          if (request.kind === 'craft-item') {
            this.goals.bind(activityGoal.id, 'product', event.data.itemId);
          }
          if (request.kind === 'run-skill') {
            this.goals.observeFact(activityGoal.id, `crafted:${String(event.data.itemKind)}`);
          }
        }
        if (
          event.type === 'item.consumed' &&
          event.data.actorId === this.petId &&
          typeof event.data.itemId === 'string' &&
          request.kind === 'consume-item'
        ) {
          this.goals.bind(activityGoal.id, 'target', event.data.itemId);
          this.goals.confirmAbsent(activityGoal.id, event.data.itemId);
        }
        if (
          event.type === 'item.consumed' &&
          event.data.actorId === this.petId &&
          request.kind === 'run-skill'
        ) {
          this.goals.observeFact(activityGoal.id, `consumed:${String(event.data.itemKind)}`);
        }
        if (
          event.type === 'entity.damaged' &&
          event.data.id === this.petId &&
          request.kind === 'run-skill'
        ) {
          this.goals.observeFact(activityGoal.id, 'damage-taken');
        }
        if (
          event.type === 'entity.destroyed' &&
          event.data.byId === this.petId &&
          typeof event.data.id === 'string' &&
          request.kind === 'destroy-entity'
        ) {
          this.goals.bind(activityGoal.id, 'target', event.data.id);
          this.goals.confirmAbsent(activityGoal.id, event.data.id);
        }
        if (
          event.type === 'interaction.performed' &&
          event.data.actorId === this.petId &&
          request.kind === 'interact-entity'
        ) {
          this.goals.observeFact(
            activityGoal.id,
            `interaction:${request.verb ?? ''}:${request.targetKind ?? ''}`,
          );
        }
      }
    }
    for (const event of events) {
      if (event.data.actorId === this.petId) {
        const usedId =
          typeof event.data.itemId === 'string'
            ? event.data.itemId
            : typeof event.data.targetId === 'string'
              ? event.data.targetId
              : undefined;
        if (
          usedId &&
          (event.type === 'item.pickedUp' ||
            event.type === 'item.dropped' ||
            event.type === 'item.placed' ||
            event.type === 'item.consumed' ||
            event.type === 'interaction.performed')
        ) {
          this.rememberReference('lastUsed', usedId);
        }
        if (event.type === 'item.crafted' && typeof event.data.itemId === 'string') {
          this.rememberReference('createdByMe', event.data.itemId);
          this.rememberReference('lastUsed', event.data.itemId);
        }
      }
      if (
        (event.type === 'entity.damaged' || event.type === 'entity.destroyed') &&
        event.data.byId === this.petId &&
        typeof event.data.id === 'string'
      ) {
        this.rememberReference('lastUsed', event.data.id);
      }
    }
    // Por qué el mundo dijo que no, y sobre qué. El programa de la DSL solo se
    // entera de que su intención falló ("no pude recogerlo"); el MOTIVO —que
    // eso no se puede levantar, que estaba fuera de alcance, que no le entra en
    // las manos— vive únicamente acá. Sin guardarlo, un "no" que era una
    // propiedad estable del mundo se pierde igual que un tropiezo, y ella
    // vuelve a intentar lo mismo o se calla.
    for (const event of events) {
      if (event.type !== 'action.resolved') continue;
      if (event.data.actorId !== this.petId || event.data.success !== false) continue;
      const reason = event.data.reason;
      const targetId = event.data.itemId ?? event.data.targetId;
      if (typeof reason !== 'string') continue;
      this.lastWorldRefusal = {
        reason,
        ...(typeof targetId === 'string' ? { targetId } : {}),
        tick: this.tick,
      };
    }
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
        this.memory.recordKnowledge({
          topic: 'position',
          content: `${String(event.data.itemKind ?? 'objeto')} ${event.data.itemId} sigue en su ultima posicion`,
          status: 'refuted',
          source: {
            kind: 'world',
            ref: event.type,
            description: 'el mundo retiro el objeto de ese lugar',
          },
          confidence: 1,
          acquiredAtTick: this.tick,
          scope: { kind: 'entity', entityId: event.data.itemId },
        });
      }
      if (
        event.type === 'entity.destroyed' &&
        event.data.byId === this.petId &&
        typeof event.data.id === 'string'
      ) {
        this.places.forget(event.data.id);
        this.memory.recordKnowledge({
          topic: 'position',
          content: `${String(event.data.kind ?? 'entidad')} ${event.data.id} sigue en su ultima posicion`,
          status: 'refuted',
          source: { kind: 'world', ref: event.type, description: 'la entidad fue destruida' },
          confidence: 1,
          acquiredAtTick: this.tick,
          scope: { kind: 'entity', entityId: event.data.id },
        });
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
        // En voz humana, no con los identificadores del motor: este hecho se
        // lee en el chat, en el panel de aprendizaje y en el informe de legado,
        // y «la herramienta hammer puede dañar un wall» es el motor filtrándose
        // a la ficción. La tabla de nombres vive en @anima/shared justamente
        // para que la mascota y el dibujo llamen igual a las cosas.
        const fact = this.memory.addFact(
          `${kindWithArticle(String(event.data.itemKind))} puede dañar ${kindWithArticle(String(event.data.targetKind))}`,
          this.tick,
          0.9,
          {
            status: 'observed',
            source: { kind: 'world', ref: event.type, description: 'daño confirmado por el mundo' },
            evidence: `${String(event.data.damage)} de daño observado`,
          },
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
        const statement = hazardFact(sourceKind);
        if (!this.memory.factList().some((f) => f.statement === statement)) {
          const fact = this.memory.addFact(statement, this.tick, 0.9, {
            status: 'observed',
            source: { kind: 'world', ref: event.type, description: 'daño recibido del mundo' },
            evidence: `daño causado por ${sourceKind}`,
          });
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
      // Descomposiciones (la cuarta puerta): el motivo del rechazo viaja al
      // próximo intento, como con todo lo que se inventa.
      if (event.type === 'decomposition.rejected' && event.data.actorId === this.petId) {
        this.invention.recordWorldRejection('decomposition', String(event.data.reason));
      }
      // Lo aprendido queda como recuerdo: ahora sabe en qué se deshace esa cosa,
      // y no vuelve a preguntárselo ni en otra sesión.
      if (event.type === 'decomposition.learned' && event.data.actorId === this.petId) {
        const targetKind = String(event.data.targetKind);
        const drops = Array.isArray(event.data.drops) ? (event.data.drops as string[]) : [];
        const fact = this.memory.addFact(
          `romper ${targetKind} deja ${drops.join(', ') || 'algo'}`,
          this.tick,
          0.9,
          {
            status: 'learned',
            source: {
              kind: 'world',
              ref: event.type,
              description: 'regla aceptada y aplicada por el mundo',
            },
            evidence: `el mundo registro los restos: ${drops.join(', ') || 'algo'}`,
            scope: { kind: 'type', typeId: targetKind },
          },
        );
        this.emit('memory.created', { kind: 'fact', statement: fact.statement });
        this.emit('decomposition.learned', { targetKind, drops });
        // Los fragmentos son tipos nuevos que nadie vio nunca: a la cola de
        // dibujo. Es el momento en que existen, y por eso el momento de
        // imaginarles una cara.
        this.pendingGlyphs.push(...drops);
      }
      // El motivo del rechazo de un dibujo viaja al próximo intento, igual que
      // el de una receta. Es lo que hace que corrija en vez de insistir.
      if (event.type === 'glyph.rejected' && event.data.actorId === this.petId) {
        this.invention.recordWorldRejection('glyph', String(event.data.reason));
      }
      if (event.type === 'glyph.learned' && event.data.actorId === this.petId) {
        this.emit('glyph.learned', { kind: String(event.data.kind) });
      }
      // Una obra recién imaginada todavía no tiene forma propia: a la cola, y
      // se dibuja ANTES de levantarla para que se vea armada desde el primer
      // bloque. Es el momento en que el plano existe, y por eso el momento de
      // imaginarle una cara al conjunto.
      if (event.type === 'blueprint.learned' && event.data.actorId === this.petId) {
        const blueprintId = String(event.data.blueprintId);
        if (!this.pendingWorkGlyphs.includes(blueprintId)) {
          this.pendingWorkGlyphs.push(blueprintId);
        }
      }
      if (event.type === 'workGlyphs.rejected' && event.data.actorId === this.petId) {
        this.invention.recordWorldRejection('workGlyphs', String(event.data.reason));
      }
      if (event.type === 'workGlyphs.learned' && event.data.actorId === this.petId) {
        this.emit('workGlyphs.learned', {
          blueprintId: String(event.data.blueprintId),
          cells: event.data.cells,
        });
      }
      if (event.type === 'interaction.learned' && event.data.actorId === this.petId) {
        const interactionId = String(event.data.interactionId);
        const description = String(event.data.description ?? interactionId);
        const fact = this.memory.addFact(`aprendí a ${description}`, this.tick, 0.9, {
          source: {
            kind: 'world',
            ref: event.type,
            description: 'interaccion aceptada por el mundo',
          },
          evidence: description,
        });
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
        const fact = this.memory.addFact(`puedo construir ${outputKind}`, this.tick, 0.9, {
          source: { kind: 'world', ref: event.type, description: 'receta aceptada por el mundo' },
          evidence: `receta ${String(event.data.recipeId)} aprendida`,
          scope: { kind: 'type', typeId: outputKind },
        });
        this.emit('memory.created', { kind: 'fact', statement: fact.statement });
        this.emit('recipe.learned', {
          recipeId: event.data.recipeId,
          outputKind: event.data.outputKind,
        });
        // Lo que acaba de volverse posible todavía no tiene cara: a la cola de
        // dibujo, para el próximo rato libre.
        this.pendingGlyphs.push(outputKind);
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
    // Lo primero: soltar lo que el cuerpo ya no pide. Va antes de interpretar
    // señales para que un objetivo satisfecho no llegue a competir un tick más.
    this.closeSatisfiedNeeds(perception);
    // El dolor primero: si está malherida junto a un peligro, entender el
    // hambre puede esperar un tick.
    await this.processPainSignal(perception);
    await this.processEnergySignal(perception);
    await this.processColdSignal(perception);
  }

  /**
   * Cierra los objetivos del cuerpo cuya necesidad ya no existe (ADR 0062).
   *
   * Un objetivo del cuerpo nacía con la carencia pero solo se cerraba si lo
   * resolvía ELLA: si el cuidador la alimentaba, o el sol la entibiaba, o el
   * modo creativo le llenaba el cuerpo, «recuperar energía» seguía abierto —
   * compitiendo en la fila y apareciendo en pantalla— por un hambre que ya no
   * tenía. Sentir hambre sin tener hambre no es un objetivo: es un fantasma.
   *
   * La necesidad se da por satisfecha bien por encima del umbral que la
   * enciende, para que un cuerpo en el borde no abra y cierre en bucle.
   */
  private closeSatisfiedNeeds(perception: Perception): void {
    const satisfied = (
      description: string,
      level: { current: number; max: number } | undefined,
    ) => {
      if (!level || level.max <= 0) return;
      if (level.current / level.max < RECOVERED_NEED_FRACTION) return;
      const open = this.goals.findOpen(description);
      if (!open) return;
      // Si está trabajando para eso AHORA, no se toca: el final de la
      // actividad es donde ella aprende («consumir alimento recupera
      // energía») y comparar lo que esperaba con lo que pasó. Cortarla a
      // mitad porque el cuerpo ya se llenó le robaría justo la lección que
      // fue a buscar — comer y no entender por qué se siente mejor.
      if (this.activity?.goalId === open.id) return;
      this.goals.complete(open.id);
      this.progress.resetGoal(open.id);
      this.suspensionMaterials.delete(open.id);
      this.lastSelectedGoalId = null;
      this.emit('goal.completed', { goalId: open.id, strategy: 'el cuerpo dejó de pedirlo' });
    };
    satisfied(GOAL_RESTORE_ENERGY, perception.self.energy);
    satisfied(GOAL_RESTORE_WARMTH, perception.self.temperature ?? undefined);
  }

  /** Le duele meterse ahí: lo aprendió con su cuerpo («estar encima de...»). */
  private hurtsToTouch(kind: string): boolean {
    const statements = [hazardFact(kind), legacyHazardFact(kind)];
    return this.memory.factList().some((f) => statements.includes(f.statement));
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
   * Pasos hacia una posición evitando TERMINAR encima de lo que sabe que daña.
   * La consulta de los hechos de dolor vive aquí, al generar el programa: el
   * intérprete de la DSL no se entera y sigue igual de simple. De las dos
   * variantes deterministas del camino se prefiere la que no acaba dentro de un
   * peligro; si ninguna lo evita, llegar importa más que el rasguño (y el
   * reflejo sigue existiendo).
   */
  private walkStepsAvoidingHazards(perception: Perception, to: Vec2, stopAt: number): Direction[] {
    const hazards = this.knownHazardPositions(perception);
    const risky = (cell: Vec2): boolean => hazards.some((h) => chebyshev(h, cell) < SAFE_DISTANCE);
    const variants = (['x', 'y'] as const).map((axis) =>
      stepsToward(perception.self.position, to, stopAt, axis),
    );
    return (variants.find((v) => !risky(v.end)) ?? variants[0]!).dirs;
  }

  /**
   * Los pasos hasta un sitio, o null si por ninguna de las dos variantes se
   * llega (ADR 0071).
   *
   * El caminante es greedy y ciego a obstáculos a propósito (ADR 0005): no hay
   * pathfinding y no se agrega acá. Lo que sí se puede hacer sin inventarlo es
   * PREGUNTARLE ANTES: se simula el camino contra los sólidos que ella ve, y si
   * choca, ese sitio no cuenta como sitio. Un lugar despejado del otro lado de
   * un muro estaba libre y estaba cerca, y las dos cosas eran ciertas; lo que
   * nadie preguntaba era si se podía llegar.
   *
   * Es el MISMO cálculo que después se camina, y eso importa más que su
   * calidad: validar con un criterio y caminar con otro es cómo se elige un
   * sitio que resulta inalcanzable.
   */
  private clearWalkTo(perception: Perception, to: Vec2, stopAt: number): Direction[] | null {
    const hazards = this.knownHazardPositions(perception);
    const risky = (cell: Vec2): boolean => hazards.some((h) => chebyshev(h, cell) < SAFE_DISTANCE);
    // Lo sólido frena un paso; lo suelto se pisa y lo recogible se levanta. Y
    // el agua frena IGUAL que un muro: nadie sabe nadar. Darla por transitable
    // rompía la promesa de acá arriba —"es el MISMO cálculo que después se
    // camina"—, así que elegía sitios del otro lado del río y lo descubría
    // recién al caminar, abortando con `camino-bloqueado`.
    //
    // Lo que tiene un piso encima no cuenta como agua: `perceivedGround` aplica
    // la precedencia del motor, y es lo que deja usar el paso que ella misma
    // construyó en vez de seguir viéndolo como un río.
    const ground = perceivedGround(perception.visibleEntities);
    const walkable = (dirs: Direction[]): boolean => {
      const cur = { ...perception.self.position };
      for (const dir of dirs) {
        if (dir === 'left') cur.x -= 1;
        else if (dir === 'right') cur.x += 1;
        else if (dir === 'up') cur.y -= 1;
        else cur.y += 1;
        const key = groundKey(cur);
        if (ground.blocked.has(key) || ground.water.has(key)) return false;
      }
      return true;
    };
    const variants = (['x', 'y'] as const)
      .map((axis) => stepsToward(perception.self.position, to, stopAt, axis))
      .filter((v) => walkable(v.dirs));
    if (variants.length === 0) return null;
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
      this.memory
        .factList()
        .some((f) => f.statement.includes('a salvo') || f.statement.includes('alejar')) ||
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
            {
              source: { kind: 'model', description: 'interpretacion del modelo sobre una señal' },
              evidence: 'el modelo propuso una explicacion; falta comprobarla',
            },
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
        failureCondition: {
          type: 'self-stat',
          stat: 'health',
          comparison: 'at-most',
          value: 0,
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

  /**
   * Un motivo que se agrava despierta lo que se abandonó (ADR 0046).
   *
   * Un objetivo del cuerpo se suspende cuando no queda estrategia viable, pero
   * el cuerpo no deja de necesitarlo: seguirlo tratando como cerrado es la
   * razón por la que se moría con el motivo vivo y ninguna meta activa. Vuelve
   * a estar activo por dos caminos, y los dos son información NUEVA:
   *  - el mundo trajo un alivio que no estaba cuando se rindió (una fogata que
   *    alguien encendió, un alimento que apareció);
   *  - la señal empeoró de forma apreciable desde entonces, lo que dice que
   *    esperar no era una estrategia.
   *
   * Reactivar limpia las estrategias prohibidas: lo que falló con 40% de calor
   * no está condenado a fallar con 20%, y el mundo entretanto cambió.
   */
  private reviveSuspendedNeed(
    goal: Goal,
    fraction: number,
    perception: Perception,
    options: {
      relievedBy: (entity: PerceivedEntity) => boolean;
      seenAtSuspension: Set<string>;
      fractionAtSuspension: number;
      reliefReason: string;
      onRevived: () => void;
    },
  ): boolean {
    const relief = perception.visibleEntities.find(
      (e) => options.relievedBy(e) && !options.seenAtSuspension.has(e.id),
    );
    const worsened = fraction <= options.fractionAtSuspension - WORSENED_MOTIVE_DROP;
    if (!relief && !worsened) return false;

    this.goals.reactivate(goal.id);
    this.progress.resetGoal(goal.id);
    // Que el motivo empeore es permiso para volver a DISEÑAR, no solo para
    // reintentar lo mismo: sin el crédito devuelto, revivir era repetir.
    if (!relief) this.progress.refundSkillDevAttempt(goal.id);
    options.onRevived();
    this.emit('goal.reactivated', {
      goalId: goal.id,
      reason: relief ? options.reliefReason : 'el motivo empeoró desde que se rindió',
    });
    // Que el cuerpo insista es un episodio, no telemetría: alimenta la
    // experiencia que después arma el contrato de la habilidad que le falta.
    if (!relief) {
      this.memory.recordEpisode({
        kind: 'signal',
        summary: `me rendí con "${goal.description}" y la cosa empeoró: lo intento de nuevo`,
        tick: this.tick,
        importance: 0.7,
      });
    }
    return true;
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
    const open = this.goals.findOpen(GOAL_RESTORE_WARMTH);
    if (open) {
      // Suspendido no es cerrado (ADR 0046): mientras siga teniendo frío, el
      // objetivo puede volver solo — por una fuente de calor nueva o porque el
      // frío ganó terreno. Antes solo lo despertaba que hablara el cuidador.
      if (open.status === 'suspended') {
        const marks = this.suspensionWarmth.get(open.id);
        this.reviveSuspendedNeed(open, fraction, perception, {
          relievedBy: (e) => e.warmth !== undefined || e.shelter === true,
          seenAtSuspension: marks?.sources ?? new Set<string>(),
          // Sin marca (un guardado viejo), el propio umbral de alerta hace de
          // referencia: cualquier empeoramiento real cuenta igual.
          fractionAtSuspension: marks?.fraction ?? LOW_TEMPERATURE_FRACTION,
          reliefReason: 'apareció algo que da calor',
          onRevived: () => this.suspensionWarmth.delete(open.id),
        });
      }
      return;
    }

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
            {
              source: { kind: 'model', description: 'interpretacion del modelo sobre una señal' },
              evidence: 'el modelo propuso una explicacion; falta comprobarla',
            },
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
        successCondition: {
          type: 'self-stat',
          stat: 'temperature',
          comparison: 'at-least',
          value: RECOVERED_NEED_FRACTION,
          normalized: true,
        },
        failureCondition: {
          type: 'self-stat',
          stat: 'temperature',
          comparison: 'at-most',
          value: 0,
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

  private async processEnergySignal(perception: Perception): Promise<void> {
    const energy = perception.self.energy;
    if (!energy) return;
    const fraction = energy.current / energy.max;
    if (fraction >= LOW_ENERGY_FRACTION) return;
    const open = this.goals.findOpen(GOAL_RESTORE_ENERGY);
    if (open) {
      // Cambio relevante del entorno: alimento NUEVO, distinto del que ya veía
      // (y no alcanzaba) cuando se suspendió. Desde el ADR 0046 el hambre que
      // se agrava despierta igual: rendirse no puede ser para siempre mientras
      // el cuerpo siga pidiendo.
      if (open.status === 'suspended') {
        this.reviveSuspendedNeed(open, fraction, perception, {
          relievedBy: (e) => e.edible === true,
          seenAtSuspension: this.suspensionEdibles.get(open.id) ?? new Set<string>(),
          fractionAtSuspension: this.suspensionFractions.get(open.id) ?? LOW_ENERGY_FRACTION,
          reliefReason: 'alimento nuevo visible',
          onRevived: () => {
            this.suspensionEdibles.delete(open.id);
            this.suspensionFractions.delete(open.id);
          },
        });
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
        {
          source: { kind: 'model', description: 'interpretacion del modelo sobre una señal' },
          evidence: 'el modelo propuso una explicacion; falta comprobarla',
        },
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
        successCondition: {
          type: 'self-stat',
          stat: 'energy',
          comparison: 'at-least',
          value: RECOVERED_NEED_FRACTION,
          normalized: true,
        },
        failureCondition: {
          type: 'self-stat',
          stat: 'energy',
          comparison: 'at-most',
          value: 0,
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
        this.reply(`Entendido: ${kindLabel(pending.outputKind)} queda en una idea, nada más.`);
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
      // Suspendido cuenta como pendiente: desde el ADR 0046 un encargo que se
      // quedó sin material espera en vez de morir, y buscar solo los activos
      // hacía invisible justo al que el cuidador quiere que retome — "seguí"
      // caía al modelo y nacía un objetivo duplicado.
      const pending = this.goals
        .all()
        .find(
          (goal) =>
            (goal.status === 'active' || goal.status === 'suspended') &&
            ((goal.source === 'user-request' && goal.userRequest) ||
              (goal.source === 'learning' && goal.learning)),
        );
      if (pending) {
        if (pending.status === 'suspended') {
          this.goals.reactivate(pending.id);
          this.progress.resetGoal(pending.id);
          this.suspensionMaterials.delete(pending.id);
          this.emit('goal.reactivated', { goalId: pending.id, reason: 'el cuidador pidió seguir' });
        }
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

    if (parsed.kind === 'sequence') {
      await this.acceptSequence(parsed.requests, perception);
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
        this.suspensionFractions.delete(goal.id);
        this.suspensionWarmth.delete(goal.id);
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

    const hypothesis = this.memory.addHypothesis(statement, this.tick, confidence, {
      source: {
        kind: 'caretaker',
        description: 'enseñanza del cuidador interpretada por el modelo',
      },
      evidence: text,
    });
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
  private async startLearning(summary: string, raw: string, perception: Perception): Promise<void> {
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
        successCondition: { type: 'stable-skill-exists', name: contract.name },
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
    this.reply(`¡Dale! Me pongo a aprender "${contract.name}" y lo pruebo en mundos imaginados.`);
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
      knowledge: this.dialogueKnowledge(),
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

    if (command.action === 'sequence') {
      // Cada parte se contextualiza como si la hubieran dicho sola: resolver
      // "ponelo ahí" necesita mirar lo que ve, igual que una orden suelta.
      //
      // Las partes que no son órdenes ejecutables (enseñanzas, charla) se caen:
      // un encargo es una lista de cosas que hacer, y mezclar en la misma fila
      // un objetivo con una explicación haría esperar a la segunda parte por
      // algo que nunca "se cierra".
      const notARequest = new Set([
        'unsupported',
        'not-command',
        'explanation',
        'learn-skill',
        'rename-pet',
        'describe-entity',
        'sequence',
      ]);
      const requests: UserRequest[] = [];
      for (const step of command.steps) {
        if (notARequest.has(step.action)) continue;
        const parsed = this.contextualizeUserMessage(
          this.userRequestFromInterpretation(
            step as Parameters<AnimaAgent['userRequestFromInterpretation']>[0],
            text,
          ),
          text,
          perception,
        );
        if (
          parsed.kind !== 'unknown' &&
          parsed.kind !== 'explanation' &&
          parsed.kind !== 'rename-pet'
        ) {
          requests.push(parsed);
        }
      }
      if (requests.length === 0) return null;
      if (requests.length === 1) return requests[0]!;
      return { kind: 'sequence', requests, raw: text };
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
          knowledge: this.dialogueKnowledge(),
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
    const kindOf = (entityId: string): string | undefined =>
      perception.visibleEntities.find((entity) => entity.id === entityId)?.kind ??
      perception.self.heldItems.find((entity) => entity.id === entityId)?.kind ??
      this.places.all().find((place) => place.entityId === entityId)?.kind;
    const lastMentioned = this.references.lastMentioned[0];
    const lastUsed = this.references.lastUsed[0];
    if (lastMentioned) {
      facts.push(`el último objeto mencionado fue ${kindOf(lastMentioned) ?? 'algo'}`);
    }
    if (lastUsed) facts.push(`el último objeto que manipulé fue ${kindOf(lastUsed) ?? 'algo'}`);
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
    facts.push(`estoy en la celda (${perception.self.position.x},${perception.self.position.y})`);
    const positioned = new Map<string, string[]>();
    for (const entity of perception.visibleEntities) {
      if (!entity.position || entity.held === true) continue;
      const cells = positioned.get(entity.kind) ?? [];
      if (cells.length < 12) cells.push(`(${entity.position.x},${entity.position.y})`);
      positioned.set(entity.kind, cells);
    }
    for (const [kind, cells] of [...positioned].slice(0, 10)) {
      facts.push(`posición visible de ${kind}: ${cells.join(', ')}`);
    }
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

  private dialogueKnowledge(): EpistemicContextItem[] {
    return this.memory
      .knowledgeList({
        includeRefuted: true,
        includeUnknown: true,
        includeStale: true,
        atTick: this.tick,
      })
      .slice(-16)
      .map((record) => {
        const assessment = this.memory.assessKnowledge({
          ...(record.topic !== undefined ? { topic: record.topic } : { content: record.content }),
          scope: record.scope,
          atTick: this.tick,
        });
        const scope =
          record.scope.kind === 'entity'
            ? `entidad:${record.scope.entityId}`
            : record.scope.kind === 'type'
              ? `tipo:${record.scope.typeId}`
              : 'general';
        return {
          id: record.id,
          content: record.content,
          state: assessment.verdict === 'stale' ? 'stale' : record.status,
          confidence: record.confidence,
          source: `${record.source.kind}: ${record.source.description}`,
          evidence: record.evidence.slice(-3).map((item) => item.description),
          scope,
          ...(record.missingData !== undefined ? { missingData: [...record.missingData] } : {}),
        };
      });
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
  /**
   * Una pista concreta cuando el fracaso fue de camino, no de recurso: si lo
   * que la trabó fue un obstáculo (`camino-bloqueado`) y entre ella y la comida
   * hay un sólido rompible, decírselo al diseñador evita que proponga —una
   * versión tras otra— rodear algo que no tiene rodeo. Nombra el obstáculo que
   * está EN EL MEDIO (no un árbol de una esquina) y la herramienta más fuerte a
   * mano: la idea es agarrarla, romper y recién cruzar. Sin obstáculo rompible
   * entre medio no dice nada: no todo camino cerrado se abre a los golpes.
   */
  private obstacleContext(forbidden: StrategyRecord[], perception: Perception): string[] {
    const pathBlocked = forbidden.some((s) => s.lastReason?.includes('bloqueado') ?? false);
    if (!pathBlocked) return [];
    // El obstáculo es el sólido rompible más cercano. No se ata a ver la comida:
    // lo que le cierra el paso suele ser justo lo que se la tapa (la vista exige
    // línea despejada, ADR 0025), así que exigir verla lo volvería mudo cuando
    // más hace falta. Rompible = tiene dureza; el muro de piedra la tiene, el
    // agua no. El empate lo gana el que aparece antes (los muros, no un árbol de
    // una esquina), que es determinismo, no capricho.
    const barrier = perception.visibleEntities
      .filter((e) => e.solid === true && e.hardness !== undefined)
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0];
    if (!barrier) return [];
    const strongest = [...perception.visibleEntities, ...perception.self.heldItems]
      .filter((e) => e.toolPower !== undefined)
      .sort((a, b) => (b.toolPower ?? 0) - (a.toolPower ?? 0))[0];
    if (strongest) {
      return [
        `el camino directo está cerrado por un ${barrier.kind} y no hay rodeo: para pasar hay que romperlo. Tenés a la vista un ${strongest.kind} (herramienta, poder ${strongest.toolPower}): la idea es agarrarlo, romper el ${barrier.kind} y recién entonces cruzar hasta la comida.`,
      ];
    }
    return [
      `el camino directo está cerrado por un ${barrier.kind} y no hay rodeo: para pasar hay que romperlo con una herramienta más fuerte que su dureza ${barrier.hardness}.`,
    ];
  }

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
   * Lo que ya se intentó con este nombre de habilidad y cómo falló, para que un
   * ciclo NUEVO no empiece ciego. Dentro de un ciclo el modelo recibe la
   * historia de sus versiones y se le pide un enfoque distinto; entre ciclos no
   * recibía nada, así que al reabrirse el objetivo volvía a proponer la v1 que
   * ya había fallado ocho veces. Es el mismo "no repitas" del ADR 0028, una
   * escala más arriba.
   *
   * Se resume por enfoque, no versión por versión: ocho líneas casi idénticas
   * inflaban la consulta sin decir nada nuevo (ADR 0040 — la latencia compite
   * con el hambre).
   */
  private previousAttemptsContext(skillName: string, limit = 4): string[] {
    const failures = new Map<string, number>();
    for (const version of this.config.library.versionsOf(skillName)) {
      for (const failure of version.knownFailures) {
        const key = failure.description;
        failures.set(key, (failures.get(key) ?? 0) + 1);
      }
    }
    if (failures.size === 0) return [];
    const worst = [...failures.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
    return [
      `ya intenté "${skillName}" antes y no salió; NO repitas estos enfoques:`,
      ...worst.map(([description, times]) =>
        times > 1 ? `- ${description} (falló ${times} veces)` : `- ${description}`,
      ),
    ];
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
          | 'describe-entity'
          | 'sequence';
      }
    >,
    raw: string,
  ): UserRequest {
    switch (command.action) {
      case 'fetch-item':
        return {
          kind: command.action,
          targetKind: command.targetKind,
          ...(command.targetSelector ? { targetSelector: command.targetSelector } : {}),
          ...(command.amount !== undefined && command.amount > 1 ? { amount: command.amount } : {}),
          raw,
        };
      case 'destroy-entity':
      case 'consume-item':
        return {
          kind: command.action,
          targetKind: command.targetKind,
          ...(command.targetSelector ? { targetSelector: command.targetSelector } : {}),
          raw,
        };
      case 'wait-here':
        return { kind: 'wait-here', raw };
      case 'move-direction':
        return { kind: 'move-direction', directions: [...command.directions], raw };
      case 'spatial-relation':
        return {
          kind: 'spatial-relation',
          relation: command.relation,
          targetKind: command.targetKind,
          ...(command.maintenance ? { maintenance: true } : {}),
          raw,
        };
      case 'run-skill':
        return { kind: 'run-skill', skillName: normalizeSkillName(command.skillName), raw };
      case 'craft-item':
        return { kind: 'craft-item', recipeId: command.recipeId, raw };
      case 'place-item':
        return {
          kind: 'place-item',
          targetKind: command.targetKind,
          ...(command.targetSelector ? { targetSelector: command.targetSelector } : {}),
          onKind: command.onKind,
          ...(command.placement ? { placement: command.placement } : {}),
          raw,
        };
      case 'interact-entity':
        return {
          kind: 'interact-entity',
          verb: normalizeSkillName(command.verb) || 'usar',
          targetKind: command.targetKind,
          ...(command.targetSelector ? { targetSelector: command.targetSelector } : {}),
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
              ...('targetSelector' in parsed && parsed.targetSelector
                ? { targetSelector: { ...parsed.targetSelector, kind: firstMissing.kind } }
                : {}),
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
        return {
          ...parsed,
          targetKind: previous.targetKind,
          ...('targetSelector' in parsed && parsed.targetSelector
            ? { targetSelector: { ...parsed.targetSelector, kind: previous.targetKind } }
            : {}),
        };
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

  /**
   * Un encargo dicho en varias partes: cada una es un pedido de verdad, con su
   * objetivo, y quedan en fila en el orden en que las dijeron.
   *
   * Se decide sobre TODAS, no solo la primera: si la tercera parte es algo que
   * no quiere o no puede hacer, el cuidador se entera ahora y no dentro de
   * cincuenta ticks. Y las que se aceptan quedan encadenadas — la segunda no
   * arranca hasta que la primera se cierra— porque un encargo con partes es un
   * orden, no un montón.
   *
   * La respuesta es una sola: contestar tres veces a un mensaje es hablarle
   * encima al cuidador.
   */
  private async acceptSequence(requests: UserRequest[], perception: Perception): Promise<void> {
    const answers: string[] = [];
    let previousGoalId: string | undefined;
    for (const request of requests) {
      const decision = await this.decideOnRequest(
        request,
        perception,
        previousGoalId !== undefined ? { afterGoalId: previousGoalId } : {},
      );
      this.emit(
        decision.classification === 'accepted' ? 'user.request.accepted' : 'user.request.refused',
        { request, classification: decision.classification, reason: decision.reason },
      );
      answers.push(
        decision.alternative ? `${decision.reason} ${decision.alternative}` : decision.reason,
      );
      if (decision.classification === 'accepted') {
        // Encadena con la última ACEPTADA: una parte rechazada no puede dejar
        // esperando para siempre a las que vienen detrás.
        previousGoalId = decision.goalId ?? previousGoalId;
      }
    }
    this.lastUserRequest = structuredClone(requests[0]!);
    this.reply(answers.join(' '));
  }

  async decideOnRequest(
    request: UserRequest,
    perception: Perception,
    options: { afterGoalId?: string } = {},
  ): Promise<RequestDecision & { goalId?: string }> {
    if ('targetSelector' in request && request.targetSelector) {
      const selector = { ...request.targetSelector, kind: request.targetKind };
      const resolution = resolveEntityReference(
        selector,
        perception,
        this.places.all(),
        this.references,
      );
      if (resolution.kind === 'missing' || resolution.kind === 'ambiguous') {
        return { classification: 'needs_information', reason: resolution.reason };
      }
      if (resolution.kind === 'resolved') {
        request = { ...request, targetSelector: selector, targetEntityId: resolution.entityId };
        this.rememberReference('lastMentioned', resolution.entityId);
      }
    }
    let decision = evaluateUserRequest(
      request,
      perception,
      this.memory,
      this.goals.selectActive(),
      this.learnedSkills().map((skill) => skill.name),
    );
    decision = await this.reconsiderRefusal(request, perception, decision);
    if (decision.classification === 'accepted' && request.kind !== 'unknown') {
      if (request.kind === 'spatial-relation') {
        const grounded = groundSpatialRequest(request, perception);
        if (!grounded.ok) {
          return { classification: 'needs_information', reason: grounded.reason };
        }
        request = { ...request, spatial: grounded.grounding };
      }
      // Volver a pedir lo mismo RETOMA, no duplica. El encargo abierto se
      // identifica por lo que pide (qué acción, sobre qué), nunca por el texto:
      // "construí una escuela" y "continua con la construccion de la escuela"
      // son el mismo trabajo dicho distinto, y comparar descripciones crudas
      // dejaba dos objetivos paralelos esperando el mismo material y
      // reportando cada uno su propio fracaso.
      const open = this.openRequestLike(request);
      if (open) {
        if (open.status === 'suspended') {
          this.goals.reactivate(open.id);
          this.progress.resetGoal(open.id);
          this.suspensionMaterials.delete(open.id);
          this.emit('goal.reactivated', {
            goalId: open.id,
            reason: 'el cuidador volvió a pedir lo mismo',
          });
        }
        this.emit('goal.selected', { goalId: open.id, description: open.description });
        return { ...decision, goalId: open.id };
      }
      const weights = USER_REQUEST_WEIGHTS[request.kind];
      const goalRequest: GoalUserRequest = {
        kind: request.kind,
        ...('targetKind' in request ? { targetKind: request.targetKind } : {}),
        ...('targetSelector' in request && request.targetSelector
          ? { targetSelector: request.targetSelector }
          : {}),
        ...('targetEntityId' in request && request.targetEntityId
          ? { targetEntityId: request.targetEntityId }
          : {}),
        ...('onKind' in request ? { onKind: request.onKind } : {}),
        ...('placement' in request && request.placement ? { placement: request.placement } : {}),
        ...('verb' in request ? { verb: request.verb } : {}),
        ...('amount' in request && request.amount !== undefined ? { amount: request.amount } : {}),
        ...('directions' in request ? { directions: request.directions } : {}),
        ...('skillName' in request ? { skillName: request.skillName } : {}),
        ...('recipeId' in request ? { recipeId: request.recipeId } : {}),
        ...('relation' in request ? { relation: request.relation } : {}),
        ...('spatial' in request && request.spatial ? { spatial: request.spatial } : {}),
        ...('maintenance' in request && request.maintenance
          ? { maintenance: request.maintenance }
          : {}),
        raw: request.raw,
      };
      const goal = this.goals.create(
        {
          description: `petición del usuario: ${request.raw}`,
          source: 'user-request',
          priority: weights.priority,
          urgency: weights.urgency,
          expectedValue: 0.6,
          preconditions: [],
          mode: goalRequest.maintenance ? 'maintenance' : 'achievement',
          successCondition:
            goalRequest.kind === 'run-skill' && goalRequest.skillName
              ? this.conditionForSkillRun(goalRequest.skillName, perception)
              : conditionForUserRequest(goalRequest, perception),
          ...(options.afterGoalId !== undefined ? { afterGoalId: options.afterGoalId } : {}),
          userRequest: goalRequest,
        },
        this.tick,
      );
      this.emit('goal.created', {
        goalId: goal.id,
        description: goal.description,
        source: goal.source,
        ...(goal.afterGoalId !== undefined ? { afterGoalId: goal.afterGoalId } : {}),
      });
      return { ...decision, goalId: goal.id };
    }
    return decision;
  }

  /** Convierte la vara validada de una skill a predicados del mundo real. */
  private conditionForSkillRun(skillName: string, perception: Perception): GoalCondition {
    const skill = this.config.library.findStable(skillName);
    if (!skill) {
      return { type: 'constant', value: false, reason: `habilidad-no-estable:${skillName}` };
    }
    const start = { ...perception.self.position };
    const conditions: GoalCondition[] = [{ type: 'world-fact', fact: 'skill-started' }];
    for (const criterion of skill.successCriteria) {
      switch (criterion.type) {
        case 'energyIncreased':
        case 'temperatureIncreased': {
          const stat = criterion.type === 'energyIncreased' ? 'energy' : 'temperature';
          conditions.push({
            type: 'self-stat',
            stat,
            comparison: 'at-least',
            value: (perception.self[stat]?.current ?? 0) + 0.0001,
          });
          break;
        }
        case 'craftedKind':
          conditions.push({ type: 'world-fact', fact: `crafted:${criterion.kind ?? ''}` });
          break;
        case 'consumedKind':
          conditions.push({ type: 'world-fact', fact: `consumed:${criterion.kind ?? ''}` });
          break;
        case 'reachedAdjacentKind':
          conditions.push({
            type: 'self-distance-to-entity',
            entity: { kind: criterion.kind ?? '' },
            metric: 'chebyshev',
            comparison: 'at-most',
            value: 1,
          });
          break;
        case 'holdingKind':
          conditions.push({ type: 'holding', entity: { kind: criterion.kind ?? '' } });
          break;
        case 'minMoves':
        case 'visitedDistinctCells':
          conditions.push({
            type: 'counter',
            counter: criterion.type === 'minMoves' ? 'moves' : 'visited-cells',
            comparison: 'at-least',
            value: criterion.value ?? 1,
          });
          break;
        case 'returnedToStart':
          conditions.push({ type: 'self-at', position: start });
          break;
        case 'netDisplacementAtLeast':
          conditions.push({
            type: 'self-distance-from',
            position: start,
            metric: 'manhattan',
            comparison: 'at-least',
            value: criterion.value ?? 1,
          });
          break;
        case 'noDamageTaken':
          conditions.push({
            type: 'not',
            condition: { type: 'world-fact', fact: 'damage-taken' },
          });
          break;
        case 'maxTicks':
        case 'maxIntents':
          conditions.push({
            type: 'counter',
            counter: criterion.type === 'maxTicks' ? 'ticks' : 'intents',
            comparison: 'at-most',
            value: criterion.value ?? 1,
          });
          break;
      }
    }
    return { type: 'all', conditions };
  }

  /**
   * Un encargo abierto (activo o suspendido) que pide LO MISMO que este.
   *
   * La identidad de un pedido es su acción y su objeto, no las palabras: pedir
   * "construí una escuela" y después "continua con la construcción de la
   * escuela" es insistir sobre el mismo trabajo. Los movimientos quedan fuera a
   * propósito — "andá a la izquierda" dos veces son dos pasos, no uno repetido.
   */
  private openRequestLike(request: UserRequest): Goal | undefined {
    // Solo las OBRAS. Construir algo es un trabajo único: volver a nombrarlo
    // es insistir sobre el mismo, y crear un segundo objetivo dejaba dos
    // esperando el mismo material y reportando cada uno su fracaso.
    //
    // Traer y romper son acciones CONTABLES y quedan afuera a propósito: "traé
    // un tronco" dicho dos veces son dos troncos, no una insistencia sobre uno.
    if (request.kind !== 'craft-item' || !request.recipeId) return undefined;
    return this.goals
      .all()
      .find(
        (goal) =>
          (goal.status === 'active' || goal.status === 'suspended') &&
          goal.source === 'user-request' &&
          goal.userRequest?.kind === 'craft-item' &&
          goal.userRequest.recipeId === request.recipeId,
      );
  }

  /**
   * Decir algo al cuidador, sin repetirse (ADR 0073).
   *
   * Un anuncio idéntico al último que dijo, sin que el cuidador haya abierto la
   * boca en el medio, no es información nueva: es la misma frase otra vez. Se la
   * vio abriéndose paso tres veces seguidas y anunciando las tres con la misma
   * oración palabra por palabra — la mitad de lo que había escrito en toda la
   * partida era ese anuncio repetido, y hay que leer los tres para descubrir que
   * son uno.
   *
   * La condición «sin que el cuidador haya hablado» no es un detalle: sin ella,
   * preguntarle dos veces lo mismo devolvería silencio la segunda vez, que se
   * lee como que se colgó. Repetirse contestando está bien; repetirse sola es
   * lo que cansa.
   *
   * Callar acá calla las tres cosas de una: el chat, su memoria de conversación
   * y el historial que viaja al modelo en el próximo diálogo.
   */
  private reply(text: string): void {
    if (text === this.lastReplyText) return;
    this.lastReplyText = text;
    this.pendingSpeech.push(text);
    this.memory.noteConversation('pet', text, this.tick);
  }

  // ---- persecución de objetivos --------------------------------------------

  private async pursueGoal(goal: Goal, perception: Perception): Promise<ActionIntent | null> {
    if (goal.source === 'learning' && goal.learning) {
      return this.pursueLearning(goal, goal.learning, perception);
    }
    if (goal.source === 'user-request' && goal.userRequest) {
      const condition = this.evaluateGoal(goal, perception);
      // Un mantenimiento satisfecho permanece vigente y vuelve a actuar si el
      // predicado deja de ser cierto; no se convierte en un éxito histórico.
      if (goal.mode === 'maintenance' && condition?.status === 'met') return null;
      if (this.progress.isForbidden(goal.id, 'petición-del-usuario')) {
        this.goals.suspend(
          goal.id,
          `el estado pedido sigue sin alcanzarse: ${condition?.diagnostics.join(', ') || 'sin evidencia'}`,
          'que cambie el mundo o el cuidador aporte nueva información',
        );
        this.emit('goal.suspended', { goalId: goal.id, reason: 'condición-no-alcanzada' });
        this.lastSelectedGoalId = null;
        return null;
      }
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
      // Romper algo que no cedió a su herramienta no es rendirse: antes de
      // volver a golpear, se hace (o inventa) una más fuerte. Solo si no queda
      // por dónde, se rinde. `undefined` = "no está trabada, golpeá normal".
      // Cosechar sin herramienta tampoco es rendirse: primero se consigue con
      // qué. Va antes que el resto porque mientras esto no se resuelva, el
      // encargo no puede avanzar por ningún otro lado.
      const toolless = await this.escalateHarvestIfToolless(goal, perception);
      if (toolless !== undefined) return toolless;
      if (goal.userRequest.kind === 'destroy-entity') {
        const escalated = await this.escalateDestroyIfBlocked(goal, perception);
        if (escalated !== undefined) return escalated;
        // Antes del primer golpe: imaginar en qué se deshace (la cuarta puerta).
        // La materia no desaparece — si nadie definió todavía qué deja este
        // tipo, se piensa AHORA y no después, cuando ya no haya nada que dejar.
        // Reuso primero: lo que el mundo ya sabe no cuesta ni una consulta.
        const targetKind = goal.userRequest.targetKind;
        if (targetKind !== undefined) {
          const decomposition = await this.invention.inventDecomposition(targetKind, perception, {
            goalId: goal.id,
          });
          if (decomposition) return decomposition;
        }
      }
      if (
        goal.mode === 'maintenance' &&
        goal.userRequest.kind === 'spatial-relation' &&
        goal.userRequest.maintenance
      ) {
        const refreshed = groundSpatialRequest(
          {
            relation: goal.userRequest.relation ?? 'far-from',
            targetKind: goal.userRequest.targetKind ?? 'unknown',
          },
          perception,
        );
        if (refreshed.ok) {
          const originalMinimum = goal.userRequest.spatial?.minimumDistance;
          goal.userRequest.spatial = {
            ...refreshed.grounding,
            ...(originalMinimum !== undefined ? { minimumDistance: originalMinimum } : {}),
          };
        }
      }
      const program = programForUserRequest(
        goal.userRequest,
        perception,
        this.userProgramDeps(perception),
      );
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

    // Jerarquía: primero la habilidad utilizable —estable, o la mejor
    // provisional si todavía no hay estable (ADR 0050)—, luego la aproximación
    // primitiva. Solo crear una skill si hay evidencia de que falta una
    // capacidad (todas las estrategias conocidas prohibidas).
    const usable = this.config.library.findUsable(SKILL_REACH_BLOCKED_FOOD);
    const strategies: {
      label: string;
      program: SkillProgram;
      skillId?: string;
      rememberedPlaceId?: string;
    }[] = [];
    if (usable) {
      strategies.push({
        label: `${usable.status === 'stable' ? 'stable' : 'provisional'}-skill:${usable.name}@v${usable.version}`,
        program: usable.program,
        skillId: usable.id,
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
    // Ya pidió ayuda y nadie vino: antes de rendirse, SALIR A BUSCAR (ADR
    // 0054). Va acá y no antes a propósito — pedir ayuda temprano es
    // información que el cuidador necesita pronto, y caminar cuesta energía.
    // Lo que se reemplaza no es el aviso, es el callejón sin salida que venía
    // después: quedarse parada esperando a que la comida viniera sola.
    if (this.progress.helpRequestedFor(goal.id)) {
      strategies.push({ label: 'buscar-comida', program: SEEK_FOOD_PROGRAM });
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
        this.invention.attemptsLeft(inventionCreditKey(goal))
      ) {
        const invention = await this.inventForObstacle(goal, perception);
        if (invention) return invention;
      }
      this.progress.markHelpRequested(goal.id);
      this.emit('help.requested', { goalId: goal.id });
      return {
        type: 'speak',
        text: 'No consigo llegar al alimento y ya probé todo lo que sé. ¿Podés ayudarme?',
      };
    }
    this.goals.suspend(
      goal.id,
      'sin estrategias viables tras pedir ayuda',
      'nueva información del usuario, alimento nuevo o hambre que empeora',
    );
    this.suspensionEdibles.set(
      goal.id,
      new Set(perception.visibleEntities.filter((e) => e.edible).map((e) => e.id)),
    );
    // Contra qué se medirá "empeoró" (ADR 0046). Sin esta marca, rendirse era
    // definitivo salvo que hablara el cuidador.
    const energyAtSuspension = perception.self.energy;
    if (energyAtSuspension) {
      this.suspensionFractions.set(goal.id, energyAtSuspension.current / energyAtSuspension.max);
    }
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
    // Un plan a medio proponer sigue entrando, hoja por hoja (ADR 0031), y cada
    // hoja pasa por el juez antes de tocar el mundo (ADR 0042).
    const pending = this.vetCrossing(
      await this.invention.nextPlanStep(perception, goal.id),
      goal,
      perception,
    );
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
    return this.vetCrossing(
      await this.invention.inventRecipe(problem, perception, {
        goalId: goal.id,
        creditKey: inventionCreditKey(goal),
        reserved: this.committedKinds(perception, goal.id),
      }),
      goal,
      perception,
    );
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
  private async inventForRequest(goal: Goal, perception: Perception): Promise<ActionIntent | null> {
    const request = goal.userRequest;
    if (request?.kind !== 'craft-item' || !request.recipeId) return null;
    // Un plan a medio entrar sigue entrando: las hojas antes que el tronco, una
    // receta por tick, cada una por la puerta del mundo (ADR 0031). Va antes
    // que el "ya sabe hacerlo" porque lo que falta son las piezas de abajo, no
    // la casa: la casa es justamente la que todavía no puede entrar.
    const pending = this.vetCrossing(
      await this.invention.nextPlanStep(perception, goal.id),
      goal,
      perception,
    );
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
    return this.vetCrossing(
      await this.invention.inventRecipe(
        `mi cuidador me pidió construir ${kindWithArticle(request.recipeId)}`,
        perception,
        {
          goalId: goal.id,
          wantedId: request.recipeId,
          // La medida del problema viaja con el pedido: que no tenga que
          // adivinar el ancho de lo que le toca cruzar (ni que se lo tenga que
          // decir el cuidador en la frase del encargo).
          ...(() => {
            const obstacle = this.obstacleFor(goal.id, perception);
            return obstacle ? { obstacle } : {};
          })(),
        },
      ),
      goal,
      perception,
    );
  }

  /** El poder de la herramienta más fuerte que lleva o ve (0 si no hay ninguna). */
  private strongestToolPower(perception: Perception): number {
    return [...perception.self.heldItems, ...perception.visibleEntities].reduce(
      (max, e) => Math.max(max, e.toolPower ?? 0),
      0,
    );
  }

  /**
   * Romper algo que no cedió a su herramienta (`objetivo-muy-duro`) marca un
   * "piso" de dureza en el objetivo. Mientras ese piso exista, antes de volver a
   * golpear con lo mismo, la mascota busca una herramienta más fuerte por su
   * cuenta y sin pedir permiso: la usa si ya la tiene, la FABRICA si su mundo la
   * sabe hacer (fabricar y golpear en un mismo programa, para que el final sea
   * romper y no "hice un pico"), o la INVENTA si no existe todavía (ADR 0036),
   * gastando el mismo crédito acotado que el frío y el hambre. Solo cuando no
   * queda herramienta, ni receta, ni crédito, se rinde con la verdad.
   *
   * Devuelve la intención con la que sigue, `null` si ya cerró el objetivo este
   * tick, o `undefined` para "no está trabada: golpeá con el programa de siempre".
   */
  /**
   * Le faltó la HERRAMIENTA, no la materia.
   *
   * Con «cruzá el río» a un bloque de terminar, cuatro árboles a la vista y
   * ningún tronco suelto, abortaba con `no-candidates:tool-tronco` y se dormía
   * «esperando que aparezca un tronco». Los troncos estaban ahí, adentro de los
   * árboles: lo que faltaba era con qué sacarlos. Y mientras dormía, los
   * antojos se gastaban lo que el encargo esperaba.
   *
   * Una herramienta que falta es un PASO MÁS, no un callejón: se hace si su
   * mundo ya sabe hacerla, y si no, se inventa. Es la misma escalada que ya
   * hace `escalateDestroyIfBlocked` cuando un golpe no hace mella, aplicada a
   * cosechar en vez de a romper.
   *
   * `undefined` = «no está trabada por esto, seguí normal».
   */
  /**
   * La última puerta antes de que un plano toque el mundo: ¿sirve para lo que
   * nació? Si no, no se emite — se recuerda el motivo medido, que viaja a la
   * próxima idea igual que un rechazo del mundo (ADR 0018).
   *
   * Devuelve la intención si pasa, o null si se la comió el juez. Null no es un
   * callejón: el crédito sigue, y el siguiente intento nace sabiendo el número
   * que le faltaba.
   */
  private vetCrossing(
    intent: ActionIntent | null,
    goal: Goal,
    perception: Perception,
  ): ActionIntent | null {
    if (intent === null || intent.type !== 'proposeBlueprint') return intent;
    const raw = intent.blueprint as { id?: unknown; placements?: unknown };
    // Mal formado no es asunto de este juez: lo rechaza el mundo, que para eso
    // tiene el validador.
    if (typeof raw?.id !== 'string' || !Array.isArray(raw.placements)) return intent;
    const placements = raw.placements.filter(
      (p): p is BlueprintPlacement =>
        typeof (p as BlueprintPlacement)?.kind === 'string' &&
        typeof (p as BlueprintPlacement)?.offset?.x === 'number' &&
        typeof (p as BlueprintPlacement)?.offset?.y === 'number',
    );
    if (placements.length !== raw.placements.length) return intent;

    const reason = this.crossingRejection({ id: raw.id, placements }, goal.id, perception);
    if (reason === null) return intent;
    this.invention.recordWorldRejection('blueprint', reason, 'gate');
    return null;
  }

  private async escalateHarvestIfToolless(
    goal: Goal,
    perception: Perception,
  ): Promise<ActionIntent | null | undefined> {
    const source = this.harvestToolBlocked.get(goal.id);
    if (source === undefined) return undefined;
    // Ya lleva o ve una herramienta: consiguió una mientras tanto, o la traba
    // era otra. Se olvida la marca y el encargo sigue por donde iba.
    if (this.strongestToolPower(perception) > 0) {
      this.harvestToolBlocked.delete(goal.id);
      return undefined;
    }

    const deps = this.userProgramDeps(perception);
    // ¿Su mundo ya sabe hacer una herramienta? Hacerla y volver al encargo en
    // el mismo programa, igual que al escalar un golpe.
    const toolRecipe = perception.recipes.find((r) => recipeProduces(r, 'tool'));
    if (toolRecipe && goal.userRequest) {
      this.harvestToolBlocked.delete(goal.id);
      this.reply(
        `No puedo sacar ${kindWithArticle(source)} con las manos. ` +
          `Primero me hago ${kindWithArticle(recipeProduct(toolRecipe)?.kind ?? 'una herramienta')}.`,
      );
      const craft = gatherAndCraftProgram(toolRecipe, {
        held: heldCounts(perception),
        searchFirst: true,
        recipes: perception.recipes,
        rememberedWalk: deps.rememberedWalk,
      });
      const resume = programForUserRequest(goal.userRequest, perception, deps);
      this.startUserActivity(
        goal,
        [...craft, ...resume],
        completionReply(goal.userRequest),
        perception,
      );
      return this.continueActivity(perception);
    }

    // No la sabe hacer: inventarla. Es el mismo crédito de siempre — inventar
    // es un intento más, nunca un callejón.
    if (this.invention.attemptsLeft(inventionCreditKey(goal))) {
      const intent = await this.invention.inventRecipe(
        `necesito una herramienta para sacar ${kindWithArticle(source)} de donde está`,
        perception,
        {
          goalId: goal.id,
          creditKey: inventionCreditKey(goal),
          // Nada que reservar contra sí mismo: la herramienta es PARA este
          // encargo, así que su propia materia no se le esconde.
          reserved: this.committedKinds(perception, goal.id),
        },
      );
      const vetted = this.vetCrossing(intent, goal, perception);
      if (vetted) return vetted;
    }

    // Sin receta y sin crédito: se acabó el camino por acá. Se suelta la marca
    // para que el encargo siga su curso normal —pedir ayuda, dormirse— en vez
    // de reintentar esto para siempre.
    this.harvestToolBlocked.delete(goal.id);
    return undefined;
  }

  private async escalateDestroyIfBlocked(
    goal: Goal,
    perception: Perception,
  ): Promise<ActionIntent | null | undefined> {
    const floor = this.destroyToolFloor.get(goal.id);
    if (floor === undefined) return undefined;
    const targetKind = goal.userRequest?.targetKind;
    // ¿Ya tiene o ve algo más fuerte que lo que no hizo mella? A golpear con eso.
    if (this.strongestToolPower(perception) > floor) return undefined;

    const deps = this.userProgramDeps(perception);
    // ¿Su mundo ya sabe hacer una herramienta más fuerte? Fabricarla y golpear
    // en un mismo programa: al terminar de craftear, el `strongestTool` del
    // programa de romper elige la recién hecha por ser la de más poder.
    const stronger = perception.recipes.find(
      (r) => (recipeProduct(r)?.components.tool?.power ?? 0) > floor,
    );
    if (stronger) {
      const craft = gatherAndCraftProgram(stronger, {
        held: heldCounts(perception),
        searchFirst: true,
        recipes: perception.recipes,
        rememberedWalk: deps.rememberedWalk,
      });
      const strike = programForUserRequest(goal.userRequest!, perception, deps);
      this.startUserActivity(
        goal,
        [...craft, ...strike],
        completionReply(goal.userRequest!),
        perception,
      );
      return this.continueActivity(perception);
    }

    // No la sabe hacer: inventarla, si queda crédito. El invento entra por la
    // puerta del mundo como cualquier otro; un rechazo viaja al próximo intento.
    if (this.invention.attemptsLeft(inventionCreditKey(goal))) {
      const intent = await this.invention.inventRecipe(
        `necesito una herramienta más fuerte para romper ${kindWithArticle(targetKind ?? 'eso')}`,
        perception,
        {
          goalId: goal.id,
          creditKey: inventionCreditKey(goal),
          reserved: this.committedKinds(perception, goal.id),
        },
      );
      const vetted = this.vetCrossing(intent, goal, perception);
      if (vetted) return vetted;
    }

    // Sin herramienta, sin receta y sin crédito: rendirse con la verdad, no con
    // un silencio.
    this.goals.fail(goal.id);
    this.destroyToolFloor.delete(goal.id);
    this.emit('strategy.failed', {
      goalId: goal.id,
      strategy: 'petición-del-usuario',
      outcome: 'aborted',
      reason: 'sin-herramienta-mas-fuerte',
    });
    this.memory.recordEpisode({
      kind: 'failure',
      summary: `no pude romper ${targetKind ?? 'eso'}: no me alcanza ninguna herramienta`,
      tick: this.tick,
      importance: 0.6,
    });
    this.reply(
      `No pude romper ${kindWithArticle(targetKind ?? 'eso')}: no logro hacerme una herramienta más fuerte.`,
    );
    this.lastSelectedGoalId = null;
    return null;
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
      // motor solo alcanza a quien está encima): salirse ES estar a salvo.
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
        text: 'Algo me está haciendo daño y no encuentro por dónde apartarme. ¿Podés ayudarme?',
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
    // La estable si la hay; si no, la mejor provisional (ADR 0050). Con el
    // cuerpo enfriándose, una habilidad que funciona 19 de cada 20 veces es
    // mejor que ninguna: descartarla por no ser perfecta fue lo que dejó a una
    // generación muriéndose con la solución en la mano.
    const usable = this.config.library.findUsable(SKILL_GET_WARM);
    const strategies: {
      label: string;
      program: SkillProgram;
      skillId?: string;
      rememberedPlaceId?: string;
    }[] = [];
    if (usable) {
      strategies.push({
        label: `${usable.status === 'stable' ? 'stable' : 'provisional'}-skill:${usable.name}@v${usable.version}`,
        program: usable.program,
        skillId: usable.id,
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
    // Ya pidió ayuda y nadie vino: últimas dos antes de rendirse, salir a
    // BUSCAR calor y, si tampoco, techo (ADR 0054). Van después del aviso —
    // que el cuidador se entere temprano sigue importando— pero antes de
    // quedarse quieta: fue quedarse quieta, con un refugio a diez celdas
    // detrás de un muro, lo que mató a la generación 3.
    if (this.progress.helpRequestedFor(goal.id)) {
      strategies.push({ label: 'buscar-calor', program: SEEK_WARMTH_PROGRAM });
      strategies.push({ label: 'buscar-refugio', program: SEEK_SHELTER_PROGRAM });
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
    if (!knowsFire && this.invention.attemptsLeft(inventionCreditKey(goal))) {
      const invention = await this.invention.inventRecipe(
        'tengo frío y no tengo nada que dé calor',
        perception,
        {
          goalId: goal.id,
          creditKey: inventionCreditKey(goal),
          reserved: this.committedKinds(perception, goal.id),
        },
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
      // Una práctica ya corre en segundo plano (esta u otra): una mente
      // alcanza. Este tick se espera; el veredicto retoma el objetivo.
      if (this.skillDevRun) return null;
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
        // Lo que ya falló en ciclos anteriores: sin esto, un objetivo que
        // revive vuelve a proponer la versión que ya perdió ocho veces.
        ...this.previousAttemptsContext(contract.name),
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
      const resume: SkillDevResume = async (outcome, fresh) => {
        this.progress.recordSkillDevAttempt(goal.id);
        if (!outcome.stableSkill) return null;
        // El objetivo pudo resolverse mientras practicaba (un fuego apareció,
        // el cuidador la abrigó): la habilidad queda en la biblioteca igual,
        // pero no se estrena contra un objetivo que ya no existe.
        const current = this.goals.all().find((g) => g.id === goal.id);
        if (current?.status !== 'active') return null;
        this.startActivity(
          goal,
          `stable-skill:${outcome.stableSkill.name}@v${outcome.stableSkill.version}`,
          outcome.stableSkill.program,
          fresh,
          { skillId: outcome.stableSkill.id },
        );
        return this.continueActivity(fresh);
      };
      const outcome = await this.runSkillDevelopment(goal, contract, context, scenarios, resume);
      if (outcome === 'in-flight') return null;
      return resume(outcome, perception);
    }

    if (step === 'ask-help') {
      this.progress.markHelpRequested(goal.id);
      this.emit('help.requested', { goalId: goal.id });
      return {
        type: 'speak',
        text: 'Tengo frío y no veo nada que dé calor. ¿Podés ayudarme?',
      };
    }

    this.goals.suspend(
      goal.id,
      'sin estrategias viables tras pedir ayuda',
      'nueva información del usuario, algo que dé calor o frío que empeora',
    );
    // Contra qué se medirá "empeoró", y qué fuentes de calor ya había descartado
    // (ADR 0046). Sin estas dos marcas el objetivo dormía hasta que hablara el
    // cuidador, y el cuerpo se enfriaba con la meta apagada.
    const temperature = perception.self.temperature;
    this.suspensionWarmth.set(goal.id, {
      sources: new Set(
        perception.visibleEntities
          .filter((e) => e.warmth !== undefined || e.shelter === true)
          .map((e) => e.id),
      ),
      fraction: temperature ? temperature.current / temperature.max : LOW_TEMPERATURE_FRACTION,
    });
    this.emit('goal.suspended', { goalId: goal.id, reason: 'sin estrategias viables' });
    this.lastSelectedGoalId = null;
    return null;
  }

  /**
   * Corre el ciclo cerrado para un contrato cualquiera. Es el mismo mecanismo
   * para la necesidad que nace de su cuerpo (recuperar energía) y para la que
   * nace de su cuidador (una conducta enseñada): lo único que cambia es quién
   * escribió el contrato y en qué mundos se practica.
   *
   * El ciclo corre en una carrera contra un timer 0 (ADR 0043, el mismo
   * patrón del ADR 0039 un nivel más adentro). Con un proveedor local (mock)
   * resuelve en microtareas, gana siempre y el veredicto vuelve en este mismo
   * think — determinista, como siempre. Con un proveedor real pierde la
   * carrera y devuelve 'in-flight': el ciclo sigue en segundo plano, ella
   * sigue viviendo, y un think posterior consume el veredicto con `resume`.
   */
  private async runSkillDevelopment(
    goal: Goal,
    contract: SkillContract,
    context: string[],
    scenarios: NamedScenario[],
    resume: SkillDevResume,
  ): Promise<SkillDevOutcome | 'in-flight'> {
    const promise = developSkill(
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
        ...(this.config.onEvaluationCase ? { onCase: this.config.onEvaluationCase } : {}),
      },
      this.events,
      this.tick,
    ).then((outcome) => {
      this.harvestSkillDevFacts(outcome);
      return outcome;
    });
    const settled = promise.then(
      (outcome) => ({ status: 'ok' as const, outcome }),
      (error) => ({ status: 'error' as const, error }),
    );
    const raced = await Promise.race([
      settled,
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 0)),
    ]);
    if (raced !== 'pending') {
      if (raced.status === 'error') throw raced.error;
      return raced.outcome;
    }
    const run: SkillDevRun = { goalId: goal.id, name: contract.name, settled: null, resume };
    this.skillDevRun = run;
    void settled.then((result) => {
      run.settled = result;
    });
    this.emit('skill.dev.background', { goalId: goal.id, name: contract.name });
    return 'in-flight';
  }

  /**
   * Si una práctica en segundo plano terminó, retoma el objetivo que la abrió.
   * Un fallo del proveedor se relanza desde acá: para la sesión es idéntico a
   * un think que falló (misma cuenta de errores seguidos, misma pausa a los
   * tres), y el objetivo sigue activo para reintentar.
   */
  private async consumeSkillDevVerdict(perception: Perception): Promise<ActionIntent | null> {
    const run = this.skillDevRun;
    if (!run?.settled) return null; // Nada en vuelo, o sigue practicando.
    this.skillDevRun = null;
    if (run.settled.status === 'error') throw run.settled.error;
    return run.resume(run.settled.outcome, perception);
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
              // En voz humana, igual que su gemelo positivo: lo que ella sabe
              // se lee, y el motor no habla castellano.
              const fact = this.memory.addFact(
                `${kindWithArticle(item)} no puede dañar ${kindWithArticle(target)}`,
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
    perception: Perception,
  ): Promise<ActionIntent | null> {
    this.lastSelectedGoalId = null;

    // La práctica ya corre en segundo plano: este tick se espera. El
    // veredicto la retoma (consumeSkillDevVerdict) con su sí o su no.
    if (this.skillDevRun) return null;

    const already = this.config.library.findStable(contract.name);
    if (already) {
      // Ya la sabe (la aprendió antes o la heredó): no hay nada que desarrollar.
      this.goals.complete(goal.id);
      this.emit('goal.completed', { goalId: goal.id, strategy: `ya-sabía:${contract.name}` });
      this.queueSkillRun(contract.name, contract.raw, perception);
      return null;
    }

    const resume: SkillDevResume = async (outcome, fresh) => {
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
        this.queueSkillRun(contract.name, contract.raw, fresh);
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
    };

    const outcome = await this.runSkillDevelopment(
      goal,
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
      // Lo que ya falló con este nombre viaja al ciclo nuevo: reintentar es
      // volver a intentarlo distinto, no volver a empezar de cero.
      [...contract.context, ...this.previousAttemptsContext(contract.name)],
      this.practiceScenariosFor(contract.successCriteria),
      resume,
    );
    if (outcome === 'in-flight') {
      // Que se sepa: aprender lleva su tiempo, pero la vida no se detiene.
      this.reply(
        `Me pongo a practicar "${contract.name}" en mi imaginación. Puede llevarme un rato — ` +
          `avisame si mientras tanto necesitás otra cosa.`,
      );
      return null;
    }
    return resume(outcome, perception);
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
  private queueSkillRun(skillName: string, raw: string, perception: Perception): void {
    const weights = USER_REQUEST_WEIGHTS['run-skill'];
    const goal = this.goals.create(
      {
        description: `petición del usuario: ${raw}`,
        source: 'user-request',
        priority: weights.priority,
        urgency: weights.urgency,
        expectedValue: 0.6,
        preconditions: [],
        successCondition: this.conditionForSkillRun(skillName, perception),
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
    // Una práctica ya corre en segundo plano: una mente alcanza. Este tick
    // se espera; el veredicto retoma el objetivo (consumeSkillDevVerdict).
    if (this.skillDevRun) return null;
    const triedStrategies = this.progress.strategiesTried(goal.id).filter((s) => s.forbidden);
    const failures = triedStrategies.map(
      (s) => `estrategia fallida: ${s.strategy} (${s.failures} fallos)`,
    );
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
      ...this.obstacleContext(triedStrategies, perception),
      ...this.experienceContext(contract.purpose),
      ...perception.visibleEntities.map(describeVisibleEntity),
    ];

    const resume: SkillDevResume = async (outcome, fresh) => {
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
        // El hambre pudo resolverse mientras practicaba (comió por otra vía,
        // el objetivo se completó): la habilidad queda en la biblioteca, pero
        // no se estrena contra un objetivo que ya no existe.
        const current = this.goals.all().find((g) => g.id === goal.id);
        if (current?.status !== 'active') return null;
        this.startActivity(
          goal,
          `stable-skill:${outcome.stableSkill.name}@v${outcome.stableSkill.version}`,
          outcome.stableSkill.program,
          fresh,
          { skillId: outcome.stableSkill.id },
        );
        return this.continueActivity(fresh);
      }
      this.memory.recordEpisode({
        kind: 'skill-failed',
        summary: `no logré desarrollar una habilidad para: ${contract.purpose}`,
        tick: this.tick,
        importance: 0.7,
      });
      return null;
    };

    const outcome = await this.runSkillDevelopment(
      goal,
      contract,
      context,
      this.config.evaluationScenarios,
      resume,
    );
    if (outcome === 'in-flight') return null;
    return resume(outcome, perception);
  }

  private startUserActivity(
    goal: Goal,
    program: SkillProgram,
    completionReply: string,
    perception: Perception,
  ): void {
    const rememberedEntities = this.places
      .all()
      .filter((place) => {
        const assessment = this.memory.assessKnowledge({
          topic: 'position',
          scope: { kind: 'entity', entityId: place.entityId },
          atTick: perception.tick,
        });
        // `unknown` conserva compatibilidad con lugares de guardados viejos;
        // stale/refuted ya es una decision epistemica explicita.
        return assessment.verdict !== 'stale' && assessment.verdict !== 'refuted';
      })
      .map((place) => ({
        id: place.entityId,
        kind: place.kind,
        ...(place.portable !== undefined ? { portable: place.portable } : {}),
      }));
    const causal = goal.userRequest
      ? planCausalRequest(goal.userRequest, perception, {
          rememberedEntities,
        })
      : undefined;
    if (causal?.supported) {
      const attempt = (this.causalPlanAttempts.get(goal.id) ?? 0) + 1;
      this.causalPlanAttempts.set(goal.id, attempt);
      if (causal.result.ok) {
        const steps = causal.result.plan.steps.map((step) => step.id);
        this.memory.working.planSummary = steps.join(' → ');
        this.emit(attempt === 1 ? 'causal.plan.created' : 'causal.plan.revised', {
          goalId: goal.id,
          attempt,
          confidence: causal.result.plan.confidence,
          cost: causal.result.plan.totalCost,
          risk: causal.result.plan.totalRisk,
          steps,
        });
        this.memory.recordKnowledge({
          topic: `causal-plan:${goal.id}`,
          content: `hay un plan causal para ${goal.description}`,
          status: 'inferred',
          source: { kind: 'system', description: 'planificador causal verificado' },
          evidence: [
            {
              supports: true,
              description: `pasos: ${steps.join(' -> ')}`,
              source: { kind: 'system', description: 'busqueda causal' },
              atTick: perception.tick,
            },
          ],
          confidence: causal.result.plan.confidence === 'known' ? 0.95 : 0.65,
          acquiredAtTick: perception.tick,
          expiresAtTick: perception.tick + 1,
          scope: { kind: 'entity', entityId: goal.id },
        });
      } else {
        delete this.memory.working.planSummary;
        this.emit('causal.plan.rejected', {
          goalId: goal.id,
          reason: causal.result.reason,
          diagnostics: causal.result.diagnostics,
          expandedStates: causal.result.expandedStates,
        });
        this.memory.declareUnknown({
          topic: `causal-plan:${goal.id}`,
          content: `como completar ${goal.description}`,
          atTick: perception.tick,
          scope: { kind: 'entity', entityId: goal.id },
          reason: 'el planificador no encontro una cadena causal demostrable',
          missingData: causal.result.diagnostics,
          resolutionOptions: [
            { kind: 'observe', description: 'explorar para encontrar recursos o caminos' },
            { kind: 'ask', description: 'preguntar al cuidador por el dato o recurso faltante' },
            {
              kind: 'experiment',
              description: 'probar una accion contingente segura y observarla',
            },
          ],
        });
        // `no-plan` no demuestra imposibilidad en un mundo parcialmente visto:
        // conserva el diagnóstico, pero la ejecución contingente todavía puede
        // explorar y dejar que el mundo confirme o niegue. Lo que sí se rechaza
        // como plan son cadenas concretas con precondiciones falsas, mediante
        // `validateCausalPlan`; ausencia de prueba no se convierte en prueba de
        // ausencia.
      }
    }
    // Al ponerse a trabajar el encargo, sus pasos se vuelven objetivos hijos
    // (ADR 0053). Acá y no al aceptar el pedido: recién ahora hay percepción, y
    // la cuenta de qué falta puede haber cambiado —una receta inventada en el
    // medio— así que cada reanudación repone los pasos que falten.
    this.ensureRequestSteps(goal, perception);
    if (
      goal.userRequest?.kind === 'wait-here' &&
      !goal.observedFacts?.includes('activity-started')
    ) {
      // "Acá" se liga cuando de verdad empieza a esperar. Una urgencia del
      // cuerpo puede haber postergado el encargo y movido a Ánima entretanto.
      goal.successCondition = conditionForUserRequest(goal.userRequest, perception);
      this.goals.observeFact(goal.id, 'activity-started');
    }
    if (goal.userRequest?.kind === 'run-skill') {
      this.goals.observeFact(goal.id, 'skill-started');
      const visit = `visited:${perception.self.position.x},${perception.self.position.y}`;
      if (!goal.observedFacts?.includes(visit)) {
        this.goals.observeFact(goal.id, visit);
        this.goals.increment(goal.id, 'visited-cells');
      }
    }
    this.emit('strategy.selected', { goalId: goal.id, strategy: 'petición-del-usuario' });
    this.activity = {
      goalId: goal.id,
      strategy: 'petición-del-usuario',
      exec: new SkillExecution(program, this.petId, {
        library: this.config.library,
        spatial: this.spatial,
        places: this.gpsPlaces(),
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
      purpose?: 'restore-energy' | 'be-safe' | 'open-path';
    } = {},
  ): void {
    this.emit('strategy.selected', { goalId: goal.id, strategy });
    this.activity = {
      goalId: goal.id,
      strategy,
      exec: new SkillExecution(program, this.petId, {
        library: this.config.library,
        spatial: this.spatial,
        places: this.gpsPlaces(),
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

    // Abrirse paso no cumple ni fracasa el encargo (ADR 0066): es un rodeo. Se
    // registra qué pasó y el objetivo sigue vivo — si el muro cayó, el próximo
    // intento encuentra el material que antes no existía para ella; si no cayó,
    // el rótulo queda prohibido y no se reintenta contra lo mismo.
    if (activity.purpose === 'open-path') {
      const abierto = out.result.outcome === 'completed';
      // Se anota como cualquier otra estrategia: dos fracasos la prohiben, y
      // eso es lo que evita golpear para siempre contra lo que no cede.
      this.progress.record(activity.goalId, activity.strategy, abierto, out.result.reason);
      // Solo se anuncia el fracaso cuando fracasó: un `strategy.failed` con el
      // motivo en null al abrir el paso contaba una derrota que no ocurrió, y
      // el registro técnico es lo que se lee para entender qué pasó.
      if (!abierto) {
        this.emit('strategy.failed', {
          goalId: activity.goalId,
          strategy: activity.strategy,
          outcome: out.result.outcome,
          reason: out.result.reason ?? null,
        });
      }
      this.lastSelectedGoalId = null;
      return null;
    }

    if (activity.purpose === 'user-request') {
      // Terminar el programa no es terminar la OBRA (ADR 0059). Colocar cada
      // bloque está protegido por «solo si de verdad lo tengo en la mano», así
      // que cuando falta material las celdas se saltean y el programa llega al
      // final sin abortar: "completado" describía la ejecución, no el mundo. Se
      // la vio decir «Listo» con media escuela en pie.
      const currentGoal = this.goals.get(activity.goalId);
      const spatial =
        currentGoal?.userRequest?.kind === 'spatial-relation'
          ? currentGoal.userRequest.spatial
          : undefined;
      const evaluation = currentGoal ? this.evaluateGoal(currentGoal, perception) : undefined;
      const stateSatisfied = evaluation?.status === 'met';
      const unfinished =
        out.result.outcome === 'completed' && this.unfinishedStructure(activity.goalId, perception);
      // Ejecución y estado son ejes independientes. Incluso un programa
      // abortado puede coincidir con un estado ya alcanzado por el mundo.
      const success = !unfinished && stateSatisfied;
      if (success && currentGoal?.mode === 'maintenance') {
        this.progress.record(activity.goalId, activity.strategy, true);
        this.lastSelectedGoalId = null;
        return null;
      }
      if (success) {
        this.goals.complete(activity.goalId);
        this.destroyToolFloor.delete(activity.goalId);
        this.emit('goal.completed', { goalId: activity.goalId, strategy: activity.strategy });
        this.memory.recordEpisode({
          kind: 'promise-kept',
          summary: `cumplí la petición: ${activity.requestRaw ?? activity.strategy}`,
          tick: this.tick,
          importance: 0.7,
        });
        this.reply(activity.completionReply ?? 'Listo.');
      } else {
        // Una obra a medias se cuenta como lo que es: se quedó sin material.
        // Así entra por la misma puerta que ya sabe suspender con la lista de
        // lo que falta y despertar cuando aparezca (ADR 0046), en vez de
        // fracasar y cerrar el encargo para siempre.
        const reason = unfinished
          ? 'no-candidates:obra-incompleta'
          : out.result.outcome === 'completed' && spatial && !stateSatisfied
            ? 'criterio-espacial-no-cumplido'
            : out.result.outcome === 'completed'
              ? `condición-no-cumplida:${evaluation?.diagnostics.join('|') || 'sin-evidencia'}`
              : (out.result.reason ?? out.result.outcome);
        const goal = this.goals.get(activity.goalId);
        // Llegar al final de la DSL sin alcanzar el predicado no mata el
        // objetivo. Se diagnostica, se marca la estrategia y el siguiente
        // think recompone un plan desde una percepción fresca.
        if (out.result.outcome === 'completed' && !unfinished && !spatial) {
          const record = this.progress.record(activity.goalId, activity.strategy, false, reason);
          this.emit('goal.outcome.unmet', {
            goalId: activity.goalId,
            programOutcome: out.result.outcome,
            conditionStatus: evaluation?.status ?? 'unknown',
            diagnostics: evaluation?.diagnostics ?? [],
          });
          this.emit('strategy.failed', {
            goalId: activity.goalId,
            strategy: activity.strategy,
            outcome: out.result.outcome,
            reason,
          });
          if (record.forbidden) {
            this.emit('strategy.forbidden', {
              goalId: activity.goalId,
              strategy: activity.strategy,
            });
          }
          this.lastSelectedGoalId = null;
          return null;
        }
        // Cruzar es un objetivo, no una habilidad. Si la navegación no
        // encuentra ruta y la propia referencia es una barrera rompible, abrir
        // un hueco es una estrategia al servicio del mismo objetivo. El pedido
        // solo se completa después, cuando la posición queda del lado opuesto.
        if (
          goal?.userRequest?.kind === 'spatial-relation' &&
          goal.userRequest.relation === 'opposite-side' &&
          (reason === 'camino-bloqueado' || reason === 'criterio-espacial-no-cumplido')
        ) {
          const targetKind = goal.userRequest.targetKind ?? 'unknown';
          const barrier = perception.visibleEntities.find(
            (entity) =>
              entity.kind === targetKind &&
              entity.solid === true &&
              entity.hardness !== undefined &&
              entity.held !== true,
          );
          const label = barrier ? `abrir-paso-espacial:${targetKind}` : null;
          if (
            barrier &&
            label &&
            this.strongestToolPower(perception) > 0 &&
            !this.progress.isForbidden(goal.id, label)
          ) {
            this.reply(
              `No encuentro un paso: voy a abrirme camino por ${kindWithArticle(targetKind)}.`,
            );
            this.startActivity(goal, label, breakThroughProgram(targetKind), perception, {
              purpose: 'open-path',
            });
            this.lastSelectedGoalId = null;
            return null;
          }
          this.goals.fail(goal.id);
          this.emit('strategy.failed', {
            goalId: goal.id,
            strategy: 'petición-espacial',
            outcome: out.result.outcome,
            reason,
          });
          this.reply(
            barrier && this.strongestToolPower(perception) === 0
              ? `Entiendo adónde querés que vaya, pero no tengo con qué abrirme paso por ${kindWithArticle(targetKind)}.`
              : `Entiendo adónde querés que vaya, pero no encuentro una ruta hasta el otro lado de ${kindWithArticle(targetKind)}.`,
          );
          this.lastSelectedGoalId = null;
          return null;
        }
        // "Muy duro" no es el final del pedido: es "me falta una herramienta más
        // fuerte". El objetivo sigue VIVO y el próximo tick intenta fabricarla —
        // o inventarla si su mundo no la sabe hacer (ADR 0036), ahora también
        // naciendo de un pedido y sin pedir permiso. Marcar el piso de dureza es
        // lo que evita volver a golpear con lo mismo.
        if (reason === 'objetivo-muy-duro' && goal?.userRequest?.kind === 'destroy-entity') {
          this.destroyToolFloor.set(activity.goalId, this.strongestToolPower(perception));
          this.emit('strategy.failed', {
            goalId: activity.goalId,
            strategy: activity.strategy,
            outcome: out.result.outcome,
            reason,
          });
          const target = goal.userRequest.targetKind;
          this.memory.addHypothesis(
            `me falta una herramienta más fuerte para romper ${kindWithArticle(target ?? 'eso')}`,
            this.tick,
            0.7,
          );
          this.reply(
            `${target ? kindWithArticle(target).replace(/^\w/, (c) => c.toUpperCase()) : 'Eso'} no cedió a mi herramienta. Voy a intentar hacerme algo más fuerte.`,
          );
          this.lastSelectedGoalId = null;
          return null;
        }
        // Quedarse sin materia no es fracasar: es esperar (ADR 0046). Fallar el
        // objetivo lo cerraba para siempre, y por eso conseguir después el
        // tronco que faltaba no retomaba nada — el cuidador tenía que volver a
        // pedir la obra entera. Se suspende con la lista de lo que falta, y
        // vuelve sola cuando eso aparece. El programa de la obra ya es
        // reanudable: no recoloca lo que ya está puesto.
        const missingKinds = this.missingKindsForRequest(goal, perception);
        // Buscó y no encontró. Antes de darlo por «no hay», mirar si lo que
        // falta no es materia sino CAMINO (ADR 0066): una pared que tapa mundo
        // sin pisar. Romperla no cumple el encargo —por eso no es su
        // actividad— pero lo desatasca, y el próximo intento ya busca del otro
        // lado. Si el rótulo está prohibido es que ya lo intentó y no cedió.
        // Lo que faltó no fue la MATERIA sino la HERRAMIENTA con que sacarla
        // (`no-candidates:tool-<tipo>`): tiene cuatro árboles delante y no
        // puede talar ninguno. Eso no es un encargo sin camino, es un encargo
        // con un paso más — y dormirse ahí fue lo que dejó la puerta abierta a
        // que los antojos se gastaran la materia que estaba esperando.
        //
        // Se anota y NO se suspende: hacerse una herramienta puede requerir
        // inventarla, y eso solo puede pasar en el camino asíncrono.
        if (reason.startsWith('no-candidates:tool-') && goal) {
          this.harvestToolBlocked.set(activity.goalId, reason.slice('no-candidates:tool-'.length));
          this.lastSelectedGoalId = null;
          return null;
        }
        if (reason.startsWith('no-candidates') && missingKinds.length > 0 && goal) {
          // Lo que podría estar del otro lado es la materia ENCONTRABLE, no los
          // bloques del plano (ADR 0066, adenda). Una encimera no aparece
          // tirada detrás de una pared: se fabrica. Romper para buscarla es
          // destruir el mundo persiguiendo algo que no está en ninguna parte —
          // se la vio abriendo agujeros en loop «buscando un fogón de cocina».
          const buscables = this.findableMaterialsFor(missingKinds, perception);
          // Y con un TOPE por encargo (ADR 0067). Abrirse paso sirve para
          // alcanzar territorio nuevo; si después de varias aperturas la
          // materia sigue sin aparecer, el problema no era el camino y seguir
          // rompiendo es demoler el mundo por nada. Se la vio abriendo agujeros
          // en serie por una cocina que pedía ramas, en un mundo sin ramas.
          //
          // No alcanza con `isForbidden`: eso cuenta FRACASOS, y cada apertura
          // salía bien. Lo que hay que limitar acá son los éxitos inútiles.
          const abiertas = this.pathOpenings.get(activity.goalId) ?? 0;
          const blocker =
            abiertas >= MAX_PATH_OPENINGS ? undefined : this.frontierBlocker(perception);
          const label = blocker ? `abrir-paso:${blocker}` : null;
          if (blocker && label && !this.progress.isForbidden(activity.goalId, label)) {
            this.reply(
              `No encuentro ${displayKindList(buscables)} de este lado. ` +
                `Voy a abrirme paso por ${kindWithArticle(blocker)}.`,
            );
            this.pathOpenings.set(activity.goalId, abiertas + 1);
            this.startActivity(goal, label, breakThroughProgram(blocker), perception, {
              purpose: 'open-path',
            });
            this.lastSelectedGoalId = null;
            return null;
          }
        }
        if (reason.startsWith('no-candidates') && missingKinds.length > 0) {
          // Lo que espera que APAREZCA no es lo que le falta, sino lo que le
          // falta CONSEGUIR: un pizarrón no aparece tirado, se fabrica con dos
          // arcillas. Esperando el pizarrón se quedaba dormida para siempre con
          // la arcilla a cuatro pasos; esperando la arcilla, despierta.
          const waitingFor = this.findableMaterialsFor(missingKinds, perception);
          this.goals.suspend(
            activity.goalId,
            'me quedé sin material a mitad del encargo',
            `aparezca ${displayKindList(waitingFor)}`,
          );
          this.suspensionMaterials.set(activity.goalId, waitingFor);
          this.suspensionTick.set(activity.goalId, this.tick);
          this.noteWhatSheSaw(activity.goalId, perception);
          this.destroyToolFloor.delete(activity.goalId);
          this.emit('goal.suspended', {
            goalId: activity.goalId,
            reason: 'falta material para el encargo',
          });
          this.memory.recordEpisode({
            kind: 'failure',
            summary: `me faltó material para ${activity.requestRaw ?? 'lo que me pidieron'}: sigo pendiente`,
            tick: this.tick,
            importance: 0.6,
          });
          // Cuando no hay NINGUNA vía conocida para esa materia, decirlo (ADR
          // 0067). El cuidador veía «me faltan 3 encimeras» y no tenía forma de
          // saber que el problema real era que en ese mundo nada da ramas: la
          // cocina era imposible y el mensaje sonaba a cuestión de tiempo.
          //
          // Se agrega al aviso, no lo reemplaza: la promesa de retomar sigue
          // siendo cierta y es lo que el cuidador necesita oír. Y se dice en
          // primera persona —«no veo de dónde sacar»— porque es un juicio sobre
          // lo que ella sabe, no sobre el mundo: puede haber un arbusto del
          // otro lado del mapa que todavía no vio.
          // Y si no ve de dónde sacarlo, PEDIRLO (ADR 0068). Antes contaba el
          // problema y se quedaba esperando; contar no es pedir, y el cuidador
          // no tenía qué hacer con «me faltan 3 encimeras» —las encimeras no se
          // consiguen, se fabrican—. Lo que se pide es la materia BASE y con
          // cantidad: «14 ramas y 7 fibras» es algo que él puede traer.
          // Pide lo que NO tiene forma de conseguir, no «todo o nada» (ADR
          // 0068). A la cocina le faltaban ramas, fibra y pedernal: la fibra
          // sale de un arbusto y el pedernal está tirado —esos los junta ella—,
          // pero nada da ramas. Exigir que TODO fuera imposible para pedir era
          // no pedir nunca: alcanza con que una pieza lo sea.
          const pedido = goal
            ? this.missingBaseMaterials(goal, perception).filter((m) =>
                this.beyondHerWorld(m.kind, perception),
              )
            : [];
          const lista = pedido.map((m) => countedKindLabel(m.kind, m.count)).join(', ');
          // No repetir el mismo pedido en cada reintento: se pide cuando lo que
          // necesita CAMBIA —porque consiguió parte, o porque ahora le falta
          // otra cosa—. Repetirlo cada dos minutos era el ruido que hacía que
          // el aviso dejara de leerse.
          const pedirAhora = lista.length > 0 && this.lastAskedFor.get(activity.goalId) !== lista;
          if (pedirAhora) {
            this.lastAskedFor.set(activity.goalId, lista);
            this.emit('help.requested', { goalId: activity.goalId });
          }
          // El pedido reemplaza SOLO el cierre, no la explicación: lo que viene
          // antes es la cadena entera («2 paredes, 2 tablas, 1 tronco») que
          // responde «por qué tanto», y es lo que vuelve entendible un costo
          // grande. Se cambia la promesa vaga por una pregunta concreta.
          this.reply(
            `No pude completar eso: ${this.describeActivityFailure(reason, activity, perception)}. ` +
              (pedirAhora
                ? `No veo de dónde sacarlo por acá — ¿me conseguís ${lista}? Lo retomo apenas lo tenga.`
                : `Lo dejo a medias y sigo apenas consiga lo que falta.`),
          );
          this.lastSelectedGoalId = null;
          return null;
        }
        // «No sé qué construir» no es un fracaso: es que la idea todavía no
        // existe. El encargo nombra algo que no tiene ni receta ni plano —
        // porque nunca se inventó, o porque el juez acaba de vetar la forma en
        // que se había pensado— y eso es exactamente el estado en el que la
        // puerta de invención tiene algo que hacer.
        //
        // Matarlo acá era perder la corrección justo cuando llegaba. Se vio en
        // el cauce ancho: el juez dijo «un puente es un lugar, no una cosa»,
        // que es una instrucción de cómo rehacerlo, y diez ticks después el
        // encargo estaba muerto con «no sé qué construir». Quedó parada 490
        // ticks con el motivo de su fracaso guardado en la memoria y sin nadie
        // que lo leyera. En otras corridas, con el mismo veto, sí volvía a
        // proponer y cruzaba: la diferencia no era la idea, era quién llegaba
        // primero al objetivo.
        //
        // Se suspende en vez de fallar, así que el ciclo de invención lo retoma
        // con el veto como dato. Lo que evita el bucle no es esto sino lo de
        // siempre: el crédito de intentos por objetivo y el veto guardado, que
        // ya frena volver a proponer la MISMA forma.
        if (reason === 'no-sé-qué-construir' && goal?.userRequest?.kind === 'craft-item') {
          this.goals.suspend(
            activity.goalId,
            'todavía no se me ocurre cómo hacer eso',
            'que se me ocurra una forma nueva',
          );
          this.suspensionTick.set(activity.goalId, this.tick);
          this.emit('goal.suspended', { goalId: activity.goalId, reason: 'falta imaginar cómo' });
          this.emit('strategy.failed', {
            goalId: activity.goalId,
            strategy: activity.strategy,
            outcome: out.result.outcome,
            reason,
          });
          this.reply(`Todavía no se me ocurre cómo hacer eso. Le sigo dando vueltas.`);
          this.lastSelectedGoalId = null;
          return null;
        }
        this.goals.fail(activity.goalId);
        this.destroyToolFloor.delete(activity.goalId);
        // El motivo que se anuncia es el MISMO que se juzgó arriba (`reason`),
        // no el crudo del programa. Una obra a medias termina el programa sin
        // abortar, así que lo crudo es `outcome: "completed", reason: null`: el
        // registro técnico contaba un encargo que salió bien y murió igual, y
        // no había forma de leer ahí que el motivo real era "quedó a medias".
        this.emit('strategy.failed', {
          goalId: activity.goalId,
          strategy: activity.strategy,
          outcome: out.result.outcome,
          reason,
        });
        this.memory.recordEpisode({
          kind: 'failure',
          summary: `no pude cumplir la petición ${activity.requestRaw ?? ''}: ${out.result.reason ?? out.result.outcome}`,
          tick: this.tick,
          importance: 0.6,
        });
        // Un fracaso no es un callejón: antes de callarse, lo vuelve aprendizaje
        // y una oferta concreta. Si el motivo no da para eso, cae en la
        // explicación de siempre — pero nunca en un silencio a la espera.
        const reaction = this.reactToRequestFailure(reason, goal, perception);
        this.reply(
          reaction ??
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
    // Buscar o romper algo que no aparece tiene una respuesta mejor que «no
    // encuentro el objeto»: decir QUÉ es lo que no aparece. Ella lo sabe —
    // cuando el cuidador preguntó "¿qué no encontrás?" contestó al instante y
    // con detalle; el problema era que nadie se lo había preguntado a la frase.
    if (
      (request?.kind === 'fetch-item' || request?.kind === 'destroy-entity') &&
      request.targetKind
    ) {
      return `no veo ${kindWithArticle(request.targetKind)} por acá`;
    }
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
   * Qué tipos de materia le faltan para un encargo, como lista de `kind`. Es la
   * misma cuenta que la frase honesta de `missingForCraft`, pero en datos: la
   * frase es para el cuidador, esto es para poder retomar sola cuando aparezca.
   * Vale para obras (bloques del plano) y para objetos (ingredientes).
   */
  private missingKindsForRequest(goal: Goal | undefined, perception: Perception): string[] {
    return this.neededCountsFor(goal, perception)
      .filter((m) => m.have < m.need)
      .map((m) => m.kind);
  }

  /**
   * Lo que de verdad hay que ENCONTRAR para conseguir estos tipos. Un tipo que
   * ninguna receta produce se busca tal cual; uno que se fabrica se cambia por
   * sus ingredientes, y así hasta tocar materia que exista en el mundo.
   *
   * Es la diferencia entre dormir esperando un pizarrón —que no va a aparecer
   * nunca, porque los pizarrones se hacen— y despertar cuando hay arcilla.
   */
  /**
   * ¿Su mundo tiene CON QUÉ dar esto? (ADR 0067)
   *
   * Materia que ninguna receta produce, que nada de lo que ve deja al
   * romperse, que no recuerda haber visto y que no tiene delante. No es «no la
   * encuentro»: es que no existe la forma de conseguirla.
   *
   * La partida que lo motivó tenía una cocina cuyas piezas pedían RAMAS, y en
   * ese mundo el árbol da troncos, el arbusto fibra, la roca piedra — nada da
   * ramas. Gastadas las tres iniciales, la cocina quedó imposible para siempre,
   * y ella siguió buscando (y rompiendo paredes) sin final.
   *
   * Es un juicio sobre lo que SABE, no sobre el mundo: si mañana aparece una
   * rama, el objetivo despierta igual. Por eso solo apaga la búsqueda, no el
   * objetivo.
   */
  /**
   * Cuánta materia BASE le falta para terminar el encargo (ADR 0068), ya
   * sumada por tipo y descontando lo que lleva encima.
   *
   * Es lo que hace falta para poder PEDIR algo concreto. «Me faltan 3
   * encimeras» no le sirve al cuidador: las encimeras no se consiguen, se
   * fabrican. «Me faltan 14 ramas» sí — eso puede traerlo.
   */
  private missingBaseMaterials(
    goal: Goal,
    perception: Perception,
  ): { kind: string; count: number }[] {
    const base = new Map<string, number>();
    for (const need of this.neededCountsFor(goal, perception)) {
      const faltan = need.need - need.have;
      if (faltan <= 0) continue;
      const recipe = recipeProducing(perception.recipes, need.kind);
      if (!recipe) {
        base.set(need.kind, (base.get(need.kind) ?? 0) + faltan);
        continue;
      }
      for (const [kind, count] of expandRecipeCost(recipe, perception.recipes, { times: faltan })
        .base) {
        base.set(kind, (base.get(kind) ?? 0) + count);
      }
    }
    // Lo que ya tiene en la mano no hace falta pedirlo.
    for (const item of perception.self.heldItems) {
      const tiene = base.get(item.kind);
      if (tiene !== undefined) base.set(item.kind, tiene - 1);
    }
    return [...base]
      .filter(([, count]) => count > 0)
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * La materia que YA TIENE DUEÑO: lo que los encargos abiertos del cuidador
   * todavía necesitan, y que no sobra.
   *
   * Nace de una partida perdida entera. Con «cruzá el río» dormido por falta de
   * troncos, el frío ganó la selección —un encargo suspendido no compite— y se
   * puso a inventar ofreciéndole al modelo esos mismos troncos como materia
   * libre. Fabricó una fogata, y el encargo despertó para descubrir que le
   * faltaba justo lo que ella se había gastado. Diez recetas después, el mapa
   * era imposible.
   *
   * Cuenta lo mismo que se le pide al cuidador cuando no llega
   * (`missingBaseMaterials`): materia BASE, bajando el árbol de recetas, porque
   * reservar «tablón» no sirve de nada si lo que se va a gastar es el tronco del
   * que sale.
   *
   * Solo se reserva lo que NO SOBRA: si hay diez troncos a la vista y el encargo
   * necesita dos, los otros ocho son suyos para lo que quiera. Reservar el tipo
   * entero convertiría cualquier encargo abierto en una prohibición de vivir, y
   * la iniciativa propia (ADR 0036) es justamente lo que no queremos apagar.
   */
  private committedKinds(perception: Perception, exceptGoalId?: string): string[] {
    const needed = new Map<string, number>();
    for (const goal of this.goals.all()) {
      if (goal.id === exceptGoalId) continue;
      if (goal.source !== 'user-request' || goal.parentGoalId !== undefined) continue;
      if (goal.status !== 'active' && goal.status !== 'suspended') continue;
      for (const { kind, count } of this.missingBaseMaterials(goal, perception)) {
        needed.set(kind, (needed.get(kind) ?? 0) + count);
      }
    }
    if (needed.size === 0) return [];
    const available = new Map<string, number>();
    for (const item of perception.self.heldItems) {
      available.set(item.kind, (available.get(item.kind) ?? 0) + 1);
    }
    for (const entity of perception.visibleEntities) {
      if (entity.held === true || entity.portable !== true) continue;
      available.set(entity.kind, (available.get(entity.kind) ?? 0) + 1);
    }
    return [...needed]
      .filter(([kind, count]) => count >= (available.get(kind) ?? 0))
      .map(([kind]) => kind);
  }

  private beyondHerWorld(kind: string, perception: Perception): boolean {
    if (recipeProducing(perception.recipes, kind)) return false;
    if (this.harvestSourceFor(kind, perception)) return false;
    if (this.places.recall({ kind }, perception).length > 0) return false;
    return !perception.visibleEntities.some((e) => e.kind === kind && e.held !== true);
  }

  private findableMaterialsFor(kinds: string[], perception: Perception): string[] {
    const found = new Set<string>();
    const walk = (kind: string, depth: number): void => {
      const recipe =
        depth >= MAX_RECIPE_DEPTH ? undefined : recipeProducing(perception.recipes, kind);
      if (!recipe) {
        found.add(kind);
        return;
      }
      for (const ingredient of recipe.ingredients) walk(ingredient.kind, depth + 1);
    };
    for (const kind of kinds) walk(kind, 0);
    return [...found];
  }

  /**
   * Retoma los encargos que quedaron esperando materia (ADR 0046). Basta con
   * que UNO de los tipos que faltaban esté ahora a la vista o en la mano: el
   * programa de la obra vuelve a correr, no recoloca lo ya puesto y, si todavía
   * falta otra cosa, se volverá a suspender con la lista nueva. Sin esto, cada
   * pieza conseguida necesitaba que el cuidador dijera «seguí».
   */
  private reviveSuppliedRequests(perception: Perception): void {
    for (const goal of this.goals.all()) {
      if (goal.status !== 'suspended') continue;
      // Un guardado anterior al ADR 0066 no trae la lista de lo que esperaba:
      // se rehace de la cuenta de siempre. Sin esto, todo encargo dormido en
      // una partida vieja queda huérfano para siempre — que era exactamente el
      // estado en el que estaba la escuela del cuidador al recargar.
      if (
        !this.suspensionMaterials.has(goal.id) &&
        goal.source === 'user-request' &&
        goal.suspendedReason === 'me quedé sin material a mitad del encargo'
      ) {
        const faltan = this.findableMaterialsFor(
          this.missingKindsForRequest(goal, perception),
          perception,
        );
        if (faltan.length > 0) {
          this.suspensionMaterials.set(goal.id, faltan);
          this.suspensionTick.set(goal.id, this.tick);
          this.noteWhatSheSaw(goal.id, perception);
        }
      }
      const waitingFor = this.suspensionMaterials.get(goal.id);
      // Lo dejó por una urgencia del cuerpo (ADR 0048), no por falta de
      // materia: vuelve cuando el cuerpo sale del rojo. Sin esto, atender el
      // frío enterraba el encargo y el cuidador tenía que volver a pedirlo.
      if (!waitingFor) {
        if (
          goal.source === 'user-request' &&
          goal.suspendedReason === 'lo dejé a medias por una urgencia del cuerpo' &&
          !this.bodyInTheRed(perception)
        ) {
          this.goals.reactivate(goal.id);
          this.progress.resetGoal(goal.id);
          this.emit('goal.reactivated', {
            goalId: goal.id,
            reason: 'pasó la urgencia del cuerpo',
          });
        }
        // Y el que se durmió porque todavía no se le ocurría CÓMO vuelve a
        // pensarlo al rato. No espera nada del mundo: espera una idea, y las
        // ideas no aparecen tiradas en el suelo — aparecen cuando se vuelve a
        // intentar, ahora con el veto guardado como pista de qué corregir.
        //
        // Volver a pensar no es volver a proponer lo mismo: el veto de esa
        // forma ya está en su memoria y frena la repetición, así que el
        // reintento solo puede ser una forma distinta. Y el crédito de intentos
        // por objetivo le pone el techo.
        if (
          goal.source === 'user-request' &&
          goal.suspendedReason === 'todavía no se me ocurre cómo hacer eso' &&
          this.tick - (this.suspensionTick.get(goal.id) ?? this.tick) >= RETRY_SEARCH_TICKS
        ) {
          this.goals.reactivate(goal.id);
          this.progress.resetGoal(goal.id);
          this.suspensionTick.set(goal.id, this.tick);
          this.emit('goal.reactivated', {
            goalId: goal.id,
            reason: 'vuelve a pensar cómo hacerlo',
          });
        }
        continue;
      }
      if (waitingFor.length === 0) continue;
      // La cuenta se REHACE contra la percepción de ahora. Preguntar si "tiene"
      // alguno de los tipos que faltaban no sirve: tener uno de los dos muros
      // que pide el plano es justo la situación en la que se suspendió, y
      // revivir por eso sería un bucle suspender/revivir cada tick.
      // Se expande a materia encontrable por el mismo motivo que al
      // suspenderse: lo que tiene que aparecer es la arcilla, no el pizarrón.
      const stillMissing = this.findableMaterialsFor(
        this.missingKindsForRequest(goal, perception),
        perception,
      );
      const arrived =
        // Ya no falta nada: lo fabricó, se lo trajeron, o lo juntó de otro lado.
        stillMissing.length === 0 ||
        // O lo que falta está a la vista y se puede LEVANTAR. `portable` no es
        // un detalle: un bloque ya colocado en la obra deja de serlo (ADR
        // 0034), y sin este filtro sus propias paredes contaban como "apareció
        // material" — revivía, fallaba igual, se suspendía y volvía a verlas,
        // en un bucle de un mensaje idéntico cada cincuenta ticks.
        // Y sobre todo: algo que NO estaba ahí cuando se rindió. Lo que ya veía
        // al suspenderse es exactamente la situación que la hizo suspenderse,
        // así que contarlo como novedad la despierta para volver a fallar en el
        // mismo tick. Un id nuevo cubre las tres formas legítimas de que la
        // espera termine (lo fabricó, se lo trajeron, o caminó y encontró más),
        // porque las tres estrenan entidad o la traen a la vista por primera vez.
        stillMissing.some((kind) =>
          perception.visibleEntities.some(
            (e) =>
              e.kind === kind &&
              e.held !== true &&
              e.portable === true &&
              !(this.suspensionSeen.get(goal.id)?.has(e.id) ?? false),
          ),
        );
      // O lo RECUERDA: vio ese material antes, en un lugar al que sabe volver
      // (ADR 0065). Esperar a verlo desde donde está parada convierte la
      // memoria de lugares en adorno — y la deja en una esquina esperando un
      // tronco que está a diez celdas, del otro lado del mapa.
      const remembered =
        !arrived &&
        stillMissing.some((kind) => this.places.recall({ kind }, perception).length > 0);
      // Y si ni lo ve ni lo recuerda, igual vuelve a INTENTARLO cada tanto. El
      // programa del encargo explora antes de darse por vencido, así que
      // reintentar no es repetir: es salir a buscar de nuevo, con el mapa que
      // ya caminó. Rendirse para siempre por no haberlo encontrado una vez es
      // lo que la dejaba quieta con la obra a medias.
      // El reintento NO se corta aunque hoy parezca imposible (ADR 0067): «no
      // veo de dónde sacarlo» es un juicio sobre lo que sabe, y lo que sabe
      // cambia — un mundo pelado hoy puede tener madera mañana porque el
      // cuidador la trajo o porque algo se rompió. Volver a mirar cada dos
      // minutos es barato; declararlo imposible y dejar de mirar, no.
      const retry =
        !arrived &&
        !remembered &&
        this.tick - (this.suspensionTick.get(goal.id) ?? this.tick) >= RETRY_SEARCH_TICKS;
      if (!arrived && !remembered && !retry) continue;
      this.goals.reactivate(goal.id);
      this.progress.resetGoal(goal.id);
      this.suspensionTick.set(goal.id, this.tick);
      if (arrived) {
        this.suspensionMaterials.delete(goal.id);
        this.suspensionSeen.delete(goal.id);
      }
      this.emit('goal.reactivated', {
        goalId: goal.id,
        reason: arrived
          ? 'apareció el material que faltaba'
          : remembered
            ? 'recordó dónde había de lo que le falta'
            : 'vuelve a salir a buscar lo que le falta',
      });
    }
  }

  /**
   * Por qué no pudo levantar una obra. Desde el ADR 0034 la obra se construye de
   * a un bloque volviendo al ancla, así que las manos ya no son el techo: si
   * falla, es porque no consiguió la materia de los bloques (o no pudo volver al
   * sitio a colocarla). Nombra el bloque y el número — nunca «no encuentro el
   * objeto», que no le sirve a nadie.
   *
   * El número es el que FALTA, no el que pide el plano: enumerar la receta
   * entera le hacía decir «no pude reunir 1 pizarra» con la pizarra en la mano,
   * y mandaba al cuidador a buscar cinco muros cuando ya tenía cuatro. Se
   * acredita lo que lleva encima igual que en `missingDownTheTree`.
   */
  private missingForStructure(recipeId: string, perception: Perception): string | null {
    const blueprint = perception.blueprints.find((b) => b.id === recipeId);
    if (!blueprint) return null;
    // Lo que falta es lo que falta LEVANTAR, no lo que pide el plano entero:
    // con dos muros ya puestos y cuatro en la mano decía "me falta 1" cuando en
    // realidad le sobraban. Descontar solo el inventario era media cuenta. La
    // cuenta la hace `neededCountsFor`, la misma que mira la pantalla.
    const missing = this.blueprintNeeds(blueprint, perception).filter((m) => m.have < m.need);
    // Los tiene todos y aun así falló: lo que no consiguió es el SITIO, no la
    // materia. Decir que le faltan bloques ahí sería mentir con precisión.
    if (missing.length === 0) {
      return `tengo todo para ${kindWithArticle(recipeId)}, pero no pude colocarlo donde iba`;
    }
    return `no pude reunir ${displayMissing(missing)} para ${kindWithArticle(recipeId)}`;
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

  /**
   * Reacción ante un pedido que no salió. Antes, un fracaso era un callejón: la
   * mascota decía "no pude" y se quedaba a la espera. Aquí el fracaso se vuelve
   * dos cosas — aprendizaje y una oferta concreta —, para que responder no sea
   * rendirse. Hoy cubre los dos desenlaces de "romper":
   *  - inmune: es una verdad del mundo (indestructible), se aprende como HECHO
   *    para no volver a estrellarse contra ello, y se ofrece un plan B según lo
   *    que el objeto permita (recogerlo, moverlo).
   *  - muy-duro se maneja aparte (no aquí): no es un final sino un "me falta una
   *    herramienta más fuerte", y el objetivo sigue vivo para fabricarla sola.
   */
  private reactToRequestFailure(
    reason: string,
    goal: Goal | undefined,
    perception: Perception,
  ): string | null {
    const kind = goal?.userRequest?.targetKind;
    if (!kind) return null;
    const article = kindWithArticle(kind);
    const capital = article.charAt(0).toUpperCase() + article.slice(1);

    // Lo que el mundo rechazó por una propiedad ESTABLE del objetivo no es un
    // tropiezo: es física, y se aprende. La diferencia importa — un "no llegué"
    // se reintenta, un "eso no se levanta" no se reintenta nunca más, y decir
    // las dos cosas igual la deja golpeando la misma pared.
    if (reason === 'no-pude-recogerlo' && this.lastWorldRefusal?.reason === 'not-portable') {
      const fact = this.memory.addFact(
        `${kindLabel(kind)} no se puede levantar con las manos`,
        this.tick,
        0.9,
      );
      this.emit('memory.created', { kind: 'fact', statement: fact.statement });
      // Y no se queda callada: nombra el obstáculo real y pide lo único que
      // podría destrabarlo. Que sepa QUÉ le falta es la mitad de inventarlo.
      return (
        `${capital} no se puede levantar con las manos, así que no puedo traértel${
          isFeminineKind(kind) ? 'a' : 'o'
        } así. ` +
        `Si algo pudiera contenerl${isFeminineKind(kind) ? 'a' : 'o'}, sí: ` +
        `decime con qué la junto y lo intento.`
      );
    }

    if (reason === 'objetivo-inmune') {
      this.memory.addFact(`${kindLabel(kind)} no se puede romper`, this.tick, 0.9);
      const portable = perception.visibleEntities.some(
        (e) => e.kind === kind && e.portable === true,
      );
      const it = isFeminineKind(kind) ? 'la' : 'lo';
      return portable
        ? `${capital} no se puede romper, pero puedo recoger${it} o llevar${it} a otro lado si querés.`
        : `${capital} no se puede romper, para mí es indestructible. ¿Querés que haga otra cosa?`;
    }

    return null;
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
      'sin-sitio': 'no encuentro un lugar despejado al que pueda llegar para levantarla',
      'no-pude-recogerlo': 'no pude recoger el objeto',
      'no-pude-comerlo': 'no pude comer el alimento',
      'no-pude-recoger-la-herramienta': 'no pude recoger la herramienta',
      'objetivo-resistió': 'el objeto resistió mis intentos',
      'objetivo-inmune': 'ese objeto no se puede romper, para mí es indestructible',
      'objetivo-muy-duro': 'mi herramienta no le hizo mella; haría falta algo más fuerte',
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
