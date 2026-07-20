import type { GameSession } from '../session/GameSession.js';
import type { GameView } from '../session/view.js';
import { MindPanel } from './MindPanel.js';
import { SkillsPanel } from './SkillsPanel.js';
import { ExperimentsPanel } from './ExperimentsPanel.js';

/**
 * Lo que antes era una sola pestaña «Aprendizaje» con todo apilado: cómo
 * aprende, qué sabe hacer, qué piensa ahora y el registro entero de ensayos.
 * Eran cuatro cosas de naturaleza distinta una debajo de otra, y encontrar
 * cualquiera de ellas costaba scrollear las otras tres.
 *
 * Ahora son tres pestañas, separadas por la pregunta que contesta cada una:
 *
 * - **Habilidades**: ¿qué sabe hacer? (y qué está aprendiendo justo ahora)
 * - **Pensamiento**: ¿qué le está pasando por la mente en este momento?
 * - **Ensayos**: ¿cómo llegó hasta acá? — el registro paso a paso.
 *
 * Los tres paneles de adentro no cambiaron: lo que cambió es dónde vive cada
 * uno.
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

/**
 * Habilidades: el repertorio, y arriba la que está naciendo ahora. Cómo
 * aprende va plegado — se lee una vez y después estorba, pero sacarlo dejaría
 * sin explicación a quien abre la pestaña por primera vez.
 */
export function SkillsTab({ view, session }: { view: GameView; session: GameSession }) {
  return (
    <div className="learning-panel" data-testid="skills-tab">
      <details className="learn-how-details">
        <summary>Cómo inventa una habilidad</summary>
        <div className="learn-how">
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
      </details>

      {view.skillDev !== null && <LiveLearning dev={view.skillDev} />}

      <p className="section-sub muted">
        Una tarjeta por habilidad. Tocá una para ver por qué la creó, cómo le fue y qué intentos
        fallaron en el camino.
      </p>
      <SkillsPanel view={view} session={session} />
    </div>
  );
}

/** Pensamiento: cada consulta al modelo real, en vivo. */
export function ThoughtsTab({ view }: { view: GameView }) {
  return (
    <div className="learning-panel" data-testid="thoughts-tab">
      <p className="section-sub muted">
        Lo que pasa por su mente cuando consulta al modelo, en vivo. Con el proveedor simulado esto
        queda vacío a propósito: responde al instante y no hay nada que contar.
      </p>
      <MindPanel view={view} />
    </div>
  );
}

/** Ensayos: el registro del ciclo de aprendizaje, paso a paso. */
export function TrialsTab({ view }: { view: GameView }) {
  return (
    <div className="learning-panel" data-testid="trials-tab">
      <p className="section-sub muted">
        Una habilidad por panel y un renglón por intento, con su veredicto. Abrí un intento para ver
        los pasos que lo llevaron hasta ahí.
      </p>
      {view.experiments.length > 0 ? (
        <ExperimentsPanel view={view} />
      ) : (
        <p className="muted">Todavía no ensayó ninguna habilidad.</p>
      )}
    </div>
  );
}
