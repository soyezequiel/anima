import { useEffect, useRef, useState } from 'react';
import type { DreamView } from '../session/view.js';
import { emojiFor } from '../phaser/appearance.js';

/**
 * El visor de sueños: mientras la mascota desarrolla una habilidad, sus
 * evaluaciones corren en mundos imaginados (skill-evaluator) y cada caso deja
 * una traza real — escenografía inicial + camino recorrido. Este overlay las
 * reproduce en miniatura, una tras otra, para que la espera larga del modelo
 * sea mirar cómo imagina en vez de mirar tres puntitos.
 *
 * Todo lo que se dibuja pasó de verdad en el evaluador: acá no se inventa ni
 * un paso. Por eso el veredicto (✓/✗) se muestra al final de cada replay.
 */

/** Píxeles por celda del mundo soñado (resolución interna del canvas). */
const DREAM_CELL = 14;
/** Milisegundos por paso del camino: rápido, es un sueño y no una repetición. */
const STEP_MS = 90;
/** Pausa final con el veredicto en pantalla antes del próximo sueño. */
const VERDICT_HOLD_MS = 900;

function drawDream(
  canvas: HTMLCanvasElement,
  dream: DreamView,
  step: number,
  petColor: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cell = DREAM_CELL;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fondo nocturno: los sueños no pasan en el verde del mundo despierto.
  ctx.fillStyle = '#0b1226';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= dream.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, dream.height * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= dream.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(dream.width * cell, y * cell + 0.5);
    ctx.stroke();
  }

  // La escenografía, con la misma regla de aspecto que el mundo real: emoji
  // si el tipo (o sus rasgos) lo explican; si no, un bloque neutro.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const entity of dream.entities) {
    const cx = entity.x * cell + cell / 2;
    const cy = entity.y * cell + cell / 2;
    const emoji = emojiFor(entity.kind, entity);
    if (emoji) {
      ctx.font = `${cell - 3}px serif`;
      ctx.fillText(emoji, cx, cy + 1);
    } else {
      ctx.fillStyle = entity.solid ? 'rgba(148, 163, 184, 0.55)' : 'rgba(148, 163, 184, 0.3)';
      const pad = 2;
      ctx.fillRect(entity.x * cell + pad, entity.y * cell + pad, cell - pad * 2, cell - pad * 2);
    }
  }

  // El camino ya recorrido, como estela.
  const path = dream.path;
  const upTo = Math.min(step, path.length - 1);
  if (path.length > 0) {
    ctx.strokeStyle = `${petColor}66`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= upTo; i++) {
      const p = path[i]!;
      const px = p.x * cell + cell / 2;
      const py = p.y * cell + cell / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // La mascota soñada: interpolada entre paso y paso para que flote.
    const t = Math.min(1, step - upTo);
    const here = path[upTo]!;
    const next = path[Math.min(upTo + 1, path.length - 1)]!;
    const px = (here.x + (next.x - here.x) * t) * cell + cell / 2;
    const py = (here.y + (next.y - here.y) * t) * cell + cell / 2;
    ctx.beginPath();
    ctx.fillStyle = petColor;
    ctx.globalAlpha = 0.92;
    ctx.arc(px, py, cell * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Al terminar el replay, el veredicto del caso: fue de verdad, y se dice.
  if (step >= path.length - 1 && dream.verdict !== 'inconclusive') {
    ctx.font = `${cell * 2.4}px serif`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(
      dream.verdict === 'passed' ? '✓' : '✗',
      (dream.width * cell) / 2,
      (dream.height * cell) / 2,
    );
    ctx.globalAlpha = 1;
  }
}

export function DreamOverlay({
  dreams,
  active,
  petColor,
}: {
  dreams: DreamView[];
  active: boolean;
  petColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0);
  const dream = dreams.length > 0 ? dreams[index % dreams.length]! : null;

  useEffect(() => {
    if (!active || !dream) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dream.width * DREAM_CELL;
    canvas.height = dream.height * DREAM_CELL;

    let frame = 0;
    const startedAt = performance.now();
    const steps = Math.max(1, dream.path.length - 1);
    const render = (now: number): void => {
      const step = (now - startedAt) / STEP_MS;
      drawDream(canvas, dream, step, petColor);
      if (step < steps + VERDICT_HOLD_MS / STEP_MS) {
        frame = requestAnimationFrame(render);
      } else {
        // Sueño terminado: al siguiente (los nuevos entran primero en la lista).
        setIndex((i) => i + 1);
      }
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [active, dream, petColor]);

  if (!active || !dream) return null;
  return (
    <div className="dream-overlay" data-testid="dream-overlay" role="status" aria-live="off">
      <div className="dream-overlay-head">
        <span className="dream-overlay-title">sueña</span>
        <span className="dream-overlay-dots thinking-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
      <canvas ref={canvasRef} className="dream-canvas" />
      <div className="dream-overlay-caption muted">
        v{dream.version} · {dream.scenario} · mundo {dream.seed}
      </div>
    </div>
  );
}
