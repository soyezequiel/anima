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
// La promesa SE CUMPLE para los cinco hechos que el criterio pide y que llegan a
// ocurrir —cocinar el filete, carbonizar la rama, deshilachar, atar y sacar—: el
// peor desvío sobre las cuatro frecuencias es 1,33%, y es CUANTIZACIÓN DEL TICK
// y no error de integración. Descontada la cuantización, el peor error de
// integración medido es 0,48%.
//
// Y NO se cumple en tres lugares, los tres medidos abajo con su número:
//
//   1. `friccion` no llega a 375 °C a ninguna frecuencia —no llega a 34— y la
//      meseta a la que sí llega se corre un 40% entre 10 y 50 Hz;
//   2. **caminar se cuenta en ticks**: diez celdas cuestan 10/hz segundos, o sea
//      que a 50 Hz la criatura camina cinco veces más rápido que a 10;
//   3. **vivir se cuenta en ticks**: `COSTO_VIVIR` se cobra por tick, así que el
//      hambre —el motor de toda la historia— llega cinco veces antes a 50 Hz.
//
// Los dos últimos son perilla de rendimiento moviendo el ritmo del juego, que es
// exactamente lo que el ADR II-0007 prohíbe. Y no son de la física: viven en
// `@anima/world`, que es la mitad que la migración del ADR II-0008 no tocó.

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
  T_AMBIENTE,
  unir,
} from '@anima/physics'
import type { Body, ProcessId } from '@anima/physics'

import { COSTO_PASO, COSTO_VIVIR, stepWorld } from '../src/step.js'
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

/** Hasta dónde se corre cada mundo. El hecho más lento (el filete) tarda 14,6 s. */
const TECHO_SEGUNDOS = 20

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

// ─── EL MUNDO ────────────────────────────────────────────────────────────────
//
// Uno solo, con todo adentro, para que las cuatro corridas sean el MISMO mundo
// muestreado distinto y no cuatro bancos parecidos.
//
// ─── Por qué el fuego es un hoyo tapado y no una fogata al aire ─────────────
//
// Porque una fogata al aire, en este mundo, **dura medio segundo**. Un cuerpo
// caliente relaja hacia el ambiente a `H_PERDIDA_POR_SEGUNDO / heatCapacity` por
// segundo, y para una madera de 3 kg eso son 10/5,1 ≈ 2 por segundo: de 700 °C
// cae por debajo de su punto de ignición (300) a los 0,45 s y deja de emitir.
// Medir una cocción de quince segundos contra una fuente que se apaga en el
// primer medio no mediría el tiempo: mediría la agonía de la fuente.
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
    { body: cuerpo('rama', 'madera', 1.5), at: EN(2, 0), supportedBy: 'brasas' },
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
    enElPiso(criatura('dina', 1000), EN(-20, 6)),
    enLaMano(cuerpo('va', 'madera', 1), EN(-20, 6), 'dina'),
    enLaMano(cuerpo('vb', 'madera', 1), EN(-20, 6), 'dina'),
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
  /** La meseta a la que llega la vara frotada, que no es 375. */
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
      if (grados > mesetaDeLaVara) mesetaDeLaVara = grados
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

