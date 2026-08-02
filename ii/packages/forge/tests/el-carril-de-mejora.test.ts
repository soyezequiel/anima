/**
 * EL CARRIL DE MEJORA — Hito 8, punto 6.
 *
 *   > una habilidad **degradada a propósito** entra en la cola, se re-forja en el
 *   > fondo y la ganadora **reemplaza sin perder un tick**
 *
 * Son cuatro afirmaciones en una oración, y acá va cada una con su control:
 *
 *   6a  la degradada ENTRA en la cola     ← control: la sana NO entra
 *   6b  se re-forja EN EL FONDO           ← control: el mundo corrió mientras tanto
 *   6c  la ganadora REEMPLAZA             ← control: la perdedora no
 *   6d  SIN PERDER UN TICK                ← control: adentro del hilo se pierden
 *
 * ─── El control de (6d) vive ACÁ y no en otro archivo ───────────────────────
 *
 * Un adversario lo marcó del tramo H: *«el `ticksPerdidos === 0` del archivo
 * nuevo puede ser el cero estructural otra vez, porque el control vive en OTRO
 * archivo y sostiene OTRA Partida»*. Así que el carril corre dos veces con la
 * misma partida y el mismo material: una con la fragua afuera y otra adentro.
 */

import { CONTRA_EL_RELOJ, NO_SE_AFIRMA } from './reloj-de-pared.js'
import { Partida } from '@anima/perceive'
import { buildSeedPhysics } from '@anima/physics'
import { CATALOGO_CORE } from '@anima/plan'
import { done, fail, instrument, mount, shadowScope } from '@anima/skills'
import type { FuelCell, Skill } from '@anima/skills'
import { duelo, estadoDe, GRAVEDAD_DE } from '@anima/judge'
import type { Dictamen } from '@anima/judge'
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { AGARRAR_LO_QUE_VEO, LIMPIA } from '../demo/falso.js'
import type { Pedido, Respuesta } from '../demo/hilo.js'
import { forjarUna } from '../src/forjar.js'
import { loQueVaAfuera, tibiarElMontaje, VENTANA_MS } from '../src/episodio.js'
import type { LoForjado } from '../src/episodio.js'
import { colaDeMejora, gapDeLaReforja, K_DE_MEJORA, VUELTAS_POR_HABILIDAD } from '../src/mejora.js'
import type { CargoDelJuez } from '../src/registro.js'
import { Registro } from '../src/registro.js'
import type { Instalada } from '../src/registro.js'
import { Puerta } from '../src/puerta.js'

const phys = buildSeedPhysics()
const reloj = (): number => Number(process.hrtime.bigint()) / 1e6
const respirar = (): Promise<void> => new Promise((r) => setImmediate(r))

// El primer montaje del proceso se paga acá, con el mundo sin arrancar. Ver
// `tibiarElMontaje` — la frontera del PRIMER episodio se pasa de la ventana.
tibiarElMontaje(ts)

/** El orden de los grados lo pone el juez, no la fragua. */
const empeoro = (antes: string, ahora: string): boolean =>
  (GRAVEDAD_DE[ahora as keyof typeof GRAVEDAD_DE] ?? 3) > (GRAVEDAD_DE[antes as keyof typeof GRAVEDAD_DE] ?? 3)

const CUANDO_LA_PROMOVIERON: readonly CargoDelJuez[] = [
  { cargo: 'plano', grado: 'promueve', porque: 'se sintetiza' },
  { cargo: 'construccion', grado: 'promueve', porque: 'llega donde debe' },
  { cargo: 'uso', grado: 'promueve', porque: '1 de 1 promesas verificadas' },
  { cargo: 'utilidad', grado: 'inconcluso', porque: 'no hay contra qué' },
]

/** La misma habilidad, medida hoy, con `uso` caído. Es la degradación. */
const HOY_DEGRADADA: readonly CargoDelJuez[] = CUANDO_LA_PROMOVIERON.map((c) =>
  c.cargo === 'uso' ? { ...c, grado: 'no-promueve', porque: 'DIJO QUE SÍ Y NO ES CIERTO' } : c,
)

function montar(codigo: string, nombre: string): { skill: Skill<Record<string, never>>; cell: FuelCell } {
  const { js } = instrument(ts, codigo)
  const m = mount(js, { scope: shadowScope(), modules: { '../../src/skill-api.js': { done, fail } } })
  const f = m.exports[nombre]
  if (typeof f !== 'function') throw new Error(`${nombre} no quedó montada`)
  return { skill: f as Skill<Record<string, never>>, cell: m.cell }
}

