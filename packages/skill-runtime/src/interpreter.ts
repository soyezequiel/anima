import { chebyshev, isAdjacent } from '@anima/shared';
import type { Vec2 } from '@anima/shared';
import type { ActionIntent, Direction, Perception, PerceivedEntity, SimEvent } from '@anima/sim-core';
import { missingIngredients } from '@anima/sim-core';
import type { EntityQuery, SkillCondition, SkillOp, SkillProgram } from './dsl.js';
import type { SkillLibrary } from './skill.js';

export interface RuntimeLimits {
  /** Operaciones puras (sin tick) permitidas dentro de un mismo tick. */
  maxPureOpsPerTick: number;
  /** Operaciones puras totales de toda la ejecución. */
  maxTotalPureOps: number;
  /** Acciones (ticks de mundo) totales que la skill puede emitir. */
  maxIntents: number;
  /** Profundidad máxima de llamadas runSkill. */
  maxCallDepth: number;
}

export const DEFAULT_RUNTIME_LIMITS: RuntimeLimits = {
  maxPureOpsPerTick: 200,
  maxTotalPureOps: 5000,
  maxIntents: 300,
  maxCallDepth: 3,
};

export type SkillOutcome = 'completed' | 'aborted' | 'limit-exceeded';

export interface SkillExecutionResult {
  outcome: SkillOutcome;
  reason?: string;
  intentsEmitted: number;
  pureOpsExecuted: number;
}

export type SkillStepOutput =
  | { kind: 'intent'; intent: ActionIntent }
  | { kind: 'done'; result: SkillExecutionResult };

type VarValue = PerceivedEntity | PerceivedEntity[];

interface Frame {
  ops: SkillOp[];
  index: number;
  callDepth: number;
  repeat?: { max: number; done: number; until?: SkillCondition };
}

interface MoveState {
  targetVar: string;
  maxSteps: number;
  stepsTaken: number;
  /** Distancia Chebyshev a la que darse por llegada. */
  stopAtDistance: number;
  /** Celda destino del paso pendiente de resolver, para aprenderla si falla. */
  pendingDest?: string;
}

interface ExploreState {
  maxSteps: number;
  stepsTaken: number;
  until?: SkillCondition;
  /** Celda destino del paso pendiente de resolver, para aprenderla si falla. */
  pendingDest?: string;
}

/**
 * Lo que la mascota aprendió del espacio con el cuerpo: por dónde ya pasó y
 * qué celdas el mundo le rechazó (bordes, sólidos fuera de la vista). No es un
 * mapa del mundo — solo huellas y golpes — y por eso puede quedar vieja: un
 * muro roto se re-aprende al verlo despejado (`reconcile`). El agente comparte
 * UNA instancia entre todas sus ejecuciones para que buscar hoy aproveche lo
 * caminado ayer; sin instancia compartida, cada ejecución estrena la suya.
 */
export class SpatialMemory {
  /** Cuántas veces pisó cada celda: guía del "menos visitado" de `explore`. */
  readonly visits = new Map<string, number>();
  /** Celdas que el mundo rechazó al intentar pisarlas. */
  readonly blocked = new Set<string>();
  /**
   * Celdas donde alguna vez VIO un sólido o agua. Sin esto, planificar solo
   * con lo visible AHORA oscila: un muro que se oculta detrás de otro muro
   * (línea de visión) aparece y desaparece según desde dónde se mire, y el
   * plan optimista rebota entre dos celdas para siempre. Lo visto se recuerda.
   */
  readonly solids = new Set<string>();

  /**
   * Incorpora la percepción actual: memoriza los sólidos a la vista y olvida
   * lo que la cercanía desmiente — celdas a radio 2 donde ya no se ve ningún
   * sólido ni agua (un muro roto, un bloqueo que era mentira). Desmentir
   * exige VERLA despejada: una celda oculta detrás de otro muro no se olvida,
   * solo está tapada. Los bordes del mapa no se desmienten nunca.
   */
  observe(perception: Perception): void {
    const selfPos = perception.self.position;
    const bounds = perception.bounds;
    const seenSolid = new Set<string>();
    const occluders = new Set<string>();
    for (const e of perception.visibleEntities) {
      if (!e.position) continue;
      const key = `${e.position.x},${e.position.y}`;
      if (e.solid || e.wet) {
        this.solids.add(key);
        seenSolid.add(key);
      }
      // Solo lo sólido tapa la vista (el agua se ve a través, como en el mundo).
      if (e.solid) occluders.add(key);
    }
    for (const set of [this.blocked, this.solids]) {
      for (const key of set) {
        if (seenSolid.has(key)) continue;
        const [x, y] = key.split(',').map(Number) as [number, number];
        if (bounds && (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height)) continue;
        if (chebyshev(selfPos, { x, y }) > 2) continue;
        if (!lineClear(selfPos, { x, y }, occluders)) continue;
        set.delete(key);
      }
    }
  }
}

