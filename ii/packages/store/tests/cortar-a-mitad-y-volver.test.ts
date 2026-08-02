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

    // ─── ESTE `expect` DECÍA `toBe(0)`, Y ERA CORRECTO CUANDO SE ESCRIBIÓ ──
    //
    // Daba cero porque **la mente nunca le devolvía evidencia a las creencias**:
    // `observe(ctx, rinde, ok)` existía desde el Hito 5 y no lo llamaba nadie. El
    // cero se afirmó en vez de esconderse, con este mensaje al lado: *«la mente
    // empezó a observar: el punto 6 del Hito 10 ya se puede medir»*.
    //
    // **Empezó.** El hueco se cerró en `escalera.ts` —`Opportunity.deDonde` lleva
    // el casillero y D1 anota cuando el mundo dice que la meta se cumplió— así
    // que ahora hay algo que heredar, y este test pasa a afirmar lo contrario.
    //
    // Que un `expect` de cero se dé vuelta solo cuando el hueco se cierra es
    // exactamente para lo que se escribió.
    // Y SIGUE DANDO CERO ACÁ, POR UNA RAZÓN COMPLETAMENTE DISTINTA Y CORRECTA:
    // en el tick 60 **todavía no consiguió nada**. El pescado entra a la mano en
    // el 108. Una criatura que no logró su meta no tiene qué anotar, y eso es lo
    // que tiene que pasar.
    //
    // Los dos ceros se parecen y no son el mismo, que es justo lo que este
    // proyecto castiga por nombre. El que importa —que después de conseguirlo SÍ
    // anota— se mide en el bloque del punto 6, más abajo.
    console.log(
      `  creencias volcadas tras ${String(CORTE)} ticks: ${String(g.creencias.length)} ` +
        `(el pescado entra en el ${String(PESCADO_EN_LA_MANO)}: todavía no consiguió nada)`,
    )
    expect(g.creencias.length).toBe(0)
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

// ═══ HITO 10 · punto 6 — ¿LA SEGUNDA VIDA LLEGA ANTES? ══════════════════════
//
// El criterio del Hito 10 reemplazó el «< 100 ms» del plan —que sobraba 25× sin
// el hito, medido en M7— por lo único que distingue «heredó» de «arrancó de
// nuevo»: **la segunda vida llega al pescado en MENOS TICKS que la primera**.
//
// Hasta hoy no se podía medir, porque no había nada que heredar: la mente nunca
// llamaba a `observe`. Ese hueco se cerró, así que acá se mide por primera vez.

describe('(Hito 10 · 6) la segunda vida, con y sin herencia', () => {
  it('la primera vida, la heredera y la que arranca de cero, en ticks', () => {
    const primera = correr(laEscenaDelDocumento(), new Creencias(), TOPE)
    // Lo que la primera aprendió, pasado por el depósito como se pasaría de
    // verdad: por JSON y por el volcado, no por una referencia al objeto vivo.
    const heredado = new Creencias()
    const volcado = (() => {
      const c = new Creencias()
      const p = new Partida(laEscenaDelDocumento(), { vigilar: true })
      const m = new Mente({ actor: QUIEN, memoria: c })
      vivir(p, new Map([[QUIEN, m]]), TOPE)
      return JSON.parse(JSON.stringify(c.volcar())) as ReturnType<Creencias['volcar']>
    })()
    heredado.cargar(volcado)

    const conHerencia = correr(laEscenaDelDocumento(), heredado, TOPE)
    const sinHerencia = correr(laEscenaDelDocumento(), new Creencias(), TOPE)

    console.log(
      `\n─── EL PUNTO 6, MEDIDO POR PRIMERA VEZ ───\n` +
        `  lo que la primera aprendió .... ${JSON.stringify(volcado)}\n` +
        `  primera vida .................. pescó en el tick ${String(primera.pescoEn)}\n` +
        `  segunda CON herencia .......... ${String(conHerencia.pescoEn)}\n` +
        `  segunda SIN herencia .......... ${String(sinHerencia.pescoEn)}\n` +
        `  ¿la herencia compró ticks? .... ${
          conHerencia.pescoEn < sinHerencia.pescoEn
            ? `SÍ, ${String(sinHerencia.pescoEn - conHerencia.pescoEn)}`
            : 'NO: llega igual'
        }\n`,
    )

    // Lo primero: que haya algo que heredar. Sin esto el resto no significa nada.
    expect(volcado.length, 'la primera vida no aprendió nada: no hay herencia que medir').toBeGreaterThan(0)
    // Y las tres llegan: una comparación entre dos «nunca» no es una comparación.
    expect(primera.pescoEn).toBeGreaterThan(0)
    expect(conHerencia.pescoEn).toBeGreaterThan(0)
    expect(sinHerencia.pescoEn).toBeGreaterThan(0)
    // El control de que la comparación es JUSTA: sin herencia, la segunda vida es
    // exactamente la primera. Si esto fallara, las dos ramas no serían el mismo
    // experimento y la diferencia no sería atribuible a la herencia.
    expect(sinHerencia.pescoEn, 'la corrida sin herencia no reproduce a la primera').toBe(primera.pescoEn)
  })
})
