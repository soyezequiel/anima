import type { LegacyReport } from '@anima/persistence';
import type { TimeOfDay } from '@anima/sim-core';
import type { SkillSubject } from './skill-subjects.js';

/**
 * View model inmutable que la sesión entrega a la UI en cada tick.
 * Es la única fuente de datos de React y Phaser: la UI nunca consulta el
 * motor ni el agente directamente, así no puede duplicar reglas del mundo.
 */

/**
 * Qué hace una cosa, no cómo se llama. Un objeto que Ánima inventó lleva el
 * nombre que eligió el modelo ("hoguera-simple"), pero si irradia calor es un
 * fuego: con esto la UI puede dibujarlo como lo que es, sin conocer su nombre
 * ni duplicar reglas del mundo. Es la misma idea que rige las recetas — un
 * objeto es lo que sus componentes le permiten hacer.
 */
export interface EntityTraits {
  warm?: boolean;
  edible?: boolean;
  tool?: boolean;
  growsFood?: boolean;
  dangerous?: boolean;
  portable?: boolean;
  solid?: boolean;
}

export interface EntityView {
  id: string;
  kind: string;
  x: number;
  y: number;
  traits: EntityTraits;
  /**
   * De qué está hecho, siguiendo su receta hacia atrás. Solo sirve para
   * elegir el color de lo que no tiene emoji: un `cuchillo` hecho de
   * `flint-shard` se dibuja color pedernal aunque su nombre no lo nombre.
   */
  material?: string | undefined;
  /**
   * Lo que Ánima dibujó para este tipo, si lo dibujó (la quinta puerta). Manda
   * sobre el dibujo procedural: nadie sabe mejor cómo se ve algo que quien lo
   * inventó. Si falta, la pantalla lo compone sola y no se nota.
   */
  glyph?: string[] | undefined;
  /**
   * De qué obra es parte y qué lugar ocupa, si está puesta en una. Lo escribe
   * el mundo al colocarla, así que sobrevive al guardado — y desaparece sola
   * cuando la pieza deja de estar puesta.
   *
   * Sirve para una cosa: elegir el dibujo. Un tablón dentro de un puente no se
   * ve como un tablón, se ve como el pedazo de puente que le toca ser.
   */
  partOfWork?: { blueprintId: string; offset: { x: number; y: number } } | undefined;
}

/**
 * Una obra plantada, celda por celda: dónde va a quedar cada bloque y cuáles ya
 * están puestos (ADR 0049). Es lo que deja ver la construcción antes de que
 * exista — y, de paso, hace evidente que el sitio está libre, porque la silueta
 * se dibuja sobre suelo vacío.
 */
export interface PlannedCellView {
  kind: string;
  x: number;
  y: number;
  /** Ya levantado: se dibuja apagado, no como fantasma pendiente. */
  done: boolean;
}

export interface PlannedStructureView {
  blueprintId: string;
  /** Cómo se llama la obra en voz humana ("escuela"). */
  label: string;
  cells: PlannedCellView[];
  /** Cuántas celdas faltan: para decir "3 de 6" sin recontar en la pantalla. */
  remaining: number;
}

/**
 * Una OBRA que Ánima aprendió a levantar (ADR 0056). Ninguna viene de fábrica:
 * el mundo nace sin planos, así que todo lo que aparece acá lo imaginó ella
 * —o lo heredó de una antecesora que lo imaginó—.
 *
 * Lleva la forma celda por celda porque el plano ES la idea: «escuela» no
 * significa nada sin ver que son cinco muros y un pizarrón puestos así.
 */
export interface BlueprintView {
  id: string;
  /** Cómo se llama en voz humana ("escuela"). */
  label: string;
  /** Cuántos bloques de cada tipo pide, para la lista de piezas. */
  blocks: ItemIngredientView[];
  /** Cada bloque en su lugar, ya normalizado a una grilla que empieza en 0. */
  cells: { kind: string; x: number; y: number }[];
  /** Tamaño de esa grilla, para dibujarla sin recalcular. */
  width: number;
  height: number;
  /** Dónde queda ella misma dentro de la grilla (el ancla del plano). */
  anchor: { x: number; y: number };
}

