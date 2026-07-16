import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CodexModelProvider } from '@anima/model-providers';
import { App } from './App.js';
import { codexHttpTransport, fetchAiStatus, readAiChoice, storeAiChoice } from './auth/ai.js';
import { forgetAccount, initCloud } from './auth/cloud.js';
import { GameSession } from './session/GameSession.js';
import './styles.css';

// Una sesión por carga de página (sobrevive al doble montaje de StrictMode).
// El orden importa: initCloud captura el contexto del launcher (lnOrigin)
// antes de cualquier limpieza de URL, y decide el almacenamiento (nube o
// local) antes de crear la sesión.
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? 5);
const speed = Number(params.get('speed') ?? 1);

const cloud = await initCloud(() => {
  // El launcher revocó la identidad: invalidar la sesión de aplicación.
  forgetAccount();
  window.location.reload();
});

// Proveedor de IA: mock determinista por defecto; Codex si el usuario lo
// eligió y su sesión sigue viva (si no, se degrada a mock sin romper nada).
const busyRef: { notify: (busy: boolean) => void } = { notify: () => undefined };
let provider: CodexModelProvider | undefined;
if (readAiChoice() === 'codex') {
  const aiStatus = await fetchAiStatus();
  if (aiStatus?.loggedIn) {
    provider = new CodexModelProvider(codexHttpTransport(), {
      onBusy: (busy) => busyRef.notify(busy),
    });
  } else {
    storeAiChoice('mock');
  }
}

const session = await GameSession.create({
  seed: Number.isFinite(seed) ? seed : 5,
  speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
  autostart: params.get('autostart') !== '0',
  fresh: params.get('fresh') === '1',
  ...(cloud.store ? { store: cloud.store } : {}),
  ...(provider ? { provider } : {}),
});
busyRef.notify = (busy) => session.setAiBusy(busy);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App session={session} account={cloud.account} />
  </StrictMode>,
);
