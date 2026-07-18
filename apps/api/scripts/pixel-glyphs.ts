/**
 * Experimento suelto y desechable: ¿puede la IA Dios dibujar pixel art de
 * 16x16 lo bastante bueno como para reemplazar el fallback de texto?
 *
 * No toca `appearance.ts` ni nada de producción. Pide glifos para cuatro
 * ítems que YA tienen emoji (sabemos cómo deberían verse, así que podemos
 * juzgar contra un objetivo conocido) más un derivado inventado, los valida
 * y los saca por dos vías: la terminal (para juzgar de una) y un HTML.
 *
 * El modelo elige FORMA, nunca COLOR: emite índices de paleta y los colores
 * los resuelve este script desde el material base, como haría el linaje.
 *
 * Correr:  pnpm --filter @anima/api exec tsx scripts/pixel-glyphs.ts
 * Borrar:  cuando el experimento haya respondido su pregunta.
 */
import { writeFile } from 'node:fs/promises';
import { createClaudeBridge } from '../src/claude.js';

const GRID = 16;

interface Subject {
  kind: string;
  /** Qué es, en criollo, para el prompt. */
  what: string;
  /** Material base del que saldría la paleta por linaje. */
  material: string;
  /** [1] base, [2] sombra, [3] luz. El índice 0 es transparente. */
  palette: [string, string, string];
}

const SUBJECTS: Subject[] = [
  {
    kind: 'log',
    what: 'un tronco cortado, tirado en el suelo',
    material: 'madera',
    palette: ['#b45309', '#7c2d12', '#f59e0b'],
  },
  {
    kind: 'flint',
    what: 'una piedra de pedernal, angulosa',
    material: 'piedra',
    palette: ['#94a3b8', '#475569', '#cbd5e1'],
  },
  {
    kind: 'campfire',
    what: 'una fogata encendida',
    material: 'fuego',
    palette: ['#f97316', '#b91c1c', '#fde047'],
  },
  {
    kind: 'chair',
    what: 'una silla de madera vista de costado',
    material: 'madera',
    palette: ['#b45309', '#7c2d12', '#f59e0b'],
  },
  {
    kind: 'stone dust',
    what: 'un montoncito de polvo de piedra, lo que queda al moler roca',
    material: 'piedra',
    palette: ['#94a3b8', '#475569', '#cbd5e1'],
  },
];

const SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      minItems: GRID,
      maxItems: GRID,
      items: { type: 'string' },
      description: `Exactamente ${GRID} strings de ${GRID} caracteres cada uno.`,
    },
    note: { type: 'string', description: 'Una frase sobre qué decidiste dibujar.' },
  },
  required: ['rows', 'note'],
};

function buildPrompt(subject: Subject): string {
  return [
    'Sos el dibujante de un juego de mundo por celdas, estilo pixel art.',
    '',
    `Dibujá: ${subject.what}.`,
    `Material base: ${subject.material}.`,
    '',
    `Formato: una grilla de ${GRID}x${GRID} píxeles, como ${GRID} filas de ${GRID} caracteres.`,
    'Cada carácter es un índice de paleta:',
    '  0 = vacío (transparente, el fondo del mundo se ve a través)',
    `  1 = color base del material (${subject.material})`,
    '  2 = sombra del material (zonas oscuras, bordes inferiores)',
    '  3 = luz del material (brillos, bordes superiores)',
    '',
    'NO elegís colores: solo forma y volumen. Los colores los pone el motor.',
    '',
    'Reglas:',
    `- Exactamente ${GRID} filas, exactamente ${GRID} caracteres por fila. Solo 0,1,2,3.`,
    '- Dejá al menos 1 píxel de margen transparente en los cuatro bordes.',
    '- La silueta tiene que leerse de un vistazo a tamaño chico: forma clara,',
    '  masa compacta, nada de detalles finos de 1 píxel suelto.',
    '- Usá 2 y 3 para dar volumen, no para texturear al azar. Luz arriba,',
    '  sombra abajo.',
    '- Nada de ruido aleatorio: cada píxel encendido tiene que pertenecer a la',
    '  forma del objeto.',
  ].join('\n');
}

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

interface Glyph {
  rows: string[];
  note: string;
}

