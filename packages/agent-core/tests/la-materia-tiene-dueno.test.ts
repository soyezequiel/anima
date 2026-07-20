import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn } from '@anima/sim-core';
import { MemoryStore } from '@anima/memory';
import { GoalManager } from '../src/goals.js';
import { InventionEngine } from '../src/invention.js';
import { ProgressController } from '../src/progress.js';

/**
 * La materia que un encargo abierto espera no es materia libre.
 *
 * Partida real, mapa del cauce. «Cruzá el río» se durmió esperando troncos
 * (`falta material para el encargo`). Un encargo suspendido no compite en
 * `selectActive` —el filtro exige `status === 'active'`—, así que ganó el frío,
 * que además pesa más (1.95 contra 1.7). `pursueWarmth` agotó estrategias y se
 * puso a inventar… ofreciéndole al modelo esos MISMOS troncos como materia
 * libre. Fabricó una fogata. El encargo despertó y le faltaba justo lo que ella
 * se había gastado.
 *
 * Diez recetas más tarde —campfire, chair, torch, barricade, shelter,
 * stone-pick, brick— no quedaba con qué cruzar nada.
 *
 * Acá se fija el filtro en sí: lo reservado no se le pone sobre la mesa al
 * modelo. Quién reserva qué lo decide `committedKinds`, que solo aparta lo que
 * NO SOBRA — la iniciativa (ADR 0036) no se apaga por tener un encargo abierto.
 */

const PROPUESTA: ModelResponse = {
  kind: 'recipe',
  recipe: {
    id: 'fogata',
    output: { kind: 'fogata', components: { heatSource: { warmthPerTick: 0.5, range: 2 } } },
    ingredients: [{ kind: 'piedra', count: 2 }],
  },
  rationale: 'para calentarme',
} as ModelResponse;

const JUEZ_OK: ModelResponse = { kind: 'judgement', willing: true, reason: 'va' } as ModelResponse;

function world(): { world: WorldState; petId: EntityId } {
  const w = createWorld({ width: 12, height: 8, seed: 5 });
  const petId = spawn(w, 'pet', {
    position: { x: 2, y: 3 },
    collider: { solid: true },
    energy: { current: 40, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  for (let i = 0; i < 3; i++) {
    spawn(w, 'tronco', { position: { x: 4 + i, y: 3 }, portable: {} });
    spawn(w, 'piedra', { position: { x: 4 + i, y: 5 }, portable: {} });
  }
  return { world: w, petId };
}

/** Guarda lo que se le pidió al modelo, para mirar qué materiales viajaron. */
function engineSpying(seen: ModelRequest[]): InventionEngine {
  const provider = new ScriptedModelProvider([PROPUESTA, JUEZ_OK], { interpretsLanguage: true });
  const original = provider.complete.bind(provider);
  provider.complete = async (request: ModelRequest) => {
    seen.push(request);
    return original(request);
  };
  return new InventionEngine({
    provider,
    memory: new MemoryStore(),
    goals: new GoalManager(),
    progress: new ProgressController(),
    emit: () => {},
    reply: () => {},
    currentTick: () => 1,
  });
}

function materialsOffered(seen: ModelRequest[]): string[] {
  return seen
    .filter((r): r is ModelRequest & { materials: string[] } => r.kind === 'recipe.propose')
    .flatMap((r) => r.materials);
}

describe('la materia de un encargo abierto no se ofrece como libre', () => {
  it('lo reservado no llega a la mesa del modelo', async () => {
    const { world: w, petId } = world();
    const seen: ModelRequest[] = [];
    const invention = engineSpying(seen);

    await invention.inventRecipe('tengo frío', buildPerception(w, petId), {
      goalId: 'goal-frio',
      reserved: ['tronco'],
    });

    const ofrecidos = materialsOffered(seen);
    expect(ofrecidos.length).toBeGreaterThan(0);
    // El tronco está reclamado por el encargo: no se ofrece.
    expect(ofrecidos.filter((m) => m.startsWith('tronco'))).toEqual([]);
    // La piedra no la reclama nadie: con eso puede inventar tranquila.
    expect(ofrecidos.some((m) => m.startsWith('piedra'))).toBe(true);
  });

  it('sin reservas, la mesa está completa como siempre', async () => {
    const { world: w, petId } = world();
    const seen: ModelRequest[] = [];
    const invention = engineSpying(seen);

    await invention.inventRecipe('tengo frío', buildPerception(w, petId), { goalId: 'goal-frio' });

    const ofrecidos = materialsOffered(seen);
    expect(ofrecidos.some((m) => m.startsWith('tronco'))).toBe(true);
    expect(ofrecidos.some((m) => m.startsWith('piedra'))).toBe(true);
  });

  it('si TODO está reclamado, no inventa: es falta de materia, no de idea', async () => {
    const { world: w, petId } = world();
    const seen: ModelRequest[] = [];
    const invention = engineSpying(seen);

    const intent = await invention.inventRecipe('tengo frío', buildPerception(w, petId), {
      goalId: 'goal-frio',
      reserved: ['tronco', 'piedra'],
    });

    // Ni siquiera se consulta al modelo: no hay con qué, y gastar una llamada
    // para que proponga con las manos vacías es tirar crédito.
    expect(intent).toBeNull();
    expect(materialsOffered(seen)).toEqual([]);
  });
});