/**
 * Su vista, dibujable. Las celdas las calcula el MOTOR (`visibleCells`) con la
 * misma regla que usa para percibir: la pantalla no vuelve a decidir qué ve,
 * porque dos copias de esa regla terminan discrepando y entonces el dibujo
 * miente.
 *
 * Es solo la vista. Lo comestible y las fuentes de calor las percibe a través
 * de los muros —se huelen, se sienten—, así que hay cosas que conoce y que
 * caen fuera de estas celdas. El olfato no tiene forma que pintar.
 */
export interface VisionView {
  /** Cuántas celdas alcanza en cada dirección (Chebyshev: es un cuadrado). */
  range: number;
  cells: { x: number; y: number }[];
}

export interface PetView {
  id: string;
  x: number;
  y: number;
  alive: boolean;
  energy: { current: number; max: number };
  health: { current: number; max: number };
  /** Solo en mundos con frío: null donde la mascota no siente temperatura. */
  temperature: { current: number; max: number } | null;
  /**
   * Lo que lleva encima, ejemplar por ejemplar. `durability` viaja porque una
   * herramienta gastada es un recurso que se agota: sin el número, romperse es
   * una sorpresa y no una decisión del cuidador. Ausente en lo que no se rompe.
   */
  inventory: { id: string; kind: string; durability?: { current: number; max: number } }[];
  /**
   * Cuántas manos tiene, o sea el tope de `inventory` (ADR 0070). Sale del
   * mundo —lo fija `spawnPet`— y el cuidador puede moverlo. Sin este número en
   * pantalla, «no pude juntarlo» y «no me entra» se ven exactamente igual.
   */
  inventoryCapacity: number;
  /**
   * Postura sobre un objeto tras una interacción (ADR 0027): comparte celda
   * con él, encima o debajo. El dibujo decide quién tapa a quién; null cuando
   * está simplemente parada en el suelo.
   */
  mount: { targetId: string; mode: 'on-top' | 'underneath' } | null;
}

/**
 * Una interacción que el mundo admite (ADR 0027): la inventó Ánima, la validó
 * la física, la aprobó la IA Dios, y quedó guardada — reusable sin costo.
 */
export interface InteractionView {
  id: string;
  /** Qué es, en voz humana: "juntar agua del estanque con un balde". */
  description: string;
  stance: 'beside' | 'on-top' | 'underneath' | 'held';
  /** La postura en voz humana: "al lado", "encima", "debajo", "en la mano". */
  stanceLabel: string;
  /** A qué se aplica, en voz humana. */
  targetLabel: string;
  /** Qué exige llevar encima, en voz humana; null si nada. */
  requiresLabel: string | null;
}

/** Una característica medible de un tipo: "Calor" → "0.3 por tick · alcance 2". */
export interface ItemStat {
  label: string;
  value: string;
}

/**
 * Un ingrediente en el catálogo: el tipo además de la etiqueta, porque la UI
 * lo dibuja y no solo lo nombra. Ver qué se gastó es más rápido con el ícono
 * que con el nombre.
 */
export interface ItemIngredientView {
  kind: string;
  count: number;
  /** "2 troncos": cuánto y de qué, en voz humana. */
  label: string;
}

/**
 * Un tipo de objeto del mundo, para el catálogo de la UI. Reúne en una sola
 * fila lo que existe en el mapa, lo que va en la mochila y lo que las recetas
 * saben construir. `origin` dice de dónde salió su definición: `builtin` viene
 * del código (escenarios y recetas del MVP); `invented` la construyó un modelo
 * en tiempo de ejecución (un invento de la mascota o una descripción del
 * cuidador, ADR 0018 / 0024) y entró al mundo por la puerta de validación.
 */
