import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetAiChoice,
  forgetOpenAiSettings,
  openAiSettingsComplete,
  readAiChoice,
  readOpenAiSettings,
  readStoredAiChoice,
  storeAiChoice,
  storeOpenAiSettings,
} from '../src/auth/ai.js';

/**
 * Con qué piensa la mascota lo decide una sola cosa: lo que el usuario eligió.
 * Sin elección, el simulado — nadie empieza gastando (ADR 0089).
 *
 * Hubo un tiempo en que una instancia con la cuenta prestada daba vuelta ese
 * default y arrancaba pensando con Codex. Se fue con la canilla, y lo que sigue
 * en pie es la pieza que hacía falta para que aquello funcionara: distinguir
 * «no elegí» de «elegí el simulado». Sigue importando por el otro lado — una
 * mente real que se cae se OLVIDA, para que vuelva sola cuando vuelva; una que
 * se apaga a mano se guarda, y no la revive nadie.
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

  it('encenderla se guarda igual, y la API propia es una elección más', () => {
    storeAiChoice('codex');
    expect(readStoredAiChoice()).toBe('codex');
    storeAiChoice('claude');
    expect(readStoredAiChoice()).toBe('claude');
    storeAiChoice('openai');
    expect(readStoredAiChoice()).toBe('openai');
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

/**
 * La API que trae el que juega. Los tres campos van juntos o no van: con dos de
 * tres no hay nada que llamar, y encender la mente ahí dejaría a la mascota
 * muda por una razón que aparece minutos después y en otra pantalla.
 */
describe('la API propia guardada en este navegador', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = memoriaDelNavegador();
  });

  it('sin nada guardado no hay API, y no está completa', () => {
    expect(readOpenAiSettings()).toEqual({ baseUrl: '', apiKey: '', model: '' });
    expect(openAiSettingsComplete(readOpenAiSettings())).toBe(false);
  });

  it('guarda los tres campos y los devuelve sin espacios de más', () => {
    storeOpenAiSettings({
      baseUrl: '  https://api.openai.com/v1  ',
      apiKey: ' sk-x ',
      model: ' gpt-4o-mini ',
    });
    expect(readOpenAiSettings()).toEqual({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-x',
      model: 'gpt-4o-mini',
    });
    expect(openAiSettingsComplete(readOpenAiSettings())).toBe(true);
  });

  it('con dos de tres no alcanza', () => {
    storeOpenAiSettings({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x', model: '' });
    expect(openAiSettingsComplete(readOpenAiSettings())).toBe(false);
  });

  it('olvidarla la borra de veras: la llave no queda dando vueltas', () => {
    storeOpenAiSettings({ baseUrl: 'https://x/v1', apiKey: 'sk-secreta', model: 'm' });
    forgetOpenAiSettings();
    expect(localStorage.getItem('anima:ai:openai-settings')).toBeNull();
    expect(readOpenAiSettings().apiKey).toBe('');
  });

  it('un guardado corrupto no rompe el arranque: se lee como si no hubiera nada', () => {
    localStorage.setItem('anima:ai:openai-settings', '{no es json');
    expect(readOpenAiSettings()).toEqual({ baseUrl: '', apiKey: '', model: '' });
  });
});
