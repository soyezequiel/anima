// ─── ¿LA CRIATURA PUEDE ARMAR UNA PARRILLA? ──────────────────────────────────
//
// `world/tests/donde-se-pone-la-comida.test.ts` reordenó el problema del Hito 5:
// el `gap` del planificador —«emitsPower entre 253 y 410»— no es la ventana de
// ningún montaje, porque **la potencia se elige UNA vez (cuando se enciende) y el
// LUGAR se elige cada vez**. Con el fuego más grande que ella puede encender
// frotando (0,7132 kg → 214,39 de potencia), la misma fogata da tres respuestas:
//
//     piso 40,73 °C · parrilla 122,19 °C · contacto 272,27 °C
//
// y la fórmula concluye que sólo la del medio cae adentro de la ventana del
// pescado. AQUELLO FUE LA FÓRMULA, y los puntos 6 y 7 del resumen la corrigen en
// dos lugares. Esto es EL MUNDO: `Partida`, `stepWorld` y la innata `poner` en
// vuelo, que es la única forma de saber si el cuerpo puede cumplir lo que el plan
// pida. Se corre entero contra `stepWorld`, con el arnés de invariantes encendido.
//
// ─── CÓMO SE ARMA UNA PARRILLA, según el mundo y no según nadie ─────────────
//
// `montajeDe` (`world/src/step.ts:1495`) sale de la geometría y de ninguna tabla:
//
//   · `contacto` — el cuerpo está `supportedBy` la fuente, o la está `covering`;
//   · `parrilla` — está `supportedBy` OTRO cuerpo que está en la celda de la fuente;
//   · `piso`     — todo lo demás.
//
// O sea que armar una parrilla son DOS colocaciones y ninguna herramienta: un
// tercer cuerpo en la celda del fuego, y la comida encima. Las dos se escriben con
// la innata `poner`, que ya tiene el campo: `{ que, en, sobre?, tapando? }`.
//
// ─── EL RESUMEN, para no leer 600 líneas ────────────────────────────────────
//
//   1. SE PUEDE, Y ES BARATO. Todo en la mano, la parrilla queda armada en 3
//      ticks; con la piedra a tres celdas, en 7, y cuesta 0,50 de `stamina`. Son
//      dos llamadas a `poner` y ninguna herramienta: la parrilla no se fabrica.
//   2. El mundo NO LE PIDE NADA al que hace de parrilla: ni masa, ni rigidez, ni
//      ser sólido. Una hoja de 10 gramos con `solid = 0` sostiene 2 kg de pescado
//      y el arnés de invariantes no dice una palabra. Hueco, con su `it.fails`.
//   3. El mundo lo lee como `parrilla`: el `formFactor` despejado del pico da
//      **0,2500** contra el 0,25 de la tabla, y el de la losa da **0,6007**
//      contra el 0,6 del contacto. Los dos montajes medidos en la misma corrida,
//      sin leer ningún campo: se despejan de la temperatura que el mundo escribió.
//   4. LA PARRILLA DE MADERA NO SE PRENDE con nada que ella pueda encender —pico
//      269,21 °C contra 280 de pirólisis y 300 de ignición— y ésa es la respuesta
//      contraria a la que este tramo esperaba. Se prende recién con un fuego de
//      0,80 kg, que es 12% más grande que el techo de la fricción (y al que sí se
//      llega propagando: ver `world/tests/el-fuego-no-se-propaga.test.ts`).
//      Y CUANDO SE PRENDE, LA COMIDA NO SE ENTERABA: el mundo elegía UNA fuente y
//      la elegía POR POTENCIA, así que mientras la parrilla ardiendo fuera menos
//      potente que el fuego de abajo, la comida le seguía leyendo `parrilla` al
//      fuego. La serie de temperaturas con parrilla de piedra y con parrilla
//      ardiendo era IDÉNTICA hasta el último bit. **Ese hueco —que era el que este
//      archivo encontró y no el que buscaba— ESTÁ CERRADO**: `entornoDe` ordena las
//      fuentes por CALOR ENTREGADO (`potencia · formFactor(distancia, montaje)`),
//      que es lo que la ley 1 usa dos líneas después. Las dos series siguen siendo
//      idénticas donde la parrilla NO arde y difieren donde arde, y el `it.fails`
//      de más abajo se volvió `it`. Con la parrilla de 1 kg sobre el fuego de 1,5
//      el pescado pasó de 232,22 °C a **944,45** y termina en
//      `residuo-mineral-de-pescado`. Lo que impide que el plan lo haga es el
//      `roleHint` `ignitionPoint > 507` de la fila de la parrilla, que del catálogo
//      deja pasar sólo a la piedra: la defensa dejó de ser «el mundo no mira» y
//      pasó a ser una condición escrita.
//   5. Se cocina en **128 ticks (6,40 s)**; armar (3) + cocinar (128) son 131, o
//      sea el **3,6%** de lo que la criatura del criterio vivió antes de morirse.
//      Entra de sobra, y el bocado rinde 2,38× lo que rendiría crudo.
//
// ─── Y DOS NÚMEROS QUE CORRIGEN EL ENCUADRE CON EL QUE SE ABRIÓ EL TRAMO ────
//
//   6. **EN CONTACTO EL PESCADO NO SE QUEMA.** La tabla de la fórmula dice 272,27
//      contra 260 de ignición y sentencia «SE QUEMA»; el mundo entrega **255,71** y
//      el pescado sale cocido. La fórmula supone la potencia CONSTANTE y el fuego
//      se está comiendo a sí mismo, así que el equilibrio es un blanco que se corre
//      para abajo. Lo que el contacto sí hace es HERVIR: la ley 5 evapora con `k²`,
//      a 256 °C evapora 11,2× más rápido que a 115, y el pescado baja de 2,0000 a
//      1,0499 kg. La parrilla rinde 1,78× — no porque el contacto queme, sino
//      porque no le deja masa.
//   7. **CON EL FUEGO QUE LA CADENA ENCIENDE HOY, LA PARRILLA PIERDE.** La vara más
//      barata que prende con la yesca de la orilla es de 0,47 kg
//      (`ataque-a-la-costura.test.ts`, bloque 8). Con ésa:
//         en parrilla  la digestibilidad se clava en **0,7162** y la fogata se apaga
//                      en el tick 467. NUNCA llega a los 0,85 de «cocido».
//         en contacto  **cocido en el tick 69**, y con más calorías (12,942 contra
//                      11,054), porque a 169 °C todavía no hierve fuerte.
//      O sea que «usar la parrilla en vez del piso» NO es una regla: es una regla
//      CON EL FUEGO ADENTRO DE SU VENTANA. La parrilla divide por 2,4 lo que llega,
//      y eso es una virtud cuando sobra calor y un defecto cuando falta.
//      **La potencia y el montaje no son variables independientes**, y ése es el
//      matiz que le falta al `gap` del planificador tanto como le faltaba el montaje.
//
// De qué tiene que ser la parrilla: **de piedra**, pero no por lo que se creía.
// La madera aguanta el fuego que ella enciende; deja de aguantar en cuanto el
// fuego crece, y el modo de falla no es que la comida se queme sino que la
// parrilla se convierta en un SEGUNDO FUEGO. Cuando este archivo se escribió, el
// mundo ignoraba ese segundo fuego hasta que superaba en POTENCIA al primero —y
// entonces el pescado llegaba a 1127,68 °C y terminaba en
// `residuo-mineral-de-pescado` con `digestibility` 0—. Hoy el mundo lo ve en cuanto
// le entrega más CALOR, que es antes: no hace falta que la parrilla sea más grande
// que el fuego, le basta con estar pegada. O sea que la conclusión no cambió y se
// volvió más fuerte: la parrilla de madera es peor de lo que este archivo midió.
// La piedra no tiene ese modo de falla: `ignitionPoint` 900 es el techo de lo que no
// arde, y medida bajo el fuego más grande de este archivo se queda en 554,4 °C sin
// emitir nada. Y hay piedra: los siete biomas de `oracle/src/bioma.ts` la siembran,
// de 0,2 a 3 kg.