export interface ItemView {
  kind: string;
  /** Nombre humano ("pedernal", "hoguera simple"), no el id del motor. */
  name: string;
  origin: 'builtin' | 'invented';
  /** Cuántos hay ahora en el mapa. */
  inWorld: number;
  /** Cuántos lleva la mascota. */
  inInventory: number;
  /** true si alguna receta viva del mundo lo produce. */
  craftable: boolean;
  /** Con qué se lo hace, un paso: los ingredientes directos de su receta. */
  ingredients: ItemIngredientView[];
  /**
   * La materia base a la que baja el árbol de crafteo (ADR 0031): lo que hay
   * que juntar del mundo si no se tiene ninguna de las partes intermedias.
   * Vacío cuando no dice nada nuevo — si ningún ingrediente directo se
   * construye a su vez, esa lista YA es la materia base.
   */
  baseCost: ItemIngredientView[];
  /** El árbol no toca el suelo: tiene un ciclo o demasiadas capas. */
  costTruncated: boolean;
  traits: EntityTraits;
  /** De qué está hecho, heredado de su receta. Ver `EntityView.material`. */
  material?: string | undefined;
  /** Lo que Ánima dibujó para este tipo. Ver `EntityView.glyph`. */
  glyph?: string[] | undefined;
  /** Qué HACE ("da calor", "bloquea el paso"), en voz humana. */
  does: string[];
  /**
   * Sus números, cuando los tiene: calor, dureza, resistencia. Sale de los
   * ejemplares que existen; si solo se puede construir, del arquetipo de la
   * receta — que es su mejor desenlace, una intención y no una promesa.
   */
  stats: ItemStat[];
}

/**
 * Vista previa de una receta traducida de la descripción del cuidador (ADR
 * 0024): lo que la mascota imagina ANTES de que él confirme. Muestra el mejor
 * desenlace — la intención, no la promesa. Lleva `traits` y no un emoji para
 * que el dibujo salga de la misma regla que el mundo (appearance.ts): un
 * objeto es lo que sus componentes le permiten hacer.
 */
export interface RecipeCardView {
  recipeId: string;
  kind: string;
  /** Nombre humano ("hoguera simple"), no el id del motor. */
  name: string;
  /** "2 troncos", "1 pedernal": qué cuesta, en voz humana. */
  ingredients: string[];
  /** Qué HACE lo construido ("da calor", "bloquea el paso"). */
  does: string[];
  traits: EntityTraits;
}

export interface ChatEntry {
  from: 'user' | 'pet' | 'system';
  text: string;
  tick: number;
  /**
   * Cuándo se dijo, en hora de reloj (epoch ms).
   *
   * El tick es el tiempo del MUNDO, y no se traduce a hora: la partida se
   * pausa, se acelera y se retoma al otro día, así que «t19» no dice si eso
   * pasó recién o hace una semana. Va aparte, sellado al crear el mensaje.
   *
   * Opcional porque los guardados anteriores a esto no lo tienen: ahí la UI
   * cae al tick, que es lo que había. No se rellena con la hora de la carga
   * —eso sería inventar que un mensaje de anteayer se dijo hoy—.
   */
  at?: number;
  /** Presente solo en la vista previa de una receta descrita por el cuidador. */
  card?: RecipeCardView;
  /**
   * Mensaje del cuidador que se mandó mientras Ánima ya estaba pensando: está
   * encolado y aún no lo leyó. La UI lo dibuja debajo del "pensando" (llegó
   * después) y con un latido de "sin leer" hasta que el agente lo atiende
   * (`user.message.received`), momento en que la marca se apaga.
   */
  pending?: boolean;
  /**
   * Aviso que describe ESTA carga y no la conversación: se muestra, pero no
   * se guarda. Sin esto cada restauración dejaba su rastro en el historial
   * persistido y a las veinte recargas el chat era una lista de avisos con la
   * charla enterrada debajo.
   */
  ephemeral?: boolean;
}

/**
 * Un objeto que acaba de pasar del suelo al inventario. Describe el hecho, no
 * la animación: la UI decide cómo representarlo, igual que con `speech`.
 */
export interface PickupView {
  itemId: string;
  kind: string;
  tick: number;
}

/**
 * Una cosa que se cae junto con lo que se pidió podar, en voz humana. El
 * cuidador no confirma ids: confirma «la receta de la tabla de ramas» y «3
 * ejemplares en el mapa».
 */
export interface PruneLine {
  /** Qué clase de cosa es: "Recetas", "Interacciones", "En el mapa". */
  group: string;
  label: string;
}

/**
 * Lo que va a pasar si el cuidador confirma. Se calcula sin tocar nada, así
 * que cancelar no deshace: nunca llegó a hacerse.
 */
