import type { LegacyReport } from '@anima/persistence';

/**
 * View model inmutable que la sesión entrega a la UI en cada tick.
 * Es la única fuente de datos de React y Phaser: la UI nunca consulta el
 * motor ni el agente directamente, así no puede duplicar reglas del mundo.
 */

/**
 * Qué hace una cosa, no cómo se llama. Un objeto que Ánima inventó lleva el
 * nombre que eligió el modelo ("hoguera-simple"), pero si irradia calor es un
 * fuego: con esto la UI puede dibujarlo como lo que es, sin conocer su nombre
 * ni duplicar reglas del mundo. Es la misma idea que rige las recetas — un
 * objeto es lo que sus componentes le permiten hacer.
 */
export interface EntityTraits {
  warm?: boolean;
  edible?: boolean;
  tool?: boolean;
  growsFood?: boolean;
  dangerous?: boolean;
  portable?: boolean;
  solid?: boolean;
}

export interface EntityView {
  id: string;
  kind: string;
  x: number;
  y: number;
  traits: EntityTraits;
}

export interface PetView {
  id: string;
  x: number;
  y: number;
  alive: boolean;
  energy: { current: number; max: number };
  health: { current: number; max: number };
  /** Solo en mundos con frío: null donde la mascota no siente temperatura. */
  temperature: { current: number; max: number } | null;
  inventory: { id: string; kind: string }[];
  /**
   * Postura sobre un objeto tras una interacción (ADR 0027): comparte celda
   * con él, encima o debajo. El dibujo decide quién tapa a quién; null cuando
   * está simplemente parada en el suelo.
   */
  mount: { targetId: string; mode: 'on-top' | 'underneath' } | null;
}

/**
 * Una interacción que el mundo admite (ADR 0027): la inventó Ánima, la validó
 * la física, la aprobó la IA Dios, y quedó guardada — reusable sin costo.
 */
export interface InteractionView {
  id: string;
  /** Qué es, en voz humana: "juntar agua del estanque con un balde". */
  description: string;
  stance: 'beside' | 'on-top' | 'underneath' | 'held';
  /** La postura en voz humana: "al lado", "encima", "debajo", "en la mano". */
  stanceLabel: string;
  /** A qué se aplica, en voz humana. */
  targetLabel: string;
  /** Qué exige llevar encima, en voz humana; null si nada. */
  requiresLabel: string | null;
}

/** Una característica medible de un tipo: "Calor" → "0.3 por tick · alcance 2". */
export interface ItemStat {
  label: string;
  value: string;
}

/**
 * Un tipo de objeto del mundo, para el catálogo de la UI. Reúne en una sola
 * fila lo que existe en el mapa, lo que va en la mochila y lo que las recetas
 * saben construir. `origin` dice de dónde salió su definición: `builtin` viene
 * del código (escenarios y recetas del MVP); `invented` la construyó un modelo
 * en tiempo de ejecución (un invento de la mascota o una descripción del
 * cuidador, ADR 0018 / 0024) y entró al mundo por la puerta de validación.
 */
export interface ItemView {
  kind: string;
  /** Nombre humano ("pedernal", "hoguera simple"), no el id del motor. */
  name: string;
  origin: 'builtin' | 'invented';
  /** Cuántos hay ahora en el mapa. */
  inWorld: number;
  /** Cuántos lleva la mascota. */
  inInventory: number;
  /** true si alguna receta viva del mundo lo produce. */
  craftable: boolean;
  /** Lo que cuesta construirlo ("2 troncos"); vacío si no hay receta. */
  ingredients: string[];
  traits: EntityTraits;
  /** Qué HACE ("da calor", "bloquea el paso"), en voz humana. */
  does: string[];
  /**
   * Sus números, cuando los tiene: calor, dureza, resistencia. Sale de los
   * ejemplares que existen; si solo se puede construir, del arquetipo de la
   * receta — que es su mejor desenlace, una intención y no una promesa.
   */
  stats: ItemStat[];
}

/**
 * Vista previa de una receta traducida de la descripción del cuidador (ADR
 * 0024): lo que la mascota imagina ANTES de que él confirme. Muestra el mejor
 * desenlace — la intención, no la promesa. Lleva `traits` y no un emoji para
 * que el dibujo salga de la misma regla que el mundo (appearance.ts): un
 * objeto es lo que sus componentes le permiten hacer.
 */
