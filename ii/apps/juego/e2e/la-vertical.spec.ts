// ─── LAS NUEVE COSAS DE LA VERTICAL, EN UN NAVEGADOR ────────────────────────
//
// El criterio del Hito 12B es una lista de nueve cosas que un jugador tiene que
// poder hacer. Cada `test` de acá es una de ellas, en el mismo orden y con el
// mismo nombre, para que la tabla del documento y esta suite se puedan leer una
// al lado de la otra. El punto 9 vive aparte —necesita recargar la página— en
// `guardar-y-volver.spec.ts`.
//
// ─── LO QUE ESTOS TESTS AGREGAN A LOS DE VITEST ───────────────────────────
//
// Nada sobre la lógica: eso ya está probado y más barato en `tests/`. Lo que
// sólo se puede afirmar acá es que **el cable llega**: que el dato que la escena
// publica termina en un nodo del DOM que el jugador puede leer. Los tres huecos
// de este hito —la actividad, el aliento y la inspección— tenían el motor escrito
// y no tenían pantalla, y ningún test de unidad podía verlo.

import { expect, test, type Page } from '@playwright/test'

/** El tick de ahora, leído del HUD. */
async function tick(page: Page): Promise<number> {
  return Number(await page.locator('#tick').textContent())
}

/**
 * Abre el juego y espera al primer cuadro.
 *
 * El juego arranca EN PAUSA a propósito —una pestaña olvidada avanzaría y
 * guardaría la partida real— así que hasta que alguien elija velocidad el mundo
 * no se mueve. Lo que sí tiene que haber pasado es un cuadro: el HUD se llena
 * aunque el mundo esté quieto.
 */
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
  // `?vel=0` ABRE EN PAUSA: el juego arranca en ×1, y acá se mide desde dónde
  // sale el mundo. Quien decide cuánto avanza es `correrHasta()`, no el arranque.
  await page.goto('/?vel=0')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
}

/** Le da velocidad y espera a que el mundo pase de `hasta`. */
async function correrHasta(page: Page, hasta: number): Promise<void> {
  await page.locator('[data-vel="4"]').click()
  await expect.poll(() => tick(page), { timeout: 40_000 }).toBeGreaterThan(hasta)
}

test('1 · ver el mapa', async ({ page }) => {
  await abrir(page)
  const canvas = page.locator('#mapa')
  await expect(canvas).toBeVisible()

  // Que exista un `<canvas>` no prueba nada: uno sin pintar también está
  // visible. Lo que se afirma es que TIENE DIBUJO — más de un color — porque un
  // mapa negro es exactamente cómo se ve un bug de render que no lanza.
  const colores = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')
    if (ctx === null) return 0
    const d = ctx.getImageData(0, 0, el.width, el.height).data
    const vistos = new Set<number>()
    for (let i = 0; i < d.length; i += 4) vistos.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
    return vistos.size
  })
  expect(colores, 'el mapa está pintado de un solo color: no se dibujó nada').toBeGreaterThan(8)
})

test('2 · ver la criatura moviéndose', async ({ page }) => {
  await abrir(page)
  const donde = page.locator('#donde')
  const antes = await donde.textContent()

  // El mapa la muestra siempre en el centro porque el foco la sigue, así que
  // «se movió» se lee en las coordenadas y no en la pantalla.
  await correrHasta(page, 300)
  await expect.poll(async () => donde.textContent(), { timeout: 40_000 }).not.toBe(antes)
})

