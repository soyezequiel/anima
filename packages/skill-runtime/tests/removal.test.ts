import { describe, expect, it } from 'vitest';
import { SkillLibrary } from '../src/index.js';
import type { NewSkillInput } from '../src/index.js';

/**
 * Olvidar una habilidad (ADR 0075). La pregunta interesante no es si borra,
 * sino qué se lleva puesto: una habilidad que USA a otra no sobrevive a su
 * pieza, pero una que NACIÓ de otra sí sobrevive a su ancestro.
 */

function input(name: string, over: Partial<NewSkillInput> = {}): NewSkillInput {
  return {
    name,
    description: name,
    motivation: 'una necesidad',
    program: [],
    expectedOutcome: 'algo',
    successCriteria: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('planRemove', () => {
  it('se lleva a las que se apoyaban en ella, transitivamente', () => {
    const library = new SkillLibrary();
    const pieza = library.addExperimental(input('acercarse'));
    const media = library.addExperimental(
      input('juntar', { dependencies: [{ skillId: pieza.id }] }),
    );
    const madre = library.addExperimental(
      input('cocinar', { dependencies: [{ skillId: media.id }] }),
    );
    const ajena = library.addExperimental(input('dormir'));

    const plan = library.planRemove(pieza.id);
    expect(plan.removed).toEqual([pieza.id, media.id, madre.id].sort());
    expect(plan.removed).not.toContain(ajena.id);
  });

  it('la ascendencia no arrastra: una revisión sobrevive a su padre', () => {
    const library = new SkillLibrary();
    const v1 = library.addExperimental(input('abrigarse'));
    const v2 = library.addExperimental(input('abrigarse'), v1.id);

    const plan = library.planRemove(v1.id);
    expect(plan.removed).toEqual([v1.id]);
    expect(plan.orphaned).toEqual([v2.id]);
  });

  it('pedir olvidar algo que no está devuelve un plan vacío', () => {
    const library = new SkillLibrary();
    expect(library.planRemove('skill-99').removed).toEqual([]);
  });
});

describe('remove', () => {
  it('borra de verdad en vez de dejar un tombstone', () => {
    const library = new SkillLibrary();
    const skill = library.addExperimental(input('pescar'));
    library.remove(library.planRemove(skill.id));
    expect(library.get(skill.id)).toBeUndefined();
    expect(library.all()).toEqual([]);
    // Y no reaparece en el guardado, que es medio motivo de todo esto.
    expect(library.serialize().skills).toEqual([]);
  });

  it('a la huérfana le corta el puntero pero la deja viva y usable', () => {
    const library = new SkillLibrary();
    const v1 = library.addExperimental(input('abrigarse'));
    const v2 = library.addExperimental(input('abrigarse'), v1.id);
    library.markPromoted(v2.id);

    library.remove(library.planRemove(v1.id));

    const survivor = library.get(v2.id);
    expect(survivor).toBeDefined();
    expect(survivor!.parentVersionId).toBeUndefined();
    expect(library.findUsable('abrigarse')?.id).toBe(v2.id);
  });

  it('el contador no se reinicia: un id borrado no se reutiliza', () => {
    const library = new SkillLibrary();
    const first = library.addExperimental(input('pescar'));
    library.remove(library.planRemove(first.id));
    const second = library.addExperimental(input('pescar'));
    expect(second.id).not.toBe(first.id);
  });
});