import { describe, expect, it } from 'vitest'
import { formFactor, H_PERDIDA, qualityOf, T_AMBIENTE } from '@anima/physics'
import type { QualityId } from '@anima/physics'
import type { Placement, WorldBody, WorldState } from '@anima/world'
import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import { done, fail } from '@anima/skills'
import { poner } from '@anima/skills/innatas'

import { Partida } from '../src/index.js'
import { conElla, cuerpo } from './mundo.js'

type Hab = Generator<Intent, Outcome, StepResult>

/**
 * El fuego más grande que se puede encender frotando: `(1000 − 2,40) / (1,7 · 288
 * / 0,35)`, o sea lo que el TANQUE DE `stamina` paga. Medido en
 * `world/tests/el-fuego.test.ts` y usado en `donde-se-pone-la-comida.test.ts`.
 * Todo este archivo se apoya en él: es la única potencia que la criatura puede
 * conseguir sin tener ya un fuego.
 */
const TECHO_DE_LA_FRICCION = 0.7132

/**
 * Y LA VARA QUE LA CADENA ENCIENDE DE VERDAD, que no es el techo.
 *
 * El barrido fino de `tests/ataque-a-la-costura.test.ts` (bloque 8) midió que la
 * vara más barata que prende con la yesca que la orilla sí deja —un junco de
 * 0,05 kg— es de **0,47 kg**, y cuesta 659,8629 de `stamina`. El techo de 0,7132
 * es lo que el TANQUE aguantaría; 0,47 es lo que la criatura hace. Las dos filas
 * están en el barrido de abajo porque contestan preguntas distintas: una es «¿la
 * parrilla de madera es segura en el peor caso?» y la otra «¿la parrilla sirve
 * con el fuego que hay?».
 */
const LA_VARA_DE_LA_CADENA = 0.47

/** Dónde está la fogata en todas las escenas. Ella arranca en (0,0), o sea al lado. */
const CELDA_DEL_FUEGO: Cell = { x: 1, y: 0 }

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

function cuerpoEn(
  id: string,
  sustancia: string,
  masa: number,
  at: Placement,
  estado: Record<string, number> = {},
): WorldBody {
  return { body: cuerpo(id, sustancia, masa, estado), at }
}

/** Un fuego prendido: `temperature` arriba de los 300 de la madera, y el mundo hace el resto. */
function fogata(masa: number): WorldBody {
  return cuerpoEn('fuego', 'madera', masa, CELDA_DEL_FUEGO, { temperature: 700 })
}

function q(w: WorldState, id: string, k: QualityId): number {
  const c = w.bodies.get(id)
  if (c === undefined) return Number.NaN
  return qualityOf(c.body, k, w.phys)
}

function sustanciaDe(w: WorldState, id: string): string {
  return w.bodies.get(id)?.body.parts[0]?.substance ?? '(no existe)'
}

/**
 * Buscar un cuerpo por id desde ADENTRO de la habilidad: primero en la mano,
 * después a la vista.
 *
 * No es trampa aunque lo parezca: `BodyView` no se puede construir desde afuera
 * —la proyección es la única que lo arma— así que toda habilidad que quiera
 * hablar de un cuerpo concreto tiene que encontrarlo con `see` o con
 * `self.holding`. Lo que este arnés se saltea es la ELECCIÓN («¿cuál de estas
 * piedras?»), que es trabajo de la mente y no de este archivo: acá se mide si el
 * CUERPO puede, no si la mente elige bien.
 */
function vistaDe(ctx: Ctx, id: string): BodyView | undefined {
  const enMano = ctx.self.holding.find((b) => b.id === id)
  if (enMano !== undefined) return enMano
  return ctx.see([{ q: 'mass', op: '>', v: 0 }]).find((b) => b.id === id)
}

/** Una colocación del plan: qué cuerpo, en qué celda, apoyado sobre qué. */
interface Colocacion {
  readonly que: string
  readonly en: Cell
  readonly sobre?: string
}

interface Armado {
  readonly p: Partida
  readonly outcome: Outcome | undefined
  /** Los motivos con los que el mundo rechazó alguna intención. Vacío es lo normal. */
  readonly rechazos: readonly string[]
  readonly ticks: number
}

/**
 * Corre las colocaciones con la innata `poner` de verdad, en vuelo, contra
 * `stepWorld`. `vigilar: true` porque acá los cuerpos son cinco y el arnés de
 * invariantes es gratis: un montaje ilegal que el mundo aceptara tiene que
 * aparecer como violación y no como una temperatura rara doscientos ticks después.
 */
function armar(w: WorldState, plan: readonly Colocacion[], tope = 200): Armado {
  const p = new Partida(w, { vigilar: true })
  const rechazos: string[] = []
  const v = p.volar(
    'ella',
    function* (ctx: Ctx): Hab {
      for (const paso of plan) {
        const que = vistaDe(ctx, paso.que)
        if (que === undefined) return fail(`no encuentro ${paso.que}`)
        if (paso.sobre === undefined) {
          const r = yield* poner(ctx, { que, en: paso.en })
          if (!r.ok) return r
          continue
        }
        const sobre = vistaDe(ctx, paso.sobre)
        if (sobre === undefined) return fail(`no encuentro ${paso.sobre}`)
        const r = yield* poner(ctx, { que, en: paso.en, sobre })
        if (!r.ok) return r
      }
      return done()
    },
    undefined,
  )
  let n = 0
  while (!v.terminado && n < tope) {
    for (const e of p.tick()) if (e.k === 'rechazada') rechazos.push(e.por ?? '(sin motivo)')
    n++
  }
  return { p, outcome: v.outcome, rechazos, ticks: n }
}

/** Lo que se mira mientras el fuego arde. Todo sale del mundo, nada de la fórmula. */
interface Seguimiento {
  readonly picoComida: number
  readonly tickDelPico: number
  /**
   * EL `formFactor` DESPEJADO DEL PICO, y es la medición que decide el montaje.
   *
   * En el pico la derivada es cero, y la ley 1 dice `dT/dt = λ · (T_eq − T)`, así
   * que **en el pico `T` ES `T_eq` exactamente**. Despejando la ley 1 en régimen,
   * `formFactor = (T − ambiente) · H / P`. O sea que este número no se compara
   * contra una tabla copiada: sale de la temperatura que el mundo escribió y de la
   * potencia que el mundo tenía en ese mismo tick, y si alguien recalibra
   * `EXPOSICION` o `H_PERDIDA`, esto se entera solo.
   */
  readonly formFactorDespejado: number
  readonly picoParrilla: number
  readonly potenciaMaximaDeLaParrilla: number
  /** El primer tick en que la comida cumple lo que `@anima/plan` llama «cocido». */
  readonly tickCocido: number
  readonly caloriasAlCocinarse: number
  readonly masaAlCocinarse: number
  readonly sustanciaFinal: string
  readonly digestibilidadFinal: number
  /** La serie entera, para comparar dos corridas tick a tick. */
  readonly serie: readonly number[]
}

/** `digestibility ≥ 0,85` y `toxicity ≤ 0,05`: los dos números de `plan/src/esquemas.ts`. */
const DIGESTIBILIDAD_DE_COCIDO = 0.85
const TOXICIDAD_DE_COCIDO = 0.05

