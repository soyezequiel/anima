import { countedKindLabel, isFeminineKind, kindLabel, kindWithArticle } from '@anima/shared';
import type { Direction, Perception } from '@anima/sim-core';
import { missingIngredients, recipeProduct } from '@anima/sim-core';
import type { MemoryStore } from '@anima/memory';
import type { Goal } from './goals.js';

/**
 * Peticiones del usuario ya interpretadas a una forma estructurada.
 * (El parseo de lenguaje natural es responsabilidad del proveedor de modelo
 * o de un parser simple; la decisión de aceptar o negarse es del agente.)
 */
export type UserRequest =
  | { kind: 'destroy-entity'; targetKind: string; raw: string }
  /** `amount`: cuántas unidades pidió ("conseguí los 2 troncos"). 1 si no dijo. */
  | { kind: 'fetch-item'; targetKind: string; amount?: number; raw: string }
  | { kind: 'consume-item'; targetKind: string; raw: string }
  | { kind: 'wait-here'; raw: string }
  | { kind: 'move-direction'; directions: Direction[]; raw: string }
  /** Ejecutar una habilidad que ya aprendió y demostró en evaluación. */
  | { kind: 'run-skill'; skillName: string; raw: string }
  /** Construir algo según una receta que su mundo admite. */
  | { kind: 'craft-item'; recipeId: string; raw: string }
  /**
   * Manipular un objeto de una forma que las primitivas no cubren (ADR 0027):
   * la mascota busca una interacción aprendida, o inventa una y el mundo (la
   * puerta y la IA Dios) decide.
   */
  | { kind: 'interact-entity'; verb: string; targetKind: string; raw: string }
  | { kind: 'unknown'; raw: string };

export type RequestClassification =
  'accepted' | 'cannot' | 'will_not' | 'not_now' | 'needs_information';

export interface RequestDecision {
  classification: RequestClassification;
  reason: string;
  alternative?: string;
}

const CRITICAL_ENERGY_FRACTION = 0.2;

/** El nombre humano de un tipo. La tabla vive en @anima/shared: la mascota y
 * el dibujo del mundo tienen que llamar a las cosas igual. */
const displayKind = kindLabel;

/** "una silla", "un tronco": el género se adivina por la terminación. */
const withArticle = kindWithArticle;

/**
 * "2 troncos y 1 pedernal" — para decir qué falta en voz humana. Se exporta
 * porque decir qué falta no es solo cosa de aceptar o negarse: cuando se queda
 * sin material a mitad de construir, la respuesta honesta es la misma frase.
 */
export function displayMissing(missing: { kind: string; need: number; have: number }[]): string {
  return missing.map((m) => countedKindLabel(m.kind, m.need - m.have)).join(' y ');
}

/**
 * Pronombre acusativo que concuerda con lo que falta: "los junto", "la
 * traigo". Con géneros mezclados, el masculino plural — como en español.
 */
function missingPronoun(missing: { kind: string; need: number; have: number }[]): string {
  const total = missing.reduce((sum, m) => sum + (m.need - m.have), 0);
  const feminine = missing.every((m) => isFeminineKind(m.kind));
  if (total === 1) return feminine ? 'la' : 'lo';
  return feminine ? 'las' : 'los';
}

/** "alimento", "un tronco", "2 troncos": lo que va a buscar, en voz humana. */
function fetchPhrase(kind: string, amount: number): string {
  if (amount > 1) return countedKindLabel(kind, amount);
  // "alimento" es incontable: "un alimento" suena a etiqueta de supermercado.
  return kind === 'food' ? displayKind(kind) : withArticle(kind);
}

function displayDirections(directions: Direction[]): string {
  const labels: Record<Direction, string> = {
    up: 'hacia arriba',
    down: 'hacia abajo',
    left: 'a la izquierda',
    right: 'a la derecha',
  };
  return directions.map((direction) => labels[direction]).join(' y ');
}

