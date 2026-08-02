// ═══ HITO 10 · punto 4 — CERRAR LA PESTAÑA A MITAD DE UNA OBRA ══════════════
//
// > cerrar y reabrir la pestaña a mitad de una obra no pierde el mundo y **la
// > habilidad converge**
//
// La segunda mitad es la que decide todo, y no quiere decir lo que parece. La
// actividad en vuelo **no se guarda** —ADR 0009, y el plan del Hito 10 lo repite
// con todas las letras: «no se serializan generadores ni fronteras; al cargar se
// replanifica de forma idempotente»—. Un generador de JavaScript no se puede
// serializar, y fingir que sí produce el bug que `SkillRun.step` previene con una
// excepción: una habilidad que cree que llegó a un lugar donde nunca estuvo.
//
// Así que «converge» quiere decir: **la criatura restaurada vuelve a planificar
// sobre el mundo que quedó y termina la obra igual**.
//
// La obra es la de siempre —atar la caña y pescar—, que es la única historia que
// corre de punta a punta (M4 del Hito 9).

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { Creencias, Mente, vivir } from '@anima/mind'
import { hashWorldState } from '@anima/world'
import type { WorldState } from '@anima/world'

import { cargar, comoSeGuarda, enMemoria, guardar, loQueNoAguanta } from '../src/index.js'
import { laEscenaDelDocumento } from './escena.js'

const QUIEN = 'ana'
/** El tick en que el pescado entra a la mano en una corrida entera. Medido en el Hito 5. */
const PESCADO_EN_LA_MANO = 108
/** A mitad de la obra: la caña ya se ató (tick 23) y todavía no pescó. */
const CORTE = 60
const TOPE = 400

interface Corrida {
  readonly state: WorldState
  readonly pescoEn: number
  readonly ticks: number
}

/** Corre desde este mundo con una mente nueva, hasta que pesca o hasta el tope. */
function correr(w: WorldState, creencias: Creencias, tope: number): Corrida {
  const p = new Partida(w, { vigilar: true })
  const m = new Mente({ actor: QUIEN, memoria: creencias })
  const mentes = new Map([[QUIEN, m]])
  let pescoEn = -1
  let t = 0
  for (; t < tope; t++) {
    vivir(p, mentes, 1)
    if (pescoEn < 0 && tieneCarnoso(p.state)) pescoEn = t
    if (pescoEn >= 0) break
  }
  return { state: p.state, pescoEn, ticks: t }
}

/** ¿Hay algo carnoso en la mano? Se lee del ESTADO, no de lo que la mente dice que hizo. */
function tieneCarnoso(s: WorldState): boolean {
  const a = s.actors.get(QUIEN)
  if (a === undefined) return false
  for (const id of a.holding) {
    const b = s.bodies.get(id)
    if (b === undefined) continue
    for (const p of b.body.parts) {
      if (s.phys.substances.get(p.substance)?.tags.includes('carnoso') === true) return true
    }
  }
  return false
}

