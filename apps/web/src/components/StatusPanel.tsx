import { kindLabel } from '@anima/shared';
import type { GameSession } from '../session/GameSession.js';
import type { GameView, PetView } from '../session/view.js';

/**
 * StatusPanel del rediseño: SIN las barras de energía/salud/calor —ahora viven
 * en VitalsHeader, siempre visibles. Esta pestaña queda para lo que se consulta:
 * Mochila, Personalidad, Memoria y Apariencia.
 *
 * Los objetivos se fueron a su propia pestaña (ADR 0052): acá entraban como
 * dos líneas sin lo único que hacía falta —qué le falta conseguir— y encima el
 * filtro contaba los suspendidos como terminados.
 */

const COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'];

function humanInventory(inventory: PetView['inventory']): { kind: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const item of inventory) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  return [...counts].map(([kind, n]) => ({ kind, n }));
}

function normalizeStatement(s: string): string {
  return s.trim().replace(/\.$/, '').toLowerCase();
}

export function StatusPanel({ view, session }: { view: GameView; session: GameSession }) {
  const pet = view.pet;

  const hypothesisStatements = new Set(view.hypotheses.map((h) => normalizeStatement(h.statement)));
  const facts = view.facts.filter((f) => !hypothesisStatements.has(normalizeStatement(f)));

  const carry = pet ? humanInventory(pet.inventory) : [];

  return (
    <div className="status-panel">
      <h3>Mochila</h3>
      <div className="trait-row list" data-testid="inventory">
        {carry.length > 0 ? (
          carry.map((c) => (
            <span key={c.kind} className="pill">
              {c.n > 1 ? `${c.n}× ` : ''}
              {kindLabel(c.kind)}
            </span>
          ))
        ) : (
          <span className="muted">(nada todavía)</span>
        )}
      </div>

      <h3>Personalidad</h3>
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
