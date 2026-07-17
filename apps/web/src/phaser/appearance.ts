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
  water: '🌊',
  shelter: '🛖',
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

/**
 * Cómo se ve algo cuando no hay emoji que lo explique: un bloque de color.
 * `labelled` distingue los dos casos, que no son el mismo — el muro es gris y
 * se reconoce solo; lo que no se parece a nada es ámbar y necesita decir su
 * nombre, porque el dibujo no lo dice.
 */
export interface BlockLook {
  as: 'block';
  fill: number;
  stroke: number;
  labelled: boolean;
}

export type Appearance = { as: 'emoji'; emoji: string } | BlockLook;

const WALL_LOOK: BlockLook = { as: 'block', fill: 0x64748b, stroke: 0x334155, labelled: false };
const UNKNOWN_LOOK: BlockLook = { as: 'block', fill: 0x92400e, stroke: 0xfbbf24, labelled: true };

/**
 * El aspecto completo de una cosa. Vive acá y no en la escena porque el
 * tablero no es el único que dibuja: el catálogo de items muestra lo mismo, y
 * dos reglas separadas se irían despegando hasta que una cosa se viera de dos
 * maneras según dónde la mires.
 */
export function appearanceFor(kind: string, traits: EntityTraits): Appearance {
  if (kind === 'wall') return WALL_LOOK;
  const emoji = emojiFor(kind, traits);
  return emoji ? { as: 'emoji', emoji } : UNKNOWN_LOOK;
}

/** El color de un bloque como lo escribe CSS (Phaser lo quiere en número). */
export function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
