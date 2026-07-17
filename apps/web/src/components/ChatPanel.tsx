import { useEffect, useRef, useState } from 'react';
import { emojiFor } from '../phaser/appearance.js';
import type { GameSession } from '../session/GameSession.js';
import type { GameView, RecipeCardView, ThoughtView } from '../session/view.js';

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

/**
 * Vista previa de una receta descrita por el cuidador: qué es, qué cuesta y
 * qué HACE, antes de confirmar. El dibujo sale de los rasgos (emojiFor), la
 * misma regla con la que el mundo dibuja lo que Ánima inventa: una tarjeta
 * inválida nunca llega acá — el agente solo previsualiza lo que la puerta
 * del mundo aceptó.
 */
/** Los titulares de razonamiento llegan con la negrita de markdown puesta. */
function cleanHeadline(text: string): string {
  return text.replace(/\*\*/g, '').trim();
}

/**
 * El "pensando" del chat, comprimido como el de un chat de IA: una sola línea
 * viva con el último titular de razonamiento — no un muro que crece — y, si
 * hubo más de un paso, un desplegable para ver cómo lo pensó. Cuando el
 * proveedor responde al instante (mock) no hay titulares: queda solo el latido.
 */
function ChatThinking({ thought, name }: { thought: ThoughtView | null; name: string }) {
  const steps = thought?.reasoning ?? [];
  const headline = steps.at(-1);
  return (
    <div
      className="chat-entry chat-row from-pet group-start thinking-entry"
      data-testid="chat-thinking"
      role="status"
      aria-live="polite"
    >
      <span className="chat-name">{name}</span>
      <div className="chat-bubble thinking-block">
        <span className="thinking-text">
          {thought?.label ?? 'pensando'}
          <span className="thinking-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </span>
        {headline !== undefined && (
          // La key reinicia la animación de entrada con cada titular nuevo, así
          // la línea se siente viva sin acumular texto.
          <span className="thinking-headline" key={steps.length}>
            {cleanHeadline(headline)}
          </span>
        )}
        {steps.length > 1 && (
          <details className="thinking-steps">
            <summary>cómo lo pensó · {steps.length} pasos</summary>
            <ul className="thinking-steps-list">
              {steps.map((step, i) => (
                <li key={i}>{cleanHeadline(step)}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function RecipeCard({ card }: { card: RecipeCardView }) {
  return (
    <span className="recipe-card" data-testid="recipe-preview">
      <span className="recipe-card-title">
        <span aria-hidden="true">{emojiFor(card.kind, card.traits) ?? '❔'}</span>{' '}
        <strong>{card.name}</strong>
      </span>
      <span className="recipe-card-line">Ingredientes: {card.ingredients.join(' + ')}</span>
      {card.does.length > 0 && (
        <span className="recipe-card-line">Hace: {card.does.join(' · ')}</span>
      )}
    </span>
  );
}

export function ChatPanel({ view, session }: { view: GameView; session: GameSession }) {
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const userHasSpoken = view.chat.some((entry) => entry.from === 'user');

  // El autoscroll sigue el crecimiento del razonamiento en vivo, no solo los
  // mensajes cerrados: mientras piensa, la línea viva empuja el log hacia abajo.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [view.chat.length, view.aiBusy, view.currentThought?.reasoning.length]);

  return (
    <div className="chat-panel">
      <div className="chat-log" ref={logRef} data-testid="chat-log" aria-busy={view.aiBusy}>
        {view.chat.map((entry, i) => {
          // Los mensajes de sistema (mundo creado, sesión restaurada) son notas
          // al margen: van centrados y en voz baja, para que no compitan con el
          // diálogo real de Tú y Ánima.
          if (entry.from === 'system') {
            return (
              <div key={i} className="chat-entry from-system chat-note">
                <span className="chat-text">
                  {entry.card ? <RecipeCard card={entry.card} /> : entry.text}
                </span>
                <span className="chat-tick muted">t{entry.tick}</span>
              </div>
            );
          }
          // Cada hablante a su lado (tú a la derecha, Ánima a la izquierda) en
          // burbujas. El nombre aparece solo cuando cambia quién habla, así una
          // ráfaga de mensajes de Ánima se lee como un turno, no como una lista.
          const prev = view.chat[i - 1];
          const startsGroup = !prev || prev.from !== entry.from;
          return (
            <div
              key={i}
              className={`chat-entry chat-row from-${entry.from}${startsGroup ? ' group-start' : ''}`}
            >
              {startsGroup && (
                <span className="chat-name">
                  {entry.from === 'user' ? 'Tú' : view.identity.name}
                </span>
              )}
              <div className={`chat-bubble${entry.card ? ' bare' : ''}`}>
                {entry.card ? <RecipeCard card={entry.card} /> : entry.text}
              </div>
              <span className="chat-tick muted">t{entry.tick}</span>
            </div>
          );
        })}
        {view.aiBusy && <ChatThinking thought={view.currentThought} name={view.identity.name} />}
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
