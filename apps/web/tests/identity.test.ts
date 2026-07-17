import { describe, expect, it } from 'vitest';
import { MemoryKeyValueStore } from '@anima/persistence';
import { GameSession } from '../src/session/GameSession.js';

async function makeSession(seed: number, store = new MemoryKeyValueStore()) {
  const session = await GameSession.create({ seed, autostart: false, store });
  return { session, store };
}

async function runUntil(
  session: GameSession,
  predicate: () => boolean,
  maxTicks = 400,
): Promise<void> {
  for (let i = 0; i < maxTicks && !predicate(); i++) {
    await session.stepOnce();
  }
}

describe('identidad: nombre editable', () => {
  it('el bautismo por chat cambia la identidad y ella estrena el nombre', async () => {
    const { session } = await makeSession(5);
    session.sendUserMessage('te voy a llamar Luna');
    await runUntil(
      session,
      () => session.getView().chat.some((entry) => entry.from === 'pet'),
      20,
    );

    const view = session.getView();
    expect(view.identity.name).toBe('Luna');
    // El nombre aparece en su habla: lo estrena en voz alta.
    expect(view.chat.some((entry) => entry.from === 'pet' && entry.text.includes('Luna'))).toBe(
      true,
    );
    // Y queda como recuerdo del vínculo, no solo como un campo.
    expect(view.devEvents.some((event) => event.type === 'pet.renamed')).toBe(true);
    session.dispose();
  });

  it('el nombre sobrevive a la recarga y sigue en su voz', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    session.sendUserMessage('tu nombre es Sol');
    await runUntil(session, () => session.getView().identity.name === 'Sol', 20);
    expect(session.getView().identity.name).toBe('Sol');
    session.dispose();

    const restored = await GameSession.create({ autostart: false, store });
    expect(restored.getView().identity.name).toBe('Sol');

    // Con el mock, preguntar por el nombre tiene respuesta determinista que
    // sale del hecho "me llamo Sol" que viaja en el prompt de diálogo.
    restored.sendUserMessage('¿cómo te llamas?');
    await runUntil(
      restored,
      () => restored.getView().chat.some((entry) => entry.text.includes('llamo Sol')),
      20,
    );
    expect(
      restored.getView().chat.some((entry) => entry.from === 'pet' && entry.text.includes('Sol')),
    ).toBe(true);
    restored.dispose();
  });

  it('renombrar desde la interfaz pasa por el agente y persiste', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    session.renamePet('Piedrita');
    expect(session.getView().identity.name).toBe('Piedrita');

    await runUntil(
      session,
      () => session.getView().chat.some((entry) => entry.from === 'pet'),
      20,
    );
    expect(
      session
        .getView()
        .chat.some((entry) => entry.from === 'pet' && entry.text.includes('Piedrita')),
    ).toBe(true);
    session.dispose();

    const restored = await GameSession.create({ autostart: false, store });
    expect(restored.getView().identity.name).toBe('Piedrita');
    restored.dispose();
  });
});

describe('personalidad y recuerdos en la sesión', () => {
  it('la historia del MVP produce rasgos deterministas visibles en el view', async () => {
    const { session } = await makeSession(5);
    await runUntil(session, () => session.getView().storyCompleted);

    const personality = session.getView().personality;
    // El camino directo falló dos veces y desarrolló dos versiones de la
    // habilidad: eso ES perseverancia, derivada y no opinada.
    expect(personality.map((trait) => trait.id)).toContain('perseverante');
    expect(personality.every((trait) => trait.evidence.length > 0)).toBe(true);
    session.dispose();
  });

  it('los rasgos viajan en el legado y la sucesora recuerda cómo era su antecesora', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    await runUntil(session, () => session.getView().storyCompleted);

    session.devKill();
    await runUntil(session, () => session.getView().death !== null, 20);
    const death = session.getView().death!;
    expect(death.traits ?? []).toContain('perseverante');

    await session.createSuccessor();
    // "mi antecesora era perseverante": el testimonio llegó como recuerdo.
    session.sendUserMessage('¿te acordás de algo?');
    await runUntil(
      session,
      () => session.getView().chat.some((entry) => entry.text.includes('mi antecesora')),
      20,
    );
    expect(
      session
        .getView()
        .chat.some(
          (entry) =>
            entry.from === 'pet' &&
            entry.text.includes('recuerdo que') &&
            entry.text.includes('perseverante'),
        ),
    ).toBe(true);
    session.dispose();
  });

  it('con el mock, "¿te acordás?" referencia un recuerdo real del cuidador', async () => {
    const { session } = await makeSession(5);
    // Un pedido cumplido es un recuerdo significativo del vínculo. La meta de
    // energía (prioridad mayor) puede adelantarse: se espera a que el pedido
    // realmente se cumpla antes de preguntar por él.
    session.sendUserMessage('espera un momento');
    await runUntil(
      session,
      () => session.getView().chat.some((entry) => entry.text.includes('esperé aquí')),
      120,
    );

    session.sendUserMessage('¿te acordás de lo que hicimos?');
    await runUntil(
      session,
      () => session.getView().chat.some((entry) => entry.text.startsWith('Sí: recuerdo que')),
      20,
    );
    expect(
      session
        .getView()
        .chat.some(
          (entry) => entry.from === 'pet' && entry.text.includes('recuerdo que cumplí la petición'),
        ),
    ).toBe(true);
    session.dispose();
  });
});
