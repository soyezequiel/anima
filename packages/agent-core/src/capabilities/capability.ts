import type { Result } from '@anima/shared';
import type { Perception } from '@anima/sim-core';
import type { SkillProgram } from '@anima/skill-runtime';
import type { CausalCondition, CausalEffect } from '../causal-planner.js';
import type { GoalCondition } from '../goal-conditions.js';
import type { CapabilityDeps } from './deps.js';

/**
 * El contrato uniforme de todo lo que Ánima sabe hacer.
 *
 * Antes de esto, cada operación del mundo estaba escrita cinco veces: como
 * `action` del intérprete de chat, como `kind` de petición, como fragmento de
 * DSL cocido a mano dentro de un `switch`, como `metadata.kind` de una acción
 * causal y como intención del motor. Agregar una capacidad significaba tocar
 * cinco archivos y, como no había una lista canónica, el prompt que le dice al
 * modelo qué se puede pedir podía desincronizarse del código sin que nada
 * fallara.
 *
 * Una capacidad reúne las cinco caras en un solo objeto: cómo se nombra, qué
 * argumentos admite, qué exige el mundo antes, qué promete después, cuánto
 * cuesta, cuánto arriesga, en qué DSL se compila y —lo que faltaba— CÓMO SE
 * COMPRUEBA contra el mundo cuando terminó. Esa última pieza es la que
 * convierte «ejecuté el programa» en «el efecto ocurrió», que no es lo mismo
 * (ADR 0059) y es la diferencia entre un fracaso observado y una falsa
 * finalización.
 *
 * Lo que NO es: una capacidad no toca el mundo. Compila a la DSL acotada y el
 * motor sigue siendo la única autoridad. Nada de lo que se declare acá —ni el
 * efecto, ni la precondición— se da por cierto sin que la percepción lo diga.
 */

/**
 * Cuánto pesa equivocarse. Gobierna la política de validación: no todo merece
 * la misma ceremonia, y tratar igual a «caminar un paso» que a «demoler un
 * muro» es lo que hacía que cualquier cosa costara cuarenta mundos imaginados.
 */
export type CapabilityRisk =
  /** Se deshace sola o no deja rastro: caminar, mirar, hablar, esperar. */
  | 'reversible'
  /** Gasta materia o durabilidad, pero nada se pierde para siempre. */
  | 'consuming'
  /** Destruye o transforma sin vuelta atrás: talar, romper, consumir. */
  | 'irreversible'
  /** Cambia las reglas del mundo (receta, interacción, plano, descomposición). */
  | 'world-rule';

/** Qué hace falta para dejar pasar una capacidad de cada nivel de riesgo. */
export interface RiskPolicy {
  /** Validación estructural del programa compilado. Siempre. */
  structural: true;
  /** Comprobar el efecto contra el mundo después de ejecutar. */
  verifyAgainstWorld: boolean;
  /** Correr el paso contra la foto actual del mundo antes de comprometerse. */
  canaryOnSnapshot: boolean;
  /** Pedirle permiso explícito al cuidador antes de ejecutar. */
  requiresConfirmation: boolean;
  /** Pasar por la puerta semántica del juez (la «IA Dios») antes de proponer. */
  requiresSemanticGate: boolean;
}

export const RISK_POLICY: Record<CapabilityRisk, RiskPolicy> = {
  reversible: {
    structural: true,
    verifyAgainstWorld: true,
    canaryOnSnapshot: false,
    requiresConfirmation: false,
    requiresSemanticGate: false,
  },
  consuming: {
    structural: true,
    verifyAgainstWorld: true,
    canaryOnSnapshot: true,
    requiresConfirmation: false,
    requiresSemanticGate: false,
  },
  irreversible: {
    structural: true,
    verifyAgainstWorld: true,
    canaryOnSnapshot: true,
    requiresConfirmation: true,
    requiresSemanticGate: false,
  },
  'world-rule': {
    structural: true,
    verifyAgainstWorld: true,
    canaryOnSnapshot: true,
    requiresConfirmation: true,
    requiresSemanticGate: true,
  },
};

/** Todo lo que una capacidad necesita saber del mundo y de la mascota. */
export interface CapabilityContext {
  perception: Perception;
  deps: CapabilityDeps;
  /**
   * Cuánto de cada tipo prometieron los pasos ANTERIORES de este mismo plan.
   *
   * Sin esto, dos pasos iguales del mismo plan capturan la misma línea de base
   * —la percepción de cuando se planificó— y el segundo nace ya cumplido: se la
   * vio recoger un tronco, saltear el paso del segundo por «ya sostengo uno» y
   * llegar al final con la mitad de lo que le pidieron. La cuenta sale de los
   * `effects` que cada capacidad ya declara, así que no hay una segunda verdad
   * que mantener sincronizada.
   */
  plannedGains?: ReadonlyMap<string, number>;
}

/**
 * Un parámetro declarado. Existe para dos cosas que no se pueden hacer con
 * tipos de TypeScript solos: validar en runtime lo que llega de un modelo, y
 * DESCRIBIR el catálogo para que el prompt del intérprete se genere del código
 * en vez de repetirlo a mano.
 */
export interface CapabilityParam {
  name: string;
  type: 'kind' | 'entity-id' | 'recipe-id' | 'blueprint-id' | 'interaction-id' | 'skill-name'
    | 'count' | 'text' | 'direction-list' | 'placement' | 'spatial-grounding' | 'flag';
  required: boolean;
  description: string;
}

