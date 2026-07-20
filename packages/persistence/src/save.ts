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

/**
 * Versión del formato de guardado. Es lo único que separa un guardado que
 * este código sabe leer de uno que no, así que hay que subirla cuando el
 * formato deja de ser compatible hacia atrás. Agregar un campo NO obliga a
 * subirla si la frontera que lo restaura lo normaliza — `restoreSnapshot`
 * (sim-core) y los campos opcionales de `AgentPersistentState` hacen eso. Lo
 * que no vale es agregar un campo que el código nuevo da por sentado y dejar
 * el número quieto: ahí un guardado viejo entra como si fuera de hoy y
 * revienta adentro, lejos de acá.
 */
export const SAVE_VERSION = 1;

/**
 * Un guardado que este código no sabe leer. Se avisa en vez de devolver
 * `null`: del otro lado hay una partida del cuidador, y tratarla como "no hay
 * guardado" la reemplaza por un mundo nuevo sin que él se entere.
 */
export class IncompatibleSaveError extends Error {
  readonly foundVersion: unknown;

  constructor(foundVersion: unknown) {
    super(
      `Versión de guardado no soportada: ${String(foundVersion)} (este código lee la ${String(SAVE_VERSION)}).`,
    );
    this.name = 'IncompatibleSaveError';
    this.foundVersion = foundVersion;
  }
}

/** Formato de guardado completo de una sesión. Versionado desde el inicio. */
export interface SessionSaveData {
  /** `SAVE_VERSION` al escribirlo; al leerlo puede ser cualquier cosa. */
  version: number;
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
    version: SAVE_VERSION,
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
  if (data.version !== SAVE_VERSION) {
    throw new IncompatibleSaveError(data.version);
  }
  targets.library.loadFrom(data.library);
  targets.regressions.loadFrom(data.regressions);
  targets.agent.importState(data.agent);
  return restoreSnapshot(data.world);
}

const SAVE_KEY = 'save';
/** Donde va a parar un guardado ilegible en vez de al tacho. */
const SET_ASIDE_KEY = 'save.incompatible';

/**
 * En qué ranura vive esta partida. Ausente = la partida principal, la de
 * siempre, la que estaba antes de que existieran las ranuras.
 *
 * Existe porque los entrenamientos son MUNDOS distintos y compartían la ranura
 * con la partida principal: abrir un mapa borraba la mascota del cuidador sin
 * avisar. Con un selector a un clic, eso deja de ser un accidente raro y pasa a
 * ser lo que ocurre siempre.
 *
 * La clave se deriva, no se elige: `save` y `save:map:vado`. Un id de ranura
 * viaja tal cual a la clave, así que solo lo arma el código, nunca el usuario.
 */
export type SaveSlot = string | undefined;

function keyFor(slot: SaveSlot): string {
  return slot === undefined ? SAVE_KEY : `${SAVE_KEY}:${slot}`;
}

export async function saveSession(
  store: KeyValueStore,
  data: SessionSaveData,
  slot?: SaveSlot,
): Promise<void> {
  await writeJson(store, keyFor(slot), data);
}

/**
 * Devuelve `null` solo cuando NO hay guardado (o está corrupto sin remedio).
 * Un guardado legible pero de otra versión lanza `IncompatibleSaveError`: la
 * diferencia importa, porque "no hay nada" y "hay algo que no sé leer" piden
 * respuestas distintas y solo una de las dos se puede resolver en silencio.
 */
export async function loadSession(
  store: KeyValueStore,
  slot?: SaveSlot,
): Promise<SessionSaveData | null> {
  const data = await readJson<SessionSaveData>(store, keyFor(slot));
  if (data === null) return null;
  if (data.version !== SAVE_VERSION) throw new IncompatibleSaveError(data.version);
  return data;
}

/**
 * Aparta un guardado que no se pudo leer, para que el autoguardado siguiente
 * no lo pise. Es una partida ajena: no es nuestra para borrarla, aunque no
 * sepamos abrirla.
 */
export async function setAsideSave(store: KeyValueStore, slot?: SaveSlot): Promise<void> {
  const key = keyFor(slot);
  const raw = await store.get(key);
  if (raw === null) return;
  await store.set(slot === undefined ? SET_ASIDE_KEY : `${SET_ASIDE_KEY}:${slot}`, raw);
  await store.delete(key);
}

export async function clearSession(store: KeyValueStore, slot?: SaveSlot): Promise<void> {
  await store.delete(keyFor(slot));
}

/** La ranura de un entrenamiento. Deriva del id del mapa, no de su nombre. */
export function mapSlot(mapId: string): string {
  return `map:${mapId}`;
}
