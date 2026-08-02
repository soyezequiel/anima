// ─── EL BANCO DEL CAMINO DE INTENCIONES ──────────────────────────────────────
//
//   «p99 de tick < 5 ms con 5000 cuerpos» — criterio del Hito 5.
//
//   pnpm --filter @anima/world exec vitest run tests/banco-el-camino-de-intenciones.test.ts
//
// ─── POR QUÉ HACÍA FALTA OTRO BANCO ─────────────────────────────────────────
//
// `banco-el-tick.test.ts` arma su mundo con `mundo({ bodies })` —o sea
// `actors: mapaDeActores([])`, CERO actores— y lo avanza con `stepWorld(s, [])`
// —CERO intenciones—. Sus «8,2 ms con 5000 cuerpos» miden `sistemaLeyes` y nada
// más: el camino de intenciones entero queda FUERA de la medición, y ese camino
// tiene tres funciones O(cuerpos del mundo) que corren UNA VEZ POR ACTOR.
//
// Y mide con el MÍNIMO de siete rondas sobre un estado fijo. El mínimo es la
// estadística correcta para aislar el costo de un programa de la contención de la
// máquina, y es la que MENOS se parece a un p99: el criterio del Hito 5 pregunta
// por la cola, no por el mejor caso. Un mundo que corre a 3 ms de mínimo y a 40 de
// p99 pierde ticks, y el mínimo no lo dice.
//
// Así que acá se mide otra cosa y se mide distinto:
//
//   - un mundo que AVANZA, con N criaturas que caminan de verdad, cada una
//     emitiendo su intención en cada tick;
//   - p50, p95, p99 y el PEOR sobre 120 ticks medidos, no el mínimo de 7.
//
// ─── EL MUNDO DE LA MEDICIÓN ────────────────────────────────────────────────
//
// SIEMPRE 5000 cuerpos, y de esos N son criaturas. No 5000 + N: el criterio habla
// de 5000 cuerpos, y si la población total creciera con el barrido, la curva
// mezclaría el costo de `sistemaLeyes` —que es por cuerpo— con el del camino de
// intenciones —que es por actor—, que es justo lo que este banco viene a separar.
//
// Cada criatura camina hacia el norte por su propia columna, con tres celdas de
// separación, y los cuerpos inertes viven en `y ≤ −2`. O sea: NADIE CHOCA. Es a
// propósito y es el caso normal, no el fácil: `estorbo` recorre el mundo entero
// justamente cuando NO encuentra nada, y encontrar algo lo hace terminar antes.
//
// ─── LA TABLA DEL ANTES ─────────────────────────────────────────────────────
//
// Medido antes de tocar una línea de `step.ts`. 5000 cuerpos siempre; `actores` de
// ellos caminando, uno `goTo` por criatura y por tick, 120 ticks por fila.
//
//   actores      p50         p95         p99        peor      p99/5 ms
//        0      9.20 ms    11.33 ms    14.60 ms    14.61 ms     2.9×
//        1     10.35 ms    11.83 ms    13.31 ms    19.26 ms     2.7×
//       10     11.92 ms    13.42 ms    13.53 ms    13.63 ms     2.7×
//      100     26.41 ms    30.03 ms    32.68 ms    33.13 ms     6.5×
//     1000    142.02 ms   176.60 ms   177.85 ms   179.86 ms    35.6×
//     5000    620.21 ms   643.84 ms   667.65 ms   673.08 ms   133.5×
//
//   pendiente entre 1000 y 5000 actores: 122,4 µs por actor y por tick
//
// La fila de 0 actores es el banco viejo: 9,2 ms de p50 y NADA del camino de
// intenciones. Las otras cinco son lo que el banco viejo no veía. La pendiente es
// lineal en actores y cada una de esas pasadas es lineal en cuerpos, o sea que el
// camino de intenciones era **O(actores × cuerpos)**.
//
// ─── DE DÓNDE SALÍAN ESOS 122 µs POR ACTOR ──────────────────────────────────
//
// Tres funciones de `step.ts`, las tres O(cuerpos del mundo) y las tres adentro
// del bucle por actor:
//
//   - `estorbo` recorría `d.bodies.values()` entero. Lo llaman `goTo`, `explore`,
//     `put` y `celdaLibreCerca` (hasta NUEVE veces por `drop`);
//   - `olvidar` recorría Y COPIABA (`[...d.bodies.values()]`) el arreglo entero, y
//     se llama en cada mudanza de actor, en cada `take` y en cada `sacarCuerpo`;
//   - `celdaLibreCerca` es `estorbo` una vez por rumbo.
//
// El test `un goTo contra un wait` lo mide sin instrumentar nada: con 1000
// criaturas, `wait` —que recorre el portón entero y no toca el mundo— agregaba
// 0,78 ms sobre el mundo quieto, y `goTo` agregaba 136,31.
//
// ─── LA TABLA DEL DESPUÉS ───────────────────────────────────────────────────
//
// Con el índice de cuerpos por celda y el conjunto de cuerpos con relación, los
// dos adentro del `Borrador` (ver `IndiceDeCeldas` en `src/step.ts`):
//
//   actores      p50         p95         p99        peor      p99/5 ms   p99 antes/después
//        0      8.69 ms    10.02 ms    10.60 ms    13.80 ms     2.1×        1.4×
//        1     10.54 ms    12.45 ms    13.22 ms    13.56 ms     2.6×        1.0×
//       10     10.76 ms    12.43 ms    12.88 ms    20.68 ms     2.6×        1.1×
//      100     10.79 ms    12.47 ms    12.99 ms    13.13 ms     2.6×        2.5×
//     1000     12.24 ms    14.22 ms    15.78 ms    22.38 ms     3.2×       11.3×
//     5000     20.34 ms    24.50 ms    30.94 ms    38.61 ms     6.2×       21.6×
//
//   pendiente entre 1000 y 5000 actores: 3,8 µs por actor y por tick  (32× menos)
//   1000 criaturas: `wait` +2,49 ms sobre el mundo quieto, `goTo` +11,14
//
// El camino de intenciones dejó de crecer con la población: lo que queda es lineal
// en actores y NO en cuerpos. Las tres primeras filas se mueven dentro del ruido de
// la máquina, que es lo esperado — con diez actores no había nada que arreglar.
//
// ─── EL CRITERIO DEL HITO 5 NO SE CUMPLE, Y YA NO ES POR ESTE CAMINO ────────
//
// 30,9 ms de p99 con 5000 cuerpos y 5000 criaturas, contra un techo de 5. Faltan
// 6,2×.
//
// ─── DE DÓNDE SALEN, Y ESTA ATRIBUCIÓN ESTUVO MAL POR 10× ───────────────────
//
// Acá decía que 10,6 ms eran el mundo quieto y **«los otros 20,3 son 5000
// criaturas moviéndose… la copia de `bodies`, `actors` y `cells` que `abrir`
// hace en cada tick, el reordenamiento de `cerrar`, y un objeto nuevo por cada
// cuerpo tocado»**. Es falso, y mandó a optimizar el lugar equivocado.
//
// MEDIDO por ablación, cortando el recorrido de leyes con una variable de
// entorno y volviendo a correr este mismo barrido (p50, esta máquina):
//
//     modo                          0 actores   5000 actores
//     completo                          9,60         21,65
//     sin `paso()`, con `entornoDe`     0,57          2,48
//     sin leyes y sin entorno           0,38          2,23
//
// O sea que **`paso()` es el 94% del tick quieto y el 89% del tick con 5000
// criaturas**, y TODO lo demás junto —las tres copias de `abrir`, el camino de
// intenciones entero, `cerrar`— son 2,2 ms de los 21,6. `entornoDe` son 0,2.
// Optimizar las copias de mapas, que es adonde apuntaba el párrafo viejo, no
// podría bajar el p99 ni un 10%.
//
// → La conclusión de fondo NO cambia y se refuerza: lo que falta es el cambio de
//   REPRESENTACIÓN de `@anima/physics` —las cualidades resueltas en un vector
//   numérico, recalculado sólo cuando cambian las partes—, que es lo que
//   `banco-el-tick.test.ts` viene diciendo desde el Hito 2. Lo que cambia es a
//   dónde NO hay que ir.
//
// ─── Y UNA PREGUNTA QUE PARECÍA LA SALIDA Y NO LO ERA ───────────────────────
//
// Si casi todo el tick es `paso()`, el atajo obvio es saltear los cuerpos que no
// cambian. Medido: **cambian 5000 de 5000, los 120 ticks**. No es un defecto —
// en esta escena los cuerpos arrancan a 0 °C en celdas a 15 y están relajando,
// y la relajación es asintótica—. Una piedra tarda 59 ticks en quedarse quieta
// de verdad (`physics/tests/el-cuerpo-quieto-sigue-siendo-el-mismo.test.ts`), o
// sea que **este banco mide el transitorio y no el régimen**. Persiguiendo ese
// 5000 de 5000 apareció otra cosa, ésa sí real: `conCualidad` devolvía un cuerpo
// NUEVO aunque escribiera el valor que ya estaba, y con eso un mundo en
// equilibrio se recreaba entero cada tick y todos los atajos por identidad del
// motor quedaban en cero. Está reparado y afirmado en aquel archivo; en ESTA
// escena no mueve el p99, porque acá no hay nada quieto.
//
// **NO SE ABLANDA EL CRITERIO NI SE MIDEN MENOS CRIATURAS.** El número está medido
// con la estadística que el criterio pide y con la población que el criterio pide,
// y dice que no da. Está clavado en el `it.fails` de más abajo, con su porqué y con
// qué haría falta para cerrarlo. Qué se hace con eso lo decide el usuario.
//
// ─── CUÁNTO SE MUEVEN ESTOS NÚMEROS ─────────────────────────────────────────
//
// Las dos tablas son de UNA corrida cada una, en esta máquina, con el banco solo.
// Corridas repetidas dan entre 24 y 31 ms de p99 en la fila de 5000, y entre 9 y
// 11 en la de 0 — la fila de 5000 es la que más se mueve porque es la que más
// basura genera. Lo que NO se mueve entre corridas es la conclusión, que es lo que
// este banco vino a producir: la pendiente por actor bajó dos órdenes de magnitud y
// el p99 sigue arriba del techo por un factor de cinco o seis. Los números que
// gobiernan son los que imprime la corrida de hoy, no los de este comentario.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, HZ_DE_REFERENCIA } from '@anima/physics'
import type { Body, QualityVector } from '@anima/physics'

