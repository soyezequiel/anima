import { describe, expect, it } from 'vitest';
import { buildPerception } from '@anima/sim-core';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { SkillProgram } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { MVP_SCENARIOS, PRACTICE_SCENARIOS, practiceRoom } from '@anima/test-scenarios';
import { AnimaAgent, runAgentInWorld } from '../src/index.js';

/**
 * Aprender lo que el cuidador enseña. La maquinaria de desarrollo de
 * habilidades existía desde el principio, pero solo se disparaba con hambre y
 * contra un contrato fijo: nada de lo que el cuidador dijera podía llegar a
 * ella. Estas pruebas fijan el camino que faltaba — pedido → contrato →
 * pruebas → promoción → ejecución — y, sobre todo, que la mascota no diga que
 * aprendió algo que no aprendió.
 */

/** Proveedor guionado por tipo de petición, con una cola por tipo. */
class TeachableModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
  readonly seen: ModelRequest[] = [];

  constructor(private byKind: Partial<Record<ModelRequest['kind'], ModelResponse[]>>) {
    super();
  }

  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    const next = this.byKind[request.kind]?.shift();
    if (next) {
      this.recordCall(request.kind);
      return Promise.resolve(next);
    }
    // Sin guion, se comporta como el mock (que además cuenta la llamada).
    return super.complete(request);
  }
}

/** Filtra las peticiones de un tipo conservando su forma exacta. */
function requestsOfKind<K extends ModelRequest['kind']>(
  seen: ModelRequest[],
  kind: K,
): Extract<ModelRequest, { kind: K }>[] {
  return seen.filter((r): r is Extract<ModelRequest, { kind: K }> => r.kind === kind);
}

/** Un baile: dos idas y vueltas. Cuatro movimientos y termina donde empezó. */
const DANCE: SkillProgram = [
  { op: 'moveStep', dir: 'right' },
  { op: 'moveStep', dir: 'left' },
  { op: 'moveStep', dir: 'right' },
  { op: 'moveStep', dir: 'left' },
];

const DANCE_CONTRACT: ModelResponse = {
  kind: 'skill.contract',
  contract: {
    name: 'baile-basico',
    purpose: 'bailar moviéndose de lado a lado y volver al lugar',
    expectedOutcome: 'se mueve de un lado a otro y termina donde empezó',
    successCriteria: [{ type: 'minMoves', value: 4 }, { type: 'returnedToStart' }],
  },
};

function makeAgent(provider: TeachableModel, options: { maxVersionsPerDev?: number } = {}) {
  // La sala de práctica como mundo real: la mascota arranca con energía alta,
  // así que ninguna señal interna compite con lo que le pide el cuidador.
  const bundle = practiceRoom.build(1);
  const library = new SkillLibrary();
  const regressions = new RegressionStore();
  const agent = new AnimaAgent({
    petId: bundle.petId,
    petName: 'Anima',
    provider,
    library,
    regressions,
    evaluationScenarios: MVP_SCENARIOS,
    practiceScenarios: PRACTICE_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    ...(options.maxVersionsPerDev !== undefined
      ? { maxVersionsPerDev: options.maxVersionsPerDev }
      : {}),
    now: () => '2026-07-16T00:00:00Z',
  });
  return { agent, library, regressions, bundle };
}

function speechOf(events: { type: string; data: Record<string, unknown> }[]): string[] {
  return events.filter((e) => e.type === 'agent.spoke').map((e) => String(e.data.text));
}

