import { chebyshev, isAdjacent } from '@anima/shared';
import type { Vec2 } from '@anima/shared';
import type {
  ActionIntent,
  Direction,
  Perception,
  PerceivedEntity,
  SimEvent,
} from '@anima/sim-core';
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
  { kind: 'intent'; intent: ActionIntent } | { kind: 'done'; result: SkillExecutionResult };

/** Un ancla de obra: una celda fija del mundo a la que la mascota vuelve (ADR 0034). */
interface Anchor {
  anchor: Vec2;
}
type VarValue = PerceivedEntity | PerceivedEntity[] | Anchor;

function isAnchor(value: VarValue | undefined): value is Anchor {
  return value !== undefined && !Array.isArray(value) && 'anchor' in value;
}

interface Frame {
  ops: SkillOp[];
  index: number;
  callDepth: number;
  repeat?: { max: number; done: number; until?: SkillCondition };
  /**
   * Las variables VISIBLES desde este marco (ADR 0055). `branch` y
   * `repeatWithLimit` heredan la referencia de su padre —son el mismo
   * programa, y guardar un objetivo dentro de un `if` tiene que verse
   * afuera—, pero `runSkill` estrena una bolsa vacía: una habilidad llamada
   * es otro programa, escrito por otro, que no tiene por qué conocer ni
   * pisar los nombres de quien la llama.
   */
  scope: Map<string, VarValue>;
}

interface MoveState {
  targetVar: string;
  maxSteps: number;
  stepsTaken: number;
  /** Distancia Chebyshev a la que darse por llegada. */
  stopAtDistance: number;
  /** Quedar al lado del destino, nunca encima (ADR 0035). */
  avoidTarget: boolean;
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

interface GpsState {
  kind: string;
  maxSteps: number;
  stepsTaken: number;
  /** Distancia Chebyshev a la que darse por llegada (sobre el ejemplar visto). */
  stopAtDistance: number;
  /** Variable donde dejar el ejemplar alcanzado, si se pidió. */
  store?: string;
  /** Celda destino del paso pendiente de resolver, para aprenderla si falla. */
  pendingDest?: string;
}

/**
 * La ventana del GPS a la memoria de lugares (ADR 0025): qué recuerda haber
 * visto de un tipo (lo visible AHORA no cuenta: eso se persigue con la vista)
 * y el derecho a desmentir un recuerdo tras ir y no encontrar nada. El agente
 * pasa la suya; sin ella el GPS navega solo por vista y exploración.
 */
export interface GpsPlaces {
  recall(kind: string, perception: Perception): { entityId: string; position: Vec2 }[];
  forget(entityId: string): void;
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
    // Lo que ofrece dónde pisar gana sobre todo lo demás de la celda, igual que
    // en el motor (`impedimentAt`): una tabla puesta sobre el agua vuelve
    // caminable esa celda, y si su mapa mental no lo supiera, el paso que ella
    // misma construyó le seguiría pareciendo un río.
    const footings = new Set<string>();
    for (const e of perception.visibleEntities) {
      if (e.footing && e.position) footings.add(`${e.position.x},${e.position.y}`);
    }
    for (const e of perception.visibleEntities) {
      if (!e.position) continue;
      const key = `${e.position.x},${e.position.y}`;
      if ((e.solid || e.wet) && !footings.has(key)) {
        this.solids.add(key);
        seenSolid.add(key);
      }
      // Solo lo sólido tapa la vista (el agua se ve a través, como en el mundo).
      if (e.solid) occluders.add(key);
    }
    // Lo que se volvió pisable deja de ser obstáculo recordado en el acto: no
    // hace falta acercarse a "desmentirlo" como a un muro roto, porque no es
    // una creencia vieja — es un cambio que está viendo.
    for (const key of footings) {
      this.solids.delete(key);
      this.blocked.delete(key);
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
  if (query.id !== undefined && e.id !== query.id) return false;
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
  /**
   * Las variables del marco que está corriendo. Es un getter y no un campo
   * porque cada habilidad llamada tiene las suyas: leer o escribir siempre
   * ocurre en el ámbito de quien ejecuta, nunca en una bolsa global.
   */
  private get vars(): Map<string, VarValue> {
    return this.frames[this.frames.length - 1]?.scope ?? this.rootScope;
  }
  private readonly rootScope = new Map<string, VarValue>();
  private lastMove: LastMove = 'none';
  private lastActionOk = true;
  /** Motivo con el que el mundo rechazó la última acción (undefined si salió bien). */
  private lastActionReason: string | undefined;
  /** Daño que causó el último golpe (0 si no golpeó o no hizo mella). */
  private lastDamage = 0;
  private move: MoveState | null = null;
  private explore: ExploreState | null = null;
  private gps: GpsState | null = null;
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
      /** Memoria de lugares para el GPS (el agente pasa la suya, ADR 0038). */
      places?: GpsPlaces;
    } = {},
  ) {
    this.limits = { ...DEFAULT_RUNTIME_LIMITS, ...options.limits };
    this.library = options.library;
    this.spatial = options.spatial ?? new SpatialMemory();
    this.places = options.places;
    this.actorId = actorId;
    this.frames = [{ ops: program, index: 0, callDepth: 0, scope: this.rootScope }];
  }

