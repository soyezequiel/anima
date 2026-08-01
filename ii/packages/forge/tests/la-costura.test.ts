/**
 * LA COSTURA, EL TOPE Y LA CUOTA — Hito 8, etapa 2. Puntos 4 y 8.
 *
 *   4 · «el episodio completo **no supera N consultas**»
 *   8 · «con la **cuota agotada**, la cola no dispara ni una consulta»
 *
 * ─── EL ESPÍA CUENTA DEL LADO DE AFUERA, y es la mitad del archivo ──────────
 *
 * Un adversario lo dijo con estas palabras: *«la cuenta la declara el contado»*.
 * Si el número de consultas lo reporta el mismo objeto que las hace, el test
 * verifica un campo, no un hecho.
 *
 * Acá el que cuenta es `unEspia()`, que **envuelve** al modelo y lleva su propio
 * registro. El código de la fragua no lo ve ni lo puede tocar.
 *
 * ─── N NO SE ELIGE: SE MIDE ────────────────────────────────────────────────
 *
 * El techo de CI tiene 40 escrito y su propio autor dejó dicho por qué: *«el
 * número está puesto a dedo y se dice. Nadie midió todavía cuánto sale un
 * episodio de la fragua»*. Un `<= 40` contra un gasto de 2 es un margen de 20×
 * que no se puede poner rojo nunca.
 *
 * Así que este archivo **mide** el episodio y afirma el número exacto. Si un
 * cambio lo mueve, se pone rojo y hay que mirar por qué — que es para lo que
 * sirve un guardián de regresión.
 */

import { deUsd, Presupuesto, SIN_LIMITE, sinLimite } from '@anima/llm'
import type { Cuota } from '@anima/llm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { responderComoModelo, responderSiempreIgual } from '../demo/falso.js'
import { leerCandidatas, pedirPermiso, USD_POR_CANDIDATA, viajeDe } from '../src/costura.js'
import { elSiguienteEncargo, loQueVaAfuera } from '../src/episodio.js'
import type { LoForjado } from '../src/episodio.js'
import { primerEncargo } from '../src/encargo.js'
import type { Encargo } from '../src/encargo.js'
import { Puerta } from '../src/puerta.js'

const GAP = 'conseguir alimento de un cuerpo de agua'
const VOCABULARIO = ['madera', 'liana', 'carne', 'agua']

/**
 * EL ESPÍA. Envuelve al modelo y cuenta desde afuera.
 *
 * `pedidos` guarda el texto de cada encargo que llegó a salir, así que el test
 * puede afirmar no sólo CUÁNTAS consultas hubo sino QUÉ decían — que es lo que
 * hace falta para el punto 9.
 */
function unEspia(responder: (e: Encargo) => string): {
  readonly preguntar: (e: Encargo) => string
  readonly pedidos: string[]
} {
  const pedidos: string[] = []
  return {
    preguntar: (e: Encargo): string => {
      pedidos.push(e.vuelta === 1 ? 'vuelta 1' : `vuelta ${String(e.vuelta)}: ${e.loQueFallo.conceptosQueNoExisten.join(',')}`)
      return responder(e)
    },
    pedidos,
  }
}

interface Vuelta {
  readonly encargo: Encargo
  readonly forjados: readonly LoForjado[]
  readonly sirven: number
}

/**
 * EL EPISODIO CON LA COSTURA PUESTA, hasta `topeDeVueltas`.
 *
 * Corta cuando alguna candidata sirve —que es lo que la fragua hace de verdad:
 * el viaje siguiente cuesta plata— o cuando el presupuesto no deja pasar.
 */
