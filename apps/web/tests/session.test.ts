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

describe('GameSession (capa de sesión de la UI)', () => {
  it('recorre la historia completa y expone todo al view model', async () => {
    const { session } = await makeSession(5);
    await runUntil(session, () => session.getView().storyCompleted);
    // Un par de ticks extra para que diga su explicación final.
    await session.stepOnce();
    await session.stepOnce();

    const view = session.getView();
    expect(view.storyCompleted).toBe(true);

    // Skills con versiones y estados visibles para el panel.
    expect(view.skills).toHaveLength(2);
    expect(view.skills.find((s) => s.version === 1)?.status).toBe('archived');
    expect(view.skills.find((s) => s.version === 2)?.status).toBe('stable');
    expect(view.skills[0]?.programSummary.length).toBeGreaterThan(3);

    // Historial de experimentos con el arco fallo->promoción.
    const kinds = view.experiments.map((e) => e.kind);
    expect(kinds).toContain('test-failed');
    expect(kinds).toContain('promoted');

    // Regresiones y memoria visibles.
    expect(view.regressions.length).toBeGreaterThan(0);
    expect(view.facts.length).toBeGreaterThan(0);

    // La mascota habló (globo + chat).
    expect(view.chat.some((c) => c.from === 'pet')).toBe(true);

    // Energía recuperada.
    expect(view.pet!.energy.current).toBeGreaterThan(20);
    session.dispose();
  });

  it('responde mensajes del usuario y permite reiniciar por semilla', async () => {
    const { session } = await makeSession(7);
    session.sendUserMessage('espera un momento');
    await runUntil(session, () => session.getView().chat.some((c) => c.from === 'pet'), 30);

    const chat = session.getView().chat;
    expect(chat.some((c) => c.from === 'user' && c.text === 'espera un momento')).toBe(true);
    expect(chat.some((c) => c.from === 'pet')).toBe(true);

    session.reset(9);
    const fresh = session.getView();
    expect(fresh.tick).toBe(0);
    expect(fresh.seed).toBe(9);
    expect(fresh.skills).toHaveLength(0);
    expect(fresh.chat.filter((c) => c.from === 'user')).toHaveLength(0);
    session.dispose();
  });

  it('pausa y velocidad quedan reflejadas en el view', async () => {
    const { session } = await makeSession(5);
    expect(session.getView().running).toBe(false);
    session.setSpeed(4);
    expect(session.getView().speed).toBe(4);
    session.setPetColor('#ef4444');
    expect(session.getView().petColor).toBe('#ef4444');
    session.dispose();
  });
});

describe('persistencia de la sesión', () => {
  it('guarda al completar la historia y otra sesión continúa desde ahí', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    await runUntil(session, () => session.getView().storyCompleted);
    const tickAtSave = session.getView().tick;
    session.dispose();

    // Una "recarga de página": misma tienda, sin fresh.
    const restored = await GameSession.create({ autostart: false, store });
    const view = restored.getView();
    expect(view.tick).toBeGreaterThanOrEqual(tickAtSave - 40);
    expect(view.storyCompleted).toBe(true);
    expect(view.skills).toHaveLength(2);
    expect(view.facts.length).toBeGreaterThan(0);
    expect(view.chat.some((c) => c.text.includes('Sesión restaurada'))).toBe(true);

    // Y puede seguir simulando sin errores.
    await restored.stepOnce();
    expect(restored.getView().tick).toBeGreaterThan(view.tick - 1);
    restored.dispose();
  });

  it('fresh ignora el guardado previo', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    await runUntil(session, () => session.getView().storyCompleted);
    session.dispose();

    const fresh = await GameSession.create({ seed: 5, autostart: false, store, fresh: true });
    expect(fresh.getView().tick).toBe(0);
    expect(fresh.getView().skills).toHaveLength(0);
    fresh.dispose();
  });

  it('conserva el referente de la última orden después de recargar', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    session.sendUserMessage('tala el árbol');
    await runUntil(
      session,
      () => session.getView().chat.some((entry) => entry.text.includes('No quiero destruir')),
      20,
    );
    session.dispose();

    const restored = await GameSession.create({ autostart: false, store });
    restored.sendUserMessage('hacelo igual');
    await runUntil(
      restored,
      () =>
        restored.getView().chat.filter((entry) => entry.text.includes('No quiero destruir'))
          .length >= 2,
      20,
    );

    expect(
      restored.getView().chat.filter((entry) => entry.text.includes('No quiero destruir')),
    ).toHaveLength(2);
    restored.dispose();
  });
});

describe('muerte y sucesión en la sesión', () => {
  it('devKill produce el informe de legado y la sucesora hereda y re-verifica', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    await runUntil(session, () => session.getView().storyCompleted);

    session.devKill();
    await runUntil(session, () => session.getView().death !== null, 20);

    const death = session.getView().death!;
    expect(death.cause.cause).toBe('starvation');
    expect(death.skillArtifacts.length).toBeGreaterThan(0);
    expect(session.getView().running).toBe(false);
    expect(session.getView().legacyCount).toBe(1);

    await session.createSuccessor();
    const view = session.getView();
    expect(view.death).toBeNull();
    expect(view.identity.generation).toBe(2);
    expect(view.pet?.alive).toBe(true);
    // La skill heredada fue re-evaluada y promovida en el mundo nuevo.
    expect(
      view.skills.some((s) => s.status === 'stable' && s.motivation.includes('heredada')),
    ).toBe(true);
    // El conocimiento llega como hipótesis "según...", no como hechos.
    expect(view.facts).toHaveLength(0);
    expect(view.hypotheses.some((h) => h.statement.startsWith('según'))).toBe(true);

    // La sucesora sobrevive su primer ciclo de hambre sin crear nada nuevo.
    await runUntil(session, () => session.getView().storyCompleted);
    expect(session.getView().storyCompleted).toBe(true);
    session.dispose();
  });
});
