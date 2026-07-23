import { AnimaAgent, GOAL_RESTORE_ENERGY } from '@anima/agent-core';
import type { AgentEvent } from '@anima/agent-core';
import type { CodexThought, ModelProvider } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import { countedKindLabel, kindLabel } from '@anima/shared';
import type {
  ActionIntent,
  Components,
  Perception,
  Recipe,
  SimEvent,
  WorldState,
} from '@anima/sim-core';
import {
  applyPrune,
  buildPerception,
  expandRecipeCost,
  getEntity,
  inBounds,
  isBlocked,
  planPrune,
  prunePlanSize,
  recipeProduct,
  recipeProductKinds,
  spawn,
  stepWorld,
  takeSnapshot,
  timeOfDay,
  visibleCells,
  workGlyphFor,
} from '@anima/sim-core';
import type { PrunePlan, PruneRef } from '@anima/sim-core';
import type { WorldSnapshot } from '@anima/sim-core';
import type { EvaluationCaseTrace } from '@anima/skill-evaluator';
import { RegressionStore, sampleSeeds } from '@anima/skill-evaluator';
import type { GameMap, MissionStatus } from '@anima/missions';
import { MissionTracker } from '@anima/missions';
import type { SkillOp, SkillRemovalPlan } from '@anima/skill-runtime';
import { describeCriterion, SkillLibrary } from '@anima/skill-runtime';
import { skillSubjects } from './skill-subjects.js';
import { humanReason } from './failure-reasons.js';
import {
  COLD_SCENARIOS,
  foodBehindWall,
  MVP_RECIPES,
  MVP_SCENARIOS,
  PRACTICE_SCENARIOS,
} from '@anima/test-scenarios';
import type { KeyValueStore, LegacyReport, PetIdentity, SessionSaveData } from '@anima/persistence';
import type { CatalogData } from '@anima/persistence';
import {
  appendLegacy,
  applySessionSave,
  catalogSize,
  clearCatalog,
  collectCatalog,
  emptyCatalog,
  forgetFromCatalog,
  loadCatalog,
  mergeCatalog,
  saveCatalog,
  seedWorldFromCatalog,
  buildLegacyReport,
  captureSession,
  clearSession,
  IncompatibleSaveError,
  loadLegacies,
  loadSession,
  mapSlot,
  MemoryKeyValueStore,
  saveSession,
  setAsideSave,
  successorIdentity,
  testimonyFromLegacy,
  WebStorageKeyValueStore,
} from '@anima/persistence';
import type {
  ChatEntry,
  DevEventView,
  DreamView,
  EntityTraits,
  ExperimentView,
  GameView,
  GoalView,
  BlueprintView,
  InteractionView,
  ItemIngredientView,
  ItemStat,
  ItemView,
  PruneLine,
  PrunePreview,
  PickupView,
  PlannedStructureView,
  SkillDevProgressView,
  SkillView,
  ThoughtView,
  VisionView,
} from './view.js';
import { buildClaudeReport, claudeReportFileName } from './claude-report.js';
import type { Lineage } from '../phaser/matter.js';
import { materialFor } from '../phaser/matter.js';

const BASE_TICKS_PER_SECOND = 4;

/**
 * El ciclo de día y noche del mundo principal, en ticks (ver `clock.ts` en
 * sim-core). El día dura más que la noche, como en la percepción real. Es lo
 * que hace que un pedido como "esperá hasta que amanezca" tenga un amanecer que
 * esperar: sin reloj, el mundo es de día siempre. Los mapas de entrenamiento no
 * llevan ciclo a propósito — son situaciones fijas, no el paso del tiempo.
 */
const MAIN_WORLD_CLOCK = {
  dayTicks: BASE_TICKS_PER_SECOND * 150, // 150 s de día a velocidad 1
  nightTicks: BASE_TICKS_PER_SECOND * 45, // 45 s de noche
};
/**
 * Presupuesto biológico de un pensamiento en vuelo (ADR 0040): cuántos ticks
 * puede costarle al cuerpo una consulta al modelo. Pasado el presupuesto, la
 * simulación se sostiene —la UI y el chat siguen vivos— hasta que la
 * respuesta llegue. Sin esta cota, la latencia del proveedor real se
 * convertía en inanición: una vida son 300 ticks y un solo ciclo de
 * desarrollo de habilidades puede tardar varios minutos de reloj.
 */
export const THINK_TICK_BUDGET = 20;
const SPEECH_VISIBLE_TICKS = 14;
/**
 * Ventana corta: la recogida es un acento, no un cartel que se queda. A
 * velocidad normal da para el vuelo del objeto y el rótulo que lo sigue.
 */
const PICKUP_VISIBLE_TICKS = 4;
const DEV_EVENT_LIMIT = 400;
const AUTOSAVE_EVERY_TICKS = 40;
const RECENT_ACTIONS_LIMIT = 12;
/** Historial de pensamientos que la pestaña Mente conserva. */
const THOUGHT_LIMIT = 30;
/** Mundos imaginados que se conservan para dibujar (el más nuevo primero). */
const DREAM_LIMIT = 12;
/** Cuántas duraciones por tipo de consulta se recuerdan para estimar. */
const AI_TIMING_SAMPLES = 5;

/**
 * Cada tipo de consulta al modelo, en voz humana: es lo que el jugador ve
 * mientras la mascota piensa. El kind crudo queda igual en la vista para
 * quien quiera la verdad técnica (y para los tests).
 */
const THOUGHT_LABELS: Record<string, string> = {
  'skill.propose': 'imaginando una habilidad nueva',
  'skill.revise': 'corrigiendo una habilidad que falló',
  // Una revisión no siempre corrige lo mismo. Cuando el programa ni se pudo
  // leer no falló ninguna prueba —no llegó a correr ninguna—, y contarlo como
  // fallo manda al cuidador a buscar un problema de estrategia que no existe.
  'skill.revise:invalid-program': 'reescribiendo una habilidad que le salió mal escrita',
  'skill.revise:repeated-program': 'buscando otra forma de encarar la habilidad',
  'skill.revise:evaluation-failed': 'corrigiendo una habilidad que falló',
  'interpret.signal': 'interpretando una señal del cuerpo',
  'interpret.command': 'entendiendo lo que le pediste',
  'skill.contract': 'acordando qué debería lograr',
  'distill.knowledge': 'destilando lo que aprendió',
  'judge.destruction': 'decidiendo si destruir está bien',
  'recipe.propose': 'inventando una receta',
  'entity.describe': 'imaginando el objeto descrito',
  'interaction.propose': 'imaginando una interacción nueva',
  'interaction.judge': 'juzgando una interacción',
  dialogue: 'buscando qué decir',
};

/** Cómo terminó un think(): con una intención (o ninguna) o con un error. */
type ThinkOutcome =
  { status: 'ok'; intent: ActionIntent | null } | { status: 'error'; error: unknown };

/**
 * Un pensamiento que perdió la carrera contra el tick (ADR 0039): quedó en
 * vuelo mientras el mundo sigue andando. `outcome` se llena cuando el modelo
 * responde; el tick que lo encuentre lleno lo consume y aplica la intención.
 */
interface PendingThink {
  outcome: ThinkOutcome | null;
  /** Cursor de eventos del agente al lanzar el think: de ahí se detecta si
   * este pensamiento atendió un mensaje del usuario (para guardar). */
  agentEventStart: number;
  /** Ticks que el cuerpo ya pagó por este pensamiento (ADR 0040): al llegar
   * a THINK_TICK_BUDGET la simulación se sostiene hasta la respuesta. */
  passiveTicks: number;
}

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
  /**
   * El mapa que se juega. Ausente = el mundo de siempre, sin misión: la vida
   * no es un nivel, y esa partida sigue siendo la partida principal.
   */
  map?: GameMap;
}

/**
 * Los topes de la mochila (ADR 0070). Abajo de 4 no le entra una fogata en
 * mano y fabricar se vuelve un ir y venir; se permite igual, porque estrangular
 * la mochila a propósito es una forma legítima de mirar cómo se las arregla.
 * Arriba de 20 deja de ser una restricción y el mundo pierde el problema.
 */
const MIN_BACKPACK = 1;
const MAX_BACKPACK = 20;

interface SessionUiState {
  chat: ChatEntry[];
  petColor: string;
  /** Si el mock propone primero sus ideas equivocadas (ADR 0006, adenda). */
  mockImperfect?: boolean;
  /** Modo creativo: el cuerpo siempre lleno (ADR 0061). */
  creativeMode?: boolean;
  /**
   * Cuántas manos le puso el cuidador (ADR 0070). Ausente = las que le dio el
   * mundo al nacer; no se guarda un 6 que nadie eligió, porque entonces un
   * cambio en el escenario no llegaría nunca a las partidas ya empezadas.
   */
  backpackSize?: number;
  /**
   * Las reglas de fábrica que el cuidador podó a propósito (ADR 0075).
   *
   * Hace falta porque `adoptNewWorldRules` vuelve a sembrar `MVP_RECIPES` en
   * cada carga —las recetas base son física del juego, no progreso de la
   * mascota, así que una partida vieja también las recibe— y sin esta
   * constancia resucitaría justo lo que se acaba de quitar. Es la única
   * excepción a "borra de verdad, no dejes tombstone": son ids de reglas del
   * CÓDIGO, un puñado de strings, y sin ellas la poda de lo de fábrica dura
   * hasta la próxima recarga.
   */
  prunedRules?: string[];
}

/**
 * En desarrollo, cualquier cambio en la sesión o debajo de ella (el agente,
 * el motor) recarga la página entera en vez de aplicarse en caliente.
 *
 * La sesión es un singleton de módulo que `main.tsx` crea una sola vez, y
 * `App.tsx` corta la propagación del Fast Refresh de React. Sin esto, editar
 * `agent.ts` redefine la clase pero deja VIVA la instancia anterior, con su
 * prototipo anterior: aparecen fantasmas del tipo «this.<método> is not a
 * function» por métodos que el fuente sí tiene, y esa pestaña queda rota para
 * siempre porque ninguna edición posterior fuerza una recarga. Un objeto vivo
 * no se puede parchear en caliente; lo honesto es empezar de nuevo.
 */
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}

/**
 * Avisos de sistema que hablan de UNA carga y hoy se marcan `ephemeral`. Los
 * guardados escritos antes de esa marca los traen adentro, así que se
 * reconocen por su texto al restaurar y se descartan.
 */
const STALE_NOTICE_PREFIXES = [
  'Sesión restaurada (tick ',
  'El proveedor de IA está fallando (',
  'Error interno de la aplicación (',
];

function defaultStore(): KeyValueStore {
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  return storage ? new WebStorageKeyValueStore(storage) : new MemoryKeyValueStore();
}

/**
 * Traducción de componentes a rasgos: la UI sabe QUÉ hace cada cosa sin
 * conocer el motor. Es lo que permite dibujar lo que Ánima inventa (o lo que
 * el cuidador describe), cuyo nombre no está en ninguna tabla nuestra.
 */
function traitsFromComponents(components: Components): EntityTraits {
  return {
    ...(components.heatSource ? { warm: true } : {}),
    ...(components.edible ? { edible: true } : {}),
    ...(components.tool ? { tool: true } : {}),
    ...(components.foodSource ? { growsFood: true } : {}),
    ...(components.hazard ? { dangerous: true } : {}),
    ...(components.portable ? { portable: true } : {}),
    ...(components.collider?.solid ? { solid: true } : {}),
  };
}

/** Un ingrediente para la vista: el tipo se conserva porque la UI lo dibuja. */
function ingredientView(kind: string, count: number): ItemIngredientView {
  return { kind, count, label: countedKindLabel(kind, count) };
}

/**
 * La cadena por la que se hereda el color: producto → primer ingrediente.
 *
 * Se arma acá y no en el dibujo porque las recetas viven acá. El dibujo solo
 * recibe el material ya resuelto, y así sigue siendo lógica pura que se puede
 * probar sin un mundo.
 */
function lineageOf(recipes: Recipe[]): Lineage {
  const chain = new Map<string, string>();
  for (const recipe of recipes) {
    const product = recipeProduct(recipe);
    const first = recipe.ingredients[0];
    if (product && first && !chain.has(product.kind)) chain.set(product.kind, first.kind);
  }
  return chain;
}

/**
 * Qué HACE lo descrito, en frases que el cuidador pueda juzgar antes del sí.
 *
 * Comer y el agua no estaban: la vista previa de una receta nunca los nombra
 * porque ninguna de las dos cosas se puede inventar (la puerta del mundo
 * prohíbe `edible`, y el agua es terreno, no un producto). El catálogo, en
 * cambio, muestra lo que el mundo ya tiene, y ahí callarlos era mentir por
 * omisión: el alimento decía solo «se puede llevar».
 */
