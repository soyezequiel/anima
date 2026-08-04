import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { CodexThought } from '@anima/model-providers';
import { CodexModelProvider } from '@anima/model-providers';
import { App } from './App.js';
import type { AiChoice } from './auth/ai.js';
import {
  claudeHttpTransport,
  codexHttpTransport,
  fetchAiStatus,
  forgetAiChoice,
  openAiTransport,
  readStoredAiChoice,
} from './auth/ai.js';
import { forgetAccount, initCloud } from './auth/cloud.js';
import { GameSession } from './session/GameSession.js';
import { mapById } from '@anima/missions';
import './styles.css';
import './styles-redesign.css';

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

// Proveedor de IA: mock determinista por defecto; Codex o Claude si el
// usuario lo eligió y su sesión sigue viva (si no, se degrada a mock sin
// romper nada).
const busyRef: { notify: (busy: boolean) => void } = { notify: () => undefined };
const thoughtRef: { notify: (thought: CodexThought) => void } = { notify: () => undefined };
let provider: CodexModelProvider | undefined;

// ─── SIN ELECCIÓN, EL SIMULADO ──────────────────────────────────────────────
//
// Nadie empieza gastando. El simulado es determinista y no cuesta, y es con lo
// que arranca todo el que abre la página por primera vez.
//
// Acá vivía una excepción —si el anfitrión prestaba su cuenta, la mente real
// venía encendida— y se fue con la canilla (ADR 0089). Encenderla era el gesto
// correcto mientras la cuenta la ponía el anfitrión a propósito; cuando el que
// paga es siempre él y el que decide es cualquiera, el default tiene que ser
// no gastar.
const elegido = readStoredAiChoice();
const aiChoice: AiChoice = elegido ?? 'mock';

if (aiChoice === 'openai') {
  // La API del que juega: el navegador la llama directo, así que no hay estado
  // que consultarle a nadie — o los tres campos están, o no hay transporte.
  const transport = openAiTransport();
  if (transport) {
    provider = new CodexModelProvider(
      transport,
      {
        onBusy: (busy) => busyRef.notify(busy),
        onThought: (thought) => thoughtRef.notify(thought),
      },
      'openai',
    );
  } else {
    // Quedó elegida pero sin datos (los borró, o cambió de navegador): se
    // olvida en vez de guardar «simulado», igual que con una sesión caída.
    forgetAiChoice();
  }
} else if (aiChoice === 'codex' || aiChoice === 'claude') {
  const aiStatus = await fetchAiStatus(aiChoice);
  if (aiStatus?.loggedIn) {
    provider = new CodexModelProvider(
      aiChoice === 'claude' ? claudeHttpTransport() : codexHttpTransport(),
      {
        onBusy: (busy) => busyRef.notify(busy),
        onThought: (thought) => thoughtRef.notify(thought),
      },
      aiChoice,
    );
  } else {
    // La sesión se cayó sola —o esta instancia dejó de prestar cuentas—: no fue
    // decisión de nadie, así que se OLVIDA la elección en vez de guardar
    // «simulado». Si vuelve a haber sesión, la mente real vuelve sola.
    forgetAiChoice();
  }
}

// El entrenamiento que se juega, si el cuidador eligió uno (?map=vado). Sin
// esto, el mundo de siempre: los mapas son pruebas, no el juego.
//
// Cada entrenamiento tiene su propia ranura de guardado (ver `mapSlot`), así
// que entrar y salir no pisa la partida principal ni los otros entrenamientos:
// se retoma cada uno donde quedó.
const mapId = params.get('map');
const map = mapId ? mapById(mapId) : undefined;

const session = await GameSession.create({
  seed: Number.isFinite(seed) ? seed : 5,
  speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
  autostart: params.get('autostart') !== '0',
  fresh: params.get('fresh') === '1',
  ...(map ? { map } : {}),
  ...(cloud.store ? { store: cloud.store } : {}),
  ...(provider ? { provider } : {}),
});
busyRef.notify = (busy) => session.setAiBusy(busy);
thoughtRef.notify = (thought) => session.noteAiThought(thought);

// Ayuda de desarrollo: la sesión a mano en la consola (window.anima) para
// inspeccionar el view model o simular estados (p. ej. setAiBusy) sin
// conectar un proveedor real. No es API: nada del código la usa.
(globalThis as { anima?: GameSession }).anima = session;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App session={session} account={cloud.account} />
  </StrictMode>,
);
