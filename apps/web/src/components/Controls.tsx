import { useState } from 'react';
import type { GameSession } from '../session/GameSession.js';
import type { GameView } from '../session/view.js';

const SPEEDS = [1, 2, 4, 8];

export function Controls({ session, view }: { session: GameSession; view: GameView }) {
  const [seedInput, setSeedInput] = useState(String(view.seed));

  return (
    <div className="controls">
      <button
        data-testid="pause-button"
        onClick={() => (view.running ? session.pause() : session.start())}
      >
        {view.running ? '⏸ Pausa' : '▶ Continuar'}
      </button>
      {!view.running && (
        <button data-testid="step-button" onClick={() => void session.stepOnce()}>
          ⏭ 1 tick
        </button>
      )}
      <div className="speed-group" role="group" aria-label="velocidad">
        {SPEEDS.map((s) => (
          <button
            key={s}
            data-testid={`speed-${s}`}
            className={view.speed === s ? 'active' : ''}
            onClick={() => session.setSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>
      <form
        className="seed-form"
        onSubmit={(e) => {
          e.preventDefault();
          const seed = Number(seedInput);
          if (Number.isFinite(seed)) session.reset(seed);
        }}
      >
        <input
          data-testid="seed-input"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          size={4}
          aria-label="semilla"
        />
        <button type="submit" data-testid="reset-button">
          ⟳ Reiniciar
        </button>
      </form>
    </div>
  );
}
