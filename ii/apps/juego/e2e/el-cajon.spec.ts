// ─── LA CHARLA COMO CAJÓN, Y LAS CUATRO REGLAS DEL CRUCE ────────────────────
//
// Abajo de 1040 px la charla deja de ser una columna y pasa a ser un cajón que
// se corre afuera y vuelve con un tirador. Lo que hay que probar acá no es cómo
// se ve de cada lado —eso se mira— sino **qué pasa al CRUZAR**, que son cuatro
// reglas y ninguna se puede afirmar mirando una sola pantalla:
//
//   1. al CARGAR en angosto queda ABIERTA: la primera medición no es un cruce;
//   2. sólo se cierra sola al cruzar de ancho a angosto;
//   3. al cruzar de angosto a ancho, se reabre;
//   4. un pedido la abre.
//
// La 1 y la 2 son la misma pantalla con dos historias distintas detrás, y ésa es
// exactamente la clase de cosa que un test de un solo estado no distingue: en las
// dos terminás en 900 px de ancho, y en una la charla tiene que estar abierta y
// en la otra cerrada. Sin `setViewportSize` de verdad no hay forma de contarlas
// aparte — es la misma razón que `la-distribucion` ya tenía escrita.

import { expect, test, type Page } from '@playwright/test'

const ANGOSTO = { width: 900, height: 800 }
const ANCHO = { width: 1280, height: 800 }

/**
 * ─── EL DEPÓSITO SE SILENCIA, y hace falta desde que el chat le pregunta ────
 *
 * Una frase que el léxico no termina de entender sale a preguntarle a Codex. En
 * un e2e no hay depósito, así que ese viaje falla — y una falla escribe en la
 * charla («no pude pensarlo mejor…»), por red y cuando quiere.
 *
 * Eso convierte a cualquier aserción sobre el registro en una carrera: pasa o no
 * según si la respuesta llegó antes de que el spec leyera. Se contesta «llegó y
 * no trajo nada», que es el único resultado que NO escribe en la charla — ver
 * `#noLlegue` en `ordenes.ts`.
 *
 * Lo que este spec mide sigue siendo lo suyo. Lo que se saca es la red.
 */
async function abrir(page: Page): Promise<void> {
  await page.route('**/leer', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ok: true, respuesta: null }),
    }),
  )
  await page.goto('/')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
}

/** ¿Está el cajón adentro de la pantalla? Se mira dónde CAYÓ, no una clase. */
async function laCharlaSeVe(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const caja = document.querySelector('#charla-columna')?.getBoundingClientRect()
    return caja !== undefined && caja.left < window.innerWidth - 4
  })
}

/** El cajón se corre con una transición de .22s: hay que dejarla terminar. */
async function trasElCorrimiento(page: Page): Promise<void> {
  await page.waitForTimeout(400)
}

test('1 · AL CARGAR EN ANGOSTO la charla queda ABIERTA', async ({ page }) => {
  // La primera medición no cuenta como cruce. Sin esa excepción, abrir el juego
  // en un teléfono te recibe con la charla cerrada y un tirador que no explica
  // nada — y la charla es una de las tres cosas que quedan con el dev apagado.
  await page.setViewportSize(ANGOSTO)
  await abrir(page)

  expect(await laCharlaSeVe(page)).toBe(true)
  await expect(page.locator('#tirador')).toBeHidden()
  await expect(page.locator('#orden')).toBeInViewport()
})

test('2 · SÓLO SE CIERRA AL CRUZAR de ancho a angosto', async ({ page }) => {
  await page.setViewportSize(ANCHO)
  await abrir(page)
  expect(await laCharlaSeVe(page), 'en ancho la charla es una columna y está').toBe(true)

  await page.setViewportSize(ANGOSTO)
  await trasElCorrimiento(page)

  // La misma pantalla que el test 1 —900 px de ancho— y acá tiene que estar
  // CERRADA. La diferencia no está en el tamaño: está en de dónde se viene.
  expect(await laCharlaSeVe(page)).toBe(false)
  await expect(page.locator('#tirador')).toBeVisible()
})

test('3 · y AL CRUZAR DE VUELTA a ancho, se reabre', async ({ page }) => {
  await page.setViewportSize(ANCHO)
  await abrir(page)
  await page.setViewportSize(ANGOSTO)
  await trasElCorrimiento(page)
  expect(await laCharlaSeVe(page)).toBe(false)

  await page.setViewportSize(ANCHO)
  await trasElCorrimiento(page)
  expect(await laCharlaSeVe(page)).toBe(true)
  // Y el tirador se va: en ancho no hay nada que tirar.
  await expect(page.locator('#tirador')).toBeHidden()
})