import { mapaDeActores, mapaDeCuerpos, stepWorld } from '../src/step.js'
import type { Actor, CellState, WorldBody, WorldState } from '../src/step.js'
import type { Intent } from '../src/intent.js'
import { keyOfCell } from '../src/cell.js'
import { bodiesAt, createGrid, placeBody } from '../src/grid.js'
import { CONTRA_EL_RELOJ } from './reloj-de-pared.js'

// ─── El criterio ─────────────────────────────────────────────────────────────

/** «p99 de tick < 5 ms con 5000 cuerpos». El techo del Hito 5, en milisegundos. */
const TECHO_P99_MS = 5

/**
 * EL TECHO ACEPTADO, y no es lo mismo que el del criterio.
 *
 * Se midió que el criterio del Hito 5 no se cumple —el p99 con 5000 cuerpos y
 * 5000 criaturas da entre 24 y 38 ms según la corrida, o sea 5 a 7 veces el
 * techo— y **el usuario lo aceptó explícitamente**, con la tabla del encabezado
 * adelante y sabiendo que la mitad de lo que falta no está en este paquete.
 *
 * Hay precedente exacto y se sigue igual: el ADR II-0007 hizo esto mismo con el
 * criterio de 4 ms absolutos del Hito 2, que sigue `it.fails` en
 * `banco-el-tick.test.ts` como vara de progreso mientras el criterio vigente
 * corre en verde al lado. Dos tests y no uno, porque hacen dos trabajos
 * distintos:
 *
 *   - el de 5 ms queda ROJO. Es la aspiración y no se toca: bajarlo para dar
 *     verde sería mover el criterio, que es lo único que este arnés existe para
 *     no hacer. El día que se cumpla, vitest avisa solo («test esperado fallido
 *     que pasó») y hay que borrarle el `.fails`.
 *   - el de 45 ms queda VERDE. Es la GUARDA DE REGRESIÓN de lo aceptado: sin
 *     él, «aceptado» se convierte en «sin medir», y el número puede triplicarse
 *     sin que nada se ponga rojo. Aceptar un número no es dejar de vigilarlo.
 *
 * Los 45 son el peor medido (38) más margen para el ruido de la máquina, que en
 * este banco es real: el mismo barrido dio 30,9 y 37,6 en dos corridas. Un techo
 * pegado al peor medido sería un test intermitente, y un test intermitente se
 * termina borrando.
 *
 * ─── Y ESE MARGEN NO ALCANZÓ, que es el hallazgo ────────────────────────────
 *
 * La primera versión de esta guarda AFIRMABA siempre, adentro de la suite
 * normal, y se puso roja al día siguiente: **55,7 ms** contra los 45. Medido
 * después: corriendo este archivo SOLO da 42,09 ms, y da 55–57 cuando
 * `el-tick-remedido.test.ts` le compite el CPU en la misma corrida de
 * `pnpm ii:test`. O sea que no midió una regresión del código: midió la carga de
 * la máquina.
 *
 * La reparación no es subir el número —eso sería mover el criterio hasta que dé
 * verde, que es lo único que este arnés existe para no hacer— sino la que el
 * paquete ya había decidido y está escrita en `banco-el-tick.test.ts:161`:
 *
 *   «Un test de rendimiento adentro de la suite normal es un test flaky, y un
 *    test flaky es peor que ninguno: enseña a ignorar el rojo.»
 *
 * Así que se imprime siempre y se afirma sólo con `ANIMA_BANCO=1`, igual que el
 * criterio vigente del ADR II-0007. El número queda a la vista en cada corrida;
 * lo que deja de estar es el rojo que no significa nada.
 *
 * (La perilla —`MIDIENDO_EN_SERIO`— ya estaba declarada más abajo en este mismo
 * archivo, para los otros bancos. Esta guarda era la única que afirmaba sin
 * mirarla.)
 */
