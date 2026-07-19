import { createWorld } from '@anima/sim-core';
import type { GameMap } from '../map.js';
import { column, food, material, pet, rock, tree, water } from '../terrain.js';

/**
 * Mapa 1 — El vado.
 *
 * Un río parte el mundo en dos y no hay puente, ni vado, ni rodeo: el agua va
 * de borde a borde. Toda la comida está del otro lado. Nada de lo que Ánima
 * sabe hacer sirve, porque el problema no es de fuerza ni de camino — es que
 * al mundo le falta una cosa que todavía no existe.
 *
 * La misión no dice qué cosa. Dice qué tiene que pasar: que aparezca algo
 * nacido en la partida, que ese algo quede sobre el agua, que el paso se abra
 * y que ella lo cruce. Un puente de troncos, una piedra plana, una balsa: al
 * juez le da igual el nombre. Lo que mide es el efecto.
 */
export const vado: GameMap = {
  id: 'vado',
  name: 'El vado',
  order: 1,
  mission: {
    id: 'vado',
    name: 'Cruzar el río',
    briefing:
      'Del otro lado del río hay comida y de este lado no queda nada. El agua ' +
      'te corta el paso de punta a punta y no se puede nadar. Fabricá algo que ' +
      'te aguante el peso, ponelo sobre el agua y cruzá.',
    tests: [
      'Inventar una receta que el mundo no traía',
      'Crear un objeto de un tipo que no existía',
      'Dotarlo de las propiedades que su función exige',
      'Colocarlo en una celda concreta (`place`)',
      'Aprovechar el cambio que produjo en el mundo',
    ],
    zones: [
      { id: 'taller', label: 'la orilla de acá', x: 0, y: 0, width: 7, height: 9 },
      { id: 'rio', label: 'el río', x: 7, y: 0, width: 1, height: 9 },
      { id: 'orilla-lejana', label: 'la orilla lejana', x: 8, y: 0, width: 7, height: 9 },
    ],
    objectives: [
      {
        id: 'invento-existe',
        describe: 'existe algo de un tipo que este mundo no tenía',
        kind: 'entity-exists',
        query: { createdDuringRun: true, kindIsNew: true },
      },
      {
        id: 'puesto-en-el-agua',
        describe: 'ese algo está colocado sobre el río',
        kind: 'entity-in-zone',
        query: { createdDuringRun: true, placed: true },
        zone: 'rio',
      },
      {
        id: 'paso-abierto',
        describe: 'se abrió un camino de una orilla a la otra',
        kind: 'path-open',
        from: { x: 2, y: 4 },
        to: { x: 12, y: 4 },
      },
      {
        id: 'cruzo',
        describe: 'Ánima llegó a la orilla lejana',
        kind: 'agent-in-zone',
        zone: 'orilla-lejana',
      },
      {
        id: 'orden-causal',
        describe: 'primero lo puso, después se abrió el paso, después cruzó',
        kind: 'sequence',
        of: ['puesto-en-el-agua', 'paso-abierto', 'cruzo'],
      },
    ],
  },
  build(seed) {
    // 15×9. El río en x=7, de borde a borde: no hay rodeo posible, y eso es
    // deliberado — un mapa con atajo mide la astucia del rodeo, no la
    // capacidad de inventar.
    const world = createWorld({ width: 15, height: 9, seed });
    const petId = pet(world, { x: 2, y: 4 }, { energy: 26, range: 14 });
    water(world, column(7, 0, 8));

    // El taller: materia suficiente y variada para que la idea sea SUYA. Si
    // solo hubiera troncos, el mapa estaría diciéndole con qué hacerlo.
    // Alcanza para una cosa suelta Y para una obra de tres piezas: el mapa no
    // elige por ella. Si solo diera para lo primero, estaría diciéndole que su
    // idea tiene que caber en una celda; si solo diera para lo segundo, que no.
    material(world, 'tronco', [
      { x: 1, y: 1 },
      { x: 3, y: 6 },
      { x: 0, y: 5 },
      { x: 4, y: 2 },
      { x: 2, y: 1 },
      { x: 5, y: 3 },
      { x: 1, y: 7 },
      { x: 4, y: 4 },
    ]);
    material(world, 'fibra', [
      { x: 2, y: 7 },
      { x: 5, y: 5 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 2, y: 5 },
      { x: 5, y: 7 },
    ]);
    material(world, 'piedra', [
      { x: 1, y: 3 },
      { x: 4, y: 7 },
      { x: 0, y: 7 },
    ]);
    material(world, 'rama', [
      { x: 3, y: 3 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 4, y: 5 },
    ]);
    material(world, 'resina', [
      { x: 5, y: 1 },
      { x: 3, y: 4 },
      { x: 1, y: 5 },
    ]);
    tree(world, { x: 0, y: 8 });
    tree(world, { x: 5, y: 8 });
    rock(world, { x: 6, y: 0 });

    // La otra orilla: la comida, y nada con qué construir. Cruzar no es
    // opcional ni reversible por conveniencia.
    food(world, { x: 12, y: 4 });
    food(world, { x: 13, y: 6 });
    food(world, { x: 11, y: 1 });
    tree(world, { x: 14, y: 8 });

    return { world, petId, meta: { name: 'vado', seed } };
  },
};
