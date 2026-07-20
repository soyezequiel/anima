import { describe, expect, it } from 'vitest';
import { groupExperiments } from '../src/components/experiments.js';
import type { ExperimentView } from '../src/session/view.js';

function ev(
  tick: number,
  skillName: string,
  version: number | null,
  kind: ExperimentView['kind'],
  detail = '',
): ExperimentView {
  return { tick, skillName, version, kind, detail };
}

/** El arco completo de una habilidad: falla el primer intento, aprueba el segundo. */
const ARCO: ExperimentView[] = [
  ev(100, 'alcanzar-alimento', null, 'requested', 'hambre bloqueada'),
  ev(102, 'alcanzar-alimento', 1, 'contract-agreed'),
  ev(105, 'alcanzar-alimento', 1, 'created'),
  ev(108, 'alcanzar-alimento', 1, 'test-started'),
  ev(120, 'alcanzar-alimento', 1, 'test-failed', 'no-damage-dealt'),
  ev(130, 'alcanzar-alimento', 2, 'created'),
  ev(135, 'alcanzar-alimento', 2, 'test-started'),
  ev(150, 'alcanzar-alimento', 2, 'test-passed'),
  ev(152, 'alcanzar-alimento', 2, 'promoted', 'pasó 8 de 8'),
];

describe('groupExperiments', () => {
  it('convierte el arco entero en una habilidad con dos intentos', () => {
    const trials = groupExperiments(ARCO);
    expect(trials).toHaveLength(1);
    const trial = trials[0]!;
    expect(trial.skillName).toBe('alcanzar-alimento');
    expect(trial.outcome).toBe('promoted');
    expect(trial.firstTick).toBe(100);
    expect(trial.lastTick).toBe(152);
    // Tres grupos: el preámbulo sin versión, y los dos intentos.
    expect(trial.attempts.map((a) => a.version)).toEqual([null, 1, 2]);
  });

  it('se queda con el ÚLTIMO veredicto del intento, no con el primero', () => {
    // v2 tiene `test-passed` y después `promoted`: lo que cuenta es en qué
    // terminó, no el primer veredicto que apareció.
    const v2 = groupExperiments(ARCO)[0]!.attempts[2]!;
    expect(v2.verdict?.kind).toBe('promoted');
    expect(v2.steps.map((s) => s.kind)).toEqual(['created', 'test-started', 'test-passed']);
  });

  it('separa el trámite del veredicto en el intento fallido', () => {
    const v1 = groupExperiments(ARCO)[0]!.attempts[1]!;
    expect(v1.verdict?.kind).toBe('test-failed');
    expect(v1.steps.map((s) => s.kind)).toEqual(['contract-agreed', 'created', 'test-started']);
  });

  it('un intento sin veredicto sigue en curso', () => {
    const trials = groupExperiments([
      ev(400, 'encender-fuego', null, 'requested'),
      ev(405, 'encender-fuego', 1, 'created'),
      ev(410, 'encender-fuego', 1, 'test-started'),
    ]);
    expect(trials[0]!.outcome).toBe('running');
    expect(trials[0]!.attempts[1]!.verdict).toBeNull();
  });

  it('aprobar las pruebas sin promoción todavía es estar en marcha', () => {
    const trials = groupExperiments([
      ev(10, 'x', 1, 'created'),
      ev(20, 'x', 1, 'test-passed'),
    ]);
    expect(trials[0]!.outcome).toBe('running');
  });

  it('haber aprendido no se deshace porque un intento posterior falle', () => {
    // v2 promovida, v3 rechazada al querer mejorarla: la habilidad SIGUE
    // sabiéndose. Mirar solo el último intento diría lo contrario.
    const trials = groupExperiments([
      ...ARCO,
      ev(200, 'alcanzar-alimento', 3, 'created'),
      ev(220, 'alcanzar-alimento', 3, 'rejected', 'peor que la anterior'),
    ]);
    expect(trials[0]!.outcome).toBe('promoted');
  });

  it('separa habilidades distintas y respeta el orden en que aparecieron', () => {
    const trials = groupExperiments([
      ev(10, 'segunda', 1, 'created'),
      ev(20, 'primera', 1, 'created'),
      ev(30, 'segunda', 1, 'promoted'),
    ]);
    expect(trials.map((t) => t.skillName)).toEqual(['segunda', 'primera']);
  });

  it('sin eventos no hay nada que agrupar', () => {
    expect(groupExperiments([])).toEqual([]);
  });

  it('un ciclo entero cae en UN grupo, no en uno por nombre distinto', () => {
    // La regresión que se vio en pantalla: `skill.test.failed` no trae `name`
    // y caía bajo el id crudo («skill 1»), partiendo el mismo ciclo en dos
    // paneles —la candidata en uno, su veredicto en el otro—. La sesión ahora
    // resuelve el id contra la biblioteca, así que acá llega un solo nombre.
    const trials = groupExperiments([
      ev(18, 'alcanzar-alimento-bloqueado', null, 'requested', 'hambre bloqueada'),
      ev(18, 'alcanzar-alimento-bloqueado', 1, 'created', 'primero el GPS'),
      ev(18, 'alcanzar-alimento-bloqueado', 1, 'test-failed', 'Éxito 50%'),
    ]);
    expect(trials).toHaveLength(1);
    expect(trials[0]!.attempts.filter((a) => a.version !== null)).toHaveLength(1);
    expect(trials[0]!.outcome).toBe('rejected');
  });
});