const TECHO_ACEPTADO_MS = 45

/** Los 5000 cuerpos del criterio. Constante a lo largo de todo el barrido. */
const CUERPOS = 5000

/** El barrido de criaturas que caminan. */
const BARRIDO = [0, 1, 10, 100, 1000, CUERPOS] as const

/**
 * Cuántos ticks se miden por fila.
 *
 * 120 y no 7: un p99 sobre siete muestras es el máximo con otro nombre. Con 120,
 * el p99 cae en la muestra 119 de 120 y la cola tiene de dónde salir.
 */
const TICKS = 120

/** Ticks de calentamiento que NO entran a las muestras. */
const CALIENTA = 5

/**
 * Las aserciones de tiempo solo corren cuando alguien pide medir en serio:
 *
 *   ANIMA_BANCO=1 pnpm --filter @anima/world exec vitest run tests/banco-el-camino-de-intenciones.test.ts
 *
 * Es la misma disciplina que `banco-el-tick.test.ts` y por la misma razón: la
 * suite corre los paquetes en paralelo y un banco que mide milisegundos contra una
 * máquina ocupada da cualquier cosa. Los números se imprimen SIEMPRE; se afirman
 * solo cuando la máquina está tranquila.
 */
const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

// ─── El mundo del banco, armado acá ──────────────────────────────────────────

function cuerpo(id: string, substance: string, mass: number, state: QualityVector = {}): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state }
}

interface MundoConCriaturas {
  readonly s: WorldState
  readonly ids: readonly string[]
}

/**
 * `CUERPOS` cuerpos, de los cuales `actores` son criaturas.
 *
 * La criatura `i` arranca en `(3i, 0)` y camina hacia el norte por su columna. Tres
 * celdas de separación y no una: con una, la diagonal de `unPasoHacia` no sirve de
 * nada pero la vecindad de `aMano` sí, y prefiero que el barrido no mida una
 * multitud apretada por accidente.
 *
 * Los inertes van en `y ≤ −2`, o sea fuera del camino: si estorbaran, `estorbo`
 * cortaría antes y el banco mediría un caso más barato que el normal.
 *
 * `stamina` 1000 es el tope del rango. A 0,06 por tick —lo que hoy cuesta un paso
 * más vivir— alcanza para 16.000 ticks, o sea que ninguna criatura de este banco
 * se queda sin fuerzas en los 125 que se miden. Es a propósito que el número no
 * salga de `COSTO_PASO` ni de `COSTO_VIVIR`: este archivo mide el CAMINO, y no
 * tiene que romperse el día que el ADR II-0009 les cambie el nombre o el valor.
 */
