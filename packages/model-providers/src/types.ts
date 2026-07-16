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
      /** Criterios que el evaluador medirá: el programa debe satisfacerlos. */
      successCriteria?: string[];
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
      /** Habilidades ya aprendidas: el catálogo ejecutable no es fijo. */
      skills?: { name: string; description: string }[];
      /** Lo que este mundo admite construir: sin esto, "craft-item" no existe. */
      recipes?: { id: string; ingredients: string }[];
    }
  | {
      /**
       * Traduce lo que el cuidador quiere enseñar a un contrato evaluable.
       * Es un momento cognitivo aparte del que propone el programa: primero
       * hay que acordar qué significaría lograrlo, y recién después intentarlo.
       */
      kind: 'skill.contract';
      request: string;
      conversation: { from: 'user' | 'pet'; text: string }[];
      facts: string[];
    }
  | {
      /** Destila una afirmación didáctica del cuidador a un enunciado guardable. */
      kind: 'distill.knowledge';
      text: string;
      conversation: { from: 'user' | 'pet'; text: string }[];
    }
  | {
      /**
       * Inventar un objeto que su mundo todavía no sabe construir. El modelo
       * propone el arquetipo; el mundo lo valida y decide. Proponer no es
       * poder: la física no la escribe quien la imagina.
       */
      kind: 'recipe.propose';
      /** Para qué lo necesita: el problema, no la solución. */
      problem: string;
      /** Materiales que existen a su alcance. */
      materials: string[];
      /** Recetas que ya existen: no tiene sentido reinventarlas. */
      existingRecipes: string[];
      /** Rechazos previos del mundo: por qué su idea anterior no era posible. */
      rejections?: string[];
    }
  | {
      kind: 'dialogue';
      topic: string;
      facts: string[];
      /** Turnos anteriores, del más antiguo al más reciente. */
      history?: { from: 'user' | 'pet'; text: string }[];
    };

/**
 * Contrato propuesto para una habilidad que el cuidador pidió enseñar. El
 * modelo traduce la conversación; el agente valida los criterios y el
 * evaluador determinista sigue siendo el único que juzga si el programa los
 * cumple. Proponer el contrato no es aprobarse a sí mismo: fija de antemano
 * la vara con la que otro lo va a medir, y esa vara queda a la vista.
 */
export interface ProposedSkillContract {
  name: string;
  purpose: string;
  expectedOutcome: string;
  successCriteria: unknown;
}

export type ModelResponse =
  | { kind: 'skill.program'; program: unknown; rationale: string }
  | { kind: 'interpretation'; hypothesis: string; confidence: number }
  | { kind: 'command.interpretation'; command: CommandInterpretation }
  | { kind: 'skill.contract'; contract: ProposedSkillContract }
  | { kind: 'knowledge'; statement: string; confidence: number }
  /** La receta viaja sin tipar: el mundo es quien la valida (validateRecipe). */
  | { kind: 'recipe'; recipe: unknown; rationale: string }
  | { kind: 'dialogue'; text: string };

export type CommandDirection = 'up' | 'down' | 'left' | 'right';

/**
 * El modelo interpreta lenguaje, pero solo puede elegir este catálogo. El
 * agente vuelve a validar y decide de forma independiente si ejecuta.
 *
 * El catálogo tiene una parte fija (las acciones primitivas) y una abierta:
 * `run-skill` invoca lo que la mascota haya aprendido, y `learn-skill` abre el
 * ciclo para lo que todavía no sabe. Sin esas dos, todo lo que el cuidador
 * enseñe muere en el momento en que lo dice.
 */
export type CommandInterpretation =
  | { action: 'destroy-entity'; targetKind: string }
  | { action: 'fetch-item'; targetKind: string }
  | { action: 'consume-item'; targetKind: string }
  | { action: 'wait-here' }
  | { action: 'move-direction'; directions: CommandDirection[] }
  /** Ejecutar una habilidad ya aprendida, por su nombre. */
  | { action: 'run-skill'; skillName: string }
  /** Construir algo que su mundo admite, por el id de la receta. */
  | { action: 'craft-item'; recipeId: string }
  /** Conducta que no tiene pero que sus primitivas podrían componer. */
  | { action: 'learn-skill'; summary: string }
  /** El cuidador enseña un hecho del mundo (afirmación, no orden ni pregunta). */
  | { action: 'explanation' }
  /** Orden física fuera del alcance de sus primitivas. */
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
