import type { AnimaAgent, LegacyTestimony } from '@anima/agent-core';
import type { Vec2 } from '@anima/shared';
import type { WorldState } from '@anima/sim-core';
import { getEntity } from '@anima/sim-core';
import type { SkillDefinition, SkillLibrary } from '@anima/skill-runtime';
import type { KeyValueStore } from './kv.js';
import { readJson, writeJson } from './kv.js';
import type { PetIdentity } from './save.js';

/**
 * Informe de legado: lo que queda de una mascota cuando muere. Su sucesora lo
 * lee como testimonio (no como memoria propia): puede confiar, dudar,
 * verificar sus afirmaciones y re-evaluar sus habilidades.
 */
export interface LegacyReport {
  id: string;
  identity: PetIdentity;
  createdAt: string;
  diedAtTick: number;
  cause: { cause: string; certainty: number };
  stateBeforeDeath: {
    energy: number;
    health: number;
    position: Vec2 | null;
  };
  activeGoal: string | null;
  recentActions: string[];
  skillsUsed: {
    name: string;
    version: number;
    status: string;
    totalRuns: number;
    successfulRuns: number;
  }[];
  knowledge: { statement: string; confidence: number }[];
  openHypotheses: { statement: string; confidence: number }[];
  /**
   * Rasgos derivados de su historia real ("curiosa", "perseverante").
   * Opcional: los legados guardados antes de la personalidad no lo traen,
   * y se leen igual — misma regla que adoptar reglas nuevas del mundo.
   */
  traits?: string[];
  recommendations: string[];
  warnings: string[];
  unfinishedGoals: string[];
  messageToSuccessor: string;
  messageToUser: string;
  /** Habilidades estables como artefactos versionados reutilizables. */
  skillArtifacts: SkillDefinition[];
}

export interface BuildLegacyInput {
  identity: PetIdentity;
  world: WorldState;
  petId: string;
  agent: AnimaAgent;
  library: SkillLibrary;
  recentActions: string[];
  now: () => string;
}

const CAUSE_RECOMMENDATIONS: Record<string, string[]> = {
  starvation: [
    'no dejes que la energía llegue a cero: consumir alimento la recupera',
    'localiza pronto una fuente estable de alimento (un árbol la produce cada tanto)',
  ],
  injuries: [
    'algo del entorno me hirió hasta matarme: mantente lejos de lo que daña al tocarlo',
    'si la salud empieza a bajar sin hambre, aléjate primero y entiende después',
  ],
  hypothermia: [
    'morí de frío: busca una fuente de calor antes de que el cuerpo se enfríe del todo',
    'el fuego calienta a distancia pero quema de cerca: acércate, no te pegues',
  ],
};

export function buildLegacyReport(input: BuildLegacyInput): LegacyReport {
  const pet = getEntity(input.world, input.petId);
  const dead = pet?.components.dead;
  const cause = dead?.cause ?? 'desconocida';

  const facts = input.agent.memory.factList();
  const hypotheses = input.agent.memory
    .hypothesisList()
    .filter((h) => h.resolved === 'pending');
  const goals = input.agent.goals.all();
  const activeGoal = goals.find((g) => g.status === 'active');
  const unfinished = goals
    .filter((g) => g.status === 'active' || g.status === 'suspended')
    .map((g) => g.description);
  const stableSkills = input.library.all().filter((s) => s.status === 'stable');

  const warnings = input.library
    .all()
    .flatMap((s) => s.knownFailures.map((f) => `${s.name} v${s.version}: ${f.description}`));

  const knowledge = facts.map((f) => ({ statement: f.statement, confidence: f.confidence }));
  const messageToSuccessor =
    knowledge.length > 0 || stableSkills.length > 0
      ? `Aprendí ${knowledge.length} cosas de este mundo y te dejo ${stableSkills.length} habilidad(es) probada(s). ` +
        `No confíes en mí sin comprobarlo: verifica todo en tu propio mundo.`
      : 'No llegué a aprender mucho. Ten más suerte que yo.';

  return {
    id: `legacy-${input.identity.id}`,
    identity: structuredClone(input.identity),
    createdAt: input.now(),
    diedAtTick: dead?.atTick ?? input.world.tick,
    cause: { cause, certainty: dead ? 0.9 : 0.4 },
    stateBeforeDeath: {
      energy: pet?.components.energy?.current ?? 0,
      health: pet?.components.health?.current ?? 0,
      position: pet?.components.position ? { ...pet.components.position } : null,
    },
    activeGoal: activeGoal?.description ?? null,
    recentActions: [...input.recentActions],
    skillsUsed: input.library.all().map((s) => ({
      name: s.name,
      version: s.version,
      status: s.status,
      totalRuns: s.metrics.totalRuns,
      successfulRuns: s.metrics.successfulRuns,
    })),
    knowledge,
    openHypotheses: hypotheses.map((h) => ({
      statement: h.statement,
      confidence: h.confidence,
    })),
    traits: input.agent.personality().map((trait) => trait.label),
    recommendations: CAUSE_RECOMMENDATIONS[cause] ?? [
      'observa el mundo antes de actuar: mi final fue inesperado',
    ],
    warnings,
    unfinishedGoals: unfinished,
    messageToSuccessor,
    messageToUser: `Gracias por acompañarme. Cuida a quien venga después de mí.`,
    skillArtifacts: structuredClone(stableSkills),
  };
}

/** Convierte un informe en el testimonio que la sucesora puede adoptar. */
export function testimonyFromLegacy(legacy: LegacyReport): LegacyTestimony {
  return {
    fromName: legacy.identity.name,
    generation: legacy.identity.generation,
    knowledge: structuredClone(legacy.knowledge),
    skills: structuredClone(legacy.skillArtifacts),
    message: legacy.messageToSuccessor,
    // Legados anteriores a la personalidad no traen rasgos: viajan sin ellos.
    ...(legacy.traits && legacy.traits.length > 0 ? { traits: [...legacy.traits] } : {}),
  };
}

/** Identidad de la siguiente generación del linaje. */
export function successorIdentity(
  legacy: LegacyReport,
  options: { name?: string; now: () => string },
): PetIdentity {
  const generation = legacy.identity.generation + 1;
  return {
    id: `pet-${generation}-${legacy.identity.id}`,
    name: options.name ?? legacy.identity.name,
    generation,
    ancestorId: legacy.identity.id,
    bornAt: options.now(),
    ...(legacy.identity.color !== undefined ? { color: legacy.identity.color } : {}),
  };
}

const LEGACIES_KEY = 'legacies';

export async function appendLegacy(store: KeyValueStore, legacy: LegacyReport): Promise<void> {
  const existing = (await readJson<LegacyReport[]>(store, LEGACIES_KEY)) ?? [];
  if (!existing.some((l) => l.id === legacy.id)) existing.push(legacy);
  await writeJson(store, LEGACIES_KEY, existing);
}

export async function loadLegacies(store: KeyValueStore): Promise<LegacyReport[]> {
  return (await readJson<LegacyReport[]>(store, LEGACIES_KEY)) ?? [];
}
