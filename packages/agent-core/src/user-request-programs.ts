import { countedKindLabel, kindLabel, kindWithArticle } from '@anima/shared';
import type {
  Blueprint,
  BlueprintPlacement,
  Direction,
  Interaction,
  Perception,
} from '@anima/sim-core';
import type { EntityQuery, SkillLibrary, SkillOp, SkillProgram } from '@anima/skill-runtime';
import type { GoalUserRequest } from './goals.js';
import { SKILL_REACH_BLOCKED_FOOD } from './names.js';
import { buildStructureProgram, gatherAndCraftProgram, heldCounts } from './programs.js';
import { spatialRequestProgram } from './spatial-goals.js';

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
  /**
   * Pasos hacia donde recuerda un material que ahora no ve (memoria de
   * lugares, ADR 0025), o undefined si no recuerda nada de ese tipo. Al juntar
   * para construir, un tronco tras un muro es invisible (la vista exige línea
   * despejada) pero recordado: ir a donde lo vio evita el vagar a ciegas.
   */
  rememberedWalk(kind: string): Direction[] | undefined;
  /** Pasos al último lugar recordado de una entidad cuya identidad ya se resolvió. */
  rememberedWalkForEntity(entityId: string): Direction[] | undefined;
  /**
   * De qué tipo cosechar un material que ninguna receta produce ("log" sale de
   * romper un "tree"), o undefined si nada de lo que ve lo deja caer. Sin esto,
   * pedirle una obra cuya materia base se saca del mundo a golpes terminaba en
   * «no hay troncos» con el bosque delante.
   */
  harvestSource(kind: string): string | undefined;
  /**
   * Dónde se planta esta obra y qué le falta (ADR 0049): los pasos hasta el
   * sitio elegido y las celdas que todavía no tienen su bloque. `null` si no
   * hay claro donde levantarla — ahí la obra no arranca en vez de desparramar
   * bloques en celdas ocupadas.
   */
  structureSite(
    blueprint: Blueprint,
  ): { approach: Direction[]; pending: BlueprintPlacement[] } | null;
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

/**
 * Levantar una obra en su sitio. Lo llaman los DOS pasos que pueden pedirla:
 * el que la construye y el que la deja puesta en algún lado. Para una obra son
 * lo mismo —el sitio ES la colocación—, y tenerlo escrito una sola vez es lo
 * que evita que los dos pasos discrepen sobre dónde va.
 */
function buildWork(
  blueprint: Blueprint,
  perception: Perception,
  deps: UserRequestProgramDeps,
): SkillProgram {
  // Dónde va la obra lo decide el agente (tiene el sitio guardado) y no el
  // generador: plantarla donde esté parada la mudaba en cada reanudación y
  // podía pedir celdas ocupadas (ADR 0049).
  const site = deps.structureSite(blueprint);
  // Sin sitio no se levanta nada (ADR 0071). Antes la ausencia de sitio caía en
  // «plantala donde estés», que es justo el comportamiento que el ADR 0049 vino
  // a eliminar: con el mapa cerrado alrededor, colocaba los bloques sobre las
  // piedras que tenía delante y repetía «la acción no produjo el resultado
  // esperado». No tener dónde construir es una respuesta legítima, y dicha con
  // todas las letras es más útil que una obra plantada en el primer lugar que
  // tocó.
  if (!site) return [{ op: 'abort', reason: 'sin-sitio' }];
  return buildStructureProgram(blueprint, {
    held: heldCounts(perception),
    recipes: perception.recipes,
    rememberedWalk: deps.rememberedWalk,
    harvestSource: deps.harvestSource,
    capacity: perception.self.inventoryCapacity,
    approach: site.approach,
    pending: site.pending,
  });
}

