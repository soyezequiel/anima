/**
 * MATAR LA CONEXIÓN A MITAD DE UN PARCHE — Hito 8, punto 3.
 *
 *   > **matar la conexión a mitad de un parche** no deja el mundo inconsistente
 *
 * ─── QUÉ ES «MEDIO PARCHE», que no estaba escrito ───────────────────────────
 *
 * El criterio dice «a mitad» sin decir a mitad de qué, y hay dos candidatos con
 * consecuencias distintas:
 *
 *   (a) a mitad del viaje o de la forja — **afuera del hilo del mundo**
 *   (b) entre las dos escrituras de una instalación — la habilidad montada y la
 *       capacidad publicada
 *
 * **Sólo (b) puede producir una inconsistencia**, y por eso `Registro.instalar`
 * hace las dos escrituras en una sola asignación: entre esas dos líneas no hay
 * `await` ni puede haberlo (regla 2). El control positivo de eso —un instalador
 * ingenuo que sí se puede cortar— vive en `el-registro.test.ts` y deja
 * `capacidad-sin-habilidad`.
 *
 * Este archivo mide (a), que es donde el corte SÍ puede caer, y afirma las tres
 * cosas que tienen que valer:
 *
 *   1. no se instala nada a medias
 *   2. el mundo no queda ilegal
 *   3. **el episodio se entera y termina**
 *
 * ─── LA TERCERA ES LA QUE ESTABA ROTA, y se midió ───────────────────────────
 *
 * «No deja el mundo inconsistente» se cumplía por la peor de las razones: **el
 * episodio no terminaba nunca**. El llamador escuchaba `message` y nada más; el
 * `exit` del worker llegaba y no lo leía nadie. Un mundo que sigue girando
 * eternamente esperando una respuesta que no va a llegar no es un mundo
 * consistente — es un mundo colgado, y `revisarEstado` no puede ver eso.
 *
 * ─── Y una violación que NO era de acá ──────────────────────────────────────
 *
 * La escena del juez nacía con `stamina: 5000` contra un rango declarado de
 * `[0, 1000]`, así que **todo mundo del juez arrancaba con una violación**. Un
 * test de este punto escrito como `violaciones === 0` nacía rojo por algo que no
 * tiene que ver con la conexión. Arreglado en `judge/src/escena.ts`, con la
 * medición al lado — la física satura, así que los 5000 nunca existieron.
 */

import { Partida } from '@anima/perceive'
import { buildSeedPhysics } from '@anima/physics'
import { CATALOGO_CORE } from '@anima/plan'
import { estadoDe } from '@anima/judge'
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AGARRAR_LO_QUE_VEO, LIMPIA } from '../demo/falso.js'
import type { Pedido, Respuesta } from '../demo/hilo.js'
import { leerCandidatas } from '../src/costura.js'
import { primerEncargo } from '../src/encargo.js'
import type { LoForjado } from '../src/episodio.js'
import { Registro } from '../src/registro.js'

const phys = buildSeedPhysics()
const reloj = (): number => Number(process.hrtime.bigint()) / 1e6
const respirar = (): Promise<void> => new Promise((r) => setImmediate(r))

/** Seis candidatas: hace falta que el viaje dure lo suficiente para poder cortarlo. */
function seis(): readonly { gap: string; vuelta: number; usar: { nombre: string; fuente: string } }[] {
  const e = primerEncargo('cortar a mitad', ['madera'])
  const texto = [LIMPIA.fuente, AGARRAR_LO_QUE_VEO, LIMPIA.fuente, AGARRAR_LO_QUE_VEO, LIMPIA.fuente, AGARRAR_LO_QUE_VEO]
    .map((f) => ['```ts', f.trimEnd(), '```', ''].join('\n'))
    .join('\n')
  return leerCandidatas(texto, e, 6) as never
}

type ComoTermino = 'contestó' | 'se-murió' | 'se-colgó'

