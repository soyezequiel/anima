import { useEffect, useRef, useState } from 'react';
import type { GameSession } from '../session/GameSession.js';
import type { GameView } from '../session/view.js';

export function ChatPanel({ view, session }: { view: GameView; session: GameSession }) {
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [view.chat.length]);

  return (
    <div className="chat-panel">
      <div className="chat-log" ref={logRef} data-testid="chat-log">
        {view.chat.map((entry, i) => (
          <div key={i} className={`chat-entry from-${entry.from}`}>
            <span className="chat-who">
              {entry.from === 'user' ? 'Tú' : entry.from === 'pet' ? 'Ánima' : '·'}
            </span>
            <span className="chat-text">{entry.text}</span>
            <span className="chat-tick muted">t{entry.tick}</span>
          </div>
        ))}
      </div>
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
          placeholder="Háblale a tu mascota… (ej.: «comer alimento da energía»)"
        />
        <button type="submit" data-testid="chat-send">
          Enviar
        </button>
      </form>
    </div>
  );
}
