import { kindLabel } from '@anima/shared';
import type { GameSession } from '../session/GameSession.js';
import type { GameView, PetView } from '../session/view.js';

const COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'];

/**
 * La estrategia en voz humana. El identificador interno
 * («stable-skill:alcanzar-alimento-bloqueado@v2») queda en el title para
 * quien depure; a quien juega se le habla en su idioma.
 */
function humanStrategy(raw: string): string {
  if (raw === 'direct-approach') return 'ir directo al alimento';
  if (raw === 'warmth-approach') return 'acercarse a algo que dé calor';
  if (raw.startsWith('build-fire:')) {
    return `construir ${kindLabel(raw.slice('build-fire:'.length))}`;
  }
  const stable = /^stable-skill:(.+)@v(\d+)$/.exec(raw);
  if (stable) return `usar su habilidad «${stable[1]}» (v${stable[2]})`;
  return raw;
}

/** «2× tronco, martillo»: agrupado y con nombres, no una lista de ids. */
function humanInventory(inventory: PetView['inventory']): string {
  const counts = new Map<string, number>();
  for (const item of inventory) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  return [...counts]
    .map(([kind, n]) => (n > 1 ? `${n}× ${kindLabel(kind)}` : kindLabel(kind)))
    .join(', ');
}

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
          {/* Solo donde hace frío: en los mundos templados no existe la señal. */}
          {pet.temperature && (
            <Bar
              label="Calor"
              value={pet.temperature.current}
              max={pet.temperature.max}
              color="#38bdf8"
              testId="temperature-value"
            />
          )}
        </>
      )}

      <dl className="kv">
        {/* Fuera de la cabecera: un número girando en la periferia cansa, y
            aquí se mira cuando importa. */}
        <dt>Mundo</dt>
        <dd data-testid="world-seed">{view.seed}</dd>
        <dt>Tick</dt>
        <dd data-testid="world-tick">{view.tick}</dd>
        <dt>Objetivo</dt>
        <dd data-testid="current-goal">{view.currentGoal?.description ?? '(observando)'}</dd>
        <dt>Estrategia</dt>
        <dd data-testid="current-strategy" title={view.currentStrategy ?? undefined}>
          {view.currentStrategy ? humanStrategy(view.currentStrategy) : '—'}
        </dd>
        <dt>Acción</dt>
        <dd data-testid="current-action">{view.lastAction ?? '—'}</dd>
        <dt>Inventario</dt>
        <dd data-testid="inventory">
          {pet && pet.inventory.length > 0 ? humanInventory(pet.inventory) : '(vacío)'}
        </dd>
      </dl>

      <h3>Personalidad</h3>
      {/* Rasgos DERIVADOS de su historia real: nada de azar ni de modelo. */}
      <ul className="list" data-testid="personality-list">
        {view.personality.map((trait) => (
          <li key={trait.id}>
            <span className="pill pill-trait">{trait.label}</span>{' '}
            <span className="muted">{trait.evidence}</span>
          </li>
        ))}
        {view.personality.length === 0 && (
          <li className="muted">todavía se está formando: su historia dirá quién es</li>
        )}
      </ul>

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
