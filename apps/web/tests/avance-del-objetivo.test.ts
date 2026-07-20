import { describe, expect, it } from 'vitest';
import { goalProgress } from '../src/components/GoalsPanel.js';
import type { GoalView } from '../src/session/view.js';

/**
 * UN avance por objetivo, no tres.
 *
 * La tarjeta escribía hasta tres cuentas distintas —los bloques puestos de la
 * obra, los pasos cumplidos, y la lista de materia que falta— cada una como su
 * propio titular, y encima la barra solo aparecía para las obras. Tres números
 * compitiendo por ser EL avance es no tener ninguno: se veía «en marcha»
 * durante cien ticks sin saber si avanzaba o estaba trabada.
 *
 * Se elige el más CONCRETO que el objetivo tenga, y ese es el que se dibuja.
 */

function goal(partial: Partial<GoalView>): GoalView {
  return {
    id: 'goal-1',
    description: 'algo',
    status: 'active',
    source: 'user-request',
    score: 1,
    rank: 1,
    suspendedReason: null,
    needs: [],
    structure: null,
    children: [],
    ...partial,
  };
}

function need(kind: string, have: number, count: number) {
  return {
    kind,
    label: kind,
    short: count - have,
    need: count,
    have,
    visible: false,
    fromLabel: null,
  } as GoalView['needs'][number];
}

describe('el avance de un objetivo es uno solo', () => {
  it('una obra se cuenta por bloques puestos', () => {
    const avance = goalProgress(
      goal({ structure: { label: 'puente', placed: 2, total: 5 } }),
    );
    expect(avance).toEqual({ done: 2, total: 5, text: '2 de 5 bloques puestos' });
  });

  it('los bloques le ganan a los pasos: es la cuenta más concreta', () => {
    // Con obra Y pasos, antes se escribían las dos y competían. Los bloques
    // están en el suelo; los pasos son cómo se organizó para ponerlos.
    const avance = goalProgress(
      goal({
        structure: { label: 'puente', placed: 1, total: 4 },
        children: [goal({ id: 'a', status: 'completed' }), goal({ id: 'b', status: 'active' })],
      }),
    );
    expect(avance?.text).toBe('1 de 4 bloques puestos');
  });

  it('sin obra, se cuenta por pasos cumplidos', () => {
    const avance = goalProgress(
      goal({
        children: [
          goal({ id: 'a', status: 'completed' }),
          goal({ id: 'b', status: 'completed' }),
          goal({ id: 'c', status: 'active' }),
        ],
      }),
    );
    expect(avance).toEqual({ done: 2, total: 3, text: '2 de 3 pasos' });
  });

  it('sin pasos, se cuenta la materia ya juntada', () => {
    const avance = goalProgress(goal({ needs: [need('tronco', 1, 3), need('fibra', 0, 2)] }));
    expect(avance).toEqual({ done: 1, total: 5, text: '1 de 5 juntados' });
  });

  it('lo que junta de más no infla la cuenta', () => {
    // Con cuatro troncos y una receta que pide dos, «4 de 2» sería un avance
    // de más del 100% y una barra desbordada.
    const avance = goalProgress(goal({ needs: [need('tronco', 4, 2)] }));
    expect(avance).toEqual({ done: 2, total: 2, text: '2 de 2 juntados' });
  });

  it('un objetivo sin nada que medir no inventa una barra', () => {
    // «Recuperar energía» no tiene bloques, ni pasos, ni materia: su avance es
    // la barra de energía de arriba. Dibujarle una barra propia sería inventar
    // un número que nadie calculó.
    expect(goalProgress(goal({ source: 'internal-signal' }))).toBeNull();
  });
});