function seguir(p: Partida, ticks: number, comida = 'pez', parrilla = 'rejilla'): Seguimiento {
  let picoComida = Number.NEGATIVE_INFINITY
  let tickDelPico = -1
  let formFactorDespejado = Number.NaN
  let picoParrilla = Number.NEGATIVE_INFINITY
  let potenciaMaximaDeLaParrilla = 0
  let tickCocido = -1
  let caloriasAlCocinarse = Number.NaN
  let masaAlCocinarse = Number.NaN
  const serie: number[] = []
  for (let k = 0; k < ticks; k++) {
    p.tick()
    const t = q(p.state, comida, 'temperature')
    serie.push(t)
    if (t > picoComida) {
      picoComida = t
      tickDelPico = k
      formFactorDespejado = ((t - T_AMBIENTE) * H_PERDIDA) / q(p.state, 'fuego', 'emitsPower')
    }
    const tp = q(p.state, parrilla, 'temperature')
    if (!Number.isNaN(tp) && tp > picoParrilla) picoParrilla = tp
    const pp = q(p.state, parrilla, 'emitsPower')
    if (!Number.isNaN(pp) && pp > potenciaMaximaDeLaParrilla) potenciaMaximaDeLaParrilla = pp
    if (
      tickCocido < 0 &&
      q(p.state, comida, 'digestibility') >= DIGESTIBILIDAD_DE_COCIDO &&
      q(p.state, comida, 'toxicity') <= TOXICIDAD_DE_COCIDO
    ) {
      tickCocido = k
      caloriasAlCocinarse = q(p.state, comida, 'calories')
      masaAlCocinarse = q(p.state, comida, 'mass')
    }
  }
  return {
    picoComida,
    tickDelPico,
    formFactorDespejado,
    picoParrilla,
    potenciaMaximaDeLaParrilla,
    tickCocido,
    caloriasAlCocinarse,
    masaAlCocinarse,
    sustanciaFinal: sustanciaDe(p.state, comida),
    digestibilidadFinal: q(p.state, comida, 'digestibility'),
    serie,
  }
}

/** La escena completa: fogata, algo que haga de parrilla, y un pescado de 2 kg. */
function escena(o: {
  masaFuego: number
  parrilla?: { readonly sustancia: string; readonly masa: number }
  comidaVa: 'sobre-la-parrilla' | 'sobre-el-fuego' | 'en-la-celda-de-al-lado'
}): Armado {
  const cuerpos: WorldBody[] = [fogata(o.masaFuego)]
  const mano: string[] = []
  if (o.parrilla !== undefined) {
    cuerpos.push(cuerpoEn('rejilla', o.parrilla.sustancia, o.parrilla.masa, { x: 0, y: 0 }))
    mano.push('rejilla')
  }
  cuerpos.push(cuerpoEn('pez', 'pescado', 2, { x: 0, y: 0 }, { temperature: T_AMBIENTE }))
  mano.push('pez')
  // `stamina: 1000` y no más: es el TECHO del catálogo (`quality.ts`, rango
  // [0, 1000]) y ponerle 5000 «para que no se muera» hace que `revisarEstado`
  // acuse `rango` en el tick 0. Costó una violación fantasma antes de verlo.
  const w = conElla(cuerpos, { holding: mano, stamina: 1000 })
  const plan: Colocacion[] = []
  if (o.parrilla !== undefined) plan.push({ que: 'rejilla', en: CELDA_DEL_FUEGO, sobre: 'fuego' })
  if (o.comidaVa === 'sobre-la-parrilla') plan.push({ que: 'pez', en: CELDA_DEL_FUEGO, sobre: 'rejilla' })
  else if (o.comidaVa === 'sobre-el-fuego') plan.push({ que: 'pez', en: CELDA_DEL_FUEGO, sobre: 'fuego' })
  else plan.push({ que: 'pez', en: { x: 2, y: 0 } })
  return armar(w, plan)
}

// ═════════════════════════════════════════════════════════════════════════════

describe('(1) la celda del fuego está ocupada, y ése es el primer portón', () => {
  it('sin `sobre`, el mundo rechaza con `celda-ocupada` y la innata lo dice en castellano', () => {
    const w = conElla(
      [fogata(TECHO_DE_LA_FRICCION), cuerpoEn('rejilla', 'piedra', 1, { x: 0, y: 0 })],
      { holding: ['rejilla'], stamina: 1000 },
    )
    const r = armar(w, [{ que: 'rejilla', en: CELDA_DEL_FUEGO }])

    log([
      '─── PONER ALGO EN LA CELDA DEL FUEGO, SIN APOYARLO ───',
      `  outcome  ${JSON.stringify(r.outcome)}`,
      `  rechazos ${JSON.stringify(r.rechazos)}`,
      '',
      '  Es `estorbo()` (world/src/step.ts:1613): dos sólidos no comparten celda, y la',
      '  fogata es un sólido —`rigidity` 0,7 de la madera, muy arriba del 0,05 que hace',
      '  falta—. La innata lo traduce a «ahí no entra: hay algo sólido».',
    ])

    const o = r.outcome
    expect(o?.ok).toBe(false)
    expect(o !== undefined && !o.ok ? o.why : '').toBe('ahí no entra: hay algo sólido')
    expect(r.rechazos).toContain('celda-ocupada')
  })

  it('con `sobre: fuego` entra, y el mundo lo guarda como `supportedBy`', () => {
    const w = conElla(
      [fogata(TECHO_DE_LA_FRICCION), cuerpoEn('rejilla', 'piedra', 1, { x: 0, y: 0 })],
      { holding: ['rejilla'], stamina: 1000 },
    )
    const r = armar(w, [{ que: 'rejilla', en: CELDA_DEL_FUEGO, sobre: 'fuego' }])
    const c = r.p.state.bodies.get('rejilla')

    log([
      '─── LA MISMA COLOCACIÓN, CON `sobre` ───',
      `  outcome    ${JSON.stringify(r.outcome)}`,
      `  rejilla    at ${JSON.stringify(c?.at)} · supportedBy ${String(c?.supportedBy)}`,
      `  ticks      ${String(r.ticks)}`,
      `  violaciones ${String(r.p.violaciones.length)}`,
      '',
      '  El hueco 1 de `CONTRATO_PONER` dice «apilar la parrilla sobre el fuego es la',
      '  técnica emblema del proyecto y depende de una lectura que no existe» —la de si',
      '  la celda está libre—. MEDIDO: no hace falta esa lectura. Lo que hay que saber es',
      '  que ahí HAY un fuego, y eso `see([{ q: emitsPower, op: >, v: 0 }])` lo contesta.',
      '  El hueco es real para «dejar algo en una celda cualquiera» y NO bloquea la parrilla.',
    ])

    expect(r.outcome?.ok).toBe(true)
    expect(c?.supportedBy).toBe('fuego')
    expect(c?.at).toEqual(CELDA_DEL_FUEGO)
    expect(r.p.violaciones).toEqual([])
  })

  it('y por eso en la celda del fuego NO hay tres montajes: hay dos', () => {
    // Apoyar o tapar es la única forma de compartir celda con un sólido
    // (`intencionPoner`, world/src/step.ts:1953), y las dos dan `contacto` o
    // `parrilla`. La fila `piso` de la tabla de `donde-se-pone-la-comida` es
    // INALCANZABLE a distancia 0, y no sólo para un sólido: `estorbo` mira si hay
    // algo sólido EN la celda, no si lo es el que llega. Se mide con la hoja, que
    // con `rigidity` 0,03 ni siquiera es sólida, y el mundo la rebota igual.
    const conLaHoja = armar(
      conElla([fogata(TECHO_DE_LA_FRICCION), cuerpoEn('hojita', 'hoja', 0.01, { x: 0, y: 0 })], {
        holding: ['hojita'],
        stamina: 1000,
      }),
      [{ que: 'hojita', en: CELDA_DEL_FUEGO }],
    )

    // Y lo más parecido al piso que queda es la celda de al lado, donde el
    // `(1 + d²)` de `formFactor` vuelve a dividir por dos.
    const r = escena({ masaFuego: TECHO_DE_LA_FRICCION, comidaVa: 'en-la-celda-de-al-lado' })
    const s = seguir(r.p, 600)

    log([
      '─── LO QUE DE VERDAD ES «EL PISO» ───',
      `  una hoja de 10 g con solid = 0, sin apoyar, en la celda del fuego: ${JSON.stringify(conLaHoja.outcome)}`,
      `  rechazos: ${JSON.stringify(conLaHoja.rechazos)}`,
      '',
      `  el pescado en la celda de al lado llega a ${s.picoComida.toFixed(2)} °C`,
      `  la fila «piso» de la tabla decía 40,73, pero es a distancia 0 y ahí no entra nada`,
      `  el formFactor despejado da ${s.formFactorDespejado.toFixed(4)} contra ${formFactor(1, 'piso').toFixed(4)} de piso a d=1`,
      `  digestibilidad después de 600 ticks: ${s.digestibilidadFinal.toFixed(4)} (arrancó en 0,3800)`,
      '',
      '  O sea que la alternativa real a la parrilla no es 40,73 sino 27, y ni siquiera',
      '  llega a los 55 con los que el pescado empieza a cocinarse. No cocina NUNCA.',
    ])

    expect(conLaHoja.outcome?.ok).toBe(false)
    expect(conLaHoja.rechazos).toContain('celda-ocupada')
    expect(r.outcome?.ok).toBe(true)
    expect(s.formFactorDespejado).toBeCloseTo(formFactor(1, 'piso'), 3)
    // No se movió ni un punto: sigue crudo.
    expect(s.digestibilidadFinal).toBeCloseTo(0.38, 6)
  })
})

