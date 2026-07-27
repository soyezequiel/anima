// ─── EL TECHO CALÓRICO, Y EL TEST ECONÓMICO ──────────────────────────────────
//
// El riesgo 4 del documento de arquitectura, palabra por palabra:
//
//   «`nutrition` es conservada, pero el oráculo puede sembrar peces. Si el
//    presupuesto calórico por chunk está mal calibrado, la criatura tiene una
//    fuente infinita de comida siempre que pueda caminar hasta el chunk
//    siguiente — y ahí el hambre, que es el motor de toda la historia, deja de
//    doler.»
//
// Y su mitigación, que son cinco cosas:
//
//   1. presupuesto calórico por chunk como **función pura de la semilla**   ✔ ya estaba
//   2. el oráculo elige forma y nombre pero **nunca escribe números**       ✔ ya estaba
//   3. `aportado ≤ min(pedido, presupuesto)` **verificado como invariante** ← acá
//   4. stocks finitos con regeneración                                      ✔ ya estaba
//   5. **un test económico de 100 partidas de 20.000 ticks donde la energía
//      neta acumulada de la criatura tiene que ser NEGATIVA sin trabajo**   ← acá
//
// Los puntos 1, 2 y 4 estaban escritos y verificados. El 3 no: `caloricBudget`
// devolvía un número que **no leía nadie**. El 5 no existía.
//
// ─── La regla de este archivo ───────────────────────────────────────────────
//
// **Ningún número del modelo económico se inventa acá.** Los cuatro salen de
// `@anima/physics` en tiempo de ejecución, no copiados a mano: si mañana alguien
// recalibra un proceso semilla, este test recalcula y dice otra cosa. Un test
// económico con las constantes copiadas mide su propia copia.
//
// La única excepción está marcada como tal y es `COSTO_DE_VIVIR_POR_SEGUNDO`:
// **la física semilla no tiene metabolismo** —la criatura no existe hasta el
// Hito 5— así que cuánto cuesta estar vivo es una perilla, y está declarada como
// perilla, con de dónde se sacó su valor y qué la va a reemplazar.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Body, Duracion, Fixed, Physics, SubstanceId } from '@anima/physics'
import {
  buildSeedPhysics,
  DIGESTIBILIDAD_TECHO,
  dtDeFrecuencia,
  EXTRACCION,
  fx,
  HZ_DE_REFERENCIA,
  qualityOf,
  SEED_PROCESSES,
  seg,
  sumarPaso,
  unfx,
  unir,
} from '@anima/physics'

import type { ChunkDecretado, MundoConDado, Stock, WorldRng } from '../src/index.js'
import {
  CAPACIDAD_MAXIMA,
  caloricBudget,
  crearStock,
  decretarChunk,
  draw,
  InvariantError,
  LibroCalorico,
  MASA_MAXIMA_DE_UNA_PIEZA,
  MILICALORIAS_POR_CALORIA,
  milicaloriasDe,
  mulberry32,
  PER_MILLE_MAXIMO,
  presupuestoCaloricoDeChunk,
  resolveChunk,
  retirarUno,
} from '../src/index.js'

const PHYS: Physics = buildSeedPhysics()
const SEMILLA = 20260727n

const VARA: Body = { id: 'v', form: 'vara', parts: [{ substance: 'madera', mass: 1, q: {} }], joints: [], state: {} }
const HEBRA: Body = { id: 'h', form: 'hebra', parts: [{ substance: 'liana', mass: 0.3, q: {} }], joints: [], state: {} }
/** La caña. Nadie la llamó caña: es una vara con una hebra atada de un solo lado. */
const CAÑA = unir(VARA, undefined, HEBRA, PHYS, 'c')!

/** Un dado del mundo con LA MEJOR SUERTE POSIBLE: siempre pica. El `as` es el
 *  molde de siempre, y vive en los tests y en ningún archivo de `src/`. */
const SUERTE_PERFECTA = ((): number => 0) as WorldRng

// ─── 1. El techo, que ya era puro, y ahora además se lee ────────────────────