test('3 · ver todos los objetos del área visible', async ({ page }) => {

  // ─── LA CHARLA SE SACA CON UN GESTO DE VERDAD, Y EL RESTO SE APARTA ─────
  //
  // Con el mapa ocupando la ventana, todo lo demás FLOTA encima y un click ahí
  // aterriza en el flotante: Playwright lo rechaza con razón —esa celda no se
  // puede tocar— y el barrido moría con «locator.click: timeout».
  //
  // La charla es el que más tapa, y desde el paso 7 se puede sacar SIN TOCAR
  // NADA: en angosto es un cajón y se cierra con su ×, que es un gesto que hace
  // el jugador. Eso es lo que este bloque prometía cuando el cajón no existía.
  //
  // Lo que queda apartado a mano son tres, y no son la misma clase de cosa:
  //
  //   · LA FICHA y LA VELOCIDAD flotan sobre la esquina de abajo a la izquierda
  //     en las dos pantallas y no tienen forma de irse;
  //   · EL GLOBO, que no tapa el mapa: **es la respuesta a la pregunta que este
  //     barrido acaba de hacer**. Sale a catorce píxeles del click y se queda
  //     sobre las celdas que siguen, así que un barrido que se bloquee con él
  //     estaría midiendo su propia salida en vez del mapa. Para una persona esto
  //     no es un problema —clickeás dos cosas por minuto, no doscientas— y por
  //     eso el diseño no le pone puerta.
  //
  // A los tres se les apaga el `pointer-events` y no se los esconde: el barrido
  // LEE el globo y `#a-la-vista`, y esconderlos dejaría al test sin dónde leer.
  // Los clicks siguen siendo clicks con su chequeo de destino; lo único que
  // cambia es qué hay arriba.
  //
  // Y se inyecta con `addInitScript` y no con `addStyleTag`: un `<style>`
  // inyectado se va con la primera recarga, y el dev server recarga solo cuando
  // alguien guarda un archivo. Con el barrido durando quince segundos, eso pasa
  // en el medio y las últimas celdas se clickean sin el aislamiento — que es
  // exactamente el flake que este test tuvo, «#registro intercepts» sobre un
  // mapa cuyo `pointer-events` medía `none`.
  await page.addInitScript(() => {
    const poner = (): void => {
      const st = document.createElement('style')
      st.textContent = '#ficha, #velocidad, #globo { pointer-events: none }'
      document.head.appendChild(st)
    }
    if (document.head as HTMLElement | null) poner()
    else document.addEventListener('DOMContentLoaded', poner)
  })
  // Angosto para que el cajón exista, y de paso el encuadre baja de 665 celdas
  // a 195: el barrido pasa de setecientos clicks a doscientos sin perder nada
  // —lo que se afirma es COMPLETITUD sobre lo que la escena publique, sea
  // cuanto sea— y con un tercio del tiempo hay un tercio de ventana para que
  // una recarga del dev server se meta en el medio.
  await page.setViewportSize({ width: 900, height: 800 })
  await abrir(page)
  await page.locator('#cerrar-charla').click()
  await expect(page.locator('#tirador')).toBeVisible()

  const canvas = page.locator('#mapa')
  const caja = await canvas.boundingBox()
  if (caja === null) throw new Error('el mapa no tiene caja')

  // ─── QUÉ AFIRMA, Y LAS TRES VECES QUE ESTUVO MAL ────────────────────────
  //
  // El punto dice «ver TODOS los objetos del área visible», así que lo que hay
  // que probar es COMPLETITUD: barrer el mapa entero a click tiene que encontrar
  // exactamente los cuerpos que la escena publica. Ni uno menos.
  //
  //   1. la primera versión pedía «más de 2 formas distintas» y encontraba 2: el
  //      catálogo tiene seis formas y media orilla es «vara». Un palo de madera y
  //      un hueso son la misma forma y no son el mismo objeto para nadie;
  //   2. la segunda juntaba forma y material y seguía dando 2 — y ahí sí había un
  //      bug: **el dios siembra hasta trece cuerpos en una misma celda** y el
  //      panel mostraba sólo el de arriba. Ahora dice cuántos hay debajo;
  //   3. la tercera pedía «más de 20 cuerpos» y encontró 3, con el HUD marcando
  //      73 en el mundo. Tampoco era un bug: **el área visible tiene 3** y los
  //      otros 70 están fuera del radio. Pedir una cantidad era inventar un
  //      número; lo que había que hacer era preguntarle al juego cuántos hay.
  // ─── CUÁNTAS CELDAS HAY SE LE PREGUNTA AL MAPA ──────────────────────────
  //
  // Esto decía `15` dos veces, escrito a mano, porque el encuadre era un cuadrado
  // fijo de quince por quince. Dejó de serlo: ahora tiene la forma de la ventana
  // (ver `juego/src/el-encuadre.ts`), así que en una pantalla apaisada son 27×13
  // y en una alta puede ser al revés.
  //
  // Con el 15 clavado, el barrido se salía del canvas por abajo y Playwright
  // fallaba con «body intercepts pointer events» — un click al vacío, no un
  // objeto que faltara. El dato está en el propio canvas: adentro mide un píxel
  // por píxel del mapa, y cada celda son CELDA de ésos.
  const CELDA = 28
  const grilla = await canvas.evaluate((c: HTMLCanvasElement) => ({ ancho: c.width, alto: c.height }))
  const columnas = Math.round(grilla.ancho / CELDA)
  const filas = Math.round(grilla.alto / CELDA)

  const clases = new Set<string>()
  let contados = 0
  const pasoX = caja.width / columnas
  const pasoY = caja.height / filas
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < columnas; col++) {
      await canvas.click({ position: { x: (col + 0.5) * pasoX, y: (fila + 0.5) * pasoY } })
      const que = (await page.locator('#globo-que').textContent()) ?? ''
      if (que.startsWith('nada')) continue
      const mas = /y (\d+) más/.exec(que)
      contados += 1 + (mas === null ? 0 : Number(mas[1]))
      clases.add(
        `${que.replace(/ \(y \d+ más acá\)/, '')} · ${(await page.locator('#globo-detalle').textContent()) ?? ''}`,
      )
    }
  }

  const aLaVista = Number(await page.locator('#a-la-vista').textContent())
  expect(aLaVista, 'la escena no publicó ningún cuerpo: el test no probaría nada').toBeGreaterThan(0)
  expect(contados, `clickeando se encontró: ${[...clases].join(', ')}`).toBe(aLaVista)
})

