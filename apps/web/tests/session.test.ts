import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/session/GameSession.js';

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
    const session = new GameSession({ seed: 5, autostart: false });
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
    const session = new GameSession({ seed: 7, autostart: false });
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

  it('pausa y velocidad quedan reflejadas en el view', () => {
    const session = new GameSession({ seed: 5, autostart: false });
    expect(session.getView().running).toBe(false);
    session.setSpeed(4);
    expect(session.getView().speed).toBe(4);
    session.setPetColor('#ef4444');
    expect(session.getView().petColor).toBe('#ef4444');
    session.dispose();
  });
});
