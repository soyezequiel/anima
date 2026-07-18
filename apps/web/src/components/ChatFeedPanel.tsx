import { useEffect, useMemo, useRef, useState } from 'react';
import { emojiFor } from '../phaser/appearance.js';
import type { GameSession } from '../session/GameSession.js';
import type {
  AiWaitView,
  ChatEntry as ChatEntryView,
  ExperimentView,
  GameView,
  RecipeCardView,
  SkillDevProgressView,
  ThoughtView,
} from '../session/view.js';
import { parseReasoning, parseReasoningStep } from './reasoning.js';
import { skillDevLine, ThinkingClock, WaitHints } from './thinking.js';

/**
 * Chat como FEED unificado. Por defecto («Todo») mezcla la charla con los
 * hitos de aprendizaje (habilidad promovida / rechazada) y el pensamiento del
 * modelo, en orden por tick: seguir a Ánima sin saltar de pestaña. El filtro
 * «Solo charla» lo reduce a la conversación pura —sin redundancia con la
 * pestaña Aprendizaje.
 */

const FIRST_STEPS = ['traé un tronco', 'construí una fogata', '¿qué estás haciendo?', 'comer alimento da energía'];

type Filter = 'todo' | 'charla';

type FeedItem =
  | { t: 'chat'; tick: number; entry: ChatEntryView; prev?: ChatEntryView | undefined }
  | { t: 'milestone'; tick: number; exp: ExperimentView }
  | { t: 'thought'; tick: number; thought: ThoughtView };

function cleanHeadline(text: string): string {
  return text.replace(/\*\*/g, '').trim();
}

function RecipeCard({ card }: { card: RecipeCardView }) {
  return (
    <span className="recipe-card" data-testid="recipe-preview">
      <span className="recipe-card-title">
        <span aria-hidden="true">{emojiFor(card.kind, card.traits) ?? '❔'}</span> <strong>{card.name}</strong>
      </span>
      <span className="recipe-card-line">Ingredientes: {card.ingredients.join(' + ')}</span>
      {card.does.length > 0 && <span className="recipe-card-line">Hace: {card.does.join(' · ')}</span>}
    </span>
  );
}

function ChatRow({
  entry,
  prev,
  petName,
}: {
  entry: ChatEntryView;
  prev?: ChatEntryView | undefined;
  petName: string;
}) {
  if (entry.from === 'system') {
    return (
      <div className="chat-entry from-system chat-note">
        <span className="chat-text">{entry.card ? <RecipeCard card={entry.card} /> : entry.text}</span>
        <span className="chat-tick muted">t{entry.tick}</span>
      </div>
    );
  }
  const startsGroup = !prev || prev.from !== entry.from;
  return (
    <div
      className={`chat-entry chat-row from-${entry.from}${startsGroup ? ' group-start' : ''}${
        entry.pending ? ' pending' : ''
      }`}
      data-testid={entry.pending ? 'chat-pending' : undefined}
    >
      {startsGroup && <span className="chat-name">{entry.from === 'user' ? 'Tú' : petName}</span>}
      <div className={`chat-bubble${entry.card ? ' bare' : ''}`}>
        {entry.card ? <RecipeCard card={entry.card} /> : entry.text}
      </div>
      {entry.pending ? (
        <span className="chat-pending-hint" aria-label="mensaje sin leer, en cola">
          sin leer
          <span className="thinking-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </span>
      ) : (
        <span className="chat-tick muted">t{entry.tick}</span>
      )}
    </div>
  );
}

function MilestoneCard({ exp }: { exp: ExperimentView }) {
  const rejected = exp.kind === 'rejected';
  return (
    <div className={`feed-card ${rejected ? 'rejected' : 'milestone'}`} data-testid="feed-milestone">
      <span aria-hidden="true" style={{ fontSize: 18 }}>
        {rejected ? '🧪' : '✨'}
      </span>
      <div>
        <div className="feed-title">
          {rejected ? 'Versión rechazada' : 'Nueva habilidad estable'}
        </div>
        <div className="feed-sub">
          «{exp.skillName}»{exp.version != null ? ` v${exp.version}` : ''} — {exp.detail}
        </div>
        <div className="feed-tick">t{exp.tick}</div>
      </div>
    </div>
  );
}

