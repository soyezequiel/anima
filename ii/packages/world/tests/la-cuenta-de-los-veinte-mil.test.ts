// ─── LA CUENTA DE LOS VEINTE MIL ─────────────────────────────────────────────
//
// El criterio (5) del Hito 5 —«sobrevive 20.000 ticks sola»— está en rojo aceptado
// desde el tramo L, y su causa publicada es un solo renglón: el fuego más barato
// del mundo sale 645,5 de aliento y la criatura arranca con 310.
//
// Ese renglón es cierto y NO es la cuenta entera. Falta el otro lado —cuánto le
// FALTA de verdad para llegar, y cuánto devuelve un fuego— y sin los dos lados la
// discusión sobre qué mover se hace a ojo. Este archivo pone los dos lados en la
// misma tabla.
//
// ─── LOS TRES NÚMEROS QUE ESTE ARCHIVO CORRIGE, Y NO SON DETALLES ────────────
//
// Se escribió para confirmar que el criterio era imposible. Confirmó lo contrario,
// y las tres correcciones vienen del mismo vicio: comparar cosas medidas en
// escalas distintas.
//
//   · «LE FALTAN ~673 DE ALIENTO» → le faltan **30**. Ese 673 se midió cuando la
//     criatura se paseaba (0,04918/tick). El ancla del fondo se llevó el 65% del
//     gasto y nadie volvió a hacer la resta.
//   · «UN FUEGO DEVUELVE EL 3,7% DE LO QUE CUESTA, ~25 A 1 EN CONTRA» → es **1,24
//     a 1**. El 25 a 1 dividía el precio de un fuego por UN bocado, y un fuego no
//     cocina un bocado: cocina los que le entran mientras dura, que son 32.
//   · «(c) BAJAR LA FRICCIÓN ES CALIBRACIÓN PURA Y ESTABA DESCARTADA» → es la
//     única de las salidas que ataca la desigualdad que manda, y pide llevar la
//     eficiencia de 0,35 a **0,729**, que cabe abajo de 1.
//
// Cuatro bloques, en el orden en que se contestan:
//
//   1. EL HUECO. Cuánto aliento le falta para llegar a los 20.000. Es el número
//      que nadie había puesto y es CHICO.
//   2. LO QUE UN FUEGO CUESTA Y LO QUE DEVUELVE, medido corriendo el mundo: el
//      precio del primer fósforo contra la comida que ese fuego cocina mientras
//      dura. Se barre la masa de la brasa porque la relación NO es monótona.
//   3. LAS DOS DESIGUALDADES. Solvencia (`C < T`) y rentabilidad (`G > C`), y
//      cuál de las dos manda. De ahí sale qué salida puede cerrar el criterio.
//   4. LA PUERTA QUE NO ES EL FUEGO: cuánto daría un bocado crudo de las tres
//      sustancias que pagan crudas, contra el hueco del bloque 1.
//
// El método es el de la casa: las constantes se importan, no se copian, y lo que
// se publica como precio sale de correr `stepWorld` y no de una fórmula.

import { describe, expect, it } from 'vitest'
import {
  buildSeedPhysics,
  HZ_DE_REFERENCIA,
  qualityOf,
  SUSTANCIAS_SEMILLA,
  T_AMBIENTE,
} from '@anima/physics'
import type { Body, Physics } from '@anima/physics'