describe('(2) qué le pide el mundo al que hace de parrilla', () => {
  it('NADA: ni masa, ni rigidez, ni ser sólido', () => {
    // El fuego va APAGADO a propósito: acá se aísla la pregunta geométrica de la
    // térmica. Lo único que `intencionPoner` verifica de `onTopOf` es que el cuerpo
    // exista y esté en la misma celda (`world/src/step.ts:1945`). Nada más.
    const w = conElla(
      [
        cuerpoEn('leno', 'madera', 1, CELDA_DEL_FUEGO),
        cuerpoEn('hojita', 'hoja', 0.01, { x: 0, y: 0 }),
        cuerpoEn('pez', 'pescado', 2, { x: 0, y: 0 }, { temperature: T_AMBIENTE }),
      ],
      { holding: ['hojita', 'pez'], stamina: 1000 },
    )
    const r = armar(w, [
      { que: 'hojita', en: CELDA_DEL_FUEGO, sobre: 'leno' },
      { que: 'pez', en: CELDA_DEL_FUEGO, sobre: 'hojita' },
    ])
    const pez = r.p.state.bodies.get('pez')

    log([
      '─── LO QUE EL MUNDO LE PIDE AL QUE HACE DE PARRILLA ───',
      `  outcome            ${JSON.stringify(r.outcome)}`,
      `  masa de la hojita  ${q(r.p.state, 'hojita', 'mass').toFixed(4)} kg`,
      `  ¿es sólida?        solid = ${q(r.p.state, 'hojita', 'solid').toFixed(0)}  (rigidity 0,03 < 0,05)`,
      `  masa del pescado   ${q(r.p.state, 'pez', 'mass').toFixed(4)} kg  → ${(q(r.p.state, 'pez', 'mass') / q(r.p.state, 'hojita', 'mass')).toFixed(0)}× la de su apoyo`,
      `  pez.supportedBy    ${String(pez?.supportedBy)}`,
      `  violaciones        ${String(r.p.violaciones.length)}`,
      '',
      '  Es una buena noticia para la parrilla —cualquier cosa sirve, que es justo lo que',
      '  `montajeDe` promete— y una mala para la ley 8, que dice «sostiene peso».',
    ])

    expect(r.outcome?.ok).toBe(true)
    expect(pez?.supportedBy).toBe('hojita')
    expect(q(r.p.state, 'hojita', 'solid')).toBe(0)
    expect(r.p.violaciones).toEqual([])
  })

  it.fails('SIGUE ABIERTO — 10 gramos de hoja no sólida sostienen 2 kg de pescado y nadie se queja', () => {
    // POR QUÉ SIGUE ABIERTO: `onTopOf` es la ley 8 —«sostiene peso», dicho en
    // `skills/src/ctx.ts:125` y en el ADR II-0002— y en el mundo no hay ninguna
    // línea que compare peso con nada. `intencionPoner` verifica dos cosas del
    // apoyo: que exista y que esté en la celda destino. Ni `mass`, ni `rigidity`,
    // ni `solid`, ni `footing` —que además es cualidad de CUERPO y no de celda, que
    // es el hueco 3 de `CONTRATO_PONER`—.
    //
    // MEDIDO ARRIBA: 0,0100 kg de hoja con `solid = 0` sosteniendo 2,0000 kg de
    // pescado, 200× su masa, y `revisarEstado` devuelve la lista vacía.
    //
    // POR QUÉ NO SE ARREGLA ACÁ Y POR QUÉ IGUAL HAY QUE DECIRLO: cerrarlo es tocar
    // `world/src/step.ts`, que este tramo tiene prohibido. Y hay que decirlo porque
    // el día que se cierre, LA PARRILLA ES LO PRIMERO QUE SE ROMPE: si el apoyo
    // tuviera que aguantar el peso, la piedra de 0,2 kg que el bioma más pobre
    // siembra dejaría de servir para un pescado de 2 kg, y la conclusión de este
    // archivo («de piedra») pasaría a ser «de piedra Y de tanto tamaño». O sea que
    // el número que hoy no existe es una precondición futura del plan.
    const w = conElla(
      [
        cuerpoEn('leno', 'madera', 1, CELDA_DEL_FUEGO),
        cuerpoEn('hojita', 'hoja', 0.01, { x: 0, y: 0 }),
        cuerpoEn('pez', 'pescado', 2, { x: 0, y: 0 }, { temperature: T_AMBIENTE }),
      ],
      { holding: ['hojita', 'pez'], stamina: 1000 },
    )
    const r = armar(w, [
      { que: 'hojita', en: CELDA_DEL_FUEGO, sobre: 'leno' },
      { que: 'pez', en: CELDA_DEL_FUEGO, sobre: 'hojita' },
    ])
    // LO QUE DEBERÍA PASAR: el mundo rechaza apoyar 2 kg sobre 10 gramos.
    expect(r.outcome?.ok).toBe(false)
  })
})

