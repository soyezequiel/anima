import { isAdjacent } from '@anima/shared';
import type { ActionIntent, Direction, Perception, PerceivedEntity, SimEvent } from '@anima/sim-core';
import type { SkillCondition, SkillOp, SkillProgram } from './dsl.js';
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
  /** Direcciones que fallaron desde la celda actual (se limpia al avanzar). */
  triedDirs: Set<Direction>;
  pendingDir?: Direction;
}

type LastMove = 'none' | 'reached' | 'blocked' | 'exhausted' | 'lost';

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
    options: { limits?: Partial<RuntimeLimits>; library?: SkillLibrary } = {},
  ) {
    this.limits = { ...DEFAULT_RUNTIME_LIMITS, ...options.limits };
    this.library = options.library;
    this.actorId = actorId;
    this.frames = [{ ops: program, index: 0, callDepth: 0 }];
  }

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

    if (this.move?.pendingDir) {
      const dir = this.move.pendingDir;
      delete this.move.pendingDir;
      if (success) {
        this.move.triedDirs.clear();
      } else {
        this.move.triedDirs.add(dir);
      }
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
        const matches = all.filter((e) => {
          if (op.query.kind !== undefined && e.kind !== op.query.kind) return false;
          if (op.query.tool !== undefined && (e.toolPower !== undefined) !== op.query.tool) return false;
          if (op.query.edible !== undefined && (e.edible ?? false) !== op.query.edible) return false;
          if (op.query.portable !== undefined && (e.portable ?? false) !== op.query.portable)
            return false;
          return true;
        });
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
          triedDirs: new Set(),
        };
        const output = this.stepMove(perception);
        return output ?? null;
      }
      case 'moveStep':
        frame.index += 1;
        this.pendingSingle = true;
        return this.emit({ type: 'move', dir: op.dir });
      case 'wait':
        frame.index += 1;
        this.waitRemaining = (op.ticks ?? 1) - 1;
        return this.emit({ type: 'wait' });
      case 'speak':
        frame.index += 1;
        return this.emit({ type: 'speak', text: op.text });
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
    if (isAdjacent(selfPos, current.position)) {
      this.endMove('reached');
      return null;
    }
    if (move.stepsTaken >= move.maxSteps) {
      this.endMove('exhausted');
      return null;
    }

    const dx = current.position.x - selfPos.x;
    const dy = current.position.y - selfPos.y;
    const horizontal: Direction | null = dx > 0 ? 'right' : dx < 0 ? 'left' : null;
    const vertical: Direction | null = dy > 0 ? 'down' : dy < 0 ? 'up' : null;
    const candidates: Direction[] = [];
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (horizontal) candidates.push(horizontal);
      if (vertical) candidates.push(vertical);
    } else {
      if (vertical) candidates.push(vertical);
      if (horizontal) candidates.push(horizontal);
    }

    const deltas: Record<Direction, { x: number; y: number }> = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const viable = candidates.filter((dir) => {
      if (move.triedDirs.has(dir)) return false;
      const dest = { x: selfPos.x + deltas[dir].x, y: selfPos.y + deltas[dir].y };
      // Lookahead barato: evita chocar contra sólidos que ya percibe.
      const solidThere = perception.visibleEntities.some(
        (e) => e.solid && e.position && e.position.x === dest.x && e.position.y === dest.y,
      );
      return !solidThere;
    });

    const dir = viable[0];
    if (!dir) {
      this.endMove('blocked');
      return null;
    }
    move.pendingDir = dir;
    move.stepsTaken += 1;
    return this.emit({ type: 'move', dir });
  }

  private endMove(result: LastMove): void {
    this.lastMove = result;
    this.lastActionOk = result === 'reached';
    this.move = null;
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
