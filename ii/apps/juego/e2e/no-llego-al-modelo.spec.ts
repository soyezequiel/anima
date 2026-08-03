// ─── PREGUNTARLE A CODEX, Y QUE SE VEA CUANDO NO SE PUEDE ───────────────────
//
// Dos mitades del mismo camino, y las dos tienen que estar acá:
//
//   1. **que preguntar SIRVA** — una frase que el léxico local no entiende sale
//      por el depósito, vuelve con una firma, y la criatura cambia de idea. Sin
//      este spec, todo lo demás podría pasar con un proveedor que nunca acierta;
//   2. **que cuando no llega SE VEA** — la lámpara, el cartel y la charla.
//
// ─── POR QUÉ EL DEPÓSITO SE FALSIFICA ──────────────────────────────────────
//
// Porque del otro lado hay un `codex exec` con la cuenta de quien corra esto: un
// test que lo llamara de verdad gastaría plata, tardaría medio minuto y daría
// distinto según qué modelo tenga la cuenta. Con `route`, la respuesta es un dato
// del test. Lo que se prueba acá es el CAMINO —que la consulta salga, que lo que
// vuelva se aplique, que lo que falla se vea— y el camino es el mismo.
//
// ─── Y POR QUÉ NO SE MIRA `#lampara-claude` ────────────────────────────────
//
// Porque el chat lo atiende Codex. La lámpara que se marca es la del que TENÍA
// que atender, y eso sale de `contesta` en `/salud`. Un spec que mirara a Claude
// pasaría hoy sólo si el código tuviera el bug que este tramo vino a sacar.

import { expect, test, type Page } from '@playwright/test'

const LOS_DOS = {
  codex: { vive: true, version: 'codex-cli 0.4.2' },
  claude: { vive: true, version: '2.0.1 (Claude Code)' },
}

/** Qué hace el depósito con la consulta del chat. */
type Contesta =
  /** Devuelve una firma: el caso feliz. */
  | { readonly k: 'firma'; readonly firma: string }
  /** Llegó y no eligió nada. */
  | { readonly k: 'nada' }
  /** El CLI no arrancó: 502. */
  | { readonly k: 'rota' }
  /** No hay depósito: ni siquiera hay a quién pegarle. */
  | { readonly k: 'sin-deposito' }

interface Opciones {
  readonly contesta?: Contesta
  /** Si el depósito anuncia que atiende el chat. Sin esto no hay a quién marcar. */
  readonly atiendeElChat?: boolean
  /** Y si anuncia que forja. Tercer permiso, aparte del chat y del dibujo. */
  readonly forja?: boolean
  readonly codexVive?: boolean
}

async function abrir(page: Page, o: Opciones = {}): Promise<void> {
  const atiende = o.atiendeElChat ?? true
  await page.route('**/salud', async (route) => {
    if (o.contesta?.k === 'sin-deposito') {
      await route.abort('connectionrefused')
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        ok: true,
        sprites: 3,
        dibuja: 'codex',
        contesta: atiende ? 'codex' : null,
        forja: (o.forja ?? true) ? 'codex' : null,
        modelos: (o.codexVive ?? true) ? LOS_DOS : { codex: { vive: false }, claude: LOS_DOS.claude },
      }),
    })
  })
  // La fragua se corta salvo que el caso pida otra cosa: forjar de verdad son 80
  // segundos y una consulta paga, y ningún spec de acá mide eso.
  await page.route('**/forjar', (route) => route.abort('connectionrefused'))
  await page.route('**/leer', async (route) => {
    const c = o.contesta
    if (c === undefined || c.k === 'sin-deposito') {
      await route.abort('connectionrefused')
      return
    }
    if (c.k === 'rota') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ ok: false, porque: 'no encontré el CLI de codex en el PATH' }),
      })
      return
    }
    // La llave la pisa el cliente con la suya, así que acá no hace falta: es
    // parte de lo que `preguntarle-al-deposito.ts` promete y se prueba solo si
    // el caso feliz llega a aplicarse.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        ok: true,
        respuesta: c.k === 'nada' ? null : { llave: '', clausulas: [{ indice: 0, firma: c.firma }] },
      }),
    })
  })
  await page.goto('/')
  await expect(page.locator('#cuadro')).not.toHaveText('—', { timeout: 15_000 })
}

async function decir(page: Page, texto: string): Promise<void> {
  await page.locator('#orden').fill(texto)
  await page.locator('#orden').press('Enter')
}

// ═══ LA MITAD QUE IMPORTA: QUE PREGUNTAR SIRVA ═════════════════════════════

