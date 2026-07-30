// ─── LA PROMESA DEL ADR II-0008, MEDIDA DESDE EL MUNDO ───────────────────────
//
// «Cocinar tarda lo que tarda. Cambiar la frecuencia cambia CON QUÉ FINURA se
// muestrea el mismo mundo, no qué tan rápido pasan las cosas.»
//
// `physics/tests/el-tiempo-en-segundos.test.ts` ya mide eso sobre `paso()`, un
// cuerpo suelto en un entorno fijo. Este archivo lo mide donde el juego ocurre:
// **el mismo mundo entero, corrido cuatro veces, una por frecuencia admisible**,
// con las doce leyes, los cuatro procesos, las intenciones y los sistemas propios
// del mundo adentro. Es la única prueba de que las dos perillas del ADR II-0007
// están de verdad separadas, porque la frecuencia entra al mundo por sitios que
// `@anima/physics` no ve: `stepWorld` decide su `dt`, la actividad en curso
// acumula segundos, y —esto es lo que este archivo encontró— hay sistemas del
// mundo que siguen contando en ticks.
//
// ─── CÓMO SE LEE ────────────────────────────────────────────────────────────
//
//   · `it(...)` normal      → la promesa se cumple, con su número medido.
//   · `it(... documentado)` → un número que hoy es así; el cuerpo lo clava para
//                             que no se mueva sin que nadie se entere.
//   · `it.fails(...)`       → HUECO ABIERTO. El cuerpo afirma lo que el ADR
//     con «SIGUE ABIERTO»     promete; el mundo hace otra cosa. Vitest lo cuenta
//                             como esperado-que-falle, y arriba de cada uno está
//                             escrito qué haría falta para cerrarlo.
//
// ─── EL VEREDICTO, EN UNA LÍNEA ─────────────────────────────────────────────
//
// La promesa SE CUMPLE para los SEIS hechos que el criterio pide —cocinar el
// filete, carbonizar la rama, deshilachar, atar, sacar y llevar la vara a
// 375 °C—: el peor desvío sobre las cuatro frecuencias es CUANTIZACIÓN DEL TICK
// y no error de integración.
//
// Y NO se cumple en un lugar, medido abajo con su número: **caminar se cuenta en
// ticks**: diez celdas cuestan 10/hz segundos, o sea que a 50 Hz la criatura
// camina cinco veces más rápido que a 10. Es perilla de rendimiento moviendo el
// ritmo del juego, que es exactamente lo que el ADR II-0007 prohíbe. Y no es de
// la física: vive en `@anima/world`, que es la mitad que la migración del
// ADR II-0008 no tocó.
//
// ─── EL HUECO 1 SE CERRÓ, Y SU HISTORIA QUEDA ACÁ ───────────────────────────
//
// Había otro —**`friccion` no llegaba a 375 °C a ninguna frecuencia**, no
// llegaba a 34, y la meseta a la que sí llegaba se corría un 41% entre 10 y
// 50 Hz— y lo cerró el ADR II-0010: mientras un `drive` empuja una cualidad,
// ninguna ley la relaja en contra, así que la ley 1 dejó de comerse los 120 °C
// por segundo que la fricción entrega. No se tocó ninguna constante. Su bloque
// sigue abajo, con el `it.fails` convertido en `it` y los números de antes al
// lado de los de ahora.
//
// ─── EL HUECO 3 SE CERRÓ, Y SU HISTORIA QUEDA ACÁ ───────────────────────────
//
// Había un tercero —**vivir se cuenta en ticks**: `COSTO_VIVIR` se cobraba por
// tick, así que el hambre, que es el motor de toda la historia, llegaba cinco
// veces antes a 50 Hz que a 10— y lo cerró el ADR II-0009: la constante pasó a ser
// `COSTO_VIVIR_POR_SEGUNDO` y se aplica con `porPaso(…, d.dt)`, como todas las
// demás. Su bloque sigue abajo, con el `it.fails` convertido en `it` y el número
// de antes escrito al lado del de ahora, porque un hueco que se cierra sin dejar
// rastro es un hueco que se puede volver a abrir sin que nadie lo note.

import { describe, expect, it } from 'vitest'
import {
  buildSeedPhysics,
  dtDeFrecuencia,
  esFrecuenciaAdmisible,
  FRECUENCIAS_ADMISIBLES,
  H_PERDIDA_POR_SEGUNDO,
  HZ_DE_REFERENCIA,
  MICROS_POR_SEGUNDO,
  qualityOf,
  regimenDeLlama,
  T_AMBIENTE,
  unir,
} from '@anima/physics'
import type { Body, ProcessId } from '@anima/physics'

import { COSTO_POR_CELDA, COSTO_VIVIR_POR_SEGUNDO, stepWorld } from '../src/step.js'
import type { WorldBody, WorldState } from '../src/step.js'
import { apply, goTo, wait } from '../src/intent.js'
import type { Intent } from '../src/intent.js'
import { restoreWorld, worldSlots } from '../src/mundo.js'
import { createJournal } from '../src/journal.js'
import { revisarInvariantes } from '../src/invariants.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, mundo } from './mundo-minimo.js'

/**
 * Las cuatro que pide el criterio. `FRECUENCIAS_ADMISIBLES` trae además 100 Hz;
 * acá se corren cuatro para que la corrida entre en la suite normal, y se
 * verifica aparte que las cuatro son un subconjunto de las admisibles —si alguien
 * saca una de la lista, este archivo tiene que enterarse.
 */
const HZ: readonly number[] = [10, 20, 25, 50]

/**
 * Hasta dónde se corre cada mundo.
 *
 * Eran 20 s y son 60 desde el ADR II-0011: la tasa de la ley 3 pasó de 0,2 a
 * 0,016 por segundo y POR KILO —con 0,2, todo fuego se volvía ceniza a los cuatro
 * segundos— y ahora `charred` cruza los 0,8 de la rama de un kilo a los 50 s. El
 * hecho más lento ya no es el filete (14,6 s): es la rama.
 */
const TECHO_SEGUNDOS = 60

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

// ─── EL MUNDO ────────────────────────────────────────────────────────────────
//
// Uno solo, con todo adentro, para que las cuatro corridas sean el MISMO mundo
// muestreado distinto y no cuatro bancos parecidos.
//
// ─── Por qué el fuego es un hoyo tapado y no una fogata al aire ─────────────
//
// Cuando este banco se escribió, una fogata al aire **duraba medio segundo**: la
// ley 3 consumía combustible sin producir calor, así que un cuerpo caliente
// relajaba hacia el ambiente a `H_PERDIDA_POR_SEGUNDO / heatCapacity` por segundo
// y una madera de 3 kg caía por debajo de su ignición a los 0,45 s. Medir una
// cocción de quince segundos contra eso no habría medido el tiempo: habría
// medido la agonía de la fuente.
//
// El ADR II-0011 cerró eso —esa misma madera de 3 kg ahora arde 50 s— y el hoyo
// se conserva igual, por una razón distinta y más fuerte: es una fuente de
// potencia CONSTANTE. Un fuego que se apaga solo —que es lo correcto— mezclaría
// «cuánto tarda en cocinarse» con «cuánto dura el fuego», y este archivo mide lo
// primero.
//
// El hoyo tapado sí se sostiene, y con las piezas que el mundo ya tiene: una
// celda a 700 °C **con casi nada de aire** (`oxygen` 0,04). El aire de menos hace
// dos cosas, las dos del ADR II-0002: la ley 3 no deja que las brasas ardan —o
// sea que su `fuelEnergy` no se consume y la potencia no se mueve en toda la
// corrida— y la ley 4 hace que la rama dé carbón y no ceniza. La celda no relaja
// sola porque el mundo no tiene ningún sistema que mueva el estado de las celdas:
// `stepWorld` las copia y las devuelve intactas. Eso es una IDEALIZACIÓN
// deliberada del banco —un hoyo que nadie alimenta y no se enfría— y está acá
// escrita para que nadie la lea como una afirmación sobre fogatas.
//
// Lo demás está lejos del fuego a propósito: a 22 celdas, el factor de forma
// `0,06/(1+d²)` deja el aporte de las brasas en 0,33 °C, que es lo único que se
// le suma al ambiente de los que frotan.

