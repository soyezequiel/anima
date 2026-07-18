import { describe, expect, it } from 'vitest';
import { createEventLog } from '@anima/shared';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { SkillProgram } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import type { AgentEvent } from '../src/index.js';
import { developSkill } from '../src/index.js';

/**
 * ADR 0055. Una habilidad puede estar hecha de otras habilidades.
 *
 * Dos mitades. COMPONER: el modelo ve el catálogo de lo que la mascota ya sabe
 * y puede llamarlo con `runSkill` en vez de reescribirlo. DESCOMPONER: ante un
 * problema demasiado grande puede contestar «creá antes estas piezas», y el
 * ciclo las diseña primero.
 *
 * La vara de una pieza es SU MADRE (decisión del cuidador): no se mide sola
 * —no tiene criterios propios, que sería dejar que el examinado escriba su
 * examen (ADR 0030)— sino que se promueve cuando la madre pasa sus mundos
 * usándola, y se archiva con ella si la madre no llega.
 */

const now = () => '2026-07-18T00:00:00Z';

class RecordingProvider extends ScriptedModelProvider {
  readonly seen: ModelRequest[] = [];
  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    return super.complete(request);
  }
}

function devConfig(provider: ScriptedModelProvider, library = new SkillLibrary(), maxVersions = 3) {
  return {
    provider,
    library,
    regressions: new RegressionStore(),
    scenarios: MVP_SCENARIOS,
    seeds: [11, 22, 33],
    maxTicksPerCase: 200,
    maxVersions,
    now,
  };
}

