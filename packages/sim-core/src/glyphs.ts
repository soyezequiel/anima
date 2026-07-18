import type { EntityKind } from './components.js';

/**
 * Cómo se ve una cosa que nadie dibujó a mano (la quinta puerta de invención).
 *
 * El catálogo del mundo es abierto por diseño: `EntityKind` es un string libre
 * y Ánima bautiza lo que inventa como quiera. Ninguna tabla de dibujos escrita
 * de antemano lo va a cubrir, así que lo dibuja quien mejor sabe qué inventó.
 *
 * Un glifo es una grilla de 16x16 donde cada carácter es un ÍNDICE de paleta,
 * NO un color: `0` transparente, `1` base, `2` sombra, `3` luz. Esa indirección
 * es lo que mantiene coherente un catálogo infinito — quien dibuja elige forma
 * y volumen, jamás color. El color lo pone quien pinta, derivándolo del
 * material, así que el polvo de piedra sale gris piedra aunque el dibujante
 * hubiera querido otra cosa.
 *
 * Es dato del mundo y no del código, igual que las recetas: viaja en los
 * snapshots, sobrevive al guardado, y un tipo ya dibujado no se vuelve a
 * dibujar. Que sea `Record` y no lista es a propósito: un tipo tiene un dibujo
 * y solo uno, y así el duplicado es imposible por estructura en vez de ser una
 * regla que hay que recordar.
 */

export const GLYPH_SIZE = 16;

/** `GLYPH_SIZE` filas de `GLYPH_SIZE` índices de paleta. */
export type Glyph = string[];

/** Qué dibujo tiene cada tipo. Los tipos sin dibujo simplemente no están. */
export type GlyphRegistry = Record<EntityKind, Glyph>;

/** Lo que se propone: un tipo y su dibujo. */
export interface GlyphProposal {
  kind: EntityKind;
  rows: Glyph;
}

/** El dibujo de un tipo, si alguien lo dibujó. */
export function glyphFor(registry: GlyphRegistry, kind: EntityKind): Glyph | undefined {
  return registry[kind];
}
