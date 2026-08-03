// ─── QUE LAS LUCES SE VEAN, Y QUE SE MUEVAN ─────────────────────────────────
//
// `con-quien.test.ts` prueba la decisión —qué luz le toca a cada respuesta— y
// eso corre en node, sin pantalla. Lo que ese test NO puede afirmar es lo único
// que el usuario pidió: **que la cosa se anime**. Una clase CSS bien puesta sobre
// un `@keyframes` mal escrito da verde ahí y un punto muerto acá.
//
// ─── POR QUÉ LAS RESPUESTAS SE FALSIFICAN Y NO SE LEVANTA EL DEPÓSITO ──────
//
// Porque los tres estados dependen de qué haya instalado en la máquina que corre
// el test, y eso no se puede fijar: en una máquina sin `codex` el caso «los dos
// prendidos» sería imposible de montar. Con `route` la respuesta es un dato del
// test y los tres casos valen igual en cualquier lado.
//
// ─── Y POR QUÉ SE MIDE `currentTime` Y NO UN COLOR ─────────────────────────
//
// Se intentó primero leyendo el `transform` del anillo dos veces con una espera
// en el medio, y es una trampa: el keyframe pasa el 30% final quieto en
// `scale(3.1)`, así que dos lecturas seguidas pueden dar idéntico con todo
// funcionando. El reloj de la animación, en cambio, sólo avanza si la animación
// corre — y forzarlo a un instante conocido da un tamaño exacto que comparar.

import { expect, test, type Page } from '@playwright/test'

const LOS_DOS = {
  codex: { vive: true, version: 'codex-cli 0.4.2' },
  claude: { vive: true, version: '2.0.1 (Claude Code)' },
}

/** Contesta `/salud` con lo que el caso necesite. `null` es el depósito caído. */
async function conSalud(page: Page, cuerpo: unknown | null): Promise<void> {
  await page.route('**/salud', async (route) => {
    if (cuerpo === null) {
      await route.abort('connectionrefused')
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // Sin esto el navegador descarta la respuesta: el depósito vive en otro
      // origen, y el servidor de verdad manda el mismo encabezado.
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(cuerpo),
    })
  })
  await page.goto('/')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
}

/** El reloj de una animación por nombre, en milisegundos. */
function relojDe(page: Page, quien: string, nombre: string): Promise<number | undefined> {
  return page.locator(`#lampara-${quien} i`).evaluate((el, n) => {
    const a = el.getAnimations({ subtree: true }).find((x) => (x as CSSAnimation).animationName === n)
    return a === undefined ? undefined : Number(a.currentTime ?? 0)
  }, nombre)
}

test('CON LOS DOS CLIS: dos luces prendidas, con roles distintos', async ({ page }) => {
  await conSalud(page, { ok: true, sprites: 3, dibuja: 'codex', modelos: LOS_DOS })

  await expect(page.locator('#lampara-codex')).toHaveClass(/vive/)
  await expect(page.locator('#rol-codex')).toHaveText('dibuja')
  await expect(page.locator('#lampara-claude')).toHaveClass(/vive/)
  // La línea que impide la mentira: prendida no quiere decir que se use.
  await expect(page.locator('#rol-claude')).toHaveText('en espera')
  await expect(page.locator('#enlace-nota')).toHaveText('')
})

test('Y LATEN DE VERDAD: el reloj de la animación avanza solo', async ({ page }) => {
  await conSalud(page, { ok: true, sprites: 3, dibuja: 'codex', modelos: LOS_DOS })

  const antes = await relojDe(page, 'codex', 'latir')
  expect(antes, 'no hay ninguna animación «latir» en el anillo').toBeDefined()
  await page.waitForTimeout(400)
  const despues = await relojDe(page, 'codex', 'latir')
  expect(despues ?? 0, 'el reloj no se movió: la animación está clavada').toBeGreaterThan(antes ?? 0)
})

