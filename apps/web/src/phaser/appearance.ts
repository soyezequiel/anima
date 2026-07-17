import type { EntityTraits } from '../session/view.js';

/**
 * Qué aspecto tiene cada cosa. Es lógica pura y vive fuera de la escena: no
 * necesita Phaser, un canvas ni un navegador para decidirse, y así se puede
 * probar sola.
 */

export const KIND_EMOJI: Record<string, string> = {
  food: '🍎',
  // El 🪵 es un leño grueso, y por eso es del tronco. La rama es lo otro: una
  // vara fina y ramificada que apenas sirve de herramienta. El 🌿 de antes
  // parecía una planta viva, no madera: tronco y rama no se distinguían como
  // dos formas del mismo material.
  log: '🪵',
  branch: '🪾',
  flint: '🪨',
  hammer: '🔨',
  tree: '🌳',
  cactus: '🌵',
  campfire: '🔥',
  chair: '🪑',
  torch: '🕯️',
  barricade: '🚧',
};

/**
 * Qué dibujar cuando el nombre no dice nada. Ánima puede inventar objetos
 * (ADR 0018) y bautizarlos como quiera: ninguna tabla nuestra va a tener
 * "hoguera-simple". Pero si irradia calor **es** un fuego, y se dibuja como
 * tal — un objeto es lo que sus componentes le permiten hacer, y eso vale
 * tanto para el motor como para el dibujo.
 *
 * El orden va de lo más específico a lo más genérico: algo que da calor Y
 * quema es un fuego antes que un peligro cualquiera.
 */
const TRAIT_EMOJI: [trait: keyof EntityTraits, emoji: string][] = [
  ['warm', '🔥'],
  ['growsFood', '🌳'],
  ['edible', '🍎'],
  ['tool', '🔨'],
  ['dangerous', '🌵'],
];

/**
 * El emoji de una entidad: por nombre exacto, y si no lo conocemos, por lo que
 * la cosa es. Solo si nada la explica, `undefined` y va al placeholder.
 */
export function emojiFor(kind: string, traits: EntityTraits): string | undefined {
  const byKind = KIND_EMOJI[kind];
  if (byKind) return byKind;
  return TRAIT_EMOJI.find(([trait]) => traits[trait])?.[1];
}
