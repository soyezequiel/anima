// ─── RE-MEDICIÓN INDEPENDIENTE DEL TICK ──────────────────────────────────────
//
//   «5000 cuerpos a menos de 4 ms por tick» — criterio (c) del Hito 2.
//
// Este archivo NO comparte una línea con `banco-el-tick.test.ts`. Arma su propio
// mundo —sin `mundo-minimo.ts`—, mide con su propio arnés y saca sus propias
// cuentas. Existe porque un número de rendimiento que solo sabe producir el
// banco que lo diagnosticó no es una verificación: es la misma medición dos
// veces.
//
// Y mide LAS DOS COSAS que el banco eligió entre sí:
//
//   - el tick sobre un ESTADO FIJO, que es lo que el banco mide hoy;
//   - el tick sobre un mundo que AVANZA, que es lo que la partida hace de
//     verdad, y que es lo que el banco medía antes de esta optimización.
//
// Si las dos coinciden, el cambio de arnés del optimizador no maquilló nada. Si
// difieren, el número que gobierna el criterio depende del arnés y eso hay que
// decirlo con el número al lado.
//
// Además mide un corpus HETEROGÉNEO —cuerpos de dos y tres partes, cuerpos
// ardiendo, cuerpos en ventana de cocción, cuerpos con masa escrita a nivel
// cuerpo—, porque un corpus de 5000 varas de una parte que no hace nada recorre
// el camino más barato de `paso()` y podría estar contando otra historia.
//
// ─── Lo que midió, contra las fuentes de física de 11b49ae y las de ahora ────
//
//                                          ANTES      AHORA
//   corpus SIMPLE, estado fijo ..........  42,16 ms   8,62 ms    4,9×
//   corpus SIMPLE, mundo que avanza .....  39,75 ms   8,67 ms    4,6×
//   `paso()` solo .......................  39,14 ms   7,63 ms    5,1×
//   corpus VARIADO, mundo que avanza ....  55,87 ms  19,93 ms    2,8×
//   cuerpos que entran en 4 ms ..........    ~485     ~2090      4,3×
//
// Las dos maneras de medir el corpus simple coinciden dentro del 1%, así que el
// cambio de arnés del optimizador —de un mundo que avanzaba a un estado fijo— no
// maquilló el número: lo hizo comparable.
//
// El corpus VARIADO es el que conviene mirar dos veces. Baja 2,8× y no 4,6×, y
// se queda en 20 ms: la optimización trabajó sobre la lectura de cualidades, y en
// ese corpus el que manda es otro renglón —`conSustancia` reconstruye la
// `Physics` ENTERA cada vez que la ley 4 transmuta—, que nadie tocó. O sea que
// «5000 cuerpos en 8,6 ms» es cierto para el corpus del banco y NO es cierto para
// un mundo heterogéneo, donde hoy son ~20.
//
// ─── Este archivo NO corre en `pnpm test` ───────────────────────────────────
//
//   pnpm --filter @anima/world verificacion
//
// Por lo mismo que dice el encabezado de `banco-el-tick.test.ts`: un banco que
// comparte los núcleos con los otros archivos mide la contención tanto como el
// código.
//
// Y acá no es una precaución teórica. `banco-el-tick.test.ts` afirma
// `expect(mundoSolo).toBeLessThan(2)` en MILISEGUNDOS ABSOLUTOS, adentro de la
// corrida compartida, y su margen es de dos veces: con el árbol como estaba mide
// 0,74–1,10 ms contra un presupuesto de 2. Agregarle a la corrida UN archivo con
// trabajo de verdad lo lleva a 3,3, y agregarle éste lo lleva a 6,8. O sea que el
// banco se cae por que la máquina esté ocupada, no por que el mundo haya
// engordado — y eso es previo a esta verificación y previo a la optimización del
// tick (la afirmación está igual en 11b49ae). Por eso los archivos de
// verificación se corren aparte en vez de aflojarle el umbral a otro.

import { describe, expect, it } from 'vitest'
import { AL_AIRE, buildSeedPhysics, dtDeFrecuencia, HZ_DE_REFERENCIA, paso } from '@anima/physics'
import type { Body, Entorno, FormId, Physics, QualityVector } from '@anima/physics'

import { stepWorld } from '../src/step.js'
import type { CellState, WorldBody, WorldState } from '../src/step.js'
import { keyOfCell } from '../src/cell.js'
import { hashWorldState } from '../src/mundo.js'

const TECHO_MS = 4
const N = 5000