function describeComponents(components: Components): string[] {
  const does: string[] = [];
  if (components.heatSource) does.push('da calor');
  if (components.shelter) does.push('detiene la pérdida de calor');
  if (components.hazard) does.push('daña a quien se le meta encima');
  if (components.edible) does.push('se puede comer');
  if (components.tool) does.push('sirve de herramienta');
  if (components.water) does.push('no se puede atravesar');
  if (components.collider?.solid) does.push('bloquea el paso');
  if (components.portable) does.push('se puede llevar');
  if (components.durability) does.push('se puede romper');
  return does;
}

/** Dos decimales como mucho: el mundo no distingue más y el número se lee. */
function round2(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * El número que caracteriza a un tipo, mirando TODOS sus ejemplares. La
 * calidad hace que dos fogatas no sean la misma fogata, así que cuando
 * difieren el catálogo muestra el rango: elegir una y callar la otra sería
 * describir un mundo que no es el que está en pantalla.
 */
function statRange(
  instances: Components[],
  pick: (components: Components) => number | undefined,
): string | null {
  const values = instances.map(pick).filter((value): value is number => value !== undefined);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? round2(min) : `${round2(min)}–${round2(max)}`;
}

/** Los números de un tipo. Lo que no tiene el componente no da fila. */
function itemStats(instances: Components[]): ItemStat[] {
  const stats: ItemStat[] = [];

  const warmth = statRange(instances, (c) => c.heatSource?.warmthPerTick);
  if (warmth !== null) {
    const reach = statRange(instances, (c) => c.heatSource?.range) ?? '?';
    stats.push({ label: 'Calor', value: `${warmth} por tick · alcance ${reach}` });
  }
  const shelterReach = statRange(instances, (c) => c.shelter?.range);
  if (shelterReach !== null) stats.push({ label: 'Refugio', value: `alcance ${shelterReach}` });

  const damage = statRange(instances, (c) => c.hazard?.damagePerTick);
  if (damage !== null) stats.push({ label: 'Daño al tocarlo', value: `${damage} por tick` });

  const nutrition = statRange(instances, (c) => c.nutrition?.value);
  if (nutrition !== null) stats.push({ label: 'Alimenta', value: `${nutrition} de energía` });

  const power = statRange(instances, (c) => c.tool?.power);
  if (power !== null) stats.push({ label: 'Herramienta', value: `poder ${power}` });

  const hardness = statRange(instances, (c) => c.hardness?.value);
  if (hardness !== null) stats.push({ label: 'Dureza', value: hardness });

  const durability = statRange(instances, (c) => c.durability?.current);
  if (durability !== null) {
    const max = statRange(instances, (c) => c.durability?.max) ?? '?';
    stats.push({ label: 'Resistencia', value: `${durability} de ${max}` });
  }

  const produces = new Set<string>();
  for (const components of instances) {
    const food = components.foodSource;
    if (food) produces.add(`alimento cada ${food.intervalTicks} ticks`);
    const item = components.itemSource;
    if (item) produces.add(`${kindLabel(item.output.kind)} cada ${item.intervalTicks} ticks`);
  }
  if (produces.size > 0) stats.push({ label: 'Produce', value: [...produces].join(' · ') });

  const drops = instances.find((c) => c.drops?.length)?.drops ?? [];
  if (drops.length > 0) {
    const byKind = new Map<string, number>();
    for (const drop of drops) byKind.set(drop.kind, (byKind.get(drop.kind) ?? 0) + 1);
    stats.push({
      label: 'Deja al romperse',
      value: [...byKind].map(([kind, count]) => countedKindLabel(kind, count)).join(' + '),
    });
  }
  return stats;
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
  /** Pensamientos en vivo del modelo real (efímeros, no se guardan). */
  private thoughts: ThoughtView[] = [];
  /** Mundos imaginados durante las evaluaciones (efímeros, no se guardan). */
  private dreams: DreamView[] = [];
  /** El ciclo de desarrollo de habilidad en curso, derivado de sus eventos. */
  private skillDev: SkillDevProgressView | null = null;
  /** La consulta al modelo real en vuelo: tipo y arranque (Date.now()). */
  private queryWait: { kind: string; startedAtMs: number } | null = null;
  /** Duraciones recientes por tipo de consulta (ms): base de la estimación. */
  private aiTimings = new Map<string, number[]>();
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
  private lastPickup: PickupView | null = null;
  /** Última interacción de postura (encima/debajo): mientras la mascota siga
   * en la celda del objeto, el dibujo respeta quién está arriba de quién. */
  private lastMount: { targetId: string; mode: 'on-top' | 'underneath' } | null = null;
  private lastAction: string | null = null;
  private recentActions: string[] = [];
  private deathReport: LegacyReport | null = null;
  private legacyCount = 0;
  private storyWasCompleted = false;

  private consecutiveThinkErrors = 0;
  /**
   * Pensamiento en vuelo (ADR 0039). Mientras exista, cada tick avanza el
   * mundo sin acción de la mascota: pensar no congela la física ni la UI. La
   * enorme mayoría de los ticks no lo usan — un think local resuelve en
   * microtareas y gana la carrera del tick; solo una consulta real al modelo
   * queda en vuelo.
   */
  private pendingThink: PendingThink | null = null;
  /**
   * Ticks de mundo que el cuerpo ya pagó por la práctica de habilidad en
   * segundo plano (ADR 0043). Mismo presupuesto biológico que un pensamiento
   * en vuelo (ADR 0040): mientras dura el crédito ella vive con normalidad
   * (chatea, se mueve, atiende otros objetivos); agotado, el tiempo se
   * sostiene hasta el veredicto.
   */
  private devPassiveTicks = 0;
  /** Mundo previo al último think: origen de las regresiones de uso real. */
  private preThinkSnapshot: WorldSnapshot | null = null;
  private activeSkillRun: { skillName: string; snapshot: WorldSnapshot | null } | null = null;
  private running = false;
  private speed = 1;
  private seed = 5;
  /** El mapa jugado, si esta partida es un mapa con misión. */
  private readonly map: GameMap | null;
  /**
   * Ranura de guardado. Cada entrenamiento tiene la suya: son mundos distintos
   * y compartir la ranura con la partida principal borraba la mascota del
   * cuidador al abrir un mapa.
   */
  private readonly slot: string | undefined;
  /** El juez de la misión: mira el mundo, nunca lo que ella dice. */
  private missionTracker: MissionTracker | null = null;
  private missionStatus: MissionStatus | null = null;
  /** El planteo del mapa se dice UNA vez, por el chat, como cualquier encargo. */
  private missionBriefingSent = false;
  /** Hasta dónde leyó el juez los eventos del agente. */
  private missionAgentCursor = 0;
  private petColor = '#f59e0b';
  /**
   * Respuestas tontas del simulado (ADR 0006): encendidas por defecto — el
   * ciclo fallar→corregir ES la historia. Apagarlas es un modo de observación.
   */
  private mockImperfect = true;
  /**
   * Modo creativo (ADR 0061): el cuerpo se mantiene lleno. Apagado por
   * defecto — el cuerpo que se vacía ES el motor de su autonomía, y encenderlo
   * de fábrica volvería decorativas la mitad de sus conductas.
   */
  private creativeMode = false;
  /** Mostrar hasta dónde ve. Apagado por defecto: es una lente, no el tablero. */
  private visionShown = false;
  /**
   * La poda pedida y todavía sin confirmar (ADR 0075). Guarda el plan además
   * de lo que se muestra: al confirmar se aplica lo que se leyó, no un cálculo
   * nuevo. Nunca se guarda en el save — una pregunta a medio contestar no es
   * estado de la partida.
   */
  /**
   * Ids de reglas del código que el cuidador podó (ADR 0075). Es del cuidador
   * y no del mundo: sobrevive al guardado igual que la mochila o el color, y
   * por eso viaja en `ui` y no en el snapshot.
   */
  private prunedRules = new Set<string>();
  /**
   * El catálogo del cuidador (ADR 0076): lo aprendido, que vive fuera de toda
   * partida. Se lee una vez al arrancar y se mantiene en memoria porque hace
   * falta sincrónicamente al nacer un mundo — `reset` sale de un submit y no
   * puede esperar una lectura de red.
   */
  private catalog: CatalogData = emptyCatalog();
  private pendingPrune:
    | { kind: 'world'; plan: PrunePlan; preview: PrunePreview }
    | { kind: 'skill'; plan: SkillRemovalPlan; preview: PrunePreview }
    | null = null;
  /**
   * Manos que le puso el cuidador (ADR 0070), o null si todavía no tocó la
   * perilla y las que valen son las del mundo.
   *
   * Es null y no 6 a propósito. El 6 es del escenario (`spawnPet`), que lo
   * eligió con un motivo —una fogata son 3 objetos en mano más la herramienta,
   * y con 4 juntar ingredientes era soltar cosas—. Copiarlo acá lo duplicaría:
   * el día que el escenario cambie de idea, las partidas guardadas seguirían
   * arrastrando el número viejo sin que nadie lo haya pedido.
   */
  private backpackSize: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Paso en vuelo. Un stepOnce concurrente no se descarta: espera a que este
   * termine. Descartar (el candado booleano de antes) hacía que los llamados
   * que coincidían con un paso lento contaran como ticks perdidos.
   */
  private stepPromise: Promise<void> | null = null;
  private disposed = false;

  private constructor(options: SessionOptions) {
    this.store = options.store ?? defaultStore();
    if (options.speed !== undefined) this.speed = options.speed;
    if (options.petColor !== undefined) this.petColor = options.petColor;
    if (options.provider !== undefined) this.externalProvider = options.provider;
    this.map = options.map ?? null;
    this.slot = options.map ? mapSlot(options.map.id) : undefined;
    this.seed = options.seed ?? 5;
  }

  /** Crea la sesión: restaura el guardado si existe (salvo `fresh`). */
  static async create(options: SessionOptions = {}): Promise<GameSession> {
    const session = new GameSession(options);
    if (options.fresh) {
      await clearSession(session.store, session.slot);
    }
    // Un guardado de otra versión no es "no hay guardado": se aparta (no se
    // pisa con el autoguardado siguiente) y se dice, porque lo que se pierde
    // de vista es la partida del cuidador y él tiene que enterarse.
    let saved: SessionSaveData | null = null;
    let setAside = false;
    if (!options.fresh) {
      try {
        saved = await loadSession(session.store, session.slot);
      } catch (error) {
        if (!(error instanceof IncompatibleSaveError)) throw error;
        await setAsideSave(session.store, session.slot);
        setAside = true;
      }
    }
    // El catálogo se lee antes de que exista ningún mundo (ADR 0076): la
    // mascota nueva tiene que nacer sabiendo, no enterarse un tick después.
    // Un catálogo ilegible se lee vacío, así que jamás impide arrancar.
    session.catalog = options.fresh ? emptyCatalog() : await loadCatalog(session.store);
    if (saved) {
      session.buildFreshRuntime(saved.seed);
      session.applySave(saved);
    } else {
      session.resetToNewPet(session.seed);
    }
    if (setAside) {
      session.say({
        from: 'system',
        text: 'Tu partida anterior está guardada en un formato que esta versión de Ánima no sabe leer. No la borré: quedó apartada. Esta mascota empieza de cero.',
        tick: session.world.tick,
      });
    }
    // Lo inventado que quedó sin cara vuelve a la cola de dibujos (ADR 0064):
    // vale tanto para lo que se perdió al recargar como para lo que su mundo
    // heredó ya inventado de una antecesora.
    session.agent.requestGlyphsFor(session.undrawnInventedKinds());
    session.legacyCount = (await loadLegacies(session.store)).length;
    session.rebuildView();
    if (options.autostart !== false && !session.deathReport) session.start();
    return session;
  }

  // ---- chat -----------------------------------------------------------------

  /**
   * Dice algo en el chat, sellando la hora de reloj.
   *
   * Todo lo que entra a la conversación pasa por acá y no por `chat.push`
   * directo: el sello tiene que ser el instante en que se dijo, y con doce
   * lugares distintos empujando mensajes alcanzaba con olvidarse en uno para
   * que ese quedara sin hora para siempre.
   */
  private say(entry: Omit<ChatEntry, 'at'>): void {
    this.chat.push({ ...entry, at: Date.now() });
  }

  /** Lo mismo para los arranques, que arman la conversación de cero. */
  private stamped(entries: Omit<ChatEntry, 'at'>[]): ChatEntry[] {
    const at = Date.now();
    return entries.map((entry) => ({ ...entry, at }));
  }

  // ---- ciclo de vida --------------------------------------------------------

  /** Mundo, agente y biblioteca nuevos. No toca identidad ni chat. */
  private buildFreshRuntime(seed: number): void {
    this.seed = seed;
    // La poda muere con el mundo que se podó (ADR 0075). Va acá y no en
    // `resetToNewPet` porque este es el único lugar donde nace un mundo, y
    // nacen por dos caminos: reiniciar y morirse. Al restaurar un guardado
    // esto corre primero y `applySave` vuelve a poner lo que el cuidador podó.
    this.prunedRules.clear();
    this.pendingPrune = null;
    // El mapa manda si esta partida es un mapa; si no, el mundo de siempre.
    const bundle = this.map ? this.map.build(seed) : foodBehindWall.build(seed);
    this.world = bundle.world;
    // El mundo principal tiene día y noche; los mapas de entrenamiento no. Va
    // sobre el mundo recién nacido (los guardados restauran su propio reloj).
    if (!this.map && !this.world.clock) this.world.clock = { ...MAIN_WORLD_CLOCK };
    this.missionTracker = this.map
      ? new MissionTracker(this.map.mission, this.world, bundle.petId)
      : null;
    this.missionStatus = this.missionTracker?.evaluate(this.world) ?? null;
    this.missionBriefingSent = false;
    this.missionAgentCursor = 0;
    this.provider = this.externalProvider ?? new MockModelProvider();
    if (this.provider instanceof MockModelProvider) {
      this.provider.setImperfect(this.mockImperfect);
    }
    this.library = new SkillLibrary();
    this.regressions = new RegressionStore();
    this.agent = new AnimaAgent({
      petId: bundle.petId,
      petName: this.identity.name,
      // El agente consulta a través de la envoltura de medición: cada llamada
      // deja su duración en los eventos Dev. `this.provider` sigue crudo para
      // la vista y los interruptores del mock.
      provider: this.instrumentProvider(this.provider),
      library: this.library,
      regressions: this.regressions,
      evaluationScenarios: MVP_SCENARIOS,
      practiceScenarios: PRACTICE_SCENARIOS,
      warmthScenarios: COLD_SCENARIOS,
      // La grilla sale de la semilla de la partida: cada mundo evalúa en sus
      // propios mundos imaginados, no en tres números escritos a mano.
      evaluationSeeds: sampleSeeds(seed),
      guidanceEnabled: true,
      // Cada mundo imaginado durante una evaluación llega como traza: la UI
      // los dibuja como "sueños" mientras ella piensa (son las evaluaciones
      // reales, no una animación inventada).
      onEvaluationCase: (trace) => this.noteDream(trace),
    });
    this.devEvents = [];
    this.devSeq = 0;
    this.agentEventCursor = 0;
    this.lastSpeech = null;
    this.lastPickup = null;
    this.lastMount = null;
    this.lastAction = null;
    this.recentActions = [];
    this.deathReport = null;
    this.storyWasCompleted = false;
    this.dreams = [];
    this.skillDev = null;
    this.queryWait = null;
    // Un pensamiento en vuelo de la vida anterior no puede actuar sobre esta:
    // al soltar la referencia, su resolución tardía cae al vacío.
    this.pendingThink = null;
    // La mochila que eligió el cuidador es suya, no de esta mascota: sobrevive
    // a la muerte y al reinicio, como el color (ADR 0070). Va acá, después de
    // que el mundo nuevo ya fabricó la mascota con la capacidad del escenario.
    this.applyBackpackSize();
  }

  /**
   * Cuánto suele tardar una consulta de este tipo, según esta sesión: la
   * mediana de las últimas duraciones que terminaron bien. null sin datos —
   * mejor no prometer nada que inventar un número.
   */
  private expectedMsFor(kind: string): number | null {
    const samples = this.aiTimings.get(kind);
    if (!samples || samples.length === 0) return null;
    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? null;
    // Menos de un segundo (el mock, una respuesta cacheada) no es una espera:
    // prometer "~0:00" es ruido, mejor callar hasta tener una medición real.
    return median !== null && median >= 1000 ? median : null;
  }

  /** Guarda un mundo imaginado (el más nuevo primero), con tope. */
  private noteDream(trace: EvaluationCaseTrace): void {
    this.dreams.unshift({
      id: `${trace.skillName}@${trace.version}:${trace.scenario}:${trace.seed}`,
      ...trace,
    });
    if (this.dreams.length > DREAM_LIMIT) this.dreams.length = DREAM_LIMIT;
    // Sin notify: los sueños llegan en ráfaga sincrónica dentro de un think;
    // el próximo tick (o la próxima ingesta durante la espera) los publica.
  }

  /**
   * Envoltura de medición (ADR 0039): cada consulta al modelo deja un evento
   * Dev `ai.timing` con su tipo, duración y resultado. Es el dato que decide
   * qué optimizar — sin él, cualquier mejora de latencia es a ciegas.
   */
  private instrumentProvider(provider: ModelProvider): ModelProvider {
    const record = (kind: string, startedAt: number, ok: boolean): void => {
      const ms = Math.round(performance.now() - startedAt);
      this.pushDev('agent', {
        type: 'ai.timing',
        tick: this.world.tick,
        data: { kind, ms, ok },
      });
      // Las duraciones que terminaron bien alimentan la estimación de "cuánto
      // suele tardar" que la UI muestra durante la espera.
      if (ok) {
        const samples = this.aiTimings.get(kind) ?? [];
        samples.push(ms);
        if (samples.length > AI_TIMING_SAMPLES) samples.shift();
        this.aiTimings.set(kind, samples);
      }
    };
    return {
      get name() {
        return provider.name;
      },
      get interpretsLanguage() {
        return provider.interpretsLanguage;
      },
      callCount: (kind) => provider.callCount(kind),
      complete: async (request) => {
        const startedAt = performance.now();
        try {
          const response = await provider.complete(request);
          record(request.kind, startedAt, true);
          return response;
        } catch (error) {
          record(request.kind, startedAt, false);
          throw error;
        }
      },
    };
  }

  private resetToNewPet(seed: number, options: { fromCatalog?: boolean } = {}): void {
    this.identity = newIdentity('Ánima');
    this.buildFreshRuntime(seed);
    const adopted = options.fromCatalog === false ? 0 : this.applyCatalogToNewWorld();
    this.chat = this.stamped([
      { from: 'system', text: `Mundo creado (semilla ${seed}). La energía irá bajando…`, tick: 0 },
      ...(adopted > 0
        ? [
            {
              from: 'system' as const,
              text: `Nace sabiendo lo que guardaste: ${adopted} ${adopted === 1 ? 'cosa' : 'cosas'} del catálogo. Las conductas entran a prueba y tienen que volver a rendir en este mundo.`,
              tick: 0,
            },
          ]
        : []),
      {
        from: 'system',
        text: 'Hablá con ella cuando quieras: pedile cosas, enseñale hechos del mundo o preguntale qué hace.',
        tick: 0,
      },
    ]);
    this.rebuildView();
    this.notify();
  }

  /**
   * Vuelca el catálogo del cuidador sobre el mundo recién nacido (ADR 0076).
   * Devuelve cuántas cosas entraron, para poder decirlo.
   *
   * Las reglas se copian; las habilidades NO. Una conducta estable en otro
   * mundo entra acá como candidata y se vuelve a rendir —`adoptCatalogSkills`
   * usa la misma maquinaria que el legado (ADR 0047/0030)—: el catálogo guarda
   * lo aprendido, no una licencia para saltearse el examen.
   */
  private applyCatalogToNewWorld(): number {
    seedWorldFromCatalog(this.world, this.catalog);
    if (this.catalog.skills.length > 0) {
      this.agent.adoptCatalogSkills(this.catalog.skills);
      this.ingestAgentEvents();
    }
    return catalogSize(this.catalog);
  }

  /**
   * Las recetas son reglas del mundo, no progreso de la mascota: cuando el
   * juego aprende física nueva, una partida vieja también la recibe. Sin esto,
   * un guardado anterior a las recetas quedaba congelado sin ninguna —el mundo
   * se creaba de nuevo con ellas, pero el snapshot restaurado las pisaba— y la
   * mascota respondía, con razón, que su mundo no admite construir nada.
   *
   * Lo que NO se toca es lo que ella inventó (ADR 0018): eso sí es suyo, y por
   * eso el merge es por id y nunca reemplaza la lista.
   */
  private adoptNewWorldRules(): void {
    const known = new Set(this.world.recipes.map((recipe) => recipe.id));
    for (const recipe of MVP_RECIPES) {
      // Lo que el cuidador podó no vuelve (ADR 0075). Sin esta guarda, quitar
      // una receta de fábrica duraba hasta la próxima carga: esta función la
      // volvía a sembrar por no encontrarla, que es exactamente su trabajo.
      if (this.prunedRules.has(recipe.id)) continue;
      if (!known.has(recipe.id)) this.world.recipes.push(structuredClone(recipe));
    }
    // El frío también es física nueva: una mascota guardada antes de que
    // existiera nace sin sentirlo. Se lo damos cómodo (al máximo), así el frío
    // llega como segundo acto y no la castiga por haberse guardado temprano.
    const pet = getEntity(this.world, this.agent.petId);
    if (pet && !pet.components.dead && !pet.components.temperature) {
      pet.components.temperature = { current: 50, max: 50, lossPerTick: 0.04 };
    }
  }

  /**
   * Las reglas de construcción que la antecesora dejó en su mundo pasan al de
   * la sucesora (ADR 0047). Merge por id y nunca reemplazo, igual que
   * `adoptNewWorldRules`: el mundo nuevo ya trae las reglas base del juego, así
   * que lo único que entra por acá es lo que ella consiguió que su mundo
   * aceptara. Los legados anteriores al ADR no traen las listas y se leen igual.
   */
  private inheritWorldRules(legacy: LegacyReport): void {
    // No consulta lo podado a propósito: `buildFreshRuntime` acaba de limpiarlo
    // (ADR 0075). Una generación nueva hereda TODO lo que su antecesora
    // consiguió que el mundo admitiera, incluso lo que el cuidador le había
    // quitado a la anterior — la poda valía para aquel mundo, no para este.
    const knownRecipes = new Set(this.world.recipes.map((r) => r.id));
    for (const recipe of legacy.worldRecipes ?? []) {
      if (!knownRecipes.has(recipe.id)) this.world.recipes.push(structuredClone(recipe));
    }
    const knownBlueprints = new Set(this.world.blueprints.map((b) => b.id));
    for (const blueprint of legacy.worldBlueprints ?? []) {
      if (!knownBlueprints.has(blueprint.id)) {
        this.world.blueprints.push(structuredClone(blueprint));
      }
    }
  }

  /**
   * Mundo nuevo. Por defecto nace con el catálogo puesto (ADR 0076);
   * `fromCatalog: false` es el «empezar de cero» del cuidador, para mirar cómo
   * se las arregla una mascota sin nada heredado.
   *
   * Empezar de cero NO borra el catálogo: lo ignora para este mundo. Borrarlo
   * es otra decisión y tiene su propio botón.
   */
  reset(seed: number, options: { fromCatalog?: boolean } = {}): void {
    this.resetToNewPet(seed, options);
    void this.save();
  }

  /** Tira el catálogo entero. Lo aprendido en la partida en curso vuelve a entrar al guardar. */
  async forgetCatalog(): Promise<void> {
    this.catalog = emptyCatalog();
    await clearCatalog(this.store);
    this.rebuildView();
    this.notify();
  }

  /** Borra el guardado y arranca una mascota nueva de generación 1. */
  async restartFresh(): Promise<void> {
    await clearSession(this.store, this.slot);
    this.resetToNewPet(this.seed);
    this.start();
    await this.save();
  }

  private applySave(data: SessionSaveData): void {
    this.identity = structuredClone(data.identity);
    // El agente se construyó antes de conocer el guardado: su nombre es el de
    // fábrica. Sin esto, tras recargar hablaría como "Ánima" aunque el
    // cuidador la haya bautizado (el bautismo ya vive en su memoria).
    this.agent.setName(this.identity.name);
    this.world = applySessionSave(data, {
      agent: this.agent,
      library: this.library,
      regressions: this.regressions,
    });
    const ui = data.ui as Partial<SessionUiState> | undefined;
    // Se lee ANTES de adoptar las reglas nuevas y el orden no es casual:
    // `adoptNewWorldRules` siembra lo que falte de `MVP_RECIPES`, así que si
    // todavía no sabe qué podó el cuidador, resucita justo eso (ADR 0075).
    this.prunedRules = new Set(ui?.prunedRules ?? []);
    this.adoptNewWorldRules();
    // Los guardados viejos traen avisos que hoy son efímeros pero antes se
    // persistían: uno de restauración por cada recarga, y los de pausa por
    // error. Se barren acá. Los de error son los peores: apuntan al registro
    // técnico, que vive en memoria, así que un fallo de hace horas reaparecía
    // en cada carga como si estuviera pasando ahora.
    this.chat = (ui?.chat ?? []).filter(
      (entry) =>
        !(
          entry.from === 'system' &&
          STALE_NOTICE_PREFIXES.some((prefix) => entry.text.startsWith(prefix))
        ),
    );
    if (ui?.petColor !== undefined) this.petColor = ui.petColor;
    if (ui?.creativeMode !== undefined) this.creativeMode = ui.creativeMode;
    // El mundo restaurado trae SU capacidad dentro del snapshot de la entidad;
    // la perilla del cuidador vuelve a caer encima (ADR 0070).
    if (ui?.backpackSize !== undefined) {
      this.backpackSize = ui.backpackSize;
      this.applyBackpackSize();
    }
    if (ui?.mockImperfect !== undefined) {
      this.mockImperfect = ui.mockImperfect;
      if (this.provider instanceof MockModelProvider) {
        this.provider.setImperfect(this.mockImperfect);
      }
    }
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
    // La orden en curso sobrevive al guardado (vive en las metas del agente);
    // decirlo evita que la recarga parezca amnesia: "¿y la silla?" tiene
    // respuesta porque la silla sigue pendiente.
    const pendingGoal = this.agent.goals
      .all()
      .find(
        (goal) =>
          goal.status === 'active' &&
          ((goal.source === 'user-request' && goal.userRequest) ||
            (goal.source === 'learning' && goal.learning)),
      );
    const pendingNote = pendingGoal
      ? ` Sigo con lo pendiente: "${pendingGoal.userRequest?.raw ?? pendingGoal.learning?.raw ?? pendingGoal.description}".`
      : '';
    this.say({
      from: 'system',
      text: `Sesión restaurada (tick ${this.world.tick}).${pendingNote}`,
      tick: this.world.tick,
      // Habla de esta carga, no de la historia: se muestra y se descarta al
      // guardar. Persistirlo hacía que cada recarga apilara un aviso más.
      ephemeral: true,
    });
  }

  /**
   * Suma al catálogo lo que este mundo aprendió (ADR 0076). Va pegado al
   * guardado y no en un momento propio: lo aprendido y la partida tienen que
   * quedar firmes juntos, o una recarga podría encontrar un catálogo que
   * promete algo que la partida todavía no vivió.
   *
   * Solo suma. Sacar del catálogo es un acto explícito —podar o vaciarlo—,
   * nunca un efecto de haber jugado en un mundo que no tenía algo: si no,
   * abrir una partida vieja y guardar borraría lo que otra partida aportó.
   */
  private async publishCatalog(): Promise<void> {
    const mine = collectCatalog({
      world: this.world,
      library: this.library,
      baseRecipeIds: MVP_RECIPES.map((recipe) => recipe.id),
    });
    const merged = mergeCatalog(this.catalog, mine);
    this.catalog = merged;
    await saveCatalog(this.store, merged);
  }

  async save(): Promise<void> {
    const data = captureSession({
      seed: this.seed,
      identity: this.identity,
      world: this.world,
      agent: this.agent,
      library: this.library,
      regressions: this.regressions,
      ui: {
        // Los avisos de esta carga no son conversación: se van acá.
        chat: this.chat.filter((entry) => !entry.ephemeral),
        petColor: this.petColor,
        mockImperfect: this.mockImperfect,
        creativeMode: this.creativeMode,
        ...(this.backpackSize === null ? {} : { backpackSize: this.backpackSize }),
        ...(this.prunedRules.size === 0 ? {} : { prunedRules: [...this.prunedRules] }),
      } satisfies SessionUiState,
      now: () => new Date().toISOString(),
    });
    try {
      await saveSession(this.store, data, this.slot);
      await this.publishCatalog();
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

  /**
   * El planteo del mapa entra por el chat, como cualquier cosa que diga el
   * cuidador. No hay canal privilegiado: si el encargo no se entiende por la
   * misma vía por la que se entiende "traé un tronco", el problema es del
   * sistema y tiene que verse.
   */
  private sendMissionBriefing(): void {
    if (!this.map || this.missionBriefingSent) return;
    this.missionBriefingSent = true;
    this.say({
      from: 'user',
      text: this.map.mission.briefing,
      tick: this.world.tick,
    });
    this.agent.receiveUserMessage(this.map.mission.briefing);
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    // El planteo se dice al arrancar, no al construir el mundo: en pausa, el
    // cuidador ve el mapa antes de que ella empiece a moverse.
    this.sendMissionBriefing();
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

  /**
   * Deja el cuerpo lleno: energía, salud y calor al máximo (ADR 0061).
   *
   * No apaga el desgaste del mundo —el mundo sigue siendo el mundo— sino que
   * la repone. La diferencia importa: los eventos de daño y de frío se emiten
   * igual, así que sus reflejos (apartarse del fuego) siguen funcionando; lo
   * que no llega a pasar es que la carencia se vuelva urgencia.
   */
  private topUpVitals(): void {
    if (!this.creativeMode) return;
    const pet = getEntity(this.world, this.agent.petId);
    if (!pet || pet.components.dead) return;
    const { energy, health, temperature } = pet.components;
    if (energy) energy.current = energy.max;
    if (health) health.current = health.max;
    if (temperature) temperature.current = temperature.max;
  }

  /**
   * Enciende o apaga el modo creativo (ADR 0061). Al encenderlo repone en el
   * acto: esperar al próximo tick dejaría las barras a medias justo cuando el
   * cuidador acaba de pedir que estén llenas.
   */
  setCreativeMode(value: boolean): void {
    if (this.creativeMode === value) return;
    this.creativeMode = value;
    this.topUpVitals();
    this.rebuildView();
    this.notify();
    void this.save();
  }

  /**
   * Enciende o apaga el dibujo de su vista.
   *
   * No se guarda con la partida: es una lente para mirar un rato, como abrir
   * el capó, y no una preferencia sobre cómo se juega. Que reaparezca sola en
   * la próxima sesión sería dejar el capó abierto.
   */
  setVisionShown(value: boolean): void {
    if (this.visionShown === value) return;
    this.visionShown = value;
    this.rebuildView();
    this.notify();
  }

  /**
   * Le cambia el tamaño de la mochila, en vivo (ADR 0070).
   *
   * **Achicar no le tira nada al piso.** Si venía cargada por encima del tope
   * nuevo, se queda con lo que lleva y deja de poder levantar más hasta que
   * baje sola: soltar en su nombre inventaría un montón de cosas en el suelo
   * que ella no decidió soltar, en un lugar que nadie eligió, y encima podría
   * romperle el objetivo en curso. El motor ya se comporta así —`resolvePickup`
   * compara `items.length >= capacity`—, así que el exceso se drena solo a
   * medida que fabrica o coloca.
   */
  setBackpackSize(value: number): void {
    const size = Math.max(MIN_BACKPACK, Math.min(MAX_BACKPACK, Math.round(value)));
    if (this.backpackSize === size) return;
    this.backpackSize = size;
    this.applyBackpackSize();
    this.rebuildView();
    this.notify();
    void this.save();
  }

  /**
   * Vuelca la perilla sobre la mascota viva. Se llama en cada punto donde
   * aparece una mascota que la sesión no fabricó en este instante —al restaurar
   * un guardado y al nacer una nueva—, porque en los dos casos la capacidad
   * viene del mundo y pisaría la que el cuidador eligió.
   */
  private applyBackpackSize(): void {
    if (this.backpackSize === null) return;
    const pet = getEntity(this.world, this.agent.petId);
    const inventory = pet?.components.inventory;
    if (!inventory) return;
    inventory.capacity = this.backpackSize;
  }

  /**
   * Enciende o apaga las respuestas tontas del proveedor simulado, en vivo.
   * Solo tiene efecto con el mock: con Codex el interruptor ni se muestra.
   */
  setMockImperfect(value: boolean): void {
    this.mockImperfect = value;
    if (this.provider instanceof MockModelProvider) {
      this.provider.setImperfect(value);
    }
    this.rebuildView();
    this.notify();
    void this.save();
  }

  /** Señal externa de "el modelo está pensando" (proveedores lentos). */
  setAiBusy(busy: boolean): void {
    if (this.aiBusy === busy) return;
    this.aiBusy = busy;
    this.rebuildView();
    this.notify();
  }

  /**
   * Pensamiento en vivo del proveedor real (hook onThought de Codex): cada
   * evento actualiza o abre la entrada de esa consulta. Es efímero a
   * propósito — no se guarda ni sobrevive a la recarga, igual que aiBusy.
   */
  noteAiThought(thought: CodexThought): void {
    const existing = this.thoughts.find((entry) => entry.seq === thought.seq);
    // La espera visible sigue a la consulta en vuelo: arranca con `start` y
    // se apaga con su cierre (`done`/`error`), llegue en el orden que llegue.
    if (thought.event === 'start') {
      this.queryWait = { kind: thought.kind, startedAtMs: Date.now() };
    } else if (thought.event === 'done' || thought.event === 'error') {
      if (this.queryWait?.kind === thought.kind) this.queryWait = null;
    }
    switch (thought.event) {
      case 'start':
        if (existing) break;
        this.thoughts.push({
          seq: thought.seq,
          kind: thought.kind,
          // El matiz gana sobre el tipo: dos revisiones distintas no se
          // cuentan igual. Sin matiz, la etiqueta de siempre.
          label:
            (thought.detail !== undefined
              ? THOUGHT_LABELS[`${thought.kind}:${thought.detail}`]
              : undefined) ??
            THOUGHT_LABELS[thought.kind] ??
            'pensando',
          reasoning: [],
          answer: null,
          status: 'thinking',
          error: null,
          tick: this.world.tick,
        });
        if (this.thoughts.length > THOUGHT_LIMIT) {
          this.thoughts.splice(0, this.thoughts.length - THOUGHT_LIMIT);
        }
        break;
      case 'reasoning':
        // Un reintento interno (nivel de razonamiento rechazado) puede
        // repetir titulares: se ignoran los duplicados consecutivos.
        if (existing && existing.reasoning.at(-1) !== thought.text) {
          existing.reasoning.push(thought.text);
        }
        break;
      case 'answer':
        if (existing) existing.answer = thought.text;
        break;
      case 'done':
        if (existing) existing.status = 'done';
        break;
      case 'error':
        if (existing) {
          existing.status = 'error';
          existing.error = thought.message;
        }
        break;
    }
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
    this.timer = setTimeout(
      () => {
        void this.stepOnce().then(() => this.scheduleNext());
      },
      1000 / (BASE_TICKS_PER_SECOND * this.speed),
    );
  }

  /**
   * Avanza exactamente un tick de simulación (usable también en pausa).
   *
   * El mundo no espera al modelo (ADR 0039): un think que resuelve local
   * (sin consulta, la mayoría de los ticks) se aplica en este mismo tick,
   * igual que siempre. Uno que consulta al modelo queda en vuelo: los ticks
   * siguientes avanzan la física sin acción de la mascota — piensa parada,
   * no congelada — y la intención se aplica en el tick en que la respuesta
   * llegue. Nunca hay dos pensamientos en vuelo: el agente no es reentrante.
   */
  async stepOnce(): Promise<void> {
    if (this.disposed) return;
    // Un paso ya en vuelo no se duplica: el llamado se suma y espera.
    if (this.stepPromise) return this.stepPromise;
    this.stepPromise = this.runStep();
    try {
      await this.stepPromise;
    } finally {
      this.stepPromise = null;
    }
  }

  /** El cuerpo de un paso. Solo corre uno a la vez (candado en stepOnce). */
  private async runStep(): Promise<void> {
    const pet = getEntity(this.world, this.agent.petId);
    if (!pet || pet.components.dead) {
      if (this.running) this.pause();
      return;
    }
    // El relleno del modo creativo va ANTES que nada (ADR 0061): la percepción
    // con la que va a pensar este tick se arma más abajo, y si el cuerpo
    // todavía estuviera a medias, sentiría un hambre que ya no existe. Un
    // mundo recién creado arranca con la energía baja a propósito, así que sin
    // esto el primer tick del modo creativo ya le nacía el objetivo del cuerpo.
    this.topUpVitals();

    // Con la mente afuera (pensamiento o práctica en vuelo), el paso respira
    // una macrotarea: las carreras contra timer 0 (ADR 0039/0043) y las
    // respuestas del proveedor necesitan que el event loop avance. En el
    // navegador cada tick ya nace de un timer y esto no cambia nada; protege
    // a quien encadene stepOnce en un bucle apretado (los tests), donde la
    // cascada de microtareas puede matar de hambre a esos timers.
    if (this.pendingThink?.outcome === null || this.agent.skillDevInFlight) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Presupuesto biológico de la práctica en segundo plano (ADR 0043): el
    // mismo trato que un pensamiento en vuelo (ADR 0040). Mientras dura el
    // crédito, la vida sigue entera — este tick piensa y actúa con
    // normalidad. Agotado, el tiempo se sostiene hasta el veredicto: la UI,
    // el chat y los eventos del ciclo (versiones, pruebas) siguen vivos.
    if (!this.agent.skillDevInFlight) {
      this.devPassiveTicks = 0;
    } else if (this.devPassiveTicks >= THINK_TICK_BUDGET) {
      this.ingestAgentEvents();
      this.rebuildView();
      this.notify();
      return;
    } else {
      this.devPassiveTicks += 1;
    }

    const pending = this.pendingThink;
    if (pending && pending.outcome === null) {
      if (pending.passiveTicks >= THINK_TICK_BUDGET) {
        // Presupuesto biológico agotado (ADR 0040): la simulación se sostiene
        // hasta que la respuesta llegue. Los eventos que el agente emita a
        // mitad del pensamiento se siguen ingiriendo para que el chat y el
        // panel Dev no se congelen con ella.
        this.ingestAgentEvents();
        this.rebuildView();
        this.notify();
        return;
      }
      // Sigue pensando: el mundo avanza sin su mente este tick, pero el
      // cuerpo conserva sus reflejos (ADR 0043) — apartarse de lo que la
      // está quemando no puede esperar a que la respuesta vuelva del
      // datacenter. Percepción fresca: el reflejo ve el mundo de AHORA.
      pending.passiveTicks += 1;
      const reflex = this.agent.reflexIntent(buildPerception(this.world, this.agent.petId));
      await this.advanceWorld(reflex, null);
      return;
    }

    let outcome: ThinkOutcome;
    let agentEventStart: number;
    if (pending) {
      this.pendingThink = null;
      outcome = pending.outcome!;
      agentEventStart = pending.agentEventStart;
    } else {
      agentEventStart = this.agent.events.events.length;
      const perception = buildPerception(this.world, this.agent.petId);
      this.preThinkSnapshot = takeSnapshot(this.world);
      const settled = this.agent.think(perception).then(
        (intent): ThinkOutcome => ({ status: 'ok', intent }),
        (error): ThinkOutcome => ({ status: 'error', error }),
      );
      // Carrera contra un timer 0: un pensamiento local resuelve en
      // microtareas y gana siempre — el tick se comporta como antes (y los
      // tests siguen siendo deterministas). Solo una consulta real (red,
      // proceso) pierde la carrera y pasa a pensarse en vuelo.
      const raced = await Promise.race([
        settled,
        new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 0)),
      ]);
      if (raced === 'pending') {
        // El tick que lanzó el pensamiento también cuenta: el presupuesto es
        // el costo TOTAL en cuerpo de una consulta, no solo su cola.
        const inFlight: PendingThink = { outcome: null, agentEventStart, passiveTicks: 1 };
        this.pendingThink = inFlight;
        void settled.then(async (result) => {
          inFlight.outcome = result;
          // En pausa no hay próximo tick que lo consuma: se consume solo.
          // Dos intentos porque el primero puede sumarse a un paso ya en
          // vuelo (que no consume); el segundo consume seguro. La identidad
          // protege de una vida nueva (reset/sucesora): si el pendingThink
          // ya no es este, la respuesta tardía cae al vacío.
          for (
            let attempt = 0;
            attempt < 2 && !this.disposed && !this.running && this.pendingThink === inFlight;
            attempt++
          ) {
            await this.stepOnce();
          }
        });
        await this.advanceWorld(null, null);
        return;
      }
      outcome = raced;
    }

    let intent: ActionIntent | null = null;
    if (outcome.status === 'ok') {
      intent = outcome.intent;
      this.consecutiveThinkErrors = 0;
    } else if (this.noteThinkError(outcome.error)) {
      return; // Pausa automática: el tick no se aplica.
    }
    await this.advanceWorld(intent, agentEventStart);
  }

  /**
   * Un proveedor real puede fallar (red, timeout, JSON inválido). Se registra
   * y se reintenta; tras varios fallos seguidos, pausa automática para no
   * lanzar consultas en bucle. Devuelve true si pausó.
   *
   * No todo error de un think es del proveedor: un `TypeError` o un
   * `ReferenceError` no los produce la red ni el modelo, los produce el código
   * de acá. Mandar al cuidador a «revisar la conexión» por un bug propio
   * esconde el bug y lo hace buscar donde no está, así que se nombran aparte.
   */
  private noteThinkError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const ownBug = error instanceof TypeError || error instanceof ReferenceError;
    this.consecutiveThinkErrors += 1;
    this.pushDev('agent', {
      type: 'agent.error',
      tick: this.world.tick,
      data: {
        message,
        consecutive: this.consecutiveThinkErrors,
        origin: ownBug ? 'app' : 'provider',
      },
    });
    if (this.consecutiveThinkErrors < 3) return false;
    this.consecutiveThinkErrors = 0;
    this.say({
      from: 'system',
      text: ownBug
        ? `Error interno de la aplicación (${message.slice(0, 160)}). Pausa automática: no es tu conexión ni el modelo — el detalle está en el registro técnico.`
        : `El proveedor de IA está fallando (${message.slice(0, 160)}). Pausa automática: revisa la conexión o vuelve al modo simulado.`,
      tick: this.world.tick,
      // Habla de esta corrida: manda al registro técnico, que vive en memoria
      // y no se guarda. Persistir el aviso mientras se tira la evidencia hacía
      // que un fallo de hace horas reapareciera en cada recarga como si fuera
      // de ahora — que es exactamente lo que nos hizo perseguir un fantasma.
      ephemeral: true,
    });
    this.pause();
    return true;
  }

  /**
   * El juez de la misión mira este tick. Consume los hechos del mundo Y los del
   * agente: un `skill.promoted` es el veredicto de un evaluador determinista,
   * no una afirmación de la mascota, y hay misiones que preguntan por él.
   *
   * Nada de lo que ella DIGA entra acá. Si dijera "ya crucé", el juez seguiría
   * mirando dónde está parada.
   */
  private judgeMission(events: SimEvent[]): void {
    if (!this.missionTracker) return;
    this.missionTracker.observe(events);
    // Cursor propio: el de la UI avanza por otros caminos, y un juez que se
    // saltea eventos juzga distinto según qué panel estuviera abierto.
    const fresh = this.agent.events.events.slice(this.missionAgentCursor);
    this.missionAgentCursor = this.agent.events.events.length;
    this.missionTracker.observe(fresh);
    const before = this.missionStatus;
    this.missionStatus = this.missionTracker.evaluate(this.world);
    if (this.missionStatus.completed && !before?.completed) {
      this.say({
        from: 'system',
        text: `Misión cumplida: ${this.map?.mission.name ?? ''}. El mundo lo confirma, no ella.`,
        tick: this.world.tick,
      });
      void this.save();
    }
  }

  /**
   * Aplica un tick al mundo: la intención (si hay), la observación del agente
   * y la ingestión de eventos, con el guardado y la muerte de siempre.
   * `agentEventStart` es null en los ticks pasivos de un pensamiento en vuelo,
   * donde no hay turno de usuario que detectar.
   */
  private async advanceWorld(
    intent: ActionIntent | null,
    agentEventStart: number | null,
  ): Promise<void> {
    // Modo creativo (ADR 0061): el cuerpo se rellena a los dos lados del paso.
    // ANTES, para que un solo tick no pueda matarla —el mundo emite `pet.died`
    // dentro de `stepWorld` y rellenar después ya no lo desharía—. DESPUÉS,
    // para que lo que perciba y piense el próximo tick sea un cuerpo entero.
    this.topUpVitals();
    const events = stepWorld(this.world, intent ? [{ actorId: this.agent.petId, intent }] : []);
    this.topUpVitals();
    this.agent.observe(events);
    this.ingestWorldEvents(events);
    this.ingestAgentEvents();
    this.judgeMission(events);

    if (events.some((e) => e.type === 'pet.died')) {
      await this.handleDeath();
    } else {
      const userTurnProcessed =
        agentEventStart !== null &&
        this.agent.events.events
          .slice(agentEventStart)
          .some((event) => event.type === 'user.message.received');
      const completed = this.agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed';
      if (
        userTurnProcessed ||
        (completed && !this.storyWasCompleted) ||
        this.world.tick % AUTOSAVE_EVERY_TICKS === 0
      ) {
        await this.save();
      }
      this.storyWasCompleted = completed;
    }

    this.rebuildView();
    this.notify();
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
    // Lo que su antecesora consiguió que el mundo admitiera es física, no
    // progreso personal (ADR 0047): el mismo criterio con el que
    // `adoptNewWorldRules` mergea las reglas nuevas del juego en una partida
    // vieja. Sin esto la sucesora heredaba la creencia "puedo construir un
    // muro-escuela" sin la receta, y la reinventaba con otro nombre cada vida.
    this.inheritWorldRules(legacy);
    const result = this.agent.adoptLegacy(testimony);
    this.ingestAgentEvents();

    const adopted = result.adoptedSkills
      .map((s) => {
        const status = s.needsConfirmation
          ? 'heredada, falta que confirmes su criterio'
          : s.promoted
            ? 'verificada y promovida'
            : 'rechazada en sus pruebas';
        return `${s.name} (${status})`;
      })
      .join('; ');
    this.chat = this.stamped([
      {
        from: 'system',
        text:
          `Nace ${this.identity.name}, generación ${this.identity.generation}. ` +
          `Ha leído el informe de su antecesora.` +
          (adopted ? ` Habilidades heredadas: ${adopted}.` : ''),
        tick: 0,
      },
    ]);
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
    if (!this.running) setTimeout(() => void this.stepOnce(), 0);
  }

  /**
   * Reporte en Markdown para un agente de código (Claude Code): estado real
   * de la corrida + brechas contra la visión del producto. Va con nombre de
   * archivo sugerido para que la UI lo descargue tal cual.
   */
  buildClaudeReport(): { fileName: string; markdown: string } {
    const generatedAt = new Date().toISOString();
    return {
      fileName: claudeReportFileName(this.view, generatedAt),
      markdown: buildClaudeReport({
        view: this.view,
        recipes: this.world.recipes.map((recipe) => structuredClone(recipe)),
        baseRecipeIds: MVP_RECIPES.map((recipe) => recipe.id),
        evaluationSeeds: sampleSeeds(this.seed),
        generatedAt,
      }),
    };
  }

  // ---- entrada del usuario --------------------------------------------------

  sendUserMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Si ya está pensando, el mensaje entra encolado: se dibuja debajo del
    // "pensando" y con la marca de sin leer hasta que el agente lo atienda.
    this.say({ from: 'user', text: trimmed, tick: this.world.tick, pending: this.aiBusy });
    this.agent.receiveUserMessage(trimmed);
    this.rebuildView();
    this.notify();
    if (!this.running) void this.stepOnce();
  }

  /**
   * Renombrar desde la interfaz. Pasa por el agente (episodio + respuesta en
   * su voz) y la identidad se actualiza al instante para que el encabezado no
   * espere al próximo tick; el evento `pet.renamed` que emite el agente deja
   * el mismo camino que el bautismo por chat.
   */
  renamePet(name: string): void {
    const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, 24).trim();
    if (!trimmed || this.getView().death) return;
    this.agent.receiveNameFromCaretaker(trimmed);
    this.identity.name = trimmed;
    void this.save();
    this.rebuildView();
    this.notify();
    if (!this.running) void this.stepOnce();
  }

  /**
   * Poder del cuidador: pone en el mapa un ejemplar del tipo pedido, en la
   * celda donde se soltó al arrastrarlo desde el catálogo. No pasa por la
   * acción `place` de la mascota — esa exige tenerlo en la mochila y estar al
   * lado —: acá el cuidador materializa desde afuera, como la IA Dios. Copia el
   * arquetipo del tipo, lo deja fresco y lo asienta en una celda libre dentro
   * del mapa; si el tipo no es materializable o la celda no sirve, no hace nada.
   */
  placeItemOnMap(kind: string, at: { x: number; y: number }): void {
    if (this.getView().death) return;
    if (!inBounds(this.world, at)) return;
    // La celda tiene que estar libre: no se apila sobre un sólido (una roca,
    // una pared). Sobre suelo o agua sí, igual que cualquier otro objeto.
    if (isBlocked(this.world, at)) return;
    const archetype = this.archetypeFor(kind);
    if (!archetype) return;

    const components = structuredClone(archetype);
    components.position = { x: at.x, y: at.y };
    // Un ejemplar recién puesto nace entero y solo: sin la marca de muerto de
    // un cadáver copiado, sin lo que otro llevaba dentro y sin el desgaste
    // heredado del ejemplar que sirvió de molde.
    delete components.dead;
    if (components.inventory) components.inventory = { ...components.inventory, items: [] };
    if (components.durability) {
      components.durability = { ...components.durability, current: components.durability.max };
    }
    if (components.energy) {
      components.energy = { ...components.energy, current: components.energy.max };
    }
    if (components.health) {
      components.health = { ...components.health, current: components.health.max };
    }

    spawn(this.world, kind, components);
    this.pushDev('world', {
      type: 'caretaker.placed',
      tick: this.world.tick,
      data: { kind, at },
    });
    void this.save();
    this.rebuildView();
    this.notify();
  }

  /**
   * Pide podar algo del mundo (ADR 0075): calcula el arrastre y lo deja
   * esperando confirmación. **No toca nada todavía** — por eso `cancelPrune`
   * no tiene que deshacer nada, y por eso el número que se muestra es el
   * número real y no una estimación.
   */
  askPrune(ref: PruneRef): void {
    const plan = planPrune(this.world, ref);
    this.pendingPrune = { kind: 'world', plan, preview: this.previewOf(plan) };
    this.rebuildView();
    this.notify();
  }

  /**
   * Lo mismo, para una habilidad entera: todas sus versiones de una.
   *
   * La unidad es el NOMBRE y no el id, aunque la biblioteca guarde versiones,
   * porque es la unidad en la que el cuidador piensa. «Olvidá abrigarse» no
   * quiere decir «olvidá la v7 y dejá las seis que fallaron»: los intentos
   * anteriores son la historia de esa habilidad, y una historia sin su final
   * es basura, no memoria.
   */
  askSkillPrune(name: string): void {
    const versions = this.library.versionsOf(name);
    const label = (skillId: string): string => {
      const skill = this.library.get(skillId);
      return skill ? `${skill.name} v${skill.version}` : skillId;
    };

    // La unión de los planes de cada versión: lo que se apoyaba en cualquiera
    // de ellas se cae igual, y las huérfanas son las que sobreviven a todo.
    const removed = new Set<string>();
    const orphaned = new Set<string>();
    for (const version of versions) {
      const plan = this.library.planRemove(version.id);
      for (const id of plan.removed) removed.add(id);
      for (const id of plan.orphaned) orphaned.add(id);
    }
    for (const id of removed) orphaned.delete(id);

    const own = new Set(versions.map((v) => v.id));
    const plan: SkillRemovalPlan = {
      root: name,
      removed: [...removed].sort(),
      orphaned: [...orphaned].sort(),
    };
    const preview: PrunePreview = {
      title: name,
      lines: [
        ...plan.removed
          .filter((id) => !own.has(id))
          .map((id) => ({ group: 'Se apoyaban en ella', label: label(id) })),
        ...plan.orphaned.map((id) => ({ group: 'Pierden su ascendencia', label: label(id) })),
      ],
      blocked: versions.length === 0 ? 'esa habilidad ya no está en la biblioteca' : null,
    };
    this.pendingPrune = { kind: 'skill', plan, preview };
    this.rebuildView();
    this.notify();
  }

  /** Se arrepintió. Como nada se tocó, alcanza con olvidar el plan. */
  cancelPrune(): void {
    if (!this.pendingPrune) return;
    this.pendingPrune = null;
    this.rebuildView();
    this.notify();
  }

  /**
   * Ejecuta la poda que estaba esperando. Aplica el plan que se mostró, no uno
   * recalculado: lo que el cuidador aprobó es la lista que leyó.
   */
  confirmPrune(): void {
    const pending = this.pendingPrune;
    if (!pending || pending.preview.blocked !== null) return;
    this.pendingPrune = null;
    if (pending.kind === 'world') {
      applyPrune(this.world, pending.plan);
      // Constancia de lo podado, para que la siembra de reglas de fábrica no
      // lo resucite en la próxima carga. Se anotan todas y no solo las de
      // `MVP_RECIPES`: una inventada que se anota de más no molesta —nadie la
      // vuelve a sembrar— y así el legado tampoco la reintroduce (ADR 0047).
      for (const id of pending.plan.recipes) this.prunedRules.add(id);
      for (const id of pending.plan.blueprints) this.prunedRules.add(id);
      // Y sale del catálogo, o la poda duraría hasta el próximo mundo: el
      // catálogo lo volvería a sembrar, que es el mismo error que ya cometía
      // la siembra de reglas de fábrica (ADR 0075 → 0076).
      this.catalog = forgetFromCatalog(this.catalog, {
        recipes: pending.plan.recipes,
        interactions: pending.plan.interactions,
        blueprints: pending.plan.blueprints,
        decompositions: pending.plan.decompositions,
        glyphs: pending.plan.glyphs,
      });
      this.pushDev('world', {
        type: 'caretaker.pruned',
        tick: this.world.tick,
        data: { root: pending.plan.root, size: prunePlanSize(pending.plan) },
      });
    } else {
      this.library.remove(pending.plan);
      // La habilidad se olvida por nombre, también en el catálogo.
      this.catalog = forgetFromCatalog(this.catalog, { skillNames: [pending.plan.root] });
      this.pushDev('world', {
        type: 'caretaker.pruned',
        tick: this.world.tick,
        data: { root: { type: 'skill', id: pending.plan.root }, size: pending.plan.removed.length },
      });
    }
    void this.save();
    this.rebuildView();
    this.notify();
  }

  /** El plan del mundo contado en voz humana, agrupado como se va a mostrar. */
  private previewOf(plan: PrunePlan): PrunePreview {
    const ref = plan.root;
    const recipeLabel = (id: string): string => {
      const recipe = this.world.recipes.find((r) => r.id === id);
      const product = recipe ? recipeProduct(recipe) : undefined;
      return product ? kindLabel(product.kind) : id;
    };
    const decompositionLabel = (id: string): string => {
      const found = this.world.decompositions.find((d) => d.id === id);
      return found ? `romper ${kindLabel(found.targetKind)}` : id;
    };
    const title =
      ref.type === 'kind'
        ? kindLabel(ref.id)
        : ref.type === 'recipe'
          ? `la receta de ${recipeLabel(ref.id)}`
          : ref.type === 'interaction'
            ? (this.world.interactions.find((i) => i.id === ref.id)?.description ?? ref.id)
            : ref.type === 'decomposition'
              ? decompositionLabel(ref.id)
              : `la obra ${ref.id}`;

    // El tipo raíz no se lista: ya es el título. Listarlo de nuevo haría que
    // podar algo sin arrastre pareciera llevarse dos cosas.
    const lines: PruneLine[] = [
      ...plan.recipes
        .filter((id) => !(ref.type === 'recipe' && id === ref.id))
        .map((id) => ({ group: 'Deja de saber construir', label: recipeLabel(id) })),
      ...plan.interactions
        .filter((id) => !(ref.type === 'interaction' && id === ref.id))
        .map((id) => ({
          group: 'Interacciones que se olvidan',
          label: this.world.interactions.find((i) => i.id === id)?.description ?? id,
        })),
      ...plan.blueprints
        .filter((id) => !(ref.type === 'blueprint' && id === ref.id))
        .map((id) => ({ group: 'Obras que se olvidan', label: id })),
      ...plan.decompositions
        .filter((id) => !(ref.type === 'decomposition' && id === ref.id))
        .map((id) => ({ group: 'Deja de saber en qué se deshace', label: decompositionLabel(id) })),
    ];
    if (plan.entities.length > 0 && ref.type === 'kind') {
      lines.push({
        group: 'Desaparecen del mapa y de la mochila',
        label: countedKindLabel(ref.id, plan.entities.length),
      });
    }
    return { title, lines, blocked: plan.blocked ?? null };
  }

  /**
   * El molde con que materializar un tipo en el mapa. Lo que ya existe manda
   * sobre lo que la receta promete —igual que en el catálogo (itemViews)—: un
   * ejemplar real del mundo o de la mochila es la mejor prueba de qué es ese
   * tipo. Si solo se sabe construir, cae al producto de la receta. null cuando
   * el mundo no tiene forma de materializarlo.
   */
  private archetypeFor(kind: string): Components | null {
    for (const entity of Object.values(this.world.entities)) {
      if (entity.id === this.agent.petId) continue;
      if (entity.kind === kind) return entity.components;
    }
    for (const recipe of this.world.recipes) {
      const product = recipeProduct(recipe);
      if (product?.kind === kind) return product.components;
    }
    return null;
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
        this.say({ from: 'pet', text, tick: event.tick });
      }
      if (event.type === 'action.requested') {
        const intent = event.data.intent as { type: string };
        this.lastAction = intent.type;
        this.recentActions.push(intent.type);
        if (this.recentActions.length > RECENT_ACTIONS_LIMIT) this.recentActions.shift();
      }
      if (event.type === 'item.pickedUp') {
        // El motor ya le quitó la posición al objeto, pero la entidad sigue
        // existiendo: de ahí sale el tipo con el que la UI lo representa.
        const itemId = String(event.data.itemId);
        this.lastPickup = {
          itemId,
          kind: getEntity(this.world, itemId)?.kind ?? '?',
          tick: event.tick,
        };
      }
      if (event.type === 'interaction.performed') {
        const stance = String(event.data.stance);
        if (stance === 'on-top' || stance === 'underneath') {
          this.lastMount = { targetId: String(event.data.targetId), mode: stance };
        }
      }
      if (event.type === 'pet.died') {
        this.say({
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
      // El agente leyó un mensaje encolado: se apaga su marca de "sin leer"
      // (el más viejo con ese texto, en el mismo orden FIFO en que la cola los
      // atiende) y pasa a ser historia normal por encima del próximo pensar.
      if (event.type === 'user.message.received') {
        const text = String(event.data.text ?? '');
        const entry =
          this.chat.find((e) => e.pending && e.from === 'user' && e.text === text) ??
          this.chat.find((e) => e.pending && e.from === 'user');
        if (entry) entry.pending = false;
      }
      // Bautismo por chat: el nombre vive en la identidad (capa de sesión),
      // así que el evento del agente es quien la actualiza y persiste.
      if (event.type === 'pet.renamed') {
        const name = String(event.data.name ?? '').trim();
        if (name && name !== this.identity.name) {
          this.identity.name = name;
          void this.save();
        }
      }
      // Vista previa de una receta descrita por el cuidador (ADR 0024): se
      // vuelve una tarjeta en el chat, junto a la pregunta de confirmación.
      if (event.type === 'recipe.preview') {
        const components = (event.data.components ?? {}) as Components;
        const ingredients = Array.isArray(event.data.ingredients)
          ? (event.data.ingredients as { kind: string; count: number }[])
          : [];
        const kind = String(event.data.outputKind ?? event.data.recipeId ?? '?');
        this.say({
          from: 'pet',
          text: '',
          tick: event.tick,
          card: {
            recipeId: String(event.data.recipeId ?? kind),
            kind,
            name: kindLabel(kind),
            ingredients: ingredients.map((i) => countedKindLabel(i.kind, i.count)),
            does: describeComponents(components),
            traits: traitsFromComponents(components),
          },
        });
      }
      this.trackRealWorldSkillRun(event);
      this.trackSkillDevProgress(event);
    }
  }

  /**
   * El ciclo de desarrollo visto en vivo: cada evento del ciclo actualiza un
   * estado chiquito que la UI muestra mientras la mascota piensa ("versión 3,
   * probando en 40 mundos..."). Sin esto, un developSkill largo son minutos de
   * puntitos suspensivos; con esto, es una historia que se puede seguir.
   */
  private trackSkillDevProgress(event: AgentEvent): void {
    if (event.type === 'skill.requested') {
      this.skillDev = {
        skillName: String(event.data.name ?? ''),
        purpose: typeof event.data.purpose === 'string' ? event.data.purpose : null,
        version: null,
        maxVersions: typeof event.data.maxVersions === 'number' ? event.data.maxVersions : null,
        attemptsDone: 0,
        phase: 'designing',
        casesTotal: null,
        lastRate: null,
        bestRate: null,
      };
      return;
    }
    const dev = this.skillDev;
    if (!dev) return;
    const version = typeof event.data.version === 'number' ? event.data.version : null;
    switch (event.type) {
      case 'skill.created':
        if (version !== null) dev.version = version;
        dev.phase = 'testing';
        break;
      case 'skill.test.started': {
        if (version !== null) dev.version = version;
        dev.phase = 'testing';
        const scenarios = Array.isArray(event.data.scenarios) ? event.data.scenarios.length : 0;
        const seeds = Array.isArray(event.data.seeds) ? event.data.seeds.length : 0;
        const regressions = typeof event.data.regressions === 'number' ? event.data.regressions : 0;
        dev.casesTotal = scenarios * seeds + regressions;
        break;
      }
      case 'skill.test.failed': {
        const rate = typeof event.data.successRate === 'number' ? event.data.successRate : null;
        dev.attemptsDone += 1;
        dev.lastRate = rate;
        if (rate !== null) dev.bestRate = Math.max(dev.bestRate ?? 0, rate);
        dev.phase = 'revising';
        break;
      }
      case 'skill.test.passed': {
        const rate = typeof event.data.successRate === 'number' ? event.data.successRate : null;
        dev.lastRate = rate;
        if (rate !== null) dev.bestRate = Math.max(dev.bestRate ?? 0, rate);
        dev.phase = 'passed';
        break;
      }
      case 'skill.promoted':
        // Promovida: el ciclo TERMINÓ (ADR 0060). Se limpia, igual que en la
        // meseta y por el mismo motivo: este renglón cuenta lo que está
        // pasando, y un ciclo cerrado ya no está pasando.
        //
        // Dejarlo puesto no era inofensivo. El encabezado sale del pensamiento
        // en vuelo y el renglón de los eventos del ciclo: dos relojes. Con el
        // estado viejo colgado, el ciclo SIGUIENTE mostraba su encabezado
        // ("corrigiendo una habilidad que falló") al lado del "¡pasó con
        // 100%!" del anterior, y quedaba diciendo que corregía algo que
        // acababa de aprobar. El registro permanente del logro no se pierde:
        // vive en la tarjeta de hito del chat, que sale de los eventos.
        this.skillDev = null;
        break;
      case 'skill.rejected':
        // Programa inválido o repetido: vuelve al modelo sin gastar intento.
        dev.phase = 'revising';
        break;
      case 'skill.dev.plateau':
        // El ciclo cerró por meseta (ADR 0051): el globo se despide. Dejarlo
        // en "corrigiendo" para siempre contaría un trabajo que ya no corre.
        this.skillDev = null;
        break;
      default:
        break;
    }
  }

  /**
   * Vigilancia en uso real: cuando una skill estable empieza a ejecutarse se
   * conserva el snapshot del mundo previo al primer paso; si la corrida
   * falla por comportamiento (no por falta de recursos), ese mundo exacto se
   * convierte en un caso de regresión que toda versión futura deberá superar.
   */
  private trackRealWorldSkillRun(event: AgentEvent): void {
    if (event.type === 'strategy.selected') {
      const strategy = String(event.data.strategy ?? '');
      if (strategy.startsWith('stable-skill:')) {
        const skillName = strategy.slice('stable-skill:'.length).split('@')[0] ?? strategy;
        this.activeSkillRun = { skillName, snapshot: this.preThinkSnapshot };
      } else {
        this.activeSkillRun = null;
      }
      return;
    }
    if (event.type === 'strategy.failed') {
      const run = this.activeSkillRun;
      this.activeSkillRun = null;
      const reason = event.data.reason === null ? '' : String(event.data.reason ?? '');
      // Falta de recurso (no-candidates) no es un defecto de la skill.
      if (!run?.snapshot || reason.includes('no-candidates')) return;
      const regression = this.regressions.addRealWorldCase({
        skillName: run.skillName,
        snapshot: run.snapshot,
        petId: this.agent.petId,
        tick: event.tick,
        description: `falló en el mundo real (${reason || String(event.data.outcome ?? 'sin éxito')})`,
        createdAt: new Date().toISOString(),
      });
      this.pushDev('agent', {
        type: 'regression.recorded',
        tick: event.tick,
        data: { regressionId: regression.id, skillName: run.skillName, reason },
      });
      this.say({
        from: 'system',
        text: `El fallo de "${run.skillName}" quedó registrado como caso de regresión: sus próximas versiones deberán superarlo.`,
        tick: event.tick,
      });
      void this.save();
      return;
    }
    if (event.type === 'strategy.forbidden' || event.type === 'goal.completed') {
      // Cierre de corrida sin fallo relevante.
      if (event.type === 'goal.completed') this.activeSkillRun = null;
    }
  }

  // ---- construcción del view model ---------------------------------------------

  private experimentsFromEvents(): ExperimentView[] {
    const experiments: ExperimentView[] = [];
    /**
     * El nombre de la habilidad, siempre el nombre.
     *
     * No todos los eventos del ciclo lo traen: `skill.test.passed` y
     * `skill.test.failed` emiten solo `skillId`. Mientras el panel era una
     * lista plana daba igual —cada evento se imprimía suelto—, pero agrupar
     * por este campo partía un mismo ciclo en dos: la candidata bajo
     * «alcanzar alimento bloqueado» y su veredicto bajo «skill 1», que es el
     * id crudo del motor asomándose a la pantalla.
     */
    const nameOf = (data: AgentEvent['data']): string => {
      if (typeof data.name === 'string' && data.name) return data.name;
      const id = typeof data.skillId === 'string' ? data.skillId : null;
      return id ? (this.library.get(id)?.name ?? id) : '';
    };
    const push = (event: AgentEvent, kind: ExperimentView['kind'], detail: string): void => {
      experiments.push({
        tick: event.tick,
        skillName: nameOf(event.data),
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
        case 'skill.contract.preview':
          push(
            event,
            'contract-preview',
            `Propone aprender "${String(d.name)}" y espera tu confirmación. Lo dará por ` +
              `logrado si: ${(d.criteria as string[]).join('; ')}`,
          );
          break;
        case 'skill.contract.agreed':
          push(
            event,
            'contract-agreed',
            `El cuidador le pidió aprender "${String(d.name)}". Lo dará por logrado si: ${(
              d.criteria as string[]
            ).join('; ')}`,
          );
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
          // Las observaciones son códigos del evaluador; se dicen en voz
          // humana acá, donde todavía son una lista y no un renglón pegado.
          push(
            event,
            'test-failed',
            `Éxito ${Math.round((d.successRate as number) * 100)}%. ${(d.observations as string[])
              .map(humanReason)
              .join('; ')}`,
          );
          break;
        case 'skill.test.passed':
          push(event, 'test-passed', `Éxito ${Math.round((d.successRate as number) * 100)}%`);
          break;
        case 'skill.promoted':
          push(event, 'promoted', (d.reasons as string[]).join('; '));
          break;
        case 'skill.provisional':
          push(
            event,
            'provisional',
            `Funciona en el ${Math.round((d.successRate as number) * 100)}% de los mundos de ` +
              `prueba: no alcanza para darla por probada, pero la uso mientras no tenga algo mejor.`,
          );
          break;
        case 'skill.dev.plateau':
          push(
            event,
            'plateau',
            `Varias versiones seguidas no mejoraron el ${Math.round((d.bestRate as number) * 100)}%: ` +
              `me quedo con la mejor por ahora y dejo de gastar pensamiento en pulirla.`,
          );
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
        case 'gpsTo':
          lines.push(`${pad}GPS hacia ${op.kind} (máx ${op.maxSteps} pasos)`);
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

  /** Su vista, tal como la calcula el motor. `null` si no hay a quién mirarle. */
  private visionView(): VisionView | null {
    const pet = getEntity(this.world, this.agent.petId);
    const range = pet?.components.agent?.perceptionRange;
    if (!pet || range === undefined) return null;
    return { range, cells: visibleCells(this.world, this.agent.petId) };
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
      successCriteria: skill.successCriteria.map(describeCriterion),
      lastEvaluationSuccessRate: skill.metrics.lastEvaluationSuccessRate ?? null,
      totalRuns: skill.metrics.totalRuns,
      successfulRuns: skill.metrics.successfulRuns,
      knownFailures: skill.knownFailures.map((f) => f.description),
      parentVersionId: skill.parentVersionId ?? null,
      programSummary: this.summarizeOps(skill.program),
      subjects: skillSubjects(skill.program, (id) => this.recipeProductKind(id)),
    }));
  }

  /** El tipo que sale de una receta: `craft` nombra la receta, no el producto. */
  private recipeProductKind(recipeId: string): string | null {
    const recipe = this.world.recipes.find((r) => r.id === recipeId);
    return recipe ? (recipeProduct(recipe)?.kind ?? null) : null;
  }

  /**
   * Catálogo de tipos de objeto para la UI. El origen no vive en la receta ni
   * en la entidad (un objeto es lo que sus componentes le permiten hacer, no
   * de dónde salió): se deriva acá, igual que en el reporte para Claude — lo
   * que no está entre las recetas base del MVP lo construyó un modelo en
   * runtime, y sus productos (y lo que dejan al romperse) heredan ese origen.
   */
  /**
   * Las obras plantadas, listas para dibujar (ADR 0049). El agente ya sabe
   * dónde va cada bloque y cuáles puso: acá solo se traduce a lo que la
   * pantalla necesita, con el nombre en voz humana.
   */
  private plannedStructureViews(perception: Perception | null): PlannedStructureView[] {
    if (!perception) return [];
    return this.agent.plannedStructures(perception).map((planned) => ({
      blueprintId: planned.blueprintId,
      label: kindLabel(planned.blueprintId),
      cells: planned.cells,
      remaining: planned.cells.filter((cell) => !cell.done).length,
    }));
  }

  /**
   * Los tipos que su mundo inventó y todavía no tienen dibujo (ADR 0064).
   *
   * Quién es «inventado» lo sabe la app y no el motor: la diferencia es estar
   * o no en `MVP_RECIPES`. Se le pasan al agente al cargar para que la cola de
   * dibujos se rearme sola — lo que ella inventó en otra sesión, o lo que
   * heredó del mundo de una antecesora, sigue mereciendo su cara.
   */
  private undrawnInventedKinds(): string[] {
    const baseIds = new Set(MVP_RECIPES.map((recipe) => recipe.id));
    const drawn = new Set(Object.keys(this.world.glyphs));
    const pending = new Set<string>();
    for (const recipe of this.world.recipes) {
      if (baseIds.has(recipe.id)) continue;
      for (const kind of recipeProductKinds(recipe)) {
        if (!drawn.has(kind)) pending.add(kind);
      }
    }
    return [...pending];
  }

  private itemViews(): ItemView[] {
    const lineage = lineageOf(this.world.recipes);
    const baseIds = new Set(MVP_RECIPES.map((recipe) => recipe.id));
    const inventedKinds = new Set<string>();
    const builtinProductKinds = new Set<string>();
    const craftable = new Map<string, { components: Components; recipe: Recipe }>();
    for (const recipe of this.world.recipes) {
      const product = recipeProduct(recipe);
      if (product && !craftable.has(product.kind)) {
        craftable.set(product.kind, { components: product.components, recipe });
      }
      const kinds = recipeProductKinds(recipe);
      if (baseIds.has(recipe.id)) {
        for (const kind of kinds) builtinProductKinds.add(kind);
        continue;
      }
      for (const kind of kinds) inventedKinds.add(kind);
      for (const outcome of recipe.outcomes) {
        for (const drop of outcome.output?.components.drops ?? []) inventedKinds.add(drop.kind);
      }
    }
    // Si una receta base ya produce ese tipo, la definición sigue siendo del
    // código aunque un invento lo fabrique por otro camino.
    for (const kind of builtinProductKinds) inventedKinds.delete(kind);

    const pet = getEntity(this.world, this.agent.petId);
    const inventoryIds = new Set(pet?.components.inventory?.items ?? []);
    const counts = new Map<
      string,
      { instances: Components[]; inWorld: number; inInventory: number }
    >();
    for (const entity of Object.values(this.world.entities)) {
      if (entity.id === this.agent.petId) continue;
      const carried = inventoryIds.has(entity.id);
      if (!entity.components.position && !carried) continue;
      const entry = counts.get(entity.kind) ?? { instances: [], inWorld: 0, inInventory: 0 };
      entry.instances.push(entity.components);
      if (carried) entry.inInventory += 1;
      else entry.inWorld += 1;
      counts.set(entity.kind, entry);
    }

    const kinds = [...new Set([...counts.keys(), ...craftable.keys()])];
    return (
      kinds
        .map((kind) => {
          const counted = counts.get(kind);
          const recipe = craftable.get(kind);
          // Lo que existe manda sobre lo que la receta promete: si hay una
          // fogata floja en el mundo, el catálogo cuenta esa y no el arquetipo.
          const instances = counted?.instances ?? (recipe ? [recipe.components] : []);
          const shape = instances[0] ?? {};
          const cost = recipe ? expandRecipeCost(recipe.recipe, this.world.recipes) : undefined;
          // El árbol solo se muestra cuando dice algo que los ingredientes
          // directos no dicen ya. Un solo paso (la receta y nada debajo)
          // significa que sus ingredientes SON la materia base: repetirlos
          // abajo con otro título sería fingir profundidad.
          const deep = cost !== undefined && cost.steps.length > 1;
          return {
            kind,
            name: kindLabel(kind),
            origin: (inventedKinds.has(kind) ? 'invented' : 'builtin') as ItemView['origin'],
            inWorld: counted?.inWorld ?? 0,
            inInventory: counted?.inInventory ?? 0,
            craftable: recipe !== undefined,
            ingredients: (recipe?.recipe.ingredients ?? []).map((i) =>
              ingredientView(i.kind, i.count),
            ),
            baseCost: deep
              ? [...cost.base].map(([baseKind, count]) => ingredientView(baseKind, count))
              : [],
            costTruncated: cost?.truncated ?? false,
            traits: traitsFromComponents(shape),
            material: materialFor(kind, lineage),
            glyph: this.world.glyphs[kind],
            does: describeComponents(shape),
            stats: itemStats(instances),
          };
        })
        // Lo inventado primero (es la novedad), después alfabético.
        .sort((a, b) =>
          a.origin === b.origin
            ? a.name.localeCompare(b.name, 'es')
            : a.origin === 'invented'
              ? -1
              : 1,
        )
    );
  }

  /** Las interacciones del mundo, en voz humana (ADR 0027). */
  /**
   * Las obras aprendidas, listas para dibujar (ADR 0056). El plano guarda
   * desplazamientos relativos al ancla (que pueden ser negativos); acá se
   * normalizan a una grilla que empieza en (0,0) para que la pantalla la
   * pinte sin hacer cuentas — y se ubica dónde queda ella misma, que es la
   * celda que el plano deja libre a propósito.
   */
  private blueprintViews(): BlueprintView[] {
    return this.world.blueprints.map((blueprint) => {
      const xs = blueprint.placements.map((p) => p.offset.x);
      const ys = blueprint.placements.map((p) => p.offset.y);
      // El ancla (0,0) entra en la cuenta aunque no tenga bloque: es parte de
      // la forma, y sin ella la silueta se dibujaría corrida.
      const minX = Math.min(0, ...xs);
      const minY = Math.min(0, ...ys);
      const counts = new Map<string, number>();
      for (const placement of blueprint.placements) {
        counts.set(placement.kind, (counts.get(placement.kind) ?? 0) + 1);
      }
      // De qué está hecha cada pieza NO se calcula acá: la tarjeta lleva a la
      // ficha del objeto en el catálogo, que ya responde eso y mejor (ADR
      // 0056, adenda). Bajar el árbol por cada bloque en cada cuadro para
      // mostrar un total que nadie lee era trabajo puro por tirar.
      return {
        id: blueprint.id,
        label: kindLabel(blueprint.id),
        blocks: [...counts].map(([kind, count]) => ingredientView(kind, count)),
        cells: blueprint.placements.map((p) => ({
          kind: p.kind,
          x: p.offset.x - minX,
          y: p.offset.y - minY,
        })),
        width: Math.max(0, ...xs) - minX + 1,
        height: Math.max(0, ...ys) - minY + 1,
        // `Math.max(0, …)` y no `-minX` a secas: con el mínimo en cero eso da
        // `-0`, que es el mismo número pero no la misma cosa para nadie que
        // compare. Basura que no tiene por qué salir del view model.
        anchor: { x: Math.max(0, -minX), y: Math.max(0, -minY) },
      };
    });
  }

  private interactionViews(): InteractionView[] {
    const stanceLabels: Record<string, string> = {
      beside: 'al lado',
      'on-top': 'encima',
      underneath: 'debajo',
      held: 'en la mano',
    };
    return this.world.interactions.map((interaction) => ({
      id: interaction.id,
      description: interaction.description,
      stance: interaction.stance,
      stanceLabel: stanceLabels[interaction.stance] ?? interaction.stance,
      targetLabel: interaction.target.kind
        ? kindLabel(interaction.target.kind)
        : 'lo que tenga esos rasgos',
      requiresLabel: interaction.requires ? kindLabel(interaction.requires.heldKind) : null,
    }));
  }

  /**
   * Los objetivos en el orden en que compiten (ADR 0052), cada uno con lo que
   * le falta reunir. El orden no es el de creación sino el de la fila real: el
   * mismo `priority + urgency` con el que el agente elige a cuál atender, para
   * que la pantalla no cuente una prioridad distinta de la que se obedece.
   */
  private goalViews(perception: Perception | null): GoalView[] {
    const all = this.agent.goals.all();
    const plans = new Map(
      (perception ? this.agent.goalPlans(perception) : []).map((plan) => [plan.goalId, plan]),
    );
    // La fila es de los padres: los hijos no compiten (ADR 0053), así que
    // tampoco reciben número.
    const rank = new Map<string, number>();
    all
      .filter((g) => g.status === 'active' && g.parentGoalId === undefined)
      .sort(
        (a, b) =>
          b.priority + b.urgency - (a.priority + a.urgency) ||
          Number(a.id.slice(5)) - Number(b.id.slice(5)),
      )
      .forEach((g, i) => rank.set(g.id, i + 1));
    // Abiertos primero (activos por prioridad, después los que esperan), y al
    // final lo terminado: lo que se consulta es lo que todavía está en juego.
    const weight = (g: { status: string; id: string }): number =>
      g.status === 'active' ? (rank.get(g.id) ?? 0) : g.status === 'suspended' ? 1000 : 2000;
    type PlanNeed = ReturnType<AnimaAgent['goalPlans']>[number]['needs'][number];
    const needViews = (needs: PlanNeed[]): GoalView['needs'] =>
      needs
        .filter((need) => need.have < need.need)
        .map((need) => ({
          kind: need.kind,
          label: kindLabel(need.kind),
          short: need.need - need.have,
          need: need.need,
          have: need.have,
          visible: need.visible,
          fromLabel: need.from ? kindLabel(need.from) : null,
        }));
    const viewOf = (
      g: (typeof all)[number],
      needs: PlanNeed[],
      structure: ReturnType<AnimaAgent['goalPlans']>[number]['structure'],
    ): GoalView => ({
      id: g.id,
      description: g.description,
      status: g.status,
      source: g.source,
      score: g.priority + g.urgency,
      rank: rank.get(g.id) ?? null,
      suspendedReason: g.suspendedReason ?? null,
      needs: needViews(needs),
      structure: structure
        ? {
            label: kindLabel(structure.blueprintId),
            placed: structure.placed,
            total: structure.total,
          }
        : null,
      children: [],
    });
    return all
      .filter((g) => g.parentGoalId === undefined)
      .map((g) => {
        const plan = plans.get(g.id);
        const view = viewOf(g, plan?.needs ?? [], plan?.structure);
        // Los hijos viajan DENTRO del padre. Un paso de juntar muestra la
        // cuenta viva de SU materia — el mismo dato del plan del padre, no una
        // segunda cuenta que pueda discrepar.
        view.children = all
          .filter((child) => child.parentGoalId === g.id)
          .map((child) => {
            const step = child.step;
            const own =
              step?.kind === 'gather'
                ? (plan?.needs ?? []).filter((need) => need.kind === step.targetKind)
                : [];
            const view = viewOf(child, own, undefined);
            // El título de un paso de juntar se REDACTA acá, no se lee del que
            // quedó guardado al crearlo. Un texto congelado envejece mal: los
            // pasos creados antes de arreglar el plural siguen diciendo "4
            // pared escuelas" para siempre en las partidas ya guardadas. El
            // guardado conserva su descripción para el registro; la pantalla
            // dice lo que es verdad ahora.
            if (step?.kind === 'gather') {
              view.description = `conseguir ${step.need}× ${kindLabel(step.targetKind)}`;
            }
            return view;
          });
        return view;
      })
      .sort((a, b) => weight(a) - weight(b) || Number(a.id.slice(5)) - Number(b.id.slice(5)));
  }

  private rebuildView(): void {
    const pet = getEntity(this.world, this.agent.petId);
    const petPos = pet?.components.position;
    // Una sola percepción para todo lo que la pantalla deriva del agente: las
    // obras plantadas y lo que falta para cada objetivo salen de la misma foto,
    // así no pueden contradecirse dentro del mismo cuadro.
    const perception =
      pet && !pet.components.dead ? buildPerception(this.world, this.agent.petId) : null;
    const goals: GoalView[] = this.goalViews(perception);
    const activeGoal = this.agent.goals.selectActive();

    const strategyEvents = this.agent.events.ofType('strategy.selected');
    const lastStrategy = strategyEvents[strategyEvents.length - 1];

    const lineage = lineageOf(this.world.recipes);
    const entities = Object.values(this.world.entities)
      .filter((e) => e.id !== this.agent.petId && e.components.position)
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        x: e.components.position!.x,
        y: e.components.position!.y,
        traits: traitsFromComponents(e.components),
        material: materialFor(e.kind, lineage),
        // El dibujo de la obra manda sobre el del tipo, y solo para la pieza
        // que está puesta en ella: el tablón que lleva en la mano sigue siendo
        // el tablón que dibujó. Sin dibujo de obra, cae al de siempre — que es
        // exactamente como se veía antes de que las obras tuvieran aspecto.
        glyph: e.components.partOfWork
          ? (workGlyphFor(
              this.world.workGlyphs,
              e.components.partOfWork.blueprintId,
              e.components.partOfWork.offset,
            ) ?? this.world.glyphs[e.kind])
          : this.world.glyphs[e.kind],
        partOfWork: e.components.partOfWork,
      }));

    const speechFresh =
      this.lastSpeech && this.world.tick - this.lastSpeech.tick <= SPEECH_VISIBLE_TICKS
        ? this.lastSpeech
        : null;

    const pickupFresh =
      this.lastPickup && this.world.tick - this.lastPickup.tick <= PICKUP_VISIBLE_TICKS
        ? this.lastPickup
        : null;

    // La postura dura mientras siga parada en la celda del objeto: al bajarse
    // (o si el objeto ya no está) el dibujo vuelve al orden de siempre.
    const mountTarget = this.lastMount ? getEntity(this.world, this.lastMount.targetId) : null;
    const mount =
      this.lastMount &&
      petPos &&
      mountTarget?.components.position &&
      mountTarget.components.position.x === petPos.x &&
      mountTarget.components.position.y === petPos.y
        ? { targetId: this.lastMount.targetId, mode: this.lastMount.mode }
        : null;
    if (!mount) this.lastMount = null;

    this.view = {
      seed: this.seed,
      tick: this.world.tick,
      timeOfDay: timeOfDay(this.world),
      running: this.running,
      speed: this.speed,
      petColor: this.petColor,
      aiProvider: this.provider.name,
      aiBusy: this.aiBusy,
      // Copias frescas: la vista es inmutable aunque el pensamiento siga
      // creciendo por detrás mientras la consulta corre.
      thoughts: this.thoughts.map((entry) => ({ ...entry, reasoning: entry.reasoning.slice() })),
      currentThought: (() => {
        for (let i = this.thoughts.length - 1; i >= 0; i--) {
          const entry = this.thoughts[i]!;
          if (entry.status === 'thinking') {
            return { ...entry, reasoning: entry.reasoning.slice() };
          }
        }
        return null;
      })(),
      aiWait: this.queryWait
        ? {
            startedAtMs: this.queryWait.startedAtMs,
            expectedMs: this.expectedMsFor(this.queryWait.kind),
            held:
              this.pendingThink !== null &&
              this.pendingThink.outcome === null &&
              this.pendingThink.passiveTicks >= THINK_TICK_BUDGET,
          }
        : null,
      skillDev: this.skillDev ? { ...this.skillDev } : null,
      dreams: this.dreams.slice(),
      // La preferencia viaja siempre, aunque el motor activo sea Codex: es del
      // cuidador, no del proveedor, y la UI necesita poder mostrarla apagada.
      mockImperfect: this.mockImperfect,
      creativeMode: this.creativeMode,
      // Solo cuando alguien lo está mirando: recorrer el cuadrado de visión y
      // trazar Bresenham a cada celda es trabajo real, y a rango 12 son 625
      // celdas por tick que nadie pidió.
      vision: this.visionShown ? this.visionView() : null,
      identity: {
        name: this.identity.name,
        generation: this.identity.generation,
        ancestorId: this.identity.ancestorId ?? null,
      },
      death: this.deathReport,
      legacyCount: this.legacyCount,
      worldSize: { width: this.world.config.width, height: this.world.config.height },
      entities,
      plannedStructures: this.plannedStructureViews(perception),
      items: this.itemViews(),
      interactions: this.interactionViews(),
      blueprints: this.blueprintViews(),
      prune: this.pendingPrune?.preview ?? null,
      catalogSize: catalogSize(this.catalog),
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
              temperature: pet.components.temperature
                ? {
                    current: pet.components.temperature.current,
                    max: pet.components.temperature.max,
                  }
                : null,
              inventory: (pet.components.inventory?.items ?? []).map((id) => {
                const held = getEntity(this.world, id);
                const durability = held?.components.durability;
                return {
                  id,
                  kind: held?.kind ?? '?',
                  ...(durability
                    ? { durability: { current: durability.current, max: durability.max } }
                    : {}),
                };
              }),
              inventoryCapacity: pet.components.inventory?.capacity ?? 0,
              mount,
            }
          : null,
      goals,
      currentGoal: goals.find((g) => g.id === activeGoal?.id) ?? null,
      currentStrategy: lastStrategy ? String(lastStrategy.data.strategy) : null,
      lastAction: this.lastAction,
      speech: speechFresh,
      pickup: pickupFresh,
      chat: [...this.chat],
      skills: this.skillViews(),
      experiments: this.experimentsFromEvents(),
      devEvents: [...this.devEvents],
      regressions: this.regressions.all().map((r) => ({
        scenarioName: r.scenarioName,
        seed: r.seed,
        description: r.description,
      })),
      personality: this.agent.personality().map(({ id, label, evidence }) => ({
        id,
        label,
        evidence,
      })),
      facts: this.agent.memory.factList().map((f) => f.statement),
      hypotheses: this.agent.memory.hypothesisList().map((h) => ({
        statement: h.statement,
        confidence: Math.round(h.confidence * 100) / 100,
        resolved: h.resolved,
      })),
      episodes: this.agent.memory.episodeList().map((e) => ({
        kind: e.kind,
        summary: e.summary,
        occurrences: e.occurrences,
        lastTick: e.lastTick,
      })),
      storyCompleted: this.agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed',
      mission:
        this.map && this.missionStatus
          ? {
              id: this.map.mission.id,
              name: this.map.mission.name,
              briefing: this.map.mission.briefing,
              completed: this.missionStatus.completed,
              completedAtTick: this.missionStatus.completedAtTick ?? null,
              objectives: this.missionStatus.objectives.map((objective) => ({
                id: objective.id,
                describe: objective.describe,
                met: objective.met,
                metAtTick: objective.metAtTick ?? null,
                detail: objective.detail,
              })),
            }
          : null,
    };
  }
}
