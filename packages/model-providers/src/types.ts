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
      kind: 'interpret.command';
      text: string;
      facts: string[];
      /** Turnos anteriores para resolver referencias como "eso" o "allá". */
      history?: { from: 'user' | 'pet'; text: string }[];
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
  | { kind: 'command.interpretation'; command: CommandInterpretation }
  | { kind: 'dialogue'; text: string };

export type CommandDirection = 'up' | 'down' | 'left' | 'right';

/**
 * El modelo interpreta lenguaje, pero solo puede elegir este catálogo. El
 * agente vuelve a validar y decide de forma independiente si ejecuta.
 */
export type CommandInterpretation =
  | { action: 'destroy-entity'; targetKind: string }
  | { action: 'fetch-item'; targetKind: string }
  | { action: 'consume-item'; targetKind: string }
  | { action: 'wait-here' }
  | { action: 'move-direction'; directions: CommandDirection[] }
  /** El cuidador enseña un hecho del mundo (afirmación, no orden ni pregunta). */
  | { action: 'explanation' }
  | { action: 'unsupported'; summary: string }
  | { action: 'not-command' };

export interface ModelProvider {
  readonly name: string;
  /**
   * true si el proveedor entiende lenguaje natural y puede clasificar
   * cualquier mensaje con `interpret.command`. Cuando lo es, el agente le
   * cede la interpretación completa del chat y el parser determinista queda
   * solo como red de seguridad ante fallos. Los proveedores deterministas
   * (mock, scripted) devuelven false: para ellos manda el parser.
   */
  readonly interpretsLanguage: boolean;
  complete(request: ModelRequest): Promise<ModelResponse>;
  /** Cantidad de consultas realizadas, total o por tipo (para pruebas y telemetría). */
  callCount(kind?: ModelRequest['kind']): number;
}

export abstract class BaseModelProvider implements ModelProvider {
  abstract readonly name: string;
  readonly interpretsLanguage: boolean = false;
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
