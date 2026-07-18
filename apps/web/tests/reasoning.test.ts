import { describe, expect, it } from 'vitest';
import { parseReasoning, parseReasoningStep } from '../src/components/reasoning.js';

describe('parseReasoningStep', () => {
  it('usa el titular en negrita con que Codex encabeza el resumen', () => {
    const step = parseReasoningStep('**Diseñando la habilidad**\n\nEl usuario me pide que diseñe…');
    expect(step.headline).toBe('Diseñando la habilidad');
    expect(step.body).toBe('El usuario me pide que diseñe…');
  });

  it('sin negrita, recorta la primera oración a algo que entre de un vistazo', () => {
    const raw =
      'El usuario me pide que diseñe una habilidad para una mascota virtual en una DSL JSON cerrada y además quiere que sea general. El problema específico es llegar hasta el alimento.';
    const step = parseReasoningStep(raw);
    expect(step.headline.length).toBeLessThanOrEqual(91);
    expect(step.headline.endsWith('…')).toBe(true);
    // La prosa completa sigue disponible detrás del toggle.
    expect(step.body).toContain('El problema específico');
  });

  it('saca los bloques cercados de la prosa y los deja como código aparte', () => {
    const step = parseReasoningStep(
      'Entonces el plan es:\n```json\n[{ "op": "consume" }]\n```\ny listo.',
    );
    expect(step.code).toEqual(['[{ "op": "consume" }]']);
    expect(step.body).not.toContain('"op"');
    expect(step.body).toContain('y listo.');
  });

  it('saca también las corridas de JSON suelto que el crudo mezcla en la frase', () => {
    const raw = [
      'Necesito completar la estructura.',
      '{ "op": "pickup", "target": "bestTool" }',
      '"maxSteps": 50,',
      '"stopAtDistance": 1',
      'Hay algunos problemas acá.',
    ].join('\n');
    const step = parseReasoningStep(raw);
    expect(step.code).toHaveLength(1);
    expect(step.code[0]).toContain('maxSteps');
    expect(step.body).toBe('Necesito completar la estructura.\nHay algunos problemas acá.');
  });

  it('una línea suelta con dos puntos sigue siendo prosa, no código', () => {
    const step = parseReasoningStep('Restricciones: máximo 200 operaciones.');
    expect(step.code).toEqual([]);
    expect(step.body).toContain('Restricciones');
  });

  it('nunca deja un titular vacío', () => {
    expect(parseReasoningStep('```\n{}\n```').headline).toBe('pensando…');
    expect(parseReasoningStep('   ').headline).toBe('pensando…');
  });

  it('no deja marcas de negrita crudas en el cuerpo', () => {
    const step = parseReasoningStep('**Plan**\n\nPrimero **buscar** la comida.');
    expect(step.body).toBe('Primero buscar la comida.');
  });

  it('parseReasoning mantiene un paso por fragmento', () => {
    expect(parseReasoning(['**Uno**\n\na', '**Dos**\n\nb']).map((s) => s.headline)).toEqual([
      'Uno',
      'Dos',
    ]);
  });
});
