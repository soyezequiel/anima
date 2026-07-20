import { useEffect, useReducer, useRef } from 'react';
import type { GameView } from '../session/view.js';

/**
 * Qué pestaña se está moviendo AHORA. El panel muestra una sola a la vez, así
 * que todo lo que pasa en las otras cinco ocurre a ciegas: la mascota junta un
 * pedernal, termina un muro o aprueba una habilidad y el cuidador se entera
 * recién cuando se le ocurre ir a mirar. Los contadores no alcanzan —un número
 * que sube de 23 a 24 no se ve—, así que cada pestaña enciende un punto cuando
 * lo que ella muestra cambió.
 *
 * La regla es una sola: de cada pestaña se saca una FIRMA de lo que ese panel
 * dibuja; si la firma cambió respecto del tick anterior, la pestaña queda
 * encendida un rato. Nada de eventos nuevos en el motor — la actividad es una
 * lectura de la vista, y así ninguna pantalla puede mentir sobre el mundo.
 */

export type ActivityTab =
  | 'chat'
  | 'entrenamiento'
  | 'objetivos'
  | 'estado'
  | 'objetos'
  | 'obras'
  | 'habilidades'
  | 'pensamiento'
  | 'ensayos';

export const ACTIVITY_TABS: ActivityTab[] = [
  'chat',
  'entrenamiento',
  'objetivos',
  'estado',
  'objetos',
  'obras',
  'habilidades',
  'pensamiento',
  'ensayos',
];

/**
 * Cuánto queda encendido un cambio. Suficiente para cruzar la mirada desde el
 * tablero, corto para que dos cosas seguidas se lean como dos y no como una
 * luz fija.
 */
export const ACTIVITY_WINDOW_MS = 4000;

export interface TabActivityState {
  /** La última firma vista de cada pestaña. */
  signatures: Record<ActivityTab, string>;
  /** Hasta cuándo queda encendida (ms epoch); Infinity mientras algo sigue en curso. */
  until: Record<ActivityTab, number>;
}

/**
 * Lo que cada panel dibuja, reducido a un string. No entra todo el view: los
 * signos vitales cambian cada tick y dejarían «Estado» encendida para siempre,
 * que es lo mismo que apagada.
 */
function signature(view: GameView, tab: ActivityTab): string {
  switch (tab) {
    case 'chat': {
      const last = view.chat[view.chat.length - 1];
      return `${view.chat.length}|${last?.tick ?? -1}|${last?.from ?? ''}`;
    }
    case 'entrenamiento':
      // Un objetivo que se cumple (o que se deshace) es la actividad más
      // importante que hay: es el mundo diciendo que algo cambió de verdad.
      // Sin mapa no hay misión, y una firma vacía nunca enciende nada.
      return (
        view.mission?.objectives.map((o) => `${o.id}:${o.met ? '1' : '0'}`).join(',') ?? ''
      );
    case 'objetivos':
      // El puesto en la fila también cuenta: cambiar de prioridad ES actividad.
      return view.goals.map((g) => `${g.id}:${g.status}:${g.rank ?? '-'}`).join(',');
    case 'estado':
      // Mochila, personalidad y memoria: lo que esta pestaña muestra de verdad.
      return [
        (view.pet?.inventory ?? []).map((i) => i.kind).join('.'),
        view.personality.map((p) => p.id).join('.'),
        view.facts.length,
        view.hypotheses.map((h) => h.resolved).join('.'),
      ].join('|');
    case 'objetos':
      return view.items.map((i) => `${i.kind}:${i.inWorld}:${i.inInventory}`).join(',');
    case 'obras':
      return [
        view.blueprints.map((b) => b.id).join('.'),
        // Bloques ya puestos: una obra que avanza es la actividad más lenta y
        // la más fácil de perderse.
        view.plannedStructures.map((s) => `${s.blueprintId}:${s.remaining}`).join('.'),
      ].join('|');
    case 'habilidades':
      // Una versión nueva o un cambio de estado es actividad; el registro de
      // ensayos, en cambio, es de la pestaña de al lado.
      return view.skills.map((s) => `${s.id}:${s.version}:${s.status}`).join('.');
    case 'pensamiento':
      return `${view.thoughts.length}|${view.currentThought?.status ?? ''}`;
    case 'ensayos':
      return String(view.experiments.length);
  }
}