/** Resuelve los mundos del MVP: sirve como pieza que de verdad funciona. */
const REACH_FOOD: SkillProgram = [
  { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
  { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
  { op: 'moveToward', target: 'food', maxSteps: 40 },
  {
    op: 'branch',
    if: { type: 'lastMoveBlocked' },
    then: [
      { op: 'findEntities', query: { tool: true }, store: 'tools' },
      { op: 'selectTarget', from: 'tools', strategy: 'strongestTool', store: 'tool' },
      {
        op: 'branch',
        if: { type: 'not', cond: { type: 'holding', target: 'tool' } },
        then: [
          { op: 'moveToward', target: 'tool', maxSteps: 40 },
          { op: 'pickup', target: 'tool' },
        ],
      },
      { op: 'findEntities', query: { kind: 'wall' }, store: 'walls' },
      { op: 'selectTarget', from: 'walls', strategy: 'nearest', store: 'wall' },
      { op: 'moveToward', target: 'wall', maxSteps: 40 },
      {
        op: 'repeatWithLimit',
        max: 12,
        until: { type: 'not', cond: { type: 'sees', query: { kind: 'wall' } } },
        body: [{ op: 'useItem', item: 'tool', target: 'wall' }],
      },
      { op: 'moveToward', target: 'food', maxSteps: 40 },
    ],
  },
  { op: 'consume', target: 'food' },
];

const CONTRACT = {
  name: 'alcanzar-alimento-bloqueado',
  purpose: 'llegar hasta el alimento y consumirlo',
  motivation: 'tengo hambre y algo me tapa el paso',
  expectedOutcome: 'energía recuperada',
  successCriteria: [
    { type: 'consumedKind', kind: 'food' } as const,
    { type: 'energyIncreased' } as const,
  ],
  criterionSource: 'motive' as const,
};

const program = (p: unknown): ModelResponse => ({
  kind: 'skill.program',
  program: p,
  rationale: 'test',
});

describe('una habilidad hecha de otras habilidades (ADR 0055)', () => {
  it('le muestra al modelo lo que ya sabe hacer, sin ofrecerle la que está diseñando', async () => {
    const library = new SkillLibrary();
    const vieja = library.addExperimental({
      name: 'buscar-alimento',
      description: 'encontrar comida y comerla',
      motivation: 'hambre',
      program: REACH_FOOD,
      expectedOutcome: 'comió',
      successCriteria: [],
      createdAt: now(),
    });
    library.markPromoted(vieja.id);
    // Una versión vieja de la propia habilidad que se está diseñando: no debe
    // ofrecerse como pieza (sería invitar al ciclo que la validación rechaza).
    library.addExperimental({
      name: CONTRACT.name,
      description: 'intento anterior',
      motivation: 'x',
      program: [{ op: 'wait', ticks: 1 }],
      expectedOutcome: '',
      successCriteria: [],
      createdAt: now(),
    });

    const provider = new RecordingProvider([program(REACH_FOOD)]);
    await developSkill(CONTRACT, [], devConfig(provider, library), createEventLog<AgentEvent>(), 1);

    const propose = provider.seen.find((r) => r.kind === 'skill.propose');
    expect(propose).toBeDefined();
    const names = (propose as { library?: { name: string; trust: string }[] }).library ?? [];
    expect(names.map((s) => s.name)).toContain('buscar-alimento');
    expect(names.find((s) => s.name === 'buscar-alimento')?.trust).toBe('probada');
    // Ni ella misma, ni nada archivado.
    expect(names.map((s) => s.name)).not.toContain(CONTRACT.name);
  });

  it('compone: llama a una habilidad que ya sabía y con eso pasa las pruebas', async () => {
    const library = new SkillLibrary();
    const pieza = library.addExperimental({
      name: 'buscar-alimento',
      description: 'encontrar comida y comerla',
      motivation: 'hambre',
      program: REACH_FOOD,
      expectedOutcome: 'comió',
      successCriteria: [],
      createdAt: now(),
    });
    library.markPromoted(pieza.id);

    // La madre no reescribe nada: delega entera en la pieza.
    const provider = new ScriptedModelProvider([
      program([{ op: 'runSkill', skillName: 'buscar-alimento' }]),
    ]);
    const outcome = await developSkill(
      CONTRACT,
      [],
      devConfig(provider, library),
      createEventLog<AgentEvent>(),
      1,
    );

    expect(outcome.stableSkill).not.toBeNull();
    expect(outcome.stableSkill!.program).toEqual([
      { op: 'runSkill', skillName: 'buscar-alimento' },
    ]);
    // La dependencia queda anotada: es lo que hace posible la cascada.
    expect(outcome.stableSkill!.dependencies).toEqual([{ skillId: pieza.id }]);
  });

  it('rechaza sin gastar simulación una llamada a una habilidad que no existe', async () => {
    const provider = new ScriptedModelProvider([
      program([{ op: 'runSkill', skillName: 'habilidad-que-nadie-escribio' }]),
      program(REACH_FOOD),
    ]);
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider), events, 1);

    const rejected = events.events.filter((e) => e.type === 'skill.rejected');
    expect(rejected.length).toBeGreaterThan(0);
    expect(String(rejected[0]!.data.reason)).toContain('habilidad-que-nadie-escribio');
    // Y el ciclo sigue: la segunda propuesta, sana, se promueve.
    expect(outcome.stableSkill).not.toBeNull();
  });

  it('descompone: pide piezas, las diseña primero y después las compone', async () => {
    const provider = new RecordingProvider([
      // 1) La madre dice: esto es muy grande, hacé antes estas dos.
      {
        kind: 'skill.decomposition',
        parts: [
          { name: 'buscar-alimento', purpose: 'encontrar comida y comerla', expectedOutcome: 'comió' },
        ],
        rationale: 'hace falta resolver el paso bloqueado aparte',
      },
      // 2) El diseño de la pieza.
      program(REACH_FOOD),
      // 3) La madre, ahora sí, componiendo.
      program([{ op: 'runSkill', skillName: 'buscar-alimento' }]),
    ]);
    const library = new SkillLibrary();
    const events = createEventLog<AgentEvent>();
    const outcome = await developSkill(CONTRACT, [], devConfig(provider, library), events, 1);

    expect(outcome.stableSkill).not.toBeNull();

    // La pieza existe, nació con su madre por motivación, y quedó PROMOVIDA en
    // cascada: su examen fue que la madre pasara los mundos usándola.
    const pieza = library.versionsOf('buscar-alimento').at(-1);
    expect(pieza).toBeDefined();
    expect(pieza!.motivation).toContain(CONTRACT.name);
    expect(pieza!.status).toBe('stable');
    // Sin vara propia: los criterios son de la madre, no inventados por el modelo.
    expect(pieza!.successCriteria).toEqual([]);

    // A la pieza se le pidió el diseño SIN permiso de volver a descomponer.
    const sub = provider.seen.find(
      (r) => r.kind === 'skill.propose' && r.skillName === 'buscar-alimento',
    );
    expect(sub).toBeDefined();
    expect((sub as { mayDecompose?: boolean }).mayDecompose).toBe(false);
  });

  it('si la madre no llega a ninguna parte, sus piezas no quedan sueltas', async () => {
    const provider = new ScriptedModelProvider([
      {
        kind: 'skill.decomposition',
        parts: [{ name: 'pieza-inutil', purpose: 'no hace nada', expectedOutcome: 'nada' }],
        rationale: 'x',
      },
      program([{ op: 'wait', ticks: 1 }]),
      program([{ op: 'wait', ticks: 2 }]),
      program([{ op: 'wait', ticks: 3 }]),
      program([{ op: 'wait', ticks: 4 }]),
    ]);
    const library = new SkillLibrary();
    const outcome = await developSkill(
      CONTRACT,
      [],
      devConfig(provider, library),
      createEventLog<AgentEvent>(),
      1,
    );

    expect(outcome.stableSkill).toBeNull();
    // Archivada: nació sin vara propia, y la madre que la justificaba no llegó.
    const pieza = library.versionsOf('pieza-inutil').at(-1);
    expect(pieza?.status).toBe('archived');
  });
});
