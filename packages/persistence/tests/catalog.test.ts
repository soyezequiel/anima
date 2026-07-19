import { describe, expect, it } from 'vitest';
import { createWorld } from '@anima/sim-core';
import type { Recipe, WorldState } from '@anima/sim-core';
import { SkillLibrary } from '@anima/skill-runtime';
import type { SkillDefinition } from '@anima/skill-runtime';
import {
  catalogSize,
  clearCatalog,
  collectCatalog,
  emptyCatalog,
  forgetFromCatalog,
  loadCatalog,
  mergeCatalog,
  MemoryKeyValueStore,
  saveCatalog,
  seedWorldFromCatalog,
} from '../src/index.js';

/**
 * El catálogo del cuidador (ADR 0076): lo aprendido guardado fuera de toda
 * partida. Lo que se prueba acá son sus tres reglas de convivencia — qué entra,
 * qué gana cuando dos mundos aprendieron lo mismo, y qué sale.
 */

const BASE: Recipe[] = [
  { id: 'campfire', ingredients: [{ kind: 'log', count: 2 }], outcomes: [] },
];

function worldWith(recipes: Recipe[]): WorldState {
  const world = createWorld({ width: 5, height: 5, seed: 1 });
  world.recipes = recipes;
  return world;
}

function stableSkill(name: string, over: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    id: `skill-${name}`,
    name,
    version: 1,
    status: 'stable',
    description: name,
    motivation: 'porque sí',
    inputsSchema: null,
    preconditions: [],
    program: [],
    expectedOutcome: 'algo',
    successCriteria: [],
    safetyInvariants: [],
    dependencies: [],
    metrics: { totalRuns: 0, successfulRuns: 0 },
    knownFailures: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function libraryWith(skills: SkillDefinition[]): SkillLibrary {
  const library = new SkillLibrary();
  library.loadFrom({ skills, counter: skills.length });
  return library;
}

describe('qué entra al catálogo', () => {
  it('guarda lo inventado y deja afuera lo de fábrica', () => {
    const invented: Recipe = { id: 'silla', ingredients: [], outcomes: [] };
    const catalog = collectCatalog({
      world: worldWith([...BASE, invented]),
      library: new SkillLibrary(),
      baseRecipeIds: BASE.map((r) => r.id),
    });
    // Guardar una receta de fábrica la congelaría: el día que el juego la
    // cambie, los mundos nuevos seguirían recibiendo la vieja.
    expect(catalog.recipes.map((r) => r.id)).toEqual(['silla']);
  });

  it('guarda solo las habilidades estables', () => {
    const catalog = collectCatalog({
      world: worldWith([]),
      library: libraryWith([
        stableSkill('abrigarse'),
        stableSkill('tantear', { status: 'experimental' }),
        stableSkill('fallida', { status: 'archived' }),
      ]),
      baseRecipeIds: [],
    });
    // Un intento que no pasó sus pruebas no es conocimiento.
    expect(catalog.skills.map((s) => s.name)).toEqual(['abrigarse']);
  });
});

describe('qué gana al unir dos mundos', () => {
  it('suma y nunca quita', () => {
    const existing = { ...emptyCatalog(), recipes: [{ id: 'a', ingredients: [], outcomes: [] }] };
    const incoming = { ...emptyCatalog(), recipes: [{ id: 'b', ingredients: [], outcomes: [] }] };
    // Jugar una partida vieja —que no conoce 'a'— no puede borrar 'a'.
    expect(mergeCatalog(existing, incoming).recipes.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('la misma conducta aprendida en dos mundos no se duplica: gana la mejor medida', () => {
    const peor = stableSkill('abrigarse', {
      id: 'skill-1',
      metrics: { totalRuns: 10, successfulRuns: 5, lastEvaluationSuccessRate: 0.5 },
    });
    const mejor = stableSkill('abrigarse', {
      id: 'skill-99',
      version: 2,
      metrics: { totalRuns: 10, successfulRuns: 9, lastEvaluationSuccessRate: 0.9 },
    });
    const merged = mergeCatalog(
      { ...emptyCatalog(), skills: [peor] },
      { ...emptyCatalog(), skills: [mejor] },
    );
    // Se unen por NOMBRE: dos ids distintos para la misma conducta dejarían al
    // mundo siguiente adoptando duplicados que compiten entre sí.
    expect(merged.skills).toHaveLength(1);
    expect(merged.skills[0]?.id).toBe('skill-99');
  });

  it('el dibujo más nuevo gana', () => {
    const merged = mergeCatalog(
      { ...emptyCatalog(), glyphs: { silla: ['viejo'] } },
      { ...emptyCatalog(), glyphs: { silla: ['nuevo'] } },
    );
    expect(merged.glyphs.silla).toEqual(['nuevo']);
  });
});

describe('qué sale del catálogo', () => {
  it('lo podado se va, y las habilidades por nombre', () => {
    const catalog = {
      ...emptyCatalog(),
      recipes: [
        { id: 'silla', ingredients: [], outcomes: [] },
        { id: 'mesa', ingredients: [], outcomes: [] },
      ],
      glyphs: { silla: ['x'], mesa: ['y'] },
      skills: [stableSkill('abrigarse'), stableSkill('pescar')],
    };
    const after = forgetFromCatalog(catalog, {
      recipes: ['silla'],
      glyphs: ['silla'],
      skillNames: ['abrigarse'],
    });
    expect(after.recipes.map((r) => r.id)).toEqual(['mesa']);
    expect(after.glyphs.silla).toBeUndefined();
    expect(after.skills.map((s) => s.name)).toEqual(['pescar']);
  });
});

describe('sembrar un mundo nuevo', () => {
  it('agrega lo que falta y respeta lo que el escenario ya puso', () => {
    const world = worldWith([{ id: 'campfire', ingredients: [], outcomes: [] }]);
    seedWorldFromCatalog(world, {
      ...emptyCatalog(),
      // Choca por id con la del escenario: gana la del escenario.
      recipes: [
        { id: 'campfire', ingredients: [{ kind: 'otra', count: 9 }], outcomes: [] },
        { id: 'silla', ingredients: [], outcomes: [] },
      ],
    });
    expect(world.recipes.map((r) => r.id).sort()).toEqual(['campfire', 'silla']);
    expect(world.recipes.find((r) => r.id === 'campfire')?.ingredients).toEqual([]);
  });

  it('no toca las habilidades: esas se adoptan y se vuelven a rendir', () => {
    const world = worldWith([]);
    seedWorldFromCatalog(world, { ...emptyCatalog(), skills: [stableSkill('abrigarse')] });
    // El catálogo guarda lo aprendido, no una licencia para saltearse el examen.
    expect(world.recipes).toEqual([]);
  });
});

describe('ida y vuelta contra el almacenamiento', () => {
  it('lo guardado se lee igual', async () => {
    const store = new MemoryKeyValueStore();
    const catalog = {
      ...emptyCatalog(),
      recipes: [{ id: 'silla', ingredients: [], outcomes: [] }],
      skills: [stableSkill('abrigarse')],
    };
    await saveCatalog(store, catalog);
    expect(await loadCatalog(store)).toEqual(catalog);
    expect(catalogSize(catalog)).toBe(2);
  });

  it('un catálogo ausente se lee vacío en vez de romper', async () => {
    expect(await loadCatalog(new MemoryKeyValueStore())).toEqual(emptyCatalog());
  });

  it('un catálogo ilegible se lee vacío: nunca impide jugar', async () => {
    const store = new MemoryKeyValueStore();
    await store.set('catalog:recipes', '{ esto no es json');
    expect((await loadCatalog(store)).recipes).toEqual([]);
  });

  it('vaciarlo lo deja vacío de verdad', async () => {
    const store = new MemoryKeyValueStore();
    await saveCatalog(store, { ...emptyCatalog(), recipes: [{ id: 'x', ingredients: [], outcomes: [] }] });
    await clearCatalog(store);
    expect(await loadCatalog(store)).toEqual(emptyCatalog());
  });
});
