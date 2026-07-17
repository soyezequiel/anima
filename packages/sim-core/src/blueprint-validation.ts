import { z } from 'zod';
import type { Result } from '@anima/shared';
import { err, ok } from '@anima/shared';
import type { EntityKind } from './components.js';
import type { Blueprint } from './blueprints.js';
import type { Recipe } from './recipes.js';
import { recipeProduct, recipeProducing } from './recipes.js';
import { PROTECTED_KINDS } from './recipe-validation.js';

/**
 * Cuántos bloques admite un plano. Se junta todo antes de colocar (ADR 0032),
 * así que el tope real es la capacidad del inventario; este es un techo duro
 * por encima de cualquier inventario razonable, para que un plano no sea spam.
 */
export const MAX_BLUEPRINT_BLOCKS = 8;

const blueprintSchema = z
  .object({
    id: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[a-z][a-z0-9-]*$/, 'solo minúsculas, dígitos y guiones'),
    placements: z
      .array(
        z
          .object({
            kind: z
              .string()
              .min(1)
              .max(40)
              .regex(/^[a-z][a-z0-9-]*$/, 'solo minúsculas, dígitos y guiones'),
            offset: z
              .object({ x: z.number().int().min(-1).max(1), y: z.number().int().min(-1).max(1) })
              .strict(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_BLUEPRINT_BLOCKS),
  })
  .strict();

/**
 * La puerta por la que entra un plano inventado (ADR 0032), hermana de
 * `validateRecipe`. No juzga si la obra es linda ni si sirve: juzga si es una
 * obra POSIBLE. Que no invente materia, que no coloque lo que no se puede
 * levantar, que quepa al alcance del brazo.
 *
 * `obtainable` es la materia que el mundo tiene (`obtainableKinds`), y la pasa
 * quien ve el mundo entero — el mundo, en `step.ts`. Igual que con las recetas,
 * la vista previa no la pasa: juzgar con lo que la mascota percibe rechazaría
 * planos por bloques que existen tres celdas más allá.
 *
 * `capacity` es cuántos bloques puede cargar la mascota: la obra se junta ENTERA
 * antes de colocarse (ADR 0032), así que una obra de más bloques de los que le
 * entran en los brazos es inconstruible. Sin este límite, el mundo aceptaba una
 * casa de 7 paredes que ella no podía levantar, y el intento moría sin decir por
 * qué. Es la restricción del MVP hecha regla — mientras no camine mientras
 * construye, la obra vive dentro de su inventario.
 */
export function validateBlueprint(
  raw: unknown,
  existingBlueprints: Blueprint[] = [],
  recipes: Recipe[] = [],
  obtainable?: ReadonlySet<EntityKind>,
  capacity?: number,
): Result<Blueprint> {
  const parsed = blueprintSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      `Plano inválido: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
    );
  }
  const blueprint = parsed.data as Blueprint;

  if (existingBlueprints.some((b) => b.id === blueprint.id)) {
    return err(`Plano inválido: ya existe un plano "${blueprint.id}"`);
  }
  if (existingBlueprints.length >= MAX_BLUEPRINT_BLOCKS) {
    return err('Plano inválido: este mundo ya no admite más planos');
  }
  if (capacity !== undefined && blueprint.placements.length > capacity) {
    return err(
      `Plano inválido: la obra son ${blueprint.placements.length} bloques y solo puedo cargar ${capacity} a la vez`,
    );
  }

  const seen = new Set<string>();
  for (const placement of blueprint.placements) {
    // (0,0) es donde la mascota queda parada: no puede colocar un bloque encima
    // de sí misma, y un sólido ahí la dejaría fuera del mundo.
    if (placement.offset.x === 0 && placement.offset.y === 0) {
      return err('Plano inválido: no puede colocar un bloque en su propio lugar');
    }
    const cell = `${placement.offset.x},${placement.offset.y}`;
    if (seen.has(cell)) {
      return err('Plano inválido: dos bloques no pueden ir en la misma celda');
    }
    seen.add(cell);

    if (PROTECTED_KINDS.has(placement.kind)) {
      return err(`Plano inválido: no se puede colocar "${placement.kind}"`);
    }

    // El bloque tiene que existir en el mundo o poder fabricarse, y tiene que
    // poder levantarse — para colocarlo hay que llevarlo (misma frontera que
    // el árbol de crafteo, ADR 0031).
    const made = recipeProducing(recipes, placement.kind);
    if (made) {
      if (!recipeProduct(made)?.components.portable) {
        return err(
          `Plano inválido: sé hacer "${placement.kind}" pero no puedo levantarlo para colocarlo`,
        );
      }
    } else if (obtainable && !obtainable.has(placement.kind)) {
      return err(`Plano inválido: no sé de dónde sacar "${placement.kind}"`);
    }
  }

  return ok(blueprint);
}
