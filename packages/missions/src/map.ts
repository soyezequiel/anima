import type { EntityId, WorldState } from '@anima/sim-core';
import type { Objective, Zone } from './objectives.js';

/**
 * Un mapa jugable con su misión. La misión NO es un guion: es un enunciado
 * para la mascota y un conjunto de condiciones que el mundo sabe medir. Entre
 * las dos cosas no hay nada — ni una solución prevista, ni un tipo de objeto
 * esperado, ni una receta reservada. Cómo se resuelve es asunto de Ánima.
 */
export interface Mission {
  id: string;
  name: string;
  /**
   * Lo que el cuidador le dice a la mascota al empezar, con sus palabras. Entra
   * por el chat normal (`receiveUserMessage`): no hay canal privilegiado que le
   * meta el objetivo en la cabeza.
   */
  briefing: string;
  /** Para el informe humano: qué capacidad pone a prueba este mapa. */
  tests: string[];
  zones: Zone[];
  objectives: Objective[];
}

export interface MapBundle {
  world: WorldState;
  petId: EntityId;
  meta: { name: string; seed: number };
}

export interface GameMap {
  id: string;
  name: string;
  /** Dificultad relativa dentro de la serie: 1 es el primero. */
  order: number;
  mission: Mission;
  build(seed: number): MapBundle;
}
