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

/**
 * ─── ABRIR UN MÓDULO DEL DOCK ───────────────────────────────────────────────
 *
 * Los `<details>` del panel viejo se convirtieron en los ocho módulos del modo
 * dev, así que `#catalogo > summary` ya no existe. Abrir uno son dos gestos: el
 * interruptor y su chip.
 *
 * Y los dos son IDEMPOTENTES acá, que es lo que hace que se pueda llamar sin
 * saber cómo quedó la pantalla: el modo dev se guarda en `localStorage`, así que
 * entre dos tests del mismo archivo puede venir prendido de antes. Un `click` a
 * ciegas lo APAGARÍA. Se mira el estado y se toca sólo si hace falta.
 */
async function abrirModulo(page: Page, id: string): Promise<void> {
  const sw = page.locator('#modo-dev')
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click()
  const chip = page.locator(`#chip-${id}`)
  if (!(await chip.evaluate((b) => b.classList.contains('on')))) await chip.click()
  await expect(page.locator(`[data-modulo="${id}"]`)).toBeVisible()
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
  await abrirModulo(page, 'ver')

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

// ─── CON EL MODO DEV APAGADO QUEDAN TRES COSAS ──────────────────────────────
//
// Es la primera de las tres decisiones que gobiernan el rediseño, y la única que
// se puede afirmar de un lado y del otro: apagado quedan el mapa, la charla y
// quién está del otro lado. Nada más.
//
// Esto reemplaza a «lo que se toca una vez va plegado». Aquel test cuidaba la
// misma idea con el mecanismo de entonces —los `<details>`— y hoy el mecanismo
// es un interruptor: lo que cambió no es qué se esconde, es que ahora se esconde
// TODO junto y con un solo gesto.
test('CON EL MODO DEV APAGADO quedan el mapa, la charla y las dos luces', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await abrir(page)
  // El modo dev se guarda entre sesiones, así que se apaga a mano: este test
  // afirma cómo se ve apagado y no puede depender de cómo quedó la anterior.
  const sw = page.locator('#modo-dev')
  if ((await sw.getAttribute('aria-checked')) === 'true') await sw.click()

  await expect(page.locator('#mapa')).toBeVisible()
  await expect(page.locator('#orden')).toBeVisible()
  await expect(page.locator('#lampara-codex')).toBeVisible()
  // Y las dos cosas de la criatura que se miran todo el tiempo, que no son un
  // cuarto módulo: son ELLA. El aliento se mira por su BARRA y no por su
  // número — un `953 / 1000` hay que leerlo y dividirlo.
  await expect(page.locator('#aliento-caja')).toBeVisible()
  await expect(page.locator('[data-vel="0"]')).toBeVisible()
  await expect(page.locator('#hace')).toBeVisible()

  // Y NADA del dock: ni el dock, ni sus botones, ni sus números.
  await expect(page.locator('#dock')).toBeHidden()
  await expect(page.locator('#olvidar')).not.toBeVisible()
  await expect(page.locator('[data-zoom="4"]')).not.toBeVisible()
  await expect(page.locator('#a-la-vista')).not.toBeVisible()
})

// ─── EL TOPE DE CUATRO, Y QUE EL QUINTO CIERRE EL MÁS VIEJO ─────────────────
//
// El tope no es una preferencia: con cinco abiertos cada panel mide 180 px y ahí
// no entra una fila de datos sin envolverse, o sea que lo que se gana en
// cantidad se pierde en poder leer alguno.
//
// Y que el quinto CIERRE en vez de rebotar es lo que hay que afirmar, porque las
// dos conductas se ven igual desde afuera hasta que contás: rebotar deja cuatro
// y cerrar el más viejo también.
test('EL DOCK ABRE HASTA CUATRO, y el quinto cierra el más viejo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await abrir(page)

  // Se arranca de cero y no de lo que haya guardado: si no, «abrí cuatro» puede
  // ser «abrí el quinto» sin que el test se entere.
  const sw = page.locator('#modo-dev')
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click()
  for (const id of ['diagnostico', 'aliento', 'plan', 'catalogo', 'ver', 'partida', 'journal', 'inspector']) {
    const chip = page.locator(`#chip-${id}`)
    if (await chip.evaluate((b) => b.classList.contains('on'))) await chip.click()
  }
  await expect(page.locator('#sin-modulos')).toBeVisible()

  const abiertos = page.locator('#dock .panel:visible')
  for (const id of ['diagnostico', 'aliento', 'plan', 'catalogo']) {
    await page.locator(`#chip-${id}`).click()
  }
  await expect(abiertos).toHaveCount(4)
  await expect(page.locator('#cuantos-modulos')).toContainText('4 de 4')

  // El quinto: siguen siendo cuatro, y el que se fue es el PRIMERO que se abrió.
  await page.locator('#chip-ver').click()
  await expect(abiertos).toHaveCount(4)
  await expect(page.locator('[data-modulo="diagnostico"]')).toBeHidden()
  await expect(page.locator('[data-modulo="ver"]')).toBeVisible()

  // Y el chip también apaga, que es la otra mitad de lo que el renglón promete.
  await page.locator('#chip-ver').click()
  await expect(page.locator('[data-modulo="ver"]')).toBeHidden()
  await expect(abiertos).toHaveCount(3)
})

// ─── Y EL DOCK SE ACUERDA ───────────────────────────────────────────────────
//
// Quien prende el modo dev lo prende porque está mirando algo, y recargar es
// justo lo que hace todo el tiempo. Sin esto hay que rearmar la pantalla en cada
// vuelta, que es la carga que este rediseño vino a sacar.
test('el modo dev y sus módulos vuelven después de recargar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await abrir(page)
  await abrirModulo(page, 'journal')

  await page.reload()
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
  await expect(page.locator('#modo-dev')).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('[data-modulo="journal"]')).toBeVisible()
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

  // Vive en el dock, como todo lo que se consulta y no se usa a cada rato.
  await expect(page.locator('#lista-catalogo')).not.toBeVisible()
  await abrirModulo(page, 'catalogo')

  const filas = page.locator('#lista-catalogo .fila')
  await expect(filas.first()).toBeVisible()
  // El catálogo core del planificador tiene trece filas y varias establecen lo
  // mismo, así que lo que se afirma es que hay VARIAS y no un número exacto: el
  // día que alguien agregue un esquema, este spec no tiene por qué enterarse.
  expect(await filas.count()).toBeGreaterThan(3)

  // Y dice las metas en castellano, no en firmas. `emitsPower>0` es «fuego».
  await expect(page.locator('#lista-catalogo')).toContainText('fuego')
})
