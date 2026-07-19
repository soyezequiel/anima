import { useState } from 'react';
import type { GameSession } from '../session/GameSession.js';
import type { GameView, SkillView } from '../session/view.js';

/** «alcanzar-alimento-bloqueado» → «alcanzar alimento bloqueado» */
function humanName(name: string): string {
  return name.replace(/-/g, ' ');
}

/** Estados del motor, dichos en castellano llano. */
const STATUS_LABEL: Record<string, string> = {
  stable: 'en uso',
  experimental: 'en pruebas',
  deprecated: 'en desuso',
  archived: 'descartada',
};

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function SkillCard({
  skill,
  previous,
  current,
}: {
  skill: SkillView;
  previous: SkillView | undefined;
  current: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rate = skill.lastEvaluationSuccessRate;
  return (
    <li className="skill-card" data-testid="skill-item" data-status={skill.status}>
      <button className="skill-head" onClick={() => setOpen(!open)}>
        <span className={`pill pill-${skill.status}`}>
          {STATUS_LABEL[skill.status] ?? skill.status}
        </span>
        <strong>
          {current ? 'versión actual' : 'intento'} <span className="muted">v{skill.version}</span>
        </strong>
        <span className="muted">
          {rate !== null ? `pasó el ${pct(rate)} de las pruebas` : 'sin evaluar'}
          {skill.totalRuns > 0 &&
            ` · usada ${skill.totalRuns} ${skill.totalRuns === 1 ? 'vez' : 'veces'}`}
        </span>
      </button>
      {open && (
        <div className="skill-detail">
          <p>
            <strong>Para qué la creó:</strong> {skill.motivation}
          </p>
          <p>
            <strong>Qué debería lograr:</strong> {skill.expectedOutcome}
          </p>
          <p>
            <strong>Cómo se mide que funcionó:</strong> {skill.successCriteria.join(' · ')}
          </p>
          {previous && (
            <p data-testid="skill-comparison">
              <strong>Comparada con el intento anterior (v{previous.version}):</strong>{' '}
              {previous.lastEvaluationSuccessRate !== null && rate !== null
                ? `éxito ${pct(previous.lastEvaluationSuccessRate)} → ${pct(rate)}`
                : 'sin datos comparables'}
            </p>
          )}
          {skill.knownFailures.length > 0 && (
            <>
              <strong>Tropiezos conocidos:</strong>
              <ul className="list">
                {skill.knownFailures.map((f, i) => (
                  <li key={i} className="muted">
                    {humanReason(f)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <details className="program-details">
            <summary>
              Ver el plan paso a paso ({skill.programSummary.length}{' '}
              {skill.programSummary.length === 1 ? 'paso' : 'pasos'})
            </summary>
            <pre className="program">{skill.programSummary.join('\n')}</pre>
          </details>
        </div>
      )}
    </li>
  );
}

/**
 * Una habilidad = una tarjeta, con todos sus intentos adentro. La versión que
 * importa (la estable, o la última si ninguna aprobó) va al frente; el resto
 * queda plegado como «intentos anteriores» para que ocho versiones muertas no
 * tapen la historia.
 */
function SkillGroup({ versions, onForget }: { versions: SkillView[]; onForget: () => void }) {
  const sorted = [...versions].sort((a, b) => a.version - b.version);
  const stable = [...sorted].reverse().find((s) => s.status === 'stable');
  const current = stable ?? sorted[sorted.length - 1]!;
  const older = sorted.filter((s) => s.id !== current.id);
  const previousOf = (skill: SkillView) =>
    sorted[sorted.findIndex((s) => s.id === skill.id) - 1];

  const chip = stable
    ? { cls: 'stable', text: '✓ la sabe usar' }
    : current.status === 'experimental'
      ? { cls: 'experimental', text: 'aprendiéndola' }
      : { cls: 'archived', text: 'todavía no le sale' };

  const summary = stable
    ? `La aprendió al intento ${current.version}${
        current.totalRuns > 0
          ? ` y ya la usó ${current.totalRuns} ${current.totalRuns === 1 ? 'vez' : 'veces'}`
          : ''
      }.`
    : current.status === 'experimental'
      ? `La está aprendiendo: va por el intento ${current.version}.`
      : `Lo intentó ${sorted.length} ${sorted.length === 1 ? 'vez' : 'veces'}; ninguna versión aprobó las pruebas todavía.`;

  return (
    <li className="skill-group" data-testid="skill-group">
      <header className="skill-group-head">
        <strong className="skill-group-title">{humanName(current.name)}</strong>
        <span className={`pill pill-${chip.cls}`}>{chip.text}</span>
        {/* Olvidar se pide sobre la habilidad entera y no sobre una versión
            (ADR 0075): los intentos anteriores SON esta habilidad, y dejar
            los seis que fallaron borrando el que aprobó no es olvidar nada. */}
        <button
          className="prune-button"
          data-testid="prune-button"
          title={`Que se olvide de ${humanName(current.name)}`}
          aria-label={`Que se olvide de ${humanName(current.name)}`}
          onClick={onForget}
        >
          olvidar
        </button>
      </header>
      <p className="skill-group-sub muted">{summary}</p>
      <ul className="list">
        <SkillCard skill={current} previous={previousOf(current)} current />
      </ul>
      {older.length > 0 && (
        <details className="skill-attempts">
          <summary>
            Intentos anteriores ({older.length})
          </summary>
          <ul className="list">
            {[...older].reverse().map((skill) => (
              <SkillCard key={skill.id} skill={skill} previous={previousOf(skill)} current={false} />
            ))}
          </ul>
        </details>
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
        <span
          className="pill pill-failed"
          title={`falló en ${group.seeds.length} mundos de práctica`}
        >
          ×{group.seeds.length}
        </span>
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
            {group.version !== null && `Le pasó con el intento v${group.version} · `}en{' '}
            {group.seeds.length} mundos de práctica (semillas {group.seeds.slice(0, 6).join(', ')}
            {group.seeds.length > 6 && ` y ${group.seeds.length - 6} más`})
          </p>
        </div>
      )}
    </li>
  );
}

export function SkillsPanel({ view, session }: { view: GameView; session: GameSession }) {
  const byName = new Map<string, SkillView[]>();
  for (const skill of view.skills) {
    const list = byName.get(skill.name) ?? [];
    list.push(skill);
    byName.set(skill.name, list);
  }
  const regressionGroups = groupRegressions(view.regressions);
  return (
    <div className="skills-panel">
      {view.skills.length === 0 && (
        <p className="muted">
          Todavía no inventó ninguna habilidad. Cuando algo le falte —comida que no alcanza, frío
          que no cede— va a intentar crear una, y acá vas a ver cómo le va.
        </p>
      )}
      <ul className="list skill-groups">
        {[...byName.values()].map((versions) => (
          <SkillGroup
            key={versions[0]!.name}
            versions={versions}
            onForget={() => session.askSkillPrune(versions[0]!.name)}
          />
        ))}
      </ul>
      {regressionGroups.length > 0 && (
        <details className="regressions">
          <summary>
            Errores viejos que vigila ({regressionGroups.length}{' '}
            {regressionGroups.length === 1 ? 'situación' : 'situaciones'})
          </summary>
          <p className="muted regression-hint">
            Situaciones donde alguna vez falló. Antes de aprobar una versión nueva de cualquier
            habilidad, la vuelve a rendir en estos casos para no repetir un error ya cometido.
          </p>
          <ul className="list" data-testid="regression-list">
            {regressionGroups.map((group, i) => (
              <RegressionRow key={i} group={group} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
