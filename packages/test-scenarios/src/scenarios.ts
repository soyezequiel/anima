import type { Vec2 } from '@anima/shared';
import { createRng, nextInt } from '@anima/shared';
import type { EntityId, Recipe, RecipeOutcome, WorldState } from '@anima/sim-core';
import { createWorld, recipeProduct, spawn } from '@anima/sim-core';

/** El arquetipo de un desenlace que sí produce algo. */
type Archetype = NonNullable<RecipeOutcome['output']>;

/**
 * Los dos oficios del mundo del MVP fallan distinto, y esa diferencia es la
 * que hace que la tirada signifique algo en vez de ser ruido:
 *
 * - Encender es azaroso. La chispa prende o no prende, y cuando prende puede
 *   salir pobre. Fallar cuesta la madera pero nunca el pedernal: una piedra no
 *   se gasta porque la chispa no agarre, así que el fuego siempre se puede
 *   volver a intentar. Es la diferencia entre un fallo y un castigo.
 * - Dar forma siempre sale. Lo que varía es cuán bien: la misma silla puede
 *   quedar firme o renga según cómo vino la madera. No hay desenlace fallido
 *   porque no hay nada que pueda no ocurrir — la materia ya está ahí. Vale
 *   igual para la madera, la piedra y el barro: no es el oficio del carpintero,
 *   es el de cualquiera que trabaja algo que ya tiene en la mano.
 *
 * Fabricar algo dos veces con lo mismo en la mano da dos objetos distintos, y
 * la misma semilla los repite clavados.
 */
const LIGHTING_QUALITY = { good: { min: 0.9, max: 1.15 }, poor: { min: 0.55, max: 0.85 } };
const SHAPING_QUALITY = { good: { min: 0.9, max: 1.2 }, poor: { min: 0.6, max: 0.85 } };

/** Enciende: casi siempre agarra, a veces flojo, cada tanto nada. */
function lightingOutcomes(
  output: Archetype,
  sparedOnFailure: Recipe['ingredients'],
): RecipeOutcome[] {
  return [
    { weight: 7, output, quality: LIGHTING_QUALITY.good },
    { weight: 2, output: structuredClone(output), quality: LIGHTING_QUALITY.poor },
    { weight: 1, spares: sparedOnFailure },
  ];
}

/** Da forma: siempre sale algo, y de ahí para abajo es cuestión de suerte. */
function shapingOutcomes(output: Archetype): RecipeOutcome[] {
  return [
    { weight: 6, output, quality: SHAPING_QUALITY.good },
    { weight: 4, output: structuredClone(output), quality: SHAPING_QUALITY.poor },
  ];
}

/**
 * La fogata: calienta a distancia 2 y quema al que se pega. Se construye con
 * troncos (del árbol talado) y un pedernal que la encienda — el ingrediente
 * que la mascota no siempre tiene, y por el que tiene que pedir ayuda.
 *
 * Una fogata pobre calienta la mitad pero alcanza igual de lejos: el alcance
 * es la forma del fuego, no su calidad. Y como el daño no se gradúa, meterse
 * en una fogata mala quema exactamente igual que en una buena — la mala
 * decisión de pisar el fuego cuesta lo mismo, salga como salga.
 */