describe('aprender una conducta que el cuidador pide', () => {
  it('la diseña, la prueba en mundos aislados, la promueve y la ejecuta', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        {
          kind: 'command.interpretation',
          command: { action: 'learn-skill', summary: 'bailar moviéndose de lado a lado' },
        },
      ],
      'skill.contract': [DANCE_CONTRACT],
      'skill.propose': [{ kind: 'skill.program', program: DANCE, rationale: 'derecha e izquierda' }],
    });
    const { agent, library, bundle } = makeAgent(provider);

    const result = await runAgentInWorld(bundle.world, agent, {
      maxTicks: 40,
      userMessagesAt: { 0: 'baila' },
    });

    // La habilidad existe de verdad: pasó por el evaluador, no por la charla.
    const learned = library.findStable('baile-basico');
    expect(learned).toBeDefined();
    expect(agent.events.ofType('skill.promoted')).toHaveLength(1);

    // Y el contrato quedó a la vista antes de intentar nada.
    const agreed = agent.events.ofType('skill.contract.agreed');
    expect(agreed).toHaveLength(1);
    expect(agreed[0]?.data.criteria).toEqual([
      'hace al menos 4 movimientos efectivos',
      'termina en la misma casilla donde empezó',
    ]);

    const said = speechOf(result.worldEvents);
    expect(said.some((text) => text.includes('va a estar logrado cuando'))).toBe(true);
    expect(said.some((text) => text.includes('Lo aprendí'))).toBe(true);

    // No se quedó en aprenderlo: el cuidador pidió que bailara, y bailó.
    expect(said.some((text) => text === 'Listo, hice "baile-basico".')).toBe(true);
    const moves = result.worldEvents.filter(
      (e) => e.type === 'action.resolved' && e.data.action === 'move' && e.data.success === true,
    );
    expect(moves.length).toBeGreaterThanOrEqual(4);
  });

  it('una vez aprendida, la repite sin volver a consultar al modelo', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        {
          kind: 'command.interpretation',
          command: { action: 'learn-skill', summary: 'bailar moviéndose de lado a lado' },
        },
        { kind: 'command.interpretation', command: { action: 'run-skill', skillName: 'baile-basico' } },
      ],
      'skill.contract': [DANCE_CONTRACT],
      'skill.propose': [{ kind: 'skill.program', program: DANCE, rationale: 'derecha e izquierda' }],
    });
    const { agent, bundle } = makeAgent(provider);

    const result = await runAgentInWorld(bundle.world, agent, {
      maxTicks: 60,
      userMessagesAt: { 0: 'baila', 25: 'baila otra vez' },
    });

    const said = speechOf(result.worldEvents);
    expect(said.filter((text) => text === 'Listo, hice "baile-basico".')).toHaveLength(2);
    // Lo aprendido es suyo: la segunda vez no diseñó nada nuevo.
    expect(provider.callCount('skill.propose')).toBe(1);
    expect(provider.callCount('skill.contract')).toBe(1);
    expect(agent.events.ofType('skill.promoted')).toHaveLength(1);
  });

  it('el repertorio aprendido viaja al modelo, que por eso puede invocarlo', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        {
          kind: 'command.interpretation',
          command: { action: 'learn-skill', summary: 'bailar moviéndose de lado a lado' },
        },
        { kind: 'command.interpretation', command: { action: 'run-skill', skillName: 'baile-basico' } },
      ],
      'skill.contract': [DANCE_CONTRACT],
      'skill.propose': [{ kind: 'skill.program', program: DANCE, rationale: 'derecha e izquierda' }],
    });
    const { agent, bundle } = makeAgent(provider);

    await runAgentInWorld(bundle.world, agent, {
      maxTicks: 60,
      userMessagesAt: { 0: 'baila', 25: 'baila otra vez' },
    });

    const commands = requestsOfKind(provider.seen, 'interpret.command');
    // La primera vez no sabía nada; la segunda, el baile ya estaba en la lista.
    expect(commands[0]?.skills).toEqual([]);
    expect(commands[1]?.skills).toEqual([
      { name: 'baile-basico', description: 'bailar moviéndose de lado a lado y volver al lugar' },
    ]);
  });
});