/**
 * Cuando una capacidad no puede aplicarse, por qué. Es dato y no texto libre
 * porque el llamador decide cosas distintas según el caso: lo que falta se
 * puede ir a buscar, lo que no existe hay que decirlo, y lo que está mal
 * escrito es culpa de quien llamó.
 */
export type CapabilityBlock =
  /** El mundo no ofrece lo que hace falta (no hay receta, no hay interacción). */
  | { reason: 'unknown-in-world'; detail: string }
  /** Falta materia o herramienta; se puede salir a conseguirla. */
  | { reason: 'missing-material'; kinds: string[] }
  /** No hay dónde: sitio ocupado, celda inalcanzable. */
  | { reason: 'no-place'; detail: string }
  /** Los argumentos no describen nada ejecutable. */
  | { reason: 'bad-arguments'; detail: string };

/** Lo que una capacidad devuelve al pedirle su forma ejecutable. */
export type CapabilityCompilation =
  | { ok: true; program: SkillProgram }
  | { ok: false; block: CapabilityBlock };

/** Una salida cuando el paso falla: qué otra capacidad probar y con qué. */
export interface CapabilityRecovery {
  capabilityId: string;
  args: Record<string, unknown>;
  /** Qué se espera ganar con el rodeo, en una frase. */
  rationale: string;
}

export interface Capability<A = Record<string, unknown>> {
  /** Identificador semántico y estable: `item.pickup`, `craft.recipe`. */
  id: string;
  /** Qué hace, en una frase. Va al prompt del intérprete y al chat. */
  summary: string;
  params: CapabilityParam[];
  risk: CapabilityRisk;

  /**
   * Valida y normaliza argumentos que pueden venir de un modelo. Nada entra al
   * plan sin pasar por acá: un `targetKind` inventado o un `amount` de mil no
   * llegan nunca a compilarse.
   */
  ground(raw: unknown, context: CapabilityContext): Result<A>;

  /** Cuánto cuesta, en la misma moneda que usa el planificador causal. */
  cost(args: A, context: CapabilityContext): number;

  /**
   * Qué tiene que ser cierto antes, en el lenguaje del planner. Se declara
   * aunque la ejecución sea contingente: el mundo revalida igual, pero
   * declararlo permite encadenar capacidades sin ejecutarlas.
   */
  preconditions(args: A, context: CapabilityContext): CausalCondition[];

  /** Qué promete cambiar. Nunca `known` si quien lo afirma es un modelo. */
  effects(args: A, context: CapabilityContext): CausalEffect[];

  /** Cómo se ejecuta: la DSL acotada, nunca código. */
  compile(args: A, context: CapabilityContext): CapabilityCompilation;

  /**
   * Cómo se comprueba desde el mundo. Devuelve un predicado del álgebra cerrada
   * de `goal-conditions`, evaluado contra la percepción FRESCA de después. Se
   * construye con la percepción de ANTES porque muchos efectos son relativos
   * («una tabla más de las que ya tenía»): capturar la línea de base al
   * planificar es lo que hace que «traé otro tronco» signifique otro y no el
   * que ya llevaba en la mano.
   *
   * `null` significa algo preciso y no es una excusa: este paso no tiene un
   * predicado PROPIO que lo distinga del mundo alrededor. Romper «un árbol»
   * es el caso claro — con un bosque delante, «ya no hay árboles» no es lo que
   * se pidió, y el ejemplar concreto que cayó lo eligió el intérprete en
   * tiempo de ejecución y lo ligó el motor por evento. Ahí la autoridad es la
   * condición del objetivo, que sí conoce esa ligadura. Declararlo `null` es
   * decir la verdad; inventar un predicado que se cumple solo sería peor que
   * no tener ninguno, porque el paso se saltearía sin ejecutarse.
   */
  verify(args: A, context: CapabilityContext): GoalCondition | null;

  /** Qué probar si el mundo dijo que no. Vacío significa «no hay rodeo». */
  recover?(args: A, block: CapabilityBlock, context: CapabilityContext): CapabilityRecovery[];

  /**
   * ¿Este fracaso se arregla MIRANDO DE NUEVO?
   *
   * Hay dos clases de «no salió» y confundirlas cuesta caro en los dos
   * sentidos. Una dice que el mundo se movió: el tronco al que iba ya no está,
   * el camino que había se cerró. Eso se resuelve replanificando con la
   * percepción de ahora, y llevárselo al cuidador como un fracaso sería
   * rendirse teniendo dos troncos nuevos a la vista.
   *
   * La otra es un diagnóstico físico: el objetivo es inmune, la herramienta no
   * hace mella, no hay sitio donde levantar la obra. Volver a mirar no cambia
   * nada, y el agente tiene maquinaria para atenderlo —fabricar algo más
   * fuerte, inventar, pedir ayuda— que replanificar en el medio se comería.
   *
   * Quien sabe cuál es cuál es la capacidad, no el executor: por eso vive acá y
   * no en una lista de motivos escrita en otro archivo. Sin declararlo, ningún
   * fracaso se reintenta, que es como se comportaba todo hasta ahora.
   */
  retriable?(reason: string | undefined, args: A, context: CapabilityContext): boolean;

  /**
   * Frase breve para el chat: «voy a buscar un tronco». Es lo que el cuidador
   * ve como progreso, así que se dice en primera persona y sin jerga.
   */
  describe(args: A, context: CapabilityContext): string;
}

/** La política que le toca a una capacidad por su riesgo. */
export function policyFor(capability: Pick<Capability, 'risk'>): RiskPolicy {
  return RISK_POLICY[capability.risk];
}
