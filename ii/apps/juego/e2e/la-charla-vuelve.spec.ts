// ─── C1 · LA CHARLA VUELVE, EN ORDEN Y SIN REPETIRSE ────────────────────────
//
// El hermano de `guardar-y-volver.spec.ts`: aquél afirma que **el mundo** que
// vuelve es el que se fue; éste afirma lo mismo de **la conversación**. Vive en
// su propio archivo por lo mismo, que es que hay que recargar la página.
//
// ─── QUÉ HACE FALTA QUE FALLE PARA QUE ESTO SIRVA ──────────────────────────
//
// Que el log no sea durable, que dos líneas compartan identidad, o que una línea
// se pinte dos veces. Las tres se ven acá y ninguna se ve en un test de vitest:
// la recarga de una pestaña de verdad es lo único que ejercita el camino entero
// —IndexedDB, el arranque, el repintado incremental de `charla()`—.
//
// ─── Y LO QUE NO SE MIRA, A PROPÓSITO ──────────────────────────────────────
//
// Si la criatura obedeció. Eso es el mundo y se mira en el mundo; acá se mira el
// historial, que es lo que C1 promete. Un `#registro` lleno no acredita nada más
// que un `#registro` lleno.

import { expect, test, type Page } from '@playwright/test'

/**
 * ─── EL DEPÓSITO SE SILENCIA, y hace falta desde que el chat le pregunta ────
 *
 * Este spec mide DURABILIDAD: que las líneas vuelvan con su turno y su clase
 * después de recargar. Desde que una frase que el léxico no termina de entender
 * sale a preguntarle a Codex, hay una segunda fuente de líneas que llega por red
 * y cuando quiere — y en un e2e no hay depósito, así que lo que llega es la
 * falla, o sea un `aviso` de más en un momento impredecible.
 *
 * Se contesta «llegó y no trajo nada», que es el único resultado que NO escribe
 * en la charla (ver `#noLlegue` en `ordenes.ts`: ése no lleva aviso). Así el
 * canal queda con lo que este spec vino a medir y nada más.
 *
 * Es el patrón para cualquier spec que cuente líneas: si no silenciás `/leer`,
 * estás midiendo también la red.
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

/** Espera a que el juego escriba un guardado. El mismo cartel que ve el jugador. */
async function esperarGuardado(page: Page): Promise<number> {
  await expect(page.locator('#guardado')).toHaveText(/^tick \d+$/, { timeout: 40_000 })
  return Number(((await page.locator('#guardado').textContent()) ?? '').replace('tick ', ''))
}

interface Linea {
  readonly turno: string
  readonly clase: string
  readonly texto: string
}

/**
 * El registro tal como está pintado: identidad, clase y texto de cada línea.
 *
 * ─── SE LEE POR `data-turno` Y NO POR `p`, y el cambio importa ─────────────
 *
 * La charla se agrupa en TURNOS: un pedido, la respuesta, y los pasos adentro
 * de un bloque. O sea que ya no hay un `<p>` por línea del log ni todos los
 * `<p>` son líneas del log — el «3 pasos» de un turno plegado también es uno.
 *
 * Lo que este archivo afirma es del LOG y no del agrupado: orden, identidad, que
 * nada se repita y que el progreso no vuelva convertido en habla. Todo eso
 * sobrevive al rediseño porque cada nodo que sale de un `Dicho` sigue llevando
 * su `data-turno` y su `data-clase` — que es exactamente para esto, y no para
 * estilar. El agrupado es presentación; la identidad del log tiene que
 * sobrevivirle, y este selector es donde eso se comprueba.
 */
async function registro(page: Page): Promise<readonly Linea[]> {
  return page.locator('#registro [data-turno]').evaluateAll((ps) =>
    ps.map((p) => ({
      turno: (p as HTMLElement).dataset['turno'] ?? '',
      clase: (p as HTMLElement).dataset['clase'] ?? '',
      texto: p.textContent ?? '',
    })),
  )
}

async function decir(page: Page, texto: string): Promise<void> {
  await page.locator('#orden').fill(texto)
  await page.locator('#orden').press('Enter')
}

async function tick(page: Page): Promise<number> {
  return Number(await page.locator('#tick').textContent())
}

