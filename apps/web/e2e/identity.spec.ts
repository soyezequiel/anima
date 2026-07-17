import { expect, test } from '@playwright/test';

/**
 * E2E de la capa emocional: renombrar a la mascota desde el encabezado y por
 * chat, con el nombre sobreviviendo a la recarga (vive en PetIdentity).
 */

// La bienvenida del primer uso se prueba en onboarding.spec.ts; aquí estorbaría.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('anima.welcomeSeen', '1'));
});

test('renombrar desde el encabezado: se aplica, habla y sobrevive a recargar', async ({ page }) => {
  await page.goto('/?seed=5&speed=8&fresh=1');
  await expect(page.getByTestId('pet-name')).toHaveText('Ánima');

  await page.getByTestId('rename-button').click();
  await page.getByTestId('rename-input').fill('Luna');
  await page.getByTestId('rename-confirm').click();

  await expect(page.getByTestId('pet-name')).toHaveText('Luna');
  // Lo estrena en su voz: el bautismo no es solo un campo editado.
  await page.getByTestId('tab-chat').click();
  await expect(page.getByTestId('chat-log')).toContainText('Luna', { timeout: 15_000 });

  // Recarga sin parámetros: carga el guardado y el nombre sigue.
  await page.goto('/');
  await expect(page.getByTestId('pet-name')).toHaveText('Luna', { timeout: 10_000 });
});

test('bautismo por chat y personalidad visible en Estado', async ({ page }) => {
  await page.goto('/?seed=5&speed=8&fresh=1');

  await page.getByTestId('tab-chat').click();
  await page.getByTestId('chat-input').fill('te voy a llamar Nube');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('pet-name')).toHaveText('Nube', { timeout: 15_000 });

  // El panel Estado muestra la personalidad: al principio, en formación; con
  // la historia completada, rasgos derivados con su evidencia.
  await page.getByTestId('tab-estado').click();
  await expect(page.getByTestId('personality-list')).toBeVisible();
  await expect(page.locator('.app')).toHaveAttribute('data-story', 'completed', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('personality-list')).toContainText('perseverante', {
    timeout: 15_000,
  });
});
