import type { Components, EntityKind } from './components.js';

/**
 * Descomposición: la regla del mundo que dice en QUÉ se deshace un objeto al
 * ser destruido — la cuarta puerta de invención, hermana de recetas (ADR 0031)
 * e interacciones (ADR 0027). Nace de un principio simple: la materia no
 * desaparece al romperse, se transforma. Picar un pedernal deja fragmentos;
 * desarmar una silla devuelve sus partes.
 *
 * Para lo crafteado el mundo ya sabe la respuesta y la deriva solo (los
 * ingredientes que costó, guardados como `drops` del producto). Esta puerta es
 * para la MATERIA BASE — un pedernal sembrado, una roca, sin receta de la cual
 * derivar: en qué se deshace lo decide la IA Dios en tiempo de ejecución, y
 * esta regla lo guarda para no volver a preguntarlo.
 *
 * Dato puro: vive en `WorldState.decompositions` y viaja en los snapshots. Una
 * vez aprendida, romper ese tipo deja siempre lo mismo — ni en esta sesión ni
 * en un mundo restaurado hay que inventarlo de nuevo.
 */
export interface Decomposition {
  id: string;
  /** El tipo de objeto que, al romperse, deja lo de abajo. */
  targetKind: EntityKind;
  /**
   * Qué deja, con la misma forma que `drops`: cada entrada es un arquetipo
   * completo, listo para spawn en la celda que queda libre y las de al lado.
   */
  drops: Array<{ kind: EntityKind; components: Components }>;
}

/**
 * La regla de descomposición que el mundo conoce para este tipo, si conoce
 * alguna. Fuente de verdad única: la usa el destructor de `step.ts` para saber
 * qué dejar, y el agente para no re-inventar lo que el mundo ya sabe.
 */
export function decompositionFor(
  decompositions: readonly Decomposition[],
  kind: EntityKind,
): Decomposition | undefined {
  return decompositions.find((d) => d.targetKind === kind);
}
