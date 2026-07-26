import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { CAMPFIRE_RECIPE, MVP_SCENARIOS, withoutChance } from '@anima/test-scenarios';
import { AnimaAgent, type AgentEvent } from '../src/index.js';

/**
 * «Conseguí madera y hacé una fogata», de punta a punta.
 *
 * Es la regresión del pedido representativo: la ruta entera —entender, planear,
 * ACTUAR pronto, mirar el resultado y adaptarse— medida sobre el mundo real y
 * no sobre una simulación aparte.
 *
 * Lo que fija, y que antes no se podía afirmar:
 *  - la primera acción útil no espera a que nazca ninguna habilidad;
 *  - cada paso se juzga contra el mundo, no contra «el programa terminó»;
 *  - si el mundo se mueve debajo del plan, se replanifica en vez de anunciar
 *    un «listo» que no ocurrió.
 */

class ScriptedLanguageModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
  readonly seen: ModelRequest[] = [];

  constructor(private readonly scripted: Partial<Record<ModelRequest['kind'], ModelResponse>>) {
    super();
  }

  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    const canned = this.scripted[request.kind];
    if (canned) return Promise.resolve(canned);
    return super.complete(request);
  }

  countOf(kind: ModelRequest['kind']): number {
    return this.seen.filter((request) => request.kind === kind).length;
  }
}

/** «conseguí madera y hacé una fogata» tal como lo devuelve el intérprete. */
const WOOD_THEN_FIRE: ModelResponse = {
  kind: 'command.interpretation',
  command: {
    action: 'sequence',
    steps: [
      { action: 'fetch-item', targetKind: 'log', amount: 2 },
      { action: 'craft-item', recipeId: 'campfire' },
    ],
  },
};

function forestWorld(options: { logs?: number } = {}): { world: WorldState; petId: EntityId } {
  // Sin tirada: acá se mide la ruta pedido → plan → acción → observación, no si
  // la chispa agarró (eso se prueba en sim-core).
  const world = createWorld(
    { width: 14, height: 9, seed: 3 },
    { recipes: [withoutChance(CAMPFIRE_RECIPE)] },
  );
  const petId = spawn(world, 'pet', {
    position: { x: 2, y: 4 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 14 },
  }).id;
  for (let i = 0; i < (options.logs ?? 3); i++) {
    spawn(world, 'log', { position: { x: 5 + i, y: 4 }, portable: {} });
  }
  spawn(world, 'flint', { position: { x: 4, y: 6 }, portable: {} });
  return { world, petId };
}

function makeAgent(petId: EntityId, provider: ScriptedLanguageModel): AnimaAgent {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-25T00:00:00Z',
  });
}

interface RunResult {
  /** En qué tick el mundo aceptó la primera acción que sirve para el encargo. */
  firstUsefulTick: number | null;
  events: AgentEvent[];
}

async function run(
  world: WorldState,
  petId: EntityId,
  agent: AnimaAgent,
  ticks: number,
  onTick?: (tick: number) => void,
): Promise<RunResult> {
  let firstUsefulTick: number | null = null;
  for (let tick = 0; tick < ticks; tick++) {
    onTick?.(tick);
    const intent = await agent.think(buildPerception(world, petId));
    const events = stepWorld(world, intent ? [{ actorId: petId, intent }] : []);
    agent.observe(events);
    // «Útil» es una acción del cuerpo que empuja el encargo: caminar hacia el
    // tronco cuenta, hablar no. Y tiene que haberla ACEPTADO el mundo.
    if (
      firstUsefulTick === null &&
      intent &&
      intent.type !== 'speak' &&
      intent.type !== 'wait' &&
      events.some((event) => event.type === 'action.resolved' && event.data.success === true)
    ) {
      firstUsefulTick = tick;
    }
  }
  return { firstUsefulTick, events: agent.events.events };
}

const typesOf = (events: AgentEvent[]): string[] => events.map((event) => event.type);