function instalada(nombre: string, codigo: string, porQue: readonly CargoDelJuez[]): Instalada {
  const i = forjarUna(codigo, new Puerta(ts))
  const { skill, cell } = montar(i.codigo, nombre)
  return { nombre, codigo: i.codigo, skill, cell, porQue }
}

describe('(6a) LA DEGRADADA ENTRA EN LA COLA', () => {
  const titulares = [{ nombre: 'agarrarLoQueVeo', porQue: CUANDO_LA_PROMOVIERON }]

  it('cayó `uso`, así que entra — y dice en qué cargo cayó', () => {
    const cola = colaDeMejora(titulares, new Map([['agarrarLoQueVeo', HOY_DEGRADADA]]), empeoro)
    console.log(`\n  cola: ${cola.map((p) => `${p.nombre} (${p.porque})`).join(' · ')}\n`)
    expect(cola.length).toBe(1)
    expect(cola[0]?.motivo).toBe('degradada')
    expect(cola[0]?.cargosQueCayeron).toEqual(['uso'])
  })

  it('EL CONTROL: la MISMA titular sin degradar NO entra', () => {
    // Sin esto, «la degradada entra» lo cumple una cola que mete todo — y una
    // cola que mete todo dispara un viaje por habilidad por tick.
    const cola = colaDeMejora(titulares, new Map([['agarrarLoQueVeo', CUANDO_LA_PROMOVIERON]]), empeoro)
    expect(cola).toEqual([])
  })

  it('y una que MEJORÓ tampoco entra', () => {
    const mejor = CUANDO_LA_PROMOVIERON.map((c) =>
      c.cargo === 'utilidad' ? { ...c, grado: 'promueve' } : c,
    )
    expect(colaDeMejora(titulares, new Map([['agarrarLoQueVeo', mejor]]), empeoro)).toEqual([])
  })

  it('el tope de vueltas la saca de la cola, aunque siga caída', () => {
    // Sin tope, una habilidad que no se puede mejorar vuelve para siempre y se
    // come el presupuesto de todas las demás.
    const gastada = [{ nombre: 'agarrarLoQueVeo', porQue: CUANDO_LA_PROMOVIERON, vueltas: VUELTAS_POR_HABILIDAD }]
    expect(colaDeMejora(gastada, new Map([['agarrarLoQueVeo', HOY_DEGRADADA]]), empeoro)).toEqual([])
  })

  it('y el encargo de la re-forja NO arranca de cero: lleva lo que el juez dijo', () => {
    const cola = colaDeMejora(titulares, new Map([['agarrarLoQueVeo', HOY_DEGRADADA]]), empeoro)
    const gap = gapDeLaReforja(cola[0]!)
    console.log(`\n  gap: ${gap}\n`)
    expect(gap).toContain('agarrarLoQueVeo')
    expect(gap).toContain('uso')
  })
})

// ─── El carril entero, con el mundo corriendo ───────────────────────────────

interface Corrida {
  readonly ticks: number
  readonly ticksPerdidos: number
  /**
   * LOS QUE SE PERDIERON **MIENTRAS LA FRAGUA TRABAJABA**, que es lo que el
   * criterio quiere decir.
   *
   * ─── Por qué no alcanza con el absoluto, y está medido ────────────────────
   *
   * `ticksPerdidos` se cuenta contra un reloj de PARED. Corriendo este archivo
   * solo da 0; corriendo `pnpm ii:test` —doce paquetes peleándose 16 núcleos—
   * dio **1**. O sea que el absoluto mide la máquina y no la fragua: un núcleo
   * ocupado le come una ventana al hilo del mundo aunque la fragua esté afuera.
   *
   * Lo que el punto 6 afirma es que **la fragua no cuesta ticks**, y eso es una
   * diferencia: se mide cuántos se perdieron ANTES de mandar el trabajo y
   * cuántos después. Si la máquina pierde uno en los dos tramos, el delta es 0 y
   * el criterio se cumple. Si la fragua costara ticks, el delta subiría — y el
   * control de abajo lo demuestra: adentro del hilo, el delta es 8.
   *
   * No es un criterio más flojo: es el mismo, medido contra la línea base de la
   * misma corrida en vez de contra un cero que depende del hardware.
   */
  readonly perdidosPorLaFragua: number
  readonly forjados: readonly LoForjado[]
  readonly ms: number
}

