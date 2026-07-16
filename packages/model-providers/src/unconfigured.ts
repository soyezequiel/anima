import type { ModelRequest, ModelResponse } from './types.js';
import { BaseModelProvider } from './types.js';

/**
 * Adaptador vacío para un modelo real. Existe para fijar el punto de
 * extensión sin acoplar el sistema a ningún proveedor: la integración real
 * (Fase 9) implementará esta misma interfaz leyendo credenciales del entorno
 * del usuario, nunca del repositorio.
 */
export class UnconfiguredModelProvider extends BaseModelProvider {
  readonly name = 'unconfigured';

  complete(request: ModelRequest): Promise<ModelResponse> {
    this.recordCall(request.kind);
    return Promise.reject(
      new Error(
        `No hay un modelo real configurado (petición: ${request.kind}). ` +
          'Usa MockModelProvider o ScriptedModelProvider, o implementa un adaptador en @anima/model-providers.',
      ),
    );
  }
}