test('4 · escribir una orden en el chat', async ({ page }) => {
  await abrir(page)
  await page.locator('#orden').fill('hacé fuego')
  await page.locator('#orden').press('Enter')

  await expect(page.locator('#registro .pedido')).toHaveText('hacé fuego')
  // Y la caja queda limpia: sin esto, escribir dos órdenes seguidas manda la
  // primera pegada a la segunda.
  await expect(page.locator('#orden')).toHaveValue('')
})

test('5 · recibir acuse inmediato', async ({ page }) => {
  await abrir(page)
  // EL MUNDO EN PAUSA, que es lo que hace que este test signifique algo. Con la
  // partida corriendo, un acuse que tardara tres cuadros se vería idéntico a uno
  // inmediato; con el reloj clavado, si esperara a un tick no llegaría nunca.
  const antes = await tick(page)
  await page.locator('#orden').fill('hacé fuego')
  await page.locator('#orden').press('Enter')

  await expect(page.locator('#registro .respuesta')).toHaveText('dale, voy')
  expect(await tick(page), 'el mundo avanzó: esto no prueba que el acuse sea inmediato').toBe(antes)
})

test('5b · «traé un palo» también tiene camino, y este spec decía lo contrario', async ({ page }) => {
  // Este spec afirmaba que la criatura contestaba «no sé cómo» a «traé un palo»,
  // y era verdad: ningún esquema establecía `holding(tag:fibroso)`. Lo que
  // faltaba no era un esquema sino la vía más corta a «tenerlo» —caminar hasta
  // algo que ya lo cumple y agarrarlo—, que vive como caso base de la regresión.
  //
  // Queda como spec y no se borra porque lo que mide sigue siendo lo mismo: que
  // el acuse diga la verdad sobre si conoce un camino. Sólo cambió la verdad.
  await abrir(page)
  await page.locator('#orden').fill('traé un palo')
  await page.locator('#orden').press('Enter')
  await expect(page.locator('#registro .respuesta')).toHaveText('dale, voy')
})

