// ─── EL BANCO DEL TICK — criterio (c) del Hito 2, medido ─────────────────────
//
//   «5000 cuerpos a menos de 4 ms por tick»
//
//   pnpm --filter @anima/world banco
//
// Es el ÚNICO archivo del paquete que toca el reloj, y está separado de los
// tests de corrección por dos razones:
//
//   1. `process.hrtime` es un reloj, y la regla 2 de `ii/README.md` prohíbe el
//      reloj en el código del mundo. Que viva en un archivo aparte, con su
//      nombre, es lo que hace que la prohibición sea revisable de un vistazo;
//   2. un banco mezclado con los demás archivos de test comparte los núcleos con
//      ellos y mide la contención tanto como el código. Acá se toma el MÍNIMO de
//      varias rondas y no el promedio: el mínimo es lo único atribuible al
//      programa —cuánto tarda cuando nadie le saca la máquina—. Con el promedio,
//      la misma línea daba 0,35 ms sola y 2,2 ms acompañada.
//
// Los números que imprime son los que van al informe del hito. No se copian a
// mano a ningún comentario: se vuelven a correr.

import { describe, expect, it } from 'vitest'
import { AL_AIRE, paso, qualityOf } from '@anima/physics'
import type { QualityId } from '@anima/physics'

import {
  bodiesAt,
  createGrid,
  createSnapshotChain,
  hashWorldState,
  placeBody,
  stepWorld,
  worldSlots,
} from '../src/index.js'
import type { WorldBody, WorldState } from '../src/index.js'
import { cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const MATERIA = ['madera', 'liana', 'pescado', 'corteza', 'hoja', 'piedra', 'hueso', 'junco']

/**
 * Un mundo de `n` cuerpos, uno por celda. LEGAL a propósito: si dos cuerpos
 * compartieran celda estaríamos midiendo un estado que los invariantes no dejan
 * existir, y el número no valdría para nada.
 */
function mundoGrande(n: number): WorldState {
  const bodies: WorldBody[] = []
  for (let i = 0; i < n; i++) {
    bodies.push(
      enElPiso(cuerpo(`b${String(i).padStart(6, '0')}`, MATERIA[i % MATERIA.length] as string, 1 + (i % 5) * 0.2), {
        x: i % 1000,
        y: (i / 1000) | 0,
      }),
    )
  }
  return mundo({ bodies })
}

/** El MÍNIMO de varias rondas, en milisegundos. Ver el encabezado. */
function minMs(f: () => void, rondas = 7): number {
  for (let i = 0; i < 2; i++) f()
  let mejor = Number.POSITIVE_INFINITY
  for (let r = 0; r < rondas; r++) {
    const t0 = process.hrtime.bigint()
    f()
    const ms = Number(process.hrtime.bigint() - t0) / 1e6
    if (ms < mejor) mejor = ms
  }
  return mejor
}

const num = (x: number, d = 2): string => x.toFixed(d)

function msPorTick(s: WorldState): number {
  let w = s
  return minMs(() => {
    w = stepWorld(w, []).state
  })
}

/** El mismo trabajo llamando a `paso()` directo, sin nada del mundo alrededor. */
function msSoloLeyes(s: WorldState): number {
  const cuerpos = [...s.bodies.values()].map((c) => c.body)
  return minMs(() => {
    for (const b of cuerpos) paso(b, AL_AIRE, s.phys)
  })
}

/**
 * UNA lectura completa de cuerpo, la que `leer()` de `leyes.ts` arma para pasarle
 * a las leyes. Son las doce cualidades que ese archivo lee, copiadas acá porque
 * `leer` no se exporta.
 *
 * Este número es el que convierte el diagnóstico en una conclusión: `paso()`
 * llama a `leer()` CINCO veces por cuerpo (líneas 793, 796, 807, 814 y 821 de
 * `leyes.ts`), así que si una sola lectura sobre los 5000 ya cuesta más que el
 * techo del criterio, el techo es inalcanzable aunque el bucle del mundo fuera
 * gratis. Y dice dónde está la reparación: pasar UNA lectura a través de las doce
 * leyes en vez de recalcularla cinco veces.
 */
const LECTURA: readonly QualityId[] = [
  'temperature',
  'moisture',
  'charred',
  'digestibility',
  'toxicity',
  'decay',
  'nutrition',
  'fuelEnergy',
  'ignitionPoint',
  'pyrolysisAt',
  'toughness',
  'mass',
]

function msUnaLectura(s: WorldState): number {
  const cuerpos = [...s.bodies.values()].map((c) => c.body)
  return minMs(() => {
    for (const b of cuerpos) for (const q of LECTURA) qualityOf(b, q, s.phys)
  })
}

describe('(c) 5000 cuerpos a menos de 4 ms por tick', () => {
  const N = 5000
  const TECHO = 4

  /**
   * NO SE CUMPLE, y la causa NO está en este paquete. Marcado con `it.fails` —el
   * mismo idioma con el que la física dejó los diez huecos abiertos de `admit()`—
   * y no con el umbral relajado a 50 ms: un criterio que se mueve para dar verde
   * no es un criterio, es una decoración. El día que `paso()` baje, esto se cae
   * solo por «test esperado fallido que pasó» y hay que borrar el `.fails`.
   *
   * El desglose lo imprime el test de abajo. En una palabra: el 99% del tick es
   * `paso()` de `@anima/physics`, que llama a `leer()` cinco veces por cuerpo y
   * cada `leer()` son doce `qualityOf`. El techo de 4 ms es inalcanzable aunque el
   * bucle del mundo fuera gratis, porque UN SOLO `leer()` completo sobre los 5000
   * ya cuesta más que el tick entero permitido.
   */
  it.fails('el criterio del documento, tal cual está escrito', () => {
    expect(msPorTick(mundoGrande(N))).toBeLessThan(TECHO)
  }, 300_000)

  it('el desglose, con los números de esta máquina', () => {
    const s = mundoGrande(N)
    const tick = msPorTick(s)
    const leyes = msSoloLeyes(s)
    // La diferencia sale del orden del ruido y a veces NEGATIVA —las dos
    // mediciones son mínimos de series distintas—, y decir «−0,4 ms» sería
    // presentar ruido como resultado. Lo que el número dice de verdad es que el
    // costo propio del mundo está por debajo de la resolución de este banco, o
    // sea por debajo de medio milisegundo sobre un tick de treinta y siete.
    const lectura = msUnaLectura(s)
    const bruto = tick - leyes
    const mundoSolo = bruto > 0 ? bruto : 0
    const cota = bruto > 0.5 ? `${num(bruto)} ms` : 'por debajo del ruido (< 0.5 ms)'

    const hash = minMs(() => {
      hashWorldState(s)
    })
    const cadena = createSnapshotChain<unknown>()
    cadena.take(0, worldSlots(s))
    const guardar = minMs(() => {
      cadena.take(1, worldSlots(s))
    }, 3)

    const g = createGrid()
    const celdas = [...s.bodies.values()].map((c) => c.at)
    let vuelta = 0
    const indexar = minMs(() => {
      vuelta++
      for (let i = 0; i < N; i++) {
        const c = celdas[(i + vuelta) % N] as { x: number; y: number }
        placeBody(g, `b${String(i).padStart(6, '0')}`, c)
      }
    })
    const consultar = minMs(() => {
      for (let i = 0; i < N; i++) bodiesAt(g, celdas[i] as { x: number; y: number })
    })

    // Cuántos cuerpos entran HOY en el presupuesto. Es el número accionable: dice
    // en qué escala el mundo ya corre a 30 Hz mientras la física no baje.
    const chico = mundoGrande(500)
    const tick500 = msPorTick(chico)
    const entran = Math.round((TECHO / tick) * N)

    console.log(
      [
        '',
        `── EL TICK, con ${N} cuerpos ─────────────────────────  techo del criterio: ${TECHO} ms`,
        `  stepWorld, tick completo .............. ${num(tick)} ms   ${tick < TECHO ? 'PASA' : `NO PASA (${num(tick / TECHO, 1)}× el techo)`}`,
        `  paso() de @anima/physics, solo ........ ${num(leyes)} ms   ${num(Math.min(leyes / tick, 1) * 100, 1)}% del tick`,
        `  lo que agrega @anima/world ............ ${cota}`,
        '',
        '── DE DÓNDE SALE, adentro de paso() ───────────────────────────────',
        `  UNA lectura de cuerpo (12 qualityOf) .. ${num(lectura)} ms   ${lectura > TECHO ? `ya son ${num(lectura / TECHO, 1)}× el techo, SOLA` : 'entra en el techo'}`,
        `  paso() la hace CINCO veces por cuerpo → ~${num(lectura * 5)} ms de las ${num(leyes)} de las leyes`,
        '',
        '── FUERA DEL TICK (checkpoints y guardado, en el worker de fondo) ──',
        `  hashWorldState sobre ${N} cuerpos ..... ${num(hash)} ms`,
        `  snapshot.take sobre las ranuras ....... ${num(guardar)} ms`,
        '',
        '── EL ÍNDICE ESPACIAL DE grid.ts ──────────────────────────────────',
        `  ${N} mudanzas (el peor caso: se mueven todos) ... ${num(indexar)} ms  (${num((indexar * 1e6) / N, 0)} ns c/u)`,
        `  ${N} consultas bodiesAt ......................... ${num(consultar)} ms  (${num((consultar * 1e6) / N, 0)} ns c/u)`,
        '',
        '── LA ESCALA A LA QUE EL MUNDO YA CORRE ───────────────────────────',
        `  500 cuerpos ........................... ${num(tick500)} ms   ${tick500 < TECHO ? 'PASA' : 'NO PASA'}`,
        `  cuerpos que entran hoy en ${TECHO} ms ....... ~${entran}`,
        '',
      ].join('\n'),
    )

    // Lo único que este paquete controla, y lo controla: el mundo no le agrega
    // costo propio a la física. El presupuesto propio son 2 ms, la MITAD del
    // techo entero del criterio.
    expect(mundoSolo).toBeLessThan(2)
    // Y la física se lleva casi todo el tick. La cota es 0.8 y no 0.95 porque el
    // banco corre al lado de los otros archivos y el ruido es real; lo medido en
    // una máquina tranquila da ~1.0. Si esto bajara de 0.8, la conclusión de
    // arriba caducó y hay que volver a medir de dónde sale el costo.
    expect(leyes / tick).toBeGreaterThan(0.8)
    // LA CONCLUSIÓN, clavada como test y no como comentario: una sola lectura de
    // cuerpo ya se pasa del techo del criterio. Mientras esto valga, los 4 ms son
    // inalcanzables aunque `@anima/world` costara cero, y el trabajo está adentro
    // de `@anima/physics`. El día que deje de valer, este test se cae y hay que
    // volver a medir el tick entero: puede que el criterio ya se cumpla.
    expect(lectura).toBeGreaterThan(TECHO)
    // El índice es O(1) por consulta y no O(mundo). La cota es holgada a
    // propósito: es un detector de O(mundo), no una medición.
    expect(consultar).toBeLessThan(50)
    expect(indexar).toBeLessThan(200)
  }, 300_000)

  it('y el mundo grande es legal, así que el número mide un estado que existe', () => {
    const s = mundoGrande(N)
    const r = stepWorld(s, [])
    expect(r.state.bodies.size).toBe(N)
  }, 120_000)
})
