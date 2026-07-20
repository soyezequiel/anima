import type { GameView } from '../session/view.js';
import { groupExperiments, type AttemptGroup, type SkillTrial } from './experiments.js';

const KIND_LABEL: Record<string, string> = {
  requested: 'necesidad detectada',
  'contract-preview': 'contrato propuesto',
  'contract-agreed': 'contrato acordado',
  created: 'candidata creada',
  'test-started': 'pruebas iniciadas',
  'test-failed': 'RECHAZADA',
  'test-passed': 'pruebas superadas',
  promoted: 'PROMOVIDA',
  provisional: 'provisional',
  plateau: 'meseta',
  rejected: 'descartada',
};

/** Cómo le fue a la habilidad entera, en una palabra y un color. */
const OUTCOME_CHIP: Record<SkillTrial['outcome'], { cls: string; text: string }> = {
  promoted: { cls: 'stable', text: 'la aprendió' },
  provisional: { cls: 'experimental', text: 'la usa con reservas' },
  running: { cls: 'experimental', text: 'ensayando' },
  rejected: { cls: 'archived', text: 'no le salió' },
};

/** «alcanzar-alimento-bloqueado» → «alcanzar alimento bloqueado» */
function humanName(name: string): string {
  return name.replace(/-/g, ' ');
}

/**
 * El lapso de un intento. Un ciclo entero puede resolverse dentro de un mismo
 * tick —piensa, prueba y falla sin que el mundo avance—, y ahí «t18–t18» es
 * decir dos veces lo mismo.
 */
function span(first: number, last: number): string {
  return first === last ? `t${first}` : `t${first}–t${last}`;
}

/**
 * El backend enumera cada semilla del banco de pruebas; para leer alcanza con
 * saber cuántas son. La lista completa vive en el registro técnico del motor.
 */
function compactDetail(detail: string): string {
  return detail.replace(
    /semillas \d+(?:,\d+)*/g,
    (m) => `${m.slice('semillas '.length).split(',').length} semillas`,
  );
}

function label(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

/**
 * Un intento: en qué terminó, y —plegados— los pasos que llevaron hasta ahí.
 *
 * `experiment-item` queda acá y no en cada evento porque el intento ES la
 * unidad que se lee: un renglón por candidata, con su veredicto al frente.
 */
function Attempt({ attempt }: { attempt: AttemptGroup }) {
  const verdict = attempt.verdict;
  const stepWord = attempt.steps.length === 1 ? 'paso' : 'pasos';
  return (
    <li
      className="trial-attempt"
      data-testid="experiment-item"
      data-kind={verdict?.kind ?? 'running'}
    >
      <div className="trial-attempt-head">
        {attempt.version !== null && <span className="trial-attempt-v">v{attempt.version}</span>}
        <span className={`pill pill-${verdict?.kind ?? 'test-started'}`}>
          {verdict ? label(verdict.kind) : 'en curso'}
        </span>
        {verdict !== null && verdict.detail !== '' && (
          <span className="muted">{compactDetail(verdict.detail)}</span>
        )}
      </div>
      {attempt.steps.length > 0 && (
        <details className="trial-steps">
          <summary>
            {attempt.steps.length} {stepWord} · {span(attempt.firstTick, attempt.lastTick)}
          </summary>
          <ol className="timeline">
            {attempt.steps.map((step, i) => (
              <li key={i} data-kind={step.kind}>
                <span className="muted">t{step.tick}</span> {label(step.kind)}
                {step.detail !== '' && <span className="muted"> · {compactDetail(step.detail)}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}

function Trial({ trial }: { trial: SkillTrial }) {
  // El preámbulo (la necesidad, antes de que hubiera candidata) no es un
  // intento: es por qué empezó todo, y va como una línea del encabezado.
  const preamble = trial.attempts.find((a) => a.version === null);
  const attempts = trial.attempts.filter((a) => a.version !== null);
  const chip = OUTCOME_CHIP[trial.outcome];
  const need = preamble?.steps[0] ?? preamble?.verdict ?? null;

  return (
    <li className="trial-group" data-testid="trial-group">
      <header className="trial-group-head">
        <strong className="trial-group-title">{humanName(trial.skillName)}</strong>
        <span className={`pill pill-${chip.cls}`}>{chip.text}</span>
        <span className="trial-group-meta muted">
          {attempts.length} {attempts.length === 1 ? 'intento' : 'intentos'} ·{' '}
          {span(trial.firstTick, trial.lastTick)}
        </span>
      </header>
      {need !== null && need.detail !== '' && (
        <p className="trial-need muted">Empezó por: {compactDetail(need.detail)}</p>
      )}
      <ul className="list">
        {attempts.map((attempt, i) => (
          <Attempt key={i} attempt={attempt} />
        ))}
      </ul>
    </li>
  );
}

export function ExperimentsPanel({ view }: { view: GameView }) {
  const trials = groupExperiments(view.experiments);
  return (
    <div className="experiments-panel">
      {trials.length === 0 && (
        <p className="muted">Sin experimentos todavía: aparecerán cuando necesite una habilidad.</p>
      )}
      <ul className="list trial-groups">
        {trials.map((trial) => (
          <Trial key={trial.skillName} trial={trial} />
        ))}
      </ul>
    </div>
  );
}
