import { useEffect, useRef } from 'react';
import type { GameView, ThoughtView } from '../session/view.js';

/**
 * La mente en vivo: cada consulta al modelo real, en una línea humana de qué
 * hizo la mente. La maquinaria (el JSON crudo del esquema, los pasos de
 * razonamiento de lo que ya terminó) vive detrás de toggles: está para quien
 * la busque, no encima de quien solo mira. Con el proveedor mock el panel
 * queda vacío a propósito — responde al instante y no hay nada que contar.
 */

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function confidenceSuffix(value: unknown): string {
  return typeof value === 'number' ? ` · confianza ${Math.round(value * 100)}%` : '';
}

const COMMAND_LABELS: Record<string, string> = {
  'not-command': 'No era una orden',
  'wait-here': 'Esperar donde está',
  explanation: 'Lo tomó como una pregunta, no una orden',
};

/** Una orden interpretada, dicha como la entendió (sin volcar el enum crudo). */
function summarizeCommand(parsed: Record<string, unknown>): string | null {
  const summary = str(parsed.summary);
  if (summary) return summary;
  const action = str(parsed.action);
  if (!action) return null;
  const target = str(parsed.targetKind);
  switch (action) {
    case 'fetch-item':
      return target ? `Traer ${target}` : 'Traer algo';
    case 'destroy-entity':
      return target ? `Destruir ${target}` : 'Destruir algo';
    case 'consume-item':
      return target ? `Consumir ${target}` : 'Consumir algo';
    case 'craft-item':
      return str(parsed.recipeId) ? `Construir ${str(parsed.recipeId)}` : 'Construir algo';
    case 'run-skill':
      return str(parsed.skillName) ? `Usar la habilidad ${str(parsed.skillName)}` : 'Usar una habilidad';
    case 'rename-pet':
      return str(parsed.name) ? `Cambiarse el nombre a ${str(parsed.name)}` : 'Cambiarse el nombre';
    case 'move-direction':
      return 'Moverse en una dirección';
    case 'interact-entity': {
      const verb = str(parsed.verb);
      return verb && target ? `${verb} ${target}` : 'Interactuar con algo';
    }
    case 'describe-entity':
      return str(parsed.description) ?? 'Describir un objeto';
    default:
      return COMMAND_LABELS[action] ?? action;
  }
}

/**
 * La línea humana de una respuesta: el campo en voz de persona que cada tipo
 * de consulta ya trae (el porqué, la hipótesis, lo que dijo). null cuando no
 * hay ninguno legible — entonces solo queda el JSON crudo, colapsado.
 */
function summarizeAnswer(kind: string, raw: string): string | null {
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(raw) as unknown;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return raw;
    parsed = value as Record<string, unknown>;
  } catch {
    return raw; // No era JSON: es texto plano, ya es humano.
  }
  switch (kind) {
    case 'dialogue':
      return str(parsed.text);
    case 'interpret.signal':
      return str(parsed.hypothesis) && `${str(parsed.hypothesis)}${confidenceSuffix(parsed.confidence)}`;
    case 'distill.knowledge':
      return str(parsed.statement) && `${str(parsed.statement)}${confidenceSuffix(parsed.confidence)}`;
    case 'skill.propose':
    case 'skill.revise':
    case 'recipe.propose':
    case 'entity.describe':
    case 'interaction.propose':
      return str(parsed.rationale);
    case 'skill.contract':
      return str(parsed.purpose) ?? str(parsed.expectedOutcome);
    case 'judge.destruction':
    case 'interaction.judge': {
      const verdict =
        typeof parsed.willing === 'boolean' ? (parsed.willing ? 'Acepta' : 'Se niega') : null;
      const reason = str(parsed.reason);
      if (!verdict && !reason) return null;
      return [verdict, reason].filter(Boolean).join(': ');
    }
    case 'interpret.command':
      return summarizeCommand(parsed);
    default:
      return null;
  }
}

/**
 * El JSON crudo, para el toggle: sin la maquinaria vacía que el esquema
 * obliga a mandar (campos en blanco del `not-command`, arreglos vacíos) y con
 * los `*Json` de doble codificación ya desanidados, para que no sea un muro
 * de comillas escapadas.
 */
