// ─── C4 · EL PROVEEDOR ENTIENDE MÁS, Y NO FRENA NADA ───────────────────────
//
// El criterio, en `docs/product/convergencia-conversacional.md`:
//
//   > una frase fuera del camino rápido se entiende con proveedor; durante la
//   > espera siguen tick, movimiento permitido y progreso; una corrección
//   > posterior invalida la respuesta vieja; una caída del proveedor deja una
//   > pregunta o bloqueo honesto, no un falso éxito.
//
// ─── LO QUE EL C1 DEJÓ PUESTO, Y LO QUE FALTABA ────────────────────────────
//
// La frontera ya estaba: `Ordenes` arma la `Consulta` y se la pasa a `preguntar`
// SIN esperarla. Lo que faltaba es la otra mitad — **qué se hace con la respuesta
// cuando llega**, que en el C1 se descartaba a propósito.
//
// El bloque que decide todo es el (1): la respuesta puede llegar en cualquier
// momento, y aplicarla ahí sería cambiarle el objetivo a la criatura en el medio
// de un tick. Se aplica en la FRONTERA, y eso se prueba resolviendo la promesa y
// afirmando que **todavía no pasó nada**.

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import type { Consulta, RespuestaDelModelo } from '@anima/lang'

import { Ordenes } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

const QUIEN = 'ana'
const SEMILLA = 20260727n

/** Una frase que el lector local NO resuelve: es la que dispara la consulta. */
const FLOJA = 'dale para el agua'
/** Lo que un modelo contestaría: una firma de las que el catálogo ofrece. */
const FIRMA = 'emitsPower>0'