export interface PrunePreview {
  /** Qué se pidió sacar, en voz humana: «el tronco», «juntar agua». */
  title: string;
  /** Todo el arrastre, agrupado. Vacío = se lleva solo lo que se pidió. */
  lines: PruneLine[];
  /** Por qué no se puede; null si se puede. */
  blocked: string | null;
}

export interface SkillView {
  id: string;
  name: string;
  version: number;
  status: string;
  description: string;
  motivation: string;
  expectedOutcome: string;
  successCriteria: string[];
  lastEvaluationSuccessRate: number | null;
  totalRuns: number;
  successfulRuns: number;
  knownFailures: string[];
  parentVersionId: string | null;
  programSummary: string[];
  /** Los objetos que toca, leídos de su programa (ver `skill-subjects.ts`). */
  subjects: SkillSubject[];
}

export interface ExperimentView {
  tick: number;
  skillName: string;
  version: number | null;
  kind:
    | 'requested'
    | 'contract-preview'
    | 'contract-agreed'
    | 'created'
    | 'test-started'
    | 'test-failed'
    | 'test-passed'
    | 'promoted'
    /** No llegó a la vara, pero queda usable mientras no haya estable (ADR 0050). */
    | 'provisional'
    /** El ciclo cortó por meseta: seguir puliendo no mejoraba nada (ADR 0051). */
    | 'plateau'
    | 'rejected';
  detail: string;
}

/**
 * Una consulta al modelo real vista desde adentro: el momento cognitivo que
 * la disparó, los titulares de razonamiento que fueron llegando y la
 * respuesta final. Solo existe con proveedores que piensan de verdad (Codex):
 * el mock responde al instante y no tiene pensamiento que contar — la UI
 * muestra esa ausencia tal cual, sin fingir un ritmo.
 */
export interface ThoughtView {
  /** Identidad de la consulta, creciente por sesión de página. */
  seq: number;
  /** El tipo crudo de la petición ('dialogue', 'recipe.propose', ...). */
  kind: string;
  /** El momento cognitivo en voz humana ("inventando una receta"). */
  label: string;
  /** Titulares de razonamiento del modelo, en el orden en que llegaron. */
  reasoning: string[];
  /** Texto de la respuesta cuando ya existe; null mientras piensa. */
  answer: string | null;
  status: 'thinking' | 'done' | 'error';
  /** Detalle del fallo cuando status es 'error'; null si no falló. */
  error: string | null;
  /** Tick del mundo en que arrancó la consulta. */
  tick: number;
}

/**
 * Un mundo imaginado durante la evaluación de una habilidad: la escenografía
 * como empezó y el camino que la mascota recorrió en él. La UI los dibuja
 * como "sueños" mientras piensa — es la evaluación real, no una animación
 * inventada. Efímeros: no se guardan.
 */
export interface DreamView {
  /** Identidad estable para React: skill@versión:escenario:semilla. */
  id: string;
  skillName: string;
  version: number;
  scenario: string;
  seed: number;
  verdict: 'passed' | 'failed' | 'inconclusive';
  width: number;
  height: number;
  entities: {
    kind: string;
    x: number;
    y: number;
    solid?: boolean;
    edible?: boolean;
    warm?: boolean;
    growsFood?: boolean;
  }[];
  path: { x: number; y: number }[];
}

/**
 * El ciclo de desarrollo de una habilidad visto en vivo: en qué versión va,
 * qué está haciendo con ella y cómo le fue a las anteriores. Es lo que
 * convierte la espera larga (un developSkill puede encadenar varias consultas
 * al modelo) en una historia que se puede seguir. Efímero, como aiBusy.
 */
