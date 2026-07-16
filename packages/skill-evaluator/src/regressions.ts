/**
 * Un caso de regresión es un fallo histórico convertido en prueba
 * reproducible: escenario + semilla + descripción. Toda versión futura de la
 * habilidad debe superar estos casos antes de poder promoverse.
 */
export interface RegressionCase {
  id: string;
  skillName: string;
  scenarioName: string;
  seed: number;
  description: string;
  createdAt: string;
}

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

  forSkill(skillName: string): RegressionCase[] {
    return this.cases.filter((c) => c.skillName === skillName);
  }

  all(): RegressionCase[] {
    return [...this.cases];
  }
}
