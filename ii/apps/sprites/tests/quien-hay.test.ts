// ─── QUIÉN HAY DEL OTRO LADO, Y CUÁNTO CUESTA PREGUNTARLO ───────────────────
//
// Dos cosas se afirman acá y ninguna spawnea un proceso:
//
//   1. **el vigía no sondea de más.** Es el punto entero de que exista: `/salud`
//      es lo primero que el juego pregunta al abrir, y sin caché cada pedido
//      arrancaría dos CLIs para leer una versión que cambia una vez por mes;
//   2. **`/salud` publica lo que sabe y calla lo que no.** `modelos: null` es «no
//      sondeé todavía» y se pinta distinto de «no están» — si los mezclara, las
//      luces del juego arrancarían apagadas y se prenderían solas, que se lee
//      como una falla que se arregló.
//
// El reloj entra por parámetro y por eso esto corre en milisegundos en vez de en
// treinta segundos. Lo mismo que el resto del repo hace con el azar.

import { describe, expect, it } from 'vitest'

import { vigilar, type Modelos, type Vigia } from '../src/quien-hay.js'
import { baulEnMemoria, crearServidor } from '../src/servidor.js'

const LOS_DOS: Modelos = {
  codex: { vive: true, version: 'codex-cli 0.4.2' },
  claude: { vive: true, version: '2.0.1 (Claude Code)' },
}
const NINGUNO: Modelos = { codex: { vive: false }, claude: { vive: false } }

/** Deja correr los microtasks que el vigía encadena, sin esperar tiempo real. */
const dejarPasar = (): Promise<void> => new Promise((r) => setImmediate(r))

describe('el vigía', () => {
  it('antes del primer sondeo dice «no sé», que no es «no están»', () => {
    const v = vigilar(() => Promise.resolve(LOS_DOS))
    expect(v.ultimo()).toBeUndefined()
  })

  it('NO VUELVE A SONDEAR adentro de la misma vigencia', async () => {
    let veces = 0
    let reloj = 1000
    const v = vigilar(
      () => {
        veces++
        return Promise.resolve(LOS_DOS)
      },
      { vigenciaMs: 30_000, ahora: () => reloj },
    )

    v.mirar()
    await dejarPasar()
    expect(veces).toBe(1)
    expect(v.ultimo()).toEqual(LOS_DOS)

    // Diez pedidos más, todos adentro de la vigencia: ni un proceso más.
    reloj = 1000 + 29_999
    for (let i = 0; i < 10; i++) v.mirar()
    await dejarPasar()
    expect(veces, 'sondeó de más adentro de la vigencia').toBe(1)

    reloj = 1000 + 30_001
    v.mirar()
    await dejarPasar()
    expect(veces).toBe(2)
  })

  it('dos `mirar()` seguidos con el sondeo en curso lanzan UNO solo', async () => {
    // Sin la guarda, tres pedidos simultáneos —tres pestañas abiertas— arrancan
    // seis procesos para escribir exactamente lo mismo.
    let veces = 0
    let soltar = (): void => undefined
    const v = vigilar(() => {
      veces++
      return new Promise<Modelos>((r) => {
        soltar = () => {
          r(LOS_DOS)
        }
      })
    })

    v.mirar()
    v.mirar()
    v.mirar()
    expect(veces).toBe(1)
    soltar()
    await dejarPasar()
    expect(v.ultimo()).toEqual(LOS_DOS)
  })

  it('un sondeo que revienta NO borra lo que ya sabía', async () => {
    let reloj = 0
    let romper = false
    const v = vigilar(
      () => (romper ? Promise.reject(new Error('el shell explotó')) : Promise.resolve(LOS_DOS)),
      { vigenciaMs: 100, ahora: () => reloj },
    )

    v.mirar()
    await dejarPasar()
    expect(v.ultimo()).toEqual(LOS_DOS)

    romper = true
    reloj = 200
    v.mirar()
    await dejarPasar()
    // Lo de antes sigue. Apagar las luces porque un `spawn` falló sería decir
    // que los CLIs se fueron, y lo único que pasó es que no pudimos preguntar.
    expect(v.ultimo()).toEqual(LOS_DOS)
  })
})

async function conServidor<T>(
  o: Parameters<typeof crearServidor>[1],
  hacer: (base: string) => Promise<T>,
): Promise<T> {
  const s = crearServidor(baulEnMemoria(), o)
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve))
  const dir = s.address()
  if (dir === null || typeof dir === 'string') throw new Error('el servidor no dio puerto')
  try {
    return await hacer(`http://127.0.0.1:${String(dir.port)}`)
  } finally {
    await new Promise<void>((resolve) =>
      s.close(() => {
        resolve()
      }),
    )
  }
}

const vigiaQueVio = (m: Modelos | undefined): Vigia => ({ ultimo: () => m, mirar: () => undefined })

describe('/salud dice con quién está', () => {
  it('un depósito pelado no afirma nada: sin dibujante y sin sondeo', async () => {
    await conServidor({}, async (base) => {
      expect(await (await fetch(`${base}/salud`)).json()).toEqual({
        ok: true,
        sprites: 0,
        dibuja: null,
        modelos: null,
      })
    })
  })

  it('CON DIBUJANTE Y CON SONDEO, publica los dos', async () => {
    await conServidor(
      { dibujante: { nombre: 'codex', dibujar: () => Promise.resolve({ ok: true, texto: '' }) }, vigia: vigiaQueVio(LOS_DOS) },
      async (base) => {
        expect(await (await fetch(`${base}/salud`)).json()).toEqual({
          ok: true,
          sprites: 0,
          dibuja: 'codex',
          modelos: LOS_DOS,
        })
      },
    )
  })

  it('«los sondeé y no están» se distingue de «todavía no sondeé»', async () => {
    await conServidor({ vigia: vigiaQueVio(NINGUNO) }, async (base) => {
      const r = (await (await fetch(`${base}/salud`)).json()) as { modelos: unknown }
      expect(r.modelos).toEqual(NINGUNO)
      expect(r.modelos).not.toBeNull()
    })
  })

  it('le dice «fijate» al vigía en cada pedido, y no lo espera', async () => {
    // La ruta no puede hacer `await` del sondeo: el juego pide `/salud` al abrir
    // y de esa respuesta depende que cargue los dibujos.
    let avisos = 0
    const v: Vigia = {
      ultimo: () => LOS_DOS,
      mirar: () => {
        avisos++
      },
    }
    await conServidor({ vigia: v }, async (base) => {
      await fetch(`${base}/salud`)
      await fetch(`${base}/salud`)
    })
    expect(avisos).toBe(2)
  })
})
