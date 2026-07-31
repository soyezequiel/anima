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
// decir en voz alta antes de que alguien lo descubra solo: `COSTO_VIVIR_POR_SEGUNDO`
// valió 1,0 desde el ADR II-0009 y hoy vale **0,34**, y las dos veces el número se
// eligió mirando mediciones de este archivo. La segunda vez, más todavía: 0,34 es
// el centro exacto de la ventana `(0,3100 ; 0,3637)` que publica el último bloque.
// Por eso ningún test de acá dice `COSTO_VIVIR_POR_SEGUNDO === 0.34`: estaría
// midiendo su propia copia y no diría nada.
//
// **Y OJO CON LA PALABRA «VENTANA», que este archivo usó mal durante un tramo.**
// El ADR II-0009 escribió que el 1,0 vive adentro de una ventana `(0,766 ; 1,155)`
// donde pasan dos cosas a la vez —comer crudo da negativo y cocinar da positivo—.
// Esa ventana era **un conjunto vacío**: con el precio del fuego adentro, para que
// cocinar alcanzara hacía falta 0,494 por segundo, y a 0,766 ya alcanzaba comer
// crudo. Los dos bordes se cruzaban.
//
// EL ADR II-0013 LOS DESCRUZÓ, y los `expect` que afirmaban la imposibilidad se
// pusieron rojos —que era exactamente para lo que estaban—. Con el veneno cobrado,
// comer crudo dejó de ser ingreso y pasó a ser EGRESO, así que el borde de abajo se
// desplomó de +0,766 a −0,488 y el de arriba bajó apenas, de +0,494 a +0,364. La
// ventana existe y es `(0 ; 0,364)`.
//
// **Y EL 1,0 QUEDÓ AFUERA**, 2,7× por encima del borde de arriba, así que la
// consecuencia era la misma que antes y el diagnóstico otro: antes no había ningún
// valor posible, después hubo un intervalo y el vigente caía afuera.
//
// ─── TERCER ACTO: EL VALOR VIGENTE ENTRÓ EN LA VENTANA ─────────────────────
//
// Y acá es donde este archivo tiene que contar la tercera vez que el mismo número
// se volvió a medir, porque es la que le da sentido a las dos anteriores. El
// usuario **bajó `COSTO_VIVIR_POR_SEGUNDO` de 1,0 a 0,34**, mirando la ventana con
// sus DOS bordes que publica el último bloque del archivo —el de arriba lo pone
// esta economía (arriba de ahí cocinar no alcanza en las cien) y el de abajo el
// arnés del Hito 5 (abajo de ahí el tanque de 310 llega a los 20.000 ticks
// quieta)—:
//
//                 borde de ABAJO     valor elegido     borde de ARRIBA
//   la ventana      0,3100/s      →     0,34/s     ←      0,3637/s
//
// 0,34 es el CENTRO de esa ventana, y con eso se dieron vuelta seis afirmaciones
// de este archivo a la vez. Lo que hoy está medido:
//
//   · **sin trabajo la energía neta sigue siendo NEGATIVA en las cien** (el
//     criterio del riesgo 4, bloque 4). Eso no se movió y no se podía mover: lo
//     que el mundo deja tirado es, casi todo, veneno;
//   · **comer crudo tampoco alcanza en las cien**, ni trabajando ni con suerte;
//   · **cocinar ya no es «una mejora que no alcanza»: alcanza.** El neto cocinado
//     con el fuego pagado entero pasó de −635,8 a **+25,8** en la partida más
//     flaca, y de **99 de 100 debiendo a 0 de 100**;
//   · y la «salida 2» del bloque 5 —que encender salga más barato— **dejó de estar
//     cerrada**: la eficiencia de fricción que haría falta pasó de 10,60, que es
//     movimiento perpetuo, a **0,337**, que es menos que el 0,35 que la fricción ya
//     tiene. La cerradura no era la física: era el precio de vivir.
//
// Lo que NO cambió es la regla: ninguna de esas seis afirmaciones se fabricó desde
// acá. Se midieron, se publicó la ventana con sus dos bordes, y la perilla la movió
// el usuario en `@anima/world`. Bajarla desde el arnés para que las cuentas cierren
// sigue siendo lo que este archivo entero existe para no hacer.

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

/**
 * EL TANQUE DE ARRANQUE DEL CRITERIO, copiado con su ruta y con guardián.
 *
 * Es una `const` de `juez/tests/hito-5-la-emergencia.test.ts`, o sea de un test de
 * otro paquete: ningún import lo trae. Entra acá porque es el borde de ABAJO de la
 * ventana del costo de vivir —abajo de `TANQUE / SEGUNDOS_DE_PARTIDA` la criatura
 * llega a los 20.000 ticks sin comer— y sin él la ventana parece arrancar en cero.
 * El `it` que lo verifica está al final del archivo.
 */
const TANQUE_DEL_CRITERIO = 310
/** Y los ticks del mismo criterio, del mismo archivo y con el mismo guardián. */
const TICKS_DEL_CRITERIO = 20_000

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
 * cuesta 340 a las cinco.
 *
 * **BAJÓ DE 1,0 A 0,34**, decidido por el usuario y con los dos bordes que este
 * archivo mide: la ventana es `(0,3100 ; 0,3637)` y 0,34 es su centro. El de
 * arriba lo pone este archivo —arriba de ahí cocinar no alcanza en las cien— y el
 * de abajo el arnés del Hito 5 —abajo de ahí el tanque de 310 llega a los 20.000
 * ticks quieta—. Ver el bloque «LA VENTANA ENTERA DE `COSTO_VIVIR_POR_SEGUNDO`».
 */
const COSTO_VIVIR_POR_SEGUNDO = 0.34

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
 * `COSTO_POR_TOXICIDAD_Y_KILO`: lo que cuesta tragar UN KILO de algo con
 * `toxicity` 1 (ADR II-0013). La `K` del ADR.
 *
 * **NO es una tasa**, igual que `COSTO_POR_CELDA`: sus unidades son stamina por
 * (toxicidad × kilo), y no se divide ni se multiplica por ningún tiempo. `toxicity`
 * es intensiva, así que lo que se traga de veneno es `toxicity · masa`, exactamente
 * igual que lo que se traga de alimento es `nutrition · masa`.
 *
 * Es la CUARTA constante copiada de `@anima/world/src/step.ts`, con el mismo
 * guardián que las otras tres. El 25 no se eligió acá ni allá: se despejó del
 * catálogo en `world/tests/el-veneno-se-cobra.test.ts`, donde la ventana
 * `(12,16 ; 55)` se mide con sus dos bordes antes de elegir el número.
 */
const COSTO_POR_TOXICIDAD_Y_KILO = 25

/**
 * **La perilla que sí es de acá**: cuánto pesa una pieza.
 *
 * Un pescado de 2 kg crudo son `8 × 2 × 0,38` = 6,08 calorías, y desde el ADR
 * II-0013 el mismo bocado se cobra `0,25 × 2 × 25` = 12,50 de veneno, o sea que
 * **deja −6,42**. Cocinado —digestibilidad al techo de la ley 5, toxicidad la
 * medida— son 15,2 menos 1,73, o sea +13,47. El mismo bicho, dos economías, y con
 * el veneno adentro ya no es una diferencia de grado: es un cambio de signo.
 */
const MASA_DE_UNA_PIEZA = fx(2)

/**
 * **La tercera perilla de acá, y es otra medición ajena**: a qué `toxicity` llega
 * un pescado de 2 kg en el instante en que el mundo lo llama COCIDO
 * (`digestibility ≥ 0,85`).
 *
 * No se puede despejar del catálogo y no se estima: sale de correr
 * `leyDesnaturalizacion` adentro de `stepWorld` contra un mundo con fuego de
 * verdad, y este paquete no puede correrlo (`@anima/oracle` no importa
 * `@anima/world`). El número viene MEDIDO de `world/tests/el-veneno-se-cobra.test.ts`
 * bloque (c), donde está la tabla de las doce comidas y donde este valor está
 * clavado con un `expect`.
 *
 *   pescado 2 kg → cocido a los 6,55 s · digestibility 0,38 → 0,8526
 *                  **toxicity 0,25 → 0,0345 (−86,2%)** · masa 2,00 → 1,9256
 *
 * EL HALLAZGO QUE ESTE NÚMERO TRAE: la ley 5 se lleva el veneno mucho más rápido
 * de lo que ablanda. Nadie escribió esa asimetría —la destoxificación es
 * multiplicativa y la digestibilidad se acerca a un techo— y es la mitad de por
 * qué cocinar paga con el ADR II-0013 adentro.
 *
 * Y ES UN EMPAREJAMIENTO PESIMISTA, dicho para que nadie lo lea al revés: este
 * archivo modela el ingreso cocinado con `DIGESTIBILIDAD_TECHO` (0,95), que es el
 * límite asintótico, mientras cobra el veneno del instante en que la pieza recién
 * cruza 0,85 y todavía tiene la toxicidad más alta de todo el resto de la cocción.
 * Si se dejara cocinar hasta el techo de verdad, la toxicidad tiende a cero y el
 * cocido saldría MEJOR de lo que este archivo dice.
 */
const TOXICIDAD_DEL_PESCADO_COCIDO = 0.0345

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

/**
 * LO QUE EL VENENO SE LLEVA de esa misma pieza (ADR II-0013), en `stamina`.
 *
 * Va aparte de `caloriasDelBocado` y no neteado adentro, y no es prolijidad: es la
 * decisión del ADR. «Un solo número que mezcle lo que la comida dio con lo que el
 * veneno costó esconde las dos mitades.» El mundo emite dos eventos por la misma
 * razón; acá son dos funciones.
 *
 * La `toxicity` sale de la MISMA cualidad que el mundo lee al tragar, y por eso se
 * pregunta armando el cuerpo en vez de copiar el número del catálogo: si mañana
 * alguien recalibra una sustancia, lo que el chunk paga y lo que la criatura pierde
 * se mueven juntos.
 */
function venenoDelBocado(substance: SubstanceId, masa: Fixed, toxicity?: number): number {
  const bocado: Body = {
    id: 'bocado',
    form: 'bloque',
    parts: [{ substance, mass: unfx(masa), q: toxicity === undefined ? {} : { toxicity } }],
    joints: [],
    state: {},
  }
  return (
    qualityOf(bocado, 'toxicity', PHYS) *
    qualityOf(bocado, 'mass', PHYS) *
    COSTO_POR_TOXICIDAD_Y_KILO
  )
}

/** Lo que una pieza deja DE VERDAD: las calorías menos el veneno. Es el número
 *  con el que este archivo hace toda la economía desde el ADR II-0013. */
function netoDelBocado(
  substance: SubstanceId,
  masa: Fixed,
  cocido?: { digestibility: number; toxicity: number },
): number {
  const cal = caloriasDelBocado(substance, masa, cocido?.digestibility) * STAMINA_POR_CALORIA
  return cal - venenoDelBocado(substance, masa, cocido?.toxicity)
}