type LastMove = 'none' | 'reached' | 'blocked' | 'exhausted' | 'lost';

const STEP_DELTAS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Orden fijo para desempates: movimiento y exploración son deterministas. */
const EXPLORE_ORDER: Direction[] = ['right', 'down', 'left', 'up'];

/**
 * Línea de Bresenham: true si ninguna celda INTERMEDIA está en `occluders`.
 * El mismo trazo que usa el mundo para la vista (perception.ts), aplicado aquí
 * a lo que la mascota percibe: le dice si de verdad VE una celda o si algo se
 * la tapa — la diferencia entre "está despejada" y "no sé".
 */
function lineClear(from: Vec2, to: Vec2, occluders: ReadonlySet<string>): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = -Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x === to.x && y === to.y) return true;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    if (x === to.x && y === to.y) return true;
    if (occluders.has(`${x},${y}`)) return false;
  }
}

/** true si la entidad percibida cumple la query (el mismo filtro de findEntities). */
function matchesQuery(e: PerceivedEntity, query: EntityQuery): boolean {
  if (query.kind !== undefined && e.kind !== query.kind) return false;
  if (query.tool !== undefined && (e.toolPower !== undefined) !== query.tool) return false;
  if (query.edible !== undefined && (e.edible ?? false) !== query.edible) return false;
  if (query.portable !== undefined && (e.portable ?? false) !== query.portable) return false;
  if (query.held !== undefined && (e.held ?? false) !== query.held) return false;
  if (query.warm !== undefined && (e.warmth !== undefined) !== query.warm) return false;
  if (query.shelter !== undefined && (e.shelter ?? false) !== query.shelter) return false;
  return true;
}

/**
 * Ejecuta un programa de la DSL de forma incremental: cada llamada a `next()`
 * devuelve la próxima intención de acción (que cuesta un tick de mundo) o el
 * final de la ejecución. Después de aplicar la intención al mundo, el driver
 * debe llamar a `observe()` con los eventos resultantes.
 */
export class SkillExecution {
  private frames: Frame[];
  private vars = new Map<string, VarValue>();
  private lastMove: LastMove = 'none';
  private lastActionOk = true;
  private move: MoveState | null = null;
  private explore: ExploreState | null = null;
  private waitRemaining = 0;
  private pendingSingle = false;
  private intentsEmitted = 0;
  private pureOpsExecuted = 0;
  private finished: SkillExecutionResult | null = null;
  private readonly limits: RuntimeLimits;
  private readonly actorId: string;

  constructor(
    program: SkillProgram,
    actorId: string,
    options: {
      limits?: Partial<RuntimeLimits>;
      library?: SkillLibrary;
      /** Memoria espacial compartida entre ejecuciones (el agente pasa la suya). */
      spatial?: SpatialMemory;
    } = {},
  ) {
    this.limits = { ...DEFAULT_RUNTIME_LIMITS, ...options.limits };
    this.library = options.library;
    this.spatial = options.spatial ?? new SpatialMemory();
    this.actorId = actorId;
    this.frames = [{ ops: program, index: 0, callDepth: 0 }];
  }

  private readonly spatial: SpatialMemory;

  private library: SkillLibrary | undefined;

  cancel(reason: string): void {
    if (!this.finished) this.finish('aborted', reason);
  }

  /** Procesa el resultado de la última intención emitida. */
  observe(events: SimEvent[]): void {
    const resolution = events.find(
      (e) => e.type === 'action.resolved' && e.data.actorId === this.actorId,
    );
    const success = resolution ? resolution.data.success === true : false;

    // El mundo rechazó un paso (borde del mapa, sólido fuera de la vista):
    // esa celda se aprende como bloqueada y el próximo plan la rodea. El
    // aprendizaje es de la memoria espacial, no del op: lo que el muro le
    // enseñó persiguiendo comida sigue sabido cuando después sale a explorar.
    if (this.move?.pendingDest) {
      const dest = this.move.pendingDest;
      delete this.move.pendingDest;
      if (!success) this.spatial.blocked.add(dest);
      return;
    }
    if (this.explore?.pendingDest) {
      const dest = this.explore.pendingDest;
      delete this.explore.pendingDest;
      if (!success) this.spatial.blocked.add(dest);
      return;
    }
    if (this.pendingSingle) {
      this.pendingSingle = false;
      this.lastActionOk = success;
    }
  }