export const CAMPFIRE_RECIPE: Recipe = {
  id: 'campfire',
  outcomes: lightingOutcomes(
    {
      kind: 'campfire',
      components: {
        heatSource: { warmthPerTick: 0.3, range: 2 },
        hazard: { damagePerTick: 1 },
      },
    },
    [{ kind: 'flint', count: 1 }],
  ),
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
 *
 * Su durabilidad ahora sale de la tirada: una silla renga aguanta 4 golpes y
 * una firme 7. El tronco que deja al romperse no se gradúa — la suerte decide
 * qué tan bueno sale algo, nunca cuánta materia hay (ADR 0008).
 */
export const CHAIR_RECIPE: Recipe = {
  id: 'chair',
  outcomes: shapingOutcomes({
    kind: 'chair',
    components: {
      collider: { solid: true },
      hardness: { value: 2 },
      durability: { current: 6, max: 6 },
      drops: [{ kind: 'log', components: { portable: {} } }],
    },
  }),
  ingredients: [{ kind: 'log', count: 2 }],
};

/**
 * La antorcha: calor chico y portátil. Es el eslabón intermedio de la cadena
 * de combinaciones — con lo mismo que enciende una fogata se puede hacer algo
 * más barato y más débil, y elegir entre las dos es una decisión real.
 *
 * Se enciende, así que puede no encenderse: gastar el único tronco en una
 * antorcha que no prendió y conservar el pedernal es exactamente la clase de
 * consecuencia que el mundo no tenía.
 */
export const TORCH_RECIPE: Recipe = {
  id: 'torch',
  outcomes: lightingOutcomes(
    {
      kind: 'torch',
      components: {
        portable: {},
        heatSource: { warmthPerTick: 0.15, range: 1 },
      },
    },
    [{ kind: 'flint', count: 1 }],
  ),
  ingredients: [
    { kind: 'log', count: 1 },
    { kind: 'flint', count: 1 },
  ],
};

/**
 * La muralla: el muro de verdad, el que se levanta con ladrillos. Es más dura
 * que el muro de piedra del mundo (6 contra 5) y devuelve un ladrillo al
 * romperse — menos de los dos que costó, porque la materia no crece.
 *
 * Era una empalizada de dos troncos, y era el problema: costaba lo mismo que
 * la silla, bloqueaba igual y aguantaba un poco más. O sea, una silla mejor.
 * Dos recetas que se pisan no son dos decisiones, son una decisión y un
 * error de diseño.
 *
 * Hecha de ladrillos deja de pisarse con nada y, sobre todo, se convierte en
 * el primer árbol de crafteo de dos capas que el mundo trae de fábrica: la
 * muralla cuesta ladrillos, que cuestan arcilla. Nadie declara que la muralla
 * vale cuatro arcillas — se deriva (ADR 0031), que es exactamente lo que ese
 * ADR vino a habilitar y hasta hoy ninguna receta semilla ejercía.
 */
export const BARRICADE_RECIPE: Recipe = {
  id: 'barricade',
  outcomes: shapingOutcomes({
    kind: 'barricade',
    components: {
      collider: { solid: true },
      hardness: { value: 6 },
      durability: { current: 14, max: 14 },
      drops: [
        {
          kind: 'brick',
          components: {
            portable: {},
            hardness: { value: 6 },
            durability: { current: 6, max: 6 },
          },
        },
      ],
    },
  }),
  ingredients: [{ kind: 'brick', count: 2 }],
};

/**
 * El refugio: la contraparte serena de la fogata. No calienta ni quema —
 * adentro (o al lado) el calor corporal deja de perderse, y nada más. Es
 * carpintería: siempre sale algo, sin pedernal y sin chispa, porque no hay
 * nada que encender. Más caro en madera que la fogata (3 troncos contra 2):
 * elegir entre parar la sangría para siempre o recuperar calor ya —
 * arriesgando la chispa y el pedernal— es una decisión real.
 *
 * No es sólido: se entra, no se choca. Por eso no puede volverse un muro que
 * atrape al movimiento voraz de la mascota.
 */
export const SHELTER_RECIPE: Recipe = {
  id: 'shelter',
  outcomes: shapingOutcomes({
    kind: 'shelter',
    components: {
      shelter: { range: 1 },
      hardness: { value: 3 },
      durability: { current: 12, max: 12 },
      // Dos de los tres troncos que costó: la materia no crece (ADR 0008).
      drops: [
        { kind: 'log', components: { portable: {} } },
        { kind: 'log', components: { portable: {} } },
      ],
    },
  }),
  ingredients: [{ kind: 'log', count: 3 }],
};

/**
 * El pico de piedra: el escalón que faltaba entre la rama (poder 1, apenas
 * araña) y el martillo (poder 8, regalo del mundo que no se puede rehacer).
 * Es la primera receta que mezcla los tres reinos —piedra, madera, fibra— y
 * por eso el ejemplo del que Ánima puede aprender que los materiales se
 * combinan por lo que son, no por lo que se llaman.
 *
 * Con la tirada, el poder sale del rango: un pico firme (≥6) abre la veta de
 * mineral (dureza 7); uno flojo no le hace mella y solo sirve para picar
 * rocas. La misma receta puede darte la llave del metal o un palo con punta.
 */
export const STONE_PICK_RECIPE: Recipe = {
  id: 'stone-pick',
  outcomes: shapingOutcomes({
    kind: 'stone-pick',
    components: {
      portable: {},
      tool: { power: 6 },
      durability: { current: 12, max: 12 },
    },
  }),
  ingredients: [
    { kind: 'stone', count: 1 },
    { kind: 'branch', count: 1 },
    { kind: 'fiber', count: 1 },
  ],
};

/**
 * El ladrillo: arcilla moldeada en materia dura. No hace nada solo — es
 * materia intermedia a propósito: más duro que la empalizada (6 contra ~3),
 * existe para que las ideas futuras (un muro propio, un horno) tengan un
 * bloque del que apoyarse. Moldear no es encender: siempre sale algo.
 */
export const BRICK_RECIPE: Recipe = {
  id: 'brick',
  outcomes: shapingOutcomes({
    kind: 'brick',
    components: {
      portable: {},
      hardness: { value: 6 },
      durability: { current: 6, max: 6 },
    },
  }),
  ingredients: [{ kind: 'clay', count: 2 }],
};

/**
 * Lo que el mundo del MVP admite construir. Estilo Doodle God: los mismos
 * materiales base (troncos, pedernal, piedra, fibra, arcilla) combinan en
 * cosas distintas, y gastarlos en una es no tenerlos para otra.
 */
export const MVP_RECIPES: Recipe[] = [
  CAMPFIRE_RECIPE,
  CHAIR_RECIPE,
  TORCH_RECIPE,
  BARRICADE_RECIPE,
  SHELTER_RECIPE,
  STONE_PICK_RECIPE,
  BRICK_RECIPE,
];

/**
 * La misma receta pero sin tirada: su desenlace más probable, garantizado.
 *
 * Es para las pruebas que miden OTRA cosa — si la mascota entendió el pedido,
 * si el reflejo la aparta del fuego, si sobrevive a la noche. Con la receta
 * real esas pruebas pasarían o no según cómo cayó el dado de su semilla, y un
 * test que depende de la suerte no mide lo que dice medir: mediría la suerte.
 * Que construir pueda salir mal se prueba en sim-core, que es de quien es esa
 * regla, y ahí se prueba a propósito.
 */
export function withoutChance(recipe: Recipe): Recipe {
  const product = recipeProduct(recipe);
  return {
    ...recipe,
    outcomes: product ? [{ weight: 1, output: structuredClone(product) }] : [],
  };
}

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

/**
 * El pedernal es materia de crafteo (fogata, antorcha, forja…) Y ahora, como
 * una roca, se puede picar: tiene durabilidad y una dureza baja (3, contra el 5
 * del muro y el árbol). Con una herramienta decente —un pico, un martillo— cede
 * de un golpe; con una rama sola (poder 1, no le hace mella) la mascota tiene
 * que hacerse algo más fuerte primero. Sin `durability` era indestructible: dar
 * "picá la piedra" era pedir lo imposible sin que nadie lo supiera.
 */
function spawnFlint(world: WorldState, pos: Vec2): void {
  spawn(world, 'flint', {
    position: pos,
    portable: {},
    hardness: { value: 3 },
    durability: { current: 3, max: 3 },
  });
}

/**
 * La piedra: materia base del oficio duro. Como el pedernal, se puede picar
 * (dureza 4, un punto más: es piedra entera, no una esquirla) — sin
 * `durability` sería indestructible y "romper la piedra" un pedido imposible.
 */
function spawnStone(world: WorldState, pos: Vec2): void {
  spawn(world, 'stone', {
    position: pos,
    portable: {},
    hardness: { value: 4 },
    durability: { current: 4, max: 4 },
  });
}

/** La fibra: blanda, liviana, lo que ata. No resiste nada — no lo necesita. */
function spawnFiber(world: WorldState, pos: Vec2): void {
  spawn(world, 'fiber', { position: pos, portable: {} });
}

/** La arcilla: barro moldeable. Vive junto al agua, que es donde se forma. */
function spawnClay(world: WorldState, pos: Vec2): void {
  spawn(world, 'clay', { position: pos, portable: {} });
}

/**
 * El barrial: la orilla de la que sale arcilla, y la única materia del mundo
 * que se junta sin romper nada — no es sólido, no tiene durabilidad, solo
 * rezuma. Existe porque la muralla cuesta 2 ladrillos = 4 arcillas, y con
 * arcilla suelta y nada que la reponga esa receta habría nacido muerta: se
 * podría construir una muralla en la vida del mundo y ninguna más.
 *
 * Su reloj (550) va después de todos los otros (ramas 350, comida 400, fibra
 * 450, resina 500) para que las fuentes no se peleen por las celdas libres, y
 * muy lejos de los 200 ticks de una evaluación.
 */
function spawnClayPit(world: WorldState, pos: Vec2): void {
  spawn(world, 'clay-pit', {
    position: pos,
    itemSource: {
      intervalTicks: 550,
      nextSpawnAtTick: 550,
      output: { kind: 'clay', components: { portable: {} } },
    },
  });
}

/** La resina: savia del pino. Combustible y pegamento en potencia. */
function spawnResin(world: WorldState, pos: Vec2): void {
  spawn(world, 'resin', { position: pos, portable: {} });
}

/**
 * La roca: de dónde sale la piedra. Sólida pero blanda (dureza 2): la rama la
 * pica despacio (daño 1 por golpe), el martillo o un buen pico de un golpe.
 * Es el primer peldaño de la escalera: picar rocas con lo que hay para
 * hacerse la herramienta que abre lo que hay después.
 */
function spawnRock(world: WorldState, pos: Vec2): void {
  const stone = { portable: {}, hardness: { value: 4 }, durability: { current: 4, max: 4 } };
  spawn(world, 'rock', {
    position: pos,
    collider: { solid: true },
    hardness: { value: 2 },
    durability: { current: 6, max: 6 },
    drops: [
      { kind: 'stone', components: structuredClone(stone) },
      { kind: 'stone', components: structuredClone(stone) },
    ],
  });
}

/**
 * El arbusto: la fuente renovable de fibra, como el árbol lo es de ramas. No
 * es sólido (se pisa, no se choca) y cede a cualquier herramienta: arrancarlo
 * da fibra ya, dejarlo da fibra para siempre — la misma decisión que talar o
 * no talar, en chico. Su primer brote (450) queda fuera del horizonte de una
 * evaluación (200) y no compite con los ticks del árbol (350/400).
 */
function spawnBush(world: WorldState, pos: Vec2): void {
  const fiber = { portable: {} };
  spawn(world, 'bush', {
    position: pos,
    durability: { current: 2, max: 2 },
    itemSource: {
      intervalTicks: 450,
      nextSpawnAtTick: 450,
      output: { kind: 'fiber', components: structuredClone(fiber) },
    },
    drops: [
      { kind: 'fiber', components: structuredClone(fiber) },
      { kind: 'fiber', components: structuredClone(fiber) },
    ],
  });
}

/**
 * El pino: el árbol de la resina. Tan duro de talar como el árbol común, pero
 * lo que gotea es distinto: resina en vez de ramas, y sin alimento — elegir
 * qué árbol respetar dejó de ser una sola pregunta. Su primer brote (500) es
 * posterior a cualquier evaluación y distinto de todos los demás relojes.
 */
function spawnPine(world: WorldState, pos: Vec2): void {
  const resin = { portable: {} };
  spawn(world, 'pine', {
    position: pos,
    collider: { solid: true },
    hardness: { value: 5 },
    durability: { current: 15, max: 15 },
    itemSource: {
      intervalTicks: 500,
      nextSpawnAtTick: 500,
      output: { kind: 'resin', components: structuredClone(resin) },
    },
    drops: [
      { kind: 'log', components: { portable: {} } },
      { kind: 'log', components: { portable: {} } },
      { kind: 'resin', components: structuredClone(resin) },
    ],
  });
}

/**
 * La veta: el mineral que todavía no se puede tener. Dureza 7: la rama y un
 * pico flojo no le hacen mella; el martillo (poder 8) y un pico bien salido
 * (≥6 de tirada, con la fuerza de la mascota) sí. Es el techo de la escalera
 * del MVP — el mineral que suelta no tiene receta que lo use, y eso también
 * es a propósito: materia para las ideas que Ánima todavía no tuvo.
 */
function spawnVein(world: WorldState, pos: Vec2): void {
  const ore = { portable: {}, hardness: { value: 6 }, durability: { current: 5, max: 5 } };
  spawn(world, 'vein', {
    position: pos,
    collider: { solid: true },
    hardness: { value: 7 },
    durability: { current: 9, max: 9 },
    drops: [
      { kind: 'ore', components: structuredClone(ore) },
      { kind: 'ore', components: structuredClone(ore) },
    ],
  });
}

function spawnBranch(world: WorldState, pos: Vec2): void {
  spawn(world, 'branch', {
    position: pos,
    portable: {},
    tool: { power: 1 },
    durability: { current: 8, max: 8 },
  });
}

/**
 * El martillo: una reliquia gastada, no un regalo eterno. Sigue siendo la
 * herramienta más fuerte del mundo (poder 8), pero llega con 8 usos de los 20
 * que tuvo: alcanza para romper el muro (2 golpes) y talar un árbol (3), que
 * son las dos historias que este mundo cuenta, y no mucho más.
 *
 * Que venga entero era una decisión de cuando no había forma de fabricarse una
 * herramienta fuerte: con el martillo perfecto tirado en el piso, hacerse un
 * pico (poder 6) es trabajar para conseguir algo peor, y toda la escalera de
 * piedra queda de adorno. Gastado, el martillo pasa de ser LA solución a ser
 * la ayuda del principio — y lo que venga después hay que ganárselo.
 */
function spawnHammer(world: WorldState, pos: Vec2): void {
  spawn(world, 'hammer', {
    position: pos,
    portable: {},
    tool: { power: 8 },
    durability: { current: 8, max: 20 },
  });
}

/** Agua: una celda que se ve y no se pisa. Terreno, no recurso. */
function spawnWater(world: WorldState, pos: Vec2): void {
  spawn(world, 'water', { position: pos, water: {} });
}

/**
 * El árbol es fuente de alimento Y talable: derribarlo con una herramienta
 * fuerte deja troncos, pero destruye la fuente de comida — una consecuencia
 * real que la mascota puede descubrir y lamentar. La rama no lo daña
 * (dureza como la del muro).
 *
 * Además suelta ramas cada tanto: madera renovable SIN talar. La mascota se
 * niega a derribar árboles que cree necesitar (will_not, ADR 0019), y sin
 * esto los troncos eran finitos — negarse tenía razón y no tenía salida. La
 * rama que cae es la salida: herramienta débil, pero cae sola. El primer
 * brote (tick 350) es posterior al maxTicks de cualquier evaluación (200) y
 * distinto del de la comida (400), para que no compitan por las celdas.
 */
function spawnTree(world: WorldState, pos: Vec2): void {
  const log = { portable: {} };
  spawn(world, 'tree', {
    position: pos,
    collider: { solid: true },
    hardness: { value: 5 },
    durability: { current: 15, max: 15 },
    foodSource: { intervalTicks: 400, nutrition: 30, nextSpawnAtTick: 400 },
    itemSource: {
      intervalTicks: 350,
      nextSpawnAtTick: 350,
      output: {
        kind: 'branch',
        components: { portable: {}, tool: { power: 1 }, durability: { current: 8, max: 8 } },
      },
    },
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

    // Un estanque en el borde norte del lado de la comida: agua que da forma
    // a los caminos sin cerrar ninguno (la fila y=1 queda libre) y lejos del
    // corredor de la historia del hambre (y=3). Terreno, no obstáculo hostil:
    // no encierra nada, solo obliga a rodear.
    spawnWater(world, { x: 7, y: 0 });
    spawnWater(world, { x: 8, y: 0 });

    // Un refugio ya construido en el rincón del taller, a calidad de catálogo.
    // No compite con la historia del fuego: la mascota prefiere el fuego
    // (recupera calor; el refugio solo deja de perderlo) y recién cae acá si
    // no queda nada que arda. Es la red, no el segundo acto.
    spawn(world, 'shelter', {
      position: { x: 0, y: 6 },
      ...structuredClone(recipeProduct(SHELTER_RECIPE)!.components),
    });

    // Materiales sueltos por TODO el mapa, no solo en el rincón inicial
    // (estilo Doodle God: los mismos ingredientes combinan en cosas distintas,
    // y gastarlos en una es no tenerlos para otra). Repartidos a ambos lados
    // del muro porque la mascota vive en ambos: tras la historia queda del
    // lado de la comida, y su movimiento es voraz, no un pathfinding — un
    // material inalcanzable detrás del muro sería un pedido que acepta y
    // nunca cumple.
    // Dos troncos por lado, que es exactamente lo que cuesta UNA fogata: con
    // lo tirado se enciende un fuego, y para el refugio (3) o un segundo fuego
    // hay que talar o esperar las ramas. Eran tres por lado, de cuando la
    // madera no se renovaba; con árboles que sueltan ramas solos, alfombrar el
    // piso de troncos vaciaba la decisión de talar o cuidar.
    spawnLog(world, { x: 1, y: 6 });
    spawnLog(world, { x: 0, y: 4 });
    spawnFlint(world, { x: 3, y: 0 });
    spawnFlint(world, { x: 1, y: 0 });
    spawnLog(world, { x: 11, y: 2 });
    spawnLog(world, { x: 8, y: 5 });
    spawnFlint(world, { x: 12, y: 4 });

    // Las materias nuevas, repartidas con la misma regla que las viejas: hay
    // en ambos lados del muro, y las fuentes sólidas van en bordes y esquinas
    // para no cerrar ningún camino (el corredor y=3 queda siempre libre).
    //
    // El taller (x<5) tiene piedra, fibra y rama sueltas: el pico de piedra
    // se puede estrenar sin cruzar el muro. La arcilla no — vive junto al
    // estanque, del lado de la comida, porque el barro se forma donde hay
    // agua: el ladrillo cuesta el viaje.
    // Una sola piedra suelta, en el taller: alcanza para estrenar el primer
    // pico sin minar. Del lado de la comida no hay ninguna a propósito — ahí
    // está la roca de (10,5), y conseguir la segunda piedra es picarla.
    spawnStone(world, { x: 4, y: 0 });
    // La fibra suelta va a MÁS de 2 celdas de su arbusto: a esa distancia la
    // fuente se cree saturada (regla de itemSource) y no brota nunca.
    spawnFiber(world, { x: 3, y: 2 });
    spawnFiber(world, { x: 10, y: 4 });
    // Las dos arcillas sueltas alcanzan para UN ladrillo; la muralla cuesta
    // dos. La diferencia la pone el barrial, y por eso las sueltas van a más
    // de 2 celdas de él: pegadas, la fuente se creería saturada y no rezumaría
    // nunca (la misma regla de `itemSource` que ordena la fibra).
    spawnClay(world, { x: 6, y: 1 });
    spawnClay(world, { x: 12, y: 1 });
    spawnClayPit(world, { x: 9, y: 0 });
    spawnResin(world, { x: 11, y: 4 });
    // Las fuentes: romperlas da materia ya, cuidarlas da materia para siempre
    // (las renovables), y la veta ni siquiera se abre sin herramienta buena.
    spawnRock(world, { x: 2, y: 6 });
    spawnRock(world, { x: 10, y: 5 });
    spawnBush(world, { x: 0, y: 2 });
    spawnBush(world, { x: 9, y: 1 });
    // El pino NO va en una esquina: suelta 3 cosas al caer y los drops solo
    // aparecen en celdas libres — en un rincón entre el árbol y el borde, la
    // resina (la última de la lista) se perdería.
    spawnPine(world, { x: 7, y: 6 });
    spawnVein(world, { x: 6, y: 0 });

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
 * una fogata encendida. El fuego calienta hasta distancia 2 y solo quema a
 * quien se le mete adentro (ADR 0041): arrimarse es la respuesta correcta y el
 * mundo ya no la castiga por darla.
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
    // Un refugio en el rincón opuesto al fuego: para el frío hay dos
    // respuestas de naturaleza distinta —recuperar calor o dejar de perderlo—
    // y este escenario ahora contiene ambas. Fuera del alcance de la mascota
    // inicial (a distancia >1), así que las reglas del motor que este archivo
    // prueba no cambian.
    spawn(world, 'shelter', {
      position: { x: 0, y: 4 },
      ...structuredClone(recipeProduct(SHELTER_RECIPE)!.components),
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
    // Las materias nuevas también: una conducta enseñada sobre ellas ("juntá
    // piedra", "hacete un pico") necesita que existan aquí para practicarse.
    spawnStone(world, { x: 9, y: 7 });
    spawnFiber(world, { x: 1, y: 3 });
    // Dos arcillas: acá se practica, y practicar un ladrillo pide poder
    // hacerlo entero.
    spawnClay(world, { x: 9, y: 3 });
    spawnClay(world, { x: 9, y: 5 });
    // Mobiliario de muestra: lo que el mundo sabe construir también existe
    // aquí, porque una conducta enseñada sobre un objeto ("sentate en la
    // silla") necesita ese objeto para poder practicarse y juzgarse. En los
    // bordes, para no estorbar el paso.
    // Salen a calidad de catálogo, sin tirada: son la muestra contra la que se
    // juzga una conducta enseñada, y una silla que unas corridas aguanta 4
    // golpes y otras 7 haría que la misma lección se apruebe o no por suerte.
    spawn(world, 'chair', {
      position: { x: 10, y: 0 },
      ...structuredClone(recipeProduct(CHAIR_RECIPE)!.components),
    });
    spawn(world, 'torch', {
      position: { x: 0, y: 8 },
      ...structuredClone(recipeProduct(TORCH_RECIPE)!.components),
    });
    spawn(world, 'shelter', {
      position: { x: 0, y: 0 },
      ...structuredClone(recipeProduct(SHELTER_RECIPE)!.components),
    });
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
