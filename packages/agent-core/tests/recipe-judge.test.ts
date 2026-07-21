import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { MAX_RECIPE_DEPTH, buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * La sexta puerta (ADR 0042): la IA Dios juzga las recetas inventadas.
 *
 * El caso que la motivó es el que se prueba aquí. Una mascota propuso un
 * "celular" hecho de una rama y un pedernal, y TODAS las comprobaciones
 * deterministas lo aprobaron con razón: no creaba materia, no giraba en
 * círculos, sus propiedades estaban en cota. Cada una mira UN paso, y ese paso
 * estaba bien formado. Lo que ninguna medía es que faltaran los del MEDIO.
 *
 * El juez NO prohíbe el celular: un mundo de catálogo abierto puede llegar a
 * construirlo bajando por procesador, memoria y pantalla hasta la materia
 * prima. Lo que rechaza es el salto que se saltea la cadena entera.
 */

/** Modelo de prueba: propone lo que se le diga y juzga como se le diga. */
class ScriptedModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
  readonly seen: ModelRequest[] = [];

  constructor(private scripted: Partial<Record<ModelRequest['kind'], ModelResponse>>) {
    super();
  }

  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    const canned = this.scripted[request.kind];
    if (canned) return Promise.resolve(canned);
    return super.complete(request);
  }
}

/** Una rama y un pedernal en la mano: los materiales del caso real. */
function worldWithBranchAndFlint(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 9, height: 5, seed: 1 });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    temperature: { current: 10, max: 50, lossPerTick: 0.1 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  for (const kind of ['rama', 'pedernal']) {
    const item = spawn(world, kind, { portable: {} });
    world.entities[petId]!.components.inventory!.items.push(item.id);
  }
  return { world, petId };
}

/** La receta del caso real: mecánicamente impecable, semánticamente absurda. */
const CELULAR: ModelResponse = {
  kind: 'recipe',
  recipe: {
    id: 'celular',
    output: {
      kind: 'celular',
      components: {
        portable: {},
        hardness: { value: 0.92 },
        durability: { current: 5, max: 5 },
        drops: [
          { kind: 'rama', components: { portable: {} } },
          { kind: 'pedernal', components: { portable: {} } },
        ],
      },
    },
    ingredients: [
      { kind: 'rama', count: 1 },
      { kind: 'pedernal', count: 1 },
    ],
  },
  rationale: 'junto la rama y el pedernal',
};

/** Una receta de fábrica sin tirada: acá se mide el juicio, no la suerte. */
function madeOf(kind: string, ingredients: { kind: string; count: number }[]) {
  return {
    id: kind,
    outcomes: [{ weight: 1, output: { kind, components: { portable: {} } } }],
    ingredients,
  };
}

function makeAgent(petId: EntityId, provider: MockModelProvider) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-18T00:00:00Z',
  });
}

async function run(world: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(world, petId));
    if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
  }
}

