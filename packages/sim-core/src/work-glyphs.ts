import type { Vec2 } from '@anima/shared';
import type { Glyph } from './glyphs.js';

/**
 * Cómo se ve una pieza CUANDO ESTÁ EN SU OBRA (ADR 0032, addenda de aspecto).
 *
 * El registro de dibujos de siempre contesta «¿cómo se ve un tablón?», y es
 * `Record<tipo, dibujo>` a propósito: un tipo tiene un dibujo y solo uno. Ese
 * invariante NO se toca acá, y es justamente lo que hace que un tablón tirado
 * en el piso siga viéndose como el día que ella lo dibujó.
 *
 * Este registro contesta otra pregunta: «¿cómo se ve el tablón que va en el
 * borde derecho de un puente?». Una obra no es un montón de piezas, es una
 * forma — y una pasarela dibujada como seis tablones sueltos uno al lado del
 * otro se lee como seis tablones sueltos, no como una pasarela. Las tablas del
 * medio quieren continuar la del costado; las de las puntas quieren rematar.
 *
 * Por eso la clave es el LUGAR en el plano y no el tipo: la misma pieza puede
 * necesitar dibujos distintos según qué le toca ser dentro de la obra. Y por
 * eso es un registro aparte: son dos preguntas distintas sobre la misma cosa, y
 * mezclarlas obligaría a elegir una y perder la otra.
 *
 * Se indexa por plano, no por obra construida: dos puentes del mismo plano se
 * ven igual, que es lo que uno espera de dos puentes iguales.
 */
export type WorkGlyphRegistry = Record<string, Record<string, Glyph>>;

/** La clave de una celda del plano. Misma forma que usa el resto del motor. */
export function offsetKey(offset: Vec2): string {
  return `${offset.x},${offset.y}`;
}

/** Lo que se propone: un plano y el dibujo de cada una de sus celdas. */
export interface WorkGlyphProposal {
  blueprintId: string;
  pieces: { offset: Vec2; rows: Glyph }[];
}

/**
 * El dibujo de una pieza en su obra, si alguien lo dibujó. Sin esto, quien
 * pinta cae al dibujo suelto del tipo — que es un fallback correcto, no un
 * error: una obra sin dibujos propios se ve como sus piezas.
 */
export function workGlyphFor(
  registry: WorkGlyphRegistry,
  blueprintId: string,
  offset: Vec2,
): Glyph | undefined {
  return registry[blueprintId]?.[offsetKey(offset)];
}
