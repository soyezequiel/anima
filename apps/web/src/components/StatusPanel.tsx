import type { GameSession } from '../session/GameSession.js';
import type { GameView } from '../session/view.js';

const COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'];

function Bar({
  label,
  value,
  max,
  color,
  testId,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  testId: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="bar-value" data-testid={testId}>
        {Math.round(value * 10) / 10}/{max}
      </span>
    </div>
  );
}

export function StatusPanel({ view, session }: { view: GameView; session: GameSession }) {
  const pet = view.pet;
  return (
    <div className="status-panel">
      {pet && (
        <>
          <Bar label="Energía" value={pet.energy.current} max={pet.energy.max} color="#f59e0b" testId="energy-value" />
          <Bar label="Salud" value={pet.health.current} max={pet.health.max} color="#ef4444" testId="health-value" />
        </>
      )}

      <dl className="kv">
        <dt>Objetivo</dt>
        <dd data-testid="current-goal">{view.currentGoal?.description ?? '(observando)'}</dd>
        <dt>Estrategia</dt>
        <dd data-testid="current-strategy">{view.currentStrategy ?? '—'}</dd>
        <dt>Acción</dt>
        <dd data-testid="current-action">{view.lastAction ?? '—'}</dd>
        <dt>Inventario</dt>
        <dd data-testid="inventory">
          {pet && pet.inventory.length > 0 ? pet.inventory.map((i) => i.kind).join(', ') : '(vacío)'}
        </dd>
      </dl>

      <h3>Objetivos</h3>
      <ul className="list" data-testid="goal-list">
        {view.goals.map((g) => (
          <li key={g.id}>
            <span className={`pill pill-${g.status}`}>{g.status}</span> {g.description}
            <span className="muted"> · {g.source}</span>
          </li>
        ))}
        {view.goals.length === 0 && <li className="muted">todavía sin objetivos</li>}
      </ul>

      <h3>Memoria</h3>
      <ul className="list" data-testid="memory-list">
        {view.hypotheses.map((h) => (
          <li key={`hyp-${h.statement}`}>
            <span className={`pill pill-${h.resolved}`}>hipótesis {h.resolved}</span> {h.statement}{' '}
            <span className="muted">({h.confidence})</span>
          </li>
        ))}
        {view.facts.map((f) => (
          <li key={`fact-${f}`}>
            <span className="pill pill-fact">sabe</span> {f}
          </li>
        ))}
        {view.facts.length === 0 && view.hypotheses.length === 0 && (
          <li className="muted">aún no sabe nada del mundo</li>
        )}
      </ul>

      <h3>Apariencia</h3>
      <div className="color-row">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`color-dot ${view.petColor === c ? 'active' : ''}`}
            style={{ background: c }}
            aria-label={`color ${c}`}
            onClick={() => session.setPetColor(c)}
          />
        ))}
      </div>
    </div>
  );
}