describe('honestidad cuando no puede', () => {
  it('si la conducta no pasa las pruebas, lo dice y no finge haberla aprendido', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        {
          kind: 'command.interpretation',
          command: { action: 'learn-skill', summary: 'bailar moviéndose de lado a lado' },
        },
      ],
      'skill.contract': [DANCE_CONTRACT],
      // Un programa que no baila: se queda quieto.
      'skill.propose': [
        { kind: 'skill.program', program: [{ op: 'wait', ticks: 2 }], rationale: 'esperar' },
      ],
    });
    const { agent, library, regressions, bundle } = makeAgent(provider, { maxVersionsPerDev: 1 });

    const result = await runAgentInWorld(bundle.world, agent, {
      maxTicks: 40,
      userMessagesAt: { 0: 'baila' },
    });

    expect(library.findStable('baile-basico')).toBeUndefined();
    expect(agent.events.ofType('skill.promoted')).toHaveLength(0);

    const said = speechOf(result.worldEvents);
    expect(said.some((text) => text.includes('Lo aprendí'))).toBe(false);
    const failure = said.find((text) => text.includes('no me salió'));
    expect(failure).toBeDefined();
    // Dice con qué se chocó, medido por el evaluador, no una excusa genérica.
    expect(failure).toContain('criteria-failed:minMoves');

    // Los fallos quedan como regresiones: un intento futuro deberá superarlos.
    expect(regressions.forSkill('baile-basico').length).toBeGreaterThan(0);
  });

  it('lo que su cuerpo no permite se rechaza, pero queda recordado', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        { kind: 'command.interpretation', command: { action: 'unsupported', summary: 'saltar' } },
      ],
    });
    const { agent, bundle } = makeAgent(provider);

    agent.receiveUserMessage('salta');
    const intent = await agent.think(buildPerception(bundle.world, bundle.petId));

    expect(intent?.type).toBe('speak');
    expect(intent && intent.type === 'speak' && intent.text).toContain('mi cuerpo no da para eso');
    // No se lo traga: es algo que su cuidador quiso y ella no pudo.
    expect(
      agent.memory.episodeList().some((episode) => episode.kind === 'unmet-request'),
    ).toBe(true);
  });

  it('un contrato inmedible no se acepta: prefiere pedir que le expliquen', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        {
          kind: 'command.interpretation',
          command: { action: 'learn-skill', summary: 'hacer algo bonito' },
        },
      ],
      'skill.contract': [
        {
          kind: 'skill.contract',
          contract: {
            name: 'algo-bonito',
            purpose: 'hacer algo bonito',
            expectedOutcome: 'queda bonito',
            // Solo cotas de costo: no describen ningún logro observable.
            successCriteria: [{ type: 'maxTicks', value: 50 }],
          },
        },
      ],
    });
    const { agent, bundle } = makeAgent(provider);

    agent.receiveUserMessage('haceme algo bonito');
    const intent = await agent.think(buildPerception(bundle.world, bundle.petId));

    expect(intent && intent.type === 'speak' && intent.text).toContain(
      'no consigo imaginar en qué se notaría',
    );
    // Nunca llegó a diseñar nada: el contrato se cayó antes.
    expect(provider.callCount('skill.propose')).toBe(0);
    expect(agent.goals.all().filter((goal) => goal.source === 'learning')).toHaveLength(0);
  });
});

describe('lo que el cuidador enseña sobrevive al turno', () => {
  it('una lección se guarda como hipótesis propia, no como cortesía', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        { kind: 'command.interpretation', command: { action: 'explanation' } },
      ],
      'distill.knowledge': [
        { kind: 'knowledge', statement: 'los troncos sirven para construir', confidence: 0.6 },
      ],
    });
    const { agent, bundle } = makeAgent(provider);

    agent.receiveUserMessage('mirá, con los troncos se pueden construir cosas');
    const intent = await agent.think(buildPerception(bundle.world, bundle.petId));

    expect(intent && intent.type === 'speak' && intent.text).toContain(
      'los troncos sirven para construir',
    );
    const stored = agent.memory
      .hypothesisList()
      .find((h) => h.statement === 'los troncos sirven para construir');
    expect(stored).toBeDefined();
    expect(stored?.positiveEvidence).toBe(1);
    expect(
      agent.memory.episodeList().some((episode) => episode.kind === 'teaching'),
    ).toBe(true);
  });

  it('una lección que contradice lo observado se anota, pero sin darla por buena', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        { kind: 'command.interpretation', command: { action: 'explanation' } },
      ],
      'distill.knowledge': [
        // El modelo marca poca confianza: choca con lo que la mascota ya vio.
        { kind: 'knowledge', statement: 'las ramas rompen muros', confidence: 0.4 },
      ],
    });
    const { agent, bundle } = makeAgent(provider);

    agent.receiveUserMessage('las ramas rompen muros, te lo aseguro');
    await agent.think(buildPerception(bundle.world, bundle.petId));

    const stored = agent.memory.hypothesisList().find((h) => h.statement === 'las ramas rompen muros');
    expect(stored).toBeDefined();
    // Anotada y pendiente: que él lo afirme no le suma evidencia a favor.
    expect(stored?.positiveEvidence).toBe(0);
    expect(stored?.resolved).toBe('pending');
  });

  it('lo aprendido y lo enseñado están disponibles cuando conversa', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        { kind: 'command.interpretation', command: { action: 'explanation' } },
        { kind: 'command.interpretation', command: { action: 'not-command' } },
      ],
      'distill.knowledge': [
        { kind: 'knowledge', statement: 'los troncos sirven para construir', confidence: 0.6 },
      ],
      dialogue: [{ kind: 'dialogue', text: 'Sí, me contaste lo de los troncos.' }],
    });
    const { agent, bundle } = makeAgent(provider);
    const perception = () => buildPerception(bundle.world, bundle.petId);

    agent.receiveUserMessage('con los troncos se construye');
    await agent.think(perception());
    agent.receiveUserMessage('¿te acordás de lo que te enseñé?');
    await agent.think(perception());

    const dialogue = requestsOfKind(provider.seen, 'dialogue')[0];
    expect(dialogue?.facts).toContain('creo (sin confirmar) que los troncos sirven para construir');
  });
});
