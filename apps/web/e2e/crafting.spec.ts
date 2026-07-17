import { expect, test } from '@playwright/test';

/**
 * El flujo completo de construir, visto desde el navegador y sin claves de
 * IA: pedir algo sin tener nada en mano, que ella misma junte lo que falta y
 * lo construya de verdad — el mundo decide, y el evento queda registrado.
 */

// La bienvenida del primer uso se prueba en onboarding.spec.ts; aquí estorbaría.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('anima.welcomeSeen', '1'));
});

test('craftear desde el chat: dice qué falta, lo junta sola y construye', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');

  // Esperar a que la historia del hambre termine: la mascota queda libre
  // para atender pedidos sin competir con su propia supervivencia.
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 30_000,
  });

  await page.getByTestId('tab-chat').click();
  const chatLog = page.getByTestId('chat-log');
  await page.getByTestId('chat-input').fill('hacé una silla');
  await page.getByTestId('chat-send').click();

  // Sin materiales en mano, pero juntar es parte de construir: dice qué le
  // falta y que va a buscarlo, en vez de negarse y devolver la pelota.
  await expect(chatLog).toContainText('me faltan 2 troncos', { timeout: 15_000 });
  await expect(chatLog).toContainText('los junto y la construyo', { timeout: 5_000 });

  // Y lo cumple entero, sin más órdenes: la silla existe en el mundo.
  await expect(chatLog).toContainText('Listo, ya está en su lugar.', { timeout: 30_000 });

  // El evento del mundo quedó registrado: no es un "sí" de cortesía.
  await page.getByTestId('tab-dev').click();
  await page.getByTestId('dev-filter').fill('item.crafted');
  await expect(page.getByTestId('dev-log')).toContainText('chair', { timeout: 10_000 });
});

test('traer de a uno junta objetos distintos, no redescubre el que ya lleva', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 30_000,
  });

  await page.getByTestId('tab-chat').click();
  const chatLog = page.getByTestId('chat-log');
  const recogidos = chatLog.getByText('Listo, recogí el tronco.');

  // El segundo pedido debe traer OTRO tronco: sin el filtro `held`, la
  // búsqueda devolvía el que ya tenía en la mano (distancia 0) y "cumplía"
  // sin traer nada.
  for (const expected of [1, 2]) {
    await page.getByTestId('chat-input').fill('traé un tronco');
    await page.getByTestId('chat-send').click();
    await expect(recogidos).toHaveCount(expected, { timeout: 30_000 });
  }

  await page.getByTestId('tab-estado').click();
  await expect(page.getByTestId('inventory')).toContainText('2× tronco');
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
});
