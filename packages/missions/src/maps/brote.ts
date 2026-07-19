import { createWorld } from '@anima/sim-core';
import type { GameMap } from '../map.js';
import { food, material, pet, put, rock, tree, water } from '../terrain.js';

/**
 * Mapa 2 — El brote sediento.
 *
 * Hay un estanque en una punta y un brote reseco en la otra. Nada más. El
 * problema no es llegar: es que el agua no se lleva en las manos, y el motor
 * lo dice sin discurso — el agua no es `portable`, así que `pickup` sobre ella
 * falla siempre.
 *
 * Para salvar esa distancia hace falta una cadena entera que el mundo no
 * tiene: una cosa que contenga (receta), la regla de que esa cosa se llene
 * junto al agua (interacción), la de que lo lleno se vuelque sobre el brote
 * (otra interacción), y el orden — llenar antes de volcar, volcar donde el
 * brote está. Ninguna de las cuatro está escrita en ninguna parte.
 *
 * La misión no nombra el recipiente ni los verbos. Mide que la materia se haya
 * transformado: que algo que ya estaba en el mundo terminara siendo algo que
 * no existía, y que eso haya pasado por reglas nacidas en la partida.
 */
export const brote: GameMap = {
  id: 'brote',
  name: 'El brote sediento',
  order: 2,
  mission: {
    id: 'brote',
    name: 'Darle agua al brote',
    briefing:
      'Ese brote se está secando y el agua está en el estanque, en la otra ' +
      'punta. Con las manos no la vas a poder traer: el agua se te escurre. ' +
      'Arreglátelas para llevarle agua al brote antes de que se seque del todo.',
    tests: [
      'Inventar una receta de fabricación durante la partida',
      'Inventar una interacción que el mundo no admitía',
      'Encadenar dos transformaciones en el orden correcto',
      'Transportar el resultado de una transformación',
      'Cambiar el estado de una entidad que ya existía',
    ],
    zones: [
      { id: 'estanque', label: 'el estanque', x: 0, y: 0, width: 5, height: 9 },
      { id: 'huerta', label: 'la huerta', x: 12, y: 0, width: 5, height: 9 },
    ],
    objectives: [
      {
        id: 'receta-nueva',
        describe: 'el mundo aprendió a fabricar algo que antes no sabía',
        kind: 'rule-learned',
        gate: 'recipe',
      },
      {
        id: 'objeto-fabricado',
        describe: 'fabricó ese algo de verdad (no lo encontró)',
        kind: 'entity-exists',
        query: { crafted: true, kindIsNew: true },
      },
      {
        id: 'dos-reglas-de-trato',
        describe: 'el mundo aprendió dos formas nuevas de tratar con las cosas',
        kind: 'rule-learned',
        gate: 'interaction',
        min: 2,
      },
      {
        id: 'las-uso',
        describe: 'y las ejecutó, no solo las imaginó',
        kind: 'event-happened',
        event: 'interaction.performed',
        min: 2,
      },
      {
        id: 'brote-transformado',
        describe: 'algo que ya estaba en el mundo terminó siendo algo que no existía',
        kind: 'entity-exists',
        query: { createdDuringRun: false, kindIsNew: true },
      },
      {
        id: 'brote-ya-no-esta-seco',
        describe: 'no queda ningún brote seco',
        kind: 'no-entity',
        query: { kind: 'brote-seco' },
      },
      {
        id: 'orden-causal',
        describe: 'primero fabricó, después aprendió a usarlo, después cambió el brote',
        kind: 'sequence',
        of: ['objeto-fabricado', 'las-uso', 'brote-transformado'],
      },
    ],
  },
  build(seed) {
    // 17×9. Las dos puntas lejos a propósito: la cadena tiene que sobrevivir
    // al viaje, y un recipiente que se vacía al caminar no serviría.
    const world = createWorld({ width: 17, height: 9, seed });
    const petId = pet(world, { x: 8, y: 4 }, { energy: 34, range: 12 });

    // El estanque: agua de sobra, y ni una gota que se pueda levantar.
    water(world, [
      { x: 1, y: 3 },
      { x: 1, y: 4 },
      { x: 1, y: 5 },
      { x: 2, y: 4 },
      { x: 2, y: 5 },
      { x: 0, y: 4 },
    ]);

    // Materia para pensar un recipiente: barro, fibra, madera, piedra. Que
    // haya varias es lo que hace que la idea sea de ella — con un solo
    // material, el mapa estaría dictando la receta.
    material(world, 'arcilla', [
      { x: 3, y: 2 },
      { x: 4, y: 6 },
      { x: 2, y: 7 },
    ]);
    material(world, 'fibra', [
      { x: 6, y: 1 },
      { x: 5, y: 7 },
    ]);
    material(world, 'tronco', [
      { x: 7, y: 2 },
      { x: 6, y: 6 },
    ]);
    material(world, 'piedra', [{ x: 9, y: 7 }]);
    material(world, 'resina', [{ x: 7, y: 7 }]);
    tree(world, { x: 5, y: 0 });
    tree(world, { x: 10, y: 8 });
    rock(world, { x: 11, y: 2 });

    // El brote: una cosa viva y quieta, que no da nada y no se puede comer.
    // Está seco, y "seco" acá no es un adjetivo: es su tipo, y cambiarlo es
    // lo único que cuenta como haberlo salvado.
    put(world, 'brote-seco', { x: 15, y: 4 }, { hardness: { value: 1 }, durability: { current: 4, max: 4 } });

    // Algo de comida para que el hambre no le gane a la misión: este mapa
    // pregunta por la cadena, no por la supervivencia.
    food(world, { x: 9, y: 2 });
    food(world, { x: 13, y: 7 });

    return { world, petId, meta: { name: 'brote', seed } };
  },
};
