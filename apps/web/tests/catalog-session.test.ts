import { describe, expect, it } from 'vitest';
import { loadCatalog, MemoryKeyValueStore } from '@anima/persistence';
import type { WorldState } from '@anima/sim-core';
import { GameSession } from '../src/session/GameSession.js';

/**
 * El catálogo del cuidador visto desde la sesión (ADR 0076). La promesa que se
 * prueba acá es la que motivó todo: **reiniciar ya no tira lo aprendido**.
 */

const INVENTO = {
  id: 'invento-del-cuidador',
  ingredients: [{ kind: 'log', count: 1 }],
  outcomes: [{ weight: 1, output: { kind: 'chirimbolo', components: { portable: {} } } }],
};

const worldOf = (s: GameSession) => (s as unknown as { world: WorldState }).world;

async function sessionWithInvention(store: MemoryKeyValueStore) {
  const session = await GameSession.create({ seed: 5, autostart: false, store });
  worldOf(session).recipes.push(structuredClone(INVENTO));
  await session.save();
  return session;
}

describe('el catálogo del cuidador', () => {
  it('lo inventado se publica al guardar, y lo de fábrica no', async () => {
    const store = new MemoryKeyValueStore();
    await sessionWithInvention(store);

    const catalog = await loadCatalog(store);
    expect(catalog.recipes.map((r) => r.id)).toEqual([INVENTO.id]);
    // Una receta de fábrica ya la pone el escenario en cada mundo nuevo;
    // guardarla la congelaría en la versión de hoy.
    expect(catalog.recipes.some((r) => r.id === 'campfire')).toBe(false);
  });

  it('reiniciar conserva lo aprendido: es el motivo de todo esto', async () => {
    const store = new MemoryKeyValueStore();
    const session = await sessionWithInvention(store);

    session.reset(9);

    expect(worldOf(session).recipes.some((r) => r.id === INVENTO.id)).toBe(true);
  });

  it('y sigue estando en un mundo nacido en otra sesión', async () => {
    const store = new MemoryKeyValueStore();
    await sessionWithInvention(store);

    // Sesión nueva sobre la misma tienda, empezando sin partida: el catálogo
    // es del cuidador, no del guardado.
    const fresh = await GameSession.create({ seed: 11, autostart: false, fresh: false, store });
    fresh.reset(11);
    expect(worldOf(fresh).recipes.some((r) => r.id === INVENTO.id)).toBe(true);
  });

  it('«empezar de cero» ignora el catálogo pero no lo borra', async () => {
    const store = new MemoryKeyValueStore();
    const session = await sessionWithInvention(store);

    session.reset(9, { fromCatalog: false });
    expect(worldOf(session).recipes.some((r) => r.id === INVENTO.id)).toBe(false);

    // El catálogo sigue entero: ignorarlo y tirarlo son decisiones distintas.
    expect((await loadCatalog(store)).recipes.map((r) => r.id)).toEqual([INVENTO.id]);
  });

  it('vaciar el catálogo lo deja sin nada que sembrar', async () => {
    const store = new MemoryKeyValueStore();
    const session = await sessionWithInvention(store);

    await session.forgetCatalog();
    expect(session.getView().catalogSize).toBe(0);
    expect((await loadCatalog(store)).recipes).toEqual([]);
  });

  it('jugar una partida que no conoce un invento no lo borra del catálogo', async () => {
    const store = new MemoryKeyValueStore();
    const session = await sessionWithInvention(store);

    // Un mundo de cero no tiene el invento; guardar desde ahí no puede
    // arrastrarse lo que otra partida aportó.
    session.reset(9, { fromCatalog: false });
    await session.save();

    expect((await loadCatalog(store)).recipes.map((r) => r.id)).toEqual([INVENTO.id]);
  });
});
