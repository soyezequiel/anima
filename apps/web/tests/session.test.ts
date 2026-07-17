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
        .chat.some((entry) =>
          entry.text.includes('Sigo con lo pendiente: "construí una silla"'),
        ),
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
      session
        .getView()
        .chat.some((entry) => entry.text === 'Sigo con eso: "construí una silla".'),
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
      'campfire',
      'chair',
      'shelter',
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
      'campfire',
      'chair',
      'hoguera-simple',
      'shelter',
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
    expect(campfire?.ingredients).toEqual(['2 troncos', '1 pedernal']);
    expect(campfire?.stats).toContainEqual({ label: 'Calor', value: '0.3 por tick · alcance 2' });
    expect(campfire?.stats).toContainEqual({ label: 'Daño al tocarlo', value: '1 por tick' });

    // El árbol existe: sus números salen de los ejemplares, no de receta alguna.
    const tree = view.items.find((i) => i.kind === 'tree');
    expect(tree?.craftable).toBe(false);
    expect(tree?.stats).toContainEqual({ label: 'Deja al romperse', value: '3 troncos' });
    expect(tree?.stats.find((s) => s.label === 'Produce')?.value).toContain('rama cada');

    // Lo que no tiene nada medible no inventa filas.
    expect(view.items.find((i) => i.kind === 'flint')?.stats).toEqual([]);

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
