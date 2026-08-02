/**
 * EL EPISODIO ENTERO, CON EL MUNDO CORRIENDO — Hito 8, tramo H. Punto 5.
 *
 *   > **`ticksPerdidos === 0`** durante todo el episodio.
 *
 * ─── Qué se junta acá, que es todo el tramo ─────────────────────────────────
 *
 *   el encargo (D) → el muñeco (G) → la puerta (B) → la reparación (C)
 *   → montar (Hito 4) → el juez (Hito 7) → el encargo de la vuelta 2 (D)
 *
 * y todo eso con una `Partida` avanzando de verdad al lado.
 *
 * ─── EL CONTROL, y es el que le da sentido al cero ──────────────────────────
 *
 * Un `ticksPerdidos === 0` no vale nada si nada podía moverlo — es el verde por
 * omisión que este hito viene cazando en cada tramo. Así que el mismo episodio
 * se corre DOS veces:
 *
 *   · con la fragua en otro hilo   → tiene que dar 0
 *   · con la fragua acá adentro    → tiene que dar MÁS que 0
 *
 * El segundo no es un adorno: es la prueba de que el contador se puede mover en
 * esta corrida, con esta partida y este reloj.
 *
 * ─── Por qué el bucle respira entre ticks ───────────────────────────────────
 *
 * Porque JavaScript es de un hilo: si el bucle no le suelta el turno al planif-
 * icador, el mensaje del worker no entra nunca y el test se cuelga. El
 * `setImmediate` de cada vuelta es lo que hace que «el mundo corre mientras la
 * fragua piensa» sea verdad y no una figura.
 *
 * Y sale gratis contra la ventana: un tick pelado son 0,02 ms de los 50.
 */

import { CONTRA_EL_RELOJ, NO_SE_AFIRMA } from './reloj.js'
import { Partida } from '@anima/perceive'
import { buildSeedPhysics } from '@anima/physics'
import type { Skill } from '@anima/skills'
import { done, fail, instrument, mount, shadowScope } from '@anima/skills'
import { estadoDe, juzgar } from '@anima/judge'
import type { Dictamen } from '@anima/judge'
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { dosCandidatas } from '../demo/falso.js'
import type { Pedido, Respuesta } from '../demo/hilo.js'
import { elSiguienteEncargo, loQueEntra, loQueVaAfuera, PASOS, tibiarElMontaje, VENTANA_MS } from '../src/episodio.js'
import type { LoForjado } from '../src/episodio.js'
import { primerEncargo, textoDe } from '../src/encargo.js'
import { Puerta } from '../src/puerta.js'

const phys = buildSeedPhysics()
const GAP = 'conseguir alimento de un cuerpo de agua'
const VOCABULARIO = ['madera', 'liana', 'carne', 'agua']

/** El reloj de pared, en la frontera. `Partida` no lo puede llamar sola. */
const reloj = (): number => Number(process.hrtime.bigint()) / 1e6

/** Le suelta el turno al planificador. Ver el encabezado. */
const respirar = (): Promise<void> => new Promise((r) => setImmediate(r))

function unaPartida(): Partida {
  return new Partida(estadoDe(undefined, phys), { reloj })
}

/**
 * EL COSTO DE LA PRIMERA VEZ, medido acá arriba porque **sólo se puede medir una
 * vez por proceso**.
 *
 * La primera llamada a `transpileModule` paga la inicialización de TypeScript.
 * Si eso cayera adentro del episodio, la frontera del PRIMER episodio de una
 * partida se pasaría de la ventana — y midiendo la del segundo no se vería
 * nunca. Fue así como se encontró: la frontera dio 56,1 ms en la primera corrida
 * y 6,1 en la siguiente, con la misma línea de código.
 *
 * Se paga acá, con el mundo todavía sin arrancar, que es cuando es gratis.
 */
const MS_DEL_MONTAJE_EN_FRIO = ((): number => {
  const t = reloj()
  tibiarElMontaje(ts)
  return reloj() - t
})()

/**
 * DE TEXTO A HABILIDAD VIVA — el paso que obliga a que montar sea de este lado.
 *
 * `modules` sirve la superficie a mano porque el sandbox no lee del disco: es lo
 * mismo que hace el criterio del Hito 4 con las quince innatas. `done` y `fail`
 * son las dos únicas funciones de verdad que la API exporta.
 */
