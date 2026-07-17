import { describe, expect, it } from 'vitest';
import { kindLabel } from '@anima/shared';
import { appearanceFor, emojiFor, hexColor } from '../src/phaser/appearance.js';

/**
 * Cómo se ve y cómo se llama una cosa. Dos reglas: el nombre interno nunca se
 * le muestra a quien juega, y un objeto se dibuja por lo que ES — que es lo
 * único que sirve para lo que Ánima inventa, cuyo nombre no está en ninguna
 * tabla nuestra.
 */

describe('los nombres se dicen en voz humana', () => {
  it('traduce los tipos del motor', () => {
    expect(kindLabel('log')).toBe('tronco');
    expect(kindLabel('flint')).toBe('pedernal');
    expect(kindLabel('campfire')).toBe('fogata');
    expect(kindLabel('tree')).toBe('árbol');
    expect(kindLabel('water')).toBe('agua');
    expect(kindLabel('shelter')).toBe('refugio');
  });

  it('lo que Ánima inventó ya viene con nombre: solo se limpian los guiones', () => {
    expect(kindLabel('hoguera-simple')).toBe('hoguera simple');
    expect(kindLabel('brasero')).toBe('brasero');
  });
});

describe('los gráficos se reutilizan por lo que la cosa es', () => {
  it('cada tipo conocido tiene el suyo, y el tronco se queda con el 🪵', () => {
    expect(emojiFor('log', {})).toBe('🪵');
    expect(emojiFor('tree', {})).toBe('🌳');
    expect(emojiFor('campfire', {})).toBe('🔥');
    // La rama no es un tronco: es una vara fina y ramificada, madera seca en
    // vez de leño grueso. Antes era 🌿 y parecía una planta, no madera.
    expect(emojiFor('branch', {})).toBe('🪾');
    expect(emojiFor('water', {})).toBe('🌊');
    expect(emojiFor('shelter', {})).toBe('🛖');
  });

  it('lo que Ánima inventa se dibuja como lo que es, sin estar en ninguna tabla', () => {
    // Una "hoguera-simple" con heatSource ES un fuego, aunque nadie la haya
    // escrito nunca: se reutiliza el gráfico de lo que ya existe.
    expect(emojiFor('hoguera-simple', { warm: true, dangerous: true })).toBe('🔥');
    expect(emojiFor('brasero-de-piedra', { warm: true })).toBe('🔥');
  });

  it('el nombre exacto manda sobre el rasgo', () => {
    // La fogata da calor Y quema, pero ya tiene su propio gráfico.
    expect(emojiFor('campfire', { warm: true, dangerous: true })).toBe('🔥');
    // Un árbol produce comida, pero es un árbol antes que una manzana.
    expect(emojiFor('tree', { growsFood: true })).toBe('🌳');
  });

  it('de lo más específico a lo más genérico: dar calor gana sobre quemar', () => {
    expect(emojiFor('cosa-nueva', { warm: true, dangerous: true })).toBe('🔥');
    expect(emojiFor('cosa-nueva', { dangerous: true })).toBe('🌵');
  });

  it('lo que no se parece a nada no tiene gráfico: va al placeholder', () => {
    expect(emojiFor('cosa-rara', {})).toBeUndefined();
    expect(emojiFor('cosa-rara', { solid: true, portable: true })).toBeUndefined();
  });
});

/**
 * El aspecto completo lo deciden el tablero y el catálogo con la MISMA regla:
 * una cosa no puede verse de dos maneras según dónde la mires.
 */
describe('el aspecto de una cosa es uno solo', () => {
  it('lo que tiene emoji se dibuja con su emoji', () => {
    expect(appearanceFor('log', {})).toEqual({ as: 'emoji', emoji: '🪵' });
    expect(appearanceFor('hoguera-simple', { warm: true })).toEqual({ as: 'emoji', emoji: '🔥' });
  });

  it('el muro es un bloque gris sin rótulo: se reconoce solo', () => {
    const look = appearanceFor('wall', { solid: true });
    expect(look).toMatchObject({ as: 'block', labelled: false });
  });

  it('lo que no se parece a nada es un bloque que dice su nombre', () => {
    const look = appearanceFor('cosa-rara', { solid: true });
    expect(look).toMatchObject({ as: 'block', labelled: true });
    // Distinto del muro: un invento sin forma no puede confundirse con piedra.
    expect(look).not.toEqual(appearanceFor('wall', { solid: true }));
  });

  it('el color del bloque se lee igual en Phaser y en CSS', () => {
    expect(hexColor(0x64748b)).toBe('#64748b');
    // Sin ceros a la izquierda el color sería otro (#4f46e5 vs #4f46e).
    expect(hexColor(0x04f46e)).toBe('#04f46e');
  });
});
