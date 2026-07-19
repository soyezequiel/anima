import { describe, expect, it } from 'vitest';
import {
  buildPerception,
  checkInvariants,
  createWorld,
  spawn,
  stepWorld,
  validateInteraction,
  validateRecipe,
} from '../src/index.js';
import type { WorldState } from '../src/index.js';

/**
 * "Ofrecer dónde pisar" es la propiedad que le faltaba al mundo para que algo
 * construido pudiera cambiar por dónde se camina. Estas pruebas fijan la regla
 * general; ningún caso de aquí nombra un puente ni una misión.
 */
function riverWorld(): { world: WorldState; petId: string } {
  const world = createWorld({ width: 5, height: 1, seed: 3 });
  const petId = spawn(world, 'pet', {
    position: { x: 0, y: 0 },
    collider: { solid: true },
    inventory: { items: [], capacity: 4 },
    agent: { name: 'Anima', perceptionRange: 5 },
  }).id;
  spawn(world, 'agua', { position: { x: 1, y: 0 }, water: {} });
  return { world, petId };
}

describe('lo que ofrece dónde pisar', () => {
  it('sin ello, el agua sigue cortando el paso', () => {
    const { world, petId } = riverWorld();
    const events = stepWorld(world, [{ actorId: petId, intent: { type: 'move', dir: 'right' } }]);
    const resolved = events.find((e) => e.type === 'action.resolved')!;
    expect(resolved.data.success).toBe(false);
    expect(resolved.data.reason).toBe('water');
  });

  it('una cosa con `footing` puesta en el agua vuelve caminable esa celda', () => {
    const { world, petId } = riverWorld();
    const tabla = spawn(world, 'tabla', { portable: {}, footing: {} });
    world.entities[petId]!.components.inventory!.items.push(tabla.id);

    const placed = stepWorld(world, [
      { actorId: petId, intent: { type: 'place', itemId: tabla.id, at: { x: 1, y: 0 } } },
    ]);
    expect(placed.find((e) => e.type === 'item.placed')).toBeDefined();

    const moved = stepWorld(world, [{ actorId: petId, intent: { type: 'move', dir: 'right' } }]);
    expect(moved.find((e) => e.type === 'action.resolved')!.data.success).toBe(true);
    expect(world.entities[petId]!.components.position).toEqual({ x: 1, y: 0 });
  });

  it('sobre el terreno se construye, pero sobre otra cosa no', () => {
    const { world, petId } = riverWorld();
    const tabla = spawn(world, 'tabla', { portable: {}, footing: {} });
    const otra = spawn(world, 'tabla', { portable: {}, footing: {} });
    const inv = world.entities[petId]!.components.inventory!;
    inv.items.push(tabla.id, otra.id);

    stepWorld(world, [
      { actorId: petId, intent: { type: 'place', itemId: tabla.id, at: { x: 1, y: 0 } } },
    ]);
    const second = stepWorld(world, [
      { actorId: petId, intent: { type: 'place', itemId: otra.id, at: { x: 1, y: 0 } } },
    ]);
    const resolved = second.find((e) => e.type === 'action.resolved')!;
    expect(resolved.data.success).toBe(false);
    expect(resolved.data.reason).toBe('cell-occupied');
  });

  it('un piso admite que haya algo encima sin violar los invariantes', () => {
    const { world, petId } = riverWorld();
    const tabla = spawn(world, 'tabla', {
      portable: {},
      footing: {},
      collider: { solid: true },
    });
    world.entities[petId]!.components.inventory!.items.push(tabla.id);
    stepWorld(world, [
      { actorId: petId, intent: { type: 'place', itemId: tabla.id, at: { x: 1, y: 0 } } },
    ]);
    stepWorld(world, [{ actorId: petId, intent: { type: 'move', dir: 'right' } }]);
    expect(world.entities[petId]!.components.position).toEqual({ x: 1, y: 0 });
    expect(checkInvariants(world)).toEqual([]);
  });

  it('la percepción lo expone: lo que construyó no le parece un obstáculo', () => {
    const { world, petId } = riverWorld();
    spawn(world, 'tabla', { position: { x: 3, y: 0 }, footing: {} });
    // buildPerception se prueba entero en perception.test.ts; acá solo importa
    // que el rasgo viaje.
    const perception = buildPerception(world, petId);
    expect(perception.visibleEntities.find((e) => e.kind === 'tabla')?.footing).toBe(true);
  });

  it('la puerta de recetas admite `footing`: es una capacidad inventable', () => {
    const result = validateRecipe(
      {
        id: 'pasarela',
        output: { kind: 'pasarela', components: { portable: {}, footing: {} } },
        ingredients: [{ kind: 'tronco', count: 2 }],
      },
      [],
      new Set(['tronco']),
    );
    expect(result.ok).toBe(true);
  });
});

describe('la puerta de interacciones no guarda promesas rotas', () => {
  it('rechaza pararse o meterse en el agua: el mundo nunca podría ejecutarlo', () => {
    const result = validateInteraction({
      id: 'meterse-en-el-agua',
      description: 'meterse debajo del agua y quedar sumergida',
      stance: 'underneath',
      target: { wet: true },
      effects: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('sobre el agua');
  });

  it('pero junto al agua sí se puede hacer algo: la postura `beside` sigue valiendo', () => {
    const result = validateInteraction({
      id: 'llenar-balde',
      description: 'llenar el balde en el agua',
      stance: 'beside',
      target: { wet: true },
      requires: { heldKind: 'balde' },
      effects: [
        { type: 'transform-held', kind: 'balde-lleno', components: { portable: {} } },
      ],
    });
    expect(result.ok).toBe(true);
  });
});