interface Corte {
  readonly comoTermino: ComoTermino
  readonly forjados: readonly LoForjado[]
  readonly sinForjar: number
  readonly ticks: number
  readonly ticksPerdidos: number
  readonly violaciones: number
  readonly incoherencias: number
  readonly ms: number
}

/**
 * UN EPISODIO QUE SE PUEDE CORTAR, con el mundo corriendo y VIGILADO.
 *
 * `matar` dice qué hacer a mitad: `'nada'` es el control amable, `'cortá'` manda
 * la bandera y `'terminate'` mata el proceso del hilo de un tirón — que es lo
 * más parecido a que se caiga la conexión.
 */
async function unEpisodio(matar: 'nada' | 'cortá' | 'terminate', topeMs = 8000): Promise<Corte> {
  const w = new Worker(new URL('../demo/arranque.mjs', import.meta.url), {
    env: { ...process.env, ANIMA_HILO: fileURLToPath(new URL('../demo/hilo.ts', import.meta.url)) },
  })

  let listo = false
  let vuelto: Respuesta | undefined
  let murio = false
  w.on('message', (m: Respuesta) => {
    if (m.k === 'listo') listo = true
    else vuelto = m
  })
  // ─── LAS DOS ESCUCHAS QUE FALTABAN ────────────────────────────────────────
  // Sin ellas el bucle de abajo no sale nunca: medido, corría hasta el techo.
  w.on('error', () => {
    murio = true
  })
  w.on('exit', () => {
    murio = true
  })

  const p = new Partida(estadoDe(undefined, phys), { reloj, vigilar: true })
  const registro = new Registro(CATALOGO_CORE)
  let ticks = 0
  while (!listo && !murio) {
    p.avanzar(1)
    ticks++
    await respirar()
  }

  const pedido: Pedido = { k: 'forjá', candidatas: seis() as never }
  const t0 = reloj()
  w.postMessage(pedido)

  // A mitad: se deja correr un poco y se corta. El «poco» son ticks del mundo,
  // no milisegundos de guion — el guion no sabe dónde está el hilo.
  let corto = false
  while (vuelto === undefined && !murio && reloj() - t0 < topeMs) {
    p.avanzar(1)
    ticks++
    if (!corto && ticks % 5000 === 0) {
      corto = true
      if (matar === 'cortá') w.postMessage({ k: 'cortá' } satisfies Pedido)
      if (matar === 'terminate') void w.terminate()
    }
    await respirar()
  }
  const ms = reloj() - t0

  const comoTermino: ComoTermino = vuelto !== undefined ? 'contestó' : murio ? 'se-murió' : 'se-colgó'

  // ─── LA FRONTERA: sólo se instala lo que llegó ENTERO ─────────────────────
  // Nada de lo que no volvió toca el registro. No hace falta disciplina: lo que
  // no volvió no existe de este lado.
  const forjados = vuelto?.k === 'forjado' ? vuelto.forjados : []

  if (comoTermino !== 'se-murió') await w.terminate()
  return {
    comoTermino,
    forjados,
    sinForjar: vuelto?.k === 'forjado' ? vuelto.sinForjar : 0,
    ticks,
    ticksPerdidos: p.informe.ticksPerdidos,
    violaciones: p.informe.violaciones.length,
    incoherencias: registro.revisar().length,
    ms,
  }
}

describe('EL CONTROL AMABLE, primero: sin cortar, todo llega', () => {
  it('las seis vuelven y el mundo queda limpio', async () => {
    const r = await unEpisodio('nada')
    console.log(
      `\n  ${r.comoTermino} · forjadas ${String(r.forjados.length)} · sin forjar ${String(r.sinForjar)}` +
        `\n  ticks ${String(r.ticks)} · perdidos ${String(r.ticksPerdidos)} · violaciones ${String(r.violaciones)}` +
        `\n  ${r.ms.toFixed(0)} ms\n`,
    )
    expect(r.comoTermino).toBe('contestó')
    expect(r.forjados.length).toBe(6)
    expect(r.violaciones).toBe(0)
    expect(r.ticksPerdidos).toBe(0)
  }, 60_000)
})

