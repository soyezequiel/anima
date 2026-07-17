import { countedKindLabel, kindLabel, kindWithArticle } from '@anima/shared';
import type { Interaction, Perception } from '@anima/sim-core';
import type { EntityQuery, SkillLibrary, SkillOp, SkillProgram } from '@anima/skill-runtime';
import type { GoalUserRequest } from './goals.js';
import { SKILL_REACH_BLOCKED_FOOD } from './names.js';
import { gatherAndCraftProgram, heldCounts } from './programs.js';

/**
 * De la petición del cuidador al programa que la cumple: composición
 * determinista de primitivas, sin modelo de por medio. Vive aparte del agente
 * porque no depende de su estado — recibe la petición, la percepción y lo que
 * necesita saber (biblioteca de skills, interacciones aprendidas) y devuelve
 * el programa o la frase de cierre.
 */

export interface UserRequestProgramDeps {
  library: SkillLibrary;
  /** Búsqueda de una interacción aprendida aplicable (reuso, ADR 0027). */
  findInteraction(
    verb: string,
    targetKind: string,
    perception: Perception,
  ): Interaction | undefined;
}

/**
 * Buscar antes de rendirse: si lo que el pedido nombra no está a la vista,
 * recorrer el mapa hasta verlo en vez de abortar en el acto con "no encuentro
 * el objeto". Si ya lo ve (o lo lleva), la exploración no cuesta ni un tick:
 * el `until` se evalúa antes del primer paso. Si el mapa entero no lo tiene,
 * el `findEntities` siguiente aborta igual que antes — pero ahora ese "no
 * había" es verdad buscada, no ceguera de rango.
 */
function searchFor(query: EntityQuery): SkillOp {
  return { op: 'explore', maxSteps: 50, until: { type: 'sees', query } };
}

