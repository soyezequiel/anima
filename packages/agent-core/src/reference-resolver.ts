import type { Vec2 } from '@anima/shared';
import { chebyshev, manhattan } from '@anima/shared';
import type { PerceivedEntity, Perception } from '@anima/sim-core';
import type { RememberedPlace } from './place-memory.js';
import type { EntitySelector } from './goals.js';

export interface ReferenceMemoryData {
  lastMentioned: string[];
  lastUsed: string[];
  createdByMe: string[];
}

export type ReferenceResolution =
  | { kind: 'query' }
  | { kind: 'resolved'; entityId: string; evidence: string[] }
  | { kind: 'missing'; reason: string }
  | { kind: 'ambiguous'; candidateIds: string[]; reason: string };

type Candidate = {
  id: string;
  kind: string;
  position?: Vec2;
  visible: boolean;
  held: boolean;
};

function candidates(perception: Perception, remembered: readonly RememberedPlace[]): Candidate[] {
  const byId = new Map<string, Candidate>();
  for (const place of remembered) {
    byId.set(place.entityId, {
      id: place.entityId,
      kind: place.kind,
      position: { ...place.position },
      visible: false,
      held: false,
    });
  }
  for (const entity of perception.visibleEntities) {
    byId.set(entity.id, {
      id: entity.id,
      kind: entity.kind,
      ...(entity.position ? { position: { ...entity.position } } : {}),
      visible: true,
      held: false,
    });
  }
  for (const entity of perception.self.heldItems) {
    byId.set(entity.id, {
      id: entity.id,
      kind: entity.kind,
      visible: true,
      held: true,
    });
  }
  return [...byId.values()];
}

function nearestAnchor(kind: string, perception: Perception): PerceivedEntity | undefined {
  return perception.visibleEntities
    .filter((entity) => entity.kind === kind && entity.position && entity.held !== true)
    .sort(
      (a, b) =>
        manhattan(perception.self.position, a.position!) -
          manhattan(perception.self.position, b.position!) || a.id.localeCompare(b.id),
    )[0];
}

function spatiallyMatches(
  candidate: Candidate,
  selector: EntitySelector,
  perception: Perception,
): boolean {
  if (selector.relation === 'none') return true;
  if (!candidate.position || !selector.anchorKind) return false;
  const anchor = nearestAnchor(selector.anchorKind, perception);
  if (!anchor?.position) return false;
  if (selector.relation === 'left-of') return candidate.position.x < anchor.position.x;
  if (selector.relation === 'right-of') return candidate.position.x > anchor.position.x;
  if (selector.relation === 'near') return chebyshev(candidate.position, anchor.position) <= 2;

  // "Detrás" usa la mirada actual: continuar desde la mascota, atravesando
  // el ancla. Un producto escalar positivo significa que el candidato está
  // más allá en esa misma dirección general.
  const towardAnchor = {
    x: anchor.position.x - perception.self.position.x,
    y: anchor.position.y - perception.self.position.y,
  };
  const beyondAnchor = {
    x: candidate.position.x - anchor.position.x,
    y: candidate.position.y - anchor.position.y,
  };
  return towardAnchor.x * beyondAnchor.x + towardAnchor.y * beyondAnchor.y > 0;
}

function salience(
  candidate: Candidate,
  memory: ReferenceMemoryData,
  perception: Perception,
): number {
  const mentioned = memory.lastMentioned.indexOf(candidate.id);
  const used = memory.lastUsed.indexOf(candidate.id);
  return (
    (mentioned >= 0 ? 100 - mentioned : 0) +
    (used >= 0 ? 60 - used : 0) +
    (candidate.held ? 20 : 0) +
    (candidate.visible ? 10 : 0) -
    (candidate.position ? manhattan(perception.self.position, candidate.position) / 100 : 0)
  );
}

/**
 * El modelo describe; este resolutor decide contra percepción y memoria. Una
 * referencia específica nunca se degrada silenciosamente a "cualquier cosa".
 */
export function resolveEntityReference(
  selector: EntitySelector,
  perception: Perception,
  remembered: readonly RememberedPlace[],
  memory: ReferenceMemoryData,
): ReferenceResolution {
  if (
    selector.definiteness === 'any' &&
    selector.reference === 'none' &&
    selector.relation === 'none'
  ) {
    return { kind: 'query' };
  }

  let matches = candidates(perception, remembered).filter(
    (candidate) => candidate.kind === selector.kind,
  );
  const evidence = [`es ${selector.kind}`];
  if (selector.reference === 'last-mentioned') {
    const allowed = new Set(memory.lastMentioned);
    // Un demostrativo también puede ser deíctico ("esa manzana") aunque no
    // haya conversación previa. Si hay antecedente, manda; si no, la
    // percepción decide por saliencia y conserva la ambigüedad si empata.
    if (allowed.size > 0) {
      matches = matches.filter((candidate) => allowed.has(candidate.id));
      evidence.push('fue el último objeto mencionado');
    } else {
      evidence.push('es el objeto visible señalado por el demostrativo');
    }
  } else if (selector.reference === 'last-used') {
    const allowed = new Set(memory.lastUsed);
    matches = matches.filter((candidate) => allowed.has(candidate.id));
    evidence.push('fue el último objeto manipulado');
  } else if (selector.reference === 'created-by-me') {
    const allowed = new Set(memory.createdByMe);
    matches = matches.filter((candidate) => allowed.has(candidate.id));
    evidence.push('lo creó la mascota');
  } else if (selector.reference === 'other') {
    const excluded = new Set([...memory.lastMentioned.slice(0, 1), ...memory.lastUsed.slice(0, 1)]);
    matches = matches.filter((candidate) => !excluded.has(candidate.id));
    evidence.push('es distinto del objeto anterior');
  }
  if (selector.relation !== 'none') {
    matches = matches.filter((candidate) => spatiallyMatches(candidate, selector, perception));
    evidence.push(`${selector.relation} ${selector.anchorKind ?? ''}`.trim());
  }

  if (matches.length === 0) {
    return {
      kind: 'missing',
      reason: `No encuentro ningún ${selector.kind} que coincida con esa referencia.`,
    };
  }
  const ranked = matches
    .map((candidate) => ({ candidate, score: salience(candidate, memory, perception) }))
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
  if (ranked[1] && Math.abs(ranked[0]!.score - ranked[1].score) < 0.001) {
    return {
      kind: 'ambiguous',
      candidateIds: ranked.map((entry) => entry.candidate.id),
      reason: `Veo más de un ${selector.kind} que coincide; necesito que me indiques cuál.`,
    };
  }
  return { kind: 'resolved', entityId: ranked[0]!.candidate.id, evidence };
}