function seisCandidatas(): string {
  // Seis bloques: es el `K = 6` que el carril de mejora usa. Cinco copias de la
  // que no sirve y una que sí, que es la forma de un viaje real — el modelo no
  // acierta seis de seis.
  const bloques = [LIMPIA.fuente, LIMPIA.fuente, LIMPIA.fuente, LIMPIA.fuente, LIMPIA.fuente, AGARRAR_LO_QUE_VEO]
  return bloques.map((f) => ['```ts', f.trimEnd(), '```', ''].join('\n')).join('\n')
}

async function conElHilo(): Promise<Corrida> {
  const w = new Worker(new URL('../demo/arranque.mjs', import.meta.url), {
    env: { ...process.env, ANIMA_HILO: fileURLToPath(new URL('../demo/hilo.ts', import.meta.url)) },
  })
  let listo = false
  let vuelto: readonly LoForjado[] | undefined
  w.on('message', (m: Respuesta) => {
    if (m.k === 'listo') listo = true
    else vuelto = m.forjados
  })

  const p = new Partida(estadoDe(undefined, phys), { reloj })
  let ticks = 0
  while (!listo) {
    p.avanzar(1)
    ticks++
    await respirar()
  }

  // LA LÍNEA BASE: lo que la máquina perdió sola, antes de mandar nada. El
  // arranque del hilo paga su typecheck frío (428 ms), así que este tramo dura
  // lo mismo que el que se va a medir.
  const perdidosAntes = p.informe.ticksPerdidos

  const { leerCandidatas } = await import('../src/costura.js')
  const { primerEncargo } = await import('../src/encargo.js')
  const e = primerEncargo('mejorar agarrarLoQueVeo', ['madera'])
  const pedido: Pedido = { k: 'forjá', candidatas: leerCandidatas(seisCandidatas(), e, K_DE_MEJORA) }

  const t0 = reloj()
  w.postMessage(pedido)
  while (vuelto === undefined) {
    p.avanzar(1)
    ticks++
    await respirar()
  }
  const ms = reloj() - t0

  p.avanzar(1)
  ticks++
  await w.terminate()
  return {
    ticks,
    ticksPerdidos: p.informe.ticksPerdidos,
    perdidosPorLaFragua: p.informe.ticksPerdidos - perdidosAntes,
    forjados: vuelto,
    ms,
  }
}

/** EL CONTROL de (6d): el mismo carril, con la fragua adentro del hilo del mundo. */
function sinElHilo(): Corrida {
  const p = new Partida(estadoDe(undefined, phys), { reloj })
  const puerta = new Puerta(ts)
  puerta.revisar('export const tibia = 1\n')
  let ticks = 0
  for (let k = 0; k < 20; k++) {
    p.avanzar(1)
    ticks++
  }
  const perdidosAntes = p.informe.ticksPerdidos
  const t0 = reloj()
  const cs = seisCandidatas()
    .split('```ts')
    .slice(1)
    .map((b) => b.split('```')[0] ?? '')
    .filter((f) => f.trim().length > 0)
  const forjados = loQueVaAfuera(
    cs.map((fuente, i) => ({ gap: 'x', vuelta: 1, usar: { nombre: `c${String(i)}`, fuente } })),
    puerta,
  )
  const ms = reloj() - t0
  for (let k = 0; k < 20; k++) {
    p.avanzar(1)
    ticks++
  }
  return {
    ticks,
    ticksPerdidos: p.informe.ticksPerdidos,
    perdidosPorLaFragua: p.informe.ticksPerdidos - perdidosAntes,
    forjados,
    ms,
  }
}

