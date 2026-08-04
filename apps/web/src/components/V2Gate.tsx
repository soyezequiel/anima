import { useEffect, useRef, useState } from 'react';

/**
 * La puerta a Ánima II (ADR 0088) y el aviso que la antecede.
 *
 * El botón late para que se lo mire (ver `.v2-link` en styles.css): la
 * invitación no está escrita en ningún lado. Pero lo que hay del otro lado es
 * una obra en curso, y mandar a alguien ahí sin avisarle convierte «lo miré y
 * estaba roto» en el recuerdo que se lleva de Ánima II. Así que entre el clic
 * y la puerta hay un cartel de obra.
 *
 * El aviso aparece TODAS las veces, no una sola como la bienvenida. Guardarlo
 * en localStorage se descartó: la bienvenida cuenta algo que no cambia —qué es
 * el juego—, y esto describe un estado que cambia semana a semana. Un aviso de
 * obra que se muestra una vez y no vuelve es un aviso que caducó sin que nadie
 * se entere. Cuesta un clic, y el clic cae sobre el botón que ya tenía el foco.
 */

// Dónde vive la II. En el deploy las dos comparten dominio y la II cuelga de
// `/v2/`; en desarrollo son dos servidores de Vite y el juego escucha en 5170.
// Sin esa rama el botón sería un 404 —o peor, Ánima I contestándose a sí
// misma— mientras se trabaja.
const DESTINO = import.meta.env.DEV ? 'http://localhost:5170/' : '/v2/';

export function V2Gate() {
  const [avisando, setAvisando] = useState(false);
  return (
    <>
      <a
        className="v2-link"
        data-testid="anima-ii-link"
        href={DESTINO}
        target="_blank"
        rel="noopener"
        title="Ir a Ánima II, el rehacer del proyecto (está en obra)"
        onClick={(e) => {
          // Sigue siendo un enlace de verdad: ctrl/cmd/shift + clic —y el clic
          // del medio, que ni siquiera dispara este evento— abren el destino
          // como el navegador manda, sin cartel. Quien hace eso ya sabe adónde
          // va; interceptarlo sería romperle una costumbre para contarle algo
          // que no preguntó.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          setAvisando(true);
        }}
      >
        <span className="v2-gem" aria-hidden="true">
          ◆
        </span>{' '}
        Ánima II
      </a>
      {avisando && <V2Notice onClose={() => setAvisando(false)} />}
    </>
  );
}

function V2Notice({ onClose }: { onClose: () => void }) {
  // El foco arranca en «Entrar igual»: es la acción que se pidió al hacer clic,
  // y además mete el teclado DENTRO del diálogo, que es lo que hace que Escape
  // llegue acá y no a la ventana. Va por ref y no por `autoFocus` porque este
  // es un `<a>`, y React solo honra ese atributo en los controles de formulario.
  const entrar = useRef<HTMLAnchorElement>(null);
  useEffect(() => entrar.current?.focus(), []);

  return (
    <div
      className="welcome-overlay"
      data-testid="v2-notice"
      role="dialog"
      aria-modal="true"
      aria-label="Ánima II está en obra"
      // Salir tiene que ser lo fácil: Escape y clic afuera alcanzan.
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="welcome-card">
        <h2>
          <span aria-hidden="true">🚧</span> Ánima II está en obra
        </h2>
        <p>
          Es el proyecto rehecho desde cero, y va <strong>muy temprano</strong>: hay partes a medio
          hacer, cosas que cambian de un día para el otro y otras que todavía no existen. Se rompe,
          y se rompe seguido.
        </p>
        <p>
          No es la versión nueva de esto que estás jugando: es el taller donde se está armando, con
          las herramientas tiradas en el piso.
        </p>
        <p className="muted">Se abre en otra pestaña — esta partida te espera acá.</p>
        <div className="death-actions">
          <a
            ref={entrar}
            className="v2-enter"
            data-testid="v2-enter"
            href={DESTINO}
            target="_blank"
            rel="noopener"
            onClick={onClose}
          >
            Entrar igual
          </a>
          <button data-testid="v2-stay" onClick={onClose}>
            Me quedo acá
          </button>
        </div>
      </div>
    </div>
  );
}
