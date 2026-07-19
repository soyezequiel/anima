import type { GameView } from '../session/view.js';
import { MindPanel } from './MindPanel.js';
import { SkillsPanel } from './SkillsPanel.js';
import { ExperimentsPanel } from './ExperimentsPanel.js';

/**
 * «Aprendizaje», contado como una historia y no como un volcado técnico:
 * primero cómo aprende (cuatro pasos), después qué está aprendiendo ahora
 * mismo (si hay un ciclo en vivo), después qué sabe hacer (una tarjeta por
 * habilidad, no una fila por versión muerta) y el pensamiento en vivo. El
 * registro crudo de experimentos sigue completo, pero plegado al final para
 * quien quiera el detalle.
 */

const STEPS = [
  'Siente una necesidad',
  'Escribí un plan',
  'Lo ensaya en mundos de práctica',
  'Si aprueba, lo usa de verdad',
];

const PHASE_LABEL: Record<string, string> = {
  designing: 'está escribiendo el plan',
  testing: 'la está ensayando en mundos de práctica',
  revising: 'está corrigiendo el plan después de un fallo',
  passed: 'aprobó las pruebas y la está incorporando',
};

function LiveLearning({ dev }: { dev: NonNullable<GameView['skillDev']> }) {
  const attempt =
    dev.version !== null
      ? ` (intento ${dev.version}${dev.maxVersions !== null ? ` de ${dev.maxVersions}` : ''})`
      : '';
  return (
    <p className="learn-live" data-testid="learning-live">
      <span className="learn-live-dot" aria-hidden="true" />
      <span>
        Ahora mismo está aprendiendo <strong>«{dev.skillName.replace(/-/g, ' ')}»</strong>:{' '}
        {PHASE_LABEL[dev.phase] ?? dev.phase}
        {attempt}
        {dev.lastRate !== null &&
          ` · último ensayo: ${Math.round(dev.lastRate * 100)}% de aciertos`}
      </span>
    </p>
  );
}

export function LearningPanel({ view }: { view: GameView }) {
  return (
    <div className="learning-panel" data-testid="learning-panel">
      <div className="learn-how">
        <p className="intro">Ánima inventa sus propias habilidades. Siempre en cuatro pasos:</p>
        <div className="learn-steps" aria-label="cómo aprende Ánima">
          {STEPS.map((step, i) => (
            <span key={step} className="learn-step">
              <span className="learn-step-n">{i + 1}</span> {step}
              {i < STEPS.length - 1 && (
                <span className="learn-step-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {view.skillDev !== null && <LiveLearning dev={view.skillDev} />}

      <section>
        <h3>Lo que sabe hacer</h3>
        <p className="section-sub muted">
          Una tarjeta por habilidad. Tocá una para ver por qué la creó, cómo le fue y qué intentos
          fallaron en el camino.
        </p>
        <SkillsPanel view={view} />
      </section>

      <section>
        <h3>Pensando ahora</h3>
        <p className="section-sub muted">Lo que pasa por su mente cuando consulta al modelo, en vivo.</p>
        <MindPanel view={view} />
      </section>

      {view.experiments.length > 0 && (
        <section>
          <details className="experiment-log">
            <summary>Registro completo de experimentos ({view.experiments.length})</summary>
            <p className="section-sub muted">
              Cada paso del aprendizaje en orden, tal como ocurrió. Para quien quiera el detalle
              técnico.
            </p>
            <ExperimentsPanel view={view} />
          </details>
        </section>
      )}
    </div>
  );
}