test('CODEX CONTESTA Y LA CRIATURA CAMBIA DE IDEA', async ({ page }) => {
  // «xyzzy plugh» no lo entiende ningún léxico. El acuse sale igual y en el acto
  // —ésa es la promesa del Hito 12B y no se toca— y DESPUÉS, cuando la respuesta
  // vuelve, la criatura dice que lo pensó mejor.
  await abrir(page, { contesta: { k: 'firma', firma: 'emitsPower>0' } })
  await decir(page, 'xyzzy plugh')

  await expect(page.locator('#registro')).toContainText('lo pensé mejor', { timeout: 15_000 })
  // Y no es sólo una frase: la meta que persigue ahora es la que el modelo
  // eligió. Sin esta línea, «lo pensé mejor» podría ser un cartel sin efecto.
  await page.locator('[data-vel="16"]').click()
  await expect(page.locator('#persigue')).toContainText('(tuya)', { timeout: 20_000 })
  await page.locator('[data-vel="0"]').click()
})

test('LA CONSULTA LLEVA LA FRASE Y EL CATÁLOGO, y no un prompt', async ({ page }) => {
  // El depósito arma el prompt; el juego manda lo que quiere saber. Si esto se
  // diera vuelta, el backend pasaría a ser un proxy abierto a la cuenta.
  let cuerpo: unknown
  await abrir(page, { contesta: { k: 'nada' } })
  // DESPUÉS de `abrir` y no antes: Playwright evalúa las rutas en orden inverso
  // al de registro, así que la que se agrega última es la que atiende. Puesta
  // arriba, la de `abrir` la tapaba y `cuerpo` no se llenaba nunca.
  // La fragua se corta salvo que el caso pida otra cosa: forjar de verdad son 80
  // segundos y una consulta paga, y ningún spec de acá mide eso.
  await page.route('**/forjar', (route) => route.abort('connectionrefused'))
  await page.route('**/leer', async (route) => {
    cuerpo = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ok: true, respuesta: null }),
    })
  })
  await decir(page, 'xyzzy plugh')

  await expect.poll(() => cuerpo !== undefined, { timeout: 15_000 }).toBe(true)
  const c = cuerpo as { texto?: string; firmas?: string[]; prompt?: string }
  expect(c.texto).toBe('xyzzy plugh')
  expect(c.firmas?.length ?? 0, 'no fue el catálogo de esta partida').toBeGreaterThan(0)
  expect(c.prompt, 'mandó un prompt: eso convierte al depósito en un proxy').toBeUndefined()
})

// ═══ Y LA OTRA MITAD: CUANDO NO LLEGA, QUE SE VEA ══════════════════════════

test('EL VIAJE SE CORTA: se marca la lámpara de CODEX, que es la que atendía', async ({ page }) => {
  await abrir(page, { contesta: { k: 'rota' } })
  // Los tres trabajos, que es lo que un depósito completo anuncia hoy.
  await expect(page.locator('#rol-codex')).toHaveText('dibuja, contesta y forja')

  await decir(page, 'xyzzy plugh')

  await expect(page.locator('#lampara-codex')).toHaveClass(/cortado/, { timeout: 15_000 })
  await expect(page.locator('#rol-codex')).toHaveText('se cortó')
  // Y la de al lado queda como estaba: Claude no tuvo nada que ver.
  await expect(page.locator('#lampara-claude')).toHaveClass(/vive/)
  await expect(page.locator('#rol-claude')).toHaveText('en espera')
})

test('LLEGÓ Y NO TRAJO NADA: lo dice, y NO dice que no llegó', async ({ page }) => {
  // El modelo contestó y no eligió ninguna firma. Es una respuesta legítima y
  // decir «no llegué» sobre eso sería la misma mentira al revés.
  await abrir(page, { contesta: { k: 'nada' } })
  await decir(page, 'xyzzy plugh')

  await expect(page.locator('#rol-codex')).toHaveText('no trajo nada', { timeout: 15_000 })
  await expect(page.locator('#enlace-nota')).toContainText('contestó')
  await expect(page.locator('#enlace-nota')).not.toContainText('puerto')
})

test('SIN DEPÓSITO NO HAY A QUIÉN, y la nota lo dice sin ensuciar una lámpara', async ({ page }) => {
  await abrir(page, { contesta: { k: 'sin-deposito' } })
  await decir(page, 'xyzzy plugh')

  await expect(page.locator('#no-llego')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('#registro')).toContainText('no pude pensarlo mejor')
})

test('EL CARTEL APARECE, DICE QUÉ SE PERDIÓ Y SE VA SOLO', async ({ page }) => {
  await abrir(page, { contesta: { k: 'rota' } })
  await expect(page.locator('#no-llego')).toBeHidden()

  await decir(page, 'xyzzy plugh')

  await expect(page.locator('#no-llego')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('#no-llego-que')).toContainText('se cortó')
  // La frase que quedó sin atender: sin esto el cartel dice que algo falló y no
  // qué, que es la mitad inútil de un aviso.
  await expect(page.locator('#no-llego-sobre')).toContainText('xyzzy plugh')

  // Y se va: un aviso que interrumpe y se queda deja de interrumpir a los dos
  // minutos. Son los siete segundos de `MS_QUE_DURA_EL_AVISO`.
  await expect(page.locator('#no-llego')).toBeHidden({ timeout: 15_000 })
  // La lámpara NO se va con él: es la que queda cuando el cartel se apaga.
  await expect(page.locator('#lampara-codex')).toHaveClass(/cortado/)
})