  private readonly spatial: SpatialMemory;

  private readonly places: GpsPlaces | undefined;

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
    if (this.gps?.pendingDest) {
      const dest = this.gps.pendingDest;
      delete this.gps.pendingDest;
      if (!success) this.spatial.blocked.add(dest);
      return;
    }
    if (this.pendingSingle) {
      this.pendingSingle = false;
      this.lastActionOk = success;
      // Razón y daño de la última acción: dejan distinguir "no se puede" (inmune)
      // de "no le hice mella" (muy duro), y cortar un golpe inútil sin repetirlo.
      const data = resolution?.data;
      this.lastActionReason =
        !success && typeof data?.reason === 'string' ? data.reason : undefined;
      this.lastDamage = success && typeof data?.damage === 'number' ? data.damage : 0;
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

    // GPS multi-tick en curso.
    if (this.gps) {
      const output = this.stepGps(perception);
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
        if (taken) {
          this.frames.push({
            ops: taken,
            index: 0,
            callDepth: frame.callDepth,
            scope: frame.scope,
          });
        }
        return null;
      }
      case 'repeatWithLimit': {
        frame.index += 1;
        if (op.until && this.evalCondition(op.until, perception)) return null;
        this.frames.push({
          ops: op.body,
          index: 0,
          callDepth: frame.callDepth,
          scope: frame.scope,
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
        // Por NOMBRE se resuelve tarde, a la mejor versión de esa habilidad
        // (ADR 0055): una madre que llama a «desbloquear-camino» quiere la
        // que sirve hoy, no la que existía cuando se escribió. Por `skillId`
        // sigue siendo una versión congelada, que es lo que quieren las dos
        // rutas de TypeScript que ya lo usaban.
        const skill = op.skillName
          ? (this.library?.findUsable(op.skillName) ?? this.library?.findLatest(op.skillName))
          : op.skillId
            ? this.library?.get(op.skillId)
            : undefined;
        if (!skill) {
          this.finish('aborted', `skill-not-found:${op.skillName ?? op.skillId ?? '?'}`);
          return null;
        }
        this.frames.push({
          ops: skill.program,
          index: 0,
          callDepth: frame.callDepth + 1,
          scope: new Map(),
        });
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
          avoidTarget: op.avoidTarget ?? false,
        };
        const output = this.stepMove(perception);
        return output ?? null;
      }
      case 'moveTo': {
        const targetVar = `__move-to-${frame.callDepth}-${frame.index}`;
        this.vars.set(targetVar, { anchor: { ...op.position } });
        frame.index += 1;
        this.move = {
          targetVar,
          maxSteps: op.maxSteps,
          stepsTaken: 0,
          stopAtDistance: op.stopAtDistance ?? 0,
          avoidTarget: false,
        };
        const output = this.stepMove(perception);
        return output ?? null;
      }
      case 'moveStep':
        frame.index += 1;
        this.pendingSingle = true;
        return this.emit({ type: 'move', dir: op.dir });
      case 'gpsTo': {
        frame.index += 1;
        this.gps = {
          kind: op.kind,
          maxSteps: op.maxSteps,
          stepsTaken: 0,
          stopAtDistance: op.stopAtDistance ?? 1,
          ...(op.store !== undefined ? { store: op.store } : {}),
        };
        const output = this.stepGps(perception);
        return output ?? null;
      }
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
      case 'markAnchor': {
        this.vars.set(op.store, { anchor: { ...perception.self.position } });
        frame.index += 1;
        return null;
      }
      case 'markTarget': {
        // La celda de lo que ve. Un objetivo sin posición (algo que lleva
        // encima) no ancla nada: el programa sigue y la colocación que
        // dependía de esta ancla se saltea, como con `markCell`.
        const target = this.vars.get(op.from) as PerceivedEntity | undefined;
        const pos = target && !Array.isArray(target) ? target.position : undefined;
        if (pos) this.vars.set(op.store, { anchor: { ...pos } });
        frame.index += 1;
        return null;
      }
      case 'markCell': {
        // La celda absoluta = ancla base + offset. Si no hay base (variable que
        // no es ancla), no hay dónde anclar: se cae la derivación y el programa
        // sigue —la colocación de esa celda no encontrará su ancla y se saltea.
        const base = this.resolveAnchor(op.from);
        if (base) this.vars.set(op.store, { anchor: { x: base.x + op.dx, y: base.y + op.dy } });
        frame.index += 1;
        return null;
      }
      case 'placeAt': {
        const cell = this.resolveAnchor(op.target);
        const block = perception.self.heldItems.find((e) => e.kind === op.kind);
        if (!cell || !block) {
          this.finish('aborted', `no-cell-or-block:${op.kind}`);
          return null;
        }
        frame.index += 1;
        this.pendingSingle = true;
        // La celda es absoluta; el mundo revalida adyacencia, vacío y bordes.
        return this.emit({
          type: 'place',
          itemId: block.id,
          at: { ...cell },
          ...(op.partOf ? { partOf: op.partOf } : {}),
        });
      }
      case 'makeRoom': {
        // Solo actúa con las manos llenas: con lugar de sobra, juntar de más
        // sería ensuciar el suelo por nada. La cosa a soltar es la MENOS útil
        // de lo que no sirve para esta tarea (no está en `keep`): primero lo
        // que no es herramienta, y si no queda otra, la herramienta más débil —
        // nunca la materia de la receta ni el martillo si hay una rama.
        const held = perception.self.heldItems;
        const free = perception.self.inventoryCapacity - held.length;
        // Lo que no sirve para esta tarea, de menos a más útil.
        const junk = held
          .filter((e) => !op.keep.includes(e.kind))
          .sort((a, b) => (a.toolPower ?? -1) - (b.toolPower ?? -1));
        // Y el EXCEDENTE de lo que sí sirve: guardar más de lo que la tarea
        // pide no es cuidar la materia, es ocupar la mano con la que habría
        // que agarrar lo que falta. Va después de lo inútil —primero se suelta
        // lo que no sirve para nada— y se cuenta por tipo: sobra lo que pasa
        // de `atMost`, nunca lo que la receta necesita.
        if (op.atMost) {
          const seen = new Map<string, number>();
          for (const item of held) {
            if (!op.keep.includes(item.kind)) continue;
            const limit = op.atMost[item.kind];
            if (limit === undefined) continue;
            const count = (seen.get(item.kind) ?? 0) + 1;
            seen.set(item.kind, count);
            if (count > limit) junk.push(item);
          }
        }
        if (free > 0 || junk.length === 0) {
          frame.index += 1;
          return null;
        }
        frame.index += 1;
        this.pendingSingle = true;
        return this.emit({ type: 'drop', itemId: junk[0]!.id });
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
    // El destino puede ser una entidad (perseguir un pedernal) o un ancla de
    // obra: una celda fija a la que volver (ADR 0034). El ancla no se busca en
    // la percepción —es una coordenada, no una cosa que pueda esconderse tras
    // un muro— así que nunca se "pierde".
    const value = this.vars.get(move.targetVar);
    let destination: Vec2;
    if (isAnchor(value)) {
      destination = value.anchor;
    } else {
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
      destination = current.position;
    }
    const selfPos = perception.self.position;
    const dist = chebyshev(selfPos, destination);
    // `avoidTarget`: llegar es quedar AL LADO (distancia 1..stopAt), nunca encima
    // (distancia 0) — pararse en la celda la ocuparía y no se podría colocar ahí.
    // Estando encima, no está "llegada": tiene que correrse a un lado.
    const arrived = move.avoidTarget
      ? dist >= 1 && dist <= move.stopAtDistance
      : dist <= move.stopAtDistance;
    if (arrived) {
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
    const dir = this.pathStep(
      selfPos,
      destination,
      move.stopAtDistance,
      perception,
      move.avoidTarget,
    );
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
  private pathStep(
    from: Vec2,
    to: Vec2,
    stopAt: number,
    perception: Perception,
    avoidTarget = false,
  ): Direction | null {
    const key = (x: number, y: number): string => `${x},${y}`;
    const obstacles = new Set<string>([...this.spatial.blocked, ...this.spatial.solids]);
    // Misma regla que el motor: lo que ofrece dónde pisar no es obstáculo, y
    // cancela el agua y la solidez de su propia celda.
    const footings = new Set<string>();
    for (const e of perception.visibleEntities) {
      if (e.footing && e.position) footings.add(key(e.position.x, e.position.y));
    }
    for (const e of perception.visibleEntities) {
      if ((e.solid || e.wet) && e.position) obstacles.add(key(e.position.x, e.position.y));
    }
    for (const cell of footings) obstacles.delete(cell);
    // La celda destino como obstáculo: así el camino termina a su lado (donde se
    // puede colocar) y nunca encima de ella (ADR 0035). El arranque no se filtra
    // por obstáculos, así que estar YA encima igual encuentra el paso a un lado.
    if (avoidTarget) obstacles.add(key(to.x, to.y));
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
    // Moverse no es golpear: que un golpe viejo no ensucie las condiciones de golpe.
    this.lastActionReason = undefined;
    this.lastDamage = 0;
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
    const best = this.leastVisitedStep(perception);
    if (!best) {
      this.endExplore('blocked');
      return null;
    }
    explore.pendingDest = best.dest;
    explore.stepsTaken += 1;
    return this.emit({ type: 'move', dir: best.dir });
  }

  /**
   * Elige el próximo paso de exploración: la celda vecina MENOS visitada que
   * no se vea ocupada por un sólido (ni agua) ni se sepa bloqueada. Deja la
   * huella de la celda actual en la memoria compartida. Null si no hay salida.
   */
  private leastVisitedStep(perception: Perception): { dir: Direction; dest: string } | null {
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
    return best ? { dir: best.dir, dest: best.dest } : null;
  }

  private endExplore(result: LastMove): void {
    this.lastMove = result;
    this.lastActionOk = result === 'reached';
    this.lastActionReason = undefined;
    this.lastDamage = 0;
    this.explore = null;
  }

  /**
   * Un paso del GPS (ADR 0038), con tres rumbos en orden de certeza:
   * 1) Un ejemplar A LA VISTA: el más cercano se persigue con el mismo BFS de
   *    `moveToward`; quedar a `stopAtDistance` es haber llegado, y `store` se
   *    lleva el ejemplar alcanzado.
   * 2) Un lugar RECORDADO: camina hasta donde vio uno por última vez. Llegar
   *    al lado sin que el rumbo 1 haya visto nada prueba que el recuerdo
   *    mentía: se descarta y se prueba el siguiente. Un camino bloqueado NO
   *    desmiente el recuerdo — solo lo posterga por el siguiente.
   * 3) Nada visto ni recordado: EXPLORA hacia lo menos visitado, esperando
   *    que el rumbo 1 tome el control apenas el recurso entre en la vista.
   * Sin omnisciencia: los tres rumbos usan solo percepción y memorias propias.
   */
  private stepGps(perception: Perception): SkillStepOutput | null {
    const gps = this.gps!;
    this.spatial.observe(perception);
    const selfPos = perception.self.position;

    // 1) A la vista. Nunca lo que lleva encima: el GPS lleva a LUGARES.
    const seen = perception.visibleEntities
      .filter((e) => e.kind === gps.kind && e.position)
      .sort(
        (a, b) =>
          (a.distance ?? Infinity) - (b.distance ?? Infinity) ||
          Number(a.id.slice(1)) - Number(b.id.slice(1)),
      );
    const target = seen[0];
    if (target?.position) {
      if (chebyshev(selfPos, target.position) <= gps.stopAtDistance) {
        if (gps.store !== undefined) this.vars.set(gps.store, target);
        this.endGps('reached');
        return null;
      }
      if (gps.stepsTaken >= gps.maxSteps) {
        this.endGps('exhausted');
        return null;
      }
      const dir = this.pathStep(selfPos, target.position, gps.stopAtDistance, perception);
      if (!dir) {
        this.endGps('blocked');
        return null;
      }
      return this.emitGpsStep(gps, selfPos, dir);
    }

    // 2) Recordado (recall ya excluye lo visible y ordena por cercanía).
    for (const place of this.places?.recall(gps.kind, perception) ?? []) {
      if (chebyshev(selfPos, place.position) <= 1) {
        this.places!.forget(place.entityId);
        continue;
      }
      if (gps.stepsTaken >= gps.maxSteps) {
        this.endGps('exhausted');
        return null;
      }
      const dir = this.pathStep(selfPos, place.position, 1, perception);
      if (!dir) continue;
      return this.emitGpsStep(gps, selfPos, dir);
    }

    // 3) Explorar.
    if (gps.stepsTaken >= gps.maxSteps) {
      this.endGps('exhausted');
      return null;
    }
    const step = this.leastVisitedStep(perception);
    if (!step) {
      this.endGps('blocked');
      return null;
    }
    gps.pendingDest = step.dest;
    gps.stepsTaken += 1;
    return this.emit({ type: 'move', dir: step.dir });
  }

  private emitGpsStep(gps: GpsState, selfPos: Vec2, dir: Direction): SkillStepOutput {
    const delta = STEP_DELTAS[dir];
    gps.pendingDest = `${selfPos.x + delta.x},${selfPos.y + delta.y}`;
    gps.stepsTaken += 1;
    return this.emit({ type: 'move', dir });
  }

  private endGps(result: LastMove): void {
    this.lastMove = result;
    this.lastActionOk = result === 'reached';
    this.lastActionReason = undefined;
    this.lastDamage = 0;
    this.gps = null;
  }

  private findCurrent(id: string, perception: Perception): PerceivedEntity | undefined {
    return (
      perception.visibleEntities.find((e) => e.id === id) ??
      perception.self.heldItems.find((e) => e.id === id)
    );
  }

  private resolveEntity(varName: string): PerceivedEntity | null {
    const value = this.vars.get(varName);
    if (!value || Array.isArray(value) || isAnchor(value)) return null;
    return value;
  }

  private resolveAnchor(varName: string): Vec2 | null {
    const value = this.vars.get(varName);
    return isAnchor(value) ? value.anchor : null;
  }

  private evalCondition(cond: SkillCondition, perception: Perception): boolean {
    switch (cond.type) {
      case 'always':
        return true;
      case 'lastMoveBlocked':
        return this.lastMove === 'blocked' || this.lastMove === 'exhausted';
      case 'lastActionFailed':
        return !this.lastActionOk;
      case 'lastActionUnaffected':
        return this.lastActionReason === 'target-unaffected';
      case 'lastStrikeIneffective':
        // Sin progreso: o el golpe falló, o pegó sin quitar durabilidad.
        return !this.lastActionOk || this.lastDamage <= 0;
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
        return (
          perception.self.temperature !== undefined &&
          perception.self.temperature.current < cond.value
        );
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
      case 'blockAt': {
        // ¿Ya hay algo (de `kind`, si se pidió) en la celda vecina del offset?
        // Se mira desde donde la mascota está AHORA, así que solo dice la verdad
        // parada en el ancla — por eso el programa vuelve antes de preguntar.
        const cx = perception.self.position.x + cond.dx;
        const cy = perception.self.position.y + cond.dy;
        return perception.visibleEntities.some(
          (e) =>
            e.position?.x === cx &&
            e.position.y === cy &&
            (cond.kind === undefined || e.kind === cond.kind),
        );
      }
      case 'blockAtCell': {
        // Igual que `blockAt` pero sobre una celda ABSOLUTA guardada en un ancla
        // (ADR 0035): no depende de dónde esté parada, así que vale también antes
        // de caminar hasta ella. Sin el ancla, no hay celda que juzgar: false.
        const cell = this.resolveAnchor(cond.target);
        if (!cell) return false;
        return perception.visibleEntities.some(
          (e) =>
            e.position?.x === cell.x &&
            e.position.y === cell.y &&
            (cond.kind === undefined || e.kind === cond.kind),
        );
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
