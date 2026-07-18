import { useEffect, useRef, useState } from 'react';
import { GoalCard } from './GoalsPanel.js';
import type { Expansion } from './expansion.js';
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

type CarryChip = {
  key: string;
  kind: string;
  n: number;
  durability?: { current: number; max: number };
};

/**
 * «2× tronco, pedernal»: agrupado y con nombres humanos. Lo que se gasta NO se
 * agrupa: dos martillos con vidas distintas son dos recursos distintos, y un
 * promedio o un total escondería justo el número que hace falta ver — cuánto
 * le queda al que está por romperse.
 */
function carryChips(
  inventory: { id: string; kind: string; durability?: { current: number; max: number } }[],
): CarryChip[] {
  const chips: CarryChip[] = [];
  const counts = new Map<string, number>();
  for (const it of inventory) {
    if (it.durability) {
      chips.push({ key: it.id, kind: it.kind, n: 1, durability: it.durability });
      continue;
    }
    counts.set(it.kind, (counts.get(it.kind) ?? 0) + 1);
  }
  for (const [kind, n] of counts) chips.push({ key: kind, kind, n });
  return chips;
}

/**
 * El pulso de una barra: nace cuando el valor que se muestra cambia de verdad.
 *
 * El gasto es discreto y lento — `decayPerTick` (0.05) sobre un máximo de 50
 * mueve la barra 0.1% por tick, que es sub-píxel. Lo que sí se ve es el número
 * redondeado bajando de a 1 cada 20 ticks. Así que el pulso se ata a ese
 * cambio observable y no a un temporizador: si no pasa nada, la barra está
 * quieta; cuando pasa, el tramo que se ganó o se perdió se enciende y se apaga.
 */
type Pulse = { from: number; to: number; dir: 'drain' | 'gain'; key: number };

function useVitalPulse(shown: number, max: number): Pulse | null {
  const prev = useRef(shown);
  const seq = useRef(0);
  const [pulse, setPulse] = useState<Pulse | null>(null);

  useEffect(() => {
    const before = prev.current;
    if (before === shown) return;
    prev.current = shown;
    seq.current += 1;
    setPulse({
      from: pct(before, max),
      to: pct(shown, max),
      dir: shown < before ? 'drain' : 'gain',
      key: seq.current,
    });
  }, [shown, max]);

  return pulse;
}

function Vital({
  className,
  label,
  testId,
  current,
  max,
}: {
  className: string;
  label: string;
  testId: string;
  current: number;
  max: number;
}) {
  const shown = Math.round(current);
  const pulse = useVitalPulse(shown, max);
  return (
    <div className={`vital ${className}`}>
      <div className="vital-top">
        <span>{label}</span>
        <b data-testid={testId}>
          {shown}/{max}
        </b>
      </div>
      <div className="vital-track">
        <div className="vital-fill" style={{ width: `${pct(current, max)}%` }} />
        {/* El tramo que cambió: se remonta en cada pulso (key) para que la
            animación vuelva a correr, y se apaga sola. */}
        {pulse && (
          <span
            key={pulse.key}
            className="vital-pulse"
            data-dir={pulse.dir}
            aria-hidden="true"
            style={{
              left: `${Math.min(pulse.from, pulse.to)}%`,
              width: `${Math.max(Math.abs(pulse.to - pulse.from), 0.8)}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}

export function VitalsHeader({
  view,
  onInspect,
  expansion,
}: {
  view: GameView;
  onInspect: (kind: string) => void;
  expansion: Expansion;
}) {
  const pet = view.pet;
  const strategy = humanStrategy(view.currentStrategy);
  const chips = pet ? carryChips(pet.inventory) : [];
  const byKind = new Map(view.items.map((item) => [item.kind, item]));

  return (
    <div className="vitals-header">
      {pet && (
        <div className="vitals-row">
          <Vital
            className="vital-energy"
            label="⚡ Energía"
            testId="energy-value"
            current={pet.energy.current}
            max={pet.energy.max}
          />
          <Vital
            className="vital-health"
            label="❤️ Salud"
            testId="health-value"
            current={pet.health.current}
            max={pet.health.max}
          />
          {/* Solo donde hace frío: en mundos templados no existe la señal. */}
          {pet.temperature && (
            <Vital
              className="vital-warmth"
              label="❄ Calor"
              testId="temperature-value"
              current={pet.temperature.current}
              max={pet.temperature.max}
            />
          )}
        </div>
      )}

      <div className="now-card rd-now">
        <div className="now-eyebrow">Ahora</div>
        {/* La MISMA tarjeta que la pestaña de Objetivos (ADR 0069). Antes acá
            vivía un resumen propio —la descripción y nada más— y el cuidador
            veía dos versiones distintas del mismo objetivo según dónde mirara:
            una con su materia, su avance y sus pasos, otra con una frase. */}
        {view.currentGoal ? (
          <ul className="list now-goal-card">
            <GoalCard
              goal={view.currentGoal}
              current
              byKind={byKind}
              onInspect={onInspect}
              expansion={expansion}
            />
          </ul>
        ) : (
          <div className="now-goal" data-testid="current-goal">
            (observando)
          </div>
        )}
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
              <span
                key={c.key}
                className={`pill${c.durability ? ' pill-wear' : ''}`}
                data-testid={c.durability ? `carry-durability-${c.kind}` : undefined}
                title={
                  c.durability
                    ? `le quedan ${c.durability.current} usos de ${c.durability.max}`
                    : undefined
                }
              >
                {c.n > 1 ? `${c.n}× ` : ''}
                {kindLabel(c.kind)}
                {c.durability && (
                  <>
                    {' '}
                    <b className="wear-count">
                      {c.durability.current}/{c.durability.max}
                    </b>
                    <span className="wear-track" aria-hidden="true">
                      <span
                        className="wear-fill"
                        data-low={c.durability.current / c.durability.max <= 0.25 ? '' : undefined}
                        style={{ width: `${pct(c.durability.current, c.durability.max)}%` }}
                      />
                    </span>
                  </>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