describe('el techo del chunk es una función pura de la semilla', () => {
  it('la vía barata y la vía completa dan el MISMO número en 441 chunks', () => {
    // `LibroCalorico` no puede decretar el chunk entero para leer un entero: son
    // 256 celdas de terreno por cada pregunta de presupuesto. Usa el camino
    // corto, y que los dos caminos coincidan no puede ser un comentario — es
    // exactamente la clase de duplicación que este repo ya se comió con
    // `capacidadTermica`.
    let n = 0
    for (let cx = -10; cx <= 10; cx++) {
      for (let cy = -10; cy <= 10; cy++) {
        const completo = resolveChunk(SEMILLA, cx, cy)
        expect(presupuestoCaloricoDeChunk(SEMILLA, cx, cy)).toBe(completo.presupuestoCalorico)
        expect(caloricBudget(completo.bioma, completo.clima.fertilidad)).toBe(completo.presupuestoCalorico)
        n++
      }
    }
    expect(n).toBe(441)
  })

  it('el techo del libro no se mueve con la historia, ni con lo que ya se cobró', () => {
    const libro = new LibroCalorico(SEMILLA)
    const techo = libro.techo(3, -4)
    expect(techo).toBe(presupuestoCaloricoDeChunk(SEMILLA, 3, -4) * MILICALORIAS_POR_CALORIA)
    libro.cobrar({ cx: 3, cy: -4, substance: 'pescado', masa: fx(1), milicalorias: 1000, at: seg(0) })
    libro.cobrar({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: 5000, at: seg(1) })
    expect(libro.techo(3, -4)).toBe(techo)
    // Y dos libros de la misma semilla dicen lo mismo, hayan visto lo que hayan
    // visto: el techo no es historia.
    expect(new LibroCalorico(SEMILLA).techo(3, -4)).toBe(techo)
    // Otra semilla, otro mundo: si diera lo mismo, el techo no dependería de la
    // semilla y este test no estaría midiendo nada.
    const otros = new LibroCalorico(7n)
    let distintos = 0
    for (let cx = 0; cx < 40; cx++) if (otros.techo(cx, 0) !== libro.techo(cx, 0)) distintos++
    expect(distintos).toBeGreaterThan(20)
  })

  it('las calorías de una pieza salen de la física, no de una fórmula de acá', () => {
    // `nutrition · mass · digestibility` para un pescado de un kilo: 8 × 1 × 0.38.
    const pieza: Body = { id: 'p', form: 'bloque', parts: [{ substance: 'pescado', mass: 1, q: {} }], joints: [], state: {} }
    expect(milicaloriasDe('pescado', fx(1), PHYS)).toBe(Math.ceil(qualityOf(pieza, 'calories', PHYS) * 1000))
    expect(milicaloriasDe('pescado', fx(1), PHYS)).toBe(3040)
    // Extensiva en la masa: el doble de pescado, el doble de calorías.
    expect(milicaloriasDe('pescado', fx(2), PHYS)).toBe(6080)
    // Y lo que no alimenta no gasta presupuesto: el techo es CALÓRICO, así que
    // sacar barro de un pozo no compite con la comida.
    expect(milicaloriasDe('piedra', fx(3), PHYS)).toBe(0)
    expect(milicaloriasDe('arcilla', fx(3), PHYS)).toBe(0)
  })
})

// ─── 2. El libro: cobra entero o no cobra ───────────────────────────────────

describe('el libro calórico', () => {
  it('cobra entero o no cobra: nunca a medias', () => {
    const libro = new LibroCalorico(SEMILLA)
    const techo = libro.techo(0, 0)
    expect(libro.cobrar({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: techo - 10, at: seg(0) })).toBe(true)
    expect(libro.disponible(0, 0)).toBe(10)
    // No entra: se rechaza y **no escribe nada**. Un cobro parcial sería el dios
    // entregando una cosa y anotando otra.
    expect(libro.cobrar({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: 11, at: seg(1) })).toBe(false)
    expect(libro.aportado(0, 0)).toBe(techo - 10)
    expect(libro.cobros().length).toBe(1)
    // Lo que entra justo, entra.
    expect(libro.cobrar({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: 10, at: seg(2) })).toBe(true)
    expect(libro.disponible(0, 0)).toBe(0)
    libro.verificar()
  })

  it('un chunk exprimido no le saca presupuesto al de al lado', () => {
    const libro = new LibroCalorico(SEMILLA)
    libro.cobrar({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: libro.techo(0, 0), at: seg(0) })
    expect(libro.disponible(0, 0)).toBe(0)
    expect(libro.disponible(1, 0)).toBe(libro.techo(1, 0))
    expect(libro.aportado(1, 0)).toBe(0)
  })

  it('`verificar()` rehace los totales replayando el diario, y caza la diferencia', () => {
    const libro = new LibroCalorico(SEMILLA)
    for (let i = 0; i < 25; i++) {
      libro.cobrar({ cx: i % 5, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: 3040, at: seg(i) })
    }
    libro.verificar()
    // El total vivo tiene que ser exactamente la suma del diario, y la suma se
    // hace acá afuera: si el test le preguntara al libro, estaría de acuerdo
    // consigo mismo.
    let suma = 0
    for (const c of libro.cobros()) suma += c.milicalorias
    let vivo = 0
    for (const c of libro.chunks()) vivo += c.aportado
    expect(vivo).toBe(suma)
    expect(suma).toBe(25 * 3040)
    expect(libro.chunks().length).toBe(5)
  })

  it('un cobro imposible no entra ni por la puerta de atrás', () => {
    const libro = new LibroCalorico(SEMILLA)
    const base = { cx: 0, cy: 0, substance: 'pescado' as SubstanceId, masa: fx(1), at: seg(0) }
    expect(() => libro.cobrar({ ...base, milicalorias: -1 })).toThrow(RangeError)
    expect(() => libro.cobrar({ ...base, milicalorias: 1.5 })).toThrow(RangeError)
    expect(() => libro.cobrar({ ...base, milicalorias: Number.NaN })).toThrow(RangeError)
    expect(() => libro.cobrar({ ...base, milicalorias: Number.POSITIVE_INFINITY })).toThrow(RangeError)
    // Y un chunk que no se puede nombrar no puede pagar nada.
    expect(() => libro.cobrar({ ...base, cx: 1.5, milicalorias: 0 })).toThrow(RangeError)
  })

  it('lo cobrado sobrevive al guardado: cargar la partida no le devuelve el techo a nadie', () => {
    // Sin esto, guardar y cargar sería la fuente infinita por la puerta de atrás:
    // cada carga le devolvería a cada chunk su techo entero.
    const libro = new LibroCalorico(SEMILLA)
    for (let i = 0; i < 10; i++) {
      libro.cobrar({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: 3040, at: seg(i) })
    }
    const cargado = new LibroCalorico(SEMILLA, libro.cobros())
    expect(cargado.aportado(0, 0)).toBe(libro.aportado(0, 0))
    expect(cargado.fingerprint()).toBe(libro.fingerprint())
    cargado.verificar()
    // Y un guardado corrupto —más cobros de los que el techo aguanta— no carga:
    // se entera al abrir la partida y no mil ticks después.
    const demas = [...libro.cobros()]
    for (let i = 0; i < 2000; i++) {
      demas.push({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: 3040, at: seg(i) })
    }
    expect(() => new LibroCalorico(SEMILLA, demas)).toThrow(InvariantError)
  })

  it('la huella no depende del orden en que se cobró', () => {
    const cobros = []
    for (let i = 0; i < 30; i++) {
      cobros.push({ cx: i % 7, cy: i % 3, substance: 'pescado' as SubstanceId, masa: fx(1), milicalorias: 3040, at: seg(i) })
    }
    const a = new LibroCalorico(SEMILLA, cobros)
    const b = new LibroCalorico(SEMILLA, [...cobros].reverse())
    expect(b.fingerprint()).toBe(a.fingerprint())
  })
})

