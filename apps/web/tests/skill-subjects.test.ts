import { describe, expect, it } from 'vitest';
import { reachBlockedResourceProgram } from '@anima/model-providers';
import type { SkillOp } from '@anima/skill-runtime';
import { skillSubjects } from '../src/session/skill-subjects.js';

/** Casi ninguna habilidad fabrica; las que lo hacen traen su receta al test. */
const noRecipes = () => null;

describe('skillSubjects', () => {
  it('sigue la cadena buscar → elegir → comer hasta el tipo', () => {
    // El caso que motivó todo: `consume` dice «objetivo», y el tipo quedó dos
    // ops atrás. Sin seguir la cadena, la tira saldría vacía.
    const ops: SkillOp[] = [
      { op: 'findEntities', query: { kind: 'baya' }, store: 'bayas' },
      { op: 'selectTarget', from: 'bayas', strategy: 'nearest', store: 'objetivo' },
      { op: 'moveToward', target: 'objetivo', maxSteps: 20 },
      { op: 'consume', target: 'objetivo' },
    ];
    expect(skillSubjects(ops, noRecipes)).toEqual([
      { kind: 'baya', label: 'baya', role: 'come' },
    ]);
  });

  it('separa la herramienta de lo que recibe el golpe', () => {
    const ops: SkillOp[] = [
      { op: 'findEntities', query: { kind: 'pico' }, store: 'picos' },
      { op: 'selectTarget', from: 'picos', strategy: 'strongestTool', store: 'pico' },
      { op: 'findEntities', query: { kind: 'roca' }, store: 'rocas' },
      { op: 'selectTarget', from: 'rocas', strategy: 'nearest', store: 'roca' },
      { op: 'useItem', item: 'pico', target: 'roca' },
    ];
    expect(skillSubjects(ops, noRecipes)).toEqual([
      { kind: 'pico', label: 'pico', role: 'usa' },
      { kind: 'roca', label: 'roca', role: 'golpea' },
    ]);
  });

  it('se queda con el papel más específico cuando un tipo aparece dos veces', () => {
    // Camina hasta la baya y se la come: es «come baya», no «busca baya».
    const ops: SkillOp[] = [
      { op: 'gpsTo', kind: 'baya', maxSteps: 40, store: 'objetivo' },
      { op: 'consume', target: 'objetivo' },
    ];
    expect(skillSubjects(ops, noRecipes)).toEqual([
      { kind: 'baya', label: 'baya', role: 'come' },
    ]);
  });

  it('describe por rasgo lo que se buscó sin tipo', () => {
    const ops: SkillOp[] = [
      { op: 'findEntities', query: { edible: true }, store: 'comida' },
      { op: 'selectTarget', from: 'comida', strategy: 'nearest', store: 'objetivo' },
      { op: 'consume', target: 'objetivo' },
    ];
    expect(skillSubjects(ops, noRecipes)).toEqual([
      { kind: null, label: 'algo comestible', role: 'come' },
    ]);
  });

  it('entra en las ramas y los bucles', () => {
    const ops: SkillOp[] = [
      {
        op: 'repeatWithLimit',
        max: 5,
        body: [
          {
            op: 'branch',
            if: { type: 'lastMoveBlocked' },
            then: [
              { op: 'findEntities', query: { kind: 'roca' }, store: 'rocas' },
              { op: 'selectTarget', from: 'rocas', strategy: 'nearest', store: 'roca' },
              { op: 'pickup', target: 'roca' },
            ],
            else: [{ op: 'place', kind: 'tabla', dx: 0, dy: 1 }],
          },
        ],
      },
    ];
    expect(skillSubjects(ops, noRecipes)).toEqual([
      { kind: 'roca', label: 'roca', role: 'junta' },
      { kind: 'tabla', label: 'tabla', role: 'construye' },
    ]);
  });

  it('traduce la receta al tipo que sale de ella', () => {
    const ops: SkillOp[] = [{ op: 'craft', recipeId: 'receta-pico' }];
    const product = (id: string) => (id === 'receta-pico' ? 'pico' : null);
    expect(skillSubjects(ops, product)).toEqual([
      { kind: 'pico', label: 'pico', role: 'fabrica' },
    ]);
  });

  it('ignora las anclas: guardan celdas, no cosas', () => {
    // `markTarget` sale de una entidad, pero lo que guarda es DÓNDE estaba.
    // Si esto entrara, `placeAt` mostraría la baya como si la construyera.
    const ops: SkillOp[] = [
      { op: 'findEntities', query: { kind: 'baya' }, store: 'bayas' },
      { op: 'selectTarget', from: 'bayas', strategy: 'nearest', store: 'objetivo' },
      { op: 'markTarget', from: 'objetivo', store: 'lugar' },
      { op: 'placeAt', kind: 'tabla', target: 'lugar' },
    ];
    expect(skillSubjects(ops, noRecipes)).toEqual([
      { kind: 'tabla', label: 'tabla', role: 'construye' },
    ]);
  });

  it('no inventa objetos cuando el store no existe', () => {
    // Un programa mal armado no tiene que romper el panel.
    const ops: SkillOp[] = [{ op: 'consume', target: 'fantasma' }];
    expect(skillSubjects(ops, noRecipes)).toEqual([]);
  });

  it('lee el programa REAL de «alcanzar recurso bloqueado»', () => {
    // No es un programa de laboratorio: es el que produce el sistema —el que
    // usan los e2e y el proveedor simulado— con sus 4 niveles de anidamiento y
    // sus 6 stores. Si la resolución se rompe, se rompe acá antes que en nada
    // inventado por mí para que pase.
    const subjects = skillSubjects(reachBlockedResourceProgram('strongestTool'), () => null);
    expect(subjects).toEqual([
      // La herramienta se junta y DESPUÉS se usa: gana «usa», el papel que
      // dice para qué la quería.
      { kind: null, label: 'una herramienta', role: 'usa' },
      { kind: 'wall', label: 'wall', role: 'golpea' },
      { kind: 'food', label: 'food', role: 'come' },
    ]);
  });

  it('deja fuera el trámite: soltar y hacer lugar no son objetos de la habilidad', () => {
    const ops: SkillOp[] = [
      { op: 'makeRoom', keep: ['pico', 'tabla'] },
      { op: 'findEntities', query: { kind: 'fibra' }, store: 'fibras' },
      { op: 'selectTarget', from: 'fibras', strategy: 'nearest', store: 'fibra' },
      { op: 'pickup', target: 'fibra' },
      { op: 'drop', target: 'fibra' },
    ];
    expect(skillSubjects(ops, noRecipes)).toEqual([
      { kind: 'fibra', label: 'fibra', role: 'junta' },
    ]);
  });
});