test('LA NOTA DICE EL PORQUÉ Y EL CARTEL EL QUÉ, y no se repiten', async ({ page }) => {
  // Se dibujan a tres píxeles de distancia. Con el mismo texto en los dos, la
  // esquina lo decía dos veces seguidas y se leía como un defecto de render.
  await abrir(page, { contesta: { k: 'rota' } })
  await decir(page, 'xyzzy plugh')
  await expect(page.locator('#no-llego')).toBeVisible({ timeout: 15_000 })

  const nota = await page.locator('#enlace-nota').textContent()
  const cartel = await page.locator('#no-llego-que').textContent()
  expect(nota, 'la nota y el cartel dicen lo mismo').not.toBe(cartel)
  expect(nota ?? '').not.toBe('')
})

test('CON EL CLI AUSENTE, la luz apagada gana y el intento se suma al detalle', async ({ page }) => {
  // `cortado` quiere decir «está y no le llegué». Sobre una lámpara apagada
  // mandaría a buscar un cable cuando lo que falta es el programa.
  await abrir(page, { contesta: { k: 'rota' }, codexVive: false })
  await decir(page, 'xyzzy plugh')

  await expect(page.locator('#lampara-codex')).toHaveAttribute('title', /el juego le quiso hablar/, {
    timeout: 15_000,
  })
  await expect(page.locator('#lampara-codex')).not.toHaveClass(/cortado/)
  await expect(page.locator('#no-llego')).toBeVisible()
})

test('EL PUNTO TITILA Y NO RESPIRA: las dos luces prendidas se distinguen', async ({ page }) => {
  // La misma trampa que el spec de las luces documenta: una clase bien puesta
  // sobre un `@keyframes` mal escrito da verde en node y un punto muerto acá.
  await abrir(page, { contesta: { k: 'rota' } })
  await decir(page, 'xyzzy plugh')
  await expect(page.locator('#lampara-codex')).toHaveClass(/cortado/, { timeout: 15_000 })

  const corriendo = await page
    .locator('#lampara-codex i')
    .evaluate((el) => el.getAnimations({ subtree: true }).map((a) => (a as CSSAnimation).animationName))
  expect(corriendo, 'el titileo no arrancó').toContain('titilar')
  expect(corriendo, 'sigue respirando: se ve igual que «vive»').not.toContain('respirar')
})

// ─── Y EL OTRO PUERTO, QUE SIGUE VACÍO ─────────────────────────────────────
//
// El chat ya tiene a quién preguntarle; la FRAGUA no. Cuando a la criatura le
// falta una habilidad, sigue sin haber nadie que se la escriba — y ése es
// justamente el caso de la partida que originó todo este tramo.
//
// Acá no se marca ninguna lámpara a propósito: que no haya nadie anunciado para
// ese trabajo es información, y ensuciar la de Codex —que sí atiende, pero otra
// cosa— la escondería.
test('EL HUECO DE LA FRAGUA YA TIENE DUEÑO, y cuando no llega se ve', async ({ page }) => {
  // Este spec decía lo contrario hasta que la fragua se enchufó: afirmaba que
  // «no hay a quién pedírselo» y que ninguna lámpara se marcaba, porque nadie
  // forjaba. Hoy forja Codex, así que el hueco tiene dueño y el aviso cambió de
  // clase — ya no es «no tengo a quién», es «le pedí y no llegué».
  await abrir(page, { contesta: { k: 'nada' } })
  await expect(page.locator('#rol-codex')).toHaveText('dibuja, contesta y forja')

  // Sin pedirle nada: la costura se dispara sola viviendo. Medido en este
  // fixture, alrededor del tick 90.
  await page.locator('[data-vel="16"]').click()
  await expect(page.locator('#lampara-codex')).toHaveClass(/cortado/, { timeout: 90_000 })
  await page.locator('[data-vel="0"]').click()

  // Y la marca cae en Codex porque `/salud` dice que ÉL forja. Con `forja: null`
  // no se marcaría ninguna, que es el caso del test de abajo.
  await expect(page.locator('#rol-codex')).toHaveText('se cortó')
  await expect(page.locator('#no-llego')).toBeVisible()
})

test('y si NADIE forja, no se ensucia ninguna lámpara', async ({ page }) => {
  // El control del reparto: la lámpara que se marca sale del dato de `/salud`,
  // no de una suposición. Un depósito que dibuja y contesta pero no forja deja
  // el hueco sin dueño, y eso es información — no un lugar donde poner la culpa.
  await abrir(page, { contesta: { k: 'nada' }, forja: false })
  await expect(page.locator('#rol-codex')).toHaveText('dibuja y contesta')

  await page.locator('[data-vel="16"]').click()
  await expect(page.locator('#no-llego')).toBeVisible({ timeout: 90_000 })
  await page.locator('[data-vel="0"]').click()

  await expect(page.locator('#lampara-codex')).not.toHaveClass(/cortado/)
  await expect(page.locator('#lampara-claude')).not.toHaveClass(/cortado/)
})
