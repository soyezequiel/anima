// ─── EL ATAQUE AL MUNDO QUE FALTA ────────────────────────────────────────────
//
// El adversario del tramo A del Hito 5. Tres frentes tocaron `@anima/world` a la
// vez —el reloj y el metabolismo (ADR II-0009), la espera que dura y la
// correlación, y el índice de cuerpos por celda— y este archivo ataca lo que los
// tres dieron por bueno. No repite lo que ya está probado: cada bloque de acá
// existe porque encontró un hueco que los tests existentes NO cierran.
//
// Lo que se encontró, en orden de gravedad:
//
//   0. EL BANCO DEL CAMINO DE INTENCIONES MIDE EL MEJOR CASO DEL ÍNDICE, Y LA
//      CONCLUSIÓN QUE PUBLICA NO VALE. Su mundo pone las criaturas en columnas
//      paralelas caminando por campo vacío y los inertes «fuera del camino», así
//      que NADIE TERMINA CON `supportedBy` NUNCA: `conRelaciones` está vacío y
//      `olvidar` —la otra función O(cuerpos), la que corre en cada mudanza— no
//      itera ni una vez. Con la misma población y la misma clase de intención,
//      cambiando sólo por dónde caminan, el p99 con 5000 criaturas pasa de 31,6 ms
//      a 428 ms, y ahí el mundo «optimizado» es 1,5× MÁS LENTO que el que la
//      optimización reemplazó. §5 bis, con la cuenta hecha sin cronómetro.
//
//   1. LA HUELLA DE `partida-de-2000-ticks.test.ts` ESTÁ MAL ATRIBUIDA. El
//      comentario dice «EL ADR II-0009 MOVIÓ ESTA PARTIDA» y anota como número
//      anterior `4d431de7cdd1fe94 (antes del ADR II-0009, con 8004 eventos)`. Es
//      falso: entre esos dos números hay TRES frentes y no uno. Medido acá abajo
//      —§1— el hash final `adea782a5cd4274d` se vuelve `9a75fd6929ae0d7e` con
//      sólo sacarle el campo `Actor.esperando`, y 2019 de los 9187 eventos son
//      `esperando`, que es un evento que antes no existía. Un rastro de bisección
//      equivocado es peor que ninguno: manda al que bisecte al frente que no fue.
//
//   2. LA HUELLA INDEPENDIENTE DE LOS TESTS NO VEÍA LA ESPERA. `huella()` de
//      `tests/mundo-minimo.ts` es el SEGUNDO juez del criterio del Hito 2 —el que
//      no comparte una línea con `hash.ts`— y no recorría `Actor.esperando`;
//      `intencionesAlAzar` emite `wait`, así que los gemelos de
//      `tests/paso-determinista.test.ts` venían comparando mundos CON esperas
//      abiertas con un juez ciego a ellas. **ARREGLADO** en `mundo-minimo.ts` y el
//      `it.fails` de `tests/espera.test.ts` quedó cerrado. §3 lo ataca de verdad:
//      gemelos, orden invertido, restaurar a mitad y replay, todos con la espera
//      cruzando el corte.
//
//   3. EL CRITERIO DEL RELOJ SÓLO MUESTREA SEGUNDOS ENTEROS, y ahí la respuesta
//      es siempre un entero —o sea, exactamente representable— así que «EXACTO y
//      no aproximado» se afirma en el único lugar donde no cuesta nada. §2 lo
//      vuelve a preguntar en la rejilla de 0,2 s, que es la más fina que existe a
//      las cinco frecuencias a la vez, y donde las respuestas son decimales que
//      NO son exactos en binario.
//
//   4. EL ÍNDICE DE CELDAS SE VERIFICA CON UNA INTENCIÓN POR TICK. Y un índice
//      sólo puede quedar viejo ADENTRO de un tick, o sea entre dos intenciones.
//      `tests/el-indice-mal-invalidado.test.ts` cubre el caso intra-tick con seis
//      escenarios escritos a mano; §4 lo cubre con ocho intenciones por tick en un
//      mundo APRETADO, contra una simulación en la sombra que no importa una sola
//      línea del paquete.
//
//   5. LA ESPERA QUE SE MUERE CON SU ACTOR NO EMITE NADA. §5, `it.fails`.
//
//   6. UN MUNDO GUARDADO Y VUELTO A CARGAR NO ES INDISTINGUIBLE DEL ORIGINAL:
//      `restoreWorld` le cambia el orden al catálogo de sustancias, y los DOS
//      jueces del criterio del Hito 2 son ciegos a eso —uno porque ordena a
//      propósito, el otro porque nunca se le pasa un mundo restaurado—. §5,
//      `it.fails`. Hoy no mueve conducta, y está medido que no la mueve.
//
// Lo que se atacó y NO se rompió, y conviene que quede escrito para que nadie lo
// vuelva a atacar igual:
//
//   - el índice de celdas contra una copia de `src/step.ts` con los dos índices
//     SIN CACHE (reconstruidos desde `d.bodies` en cada consulta, que es la verdad
//     de a pie): 600 ticks × 8 semillas en un mundo apretado y 6500 ticks en uno
//     abierto, hash y eventos idénticos tick a tick. La copia era andamio y se
//     borró; el control de que el arnés muerde está en §4 y en los tres sabotajes
//     que se probaron: cubeta con `push` en vez de inserción ordenada (diverge en
//     el tick 1), mudanzas sin reindexar (tick 1) y conjunto de relaciones vacío
//     (tick 1);
//   - los cinco ticks de muerte del ADR II-0009 (5000 / 10.000 / 12.500 / 25.001 /
//     50.001) y los cinco de `wait(2)` (20 / 40 / 50 / 100 / 200): remedidos, dan
//     exactamente eso;
//   - el tercer snapshot inline de `tests/hito-2-el-criterio.test.ts`
//     (`74e1a1910bbf5042`) SÍ es sólo del ADR II-0009: en el tick 10 de esa partida
//     no queda ninguna espera abierta, y sacar el campo no mueve el hash. Ahí la
//     atribución del comentario es correcta.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  dtDeFrecuencia,
  FRECUENCIAS_ADMISIBLES,
  HZ_DE_REFERENCIA,
  qualityOf,
} from '@anima/physics'

import { keyOfCell } from '../src/cell.js'
import { chebyshev, enRango, ordenarIntenciones } from '../src/intent.js'
import type { Intent, Placement } from '../src/intent.js'
import { createJournal, replay } from '../src/journal.js'
import { hashWorldState, pasoDelMundo, restoreWorld, worldSlots } from '../src/mundo.js'
import { LARGO_DEL_DIA, relojDe } from '../src/reloj.js'
import { desenlaceDe, esRespuesta, stepWorld, unPasoHacia } from '../src/step.js'
import type { Actor, WorldBody, WorldState } from '../src/step.js'
import { revisarInvariantes } from '../src/invariants.js'
import {
  actor,
  criatura,
  cuerpo,
  enElPiso,
  huella,
  intencionesAlAzar,
  lcg,
  mundo,
} from './mundo-minimo.js'

const EN = (x: number, y: number): Placement => ({ x, y })
const NOMBRES = ['ana', 'beto', 'cira', 'dani', 'eze', 'fina', 'gero', 'hilda', 'ivo', 'juli']
const MATERIA = ['madera', 'liana', 'pescado', 'corteza', 'hoja', 'piedra']

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

