import type { AgentPersistentState, AnimaAgent } from '@anima/agent-core';
import type { WorldSnapshot, WorldState } from '@anima/sim-core';
import { restoreSnapshot, takeSnapshot } from '@anima/sim-core';
import type { RegressionData, RegressionStore } from '@anima/skill-evaluator';
import type { SkillLibrary, SkillLibraryData } from '@anima/skill-runtime';
import type { KeyValueStore } from './kv.js';
import { readJson, writeJson } from './kv.js';

/** Identidad de una mascota dentro de un linaje de generaciones. */
export interface PetIdentity {
  id: string;
  name: string;
  generation: number;
  ancestorId?: string;
  bornAt: string;
  color?: string;
}

/** Formato de guardado completo de una sesión. Versionado desde el inicio. */
export interface SessionSaveData {
  version: 1;
  savedAt: string;
  seed: number;
  identity: PetIdentity;
  world: WorldSnapshot;
  agent: AgentPersistentState;
  library: SkillLibraryData;
  regressions: RegressionData;
  /** Datos propios de la capa de presentación (chat, color, etc.). */
  ui?: unknown;
}

export interface CaptureInput {
  seed: number;
  identity: PetIdentity;
  world: WorldState;
  agent: AnimaAgent;
  library: SkillLibrary;
  regressions: RegressionStore;
  ui?: unknown;
  now: () => string;
}

export function captureSession(input: CaptureInput): SessionSaveData {
  return {
    version: 1,
    savedAt: input.now(),
    seed: input.seed,
    identity: structuredClone(input.identity),
    world: takeSnapshot(input.world),
    agent: input.agent.exportState(),
    library: input.library.serialize(),
    regressions: input.regressions.serialize(),
    ...(input.ui !== undefined ? { ui: structuredClone(input.ui) } : {}),
  };
}

/**
 * Aplica un guardado sobre instancias ya creadas. El mundo se devuelve nuevo
 * (es un dato); biblioteca, regresiones y agente se cargan en el lugar,
 * porque el agente ya fue construido apuntando a esas instancias.
 */
export function applySessionSave(
  data: SessionSaveData,
  targets: { agent: AnimaAgent; library: SkillLibrary; regressions: RegressionStore },
): WorldState {
  if (data.version !== 1) {
    throw new Error(`Versión de guardado no soportada: ${String(data.version)}`);
  }
  targets.library.loadFrom(data.library);
  targets.regressions.loadFrom(data.regressions);
  targets.agent.importState(data.agent);
  return restoreSnapshot(data.world);
}

const SAVE_KEY = 'save';

export async function saveSession(store: KeyValueStore, data: SessionSaveData): Promise<void> {
  await writeJson(store, SAVE_KEY, data);
}

export async function loadSession(store: KeyValueStore): Promise<SessionSaveData | null> {
  const data = await readJson<SessionSaveData>(store, SAVE_KEY);
  if (data === null || data.version !== 1) return null;
  return data;
}

export async function clearSession(store: KeyValueStore): Promise<void> {
  await store.delete(SAVE_KEY);
}
