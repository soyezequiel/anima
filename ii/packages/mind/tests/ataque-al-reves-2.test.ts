// ═══ EL ATAQUE CON EL LENTE AL REVÉS · SEGUNDA VUELTA ═══════════════════════
//
//   pnpm --filter @anima/mind test
//
// La primera vuelta (`ataque-al-reves.test.ts`) preguntó qué cosas razonables no
// puede hacer una criatura que todavía no comía. Ésta pregunta lo mismo DESPUÉS
// del ADR II-0013: ahora el mundo cobra `toxicity × masa × 25` al tragar, o sea
// que cocinar dejó de ser decorativo y pasó a ser LA decisión económica del
// juego. Se escribe lo que una criatura razonable haría con esa regla puesta, se
// lo INTENTA contra `stepWorld` y contra `plan()` de verdad, y se mide qué sale.
// Un párrafo de análisis no vale nada; lo que vale es la salida.
//
// ═══ EL HALLAZGO QUE ORDENA TODOS LOS DEMÁS ═════════════════════════════════
//
// **EL MUNDO PAGA POR COCINAR DE A VARIOS. LA MENTE SÓLO PUEDE COCINAR DE A UNO,
// Y DE A UNO NO SE PAGA NUNCA.** Los tres números están medidos abajo:
//
//   · cuatro pescados sobre la MISMA losa sobre el MISMO fuego se cocinan los
//     cuatro, todos en el tick 64, todos a `digestibility` 0,9500 y `toxicity`
//     0,0000. Y el fuego se queda adentro de la ventana `[253 ; 410)` hasta el
//     tick 431 — o sea **6,7 hornadas**, sin que nadie lo atienda (grupo 1);
//   · encender lo más barato que emite algo cuesta **140,70** de aliento sobre un
//     tanque de 1000, y un pescado cocido de 2 kg deja **+11,85**. Un fuego se
//     paga con **11,9 pescados**, y ninguna pieza que la criatura pueda encender
//     frotando llega siquiera a los 253 que la cocción pide — la de 0,7132 kg
//     entrega 214,14 y se come el tanque entero (grupo 2);
//   · y la mente cotiza el fuego entero en **5,1000** de aliento
//     (`alientoDelEsquema`), o sea **27,6× por debajo** del más barato que existe.
//     Era 15,0000 y 9,5× hasta que `COSTO_VIVIR_POR_SEGUNDO` bajó de 1,0 a 0,34:
//     la cotización es `COSTO_VIVIR_POR_SEGUNDO × SEGUNDOS_DE_COCCION`, así que
//     abaratar el segundo abarató la cotización y NO el fuego, que se paga en
//     `heatCapacity × ΔT / eficiencia`. **El error de la mente casi se triplicó
//     sin que nadie tocara la mente.**
//
// La causa no es un `if` que falte: es que **el vocabulario de metas no tiene
// número**. `Predicado` tiene tres formas —`cualidad`, `geometria`, `sostiene`—
// y ninguna lleva una cantidad. `holding(tag:carnoso,count>=4)` no parsea, y el
// `pila` del esquema de ley nombra UN rol `comida`. Medido: el plan de lo cocido
// pesca UN pescado, apoya UNA losa, apoya UNA comida y levanta UNA comida.
//
// ═══ LO QUE SALIÓ AL REVÉS DE LO QUE YO ESPERABA, Y VALE MÁS ════════════════
//
// Dos hipótesis mías se cayeron midiendo, y las dos dejaron algo mejor:
//
//   · **«lo cocido se pudre rápido y por eso no se puede guardar» es FALSO.** Un
//     pescado cocido de verdad —cocido corriendo la ley 5, no armado a mano—
//     sacado del fuego y dejado en el piso 200 segundos conserva `digestibility`
//     0,9500 y se clava en `toxicity` 0,0195, con neto +10,84. La reserva EXISTE
//     en el mundo. Lo que no existe es la meta que la pida — y mientras tanto la
//     mente ofrece el bocado apenas el neto da positivo: con el tanque en 995 se
//     traga el pescado entero y **derrama 14,68 de los 17,14, el 86%** (grupo 3).
//   · **«la ley 6 crea urgencia» es verdadero A MEDIAS, y la mitad importa.** En
//     una celda SECA la putrefacción se frena sola —la ley 11 le saca la humedad
//     y `toxicity` se clava en 0,2722— y en una MOJADA llega a 0,9997 con la
//     nutrición en 0,0027. O sea que la urgencia depende de la celda, y la mente
//     ordena JUSTO AL REVÉS: entre lo fresco y lo que se está pudriendo, elige lo
//     fresco (7,7110 contra 7,2727) y deja que lo otro se pudra (grupo 7).
//
// ═══ Y UN TERCERO QUE NO BUSCABA: EL VALOR DE LA COMIDA NO MIRA EL TANQUE ═══
//
// `satisfaccionDe` normaliza contra la suma de las necesidades (`calma / duele`),
// así que con la energía como única necesidad viva el cociente da lo mismo con el
// tanque en 310 que en 999. Medido en la MISMA escena, seis tanques: la necesidad
// de energía se mueve de 0,4761 a 0,0000 —**4761×**— y `holding(tag:carnoso)`
// vale **0,4688 en los seis**. Para ORDENAR entre cosas distintas está bien; para
// decidir si conviene tragar YA lo que se lleva encima no dice nada, y de ahí sale
// el derrame del 86% del grupo (3).
//
// ═══ Y LO QUE SÍ FUNCIONA, QUE TAMBIÉN HAY QUE DECIRLO ══════════════════════
//
// **Elegir qué comer anda bien y sin una sola tabla** (grupo 4): con grasa cruda
// y pescado crudo en la misma mano, la lista de oportunidades ofrece la grasa
// (+14,15) y el pescado no aparece — no es que salga último, es que no es una
// oportunidad. La trampa que quedó al lado es otra y está medida: la tolerancia
// de fábrica de la innata `comer` (0,2) deja pasar el grano, que tiene `toxicity`
// 0,20 clavado y un neto de **−3,05 por kilo**.

import { describe, expect, it } from 'vitest'

import type { QualityId } from '@anima/physics'
import { qualityOf, T_AMBIENTE } from '@anima/physics'
import { Contexto, Partida } from '@anima/perceive'
import type { GoalNode, PlanResult, Step } from '@anima/plan'
import {
  cumple,
  ESQUEMAS,
  EXPANSIONES_POR_TICK,
  FIRMA_DE_LO_COCIDO,
  interpretar,
  plan,
  POTENCIA_QUE_COCINA_LO_CARNOSO,
  SEGUNDOS_DE_COCCION,
} from '@anima/plan'
import type { WorldState } from '@anima/world'
import {
  apply,
  COSTO_POR_TOXICIDAD_Y_KILO,
  COSTO_VIVIR_POR_SEGUNDO,
  eat,
  STAMINA_POR_CALORIA,
  stepWorld,
} from '@anima/world'

import { Creencias } from '../src/creencias.js'
import { Mente, vivir } from '../src/mente.js'
import { necesidades } from '../src/necesidades.js'
import { alientoDelEsquema, opportunities } from '../src/oportunidades.js'
import type { Opportunity, VistaDeLaMente } from '../src/tipos.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, laOrilla, mundo, PHYS } from './mundo.js'

// ─── El armado ──────────────────────────────────────────────────────────────

const d4 = (x: number): string => x.toFixed(4)

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

function vistaDe(p: Partida, quien: string): VistaDeLaMente {
  return new Contexto(p.proyeccion, { actor: quien, rng: p.dado.tirar, lugares: p.lugares }).ctx
}

function aliento(s: WorldState, quien: string): number {
  const b = s.bodies.get(`${quien}-cuerpo`)
  return b === undefined ? 0 : qualityOf(b.body, 'stamina', s.phys)
}