const FISICA = buildSeedPhysics()

/** Una vara con una hebra atada de un solo lado: la caña de la ley 7. */
function cana(id: string): Body {
  const c = unir(cuerpo('_a', 'madera', 1), undefined, cuerpo('_b', 'liana', 0.4), FISICA, id)
  if (c === undefined) throw new Error('la caña no se armó: cambió `unir` o cambiaron las cotas')
  return c
}

function elMundo(hz: number): WorldState {
  const bodies: readonly WorldBody[] = [
    // El hoyo: las brasas, y la rama apoyada encima (montaje `contacto`).
    enElPiso(cuerpo('brasas', 'carbon', 2.5, { temperature: 700 }), EN(2, 0)),
    // Un kilo y no 1,5: `TASA_CARBONIZACION` es POR KILO desde que se arregló que
    // la masa decidiera la duración en todo el rango, así que carbonizarse cuesta
    // 50 s por kilo y la rama de 1,5 tardaría 75 —afuera del techo de 60 s de este
    // banco—. Lo que este archivo mide es que el ritmo no dependa de la
    // frecuencia, no cuánto pesa la rama.
    { body: cuerpo('rama', 'madera', 1), at: EN(2, 0), supportedBy: 'brasas' },
    // El filete, al lado del hoyo: montaje `piso` a distancia 1, o sea equilibrio
    // en 95,16 °C — arriba de los 63 en que la carne se desnaturaliza y muy abajo
    // de los 280 en que se pirolizaría.
    { body: { ...cuerpo('filete', 'carne', 1), form: 'filete' }, at: EN(1, 0) },
    // Cuatro criaturas, una por proceso, cada una con lo suyo en la mano.
    enElPiso(criatura('ana', 500), EN(-20, 0)),
    enLaMano(cuerpo('corteza', 'corteza', 1), EN(-20, 0), 'ana'),
    enElPiso(criatura('beto', 500), EN(-20, 2)),
    enLaMano(cuerpo('vara', 'madera', 1), EN(-20, 2), 'beto'),
    enLaMano(cuerpo('liana', 'liana', 0.4), EN(-20, 2), 'beto'),
    enElPiso(criatura('cira', 500), EN(-20, 4)),
    enLaMano(cana('cana'), EN(-20, 4), 'cira'),
    enElPiso(cuerpo('banco', 'pescado', 5), EN(-19, 4)),
    // ─── LA VARA DE DINA PESA 0,2 kg Y NO 1, DESDE EL ADR II-0010 ───────────
    //
    // No es aflojar el banco: es que el banco pueda expresar lo que mide. El
    // precio de calentar es `heatCapacity × ΔT / 0,35` y `heatCapacity` es
    // EXTENSIVA, así que llevar una vara de 1 kg de 15 a 375 °C cuesta 1748,57 de
    // `stamina` y el catálogo topa `stamina` en 1000: con la vara vieja, «llega a
    // 375» era imposible por falta de FUERZAS, no por la ley 1, y el hueco 1
    // quedaría medio cerrado y medio confundido. Con 0,2 kg cuesta 352,71 y lo
    // que se mide es la TASA, que es lo que el ADR II-0008 promete. El número de
    // la vara de 1 kg queda medido igual, abajo, en su propio test.
    //
    // Y arrancan a AMBIENTE: un cuerpo sin `temperature` escrita nace en 0 °C y el
    // primer tick se le va en llegar a los 15, lo que corre el hito 0,1 s a 10 Hz.
    enElPiso(criatura('dina', 1000), EN(-20, 6)),
    enLaMano(cuerpo('va', 'madera', 0.2, { temperature: T_AMBIENTE }), EN(-20, 6), 'dina'),
    enLaMano(cuerpo('vb', 'madera', 0.2, { temperature: T_AMBIENTE }), EN(-20, 6), 'dina'),
  ]
  return mundo({
    hz,
    bodies,
    actors: [
      actor('ana', { holding: ['corteza'], capacity: 3 }),
      actor('beto', { holding: ['vara', 'liana'], capacity: 3 }),
      actor('cira', { holding: ['cana'], capacity: 3 }),
      actor('dina', { holding: ['va', 'vb'], capacity: 3 }),
    ],
    cells: [[EN(2, 0), { wet: 0, oxygen: 0.04, temperature: 700 }]],
  })
}

/**
 * Lo que las cuatro criaturas piden EN CADA TICK, que es lo que hace que el
 * guion sea el mismo a cualquier frecuencia: nadie cuenta ticks, cada una
 * sostiene su proceso y el mundo decide cuándo rinde. Quien no actúa pierde la
 * actividad en curso (`stepWorld` la borra), así que sostener es literal.
 */
function guion(w: WorldState, seq: number): readonly Intent[] {
  const pedidos: readonly (readonly [string, ProcessId, readonly { name: string; body: string }[]])[] = [
    ['ana', 'deshilachar', [{ name: 'source', body: 'corteza' }, { name: 'actor', body: 'ana-cuerpo' }]],
    ['beto', 'union', [{ name: 'a', body: 'vara' }, { name: 'binder', body: 'liana' }]],
    ['cira', 'extraccion', [{ name: 'gear', body: 'cana' }, { name: 'source', body: 'banco' }]],
    [
      'dina',
      'friccion',
      [{ name: 'a', body: 'va' }, { name: 'b', body: 'vb' }, { name: 'actor', body: 'dina-cuerpo' }],
    ],
  ]
  const out: Intent[] = []
  for (const [by, proceso, roles] of pedidos) {
    const i = apply({ by, seq }, w.phys, proceso, roles)
    if (i !== undefined) out.push(i)
  }
  return out
}

// ─── LA MEDICIÓN ─────────────────────────────────────────────────────────────

const HECHOS = ['filete', 'rama', 'deshilachar', 'atar', 'sacar', 'vara375'] as const
type Hecho = (typeof HECHOS)[number]

const NOMBRE: Readonly<Record<Hecho, string>> = {
  filete: 'el filete carnoso va de digestibility 0,35 a 0,85',
  rama: 'la rama del hoyo llega a charred 0,8',
  deshilachar: 'deshilachar rinde su hebra',
  atar: 'atar rinde la caña',
  sacar: 'una tirada de extracción saca del banco',
  vara375: 'frotar lleva la vara de 15 a 375 °C',
}

/** Qué hecho cierra cada proceso cuando el mundo dice `completo`. */
const POR_PROCESO: Readonly<Record<string, Hecho>> = {
  deshilachar: 'deshilachar',
  union: 'atar',
  extraccion: 'sacar',
}

/** Los instantes de mundo en los que se fotografía la trayectoria del filete. */
const MARCAS: readonly number[] = [0.5, 1, 2, 4, 8, 12]

interface Foto {
  readonly t: number
  readonly digestibility: number
  readonly temperatura: number
}

interface Corrida {
  readonly hz: number
  readonly dt: number
  /** Segundos de mundo hasta cada hecho. `NaN` si no ocurrió bajo el techo. */
  readonly segundos: Readonly<Record<Hecho, number>>
  /** El mismo hecho contado en PASOS, que es lo que antes fijaba el ritmo. */
  readonly pasos: Readonly<Record<Hecho, number>>
  /**
   * La temperatura de la vara a los 12 s de mundo, cuando ya nadie la frota
   * —dina se queda sin `stamina` antes— y todavía le queda combustible.
   */
  readonly mesetaDeLaVara: number
  readonly trayectoria: readonly Foto[]
  readonly violaciones: readonly string[]
}

