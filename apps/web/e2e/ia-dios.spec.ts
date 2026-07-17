import { expect, test } from '@playwright/test';
import { reachBlockedResourceProgram } from '@anima/model-providers';

/**
 * IA Dios de punta a punta (ADR 0024): el cuidador describe un objeto en el
 * chat, la mascota lo traduce a una receta (puente /ai/* interceptado con
 * respuestas deterministas), muestra la vista previa, espera el sí, y lo
 * recién descrito se puede construir de inmediato.
 */

const GLORB_DESCRIPTION = 'un glorb es un mineral azul que da calor';

// La bienvenida del primer uso se prueba en onboarding.spec.ts; aquí estorbaría.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('anima.welcomeSeen', '1'));
});

test('describe un glorb, lo confirma en el chat y la mascota lo construye', async ({ page }) => {
  await page.route('**/api/ai/status', (route) =>
    route.fulfill({
      json: { installed: true, loggedIn: true, detail: 'Logged in using ChatGPT' },
    }),
  );
  await page.route('**/api/ai/complete', (route) => {
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
      // La historia del hambre corre de fondo: mismo arco que codex.spec.ts.
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
      if (body.prompt.includes(`Mensaje actual: "${GLORB_DESCRIPTION}"`)) {
        return route.fulfill({
          json: {
            text: JSON.stringify({
              action: 'describe-entity',
              targetKind: '',
              directions: [],
              summary: GLORB_DESCRIPTION,
            }),
          },
        });
      }
      if (body.prompt.includes('Mensaje actual: "hacé un glorb"')) {
        return route.fulfill({
          json: {
            text: JSON.stringify({
              action: 'craft-item',
              targetKind: '',
              directions: [],
              recipeId: 'glorb',
              summary: '',
            }),
          },
        });
      }
      return route.fulfill({
        json: {
          text: JSON.stringify({ action: 'not-command', targetKind: '', directions: [], summary: '' }),
        },
      });
    }
    if (body.kind === 'entity.describe') {
      return route.fulfill({
        json: {
          text: JSON.stringify({
            recipeJson: JSON.stringify({
              id: 'glorb',
              output: {
                kind: 'glorb',
                components: { heatSource: { warmthPerTick: 0.5, range: 2 }, portable: {} },
              },
              ingredients: [{ kind: 'flint', count: 1 }],
            }),
            rationale: '"da calor" se traduce a heatSource',
          }),
        },
      });
    }
    return route.fulfill({ json: { text: JSON.stringify({ text: 'hola' }) } });
  });

  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-ai-seeded')) {
      sessionStorage.setItem('e2e-ai-seeded', '1');
      localStorage.setItem('anima:ai:choice', 'codex');
    }
  });

  await page.goto('/?seed=5&speed=8&fresh=1');
  await expect(page.getByTestId('ai-chip')).toContainText('codex');

  // El cuidador describe el objeto: aparece la vista previa y la pregunta.
  await page.getByTestId('tab-chat').click();
  await page.getByTestId('chat-input').fill(GLORB_DESCRIPTION);
  await page.getByTestId('chat-send').click();
  const preview = page.getByTestId('recipe-preview');
  await expect(preview).toBeVisible({ timeout: 20_000 });
  await expect(preview).toContainText('glorb');
  await expect(preview).toContainText('1 pedernal');
  await expect(preview).toContainText('da calor');
  await expect(page.getByTestId('chat-log')).toContainText('¿Lo hago parte de mi mundo?');

  // Nada entró todavía: entra recién con la confirmación.
  await page.getByTestId('chat-input').fill('sí');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-log')).toContainText('Ya sé construir un glorb', {
    timeout: 20_000,
  });

  // Y es construible de inmediato, por su nombre.
  await page.getByTestId('chat-input').fill('hacé un glorb');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-log')).toContainText('construir un glorb', {
    timeout: 20_000,
  });

  // El mundo lo confirma: el evento item.crafted del glorb en el panel dev.
  await page.getByTestId('tab-dev').click();
  await page.getByTestId('dev-filter').fill('item.crafted');
  await expect(page.getByTestId('dev-log')).toContainText('glorb', { timeout: 45_000 });
});