function montar(codigo: string, nombre: string): Skill<Record<string, never>> {
  const { js } = instrument(ts, codigo)
  const m = mount(js, {
    scope: shadowScope(),
    modules: { '../../src/skill-api.js': { done, fail } },
  })
  const f = m.exports[nombre]
  if (typeof f !== 'function') throw new Error(`${nombre} no quedó montada`)
  return f as Skill<Record<string, never>>
}

/** El muñeco no toma argumentos, así que el juez no tiene nada que buscar. */
function sinArgs(): Record<string, never> {
  return {} as Record<string, never>
}

/** Lo que el hilo del mundo hace con lo que volvió: montar y juzgar. */
function loQueSeHaceEnLaFrontera(fs: readonly LoForjado[]): readonly Dictamen[] {
  const out: Dictamen[] = []
  for (const f of loQueEntra(fs)) {
    const contrato = dosCandidatas(GAP).find((c) => c.usar?.nombre === f.nombre)?.contrato
    if (contrato === undefined) continue
    const skill = montar(f.codigo, f.nombre)
    out.push(juzgar({ acusada: { nombre: f.nombre, contrato }, skill, argsDe: sinArgs }, phys))
  }
  return out
}

function abrirElHilo(): Worker {
  return new Worker(new URL('../demo/arranque.mjs', import.meta.url), {
    env: { ...process.env, ANIMA_HILO: fileURLToPath(new URL('../demo/hilo.ts', import.meta.url)) },
  })
}

interface Corrida {
  readonly ticks: number
  readonly ticksPerdidos: number
  /**
   * LOS QUE SE PERDIERON MIENTRAS LA FRAGUA TRABAJABA.
   *
   * `ticksPerdidos` se cuenta contra un reloj de PARED. Este archivo solo da 0;
   * con `pnpm ii:test` —doce paquetes peleándose 16 núcleos— dio **1**. O sea que
   * el absoluto mide la máquina y no la fragua.
   *
   * Lo que el punto 5 afirma es que la fragua no cuesta ticks, y eso es una
   * DIFERENCIA contra la línea base de la misma corrida. Ver el comentario largo
   * en `el-carril-de-mejora.test.ts`.
   */
  readonly perdidosPorLaFragua: number
  readonly forjados: readonly LoForjado[]
  readonly dictamenes: readonly Dictamen[]
  readonly msDeLaFragua: number
  readonly msDeLaFrontera: number
}

/** EL EPISODIO, con la fragua del otro lado del hilo. */
async function conElHilo(): Promise<Corrida> {
  const w = abrirElHilo()
  let listo = false
  let vuelto: readonly LoForjado[] | undefined
  w.on('message', (m: Respuesta) => {
    if (m.k === 'listo') listo = true
    else vuelto = m.forjados
  })

  const p = unaPartida()
  let ticks = 0
  // Mientras el hilo levanta y paga su typecheck frío, el mundo ya corre.
  while (!listo) {
    p.avanzar(1)
    ticks++
    await respirar()
  }

  // LA LÍNEA BASE: lo que la máquina perdió sola, con el mundo corriendo y la
  // fragua todavía sin trabajo. El arranque del hilo paga su typecheck frío
  // (428 ms), así que este tramo dura lo mismo que el que se va a medir.
  const perdidosAlArrancar = p.informe.ticksPerdidos

  const pedido: Pedido = { k: 'forjá', candidatas: dosCandidatas(GAP) }
  const t0 = reloj()
  w.postMessage(pedido)
  while (vuelto === undefined) {
    p.avanzar(1)
    ticks++
    await respirar()
  }
  const msDeLaFragua = reloj() - t0

  // ─── LA FRONTERA DEL TICK ─────────────────────────────────────────────────
  // Entre dos ticks, no en el medio de uno. Es lo que el criterio pide con
  // «aplicación en frontera de tick», y acá es literal: el `avanzar` de arriba
  // ya terminó y el de abajo todavía no empezó.
  const t1 = reloj()
  const dictamenes = loQueSeHaceEnLaFrontera(vuelto)
  const msDeLaFrontera = reloj() - t1

  p.avanzar(1)
  ticks++
  await w.terminate()
  return {
    ticks,
    ticksPerdidos: p.informe.ticksPerdidos,
    perdidosPorLaFragua: p.informe.ticksPerdidos - perdidosAlArrancar,
    forjados: vuelto,
    dictamenes,
    msDeLaFragua,
    msDeLaFrontera,
  }
}

