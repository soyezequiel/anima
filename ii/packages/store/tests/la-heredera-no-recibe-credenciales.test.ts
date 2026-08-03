// ═══ HITO 10 · punto 5 — NINGUNA CREDENCIAL REGALADA ════════════════════════
//
// > una heredera arranca con la biblioteca completa y **ninguna credencial
// > regalada**
//
// El ADR 0009 lo dice en una frase: **«El legado es testimonio, no memoria»**, y
// lo desarma en dos:
//
//   · el conocimiento entra como hipótesis «según mi antecesora…», con confianza
//     limitada — puede confirmarla con evidencia propia o verla morir;
//   · las habilidades entran como candidatas y **vuelven a ganarse la vara en su
//     propio mundo**.
//
// Este archivo cierra la primera. La segunda está medida y dicha al final.
//
// ─── EL NÚMERO DEL ADR NO SE PUEDE USAR, Y ESTÁ MEDIDO ──────────────────────
//
// El ADR pide confianza heredada «≤0.65». Medido sobre el instinto de fábrica de
// esta arquitectura:
//
//     filas de instinto ........................... 5
//     medias ...................................... 0,2500 y 0,7500
//     las que YA pasan el tope de 0,65 ............ 4 de 5
//
// **Una recién nacida ya está más segura que el tope.** Aplicarlo dejaría a la
// heredera peor que si no hubiera heredado nada. Es el tercer número de la
// propuesta original que dejó de corresponder —después del «40 a 60 habilidades»
// del Hito 9 y del «< 100 ms» del Hito 10— y se reemplaza por las dos garantías
// que sí se pueden poner rojas.

import { describe, expect, it } from 'vitest'
import { Creencias, INSTINTO, Mente, media, vivir } from '@anima/mind'
import type { PedidoALaFragua } from '@anima/mind'
import { Partida } from '@anima/perceive'

import { comoSeGuarda, comoSeRestaura, enMemoria, guardar, heredarDe, loQueHereda, PESO_DEL_TESTIMONIO } from '../src/index.js'
import { laEscenaDelDocumento } from './escena.js'

const QUIEN = 'ana'

/** Una antecesora que vio cinco veces que el agua rinde. */
function laQueVivio(): { c: Creencias; ctx: string; rinde: string } {
  const c = new Creencias()
  const ctx = c.contextos()[0] as string
  const rinde = c.tagsDe(ctx)[0] as string
  for (let i = 0; i < 5; i++) c.observe(ctx, rinde, true)
  return { c, ctx, rinde }
}

