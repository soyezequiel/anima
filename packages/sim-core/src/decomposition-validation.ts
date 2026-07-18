import { z } from 'zod';
import type { Result } from '@anima/shared';
import { err, ok } from '@anima/shared';
import type { Decomposition } from './decompositions.js';
import { PROTECTED_KINDS } from './recipe-validation.js';

/**
 * La puerta por la que entra una descomposición inventada (la cuarta puerta de
 * invención). Es a las descomposiciones lo que `validateInteraction` es a las
 * interacciones: lo que propone un modelo es tan poco confiable como cualquier
 * dato externo, y aquí NO se juzga si tiene sentido que un pedernal deje
 * esquirlas —eso es del juez semántico, la IA Dios del ADR 0027— sino si es
 * *posible dentro de la física*: que no fabrique lo protegido (comida, la
 * mascota, el árbol) rompiendo algo con otro nombre.
 *
 * La conservación fina —cuánto es razonable que deje— la decide el juicio de
 * coherencia, no un tope numérico: romper materia base no tiene una receta que
 * acote su costo, así que quien dice "un pedernal no deja diez troncos" es el
 * Dios, no esta puerta. El `.max()` del esquema es solo cordura estructural,
 * hermano del que ya rige los `drops` de una receta.
 */

/** Cuántas descomposiciones admite un mundo EN TOTAL. Inventar no es spam. */
export const MAX_DECOMPOSITIONS = 16;

const kebab = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z][a-z0-9-]*$/, 'solo minúsculas, dígitos y guiones');

/**
 * Lo que una descomposición PUEDE dejar: materia, no capacidades vivas ni
 * comida. Las mismas cotas que los `drops` de una receta — el techo de lo que
 * se deja al romperse es uno solo, viva la regla en una receta o aquí.
 */
const dropSchema = z
  .object({
    kind: z.string().min(1).max(40),
    components: z
      .object({
        portable: z.object({}).strict().optional(),
        collider: z.object({ solid: z.boolean() }).strict().optional(),
        hardness: z.object({ value: z.number().min(0).max(10) }).strict().optional(),
        tool: z.object({ power: z.number().min(0).max(8) }).strict().optional(),
      })
      .strict(),
  })
  .strict();

const decompositionSchema = z
  .object({
    id: kebab,
    targetKind: z.string().min(1).max(40),
    drops: z.array(dropSchema).min(1).max(8),
  })
  .strict();

export function validateDecomposition(
  raw: unknown,
  existing: Decomposition[] = [],
): Result<Decomposition> {
  const parsed = decompositionSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      `Descomposición inválida: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    );
  }
  const proposal = parsed.data as Decomposition;

  // La mascota no es materia que se rompa en partes.
  if (proposal.targetKind === 'pet') {
    return err('Descomposición inválida: la mascota no se descompone');
  }
  if (existing.some((d) => d.id === proposal.id)) {
    return err(`Descomposición inválida: ya existe una descomposición "${proposal.id}"`);
  }
  if (existing.some((d) => d.targetKind === proposal.targetKind)) {
    return err(
      `Descomposición inválida: ya sé en qué se deshace "${proposal.targetKind}"`,
    );
  }
  if (existing.length >= MAX_DECOMPOSITIONS) {
    return err('Descomposición inválida: este mundo ya no admite más descomposiciones');
  }

  // El agujero que cierra la puerta: dejar comida (o la mascota, o el árbol) al
  // romper algo sería inventar el recurso con otro verbo. Inventar da materia
  // inerte, nunca lo que el ADR 0008 protege.
  for (const drop of proposal.drops) {
    if (PROTECTED_KINDS.has(drop.kind)) {
      return err(`Descomposición inválida: no puede dejar "${drop.kind}" al romperse`);
    }
    // Convertir algo en más de sí mismo rompiéndolo es duplicar materia: un
    // pedernal que deja dos pedernales es una fábrica. En más de uno lo veta la
    // conservación de plano; que deje UN fragmento del mismo tipo (una roca que
    // deja una roca más chica) lo juzga el Dios, no esta puerta.
    if (drop.kind === proposal.targetKind && proposal.drops.length > 1) {
      return err(
        `Descomposición inválida: "${proposal.targetKind}" no puede dejar varios de sí mismo`,
      );
    }
  }

  return ok(structuredClone(proposal));
}
