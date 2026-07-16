import { expect, test } from '@playwright/test';
import { reachBlockedResourceProgram } from '@anima/model-providers';

/**
 * E2E de la Fase 9: el proveedor Codex de punta a punta en el cliente
 * (elección persistida, transporte HTTP, parseo, validación DSL, evaluación
 * y promoción), interceptando el puente /ai/* con respuestas deterministas.
 * La verificación contra el Codex real se hace manualmente (consume cuota).
 */

// La bienvenida del primer uso se prueba en onboarding.spec.ts; aquí estorbaría.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('anima.welcomeSeen', '1'));
});

test('la mascota aprende usando el proveedor codex (puente interceptado)', async ({ page }) => {
  let completeCalls = 0;
  let logoutCalls = 0;
  let dialogueRequest: {
    kind: string;
    prompt: string;
    model?: string;
    reasoningEffort?: string;
  } | null = null;

  await page.route('**/api/ai/status', (route) =>
    route.fulfill({
      json: {
        installed: true,
        loggedIn: logoutCalls === 0,
        detail: logoutCalls === 0 ? 'Logged in using ChatGPT' : null,
      },
    }),
  );
  await page.route('**/api/ai/limits', (route) =>
    route.fulfill({
      json: {
        planType: 'plus',
        primary: { usedPercent: 48, windowDurationMins: 10080, resetsAt: 1784822466 },
        secondary: null,
      },
    }),
  );
  await page.route('**/api/ai/logout', (route) => {
    logoutCalls += 1;
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/ai/complete', async (route) => {
    completeCalls += 1;
    const body = route.request().postDataJSON() as {
      kind: string;
      prompt: string;
      model?: string;
      reasoningEffort?: string;
    };
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
    if (body.kind === 'interpret.command') {
      return route.fulfill({
        json: {
          text: JSON.stringify({
            action: 'not-command',
            targetKind: '',
            directions: [],
            summary: '',
          }),
        },
      });
    }
    dialogueRequest = body;
    await new Promise((resolve) => setTimeout(resolve, 800));
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

  // Mientras Codex responde, el estado se ve en el mundo, el chat y el chip.
  // Los ajustes elegidos se aplican en vivo y persisten en el navegador.
  await page.getByTestId('ai-settings-toggle').click();
  // Al abrir el panel se consultan los límites de la cuenta.
  await expect(page.getByTestId('ai-limits')).toContainText('Plan: plus');
  await expect(page.getByTestId('ai-limits')).toContainText('Límite semanal: 48% usado');
  await page.getByTestId('ai-model').fill('gpt-5.6-terra');
  await page.getByTestId('ai-reasoning-effort').selectOption('high');
  await page.getByTestId('ai-settings-toggle').click();
  await page.getByTestId('tab-chat').click();
  await page.getByTestId('chat-input').fill('¿qué estás pensando?');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('stage-thinking')).toBeVisible();
  await expect(page.getByTestId('chat-thinking')).toBeVisible();
  await expect(page.getByTestId('chat-send')).toBeDisabled();
  await expect(page.getByTestId('ai-chip')).toContainText('pensando');
  await expect(page.getByTestId('chat-thinking')).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('.chat-entry.from-pet').filter({ hasText: 'hola' })).toBeVisible();
  await expect(page.getByTestId('chat-send')).toBeEnabled();
  expect(dialogueRequest).toMatchObject({ model: 'gpt-5.6-terra', reasoningEffort: 'high' });
  const storedSettings = await page.evaluate(() => localStorage.getItem('anima:ai:codex-settings'));
  expect(storedSettings).toContain('gpt-5.6-terra');

  // Volver al simulado funciona; con la sesión de Codex aún viva, el botón
  // de cerrar sesión sigue disponible y la termina en el servidor.
  await page.getByTestId('ai-use-mock').click();
  await expect(page.getByTestId('ai-chip')).toContainText('simulado', { timeout: 15_000 });
  await expect(page.getByTestId('ai-logout-codex')).toBeVisible();
  await page.getByTestId('ai-logout-codex').click();
  await expect(page.getByTestId('ai-logout-codex')).toBeHidden();
  expect(logoutCalls).toBe(1);
});

test('con identidad iniciada, el puente de IA viaja con el token de sesión', async ({ page }) => {
  const pubkey = 'a'.repeat(64);
  const aiAuthHeaders: (string | undefined)[] = [];

  await page.route('**/api/me', (route) => route.fulfill({ json: { pubkey } }));
  await page.route('**/api/data', (route) => route.fulfill({ json: { keys: [] } }));
  await page.route('**/api/data/**', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 404, json: { error: 'clave inexistente' } })
      : route.fulfill({ status: 204 }),
  );
  await page.route('**/api/ai/status', (route) => {
    aiAuthHeaders.push(route.request().headers()['authorization']);
    return route.fulfill({
      json: { installed: true, loggedIn: true, detail: 'Logged in using ChatGPT' },
    });
  });
  await page.route('**/api/ai/complete', (route) =>
    route.fulfill({ json: { text: JSON.stringify({ text: 'hola' }) } }),
  );

  await page.addInitScript(
    ({ pk }) => {
      localStorage.setItem('anima:ai:choice', 'codex');
      localStorage.setItem(
        'anima:cloud:account',
        JSON.stringify({ token: 'token-e2e', pubkey: pk, method: 'nip07' }),
      );
    },
    { pk: pubkey },
  );

  await page.goto('/?seed=5&speed=8&fresh=1');
  await expect(page.getByTestId('ai-chip')).toContainText('codex');
  // Cada consulta al puente lleva la identidad: la cuenta de Codex es propia.
  expect(aiAuthHeaders.length).toBeGreaterThan(0);
  for (const header of aiAuthHeaders) {
    expect(header).toBe('Bearer token-e2e');
  }
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
