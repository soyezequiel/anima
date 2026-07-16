import { describe, expect, it } from 'vitest';
import { MemoryKeyValueStore } from '@anima/persistence';
import type { ModelProvider } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { WorldState } from '@anima/sim-core';
import { entitiesAt, getEntity, removeEntity, spawn } from '@anima/sim-core';
import type { RegressionStore } from '@anima/skill-evaluator';
import { evaluateSkill } from '@anima/skill-evaluator';
import type { SkillLibrary } from '@anima/skill-runtime';
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

  it('convierte una orden direccional en movimiento real antes de confirmar', async () => {
    const { session } = await makeSession(5);
    const start = { x: session.getView().pet!.x, y: session.getView().pet!.y };

    session.sendUserMessage('movete arriba a la izquierda');
    await runUntil(
      session,
      () => session.getView().chat.some((entry) => entry.text.includes('Listo, me moví')),
      20,
    );

    const view = session.getView();
    expect({ x: view.pet!.x, y: view.pet!.y }).toEqual({ x: start.x - 1, y: start.y - 1 });
    expect(view.chat.some((entry) => entry.text === 'Voy hacia arriba y a la izquierda.')).toBe(
      true,
    );
    expect(
      view.chat.some((entry) => entry.text === 'Listo, me moví hacia arriba y a la izquierda.'),
    ).toBe(true);

    // Ya quedó sobre el borde izquierdo: otro paso no debe producir una
    // confirmación falsa, sino explicar que el camino está bloqueado.
    session.sendUserMessage('andate a la izquierda');
    await runUntil(
      session,
      () => session.getView().chat.some((entry) => entry.text.includes('camino está bloqueado')),
      20,
    );
    expect(session.getView().pet!.x).toBe(0);
    expect(
      session.getView().chat.filter((entry) => entry.text === 'Listo, me moví a la izquierda.'),
    ).toHaveLength(0);
    session.dispose();
  });

  it('muestra en chat y Dev el error concreto del proveedor', async () => {
    const fallback = new MockModelProvider();
    const provider: ModelProvider = {
      name: 'codex',
      interpretsLanguage: true,
      complete(request) {
        return request.kind === 'dialogue'
          ? Promise.reject(new Error('cuota de Codex agotada (prueba)'))
          : fallback.complete(request);
      },
      callCount(kind) {
        return fallback.callCount(kind);
      },
    };
    const session = await GameSession.create({
      seed: 5,
      autostart: false,
      fresh: true,
      store: new MemoryKeyValueStore(),
      provider,
    });
    session.sendUserMessage('hola');
    await runUntil(
      session,
      () => session.getView().chat.some((entry) => entry.text.includes('cuota de Codex agotada')),
      20,
    );

    expect(
      session.getView().chat.some((entry) => entry.text.includes('cuota de Codex agotada')),
    ).toBe(true);
    expect(
      session
        .getView()
        .devEvents.some(
          (event) =>
            event.type === 'provider.error' && event.json.includes('cuota de Codex agotada'),
        ),
    ).toBe(true);
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

describe('vigilancia en uso real', () => {
  it('un fallo de la skill estable queda como regresión reproducible con snapshot', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    await runUntil(session, () => session.getView().storyCompleted);

    // El mundo se vuelve hostil: el muro se reconstruye, el martillo
    // desaparece y solo queda una rama; la comida vuelve a quedar del otro
    // lado. La skill estable ya no alcanza — un fallo de comportamiento.
    const world = (session as unknown as { world: WorldState }).world;
    const pet = getEntity(world, 'e1')!;
    for (const entity of Object.values(world.entities)) {
      if (entity.kind === 'hammer' || entity.kind === 'food' || entity.kind === 'tree') {
        removeEntity(world, entity.id);
      }
    }
    for (let y = 0; y < world.config.height; y++) {
      if (entitiesAt(world, { x: 4, y }).length === 0) {
        spawn(world, 'wall', {
          position: { x: 4, y },
          collider: { solid: true },
          hardness: { value: 5 },
          durability: { current: 10, max: 10 },
        });
      }
    }
    spawn(world, 'food', {
      position: { x: 1, y: 2 },
      portable: {},
      edible: {},
      nutrition: { value: 30 },
    });
    spawn(world, 'branch', {
      position: { ...pet.components.position! },
      portable: {},
      tool: { power: 1 },
      durability: { current: 8, max: 8 },
    });
    pet.components.energy!.current = 12;

    await runUntil(
      session,
      () => session.getView().regressions.some((r) => r.scenarioName === 'mundo-real'),
      250,
    );

    const view = session.getView();
    const realCases = view.regressions.filter((r) => r.scenarioName === 'mundo-real');
    expect(realCases.length).toBeGreaterThan(0);
    expect(view.chat.some((c) => c.text.includes('caso de regresión'))).toBe(true);
    expect(view.devEvents.some((e) => e.type === 'regression.recorded')).toBe(true);

    // Reproducible: evaluar la skill estable contra el caso capturado falla.
    const regressions = (session as unknown as { regressions: RegressionStore }).regressions;
    const library = (session as unknown as { library: SkillLibrary }).library;
    const stable = library
      .all()
      .find((s) => s.status === 'stable' && s.name === 'alcanzar-alimento-bloqueado')!;
    const report = evaluateSkill(stable, {
      scenarios: [],
      seeds: [],
      regressions: regressions.realWorldCasesFor(stable.name),
      maxTicks: 200,
    });
    expect(report.successRate).toBe(0);
    session.dispose();
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