function mundoDeCriaturas(actores: number): MundoConCriaturas {
  const bodies: WorldBody[] = []
  const acts: Actor[] = []
  const ids: string[] = []
  for (let i = 0; i < actores; i++) {
    const id = `k${String(i).padStart(6, '0')}`
    ids.push(id)
    bodies.push({
      body: cuerpo(`${id}-cuerpo`, 'carne', 2, { stamina: 1000 }),
      at: { x: i * 3, y: 0 },
    })
    acts.push({ id, body: `${id}-cuerpo`, holding: [], capacity: 2, permits: 'irreversible' })
  }
  for (let i = 0; i < CUERPOS - actores; i++) {
    bodies.push({
      body: cuerpo(`b${String(i).padStart(6, '0')}`, MATERIA[i % MATERIA.length] as string, 1 + (i % 5) * 0.2),
      at: { x: i % 1000, y: -2 - ((i / 1000) | 0) },
    })
  }
  return {
    s: {
      tick: 0,
      hz: HZ_DE_REFERENCIA,
      phys: buildSeedPhysics(),
      bodies: mapaDeCuerpos(bodies),
      actors: mapaDeActores(acts),
      cells: new Map<number, CellState>(),
      desplegados: new Map(),
      nextId: 1,
    },
    ids,
  }
}

const MATERIA = ['madera', 'liana', 'pescado', 'corteza', 'hoja', 'piedra', 'hueso', 'junco']

/** Un `goTo` al norte lejano por criatura: un paso por tick, para siempre. */
function caminatas(ids: readonly string[], seq: number): Intent[] {
  const out: Intent[] = []
  for (let i = 0; i < ids.length; i++) {
    out.push({
      k: 'goTo',
      by: ids[i] as string,
      seq,
      commitment: 'reversible',
      to: { x: i * 3, y: 100_000 },
      within: 0,
    })
  }
  return out
}

/** Un `wait` por criatura: el despacho entero SIN tocar el mundo. */
function esperas(ids: readonly string[], seq: number): Intent[] {
  return ids.map((by) => ({ k: 'wait', by, seq, commitment: 'reversible', segundos: 1 }) as Intent)
}

// ─── El arnés: percentiles, no mínimos ───────────────────────────────────────

interface Perfil {
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly peor: number
}

/**
 * El percentil `p` (0..1) de una lista YA ORDENADA, por el método del rango más
 * cercano: `ceil(p·n)`. Es el que usan los SLO y el que hace que «p99» sobre 120
 * muestras signifique «la muestra 119», y no una interpolación entre dos.
 */
function pct(ordenadas: readonly number[], p: number): number {
  if (ordenadas.length === 0) return 0
  const i = Math.ceil(p * ordenadas.length) - 1
  return ordenadas[i < 0 ? 0 : i >= ordenadas.length ? ordenadas.length - 1 : i] as number
}

/**
 * Avanza el mundo `TICKS` veces midiendo cada tick, y devuelve los percentiles.
 *
 * No hay mínimo de rondas acá y no puede haberlo: cada tick mide un estado
 * distinto —las criaturas se movieron— así que repetir la misma medición no
 * existe. Lo que hay es una corrida larga y su distribución, que es exactamente
 * lo que el criterio pregunta.
 */
async function perfilar(
  s0: WorldState,
  ids: readonly string[],
  intentar: (ids: readonly string[], seq: number) => Intent[],
): Promise<Perfil> {
  let w = s0
  for (let t = 0; t < CALIENTA; t++) w = stepWorld(w, intentar(ids, t)).state
  const ms: number[] = []
  for (let t = 0; t < TICKS; t++) {
    const antes = process.hrtime.bigint()
    const r = stepWorld(w, intentar(ids, CALIENTA + t))
    ms.push(Number(process.hrtime.bigint() - antes) / 1e6)
    w = r.state
    // ─── SE CEDE EL HILO CADA TANTO ────────────────────────────────────────
    //
    // La trampa que este proyecto ya tiene escrita: birpc le pone 60 s de
    // vencimiento al aviso de cada test y un bucle sincrónico largo no deja
    // correr ni el temporizador ni la lectura del socket — salen los tests en
    // verde y `exit 1`. Con la suite en serie estas seis filas de 125 ticks
    // sobre 5000 cuerpos entraban; con los ocho paquetes en paralelo el mismo
    // trabajo tarda el triple y llega al vencimiento.
    //
    // Se cede DESPUÉS de cerrar el cronómetro, así que no entra en la medición,
    // y con `setTimeout(0)` —una macrotarea— porque un `await` sobre una
    // promesa resuelta es una microtarea y no drena la fase de poll.
    if ((t & 0xf) === 0xf) await new Promise((listo) => setTimeout(listo, 0))
  }
  ms.sort((a, b) => a - b)
  return { p50: pct(ms, 0.5), p95: pct(ms, 0.95), p99: pct(ms, 0.99), peor: ms[ms.length - 1] as number }
}

const num = (x: number, d = 2): string => x.toFixed(d)
const col = (x: string, n: number): string => x.padStart(n)

// ─── El barrido ──────────────────────────────────────────────────────────────

