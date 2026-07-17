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

/** Para deduplicar memoria: una hipótesis confirmada y su hecho son lo mismo. */
function normalizeStatement(s: string): string {
  return s.trim().replace(/\.$/, '').toLowerCase();
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

  // El objetivo actual vive en la tarjeta «ahora»: repetirlo en la lista de
  // objetivos es leerlo dos veces. La lista queda para lo demás pendiente y,
  // plegada, la historia ya terminada.
  const currentId = view.currentGoal?.id ?? null;
  const isOpen = (s: string) => s === 'active' || s === 'pending';
  const otherActive = view.goals.filter((g) => isOpen(g.status) && g.id !== currentId);
  const finished = view.goals.filter((g) => !isOpen(g.status));

  // Un hecho que repite palabra por palabra una hipótesis ya listada no
  // agrega saber, solo bulto.
  const hypothesisStatements = new Set(view.hypotheses.map((h) => normalizeStatement(h.statement)));
  const facts = view.facts.filter((f) => !hypothesisStatements.has(normalizeStatement(f)));

  return (
    <div className="status-panel">
      {pet && (
        <>
          <Bar
            label="Energía"
            value={pet.energy.current}
            max={pet.energy.max}
            color="#f59e0b"
            testId="energy-value"
          />
          <Bar
            label="Salud"
            value={pet.health.current}
            max={pet.health.max}
            color="#ef4444"
            testId="health-value"
          />
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

      {/* Qué hace AHORA, en una sola tarjeta: objetivo grande, el cómo debajo.
          Es lo que se mira a cada rato; el resto del panel es consulta. */}
      <div className="now-card">
        <div className="now-goal" data-testid="current-goal">
          {view.currentGoal?.description ?? '(observando)'}
        </div>
        {(view.currentStrategy || view.lastAction) && (
          <div className="now-detail muted">
            <span data-testid="current-strategy" title={view.currentStrategy ?? undefined}>
              {view.currentStrategy ? humanStrategy(view.currentStrategy) : '—'}
            </span>
            {' · '}
            <span data-testid="current-action">{view.lastAction ?? '—'}</span>
          </div>
        )}
      </div>

      <div className="status-inventory muted">
        lleva:{' '}
        <span data-testid="inventory">
          {pet && pet.inventory.length > 0 ? humanInventory(pet.inventory) : '(nada)'}
        </span>
      </div>

      <h3>Personalidad</h3>
      {/* Rasgos DERIVADOS de su historia real: nada de azar ni de modelo.
          La evidencia va en el tooltip: el rasgo se lee de un vistazo y el
          porqué está a un hover de distancia. */}
      <ul className="list trait-row" data-testid="personality-list">
        {view.personality.map((trait) => (
          <li key={trait.id}>
            <span className="pill pill-trait" title={trait.evidence}>
              {trait.label}
            </span>
          </li>
        ))}
        {view.personality.length === 0 && (
          <li className="muted">todavía se está formando: su historia dirá quién es</li>
        )}
      </ul>

      <h3>Objetivos</h3>
      <div data-testid="goal-list">
        {otherActive.length > 0 && (
          <ul className="list">
            {otherActive.map((g) => (
              <li key={g.id} title={g.source}>
                <span className={`pill pill-${g.status}`}>{g.status}</span> {g.description}
              </li>
            ))}
          </ul>
        )}
        {finished.length > 0 && (
          <details className="status-details">
            <summary>
              {finished.length} {finished.length === 1 ? 'terminado' : 'terminados'}
            </summary>
            <ul className="list">
              {finished.map((g) => (
                <li key={g.id} title={g.source}>
                  <span className={`pill pill-${g.status}`}>{g.status}</span> {g.description}
                </li>
              ))}
            </ul>
          </details>
        )}
        {view.goals.length === 0 && <div className="muted">todavía sin objetivos</div>}
      </div>

      <h3>Memoria</h3>
      <ul className="list" data-testid="memory-list">
        {view.hypotheses.map((h) => (
          <li key={`hyp-${h.statement}`}>
            <span className={`pill pill-${h.resolved}`} title={`confianza ${h.confidence}`}>
              hipótesis {h.resolved}
            </span>{' '}
            {h.statement}
          </li>
        ))}
        {facts.map((f) => (
          <li key={`fact-${f}`}>
            <span className="fact-mark">sabe</span> {f}
          </li>
        ))}
        {facts.length === 0 && view.hypotheses.length === 0 && (
          <li className="muted">aún no sabe nada del mundo</li>
        )}
      </ul>

      {/* Se toca una vez y nunca más: plegada para que no compita con lo vivo. */}
      <details className="status-details">
        <summary>Apariencia</summary>
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
      </details>

      <div className="status-footer muted">
        mundo <span data-testid="world-seed">{view.seed}</span> · tick{' '}
        <span data-testid="world-tick">{view.tick}</span>
      </div>
    </div>
  );
}