/** Los cinco hechos que SÍ ocurren. `vara375` no ocurre nunca: ver su bloque. */
const OCURREN: readonly Hecho[] = ['filete', 'rama', 'deshilachar', 'atar', 'sacar']

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

  it('documentado · la meseta de frotar se corre EXACTAMENTE un paso del drive', () => {
    // Éste es el error de integración en su forma más limpia, y no se disimula:
    // el tick aplica primero la intención y después las leyes, o sea que es un
    // método de PARTICIÓN de operadores, y su error es de primer orden en `dt`.
    //
    // La cuenta cerrada, para la vara de madera de 1 kg (`heatCapacity` = 1,7):
    //
    //   por paso   la fricción empuja  120/hz  grados
    //   por paso   la ley 1 devuelve   a·(T − ambiente),  a = (10/hz)/heatCapacity
    //   punto fijo T* = ambiente + 12·heatCapacity − 120/hz
    //
    // El término que sobra —`120/hz`— es EXACTAMENTE un paso del drive: lo que la
    // fricción empuja al principio del tick y la ley 1 se lleva al final. Por eso
    // la diferencia entre dos mesetas no depende del ambiente, ni de la masa, ni
    // de la calibración: es la diferencia de los dos pasos, y nada más.
    const filas: string[] = []
    for (let i = 1; i < HZ.length; i++) {
      const bajo = HZ[i - 1] as number
      const alto = HZ[i] as number
      const medido = corridaDe(alto).mesetaDeLaVara - corridaDe(bajo).mesetaDeLaVara
      const esperado = 120 / bajo - 120 / alto
      filas.push(
        `  de ${String(bajo).padStart(3)} a ${String(alto).padStart(3)} Hz:  ` +
          `medido ${medido.toFixed(4)} °C   ·   un paso del drive ${esperado.toFixed(4)} °C`,
      )
      expect(medido).toBeCloseTo(esperado, 2)
    }
    log([
      '══ LA MESETA DE FROTAR ═════════════════════════════════════════════════',
      `  ${HZ.map((hz) => `${String(hz)} Hz → ${corridaDe(hz).mesetaDeLaVara.toFixed(2)} °C`).join('   ')}`,
      ...filas,
      '  (y ninguna llega a 375: ver el hueco de abajo)',
    ])
    // El acoplamiento de la ley 1 es lo que pone el techo, y está acá con nombre
    // para que se vea de dónde sale el 12: `12 = 120 / H_PERDIDA_POR_SEGUNDO`.
    expect(H_PERDIDA_POR_SEGUNDO).toBe(10)
    expect(T_AMBIENTE).toBe(15)
  })
})

// ─── LOS TRES HUECOS, CADA UNO CON SU NÚMERO ─────────────────────────────────