/**
 * El tiempo se lleva en MICRO-SEGUNDOS ENTEROS y no con `n * dt`, por la misma
 * razón que `sumarPaso` de `@anima/physics`: `dt` es `1/Hz` redondeado, y veinte
 * veces 0,05 da 0,9999999999999999. Acá el error no rompería el mundo pero sí la
 * comparación entre frecuencias, que es justo lo que este archivo mide.
 */
function correr(hz: number, techo = TECHO_SEGUNDOS): Corrida {
  const dt = dtDeFrecuencia(hz)
  const microsPorPaso = MICROS_POR_SEGUNDO / hz
  const cuando = new Map<Hecho, number>()
  const enPasos = new Map<Hecho, number>()
  const trayectoria: Foto[] = []
  const violaciones: string[] = []
  let w = elMundo(hz)
  let mesetaDeLaVara = 0
  let marca = 0
  const pasos = Math.round(techo / dt)

  for (let n = 1; n <= pasos; n++) {
    const antes = w
    const r = stepWorld(w, guion(w, n))
    w = r.state
    const micros = n * microsPorPaso
    const t = micros / MICROS_POR_SEGUNDO
    for (const v of revisarInvariantes(antes, w, r.events)) violaciones.push(`t=${String(t)} ${v.k}`)

    const anotar = (h: Hecho): void => {
      if (cuando.has(h)) return
      cuando.set(h, t)
      enPasos.set(h, n)
    }
    for (const e of r.events) {
      if (e.k !== 'proceso' || !e.completo) continue
      const h = POR_PROCESO[e.process]
      if (h !== undefined) anotar(h)
    }
    const filete = w.bodies.get('filete')
    if (filete !== undefined && qualityOf(filete.body, 'digestibility', w.phys) >= 0.85) {
      anotar('filete')
    }
    const rama = w.bodies.get('rama')
    if (rama !== undefined && qualityOf(rama.body, 'charred', w.phys) >= 0.8) anotar('rama')
    const va = w.bodies.get('va')
    if (va !== undefined) {
      const grados = qualityOf(va.body, 'temperature', w.phys)
      // A los 12 s exactos y no el máximo de la corrida: desde el ADR II-0011 la
      // vara PRENDE, y el máximo es el sobrepico del tick en que prende, que sí
      // depende de la frecuencia. Lo que no depende es el punto fijo, y a los 12 s
      // ya se llegó a él en las cuatro.
      if (micros === 12 * MICROS_POR_SEGUNDO) mesetaDeLaVara = grados
      if (grados >= 375) anotar('vara375')
    }
    while (marca < MARCAS.length && micros >= (MARCAS[marca] as number) * MICROS_POR_SEGUNDO) {
      const f = w.bodies.get('filete')
      trayectoria.push({
        t: MARCAS[marca] as number,
        digestibility: f === undefined ? Number.NaN : qualityOf(f.body, 'digestibility', w.phys),
        temperatura: f === undefined ? Number.NaN : qualityOf(f.body, 'temperature', w.phys),
      })
      marca++
    }
  }

  // Los seis hechos siempre presentes, y `NaN` para el que no ocurrió: un hecho
  // ausente tiene que ser un número que se pueda comparar y publicar, no una
  // clave que falta y que cada llamador tenga que acordarse de mirar.
  const porHecho = (m: Map<Hecho, number>): Record<Hecho, number> => {
    const out = {} as Record<Hecho, number>
    for (const h of HECHOS) out[h] = m.get(h) ?? Number.NaN
    return out
  }
  return {
    hz,
    dt,
    segundos: porHecho(cuando),
    pasos: porHecho(enPasos),
    mesetaDeLaVara,
    trayectoria,
    violaciones,
  }
}

/** Las cuatro corridas, una sola vez para todo el archivo. */
const CORRIDAS: ReadonlyMap<number, Corrida> = new Map(HZ.map((hz) => [hz, correr(hz)]))

function corridaDe(hz: number): Corrida {
  const c = CORRIDAS.get(hz)
  if (c === undefined) throw new Error(`no se corrió ${String(hz)} Hz`)
  return c
}

const REFERENCIA = corridaDe(HZ_DE_REFERENCIA)

// ─── LA TOLERANCIA, declarada antes de mirar si pasa ─────────────────────────
//
// Dos términos, y son dos cosas distintas. Elegir un solo número relativo
// escondería que el más grande de los dos NO es error del mundo sino del
// instrumento.
//
// 1. CUANTIZACIÓN — `dt(hz) + dt(20 Hz)`.
//    Un hecho no se observa cuando ocurre sino en el primer tick posterior, así
//    que toda medición está redondeada HACIA ARRIBA por menos de un tick. A 10 Hz
//    un tick son 0,1 s: sobre `atar`, que dura un segundo, eso solo es el 10% del
//    valor. Ninguna implementación puede hacer que dos frecuencias coincidan más
//    fino que esto, y pedirlo sería pedir que el reloj de 10 Hz vea entre sus
//    propios ticks.
//
// 2. INTEGRACIÓN — 1,5% del valor de referencia.
//    Lo que el ADR II-0008 pidió medir: las doce leyes no son lineales, así que
//    muestrear más grueso da otra curva. El archivo hermano de `@anima/physics`
//    declaró 3% sobre cinco frecuencias y midió 1,43% en el peor caso (el cuero,
//    41 s). Acá, con el mundo entero encima, el peor desvío MEDIDO es 1,33% y
//    **es cuantización**: `extraccion` dura 1,5 s y a 25 Hz el tick es 0,04 s,
//    que no divide a 1,5 — completa en el paso 38, o sea a 1,52 s. Descontando la
//    cuantización, el peor error de integración medido es el filete a 50 Hz:
//    0,07 s sobre 14,55, o sea 0,48%.
//
// El 1,5% no se eligió para que pase: se eligió después de medir 0,48%, con un
// margen de 3×, y es más ESTRECHO que el 3% del archivo de física porque acá los
// hechos son más cortos y el error tiene menos tiempo para acumularse. Si alguna
// vez este número hay que subirlo, el commit que lo suba tiene que decir por qué.
const TOLERANCIA_DE_INTEGRACION = 0.015

/** Además, y por separado: ningún hecho puede correrse más de esto en relativo. */
const TOLERANCIA_RELATIVA = 0.03

function margen(hz: number, referencia: number): number {
  return dtDeFrecuencia(hz) + dtDeFrecuencia(HZ_DE_REFERENCIA) + TOLERANCIA_DE_INTEGRACION * referencia
}

/**
 * Los SEIS hechos, todos los que el criterio pide. `vara375` entró con el ADR
 * II-0010: hasta entonces no ocurría a ninguna frecuencia y el banco lo medía
 * aparte, en un bloque de hueco abierto. Ahora ocurre y se compara igual que los
 * otros cinco, que es donde tiene que estar.
 */
const OCURREN: readonly Hecho[] = ['filete', 'rama', 'deshilachar', 'atar', 'sacar', 'vara375']

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

const col = (x: number, ancho = 10): string => `${x.toFixed(3)}s`.padStart(ancho)

// ─── EL CRITERIO ─────────────────────────────────────────────────────────────