// ─── Azar propio, reproducible ───────────────────────────────────────────────

function azar(semilla: number): () => number {
  let s = semilla >>> 0
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    // Los bits altos. Los bajos de un LCG de módulo 2³² tienen período corto.
    return s >>> 16
  }
}

// ─── El arnés ────────────────────────────────────────────────────────────────

/**
 * El MÍNIMO de `rondas` corridas, en ms. El mínimo y no el promedio: es lo único
 * atribuible al programa y no a quién más está usando la máquina.
 */
function minMs(f: () => void, rondas = 9): number {
  for (let i = 0; i < 3; i++) f()
  let mejor = Number.POSITIVE_INFINITY
  for (let r = 0; r < rondas; r++) {
    const t0 = process.hrtime.bigint()
    f()
    const ms = Number(process.hrtime.bigint() - t0) / 1e6
    if (ms < mejor) mejor = ms
  }
  return mejor
}

/**
 * La MEDIANA de `ticks` pasos de un mundo que avanza de verdad.
 *
 * No se puede tomar el mínimo acá: cada tick mide un estado distinto, así que el
 * mínimo sería el del tick más barato y no el costo del paso. La mediana de una
 * corrida larga es lo honesto — y se compara contra el mínimo del estado fijo
 * justamente para ver si el arnés cambia la respuesta.
 */
function medianaAvanzando(s0: WorldState, ticks: number): number {
  let w = s0
  for (let i = 0; i < 20; i++) w = stepWorld(w, []).state
  const muestras: number[] = []
  for (let i = 0; i < ticks; i++) {
    const t0 = process.hrtime.bigint()
    const r = stepWorld(w, [])
    const ms = Number(process.hrtime.bigint() - t0) / 1e6
    w = r.state
    muestras.push(ms)
  }
  muestras.sort((a, b) => a - b)
  return muestras[muestras.length >> 1] as number
}

const num = (x: number, d = 2): string => x.toFixed(d)

// ─── Los cuerpos, armados acá ────────────────────────────────────────────────

const MATERIAS = [
  'madera',
  'liana',
  'pescado',
  'corteza',
  'hoja',
  'piedra',
  'hueso',
  'junco',
  'carne',
  'hongo',
]
const FORMAS: readonly FormId[] = ['vara', 'hebra', 'filete', 'malla', 'bloque', 'grano']

/** Un cuerpo de una parte, quieto y frío. El camino más barato de `paso()`. */
function simple(i: number): Body {
  return {
    id: `s${String(i).padStart(6, '0')}`,
    form: 'vara',
    parts: [{ substance: MATERIAS[i % 8] as string, mass: 1 + (i % 5) * 0.2, q: {} }],
    joints: [],
    state: {},
  }
}

/**
 * Un cuerpo cualquiera: entre una y tres partes, con juntas, con temperaturas a
 * lo ancho del rango útil —frío, ventana de cocción, pirólisis, ignición— y a
 * veces con la masa escrita a nivel cuerpo, que es el camino de `normalizarMasa`.
 */
function variado(i: number, r: () => number): Body {
  const nPartes = 1 + (r() % 3)
  const parts = []
  for (let k = 0; k < nPartes; k++) {
    const q: QualityVector = {}
    if (r() % 4 === 0) q.moisture = (r() % 100) / 100
    if (r() % 6 === 0) q.mass = 0.05 + (r() % 300) / 100
    parts.push({
      substance: MATERIAS[r() % MATERIAS.length] as string,
      mass: 0.1 + (r() % 400) / 100,
      q,
    })
  }
  const joints = []
  for (let k = 1; k < parts.length; k++) {
    joints.push({
      a: 0,
      b: k,
      via: MATERIAS[r() % MATERIAS.length] as string,
      strength: (r() % 100) / 100,
    })
  }
  const state: QualityVector = {}
  state.temperature = -20 + (r() % 900)
  if (r() % 3 === 0) state.moisture = (r() % 100) / 100
  if (r() % 4 === 0) state.charred = (r() % 100) / 100
  if (r() % 5 === 0) state.decay = (r() % 100) / 100
  if (r() % 8 === 0) state.mass = 0.1 + (r() % 400) / 100
  return {
    id: `v${String(i).padStart(6, '0')}`,
    form: FORMAS[r() % FORMAS.length] as FormId,
    parts,
    joints,
    state,
  }
}

/**
 * Un mundo de `n` cuerpos, uno por celda: dos cuerpos en la misma celda es un
 * estado que los invariantes no dejan existir y medirlo no valdría nada.
 *
 * El `WorldState` se arma a mano y no con el ayudante de los tests: es el punto
 * de este archivo.
 */