export interface SkillDevProgressView {
  skillName: string;
  /**
   * Para qué la quiere, en su voz ("dejar de perder calor: acercarse a una
   * fuente de calor o construir una"). Un ciclo de ocho intentos que arrancó
   * sola —por frío, por hambre— es un cartel que el cuidador no pidió: sin el
   * motivo, ni siquiera sabe de qué le están hablando.
   */
  purpose: string | null;
  /** Versión de la candidata actual; null antes de la primera propuesta. */
  version: number | null;
  /** Tope de versiones del ciclo; null en eventos de sesiones viejas. */
  maxVersions: number | null;
  /** Cuántas versiones ya se probaron (la actual no incluida). */
  attemptsDone: number;
  phase: 'designing' | 'testing' | 'revising' | 'passed';
  /** Casos del último banco de pruebas (escenarios × semillas + regresiones). */
  casesTotal: number | null;
  /** Tasa de éxito de la última versión probada (0..1); null sin pruebas aún. */
  lastRate: number | null;
  /** La mejor tasa lograda hasta ahora (0..1); null sin pruebas aún. */
  bestRate: number | null;
}

/**
 * La espera de una consulta al modelo real, con lo que hace falta para que no
 * parezca un cuelgue: desde cuándo corre, cuánto suele tardar una consulta de
 * ese tipo (historial de esta sesión) y si el mundo ya se sostiene porque el
 * presupuesto biológico se agotó (ADR 0040). null cuando nadie piensa afuera.
 */
export interface AiWaitView {
  /** Date.now() del arranque de la consulta en vuelo. */
  startedAtMs: number;
  /** Mediana de las últimas consultas del mismo tipo; null sin historial. */
  expectedMs: number | null;
  /** true: presupuesto agotado, el tiempo del mundo está suspendido. */
  held: boolean;
}

export interface DevEventView {
  seq: number;
  tick: number;
  source: 'world' | 'agent';
  type: string;
  json: string;
}

/**
 * Un rasgo de personalidad derivado (nunca sorteado ni opinado por el modelo):
 * viene con la evidencia que lo justifica, para que el panel pueda mostrar de
 * dónde sale. Ver ADR 0021.
 */
export interface PersonalityTraitView {
  id: string;
  label: string;
  evidence: string;
}

/**
 * Una materia que un objetivo está esperando (ADR 0052). Lleva el tipo —no un
 * ícono ya resuelto— porque el dibujo sale del catálogo, la misma regla con la
 * que se pinta en el tablero y en la mochila: una cosa no se ve de dos maneras
 * según dónde la mires.
 */
export interface GoalNeedView {
  kind: string;
  label: string;
  /** Cuántos faltan de verdad (lo que pide menos lo que lleva encima). */
  short: number;
  need: number;
  have: number;
  /** Hay uno suelto a la vista: puede ir sola, nadie tiene que traerlo. */
  visible: boolean;
  /** De qué se saca rompiéndolo, cuando no hay ninguno suelto ("árbol"). */
  fromLabel: string | null;
}

export interface GoalView {
  id: string;
  description: string;
  status: string;
  source: string;
  /** priority + urgency: el número con el que compiten entre sí. */
  score: number;
  /** Puesto en la fila de los activos, 1 = el que está haciendo ahora. */
  rank: number | null;
  /** Por qué quedó esperando, cuando está suspendido. */
  suspendedReason: string | null;
  /** Lo que le falta reunir; vacío si no necesita buscar nada. */
  needs: GoalNeedView[];
  /** Si es una obra: bloques puestos de cuántos, para la barra de avance. */
  structure: { label: string; placed: number; total: number } | null;
  /**
   * Sus pasos, cuando los descompuso (ADR 0053): objetivos hijos de verdad,
   * anidados acá para que la pantalla los dibuje dentro de la tarjeta del
   * padre. Un hijo nunca tiene hijos propios.
   */
  children: GoalView[];
}

