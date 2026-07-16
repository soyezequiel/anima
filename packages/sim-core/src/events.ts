import type { StructuredEvent } from '@anima/shared';

export type SimEventType =
  | 'action.requested'
  | 'action.resolved'
  | 'entity.moved'
  | 'entity.damaged'
  | 'entity.destroyed'
  | 'item.pickedUp'
  | 'item.dropped'
  | 'item.consumed'
  | 'item.crafted'
  | 'tool.broke'
  | 'agent.spoke'
  | 'entity.spawned'
  | 'energy.low'
  | 'energy.depleted'
  | 'temperature.low'
  | 'temperature.depleted'
  | 'pet.died';

export type SimEvent = StructuredEvent<SimEventType>;

export function simEvent(
  type: SimEventType,
  tick: number,
  data: Record<string, unknown>,
): SimEvent {
  return { type, tick, data };
}
