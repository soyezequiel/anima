/**
 * El razonamiento llega crudo: Codex con `show_raw_agent_reasoning` y Claude
 * con sus bloques `thinking` mandan la cadena de pensamiento tal cual, con
 * fragmentos de JSON incrustados y sin jerarquía. Volcarla entera es ilegible.
 *
 * Acá se le devuelve estructura: cada fragmento se parte en un titular corto
 * (lo único que se muestra de entrada), la prosa completa y el código que
 * traía mezclado. La UI decide qué desplegar.
 */

export type ReasoningStep = {
  headline: string;
  body: string;
  code: string[];
};

const HEADLINE_MAX = 90;

function stripBold(text: string): string {
  return text.replace(/\*\*/g, '');
}

/** Líneas que son JSON o una operación de la DSL, no prosa. */
function looksLikeCode(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;
  if (/^[[\]{}(),]+$/.test(t)) return true;
  if (/^"?[\w$]+"?\s*:/.test(t)) return true;
  return /^[[{]/.test(t) && t.includes('"');
}

/** La primera oración, recortada a algo que entre de un vistazo. */
function firstSentence(text: string): string {
  const flat = stripBold(text).replace(/\s+/g, ' ').trim();
  if (flat.length === 0) return '';
  const stop = /[.:;?!]\s/.exec(flat);
  const first = (stop ? flat.slice(0, stop.index) : flat).trim();
  if (first.length <= HEADLINE_MAX) return first;
  const cut = first.lastIndexOf(' ', HEADLINE_MAX);
  return `${first.slice(0, cut > 40 ? cut : HEADLINE_MAX).trim()}…`;
}

export function parseReasoningStep(raw: string): ReasoningStep {
  const text = raw.replace(/\r/g, '').trim();
  const code: string[] = [];

  // 1. Los bloques cercados con ``` salen enteros de la prosa.
  const unfenced = text.replace(/```[a-z]*\n?([\s\S]*?)(?:```|$)/gi, (_m, inner: string) => {
    const snippet = inner.trim();
    if (snippet.length > 0) code.push(snippet);
    return '\n';
  });

  // 2. Las corridas de líneas que parecen JSON también: en el razonamiento
  //    crudo el modelo tipea programas a medio armar en medio de la frase.
  const proseLines: string[] = [];
  let run: string[] = [];
  const flushRun = () => {
    // Una línea suelta puede ser prosa con dos puntos; hace falta una corrida
    // para llamarlo código.
    if (run.length >= 2) code.push(run.join('\n'));
    else proseLines.push(...run);
    run = [];
  };
  for (const line of unfenced.split('\n')) {
    if (looksLikeCode(line)) {
      run.push(line);
    } else {
      flushRun();
      proseLines.push(line);
    }
  }
  flushRun();

  let prose = proseLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // 3. El titular: el **negrita** con que Codex encabeza cada resumen, o la
  //    primera oración si viene sin encabezar.
  let headline: string;
  const bold = /^\s*\*\*(.+?)\*\*\s*/.exec(prose);
  if (bold) {
    headline = bold[1]!.trim();
    prose = prose.slice(bold[0].length).trim();
  } else {
    headline = firstSentence(prose);
  }

  return {
    headline: headline.length > 0 ? headline : 'pensando…',
    body: stripBold(prose),
    code,
  };
}

export function parseReasoning(lines: string[]): ReasoningStep[] {
  return lines.map(parseReasoningStep);
}