function ThoughtCard({ thought }: { thought: ThoughtView }) {
  // El feed muestra el remate y cuánto costó llegar; el hilo entero espera
  // plegado. Volcar el razonamiento crudo acá tapaba la conversación.
  const steps = useMemo(() => parseReasoning(thought.reasoning), [thought.reasoning]);
  const last = steps.at(-1);
  const headline = last?.headline ?? cleanHeadline(thought.answer ?? thought.label);
  const stepWord = steps.length === 1 ? 'paso' : 'pasos';
  return (
    <div className="feed-card thought" data-testid="feed-thought">
      <span className="feed-tag">pensó</span>
      <div className="feed-thought-body">
        <div className="feed-sub thought-headline">{headline}</div>
        {steps.length > 1 && (
          <details className="thought-details feed-thought-details">
            <summary>
              cómo llegó · {steps.length} {stepWord}
            </summary>
            <ul className="thought-reasoning">
              {steps.slice(0, -1).map((step, i) => (
                <li key={i} className="reasoning-step">
                  <span className="reasoning-headline">{step.headline}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function ChatThinking({
  thought,
  name,
  skillDev,
  wait,
}: {
  thought: ThoughtView | null;
  name: string;
  skillDev: SkillDevProgressView | null;
  wait: AiWaitView | null;
}) {
  const steps = thought?.reasoning ?? [];
  // En vivo solo cabe el titular del último paso: el crudo desbordaba la burbuja.
  const headline = steps.length > 0 ? parseReasoningStep(steps.at(-1)!).headline : undefined;
  return (
    <div className="chat-entry chat-row from-pet group-start thinking-entry" data-testid="chat-thinking" role="status" aria-live="polite">
      <span className="chat-name">{name}</span>
      <div className="chat-bubble thinking-block">
        <span className="thinking-text">
          {thought?.label ?? 'pensando'}
          <span className="thinking-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {wait && <ThinkingClock wait={wait} />}
        </span>
        {skillDev && (
          <span className="thinking-progress" data-testid="chat-skilldev">
            {skillDevLine(skillDev)}
          </span>
        )}
        {headline !== undefined && (
          <span className="thinking-headline" key={steps.length}>
            {cleanHeadline(headline)}
          </span>
        )}
        {wait && <WaitHints wait={wait} />}
      </div>
    </div>
  );
}

export function ChatFeedPanel({ view, session }: { view: GameView; session: GameSession }) {
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');
  const logRef = useRef<HTMLDivElement>(null);
  const userHasSpoken = view.chat.some((e) => e.from === 'user');

  const settled = view.chat.filter((e) => !e.pending);
  const queued = view.chat.filter((e) => e.pending);

  // Feed ordenado por tick. En «Solo charla» quedan únicamente los mensajes.
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = settled.map((entry, i) => ({
      t: 'chat',
      tick: entry.tick,
      entry,
      prev: settled[i - 1],
    }));
    if (filter === 'todo') {
      for (const exp of view.experiments) {
        if (exp.kind === 'promoted' || exp.kind === 'rejected') {
          items.push({ t: 'milestone', tick: exp.tick, exp });
        }
      }
      for (const th of view.thoughts) {
        if (th.status === 'done' && th.reasoning.length > 0) {
          items.push({ t: 'thought', tick: th.tick, thought: th });
        }
      }
      // Orden estable por tick; los chats conservan su orden relativo original.
      items.sort((a, b) => a.tick - b.tick);
    }
    return items;
  }, [settled, view.experiments, view.thoughts, filter]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [view.chat.length, view.aiBusy, view.currentThought?.reasoning.length, filter]);

  return (
    <div className="chat-panel">
      <div className="feed-filter" role="tablist" aria-label="filtro del feed">
        <button
          className={`filter-chip${filter === 'todo' ? ' active' : ''}`}
          onClick={() => setFilter('todo')}
          data-testid="feed-filter-todo"
        >
          Todo
        </button>
        <button
          className={`filter-chip${filter === 'charla' ? ' active' : ''}`}
          onClick={() => setFilter('charla')}
          data-testid="feed-filter-charla"
        >
          💬 Solo charla
        </button>
      </div>

      <div className="chat-log" ref={logRef} data-testid="chat-log" aria-busy={view.aiBusy}>
        {feed.map((item, i) => {
          if (item.t === 'chat')
            return <ChatRow key={`c${i}`} entry={item.entry} prev={item.prev} petName={view.identity.name} />;
          if (item.t === 'milestone') return <MilestoneCard key={`m${i}`} exp={item.exp} />;
          return <ThoughtCard key={`t${i}`} thought={item.thought} />;
        })}
        {view.aiBusy && (
          <ChatThinking
            thought={view.currentThought}
            name={view.identity.name}
            skillDev={view.skillDev}
            wait={view.aiWait}
          />
        )}
        {queued.map((entry, i) => (
          <ChatRow key={`q${i}`} entry={entry} prev={queued[i - 1]} petName={view.identity.name} />
        ))}
      </div>

      {!userHasSpoken && (
        <div className="chat-chips" data-testid="chat-chips">
          {FIRST_STEPS.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => session.sendUserMessage(s)}>
              {s}
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
          // Mientras piensa, el propio input dice que escribir sigue valiendo:
          // el mensaje queda encolado (chat-pending) y lo lee al volver.
          placeholder={
            view.aiBusy
              ? 'Está pensando: escribí igual, leerá tu mensaje al volver…'
              : 'Pedile algo, enseñale un hecho o preguntale qué hace…'
          }
        />
        <button type="submit" data-testid="chat-send">
          Enviar
        </button>
      </form>
    </div>
  );
}
