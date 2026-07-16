import type { LegacyReport } from '@anima/persistence';
import type { GameSession } from '../session/GameSession.js';

const CAUSE_LABEL: Record<string, string> = {
  starvation: 'inanición',
};

export function DeathOverlay({ report, session }: { report: LegacyReport; session: GameSession }) {
  return (
    <div className="death-overlay" data-testid="death-overlay">
      <div className="death-card">
        <h2>
          {report.identity.name} ha muerto{' '}
          <span className="muted">(generación {report.identity.generation}, tick {report.diedAtTick})</span>
        </h2>
        <p>
          <strong>Informe de legado.</strong> Causa probable:{' '}
          {CAUSE_LABEL[report.cause.cause] ?? report.cause.cause} (certeza{' '}
          {Math.round(report.cause.certainty * 100)}%).
        </p>

        {report.knowledge.length > 0 && (
          <>
            <h3>Lo que sabía</h3>
            <ul className="list">
              {report.knowledge.map((k) => (
                <li key={k.statement}>{k.statement}</li>
              ))}
            </ul>
          </>
        )}

        {report.skillArtifacts.length > 0 && (
          <>
            <h3>Habilidades que deja</h3>
            <ul className="list">
              {report.skillArtifacts.map((s) => (
                <li key={s.id}>
                  {s.name} v{s.version} <span className="muted">(deberá re-probarse)</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {report.unfinishedGoals.length > 0 && (
          <>
            <h3>Proyectos inconclusos</h3>
            <ul className="list">
              {report.unfinishedGoals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </>
        )}

        <h3>Recomendaciones</h3>
        <ul className="list">
          {report.recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        <blockquote className="legacy-message">“{report.messageToSuccessor}”</blockquote>
        <p className="muted">{report.messageToUser}</p>

        <div className="death-actions">
          <button
            data-testid="create-successor"
            onClick={() => void session.createSuccessor()}
          >
            🐣 Crear sucesora (generación {report.identity.generation + 1})
          </button>
          <button data-testid="restart-fresh" onClick={() => void session.restartFresh()}>
            ⟳ Empezar de cero
          </button>
        </div>
      </div>
    </div>
  );
}
