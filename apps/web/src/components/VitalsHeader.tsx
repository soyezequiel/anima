import { useCallback, useEffect, useRef, useState } from 'react';
import { GoalCard, goalTitle } from './GoalsPanel.js';
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

/**
 * Lo último que hizo, en castellano.
 *
 * Acá se mostraba el `type` del intento tal cual sale del motor, así que la
 * barra decía «speak», «pickup», «useItem» — nombres internos, en inglés, en la
 * única línea que el cuidador mira para saber qué está pasando. Un rótulo que
 * hay que traducir mentalmente cuesta más que uno que no está.
 *
 * Lo que no esté en la tabla no se muestra: un tipo nuevo sin traducir es
 * ruido, y su ausencia se nota menos que su jerga.
 */
const ACTION_LABEL: Record<string, string> = {
  move: 'camina',
  pickup: 'levanta algo',
  drop: 'suelta algo',
  place: 'coloca algo',
  craft: 'fabrica',
  consume: 'come',
  useItem: 'usa una herramienta',
  interact: 'toca algo',
  speak: 'habla',
  wait: 'espera',
  proposeRecipe: 'imagina una receta',
  proposeBlueprint: 'imagina una obra',
  proposeInteraction: 'imagina qué hacer con algo',
  proposeDecomposition: 'imagina en qué se deshace',
  proposeGlyph: 'le dibuja una cara',
  proposeWorkGlyphs: 'dibuja su obra',
};

const FOLDED_KEY = 'anima.nowFolded';

/**
 * Si el cuidador dejó la barra plegada, y que siga plegada al recargar.
 *
 * No usa la expansión compartida (`useExpansion`) a propósito: esa es para
 * abrir y cerrar cosas mientras se mira algo, y se olvida al recargar — que es
 * lo correcto para el árbol de un material. Plegar la barra no es explorar, es
 * decidir cuánta pantalla ocupa: dura hasta que se cambie de opinión. Con la
 * otra, cada recarga de Vite la desplegaba de nuevo.
 */
