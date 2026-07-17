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
 *
 * La imperfección se puede apagar (`imperfect: false`, o `setImperfect` en
 * vivo desde los ajustes de la UI): el mock propone entonces directamente la
 * idea corregida. Es un modo de observación —ver el mundo sin el desvío del
 * error— y por eso el DEFAULT es imperfecto: los tests y la historia del
 * producto (fallar, ser corregida, aprender) dependen de que el primer
 * intento se equivoque (ADR 0006, adenda).
 */
export class MockModelProvider extends BaseModelProvider {
  readonly name = 'mock';
  private imperfect: boolean;

  constructor(options: { imperfect?: boolean } = {}) {
    super();
    this.imperfect = options.imperfect ?? true;
  }

  /** Enciende o apaga las primeras ideas equivocadas, en vivo. */
  setImperfect(value: boolean): void {
    this.imperfect = value;
  }

  isImperfect(): boolean {
    return this.imperfect;
  }

  complete(request: ModelRequest): Promise<ModelResponse> {
    this.recordCall(request.kind);
    switch (request.kind) {
      case 'skill.propose':
        // Sin imperfección, la primera propuesta ya es la corregida: elegir
        // la herramienta más capaz, no la más cercana.
        return Promise.resolve({
          kind: 'skill.program',
          program: reachBlockedResourceProgram(this.imperfect ? 'nearest' : 'strongestTool'),
          rationale: this.imperfect
            ? 'Ir hacia el alimento; si el camino se bloquea, tomar la herramienta más cercana y golpear el muro hasta abrir paso.'
            : 'Ir hacia el alimento; si el camino se bloquea, tomar la herramienta más poderosa y golpear el muro hasta abrir paso.',
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
        if (request.signal === 'health-low') {
          // El mismo trato que la temperatura: la señal del cuerpo se traduce
          // a una hipótesis accionable, no a un diagnóstico.
          return Promise.resolve({
            kind: 'interpretation',
            hypothesis: 'alejarme de lo que me hace daño detiene el dolor',
            confidence: 0.65,
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
      case 'entity.describe':
        // Traducir una descripción libre a una receta exige entender lenguaje
        // abierto. Fingirlo con reglas produciría objetos que no son lo que el
        // cuidador describió: es más honesto no saber, como con los contratos.
        return Promise.reject(
          new Error('el proveedor simulado no traduce descripciones'),
        );
      case 'interaction.propose':
        // Inventar una interacción exige imaginar la lógica de las cosas, y el
        // mock no la tiene. Como con las descripciones (ADR 0006): fingirlo
        // con reglas produciría interacciones que nadie pidió.
        return Promise.reject(
          new Error('el proveedor simulado no inventa interacciones'),
        );
      case 'interaction.judge':
        // Sin comprensión abierta no hay juez: nada entra. Es el lado seguro —
        // la IA Dios existe justamente para que este poder no ande sin ella.
        return Promise.reject(
          new Error('el proveedor simulado no puede juzgar la lógica de una interacción'),
        );
      case 'distill.knowledge':
        // Sin comprensión abierta, guarda la enseñanza tal cual la recibió.
        return Promise.resolve({
          kind: 'knowledge',
          statement: request.text,
          confidence: 0.6,
        });
      case 'judge.destruction':
        // Sin comprensión abierta no hay juicio: se niega, como siempre. Es la
        // conducta anterior a este cambio, y es la honesta — pesar "¿me quedo
        // sin comida?" con reglas fijas es justo lo que no alcanzaba.
        return Promise.resolve({
          kind: 'judgement',
          willing: false,
          reason: `No quiero destruir ${request.targetKind}: creo que lo necesito.`,
        });
      case 'recipe.propose': {
        // Imperfecto a propósito, como el resto del mock (ADR 0006): su primer
        // impulso ante cualquier problema es inventar comida — el atajo que
        // resolvería todo declarándolo resuelto. El mundo lo rechaza, y solo
        // entonces propone algo honesto. Con la imperfección apagada, el atajo
        // se saltea y la primera idea ya es la honesta.
        const scolded = this.imperfect ? (request.rejections?.length ?? 0) : 1;
        // Cuando el cuidador nombró lo que quiere, la idea lleva ESE nombre:
        // bautizarla distinto dejaría la petición sin su receta.
        const id = request.wantedId ?? (scolded === 0 ? 'bocado' : 'hoguera-simple');
        if (scolded === 0) {
          return Promise.resolve({
            kind: 'recipe',
            recipe: {
              id,
              output: { kind: id, components: { edible: {}, nutrition: { value: 30 } } },
              ingredients: [{ kind: 'log', count: 1 }],
            },
            rationale: 'Si convierto un tronco en algo comestible, dejo de tener problemas.',
          });
        }
        // Su segunda idea es honesta. Con un nombre pedido por el cuidador no
        // finge entenderlo: no sabe qué es una casa, sabe apilar troncos, y
        // propone lo más parecido que sus materiales permiten de verdad.
        if (request.wantedId) {
          return Promise.resolve({
            kind: 'recipe',
            recipe: {
              id,
              output: {
                kind: id,
                components: {
                  collider: { solid: true },
                  hardness: { value: 2 },
                  durability: { current: 6, max: 6 },
                  drops: [{ kind: 'log', components: { portable: {} } }],
                },
              },
              ingredients: [{ kind: 'log', count: 2 }],
            },
            rationale: 'No sé bien qué es, pero con dos troncos puedo apilar algo sólido.',
          });
        }
        return Promise.resolve({
          kind: 'recipe',
          recipe: {
            id,
            output: {
              kind: id,
              components: {
                heatSource: { warmthPerTick: 0.4, range: 2 },
                hazard: { damagePerTick: 1 },
              },
            },
            ingredients: [{ kind: 'log', count: 2 }],
          },
          rationale: 'La madera arde: dos troncos deberían dar calor un buen rato.',
        });
      }
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
        if (/\b(como te llamas|como te llamo|cual es tu nombre|tu nombre)\b/.test(topic)) {
          const nameFact = request.facts.find((fact) => fact.startsWith('me llamo'));
          return Promise.resolve({
            kind: 'dialogue',
            text: nameFact
              ? `${nameFact.charAt(0).toUpperCase()}${nameFact.slice(1)}.`
              : 'Todavía no tengo un nombre claro. ¡Ponéme uno!',
          });
        }
        if (/\b(te acordas|te acuerdas|recordas|recuerdas|que recordas|que recuerdas)\b/.test(topic)) {
          // Referencia determinista a un recuerdo real: el mock no inventa
          // memoria, repite la que viaja en los hechos del prompt.
          const memoryFact = request.facts.find((fact) => fact.startsWith('recuerdo que'));
          return Promise.resolve({
            kind: 'dialogue',
            text: memoryFact
              ? `Sí: ${memoryFact}.`
              : 'Todavía no tenemos muchos recuerdos juntos, pero los vamos a ir haciendo.',
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
