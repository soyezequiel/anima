import type { GameSession } from '../session/GameSession.js';
import type { GameView } from '../session/view.js';
import { kindLabel } from '@anima/shared';

/**
 * Signos vitales + tarjeta «Ahora» SIEMPRE visibles, encima de las pestañas.
 * Baja la carga cognitiva: un usuario nuevo nunca pierde el contexto (energía,
 * salud y qué está haciendo Ánima) sin importar en qué pestaña esté.
 *
 * Las barras se animan solas cuando cambia el valor (transition en .vital-fill).
 */

function pct(value: number, max: number): number {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** La estrategia en voz humana (misma idea que StatusPanel.humanStrategy). */
function humanStrategy(raw: string | null): string | null {
  if (!raw) return null;
  if (raw === 'direct-approach') return 'ir directo al alimento';
  if (raw === 'warmth-approach') return 'acercarse a algo que dé calor';
  if (raw.startsWith('build-fire:')) return `construir ${kindLabel(raw.slice('build-fire:'.length))}`;
  const stable = /^stable-skill:(.+)@v(\d+)$/.exec(raw);
  if (stable) return `usa su habilidad «${stable[1]}» (v${stable[2]})`;
  return raw;
}

/** «2× tronco, pedernal»: agrupado y con nombres humanos. */
function carryChips(inventory: { kind: string }[]): { kind: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const it of inventory) counts.set(it.kind, (counts.get(it.kind) ?? 0) + 1);
  return [...counts].map(([kind, n]) => ({ kind, n }));
}

export function VitalsHeader({ view }: { view: GameView }) {
  const pet = view.pet;
  const strategy = humanStrategy(view.currentStrategy);
  const chips = pet ? carryChips(pet.inventory) : [];

  return (
    <div className="vitals-header">
      {pet && (
        <div className="vitals-row">
          <div className="vital vital-energy">
            <div className="vital-top">
              <span>⚡ Energía</span>
              <b data-testid="energy-value">
                {Math.round(pet.energy.current)}/{pet.energy.max}
              </b>
            </div>
            <div className="vital-track">
              <div className="vital-fill" style={{ width: `${pct(pet.energy.current, pet.energy.max)}%` }} />
            </div>
          </div>

          <div className="vital vital-health">
            <div className="vital-top">
              <span>❤️ Salud</span>
              <b data-testid="health-value">
                {Math.round(pet.health.current)}/{pet.health.max}
              </b>
            </div>
            <div className="vital-track">
              <div className="vital-fill" style={{ width: `${pct(pet.health.current, pet.health.max)}%` }} />
            </div>
          </div>

          {/* Solo donde hace frío: en mundos templados no existe la señal. */}
          {pet.temperature && (
            <div className="vital vital-warmth">
              <div className="vital-top">
                <span>❄ Calor</span>
                <b data-testid="temperature-value">
                  {Math.round(pet.temperature.current)}/{pet.temperature.max}
                </b>
              </div>
              <div className="vital-track">
                <div
                  className="vital-fill"
                  style={{ width: `${pct(pet.temperature.current, pet.temperature.max)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="now-card rd-now">
        <div className="now-eyebrow">Ahora</div>
        <div className="now-goal" data-testid="current-goal">
          {view.currentGoal?.description ?? '(observando)'}
        </div>
        {(strategy || view.lastAction) && (
          <div className="now-detail muted">
            <span data-testid="current-strategy" title={view.currentStrategy ?? undefined}>
              {strategy ?? '—'}
            </span>
            {' · '}
            <span data-testid="current-action">{view.lastAction ?? '—'}</span>
          </div>
        )}
        {chips.length > 0 && (
          <div className="now-carry">
            <span className="muted" style={{ fontSize: 11 }}>
              lleva:
            </span>
            {chips.map((c) => (
              <span key={c.kind} className="pill">
                {c.n > 1 ? `${c.n}× ` : ''}
                {kindLabel(c.kind)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