describe('(Hito 10 · 5) la heredera recibe testimonio, no credenciales', () => {
  it('LA MEDICIÓN QUE TIRA EL NÚMERO DEL ADR: el instinto de fábrica ya pasa el 0,65', () => {
    const ms = INSTINTO.map((i) => media(i.prior))
    const pasan = ms.filter((m) => m > 0.65).length
    console.log(
      `\n─── EL INSTINTO DE FÁBRICA CONTRA EL TOPE DEL ADR ───\n` +
        `  filas de instinto ..... ${String(INSTINTO.length)}\n` +
        `  medias ................ ${[...new Set(ms.map((m) => m.toFixed(4)))].sort().join(' · ')}\n` +
        `  ya pasan el 0,65 ...... ${String(pasan)} de ${String(ms.length)}\n`,
    )
    expect(pasan).toBeGreaterThan(0)
  })

  it('LA GARANTÍA 1: la heredera nunca queda más segura que su antecesora', () => {
    const { c, ctx, rinde } = laQueVivio()
    const heredera = loQueHereda(comoSeGuarda(laEscenaDelDocumento(), c, QUIEN))
    const antes = media(c.belief(ctx, rinde))
    const despues = media(heredera.belief(ctx, rinde))
    console.log(
      `\n─── LO QUE SE HEREDA ───\n` +
        `  la antecesora, tras 5 aciertos .. ${antes.toFixed(4)}\n` +
        `  la heredera ..................... ${despues.toFixed(4)}\n` +
        `  el peso del testimonio .......... ${String(PESO_DEL_TESTIMONIO)}\n`,
    )
    expect(despues).toBeLessThan(antes)
  })

  it('LA GARANTÍA 2: el testimonio vale menos que verlo uno mismo', () => {
    // La misma cantidad de evidencia, por los dos caminos. La que lo vio queda
    // estrictamente más segura que la que se lo escuchó contar.
    const { c, ctx, rinde } = laQueVivio()
    const contado = loQueHereda(comoSeGuarda(laEscenaDelDocumento(), c, QUIEN))
    const visto = new Creencias()
    for (let i = 0; i < 5; i++) visto.observe(ctx, rinde, true)
    console.log(
      `  me lo contaron: ${media(contado.belief(ctx, rinde)).toFixed(4)} · ` +
        `lo vi yo: ${media(visto.belief(ctx, rinde)).toFixed(4)}`,
    )
    expect(media(contado.belief(ctx, rinde))).toBeLessThan(media(visto.belief(ctx, rinde)))
  })

  it('EL CONTROL: RESTAURAR no descuenta nada — la misma criatura que vuelve se acuerda entera', () => {
    // Sin esto, «heredar descuenta» no diría si el descuento es del heredar o de
    // pasar por un archivo. Acordarse y que te cuenten son dos operaciones
    // distintas y sólo una descuenta.
    const { c, ctx, rinde } = laQueVivio()
    const g = comoSeGuarda(laEscenaDelDocumento(), c, QUIEN)
    const vuelta = comoSeRestaura(g).creencias
    console.log(
      `  la que vivió: ${media(c.belief(ctx, rinde)).toFixed(4)} · ` +
        `la MISMA restaurada: ${media(vuelta.belief(ctx, rinde)).toFixed(4)} · ` +
        `una HEREDERA: ${media(loQueHereda(g).belief(ctx, rinde)).toFixed(4)}`,
    )
    expect(vuelta.belief(ctx, rinde)).toEqual(c.belief(ctx, rinde))
    expect(media(loQueHereda(g).belief(ctx, rinde))).toBeLessThan(media(vuelta.belief(ctx, rinde)))
  })

  it('y hereda por el depósito, que es como pasa de verdad', async () => {
    const { c, ctx, rinde } = laQueVivio()
    const d = enMemoria()
    await guardar(d, laEscenaDelDocumento(), c, QUIEN)
    const heredera = await heredarDe(d, QUIEN)
    expect(heredera).toBeDefined()
    expect(media((heredera as Creencias).belief(ctx, rinde))).toBeLessThan(media(c.belief(ctx, rinde)))
    // Y no hereda de quien no existe: no estar es una respuesta, no un error.
    expect(await heredarDe(d, 'nadie')).toBeUndefined()
  })

  it('LA MITAD QUE NO SE PUEDE CERRAR TODAVÍA, dicha: no hay biblioteca que heredar', () => {
    // ─── POR QUÉ ESTA MITAD NO SE IMPLEMENTA, MEDIDO ────────────────────────
    //
    // El punto 5 pide que la heredera arranque «con la biblioteca completa», y la
    // biblioteca es el overlay de capacidades del catálogo. Medido en el Hito 9
    // (M1) y sin cambios desde entonces: **ninguna partida registra una sola
    // capacidad**. `conOverlay` lo llama únicamente el `Registro` de la fragua, y
    // la fragua no está enchufada a ninguna partida.
    //
    // O sea que guardar la biblioteca hoy sería guardar una lista vacía, y
    // afirmar «la heredera arrancó con la biblioteca completa» sería el verde por
    // omisión más caro que quedaba: cierto porque no hay nada.
    //
    // Entra cuando exista lo que mide — el Hito 10 no puede cerrar esa mitad, la
    // abre el día que una partida promueva algo. Y el vocabulario para que entre
    // `provisional` en vez de `estable` YA ESTÁ (M6 del criterio), así que lo que
    // falta es el gesto, no el concepto.
    const g = comoSeGuarda(laEscenaDelDocumento(), new Creencias(), QUIEN)
    // El guardado de hoy no tiene un campo de biblioteca, y eso es lo honesto:
    // un campo vacío se lee como «no había nada» y no como «no se guarda».
    //
    // ─── LA LISTA CRECIÓ EN EL C1, Y NO ES LO MISMO QUE LA BIBLIOTECA ───────
    //
    // Entró `charla` (versión 2 del guardado). La distinción que este bloque
    // cuida sigue en pie: la charla **se escribe cuando la hay** —hay una partida
    // que la produce— mientras que la biblioteca se escribiría vacía SIEMPRE,
    // porque nadie promueve una capacidad todavía. El pin se actualiza con lo que
    // afirmaba escrito al lado, que es lo único que lo hace un guardián y no un
    // número que alguien pisa cuando se pone rojo.
    expect(Object.keys(g).sort()).toEqual(['charla', 'creencias', 'mundo', 'quien', 'tick', 'version'])
  })
})

