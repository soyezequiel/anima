import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetAiChoice,
  readAiChoice,
  readStoredAiChoice,
  storeAiChoice,
} from '../src/auth/ai.js';

/**
 * Con qué piensa la mascota lo deciden dos cosas, y el orden importa: lo que
 * el usuario eligió gana siempre, y solo cuando no eligió nada entra a jugar
 * el default de la instancia (en `main.tsx`: con la sesión prestada, Codex).
 *
 * Lo que se prueba acá es la pieza que hacía falta para que eso funcione —
 * distinguir «no elegí» de «elegí el simulado»—, porque antes apagar la mente
 * real borraba la clave y era indistinguible de una visita nueva: el default
 * la habría vuelto a encender en la recarga siguiente.
 */
/**
 * La suite corre en Node, sin DOM. Un `localStorage` de tres líneas alcanza y
 * es más honesto que traer un jsdom entero: lo que se prueba acá es qué se
 * guarda y cómo se lee, no el navegador.
 */
function memoriaDelNavegador(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (k: string) => datos.get(k) ?? null,
    key: (i: number) => [...datos.keys()][i] ?? null,
    removeItem: (k: string) => datos.delete(k),
    setItem: (k: string, v: string) => datos.set(k, v),
  } as Storage;
}

describe('la elección de con qué piensa', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = memoriaDelNavegador();
  });

  it('sin nada guardado no hay elección, y el default queda libre', () => {
    expect(readStoredAiChoice()).toBeNull();
    // Quien no sabe del default sigue leyendo lo de siempre.
    expect(readAiChoice()).toBe('mock');
  });

  it('apagarla a mano se guarda: no es lo mismo que no haber elegido', () => {
    storeAiChoice('mock');
    expect(readStoredAiChoice()).toBe('mock');
    expect(readAiChoice()).toBe('mock');
  });

  it('encenderla se guarda igual', () => {
    storeAiChoice('codex');
    expect(readStoredAiChoice()).toBe('codex');
    storeAiChoice('claude');
    expect(readStoredAiChoice()).toBe('claude');
  });

  it('olvidarla devuelve la decisión al default de la instancia', () => {
    storeAiChoice('codex');
    forgetAiChoice();
    expect(readStoredAiChoice()).toBeNull();
  });

  it('un valor corrupto se lee como si no hubiera elección', () => {
    localStorage.setItem('anima:ai:choice', 'gemini');
    expect(readStoredAiChoice()).toBeNull();
    expect(readAiChoice()).toBe('mock');
  });
});
