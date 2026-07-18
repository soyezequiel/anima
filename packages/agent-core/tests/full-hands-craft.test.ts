import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import { allEntities, buildPerception, getEntity, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { foodBehindWall, MVP_SCENARIOS, PRACTICE_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * La corrida real: "fabrica una fogata" con un pedernal JUSTO al lado, pero el
 * inventario lleno de sobras (rama, martillo, troncos de más). Antes la mascota
 * caminaba hasta el pedernal, fallaba al recogerlo en silencio (inventario
 * lleno) y reportaba "no veo más por acá" — culpando a la vista de un problema
 * de manos llenas. Ahora suelta a conciencia lo que no sirve y termina la obra.
 */
describe('fogata con las manos llenas: suelta a conciencia y construye', () => {
  function makeAgent(petId: string) {
    return new AnimaAgent({
      petId,
      petName: 'Anima',
      provider: new MockModelProvider(),
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      practiceScenarios: PRACTICE_SCENARIOS,
      evaluationSeeds: [11],
      guidanceEnabled: false,
      now: () => '2026-07-16T00:00:00Z',
    });
  }

  function giveFromWorld(
    world: ReturnType<typeof foodBehindWall.build>['world'],
    petId: string,
    kinds: string[],
  ) {
    const pet = getEntity(world, petId)!;
    for (const kind of kinds) {
      if (pet.components.inventory!.items.length >= pet.components.inventory!.capacity) break;
      const item = allEntities(world).find(
        (e) =>
          e.kind === kind &&
          e.components.position &&
          !pet.components.inventory!.items.includes(e.id),
      );
      if (item) {
        delete item.components.position;
        pet.components.inventory!.items.push(item.id);
      }
    }
  }

  it('manos llenas de sobras: suelta lo inútil, recoge el pedernal y la fogata aparece', async () => {
    const { world, petId } = foodBehindWall.build(931);
    const pet = getEntity(world, petId)!;
    // Los 2 troncos que la receta pide + 4 sobras hasta llenar la capacidad (6).
    giveFromWorld(world, petId, ['log', 'log', 'branch', 'hammer', 'log', 'log']);
    expect(pet.components.inventory!.items).toHaveLength(6);

    const agent = makeAgent(petId);
    agent.receiveUserMessage('fabrica una fogata');

    let droppedJunk = false;
    for (let i = 0; i < 40 && !allEntities(world).some((e) => e.kind === 'campfire'); i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent) {
        const events = stepWorld(world, [{ actorId: petId, intent }]);
        agent.observe(events);
        if (events.some((e) => e.type === 'item.dropped')) droppedJunk = true;
      }
    }

    // La construyó de verdad, y para lograrlo tuvo que soltar una sobra.
    expect(allEntities(world).some((e) => e.kind === 'campfire')).toBe(true);
    expect(droppedJunk).toBe(true);
    // Lo soltado fue una sobra (rama o martillo), nunca la materia de la receta.
    const onGround = allEntities(world).filter((e) => e.components.position);
    expect(onGround.some((e) => e.kind === 'branch' || e.kind === 'hammer')).toBe(true);
  });

  it('con lugar en los brazos, junta el pedernal y construye igual', async () => {
    const { world, petId } = foodBehindWall.build(931);
    giveFromWorld(world, petId, ['log', 'log']);
    const agent = makeAgent(petId);
    agent.receiveUserMessage('fabrica una fogata');

    for (let i = 0; i < 30 && !allEntities(world).some((e) => e.kind === 'campfire'); i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }
    expect(allEntities(world).some((e) => e.kind === 'campfire')).toBe(true);
  });
});
