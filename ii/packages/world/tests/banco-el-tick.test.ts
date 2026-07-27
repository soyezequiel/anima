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

/**
 * El tick completo sobre UN estado fijo, y no sobre un mundo que avanza.
 *
 * La versión que avanzaba (`w = stepWorld(w).state`) medía una cosa distinta en
 * cada ronda, y eso rompía las dos cuentas que este banco hace con el número:
 *
 *   1. `minMs` toma el MÍNIMO de siete rondas porque el mínimo es lo único
 *      atribuible al programa. Con un estado que avanza, el mínimo pasa a ser el
 *      del estado más barato, que es otra cosa;
 *   2. el desglose resta `msSoloLeyes` para saber cuánto agrega el mundo, y
 *      `msSoloLeyes` corre siempre sobre los cuerpos del estado inicial. Mientras
 *      la física se llevaba el 100% del tick la diferencia quedaba tapada por el
 *      ruido; cuando la física bajó cinco veces, la resta empezó a cobrarle al
 *      mundo la diferencia entre dos poblaciones de cuerpos y no su costo propio.
 *      Medido de las dos maneras sobre el mismo estado, el mundo cuesta 0,8 ms;
 *      la resta de poblaciones distintas decía 2,1.
 *
 * `stepWorld` es pura, así que llamarla siete veces sobre el mismo estado hace
 * siete veces exactamente el mismo trabajo — que es lo que un banco quiere.
 */
