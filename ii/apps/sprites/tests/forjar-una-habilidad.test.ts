// ─── LA RUTA QUE LE PIDE A CODEX UNA HABILIDAD QUE FALTA ────────────────────
//
// Tercera ruta que sale a un modelo, y la más cara de las tres: un viaje de 6 a
// 25 segundos más un typecheck por candidata. Por eso es un permiso aparte —un
// depósito puede querer dibujar y contestar el chat, que son baratos, y no querer
// pagar esto.
//
// ─── LO QUE SE AFIRMA, Y NINGUNO GASTA UNA CONSULTA ────────────────────────
//
//   1. **el prompt lo arma el servidor, con el `.d.ts` adentro.** Es lo que hace
//      que el modelo escriba algo compilable, y son varios kilos de texto: si lo
//      mandara el navegador, viajarían por la red en cada hueco y además le
//      estaríamos confiando al cliente la superficie contra la que después
//      typechequeamos de este lado;
//   2. **lo que cruza es texto, y el JS ya viene instrumentado.** Un objeto con
//      funciones adentro no entra en una respuesta HTTP, y el compilador de
//      TypeScript no tiene por qué bajar al navegador;
//   3. **una candidata rota cruza igual.** No hay nada que montar, pero sus
//      `conceptos` son lo único que un fracaso deja para la vuelta siguiente;
//   4. **«no escribió nada» no es «falló».** 200 con la lista vacía contra 502, y
//      el juego los pinta distinto igual que en `/leer`.
//
// El modelo de mentira devuelve un bloque cercado con una habilidad de verdad —
// compila contra la API — así que lo que se prueba es el camino entero: armar el
// encargo, llamar, parsear, typechequear, instrumentar y contestar.

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

/** El hueco real que una partida no supo llenar. */
const PEDIDO = {
  gap: 'moisture<0.45&rigidity>=0.5',
  meta: 'emitsPower>0',
  porQue: 'ningún esquema conocido establece moisture<0.45',
  tick: 170,
  enCastellano: 'dejar seca una vara de madera',
}

/** Compila contra la API: es lo mínimo para que la puerta la deje pasar. */
const UNA_QUE_COMPILA = `\`\`\`ts
import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done } from '../../src/skill-api.js'

export function* secar(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('secar')
  return done()
}
\`\`\``

/** No compila: usa algo que la API no tiene. Sirve para el caso `rota`. */
const UNA_QUE_NO = `\`\`\`ts
import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done } from '../../src/skill-api.js'

export function* secar(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.esteMetodoNoExiste()
  return done()
}
\`\`\``

function modeloDeMentira(texto: string, ok = true): Dibujante & { visto: { prompt: string; ms: number } } {
  const visto = { prompt: '', ms: 0 }
  return {
    nombre: 'codex',
    dibujar: () => Promise.resolve({ ok: true, texto: '' }),
    forjar: (prompt: string, timeoutMs: number) => {
      visto.prompt = prompt
      visto.ms = timeoutMs
      return Promise.resolve(ok ? { ok, texto } : { ok, texto: '', porque: 'no encontré el CLI de codex' })
    },
    visto,
  }
}

