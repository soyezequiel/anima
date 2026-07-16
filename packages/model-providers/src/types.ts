/**
 * Interfaz neutral hacia modelos de lenguaje. El agente formula peticiones
 * cognitivas estructuradas; los proveedores devuelven respuestas
 * estructuradas. Nada del resto del sistema conoce proveedores concretos.
 *
 * Importante: lo que devuelve un proveedor NUNCA se ejecuta directamente.
 * Los programas propuestos pasan por validación de la DSL y por el evaluador
 * independiente antes de tocar el mundo real.
 */

export type ModelRequest =
  | {
      kind: 'skill.propose';
      skillName: string;
      problem: string;
      /** Observaciones del agente: entidades relevantes, fallos previos. */
      context: string[];
    }
  | {
      kind: 'skill.revise';
      skillName: string;
      previousProgram: unknown;
      failureObservations: string[];
      attempt: number;
    }
  | {
      kind: 'interpret.signal';
      signal: string;
      userMessage?: string;
    }
  | {
      kind: 'dialogue';
      topic: string;
      facts: string[];
      /** Turnos anteriores, del más antiguo al más reciente. */
      history?: { from: 'user' | 'pet'; text: string }[];
    };

export type ModelResponse =
  | { kind: 'skill.program'; program: unknown; rationale: string }
  | { kind: 'interpretation'; hypothesis: string; confidence: number }
  | { kind: 'dialogue'; text: string };

export interface ModelProvider {
  readonly name: string;
  complete(request: ModelRequest): Promise<ModelResponse>;
  /** Cantidad de consultas realizadas, total o por tipo (para pruebas y telemetría). */
  callCount(kind?: ModelRequest['kind']): number;
}

export abstract class BaseModelProvider implements ModelProvider {
  abstract readonly name: string;
  private calls: ModelRequest['kind'][] = [];

  protected recordCall(kind: ModelRequest['kind']): void {
    this.calls.push(kind);
  }

  callCount(kind?: ModelRequest['kind']): number {
    if (!kind) return this.calls.length;
    return this.calls.filter((k) => k === kind).length;
  }

  abstract complete(request: ModelRequest): Promise<ModelResponse>;
}
