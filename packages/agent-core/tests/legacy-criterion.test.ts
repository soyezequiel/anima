import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import type { SkillDefinition } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import type { LegacyTestimony } from '../src/index.js';
import { AnimaAgent } from '../src/index.js';

/**
 * El criterio viaja con su origen (ADR 0030, fase E). Una vara de MOTIVO es una
 * constante del motor y la heredera la re-certifica sola; una de PEDIDO —o una
 * AUSENTE, de un guardado anterior al ADR— nació de palabras que la heredera no
 * miró, así que el legado no puede promoverla sin que su cuidadora la confirme.
 * Sin esto, un criterio malo se lavaría generación tras generación.
 */

function makeHeir() {
  return new AnimaAgent({
    petId: 'e1',
    petName: 'Heredera',
    provider: new MockModelProvider(),
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-16T00:00:00Z',
  });
}

/** Un artefacto heredable con el origen de vara que se le pida (o ninguno). */
function danceArtifact(criterionSource?: 'motive' | 'caretaker'): SkillDefinition {
  const library = new SkillLibrary();
  const skill = library.addExperimental({
    name: 'baile-basico',
    description: 'bailar de lado a lado',
    motivation: 'me lo enseñaron',
    program: [
      { op: 'moveStep', dir: 'right' },
      { op: 'moveStep', dir: 'left' },
    ],
    expectedOutcome: 'se mueve y vuelve',
    successCriteria: [{ type: 'minMoves', value: 2 }],
    ...(criterionSource !== undefined ? { criterionSource } : {}),
    createdAt: '2026-07-16T00:00:00Z',
  });
  return library.get(skill.id)!;
}

function testimonyWith(skill: SkillDefinition): LegacyTestimony {
  return { fromName: 'Ánima', generation: 1, knowledge: [], skills: [skill] };
}

describe('el legado no lava el criterio (ADR 0030 fase E)', () => {
  it('una conducta heredada por PEDIDO no se promueve sin confirmación', () => {
    const heir = makeHeir();
    const result = heir.adoptLegacy(testimonyWith(danceArtifact('caretaker')));

    expect(result.adoptedSkills[0]?.promoted).toBe(false);
    expect(result.adoptedSkills[0]?.needsConfirmation).toBe(true);
    // No entró como estable: nadie miró su vara todavía, así que ni se evaluó
    // ni se promovió.
    const types = heir.events.events.map((e) => e.type);
    expect(types).toContain('skill.inherited.unconfirmed');
    expect(types).not.toContain('skill.promoted');
    expect(types).not.toContain('skill.test.started');
  });

  it('un artefacto SIN origen (guardado viejo) tampoco: se re-confirma', () => {
    const heir = makeHeir();
    const result = heir.adoptLegacy(testimonyWith(danceArtifact(undefined)));

    expect(result.adoptedSkills[0]?.needsConfirmation).toBe(true);
    expect(heir.events.events.map((e) => e.type)).toContain('skill.inherited.unconfirmed');
  });

  it('el origen de la vara sobrevive al guardado (serialize/loadFrom)', () => {
    const library = new SkillLibrary();
    const skill = library.addExperimental({
      name: 'crear-refugio',
      description: 'x',
      motivation: 'x',
      program: [{ op: 'wait', ticks: 1 }],
      expectedOutcome: 'x',
      successCriteria: [{ type: 'craftedKind', kind: 'shelter' }],
      criterionSource: 'caretaker',
      createdAt: '2026-07-16T00:00:00Z',
    });

    const restored = new SkillLibrary();
    restored.loadFrom(library.serialize());
    expect(restored.get(skill.id)?.criterionSource).toBe('caretaker');
  });
});