describe('(Hito 10 · 4) cortar a mitad de la obra, guardar, volver, y converger', () => {
  it('LA LÍNEA BASE, primero: sin cortar nada, la obra sale entera', () => {
    // Sin esto, «la restaurada pescó» no diría si converge o si pesca cualquiera.
    const r = correr(laEscenaDelDocumento(), new Creencias(), TOPE)
    console.log(`\n─── LA LÍNEA BASE ───\n  pescó en el tick ${String(r.pescoEn)} (Hito 5: ${String(PESCADO_EN_LA_MANO)})\n`)
    expect(r.pescoEn).toBeGreaterThan(0)
  })

  it('el mundo vuelve BIT POR BIT: el hash del restaurado es el del guardado', async () => {
    const p = new Partida(laEscenaDelDocumento(), { vigilar: true })
    const creencias = new Creencias()
    const m = new Mente({ actor: QUIEN, memoria: creencias })
    vivir(p, new Map([[QUIEN, m]]), CORTE)

    const d = enMemoria()
    const g = await guardar(d, p.state, creencias, QUIEN)
    const vuelto = await cargar(d, QUIEN)

    console.log(
      `\n─── EL VIAJE DE IDA Y VUELTA ───\n` +
        `  cortado en el tick ..... ${String(p.state.tick)}\n` +
        `  ranuras guardadas ...... ${String(g.mundo.length)}\n` +
        `  creencias volcadas ..... ${String(g.creencias.length)} casilleros\n` +
        `  hash antes ............. ${hashWorldState(p.state)}\n` +
        `  hash después ........... ${vuelto === undefined ? '(no volvió)' : hashWorldState(vuelto.state)}\n`,
    )

    expect(vuelto, 'no volvió nada del depósito').toBeDefined()
    expect(hashWorldState((vuelto as { state: WorldState }).state)).toBe(hashWorldState(p.state))
    // Guarda contra el guardado vacío: si `mundo` viniera con dos ranuras, los
    // hashes podrían coincidir sobre dos mundos pelados.
    expect(g.mundo.length).toBeGreaterThan(3)

    // ─── Y ACÁ APARECIÓ ALGO, MEDIDO Y NO ESCONDIDO ────────────────────────
    //
    // `creencias.length` da CERO después de sesenta ticks de vida real, y no es
    // un bug del volcado: **la mente nunca le devuelve evidencia a las
    // creencias**. Está escrito en `mind/src/mente.ts` desde el Hito 5, con su
    // `it.fails` y su número:
    //
    //   > `AffordanceMemory` tiene `observe(ctx, rinde, ok)` y acá no se lo llama
    //   > nunca […] una criatura que pesca sesenta veces sigue informando n = 0.
    //
    // O sea que el guardado de creencias es un mecanismo que hoy **hereda cero**,
    // y la causa no es de este paquete: la reparación es de `escalera.ts`
    // —cargarle a la meta de dónde salió— y toca el corazón de la mente.
    //
    // Se afirma el CERO, no se lo esconde: el día que la escalera empiece a
    // observar, esto se pone rojo y obliga a mirar el punto 6 del criterio.
    console.log(
      `  creencias volcadas tras ${String(CORTE)} ticks de vida real: ${String(g.creencias.length)}\n` +
        `  (y el porqué está medido desde el Hito 5: la mente no llama a observe())`,
    )
    expect(
      g.creencias.length,
      'la mente empezó a observar: el punto 6 del Hito 10 ya se puede medir',
    ).toBe(0)
  })

  it('el volcado SÍ funciona: con evidencia puesta a mano, viaja y no duplica el instinto', () => {
    // El control positivo del bloque de arriba. Sin esto, «volcó cero» no diría
    // si es porque no hay nada que volcar o porque `volcar()` no vuelca.
    const c = new Creencias()
    const ctx = c.contextos()[0]
    expect(ctx, 'una Creencias nueva no tiene ni un contexto de instinto').toBeDefined()
    const clave = ctx as string
    const rinde = c.tagsDe(clave)[0] as string
    const antes = c.belief(clave, rinde)
    c.observe(clave, rinde, true)
    c.observe(clave, rinde, true)
    c.observe(clave, rinde, false)

    const volcado = c.volcar()
    const heredera = new Creencias()
    const instintoDeFabrica = heredera.belief(clave, rinde)
    heredera.cargar(volcado)
    const despues = heredera.belief(clave, rinde)

    console.log(
      `\n─── EL VOLCADO, CON EVIDENCIA DE VERDAD ───\n` +
        `  casilleros volcados ....... ${String(volcado.length)}\n` +
        `  el instinto de fábrica .... a=${String(instintoDeFabrica.a)} b=${String(instintoDeFabrica.b)}\n` +
        `  la que vivió .............. a=${String(c.belief(clave, rinde).a)} b=${String(c.belief(clave, rinde).b)}\n` +
        `  la heredera ............... a=${String(despues.a)} b=${String(despues.b)}\n`,
    )

    expect(volcado.length).toBe(1)
    // La heredera queda con lo mismo que la que vivió: el instinto lo puso su
    // propio constructor y la evidencia vino del volcado.
    expect(despues).toEqual(c.belief(clave, rinde))
    // ── Y LA TRAMPA QUE ESTO EVITA, dicha con la aritmética exacta.
    //
    //    Dos éxitos suben `a` en dos, y nada más. Si `volcar` mandara el
    //    POSTERIOR —prior más evidencia— en vez de la evidencia sola, la
    //    heredera sumaría el instinto DOS VECES y `a` daría `2·instinto + 2`.
    //    Guardar y restaurar diez veces daría un instinto diez veces más terco
    //    sin haber visto nada.
    expect(despues.a).toBe(instintoDeFabrica.a + 2)
    expect(despues.b).toBe(instintoDeFabrica.b + 1)
    expect(despues.a).not.toBe(instintoDeFabrica.a * 2 + 2)
    // Y `antes` era exactamente el instinto: la que vivió arrancó de ahí.
    expect(antes).toEqual(instintoDeFabrica)
    // Y aguanta el viaje por JSON, que es de lo que se trata todo esto.
    expect(JSON.parse(JSON.stringify(volcado))).toEqual(volcado)
  })

  it('y LA OBRA CONVERGE: la criatura restaurada replanifica y pesca igual', async () => {
    const p = new Partida(laEscenaDelDocumento(), { vigilar: true })
    const creencias = new Creencias()
    const m = new Mente({ actor: QUIEN, memoria: creencias })
    vivir(p, new Map([[QUIEN, m]]), CORTE)
    const yaPesco = tieneCarnoso(p.state)

    const d = enMemoria()
    await guardar(d, p.state, creencias, QUIEN)
    const vuelto = await cargar(d, QUIEN)
    expect(vuelto).toBeDefined()
    const v = vuelto as { state: WorldState; creencias: Creencias }

    // Mente NUEVA sobre el mundo restaurado: nada del vuelo anterior sobrevivió,
    // que es exactamente lo que el ADR 0009 manda.
    const despues = correr(v.state, v.creencias, TOPE)

    console.log(
      `\n─── LA CONVERGENCIA ───\n` +
        `  ¿ya había pescado al cortar? ... ${yaPesco ? 'sí (el corte cayó tarde)' : 'no'}\n` +
        `  la restaurada pescó ............ ${despues.pescoEn < 0 ? 'NUNCA' : `${String(despues.pescoEn)} ticks después del corte`}\n` +
        `  o sea, en el tick .............. ${despues.pescoEn < 0 ? '—' : String(CORTE + despues.pescoEn)}\n`,
    )

    // El corte tiene que caer ANTES de que pesque, o esto no prueba nada.
    expect(yaPesco, 'el corte cayó después de la pesca: no hay obra a mitad que converger').toBe(false)
    expect(despues.pescoEn, 'la criatura restaurada no llegó a pescar').toBeGreaterThanOrEqual(0)
  })

  it('EL CONTROL: un guardado que no aguanta el viaje se rechaza en vez de guardarse vacío', () => {
    // El modo de falla es CALLADO: `JSON.stringify(new Map())` devuelve `{}` y no
    // lanza. Sin la puerta, guardar un mundo crudo «funciona» y lo que vuelve es
    // un mundo sin cuerpos, tres semanas después.
    expect(loQueNoAguanta({ a: 1, b: [2, { c: 'x' }] })).toBe('')
    expect(loQueNoAguanta({ bodies: new Map() })).toContain('bodies')
    expect(loQueNoAguanta({ x: { y: new Set() } })).toContain('x.y')
    expect(loQueNoAguanta({ f: () => 0 })).toContain('f')
    expect(loQueNoAguanta({ n: Number.NaN })).toContain('n')

    // Y la puerta de verdad, sobre un guardado real: lo que `comoSeGuarda`
    // produce PASA. Si algún día una ranura del mundo deja de ser plana, esto se
    // pone rojo acá y no en el navegador de alguien.
    const g = comoSeGuarda(laEscenaDelDocumento(), new Creencias(), QUIEN)
    expect(loQueNoAguanta(g)).toBe('')
  })
})
