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
// La única excepción está marcada como tal y es `MASA_DE_UNA_PIEZA`: **la física
// semilla no dice cuánto pesa un pescado** —los pozos los escribe el dios— así
// que ese número es una perilla de acá, y está declarada como perilla.
//
// Los tres de la economía viven en `@anima/world`, están copiados abajo y hay un
// guardián que compara la copia contra el archivo. Y hay un lazo que conviene
// decir en voz alta antes de que alguien lo descubra solo: desde el ADR II-0009
// `COSTO_VIVIR_POR_SEGUNDO` vale 1,0, y ese número se eligió mirando mediciones
// de este archivo. Por eso ningún test de acá dice `COSTO_VIVIR_POR_SEGUNDO === 1`:
// estaría midiendo su propia copia y no diría nada.
//
// **Y OJO CON LA PALABRA «VENTANA», que este archivo usó mal durante un tramo.**
// El ADR II-0009 escribió que el 1,0 vive adentro de una ventana `(0,766 ; 1,155)`
// donde pasan dos cosas a la vez —comer crudo da negativo y cocinar da positivo—.
// Esa ventana **es un conjunto vacío**, y está medido en los bloques 5 y 6 del
// final: con el precio del fuego adentro, para que cocinar alcance haría falta
// 0,494 por segundo, y a 0,766 ya alcanza comer crudo. Los dos bordes se cruzan.
// Lo que este archivo afirma es lo medido y no la ventana: que **sin trabajo la
// energía neta es negativa** (el criterio del riesgo 4, bloque 4) y que **cocinar
// se paga solo** (bloque 5), que son dos hechos y no un intervalo.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Body, Duracion, Fixed, Physics, SubstanceId } from '@anima/physics'
import {
  buildSeedPhysics,
  CARBONIZADO_QUE_TRANSMUTA,
  DIGESTIBILIDAD_TECHO,
  dtDeFrecuencia,
  EXTRACCION,
  FRICCION,
  fx,
  HZ_DE_REFERENCIA,
  porPaso,
  qualityOf,
  SEED_PROCESSES,
  seg,
  specOf,
  sumarPaso,
  T_AMBIENTE,
  unfx,
  unir,
} from '@anima/physics'

import type { ChunkDecretado, MundoConDado, Stock, WorldRng } from '../src/index.js'
import {
  BIOMAS,
  CAPACIDAD_MAXIMA,
  caloricBudget,
  CELDAS_DE_LADO,
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
// Cien partidas de 20.000 ticks (1000 segundos de mundo a 20 Hz). Se juegan TRES
// variantes de las cien, porque dicen cosas distintas:
//
//   · **afortunada** — el dado del mundo siempre dice que picó, y el pozo es el
//     más generoso que el paquete deja escribir (capacidad y reposición en su
//     máximo). Es el pozo que el oráculo pediría si pudiera escribir números, o
//     sea el ataque del riesgo 4 en su forma más pura. Es la COTA SUPERIOR de lo
//     que el mundo puede dar.
//   · **común** — un dado del mundo de verdad y el arroyo modesto que usan los
//     demás tests (capacidad 12, medio pez por segundo). Es lo que una criatura
//     se encuentra.
//   · **sin trabajo** — la que contesta el criterio del riesgo 4 con sus palabras.
//     Las otras dos **trabajan**: tienen una caña y sacan del agua. Ésta no extrae
//     nada: camina y levanta lo que el mundo dejó tirado. Vive más abajo en este
//     archivo, con `carronear`, porque su modelo no comparte una línea con las
//     otras dos — y esa diferencia es todo el punto.
//
// (Durante un tramo el `it` que decía «sin trabajo» medía la común, o sea una
// criatura con caña. El nombre era falso y el criterio no lo medía nadie.)
//
// ─── De dónde sale cada número del modelo, que es la mitad del test ─────────
//
// Ninguno se inventa. Los del proceso salen de `@anima/physics` leídos en tiempo
// de ejecución; los tres de la economía —cuánto cuesta estar vivo UN SEGUNDO,
// cuánto cuesta entrar en UNA CELDA y cuánto rinde una caloría— viven en
// `@anima/world`, y **este paquete no puede importarlos**: la flecha va del mundo
// al dios y en los dos sentidos sería un ciclo de paquetes (es la misma razón por
// la que `CELDAS_DE_LADO` está escrito dos veces). Están copiados acá con su
// ruta, su valor **y su unidad**, y **hay un test que compara la copia contra el
// archivo**: una constante copiada sin un test que la vigile es exactamente cómo
// divergió `DSL_REFERENCE` en Ánima I.
//
// Las mayúsculas de «UN SEGUNDO» y «UNA CELDA» no son énfasis: son las dos
// unidades distintas del ADR II-0009, y confundirlas es un error de un factor de
// `hz` que ningún número delata solo.

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
//
// Y no son tres números: son tres números **con unidad**, y la unidad es la mitad
// de lo que hay que copiar bien. El ADR II-0009 renombró dos justamente para que
// la unidad viaje en el nombre, y el guardián del final las verifica de las dos
// maneras: el valor, y el LUGAR del que el mundo las cobra —una pasa por
// `porPaso` y la otra no puede pasar nunca—.

/**
 * `COSTO_VIVIR_POR_SEGUNDO`: lo que cuesta estar vivo UN SEGUNDO DE MUNDO. «El
 * motor de la historia».
 *
 * **Es una TASA POR SEGUNDO**, y por eso el mundo la aplica con
 * `porPaso(…, d.dt)` (ADR II-0009). Acá se multiplica por los SEGUNDOS de la
 * partida y no por sus ticks, que es la diferencia entera: antes esto era
 * `COSTO_VIVIR = 0,01` por tick, los 1000 segundos costaban 200 a 20 Hz y 1000 a
 * 100 Hz, y «energía neta» sólo quería decir algo a una frecuencia fija. Ahora
 * cuesta 1000 a las cinco.
 */
const COSTO_VIVIR_POR_SEGUNDO = 1.0

/**
 * `COSTO_POR_CELDA`: lo que cuesta entrar en UNA CELDA.
 *
 * **NO es una tasa**, y por eso no se divide ni se multiplica por ningún tiempo:
 * sus unidades son stamina POR CELDA. El valor no se movió con el ADR II-0009
 * —sigue siendo el mismo 0,05 de siempre—; lo que se movió es el nombre, para que
 * nadie lo trate como las otras. Dividirlo por la frecuencia haría que el mismo
 * viaje de diez celdas saliera 5× más barato a 100 Hz que a 20.
 */
const COSTO_POR_CELDA = 0.05

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

// ─── EL CUARTO NÚMERO DEL MODELO: LO QUE CUESTA EL FUEGO (ADR II-0011) ──────
//
// Hasta el ADR II-0011 este archivo modelaba cocinar como algo GRATIS: multiplicar
// por `DIGESTIBILIDAD_TECHO` y listo. Se podía, porque el fuego duraba un tick y
// no había ninguna aritmética que pudiera cerrar de todos modos. Ahora el fuego
// dura, cocinar es una cosa que pasa de verdad en el mundo, y **tiene precio**.
//
// El precio se despeja acá y NO se copia. Las cinco piezas salen de
// `@anima/physics` leídas en tiempo de ejecución —el `drive` de `friccion`, su
// eficiencia, el punto de ignición de la sustancia, su `heatCapacity` y
// `T_AMBIENTE`— y la sexta es `COSTO_VIVIR_POR_SEGUNDO`, que ya estaba copiada
// arriba con su guardián. Lo único que se copia nuevo es **la forma de la cuenta**
// que el mundo cobra (`aplicarEfectos`, `world/src/step.ts`), y el guardián del
// final la vigila con un regex igual que a las tres constantes.

/** La eficiencia del `poweredBy` de `friccion`, del catálogo y no de acá. */
const EL_DRIVE_DE_FROTAR = ((): { porSegundo: number; efficiency: number } => {
  const e = FRICCION.effects[0]
  if (e === undefined || e.k !== 'drive' || e.poweredBy === undefined) {
    throw new Error('`friccion` cambió de forma: el modelo económico de este archivo quedó viejo')
  }
  return { porSegundo: e.porSegundo, efficiency: e.poweredBy.efficiency }
})()

/**
 * **La segunda perilla de acá, y es una medición ajena**: la vara más barata con
 * la que se puede encender un fuego QUE COCINA.
 *
 * No se puede despejar de la física, y el porqué es todo el punto: que la yesca
 * prenda depende de `emitsPower` —que es `fuelEnergy × masa`— y de la ley 3, o sea
 * de correr el mundo. Este paquete no puede correrlo (`@anima/oracle` no importa
 * `@anima/world`), así que el número viene MEDIDO de
 * `perceive/tests/ataque-a-la-costura.test.ts`, bloque 7, donde está el barrido
 * entero con su tabla:
 *
 *   vara 0,20 kg → 282,17 de stamina · PRENDE a los 2,40 s y **no cocina nada**:
 *                  el pescado sobre la parrilla se queda en `digestibility` 0,3800
 *   vara 0,46 kg → 645,87 · la yesca NO prende, el pescado llega a 0,7461
 *   vara 0,47 kg → 659,86 · yesca a los 3,00 s, leño a los 3,30, pescado COCIDO
 *                  (0,85) a los 6,70 y 0,9500 al final ← el más barato que cocina
 *   vara 0,50 kg → 701,83 · el de la cadena de `world/tests/el-fuego.test.ts`
 *
 * Los 282,17 son los que el `it.fails` de `world/tests/ataque-2-al-fuego.test.ts`
 * (e) usa hoy, y son OPTIMISTAS por un factor de 2,34: ese fuego enciende y no
 * cocina, así que la economía que se apoya en él está comprando algo que no se
 * puede comprar.
 */
const MASA_DE_LA_VARA_QUE_ENCIENDE = 0.47

/**
 * Lo que le cuesta a la criatura llevar una vara de `masa` kg de su sustancia
 * desde el ambiente hasta que prende, en `stamina`.
 *
 * LA FORMA DE LA CUENTA ES DEL MUNDO, y está copiada con su ruta: `aplicarEfectos`
 * cobra `heatCapacity × Δq / eficiencia` por paso, y el paso mueve como mucho
 * `porPaso(porSegundo, dt)` grados. Sumada a lo largo de los pasos que hacen falta
 * para cruzar el punto de ignición, la cuenta telescopia y queda
 * `heatCapacity × ΔT / eficiencia`, con el ΔT del ÚLTIMO PASO ENTERO y no el
 * exacto: el empuje no se puede fraccionar, así que la mano paga hasta
 * `T_AMBIENTE + pasos × porPaso` aunque la ignición esté un poco antes.
 *
 * Y hay que sumarle lo que cuesta estar viva esos segundos, que es la otra mitad
 * de por qué esto vive en el mismo archivo que `COSTO_VIVIR_POR_SEGUNDO`.
 */
function precioDeEncender(masa: number, substance: SubstanceId): { precio: number; termico: number; segundos: number } {
  const vara: Body = { id: 'vara', form: 'vara', parts: [{ substance, mass: masa, q: {} }], joints: [], state: {} }
  const cap = qualityOf(vara, 'heatCapacity', PHYS)
  const ignicion = qualityOf(vara, 'ignitionPoint', PHYS)
  const porGolpe = porPaso(EL_DRIVE_DE_FROTAR.porSegundo, DT)
  const pasos = Math.ceil((ignicion - T_AMBIENTE) / porGolpe)
  const termico = (cap * (pasos * porGolpe)) / EL_DRIVE_DE_FROTAR.efficiency
  const segundos = pasos / HZ
  return { precio: termico + segundos * COSTO_VIVIR_POR_SEGUNDO, termico, segundos }
}

/** El fuego más barato que la criatura puede encender y que además COCINA. */
const PRECIO_DEL_FUEGO = precioDeEncender(MASA_DE_LA_VARA_QUE_ENCIENDE, 'madera')

/** Lo que cocinar le agrega a UNA pieza: la misma materia, la otra digestibilidad. */
const LO_QUE_PAGA_UNA_PIEZA =
  (caloriasDelBocado('pescado', MASA_DE_UNA_PIEZA, DIGESTIBILIDAD_TECHO) -
    caloriasDelBocado('pescado', MASA_DE_UNA_PIEZA)) *
  STAMINA_POR_CALORIA

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
  /** El mismo bicho, la misma materia, la otra economía: lo único que cambia es
   *  `digestibility`. Que este número exista al lado del de arriba es lo que hace
   *  que el criterio del ADR II-0009 sea una VENTANA y no un número. */
  readonly netoCocinado: number
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

/** La distancia del mundo: `intencionCaminar` avanza una celda por tick y admite
 *  la diagonal, así que es Chebyshev y no Manhattan. Es la misma que `celdasEntre`
 *  de acá arriba, dicha para una celda en vez de para un chunk. La usan el
 *  carroñero del bloque 4 y el acarreo de leña del bloque 6. */
function celdasDeCamino(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
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
  // Las dos unidades, una al lado de la otra, que es donde se ve que son
  // distintas: vivir se cobra por SEGUNDO DE MUNDO —de ahí el `× 1000` y no el
  // `× 20.000`— y caminar se cobra POR CELDA, sin que el tiempo entre en la
  // cuenta. Ése es el modelo económico entero del archivo (ADR II-0009).
  const costo = COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA + caminadas * COSTO_POR_CELDA
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
    netoCocinado: cocinado * STAMINA_POR_CALORIA - costo,
    libro,
  }
}

