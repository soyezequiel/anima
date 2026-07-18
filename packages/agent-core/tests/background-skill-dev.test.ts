import { describe, expect, it } from 'vitest';
import { buildPerception, stepWorld } from '@anima/sim-core';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { SkillProgram } from '@anima/skill-runtime';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { MVP_SCENARIOS, PRACTICE_SCENARIOS, practiceRoom } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * La práctica en segundo plano (ADR 0043). Con un proveedor real, el ciclo
 * propose→evaluate→revise tardaba minutos DENTRO de un solo think: la mente
 * entera quedaba afuera y no podía ni contestar el chat. Estas pruebas fijan
 * el contrato nuevo: un proveedor lento deja el ciclo en vuelo, ella sigue
 * viviendo (atiende mensajes) y el veredicto se consume en un think posterior
 * — sin cambiar nada del camino determinista del mock, que resuelve en
 * microtareas y nunca entra en vuelo.
 */

/** Un baile: dos idas y vueltas. El mismo de learning.test.ts. */
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

/**
 * Proveedor guionado cuyo `skill.propose` no responde hasta que el test lo
 * libere: la forma determinista de un modelo lento de verdad.
 */
class SlowProposeModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
  private releaseFn: (() => void) | null = null;

  constructor(private byKind: Partial<Record<ModelRequest['kind'], ModelResponse[]>>) {
    super();
  }

  /** Libera la propuesta demorada. Solo válido tras haberse consultado. */
  release(): void {
    if (!this.releaseFn) throw new Error('todavía no hay propuesta demorada');
    this.releaseFn();
    this.releaseFn = null;
  }

  override complete(request: ModelRequest): Promise<ModelResponse> {
    // El guion manda: solo se demora lo que no está guionado.
    const next = this.byKind[request.kind]?.shift();
    if (next) {
      this.recordCall(request.kind);
      return Promise.resolve(next);
    }
    if (request.kind === 'skill.propose' && this.releaseFn === null) {
      this.recordCall(request.kind);
      return new Promise((resolve) => {
        this.releaseFn = () =>
          resolve({ kind: 'skill.program', program: DANCE, rationale: 'derecha e izquierda' });
      });
    }
    return super.complete(request);
  }
}

describe('práctica de habilidad en segundo plano (ADR 0043)', () => {
  it('el think vuelve enseguida, ella sigue atendiendo y el veredicto llega después', async () => {
    const provider = new SlowProposeModel({
      'interpret.command': [
        {
          kind: 'command.interpretation',
          command: { action: 'learn-skill', summary: 'bailar moviéndose de lado a lado' },
        },
        {
          kind: 'command.interpretation',
          command: { action: 'rename-pet', name: 'Chispa' },
        },
      ],
      'skill.contract': [DANCE_CONTRACT],
    });
    const bundle = practiceRoom.build(1);
    const library = new SkillLibrary();
    const agent = new AnimaAgent({
      petId: bundle.petId,
      petName: 'Anima',
      provider,
      library,
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      practiceScenarios: PRACTICE_SCENARIOS,
      evaluationSeeds: [11],
      guidanceEnabled: false,
      now: () => '2026-07-18T00:00:00Z',
    });
    const world = bundle.world;
    const step = async (message?: string): Promise<void> => {
      if (message !== undefined) agent.receiveUserMessage(message);
      const perception = buildPerception(world, agent.petId);
      const intent = await agent.think(perception);
      const events = stepWorld(world, intent ? [{ actorId: agent.petId, intent }] : []);
      agent.observe(events);
    };

    // Pedido → contrato → confirmación (ADR 0030), y el ciclo arranca…
    await step('baila');
    await step('sí');
    for (let i = 0; i < 10 && !agent.skillDevInFlight; i++) await step();

    // …pero el proveedor lento lo deja EN VUELO: el think ya volvió (estamos
    // acá), el evento lo cuenta y la biblioteca aún no tiene nada estable.
    expect(agent.skillDevInFlight).toBe(true);
    expect(agent.events.ofType('skill.dev.background')).toHaveLength(1);
    expect(library.findStable('baile-basico')).toBeUndefined();

    // Sigue viva mientras practica: un mensaje nuevo se atiende igual.
    await step('a partir de ahora te llamás Chispa');
    expect(agent.events.ofType('pet.renamed')).toHaveLength(1);
    expect(agent.skillDevInFlight).toBe(true);

    // Llega la respuesta del modelo: el ciclo termina en segundo plano.
    provider.release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(agent.skillDevInFlight).toBe(false);

    // La promoción ya ocurrió DENTRO del ciclo (la biblioteca es del ciclo,
    // no del veredicto); lo que falta es que un think consuma el veredicto y
    // cierre el objetivo con su respuesta.
    expect(library.findStable('baile-basico')).toBeDefined();
    for (let i = 0; i < 6; i++) await step();
    expect(
      agent.events
        .ofType('goal.completed')
        .some((event) => String(event.data.strategy).startsWith('aprendizaje:')),
    ).toBe(true);
  });

  it('con el mock nada entra en vuelo: el veredicto vuelve en el mismo think', async () => {
    const provider = new SlowProposeModel({
      'interpret.command': [
        {
          kind: 'command.interpretation',
          command: { action: 'learn-skill', summary: 'bailar moviéndose de lado a lado' },
        },
      ],
      'skill.contract': [DANCE_CONTRACT],
      // Con la propuesta guionada (no demorada), todo resuelve en microtareas.
      'skill.propose': [{ kind: 'skill.program', program: DANCE, rationale: 'de lado a lado' }],
    });
    const bundle = practiceRoom.build(1);
    const library = new SkillLibrary();
    const agent = new AnimaAgent({
      petId: bundle.petId,
      petName: 'Anima',
      provider,
      library,
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      practiceScenarios: PRACTICE_SCENARIOS,
      evaluationSeeds: [11],
      guidanceEnabled: false,
      now: () => '2026-07-18T00:00:00Z',
    });
    const world = bundle.world;
    const step = async (message?: string): Promise<void> => {
      if (message !== undefined) agent.receiveUserMessage(message);
      const perception = buildPerception(world, agent.petId);
      const intent = await agent.think(perception);
      const events = stepWorld(world, intent ? [{ actorId: agent.petId, intent }] : []);
      agent.observe(events);
    };

    await step('baila');
    await step('sí');
    for (let i = 0; i < 10 && !library.findStable('baile-basico'); i++) {
      await step();
      // Nunca queda en vuelo: el mock gana la carrera del tick siempre.
      expect(agent.skillDevInFlight).toBe(false);
    }
    expect(library.findStable('baile-basico')).toBeDefined();
    expect(agent.events.ofType('skill.dev.background')).toHaveLength(0);
  });
});
