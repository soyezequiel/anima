import { z } from 'zod';
import type { Result } from '@anima/shared';
import { err, ok } from '@anima/shared';
import type { Interaction } from './interactions.js';
import { INVENTED_COMPONENT_BOUNDS, PROTECTED_KINDS } from './recipe-validation.js';

/**
 * La puerta por la que entra una interacción inventada. Es a las interacciones
 * lo que `validateRecipe` es a las recetas: lo que propone un modelo es tan
 * poco confiable como cualquier dato externo, y aquí no se juzga si la
 * interacción tiene SENTIDO (eso es del juez semántico, la IA Dios del ADR
 * 0027) sino si es *posible dentro de la física*: que no cree materia, ni
 * toque cuerpos, ni fabrique lo protegido con otro verbo.
 *
 * Dos puertas, dos naturalezas: esta es determinista y nadie puede saltarla
 * (step.ts la vuelve a aplicar al proponer); la del Dios es de coherencia y
 * vive en el agente. Un "llevar agua en las manos" puede pasar por aquí — es
 * físicamente expresable — y morir con razón en la otra.
 */

/**
 * Cuántas interacciones admite un mundo EN TOTAL. Inventar no puede ser spam,
 * y cada una es permanente: viaja en los snapshots.
 */
export const MAX_INTERACTIONS = 16;

const kebab = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[a-z][a-z0-9-]*$/, 'solo minúsculas, dígitos y guiones');

/**
 * Sin `drops`, a propósito: una transformación es 1→1 y no puede dejar deuda
 * de materia para cobrar al romperse. Lo demás son las mismas cotas que rigen
 * lo que una receta produce — el techo de lo inventable es uno solo.
 */
const transformComponentsSchema = z.object(INVENTED_COMPONENT_BOUNDS).strict();

const effectSchema = z
  .object({
    type: z.enum(['transform-target', 'transform-held']),
    kind: kebab(2, 40).optional(),
    components: transformComponentsSchema,
  })
  .strict()
  // Sin tipo nuevo y sin componentes, la transformación no transforma nada.
  .refine((e) => e.kind !== undefined || Object.keys(e.components).length > 0, {
    message: 'una transformación sin kind ni componentes no hace nada',
  });

const interactionSchema = z
  .object({
    id: kebab(2, 40),
    description: z.string().min(3).max(140),
    stance: z.enum(['beside', 'on-top', 'underneath', 'held']),
    target: z
      .object({
        kind: z.string().min(1).max(40).optional(),
        wet: z.boolean().optional(),
        solid: z.boolean().optional(),
        portable: z.boolean().optional(),
        warm: z.boolean().optional(),
        shelter: z.boolean().optional(),
      })
      .strict()
      .refine((t) => Object.keys(t).length > 0, {
        message: 'el objetivo no dice a qué se aplica',
      }),
    requires: z.object({ heldKind: z.string().min(1).max(40) }).strict().optional(),
    effects: z.array(effectSchema).max(2),
  })
  .strict();

export function validateInteraction(
  raw: unknown,
  existing: Interaction[] = [],
): Result<Interaction> {
  const parsed = interactionSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      `Interacción inválida: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
    );
  }
  const proposal = parsed.data as Interaction;

  if (existing.some((i) => i.id === proposal.id)) {
    return err(`Interacción inválida: ya existe una interacción "${proposal.id}"`);
  }
  if (existing.length >= MAX_INTERACTIONS) {
    return err('Interacción inválida: este mundo ya no admite más interacciones');
  }

  // La mascota no es un objeto: nada interactúa con ella por esta vía.
  if (proposal.target.kind === 'pet') {
    return err('Interacción inválida: la mascota no es un objetivo');
  }

  // Sin efectos, la interacción solo tiene sentido si ES una postura: estar
  // encima o debajo de algo ya es un hecho del mundo. Al lado o en la mano,
  // sin efecto, no pasa absolutamente nada.
  if (
    proposal.effects.length === 0 &&
    proposal.stance !== 'on-top' &&
    proposal.stance !== 'underneath'
  ) {
    return err('Interacción inválida: sin efectos ni postura, no haría absolutamente nada');
  }

  // Sobre el agua no hay postura que valga: `resolveInteract` rechaza
  // `on-top`/`underneath` contra el agua con `target-not-mountable`, siempre.
  // Admitir acá una regla que el mundo nunca va a poder ejecutar es guardar una
  // promesa rota: se aprende, se celebra, y falla la primera vez que se usa.
  // Una puerta que acepta lo inejecutable es tan defectuosa como una que
  // rechaza lo posible.
  if (
    proposal.target.wet === true &&
    (proposal.stance === 'on-top' || proposal.stance === 'underneath')
  ) {
    return err('Interacción inválida: sobre el agua no hay dónde pararse ni dónde meterse');
  }

  for (const effect of proposal.effects) {
    if (effect.kind !== undefined && PROTECTED_KINDS.has(effect.kind)) {
      return err(`Interacción inválida: nada puede transformarse en "${effect.kind}"`);
    }
    if (effect.type === 'transform-held' && proposal.requires === undefined) {
      return err(
        'Interacción inválida: transformar lo que lleva exige declarar qué lleva (requires.heldKind)',
      );
    }
  }

  return ok(structuredClone(proposal));
}
