import type { EntityId, WorldState } from '@anima/sim-core';
import { allEntities } from '@anima/sim-core';
import type { StructuredEvent } from '@anima/shared';
import type { Mission } from './map.js';
import type { MissionHistory, ObjectiveResult } from './objectives.js';
import { evaluateObjective, flattenObjectives } from './objectives.js';

export type MissionEventType =
  | 'mission.started'
  | 'mission.objective.met'
  /** Se cumplió y después dejó de cumplirse: el mundo se deshizo. */
  | 'mission.objective.lost'
  | 'mission.completed'
  | 'mission.failed';

export type MissionEvent = StructuredEvent<MissionEventType>;

export interface MissionStatus {
  missionId: string;
  completed: boolean;
  completedAtTick?: number;
  objectives: ObjectiveResult[];
}

/**
 * El juez de una misión. No conoce al agente ni al modelo: mira el mundo y el
 * registro de hechos que el motor emitió, y dice qué se cumplió.
 *
 * Su única memoria es la que hace falta para distinguir lo hecho de lo que ya
 * estaba: qué tipos existían al empezar, qué entidades nacieron, cuáles se
 * colocaron, cuántas reglas aprendió el mundo. Sin eso, "creó un objeto" sería
 * indistinguible de "encontró un objeto".
 */
export class MissionTracker {
  readonly events: MissionEvent[] = [];
  private readonly initialKinds: Set<string>;
  private readonly initialEntityIds: Set<string>;
  private readonly craftedIds = new Set<string>();
  private readonly placedIds = new Set<string>();
  private readonly learned = { recipe: 0, interaction: 0, blueprint: 0, decomposition: 0 };
  private readonly log: StructuredEvent[] = [];
  private readonly metAt = new Map<string, number>();
  private completedAtTick: number | undefined;

  constructor(
    private readonly mission: Mission,
    world: WorldState,
    private readonly petId: EntityId,
  ) {
    this.initialKinds = new Set(allEntities(world).map((e) => e.kind));
    // Lo que las reglas ya sabían producir al empezar tampoco es invención:
    // un tipo que una receta sembrada fabrica existía antes de que ella
    // pensara nada, aunque todavía no hubiera ninguno en el suelo.
    for (const recipe of world.recipes) {
      for (const outcome of recipe.outcomes) {
        if (outcome.output) this.initialKinds.add(outcome.output.kind);
      }
    }
    this.initialEntityIds = new Set(allEntities(world).map((e) => e.id));
    this.events.push({
      type: 'mission.started',
      tick: world.tick,
      data: { missionId: mission.id, name: mission.name },
    });
  }

  /**
   * Consume los hechos de un tick. Admite los del motor y los de quien lo
   * conduce (el agente, el evaluador de habilidades): el juez no distingue
   * fuentes, distingue hechos de afirmaciones. Un `skill.promoted` es el
   * veredicto de código determinista; un `agent.spoke` no prueba nada, y por
   * eso ningún objetivo lo mira.
   */
  observe(events: readonly StructuredEvent[]): void {
    for (const event of events) {
      this.log.push(event);
      switch (event.type) {
        case 'item.crafted': {
          const id = event.data.itemId;
          if (typeof id === 'string') this.craftedIds.add(id);
          break;
        }
        case 'item.placed': {
          const id = event.data.itemId;
          if (typeof id === 'string') this.placedIds.add(id);
          break;
        }
        case 'recipe.learned':
          this.learned.recipe += 1;
          break;
        case 'interaction.learned':
          this.learned.interaction += 1;
          break;
        case 'blueprint.learned':
          this.learned.blueprint += 1;
          break;
        case 'decomposition.learned':
          this.learned.decomposition += 1;
          break;
        default:
          break;
      }
    }
  }

  private history(): MissionHistory {
    return {
      initialKinds: this.initialKinds,
      initialEntityIds: this.initialEntityIds,
      craftedIds: this.craftedIds,
      placedIds: this.placedIds,
      learned: this.learned,
      events: this.log,
    };
  }

  /**
   * Juzga el estado actual. Registra el primer tick en que cada objetivo se
   * cumple (lo que permite exigir un orden causal) y emite los eventos.
   */
  evaluate(world: WorldState): MissionStatus {
    const ctx = {
      world,
      petId: this.petId,
      zones: this.mission.zones,
      history: this.history(),
      metAt: this.metAt,
      // Para que una secuencia nombre sus pasos como los nombra la lista, en
      // vez de mostrar el id interno del objetivo.
      describeOf: new Map(
        flattenObjectives(this.mission.objectives).map((o) => [o.id, o.describe]),
      ),
    };
    // Dos pasadas: las hojas primero, para que una secuencia lea los ticks de
    // sus partes ya actualizados en este mismo tick.
    for (const objective of flattenObjectives(this.mission.objectives)) {
      if (objective.kind === 'sequence') continue;
      const result = evaluateObjective(objective, ctx);
      this.note(result, world.tick);
    }
    const objectives = this.mission.objectives.map((objective) => {
      const result = evaluateObjective(objective, ctx);
      this.note(result, world.tick);
      const at = this.metAt.get(result.id);
      return at !== undefined && result.met ? { ...result, metAtTick: at } : result;
    });
    const completed = objectives.every((o) => o.met);
    if (completed && this.completedAtTick === undefined) {
      this.completedAtTick = world.tick;
      this.events.push({
        type: 'mission.completed',
        tick: world.tick,
        data: {
          missionId: this.mission.id,
          objectives: objectives.map((o) => ({ id: o.id, detail: o.detail })),
        },
      });
    }
    return {
      missionId: this.mission.id,
      completed,
      ...(this.completedAtTick !== undefined ? { completedAtTick: this.completedAtTick } : {}),
      objectives,
    };
  }

  private note(result: ObjectiveResult, tick: number): void {
    const known = this.metAt.get(result.id);
    if (result.met && known === undefined) {
      this.metAt.set(result.id, tick);
      this.events.push({
        type: 'mission.objective.met',
        tick,
        data: { missionId: this.mission.id, objective: result.id, detail: result.detail },
      });
    } else if (!result.met && known !== undefined) {
      this.metAt.delete(result.id);
      this.events.push({
        type: 'mission.objective.lost',
        tick,
        data: { missionId: this.mission.id, objective: result.id, detail: result.detail },
      });
    }
  }
}