describe('(3) el mundo lo lee como `parrilla`, y se mide despejando la ley 1', () => {
  it('LA TABLA, contra el mundo y no contra la fórmula', () => {
    const conParrilla = escena({
      masaFuego: TECHO_DE_LA_FRICCION,
      parrilla: { sustancia: 'piedra', masa: 1 },
      comidaVa: 'sobre-la-parrilla',
    })
    const sParrilla = seguir(conParrilla.p, 600)

    const enContacto = escena({ masaFuego: TECHO_DE_LA_FRICCION, comidaVa: 'sobre-el-fuego' })
    const sContacto = seguir(enContacto.p, 600)

    const alLado = escena({ masaFuego: TECHO_DE_LA_FRICCION, comidaVa: 'en-la-celda-de-al-lado' })
    const sAlLado = seguir(alLado.p, 600)

    // `k = (T − denaturesAt) / 100`, y la evaporación de la ley 5 va con `k²`. Esta
    // es la razón entre los dos `k`, y se eleva al cuadrado abajo POR MULTIPLICACIÓN:
    // el operador de potencia está prohibido en `src/` y no se lo usa acá tampoco,
    // para que copiar una línea de un test a un fuente no meta la prohibición.
    const razonDeEvaporacion = (sContacto.picoComida - 55) / (sParrilla.picoComida - 55)

    log([
      '─── LOS TRES LUGARES, MEDIDOS EN EL MUNDO ───',
      `  fogata de ${TECHO_DE_LA_FRICCION.toFixed(4)} kg · pescado de 2 kg · 600 ticks (30 s)`,
      '',
      '  dónde                  │ pico °C │ formFactor despejado │ el de la tabla │ dig  │ sustancia final',
      '  ───────────────────────┼─────────┼──────────────────────┼────────────────┼──────┼────────────────',
      `  sobre la parrilla      │ ${sParrilla.picoComida.toFixed(2).padStart(7)} │ ${sParrilla.formFactorDespejado.toFixed(4).padStart(20)} │ ${formFactor(0, 'parrilla').toFixed(4).padStart(14)} │ ${sParrilla.digestibilidadFinal.toFixed(2)} │ ${sParrilla.sustanciaFinal}`,
      `  sobre el fuego mismo   │ ${sContacto.picoComida.toFixed(2).padStart(7)} │ ${sContacto.formFactorDespejado.toFixed(4).padStart(20)} │ ${formFactor(0, 'contacto').toFixed(4).padStart(14)} │ ${sContacto.digestibilidadFinal.toFixed(2)} │ ${sContacto.sustanciaFinal}`,
      `  en la celda de al lado │ ${sAlLado.picoComida.toFixed(2).padStart(7)} │ ${sAlLado.formFactorDespejado.toFixed(4).padStart(20)} │ ${formFactor(1, 'piso').toFixed(4).padStart(14)} │ ${sAlLado.digestibilidadFinal.toFixed(2)} │ ${sAlLado.sustanciaFinal}`,
      '',
      '  El montaje NO se lee de ningún campo: se despeja de la temperatura que el mundo',
      '  escribió. En el pico la derivada es cero y la ley 1 dice T = T_eq, así que',
      '  `(T − ambiente) · H / P` ES el formFactor. Da 0,2500 y 0,6007. El mundo leyó',
      '  `parrilla` y `contacto`, y nadie se lo preguntó.',
      '',
      '─── Y LA SORPRESA, QUE CORRIGE LA TABLA DE `donde-se-pone-la-comida` ───',
      '',
      `  esa tabla dice que en CONTACTO el pescado «SE QUEMA» (272,27 ≥ 260 de ignición).`,
      `  El mundo dice ${sContacto.picoComida.toFixed(2)}: NO se quema, se queda ${(260 - sContacto.picoComida).toFixed(2)} °C abajo.`,
      '  La fórmula supone la potencia CONSTANTE y el fuego se está comiendo a sí mismo:',
      '  el equilibrio es un blanco que se corre para abajo y la comida nunca lo alcanza.',
      '',
      '  Pero el contacto igual es peor, y por otro lado. La ley 5 evapora con el CUADRADO',
      `  de k = (T − 55)/100, o sea que a ${sContacto.picoComida.toFixed(0)} °C evapora ${(razonDeEvaporacion * razonDeEvaporacion).toFixed(1)}× más rápido que a ${sParrilla.picoComida.toFixed(0)}:`,
      `     en la parrilla el pescado queda en ${q(conParrilla.p.state, 'pez', 'mass').toFixed(4)} kg y ${q(conParrilla.p.state, 'pez', 'calories').toFixed(3)} calorías`,
      `     en contacto      queda en ${q(enContacto.p.state, 'pez', 'mass').toFixed(4)} kg y ${q(enContacto.p.state, 'pez', 'calories').toFixed(3)} calorías`,
      `  o sea que la parrilla rinde ${(q(conParrilla.p.state, 'pez', 'calories') / q(enContacto.p.state, 'pez', 'calories')).toFixed(2)}× — no porque el contacto queme, sino porque HIERVE.`,
    ])

    // Los dos montajes, despejados. Es LO que este archivo tenía que contestar.
    expect(sParrilla.formFactorDespejado).toBeCloseTo(formFactor(0, 'parrilla'), 3)
    expect(sContacto.formFactorDespejado).toBeCloseTo(formFactor(0, 'contacto'), 2)
    expect(sAlLado.formFactorDespejado).toBeCloseTo(formFactor(1, 'piso'), 3)

    // Y el veredicto: la parrilla cocina, el contacto también pero cuesta la mitad
    // del pescado, y la celda de al lado no hace nada.
    expect(sParrilla.tickCocido).toBeGreaterThan(0)
    expect(sAlLado.tickCocido).toBe(-1)
    expect(q(conParrilla.p.state, 'pez', 'calories')).toBeGreaterThan(
      q(enContacto.p.state, 'pez', 'calories'),
    )
  })
})