describe('el camino de intenciones, con criaturas que se mueven de verdad', () => {
  it(`p50/p95/p99/peor con ${CUERPOS} cuerpos y ${BARRIDO.join('/')} criaturas caminando`, async () => {
    const filas: { n: number; p: Perfil }[] = []
    for (const n of BARRIDO) {
      const { s, ids } = mundoDeCriaturas(n)
      filas.push({ n, p: await perfilar(s, ids, caminatas) })
    }

    /* eslint-disable no-console */
    console.log(
      [
        '',
        `══ EL CAMINO DE INTENCIONES ══════════════  techo del Hito 5: p99 < ${TECHO_P99_MS} ms`,
        `   ${CUERPOS} cuerpos SIEMPRE; N de ellos son criaturas que caminan.`,
        `   ${TICKS} ticks medidos por fila, ${CALIENTA} de calentamiento.`,
        '',
        '  actores      p50        p95        p99       peor     p99/techo',
        ...filas.map(
          (f) =>
            `  ${col(String(f.n), 7)}  ${col(num(f.p.p50), 8)} ms ${col(num(f.p.p95), 8)} ms ` +
            `${col(num(f.p.p99), 8)} ms ${col(num(f.p.peor), 8)} ms  ${col(num(f.p.p99 / TECHO_P99_MS, 1), 7)}×` +
            (f.p.p99 < TECHO_P99_MS ? '  PASA' : ''),
        ),
        '',
        `  la fila de 0 actores es lo que mide el banco viejo: sistemaLeyes y nada más.`,
        ...pendiente(filas),
        '',
      ].join('\n'),
    )
    /* eslint-enable no-console */

    // El banco tiene que HABER medido: si el barrido devolviera ceros, la tabla
    // sería decorativa.
    for (const f of filas) expect(f.p.p99).toBeGreaterThan(0)
    // Y el p99 no puede ser menor que el p50: es el control de que el arnés ordena.
    for (const f of filas) expect(f.p.p99).toBeGreaterThanOrEqual(f.p.p50)

    if (!MIDIENDO_EN_SERIO) return

    // ─── LO QUE SÍ SE AFIRMA CUANDO SE MIDE EN SERIO ───────────────────────
    //
    // No el techo del Hito 5 —hoy no da, y el `it.fails` de abajo lo dice con su
    // nombre—, sino la propiedad que este tramo SÍ cerró: que el camino de
    // intenciones dejó de ser O(actores × cuerpos).
    //
    // La vara es el mundo quieto. Con el camino cuadrático, 5000 criaturas
    // costaban 45,7 veces el mundo quieto; con el índice, 2,9. El umbral es
    // holgado a propósito: es un DETECTOR de O(cuerpos por actor), no una
    // medición — el número exacto está en la tabla que se imprime.
    const quieto = filas[0] as { n: number; p: Perfil }
    const lleno = filas[filas.length - 1] as { n: number; p: Perfil }
    expect(lleno.p.p99 / quieto.p.p99).toBeLessThan(5)
  }, 900_000)

  /**
   * EL CRITERIO DEL HITO 5, clavado y sin ablandar.
   *
   * POR QUÉ SIGUE ABIERTO: con 5000 cuerpos y 5000 criaturas caminando, el p99
   * mide 30,9 ms contra un techo de 5. El camino de intenciones ya no es lo que
   * manda —bajó 21,6× en este tramo y dejó de crecer con la población—; de los
   * 30,9 hay 10,6 que son el mundo QUIETO, o sea `sistemaLeyes` sobre 5000 cuerpos,
   * que es trabajo de `@anima/physics`.
   *
   * QUÉ HARÍA FALTA PARA CERRARLO, y en qué archivo: las dos cosas que el Hito 2
   * ya diagnosticó y dejó escritas en `tests/banco-el-tick.test.ts`, ninguna de las
   * dos en este paquete —
   *
   *   1. `packages/physics/src/quality.ts` — un cuerpo con sus 29 cualidades
   *      resueltas en un vector numérico, recalculado solo cuando cambian las
   *      partes. Hoy cada cualidad se resuelve preguntándole a `state`, después a
   *      las partes y después a la sustancia, y el piso son ~1,2 µs por cuerpo;
   *   2. `packages/world/src/step.ts`, `abrir` — `new Map(s.bodies)` copia 5000
   *      entradas por tick, y `cerrar` vuelve a ordenar los 5000 ids con
   *      `compararTexto` cada vez que nace o muere un cuerpo. Un `Borrador` con
   *      copia perezosa por cuerpo tocado borraría las dos.
   *
   * El día que el p99 baje de 5, esto se cae solo por «test esperado fallido que
   * pasó» y hay que borrar el `.fails`. Un criterio que se mueve para dar verde no
   * es un criterio.
   *
   * Va detrás de `CONTRA_EL_RELOJ` por lo mismo que su gemelo de
   * `banco-el-tick.test.ts`: un `it.fails` de reloj tiene el modo de falla DADO
   * VUELTA —se pone rojo cuando la máquina está DESOCUPADA y el techo se
   * alcanza— y ese rojo dice «celebrá» cuando en realidad dice «el runner estaba
   * libre».
   */
  it.skipIf(!CONTRA_EL_RELOJ).fails(`p99 < ${TECHO_P99_MS} ms con ${CUERPOS} cuerpos y ${CUERPOS} criaturas`, async () => {
    const { s, ids } = mundoDeCriaturas(CUERPOS)
    expect((await perfilar(s, ids, caminatas)).p99).toBeLessThan(TECHO_P99_MS)
  }, 900_000)

  /**
   * La otra mitad de la decisión: lo aceptado también se vigila.
   *
   * Ver el porqué entero en `TECHO_ACEPTADO_MS`. En una frase: el test de arriba
   * guarda la aspiración y éste guarda lo que hay, porque un número que se acepta
   * y deja de medirse se triplica sin que nadie se entere.
   */
  it(`y lo ACEPTADO se sigue vigilando: p99 < ${TECHO_ACEPTADO_MS} ms (5 a 7× el criterio)`, async () => {
    const { s, ids } = mundoDeCriaturas(CUERPOS)
    const p = await perfilar(s, ids, caminatas)
    /* eslint-disable no-console */
    console.log(
      `\n  p99 con ${CUERPOS} cuerpos y ${CUERPOS} criaturas: ${num(p.p99)} ms` +
        `  ·  criterio ${TECHO_P99_MS} ms (${num(p.p99 / TECHO_P99_MS, 1)}×, ACEPTADO)` +
        `  ·  guarda ${TECHO_ACEPTADO_MS} ms\n`,
    )
    /* eslint-enable no-console */
    // Se imprime SIEMPRE y se afirma sólo midiendo en serio, igual que el
    // criterio vigente de `banco-el-tick.test.ts:259`. Ver `MIDIENDO_EN_SERIO`.
    if (!MIDIENDO_EN_SERIO) return
    expect(p.p99).toBeLessThan(TECHO_ACEPTADO_MS)
  }, 900_000)

  /**
   * Un `goTo` contra un `wait`, sobre la MISMA población.
   *
   * `wait` recorre todo el portón —orden total, empates, compromiso, permisos,
   * `yaActuo`— y no toca el mundo. `goTo` hace eso mismo y además llama a las dos
   * funciones que recorrían el mundo entero. La resta es, entonces, exactamente lo
   * que cuestan `estorbo` + `olvidar`, sin tener que instrumentar `step.ts`.
   */
  it('un goTo contra un wait: cuánto cuesta el portón y cuánto el mundo', async () => {
    const n = 1000
    const a = mundoDeCriaturas(n)
    const b = mundoDeCriaturas(n)
    const conMundo = await perfilar(a.s, a.ids, caminatas)
    const soloPorton = await perfilar(b.s, b.ids, esperas)
    const quieto = await perfilar(mundoDeCriaturas(0).s, [], caminatas)

    /* eslint-disable no-console */
    console.log(
      [
        '',
        `── ${n} criaturas, ${CUERPOS} cuerpos: dónde se va el tick ──────────`,
        `  mundo QUIETO (0 intenciones) ............ ${num(quieto.p50)} ms p50`,
        `  ${n} × wait (portón, sin tocar el mundo) . ${num(soloPorton.p50)} ms p50   (+${num(soloPorton.p50 - quieto.p50)})`,
        `  ${n} × goTo (portón + estorbo + olvidar) . ${num(conMundo.p50)} ms p50   (+${num(conMundo.p50 - soloPorton.p50)})`,
        '',
      ].join('\n'),
    )
    /* eslint-enable no-console */

    // ─── EL MECANISMO, QUE SE AFIRMA SIEMPRE Y NO NECESITA RELOJ ────────────
    //
    // Lo que la resta de arriba quiere decir es «`wait` no recorre el mundo y `goTo`
    // sí», y eso se puede afirmar sin cronómetro: con `esperas` ningún cuerpo se
    // mueve y con `caminatas` se mueven todos. Si `wait` estuviera cayendo por el
    // camino de `goTo` —que es la única forma de que la resta no signifique nada—,
    // las criaturas se habrían movido con las dos.
    const trasEsperar = stepWorld(b.s, esperas(b.ids, 0)).state
    const trasCaminar = stepWorld(a.s, caminatas(a.ids, 0)).state
    const donde = (w: WorldState, id: string): string => {
      const c = w.bodies.get(`${id}-cuerpo`)
      return c === undefined ? '?' : `${String(c.at.x)},${String(c.at.y)}`
    }
    const quietos = b.ids.filter((id) => donde(trasEsperar, id) === donde(b.s, id)).length
    const movidos = a.ids.filter((id) => donde(trasCaminar, id) !== donde(a.s, id)).length
    expect(quietos).toBe(b.ids.length)
    expect(movidos).toBeGreaterThan(0)

    // ─── Y LO QUE SÓLO SE AFIRMA MIDIENDO EN SERIO ─────────────────────────
    //
    // Las dos líneas de abajo comparan TRES perfiles de reloj de pared entre sí, y
    // eso adentro de `pnpm ii:test` es un test intermitente: los tres barridos se
    // corren uno después del otro mientras los otros ocho paquetes compiten por el
    // CPU, así que el orden entre dos p50 que difieren en 1,7 ms se puede dar vuelta
    // sin que el código cambie. Medido: se dio vuelta en una corrida de la suite
    // completa y no volvió a darse vuelta corriendo el archivo solo.
    //
    // NO se aflojan los umbrales —serían otros números y no dirían nada— y no se
    // borra el caso: se aplica lo que este paquete ya decidió para los otros tres
    // bancos de este archivo (ver `TECHO_ACEPTADO_MS` y `MIDIENDO_EN_SERIO`). La
    // tabla se imprime siempre y la comparación se afirma con `ANIMA_BANCO=1`; el
    // mecanismo, que es lo que el test quiere decir, se afirma siempre.
    if (!MIDIENDO_EN_SERIO) return

    // El portón cuesta MENOS que el camino que toca el mundo. Si esto se diera
    // vuelta, la optimización habría que hacerla en `ordenarIntenciones` y no acá,
    // y este banco estaría midiendo la cosa equivocada.
    expect(soloPorton.p50).toBeLessThan(conMundo.p50)
    // Y esperar tiene que costar algo por encima del mundo quieto: si no, `wait`
    // no estaría llegando al despacho y la resta no significaría nada.
    expect(soloPorton.p50).toBeGreaterThan(quieto.p50 * 0.9)
  }, 900_000)

  /**
   * `drop` es la intención que más multiplica el camino: `celdaLibreCerca` llama a
   * `estorbo` una vez por la celda propia y hasta ocho más, una por rumbo.
   *
   * En ESTE mundo son dos —la celda propia la ocupa la criatura, y la de al lado
   * está libre porque las columnas van de a tres— así que la fila mide el caso
   * NORMAL de un `drop`, que es el doble de un `goTo`, y no el peor de nueve. El
   * peor sería una criatura rodeada, que en un mundo de 5000 cuerpos sueltos no
   * pasa; decir «nueve» acá y medir dos sería inventar.
   *
   * Se mide aparte porque es lo que una criatura que pesca de verdad hace todo el
   * tiempo: deshilachar, atar, soltar, tomar.
   *
   * Es la ÚNICA medición del archivo que no corre sobre 5000 cuerpos exactos: las
   * 200 piedras que las criaturas llevan en la mano se suman a los 5000. Se dice
   * acá para que nadie compare esta fila con las del barrido.
   *
   * La distribución de esta fila es BIMODAL a propósito y hay que leerla sabiéndolo:
   * los ticks pares sueltan y los impares toman, así que el p50 cae justo en la
   * frontera entre los dos modos y el p99 mide el modo caro. Antes: p50 21,84 · p99
   * 73,39. Después: p50 13,15 · p99 21,62.
   */
  it('un drop cuesta dos estorbos donde un goTo cuesta uno, y eso se mide', async () => {
    const n = 200
    const { s, ids } = mundoDeCriaturas(n)
    // Cada criatura arranca con una piedra en la mano, y alterna soltarla y
    // volver a tomarla. El tick par paga los `estorbo` de `celdaLibreCerca`; el
    // impar paga el `olvidar` de `intencionTomar`.
    const alternado = (unos: readonly string[], seq: number): Intent[] =>
      unos.map((by) =>
        seq % 2 === 0
          ? ({ k: 'drop', by, seq, commitment: 'reversible', what: `${by}-cosa` } as Intent)
          : ({ k: 'take', by, seq, commitment: 'reversible', what: `${by}-cosa` } as Intent),
      )
    const p = await perfilar(conCosasEnLaMano(s, ids), ids, alternado)

    /* eslint-disable no-console */
    console.log(
      `\n  ${n} criaturas soltando y tomando (distribución bimodal, ver el comentario): ` +
        `p50 ${num(p.p50)} ms · p99 ${num(p.p99)} ms\n`,
    )
    /* eslint-enable no-console */
    expect(p.p99).toBeGreaterThan(0)
  }, 900_000)
})

