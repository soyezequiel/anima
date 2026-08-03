// ─── C3, C5 y C6 POR EL NAVEGADOR ──────────────────────────────────────────
//
// La puerta de salida del tramo pide E2E de C1 a C6, y hasta acá lo único que
// pasaba por una pestaña de verdad era la charla del C1. Los otros tres estaban
// afirmados en fixtures de vitest que corren contra la partida de verdad —así que
// no eran mentira— pero **no ejercitan el camino entero**: IndexedDB, el arranque,
// el repintado, y el bucle de cuadros que decide cuándo pasa cada tick.
//
// ─── LOS TRES VIVEN EN UN ARCHIVO, y conviene decir por qué ────────────────
//
// El repo escribe un archivo por afirmación, y acá hay tres. Lo que las junta no
// es el tema: es que las tres piden **una partida andando durante cientos de
// ticks**, y arrancar tres navegadores para eso cuesta más que lo que compra la
// separación. Cada `test` sigue siendo independiente y afirma una sola cosa.
//
// ─── LO QUE NO SE PUEDE MIRAR DESDE ACÁ, dicho para que nadie lo busque ────
//
//   · **la pausa por hambre** (C5). Pide poner el tanque en 60 a mitad de camino
//     y la UI no tiene con qué: es una escena que se arma tocando el mundo, y
//     eso vive en `el-hambre-interrumpe.test.ts`. Lo que sí se mira acá es la
//     pausa que el cuidador pide, que es la mitad que entra por la charla;
//   · **el veredicto del juez** (C6). La fragua de verdad no está enchufada en la
//     app —pide un compilador de TypeScript en el navegador y una credencial— así
//     que lo que se afirma acá es que la criatura **pide**, que es la mitad que
//     el navegador puede ver. El portón y la promoción están en su fixture.

import { expect, test, type Page } from '@playwright/test'

async function abrir(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
}

async function decir(page: Page, texto: string): Promise<void> {
  await page.locator('#orden').fill(texto)
  await page.locator('#orden').press('Enter')
}

/** Lo que dice la charla entera, en una sola cadena. Es lo que se busca adentro. */
async function loDicho(page: Page): Promise<string> {
  return (await page.locator('#registro').textContent()) ?? ''
}

/** Espera a que la charla diga algo que matchee, con el mundo corriendo. */
async function hastaQueDiga(page: Page, re: RegExp, tope = 60_000): Promise<void> {
  await expect
    .poll(async () => re.test(await loDicho(page)), { timeout: tope, intervals: [250] })
    .toBe(true)
}

async function correrA(page: Page, vel: '0' | '1' | '4' | '16'): Promise<void> {
  await page.locator(`[data-vel="${vel}"]`).click()
}

/**
 * ABRE EL MÓDULO DEL PLAN, que es donde vive «persigue».
 *
 * El modo dev se guarda en `localStorage`, así que puede venir prendido de otro
 * test: se mira el estado y se toca sólo si hace falta. Un `click` a ciegas lo
 * apagaría. Es el mismo cuidado que `la-distribucion.spec.ts`.
 */
async function abrirElPlan(page: Page): Promise<void> {
  const sw = page.locator('#modo-dev')
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click()
  const chip = page.locator('#chip-plan')
  if (!(await chip.evaluate((b) => b.classList.contains('on')))) await chip.click()
  await expect(page.locator('[data-modulo="plan"]')).toBeVisible()
}

