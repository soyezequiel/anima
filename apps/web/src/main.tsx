import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { GameSession } from './session/GameSession.js';
import './styles.css';

// Una sesión por carga de página (sobrevive al doble montaje de StrictMode).
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? 5);
const speed = Number(params.get('speed') ?? 1);
const session = await GameSession.create({
  seed: Number.isFinite(seed) ? seed : 5,
  speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
  autostart: params.get('autostart') !== '0',
  fresh: params.get('fresh') === '1',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App session={session} />
  </StrictMode>,
);