/** Lo que cocinar le hace a un PESCADO, con las dos cualidades que la ley 5 mueve.
 *  Las dos juntas y no una: subir la digestibilidad sin bajar la toxicidad sería
 *  cocinar a medias, y el número saldría mal en la dirección conveniente. */
const COCIDO = { digestibility: DIGESTIBILIDAD_TECHO, toxicity: TOXICIDAD_DEL_PESCADO_COCIDO }

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

/**
 * Lo que cocinar le agrega a UNA pieza: la misma materia, la otra digestibilidad
 * **y el otro veneno**.
 *
 * Antes del ADR II-0013 eran 9,12 —la diferencia de calorías y nada más—. Ahora
 * son 17,72, porque cocinar hace DOS cosas y no una: sube lo que la pieza da y
 * baja lo que la pieza cuesta. Que el margen casi se duplique es lo que hace que
 * el fuego se pague con la mitad de las piezas que antes.
 */
const LO_QUE_PAGA_UNA_PIEZA =
  netoDelBocado('pescado', MASA_DE_UNA_PIEZA, COCIDO) - netoDelBocado('pescado', MASA_DE_UNA_PIEZA)

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
  /**
   * Lo que las piezas dejan comidas CRUDAS, **con el veneno ya descontado**
   * (ADR II-0013). Puede ser negativo, y con el catálogo de hoy lo es siempre:
   * un pescado de 2 kg acredita 6,08 y el veneno se lleva 12,50.
   */
  readonly ingresoCrudo: number
  readonly ingresoCocinado: number
  /** Lo que el veneno del CRUDO se llevó, aparte. Se lleva por separado por lo
   *  mismo que el mundo emite dos eventos: un solo número escondería las mitades. */
  readonly venenoCrudo: number
  /** Y lo que se lleva el del cocido, que es 7,2× menos. */
  readonly venenoCocinado: number
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
  let venenoCrudo = 0
  let venenoCocinado = 0

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
    // Las CUATRO mitades, sin netear entre ellas: lo que la comida da y lo que el
    // veneno cuesta, crudo y cocido. La tabla de abajo las imprime las cuatro.
    crudo += caloriasDelBocado(r.yields, r.masa) * STAMINA_POR_CALORIA
    cocinado += caloriasDelBocado(r.yields, r.masa, COCIDO.digestibility) * STAMINA_POR_CALORIA
    venenoCrudo += venenoDelBocado(r.yields, r.masa)
    venenoCocinado += venenoDelBocado(r.yields, r.masa, COCIDO.toxicity)
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
    // EL VENENO ENTRA ACÁ, y en un solo lugar: los `ingreso*` pasan a ser NETOS de
    // veneno, así que todo lo que este archivo construye encima —las tablas, los
    // bordes, el punto de equilibrio, las dos estrategias de fuego— se rehace solo
    // y con el mismo álgebra. Es lo que el ADR II-0013 pide: «toda la cuenta
    // económica hay que rehacerla con el veneno cobrado».
    ingresoCrudo: crudo - venenoCrudo,
    ingresoCocinado: cocinado - venenoCocinado,
    venenoCrudo,
    venenoCocinado,
    costo,
    netoCrudo: crudo - venenoCrudo - costo,
    netoCocinado: cocinado - venenoCocinado - costo,
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
    fila('calorías crudas', (p) => p.ingresoCrudo + p.venenoCrudo),
    fila('· menos VENENO', (p) => -p.venenoCrudo),
    fila('= ingreso crudo', (p) => p.ingresoCrudo),
    fila('calorías cocinadas', (p) => p.ingresoCocinado + p.venenoCocinado),
    fila('· menos VENENO', (p) => -p.venenoCocinado),
    fila('= ingreso cocinado', (p) => p.ingresoCocinado),
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

