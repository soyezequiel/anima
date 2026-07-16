import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';

/**
 * E2E de la Fase 8: identidad Nostr y sincronización con el backend real
 * (Fastify + SQLite en memoria). Se inyecta un window.nostr falso (NIP-07)
 * cuya clave vive en el proceso de Playwright: la página firma a través de
 * un binding, igual que haría con una extensión — la clave privada nunca
 * entra al contexto de la página.
 */

const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);

async function installFakeNip07(page: Page): Promise<void> {
  await page.exposeFunction('__nostrSign', (templateJson: string) => {
    const template = JSON.parse(templateJson) as Parameters<typeof finalizeEvent>[0];
    return JSON.stringify(finalizeEvent(template, secretKey));
  });
  await page.addInitScript((pk: string) => {
    (window as unknown as { nostr: unknown }).nostr = {
      getPublicKey: () => Promise.resolve(pk),
      signEvent: async (template: unknown) => {
        const signed = await (
          window as unknown as { __nostrSign(t: string): Promise<string> }
        ).__nostrSign(JSON.stringify(template));
        return JSON.parse(signed);
      },
    };
  }, pubkey);
}

test('login NIP-07, sincronización remota y continuidad sin datos locales', async ({ page }) => {
  await installFakeNip07(page);

  await page.goto('/?seed=5&speed=8&fresh=1');
  await page.getByTestId('login-nostr').click();

  // Conectado: el chip muestra el prefijo de la pubkey verificada.
  await expect(page.getByTestId('account-chip')).toContainText(pubkey.slice(0, 8), {
    timeout: 15_000,
  });

  // La historia se completa y se autoguarda... en el servidor.
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 30_000,
  });
  await page.waitForTimeout(500);

  // Borramos el guardado local: si la recarga restaura, fue desde la nube.
  // (Navegamos sin `fresh=1`: reload conservaría el parámetro y borraría todo.)
  await page.evaluate(() => localStorage.removeItem('anima:save'));
  await page.goto('/?speed=8');
  await expect(page.getByTestId('account-chip')).toContainText(pubkey.slice(0, 8), {
    timeout: 15_000,
  });
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 15_000,
  });
  await page.getByTestId('tab-skills').click();
  await expect(page.getByTestId('skill-item')).toHaveCount(2);
  await page.getByTestId('tab-chat').click();
  await expect(page.getByTestId('chat-log')).toContainText('Sesión restaurada');

  // Logout: vuelve al modo invitado y el token deja de existir.
  await page.getByTestId('logout-button').click();
  await expect(page.getByTestId('login-nostr')).toBeVisible({ timeout: 15_000 });
});

test('el modo invitado sigue funcionando sin servidor de identidad', async ({ page }) => {
  // Sin window.nostr y sin token: la app funciona 100% local.
  await page.goto('/?seed=7&speed=8&fresh=1');
  await expect(page.getByTestId('login-nostr')).toBeVisible();
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 30_000,
  });
});