function mundoDe(cuerpos: readonly Body[], phys?: Physics): WorldState {
  const bodies = new Map<string, WorldBody>()
  for (let i = 0; i < cuerpos.length; i++) {
    const b = cuerpos[i] as Body
    bodies.set(b.id, { body: b, at: { x: i % 1000, y: (i / 1000) | 0 } })
  }
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: phys ?? buildSeedPhysics(),
    bodies,
    actors: new Map(),
    cells: new Map<number, CellState>(),
    desplegados: new Map(),
    nextId: 1,
  }
}

function mundoSimple(n: number): WorldState {
  const cuerpos: Body[] = []
  for (let i = 0; i < n; i++) cuerpos.push(simple(i))
  return mundoDe(cuerpos)
}

function mundoVariado(n: number, semilla: number): WorldState {
  const r = azar(semilla)
  const cuerpos: Body[] = []
  for (let i = 0; i < n; i++) cuerpos.push(variado(i, r))
  return mundoDe(cuerpos)
}

/** `paso()` sobre todos los cuerpos del estado, sin nada del mundo alrededor. */
function soloLeyes(s: WorldState, e: Entorno = AL_AIRE): void {
  const dt = dtDeFrecuencia(s.hz)
  for (const c of s.bodies.values()) paso(c.body, e, s.phys, dt)
}

// ─── La medición ─────────────────────────────────────────────────────────────

/**
 * DEVOLVERLE EL HILO AL CORREDOR DE TESTS UN INSTANTE.
 *
 * No mide nada, no cambia ningún número y va ENTRE las mediciones, nunca adentro
 * de una. Existe por una falla de arnés que se paga cara y no se ve: este `it`
 * hace un minuto entero de trabajo SÍNCRONO, y mientras tanto el worker de vitest
 * no puede contestarle a su proceso principal. Cuando la máquina está cargada y el
 * bloque cruza los 60 s, el reloj de la RPC vence y toda la corrida del paquete
 * termina en `Unhandled Error: [vitest-worker]: Timeout calling "onTaskUpdate"` —
 * con los 489 tests EN VERDE y el proceso saliendo en 1.
 *
 * Medido en esta máquina: 43 s con el equipo libre (verde) y 61,7 s con el
 * navegador del usuario encima (rojo, y reproducible tres veces). O sea que el
 * color del paquete dependía de lo ocupada que estuviera la máquina, que es
 * exactamente la clase de rojo que enseña a ignorar el rojo.
 *
 * Se corta el bloque en pedazos y se respira entre ellos. Las mediciones son las
 * MISMAS —cada `minMs` sigue siendo un mínimo sobre las mismas repeticiones— y no
 * se afloja ningún número: lo único que cambia es que el hilo vuelve a estar
 * disponible unas pocas veces por minuto.
 */
const respirar = (): Promise<void> => new Promise<void>((r) => { setImmediate(r) })

/**
 * ─── POR QUÉ LA MEDICIÓN PESADA VA DETRÁS DE `ANIMA_BANCO=1` ────────────────
 *
 * Medido: este archivo tardaba **85 segundos**, más que todo el resto de
 * `@anima/world` junto, y corría en cada `pnpm --filter @anima/world test` que
 * hiciera cualquier agente por cualquier motivo. Es el archivo más caro de los
 * nueve paquetes después del juez.
 *
 * No pierde nada: los dos tests que verifican la CONDUCTA —que el mundo avanza
 * de verdad y que las celdas están donde la clave canónica dice— siguen
 * corriendo siempre, porque son baratos y son los que atrapan una regresión. Lo
 * único que se saltea es la re-medición de 5000 cuerpos, que es un NÚMERO y que
 * sólo tiene sentido leer cuando se lo mide en serio: adentro de una suite que
 * corre nueve paquetes en paralelo, ese número mide la contención de la máquina
 * y no el tick.
 *
 * Es el mismo patrón que `banco-el-tick.test.ts:165` ya tenía decidido, aplicado
 * al archivo que se había quedado afuera.
 */
const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

