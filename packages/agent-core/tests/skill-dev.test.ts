import { describe, expect, it } from 'vitest';
import { createEventLog } from '@anima/shared';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider, reachBlockedResourceProgram } from '@anima/model-providers';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import type { AgentEvent } from '../src/index.js';
import { developSkill } from '../src/index.js';

const now = () => '2026-07-16T00:00:00Z';

/** Guionado, pero conservando cada petición: para inspeccionar qué vio el modelo. */
class RecordingProvider extends ScriptedModelProvider {
  readonly seen: ModelRequest[] = [];

  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    return super.complete(request);
  }
}

function devConfig(provider: ScriptedModelProvider, maxVersions = 2) {
  return {
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    scenarios: MVP_SCENARIOS,
    seeds: [11, 22, 33],
    maxTicksPerCase: 200,
    maxVersions,
    now,
  };
}

/**
 * Aproximación directa: funciona en campo abierto y fracasa con el muro.
 * Sirve como "mejor versión parcial" (50%) en las pruebas del ciclo.
 */
const DIRECT_APPROACH = [
  { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
  { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
  { op: 'moveToward', target: 'food', maxSteps: 40 },
  { op: 'consume', target: 'food' },
];

/** No consume nada: fracasa en todos los mundos (0%). */
const DO_NOTHING = [{ op: 'wait', ticks: 2 }];

const CONTRACT = {
  name: 'alcanzar-alimento-bloqueado',
  purpose: 'llegar hasta el alimento y consumirlo',
  motivation: 'test',
  expectedOutcome: 'energía recuperada',
  successCriteria: [
    { type: 'consumedKind', kind: 'food' } as const,
    { type: 'energyIncreased' } as const,
  ],
  criterionSource: 'motive' as const,
};

describe('desarrollo de skills con propuestas inválidas', () => {
  it('un programa inválido no consume intento y el error vuelve como feedback', async () => {
    const provider = new ScriptedModelProvider([
      // Propuesta 1: inválida (op desconocida). No debe consumir intento.
      { kind: 'skill.program', program: [{ op: 'volar' }], rationale: 'v inválida' },
      // Revisión con el feedback de validación: válida y correcta.
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'corregida',
      },
    ]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider), events, 0);

    expect(outcome.stableSkill).not.toBeNull();
    expect(outcome.stableSkill?.version).toBe(1);
    // La segunda llamada fue una revisión que recibió el error de validación.
    expect(provider.callCount('skill.propose')).toBe(1);
    expect(provider.callCount('skill.revise')).toBe(1);
    const rejected = events.ofType('skill.rejected');
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.data.reason)).toContain('programa inválido');
  });

  /**
   * El tope de propuestas ilegibles cuenta errores CONSECUTIVOS. El contador no
   * se reseteaba nunca, así que tres tropiezos de forma sueltos —uno en la v2,
   * otro en la v5, otro en la v7— cerraban un ciclo de ocho versiones que venía
   * corrigiendo bien, y el objetivo moría por un límite del compilador y no por
   * una razón del mundo.
   */
  it('un tropiezo de forma aislado no gasta el crédito de los anteriores', async () => {
    const provider = new ScriptedModelProvider([
      // v1: inválida. Racha de ilegibles = 1.
      { kind: 'skill.program', program: [{ op: 'volar' }], rationale: 'inválida' },
      // Se corrige y se mide: la racha tiene que volver a cero acá.
      { kind: 'skill.program', program: DO_NOTHING, rationale: 'medida, floja' },
      // Otra inválida más adelante: si el contador no se hubiera reseteado,
      // esta sería la tercera y el ciclo se cortaría sin llegar a la buena.
      { kind: 'skill.program', program: [{ op: 'nadar' }], rationale: 'inválida otra vez' },
      { kind: 'skill.program', program: [{ op: 'excavar' }], rationale: 'y otra' },
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'la buena',
      },
    ]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider, 4), events, 0);

    // Llegó hasta la versión que sirve en vez de cortarse en la tercera forma
    // mala. Las inválidas no consumen intento, así que hubo crédito de sobra.
    expect(outcome.stableSkill).not.toBeNull();
    expect(events.ofType('skill.rejected')).toHaveLength(3);
  });

  it('insistir con formas ilegibles seguidas sí corta el ciclo', async () => {
    // La otra mitad de la regla: lo que mata el ciclo es la RACHA, y ese tope
    // sigue existiendo — si no, un modelo que nunca produce algo legible
    // consumiría consultas para siempre.
    const provider = new ScriptedModelProvider([
      { kind: 'skill.program', program: [{ op: 'volar' }], rationale: '1' },
      { kind: 'skill.program', program: [{ op: 'nadar' }], rationale: '2' },
      { kind: 'skill.program', program: [{ op: 'excavar' }], rationale: '3' },
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'nunca se le pide',
      },
    ]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider, 4), events, 0);

    expect(outcome.stableSkill).toBeNull();
    expect(events.ofType('skill.rejected')).toHaveLength(3);
  });

  /**
   * ADR 0051. Cada consulta al modelo real cuesta ~un minuto de reloj mientras
   * el cuerpo se gasta; la evaluación local es de milisegundos. Dos estrategias
   * por consulta y corte por meseta reducen los viajes sin tocar al evaluador,
   * que es donde vive la calidad.
   */
  describe('aprender más rápido sin bajar la vara (ADR 0051)', () => {
    it('la alternativa de la misma consulta se mide, y si es la buena, gana', async () => {
      const provider = new ScriptedModelProvider([
        {
          kind: 'skill.program',
          program: DO_NOTHING,
          rationale: 'principal floja',
          alternate: {
            program: reachBlockedResourceProgram('strongestTool'),
            rationale: 'la buena, de regalo',
          },
        },
      ]);
      const events = createEventLog<AgentEvent>();
      const outcome = await developSkill(CONTRACT, [], devConfig(provider), events, 0);

      // Un solo viaje al modelo, dos versiones medidas, la alternativa promovida.
      expect(provider.callCount('skill.propose')).toBe(1);
      expect(provider.callCount('skill.revise')).toBe(0);
      expect(outcome.stableSkill).not.toBeNull();
      expect(outcome.versionsTried).toBe(2);
    });

    it('una alternativa rota no arrastra a la principal: se descarta sin costo', async () => {
      const provider = new ScriptedModelProvider([
        {
          kind: 'skill.program',
          program: reachBlockedResourceProgram('strongestTool'),
          rationale: 'principal correcta',
          alternate: { program: [{ op: 'volar' }], rationale: 'regalo ilegible' },
        },
      ]);
      const events = createEventLog<AgentEvent>();
      const outcome = await developSkill(CONTRACT, [], devConfig(provider), events, 0);

      expect(outcome.stableSkill).not.toBeNull();
      // La alternativa ilegible no gastó retroalimentación ni intento: era un
      // regalo, y un regalo roto se deja en la caja.
      expect(events.ofType('skill.rejected')).toHaveLength(0);
    });

    it('con una versión decente y sin mejora, corta antes de gastar los ocho viajes', async () => {
      // Tres estrategias distintas con la MISMA tasa (~50%): la meseta.
      const variant = (steps: number): unknown[] => [
        { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
        { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
        { op: 'moveToward', target: 'food', maxSteps: steps },
        { op: 'consume', target: 'food' },
      ];
      const provider = new ScriptedModelProvider([
        { kind: 'skill.program', program: variant(30), rationale: 'v1' },
        { kind: 'skill.program', program: variant(31), rationale: 'v2 igual de floja' },
        { kind: 'skill.program', program: variant(32), rationale: 'v3 igual de floja' },
        // Nunca debería llegar a pedirse:
        { kind: 'skill.program', program: variant(33), rationale: 'v4' },
      ]);
      const events = createEventLog<AgentEvent>();
      const outcome = await developSkill(
        CONTRACT,
        [],
        // keepMin 0.4: el 50% de la aproximación directa cuenta como "decente"
        // para esta prueba; la política real usa el umbral provisional.
        { ...devConfig(provider, 8), plateau: { patience: 2, keepMin: 0.4 } },
        events,
        0,
      );

      // Cortó en la tercera versión: dos seguidas sin mejorar la primera.
      expect(outcome.stoppedEarly).toBe('plateau');
      expect(outcome.versionsTried).toBe(3);
      expect(provider.callCount('skill.propose') + provider.callCount('skill.revise')).toBe(3);
      expect(events.ofType('skill.dev.plateau')).toHaveLength(1);
    });

    it('sin nada decente en la mano, la meseta no corta: sigue intentando', async () => {
      const variant = (ticks: number): unknown[] => [{ op: 'wait', ticks }];
      const provider = new ScriptedModelProvider([
        { kind: 'skill.program', program: variant(1), rationale: 'v1 inútil' },
        { kind: 'skill.program', program: variant(2), rationale: 'v2 inútil' },
        { kind: 'skill.program', program: variant(3), rationale: 'v3 inútil' },
        {
          kind: 'skill.program',
          program: reachBlockedResourceProgram('strongestTool'),
          rationale: 'v4: la buena',
        },
      ]);
      const events = createEventLog<AgentEvent>();
      const outcome = await developSkill(
        CONTRACT,
        [],
        { ...devConfig(provider, 8), plateau: { patience: 2, keepMin: 0.4 } },
        events,
        0,
      );

      // Cortar con 0% en la mano sería rendirse, no ahorrar: llegó a la buena.
      expect(outcome.stoppedEarly).toBeUndefined();
      expect(outcome.stableSkill).not.toBeNull();
    });
  });

  it('la revisión dice POR QUÉ se repregunta: forma inválida no es prueba fallada', async () => {
    const provider = new RecordingProvider([
      { kind: 'skill.program', program: [{ op: 'volar' }], rationale: 'v inválida' },
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'corregida',
      },
    ]);
    const events = createEventLog<AgentEvent>();
    await developSkill(CONTRACT, [], devConfig(provider), events, 0);

    const revisions = provider.seen.filter(
      (r): r is Extract<ModelRequest, { kind: 'skill.revise' }> => r.kind === 'skill.revise',
    );
    expect(revisions).toHaveLength(1);
    // Nunca se simuló nada: decirle que falló sus pruebas sería mentirle y
    // mandarlo a corregir una estrategia que nadie midió.
    expect(revisions[0]?.reason).toBe('invalid-program');
  });

  it('una propuesta repetida se nombra como tal, no como fallo de evaluación', async () => {
    const provider = new RecordingProvider([
      // v1: parcial. Se mide y no alcanza.
      { kind: 'skill.program', program: DIRECT_APPROACH, rationale: 'directo' },
      // Idéntica a la v1: no aporta nada y no llegó a simularse de nuevo.
      { kind: 'skill.program', program: DIRECT_APPROACH, rationale: 'lo mismo' },
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'otro enfoque',
      },
    ]);
    const events = createEventLog<AgentEvent>();
    await developSkill(CONTRACT, [], devConfig(provider, 4), events, 0);

    const reasons = provider.seen
      .filter((r): r is Extract<ModelRequest, { kind: 'skill.revise' }> => r.kind === 'skill.revise')
      .map((r) => r.reason);
    // La primera revisión sí nace de una evaluación medida; la segunda no.
    expect(reasons).toEqual(['evaluation-failed', 'repeated-program']);
  });

  it('corta tras varias propuestas inválidas seguidas (sin bucle)', async () => {
    const invalid = { kind: 'skill.program', program: { no: 'es-arreglo' }, rationale: '' } as const;
    const provider = new ScriptedModelProvider([invalid, invalid, invalid, invalid]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider), events, 0);
    expect(outcome.stableSkill).toBeNull();
    expect(events.ofType('skill.rejected').length).toBe(3);
    // Nunca llegó a simular nada.
    expect(events.ofType('skill.test.started')).toHaveLength(0);
  });
});