describe('(4) qué pasa si el que hace de parrilla se quema', () => {
  it('EL BARRIDO: con nada que ella pueda encender, la parrilla de madera NO se prende', () => {
    const filas: string[] = [
      '─── MASA DEL FUEGO × MATERIAL DE LA PARRILLA ───',
      '  parrilla de 0,5 kg · pescado de 2 kg · 600 ticks',
      '',
      '  fuego kg │ P fuego │ material │ pico parrilla │ ¿ardió? │ pico pez │ dig  │ cocido │ sustancia del pez',
      '  ─────────┼─────────┼──────────┼───────────────┼─────────┼──────────┼──────┼────────┼──────────────────',
    ]
    const ardio = new Map<string, boolean>()
    const picoDeLaParrilla = new Map<string, number>()
    const serieDelPez = new Map<string, readonly number[]>()
    const cocido = new Map<string, number>()
    for (const masaFuego of [LA_VARA_DE_LA_CADENA, TECHO_DE_LA_FRICCION, 0.75, 0.79, 0.8, 0.9, 1.2, 1.5]) {
      for (const sustancia of ['madera', 'piedra'] as const) {
        const r = escena({ masaFuego, parrilla: { sustancia, masa: 0.5 }, comidaVa: 'sobre-la-parrilla' })
        // La potencia se LEE del mundo recién armado y no se calcula con
        // `18 · masa · 16,7`: esos dos números son el `fuelEnergy` de la madera y
        // `EMISSION_PER_FUEL`, y copiarlos acá haría que este archivo siga dando la
        // misma tabla el día que alguien recalibre la emisión.
        const potenciaDelFuego = q(r.p.state, 'fuego', 'emitsPower')
        const s = seguir(r.p, 600)
        const clave = `${masaFuego.toFixed(4)}·${sustancia}`
        ardio.set(clave, s.potenciaMaximaDeLaParrilla > 0)
        picoDeLaParrilla.set(clave, s.picoParrilla)
        serieDelPez.set(clave, s.serie)
        cocido.set(clave, s.tickCocido)
        filas.push(
          `  ${masaFuego.toFixed(4).padStart(8)} │ ${potenciaDelFuego.toFixed(1).padStart(7)} │ ${sustancia.padEnd(8)} │ ${s.picoParrilla.toFixed(1).padStart(13)} │ ${(s.potenciaMaximaDeLaParrilla > 0 ? 'SÍ' : 'no').padStart(7)} │ ${s.picoComida.toFixed(1).padStart(8)} │ ${s.digestibilidadFinal.toFixed(2)} │ ${String(s.tickCocido).padStart(6)} │ ${s.sustanciaFinal}`,
        )
      }
    }
    filas.push(
      '',
      '  LA MADERA AGUANTA lo que ella puede encender. Con el techo de la fricción la vara',
      `  pica en ${(picoDeLaParrilla.get(`${TECHO_DE_LA_FRICCION.toFixed(4)}·madera`) ?? 0).toFixed(2)} °C: abajo de los 280 de pirólisis y de los 300 de ignición.`,
      '  Se prende recién con un fuego de 0,80 kg, que es 12% más grande que el techo.',
      '',
      '  Y LA COLUMNA DEL PEZ SE PARTIÓ EN DOS, que es lo que este tramo cambió. Acá decía',
      '  «es la misma en las dos filas, arda o no arda la parrilla», y era cierto porque',
      '  `entornoDe` elegía la fuente por POTENCIA: la parrilla ardiendo de 0,5 kg emite',
      '  150,3 y el fuego de 0,8 kg emite 239,7, así que ganaba el fuego y la comida no se',
      '  enteraba de que estaba sentada arriba de una llama. Hoy se elige por CALOR',
      '  ENTREGADO (`potencia · formFactor`) y la cuenta se da vuelta:',
      '',
      '     la parrilla, en `contacto`  150,3 × 0,60 = 90,18   ← gana',
      '     el fuego, en `parrilla`     239,7 × 0,25 = 59,93',
      '',
      '  Donde la parrilla NO arde las dos filas siguen idénticas bit a bit; donde arde, el',
      '  pescado siente la llama que tiene debajo y se cocina antes (66 ticks contra 105).',
      '  Con 0,5 kg de parrilla no llega a quemarlo —181 °C contra sus 260 de ignición— y',
      '  ése es un accidente del tamaño: con 1,5 kg de parrilla sí lo destruye, y eso lo',
      '  mide el bloque «LA PARRILLA QUE SE COMIÓ LA CENA» de más abajo.',
    )
    log(filas)

    // Lo que ella puede encender NO prende una parrilla de madera.
    expect(ardio.get(`${TECHO_DE_LA_FRICCION.toFixed(4)}·madera`)).toBe(false)
    expect(picoDeLaParrilla.get(`${TECHO_DE_LA_FRICCION.toFixed(4)}·madera`)).toBeLessThan(280)
    // El umbral está entre 0,79 y 0,80 kg de fuego: la fórmula lo pone en 0,78989
    // —`(300 − 15) / 1,2 = 237,5` de potencia— y el mundo lo corre para arriba por
    // lo mismo de siempre: el fuego se apaga mientras calienta.
    expect(ardio.get('0.7900·madera')).toBe(false)
    expect(ardio.get('0.8000·madera')).toBe(true)
    // La piedra no arde con ninguno. `ignitionPoint` 900 es el techo de lo que no arde.
    for (const m of [LA_VARA_DE_LA_CADENA, TECHO_DE_LA_FRICCION, 0.75, 0.79, 0.8, 0.9, 1.2, 1.5]) {
      expect(ardio.get(`${m.toFixed(4)}·piedra`)).toBe(false)
    }
    // Con la vara que la cadena enciende de verdad —0,47 kg— la parrilla tampoco
    // arde, ni de madera. Lo que NO pasa con esa vara es que el pescado llegue a
    // «cocido»: se queda en `digestibility` 0,72 y el `tickCocido` sale −1. Eso
    // tiene su medición aparte, abajo.
    expect(ardio.get(`${LA_VARA_DE_LA_CADENA.toFixed(4)}·madera`)).toBe(false)
    expect(cocido.get(`${LA_VARA_DE_LA_CADENA.toFixed(4)}·piedra`)).toBe(-1)
    // ─── Y LA AFIRMACIÓN GRUESA, DADA VUELTA Y PARTIDA EN DOS ────────────────
    //
    // Acá se afirmaba que las dos series eran iguales BIT A BIT también donde la
    // parrilla ardía, y era la medición del bug: el mundo no miraba la llama que la
    // comida tenía apoyada debajo. Con la fuente elegida por calor entregado hay dos
    // regímenes y los dos se afirman, porque el que no cambió es la mitad de la
    // prueba de que el que cambió cambió por lo que se cree:
    //
    //   · donde la parrilla NO arde, sigue siendo idéntico bit a bit — la parrilla de
    //     piedra y la de madera fría son el mismo cuerpo para la ley 1, y si esto se
    //     rompiera el arreglo estaría tocando algo más que la elección de fuente;
    //   · donde SÍ arde, difiere, y difiere PARA ARRIBA: el pescado siente la llama.
    for (const m of [LA_VARA_DE_LA_CADENA, TECHO_DE_LA_FRICCION, 0.75, 0.79]) {
      expect(ardio.get(`${m.toFixed(4)}·madera`)).toBe(false)
      expect(serieDelPez.get(`${m.toFixed(4)}·madera`)).toEqual(serieDelPez.get(`${m.toFixed(4)}·piedra`))
    }
    for (const m of [0.8, 0.9]) {
      expect(ardio.get(`${m.toFixed(4)}·madera`)).toBe(true)
      expect(serieDelPez.get(`${m.toFixed(4)}·madera`)).not.toEqual(serieDelPez.get(`${m.toFixed(4)}·piedra`))
      // Y el signo: con la parrilla ardiendo el pescado se cocina ANTES.
      const conMadera = cocido.get(`${m.toFixed(4)}·madera`) ?? -1
      const conPiedra = cocido.get(`${m.toFixed(4)}·piedra`) ?? -1
      expect(conMadera).toBeGreaterThan(0)
      expect(conMadera).toBeLessThan(conPiedra)
    }
  })

  it('CERRADO — la comida apoyada sobre un leño ARDIENDO ahora SÍ siente el leño', () => {
    // ─── ESTE HUECO ERA UN `it.fails` Y SE CERRÓ ────────────────────────────
    //
    // Lo que decía, y era exacto: `entornoDe` (`world/src/step.ts`) elige UNA fuente
    // —porque `Entorno` de la física acepta una sola— y la elegía por POTENCIA. El
    // montaje no entraba en la comparación, y el montaje vale un factor 2,4 entre
    // `parrilla` y `contacto`: o sea que una fuente CHICA sobre la que la comida está
    // APOYADA puede entregar mucho más calor que una GRANDE de abajo, y el mundo se
    // quedaba con la grande.
    //
    // LA ESCENA MEDIDA: fuego de 1,5 kg (P 450,9) con una parrilla de madera de
    // 1,0 kg que se prende (P 300,6). El pescado está `supportedBy` la parrilla.
    //
    //   por potencia   → ganaba el fuego, montaje `parrilla` → 15 + 450,9 · 0,5 = 240,45
    //   por calor      → gana la parrilla, montaje `contacto` → 15 + 300,6 · 1,2 = 375,72
    //
    // ANTES el mundo entregaba 232,22 de pico, o sea la primera: el pescado estaba
    // sentado arriba de un leño en llamas y terminaba cocido a punto
    // (`digestibility` 0,950), cuando a 375 °C tendría que estar 115 °C por encima de
    // su `ignitionPoint`. AHORA `entornoDe` ordena por `potencia · formFactor` y el
    // pescado siente el leño.
    //
    // Y LA PREDICCIÓN QUE ESTE HUECO DEJÓ ESCRITA SE CUMPLIÓ, palabra por palabra:
    // «si esto se cierra, la parrilla de madera pasa a destruir la comida en todo el
    // rango en que arde, y de piedra deja de ser una recomendación para ser la única
    // opción». Es exactamente lo que pasa, y lo que hace que el plan no se coma la
    // cena es el `roleHint` `ignitionPoint > 507` de la fila de la parrilla, que del
    // catálogo deja pasar sólo a la piedra. La defensa dejó de ser «el mundo no
    // mira» —que era suerte— y pasó a ser «el plan no lo liga», que es una condición
    // escrita y verificable.
    const r = escena({
      masaFuego: 1.5,
      parrilla: { sustancia: 'madera', masa: 1 },
      comidaVa: 'sobre-la-parrilla',
    })
    const potenciaDelFuego = q(r.p.state, 'fuego', 'emitsPower')
    const s = seguir(r.p, 600)
    const equilibrio = (potencia: number, m: 'parrilla' | 'contacto'): number =>
      T_AMBIENTE + (potencia * formFactor(0, m)) / H_PERDIDA
    log([
      '─── LA DIVERGENCIA, YA RESUELTA ───',
      `  pico del pescado, medido       ${s.picoComida.toFixed(2)} °C`,
      `  lo que daba elegir por potencia ${equilibrio(potenciaDelFuego, 'parrilla').toFixed(2)} °C (fuego ${potenciaDelFuego.toFixed(1)}, montaje parrilla)`,
      `  lo que da elegir por calor     ${equilibrio(s.potenciaMaximaDeLaParrilla, 'contacto').toFixed(2)} °C (parrilla ${s.potenciaMaximaDeLaParrilla.toFixed(1)}, montaje contacto)`,
      `  la parrilla ardiendo llegó a   ${s.picoParrilla.toFixed(2)} °C`,
      `  y el pescado terminó en        ${s.sustanciaFinal}, dig ${s.digestibilidadFinal.toFixed(3)}`,
      '',
      '  ANTES esta línea medía 232,22 y este test era un `it.fails`.',
    ])
    // LO QUE PASA AHORA: la comida siente la fuente que más la calienta. El 300 es la
    // frontera entre las dos elecciones —por potencia daba 240, por calor da 375— así
    // que no hay forma de cumplir esta línea con el criterio viejo.
    expect(s.picoComida).toBeGreaterThan(300)
    // Y la consecuencia, que es la que le importa al plan: arriba de sus 260 °C de
    // ignición el pescado se prende, y lo que queda no es comida.
    expect(s.picoComida).toBeGreaterThan(260)
    expect(s.sustanciaFinal.startsWith('residuo-')).toBe(true)
  })

  it('CUANDO LA PARRILLA ARDIENDO SUPERA AL FUEGO, ahí sí: el pescado se destruye', () => {
    // Éste era «el único caso en que el mundo cambia de fuente», y dejó de serlo: con
    // la fuente elegida por CALOR ENTREGADO, la parrilla le gana al fuego en cuanto
    // 0,60 × su potencia supera 0,25 × la del fuego, o sea con menos de la mitad de
    // potencia. El caso sigue valiendo y es el más brutal de todos: parrilla de 1,5 kg
    // sobre un fuego de 0,9 kg, el fuego (270,5) la prende, ella llega a 450,9 y se
    // queda con la elección por los dos criterios a la vez. El pescado pasa a
    // `contacto` y no queda pescado.
    const r = escena({
      masaFuego: 0.9,
      parrilla: { sustancia: 'madera', masa: 1.5 },
      comidaVa: 'sobre-la-parrilla',
    })
    const potenciaDelFuego = q(r.p.state, 'fuego', 'emitsPower')
    const s = seguir(r.p, 900)

    log([
      '─── LA PARRILLA QUE SE COMIÓ LA CENA ───',
      `  fuego 0,9 kg (P ${potenciaDelFuego.toFixed(1)}) · parrilla de madera 1,5 kg`,
      `  pico de la parrilla   ${s.picoParrilla.toFixed(2)} °C · potencia máxima ${s.potenciaMaximaDeLaParrilla.toFixed(1)}`,
      `  pico del pescado      ${s.picoComida.toFixed(2)} °C`,
      `  sustancia final       ${s.sustanciaFinal}`,
      `  digestibilidad final  ${s.digestibilidadFinal.toFixed(4)}`,
      `  calorías finales      ${q(r.p.state, 'pez', 'calories').toFixed(4)}`,
      '',
      '  Ése es el modo de falla de la parrilla de madera, y no es «se quema la comida en',
      '  la parrilla»: es «la parrilla se vuelve el fuego principal». La piedra no lo tiene.',
    ])

    expect(r.outcome?.ok).toBe(true)
    // La condición del vuelco: la parrilla ardiendo emite MÁS que el fuego, y ahí
    // `entornoDe` cambia de fuente y el pescado pasa a `contacto`.
    expect(s.potenciaMaximaDeLaParrilla).toBeGreaterThan(potenciaDelFuego)
    expect(s.sustanciaFinal.startsWith('residuo-')).toBe(true)
    expect(q(r.p.state, 'pez', 'calories')).toBe(0)
  })

  it('LA MISMA ESCENA CON PARRILLA DE PIEDRA: el pescado sale cocido', () => {
    const r = escena({
      masaFuego: 0.9,
      parrilla: { sustancia: 'piedra', masa: 1.5 },
      comidaVa: 'sobre-la-parrilla',
    })
    const s = seguir(r.p, 900)

    log([
      '─── LA MISMA ESCENA, CAMBIANDO SÓLO EL MATERIAL ───',
      `  pico de la parrilla   ${s.picoParrilla.toFixed(2)} °C · potencia máxima ${s.potenciaMaximaDeLaParrilla.toFixed(1)} (no emite nunca)`,
      `  pico del pescado      ${s.picoComida.toFixed(2)} °C`,
      `  cocido en el tick     ${String(s.tickCocido)}`,
      `  sustancia final       ${s.sustanciaFinal} · dig ${s.digestibilidadFinal.toFixed(4)}`,
      `  calorías finales      ${q(r.p.state, 'pez', 'calories').toFixed(4)}`,
      '',
      '  UNA LÍNEA DE DIFERENCIA con el test de arriba —«piedra» en vez de «madera»— y la',
      '  cena existe. ÉSA es la conclusión del mundo que nadie había escrito.',
    ])

    expect(s.potenciaMaximaDeLaParrilla).toBe(0)
    expect(s.sustanciaFinal).toBe('pescado')
    expect(s.tickCocido).toBeGreaterThan(0)
    expect(q(r.p.state, 'pez', 'calories')).toBeGreaterThan(0)
  })
})

