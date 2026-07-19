import { z } from 'zod';
import type { Result } from '@anima/shared';
import { err, ok } from '@anima/shared';
import type { Blueprint } from './blueprints.js';
import { GLYPH_SIZE } from './glyphs.js';
import { offsetKey } from './work-glyphs.js';
import type { WorkGlyphProposal } from './work-glyphs.js';

/**
 * La puerta de los dibujos de obra. Misma familia que `validateGlyph`: no juzga
 * si el dibujo se PARECE a nada —ninguna regla determinista puede— sino si es
 * dibujable, y además si corresponde al plano que dice ilustrar.
 *
 * Lo que cambia respecto de la puerta de siempre es qué cuenta como duplicado.
 * Allá, un tipo ya dibujado se rechaza: un tipo tiene un dibujo y solo uno. Acá
 * el dibujo no pertenece al tipo sino al LUGAR que ocupa en una obra, así que
 * dos celdas del mismo plano con la misma pieza son dos dibujos legítimos y
 * distintos — es justamente el punto. Lo que no se admite es dibujar dos veces
 * la misma celda, ni dibujar una celda que el plano no tiene.
 */

/** Cuántas obras ilustradas admite un mundo. Mismo espíritu que `MAX_GLYPHS`. */
export const MAX_WORK_GLYPHS = 24;

/** Igual que en un glifo suelto: menos que esto es una mota invisible. */
const MIN_INK = 12;

const rowSchema = z
  .string()
  .length(GLYPH_SIZE, `cada fila mide exactamente ${GLYPH_SIZE} caracteres`)
  .regex(/^[0-3]+$/, 'solo índices de paleta: 0 vacío, 1 base, 2 sombra, 3 luz');

const proposalSchema = z
  .object({
    blueprintId: z.string().min(1).max(60),
    pieces: z
      .array(
        z
          .object({
            offset: z.object({ x: z.number().int(), y: z.number().int() }).strict(),
            rows: z
              .array(rowSchema)
              .length(GLYPH_SIZE, `el dibujo tiene exactamente ${GLYPH_SIZE} filas`),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export function validateWorkGlyphs(
  raw: unknown,
  blueprint: Blueprint,
  illustrated: readonly string[] = [],
): Result<WorkGlyphProposal> {
  const parsed = proposalSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      `Dibujo de obra inválido: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    );
  }
  const proposal = parsed.data as WorkGlyphProposal;

  if (proposal.blueprintId !== blueprint.id) {
    return err(
      `Dibujo de obra inválido: dice ser de "${proposal.blueprintId}" y el plano es "${blueprint.id}"`,
    );
  }
  if (!illustrated.includes(blueprint.id) && illustrated.length >= MAX_WORK_GLYPHS) {
    return err('Dibujo de obra inválido: este mundo ya no admite más obras ilustradas');
  }

  // Cada celda dibujada tiene que ser una celda del plano. Un dibujo para un
  // lugar que la obra no tiene no se vería nunca: es trabajo tirado, y sobre
  // todo es la señal de que quien dibujó no entendió el plano.
  const cells = new Set(blueprint.placements.map((p) => offsetKey(p.offset)));
  const seen = new Set<string>();
  for (const piece of proposal.pieces) {
    const key = offsetKey(piece.offset);
    if (!cells.has(key)) {
      return err(`Dibujo de obra inválido: el plano "${blueprint.id}" no tiene la celda (${key})`);
    }
    if (seen.has(key)) {
      return err(`Dibujo de obra inválido: la celda (${key}) viene dibujada dos veces`);
    }
    seen.add(key);
    const ink = piece.rows.join('').replace(/0/g, '').length;
    if (ink < MIN_INK) {
      return err(
        `Dibujo de obra inválido: la celda (${key}) quedaría casi invisible ` +
          `(${ink} casillas pintadas, hacen falta ${MIN_INK})`,
      );
    }
  }

  // No se exige dibujar TODAS las celdas: lo que falte cae al dibujo suelto de
  // su tipo, que es un desenlace correcto y no un error. Una obra ilustrada a
  // medias se ve mitad forma y mitad piezas — feo, quizá, pero nunca rota.
  return ok(structuredClone(proposal));
}
