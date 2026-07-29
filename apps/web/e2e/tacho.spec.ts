import { expect, test } from '@playwright/test';
import type { GameSession } from '../src/session/GameSession.js';

/**
 * El poder del cuidador de sacar UNA cosa del mapa: se agarra del tablero y se
 * suelta en el tacho.
 *
 * Va a e2e y no a una prueba de unidad porque lo que hay que probar es
 * justamente lo que jsdom no tiene: que el navegador EMPIECE el arrastre
 * nativo al apretar sobre el tablero. Esa parte estuvo rota y no se notaba —
 * Phaser le hacía `preventDefault` al `mousedown`, y un mousedown cancelado es
 * un arrastre que nunca nace. Los handlers de React andaban perfecto; lo que
 * faltaba era que alguien los llamara.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('anima.welcomeSeen', '1'));
});

/** La sesión que `main.tsx` deja a mano para inspeccionar desde la consola. */
type WithSession = typeof globalThis & { anima: GameSession };

test('lo que el cuidador arrastra al tacho desaparece del mapa', async ({ page }) => {
  await page.goto('/?seed=5&fresh=1');
  const board = page.locator('.stage-board');
  await expect(board).toBeVisible();

  // Quieto: si el mundo avanza, la mascota puede levantar del piso justo lo
  // que íbamos a arrastrar y la prueba fallaría por una razón que no es la suya.
  await page.evaluate(() => (globalThis as WithSession).anima.pause());

  // A quién apuntamos. El view solo sirve para ELEGIR el blanco y para leer el
  // resultado: el borrado lo hace el arrastre de verdad, no esta llamada.
  const target = await page.evaluate(() => {
    const view = (globalThis as WithSession).anima.getView();
    const first = view.entities[0];
    return first ? { id: first.id, x: first.x, y: first.y, cols: view.worldSize.width } : null;
  });
  expect(target).not.toBeNull();

  const box = (await board.boundingBox())!;
  const cell = box.width / target!.cols;
  const from = { x: target!.x * cell + cell / 2, y: target!.y * cell + cell / 2 };

  // El arrastre a mano y no `dragTo`: hace falta poder mirar el tacho a mitad
  // de camino, con el botón apretado y la cosa en vuelo.
  const trash = page.getByTestId('stage-trash');
  await expect(trash).not.toHaveClass(/stage-trash-armed/);
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  const trashBox = (await trash.boundingBox())!;
  await page.mouse.move(box.x + from.x + 20, box.y + from.y + 20, { steps: 5 });
  await page.mouse.move(trashBox.x + trashBox.width / 2, trashBox.y + trashBox.height / 2, {
    steps: 10,
  });

  // Encendido y con nombre: soltar es una confirmación, no una apuesta.
  await expect(trash).toHaveClass(/stage-trash-armed/);
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(
        (id) => (globalThis as WithSession).anima.getView().entities.some((e) => e.id === id),
        target!.id,
      ),
    )
    .toBe(false);

  // Y el tacho vuelve a apagarse solo, sin que nadie lo limpie.
  await expect(trash).not.toHaveClass(/stage-trash-armed/);
});

test('sobre suelo pelado no arranca ningún arrastre', async ({ page }) => {
  await page.goto('/?seed=5&fresh=1');
  const board = page.locator('.stage-board');
  await expect(board).toBeVisible();
  await page.evaluate(() => (globalThis as WithSession).anima.pause());

  // Una celda del mapa sin nada encima y sin la mascota.
  const empty = await page.evaluate(() => {
    const view = (globalThis as WithSession).anima.getView();
    const taken = new Set(view.entities.map((e) => `${e.x},${e.y}`));
    taken.add(`${view.pet!.x},${view.pet!.y}`);
    for (let y = 0; y < view.worldSize.height; y++) {
      for (let x = 0; x < view.worldSize.width; x++) {
        if (!taken.has(`${x},${y}`)) return { x, y, cols: view.worldSize.width };
      }
    }
    return null;
  });
  expect(empty).not.toBeNull();

  const box = (await board.boundingBox())!;
  const cell = box.width / empty!.cols;
  const trash = page.getByTestId('stage-trash');
  const trashBox = (await trash.boundingBox())!;

  await page.mouse.move(box.x + empty!.x * cell + cell / 2, box.y + empty!.y * cell + cell / 2);
  await page.mouse.down();
  await page.mouse.move(trashBox.x + trashBox.width / 2, trashBox.y + trashBox.height / 2, {
    steps: 10,
  });
  // Nada en vuelo: el tacho ni se entera.
  await expect(trash).not.toHaveClass(/stage-trash-armed/);
  await page.mouse.up();
});
