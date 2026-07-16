import type { EntityId, InvariantViolation, SimEvent, WorldState } from '@anima/sim-core';
import { buildPerception, checkInvariants, getEntity, stepWorld } from '@anima/sim-core';
import type { SkillProgram } from './dsl.js';
import type { RuntimeLimits } from './interpreter.js';
import { SkillExecution } from './interpreter.js';
import type { SkillLibrary } from './skill.js';

export interface SkillRunOptions {
  /** Tiempo máximo simulado: al agotarse la ejecución se cancela. */
  maxTicks: number;
  limits?: Partial<RuntimeLimits>;
  library?: SkillLibrary;
  /** Verificar invariantes del mundo en cada tick (usado por el evaluador). */
  checkInvariantsEachTick?: boolean;
}

export interface SkillRunReport {
  outcome: 'completed' | 'aborted' | 'timeout' | 'limit-exceeded';
  reason?: string;
  ticks: number;
  intents: number;
  pureOps: number;
  events: SimEvent[];
  invariantViolations: InvariantViolation[];
  energyDelta: number;
  damageTaken: number;
}

/**
 * Ejecuta un programa hasta terminar (o agotar el presupuesto) haciendo
 * avanzar el mundo tick a tick. Es el driver que usan el evaluador (sobre
 * mundos aislados) y las pruebas. En el mundo real, el agente usa
 * SkillExecution de forma incremental dentro de su propio loop.
 */
export function runSkillProgram(
  world: WorldState,
  actorId: EntityId,
  program: SkillProgram,
  options: SkillRunOptions,
): SkillRunReport {
  const execOptions: { limits?: Partial<RuntimeLimits>; library?: SkillLibrary } = {};
  if (options.limits) execOptions.limits = options.limits;
  if (options.library) execOptions.library = options.library;
  const exec = new SkillExecution(program, actorId, execOptions);

  const actor = getEntity(world, actorId);
  const energyBefore = actor?.components.energy?.current ?? 0;
  const healthBefore = actor?.components.health?.current ?? 0;

  const events: SimEvent[] = [];
  const invariantViolations: InvariantViolation[] = [];
  let ticks = 0;
  let outcome: SkillRunReport['outcome'] = 'timeout';
  let reason: string | undefined;
  let intents = 0;
  let pureOps = 0;

  while (ticks < options.maxTicks) {
    const perception = buildPerception(world, actorId);
    const out = exec.next(perception);
    if (out.kind === 'done') {
      outcome = out.result.outcome;
      if (out.result.reason !== undefined) reason = out.result.reason;
      intents = out.result.intentsEmitted;
      pureOps = out.result.pureOpsExecuted;
      break;
    }
    const tickEvents = stepWorld(world, [{ actorId, intent: out.intent }]);
    events.push(...tickEvents);
    exec.observe(tickEvents);
    ticks += 1;
    if (options.checkInvariantsEachTick) {
      invariantViolations.push(...checkInvariants(world));
    }
    if (getEntity(world, actorId)?.components.dead) {
      outcome = 'aborted';
      reason = 'actor-died';
      break;
    }
  }
  if (outcome === 'timeout') {
    exec.cancel('timeout');
  }

  const after = getEntity(world, actorId);
  return {
    outcome,
    ...(reason !== undefined ? { reason } : {}),
    ticks,
    intents,
    pureOps,
    events,
    invariantViolations,
    energyDelta: (after?.components.energy?.current ?? 0) - energyBefore,
    damageTaken: healthBefore - (after?.components.health?.current ?? 0),
  };
}