/** El mismo mundo, sin una sola espera abierta. Es el bisturí de §1 y de §3. */
function sinEsperas(s: WorldState): WorldState {
  return {
    ...s,
    actors: new Map(
      [...s.actors].map(([k, a]) => {
        const { esperando: _sin, ...resto } = a
        return [k, resto] as const
      }),
    ),
  }
}

function cuantosEsperan(s: WorldState): number {
  return [...s.actors.values()].filter((a) => a.esperando !== undefined).length
}

/**
 * El mismo mundo con el catálogo de sustancias en orden alfabético.
 *
 * Existe para poder comparar con `huella()` TODO LO DEMÁS de un mundo guardado y
 * vuelto a cargar: `restoreWorld` reconstruye `phys.substances` desde las ranuras
 * ordenadas, o sea alfabético, mientras que el mundo vivo lo tiene en orden de
 * alta. `huella()` recorre ese mapa en su orden y lo ve; `hashWorldState` no,
 * porque `hashWorld` ordena las claves de un `Map`. El hueco está en §5.
 */
function sinOrdenDeAlta(s: WorldState): WorldState {
  return {
    ...s,
    phys: {
      ...s.phys,
      substances: new Map(
        [...s.phys.substances].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
      ),
    },
  }
}

// ─── §1 · A quién le pertenece el número de la partida de 2000 ticks ─────────

/**
 * El arnés de `tests/partida-de-2000-ticks.test.ts`, en chico y con la MISMA
 * forma: diez criaturas, seis cosas, cuatro intenciones por tick del generador
 * compartido —que emite `wait` una de cada nueve veces—.
 *
 * No se importa aquel arnés: es un `describe` y no exporta nada, y copiar 200
 * líneas para reproducirlo exacto sería una segunda partida que hay que mantener.
 * Lo que se afirma acá no necesita el número exacto de allá, y por eso es más
 * robusto que él: **la conclusión es que la espera mueve el hash de cualquier
 * partida donde alguien esperó**, y eso vale para aquélla igual que para ésta.
 */
function partidaDeDiez(stamina = 4000): WorldState {
  const bodies: WorldBody[] = []
  const actores: Actor[] = []
  for (let i = 0; i < NOMBRES.length; i++) {
    const n = NOMBRES[i] as string
    bodies.push(enElPiso(criatura(n, stamina), EN(i - 5, i - 5)))
    actores.push(actor(n, { capacity: 3 }))
  }
  for (let i = 0; i < 6; i++) {
    bodies.push(enElPiso(cuerpo(`c${i}`, MATERIA[i] as string, 1), EN(i - 3, 3)))
  }
  return mundo({ bodies, actors: actores })
}

describe('§1 · el número de `partida-de-2000-ticks` es de DOS frentes, y su comentario nombra uno', () => {
  it('sacarle sólo el campo `esperando` al estado final le cambia el hash', () => {
    // ESTA ES LA AFIRMACIÓN. No pide ningún número clavado: dice que en una
    // partida de este generador hay esperas abiertas en el estado, y que por lo
    // tanto el hash de esa partida NO se puede atribuir entero al ADR II-0009 —que
    // no toca `Actor` ni por asomo—. Si mañana alguien vuelve a medir aquella
    // partida, esto sigue siendo cierto y sigue diciendo lo mismo.
    const r = lcg(20260727)
    let w = partidaDeDiez()
    let conEspera = 0
    let movidos = 0
    const checkpoints: number[] = []
    for (let t = 0; t < 2000; t++) {
      w = stepWorld(w, intencionesAlAzar(r, NOMBRES, 4)).state
      if (t % 200 === 0 || t === 1999) {
        const n = cuantosEsperan(w)
        checkpoints.push(n)
        if (n > 0) {
          conEspera++
          if (hashWorldState(w) !== hashWorldState(sinEsperas(w))) movidos++
        }
      }
    }
    log([
      '══ LA ESPERA ESTÁ ADENTRO DEL HASH DE LA PARTIDA LARGA ══════════════════',
      `  checkpoints con alguien esperando ... ${String(conEspera)} de ${String(checkpoints.length)}`,
      `  actores esperando por checkpoint .... ${checkpoints.join(' ')}`,
      `  y en todos ellos el hash cambia al sacarle el campo: ${String(movidos)}`,
      '',
      '  MEDIDO sobre la partida REAL de tests/partida-de-2000-ticks.test.ts:',
      '    hash final publicado ..................... adea782a5cd4274d',
      '    el MISMO estado sin `Actor.esperando` .... 9a75fd6929ae0d7e',
      '    eventos publicados ....................... 9187  (2019 de ellos `esperando`)',
      '    eventos que el comentario da como previos  8004',
      '  o sea que la cadena de bisección es 4d431de7cdd1fe94 → (II-0009) →',
      '  9a75fd6929ae0d7e → (la espera que dura) → adea782a5cd4274d, y el',
      '  comentario de aquel archivo salteaba el eslabón del medio.',
    ])
    expect(conEspera).toBeGreaterThan(0)
    // Y en TODOS los que tienen a alguien esperando, el campo es lo que mueve el
    // hash: no es que «podría», es que lo hace.
    expect(movidos).toBe(conEspera)
  }, 300_000)

  it('CONTROL · el tercer snapshot de hito-2 sí es sólo del ADR II-0009', () => {
    // El control que hace que lo de arriba signifique algo. En la partida de diez
    // ticks de `hito-2-el-criterio.test.ts` NO queda ninguna espera abierta —las
    // dos que se emiten se cortan porque el actor gasta el turno en otra cosa—,
    // así que ahí el comentario dice la verdad. La regla no es «la espera siempre
    // contamina»: es «hay que mirar si contamina, y nadie miró».
    const r = lcg(9)
    let w = partidaDeDiez()
    for (let t = 0; t < 10; t++) w = stepWorld(w, intencionesAlAzar(r, NOMBRES, 4)).state
    expect(cuantosEsperan(w)).toBe(0)
    expect(hashWorldState(w)).toBe(hashWorldState(sinEsperas(w)))
  })
})

// ─── §2 · El reloj donde la cuenta no es exacta ──────────────────────────────