describe('(6b) y (6d) SE RE-FORJA EN EL FONDO, SIN PERDER UN TICK', () => {
  it('las seis candidatas se forjan con el mundo corriendo', async () => {
    const r = await conElHilo()
    console.log(
      `\n  K = ${String(K_DE_MEJORA)} · forjadas ${String(r.forjados.length)}` +
        `\n  el mundo avanzó ${String(r.ticks)} ticks · TICKS PERDIDOS ${String(r.ticksPerdidos)}` +
        `\n  la fragua tardó ${r.ms.toFixed(0)} ms (${(r.ms / VENTANA_MS).toFixed(0)} ventanas)\n`,
    )
    expect(r.forjados.length).toBe(K_DE_MEJORA)
    // Reloj de pared: ver `tests/reloj-de-pared.ts` y el punto 4 del Hito 11.
    if (CONTRA_EL_RELOJ) expect(r.perdidosPorLaFragua).toBe(0)
    else console.log(`    perdidos por la fragua: ${String(r.perdidosPorLaFragua)} ${NO_SE_AFIRMA}`)
    // Y el mundo corrió DE VERDAD: un carril donde el bucle no avanzó tendría
    // cero perdidos por no haber corrido nada.
    expect(r.ticks).toBeGreaterThan(100)
  }, 120_000)

  it('EL CONTROL, en ESTE archivo: el mismo carril adentro del hilo SÍ pierde ticks', () => {
    const r = sinElHilo()
    console.log(`\n  adentro del hilo: ${String(r.ticksPerdidos)} perdidos en ${String(r.ticks)} · ${r.ms.toFixed(0)} ms\n`)
    expect(r.forjados.length).toBe(K_DE_MEJORA)
    expect(r.ticksPerdidos).toBeGreaterThan(0)
  }, 120_000)
})

describe('(6c) LA GANADORA REEMPLAZA, y la perdedora no', () => {
  const dictamen = (nombre: string, cargos: readonly CargoDelJuez[]): Dictamen => ({
    habilidad: nombre,
    cargos: cargos.map((c) => ({
      cargo: c.cargo as never,
      grado: c.grado as never,
      porque: c.porque,
      corrida: { mundos: 5, aprobados: 5, adversos: 2, adversosAprobados: 2 },
    })),
    grado: 'inconcluso',
    regresiones: [],
  })

  it('la retadora que mejora `uso` entra al registro y desplaza a la titular', () => {
    const r = new Registro(CATALOGO_CORE)
    const vieja = instalada('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO, HOY_DEGRADADA)
    r.instalar(CATALOGO_CORE, vieja)

    const d = duelo(dictamen('titular', HOY_DEGRADADA), dictamen('retadora', CUANDO_LA_PROMOVIERON))
    console.log(`\n  ${d.reemplaza ? 'REEMPLAZA' : 'no reemplaza'} — ${d.porque}\n`)
    expect(d.reemplaza).toBe(true)

    const nueva = instalada('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO, CUANDO_LA_PROMOVIERON)
    r.instalar(CATALOGO_CORE, nueva)

    expect(r.titulares.size).toBe(1)
    expect(r.titular('agarrarLoQueVeo')?.porQue).toBe(CUANDO_LA_PROMOVIERON)
    expect(r.revisar()).toEqual([])
  })

  it('EL CONTROL: la retadora PEOR no reemplaza, y la titular queda', () => {
    const r = new Registro(CATALOGO_CORE)
    r.instalar(CATALOGO_CORE, instalada('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO, CUANDO_LA_PROMOVIERON))

    const d = duelo(dictamen('titular', CUANDO_LA_PROMOVIERON), dictamen('retadora', HOY_DEGRADADA))
    expect(d.reemplaza).toBe(false)
    // Y si no reemplaza, no se instala: la titular sigue siendo la de antes.
    expect(r.titular('agarrarLoQueVeo')?.porQue).toBe(CUANDO_LA_PROMOVIERON)
  })

  it('y el reemplazo entra en una ventana de tick, medido', () => {
    // «Sin perder un tick» del lado del hilo del mundo: lo único que se paga acá
    // es montar la ganadora, y el tramo H midió que son 2,4 ms tibios.
    const r = new Registro(CATALOGO_CORE)
    r.instalar(CATALOGO_CORE, instalada('agarrarLoQueVeo', AGARRAR_LO_QUE_VEO, HOY_DEGRADADA))
    const codigo = r.titular('agarrarLoQueVeo')?.codigo ?? ''

    const t0 = reloj()
    const { skill, cell } = montar(codigo, 'agarrarLoQueVeo')
    r.instalar(CATALOGO_CORE, {
      nombre: 'agarrarLoQueVeo',
      codigo,
      skill,
      cell,
      porQue: CUANDO_LA_PROMOVIERON,
    })
    const ms = reloj() - t0

    console.log(`\n  el reemplazo entero: ${ms.toFixed(1)} ms de una ventana de ${String(VENTANA_MS)}\n`)
    // Reloj de pared: ver `tests/reloj-de-pared.ts`.
    if (CONTRA_EL_RELOJ) expect(ms).toBeLessThan(VENTANA_MS)
    else console.log(`    ${ms.toFixed(1)} ms ${NO_SE_AFIRMA}`)
  })
})