describe('la IA Dios juzga las recetas inventadas (ADR 0042)', () => {
  it('un celular de una rama y un pedernal no entra: le faltan todos los pasos del medio', async () => {
    const { world, petId } = worldWithBranchAndFlint();
    const provider = new ScriptedModel({
      'recipe.propose': CELULAR,
      'recipe.judge': {
        kind: 'judgement',
        willing: false,
        reason:
          'te faltan el procesador, la memoria y la pantalla: eso no sale de atar una piedra a un palo',
      },
    });
    const agent = makeAgent(petId, provider);

    await run(world, petId, agent, 6);

    // La puerta determinista la habría dejado pasar: es el juez quien la para.
    const judged = agent.events.ofType('recipe.judged');
    expect(judged.length).toBeGreaterThan(0);
    expect(judged[0]!.data.outputKind).toBe('celular');
    expect(judged[0]!.data.willing).toBe(false);
    // Y no llegó al mundo: proponerla no la vuelve verdadera.
    expect(world.recipes.some((r) => r.id === 'celular')).toBe(false);
  });

  it('el juez ve lo que ya sabe hacer: es lo que separa un paso de un salto', async () => {
    const { world, petId } = worldWithBranchAndFlint();
    const provider = new ScriptedModel({
      'recipe.propose': CELULAR,
      'recipe.judge': { kind: 'judgement', willing: false, reason: 'te faltan las piezas' },
    });
    const agent = makeAgent(petId, provider);

    await run(world, petId, agent, 6);

    const asked = provider.seen.find((r) => r.kind === 'recipe.judge');
    expect(asked).toBeDefined();
    // Sin estos dos datos el juez no puede distinguir "celular de procesador +
    // pantalla" (honesto, si existen) de "celular de rama + pedernal" (salto).
    expect(asked).toHaveProperty('knownRecipes');
    expect(asked).toHaveProperty('depthBudget');
    // Y no le exige un árbol más profundo del que su mundo admite.
    expect((asked as { depthBudget: number }).depthBudget).toBe(MAX_RECIPE_DEPTH);
  });

  it('el veto se aprende: lo que no tiene sentido no se re-inventa', async () => {
    const { world, petId } = worldWithBranchAndFlint();
    const provider = new ScriptedModel({
      'recipe.propose': CELULAR,
      'recipe.judge': {
        kind: 'judgement',
        willing: false,
        reason: 'una rama y un pedernal no hacen un aparato',
      },
    });
    const agent = makeAgent(petId, provider);

    await run(world, petId, agent, 12);

    // El motivo queda como hipótesis persistente: orienta el siguiente intento,
    // pero la IA Dios no promociona su propia redacción a hecho.
    const veto = agent.memory
      .hypothesisList()
      .find((h) => h.statement.startsWith('no tiene sentido construir celular'));
    expect(veto).toBeDefined();
    expect(veto!.statement).toContain('no hacen un aparato');

    // Y no se vuelve a preguntar: una vez juzgado, el veto responde solo. Con
    // 12 ticks y 3 intentos de crédito, sin memoria habría preguntado más.
    const asked = provider.seen.filter((r) => r.kind === 'recipe.judge').length;
    expect(asked).toBeLessThanOrEqual(1);
  });

  /**
   * El caso que se vio en una partida real del mapa "El vado". El juez rechazó
   * "puente" COMO COSA y en el mismo veredicto pidió que se propusiera como
   * OBRA. El modelo obedeció y mandó el plano con sus piezas — y el veto viejo,
   * guardado solo contra el nombre, tumbó la obra antes de que nadie la mirara.
   *
   * La memoria de un rechazo no puede bloquear la corrección que ese mismo
   * rechazo pidió.
   */
  it('un veto contra la COSA no bloquea la misma idea propuesta como OBRA', async () => {
    const { petId } = worldWithBranchAndFlint();
    const agent = makeAgent(petId, new ScriptedModel({}));

    // Se le hace vivir el veto de la cosa suelta, con el formato que el motor
    // guarda hoy.
    agent.memory.addFact(
      'no tiene sentido construir puente como cosa: un puente es una obra, no una cosa',
      0,
    );
    const facts = agent.memory.factList().map((f) => f.statement);
    expect(facts.some((f) => f.startsWith('no tiene sentido construir puente como cosa'))).toBe(
      true,
    );
    // El veto de la cosa y el de la pieza son hermanos: ninguno es prefijo del
    // otro, así que buscar uno jamás encuentra al otro.
    expect(
      facts.some((f) => f.startsWith('no tiene sentido construir puente como pieza de una obra')),
    ).toBe(false);
  });

  it('el celular NO está prohibido: con la cadena construida, el último paso entra', async () => {
    // Un mundo que ya recorrió la cadena: sabe hacer procesador y pantalla.
    // Ahora "celular = procesador + pantalla" es UN paso, no un salto, y el
    // mismo juez que rechazó la rama con el pedernal lo aprueba. El catálogo
    // es abierto: lo que se gana bajando hasta la materia prima, se puede.
    const world = createWorld(
      { width: 9, height: 5, seed: 1 },
      {
        recipes: [
          madeOf('procesador', [{ kind: 'silicio', count: 1 }]),
          madeOf('pantalla', [{ kind: 'silicio', count: 1 }]),
        ],
      },
    );
    const petId = spawn(world, 'pet', {
      position: { x: 1, y: 2 },
      collider: { solid: true },
      energy: { current: 45, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      temperature: { current: 10, max: 50, lossPerTick: 0.1 },
      strength: { value: 2 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Anima', perceptionRange: 12 },
    }).id;
    for (const kind of ['procesador', 'pantalla']) {
      const item = spawn(world, kind, { portable: {} });
      world.entities[petId]!.components.inventory!.items.push(item.id);
    }

    const provider = new ScriptedModel({
      'recipe.propose': {
        kind: 'recipe',
        recipe: {
          id: 'celular',
          output: {
            kind: 'celular',
            components: { portable: {}, hardness: { value: 0.9 } },
          },
          ingredients: [
            { kind: 'procesador', count: 1 },
            { kind: 'pantalla', count: 1 },
          ],
        },
        rationale: 'monto el procesador detrás de la pantalla',
      },
      'recipe.judge': {
        kind: 'judgement',
        willing: true,
        reason: 'las piezas ya existen y montarlas es un solo paso: eso sí es armar un celular',
      },
    });
    const agent = makeAgent(petId, provider);

    await run(world, petId, agent, 6);

    expect(world.recipes.some((r) => r.id === 'celular')).toBe(true);
    // Y el juez vio la cadena ya construida: por eso pudo llamarlo un paso.
    const asked = provider.seen.find((r) => r.kind === 'recipe.judge') as {
      knownRecipes: string[];
    };
    expect(asked.knownRecipes.join(' ')).toContain('procesador');
    expect(asked.knownRecipes.join(' ')).toContain('pantalla');
  });

  it('lo que tiene sentido sigue entrando: el juez filtra, no bloquea', async () => {
    const { world, petId } = worldWithBranchAndFlint();
    const provider = new ScriptedModel({
      'recipe.propose': {
        kind: 'recipe',
        recipe: {
          id: 'cuchillo-de-piedra',
          output: {
            kind: 'cuchillo-de-piedra',
            components: { portable: {}, tool: { power: 3 }, hardness: { value: 2 } },
          },
          ingredients: [
            { kind: 'rama', count: 1 },
            { kind: 'pedernal', count: 1 },
          ],
        },
        rationale: 'ato el pedernal a la rama y tengo filo',
      },
      'recipe.judge': {
        kind: 'judgement',
        willing: true,
        reason: 'atar una piedra afilada a un palo es lo primero que aprendió cualquiera',
      },
    });
    const agent = makeAgent(petId, provider);

    await run(world, petId, agent, 6);

    expect(world.recipes.some((r) => r.id === 'cuchillo-de-piedra')).toBe(true);
  });

  it('sin juez no entra nada: un proveedor caído es el lado seguro', async () => {
    const { world, petId } = worldWithBranchAndFlint();
    class NoJudge extends ScriptedModel {
      override complete(request: ModelRequest): Promise<ModelResponse> {
        if (request.kind === 'recipe.judge') {
          return Promise.reject(new Error('el juez no responde'));
        }
        return super.complete(request);
      }
    }
    const provider = new NoJudge({ 'recipe.propose': CELULAR });
    const agent = makeAgent(petId, provider);

    await run(world, petId, agent, 6);

    expect(world.recipes.some((r) => r.id === 'celular')).toBe(false);
    // Pero no se le cobra como idea mala: no hubo veredicto que aprender.
    expect(agent.memory.factList().some((f) => f.statement.includes('celular'))).toBe(false);
  });
});