/** EL CONTROL: el mismo episodio, con la fragua adentro del hilo del mundo. */
function sinElHilo(): { readonly ticks: number; readonly ticksPerdidos: number } {
  const p = unaPartida()
  const puerta = new Puerta(ts)
  puerta.revisar('export const tibia = 1\n')
  let ticks = 0
  for (let k = 0; k < 20; k++) {
    p.avanzar(1)
    ticks++
  }
  const fs = loQueVaAfuera(dosCandidatas(GAP), puerta)
  loQueSeHaceEnLaFrontera(fs)
  for (let k = 0; k < 20; k++) {
    p.avanzar(1)
    ticks++
  }
  return { ticks, ticksPerdidos: p.informe.ticksPerdidos }
}

describe('EL PUNTO 5: `ticksPerdidos === 0` durante todo el episodio', () => {
  it('el episodio entero, con el mundo corriendo al lado', async () => {
    const r = await conElHilo()
    console.log(
      `\n  EL EPISODIO\n` +
        `    el mundo avanzó ....... ${String(r.ticks)} ticks\n` +
        `    TICKS PERDIDOS ........ ${String(r.ticksPerdidos)}\n` +
        `    la fragua tardó ....... ${r.msDeLaFragua.toFixed(0)} ms (${(r.msDeLaFragua / VENTANA_MS).toFixed(0)} ventanas)\n` +
        `    la frontera tardó ..... ${r.msDeLaFrontera.toFixed(1)} ms (ventana ${String(VENTANA_MS)})\n` +
        `    desenlaces ............ ${r.forjados.map((f) => `${f.nombre}=${f.desenlace}`).join(' · ')}\n`,
    )
    // ─── HITO 11 · punto 4 — ESTE NÚMERO MIDE CONTRA EL RELOJ DE PARED ─────
    //
    // `perdidosPorLaFragua` sale de comparar el reloj del sistema contra la
    // ventana del tick, así que **depende de cuánta CPU haya libre**. Medido:
    // este archivo pasa 6 de 6 corriendo solo y falla cuando vitest corre los 13
    // del paquete en paralelo. No falla porque el código esté mal.
    //
    // El número NO se afloja: se muda. Acá se sigue imprimiendo y se afirma lo
    // ESTRUCTURAL —que el mundo corrió y que la fragua forjó—, que es cierto con
    // la máquina cargada o libre. El `=== 0` se afirma con `ANIMA_RELOJ=1`.
    // Ver `tests/reloj.ts`.
    if (CONTRA_EL_RELOJ) expect(r.perdidosPorLaFragua).toBe(0)
    else console.log(`    perdidos por la fragua: ${String(r.perdidosPorLaFragua)} ${NO_SE_AFIRMA}`)
    // Y el mundo corrió DE VERDAD mientras tanto: un episodio donde el bucle no
    // avanzó tendría cero perdidos por no haber corrido nada. Esto SÍ se afirma
    // siempre: no mide tiempo, mide que la corrida ocurrió.
    expect(r.ticks).toBeGreaterThan(100)
    expect(r.forjados.length, 'la fragua no forjó nada: el episodio no ocurrió').toBeGreaterThan(0)
  }, 120_000)

  it('EL CONTROL: la misma fragua adentro del hilo del mundo SÍ pierde ticks', () => {
    const r = sinElHilo()
    console.log(`\n  con la fragua adentro: ${String(r.ticksPerdidos)} ticks perdidos en ${String(r.ticks)}\n`)
    // Sin esto, el cero de arriba podría ser un contador que nadie puede mover.
    expect(r.ticksPerdidos).toBeGreaterThan(0)
  }, 120_000)

  it('todo paso marcado `frontera` entra en una ventana, medido y no declarado', async () => {
    const r = await conElHilo()
    const cuantos = PASOS.filter((x) => x.donde === 'frontera').length
    console.log(
      `\n  ${String(cuantos)} pasos en la frontera · ${r.msDeLaFrontera.toFixed(1)} ms de ${String(VENTANA_MS)}` +
        `\n  y el montaje en frío, pagado ANTES de que el mundo arranque: ${MS_DEL_MONTAJE_EN_FRIO.toFixed(1)} ms\n`,
    )
    // Mismo caso que arriba: milisegundos de pared. Ver `tests/reloj.ts`.
    if (CONTRA_EL_RELOJ) expect(r.msDeLaFrontera).toBeLessThan(VENTANA_MS)
    else console.log(`    ${r.msDeLaFrontera.toFixed(1)} ms ${NO_SE_AFIRMA}`)
    // Lo estructural, que se afirma siempre: hay pasos marcados `frontera`.
    expect(cuantos).toBeGreaterThan(0)
  }, 120_000)

  it('EL CONTROL DEL TIBIADO: el frío solo ya vale una fracción grande de la ventana', () => {
    // No se exige que pase de 50 —eso sería un test que se rompe el día que
    // TypeScript arranque más rápido, o en una máquina mejor— sino que se
    // afirma lo que justifica la existencia de `tibiarElMontaje`: **no es
    // ruido**. Si algún día esto bajara de la décima parte de una ventana, la
    // función sobra y hay que borrarla.
    console.log(`\n  montaje en frío: ${MS_DEL_MONTAJE_EN_FRIO.toFixed(1)} ms · ventana ${String(VENTANA_MS)} ms\n`)
    expect(MS_DEL_MONTAJE_EN_FRIO).toBeGreaterThan(VENTANA_MS / 10)
  })
})

