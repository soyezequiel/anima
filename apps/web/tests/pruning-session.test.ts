import { describe, expect, it } from 'vitest';
import { MemoryKeyValueStore } from '@anima/persistence';
import type { WorldState } from '@anima/sim-core';
import { GameSession } from '../src/session/GameSession.js';

/**
 * La poda del cuidador vista desde la sesión (ADR 0075). Lo que importa acá no
 * es el algoritmo —eso se prueba en sim-core— sino que la decisión SOBREVIVA,
 * que es donde estuvo el error: `adoptNewWorldRules` vuelve a sembrar las
 * recetas de fábrica en cada carga, así que sin dejar constancia de lo podado
 * quitar una receta base duraba exactamente hasta la próxima recarga.
 */

async function makeSession(store = new MemoryKeyValueStore()) {
  const session = await GameSession.create({ seed: 5, autostart: false, store });
  return { session, store };
}

describe('poda del cuidador', () => {
  it('pedir no toca nada: el mundo queda igual hasta confirmar', async () => {
    const { session } = await makeSession();
    const before = session.getView().items.length;

    session.askPrune({ type: 'kind', id: 'campfire' });
    expect(session.getView().prune?.title).toBe('fogata');
    expect(session.getView().items).toHaveLength(before);

    session.cancelPrune();
    expect(session.getView().prune).toBeNull();
    expect(session.getView().items).toHaveLength(before);
  });

  it('confirmar quita el tipo y su receta del catálogo', async () => {
    const { session } = await makeSession();
    session.askPrune({ type: 'kind', id: 'campfire' });
    session.confirmPrune();

    const view = session.getView();
    expect(view.prune).toBeNull();
    expect(view.items.some((item) => item.kind === 'campfire')).toBe(false);
  });

  it('no deja quitar la materia con la que está hecho el juego', async () => {
    const { session } = await makeSession();
    session.askPrune({ type: 'kind', id: 'pet' });
    expect(session.getView().prune?.blocked).toBeTruthy();

    // Y confirmar sobre un plan bloqueado no hace nada.
    session.confirmPrune();
    expect(session.getView().pet).not.toBeNull();
  });

  it('lo podado no vuelve al recargar, aunque sea una receta de fábrica', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(store);
    session.askPrune({ type: 'kind', id: 'campfire' });
    session.confirmPrune();
    await session.save();

    // Misma tienda, sesión nueva: es exactamente lo que pasa al recargar.
    const restored = await GameSession.create({ seed: 5, autostart: false, store });
    expect(restored.getView().items.some((item) => item.kind === 'campfire')).toBe(false);
  });

  it('un mundo nuevo nace con toda su física, aunque el anterior estuviera podado', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(store);
    session.askPrune({ type: 'kind', id: 'campfire' });
    session.confirmPrune();

    // La poda es una decisión sobre ESE mundo, no una preferencia de juego.
    session.reset(7);
    expect(session.getView().items.some((item) => item.kind === 'campfire')).toBe(true);
  });

  it('y también cuando el mundo nuevo nace de una muerte', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(store);
    session.askPrune({ type: 'kind', id: 'campfire' });
    session.confirmPrune();
    expect(session.getView().items.some((item) => item.kind === 'campfire')).toBe(false);

    // Morirse crea un mundo tan nuevo como reiniciar: los dos caminos pasan
    // por `buildFreshRuntime`, así que los dos tienen que olvidar la poda.
    session.devKill();
    for (let i = 0; i < 20 && session.getView().death === null; i++) {
      await session.stepOnce();
    }
    await session.createSuccessor();
    expect(session.getView().items.some((item) => item.kind === 'campfire')).toBe(true);

    // Y sigue estando después de recargar: la constancia de la poda tampoco
    // sobrevive a la generación, así que la siembra de reglas de fábrica no
    // tiene motivo para saltearse la fogata en la vida siguiente.
    await session.save();
    const restored = await GameSession.create({ seed: 5, autostart: false, store });
    expect(restored.getView().items.some((item) => item.kind === 'campfire')).toBe(true);
  });

  it('lo podado no vuelve por el catálogo al reiniciar', async () => {
    const store = new MemoryKeyValueStore();
    const { session } = await makeSession(store);

    // Una receta inventada: el catálogo la guarda, así que sin sacarla de ahí
    // reiniciar la resucitaría (ADR 0076).
    const worldOf = (s: GameSession) => (s as unknown as { world: WorldState }).world;
    worldOf(session).recipes.push({
      id: 'invento-del-cuidador',
      ingredients: [{ kind: 'log', count: 1 }],
      outcomes: [{ weight: 1, output: { kind: 'chirimbolo', components: { portable: {} } } }],
    });
    await session.save();

    session.askPrune({ type: 'kind', id: 'chirimbolo' });
    session.confirmPrune();
    await session.save();

    session.reset(9);
    expect(worldOf(session).recipes.some((r) => r.id === 'invento-del-cuidador')).toBe(false);
  });

  it('olvidar una habilidad se lleva todas sus versiones', async () => {
    const { session } = await makeSession();
    for (let i = 0; i < 400 && session.getView().skills.length === 0; i++) {
      await session.stepOnce();
    }
    const name = session.getView().skills[0]?.name;
    expect(name).toBeDefined();

    session.askSkillPrune(name!);
    expect(session.getView().prune?.title).toBe(name);
    session.confirmPrune();

    expect(session.getView().skills.some((skill) => skill.name === name)).toBe(false);
  });
});