/** El mismo mundo pero con una piedra en la mano de cada criatura. */
function conCosasEnLaMano(s: WorldState, ids: readonly string[]): WorldState {
  const bodies = [...s.bodies.values()]
  const actors: Actor[] = []
  for (const id of ids) {
    const a = s.actors.get(id) as Actor
    const cuerpoDelActor = s.bodies.get(a.body) as WorldBody
    bodies.push({
      body: cuerpo(`${id}-cosa`, 'piedra', 0.5),
      at: cuerpoDelActor.at,
      heldBy: id,
    })
    actors.push({ ...a, holding: [`${id}-cosa`] })
  }
  return { ...s, bodies: mapaDeCuerpos(bodies), actors: mapaDeActores(actors) }
}

/** La pendiente entre las dos filas más grandes: ms por actor y por tick. */
function pendiente(filas: readonly { n: number; p: Perfil }[]): string[] {
  if (filas.length < 2) return []
  const a = filas[filas.length - 2] as { n: number; p: Perfil }
  const b = filas[filas.length - 1] as { n: number; p: Perfil }
  if (b.n === a.n) return []
  const m = (b.p.p99 - a.p.p99) / (b.n - a.n)
  return [
    `  pendiente entre ${a.n} y ${b.n} actores: ${num(m * 1000, 3)} µs por actor y por tick`,
    `  (si el camino fuera O(1) en cuerpos, esa pendiente no dependería de que haya ${CUERPOS})`,
  ]
}