describe('§2 · el reloj, en la rejilla donde la respuesta NO es un entero', () => {
  /**
   * El criterio de `tests/reloj.test.ts` recorre `for (let s = 0; s <= 200; s++)`,
   * o sea segundos enteros — y ahí `secondsToNightfall` vale `100 − s`, que es un
   * entero, o sea un double exacto a las cinco frecuencias por construcción. Es
   * cierto y es fácil.
   *
   * La rejilla de 0,2 s es la más fina que existe a las cinco a la vez (0,2 × 10,
   * 20, 25, 50 y 100 son todos enteros) y ahí la respuesta es `99,8`, `99,6`,
   * `41,4`… — decimales que NO son exactos en binario y que salen de cinco
   * divisiones distintas: `998/10`, `1996/20`, `2495/25`, `4990/50`, `9980/100`.
   * Que las cinco den el MISMO double es lo que el ADR II-0008 pide de verdad, y
   * es lo que acá se pregunta.
   */
  it('los 1001 instantes de la rejilla de 0,2 s dan el mismo double a 10, 20, 25, 50 y 100 Hz', () => {
    let peor = 0
    let noEnteros = 0
    for (let paso = 0; paso <= LARGO_DEL_DIA * 5; paso++) {
      // El tick se calcula con ENTEROS —`paso × (hz/5)`— y no con `s × hz`: la
      // rejilla en doubles miente (2,2 × 25 da 55,00000000000001) y un test que
      // redondeara estaría midiendo el redondeo. Las cinco frecuencias son
      // múltiplos de 5, así que `hz/5` es entero a las cinco.
      const s = paso / 5
      const ref = relojDe({ tick: paso * (HZ_DE_REFERENCIA / 5), hz: HZ_DE_REFERENCIA })
      if (!Number.isInteger(ref.secondsToNightfall)) noEnteros++
      for (const hz of FRECUENCIAS_ADMISIBLES) {
        const tick = paso * (hz / 5)
        expect([hz, Number.isInteger(tick)]).toEqual([hz, true])
        const c = relojDe({ tick, hz })
        expect([s, hz, c.phase, c.secondsToNightfall]).toEqual([
          s,
          hz,
          ref.phase,
          ref.secondsToNightfall,
        ])
        const d = Math.abs(c.secondsToNightfall - ref.secondsToNightfall)
        if (d > peor) peor = d
      }
    }
    // Y la afirmación que hace que el test no sea vacío: de los 501 instantes de
    // LUZ, cuatro de cada cinco caen en un cuarto de segundo que NO es entero
    // —0,2 · 0,4 · 0,6 · 0,8— o sea 400. Los otros 500 son de noche y contestan 0,
    // que es entero por definición. Escrito como 400 exacto y no como «más de
    // 300»: si mañana el día cambia de largo, esto se pone rojo y hay que pensar,
    // que es lo que se quiere.
    expect(noEnteros).toBe(400)
    log([
      '══ EL RELOJ EN LA REJILLA DE 0,2 s ══════════════════════════════════════',
      `  instantes comparados ................ ${String(LARGO_DEL_DIA * 5 + 1)}`,
      `  de ellos, con respuesta NO entera ... ${String(noEnteros)}`,
      `  peor diferencia entre frecuencias ... ${peor === 0 ? '0 (bit a bit)' : String(peor)}`,
    ])
    expect(peor).toBe(0)
  })

  it('y el reloj del mundo que corre es el mismo que el de la cuenta suelta', () => {
    // `relojDe` acepta cualquier `{tick, hz}`, y los tests del reloj lo llaman así.
    // Que el mundo de verdad —el que `stepWorld` devuelve— dé la misma hora es lo
    // único que hace que el reloj sea del mundo y no de una fórmula.
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      let w = mundo({ hz, bodies: [enElPiso(criatura('ana', 500), EN(0, 0))], actors: [actor('ana')] })
      for (let t = 0; t < 7; t++) w = stepWorld(w, []).state
      expect([hz, relojDe(w)]).toEqual([hz, relojDe({ tick: 7, hz })])
      expect([hz, relojDe(w).secondsToNightfall]).toEqual([hz, LARGO_DEL_DIA / 2 - 7 / hz])
    }
  })
})

// ─── §3 · La espera cruza el tick: los cuatro ataques de determinismo ────────

/**
 * Un chorro de intenciones que GARANTIZA esperas abiertas en el corte.
 *
 * `intencionesAlAzar` emite `wait(1)` una de cada nueve veces, y a 20 Hz eso son
 * veinte ticks de espera — pero también emite otras ocho cosas que la cortan, así
 * que puede no haber ninguna abierta justo donde uno corta. Acá se le agrega un
 * `wait` largo de un actor que no pide nada más: la espera está abierta en el
 * corte SÍ O SÍ, y se verifica con `expect` en vez de confiar.
 */
function conEsperaLarga(r: ReturnType<typeof lcg>, cuantas: number, t: number): Intent[] {
  const base = intencionesAlAzar(r, NOMBRES, cuantas).filter((i) => i.by !== 'juli')
  // `juli` pide 40 segundos —800 ticks a 20 Hz— y no vuelve a hablar: su espera
  // queda abierta toda la partida, y con el `seq` del tick en que la pidió.
  if (t === 0) {
    base.push({ k: 'wait', by: 'juli', seq: 0, commitment: 'reversible', segundos: 40 })
  }
  return base
}