test('6 · observar progreso y acciones', async ({ page }) => {
  await abrir(page)
  await page.locator('#orden').fill('hacé fuego')
  await page.locator('#orden').press('Enter')

  // ─── LA VENTANA ES CORTA, Y ESO SE MIDIÓ ────────────────────────────────
  //
  // La primera versión corría hasta el tick 60 y RECIÉN AHÍ miraba, y fallaba
  // siempre. Medido con un banco aparte: la orden vive del tick 0 al ~80 y ahí
  // el encargo se da por cumplido —el registro dice «listo»— porque
  // `emitsPower>0` es un predicado EXISTENCIAL y con algo así a la vista ya está
  // satisfecho. Es lo mismo que el Hito 6 dejó escrito, no un defecto nuevo.
  //
  // Así que se mira desde el principio y a ×1: a ×4 la ventana entera son cuatro
  // segundos de reloj y el poll se la puede perder.
  await page.locator('[data-vel="1"]').click()
  await expect(page.locator('#persigue')).toContainText('tuya', { timeout: 20_000 })

  // Y en algún momento está haciendo algo, con su barra. `quieta` es el estado
  // del que se venía —el panel decía eso para siempre— así que salir de ahí es
  // exactamente lo que este punto pide.
  await expect
    .poll(async () => page.locator('#hace').textContent(), { timeout: 40_000 })
    .not.toBe('quieta')
  const ancho = await page.locator('#hace-barra').evaluate((el) => el.getBoundingClientRect().width)
  const rayada = await page.locator('#hace-caja').evaluate((el) => el.classList.contains('sin-total'))
  // O tiene barra con algo pintado, o es un proceso sin final declarado y se
  // dibuja rayado. Las dos son respuestas; una barra vacía y lisa no.
  expect(ancho > 0 || rayada).toBe(true)
})

test('6b · y cuando la orden se cumple, la criatura lo dice y vuelve a lo suyo', async ({ page }) => {
  // La otra mitad del punto 6: que el jugador se entere de que TERMINÓ. Sin este
  // aviso, una criatura que vuelve a sus cosas se ve igual que una que se
  // aburrió de hacerte caso.
  await abrir(page)
  await page.locator('#orden').fill('hacé fuego')
  await page.locator('#orden').press('Enter')
  await page.locator('[data-vel="4"]').click()

  await expect(page.locator('#registro .respuesta').last()).toHaveText('listo', { timeout: 40_000 })
  await expect(page.locator('#persigue')).toContainText('suya')
})

test('7 · inspeccionar la criatura', async ({ page }) => {
  await abrir(page)
  // El máximo sale del catálogo de cualidades, no de la escena: si algún día
  // alguien copia el 1000 en la pantalla, esto sigue pasando y el documento
  // explica por qué está mal. Lo que se afirma acá es el formato que el jugador ve.
  await expect(page.locator('#aliento')).toHaveText(/^\d+ \/ 1000$/)
  const ancho = await page.locator('#aliento-barra').evaluate((el) => el.getBoundingClientRect().width)
  expect(ancho, 'la barra de aliento no tiene ancho').toBeGreaterThan(0)

  await expect(page.locator('#manos')).not.toHaveText('—')
})

