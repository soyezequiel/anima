// ─── EL REPORTE, BAJADO DE UN NAVEGADOR DE VERDAD ───────────────────────────
//
// `tests/el-reporte.test.ts` prueba el formato con datos inventados: que no
// mienta sobre lo que no se miró, que un stack sobreviva, que un volcado
// imposible no se lleve el archivo puesto. Nada de eso toca el juego.
//
// Lo que sólo se puede ver acá son las tres costuras entre el reporte y la
// partida, y las tres son de las que se rompen en silencio:
//
//   1. **el reporte sale de la partida de verdad**, con su mundo adentro y en un
//      JSON que se vuelve a parsear. Un `juntarElReporte` que lea un getter que
//      cambió de nombre compila igual y baja un archivo vacío;
//   2. **una rotura de verdad llega al archivo.** El vigía se instala al abrir la
//      página, y que ande en un banco de pruebas no dice nada de si está
//      enganchado a la ventana que el jugador tiene delante;
//   3. **el atajo funciona con el modo dev apagado**, que es la única forma en
//      que un jugador lo va a usar.
//
// ─── Y LA PARTIDA SE MIRA EN PAUSA ──────────────────────────────────────────
//
// El juego arranca en ×1, así que `abrir()` entra por `?vel=0` y ningún test lo
// vuelve a tocar. No es sólo prudencia —una pestaña abierta avanza la real—: el
// reporte tiene que decir EN PAUSA cuando está en pausa, porque «la criatura no
// hace nada» con el mundo detenido es la confusión más común que este archivo
// puede evitarle a alguien.

import { readFileSync } from 'node:fs'

import { expect, test, type Download, type Page } from '@playwright/test'

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
  await page.goto('/?vel=0')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
}

/** Aprieta lo que sea que baje el reporte y devuelve el texto del archivo. */
async function bajar(page: Page, apretar: () => Promise<void>): Promise<{ d: Download; md: string }> {
  const esperando = page.waitForEvent('download', { timeout: 20_000 })
  await apretar()
  const d = await esperando
  const donde = await d.path()
  return { d, md: readFileSync(donde, 'utf8') }
}

/** El bloque ```json del final, tal como lo va a sacar quien lea el archivo. */
function elVolcado(md: string): unknown {
  const m = /```json\n([\s\S]*?)\n```/.exec(md)
  if (m === null) throw new Error('el reporte no trae bloque json')
  return JSON.parse(m[1] as string)
}

test('1 · EL BOTÓN BAJA UN REPORTE CON LA PARTIDA ADENTRO', async ({ page }) => {
  await abrir(page)
  await page.locator('#modo-dev').click()
  await page.locator('#chip-partida').click()

  const { d, md } = await bajar(page, () => page.locator('#reporte').click())

  // El nombre lleva el tick: dos reportes de la misma sesión se ordenan por lo
  // que le pasó al mundo y no por lo que tardó la persona en apretar.
  expect(d.suggestedFilename()).toMatch(/^anima-ii-tick-\d+-.*\.md$/)

  // Las siete secciones, en orden. Que estén todas es lo que hace que el archivo
  // sirva sin saber de antemano qué se está buscando.
  expect(md).toContain('# Reporte de una partida de Ánima II')
  for (const seccion of [
    '## 1. Qué se rompió',
    '## 2. Dónde está la partida',
    '## 3. La criatura',
    '## 4. Qué estaba intentando hacer',
    '## 5. De qué hablaron',
    '## 6. Qué sabe',
    '## 7. El mundo, en crudo',
  ]) {
    expect(md, `falta la sección ${seccion}`).toContain(seccion)
  }

  // Y lo que hace que el reporte sea de ESTA partida y no de un molde: la
  // semilla del juego y la criatura que la habita.
  expect(md).toContain('20260727')
  expect(md).toContain('| quién | ana |')
})

