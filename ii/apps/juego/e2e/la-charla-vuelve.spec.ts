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

async function abrir(page: Page): Promise<void> {
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

/** El registro tal como está pintado: identidad, clase y texto de cada línea. */
async function registro(page: Page): Promise<readonly Linea[]> {
  return page.locator('#registro p').evaluateAll((ps) =>
    ps.map((p) => ({
      turno: (p as HTMLElement).dataset['turno'] ?? '',
      clase: p.className,
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
  await expect(page.locator('#registro p')).toHaveCount(6)

  // ─── Y ahora el mundo corre, para que haya progreso que narrar ───────────
  await page.locator('[data-vel="4"]').click()
  // Lo que la criatura HACE se narra aparte de lo que DICE. Esperar a que
  // aparezca es lo que hace que la afirmación de abajo signifique algo.
  await expect(page.locator('#registro .progreso').first()).toBeAttached({ timeout: 40_000 })
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

  // LA CLASE SOBREVIVE: el progreso no vuelve convertido en habla.
  expect(despues.filter((l) => l.clase.includes('progreso')).length).toBe(
    antes.filter((l) => l.clase.includes('progreso')).length,
  )

  // ─── El cuarto intercambio, después de la recarga ────────────────────────
  await decir(page, 'hacé fuego')
  const conElCuarto = await registro(page)
  expect(conElCuarto.length).toBe(despues.length + 2)

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
  await page.locator('#lo-que-recuerda > summary').click()

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