// ─── Las cien, y no el promedio ─────────────────────────────────────────────
//
// El criterio del ADR II-0009 pregunta si **las cien** caen del mismo lado, así
// que el promedio no sirve para contestarlo: una mediana cómoda con una cola que
// cruza el cero es exactamente el caso que el criterio quiere cazar. De acá en
// adelante todo se reporta con mínimo, mediana y máximo.

interface Extremos {
  readonly min: number
  readonly mediana: number
  readonly max: number
}

function extremos(ns: readonly number[]): Extremos {
  const o = [...ns].sort((a, b) => a - b)
  const n = o.length
  if (n === 0) throw new Error('no hay partidas que resumir')
  const mediana = n % 2 === 1 ? (o[(n - 1) / 2] as number) : ((o[n / 2 - 1] as number) + (o[n / 2] as number)) / 2
  return { min: o[0] as number, mediana, max: o[n - 1] as number }
}

/** La tabla de una variante: cinco columnas del modelo económico, cada una con
 *  sus tres números. Sale por consola porque un criterio sin el número medido
 *  adelante es una palabra. */
function tabla(nombre: string, ps: readonly Partida[]): string {
  const fila = (etiqueta: string, f: (p: Partida) => number): string => {
    const e = extremos(ps.map(f))
    return (
      `económico ·   ${etiqueta.padEnd(20)}` +
      `${e.min.toFixed(1).padStart(11)}${e.mediana.toFixed(1).padStart(11)}${e.max.toFixed(1).padStart(11)}`
    )
  }
  return [
    `económico · ${nombre}: las cien partidas, no el promedio`,
    `económico ·   ${''.padEnd(20)}${'mínimo'.padStart(11)}${'mediana'.padStart(11)}${'máximo'.padStart(11)}`,
    fila('ingreso crudo', (p) => p.ingresoCrudo),
    fila('ingreso cocinado', (p) => p.ingresoCocinado),
    fila('costo', (p) => p.costo),
    fila('NETO crudo', (p) => p.netoCrudo),
    fila('NETO cocinado', (p) => p.netoCocinado),
  ].join('\n')
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
  readonly ingresoCocinado: number
  readonly costo: number
  readonly neto: number
  readonly netoCocinado: number
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
      ingresoCocinado: a.ingresoCocinado + p.ingresoCocinado,
      costo: a.costo + p.costo,
      neto: a.neto + p.netoCrudo,
      netoCocinado: a.netoCocinado + p.netoCocinado,
    }),
    {
      piezas: 0,
      intentos: 0,
      visitados: 0,
      exprimidos: 0,
      caminadas: 0,
      cal: 0,
      techo: 0,
      ingreso: 0,
      ingresoCocinado: 0,
      costo: 0,
      neto: 0,
      netoCocinado: 0,
    },
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

// ─── LA CRIATURA QUE NO TRABAJA, que es la que el riesgo 4 pregunta ─────────
//
// El documento de arquitectura pide, textual: «un test económico de 100 partidas
// de 20.000 ticks donde la energía neta acumulada de la criatura tiene que ser
// **negativa sin trabajo**». Las dos variantes de arriba **sí trabajan**: pescan
// con una caña, 594,1 de ingreso crudo por partida la común. Miden otra cosa —una
// cosa útil, y por eso se quedan— pero no ésta.
//
// ─── DÓNDE SE PONE LA LÍNEA DE «SIN TRABAJO», y por qué ahí ────────────────
//
// **Sin trabajo NO es sin comer: es sin EXTRAER.** Una criatura que se queda
// quieta y no come da neto negativo por aritmética —el ingreso es cero— y eso no
// hace falta simularlo cien veces. Sería el criterio contestado con una
// tautología, que es la misma clase de error que «sobrevive 20.000 ticks sola»
// siendo cierto para una piedra.
//
// La línea se pone en la TÉCNICA: no trabaja quien no usa nada que haya tenido
// que hacer. Sin caña, sin pozo, sin `draw`, sin fuego y sin cocinar. Lo único
// que le queda es **caminar y levantar lo que el mundo dejó tirado**, y eso es a
// propósito la versión MÁS GENEROSA de «no trabajar» que se puede escribir:
//
//   · lo suelto es un regalo del dios —lo siembra `scatter` con la fertilidad del
//     chunk— y **no pasa por `LibroCalorico`**: nadie se lo cobra a ningún techo.
//     O sea que es exactamente el agujero que el riesgo 4 describe, con la puerta
//     abierta de par en par;
//   · el carroñero **ve el anillo entero de una** y nunca se equivoca de pieza:
//     camina siempre a lo más cercano que alimenta, sin buscar, sin fallar y sin
//     que se le pudra nada;
//   · y **come de todo lo que tenga calorías**, sea lo que sea, sin asco y sin
//     tener que abrirlo, pelarlo ni partirlo.
//
// Si aun así el balance da negativo en las cien, el dios no es una fuente
// infinita: caminar de chunk en chunk comiendo lo que hay tirado no alcanza, que
// es la frase del riesgo con todas las letras.
//
// ─── LO QUE ESTE MODELO SÍ LE COBRA, y que la afortunada no paga ───────────
//
// **Caminar cuesta TICKS.** Una celda por tick, que es lo que hace hoy
// `intencionCaminar` (y que sea por tick y no por segundo es el hueco 2 del
// ADR II-0009, que este archivo no puede cerrar). Levantar y comer una pieza
// cuesta un tick más. Los 20.000 ticks son el presupuesto entero: el carroñero no
// se teletransporta como la afortunada, y por eso este número no arrastra el
// defecto que mantiene abierto aquel `it.fails`.

/**
 * Con cuánta `stamina` llega la criatura. **Del catálogo y no de acá**: es la
 * mitad del techo de la cualidad (`range: [0, 1000]` en `physics/src/quality.ts`),
 * que es lo que el ADR II-0009 decidió y lo que ya usan `caminarDiezCeldas` y
 * `vivirDiezSegundos`. Arrancar al techo sería tirar la primera comida.
 */
const STAMINA_DE_ARRANQUE = specOf('stamina').range[1] / 2

/** Un bocado tirado en el mundo: dónde está y qué da comido CRUDO. */
interface Bocado {
  readonly x: number
  readonly y: number
  readonly calorias: number
}

/** Lo comestible del anillo `r` de chunks alrededor de uno, en coordenadas de
 *  CELDA, junto con el TECHO calórico de esos chunks. Los dos salen del mismo
 *  `resolveChunk` a propósito: el techo es la vara contra la que se compara lo
 *  que el carroñero se lleva sin que nadie se lo cobre. */
function comidaDelAnillo(seed: bigint, cx: number, cy: number, r: number): { bocados: Bocado[]; techo: number } {
  const bocados: Bocado[] = []
  let techo = 0
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
      const c = resolveChunk(seed, cx + dx, cy + dy)
      techo += c.presupuestoCalorico
      for (const s of c.sueltas) {
        const calorias = caloriasDelBocado(s.substance, s.masa) * STAMINA_POR_CALORIA
        if (calorias <= 0) continue
        bocados.push({
          x: (cx + dx) * CELDAS_DE_LADO + (s.i % CELDAS_DE_LADO),
          y: (cy + dy) * CELDAS_DE_LADO + Math.floor(s.i / CELDAS_DE_LADO),
          calorias,
        })
      }
    }
  }
  return { bocados, techo }
}

interface SinTrabajo {
  readonly seed: bigint
  readonly piezas: number
  readonly celdasCaminadas: number
  readonly anillos: number
  readonly ticksUsados: number
  readonly ingreso: number
  readonly costo: number
  readonly neto: number
  /** El techo calórico de todos los chunks que barrió, para poder decir qué
   *  fracción de lo que el lugar puede dar se llevó por la puerta de atrás. */
  readonly techoDeLoBarrido: number
  /** En qué tick se le acabó la `stamina`, o 0 si llegó viva al final. */
  readonly tickDeLaMuerte: number
}

/** La partida del carroñero: caminar a lo más cercano que alimenta, comerlo
 *  crudo, y así hasta que se acaban los 20.000 ticks. */
function carronear(seed: bigint, base: ChunkDecretado): SinTrabajo {
  const orilla = base.orilla as number
  let pos = {
    x: base.cx * CELDAS_DE_LADO + (orilla % CELDAS_DE_LADO),
    y: base.cy * CELDAS_DE_LADO + Math.floor(orilla / CELDAS_DE_LADO),
  }
  let pool: Bocado[] = []
  let anillo = 0
  let techoDeLoBarrido = 0
  let caminadas = 0
  let piezas = 0
  let ingreso = 0
  let ticks = 0
  // La `stamina` se lleva aparte del neto porque contestan preguntas distintas:
  // el neto dice si el acumulado cierra, y ésta dice CUÁNDO se muere. Un neto
  // negativo con un tanque que nunca llega a cero sería una criatura que termina
  // debiendo y sigue viva, y eso no es lo que el criterio quiere.
  let stamina = STAMINA_DE_ARRANQUE
  let muerte = 0
  const gastar = (x: number): void => {
    stamina -= x
    if (stamina <= 0 && muerte === 0) muerte = ticks
  }
  while (ticks < TICKS && anillo <= 40) {
    if (pool.length === 0) {
      const a = comidaDelAnillo(seed, base.cx, base.cy, anillo)
      pool = a.bocados
      techoDeLoBarrido += a.techo
      anillo++
      continue
    }
    let mejor = 0
    let d = Number.POSITIVE_INFINITY
    for (let k = 0; k < pool.length; k++) {
      const dd = celdasDeCamino(pos, pool[k] as Bocado)
      if (dd < d) {
        d = dd
        mejor = k
      }
    }
    const p = pool.splice(mejor, 1)[0] as Bocado
    // El viaje más el bocado tienen que entrar en lo que queda de partida: media
    // caminata no da media comida.
    if (ticks + d + 1 > TICKS) break
    for (let k = 0; k < d; k++) {
      ticks++
      gastar(COSTO_VIVIR_POR_SEGUNDO / HZ + COSTO_POR_CELDA)
    }
    ticks++
    gastar(COSTO_VIVIR_POR_SEGUNDO / HZ)
    stamina += p.calorias
    caminadas += d
    piezas++
    ingreso += p.calorias
    pos = { x: p.x, y: p.y }
  }
  // Los segundos que sobran también se viven: si se quedó sin adónde ir, sigue
  // gastando hasta que la partida termina.
  while (ticks < TICKS) {
    ticks++
    gastar(COSTO_VIVIR_POR_SEGUNDO / HZ)
  }
  // El mismo modelo económico que las otras dos variantes, con las mismas dos
  // unidades: vivir por SEGUNDO y caminar por CELDA.
  const costo = COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA + caminadas * COSTO_POR_CELDA
  return {
    seed,
    piezas,
    celdasCaminadas: caminadas,
    anillos: anillo,
    ticksUsados: ticks,
    ingreso,
    costo,
    neto: ingreso - costo,
    techoDeLoBarrido,
    tickDeLaMuerte: muerte,
  }
}

const SIN_TRABAJO: SinTrabajo[] = []
for (let i = 0; i < PARTIDAS; i++) {
  const seed = SEMILLA + BigInt(i)
  const base = siguienteOrilla(seed, 0)
  if (base === null) throw new Error(`la semilla ${String(seed)} no tiene una sola orilla en 500 chunks`)
  SIN_TRABAJO.push(carronear(seed, base))
}