export interface GameView {
  seed: number;
  tick: number;
  /** Hora del mundo (día/noche), derivada del reloj del mundo. */
  timeOfDay: TimeOfDay;
  running: boolean;
  speed: number;
  petColor: string;
  /** Nombre del proveedor de modelo activo ("mock", "codex", ...). */
  aiProvider: string;
  /** true mientras una consulta al modelo real está en vuelo. */
  aiBusy: boolean;
  /**
   * Si el proveedor simulado propone primero sus ideas equivocadas (ADR 0006,
   * adenda): el ciclo fallar→corregir a la vista. Es una preferencia guardada,
   * no el estado de un proveedor: existe (y se puede leer) aunque ahora mismo
   * piense con Codex — quien decide si aplica es `aiProvider`.
   */
  mockImperfect: boolean;
  /**
   * Modo creativo (ADR 0061): el cuerpo se mantiene lleno para poder construir
   * y experimentar sin que el hambre o el frío la maten en el medio.
   */
  creativeMode: boolean;
  /**
   * Lo que su vista alcanza ahora mismo, para dibujarlo. `null` cuando el
   * cuidador no lo pidió — y entonces ni se calcula: son cientos de celdas por
   * tick que nadie está mirando.
   */
  vision: VisionView | null;
  identity: { name: string; generation: number; ancestorId: string | null };
  /** Informe de legado cuando la mascota está muerta; null en vida. */
  death: LegacyReport | null;
  legacyCount: number;
  worldSize: { width: number; height: number };
  entities: EntityView[];
  /** Las obras plantadas, para dibujar dónde va a quedar cada pieza (ADR 0049). */
  plannedStructures: PlannedStructureView[];
  /** Catálogo de tipos de objeto: lo que hay, lo que lleva y lo construible. */
  items: ItemView[];
  /** Interacciones aprendidas del mundo (ADR 0027), reusables sin costo. */
  interactions: InteractionView[];
  /** Las obras que aprendió a levantar (ADR 0056). Ninguna viene de fábrica. */
  blueprints: BlueprintView[];
  /**
   * La poda que el cuidador pidió y todavía no confirmó (ADR 0075). null
   * mientras no hay ninguna en curso. Vive en el view y no en el estado local
   * del panel a propósito: el arrastre lo calcula el mundo, así que el mundo
   * es quien tiene que contarlo.
   */
  prune: PrunePreview | null;
  /**
   * Cuántas cosas guarda el catálogo del cuidador (ADR 0076): lo aprendido que
   * vive fuera de la partida y con lo que nace cada mundo nuevo. 0 = todavía
   * no aprendió nada que valga la pena guardar.
   */
  catalogSize: number;
  pet: PetView | null;
  goals: GoalView[];
  currentGoal: GoalView | null;
  currentStrategy: string | null;
  lastAction: string | null;
  speech: { text: string; tick: number } | null;
  /** Recogida reciente, mientras dura su ventana de visibilidad; null si no hay. */
  pickup: PickupView | null;
  chat: ChatEntry[];
  skills: SkillView[];
  experiments: ExperimentView[];
  /** Pensamientos en vivo del modelo real, del más viejo al más nuevo. */
  thoughts: ThoughtView[];
  /** La consulta todavía en vuelo, si hay una. */
  currentThought: ThoughtView | null;
  /** La espera de la consulta en vuelo; null cuando no piensa afuera. */
  aiWait: AiWaitView | null;
  /** El ciclo de desarrollo de habilidad en curso, visto en vivo. */
  skillDev: SkillDevProgressView | null;
  /** Mundos imaginados recientes (el más nuevo primero), para dibujarlos. */
  dreams: DreamView[];
  devEvents: DevEventView[];
  regressions: { scenarioName: string; seed: number; description: string }[];
  /** Rasgos emergentes derivados de su historia (0–4, deterministas). */
  personality: PersonalityTraitView[];
  facts: string[];
  hypotheses: { statement: string; confidence: number; resolved: string }[];
  /** Memoria episódica activa: lo que hizo y le pasó, con conteo (ADR 0033). */
  episodes: { kind: string; summary: string; occurrences: number; lastTick: number }[];
  storyCompleted: boolean;
  /**
   * La misión del mapa, si esta partida se juega en uno. `null` en el mundo de
   * siempre, que no tiene misión: la vida no es un nivel.
   *
   * El veredicto viene del juez de misiones, que mira el estado del mundo. Lo
   * que la mascota diga no lo cambia — y por eso esto no vive en el chat.
   */
  mission: MissionView | null;
}

export interface MissionView {
  id: string;
  name: string;
  /** Lo que el cuidador le planteó al empezar. */
  briefing: string;
  completed: boolean;
  completedAtTick: number | null;
  objectives: {
    id: string;
    describe: string;
    met: boolean;
    metAtTick: number | null;
    /** Qué falta para cumplirlo; `null` cuando ya está (el tilde ya lo dice). */
    detail: string | null;
  }[];
}
