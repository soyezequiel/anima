import { z } from 'zod';
import type { Result } from '@anima/shared';
import { err, ok } from '@anima/shared';
import type { Components, EntityKind } from './components.js';
import type { Recipe, RecipeIngredient, RecipeOutcome } from './recipes.js';
import { expandRecipeCost, recipeProduct, recipeProducing } from './recipes.js';

/**
 * Lo que la mascota propone: un arquetipo único — su idea de QUÉ quiere
 * construir. Que no tenga desenlaces no es un olvido: con qué fidelidad le sale
 * lo decide el mundo del otro lado de esta puerta. Entra una propuesta y sale
 * una `Recipe`, y esa asimetría es el punto.
 */
export interface RecipeProposal {
  id: string;
  output: { kind: EntityKind; components: Components };
  ingredients: RecipeIngredient[];
}

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

/**
 * Cuántas recetas admite un mundo EN TOTAL (las de fábrica cuentan: con 4 del
 * MVP quedan 8 inventables). Inventar no puede ser spam.
 */
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
/**
 * Las cotas de lo inventable, compartidas entre las dos puertas: lo que una
 * receta puede producir y aquello en lo que una interacción puede transformar
 * un objeto son EL MISMO techo. Si vivieran en dos tablas, tarde o temprano
 * divergerían y una de las dos sería la rendija.
 */
export const INVENTED_COMPONENT_BOUNDS = {
  collider: z.object({ solid: z.boolean() }).strict().optional(),
  portable: z.object({}).strict().optional(),
  /**
   * Ofrece dónde pisar. Sin cota que poner: se tiene o no se tiene, como
   * `portable`. Es lo que permite que una idea cambie por dónde se camina —
   * la puerta la admite igual que a las demás, y la IA Dios sigue juzgando si
   * tiene sentido que ESA cosa lo ofrezca.
   */
  footing: z.object({}).strict().optional(),
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
};

