import { describe, expect, it } from 'vitest';
import { runMilestone } from '../src/milestone.js';

/**
 * Prueba automatizada del primer hito: reproduce la demo completa de
 * extremo a extremo (headless) y verifica cada punto de la historia.
 */
describe('hito 1: demo completa', () => {
  it('recorre toda la historia de aprendizaje y termina con éxito', async () => {
    const report = await runMilestone(5);

    // 1-4. Señal de energía, interpretación y objetivo.
    const types = report.timeline.map((t) => t.type);
    expect(types).toContain('guidance.shown');
    expect(types).toContain('goal.created');

    // 5-8. Estrategia directa fallida y registrada.
    expect(types).toContain('strategy.failed');
    expect(types).toContain('strategy.forbidden');

    // 9-11. Creación de candidata y pruebas automáticas.
    expect(types).toContain('skill.requested');
    expect(types).toContain('skill.created');
    expect(types).toContain('skill.test.started');

    // 12-13. Primera versión rechazada, fallo conservado como regresión.
    expect(types).toContain('skill.test.failed');
    expect(report.regressions.length).toBeGreaterThan(0);
    expect(report.skills.some((s) => s.version === 1 && s.status === 'archived')).toBe(true);

    // 14-16. Segunda versión aprobada y promovida.
    expect(types).toContain('skill.test.passed');
    expect(types).toContain('skill.promoted');
    expect(report.skills.some((s) => s.version === 2 && s.status === 'stable')).toBe(true);

    // 17-18. Alcanza el alimento y recupera energía.
    expect(types).toContain('item.consumed');
    expect(report.energy.final).toBeGreaterThan(report.energy.initial);

    // 19. Conserva el conocimiento (hechos + hipótesis confirmada).
    expect(report.facts.length).toBeGreaterThan(0);
    expect(report.hypotheses.some((h) => h.resolved === 'confirmed')).toBe(true);

    // 20. Historial inspeccionable y explicación breve.
    expect(report.timeline.length).toBeGreaterThan(10);
    expect(report.petExplanation.length).toBeGreaterThan(10);

    // Consultas cognitivas mínimas: una propuesta, una revisión.
    expect(report.modelCalls.propose).toBe(1);
    expect(report.modelCalls.revise).toBe(1);

    expect(report.success).toBe(true);
  });

  it('es reproducible: dos corridas con la misma semilla dan la misma cronología', async () => {
    const a = await runMilestone(9);
    const b = await runMilestone(9);
    expect(a.timeline).toEqual(b.timeline);
    expect(a.energy).toEqual(b.energy);
    expect(a.success).toBe(true);
  });
});