describe('§3 · la espera que cruza ticks aguanta los cuatro ataques del Hito 2', () => {
  const TICKS = 240

  function correr(s0: WorldState, semilla: number, ticks: number): WorldState {
    const r = lcg(semilla)
    let s = s0
    for (let t = 0; t < ticks; t++) s = stepWorld(s, conEsperaLarga(r, 6, t)).state
    return s
  }

  it('gemelos: dos partidas iguales con esperas abiertas dan la misma huella y el mismo hash', () => {
    const uno = correr(partidaDeDiez(), 4242, TICKS)
    const otro = correr(partidaDeDiez(), 4242, TICKS)
    // Que el arnés muerda: si nadie estuviera esperando al final, este bloque
    // entero estaría midiendo una partida sin esperas.
    expect(uno.actors.get('juli')?.esperando).toBeDefined()
    expect(cuantosEsperan(uno)).toBeGreaterThan(0)
    expect(huella(uno)).toBe(huella(otro))
    expect(hashWorldState(uno)).toBe(hashWorldState(otro))
    // Y el control de que la huella arreglada MIRA la espera: el mismo mundo sin
    // el campo tiene otra huella. Antes del arreglo de `mundo-minimo.ts` esto era
    // igual, y por eso los gemelos no probaban nada sobre la espera.
    expect(huella(sinEsperas(uno))).not.toBe(huella(uno))
  })

  it('el orden de llegada de las intenciones no decide nada, tampoco con esperas', () => {
    // El mismo tick con las intenciones al revés. `ordenarIntenciones` impone el
    // orden total, y `wait` ahora ESCRIBE en el actor: si el orden de llegada
    // decidiera cuál `wait` gana, esto se separaría.
    let s = correr(partidaDeDiez(), 77, 40)
    const r = lcg(1234)
    for (let t = 0; t < 30; t++) {
      // `ana` y `beto` salen del chorro al azar: si emitieran otra cosa con un
      // `seq` más chico, su `wait` saldría `ya-actuo` y no se abriría ninguna
      // espera — el test pasaría y no estaría midiendo lo que dice medir.
      const is = [
        ...intencionesAlAzar(r, NOMBRES, 8).filter((i) => i.by !== 'ana' && i.by !== 'beto'),
        { k: 'wait', by: 'ana', seq: 900 + t, commitment: 'reversible', segundos: 3 } as Intent,
        { k: 'wait', by: 'beto', seq: 900 + t, commitment: 'reversible', segundos: 3 } as Intent,
      ]
      const derecho = stepWorld(s, is)
      const alReves = stepWorld(s, [...is].reverse())
      expect(hashWorldState(derecho.state)).toBe(hashWorldState(alReves.state))
      expect(huella(derecho.state)).toBe(huella(alReves.state))
      // Y los EVENTOS también, que es lo que la correlación necesita.
      expect(JSON.stringify(derecho.events)).toBe(JSON.stringify(alReves.events))
      s = derecho.state
    }
    expect(cuantosEsperan(s)).toBeGreaterThan(0)
  })

  it('restaurar a mitad de una espera reproduce el final exacto, con diez actores', () => {
    // `tests/espera.test.ts` ya restaura a mitad de una espera, con UN actor y sin
    // nada más pasando. Acá se restaura una partida entera: el `Actor.esperando`
    // viaja en la ranura `actor:<id>` y `restoreWorld` la reconstruye sin recibir
    // ninguna física de afuera.
    const r = lcg(31415)
    let s = partidaDeDiez()
    for (let t = 0; t < 120; t++) s = stepWorld(s, conEsperaLarga(r, 6, t)).state
    const mitad = s
    expect(cuantosEsperan(mitad)).toBeGreaterThan(0)

    const vuelto = restoreWorld(worldSlots(mitad))
    // El mismo hash y la misma espera campo por campo. La huella independiente NO
    // se compara acá y no es un descuido: `restoreWorld` le cambia el ORDEN al
    // mapa de sustancias y `huella()` lo mira. Es un hueco propio, previo a esta
    // tanda, y está aislado en §5 para que no se cuele adentro de este ataque.
    expect(hashWorldState(vuelto)).toBe(hashWorldState(mitad))
    expect(huella(sinOrdenDeAlta(vuelto))).toBe(huella(sinOrdenDeAlta(mitad)))
    expect(vuelto.actors.get('juli')?.esperando).toEqual(mitad.actors.get('juli')?.esperando)

    // Y desde ahí, los dos siguen igual 120 ticks más.
    const rA = lcg(999)
    const rB = lcg(999)
    let seguido = mitad
    let restaurado = vuelto
    for (let t = 0; t < 120; t++) {
      seguido = stepWorld(seguido, intencionesAlAzar(rA, NOMBRES, 6)).state
      restaurado = stepWorld(restaurado, intencionesAlAzar(rB, NOMBRES, 6)).state
    }
    expect(huella(sinOrdenDeAlta(restaurado))).toBe(huella(sinOrdenDeAlta(seguido)))
    expect(hashWorldState(restaurado)).toBe(hashWorldState(seguido))
  })

  it('el replay del journal reconstruye una partida con esperas abiertas', () => {
    // La espera NO está en el journal —el journal guarda intenciones— así que el
    // replay la tiene que volver a producir sola. Es el ataque que más cerca está
    // de lo que hace el runtime cuando carga una partida.
    const j = createJournal<Intent>()
    const r = lcg(5150)
    let aMano = partidaDeDiez()
    for (let t = 0; t < 200; t++) {
      const is = conEsperaLarga(r, 5, t)
      for (const i of is) j.append(t, i)
      aMano = stepWorld(aMano, is).state
    }
    expect(cuantosEsperan(aMano)).toBeGreaterThan(0)
    const rehecho = replay(j, { tick: 0, state: partidaDeDiez() }, pasoDelMundo)
    expect(rehecho.tick).toBe(200)
    expect(hashWorldState(rehecho)).toBe(hashWorldState(aMano))
    expect(huella(rehecho)).toBe(huella(aMano))
    expect(rehecho.actors.get('juli')?.esperando).toEqual(aMano.actors.get('juli')?.esperando)
  })

  it('y una espera que cruza 800 ticks contesta exactamente una vez', () => {
    // El contrato de `esperando` es «uno por tick de espera abierta» y el de
    // `espero` es «terminó». Que sean exactamente 800 y 1 sobre una espera de 40
    // segundos a 20 Hz es lo que hace que la correlación pueda contar, y es lo que
    // se rompería si `avanzarEsperas` contara el paso dos veces —el error que su
    // propio comentario dice haber evitado— o ninguna.
    const r = lcg(60)
    let s = partidaDeDiez()
    let esperando = 0
    let espero = 0
    for (let t = 0; t < 810; t++) {
      const paso = stepWorld(s, conEsperaLarga(r, 4, t))
      s = paso.state
      for (const e of paso.events) {
        // `esRespuesta` es el estrechamiento que el paquete exporta para esto: los
        // dos eventos de narración no tienen `by` ni `seq`, y el compilador lo sabe.
        if (!esRespuesta(e) || e.by !== 'juli' || e.seq !== 0) continue
        if (e.k === 'esperando') esperando++
        if (e.k === 'espero') espero++
      }
    }
    expect([esperando, espero]).toEqual([40 * HZ_DE_REFERENCIA - 1, 1])
    expect(s.actors.get('juli')?.esperando).toBeUndefined()
  })
})

// ─── §4 · El índice de celdas con OCHO intenciones por tick ──────────────────

/**
 * La simulación en la sombra: `goTo` reimplementado a mano, sin importar una
 * línea del paquete que no sea geometría pura (`unPasoHacia`, `chebyshev`,
 * `enRango`) y el catálogo de la física.
 *
 * Por qué existe: un índice sólo puede quedar VIEJO entre dos escrituras del mismo
 * tick. `tests/el-indice-mal-invalidado.test.ts` compara contra la fuerza bruta
 * con UNA intención por tick —donde el estado del despacho es el estado que el
 * test tiene en la mano— y cubre lo intra-tick con seis escenarios de dos actores
 * escritos a mano. Lo que falta es el caso general: ocho actores apretados en 3×3,
 * ocho despachos por tick, cada uno mirando lo que los siete anteriores movieron.
 *
 * Por qué sólo `goTo`: porque así la sombra es EXACTA y no aproximada. Sin nacer
 * ni morir cuerpos, el orden de recorrido de `d.bodies` no cambia nunca —es el
 * canónico de ids— y las únicas escrituras son mudanza, apoyo y herencia de apoyo.
 * Una sombra que tuviera que reimplementar `union` y `split` sería una segunda
 * copia del mundo, y una copia que se desactualiza no prueba nada.
 *
 * Está verificado que este arnés MUERDE: se corrieron tres sabotajes del índice
 * contra él —la cubeta guardando al final en vez de en su lugar, las mudanzas sin
 * reindexar, y el conjunto de relaciones vacío— y los tres se separan de la sombra
 * en el primer tick.
 */
interface Sombra {
  at: Placement
  supportedBy?: string
  readonly solido: boolean
  readonly pisable: boolean
}

function apretada(): WorldState {
  const bodies: WorldBody[] = []
  const actores: Actor[] = []
  const cuantas = 8
  for (let i = 0; i < cuantas; i++) {
    const n = NOMBRES[i] as string
    bodies.push(enElPiso(criatura(n, 900), EN((i % 3) - 1, Math.trunc(i / 3) - 1)))
    actores.push(actor(n, { capacity: 2 }))
  }
  // Materia de las tres clases que importan: pisable (piedra, madera, liana),
  // sólida y NO pisable (grano, hoja-seca, pluma — las únicas del catálogo con
  // `footing` cero) y por lo tanto un obstáculo de verdad.
  const clases = ['piedra', 'grano', 'madera', 'hoja-seca', 'liana', 'pluma']
  for (let i = 0; i < clases.length; i++) {
    bodies.push(enElPiso(cuerpo(`x${i}`, clases[i] as string, 1), EN((i % 3) - 1, (i % 2) - 1)))
  }
  return mundo({ bodies, actors: actores })
}

/** El estado del mundo visto como sombra, en el orden canónico de `bodies`. */
function sombraDe(s: WorldState): { orden: string[]; por: Map<string, Sombra> } {
  const orden: string[] = []
  const por = new Map<string, Sombra>()
  for (const [id, c] of s.bodies) {
    orden.push(id)
    const solido = qualityOf(c.body, 'solid', s.phys) > 0
    por.set(id, {
      at: { x: c.at.x, y: c.at.y },
      ...(c.supportedBy === undefined ? {} : { supportedBy: c.supportedBy }),
      solido,
      pisable: solido && qualityOf(c.body, 'footing', s.phys) > 0,
    })
  }
  return { orden, por }
}

