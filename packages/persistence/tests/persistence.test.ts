import { beforeAll, describe, expect, it } from 'vitest';
import {
  AnimaAgent,
  GOAL_RESTORE_ENERGY,
  runAgentInWorld,
  SKILL_REACH_BLOCKED_FOOD,
} from '@anima/agent-core';
import { MockModelProvider } from '@anima/model-providers';
import type { WorldState } from '@anima/sim-core';
import { getEntity, hashWorld, spawn } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { foodBehindWall, MVP_SCENARIOS } from '@anima/test-scenarios';
import type { LegacyReport, PetIdentity, SessionSaveData } from '../src/index.js';
import {
  applySessionSave,
  buildLegacyReport,
  captureSession,
  clearSession,
  IncompatibleSaveError,
  loadLegacies,
  loadSession,
  MemoryKeyValueStore,
  appendLegacy,
  readJson,
  saveSession,
  setAsideSave,
  successorIdentity,
  testimonyFromLegacy,
  writeJson,
} from '../src/index.js';

const now = () => '2026-07-16T12:00:00Z';

function makeSetup() {
  const provider = new MockModelProvider();
  const library = new SkillLibrary();
  const regressions = new RegressionStore();
  const agent = new AnimaAgent({
    petId: 'e1',
    petName: 'Anima',
    provider,
    library,
    regressions,
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11, 22, 33],
    guidanceEnabled: true,
    now,
  });
  return { provider, library, regressions, agent };
}

const identity: PetIdentity = {
  id: 'pet-1',
  name: 'Ánima',
  generation: 1,
  bornAt: now(),
  color: '#f59e0b',
};

async function runStory(): Promise<{
  world: WorldState;
  setup: ReturnType<typeof makeSetup>;
}> {
  const setup = makeSetup();
  const bundle = foodBehindWall.build(5);
  await runAgentInWorld(bundle.world, setup.agent, {
    maxTicks: 300,
    stopWhen: (_w, a) => a.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed',
  });
  return { world: bundle.world, setup };
}

describe('almacenamiento clave-valor', () => {
  it('escribe y lee JSON, y tolera datos corruptos', async () => {
    const store = new MemoryKeyValueStore();
    await writeJson(store, 'x', { a: 1 });
    expect(await readJson(store, 'x')).toEqual({ a: 1 });
    await store.set('y', 'esto no es json{');
    expect(await readJson(store, 'y')).toBeNull();
    expect(await readJson(store, 'inexistente')).toBeNull();
  });
});

describe('guardado y restauración de sesión', () => {
  let saved: SessionSaveData;
  let originalHash: string;
  let originalProposeCalls: number;

  beforeAll(async () => {
    const { world, setup } = await runStory();
    originalHash = hashWorld(world);
    originalProposeCalls = setup.provider.callCount('skill.propose');
    saved = captureSession({
      seed: 5,
      identity,
      world,
      agent: setup.agent,
      library: setup.library,
      regressions: setup.regressions,
      ui: { chat: ['hola'] },
      now,
    });
    // Simula el viaje por el almacenamiento (serialización completa).
    saved = JSON.parse(JSON.stringify(saved)) as SessionSaveData;
  });

  it('el guardado sobrevive el round-trip por JSON', () => {
    expect(saved.version).toBe(1);
    expect(saved.identity.name).toBe('Ánima');
    expect(saved.library.skills.length).toBeGreaterThan(0);
    expect(saved.agent.memory.facts.length).toBeGreaterThan(0);
  });

  it('restaura mundo, skills, memoria y objetivos idénticos', () => {
    const fresh = makeSetup();
    const world = applySessionSave(saved, {
      agent: fresh.agent,
      library: fresh.library,
      regressions: fresh.regressions,
    });
    expect(hashWorld(world)).toBe(originalHash);
    expect(fresh.library.findStable(SKILL_REACH_BLOCKED_FOOD)?.version).toBe(2);
    expect(fresh.agent.memory.factList().map((f) => f.statement)).toContain(
      'consumir alimento recupera energía',
    );
    expect(fresh.agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status).toBe('completed');
  });

  it('la sesión restaurada puede continuar: nueva hambre sin nuevas consultas', async () => {
    const fresh = makeSetup();
    const world = applySessionSave(saved, {
      agent: fresh.agent,
      library: fresh.library,
      regressions: fresh.regressions,
    });
    const pet = getEntity(world, 'e1')!;
    pet.components.energy!.current = 12;
    spawn(world, 'food', {
      position: { x: 7, y: 1 },
      portable: {},
      edible: {},
      nutrition: { value: 30 },
    });
    await runAgentInWorld(world, fresh.agent, {
      maxTicks: 120,
      stopWhen: (_w, a) =>
        a.goals.all().filter((g) => g.description === GOAL_RESTORE_ENERGY && g.status === 'completed')
          .length >= 2,
    });
    expect(
      fresh.agent.goals.all().filter((g) => g.status === 'completed').length,
    ).toBeGreaterThanOrEqual(2);
    expect(fresh.provider.callCount('skill.propose')).toBe(0);
    expect(fresh.provider.callCount('interpret.signal')).toBe(0);
    // La original hizo 1 consulta de cada; la restaurada, cero.
    expect(originalProposeCalls).toBe(1);
  });

  it('save/load/clear contra el almacenamiento', async () => {
    const store = new MemoryKeyValueStore();
    expect(await loadSession(store)).toBeNull();
    await saveSession(store, saved);
    const loaded = await loadSession(store);
    expect(loaded?.identity.id).toBe('pet-1');
    await clearSession(store);
    expect(await loadSession(store)).toBeNull();
  });

  it('un guardado de otra versión se avisa y se aparta, no se borra en silencio', async () => {
    const store = new MemoryKeyValueStore();
    await saveSession(store, { ...saved, version: saved.version + 1 });

    // "No hay guardado" y "hay uno que no sé leer" no son lo mismo: devolver
    // null haría que la partida del cuidador se reemplace sin que se entere.
    await expect(loadSession(store)).rejects.toBeInstanceOf(IncompatibleSaveError);

    await setAsideSave(store);
    // Ya no estorba al arranque, pero sigue existiendo: no es nuestro para
    // borrarlo solo porque no sabemos abrirlo.
    expect(await readJson(store, 'save')).toBeNull();
    expect(await readJson<SessionSaveData>(store, 'save.incompatible')).not.toBeNull();
  });
});

