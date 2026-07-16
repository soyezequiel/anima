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
}

export interface ChatEntry {
  from: 'user' | 'pet' | 'system';
  text: string;
  tick: number;
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
  identity: { name: string; generation: number; ancestorId: string | null };
  /** Informe de legado cuando la mascota está muerta; null en vida. */
  death: LegacyReport | null;
  legacyCount: number;
  worldSize: { width: number; height: number };
  entities: EntityView[];
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
  facts: string[];
  hypotheses: { statement: string; confidence: number; resolved: string }[];
  storyCompleted: boolean;
}
