import type { GameView } from '../session/view.js';
import { MindPanel } from './MindPanel.js';
import { SkillsPanel } from './SkillsPanel.js';
import { ExperimentsPanel } from './ExperimentsPanel.js';

/**
 * «Aprendizaje»: reúne Mente + Skills + Experimentos en una sola pestaña, con
 * subtítulos claros. Baja la carga cognitiva —de 7 pestañas a 4— sin esconder
 * nada: los tres paneles existentes se renderizan tal cual, uno bajo otro.
 *
 * Si preferís no depender de los tres componentes, cada <section> puede llevar
 * su propio markup; acá se reutilizan para no duplicar reglas de presentación.
 */
export function LearningPanel({ view }: { view: GameView }) {
  return (
    <div className="learning-panel" data-testid="learning-panel">
      <p className="intro">
        Cómo aprende Ánima: lo que piensa, las habilidades que domina y las pruebas por las que
        pasaron —incluidas las versiones que fallaron.
      </p>

      <section>
        <h3>Pensando ahora</h3>
        <MindPanel view={view} />
      </section>

      <section>
        <h3>Habilidades</h3>
        <SkillsPanel view={view} />
      </section>

      <section>
        <h3>Experimentos</h3>
        <ExperimentsPanel view={view} />
      </section>
    </div>
  );
}