test('2 · EL MUNDO EN CRUDO SE PUEDE VOLVER A CARGAR', async ({ page }) => {
  // Es la promesa cara del reporte: que con este archivo se puede reproducir la
  // partida. Si el volcado no es un `Guardado` legible, el archivo cuenta un
  // problema y no deja tocarlo — que es la mitad menos útil.
  await abrir(page)
  await page.locator('#modo-dev').click()
  await page.locator('#chip-partida').click()

  const { md } = await bajar(page, () => page.locator('#reporte').click())
  const g = elVolcado(md) as { version: number; quien: string; mundo: [string, unknown][]; tick: number }

  expect(g.quien).toBe('ana')
  expect(g.version).toBeGreaterThanOrEqual(3)
  expect(typeof g.tick).toBe('number')
  // Las ranuras del mundo, que son lo que `restoreWorld` come. La cabecera y el
  // cuerpo de la criatura tienen que estar o no hay mundo que restaurar.
  const ranuras = g.mundo.map(([k]) => k)
  expect(ranuras).toContain('mundo')
  expect(ranuras).toContain('cuerpo:ana-cuerpo')
  expect(ranuras).toContain('actor:ana')
})

test('3 · UNA ROTURA DE VERDAD LLEGA AL ARCHIVO', async ({ page }) => {
  await abrir(page)

  // Una promesa rechazada sin `catch`: la puerta más silenciosa de las cuatro, y
  // la que usa todo lo asíncrono del juego —guardado, surtidor, enlace—.
  await page.evaluate(() => {
    void Promise.reject(new Error('LA ROTURA DE PRUEBA'))
  })
  // El evento `unhandledrejection` se emite en la microtarea siguiente, no en
  // la línea de arriba.
  await page.waitForTimeout(200)

  const { md } = await bajar(page, async () => {
    await page.keyboard.press('Control+Alt+r')
  })

  expect(md).toContain('LA ROTURA DE PRUEBA')
  expect(md).toContain('promesa')
  // Y con el tick del mundo en que pasó: es el número con el que se la puede ir
  // a buscar al volcado.
  expect(md).toMatch(/\*\*1\. promesa\*\* · tick \d+/)
})

test('4 · EL ATAJO ANDA CON EL MODO DEV APAGADO', async ({ page }) => {
  // Quien ve algo raro jugando no tiene el dock abierto. Si el reporte sólo se
  // pudiera pedir desde el panel, la instrucción para un jugador sería «prendé
  // el modo dev, abrí La partida, apretá el botón» — y para entonces ya pasó
  // encima lo que se quería reportar.
  await abrir(page)
  await expect(page.locator('#dock')).toBeHidden()

  const { md } = await bajar(page, async () => {
    await page.keyboard.press('Control+Alt+r')
  })

  expect(md).toContain('# Reporte de una partida de Ánima II')
  expect(md).toContain('dock | apagado')
})

test('5 · DICE QUE ESTÁ EN PAUSA, Y DICE QUE NADIE MIRÓ LOS INVARIANTES', async ({ page }) => {
  // Los dos avisos que evitan una cacería equivocada. El primero explica el
  // síntoma más común —«no hace nada»— sin que nadie abra el código. El segundo
  // impide lo contrario: dar por descartado al mundo porque la lista salió
  // vacía, cuando la lista está vacía porque el arnés no corrió.
  await abrir(page)

  const { md } = await bajar(page, async () => {
    await page.keyboard.press('Control+Alt+r')
  })

  expect(md).toContain('EN PAUSA')
  expect(md).toContain('No se miró')
})

test('6 · LO QUE LE PEDISTE ESTÁ EN EL REPORTE', async ({ page }) => {
  // La charla entera y no las últimas líneas: el pedido que explica un estado
  // raro suele ser el de hace diez turnos.
  await abrir(page)
  await page.locator('#orden').fill('traeme un pescado')
  await page.locator('#orden').press('Enter')
  await expect(page.locator('#registro [data-turno]').first()).toBeVisible()

  const { md } = await bajar(page, async () => {
    await page.keyboard.press('Control+Alt+r')
  })

  expect(md).toContain('traeme un pescado')
  expect(md).toContain('## 5. De qué hablaron')

  // Y CÓMO LO ENTENDIÓ, que es la mitad que la charla no dice. Una frase leída
  // de verdad trae al menos una cláusula con su firma; si acá saliera «no leyó
  // ninguna frase» después de haber pedido algo, la costura entre el reporte y
  // `Ordenes` estaría rota y el reporte no lo diría de ninguna otra forma.
  expect(md).toContain('Cómo entendió lo último que le dijiste')
  expect(md).not.toContain('No leyó ninguna frase')
  expect(md).toMatch(/«traeme un pescado» → \S+/)
})
