import { describe, expect, it } from 'vitest';
import type { ActorIntent } from '@anima/sim-core';
import {
  expandRecipeCost,
  getEntity,
  obtainableKinds,
  recipeProduct,
  spawn,
  stepWorld,
} from '@anima/sim-core';
import {
  BARRICADE_RECIPE,
  BRICK_RECIPE,
  CHAIR_RECIPE,
  MVP_RECIPES,
  STONE_PICK_RECIPE,
  foodBehindWall,
} from '../src/index.js';

/**
 * Las materias primas nuevas (piedra, fibra, arcilla, resina, mineral) y sus
 * fuentes. Lo que estas pruebas custodian es la ESCALERA: cada materia se
 * consigue con lo que abre su peldaño —la roca cede a cualquier herramienta,
 * la veta solo a una buena— y ninguna fuente se adelanta a la historia del
 * hambre (eso lo vigila food-behind-wall.test con su horizonte de 200 ticks).
 */
describe('materias primas', () => {
  const wait = (petId: string): ActorIntent[] => [{ actorId: petId, intent: { type: 'wait' } }];

  /** Un martillo en la mano de la mascota, lista al lado de su objetivo. */
  function armPet(world: ReturnType<typeof foodBehindWall.build>['world'], petId: string, power: number) {
    const pet = getEntity(world, petId)!;
    const tool = spawn(world, 'test-tool', {
      portable: {},
      tool: { power },
      durability: { current: 30, max: 30 },
    });
    pet.components.inventory!.items.push(tool.id);
    return { pet, tool };
  }

  it('el mundo jugable contiene las cinco materias, sueltas o adentro de sus fuentes', () => {
    const { world } = foodBehindWall.build(1);
    const obtainable = obtainableKinds(world);
    for (const kind of ['stone', 'fiber', 'clay', 'resin', 'ore']) {
      expect(obtainable, `falta la materia "${kind}"`).toContain(kind);
    }
  });

  it('la roca cede hasta a la rama (despacio): el primer peldaño no pide herramienta buena', () => {
    const { world, petId } = foodBehindWall.build(1);
    const rock = Object.values(world.entities).find((e) => e.kind === 'rock')!;
    // Rama: poder 1 + fuerza 2 = 3 contra dureza 2 → daño 1 por golpe.
    const { pet, tool } = armPet(world, petId, 1);
    const rockPos = rock.components.position!;
    pet.components.position = { x: rockPos.x, y: rockPos.y - 1 };
    const events = stepWorld(world, [
      { actorId: petId, intent: { type: 'useItem', itemId: tool.id, targetId: rock.id } },
    ]);
    const damaged = events.find((e) => e.type === 'entity.damaged');
    expect(damaged?.data.damage).toBe(1);
  });

  it('la roca rota deja piedras', () => {
    const { world, petId } = foodBehindWall.build(1);
    const rock = Object.values(world.entities).find((e) => e.kind === 'rock')!;
    const { pet, tool } = armPet(world, petId, 8);
    const rockPos = rock.components.position!;
    pet.components.position = { x: rockPos.x, y: rockPos.y - 1 };
    stepWorld(world, [
      { actorId: petId, intent: { type: 'useItem', itemId: tool.id, targetId: rock.id } },
    ]);
    expect(world.entities[rock.id]).toBeUndefined();
    const stones = Object.values(world.entities).filter((e) => e.kind === 'stone');
    // Las dos que soltó la roca, más las dos sueltas del mapa.
    expect(stones.length).toBeGreaterThanOrEqual(2);
  });

  it('la veta no le debe nada a la rama: solo una herramienta buena la abre', () => {
    const { world, petId } = foodBehindWall.build(1);
    const vein = Object.values(world.entities).find((e) => e.kind === 'vein')!;
    const veinPos = vein.components.position!;

    // Rama: 1 + 2 = 3 contra dureza 7 → daño 0. La veta ni se inmuta.
    const weak = armPet(world, petId, 1);
    weak.pet.components.position = { x: veinPos.x, y: veinPos.y + 1 };
    const weakEvents = stepWorld(world, [
      { actorId: petId, intent: { type: 'useItem', itemId: weak.tool.id, targetId: vein.id } },
    ]);
    expect(weakEvents.find((e) => e.type === 'entity.damaged')?.data.damage).toBe(0);
    expect(vein.components.durability!.current).toBe(vein.components.durability!.max);

    // Martillo: 8 + 2 = 10 contra 7 → daño 3 por golpe, y al fondo hay mineral.
    const strong = armPet(world, petId, 8);
    for (let i = 0; i < 3; i++) {
      stepWorld(world, [
        { actorId: petId, intent: { type: 'useItem', itemId: strong.tool.id, targetId: vein.id } },
      ]);
    }
    expect(world.entities[vein.id]).toBeUndefined();
    expect(Object.values(world.entities).some((e) => e.kind === 'ore')).toBe(true);
  });

  it('el arbusto arrancado deja fibra ya; dejado en paz, la brota solo', () => {
    const { world, petId } = foodBehindWall.build(1);
    const fibersBefore = Object.values(world.entities).filter((e) => e.kind === 'fiber').length;
    for (let i = 0; i < 460; i++) stepWorld(world, wait(petId));
    const fibersAfter = Object.values(world.entities).filter((e) => e.kind === 'fiber').length;
    expect(fibersAfter).toBeGreaterThan(fibersBefore);
  });

  it('talar el pino deja troncos Y resina: qué árbol talar dejó de ser una sola pregunta', () => {
    const { world, petId } = foodBehindWall.build(1);
    const pine = Object.values(world.entities).find((e) => e.kind === 'pine')!;
    const resinBefore = Object.values(world.entities).filter((e) => e.kind === 'resin').length;
    const { pet, tool } = armPet(world, petId, 8);
    const pinePos = pine.components.position!;
    pet.components.position = { x: pinePos.x, y: pinePos.y - 1 };
    // 8 + 2 = 10 contra dureza 5 → daño 5: dos golpes a durabilidad 15... son 3.
    for (let i = 0; i < 3; i++) {
      stepWorld(world, [
        { actorId: petId, intent: { type: 'useItem', itemId: tool.id, targetId: pine.id } },
      ]);
    }
    expect(world.entities[pine.id]).toBeUndefined();
    expect(Object.values(world.entities).filter((e) => e.kind === 'resin').length).toBe(
      resinBefore + 1,
    );
  });

  it('las recetas nuevas tocan el suelo: su costo se deriva hasta materia base', () => {
    for (const recipe of [STONE_PICK_RECIPE, BRICK_RECIPE]) {
      const cost = expandRecipeCost(recipe, MVP_RECIPES);
      expect(cost.truncated).toBe(false);
      expect(cost.base.size).toBeGreaterThan(0);
    }
    // Y su materia base existe en el mundo jugable: ninguna es imaginaria.
    const { world } = foodBehindWall.build(1);
    const obtainable = obtainableKinds(world);
    for (const recipe of [STONE_PICK_RECIPE, BRICK_RECIPE]) {
      for (const kind of expandRecipeCost(recipe, MVP_RECIPES).base.keys()) {
        expect(obtainable, `la receta ${recipe.id} pide "${kind}" y el mundo no lo tiene`).toContain(
          kind,
        );
      }
    }
  });

  it('la muralla es el primer árbol de dos capas: su costo se deriva hasta la arcilla', () => {
    // Nadie declara que una muralla vale 4 arcillas. Cuesta lo que cuestan sus
    // ladrillos, que cuestan lo que cuesta el barro (ADR 0031). Hasta hoy
    // ninguna receta semilla ejercía esa derivación: todas tocaban el suelo en
    // un solo salto, así que el ADR estaba implementado y sin usar.
    const cost = expandRecipeCost(BARRICADE_RECIPE, MVP_RECIPES);
    expect(cost.truncated).toBe(false);
    expect([...cost.base]).toEqual([['clay', 4]]);
    // Y en el orden en que hay que construirlo: los ladrillos antes que el muro.
    expect(cost.steps.map((s) => s.recipeId)).toEqual(['brick', 'barricade']);
    expect(cost.steps.find((s) => s.recipeId === 'brick')?.times).toBe(2);
  });

  it('la muralla ya no es una silla mejor: cuesta otra cosa y aguanta otra cosa', () => {
    // El motivo por el que se rehízo. Mientras las dos costaran 2 troncos y
    // bloquearan igual, la silla era una muralla peor y elegir no era elegir.
    const wall = recipeProduct(BARRICADE_RECIPE)!;
    const chair = recipeProduct(CHAIR_RECIPE)!;
    expect(wall.components.hardness!.value).toBeGreaterThan(
      chair.components.hardness!.value * 2,
    );
    const wallNeeds = BARRICADE_RECIPE.ingredients.map((i) => i.kind);
    const chairNeeds = CHAIR_RECIPE.ingredients.map((i) => i.kind);
    expect(wallNeeds.some((k) => chairNeeds.includes(k))).toBe(false);
  });

  it('el barrial repone arcilla: la muralla se puede levantar más de una vez en la vida del mundo', () => {
    // Con 2 arcillas sueltas y nada que las reponga, la muralla (4) se podría
    // construir una sola vez y nunca más: una receta con fecha de vencimiento.
    const { world, petId } = foodBehindWall.build(1);
    const before = Object.values(world.entities).filter((e) => e.kind === 'clay').length;
    expect(before).toBeLessThan(4);
    for (let i = 0; i < 560; i++) stepWorld(world, wait(petId));
    const after = Object.values(world.entities).filter((e) => e.kind === 'clay').length;
    expect(after).toBeGreaterThan(before);
  });

  it('el martillo llega gastado, pero le alcanza para el muro Y para un árbol', () => {
    // La reliquia tiene que seguir contando las dos historias del mundo. Si
    // algún día no le da, la mascota queda encerrada del lado del hambre sin
    // que nada avise: por eso el margen se mide acá y no se confía.
    const { world, petId } = foodBehindWall.build(1);
    const hammer = Object.values(world.entities).find((e) => e.kind === 'hammer')!;
    expect(hammer.components.durability!.current).toBeLessThan(
      hammer.components.durability!.max,
    );

    const pet = getEntity(world, petId)!;
    pet.components.inventory!.items.push(hammer.id);

    // El muro: dureza 5 contra 8+2 → daño 5, y aguanta 10. Dos golpes.
    const wall = Object.values(world.entities).find((e) => e.kind === 'wall')!;
    const wallPos = wall.components.position!;
    pet.components.position = { x: wallPos.x - 1, y: wallPos.y };
    let wallHits = 0;
    while (world.entities[wall.id] && wallHits < 10) {
      stepWorld(world, [
        { actorId: petId, intent: { type: 'useItem', itemId: hammer.id, targetId: wall.id } },
      ]);
      wallHits++;
    }
    expect(world.entities[wall.id]).toBeUndefined();

    // Y todavía queda martillo para talar un árbol (dureza 5, aguanta 15).
    const tree = Object.values(world.entities).find((e) => e.kind === 'tree')!;
    const treePos = tree.components.position!;
    pet.components.position = { x: treePos.x, y: treePos.y - 1 };
    let treeHits = 0;
    while (world.entities[tree.id] && world.entities[hammer.id] && treeHits < 10) {
      stepWorld(world, [
        { actorId: petId, intent: { type: 'useItem', itemId: hammer.id, targetId: tree.id } },
      ]);
      treeHits++;
    }
    expect(world.entities[tree.id]).toBeUndefined();
    expect(Object.values(world.entities).some((e) => e.kind === 'log')).toBe(true);
  });

  it('el pico firme abre la veta; el flojo no: la tirada decide qué peldaño alcanzaste', () => {
    // Un pico bien salido (poder 6) + fuerza 2 = 8 > 7; uno flojo (0.6 × 6 =
    // 3.6) + 2 = 5.6 < 7. La misma receta puede darte la llave o un palo.
    const { world, petId } = foodBehindWall.build(1);
    const vein = Object.values(world.entities).find((e) => e.kind === 'vein')!;
    const veinPos = vein.components.position!;

    const poor = armPet(world, petId, 6 * 0.6);
    poor.pet.components.position = { x: veinPos.x, y: veinPos.y + 1 };
    const poorEvents = stepWorld(world, [
      { actorId: petId, intent: { type: 'useItem', itemId: poor.tool.id, targetId: vein.id } },
    ]);
    expect(poorEvents.find((e) => e.type === 'entity.damaged')?.data.damage).toBe(0);

    const good = armPet(world, petId, 6);
    const goodEvents = stepWorld(world, [
      { actorId: petId, intent: { type: 'useItem', itemId: good.tool.id, targetId: vein.id } },
    ]);
    expect(goodEvents.find((e) => e.type === 'entity.damaged')?.data.damage).toBe(1);
  });
});