function q(s: WorldState, id: string, cual: QualityId): number {
  const b = s.bodies.get(id)
  if (b === undefined) return Number.NaN
  return qualityOf(b.body, cual, s.phys)
}

/**
 * Un pescado COCIDO armado a mano, con los números que midió el agente del
 * veneno corriendo `stepWorld` sobre una pieza de 2 kg en una parrilla. Se usa
 * SÓLO donde lo que se mide es la mente; donde lo que se mide es el mundo se
 * cocina de verdad (grupos 1 y 3).
 */
function cocido(id: string, masa: number): ReturnType<typeof cuerpo> {
  return cuerpo(id, 'pescado', masa, { digestibility: 0.85, toxicity: 0.0345 }, 'bloque')
}

/** El neto de tragarse algo, con la cuenta del mundo copiada y no modelada. */
function netoDe(s: WorldState, id: string): number {
  return (
    q(s, id, 'calories') * STAMINA_POR_CALORIA -
    q(s, id, 'toxicity') * q(s, id, 'mass') * COSTO_POR_TOXICIDAD_Y_KILO
  )
}

/**
 * LA COCINA DE VERDAD: un leño ardiendo, una losa apoyada encima, y `n` piezas
 * de pescado apoyadas sobre la losa.
 *
 * Es la pila que el esquema de ley describe —`['fuego', 'parrilla', 'comida']`—
 * con la única diferencia que este archivo persigue: MÁS DE UNA comida. El leño
 * de 1,2 kg es el mismo de la contraprueba de `hito-5-el-criterio.test.ts`
 * (`emitsPower` 360,72, en el medio de la ventana `[253 ; 410)`).
 */
function laCocina(n: number): WorldState {
  const comidas = Array.from({ length: n }, (_, i) => ({
    ...enElPiso(cuerpo(`p${String(i + 1)}`, 'pescado', 2, {}, 'bloque'), { x: 0, y: 0 }),
    supportedBy: 'losa',
  }))
  return mundo({
    hz: 20,
    bodies: [
      enElPiso(cuerpo('fuego', 'madera', 1.2, { temperature: 700 }, 'vara'), { x: 0, y: 0 }),
      { ...enElPiso(cuerpo('losa', 'piedra', 1, {}, 'bloque'), { x: 0, y: 0 }), supportedBy: 'fuego' },
      ...comidas,
    ],
  })
}

/** La escena de la contraprueba del Hito 5: la orilla, la vara, la liana, el fuego y la losa. */
function conFuegoYLosa(): WorldState {
  const o = laOrilla()
  const p = o.parada
  return mundo({
    dios: o.dios,
    bodies: [
      enElPiso(criatura('ana', 310), p),
      enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: p.x + 3, y: p.y }),
      enElPiso(cuerpo('matorral', 'liana', 0.2, {}, 'hebra'), { x: p.x - 2, y: p.y + 1 }),
      enElPiso(cuerpo('fogata', 'madera', 1.2, { temperature: 500 }, 'bloque'), p),
      enElPiso(cuerpo('losa', 'piedra', 0.5, {}, 'bloque'), p),
    ],
    actors: [actor('ana', { capacity: 3 })],
  })
}

function planDe(texto: string, v: VistaDeLaMente, exp = EXPANSIONES_POR_TICK * 8): PlanResult {
  const p = interpretar(texto)
  if (p === undefined) throw new Error(`el intérprete no lee «${texto}»`)
  const g: GoalNode = { id: 'meta', goal: p, after: [], porque: 'el adversario' }
  return plan(g, v, exp)
}

/**
 * LO QUE CUESTA ENCENDER UNA PIEZA DE MADERA FROTÁNDOLA, medido en el mundo.
 *
 * Se frota hasta que la pieza EMITE (`emitsPower > 0`, que es el ADR II-0001
 * hecho aritmética: cruzar el `ignitionPoint`) o hasta que la criatura se queda
 * sin aliento. No se despeja de ninguna fórmula: se corre `friccion` de verdad,
 * tick a tick, y se lee el tanque antes y después.
 */
interface Encendida {
  readonly masa: number
  readonly ticks: number
  readonly costo: number
  readonly emitsPower: number
  readonly llegoAEmitir: boolean
}

function encender(masa: number, techo = 800): Encendida {
  let s: WorldState = mundo({
    bodies: [
      enElPiso(criatura('ana', 1000), { x: 0, y: 0 }),
      enLaMano(cuerpo('yesca', 'madera', masa, {}, 'vara'), { x: 0, y: 0 }, 'ana'),
      enLaMano(cuerpo('base', 'madera', 1, {}, 'vara'), { x: 0, y: 0 }, 'ana'),
    ],
    actors: [actor('ana', { holding: ['yesca', 'base'], capacity: 3 })],
  })
  const antes = aliento(s, 'ana')
  let potencia = 0
  let ticks = 0
  for (let t = 0; t < techo; t++) {
    const i = apply({ by: 'ana', seq: t + 1 }, PHYS, 'friccion', [
      { name: 'a', body: 'yesca' },
      { name: 'b', body: 'base' },
      { name: 'actor', body: 'ana-cuerpo' },
    ])
    if (i === undefined) throw new Error('`friccion` dejó de existir en el catálogo')
    s = stepWorld(s, [i]).state
    ticks++
    if (s.bodies.get('yesca') === undefined) break
    potencia = q(s, 'yesca', 'emitsPower')
    if (potencia > 0) break
    // Sin aliento no se frota más: el `poweredBy` de `friccion` sale del tanque.
    if (aliento(s, 'ana') <= 0) break
  }
  return {
    masa,
    ticks,
    costo: antes - aliento(s, 'ana'),
    emitsPower: potencia,
    llegoAEmitir: potencia > 0,
  }
}

// ═══ (1) COCINAR DE A VARIOS ════════════════════════════════════════════════
//
// La conducta razonable: junté cuatro pescados, prendí UN fuego —que es lo caro—
// y los pongo los cuatro. Es lo primero que hace cualquiera que cocine.