// ─── 3. `draw` no entrega lo que no puede cobrar ────────────────────────────

describe('`draw` cobra, y no entrega lo que no puede pagar', () => {
  function pozo(p: Partial<Stock> = {}): Stock {
    return crearStock({
      id: 'pozo',
      yields: 'pescado',
      cx: 0,
      cy: 0,
      masaPorUnidad: fx(1),
      capacity: 100,
      perMillePorSegundo: 0,
      depth: fx(2),
      atSecond: seg(0),
      amount: 100,
      ...p,
    })
  }

  it('lo que sale tiene masa, y lo que el chunk paga es esa masa', () => {
    const libro = new LibroCalorico(SEMILLA)
    const w: MundoConDado = { phys: PHYS, rng: SUERTE_PERFECTA, calorias: libro }
    const r = draw(w, pozo({ masaPorUnidad: fx(2) }), CAÑA, seg(0))
    expect(r.razon).toBe('saco')
    expect(r.yields).toBe('pescado')
    expect(unfx(r.masa)).toBe(2)
    expect(r.milicalorias).toBe(milicaloriasDe('pescado', fx(2), PHYS))
    expect(libro.aportado(0, 0)).toBe(r.milicalorias)
    // Y el cobro quedó escrito con lo que salió: la crónica puede contar qué dio
    // este pozo sin volver a preguntarle a nadie.
    expect(libro.cobros()).toEqual([
      { cx: 0, cy: 0, substance: 'pescado', masa: fx(2), milicalorias: r.milicalorias, at: seg(0) },
    ])
  })

  it('con el chunk exprimido NO se tira el dado: es el mismo argumento que el pozo vacío', () => {
    const libro = new LibroCalorico(SEMILLA)
    libro.cobrar({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: libro.techo(0, 0), at: seg(0) })
    let tiradas = 0
    const w: MundoConDado = {
      phys: PHYS,
      rng: ((): number => {
        tiradas++
        return 0
      }) as WorldRng,
      calorias: libro,
    }
    const r = draw(w, pozo(), CAÑA, seg(1))
    expect(r.razon).toBe('sin-presupuesto')
    expect(r.yields).toBeNull()
    expect(r.tiro).toBe(false)
    expect(tiradas).toBe(0)
  })

  it('y el stock NO baja cuando el presupuesto no alcanza: lo que no salió sigue adentro', () => {
    const libro = new LibroCalorico(SEMILLA)
    libro.cobrar({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: libro.techo(0, 0), at: seg(0) })
    const w: MundoConDado = { phys: PHYS, rng: SUERTE_PERFECTA, calorias: libro }
    const s = pozo()
    draw(w, s, CAÑA, seg(1))
    expect(s.amount).toBe(100)
    expect(s.atSecond).toBe(seg(0))
  })

  it('lo que no alimenta no compite: un pozo de arcilla nunca se queda sin presupuesto', () => {
    const libro = new LibroCalorico(SEMILLA)
    // El chunk ya entregó todo lo que puede en calorías.
    libro.cobrar({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: libro.techo(0, 0), at: seg(0) })
    const w: MundoConDado = { phys: PHYS, rng: SUERTE_PERFECTA, calorias: libro }
    const barro = pozo({ id: 'barro', yields: 'arcilla' })
    const r = draw(w, barro, CAÑA, seg(1))
    expect(r.razon).toBe('saco')
    expect(r.yields).toBe('arcilla')
    expect(r.milicalorias).toBe(0)
    libro.verificar()
  })

  it('dos chunks, dos presupuestos: exprimir uno no toca al otro', () => {
    const libro = new LibroCalorico(SEMILLA)
    const w: MundoConDado = { phys: PHYS, rng: SUERTE_PERFECTA, calorias: libro }
    const aca = pozo({ id: 'a', cx: 0, cy: 0 })
    const alla = pozo({ id: 'b', cx: 1, cy: 0 })
    libro.cobrar({ cx: 0, cy: 0, substance: 'pescado', masa: fx(1), milicalorias: libro.techo(0, 0), at: seg(0) })
    expect(draw(w, aca, CAÑA, seg(1)).razon).toBe('sin-presupuesto')
    expect(draw(w, alla, CAÑA, seg(1)).razon).toBe('saco')
  })

  it('un stock que no se puede cobrar no se puede ni fabricar', () => {
    // La masa por unidad es de lo que sale la cuenta de calorías. Sin cota, el
    // techo se saltaría escribiendo un número grande y no habría nada que se
    // quejara — el mismo agujero con otra ropa.
    expect(() => pozo({ masaPorUnidad: fx(0) })).toThrow(/masa por unidad/)
    expect(() => pozo({ masaPorUnidad: -1 as never })).toThrow(/masa por unidad/)
    expect(() => pozo({ masaPorUnidad: (MASA_MAXIMA_DE_UNA_PIEZA + 1) as never })).toThrow(/masa por unidad/)
    expect(() => pozo({ cx: 0.5 })).toThrow(RangeError)
  })
})