describe('lo que NO cumple la promesa, medido', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // HUECO 1 — `friccion` no llega a 375 °C, y no es culpa de la migración.
  //
  // El comentario de `FRICCION` en `physics/src/process.ts` dice: «TRES SEGUNDOS
  // llevan la madera de 15 a 375 °C —120 grados por segundo— y se comen 48 de
  // `stamina`». Las tres partes son falsas en el mundo, y las tres por la misma
  // razón: esa cuenta mira el drive solo, y en el mundo la ley 1 corre en el
  // mismo tick.
  //
  //   · el techo:   T* = 15 + 12·heatCapacity − 120/hz. Para llegar a 375 hace
  //                 falta `heatCapacity` ≥ 30, o sea una vara de madera de 17,6 kg.
  //   · el precio:  el drive cobra `heatCapacity · ΔT / 0,35` de `stamina`, o sea
  //                 342,86 · heatCapacity por segundo. Con `heatCapacity` = 30
  //                 son 10.285 por segundo, y `stamina` tiene techo 1000 en el
  //                 catálogo: alcanza para 0,097 s de frotar, o sea 11,7 grados.
  //   · los 48:     una vara de 1 kg gasta los 1000 de `stamina` en 1,7 s.
  //
  // Y hay un tercer candado, que cierra la puerta desde afuera: `friccion` pide
  // `arrangement: held`, y la vara de 17,6 kg que haría falta NO ES PORTABLE —el
  // catálogo topa `portable` en 8 kg—, así que la criatura no puede ni levantarla.
  // No es que la aritmética no cierre por poco: no hay ningún cuerpo del mundo con
  // el que cierre.
  //
  // O sea que **la única fuente primordial de calor del mundo no puede encender
  // nada**, y eso es anterior al ADR II-0008: con las tasas por tick, el mismo
  // punto fijo era 15 + 12·heatCapacity − 6 a cualquier frecuencia. Lo que la
  // migración agregó no es el techo, es que el techo dependa de la frecuencia.
  //
  // QUÉ HARÍA FALTA PARA CERRARLO: una decisión de calibración escrita —bajar
  // `H_PERDIDA_POR_SEGUNDO`, subir la eficiencia del `poweredBy`, o que frotar
  // caliente una zona de contacto y no el cuerpo entero— y volver a correr el
  // barrido térmico. Es un ADR, no un parche.
  it('documentado · lo lejos que llega frotar, y lo que cuesta', () => {
    for (const hz of HZ) {
      const c = corridaDe(hz)
      expect([hz, Number.isNaN(c.segundos.vara375)]).toEqual([hz, true])
      // La meseta cae donde dice la cuenta cerrada, con el ambiente real del
      // banco (15 °C más los 0,33 que aportan las brasas a 22 celdas).
      expect([hz, c.mesetaDeLaVara > 20 && c.mesetaDeLaVara < 40]).toEqual([hz, true])
    }
    // Y la vara con la que la cuenta cerraría no se puede ni agarrar: `friccion`
    // pide tenerla en la mano y `portable` topa en 8 kg. El techo de 375 no está
    // lejos, está afuera.
    const masaQueHaríaFalta = 30 / 1.7
    expect(masaQueHaríaFalta).toBeGreaterThan(8)
    const varona = cuerpo('varona', 'madera', masaQueHaríaFalta)
    expect(qualityOf(varona, 'portable', FISICA)).toBe(0)
    // Y el orden es el que la cuenta predice: más fino muestrea, más alto llega.
    expect(corridaDe(10).mesetaDeLaVara).toBeLessThan(corridaDe(50).mesetaDeLaVara)
    const salto =
      (corridaDe(50).mesetaDeLaVara - corridaDe(10).mesetaDeLaVara) / corridaDe(10).mesetaDeLaVara
    expect(salto).toBeGreaterThan(0.35)
    log([
      '══ EL HUECO 1 ═════════════════════════════════════════════════════════',
      `  frotar no llega a 375 °C a ninguna frecuencia. La meseta se corre un ${(salto * 100).toFixed(1)}%`,
      `  entre 10 y 50 Hz: ${corridaDe(10).mesetaDeLaVara.toFixed(2)} °C contra ${corridaDe(50).mesetaDeLaVara.toFixed(2)} °C.`,
    ])
  })

  it.fails('SIGUE ABIERTO · frotar tendría que llevar la vara de 15 a 375 °C, y no llega', () => {
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
      // Y la `stamina` que cuesta no cambia, porque también se cobra por tick:
      // el mismo viaje sale lo mismo y tarda cinco veces menos.
      // Los dos lados se redondean: `10 × 0,06` da 0,6000000000000001 en
      // IEEE-754 y lo que se afirma acá es la CUENTA, no el último bit.
      expect([hz, Number(medido.stamina.toFixed(6))]).toEqual([
        hz,
        Number((10 * (COSTO_PASO + COSTO_VIVIR)).toFixed(6)),
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
  // HUECO 3 — VIVIR SE MIDE EN TICKS.
  //
  // `sistemaMetabolismo` cobra `COSTO_VIVIR` por TICK. «Lo que cuesta estar vivo
  // un tick, hambre incluida. El motor de la historia», dice su comentario — y
  // el motor de la historia corre cinco veces más rápido a 50 Hz que a 10. Una
  // criatura con 500 de `stamina` aguanta 50.000 segundos de mundo a 10 Hz y
  // 10.000 a 50: la misma partida, el mismo mundo, y el hambre llega cinco veces
  // antes por haber subido la frecuencia para que el render fuera más suave.
  //
  // Es el más barato de los tres de cerrar y el más caro de dejar abierto: el
  // hambre es lo que hace que la criatura tenga que decidir algo.
  //
  // QUÉ HARÍA FALTA PARA CERRARLO: `COSTO_VIVIR` pasa a ser por segundo y se
  // aplica con `porPaso(COSTO_VIVIR_POR_SEGUNDO, dt)`, que es la misma
  // conversión que ya hace `aplicarEfectos` tres líneas más arriba en el mismo
  // archivo. Cuidado con el orden de magnitud: a 20 Hz, `COSTO_VIVIR` = 0,01 por
  // tick son 0,2 por segundo, y ése es el número que hay que escribir para que
  // la conducta a la frecuencia de referencia no se mueva.
  it('documentado · vivir diez segundos cuesta 0,01 × hz × 10 de stamina', () => {
    const filas: string[] = []
    for (const hz of HZ) {
      const gastado = vivirDiezSegundos(hz)
      expect([hz, Number(gastado.toFixed(6))]).toEqual([hz, Number((COSTO_VIVIR * hz * 10).toFixed(6))])
      filas.push(
        `  ${String(hz).padStart(3)} Hz → ${gastado.toFixed(3)} de stamina en diez segundos de mundo`,
      )
    }
    log(['══ EL HUECO 3 · VIVIR ═════════════════════════════════════════════════', ...filas])
  })

  it.fails('SIGUE ABIERTO · diez segundos de mundo tendrían que costar la misma stamina a cualquier frecuencia', () => {
    const referencia = vivirDiezSegundos(HZ_DE_REFERENCIA)
    for (const hz of HZ) {
      expect(Math.abs(vivirDiezSegundos(hz) - referencia) / referencia).toBeLessThanOrEqual(
        TOLERANCIA_RELATIVA,
      )
    }
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
  it('documentado · a 10 Hz el acople de la ley 1 satura para cuerpos de masa corriente', () => {
    // `leyTermica` topa el acople en 1 por estabilidad: `min(1, (10/hz)/cap)`. Un
    // cuerpo con `heatCapacity` menor que `10/hz` no se acerca al equilibrio, SE
    // PONE en el equilibrio en un paso. Y el borde se mueve con la frecuencia:
    //
    //   a 10 Hz  satura todo lo que tenga heatCapacity ≤ 1     (madera ≤ 0,59 kg)
    //   a 20 Hz  ≤ 0,5   (madera ≤ 0,29 kg)
    //   a 25 Hz  ≤ 0,4   (madera ≤ 0,24 kg)
    //   a 50 Hz  ≤ 0,2   (madera ≤ 0,12 kg)
    //
    // O sea que bajar la frecuencia no muestrea el mismo mundo más grueso: mete
    // más cuerpos adentro de un régimen distinto. Y no es teórico — abajo está
    // medido con la única fuente de calor que la criatura tiene.
    for (const hz of HZ) expect(H_PERDIDA_POR_SEGUNDO / hz).toBe(10 / hz)
    const filas: string[] = []
    for (const masa of [0.5, 1]) {
      const medidas = HZ.map((hz) => frotarUnaVaraDe(masa, hz))
      filas.push(
        `  vara de madera de ${masa.toFixed(1)} kg (heatCapacity ${(masa * 1.7).toFixed(2)}):  ` +
          HZ.map((hz, i) => `${String(hz)} Hz → ${(medidas[i] as number).toFixed(2)} °C`).join('   '),
      )
      if (masa === 0.5) {
        // LA MEDIDA QUE DECIDE EL RANGO: media vara de madera NO SE CALIENTA NADA
        // a 10 Hz —queda clavada en el ambiente— y sí se calienta a 20, 25 y 50.
        // No es un desvío del 1%: es que a 10 Hz frotar no hace nada.
        expect(medidas[0]).toBe(T_AMBIENTE)
        for (let i = 1; i < HZ.length; i++) expect(medidas[i]).toBeGreaterThan(T_AMBIENTE)
      }
    }
    log([
      '══ EL BORDE DE ABAJO ══════════════════════════════════════════════════',
      ...filas,
      '  RECOMENDACIÓN: el rango soportado son 20–50 Hz. 10 Hz sigue siendo',
      '  admisible —su `dt` es exacto— pero mete en régimen saturado a cuerpos de',
      '  masa corriente, y ahí la frecuencia deja de ser una perilla de',
      '  rendimiento. La regla, para que no haya que acordarse del número:',
      '  `hz ≥ H_PERDIDA_POR_SEGUNDO / heatCapacity` del cuerpo más liviano que',
      '  al juego le importe.',
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
