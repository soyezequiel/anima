export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function addVec2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function equalsVec2(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Distancia Manhattan: pasos mínimos en una grilla de 4 direcciones. */
export function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Distancia Chebyshev: usada para adyacencia de interacción (incluye diagonales). */
export function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isAdjacent(a: Vec2, b: Vec2): boolean {
  return chebyshev(a, b) <= 1;
}
