/**
 * Evento estructurado común a todo el sistema (motor, agente, evaluador).
 * No se usan logs de texto libre: cada evento es un dato inspeccionable,
 * reproducible y consumible por la UI, las métricas y las pruebas.
 */
export interface StructuredEvent<TType extends string = string> {
  /** Nombre jerárquico, p. ej. "action.resolved" o "skill.promoted". */
  type: TType;
  /** Tick de simulación en el que ocurrió (o -1 si es un evento fuera del mundo). */
  tick: number;
  /** Carga útil serializable. */
  data: Record<string, unknown>;
}

export interface EventLog<TEvent extends StructuredEvent = StructuredEvent> {
  events: TEvent[];
  emit(event: TEvent): void;
  ofType<T extends TEvent['type']>(type: T): TEvent[];
}

export function createEventLog<TEvent extends StructuredEvent>(): EventLog<TEvent> {
  const events: TEvent[] = [];
  return {
    events,
    emit(event) {
      events.push(event);
    },
    ofType(type) {
      return events.filter((e) => e.type === type);
    },
  };
}