export function programForUserRequest(
  request: GoalUserRequest,
  perception: Perception,
  deps: UserRequestProgramDeps,
): SkillProgram {
  const targetKind = request.targetKind ?? 'unknown';
  const targetQuery = (extra: Partial<EntityQuery> = {}): EntityQuery => ({
    ...(request.targetEntityId ? { id: request.targetEntityId } : {}),
    kind: targetKind,
    ...extra,
  });
  const rememberedApproach = request.targetEntityId
    ? (deps.rememberedWalkForEntity(request.targetEntityId) ?? []).map((dir): SkillOp => ({
        op: 'moveStep',
        dir,
      }))
    : [];
  switch (request.kind) {
    case 'wait-here':
      return [{ op: 'wait', ticks: 6 }];

    case 'craft-item': {
      // ¿Objeto u obra? Si lo pedido es un plano (ADR 0032), se levanta como
      // obra: juntar los bloques y colocarlos donde el plano dice. El plano
      // manda sobre la receta si por algún motivo existieran los dos con el
      // mismo nombre — una casa es un lugar, no una cosa.
      const blueprint = request.recipeId
        ? perception.blueprints.find((b) => b.id === request.recipeId)
        : undefined;
      if (blueprint) return buildWork(blueprint, perception, deps);
      // Juntar lo que falte es parte de construir: el mismo programa que la
      // aproximación del fuego, sin la espera junto al calor. Si ya lleva
      // todo encima, la recolección se salta sola y el mundo vuelve a
      // comprobar los ingredientes por su cuenta.
      const recipe = request.recipeId
        ? perception.recipes.find((r) => r.id === request.recipeId)
        : undefined;
      return recipe
        ? gatherAndCraftProgram(recipe, {
            held: heldCounts(perception),
            searchFirst: true,
            // Con el árbol a la vista (ADR 0031), las piezas que sabe hacer
            // son un paso más de la obra y no un "no hay": pedirle una casa
            // es pedirle también las paredes.
            recipes: perception.recipes,
            rememberedWalk: deps.rememberedWalk,
            // Y la materia base que no sale de ninguna receta, del mundo a
            // golpes: pedirle una casa es pedirle también talar los árboles.
            harvestSource: deps.harvestSource,
          })
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
      return program.length > 0 ? program : [{ op: 'abort', reason: 'dirección-no-especificada' }];
    }

    case 'spatial-relation':
      return request.spatial
        ? spatialRequestProgram(request.spatial)
        : [{ op: 'abort', reason: 'relación-espacial-sin-ubicar' }];

    case 'fetch-item': {
      if (
        request.targetEntityId &&
        perception.self.heldItems.some((item) => item.id === request.targetEntityId)
      ) {
        return [{ op: 'wait', ticks: 1 }];
      }
      const fetchOne: SkillOp[] = [
        ...rememberedApproach,
        searchFor(targetQuery({ held: false })),
        // held:false: "traé un tronco" pide OTRO tronco. Sin el filtro, la
        // búsqueda devolvía el que ya llevaba (nearest lo ordena a distancia
        // 0) y el programa terminaba "cumplido" sin traer nada — pedir dos
        // ingredientes iguales era imposible.
        { op: 'findEntities', query: targetQuery({ held: false }), store: 'requestedItems' },
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
        ...rememberedApproach,
        searchFor(targetQuery()),
        { op: 'findEntities', query: targetQuery(), store: 'requestedFoods' },
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

    case 'place-item': {
      // Poner una cosa EN un lugar nombrado por lo que hay ahí. Es la primitiva
      // `place` del mundo, alcanzable por fin desde el chat: juntar lo que hay
      // que poner, ir hasta el lugar, y colocarlo en ESA celda.
      //
      // La celda es la del sitio, no un offset desde donde ella esté parada:
      // sin `markTarget` esto no se podía escribir, y "ponelo sobre el agua"
      // terminaba desviado a inventar una interacción para un verbo que el
      // mundo ya sabía hacer.
      const onKind = request.onKind ?? 'unknown';
      // Sin saber qué ni dónde, no hay programa. Buscar un tipo que nadie
      // nombró es recorrer el mapa entero para no encontrar nada y abortar
      // cincuenta ticks después con un motivo que no dice la verdad.
      if (targetKind === 'unknown' || onKind === 'unknown') {
        return [{ op: 'abort', reason: 'no-sé-qué-poner-ni-dónde' }];
      }
      // ¿Y si lo que hay que poner resultó ser una OBRA?
      //
      // El encargo se tradujo cuando el puente todavía era una cosa: «fabricá
      // un puente» y después «poné el puente sobre el agua». En el medio, el
      // juez le dijo que un puente no es una cosa sino una obra (ADR 0079), y
      // ella rehízo el plan en piezas. Pero este paso siguió buscando una
      // entidad llamada «puente» que ya nadie iba a fabricar: salía a
      // recorrer el mapa detrás de un fantasma y abortaba `no-candidates`.
      //
      // Para una obra, PONERLA es levantarla en el lugar correcto — y el sitio
      // ya escucha el `onKind` de este mismo paso. Así que el paso se cumple
      // construyendo: es idempotente (lo ya colocado no se recoloca), de modo
      // que sobre una obra terminada no hace nada y sobre una a medias la
      // completa, que es exactamente lo que «asegurate de que quede puesto»
      // debería significar.
      const work = perception.blueprints.find((b) => b.id === targetKind);
      if (work) return buildWork(work, perception, deps);
      return [
        ...rememberedApproach,
        searchFor(targetQuery()),
        { op: 'findEntities', query: targetQuery(), store: 'toPlace' },
        { op: 'selectTarget', from: 'toPlace', strategy: 'nearest', store: 'block' },
        {
          op: 'branch',
          if: { type: 'not', cond: { type: 'holding', target: 'block' } },
          then: [
            { op: 'moveToward', target: 'block', maxSteps: 40 },
            { op: 'pickup', target: 'block' },
            {
              op: 'branch',
              if: { type: 'lastActionFailed' },
              then: [{ op: 'abort', reason: 'no-pude-recogerlo' }],
            },
          ],
        },
        searchFor({ kind: onKind }),
        { op: 'findEntities', query: { kind: onKind }, store: 'spots' },
        { op: 'selectTarget', from: 'spots', strategy: 'nearest', store: 'spot' },
        // Al lado, no encima: para colocar hay que llegar con el brazo, y la
        // celda de destino puede ser justamente la que no se puede pisar.
        { op: 'moveToward', target: 'spot', maxSteps: 40, stopAtDistance: 1 },
        { op: 'markTarget', from: 'spot', store: 'spotCell' },
        { op: 'placeAt', kind: targetKind, target: 'spotCell' },
        {
          op: 'branch',
          if: { type: 'lastActionFailed' },
          then: [{ op: 'abort', reason: 'no-pude-colocarlo' }],
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
        ...rememberedApproach,
        searchFor(targetQuery()),
        { op: 'findEntities', query: targetQuery(), store: 'interactTargets' },
        {
          op: 'selectTarget',
          from: 'interactTargets',
          strategy: 'nearest',
          store: 'interactTarget',
        },
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
        ...rememberedApproach,
        searchFor(targetQuery()),
        { op: 'findEntities', query: targetQuery(), store: 'requestedTargets' },
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
          body: [
            { op: 'useItem', item: 'bestTool', target: 'requestedTarget' },
            // Golpear no es insistir a ciegas: si el golpe no cambió nada, un solo
            // intento ya lo prueba. Dejar de repetir el mismo no-op veinte veces
            // (lo que dejaba a Ánima pegada) y decir la verdad de por qué no salió.
            {
              op: 'branch',
              // Categóricamente inmune (sin durabilidad): no se puede romper, nunca.
              if: { type: 'lastActionUnaffected' },
              then: [{ op: 'abort', reason: 'objetivo-inmune' }],
            },
            {
              op: 'branch',
              // Pegó pero no hizo mella: la herramienta es demasiado débil para su dureza.
              if: { type: 'lastStrikeIneffective' },
              then: [{ op: 'abort', reason: 'objetivo-muy-duro' }],
            },
          ],
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
    case 'spatial-relation':
      return request.relation === 'opposite-side'
        ? `Listo, crucé al otro lado de ${name}.`
        : request.relation === 'near'
          ? `Listo, me acerqué a ${name}.`
          : `Listo, me alejé de ${name}.`;
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
    case 'place-item':
      return `Listo, dejé ${request.targetKind ?? 'eso'} sobre ${request.onKind ?? 'ahí'}.`;

    case 'interact-entity': {
      const verbPhrase = (request.verb ?? 'hacer eso').replace(/-/g, ' ');
      return request.targetKind
        ? `Listo: ${verbPhrase} con ${kindWithArticle(request.targetKind)}, hecho.`
        : 'Listo, ya está.';
    }
  }
}