describe('(4 bis) el fuego que la cadena enciende de verdad NO alcanza para cocinar', () => {
  it('LA VARA DE 0,47 kg deja el pescado en 0,7162 y se apaga: la parrilla sola no cierra', () => {
    // Es la medición que más incomoda de este archivo, y por eso va con su propio
    // `it` y no como una fila más. La cadena del Hito 5 enciende una vara de 0,47
    // kg —lo más barato que prende con la yesca que la orilla deja, medido en
    // `ataque-a-la-costura.test.ts`—, y esa vara puesta a servir una parrilla NO
    // llega a los 0,85 de `digestibility` que `@anima/plan` llama «cocido».
    //
    // No es que cocine despacio: es que EL FUEGO SE ACABA. Se corre hasta que la
    // fogata deja de emitir, y se reporta hasta dónde llegó.
    const r = escena({
      masaFuego: LA_VARA_DE_LA_CADENA,
      parrilla: { sustancia: 'piedra', masa: 1 },
      comidaVa: 'sobre-la-parrilla',
    })
    let digTecho = 0
    let tickDelTecho = 0
    let tickSinFuego = -1
    for (let k = 0; k < 4000; k++) {
      r.p.tick()
      const d = q(r.p.state, 'pez', 'digestibility')
      if (d > digTecho) {
        digTecho = d
        tickDelTecho = k
      }
      if (tickSinFuego < 0 && q(r.p.state, 'fuego', 'emitsPower') === 0) tickSinFuego = k
    }

    // Contraprueba 1: la MISMA escena con el techo de la fricción sí cierra.
    const conElTecho = escena({
      masaFuego: TECHO_DE_LA_FRICCION,
      parrilla: { sustancia: 'piedra', masa: 1 },
      comidaVa: 'sobre-la-parrilla',
    })
    const sTecho = seguir(conElTecho.p, 4000)

    // Contraprueba 2, y es la que le da vuelta la respuesta a este tramo: la misma
    // vara de 0,47 kg CON EL PESCADO EN CONTACTO. Hay que medirla y no suponerla:
    // el contacto multiplica la exposición por 2,4, o sea que el mismo fuego flojo
    // puede alcanzar ahí lo que no alcanza en la parrilla.
    const enContacto = escena({ masaFuego: LA_VARA_DE_LA_CADENA, comidaVa: 'sobre-el-fuego' })
    const sContacto = seguir(enContacto.p, 4000)

    log([
      '─── LA VARA DE LA CADENA CONTRA EL TECHO DE LA FRICCIÓN ───',
      `  vara de ${LA_VARA_DE_LA_CADENA.toFixed(4)} kg, en parrilla → digestibilidad techo ${digTecho.toFixed(4)} en el tick ${String(tickDelTecho)}`,
      `                                   el fuego se apaga en el tick ${String(tickSinFuego)} (${(tickSinFuego / 20).toFixed(1)} s)`,
      `                                   y «cocido» pide ${DIGESTIBILIDAD_DE_COCIDO.toFixed(2)}: NO llega, le faltan ${(DIGESTIBILIDAD_DE_COCIDO - digTecho).toFixed(4)}`,
      `  vara de ${TECHO_DE_LA_FRICCION.toFixed(4)} kg, en parrilla → cocido en el tick ${String(sTecho.tickCocido)}`,
      '',
      '─── Y LA CONTRAPRUEBA QUE HAY QUE DECIR, PORQUE INCOMODA ───',
      '',
      `  la MISMA vara de ${LA_VARA_DE_LA_CADENA.toFixed(4)} kg, con el pescado EN CONTACTO:`,
      `     pico ${sContacto.picoComida.toFixed(2)} °C · cocido en el tick ${String(sContacto.tickCocido)}`,
      `     masa final ${q(enContacto.p.state, 'pez', 'mass').toFixed(4)} kg · calorías ${q(enContacto.p.state, 'pez', 'calories').toFixed(3)}`,
      `  contra la parrilla, que con esa vara se queda en dig ${digTecho.toFixed(4)} y ${q(r.p.state, 'pez', 'calories').toFixed(3)} calorías`,
      '',
      '  O SEA: «la parrilla en vez del piso» NO es una regla, es una regla CON EL FUEGO',
      '  ADENTRO DE SU VENTANA. Con el fuego flojo que la cadena enciende hoy, la parrilla',
      '  se queda corta y el contacto no. La parrilla gana cuando el fuego alcanza —ahí',
      '  rinde 1,78× porque no hierve la comida— y pierde cuando el fuego no alcanza,',
      '  porque divide por 2,4 justamente lo que faltaba.',
      '',
      '  Para el planificador esto es lo importante del archivo: la potencia y el montaje',
      '  NO son variables independientes. Pedir «parrilla» sin pedir potencia deja a la',
      '  criatura mirando un pescado a medio cocinar hasta que la fogata se apaga.',
    ])

    expect(digTecho).toBeLessThan(DIGESTIBILIDAD_DE_COCIDO)
    expect(tickSinFuego).toBeGreaterThan(0)
    expect(sTecho.tickCocido).toBeGreaterThan(0)
    // Y la incómoda, afirmada para que no se pueda perder: con ESTE fuego el
    // contacto cocina y la parrilla no.
    expect(sContacto.tickCocido).toBeGreaterThan(0)
  })
})

