import { describe, expect, it } from 'vitest';
import { buildPerception } from '@anima/sim-core';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider, ScriptedModelProvider } from '@anima/model-providers';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import { foodBehindWall, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, GOAL_RESTORE_ENERGY } from '../src/index.js';

/**
 * Quién interpreta el chat: con un modelo que entiende lenguaje, él manda
 * sobre todos los mensajes; el parser determinista solo cubre a los
 * proveedores que no interpretan (mock) y rescata órdenes si el modelo falla.
 */

/** Proveedor de prueba que registra lo que se le pide y responde a guion. */
class FakeLanguageModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
  readonly seen: ModelRequest[] = [];

  constructor(private scripted: Partial<Record<ModelRequest['kind'], ModelResponse>>) {
    super();
  }

  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    const canned = this.scripted[request.kind];
    if (canned) return Promise.resolve(canned);
    return super.complete(request);
  }
}

function makeAgent(provider: ConstructorParameters<typeof AnimaAgent>[0]['provider']) {
  const bundle = foodBehindWall.build(5);
  const agent = new AnimaAgent({
    petId: bundle.petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-16T00:00:00Z',
  });
  return { agent, perception: () => buildPerception(bundle.world, bundle.petId) };
}

/** Procesa un mensaje del usuario y devuelve lo que la mascota respondió. */
async function say(
  agent: AnimaAgent,
  perception: ReturnType<typeof buildPerception>,
  text: string,
): Promise<string | null> {
  agent.receiveUserMessage(text);
  const intent = await agent.think(perception);
  return intent && intent.type === 'speak' ? intent.text : null;
}

describe('prioridad de interpretación con modelo real', () => {
  it('"¿el martillo sirve para algo?" ya no se confunde con la orden "para"', async () => {
    const provider = new FakeLanguageModel({
      'interpret.command': { kind: 'command.interpretation', command: { action: 'not-command' } },
      dialogue: { kind: 'dialogue', text: 'El martillo me sirve para romper muros.' },
    });
    const { agent, perception } = makeAgent(provider);

    const reply = await say(agent, perception(), '¿el martillo sirve para algo?');

    expect(reply).toBe('El martillo me sirve para romper muros.');
    // El modelo vio el mensaje: el parser no lo secuestró como wait-here.
    expect(provider.seen.map((r) => r.kind)).toEqual(['interpret.command', 'dialogue']);
    expect(agent.events.ofType('user.request.accepted')).toHaveLength(0);
  });

  it('una pregunta sobre comida y energía es charla, no una lección', async () => {
    const provider = new FakeLanguageModel({
      'interpret.command': { kind: 'command.interpretation', command: { action: 'not-command' } },
      dialogue: { kind: 'dialogue', text: 'Todavía no sé por qué, pero me hace bien.' },
    });
    const { agent, perception } = makeAgent(provider);

    const reply = await say(agent, perception(), '¿por qué la comida te da energía?');

    expect(reply).toBe('Todavía no sé por qué, pero me hace bien.');
    expect(reply).not.toContain('Gracias, eso me ayuda');
  });

  it('el modelo puede marcar una lección y esta reactiva objetivos suspendidos', async () => {
    const provider = new FakeLanguageModel({
      'interpret.command': { kind: 'command.interpretation', command: { action: 'explanation' } },
    });
    const { agent, perception } = makeAgent(provider);
    // Un objetivo suspendido esperando nueva información del usuario.
    const goal = agent.goals.create(
      {
        description: GOAL_RESTORE_ENERGY,
        source: 'internal-signal',
        priority: 0.9,
        urgency: 0.9,
        expectedValue: 1,
        preconditions: [],
        successCriteria: [],
        failureCriteria: [],
      },
      0,
    );
    agent.goals.suspend(goal.id, 'sin ideas', 'nueva información');

    const reply = await say(agent, perception(), 'comer alimento te devuelve la energía');

    expect(reply).toBe('Gracias, eso me ayuda a entender qué me pasa.');
    expect(agent.goals.get(goal.id)?.status).toBe('active');
    expect(agent.events.ofType('goal.reactivated')).toHaveLength(1);
  });

  it('el modelo interpreta órdenes libres que el parser no reconocería', async () => {
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'move-direction', directions: ['up'] },
      },
    });
    const { agent, perception } = makeAgent(provider);

    // Sin verbo de movimiento del catálogo del parser: solo el modelo lo entiende.
    await say(agent, perception(), 'un pasito hacia el norte, porfa');

    const accepted = agent.events.ofType('user.request.accepted');
    expect(accepted).toHaveLength(1);
    expect((accepted[0]?.data.request as { kind: string }).kind).toBe('move-direction');
  });

  it('si el modelo falla, el parser rescata una orden clara', async () => {
    const provider = new FakeLanguageModel({});
    provider.complete = () => Promise.reject(new Error('cuota agotada'));
    Object.defineProperty(provider, 'interpretsLanguage', { value: true });
    const { agent, perception } = makeAgent(provider);

    const reply = await say(agent, perception(), 'espera un momento');

    expect(reply).toBe('Puedo esperar aquí un momento.');
    const errors = agent.events.ofType('provider.error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.data.recoveredWith).toBe('parser');
  });

  it('si el modelo falla y el parser no entiende, el error llega al usuario', async () => {
    const provider = new FakeLanguageModel({});
    provider.complete = () => Promise.reject(new Error('cuota agotada'));
    Object.defineProperty(provider, 'interpretsLanguage', { value: true });
    const { agent, perception } = makeAgent(provider);

    const reply = await say(agent, perception(), '¿qué tal tu día?');

    expect(reply).toContain('No pude consultar');
    expect(reply).toContain('cuota agotada');
  });
});

describe('prioridad de interpretación con proveedor determinista', () => {
  it('el mock sigue usando el parser: mismas respuestas, sin cambios', async () => {
    const provider = new MockModelProvider();
    const { agent, perception } = makeAgent(provider);

    expect(await say(agent, perception(), 'espera un momento')).toBe(
      'Puedo esperar aquí un momento.',
    );
    // El parser resolvió la orden sin consultar nada al proveedor.
    expect(provider.callCount('interpret.command')).toBe(0);
  });

  it('el mock manda lo que el parser no entiende a charla', async () => {
    const provider = new MockModelProvider();
    const { agent, perception } = makeAgent(provider);

    const reply = await say(agent, perception(), 'hola');

    expect(reply).toContain('Hola');
    expect(provider.callCount('interpret.command')).toBe(1);
    expect(provider.callCount('dialogue')).toBe(1);
  });

  it('ScriptedModelProvider puede guionar el camino del modelo', async () => {
    const provider = new ScriptedModelProvider(
      [{ kind: 'command.interpretation', command: { action: 'wait-here' } }],
      { interpretsLanguage: true },
    );
    const { agent, perception } = makeAgent(provider);

    expect(await say(agent, perception(), 'cualquier cosa')).toBe('Puedo esperar aquí un momento.');
    expect(provider.remaining()).toBe(0);
  });
});