/**
 * Decide si aceptar, posponer o rechazar una petición. Cada negativa tiene
 * una razón comprensible, coherente con lo que la mascota sabe y quiere, y
 * ofrece una alternativa cuando existe.
 */
export function evaluateUserRequest(
  request: UserRequest,
  perception: Perception,
  memory: MemoryStore,
  currentGoal: Goal | undefined,
  /** Habilidades estables disponibles: define qué puede aceptar de `run-skill`. */
  knownSkills: string[] = [],
): RequestDecision {
  if (request.kind === 'unknown') {
    return {
      classification: 'needs_information',
      reason: 'No entiendo qué me pides; ¿puedes decirlo de otra forma?',
    };
  }

  const energy = perception.self.energy;
  const energyCritical =
    energy !== undefined && energy.current / energy.max < CRITICAL_ENERGY_FRACTION;
  const relatedToFood =
    (request.kind === 'fetch-item' || request.kind === 'consume-item') &&
    request.targetKind === 'food';

  // Una prioridad más urgente manda: con energía crítica solo atiende comida.
  if (energyCritical && !relatedToFood && currentGoal?.source === 'internal-signal') {
    return {
      classification: 'not_now',
      reason: 'Mi energía está demasiado baja; primero necesito recuperarla.',
      alternative: 'Puedo intentarlo en cuanto haya comido.',
    };
  }

  switch (request.kind) {
    case 'wait-here':
      return { classification: 'accepted', reason: 'Puedo esperar aquí un momento.' };

    case 'move-direction':
      return {
        classification: 'accepted',
        reason: `Voy ${displayDirections(request.directions)}.`,
      };

    case 'craft-item': {
      const recipe = perception.recipes.find((r) => r.id === request.recipeId);
      if (!recipe) {
        // No saber la receta no es no poder: puede tener una idea y dejar que
        // el mundo la juzgue (ADR 0018). Negarse acá sería decidir en nombre
        // del mundo sobre algo que el mundo todavía no dijo — y la negativa
        // vieja («solo puedo construir lo que mi mundo permite») era falsa
        // desde que puede proponer recetas.
        return {
          classification: 'accepted',
          reason: `Todavía no sé construir ${withArticle(request.recipeId)}.`,
          alternative: 'Déjame pensar si se me ocurre algo con lo que tengo cerca.',
        };
      }
      const held = new Map<string, number>();
      for (const item of perception.self.heldItems) {
        held.set(item.kind, (held.get(item.kind) ?? 0) + 1);
      }
      // Lo que la receta da cuando sale bien: es lo que ella nombra al aceptar
      // la orden. Sigue siendo la respuesta honesta aunque la tirada pueda
      // darle otra cosa — "voy a construir" es lo que se propone hacer, no lo
      // que promete que va a pasar.
      const productKind = recipeProduct(recipe)?.kind ?? recipe.id;
      const missing = missingIngredients(recipe, held);
      if (missing.length > 0) {
        const totalMissing = missing.reduce((sum, m) => sum + (m.need - m.have), 0);
        const falta = totalMissing === 1 ? 'me falta' : 'me faltan';
        const outputPronoun = isFeminineKind(productKind) ? 'la' : 'lo';
        // Si TODO lo que falta está a la vista y alcanza, juntar es parte de
        // construir: la orden se acepta entera y no se le devuelve al cuidador
        // el trabajo de pilotear cada recogida. Solo cuando falta el RECURSO
        // (no está o no alcanza) la negativa es honesta (ADR 0008).
        const visibleCount = (kind: string): number =>
          perception.visibleEntities.filter((e) => e.kind === kind).length;
        // Lo que se puede COSECHAR también está al alcance: un árbol a la vista
        // es un tronco a la vista, con unos golpes de por medio. Sin esto se
        // negaba con "si me conseguís un tronco" rodeada de árboles, y ni
        // siquiera llegaba a intentarlo — el cuidador tenía que decirle "talá
        // un árbol" en cada partida.
        const harvestableCount = (kind: string): number =>
          perception.visibleEntities.reduce(
            (total, entity) =>
              total +
              (entity.held === true
                ? 0
                : (entity.dropKinds ?? []).filter((drop) => drop === kind).length),
            0,
          );
        const reachableCount = (kind: string): number =>
          visibleCount(kind) + harvestableCount(kind);
        const gatherable = missing.every((m) => reachableCount(m.kind) >= m.need - m.have);
        /** Lo que falta y no está suelto: hay que sacarlo rompiendo algo. */
        const harvestOnly = missing.filter(
          (m) => visibleCount(m.kind) < m.need - m.have && harvestableCount(m.kind) > 0,
        );
        // Aunque lo vea, tiene que caberle en los brazos. Con el inventario
        // lleno, recoger falla en silencio y "lo junto y la construyo" se volvía
        // "no veo más por acá" — capacidad, no recurso (ADR 0008). Pero las
        // manos llenas de SOBRAS no son un "no puedo": suelta lo que no sirve
        // para esta obra y junta igual (`makeRoom`). Solo es un "no puedo"
        // honesto cuando todo lo que carga es material que va a necesitar.
        const ingredientKinds = new Set(recipe.ingredients.map((i) => i.kind));
        const freeSlots = perception.self.inventoryCapacity - perception.self.heldItems.length;
        const droppable = perception.self.heldItems.filter((e) => !ingredientKinds.has(e.kind)).length;
        if (gatherable && freeSlots + droppable >= totalMissing) {
          return {
            classification: 'accepted',
            reason: `Entiendo, quiero construir ${withArticle(productKind)}; ${falta} ${displayMissing(missing)}.`,
            // Decir la verdad sobre de dónde va a salir: "lo junto" es mentira
            // si hay que talar un árbol para tenerlo.
            alternative:
              harvestOnly.length > 0
                ? `${displayMissing(harvestOnly)} no ${harvestOnly.length === 1 ? 'está' : 'están'} por acá suelto, pero puedo sacarlo de lo que hay: voy y ${outputPronoun} construyo.`
                : `Veo lo que falta cerca: ${missingPronoun(missing)} junto y ${outputPronoun} construyo.`,
          };
        }
        if (gatherable) {
          const lo = totalMissing === 1 ? 'lo' : 'los';
          return {
            classification: 'cannot',
            reason: `Entiendo, quiero construir ${withArticle(productKind)}; ${falta} ${displayMissing(missing)} y lo veo cerca, pero tengo las manos llenas de cosas que voy a necesitar (cargo ${perception.self.inventoryCapacity}).`,
            alternative: `Si suelto algo, puedo juntar${lo} y ${outputPronoun} construyo.`,
          };
        }
        const visible = missing.filter((m) => visibleCount(m.kind) > 0);
        return {
          classification: 'cannot',
          reason: `Entiendo, quiero construir ${withArticle(productKind)}, pero ${falta} ${displayMissing(missing)}.`,
          alternative:
            visible.length > 0
              ? `Veo ${displayMissing(visible)} cerca, pero no alcanza para todo. Si me consigues el resto, ${outputPronoun} construyo.`
              : `Si me consigues ${displayMissing(missing)}, ${outputPronoun} construyo.`,
        };
      }
      return {
        classification: 'accepted',
        reason: `Voy a construir ${withArticle(productKind)}.`,
      };
    }

    case 'run-skill': {
      if (!knownSkills.includes(request.skillName)) {
        return {
          classification: 'cannot',
          reason: `Todavía no tengo aprendida la habilidad "${request.skillName}".`,
          alternative: 'Si me explicas en qué consiste, puedo intentar aprenderla.',
        };
      }
      return {
        classification: 'accepted',
        reason: `Voy a hacer "${request.skillName}".`,
      };
    }

    case 'destroy-entity': {
      const targetName = displayKind(request.targetKind);
      if (request.targetKind === 'unknown') {
        return {
          classification: 'needs_information',
          reason: 'Entiendo la acción, pero no qué objeto quieres que destruya.',
          alternative: 'Puedes nombrar un muro, una rama, un martillo o un árbol.',
        };
      }
      // PRIMERO los hechos, DESPUÉS los valores. El orden no es estético: un
      // `will_not` tiene que significar "puedo, pero no quiero", porque es el
      // único juicio que un modelo puede repensar (ADR 0019). Cuando esta
      // comprobación iba antes, "tala el árbol" devolvía "no quiero" sin haber
      // mirado nunca si lo veía o si tenía herramienta — y el juicio de valores
      // podía terminar autorizando lo imposible.
      const visibleTarget = perception.visibleEntities.some((e) => e.kind === request.targetKind);
      if (!visibleTarget) {
        return {
          classification: 'needs_information',
          reason: `No veo ningún ${targetName} desde aquí.`,
          alternative: '¿Puedes mostrarme dónde está?',
        };
      }
      const hasAnyTool =
        perception.self.heldItems.some((e) => e.toolPower !== undefined) ||
        perception.visibleEntities.some((e) => e.toolPower !== undefined);
      if (!hasAnyTool) {
        return {
          classification: 'cannot',
          reason: `No tengo ninguna herramienta capaz de dañar ese ${targetName}.`,
          alternative: 'Si me consigues una herramienta fuerte, puedo intentarlo.',
        };
      }
      // Puede. Ahora sí: ¿quiere? Se niega a destruir lo que cree que necesita.
      const believesNeeded =
        request.targetKind === 'food' ||
        request.targetKind === 'tree' ||
        memory
          .factList()
          .some(
            (f) =>
              f.statement.includes(request.targetKind) &&
              (f.statement.includes('produce') || f.statement.includes('recupera')),
          );
      if (believesNeeded) {
        return {
          classification: 'will_not',
          reason: `No quiero destruir ${targetName}: creo que lo necesito para recuperar energía.`,
          alternative: 'Puedo buscar otro objeto que destruir o recolectar algo caído.',
        };
      }
      return {
        classification: 'accepted',
        reason: `Voy a intentar destruir ese ${targetName}.`,
      };
    }

    case 'interact-entity': {
      const verbPhrase = request.verb.replace(/-/g, ' ');
      if (request.targetKind === 'unknown' || !request.targetKind) {
        return {
          classification: 'needs_information',
          reason: `Entiendo que quieres que haga "${verbPhrase}", pero no con qué objeto.`,
          alternative: '¿Puedes nombrarlo?',
        };
      }
      const targetName = displayKind(request.targetKind);
      const visibleTarget =
        perception.visibleEntities.some((e) => e.kind === request.targetKind) ||
        perception.self.heldItems.some((e) => e.kind === request.targetKind);
      if (!visibleTarget) {
        return {
          classification: 'needs_information',
          reason: `No veo ningún ${targetName} desde aquí.`,
          alternative: '¿Puedes mostrarme dónde está?',
        };
      }
      // ¿Ya lo sabe hacer? Saberlo es física suya: se acepta sin inventar nada.
      const known = perception.interactions.some(
        (interaction) =>
          interaction.target.kind === request.targetKind ||
          interaction.id.startsWith(request.verb),
      );
      if (known) {
        return {
          classification: 'accepted',
          reason: `Voy a ${verbPhrase} con ${withArticle(request.targetKind)}: ya sé cómo.`,
        };
      }
      // No saberlo no es no poder: puede tener la idea y que su mundo (la
      // puerta y el juez de la lógica) decida — el mismo trato que las
      // recetas sin receta (ADR 0018 / 0027).
      return {
        classification: 'accepted',
        reason: `Todavía no sé ${verbPhrase} con ${withArticle(request.targetKind)}.`,
        alternative: 'Déjame imaginar cómo, y que mi mundo juzgue si tiene lógica.',
      };
    }

    case 'fetch-item':
    case 'consume-item': {
      const targetName = displayKind(request.targetKind);
      if (request.targetKind === 'unknown') {
        return {
          classification: 'needs_information',
          reason: 'Entiendo la acción, pero no qué objeto buscas.',
          alternative: 'Puedes nombrar comida, una rama o un martillo.',
        };
      }
      const visible = perception.visibleEntities.some((e) => e.kind === request.targetKind);
      const held = perception.self.heldItems.some((e) => e.kind === request.targetKind);
      if (!visible && !held) {
        // No verlo ya no es no saber: los programas de pedidos recorren el
        // mapa hasta ver lo que buscan (op `explore`). Aceptar anunciando la
        // búsqueda es mejor que devolverle al cuidador el trabajo de señalar
        // con el dedo — y si el mapa entero no lo tiene, el fallo posterior
        // («no encuentro el objeto») será verdad buscada, no ceguera de rango.
        const pronoun = isFeminineKind(request.targetKind) ? 'la' : 'lo';
        return {
          classification: 'accepted',
          reason: `No veo ${targetName} desde aquí: voy a recorrer el mapa para buscar${pronoun}.`,
        };
      }
      return request.kind === 'consume-item'
        ? { classification: 'accepted', reason: `Voy a comer ${targetName}.` }
        : {
            classification: 'accepted',
            reason: `Voy a buscar ${fetchPhrase(request.targetKind, request.amount ?? 1)}.`,
          };
    }
  }
}

