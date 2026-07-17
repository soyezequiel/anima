import { describe, expect, it } from 'vitest';
import { getEntity, simEvent, spawn } from '@anima/sim-core';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { foodBehindWall, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, GOAL_RESTORE_ENERGY, runAgentInWorld } from '../src/index.js';

/**
 * Recuerdos de lo que hizo (ADR 0033). Antes de esto, la mascota rompía tres
 * tramos de pared y ante "¿por qué rompiste toda la pared?" solo podía decir
 * "sé que el martillo puede dañar una pared": aprendía la regla, no el
 * recuerdo. Estas pruebas fijan el camino completo — el mundo emite el evento,
 * observe() lo vuelve recuerdo con conteo, y el recuerdo llega al diálogo.
 */

function makeAgent(overrides: Partial<ConstructorParameters<typeof AnimaAgent>[0]> = {}) {
  const provider = new MockModelProvider();
  const library = new SkillLibrary();
  const regressions = new RegressionStore();
  const agent = new AnimaAgent({
    petId: 'e1',
    petName: 'Anima',
    provider,
    library,
    regressions,
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11, 22, 33],
    guidanceEnabled: true,
    now: () => '2026-07-16T00:00:00Z',
    ...overrides,
  });
  return { agent, provider, library, regressions };
}

/** Proveedor guionado por tipo de petición que registra lo que recibe. */
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
    return super.complete(request);
  }
}

function requestsOfKind<K extends ModelRequest['kind']>(
  seen: ModelRequest[],
  kind: K,
): Extract<ModelRequest, { kind: K }>[] {
  return seen.filter((r): r is Extract<ModelRequest, { kind: K }> => r.kind === kind);
}

describe('los eventos del mundo se vuelven recuerdos de acción', () => {
  it('romper con herramienta deja "rompí un wall con hammer" y repetirlo cuenta', () => {
    const { agent } = makeAgent();
    const batch = (targetId: string) => [
      simEvent('entity.damaged', 1, {
        id: targetId,
        targetKind: 'wall',
        byId: 'e1',
        itemId: 'e26',
        itemKind: 'hammer',
        damage: 5,
      }),
      simEvent('entity.destroyed', 1, { id: targetId, kind: 'wall', byId: 'e1' }),
    ];
    agent.observe(batch('w1'));
    agent.observe(batch('w2'));
    agent.observe(batch('w3'));

    const deeds = agent.memory.episodeList().filter((e) => e.kind === 'deed');
    expect(deeds).toHaveLength(1);
    expect(deeds[0]?.summary).toBe('rompí un wall con hammer');
    expect(deeds[0]?.occurrences).toBe(3);
    expect(deeds[0]?.data).toMatchObject({ targetKind: 'wall', itemKind: 'hammer' });
  });

  it('talar un árbol usa su propio verbo', () => {
    const { agent } = makeAgent();
    agent.observe([
      simEvent('entity.damaged', 1, {
        id: 't1',
        targetKind: 'tree',
        byId: 'e1',
        itemKind: 'hammer',
        damage: 5,
      }),
      simEvent('entity.destroyed', 1, { id: 't1', kind: 'tree', byId: 'e1' }),
    ]);
    expect(
      agent.memory.episodeList().some((e) => e.kind === 'deed' && e.summary === 'talé un tree con hammer'),
    ).toBe(true);
  });

  it('craftear, colocar y comer también dejan recuerdo; moverse no', () => {
    const { agent } = makeAgent();
    agent.observe([
      simEvent('item.crafted', 1, { actorId: 'e1', recipeId: 'torch', itemId: 'x1', itemKind: 'torch' }),
      simEvent('item.placed', 1, { actorId: 'e1', itemId: 'x2', itemKind: 'wall', at: { x: 1, y: 1 } }),
      simEvent('item.consumed', 1, { actorId: 'e1', itemId: 'x3', itemKind: 'food', nutrition: 30 }),
      simEvent('entity.moved', 1, { id: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }),
      simEvent('item.pickedUp', 1, { actorId: 'e1', itemId: 'x4', itemKind: 'log' }),
    ]);
    const summaries = agent.memory
      .episodeList()
      .filter((e) => e.kind === 'deed')
      .map((e) => e.summary);
    expect(summaries).toContain('construí un torch');
    expect(summaries).toContain('coloqué un wall');
    expect(summaries).toContain('comí un food');
    expect(summaries).toHaveLength(3);
  });

  it('lo que rompe OTRO actor no es un recuerdo propio', () => {
    const { agent } = makeAgent();
    agent.observe([
      simEvent('entity.destroyed', 1, { id: 'w9', kind: 'wall', byId: 'e99' }),
      simEvent('item.consumed', 1, { actorId: 'e99', itemId: 'x1', itemKind: 'food' }),
    ]);
    expect(agent.memory.episodeList().filter((e) => e.kind === 'deed')).toHaveLength(0);
  });
});

