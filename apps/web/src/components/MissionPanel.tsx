import type { GameView } from '../session/view.js';

/**
 * La misión del mapa: qué le plantearon y qué falta, según el mundo. Vive en
 * su propia pestaña —solo existe cuando se juega un mapa— porque leerla es un
 * acto aparte de mirar el tablero, y tenerla siempre a la vista le comía al
 * panel el espacio que necesitan el chat y los objetivos.
 *
 * Cada renglón es una condición que el juez mide contra el estado real. Al
 * lado va SU CUENTA —"0/1 entidades colocada en el río"— y no una etiqueta
 * genérica, porque el cuidador tiene que poder ver por qué algo todavía no
 * cuenta sin abrir la traza.
 *
 * Lo que la mascota diga no aparece acá. Si anunciara "ya crucé" estando de
 * este lado, este panel seguiría mostrando el renglón sin tildar: es
 * exactamente la diferencia que el panel existe para hacer visible.
 */
export function MissionPanel({ view }: { view: GameView }) {
  const mission = view.mission;
  if (!mission) return null;

  const done = mission.objectives.filter((o) => o.met).length;

  return (
    <section className="mission-panel">
      <header className="mission-panel__head">
        <h2>{mission.name}</h2>
        <span className={mission.completed ? 'mission-panel__badge is-done' : 'mission-panel__badge'}>
          {mission.completed ? 'superada' : `${done}/${mission.objectives.length}`}
        </span>
      </header>

      <p className="mission-panel__briefing">«{mission.briefing}»</p>

      <ul className="mission-panel__list">
        {mission.objectives.map((objective) => (
          <li
            key={objective.id}
            className={objective.met ? 'mission-panel__item is-met' : 'mission-panel__item'}
          >
            <span className="mission-panel__mark">{objective.met ? '✓' : '·'}</span>
            <span className="mission-panel__body">
              <span className="mission-panel__describe">{objective.describe}</span>
              <span className="mission-panel__detail">
                {objective.detail}
                {objective.metAtTick !== null ? ` · tick ${objective.metAtTick}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {mission.completed ? (
        <p className="mission-panel__note">
          Lo confirma el estado del mundo en el tick {mission.completedAtTick}, no lo que ella dijo.
        </p>
      ) : null}
    </section>
  );
}