function normalizeMessage(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** "trae 2 troncos", "conseguí los dos", "ambas": cuántas unidades pide. */
function parseAmount(lower: string): number | undefined {
  const digits = /\b([2-9])\b/.exec(lower);
  if (digits) return Number(digits[1]);
  if (/\b(ambos|ambas)\b/.test(lower)) return 2;
  const words: [RegExp, number][] = [
    [/\bdos\b/, 2],
    [/\btres\b/, 3],
    [/\bcuatro\b/, 4],
    [/\bcinco\b/, 5],
  ];
  for (const [pattern, value] of words) if (pattern.test(lower)) return value;
  return undefined;
}

/**
 * "continua", "seguí", "dale": pedir que retome lo pendiente, no una orden
 * nueva. Se exige que el mensaje sea SOLO eso (con muletillas chicas): "sigue
 * derecho hacia arriba" contiene "sigue" y aun así es una orden de movimiento.
 */
export function isContinuationMessage(text: string): boolean {
  const lower = normalizeMessage(text).trim();
  return /^(y |bueno,? |ok,? |dale,? )?(continua(la|lo)?|continuar|segui(la|lo)?|sigue|seguir|prosigue|dale|hacelo( igual)?|hazlo|hace eso|intenta(lo)? de nuevo|intentalo|proba(lo)? de nuevo|probalo|retoma(la|lo)?|termina(la|lo)?|otra vez|de nuevo)[\s.!¡¿?]*$/.test(
    lower,
  );
}

/**
 * "sí", "dale", "hacela": respuesta afirmativa a una pregunta que la mascota
 * dejó pendiente (¿la hago parte de mi mundo?). Como isContinuationMessage,
 * exige que el mensaje sea SOLO eso: "sí, pero antes traé un tronco" es una
 * orden nueva, no una confirmación.
 */
export function isAffirmativeReply(text: string): boolean {
  const lower = normalizeMessage(text).trim();
  return /^(y |bueno,? |ok,? )?(si+|claro( que si)?|obvio|dale|ok|okey|de acuerdo|por supuesto|adelante|me encanta|hacela|hacelo|hazla|hazlo|agregala|agregalo|sumala|sumalo|quiero)[\s.!¡¿?]*$/.test(
    lower,
  );
}

/** "no", "mejor no", "dejalo": rechazo explícito de lo que quedó pendiente. */
export function isNegativeReply(text: string): boolean {
  const lower = normalizeMessage(text).trim();
  return /^(y |bueno,? |eh,? |no,? )?(no+|mejor no|nah|no,? gracias|no quiero|dejalo|dejala|cancelalo|cancelala|olvidalo|olvidala)[\s.!¡¿?]*$/.test(
    lower,
  );
}

/**
 * Bautismos: "te voy a llamar Luna", "tu nombre es Sol". Se buscan sobre el
 * texto original (no el normalizado) para conservar mayúsculas y acentos del
 * nombre elegido. Una pregunta ("¿cómo te llamas?") no captura nada después
 * del verbo, así que no es un bautismo.
 */
const RENAME_PATTERNS: RegExp[] = [
  /\bte\s+(?:voy\s+a\s+llamar|llamar[eé]|bautizo(?:\s+como)?|nombro|pongo(?:\s+de\s+nombre)?)\s+(.+)$/iu,
  /\b(?:ahora\s+)?te\s+llam[aá]s\s+(.+)$/iu,
  /\btu\s+nombre\s+(?:es|ser[aá])\s+(.+)$/iu,
];

/** Limpia lo capturado: sin comillas ni puntuación final, corto y con inicial mayúscula. */
function cleanPetName(raw: string): string {
  const name = raw
    .replace(/["'«»“”]/g, '')
    .split(/[.,;:!?¡¿\n]/)[0]!
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 24)
    .trim();
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "te voy a llamar Luna" → "Luna"; null si el mensaje no es un bautismo. */
export function parseRename(text: string): string | null {
  for (const pattern of RENAME_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1] !== undefined) {
      const name = cleanPetName(match[1]);
      if (name) return name;
    }
  }
  return null;
}

/** Parser local de peticiones frecuentes. El resto se deriva al proveedor de diálogo. */
export function parseUserMessage(
  text: string,
): UserRequest | { kind: 'explanation'; raw: string } | { kind: 'rename-pet'; name: string; raw: string } {
  const renameTo = parseRename(text);
  if (renameTo !== null) return { kind: 'rename-pet', name: renameTo, raw: text };
  const lower = normalizeMessage(text);
  const aliases: [word: string, kind: string][] = [
    ['comida', 'food'],
    ['alimento', 'food'],
    ['manzana', 'food'],
    ['fruta', 'food'],
    ['food', 'food'],
    ['muro', 'wall'],
    ['pared', 'wall'],
    ['wall', 'wall'],
    ['rama', 'branch'],
    ['branch', 'branch'],
    ['martillo', 'hammer'],
    ['hammer', 'hammer'],
    ['arbol', 'tree'],
    ['tree', 'tree'],
    ['tronco', 'log'],
    ['log', 'log'],
    ['pedernal', 'flint'],
    ['flint', 'flint'],
    // "piedra" era `flint` de cuando el pedernal era la única piedra que había.
    // Desde que existe `stone`, ese alias mandaba a buscar lo otro: quien pide
    // una piedra quiere la piedra, y el que quiere la chispa la nombra.
    ['piedra', 'stone'],
    ['stone', 'stone'],
    ['roca', 'rock'],
    ['fibra', 'fiber'],
    ['arcilla', 'clay'],
    ['barro', 'clay'],
    ['resina', 'resin'],
    ['mineral', 'ore'],
    ['veta', 'vein'],
    ['ladrillo', 'brick'],
    ['pico', 'stone-pick'],
    ['arbusto', 'bush'],
    ['pino', 'pine'],
    ['fogata', 'campfire'],
    ['hoguera', 'campfire'],
    ['silla', 'chair'],
    ['antorcha', 'torch'],
    ['muralla', 'barricade'],
    ['empalizada', 'barricade'],
  ];
  const mentions = aliases
    .map(([word, kind]) => ({ kind, index: lower.indexOf(word) }))
    .filter((mention) => mention.index >= 0)
    .sort((a, b) => a.index - b.index);
  const kindWord = (action: 'destroy' | 'consume' | 'other'): string => {
    if (action === 'consume' && mentions.some((mention) => mention.kind === 'food')) return 'food';
    if (action === 'destroy') {
      // En "tala el árbol con el hammer", el martillo es instrumento, no objetivo.
      const nonToolTarget = mentions.find((mention) => mention.kind !== 'hammer');
      if (nonToolTarget) return nonToolTarget.kind;
    }
    return mentions[0]?.kind ?? 'unknown';
  };
  const asksToMove =
    /\b(anda|andate|ve|vete|mueve|muevete|movete|moverte|camina|camine|corre|dirigete|desplazate|sube|baja|move)\b/.test(
      lower,
    );
  if (asksToMove) {
    const directionAliases: [pattern: RegExp, direction: Direction][] = [
      [/\b(arriba|norte|sube|up)\b/, 'up'],
      [/\b(abajo|sur|baja|down)\b/, 'down'],
      [/\b(izquierda|oeste|left)\b/, 'left'],
      [/\b(derecha|este|right)\b/, 'right'],
    ];
    const directions = directionAliases
      .map(([pattern, direction]) => ({ direction, index: lower.search(pattern) }))
      .filter((match) => match.index >= 0)
      .sort((a, b) => a.index - b.index)
      .map((match) => match.direction);
    if (directions.length > 0) return { kind: 'move-direction', directions, raw: text };
  }
  if (
    /\b(destruye|destruir|rompe|romper|rompas|derriba|derribar|tala|talar|tales|tale|talen|corta|cortar|cortes|golpea|golpear)\b/.test(
      lower,
    )
  ) {
    return { kind: 'destroy-entity', targetKind: kindWord('destroy'), raw: text };
  }
  // Antes que "buscar"/"traer": "construí una fogata" no es traer una fogata.
  // El parser conoce las recetas del MVP a mano; con un modelo real, las
  // recetas viajan en el prompt y esta tabla no hace falta.
  if (
    /\b(construye|construi|construir|construyas|crea|crear|cree|crees|arma|armar|haz|hace|hacer|fabrica|fabricar|prepara|preparar|prende|prender|enciende|encender)\b/.test(
      lower,
    )
  ) {
    const recipeWords: [pattern: RegExp, recipeId: string][] = [
      [/\b(fogata|hoguera|fuego|campfire)\b/, 'campfire'],
      [/\b(silla|asiento|chair)\b/, 'chair'],
      [/\b(antorcha|torch)\b/, 'torch'],
      [/\b(muralla|empalizada|barricada|barrera|valla)\b/, 'barricade'],
      [/\b(ladrillo|ladrillos|brick)\b/, 'brick'],
      [/\b(pico|pica|pickaxe)\b/, 'stone-pick'],
    ];
    const match = recipeWords.find(([pattern]) => pattern.test(lower));
    if (match) return { kind: 'craft-item', recipeId: match[1], raw: text };
  }
  // Con sufijos: "traé", "traelos", "buscame", "conseguilos" son la misma
  // orden que "trae" — los clíticos del español rioplatense van pegados.
  if (
    /\b(trae\w*|traer|busca\w*|buscar|recoge\w*|recoger|agarra\w*|agarrar|toma\w*|tomar|consigue\w*|consegui\w*|conseguir|junta\w*|juntar)\b/.test(
      lower,
    )
  ) {
    const amount = parseAmount(lower);
    return {
      kind: 'fetch-item',
      targetKind: kindWord('other'),
      ...(amount !== undefined ? { amount } : {}),
      raw: text,
    };
  }
  if (/energ/.test(lower) && /(com|aliment|fruta|manzana)/.test(lower)) {
    return { kind: 'explanation', raw: text };
  }
  if (/\b(come|comer|comete|consume|consumir)\b/.test(lower)) {
    return { kind: 'consume-item', targetKind: kindWord('consume'), raw: text };
  }
  if (/\b(espera|esperar|quedate|para)\b/.test(lower)) {
    return { kind: 'wait-here', raw: text };
  }
  return { kind: 'unknown', raw: text };
}