describe('(5) cuánto tarda, y si entra en lo que le queda de vida', () => {
  it('armarla cuesta 3 ticks con todo en la mano y 7 con la piedra a tres celdas', () => {
    const juntas = escena({
      masaFuego: TECHO_DE_LA_FRICCION,
      parrilla: { sustancia: 'piedra', masa: 1 },
      comidaVa: 'sobre-la-parrilla',
    })

    // Y ahora con la piedra tirada a Chebyshev 3, que es lo que va a pasar de
    // verdad: `poner` se encarga de ir a buscarla y levantarla, porque su primera
    // rama es «si no lo tengo en la mano, voy y lo levanto».
    const lejos = armar(
      conElla(
        [
          fogata(TECHO_DE_LA_FRICCION),
          cuerpoEn('rejilla', 'piedra', 1, { x: 3, y: 2 }),
          cuerpoEn('pez', 'pescado', 2, { x: 0, y: 0 }, { temperature: T_AMBIENTE }),
        ],
        { holding: ['pez'], stamina: 1000 },
      ),
      [
        { que: 'rejilla', en: CELDA_DEL_FUEGO, sobre: 'fuego' },
        { que: 'pez', en: CELDA_DEL_FUEGO, sobre: 'rejilla' },
      ],
    )

    log([
      '─── CUÁNTO CUESTA ARMARLA ───',
      `  todo en la mano            ${String(juntas.ticks)} ticks · outcome ${JSON.stringify(juntas.outcome)}`,
      `  la piedra a 3 celdas       ${String(lejos.ticks)} ticks · outcome ${JSON.stringify(lejos.outcome)}`,
      `  stamina de ella al final   ${q(lejos.p.state, 'ella-cuerpo', 'stamina').toFixed(2)} de 1000`,
      '',
      '  Dos llamadas a `poner` y ninguna herramienta. Las otras catorce innatas no',
      '  intervienen: la parrilla no se fabrica, se APOYA.',
    ])

    expect(juntas.outcome?.ok).toBe(true)
    expect(lejos.outcome?.ok).toBe(true)
    expect(juntas.ticks).toBe(3)
    expect(lejos.ticks).toBe(7)
  })

  it('y cocinarse cuesta 128 ticks: los 131 de punta a punta son el 3,6% de esa vida', () => {
    const r = escena({
      masaFuego: TECHO_DE_LA_FRICCION,
      parrilla: { sustancia: 'piedra', masa: 1 },
      comidaVa: 'sobre-la-parrilla',
    })
    const crudo = {
      calorias: q(r.p.state, 'pez', 'calories'),
      toxicidad: q(r.p.state, 'pez', 'toxicity'),
      masa: q(r.p.state, 'pez', 'mass'),
    }
    const staminaAntes = q(r.p.state, 'ella-cuerpo', 'stamina')
    const s = seguir(r.p, 400)
    const staminaDespues = q(r.p.state, 'ella-cuerpo', 'stamina')

    // El neto de tragar, con el ADR II-0013 puesto: entra `calories` y sale
    // `toxicity · masa`. Es la única cuenta que decide si cocinar sirve.
    const netoCrudo = crudo.calorias - crudo.toxicidad * crudo.masa
    const netoCocido =
      s.caloriasAlCocinarse - q(r.p.state, 'pez', 'toxicity') * s.masaAlCocinarse

    log([
      '─── CUÁNTO TARDA, Y SI ENTRA ───',
      `  cocido (dig ≥ 0,85 y tox ≤ 0,05) en el tick ${String(s.tickCocido)} = ${(s.tickCocido / 20).toFixed(2)} s a 20 Hz`,
      `  armar (3) + cocinar (${String(s.tickCocido)}) = ${String(s.tickCocido + 3)} ticks de punta a punta`,
      '',
      `  crudo   ${crudo.calorias.toFixed(3)} calorías · toxicidad ${crudo.toxicidad.toFixed(4)} · masa ${crudo.masa.toFixed(4)}  → neto ${netoCrudo.toFixed(3)}`,
      `  cocido  ${s.caloriasAlCocinarse.toFixed(3)} calorías · toxicidad ${q(r.p.state, 'pez', 'toxicity').toFixed(4)} · masa ${s.masaAlCocinarse.toFixed(4)}  → neto ${netoCocido.toFixed(3)}`,
      `  o sea ${(netoCocido / netoCrudo).toFixed(2)}× por esperar ${(s.tickCocido / 20).toFixed(2)} segundos`,
      '',
      `  y ella pagó ${(staminaAntes - staminaDespues).toFixed(2)} de stamina en los 400 ticks que estuvo mirando`,
      `  (${((staminaAntes - staminaDespues) / 400).toFixed(4)} por tick, que es COSTO_VIVIR_POR_SEGUNDO / hz)`,
      '',
      '  CONTRA EL CRITERIO: la criatura del Hito 5 se muere en el tick 3627 con 0 bocados.',
      `  Los ${String(s.tickCocido + 3)} ticks de esto son el ${(((s.tickCocido + 3) / 3627) * 100).toFixed(1)}% de esa vida. No es el cuello de botella.`,
    ])

    expect(s.tickCocido).toBe(128)
    expect(netoCocido).toBeGreaterThan(netoCrudo * 2)
    // Y el costo de esperar: 128 ticks a 0,05 son 6,4 de stamina contra un tanque
    // de 1000. Se afirma el MECANISMO —la tasa— y no un reloj de pared.
    expect((staminaAntes - staminaDespues) / 400).toBeCloseTo(0.05, 6)
  })
})
