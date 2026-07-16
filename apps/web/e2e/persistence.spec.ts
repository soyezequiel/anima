import { expect, test } from '@playwright/test';

/**
 * E2E de la Fase 7: continuidad tras recargar la página y flujo de
 * muerte -> informe de legado -> sucesora, todo a través de la interfaz.
 */

// La bienvenida del primer uso se prueba en onboarding.spec.ts; aquí estorbaría.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('anima.welcomeSeen', '1'));
});

test('la sesión sobrevive a una recarga de página', async ({ page }) => {
  await page.goto('/?seed=5&speed=8&fresh=1');
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 30_000,
  });

  // Recarga sin parámetros: debe cargar el guardado, no un mundo nuevo.
  await page.goto('/');
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 10_000,
  });
  await page.getByTestId('tab-skills').click();
  await expect(page.getByTestId('skill-item')).toHaveCount(2);
  await page.getByTestId('tab-chat').click();
  await expect(page.getByTestId('chat-log')).toContainText('Sesión restaurada');
});

test('muerte, informe de legado y sucesora que hereda', async ({ page }) => {
  await page.goto('/?seed=5&speed=8&fresh=1');
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('generation')).toHaveText('gen 1');

  // Muerte forzada desde el modo desarrollador.
  await page.getByTestId('tab-dev').click();
  await page.getByTestId('dev-kill').click();

  const overlay = page.getByTestId('death-overlay');
  await expect(overlay).toBeVisible({ timeout: 15_000 });
  await expect(overlay).toContainText('Informe de legado');
  await expect(overlay).toContainText('inanición');
  await expect(overlay).toContainText('alcanzar-alimento-bloqueado');

  // Nace la sucesora.
  await page.getByTestId('create-successor').click();
  await expect(page.getByTestId('generation')).toHaveText('gen 2', { timeout: 10_000 });
  await expect(overlay).not.toBeVisible();

  // Heredó la skill (re-verificada) y el conocimiento como testimonio.
  await page.getByTestId('tab-skills').click();
  await expect(page.getByTestId('skill-item').first()).toBeVisible();
  await expect(page.getByTestId('skill-item').first()).toHaveAttribute('data-status', 'stable');
  await page.getByTestId('tab-estado').click();
  await expect(page.getByTestId('memory-list')).toContainText('según');

  // Y completa su propia historia sin morir en el intento.
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 30_000,
  });
});
