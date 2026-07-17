import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

/**
 * E2E de la Fase 8: identidad Nostr y sincronización con el backend real
 * (Fastify + SQLite en memoria). Se inyecta un window.nostr falso (NIP-07)
 * cuya clave vive en el proceso de Playwright: la página firma a través de
 * un binding, igual que haría con una extensión — la clave privada nunca
 * entra al contexto de la página.
 */

const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);
const npub = nip19.npubEncode(pubkey);

// La bienvenida del primer uso se prueba en onboarding.spec.ts; aquí estorbaría.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('anima.welcomeSeen', '1'));
  // El chip busca el perfil (kind 0) en relés públicos: la prueba no depende de
  // la red, se cortan y el chip se queda con la npub, que es lo que se afirma.
  await page.routeWebSocket(/^wss:\/\//, (ws) => ws.close());
});

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

test('con perfil publicado, el chip muestra la foto y el nombre en vez de la npub', async ({
  page,
}) => {
  await installFakeNip07(page);

  const avatarUrl = 'https://perfil.invalid/avatar.png';
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.route(avatarUrl, (route) => route.fulfill({ contentType: 'image/png', body: png }));

  // El perfil se siembra en la caché: los relés están cortados, así que esto
  // prueba el chip (lo que se ve) sin depender de la red (probada aparte).
  // Solo en la primera carga: las recargas posteriores deben ver lo que la
  // propia app dejó en la caché, que es justo lo que se afirma al final.
  await page.addInitScript(
    ({ pk, url }) => {
      if (sessionStorage.getItem('e2e-profile-seeded')) return;
      sessionStorage.setItem('e2e-profile-seeded', '1');
      localStorage.setItem(
        'anima:nostr:profile',
        JSON.stringify({
          pubkey: pk,
          fetchedAt: Date.now(),
          profile: { name: 'Cuidadora de Ánima', picture: url },
        }),
      );
    },
    { pk: pubkey, url: avatarUrl },
  );

  await page.goto('/?seed=5&speed=8&fresh=1');
  await page.getByTestId('login-nostr').click();

  const chip = page.getByTestId('account-chip');
  await expect(chip).toContainText('Cuidadora de Ánima', { timeout: 15_000 });
  await expect(chip).not.toContainText('npub1');
  // La foto se ve de verdad: si no cargara, onError la cambiaría por el ícono.
  const avatar = chip.locator('img.account-avatar');
  await expect(avatar).toHaveAttribute('src', avatarUrl);
  await expect
    .poll(() => avatar.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  // Al salir, el perfil cacheado no queda para el siguiente que use el navegador.
  await page.getByTestId('logout-button').click();
  await expect(page.getByTestId('login-nostr')).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => localStorage.getItem('anima:nostr:profile'))).toBeNull();
});

test('login NIP-07, sincronización remota y continuidad sin datos locales', async ({ page }) => {
  await installFakeNip07(page);

  await page.goto('/?seed=5&speed=8&fresh=1');
  await page.getByTestId('login-nostr').click();

  // Conectado: sin perfil publicado en los relés no hay nombre ni foto que
  // mostrar, así que el chip cae en la npub de la identidad verificada.
  await expect(page.getByTestId('account-chip')).toContainText(npub.slice(0, 10), {
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
  await expect(page.getByTestId('account-chip')).toContainText(npub.slice(0, 10), {
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
