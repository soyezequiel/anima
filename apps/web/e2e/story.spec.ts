import { expect, test } from '@playwright/test';

/**
 * E2E de la demo completa a través de la interfaz: la misma historia del
 * hito 1, observada desde el navegador. La sesión corre con MockModelProvider
 * (sin claves) y velocidad 8x para que la historia tarde segundos.
 */

// La bienvenida del primer uso se prueba en onboarding.spec.ts; aquí estorbaría.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('anima.welcomeSeen', '1'));
});

test('la historia completa de aprendizaje se ve en la UI', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');

  // El mundo y la mascota se renderizan (canvas de Phaser presente).
  await expect(page.locator('canvas')).toBeVisible();

  // La historia se completa: energía descendió, fallo, v1 rechazada,
  // v2 promovida, alimento alcanzado.
  await expect(page.locator('.app')).toHaveAttribute('data-story', 'completed', {
    timeout: 30_000,
  });

  // Panel de estado: energía recuperada por encima del inicio (15).
  await page.getByTestId('tab-estado').click();
  const energyText = await page.getByTestId('energy-value').textContent();
  const energy = Number(energyText?.split('/')[0]);
  expect(energy).toBeGreaterThan(20);

  // El objetivo quedó registrado como completado.
  await expect(page.getByTestId('goal-list')).toContainText('recuperar energía');
  await expect(page.getByTestId('goal-list')).toContainText('completed');

  // Memoria: sabe cosas nuevas.
  await expect(page.getByTestId('memory-list')).toContainText('consumir alimento recupera energía');

  // Panel de skills: v1 archivada y v2 estable, con regresiones conservadas.
  await page.getByTestId('tab-aprendizaje').click();
  const skillItems = page.getByTestId('skill-item');
  await expect(skillItems).toHaveCount(2);
  await expect(skillItems.filter({ hasText: 'v1' })).toHaveAttribute('data-status', 'archived');
  await expect(skillItems.filter({ hasText: 'v2' })).toHaveAttribute('data-status', 'stable');
  await expect(page.getByTestId('regression-list')).toContainText('food-behind-wall');

  // Detalle de la skill estable: motivación, criterios y programa.
  await skillItems.filter({ hasText: 'v2' }).getByRole('button').first().click();
  await expect(page.getByTestId('skill-comparison')).toContainText('→ 100%');

  // Historial de experimentos: rechazo y promoción visibles (misma pestaña).
  await expect(page.getByTestId('experiment-item').filter({ hasText: 'RECHAZADA' })).toHaveCount(1);
  await expect(page.getByTestId('experiment-item').filter({ hasText: 'PROMOVIDA' })).toHaveCount(1);

  // La mascota habló por el chat (su explicación de lo aprendido).
  await page.getByTestId('tab-chat').click();
  await expect(page.getByTestId('chat-log')).toContainText('Aprendí');
});

test('el chat conversa y responde una petición', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');
  await page.getByTestId('tab-chat').click();
  await page.getByTestId('chat-input').fill('hola');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-log')).toContainText('¡Hola!', { timeout: 15_000 });

  await page.getByTestId('chat-input').fill('espera un momento');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-log')).toContainText('Puedo esperar aquí un momento', {
    timeout: 15_000,
  });
});

test('pausa, velocidad y modo desarrollador funcionan', async ({ page }) => {
  await page.goto('/?seed=5&speed=1');

  const slider = page.getByTestId('speed-slider');
  const speedValue = page.getByTestId('speed-value');

  // El tick vive en el panel Estado; el arranque ahora es Chat.
  await page.getByTestId('tab-estado').click();
  const tick = page.getByTestId('world-tick');

  // El cero de la escala es la pausa: llevar el pulgar ahí congela el tick.
  await expect(speedValue).toHaveText('1x');
  await slider.press('ArrowLeft');
  await expect(speedValue).toHaveText('pausa');
  const tickText = await tick.textContent();
  await page.waitForTimeout(700);
  await expect(tick).toHaveText(tickText ?? '');

  // Avanzar un solo tick en pausa.
  await page.getByTestId('step-button').click();
  await expect(tick).not.toHaveText(tickText ?? '');

  // Salir del cero reanuda, y seguir subiendo recorre la escala: 1x, 2x, 4x.
  await slider.press('ArrowRight');
  await expect(speedValue).toHaveText('1x');
  await expect(page.getByTestId('step-button')).toBeHidden();
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');
  await expect(speedValue).toHaveText('4x');

  // Modo desarrollador: eventos estructurados con filtro.
  await page.getByTestId('tab-dev').click();
  await expect(page.getByTestId('dev-log')).toContainText('action.resolved', { timeout: 10_000 });
  await page.getByTestId('dev-filter').fill('goal.created');
  await expect(page.getByTestId('dev-log')).toContainText('recuperar energía');

  // Reiniciar con otra semilla resetea el mundo: vive tras el ⚙, porque
  // descarta el mundo actual y no es algo que se toque al pasar.
  await page.getByTestId('ai-settings-toggle').click();
  await page.getByTestId('seed-input').fill('9');
  await page.getByTestId('reset-button').click();
  await page.getByTestId('tab-estado').click();
  await expect(page.getByTestId('world-seed')).toHaveText('9');
});
