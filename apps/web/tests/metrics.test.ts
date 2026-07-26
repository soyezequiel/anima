import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '@anima/agent-core';
import { LONG_TASK_MS, SessionMetrics } from '../src/session/metrics.js';

function event(type: AgentEvent['type'], data: Record<string, unknown> = {}): AgentEvent {
  return { type, tick: 0, data } as AgentEvent;
}

describe('las cuentas de la sesión', () => {
  it('mide cuántos ticks pasan del pedido a la primera acción, y solo la primera', () => {
    const metrics = new SessionMetrics();
    metrics.noteRequestAccepted('goal-1', 10);
    metrics.noteUsefulAction('goal-1', 13);
    // Lo que se mide es cuánto tardó en ARRANCAR, no cuánto duró: las acciones
    // siguientes del mismo encargo no vuelven a contar.
    metrics.noteUsefulAction('goal-1', 40);

    expect(metrics.view().ticksToFirstAction).toEqual([3]);
  });

  it('una acción de un encargo que nadie pidió no cuenta', () => {
    const metrics = new SessionMetrics();
    metrics.noteUsefulAction('goal-huerfano', 5);
    expect(metrics.view().ticksToFirstAction).toEqual([]);
    expect(metrics.view().medianTicksToFirstAction).toBeNull();
  });

  it('la mediana resiste un encargo lento suelto', () => {
    const metrics = new SessionMetrics();
    for (const [goalId, start, first] of [
      ['a', 0, 1],
      ['b', 0, 2],
      ['c', 0, 3],
      ['d', 0, 400],
    ] as const) {
      metrics.noteRequestAccepted(goalId, start);
      metrics.noteUsefulAction(goalId, first);
    }
    // Con promedio darían 101: un encargo trabado escondería que los otros tres
    // arrancaron enseguida.
    expect(metrics.view().medianTicksToFirstAction).toBe(2.5);
  });

  it('separa en qué se va el tiempo y marca los bloques que congelan la pestaña', () => {
    const metrics = new SessionMetrics();
    metrics.noteDuration('interpret.command', 800);
    metrics.noteDuration('interpret.command', 400);
    metrics.noteDuration('evaluación', LONG_TASK_MS - 1);

    const view = metrics.view();
    expect(view.durations['interpret.command']).toEqual({ count: 2, totalMs: 1200, maxMs: 800 });
    // Solo lo que de verdad bloquea entra a la lista: es la comprobación de que
    // sacar la evaluación a un worker sirvió.
    expect(view.longTasks).toEqual([800, 400]);
  });

  it('cuenta el reuso real de lo aprendido contra los planes armados en el momento', () => {
    const metrics = new SessionMetrics();
    for (let i = 0; i < 4; i++) metrics.ingest(event('strategy.selected'));
    metrics.ingest(event('skill.used'));

    const view = metrics.view();
    expect(view.plansStarted).toBe(4);
    expect(view.skillRuns).toBe(1);
    // Una habilidad que se ejecuta una vez de cada cuatro trabajos fue un plan
    // efímero con ceremonia de artefacto.
    expect(view.skillReuseRatio).toBe(0.25);
  });

  it('cuenta lo observado del plan: verificado, sin verificar y replanificado', () => {
    const metrics = new SessionMetrics();
    metrics.ingest(event('plan.step.verified'));
    metrics.ingest(event('plan.step.verified'));
    metrics.ingest(event('plan.step.unverified'));
    metrics.ingest(event('plan.replanned'));
    metrics.ingest(event('capability.missing'));

    const view = metrics.view();
    expect(view.planStepsVerified).toBe(2);
    expect(view.planStepsUnverified).toBe(1);
    expect(view.replans).toBe(1);
    expect(view.missingCapabilities).toBe(1);
  });

  it('una vida nueva empieza con las cuentas en cero', () => {
    const metrics = new SessionMetrics();
    metrics.noteRequestAccepted('goal-1', 0);
    metrics.noteUsefulAction('goal-1', 2);
    metrics.noteDuration('x', 999);
    metrics.reset();

    expect(metrics.view()).toMatchObject({
      ticksToFirstAction: [],
      longTasks: [],
      plansStarted: 0,
      skillReuseRatio: null,
    });
  });
});
