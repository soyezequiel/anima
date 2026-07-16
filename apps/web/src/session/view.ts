import type { LegacyReport } from '@anima/persistence';

/**
 * View model inmutable que la sesión entrega a la UI en cada tick.
 * Es la única fuente de datos de React y Phaser: la UI nunca consulta el
 * motor ni el agente directamente, así no puede duplicar reglas del mundo.
 */

export interface EntityView {
  id: string;
  kind: string;
  x: number;
  y: number;
}

export interface PetView {
  id: string;
  x: number;
  y: number;
  alive: boolean;
  energy: { current: number; max: number };
  health: { current: number; max: number };
  inventory: { id: string; kind: string }[];
}

export interface ChatEntry {
  from: 'user' | 'pet' | 'system';
  text: string;
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
  kind: 'requested' | 'created' | 'test-started' | 'test-failed' | 'test-passed' | 'promoted' | 'rejected';
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
  chat: ChatEntry[];
  skills: SkillView[];
  experiments: ExperimentView[];
  devEvents: DevEventView[];
  regressions: { scenarioName: string; seed: number; description: string }[];
  facts: string[];
  hypotheses: { statement: string; confidence: number; resolved: string }[];
  storyCompleted: boolean;
}
