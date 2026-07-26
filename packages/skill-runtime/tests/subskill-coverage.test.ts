import { describe, expect, it } from 'vitest';
import { SkillLibrary, type NewSkillInput } from '../src/index.js';

/**
 * Una hija solo queda estable si de verdad se usó.
 *
 * Una sub-habilidad no tiene vara propia: su examen es que la madre pase los
 * cuarenta mundos USÁNDOLA (ADR 0055). Esa última palabra es todo el asunto. La
 * promoción bajaba a TODAS las dependencias declaradas, y `dependencies` une dos
 * cosas que no coinciden: las piezas que nacieron para la madre y las que su
 * programa llama. El modelo puede pedir tres piezas y componer con dos.
 *
 * La tercera quedaba `stable` sin que un solo mundo la hubiera ejecutado, y
 * desde ahí se ofrecía al catálogo como conocimiento probado. Una credencial en
 * falso es peor que no tener credencial.
 */

function input(name: string, overrides: Partial<NewSkillInput> = {}): NewSkillInput {
  return {
    name,
    description: name,
    motivation: 'prueba',
    program: [{ op: 'wait', ticks: 1 }],
    expectedOutcome: 'algo',
    successCriteria: [{ type: 'energyIncreased' }],
    createdAt: '2026-07-25T00:00:00Z',
    ...overrides,
  };
}

describe('promoción en cascada de sub-habilidades', () => {
  it('promueve la pieza que la madre llama por nombre', () => {
    const library = new SkillLibrary();
    const child = library.addExperimental(input('acercarse'));
    const mother = library.addExperimental(
      input('comer', {
        program: [{ op: 'runSkill', skillName: 'acercarse' }],
        dependencies: [{ skillId: child.id }],
      }),
    );

    library.markPromoted(mother.id);

    expect(library.get(mother.id)!.status).toBe('stable');
    expect(library.get(child.id)!.status).toBe('stable');
  });

  it('promueve la pieza que la madre llama por id congelado', () => {
    const library = new SkillLibrary();
    const child = library.addExperimental(input('acercarse'));
    const mother = library.addExperimental(
      input('comer', {
        program: [{ op: 'runSkill', skillId: child.id }],
        dependencies: [{ skillId: child.id }],
      }),
    );

    library.markPromoted(mother.id);

    expect(library.get(child.id)!.status).toBe('stable');
  });

  it('NO promueve la pieza que nació para ella y su programa nunca ejecutó', () => {
    const library = new SkillLibrary();
    const used = library.addExperimental(input('acercarse'));
    const unused = library.addExperimental(input('rodear'));
    const mother = library.addExperimental(
      input('comer', {
        program: [{ op: 'runSkill', skillName: 'acercarse' }],
        // Las dos figuran como dependencia: nacieron para esta habilidad. Solo
        // una se usó, y solo esa tuvo cobertura en los mundos donde se midió.
        dependencies: [{ skillId: used.id }, { skillId: unused.id }],
      }),
    );

    library.markPromoted(mother.id);

    expect(library.get(used.id)!.status).toBe('stable');
    expect(library.get(unused.id)!.status).toBe('experimental');
    // Y no se ofrece como pieza probada para futuras composiciones.
    expect(library.findUsable('rodear')).toBeUndefined();
  });

  it('sigue la cadena en profundidad: la nieta que se usa también queda probada', () => {
    const library = new SkillLibrary();
    const grandchild = library.addExperimental(input('mirar'));
    const child = library.addExperimental(
      input('acercarse', {
        program: [{ op: 'runSkill', skillName: 'mirar' }],
        dependencies: [{ skillId: grandchild.id }],
      }),
    );
    const mother = library.addExperimental(
      input('comer', {
        program: [{ op: 'runSkill', skillName: 'acercarse' }],
        dependencies: [{ skillId: child.id }],
      }),
    );

    library.markPromoted(mother.id);

    expect(library.get(child.id)!.status).toBe('stable');
    expect(library.get(grandchild.id)!.status).toBe('stable');
  });

  it('una llamada dentro de una rama o un bucle también es cobertura', () => {
    const library = new SkillLibrary();
    const child = library.addExperimental(input('acercarse'));
    const mother = library.addExperimental(
      input('comer', {
        program: [
          {
            op: 'repeatWithLimit',
            max: 3,
            body: [
              {
                op: 'branch',
                if: { type: 'lastActionFailed' },
                then: [{ op: 'runSkill', skillName: 'acercarse' }],
              },
            ],
          },
        ],
        dependencies: [{ skillId: child.id }],
      }),
    );

    library.markPromoted(mother.id);

    expect(library.get(child.id)!.status).toBe('stable');
  });
});
