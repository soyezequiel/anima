import { createWorld } from '@anima/sim-core';
import type { GameMap } from '../map.js';
import { column, food, material, pet, rock, tree, water } from '../terrain.js';

/**
 * Mapa 4 — El cauce ancho.
 *
 * El vado otra vez, pero el río mide CUATRO celdas. Y esa sola diferencia
 * cambia de qué trata el problema.
 *
 * En el vado alcanzaba con una idea: una cosa que se pise, puesta en la única
 * celda mojada. Inventarla era todo el trabajo, y el plan era tan corto que
 * ningún error de planificación llegaba a notarse. Acá inventar sigue siendo
 * necesario y ya no es suficiente: hay que sostener la idea a lo largo de
 * cuatro celdas, y eso son cuatro veces la materia, cuatro veces las manos, y
 * un plan que no entra en un solo viaje.
 *
 * Es el mapa que mide lo que el vado no podía medir, porque lo que se rompió en
 * las corridas reales no fue la invención sino todo lo que viene después:
 *
 * - **La cuenta que nadie hacía.** Un plan de cuatro piezas puede costar más
 *   materia de la que el mundo tiene, y eso no se nota hasta que ya es tarde.
 *   Acá el costo importa de verdad, así que la materia alcanza con margen pero
 *   no sobra: planificar una obra desmedida se paga.
 * - **Las manos.** Cuatro piezas no entran en seis ranuras, así que cruzar
 *   obliga a hacer viajes — juntar, colocar, volver. Un plan que exija tenerlo
 *   todo encima a la vez no se puede ejecutar, por más bien pensado que esté.
 * - **El orden.** La celda más lejana solo es alcanzable parándose en la
 *   anterior. El tendido tiene que crecer desde la orilla hacia adentro, y eso
 *   no está escrito en ningún lado: es una consecuencia de que no se puede
 *   colocar donde no se llega con el brazo.
 *
 * Lo que el mapa NO pide es un vehículo. Sería lindo que cruzara navegando,
 * pero el motor no sabe lo que es un vehículo —nada transporta a nadie, y
 * `footing` es la única forma de estar sobre el agua— así que un mapa que lo
 * exigiera sería imposible y no difícil. Cuando el motor sepa llevar pasajeros,
 * este mismo mapa se va a poder ganar de las dos maneras sin tocarle una línea:
 * los objetivos miden que haya cruzado, no cómo.
 */