describe('(1) cocinar de a varios: el mundo lo paga y la mente no lo puede pedir', () => {
  it('EL MUNDO: cuatro pescados sobre la misma losa se cocinan los cuatro, a la vez', () => {
    let s = laCocina(4)
    const cocidoEn = new Map<string, number>()
    let salioDeLaVentana: number | undefined
    for (let t = 1; t <= 600; t++) {
      s = stepWorld(s, []).state
      const pot = q(s, 'fuego', 'emitsPower')
      if (salioDeLaVentana === undefined && pot < POTENCIA_QUE_COCINA_LO_CARNOSO.minima) {
        salioDeLaVentana = t
      }
      for (const id of ['p1', 'p2', 'p3', 'p4']) {
        if (cocidoEn.has(id)) continue
        if (q(s, id, 'digestibility') >= 0.85 && q(s, id, 'toxicity') <= 0.05) cocidoEn.set(id, t)
      }
    }
    const primero = cocidoEn.get('p1') ?? 0
    const filas = ['─── UNA LOSA, UN FUEGO, CUATRO PESCADOS ───']
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      filas.push(
        `  ${id}: cocido en el tick ${String(cocidoEn.get(id))} · dig ${d4(q(s, id, 'digestibility'))} · ` +
          `tox ${d4(q(s, id, 'toxicity'))} · charred ${d4(q(s, id, 'charred'))} · neto ${d4(netoDe(s, id))}`,
      )
    }
    filas.push(
      `  el fuego sale de la ventana [${d4(POTENCIA_QUE_COCINA_LO_CARNOSO.minima)} ; ` +
        `${d4(POTENCIA_QUE_COCINA_LO_CARNOSO.maxima)}) en el tick ${String(salioDeLaVentana)}, ` +
        `o sea ${((salioDeLaVentana ?? 0) / primero).toFixed(1)} hornadas`,
    )
    log(filas)

    // Los cuatro se cocinan, y en el MISMO tick: la ley 5 no reparte calor entre
    // los que están apoyados, empuja sobre cada uno por su cuenta.
    expect(cocidoEn.size).toBe(4)
    expect([...cocidoEn.values()].every((t) => t === primero)).toBe(true)
    // Y ninguno se quema: la losa es lo que separa cocinar de carbonizar.
    for (const id of ['p1', 'p2', 'p3', 'p4']) expect(q(s, id, 'charred')).toBe(0)
    // El fuego aguanta MUCHO más de lo que una hornada tarda. La conducta que el
    // mundo premia es juntar primero y cocinar después.
    expect(salioDeLaVentana ?? 0).toBeGreaterThan(primero * 4)
  })

  it('LA MENTE: el vocabulario de metas NO TIENE NÚMERO, y el plan toca un pescado', () => {
    // (a) la cantidad no se puede escribir. No es que no haya esquema: es que el
    //     intérprete no la lee, así que la meta ni siquiera nace.
    const conCantidad = [
      'holding(tag:carnoso,count>=4)',
      'holding(tag:carnoso,cuantos>=4)',
      'count>=4',
      'holding(tag:carnoso)x4',
    ]
    const filas = ['─── LO QUE NO SE PUEDE PEDIR ───']
    for (const t of conCantidad) {
      filas.push(`  ${t.padEnd(34)} → ${interpretar(t) === undefined ? 'EL INTÉRPRETE NO LO LEE' : 'parsea'}`)
    }

    // (b) y la única fila que cocina nombra UN rol `comida` en su pila.
    for (const e of ESQUEMAS) {
      if (e.k !== 'ley') continue
      filas.push(`  ley ${e.ley}: pila [${e.pila.join(', ')}] · sujeto «${e.sujeto}»`)
    }

    // (c) el plan de verdad, sobre la escena de la contraprueba del Hito 5.
    const p = new Partida(conFuegoYLosa())
    vivir(p, new Map([['ana', new Mente({ actor: 'ana', memoria: new Creencias() })]]), 200)
    const r = planDe(FIRMA_DE_LO_COCIDO, vistaDe(p, 'ana'), EXPANSIONES_POR_TICK * 60)
    const pasos: readonly Step[] = r.k === 'plan' ? r.steps : []
    filas.push(`  plan(«${FIRMA_DE_LO_COCIDO}») → ${r.k}: ${pasos.map((x) => x.k).join(' → ')}`)
    const pescas = pasos.filter((x) => x.k === 'aplicar' && x.proceso === 'extraccion').length
    const puestos = pasos.filter((x) => x.k === 'poner').length
    const levantados = pasos.filter((x) => x.k === 'sostener').length
    filas.push(`  extracciones ${String(pescas)} · poner ${String(puestos)} · sostener ${String(levantados)}`)
    log(filas)

    for (const t of conCantidad) expect(interpretar(t)).toBeUndefined()
    for (const e of ESQUEMAS) {
      if (e.k !== 'ley') continue
      expect(e.pila.filter((rol) => rol === e.sujeto)).toHaveLength(1)
    }
    expect(r.k).toBe('plan')
    // UNA pesca, DOS `poner` —la losa y la comida—, UN `sostener`.
    //
    // Y la cuenta de las pescas fue y volvió, las dos veces por el mismo motivo y
    // ninguna tiene que ver con lo que este test ataca. Cuando se escribió era 1,
    // porque `cumpleCuerpo` de `@anima/plan` no sabía contestar `holding(tag:…)` y el
    // pescado agarrado no contaba. Después fue 0, porque aprendió a contestarlo y los
    // 200 ticks de `vivir` de acá arriba dejaban un pescado en la mano. Y hoy es 1
    // otra vez, porque en esos mismos 200 ticks la criatura **ya lo cocinó y se lo
    // comió**: la espera del plan dejó de ser ciega y corta a los 100 ticks en vez de
    // a los 300, así que el bocado entra adentro de la ventana. La mano está vacía y
    // hay que volver al pozo.
    //
    // Lo que este test ataca NO se movió ni un milímetro: sigue habiendo UN solo rol
    // `comida` en la pila de la ley, así que para cada pescado hay que rehacer el plan
    // entero, y con él la losa. De dónde sale el pescado es circunstancia de la
    // escena; que sean de a uno es la fila.
    expect(pescas).toBe(1)
    expect(puestos).toBe(2)
    expect(levantados).toBe(1)
  })

  /**
   * LO QUE HARÍA FALTA, y por qué no se arregla desde este paquete.
   *
   * «Cuatro cosas carnosas cocidas en la mano» es una meta sobre una CANTIDAD, y
   * `Predicado` no tiene dónde ponerla: sus tres formas hablan de un cuerpo
   * (`cualidad`, `geometria`) o de la mano (`sostiene`), y las tres son
   * EXISTENCIALES —«hay uno que…»—. La reparación es de `@anima/plan` y toca el
   * tipo, el intérprete, `textoDe`, `implica` y `cumple`; y del lado de acá toca
   * `opportunities`, que hoy sólo sabe fabricar `holding(tag:X)` y
   * `holding(tag:X,toxicity<t)`.
   *
   * El día que se pueda escribir, esto se pone verde solo.
   */
  it.fails('LO QUE FALTA: que «cuatro cocidos en la mano» sea una meta que se pueda escribir', () => {
    const meta = interpretar('holding(tag:carnoso,count>=4)')
    expect(meta).toBeDefined()
  })
})

// ═══ (2) NO COCINAR CUANDO NO CONVIENE ══════════════════════════════════════
//
// La conducta razonable: encender cuesta caro y un pescado rinde poco. Hay un
// punto donde cocinar no se paga, y la criatura tendría que verlo ANTES de
// gastar el tanque. La mente tiene un solo lugar donde eso podría entrar:
// `alientoDelEsquema`, que es lo que le suma de precio a la meta comestible.

