import { createWorld } from '@anima/sim-core';
import type { GameMap } from '../map.js';
import { column, food, material, pet, put, rock, tree } from '../terrain.js';

/**
 * Mapa 3 — La vigía.
 *
 * El mapa más grande y el más abierto. Arriba, tras un farallón de roca, hay
 * una criatura aterida que no se mueve y no habla. Abajo, el taller. En el
 * medio, un mundo más ancho que su vista: la materia que hace falta no se ve
 * desde ninguna parte, así que hay que salir a buscarla y acordarse de dónde
 * estaba.
 *
 * Lo que se le pide no tiene una sola forma: que levante algo en la cima y que
 * la criatura deje de estar como está. Un refugio de bloques, un fogón, una
 * pared que corte el viento — el juez no pregunta qué construyó. Pregunta si
 * hay obra puesta arriba, si nació una habilidad que antes no existía, y si la
 * criatura cambió DESPUÉS de que la obra estuviera.
 *
 * Es el mapa donde las capacidades tienen que combinarse: explorar, fabricar,
 * levantar, inventar una conducta repetible y tratar con otro ser.
 */
export const vigia: GameMap = {
  id: 'vigia',
  name: 'La vigía',
  order: 3,
  mission: {
    id: 'vigia',
    name: 'La vigía de la cima',
    briefing:
      'Arriba, pasando las rocas, hay una criatura aterida que no aguanta ' +
      'mucho más. Subí, levantá algo en la cima que la ampare y hacé lo que ' +
      'haga falta para que deje de estar así. Vas a tener que buscar material ' +
      'lejos: acá abajo no hay bastante.',
    tests: [
      'Explorar más allá del rango de percepción y recordar lugares',
      'Inventar una receta y fabricar sus piezas',
      'Levantar una obra de varios bloques en una zona concreta',
      'Inventar una habilidad nueva que el evaluador promueva',
      'Cambiar el estado de otra entidad mediante una regla inventada',
      'Encadenar todo en el orden correcto',
    ],
    zones: [
      { id: 'taller', label: 'el taller de abajo', x: 0, y: 8, width: 21, height: 3 },
      { id: 'cima', label: 'la cima', x: 6, y: 0, width: 9, height: 3 },
    ],
    objectives: [
      {
        id: 'receta-nueva',
        describe: 'el mundo aprendió a fabricar algo que antes no sabía',
        kind: 'rule-learned',
        gate: 'recipe',
      },
      {
        id: 'obra-en-la-cima',
        describe: 'hay al menos tres bloques que fabricó y colocó en la cima',
        kind: 'entity-in-zone',
        query: { createdDuringRun: true, placed: true },
        zone: 'cima',
        min: 3,
      },
      {
        id: 'habilidad-nueva',
        describe: 'nació una habilidad nueva y el evaluador la promovió',
        kind: 'event-happened',
        event: 'skill.promoted',
      },
      {
        id: 'criatura-cambiada',
        describe: 'la criatura dejó de ser lo que era',
        kind: 'all',
        of: [
          {
            id: 'ya-no-esta-aterida',
            describe: 'no queda ninguna criatura aterida',
            kind: 'no-entity',
            query: { kind: 'criatura-aterida' },
          },
          {
            id: 'sigue-siendo-ella',
            describe: 'la que estaba se transformó (no se la rompió)',
            kind: 'entity-exists',
            query: { createdDuringRun: false, kindIsNew: true },
          },
        ],
      },
      {
        id: 'anima-en-la-cima',
        describe: 'Ánima llegó a la cima',
        kind: 'agent-in-zone',
        zone: 'cima',
      },
      {
        id: 'orden-causal',
        describe: 'la obra estuvo antes de que la criatura cambiara',
        kind: 'sequence',
        of: ['obra-en-la-cima', 'criatura-cambiada'],
      },
    ],
  },
  build(seed) {
    // 21×11: más ancho que su vista (rango 8), que es lo que obliga a
    // explorar en vez de mirar.
    const world = createWorld({ width: 21, height: 11, seed });
    const petId = pet(world, { x: 2, y: 9 }, { energy: 38, range: 8 });

    // El farallón: roca dura de lado a lado con dos pasos. No cierra el mapa
    // —subir tiene que ser posible sin inventar nada— pero separa el arriba
    // del abajo, y hace de la cima un lugar y no una fila más.
    for (const spot of column(0, 3, 6)) rock(world, spot, 5);
    for (let x = 1; x <= 19; x++) {
      if (x === 4 || x === 16) continue; // los dos pasos
      rock(world, { x, y: 4 }, 5);
    }

    // El taller de abajo: lo justo para empezar, nunca lo suficiente.
    material(world, 'tronco', [
      { x: 1, y: 10 },
      { x: 4, y: 9 },
    ]);
    material(world, 'fibra', [{ x: 3, y: 10 }]);
    material(world, 'piedra', [{ x: 0, y: 9 }]);
    tree(world, { x: 6, y: 10 });
    food(world, { x: 5, y: 9 });

    // Lo que falta está lejos, repartido en las puntas: desde el arranque no
    // se ve nada de esto, y desde la cima tampoco. Hay que ir, y hay que
    // volver sabiendo a dónde.
    material(world, 'tronco', [
      { x: 18, y: 9 },
      { x: 19, y: 10 },
      { x: 12, y: 10 },
    ]);
    material(world, 'fibra', [
      { x: 17, y: 8 },
      { x: 14, y: 9 },
    ]);
    material(world, 'piedra', [
      { x: 20, y: 8 },
      { x: 10, y: 9 },
    ]);
    material(world, 'arcilla', [
      { x: 19, y: 6 },
      { x: 18, y: 7 },
    ]);
    material(world, 'resina', [{ x: 20, y: 5 }]);
    tree(world, { x: 20, y: 10 });
    tree(world, { x: 13, y: 6 });
    rock(world, { x: 8, y: 6 }, 4);
    rock(world, { x: 11, y: 7 }, 4);
    food(world, { x: 16, y: 10 });
    food(world, { x: 19, y: 3 });

    // La criatura: quieta, dura de romper, y sin nada que dar. No es comida
    // ni herramienta ni material — la única cosa interesante que se puede
    // hacer con ella es cambiarla.
    put(
      world,
      'criatura-aterida',
      { x: 10, y: 1 },
      { hardness: { value: 6 }, durability: { current: 20, max: 20 } },
    );

    return { world, petId, meta: { name: 'vigia', seed } };
  },
};
