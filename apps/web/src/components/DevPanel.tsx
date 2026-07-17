import { useState } from 'react';
import type { GameSession } from '../session/GameSession.js';
import type { GameView } from '../session/view.js';

/** Descarga el reporte para Claude Code como archivo Markdown. */
function downloadClaudeReport(session: GameSession): void {
  const { fileName, markdown } = session.buildClaudeReport();
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

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
        <button
          data-testid="dev-report"
          title="Descarga un reporte del estado y las brechas contra la visión, para dárselo a Claude Code"
          onClick={() => downloadClaudeReport(session)}
        >
          📥 reporte
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
