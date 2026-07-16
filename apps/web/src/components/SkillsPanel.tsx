import { useState } from 'react';
import type { GameView, SkillView } from '../session/view.js';

function SkillCard({ skill, previous }: { skill: SkillView; previous: SkillView | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="skill-card" data-testid="skill-item" data-status={skill.status}>
      <button className="skill-head" onClick={() => setOpen(!open)}>
        <span className={`pill pill-${skill.status}`}>{skill.status}</span>
        <strong>
          {skill.name} <span className="muted">v{skill.version}</span>
        </strong>
        <span className="muted">
          {skill.lastEvaluationSuccessRate !== null
            ? `éxito ${Math.round(skill.lastEvaluationSuccessRate * 100)}%`
            : 'sin evaluar'}
          {' · '}usos {skill.totalRuns}
        </span>
      </button>
      {open && (
        <div className="skill-detail">
          <p>
            <strong>Motivo de creación:</strong> {skill.motivation}
          </p>
          <p>
            <strong>Resultado esperado:</strong> {skill.expectedOutcome}
          </p>
          <p>
            <strong>Criterios:</strong> {skill.successCriteria.join(', ')}
          </p>
          {previous && (
            <p data-testid="skill-comparison">
              <strong>vs v{previous.version}:</strong>{' '}
              {previous.lastEvaluationSuccessRate !== null &&
              skill.lastEvaluationSuccessRate !== null
                ? `éxito ${Math.round(previous.lastEvaluationSuccessRate * 100)}% → ${Math.round(skill.lastEvaluationSuccessRate * 100)}%`
                : 'sin datos comparables'}
            </p>
          )}
          {skill.knownFailures.length > 0 && (
            <>
              <strong>Fallos conocidos:</strong>
              <ul className="list">
                {skill.knownFailures.map((f, i) => (
                  <li key={i} className="muted">
                    {f}
                  </li>
                ))}
              </ul>
            </>
          )}
          <strong>Programa:</strong>
          <pre className="program">{skill.programSummary.join('\n')}</pre>
        </div>
      )}
    </li>
  );
}

export function SkillsPanel({ view }: { view: GameView }) {
  const byName = new Map<string, SkillView[]>();
  for (const skill of view.skills) {
    const list = byName.get(skill.name) ?? [];
    list.push(skill);
    byName.set(skill.name, list);
  }
  return (
    <div className="skills-panel">
      {view.skills.length === 0 && (
        <p className="muted">Todavía no ha creado ninguna habilidad.</p>
      )}
      <ul className="list">
        {[...byName.values()].flatMap((versions) =>
          versions
            .sort((a, b) => a.version - b.version)
            .map((skill, i, sorted) => (
              <SkillCard key={skill.id} skill={skill} previous={i > 0 ? sorted[i - 1] : undefined} />
            )),
        )}
      </ul>
      {view.regressions.length > 0 && (
        <>
          <h3>Regresiones conservadas</h3>
          <ul className="list" data-testid="regression-list">
            {view.regressions.map((r, i) => (
              <li key={i} className="muted">
                {r.scenarioName} (semilla {r.seed}): {r.description}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