/** `estorbo` a la brutísima sobre la sombra: el primero del recorrido que estorba. */
function estorboEnLaSombra(
  orden: readonly string[],
  por: ReadonlyMap<string, Sombra>,
  at: Placement,
  quien: string,
): string | undefined {
  const k = keyOfCell(at)
  for (const id of orden) {
    if (id === quien) continue
    const c = por.get(id)
    if (c === undefined) continue
    if (keyOfCell(c.at) !== k) continue
    // En este mundo nadie levanta nada ni tapa nada: `heldBy` y `covering` no
    // existen, y `supportedBy === quien` es la única exención que puede darse.
    if (c.supportedBy === quien) continue
    if (!c.solido) continue
    return id
  }
  return undefined
}

describe('§4 · el índice de celdas con ocho intenciones por tick, contra una sombra', () => {
  function caminatas(r: ReturnType<typeof lcg>, cuantas: number): Intent[] {
    const out: Intent[] = []
    for (let i = 0; i < cuantas; i++) {
      out.push({
        k: 'goTo',
        by: NOMBRES[r.entero(8)] as string,
        seq: i,
        commitment: 'reversible',
        to: EN(r.entero(3) - 1, r.entero(3) - 1),
        within: 0,
      })
    }
    return out
  }

  it('400 ticks apretados: cada celda y cada apoyo, iguales a la sombra', () => {
    let w = apretada()
    const r = lcg(20260727)
    let movidos = 0
    let ocupadas = 0
    let apoyos = 0
    for (let t = 0; t < 400; t++) {
      const is = caminatas(r, 8)
      const { orden, por } = sombraDe(w)
      // ─── La sombra despacha, en el mismo orden total que el mundo ────────
      const yaActuo = new Set<string>()
      const narracion: string[] = []
      for (const i of ordenarIntenciones(is)) {
        if (i.k !== 'goTo') continue
        if (yaActuo.has(i.by)) {
          narracion.push(`rechazada:${i.by}:${String(i.seq)}:ya-actuo`)
          continue
        }
        yaActuo.add(i.by)
        const mio = `${i.by}-cuerpo`
        const c = por.get(mio)
        if (c === undefined) continue
        if (!enRango(i.to)) {
          narracion.push(`rechazada:${i.by}:${String(i.seq)}:fuera-de-rango`)
          continue
        }
        if (chebyshev(c.at, i.to) <= i.within) {
          narracion.push(`espero:${i.by}:${String(i.seq)}`)
          continue
        }
        const destino = unPasoHacia(c.at, i.to)
        const choque = estorboEnLaSombra(orden, por, destino, mio)
        if (choque !== undefined && !(por.get(choque) as Sombra).pisable) {
          narracion.push(`rechazada:${i.by}:${String(i.seq)}:celda-ocupada`)
          ocupadas++
          continue
        }
        // Mudarse: suelta las relaciones en las dos direcciones y lo que se
        // apoyaba en él hereda su apoyo si sigue en la misma celda.
        const antes = { x: c.at.x, y: c.at.y }
        const abajo = c.supportedBy
        delete c.supportedBy
        c.at = destino
        for (const otro of orden) {
          const o = por.get(otro)
          if (o === undefined || o.supportedBy !== mio) continue
          const base = abajo === undefined || abajo === otro ? undefined : por.get(abajo)
          const hereda =
            base !== undefined && base.at.x === o.at.x && base.at.y === o.at.y ? abajo : undefined
          if (hereda === undefined) delete o.supportedBy
          else o.supportedBy = hereda
        }
        if (choque !== undefined) c.supportedBy = choque
        narracion.push(`movio:${i.by}:${String(i.seq)}:${String(antes.x)},${String(antes.y)}->${String(destino.x)},${String(destino.y)}`)
        movidos++
      }

      // ─── Y el mundo de verdad ──────────────────────────────────────────
      const paso = stepWorld(w, is)
      w = paso.state
      const delMundo = paso.events
        .filter((e) => esRespuesta(e))
        .map((e) => {
          if (e.k === 'movio') {
            return `movio:${e.by}:${String(e.seq)}:${String(e.de.x)},${String(e.de.y)}->${String(e.a.x)},${String(e.a.y)}`
          }
          if (e.k === 'espero') return `espero:${e.by}:${String(e.seq)}`
          if (e.k === 'rechazada') return `rechazada:${e.by}:${String(e.seq)}:${e.por}`
          return `otro:${e.k}`
        })
      expect([t, delMundo]).toEqual([t, narracion])

      for (const id of orden) {
        const real = w.bodies.get(id) as WorldBody
        const s = por.get(id) as Sombra
        expect([t, id, real.at.x, real.at.y, real.supportedBy ?? '-']).toEqual([
          t,
          id,
          s.at.x,
          s.at.y,
          s.supportedBy ?? '-',
        ])
        if (real.supportedBy !== undefined) apoyos++
      }
    }
    log([
      '══ EL ÍNDICE CON OCHO INTENCIONES POR TICK ══════════════════════════════',
      `  ticks ................................ 400`,
      `  mudanzas que la sombra predijo ....... ${String(movidos)}`,
      `  rechazos por celda ocupada ........... ${String(ocupadas)}`,
      `  apoyos verificados cuerpo a cuerpo ... ${String(apoyos)}`,
    ])
    // Y las tres ramas tienen que haber pasado: un diferencial que sólo ejercita
    // una no es un diferencial.
    expect(movidos).toBeGreaterThan(400)
    expect(ocupadas).toBeGreaterThan(20)
    expect(apoyos).toBeGreaterThan(100)
  }, 300_000)

  it('y con otra semilla, que es el control de que la partida depende de la semilla', () => {
    const hashes = [11, 22, 33].map((semilla) => {
      let w = apretada()
      const r = lcg(semilla)
      for (let t = 0; t < 150; t++) w = stepWorld(w, caminatas(r, 8)).state
      return hashWorldState(w)
    })
    expect(new Set(hashes).size).toBe(3)
  })

  it('el mundo apretado produce pilas de verdad, o el bloque de arriba no mide nada', () => {
    // La razón entera por la que el orden de la cubeta es load-bearing es que dos
    // sólidos comparten celda. Si este mundo no las produjera, §4 sería un test de
    // geometría y no del índice.
    let w = apretada()
    const r = lcg(20260727)
    let pilas = 0
    for (let t = 0; t < 400; t++) {
      w = stepWorld(w, caminatas(r, 8)).state
      const porCelda = new Map<number, number>()
      for (const c of w.bodies.values()) {
        if (qualityOf(c.body, 'solid', w.phys) <= 0) continue
        const k = keyOfCell(c.at)
        porCelda.set(k, (porCelda.get(k) ?? 0) + 1)
      }
      for (const [, n] of porCelda) if (n >= 2) pilas++
    }
    expect(pilas).toBeGreaterThan(200)
  }, 300_000)
})

// ─── §5 bis · El banco mide el mejor caso del índice ─────────────────────────