/** Un bocado tirado en el mundo: dónde está, qué da y qué cuesta comido CRUDO. */
interface Bocado {
  readonly x: number
  readonly y: number
  /** Lo que acredita: `nutrition · masa · digestibility`. Sale del mundo. */
  readonly calorias: number
  /** Lo que el veneno se lleva: `toxicity · masa · K` (ADR II-0013). */
  readonly veneno: number
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
        // El filtro sigue siendo por CALORÍAS y no por el neto, y es a propósito:
        // lo que el carroñero ve tirado es comida, y el ADR II-0013 no le da a
        // nadie una nariz que distinga el veneno antes de tragarlo. Filtrar por el
        // neto sería un carroñero que ya sabe cuál le conviene, o sea la versión
        // MÁS generosa todavía de «no trabajar» — y el criterio del riesgo 4 ya se
        // mide con la más generosa que se puede escribir sin regalar información.
        if (calorias <= 0) continue
        bocados.push({
          x: (cx + dx) * CELDAS_DE_LADO + (s.i % CELDAS_DE_LADO),
          y: (cy + dy) * CELDAS_DE_LADO + Math.floor(s.i / CELDAS_DE_LADO),
          calorias,
          veneno: venenoDelBocado(s.substance, s.masa),
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
  /** El ingreso NETO de veneno (ADR II-0013). Puede ser —y es— negativo. */
  readonly ingreso: number
  /**
   * Las CALORÍAS BRUTAS que se llevó, sin descontar el veneno. Se guarda aparte
   * porque contesta otra pregunta: lo que sale del mundo sin que ningún techo lo
   * anote es materia y no balance, así que la «fuga» del bloque (e) se mide con
   * esto y no con el neto. Netear ahí sería medir la salud de la criatura y
   * llamarla contabilidad del dios.
   */
  readonly caloriasBrutas: number
  /** Y lo que el veneno se llevó, para poder decir cuál de las dos mitades manda. */
  readonly veneno: number
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
  let caloriasBrutas = 0
  let veneno = 0
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
    // El orden es el del mundo (`intencionComer`, ADR II-0013): primero acredita y
    // después cobra. No es lo mismo que sumar el neto: si el crédito la salva del
    // cero y el veneno la vuelve a bajar, el tick de la muerte cae en otro lado.
    stamina += p.calorias
    gastar(p.veneno)
    caminadas += d
    piezas++
    ingreso += p.calorias - p.veneno
    caloriasBrutas += p.calorias
    veneno += p.veneno
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
    caloriasBrutas,
    veneno,
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
    // ─── (a) LA LÍNEA DE BASE SE MOVIÓ, Y ES UN GUARDIÁN QUE CUMPLIÓ ───────
    //
    // Este bloque decía `(STAMINA_DE_ARRANQUE / COSTO_VIVIR_POR_SEGUNDO) * HZ` igual
    // a `TICKS / 2`, con este comentario textual: «El ADR II-0009 ya midió que con la
    // `stamina` de arranque y 1,0 por segundo una criatura que no hace absolutamente
    // nada se muere en el tick 10.000 de los 20.000, o sea la mitad exacta de la
    // partida. Acá esa cuenta se rehace desde el catálogo —el techo de `stamina` y la
    // constante copiada— para que si alguien mueve cualquiera de las dos, el número
    // del ADR deje de cuadrar acá y no dentro de tres meses».
    //
    // Alguien movió una de las dos, y el número del ADR dejó de cuadrar acá el mismo
    // día: `COSTO_VIVIR_POR_SEGUNDO` bajó de 1,0 a 0,34. La igualdad con `TICKS / 2`
    // nunca fue una ley — era la coincidencia de que 500 dividido 1,0 por 20 Hz diera
    // justo la mitad de la partida — y por eso estaba escrita para saltar.
    //
    //   antes   500 / 1,00 × 20 = 10.000 ticks · la mitad exacta de la partida
    //   ahora   500 / 0,34 × 20 = 29.411,76 ticks · 1,47× la partida ENTERA
    //
    // Y ESO NO ES SÓLO UN NÚMERO: cambia el bloque (c) de más abajo. **El que se
    // queda quieto ya no se muere adentro de los 20.000.** La comparación de (c) —«el
    // carroñero se muere antes que el que no hace nada»— no se debilita con eso: se
    // vuelve categórica, porque el otro extremo dejó de morirse del todo.
    expect(STAMINA_DE_ARRANQUE).toBe(500)
    const ticksDelQueNoHaceNada = (STAMINA_DE_ARRANQUE / COSTO_VIVIR_POR_SEGUNDO) * HZ
    expect(Number(ticksDelQueNoHaceNada.toFixed(2))).toBe(29411.76)
    expect(ticksDelQueNoHaceNada).toBeGreaterThan(TICKS)

    // ─── (b) EL CARROÑERO: las cien, y no la mediana ───────────────────────
    //
    // ESTE ES EL BLOQUE QUE EL ADR II-0013 REFORZÓ, y estaba previsto en el ADR
    // («se espera que el criterio del riesgo 4 se refuerce: el carroñero come lo
    // que hay tirado, y lo que hay tirado es justo lo de `K` bajo»). Medido, y no
    // supuesto:
    //
    // (Las dos primeras columnas se remidieron corriendo este mismo archivo con
    // `world/src/step.ts` revertido, y no se copiaron de ningún informe. La tercera
    // es la corrida de HOY. Mínimo / mediana / máximo, las cien partidas.)
    //
    //                     antes del II-0013      con el II-0013 y vivir 1,0    HOY, vivir 0,34
    //   INGRESO ...  +104,3 / +434,8 / +529,2   −4472,2 / −2173,0 / −1293,9   IGUAL que la anterior
    //   NETO .....  −1803,1 / −1435,4 / −1321,8 −6361,6 / −4040,9 / −3214,9  −5701,6 / −3380,9 / −2554,9
    //   MUERE en    5508 / 7085 / 7719           1453 / 2402 / 3249            1560 / 2847,5 / 4064
    //
    // Y LA TERCERA COLUMNA DICE ALGO QUE HAY QUE LEER DERECHO. Bajar el costo de
    // vivir a 0,34 le regaló al carroñero 660 de stamina —los 1000 segundos salen
    // 340 y no 1000— y con eso el neto mejoró en exactamente esos 660 y la muerte se
    // corrió 445 ticks en la mediana. **El INGRESO no se movió ni un decimal**, y no
    // podía: el ingreso es lo que la comida da menos lo que el veneno cuesta, y
    // ninguna de las dos mitades sabe cuánto sale estar vivo. O sea que el criterio
    // del riesgo 4 no se sostiene sobre la perilla que se movió: se sostiene sobre
    // que lo que hay tirado es veneno, y eso no lo toca ninguna calibración del
    // metabolismo. Es la mejor noticia que este bloque podía dar el día que alguien
    // mueve una constante.
    //
    // El carroñero levanta entre 1580 y 2978 piezas de lo que `scatter` deja tirado
    // —hojas, hongos, raíces duras, tubérculos— y ésas son EXACTAMENTE las de `K` de
    // corte más bajo: 1,67, 1,64, 1,50 y 3,60 contra un `K` de 25. O sea que lo que
    // el mundo deja tirado es, casi todo, veneno. El ingreso pasó de ser un tercio
    // de lo que cuesta vivir a ser un EGRESO de dos mil, y el que no trabaja se
    // muere en el tick 2847 —el 14% de la partida— en vez de en el 7085 (el 35%).
    for (const p of SIN_TRABAJO) expect(p.neto).toBeLessThan(0)
    // Y ahora también el INGRESO solo, sin restarle nada: comer lo que hay tirado
    // no es «poco», es NEGATIVO. Ésta es la afirmación que el II-0013 agrega y que
    // antes no se podía hacer.
    for (const p of SIN_TRABAJO) expect(p.ingreso).toBeLessThan(0)

    // ─── (c) Y SE MUERE, que es la otra mitad de lo que el criterio quiere ─
    //
    // Un acumulado negativo con un tanque que nunca toca cero sería una criatura
    // que termina debiendo y sigue viva. El carroñero no llega: se muere **y se
    // muere adentro de la partida**, mientras el que se queda quieto ya no se muere
    // ni una sola vez en los 20.000 (bloque (a)). Ése es el hallazgo que da vuelta
    // la intuición, y con el costo de vivir en 0,34 se hizo MÁS fuerte y no menos:
    // caminar cuesta 0,05 por celda y a una celda por tick eso es 1,0 por segundo,
    // o sea que buscar comida tirada ahora cuesta CASI CUATRO VECES lo que vivir
    // —era el doble cuando vivir salía 1,0— y lo que encuentra sigue sin pagarlo.
    //
    // La cota de acá abajo decía `TICKS / 2`, y ese 10.000 no era la mitad de la
    // partida por casualidad: era donde se moría el que no hacía nada cuando vivir
    // costaba 1,0. El ancla dejó de existir —el quieto se fue a 29.412 ticks, o sea
    // afuera de la partida— así que la cota se pone contra la partida misma. La que
    // más aguanta de las cien se muere en el **4064**, el 20,3% de los 20.000 (era
    // 3249, el 16,2%): la cota es un cuarto de partida y sobra.
    const muerte = extremos(SIN_TRABAJO.map((p) => p.tickDeLaMuerte))
    for (const p of SIN_TRABAJO) expect(p.tickDeLaMuerte).toBeGreaterThan(0)
    expect(muerte.max).toBeLessThan(TICKS / 4)

    // ─── (d) NI REGALÁNDOLE LA CAMINATA ────────────────────────────────────
    //
    // El cierre más fuerte del bloque, y el que no depende del modelo de
    // locomoción: aunque no se le cobrara **una sola celda**, lo que junta en los
    // 1000 segundos no llega a pagar lo que cuesta estar vivo. La conclusión no se
    // apoya en el precio de caminar, así que el hueco 2 no la puede mover.
    //
    // Y la vara contra la que se compara BAJÓ de 1000 a 340 con el nuevo costo de
    // vivir, o sea que este `expect` es hoy 2,9× más exigente que ayer. Pasa igual y
    // por la misma razón de siempre: el ingreso es NEGATIVO (máximo −1293,9), y
    // ningún umbral positivo, por bajo que sea, lo alcanza.
    const ing = extremos(SIN_TRABAJO.map((p) => p.ingreso))
    expect(ing.max).toBeLessThan(COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA)

    // ─── (e) Y LO QUE SE LLEVÓ POR LA PUERTA DE ATRÁS, medido ──────────────
    //
    // Lo suelto NO pasa por `LibroCalorico`: nadie se lo cobra a ningún techo, así
    // que es calorías que salen del mundo sin quedar anotadas. Hay que decirlo, y
    // hay que decir cuánto es: contra el presupuesto calórico de los chunks que
    // barrió, es una migaja. Si mañana `scatter` sembrara diez veces más, este
    // número lo diría antes que nadie.
    //
    // SE MIDE SOBRE LAS CALORÍAS BRUTAS y no sobre el ingreso neto de veneno, y es
    // deliberado: lo que este número persigue es MATERIA que sale del mundo sin
    // quedar anotada en ningún techo, y el veneno no la devuelve. Netear acá haría
    // que la fuga se viera más chica —o negativa— por una razón que no tiene nada
    // que ver con la contabilidad del dios, que es la peor forma de que un número
    // mejore.
    const fuga = extremos(SIN_TRABAJO.map((p) => p.caloriasBrutas / p.techoDeLoBarrido)).max
    expect(fuga).toBeLessThan(0.01)

    const neto = extremos(SIN_TRABAJO.map((p) => p.neto))
    const piezas = extremos(SIN_TRABAJO.map((p) => p.piezas))
    const celdas = extremos(SIN_TRABAJO.map((p) => p.celdasCaminadas))
    const anillos = extremos(SIN_TRABAJO.map((p) => p.anillos))
    console.log(
      `económico · SIN TRABAJO (carroñero: camina y come lo que hay tirado, crudo), ${String(PARTIDAS)} partidas × ${String(TICKS)} ticks:\n` +
        `económico ·   piezas levantadas . mínimo ${String(piezas.min)} · mediana ${String(piezas.mediana)} · máximo ${String(piezas.max)}\n` +
        `económico ·   celdas caminadas . mínimo ${String(celdas.min)} · mediana ${String(celdas.mediana)} · máximo ${String(celdas.max)} (barre hasta el anillo ${String(anillos.max)} de chunks)\n` +
        `económico ·   INGRESO .......... mínimo ${ing.min.toFixed(1)} · mediana ${ing.mediana.toFixed(1)} · máximo ${ing.max.toFixed(1)} · contra ${(COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA).toFixed(0)} que cuesta SÓLO vivir\n` +
        `económico ·   NETO ............. mínimo ${neto.min.toFixed(1)} · mediana ${neto.mediana.toFixed(1)} · máximo ${neto.max.toFixed(1)} → las cien NEGATIVAS\n` +
        `económico ·   MUERE en el tick . mínimo ${String(muerte.min)} · mediana ${String(muerte.mediana)} · máximo ${String(muerte.max)}, y el que no hace NADA ya no se muere: aguanta ${ticksDelQueNoHaceNada.toFixed(0)} ticks, más que los ${String(TICKS)} de la partida\n` +
        `económico ·   lo que se llevó sin que nadie se lo cobre: ${(fuga * 100).toFixed(3)}% del techo calórico de lo que barrió (calorías BRUTAS)\n` +
        `económico ·   y de esas calorías, el VENENO se llevó ${extremos(SIN_TRABAJO.map((p) => p.veneno / p.caloriasBrutas)).mediana.toFixed(1)}× (mediana): ` +
        `lo que el mundo deja tirado es, casi todo, de K de corte 1,5 a 3,6 contra un K de ${String(COSTO_POR_TOXICIDAD_Y_KILO)}`,
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

  it('CERRADO POR EL ADR II-0013 · ni la AFORTUNADA termina en positivo comiendo crudo', () => {
    // ─── ESTO ERA UN `it.fails` Y DEJÓ DE SERLO, Y HAY QUE DECIR POR QUÉ ────
    //
    // Se llamaba «SIGUE ABIERTO · la AFORTUNADA sigue terminando en positivo» y su
    // `expect` final —`netoCrudo < 0` sobre las cien— fallaba por más de tres mil
    // en todas. Ahora pasa: la afortunada termina entre **−5512,5 y −5274,9**.
    //
    // **PERO EL DEFECTO QUE ESTE `it` NOMBRABA NO SE ARREGLÓ**, y confundir las dos
    // cosas sería exactamente el error que este archivo existe para no cometer. En
    // este modelo **viajar sigue sin costar tiempo**: `jugar` le cobra las celdas
    // con `COSTO_POR_CELDA` pero no le adelanta el reloj, así que la afortunada se
    // muda gratis en tiempo y sigue pescando el resto de la partida como si nunca
    // se hubiera ido. Eso está igual que ayer y sigue nombrado abajo.
    //
    // Lo que cambió es que la afirmación dejó de DEPENDER de ese defecto: con el
    // veneno cobrado, **cada bocado crudo deja −6,42**, así que pescar más empeora
    // el balance en vez de mejorarlo y ninguna cantidad de suerte lo da vuelta. El
    // hueco se cerró por arriba —la conclusión ya no necesita la locomoción— y no
    // porque la locomoción se arreglara. Queda como GUARDIÁN: si mañana alguien
    // afloja el cobro del veneno, esto se pone rojo antes que ninguna otra cosa.
    //
    // EL DEFECTO QUE SIGUE, dicho entero para que no se pierda con el `it.fails`:
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
    // El hueco 2 de `@anima/world/tests/el-tiempo-no-depende-del-tick.test.ts`
    // —`intencionCaminar` avanza una celda por TICK, así que «cuántos segundos
    // tarda un viaje» depende de la frecuencia— sigue abierto, y hasta que se
    // cierre este modelo no puede cobrarle el tiempo del viaje a nadie con un
    // número que sea del mundo y no una invención de acá. Eso es locomoción y no
    // metabolismo, y merece su propio ADR (II-0009, «a tener en cuenta»).
    //
    // Y SIGUE SIENDO CIERTO que calibrar contra la afortunada es calibrar contra un
    // adversario: es un dado cargado sobre el pozo más generoso que el paquete deja
    // escribir. Lo que este `it` mide ahora no es una calibración — es que ni el
    // adversario zafa.
    //
    // ─── Y UN NÚMERO DEL ADR QUE NO DA, medido acá ─────────────────────────
    //
    // El ADR II-0009 dice: «La afortunada termina en **+3037 en la peor de sus
    // cien partidas** — el ingreso menos la caminata le da entre 4036,9 y 4043,2
    // contra un costo de 1000». Ese rango era el de las CALORÍAS CRUDAS a secas
    // —medido hoy, 4037,1 a 4043,2, y sigue dando lo mismo, porque las calorías no
    // se movieron— y no el del ingreso menos la caminata, que es lo que la frase
    // dice. El error del ADR se ve en la frase misma y queda anotado.
    //
    // Lo que ya no existe es el +3037: con el veneno cobrado, esas mismas 4040
    // calorías vienen con 8312,5 de veneno encima —664 piezas de 2 kg a 12,50 cada
    // una— y el ingreso queda en −4269,3.
    const neto = extremos(AFORTUNADAS.map((p) => p.netoCrudo))
    const brutas = extremos(AFORTUNADAS.map((p) => p.ingresoCrudo + p.venenoCrudo))
    const veneno = extremos(AFORTUNADAS.map((p) => p.venenoCrudo))
    const celdas = extremos(AFORTUNADAS.map((p) => p.celdasCaminadas))
    console.log(
      `económico · la AFORTUNADA, medida con el ADR II-0013 adentro:\n` +
        `económico ·   calorías crudas ${brutas.min.toFixed(1)} a ${brutas.max.toFixed(1)} (el rango que el ADR II-0009 citaba, intacto)\n` +
        `económico ·   VENENO ......... ${veneno.min.toFixed(1)} a ${veneno.max.toFixed(1)} ← esto no existía\n` +
        `económico ·   NETO crudo ..... ${neto.min.toFixed(1)} a ${neto.max.toFixed(1)} (mediana ${neto.mediana.toFixed(1)}) contra un costo de vivir de ${(COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_PARTIDA).toFixed(0)}\n` +
        `económico ·   camina entre ${String(celdas.min)} y ${String(celdas.max)} celdas entre orillas, y NINGUNA de esas celdas le cuesta un segundo de partida (el defecto sigue)\n` +
        `económico ·   el +3037 del ADR II-0009 dejó de existir: el veneno se lleva 2,06× las calorías`,
    )
    for (const p of AFORTUNADAS) expect(p.netoCrudo).toBeLessThan(0)
    // Y NO ES POR POCO, que es lo que hace que la conclusión no dependa del defecto
    // de la locomoción: aunque no se le cobrara UNA SOLA CELDA ni UN SOLO SEGUNDO de
    // vivir, el ingreso crudo solo ya es negativo.
    for (const p of AFORTUNADAS) expect(p.ingresoCrudo).toBeLessThan(0)
    // El veneno se lleva más del doble de lo que las calorías dan. Ésa es la
    // magnitud, y es la que impide leer esto como «negativo por un pelo».
    expect(veneno.min / brutas.max).toBeGreaterThan(2)
  })

  it('LA VENTANA DEL ADR II-0009: se descruzó con el II-0013, y el 0,34 quedó ADENTRO', () => {
    // ═══ EL GUARDIÁN SE PUSO ROJO, Y ESTO ES «VENIR A MIRAR» ═══════════════
    //
    // Este `it` se llamaba «LA VENTANA DEL ADR II-0009 ES UN CONJUNTO VACÍO» y su
    // último `expect` era `arribaConFuego < abajo`, con este comentario textual:
    //
    //   «Esto es un guardián y no una deuda: si mañana alguien mueve una constante
    //    y la ventana vuelve a existir, este `expect` se pone rojo y hay que venir
    //    a mirar.»
    //
    // Pasó. El ADR II-0013 movió una constante —el veneno, que antes valía cero— y
    // **los dos bordes se descruzaron**. Medido sobre las mismas cien comunes:
    //
    //             ANTES del II-0013        AHORA
    //   abajo ..........  +0,766/s        −0,488/s   ← se desplomó
    //   arriba con fuego   +0,494/s        +0,364/s   ← bajó un poco
    //
    // El borde de ABAJO se desplomó porque **el crudo dejó de ser ingreso**: cada
    // pieza de 2 kg acredita 6,08 y el veneno se lleva 12,50, así que la que MÁS
    // pescó es la que más perdió. El de ARRIBA bajó apenas, porque el veneno del
    // cocido es 7,2× más chico. Los dos se movían en la misma dirección y uno se
    // movió veinte veces más: por eso se descruzaron.
    //
    // ─── Y EL 1,0 QUEDABA AFUERA, que era la noticia de aquel tramo ────────
    //
    // Que la ventana exista no quiere decir que el número elegido esté adentro. La
    // ventana quedó en `(0 ; 0,364)` —cualquier costo de vivir positivo hace que el
    // crudo no alcance, y hace falta menos de 0,364/s para que cocinar sí— y
    // `COSTO_VIVIR_POR_SEGUNDO` valía 1,0, o sea **2,7× por encima del borde de
    // arriba**. Comer crudo mata, cocinar mejora mucho, y ni cocinando alcanza: 99
    // de las 100 comunes terminaban debiendo aunque cocinaran todo lo que sacaban.
    //
    // ═══ Y ACÁ ES DONDE ESTE `expect` SE PUSO ROJO POR TERCERA VEZ ═════════
    //
    // El último `expect` de este `it` fue las tres veces el mismo renglón mirando en
    // direcciones distintas, y las tres veces se puso rojo cuando tenía que:
    //
    //   1ª  `arribaConFuego < abajo` ....... la ventana era un CONJUNTO VACÍO
    //   2ª  `1,0 > arribaConFuego` ......... la ventana existía y el valor caía afuera
    //   3ª  `0,34 < arribaConFuego` ........ el valor cae ADENTRO ← hoy
    //
    // Lo que lo movió esta vez no fue un ADR: fue el usuario bajando
    // `COSTO_VIVIR_POR_SEGUNDO` de 1,0 a **0,34** en `world/src/step.ts`, elegido
    // como el centro de la ventana con sus DOS bordes que publica el último bloque
    // del archivo, `(0,3100 ; 0,3637)`. Medido acá, sobre las mismas cien comunes:
    //
    //             ANTES del II-0013     con el 1,0        HOY, con el 0,34
    //   abajo ..........  +0,766/s        −0,488/s          −0,488/s
    //   arriba con fuego  +0,494/s        +0,364/s          +0,366/s
    //   el vigente .....   1,000/s         1,000/s           0,340/s ← adentro
    //
    // El borde de arriba subió 0,0016 y no es una mejora: es el mismo 1,584 de
    // stamina que el fuego dejó de cobrar por vivir los 2,4 s de frotar, repartido
    // en los mil segundos de la partida. La ventana no se ensanchó; el valor bajó.
    //
    // ─── Y ESTO SIGUE SIN ARREGLARSE DESDE ACÁ ─────────────────────────────
    //
    // La regla no cambió porque el resultado ahora sea el cómodo. Bajar
    // `COSTO_VIVIR_POR_SEGUNDO` desde el arnés para meter un número adentro sería
    // calibrar el mundo desde el test, que es lo que este archivo entero existe para
    // no hacer. Lo que este archivo hizo es lo que tenía que hacer: medir los dos
    // bordes, publicarlos, y esperar. La perilla la movió el usuario, en el mundo.
    //
    // ─── LO QUE ESTE TEST AFIRMA HOY ───────────────────────────────────────
    //
    //   1. el borde de ABAJO: comer crudo no alcanza ni trabajando, en las cien, y
    //      por un margen que no depende de ninguna perilla del metabolismo. **Eso no
    //      se movió con el 0,34 y no se podía mover**: el crudo es EGRESO, así que
    //      ningún precio positivo de vivir lo salva;
    //   2. cocinar da vuelta el SIGNO de la misma materia —de −6,42 a +13,47 por
    //      pieza— y no ya un factor de 2,50×: la ley 5 sube `digestibility` Y baja
    //      `toxicity`, y con el II-0013 las dos entran en la cuenta;
    //   3. y el valor vigente cae ADENTRO de la ventana, o sea que **con el fuego
    //      pagado entero cocinar alcanza**: 0 de 100 partidas debiendo, contra 99 de
    //      100 con el 1,0 (bloque 5).
    //
    // Se afirma sobre la COMÚN y no sobre la afortunada a propósito: la afortunada
    // es un dado cargado, y calibrar contra un adversario da el número equivocado.
    for (const p of COMUNES) {
      expect(p.netoCrudo).toBeLessThan(0)
      // El neto cocinado SIN el precio del fuego. Sigue siendo cierto y sigue
      // sirviendo —es el control contra el que los bloques 5 y 6 restan el fuego—
      // pero **no dice que cocinar salve**: dice cuánta holgura hay para comprarlo.
      // Y la holgura se achicó: de +155,2 a +24,1 en la más flaca, porque el veneno
      // del cocido, aunque chico, se cobra 76 veces en la partida.
      expect(p.netoCocinado).toBeGreaterThan(0)
    }

    // ─── LOS TRES BORDES, medidos como tasa por segundo ────────────────────
    //
    // Los dos primeros son los del ADR. El tercero es el que el ADR no tenía, y es
    // el que decide: lo que rinde cocinar CON el fuego adentro.
    const porSegundo = (p: Partida, ingreso: number): number =>
      (ingreso - p.celdasCaminadas * COSTO_POR_CELDA) / SEGUNDOS_DE_PARTIDA
    const abajo = extremos(COMUNES.map((p) => porSegundo(p, p.ingresoCrudo))).max
    const arribaSinFuego = extremos(COMUNES.map((p) => porSegundo(p, p.ingresoCocinado))).min
    const arribaConFuego = extremos(
      COMUNES.map((p) => porSegundo(p, p.ingresoCocinado) - PRECIO_DEL_FUEGO.precio / SEGUNDOS_DE_PARTIDA),
    ).min
    expect(abajo).toBeLessThan(COSTO_VIVIR_POR_SEGUNDO)
    expect(COSTO_VIVIR_POR_SEGUNDO).toBeLessThan(arribaSinFuego)
    // LA VENTANA EXISTE: los dos bordes se descruzaron. Éste es el `expect` que
    // decía lo contrario, y ahora dice lo contrario de lo contrario — con la misma
    // función de guardián: si mañana alguien afloja el cobro del veneno, los bordes
    // se vuelven a cruzar y esto se pone rojo.
    expect(arribaConFuego).toBeGreaterThan(abajo)
    // Y EL BORDE DE ABAJO ES NEGATIVO, que es lo que hace que la ventana sea
    // `(0 ; arribaConFuego)` y no un intervalo cualquiera: comer crudo no es ingreso
    // chico, es EGRESO, así que ningún precio positivo de vivir lo salva.
    expect(abajo).toBeLessThan(0)
    // Y EL VIGENTE ESTÁ ADENTRO. Éste es el renglón que decía
    // `toBeGreaterThan(arribaConFuego)` —«el 1,0 cae afuera»— y antes de eso
    // `arribaConFuego < abajo` —«no hay ningún número posible»—. Sigue siendo un
    // guardián y sigue mirando el mismo borde: el día que alguien suba el costo de
    // vivir por encima de 0,366, o afloje algo que baje lo que rinde cocinar, esto
    // se pone rojo y hay que venir a mirar de nuevo.
    expect(COSTO_VIVIR_POR_SEGUNDO).toBeLessThan(arribaConFuego)
    // Y el otro borde de la ventana entera, para que «adentro» quiera decir adentro
    // de los DOS y no de uno: el de abajo lo pone el arnés del Hito 5 y se despeja
    // igual que en el último bloque del archivo.
    expect(COSTO_VIVIR_POR_SEGUNDO).toBeGreaterThan(TANQUE_DEL_CRITERIO / SEGUNDOS_DE_PARTIDA)
    console.log(
      `económico · LA VENTANA DEL ADR II-0009, remedida con el ADR II-0013 adentro:\n` +
        `económico ·   ${abajo.toFixed(3)}/s ← borde de ABAJO: lo que rinde comiendo CRUDO la partida que MÁS comió (era +0,766)\n` +
        `económico ·   ${arribaConFuego.toFixed(3)}/s ← borde de ARRIBA DE VERDAD, con el fuego de ${PRECIO_DEL_FUEGO.precio.toFixed(2)} adentro (era +0,494)\n` +
        `económico ·   ${arribaSinFuego.toFixed(3)}/s ← borde de ARRIBA si cocinar fuera gratis, que es como el ADR lo midió\n` +
        `económico ·   ${COSTO_VIVIR_POR_SEGUNDO.toFixed(3)}/s ← COSTO_VIVIR_POR_SEGUNDO, el número elegido\n` +
        `económico ·   ✔ ${arribaConFuego.toFixed(3)} > ${abajo.toFixed(3)}: LOS DOS BORDES SE DESCRUZARON y la ventana YA NO está vacía\n` +
        `económico ·   ✔ y el ${COSTO_VIVIR_POR_SEGUNDO.toFixed(3)} cae ADENTRO, al ${((COSTO_VIVIR_POR_SEGUNDO / arribaConFuego) * 100).toFixed(1)}% del borde de arriba ` +
        `(con el 1,000 quedaba ${(1 / arribaConFuego).toFixed(1)}× por ENCIMA, o sea afuera)\n` +
        `económico ·   lo que sí queda: crudo no alcanza en las cien, y cocinar da vuelta el SIGNO de la misma materia ` +
        `(${netoDelBocado('pescado', MASA_DE_UNA_PIEZA).toFixed(2)} → ${netoDelBocado('pescado', MASA_DE_UNA_PIEZA, COCIDO).toFixed(2)} por pieza de 2 kg)`,
    )
  })

  it('el punto de equilibrio, medido: LAS TRES VARIANTES QUEDARON DEL MISMO LADO', () => {
    // El número accionable: el costo de vivir por segundo que dejaría en cero a la
    // partida que MÁS comió, o sea el que haría negativas a las cien de esa
    // variante.
    //
    // ─── LAS TRES DAN NEGATIVO, Y ANTES ERAN DOS ───────────────────────────
    //
    // Este `it` decía: «que las tres afirmaciones tengan distinto sentido no es una
    // concesión», porque la AFORTUNADA quedaba por ENCIMA de lo que cuesta vivir y
    // las otras dos por debajo. Con el ADR II-0013 las tres quedaron del mismo lado
    // y el número de la afortunada **ni siquiera es positivo**: su equilibrio está
    // en −4,51/s, o sea que no hay precio de vivir que la salve comiendo crudo,
    // porque su ingreso crudo YA es negativo antes de restarle nada.
    //
    // ─── EL BUG QUE ESTO DESTAPÓ, y conviene contarlo ──────────────────────
    //
    // `equilibrioDe` arrancaba el máximo en 0 y no en −∞. Mientras todos los cortes
    // eran positivos daba lo mismo; con los cortes negativos devolvía 0 para las
    // dos variantes —o sea «el equilibrio está en 0,000/s»— que es un número que no
    // significa nada y que además hacía que el `expect` de la afortunada fallara
    // por el motivo equivocado. Un máximo que arranca en cero es un máximo que
    // supone el signo de lo que va a ver.
    const equilibrioDe = (ps: readonly Partida[]): number =>
      extremos(
        ps.map((p) => (p.ingresoCrudo - p.celdasCaminadas * COSTO_POR_CELDA) / SEGUNDOS_DE_PARTIDA),
      ).max
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
    // LA QUE DIO VUELTA. Este `expect` decía `toBeGreaterThan` y era el `it.fails`
    // de más arriba visto desde otro ángulo. Ahora las tres están del mismo lado, y
    // la afortunada además por debajo de CERO: comer crudo no es un ingreso chico,
    // es un egreso, así que la suerte no cambia el signo.
    expect(equilibrioDe(AFORTUNADAS)).toBeLessThan(0)
    // Y la otra mitad de la perilla, que es la que el documento prefiere: cocinar
    // multiplica lo que rinde el mismo bicho, sin crear ni un gramo de materia.
    // **Sigue siendo una MEJORA y no una condición de supervivencia** —con el fuego
    // pagado, cocinar rinde +852,2 en la partida más flaca (bloque 5), pero el neto
    // sigue negativo en 99 de 100— y lo que cambió es que ya no se puede escribir
    // como un cociente: el crudo es negativo, así que dividir daría un número sin
    // sentido. Se escribe como lo que es: un cambio de signo, en stamina.
    const crudo = resumir(AFORTUNADAS).ingreso
    const cocinado = AFORTUNADAS.reduce((a, p) => a + p.ingresoCocinado, 0)
    console.log(
      `económico · cocinar da vuelta el SIGNO de la misma materia: ${(crudo / PARTIDAS).toFixed(1)} crudo contra ${(cocinado / PARTIDAS).toFixed(1)} cocinado por partida ` +
        `(digestibilidad al techo ${String(DIGESTIBILIDAD_TECHO)} contra la cruda, y toxicidad ${String(TOXICIDAD_DEL_PESCADO_COCIDO)} contra 0,25)`,
    )
    expect(crudo).toBeLessThan(0)
    expect(cocinado).toBeGreaterThan(0)
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

  it('las CUATRO constantes copiadas de `@anima/world` siguen diciendo lo que dicen acá, Y con la misma unidad', () => {
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
    // La cuarta, del ADR II-0013. Es la que más falta hace vigilar hoy porque es la
    // que acaba de nacer: una copia de una constante recién calibrada es la que más
    // fácil se queda vieja.
    expect(valorDe('COSTO_POR_TOXICIDAD_Y_KILO')).toBe(COSTO_POR_TOXICIDAD_Y_KILO)

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
    //     el mismo viaje saliera 5× más barato a 100 Hz que a 20;
    //   · el veneno TAMPOCO es una tasa ⟹ se cobra por acto de tragar y se
    //     multiplica por `toxicity · masa`. Que la MASA esté en la cuenta es la
    //     mitad de la unidad: `toxicity` es intensiva, así que un cobro que sólo
    //     mirara el intensivo haría que medio pescado envenenara lo mismo que uno
    //     entero, y ninguna constante lo delataría.
    const dice = (patron: RegExp): boolean => patron.test(fuente)
    expect(['vivir pasa por porPaso', dice(/porPaso\(COSTO_VIVIR_POR_SEGUNDO,/)]).toEqual(['vivir pasa por porPaso', true])
    expect(['la celda NO pasa por porPaso', dice(/porPaso\(\s*COSTO_POR_CELDA/)]).toEqual(['la celda NO pasa por porPaso', false])
    expect(['la celda se cobra entera', dice(/cobrarStamina\(d, a, COSTO_POR_CELDA\)/)]).toEqual(['la celda se cobra entera', true])
    expect(['el veneno es toxicidad × MASA × K', dice(/toxicidad \* masa \* COSTO_POR_TOXICIDAD_Y_KILO/)]).toEqual([
      'el veneno es toxicidad × MASA × K',
      true,
    ])
    expect(['el veneno NO pasa por porPaso', dice(/porPaso\(\s*COSTO_POR_TOXICIDAD_Y_KILO/)]).toEqual([
      'el veneno NO pasa por porPaso',
      false,
    ])
    // Y QUE SE COBRE APARTE, que es la decisión entera del ADR II-0013: dos
    // anotaciones y dos eventos. Si alguien netea el veneno adentro de `acreditado`
    // —o sea, si el `convierte` sale con la resta hecha— este archivo estaría
    // modelando dos mitades que el mundo ya no distingue, y la crónica dejaría de
    // poder contar por qué la criatura comió y adelgazó.
    expect(['el cobro va por anotarGasto', dice(/anotarGasto\(d, 'stamina', cobrado\)/)]).toEqual([
      'el cobro va por anotarGasto',
      true,
    ])
    expect(['y emite su propio evento', dice(/k: 'enveneno'/)]).toEqual(['y emite su propio evento', true])

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
    // se MIDE corriendo `stepWorld`.
    //
    // ─── EL NÚMERO SE MOVIÓ DOS VECES, POR LAS DOS MITADES DISTINTAS ───────
    //
    // El precio del fuego tiene DOS sumandos y sólo uno es térmico, y cada perilla
    // que se movió tocó uno solo. Las dos veces, en orden:
    //
    //   1) bajó `COSTO_VIVIR_POR_SEGUNDO` de 1,0 a 0,34 (tramo M)
    //        térmico  657,4629  NO se movió ni un dígito
    //        vivir      2,4000 → 0,8160   los 2,4 s de frotar
    //        TOTAL    659,8629 → 658,2789
    //
    //   2) subió la eficiencia de `friccion` de 0,35 a 0,85 (tramo N)
    //        térmico  657,4629 → 270,7200   heatCapacity × ΔT / eficiencia
    //        vivir      0,8160  NO se movió
    //        TOTAL    658,2789 → 271,5360
    //
    // Y ES EL MISMO RENGLÓN CONTANDO LA HISTORIA DE LOS DOS LADOS: la primera vez
    // el térmico quieto decía «bajar el costo de vivir no abarató el fuego, le sacó
    // el 0,24% que no era del fuego»; la segunda, el sumando de vivir quieto dice
    // que esta vez SÍ se abarató el fuego y nada más. Cada perilla en su columna.
    //
    // El porqué de la segunda está en el encabezado de `FRICCION` y medido en
    // `world/tests/la-cuenta-de-los-veinte-mil.test.ts`: con 0,35 la criatura del
    // criterio (5) no podía encender NADA.
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
    expect(Number(PRECIO_DEL_FUEGO.precio.toFixed(4))).toBe(271.536)
    // Y el térmico clavado aparte, que es la parte que NINGUNA perilla del
    // metabolismo puede mover: si mañana se vuelve a tocar el costo de vivir, este
    // renglón tiene que seguir igual o lo que cambió no fue el costo de vivir.
    expect(Number(PRECIO_DEL_FUEGO.termico.toFixed(4))).toBe(270.72)
    // Y la mitad de vivir, que es la que la eficiencia NO puede mover: mismo
    // argumento con los papeles cambiados. Con los dos renglones clavados, mover
    // cualquiera de las dos perillas dice cuál se movió sin tener que despejarlo.
    expect(Number((PRECIO_DEL_FUEGO.segundos * COSTO_VIVIR_POR_SEGUNDO).toFixed(4))).toBe(0.816)

    // Y LA VARA BARATA NO SIRVE, que es lo que este bloque agrega. Los 282,17 de
    // una vara de 0,2 kg —el número con el que el `it.fails` de
    // `world/tests/ataque-2-al-fuego.test.ts` (e) hace su cuenta— compran un fuego
    // que ENCIENDE y no cocina: medido en `perceive`, el pescado sobre la parrilla
    // se queda en `digestibility` 0,3800, o sea crudo. Encender y cocinar son dos
    // umbrales distintos y hay un factor de 2,34 entre ellos.
    const barata = precioDeEncender(0.2, 'madera')
    // 282,1714 con el costo de vivir en 1,0 y 280,5874 con 0,34; los 1,584 de esa
    // primera diferencia eran los mismos 2,4 s de frotar, porque los dos fuegos
    // frotan los mismos 48 pasos. Con la eficiencia en 0,85 se mueve la otra mitad,
    // la térmica, y queda en 116,016.
    expect(Number(barata.precio.toFixed(4))).toBe(116.016)
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
    // ─── Y CON EL ADR II-0013 EL MARGEN CASI SE DUPLICA ────────────────────
    //
    // Porque cocinar hace DOS cosas y no una: sube lo que la pieza da (la
    // digestibilidad, de 0,38 a 0,95) y baja lo que la pieza cuesta (la toxicidad,
    // de 0,25 a 0,0345 medido). Antes el margen era la diferencia de calorías y
    // nada más —9,12 por pieza de 2 kg— y ahora son 19,89.
    //
    // Los dos números, para que se puedan comparar con el 332 viejo y con la
    // pieza que este archivo usa.
    const deUnKilo = netoDelBocado('pescado', fx(1), COCIDO) - netoDelBocado('pescado', fx(1))
    const porFuegoUnKilo = Math.ceil(PRECIO_DEL_FUEGO.precio / deUnKilo)
    const porFuego = Math.ceil(PRECIO_DEL_FUEGO.precio / LO_QUE_PAGA_UNA_PIEZA)
    console.log(
      `económico · PESCADOS POR FUEGO, remedido con el fuego que dura Y el veneno cobrado:\n` +
        `económico ·   cocinar una pieza de 1 kg paga ${deUnKilo.toFixed(2)} de stamina → ${String(porFuegoUnKilo)} por fuego (el adversario, con el fuego de un tick, midió 332; sin el veneno, 145)\n` +
        `económico ·   cocinar una pieza de ${String(unfx(MASA_DE_UNA_PIEZA))} kg paga ${LO_QUE_PAGA_UNA_PIEZA.toFixed(2)} → ${String(porFuego)} por fuego (sin el veneno eran 73)`,
    )
    // ─── LOS DOS BAJARON A LA MITAD, Y NO ES DEL BOCADO ────────────────────
    //
    // Eran 67 y 34, y hoy son 28 y 14. Lo que un bocado paga NO se movió —9,95 la
    // pieza de 1 kg y 19,89 la de 2, los mismos de antes—: lo que bajó es el
    // numerador, o sea el fuego, porque la eficiencia de `friccion` pasó de 0,35 a
    // 0,85 (tramo N, ver el encabezado de `FRICCION`). Es la misma división con el
    // divisor quieto, y por eso los dos cocientes se movieron en la misma razón.
    expect(porFuegoUnKilo).toBe(28)
    expect(porFuego).toBe(14)

    // Y LO QUE ESO SIGNIFICA EN UNA PARTIDA, que es donde el número se vuelve
    // accionable: la criatura COMÚN saca entre `min` y `max` piezas en los 1000
    // segundos. Si el número de arriba estuviera arriba de lo que saca la que MENOS
    // sacó, el fuego no se pagaría nunca en ninguna partida.
    const piezas = extremos(COMUNES.map((p) => p.piezas))
    console.log(
      `económico ·   la común saca entre ${String(piezas.min)} y ${String(piezas.max)} piezas por partida (mediana ${String(piezas.mediana)}): ` +
        `${piezas.min >= porFuego ? 'las cien' : 'no todas'} alcanzan para pagar UN fuego`,
    )
    // DEJÓ DE ESTAR PELEADO, y ése es el dato nuevo: la que menos sacó saca 76 y
    // hacen falta 34. Antes hacían falta 73 de esas 76, o sea que el fuego se
    // pagaba por un pelo; ahora sobra el doble. El margen no cambió porque el fuego
    // se abaratara —cuesta prácticamente lo mismo, 658,28 contra 659,86— sino porque
    // el veneno del crudo pasó a contar como lo que cocinar EVITA. (Y los 34 no se
    // movieron con el costo de vivir en 0,34: el fuego bajó 1,58 sobre 658 y esta
    // cuenta redondea para arriba.)
    expect(piezas.min).toBeGreaterThanOrEqual(porFuego)
    expect(piezas.min / porFuego).toBeGreaterThan(2)
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

  it('LA MITAD DE ARRIBA DE LA VENTANA SE PARÓ, y la «salida 2» dejó de estar cerrada', () => {
    // ─── ESTO ES UN GUARDIÁN, Y ES LA TERCERA VEZ QUE SE DA VUELTA ─────────
    //
    // Este `it` fue un `it.fails` dos veces, después dejó de serlo, y ahora afirma lo
    // contrario de lo que afirmaba. Se llamó, en orden:
    //
    //   1ª  «SIGUE ABIERTO · con el fuego adentro el neto cocinado no da positivo»
    //   2ª  «LA MITAD DE ARRIBA DE LA VENTANA SE CAE, y con el veneno cobrado se cae MÁS»
    //   3ª  «LA MITAD DE ARRIBA DE LA VENTANA SE PARÓ» ← hoy
    //
    // Lo que lo movió las tres veces no fue este archivo: fue el ADR II-0011 (el
    // fuego dura), el ADR II-0013 (el veneno se cobra) y, ahora,
    // **`COSTO_VIVIR_POR_SEGUNDO` de 1,0 a 0,34**, decidido por el usuario con la
    // ventana `(0,3100 ; 0,3637)` del último bloque de este archivo delante.
    //
    // QUÉ SE MIDIÓ: el criterio del ADR II-0009 —«neto crudo negativo en las 100
    // partidas comunes y neto cocinado positivo en las 100»— se eligió con un modelo
    // en el que **cocinar era gratis**. Con el precio del fuego adentro la mitad de
    // arriba se caía, y no por poco. Con el costo de vivir adentro de la ventana ya
    // no se cae: se cumple en las cien.
    //
    // MEDIDO, con UN SOLO fuego por partida —el supuesto más generoso posible: que
    // se enciende una vez y dura los 1000 segundos, con leña que este modelo no
    // cobra—, las tres corridas una al lado de la otra:
    //
    //                            antes del II-0013     con vivir 1,0      HOY, vivir 0,34
    //   neto cocinado SIN fuego  +155,2/+489,6/+915,2  +24,1/+320,6/+697,9  +684,1/+980,6/+1357,9
    //   neto cocinado CON fuego  −504,7/−170,3/+255,3  −635,8/−339,3/+38,0   +25,8/+322,3/+699,6
    //   partidas debiendo .....  91 de 100             99 de 100            **0 de 100**
    //
    // Los 660 que separan la segunda columna de la tercera son exactos y no hay que
    // buscarlos: son `(1,0 − 0,34) × 1000 s`. El fuego no se abarató —658,28 contra
    // 659,86, y de esa diferencia 1,58 es vivir los 2,4 s de frotar— y el ingreso
    // cocinado no se movió ni un decimal. Lo único que cambió es lo que cuesta el
    // tiempo, y alcanzó para dar vuelta 99 partidas.
    //
    // ─── EL HALLAZGO DEL TRAMO: LA «SALIDA 2» DEJÓ DE ESTAR CERRADA ────────
    //
    // Y esto es más que un número que se movió, porque lo que estaba escrito acá era
    // una IMPOSIBILIDAD FÍSICA y ya no lo es.
    //
    // El bloque decía, textual: «que encender salga más barato **y por este lado no
    // se puede**, y es el hallazgo del bloque. […] despejando hace falta una
    // eficiencia de **10,60**. Una eficiencia mayor que 1 es una máquina de
    // movimiento perpetuo, que es exactamente lo que el comentario de `FRICCION` dice
    // que el 0,35 existe para impedir. Ni siquiera un motor PERFECTO alcanza: con
    // eficiencia 1 el fuego cuesta 232,51 y la holgura es 24,1».
    //
    // Hoy la misma cuenta, con la misma fórmula y sin tocar una línea de física:
    //
    //   holgura de la partida más flaca ....  24,1  →  **684,1**  (×28,4)
    //   eficiencia que haría falta .........  10,60 →  **0,3368**
    //   el fuego con motor perfecto ........ 232,51 →  230,93  (y la holgura lo cubre 2,96×)
    //
    // La eficiencia que haría falta **no sólo bajó de 1: bajó por debajo del 0,35 que
    // la fricción YA tiene**. O sea que la salida 2 no está abierta a futuro: está
    // cumplida. Lo que la tenía cerrada no era la termodinámica de frotar dos palos
    // —eso no se movió ni un dígito, el térmico sigue siendo 657,4629— era que la
    // holgura contra la que se comparaba estaba comida por el costo de vivir. Un
    // número que parecía de física resultó ser de metabolismo, y estuvo dos tramos
    // escrito como imposible.
    //
    //   → REGLA: cuando un despeje da «movimiento perpetuo», mirá contra QUÉ se está
    //     despejando. `eficienciaQueHaríaFalta` tiene la holgura en el denominador,
    //     así que una holgura chica infla el resultado sin que la física opine. El
    //     10,60 nunca fue una propiedad de `FRICCION`.
    //
    // ─── LAS OTRAS DOS SALIDAS, con los números de hoy ─────────────────────
    //
    //   1. que `nutrition → stamina` rinda más: hacía falta un factor de 1,62 sobre
    //      el ingreso cocinado de la partida más flaca (antes 1,44). Hoy hace falta
    //      **0,97**, o sea que sobra: no hay nada que pedirle al catálogo;
    //   3. que el fuego se amortice entre más piezas: sigue gastada y por el mismo
    //      motivo, que no es económico. Cocinar no es rival —200 piezas sobre una
    //      parrilla salen las 200 cocidas, medido en `perceive`— así que el fuego ya
    //      cocinaba todo lo que sale del agua. El tope no lo pone el fuego, lo pone
    //      el dado.
    //
    // ─── Y LO QUE NO CAMBIÓ, que es lo que hay que seguir vigilando ────────
    //
    // Que esto dé verde NO quiere decir que el criterio (2) del Hito 5 se cumpla: acá
    // se modela una criatura que pesca sin fallar los 1000 segundos y cocina todo lo
    // que saca, no una mente decidiendo. Lo que este bloque afirma es que **la
    // aritmética dejó de estar en contra**, y eso es una condición necesaria y nada
    // más. La suficiencia se mide en `@anima/mind` y en `@anima/juez`, contra el
    // mundo que corre.
    //
    // Y la regla del archivo sigue igual, aunque ahora el resultado sea el cómodo:
    // ninguno de estos números se fabricó desde acá. La perilla la movió el usuario
    // en `world/src/step.ts`; este archivo midió los dos bordes y esperó.
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
        `económico ·   salida 1 · el ingreso cocinado tendría que rendir ${falta.toFixed(2)}× lo que rinde ` +
        `${falta <= 1 ? '(o sea que SOBRA: no hay nada que pedirle al catálogo)' : '(hace falta más de lo que hay)'}\n` +
        `económico ·   salida 2 · frotar tendría que tener eficiencia ${eficienciaQueHaríaFalta.toFixed(4)} y YA TIENE ${String(EL_DRIVE_DE_FROTAR.efficiency)} ` +
        `(era 10,60, o sea movimiento perpetuo, cuando la holgura era 24,1). Con la eficiencia PERFECTA (1,00) el fuego cuesta ` +
        `${conMotorPerfecto.toFixed(2)} y la holgura de la partida más flaca es ${holgura.toFixed(1)}, que lo cubre ${(holgura / conMotorPerfecto).toFixed(2)}×`,
    )
    // ─── LA SALIDA 2 SE ABRIÓ, y estos dos `expect` decían lo contrario ────
    //
    // Decían `eficienciaQueHaríaFalta > 1` y `conMotorPerfecto > holgura`, o sea «ni
    // un motor perfecto alcanza». Los dos se pusieron rojos el día que bajó el costo
    // de vivir, y los dos afirman ahora la dirección contraria — con la misma
    // función de guardián: si la holgura se vuelve a comer, esto se pone rojo y hay
    // que releer el bloque entero, porque el número volvería a parecer de física.
    //
    // Y no se afirma «< 1», que sería la mitad floja de la noticia: se afirma que la
    // eficiencia que haría falta está por debajo de la que la fricción YA TIENE. Eso
    // es lo que quiere decir que la salida esté cumplida y no sólo abierta.
    expect(eficienciaQueHaríaFalta).toBeLessThan(EL_DRIVE_DE_FROTAR.efficiency)
    expect(Number(eficienciaQueHaríaFalta.toFixed(4))).toBe(0.3368)
    expect(conMotorPerfecto).toBeLessThan(holgura)
    // Y LA SALIDA 1 TAMPOCO PIDE NADA: el factor que haría falta sobre el ingreso
    // cocinado es menor que 1, o sea que el catálogo ya rinde de más.
    expect(falta).toBeLessThan(1)
    // Y las CIEN, contadas. Este `expect` decía `toBe(99)`, y antes del ADR II-0013
    // `toBe(91)`, y antes de eso era un `it.fails` con `toBeGreaterThan(0)`. Hoy
    // ninguna partida termina debiendo: es el mismo renglón cerrando el círculo.
    expect(negativas).toBe(0)
    // ─── LA HOLGURA SE MULTIPLICÓ POR DIECISÉIS, Y HAY QUE SABER POR QUÉ ────
    //
    // Era 25,8 y es 412,6. No mejoró la partida: se abarató el fuego. La eficiencia
    // de `friccion` pasó de 0,35 a 0,85 (tramo N) y el fuego bajó de 658,28 a
    // 271,54, así que la partida más flaca dejó de estar al filo. Es exactamente el
    // margen que el bloque de arriba llama `holgura`, visto después de restar.
    //
    // Y LO QUE ESO NO QUIERE DECIR: no quiere decir que el criterio (5) del Hito 5
    // se cumpla. Acá se modela una criatura que pesca sin fallar los 1000 segundos y
    // cocina todo lo que saca. La cuenta de la criatura de verdad —que arranca con
    // 310 y no con el tanque lleno— está en
    // `world/tests/la-cuenta-de-los-veinte-mil.test.ts`, y ahí el fuego sigue
    // costando 244,65 contra un tanque de 310.
    expect(Number(e.min.toFixed(1))).toBe(412.6)
    // Y la que menos margen tiene lo tiene POSITIVO, que es la forma fuerte de
    // decirlo: no son 99 y una cola, son las cien del mismo lado.
    expect(e.min).toBeGreaterThan(0)
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

  it('CON LA LEÑA COBRADA LA VENTANA CIERRA, y ahora la ESTRATEGIA decide', () => {
    // ─── EL GUARDIÁN SE PUSO ROJO DOS VECES, Y ESTO ES «VENIR A MIRAR» ─────
    //
    // Este `it` se llamó, en orden:
    //
    //   1ª  «ES LA IMPOSIBILIDAD, AFIRMADA»  ....... `vivirQueHaríaFalta < bordeDelCrudo`
    //   2ª  «TAMPOCO CIERRA — pero los bordes SE DESCRUZARON» ... `1,0 > vivirQueHaríaFalta`
    //   3ª  «LA VENTANA CIERRA» .................... `0,34 < vivirQueHaríaFalta` ← hoy
    //
    // La primera vez traía este comentario textual: «si mañana alguien mueve una
    // constante y los bordes se descruzan, los `expect` de abajo se ponen rojos y hay
    // que venir a mirar». Pasó dos veces, y las dos el que movió la constante no fue
    // este archivo. Medido sobre las mismas cien comunes:
    //
    //                             antes del II-0013   con vivir 1,0   HOY, vivir 0,34
    //   vivir que haría falta ...    +0,494/s          +0,364/s        +0,364/s
    //   borde del CRUDO .........    +0,766/s          −0,488/s        −0,488/s
    //   el vigente ..............     1,000/s           1,000/s         0,340/s ← adentro
    //
    // El borde del crudo se desplomó con el ADR II-0013 —comer crudo dejó de ser
    // ingreso y pasó a ser egreso— y por eso los dos se descruzaron. **La ventana
    // existe**: cualquier costo de vivir por debajo de 0,364/s. Y con el 0,34 el
    // valor vigente cae adentro, así que el título dejó de decir «tampoco cierra».
    //
    // Fijate que las dos últimas columnas son IDÉNTICAS: los dos bordes de esta
    // cuenta no se movieron ni un decimal con el 0,34, y no podían. `bordeDelCrudo`
    // es ingreso menos caminata, y `vivirQueHaríaFalta` se despeja justamente para
    // sacar el costo de vivir de la ecuación. Lo único que se movió es dónde cae el
    // valor elegido — y era lo único que tenía que moverse.
    //
    // ─── Y LA ESTRATEGIA PASÓ A IMPORTAR, que es lo nuevo de esta corrida ──
    //
    // Mientras nada cerraba, las dos estrategias de fuego daban lo mismo: 99 de 100
    // debiendo con la hornada, y peor con el sostenido. Daba igual cuál se eligiera.
    // Hoy no:
    //
    //   fuego «hornada» (4,70 s, 0,094 kg) ....  0 de 100 debiendo · mínimo +23,7
    //   fuego «sostenido» (1000 s, 20 kg) .... **19 de 100 debiendo** · mínimo −251,4
    //
    // O sea que la aritmética dejó de decidir sola y **empezó a decidir la técnica**.
    // Mantener un fuego prendido los mil segundos cuesta 277 de stamina más que
    // encenderlo una vez al final, casi todo en celdas de acarreo (hasta 3930 contra
    // 33), y ese sobreprecio se come una de cada cinco partidas. Es la primera vez
    // que este archivo mide una diferencia entre DOS MANERAS DE HACER LO MISMO en
    // vez de entre dos calibraciones — y es lo que le corresponde decidir a la mente
    // y no al mundo.
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
    // y es chico: `PRECIO_DEL_FUEGO` cobra vivir los 2,4 s de frotar, y esos segundos
    // ya están adentro de los mil que `p.costo` cobra. Eran 2,40 con el costo de
    // vivir en 1,0 y hoy son 0,816; descontarlo deja el fuego en los mismos 657,46
    // térmicos de siempre, que es el número que no se mueve.
    //
    // QUÉ HABRÍA HECHO FALTA para que la ventana cerrara, por los tres caminos que
    // el bloque 5 nombra. Ninguno se eligió acá, y el que se movió lo movió el
    // usuario en el mundo:
    //
    //   1. QUE EL POZO RINDA MÁS. El factor está medido abajo y hoy es **0,98**, o
    //      sea menor que 1: no hay nada que pedirle al catálogo. Era el camino que
    //      «mueve el hambre entera» y no hizo falta recorrerlo.
    //   2. QUE VIVIR CUESTE MENOS. **ES EL QUE SE RECORRIÓ.** Se abrió con el ADR
    //      II-0013 —hasta entonces el borde del crudo estaba ARRIBA del otro y no
    //      había ningún valor que cumpliera la ventana entera— y se caminó cuando el
    //      usuario bajó `COSTO_VIVIR_POR_SEGUNDO` a 0,34, con los dos bordes medidos
    //      delante. Comer crudo da EGRESO, así que su borde es negativo y ningún
    //      precio positivo de vivir lo salva; el de arriba lo pone esta cuenta.
    //   3. QUE EL FUEGO SE AMORTICE MÁS. Este camino ya se gastó y ahora se sabe por
    //      qué: cocinar no es rival, un fuego cocina todo lo que salga del agua en la
    //      partida, y el tope no lo pone el fuego sino el dado. (El II-0013 bajó el
    //      fuego de 73 piezas a 34 y no movió nada.)
    //
    // Y la salida 2 del bloque 5 —«que encender salga más barato»— **dejó de estar
    // cerrada**, que es el hallazgo de aquel bloque y hay que leerlo allá: la
    // eficiencia que haría falta pasó de 10,60 (movimiento perpetuo) a 0,3368, o sea
    // por debajo del 0,35 que `friccion` ya tiene. La leña nunca tuvo que ver: lo que
    // inflaba aquel número era la holgura chica en el denominador.
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
        `económico ·   camino 2 · ABIERTO desde el ADR II-0013: vivir tendría que costar ${vivirQueHaríaFalta.toFixed(3)}/s para que cocinar alcance, ` +
        `y comer CRUDO ya no alcanza a NINGÚN precio positivo (su borde es ${bordeDelCrudo.toFixed(3)}/s, negativo). ` +
        `El borde de arriba es ${vivirQueHaríaFalta.toFixed(3)} y el ${COSTO_VIVIR_POR_SEGUNDO.toFixed(3)} vigente cae ` +
        `${COSTO_VIVIR_POR_SEGUNDO < vivirQueHaríaFalta ? 'ADENTRO' : 'AFUERA'}\n` +
        `económico ·   camino 3 · gastado: cocinar no es rival y el fuego ya cocina todo lo que sale del agua`,
    )
    // LOS DOS BORDES, DESCRUZADOS. Éste era el `expect` que afirmaba la
    // imposibilidad (`vivirQueHaríaFalta < bordeDelCrudo`) y ahora afirma lo
    // contrario, con la misma función de guardián: si alguien afloja el cobro del
    // veneno, el borde del crudo vuelve a subir, los dos se vuelven a cruzar y esto
    // se pone rojo.
    expect(vivirQueHaríaFalta).toBeGreaterThan(bordeDelCrudo)
    // Y EL BORDE DEL CRUDO ES NEGATIVO, que es lo que hace que la ventana arranque
    // en cero: comer crudo no es un ingreso chico, es un egreso.
    expect(bordeDelCrudo).toBeLessThan(0)
    // Y EL VIGENTE CAE ADENTRO, que es por qué el título ya no dice «tampoco
    // cierra». Decía `toBeGreaterThan(vivirQueHaríaFalta)` —el 1,0 afuera por
    // arriba— hasta que el usuario bajó la constante a 0,34 con esta misma medición
    // adelante. El guardián no se aflojó: se dio vuelta, y sigue apretando el mismo
    // borde por el otro lado.
    expect(COSTO_VIVIR_POR_SEGUNDO).toBeLessThan(vivirQueHaríaFalta)
    // La leña no mueve la conclusión, y eso es lo que este bloque tiene que
    // afirmar: entre la cuenta con leña gratis y la cuenta con la leña cobrada de
    // verdad hay menos de tres puntos de stamina en la estrategia barata.
    expect(Math.abs(eHornada.min - viejo.min)).toBeLessThan(3)
    // Y LA CUENTA, CONTADA TRES VECES, que es la historia entera de este bloque:
    //
    //   91 de 100 debiendo ... antes del ADR II-0013, la más flaca debía 505,5
    //   99 de 100 .............. con el veneno del cocido cobrado, debía 636,3
    //    0 de 100 .............. con el costo de vivir en 0,34, la más flaca SOBRA
    //                           23,7 — y eso es lo que la calibración compró
    //    0 de 100 .............. con la eficiencia de frotar en 0,85, sobra 410,5
    //
    // El último renglón es de OTRA perilla y hay que leerlo aparte: no es que las
    // partidas rindan más, es que el fuego bajó de 658,28 a 271,54 (tramo N). La
    // holgura de la más flaca se multiplicó por diecisiete y nadie pescó un pescado
    // más.
    //
    // Que sean las cien es lo que hace que la ventana contenga al número vigente:
    // con una sola que debiera, seguiría siendo una cola y no un intervalo.
    expect(hornada.filter((x) => x <= 0).length).toBe(0)
    expect(Number(eHornada.min.toFixed(1))).toBe(410.5)
    // ─── LA ESTRATEGIA DECIDIÓ DURANTE UN TRAMO, Y VOLVIÓ A NO DECIDIR ──────
    //
    // Este bloque decía, y era su aporte: «**la estrategia pasó a decidir**. Con el
    // 1,0 las dos estrategias de leña daban negativo y daba igual cuál se eligiera;
    // con 0,34 la hornada cierra en las cien y el fuego SOSTENIDO sigue debiendo en
    // 19 de 100. Antes la elección era decorativa; ahora separa vivir de morirse».
    // Lo afirmaba con `eSostenido.min < 0` y `19 de 100`.
    //
    // Se dio vuelta otra vez, y esta vez para atrás: con la eficiencia de `friccion`
    // en 0,85 (tramo N) el fuego bajó de 658,28 a 271,54 y **el sostenido pasó a dar
    // positivo en las cien**, con la más flaca en +135,33. La elección volvió a ser
    // decorativa, y eso es un COSTO de esa calibración, no un logro: la única
    // decisión económica que el mundo le hacía tomar a la criatura dejó de tener
    // consecuencia.
    //
    // Se afirma la dirección nueva y no se afloja el guardián, que sigue siendo el
    // mismo: mide si las dos estrategias se distinguen. Si mañana el fuego vuelve a
    // encarecerse, esto se pone rojo y la nota de arriba dice qué mirar. Y queda
    // afirmado también que el sostenido sigue siendo el PEOR de los dos —eso no lo
    // borró la calibración—, que es lo que impide que este bloque se vuelva mudo.
    const netosSostenido = netos.get('sostenido') as number[]
    expect(eSostenido.min).toBeGreaterThan(0)
    expect(netosSostenido.filter((x) => x <= 0).length).toBe(0)
    expect(eSostenido.min).toBeLessThan(eHornada.min)
  })

  it('LA VENTANA ENTERA DE `COSTO_VIVIR_POR_SEGUNDO`, con sus DOS bordes y no uno', async () => {
    // ─── POR QUÉ ESTE BLOQUE EXISTE ────────────────────────────────────────
    //
    // El `it` de acá arriba despeja UN borde: arriba de `vivirQueHaríaFalta`,
    // cocinar no alcanza en las cien partidas. Y de ahí sale, escrito, que «la
    // ventana es (0 ; 0,364)». **Ese cero está mal**, y no por poco: hay un
    // segundo borde, viene de otro criterio del Hito 5, y aprieta por abajo.
    //
    // EL SEGUNDO BORDE. El criterio (2) pide que la criatura **sobreviva 20.000
    // ticks**, y con `stamina` midiéndose en segundos de vida eso es una carrera
    // entre dos números que nadie eligió mirando al otro: el tanque de arranque
    // (310, del arnés del Hito 5) y lo que cuesta un segundo. Si vivir sale menos
    // que `310 / 1000 s`, la criatura llega a los 20.000 ticks **quieta y sin comer
    // una sola vez**, y el criterio pasa a cumplirse por la puerta de atrás. Sería
    // exactamente el número 6 de los corregidos de este proyecto —«faltan 5 ticks
    // para los 20.000», que era una criatura sobreviviendo con lo que traía
    // puesto— pero convertido en la calibración del mundo.
    //
    // O sea que el número que se elija tiene que caer ADENTRO de los dos, y la
    // ventana no la fija este archivo: la fijan dos criterios independientes.
    // El borde de arriba se recalcula con LA MISMA cuenta del `it` de al lado —el
    // acarreo, el tiempo perdido y el precio térmico del fuego— y no se copia su
    // número: si aquél se mueve, éste se tiene que mover con él o los dos bordes
    // dejarían de ser comparables.
    const conAcarreo = COMUNES.map((p, i) => {
      const a = acarrear(p.seed, ORILLAS[i] as ChunkDecretado, SEGUNDOS_DE_UNA_COCCIÓN)
      const perdidos = (a.celdasCaminadas + a.piezas) * DT + PRECIO_DEL_FUEGO.segundos
      return {
        ingreso: p.ingresoCocinado * ((SEGUNDOS_DE_PARTIDA - perdidos) / SEGUNDOS_DE_PARTIDA),
        fijo: PRECIO_DEL_FUEGO.termico + a.celdasCaminadas * COSTO_POR_CELDA + p.celdasCaminadas * COSTO_POR_CELDA,
      }
    })
    const arriba = extremos(conAcarreo.map((x) => (x.ingreso - x.fijo) / SEGUNDOS_DE_PARTIDA)).min
    const abajo = TANQUE_DEL_CRITERIO / SEGUNDOS_DE_PARTIDA

    const filas: string[] = [
      'económico · LA VENTANA ENTERA DEL COSTO DE VIVIR:',
      `económico ·   borde de ARRIBA ${arriba.toFixed(4)}/s — arriba de esto, cocinar no alcanza en las cien (este archivo)`,
      `económico ·   borde de ABAJO  ${abajo.toFixed(4)}/s — abajo de esto, el tanque de ${String(TANQUE_DEL_CRITERIO)} llega solo a los ${String(TICKS_DEL_CRITERIO)} ticks`,
      `económico ·                    y el criterio (2) se cumpliría SIN COMER, que es cumplirlo por la puerta de atrás`,
      `económico ·   la ventana es (${abajo.toFixed(4)} ; ${arriba.toFixed(4)}), de ${(arriba / abajo).toFixed(3)}× de ancho`,
      `económico ·   el valor vigente es ${COSTO_VIVIR_POR_SEGUNDO.toFixed(3)}/s y cae ${COSTO_VIVIR_POR_SEGUNDO > arriba ? 'POR ENCIMA' : COSTO_VIVIR_POR_SEGUNDO < abajo ? 'POR DEBAJO' : 'ADENTRO'}`,
      'económico ·',
      'económico ·   qué pasa con cada candidato, con los dos criterios a la vez:',
      'económico ·     valor  │ ¿cocinar alcanza? │ ¿sobrevivir sigue pidiendo comer? │ vida quieta con 310',
      'económico ·     ───────┼───────────────────┼──────────────────────────────────┼────────────────────',
    ]
    for (const c of [1.0, 0.5, 0.4, 0.364, 0.35, 0.34, 0.32, 0.31, 0.3, 0.25]) {
      const cocina = c <= arriba
      const pideComer = c > abajo
      const ticksQuieta = Math.floor((TANQUE_DEL_CRITERIO / c) * HZ)
      filas.push(
        `económico ·     ${c.toFixed(3).padStart(6)} │ ${(cocina ? 'sí' : 'NO').padStart(17)} │ ` +
          `${(pideComer ? 'sí' : 'NO — se cumple quieta').padStart(32)} │ ${String(ticksQuieta).padStart(11)} ticks`,
      )
    }
    console.log(filas.join('\n'))

    // LOS DOS BORDES EXISTEN Y NO SE CRUZAN, que es lo único que este bloque
    // afirma: si mañana se cruzaran, no habría número que cumpla los dos criterios
    // a la vez y la salida dejaría de ser una calibración.
    expect(arriba).toBeGreaterThan(abajo)
    // Y EL VIGENTE CAE ADENTRO DE LOS DOS, que es lo que este bloque vino a
    // conseguir. El renglón decía `toBeGreaterThan(arriba)` —«el 1,0 cae AFUERA por
    // arriba»— y era cierto hasta que el usuario bajó la constante a 0,34. Sigue
    // siendo el mismo guardián y mira los mismos dos bordes: si alguien sube el
    // costo de vivir por encima de 0,3637 vuelve a fallar cocinar, y si lo baja de
    // 0,3100 el criterio (2) se cumple sin comer. Las dos cosas tienen que doler.
    expect(COSTO_VIVIR_POR_SEGUNDO).toBeLessThan(arriba)
    expect(COSTO_VIVIR_POR_SEGUNDO).toBeGreaterThan(abajo)
    // ─── EL BORDE DE ARRIBA SE FUE AL DOBLE, Y EL DE ABAJO NO SE MOVIÓ ──────
    //
    // Era 0,364 y es 0,750. La ventana pasó de 1,174× de ancho a 2,42×, y la razón
    // es de una sola perilla: la eficiencia de `friccion` pasó de 0,35 a 0,85
    // (tramo N), el precio térmico del fuego bajó de 657,46 a 270,72 y con un fuego
    // más barato el mundo se banca que vivir cueste más.
    //
    // Y EL DE ABAJO NI SE ENTERÓ, que es lo que hay que leer: sale de `310 / 1000 s`
    // y no toca el fuego por ningún lado. Los dos bordes miden criterios distintos y
    // se movió el que tenía que moverse.
    //
    // LO QUE ESTO ABRE Y NO SE VA A USAR SIN EL USUARIO: el 0,34 vigente sigue
    // adentro y con más aire que antes, así que NO hay nada que recalibrar acá. Lo
    // dejo dicho porque una ventana que se ensancha invita a mover el número del
    // medio, y ése no es un movimiento que este tramo haya medido.
    expect(Number(arriba.toFixed(3))).toBe(0.75)
    expect(Number(abajo.toFixed(3))).toBe(0.31)
  })

  it('el tanque del criterio copiado del arnés del Hito 5 sigue diciendo lo que dice acá', () => {
    // Mismo guardián que las constantes de la ley 3, y por el mismo motivo: el 310
    // es una `const` de un test de OTRO paquete, así que ningún import lo trae. Si
    // el arnés del Hito 5 cambia el tanque, el borde de abajo de la ventana se
    // mueve y este archivo tiene que enterarse.
    //
    // Y SE ENTERÓ DE UNA MUDANZA, que también es su trabajo: las constantes
    // vivían en `hito-5-la-emergencia.test.ts` y el tramo Ñ las mudó a
    // `el-banco-de-la-mente.ts` (el banco se repartió en tandas, mismo patrón que
    // `azar.ts`). Este guardián se puso rojo con el archivo viejo —«expected null
    // not to be null»— que es exactamente lo que tiene que hacer un grep sobre un
    // fuente que se movió: fallar ruidoso, no leer un número de otro lado.
    const arnes = fileURLToPath(new URL('../../juez/tests/el-banco-de-la-mente.ts', import.meta.url))
    const fuente = readFileSync(arnes, 'utf8')
    const m = /const TANQUE = ([0-9.]+)/.exec(fuente)
    expect(m).not.toBeNull()
    expect(Number(m?.[1])).toBe(TANQUE_DEL_CRITERIO)
    const t = /const TICKS = ([0-9_]+)/.exec(fuente)
    expect(Number(t?.[1]?.replace(/_/g, ''))).toBe(TICKS_DEL_CRITERIO)
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