function unEpisodio(
  p: Presupuesto,
  preguntar: (e: Encargo) => string,
  topeDeVueltas = 3,
): { readonly vueltas: readonly Vuelta[]; readonly frenadoPor: string } {
  const puerta = new Puerta(ts)
  const vueltas: Vuelta[] = []
  let encargo = primerEncargo(GAP, VOCABULARIO)

  for (let n = 0; n < topeDeVueltas; n++) {
    const salida = pedirPermiso(p, viajeDe(encargo))
    if (salida.k === 'no-preguntes') return { vueltas, frenadoPor: salida.porque }

    // ── EL VIAJE. Es la única línea del archivo que gasta algo. ──
    const texto = preguntar(encargo)
    p.gastar('fragua', deUsd(USD_POR_CANDIDATA * salida.viaje.k, 1))

    const candidatas = leerCandidatas(texto, encargo)
    const forjados = loQueVaAfuera(candidatas, puerta)
    const sirven = forjados.filter((f) => f.desenlace !== 'rota').length
    vueltas.push({ encargo, forjados, sirven })
    if (sirven > 0) break

    encargo = elSiguienteEncargo(encargo, forjados, [])
  }
  return { vueltas, frenadoPor: '' }
}

describe('LA COSTURA existe: las candidatas nacen de un TEXTO', () => {
  it('el muñeco contesta como contesta un modelo, y se parsea', () => {
    const e = primerEncargo(GAP, VOCABULARIO)
    const texto = responderComoModelo(e)
    const cs = leerCandidatas(texto, e)
    console.log(`\n  ${String(cs.length)} candidatas: ${cs.map((c) => c.usar?.nombre ?? '?').join(', ')}\n`)
    expect(cs.length).toBe(2)
    expect(cs.map((c) => c.usar?.nombre)).toEqual(['esperarQuieta', 'esperarLaNoche'])
  })

  it('y sobrevive al texto de alrededor, que es lo que un CLI escribe', () => {
    // El Hito 6 midió que los CLI escriben encabezado y razonamiento antes del
    // mensaje final. Un parser que sólo funcione con la salida limpia no es el
    // que va a correr.
    const e = primerEncargo(GAP, VOCABULARIO)
    const sucio = `Pensando...\n\n${responderComoModelo(e)}\n\nEspero que sirva!`
    expect(leerCandidatas(sucio, e).length).toBe(2)
  })

  it('corta en K: nueve bloques no compran nueve candidatas', () => {
    const e = primerEncargo(GAP, VOCABULARIO)
    const nueve = Array.from({ length: 9 }, () => responderComoModelo(e)).join('\n')
    expect(leerCandidatas(nueve, e).length).toBe(2)
  })
})

describe('EL PUNTO 4: el episodio no supera N consultas, y N está MEDIDO', () => {
  it('cuántas consultas sale un episodio, contadas por el espía', () => {
    const p = sinLimite()
    const espia = unEspia(responderComoModelo)
    const r = unEpisodio(p, espia.preguntar)

    console.log(
      `\n  vueltas ${String(r.vueltas.length)} · consultas (espía) ${String(espia.pedidos.length)}` +
        `\n  contador: ${p.informe().split('\n').join(' | ')}` +
        `\n  pedidos: ${espia.pedidos.join(' · ')}\n`,
    )

    // ─── N = 1, MEDIDO ────────────────────────────────────────────────────
    // Un viaje alcanza: de las dos candidatas de la vuelta 1, una compila limpia
    // y la otra compila reparada, así que la fragua no vuelve a preguntar. Es el
    // punto 1 y el 2 del criterio dichos en consultas.
    expect(espia.pedidos.length).toBe(1)
    // Y el contador dice lo mismo que el espía. Si divergen, uno de los dos miente.
    expect(p.gastado('fragua').consultas).toBe(espia.pedidos.length)
    expect(p.gastado('fragua').milesimas).toBe(32)
    expect(p.seExcedio('fragua')).toBe(false)
  })

  it('EL CONTROL: con un modelo que NUNCA acierta, el episodio gasta el tope de vueltas', () => {
    // Sin este renglón, `toBe(1)` de arriba lo cumpliría un episodio que no
    // sabe volver a preguntar — y no habría forma de distinguirlo de uno que no
    // necesitó hacerlo.
    const p = sinLimite()
    const espia = unEspia(responderSiempreIgual)
    const r = unEpisodio(p, espia.preguntar, 3)
    console.log(`\n  el que nunca acierta: ${String(espia.pedidos.length)} consultas · ${r.vueltas.length} vueltas\n`)
    expect(espia.pedidos.length).toBe(3)
    expect(p.gastado('fragua').consultas).toBe(3)
  })

  it('y el punto 9 CIERRA: la vuelta 2 lleva el concepto, y el modelo cambia por eso', () => {
    // `responderSiempreIgual` devuelve una candidata con `hunger`, que el mundo
    // no tiene. La vuelta 2 se lo cuenta, y `responderComoModelo` cambia de
    // estrategia POR ESO.
    const p = sinLimite()
    const puerta = new Puerta(ts)
    const uno = primerEncargo(GAP, VOCABULARIO)
    const rotas = loQueVaAfuera(leerCandidatas(responderSiempreIgual(uno), uno), puerta)
    const dos = elSiguienteEncargo(uno, rotas, [])

    const espia = unEspia(responderComoModelo)
    const texto = espia.preguntar(dos)
    const cs = leerCandidatas(texto, dos)

    console.log(`\n  vuelta 2 → ${cs.map((c) => c.usar?.nombre ?? '?').join(', ')}\n  ${espia.pedidos[0] ?? ''}\n`)
    expect(dos.loQueFallo.conceptosQueNoExisten).toContain('hunger')
    // La que toca el mundo, que en la vuelta 1 no aparece.
    expect(cs.map((c) => c.usar?.nombre)).toContain('agarrarLoQueVeo')
    expect(p.gastado('fragua').consultas).toBe(0)
  })
})