describe('muerte, legado y sucesión', () => {
  let legacy: LegacyReport;

  beforeAll(async () => {
    const { world, setup } = await runStory();
    // La comida se acaba para siempre y la energía se agota.
    for (const entity of Object.values(world.entities)) {
      if (entity.kind === 'food' || entity.kind === 'tree') delete world.entities[entity.id];
    }
    const pet = getEntity(world, 'e1')!;
    pet.components.energy!.current = 0.01;
    pet.components.health!.current = 2;
    await runAgentInWorld(world, setup.agent, { maxTicks: 20 });
    expect(pet.components.dead).toBeDefined();

    legacy = buildLegacyReport({
      identity,
      world,
      petId: 'e1',
      agent: setup.agent,
      library: setup.library,
      recentActions: ['move', 'speak', 'wait'],
      now,
    });
  });

  it('el informe de legado captura causa, estado, conocimiento y artefactos', () => {
    expect(legacy.cause.cause).toBe('starvation');
    expect(legacy.cause.certainty).toBeGreaterThan(0.5);
    expect(legacy.stateBeforeDeath.energy).toBe(0);
    expect(legacy.knowledge.map((k) => k.statement)).toContain(
      'consumir alimento recupera energía',
    );
    expect(legacy.skillArtifacts.some((s) => s.name === SKILL_REACH_BLOCKED_FOOD)).toBe(true);
    expect(legacy.recommendations.length).toBeGreaterThan(0);
    expect(legacy.messageToSuccessor.length).toBeGreaterThan(10);
    // El objetivo de recuperar energía quedó inconcluso (reactivado al morir).
    expect(legacy.unfinishedGoals.length).toBeGreaterThan(0);
  });

  it('los legados se acumulan en el almacenamiento sin duplicarse', async () => {
    const store = new MemoryKeyValueStore();
    await appendLegacy(store, legacy);
    await appendLegacy(store, legacy);
    expect(await loadLegacies(store)).toHaveLength(1);
  });

  it('la sucesora hereda testimonio (hipótesis, no hechos) y re-evalúa las skills', async () => {
    const successorSetup = makeSetup();
    const testimony = testimonyFromLegacy(legacy);
    const result = successorSetup.agent.adoptLegacy(testimony);

    // Conocimiento como hipótesis "según X", nunca como hechos propios.
    expect(successorSetup.agent.memory.factList()).toHaveLength(0);
    const hypotheses = successorSetup.agent.memory.hypothesisList().map((h) => h.statement);
    expect(hypotheses.some((h) => h.startsWith('según Ánima,'))).toBe(true);

    // La skill heredada fue re-evaluada en su propio mundo y promovida.
    expect(result.adoptedSkills).toHaveLength(1);
    expect(result.adoptedSkills[0]?.promoted).toBe(true);
    expect(successorSetup.library.findStable(SKILL_REACH_BLOCKED_FOOD)).toBeDefined();
    const types = successorSetup.agent.events.events.map((e) => e.type);
    expect(types).toContain('legacy.read');
    expect(types).toContain('skill.test.started');
    expect(types).toContain('skill.promoted');

    // Con testimonio y skill verificada, sobrevive sin consultar ningún modelo.
    const bundle = foodBehindWall.build(9);
    await runAgentInWorld(bundle.world, successorSetup.agent, {
      maxTicks: 300,
      stopWhen: (_w, a) => a.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed',
    });
    expect(
      successorSetup.agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status,
    ).toBe('completed');
    expect(successorSetup.provider.callCount()).toBe(0);
  });

  it('la identidad de la sucesora incrementa la generación y enlaza el linaje', () => {
    const successor = successorIdentity(legacy, { now });
    expect(successor.generation).toBe(2);
    expect(successor.ancestorId).toBe('pet-1');
    expect(successor.name).toBe('Ánima');
  });

  /**
   * ADR 0047. Once generaciones seguidas murieron de hipotermia mientras el
   * informe calculaba "morí de frío: busca una fuente de calor antes de que el
   * cuerpo se enfríe del todo", se lo mostraba al cuidador en la pantalla de
   * muerte, y lo tiraba al heredar.
   */
  describe('la herencia lleva la lección que evita la muerte (ADR 0047)', () => {
    it('el testimonio incluye causa, proyectos inconclusos y recomendaciones', () => {
      const testimony = testimonyFromLegacy(legacy);
      expect(testimony.cause).toBe('starvation');
      expect(testimony.recommendations?.length).toBeGreaterThan(0);
      expect(testimony.unfinishedGoals?.length).toBeGreaterThan(0);
    });

    it('la sucesora recuerda de qué murió su antecesora y qué dejó pendiente', () => {
      const successorSetup = makeSetup();
      successorSetup.agent.adoptLegacy(testimonyFromLegacy(legacy));

      const episodes = successorSetup.agent.memory.episodeList();
      const death = episodes.find((e) => e.summary.includes('murió de starvation'));
      expect(death).toBeDefined();
      // Como FRACASO, que es el tipo que alimenta el contexto con el que
      // después diseña habilidades: la lección tiene que llegar a donde se
      // decide cómo intentarlo, no quedarse en color narrativo.
      expect(death?.kind).toBe('failure');
      expect(death?.summary).toContain('sin terminar');
    });

    it('las recomendaciones entran como testimonio a comprobar, no como verdad propia', () => {
      const successorSetup = makeSetup();
      successorSetup.agent.adoptLegacy(testimonyFromLegacy(legacy));

      const advice = successorSetup.agent.memory
        .hypothesisList()
        .filter((h) => h.statement.includes('no dejes que la energía llegue a cero'));
      expect(advice.length).toBeGreaterThan(0);
      expect(advice[0]?.statement.startsWith('según Ánima,')).toBe(true);
      expect(advice[0]?.confidence).toBeLessThanOrEqual(0.65);
      // Y nunca como hecho: lo heredado se verifica en el mundo propio.
      expect(successorSetup.agent.memory.factList()).toHaveLength(0);
    });

    it('el informe se lleva las reglas de construcción del mundo que muere', () => {
      // Sin esto la sucesora hereda la creencia "puedo construir X" sin la
      // receta, y la reinventa con otro nombre cada generación.
      expect(legacy.worldRecipes).toBeDefined();
      expect(legacy.worldRecipes?.length).toBeGreaterThan(0);
      expect(legacy.worldBlueprints).toBeDefined();
    });

    it('un legado viejo sin los campos nuevos se adopta igual', () => {
      // Compatibilidad: los guardados anteriores al ADR no traen nada de esto.
      const old = structuredClone(legacy) as Partial<typeof legacy>;
      delete old.worldRecipes;
      delete old.worldBlueprints;
      const successorSetup = makeSetup();
      expect(() =>
        successorSetup.agent.adoptLegacy({
          fromName: 'Ánima',
          generation: 1,
          knowledge: [],
          skills: [],
        }),
      ).not.toThrow();
      expect(successorSetup.agent.memory.episodeList().length).toBeGreaterThan(0);
    });
  });
});
