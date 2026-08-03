// ─── EL MAPA ES LA PANTALLA ─────────────────────────────────────────────────
//
// Este archivo se llamaba «que el panel y el mapa convivan» y afirmaba que iban
// LADO A LADO, cada uno con su columna. El rediseño da vuelta esa relación: el
// mapa ocupa la ventana entera y todo lo demás flota encima. O sea que la mitad
// de lo que este archivo probaba dejó de ser cierto **a propósito**, y se
// reescribió con lo que sí tiene que seguir valiendo.
//
// Lo que NO cambió es el defecto que lo motivó, y por eso sigue habiendo un
// test que lo cuida: con el encuadre clavado en 15×15 celdas, una pantalla de
// 1900×900 dejaba **setecientos píxeles de nada** al costado del mapa. Antes se
// medía contra la columna porque el mapa vivía en una; ahora se mide contra la
// ventana, que es contra lo que siempre se debió haber medido.
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

/**
 * LA ESCALA REAL A LA QUE SE ESTÁ DIBUJANDO EL MAPA, por eje.
 *
 * El canvas mide `width × height` píxeles adentro y lo que el CSS diga afuera,
 * así que el cociente ES el zoom — cuando nada lo deforma. Se devuelven los dos
 * ejes por separado justamente para poder afirmar que son el mismo número.
 */
async function escalaDelMapa(page: Page): Promise<{ x: number; y: number }> {
  return page.locator('#mapa').evaluate((c: HTMLCanvasElement) => {
    const caja = c.getBoundingClientRect()
    return { x: caja.width / c.width, y: caja.height / c.height }
  })
}

// ─── EL MAPA LLENA LA VENTANA ───────────────────────────────────────────────
//
// Se afirma con una PROPORCIÓN y no con un tamaño: cuánto mide el mapa depende
// de la pantalla, del zoom y del tope de celdas, o sea de tres cosas que pueden
// cambiar por buenos motivos. Lo que no puede volver a pasar es que sobre media
// pantalla.
//
// El 85% sale de una cuenta y no del dedo: el encuadre se calcula en celdas
// enteras y además fuerza un número IMPAR de ellas —el foco necesita un centro,
// ver `el-encuadre.ts`— así que lo que se puede perder por eje son dos celdas de
// 56 px a zoom ×2. En una ventana de 700 px eso es el 16%, y el defecto viejo
// aprovechaba el 54%: el umbral es rojo para él y verde para el redondeo.
test('EL MAPA ES LA PANTALLA: llena la ventana, y lo demás flota encima', async ({ page }) => {
  await page.setViewportSize({ width: 1900, height: 900 })
  await abrir(page)

  const mapa = await page.locator('#mapa').boundingBox()
  const panel = await page.locator('aside').boundingBox()
  if (mapa === null || panel === null) throw new Error('falta el mapa o el panel')

  expect(mapa.width / 1900).toBeGreaterThan(0.85)
  expect(mapa.height / 900).toBeGreaterThan(0.85)

  // Y ENCIMA, no al lado. Es la afirmación que este archivo tenía al revés: si
  // el panel arrancara donde el mapa termina, volveríamos a la grilla de dos
  // columnas y el mapa dejaría de ser la pantalla sin que nada más se rompiera.
  expect(panel.x).toBeLessThan(mapa.x + mapa.width)

  // Sin desbordar, que es la contracara: un encuadre que se pase de la ventana
  // no se ve como «grande», se ve como scroll horizontal en toda la página.
  expect(await desborda(page)).toBe(false)
})

test('EL MAPA ES APAISADO cuando la ventana lo es, y cuadrado cuando ella lo es', async ({ page }) => {
  // La otra mitad del cambio: el encuadre tiene la FORMA del lugar donde se lo
  // mira. Sin esto, un mapa que llenara el ancho estirando píxeles pasaría el
  // test de arriba — y se vería como una foto deformada.
  await page.setViewportSize({ width: 1900, height: 900 })
  await abrir(page)
  const ancha = await page.locator('#mapa').boundingBox()

  await page.setViewportSize({ width: 1000, height: 1000 })
  // El encuadre se recalcula con el evento `resize`, y el mapa se redibuja en el
  // cuadro siguiente: hay que esperar a que pase uno.
  await page.waitForTimeout(400)
  const cuadrada = await page.locator('#mapa').boundingBox()
  if (ancha === null || cuadrada === null) throw new Error('falta el mapa')

  expect(ancha.width / ancha.height).toBeGreaterThan(1.5)
  expect(cuadrada.width / cuadrada.height).toBeLessThan(1.3)
})