describe('EL PUNTO 8: con la cuota agotada, NI UNA consulta', () => {
  const sinConsultas: Readonly<Record<'fragua' | 'chat', Cuota>> = {
    fragua: { consultas: 0, milesimas: Infinity },
    chat: SIN_LIMITE.chat,
  }
  const sinPlata: Readonly<Record<'fragua' | 'chat', Cuota>> = {
    // Consultas de sobra y plata en cero: es la OTRA rama de `puedo`, y sin este
    // caso la puerta de la plata no se ejercita nunca — `puedo` chequea las
    // consultas primero.
    fragua: { consultas: Infinity, milesimas: 0 },
    chat: SIN_LIMITE.chat,
  }

  it('sin consultas: el espía cuenta CERO', () => {
    const p = new Presupuesto(sinConsultas)
    const espia = unEspia(responderComoModelo)
    const r = unEpisodio(p, espia.preguntar)
    console.log(`\n  frenado por: ${r.frenadoPor} · llamadas ${String(espia.pedidos.length)} · negados ${String(p.negados('fragua'))}\n`)
    expect(espia.pedidos.length).toBe(0)
    expect(r.frenadoPor).toBe('sin-consultas')
    expect(p.negados('fragua')).toBe(1)
  })

  it('sin plata: también cero, y por el OTRO motivo', () => {
    const p = new Presupuesto(sinPlata)
    const espia = unEspia(responderComoModelo)
    const r = unEpisodio(p, espia.preguntar)
    console.log(`\n  frenado por: ${r.frenadoPor} · llamadas ${String(espia.pedidos.length)}\n`)
    expect(espia.pedidos.length).toBe(0)
    expect(r.frenadoPor).toBe('sin-plata')
  })

  it('EL CONTROL, y es el que le da sentido a los dos ceros de arriba', () => {
    // El MISMO episodio, el MISMO espía, el MISMO muñeco: cambia UNA cosa, el
    // presupuesto. Si esto no diera 1, los ceros de arriba no significarían nada
    // — serían el cero de un arnés que nunca iba a preguntar.
    const espia = unEspia(responderComoModelo)
    unEpisodio(sinLimite(), espia.preguntar)
    console.log(`\n  con cuota: ${String(espia.pedidos.length)} llamada(s)\n`)
    expect(espia.pedidos.length).toBe(1)
  })

  it('y es una PUERTA y no un aviso: el `no-preguntes` no trae viaje adentro', () => {
    // La diferencia entera del punto 8. Un aviso deja pasar y anota; una puerta
    // no da con qué preguntar. Se afirma sobre el TIPO, que es donde vive.
    const p = new Presupuesto(sinConsultas)
    const s = pedirPermiso(p, viajeDe(primerEncargo(GAP, VOCABULARIO)))
    expect(s.k).toBe('no-preguntes')
    expect('viaje' in s).toBe(false)
  })
})