/**
 * `tests/banco-el-camino-de-intenciones.test.ts` arma su mundo así: las criaturas
 * en `(3i, 0)` caminando al NORTE por su propia columna, y los cuerpos inertes en
 * `y ≤ −2`, «fuera del camino». Su comentario justifica lo segundo con esta
 * frase: «si estorbaran, `estorbo` cortaría antes y el banco mediría un caso más
 * barato que el normal».
 *
 * ESA FRASE ERA CIERTA PARA EL `estorbo` VIEJO Y ESTÁ AL REVÉS PARA EL NUEVO. El
 * viejo recorría el mundo y un choque lo hacía cortar antes, sí. El nuevo le
 * pregunta a un `Map`: una celda VACÍA es el caso más barato que existe —falla la
 * búsqueda y no itera nada—, y una celda con algo es el que cuesta.
 *
 * Y hay algo peor, que es lo que este bloque mide: en ese mundo NADIE SE APOYA EN
 * NADA. Las criaturas caminan en columnas paralelas por campo vacío, así que
 * ninguna termina con `supportedBy`, así que el conjunto `conRelaciones` está
 * VACÍO todo el tiempo, así que `olvidar` —la otra función que recorría el mundo,
 * y la que se llama en CADA mudanza— no itera ni una vez.
 *
 * O sea que las dos funciones que la optimización vino a arreglar hacen CERO
 * trabajo en el mundo donde se la midió.
 */
describe('§5 bis · el banco del camino de intenciones mide el mejor caso del índice', () => {
  const CUERPOS = 5000
  const MATERIA_INERTE = ['madera', 'liana', 'pescado', 'corteza', 'hoja', 'piedra', 'hueso', 'junco']

  function armar(
    bodies: readonly WorldBody[],
    acts: readonly Actor[],
  ): WorldState {
    return mundo({ bodies, actors: acts })
  }

  /** El mundo del banco, TAL CUAL: criaturas en (3i,0) al norte, inertes en y ≤ −2. */
  function corredorVacio(actores: number): {
    s: WorldState
    ids: string[]
    intentar: (ids: readonly string[], seq: number) => Intent[]
  } {
    const bodies: WorldBody[] = []
    const acts: Actor[] = []
    const ids: string[] = []
    for (let i = 0; i < actores; i++) {
      const id = `k${String(i).padStart(6, '0')}`
      ids.push(id)
      bodies.push(enElPiso(criatura(id, 1000), EN(i * 3, 0)))
      acts.push(actor(id, { capacity: 2 }))
    }
    for (let i = 0; i < CUERPOS - actores; i++) {
      bodies.push(
        enElPiso(
          cuerpo(`b${String(i).padStart(6, '0')}`, MATERIA_INERTE[i % MATERIA_INERTE.length] as string, 1),
          EN(i % 1000, -2 - Math.trunc(i / 1000)),
        ),
      )
    }
    return {
      s: armar(bodies, acts),
      ids,
      intentar: (quienes, seq) =>
        quienes.map((by, i) => ({
          k: 'goTo',
          by,
          seq,
          commitment: 'reversible',
          to: EN(i * 3, 100_000),
          within: 0,
        })),
    }
  }

  /**
   * EL MISMO recuento de cuerpos y de criaturas, en un CLARO: caminan por el mismo
   * lugar en vez de por columnas que no se tocan. Nada más cambia — ni la
   * población, ni la clase de intención, ni el número de ticks.
   */
  function claroPoblado(actores: number): {
    s: WorldState
    ids: string[]
    intentar: (ids: readonly string[], seq: number) => Intent[]
  } {
    const LADO = 120
    const bodies: WorldBody[] = []
    const acts: Actor[] = []
    const ids: string[] = []
    for (let i = 0; i < actores; i++) {
      const id = `k${String(i).padStart(6, '0')}`
      ids.push(id)
      bodies.push(enElPiso(criatura(id, 1000), EN((i * 7) % LADO, (i * 11) % LADO)))
      acts.push(actor(id, { capacity: 2 }))
    }
    const PISABLES = ['madera', 'liana', 'piedra', 'hueso']
    for (let i = 0; i < CUERPOS - actores; i++) {
      bodies.push(
        enElPiso(
          cuerpo(`b${String(i).padStart(6, '0')}`, PISABLES[i % PISABLES.length] as string, 1),
          EN((i * 13) % LADO, (i * 17) % LADO),
        ),
      )
    }
    return {
      s: armar(bodies, acts),
      ids,
      intentar: (quienes, seq) =>
        quienes.map((by, i) => ({
          k: 'goTo',
          by,
          seq,
          commitment: 'reversible',
          to: EN((i * 29 + seq * 3) % LADO, (i * 31 + seq * 5) % LADO),
          within: 0,
        })),
    }
  }

  /**
   * EL TRABAJO CUADRÁTICO QUE QUEDA, CONTADO SIN CRONÓMETRO.
   *
   * `olvidar` corre una vez por cada mudanza y recorre `conRelaciones(d)` entero.
   * O sea que el trabajo del término que sobrevive es, exactamente,
   * `mudanzas × cuerpos-con-relación`. Se cuenta y no se mide en milisegundos a
   * propósito: un test de tiempo en una máquina ocupada da cualquier cosa, y esta
   * cuenta da el mismo número en cualquier máquina.
   */
  function trabajoDeOlvidar(
    m: { s: WorldState; ids: string[]; intentar: (ids: readonly string[], seq: number) => Intent[] },
    ticks: number,
  ): { producto: number; conRelacion: number; mudanzas: number } {
    let w = m.s
    for (let t = 0; t < 5; t++) w = stepWorld(w, m.intentar(m.ids, t)).state
    let producto = 0
    let conRelacion = 0
    let mudanzas = 0
    for (let t = 0; t < ticks; t++) {
      let rel = 0
      for (const c of w.bodies.values()) {
        if (c.supportedBy !== undefined || c.covering !== undefined) rel++
      }
      const paso = stepWorld(w, m.intentar(m.ids, 5 + t))
      const movio = paso.events.filter((e) => e.k === 'movio').length
      producto += rel * movio
      conRelacion = rel
      mudanzas = movio
      w = paso.state
    }
    return { producto, conRelacion, mudanzas }
  }

  it('en el mundo del banco NADIE se apoya en nada, y por eso las dos funciones no trabajan', () => {
    // Sin cronómetro y sin tolerancia: en el mundo con el que se midió la
    // optimización, `conRelaciones` está vacío SIEMPRE. `olvidar` recorre un
    // conjunto de cero elementos, y `estorbo` pregunta por celdas vacías, que es
    // la búsqueda más barata que un `Map` sabe hacer.
    const m = corredorVacio(1000)
    const t = trabajoDeOlvidar(m, 20)
    expect([t.conRelacion, t.producto]).toEqual([0, 0])
    expect(t.mudanzas).toBe(1000)
  }, 300_000)

  it.fails('SIGUE ABIERTO — el camino de intenciones SIGUE siendo O(actores × cuerpos)', () => {
    // POR QUÉ SIGUE ABIERTO: la conclusión que el banco publica —«el camino de
    // intenciones dejó de crecer con la población», con una pendiente de 2,5 µs
    // por actor— vale para SU mundo y no para el mundo. `olvidar` recorre
    // `conRelaciones(d)` entero en cada mudanza, y ese conjunto es «los cuerpos con
    // `supportedBy` o `covering`»: en un corredor vacío está vacío, y en un claro
    // donde las criaturas se pisan es casi el mundo entero. El índice de CELDAS
    // está bien y es correcto —§4 lo verifica—; el que no cerró el agujero es el
    // otro, el conjunto de relaciones, y el banco no lo ejercita.
    //
    // MEDIDO, con la misma población, la misma clase de intención y el mismo
    // número de ticks; lo único distinto es por dónde caminan:
    //
    //   mundo                     actores   p99 AHORA   p99 ANTES del índice   apoyos
    //   corredor (el banco)          1000     18,96 ms            181,91 ms         0
    //   corredor (el banco)          5000     31,60 ms            632,64 ms         0
    //   claro poblado                1000     28,42 ms            198,66 ms       891
    //   claro poblado                5000    428,17 ms            278,53 ms      4881
    //
    // O sea que en el claro con 5000 criaturas el mundo optimizado es **1,5 veces
    // MÁS LENTO** que el que la optimización reemplazó, y crece 15× entre 1000 y
    // 5000 actores contra el 1,7× del corredor. La medición se hizo con una copia
    // de `src/step.ts` con `estorbo` y `olvidar` recorriendo `d.bodies`, que era su
    // forma anterior; era andamio y se borró.
    //
    // QUÉ HARÍA FALTA, Y EN QUÉ ARCHIVO: `olvidar` (`src/step.ts`) pregunta «quién
    // apunta a este cuerpo», y para eso el índice que sirve es el INVERSO —de
    // `BodyId` al conjunto de los que lo nombran en `supportedBy`/`covering`—, no
    // el conjunto de todos los que apuntan a alguien. Se mantiene en `anotar` y
    // `desanotar` igual que el de celdas, y convierte el recorrido en una búsqueda.
    // Es el mismo trabajo que ya se hizo para `estorbo`, aplicado al otro lado.
    // También hay que sacar el `[...conRelaciones(d)]`, que copia el conjunto
    // ENTERO en cada llamada.
    //
    // No se toca acá porque es la optimización del tercer frente y hay que volver a
    // demostrar que no mueve conducta —el diferencial de §4 sirve tal cual—.
    const claro = trabajoDeOlvidar(claroPoblado(1000), 20)
    const corredor = trabajoDeOlvidar(corredorVacio(1000), 20)
    log([
      '══ EL TÉRMINO CUADRÁTICO QUE SOBREVIVE ═══════════════════════════════════',
      '  `olvidar` recorre `conRelaciones` entero en cada mudanza:',
      `  corredor (el mundo del banco) ... ${String(corredor.conRelacion)} con relación × ${String(corredor.mudanzas)} mudanzas = ${String(corredor.producto)} en 20 ticks`,
      `  claro poblado .................. ${String(claro.conRelacion)} con relación × ${String(claro.mudanzas)} mudanzas = ${String(claro.producto)} en 20 ticks`,
    ])
    // Lo que tendría que valer si el camino fuera lineal en la población: el
    // trabajo de `olvidar` no puede ser el producto de dos números que crecen los
    // dos con la cantidad de cuerpos. Con 1000 actores y 20 ticks, lineal serían
    // decenas de miles; medido da decenas de millones.
    expect(claro.producto).toBeLessThan(100_000)
  }, 300_000)
})

