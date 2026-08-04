import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * La puerta a Ánima II avisa antes de dejar pasar (ADR 0088).
 *
 * Lo que se prueba no es que aparezca un cartel: es que el cartel se meta
 * ENTRE el clic y el viaje. Un aviso que sale después de navegar no avisa
 * nada, y uno que no se puede saltear es una pared, no un aviso.
 */

/** Deja la barra a la vista: la bienvenida del primer día la tapa entera. */
async function entrarAlJuego(page: Page) {
  await page.goto('/?seed=5&speed=0&autostart=0');
  await page.getByTestId('welcome-start').click();
}

test('el clic no cruza: primero el cartel de obra', async ({ page }) => {
  await entrarAlJuego(page);

  await page.getByTestId('anima-ii-link').click();

  // Sigue acá. Esto es el corazón del asunto: el clic NO navegó.
  await expect(page).toHaveURL(/localhost:5173/);
  const aviso = page.getByTestId('v2-notice');
  await expect(aviso).toBeVisible();

  // Y dice las dos cosas que hay que saber antes de cruzar.
  await expect(aviso).toContainText('en obra');
  await expect(aviso).toContainText('muy temprano');

  // Se puede volver sin cruzar, y el juego queda como estaba.
  await page.getByTestId('v2-stay').click();
  await expect(aviso).toHaveCount(0);
  await expect(page.getByTestId('anima-ii-link')).toBeVisible();
});

test('«Entrar igual» abre la II en otra pestaña y deja la partida acá', async ({ page }) => {
  await entrarAlJuego(page);

  // El destino se lee del propio enlace: así el test vale igual en desarrollo
  // (otro servidor, puerto 5170) que en el deploy (`/v2/`, mismo dominio).
  const destino = await page.getByTestId('anima-ii-link').getAttribute('href');
  expect(destino).toBeTruthy();
  // Se contesta con un doble: la II puede no estar levantada durante estas
  // pruebas, y lo que se está probando es a dónde va el enlace, no ella.
  await page
    .context()
    .route(`${destino}**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>Ánima II</h1>' }),
    );

  await page.getByTestId('anima-ii-link').click();
  const [nueva] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByTestId('v2-enter').click(),
  ]);

  await expect(nueva).toHaveURL(new RegExp(destino!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  // La pestaña de siempre no se movió: la partida sigue viva donde estaba.
  await expect(page).toHaveURL(/localhost:5173/);
  await expect(page.getByTestId('v2-notice')).toHaveCount(0);
  await nueva.close();
});

test('ctrl + clic no pregunta nada: quien sabe adónde va, va', async ({ page }) => {
  await entrarAlJuego(page);

  const destino = await page.getByTestId('anima-ii-link').getAttribute('href');
  await page
    .context()
    .route(`${destino}**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>Ánima II</h1>' }),
    );

  const [nueva] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByTestId('anima-ii-link').click({ modifiers: ['ControlOrMeta'] }),
  ]);

  await expect(page.getByTestId('v2-notice')).toHaveCount(0);
  await nueva.close();
});
