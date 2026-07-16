import type { StructuredEvent } from '@anima/shared';

export type AgentEventType =
  | 'goal.created'
  | 'goal.selected'
  | 'goal.completed'
  | 'goal.suspended'
  | 'goal.reactivated'
  | 'strategy.selected'
  | 'strategy.failed'
  | 'strategy.forbidden'
  | 'skill.requested'
  /** Contrato acordado con el cuidador antes de intentar aprender algo. */
  | 'skill.contract.agreed'
  | 'skill.created'
  | 'skill.test.started'
  | 'skill.test.failed'
  | 'skill.test.passed'
  | 'skill.promoted'
  | 'skill.rejected'
  | 'skill.used'
  /** Se le ocurrió un objeto que su mundo no sabía construir. */
  | 'recipe.proposed'
  /** El mundo aceptó su invento: la física ahora lo admite. */
  | 'recipe.learned'
  /** El mundo lo rechazó, con el motivo. Imaginarlo no lo vuelve posible. */
  | 'recipe.rejected'
  | 'memory.created'
  | 'memory.consolidated'
  | 'hypothesis.updated'
  | 'guidance.shown'
  | 'legacy.read'
  | 'help.requested'
  | 'provider.error'
  | 'user.message.received'
  | 'user.request.accepted'
  | 'user.request.refused'
  /** Repensó una negativa de valores con su situación concreta (ADR 0019). */
  | 'judgement.made'
  /** Se apartó de algo que la estaba dañando. Reflejo del cuerpo, no decisión. */
  | 'pain.reflex';

export type AgentEvent = StructuredEvent<AgentEventType>;