// ─── 4. EL TEST ECONÓMICO ───────────────────────────────────────────────────
//
// Cien partidas de 20.000 ticks (1000 segundos de mundo a 20 Hz). La criatura no
// hace más que caminar y sacar: no cocina, no prende fuego, no construye nada.
// **Sin trabajo.**
//
// Se juegan DOS variantes de las cien, porque dicen cosas distintas:
//
//   · **afortunada** — el dado del mundo siempre dice que picó, y el pozo es el
//     más generoso que el paquete deja escribir (capacidad y reposición en su
//     máximo). Es el pozo que el oráculo pediría si pudiera escribir números, o
//     sea el ataque del riesgo 4 en su forma más pura. Es la COTA SUPERIOR de lo
//     que el mundo puede dar.
//   · **común** — un dado del mundo de verdad y el arroyo modesto que usan los
//     demás tests (capacidad 12, medio pez por segundo). Es lo que una criatura
//     se encuentra.
//
// ─── De dónde sale cada número del modelo, que es la mitad del test ─────────
//
// Ninguno se inventa. Los del proceso salen de `@anima/physics` leídos en tiempo
// de ejecución; los tres de la economía —cuánto cuesta estar vivo, cuánto cuesta
// un paso y cuánto rinde una caloría— viven en `@anima/world`, y **este paquete
// no puede importarlos**: la flecha va del mundo al dios y en los dos sentidos
// sería un ciclo de paquetes (es la misma razón por la que `CELDAS_DE_LADO` está
// escrito dos veces). Están copiados acá con su ruta y su valor, y **hay un test
// que compara la copia contra el archivo**: una constante copiada sin un test
// que la vigile es exactamente cómo divergió `DSL_REFERENCE` en Ánima I.

const PARTIDAS = 100
const TICKS = 20_000
const HZ = HZ_DE_REFERENCIA
const DT = dtDeFrecuencia(HZ)
/** 20.000 ticks a 20 Hz son 1000 segundos de mundo (ADR II-0008). */
const SEGUNDOS_DE_PARTIDA = TICKS / HZ

/** Cuántos segundos de mundo cuesta un intento de extracción. Del proceso, no
 *  de acá: `EXTRACCION.completion.at`. Un proceso sin `completion` corre para
 *  siempre y no se podría cronometrar; que eso lance es la única respuesta
 *  honesta, porque el modelo económico entero se apoya en ese número. */
const SEGUNDOS_POR_INTENTO = ((): number => {
  const c = EXTRACCION.completion
  if (c === undefined) throw new Error('`extraccion` no declara `completion`: no se puede cronometrar un intento')
  return c.at
})()
const TICKS_POR_INTENTO = Math.round(SEGUNDOS_POR_INTENTO * HZ)

// ─── Las tres constantes copiadas de `@anima/world/src/step.ts` ─────────────