describe('(2) la economía del fuego: la mente lo cotiza 27,6× barato', () => {
  it('lo que cuesta encender, medido frotando de verdad, contra lo que la mente cree', () => {
    // El barrido de masas. `emitsPower = step(T ≥ ignición) · fuelEnergy · mass ·
    // 16,7`, o sea que la potencia sube con la masa Y el precio de encender
    // también (`heatCapacity × ΔT / eficiencia`): es la tijera entera.
    const barrido = [0.1, 0.2, 0.5, 0.7132, 0.9].map((m) => encender(m))
    const filas = [
      '─── LO QUE CUESTA ENCENDER, Y LO QUE ENTREGA ───',
      `  la cocción de lo carnoso pide emitsPower en [${d4(POTENCIA_QUE_COCINA_LO_CARNOSO.minima)} ; ${d4(POTENCIA_QUE_COCINA_LO_CARNOSO.maxima)})`,
      '',
      '   masa │ ticks │   costo │ emitsPower │ ¿emite? │ ¿cocina?',
      '  ──────┼───────┼─────────┼────────────┼─────────┼─────────',
    ]
    for (const e of barrido) {
      filas.push(
        `  ${d4(e.masa).padStart(5)} │ ${String(e.ticks).padStart(5)} │ ${d4(e.costo).padStart(7)} │ ` +
          `${d4(e.emitsPower).padStart(10)} │ ${(e.llegoAEmitir ? 'SÍ' : 'no').padStart(7)} │ ` +
          `${(e.emitsPower >= POTENCIA_QUE_COCINA_LO_CARNOSO.minima ? 'SÍ' : 'no').padStart(8)}`,
      )
    }

    // El pescado cocido DE VERDAD, salido de correr la ley 5 y no armado a mano.
    let s = laCocina(1)
    for (let t = 0; t < 300; t++) s = stepWorld(s, []).state
    const netoDeUno = netoDe(s, 'p1')

    const pc = interpretar(FIRMA_DE_LO_COCIDO)
    if (pc === undefined) throw new Error('la firma de lo cocido dejó de parsear')
    const cotizado = alientoDelEsquema(pc)
    const masBarato = barrido.filter((e) => e.llegoAEmitir).reduce((a, b) => (a.costo <= b.costo ? a : b))

    filas.push(
      '',
      `  un pescado cocido de 2 kg deja ${d4(netoDeUno)} de aliento (cal ${d4(q(s, 'p1', 'calories'))}, tox ${d4(q(s, 'p1', 'toxicity'))})`,
      `  el fuego más barato que existe cuesta ${d4(masBarato.costo)} → hacen falta ${(masBarato.costo / netoDeUno).toFixed(1)} pescados para pagarlo`,
      `  y LA MENTE lo cotiza en ${d4(cotizado)} (= COSTO_VIVIR_POR_SEGUNDO × SEGUNDOS_DE_COCCION = ${String(SEGUNDOS_DE_COCCION)})`,
      `  se equivoca por ${(masBarato.costo / cotizado).toFixed(1)}× hacia abajo, y eso es TODA la decisión de cocinar o no`,
    )
    log(filas)

    // ─── (a) SE DIO VUELTA, Y ES EL TRAMO N ────────────────────────────────
    //
    // Decía: «NINGUNA pieza que se pueda encender frotando llega a la ventana de la
    // cocción. La que emite más de las que se encienden se queda corta, y las que
    // llegarían a la potencia se comen el tanque entero antes de prender», y lo
    // afirmaba con `emitsPower < POTENCIA_QUE_COCINA_LO_CARNOSO.minima` para todas.
    //
    // Con la eficiencia de `friccion` en 0,85 la vara de 0,9 kg sale 519,22 —entra
    // en un tanque de 1000— y emite 270,29 contra una ventana que arranca en 253:
    // **enciende Y cocina**. Es la primera pieza del proyecto que hace las dos
    // cosas. La tabla de arriba lo muestra fila por fila.
    //
    // Se afirma que EXISTE al menos una, que es la forma fuerte, y se sigue
    // afirmando que no todas llegan —si todas llegaran, la ventana no estaría
    // separando nada y el bloque se habría vuelto mudo—.
    const enciendenYCocinan = barrido.filter(
      (e) => e.llegoAEmitir && e.emitsPower >= POTENCIA_QUE_COCINA_LO_CARNOSO.minima,
    )
    expect(enciendenYCocinan.length).toBeGreaterThan(0)
    expect(enciendenYCocinan.length).toBeLessThan(barrido.filter((e) => e.llegoAEmitir).length)
    // (b) el fuego más barato QUE COCINA cuesta más de treinta pescados. Era «más de
    //     diez» sobre el más barato que EMITE, y ése hoy sale 4,9 pescados — pero no
    //     cocina, así que comparar contra él dejó de decir nada. La comparación que
    //     decide es contra el que sirve.
    const masBaratoQueCocina = enciendenYCocinan.reduce((a, b) => (a.costo <= b.costo ? a : b))
    expect(masBaratoQueCocina.costo / netoDeUno).toBeGreaterThan(30)
    // (c) y la mente lo cotiza en el `mientras` de la fila de ley y nada más: no
    //     ve el fuego, ve el rato que hay que esperar al lado del fuego.
    //
    //     ─── ACÁ HABÍA UNA CONFUSIÓN DE UNIDADES QUE EL 0,34 DESTAPÓ ────────
    //
    //     Decía `expect(cotizado).toBeCloseTo(SEGUNDOS_DE_COCCION, 10)`, o sea que
    //     comparaba ALIENTO contra SEGUNDOS y daba verde nada más que porque
    //     `COSTO_VIVIR_POR_SEGUNDO` valía 1,0. Con la constante en 0,34 la
    //     cotización mide 5,1000 y los segundos siguen siendo 15: la igualdad era
    //     de la calibración, no del código. Ahora se afirma el PRODUCTO, que es lo
    //     que `alientoDelEsquema` calcula de verdad.
    expect(cotizado).toBeCloseTo(COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_COCCION, 10)
    // Y el error de la mente pasó de 9,5× a 27,6× por el mismo motivo: lo que se
    // abarató es el segundo de espera, no el fuego.
    //
    // Y AHORA BAJÓ A 88,5× CONTRA EL FUEGO QUE SIRVE. Con la eficiencia en 0,85 el
    // fuego más barato que EMITE cotiza 11,5× arriba de lo que la mente cree, y el
    // más barato que COCINA, 101,8×. El error de la mente no se arregló ni un poco
    // —sigue cotizando el rato de espera y no el fuego— y lo único que se movió es
    // el número contra el que se lo compara. Se afirma contra el que sirve, por lo
    // mismo que en (b).
    expect(masBaratoQueCocina.costo / cotizado).toBeGreaterThan(50)
  })

  /**
   * `alientoDelEsquema` mira UNA fila del índice y devuelve su `segundos`. Está
   * escrito en su propio comentario que es un piso y no una estimación — lo que
   * no está dicho es el tamaño del error, y el tamaño es la decisión: 5,10 contra
   * 140,70 no ordena mal, ordena al revés. (Era 15 contra 142,29 cuando
   * `COSTO_VIVIR_POR_SEGUNDO` valía 1,0; abaratar el segundo abarató la
   * cotización y dejó el fuego donde estaba.)
   *
   * La reparación no es un número más grande escrito a mano: es que el precio de
   * una meta salga de la CADENA que la establece y no de su último eslabón, y eso
   * lo sabe `plan()` y no `oportunidades.ts`. Hoy no se puede pedir sin correr la
   * regresión entera por cada candidato de D3, que es el peldaño con presupuesto.
   */
  it.fails('LO QUE FALTA: que el precio de lo cocido incluya el fuego que hay abajo', () => {
    const pc = interpretar(FIRMA_DE_LO_COCIDO)
    if (pc === undefined) throw new Error('la firma de lo cocido dejó de parsear')
    const masBarato = encender(0.1)
    expect(alientoDelEsquema(pc)).toBeGreaterThanOrEqual(masBarato.costo)
  })
})

// ═══ (3) GUARDAR LO COCIDO ══════════════════════════════════════════════════
//
// La conducta razonable: cocinar cuesta un fuego, así que lo cocido se guarda y
// se come cuando hace falta. Es la única forma de amortizar el grupo (2).

