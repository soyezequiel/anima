import { z } from 'zod';
import type { Result } from '@anima/shared';
import { err, ok } from '@anima/shared';
import type { EntityKind } from './components.js';
import { GLYPH_SIZE } from './glyphs.js';
import type { GlyphProposal } from './glyphs.js';

/**
 * La puerta por la que entra un dibujo inventado (la quinta puerta).
 *
 * Es a los glifos lo que `validateDecomposition` es a las descomposiciones:
 * lo que propone un modelo es tan poco confiable como cualquier dato externo.
 * Acá NO se juzga si el dibujo se PARECE a la cosa —eso no lo puede decidir
 * ninguna regla determinista— sino si es *dibujable*: la medida exacta, el
 * alfabeto cerrado, y que haya algo que ver.
 *
 * Que el alfabeto sea `0-3` y no colores es lo que hace que esta puerta pueda
 * ser tan corta. Un dibujo que llegara como colores libres habría que revisarlo
 * contra la paleta, contra el fondo, contra el contraste; como llega como
 * índices, el peor glifo posible sigue siendo del color que le corresponde a su
 * material. La coherencia no se valida: es imposible romperla.
 */

/** Cuántos dibujos admite un mundo EN TOTAL. Inventar no es spam. */
export const MAX_GLYPHS = 64;

/**
 * Cuántas casillas encendidas hacen un dibujo. Menos que esto es una mota:
 * técnicamente válido, invisible en pantalla. El techo lo pone la grilla.
 */
const MIN_INK = 12;

const rowSchema = z
  .string()
  .length(GLYPH_SIZE, `cada fila mide exactamente ${GLYPH_SIZE} caracteres`)
  .regex(/^[0-3]+$/, 'solo índices de paleta: 0 vacío, 1 base, 2 sombra, 3 luz');

const glyphSchema = z
  .object({
    kind: z.string().min(1).max(40),
    rows: z
      .array(rowSchema)
      .length(GLYPH_SIZE, `el dibujo tiene exactamente ${GLYPH_SIZE} filas`),
  })
  .strict();

/**
 * `existing` son los NOMBRES de lo ya dibujado, no el registro entero: el
 * mundo tiene las grillas pero el agente solo conoce los nombres, y las dos
 * puertas —la del agente, que ahorra el viaje, y la del mundo, que decide—
 * tienen que aplicar exactamente la misma regla.
 */
export function validateGlyph(
  raw: unknown,
  existing: readonly EntityKind[] = [],
): Result<GlyphProposal> {
  const parsed = glyphSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      `Dibujo inválido: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    );
  }
  const proposal = parsed.data as GlyphProposal;

  if (existing.includes(proposal.kind)) {
    return err(`Dibujo inválido: ya sé cómo se ve "${proposal.kind}"`);
  }
  if (existing.length >= MAX_GLYPHS) {
    return err('Dibujo inválido: este mundo ya no admite más dibujos');
  }

  // Un lienzo vacío no es un dibujo: sería un objeto invisible, que en pantalla
  // se lee como un bug y no como una cosa. Mejor que caiga al dibujo
  // procedural, que al menos se ve.
  const ink = proposal.rows.join('').replace(/0/g, '').length;
  if (ink < MIN_INK) {
    return err(
      `Dibujo inválido: quedaría casi invisible (${ink} casillas pintadas, hacen falta ${MIN_INK})`,
    );
  }

  return ok(structuredClone(proposal));
}