describe('pedido → plan → acción → observación', () => {
  it('empieza a actuar en el mundo sin crear ni certificar ninguna habilidad', async () => {
    const { world, petId } = forestWorld();
    const provider = new ScriptedLanguageModel({ 'interpret.command': WOOD_THEN_FIRE });
    const agent = makeAgent(petId, provider);

    agent.receiveUserMessage('conseguí madera y hacé una fogata');
    const result = await run(world, petId, agent, 120);

    // La primera acción útil llega enseguida: interpretar cuesta un tick, no
    // ocho versiones medidas en cuarenta mundos imaginados.
    expect(result.firstUsefulTick).not.toBeNull();
    expect(result.firstUsefulTick!).toBeLessThan(6);

    // Y no nació ninguna habilidad para lograrlo: ni se pidió, ni se propuso,
    // ni se evaluó. Actuar es lo normal; aprender es la excepción.
    expect(typesOf(result.events)).not.toContain('skill.requested');
    expect(typesOf(result.events)).not.toContain('skill.created');
    expect(provider.countOf('skill.propose')).toBe(0);
    expect(provider.countOf('skill.contract')).toBe(0);

    // El encargo se cumplió de verdad, medido en el mundo.
    const held = world.entities[petId]!.components.inventory!.items.map(
      (id) => world.entities[id]?.kind,
    );
    const madeFire = Object.values(world.entities).some((entity) => entity.kind === 'campfire');
    expect(held.filter((kind) => kind === 'log').length + (madeFire ? 2 : 0)).toBeGreaterThanOrEqual(2);
  });

  it('cada paso se juzga contra el mundo, y el progreso se ve paso a paso', async () => {
    const { world, petId } = forestWorld();
    const provider = new ScriptedLanguageModel({ 'interpret.command': WOOD_THEN_FIRE });
    const agent = makeAgent(petId, provider);

    agent.receiveUserMessage('conseguí madera y hacé una fogata');
    const result = await run(world, petId, agent, 120);

    const types = typesOf(result.events);
    expect(types).toContain('plan.step.started');
    // El mundo confirmó al menos un efecto: eso es lo que distingue «lo hice»
    // de «corrí el programa».
    expect(types).toContain('plan.step.verified');
    // Y cada paso anunciado se dice en primera persona, no como un volcado.
    const started = result.events.find((event) => event.type === 'plan.step.started');
    expect(String(started?.data.purpose)).toMatch(/junto|recojo|fabrico/);
  });

  it('si el mundo se mueve debajo del plan, vuelve a mirar en vez de dar por hecho', async () => {
    // Un solo tronco, y lejos: hay camino de sobra para que el mundo cambie
    // mientras ella va.
    const { world, petId } = forestWorld({ logs: 0 });
    spawn(world, 'log', { position: { x: 12, y: 8 }, portable: {} });
    const provider = new ScriptedLanguageModel({ 'interpret.command': WOOD_THEN_FIRE });
    const agent = makeAgent(petId, provider);

    agent.receiveUserMessage('conseguí madera y hacé una fogata');
    // A mitad de camino el mundo se mueve: el tronco al que iba ya no está, y
    // aparecen dos en la otra punta. El plan de hace unos ticks habla de algo
    // que no existe, y el nuevo está donde ella ni miraba.
    const result = await run(world, petId, agent, 160, (tick) => {
      if (tick !== 5) return;
      for (const entity of Object.values(world.entities)) {
        if (entity.kind === 'log' && entity.components.position) delete world.entities[entity.id];
      }
      spawn(world, 'log', { position: { x: 3, y: 1 }, portable: {} });
      spawn(world, 'log', { position: { x: 4, y: 1 }, portable: {} });
    });

    const types = typesOf(result.events);

    // 1. Se dio cuenta, y con nombre. La falta se OBSERVA contra el mundo —en el
    //    paso, en la meta, o al replanificar con su motivo— y en ningún caso
    //    pasa desapercibida.
    const observed = result.events.filter(
      (event) =>
        event.type === 'plan.replanned' ||
        event.type === 'plan.step.unverified' ||
        event.type === 'goal.outcome.unmet' ||
        event.type === 'strategy.failed',
    );
    expect(observed.length).toBeGreaterThan(0);
    expect(JSON.stringify(observed[0]!.data)).toMatch(/no-pude-recogerlo|sostiene|camino/);

    // 2. Y volvió a mirar: se armó otro plan con la percepción de AHORA, que es
    //    un mundo distinto del que se planificó.
    const replanned =
      types.includes('plan.replanned') ||
      types.includes('causal.plan.revised') ||
      types.filter((type) => type === 'strategy.selected').length > 1;
    expect(replanned).toBe(true);

    // 3. Y la garantía que importa: si el encargo se dio por cumplido, el mundo
    //    lo respalda. Un «listo» sin fogata sería la falsa finalización que
    //    todo esto existe para impedir.
    const completedGoals = result.events.filter((event) => event.type === 'goal.completed');
    if (completedGoals.length > 0) {
      const held = world.entities[petId]!.components.inventory!.items.map(
        (id) => world.entities[id]?.kind,
      );
      const madeFire = Object.values(world.entities).some((entity) => entity.kind === 'campfire');
      expect(madeFire || held.filter((kind) => kind === 'log').length >= 2).toBe(true);
    }
  });
});
