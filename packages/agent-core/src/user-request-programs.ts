import { countedKindLabel, kindLabel, kindWithArticle } from '@anima/shared';
import type { CapabilityDeps } from './capabilities/deps.js';
import type { GoalUserRequest } from './goals.js';

/**
 * Las frases con las que se anuncia un encargo cumplido.
 *
 * Lo que este módulo hacía —un `switch` de doscientas líneas que escribía
 * operaciones de la DSL a mano para cada forma de petición— vive ahora en el
 * registro de capacidades y su planificador: los mismos pasos, pero cada uno
 * con su expectativa y su forma de comprobarse contra el mundo. Acá queda lo
 * único que era de verdad de esta capa: cómo se dice en voz alta que algo se
 * hizo.
 *
 * El puente `programForUserRequest` se fue con el `switch`. Existía para que
 * quien esperara un `SkillProgram` suelto lo siguiera recibiendo, y ya no queda
 * nadie: las escaladas —fabricar una herramienta y volver al encargo— se
 * expresan anteponiendo un paso al plan, que además se verifica.
 */

/** El nombre viejo del contrato de dependencias; se mudó a `capabilities`. */
export type UserRequestProgramDeps = CapabilityDeps;

export function completionReply(request: GoalUserRequest): string {
  // El nombre sale del vocabulario compartido: "recogí el tronco", nunca
  // "recogí eso" para un objeto con nombre conocido.
  const name = request.targetKind ? kindLabel(request.targetKind) : 'eso';
  const target = request.targetKind ? `${/a$/.test(name) ? 'la' : 'el'} ${name}` : 'eso';
  switch (request.kind) {
    case 'wait-here':
      return 'Listo, esperé aquí un momento.';
    case 'run-skill':
      return `Listo, hice "${request.skillName ?? 'eso'}".`;
    case 'craft-item':
      // Sin género: lo construido puede ser "la silla" o "el brasero" que
      // Ánima inventó, y acá solo hay un recipeId para adivinar.
      return 'Listo, ya está en su lugar.';
    case 'move-direction': {
      const labels = {
        up: 'hacia arriba',
        down: 'hacia abajo',
        left: 'a la izquierda',
        right: 'a la derecha',
      } as const;
      const destination = (request.directions ?? [])
        .map((direction) => labels[direction])
        .join(' y ');
      return `Listo, me moví ${destination}.`;
    }
    case 'spatial-relation':
      return request.relation === 'opposite-side'
        ? `Listo, crucé al otro lado de ${name}.`
        : request.relation === 'near'
          ? `Listo, me acerqué a ${name}.`
          : `Listo, me alejé de ${name}.`;
    case 'fetch-item': {
      const amount = request.amount ?? 1;
      return amount > 1 && request.targetKind
        ? `Listo, junté ${countedKindLabel(request.targetKind, amount)}.`
        : `Listo, recogí ${target}.`;
    }
    case 'consume-item':
      return `Listo, comí ${target}.`;
    case 'destroy-entity':
      return `Listo, destruí ${target}.`;
    case 'place-item':
      return request.placement === 'near'
        ? `Listo, dejé ${request.targetKind ?? 'eso'} junto a ${request.onKind ?? 'ahí'}.`
        : `Listo, dejé ${request.targetKind ?? 'eso'} sobre ${request.onKind ?? 'ahí'}.`;

    case 'interact-entity': {
      const verbPhrase = (request.verb ?? 'hacer eso').replace(/-/g, ' ');
      return request.targetKind
        ? `Listo: ${verbPhrase} con ${kindWithArticle(request.targetKind)}, hecho.`
        : 'Listo, ya está.';
    }
  }
}
