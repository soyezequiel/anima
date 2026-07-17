import { describe, expect, it } from 'vitest';
import { validateSkillProgram } from '@anima/skill-runtime';
import type { ModelRequest } from '../src/index.js';
import {
  MockModelProvider,
  ScriptedModelProvider,
  UnconfiguredModelProvider,
} from '../src/index.js';

describe('MockModelProvider', () => {
  it('es determinista: la misma petición produce la misma respuesta', async () => {
    const a = new MockModelProvider();
    const b = new MockModelProvider();
    const request: ModelRequest = {
      kind: 'skill.propose',
      skillName: 'x',
      problem: 'alimento bloqueado',
      context: [],
    };
    expect(await a.complete(request)).toEqual(await b.complete(request));
  });

  it('sus programas propuestos pasan la validación de la DSL', async () => {
    const provider = new MockModelProvider();
    const proposal = await provider.complete({
      kind: 'skill.propose',
      skillName: 'x',
      problem: 'alimento bloqueado',
      context: [],
    });
    expect(proposal.kind).toBe('skill.program');
    if (proposal.kind === 'skill.program') {
      expect(validateSkillProgram(proposal.program).ok).toBe(true);
    }
  });

  it('corrige la estrategia solo cuando el informe muestra no-damage-dealt', async () => {
    const provider = new MockModelProvider();
    const revised = await provider.complete({
      kind: 'skill.revise',
      skillName: 'x',
      problem: 'alimento bloqueado',
      successCriteria: [],
      context: [],
      previousProgram: [],
      failureObservations: ['no-damage-dealt:branch->wall'],
      attempt: 1,
    });
    expect(revised.kind).toBe('skill.program');
    if (revised.kind === 'skill.program') {
      expect(JSON.stringify(revised.program)).toContain('strongestTool');
    }
  });

  it('con la imperfección apagada, la primera idea ya es la corregida', async () => {
    const provider = new MockModelProvider({ imperfect: false });

    const proposal = await provider.complete({
      kind: 'skill.propose',
      skillName: 'x',
      problem: 'alimento bloqueado',
      context: [],
    });
    expect(JSON.stringify(proposal)).toContain('strongestTool');

    // Sin el atajo de inventar comida: propone directo lo honesto.
    const recipe = await provider.complete({
      kind: 'recipe.propose',
      problem: 'tengo frío',
      materials: ['log (lo llevo encima)'],
      existingRecipes: [],
    });
    expect(recipe.kind).toBe('recipe');
    if (recipe.kind === 'recipe') {
      expect((recipe.recipe as { id: string }).id).toBe('hoguera-simple');
    }
  });

  it('la imperfección se puede apagar y encender en vivo', async () => {
    const provider = new MockModelProvider();
    expect(provider.isImperfect()).toBe(true);
    provider.setImperfect(false);
    const recipe = await provider.complete({
      kind: 'recipe.propose',
      problem: 'tengo frío',
      materials: ['log (lo llevo encima)'],
      existingRecipes: [],
    });
    if (recipe.kind === 'recipe') {
      expect((recipe.recipe as { id: string }).id).toBe('hoguera-simple');
    }
    provider.setImperfect(true);
    const shortcut = await provider.complete({
      kind: 'recipe.propose',
      problem: 'tengo frío',
      materials: ['log (lo llevo encima)'],
      existingRecipes: [],
    });
    if (shortcut.kind === 'recipe') {
      expect((shortcut.recipe as { id: string }).id).toBe('bocado');
    }
  });

  it('cuenta las llamadas por tipo', async () => {
    const provider = new MockModelProvider();
    await provider.complete({ kind: 'dialogue', topic: 'hola', facts: [] });
    await provider.complete({ kind: 'dialogue', topic: 'hola', facts: [] });
    expect(provider.callCount('dialogue')).toBe(2);
    expect(provider.callCount('skill.propose')).toBe(0);
    expect(provider.callCount()).toBe(2);
  });

  it('no finge traducir descripciones: falla con honestidad', async () => {
    // Sin comprensión de lenguaje, "traducir" una descripción sería inventar
    // un objeto que no es lo que el cuidador describió (ADR 0024).
    const provider = new MockModelProvider();
    await expect(
      provider.complete({
        kind: 'entity.describe',
        description: 'un glorb es un mineral azul que da calor',
        knownKinds: ['log', 'flint'],
        existingRecipes: [],
      }),
    ).rejects.toThrow('el proveedor simulado no traduce descripciones');
  });

  it('contesta saludos y elogios sin repetir una respuesta genérica', async () => {
    const provider = new MockModelProvider();
    const greeting = await provider.complete({ kind: 'dialogue', topic: 'hola', facts: [] });
    const praise = await provider.complete({ kind: 'dialogue', topic: 'buenísimo', facts: [] });
    expect(greeting).toEqual(
      expect.objectContaining({ kind: 'dialogue', text: expect.stringContaining('Hola') }),
    );
    expect(praise).toEqual(
      expect.objectContaining({ kind: 'dialogue', text: expect.stringContaining('Gracias') }),
    );
    expect(greeting).not.toEqual(praise);
  });
});

describe('ScriptedModelProvider', () => {
  it('reproduce respuestas en orden y falla al agotarse', async () => {
    const provider = new ScriptedModelProvider([
      { kind: 'dialogue', text: 'primera' },
      { kind: 'dialogue', text: 'segunda' },
    ]);
    const request: ModelRequest = { kind: 'dialogue', topic: 't', facts: [] };
    expect(await provider.complete(request)).toEqual({ kind: 'dialogue', text: 'primera' });
    expect(await provider.complete(request)).toEqual({ kind: 'dialogue', text: 'segunda' });
    await expect(provider.complete(request)).rejects.toThrow('sin respuestas');
  });
});

describe('UnconfiguredModelProvider', () => {
  it('rechaza con un mensaje claro', async () => {
    const provider = new UnconfiguredModelProvider();
    await expect(provider.complete({ kind: 'dialogue', topic: 't', facts: [] })).rejects.toThrow(
      'No hay un modelo real configurado',
    );
  });
});