function useFolded(): [boolean, () => void] {
  const [folded, setFolded] = useState(() => {
    try {
      return localStorage.getItem(FOLDED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setFolded((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(FOLDED_KEY, next ? '1' : '0');
      } catch {
        // Sin almacenamiento (modo privado) se pliega igual: solo no se recuerda.
      }
      return next;
    });
  }, []);
  return [folded, toggle];
}

/**
 * La estrategia en voz humana (misma idea que StatusPanel.humanStrategy).
 *
 * Devuelve null cuando no la sabe decir. Antes escupía el identificador crudo
 * —«petición-del-usuario» con guiones y todo, debajo de una tarjeta que ya
 * decía «se lo pediste»— y eso es lo peor de los dos mundos: jerga del motor
 * ocupando un renglón para repetir lo de arriba. Las que sí están mapeadas son
 * las que dicen CÓMO está encarando el objetivo, que es información nueva; el
 * resto no gana nada por estar escrito. El valor crudo sigue en el `title`
 * para cuando haga falta depurar.
 */
function humanStrategy(raw: string | null): string | null {
  if (!raw) return null;
  if (raw === 'direct-approach') return 'ir directo al alimento';
  if (raw === 'warmth-approach') return 'acercarse a algo que dé calor';
  if (raw.startsWith('build-fire:')) return `construir ${kindLabel(raw.slice('build-fire:'.length))}`;
  const stable = /^stable-skill:(.+)@v(\d+)$/.exec(raw);
  if (stable) return `usa su habilidad «${stable[1]}» (v${stable[2]})`;
  return null;
}

type CarryChip = {
  key: string;
  kind: string;
  n: number;
  /** El más gastado del montón; el resto aguanta más que este por definición. */
  worst?: { current: number; max: number };
};

/**
 * «2× tronco, pedernal»: agrupado y con nombres humanos.
 *
 * Lo que se gasta también se agrupa, pero mostrando el PEOR de su montón. Antes
 * cada unidad iba en su propio chip para no esconder al que está por romperse,
 * y el precio era leer «tabla de ramas» cinco veces seguidas con cinco barras
 * llenas al lado: el nombre repetido tapaba la única unidad que importaba. El
 * peor la responde igual —si ese aguanta, aguantan todos— en una línea.
 *
 * Y la barra aparece solo cuando hay desgaste de verdad: «8/8» no le dice nada
 * a nadie, es el número que sale cuando no pasó nada todavía.
 */
function carryChips(
  inventory: { id: string; kind: string; durability?: { current: number; max: number } }[],
): CarryChip[] {
  const byKind = new Map<string, CarryChip>();
  for (const it of inventory) {
    const chip = byKind.get(it.kind) ?? { key: it.kind, kind: it.kind, n: 0 };
    chip.n += 1;
    if (it.durability && (!chip.worst || wear(it.durability) < wear(chip.worst))) {
      chip.worst = it.durability;
    }
    byKind.set(it.kind, chip);
  }
  return [...byKind.values()];
}

/** Cuánto le queda, en partes de uno: compara martillos de vidas distintas. */
function wear(d: { current: number; max: number }): number {
  return d.current / Math.max(1, d.max);
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
  const action = view.lastAction ? (ACTION_LABEL[view.lastAction] ?? null) : null;
  const chips = pet ? carryChips(pet.inventory) : [];
  const byKind = new Map(view.items.map((item) => [item.kind, item]));
  const [folded, toggleFold] = useFolded();

  /* Plegada NO desaparece: queda un renglón con los tres números del cuerpo y
     qué está haciendo. Esta barra existe para que el contexto vital esté
     siempre a la vista sin importar la pestaña, así que plegarla hasta la nada
     sería quitarle su única razón de ser — y el que la plegó quiere su
     pantalla de vuelta, no quedarse a ciegas. Da el espacio y conserva la
     respuesta a «¿está viva y en qué anda?». */
  if (folded) {
    return (
      <div className="vitals-header vitals-folded">
        <button
          type="button"
          className="fold-toggle"
          data-testid="now-fold"
          aria-expanded={false}
          onClick={toggleFold}
          title="Desplegar la barra"
        >
          ▸
        </button>
        {pet && (
          <span className="folded-vitals">
            <span className="vital-energy">⚡{Math.round(pet.energy.current)}</span>
            <span className="vital-health">❤{Math.round(pet.health.current)}</span>
            {pet.temperature && (
              <span className="vital-warmth">❄{Math.round(pet.temperature.current)}</span>
            )}
          </span>
        )}
        <span className="folded-goal">
          {view.currentGoal ? goalTitle(view.currentGoal.description) : '(observando)'}
        </span>
      </div>
    );
  }

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
        <div className="now-eyebrow">
          <button
            type="button"
            className="fold-toggle"
            data-testid="now-fold"
            aria-expanded
            onClick={toggleFold}
            title="Plegar la barra"
          >
            ▾
          </button>
          Ahora
        </div>
        {/* La MISMA tarjeta que la pestaña de Objetivos (ADR 0069). Antes acá
            vivía un resumen propio —la descripción y nada más— y el cuidador
            veía dos versiones distintas del mismo objetivo según dónde mirara:
            una con su materia, su avance y sus pasos, otra con una frase. */}
        {view.currentGoal ? (
          <ul className="list now-goal-card">
            <GoalCard
              goal={view.currentGoal}
              current
              framed
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
        {/* Sin guiones de relleno: un «—» donde no hay estrategia es un hueco
            que el ojo igual tiene que leer para descubrir que está vacío. */}
        {(strategy || action) && (
          <div className="now-detail muted">
            {strategy && (
              <span data-testid="current-strategy" title={view.currentStrategy ?? undefined}>
                {strategy}
              </span>
            )}
            {strategy && action ? ' · ' : ''}
            {action && <span data-testid="current-action">{action}</span>}
          </div>
        )}
        {pet && chips.length > 0 && (
          <div className="now-carry">
            {/* Con el tope al lado (ADR 0070): «no lo junté» y «no me entra»
                se veían igual, y son dos problemas distintos —uno lo arregla
                el mundo, el otro lo arreglás vos desde Ajustes—. */}
            <span
              className="now-carry-label muted"
              data-testid="carry-count"
              title={`lleva ${pet.inventory.length} de ${pet.inventoryCapacity} que le entran`}
            >
              lleva {pet.inventory.length}/{pet.inventoryCapacity}:
            </span>
            {chips.map((c) => {
              // Gastado de verdad: entero no se dibuja, solo ocupa lugar.
              const worn = c.worst && c.worst.current < c.worst.max ? c.worst : null;
              return (
                <span
                  key={c.key}
                  className={`pill${worn ? ' pill-wear' : ''}`}
                  data-testid={worn ? `carry-durability-${c.kind}` : undefined}
                  title={
                    worn
                      ? `al más gastado le quedan ${worn.current} usos de ${worn.max}`
                      : undefined
                  }
                >
                  {c.n > 1 ? `${c.n}× ` : ''}
                  {kindLabel(c.kind)}
                  {worn && (
                    <>
                      {' '}
                      <b className="wear-count">
                        {worn.current}/{worn.max}
                      </b>
                      <span className="wear-track" aria-hidden="true">
                        <span
                          className="wear-fill"
                          data-low={wear(worn) <= 0.25 ? '' : undefined}
                          style={{ width: `${pct(worn.current, worn.max)}%` }}
                        />
                      </span>
                    </>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
