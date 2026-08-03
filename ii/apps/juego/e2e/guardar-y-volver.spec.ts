// ─── 9 · CERRAR Y REABRIR SIN PERDER LA SESIÓN ──────────────────────────────
//
// El único punto de la vertical que no se puede probar sin recargar la página, y
// por eso vive en su propio archivo: los demás corren sobre una pestaña que se
// abre una vez.
//
// ─── LO QUE NO ALCANZA, Y ES EL ERROR FÁCIL ────────────────────────────────
//
// Comprobar que «hay algo guardado» no prueba nada: un guardado vacío también
// está. Lo que se afirma es que **el mundo que vuelve es el que se fue** —el
// mismo tick, en el mismo lugar, con lo mismo en la mano— y que la salida de
// emergencia devuelve un mundo nuevo de verdad.

import { expect, test, type Page } from '@playwright/test'

async function tick(page: Page): Promise<number> {
  return Number(await page.locator('#tick').textContent())
}

async function abrir(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
  // «La partida» es un módulo del DOCK desde el paso 6, así que descubrirlo son
  // dos gestos: el interruptor de modo dev y su chip. Va acá, en el `abrir()`
  // que los dos tests comparten, porque los dos lo necesitan.
  //
  // Los `toHaveText` de más abajo leerían igual con el dock cerrado —Playwright
  // no exige visibilidad para leer texto, y los ocho paneles están siempre en el
  // DOM— pero el botón de borrar SÍ hay que descubrirlo, igual que lo haría el
  // jugador. Y los dos `if` son porque el modo dev se guarda entre sesiones: un
  // click a ciegas lo apagaría si vino prendido.
  const sw = page.locator('#modo-dev')
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click()
  const chip = page.locator('#chip-partida')
  if (!(await chip.evaluate((b) => b.classList.contains('on')))) await chip.click()
  await expect(page.locator('[data-modulo="partida"]')).toBeVisible()
}

/**
 * Espera a que el juego escriba un guardado.
 *
 * No se espera un tiempo fijo: el guardado corre cada N cuadros y a cuántos
 * cuadros por segundo va esta máquina no lo sabe nadie. Se espera al cartel, que
 * es el mismo que ve el jugador.
 */
async function esperarGuardado(page: Page): Promise<number> {
  await expect(page.locator('#guardado')).toHaveText(/^tick \d+$/, { timeout: 40_000 })
  const t = await page.locator('#guardado').textContent()
  return Number((t ?? '').replace('tick ', ''))
}

test('9 · el mundo que vuelve es el que se fue', async ({ page }) => {
  await abrir(page)
  await page.locator('[data-vel="4"]').click()
  const guardadoEn = await esperarGuardado(page)
  expect(guardadoEn).toBeGreaterThan(0)

  await page.locator('[data-vel="0"]').click()
  const manosAntes = await page.locator('#manos').textContent()
  const dondeAntes = await page.locator('#donde').textContent()
  const cuerposAntes = await page.locator('#cuerpos').textContent()

  // ─── Y ACÁ SE CIERRA LA PESTAÑA ────────────────────────────────────────
  await abrir(page)

  // Vuelve en el tick guardado o después —el juego arranca en pausa, así que no
  // debería avanzar solo, pero un cuadro de más no es un fallo—, nunca antes.
  expect(await tick(page), 'volvió a un mundo más viejo que el guardado').toBeGreaterThanOrEqual(guardadoEn)
  expect(await page.locator('#cuerpos').textContent()).toBe(cuerposAntes)
  expect(await page.locator('#donde').textContent()).toBe(dondeAntes)
  expect(await page.locator('#manos').textContent()).toBe(manosAntes)
})

test('9b · «empezar de cero» devuelve un mundo nuevo, no el guardado', async ({ page }) => {
  // El control negativo del test de arriba: sin esto, «volvió igual» podría ser
  // que el juego IGNORA el guardado y arma siempre el mismo mundo desde la
  // semilla. Acá el mundo tiene que ser distinto, y encima es la salida de
  // emergencia de una partida en mal estado.
  await abrir(page)
  await page.locator('[data-vel="4"]').click()
  await esperarGuardado(page)
  await page.locator('[data-vel="0"]').click()
  const avanzado = await tick(page)
  expect(avanzado).toBeGreaterThan(0)

  // `confirm` es un diálogo nativo: sin esto Playwright lo deja colgado.
  page.on('dialog', (d) => void d.accept())
  await page.locator('#olvidar').click()

  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
  expect(await tick(page), 'siguió cargando el guardado viejo').toBeLessThan(avanzado)
})