export const cauce: GameMap = {
  id: 'cauce',
  name: 'El cauce ancho',
  order: 4,
  mission: {
    id: 'cauce',
    name: 'Cruzar el cauce',
    briefing:
      'Este río es mucho más ancho que el otro: cuatro pasos de agua de punta ' +
      'a punta, y tampoco se puede nadar. La comida está del otro lado. Con ' +
      'una sola tabla no llegás ni a la mitad: vas a tener que tender algo que ' +
      'aguante el peso hasta la otra orilla, y hacerlo por partes.',
    tests: [
      'Sostener una idea a lo largo de varias celdas, no de una',
      'Planificar un costo que la materia del mundo pueda pagar',
      'Construir en viajes: juntar, colocar, volver a buscar',
      'Derivar el orden del alcance del brazo, sin que nadie lo diga',
      'Aprovechar el cambio que produjo en el mundo',
    ],
    zones: [
      { id: 'taller', label: 'la orilla de acá', x: 0, y: 0, width: 6, height: 9 },
      { id: 'cauce', label: 'el cauce', x: 6, y: 0, width: 4, height: 9 },
      { id: 'orilla-lejana', label: 'la orilla lejana', x: 10, y: 0, width: 7, height: 9 },
    ],
    objectives: [
      {
        id: 'invento-existe',
        describe: 'existe algo de un tipo que este mundo no tenía',
        kind: 'entity-exists',
        query: { createdDuringRun: true, kindIsNew: true },
      },
      {
        // Cuatro, porque el cauce mide cuatro y una entidad ocupa una celda:
        // no es una cuota inventada, es la forma del río contada de otro modo.
        // Se dice como cuenta y no como "un puente" a propósito — el juez no
        // sabe ni quiere saber qué forma tiene lo que ella tendió.
        id: 'tendido-completo',
        describe: 'lo suyo llega de una orilla a la otra',
        kind: 'entity-in-zone',
        query: { createdDuringRun: true, placed: true },
        zone: 'cauce',
        min: 4,
      },
      {
        id: 'paso-abierto',
        describe: 'se abrió un camino de una orilla a la otra',
        kind: 'path-open',
        from: { x: 2, y: 4 },
        to: { x: 14, y: 4 },
      },
      {
        id: 'cruzo',
        describe: 'Ánima llegó a la orilla lejana',
        kind: 'agent-in-zone',
        zone: 'orilla-lejana',
      },
      {
        id: 'orden-causal',
        describe: 'primero lo tendió, después se abrió el paso, después cruzó',
        kind: 'sequence',
        of: ['tendido-completo', 'paso-abierto', 'cruzo'],
      },
    ],
  },
  build(seed) {
    // 17×9. El cauce va de x=6 a x=9, de borde a borde: sin rodeo, igual que en
    // el vado. Lo que cambia es el ancho, y el ancho es el problema.
    const world = createWorld({ width: 17, height: 9, seed });

    // Más energía que en el vado (26), y no por generosidad: el plan es cuatro
    // veces más largo y toda la comida sigue estando del otro lado. Con la
    // ración del vado se moriría a mitad del tendido, y eso mediría el reloj en
    // vez de medir la cabeza. Sigue sin sobrar: no alcanza para vagar.
    const petId = pet(world, { x: 2, y: 4 }, { energy: 44, range: 14 });
    water(world, column(6, 0, 8));
    water(world, column(7, 0, 8));
    water(world, column(8, 0, 8));
    water(world, column(9, 0, 8));

    // El taller. La materia alcanza con margen para cuatro celdas de tendido
    // por cualquiera de los dos caminos —cuatro cosas sueltas, o una obra de
    // cuatro piezas— y no alcanza para el doble. Es deliberado: que el costo
    // ENTRE es lo que vuelve real la pregunta de cuánto cuesta lo que planeó, y
    // que no sobre es lo que hace que planear de más se pague.
    //
    // Y sigue habiendo variedad, por el mismo motivo que en el vado: con un
    // solo material el mapa estaría dictando la receta.
    material(world, 'tronco', [
      { x: 1, y: 1 },
      { x: 3, y: 6 },
      { x: 0, y: 5 },
      { x: 4, y: 2 },
      { x: 2, y: 1 },
      { x: 5, y: 3 },
      { x: 1, y: 7 },
      { x: 4, y: 4 },
      { x: 0, y: 3 },
      { x: 3, y: 8 },
    ]);
    material(world, 'fibra', [
      { x: 2, y: 7 },
      { x: 5, y: 5 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 2, y: 5 },
      { x: 5, y: 7 },
      { x: 1, y: 2 },
      { x: 4, y: 6 },
    ]);
    material(world, 'resina', [
      { x: 5, y: 1 },
      { x: 3, y: 4 },
      { x: 1, y: 5 },
      { x: 4, y: 0 },
      { x: 2, y: 3 },
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
    // Los árboles son la reserva: dos troncos cada uno, pero hay que talarlos.
    // Es lo que le deja recuperarse de una tirada perdida sin que el mapa se
    // vuelva imposible por mala suerte — el defecto que sí tenía el vado.
    tree(world, { x: 0, y: 8 });
    tree(world, { x: 5, y: 8 });
    tree(world, { x: 0, y: 0 });
    rock(world, { x: 5, y: 0 });

    // La otra orilla: la comida, y nada con qué construir. Cruzar no es
    // opcional ni reversible por conveniencia.
    food(world, { x: 14, y: 4 });
    food(world, { x: 15, y: 6 });
    food(world, { x: 13, y: 1 });
    food(world, { x: 11, y: 7 });
    tree(world, { x: 16, y: 8 });

    return { world, petId, meta: { name: 'cauce', seed } };
  },
};
