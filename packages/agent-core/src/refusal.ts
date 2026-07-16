import type { Perception } from '@anima/sim-core';
import type { MemoryStore } from '@anima/memory';
import type { Goal } from './goals.js';

/**
 * Peticiones del usuario ya interpretadas a una forma estructurada.
 * (El parseo de lenguaje natural es responsabilidad del proveedor de modelo
 * o de un parser simple; la decisión de aceptar o negarse es del agente.)
 */
export type UserRequest =
  | { kind: 'destroy-entity'; targetKind: string; raw: string }
  | { kind: 'fetch-item'; targetKind: string; raw: string }
  | { kind: 'wait-here'; raw: string }
  | { kind: 'unknown'; raw: string };

export type RequestClassification =
  | 'accepted'
  | 'cannot'
  | 'will_not'
  | 'not_now'
  | 'needs_information';

export interface RequestDecision {
  classification: RequestClassification;
  reason: string;
  alternative?: string;
}

const CRITICAL_ENERGY_FRACTION = 0.2;

/**
 * Decide si aceptar, posponer o rechazar una petición. Cada negativa tiene
 * una razón comprensible, coherente con lo que la mascota sabe y quiere, y
 * ofrece una alternativa cuando existe.
 */
export function evaluateUserRequest(
  request: UserRequest,
  perception: Perception,
  memory: MemoryStore,
  currentGoal: Goal | undefined,
): RequestDecision {
  if (request.kind === 'unknown') {
    return {
      classification: 'needs_information',
      reason: 'No entiendo qué me pides; ¿puedes decirlo de otra forma?',
    };
  }

  const energy = perception.self.energy;
  const energyCritical = energy !== undefined && energy.current / energy.max < CRITICAL_ENERGY_FRACTION;
  const relatedToFood =
    request.kind === 'fetch-item' && request.targetKind === 'food';

  // Una prioridad más urgente manda: con energía crítica solo atiende comida.
  if (energyCritical && !relatedToFood && currentGoal?.source === 'internal-signal') {
    return {
      classification: 'not_now',
      reason: 'Mi energía está demasiado baja; primero necesito recuperarla.',
      alternative: 'Puedo intentarlo en cuanto haya comido.',
    };
  }

  switch (request.kind) {
    case 'wait-here':
      return { classification: 'accepted', reason: 'Puedo esperar aquí un momento.' };

    case 'destroy-entity': {
      // Se niega a destruir lo que cree que necesita (valores aprendidos).
      const believesNeeded =
        request.targetKind === 'food' ||
        memory
          .factList()
          .some(
            (f) =>
              f.statement.includes(request.targetKind) &&
              (f.statement.includes('produce') || f.statement.includes('recupera')),
          );
      if (believesNeeded) {
        return {
          classification: 'will_not',
          reason: `No quiero destruir ${request.targetKind}: creo que lo necesito para recuperar energía.`,
          alternative: 'Puedo buscar otro objeto que destruir o recolectar algo caído.',
        };
      }
      const visibleTarget = perception.visibleEntities.some((e) => e.kind === request.targetKind);
      if (!visibleTarget) {
        return {
          classification: 'needs_information',
          reason: `No veo ningún ${request.targetKind} desde aquí.`,
          alternative: '¿Puedes mostrarme dónde está?',
        };
      }
      const hasAnyTool =
        perception.self.heldItems.some((e) => e.toolPower !== undefined) ||
        perception.visibleEntities.some((e) => e.toolPower !== undefined);
      if (!hasAnyTool) {
        return {
          classification: 'cannot',
          reason: `No tengo ninguna herramienta capaz de dañar ese ${request.targetKind}.`,
          alternative: 'Si me consigues una herramienta fuerte, puedo intentarlo.',
        };
      }
      return { classification: 'accepted', reason: `Voy a intentar destruir ese ${request.targetKind}.` };
    }

    case 'fetch-item': {
      const visible = perception.visibleEntities.some((e) => e.kind === request.targetKind);
      const remembered = memory.retrieve(request.targetKind, 3);
      if (!visible && remembered.episodes.length === 0 && remembered.facts.length === 0) {
        return {
          classification: 'needs_information',
          reason: `No sé dónde encontrar ${request.targetKind}.`,
          alternative: '¿Puedes darme una pista de dónde buscar?',
        };
      }
      return { classification: 'accepted', reason: `Voy a buscar ${request.targetKind}.` };
    }
  }
}

/** Parser mínimo de mensajes del usuario para el chat del MVP. */
export function parseUserMessage(text: string): UserRequest | { kind: 'explanation'; raw: string } {
  const lower = text.toLowerCase();
  const kindWord = (): string => {
    for (const kind of ['comida', 'alimento', 'food', 'muro', 'pared', 'wall', 'rama', 'branch', 'martillo', 'hammer', 'árbol', 'tree']) {
      if (lower.includes(kind)) {
        const map: Record<string, string> = {
          comida: 'food', alimento: 'food', food: 'food',
          muro: 'wall', pared: 'wall', wall: 'wall',
          rama: 'branch', branch: 'branch',
          martillo: 'hammer', hammer: 'hammer',
          'árbol': 'tree', tree: 'tree',
        };
        return map[kind] ?? kind;
      }
    }
    return 'unknown';
  };
  if (/(destruye|rompe|derriba)/.test(lower)) {
    return { kind: 'destroy-entity', targetKind: kindWord(), raw: text };
  }
  if (/(trae|busca|recoge)/.test(lower)) {
    return { kind: 'fetch-item', targetKind: kindWord(), raw: text };
  }
  if (/(espera|quédate)/.test(lower)) {
    return { kind: 'wait-here', raw: text };
  }
  if (/(energ|comida|alimento|comer)/.test(lower)) {
    return { kind: 'explanation', raw: text };
  }
  return { kind: 'unknown', raw: text };
}