/**
 * Lo que no es un cambio puntual sino algo que sigue pasando: mientras dure,
 * la pestaña se queda encendida. Un ciclo de habilidad puede tardar minutos y
 * apagarse a los cuatro segundos sería mentir sobre lo que está ocurriendo.
 */
function sustained(view: GameView, tab: ActivityTab): boolean {
  switch (tab) {
    case 'chat':
      // Un mensaje del cuidador todavía sin leer, o ella escribiendo respuesta.
      return (
        view.chat.some((entry) => entry.pending === true) ||
        (view.currentThought?.kind === 'dialogue' && view.currentThought.status === 'thinking')
      );
    case 'habilidades':
      // El ciclo de una habilidad puede tardar minutos: mientras nace, la
      // pestaña donde va a aparecer se queda encendida.
      return view.skillDev !== null;
    case 'pensamiento':
      // Una consulta al modelo en vuelo: se apaga cuando contesta, no a los
      // cuatro segundos.
      return view.currentThought?.status === 'thinking';
    default:
      return false;
  }
}

function emptyRecord<T>(value: T): Record<ActivityTab, T> {
  return Object.fromEntries(ACTIVITY_TABS.map((tab) => [tab, value])) as Record<ActivityTab, T>;
}

/**
 * El primer view no enciende nada: al abrir la partida todo es «nuevo» y la
 * fila entera prendida no dice nada.
 */
export function initialActivity(view: GameView): TabActivityState {
  const signatures = emptyRecord('');
  for (const tab of ACTIVITY_TABS) signatures[tab] = signature(view, tab);
  return { signatures, until: emptyRecord(0) };
}

export function advanceActivity(
  previous: TabActivityState,
  view: GameView,
  nowMs: number,
): TabActivityState {
  const signatures = emptyRecord('');
  const until = emptyRecord(0);
  for (const tab of ACTIVITY_TABS) {
    const next = signature(view, tab);
    signatures[tab] = next;
    if (sustained(view, tab)) {
      until[tab] = Number.POSITIVE_INFINITY;
    } else if (next !== previous.signatures[tab] || previous.until[tab] === Number.POSITIVE_INFINITY) {
      // Lo que dejó de estar en curso también se apaga con cola: si no, el
      // final de un ciclo largo desaparece sin que nadie lo haya visto.
      until[tab] = nowMs + ACTIVITY_WINDOW_MS;
    } else {
      until[tab] = previous.until[tab];
    }
  }
  return { signatures, until };
}

export function litTabs(state: TabActivityState, nowMs: number): Set<ActivityTab> {
  return new Set(ACTIVITY_TABS.filter((tab) => state.until[tab] > nowMs));
}

/** Cuándo se apaga la próxima; null si no queda nada encendido que caduque. */
export function nextExpiryMs(state: TabActivityState, nowMs: number): number | null {
  const pending = ACTIVITY_TABS.map((tab) => state.until[tab]).filter(
    (until) => until > nowMs && until !== Number.POSITIVE_INFINITY,
  );
  return pending.length > 0 ? Math.min(...pending) : null;
}

/**
 * La versión de React. Avanza con el view —cada tick trae uno nuevo— y pone un
 * temporizador para apagar: con el mundo en pausa no llegan views y sin el
 * temporizador el punto quedaría prendido hasta el próximo movimiento.
 */
export function useTabActivity(view: GameView): Set<ActivityTab> {
  const seen = useRef<{ view: GameView; state: TabActivityState } | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  if (seen.current === null) {
    seen.current = { view, state: initialActivity(view) };
  } else if (seen.current.view !== view) {
    seen.current = { view, state: advanceActivity(seen.current.state, view, Date.now()) };
  }
  const state = seen.current.state;

  useEffect(() => {
    const expiry = nextExpiryMs(state, Date.now());
    if (expiry === null) return;
    const timer = setTimeout(bump, Math.max(0, expiry - Date.now()) + 1);
    return () => clearTimeout(timer);
  }, [state]);

  return litTabs(state, Date.now());
}