const outputComponentsSchema = z
  .object({
    ...INVENTED_COMPONENT_BOUNDS,
    drops: z
      .array(
        z
          .object({
            kind: z.string().min(1).max(40),
            components: z
              .object({
                portable: z.object({}).strict().optional(),
                footing: z.object({}).strict().optional(),
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
 * del que depende. Inventar "food" con otro nombre es el mismo agujero. Se
 * exporta porque las interacciones tampoco pueden transformar nada EN esto.
 */
export const PROTECTED_KINDS = new Set(['pet', 'food', 'tree']);

/**
 * Cómo le sale a la mascota lo que inventó. La receta que propone dice QUÉ
 * quiere construir; con qué fidelidad le sale lo decide el mundo, y el reparto
 * no es un detalle: un peso es infalsificable. Esta puerta puede comprobar que
 * una idea no crea materia, pero no puede comprobar que "sale bien 9 de cada
 * 10" — así que dejarle declarar sus propios pesos sería dejarla inventarse la
 * suerte, la versión probabilística de aprobarse su propio examen.
 *
 * Una idea nueva sale peor que las recetas que el mundo ya traía: el arquetipo
 * que propuso —ya limitado por las cotas del esquema— es el TECHO, no el
 * promedio. Y como ningún desenlace escala por encima de 1, lo que el esquema
 * topea sigue topeado DESPUÉS de la tirada: la calidad no es una rendija por
 * donde colar una antorcha que caliente más que el máximo del mundo.
 */
function inventedOutcomes(output: {
  kind: EntityKind;
  components: Components;
}): RecipeOutcome[] {
  return [
    { weight: 6, output: structuredClone(output), quality: { min: 0.8, max: 1 } },
    { weight: 3, output: structuredClone(output), quality: { min: 0.5, max: 0.75 } },
    // Sin `spares`: estrenar una idea propia cuesta el material. Que el mundo
    // perdone un ingrediente al fallar es un gesto que se ganaron las recetas
    // que ya existían, no la que se acaba de ocurrir.
    { weight: 1 },
  ];
}

/**
 * Valida una receta propuesta. `obtainable` es la MATERIA que el mundo tiene
 * (`obtainableKinds`): sin ella la puerta no puede saber si la idea toca el
 * suelo (ADR 0031).
 *
 * La pasa `step.ts`, que es quien tiene el mundo entero delante. NO la pasa la
 * vista previa del ADR 0024, y eso es a propósito: el agente solo ve lo que
 * percibe, así que juzgar con SU lista rechazaría ideas por materiales que
 * existen tres celdas más allá — y decirle al cuidador «mi mundo no lo acepta»
 * cuando sí lo acepta es exactamente la clase de mentira que el ADR 0022 vino
 * a sacar del prompt. La vista previa filtra lo que puede; la última palabra la
 * tiene el mundo, y no hay camino a `world.recipes` que no pase por acá.
 */
export function validateRecipe(
  raw: unknown,
  existing: Recipe[] = [],
  obtainable?: ReadonlySet<EntityKind>,
): Result<Recipe> {
  const parsed = recipeSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      `Receta inválida: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
    );
  }
  const proposal = parsed.data as RecipeProposal;

  if (PROTECTED_KINDS.has(proposal.output.kind)) {
    return err(`Receta inválida: no se puede fabricar "${proposal.output.kind}"`);
  }
  if (existing.some((r) => r.id === proposal.id)) {
    return err(`Receta inválida: ya existe una receta "${proposal.id}"`);
  }
  if (existing.length >= MAX_INVENTED_RECIPES) {
    return err(`Receta inválida: este mundo ya no admite más recetas`);
  }
  // Una cosa se hace de una sola manera. No es una verdad del universo: es lo
  // que hace que el árbol de crafteo (ADR 0031) tenga UNA lectura. Con dos
  // recetas de tabla, "de qué está hecha una tabla" tendría dos respuestas y
  // el costo de una casa dependería de cuál mirara cada quien — y un ciclo
  // podría esconderse detrás de la que nadie mira.
  const twin = existing.find((r) => recipeProduct(r)?.kind === proposal.output.kind);
  if (twin) {
    return err(
      `Receta inválida: ya sé hacer "${proposal.output.kind}" con la receta "${twin.id}"`,
    );
  }

  // Sin componentes, lo construido sería decoración inerte: existe y no hace
  // nada. Un objeto es lo que sus componentes le permiten hacer.
  if (Object.keys(proposal.output.components).length === 0) {
    return err('Receta inválida: lo construido no haría absolutamente nada');
  }

  const ingredientKinds = new Set(proposal.ingredients.map((i) => i.kind));

  // Convertir algo en más de sí mismo es duplicar materia.
  if (ingredientKinds.has(proposal.output.kind)) {
    return err(
      `Receta inválida: "${proposal.output.kind}" no puede ser ingrediente de sí mismo`,
    );
  }

  // Lo que deja al romperse no puede superar lo que costó: si no, construir y
  // romper en bucle fabrica materia de la nada.
  const totalIngredients = proposal.ingredients.reduce((sum, i) => sum + i.count, 0);
  const drops = proposal.output.components.drops ?? [];
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

  // El árbol tiene que tocar el suelo (ADR 0031): cada ingrediente es materia
  // que el mundo tiene, o el producto de una receta que ya existe. Sin esto la
  // puerta admitía "casa = 8 paredes" en un mundo donde nada hace paredes: una
  // receta muerta, imposible de construir para siempre, que encima le habría
  // hecho creer a la mascota que ya sabía hacer una casa.
  //
  // Que la materia base salga de un `drops` o de un `itemSource` y no esté hoy
  // en el suelo no es asunto de esta puerta: eso es tener que ir a buscarla,
  // no es no poder. La puerta juzga si la idea es posible, no si es cómoda.
  for (const ingredient of proposal.ingredients) {
    const made = recipeProducing(existing, ingredient.kind);
    if (!made) {
      if (obtainable && !obtainable.has(ingredient.kind)) {
        return err(`Receta inválida: no sé de dónde sacar "${ingredient.kind}"`);
      }
      continue;
    }
    // Construir deja lo hecho en el suelo y los ingredientes salen del
    // inventario: una pieza que no se puede levantar no puede ser parte de
    // nada, por más que exista la receta que la hace. Es la misma frontera que
    // encontró el ADR 0031 al derivar el costo — lo que no entra en las manos
    // no se ensambla, se levanta en el suelo, y eso todavía no existe.
    if (!recipeProduct(made)?.components.portable) {
      return err(
        `Receta inválida: sé hacer "${ingredient.kind}" pero no puedo levantarlo para usarlo como ingrediente`,
      );
    }
  }

  // Todo desenlace se construye a partir del arquetipo que acaba de pasar por
  // aquí, así que lo validado vale para los tres: no hay forma de que salga de
  // esta puerta un desenlace que la puerta no haya visto.
  const candidate: Recipe = {
    id: proposal.id,
    outcomes: inventedOutcomes(proposal.output),
    ingredients: proposal.ingredients,
  };

  // Con la receta nueva puesta, seguirla hasta abajo tiene que terminar en
  // materia base. Si no termina, gira: "la tabla se hace del tronco y el tronco
  // de la tabla" es alcanzable por ingredientes que la comprobación de arriba
  // acepta uno por uno (cada uno existe), y solo se ve mirando el árbol entero.
  const cost = expandRecipeCost(candidate, [...existing, candidate]);
  if (cost.truncated) {
    return err(
      `Receta inválida: "${proposal.id}" no baja hasta materia que exista — ` +
        `se hace de algo que se hace de ella, o tiene demasiadas capas`,
    );
  }

  return ok(candidate);
}
