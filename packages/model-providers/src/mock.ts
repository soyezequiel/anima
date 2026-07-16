import type { SkillProgram } from '@anima/skill-runtime';
import type { ModelRequest, ModelResponse } from './types.js';
import { BaseModelProvider } from './types.js';

/**
 * Proveedor completamente determinista para desarrollo y pruebas. Simula un
 * generador imperfecto: su primera propuesta de habilidad contiene un error
 * plausible (elegir la herramienta más cercana en lugar de la más capaz) y
 * solo lo corrige cuando el informe de fallos le muestra la evidencia.
 *
 * Esto es deliberado: el ciclo cerrado de desarrollo de habilidades debe
 * demostrar que una v1 defectuosa se rechaza y una v2 corregida se promueve,
 * sin que el generador sea juez de su propio trabajo.
 */
export class MockModelProvider extends BaseModelProvider {
  readonly name = 'mock';

  complete(request: ModelRequest): Promise<ModelResponse> {
    this.recordCall(request.kind);
    switch (request.kind) {
      case 'skill.propose':
        return Promise.resolve({
          kind: 'skill.program',
          program: reachBlockedResourceProgram('nearest'),
          rationale:
            'Ir hacia el alimento; si el camino se bloquea, tomar la herramienta más cercana y golpear el muro hasta abrir paso.',
        });
      case 'skill.revise': {
        const sawNoDamage = request.failureObservations.some((o) =>
          o.startsWith('no-damage-dealt'),
        );
        if (sawNoDamage) {
          return Promise.resolve({
            kind: 'skill.program',
            program: reachBlockedResourceProgram('strongestTool'),
            rationale:
              'La herramienta cercana no causó daño: la dureza del muro supera su poder. Elegir la herramienta más poderosa en lugar de la más cercana.',
          });
        }
        return Promise.resolve({
          kind: 'skill.program',
          program: reachBlockedResourceProgram('nearest', { moreAttempts: true }),
          rationale: 'Reintentar con más golpes por si faltó persistencia.',
        });
      }
      case 'interpret.signal':
        if (request.signal === 'energy-low') {
          const guided = request.userMessage === undefined;
          return Promise.resolve({
            kind: 'interpretation',
            hypothesis: 'consumir alimento recupera energía',
            confidence: guided ? 0.5 : 0.65,
          });
        }
        return Promise.resolve({
          kind: 'interpretation',
          hypothesis: `la señal ${request.signal} indica algo que aún no comprendo`,
          confidence: 0.3,
        });
      case 'interpret.command':
        // Las órdenes frecuentes ya pasan por el parser determinista local.
        // El mock no simula comprensión abierta: conserva el modo sin IA.
        return Promise.resolve({
          kind: 'command.interpretation',
          command: { action: 'not-command' },
        });
      case 'skill.contract':
        // Derivar un contrato exige entender lenguaje abierto. Fingirlo con
        // reglas daría contratos falsos y habilidades "aprendidas" que no son
        // lo que el cuidador pidió: es más honesto no saber.
        return Promise.reject(
          new Error('el proveedor simulado no deriva contratos de habilidades'),
        );
      case 'distill.knowledge':
        // Sin comprensión abierta, guarda la enseñanza tal cual la recibió.
        return Promise.resolve({
          kind: 'knowledge',
          statement: request.text,
          confidence: 0.6,
        });
      case 'dialogue': {
        const topic = request.topic
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '');
        if (/\b(hola|buenas|hey)\b/.test(topic)) {
          return Promise.resolve({
            kind: 'dialogue',
            text: '¡Hola! Me alegra que estés aquí. Estoy explorando y aprendiendo este mundo.',
          });
        }
        if (/\b(bien|genial|buenisimo|excelente|bravo)\b/.test(topic)) {
          return Promise.resolve({
            kind: 'dialogue',
            text: '¡Gracias! Voy a seguir aprendiendo.',
          });
        }
        if (/\b(como estas|como te sentis|como te sientes)\b/.test(topic)) {
          return Promise.resolve({
            kind: 'dialogue',
            text:
              request.facts.find((fact) => fact.includes('energía actual')) ??
              'Estoy bien y con curiosidad.',
          });
        }
        return Promise.resolve({
          kind: 'dialogue',
          text:
            request.facts.length > 0
              ? `Te escucho. ${request.facts[0]}.`
              : 'Te escucho. Todavía sé poco, pero me gusta que me hables.',
        });
      }
    }
  }
}

/**
 * Programa canónico "alcanzar un recurso bloqueado". La variante `nearest`
 * es la propuesta inicial defectuosa; `strongestTool` es la corrección.
 */
export function reachBlockedResourceProgram(
  toolStrategy: 'nearest' | 'strongestTool',
  options: { moreAttempts?: boolean } = {},
): SkillProgram {
  return [
    { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
    { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
    { op: 'moveToward', target: 'food', maxSteps: 30 },
    {
      op: 'branch',
      if: { type: 'lastMoveBlocked' },
      then: [
        { op: 'findEntities', query: { tool: true }, store: 'tools' },
        { op: 'selectTarget', from: 'tools', strategy: toolStrategy, store: 'tool' },
        { op: 'moveToward', target: 'tool', maxSteps: 30 },
        { op: 'pickup', target: 'tool' },
        { op: 'findEntities', query: { kind: 'wall' }, store: 'walls' },
        { op: 'selectTarget', from: 'walls', strategy: 'nearest', store: 'wall' },
        { op: 'moveToward', target: 'wall', maxSteps: 30 },
        {
          op: 'repeatWithLimit',
          max: options.moreAttempts ? 12 : 6,
          until: { type: 'entityGone', ref: 'wall' },
          body: [{ op: 'useItem', item: 'tool', target: 'wall' }],
        },
        { op: 'moveToward', target: 'food', maxSteps: 30 },
      ],
    },
    { op: 'consume', target: 'food' },
  ];
}