const pedir = (base: string, cuerpo: unknown): Promise<Response> =>
  fetch(`${base}/forjar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })

interface LoQueVuelve {
  ok: boolean
  candidatas: number
  forjadas: { nombre: string; desenlace: string; codigo: string; js: string; puntos: number }[]
  porque?: string
}

describe('POST /forjar', () => {
  it('EL PROMPT LO ARMA EL SERVIDOR, con la API adentro', async () => {
    const d = modeloDeMentira(UNA_QUE_COMPILA)
    await conServidor({ dibujante: d }, async (base) => {
      const r = await pedir(base, PEDIDO)
      expect(r.status).toBe(200)
    })
    // Las tres cosas que un encargo pelado no tenía y sin las que el modelo, en
    // vivo, contestó pidiendo herramientas en vez de escribir código.
    expect(d.visto.prompt, 'no lleva el hueco').toContain('moisture<0.45')
    expect(d.visto.prompt, 'no lleva la superficie: el modelo no sabe contra qué compila').toContain('interface Ctx')
    expect(d.visto.prompt, 'no lleva la prosa, que es la única forma medida contra un modelo').toContain(
      'dejar seca una vara de madera',
    )
    // Y es grande: eso es exactamente lo que no queremos mandando el navegador.
    expect(d.visto.prompt.length).toBeGreaterThan(2000)
  })

  it('LO QUE CRUZA ES TEXTO, y el JS ya viene instrumentado', async () => {
    const d = modeloDeMentira(UNA_QUE_COMPILA)
    await conServidor({ dibujante: d }, async (base) => {
      const j = (await (await pedir(base, PEDIDO)).json()) as LoQueVuelve
      expect(j.ok).toBe(true)
      expect(j.candidatas).toBe(1)
      const f = j.forjadas[0]
      expect(f?.nombre).toBe('secar')
      expect(f?.desenlace, 'la puerta la rechazó: compilaba').not.toBe('rota')
      // El TypeScript, para poder mostrarlo y guardarlo.
      expect(f?.codigo).toContain('export function* secar')
      // Y el JavaScript listo para `mount()`: sin `export`, que es ilegal
      // adentro de la función donde el sandbox lo evalúa.
      expect(f?.js).toContain('exports.secar')
      expect(f?.js, 'quedó ESM: `mount` no lo puede evaluar').not.toMatch(/^export /m)
    })
  })

  it('UNA CANDIDATA ROTA CRUZA IGUAL, sin `js` y con sus conceptos', async () => {
    // Es lo único que un fracaso deja: los nombres que pidió y el mundo no tiene
    // alimentan el encargo de la vuelta siguiente.
    const d = modeloDeMentira(UNA_QUE_NO)
    await conServidor({ dibujante: d }, async (base) => {
      const j = (await (await pedir(base, PEDIDO)).json()) as LoQueVuelve
      expect(j.ok).toBe(true)
      const f = j.forjadas[0]
      expect(f?.desenlace).toBe('rota')
      expect(f?.js, 'montó una rota: no hay nada que montar').toBe('')
    })
  })

  it('«CONTESTÓ Y NO ESCRIBIÓ NADA» ES 200 CON LA LISTA VACÍA', async () => {
    const d = modeloDeMentira('me parece que no se puede, ¿probaste con otra cosa?')
    await conServidor({ dibujante: d }, async (base) => {
      const r = await pedir(base, PEDIDO)
      expect(r.status).toBe(200)
      const j = (await r.json()) as LoQueVuelve
      expect(j.candidatas).toBe(0)
      expect(j.forjadas).toEqual([])
    })
  })

  it('y el CLI que no arranca es 502, con el porqué', async () => {
    const d = modeloDeMentira('', false)
    await conServidor({ dibujante: d }, async (base) => {
      const r = await pedir(base, PEDIDO)
      expect(r.status).toBe(502)
      expect(((await r.json()) as LoQueVuelve).porque).toContain('codex')
    })
  })

  it('UN DEPÓSITO QUE NO FORJA dice 501 y no gasta nada', async () => {
    // Tercer permiso, aparte de dibujar y de contestar: forjar es el más caro de
    // los tres y un depósito puede querer los otros dos y no éste.
    const soloDibuja: Dibujante = { nombre: 'codex', dibujar: () => Promise.resolve({ ok: true, texto: '' }) }
    await conServidor({ dibujante: soloDibuja }, async (base) => {
      expect((await pedir(base, PEDIDO)).status).toBe(501)
    })
  })

  it('y `/salud` publica los TRES permisos por separado', async () => {
    const d = modeloDeMentira(UNA_QUE_COMPILA)
    await conServidor({ dibujante: d }, async (base) => {
      const s = (await (await fetch(`${base}/salud`)).json()) as Record<string, unknown>
      expect(s['dibuja']).toBe('codex')
      expect(s['contesta'], 'este dibujante no trae `responder`').toBe(null)
      expect(s['forja']).toBe('codex')
    })
  })

  it('LO QUE VIENE DE LA RED SE MIRA CAMPO POR CAMPO', async () => {
    const d = modeloDeMentira(UNA_QUE_COMPILA)
    const raros: unknown[] = [
      'sí',
      42,
      null,
      {},
      { ...PEDIDO, gap: '' },
      { ...PEDIDO, gap: 42 },
      { ...PEDIDO, tick: 'ciento setenta' },
      { ...PEDIDO, meta: undefined },
    ]
    await conServidor({ dibujante: d }, async (base) => {
      for (const x of raros) {
        expect((await pedir(base, x)).status, `pasó: ${JSON.stringify(x)?.slice(0, 50) ?? 'undefined'}`).toBe(400)
      }
      expect((await pedir(base, PEDIDO)).status, 'el servidor no sobrevivió a los ocho').toBe(200)
    })
  })
})
