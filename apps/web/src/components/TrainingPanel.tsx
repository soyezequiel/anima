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
 * Los datos de cada tarjeta salen del propio mapa (`mission.tests`,
 * `briefing`): esta pantalla no tiene una lista paralela que mantener
 * sincronizada. Agregar un mapa lo hace aparecer acá solo.
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
        <h4>{map.name}</h4>
        {active && <span className="training-card__now">en curso</span>}
      </div>
      <p className="training-card__briefing">«{map.mission.briefing}»</p>
      <ul className="training-card__tests">
        {map.mission.tests.map((test) => (
          <li key={test}>{test}</li>
        ))}
      </ul>
      <button
        type="button"
        className="training-card__go"
        data-testid={`training-start-${map.id}`}
        disabled={active}
        onClick={() => go(map.id)}
      >
        {active ? 'Estás acá' : 'Entrenar acá'}
      </button>
    </li>
  );
}

export function TrainingPanel({ view }: { view: GameView }) {
  const activeId = view.mission?.id ?? null;

  return (
    <div className="training-panel" data-testid="training-panel">
      {view.mission ? (
        <>
          <MissionPanel view={view} />
          <div className="training-panel__switch">
            <button type="button" onClick={() => go(null)} data-testid="training-leave">
              ← Volver a la partida principal
            </button>
          </div>
        </>
      ) : (
        <p className="section-sub muted">
          Los entrenamientos son mundos aparte, hechos para exigirle capacidades que la partida
          normal no le pide. Cada uno guarda su propio progreso: entrar y salir no toca a tu
          mascota.
        </p>
      )}

      <details className="training-list" open={activeId === null}>
        <summary>
          {activeId === null ? 'Entrenamientos disponibles' : 'Cambiar de entrenamiento'} (
          {MAPS.length})
        </summary>
        <ul>
          {[...MAPS]
            .sort((a, b) => a.order - b.order)
            .map((map) => (
              <TrainingCard key={map.id} map={map} active={map.id === activeId} />
            ))}
        </ul>
      </details>
    </div>
  );
}
