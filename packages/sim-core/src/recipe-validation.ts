import { z } from 'zod';
import type { Result } from '@anima/shared';
import { err, ok } from '@anima/shared';
import type { Recipe } from './recipes.js';

/**
 * La puerta por la que entra una receta inventada. Es a las recetas lo que
 * `validateSkillProgram` es a los programas: lo que propone un modelo es tan
 * poco confiable como cualquier dato externo, y aquí no se juzga si la receta
 * es *útil* (eso lo dirá el mundo cuando la mascota intente usarla) sino si es
 * *coherente con la física*: que no invente materia, ni recursos, ni poderes
 * que su mundo no tiene.
 *
 * Sin esta puerta, "inventar" sería el agujero por el que la mascota resuelve
 * cualquier problema declarándolo resuelto — el equivalente físico de
 * aprobarse su propio examen.
 */

/** Cuántas recetas inventadas admite un mundo: inventar no puede ser spam. */
export const MAX_INVENTED_RECIPES = 12;

/**
 * Lo que una receta inventada PUEDE producir. Es una lista cerrada, y lo que
 * queda afuera importa más que lo que está adentro:
 *
 * - `edible`/`nutrition`/`foodSource`: la mascota no puede inventar comida. Si
 *   pudiera, el hambre —el motor de toda su historia— se resolvería declarando
 *   que la madera alimenta. Inventar da CAPACIDADES, no RECURSOS (ADR 0008).
 * - `agent`: no puede crear criaturas.
 * - `energy`/`health`/`temperature`/`strength`/`inventory`: son propiedades de
 *   un cuerpo vivo, no de un objeto fabricado.
 * - `position`: la pone el mundo al construir, no la receta.
 * - `dead`: no tiene sentido en algo que nace.
 */
const outputComponentsSchema = z
  .object({
    collider: z.object({ solid: z.boolean() }).strict().optional(),
    portable: z.object({}).strict().optional(),
    hardness: z.object({ value: z.number().min(0).max(10) }).strict().optional(),
    durability: z
      .object({ current: z.number().int().min(1).max(30), max: z.number().int().min(1).max(30) })
      .strict()
      .refine((d) => d.current <= d.max, { message: 'current no puede superar max' })
      .optional(),
    // Acotado al martillo: no puede inventar una herramienta mejor que la
    // mejor que su mundo ya tiene.
    tool: z.object({ power: z.number().min(0).max(8) }).strict().optional(),
    hazard: z.object({ damagePerTick: z.number().min(0).max(3) }).strict().optional(),
    heatSource: z
      .object({
        warmthPerTick: z.number().min(0).max(1),
        range: z.number().int().min(1).max(3),
      })
      .strict()
      .optional(),
    drops: z
      .array(
        z
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
          .strict(),
      )
      .max(8)
      .optional(),
  })
  .strict();

const recipeSchema = z
  .object({
    id: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[a-z][a-z0-9-]*$/, 'solo minúsculas, dígitos y guiones'),
    output: z
      .object({
        kind: z
          .string()
          .min(2)
          .max(40)
          .regex(/^[a-z][a-z0-9-]*$/, 'solo minúsculas, dígitos y guiones'),
        components: outputComponentsSchema,
      })
      .strict(),
    ingredients: z
      .array(
        z
          .object({
            kind: z.string().min(1).max(40),
            count: z.number().int().min(1).max(8),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();

/**
 * Tipos que la mascota nunca puede fabricar: son su propio cuerpo o el recurso
 * del que depende. Inventar "food" con otro nombre es el mismo agujero.
 */
const PROTECTED_KINDS = new Set(['pet', 'food', 'tree']);

export function validateRecipe(
  raw: unknown,
  existing: Recipe[] = [],
): Result<Recipe> {
  const parsed = recipeSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      `Receta inválida: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
    );
  }
  const recipe = parsed.data as Recipe;

  if (PROTECTED_KINDS.has(recipe.output.kind)) {
    return err(`Receta inválida: no se puede fabricar "${recipe.output.kind}"`);
  }
  if (existing.some((r) => r.id === recipe.id)) {
    return err(`Receta inválida: ya existe una receta "${recipe.id}"`);
  }
  if (existing.length >= MAX_INVENTED_RECIPES) {
    return err(`Receta inválida: este mundo ya no admite más recetas`);
  }

  // Sin componentes, lo construido sería decoración inerte: existe y no hace
  // nada. Un objeto es lo que sus componentes le permiten hacer.
  if (Object.keys(recipe.output.components).length === 0) {
    return err('Receta inválida: lo construido no haría absolutamente nada');
  }

  const ingredientKinds = new Set(recipe.ingredients.map((i) => i.kind));

  // Convertir algo en más de sí mismo es duplicar materia.
  if (ingredientKinds.has(recipe.output.kind)) {
    return err(
      `Receta inválida: "${recipe.output.kind}" no puede ser ingrediente de sí mismo`,
    );
  }

  // Lo que deja al romperse no puede superar lo que costó: si no, construir y
  // romper en bucle fabrica materia de la nada.
  const totalIngredients = recipe.ingredients.reduce((sum, i) => sum + i.count, 0);
  const drops = recipe.output.components.drops ?? [];
  if (drops.length > totalIngredients) {
    return err(
      `Receta inválida: deja ${drops.length} objetos al romperse pero cuesta ${totalIngredients}: crearía materia`,
    );
  }
  for (const drop of drops) {
    if (PROTECTED_KINDS.has(drop.kind)) {
      return err(`Receta inválida: no puede dejar "${drop.kind}" al romperse`);
    }
  }

  return ok(recipe);
}
