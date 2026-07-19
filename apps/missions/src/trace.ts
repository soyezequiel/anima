import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ModelProvider, ModelRequest, ModelResponse } from '@anima/model-providers';
import type { StructuredEvent } from '@anima/shared';

/**
 * El cuaderno de bitácora de un intento. Existe por una razón concreta: cuando
 * Ánima no puede con un mapa, la pregunta no es "¿falló?" sino "¿dónde y por
 * qué?", y sin registro esa pregunta se contesta adivinando.
 *
 * Se guarda todo lo que hace falta para reconstruir un intento sin volver a
 * correrlo: qué vio, qué pidió al modelo, qué le contestó el modelo palabra por
 * palabra, qué intención mandó al mundo, qué validó el mundo y con qué motivo,
 * qué cambió, y por qué el juez dio o no por cumplido cada objetivo.
 */
export type TraceEntry = {
  tick: number;
  channel: 'mundo' | 'agente' | 'modelo' | 'mision' | 'percepcion' | 'intencion' | 'nota';
  type: string;
  data: unknown;
};

export class MissionTrace {
  private readonly entries: TraceEntry[] = [];

  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '', 'utf8');
  }

  add(tick: number, channel: TraceEntry['channel'], type: string, data: unknown): void {
    const entry: TraceEntry = { tick, channel, type, data };
    this.entries.push(entry);
    appendFileSync(this.path, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  events(tick: number, channel: TraceEntry['channel'], events: readonly StructuredEvent[]): void {
    for (const event of events) this.add(event.tick ?? tick, channel, event.type, event.data);
  }

  all(): readonly TraceEntry[] {
    return this.entries;
  }

  ofType(type: string): TraceEntry[] {
    return this.entries.filter((e) => e.type === type);
  }
}

/**
 * Envuelve un proveedor para que cada consulta quede escrita: el momento
 * cognitivo, lo que se le preguntó y lo que contestó. Es lo que permite ver
 * "qué habilidad decidió inventar y qué DSL produjo" sin instrumentar el
 * agente por dentro.
 *
 * No altera ninguna respuesta: observa y deja pasar.
 */
export function traced(
  provider: ModelProvider,
  trace: MissionTrace,
  currentTick: () => number,
): ModelProvider {
  return {
    name: provider.name,
    interpretsLanguage: provider.interpretsLanguage,
    callCount: (kind?: ModelRequest['kind']) => provider.callCount(kind),
    async complete(request: ModelRequest): Promise<ModelResponse> {
      const tick = currentTick();
      trace.add(tick, 'modelo', `consulta:${request.kind}`, request);
      const started = Date.now();
      try {
        const response = await provider.complete(request);
        trace.add(tick, 'modelo', `respuesta:${response.kind}`, {
          forRequest: request.kind,
          ms: Date.now() - started,
          response,
        });
        return response;
      } catch (error) {
        trace.add(tick, 'modelo', `error:${request.kind}`, {
          ms: Date.now() - started,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}