describe('EL PUNTO 9, con la mitad cara: compiló y NO SIRVE', () => {
  it('el juez baja a la que compila limpia, y dice por qué', async () => {
    const r = await conElHilo()
    const d = r.dictamenes[0]
    expect(d, 'no se juzgó ninguna: el contrato de la candidata no llegó').toBeDefined()
    console.log(
      `\n  ── ${d?.habilidad ?? '?'} → ${(d?.grado ?? '?').toUpperCase()} ──\n` +
        (d?.cargos ?? []).map((c) => `    ${c.cargo.padEnd(13)} ${c.grado.padEnd(12)} ${c.porque}`).join('\n') +
        '\n',
    )
    // Compiló sin una sola reparación y aun así no promueve. Es exactamente lo
    // que la puerta NO puede ver y el juez sí.
    expect(r.forjados.find((f) => f.nombre === d?.habilidad)?.desenlace).toBe('limpia')
    expect(d?.grado).not.toBe('promueve')
  }, 120_000)

  it('y el encargo de la vuelta 2 lleva el porqué del juez, sin un solo mundo', async () => {
    const r = await conElHilo()
    const cargos = r.dictamenes.flatMap((d) => d.cargos)
    const dos = elSiguienteEncargo(primerEncargo(GAP, VOCABULARIO), r.forjados, cargos)
    const t = textoDe(dos)
    console.log(`\n${t}\n`)

    expect(t).toContain('Intento 2')
    // El typo que la reparación arregló va, para que no lo vuelva a escribir.
    expect(t).toContain('ticksToNightfall')
    // Y va al menos un cargo del juez en castellano llano.
    const bajados = cargos.filter((c) => c.grado === 'no-promueve')
    expect(bajados.length).toBeGreaterThan(0)
    expect(bajados.some((c) => t.includes(c.porque))).toBe(true)

    // ─── EL GUARDIÁN: ni un id de mundo en el texto ────────────────────────
    // Es la trampa que el tramo D nombró: si se le cuentan los mundos donde
    // falló, aprende los mundos y no la habilidad. `loQueFalloDe` recibe los
    // cargos y nunca el dictamen, así que las semillas no pueden entrar.
    for (const g of r.dictamenes.flatMap((d) => d.regresiones)) {
      expect(t.includes(g.semilla), `se filtró el mundo ${g.semilla}`).toBe(false)
    }
  }, 120_000)
})
