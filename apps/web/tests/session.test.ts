import { describe, expect, it, vi } from 'vitest';
import { MemoryKeyValueStore } from '@anima/persistence';
import type { ModelProvider, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { WorldState } from '@anima/sim-core';
import { entitiesAt, getEntity, removeEntity, spawn } from '@anima/sim-core';
import type { RegressionStore } from '@anima/skill-evaluator';
import { evaluateSkill } from '@anima/skill-evaluator';
import type { SkillLibrary } from '@anima/skill-runtime';
import { GameSession, THINK_TICK_BUDGET } from '../src/session/GameSession.js';
import type { PickupView } from '../src/session/view.js';

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

  it('expone los sueños y el progreso del ciclo de desarrollo al view model', async () => {
    const { session } = await makeSession(5);

    await runUntil(session, () => session.getView().storyCompleted);

    const view = session.getView();
    // Terminado el ciclo, el renglón se apaga y lo que queda es el historial
    // (ADR 0060). Antes esta prueba exigía lo contrario —que el estado siguiera
    // ahí— y ese estado colgado era justo lo que ponía "corrigiendo una
    // habilidad que falló" al lado del "¡pasó con 100%!" del ciclo anterior.
    expect(view.skillDev).toBeNull();
    expect(view.experiments.some((e) => e.kind === 'promoted')).toBe(true);
    // Cada caso evaluado dejó su mundo imaginado, el más nuevo primero: la
    // última versión probada (la v2 que pasó) encabeza la lista.
    expect(view.dreams.length).toBeGreaterThan(0);
    const dream = view.dreams[0]!;
    expect(dream.version).toBe(2);
    expect(dream.entities.length).toBeGreaterThan(0);
    expect(dream.path.length).toBeGreaterThan(0);
    expect(dream.width).toBeGreaterThan(0);

    session.dispose();
  });

  it('la espera visible sigue a la consulta en vuelo (aiWait)', async () => {
    const { session } = await makeSession(5);
    expect(session.getView().aiWait).toBeNull();

    session.noteAiThought({ seq: 1, kind: 'dialogue', event: 'start' });
    const waiting = session.getView().aiWait;
    expect(waiting).not.toBeNull();
    expect(waiting!.startedAtMs).toBeGreaterThan(0);
    // Sin historial de esta sesión no se promete ninguna duración.
    expect(waiting!.expectedMs).toBeNull();
    // Sin pensamiento en vuelo con presupuesto agotado, el tiempo no está suspendido.
    expect(waiting!.held).toBe(false);

    session.noteAiThought({ seq: 1, kind: 'dialogue', event: 'done' });
    expect(session.getView().aiWait).toBeNull();
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

  it('expone cada recogida como un hecho efímero del view model', async () => {
    const { session } = await makeSession(5);
    const seen: PickupView[] = [];
    await runUntil(session, () => {
      const pickup = session.getView().pickup;
      if (pickup && !seen.some((p) => p.itemId === pickup.itemId && p.tick === pickup.tick)) {
        seen.push(pickup);
      }
      return session.getView().storyCompleted;
    });

    expect(seen.length).toBeGreaterThan(0);
    // El tipo se resuelve aunque el motor ya le haya quitado la posición al
    // objeto: sin esto la UI no sabría qué dibujar y caería en el genérico.
    expect(seen.every((p) => p.kind !== '?')).toBe(true);
    expect(seen.some((p) => p.kind === 'hammer')).toBe(true);

    // Es un acento, no un estado: caduca sola sin que nadie la limpie.
    const last = session.getView().pickup;
    if (last) {
      await runUntil(session, () => session.getView().pickup === null, 12);
      expect(session.getView().pickup).toBeNull();
    }
    session.dispose();
  });

  it('la vida que le queda a la herramienta que lleva viaja al view y baja al usarla', async () => {
    const { session } = await makeSession(5);
    // Cada lectura del martillo mientras está en la mochila, en orden.
    const readings: number[] = [];
    await runUntil(session, () => {
      const held = session.getView().pet?.inventory.find((i) => i.kind === 'hammer');
      if (held?.durability && readings[readings.length - 1] !== held.durability.current) {
        readings.push(held.durability.current);
      }
      return session.getView().storyCompleted;
    });

    // El martillo de este escenario nace gastado (8 de 20): la reliquia se ve
    // como lo que es, no como una herramienta entera.
    expect(readings.length).toBeGreaterThan(0);
    expect(readings[0]).toBe(8);
    // Y se gasta: cada uso deja menos, nunca más.
    expect(readings.length).toBeGreaterThan(1);
    expect(readings.every((v, i) => i === 0 || v < readings[i - 1]!)).toBe(true);

    // Lo que no se rompe no inventa un número que no tiene.
    const others = session.getView().pet!.inventory.filter((i) => i.kind !== 'hammer');
    expect(others.every((i) => i.durability === undefined)).toBe(true);

    session.dispose();
  });

  it('el cuidador pone un item del catálogo en la celda donde lo suelta', async () => {
    const { session } = await makeSession(5);
    const view = session.getView();

    // Un tipo que el mundo sabe materializar: hay un ejemplar suyo en el mapa.
    const placeable = view.items.find((i) => i.inWorld > 0);
    expect(placeable).toBeDefined();
    const kind = placeable!.kind;

    // Una celda libre: sin entidad y sin la mascota encima.
    const occupied = new Set(view.entities.map((e) => `${e.x},${e.y}`));
    occupied.add(`${view.pet!.x},${view.pet!.y}`);
    let target: { x: number; y: number } | null = null;
    for (let y = 0; y < view.worldSize.height && !target; y++) {
      for (let x = 0; x < view.worldSize.width && !target; x++) {
        if (!occupied.has(`${x},${y}`)) target = { x, y };
      }
    }
    expect(target).not.toBeNull();

    const before = session.getView().items.find((i) => i.kind === kind)!.inWorld;
    session.placeItemOnMap(kind, target!);

    const after = session.getView();
    expect(
      after.entities.some((e) => e.kind === kind && e.x === target!.x && e.y === target!.y),
    ).toBe(true);
    expect(after.items.find((i) => i.kind === kind)!.inWorld).toBe(before + 1);

    // Soltar fuera del mapa no materializa nada.
    const count = after.entities.length;
    session.placeItemOnMap(kind, { x: -1, y: 0 });
    session.placeItemOnMap(kind, { x: view.worldSize.width, y: 0 });
    expect(session.getView().entities.length).toBe(count);

    // Un tipo que el mundo no conoce tampoco: no hay molde del que copiar.
    session.placeItemOnMap('tipo-que-no-existe', target!);
    expect(session.getView().entities.length).toBe(count);

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

  it('el mundo no espera al modelo: los ticks siguen con un pensamiento en vuelo (ADR 0039)', async () => {
    const fallback = new MockModelProvider();
    let release!: (response: ModelResponse) => void;
    const provider: ModelProvider = {
      name: 'codex',
      interpretsLanguage: true,
      complete(request) {
        // Una consulta real tarda: se resuelve solo cuando el test la libera.
        if (request.kind === 'interpret.command') {
          return new Promise((resolve) => {
            release = resolve;
          });
        }
        return fallback.complete(request);
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

    session.sendUserMessage('a partir de ahora te llamás Chispa');
    // La consulta quedó en vuelo. El mundo no la espera: cada paso avanza.
    await session.stepOnce(); // se suma al paso que lanzó el pensamiento
    const start = session.getView().tick;
    await session.stepOnce();
    await session.stepOnce();
    expect(session.getView().tick).toBe(start + 2);
    // Y la respuesta todavía no llegó: sigue siendo Ánima.
    expect(session.getView().identity.name).toBe('Ánima');

    // Llega la respuesta: en pausa se consume sola, sin tick del loop.
    release({
      kind: 'command.interpretation',
      command: { action: 'rename-pet', name: 'Chispa' },
    });
    await vi.waitFor(() => {
      expect(session.getView().identity.name).toBe('Chispa');
    });
    // La medición (ADR 0039) quedó en Dev: la consulta con su tipo y duración.
    expect(
      session
        .getView()
        .devEvents.some(
          (event) => event.type === 'ai.timing' && event.json.includes('interpret.command'),
        ),
    ).toBe(true);
    session.dispose();
  });

  it('el pensamiento en vuelo tiene presupuesto: agotado, la simulación se sostiene (ADR 0040)', async () => {
    const fallback = new MockModelProvider();
    let release!: (response: ModelResponse) => void;
    const provider: ModelProvider = {
      name: 'codex',
      interpretsLanguage: true,
      complete(request) {
        if (request.kind === 'interpret.command') {
          return new Promise((resolve) => {
            release = resolve;
          });
        }
        return fallback.complete(request);
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

    session.sendUserMessage('a partir de ahora te llamás Chispa');
    await session.stepOnce(); // lanza el pensamiento: primer tick del presupuesto
    const launched = session.getView().tick;
    // Muchos más pasos que el presupuesto: el cuerpo solo paga los del tope.
    for (let i = 0; i < THINK_TICK_BUDGET + 15; i++) {
      await session.stepOnce();
    }
    expect(session.getView().tick).toBe(launched + THINK_TICK_BUDGET - 1);

    // Llega la respuesta: el mundo se suelta y el pensamiento se aplica.
    release({
      kind: 'command.interpretation',
      command: { action: 'rename-pet', name: 'Chispa' },
    });
    await vi.waitFor(() => {
      expect(session.getView().identity.name).toBe('Chispa');
    });
    session.dispose();
  });

  it('la práctica en segundo plano deja vivir, y su presupuesto sostiene el tiempo (ADR 0043)', async () => {
    // Mock de verdad por debajo (la historia entera corre igual), salvo la
    // PRIMERA propuesta de habilidad, que no responde hasta que se libere:
    // el ciclo de desarrollo queda practicando en segundo plano.
    const inner = new MockModelProvider();
    let release: (() => void) | null = null;
    const provider: ModelProvider = {
      name: 'mock-lento',
      interpretsLanguage: false,
      complete(request) {
        if (request.kind === 'skill.propose' && release === null) {
          const original = inner.complete(request);
          return new Promise((resolve, reject) => {
            release = () => {
              original.then(resolve, reject);
            };
          });
        }
        return inner.complete(request);
      },
      callCount(kind) {
        return inner.callCount(kind);
      },
    };
    const session = await GameSession.create({
      seed: 5,
      autostart: false,
      fresh: true,
      store: new MemoryKeyValueStore(),
      provider,
    });

    // La historia avanza sola hasta que el hambre abre el ciclo de skills…
    await runUntil(
      session,
      () => session.getView().devEvents.some((e) => e.type === 'skill.dev.background'),
      400,
    );
    expect(session.getView().devEvents.some((e) => e.type === 'skill.dev.background')).toBe(true);

    // …que queda EN VUELO. La vida sigue el crédito entero y ni un tick más:
    // agotado el presupuesto, el tiempo se sostiene hasta el veredicto.
    const launched = session.getView().tick;
    for (let i = 0; i < THINK_TICK_BUDGET + 15; i++) {
      await session.stepOnce();
    }
    const heldAt = session.getView().tick;
    // El lanzamiento puede repartirse en uno o dos ticks según el intercalado
    // de timers: lo que se fija es el contrato, no el reparto — vive
    // aproximadamente el crédito entero y ni un tick más allá de él.
    expect(heldAt - launched).toBeGreaterThanOrEqual(THINK_TICK_BUDGET - 2);
    expect(heldAt - launched).toBeLessThanOrEqual(THINK_TICK_BUDGET);
    await session.stepOnce();
    expect(session.getView().tick).toBe(heldAt);

    // Llega la propuesta: el ciclo termina, el tiempo se suelta y la historia
    // completa sigue siendo la de siempre (falla, corrige, come).
    release!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await runUntil(session, () => session.getView().storyCompleted, 400);
    expect(session.getView().storyCompleted).toBe(true);
    session.dispose();
  });

  it('los reflejos no piensan: se aparta del daño aunque la mente esté en vuelo (ADR 0043)', async () => {
    const fallback = new MockModelProvider();
    let release!: (response: ModelResponse) => void;
    const provider: ModelProvider = {
      name: 'codex',
      interpretsLanguage: true,
      complete(request) {
        if (request.kind === 'interpret.command') {
          return new Promise((resolve) => {
            release = resolve;
          });
        }
        return fallback.complete(request);
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
    const world = (session as unknown as { world: WorldState }).world;
    const petId = (session as unknown as { agent: { petId: string } }).agent.petId;
    const start = { ...world.entities[petId]!.components.position! };
    // Un fuego en su propia celda: la quema por dentro (ADR 0041) mientras
    // su mente está en el proveedor.
    const fire = { x: start.x, y: start.y };
    spawn(world, 'campfire', {
      position: fire,
      heatSource: { warmthPerTick: 0.3, range: 2 },
      hazard: { damagePerTick: 1 },
    });

    session.sendUserMessage('a partir de ahora te llamás Chispa');
    // La consulta queda en vuelo y los ticks pasivos corren: el primero la
    // quema, y el reflejo del cuerpo la saca de la celda sin esperar a la
    // mente. Salir de la celda ya es estar a salvo (ADR 0041).
    for (let i = 0; i < 6; i++) await session.stepOnce();
    const pos = world.entities[petId]!.components.position!;
    const distance = Math.max(Math.abs(pos.x - fire.x), Math.abs(pos.y - fire.y));
    expect(distance).toBeGreaterThanOrEqual(1);
    expect(session.getView().devEvents.some((e) => e.type === 'pain.reflex')).toBe(true);
    // Y la mente sigue afuera: todavía no atendió el mensaje.
    expect(session.getView().identity.name).toBe('Ánima');

    release({
      kind: 'command.interpretation',
      command: { action: 'rename-pet', name: 'Chispa' },
    });
    await vi.waitFor(() => {
      expect(session.getView().identity.name).toBe('Chispa');
    });
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
  it('una orden de construir sobrevive a la recarga: la retoma sola y la termina', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    session.sendUserMessage('construí una silla');
    await runUntil(
      session,
      () =>
        session.getView().chat.some((entry) => entry.text.includes('quiero construir una silla')),
      30,
    );
    session.dispose();

    // "Recarga de página" en mitad de la tarea: la meta viaja en el guardado.
    const restored = await GameSession.create({ autostart: false, store });
    expect(
      restored
        .getView()
        .chat.some((entry) => entry.text.includes('Sigo con lo pendiente: "construí una silla"')),
    ).toBe(true);

    // Y no hace falta repetir la orden: junta los troncos y la construye.
    await runUntil(
      restored,
      () => restored.getView().chat.some((entry) => entry.text === 'Listo, ya está en su lugar.'),
      400,
    );
    expect(
      restored.getView().chat.some((entry) => entry.text === 'Listo, ya está en su lugar.'),
    ).toBe(true);
    expect(restored.getView().entities.some((entity) => entity.kind === 'chair')).toBe(true);
    restored.dispose();
  });

  it('«continua» confirma la tarea en curso, siempre igual', async () => {
    const { session } = await makeSession(5);
    session.sendUserMessage('construí una silla');
    await runUntil(
      session,
      () =>
        session.getView().chat.some((entry) => entry.text.includes('quiero construir una silla')),
      30,
    );

    session.sendUserMessage('continua');
    await runUntil(
      session,
      () => session.getView().chat.some((entry) => entry.text.includes('Sigo con eso')),
      30,
    );
    expect(
      session.getView().chat.some((entry) => entry.text === 'Sigo con eso: "construí una silla".'),
    ).toBe(true);
    session.dispose();
  });

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

describe('reglas del mundo al restaurar', () => {
  /** Un guardado escrito antes de que existieran las recetas. */
  async function saveWithoutRecipes(): Promise<MemoryKeyValueStore> {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    await session.save();
    session.dispose();
    const raw = await store.get('save');
    const data = JSON.parse(raw!) as { world: { state: { recipes?: unknown } } };
    delete data.world.state.recipes;
    await store.set('save', JSON.stringify(data));
    return store;
  }

  it('una partida vieja adopta las recetas nuevas en vez de quedarse sin ninguna', async () => {
    const store = await saveWithoutRecipes();

    const session = await GameSession.create({ autostart: false, store });

    const world = (session as unknown as { world: WorldState }).world;
    expect(world.recipes.map((r) => r.id).sort()).toEqual([
      'barricade',
      'brick',
      'campfire',
      'chair',
      'shelter',
      'stone-pick',
      'torch',
    ]);
    session.dispose();
  });

  it('lo que la mascota inventó sobrevive: el merge es por id, no reemplaza', async () => {
    const store = new MemoryKeyValueStore();
    const { session: first } = await makeSession(5, store);
    const world = (first as unknown as { world: WorldState }).world;
    world.recipes.push({
      id: 'hoguera-simple',
      outcomes: [
        {
          weight: 1,
          output: {
            kind: 'hoguera-simple',
            components: { heatSource: { warmthPerTick: 0.4, range: 2 } },
          },
        },
      ],
      ingredients: [{ kind: 'log', count: 2 }],
    });
    await first.save();
    first.dispose();

    const session = await GameSession.create({ autostart: false, store });

    const restored = (session as unknown as { world: WorldState }).world;
    expect(restored.recipes.map((r) => r.id).sort()).toEqual([
      'barricade',
      'brick',
      'campfire',
      'chair',
      'hoguera-simple',
      'shelter',
      'stone-pick',
      'torch',
    ]);
    session.dispose();
  });

  it('el catálogo de items separa lo de fábrica de lo inventado en runtime', async () => {
    const { session } = await makeSession(5);
    const view = session.getView();

    // Recién nacido, todo lo que existe o se sabe construir viene del código.
    expect(view.items.length).toBeGreaterThan(0);
    expect(view.items.every((i) => i.origin === 'builtin')).toBe(true);
    const water = view.items.find((i) => i.kind === 'water');
    expect(water?.inWorld).toBeGreaterThan(0);
    const campfire = view.items.find((i) => i.kind === 'campfire');
    expect(campfire).toMatchObject({ origin: 'builtin', craftable: true, inWorld: 0 });
    expect(campfire?.does).toContain('da calor');

    // Sus números, y lo que cuesta: la fogata todavía no existe, así que sale
    // del arquetipo de la receta.
    expect(campfire?.ingredients.map((i) => i.label)).toEqual(['2 troncos', '1 pedernal']);
    // El tronco y el pedernal son materia base: el árbol no tiene un piso más
    // abajo que mostrar, así que no lo muestra.
    expect(campfire?.baseCost).toEqual([]);
    expect(campfire?.stats).toContainEqual({ label: 'Calor', value: '0.3 por tick · alcance 2' });
    expect(campfire?.stats).toContainEqual({ label: 'Daño al tocarlo', value: '1 por tick' });

    // El árbol existe: sus números salen de los ejemplares, no de receta alguna.
    const tree = view.items.find((i) => i.kind === 'tree');
    expect(tree?.craftable).toBe(false);
    expect(tree?.stats).toContainEqual({ label: 'Deja al romperse', value: '3 troncos' });
    expect(tree?.stats.find((s) => s.label === 'Produce')?.value).toContain('rama cada');

    // Lo que no tiene nada medible no inventa filas: el tronco es solo portable.
    expect(view.items.find((i) => i.kind === 'log')?.stats).toEqual([]);

    // El pedernal ahora es una roca picable (tiene dureza y resistencia), así
    // que sí muestra sus números — antes era indestructible y no mostraba nada.
    const flint = view.items.find((i) => i.kind === 'flint');
    expect(flint?.stats).toContainEqual({ label: 'Dureza', value: '3' });
    expect(flint?.stats).toContainEqual({ label: 'Resistencia', value: '3 de 3' });

    // Entra una receta que no es del MVP: la construyó un modelo en runtime.
    const world = (session as unknown as { world: WorldState }).world;
    world.recipes.push({
      id: 'hoguera-simple',
      outcomes: [
        {
          weight: 1,
          output: {
            kind: 'hoguera-simple',
            components: { heatSource: { warmthPerTick: 0.4, range: 2 } },
          },
        },
      ],
      ingredients: [{ kind: 'log', count: 2 }],
    });
    await session.stepOnce();

    const items = session.getView().items;
    const invented = items.find((i) => i.kind === 'hoguera-simple');
    expect(invented).toMatchObject({
      origin: 'invented',
      name: 'hoguera simple',
      craftable: true,
    });
    expect(invented?.does).toContain('da calor');
    // Lo inventado va primero: es la novedad que el panel quiere mostrar.
    expect(items[0]?.kind).toBe('hoguera-simple');
    // Y lo de fábrica no cambia de origen por convivir con un invento.
    expect(items.find((i) => i.kind === 'campfire')?.origin).toBe('builtin');
    session.dispose();
  });

  it('el catálogo baja el árbol de crafteo hasta la materia base', async () => {
    const { session } = await makeSession(5);
    const world = (session as unknown as { world: WorldState }).world;
    // Dos pisos: la mesa se hace de tablas y la tabla se hace de troncos. Nadie
    // declara lo que cuesta la mesa; se deriva (ADR 0031).
    world.recipes.push(
      {
        id: 'tabla',
        outcomes: [{ weight: 1, output: { kind: 'tabla', components: { portable: {} } } }],
        ingredients: [{ kind: 'log', count: 3 }],
      },
      {
        id: 'mesa',
        outcomes: [
          { weight: 1, output: { kind: 'mesa', components: { collider: { solid: true } } } },
        ],
        ingredients: [
          { kind: 'tabla', count: 2 },
          { kind: 'flint', count: 1 },
        ],
      },
    );
    await session.stepOnce();

    const items = session.getView().items;
    const mesa = items.find((i) => i.kind === 'mesa');
    // Arriba, el paso que de verdad hace la mascota: mesa ← tablas.
    expect(mesa?.ingredients.map((i) => i.label)).toEqual(['2 tablas', '1 pedernal']);
    // Abajo, lo que hay que juntar del mundo si no se tiene ninguna tabla:
    // 2 tablas × 3 troncos = 6, y el pedernal ya era materia base.
    expect(mesa?.baseCost).toEqual([
      { kind: 'log', count: 6, label: '6 troncos' },
      { kind: 'flint', count: 1, label: '1 pedernal' },
    ]);
    expect(mesa?.costTruncated).toBe(false);

    // La tabla es de un solo piso: su materia base ya está arriba y repetirla
    // sería fingir profundidad.
    expect(items.find((i) => i.kind === 'tabla')?.baseCost).toEqual([]);
    session.dispose();
  });

  it('dos ejemplares que no son iguales se cuentan como el rango que son', async () => {
    const { session } = await makeSession(5);
    const world = (session as unknown as { world: WorldState }).world;
    // La tirada del mundo hace que construir dos veces lo mismo dé dos cosas
    // distintas: el catálogo no puede elegir una y callar la otra.
    spawn(world, 'campfire', {
      position: { x: 7, y: 2 },
      heatSource: { warmthPerTick: 0.3, range: 2 },
      hazard: { damagePerTick: 1 },
    });
    spawn(world, 'campfire', {
      position: { x: 8, y: 2 },
      heatSource: { warmthPerTick: 0.17, range: 2 },
      hazard: { damagePerTick: 1 },
    });
    await session.stepOnce();

    const campfire = session.getView().items.find((i) => i.kind === 'campfire')!;
    expect(campfire.inWorld).toBe(2);
    expect(campfire.stats).toContainEqual({
      label: 'Calor',
      value: '0.17–0.3 por tick · alcance 2',
    });
    // El alcance no se gradúa: un fuego tibio alcanza igual de lejos.
    expect(campfire.stats).toContainEqual({ label: 'Daño al tocarlo', value: '1 por tick' });
    session.dispose();
  });

  it('una mascota guardada sin frío lo adopta al restaurar, cómoda al máximo', async () => {
    const store = new MemoryKeyValueStore();
    const { session: first } = await makeSession(5, store);
    const world = (first as unknown as { world: WorldState }).world;
    const petId = (first as unknown as { agent: { petId: string } }).agent.petId;
    // Un guardado anterior al frío: le quitamos la temperatura antes de guardar.
    delete world.entities[petId]!.components.temperature;
    await first.save();
    first.dispose();

    const session = await GameSession.create({ autostart: false, store });

    const view = session.getView();
    expect(view.pet?.temperature).toEqual({ current: 50, max: 50 });
    session.dispose();
  });

  it('las respuestas tontas del mock se apagan desde la sesión y sobreviven al guardado', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(5, store);
    // Encendidas por defecto: el ciclo fallar→corregir es la historia.
    expect(session.getView().mockImperfect).toBe(true);

    session.setMockImperfect(false);
    expect(session.getView().mockImperfect).toBe(false);
    const provider = (session as unknown as { provider: MockModelProvider }).provider;
    expect(provider.isImperfect()).toBe(false);
    await session.save();
    session.dispose();

    // La preferencia es de la sesión: restaurar la respeta.
    const restored = await GameSession.create({ autostart: false, store });
    expect(restored.getView().mockImperfect).toBe(false);
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

describe('pensamiento en vivo en la sesión', () => {
  it('acumula la consulta, ignora titulares duplicados y la cierra', async () => {
    const { session } = await makeSession(5);
    session.noteAiThought({ seq: 1, kind: 'dialogue', event: 'start' });
    let view = session.getView();
    expect(view.currentThought).toMatchObject({ seq: 1, kind: 'dialogue', status: 'thinking' });
    expect(view.thoughts).toHaveLength(1);
    expect(view.thoughts[0]?.label).toBe('buscando qué decir');

    session.noteAiThought({ seq: 1, kind: 'dialogue', event: 'reasoning', text: '**paso**' });
    // Un reintento interno puede repetir el titular: no se duplica.
    session.noteAiThought({ seq: 1, kind: 'dialogue', event: 'reasoning', text: '**paso**' });
    session.noteAiThought({ seq: 1, kind: 'dialogue', event: 'answer', text: '{"text":"hola"}' });
    session.noteAiThought({ seq: 1, kind: 'dialogue', event: 'done' });

    view = session.getView();
    expect(view.currentThought).toBeNull();
    expect(view.thoughts[0]).toMatchObject({
      status: 'done',
      reasoning: ['**paso**'],
      answer: '{"text":"hola"}',
    });
    session.dispose();
  });

  /**
   * ADR 0052. Los objetivos llegan a la pantalla en el orden en que compiten y
   * con lo que les falta conseguir. Antes el view model llevaba cuatro campos
   * (id, texto, estado, origen): la pantalla no podía decir ni cuál era la
   * prioridad real ni qué material estaba esperando.
   */
  it('los objetivos llegan ordenados por prioridad y con lo que les falta', async () => {
    const { session } = await makeSession(5);
    session.sendUserMessage('traé un tronco');
    for (let i = 0; i < 3; i++) await session.stepOnce();

    const view = session.getView();
    const encargo = view.goals.find((g) => g.source === 'user-request');
    expect(encargo).toBeDefined();
    // El puesto en la fila, no el orden de creación.
    expect(view.currentGoal?.rank).toBe(1);
    expect(encargo!.score).toBeGreaterThan(0);

    // Lo que le falta viaja dibujable: tipo para el ícono y nombre en voz
    // humana, no el `kind` del motor.
    const tronco = encargo!.needs.find((n) => n.kind === 'log');
    expect(tronco).toBeDefined();
    expect(tronco!.label).toBe('tronco');
    expect(tronco!.short).toBeGreaterThan(0);
    session.dispose();
  });

  /**
   * ADR 0053. Los pasos de un encargo viajan como hijos DENTRO del padre: la
   * pantalla los dibuja anidados, cada uno con su estado y su materia viva.
   */
  it('los pasos de un encargo llegan anidados dentro del objetivo padre', async () => {
    const { session } = await makeSession(5);
    // "fogata" la entiende el parser local: craft-item sin modelo de por medio.
    session.sendUserMessage('hacé una fogata');
    await runUntil(session, () => {
      const goal = session.getView().goals.find((g) => g.description.includes('fogata'));
      return (goal?.children.length ?? 0) > 0;
    }, 40);

    const view = session.getView();
    const parent = view.goals.find((g) => g.description.includes('fogata'));
    expect(parent).toBeDefined();
    expect(parent!.children.length).toBeGreaterThan(0);
    // El remate está siempre; los de juntar dependen de lo que ya lleve.
    expect(parent!.children.some((c) => c.description.startsWith('armar'))).toBe(true);
    // Un hijo nunca aparece suelto en la lista de arriba.
    expect(view.goals.every((g) => g.children.every((c) => c.children.length === 0))).toBe(true);
    expect(view.goals.some((g) => parent!.children.some((c) => c.id === g.id))).toBe(false);
    session.dispose();
  });

  /**
   * ADR 0056. Las obras aprendidas llegan a la pantalla con su forma dibujable
   * y su costo real. El plano guarda desplazamientos relativos al ancla, que
   * pueden ser negativos; la grilla que se dibuja empieza en (0,0).
   */
  it('las obras aprendidas viajan con su forma normalizada y su costo en materia bruta', async () => {
    const { session } = await makeSession(5);
    // Un plano con desplazamientos negativos y una pieza que a su vez se
    // craftea: los dos casos que la vista tiene que resolver.
    const world = (session as unknown as { world: WorldState }).world;
    world.recipes.push({
      id: 'muro-aula',
      ingredients: [{ kind: 'log', count: 2 }],
      outcomes: [
        { weight: 1, output: { kind: 'muro-aula', components: { portable: {}, collider: { solid: true } } } },
      ],
    });
    world.blueprints.push({
      id: 'escuela',
      placements: [
        { kind: 'muro-aula', offset: { x: -1, y: 0 } },
        { kind: 'muro-aula', offset: { x: 1, y: 0 } },
      ],
    });
    await session.stepOnce();

    const work = session.getView().blueprints.find((b) => b.id === 'escuela');
    expect(work).toBeDefined();
    expect(work!.label).toBe('escuela');
    // La grilla empieza en 0 y el ancla queda en el medio: 3 de ancho, 1 de alto.
    expect({ width: work!.width, height: work!.height }).toEqual({ width: 3, height: 1 });
    expect(work!.anchor).toEqual({ x: 1, y: 0 });
    expect(work!.cells.map((c) => c.x).sort()).toEqual([0, 2]);
    // Las piezas agrupadas por tipo: es lo que la tarjeta vuelve tocable para
    // saltar a su ficha en el catálogo.
    expect(work!.blocks).toHaveLength(1);
    expect(work!.blocks[0]).toMatchObject({ kind: 'muro-aula', count: 2 });
    session.dispose();
  });

  /**
   * ADR 0060. El renglón del ciclo cuenta lo que está pasando; un ciclo
   * cerrado ya no está pasando. Si el estado queda colgado, el ciclo siguiente
   * muestra su encabezado ("corrigiendo una habilidad que falló") al lado del
   * "¡pasó con 100%!" del anterior — dos relojes distintos contando como si
   * fueran el mismo momento.
   */
  it('al promoverse una habilidad, el renglón del ciclo se apaga', async () => {
    const { session } = await makeSession(5);
    await runUntil(session, () => session.getView().skills.some((s) => s.status === 'stable'));

    const view = session.getView();
    // Hubo promoción de verdad...
    expect(view.skills.some((s) => s.status === 'stable')).toBe(true);
    // ...y el ciclo ya no se anuncia como en curso.
    expect(view.skillDev).toBeNull();
    // El logro no se pierde: queda en el historial de experimentos.
    expect(view.experiments.some((e) => e.kind === 'promoted')).toBe(true);
    session.dispose();
  });

  /**
   * ADR 0061. El modo creativo mantiene el cuerpo lleno para poder construir y
   * experimentar sin que el hambre o el frío la maten en el medio — que es
   * exactamente lo que pasó varias veces mirando paneles.
   */
  describe('modo creativo', () => {
    it('mantiene energía, salud y calor al máximo mientras el mundo avanza', async () => {
      const { session } = await makeSession(5);
      const world = (session as unknown as { world: WorldState }).world;
      const petId = (session as unknown as { agent: { petId: string } }).agent.petId;
      const pet = world.entities[petId]!;
      // Un cuerpo ya castigado: el modo lo repara al encenderse, sin esperar.
      pet.components.energy!.current = 4;
      pet.components.health!.current = 2;

      session.setCreativeMode(true);
      expect(session.getView().creativeMode).toBe(true);
      expect(session.getView().pet!.energy.current).toBe(pet.components.energy!.max);
      expect(session.getView().pet!.health.current).toBe(pet.components.health!.max);

      for (let i = 0; i < 60; i++) await session.stepOnce();

      const view = session.getView();
      expect(view.pet!.alive).toBe(true);
      expect(view.pet!.energy.current).toBe(view.pet!.energy.max);
      expect(view.pet!.health.current).toBe(view.pet!.health.max);
      if (view.pet!.temperature) {
        expect(view.pet!.temperature.current).toBe(view.pet!.temperature.max);
      }
      session.dispose();
    });

    /**
     * El caso que motivó el modo: el frío la mata sola. Sin el modo, con el
     * calor en cero la salud cae un punto por tick hasta la hipotermia — que
     * es como murió la generación 3 mientras se revisaban paneles.
     */
    it('sobrevive a un frío que la estaría matando, y sin el modo no', async () => {
      const congelar = async (creativo: boolean) => {
        const { session } = await makeSession(5);
        const world = (session as unknown as { world: WorldState }).world;
        const petId = (session as unknown as { agent: { petId: string } }).agent.petId;
        const pet = world.entities[petId]!;
        if (!pet.components.temperature) return null;
        if (creativo) session.setCreativeMode(true);
        pet.components.temperature.current = 0;
        pet.components.health!.current = 2;
        for (let i = 0; i < 30; i++) await session.stepOnce();
        const vivo = session.getView().pet!.alive;
        session.dispose();
        return vivo;
      };

      const conModo = await congelar(true);
      const sinModo = await congelar(false);
      // Solo tiene sentido comparar en un mundo con frío.
      if (conModo === null || sinModo === null) return;
      expect(sinModo).toBe(false);
      expect(conModo).toBe(true);
    });

    it('apagado, el cuerpo sigue siendo mortal: el modo no es el estado normal', async () => {
      const { session } = await makeSession(5);
      const world = (session as unknown as { world: WorldState }).world;
      const petId = (session as unknown as { agent: { petId: string } }).agent.petId;
      const pet = world.entities[petId]!;
      expect(session.getView().creativeMode).toBe(false);
      pet.components.energy!.current = 3;

      await session.stepOnce();
      // Sin el modo, nadie la repone: la energía siguió su curso.
      expect(session.getView().pet!.energy.current).toBeLessThan(
        session.getView().pet!.energy.max,
      );
      session.dispose();
    });
  });

  it('un fallo queda contado como error y la vista es una copia inmutable', async () => {
    const { session } = await makeSession(5);
    session.noteAiThought({ seq: 1, kind: 'recipe.propose', event: 'start' });
    session.noteAiThought({ seq: 1, kind: 'recipe.propose', event: 'reasoning', text: 'a' });
    const frozen = session.getView();

    session.noteAiThought({ seq: 1, kind: 'recipe.propose', event: 'error', message: 'se cortó' });
    const after = session.getView();
    expect(after.thoughts[0]).toMatchObject({ status: 'error', error: 'se cortó' });
    expect(after.currentThought).toBeNull();
    // La vista anterior no vio el fallo: cada rebuild entrega copias frescas.
    expect(frozen.thoughts[0]?.status).toBe('thinking');
    session.dispose();
  });
});