describe('(3) guardar lo cocido: la reserva existe en el mundo y se traga al toque', () => {
  it('EL MUNDO: lo cocido de verdad AGUANTA — 200 segundos afuera y sigue cocido', () => {
    let s = laCocina(1)
    for (let t = 0; t < 300; t++) s = stepWorld(s, []).state
    const b = s.bodies.get('p1')
    if (b === undefined) throw new Error('el pescado se evaporó cocinándose')

    // Se lo saca del fuego y se lo deja tirado en una celda seca.
    let afuera: WorldState = mundo({ hz: 20, bodies: [enElPiso({ ...b.body }, { x: 5, y: 5 })] })
    const filas = ['─── LA RESERVA, FUERA DEL FUEGO ───']
    let dejoDeEstarCocido: number | undefined
    for (let t = 1; t <= 4000; t++) {
      afuera = stepWorld(afuera, []).state
      const dig = q(afuera, 'p1', 'digestibility')
      const tox = q(afuera, 'p1', 'toxicity')
      if (dejoDeEstarCocido === undefined && !(dig >= 0.85 && tox <= 0.05)) dejoDeEstarCocido = t
      if (t === 20 || t === 400 || t === 4000) {
        filas.push(
          `  +${String(t).padStart(4)} ticks (${(t / 20).toFixed(0).padStart(3)} s): T ${d4(q(afuera, 'p1', 'temperature'))} · ` +
            `dig ${d4(dig)} · tox ${d4(tox)} · cal ${d4(q(afuera, 'p1', 'calories'))} · neto ${d4(netoDe(afuera, 'p1'))}`,
        )
      }
    }
    filas.push(`  deja de cumplir «cocido»: ${dejoDeEstarCocido === undefined ? 'NUNCA en 4000 ticks' : `en el tick ${String(dejoDeEstarCocido)}`}`)
    log(filas)

    // La hipótesis que traía —«lo cocido se pudre rápido»— es FALSA y hay que
    // decirlo: la ley 6 le sube `toxicity` y se frena sola, porque la ley 11 le
    // saca la humedad y la putrefacción escala con `moisture`.
    expect(dejoDeEstarCocido).toBeUndefined()
    expect(q(afuera, 'p1', 'digestibility')).toBeGreaterThanOrEqual(0.85)
    expect(netoDe(afuera, 'p1')).toBeGreaterThan(0)
  })

  it('LA MENTE: ofrece el bocado igual con el tanque casi lleno, y se derrama el 86%', () => {
    const filas = ['─── LA RESERVA SE TRAGA APENAS DA POSITIVO ───']
    let derramePeor = 0
    for (const st of [310, 900, 980, 990, 995]) {
      const w = mundo({
        bodies: [
          enElPiso(criatura('ana', st), { x: 0, y: 0 }),
          enLaMano(cocido('r', 2.887), { x: 0, y: 0 }, 'ana'),
        ],
        actors: [actor('ana', { holding: ['r'], capacity: 3 })],
      })
      const bruto = q(w, 'r', 'calories') * STAMINA_POR_CALORIA
      const veneno = q(w, 'r', 'toxicity') * q(w, 'r', 'mass') * COSTO_POR_TOXICIDAD_Y_KILO
      const p = new Partida(w)
      const v = vistaDe(p, 'ana')
      const o = opportunities(v, new Creencias(), necesidades(v)).find((x) => x.bocado !== undefined)
      // Y lo que el mundo hace de verdad si se lo come.
      const r = stepWorld(w, [eat({ by: 'ana', seq: 1 }, 'r')])
      const gano = aliento(r.state, 'ana') - st
      const derrame = bruto - veneno - gano
      if (derrame > derramePeor) derramePeor = derrame
      filas.push(
        `  aliento ${String(st).padStart(3)}: ${o === undefined ? 'no hay bocado' : `HAY BOCADO (neto ${d4(o.bocado?.neto ?? 0)})`} · ` +
          `el mundo le deja ${d4(gano)} de los ${d4(bruto - veneno)} posibles · SE DERRAMAN ${d4(derrame)}`,
      )
    }
    filas.push(`  peor derrame medido: ${d4(derramePeor)} de aliento, ${((derramePeor / (19.6316 - 2.49)) * 100).toFixed(0)}% del pescado`)
    log(filas)

    // Con el tanque casi lleno el bocado SIGUE EXISTIENDO —el neto es positivo,
    // así que la desigualdad del ADR II-0013 lo deja pasar— y lo que se pierde no
    // lo ve nadie: `mordidaDe` ya topa `gana` contra el margen, o sea que la mente
    // SABE que va a rendir menos y no tiene ninguna meta con la que decir «lo
    // guardo». El único acto que su vocabulario tiene sobre comida es tragarla.
    expect(derramePeor).toBeGreaterThan(9)
  })

  it('y el valor de una meta de comida NO BAJA cuando el tanque se llena', () => {
    // `satisfaccionDe` normaliza contra la suma de las necesidades
    // (`calma / duele`), así que con la energía como única necesidad viva el
    // cociente da lo mismo esté el tanque en 310 o en 999. Es correcto para
    // ORDENAR entre cosas distintas y es lo que hace que «me lleno de comida»
    // valga lo mismo que «me muero de hambre».
    const filas = ['─── LA MISMA ESCENA, SEIS TANQUES ───']
    const valores: number[] = []
    for (const st of [310, 700, 900, 950, 990, 999]) {
      const w = mundo({
        bodies: [
          enElPiso(criatura('ana', st), { x: 0, y: 0 }),
          enElPiso(cuerpo('fuego', 'madera', 1.2, { temperature: 700 }, 'vara'), { x: 1, y: 0 }),
          enElPiso(cuerpo('losa', 'piedra', 1, {}, 'bloque'), { x: 1, y: 1 }),
          enLaMano(cuerpo('p1', 'pescado', 2, {}, 'bloque'), { x: 0, y: 0 }, 'ana'),
          enElPiso(cuerpo('p2', 'pescado', 2, {}, 'bloque'), { x: 0, y: 1 }),
        ],
        actors: [actor('ana', { holding: ['p1'], capacity: 6 })],
      })
      const p = new Partida(w)
      const v = vistaDe(p, 'ana')
      const n = necesidades(v)
      const ops = opportunities(v, new Creencias(), n)
      const carnoso = ops.find((o) => o.meta === 'holding(tag:carnoso)')
      valores.push(carnoso?.valor ?? Number.NaN)
      filas.push(
        `  aliento ${String(st).padStart(3)}: necesidad de energía ${d4(n.energia)} · ` +
          `oportunidades ${String(ops.length)} · «holding(tag:carnoso)» vale ${d4(carnoso?.valor ?? Number.NaN)}`,
      )
    }
    filas.push('  la necesidad se mueve 4761× y el valor de la comida no se mueve NADA.')
    log(filas)

    const primero = valores[0]
    if (primero === undefined) throw new Error('sin valores')
    for (const x of valores) expect(x).toBeCloseTo(primero, 12)
  })

  /**
   * La meta que falta es «tener reservas», y no se puede ni empezar a escribir:
   * `holding(tag:X)` es existencial —uno alcanza y veinte no dicen más— y no hay
   * ninguna forma de predicado que hable de lo que se guarda para después.
   */
  it.fails('LO QUE FALTA: que «tener una reserva cocida» sea algo que se pueda querer', () => {
    const meta = interpretar('holding(tag:carnoso,digestibility>=0.85,count>=3)')
    expect(meta).toBeDefined()
  })
})

// ═══ (4) ELEGIR QUÉ COMER ═══════════════════════════════════════════════════