// ─── El índice: ¿se enchufa `grid.ts` o hace falta uno propio? ───────────────

describe('el índice de cuerpos por celda: grid.ts contra uno propio del Borrador', () => {
  /**
   * La pregunta que el tramo tenía que contestar CON EVIDENCIA, no de palabra:
   * `grid.ts` ya tiene un índice espacial O(1) con `placeBody`/`bodiesAt`. ¿Se
   * enchufa, o conviene uno propio adentro del `Borrador`?
   *
   * La respuesta es «uno propio», y las dos razones se miden acá:
   *
   *   1. `placeBody` MATERIALIZA el chunk (`ensureChunk`), o sea que indexar un
   *      cuerpo asigna, la primera vez, los `FIELD_COUNT` arreglos de 1024 celdas
   *      del terreno de ese chunk. `grid.ts` dice en su propio encabezado que
   *      «LEER NO MATERIALIZA» porque materializar es lo que hace que dos partidas
   *      exploradas en distinto orden tengan estados distintos; indexar cuerpos
   *      para contestar `estorbo` no puede tener ese efecto;
   *   2. `WorldState` NO tiene una `Grid`. `stepWorld` no importa `grid.js` en
   *      ninguna línea, así que enchufarla obligaría a construir una por tick —el
   *      costo que se mide abajo— o a meter la grilla en el estado, que le cambia
   *      el hash al mundo entero y es un ADR, no una optimización.
   *
   * El índice propio del `Borrador` es un `Map<CellKey, BodyId[]>` que se arma
   * perezosamente en el primer `estorbo` del tick, se mantiene en `ponerCuerpo` y
   * `sacarCuerpo`, y se tira al cerrar. No toca el terreno, no entra al hash y no
   * sobrevive al tick — así que no puede quedar vieja entre ticks.
   */
  it('construir el índice de 5000 cuerpos: grid.ts contra un Map de celdas', async () => {
    const { s } = mundoDeCriaturas(0)
    const celdas: { id: string; at: { x: number; y: number } }[] = []
    for (const [id, c] of s.bodies) celdas.push({ id, at: c.at })

    const conGrid = (): number => {
      const t0 = process.hrtime.bigint()
      const g = createGrid()
      for (const c of celdas) placeBody(g, c.id, c.at)
      let vistos = 0
      for (const c of celdas) vistos += bodiesAt(g, c.at).length
      const ms = Number(process.hrtime.bigint() - t0) / 1e6
      expect(vistos).toBe(celdas.length)
      return ms
    }

    const conMapa = (): number => {
      const t0 = process.hrtime.bigint()
      const m = new Map<number, string[]>()
      for (const c of celdas) {
        const k = keyOfCell(c.at)
        const hay = m.get(k)
        if (hay === undefined) m.set(k, [c.id])
        else hay.push(c.id)
      }
      let vistos = 0
      for (const c of celdas) vistos += (m.get(keyOfCell(c.at)) ?? []).length
      const ms = Number(process.hrtime.bigint() - t0) / 1e6
      expect(vistos).toBe(celdas.length)
      return ms
    }

    // El mínimo de siete: acá SÍ corresponde, porque las dos hacen exactamente el
    // mismo trabajo en cada ronda y lo que se compara es el costo del programa.
    const min = (f: () => number): number => {
      for (let i = 0; i < 2; i++) f()
      let mejor = Number.POSITIVE_INFINITY
      for (let r = 0; r < 7; r++) {
        const ms = f()
        if (ms < mejor) mejor = ms
      }
      return mejor
    }

    const grid = min(conGrid)
    const mapa = min(conMapa)
    /* eslint-disable no-console */
    console.log(
      [
        '',
        `── armar el índice de ${CUERPOS} cuerpos + ${CUERPOS} consultas ────────`,
        `  grid.ts (placeBody + bodiesAt) ..... ${num(grid)} ms   materializa el terreno`,
        `  Map<CellKey, BodyId[]> propio ...... ${num(mapa)} ms   no toca el terreno`,
        `  razón .............................. ${num(grid / mapa, 1)}×`,
        '',
      ].join('\n'),
    )
    /* eslint-enable no-console */
    // Lo que estos dos renglones querían decir es «la medición ocurrió», y estaban
    // diciéndolo con una comparación de tiempos. Un `> 0` sobre un milisegundo se
    // rompe con la máquina RÁPIDA —si el mínimo de las rondas cae por debajo de la
    // resolución del reloj, el número es 0 y esto se pone rojo sin que nadie haya
    // tocado nada—. `isFinite` dice lo mismo y no mira ninguna máquina.
    expect(Number.isFinite(grid), 'no se midió `grid.ts`').toBe(true)
    expect(Number.isFinite(mapa), 'no se midió el Map propio').toBe(true)
  }, 300_000)

  it('placeBody materializa chunks, y por eso no puede ser el índice del tick', async () => {
    // La evidencia estructural, que no depende de ningún milisegundo: indexar UN
    // cuerpo con `grid.ts` crea un chunk de terreno que antes no existía. Ése es
    // el efecto que descalifica a `grid.ts` para este uso, y está acá para que si
    // alguien alguna vez cambia `placeBody` para que no materialice, este test se
    // caiga y la decisión se revise con un número al lado.
    const g = createGrid()
    expect(g.chunks.size).toBe(0)
    placeBody(g, 'x', { x: 0, y: 0 })
    expect(g.chunks.size).toBe(1)
    placeBody(g, 'y', { x: 4000, y: 4000 })
    expect(g.chunks.size).toBe(2)
  })
})

