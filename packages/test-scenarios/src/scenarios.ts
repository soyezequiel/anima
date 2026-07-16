import type { Vec2 } from '@anima/shared';
import { createRng, nextInt } from '@anima/shared';
import type { EntityId, Recipe, WorldState } from '@anima/sim-core';
import { createWorld, spawn } from '@anima/sim-core';

/**
 * La fogata: calienta a distancia 2 y quema al que se pega. Se construye con
 * troncos (del árbol talado) y un pedernal que la encienda — el ingrediente
 * que la mascota no siempre tiene, y por el que tiene que pedir ayuda.
 */
export const CAMPFIRE_RECIPE: Recipe = {
  id: 'campfire',
  output: {
    kind: 'campfire',
    components: {
      heatSource: { warmthPerTick: 0.3, range: 2 },
      hazard: { damagePerTick: 1 },
    },
  },
  ingredients: [
    { kind: 'log', count: 2 },
    { kind: 'flint', count: 1 },
  ],
};

/**
 * La silla: el objeto más simple que igual hace algo. No hay acción "sentarse"
 * ni componente de descanso, así que una silla "para sentarse" sería
 * decoración inerte. Esta, en cambio, usa lo que el motor ya entiende: ocupa
 * lugar (se puede construir un obstáculo), se rompe fácil y al romperse
 * devuelve un tronco. Lo que hace real a un objeto no es su nombre: son sus
 * componentes.
 */
export const CHAIR_RECIPE: Recipe = {
  id: 'chair',
  output: {
    kind: 'chair',
    components: {
      collider: { solid: true },
      hardness: { value: 2 },
      durability: { current: 6, max: 6 },
      drops: [{ kind: 'log', components: { portable: {} } }],
    },
  },
  ingredients: [{ kind: 'log', count: 2 }],
};

/**
 * La antorcha: calor chico y portátil. Es el eslabón intermedio de la cadena
 * de combinaciones — con lo mismo que enciende una fogata se puede hacer algo
 * más barato y más débil, y elegir entre las dos es una decisión real.
 */
export const TORCH_RECIPE: Recipe = {
  id: 'torch',
  output: {
    kind: 'torch',
    components: {
      portable: {},
      heatSource: { warmthPerTick: 0.15, range: 1 },
    },
  },
  ingredients: [
    { kind: 'log', count: 1 },
    { kind: 'flint', count: 1 },
  ],
};

/**
 * La empalizada: un muro que se fabrica. Devuelve un tronco al romperse
 * (menos de lo que costó: la materia no crece) y es más blanda que el muro
 * de piedra — la rama no la daña, el martillo sí.
 */
export const BARRICADE_RECIPE: Recipe = {
  id: 'barricade',
  output: {
    kind: 'barricade',
    components: {
      collider: { solid: true },
      hardness: { value: 3 },
      durability: { current: 8, max: 8 },
      drops: [{ kind: 'log', components: { portable: {} } }],
    },
  },
  ingredients: [{ kind: 'log', count: 2 }],
};

/**
 * Lo que el mundo del MVP admite construir. Estilo Doodle God: los mismos
 * materiales base (troncos, pedernal) combinan en cosas distintas, y gastarlos
 * en una es no tenerlos para otra.
 */
export const MVP_RECIPES: Recipe[] = [
  CAMPFIRE_RECIPE,
  CHAIR_RECIPE,
  TORCH_RECIPE,
  BARRICADE_RECIPE,
];

export interface ScenarioBundle {
  world: WorldState;
  petId: EntityId;
  meta: { name: string; seed: number };
}

export type ScenarioFactory = (seed: number) => ScenarioBundle;

export interface ScenarioSpec {
  name: string;
  build: ScenarioFactory;
}