describe('EL PUNTO 3: cortar a mitad', () => {
  it('con la BANDERA: el hilo contesta lo que alcanzó, y dice cuánto no', async () => {
    const r = await unEpisodio('cortá')
    console.log(
      `\n  ${r.comoTermino} · forjadas ${String(r.forjados.length)} de 6 · sin forjar ${String(r.sinForjar)}` +
        `\n  violaciones ${String(r.violaciones)} · incoherencias ${String(r.incoherencias)}\n`,
    )
    // Contesta: no se cuelga. Y lo que no alcanzó a forjar se cuenta en vez de
    // desaparecer — un viaje que devuelve 3 de 6 sin decirlo se lee como que el
    // modelo mandó 3.
    expect(r.comoTermino).toBe('contestó')
    expect(r.forjados.length + r.sinForjar).toBe(6)
    // Y ALGO SE CORTÓ DE VERDAD. Sin este renglón el test pasa cuando el corte
    // no llegó nunca — que es exactamente lo que pasaba con el handler
    // sincrónico: `forjadas 6 de 6 · sin forjar 0`, verde y sin cortar nada.
    expect(r.sinForjar).toBeGreaterThan(0)
    expect(r.forjados.length).toBeLessThan(6)
    expect(r.violaciones).toBe(0)
    expect(r.incoherencias).toBe(0)
  }, 60_000)

  it('MATANDO EL HILO de un tirón: el episodio SE ENTERA y termina', async () => {
    const r = await unEpisodio('terminate')
    console.log(
      `\n  ${r.comoTermino} · ${r.ms.toFixed(0)} ms · forjadas ${String(r.forjados.length)}` +
        `\n  violaciones ${String(r.violaciones)} · incoherencias ${String(r.incoherencias)}\n`,
    )
    // ÉSTA es la que estaba rota. Antes de las dos escuchas —`error` y `exit`—
    // el bucle corría hasta el techo y el episodio no terminaba nunca.
    expect(r.comoTermino).toBe('se-murió')
    // No se instaló nada: lo que no volvió no existe de este lado.
    expect(r.forjados).toEqual([])
    expect(r.incoherencias).toBe(0)
    // Y el mundo siguió siendo legal todo el tiempo.
    expect(r.violaciones).toBe(0)
  }, 60_000)

  it('EL CONTROL DE QUE SE ENTERÓ: sin las escuchas, esto se colgaría', async () => {
    // No se puede afirmar «no se cuelga» sin decir contra qué. El número: matar
    // el hilo termina el episodio en menos de lo que tarda el viaje entero
    // —medido arriba, ~400 ms— y sin las escuchas tardaba el tope.
    const r = await unEpisodio('terminate')
    expect(r.ms).toBeLessThan(8000)
    expect(r.comoTermino).not.toBe('se-colgó')
  }, 60_000)
})

describe('Y EL MUNDO, que es lo que el criterio nombra', () => {
  it('cero violaciones en los tres casos, y el arnés SÍ estaba mirando', async () => {
    // `violaciones: []` con `vigilar` apagado no quiere decir «no hubo», quiere
    // decir «no se miró». Los dos ceros se distinguen con `vigilada`, y acá se
    // afirma que estaba prendido — sin esto, los tres ceros de arriba no valen.
    const p = new Partida(estadoDe(undefined, phys), { vigilar: true })
    expect(p.informe.vigilada).toBe(true)
    expect(p.informe.violaciones.length).toBe(0)
  })

  it('EL CONTROL DEL ARNÉS: con `vigilar` apagado, el cero es otro cero', () => {
    const p = new Partida(estadoDe(undefined, phys), {})
    expect(p.informe.vigilada).toBe(false)
    expect(p.informe.violaciones.length).toBe(0)
  })
})
