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
// El mundo está EN PAUSA todo el spec, y eso es parte del método: con el mundo
// quieto, la celda que se señala sigue siendo la misma entre el hover y el
// click, y la comparación significa algo.
//
// La pausa se PIDE en la URL. El juego arranca corriendo en ×1, y apretar el
// botón de pausa llega tarde: entre el primer cuadro y el click ya hubo ticks.
// `?vel=0` es la única forma de abrir quieto de verdad.

import { expect, test, type Page } from '@playwright/test'

/** Lo que mide una celda adentro del canvas. Es la `CELDA` de `@anima/dibujo`. */
const CELDA = 28

async function abrir(page: Page): Promise<void> {
  await page.goto('/?vel=0')
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

/**
 * ─── DÓNDE SE PUEDE BARRER, Y POR QUÉ SE CALCULA EN VEZ DE ESCRIBIRSE ───────
 *
 * Acá había `const CELDAS = 15`, escrito cuando el encuadre era un cuadrado fijo
 * de quince por quince, y el paso de las DOS dimensiones salía de
 * `caja.width / 15`. Sobrevivió al encuadre variable por casualidad —mientras el
 * mapa fue casi cuadrado, quince pasos de ancho caían más o menos adentro— y se
 * rompió del todo cuando el mapa pasó a ocupar la ventana: con una caja de
 * 1232×672, el paso da 82 px y la fila 15 queda en `y = 1230`, o sea **medio
 * metro debajo del mapa**. El barrido no encontraba nada y el error decía «el
 * encuadre no tiene un solo cuerpo», que es exactamente la clase de mentira que
 * un número escrito a mano produce: el mapa estaba lleno.
 *
 * El dato está en el canvas y no hay que suponerlo — adentro mide un píxel por
 * píxel del mapa y cada celda son `CELDA` de ésos. Es la misma reparación que
 * `la-vertical.spec.ts` ya se había hecho para su punto 3, y que este archivo no
 * recibió.
 *
 * ─── Y SE BARRE SÓLO LO DESTAPADO ──────────────────────────────────────────
 *
 * Con el mapa como pantalla, el panel FLOTA encima de su borde derecho. Un
 * `mousemove` ahí no llega al canvas —el cartel no aparece— y un click aterriza
 * en el panel. Las dos cosas están bien y son del diseño: lo que está tapado no
 * se ve, así que tampoco se señala. El barrido se corta donde empieza el panel
 * para medir lo que se puede tocar, no para esquivar un problema.
 */
interface Grilla {
  readonly caja: Caja
  readonly columnas: number
  readonly filas: number
  /** El paso en pantalla, que es `CELDA × zoom` y puede no ser entero. */
  readonly paso: number
  /** La primera columna que el panel tapa. */
  readonly hasta: number
}

async function grillaDelMapa(page: Page): Promise<Grilla> {
  const caja = await cajaDelMapa(page)
  const buffer = await page
    .locator('#mapa')
    .evaluate((c: HTMLCanvasElement) => ({ ancho: c.width, alto: c.height }))
  const columnas = Math.round(buffer.ancho / CELDA)
  const filas = Math.round(buffer.alto / CELDA)
  const paso = caja.width / columnas

  const panel = await page.locator('aside').boundingBox()
  const tapaDesde = panel === null ? Infinity : panel.x
  const hasta = Math.min(columnas, Math.max(1, Math.floor((tapaDesde - caja.x) / paso)))
  return { caja, columnas, filas, paso, hasta }
}

/** El centro en pantalla de la celda (col, fila) del encuadre. */
function centroDe(g: Grilla, col: number, fila: number): { x: number; y: number } {
  return { x: g.caja.x + (col + 0.5) * g.paso, y: g.caja.y + (fila + 0.5) * g.paso }
}

/**
 * Recorre el encuadre hasta encontrar una celda con algo, y devuelve dónde está.
 *
 * Barre en vez de usar una coordenada fija porque **lo que hay alrededor lo
 * decide la semilla**: clavar una celda sería escribir en el test una respuesta
 * que el mundo no prometió, y el día que la semilla cambie fallaría sin que nada
 * esté roto.
 */
async function buscarAlgo(page: Page, g: Grilla): Promise<{ x: number; y: number }> {
  const cartel = page.locator('#cartel')
  for (let fila = 0; fila < g.filas; fila++) {
    for (let col = 0; col < g.hasta; col++) {
      const donde = centroDe(g, col, fila)
      await page.mouse.move(donde.x, donde.y)
      if (await cartel.isVisible()) return donde
    }
  }
  throw new Error('el encuadre no tiene un solo cuerpo destapado: el test no probaría nada')
}

test('el cartel aparece al pasar el mouse, sin clickear nada', async ({ page }) => {
  await abrir(page)
  await buscarAlgo(page, await grillaDelMapa(page))

  const cartel = page.locator('#cartel')
  await expect(cartel).toBeVisible()
  // Con un dibujo adentro: el glifo es la mitad de la respuesta a «qué es esto»,
  // y es el MISMO `glifoDe` que pinta el mapa (caso 7 del 12C).
  await expect(cartel.locator('canvas.glifo')).toHaveCount(1)
  await expect(cartel.locator('b')).not.toBeEmpty()
})

// ─── DICE LO MISMO QUE EL GLOBO, y ahora eso importa MÁS ──────────────────
//
// Esto comparaba el cartel del hover contra el panel de la derecha. Hoy lo
// compara contra el GLOBO del click, y la razón de ser del test no cambió sino
// que se puso más filosa: los dos aparecen en la MISMA zona de la pantalla, a
// catorce píxeles uno del otro, así que el día que diverjan se va a ver como que
// el juego se contradice a sí mismo en el mismo renglón.
test('DICE LO MISMO QUE EL GLOBO para la misma celda', async ({ page }) => {
  await abrir(page)
  const donde = await buscarAlgo(page, await grillaDelMapa(page))

  const delCartel = await page.locator('#cartel b').textContent()
  // El click va exactamente al mismo punto donde está el mouse.
  await page.mouse.click(donde.x, donde.y)
  await expect(page.locator('#globo-que')).toHaveText(delCartel ?? '')

  // ─── Y EL HOVER SE CALLA SOBRE LA CELDA QUE YA TIENE EL GLOBO ──────────
  //
  // El mouse quedó donde estaba, o sea sobre la celda anclada. Si el cartel
  // siguiera prendido, los dos dirían lo mismo apilados a catorce píxeles. El
  // hover contesta lo que TODAVÍA no preguntaste, y acá ya preguntaste.
  await expect(page.locator('#cartel')).toBeHidden()
})

test('en una celda vacía no aparece nada, y salir del mapa lo apaga', async ({ page }) => {
  await abrir(page)
  const g = await grillaDelMapa(page)
  const donde = await buscarAlgo(page, g)
  const cartel = page.locator('#cartel')

  // Una celda vacía: se busca igual que la llena, por la misma razón.
  let vacia = false
  for (let fila = 0; fila < g.filas && !vacia; fila++) {
    for (let col = 0; col < g.hasta && !vacia; col++) {
      const p = centroDe(g, col, fila)
      await page.mouse.move(p.x, p.y)
      vacia = !(await cartel.isVisible())
    }
  }
  expect(
    vacia,
    `el encuadre está lleno en las ${String(g.filas * g.hasta)} celdas destapadas: no hay caso vacío que probar`,
  ).toBe(true)

  // Y con el cartel prendido, irse del mapa lo apaga. Sin esto queda un cartel
  // flotando sobre el panel, tapando lo que se quería leer.
  await page.mouse.move(donde.x, donde.y)
  await expect(cartel).toBeVisible()
  await page.mouse.move(donde.x, donde.y - g.caja.height)
  await expect(cartel).toBeHidden()
  await expect(page.locator('#senal')).toBeHidden()
})

test('el recuadro cae SOBRE la celda que estás señalando', async ({ page }) => {
  await abrir(page)
  const donde = await buscarAlgo(page, await grillaDelMapa(page))

  // El recuadro y el puntero tienen que coincidir: si la cuenta de `ubicarLaSenal`
  // se desfasa —pasa con el zoom, que achica el canvas por CSS— el jugador ve
  // marcada una celda y el cartel describe otra, que es peor que no marcar nada.
  const marca = await page.locator('#senal').boundingBox()
  if (marca === null) throw new Error('el recuadro no tiene caja')
  expect(Math.abs(marca.x + marca.width / 2 - donde.x)).toBeLessThan(marca.width)
  expect(Math.abs(marca.y + marca.height / 2 - donde.y)).toBeLessThan(marca.height)
})
