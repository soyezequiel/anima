import type { WorldSnapshot } from '@anima/sim-core';

/**
 * Un caso de regresión es un fallo histórico convertido en prueba
 * reproducible. Hay dos orígenes:
 * - laboratorio: escenario nombrado + semilla (se reconstruye con la fábrica);
 * - mundo real: snapshot del mundo tal como estaba cuando la skill estable
 *   falló en uso real (scenarioName "mundo-real").
 * Toda versión futura de la habilidad debe superar estos casos antes de
 * poder promoverse.
 */
export interface RegressionCase {
  id: string;
  skillName: string;
  scenarioName: string;
  seed: number;
  description: string;
  createdAt: string;
  /** Solo casos de mundo real: el mundo exacto donde la skill falló. */
  snapshot?: WorldSnapshot;
  petId?: string;
}

export const REAL_WORLD_SCENARIO = 'mundo-real';

/** Tope de casos de mundo real conservados por habilidad. */
export const MAX_REAL_WORLD_CASES_PER_SKILL = 3;

export interface RegressionData {
  cases: RegressionCase[];
  counter: number;
}

export class RegressionStore {
  private cases: RegressionCase[] = [];
  private counter = 0;

  serialize(): RegressionData {
    return structuredClone({ cases: this.cases, counter: this.counter });
  }

  loadFrom(data: RegressionData): void {
    const clone = structuredClone(data);
    this.cases = clone.cases;
    this.counter = clone.counter;
  }

  add(input: Omit<RegressionCase, 'id'>): RegressionCase {
    const existing = this.cases.find(
      (c) =>
        c.skillName === input.skillName &&
        c.scenarioName === input.scenarioName &&
        c.seed === input.seed,
    );
    if (existing) return existing;
    this.counter += 1;
    const regression: RegressionCase = { id: `reg-${this.counter}`, ...input };
    this.cases.push(regression);
    return regression;
  }

  /**
   * Registra un fallo de mundo real como caso reproducible, con tope por
   * habilidad (los más antiguos se descartan primero).
   */
  addRealWorldCase(input: {
    skillName: string;
    snapshot: WorldSnapshot;
    petId: string;
    tick: number;
    description: string;
    createdAt: string;
  }): RegressionCase {
    const existing = this.realWorldCasesFor(input.skillName);
    if (existing.length >= MAX_REAL_WORLD_CASES_PER_SKILL) {
      const oldest = existing[0]!;
      this.cases = this.cases.filter((c) => c.id !== oldest.id);
    }
    this.counter += 1;
    const regression: RegressionCase = {
      id: `reg-${this.counter}`,
      skillName: input.skillName,
      scenarioName: REAL_WORLD_SCENARIO,
      seed: input.tick,
      description: input.description,
      createdAt: input.createdAt,
      snapshot: structuredClone(input.snapshot),
      petId: input.petId,
    };
    this.cases.push(regression);
    return regression;
  }

  realWorldCasesFor(skillName: string): RegressionCase[] {
    return this.cases.filter(
      (c) => c.skillName === skillName && c.scenarioName === REAL_WORLD_SCENARIO,
    );
  }

  forSkill(skillName: string): RegressionCase[] {
    return this.cases.filter((c) => c.skillName === skillName);
  }

  all(): RegressionCase[] {
    return [...this.cases];
  }
}