/** Mismo espíritu que los validadores de sim-core: la IA propone, esto acota. */
function validate(raw: string): { ok: true; glyph: Glyph } | { ok: false; why: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, why: `no es JSON: ${raw.slice(0, 120)}` };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, why: 'no es un objeto' };
  const { rows, note } = parsed as { rows?: unknown; note?: unknown };
  if (!Array.isArray(rows)) return { ok: false, why: 'falta rows' };
  if (rows.length !== GRID) return { ok: false, why: `${rows.length} filas, esperaba ${GRID}` };
  for (const [i, row] of rows.entries()) {
    if (typeof row !== 'string') return { ok: false, why: `fila ${i} no es string` };
    if (row.length !== GRID) return { ok: false, why: `fila ${i} mide ${row.length}, esperaba ${GRID}` };
    if (!/^[0-3]+$/.test(row)) return { ok: false, why: `fila ${i} tiene caracteres fuera de 0-3` };
  }
  return {
    ok: true,
    glyph: { rows: rows as string[], note: typeof note === 'string' ? note : '' },
  };
}

/** Para juzgar en la terminal sin abrir nada. */
function toAscii(glyph: Glyph): string {
  const ink: Record<string, string> = { '0': '  ', '1': '██', '2': '▓▓', '3': '░░' };
  return glyph.rows.map((row) => [...row].map((c) => ink[c] ?? '??').join('')).join('\n');
}

function toSvg(glyph: Glyph, subject: Subject, size: number): string {
  const rects: string[] = [];
  for (const [y, row] of glyph.rows.entries()) {
    for (const [x, char] of [...row].entries()) {
      if (char === '0') continue;
      const fill = subject.palette[Number(char) - 1];
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`);
    }
  }
  return `<svg viewBox="0 0 ${GRID} ${GRID}" width="${size}" height="${size}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects.join('')}</svg>`;
}

interface Result {
  subject: Subject;
  glyph: Glyph | null;
  why: string;
}

function toHtml(results: Result[]): string {
  const cards = results
    .map(({ subject, glyph, why }) => {
      const body = glyph
        ? `<div class="scales">
             <div><span>16px</span>${toSvg(glyph, subject, 16)}</div>
             <div><span>48px</span>${toSvg(glyph, subject, 48)}</div>
             <div><span>160px</span>${toSvg(glyph, subject, 160)}</div>
           </div>
           <p class="note">${glyph.note}</p>`
        : `<p class="fail">rechazado: ${why}</p>`;
      return `<article><h2>${subject.kind}<small>${subject.material}</small></h2>${body}</article>`;
    })
    .join('\n');
  return `<!doctype html><meta charset="utf-8"><title>glifos 16x16</title>
<style>
  body { background:#14532d; color:#fef3c7; font:14px system-ui; padding:24px; }
  article { background:#166534; border:1px solid #15803d; border-radius:8px;
            padding:16px; margin-bottom:16px; }
  h2 { margin:0 0 12px; font-size:15px; }
  h2 small { opacity:.6; font-weight:400; margin-left:8px; }
  .scales { display:flex; gap:32px; align-items:flex-end; }
  .scales div { display:flex; flex-direction:column; gap:6px; align-items:center; }
  .scales span { font-size:11px; opacity:.6; }
  .note { opacity:.7; font-style:italic; margin:12px 0 0; }
  .fail { color:#fca5a5; }
</style>
${cards}`;
}

async function main(): Promise<void> {
  const bridge = createClaudeBridge({ reasoningEffort: 'medium' });
  const status = await bridge.status();
  console.log(`claude CLI: ${status.detail}`);
  if (!status.installed || !status.loggedIn) {
    console.error('Sin sesión de Claude, no puedo pedir glifos.');
    process.exitCode = 1;
    return;
  }

  const results = await Promise.all(
    SUBJECTS.map(async (subject): Promise<Result> => {
      try {
        const raw = await bridge.complete({ prompt: buildPrompt(subject), schema: SCHEMA });
        const checked = validate(raw);
        return checked.ok
          ? { subject, glyph: checked.glyph, why: '' }
          : { subject, glyph: null, why: checked.why };
      } catch (error) {
        return { subject, glyph: null, why: String(error) };
      }
    }),
  );

  for (const { subject, glyph, why } of results) {
    console.log(`\n=== ${subject.kind} (${subject.material}) ===`);
    if (glyph) {
      console.log(toAscii(glyph));
      console.log(`  ${glyph.note}`);
    } else {
      console.log(`  RECHAZADO: ${why}`);
    }
  }

  const out = process.argv[2] ?? 'glifos.html';
  await writeFile(out, toHtml(results), 'utf8');
  const ok = results.filter((r) => r.glyph).length;
  console.log(`\n${ok}/${results.length} glifos válidos -> ${out}`);
}

void main();