describe('el mismo mundo, a 10, 20, 25 y 50 Hz, tarda los mismos segundos', () => {
  it('las cuatro frecuencias son admisibles y el mundo arranca en las cuatro', () => {
    for (const hz of HZ) {
      expect([hz, esFrecuenciaAdmisible(hz)]).toEqual([hz, true])
      expect([hz, FRECUENCIAS_ADMISIBLES.includes(hz)]).toEqual([hz, true])
      expect([hz, corridaDe(hz).dt * hz]).toEqual([hz, 1])
    }
  })

  it('el mundo que se mide es un mundo LEGAL en las cuatro', () => {
    // Si el mundo violara un invariante, los segundos medidos serían los de una
    // simulación rota y no probarían nada. Se revisa en TODOS los ticks de las
    // cuatro corridas, con `antes` y `después`, que es como se caza una
    // conservación rota antes de que mueva ningún hash.
    for (const hz of HZ) expect([hz, corridaDe(hz).violaciones]).toEqual([hz, []])
  })

  it('los cinco hechos ocurren, y ocurren en el mismo segundo de mundo', () => {
    const filas: string[] = []
    let peorRelativo = 0
    let peorNombre = ''
    for (const h of OCURREN) {
      const referencia = REFERENCIA.segundos[h]
      expect([h, Number.isNaN(referencia)], `${NOMBRE[h]} no ocurrió a ${String(HZ_DE_REFERENCIA)} Hz`).toEqual([h, false])
      for (const hz of HZ) {
        const medido = corridaDe(hz).segundos[h]
        expect([h, hz, Number.isNaN(medido)], `${NOMBRE[h]} no ocurrió a ${String(hz)} Hz`).toEqual([h, hz, false])
        const desvio = Math.abs(medido - referencia)
        const relativo = desvio / referencia
        if (relativo > peorRelativo) {
          peorRelativo = relativo
          peorNombre = `${h} a ${String(hz)} Hz`
        }
        expect(
          [h, hz, desvio <= margen(hz, referencia)],
          `${NOMBRE[h]}: ${String(medido)} s a ${String(hz)} Hz contra ${String(referencia)} s a ${String(HZ_DE_REFERENCIA)} Hz — se corrió ${String(desvio)} s y el margen es ${String(margen(hz, referencia))} s`,
        ).toEqual([h, hz, true])
        expect([h, hz, relativo <= TOLERANCIA_RELATIVA]).toEqual([h, hz, true])
      }
      filas.push(`  ${NOMBRE[h].padEnd(50)}${HZ.map((hz) => col(corridaDe(hz).segundos[h])).join('')}`)
    }
    log([
      `══ EL RITMO, EN SEGUNDOS DE MUNDO ══  peor desvío contra ${String(HZ_DE_REFERENCIA)} Hz: ${(peorRelativo * 100).toFixed(2)}% (${peorNombre})`,
      `  ${'hecho'.padEnd(50)}${HZ.map((hz) => `${String(hz)} Hz`.padStart(10)).join('')}`,
      ...filas,
      `  ${'(el filete, en PASOS: lo que antes mandaba)'.padEnd(50)}${HZ.map((hz) => String(corridaDe(hz).pasos.filete).padStart(10)).join('')}`,
    ])
  })

  it('el filete arranca EXACTAMENTE en 0,35, que es la mitad del enunciado', () => {
    // «De 0,35 a 0,85» tiene que ser literal y no aproximado: 0,35 es la
    // `digestibility` cruda de lo carnoso, y sale de la sustancia y no de un
    // estado escrito a mano. Si alguien recalibrara la carne, este test avisa
    // antes de que la fila del tiempo cambie sin explicación.
    const w = elMundo(HZ_DE_REFERENCIA)
    const f = w.bodies.get('filete')
    if (f === undefined) throw new Error('el filete no está en el mundo')
    expect(qualityOf(f.body, 'digestibility', w.phys)).toBe(0.35)
    // Y es carnoso: el tag sale de la sustancia, no del nombre del cuerpo.
    expect(w.phys.substances.get('carne')?.tags.includes('carnoso')).toBe(true)
  })

  it('control negativo: en PASOS el mismo hecho cambia cinco veces, y tiene que cambiar', () => {
    // Sin esto, el test de arriba podría estar midiendo un mundo que no se mueve.
    // Que los SEGUNDOS coincidan y los PASOS no es exactamente la separación que
    // el ADR II-0007 pidió y el II-0008 construyó.
    const a10 = corridaDe(10).pasos.filete
    const a50 = corridaDe(50).pasos.filete
    expect(a50 / a10).toBeGreaterThan(4.5)
    expect(a50 / a10).toBeLessThan(5.5)
    // Y las duraciones declaradas se leen en segundos y no en pasos: `atar` dice
    // un segundo, y un segundo son diez pasos a 10 Hz y cincuenta a 50.
    expect(corridaDe(10).pasos.atar).toBe(10)
    expect(corridaDe(50).pasos.atar).toBe(50)
    expect(corridaDe(10).segundos.atar).toBe(corridaDe(50).segundos.atar)
  })
})

// ─── EL ERROR DE INTEGRACIÓN, QUE EL ADR DEJÓ ANOTADO COMO RIESGO ────────────