export function programForUserRequest(
  request: GoalUserRequest,
  perception: Perception,
  deps: UserRequestProgramDeps,
): SkillProgram {
  const targetKind = request.targetKind ?? 'unknown';
  switch (request.kind) {
    case 'wait-here':
      return [{ op: 'wait', ticks: 6 }];

    case 'craft-item': {
      // Juntar lo que falte es parte de construir: el mismo programa que la
      // aproximación del fuego, sin la espera junto al calor. Si ya lleva
      // todo encima, la recolección se salta sola y el mundo vuelve a
      // comprobar los ingredientes por su cuenta.
      const recipe = request.recipeId
        ? perception.recipes.find((r) => r.id === request.recipeId)
        : undefined;
      return recipe
        ? gatherAndCraftProgram(recipe, { held: heldCounts(perception), searchFirst: true })
        : [{ op: 'abort', reason: 'no-sé-qué-construir' }];
    }

    case 'run-skill': {
      const stable = request.skillName ? deps.library.findStable(request.skillName) : undefined;
      // Solo se ejecuta lo que pasó por el evaluador: una habilidad que ya
      // no está estable (deprecada por una versión peor, archivada) no se
      // corre por inercia.
      return stable
        ? [{ op: 'runSkill', skillId: stable.id }]
        : [{ op: 'abort', reason: 'no-conozco-esa-habilidad' }];
    }

    case 'move-direction': {
      const program: SkillProgram = [];
      for (const direction of request.directions ?? []) {
        program.push(
          { op: 'moveStep', dir: direction },
          {
            op: 'branch',
            if: { type: 'lastActionFailed' },
            then: [{ op: 'abort', reason: 'camino-bloqueado' }],
          },
        );
      }
      return program.length > 0
        ? program
        : [{ op: 'abort', reason: 'dirección-no-especificada' }];
    }

    case 'fetch-item': {
      const fetchOne: SkillOp[] = [
        searchFor({ kind: targetKind, held: false }),
        // held:false: "traé un tronco" pide OTRO tronco. Sin el filtro, la
        // búsqueda devolvía el que ya llevaba (nearest lo ordena a distancia
        // 0) y el programa terminaba "cumplido" sin traer nada — pedir dos
        // ingredientes iguales era imposible.
        { op: 'findEntities', query: { kind: targetKind, held: false }, store: 'requestedItems' },
        {
          op: 'selectTarget',
          from: 'requestedItems',
          strategy: 'nearest',
          store: 'requestedItem',
        },
        {
          op: 'branch',
          if: { type: 'not', cond: { type: 'holding', target: 'requestedItem' } },
          then: [
            { op: 'moveToward', target: 'requestedItem', maxSteps: 40 },
            {
              op: 'branch',
              if: { type: 'lastMoveBlocked' },
              then: [{ op: 'abort', reason: 'camino-bloqueado' }],
            },
            { op: 'pickup', target: 'requestedItem' },
            {
              op: 'branch',
              if: { type: 'lastActionFailed' },
              then: [{ op: 'abort', reason: 'no-pude-recogerlo' }],
            },
          ],
        },
      ];
      // "conseguí los 2 troncos" son 2 recogidas, no una recogida y un
      // "Listo" que deja al cuidador contando por la mascota.
      const amount = Math.min(request.amount ?? 1, 8);
      return amount > 1 ? [{ op: 'repeatWithLimit', max: amount, body: fetchOne }] : fetchOne;
    }

    case 'consume-item': {
      const stable =
        targetKind === 'food' ? deps.library.findStable(SKILL_REACH_BLOCKED_FOOD) : undefined;
      if (stable) return [{ op: 'runSkill', skillId: stable.id }];
      return [
        searchFor({ kind: targetKind }),
        { op: 'findEntities', query: { kind: targetKind }, store: 'requestedFoods' },
        {
          op: 'selectTarget',
          from: 'requestedFoods',
          strategy: 'nearest',
          store: 'requestedFood',
        },
        {
          op: 'branch',
          if: { type: 'not', cond: { type: 'holding', target: 'requestedFood' } },
          then: [
            { op: 'moveToward', target: 'requestedFood', maxSteps: 40 },
            {
              op: 'branch',
              if: { type: 'lastMoveBlocked' },
              then: [{ op: 'abort', reason: 'camino-bloqueado' }],
            },
          ],
        },
        { op: 'consume', target: 'requestedFood' },
        {
          op: 'branch',
          if: { type: 'lastActionFailed' },
          then: [{ op: 'abort', reason: 'no-pude-comerlo' }],
        },
      ];
    }

    case 'interact-entity': {
      const interaction =
        request.verb && request.targetKind
          ? deps.findInteraction(request.verb, request.targetKind, perception)
          : undefined;
      // Sin interacción no hay programa: o el juez la vetó, o el crédito de
      // inventar se agotó sin que el mundo aceptara ninguna.
      if (!interaction) return [{ op: 'abort', reason: 'sin-interaccion' }];

      const ops: SkillOp[] = [];
      // Lo que exige llevar se junta primero, como los ingredientes de una
      // receta: ir a interactuar sin el balde es ir a fallar.
      if (interaction.requires) {
        ops.push(
          searchFor({ kind: interaction.requires.heldKind }),
          {
            op: 'findEntities',
            query: { kind: interaction.requires.heldKind },
            store: 'requiredItems',
          },
          { op: 'selectTarget', from: 'requiredItems', strategy: 'nearest', store: 'requiredItem' },
          {
            op: 'branch',
            if: { type: 'not', cond: { type: 'holding', target: 'requiredItem' } },
            then: [
              { op: 'moveToward', target: 'requiredItem', maxSteps: 40 },
              { op: 'pickup', target: 'requiredItem' },
              {
                op: 'branch',
                if: { type: 'lastActionFailed' },
                then: [{ op: 'abort', reason: 'no-pude-recogerlo' }],
              },
            ],
          },
        );
      }
      ops.push(
        searchFor({ kind: targetKind }),
        { op: 'findEntities', query: { kind: targetKind }, store: 'interactTargets' },
        { op: 'selectTarget', from: 'interactTargets', strategy: 'nearest', store: 'interactTarget' },
      );
      if (interaction.stance === 'held') {
        // El objetivo tiene que ir en la mano: recogerlo es parte del pedido.
        ops.push({
          op: 'branch',
          if: { type: 'not', cond: { type: 'holding', target: 'interactTarget' } },
          then: [
            { op: 'moveToward', target: 'interactTarget', maxSteps: 40 },
            { op: 'pickup', target: 'interactTarget' },
            {
              op: 'branch',
              if: { type: 'lastActionFailed' },
              then: [{ op: 'abort', reason: 'no-pude-recogerlo' }],
            },
          ],
        });
      } else {
        ops.push(
          {
            op: 'moveToward',
            target: 'interactTarget',
            maxSteps: 40,
            // Adyacente alcanza para TODAS las posturas: en encima/debajo el
            // propio acto de interactuar sube a la mascota a la celda del
            // objeto (también si es sólido, que caminando sería impisable).
            stopAtDistance: 1,
          },
          {
            op: 'branch',
            if: { type: 'lastMoveBlocked' },
            then: [{ op: 'abort', reason: 'camino-bloqueado' }],
          },
        );
      }
      ops.push(
        { op: 'interact', interactionId: interaction.id, target: 'interactTarget' },
        {
          op: 'branch',
          if: { type: 'lastActionFailed' },
          then: [{ op: 'abort', reason: 'no-pude-interactuar' }],
        },
      );
      return ops;
    }

    case 'destroy-entity':
      return [
        // La herramienta primero: buscar el objetivo después la deja fresca en
        // la percepción (recoger la herramienta pudo llevarla lejos de él).
        searchFor({ tool: true }),
        { op: 'findEntities', query: { tool: true }, store: 'availableTools' },
        {
          op: 'selectTarget',
          from: 'availableTools',
          strategy: 'strongestTool',
          store: 'bestTool',
        },
        {
          op: 'branch',
          if: { type: 'not', cond: { type: 'holding', target: 'bestTool' } },
          then: [
            { op: 'moveToward', target: 'bestTool', maxSteps: 40 },
            { op: 'pickup', target: 'bestTool' },
            {
              op: 'branch',
              if: { type: 'lastActionFailed' },
              then: [{ op: 'abort', reason: 'no-pude-recoger-la-herramienta' }],
            },
          ],
        },
        searchFor({ kind: targetKind }),
        { op: 'findEntities', query: { kind: targetKind }, store: 'requestedTargets' },
        {
          op: 'selectTarget',
          from: 'requestedTargets',
          strategy: 'nearest',
          store: 'requestedTarget',
        },
        { op: 'moveToward', target: 'requestedTarget', maxSteps: 40 },
        {
          op: 'branch',
          if: { type: 'lastMoveBlocked' },
          then: [{ op: 'abort', reason: 'camino-bloqueado' }],
        },
        {
          op: 'repeatWithLimit',
          max: 20,
          until: { type: 'entityGone', ref: 'requestedTarget' },
          body: [{ op: 'useItem', item: 'bestTool', target: 'requestedTarget' }],
        },
        {
          op: 'branch',
          if: { type: 'not', cond: { type: 'entityGone', ref: 'requestedTarget' } },
          then: [{ op: 'abort', reason: 'objetivo-resistió' }],
        },
      ];
  }
}

