import { useEffect, useRef, useState } from 'react';
import type { GameSession } from '../session/GameSession.js';
import type { GameView } from '../session/view.js';

/**
 * Sugerencias para el primer mensaje: una de cada cosa que se puede hacer
 * (pedir, construir, preguntar, enseñar), para que descubrir el juego no
 * dependa de adivinar qué escribir. Desaparecen cuando el usuario ya habló.
 */
const FIRST_STEPS = [
  'traé un tronco',
  'construí una fogata',
  '¿qué estás haciendo?',
  'comer alimento te da energía',
];

export function ChatPanel({ view, session }: { view: GameView; session: GameSession }) {
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const userHasSpoken = view.chat.some((entry) => entry.from === 'user');

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [view.chat.length, view.aiBusy]);

  return (
    <div className="chat-panel">
      <div className="chat-log" ref={logRef} data-testid="chat-log" aria-busy={view.aiBusy}>
        {view.chat.map((entry, i) => (
          <div key={i} className={`chat-entry from-${entry.from}`}>
            <span className="chat-who">
              {entry.from === 'user' ? 'Tú' : entry.from === 'pet' ? view.identity.name : '·'}
            </span>
            <span className="chat-text">{entry.text}</span>
            <span className="chat-tick muted">t{entry.tick}</span>
          </div>
        ))}
        {view.aiBusy && (
          <div
            className="chat-entry from-pet thinking-entry"
            data-testid="chat-thinking"
            role="status"
            aria-live="polite"
          >
            <span className="chat-who">{view.identity.name}</span>
            <span className="chat-text thinking-text">
              pensando
              <span className="thinking-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </span>
          </div>
        )}
      </div>
      {!userHasSpoken && (
        <div className="chat-chips" data-testid="chat-chips">
          {FIRST_STEPS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="chip"
              disabled={view.aiBusy}
              onClick={() => session.sendUserMessage(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          session.sendUserMessage(text);
          setText('');
        }}
      >
        <input
          data-testid="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pedile algo, enseñale un hecho o preguntale qué hace…"
        />
        <button type="submit" data-testid="chat-send" disabled={view.aiBusy}>
          {view.aiBusy ? 'Pensando…' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