/** `COSTO_VIVIR`: lo que cuesta estar vivo UN TICK. «El motor de la historia». */
const COSTO_VIVIR_POR_TICK = 0.01
/** `COSTO_PASO`: lo que cuesta caminar una celda. */
const COSTO_PASO = 0.05
/**
 * `STAMINA_POR_CALORIA`: cuánto rinde una caloría comida.
 *
 * Es **1**, y el mundo lo explica con un argumento que hay que respetar acá:
 * `calories = nutrition × mass × digestibility` y la digestibilidad ya tiene
 * techo 0,95, así que la conversión **ya paga su ineficiencia adentro**. Poner
 * acá la eficiencia 0,35 del `poweredBy` de `friccion` sería cobrarla dos veces.
 */
const STAMINA_POR_CALORIA = 1

/**
 * Vivir un segundo, a la frecuencia de referencia.
 *
 * **Y acá hay un hueco abierto que no es de este archivo**: `COSTO_VIVIR` es por
 * TICK y no por segundo, así que el hambre llega cinco veces antes a 50 Hz que a
 * 10. Está medido y anotado como `it.fails` en
 * `@anima/world/tests/el-tiempo-no-depende-del-tick.test.ts`. Mientras siga
 * abierto, «energía neta» sólo quiere decir algo a una frecuencia fija, y por
 * eso todo este bloque se juega a 20 Hz y lo dice.
 */
const COSTO_VIVIR_POR_SEGUNDO = COSTO_VIVIR_POR_TICK * HZ

/**
 * **La perilla que sí es de acá**: cuánto pesa una pieza.
 *
 * Un pescado de 2 kg crudo son `8 × 2 × 0,38` = 6,08 calorías, y a 1 stamina por
 * caloría son 6,08 de trabajo. Cocinado —digestibilidad al techo de la ley 5—
 * son 15,2. El mismo bicho, dos economías: eso es lo que cocinar compra, y no
 * hay que escribirlo en ningún lado porque sale de `digestibility`.
 */
const MASA_DE_UNA_PIEZA = fx(2)

/** Las calorías que una pieza le da a quien se la come, CRUDA o COCINADA. Las
 *  dos por la misma cualidad derivada de la física; lo único que cambia es la
 *  digestibilidad, que es lo único que cocinar mueve. */
function caloriasDelBocado(substance: SubstanceId, masa: Fixed, digestibility?: number): number {
  const bocado: Body = {
    id: 'bocado',
    form: 'bloque',
    parts: [{ substance, mass: unfx(masa), q: digestibility === undefined ? {} : { digestibility } }],
    joints: [],
    state: {},
  }
  return qualityOf(bocado, 'calories', PHYS)
}

// ─── La partida ─────────────────────────────────────────────────────────────

type Variante = 'afortunada' | 'comun'

interface Partida {
  readonly seed: bigint
  readonly piezas: number
  readonly intentos: number
  readonly chunksVisitados: number
  readonly chunksExprimidos: number
  readonly celdasCaminadas: number
  /** Calorías que salieron del mundo, leídas del libro y no recalculadas. */
  readonly caloriasCobradas: number
  readonly techoDeLoVisitado: number
  readonly ingresoCrudo: number
  readonly ingresoCocinado: number
  readonly costo: number
  readonly netoCrudo: number
  readonly libro: LibroCalorico
}

/**
 * La orilla siguiente a partir de un chunk, caminando.
 *
 * El camino NO es una fila recta: los biomas tienen período 64 chunks, así que
 * una fila puede caer entera adentro de una franja seca y una semilla perfecta
 * parecería un mundo sin agua (pasó: la semilla 20260778 no tiene una sola
 * orilla en 500 chunks de la fila 0). El zigzag cruza las franjas.
 *
 * `null` es un mundo sin agua a la vista, y eso no se simula: se dice.
 */
function siguienteOrilla(seed: bigint, desde: number): ChunkDecretado | null {
  for (let k = desde; k < desde + 500; k++) {
    const c = decretarChunk(seed, k, ((k * 37) % 81) - 40, SEED_PROCESSES, PHYS)
    if (c.orilla !== null) return c
  }
  return null
}

/** Cuántas celdas hay de una orilla a la otra, en la distancia del mundo. */
function celdasEntre(a: ChunkDecretado, b: ChunkDecretado): number {
  const dx = Math.abs(a.cx - b.cx) * 16
  const dy = Math.abs(a.cy - b.cy) * 16
  return dx > dy ? dx : dy
}

function pozoDelChunk(c: ChunkDecretado, t: Duracion, v: Variante): Stock {
  const generoso = v === 'afortunada'
  return crearStock({
    id: `pozo:${String(c.cx)}:${String(c.cy)}`,
    yields: 'pescado',
    cx: c.cx,
    cy: c.cy,
    masaPorUnidad: MASA_DE_UNA_PIEZA,
    // El pozo que el oráculo pediría, contra el arroyo de los demás tests.
    capacity: generoso ? CAPACIDAD_MAXIMA : 12,
    perMillePorSegundo: generoso ? PER_MILLE_MAXIMO : 500,
    depth: fx(2),
    atSecond: t,
    amount: generoso ? CAPACIDAD_MAXIMA : 12,
  })
}

