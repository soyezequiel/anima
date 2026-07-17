import type { ThoughtView } from '../session/view.js';

/**
 * En qué parte del pensamiento está la consulta en vuelo: los tres momentos
 * de toda consulta al modelo (preguntar, razonar, responder) con el momento
 * activo latiendo, y al lado el título humano del momento cognitivo — el mismo
 * que encabeza el pensamiento en el panel de la Mente. No inventa ritmo: cada
 * cambio visible es un evento que llegó.
 */

const STAGES = ['pregunta', 'razona', 'responde'] as const;

function activeStage(thought: ThoughtView): number {
  if (thought.answer !== null) return 2;
  if (thought.reasoning.length > 0) return 1;
  return 0;
}

export function ThoughtTicker({ thought }: { thought: ThoughtView }) {
  const active = activeStage(thought);
  return (
    <div className="thought-ticker" data-testid="thought-ticker" role="status" aria-live="polite">
      <span className="thought-ticker-icon" aria-hidden="true">
        💭
      </span>
      <span className="thought-ticker-body">
        {/* El título humano del momento, el mismo que encabeza cada pensamiento
            en el panel de la Mente. La key lo re-anima con cada consulta nueva. */}
        <span className="thought-ticker-label" key={thought.seq}>
          {thought.label}
        </span>
      </span>
      <ol className="thought-stages">
        {STAGES.map((stage, i) => (
          <li
            key={stage}
            className="thought-stage"
            data-state={i === active ? 'active' : i < active ? 'done' : 'pending'}
          >
            {stage}
          </li>
        ))}
      </ol>
    </div>
  );
}