  next(perception: Perception): SkillStepOutput {
    if (this.finished) return { kind: 'done', result: this.finished };

    let pureOpsThisTick = 0;
    const budget = (): boolean => {
      this.pureOpsExecuted += 1;
      pureOpsThisTick += 1;
      if (this.pureOpsExecuted > this.limits.maxTotalPureOps) {
        this.finish('limit-exceeded', 'total-pure-ops');
        return false;
      }
      return pureOpsThisTick <= this.limits.maxPureOpsPerTick;
    };

    // Espera de múltiples ticks en curso.
    if (this.waitRemaining > 0) {
      this.waitRemaining -= 1;
      return this.emit({ type: 'wait' });
    }

    // Movimiento multi-tick en curso.
    if (this.move) {
      const output = this.stepMove(perception);
      if (output) return output;
      if (this.finished) return { kind: 'done', result: this.finished };
    }

    // Exploración multi-tick en curso.
    if (this.explore) {
      const output = this.stepExplore(perception);
      if (output) return output;
      if (this.finished) return { kind: 'done', result: this.finished };
    }

    while (!this.finished) {
      const frame = this.frames[this.frames.length - 1];
      if (!frame) {
        this.finish('completed');
        break;
      }
      if (frame.index >= frame.ops.length) {
        if (frame.repeat) {
          frame.repeat.done += 1;
          const stop =
            frame.repeat.done >= frame.repeat.max ||
            (frame.repeat.until ? this.evalCondition(frame.repeat.until, perception) : false);
          if (!stop) {
            frame.index = 0;
            continue;
          }
        }
        this.frames.pop();
        continue;
      }

      const op = frame.ops[frame.index]!;
      if (!budget()) {
        // Presupuesto del tick agotado: cede un tick con una espera implícita.
        if (this.finished) break;
        return this.emit({ type: 'wait' });
      }

      const output = this.execOp(op, frame, perception);
      if (output) return output;
      if (this.finished) break;
    }
    return { kind: 'done', result: this.finished! };
  }