describe('(4) elegir qué comer: esto SÍ anda, y la trampa que quedó al lado', () => {
  it('con grasa y pescado crudos en la misma mano, ofrece la grasa y el pescado NO EXISTE', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        enLaMano(cuerpo('grasa', 'grasa', 1, {}, 'bloque'), { x: 0, y: 0 }, 'ana'),
        enLaMano(cuerpo('pez', 'pescado', 1, {}, 'bloque'), { x: 0, y: 0 }, 'ana'),
      ],
      actors: [actor('ana', { holding: ['grasa', 'pez'], capacity: 3 })],
    })
    const p = new Partida(w)
    const v = vistaDe(p, 'ana')
    const ops = opportunities(v, new Creencias(), necesidades(v))
    const bocados = ops.filter((o: Opportunity) => o.bocado !== undefined)
    log([
      '─── LOS DOS EN LA MISMA MANO ───',
      `  grasa (K de corte 308): cal/kg ${d4(q(w, 'grasa', 'calories'))} · tox ${d4(q(w, 'grasa', 'toxicity'))} · neto ${d4(netoDe(w, 'grasa'))}`,
      `  pescado (K de corte 12,16): cal/kg ${d4(q(w, 'pez', 'calories'))} · tox ${d4(q(w, 'pez', 'toxicity'))} · neto ${d4(netoDe(w, 'pez'))}`,
      ...bocados.map((o) => `  ofrece: ${o.id} (valor ${d4(o.valor)}) — «${o.porque}»`),
      `  bocados ofrecidos: ${String(bocados.length)}`,
    ])

    // Elige bien, y sin una tabla de «esto es comida y esto no»: el pescado crudo
    // no sale último, NO ES UNA OPORTUNIDAD. Sale de restar dos números del mundo.
    expect(bocados).toHaveLength(1)
    expect(bocados[0]?.bocado?.id).toBe('grasa')
    expect(netoDe(w, 'grasa')).toBeGreaterThan(0)
    expect(netoDe(w, 'pez')).toBeLessThan(0)
  })

  it('LA TRAMPA: la tolerancia de fábrica de `comer` deja pasar el grano, que resta', () => {
    // `comer(ctx, {})` —sin `bocado` y sin `toxicidadTolerada`— se autoimpone 0,2
    // y elige por `calories`. El 0,2 es un umbral sobre `toxicity` y el mundo cobra
    // `toxicity × masa × 25`: son dos escalas distintas, así que el umbral no
    // protege de nada por sí solo.
    const filas = ['─── QUÉ PASA EL 0,2 DE FÁBRICA, Y CUÁNTO DEJA ───']
    const colados: string[] = []
    for (const sust of ['grasa', 'medula', 'huevo', 'grano', 'pescado', 'carne', 'hoja']) {
      const w = mundo({ bodies: [enElPiso(cuerpo('x', sust, 1, {}, 'bloque'), { x: 0, y: 0 })] })
      const tox = q(w, 'x', 'toxicity')
      const neto = netoDe(w, 'x')
      const pasa = tox <= 0.2
      if (pasa && neto < 0) colados.push(sust)
      filas.push(
        `  ${sust.padEnd(9)} cal/kg ${d4(q(w, 'x', 'calories')).padStart(8)} · tox ${d4(tox)} · ` +
          `${pasa ? 'PASA' : 'no  '} · neto por kilo ${d4(neto).padStart(9)}`,
      )
    }
    filas.push(`  se cuelan con neto NEGATIVO: ${colados.length === 0 ? 'ninguno' : colados.join(', ')}`)
    filas.push(
      '  hoy no muerde: `plan()` no emite `Step.comer` en ninguna rama (`k: \'comer\'` aparece',
      '  UNA sola vez en todo `plan/src`, y es la declaración del tipo). La mente come por',
      '  `tragar`, que lleva la tolerancia calculada. Es una trampa armada, no disparada.',
    )
    log(filas)

    // El grano tiene `toxicity` 0,20 CLAVADO en el umbral, y `<=` lo deja pasar.
    expect(colados).toContain('grano')
  })
})

// ═══ (5) COMER A MEDIAS ═════════════════════════════════════════════════════

describe('(5) comer a medias: el mismo pescado rinde 2× partido, y no hay con qué partirlo', () => {
  it('entero contra cuartos, MISMO horizonte y MISMA masa total', () => {
    const HORIZONTE = 804
    const arranque = 990

    const correr = (piezas: readonly (readonly [string, number])[], cada: number): number => {
      let s: WorldState = mundo({
        bodies: [
          enElPiso(criatura('ana', arranque), { x: 0, y: 0 }),
          ...piezas.map(([id, m]) => enLaMano(cocido(id, m), { x: 0, y: 0 }, 'ana')),
        ],
        actors: [actor('ana', { holding: piezas.map(([id]) => id), capacity: 6 })],
      })
      let t = 0
      let seq = 1
      for (const [id] of piezas) {
        s = stepWorld(s, [eat({ by: 'ana', seq: seq++ }, id)]).state
        t++
        for (let k = 0; k < cada && t < HORIZONTE; k++, t++) s = stepWorld(s, []).state
      }
      for (; t < HORIZONTE; t++) s = stepWorld(s, []).state
      return aliento(s, 'ana')
    }

    const entero = correr([['todo', 2.887]], 0)
    const cuartos = correr(
      [
        ['q1', 0.72175],
        ['q2', 0.72175],
        ['q3', 0.72175],
        ['q4', 0.72175],
      ],
      200,
    )
    let sinComer: WorldState = mundo({
      bodies: [enElPiso(criatura('ana', arranque), { x: 0, y: 0 })],
      actors: [actor('ana', { capacity: 6 })],
    })
    for (let t = 0; t < HORIZONTE; t++) sinComer = stepWorld(sinComer, []).state
    const base = aliento(sinComer, 'ana')

    log([
      `─── EL MISMO PESCADO (2,887 kg), A LOS ${String(HORIZONTE)} TICKS ───`,
      `  sin comer nada:      ${d4(base)}`,
      `  de un bocado:        ${d4(entero)}  →  recuperó ${d4(entero - base)}`,
      `  en cuatro, uno cada 200 ticks: ${d4(cuartos)}  →  recuperó ${d4(cuartos - base)}`,
      `  partirlo vale ${((cuartos - base) / (entero - base)).toFixed(2)}× — y la masa total es la misma,`,
      '  o sea que el veneno cobrado también es el mismo. Lo único que cambia es que',
      '  las calorías no se derraman contra el techo del tanque.',
    ])

    expect(entero).toBeGreaterThan(base)
    expect(cuartos).toBeGreaterThan(entero)
    expect((cuartos - base) / (entero - base)).toBeGreaterThan(1.9)
  })

  it('y no hay ninguna forma de partir comida: `deshilachar` la rebota', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 1000), { x: 0, y: 0 }),
        enLaMano(cuerpo('pez', 'pescado', 2.887, {}, 'bloque'), { x: 0, y: 0 }, 'ana'),
      ],
      actors: [actor('ana', { holding: ['pez'], capacity: 6 })],
    })
    const i = apply({ by: 'ana', seq: 1 }, PHYS, 'deshilachar', [
      { name: 'source', body: 'pez' },
      { name: 'actor', body: 'ana-cuerpo' },
    ])
    if (i === undefined) throw new Error('`deshilachar` dejó de existir en el catálogo')
    const r = stepWorld(w, [i])
    const motivo = r.events.find((e) => e.k === 'rechazada')
    log([
      '─── ¿SE PUEDE PARTIR UN PESCADO? ───',
      `  el proceso pide flexibility>=0,8 y tensile>=0,3`,
      `  el pescado tiene flexibility ${d4(q(w, 'pez', 'flexibility'))} y tensile ${d4(q(w, 'pez', 'tensile'))}`,
      `  el mundo contesta: ${motivo === undefined ? 'lo aceptó' : motivo.por}`,
      `  cuerpos después del intento: ${[...r.state.bodies.keys()].join(', ')}`,
      '  `split` es el único `yield` que baja masa y sólo lo tiene `deshilachar`. Ninguna',
      '  de las quince innatas parte nada, y `Step` no tiene una variante que lo pida.',
    ])

    expect(motivo?.por).toBe('rol-no-cumple')
    // Y no nació ningún cuerpo: sigue habiendo dos, la criatura y el pescado entero.
    expect(r.state.bodies.size).toBe(2)
    expect(q(r.state, 'pez', 'mass')).toBeCloseTo(2.887, 10)
  })
})

// ═══ (6) APAGAR EL FUEGO ════════════════════════════════════════════════════

