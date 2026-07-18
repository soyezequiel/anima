import type { EntityTraits } from '../session/view.js';
import type { Glyph, Palette } from './matter.js';
import { paletteFor, parseGlyph, patternFor } from './matter.js';

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
  // El pino es el árbol de la resina: otra silueta para que "qué árbol talo"
  // se pueda decidir mirando. El arbusto sí es una planta viva (el 🌿 que a
  // la rama le quedaba mal acá es exacto): fibra que brota, no madera.
  pine: '🌲',
  bush: '🌿',
  cactus: '🌵',
  campfire: '🔥',
  chair: '🪑',
  torch: '🕯️',
  // 🧱 y no 🚧: desde que se levanta con ladrillos es un muro, no una valla
  // de obra.
  barricade: '🧱',
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
 * produce comida es un fuego antes que un árbol.
 *
 * Solo entran los rasgos que DETERMINAN el aspecto. `tool` y `dangerous`
 * estuvieron acá y estaban mal: dicen qué hace una cosa, no cómo se ve. Un
 * martillo, un cuchillo y un hacha son los tres `tool` y no se parecen en
 * nada; un cuchillo es `dangerous` y no es un cactus. Adivinar por ahí le
 * puso un 🔨 al primer cuchillo que Ánima inventó. Cuando la alternativa era
 * un cuadrado con el nombre escrito, adivinar mal salía barato; ahora que
 * abajo hay un dibujo de verdad, sale caro — así que no se adivina.
 */
const TRAIT_EMOJI: [trait: keyof EntityTraits, emoji: string][] = [
  ['warm', '🔥'],
  ['growsFood', '🌳'],
  ['edible', '🍎'],
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
 * El muro: lo único que sigue siendo un bloque liso. Es pared del mundo, no
 * una cosa que Ánima pueda juntar, y se reconoce solo sin decir su nombre.
 */
export interface BlockLook {
  as: 'block';
  fill: number;
  stroke: number;
}

/** Materia dibujada: una grilla de índices más la paleta que los resuelve. */
export interface MatterLook {
  as: 'matter';
  glyph: Glyph;
  palette: Palette;
}

export type Appearance = { as: 'emoji'; emoji: string } | BlockLook | MatterLook;

const WALL_LOOK: BlockLook = { as: 'block', fill: 0x64748b, stroke: 0x334155 };

/**
 * El aspecto completo de una cosa. Vive acá y no en la escena porque el
 * tablero no es el único que dibuja: el catálogo de items muestra lo mismo, y
 * dos reglas separadas se irían despegando hasta que una cosa se viera de dos
 * maneras según dónde la mires.
 *
 * La cascada baja de lo más específico a lo más genérico y NUNCA se queda sin
 * respuesta:
 *
 *   1. el muro, que es aparte;
 *   2. el emoji, por nombre exacto o por lo que la cosa hace;
 *   3. el glifo que dibujó la IA Dios, si validó;
 *   4. materia procedural: paleta del material + patrón de la forma.
 *
 * El paso 4 no puede fallar, y por eso el cuadrado ámbar con el nombre escrito
 * adentro ya no existe. Un objeto recién inventado se dibuja aunque la IA esté
 * caída, aunque no tenga rasgos reconocibles y aunque nadie lo haya visto
 * nunca: en el peor caso sale una masa de color estable, que sigue siendo un
 * dibujo y no una disculpa.
 */
export interface AppearanceHints {
  /** Lo que la IA Dios dibujó para este tipo, si es que dibujó algo. */
  glyph?: unknown;
  /**
   * De qué está hecho, heredado de su receta. Lo resuelve `GameSession`, que
   * es donde viven las recetas; acá solo se usa para elegir la paleta.
   */
  material?: string | undefined;
}

export function appearanceFor(
  kind: string,
  traits: EntityTraits,
  hints: AppearanceHints = {},
): Appearance {
  if (kind === 'wall') return WALL_LOOK;
  const emoji = emojiFor(kind, traits);
  if (emoji) return { as: 'emoji', emoji };
  return {
    as: 'matter',
    glyph: parseGlyph(hints.glyph) ?? patternFor(kind),
    palette: paletteFor(kind, hints.material),
  };
}

/** El color de un bloque como lo escribe CSS (Phaser lo quiere en número). */
export function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
