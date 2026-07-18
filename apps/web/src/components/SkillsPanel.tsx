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

/**
 * Los motivos vienen en código (`aborted:target-missing:foodTarget`). El
 * cuidador no lee códigos: los traducimos a una frase corta.
 */
function humanReason(raw: string): string {
  const [head, ...rest] = raw.split(':');
  const detail = rest.join(' · ');
  switch (head) {
    case 'aborted':
      return rest[0] === 'target-missing'
        ? `se cortó: no encontró ${rest.slice(1).join(' ') || 'el objetivo'}`
        : `se cortó: ${detail}`;
    case 'criteria-failed':
      return rest.length > 1
        ? `no cumplió: ${rest[0]} = ${rest.slice(1).join(':')}`
        : `no cumplió: ${detail}`;
    case 'objetivo-presente-no-alcanzado':
      return `tenía ${detail} a la vista y no llegó`;
    case 'no-damage-dealt':
      return `golpeó sin hacer daño (${detail})`;
    case 'path-blocked':
      return `el camino se le bloqueó ${detail} vez/veces`;
    case 'craft-missing':
      return `le faltaban ingredientes (${detail})`;
    case 'craft-failed':
      return `no pudo construir: ${detail}`;
    case 'timeout':
      return 'se le acabó el tiempo';
    case 'limit-exceeded':
      return `pasó el límite de pasos${detail ? `: ${detail}` : ''}`;
    default:
      return raw;
  }
}

type RegressionGroup = {
  scenarioName: string;
  version: string | null;
  reasons: string[];
  seeds: number[];
};

/** Junta las regresiones que fallan igual: una fila por historia, no por semilla. */
function groupRegressions(regressions: GameView['regressions']): RegressionGroup[] {
  const groups = new Map<string, RegressionGroup>();
  for (const r of regressions) {
    const match = /^v(\d+) falló: (.*)$/.exec(r.description);
    const version = match?.[1] ?? null;
    const reasons = match?.[2]?.split(', ').filter(Boolean) ?? [r.description];
    const key = `${r.scenarioName}|${r.description}`;
    const group: RegressionGroup = groups.get(key) ?? {
      scenarioName: r.scenarioName,
      version,
      reasons,
      seeds: [],
    };
    group.seeds.push(r.seed);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.seeds.length - a.seeds.length);
}

function RegressionRow({ group }: { group: RegressionGroup }) {
  const [open, setOpen] = useState(false);
  const extra = group.reasons.length - 1;
  return (
    <li className="regression-card" data-testid="regression-item">
      <button className="regression-head" onClick={() => setOpen(!open)}>
        <span className="pill pill-failed">×{group.seeds.length}</span>
        <strong>{group.scenarioName}</strong>
        <span className="muted">
          {humanReason(group.reasons[0] ?? 'sin motivo registrado')}
          {extra > 0 && ` · +${extra} motivo${extra > 1 ? 's' : ''}`}
        </span>
      </button>
      {open && (
        <div className="regression-detail">
          <ul className="list">
            {group.reasons.map((reason, i) => (
              <li key={i} className="muted">
                {humanReason(reason)}
              </li>
            ))}
          </ul>
          <p className="muted">
            {group.version && `falló en v${group.version} · `}semillas{' '}
            {group.seeds.slice(0, 6).join(', ')}
            {group.seeds.length > 6 && ` y ${group.seeds.length - 6} más`}
          </p>
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
          <h3>Regresiones conservadas ({view.regressions.length})</h3>
          <p className="muted regression-hint">
            Casos que alguna vez falló y que ahora vuelve a probar en cada versión.
          </p>
          <ul className="list" data-testid="regression-list">
            {groupRegressions(view.regressions).map((group, i) => (
              <RegressionRow key={i} group={group} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
