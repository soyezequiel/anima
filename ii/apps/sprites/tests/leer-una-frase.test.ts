// ─── LA RUTA QUE LE PREGUNTA A CODEX POR EL CHAT ────────────────────────────
//
// `POST /leer` es el segundo trabajo del depósito. El primero —dibujar— existe
// desde el Hito 12; éste apareció cuando el juego necesitó que alguien leyera
// las frases que su léxico no alcanza, y no podía llamar a Codex desde el
// navegador: es un proceso, y las credenciales no viajan al cliente.
//
// ─── LO QUE SE AFIRMA ACÁ, Y NINGUNO SPAWNEA UN PROCESO ────────────────────
//
//   1. **el depósito arma el prompt, el cliente no lo manda.** Es la diferencia
//      entre una ruta del juego y un proxy abierto a la cuenta de quien corre
//      esto. Se verifica leyendo lo que le llegó al modelo de mentira;
//   2. **lo que viene de la red se mira campo por campo.** `promptDe` hace
//      `.map()` sobre `firmas`: un `firmas: "todas"` tiraría el servidor abajo
//      desde el cliente;
//   3. **«no eligió nada» no es «falló».** El primero es 200 con `null` y el
//      segundo es 502, y el juego los pinta distinto — uno manda a mirar el
//      cableado y el otro no.
//
// El modelo de mentira devuelve el JSON que `leerRespuesta` espera, así que lo
// que se prueba es la ruta entera: validar, armar, llamar, parsear, contestar.

import { describe, expect, it } from 'vitest'

import { baulEnMemoria, crearServidor, type Dibujante } from '../src/servidor.js'

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

/** Una consulta como la que arma `@anima/lang` y manda el juego. */
const CONSULTA = {
  texto: 'dale para el fueguito',
  clausulas: [0],
  confianza: 0.3,
  firmas: ['emitsPower>0', 'holding(tag:carnoso)'],
  vocabulario: ['madera', 'leña', 'pescado'],
  llave: '12345:7',
  contexto: [{ turno: 1, tick: 4, clase: 'entrada', texto: 'hola' }],
}

/** Guarda el prompt que le llegó y contesta lo que el caso pida. */
function modeloDeMentira(texto: string, ok = true): Dibujante & { visto: { prompt: string } } {
  const visto = { prompt: '' }
  return {
    nombre: 'codex',
    dibujar: () => Promise.resolve({ ok: true, texto: '' }),
    responder: (prompt: string) => {
      visto.prompt = prompt
      return Promise.resolve(ok ? { ok, texto } : { ok, texto: '', porque: 'no encontré el CLI de codex' })
    },
    visto,
  }
}

const pedir = (base: string, cuerpo: unknown): Promise<Response> =>
  fetch(`${base}/leer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })

describe('POST /leer', () => {
  it('EL PROMPT LO ARMA EL SERVIDOR, y lleva la frase y las firmas', async () => {
    const d = modeloDeMentira('{"clausulas":[{"indice":0,"firma":"emitsPower>0"}]}')
    await conServidor({ dibujante: d }, async (base) => {
      const r = await pedir(base, CONSULTA)
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ ok: true, respuesta: { llave: '12345:7', clausulas: [{ indice: 0, firma: 'emitsPower>0' }] } })
    })
    // La línea que separa esta ruta de un proxy: el cliente mandó una consulta y
    // lo que llegó al modelo es un prompt que él nunca escribió.
    expect(d.visto.prompt).toContain('dale para el fueguito')
    expect(d.visto.prompt).toContain('emitsPower>0')
    expect(d.visto.prompt, 'el prompt no trae las instrucciones del juego').toContain('lector de un juego')
  })

  it('«NO ELIGIÓ NADA» ES 200 CON null, y no un 502', async () => {
    // El modelo contestó y dijo que ninguna firma servía. Es una respuesta
    // legítima: un 502 acá haría que el juego prenda la luz de «se cortó».
    const d = modeloDeMentira('{"clausulas":[]}')
    await conServidor({ dibujante: d }, async (base) => {
      const r = await pedir(base, CONSULTA)
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ ok: true, respuesta: { llave: '12345:7', clausulas: [] } })
    })
  })

  it('y lo que NO SE ENTIENDE también es 200, con `respuesta: null`', async () => {
    // El CLI contestó cualquier cosa. Sigue sin ser una falla del camino: llegó.
    const d = modeloDeMentira('me parece que quiere fuego, ¿no?')
    await conServidor({ dibujante: d }, async (base) => {
      expect(await (await pedir(base, CONSULTA)).json()).toEqual({ ok: true, respuesta: null })
    })
  })

  it('EL CLI QUE NO ARRANCA ES 502, con el porqué', async () => {
    const d = modeloDeMentira('', false)
    await conServidor({ dibujante: d }, async (base) => {
      const r = await pedir(base, CONSULTA)
      expect(r.status).toBe(502)
      expect(await r.json()).toEqual({ ok: false, porque: 'no encontré el CLI de codex' })
    })
  })

  it('UN DEPÓSITO QUE NO CONTESTA EL CHAT dice 501 y no gasta nada', async () => {
    // Dibujar y contestar son dos permisos: este tiene el primero y no el
    // segundo, y el juego lo lee para no marcarle la lámpara a nadie.
    await conServidor({ dibujante: { nombre: 'codex', dibujar: () => Promise.resolve({ ok: true, texto: '' }) } }, async (base) => {
      expect((await pedir(base, CONSULTA)).status).toBe(501)
    })
  })

  it('LO QUE VIENE DE LA RED SE MIRA CAMPO POR CAMPO', async () => {
    // `promptDe` hace `.map()` sobre `firmas` y `.join()` sobre `clausulas`: sin
    // esta puerta, un cliente tira el servidor abajo con un JSON válido.
    const d = modeloDeMentira('{"clausulas":[]}')
    const raros: unknown[] = [
      'sí',
      42,
      null,
      {},
      { ...CONSULTA, firmas: 'todas' },
      { ...CONSULTA, clausulas: ['0'] },
      { ...CONSULTA, texto: 42 },
      { ...CONSULTA, llave: undefined },
      { ...CONSULTA, confianza: 'mucha' },
      { ...CONSULTA, vocabulario: [1, 2] },
    ]
    await conServidor({ dibujante: d }, async (base) => {
      for (const x of raros) {
        expect((await pedir(base, x)).status, `pasó: ${JSON.stringify(x)?.slice(0, 60) ?? 'undefined'}`).toBe(400)
      }
      // Y el servidor sigue en pie después de los diez: eso es la mitad del test.
      expect((await pedir(base, CONSULTA)).status).toBe(200)
    })
  })

  it('UN CONTEXTO ROTO CUESTA ESA LÍNEA, no la consulta entera', async () => {
    // El contexto es una AYUDA para leer la frase, no la frase. Rechazar todo
    // por un dicho mal formado sería tirar la pregunta por el margen.
    const d = modeloDeMentira('{"clausulas":[]}')
    await conServidor({ dibujante: d }, async (base) => {
      const r = await pedir(base, { ...CONSULTA, contexto: [{ turno: 'uno' }, 42, null] })
      expect(r.status).toBe(200)
    })
  })

  it('y GET no sirve: pedir esto tiene que ser un POST', async () => {
    const d = modeloDeMentira('{"clausulas":[]}')
    await conServidor({ dibujante: d }, async (base) => {
      expect((await fetch(`${base}/leer`)).status).toBe(405)
    })
  })
})
