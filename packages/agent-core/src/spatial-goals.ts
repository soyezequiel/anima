import type { Vec2 } from '@anima/shared';
import { chebyshev, manhattan } from '@anima/shared';
import { groundKey, perceivedGround, type PerceivedEntity, type Perception } from '@anima/sim-core';
import type { SkillProgram } from '@anima/skill-runtime';
import type { SpatialGrounding, SpatialRelation } from './goals.js';

export interface SpatialRequestLike {
  relation: SpatialRelation;
  targetKind: string;
}

export type SpatialGroundingResult =
  { ok: true; grounding: SpatialGrounding } | { ok: false; reason: string };

/** Componentes contiguos: dos paredes separadas no forman una sola referencia. */
function components(entities: PerceivedEntity[]): PerceivedEntity[][] {
  const pending = new Set(entities.map((entity) => entity.id));
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const result: PerceivedEntity[][] = [];
  while (pending.size > 0) {
    const firstId = pending.values().next().value as string;
    pending.delete(firstId);
    const group: PerceivedEntity[] = [byId.get(firstId)!];
    for (let index = 0; index < group.length; index++) {
      const current = group[index]!.position!;
      for (const candidateId of [...pending]) {
        const candidate = byId.get(candidateId)!;
        // Una abertura de una celda no parte conceptualmente una barrera en
        // dos: es precisamente el paso por el que se la puede cruzar.
        if (candidate.position && chebyshev(current, candidate.position) <= 2) {
          pending.delete(candidateId);
          group.push(candidate);
        }
      }
    }
    result.push(group);
  }
  return result;
}

function insideBounds(pos: Vec2, perception: Perception): boolean {
  const bounds = perception.bounds;
  return !bounds || (pos.x >= 0 && pos.y >= 0 && pos.x < bounds.width && pos.y < bounds.height);
}

function free(pos: Vec2, perception: Perception): boolean {
  if (!insideBounds(pos, perception)) return false;
  const ground = perceivedGround(perception.visibleEntities);
  const key = groundKey(pos);
  return !ground.blocked.has(key) && !ground.water.has(key);
}

function nearest(candidates: Vec2[], from: Vec2): Vec2 | undefined {
  return [...candidates].sort(
    (a, b) => manhattan(from, a) - manhattan(from, b) || a.y - b.y || a.x - b.x,
  )[0];
}

function referencesFor(kind: string, perception: Perception): PerceivedEntity[][] {
  const visible = perception.visibleEntities.filter(
    (entity) => entity.kind === kind && entity.held !== true && entity.position !== undefined,
  );
  const distance = (group: PerceivedEntity[]) =>
    Math.min(...group.map((entity) => manhattan(perception.self.position, entity.position!)));
  return components(visible).sort(
    (a, b) => distance(a) - distance(b) || a[0]!.id.localeCompare(b[0]!.id),
  );
}

/**
 * Traduce una relación semántica a geometría concreta, usando solamente lo
 * que la mascota percibe. No consulta al modelo y no conoce tipos especiales:
 * una pared, un río o una fila de árboles se resuelven con la misma forma.
 */