export function completionReply(request: GoalUserRequest): string {
  // El nombre sale del vocabulario compartido: "recogí el tronco", nunca
  // "recogí eso" para un objeto con nombre conocido.
  const name = request.targetKind ? kindLabel(request.targetKind) : 'eso';
  const target = request.targetKind ? `${/a$/.test(name) ? 'la' : 'el'} ${name}` : 'eso';
  switch (request.kind) {
    case 'wait-here':
      return 'Listo, esperé aquí un momento.';
    case 'run-skill':
      return `Listo, hice "${request.skillName ?? 'eso'}".`;
    case 'craft-item':
      // Sin género: lo construido puede ser "la silla" o "el brasero" que
      // Ánima inventó, y acá solo hay un recipeId para adivinar.
      return 'Listo, ya está en su lugar.';
    case 'move-direction': {
      const labels = {
        up: 'hacia arriba',
        down: 'hacia abajo',
        left: 'a la izquierda',
        right: 'a la derecha',
      } as const;
      const destination = (request.directions ?? [])
        .map((direction) => labels[direction])
        .join(' y ');
      return `Listo, me moví ${destination}.`;
    }
    case 'fetch-item': {
      const amount = request.amount ?? 1;
      return amount > 1 && request.targetKind
        ? `Listo, junté ${countedKindLabel(request.targetKind, amount)}.`
        : `Listo, recogí ${target}.`;
    }
    case 'consume-item':
      return `Listo, comí ${target}.`;
    case 'destroy-entity':
      return `Listo, destruí ${target}.`;
    case 'interact-entity': {
      const verbPhrase = (request.verb ?? 'hacer eso').replace(/-/g, ' ');
      return request.targetKind
        ? `Listo: ${verbPhrase} con ${kindWithArticle(request.targetKind)}, hecho.`
        : 'Listo, ya está.';
    }
  }
}
