import type { GameView } from '../session/view.js';

const KIND_LABEL: Record<string, string> = {
  requested: 'necesidad detectada',
  'contract-preview': 'contrato propuesto',
  'contract-agreed': 'contrato acordado',
  created: 'candidata creada',
  'test-started': 'pruebas iniciadas',
  'test-failed': 'RECHAZADA',
  'test-passed': 'pruebas superadas',
  promoted: 'PROMOVIDA',
  rejected: 'descartada',
};

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

export function ExperimentsPanel({ view }: { view: GameView }) {
  return (
    <div className="experiments-panel">
      {view.experiments.length === 0 && (
        <p className="muted">Sin experimentos todavía: aparecerán cuando necesite una habilidad.</p>
      )}
      <ol className="timeline">
        {view.experiments.map((e, i) => (
          <li key={i} data-testid="experiment-item" data-kind={e.kind}>
            <span className="muted">t{e.tick}</span>{' '}
            <span className={`pill pill-${e.kind}`}>{KIND_LABEL[e.kind] ?? e.kind}</span>{' '}
            {e.version !== null && <strong>v{e.version} </strong>}
            <span>{compactDetail(e.detail)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
