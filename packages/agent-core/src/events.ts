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
  | 'skill.created'
  | 'skill.test.started'
  | 'skill.test.failed'
  | 'skill.test.passed'
  | 'skill.promoted'
  | 'skill.rejected'
  | 'skill.used'
  | 'memory.created'
  | 'memory.consolidated'
  | 'hypothesis.updated'
  | 'guidance.shown'
  | 'help.requested'
  | 'user.message.received'
  | 'user.request.accepted'
  | 'user.request.refused';

export type AgentEvent = StructuredEvent<AgentEventType>;