function prettyRaw(raw: string): string {
  try {
    const value = JSON.parse(raw) as unknown;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return JSON.stringify(value, null, 2);
    }
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === '' || (Array.isArray(val) && val.length === 0)) continue;
      if (typeof val === 'string' && /Json$/.test(key)) {
        try {
          cleaned[key.replace(/Json$/, '')] = JSON.parse(val);
          continue;
        } catch {
          // Se queda como string si no parsea.
        }
      }
      cleaned[key] = val;
    }
    return JSON.stringify(cleaned, null, 2);
  } catch {
    return raw;
  }
}

function cleanHeadline(text: string): string {
  return text.replace(/\*\*/g, '').trim();
}

function ReasoningList({ lines }: { lines: string[] }) {
  return (
    <ul className="thought-reasoning">
      {lines.map((line, i) => (
        <li key={i} className="thought-reasoning-line">
          {cleanHeadline(line)}
        </li>
      ))}
    </ul>
  );
}

function ThoughtEntry({ thought }: { thought: ThoughtView }) {
  const live = thought.status === 'thinking';
  const summary = thought.answer !== null ? summarizeAnswer(thought.kind, thought.answer) : null;
  const stepWord = thought.reasoning.length === 1 ? 'paso' : 'pasos';
  return (
    <article className="thought-entry" data-testid="thought-entry" data-status={thought.status}>
      <header className="thought-entry-head">
        <span className="thought-entry-label">{thought.label}</span>
        <span className="thought-entry-meta muted">
          t{thought.tick}
          {live && (
            <span className="thinking-dots" aria-label="pensando">
              <i />
              <i />
              <i />
            </span>
          )}
          {thought.status === 'done' && <span aria-label="terminado">✓</span>}
          {thought.status === 'error' && <span aria-label="falló">✗</span>}
        </span>
      </header>

      {summary !== null && <p className="thought-summary">{summary}</p>}

      {/* Mientras piensa, el razonamiento se ve en vivo; una vez terminado se
          pliega para que la lista se lea de un vistazo. */}
      {thought.reasoning.length > 0 &&
        (live ? (
          <ReasoningList lines={thought.reasoning} />
        ) : (
          <details className="thought-details">
            <summary>
              cómo lo pensó · {thought.reasoning.length} {stepWord}
            </summary>
            <ReasoningList lines={thought.reasoning} />
          </details>
        ))}

      {/* El diálogo ya es su respuesta; para el resto, el JSON crudo espera
          plegado por si alguien quiere la verdad literal. */}
      {thought.kind !== 'dialogue' && thought.answer !== null && (
        <details className="thought-details">
          <summary>respuesta cruda</summary>
          <pre className="thought-answer-json">{prettyRaw(thought.answer)}</pre>
        </details>
      )}

      {thought.status === 'error' && thought.error !== null && (
        <p className="thought-error">{thought.error}</p>
      )}
    </article>
  );
}

export function MindPanel({ view }: { view: GameView }) {
  const logRef = useRef<HTMLDivElement>(null);
  // Cambia con cada evento del pensamiento: es lo que dispara el autoscroll.
  const growth = view.thoughts
    .map((t) => `${t.seq}:${t.reasoning.length}:${t.answer !== null}:${t.status}`)
    .join('|');

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [growth]);

  if (view.aiProvider !== 'codex') {
    return (
      <div className="mind-panel" data-testid="mind-panel">
        <p className="mind-empty muted" data-testid="mind-empty">
          La mente en vivo se ve cuando Ánima piensa con un modelo real. El proveedor de pruebas
          responde al instante: no hay pensamiento que mostrar. Podés conectar Codex desde el menú
          de ajustes.
        </p>
      </div>
    );
  }

  return (
    <div className="mind-panel" data-testid="mind-panel">
      {view.thoughts.length === 0 ? (
        <p className="mind-empty muted" data-testid="mind-empty">
          Todavía no pensó con el modelo. El pensamiento aparece acá cuando algo lo dispara: un
          pedido tuyo, una señal del cuerpo, un invento a medio confirmar.
        </p>
      ) : (
        <div className="mind-log" ref={logRef}>
          {view.thoughts.map((thought) => (
            <ThoughtEntry key={thought.seq} thought={thought} />
          ))}
        </div>
      )}
    </div>
  );
}