describe('el error de integración, medido y no estimado', () => {
  it('las trayectorias se separan en el transitorio y convergen después', () => {
    // El ADR II-0008: «a 10 Hz cada paso aplica el doble de cambio que a 20, y
    // las leyes no son lineales. Hay que medir cuánto se separan las trayectorias
    // entre frecuencias admisibles y decidir un rango soportado».
    //
    // Acá está medido, a tiempo de mundo FIJO —no en el mismo paso, que sería
    // comparar dos relojes distintos— sobre el filete: la cualidad que la ley 5
    // integra y la temperatura que la ley 1 relaja.
    const filas: string[] = []
    let peor = 0
    const separacion: number[] = []
    for (let m = 0; m < MARCAS.length; m++) {
      const foto = (hz: number): Foto => corridaDe(hz).trayectoria[m] as Foto
      const dRef = foto(HZ_DE_REFERENCIA).digestibility
      const tRef = foto(HZ_DE_REFERENCIA).temperatura
      const dSep = Math.abs(foto(10).digestibility - foto(50).digestibility) / dRef
      const tSep = Math.abs(foto(10).temperatura - foto(50).temperatura) / tRef
      separacion.push(dSep)
      if (dSep > peor) peor = dSep
      if (tSep > peor) peor = tSep
      filas.push(
        `  t = ${String(foto(HZ_DE_REFERENCIA).t).padStart(4)} s   ` +
          `digestibility ${foto(10).digestibility.toFixed(6)} / ${foto(50).digestibility.toFixed(6)}  ` +
          `→ ${(dSep * 100).toFixed(3)}%   ` +
          `temperatura ${foto(10).temperatura.toFixed(3)} / ${foto(50).temperatura.toFixed(3)}  ` +
          `→ ${(tSep * 100).toFixed(3)}%`,
      )
    }
    log([
      '══ 10 Hz CONTRA 50 Hz, A TIEMPO DE MUNDO FIJO ══════════════════════════',
      ...filas,
      `  peor separación: ${(peor * 100).toFixed(2)}%  ·  y es TRANSITORIA: se cierra sola`,
    ])

    // La cota: 8%. El peor medido es 5,57%, y es la TEMPERATURA a los 0,5 s —el
    // filete todavía calentándose, que es donde la exponencial tiene más
    // curvatura y donde un paso grande se pasa de largo. La cualidad integrada
    // nunca se separa más de 2,03%.
    expect(peor).toBeLessThan(0.08)

    // Y lo que de verdad importa para la promesa: la separación DECRECE. Un error
    // de integración que se acumulara haría que dos frecuencias contaran dos
    // historias distintas; éste se cierra solo porque las leyes relajan hacia el
    // mismo punto fijo, que es el mismo a cualquier `dt`.
    const primera = separacion[0] as number
    const ultima = separacion[separacion.length - 1] as number
    expect(ultima).toBeLessThan(primera)
    expect(ultima).toBeLessThan(0.01)
  })

  it('YA NO HAY MESETA · frotar llega al techo del drive a las cuatro frecuencias', () => {
    // ─── LO QUE ESTE BLOQUE DECÍA CUANDO EL HUECO 1 ESTABA ABIERTO ──────────
    //
    // Se llamaba «documentado · la meseta de frotar se corre EXACTAMENTE un paso
    // del drive», y medía el error de partición de operadores en su forma más
    // limpia: el tick aplica primero la intención y después las leyes, así que
    // sobre la vara de 1 kg de entonces (`heatCapacity` = 1,7) la cuenta cerrada
    // daba
    //
    //   punto fijo   T* = ambiente + 12·heatCapacity − 120/hz
    //
    // y las cuatro mesetas medidas eran 23,40 / 29,40 / 30,60 / 33,00 °C a 10, 20,
    // 25 y 50 Hz — un 41% de corrimiento entre la primera y la última, y el
    // término que sobraba, `120/hz`, era EXACTAMENTE un paso del drive: lo que la
    // fricción empujaba al principio del tick y la ley 1 se llevaba al final.
    //
    // ─── Y POR QUÉ YA NO ────────────────────────────────────────────────────
    //
    // El ADR II-0010: mientras el `drive` está activo, la ley 1 no relaja esa
    // cualidad EN CONTRA del empuje. El término que sobraba era justamente ése, y
    // con él se fue la meseta entera. Ahora la vara sube 120 °C por segundo hasta
    // el `toward` del proceso, 400, a cualquier frecuencia.
    //
    // El bloque se conserva —convertido, con el número viejo escrito arriba—
    // porque un hueco que se cierra sin dejar rastro se puede volver a abrir sin
    // que nadie lo note. Es la misma decisión que tomó el ADR II-0009 con el
    // hueco 3.
    const drive = FISICA.processes.get('friccion')?.effects[0]
    if (drive === undefined || drive.k !== 'drive') throw new Error('friccion cambió de forma')
    const filas: string[] = []
    for (const hz of HZ) {
      const pico = corridaDe(hz).mesetaDeLaVara
      // Y desde el ADR II-0011 ya no llega al techo del `drive` sino al RÉGIMEN DE
      // LA LLAMA, que está más arriba y no lo sostiene ninguna mano: la vara
      // prendió a los 2,4 s y a los 12 sigue ardiendo con dina muerta hace rato.
      //
      // El margen de un grado es la fogata del hoyo, a 22 celdas: aporta 0,36 °C
      // de ambiente y por lo tanto corre el punto fijo lo mismo. Que sea el MISMO
      // número en las cuatro frecuencias —y eso se afirma abajo, sin margen— es lo
      // que este test mide.
      expect(pico).toBeGreaterThan(drive.toward)
      expect(pico).toBeCloseTo(T_AMBIENTE + regimenDeLlama(1), 0)
      filas.push(`  ${String(hz).padStart(3)} Hz → ${pico.toFixed(2)} °C`)
    }
    // Las cuatro coinciden a nueve decimales, y antes se corrían un 41%. No a
    // TODOS los decimales: el punto fijo se alcanza asintóticamente y a los 12 s
    // las cuatro trayectorias todavía difieren en los últimos bits. El desvío
    // medido entre la peor y la mejor es 1,5e-10 grados sobre 615,36.
    const mesetas = HZ.map((hz) => corridaDe(hz).mesetaDeLaVara)
    for (const m of mesetas) expect(m).toBeCloseTo(mesetas[0] as number, 9)
    log([
      '══ LA MESETA DE FROTAR · CERRADA (ADR II-0010) ═════════════════════════',
      ...filas,
      '  (antes: 23,40 / 29,40 / 30,60 / 33,00 °C — un 41% de corrimiento y ninguna llegaba a 375)',
    ])
    // El acoplamiento de la ley 1 sigue siendo el que era, y está acá con nombre
    // para que se vea que la reparación NO tocó ninguna constante: lo que cambió
    // es cuándo se aplica, no cuánto vale.
    expect(H_PERDIDA_POR_SEGUNDO).toBe(10)
    expect(T_AMBIENTE).toBe(15)
  })
})

// ─── LOS TRES HUECOS, CADA UNO CON SU NÚMERO ─────────────────────────────────

