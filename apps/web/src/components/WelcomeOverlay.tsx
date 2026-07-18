/**
 * La bienvenida del primer día: qué es Ánima y cómo se juega, en el tiempo de
 * leer cuatro renglones. Aparece una sola vez (persistido en localStorage) y
 * se puede reabrir desde el «?» de la barra superior — la puerta de entrada no
 * puede ser un panel llamado "Estado" lleno de barras y jerga.
 */
export function WelcomeOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="welcome-overlay" data-testid="welcome-overlay">
      <div className="welcome-card">
        <h2>Ánima</h2>
        <p>
          Una criatura que aprende de verdad. No sigue un guion: experimenta, se
          equivoca, inventa cosas y guarda lo que descubre. Cuando algo le sale
          bien lo convierte en una habilidad; cuando algo le sale mal, lo
          recuerda para no repetirlo.
        </p>
        <ul className="welcome-list">
          <li>
            💬 <strong>Hablale.</strong> Pedile cosas («traé un tronco»), enseñale
            hechos («comer alimento da energía») o preguntale qué está haciendo.
          </li>
          <li>
            🔨 <strong>Pedile que construya.</strong> Hay madera, piedra, fibra
            y arcilla por el mapa: una fogata, un pico, una muralla…
          </li>
          <li>
            🐾 <strong>Puede negarse.</strong> Tiene sus propios motivos —cuida
            lo que cree necesitar— y te los explica.
          </li>
          <li>
            🧪 <strong>Mirá cómo aprende.</strong> En «Skills» y «Experimentos»
            está su proceso real, con las versiones que fallaron incluidas.
          </li>
        </ul>
        <p className="muted">
          Funciona sin cuentas ni claves. Si conectás Codex (arriba), entiende
          lenguaje libre y piensa con tu cuenta de ChatGPT.
        </p>
        <div className="death-actions">
          <button data-testid="welcome-start" onClick={onStart}>
            Empezar
          </button>
        </div>
      </div>
    </div>
  );
}
