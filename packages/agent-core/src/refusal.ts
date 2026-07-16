import type { Direction, Perception } from '@anima/sim-core';
import { missingIngredients } from '@anima/sim-core';
import type { MemoryStore } from '@anima/memory';
import type { Goal } from './goals.js';

/**
 * Peticiones del usuario ya interpretadas a una forma estructurada.
 * (El parseo de lenguaje natural es responsabilidad del proveedor de modelo
 * o de un parser simple; la decisión de aceptar o negarse es del agente.)
 */
export type UserRequest =
  | { kind: 'destroy-entity'; targetKind: string; raw: string }
  | { kind: 'fetch-item'; targetKind: string; raw: string }
  | { kind: 'consume-item'; targetKind: string; raw: string }
  | { kind: 'wait-here'; raw: string }
  | { kind: 'move-direction'; directions: Direction[]; raw: string }
  /** Ejecutar una habilidad que ya aprendió y demostró en evaluación. */
  | { kind: 'run-skill'; skillName: string; raw: string }
  /** Construir algo según una receta que su mundo admite. */
  | { kind: 'craft-item'; recipeId: string; raw: string }
  | { kind: 'unknown'; raw: string };

export type RequestClassification =
  'accepted' | 'cannot' | 'will_not' | 'not_now' | 'needs_information';

export interface RequestDecision {
  classification: RequestClassification;
  reason: string;
  alternative?: string;
}

const CRITICAL_ENERGY_FRACTION = 0.2;

function displayKind(kind: string): string {
  return (
    {
      food: 'alimento',
      wall: 'muro',
      branch: 'rama',
      hammer: 'martillo',
      tree: 'árbol',
      log: 'tronco',
      flint: 'pedernal',
      campfire: 'fogata',
      chair: 'silla',
    }[kind] ?? kind
  );
}

/** Plural en español: "2 troncos", "2 pedernales". */
function pluralKind(kind: string, amount: number): string {
  const name = displayKind(kind);
  if (amount === 1) return name;
  return /[aeiou]$/.test(name) ? `${name}s` : `${name}es`;
}

/** "una silla", "un tronco": el género se adivina por la terminación. */
function withArticle(kind: string): string {
  const name = displayKind(kind);
  return /a$/.test(name) ? `una ${name}` : `un ${name}`;
}

/** "2 troncos y 1 pedernal" — para decir qué falta en voz humana. */
function displayMissing(missing: { kind: string; need: number; have: number }[]): string {
  return missing
    .map((m) => {
      const amount = m.need - m.have;
      return `${amount} ${pluralKind(m.kind, amount)}`;
    })
    .join(' y ');
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
        return {
          classification: 'cannot',
          reason: `No sé cómo construir "${displayKind(request.recipeId)}".`,
          alternative: 'Solo puedo construir lo que mi mundo permite.',
        };
      }
      const held = new Map<string, number>();
      for (const item of perception.self.heldItems) {
        held.set(item.kind, (held.get(item.kind) ?? 0) + 1);
      }
      const missing = missingIngredients(recipe, held);
      if (missing.length > 0) {
        const totalMissing = missing.reduce((sum, m) => sum + (m.need - m.have), 0);
        const falta = totalMissing === 1 ? 'me falta' : 'me faltan';
        // Falta un recurso, no una capacidad (ADR 0008): sabe hacerlo, no
        // tiene con qué. Si lo ve cerca lo dice, en vez de prometer traerlo:
        // ir a buscarlo es otra petición, y el cuidador puede pedírsela.
        const visible = missing.filter((m) =>
          perception.visibleEntities.some((e) => e.kind === m.kind),
        );
        return {
          classification: 'cannot',
          reason: `Entiendo, quiero construir ${withArticle(recipe.output.kind)}, pero ${falta} ${displayMissing(missing)}.`,
          alternative:
            visible.length > 0
              ? `Veo ${displayMissing(visible)} cerca: pídeme que lo traiga y voy.`
              : `Si me consigues ${displayMissing(missing)}, la construyo.`,
        };
      }
      return {
        classification: 'accepted',
        reason: `Voy a construir ${withArticle(recipe.output.kind)}.`,
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
      // Se niega a destruir lo que cree que necesita (valores aprendidos).
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
      return {
        classification: 'accepted',
        reason: `Voy a intentar destruir ese ${targetName}.`,
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
      const remembered = memory.retrieve(request.targetKind, 3);
      if (!visible && remembered.episodes.length === 0 && remembered.facts.length === 0) {
        return {
          classification: 'needs_information',
          reason: `No sé dónde encontrar ${targetName}.`,
          alternative: '¿Puedes darme una pista de dónde buscar?',
        };
      }
      return request.kind === 'consume-item'
        ? { classification: 'accepted', reason: `Voy a comer ${targetName}.` }
        : { classification: 'accepted', reason: `Voy a buscar ${targetName}.` };
    }
  }
}

function normalizeMessage(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Parser local de peticiones frecuentes. El resto se deriva al proveedor de diálogo. */
export function parseUserMessage(text: string): UserRequest | { kind: 'explanation'; raw: string } {
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
    ['piedra', 'flint'],
    ['flint', 'flint'],
    ['fogata', 'campfire'],
    ['hoguera', 'campfire'],
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
    /\b(construye|construi|construir|construyas|arma|armar|haz|hacer|fabrica|fabricar|prepara|preparar|enciende|encender)\b/.test(
      lower,
    )
  ) {
    const recipeWords: [pattern: RegExp, recipeId: string][] = [
      [/\b(fogata|hoguera|fuego|campfire)\b/, 'campfire'],
      [/\b(silla|asiento|chair)\b/, 'chair'],
    ];
    const match = recipeWords.find(([pattern]) => pattern.test(lower));
    if (match) return { kind: 'craft-item', recipeId: match[1], raw: text };
  }
  if (/\b(trae|traer|busca|buscar|recoge|recoger|agarra|agarrar|toma|tomar)\b/.test(lower)) {
    return { kind: 'fetch-item', targetKind: kindWord('other'), raw: text };
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