test('y el anillo SE ABRE: a mitad del latido mide más que al empezar', async ({ page }) => {
  await conSalud(page, { ok: true, sprites: 3, dibuja: 'codex', modelos: LOS_DOS })

  const escalaEn = (ms: number): Promise<number> =>
    page.locator('#lampara-codex i').evaluate((el, t) => {
      for (const a of el.getAnimations({ subtree: true })) {
        if ((a as CSSAnimation).animationName === 'latir') a.currentTime = t
      }
      const m = new DOMMatrixReadOnly(getComputedStyle(el, '::after').transform)
      return m.a
    }, ms)

  expect(await escalaEn(0)).toBeCloseTo(1, 1)
  // A mitad ya se abrió, y para el final está afuera y apagado.
  expect(await escalaEn(1200)).toBeGreaterThan(2)
  await expect
    .poll(() => page.locator('#lampara-codex i').evaluate((el) => getComputedStyle(el, '::after').opacity))
    .toBe('0')
})

test('NINGUNO DE LOS DOS: apagadas, quietas, y se aclara que el juego sigue', async ({ page }) => {
  await conSalud(page, {
    ok: true,
    sprites: 0,
    dibuja: null,
    modelos: { codex: { vive: false }, claude: { vive: false } },
  })

  await expect(page.locator('#lampara-codex')).toHaveClass(/\bno\b/)
  await expect(page.locator('#lampara-claude')).toHaveClass(/\bno\b/)
  await expect(page.locator('#enlace-nota')).toContainText('se juega igual')
  // Quietas de verdad: apagado y latiendo se verían igual de vivos.
  expect(await relojDe(page, 'codex', 'latir')).toBeUndefined()
  expect(await relojDe(page, 'codex', 'buscar')).toBeUndefined()
})

test('MIENTRAS EL BACKEND SONDEA, parpadean en gris', async ({ page }) => {
  await conSalud(page, { ok: true, sprites: 0, dibuja: 'codex', modelos: null })

  await expect(page.locator('#lampara-codex')).toHaveClass(/buscando/)
  expect(await relojDe(page, 'codex', 'buscar'), 'el parpadeo no arrancó').toBeDefined()
  // Y no late: buscando y encontrado tienen que verse distinto.
  expect(await relojDe(page, 'codex', 'latir')).toBeUndefined()
})

test('SIN DEPÓSITO se apagan las dos, porque no hay con qué saber', async ({ page }) => {
  await conSalud(page, null)

  await expect(page.locator('#rol-codex')).toHaveText('sin depósito')
  await expect(page.locator('#rol-claude')).toHaveText('sin depósito')
  await expect(page.locator('#enlace-nota')).toContainText('se juega igual')
})

// ─── EL ÚNICO QUE TARDA, Y ES EL QUE SOSTIENE LA PROMESA ───────────────────
//
// El juego vuelve a preguntar cada 900 cuadros —unos quince segundos— y de eso
// depende algo que el código promete en un comentario: que levantar el depósito
// con la pestaña ya abierta prenda la luz **sin recargar**. Antes de este tramo
// no pasaba: había un solo intento, al abrir, y si fallaba no había segundo.
//
// No se puede acelerar sin cambiar el juego, así que este spec se banca los
// quince segundos. Es uno solo y compra la única afirmación que ningún test
// rápido puede hacer.
test('SE PRENDE SOLA: aparece el CLI y la luz cambia sin recargar', async ({ page }) => {
  let vive = false
  let pedidos = 0
  await page.route('**/salud', async (route) => {
    pedidos++
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        ok: true,
        sprites: 0,
        dibuja: 'codex',
        modelos: { codex: { vive }, claude: { vive: false } },
      }),
    })
  })
  await page.goto('/')
  await expect(page.locator('#lampara-codex')).toHaveClass(/\bno\b/)
  expect(pedidos).toBe(1)

  // Y ahora aparece, como si alguien levantara el depósito recién.
  vive = true
  await expect(page.locator('#lampara-codex')).toHaveClass(/vive/, { timeout: 40_000 })
  expect(pedidos, 'no volvió a preguntar: la luz cambió por otra cosa').toBeGreaterThan(1)
})