describe('(6) apagar el fuego: no falla, contesta un plan de CERO pasos', () => {
  it('el fuego se lleva puesto lo que tiene encima, y dura sesenta segundos', () => {
    let s: WorldState = mundo({
      hz: 20,
      bodies: [
        enElPiso(cuerpo('fuego', 'madera', 1.2, { temperature: 700 }, 'vara'), { x: 0, y: 0 }),
        { ...enElPiso(cuerpo('vecino', 'madera', 0.5, {}, 'vara'), { x: 0, y: 0 }), supportedBy: 'fuego' },
      ],
    })
    let vecinoArdio: number | undefined
    let seApago: number | undefined
    for (let t = 1; t <= 3000; t++) {
      s = stepWorld(s, []).state
      const pot = q(s, 'fuego', 'emitsPower')
      if (seApago === undefined && pot <= 0) seApago = t
      if (vecinoArdio === undefined && q(s, 'vecino', 'emitsPower') > 0) vecinoArdio = t
    }
    log([
      '─── LO QUE UN FUEGO DESATENDIDO HACE ───',
      `  el vecino de 0,5 kg apoyado encima se prendió en el tick ${String(vecinoArdio)}`,
      `  a los 3000 ticks está charred ${d4(q(s, 'vecino', 'charred'))} y emite ${d4(q(s, 'vecino', 'emitsPower'))}`,
      `  el fuego se apagó solo en el tick ${String(seApago)} (${((seApago ?? 0) / 20).toFixed(0)} s)`,
    ])

    expect(vecinoArdio).toBeLessThanOrEqual(5)
    expect(q(s, 'vecino', 'charred')).toBe(1)
    expect(seApago).toBeDefined()
  })

  it('LA META: `emitsPower<=0` se da POR CUMPLIDA con un fuego a dos celdas', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        enElPiso(cuerpo('fuego', 'madera', 1.2, { temperature: 700 }, 'vara'), { x: 1, y: 0 }),
        enElPiso(cuerpo('piedra', 'piedra', 1, {}, 'bloque'), { x: 1, y: 1 }),
      ],
      actors: [actor('ana', { capacity: 3 })],
    })
    const p = new Partida(w)
    const v = vistaDe(p, 'ana')

    const filas = ['─── QUERER QUE ALGO DEJE DE ARDER ───', `  el fuego emite ${d4(q(w, 'fuego', 'emitsPower'))}`]
    for (const texto of ['emitsPower<=0', 'emitsPower<1', 'temperature<100']) {
      const pr = interpretar(texto)
      if (pr === undefined) {
        filas.push(`  ${texto.padEnd(16)} → el intérprete no lo lee`)
        continue
      }
      const r = planDe(texto, v)
      filas.push(
        `  ${texto.padEnd(16)} → cumple=${String(cumple(pr, v))} · plan=${r.k}` +
          (r.k === 'plan' ? ` con ${String(r.steps.length)} pasos` : ''),
      )
    }
    filas.push(
      '  la piedra de al lado emite 0, y `cumple` es EXISTENCIAL —recorre `see()` y con que',
      '  UNO lo cumpla alcanza—, así que la meta ya está cumplida mientras el fuego arde.',
      '  No hay forma de nombrar el cuerpo: `Predicado` no tiene un `BodyId` en ninguna de',
      '  sus tres formas, y ninguna de las nueve `IntentKind` del mundo apaga nada.',
    )
    log(filas)

    const pr = interpretar('emitsPower<=0')
    if (pr === undefined) throw new Error('`emitsPower<=0` dejó de parsear')
    // El fuego está ahí, ardiendo, y la meta dice que sí.
    expect(q(w, 'fuego', 'emitsPower')).toBeGreaterThan(0)
    expect(cumple(pr, v)).toBe(true)
    const r = planDe('emitsPower<=0', v)
    expect(r.k).toBe('plan')
    if (r.k !== 'plan') throw new Error('imposible')
    expect(r.steps).toHaveLength(0)
  })

  /**
   * Lo que falta son DOS cosas y una sola de ellas es de la mente.
   *
   *   · del MUNDO: no hay primitiva que apague. Las nueve `IntentKind` son `wait`,
   *     `goTo`, `explore`, `take`, `drop`, `put`, `eat`, `apply` y `place`, y
   *     ninguna toca la temperatura de un cuerpo ajeno. La ley 12 tapa una CELDA,
   *     no un cuerpo. Hoy la única forma de que un fuego se apague es que se
   *     consuma solo, y eso tarda 1200 ticks.
   *   · del VOCABULARIO: una meta no puede hablar de UN cuerpo. Mientras
   *     `Predicado` sea existencial, «que ESO deje de arder» va a seguir dando
   *     verde con cualquier piedra fría a la vista.
   */
  it.fails('LO QUE FALTA: que una meta pueda hablar de UN cuerpo y no de «alguno»', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        enElPiso(cuerpo('fuego', 'madera', 1.2, { temperature: 700 }, 'vara'), { x: 1, y: 0 }),
        enElPiso(cuerpo('piedra', 'piedra', 1, {}, 'bloque'), { x: 1, y: 1 }),
      ],
      actors: [actor('ana', { capacity: 3 })],
    })
    const p = new Partida(w)
    const pr = interpretar('emitsPower<=0')
    if (pr === undefined) throw new Error('`emitsPower<=0` dejó de parsear')
    // Con un fuego ardiendo a la vista, «que no haya nada emitiendo» NO tendría
    // que estar cumplida.
    expect(cumple(pr, vistaDe(p, 'ana'))).toBe(false)
  })
})

// ═══ (7) COCINAR LO QUE SE ESTÁ POR PUDRIR ══════════════════════════════════

