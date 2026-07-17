import type { Vec2 } from '@anima/shared';
import { manhattan } from '@anima/shared';
import type { Perception } from '@anima/sim-core';

/**
 * Memoria espacial: dónde vio por última vez las cosas que le importan.
 * Se alimenta SOLO de percepciones pasadas — el agente sigue sin recibir el
 * WorldState — así que puede estar desactualizada: el mundo pudo cambiar a sus
 * espaldas, y descubrirlo (ir y no encontrar) es parte de la historia.
 */
export interface RememberedPlace {
  entityId: string;
  kind: string;
  position: Vec2;
  lastSeenTick: number;
  edible?: boolean;
  /** Calor que irradiaba cuando la vio (si era una fuente de calor). */
  warmth?: number;
  portable?: boolean;
}

export interface PlaceMemoryData {
  places: RememberedPlace[];
}

/**
 * Tope pequeño y fijo: la memoria de lugares es un puñado de "ahí había...",
 * no un mapa del mundo. Al superarlo se olvida lo visto hace más tiempo.
 */
export const PLACE_MEMORY_CAP = 24;

export class PlaceMemory {
  private places: RememberedPlace[] = [];

  serialize(): PlaceMemoryData {
    return structuredClone({ places: this.places });
  }

  loadFrom(data: PlaceMemoryData): void {
    this.places = structuredClone(data.places);
  }

  /**
   * Registra lo que la percepción actual muestra: comestibles, fuentes de
   * calor y materiales sueltos. Lo que lleva encima deja de estar en un lugar.
   */
  update(perception: Perception): void {
    for (const entity of perception.visibleEntities) {
      const cares =
        entity.edible === true || entity.warmth !== undefined || entity.portable === true;
      if (!cares || !entity.position) continue;
      const entry: RememberedPlace = {
        entityId: entity.id,
        kind: entity.kind,
        position: { ...entity.position },
        lastSeenTick: perception.tick,
        ...(entity.edible !== undefined ? { edible: entity.edible } : {}),
        ...(entity.warmth !== undefined ? { warmth: entity.warmth } : {}),
        ...(entity.portable !== undefined ? { portable: entity.portable } : {}),
      };
      const index = this.places.findIndex((p) => p.entityId === entity.id);
      if (index >= 0) this.places[index] = entry;
      else this.places.push(entry);
    }
    for (const held of perception.self.heldItems) {
      this.forget(held.id);
    }
    if (this.places.length > PLACE_MEMORY_CAP) {
      this.places.sort(
        (a, b) =>
          b.lastSeenTick - a.lastSeenTick ||
          Number(a.entityId.slice(1)) - Number(b.entityId.slice(1)),
      );
      this.places.length = PLACE_MEMORY_CAP;
    }
  }

  /** Fue al lugar y no estaba: el recuerdo era mentira y se descarta. */
  forget(entityId: string): void {
    this.places = this.places.filter((p) => p.entityId !== entityId);
  }

  /**
   * Lugares recordados que la percepción actual NO confirma (si algo se ve
   * ahora mismo, no hace falta recordarlo: se persigue con la vista). Orden
   * determinista: el más cercano primero, luego el visto más recientemente.
   */
  recall(
    filter: { edible?: boolean; warm?: boolean; kind?: string },
    perception: Perception,
  ): RememberedPlace[] {
    const visibleNow = new Set(perception.visibleEntities.map((e) => e.id));
    const selfPos = perception.self.position;
    return this.places
      .filter((p) => !visibleNow.has(p.entityId))
      .filter(
        (p) =>
          (filter.edible === undefined || p.edible === filter.edible) &&
          (filter.warm === undefined || (p.warmth !== undefined) === filter.warm) &&
          (filter.kind === undefined || p.kind === filter.kind),
      )
      .sort(
        (a, b) =>
          manhattan(selfPos, a.position) - manhattan(selfPos, b.position) ||
          b.lastSeenTick - a.lastSeenTick ||
          Number(a.entityId.slice(1)) - Number(b.entityId.slice(1)),
      );
  }

  all(): RememberedPlace[] {
    return [...this.places];
  }
}
