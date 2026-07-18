import { useEffect, useState } from 'react';
import type { AiWaitView, SkillDevProgressView } from '../session/view.js';

/**
 * Piezas compartidas de la espera visible: el renglón que cuenta en qué va el
 * ciclo de desarrollo de una habilidad y el cronómetro de la consulta en
 * vuelo. Las usan la burbuja del tablero y el "pensando" del chat, para que
 * los dos digan lo mismo.
 */

/** "1:23" — minutos:segundos, sin horas: ninguna consulta debería llegar ahí. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * El ciclo de desarrollo en un renglón: qué versión va, contra cuántos mundos
 * y cómo le fue. Es la diferencia entre "pensando..." y una historia.
 */
export function skillDevLine(dev: SkillDevProgressView): string {
  const attempt =
    dev.maxVersions !== null ? `intento ${dev.attemptsDone + 1} de ${dev.maxVersions}` : null;
  const rate = (value: number): string => `${Math.round(value * 100)}%`;
  // La habilidad se nombra en TODAS las fases, no solo al diseñarla. El
  // encabezado de arriba dice el momento ("corrigiendo una habilidad que
  // falló") y es genérico a propósito; si el renglón tampoco la nombra, el
  // cuidador ve un ciclo entero de ocho intentos sin saber de qué habilidad le
  // están hablando — sobre todo cuando arranca sola, por frío o por hambre, y
  // él nunca pidió nada.
  // Con guiones es un identificador; sin ellos, algo que se lee. Mismo criterio
  // que el vocabulario del mundo: "conseguir-calor" → «conseguir calor».
  const name = `«${dev.skillName.replace(/-/g, ' ')}»`;
  switch (dev.phase) {
    case 'designing':
      return attempt ? `diseñando ${name} · ${attempt}` : `diseñando ${name}`;
    case 'testing': {
      const where = dev.casesTotal !== null ? ` en ${dev.casesTotal} mundos imaginados` : '';
      return `probando ${name} v${dev.version ?? '?'}${where}`;
    }
    case 'revising': {
      const result = dev.lastRate !== null ? `logró ${rate(dev.lastRate)}` : 'no alcanzó';
      return attempt
        ? `${name} v${dev.version ?? '?'} ${result} · corrigiendo (${attempt})`
        : `${name} v${dev.version ?? '?'} ${result} · corrigiendo`;
    }
    case 'passed':
      return dev.lastRate !== null
        ? `¡${name} v${dev.version ?? '?'} pasó con ${rate(dev.lastRate)}!`
        : `¡${name} v${dev.version ?? '?'} pasó!`;
  }
}

/**
 * Para qué quiere la habilidad, en una frase corta. Un ciclo de ocho intentos
 * que ella abrió sola —porque tiene frío, porque no llega a la comida— aparece
 * en pantalla sin que el cuidador haya pedido nada: sin el motivo, lo único que
 * ve es un nombre que no reconoce. Devuelve null cuando no hay nada que aclarar.
 */
export function skillDevPurpose(dev: SkillDevProgressView): string | null {
  if (!dev.purpose) return null;
  // El contrato trae "propósito: detalle"; para el globo alcanza el propósito.
  const short = dev.purpose.split(':')[0]?.trim() ?? dev.purpose;
  return short.length > 0 ? `para ${short}` : null;
}

/** La espera corta no necesita pistas: recién pasado esto se invita a mirar. */
const HINT_AFTER_MS = 8_000;
/** Cada cuánto rota la pista, para que una espera larga no repita la misma. */
const HINT_EVERY_MS = 12_000;

/**
 * Qué puede hacer el cuidador mientras ella piensa. Son invitaciones, no
 * instrucciones: cosas que ya existen en la UI y que la espera vuelve
 * relevantes. La primera es la más importante — el chat encolado ya funciona,
 * pero nadie lo sabe hasta que se lo dicen.
 */
const WAIT_HINTS = [
  'podés seguir escribiéndole: leerá tu mensaje cuando vuelva',
  'mientras tanto, la pestaña Objetos muestra el árbol de crafteo de cada cosa',
  'en Aprendizaje están sus habilidades, versión por versión, con sus pruebas',
  'en Estado se ve su memoria: hechos, hipótesis y episodios',
  'los sueños en miniatura del tablero son sus evaluaciones reales',
];

/**
 * Pista rotativa para la espera larga. Aparece a los segundos y va rotando:
 * convierte el tiempo muerto en una visita guiada por lo que ya está ahí.
 */
export function WaitHints({ wait }: { wait: AiWaitView }) {
  const [, setBeat] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setBeat((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Date.now() - wait.startedAtMs;
  if (elapsed < HINT_AFTER_MS) return null;
  const index = Math.floor((elapsed - HINT_AFTER_MS) / HINT_EVERY_MS) % WAIT_HINTS.length;
  return (
    <span className="thinking-hint" data-testid="wait-hint" key={index}>
      {WAIT_HINTS[index]}
    </span>
  );
}

/**
 * Cronómetro vivo de la espera. Se actualiza solo (cada segundo) porque
 * durante la detención del tiempo (ADR 0040) los ticks del mundo no corren y
 * nadie más re-renderizaría: el reloj de la sala sigue aunque el del mundo no.
 */
export function ThinkingClock({ wait }: { wait: AiWaitView }) {
  const [, setBeat] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setBeat((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Date.now() - wait.startedAtMs;
  return (
    <span className="thinking-clock" data-testid="thinking-clock">
      {formatDuration(elapsed)}
      {wait.expectedMs !== null && (
        <span className="thinking-clock-expected"> · suele tardar ~{formatDuration(wait.expectedMs)}</span>
      )}
    </span>
  );
}