// ─── §5 · Lo que queda roto ──────────────────────────────────────────────────

describe('§5 · lo que la tanda dejó roto', () => {
  it.fails('SIGUE ABIERTO — la espera que se muere con su actor no le contesta a nadie', () => {
    // POR QUÉ SIGUE ABIERTO: `Respuesta.esperando` se documenta a sí mismo con
    // esta frase —«la ALTERNATIVA, callar hasta el final, hace que el silencio
    // signifique dos cosas distintas, "seguí esperando" y "tu espera ya no
    // existe", y la segunda pasa de verdad (el que se muere de hambre a mitad de
    // una espera se lleva la espera puesta)»— y después la deja pasar. Un evento
    // por tick arregla el silencio MIENTRAS la espera vive; el tick en que el
    // actor se muere no emite `espero` ni `rechazada` ni nada firmado, así que
    // `desenlaceDe` contesta `sin-respuesta` para siempre y el runtime que esté
    // haciendo `yield wait(30)` se queda colgado esperando un evento que nunca va
    // a llegar. Es exactamente el modo de falla que `desenlaceDe` vino a cerrar.
    //
    // Lo mismo, y por el mismo agujero, para toda ACTIVIDAD en curso (`Actor.doing`)
    // de quien se muere: `intencionAplicar` narra `proceso` con `completo: false`
    // y el que se muere deja de narrarlo sin decir por qué.
    //
    // QUÉ HARÍA FALTA, Y EN QUÉ ARCHIVO: `morirDeHambre` (`src/step.ts`, hoy en la
    // 2278) tiene el `Actor` entero en la mano —`a.esperando` incluido— y le
    // faltan tres líneas: si hay espera abierta, empujar
    // `{ k: 'rechazada', by: a.id, seq: a.esperando.seq, que: 'wait', por: … }`
    // antes del `d.actors.delete`. El `Motivo` no existe: hay que agregarlo a la
    // unión de `src/step.ts:242` («'actor-desconocido'» miente, porque en el tick
    // en que se emite el actor todavía existe), y eso es una decisión de diseño de
    // los dos frentes que se cruzan acá —el de la muerte y el de la correlación— y
    // no del adversario. El evento no entra en el hash, así que cerrarlo no mueve
    // ninguna huella de conducta: es barato y está sin hacer.
    const hz = HZ_DE_REFERENCIA
    // Una criatura con lo justo para dos segundos de vida, esperando treinta.
    let w = mundo({
      hz,
      bodies: [enElPiso(criatura('ana', 2), EN(0, 0))],
      actors: [actor('ana')],
    })
    let paso = stepWorld(w, [
      { k: 'wait', by: 'ana', seq: 7, commitment: 'reversible', segundos: 30 },
    ])
    w = paso.state
    expect(desenlaceDe(paso.events, { by: 'ana', seq: 7 }).k).toBe('en-curso')

    let murio = -1
    let enLaMuerte = ''
    for (let t = 1; t < 200 && murio < 0; t++) {
      paso = stepWorld(w, [])
      w = paso.state
      if (paso.events.some((e) => e.k === 'murio' && e.por === 'hambre')) {
        murio = t
        enLaMuerte = desenlaceDe(paso.events, { by: 'ana', seq: 7 }).k
      }
    }
    // El arnés tiene que haber llegado hasta la muerte, y en el tick de la muerte
    // la espera todavía contesta —`avanzarEsperas` corre ANTES que los sistemas,
    // así que el último `esperando` sale y el desenlace es `en-curso`—. Nada de
    // esto puede ser lo que falla: si falla acá, el hueco de abajo no se probó.
    if (murio < 0 || w.actors.has('ana')) throw new Error('el arnés no llegó a la muerte')
    if (enLaMuerte !== 'en-curso') throw new Error(`en el tick de la muerte dio ${enLaMuerte}`)
    // Y ACÁ ESTÁ EL HUECO: del tick siguiente en adelante, para siempre, el que
    // preguntó no recibe NADA.
    const despues = stepWorld(w, [])
    const k = desenlaceDe(despues.events, { by: 'ana', seq: 7 }).k
    // LO QUE DEBERÍA PASAR: el que preguntó se entera de que su espera terminó mal.
    // LO QUE PASA: `sin-respuesta`, que según el propio `Desenlace` «con
    // `stepWorld` no puede pasar».
    expect([murio, k]).not.toEqual([murio, 'sin-respuesta'])
  })

  it.fails('SIGUE ABIERTO — un mundo guardado y vuelto a cargar NO es indistinguible del original', () => {
    // POR QUÉ SIGUE ABIERTO: `restoreWorld` promete en su propio encabezado que
    // «un estado restaurado tiene que ser indistinguible del original, y el orden
    // de iteración de un `Map` es parte de lo que se ve desde afuera», y arma
    // `bodies`, `actors` y `cells` en orden canónico para cumplirlo. Pero
    // `phys.substances` sale de las RANURAS, que se recorren ordenadas por clave
    // de texto, así que el catálogo restaurado queda en orden ALFABÉTICO mientras
    // que el vivo está en orden de ALTA (carne, pescado, molusco, … y las que la
    // ley 4 fue agregando al final). Los dos mundos son distinguibles iterando
    // `phys.substances`, y hoy nadie lo hace desde `src/`, así que la conducta no
    // se mueve: está VERIFICADO que después de 300 ticks más los dos dan el mismo
    // `hashWorldState`.
    //
    // Por qué ninguno de los dos jueces del criterio del Hito 2 lo ve, que es la
    // parte que importa: `hashWorldState` ORDENA las claves de un `Map` a propósito
    // —el catálogo es un conjunto, y está escrito por qué en `src/mundo.ts`— y la
    // `huella()` de los tests sí lo vería, pero `tests/paso-determinista.test.ts`
    // no le pasa nunca un mundo restaurado: usa un `clonar()` a mano que conserva
    // el orden. O sea que «restaurar a mitad reproduce el final exacto» está
    // verificado dos veces y ninguna de las dos toca este camino.
    //
    // QUÉ HARÍA FALTA, Y EN QUÉ ARCHIVO: `restoreWorld` (`src/mundo.ts`) recibe
    // las sustancias ya ordenadas alfabéticamente y `buildSeedPhysics` las guarda
    // en ese orden. Cerrarlo es decidir UNA de las dos: o el orden de alta es dato
    // y hay que escribirlo en la ranura (un índice por sustancia), o no lo es y
    // entonces `buildSeedPhysics` tiene que ordenar SIEMPRE, también al armar el
    // mundo vivo, para que no haya dos órdenes posibles. Es una decisión del ADR
    // del catálogo y no del adversario; lo que no puede quedar es que dependa de
    // por dónde entró el mundo.
    const r = lcg(31415)
    let s = partidaDeDiez()
    for (let t = 0; t < 60; t++) s = stepWorld(s, intencionesAlAzar(r, NOMBRES, 6)).state
    const vuelto = restoreWorld(worldSlots(s))
    // El hash del paquete dice que son el mismo mundo…
    expect(hashWorldState(vuelto)).toBe(hashWorldState(s))
    // …y el orden del catálogo dice que no.
    expect([...vuelto.phys.substances.keys()]).toEqual([...s.phys.substances.keys()])
  })

  it('documentado · el que se muere esperando deja el mundo sano, aunque no conteste', () => {
    // La otra mitad, y ésta sí está bien: la espera se va con el actor, no queda
    // un `esperando` colgado de nadie, y los invariantes siguen en pie. El hueco
    // es de NARRACIÓN y no de estado, y conviene que esté escrito para que quien
    // lo cierre sepa qué NO tiene que tocar.
    let w = mundo({
      hz: HZ_DE_REFERENCIA,
      bodies: [
        enElPiso(criatura('ana', 2), EN(0, 0)),
        enElPiso(cuerpo('vara', 'madera', 1), EN(0, 0)),
      ],
      actors: [actor('ana', { holding: ['vara'] })],
    })
    // La vara arranca en la mano: hay que decírselo al cuerpo también.
    w = {
      ...w,
      bodies: new Map(
        [...w.bodies].map(([k, c]) => (k === 'vara' ? [k, { ...c, heldBy: 'ana' }] : [k, c])),
      ),
    }
    let paso = stepWorld(w, [
      { k: 'wait', by: 'ana', seq: 3, commitment: 'reversible', segundos: 30 },
    ])
    w = paso.state
    for (let t = 0; t < 60; t++) {
      const antes = w
      paso = stepWorld(w, [])
      w = paso.state
      expect(revisarInvariantes(antes, w, paso.events)).toEqual([])
      if (!w.actors.has('ana')) break
    }
    expect(w.actors.has('ana')).toBe(false)
    // El cuerpo se quedó, la vara se soltó y nadie la sostiene.
    expect(w.bodies.get('ana-cuerpo')).toBeDefined()
    expect(w.bodies.get('vara')?.heldBy).toBeUndefined()
    expect(cuantosEsperan(w)).toBe(0)
  })
})