/** Deja correr las promesas ya resueltas, sin tocar el mundo. */
async function microtareas(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

interface Guion {
  readonly preguntar: (c: Consulta, signal?: AbortSignal) => Promise<RespuestaDelModelo | undefined>
  /** Contesta la consulta que quedó pendiente, con la firma que se le diga. */
  contestar: (firma?: string) => void
  /** La tira abajo, como un proveedor caído. */
  romper: () => void
  readonly consultas: Consulta[]
  readonly abortadas: () => number
}

/**
 * UN PROVEEDOR DE GUION, que contesta cuando el test quiere.
 *
 * No es un mock de conveniencia: es el modo scripted que el documento pide
 * conservar como camino determinista. Lo que lo hace útil para C4 es que el test
 * decide CUÁNDO llega la respuesta, que es la variable que todo esto controla.
 */
function guion(): Guion {
  const consultas: Consulta[] = []
  let resolver: ((r: RespuestaDelModelo | undefined) => void) | undefined
  let rechazar: ((e: unknown) => void) | undefined
  let abortadas = 0
  return {
    consultas,
    abortadas: () => abortadas,
    preguntar: (c, signal) => {
      consultas.push(c)
      signal?.addEventListener('abort', () => {
        abortadas++
      })
      return new Promise((ok, mal) => {
        resolver = ok
        rechazar = mal
      })
    },
    contestar: (firma = FIRMA) => {
      const c = consultas[consultas.length - 1]
      resolver?.({ llave: c?.llave ?? '', clausulas: [{ indice: 0, firma }] })
    },
    romper: () => {
      rechazar?.(new Error('el proveedor se cayó'))
    },
  }
}

function sesion(g?: Guion): { p: Partida; o: Ordenes } {
  const { state } = arrancar(SEMILLA)
  const p = new Partida(state)
  const o = new Ordenes(p, QUIEN, PHYS, g === undefined ? {} : { preguntar: g.preguntar })
  return { p, o }
}

function correr(p: Partida, o: Ordenes, n: number): void {
  for (let k = 0; k < n; k++) {
    o.antesDelTick(p.state.tick)
    vivir(p, o.mentes, 1)
    o.despuesDelTick()
  }
}

describe('C4 · la respuesta del proveedor se aplica, y sólo en la frontera', () => {
  it('(1) LLEGA LA RESPUESTA Y NO PASA NADA HASTA EL TICK SIGUIENTE', async () => {
    const g = guion()
    const { p, o } = sesion(g)
    o.decir(FLOJA)
    expect(o.consultas, 'no se armó la consulta').toBe(1)
    expect(o.encargo, 'una frase floja no puede dejar encargo sola').toBeUndefined()

    g.contestar()
    await microtareas()

    // LA RESPUESTA YA ESTÁ Y TODAVÍA NO SE APLICÓ. Es el punto entero: aplicarla
    // al resolver sería cambiarle el objetivo a la criatura en el medio de un
    // tick, con la vista a mitad de camino.
    expect(o.encargo, 'se aplicó fuera de la frontera').toBeUndefined()
    expect(o.aplicadas).toBe(0)

    correr(p, o, 1)
    expect(o.aplicadas, 'la frontera pasó y no se aplicó nada').toBe(1)
    expect(o.encargo?.nodos[0]?.meta).toBe(FIRMA)
  })

  it('(2) EL MUNDO NO ESPERA: con la consulta colgada, la partida avanza igual', () => {
    const g = guion()
    const { p, o } = sesion(g)
    const gemela = sesion()
    o.decir(FLOJA)
    gemela.o.decir(FLOJA)

    correr(p, o, 120)
    correr(gemela.p, gemela.o, 120)

    // Sin contestar nunca: el mundo tiene que quedar donde queda sin proveedor.
    const donde = (x: Partida): string => JSON.stringify(x.state.bodies.get(`${QUIEN}-cuerpo`)?.at)
    expect(donde(p)).toBe(donde(gemela.p))
    expect(o.aplicadas).toBe(0)
  })

  it('(3) UNA CORRECCIÓN INVALIDA LA RESPUESTA VIEJA', async () => {
    const g = guion()
    const { p, o } = sesion(g)
    o.decir(FLOJA)
    // El cuidador se corrige antes de que el modelo conteste.
    o.decir('hacé fuego')
    const meta = o.encargo?.nodos[0]?.meta
    expect(meta, 'la corrección tiene que dejar su propio encargo').toBeDefined()

    // Y AHORA contesta la vieja. No puede pisar lo que se pidió después.
    g.contestar('holding(tag:carnoso)')
    await microtareas()
    correr(p, o, 1)

    expect(o.encargo?.nodos[0]?.meta, 'una respuesta tardía piso un encargo más nuevo').toBe(meta)
    expect(o.descartadas, 'la respuesta vieja no se contó como descartada').toBe(1)
  })

  it('(4) Y LA CORRECCIÓN LA CANCELA, no sólo la ignora', () => {
    const g = guion()
    const { o } = sesion(g)
    o.decir(FLOJA)
    o.decir('hacé fuego')
    // Ignorar una respuesta que ya se pagó es tarde: el `AbortSignal` es lo que
    // hace que el proveedor pueda cortar el viaje.
    expect(g.abortadas(), 'la consulta vieja no se abortó').toBe(1)
  })

  it('(5) UNA CAÍDA DEJA UN AVISO HONESTO, no un falso éxito', async () => {
    const g = guion()
    const { p, o } = sesion(g)
    o.decir(FLOJA)
    g.romper()
    await microtareas()
    correr(p, o, 1)

    expect(o.encargo, 'un proveedor caído no puede dejar un encargo').toBeUndefined()
    // Se busca el `aviso` en el log y no se mira la ÚLTIMA línea: lo que se
    // afirma es que la caída SE DIJO, no que sea lo último que se dijo. El tick
    // que corre después puede narrar un paso, y eso no la borra — el día que
    // alguien agregue otra línea de progreso, este test no tiene por qué
    // enterarse.
    expect(o.charla.some((d) => d.clase === 'aviso'), 'la caída no se dijo').toBe(true)
    expect(o.aplicadas).toBe(0)
  })

  it('(6) EL MODO SCRIPTED ES DETERMINISTA: dos gemelas, el mismo mundo y el mismo log', async () => {
    const uno = { g: guion(), s: sesion() }
    const dos = { g: guion(), s: sesion() }
    for (const x of [uno, dos]) {
      x.s = sesion(x.g)
      x.s.o.decir(FLOJA)
      x.g.contestar()
    }
    await microtareas()
    for (const x of [uno, dos]) correr(x.s.p, x.s.o, 60)

    const huella = (p: Partida): string =>
      `${JSON.stringify(p.state.bodies.get(`${QUIEN}-cuerpo`)?.at)}|${[...(p.state.actors.get(QUIEN)?.holding ?? [])].sort().join(',')}`
    expect(huella(uno.s.p)).toBe(huella(dos.s.p))
    expect(uno.s.o.charla.map((d) => `${d.clase}:${d.texto}`)).toEqual(
      dos.s.o.charla.map((d) => `${d.clase}:${d.texto}`),
    )
  })

  it('(7) SIN PROVEEDOR NO CAMBIA NADA: el camino rápido sigue siendo el de siempre', () => {
    // El control que hace que todo lo de arriba signifique algo: la app sin
    // proveedor tiene que comportarse exactamente como en el C3.
    const { p, o } = sesion()
    o.decir('hacé fuego')
    correr(p, o, 20)
    expect(o.consultas).toBe(0)
    expect(o.encargo?.nodos[0]?.meta).toBe('emitsPower>0')
  })
})
