// ─── EL JUEGO ABRE CON EL MUNDO ANDANDO ─────────────────────────────────────
//
// Durante un tiempo abrió en pausa, y el motivo era bueno: el guardado
// automático escribe cada cinco segundos, así que una pestaña olvidada no cuesta
// una sesión de mirar, cuesta lo que quedó escrito. Se volvió atrás porque el
// otro costo se paga antes y lo paga todo el mundo: un mapa quieto al abrir se
// lee como un juego roto, y «la criatura no hace nada» es la peor primera
// impresión que este proyecto puede dar.
//
// ─── Y ESTE ARCHIVO EXISTE POR LOS OTROS OCHO ──────────────────────────────
//
// Ocho specs abren por `?vel=0` porque miden con el mundo quieto. Si esa puerta
// dejara de andar, no fallarían acá: fallarían allá, de a uno, con diferencias
// de un par de celdas que parecen otra cosa. Acá se afirma la puerta, sola y en
// un archivo que se lee en treinta segundos.

import { expect, test, type Page } from '@playwright/test'

async function tick(page: Page): Promise<number> {
  return Number(await page.locator('#tick').textContent())
}

/** Qué botón de velocidad está marcado. Es lo que el jugador ve encendido. */
async function marcado(page: Page): Promise<string> {
  return page.locator('[data-vel].on').first().getAttribute('data-vel') as Promise<string>
}

test('ABRE CORRIENDO: sin tocar nada, el mundo avanza y ×1 está marcado', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })

  // No se toca un solo control: el tick tiene que moverse por su cuenta. Se
  // espera al movimiento en vez de dormir un rato fijo, porque a cuántos cuadros
  // por segundo va esta máquina no lo sabe nadie.
  const desde = await tick(page)
  await expect.poll(() => tick(page), { timeout: 20_000 }).toBeGreaterThan(desde)

  // Y la barra lo dice. Un mundo que corre con «pausa» encendido es peor que
  // cualquiera de los dos por separado: enseña a no leer la barra.
  expect(await marcado(page)).toBe('1')
})

test('`?vel=0` ABRE QUIETO, que es de lo que viven los specs que miden en pausa', async ({ page }) => {
  await page.goto('/?vel=0')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
  expect(await marcado(page)).toBe('0')

  // QUIETO DE VERDAD, no «marcado como quieto»: se mira el tick dos veces con
  // cuadros de por medio. Sin esta espera, un `velocidad = 0` que igual avanzara
  // pasaría el test, y el bug saldría a la luz en los otros ocho archivos.
  const desde = await tick(page)
  await page.waitForTimeout(1_500)
  expect(await tick(page), 'la pausa por URL no paró el mundo').toBe(desde)
})

test('UNA VELOCIDAD QUE NO EXISTE SE IGNORA, y arranca en ×1 como siempre', async ({ page }) => {
  // `?vel=` es texto que cualquiera escribe, igual que el `localStorage` del
  // dock. Lo que no se reconoce se descarta en silencio y vale el arranque de
  // fábrica: entre romper y seguir andando, el juego sigue andando.
  //
  // El caso que se cuida de verdad es `?vel=` vacío: `Number('')` es 0, o sea
  // una velocidad VÁLIDA, así que un chequeo hecho sobre el número y no sobre el
  // texto abriría en pausa a quien nunca la pidió.
  await page.goto('/?vel=&otra=cosa')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
  expect(await marcado(page)).toBe('1')
})
