// ─── QUE EL PANEL Y EL MAPA CONVIVAN ────────────────────────────────────────
//
// No es uno de los nueve puntos de la vertical, y está igual porque el defecto
// que arregla se veía en los nueve: en una ventana angosta el panel entero caía
// debajo del mapa, así que para escribir una orden había que scrollear, y
// mientras escribías no veías lo que la criatura hacía.
//
// ─── POR QUÉ ESTO NO SE PUEDE VERIFICAR MIRANDO ────────────────────────────
//
// Se intentó a mano primero, achicando la ventana del navegador incrustado, y la
// medición mentía: la página seguía creyendo que medía 980 px mientras la
// captura se veía angosta. O sea que el `@media` no se estaba ejercitando y la
// pantalla parecía correcta por la razón equivocada.
//
// `setViewportSize` cambia el viewport de verdad, y es la única forma de afirmar
// que la regla dispara.

import { expect, test, type Page } from '@playwright/test'

async function abrir(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
}

/** ¿La página desborda a lo ancho? Es el síntoma que se ve como scroll abajo. */
async function desborda(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
}

test('en pantalla ancha, el mapa y el panel van lado a lado', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await abrir(page)

  const mapa = await page.locator('#mapa').boundingBox()
  const panel = await page.locator('aside').boundingBox()
  if (mapa === null || panel === null) throw new Error('falta el mapa o el panel')

  // Lado a lado: el panel arranca a la derecha de donde termina el mapa.
  expect(panel.x).toBeGreaterThan(mapa.x + mapa.width - 1)
  expect(await desborda(page)).toBe(false)
})

test('EN VENTANA ANGOSTA se apila, y lo que se usa queda ARRIBA del mapa', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 })
  await abrir(page)

  const mapa = await page.locator('#mapa').boundingBox()
  const panel = await page.locator('aside').boundingBox()
  if (mapa === null || panel === null) throw new Error('falta el mapa o el panel')

  // Apilado, y el panel PRIMERO: lo que se hace todo el tiempo es hablarle y
  // mirar a la criatura. El mapa sigue abajo y no se va a ningún lado.
  expect(panel.y).toBeLessThan(mapa.y)
  // Y la caja de texto se puede usar sin scrollear.
  await expect(page.locator('#orden')).toBeInViewport()
})

test('el zoom ×4 no desborda la página a lo ancho', async ({ page }) => {
  // El canvas lleva un ancho fijo en píxeles que le pone el zoom, así que sin un
  // `max-width` el ×4 empuja la página entera y aparece scroll horizontal.
  await page.setViewportSize({ width: 900, height: 900 })
  await abrir(page)
  await page.locator('#ver-y-dibujar > summary').click()
  await page.locator('[data-zoom="4"]').click()

  expect(await desborda(page)).toBe(false)
})

test('lo que se toca una vez va plegado, y lo que se usa siempre no', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await abrir(page)

  // Lo de todos los días, a la vista sin abrir nada.
  await expect(page.locator('#orden')).toBeVisible()
  await expect(page.locator('#aliento')).toBeVisible()
  await expect(page.locator('[data-vel="0"]')).toBeVisible()
  await expect(page.locator('#mirado-que')).toBeVisible()

  // Y lo que se toca una vez, plegado: el panel tenía nueve secciones apiladas
  // con el mismo peso, y tres de las primeras eran controles de una sola vez.
  await expect(page.locator('#olvidar')).not.toBeVisible()
  await expect(page.locator('[data-zoom="4"]')).not.toBeVisible()

  // Plegado no es escondido: se abre y está.
  await page.locator('#diagnostico > summary').click()
  await expect(page.locator('#a-la-vista')).toBeVisible()
})

test('12C · el catálogo existe, y dibuja con el mismo glifo que el inventario', async ({ page }) => {
  // Los casos 6 y 7 del Hito 12C: que el catálogo sea una vista de verdad, y que
  // la misma cosa se vea igual en las tres.
  //
  // La coherencia no se afirma comparando píxeles entre paneles —eso probaría una
  // coincidencia— sino que las tres vistas llaman a `enUnCanvas`, o sea al mismo
  // `glifoDe` con el mismo descriptor. Lo que este spec cuida es la otra mitad:
  // que el catálogo EXISTA y esté poblado, porque una vista vacía coincide con
  // todo.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })

  // Va plegado, como todo lo que se consulta y no se usa a cada rato.
  await expect(page.locator('#lista-catalogo')).not.toBeVisible()
  await page.locator('#catalogo > summary').click()

  const filas = page.locator('#lista-catalogo .fila')
  await expect(filas.first()).toBeVisible()
  // El catálogo core del planificador tiene trece filas y varias establecen lo
  // mismo, así que lo que se afirma es que hay VARIAS y no un número exacto: el
  // día que alguien agregue un esquema, este spec no tiene por qué enterarse.
  expect(await filas.count()).toBeGreaterThan(3)

  // Y dice las metas en castellano, no en firmas. `emitsPower>0` es «fuego».
  await expect(page.locator('#lista-catalogo')).toContainText('fuego')
})