export function groundSpatialRequest(
  request: SpatialRequestLike,
  perception: Perception,
): SpatialGroundingResult {
  const references = referencesFor(request.targetKind, perception);
  const reference = references[0];
  if (!reference) {
    return { ok: false, reason: `No veo ${request.targetKind} para ubicar el pedido.` };
  }
  const distance = (group: PerceivedEntity[]) =>
    Math.min(...group.map((entity) => manhattan(perception.self.position, entity.position!)));
  if (references[1] && distance(reference) === distance(references[1])) {
    return {
      ok: false,
      reason: `Veo más de un ${request.targetKind} igual de cerca; necesito que me indiques cuál.`,
    };
  }
  const positions = reference.map((entity) => ({ ...entity.position! }));
  const common = {
    relation: request.relation,
    referenceKind: request.targetKind,
    referenceEntityIds: reference.map((entity) => entity.id),
    referencePositions: positions,
  };
  const self = perception.self.position;

  if (request.relation === 'near') {
    const alreadyNear = Math.min(...positions.map((position) => chebyshev(self, position))) <= 1;
    const candidates = positions.flatMap((position) => [
      { x: position.x + 1, y: position.y },
      { x: position.x - 1, y: position.y },
      { x: position.x, y: position.y + 1 },
      { x: position.x, y: position.y - 1 },
    ]);
    const destination = alreadyNear
      ? { ...self }
      : nearest(
          candidates.filter((p) => free(p, perception)),
          self,
        );
    return destination
      ? { ok: true, grounding: { ...common, destination } }
      : { ok: false, reason: `No encuentro un lugar libre cerca de ${request.targetKind}.` };
  }

  if (request.relation === 'far-from') {
    const startDistance = Math.min(...positions.map((position) => manhattan(self, position)));
    const desiredDistance = startDistance + 3;
    const bounds = perception.bounds;
    if (!bounds) return { ok: false, reason: 'Todavía no conozco los bordes del mundo.' };
    const candidates: Vec2[] = [];
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        const candidate = { x, y };
        if (free(candidate, perception)) candidates.push(candidate);
      }
    }
    const destination = candidates.sort((a, b) => {
      const distance = (cell: Vec2) =>
        Math.min(...positions.map((position) => manhattan(cell, position)));
      return distance(b) - distance(a) || manhattan(self, a) - manhattan(self, b);
    })[0];
    const destinationDistance = destination
      ? Math.min(...positions.map((position) => manhattan(destination, position)))
      : 0;
    const minimumDistance = Math.min(desiredDistance, destinationDistance);
    return destination
      ? { ok: true, grounding: { ...common, destination, minimumDistance } }
      : { ok: false, reason: `No encuentro adónde alejarme de ${request.targetKind}.` };
  }

  const xs = positions.map((position) => position.x);
  const ys = positions.map((position) => position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const axis: 'x' | 'y' =
    spanY > spanX
      ? 'x'
      : spanX > spanY
        ? 'y'
        : Math.abs(self.x - centerX) >= Math.abs(self.y - centerY)
          ? 'x'
          : 'y';
  const origin = axis === 'x' ? centerX : centerY;
  const coordinate = axis === 'x' ? self.x : self.y;
  if (coordinate === origin) {
    return {
      ok: false,
      reason: `Estoy alineada con ${request.targetKind}; no distingo qué lado querés cruzar.`,
    };
  }
  const startingSide: -1 | 1 = coordinate < origin ? -1 : 1;
  const oppositeCoordinate =
    axis === 'x'
      ? startingSide < 0
        ? maxX + 1
        : minX - 1
      : startingSide < 0
        ? maxY + 1
        : minY - 1;
  const along = axis === 'x' ? positions.map((p) => p.y) : positions.map((p) => p.x);
  const candidates = [...new Set(along)].map((value) =>
    axis === 'x' ? { x: oppositeCoordinate, y: value } : { x: value, y: oppositeCoordinate },
  );
  const destination = nearest(
    candidates.filter((candidate) => free(candidate, perception)),
    self,
  );
  return destination
    ? {
        ok: true,
        grounding: { ...common, destination, axis, origin, startingSide },
      }
    : { ok: false, reason: `No encuentro suelo libre del otro lado de ${request.targetKind}.` };
}

/** El mundo, no el programa, decide si el pedido espacial terminó. */
export function spatialGoalSatisfied(grounding: SpatialGrounding, position: Vec2): boolean {
  if (grounding.relation === 'near') {
    return Math.min(...grounding.referencePositions.map((ref) => chebyshev(position, ref))) <= 1;
  }
  if (grounding.relation === 'far-from') {
    return (
      Math.min(...grounding.referencePositions.map((ref) => manhattan(position, ref))) >=
      (grounding.minimumDistance ?? Infinity)
    );
  }
  if (!grounding.axis || grounding.origin === undefined || grounding.startingSide === undefined) {
    return false;
  }
  const coordinate = grounding.axis === 'x' ? position.x : position.y;
  const side = coordinate < grounding.origin ? -1 : coordinate > grounding.origin ? 1 : 0;
  return side !== 0 && side === -grounding.startingSide;
}

export function spatialRequestProgram(grounding: SpatialGrounding): SkillProgram {
  return [
    { op: 'moveTo', position: { ...grounding.destination }, maxSteps: 50 },
    {
      op: 'branch',
      if: { type: 'lastMoveBlocked' },
      then: [{ op: 'abort', reason: 'camino-bloqueado' }],
    },
  ];
}
