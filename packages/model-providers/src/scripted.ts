import type { ModelRequest, ModelResponse } from './types.js';
import { BaseModelProvider } from './types.js';

/**
 * Reproduce una secuencia predefinida de respuestas, en orden. Útil para
 * reproducir sesiones exactas en pruebas y para depurar el loop del agente.
 */
export class ScriptedModelProvider extends BaseModelProvider {
  readonly name = 'scripted';
  override readonly interpretsLanguage: boolean;
  private queue: ModelResponse[];

  /**
   * `interpretsLanguage` permite guionar también el camino de un modelo que
   * interpreta el chat completo (por defecto se comporta como determinista).
   */
  constructor(responses: ModelResponse[], options: { interpretsLanguage?: boolean } = {}) {
    super();
    this.queue = [...responses];
    this.interpretsLanguage = options.interpretsLanguage ?? false;
  }

  complete(request: ModelRequest): Promise<ModelResponse> {
    this.recordCall(request.kind);
    const next = this.queue.shift();
    if (!next) {
      return Promise.reject(
        new Error(`ScriptedModelProvider sin respuestas para la petición ${request.kind}`),
      );
    }
    return Promise.resolve(next);
  }

  remaining(): number {
    return this.queue.length;
  }
}
