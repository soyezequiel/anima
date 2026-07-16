import { expect, test } from '@playwright/test';
import { reachBlockedResourceProgram } from '@anima/model-providers';

/**
 * E2E de la Fase 9: el proveedor Codex de punta a punta en el cliente
 * (elección persistida, transporte HTTP, parseo, validación DSL, evaluación
 * y promoción), interceptando el puente /ai/* con respuestas deterministas.
 * La verificación contra el Codex real se hace manualmente (consume cuota).
 */

test('la mascota aprende usando el proveedor codex (puente interceptado)', async ({ page }) => {
  let completeCalls = 0;

  await page.route('**/api/ai/status', (route) =>
    route.fulfill({
      json: { installed: true, loggedIn: true, detail: 'Logged in using ChatGPT' },
    }),
  );
  await page.route('**/api/ai/complete', async (route) => {
    completeCalls += 1;
    const body = route.request().postDataJSON() as { kind: string; prompt: string };
    if (body.kind === 'interpret.signal') {
      return route.fulfill({
        json: {
          text: JSON.stringify({
            hypothesis: 'consumir alimento recupera energía',
            confidence: 0.5,
          }),
        },
      });
    }
    if (body.kind === 'skill.propose' || body.kind === 'skill.revise') {
      // Mismo arco que el mock: primera propuesta defectuosa, corrección
      // cuando el informe de fallos menciona el daño nulo.
      const strategy =
        body.kind === 'skill.revise' && body.prompt.includes('no-damage-dealt')
          ? 'strongestTool'
          : 'nearest';
      return route.fulfill({
        json: {
          text: JSON.stringify({
            program: reachBlockedResourceProgram(strategy),
            rationale: `estrategia ${strategy}`,
          }),
        },
      });
    }
    return route.fulfill({ json: { text: JSON.stringify({ text: 'hola' }) } });
  });

  await page.addInitScript(() => {
    // Solo en la primera carga: las recargas posteriores deben respetar los
    // cambios de preferencia hechos por la propia UI.
    if (!sessionStorage.getItem('e2e-ai-seeded')) {
      sessionStorage.setItem('e2e-ai-seeded', '1');
      localStorage.setItem('anima:ai:choice', 'codex');
    }
  });

  await page.goto('/?seed=5&speed=8&fresh=1');

  // El proveedor activo es codex y la historia se completa con él.
  await expect(page.getByTestId('ai-chip')).toContainText('codex');
  await expect(page.getByTestId('story-status')).toHaveText('historia completada', {
    timeout: 30_000,
  });
  expect(completeCalls).toBeGreaterThanOrEqual(3); // interpret + propose + revise

  // El arco de aprendizaje es el mismo: v1 rechazada, v2 promovida.
  await page.getByTestId('tab-skills').click();
  await expect(page.getByTestId('skill-item')).toHaveCount(2);
  await expect(page.getByTestId('skill-item').filter({ hasText: 'v2' })).toHaveAttribute(
    'data-status',
    'stable',
  );

  // Volver al simulado funciona.
  await page.getByTestId('ai-use-mock').click();
  await expect(page.getByTestId('ai-chip')).toContainText('simulado', { timeout: 15_000 });
});

test('si la sesión de Codex se pierde, la app degrada a simulado', async ({ page }) => {
  await page.route('**/api/ai/status', (route) =>
    route.fulfill({ json: { installed: true, loggedIn: false, detail: null } }),
  );
  await page.addInitScript(() => {
    localStorage.setItem('anima:ai:choice', 'codex');
  });
  await page.goto('/?seed=5&speed=8&fresh=1');
  await expect(page.getByTestId('ai-chip')).toContainText('simulado');
  // Y la preferencia quedó degradada para no reintentar en cada carga.
  const choice = await page.evaluate(() => localStorage.getItem('anima:ai:choice'));
  expect(choice).toBeNull();
});
