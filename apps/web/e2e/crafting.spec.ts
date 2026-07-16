import { expect, test } from '@playwright/test';

/**
 * El flujo completo de construir, visto desde el navegador y sin claves de
 * IA: pedir algo sin materiales (negativa que dice qué falta), juntar los
 * ingredientes de a uno por chat, y construirlo de verdad — el mundo decide,
 * el evento queda registrado.
 */

// La bienvenida del primer uso se prueba en onboarding.spec.ts; aquí estorbaría.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('anima.welcomeSeen', '1'));
});

test('craftear desde el chat: negativa honesta, juntar materiales y construir', async ({
  page,
}) => {
  await page.goto('/?seed=5&speed=8');

  // Esperar a que la historia del hambre termine: la mascota queda libre
  // para atender pedidos sin competir con su propia supervivencia.
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 30_000,
  });

  await page.getByTestId('tab-chat').click();
  const chatLog = page.getByTestId('chat-log');
  const send = async (text: string) => {
    await page.getByTestId('chat-input').fill(text);
    await page.getByTestId('chat-send').click();
  };

  // 1. Sin materiales en mano: la negativa dice exactamente qué falta.
  await send('hacé una silla');
  await expect(chatLog).toContainText('me faltan 2 troncos', { timeout: 15_000 });

  // 2. Juntar los ingredientes de a uno. El segundo pedido debe traer OTRO
  //    tronco, no redescubrir el que ya lleva (bug del filtro held).
  await send('traé un tronco');
  await expect(chatLog.locator('text=Listo, recogí el tronco.')).toHaveCount(1, {
    timeout: 20_000,
  });
  await send('traé un tronco');
  await expect(chatLog.locator('text=Listo, recogí el tronco.')).toHaveCount(2, {
    timeout: 20_000,
  });

  // 3. Con los ingredientes en mano: acepta, y el mundo construye.
  await send('hacé una silla');
  await expect(chatLog).toContainText('Voy a construir una silla.', { timeout: 15_000 });
  await expect(chatLog).toContainText('Listo, ya está en su lugar.', { timeout: 20_000 });

  // 4. El evento del mundo quedó registrado: no es un "sí" de cortesía.
  await page.getByTestId('tab-dev').click();
  await page.getByTestId('dev-filter').fill('item.crafted');
  await expect(page.getByTestId('dev-log')).toContainText('chair', { timeout: 10_000 });
});

test('la fogata pide su ingrediente distintivo: el pedernal', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 30_000,
  });

  await page.getByTestId('tab-chat').click();
  await page.getByTestId('chat-input').fill('crea una fogata');
  await page.getByTestId('chat-send').click();

  // Sin nada en mano faltan los tres ingredientes, incluido el pedernal.
  const chatLog = page.getByTestId('chat-log');
  await expect(chatLog).toContainText('me faltan 2 troncos y 1 pedernal', { timeout: 15_000 });
  // Y los ve en el mapa: ofrece que se los pidan en vez de encogerse.
  await expect(chatLog).toContainText('Veo', { timeout: 5_000 });
});