function spawnPet(world: WorldState, pos: Vec2, energy: number): EntityId {
  return spawn(world, 'pet', {
    position: pos,
    collider: { solid: true },
    energy: { current: energy, max: 50, decayPerTick: 0.05 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    // 6: craftear una fogata son 3 objetos en mano, más la herramienta que ya
    // lleva y algo de margen. Con 4, juntar ingredientes era soltar cosas.
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
}

function spawnFood(world: WorldState, pos: Vec2): void {
  spawn(world, 'food', {
    position: pos,
    portable: {},
    edible: {},
    nutrition: { value: 30 },
  });
}

function spawnLog(world: WorldState, pos: Vec2): void {
  spawn(world, 'log', { position: pos, portable: {} });
}

function spawnFlint(world: WorldState, pos: Vec2): void {
  spawn(world, 'flint', { position: pos, portable: {} });
}

function spawnBranch(world: WorldState, pos: Vec2): void {
  spawn(world, 'branch', {
    position: pos,
    portable: {},
    tool: { power: 1 },
    durability: { current: 8, max: 8 },
  });
}

function spawnHammer(world: WorldState, pos: Vec2): void {
  spawn(world, 'hammer', {
    position: pos,
    portable: {},
    tool: { power: 8 },
    durability: { current: 20, max: 20 },
  });
}

/**
 * El árbol es fuente de alimento Y talable: derribarlo con una herramienta
 * fuerte deja troncos, pero destruye la fuente de comida — una consecuencia
 * real que la mascota puede descubrir y lamentar. La rama no lo daña
 * (dureza como la del muro).
 */
function spawnTree(world: WorldState, pos: Vec2): void {
  const log = { portable: {} };
  spawn(world, 'tree', {
    position: pos,
    collider: { solid: true },
    hardness: { value: 5 },
    durability: { current: 15, max: 15 },
    foodSource: { intervalTicks: 400, nutrition: 30, nextSpawnAtTick: 400 },
    drops: [
      { kind: 'log', components: log },
      { kind: 'log', components: log },
      { kind: 'log', components: log },
    ],
  });
}

/**
 * Escenario principal del MVP: el alimento está detrás de un muro completo.
 * No hay ruta libre: la única salida es romper el muro con una herramienta
 * suficientemente fuerte. La rama (cercana, débil) es una trampa plausible.
 * La semilla varía las posiciones de las herramientas del lado de la mascota.
 */
export const foodBehindWall: ScenarioSpec = {
  name: 'food-behind-wall',
  build(seed) {
    // 13×7: espacio para que existan materiales sueltos sin pisarse con la
    // historia. El lado de la mascota (x<5) es el taller; el muro y la comida
    // conservan la misma estructura de siempre, solo que con más aire.
    const world = createWorld({ width: 13, height: 7, seed }, { recipes: MVP_RECIPES });
    const rng = createRng(seed * 7919 + 17);
    const petId = spawnPet(world, { x: 1, y: 3 }, 15);
    // El frío como segundo acto: empieza cómoda (calor al máximo) y pierde
    // despacio, así el hambre —que arranca urgente (energía 15/50)— se
    // resuelve primero y el frío aprieta recién después. Es lo bastante lento
    // para no matar en los 200 ticks de una evaluación de skill (llega a ~42),
    // pero en una partida larga la empuja a hacer fuego con lo que junte.
    world.entities[petId]!.components.temperature = { current: 50, max: 50, lossPerTick: 0.04 };

    for (let y = 0; y < 7; y++) {
      spawn(world, 'wall', {
        position: { x: 5, y },
        collider: { solid: true },
        hardness: { value: 5 },
        durability: { current: 10, max: 10 },
      });
    }
    spawnFood(world, { x: 9, y: 3 });
    // Un bosque, no un árbol único. Producen alimento cada tanto (el mundo es
    // habitable a largo plazo) y su primer brote (tick 400) es posterior al
    // maxTicks de cualquier evaluación (200), así que no alteran las pruebas.
    //
    // Que sean VARIOS es lo que hace que talar uno sea una decisión y no un
    // suicidio: con un solo árbol la respuesta era obvia y no había nada que
    // juzgar (ADR 0019). Van en las esquinas, lejos de los caminos entre la
    // mascota, sus herramientas y el muro.
    spawnTree(world, { x: 11, y: 6 });
    spawnTree(world, { x: 12, y: 0 });
    spawnTree(world, { x: 0, y: 0 });

    // Materiales sueltos por TODO el mapa, no solo en el rincón inicial
    // (estilo Doodle God: los mismos ingredientes combinan en cosas distintas,
    // y gastarlos en una es no tenerlos para otra). Repartidos a ambos lados
    // del muro porque la mascota vive en ambos: tras la historia queda del
    // lado de la comida, y su movimiento es voraz, no un pathfinding — un
    // material inalcanzable detrás del muro sería un pedido que acepta y
    // nunca cumple.
    spawnLog(world, { x: 1, y: 6 });
    spawnLog(world, { x: 3, y: 6 });
    spawnLog(world, { x: 0, y: 4 });
    spawnFlint(world, { x: 3, y: 0 });
    spawnFlint(world, { x: 1, y: 0 });
    spawnLog(world, { x: 11, y: 2 });
    spawnLog(world, { x: 8, y: 5 });
    spawnLog(world, { x: 10, y: 0 });
    spawnFlint(world, { x: 12, y: 4 });

    // La rama siempre queda más cerca de la mascota que el martillo.
    const branchSpots: Vec2[] = [
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 4 },
    ];
    const hammerSpots: Vec2[] = [
      { x: 4, y: 1 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const branchIndex = nextInt(rng, 0, branchSpots.length - 1);
    const hammerIndex = nextInt(rng, 0, hammerSpots.length - 1);
    const branchSpot = branchSpots[branchIndex] ?? branchSpots[0]!;
    const hammerSpot = hammerSpots[hammerIndex] ?? hammerSpots[0]!;
    spawnBranch(world, branchSpot);
    spawnHammer(world, hammerSpot);

    return { world, petId, meta: { name: 'food-behind-wall', seed } };
  },
};

/**
 * Caso normal sin obstáculo: cualquier habilidad de "alcanzar y comer"
 * también debe funcionar cuando no hay muro de por medio.
 */
export const openField: ScenarioSpec = {
  name: 'open-field',
  build(seed) {
    const world = createWorld({ width: 9, height: 5, seed });
    const rng = createRng(seed * 104729 + 3);
    const petId = spawnPet(world, { x: 1, y: 2 }, 15);
    const foodSpots: Vec2[] = [
      { x: 6, y: 1 },
      { x: 7, y: 2 },
      { x: 6, y: 3 },
    ];
    const foodIndex = nextInt(rng, 0, foodSpots.length - 1);
    spawnFood(world, foodSpots[foodIndex] ?? foodSpots[0]!);
    spawnBranch(world, { x: 2, y: 1 });
    spawnHammer(world, { x: 3, y: 3 });
    return { world, petId, meta: { name: 'open-field', seed } };
  },
};

/**
 * Noche fría: la mascota pierde calor corporal y la única fuente de calor es
 * una fogata encendida. El fuego calienta a distancia 2 pero quema al que se
 * pega (hazard a distancia 1): la distancia correcta se aprende, no se regala.
 * Aún fuera de MVP_SCENARIOS: entra a las evaluaciones cuando el agente sepa
 * reaccionar al frío (paso «fogata»).
 */
export const coldNight: ScenarioSpec = {
  name: 'cold-night',
  build(seed) {
    const world = createWorld({ width: 9, height: 5, seed }, { recipes: [CAMPFIRE_RECIPE] });
    const rng = createRng(seed * 31337 + 7);
    const petId = spawnPet(world, { x: 1, y: 2 }, 30);
    const pet = world.entities[petId]!;
    pet.components.temperature = { current: 20, max: 50, lossPerTick: 0.1 };

    spawn(world, 'campfire', {
      position: { x: 6, y: 2 },
      heatSource: { warmthPerTick: 0.3, range: 2 },
      hazard: { damagePerTick: 1 },
    });
    spawnTree(world, { x: 8, y: 4 });
    const foodSpots: Vec2[] = [
      { x: 3, y: 1 },
      { x: 4, y: 3 },
    ];
    spawnFood(world, foodSpots[nextInt(rng, 0, foodSpots.length - 1)] ?? foodSpots[0]!);
    spawnHammer(world, { x: 2, y: 4 });
    return { world, petId, meta: { name: 'cold-night', seed } };
  },
};

/**
 * Noche fría sin fuego: el mundo no regala la fogata, hay que construirla.
 * Todo lo necesario existe —árbol (troncos), martillo (para talar), pedernal
 * (para encender)— pero disperso: la mascota tiene que talar, juntar y
 * craftear antes de congelarse. Es el escenario donde la historia del crafteo
 * se cuenta entera.
 */
export const coldNightUnlit: ScenarioSpec = {
  name: 'cold-night-unlit',
  build(seed) {
    const world = createWorld({ width: 9, height: 5, seed }, { recipes: [CAMPFIRE_RECIPE] });
    const rng = createRng(seed * 15486071 + 13);
    const petId = spawnPet(world, { x: 1, y: 2 }, 30);
    const pet = world.entities[petId]!;
    pet.components.temperature = { current: 25, max: 50, lossPerTick: 0.1 };

    spawnTree(world, { x: 7, y: 2 });
    spawnHammer(world, { x: 2, y: 3 });
    // El pedernal varía de sitio con la semilla: la habilidad no puede
    // memorizar una coordenada, tiene que buscarlo de verdad.
    const flintSpots: Vec2[] = [
      { x: 4, y: 0 },
      { x: 5, y: 4 },
      { x: 3, y: 4 },
    ];
    spawn(world, 'flint', {
      position: flintSpots[nextInt(rng, 0, flintSpots.length - 1)] ?? flintSpots[0]!,
      portable: {},
    });
    spawnFood(world, { x: 2, y: 1 });
    return { world, petId, meta: { name: 'cold-night-unlit', seed } };
  },
};

/**
 * Sala de práctica: espacio despejado y la mascota en el centro, con margen en
 * las cuatro direcciones. Es donde ensaya lo que el cuidador le enseña. Existe
 * porque sus mundos reales son estrechos: sin un lugar con lugar para moverse,
 * una conducta perfectamente aprendible fracasaría por falta de sitio y no por
 * estar mal diseñada. No la exime de funcionar también en su mundo real: es un
 * escenario más de la tanda, no un reemplazo.
 */
export const practiceRoom: ScenarioSpec = {
  name: 'practice-room',
  build(seed) {
    const world = createWorld({ width: 11, height: 9, seed });
    const rng = createRng(seed * 2654435761 + 11);
    const petId = spawnPet(world, { x: 5, y: 4 }, 40);
    // Un par de objetos para que las habilidades que manipulan cosas tengan
    // con qué; ninguno bloquea el paso.
    const propSpots: Vec2[] = [
      { x: 2, y: 1 },
      { x: 8, y: 7 },
      { x: 1, y: 7 },
    ];
    spawnFood(world, propSpots[nextInt(rng, 0, propSpots.length - 1)] ?? propSpots[0]!);
    spawnBranch(world, { x: 9, y: 1 });
    spawnHammer(world, { x: 2, y: 6 });
    return { world, petId, meta: { name: 'practice-room', seed } };
  },
};

export const MVP_SCENARIOS: ScenarioSpec[] = [openField, foodBehindWall];

/**
 * Mundos donde se prueba una habilidad enseñada por el cuidador: la sala de
 * práctica más los mundos reales de la mascota.
 */
export const PRACTICE_SCENARIOS: ScenarioSpec[] = [practiceRoom, openField, foodBehindWall];

/**
 * Mundos donde una habilidad de abrigo se puede juzgar. Ningún otro escenario
 * sirve: sin el componente `temperature` el criterio `temperatureIncreased`
 * nunca puede cumplirse y la habilidad se rechazaría siempre, por buena que
 * fuera. Los dos casos importan: con fuego hecho (acercarse sin quemarse) y
 * sin fuego (construirlo).
 */
export const COLD_SCENARIOS: ScenarioSpec[] = [coldNight, coldNightUnlit];
