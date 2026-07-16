import { useState } from 'react';
import type { GameSession } from '../session/GameSession.js';
import type { GameView } from '../session/view.js';

export function DevPanel({ view, session }: { view: GameView; session: GameSession }) {
  const [filter, setFilter] = useState('');
  const [source, setSource] = useState<'all' | 'world' | 'agent'>('all');

  const events = view.devEvents.filter(
    (e) =>
      (source === 'all' || e.source === source) &&
      (filter === '' || e.type.includes(filter) || e.json.includes(filter)),
  );

  return (
    <div className="dev-panel">
      <div className="dev-controls">
        <input
          data-testid="dev-filter"
          placeholder="filtrar por tipo o contenido…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
          <option value="all">todos</option>
          <option value="world">mundo</option>
          <option value="agent">agente</option>
        </select>
        <span className="muted">{events.length} eventos</span>
        <button
          data-testid="dev-kill"
          title="Colapsa energía y salud para observar el flujo de muerte y legado"
          onClick={() => session.devKill()}
        >
          💀
        </button>
      </div>
      <div className="dev-log" data-testid="dev-log">
        {events
          .slice(-150)
          .reverse()
          .map((e) => (
            <div key={e.seq} className={`dev-event source-${e.source}`}>
              <span className="muted">t{e.tick}</span> <strong>{e.type}</strong>{' '}
              <code>{e.json}</code>
            </div>
          ))}
      </div>
    </div>
  );
}
