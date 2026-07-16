import { createBalBrowserLogin } from 'nostr-bal-browser-sdk';

/**
 * Integración con Bunker Auto Login (BAL): un firmante NIP-46 provisto por el
 * launcher, sin exponer ni persistir claves privadas. Ver
 * docs/decisions/0010 y el contrato de integración del SDK.
 *
 * gameId y permisos deben coincidir exactamente con el manifiesto del
 * launcher cuando Ánima se registre; solo pedimos lo que usamos.
 */
const GAME_ID = 'anima';

export const balLogin = createBalBrowserLogin({
  gameId: GAME_ID,
  gameName: 'Ánima',
  permissions: ['get_public_key', 'sign_event:22242'],
  launcherOriginStorageKey: `${GAME_ID}.bal.launcher-origin.v1`,
  shared: {
    createWorker: () =>
      new SharedWorker(new URL('./bal-worker.ts', import.meta.url), {
        type: 'module',
        name: `${GAME_ID}-bal-v1`,
      }),
    activeHintKey: `${GAME_ID}.bal.shared-active.v1`,
  },
});

/**
 * Captura el origen validado del launcher antes de limpiar la URL visible.
 * Borra únicamente `lnOrigin`: el resto de parámetros (seed, speed, fresh,
 * fragmento) siguen perteneciendo a sus propios consumidores.
 */
export function captureBalContext(): { hasContext: boolean } {
  const initial = new URLSearchParams(window.location.search);
  const explicitLaunch =
    initial.get('lnBal') !== 'off' && Boolean(initial.get('lnOrigin')?.trim());
  const hasContext = balLogin.hasLauncherContext();

  if (explicitLaunch && hasContext) {
    const url = new URL(window.location.href);
    url.searchParams.delete('lnOrigin');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  return { hasContext };
}