describe('el ciclo de revisión itera con memoria', () => {
  it('la revisión parte de la MEJOR versión, con historia y resultados por mundo', async () => {
    const provider = new RecordingProvider([
      // v1: parcial (pasa campo abierto, falla el muro).
      { kind: 'skill.program', program: DIRECT_APPROACH, rationale: 'directo' },
      // v2: peor que v1 (no consume nada en ningún mundo).
      { kind: 'skill.program', program: DO_NOTHING, rationale: 'esperar' },
      // v3: correcta.
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'romper el muro con la herramienta fuerte',
      },
    ]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, ['veo: hammer'], devConfig(provider, 4), events, 0);

    expect(outcome.stableSkill).not.toBeNull();
    expect(outcome.stableSkill?.version).toBe(3);

    const revisions = provider.seen.filter(
      (r): r is Extract<ModelRequest, { kind: 'skill.revise' }> => r.kind === 'skill.revise',
    );
    expect(revisions).toHaveLength(2);

    // Toda revisión conoce el objetivo, la vara y el contexto original.
    expect(revisions[0]?.problem).toBe(CONTRACT.purpose);
    expect(revisions[0]?.successCriteria?.length).toBeGreaterThan(0);
    expect(revisions[0]?.context).toEqual(['veo: hammer']);
    expect(revisions[0]?.maxAttempts).toBe(4);

    // La primera revisión ve dónde pasó y dónde falló la v1, mundo por mundo.
    const cases = revisions[0]?.caseResults ?? [];
    expect(cases.some((c) => c.verdict === 'passed')).toBe(true);
    expect(cases.some((c) => c.verdict === 'failed')).toBe(true);

    // La segunda revisión NO parte de la v2 (que empeoró): parte de la v1,
    // la mejor hasta ahora, y lleva la historia completa de lo intentado.
    expect(revisions[1]?.previousProgram).toEqual(DIRECT_APPROACH);
    expect(revisions[1]?.baseVersion).toBe(1);
    expect(revisions[1]?.history?.map((h) => h.version)).toEqual([1, 2]);
    expect(revisions[1]?.history?.[1]?.successRate).toBe(0);
  });

  it('una propuesta repetida vuelve como feedback sin gastar intento, y el ciclo sigue', async () => {
    const provider = new RecordingProvider([
      { kind: 'skill.program', program: DIRECT_APPROACH, rationale: 'directo' },
      // "Nueva" versión idéntica a la v1: antes esto mataba el ciclo.
      { kind: 'skill.program', program: DIRECT_APPROACH, rationale: 'insisto' },
      {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'ahora sí distinto',
      },
    ]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider, 4), events, 0);

    expect(outcome.stableSkill).not.toBeNull();
    // La repetición no consumió versión: la corrección real es la v2.
    expect(outcome.stableSkill?.version).toBe(2);

    const rejected = events.ofType('skill.rejected');
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.data.reason)).toContain('idéntica a la v1');

    // El feedback de repetición viajó al modelo en la revisión siguiente.
    const revisions = provider.seen.filter(
      (r): r is Extract<ModelRequest, { kind: 'skill.revise' }> => r.kind === 'skill.revise',
    );
    expect(
      revisions[1]?.failureObservations.some((o) => o.startsWith('propuesta-repetida')),
    ).toBe(true);
  });

  it('insistir con la misma propuesta agota los reintentos y corta el ciclo', async () => {
    const repeat = { kind: 'skill.program', program: DIRECT_APPROACH, rationale: '' } as const;
    const provider = new RecordingProvider([repeat, repeat, repeat, repeat]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider, 4), events, 0);

    expect(outcome.stableSkill).toBeNull();
    // Solo la primera se simuló; las tres repeticiones se rechazaron sin simular.
    expect(outcome.versionsTried).toBe(1);
    expect(events.ofType('skill.rejected')).toHaveLength(3);
    expect(events.ofType('skill.test.started')).toHaveLength(1);
  });
});