describe('lo que NO cumple la promesa, medido', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // HUECO 1 — `friccion` NO LLEGABA A 375 °C. CERRADO POR EL ADR II-0010.
  //
  // Lo que decía este bloque cuando estaba abierto: «El comentario de `FRICCION`
  // en `physics/src/process.ts` dice: *TRES SEGUNDOS llevan la madera de 15 a
  // 375 °C —120 grados por segundo— y se comen 48 de `stamina`*. Las tres partes
  // son falsas en el mundo, y las tres por la misma razón: esa cuenta mira el
  // drive solo, y en el mundo la ley 1 corre en el mismo tick», con
  //
  //   · el techo:   T* = 15 + 12·heatCapacity − 120/hz. Para llegar a 375 hacía
  //                 falta `heatCapacity` ≥ 30, o sea una vara de madera de 17,6 kg
  //                 — que además NO ES PORTABLE, porque `portable` topa en 8 kg.
  //                 No es que la aritmética no cerrara por poco: no había ningún
  //                 cuerpo del mundo con el que cerrara.
  //   · las cuatro mesetas medidas: 23,40 / 29,40 / 30,60 / 33,00 °C.
  //
  // Ahora **la vara llega a 375 °C en 3,00 s a las cinco frecuencias
  // admisibles**, que es exactamente lo que el comentario promete. Y no se tocó
  // ninguna constante de calibración: `H_PERDIDA_POR_SEGUNDO` sigue valiendo 10 y
  // `porSegundo` sigue valiendo 120. Lo que cambió es CUÁNDO se aplica la ley 1 —
  // mientras un `drive` empuja una cualidad, ninguna ley la relaja en contra.
  //
  // Lo que NO cerró el ADR II-0010, y hay que decirlo acá porque este archivo es
  // donde se buscaría: **el precio**. Encender cuesta `heatCapacity × ΔT / 0,35`
  // y `heatCapacity` es extensiva, así que la vara de 1 kg que este banco usaba
  // cuesta 1748,57 de `stamina` contra un techo de catálogo de 1000. Por eso el
  // banco pasó a una vara de 0,2 kg: se enciende con yesca, no con leños. La tabla
  // entera está en `tests/el-fuego.test.ts`.
  //
  // Y los «48 de stamina» del comentario NO son reproducibles con ninguna vara
  // levantable: corresponden a 27,5 gramos de madera. Medido en `el-fuego`.
  it('documentado · lo que frotar cuesta ahora, y lo que costaba la vara vieja', () => {
    for (const hz of HZ) {
      const c = corridaDe(hz)
      // LLEGA, y en el segundo que la cuenta predice. El margen es un tick.
      expect([hz, Number.isNaN(c.segundos.vara375)]).toEqual([hz, false])
      // `ceil(2,375·hz)` y no `3·hz` desde el ADR II-0011: la fricción cruza los
      // 300 de ignición de lo leñoso a los 2,375 s y los grados que faltan hasta
      // 375 los pone la llama, no la mano.
      expect([hz, Math.abs(c.pasos.vara375 - Math.ceil(2.375 * hz)) <= 1]).toEqual([hz, true])
    }
    // La vara de 1 kg que este banco usaba: el techo de `stamina` no le alcanza.
    // Es el motivo por el que el banco pesa 0,2 kg y no un aflojamiento.
    const deUnKilo = qualityOf(cuerpo('vieja', 'madera', 1), 'heatCapacity', FISICA)
    const costoDeUnKilo = (deUnKilo * (375 - T_AMBIENTE)) / 0.35
    expect(Number(costoDeUnKilo.toFixed(2))).toBe(1748.57)
    expect(costoDeUnKilo).toBeGreaterThan(1000)
    // Y la vara que la cuenta VIEJA necesitaba sigue sin poderse agarrar: queda
    // acá porque es el número que explicaba por qué el hueco no era de calibración.
    const masaQueHaríaFalta = 30 / 1.7
    expect(masaQueHaríaFalta).toBeGreaterThan(8)
    expect(qualityOf(cuerpo('varona', 'madera', masaQueHaríaFalta), 'portable', FISICA)).toBe(0)
    log([
      '══ EL HUECO 1 · CERRADO (ADR II-0010) ═════════════════════════════════',
      `  ${HZ.map((hz) => `${String(hz)} Hz → ${corridaDe(hz).segundos.vara375.toFixed(3)} s`).join('   ')}`,
      '  (antes: no llegaba a ninguna frecuencia, y la meseta se corría un 41% entre 10 y 50 Hz)',
      `  lo que queda abierto es el PRECIO: la vara de 1 kg de este banco costaría ${costoDeUnKilo.toFixed(2)}`,
      '  de stamina y el catálogo topa en 1000. Se enciende con yesca, no con leños.',
    ])
  })

  it('CERRADO · frotar lleva la vara de 15 a 375 °C, a las cuatro frecuencias', () => {
    for (const hz of HZ) expect(Number.isNaN(corridaDe(hz).segundos.vara375)).toBe(false)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // HUECO 2 — CAMINAR SE MIDE EN TICKS.
  //
  // `intencionCaminar` avanza UNA CELDA POR TICK. No hay ninguna tasa en
  // segundos de por medio, así que la velocidad de la criatura ES la frecuencia:
  // a 50 Hz camina cinco veces más rápido que a 10. Es exactamente la perilla
  // del rendimiento moviendo el ritmo del juego, que es lo que el ADR II-0007
  // prohíbe con todas las letras, y la migración del II-0008 no lo tocó porque
  // vive en `@anima/world` y no en el catálogo de la física.
  //
  // QUÉ HARÍA FALTA PARA CERRARLO: una velocidad en CELDAS POR SEGUNDO —del
  // cuerpo, no del mundo—, y un resto acumulado en segundos igual que
  // `Activity.segundos`, para que a 50 Hz haga falta juntar varios ticks antes
  // de que la criatura entre en la celda siguiente. Es la misma forma que ya
  // tiene un proceso con `completion`, aplicada al paso.
  it('documentado · caminar diez celdas cuesta 10/hz segundos, o sea que es un conteo de ticks', () => {
    const filas: string[] = []
    for (const hz of HZ) {
      const medido = caminarDiezCeldas(hz)
      // EXACTO, no aproximado: diez celdas son diez ticks, siempre.
      expect([hz, medido.segundos]).toEqual([hz, 10 / hz])
      expect([hz, medido.pasos]).toEqual([hz, 10])
      // Y lo que cuesta el viaje son diez veces el precio POR CELDA —que no
      // depende de la frecuencia y no tiene por qué (ADR II-0009)— más lo que
      // cuesta estar vivo los `10/hz` segundos que el viaje dura. O sea que el
      // mismo viaje sale MÁS BARATO a 50 Hz que a 10, y no porque caminar valga
      // menos: porque tarda menos. Ése es el hueco, dicho con la cuenta.
      // Los dos lados se redondean: lo que se afirma es la CUENTA, no el último
      // bit de IEEE-754.
      expect([hz, Number(medido.stamina.toFixed(6))]).toEqual([
        hz,
        Number((10 * COSTO_POR_CELDA + (10 / hz) * COSTO_VIVIR_POR_SEGUNDO).toFixed(6)),
      ])
      filas.push(
        `  ${String(hz).padStart(3)} Hz → ${medido.segundos.toFixed(3)} s de mundo   (${String(medido.pasos)} ticks, ${medido.stamina.toFixed(2)} de stamina)`,
      )
    }
    log(['══ EL HUECO 2 · CAMINAR ═══════════════════════════════════════════════', ...filas])
  })

  it.fails('SIGUE ABIERTO · caminar diez celdas tendría que costar los mismos segundos a cualquier frecuencia', () => {
    const referencia = caminarDiezCeldas(HZ_DE_REFERENCIA).segundos
    for (const hz of HZ) {
      const medido = caminarDiezCeldas(hz).segundos
      expect(Math.abs(medido - referencia)).toBeLessThanOrEqual(margen(hz, referencia))
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // HUECO 3 — VIVIR SE MEDÍA EN TICKS. CERRADO POR EL ADR II-0009.
  //
  // Lo que decía este bloque cuando estaba abierto: «`sistemaMetabolismo` cobra
  // `COSTO_VIVIR` por TICK, y el motor de la historia corre cinco veces más
  // rápido a 50 Hz que a 10. La misma partida, el mismo mundo, y el hambre llega
  // cinco veces antes por haber subido la frecuencia para que el render fuera más
  // suave.» Medido entonces, con `COSTO_VIVIR = 0,01` por tick:
  //
  //   |                            | 10 Hz | 20 Hz | 50 Hz |
  //   | stamina por diez segundos  |  1,0  |  2,0  |  5,0  |
  //
  // Ahora la constante es `COSTO_VIVIR_POR_SEGUNDO` y se aplica con
  // `porPaso(…, d.dt)`, la misma conversión que `aplicarEfectos` hace veinte
  // líneas más arriba en el mismo archivo, y las tres columnas dan el mismo número.
  //
  // OJO CON LEER ESTO COMO UNA MIGRACIÓN DE FORMA: no lo es. El ADR II-0009 no
  // eligió 0,2 por segundo —el número que habría dejado la conducta quieta a
  // 20 Hz— sino 1,0, o sea 5× más caro, y con un motivo medido sobre cien
  // partidas. La huella de conducta del mundo SE TENÍA QUE MOVER, y se movió por
  // eso y sólo por eso.
  //
  // Y LA CONSTANTE VOLVIÓ A BAJAR: hoy es 0,34, así que las tres columnas dan 3,4 y
  // no 10,0. Lo que este bloque afirma no cambió —el gasto no depende del muestreo—
  // y por eso se afirma la CUENTA `10 × la constante` y no el número escrito.
  it('documentado · vivir diez segundos cuesta 3,4 de stamina, se muestree como se muestree', () => {
    const filas: string[] = []
    // Los dos lados redondeados, igual que en el bloque del hueco 2: `10 × 0.34` da
    // 3,4000000000000004 en IEEE-754 y lo que se afirma es la cuenta.
    const esperado = Number((10 * COSTO_VIVIR_POR_SEGUNDO).toFixed(6))
    for (const hz of HZ) {
      const gastado = vivirDiezSegundos(hz)
      expect([hz, Number(gastado.toFixed(6))]).toEqual([hz, esperado])
      filas.push(
        `  ${String(hz).padStart(3)} Hz → ${gastado.toFixed(3)} de stamina en diez segundos de mundo` +
          `   (antes: ${(0.01 * hz * 10).toFixed(3)})`,
      )
    }
    log(['══ EL HUECO 3 · VIVIR · CERRADO ═══════════════════════════════════════', ...filas])
  })

  it('CERRADO · diez segundos de mundo cuestan la misma stamina a cualquier frecuencia', () => {
    const referencia = vivirDiezSegundos(HZ_DE_REFERENCIA)
    for (const hz of HZ) {
      expect(Math.abs(vivirDiezSegundos(hz) - referencia) / referencia).toBeLessThanOrEqual(
        TOLERANCIA_RELATIVA,
      )
    }
    // Y con el control negativo puesto: si la resta hubiera vuelto a contarse por
    // tick, esto daría 5× entre 10 y 50 Hz. Da 1×.
    expect(Number((vivirDiezSegundos(50) / vivirDiezSegundos(10)).toFixed(6))).toBe(1)
  })
})

/** Diez celdas en línea recta, y lo que costaron. Mundo aparte y mínimo. */
function caminarDiezCeldas(hz: number): { segundos: number; pasos: number; stamina: number } {
  const micros = MICROS_POR_SEGUNDO / hz
  let w = mundo({ hz, bodies: [enElPiso(criatura('ana', 500), EN(0, 0))], actors: [actor('ana')] })
  const techo = Math.round(30 / dtDeFrecuencia(hz))
  for (let n = 1; n <= techo; n++) {
    w = stepWorld(w, [goTo({ by: 'ana', seq: n }, EN(10, 0))]).state
    const c = w.bodies.get('ana-cuerpo')
    if (c !== undefined && c.at.x >= 10) {
      return {
        segundos: (n * micros) / MICROS_POR_SEGUNDO,
        pasos: n,
        stamina: 500 - qualityOf(c.body, 'stamina', w.phys),
      }
    }
  }
  return { segundos: Number.NaN, pasos: -1, stamina: Number.NaN }
}

/** Lo que se va en `stamina` por estar vivo diez segundos de mundo, sin hacer nada. */
function vivirDiezSegundos(hz: number): number {
  let w = mundo({ hz, bodies: [enElPiso(criatura('ana', 500), EN(0, 0))], actors: [actor('ana')] })
  const pasos = Math.round(10 / dtDeFrecuencia(hz))
  for (let n = 1; n <= pasos; n++) w = stepWorld(w, [wait({ by: 'ana', seq: n }, 1)]).state
  const c = w.bodies.get('ana-cuerpo')
  return c === undefined ? Number.NaN : 500 - qualityOf(c.body, 'stamina', w.phys)
}

// ─── LO QUE EL MUNDO RECHAZA ─────────────────────────────────────────────────

describe('30 Hz y 60 Hz no arrancan, y el error lo dice', () => {
  // Los dos números que el documento de arquitectura y el hábito traen puestos:
  // 30 Hz —declarados «fijos» sin argumento— y 60, que es lo que late una
  // pantalla. Ninguno divide 10⁶, así que su `dt` no es exacto en la escala de
  // las tasas y el error se acumularía tick a tick hasta que dos motores
  // divergieran sin causa visible. Se rechazan; no se redondean.
  for (const hz of [30, 60]) {
    it(`${String(hz)} Hz: el mundo se para en el primer paso y dice por qué`, () => {
      const s = mundo({ hz, bodies: [enElPiso(criatura('ana'), EN(0, 0))], actors: [actor('ana')] })
      expect(() => stepWorld(s, [])).toThrow(new RegExp(`${String(hz)} Hz`))
      expect(() => stepWorld(s, [])).toThrow(/no es exacto/)
      // El mensaje además enumera salidas: un error que solo dice «no» obliga a
      // ir a leer el código para saber qué sí.
      expect(() => stepWorld(s, [])).toThrow(/10, 20, 25, 50/)
      expect(esFrecuenciaAdmisible(hz)).toBe(false)
      expect(() => dtDeFrecuencia(hz)).toThrow()
    })

    it(`${String(hz)} Hz: no se redondea en silencio a la admisible de al lado`, () => {
      // Lo cómodo y lo fatal. 30 Hz no puede volverse 25 ni 50, y 60 no puede
      // volverse 50: el síntoma no sería un número raro sino una partida que
      // corre a otro ritmo del que su crónica dice.
      const s = mundo({ hz })
      let avanzo = false
      try {
        stepWorld(s, [])
        avanzo = true
      } catch {
        avanzo = false
      }
      expect([hz, avanzo]).toEqual([hz, false])
    })

    it(`${String(hz)} Hz: un guardado y una crónica con esa frecuencia tampoco abren`, () => {
      // No se puede correr un mundo a 30 Hz, pero SÍ se puede escribir un archivo
      // que lo diga: un guardado viejo, una edición a mano, otra versión. Tiene
      // que fallar al abrirlo y no en el tick 400.
      const slots = worldSlots(mundo({ hz: HZ_DE_REFERENCIA }))
      const cabecera = slots.get('mundo') as { tick: number; hz: number }
      const roto = new Map(slots)
      roto.set('mundo', { ...cabecera, hz })
      expect(() => restoreWorld(roto)).toThrow(new RegExp(`${String(hz)} Hz`))
      expect(() => restoreWorld(roto)).toThrow(/no se puede reproducir/)
      expect(() => createJournal({ hz, semilla: 0 })).toThrow(new RegExp(`${String(hz)} Hz`))
    })
  }
})

// ─── EL BORDE DE ABAJO, Y EL RANGO QUE SE RECOMIENDA ─────────────────────────

describe('el borde de abajo: por qué el rango soportado no es «cualquiera»', () => {
  it('la saturación del acople SE TERMINÓ: ninguna brasa cae al ambiente en un tick', () => {
    // ─── LO QUE ESTE TEST MEDÍA, Y ERA EL DIAGNÓSTICO DEL ADR II-0011 ───────
    //
    // `leyTermica` topaba el acople en 1 «por estabilidad»: `min(1, (10/hz)/cap)`.
    // Un cuerpo con `heatCapacity` menor que `10/hz` no se acercaba al equilibrio,
    // SE PONÍA en el equilibrio en un paso, y el borde se movía con la frecuencia:
    //
    //   a 10 Hz  saturaba todo lo que tuviera heatCapacity ≤ 1  (madera ≤ 0,59 kg)
    //   a 20 Hz  ≤ 0,5   (madera ≤ 0,29 kg)
    //   a 25 Hz  ≤ 0,4   (madera ≤ 0,24 kg)
    //   a 50 Hz  ≤ 0,2   (madera ≤ 0,12 kg)
    //
    // Medido entonces: media vara de madera a 400 °C caía a 15,00 —el ambiente
    // entero— en UN tick a 10 Hz, y a 20, 25 y 50 no. No era un desvío del 1%: era
    // otro régimen, y era exactamente el régimen de la yesca.
    //
    // ─── Y POR QUÉ YA NO ───────────────────────────────────────────
    //
    // El ADR II-0011: la ley 1 se integra en forma cerrada y lo que se cierra es
    // `1 − e^(−r·dt)`, que es menor que 1 SIEMPRE. El `min` no se relajó, se
    // BORRÓ, porque no había nada que topar. La misma brasa de 0,5 kg a 10 Hz
    // ahora queda en 133,66 °C después de un tick en vez de en 15,00.
    //
    // Este test es la CARNADA de esa reparación: si alguien vuelve al Euler
    // explícito, el 15,00 reaparece y esto se pone rojo.
    for (const hz of HZ) expect(H_PERDIDA_POR_SEGUNDO / hz).toBe(10 / hz)
    const filas: string[] = []
    // La MADERA a 400 °C es el caso histórico, y ahora mide otra cosa: está arriba
    // de sus 300 de ignición, así que ARDE y la ley 3 la empuja hacia los 615 de
    // régimen. Se mide igual, porque el número viejo —15,00 en un tick a 10 Hz—
    // salía de este mismo cuerpo.
    for (const masa of [0.5, 1]) {
      const cap = masa * 1.7
      const medidas = HZ.map((hz) => unTickDeEnfriamiento('madera', masa, hz))
      filas.push(
        `  brasa de madera de ${masa.toFixed(1)} kg (heatCapacity ${cap.toFixed(2)}) a 400 °C, un tick:  ` +
          HZ.map((hz, i) => `${String(hz)} Hz → ${(medidas[i] as number).toFixed(2)} °C`).join('   '),
      )
      for (const m of medidas) expect(m).toBeGreaterThan(T_AMBIENTE + 100)
    }
    // Y la PIEDRA, que no arde: ahí queda la relajación de la ley 1 sola, que es
    // lo que este test siempre quiso medir. `heatCapacity` = 0,4 para medio kilo,
    // o sea muy por debajo del `10/hz` que saturaba a las cuatro frecuencias.
    const piedra = HZ.map((hz) => unTickDeEnfriamiento('piedra', 0.5, hz))
    filas.push(
      `  canto de piedra de 0,5 kg (heatCapacity 0,40) a 400 °C, un tick:  ` +
        HZ.map((hz, i) => `${String(hz)} Hz → ${(piedra[i] as number).toFixed(2)} °C`).join('   '),
    )
    // NINGUNA de las cuatro lo pone en el ambiente, ni siquiera la que saturaba
    // con margen —a 10 Hz el exponente vale 2,5 y `1 − e^(−2,5)` es 0,918, no 1—.
    for (const t of piedra) expect(t).toBeGreaterThan(T_AMBIENTE)
    // Y el orden es el que la física pide: cuanto más fino el muestreo, menos se
    // enfría en un paso. Monótono, sin saltos de régimen.
    for (let i = 1; i < piedra.length; i++) {
      expect([HZ[i], (piedra[i] as number) > (piedra[i - 1] as number)]).toEqual([HZ[i], true])
    }
    // Y a UN SEGUNDO de mundo las cuatro dan lo mismo, que es lo que el ADR
    // II-0008 pide y lo que el `min` rompía: a 10 Hz el canto valía 15,00 desde el
    // primer tick y a 50 todavía estaba tibio.
    // Cinco kilos y no medio: medio kilo de piedra se enfría del todo en un
    // segundo (constante de tiempo 0,04 s) y «las cuatro dan 15,00» no diría nada.
    // Con cinco kilos la constante es 0,4 s y al segundo todavía queda curva.
    const trasUnSegundo = HZ.map((hz) => unSegundoDeEnfriamiento('piedra', 5, hz))
    // Cinco decimales y no infinitos: el desvío MEDIDO entre 10 y 50 Hz es
    // 2,24e-6 grados sobre 46,60, o sea 4,8e-8 relativo, y es la resolución de
    // `fraccionQueSeCierra` (± 2⁻²⁴ en el exponente). Antes de este ADR el mismo
    // canto daba 15,00 a 10 Hz y 46,60 a 50: un 68%.
    for (const t of trasUnSegundo) expect(t).toBeCloseTo(trasUnSegundo[0] as number, 5)
    // Y la contracara, frotando: la vara de 0,5 kg cruza su punto de ignición a
    // las cuatro frecuencias. El PICO ya no coincide entre ellas —desde el ADR
    // II-0011 la vara prende, y el pico es el sobrepico del tick en que prende,
    // que sí depende del paso— pero el hecho sí: las cuatro encienden.
    const frotadas = HZ.map((hz) => frotarUnaVaraDe(0.5, hz))
    for (const f of frotadas) expect(f).toBeGreaterThanOrEqual(300)
    log([
      '══ EL BORDE DE ABAJO, DESPUÉS DEL ADR II-0011 ═════════════════════',
      ...filas,
      `  y a UN SEGUNDO de mundo las cuatro coinciden: ${(trasUnSegundo[0] as number).toFixed(4)} °C`,
      '  (antes de este ADR, el canto a 10 Hz valía 15,00 desde el primer tick)',
      `  frotando, la vara de 0,5 kg enciende a las cuatro: picos ${frotadas.map((f) => f.toFixed(0)).join(' / ')} °C`,
      '  RECOMENDACIÓN: el rango soportado siguen siendo 10–100 Hz, y ahora sin',
      '  régimen saturado adentro. Lo que queda —y es de integración, no de',
      '  estabilidad— es que las leyes NO lineales (la 5, la 6) se muestrean más',
      '  grueso a 10 Hz: eso está medido arriba y vale menos del 6%.',
    ])
  })

  it('y la regla queda escrita como cuenta, no como tabla', () => {
    // La hebra que rinde `deshilachar` es el 10% de la fuente: de una corteza de
    // 1 kg sale una hebra de 0,1 kg, `heatCapacity` 0,19. Satura a las cuatro
    // frecuencias —haría falta subir de 52,6 Hz— y por eso el rango recomendado
    // es un piso y no una garantía: dice hasta dónde el mundo se comporta igual,
    // no que todo cuerpo posible esté a salvo.
    const heatCapacityDeUnaHebra = 0.1 * 1.9
    for (const hz of HZ) {
      expect([hz, heatCapacityDeUnaHebra <= H_PERDIDA_POR_SEGUNDO / hz]).toEqual([hz, true])
    }
    expect(H_PERDIDA_POR_SEGUNDO / heatCapacityDeUnaHebra).toBeGreaterThan(50)
  })
})

/**
 * A cuánto queda, DESPUÉS DE UN SOLO TICK, una brasa de esa masa a 400 °C que
 * nadie sostiene. Es la saturación del acople de la ley 1 puesta a la vista: si
 * `heatCapacity ≤ 10/hz`, el acople vale 1 y el cuerpo no se acerca al ambiente,
 * se PONE en el ambiente.
 */
function unTickDeEnfriamiento(sustancia: string, masa: number, hz: number): number {
  const w = mundo({
    hz,
    bodies: [enElPiso(cuerpo('brasa', sustancia, masa, { temperature: 400 }), EN(0, 0))],
  })
  const c = stepWorld(w, []).state.bodies.get('brasa')
  if (c === undefined) throw new Error('la brasa desapareció')
  return qualityOf(c.body, 'temperature', w.phys)
}

/** La misma brasa, un SEGUNDO de mundo después: lo que no depende de la frecuencia. */
function unSegundoDeEnfriamiento(sustancia: string, masa: number, hz: number): number {
  let w = mundo({
    hz,
    bodies: [enElPiso(cuerpo('brasa', sustancia, masa, { temperature: 400 }), EN(0, 0))],
  })
  for (let n = 0; n < hz; n++) w = stepWorld(w, []).state
  const c = w.bodies.get('brasa')
  if (c === undefined) throw new Error('la brasa desapareció')
  return qualityOf(c.body, 'temperature', w.phys)
}

/** La temperatura más alta a la que llega una vara frotada cinco segundos. */
function frotarUnaVaraDe(masa: number, hz: number): number {
  let w = mundo({
    hz,
    bodies: [
      enElPiso(criatura('ana', 1000), EN(0, 0)),
      enLaMano(cuerpo('va', 'madera', masa), EN(0, 0), 'ana'),
      enLaMano(cuerpo('vb', 'madera', masa), EN(0, 0), 'ana'),
    ],
    actors: [actor('ana', { holding: ['va', 'vb'], capacity: 3 })],
  })
  let maxima = 0
  const pasos = Math.round(5 / dtDeFrecuencia(hz))
  for (let n = 1; n <= pasos; n++) {
    const i = apply({ by: 'ana', seq: n }, w.phys, 'friccion', [
      { name: 'a', body: 'va' },
      { name: 'b', body: 'vb' },
      { name: 'actor', body: 'ana-cuerpo' },
    ])
    w = stepWorld(w, i === undefined ? [] : [i]).state
    const c = w.bodies.get('va')
    if (c === undefined) break
    const grados = qualityOf(c.body, 'temperature', w.phys)
    if (grados > maxima) maxima = grados
  }
  return maxima
}