// ─── Control: el mundo del banco se mueve de verdad ─────────────────────────

describe('lo que el banco mide existe', () => {
  it('las criaturas caminan: cada tick cambia la celda de todas', async () => {
    const { s, ids } = mundoDeCriaturas(10)
    let w = s
    const antes = ids.map((id) => (w.bodies.get(`${id}-cuerpo`) as WorldBody).at.y)
    for (let t = 0; t < 5; t++) w = stepWorld(w, caminatas(ids, t)).state
    const despues = ids.map((id) => (w.bodies.get(`${id}-cuerpo`) as WorldBody).at.y)
    // Cinco ticks, cinco celdas al norte. Si alguna no se movió, el banco estaría
    // midiendo rechazos y no caminatas — que cuestan la mitad, porque `olvidar` no
    // llega a correr.
    for (let i = 0; i < ids.length; i++) expect(despues[i]).toBe((antes[i] as number) + 5)
  })

  it('y el mundo del banco tiene los 5000 cuerpos del criterio, en todas las filas', async () => {
    for (const n of BARRIDO) {
      const { s } = mundoDeCriaturas(n)
      expect(s.bodies.size).toBe(CUERPOS)
      expect(s.actors.size).toBe(n)
    }
  })

  it('ninguna criatura arranca solapada con nada: el estado medido es legal', async () => {
    const { s } = mundoDeCriaturas(CUERPOS)
    const ocupadas = new Set<number>()
    for (const c of s.bodies.values()) {
      const k = keyOfCell(c.at)
      expect(ocupadas.has(k)).toBe(false)
      ocupadas.add(k)
    }
  })
})