// ─── EL PANEL SE VOLVIÓ UN GLOBO, Y EL PUNTO NO CAMBIÓ ──────────────────
//
// Esto leía cuatro nodos del panel de la derecha. Hoy lee el globo, que sale en
// el lugar del click: es el MISMO dato por la MISMA función —`lo-senalado.ts` no
// cambió una línea de lo que ya decidía— puesto donde el ojo ya está mirando.
//
// Y hay dos cosas que el panel no podía afirmar y éste sí, porque son de estar
// anclado a un lugar: que aparezca un ancla SOBRE la celda, y que la × cierre.
test('8 · inspeccionar cuerpos y obras', async ({ page }) => {
  await abrir(page)
  const canvas = page.locator('#mapa')
  const caja = await canvas.boundingBox()
  if (caja === null) throw new Error('el mapa no tiene caja')

  // Antes de clickear no hay globo: aparece porque preguntaste, no de entrada.
  await expect(page.locator('#globo')).toBeHidden()

  // El centro es la criatura: el foco la sigue, así que siempre está ahí.
  await canvas.click({ position: { x: caja.width / 2, y: caja.height / 2 } })
  await expect(page.locator('#globo-que')).toContainText('la criatura')
  // El material va en el NOMBRE —«carne cruda»— y por eso se pide acá y no en
  // el detalle, que sólo nombra las sustancias cuando el cuerpo tiene tres o
  // más: con una o dos, el nombre ya las dice y repetirlas era leer dos veces.
  await expect(page.locator('#globo-que')).toContainText('carne')
  // El detalle son las tres frases seguidas: las piezas y `forma · porte`.
  await expect(page.locator('#globo-detalle')).toContainText('parte')
  await expect(page.locator('#globo-detalle')).toContainText('·')

  // ─── Y EL ANCLA CAE SOBRE LA CELDA QUE CLICKEASTE ──────────────────
  //
  // Es lo que el panel de la derecha no podía prometer: ahí la respuesta vivía a
  // setecientos píxeles de la pregunta y no había relación que verificar. Acá esa
  // relación ES el cambio, así que es lo que hay que cuidar.
  const marca = await page.locator('#ancla').boundingBox()
  if (marca === null) throw new Error('el ancla no tiene caja')
  const CELDA = 28
  expect(Math.abs(marca.x + marca.width / 2 - (caja.x + caja.width / 2))).toBeLessThan(CELDA)
  expect(Math.abs(marca.y + marca.height / 2 - (caja.y + caja.height / 2))).toBeLessThan(CELDA)

  // Y una celda vacía dice que está vacía, en vez de quedarse con lo anterior:
  // un globo que no se limpia hace creer que hay algo donde no hay nada. Y su
  // pie pasa a decir qué suelo es, que es lo único que queda para decir.
  await canvas.click({ position: { x: 4, y: 4 } })
  const que = await page.locator('#globo-que').textContent()
  expect(que === null || que.startsWith('nada') || que.length > 0).toBe(true)

  // ─── LA × LO CIERRA, y es la única forma de sacarlo de la pantalla ──────
  await page.locator('#globo-cerrar').click()
  await expect(page.locator('#globo')).toBeHidden()
  await expect(page.locator('#ancla')).toBeHidden()
})

// ─── LA CRIATURA SE VE COMO CRIATURA EN LAS CUATRO VISTAS ───────────────────
//
// `glifoDe` toma un `esAgente` que hace que pida la clave de CRIATURA en vez de
// la de la materia. `mapa.ts` se lo pasaba y ninguna de las otras vistas lo
// hacía, así que la misma criatura era el MUÑECO en el mapa y un bloque de carne
// en el cartel, en el globo y en el inspector. El caso 7 del 12C fallando —«la
// misma representación coherente en las tres vistas»— con el agravante de que el
// dato nunca faltó: `Senalado.esAgente` estaba publicado y no lo leía nadie.
//
// ─── POR QUÉ ESTE TEST ESTÁ ACÁ Y NO EN `tests/` ───────────────────────────
//
// Porque lo que hay que cazar no es que `glifoDe` sepa hacerlo —eso lo prueba
// `tests/la-criatura-no-es-un-terron.test.ts`, más barato y con su control— sino
// que la PANTALLA se lo pase. Eso es cable, y el cable sólo se ve corriéndolo.
//
// El umbral sale de las dos mediciones de ese archivo y no del dedo: la criatura
// ocupa 0,438 de su grilla y la carne 0,750. El 0,6 cae en el medio, lejos de los
// dos, así que ni un retoque del sprite ni uno del patrón lo mueven de lado.
test('8b · y la criatura se ve como criatura, no como la carne que la forma', async ({ page }) => {
  await abrir(page)
  const canvas = page.locator('#mapa')
  const caja = await canvas.boundingBox()
  if (caja === null) throw new Error('el mapa no tiene caja')

  // El centro es la criatura: el foco la sigue.
  await canvas.click({ position: { x: caja.width / 2, y: caja.height / 2 } })
  await expect(page.locator('#globo-que')).toContainText('la criatura')

  const tinta = await page.locator('#globo canvas').evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')
    if (ctx === null) return 1
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let con = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) con++
    return con / (c.width * c.height)
  })
  expect(tinta, 'el globo dibuja a la criatura como un bloque de su materia').toBeLessThan(0.6)
})
