// ─── EL BANCO DE LAS REFERENCIAS — cuánto cuesta no tener `porId` ────────────
//
//   pnpm --filter @anima/plan test  (corre con los demás; es chico)
//
// POR QUÉ EXISTE ESTE ARCHIVO Y NO ES UN COMENTARIO EN `referencias.ts`: el
// encabezado de ese módulo afirma que resolver `{k:'id'}` es O(cuerpos a la
// vista) porque `VistaDelPlan` no tiene índice por id. Afirmarlo es gratis; el
// número no. Y el número decide algo: si una resolución costara microsegundos, la
// regresión —que resuelve varias por expansión y expande hasta 64 por tick— se
// comería sola el presupuesto de 8 ms que el documento de arquitectura le dio a D4.
//
// Está separado de `las-referencias.test.ts` por la misma razón que
// `world/tests/banco-el-tick.test.ts` está separado de los suyos: es el único
// archivo del paquete que toca el reloj, y que eso se vea en el nombre es lo que
// hace revisable la regla 2 de un vistazo. La regla prohíbe el reloj en `src/`, y
// acá no hay nada de `src/`.
//
// SE TOMA EL MÍNIMO DE VARIAS RONDAS, no el promedio: el mínimo es lo único
// atribuible al programa —cuánto tarda cuando nadie le saca la máquina—. Con el
// promedio, la misma línea mide la pausa del recolector del test anterior.
//
// QUÉ SE MIDE Y QUÉ NO, dicho antes de que alguien cite el número de más:
//
//   · se mide la resolución contra una `VistaDelPlan` DE MENTIRA. El barrido
//     lineal es el mismo que en producción, pero el `see()` de verdad hace más
//     trabajo (arma la lista desde el índice del tick, ver `perceive/vista.ts`).
//     Así que esto es una COTA INFERIOR del costo real, no el costo real;
//   · por eso se miden las dos mitades por separado: con la lista ya armada
//     —el barrido y nada más, que es lo único que este módulo escribió— y con la
//     lista armándose en cada llamada, que se le parece más a lo que pasa.
//
// LOS TAMAÑOS NO SON INVENTADOS, Y NO SON UNA CUENTA MÍA. `RADIO_DE_PERCEPCION`
// es 12, o sea 25×25 = 625 celdas; y el banco de la percepción, corrido —no
// leído—, imprime «71 de 5000 en un mundo de 200×200» para una criatura parada en
// el origen (`perceive/tests/banco-la-vista.test.ts`). De ahí salen los dos
// tamaños: 80 es la vista típica redondeada para arriba, y 625 es el peor caso
// honesto —un cuerpo por celda percibida, o sea el mundo lleno—.

import { describe, expect, it } from 'vitest'
import type { BodyView, Clock, SelfView } from '@anima/skills'
import { porCercania } from '@anima/skills/innatas'

import { resolverCuerpo } from '../src/referencias.js'
import type { Ref, VistaDelPlan } from '../src/tipos.js'

const TIPICA = 80
const PEOR = 625
const RESOLUCIONES = 10_000

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

function poblacion(n: number): BodyView[] {
  const out: BodyView[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      id: `b${String(i).padStart(4, '0')}`,
      at: { x: i % 25, y: (i / 25) | 0 },
      name: 'cosa',
      madeByMe: false,
      joints: [],
    })
  }
  return out
}

function criatura(holding: readonly BodyView[] = []): SelfView {
  return {
    id: 'yo',
    at: { x: 12, y: 12 },
    name: 'criatura',
    madeByMe: false,
    joints: [],
    holding,
    capacity: 2,
    stamina: 10,
    permits: 'reversible',
  }
}

/**
 * `armando: false` devuelve SIEMPRE la misma lista: aísla el barrido de este
 * módulo. `armando: true` copia la lista en cada llamada, que es la parte que en
 * producción hace `aLaVista` y que acá sería deshonesto descontar del todo.
 */
function vista(cuerpos: readonly BodyView[], o?: { armando?: boolean; holding?: readonly BodyView[] }): VistaDelPlan {
  const self = criatura(o?.holding ?? [])
  return {
    see: o?.armando === true ? (): readonly BodyView[] => [...cuerpos] : (): readonly BodyView[] => cuerpos,
    recall: () => [],
    q: () => 0,
    qAt: () => 0,
    self,
    clock: RELOJ,
  }
}

/** El MÍNIMO de varias rondas, en milisegundos. `hrtime` y no `Date`: ver arriba. */
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

/** Nanosegundos por resolución, que es la unidad en la que esto se puede pensar. */
function nsPorResolucion(v: VistaDelPlan, r: Ref): number {
  let vivo = 0
  const ms = minMs(() => {
    for (let i = 0; i < RESOLUCIONES; i++) {
      // Se acumula algo del resultado para que nada de esto se pueda plegar: un
      // banco cuyo resultado no se usa mide la eliminación de código muerto.
      if (resolverCuerpo(r, v) !== undefined) vivo++
    }
  })
  expect(vivo).toBeGreaterThanOrEqual(0)
  return (ms * 1e6) / RESOLUCIONES
}

const num = (x: number, d = 0): string => x.toFixed(d)