test('la charla vuelve con su orden y su identidad, y nada se repite', async ({ page }) => {
  await abrir(page)

  // ─── Tres intercambios, con el mundo en pausa ────────────────────────────
  //
  // En pausa a propósito: el acuse tiene que salir sin que corra un tick, y así
  // las seis líneas de estos tres turnos son exactamente seis.
  await decir(page, 'hacé fuego')
  await decir(page, 'traé un palo')
  await decir(page, 'atá la vara con la hebra')
// Tres turnos, y cada uno con su pedido y su respuesta: seis nodos con
  // identidad. Con el mundo en pausa no hay progreso todavía.
  await expect(page.locator('#registro [data-turno]')).toHaveCount(6)

  // ─── Y ahora el mundo corre, para que haya progreso que narrar ───────────
  await page.locator('[data-vel="4"]').click()
  // Lo que la criatura HACE se narra aparte de lo que DICE. Esperar a que
  // aparezca es lo que hace que la afirmación de abajo signifique algo.
  await expect(page.locator('#registro .paso').first()).toBeAttached({ timeout: 40_000 })
  const guardadoEn = await esperarGuardado(page)
  expect(guardadoEn).toBeGreaterThan(0)
  await page.locator('[data-vel="0"]').click()

  const antes = await registro(page)
  expect(antes.length).toBeGreaterThan(6)
  expect(antes.every((l) => l.turno !== ''), 'hay líneas sin identidad').toBe(true)

  // ─── Y ACÁ SE CIERRA LA PESTAÑA ─────────────────────────────────────────
  await abrir(page)

  const despues = await registro(page)

  // ORDEN E IDENTIDAD: la misma lista, con los mismos números de turno.
  expect(despues.map((l) => `${l.turno}|${l.texto}`)).toEqual(antes.map((l) => `${l.turno}|${l.texto}`))

  // NADA SE REPITE: un nodo por turno.
  const turnos = despues.map((l) => l.turno)
  expect(new Set(turnos).size, 'una línea se pintó dos veces').toBe(turnos.length)

  // LA CLASE SOBREVIVE: el progreso no vuelve convertido en habla. Se cuenta
  // sobre `data-clase`, que es la clase del `Dicho` y no la del CSS: con el
  // agrupado, la del CSS dice dónde quedó pintado y ésta dice de qué clase
  // ERA — que es lo único que este test tiene que cuidar.
  expect(despues.filter((l) => l.clase === 'progreso').length).toBe(
    antes.filter((l) => l.clase === 'progreso').length,
  )

  // ─── El cuarto intercambio, después de la recarga ────────────────────────
  //
  // Y acá el conteo cambió con el rediseño, por la razón que el rediseño busca:
  // al abrirse el cuarto turno, el tercero SE PLIEGA y sus pasos se van del DOM
  // —quedan resumidos en «N pasos»—. Antes esto decía `despues.length + 2`
  // porque la lista sólo crecía; hoy crece por el final y se achica por el
  // medio, que es lo que hace que leer la charla cueste lo mismo siempre.
  const pasosAntes = await page.locator('#registro .paso').count()
  expect(pasosAntes, 'sin pasos pintados, el plegado no probaría nada').toBeGreaterThan(0)

  await decir(page, 'hacé fuego')
  const conElCuarto = await registro(page)
  expect(conElCuarto.length).toBe(despues.length + 2 - pasosAntes)

  // LO QUE SE PLEGÓ NO SE PERDIÓ: el turno viejo dice cuántos pasos tuvo.
  await expect(page.locator('#registro .turno.plegado .cuantos').last()).toHaveText(
    new RegExp(`^${String(pasosAntes)} pasos?$`),
  )

  const nums = conElCuarto.map((l) => Number(l.turno))
  for (let i = 1; i < nums.length; i++) {
    expect(nums[i] as number, 'los turnos no siguen creciendo después de la recarga').toBeGreaterThan(
      nums[i - 1] as number,
    )
  }
  expect(new Set(nums).size).toBe(nums.length)
})

test('C2 · cita lo que recuerda con su fuente, y no confunde lo dicho con lo visto', async ({
  page,
}) => {
  await abrir(page)
  await decir(page, 'hacé fuego')
  await decir(page, 'hay un pescado en el río')
  // «Lo que recuerda» es hoy el módulo Journal del dock.
  const sw = page.locator('#modo-dev')
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click()
  const chip = page.locator('#chip-journal')
  if (!(await chip.evaluate((b) => b.classList.contains('on')))) await chip.click()
  await expect(page.locator('[data-modulo="journal"]')).toBeVisible()

  const filas = page.locator('#lista-recuerdos .fila')
  await expect(filas.first()).toBeVisible()

  // Cada línea cita de qué turno salió: `#1`, `#2`. Sin eso, «me acuerdo» no se
  // puede ir a comprobar al registro.
  await expect(filas.first().locator('.fuente')).toHaveText(/#\d+/)

  // Y la distinción que el tramo prohíbe perder: el pedido y la afirmación son
  // los dos del cuidador, y NINGUNO figura como algo que la criatura vio.
  const pedido = filas.filter({ has: page.locator('b', { hasText: 'pedido' }) }).first()
  await expect(pedido).toHaveAttribute('data-procedencia', 'cuidador')
  const dicho = filas.filter({ hasText: 'pescado' }).first()
  await expect(dicho).toHaveAttribute('data-clase', 'dicho')
  await expect(dicho).toHaveAttribute('data-procedencia', 'cuidador')
  expect(await filas.filter({ hasText: 'pescado' }).getAttribute('data-clase')).not.toBe('hecho')
})

test('EN PAUSA TAMBIÉN: hablar no mueve un tick, y el log igual se guarda', async ({ page }) => {
  // ─── EL CASO QUE EL DE ARRIBA NO CUBRE, Y ES EL MÁS PROBABLE ──────────────
  //
  // Aquél corre el mundo a ×4 para que haya progreso que narrar, y de paso hace
  // avanzar el tick — que era la única condición que disparaba un guardado. Un
  // jugador que le escribe tres cosas con el juego en pausa y cierra la pestaña
  // no avanza un solo tick, y perdía la charla entera.
  //
  // No es hipotético ni es un borde: el juego ARRANCA EN PAUSA a propósito, así
  // que es lo primero que hace cualquiera.
  await abrir(page)
  await decir(page, 'hacé fuego')
  await decir(page, 'traé un palo')
  await decir(page, 'atá la vara con la hebra')

  const antes = await registro(page)
  expect(antes).toHaveLength(6)
  expect(await tick(page), 'el mundo avanzó: este test dejaría de probar lo suyo').toBe(0)
  await esperarGuardado(page)

  await abrir(page)
  // Las seis líneas, con su turno y su clase. `toEqual` compara las tres cosas.
  expect(await registro(page)).toEqual(antes)
})
