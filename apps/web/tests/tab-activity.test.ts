import { describe, expect, it } from 'vitest';
import type { GameView } from '../src/session/view.js';
import {
  ACTIVITY_WINDOW_MS,
  advanceActivity,
  initialActivity,
  litTabs,
  nextExpiryMs,
} from '../src/components/tabActivity.js';

/** Lo mínimo que las firmas miran; el resto del view no cambia el resultado. */
function makeView(patch: Partial<GameView> = {}): GameView {
  return {
    chat: [],
    goals: [],
    personality: [],
    facts: [],
    hypotheses: [],
    items: [],
    blueprints: [],
    plannedStructures: [],
    skills: [],
    experiments: [],
    thoughts: [],
    pet: null,
    currentThought: null,
    skillDev: null,
    ...patch,
  } as unknown as GameView;
}

const T0 = 1_000_000;

describe('actividad por pestaña', () => {
  it('el primer view no enciende nada: al abrir la partida todo es nuevo', () => {
    const view = makeView({ items: [{ kind: 'tronco', inWorld: 3, inInventory: 0 }] as never });
    expect(litTabs(initialActivity(view), T0).size).toBe(0);
  });

  it('enciende la pestaña cuya lista cambió, y solo esa', () => {
    const before = makeView({ items: [{ kind: 'tronco', inWorld: 3, inInventory: 0 }] as never });
    const after = makeView({ items: [{ kind: 'tronco', inWorld: 2, inInventory: 1 }] as never });
    const state = advanceActivity(initialActivity(before), after, T0);
    expect([...litTabs(state, T0)]).toEqual(['objetos']);
  });

  it('el mismo view repetido no reenciende: la luz caduca sola', () => {
    const before = makeView();
    const after = makeView({ facts: ['el fuego calienta'] });
    let state = advanceActivity(initialActivity(before), after, T0);
    expect(litTabs(state, T0).has('estado')).toBe(true);

    state = advanceActivity(state, after, T0 + 1000);
    expect(litTabs(state, T0 + 1000).has('estado')).toBe(true);
    expect(litTabs(state, T0 + ACTIVITY_WINDOW_MS + 1).has('estado')).toBe(false);
  });

  it('una obra que avanza un bloque cuenta como actividad', () => {
    const planned = (remaining: number) =>
      makeView({ plannedStructures: [{ blueprintId: 'escuela', remaining }] as never });
    const state = advanceActivity(initialActivity(planned(4)), planned(3), T0);
    expect(litTabs(state, T0).has('obras')).toBe(true);
  });

  it('un ciclo de aprendizaje en curso queda encendido más allá de la ventana', () => {
    const learning = makeView({ skillDev: { skillName: 'buscar-calor' } as never });
    const state = advanceActivity(initialActivity(makeView()), learning, T0);
    expect(litTabs(state, T0 + ACTIVITY_WINDOW_MS * 100).has('habilidades')).toBe(true);
    expect(nextExpiryMs(state, T0)).toBe(null);
  });

  it('cuando el ciclo termina se apaga con cola, no de golpe', () => {
    const learning = makeView({ skillDev: { skillName: 'buscar-calor' } as never });
    const done = makeView();
    const running = advanceActivity(initialActivity(makeView()), learning, T0);
    const ended = advanceActivity(running, done, T0 + 5000);
    expect(litTabs(ended, T0 + 5000).has('habilidades')).toBe(true);
    expect(litTabs(ended, T0 + 5000 + ACTIVITY_WINDOW_MS + 1).has('habilidades')).toBe(false);
  });

  it('un mensaje del cuidador sin leer mantiene el Chat encendido', () => {
    const pending = makeView({
      chat: [{ from: 'user', text: 'hola', tick: 3, pending: true }] as never,
    });
    const state = advanceActivity(initialActivity(makeView()), pending, T0);
    expect(litTabs(state, T0 + ACTIVITY_WINDOW_MS * 10).has('chat')).toBe(true);
  });
});