import {
  COSTO_POR_TOXICIDAD_Y_KILO,
  COSTO_VIVIR_POR_SEGUNDO,
  STAMINA_POR_CALORIA,
  stepWorld,
} from '../src/step.js'
import type { WorldState } from '../src/step.js'
import { cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

/** El criterio, tal cual lo pide el documento de arquitectura. */
const CRITERIO_TICKS = 20_000

/** Los dos tanques del criterio: con el que arranca, y el techo de la cualidad. */
const TANQUE_CANONICO = 310
const TECHO_DEL_TANQUE = 1000

/** El pescado de la corrida del criterio, con la masa que el mundo le da. */
const MASA_DEL_PESCADO = 2.887

/**
 * Las brasas del barrido, en kilos. Va fino entre 1 y 2 porque ahí está el pico y
 * ahí está el borde: abajo de 0,7 el fuego se apaga antes de cocinar y arriba de
 * 1,9 el pescado se convierte en `residuo-mineral-de-pescado` sin llegar a la
 * ventana. Publicar UNA masa habría publicado el número equivocado.
 */
const BRASAS = [0.75, 1, 1.25, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.904]

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

const dos = (x: number): string => x.toFixed(2)

// ─── Lo que se lee del catálogo, y no se copia ───────────────────────────────

function phys(): Physics {
  return buildSeedPhysics()
}

/** El `poweredBy.efficiency` de `friccion`, leído del proceso. */
function eficienciaDeFrotar(): number {
  const w = mundo()
  const e = w.phys.processes.get('friccion')?.effects[0]
  if (e === undefined || e.k !== 'drive' || e.poweredBy === undefined) {
    throw new Error('friccion cambió de forma')
  }
  return e.poweredBy.efficiency
}

/** El `toward` del `drive` de `friccion`: la temperatura que frotar consigue. */
function techoDeFrotar(): number {
  const w = mundo()
  const e = w.phys.processes.get('friccion')?.effects[0]
  if (e === undefined || e.k !== 'drive') throw new Error('friccion cambió de forma')
  return e.toward
}

const TECHO_DE_FROTAR = techoDeFrotar()

/**
 * Lo que cuesta llevar un cuerpo desde el ambiente hasta su ignición. Es la misma
 * cuenta que `la-escalera-construible.test.ts`, y por la misma razón: lo único que
 * la criatura paga de su tanque es frotar la vara hasta que la vara prende.
 */
function costoDeEncender(b: Body, p: Physics): number {
  const cap = qualityOf(b, 'heatCapacity', p)
  const ign = qualityOf(b, 'ignitionPoint', p)
  return (cap * (ign - T_AMBIENTE)) / eficienciaDeFrotar()
}

/** `fuente` ardiendo con `objetivo` pegado encima: en qué tick empieza a emitir. */
function prende(fuente: Body, objetivo: Body, techo = 3_000): number {
  let w: WorldState = mundo({
    bodies: [
      enElPiso({ ...fuente, id: 'fuente' }, EN(0, 0)),
      {
        ...enElPiso(
          { ...objetivo, id: 'objetivo', state: { ...objetivo.state, temperature: T_AMBIENTE } },
          EN(0, 0),
        ),
        supportedBy: 'fuente',
      },
    ],
  })
  for (let tick = 1; tick <= techo; tick += 1) {
    w = stepWorld(w, []).state
    const c = w.bodies.get('objetivo')
    if (c === undefined) return -1
    if (qualityOf(c.body, 'emitsPower', w.phys) > 0) return tick
  }
  return -1
}

/**
 * La vara de madera más liviana que PRENDE `objetivo` corriendo `stepWorld`.
 * Bisección sobre el mundo, arrancando en el `toward` de `friccion`.
 */
function varaQueDeVerdadPrende(objetivo: Body, alto = 4, sustancia = 'madera'): number {
  const vara = (m: number): Body => cuerpo('f', sustancia, m, { temperature: TECHO_DE_FROTAR })
  let bajo = 0
  let arriba = alto
  if (prende(vara(arriba), objetivo) < 0) return Number.POSITIVE_INFINITY
  for (let i = 0; i < 14; i += 1) {
    const medio = (bajo + arriba) / 2
    if (prende(vara(medio), objetivo) > 0) arriba = medio
    else bajo = medio
  }
  return arriba
}

interface Bocado {
  readonly calorias: number
  readonly toxicidad: number
  readonly masa: number
  /** `min(calorías · S, margen) − toxicidad · masa · K`, la cuenta de `mordidaDe`. */
  readonly neto: number
}

/** La misma cuenta de `mordidaDe`, con las constantes importadas. */
function netoDe(b: Body, p: Physics, margen: number): Bocado {
  const calorias = qualityOf(b, 'calories', p)
  const masa = qualityOf(b, 'mass', p)
  const toxicidad = qualityOf(b, 'toxicity', p)
  return {
    calorias,
    toxicidad,
    masa,
    neto: Math.min(calorias * STAMINA_POR_CALORIA, margen) - toxicidad * masa * COSTO_POR_TOXICIDAD_Y_KILO,
  }
}

/**
 * Un pescado sobre una brasa hasta que cruza la ventana de la innata, y cuánto
 * dura la brasa. Los dos números salen de la MISMA corrida, que es lo que hace
 * que se puedan dividir: cuántos bocados entran adentro de un fuego.
 */
function laCocina(masaDeLaBrasa: number): {
  readonly crudo: Bocado
  readonly cocido: Bocado | undefined
  readonly ticksDeCoccion: number
  readonly ticksDeFuego: number
  /** En qué quedó el pescado si nunca cruzó la ventana: para no publicar «NUNCA» a secas. */
  readonly final: { digestibilidad: number; temperatura: number; sustancia: string; existe: boolean }
} {
  const margen = TECHO_DEL_TANQUE - TANQUE_CANONICO
  // El montaje es `parrilla`: el pescado sobre una piedra en la MISMA celda de la
  // brasa. En el piso a una celda le llegan 33 °C y no cocina nada.
  let w: WorldState = mundo({
    bodies: [
      enElPiso(cuerpo('brasa', 'madera', masaDeLaBrasa, { temperature: 400 }), EN(0, 0)),
      enElPiso(cuerpo('piedra', 'piedra', 1), EN(0, 0)),
      {
        ...enElPiso(
          cuerpo('pez', 'pescado', MASA_DEL_PESCADO, { temperature: T_AMBIENTE }),
          EN(0, 0),
        ),
        supportedBy: 'piedra',
      },
    ],
  })
  const primero = w.bodies.get('pez')
  if (primero === undefined) throw new Error('no está el pez')
  const crudo = netoDe(primero.body, w.phys, margen)
  let cocido: Bocado | undefined
  let ticksDeCoccion = -1
  let ticksDeFuego = -1
  let mejorDigestibilidad = 0
  for (let tick = 1; tick <= 20_000; tick += 1) {
    w = stepWorld(w, []).state
    const c = w.bodies.get('pez')
    const b = w.bodies.get('brasa')
    if (c !== undefined) {
      const d = qualityOf(c.body, 'digestibility', w.phys)
      if (d > mejorDigestibilidad) mejorDigestibilidad = d
      if (cocido === undefined && d >= 0.85) {
        cocido = netoDe(c.body, w.phys, margen)
        ticksDeCoccion = tick
      }
    }
    // El fuego se apagó: `emitsPower` sale de `fuelEnergy`, y la ley 3 lo gasta.
    if (b === undefined || !(qualityOf(b.body, 'emitsPower', w.phys) > 0)) {
      ticksDeFuego = tick
      break
    }
  }
  const c = w.bodies.get('pez')
  return {
    crudo,
    cocido,
    ticksDeCoccion,
    ticksDeFuego,
    final: {
      digestibilidad: mejorDigestibilidad,
      temperatura: c === undefined ? -1 : qualityOf(c.body, 'temperature', w.phys),
      sustancia: c?.body.parts[0]?.substance ?? '(ya no existe)',
      existe: c !== undefined,
    },
  }
}

/**
 * El mejor fuego posible, barriendo masas de brasa: cuál devuelve más comida en
 * toda su vida. Se barre en vez de elegir una porque el barrido destapó que la
 * relación NO es monótona —el leño grande no cocina— y publicar una sola masa
 * habría publicado el número equivocado en cualquiera de los dos sentidos.
 */
function elMejorFuego(masas: readonly number[]): {
  readonly masa: number
  readonly porBocado: number
  readonly bocados: number
  readonly total: number
  readonly ticksDeCoccion: number
  readonly ticksDeFuego: number
} {
  let mejor = { masa: 0, porBocado: 0, bocados: 0, total: 0, ticksDeCoccion: -1, ticksDeFuego: -1 }
  for (const masa of masas) {
    const c = laCocina(masa)
    const porBocado = c.cocido?.neto ?? 0
    const bocados =
      c.ticksDeCoccion > 0 && c.ticksDeFuego > 0 ? Math.floor(c.ticksDeFuego / c.ticksDeCoccion) : 0
    const total = bocados * porBocado
    if (total > mejor.total) {
      mejor = {
        masa,
        porBocado,
        bocados,
        total,
        ticksDeCoccion: c.ticksDeCoccion,
        ticksDeFuego: c.ticksDeFuego,
      }
    }
  }
  return mejor
}

// ─── Los cuatro bloques ──────────────────────────────────────────────────────

describe('la cuenta de los veinte mil', () => {
  it('1 · EL HUECO: cuánto aliento le falta de verdad, que es el número que faltaba', () => {
    // ─── POR QUÉ ESTE NÚMERO NO ESTABA, Y POR QUÉ CAMBIA LA DISCUSIÓN ───────
    //
    // El traspaso publicó «le faltan ~673, que son 34 bocados cocidos». Ese número
    // se midió cuando la criatura SE PASEABA: gastaba 0,04918/tick contra 0,017 de
    // sólo estar viva, y las patas eran el 65%. El ancla del fondo cortó el paseo
    // —hoy gasta 0,01729, o sea 1,02×— así que el hueco se derrumbó con él y nadie
    // volvió a hacer la resta.
    //
    // Se publica el hueco del PISO —el de una criatura perfectamente quieta— porque
    // es el que no depende de la mente: cualquier cosa que la mente mejore se mueve
    // entre este número y el otro, nunca por debajo.
    const porTick = COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA
    const vivirLosVeinteMil = CRITERIO_TICKS * porTick
    const hueco = vivirLosVeinteMil - TANQUE_CANONICO
    const ticksQuieta = Math.floor(TANQUE_CANONICO / porTick)

    // Y lo que gasta de verdad, con el ancla puesta: medido en el DIAGNÓSTICO 6/6
    // de `mind/tests/hito-5-el-criterio-2a-la-cadena.test.ts`, que es el único
    // lugar donde corre la mente. Acá entra como dato citado y no como medición.
    const MEDIDO_CON_ANCLA = 0.01729
    const huecoReal = CRITERIO_TICKS * MEDIDO_CON_ANCLA - TANQUE_CANONICO

    log([
      '─── EL HUECO ───',
      `  ${String(CRITERIO_TICKS)} ticks × ${porTick.toFixed(5)}/tick de sólo estar viva = ${dos(vivirLosVeinteMil)}`,
      `  arranca con ${String(TANQUE_CANONICO)}, así que quieta llega al tick ${String(ticksQuieta)}.`,
      '',
      `  LE FALTAN ${dos(hueco)} DE ALIENTO. Quieta. Y ${dos(huecoReal)} con lo que la mente gasta hoy`,
      `  (${MEDIDO_CON_ANCLA.toFixed(5)}/tick con el ancla del fondo puesta, DIAGNÓSTICO 6/6).`,
      '',
      `  El traspaso publicó «le faltan ~673»: ése era el hueco de la criatura que se paseaba,`,
      `  a 0,04918/tick. El ancla se llevó el 65% del gasto y nadie volvió a hacer la resta.`,
    ])

    // El hueco tiene que ser POSITIVO: si fuera negativo el criterio se cumpliría
    // sin comer y dejaría de medir lo que dice medir. Éste es el guardián del borde
    // de abajo de la ventana de `COSTO_VIVIR_POR_SEGUNDO`, visto desde acá.
    expect(hueco).toBeGreaterThan(0)
    expect(ticksQuieta).toBeLessThan(CRITERIO_TICKS)
    // Y LA NOTICIA: es chico. Menos de un décimo de lo que el traspaso publicaba.
    expect(hueco).toBeLessThan(50)
    expect(huecoReal).toBeLessThan(50)
  })

  it('2 · LO QUE UN FUEGO CUESTA Y LO QUE DEVUELVE, los dos corriendo el mundo', () => {
    // ─── ESTE BLOQUE ME CORRIGIÓ UNA AFIRMACIÓN, Y LA CORRECCIÓN ES EL HALLAZGO ─
    //
    // Se escribió esperando medir «un fuego cuesta 645 y devuelve 16»: prender la
    // vara del piso y cocinar con ella. Lo que midió es peor y es más limpio:
    // **la vara del piso no cocina NADA**. Arde 467 ticks y el pescado no llega a
    // cruzar la ventana de la innata en todo ese tiempo, así que el fuego más
    // barato que la criatura puede pagar devuelve CERO.
    //
    // Por eso la tabla tiene tres filas y no una. Lo que separa a la primera de
    // las otras dos es que a las otras dos SE LES REGALA la brasa encendida: no se
    // mide lo que cuestan, se mide lo que devuelven. Es el techo generoso, y sirve
    // para que el bloque 3 argumente contra el mejor caso posible y no contra el
    // real.
    const p = phys()
    const ardibles = SUSTANCIAS_SEMILLA.filter(
      (s) => qualityOf(cuerpo('x', s.id, 1), 'fuelEnergy', p) > 0,
    )
      .map((s) => ({ s: s.id, ign: qualityOf(cuerpo('x', s.id, 1), 'ignitionPoint', p) }))
      .sort((a, b) => a.ign - b.ign)
    const facil = ardibles[0]
    if (facil === undefined) throw new Error('no arde nada')
    const vara = varaQueDeVerdadPrende(cuerpo('o', facil.s, 0.3))
    const costo = costoDeEncender(cuerpo('vara', 'madera', vara), p)

    // El barrido: de la vara que se puede pagar al leño de 2,904 kg al que la
    // escalera de la yesca llega propagando (`la-escalera-construible`, bloque 2).
    const brasas = [vara, ...BRASAS]
    const filas: string[] = [
      '─── LO QUE UN FUEGO CUESTA Y LO QUE DEVUELVE ───',
      `  lo más fácil de prender que arde: ${facil.s} a ${facil.ign.toFixed(0)} °C`,
      `  la vara que lo prende de verdad: ${vara.toFixed(4)} kg  →  EL FÓSFORO CUESTA ${dos(costo)}`,
      '',
      '  brasa │ dura │ cocina en │ bocados │ cada uno │ DEVUELVE │ y si no cocinó, en qué quedó el pescado',
      '  ──────┼──────┼───────────┼─────────┼──────────┼──────────┼────────────────────────────────────────',
    ]
    let crudo = 0
    for (const masa of brasas) {
      const c = laCocina(masa)
      crudo = c.crudo.neto
      const g = c.cocido?.neto ?? 0
      const bocados =
        c.ticksDeCoccion > 0 && c.ticksDeFuego > 0 ? Math.floor(c.ticksDeFuego / c.ticksDeCoccion) : 0
      filas.push(
        `  ${masa.toFixed(3).padStart(5)} │ ${String(c.ticksDeFuego).padStart(4)} │ ` +
          `${(c.ticksDeCoccion > 0 ? String(c.ticksDeCoccion) : 'NUNCA').padStart(9)} │ ` +
          `${String(bocados).padStart(7)} │ ${dos(g).padStart(8)} │ ${dos(bocados * g).padStart(8)} │ ` +
          (c.cocido !== undefined
            ? masa === vara
              ? '← la única que la criatura puede pagar'
              : ''
            : `${c.final.existe ? c.final.sustancia : 'YA NO EXISTE'} · digestibilidad tope ` +
              `${c.final.digestibilidad.toFixed(4)} · ${c.final.temperatura.toFixed(0)} °C` +
              `${masa === vara ? '   ← la única que la criatura puede pagar' : ''}`),
      )
    }
    const mejor = elMejorFuego(brasas)
    filas.push(
      '',
      `  el pescado CRUDO da ${dos(crudo)}: cocinar SÍ da vuelta el signo del bocado, eso funciona.`,
      '',
      `  EL FÓSFORO CUESTA ${dos(costo)} Y EL MEJOR FUEGO DEVUELVE ${dos(mejor.total)}` +
        ` (brasa de ${mejor.masa.toFixed(3)} kg, ${String(mejor.bocados)} bocados), Y ESTÁ REGALADO ENCENDIDO.`,
      `  El que sí se puede pagar devuelve CERO: se apaga antes de que nada cruce la ventana.`,
      '',
      `  Y LA RELACIÓN NO ES MONÓTONA, que es lo que este barrido vino a destapar sin querer:`,
      `  más brasa no es más comida. Arriba de cierta masa el pescado no cocina, y la fila`,
      `  de la derecha dice en qué quedó. Por eso el «mejor fuego» se barre y no se elige.`,
    )
    log(filas)

    expect(Number.isFinite(vara)).toBe(true)
    // Cocinar da vuelta el signo del bocado: eso es lo que sí funciona.
    expect(crudo).toBeLessThan(0)
    expect(mejor.total).toBeGreaterThan(0)
    // Y LAS DOS AFIRMACIONES DEL BLOQUE. La primera es la que este bloque vino a
    // buscar sin saberlo: el fuego que la criatura puede pagar no cocina.
    expect(laCocina(vara).cocido).toBeUndefined()
    // La segunda: ni siquiera regalándole el mejor fuego del barrido, encendido,
    // lo que devuelve paga el fósforo.
    expect(mejor.total).toBeLessThan(costo)
  }, 300_000)

  it('3 · LAS DOS DESIGUALDADES: manda la SOLVENCIA (C < T), y el tanque se cancela', () => {
    // ─── EL ÁLGEBRA, QUE ES CORTA Y DECIDE LAS CUATRO SALIDAS ──────────────
    //
    // Llamemos T al tanque de arranque, L al costo de vivir por tick, N a los
    // 20.000 ticks, C a lo que cuesta el primer fuego y G a lo que ese fuego
    // devuelve en comida mientras dura. El criterio pide TRES cosas a la vez:
    //
    //   (i)   que NO llegue quieta  .............  T < N · L
    //   (ii)  SOLVENCIA: que pueda PAGAR el fuego
    //         antes de comer nada  ..............  C < T
    //   (iii) RENTABILIDAD: que después llegue  .  T − C + G ≥ N · L
    //
    // Y de acá salen las dos cosas que hay que saber, ninguna de las cuales estaba
    // escrita:
    //
    //   · **(i) y (ii) juntas dicen `C < T < N · L`.** O sea que el primer fuego
    //     tiene que costar MENOS QUE EL PRESUPUESTO DE VIDA ENTERO, y eso no
    //     depende de G ni del tanque: es una cota sobre C sola. Hoy N · L = 340 y
    //     C = 645,50. **Ésta es la condición que manda**, y la que hay que mirar
    //     primero, porque una criatura que se muere frotando nunca llega a
    //     enterarse de si el fuego era rentable.
    //   · **(i) en (iii) da G > C, y T y L se cancelan.** No existe par (tanque,
    //     costo de vivir) que cierre el criterio mientras un fuego devuelva menos
    //     de lo que cuesta.
    //
    // Y ESO MATA LA SALIDA (b) SIN NECESIDAD DE MEDIR NADA. Subir el tanque
    // aflojaría (ii), pero (i) es una cota de arriba sobre el mismo tanque: con
    // 1000 la criatura llega viva y con CERO bocados —medido en el juez—, o sea
    // que cumple (iii) rompiendo (i). El criterio pasa a ser «quedate quieta» y
    // deja de medir lo que dice medir.
    const p = phys()
    const ardibles = SUSTANCIAS_SEMILLA.filter(
      (s) => qualityOf(cuerpo('x', s.id, 1), 'fuelEnergy', p) > 0,
    )
      .map((s) => ({ s: s.id, ign: qualityOf(cuerpo('x', s.id, 1), 'ignitionPoint', p) }))
      .sort((a, b) => a.ign - b.ign)
    const facil = ardibles[0]
    if (facil === undefined) throw new Error('no arde nada')
    const vara = varaQueDeVerdadPrende(cuerpo('o', facil.s, 0.3))
    const c = costoDeEncender(cuerpo('vara', 'madera', vara), p)
    // G se toma del MEJOR caso del barrido del bloque 2 —la brasa regalada
    // encendida que más comida devuelve en toda su vida—, y no del fuego que la
    // criatura puede pagar, que devuelve cero. Si el argumento cierra contra el
    // mejor caso posible, cierra.
    const cocina = laCocina(2.904)
    const mejor = elMejorFuego(BRASAS)
    const porBocado = mejor.porBocado
    const g = mejor.total

    // (c) · el costo es `heatCapacity · ΔT / eficiencia`, así que C baja en razón
    // inversa a la eficiencia. Se calculan las DOS eficiencias que las dos
    // condiciones piden, y la que gobierna es la más grande de las dos.
    const efHoy = eficienciaDeFrotar()
    const porTick = COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA
    const presupuestoDeVida = CRITERIO_TICKS * porTick
    /** Para que sea RENTABLE: C < G. */
    const efParaRentable = (efHoy * c) / g
    /** Para que sea PAGABLE con el tanque que tiene: C < T. */
    const efParaSolvente = (efHoy * c) / TANQUE_CANONICO
    const efQueHariaFalta = Math.max(efParaRentable, efParaSolvente)

    // (c′) · la otra forma de subir G sin tocar constantes: que el fuego cocine más
    // veces. Cuántos bocados harían falta, y cuántos ticks de fuego son.
    const bocadosQueHarianFalta = Math.ceil(c / porBocado)
    const ticksDeFuegoQueHarianFalta = bocadosQueHarianFalta * mejor.ticksDeCoccion

    // (b′) · subir lo que rinde una caloría. Es la razón directa, y lo que rompe
    // está medido acá al lado: con ese multiplicador el pescado CRUDO da positivo,
    // y el guardián del riesgo 4 dice que sin trabajar la energía neta es negativa.
    const factorDeCalorias = c / g
    const margen = TECHO_DEL_TANQUE - TANQUE_CANONICO
    const crudoConEseFactor =
      Math.min(cocina.crudo.calorias * STAMINA_POR_CALORIA * factorDeCalorias, margen) -
      cocina.crudo.toxicidad * cocina.crudo.masa * COSTO_POR_TOXICIDAD_Y_KILO

    log([
      '─── LAS DOS DESIGUALDADES, Y LA QUE MANDA NO ES LA QUE PARECÍA ───',
      '  (i)   que NO llegue quieta .........  T < N · L',
      '  (ii)  SOLVENCIA: puede pagarlo .....  C < T',
      '  (iii) RENTABILIDAD: después llega ..  T − C + G ≥ N · L',
      '',
      `  (i)+(ii)  →  C < T < N · L.   EL FUEGO TIENE QUE COSTAR MENOS QUE VIVIR LOS ${String(CRITERIO_TICKS)} TICKS.`,
      '  (i)+(iii) →  G > C.           T y L SE CANCELAN.',
      '',
      `  hoy:  C = ${dos(c)}   T = ${String(TANQUE_CANONICO)}   N · L = ${dos(presupuestoDeVida)}   ` +
        `G = ${dos(g)} (el mejor fuego del barrido, REGALADO encendido)`,
      `        solvencia    C < T      →  ${dos(c)} < ${String(TANQUE_CANONICO)}   FALSO por ${(c / TANQUE_CANONICO).toFixed(2)}×  ← la que manda`,
      `        rentabilidad G > C      →  ${dos(g)} > ${dos(c)}   FALSO por ${(c / g).toFixed(2)}×`,
      '',
      '  qué le pediría cada salida al mundo:',
      `   (b) subir el tanque .......... NO CIERRA POR ÁLGEBRA: (i) es una cota de ARRIBA sobre el mismo`,
      `                                  tanque. Con 1000 llega viva y con 0 bocados: cumple (iii) rompiendo (i).`,
      `   (c) bajar el precio de frotar . eficiencia ${efHoy.toFixed(2)} → ${efQueHariaFalta.toFixed(3)}` +
        `${efQueHariaFalta > 1 ? '  ← IMPOSIBLE: saldría más calor del que entra trabajo' : '  ← CABE ABAJO DE 1: es calibración, no otro mundo'}`,
      `                                  (rentabilidad pide ${efParaRentable.toFixed(3)}; solvencia pide ${efParaSolvente.toFixed(3)}: manda la segunda)`,
      `   (c′) que un fuego cocine más .. ${String(bocadosQueHarianFalta)} bocados por fuego = ` +
        `${String(ticksDeFuegoQueHarianFalta)} ticks (el mejor de hoy dura ${String(mejor.ticksDeFuego)} y da ${String(mejor.bocados)})` +
        `${ticksDeFuegoQueHarianFalta < CRITERIO_TICKS ? '  ← entra en los 20.000' : '  ← no entra'}`,
      `                                  PERO NO ALCANZA SOLA: sube G y no baja C, y la que manda es C.`,
      `   (b′) subir lo que rinde una caloría × ${factorDeCalorias.toFixed(2)}: el pescado CRUDO pasa a dar ` +
        `${dos(crudoConEseFactor)}` +
        `${crudoConEseFactor > 0 ? '  ← ROMPE el guardián del riesgo 4' : '  ← el guardián del riesgo 4 AGUANTA'}`,
      `                                  Y TAMPOCO ALCANZA SOLA, por lo mismo: sube G, no baja C.`,
      '',
      `  (a·bis) comida cruda que haya que TRABAJAR no entra en esta tabla porque no pasa por C.`,
      `  Contra lo que juega es contra el hueco del bloque 1: ${dos(presupuestoDeVida - TANQUE_CANONICO)}.`,
    ])

    // LA AFIRMACIÓN: hoy no se cumple ninguna de las dos.
    expect(g).toBeLessThan(c)
    expect(c).toBeGreaterThan(TANQUE_CANONICO)
    // Y que la que manda sea la solvencia y no la rentabilidad: es lo que decide
    // en qué orden se mira todo lo de arriba.
    expect(efParaSolvente).toBeGreaterThan(efParaRentable)
    // ─── Y ACÁ EL BLOQUE ME CORRIGIÓ LA SEGUNDA AFIRMACIÓN ──────────────────
    //
    // Decía `expect(efQueHariaFalta).toBeGreaterThan(1)`, escrito para publicar
    // «la salida (c) es imposible: pediría más calor que trabajo». La medición
    // contestó **0,55**, o sea perfectamente posible. Lo que estaba mal era el G
    // heredado: el traspaso comparaba el precio de un fuego contra UN bocado
    // («~25 a 1 en contra · el fuego devuelve el 3,7%») y un fuego no cocina un
    // bocado, cocina los que le entran mientras dura. Contando la vida entera del
    // fuego la razón es 1,58×, no 25×.
    //
    // Así que la afirmación buena es la que sí se sostiene —la desigualdad no se
    // cumple HOY— más la banda de lo que le falta, que es lo que dice si esto es
    // calibración o es otro mundo. Menos de 2× es calibración.
    expect(efQueHariaFalta).toBeLessThan(1)
    expect(c / g).toBeLessThan(2)
  }, 120_000)

  it('4 · LA PUERTA QUE NO ES EL FUEGO: lo que daría un bocado crudo de las tres que pagan', () => {
    // Las tres sustancias del catálogo que dan neto positivo CRUDAS —huevo, médula
    // y grasa, medidas en `hay-comida-sin-fuego.test.ts`— contra el hueco del
    // bloque 1. La pregunta no es si existen: es CUÁNTAS piezas harían falta, que
    // es lo que dice si la salida (a·bis) es una técnica o una fantasía.
    const p = phys()
    const porTick = COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA
    const hueco = CRITERIO_TICKS * porTick - TANQUE_CANONICO
    const margen = TECHO_DEL_TANQUE - TANQUE_CANONICO

    const filas: string[] = [
      '─── LO QUE DARÍA UN BOCADO CRUDO ───',
      `  el hueco a tapar: ${dos(hueco)} de aliento`,
      '',
      '  sustancia │ neto por kilo │ ¿positivo? │ kilos para tapar el hueco',
      '  ──────────┼───────────────┼────────────┼──────────────────────────',
    ]
    const pagan: { s: string; porKilo: number }[] = []
    for (const s of SUSTANCIAS_SEMILLA) {
      const unKilo = cuerpo('x', s.id, 1, { temperature: T_AMBIENTE })
      const b = netoDe(unKilo, p, margen)
      if (!(b.calorias > 0)) continue
      const porKilo = b.neto
      if (porKilo > 0) pagan.push({ s: s.id, porKilo })
      filas.push(
        `  ${s.id.padEnd(9)} │ ${dos(porKilo).padStart(13)} │ ${(porKilo > 0 ? 'sí' : 'no').padStart(10)} │ ` +
          `${(porKilo > 0 ? `${(hueco / porKilo).toFixed(2)} kg` : '—').padStart(24)}`,
      )
    }
    filas.push(
      '',
      `  las que pagan crudas: ${pagan.map((x) => x.s).join(', ')}`,
      `  y el dios no siembra ninguna (medido en \`hay-comida-sin-fuego.test.ts\`, bloque 3).`,
      '',
      `  LO QUE ESTO DICE: la salida (a·bis) —comida cruda que haya que TRABAJAR— no pelea`,
      `  contra los 645,5 del fósforo. Pelea contra ${dos(hueco)}, y la tapa con un par de kilos.`,
      '',
      `  Y el tamaño importa menos de lo que parece: el hueco es de UN dígito de bocados, así`,
      `  que la técnica no tiene que ser rentable, sólo tiene que existir UNA VEZ en 20.000 ticks.`,
    )
    log(filas)

    // Que haya al menos una: si no, la salida (a·bis) no existiría y habría que
    // decirlo con estas palabras.
    expect(pagan.length).toBeGreaterThan(0)
    // LA AFIRMACIÓN QUE IMPORTA, y no es la que este bloque afirmaba primero. Decía
    // «con menos de un kilo se tapa el hueco» y la medición contestó 2,12: la grasa
    // rinde 14,15 por kilo y el hueco es 30. La afirmación buena es la comparación
    // que de verdad decide, y es contra el otro camino: unos pocos kilos de materia
    // contra 645,5 de aliento.
    const mejor = pagan.map((x) => x.porKilo).reduce((a, b) => (b > a ? b : a), 0)
    expect(hueco / mejor).toBeLessThan(5)
    // Y el orden de magnitud, dicho como afirmación: tapar el hueco comiendo crudo
    // cuesta menos de un décimo de lo que cuesta el primer fósforo.
    expect(hueco).toBeLessThan(645.5 / 10)
  })

  it('5 · DE QUÉ SE PUEDE HACER EL FÓSFORO: la vara no tiene por qué ser de madera', () => {
    // ─── EL SUPUESTO QUE NADIE HABÍA MIRADO ────────────────────────────────
    //
    // Los 645,50 salen de frotar una vara DE MADERA, y `la-escalera-construible`
    // la escribe así: `cuerpo('vara', 'madera', medida)`. Pero `friccion` no pide
    // madera: pide `rigidity >= 0,5` en los dos palos. Cuál sustancia sale más
    // barata de llevar hasta su propia ignición es una pregunta del catálogo que
    // nadie le hizo, y como el precio es `heatCapacity × ΔT / eficiencia`, la
    // respuesta depende de DOS cosas que varían por sustancia —cuánto calor pide
    // por grado y cuántos grados hay hasta su ignición— y de una tercera que
    // varía en contra: cuánta masa hace falta para que, ardiendo, alcance a
    // prender el objetivo.
    //
    // Este bloque las barre y publica la tabla. No propone ningún número: lo que
    // sale de acá es de dónde puede bajar `C` sin tocar una constante.
    const p = phys()
    const RIG = 0.5
    const objetivo = SUSTANCIAS_SEMILLA.filter(
      (s) => qualityOf(cuerpo('x', s.id, 1), 'fuelEnergy', p) > 0,
    )
      .map((s) => ({ s: s.id, ign: qualityOf(cuerpo('x', s.id, 1), 'ignitionPoint', p) }))
      .sort((a, b) => a.ign - b.ign)[0]
    if (objetivo === undefined) throw new Error('no arde nada')

    const filas: string[] = [
      '─── DE QUÉ SE PUEDE HACER EL FÓSFORO ───',
      `  \`friccion\` pide rigidity ≥ ${RIG.toFixed(2)} en los DOS palos, y nada más. No pide madera.`,
      `  lo que hay que prender: ${objetivo.s} a ${objetivo.ign.toFixed(0)} °C`,
      '',
      '  sustancia │ rigidez │ arde │ ignición │ vara MEDIDA │ COSTO',
      '  ──────────┼─────────┼──────┼──────────┼─────────────┼──────',
    ]
    let piso = Number.POSITIVE_INFINITY
    let laBarata = ''
    for (const s of SUSTANCIAS_SEMILLA) {
      const uno = cuerpo('x', s.id, 1)
      const rig = qualityOf(uno, 'rigidity', p)
      const arde = qualityOf(uno, 'fuelEnergy', p) > 0
      const ign = qualityOf(uno, 'ignitionPoint', p)
      if (rig < RIG) continue
      // Una vara que no arde no sirve de fósforo: se la puede calentar, pero
      // apagado el frotar la ley 1 la relaja y no prende nada.
      const vara = arde
        ? varaQueDeVerdadPrende(cuerpo('o', objetivo.s, 0.3), 4, s.id)
        : Number.POSITIVE_INFINITY
      const costo = Number.isFinite(vara)
        ? costoDeEncender(cuerpo('vara', s.id, vara), p)
        : Number.POSITIVE_INFINITY
      if (costo < piso) {
        piso = costo
        laBarata = s.id
      }
      filas.push(
        `  ${s.id.padEnd(9)} │ ${rig.toFixed(2).padStart(7)} │ ${(arde ? 'sí' : 'no').padStart(4)} │ ` +
          `${(arde ? ign.toFixed(0) : '—').padStart(8)} │ ` +
          `${(Number.isFinite(vara) ? vara.toFixed(4) : '—').padStart(11)} │ ` +
          `${Number.isFinite(costo) ? costo.toFixed(1) : '—'}`,
      )
    }
    filas.push(
      '',
      `  EL FÓSFORO MÁS BARATO DEL MUNDO ES DE ${laBarata.toUpperCase()}: ${piso.toFixed(1)} de aliento.`,
      `  contra el tanque de ${String(TANQUE_CANONICO)}: ${piso < TANQUE_CANONICO ? 'LO PAGA' : `no lo paga, por ${(piso / TANQUE_CANONICO).toFixed(2)}×`}`,
      '',
      `  y con la eficiencia PERFECTA que el guardián de la conservación permite (1,00, en`,
      `  \`physics/tests/process.test.ts\`) ese mismo fósforo saldría ${(piso * eficienciaDeFrotar()).toFixed(1)}:`,
      `  ${piso * eficienciaDeFrotar() < TANQUE_CANONICO ? 'ahí SÍ entra en el tanque' : 'ni así entra'}.`,
    )
    log(filas)

    expect(Number.isFinite(piso)).toBe(true)
    // El piso del mundo no puede ser MÁS CARO que el que ya se publicó con madera:
    // si esta tabla diera algo peor, estaría midiendo mal.
    expect(piso).toBeLessThanOrEqual(645.51)
    // Y la noticia del bloque, dicha como afirmación: cambiar de sustancia AYUDA y
    // NO ALCANZA. Si algún día alcanzara, el criterio se cerraría sin tocar ninguna
    // constante y este `expect` sería lo que lo avisa.
    expect(piso).toBeGreaterThan(TANQUE_CANONICO)
  }, 300_000)

  it('6 · LA VENTANA DE LA EFICIENCIA: qué valores cierran el criterio y con qué fuego', () => {
    // ─── LO QUE ESTE BLOQUE ES Y LO QUE NO ES ──────────────────────────────
    //
    // No propone un número: publica la ventana. Para cada eficiencia candidata
    // calcula lo que costaría el fósforo más barato del mundo y contesta las dos
    // preguntas del bloque 3 —¿lo puede pagar? ¿le alcanza después?— contra los
    // fuegos que el barrido del bloque 2 midió.
    //
    // El techo de la ventana no lo elige nadie: es 1,00, y lo afirma el guardián
    // de la conservación en `physics/tests/process.test.ts` («todo drive que
    // empuja hacia arriba declara de qué cuenta drena», con
    // `efficiency <= 1`). Arriba de 1 sale más calor del que entra trabajo y eso
    // es la máquina de movimiento perpetuo que el ADR II-0001 vino a cerrar.
    //
    // Y LA COLUMNA QUE DECIDE ES LA ÚLTIMA: cuántos bocados hace falta que la
    // criatura cocine. Bajar la eficiencia no vuelve el criterio imposible, lo
    // vuelve MÁS TRABAJOSO, y ese trabajo lo tiene que hacer la mente. Elegir el
    // número es elegir cuántas veces querés que pesque y cocine.
    const p = phys()
    const objetivo = SUSTANCIAS_SEMILLA.filter(
      (s) => qualityOf(cuerpo('x', s.id, 1), 'fuelEnergy', p) > 0,
    )
      .map((s) => ({ s: s.id, ign: qualityOf(cuerpo('x', s.id, 1), 'ignitionPoint', p) }))
      .sort((a, b) => a.ign - b.ign)[0]
    if (objetivo === undefined) throw new Error('no arde nada')

    // El fósforo más barato del catálogo, medido en el bloque 5, y su costo
    // TÉRMICO —el que no depende de la eficiencia—: `heatCapacity × ΔT`.
    let termico = Number.POSITIVE_INFINITY
    let deQue = ''
    for (const s of SUSTANCIAS_SEMILLA) {
      const uno = cuerpo('x', s.id, 1)
      if (qualityOf(uno, 'rigidity', p) < 0.5) continue
      if (!(qualityOf(uno, 'fuelEnergy', p) > 0)) continue
      const vara = varaQueDeVerdadPrende(cuerpo('o', objetivo.s, 0.3), 4, s.id)
      if (!Number.isFinite(vara)) continue
      const t = costoDeEncender(cuerpo('vara', s.id, vara), p) * eficienciaDeFrotar()
      if (t < termico) {
        termico = t
        deQue = s.id
      }
    }

    const porTick = COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA
    const presupuestoDeVida = CRITERIO_TICKS * porTick
    const porBocado = elMejorFuego(BRASAS).porBocado
    const filas: string[] = [
      '─── LA VENTANA DE LA EFICIENCIA ───',
      `  el fósforo más barato es de ${deQue}, y su costo TÉRMICO —el que no depende de la`,
      `  eficiencia— es ${dos(termico)}. El precio es ese número dividido la eficiencia.`,
      `  el techo de la ventana es 1,00 y lo pone el guardián de la conservación, no este archivo.`,
      '',
      '  eficiencia │ el fósforo │ ¿lo paga? │ le queda │ comida que necesita │ bocados a cocinar',
      '  ───────────┼────────────┼───────────┼──────────┼─────────────────────┼──────────────────',
    ]
    let elMinimoQueCierra = Number.POSITIVE_INFINITY
    for (const ef of [0.35, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1]) {
      const costo = termico / ef
      const paga = costo < TANQUE_CANONICO
      const queda = TANQUE_CANONICO - costo
      const necesita = presupuestoDeVida - TANQUE_CANONICO + costo
      const bocados = Math.ceil(necesita / porBocado)
      if (paga && elMinimoQueCierra === Number.POSITIVE_INFINITY) elMinimoQueCierra = ef
      filas.push(
        `  ${ef.toFixed(2).padStart(10)} │ ${dos(costo).padStart(10)} │ ` +
          `${(paga ? 'sí' : 'NO').padStart(9)} │ ${dos(queda).padStart(8)} │ ` +
          `${dos(necesita).padStart(19)} │ ${String(bocados).padStart(18)}` +
          `${ef === eficienciaDeFrotar() ? '   ← hoy' : ''}`,
      )
    }
    filas.push(
      '',
      `  cada bocado de pescado cocido deja ${dos(porBocado)}, y el barrido del bloque 2 dice cuántos`,
      `  entran adentro de un fuego: 11 en uno de 1 kg, 18 en uno de 1,25 y 32 en uno de 1,7.`,
      '',
      `  LA SOLVENCIA SE ABRE EN ${elMinimoQueCierra.toFixed(2)}, y ahí la criatura queda con casi nada:`,
      `  el número no se elige por el borde, se elige por cuántos bocados querés pedirle a la mente.`,
    )
    log(filas)

    // El techo de la ventana es del guardián, no de acá: se afirma que existe.
    expect(termico).toBeLessThan(TANQUE_CANONICO)
    // Y que la ventana esté ABIERTA: hay eficiencias legales que hacen solvente a
    // la criatura. Si esto se pusiera rojo, la salida (c) estaría muerta y habría
    // que volver al bloque 3 a elegir otra.
    expect(elMinimoQueCierra).toBeLessThanOrEqual(1)
  }, 300_000)
})