  private execOp(op: SkillOp, frame: Frame, perception: Perception): SkillStepOutput | null {
    switch (op.op) {
      case 'findEntities': {
        const all = [...perception.visibleEntities, ...perception.self.heldItems];
        const matches = all.filter((e) => matchesQuery(e, op.query));
        this.vars.set(op.store, matches);
        frame.index += 1;
        return null;
      }
      case 'selectTarget': {
        const list = this.vars.get(op.from);
        if (!Array.isArray(list) || list.length === 0) {
          this.finish('aborted', `no-candidates:${op.from}`);
          return null;
        }
        const byId = (a: PerceivedEntity, b: PerceivedEntity) =>
          Number(a.id.slice(1)) - Number(b.id.slice(1));
        const byDistance = (a: PerceivedEntity, b: PerceivedEntity) =>
          (a.held ? 0 : (a.distance ?? Infinity)) - (b.held ? 0 : (b.distance ?? Infinity));
        const sorted = [...list].sort((a, b) => {
          if (op.strategy === 'strongestTool') {
            const power = (b.toolPower ?? -1) - (a.toolPower ?? -1);
            if (power !== 0) return power;
          }
          const dist = byDistance(a, b);
          if (dist !== 0) return dist;
          return byId(a, b);
        });
        this.vars.set(op.store, sorted[0]!);
        frame.index += 1;
        return null;
      }
      case 'branch': {
        frame.index += 1;
        const taken = this.evalCondition(op.if, perception) ? op.then : op.else;
        if (taken) this.frames.push({ ops: taken, index: 0, callDepth: frame.callDepth });
        return null;
      }
      case 'repeatWithLimit': {
        frame.index += 1;
        if (op.until && this.evalCondition(op.until, perception)) return null;
        this.frames.push({
          ops: op.body,
          index: 0,
          callDepth: frame.callDepth,
          repeat: { max: op.max, done: 0, ...(op.until ? { until: op.until } : {}) },
        });
        return null;
      }
      case 'runSkill': {
        frame.index += 1;
        if (frame.callDepth + 1 > this.limits.maxCallDepth) {
          this.finish('limit-exceeded', 'call-depth');
          return null;
        }
        const skill = this.library?.get(op.skillId);
        if (!skill) {
          this.finish('aborted', `skill-not-found:${op.skillId}`);
          return null;
        }
        this.frames.push({ ops: skill.program, index: 0, callDepth: frame.callDepth + 1 });
        return null;
      }
      case 'abort':
        this.finish('aborted', op.reason);
        return null;
      case 'moveToward': {
        frame.index += 1;
        this.move = {
          targetVar: op.target,
          maxSteps: op.maxSteps,
          stepsTaken: 0,
          stopAtDistance: op.stopAtDistance ?? 1,
        };
        const output = this.stepMove(perception);
        return output ?? null;
      }
      case 'moveStep':
        frame.index += 1;
        this.pendingSingle = true;
        return this.emit({ type: 'move', dir: op.dir });
      case 'explore': {
        frame.index += 1;
        this.explore = {
          maxSteps: op.maxSteps,
          stepsTaken: 0,
          ...(op.until ? { until: op.until } : {}),
        };
        const output = this.stepExplore(perception);
        return output ?? null;
      }
      case 'wait':
        frame.index += 1;
        this.waitRemaining = (op.ticks ?? 1) - 1;
        return this.emit({ type: 'wait' });
      case 'speak':
        frame.index += 1;
        return this.emit({ type: 'speak', text: op.text });
      case 'craft':
        frame.index += 1;
        this.pendingSingle = true;
        // El mundo decide si se puede: aquí solo se expresa la intención.
        return this.emit({ type: 'craft', recipeId: op.recipeId });
      case 'interact': {
        const target = this.resolveEntity(op.target);
        if (!target) {
          this.finish('aborted', `target-missing:${op.target}`);
          return null;
        }
        frame.index += 1;
        this.pendingSingle = true;
        // Postura, objetivo y requisitos los vuelve a comprobar el mundo.
        return this.emit({
          type: 'interact',
          interactionId: op.interactionId,
          targetId: target.id,
        });
      }
      case 'place': {
        // Un bloque cualquiera del tipo pedido que lleve encima. Si no tiene
        // ninguno, no hay nada que colocar: aborta para que la obra lo note en
        // vez de seguir como si hubiera puesto algo.
        const block = perception.self.heldItems.find((e) => e.kind === op.kind);
        if (!block) {
          this.finish('aborted', `no-block:${op.kind}`);
          return null;
        }
        frame.index += 1;
        this.pendingSingle = true;
        // La celda la vuelve a comprobar el mundo (adyacente, vacía, dentro):
        // aquí solo se expresa dónde intenta ponerlo.
        return this.emit({
          type: 'place',
          itemId: block.id,
          at: { x: perception.self.position.x + op.dx, y: perception.self.position.y + op.dy },
        });
      }
      case 'pickup':
      case 'drop':
      case 'consume':
      case 'useItem': {
        const target = this.resolveEntity(op.op === 'useItem' ? op.target : op.target);
        if (!target) {
          this.finish('aborted', `target-missing:${op.target}`);
          return null;
        }
        frame.index += 1;
        this.pendingSingle = true;
        if (op.op === 'pickup') return this.emit({ type: 'pickup', targetId: target.id });
        if (op.op === 'drop') return this.emit({ type: 'drop', itemId: target.id });
        if (op.op === 'consume') return this.emit({ type: 'consume', targetId: target.id });
        const item = this.resolveEntity(op.item);
        if (!item) {
          this.finish('aborted', `target-missing:${op.item}`);
          return null;
        }
        return this.emit({ type: 'useItem', itemId: item.id, targetId: target.id });
      }
    }
  }

  private stepMove(perception: Perception): SkillStepOutput | null {
    const move = this.move!;
    const target = this.resolveEntity(move.targetVar);
    if (!target) {
      this.endMove('lost');
      return null;
    }
    if (perception.self.heldItems.some((e) => e.id === target.id)) {
      this.endMove('reached');
      return null;
    }
    const current = this.findCurrent(target.id, perception);
    if (!current?.position) {
      this.endMove('lost');
      return null;
    }
    const selfPos = perception.self.position;
    if (chebyshev(selfPos, current.position) <= move.stopAtDistance) {
      this.endMove('reached');
      return null;
    }
    if (move.stepsTaken >= move.maxSteps) {
      this.endMove('exhausted');
      return null;
    }

    // Camino más corto (BFS) sobre lo que CONOCE: los sólidos y el agua que
    // percibe o recuerda, más las celdas que el mundo ya le rechazó. Lo
    // desconocido se asume transitable — si el optimismo falla, el paso
    // rechazado se aprende en observe() y el próximo tick se replanifica con
    // esa verdad. Sigue sin omnisciencia: rodea el muro solo si sabe por dónde.
    this.spatial.observe(perception);
    const dir = this.pathStep(selfPos, current.position, move.stopAtDistance, perception);
    if (!dir) {
      this.endMove('blocked');
      return null;
    }
    const delta = STEP_DELTAS[dir];
    move.pendingDest = `${selfPos.x + delta.x},${selfPos.y + delta.y}`;
    move.stepsTaken += 1;
    return this.emit({ type: 'move', dir });
  }

