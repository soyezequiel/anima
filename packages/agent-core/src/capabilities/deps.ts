import type { Blueprint, BlueprintPlacement, Direction, Interaction, Perception } from '@anima/sim-core';
import type { SkillLibrary } from '@anima/skill-runtime';

/**
 * Lo que una capacidad necesita del agente y no puede sacar de la percepción.
 *
 * Vive aparte del agente a propósito: una capacidad recibe hechos y devuelve
 * programa: no lee el estado de la mascota ni lo modifica. Todo lo que aquí se
 * pide es memoria o política del agente —dónde recordaba algo, dónde decidió
 * plantar una obra, qué interacción ya aprendió— servido como funciones puras
 * desde el punto de vista de quien compila.
 *
 * Es el mismo contrato que antes se llamaba `UserRequestProgramDeps`; se mudó
 * acá porque ya no lo usa solo la ruta de peticiones del cuidador.
 */
export interface CapabilityDeps {
  library: SkillLibrary;

  /** Búsqueda de una interacción aprendida aplicable (reuso, ADR 0027). */
  findInteraction(verb: string, targetKind: string, perception: Perception): Interaction | undefined;

  /**
   * Pasos hacia donde recuerda un material que ahora no ve (memoria de
   * lugares, ADR 0025), o undefined si no recuerda nada de ese tipo. Al juntar
   * para construir, un tronco tras un muro es invisible (la vista exige línea
   * despejada) pero recordado: ir a donde lo vio evita el vagar a ciegas.
   */
  rememberedWalk(kind: string): Direction[] | undefined;

  /** Pasos al último lugar recordado de una entidad cuya identidad ya se resolvió. */
  rememberedWalkForEntity(entityId: string): Direction[] | undefined;

  /**
   * De qué tipo cosechar un material que ninguna receta produce ("log" sale de
   * romper un "tree"), o undefined si nada de lo que ve lo deja caer. Sin esto,
   * pedirle una obra cuya materia base se saca del mundo a golpes terminaba en
   * «no hay troncos» con el bosque delante.
   */
  harvestSource(kind: string): string | undefined;

  /**
   * Dónde se planta esta obra y qué le falta (ADR 0049): los pasos hasta el
   * sitio elegido y las celdas que todavía no tienen su bloque. `null` si no
   * hay claro donde levantarla — ahí la obra no arranca en vez de desparramar
   * bloques en celdas ocupadas.
   */
  structureSite(blueprint: Blueprint): { approach: Direction[]; pending: BlueprintPlacement[] } | null;
}