function jugar(seed: bigint, v: Variante): Partida {
  const libro = new LibroCalorico(seed)
  // La afortunada tiene el mejor dado posible (siempre pica); la común, uno de
  // verdad, derivado de la semilla de su partida.
  const base = mulberry32(Number(seed % 2147483647n))
  const rng = (v === 'afortunada' ? (): number => 0 : (): number => base()) as WorldRng
  const w: MundoConDado = { phys: PHYS, rng, calorias: libro }

  let chunk = siguienteOrilla(seed, 0)
  if (chunk === null) throw new Error(`la semilla ${String(seed)} no tiene una sola orilla en 500 chunks`)
  const visitados = [chunk]
  let exprimidos = 0
  let caminadas = 0
  let t = seg(0)
  let stock = pozoDelChunk(chunk, t, v)
  let piezas = 0
  let intentos = 0
  let crudo = 0
  let cocinado = 0

  for (let tick = 1; tick <= TICKS; tick++) {
    t = sumarPaso(t, DT)
    if (tick % TICKS_POR_INTENTO !== 0) continue
    intentos++
    const r = draw(w, stock, CAÑA, t)
    if (r.razon === 'sin-presupuesto') {
      // El ataque del riesgo 4, hecho a propósito: caminar al chunk siguiente en
      // cuanto éste no da más. Se paga el camino, con la constante del mundo.
      exprimidos++
      const siguiente = siguienteOrilla(seed, chunk.cx + 1)
      if (siguiente === null) break
      caminadas += celdasEntre(chunk, siguiente)
      chunk = siguiente
      visitados.push(chunk)
      stock = pozoDelChunk(chunk, t, v)
      continue
    }
    if (r.yields === null) continue
    piezas++
    crudo += caloriasDelBocado(r.yields, r.masa)
    cocinado += caloriasDelBocado(r.yields, r.masa, DIGESTIBILIDAD_TECHO)
  }

  libro.verificar()
  const costo = COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA + caminadas * COSTO_PASO
  let techoDeLoVisitado = 0
  for (const c of visitados) techoDeLoVisitado += c.presupuestoCalorico
  let cobrado = 0
  for (const c of libro.chunks()) cobrado += c.aportado
  return {
    seed,
    piezas,
    intentos,
    chunksVisitados: visitados.length,
    chunksExprimidos: exprimidos,
    celdasCaminadas: caminadas,
    caloriasCobradas: cobrado / MILICALORIAS_POR_CALORIA,
    techoDeLoVisitado,
    ingresoCrudo: crudo * STAMINA_POR_CALORIA,
    ingresoCocinado: cocinado * STAMINA_POR_CALORIA,
    costo,
    netoCrudo: crudo * STAMINA_POR_CALORIA - costo,
    libro,
  }
}

interface Resumen {
  readonly piezas: number
  readonly intentos: number
  readonly visitados: number
  readonly exprimidos: number
  readonly caminadas: number
  readonly cal: number
  readonly techo: number
  readonly ingreso: number
  readonly costo: number
  readonly neto: number
}

function resumir(ps: readonly Partida[]): Resumen {
  return ps.reduce<Resumen>(
    (a, p) => ({
      piezas: a.piezas + p.piezas,
      intentos: a.intentos + p.intentos,
      visitados: a.visitados + p.chunksVisitados,
      exprimidos: a.exprimidos + p.chunksExprimidos,
      caminadas: a.caminadas + p.celdasCaminadas,
      cal: a.cal + p.caloriasCobradas,
      techo: a.techo + p.techoDeLoVisitado,
      ingreso: a.ingreso + p.ingresoCrudo,
      costo: a.costo + p.costo,
      neto: a.neto + p.netoCrudo,
    }),
    { piezas: 0, intentos: 0, visitados: 0, exprimidos: 0, caminadas: 0, cal: 0, techo: 0, ingreso: 0, costo: 0, neto: 0 },
  )
}

const AFORTUNADAS: Partida[] = []
const COMUNES: Partida[] = []
for (let i = 0; i < PARTIDAS; i++) {
  AFORTUNADAS.push(jugar(SEMILLA + BigInt(i), 'afortunada'))
  COMUNES.push(jugar(SEMILLA + BigInt(i), 'comun'))
}

const VARIANTES = [
  ['afortunada', AFORTUNADAS],
  ['común', COMUNES],
] as const