  /**
   * Primer paso del camino más corto de `from` hasta quedar a `stopAt` o menos
   * (Chebyshev) de `to`, esquivando lo percibido como sólido/agua y lo
   * aprendido como bloqueado. Determinista: BFS con orden fijo de vecinos.
   * Devuelve null si ningún camino conocido llega — el "camino-bloqueado" de
   * siempre, ahora dicho tras haber considerado el rodeo y no solo la recta.
   */
  private pathStep(from: Vec2, to: Vec2, stopAt: number, perception: Perception): Direction | null {
    const key = (x: number, y: number): string => `${x},${y}`;
    const obstacles = new Set<string>([...this.spatial.blocked, ...this.spatial.solids]);
    for (const e of perception.visibleEntities) {
      if ((e.solid || e.wet) && e.position) obstacles.add(key(e.position.x, e.position.y));
    }
    const bounds = perception.bounds;
    const inWorld = (x: number, y: number): boolean =>
      bounds
        ? x >= 0 && y >= 0 && x < bounds.width && y < bounds.height
        : // Sin bordes conocidos (percepciones viejas): ventana acotada para
          // que el BFS no se fugue al infinito; los bordes reales se aprenden.
          Math.abs(x - from.x) <= 24 && Math.abs(y - from.y) <= 24;

    // parents[celda] = dirección con la que se entró; el arranque no tiene.
    const parents = new Map<string, { from: string; dir: Direction }>();
    const queue: { x: number; y: number }[] = [{ x: from.x, y: from.y }];
    const seen = new Set<string>([key(from.x, from.y)]);
    let goal: string | null = null;
    for (let head = 0; head < queue.length && head < 2000 && !goal; head++) {
      const cell = queue[head]!;
      for (const dir of EXPLORE_ORDER) {
        const delta = STEP_DELTAS[dir];
        const nx = cell.x + delta.x;
        const ny = cell.y + delta.y;
        const nk = key(nx, ny);
        if (seen.has(nk) || obstacles.has(nk) || !inWorld(nx, ny)) continue;
        seen.add(nk);
        parents.set(nk, { from: key(cell.x, cell.y), dir });
        if (chebyshev({ x: nx, y: ny }, to) <= stopAt) {
          goal = nk;
          break;
        }
        queue.push({ x: nx, y: ny });
      }
    }
    if (!goal) return null;
    // Retroceder hasta el paso que sale de `from`.
    let cursor = goal;
    let firstDir: Direction | null = null;
    while (cursor !== key(from.x, from.y)) {
      const parent = parents.get(cursor)!;
      firstDir = parent.dir;
      cursor = parent.from;
    }
    return firstDir;
  }

  private endMove(result: LastMove): void {
    this.lastMove = result;
    this.lastActionOk = result === 'reached';
    this.move = null;
  }