describe('el banco de las referencias', () => {
  it('las cinco formas, en nanosegundos por resolución', () => {
    const tipica = poblacion(TIPICA)
    const peor = poblacion(PEOR)
    const enMano = tipica[3] as BodyView
    const conMano = vista(tipica, { holding: [enMano] })

    const filas: readonly (readonly [string, number])[] = [
      ['yo', nsPorResolucion(conMano, { k: 'yo' })],
      ['celda (por `resolver`, que devuelve la Cell)', nsPorResolucion(conMano, { k: 'celda', at: { x: 0, y: 0 } })],
      ['id — en la mano', nsPorResolucion(conMano, { k: 'id', id: enMano.id })],
      [`id — en el piso, ${String(TIPICA)} a la vista`, nsPorResolucion(vista(tipica), { k: 'id', id: 'b0079' })],
      [`id — en el piso, ${String(PEOR)} a la vista`, nsPorResolucion(vista(peor), { k: 'id', id: 'b0624' })],
      // `b9999` y no `nada`: el id ausente tiene que tener la MISMA FORMA que los
      // presentes o la comparación de strings se va por el atajo del largo y el
      // banco mide 2× de menos. Se midió con `nada` primero y dio la mitad.
      [`id — el que NO está, ${String(PEOR)} a la vista`, nsPorResolucion(vista(peor), { k: 'id', id: 'b9999' })],
      [`donde — ${String(TIPICA)} a la vista`, nsPorResolucion(vista(tipica), { k: 'donde', where: [] })],
      [`donde — ${String(PEOR)} a la vista`, nsPorResolucion(vista(peor), { k: 'donde', where: [] })],
      // La misma lista, entrando del más cerca al más lejos: el que gana se fija
      // en el primer elemento y ningún otro vuelve a empatarle. Separa las dos
      // mitades del costo de `donde` — las 625 llamadas a `distancia`, que se
      // pagan siempre, del desempate por `id`, que sólo se paga en los empates.
      [`donde — ${String(PEOR)} ya ordenada, sin empates contra el mejor`, nsPorResolucion(vista(porCercania(peor, { x: 12, y: 12 })), { k: 'donde', where: [] })],
      [`id con la lista armándose, ${String(TIPICA)} a la vista`, nsPorResolucion(vista(tipica, { armando: true }), { k: 'id', id: 'b0079' })],
      [`id con la lista armándose, ${String(PEOR)} a la vista`, nsPorResolucion(vista(peor, { armando: true }), { k: 'id', id: 'b0624' })],
    ]

    console.log(
      `\n─── resolver un \`Ref\`, mínimo de 7 rondas de ${String(RESOLUCIONES)} ───\n` +
        filas.map(([q, ns]) => `  ${q.padEnd(46)} ${num(ns).padStart(6)} ns`).join('\n') +
        '\n',
    )

    // EL TECHO SALE DEL PRESUPUESTO Y NO DE LO QUE DIO. `EXPANSIONES_POR_TICK` es
    // 64 y el documento le dio 8 ms a D4: 125 µs por expansión. La expansión más
    // cara resuelve los tres roles de `friccion`, así que si resolver fuera TODO
    // lo que una expansión hace, el techo por resolución sería 125/3 ≈ 41 µs.
    // Ése es el techo, y es una cota generosa a propósito —resolver no es todo lo
    // que hace una expansión— porque lo que este `expect` tiene que atajar es un
    // cambio que multiplique el costo por diez, no una máquina más lenta que la
    // que corrió el banco.
    //
    // Lo medido queda lejos salvo en un caso, y ese caso hay que decirlo en vez
    // de esconderlo detrás del verde: `donde` sobre la vista SATURADA da ~14 µs,
    // o sea que tres `donde` en una expansión se comen un tercio de su cuota. Con
    // 80 cuerpos —la vista típica— es ~2 µs y no hay problema; el problema
    // aparece si la regresión resuelve `donde` adentro del bucle de expansión en
    // vez de una vez por paso emitido.
    for (const [que, ns] of filas) expect(ns, `la forma «${que}»`).toBeLessThan(41_000)
    // El techo va DECLARADO y no en el 5 s por omisión de vitest: este `it` corre
    // decenas de miles de resoluciones sobre 625 cuerpos, y con la máquina cargada
    // —dos suites en paralelo— cruza los 5 s y muere por corte, que es un rojo que
    // no dice nada de lo que el banco vino a medir. Es la misma decisión que
    // `banco-el-plan.test.ts` toma para (3), (4) y (5).
  }, 60_000)

  it('y el costo de `id` crece con los cuerpos a la vista, que es lo que se afirmó', () => {
    // La forma de la curva y no su altura: la altura depende de la máquina, pero
    // que 625 cueste varias veces más que 80 es la propiedad estructural que el
    // encabezado de `referencias.ts` afirma, y es la que hay que ver caer el día
    // que alguien agregue un índice por id a `VistaDelPlan`.
    const chica = nsPorResolucion(vista(poblacion(TIPICA)), { k: 'id', id: 'b9999' })
    const grande = nsPorResolucion(vista(poblacion(PEOR)), { k: 'id', id: 'b9999' })
    console.log(
      `\n─── el barrido es lineal ───\n  ${String(TIPICA)} cuerpos: ${num(chica)} ns` +
        `\n  ${String(PEOR)} cuerpos: ${num(grande)} ns` +
        `\n  razón: ${num(grande / Math.max(chica, 0.001), 2)}× para ${num(PEOR / TIPICA, 2)}× de cuerpos\n`,
    )
    expect(grande).toBeGreaterThan(chica * 2)
    // Lo que se afirma es una RAZÓN entre dos mediciones, que es lo único de un
    // banco que no depende de cuán ocupada esté la máquina. El techo declarado, por
    // lo mismo que el del `it` de arriba.
  }, 60_000)
})