// ═══ HITO 10 · punto 7 — Y LA FRAGUA NO SE DESPIERTA EN NINGUNA DE LAS DOS ══
//
// > y en las dos, la fragua **no se despierta** — con el espía del Hito 9, no
// > con un grep
//
// No es un punto nuevo: es el del Hito 9 aplicado a las dos vidas. Y se afirma
// como allá, que es lo único que lo hace poder fallar: **contando las consultas
// PARA LA META DE LA HISTORIA**, no el total. El total no es cero y nunca lo fue
// —son las 22 de cocinar sin fuego, el rojo aceptado del Hito 5— y un `toBe(0)`
// sobre el total habría necesitado cortar la corrida para ser cierto.

describe('(Hito 10 · 7) ni la primera vida ni la heredera despiertan a la fragua', () => {
  it('cero consultas por la caña, en las dos, con el espía puesto', () => {
    const dePescar = (ps: readonly PedidoALaFragua[]): readonly PedidoALaFragua[] =>
      ps.filter((p) => p.meta === 'holding(tag:carnoso)')

    const primeros: PedidoALaFragua[] = []
    const c = new Creencias()
    const p1 = new Partida(laEscenaDelDocumento(), { vigilar: true })
    vivir(p1, new Map([[QUIEN, new Mente({ actor: QUIEN, memoria: c, costura: (x) => primeros.push(x) })]]), 300)

    const segundos: PedidoALaFragua[] = []
    const heredera = loQueHereda(comoSeGuarda(p1.state, c, QUIEN))
    const p2 = new Partida(laEscenaDelDocumento(), { vigilar: true })
    vivir(
      p2,
      new Map([[QUIEN, new Mente({ actor: QUIEN, memoria: heredera, costura: (x) => segundos.push(x) })]]),
      300,
    )

    console.log(
      `\n─── EL ESPÍA, EN LAS DOS VIDAS ───\n` +
        `  primera vida · por la caña ... ${String(dePescar(primeros).length)} de ${String(primeros.length)} consultas\n` +
        `  heredera · por la caña ....... ${String(dePescar(segundos).length)} de ${String(segundos.length)} consultas\n` +
        `  y lo demás son ............... ${[...new Set(segundos.map((x) => x.gap))].join(' · ')}\n`,
    )

    // Lo que el punto afirma.
    expect(dePescar(primeros)).toEqual([])
    expect(dePescar(segundos)).toEqual([])
    // Y LA GUARDA QUE LO HACE SIGNIFICAR ALGO: el espía estaba puesto y contó.
    // Sin esto, dos listas vacías serían el cero de «nadie miró».
    expect(segundos.length, 'el espía no contó nada: la costura no está conectada').toBeGreaterThan(0)
  })
})