describe('el test económico: 100 partidas de 20.000 ticks', () => {
  it('las cien partidas corren a la escala que pide el documento, y dan los números', () => {
    for (const [nombre, ps] of VARIANTES) {
      const r = resumir(ps)
      console.log(
        `económico · ${String(PARTIDAS)} partidas × ${String(TICKS)} ticks a ${String(HZ)} Hz = ${String(SEGUNDOS_DE_PARTIDA)} s de mundo · criatura ${nombre}\n` +
          `económico ·   ${String(r.intentos)} intentos → ${String(r.piezas)} piezas · ${String(r.visitados)} chunks pisados (${String(r.exprimidos)} exprimidos) · ${String(r.caminadas)} celdas caminadas\n` +
          `económico ·   ${r.cal.toFixed(0)} cal salieron del mundo contra ${String(r.techo)} de techo en lo pisado (${((r.cal / r.techo) * 100).toFixed(1)}%)\n` +
          `económico ·   por partida: ingreso ${(r.ingreso / PARTIDAS).toFixed(1)} crudo / ${(r.ingresoCocinado / PARTIDAS).toFixed(1)} cocinado · ` +
          `costo ${(r.costo / PARTIDAS).toFixed(1)} · NETO ${(r.neto / PARTIDAS).toFixed(1)} crudo / ${(r.netoCocinado / PARTIDAS).toFixed(1)} cocinado\n` +
          tabla(nombre, ps),
      )
      expect(r.intentos).toBe(PARTIDAS * Math.floor(TICKS / TICKS_POR_INTENTO))
      expect(r.piezas).toBeGreaterThan(0)
    }
  })

  it('EL CRITERIO DEL RIESGO 4: SIN TRABAJO la energía neta acumulada es NEGATIVA, en las cien', () => {
    // El criterio del documento de arquitectura, textual y sin traducir:
    //
    //   «un test económico de 100 partidas de 20.000 ticks donde la energía neta
    //    acumulada de la criatura tiene que ser **negativa sin trabajo**»
    //
    // y el porqué, del mismo riesgo: que el dios no sea una fuente infinita de
    // comida, «porque ahí el hambre, que es el motor de toda la historia, deja de
    // doler».
    //
    // Éste es el test que lo mide, y hasta hoy no lo medía nadie: el que estaba
    // acá se llamaba «sin trabajo» y le daba una caña a la criatura. Dónde se pone
    // la línea de «sin trabajo» y por qué el carroñero es la versión más generosa
    // que se puede escribir está arriba, en el encabezado de `carronear`.
    //
    // ─── (a) LA LÍNEA DE BASE, que se CONFIRMA y no se descubre ────────────
    //
    // El ADR II-0009 ya midió que con la `stamina` de arranque y 1,0 por segundo
    // una criatura que no hace absolutamente nada se muere en el tick 10.000 de
    // los 20.000, o sea la mitad exacta de la partida. Acá esa cuenta se rehace
    // desde el catálogo —el techo de `stamina` y la constante copiada— para que si
    // alguien mueve cualquiera de las dos, el número del ADR deje de cuadrar acá y
    // no dentro de tres meses.
    expect(STAMINA_DE_ARRANQUE).toBe(500)
    expect((STAMINA_DE_ARRANQUE / COSTO_VIVIR_POR_SEGUNDO) * HZ).toBe(TICKS / 2)

    // ─── (b) EL CARROÑERO: las cien, y no la mediana ───────────────────────
    for (const p of SIN_TRABAJO) expect(p.neto).toBeLessThan(0)

    // ─── (c) Y SE MUERE, que es la otra mitad de lo que el criterio quiere ─
    //
    // Un acumulado negativo con un tanque que nunca toca cero sería una criatura
    // que termina debiendo y sigue viva. El carroñero no llega: se muere **antes**
    // que el que se queda quieto, y ése es el hallazgo que da vuelta la intuición
    // — a 20 celdas por segundo, caminar cuesta 1,0 por segundo, exactamente lo
    // mismo que vivir, así que buscar comida tirada DUPLICA el gasto y lo que
    // encuentra no lo paga.
    for (const p of SIN_TRABAJO) {
      expect(p.tickDeLaMuerte).toBeGreaterThan(0)
      expect(p.tickDeLaMuerte).toBeLessThan(TICKS / 2)
    }

    // ─── (d) NI REGALÁNDOLE LA CAMINATA ────────────────────────────────────
    //
    // El cierre más fuerte del bloque, y el que no depende del modelo de
    // locomoción: aunque no se le cobrara **una sola celda**, lo que junta en los
    // 1000 segundos no llega a pagar lo que cuesta estar vivo. La conclusión no se
    // apoya en el precio de caminar, así que el hueco 2 no la puede mover.
    const ing = extremos(SIN_TRABAJO.map((p) => p.ingreso))
    expect(ing.max).toBeLessThan(COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA)

    // ─── (e) Y LO QUE SE LLEVÓ POR LA PUERTA DE ATRÁS, medido ──────────────
    //
    // Lo suelto NO pasa por `LibroCalorico`: nadie se lo cobra a ningún techo, así
    // que es calorías que salen del mundo sin quedar anotadas. Hay que decirlo, y
    // hay que decir cuánto es: contra el presupuesto calórico de los chunks que
    // barrió, es una migaja. Si mañana `scatter` sembrara diez veces más, este
    // número lo diría antes que nadie.
    const fuga = extremos(SIN_TRABAJO.map((p) => p.ingreso / p.techoDeLoBarrido)).max
    expect(fuga).toBeLessThan(0.01)

    const neto = extremos(SIN_TRABAJO.map((p) => p.neto))
    const muerte = extremos(SIN_TRABAJO.map((p) => p.tickDeLaMuerte))
    const piezas = extremos(SIN_TRABAJO.map((p) => p.piezas))
    const celdas = extremos(SIN_TRABAJO.map((p) => p.celdasCaminadas))
    const anillos = extremos(SIN_TRABAJO.map((p) => p.anillos))
    console.log(
      `económico · SIN TRABAJO (carroñero: camina y come lo que hay tirado, crudo), ${String(PARTIDAS)} partidas × ${String(TICKS)} ticks:\n` +
        `económico ·   piezas levantadas . mínimo ${String(piezas.min)} · mediana ${String(piezas.mediana)} · máximo ${String(piezas.max)}\n` +
        `económico ·   celdas caminadas . mínimo ${String(celdas.min)} · mediana ${String(celdas.mediana)} · máximo ${String(celdas.max)} (barre hasta el anillo ${String(anillos.max)} de chunks)\n` +
        `económico ·   INGRESO .......... mínimo ${ing.min.toFixed(1)} · mediana ${ing.mediana.toFixed(1)} · máximo ${ing.max.toFixed(1)} · contra ${(COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA).toFixed(0)} que cuesta SÓLO vivir\n` +
        `económico ·   NETO ............. mínimo ${neto.min.toFixed(1)} · mediana ${neto.mediana.toFixed(1)} · máximo ${neto.max.toFixed(1)} → las cien NEGATIVAS\n` +
        `económico ·   MUERE en el tick . mínimo ${String(muerte.min)} · mediana ${String(muerte.mediana)} · máximo ${String(muerte.max)}, y el que no hace NADA aguanta hasta el ${String(TICKS / 2)}\n` +
        `económico ·   lo que se llevó sin que nadie se lo cobre: ${(fuga * 100).toFixed(3)}% del techo calórico de lo que barrió`,
    )
  })

  it('LA COMÚN, QUE SÍ TRABAJA: pescar y comer crudo TAMPOCO alcanza, en las cien', () => {
    // ─── QUÉ MIDE ESTE TEST, Y QUÉ NO ──────────────────────────────────────
    //
    // Este `it` se llamaba «la energía neta acumulada es NEGATIVA sin trabajo» y
    // el nombre era falso: la criatura que mide **sí trabaja**: pesca con una
    // caña, tira 200 veces y saca 98 piezas por partida. El criterio del riesgo 4
    // lo mide el test de acá arriba, que es el que no le da herramientas a nadie.
    //
    // Lo que este mide sigue siendo información y por eso se queda, con el nombre
    // correcto: **ni siquiera trabajando alcanza, si se come todo crudo.** Una
    // criatura que hace la cadena entera —deshilachar, atar, ir al río, pescar— y
    // repite doscientas veces, termina los 1000 segundos debiendo. Antes daba +394
    // por partida, y la única cosa que se movió para que dé −406 es la perilla del
    // metabolismo: `COSTO_VIVIR` 0,01 por tick (o sea 0,20 por segundo a 20 Hz)
    // pasó a `COSTO_VIVIR_POR_SEGUNDO` 1,0 por segundo, que es 5×.
    //
    // ─── Y el techo NO era lo que fallaba ──────────────────────────────────
    //
    // Vale la pena que quede escrito porque es lo que hizo falta entender para
    // arreglarlo. El techo calórico existía, se cobraba y se respetaba: en las
    // doscientas partidas ningún chunk pasó su presupuesto (test de más abajo) y
    // las afortunadas lo tocan al 100%. Lo que fallaba era la CALIBRACIÓN, y se
    // veía en una división: un chunk acuático da del orden de 1800 calorías y
    // vivir la partida entera costaba 200, así que **un solo chunk pagaba nueve
    // vidas**. Ninguna cota sobre cuánto da un lugar puede hacer negativo un
    // balance donde un lugar da nueve veces lo que cuesta vivir.
    //
    // Lo que NO afirma este test es que 1,0 sea el número correcto: afirmarlo acá
    // sería afirmar la copia.
    for (const p of COMUNES) expect(p.netoCrudo).toBeLessThan(0)
    // Y el margen medido, para que «negativo» no sea «negativo por un pelo»: la
    // partida que MÁS comió de las cien todavía termina bien abajo del cero.
    const peor = extremos(COMUNES.map((p) => p.netoCrudo)).max
    console.log(`económico · la común: la que MÁS comió termina en ${peor.toFixed(1)} de stamina, y es la más cerca del cero de las cien`)
  })

  it.fails('SIGUE ABIERTO · la AFORTUNADA sigue terminando en positivo, y no es la perilla del metabolismo', () => {
    // POR QUÉ SIGUE ABIERTO: porque lo que le falta a esta variante **no es
    // cuánto cuesta vivir**. Es que en este modelo **viajar no cuesta tiempo**.
    //
    // La afortunada es un dado cargado —`SUERTE_PERFECTA`, pica siempre— sobre el
    // pozo más generoso que el paquete deja escribir, y cuando exprime un chunk
    // camina hasta el siguiente. `jugar` le cobra esas celdas con
    // `COSTO_POR_CELDA`, que es correcto, pero **no le adelanta el reloj**: `t`
    // sale de `sumarPaso(t, DT)` una vez por tick y caminar no consume ticks. O
    // sea que se muda gratis en tiempo y sigue pescando el resto de la partida
    // como si nunca se hubiera ido. A 20 Hz esas celdas son un cuarto de su tiempo
    // de pesca, más su propio costo de vivir, y ninguno de los dos se le cobra.
    //
    // Subir `COSTO_VIVIR_POR_SEGUNDO` hasta hundirla tampoco es la salida, y está
    // medido en el ADR II-0009: haría falta 4,04 por segundo, y a ese precio la
    // criatura COMÚN se muere en el tick ~5.800 comiendo crudo y en el ~7.800
    // cocinando. El criterio del Hito 5 pasaría de trivialmente cierto a
    // imposible, que es el mismo error con el signo cambiado. Calibrar contra la
    // afortunada es calibrar contra un adversario y no contra un jugador.
    //
    // QUÉ HARÍA FALTA PARA CERRARLO: que caminar consuma TICKS en este modelo, o
    // sea que el bucle de `jugar` gaste tiempo de partida por celda recorrida en
    // vez de teletransportarse. Y para que ese número sea el del mundo y no una
    // invención de acá, primero hay que cerrar el hueco 2 de
    // `@anima/world/tests/el-tiempo-no-depende-del-tick.test.ts`: hoy la velocidad
    // se mide en muestras —`intencionCaminar` avanza una celda por TICK— así que
    // «cuántos segundos tarda un viaje» depende de la frecuencia. Eso es
    // locomoción y no metabolismo, pide una velocidad en celdas por segundo con
    // un resto sub-celda en `Actor`, y merece su propio ADR (II-0009,
    // «a tener en cuenta»).
    //
    // ─── Y UN NÚMERO DEL ADR QUE NO DA, medido acá ─────────────────────────
    //
    // El ADR II-0009 dice: «La afortunada termina en **+3037 en la peor de sus
    // cien partidas** — el ingreso menos la caminata le da entre 4036,9 y 4043,2
    // contra un costo de 1000». Medido, **la peor no es +3037**: es la de acá
    // abajo, y +3037,6 resulta ser la MEJOR. El error se ve en la frase misma: el
    // rango «4036,9 y 4043,2» es el del ingreso CRUDO a secas —medido, 4037,1 a
    // 4043,2— y no el del ingreso MENOS la caminata, que es lo que la frase dice.
    // Después se le resta sólo el costo de vivir, así que las celdas quedan
    // contadas cero veces: la partida que más camina paga 249,6 que ese rango no
    // ve, y son 4992 celdas de las que ni el tiempo ni la stamina aparecen.
    //
    // No cambia ninguna conclusión —las cien siguen dando positivo por más de dos
    // mil— y por eso el hueco sigue abierto por el mismo motivo. Queda escrito con
    // el número medido adelante porque un número mal reportado sobrevive a quien
    // lo escribió, y éste ya venía copiado de una tabla vieja.
    const neto = extremos(AFORTUNADAS.map((p) => p.netoCrudo))
    const limpio = extremos(AFORTUNADAS.map((p) => p.ingresoCrudo - p.celdasCaminadas * COSTO_POR_CELDA))
    const celdas = extremos(AFORTUNADAS.map((p) => p.celdasCaminadas))
    console.log(
      `económico · la AFORTUNADA, medida: NETO crudo entre ${neto.min.toFixed(1)} y ${neto.max.toFixed(1)} (mediana ${neto.mediana.toFixed(1)})\n` +
        `económico ·   ingreso menos caminata entre ${limpio.min.toFixed(1)} y ${limpio.max.toFixed(1)} contra un costo de vivir de ${(COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA).toFixed(0)}\n` +
        `económico ·   camina entre ${String(celdas.min)} y ${String(celdas.max)} celdas entre orillas, y NINGUNA de esas celdas le cuesta un segundo de partida\n` +
        `económico ·   ⚠ el ADR II-0009 dice «+3037 en la peor»: medido, +${neto.max.toFixed(1)} es la MEJOR y la peor es +${neto.min.toFixed(1)}`,
    )
    for (const p of AFORTUNADAS) expect(p.netoCrudo).toBeLessThan(0)
  })

  it('LA VENTANA DEL ADR II-0009 ES UN CONJUNTO VACÍO, y lo que sí queda en pie', () => {
    // ─── LO QUE ESTE TEST DECÍA ANTES, y por qué dejó de decirlo ───────────
    //
    // El ADR II-0009 escribió su criterio verificable así: «afirma la ventana y no
    // el número: neto crudo negativo en las 100 partidas comunes y neto cocinado
    // positivo en las 100», con la ventana `(0,766 ; 1,155)` y el 1,0 adentro. La
    // idea era linda: adentro de ese intervalo, y sólo adentro, comer crudo mata y
    // cocinar salva, así que el 1,0 no estaría elegido a dedo.
    //
    // **Esa ventana no existe**, y no es una opinión: está medido en los bloques 5
    // y 6 del final de este archivo, con el precio del fuego despejado de la
    // física. Los dos bordes se cruzan.
    //
    // ─── ESTO NO ES ABLANDAR LA VARA, y hay que dejarlo escrito ────────────
    //
    // El criterio del DOCUMENTO DE ARQUITECTURA —«la energía neta acumulada de la
    // criatura tiene que ser **negativa sin trabajo**»— se cumple, se mide en el
    // primer `it` de este bloque y es más duro que antes: el carroñero no llega ni
    // a la mitad de la partida. Lo que se corrige acá es una afirmación distinta y
    // más fuerte que un ADR intermedio inventó mientras calibraba una perilla, y
    // que la aritmética del fuego —que ese ADR no podía ver, porque el fuego duraba
    // un tick— dejó sin conjunto solución. La vara del documento queda donde
    // estaba; lo que se cae es una promesa que nadie le pidió.
    //
    // ─── LO QUE SÍ QUEDA EN PIE, y es lo que este test afirma ──────────────
    //
    //   1. el borde de ABAJO: comer crudo no alcanza ni trabajando, en las cien;
    //   2. cocinar multiplica por 2,50× lo que rinde la MISMA materia, sin crear un
    //      gramo de nada —sale de que `digestibility` sube de 0,38 a 0,95—;
    //   3. y con el fuego pagado entero, cocinar **se paga solo**: eso lo mide
    //      `COCINAR CONVIENE EN LAS CIEN` en el bloque 5, con +33,3 en la partida
    //      más flaca. Ése es el hecho al que apunta el ADR corregido, y no se mide
    //      dos veces.
    //
    // Se afirma sobre la COMÚN y no sobre la afortunada a propósito: la afortunada
    // es un dado cargado, y calibrar contra un adversario da el número equivocado
    // con el otro signo (ver el `it.fails` de acá arriba).
    for (const p of COMUNES) {
      expect(p.netoCrudo).toBeLessThan(0)
      // El neto cocinado SIN el precio del fuego. Sigue siendo cierto y sigue
      // sirviendo —es el control contra el que los bloques 5 y 6 restan el fuego—
      // pero **no dice que cocinar salve**: dice cuánta holgura hay para comprarlo.
      expect(p.netoCocinado).toBeGreaterThan(0)
    }

    // ─── LOS TRES BORDES, medidos como tasa por segundo ────────────────────
    //
    // Los dos primeros son los del ADR. El tercero es el que el ADR no tenía, y es
    // el que cierra el conjunto: lo que rinde cocinar CON el fuego adentro.
    const porSegundo = (p: Partida, ingreso: number): number =>
      (ingreso - p.celdasCaminadas * COSTO_POR_CELDA) / SEGUNDOS_DE_PARTIDA
    const abajo = extremos(COMUNES.map((p) => porSegundo(p, p.ingresoCrudo))).max
    const arribaSinFuego = extremos(COMUNES.map((p) => porSegundo(p, p.ingresoCocinado))).min
    const arribaConFuego = extremos(
      COMUNES.map((p) => porSegundo(p, p.ingresoCocinado) - PRECIO_DEL_FUEGO.precio / SEGUNDOS_DE_PARTIDA),
    ).min
    expect(abajo).toBeLessThan(COSTO_VIVIR_POR_SEGUNDO)
    expect(COSTO_VIVIR_POR_SEGUNDO).toBeLessThan(arribaSinFuego)
    // Y ACÁ SE CRUZAN, que es la afirmación de este test: el borde de arriba de
    // verdad quedó por DEBAJO del de abajo. Para que cocinar alcance, vivir tendría
    // que costar menos de lo que ya le alcanza al que come crudo — o sea que no hay
    // ningún valor de `COSTO_VIVIR_POR_SEGUNDO` que cumpla las dos mitades. Esto es
    // un guardián y no una deuda: si mañana alguien mueve una constante y la ventana
    // vuelve a existir, este `expect` se pone rojo y hay que venir a mirar.
    expect(arribaConFuego).toBeLessThan(abajo)
    console.log(
      `económico · LA VENTANA DEL ADR II-0009, medida sobre las cien comunes:\n` +
        `económico ·   ${abajo.toFixed(3)}/s ← borde de ABAJO: lo que rinde comiendo CRUDO la partida que MÁS comió\n` +
        `económico ·   ${COSTO_VIVIR_POR_SEGUNDO.toFixed(3)}/s ← COSTO_VIVIR_POR_SEGUNDO, el número elegido\n` +
        `económico ·   ${arribaSinFuego.toFixed(3)}/s ← borde de ARRIBA **si cocinar fuera gratis**, que es como el ADR lo midió\n` +
        `económico ·   ${arribaConFuego.toFixed(3)}/s ← borde de ARRIBA DE VERDAD, con el fuego de ${PRECIO_DEL_FUEGO.precio.toFixed(2)} adentro\n` +
        `económico ·   ⚠ ${arribaConFuego.toFixed(3)} < ${abajo.toFixed(3)}: LOS DOS BORDES SE CRUZAN y la ventana es un CONJUNTO VACÍO\n` +
        `económico ·   lo que sí queda: crudo no alcanza en las cien, y cocinar rinde ${(
          caloriasDelBocado('pescado', MASA_DE_UNA_PIEZA, DIGESTIBILIDAD_TECHO) / caloriasDelBocado('pescado', MASA_DE_UNA_PIEZA)
        ).toFixed(2)}× sobre la misma materia`,
    )
  })

  it('el punto de equilibrio, medido: de qué lado de la perilla quedó cada variante', () => {
    // El número accionable, y dice cosas distintas según la variante: el costo de
    // vivir por segundo que dejaría en cero a la partida que MÁS comió, o sea el
    // que haría negativas a las cien de esa variante.
    //
    //   · el CARROÑERO, que es el que contesta el riesgo 4, está tan abajo que no
    //     entra en la comparación: no llega ni a la mitad de la partida vivo;
    //   · la COMÚN quedó por DEBAJO de lo que hoy cuesta vivir → las cien dan
    //     negativo comiendo crudo, aun trabajando;
    //   · la AFORTUNADA sigue por ENCIMA → las cien dan positivo, y ése es el
    //     `it.fails` de más arriba, con su porqué adentro.
    //
    // Que las tres afirmaciones tengan distinto sentido no es una concesión: es
    // exactamente lo que se midió, y afirmar el mismo sentido para todas sería
    // pedirle al mundo que se calibre contra un adversario.
    const equilibrioDe = (ps: readonly Partida[]): number => {
      let equilibrio = 0
      for (const p of ps) {
        // ingreso = costoPorSegundo × 1000 + caminata  ⟹  el corte
        const corte = (p.ingresoCrudo - p.celdasCaminadas * COSTO_POR_CELDA) / SEGUNDOS_DE_PARTIDA
        if (corte > equilibrio) equilibrio = corte
      }
      return equilibrio
    }
    for (const [nombre, ps] of VARIANTES) {
      const equilibrio = equilibrioDe(ps)
      console.log(
        `económico · criatura ${nombre}: vivir cuesta ${COSTO_VIVIR_POR_SEGUNDO.toFixed(2)}/s y el equilibrio de la que más comió está en ${equilibrio.toFixed(3)}/s ` +
          `(${(equilibrio / COSTO_VIVIR_POR_SEGUNDO).toFixed(2)}× lo que cuesta) → las cien dan ${equilibrio < COSTO_VIVIR_POR_SEGUNDO ? 'NEGATIVO' : 'POSITIVO'}`,
      )
    }
    // Y el carroñero, en la misma unidad, para que se vea de qué tamaño es la
    // diferencia: el que no trabaja no tiene punto de equilibrio a ningún precio
    // razonable de vivir, porque lo que junta caminando no paga ni la caminata.
    const equilibrioCarroñero = extremos(
      SIN_TRABAJO.map((p) => (p.ingreso - p.celdasCaminadas * COSTO_POR_CELDA) / SEGUNDOS_DE_PARTIDA),
    ).max
    console.log(
      `económico · criatura sin trabajo: el equilibrio de la que más juntó está en ${equilibrioCarroñero.toFixed(3)}/s ` +
        `(${(equilibrioCarroñero / COSTO_VIVIR_POR_SEGUNDO).toFixed(2)}× lo que cuesta vivir) → las cien dan NEGATIVO`,
    )
    expect(equilibrioCarroñero).toBeLessThan(0)
    expect(equilibrioDe(COMUNES)).toBeLessThan(COSTO_VIVIR_POR_SEGUNDO)
    expect(equilibrioDe(AFORTUNADAS)).toBeGreaterThan(COSTO_VIVIR_POR_SEGUNDO)
    // Y la otra mitad de la perilla, que es la que el documento prefiere: cocinar
    // multiplica lo que rinde el mismo bicho, sin crear ni un gramo de materia.
    // **Es una MEJORA y no una condición de supervivencia**, y la diferencia está
    // medida en el bloque 5: con el fuego pagado, cocinar rinde +33,3 en la partida
    // más flaca — se paga solo, y no salva a nadie.
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

  it('las tres constantes copiadas de `@anima/world` siguen diciendo lo que dicen acá, Y con la misma unidad', () => {
    // El guardián de la copia. `@anima/oracle` no puede importar `@anima/world`
    // —sería el ciclo de paquetes que toda la arquitectura evita—, así que estos
    // tres números están copiados; y una constante copiada sin un test que la
    // vigile es exactamente cómo divergió `DSL_REFERENCE` en Ánima I. Se lee el
    // ARCHIVO, que no es un import y no crea ninguna dependencia de build.
    //
    // ─── Este guardián YA FUNCIONÓ una vez, y conviene contarlo ─────────────
    //
    // El ADR II-0009 renombró `COSTO_VIVIR` → `COSTO_VIVIR_POR_SEGUNDO` y
    // `COSTO_PASO` → `COSTO_POR_CELDA`, sin dejar alias, y esto saltó con
    // «`COSTO_VIVIR` ya no está: el modelo económico de este test quedó viejo».
    // No fue un daño colateral: fue el guardián haciendo exactamente su trabajo, y
    // es el motivo por el que no se dejó un alias. Un alias habría dejado este
    // archivo midiendo 0,20 por segundo mientras el mundo cobraba 1,0.
    const step = fileURLToPath(new URL('../../world/src/step.ts', import.meta.url))
    const fuente = readFileSync(step, 'utf8')
    const valorDe = (nombre: string): number => {
      const m = new RegExp(`export const ${nombre} = ([0-9.]+)`).exec(fuente)
      if (m === null) {
        throw new Error(`«${nombre}» ya no está en ${step}: el modelo económico de este test quedó viejo`)
      }
      return Number(m[1])
    }
    expect(valorDe('COSTO_VIVIR_POR_SEGUNDO')).toBe(COSTO_VIVIR_POR_SEGUNDO)
    expect(valorDe('COSTO_POR_CELDA')).toBe(COSTO_POR_CELDA)
    expect(valorDe('STAMINA_POR_CALORIA')).toBe(STAMINA_POR_CALORIA)

    // ─── Y LA UNIDAD, que es la otra mitad de la copia ─────────────────────
    //
    // Copiar bien el número y mal la unidad da un modelo económico que se
    // equivoca por un factor de `hz` y no se queja: es literalmente el bug que el
    // ADR II-0009 arregló del otro lado. Así que el guardián no mira sólo el
    // valor: mira DÓNDE lo cobra el mundo, que es donde vive la unidad.
    //
    //   · vivir es una TASA POR SEGUNDO ⟹ pasa por `porPaso(…, d.dt)`, y por eso
    //     acá se multiplica por los 1000 SEGUNDOS de la partida y no por sus
    //     20.000 ticks;
    //   · la celda NO es una tasa ⟹ se cobra tal cual con `cobrarStamina`, y no
    //     puede pasar por `porPaso` nunca: dividirla por la frecuencia haría que
    //     el mismo viaje saliera 5× más barato a 100 Hz que a 20.
    const dice = (patron: RegExp): boolean => patron.test(fuente)
    expect(['vivir pasa por porPaso', dice(/porPaso\(COSTO_VIVIR_POR_SEGUNDO,/)]).toEqual(['vivir pasa por porPaso', true])
    expect(['la celda NO pasa por porPaso', dice(/porPaso\(\s*COSTO_POR_CELDA/)]).toEqual(['la celda NO pasa por porPaso', false])
    expect(['la celda se cobra entera', dice(/cobrarStamina\(d, a, COSTO_POR_CELDA\)/)]).toEqual(['la celda se cobra entera', true])

    // ─── Y los nombres viejos no volvieron por la puerta de atrás ──────────
    //
    // Un alias reintroducido —`export const COSTO_VIVIR = …` al lado del nuevo—
    // dejaría este archivo verde y equivocado, porque las afirmaciones de arriba
    // seguirían pasando. `\b` no matchea adentro de `COSTO_VIVIR_POR_SEGUNDO`
    // porque el `_` es carácter de palabra, así que esto caza el alias y no el
    // nombre nuevo.
    for (const viejo of ['COSTO_VIVIR', 'COSTO_PASO']) {
      expect([viejo, dice(new RegExp(`export const ${viejo}\\b`))]).toEqual([viejo, false])
    }

    // ─── Y LA CUARTA COSA COPIADA, que no es una constante (ADR II-0011) ───
    //
    // `precioDeEncender` copia la FORMA de la cuenta con la que el mundo cobra un
    // `drive` con `poweredBy`: `heatCapacity × Δq / eficiencia` por paso. No es un
    // número —la eficiencia sale del catálogo de `@anima/physics` en tiempo de
    // ejecución— pero es igual de copiable y de olvidable: si mañana alguien
    // cobra el trabajo de otra manera, el precio del fuego de este archivo queda
    // midiendo una física que ya no existe, y ninguna constante lo delata.
    //
    // Las dos mitades: que la energía sea `capacidad × delta`, y que se DIVIDA por
    // la eficiencia. Multiplicarla en vez de dividirla daría un fuego 8× más
    // barato y el modelo entero cerraría por el motivo equivocado.
    expect(['la energía es capacidad × delta', dice(/const pedido = \(cap > 0 \? cap : 1\) \* delta/)]).toEqual([
      'la energía es capacidad × delta',
      true,
    ])
    expect(['y se DIVIDE por la eficiencia', dice(/const pedido = .* \/ efic/)]).toEqual([
      'y se DIVIDE por la eficiencia',
      true,
    ])
  })
})

// ═══ 5. EL PRECIO DE COCINAR: LA ECONOMÍA CON EL FUEGO ADENTRO ══════════════
//
// El ADR II-0011 («arder libera calor») hizo que el fuego DURE, y con eso cocinar
// pasó de ser imposible a ser una técnica. Este bloque es la otra mitad de la
// noticia: **ahora se puede poner el precio**, y el precio no cierra.
//
// Lo que de acá abajo mira partidas las mira COMUNES, por la misma razón que el
// criterio del ADR II-0009: la afortunada es un dado cargado.
//
// Y TODO ESTE BLOQUE ES OPTIMISTA A PROPÓSITO, en tres lugares a la vez, porque
// lo que concluye es que la aritmética NO cierra y una cota optimista hace esa
// conclusión más fuerte, no más débil:
//
//   · **un solo fuego por partida**, encendido una vez y sostenido los 1000
//     segundos con leña que este modelo no cobra;
//   · **la pieza cocinada rinde `DIGESTIBILIDAD_TECHO` completa**, o sea 2,50× la
//     cruda. En el mundo de verdad rinde 2,13×, medido en
//     `perceive/tests/ataque-a-la-costura.test.ts`: el pescado sobre la parrilla
//     también se SECA, y `calories` es extensiva en la masa. Este archivo cocina
//     la misma pieza sin correr el mundo y por eso no ve la merma;
//   · **caminar hasta la leña, juntarla y volver no cuesta nada**, igual que
//     caminar entre orillas no cuesta tiempo (el `it.fails` de la afortunada).

describe('5. lo que cuesta el fuego que cocina (ADR II-0011)', () => {
  it('el precio del fuego más barato QUE COCINA, despejado de la física', () => {
    // El número entero, pieza por pieza, para que nadie tenga que despejarlo de
    // nuevo. Y para que se vea que las dos formas de contarlo dan lo mismo: acá se
    // despeja de `@anima/physics` y en `perceive/tests/ataque-a-la-costura.test.ts`
    // se MIDE corriendo `stepWorld`. Los dos dan 659,8629.
    const vara: Body = {
      id: 'v',
      form: 'vara',
      parts: [{ substance: 'madera', mass: MASA_DE_LA_VARA_QUE_ENCIENDE, q: {} }],
      joints: [],
      state: {},
    }
    const cap = qualityOf(vara, 'heatCapacity', PHYS)
    const ign = qualityOf(vara, 'ignitionPoint', PHYS)
    const porGolpe = porPaso(EL_DRIVE_DE_FROTAR.porSegundo, DT)
    console.log(
      `económico · EL PRECIO DEL FUEGO, despejado:\n` +
        `económico ·   vara de madera de ${String(MASA_DE_LA_VARA_QUE_ENCIENDE)} kg · heatCapacity ${cap.toFixed(4)} · ignición ${String(ign)} °C · ambiente ${String(T_AMBIENTE)} °C\n` +
        `económico ·   el empuje mueve ${porGolpe.toFixed(1)} °C por paso a ${String(HZ)} Hz, así que hacen falta ${String(Math.ceil((ign - T_AMBIENTE) / porGolpe))} pasos y la mano paga hasta ${String(T_AMBIENTE + Math.ceil((ign - T_AMBIENTE) / porGolpe) * porGolpe)} °C\n` +
        `económico ·   térmico ${PRECIO_DEL_FUEGO.termico.toFixed(4)} (= heatCapacity × ΔT / ${String(EL_DRIVE_DE_FROTAR.efficiency)}) + vivir ${(PRECIO_DEL_FUEGO.segundos * COSTO_VIVIR_POR_SEGUNDO).toFixed(4)} durante ${PRECIO_DEL_FUEGO.segundos.toFixed(2)} s\n` +
        `económico ·   TOTAL ${PRECIO_DEL_FUEGO.precio.toFixed(4)} de stamina, contra un tanque que topa en 1000`,
    )
    expect(Number(PRECIO_DEL_FUEGO.precio.toFixed(4))).toBe(659.8629)

    // Y LA VARA BARATA NO SIRVE, que es lo que este bloque agrega. Los 282,17 de
    // una vara de 0,2 kg —el número con el que el `it.fails` de
    // `world/tests/ataque-2-al-fuego.test.ts` (e) hace su cuenta— compran un fuego
    // que ENCIENDE y no cocina: medido en `perceive`, el pescado sobre la parrilla
    // se queda en `digestibility` 0,3800, o sea crudo. Encender y cocinar son dos
    // umbrales distintos y hay un factor de 2,34 entre ellos.
    const barata = precioDeEncender(0.2, 'madera')
    expect(Number(barata.precio.toFixed(4))).toBe(282.1714)
    expect(PRECIO_DEL_FUEGO.precio / barata.precio).toBeGreaterThan(2.3)
    console.log(
      `económico ·   la vara de 0,2 kg cuesta ${barata.precio.toFixed(2)} y NO cocina (el pescado se queda en 0,3800): ` +
        `el fuego que cocina sale ${(PRECIO_DEL_FUEGO.precio / barata.precio).toFixed(2)}× eso`,
    )
  })

  it('¿CUÁNTOS PESCADOS HAY QUE COCINAR EN UN FUEGO PARA QUE EL FUEGO SE PAGUE?', () => {
    // LA PREGUNTA DEL TRAMO, contestada con el número. El adversario del tramo
    // anterior la contestó con el fuego que se apagaba en un tick y le dio **332
    // pescados por fuego** (pieza de 1 kg que sólo llegaba a `digestibility` 0,513,
    // contra una ignición de 352,71). Con el fuego que arde:
    //
    //   · la pieza llega al techo de la ley 5 —0,95— y no a 0,513;
    //   · encender pasó de 352,71 a 659,86, porque el fuego barato NO COCINA y hay
    //     que pagar el que sí;
    //   · y el fuego, una vez hecho, cocina **todo lo que se le ponga encima a la
    //     vez**: 200 pescados de 2 kg sobre una sola parrilla salen los 200 cocidos
    //     y sin carbonizar, medido en `perceive`. Cocinar no es rival: el precio es
    //     del fuego y no del bocado.
    //
    // Los dos números, para que se puedan comparar con el 332 viejo y con la
    // pieza que este archivo usa.
    const deUnKilo =
      (caloriasDelBocado('pescado', fx(1), DIGESTIBILIDAD_TECHO) - caloriasDelBocado('pescado', fx(1))) *
      STAMINA_POR_CALORIA
    const porFuegoUnKilo = Math.ceil(PRECIO_DEL_FUEGO.precio / deUnKilo)
    const porFuego = Math.ceil(PRECIO_DEL_FUEGO.precio / LO_QUE_PAGA_UNA_PIEZA)
    console.log(
      `económico · PESCADOS POR FUEGO, remedido con el fuego que dura:\n` +
        `económico ·   cocinar una pieza de 1 kg paga ${deUnKilo.toFixed(2)} de stamina → ${String(porFuegoUnKilo)} por fuego (el adversario, con el fuego de un tick, midió 332)\n` +
        `económico ·   cocinar una pieza de ${String(unfx(MASA_DE_UNA_PIEZA))} kg paga ${LO_QUE_PAGA_UNA_PIEZA.toFixed(2)} → ${String(porFuego)} por fuego`,
    )
    expect(porFuegoUnKilo).toBe(145)
    expect(porFuego).toBe(73)

    // Y LO QUE ESO SIGNIFICA EN UNA PARTIDA, que es donde el número se vuelve
    // accionable: la criatura COMÚN saca entre `min` y `max` piezas en los 1000
    // segundos. Si el número de arriba estuviera arriba de lo que saca la que MENOS
    // sacó, el fuego no se pagaría nunca en ninguna partida.
    const piezas = extremos(COMUNES.map((p) => p.piezas))
    console.log(
      `económico ·   la común saca entre ${String(piezas.min)} y ${String(piezas.max)} piezas por partida (mediana ${String(piezas.mediana)}): ` +
        `${piezas.min >= porFuego ? 'las cien' : 'no todas'} alcanzan para pagar UN fuego`,
    )
    // Está peleado, y ése es el dato: la que menos sacó saca 76 y hacen falta 73.
    expect(piezas.min).toBeGreaterThanOrEqual(porFuego)
  })

  it('COCINAR CONVIENE EN LAS CIEN, aunque el fuego se pague entero de un bolsillo solo', () => {
    // La comparación honesta contra la alternativa: comer todo crudo. Un fuego por
    // partida —el supuesto MÁS GENEROSO que se puede hacer, porque supone que la
    // criatura lo mantiene encendido los 1000 segundos con leña que este modelo no
    // le cobra— y todo lo que saca, cocinado.
    const conFuego = COMUNES.map((p) => p.ingresoCocinado - p.ingresoCrudo - PRECIO_DEL_FUEGO.precio)
    const e = extremos(conFuego)
    console.log(
      `económico · COCINAR CONTRA COMER CRUDO, con UN fuego por partida:\n` +
        `económico ·   lo que cocinar agrega, menos el fuego: mínimo ${e.min.toFixed(1)} · mediana ${e.mediana.toFixed(1)} · máximo ${e.max.toFixed(1)}\n` +
        `económico ·   o sea que en la partida más flaca de las cien el fuego se paga por ${(1 + e.min / PRECIO_DEL_FUEGO.precio).toFixed(2)}× lo que costó`,
    )
    for (const x of conFuego) expect(x).toBeGreaterThan(0)
  })

  it('LA MITAD DE ARRIBA DE LA VENTANA SE CAE, con el fuego de leña gratis (el número viejo, intacto)', () => {
    // ─── ESTO ES UN GUARDIÁN Y NO UNA DEUDA ────────────────────────────────
    //
    // Este `it` fue un `it.fails` dos veces, y ya no lo es ninguna. La afirmación
    // no se movió nunca —«con el precio del fuego adentro, la mitad de arriba de la
    // ventana se cae»— y lo que cambió es cómo se escribe: de «esto DEBERÍA dar
    // positivo y no da» a «esto da negativo, y son 91 de 100».
    //
    // El paso que falta lo dio el ADR II-0009 corregido: la ventana que este número
    // rompía **era el conjunto vacío**, así que no hay ningún hueco que cerrar.
    // Un `it.fails` que nadie va a cerrar es ruido; una imposibilidad afirmada, con
    // sus dos números, es lo que se pone rojo el día que alguien mueva una
    // constante y la ventana vuelva a existir.
    //
    // Se deja con el número viejo intacto porque el bloque 6 lo usa de control: si
    // mañana el neto cocinado sin fuego se mueve, los dos se mueven juntos y la
    // diferencia entre ellos sigue siendo el precio del fuego.
    //
    // QUÉ SE MIDIÓ: el criterio del ADR II-0009 —«neto crudo negativo en las 100
    // partidas comunes y neto cocinado positivo en las 100»— se eligió con un
    // modelo en el que **cocinar era gratis**. Con el precio del fuego adentro, la
    // mitad de arriba de la ventana se cae, y no por poco.
    //
    // MEDIDO, con UN SOLO fuego por partida —el supuesto más generoso posible: que
    // se enciende una vez y dura los 1000 segundos, con leña que este modelo no
    // cobra—:
    //
    //   neto cocinado SIN fuego .... mínimo  +155,2 · mediana  +489,6 · máximo +915,2
    //   neto cocinado CON fuego .... mínimo  −504,7 · mediana  −170,3 · máximo +255,3
    //
    // O sea que 91 de las 100 partidas comunes terminan DEBIENDO aunque cocinen
    // todo lo que sacan, y las 9 que zafan son las que más pescaron. La frase del
    // ADR II-0009 —«la diferencia entre vivir y morirse es cocinar»— **es la que se
    // cayó**: sigue siendo cierta como COMPARACIÓN (el test de acá arriba mide que
    // cocinar conviene en las cien, por +33,3 en la más flaca) y es falsa como
    // SUPERVIVENCIA. Cocinar es mejor que no cocinar y no alcanza para vivir. El ADR
    // corregido dice eso mismo y apunta acá.
    //
    // Y NO SE ARREGLA DESDE ACÁ. Bajar `COSTO_VIVIR_POR_SEGUNDO` hasta que las cien
    // vuelvan a dar positivo es calibrar el mundo desde el arnés, que es lo que
    // este archivo entero existe para no hacer: lo medido se afirma, no se fabrica.
    // Los números que harían falta están medidos igual, abajo, porque una
    // imposibilidad sin su magnitud no se puede discutir.
    //
    // QUÉ HABRÍA HECHO FALTA, por las tres salidas que el hueco gemelo de
    // `world/tests/ataque-2-al-fuego.test.ts` (e) nombra, con los números de hoy —y
    // las tres están cerradas o piden mover el hambre entera:
    //
    //   1. que `nutrition → stamina` rinda más: hace falta un factor de 1,44 sobre
    //      el ingreso cocinado de la partida más flaca. Es `STAMINA_POR_CALORIA` o
    //      el `nutrition` del catálogo, y mueve el hambre entera;
    //   2. que encender salga más barato **y por este lado no se puede**, y es el
    //      hallazgo del bloque. La partida más flaca de las cien termina con 155,2
    //      de holgura, así que el fuego tendría que costar menos que eso; el precio
    //      es `heatCapacity × 288 / eficiencia + 2,4`, y despejando hace falta una
    //      eficiencia de **1,51**. Una eficiencia mayor que 1 es una máquina de
    //      movimiento perpetuo, que es exactamente lo que el comentario de
    //      `FRICCION` dice que el 0,35 existe para impedir. Ni siquiera un motor
    //      PERFECTO alcanza: con eficiencia 1 el fuego cuesta 232,51 y la holgura
    //      es 155,2. La salida no está en el precio del trabajo, está en la masa de
    //      la vara — y la masa no se puede bajar porque abajo de 0,47 kg el fuego
    //      enciende y no cocina, que es el otro número de este bloque;
    //   3. que el fuego se amortice entre más partidas de las que hay. Ya no: el
    //      ADR II-0011 hizo que UN fuego cocine 200 pescados a la vez, y aun así
    //      hace falta que la partida saque 73 piezas de las 76 que saca la más
    //      flaca. Esta salida ya se gastó.
    //
    // La 2 y la 3 están cerradas y la 1 mueve el hambre entera, así que ninguna es
    // «cerrar un hueco»: son un rediseño del hambre, y no se decide desde el arnés.
    // Este archivo sólo puede decirlo con el número adelante.
    const sinFuego = extremos(COMUNES.map((p) => p.netoCocinado))
    const conFuego = COMUNES.map((p) => p.netoCocinado - PRECIO_DEL_FUEGO.precio)
    const e = extremos(conFuego)
    const negativas = conFuego.filter((x) => x <= 0).length
    // Cuánto tendría que rendir el ingreso cocinado para que las cien vuelvan a dar
    // positivo, dicho como factor: el número accionable de la salida 1.
    const falta = extremos(
      COMUNES.map(
        (p) => (COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA + p.celdasCaminadas * COSTO_POR_CELDA + PRECIO_DEL_FUEGO.precio) / p.ingresoCocinado,
      ),
    ).max
    // Y la salida 2, medida y no argumentada: la eficiencia que haría falta, y lo
    // que cuesta el fuego con la eficiencia PERFECTA que ninguna física da.
    const holgura = sinFuego.min
    const conMotorPerfecto = PRECIO_DEL_FUEGO.termico * EL_DRIVE_DE_FROTAR.efficiency + PRECIO_DEL_FUEGO.segundos * COSTO_VIVIR_POR_SEGUNDO
    const eficienciaQueHaríaFalta =
      (PRECIO_DEL_FUEGO.termico * EL_DRIVE_DE_FROTAR.efficiency) / (holgura - PRECIO_DEL_FUEGO.segundos * COSTO_VIVIR_POR_SEGUNDO)
    console.log(
      `económico · LA VENTANA CON EL FUEGO ADENTRO (un fuego de ${PRECIO_DEL_FUEGO.precio.toFixed(2)} por partida):\n` +
        `económico ·   neto cocinado SIN fuego: mínimo ${sinFuego.min.toFixed(1)} · mediana ${sinFuego.mediana.toFixed(1)} · máximo ${sinFuego.max.toFixed(1)}\n` +
        `económico ·   neto cocinado CON fuego: mínimo ${e.min.toFixed(1)} · mediana ${e.mediana.toFixed(1)} · máximo ${e.max.toFixed(1)}\n` +
        `económico ·   ${String(negativas)} de ${String(PARTIDAS)} partidas terminan DEBIENDO aunque cocinen todo lo que sacan\n` +
        `económico ·   salida 1 · el ingreso cocinado tendría que rendir ${falta.toFixed(2)}× lo que rinde\n` +
        `económico ·   salida 2 · o frotar tendría que tener eficiencia ${eficienciaQueHaríaFalta.toFixed(2)}, que es una máquina de movimiento perpetuo. ` +
        `Con la eficiencia PERFECTA (1,00) el fuego cuesta ${conMotorPerfecto.toFixed(2)} y la holgura de la partida más flaca es ${holgura.toFixed(1)}`,
    )
    // La salida 2 está cerrada por arriba y eso no es una opinión: ni el motor
    // perfecto entra en la holgura.
    expect(eficienciaQueHaríaFalta).toBeGreaterThan(1)
    expect(conMotorPerfecto).toBeGreaterThan(holgura)
    // Y las 91, contadas. Éste es el `expect` que antes decía
    // `toBeGreaterThan(0)` sobre las cien y por eso el `it` era un `it.fails`.
    expect(negativas).toBe(91)
    expect(Number(e.min.toFixed(1))).toBe(-504.7)
    // Y que las 9 que zafan zafen NO rescata la ventana: para que fuera un
    // intervalo tendrían que ser las cien. Nueve de cien es una cola, no un
    // criterio.
    expect(negativas).toBeLessThan(PARTIDAS)
  })
})

// ═══ 6. LA MISMA CUENTA, CON LA LEÑA COBRADA ════════════════════════════════
//
// El bloque 5 hizo la cuenta con un supuesto que dice en voz alta: «un fuego
// sostenido 1000 s con leña que este modelo no cobra». Cuando se escribió, ese
// supuesto era **falso**: `TASA_CARBONIZACION` era intensiva y se cancelaba con
// `COMBUSTIBLE_POR_SEGUNDO`, así que ningún cuerpo ardía más de 50 s viniera de un
// leño de un kilo o de uno de cincuenta. Un fuego de 1000 segundos no existía.
//
// Ahora existe: carbonizar cuesta proporcional a la materia, y son **50 s por
// kilo**. La pregunta que este bloque contesta es la que quedaba abierta: **¿el
// problema económico y el bug de las constantes eran el mismo problema?**
//
// Se contesta con cuatro números medidos y no con un argumento:
//
//   1. cuánto cuesta encender el primer fuego (el del bloque 5, verificado);
//   2. cuánta leña hay que juntar para sostenerlo, y **cuánto pesa lo que el
//      mundo deja tirado de verdad** — la tabla de biomas, no un leño inventado;
//   3. qué cuesta juntarla: las celdas y el TIEMPO, que es donde la cuenta se
//      maquilla sola;
//   4. cuántas piezas cocina ese fuego en su vida.
//
// ─── LA TRAMPA DE ESTA CUENTA, dicha antes de hacerla ───────────────────────
//
// Vivir se cobra UNA sola vez. `p.costo` ya cobra `COSTO_VIVIR_POR_SEGUNDO × 1000`
// por la partida ENTERA, y el acarreo pasa ADENTRO de esos mil segundos: sumarle
// al acarreo su propio costo de vivir sería cobrar el mismo segundo dos veces, y
// haría que juntar leña pareciera más caro de lo que es. Lo que el tiempo del
// acarreo cuesta de verdad es **lo que no se pescó mientras tanto**, y eso se
// cobra como una fracción del ingreso y no como stamina.
//
// El mismo error está en el bloque 5 y queda medido abajo: `PRECIO_DEL_FUEGO`
// incluye 2,40 de vivir los 2,4 segundos de frotar, y esos 2,4 segundos también
// están adentro de los mil que `p.costo` ya cobró.

// ─── Las dos constantes de la ley 3, copiadas con su guardián ───────────────
//
// Mismo trato que las tres de `@anima/world`, y por el mismo motivo: no están
// exportadas —son `const` de módulo en `physics/src/leyes.ts`— y este archivo no
// puede leerlas de otra manera. Copiadas con su ruta, su valor y su unidad, y con
// un test que compara la copia contra el archivo.

/** `TASA_CARBONIZACION`: cuánto carboniza el calor por segundo **y por kilo**. */
const TASA_CARBONIZACION = 0.016

/** `COMBUSTIBLE_POR_SEGUNDO`: cuánto se lleva la llama por segundo, sobre el
 *  producto `fuelEnergy · masa` y no sobre el intensivo. */
const COMBUSTIBLE_POR_SEGUNDO = 0.3

/**
 * CUÁNTOS SEGUNDOS DE FUEGO HAY EN UN KILO DE UNA SUSTANCIA.
 *
 * Las dos ramas de la ley 4 (`avanceDeCarbon`), que se toman por el máximo, así
 * que el cuerpo se apaga con **la que llega primero**:
 *
 *   · el CALOR carboniza `TASA_CARBONIZACION / masa` por segundo, o sea que
 *     `charred` cruza `CARBONIZADO_QUE_TRANSMUTA` a los `0,8 · masa / 0,016` =
 *     **50 s por kilo**, igual para todo lo que arde;
 *   · la LLAMA se lleva `fuelEnergy · masa` de combustible a razón de
 *     `COMBUSTIBLE_POR_SEGUNDO`, o sea `fuelEnergy / 0,3` segundos por kilo.
 *
 * Manda la más chica. Para la madera (18) son 60 contra 50 y gana el calor; para
 * el grano (7) son 23,3 contra 50 y gana la llama. Medido contra `stepWorld` en
 * `perceive/tests/ataque-a-la-costura.test.ts`, bloque 8, y las dos cuentas
 * coinciden dentro del tick.
 */
function segundosDeFuegoPorKilo(substance: SubstanceId): number {
  const kilo: Body = { id: 'k', form: 'bloque', parts: [{ substance, mass: 1, q: {} }], joints: [], state: {} }
  const fuel = qualityOf(kilo, 'fuelEnergy', PHYS)
  if (!(fuel > 0)) return 0
  const porLaLlama = fuel / COMBUSTIBLE_POR_SEGUNDO
  const porElCalor = CARBONIZADO_QUE_TRANSMUTA / TASA_CARBONIZACION
  return porLaLlama < porElCalor ? porLaLlama : porElCalor
}

/** Un pedazo de leña tirado en el mundo, con su lugar y lo que da. */
interface Lena {
  readonly x: number
  readonly y: number
  readonly substance: SubstanceId
  readonly kg: number
  readonly segundos: number
}

/** Todo lo que arde en el anillo `r` de chunks alrededor de uno, en coordenadas
 *  de CELDA del mundo. Anillo y no disco: la criatura barre lo cercano primero. */
function lenaDelAnillo(seed: bigint, cx: number, cy: number, r: number): Lena[] {
  const out: Lena[] = []
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
      for (const s of resolveChunk(seed, cx + dx, cy + dy).sueltas) {
        const kg = unfx(s.masa)
        const segundos = kg * segundosDeFuegoPorKilo(s.substance)
        if (segundos <= 0) continue
        out.push({
          x: (cx + dx) * CELDAS_DE_LADO + (s.i % CELDAS_DE_LADO),
          y: (cy + dy) * CELDAS_DE_LADO + Math.floor(s.i / CELDAS_DE_LADO),
          substance: s.substance,
          kg,
          segundos,
        })
      }
    }
  }
  return out
}

/**
 * Cuántos cuerpos le entran en las manos. Es `Actor.capacity` del mundo, y acá es
 * una perilla declarada: `@anima/oracle` no puede importar `@anima/world` y el
 * mundo no fija un número, lo fija cada partida. 6 es el del campamento de
 * `perceive/tests/ataque-a-la-costura.test.ts`, o sea el más generoso que se usó
 * en algún lado. Con menos, el acarreo hace más viajes y sale MÁS caro.
 */
const CUÁNTO_LLEVA_EN_LAS_MANOS = 6

interface Acarreo {
  readonly celdasCaminadas: number
  readonly piezas: number
  readonly kg: number
  readonly segundosDeFuego: number
  readonly anillos: number
  readonly alcanzo: boolean
}

/**
 * EL ACARREO: juntar leña hasta tener `segundosQuePide` de fuego, y traerla.
 *
 * Vecino más cercano desde donde está parada, y con las manos llenas vuelve al
 * hogar. No es el camino óptimo —eso es un viajante de comercio— y es a propósito:
 * el óptimo sería una criatura que sabe dónde está todo antes de mirar, y lo que
 * este número tiene que acotar es lo que le cuesta a una que camina hacia lo más
 * cercano que ve. Es igual OPTIMISTA en dos cosas que conviene decir: **ve todo el
 * anillo de una** y **nunca se equivoca de pieza**.
 */
function acarrear(seed: bigint, base: ChunkDecretado, segundosQuePide: number): Acarreo {
  const orilla = base.orilla as number
  const hogar = {
    x: base.cx * CELDAS_DE_LADO + (orilla % CELDAS_DE_LADO),
    y: base.cy * CELDAS_DE_LADO + Math.floor(orilla / CELDAS_DE_LADO),
  }
  let pool: Lena[] = []
  let anillo = 0
  let caminadas = 0
  let piezas = 0
  let kg = 0
  let segundosDeFuego = 0
  let pos = hogar
  let enMano = 0
  while (segundosDeFuego < segundosQuePide && anillo <= 8) {
    if (pool.length === 0) {
      pool = lenaDelAnillo(seed, base.cx, base.cy, anillo)
      anillo++
      continue
    }
    let mejor = 0
    let d = Number.POSITIVE_INFINITY
    for (let k = 0; k < pool.length; k++) {
      const dd = celdasDeCamino(pos, pool[k] as Lena)
      if (dd < d) {
        d = dd
        mejor = k
      }
    }
    const p = pool.splice(mejor, 1)[0] as Lena
    caminadas += d
    pos = { x: p.x, y: p.y }
    piezas++
    kg += p.kg
    segundosDeFuego += p.segundos
    enMano++
    if (enMano >= CUÁNTO_LLEVA_EN_LAS_MANOS || segundosDeFuego >= segundosQuePide) {
      caminadas += celdasDeCamino(pos, hogar)
      pos = hogar
      enMano = 0
    }
  }
  if (enMano > 0) caminadas += celdasDeCamino(pos, hogar)
  return {
    celdasCaminadas: caminadas,
    piezas,
    kg,
    segundosDeFuego,
    anillos: anillo,
    alcanzo: segundosDeFuego >= segundosQuePide,
  }
}

/**
 * Los SEGUNDOS que un fuego tiene que durar para que la técnica sirva, en las dos
 * lecturas que el mundo permite. No son dos calibraciones: son dos estrategias, y
 * la diferencia entre ellas es todo el hallazgo de este bloque.
 *
 *   · **sostenido** — el fuego prendido los 1000 segundos de la partida, cocinando
 *     cada pieza a medida que sale del agua. Es el supuesto que el bloque 5 escribe
 *     como «leña gratis», y ahora se puede comprar: pide 20 kg de madera.
 *   · **hornada** — un solo fuego, al final, con todo lo del día encima. Pide que
 *     el fuego dure lo que tarda UNA cocción, y **cocinar no es rival**: 200
 *     pescados sobre una parrilla salen los 200 cocidos, medido en
 *     `perceive/tests/ataque-a-la-costura.test.ts`. Los 4,70 s son los que ese
 *     mismo archivo mide para que el pescado pase de 0,380 a 0,85.
 */
const SEGUNDOS_DE_UNA_COCCIÓN = 4.7

const ESTRATEGIAS = [
  ['sostenido', SEGUNDOS_DE_PARTIDA],
  ['hornada', SEGUNDOS_DE_UNA_COCCIÓN],
] as const

/** La orilla de cada partida común, la MISMA que jugó `jugar`: sin esto el
 *  acarreo mediría otro mundo que el de la tabla económica. */
const ORILLAS: ChunkDecretado[] = COMUNES.map((p) => {
  const c = siguienteOrilla(p.seed, 0)
  if (c === null) throw new Error(`la semilla ${String(p.seed)} perdió su orilla`)
  return c
})

/** El neto cocinado de una partida con el fuego ENTERO adentro: el precio de
 *  encender, la leña que hay que ir a buscar, y los segundos que eso se lleva. */
function netoConElFuegoEntero(p: Partida, o: ChunkDecretado, segundosDeFuego: number): number {
  const a = acarrear(p.seed, o, segundosDeFuego)
  // Los segundos que NO se pescaron: los del acarreo más los de frotar. Se cobran
  // como ingreso perdido y no como stamina, que es la trampa del encabezado. La
  // común usa el 23,6% del techo calórico de lo que pisa (bloque 4), o sea que lo
  // que la limita es el dado y no el lugar: las piezas son proporcionales al
  // tiempo que estuvo tirando.
  const perdidos = (a.celdasCaminadas + a.piezas) * DT + PRECIO_DEL_FUEGO.segundos
  const fraccion = (SEGUNDOS_DE_PARTIDA - perdidos) / SEGUNDOS_DE_PARTIDA
  return p.ingresoCocinado * fraccion - p.costo - PRECIO_DEL_FUEGO.termico - a.celdasCaminadas * COSTO_POR_CELDA
}

describe('6. la economía con la leña cobrada: ¿era el mismo problema?', () => {
  it('LA LEÑA: cuántos segundos de fuego hay en un kilo, y por qué son 50 y no 60', () => {
    // El número que el commit «la masa decide cuánto arde» dejó adentro, despejado
    // de las dos ramas de la ley 4 y no copiado de un informe. Y las dos ramas
    // importan: si mañana alguien vuelve a hacer intensiva la carbonización, la
    // segunda columna se despega de la tercera y esta tabla lo dice.
    const filas: string[] = []
    for (const s of ['madera', 'madera-dura', 'corteza', 'hoja-seca', 'junco', 'liana', 'raiz', 'grano', 'hoja'] as const) {
      const kilo: Body = { id: 'k', form: 'bloque', parts: [{ substance: s, mass: 1, q: {} }], joints: [], state: {} }
      const fuel = qualityOf(kilo, 'fuelEnergy', PHYS)
      filas.push(
        `económico ·   ${s.padEnd(12)} fuelEnergy ${fuel.toFixed(0).padStart(3)} · la llama lo apaga a los ${(fuel / COMBUSTIBLE_POR_SEGUNDO).toFixed(1).padStart(5)} s/kg · ` +
          `el calor a los ${(CARBONIZADO_QUE_TRANSMUTA / TASA_CARBONIZACION).toFixed(1)} · MANDA ${segundosDeFuegoPorKilo(s).toFixed(1)}`,
      )
    }
    console.log(`económico · SEGUNDOS DE FUEGO POR KILO:\n${filas.join('\n')}`)

    // La madera: 50 s por kilo, que es el número del tramo. Y NO 60: el calor llega
    // primero, y por eso el leño se hace tizón con el 17% del tanque adentro. Los
    // dos números tienen que estar acá porque el que se recuerda mal es el 60.
    expect(segundosDeFuegoPorKilo('madera')).toBe(50)
    expect(18 / COMBUSTIBLE_POR_SEGUNDO).toBe(60)
    // Y lo que arde poco sí lo apaga la llama: el grano se acaba a los 23,3.
    expect(Number(segundosDeFuegoPorKilo('grano').toFixed(4))).toBe(23.3333)
    // LA CUENTA DEL TRAMO, dicha en kilos: sostener un fuego los 1000 segundos de
    // la partida pide 20 kg de madera. Ése es el número que el bug de las
    // constantes hacía imposible —antes, 20 kg ardían los mismos 50 s que 1 kg— y
    // es el que este bloque va a cobrar.
    expect(SEGUNDOS_DE_PARTIDA / segundosDeFuegoPorKilo('madera')).toBe(20)
  })

  it('Y LO QUE EL MUNDO DEJA TIRADO NO LLEGA A ESO NI DE LEJOS: la tabla de biomas', () => {
    // «NO inventes un leño de 20 kg si el mundo no los tiene.» No los tiene: la
    // pieza más pesada que ALGÚN bioma siembra es de 5 kg y es una piedra, que no
    // arde. La leña más gorda del mundo es una `madera-dura` de 4 kg en el bosque,
    // o sea 200 s de fuego; y en la orilla —que es donde se pesca— la más grande es
    // una `madera` de 2,5 kg.
    const filas: string[] = []
    let laMasGorda = 0
    let deQuien = ''
    for (const b of BIOMAS) {
      const arde = b.siembra.filter((s) => segundosDeFuegoPorKilo(s.substance) > 0)
      if (arde.length === 0) continue
      const top = arde.reduce((a, s) =>
        unfx(s.masaMaxima) * segundosDeFuegoPorKilo(s.substance) > unfx(a.masaMaxima) * segundosDeFuegoPorKilo(a.substance)
          ? s
          : a,
      )
      const segs = unfx(top.masaMaxima) * segundosDeFuegoPorKilo(top.substance)
      if (segs > laMasGorda) {
        laMasGorda = segs
        deQuien = `${top.substance} de ${unfx(top.masaMaxima).toFixed(2)} kg en ${b.id}`
      }
      filas.push(
        `económico ·   ${b.id.padEnd(14)} lo más gordo que arde: ${top.substance.padEnd(12)} de hasta ${unfx(top.masaMaxima).toFixed(2)} kg = ${segs.toFixed(0).padStart(3)} s de fuego`,
      )
    }
    console.log(
      `económico · LA LEÑA QUE EL MUNDO DEJA, bioma por bioma (el techo del rango, o sea el mejor caso):\n${filas.join('\n')}\n` +
        `económico ·   la más gorda del mundo entero: ${deQuien} → ${laMasGorda.toFixed(0)} s, contra los ${String(SEGUNDOS_DE_PARTIDA)} que dura la partida\n` +
        `económico ·   o sea que el fuego sostenido pide juntar ${String(Math.ceil(SEGUNDOS_DE_PARTIDA / laMasGorda))} de las más grandes que existen, y eso EN EL BIOMA QUE LAS TIENE`,
    )
    // El leño de 20 kg no existe, y no por poco: hace falta un orden de magnitud.
    expect(laMasGorda).toBeLessThan(SEGUNDOS_DE_PARTIDA / 4)
    // Y en la orilla, que es el único lugar donde se pesca, lo más gordo es todavía
    // más chico. `agua-dulce` siembra `madera` de hasta 2,5 kg: 125 s.
    const agua = BIOMAS.find((b) => b.id === 'agua-dulce') as (typeof BIOMAS)[number]
    const mejorDeLaOrilla = agua.siembra
      .map((s) => unfx(s.masaMaxima) * segundosDeFuegoPorKilo(s.substance))
      .reduce((a, x) => (x > a ? x : a), 0)
    expect(Number(mejorDeLaOrilla.toFixed(1))).toBe(125)
  })

  it('EL ACARREO: lo que cuesta juntar esa leña, con las celdas Y el tiempo', () => {
    // La parte que se maquilla sola, hecha explícita. Se camina sobre el mundo
    // DECRETADO —las mismas cien orillas que juega la tabla económica— y no sobre
    // una densidad promedio inventada.
    for (const [nombre, pide] of ESTRATEGIAS) {
      const rs = ORILLAS.map((o, i) => acarrear((COMUNES[i] as Partida).seed, o, pide))
      expect(rs.every((r) => r.alcanzo)).toBe(true)
      const c = extremos(rs.map((r) => r.celdasCaminadas))
      const pz = extremos(rs.map((r) => r.piezas))
      const kg = extremos(rs.map((r) => r.kg))
      const stam = extremos(rs.map((r) => r.celdasCaminadas * COSTO_POR_CELDA))
      const tiempo = extremos(rs.map((r) => (r.celdasCaminadas + r.piezas) * DT))
      console.log(
        `económico · EL ACARREO para un fuego «${nombre}» de ${pide.toFixed(2)} s:\n` +
          `económico ·   kg de leña ....... mínimo ${kg.min.toFixed(2)} · mediana ${kg.mediana.toFixed(2)} · máximo ${kg.max.toFixed(2)}\n` +
          `económico ·   piezas ........... mínimo ${String(pz.min)} · mediana ${String(pz.mediana)} · máximo ${String(pz.max)}\n` +
          `económico ·   celdas caminadas . mínimo ${String(c.min)} · mediana ${String(c.mediana)} · máximo ${String(c.max)}\n` +
          `económico ·   STAMINA (celdas × ${COSTO_POR_CELDA.toFixed(2)}, y NADA de vivir: esos segundos ya los cobra la partida) ` +
          `mínimo ${stam.min.toFixed(1)} · mediana ${stam.mediana.toFixed(1)} · máximo ${stam.max.toFixed(1)}\n` +
          `económico ·   SEGUNDOS que no se pescan: mínimo ${tiempo.min.toFixed(1)} · mediana ${tiempo.mediana.toFixed(1)} · máximo ${tiempo.max.toFixed(1)}`,
      )
    }
    // Lo que decide todo lo de abajo: el acarreo del fuego sostenido es CARO EN
    // CELDAS y BARATO EN STAMINA, porque caminar cuesta 0,05 y encender 659,86. Un
    // orden de magnitud de diferencia no es un detalle de calibración.
    const sostenido = ORILLAS.map((o, i) => acarrear((COMUNES[i] as Partida).seed, o, SEGUNDOS_DE_PARTIDA))
    const peor = extremos(sostenido.map((r) => r.celdasCaminadas * COSTO_POR_CELDA)).max
    expect(peor).toBeLessThan(PRECIO_DEL_FUEGO.precio)
  })

  it('CUÁNTAS PIEZAS COCINA ESE FUEGO EN SU VIDA: todas, y ésa es la respuesta', () => {
    // La pregunta tiene una respuesta que no depende de la leña, y por eso está acá
    // y no adentro de la cuenta: **cocinar no es rival**. La exposición de la ley 5
    // se calcula por cuerpo contra la fuente que más lo calienta y nada la reparte,
    // así que un fuego cocina todo lo que se le apile encima al mismo precio — 200
    // pescados de 2 kg medidos en `perceive/tests/ataque-a-la-costura.test.ts`.
    //
    // Lo que acota cuántas piezas cocina un fuego NO es el fuego: es cuántas saca la
    // criatura. Y de ahí sale el hallazgo que da vuelta el supuesto del bloque 5:
    // **el fuego no tiene por qué durar los 1000 segundos**. Tiene que durar UNA
    // cocción.
    const piezas = extremos(COMUNES.map((p) => p.piezas))
    const porFuego = Math.ceil(PRECIO_DEL_FUEGO.precio / LO_QUE_PAGA_UNA_PIEZA)
    console.log(
      `económico · PIEZAS POR FUEGO:\n` +
        `económico ·   el fuego no pone tope: cocinar no es rival y 200 piezas salen cocidas a la vez\n` +
        `económico ·   la común saca entre ${String(piezas.min)} y ${String(piezas.max)} piezas (mediana ${String(piezas.mediana)}), y el fuego se paga con ${String(porFuego)}\n` +
        `económico ·   el fuego SOSTENIDO dura ${String(SEGUNDOS_DE_PARTIDA)} s y pide 20 kg de madera; la HORNADA dura ${SEGUNDOS_DE_UNA_COCCIÓN.toFixed(2)} s y pide ${(SEGUNDOS_DE_UNA_COCCIÓN / segundosDeFuegoPorKilo('madera')).toFixed(3)} kg\n` +
        `económico ·   o sea que la estrategia barata pide ${(SEGUNDOS_DE_PARTIDA / SEGUNDOS_DE_UNA_COCCIÓN).toFixed(0)}× menos leña, y cocina LAS MISMAS piezas`,
    )
    expect(piezas.min).toBeGreaterThanOrEqual(porFuego)
    // Un leño solo de un kilo —de los que la orilla tiene de sobra— dura diez veces
    // lo que una cocción. La hornada no necesita que nadie junte nada.
    expect(segundosDeFuegoPorKilo('madera')).toBeGreaterThan(10 * SEGUNDOS_DE_UNA_COCCIÓN)
  })

  it('CON LA LEÑA COBRADA LA VENTANA TAMPOCO CIERRA, y el bug de las constantes NO era el problema económico', () => {
    // ─── ESTO DEJÓ DE SER UNA DEUDA: ES LA IMPOSIBILIDAD, AFIRMADA ─────────
    //
    // Este `it` fue un `it.fails` mientras se lo leía como «falta algo para que la
    // ventana del ADR II-0009 cierre». No falta nada: **esa ventana es un conjunto
    // vacío**, y este bloque es el que lo demuestra con los dos números que se
    // cruzan. Un `it.fails` que nadie va a cerrar es ruido; una imposibilidad
    // afirmada es un guardián — si mañana alguien mueve una constante y los bordes
    // se descruzan, los `expect` de abajo se ponen rojos y hay que venir a mirar.
    //
    // QUÉ MIDE: la hipótesis del tramo era «el problema económico y el bug de las
    // constantes eran el mismo problema», y la medición dice que NO. El bug hacía
    // imposible el supuesto del bloque 5 («un fuego sostenido 1000 s»); arreglarlo
    // lo hizo posible, y comprarlo resulta ser **barato**: la leña de los mil
    // segundos sale en stamina mucho menos de lo que falta. El agujero no estaba en
    // la leña.
    //
    // Y HAY UNA SEGUNDA MITAD, que es la que da vuelta la pregunta: **el fuego no
    // tiene por qué durar 1000 segundos**. Cocinar no es rival, así que una sola
    // hornada al final del día cocina todo lo del día, y esa hornada pide un fuego
    // de 4,70 s, o sea 0,094 kg de madera. La estrategia barata deja el acarreo en
    // menos de un punto de stamina. O sea que el supuesto «leña gratis» del bloque 5
    // no era optimista: era **casi exacto**.
    //
    // Lo único que la cuenta honesta le corrige al bloque 5 va en la dirección BUENA
    // y es chico: `PRECIO_DEL_FUEGO` cobra 2,40 de vivir los 2,4 s de frotar, y esos
    // segundos ya están adentro de los mil que `p.costo` cobra. Descontarlo deja el
    // fuego en 657,46.
    //
    // QUÉ HABRÍA HECHO FALTA para que la ventana existiera, con los números de hoy
    // y por los tres caminos que el bloque 5 nombra. Ninguno se elige acá, y dos de
    // los tres están cerrados:
    //
    //   1. QUE EL POZO RINDA MÁS. El factor está medido abajo. Es
    //      `STAMINA_POR_CALORIA` o el `nutrition` del catálogo, y mueve el hambre
    //      entera: no es cerrar un hueco, es rediseñar el metabolismo.
    //   2. QUE VIVIR CUESTE MENOS. **Y ÉSTE TAMBIÉN ESTÁ CERRADO**, que es el
    //      hallazgo que este bloque agrega y que el 5 no podía ver. El número que
    //      haría falta está medido abajo, y hay que compararlo contra el OTRO borde
    //      de la ventana del ADR II-0009: el precio de vivir al que la criatura
    //      sobrevive comiendo CRUDO. Si el precio que salva a la que cocina está
    //      por DEBAJO del que salva a la que no, no existe ningún valor de
    //      `COSTO_VIVIR_POR_SEGUNDO` que cumpla la ventana entera — bajarlo hasta
    //      que cocinar alcance hace que comer crudo también alcance, y ahí el motor
    //      de la historia se apaga. Los dos bordes se cruzaron, y ésa es la
    //      diferencia entre «hay que barrer una perilla» y «esta perilla no tiene
    //      una posición que sirva».
    //   3. QUE EL FUEGO SE AMORTICE MÁS. Este camino ya se gastó y ahora se sabe por
    //      qué: cocinar no es rival, un fuego cocina todo lo que salga del agua en
    //      la partida, y ni así alcanza.
    //
    // La salida 2 del bloque 5 —«que encender salga más barato»— sigue cerrada por
    // arriba y por el mismo motivo aritmético, que la leña no toca: pediría
    // eficiencia 1,51 en el `poweredBy` de `friccion`.
    const filas: string[] = []
    const netos = new Map<string, number[]>()
    for (const [nombre, pide] of ESTRATEGIAS) {
      const neto = COMUNES.map((p, i) => netoConElFuegoEntero(p, ORILLAS[i] as ChunkDecretado, pide))
      netos.set(nombre, neto)
      const e = extremos(neto)
      filas.push(
        `económico ·   fuego «${nombre}» ${''.padEnd(10 - nombre.length)}... mínimo ${e.min.toFixed(1)} · mediana ${e.mediana.toFixed(1)} · máximo ${e.max.toFixed(1)} · ` +
          `${String(neto.filter((x) => x <= 0).length)} de ${String(PARTIDAS)} debiendo`,
      )
    }
    const viejo = extremos(COMUNES.map((p) => p.netoCocinado - PRECIO_DEL_FUEGO.precio))
    const hornada = netos.get('hornada') as number[]
    const eHornada = extremos(hornada)
    const eSostenido = extremos(netos.get('sostenido') as number[])

    // CUÁNTO FALTA, y por los dos caminos que siguen abiertos. Se despeja sobre la
    // estrategia BARATA, que es la que menos pide: si no cierra la barata, no
    // cierra ninguna.
    const conAcarreo = COMUNES.map((p, i) => {
      const a = acarrear(p.seed, ORILLAS[i] as ChunkDecretado, SEGUNDOS_DE_UNA_COCCIÓN)
      const perdidos = (a.celdasCaminadas + a.piezas) * DT + PRECIO_DEL_FUEGO.segundos
      return {
        ingreso: p.ingresoCocinado * ((SEGUNDOS_DE_PARTIDA - perdidos) / SEGUNDOS_DE_PARTIDA),
        fijo: PRECIO_DEL_FUEGO.termico + a.celdasCaminadas * COSTO_POR_CELDA + p.celdasCaminadas * COSTO_POR_CELDA,
      }
    })
    const falta = -eHornada.min
    const factorDelPozo = extremos(
      conAcarreo.map((x) => (COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA + x.fijo) / x.ingreso),
    ).max
    // Vivir entra en un solo lugar de esta cuenta —los 1000 segundos— porque los 2,4
    // de frotar ya se cobraron ahí adentro. De ahí se despeja limpio.
    const vivirQueHaríaFalta = extremos(conAcarreo.map((x) => (x.ingreso - x.fijo) / SEGUNDOS_DE_PARTIDA)).min
    // Y EL OTRO BORDE, medido acá y no copiado del test de la ventana: el precio de
    // vivir por encima del cual la que come CRUDO se muere. Es el mismo `abajo` de
    // «EL CRITERIO DEL ADR II-0009», y se recalcula porque de la comparación entre
    // los dos sale la conclusión.
    const bordeDelCrudo = extremos(
      COMUNES.map((p) => (p.ingresoCrudo - p.celdasCaminadas * COSTO_POR_CELDA) / SEGUNDOS_DE_PARTIDA),
    ).max
    console.log(
      `económico · LA VENTANA CON LA LEÑA COBRADA:\n` +
        `económico ·   el número VIEJO (bloque 5, leña gratis) . mínimo ${viejo.min.toFixed(1)} · mediana ${viejo.mediana.toFixed(1)} · máximo ${viejo.max.toFixed(1)}\n` +
        `${filas.join('\n')}\n` +
        `económico ·   → la leña mueve el mínimo en ${(eHornada.min - viejo.min).toFixed(1)} con la hornada y en ${(eSostenido.min - viejo.min).toFixed(1)} con el fuego sostenido\n` +
        `económico ·   FALTAN ${falta.toFixed(1)} de stamina en la partida más flaca de las cien\n` +
        `económico ·   camino 1 · el pozo tendría que rendir ${factorDelPozo.toFixed(2)}× lo que rinde\n` +
        `económico ·   camino 2 · CERRADO: vivir tendría que costar ${vivirQueHaríaFalta.toFixed(3)}/s para que cocinar alcance, ` +
        `y a ${bordeDelCrudo.toFixed(3)}/s ya alcanza comer CRUDO. Los dos bordes se cruzaron: no hay valor que cumpla la ventana entera\n` +
        `económico ·   camino 3 · gastado: cocinar no es rival y el fuego ya cocina todo lo que sale del agua`,
    )
    // LOS DOS BORDES CRUZADOS. Es la afirmación más fuerte del bloque y no depende
    // de ninguna copia: los dos números salen de las mismas cien partidas.
    expect(vivirQueHaríaFalta).toBeLessThan(bordeDelCrudo)
    // La leña no mueve la conclusión, y eso es lo que este bloque tiene que
    // afirmar: entre la cuenta con leña gratis y la cuenta con la leña cobrada de
    // verdad hay menos de tres puntos de stamina en la estrategia barata.
    expect(Math.abs(eHornada.min - viejo.min)).toBeLessThan(3)
    // Y LA IMPOSIBILIDAD, CONTADA. Éste era el `expect` que mantenía el hueco
    // abierto —`toBeGreaterThan(0)` sobre las cien—, y ahora afirma lo medido: con
    // la estrategia MÁS BARATA que existe, 91 de las 100 partidas terminan
    // debiendo, y la más flaca debe 505,5. Que 9 zafen no rescata nada: para que la
    // ventana fuera un intervalo tendrían que ser las cien.
    expect(hornada.filter((x) => x <= 0).length).toBe(91)
    expect(Number(eHornada.min.toFixed(1))).toBe(-505.5)
  })

  it('las DOS constantes de la ley 3 copiadas de `@anima/physics` siguen diciendo lo que dicen acá', () => {
    // El mismo guardián que las tres de `@anima/world`, y hace más falta que aquél:
    // estas dos NO están exportadas —son `const` de módulo— así que ni siquiera un
    // import las traería, y son exactamente las dos que este tramo tocó. Una copia
    // de una constante que acaba de cambiar es la que más se va a quedar vieja.
    const leyes = fileURLToPath(new URL('../../physics/src/leyes.ts', import.meta.url))
    const fuente = readFileSync(leyes, 'utf8')
    const valorDe = (nombre: string): number => {
      const m = new RegExp(`const ${nombre} = ([0-9.]+)`).exec(fuente)
      if (m === null) throw new Error(`«${nombre}» ya no está en ${leyes}: el modelo de leña de este test quedó viejo`)
      return Number(m[1])
    }
    expect(valorDe('TASA_CARBONIZACION')).toBe(TASA_CARBONIZACION)
    expect(valorDe('COMBUSTIBLE_POR_SEGUNDO')).toBe(COMBUSTIBLE_POR_SEGUNDO)

    // Y LA FORMA, que es lo que el tramo arregló y lo que se puede desarreglar sin
    // tocar ningún valor: la carbonización se DIVIDE por la masa —eso es lo que la
    // hace extensiva— y el combustible se compara contra `fuelEnergy · mass`. Si
    // alguien saca una de las dos, los números de arriba siguen siendo 0,016 y 0,3
    // y este archivo estaría midiendo un mundo que ya no existe. Es exactamente el
    // bug que este tramo encontró, escrito como guardián para que no vuelva.
    const dice = (p: RegExp): boolean => p.test(fuente)
    expect(['carbonizar es POR KILO', dice(/porPaso\(TASA_CARBONIZACION, dt\) \/ masa/)]).toEqual([
      'carbonizar es POR KILO',
      true,
    ])
    expect(['el combustible es EXTENSIVO', dice(/l\.fuelEnergy \* l\.mass/)]).toEqual([
      'el combustible es EXTENSIVO',
      true,
    ])
  })
})
