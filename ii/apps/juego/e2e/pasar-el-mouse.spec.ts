// ─── PASARLE EL MOUSE POR ARRIBA, EN UN NAVEGADOR DE VERDAD ─────────────────
//
// Lo que decide qué dice el cartel ya está probado en `tests/lo-senalado.test.ts`
// y es más barato ahí. Lo que sólo se puede afirmar acá son tres cosas, y las
// tres son cable:
//
//   1. que un `mousemove` de verdad —no un evento fabricado— lo hace aparecer;
//   2. que dice **lo mismo** que el panel para la misma celda. Ésa es la razón de
//      ser de `lo-senalado.ts`: dos vistas, una sola cuenta. Si alguien mañana
//      copia la lógica en el hover, este test se pone rojo;
//   3. que sobre una celda vacía NO aparece. Es una decisión, no una omisión: un
//      cartel que parpadee en las tres cuartas partes del mapa lo vuelve ruido.
//
// El mundo está EN PAUSA todo el spec —el juego arranca así— y eso es parte del
// método: con el mundo quieto, la celda que se señala sigue siendo la misma entre
// el hover y el click, y la comparación significa algo.

import { expect, test, type Page } from '@playwright/test'

const CELDAS = 15

async function abrir(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
}

interface Caja {
  x: number
  y: number
  width: number
  height: number
}

async function cajaDelMapa(page: Page): Promise<Caja> {
  const caja = await page.locator('#mapa').boundingBox()
  if (caja === null) throw new Error('el mapa no tiene caja')
  return caja
}

/** El centro en pantalla de la celda (col, fila) del encuadre. */
function centroDe(caja: Caja, col: number, fila: number): { x: number; y: number } {
  const paso = caja.width / CELDAS
  return { x: caja.x + (col + 0.5) * paso, y: caja.y + (fila + 0.5) * paso }
}

/**
 * Recorre el encuadre hasta encontrar una celda con algo, y devuelve dónde está.
 *
 * Barre en vez de usar una coordenada fija porque **lo que hay alrededor lo
 * decide la semilla**: clavar una celda sería escribir en el test una respuesta
 * que el mundo no prometió, y el día que la semilla cambie fallaría sin que nada
 * esté roto.
 */
async function buscarAlgo(page: Page): Promise<{ x: number; y: number }> {
  const caja = await cajaDelMapa(page)
  const cartel = page.locator('#cartel')
  for (let fila = 0; fila < CELDAS; fila++) {
    for (let col = 0; col < CELDAS; col++) {
      const donde = centroDe(caja, col, fila)
      await page.mouse.move(donde.x, donde.y)
      if (await cartel.isVisible()) return donde
    }
  }
  throw new Error('el encuadre no tiene un solo cuerpo: el test no probaría nada')
}

test('el cartel aparece al pasar el mouse, sin clickear nada', async ({ page }) => {
  await abrir(page)
  await buscarAlgo(page)

  const cartel = page.locator('#cartel')
  await expect(cartel).toBeVisible()
  // Con un dibujo adentro: el glifo es la mitad de la respuesta a «qué es esto»,
  // y es el MISMO `glifoDe` que pinta el mapa (caso 7 del 12C).
  await expect(cartel.locator('canvas.glifo')).toHaveCount(1)
  await expect(cartel.locator('b')).not.toBeEmpty()
})

test('DICE LO MISMO QUE EL PANEL para la misma celda', async ({ page }) => {
  await abrir(page)
  const donde = await buscarAlgo(page)

  const delCartel = await page.locator('#cartel b').textContent()
  // El click va exactamente al mismo punto donde está el mouse.
  await page.mouse.click(donde.x, donde.y)
  await expect(page.locator('#mirado-que')).toHaveText(delCartel ?? '')
})

test('en una celda vacía no aparece nada, y salir del mapa lo apaga', async ({ page }) => {
  await abrir(page)
  const donde = await buscarAlgo(page)
  const caja = await cajaDelMapa(page)
  const cartel = page.locator('#cartel')

  // Una celda vacía: se busca igual que la llena, por la misma razón.
  let vacia = false
  for (let fila = 0; fila < CELDAS && !vacia; fila++) {
    for (let col = 0; col < CELDAS && !vacia; col++) {
      await page.mouse.move(centroDe(caja, col, fila).x, centroDe(caja, col, fila).y)
      vacia = !(await cartel.isVisible())
    }
  }
  expect(vacia, 'el encuadre está lleno en las 225 celdas: no hay caso vacío que probar').toBe(true)

  // Y con el cartel prendido, irse del mapa lo apaga. Sin esto queda un cartel
  // flotando sobre el panel, tapando lo que se quería leer.
  await page.mouse.move(donde.x, donde.y)
  await expect(cartel).toBeVisible()
  await page.mouse.move(donde.x, donde.y - caja.height)
  await expect(cartel).toBeHidden()
  await expect(page.locator('#senal')).toBeHidden()
})

test('el recuadro cae SOBRE la celda que estás señalando', async ({ page }) => {
  await abrir(page)
  const donde = await buscarAlgo(page)

  // El recuadro y el puntero tienen que coincidir: si la cuenta de `ubicarLaSenal`
  // se desfasa —pasa con el zoom, que achica el canvas por CSS— el jugador ve
  // marcada una celda y el cartel describe otra, que es peor que no marcar nada.
  const marca = await page.locator('#senal').boundingBox()
  if (marca === null) throw new Error('el recuadro no tiene caja')
  expect(Math.abs(marca.x + marca.width / 2 - donde.x)).toBeLessThan(marca.width)
  expect(Math.abs(marca.y + marca.height / 2 - donde.y)).toBeLessThan(marca.height)
})