export interface RecipeCardView {
  recipeId: string;
  kind: string;
  /** Nombre humano ("hoguera simple"), no el id del motor. */
  name: string;
  /** "2 troncos", "1 pedernal": qué cuesta, en voz humana. */
  ingredients: string[];
  /** Qué HACE lo construido ("da calor", "bloquea el paso"). */
  does: string[];
  traits: EntityTraits;
}

export interface ChatEntry {
  from: 'user' | 'pet' | 'system';
  text: string;
  tick: number;
  /** Presente solo en la vista previa de una receta descrita por el cuidador. */
  card?: RecipeCardView;
}

/**
 * Un objeto que acaba de pasar del suelo al inventario. Describe el hecho, no
 * la animación: la UI decide cómo representarlo, igual que con `speech`.
 */
export interface PickupView {
  itemId: string;
  kind: string;
  tick: number;
}

export interface SkillView {
  id: string;
  name: string;
  version: number;
  status: string;
  description: string;
  motivation: string;
  expectedOutcome: string;
  successCriteria: string[];
  lastEvaluationSuccessRate: number | null;
  totalRuns: number;
  successfulRuns: number;
  knownFailures: string[];
  parentVersionId: string | null;
  programSummary: string[];
}

export interface ExperimentView {
  tick: number;
  skillName: string;
  version: number | null;
  kind:
    | 'requested'
    | 'contract-agreed'
    | 'created'
    | 'test-started'
    | 'test-failed'
    | 'test-passed'
    | 'promoted'
    | 'rejected';
  detail: string;
}

export interface DevEventView {
  seq: number;
  tick: number;
  source: 'world' | 'agent';
  type: string;
  json: string;
}

/**
 * Un rasgo de personalidad derivado (nunca sorteado ni opinado por el modelo):
 * viene con la evidencia que lo justifica, para que el panel pueda mostrar de
 * dónde sale. Ver ADR 0021.
 */
export interface PersonalityTraitView {
  id: string;
  label: string;
  evidence: string;
}

export interface GoalView {
  id: string;
  description: string;
  status: string;
  source: string;
}

export interface GameView {
  seed: number;
  tick: number;
  running: boolean;
  speed: number;
  petColor: string;
  /** Nombre del proveedor de modelo activo ("mock", "codex", ...). */
  aiProvider: string;
  /** true mientras una consulta al modelo real está en vuelo. */
  aiBusy: boolean;
  /**
   * Si el proveedor simulado propone primero sus ideas equivocadas (ADR 0006,
   * adenda): el ciclo fallar→corregir a la vista. Es una preferencia guardada,
   * no el estado de un proveedor: existe (y se puede leer) aunque ahora mismo
   * piense con Codex — quien decide si aplica es `aiProvider`.
   */
  mockImperfect: boolean;
  identity: { name: string; generation: number; ancestorId: string | null };
  /** Informe de legado cuando la mascota está muerta; null en vida. */
  death: LegacyReport | null;
  legacyCount: number;
  worldSize: { width: number; height: number };
  entities: EntityView[];
  /** Catálogo de tipos de objeto: lo que hay, lo que lleva y lo construible. */
  items: ItemView[];
  /** Interacciones aprendidas del mundo (ADR 0027), reusables sin costo. */
  interactions: InteractionView[];
  pet: PetView | null;
  goals: GoalView[];
  currentGoal: GoalView | null;
  currentStrategy: string | null;
  lastAction: string | null;
  speech: { text: string; tick: number } | null;
  /** Recogida reciente, mientras dura su ventana de visibilidad; null si no hay. */
  pickup: PickupView | null;
  chat: ChatEntry[];
  skills: SkillView[];
  experiments: ExperimentView[];
  devEvents: DevEventView[];
  regressions: { scenarioName: string; seed: number; description: string }[];
  /** Rasgos emergentes derivados de su historia (0–4, deterministas). */
  personality: PersonalityTraitView[];
  facts: string[];
  hypotheses: { statement: string; confidence: number; resolved: string }[];
  storyCompleted: boolean;
}