// ─── §6 · Remedición de lo que los tres reportaron ───────────────────────────

describe('§6 · los números reportados, remedidos por el adversario', () => {
  it('el ayuno: el tick exacto de la muerte a las cinco frecuencias', () => {
    const filas: string[] = []
    const ticks: number[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      let w = mundo({ hz, bodies: [enElPiso(criatura('ana', 500), EN(0, 0))], actors: [actor('ana')] })
      const dt = dtDeFrecuencia(hz)
      let n = -1
      for (let t = 1; t <= Math.round(700 / dt); t++) {
        const paso = stepWorld(w, [])
        w = paso.state
        if (paso.events.some((e) => e.k === 'murio' && e.por === 'hambre')) {
          n = t
          break
        }
      }
      ticks.push(n)
      filas.push(`  ${String(hz).padStart(4)} Hz   tick ${String(n).padStart(6)}   ${(n * dt).toFixed(4)} s`)
    }
    log(['══ REMEDIDO: EL AYUNO DESDE 500 DE STAMINA ══════════════════════════════', ...filas])
    expect(ticks).toEqual([5000, 10_000, 12_500, 25_001, 50_001])
  }, 120_000)

  it('`wait(2)` dura dos segundos, remedido con el mundo corriendo y sin reemitir', () => {
    const ticks = FRECUENCIAS_ADMISIBLES.map((hz) => {
      let w = mundo({ hz, bodies: [enElPiso(criatura('ana', 500), EN(0, 0))], actors: [actor('ana')] })
      for (let t = 1; t <= 5000; t++) {
        const paso = stepWorld(
          w,
          t === 1 ? [{ k: 'wait', by: 'ana', seq: 1, commitment: 'reversible', segundos: 2 }] : [],
        )
        w = paso.state
        if (paso.events.some((e) => e.k === 'espero')) return t
      }
      return -1
    })
    expect(ticks).toEqual([20, 40, 50, 100, 200])
    expect(ticks.map((t, i) => t / (FRECUENCIAS_ADMISIBLES[i] as number))).toEqual([2, 2, 2, 2, 2])
  })

  it('el guardián de la regla 2 cuenta los fuentes que hay, y no menos', () => {
    // El guardián de `tests/ataque-determinismo.test.ts` tiene una cota mínima
    // escrita a mano (`toBeGreaterThanOrEqual(12)`) que hay que subir cuando
    // aparece un fuente. Se subió con `src/reloj.ts`. Esto verifica que la cota y
    // el directorio no se separaron, que es lo único que aquella cota no puede
    // verificar de sí misma.
    const guardian = new URL('./ataque-determinismo.test.ts', import.meta.url)
    const texto = readFileSync(fileURLToPath(guardian), 'utf8')
    const m = /toBeGreaterThanOrEqual\((\d+)\)/.exec(texto)
    const cota = Number(m?.[1] ?? 0)
    const fuentes = readdirSync(fileURLToPath(new URL('../src/', import.meta.url))).filter((f) =>
      f.endsWith('.ts'),
    )
    expect([cota, fuentes.length]).toEqual([fuentes.length, fuentes.length])
  })
})