// ─── EL MAPA SE RECORTA, NO SE ESCALA ───────────────────────────────────────
//
// Este test decía «el zoom ×4 no desborda la página a lo ancho» y su mecanismo
// era el `max-width: 100%` del canvas. Hay que cambiarlo por dos motivos, y el
// segundo es el que importa:
//
//   1. **dejó de controlar.** El tablero es `overflow: hidden`, así que la
//      página no puede desbordar POR CONSTRUCCIÓN: la aserción quedó verde para
//      siempre y no puede volver a ponerse roja. Un guardián así es peor que
//      ninguno;
//   2. **el mecanismo que probaba estaba deformando el mapa.** `lienzo.ts` le
//      escribe al canvas su ancho y su alto en píxeles con `style`, o sea
//      INLINE, y una regla de hoja de estilos no le gana a un estilo inline: el
//      `height: auto` que acompañaba al `max-width` **nunca se aplicaba**. Con
//      lo cual, cuando el `max-width` mordía, el ancho se achicaba y el alto se
//      quedaba quieto. Medido en 420×900 antes de la reparación: **1,667 de
//      escala a lo ancho contra 2 a lo alto**.
//
// Así que lo que se afirma ahora es la promesa de verdad —una celda mide
// siempre `CELDA × zoom` en pantalla, y lo que no entra se recorta— que es
// además lo que pone rojo al defecto que el `max-width` causaba.
test('EL MAPA SE RECORTA Y NO SE ESCALA: una celda mide CELDA × zoom, en los cuatro', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await abrir(page)
  await page.locator('#ver-y-dibujar > summary').click()

  for (const zoom of [1, 2, 3, 4]) {
    await page.locator(`[data-zoom="${zoom}"]`).click()
    await page.waitForTimeout(250)
    const e = await escalaDelMapa(page)
    expect(e.x, `a ×${String(zoom)} el mapa se escala a lo ancho`).toBeCloseTo(zoom, 5)
    expect(e.y, `a ×${String(zoom)} el mapa se escala a lo alto`).toBeCloseTo(zoom, 5)
    expect(await desborda(page), `a ×${String(zoom)} la página desborda`).toBe(false)
  }

  // Y que el ×4 recorte de verdad, que es la mitad que hace interesante a la de
  // arriba: si el mapa entrara entero, «no se escala» sería gratis.
  const mapa = await page.locator('#mapa').boundingBox()
  if (mapa === null) throw new Error('falta el mapa')
  expect(mapa.width, 'a ×4 el mapa entra en la ventana: el recorte no se está ejercitando')
    .toBeGreaterThan(900)
})

// ─── LA VENTANA ANGOSTA, MIENTRAS EL CAJÓN NO EXISTE ────────────────────────
//
// Acá vivía «se apila, y lo que se usa queda ARRIBA del mapa», que era la
// reparación del `flex-wrap`: con la grilla de dos columnas, una ventana angosta
// mandaba el panel entero debajo del mapa y para escribir una orden había que
// scrollear.
//
// **Esa regla ya no existe y no vuelve.** Sin grilla no hay nada que apilar: el
// panel flota encima del mapa a cualquier ancho. Y el test seguía en VERDE
// después del cambio, por la razón equivocada —el panel arranca en `top: 0` y el
// mapa está centrado, así que `panel.y < mapa.y` da verdadero igual—, que es
// exactamente el guardián que se apaga en silencio.
//
// Lo que sí tiene que seguir valiendo en angosto son dos cosas, y las dos se
// afirman: que se pueda escribir sin scrollear, y que el mapa no se deforme —que
// es donde el defecto del `max-width` pegaba más fuerte, porque en 420 px el
// encuadre toca su piso de celdas—.
//
// La forma definitiva de esto es el CAJÓN del paso 7 (la charla se cierra y deja
// un tirador). Cuando exista, este test pasa a afirmar eso.
test('EN VENTANA ANGOSTA el mapa no se deforma, y se le puede escribir igual', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 })
  await abrir(page)

  const e = await escalaDelMapa(page)
  expect(e.x).toBeCloseTo(e.y, 5)

  await expect(page.locator('#orden')).toBeInViewport()
  expect(await desborda(page)).toBe(false)
})

test('lo que se toca una vez va plegado, y lo que se usa siempre no', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await abrir(page)

  // Lo de todos los días, a la vista sin abrir nada.
  //
  // El aliento se mira por su BARRA y no por su número, y el cambio es la
  // reparación: el número se fue a Diagnóstico junto con las otras cuatro filas
  // de la ficha vieja. Una barra dice «cómo viene» de un vistazo y un `953 / 1000`
  // hay que leerlo y dividirlo — que es la carga que este panel tenía de más.
  await expect(page.locator('#orden')).toBeVisible()
  await expect(page.locator('#aliento-caja')).toBeVisible()
  await expect(page.locator('[data-vel="0"]')).toBeVisible()
  await expect(page.locator('#hace')).toBeVisible()
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
