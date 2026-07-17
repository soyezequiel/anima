import type { GameSession } from '../session/GameSession.js';
import type { GameView } from '../session/view.js';

const SPEEDS = [1, 2, 4, 8];

/**
 * La pausa es el cero de la escala: estar quieto es correr a ninguna
 * velocidad, así que un solo control cubre las cinco posiciones.
 */
function speedIndex(view: GameView): number {
  if (!view.running) return 0;
  const exact = SPEEDS.indexOf(view.speed);
  if (exact !== -1) return exact + 1;
  // La velocidad puede llegar por URL fuera de la escala (?speed=3): el pulgar
  // se para en la más parecida en vez de mentir que el mundo está en pausa.
  let closest = 0;
  let bestGap = Number.POSITIVE_INFINITY;
  SPEEDS.forEach((speed, i) => {
    const gap = Math.abs(speed - view.speed);
    if (gap < bestGap) {
      bestGap = gap;
      closest = i;
    }
  });
  return closest + 1;
}

export function Controls({ session, view }: { session: GameSession; view: GameView }) {
  const index = speedIndex(view);
  // Fuera de la escala manda la verdad (?speed=3 dice «3x»), no la posición.
  const label = view.running ? `${view.speed}x` : 'pausa';

  const applyIndex = (next: number): void => {
    if (next === 0) {
      session.pause();
      return;
    }
    const speed = SPEEDS[next - 1];
    if (speed === undefined) return;
    // El orden importa: el próximo tick se agenda con la velocidad ya puesta.
    session.setSpeed(speed);
    if (!view.running) session.start();
  };

  return (
    <div className="controls">
      <div className={`speed-slider${view.running ? '' : ' paused'}`}>
        {/* Sin extremos rotulados: el pulgar ya dice dónde está en la escala,
            y el valor de al lado dice lo único que no se puede deducir. */}
        <input
          type="range"
          data-testid="speed-slider"
          min={0}
          max={SPEEDS.length}
          step={1}
          value={index}
          aria-label="velocidad"
          aria-valuetext={label}
          onChange={(event) => applyIndex(Number(event.currentTarget.value))}
        />
        <span className="speed-value" data-testid="speed-value">
          {label}
        </span>
      </div>
      {!view.running && (
        <button data-testid="step-button" onClick={() => void session.stepOnce()}>
          ⏭ 1 tick
        </button>
      )}
    </div>
  );
}