  /**
   * Un paso de exploración: hacia la celda vecina menos visitada que no se vea
   * ocupada por un sólido (ni agua) ni se sepa bloqueada. Sin destino y sin
   * mapa — solo percepción y la memoria espacial — cubre el espacio en vez de
   * oscilar, y el `until` (evaluado ANTES de cada paso) la corta apenas
   * encuentra lo que busca. Si ya lo ve al empezar, no cuesta ni un tick.
   * Las huellas viven en la memoria compartida: buscar por segunda vez empuja
   * hacia lo aún no pisado en vez de re-recorrer lo de la primera.
   */
  private stepExplore(perception: Perception): SkillStepOutput | null {
    const explore = this.explore!;
    if (explore.until && this.evalCondition(explore.until, perception)) {
      this.endExplore('reached');
      return null;
    }
    if (explore.stepsTaken >= explore.maxSteps) {
      this.endExplore(explore.until ? 'exhausted' : 'reached');
      return null;
    }

    this.spatial.observe(perception);
    const selfPos = perception.self.position;
    const visits = this.spatial.visits;
    visits.set(`${selfPos.x},${selfPos.y}`, (visits.get(`${selfPos.x},${selfPos.y}`) ?? 0) + 1);

    const bounds = perception.bounds;
    let best: { dir: Direction; dest: string; visits: number } | null = null;
    for (const dir of EXPLORE_ORDER) {
      const dest = { x: selfPos.x + STEP_DELTAS[dir].x, y: selfPos.y + STEP_DELTAS[dir].y };
      if (bounds && (dest.x < 0 || dest.y < 0 || dest.x >= bounds.width || dest.y >= bounds.height))
        continue;
      const key = `${dest.x},${dest.y}`;
      if (this.spatial.blocked.has(key) || this.spatial.solids.has(key)) continue;
      const solidThere = perception.visibleEntities.some(
        (e) =>
          (e.solid || e.wet) && e.position && e.position.x === dest.x && e.position.y === dest.y,
      );
      if (solidThere) continue;
      const count = visits.get(key) ?? 0;
      if (!best || count < best.visits) best = { dir, dest: key, visits: count };
    }
    if (!best) {
      this.endExplore('blocked');
      return null;
    }
    explore.pendingDest = best.dest;
    explore.stepsTaken += 1;
    return this.emit({ type: 'move', dir: best.dir });
  }

  private endExplore(result: LastMove): void {
    this.lastMove = result;
    this.lastActionOk = result === 'reached';
    this.explore = null;
  }

  private findCurrent(id: string, perception: Perception): PerceivedEntity | undefined {
    return (
      perception.visibleEntities.find((e) => e.id === id) ??
      perception.self.heldItems.find((e) => e.id === id)
    );
  }

  private resolveEntity(varName: string): PerceivedEntity | null {
    const value = this.vars.get(varName);
    if (!value || Array.isArray(value)) return null;
    return value;
  }

  private evalCondition(cond: SkillCondition, perception: Perception): boolean {
    switch (cond.type) {
      case 'always':
        return true;
      case 'lastMoveBlocked':
        return this.lastMove === 'blocked' || this.lastMove === 'exhausted';
      case 'lastActionFailed':
        return !this.lastActionOk;
      case 'not':
        return !this.evalCondition(cond.cond, perception);
      case 'entityGone': {
        const entity = this.resolveEntity(cond.ref);
        if (!entity) return true;
        return this.findCurrent(entity.id, perception) === undefined;
      }
      case 'isAdjacent': {
        const entity = this.resolveEntity(cond.target);
        const current = entity ? this.findCurrent(entity.id, perception) : undefined;
        if (!current?.position) return false;
        return isAdjacent(perception.self.position, current.position);
      }
      case 'holding': {
        const entity = this.resolveEntity(cond.target);
        if (!entity) return false;
        return perception.self.heldItems.some((e) => e.id === entity.id);
      }
      case 'energyBelow':
        return (perception.self.energy?.current ?? 0) < cond.value;
      case 'temperatureBelow':
        // Sin sentido del frío, nunca tiene frío (no es lo mismo que tener 0).
        return perception.self.temperature !== undefined &&
          perception.self.temperature.current < cond.value;
      case 'sees': {
        const all = [...perception.visibleEntities, ...perception.self.heldItems];
        return all.some((e) => matchesQuery(e, cond.query));
      }
      case 'canCraft': {
        const recipe = perception.recipes.find((r) => r.id === cond.recipeId);
        if (!recipe) return false;
        const counts = new Map<string, number>();
        for (const item of perception.self.heldItems) {
          counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
        }
        return missingIngredients(recipe, counts).length === 0;
      }
      case 'holdingCount': {
        const held = perception.self.heldItems.filter((e) => e.kind === cond.kind).length;
        return held >= cond.count;
      }
    }
  }

  private emit(intent: ActionIntent): SkillStepOutput {
    this.intentsEmitted += 1;
    if (this.intentsEmitted > this.limits.maxIntents) {
      this.finish('limit-exceeded', 'max-intents');
      return { kind: 'done', result: this.finished! };
    }
    return { kind: 'intent', intent };
  }

  private finish(outcome: SkillOutcome, reason?: string): void {
    this.finished = {
      outcome,
      ...(reason !== undefined ? { reason } : {}),
      intentsEmitted: this.intentsEmitted,
      pureOpsExecuted: this.pureOpsExecuted,
    };
  }
}