describe('(7) lo que se pudre primero: la urgencia existe y la mente ordena al revés', () => {
  it('la ley 6 se frena en seco y no se frena en mojado: la urgencia es de la CELDA', () => {
    const correr = (wet: number): { tox: number; nutr: number; moist: number } => {
      let s: WorldState = mundo({
        hz: 20,
        bodies: [enElPiso(cuerpo('pez', 'pescado', 2, {}, 'bloque'), { x: 0, y: 0 })],
        cells: [[{ x: 0, y: 0 }, { wet, oxygen: 1, temperature: T_AMBIENTE }]],
      })
      for (let t = 0; t < 20000; t++) s = stepWorld(s, []).state
      return {
        tox: q(s, 'pez', 'toxicity'),
        nutr: q(s, 'pez', 'nutrition'),
        moist: q(s, 'pez', 'moisture'),
      }
    }
    const seco = correr(0)
    const mojado = correr(1)
    log([
      '─── EL MISMO PESCADO CRUDO, 1000 SEGUNDOS, DOS CELDAS ───',
      `  celda SECA:    tox ${d4(seco.tox)} · nutrition ${d4(seco.nutr)} · moisture ${d4(seco.moist)}`,
      `  celda MOJADA:  tox ${d4(mojado.tox)} · nutrition ${d4(mojado.nutr)} · moisture ${d4(mojado.moist)}`,
      '  la putrefacción escala con `moisture`, y la ley 11 se la saca en seco: se frena sola.',
      '  En mojado no se frena, y ahí sí hay una urgencia de verdad — que es donde está el río.',
    ])

    // En seco la putrefacción se clava; en mojado se come el pescado entero.
    expect(seco.moist).toBeCloseTo(0, 6)
    expect(mojado.tox).toBeGreaterThan(0.9)
    expect(mojado.nutr).toBeLessThan(seco.nutr / 100)
  })

  it('LA MENTE: entre lo fresco y lo que se pudre, elige lo fresco', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        enLaMano(
          cuerpo('fresco', 'pescado', 2, { digestibility: 0.85, toxicity: 0.0345, decay: 0.08 }, 'bloque'),
          { x: 0, y: 0 },
          'ana',
        ),
        enLaMano(
          cuerpo('viejo', 'pescado', 2, { digestibility: 0.85, toxicity: 0.048, decay: 0.6 }, 'bloque'),
          { x: 0, y: 0 },
          'ana',
        ),
      ],
      actors: [actor('ana', { holding: ['fresco', 'viejo'], capacity: 3 })],
    })
    const p = new Partida(w)
    const v = vistaDe(p, 'ana')
    const bocados = opportunities(v, new Creencias(), necesidades(v)).filter((o) => o.bocado !== undefined)
    log([
      '─── DOS PESCADOS COCIDOS, UNO CON decay 0,60 ───',
      `  fresco: decay ${d4(q(w, 'fresco', 'decay'))} · tox ${d4(q(w, 'fresco', 'toxicity'))} · neto ${d4(netoDe(w, 'fresco'))}`,
      `  viejo:  decay ${d4(q(w, 'viejo', 'decay'))} · tox ${d4(q(w, 'viejo', 'toxicity'))} · neto ${d4(netoDe(w, 'viejo'))}`,
      ...bocados.map((o) => `  ${d4(o.valor).padStart(10)}  ${o.id}`),
      '  `decay` no entra en ninguna cuenta de `oportunidades.ts`: el orden sale de',
      '  `neto/masa` y nada más. La criatura se come el que iba a durar y deja pudrir el otro.',
    ])

    expect(bocados).toHaveLength(2)
    // El primero es el FRESCO. Un recolector hace exactamente lo contrario.
    expect(bocados[0]?.bocado?.id).toBe('fresco')
    expect(bocados[1]?.bocado?.id).toBe('viejo')
  })

  /**
   * `decay` es una cualidad que la vista SABE contestar —`q(b,'decay')` anda— así
   * que esto no es un hueco de superficie: es que ni `mordidaDe` ni `valorDe`
   * miran cuánto le queda a un cuerpo. La reparación es de este paquete y es
   * chica; lo que no es chico es de dónde sacar la TASA (cuánto se va a pudrir de
   * acá a diez segundos), porque depende de la celda y `VistaDelPlan` sólo publica
   * `qAt` de la celda propia.
   */
  it.fails('LO QUE FALTA: que entre dos bocados iguales gane el que se está por perder', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        enLaMano(
          cuerpo('fresco', 'pescado', 2, { digestibility: 0.85, toxicity: 0.0345, decay: 0.08 }, 'bloque'),
          { x: 0, y: 0 },
          'ana',
        ),
        enLaMano(
          cuerpo('viejo', 'pescado', 2, { digestibility: 0.85, toxicity: 0.048, decay: 0.6 }, 'bloque'),
          { x: 0, y: 0 },
          'ana',
        ),
      ],
      actors: [actor('ana', { holding: ['fresco', 'viejo'], capacity: 3 })],
    })
    const v = vistaDe(new Partida(w), 'ana')
    const bocados = opportunities(v, new Creencias(), necesidades(v)).filter((o) => o.bocado !== undefined)
    expect(bocados[0]?.bocado?.id).toBe('viejo')
  })
})

// ═══ (8) EL FARDO DE CORTEZA ════════════════════════════════════════════════
//
// El mundo lo permite y lo paga: `world/tests/el-fuego-no-se-propaga.test.ts` mide
// que dos cortezas atadas son un cuerpo de 1 kg, que ese cuerpo entrega lo que
// ninguna de las dos entrega sola, y que con eso prende un leño. Es la cadena que
// desatasca el grupo (2). Acá se mide si la mente puede QUERERLO.

describe('(8) el fardo de corteza: una meta sobre masa y sobre cantidad', () => {
  it('la mitad que se escribe no la establece nadie, y la otra mitad no se escribe', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        enElPiso(cuerpo('c1', 'corteza', 0.5, {}, 'filete'), { x: 1, y: 0 }),
        enElPiso(cuerpo('c2', 'corteza', 0.5, {}, 'filete'), { x: 1, y: 1 }),
        enElPiso(cuerpo('liana', 'liana', 0.2, {}, 'hebra'), { x: 0, y: 1 }),
      ],
      actors: [actor('ana', { capacity: 3 })],
    })
    const p = new Partida(w)
    const v = vistaDe(p, 'ana')

    const filas = ['─── PEDIR UN FARDO DE 1 kg ───']
    // (a) la forma honesta: «tener en la mano algo fibroso de un kilo».
    const conTag = planDe('holding(tag:fibroso,mass>=1)', v)
    filas.push(
      `  holding(tag:fibroso,mass>=1) → ${conTag.k}` +
        (conTag.k === 'gap' ? `\n     missing «${conTag.missing}»\n     ${conTag.why}` : ''),
    )
    // (b) la forma pelada: `mass>=1`. Sale plan Y ES PEOR, porque sale vacío — el
    //     cuerpo de la propia criatura pesa 2 kg y `see()` no la excluye. El hueco
    //     lo midió la primera vuelta del ataque; se cita, no se reclama.
    const pelada = planDe('mass>=1', v)
    filas.push(
      `  mass>=1 → ${pelada.k}` + (pelada.k === 'plan' ? ` con ${String(pelada.steps.length)} pasos` : ''),
    )
    // (c) y la cantidad, que es la otra mitad del fardo.
    filas.push(`  «dos piezas de corteza» → ${interpretar('holding(tag:fibroso,count>=2)') === undefined ? 'EL INTÉRPRETE NO LO LEE' : 'parsea'}`)
    // (d) lo que la mente sabe pedir, dicho entero.
    const ops = opportunities(v, new Creencias(), necesidades(v))
    const metas = [...new Set(ops.map((o) => o.meta))]
    filas.push(`  metas que la mente sabe fabricar hoy: ${metas.length === 0 ? '(ninguna)' : metas.join(' · ')}`)
    filas.push(
      '  `union` es lo que hace crecer la masa —es extensiva, se suma— y su ÚNICO esquema',
      '  promete `catch>0`. Ningún esquema del índice establece una masa, así que la',
      '  regresión no tiene por dónde entrar.',
    )
    log(filas)

    expect(conTag.k).toBe('gap')
    if (conTag.k !== 'gap') throw new Error('imposible')
    expect(conTag.why).toContain('ningún esquema conocido establece')
    // El plan de cero pasos es la trampa: la meta se da por hecha sin hacer nada.
    expect(pelada.k).toBe('plan')
    if (pelada.k !== 'plan') throw new Error('imposible')
    expect(pelada.steps).toHaveLength(0)
    expect(interpretar('holding(tag:fibroso,count>=2)')).toBeUndefined()
    // Y ninguna oportunidad de la mente habla nunca de masa ni de cantidad.
    for (const o of ops) {
      expect(o.meta.includes('mass')).toBe(false)
      expect(o.meta.includes('count')).toBe(false)
    }
  })

  /**
   * El fardo es la pieza que cierra el grupo (2): sin él no hay fuego que cocine
   * —medido arriba, nada de lo que se enciende frotando llega a `emitsPower` 253—
   * y con él la cadena es vara → fardo → leño, sin tocar una constante.
   *
   * Y necesita las dos mitades que faltan a la vez: una meta que hable de MASA
   * (para que la regresión sepa que atar suma) y una que hable de CANTIDAD (para
   * que sepa cuántas piezas juntar). `Step.juntar` YA lleva un `cuantos`, y hoy
   * no hay ningún objetivo que lo pueda pedir.
   */
  it.fails('LO QUE FALTA: que «un cuerpo fibroso de un kilo» tenga plan', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        enElPiso(cuerpo('c1', 'corteza', 0.5, {}, 'filete'), { x: 1, y: 0 }),
        enElPiso(cuerpo('c2', 'corteza', 0.5, {}, 'filete'), { x: 1, y: 1 }),
        enElPiso(cuerpo('liana', 'liana', 0.2, {}, 'hebra'), { x: 0, y: 1 }),
      ],
      actors: [actor('ana', { capacity: 3 })],
    })
    const r = planDe('holding(tag:fibroso,mass>=1)', vistaDe(new Partida(w), 'ana'))
    expect(r.k).toBe('plan')
  })
})
