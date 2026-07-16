import { describe, expect, it } from 'vitest';
import { removeEntity, takeSnapshot } from '@anima/sim-core';
import type { SkillProgram } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { foodBehindWall } from '@anima/test-scenarios';
import { evaluateSkill, MAX_REAL_WORLD_CASES_PER_SKILL, RegressionStore } from '../src/index.js';

const now = () => '2026-07-16T00:00:00Z';

const reachBlockedFood: SkillProgram = [
  { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
  { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
  { op: 'moveToward', target: 'food', maxSteps: 30 },
  {
    op: 'branch',
    if: { type: 'lastMoveBlocked' },
    then: [
      { op: 'findEntities', query: { tool: true }, store: 'tools' },
      { op: 'selectTarget', from: 'tools', strategy: 'strongestTool', store: 'tool' },
      { op: 'moveToward', target: 'tool', maxSteps: 30 },
      { op: 'pickup', target: 'tool' },
      { op: 'findEntities', query: { kind: 'wall' }, store: 'walls' },
      { op: 'selectTarget', from: 'walls', strategy: 'nearest', store: 'wall' },
      { op: 'moveToward', target: 'wall', maxSteps: 30 },
      {
        op: 'repeatWithLimit',
        max: 6,
        until: { type: 'entityGone', ref: 'wall' },
        body: [{ op: 'useItem', item: 'tool', target: 'wall' }],
      },
      { op: 'moveToward', target: 'food', maxSteps: 30 },
    ],
  },
  { op: 'consume', target: 'food' },
];

function stableSkill(library: SkillLibrary) {
  const skill = library.addExperimental({
    name: 'alcanzar-alimento-bloqueado',
    description: 'llega al alimento y lo consume',
    motivation: 'test',
    program: reachBlockedFood,
    expectedOutcome: 'energía recuperada',
    successCriteria: [
      { type: 'consumedKind', kind: 'food' },
      { type: 'energyIncreased' },
    ],
    createdAt: now(),
  });
  return skill;
}

/** Mundo real donde la skill falla: sin martillo, solo la rama débil. */
function hostileSnapshot() {
  const bundle = foodBehindWall.build(5);
  for (const entity of Object.values(bundle.world.entities)) {
    if (entity.kind === 'hammer') removeEntity(bundle.world, entity.id);
  }
  return { snapshot: takeSnapshot(bundle.world), petId: bundle.petId };
}

describe('regresiones de mundo real (snapshot embebido)', () => {
  it('el evaluador reproduce el mundo del fallo y la skill vuelve a fallar', () => {
    const library = new SkillLibrary();
    const skill = stableSkill(library);
    const store = new RegressionStore();
    const { snapshot, petId } = hostileSnapshot();
    store.addRealWorldCase({
      skillName: skill.name,
      snapshot,
      petId,
      tick: 812,
      description: 'falló en el mundo real (sin herramienta suficiente)',
      createdAt: now(),
    });

    const report = evaluateSkill(skill, {
      scenarios: [],
      seeds: [],
      regressions: store.forSkill(skill.name),
      maxTicks: 200,
    });
    expect(report.cases).toHaveLength(1);
    expect(report.cases[0]?.scenario).toBe('mundo-real');
    expect(report.cases[0]?.fromRegression).toBe(true);
    expect(report.successRate).toBe(0);
    // La rama golpea sin causar daño: la observación clásica aparece.
    expect(report.failureObservations.some((o) => o.startsWith('no-damage-dealt'))).toBe(true);
  });

  it('reproducible: dos evaluaciones del mismo snapshot dan el mismo resultado', () => {
    const library = new SkillLibrary();
    const skill = stableSkill(library);
    const store = new RegressionStore();
    const { snapshot, petId } = hostileSnapshot();
    store.addRealWorldCase({
      skillName: skill.name,
      snapshot,
      petId,
      tick: 1,
      description: 'x',
      createdAt: now(),
    });
    const options = {
      scenarios: [],
      seeds: [],
      regressions: store.forSkill(skill.name),
      maxTicks: 200,
    };
    expect(evaluateSkill(skill, options).cases).toEqual(evaluateSkill(skill, options).cases);
  });

  it('aplica el tope por habilidad descartando el caso más antiguo', () => {
    const store = new RegressionStore();
    const { snapshot, petId } = hostileSnapshot();
    for (let i = 1; i <= MAX_REAL_WORLD_CASES_PER_SKILL + 2; i++) {
      store.addRealWorldCase({
        skillName: 'x',
        snapshot,
        petId,
        tick: i,
        description: `fallo ${i}`,
        createdAt: now(),
      });
    }
    const cases = store.realWorldCasesFor('x');
    expect(cases).toHaveLength(MAX_REAL_WORLD_CASES_PER_SKILL);
    expect(cases.map((c) => c.seed)).toEqual([3, 4, 5]);
  });

  it('sobrevive la serialización (round-trip con snapshot)', () => {
    const store = new RegressionStore();
    const { snapshot, petId } = hostileSnapshot();
    store.addRealWorldCase({
      skillName: 'x',
      snapshot,
      petId,
      tick: 7,
      description: 'fallo',
      createdAt: now(),
    });
    const restored = new RegressionStore();
    restored.loadFrom(JSON.parse(JSON.stringify(store.serialize())));
    expect(restored.realWorldCasesFor('x')).toHaveLength(1);
    expect(restored.realWorldCasesFor('x')[0]?.snapshot).toBeDefined();
  });
});