describe('el test económico: 100 partidas de 20.000 ticks', () => {
  it('las cien partidas corren a la escala que pide el documento, y dan los números', () => {
    for (const [nombre, ps] of VARIANTES) {
      const r = resumir(ps)
      console.log(
        `económico · ${String(PARTIDAS)} partidas × ${String(TICKS)} ticks a ${String(HZ)} Hz = ${String(SEGUNDOS_DE_PARTIDA)} s de mundo · criatura ${nombre}\n` +
          `económico ·   ${String(r.intentos)} intentos → ${String(r.piezas)} piezas · ${String(r.visitados)} chunks pisados (${String(r.exprimidos)} exprimidos) · ${String(r.caminadas)} celdas caminadas\n` +
          `económico ·   ${r.cal.toFixed(0)} cal salieron del mundo contra ${String(r.techo)} de techo en lo pisado (${((r.cal / r.techo) * 100).toFixed(1)}%)\n` +
          `económico ·   por partida: ingreso ${(r.ingreso / PARTIDAS).toFixed(1)} · costo ${(r.costo / PARTIDAS).toFixed(1)} · NETO ${(r.neto / PARTIDAS).toFixed(1)} de stamina`,
      )
      expect(r.intentos).toBe(PARTIDAS * Math.floor(TICKS / TICKS_POR_INTENTO))
      expect(r.piezas).toBeGreaterThan(0)
    }
  })

  it.fails('SIGUE ABIERTO · la energía neta acumulada tendría que ser NEGATIVA sin trabajo', () => {
    // ─── El criterio del documento, medido, y NO se cumple ─────────────────
    //
    //   «un test económico de 100 partidas de 20.000 ticks donde la energía neta
    //    acumulada de la criatura tiene que ser **negativa sin trabajo**»
    //
    // Corre a la escala pedida y el resultado es que **da positiva, y por mucho**,
    // en las dos variantes: una criatura que no hace más que sacar y comer crudo
    // termina las cien partidas con energía de sobra.
    //
    // ─── Y el techo NO es lo que falla ─────────────────────────────────────
    //
    // Esto es lo importante para quien lea el número. El techo calórico existe,
    // se cobra y se respeta: en las doscientas partidas ningún chunk pasó su
    // presupuesto (test de más abajo) y las afortunadas lo tocan al 100%. Lo que
    // falla es la CALIBRACIÓN, y se ve en una división:
    //
    //   · un chunk de bioma acuático da del orden de 1800 calorías, y a
    //     `STAMINA_POR_CALORIA = 1` son 1800 de stamina;
    //   · vivir los 1000 segundos de la partida cuesta
    //     `COSTO_VIVIR (0,01/tick) × 20 Hz × 1000 s` = **200 de stamina**.
    //
    // O sea que **un solo chunk paga nueve vidas enteras**. Ninguna cota sobre
    // cuánto da un lugar puede hacer negativo un balance donde un lugar da nueve
    // veces lo que cuesta vivir; lo que hay que mover es la perilla, y el número
    // exacto está en el test de abajo.
    //
    // QUÉ HARÍA FALTA PARA CERRARLO: subir `COSTO_VIVIR` (o bajar lo que rinde
    // una pieza) hasta el punto de equilibrio medido, y volver a correr esto. Es
    // una decisión de diseño con un ADR, no un arreglo: el documento ya lo dice
    // como residual honesto del riesgo 4 —«el balance de la regeneración es una
    // perilla de diseño, no una consecuencia física»—, y elegir ese número acá
    // adentro sería calibrar el mundo desde un test.
    for (const p of [...AFORTUNADAS, ...COMUNES]) expect(p.netoCrudo).toBeLessThan(0)
  })

  it('el punto de equilibrio, medido: cuánto tendría que costar vivir para que el hambre duela', () => {
    // El número accionable. Por variante: el costo de vivir por segundo que
    // dejaría en cero a la partida que MÁS comió, o sea el que haría negativas a
    // las cien.
    for (const [nombre, ps] of VARIANTES) {
      let equilibrio = 0
      for (const p of ps) {
        // ingreso = costoPorSegundo × 1000 + caminata  ⟹  el corte
        const corte = (p.ingresoCrudo - p.celdasCaminadas * COSTO_PASO) / SEGUNDOS_DE_PARTIDA
        if (corte > equilibrio) equilibrio = corte
      }
      console.log(
        `económico · criatura ${nombre}: hoy vivir cuesta ${COSTO_VIVIR_POR_SEGUNDO.toFixed(2)}/s (COSTO_VIVIR ${String(COSTO_VIVIR_POR_TICK)} × ${String(HZ)} Hz). ` +
          `Para que las cien den negativo haría falta ${equilibrio.toFixed(2)}/s: ${(equilibrio / COSTO_VIVIR_POR_SEGUNDO).toFixed(1)}× más ` +
          `(COSTO_VIVIR ≈ ${(equilibrio / HZ).toFixed(3)} por tick a ${String(HZ)} Hz)`,
      )
      expect(equilibrio).toBeGreaterThan(COSTO_VIVIR_POR_SEGUNDO)
    }
    // Y la otra mitad de la perilla, que es la que el documento prefiere: cocinar
    // multiplica lo que rinde el mismo bicho, sin crear ni un gramo de materia.
    const crudo = resumir(AFORTUNADAS).ingreso
    const cocinado = AFORTUNADAS.reduce((a, p) => a + p.ingresoCocinado, 0)
    console.log(
      `económico · cocinar multiplica lo que rinde la MISMA materia por ${(cocinado / crudo).toFixed(2)}× (digestibilidad al techo ${String(DIGESTIBILIDAD_TECHO)} contra la cruda)`,
    )
    expect(cocinado / crudo).toBeGreaterThan(2)
  })

  it('EL INVARIANTE: ningún chunk pasó su techo, en ninguna de las doscientas partidas', () => {
    // Ésta es la parte que SÍ se cumple, y es la que faltaba en el paquete. El
    // techo se **recalcula desde la semilla** con la función pura, sin
    // preguntarle al libro: si el juez fuera el propio libro, estaría de acuerdo
    // consigo mismo y con nadie.
    let chunks = 0
    let alTope = 0
    let peorRelacion = 0
    for (const p of [...AFORTUNADAS, ...COMUNES]) {
      p.libro.verificar()
      const cobrados = p.libro.chunks()
      expect(cobrados.length).toBeGreaterThan(0)
      for (const c of cobrados) {
        const techo = presupuestoCaloricoDeChunk(p.seed, c.cx, c.cy) * MILICALORIAS_POR_CALORIA
        expect(c.techo).toBe(techo)
        expect(c.aportado).toBeLessThanOrEqual(techo)
        if (c.aportado / techo > peorRelacion) peorRelacion = c.aportado / techo
        chunks++
      }
      if (p.chunksExprimidos > 0) alTope++
    }
    console.log(
      `económico · ${String(chunks)} chunks cobrados en las 200 partidas · el más exprimido llegó al ${(peorRelacion * 100).toFixed(2)}% de su techo · ${String(alTope)} partidas tocaron el techo`,
    )
    expect(peorRelacion).toBeLessThanOrEqual(1)
    // Y el techo se tocó de verdad: un invariante que nunca se acerca a su cota
    // no está probando que la cota funcione.
    expect(peorRelacion).toBeGreaterThan(0.99)
    expect(alTope).toBeGreaterThanOrEqual(PARTIDAS)
  })

  it('la partida es reproducible: rejugarla da exactamente lo mismo', () => {
    // Cinco y no cien: lo que se prueba es que `jugar` no arrastra estado, y eso
    // no se prueba más fuerte repitiéndolo noventa y cinco veces más caro.
    for (const p of AFORTUNADAS.slice(0, 5)) {
      const otra = jugar(p.seed, 'afortunada')
      expect(otra.piezas).toBe(p.piezas)
      expect(otra.caloriasCobradas).toBe(p.caloriasCobradas)
      expect(otra.chunksVisitados).toBe(p.chunksVisitados)
      expect(otra.libro.fingerprint()).toBe(p.libro.fingerprint())
    }
  })

  it('SIN el techo, el mismo pozo entrega varias veces lo que el lugar puede dar', () => {
    // La contraprueba, y es la que dice que el agujero era real. Se saca por la
    // puerta de atrás —`retirarUno`, la contabilidad del dios sin la puerta de
    // `draw`— que es exactamente lo que hacía el paquete antes de este arreglo.
    let sinTecho = 0
    let techos = 0
    for (let i = 0; i < PARTIDAS; i++) {
      const seed = SEMILLA + BigInt(i)
      const chunk = siguienteOrilla(seed, 0)
      if (chunk === null) continue
      techos += chunk.presupuestoCalorico
      const stock = pozoDelChunk(chunk, seg(0), 'afortunada')
      let t = seg(0)
      for (let tick = 1; tick <= TICKS; tick++) {
        t = sumarPaso(t, DT)
        if (tick % TICKS_POR_INTENTO !== 0) continue
        if (retirarUno(stock, t) !== null) sinTecho += caloriasDelBocado('pescado', MASA_DE_UNA_PIEZA)
      }
    }
    console.log(
      `económico · SIN techo, un solo chunk por partida entrega ${sinTecho.toFixed(0)} cal contra ${String(techos)} de techo: ` +
        `${(sinTecho / techos).toFixed(1)}× lo que el lugar puede dar`,
    )
    expect(sinTecho / techos).toBeGreaterThan(1)
  })

  it('las tres constantes copiadas de `@anima/world` siguen diciendo lo que dicen acá', () => {
    // El guardián de la copia. `@anima/oracle` no puede importar `@anima/world`
    // —sería el ciclo de paquetes que toda la arquitectura evita—, así que estos
    // tres números están copiados; y una constante copiada sin un test que la
    // vigile es exactamente cómo divergió `DSL_REFERENCE` en Ánima I. Se lee el
    // ARCHIVO, que no es un import y no crea ninguna dependencia de build.
    const step = fileURLToPath(new URL('../../world/src/step.ts', import.meta.url))
    const fuente = readFileSync(step, 'utf8')
    const valorDe = (nombre: string): number => {
      const m = new RegExp(`export const ${nombre} = ([0-9.]+)`).exec(fuente)
      if (m === null) {
        throw new Error(`«${nombre}» ya no está en ${step}: el modelo económico de este test quedó viejo`)
      }
      return Number(m[1])
    }
    expect(valorDe('COSTO_VIVIR')).toBe(COSTO_VIVIR_POR_TICK)
    expect(valorDe('COSTO_PASO')).toBe(COSTO_PASO)
    expect(valorDe('STAMINA_POR_CALORIA')).toBe(STAMINA_POR_CALORIA)
  })
})