describe('la historia completa deja recuerdos y la mascota puede contarlos', () => {
  it('tras romper la pared, el recuerdo cuenta lo mismo que el mundo', async () => {
    const { agent, provider } = makeAgent();
    const bundle = foodBehindWall.build(5);
    const result = await runAgentInWorld(bundle.world, agent, {
      maxTicks: 300,
      stopWhen: (_w, a) => a.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed',
    });

    const wallsDestroyed = result.worldEvents.filter(
      (e) => e.type === 'entity.destroyed' && e.data.kind === 'wall' && e.data.byId === 'e1',
    ).length;
    expect(wallsDestroyed).toBeGreaterThan(0);

    const wallDeed = agent.memory
      .episodeList()
      .find((e) => e.kind === 'deed' && e.summary === 'rompí un wall con hammer');
    expect(wallDeed?.occurrences).toBe(wallsDestroyed);
    expect(
      agent.memory.episodeList().some((e) => e.kind === 'deed' && e.summary === 'comí un food'),
    ).toBe(true);

    // Y ahora la pregunta que antes no podía responder: el mock repite el
    // recuerdo que viaja en los hechos, sin inventar nada. (El mensaje entra
    // directo porque el tick del mundo ya avanzó con la historia.)
    agent.receiveUserMessage('¿por qué rompiste toda la pared?');
    const chat = await runAgentInWorld(bundle.world, agent, { maxTicks: 3 });
    const spoken = chat.worldEvents
      .filter((e) => e.type === 'agent.spoke')
      .map((e) => String(e.data.text));
    expect(spoken.some((text) => text.includes('rompí un wall con hammer'))).toBe(true);
    if (wallsDestroyed > 1) {
      expect(spoken.some((text) => text.includes(`×${wallsDestroyed}`))).toBe(true);
    }
    expect(provider.callCount('dialogue')).toBeGreaterThan(0);
  });
});

describe('los recuerdos viajan en el contexto del modelo', () => {
  it('el request de diálogo lleva los deeds como hechos "hice: ..."', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        { kind: 'command.interpretation', command: { action: 'not-command' } },
      ],
    });
    const { agent } = makeAgent({ provider });
    const bundle = foodBehindWall.build(5);
    getEntity(bundle.world, 'e1')!.components.energy!.current = 40;

    // Recuerdos sembrados como los dejaría observe(): mismo kind y formato.
    for (let i = 0; i < 3; i++) {
      agent.memory.recordEpisode({
        kind: 'deed',
        summary: 'rompí un wall con hammer',
        tick: i,
        importance: 0.6,
        data: { targetKind: 'wall', itemKind: 'hammer' },
      });
    }

    await runAgentInWorld(bundle.world, agent, {
      maxTicks: 3,
      userMessagesAt: { 0: '¿qué hiciste hoy?' },
    });

    const dialogue = requestsOfKind(provider.seen, 'dialogue');
    expect(dialogue.length).toBeGreaterThan(0);
    expect(dialogue[0]?.facts).toContain('hice: rompí un wall con hammer (×3)');
  });

  it('el juicio de destrucción sabe cuánto ya rompió', async () => {
    const provider = new TeachableModel({
      'interpret.command': [
        {
          kind: 'command.interpretation',
          command: { action: 'destroy-entity', targetKind: 'tree' },
        },
      ],
      'judge.destruction': [
        { kind: 'judgement', willing: false, reason: 'No quiero: los árboles dan comida.' },
      ],
    });
    const { agent } = makeAgent({ provider });
    const bundle = foodBehindWall.build(5);
    getEntity(bundle.world, 'e1')!.components.energy!.current = 40;
    // Un árbol pegado a la mascota: el pedido tiene que superar el "no lo veo".
    spawn(bundle.world, 'tree', {
      position: { x: 2, y: 3 },
      collider: { solid: true },
    });
    // Ya taló dos árboles en su vida: eso tiene que pesar en el juicio.
    for (let i = 0; i < 2; i++) {
      agent.memory.recordEpisode({
        kind: 'deed',
        summary: 'talé un tree con hammer',
        tick: i,
        importance: 0.6,
        data: { targetKind: 'tree', itemKind: 'hammer' },
      });
    }

    await runAgentInWorld(bundle.world, agent, {
      maxTicks: 3,
      userMessagesAt: { 0: 'tala el árbol' },
    });

    const judgements = requestsOfKind(provider.seen, 'judge.destruction');
    expect(judgements.length).toBeGreaterThan(0);
    expect(judgements[0]?.facts).toContain('ya rompí 2 tree antes');
  });
});