describe('re-medición independiente del criterio (c)', () => {
  it.skipIf(!MIDIENDO_EN_SERIO)('el tick con 5000 cuerpos, medido de las dos maneras', async () => {
    const s = mundoSimple(N)

    const fijo = minMs(() => {
      stepWorld(s, [])
    })
    await respirar()
    const avanzando = medianaAvanzando(s, 120)
    await respirar()
    const leyes = minMs(() => {
      soloLeyes(s)
    })
    await respirar()

    const variado5000 = mundoVariado(N, 20260727)
    const fijoVariado = minMs(() => {
      stepWorld(variado5000, [])
    })
    await respirar()
    const avanzandoVariado = medianaAvanzando(variado5000, 120)
    await respirar()

    // Cuántos cuerpos entran en 4 ms, medido y no extrapolado: se mide a varias
    // escalas y se interpola entre las dos que rodean al techo.
    const escalas = [500, 1000, 2000, 3000, 4000, 5000]
    const puntos: { n: number; ms: number }[] = []
    for (const n of escalas) {
      const w = mundoSimple(n)
      puntos.push({ n, ms: minMs(() => { stepWorld(w, []) }, 7) })
      await respirar()
    }
    // Se interpola entre los dos puntos MEDIDOS que rodean al techo. Extrapolar
    // linealmente desde 5000 —`5000 × 4 / ms`— da de más, porque el tick no es del
    // todo lineal en la cantidad de cuerpos: con 8,6 ms a los 5000 la
    // extrapolación dice ~2330 y la medición dice ~2090.
    let entran = 0
    for (let i = 0; i < puntos.length; i++) {
      const p = puntos[i]!
      if (p.ms <= TECHO_MS) {
        entran = p.n
        continue
      }
      // El punto anterior, o el origen si ni el más chico entra en el techo.
      const q = puntos[i - 1] ?? { n: 0, ms: 0 }
      if (p.ms > q.ms) {
        entran = Math.round(q.n + ((TECHO_MS - q.ms) * (p.n - q.n)) / (p.ms - q.ms))
      }
      break
    }
    if (entran < 0) entran = 0

    /* eslint-disable no-console */
    console.log(
      [
        '',
        '══ RE-MEDICIÓN INDEPENDIENTE ═══════════════  techo del criterio: 4 ms',
        '',
        `── corpus SIMPLE (5000 varas de una parte, como el banco) ──`,
        `  stepWorld, estado FIJO (lo que el banco mide) ... ${num(fijo)} ms`,
        `  stepWorld, mundo que AVANZA (mediana de 120) .... ${num(avanzando)} ms`,
        `  paso() de @anima/physics, solo ................. ${num(leyes)} ms   ${num((100 * leyes) / fijo, 1)}% del tick`,
        `  lo que agrega @anima/world ..................... ${num(fijo - leyes)} ms`,
        '',
        `── corpus VARIADO (1-3 partes, todo el rango térmico) ──`,
        `  stepWorld, estado FIJO .......................... ${num(fijoVariado)} ms`,
        `  stepWorld, mundo que AVANZA ..................... ${num(avanzandoVariado)} ms`,
        '',
        '── escala ──',
        ...puntos.map((p) => `  ${String(p.n).padStart(5)} cuerpos ..... ${num(p.ms)} ms`),
        `  cuerpos que entran hoy en 4 ms ................. ~${entran}`,
        '',
      ].join('\n'),
    )
    /* eslint-enable no-console */

    // Lo único que se afirma acá es que la medición se hizo. El veredicto va en
    // el informe: este test no puede fallar por un número de máquina.
    expect(fijo).toBeGreaterThan(0)
    expect(leyes).toBeGreaterThan(0)
    expect(entran).toBeGreaterThan(0)
  }, 300_000)

  it('el mundo avanza de verdad: el hash cambia tick a tick', () => {
    // Un banco que mide un mundo que no se mueve mide otra cosa. Esto verifica
    // que los 5000 cuerpos del corpus SÍ hacen trabajo: si el hash no se moviera,
    // `paso()` estaría entrando y saliendo por el camino de «acá no pasa nada».
    let w = mundoSimple(200)
    const h0 = hashWorldState(w)
    for (let i = 0; i < 5; i++) w = stepWorld(w, []).state
    expect(hashWorldState(w)).not.toBe(h0)
  })

  it('las celdas del mundo son las que la clave canónica indexa', () => {
    // Control de que el mundo que armé a mano es el mismo que el de los tests:
    // si la clave de celda fuera otra, estaría midiendo un estado degenerado.
    const w = mundoSimple(4)
    expect(w.bodies.size).toBe(4)
    expect(keyOfCell({ x: 0, y: 0 })).toBe(keyOfCell({ x: 0, y: 0 }))
    const r = stepWorld(w, [])
    expect(r.state.tick).toBe(1)
  })
})