test('EL TIRADOR LA ABRE Y LA × LA CIERRA, que son los dos gestos', async ({ page }) => {
  await page.setViewportSize(ANCHO)
  await abrir(page)
  await page.setViewportSize(ANGOSTO)
  await trasElCorrimiento(page)

  await page.locator('#tirador').click()
  await trasElCorrimiento(page)
  expect(await laCharlaSeVe(page)).toBe(true)

  await page.locator('#cerrar-charla').click()
  await trasElCorrimiento(page)
  expect(await laCharlaSeVe(page)).toBe(false)
})

test('4 · UN PEDIDO LA ABRE, porque la respuesta sale ahí adentro', async ({ page }) => {
  await page.setViewportSize(ANGOSTO)
  await abrir(page)
  // Se cierra a mano para tener el caso: el pedido va a tener que reabrirla.
  await page.locator('#cerrar-charla').click()
  await trasElCorrimiento(page)
  expect(await laCharlaSeVe(page)).toBe(false)

  // Y el pedido se manda por el mismo camino que un chip: `requestSubmit` del
  // formulario, que es lo único que hay. Escribir en un cajón corrido no se
  // puede —está `inert`— así que el pedido entra por donde entraría de verdad.
  await page.locator('#charla').evaluate((f: HTMLFormElement) => {
    const campo = f.querySelector('input')
    if (campo !== null) campo.value = 'hacé fuego'
    f.requestSubmit()
  })
  await trasElCorrimiento(page)

  expect(await laCharlaSeVe(page)).toBe(true)
  await expect(page.locator('#registro .respuesta').last()).toHaveText('dale, voy')
})

// ─── EL PUNTO DE SIN LEER ───────────────────────────────────────────────────
//
// Con el cajón cerrado no hay forma de haber leído nada, así que lo que llegue
// mientras tanto queda marcado. Se mide contra el TURNO y no contra la cantidad
// de líneas: el canal se recorta a cien por arriba, o sea que la cantidad puede
// quedarse quieta mientras entran líneas nuevas. El turno sólo sube.
test('el tirador avisa cuando llegó algo con el cajón cerrado', async ({ page }) => {
  await page.setViewportSize(ANGOSTO)
  await abrir(page)
  const punto = page.locator('#tirador-punto')

  // Se habla con el cajón ABIERTO: eso ya está leído.
  await page.locator('#orden').fill('hacé fuego')
  await page.locator('#orden').press('Enter')
  await page.locator('#cerrar-charla').click()
  await trasElCorrimiento(page)
  await expect(punto, 'marca como no leído algo que estaba a la vista').toBeHidden()

  // Y ahora el mundo narra con el cajón cerrado.
  await page.locator('[data-vel="4"]').click()
  await expect(punto).toBeVisible({ timeout: 40_000 })
  await page.locator('[data-vel="0"]').click()

  // Abrirlo lo apaga: ya lo viste.
  await page.locator('#tirador').click()
  await trasElCorrimiento(page)
  await expect(punto).toBeHidden()
})

// ─── Y EL DOCK OCUPA TODO EL ANCHO CUANDO LA CHARLA NO ESTÁ ─────────────────
test('el dock llega hasta la charla, y hasta el borde cuando no hay charla', async ({ page }) => {
  await page.setViewportSize(ANCHO)
  await abrir(page)
  await page.setViewportSize(ANGOSTO)
  await trasElCorrimiento(page)

  const sw = page.locator('#modo-dev')
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click()

  // Con el cajón cerrado, hasta el borde.
  const conCajonCerrado = await page.locator('#dock').boundingBox()
  expect(conCajonCerrado?.width).toBeCloseTo(ANGOSTO.width, -1)

  // Y abierto, se detiene donde ella empieza: el dock nunca se le mete debajo.
  await page.locator('#tirador').click()
  await trasElCorrimiento(page)
  const dock = await page.locator('#dock').boundingBox()
  const charla = await page.locator('#charla-columna').boundingBox()
  if (dock === null || charla === null) throw new Error('falta el dock o la charla')
  expect(dock.x + dock.width).toBeLessThanOrEqual(charla.x + 1)
})
