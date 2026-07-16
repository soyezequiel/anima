import { expect, test } from '@playwright/test';

/**
 * El primer minuto de un usuario nuevo: la bienvenida le cuenta qué es esto,
 * «Empezar» lo deja en el chat con sugerencias clicables, y con un clic ya
 * está hablando con la mascota. La bienvenida no vuelve a aparecer, pero el
 * «?» la reabre cuando haga falta.
 */

test('la bienvenida orienta y las sugerencias hablan por el usuario', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');

  // Primera visita: la bienvenida aparece sola y cuenta lo esencial.
  const welcome = page.getByTestId('welcome-overlay');
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText('aprende de verdad');
  await expect(welcome).toContainText('Puede negarse');

  // «Empezar» deja al usuario donde se juega: el chat, con sugerencias.
  await page.getByTestId('welcome-start').click();
  await expect(welcome).toHaveCount(0);
  const chips = page.getByTestId('chat-chips');
  await expect(chips).toBeVisible();

  // Un clic y ya le habló: la sugerencia entra al chat como mensaje suyo.
  await chips.getByText('traé un tronco').click();
  await expect(page.getByTestId('chat-log')).toContainText('traé un tronco');
  // Las ruedas de entrenamiento se retiran cuando el usuario ya habló.
  await expect(chips).toHaveCount(0);

  // Y la mascota respondió al pedido, no fue un botón decorativo.
  await expect(page.getByTestId('chat-log')).toContainText('Voy a buscar', { timeout: 25_000 });
});

test('la bienvenida no insiste, pero el «?» la reabre', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');
  await page.getByTestId('welcome-start').click();

  // Recargar no la trae de vuelta: ya fue vista.
  await page.goto('/');
  await expect(page.getByTestId('welcome-overlay')).toHaveCount(0);

  // Pero sigue a un clic de distancia para quien quiera releerla.
  await page.getByTestId('help-button').click();
  await expect(page.getByTestId('welcome-overlay')).toBeVisible();
  await page.getByTestId('welcome-start').click();
  await expect(page.getByTestId('welcome-overlay')).toHaveCount(0);
});