function msPorTick(s: WorldState): number {
  return minMs(() => {
    stepWorld(s, [])
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
 * UNA lectura completa de cuerpo: las doce cualidades que `leyes.ts` mira,
 * copiadas acá porque `leer` no se exporta.
 *
 * ─── Este número YA NO ES la conclusión, y conviene decir por qué ───────────
 *
 * Cuando se escribió este banco, `leer()` calculaba sus trece cualidades de
 * golpe y `paso()` lo hacía cinco veces por cuerpo: sesenta y cinco lecturas por
 * cuerpo y por tick. Con eso, una sola lectura completa sobre los 5000 costaba
 * 6,06 ms —más que el tick entero permitido— y el techo era inalcanzable aunque
 * el bucle del mundo fuera gratis.
 *
 * Eso se reparó. `leer()` es ahora perezosa y memoizada, y `paso()` no rearma la
 * lectura cuando la ley devolvió el mismo cuerpo: de sesenta y cinco lecturas
 * por cuerpo quedan TRECE Y MEDIA, y son las que las leyes de verdad usan. Así
 * que este número sigue siendo interesante —dice cuánto cuesta preguntar— pero
 * ya no acota nada: `paso()` no hace cinco lecturas completas, hace las que
 * necesita.
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
  /**
   * Las aserciones de tiempo solo corren cuando alguien pide medir en serio:
   *
   *   pnpm ii:tick
   *
   * En la suite normal los números se imprimen y no se afirman. `pnpm -r test`
   * corre los cuatro paquetes EN PARALELO, y un banco que mide milisegundos
   * contra una máquina ocupada da cualquier cosa: lo que el mundo agrega mide
   * 1,20 ms corriendo solo y 7,80 ms corriendo al lado de los otros. El mismo
   * código, seis veces peor.
   *
   * Un test de rendimiento adentro de la suite normal es un test flaky, y un
   * test flaky es peor que ninguno: enseña a ignorar el rojo.
   */
  const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

  /** El techo VIEJO, absoluto. Ya no gobierna; se conserva como vara de progreso. */
  const TECHO = 4

  /**
   * El criterio VIGENTE, del ADR II-0007: el tick es un parámetro y su
   * presupuesto es una FRACCIÓN.
   *
   * La frecuencia bajó de 30 a 20 Hz. No es una constante de la física —el mundo
   * es agnóstico, «30 Hz» solo vivía en dos comentarios— y separarla de las
   * tasas de las leyes es lo que de verdad vale de esa decisión: la frecuencia
   * gobierna el RENDIMIENTO y las tasas gobiernan el RITMO. Nunca se arregla uno
   * moviendo el otro.
   */
  const TICK_HZ = 20
  const TICK_MS = 1000 / TICK_HZ
  const FRACCION = 0.25

  /**
   * TODAVÍA NO SE CUMPLE — 8,2 ms contra un techo de 4 —, pero por una razón
   * distinta de la de antes y con cinco veces menos distancia.
   *
   * Sigue marcado con `it.fails` —el mismo idioma con el que la física dejó los
   * diez huecos abiertos de `admit()`— y no con el umbral relajado: un criterio
   * que se mueve para dar verde no es un criterio, es una decoración. El día que
   * el tick baje de 4, esto se cae solo por «test esperado fallido que pasó» y
   * hay que borrar el `.fails`.
   *
   * ─── QUÉ SE REPARÓ ──────────────────────────────────────────────────────────
   *
   *   39,66 ms  →  8,2 ms       el tick completo, 5000 cuerpos
   *   39,79 ms  →  7,9 ms       `paso()` de @anima/physics, solo
   *      77     →  13,6         lecturas de cualidad por cuerpo y por tick
   *
   * La causa que este banco había diagnosticado era real y está arreglada:
   * `leer()` armaba trece cualidades de golpe y `paso()` lo hacía cinco veces por
   * cuerpo, para que cada ley usara dos o tres. Ahora la lectura es perezosa y
   * memoizada, y no se rearma cuando la ley devolvió el mismo cuerpo. Además el
   * candado de conservación leía la masa seis veces por cuerpo para obtener dos
   * números, y `qualityOf` construía un `Set` de detección de ciclos en cada
   * llamada aunque no hubiera ninguna cualidad derivada en juego.
   *
   * ─── QUÉ FALTA, Y POR QUÉ NO ES OTRA MICRO-OPTIMIZACIÓN ────────────────────
   *
   * Faltan 2,05×. El perfil quedó PLANO: ningún renglón pasa del 13%, y los
   * grandes son irreducibles sin cambiar la representación —13,6 lecturas de
   * cualidad, ~6 objetos nuevos por cuerpo y por tick (los cuerpos son inmutables
   * y cada ley devuelve uno nuevo), y una búsqueda de sustancia en un `Map` por
   * cada cualidad que no está en `state`.
   *
   * Lo que queda es un cambio de REPRESENTACIÓN, no un ajuste: mientras una
   * cualidad se resuelva preguntándole a `state` y después a las partes y después
   * a la sustancia, el piso son ~1,2 µs por cuerpo. Un cuerpo con sus 29
   * cualidades ya resueltas en un vector numérico —recalculado solo cuando las
   * partes cambian— borraría de una vez las tres cosas. Eso es el Hito 3 o un ADR
   * propio, y no entra en «optimizar sin cambiar una conducta».
   *
   * Mientras tanto entran ~2400 cuerpos en 4 ms, contra ~500 antes.
   */
  /**
   * EL CRITERIO VIEJO, que se conserva midiendo aunque ya no gobierna.
   *
   * «5000 cuerpos a menos de 4 ms» era un número absoluto contra un presupuesto
   * de tick que había que acordarse. El ADR II-0007 lo reemplazó por una
   * FRACCIÓN —`stepWorld` ≤ 25% del tick— y bajó la frecuencia a 20 Hz, que es
   * lo que el usuario autorizó cuando dijo que un tick más largo estaba bien.
   *
   * Se deja en `it.fails` en vez de borrarlo porque el número sigue siendo la
   * mejor vara de progreso que tiene este banco: el día que alguien pague el
   * cambio de representación, esto se cae solo por «test esperado fallido que
   * pasó» y hay que borrarlo. Un criterio superado no se tapa: se celebra.
   */
  it.fails('el criterio VIEJO (4 ms absolutos), como vara de progreso', () => {
    expect(msPorTick(mundoGrande(N))).toBeLessThan(TECHO)
  }, 300_000)

  /**
   * EL CRITERIO VIGENTE — ADR II-0007.
   *
   *   stepWorld ≤ 25% del presupuesto de tick
   *
   * Una fracción sobrevive a que cambie la frecuencia; un número en milisegundos
   * solo significa algo contra un presupuesto que hay que recordar. Y el 25%
   * deja tres cuartos del cuadro para percepción, mente, deltas de render y
   * chat: si `stepWorld` se los empieza a comer, esto salta.
   */
  it('el criterio VIGENTE: stepWorld entra en el 25% del tick', () => {
    const ms = msPorTick(mundoGrande(N))
    // Se imprime siempre, se afirma solo midiendo en serio: ver MIDIENDO_EN_SERIO.
    console.log(
      `\n  criterio II-0007 · ${N} cuerpos: ${num(ms)} ms de ${num(TICK_MS)} ` +
        `(${num((ms / TICK_MS) * 100, 1)}% del tick, techo ${num(FRACCION * 100, 0)}%)\n`,
    )
    if (!MIDIENDO_EN_SERIO) return
    expect(ms).toBeLessThan(TICK_MS * FRACCION)
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
        `  UNA lectura completa de cuerpo (12 qualityOf) .. ${num(lectura)} ms`,
        `  pero paso() ya no la hace entera: la lectura es perezosa y quedan`,
        `  ~13,6 lecturas de cualidad por cuerpo, de las 77 que hacía antes.`,
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

    // ─── POR QUÉ LOS NÚMEROS DE ARRIBA SE IMPRIMEN Y NO SE AFIRMAN ───────────
    //
    // Estas aserciones estaban acá y hacían que `pnpm ii:test` fallara de forma
    // intermitente. La causa no era el código: es que `pnpm -r test` corre los
    // cuatro paquetes EN PARALELO, y un banco que mide milisegundos midiendo
    // contra una máquina ocupada da cualquier cosa. Corriendo solo, lo que el
    // mundo agrega mide 1.20 ms; corriendo al lado de los otros, 7.80 ms. El
    // mismo código, seis veces peor.
    //
    // Un test de rendimiento adentro de la suite normal es un test flaky, y un
    // test flaky es peor que ninguno: enseña a ignorar el rojo. Las mediciones
    // se siguen imprimiendo en cada corrida —son informativas y son gratis— pero
    // solo se AFIRMAN cuando alguien pide medir de verdad:
    //
    //   pnpm ii:tick
    //
    // Ahí la máquina está tranquila y el número significa algo.
    if (!MIDIENDO_EN_SERIO) return

    // Lo único que este paquete controla, y lo controla: el mundo no le agrega
    // costo propio a la física. El presupuesto propio son 2 ms, la MITAD del
    // techo entero del criterio.
    expect(mundoSolo).toBeLessThan(2)
    // Y la física se lleva casi todo el tick.
    expect(leyes / tick).toBeGreaterThan(0.8)
    // LA CONCLUSIÓN VIEJA ERA: «una sola lectura de cuerpo ya se pasa del techo,
    // así que los 4 ms son inalcanzables aunque el mundo costara cero». Valía, y
    // ya no vale: la lectura bajó de 6,06 ms a menos de 4 y `paso()` dejó de
    // hacerla cinco veces. El test que la clavaba (`lectura > TECHO`) se cayó
    // solo, que es exactamente para lo que estaba puesto.
    //
    // La conclusión NUEVA, clavada igual: el trabajo sigue estando adentro de
    // `@anima/physics`, pero ya no por el costo de UNA lectura sino por el número
    // de cuerpos. No hay ningún renglón dominante — el perfil quedó plano— y por
    // eso la reparación que falta no es otra micro-optimización. Ver el `it.fails`
    // de arriba.
    expect(lectura).toBeLessThan(leyes)
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
