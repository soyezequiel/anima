import type { SimEvent, WorldState } from '@anima/sim-core';
import { buildPerception, getEntity, stepWorld } from '@anima/sim-core';
import type { AnimaAgent } from './agent.js';

export interface HarnessOptions {
  maxTicks: number;
  /** Detiene la corrida cuando la condición se cumple. */
  stopWhen?: (world: WorldState, agent: AnimaAgent) => boolean;
  /** Inyecta mensajes del usuario en ticks concretos (para pruebas y demo). */
  userMessagesAt?: Record<number, string>;
  onTick?: (world: WorldState, events: SimEvent[]) => void;
}

export interface HarnessResult {
  ticks: number;
  worldEvents: SimEvent[];
}

/**
 * Driver del mundo real: percibe -> piensa -> actúa -> observa. Es la única
 * pieza que toca a la vez el mundo y el agente; el agente solo ve
 * percepciones.
 */
export async function runAgentInWorld(
  world: WorldState,
  agent: AnimaAgent,
  options: HarnessOptions,
): Promise<HarnessResult> {
  const worldEvents: SimEvent[] = [];
  let ticks = 0;
  for (; ticks < options.maxTicks; ticks++) {
    const message = options.userMessagesAt?.[world.tick];
    if (message !== undefined) agent.receiveUserMessage(message);

    const pet = getEntity(world, agent.petId);
    if (!pet || pet.components.dead) break;

    const perception = buildPerception(world, agent.petId);
    const intent = await agent.think(perception);
    const events = stepWorld(world, intent ? [{ actorId: agent.petId, intent }] : []);
    worldEvents.push(...events);
    agent.observe(events);
    options.onTick?.(world, events);
    if (options.stopWhen?.(world, agent)) {
      ticks += 1;
      break;
    }
  }
  return { ticks, worldEvents };
}