test('C3 · el pedido de dos partes vuelve por donde iba, y no repite la primera', async ({
  page,
}) => {
  await abrir(page)
  // Dos partes, y la primera se cumple rápido: así la recarga cae con una hecha.
  await decir(page, 'juntá dos troncos y hacé fuego')

  await correrA(page, '16')
  // La segunda cláusula en curso es la señal de que la primera ya está probada.
  await hastaQueDiga(page, /\(2 de 2\)/)
  // Y hay que esperar a que eso se GUARDE, que es lo que la recarga va a leer.
  await expect(page.locator('#guardado')).toHaveText(/^tick \d+$/, { timeout: 40_000 })
  await correrA(page, '0')

  const antes = await loDicho(page)
  expect(antes, 'la primera cláusula nunca se puso en curso').toContain('(1 de 2)')

  // ─── Y ACÁ SE CIERRA LA PESTAÑA ─────────────────────────────────────────
  await abrir(page)
  await correrA(page, '16')
  // Se le da tiempo de sobra para que, si fuera a repetir, repita.
  await page.waitForTimeout(4_000)
  await correrA(page, '0')

  const despues = await loDicho(page)
  // LO QUE SE AFIRMA: el «1 de 2» que aparece es el de antes de la recarga y no
  // uno nuevo. Se cuenta, porque «aparece» lo cumpliría el viejo también.
  const cuantos = (s: string): number => (s.match(/\(1 de 2\)/g) ?? []).length
  expect(cuantos(despues), 'volvió a arrancar por la primera parte').toBe(cuantos(antes))
  expect(despues, 'perdió el pedido al recargar').toContain('(2 de 2)')
})

test('C5 · «pará eso» para de verdad, y «seguí» retoma', async ({ page }) => {
  await abrir(page)
  await abrirElPlan(page)
  await decir(page, 'juntá dos troncos y hacé fuego')
  await correrA(page, '16')
  // Que el panel diga «tuya» es la precondición: sin eso, «dejó de decir tuya»
  // no probaría nada.
  await expect(page.locator('#persigue')).toContainText('(tuya)', { timeout: 20_000 })
  // Y se pausa el MUNDO antes de pausar el encargo, que son dos cosas distintas:
  // con el mundo a ×16 la criatura sigue narrando lo que hace, así que «la última
  // línea» ya no sería el acuse cuando se lo lea. Se aprendió corriéndolo: la
  // última decía «va por piedra».
  await correrA(page, '0')

  // ─── LA PAUSA ───────────────────────────────────────────────────────────
  await decir(page, 'pará eso')
  // Se espera y no se lee de una: la charla se repinta en el bucle de cuadros,
  // no adentro del `submit`. Leerla en la misma linea que el Enter mide el DOM
  // de antes del pedido.
  await hastaQueDiga(page, /dale, lo dejo/, 15_000)

  // Y para de verdad: el panel deja de decir que la meta es tuya. Es el
  // observable de que el drive se soltó, y no un rótulo en la charla — el mismo
  // que existe desde el Hito 12 para distinguir obedecer de vivir.
  await expect(page.locator('#persigue')).not.toContainText('(tuya)', { timeout: 20_000 })

  // ─── LA VUELTA ──────────────────────────────────────────────────────────
  await decir(page, 'seguí')
  await hastaQueDiga(page, /dale, sigo/, 15_000)
  // El drive vuelve a ponerse en la frontera del tick, así que hace falta que
  // corra alguno: reanudar es una decisión del encargo y la toma el mundo.
  await correrA(page, '16')
  await expect(page.locator('#persigue')).toContainText('(tuya)', { timeout: 20_000 })
  await correrA(page, '0')
})

test('C6 · cuando el catálogo no le alcanza, lo dice', async ({ page }) => {
  await abrir(page)
  // Sin pedirle nada: la costura se dispara sola, y eso es parte de lo que se
  // afirma. Medido en el fixture: pide alrededor del tick 90, viviendo sola.
  await correrA(page, '16')
  await hastaQueDiga(page, /no sé cómo/, 90_000)
  await correrA(page, '0')

  // Y lo que le falta es COCINAR, que es lo que la medición encontró y lo que
  // hace que esta línea sea información y no un cartel de error.
  expect(await loDicho(page)).toMatch(/no sé cómo .*(carnoso|comida|calor)/)
})
