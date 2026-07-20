import { MAPS } from '@anima/missions';
import type { GameView } from '../session/view.js';
import { MissionPanel } from './MissionPanel.js';

/**
 * Elegir en qué entrenar, y ver cómo va el entrenamiento en curso.
 *
 * Un entrenamiento es un MUNDO distinto, no un modo: tiene su propia geografía
 * y su propia ranura de guardado. Por eso cambiar de entrenamiento recarga la
 * página — y por eso entrar y salir no cuesta nada, porque cada uno se retoma
 * donde quedó y la partida principal ni se entera.
 *
 * La pantalla contesta UNA pregunta por vez. Adentro de un entrenamiento, la
 * pregunta es «¿cómo voy?» y manda `MissionPanel`; el selector se pliega a un
 * renglón. Fuera, la pregunta es «¿a cuál entro?» y el selector es todo.
 *
 * Cada tarjeta se lee en una línea: número, lugar y el desafío en tres
 * palabras (`mission.name`, que ya existía y no se mostraba en ningún lado).
 * El briefing —que es lo que se le dice a la mascota, no al cuidador— espera
 * plegado, y `mission.tests` no aparece: está escrito en vocabulario del motor
 * («colocarlo en una celda concreta (`place`)»), que es para el informe de
 * desarrollo y no para quien elige dónde entrenar.
 */

/** Cambiar de mundo es cargar otro mundo: la URL manda y la página se rehace. */
function go(mapId: string | null): void {
  const url = new URL(window.location.href);
  if (mapId === null) url.searchParams.delete('map');
  else url.searchParams.set('map', mapId);
  // La semilla de la partida anterior no tiene por qué valer en otro mundo.
  url.searchParams.delete('seed');
  window.location.href = url.toString();
}

function TrainingCard({ map, active }: { map: (typeof MAPS)[number]; active: boolean }) {
  return (
    <li className={active ? 'training-card is-active' : 'training-card'}>
      <div className="training-card__head">
        <span className="training-card__n">{map.order}</span>
        <span className="training-card__name">{map.name}</span>
        <span className="training-card__goal">{map.mission.name}</span>
        {active ? (
          <span className="training-card__now">en curso</span>
        ) : (
          <button
            type="button"
            className="training-card__go"
            data-testid={`training-start-${map.id}`}
            onClick={() => go(map.id)}
          >
            Entrenar acá
          </button>
        )}
      </div>
      <details className="training-card__brieffold">
        <summary>qué le van a pedir</summary>
        <p className="training-card__briefing">«{map.mission.briefing}»</p>
      </details>
    </li>
  );
}

function TrainingList({ activeId }: { activeId: string | null }) {
  return (
    <ul className="training-cards">
      {[...MAPS]
        .sort((a, b) => a.order - b.order)
        .map((map) => (
          <TrainingCard key={map.id} map={map} active={map.id === activeId} />
        ))}
    </ul>
  );
}

export function TrainingPanel({ view }: { view: GameView }) {
  const activeId = view.mission?.id ?? null;

  // Adentro de un entrenamiento: cómo va, y el selector fuera del camino.
  if (activeId !== null) {
    return (
      <div className="training-panel" data-testid="training-panel">
        <MissionPanel view={view} />
        <div className="training-panel__switch">
          <button type="button" onClick={() => go(null)} data-testid="training-leave">
            ← Volver a la partida principal
          </button>
        </div>
        <details className="training-list">
          <summary>Cambiar de entrenamiento ({MAPS.length})</summary>
          <TrainingList activeId={activeId} />
        </details>
      </div>
    );
  }

  return (
    <div className="training-panel" data-testid="training-panel">
      <p className="section-sub muted">
        Mundos aparte, hechos para exigirle lo que la partida normal no le pide. Cada uno guarda su
        propio progreso: entrar y salir no toca a tu mascota.
      </p>
      <TrainingList activeId={null} />
    </div>
  );
}
