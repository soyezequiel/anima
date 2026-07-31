// ─── UNA PARTIDA DE 2000 TICKS, HASHEADA ─────────────────────────────────────
//
// El control que los tests unitarios NO pueden hacer.
//
// Los 783 tests del árbol prueban, cada uno, la cosa que su autor pensó en
// preguntar. Una caché mal invalidada no falla ahí: falla cuando el mismo cuerpo
// se lee dos veces con algo cambiado en el medio, y eso pasa recién adentro de
// una partida larga, con las leyes corriendo tick tras tick sobre cuerpos que se
// calientan, se cocinan, se pudren, se queman y transmutan.
//
// Este archivo corre esa partida y publica UN NÚMERO: el hash del mundo final,
// más once checkpoints en el camino. Los checkpoints no son adorno — este mundo
// DISIPA, así que un motor que diverge en el tick 400 puede volver a converger
// para el 2000 y el hash final diría que todo está bien.
//
// El número se compara contra el que da el MISMO archivo con las fuentes de
// `@anima/physics` anteriores a la optimización del tick. Si coinciden, no se
// movió ninguna conducta. Si no, el `it` de abajo lo dice con los dos números.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, HZ_DE_REFERENCIA, qualityOf } from '@anima/physics'
import type { Body, QualityVector } from '@anima/physics'

import { mapaDeActores, mapaDeCuerpos, stepWorld } from '../src/step.js'
import type { Actor, CellState, WorldBody, WorldState } from '../src/step.js'
import type { Intent } from '../src/intent.js'
import { keyOfCell } from '../src/cell.js'
import { hashWorldState } from '../src/mundo.js'
import { revisarInvariantes } from '../src/invariants.js'

// ─── Azar propio ─────────────────────────────────────────────────────────────

interface Rng {
  (): number
  n(max: number): number
}

function azar(semilla: number): Rng {
  let s = semilla >>> 0
  const f = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s
  }
  const r = f as Rng
  // Los bits altos: los bajos de un LCG de módulo 2³² tienen período corto y dos
  // semillas distintas darían la misma sucesión corrida un lugar.
  r.n = (max: number): number => (max <= 0 ? 0 : (f() >>> 16) % max)
  return r
}

// ─── El mundo de la partida ──────────────────────────────────────────────────

const NOMBRES = ['ana', 'beto', 'cira', 'dani', 'eze', 'fina', 'gero', 'hilda']
const COSAS = ['madera', 'liana', 'pescado', 'corteza', 'hoja', 'piedra', 'hueso', 'junco']

function cuerpo(id: string, substance: string, mass: number, state: QualityVector = {}): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state }
}

/**
 * La partida. Ocho criaturas, dieciséis cosas y CUATRO FOGATAS.
 *
 * Las fogatas son lo que hace que esto valga la pena: un cuerpo de madera por
 * encima de su punto de ignición emite potencia, y la potencia arrastra a la ley
 * 1 de todo lo que tenga cerca, que arrastra a la 5, a la 3 y —cuando el
 * carbonizado pasa de 0,8— a la 4, que da de alta una sustancia nueva y cambia la
 * `Physics` del mundo a mitad de la partida. Ése es exactamente el camino donde
 * una memoización por identidad de `Physics` se rompería.
 */
function partida(): WorldState {
  const bodies: WorldBody[] = []
  const actores: Actor[] = []
  for (let i = 0; i < NOMBRES.length; i++) {
    const n = NOMBRES[i] as string
    bodies.push({
      body: cuerpo(`${n}-cuerpo`, 'carne', 2, { stamina: 4000 }),
      at: { x: i - 4, y: i - 4 },
    })
    actores.push({ id: n, body: `${n}-cuerpo`, holding: [], capacity: 3, permits: 'irreversible' })
  }
  for (let i = 0; i < 16; i++) {
    bodies.push({
      body: cuerpo(`c${i}`, COSAS[i % COSAS.length] as string, 1 + (i % 3) * 0.5, {
        // Una cuarta parte arranca mojada y otra cuarta parte ya algo podrida:
        // la ley 11 y la ley 6 tienen de dónde agarrar desde el tick 0.
        ...(i % 4 === 0 ? { moisture: 0.7 } : {}),
        ...(i % 4 === 1 ? { decay: 0.2 } : {}),
      }),
      at: { x: (i % 8) - 4, y: 4 + ((i / 8) | 0) },
    })
  }
  // Las cuatro fogatas: madera muy por encima de su ignición.
  for (let i = 0; i < 4; i++) {
    bodies.push({
      body: cuerpo(`fuego${i}`, 'madera', 3, { temperature: 700 }),
      at: { x: i * 2 - 3, y: -4 },
    })
  }
  // Y una cosa apoyada sobre cada fogata, que es la parrilla del ADR II-0002:
  // el camino `montaje: 'parrilla'` de la ley 1, con exposición 0,25.
  for (let i = 0; i < 4; i++) {
    bodies.push({
      body: cuerpo(`asa${i}`, 'pescado', 0.8, { moisture: 0.5 }),
      at: { x: i * 2 - 3, y: -4 },
      supportedBy: `fuego${i}`,
    })
  }
  const cells = new Map<number, CellState>()
  // Cuatro celdas con condiciones raras: mojada, seca y sin aire (la técnica de
  // tapar, que es la que decide carbón contra ceniza en la ley 4).
  cells.set(keyOfCell({ x: -3, y: -4 }), { wet: 0, oxygen: 0.15, temperature: 15 })
  cells.set(keyOfCell({ x: -1, y: -4 }), { wet: 0, oxygen: 1, temperature: 15 })
  cells.set(keyOfCell({ x: 0, y: 4 }), { wet: 0.9, oxygen: 1, temperature: 5 })
  cells.set(keyOfCell({ x: 1, y: 4 }), { wet: 0.1, oxygen: 0.5, temperature: 40 })

  // Los mapas en ORDEN CANÓNICO de id, que es lo que el invariante de orden pide:
  // un `Map` conserva el orden de inserción, así que armarlo a mano dejaría el
  // hash dependiendo de en qué orden se dieron de alta las cosas.
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: buildSeedPhysics(),
    bodies: mapaDeCuerpos(bodies),
    actors: mapaDeActores(actores),
    cells,
    desplegados: new Map(),
    nextId: 1,
  }
}

/** Intenciones arbitrarias: la mitad honestas, la mitad basura. El rechazo también tiene que ser determinista. */
function intenciones(r: Rng, seqBase: number, cuantas: number): Intent[] {
  const out: Intent[] = []
  for (let i = 0; i < cuantas; i++) {
    const by = NOMBRES[r.n(NOMBRES.length)] as string
    const seq = seqBase + i
    const que = `c${r.n(20)}`
    switch (r.n(8)) {
      case 0:
        out.push({ k: 'wait', by, seq, commitment: 'reversible', segundos: 1 })
        break
      case 1:
        out.push({
          k: 'goTo',
          by,
          seq,
          commitment: 'reversible',
          to: { x: r.n(11) - 5, y: r.n(11) - 5 },
          within: 0,
        })
        break
      case 2:
        out.push({ k: 'take', by, seq, commitment: 'reversible', what: que })
        break
      case 3:
        out.push({ k: 'drop', by, seq, commitment: 'reversible', what: que })
        break
      case 4:
        out.push({
          k: 'put',
          by,
          seq,
          commitment: 'reversible',
          what: que,
          at: { x: r.n(9) - 4, y: r.n(9) - 4 },
        })
        break
      case 5:
        out.push({ k: 'eat', by, seq, commitment: 'irreversible', what: que })
        break
      case 6:
        out.push({
          k: 'apply',
          by,
          seq,
          commitment: 'costly',
          process: 'deshilachar',
          roles: [
            { name: 'actor', body: `${by}-cuerpo` },
            { name: 'source', body: que },
          ],
        })
        break
      default:
        out.push({
          k: 'apply',
          by,
          seq,
          commitment: 'reversible',
          process: 'union',
          roles: [
            { name: 'a', body: que },
            { name: 'binder', body: `c${r.n(20)}` },
          ],
        })
        break
    }
  }
  return out
}

interface Resultado {
  readonly hashFinal: string
  readonly checkpoints: readonly string[]
  readonly sustancias: number
  readonly cuerpos: number
  readonly eventos: number
  readonly violaciones: readonly string[]
  /** Cuántas criaturas se murieron de hambre (ADR II-0009). Tiene que ser cero. */
  readonly muertosDeHambre: number
  /** Cuántas veces algo se rechazó por falta de aliento. Tiene que ser cero. */
  readonly sinFuerza: number
  /** La `stamina` de las ocho al final, en orden canónico. */
  readonly stamina: readonly number[]
}

function correr(ticks: number, semilla: number): Resultado {
  const r = azar(semilla)
  let w = partida()
  const checkpoints: string[] = []
  let eventos = 0
  let muertosDeHambre = 0
  let sinFuerza = 0
  const violaciones: string[] = []
  for (let t = 0; t < ticks; t++) {
    const antes = w
    const paso = stepWorld(w, intenciones(r, t * 10, 4))
    w = paso.state
    eventos += paso.events.length
    for (const e of paso.events) {
      if (e.k === 'murio' && e.por === 'hambre') muertosDeHambre++
      if (e.k === 'rechazada' && e.por === 'sin-fuerza') sinFuerza++
    }
    // Los invariantes en TODOS los ticks, y con `antes` y `despues`: una caché
    // mal invalidada que invente materia rompe la conservación antes de mover el
    // hash de una manera que se pueda leer.
    for (const v of revisarInvariantes(antes, w, paso.events)) {
      violaciones.push(`t${t} ${JSON.stringify(v)}`)
    }
    if (t % 200 === 0) checkpoints.push(hashWorldState(w))
  }
  checkpoints.push(hashWorldState(w))
  return {
    hashFinal: hashWorldState(w),
    checkpoints,
    sustancias: w.phys.substances.size,
    cuerpos: w.bodies.size,
    eventos,
    violaciones,
    muertosDeHambre,
    sinFuerza,
    stamina: NOMBRES.map((n) =>
      qualityOf((w.bodies.get(`${n}-cuerpo`) as WorldBody).body, 'stamina', w.phys),
    ),
  }
}

describe('una partida de 2000 ticks', () => {
  it('el hash final y los checkpoints, publicados', () => {
    const r = correr(2000, 20260727)
    /* eslint-disable no-console */
    console.log(
      [
        '',
        '══ PARTIDA DE 2000 TICKS ════════════════════════════════',
        `  hash final ......... ${r.hashFinal}`,
        `  checkpoints ........ ${r.checkpoints.join(' ')}`,
        `  sustancias al final  ${r.sustancias}   (26 semilla + las que dio de alta la ley 4)`,
        `  cuerpos al final ... ${r.cuerpos}`,
        `  eventos ............ ${r.eventos}`,
        `  stamina al final ... ${r.stamina.map((s) => s.toFixed(2)).join(' ')}`,
        `  muertos de hambre .. ${r.muertosDeHambre}   ·   rechazos sin-fuerza: ${r.sinFuerza}`,
        `  violaciones ........ ${r.violaciones.length}`,
        ...r.violaciones.slice(0, 5).map((v) => `      ${v}`),
        '',
      ].join('\n'),
    )
    /* eslint-enable no-console */

    // La partida tiene que HACER algo: una partida en la que no pasa nada no
    // prueba nada sobre ninguna caché.
    expect(r.eventos).toBeGreaterThan(1000)
    // La ley 4 tiene que haber dado de alta al menos una sustancia: ése es el
    // camino donde la `Physics` cambia a mitad de la partida.
    expect(r.sustancias).toBeGreaterThan(26)

    // NINGUNA violación de CONSERVACIÓN ni de materia. Son las que una caché mal
    // invalidada produce: leer una masa vieja después de que la ley 5 evaporara
    // agua es materia inventada, y el candado no la ve porque el candado lee con
    // la misma caché.
    //
    // Las `solidos-solapados` que sí aparecen son de OTRA cosa y son previas a
    // esta optimización: mi chorro de intenciones deja que dos criaturas caminen
    // a la misma celda, y el invariante de la pila —correctamente— se queja. Está
    // verificado que el mismo número sale con las fuentes de física de 11b49ae, o
    // sea que no lo trajo el que optimizó el tick. Se cuentan, no se toleran en
    // silencio.
    expect(r.violaciones.filter((v) => !v.includes('solidos-solapados'))).toEqual([])

    // ─── DOS FRENTES MOVIERON ESTA PARTIDA, Y ACÁ ESTÁ LA DEMOSTRACIÓN ─────
    //
    // CORREGIDO POR EL ADVERSARIO: este bloque decía «el ADR II-0009 movió esta
    // partida» y nombraba un solo frente. Son dos, y están medidos en
    // `tests/ataque-al-mundo-que-falta.test.ts` §1:
    //
    //   1. EL ADR II-0009. El hambre pasó a cobrarse por SEGUNDO y a 1,0 en vez de
    //      a 0,01 por tick, o sea 5× más caro. Mueve la `stamina` de las ocho y
    //      NADA MÁS, que es lo que las cuatro afirmaciones de abajo acotan.
    //   2. LA ESPERA QUE DURA. `wait` dejó de ser un no-op y ahora ESCRIBE
    //      `Actor.esperando`, que entra en `hashWorldState`. En esta partida hay
    //      alguien esperando en NUEVE de los once checkpoints, el último incluido,
    //      y 2019 de los 9187 eventos son `esperando` —un evento que antes no
    //      existía—. Sacarle el campo al estado final devuelve `9a75fd6929ae0d7e`.
    //
    // Que son dos y no uno se demuestra solo: si el único cambio fuera el del
    // hambre, y `muertosDeHambre` y `sinFuerza` son CERO, la cuenta de eventos no
    // podría haberse movido ni en uno — y se movió en 1183.
    //
    // **La huella se tenía que mover**, y al revés que con el ADR II-0008 no hay
    // forma vieja que mapear de vuelta: 1,0 por segundo no es 0,01 por tick a
    // ninguna frecuencia. Lo que sí se puede demostrar —y es lo que estas cuatro
    // afirmaciones demuestran— es que la parte del HAMBRE se movió **por el motivo
    // declarado y por ninguno más**:
    //
    //   1. NADIE SE MURIÓ. La partida de 2000 ticks sigue siendo la misma partida
    //      y no una más corta con ocho cadáveres adentro: las ocho arrancan con la
    //      `stamina` al techo del catálogo (1000, porque `conCualidad` topa los
    //      4000 del armado en el primer tick) y 2000 ticks a 20 Hz son 100
    //      segundos de mundo, o sea 100 de los 1000.
    //   2. NADIE SE QUEDÓ SIN FUERZA. Cero rechazos `'sin-fuerza'`, así que
    //      ninguna decisión del chorro de intenciones cambió de resultado por el
    //      precio nuevo: la TRAYECTORIA es la misma y lo único distinto son los
    //      números de `stamina`.
    //   3. Y esos números son exactamente los que el ADR predice: 100 de gasto
    //      por criatura en vez de 20, más lo que se llevaron los pasos y los
    //      procesos, que no cambiaron.
    //
    // Ojo con las cuentas conservadas: al arrancar TOPADAS en 1000, comer clampea,
    // y clampea distinto según cuánto se gastó. Es una consecuencia del mismo
    // cambio y no una segunda causa.
    expect(r.muertosDeHambre).toBe(0)
    expect(r.sinFuerza).toBe(0)
    for (const s of r.stamina) {
      // Arrancan topadas en 1000 y vivir 100 segundos cuesta 34: la banda cae
      // alrededor de 966. Lo que la corre para abajo son los pasos (0,05 la
      // celda), lo que `deshilachar` le saca al que deshilacha y —desde el ADR
      // II-0013— **el veneno de lo que se comió crudo**; lo que la corre para
      // arriba es el techo de 1000 que `conCualidad` no deja pasar.
      //
      // MEDIDO ANTES DEL II-0013: entre 894,10 y 900,19, y la que más arriba
      // terminaba era la que HABÍA COMIDO. Con el II-0013: entre 876,22 y 895,55, y
      // la que más abajo termina es `fina`, que se comió un pescado crudo de 1,5 kg
      // —3,04 × 1,5 = 4,56 de calorías contra 0,25 × 1,5 × 9,375 de veneno—.
      // Comer dio vuelta de signo en el chorro al azar, que es exactamente lo que
      // el ADR decidió: el pescado crudo adelgaza.
      //
      // MEDIDO HOY, con `COSTO_VIVIR_POR_SEGUNDO` en 0,34 y no en 1,0: entre 942,22
      // y 961,55, o sea 66 puntos más arriba, que son los 100 − 34 de vivir los cien
      // segundos. `fina` sigue siendo la de abajo del todo: lo que la separa de las
      // otras es su bocado crudo y ése no se movió.
      //
      // ESTA ES LA AFIRMACIÓN QUE PINCHA EL GLOBO: con el costo contado por TICK,
      // 2000 ticks a 0,01 gastaban 20 y la banda caería alrededor de 980. Si alguien
      // vuelve a contar el hambre en muestras, esto se pone rojo antes que el hash, y
      // con un número que se entiende. La banda se movió con la constante y se
      // apretó: mide 30 y no 40.
      expect(s).toBeGreaterThan(940)
      expect(s).toBeLessThan(970)
    }

    // EL NÚMERO. Se movió con el ADR II-0008 —tres cosas de FORMA y no de
    // conducta—, con el ADR II-0009, que sí es de conducta, y una tercera vez con
    // la espera que dura. El ADR II-0008 aportó:
    //
    //   1. la FRECUENCIA entra en el hash. Dos mundos con la misma semilla y
    //      distinta frecuencia no producen la misma traza, así que el hash tiene
    //      que verlo desde el tick 0 y no mil ticks después;
    //   2. la actividad en curso acumula SEGUNDOS y ya no ticks;
    //   3. el catálogo cambió de forma: `Effect.porSegundo`, `completion.at` en
    //      segundos y `relaxesTo.porSegundo`.
    //
    // Que la TRAYECTORIA no se movió con el II-0008 está verificado, y no de
    // palabra: mapeando esas tres formas de vuelta a como eran —la actividad a
    // ticks, las tasas a por tick, las duraciones a ticks, y sacando `hz` del
    // hash— esta misma partida volvía a dar `61d4b9588a81717d` con sus once
    // checkpoints EXACTOS.
    //
    // Y con el II-0009 la trayectoria SÍ se movió, a propósito, en lo que las
    // cuatro afirmaciones de arriba acotan: la `stamina` de las ocho, y nada más.
    //
    // LOS NÚMEROS ANTERIORES, PARA QUIEN VENGA A BISECAR. La cadena tiene TRES
    // eslabones y no dos, y el del medio es el que faltaba —lo midió el adversario
    // sacándole `Actor.esperando` al estado final—:
    //   61d4b9588a81717d  (antes del ADR II-0008)
    //   4d431de7cdd1fe94  (antes del ADR II-0009, con 8004 eventos)
    //   9a75fd6929ae0d7e  (con el II-0009 y ANTES de que la espera durara)
    //   adea782a5cd4274d  (con las dos, y con 9187 eventos: 2019 son `esperando`)
    //
    // Y con el ADR II-0011 se movió otra vez, también a propósito: las leyes 1 y 3
    // cambiaron de conducta —la relajación térmica se integra en forma cerrada y
    // arder libera calor—, así que toda temperatura de la partida se escribe con
    // otros bits desde el primer tick.
    //
    // LO QUE SE MOVIÓ AL LADO DEL HASH, Y ES INFORMACIÓN: los eventos pasaron de
    // 9187 a 9190 y las sustancias de 30 a 31. Son las TRES transmutaciones de más
    // que la ley 4 alcanzó a hacer, y la sustancia nueva que salió de una de
    // ellas: con el fuego durando, algo que estaba junto a las brasas cruzó sus
    // 0,8 de `charred` adentro de los 2000 ticks. Las violaciones NO se movieron
    // (97, las mismas ocho criaturas pisándose), o sea que el guión de intenciones
    // es el mismo y ninguna se aceptó o rechazó distinto: lo que cambió fue la
    // física y no la puerta.
    //   adea782a5cd4274d  (antes del ADR II-0011, con 9187 eventos y 30 sustancias)
    //   19db371807b7fb35  (con el II-0011, con 9190 eventos y 31 sustancias)
    //
    // Y se movió OTRA VEZ con la reparación de las dos constantes que se
    // cancelaban, también a propósito y en tres cosas que se pueden nombrar:
    //
    //   · `TASA_CARBONIZACION` pasó a ser por kilo, así que `charred` —y con él
    //     `nutrition` y `digestibility`, que la ley 3 multiplica por `1 − charred`—
    //     se escribe con otros bits en todo lo que esté arriba de su pirólisis;
    //   · la ley 4 dejó de tirar el estado que la sustancia nueva no declara, así
    //     que un cuerpo transmutado sale con lo que traía y no con `{ temperature }`;
    //   · y los EVENTOS pasaron de 9190 a 11188. Los 1998 de más son el `gasto`
    //     nuevo: uno por tick, con la `stamina` que el mundo se llevó de todos, que
    //     es lo que `revisarConservacion` necesita para poder perseguir las
    //     bajadas. Son 2000 ticks menos los dos primeros, donde todavía no había
    //     nadie vivo gastando.
    //
    // Las violaciones NO se movieron (97, las mismas ocho criaturas pisándose) y
    // las sustancias tampoco (31): el guión de intenciones es el mismo y ninguna se
    // aceptó o rechazó distinto.
    //
    // Y SE MOVIÓ OTRA VEZ con el ADR II-0013 («el veneno se cobra al tragar»), que
    // es lo más chico que movió esta partida y por eso el más fácil de leer:
    //
    //   · los eventos pasaron de 11.188 a 11.190. Son DOS `enveneno`, o sea que en
    //     los 2000 ticks el chorro al azar logró exactamente DOS bocados. Que el
    //     delta sea 2 y no 3 es la prueba de que no se movió nada más: un solo
    //     rechazo distinto habría cambiado la cuenta por otro lado;
    //   · los CINCO PRIMEROS checkpoints son idénticos a los de antes del ADR
    //     (`5138f2… 8c7e06… 45fed1… 2ea427… bcc804…`), o sea que hasta el tick 800
    //     nadie comió y la partida es bit a bit la misma. La huella se separa en el
    //     checkpoint del tick 1000 y no antes;
    //   · las violaciones (97), las sustancias (31) y los cuerpos (30) no se
    //     movieron: el guión es el mismo.
    //
    //   e54643aaa90fac83  (antes del ADR II-0013, con 11.188 eventos)
    //   a15c8d9dad1a6180  (con el II-0013, con 11.190: los dos `enveneno`)
    //
    // Y SE MOVIÓ OTRA VEZ, y ésta es la más grande de todas las que movieron esta
    // partida, porque **se separa en el PRIMER checkpoint** (tick 200) y no en el
    // 800 ni en el 1000: `entornoDe` dejó de elegir la fuente por POTENCIA y la
    // elige por CALOR ENTREGADO (`potencia · formFactor(distancia, montaje)`, ver
    // `calorEntregado` en `step.ts`). Lo que arregla está medido en
    // `tests/la-fuente-se-elige-por-calor.test.ts`: antes un fuego más grande a
    // SESENTA celdas le ganaba el único hueco de `Fuente` a la brasa que la comida
    // tenía debajo y el pescado se quedaba crudo (`digestibility` 0,3800), y el
    // empate entre dos fuegos iguales lo decidía el abecedario del id.
    //
    // Que el primer checkpoint se mueva es exactamente lo que hay que esperar: esta
    // partida tiene ocho criaturas y varias fogatas desde el arranque, así que en
    // cuanto hay DOS fuentes a la vista de un mismo cuerpo la elección cambia, y con
    // ella la temperatura de ese cuerpo, y con ella todo lo que las leyes 3 a 6 le
    // escriben encima. Lo que NO se movió es lo que dice que no cambió la puerta:
    //
    //   · violaciones 97, las mismas ocho criaturas pisándose;
    //   · sustancias 31 y cuerpos 30, o sea que la ley 4 hizo las mismas
    //     transmutaciones y ninguna sustancia nueva apareció ni faltó;
    //   · los eventos pasaron de 11.190 a 11.192, o sea DOS de más. Con dos
    //     `enveneno` en la partida, dos de más es lo que se ve cuando algo que antes
    //     no llegaba a la ventana de una ley ahora sí (o al revés) en dos ticks
    //     sueltos: no hay un rechazo distinto, que movería la cuenta por decenas.
    //
    //   a15c8d9dad1a6180  (la fuente elegida por potencia, con 11.190 eventos)
    //   18ad7fce912cdee3  (la fuente elegida por calor entregado, con 11.192)
    //
    // ─── Y SE MOVIÓ UNA VEZ MÁS, y ésta es la más FÁCIL de atribuir de todas ───
    //
    // `COSTO_VIVIR_POR_SEGUNDO` bajó de 1,0 a 0,34 (decisión del usuario, tramo M).
    // El metabolismo le cobra a las ocho criaturas desde el tick 1, así que la
    // partida se separa en el primer checkpoint —igual que la anterior, pero por un
    // motivo mucho más simple: la `stamina` de cada cuerpo entra al hash.
    //
    // LO QUE NO SE MOVIÓ, y por una vez es TODO lo demás:
    //
    //   · eventos 11.192, exactamente los mismos que antes;
    //   · violaciones 97, las mismas ocho criaturas pisándose;
    //   · sustancias 31 y cuerpos 30, o sea que la ley 4 hizo las mismas
    //     transmutaciones y nadie se murió antes ni después.
    //
    // Un cambio de constante del metabolismo que mueve el hash y no mueve ni un
    // evento es la firma de que sólo cambió una cuenta, y no una decisión: si
    // alguna criatura hubiera muerto en otro tick, los eventos se moverían por
    // decenas.
    //
    //   3f82bbd9dd7a3128  (con el costo de vivir en 0,34, con los mismos 11.192)
    //
    // ─── Y OTRA VEZ, CON LA MISMA FIRMA, POR LA OTRA PERILLA ───────────────
    //
    // La eficiencia de `friccion` pasó de 0,35 a 0,85 (tramo N, decisión del
    // usuario después de que `world/tests/la-cuenta-de-los-veinte-mil.test.ts`
    // midiera que con 0,35 el criterio (5) era aritméticamente imposible). Una de
    // las ocho criaturas frota, así que su `stamina` entra al hash con otro número
    // desde el primer checkpoint.
    //
    // Y LA FIRMA ES LA MISMA, verificada renglón por renglón: eventos 11.192,
    // violaciones 97, sustancias 31 y cuerpos 30 — todos idénticos. Cambió una
    // cuenta, no una decisión. Si frotar más barato hubiera hecho que alguien
    // prendiera algo que antes no prendía, los eventos se moverían por decenas.
    //
    //   9e16b485a27cd10c  (con la eficiencia en 0,85, con los mismos 11.192)
    expect(r.hashFinal).toBe('9e16b485a27cd10c')
    expect(r.checkpoints.join(' ')).toBe(
      '595e262539cd4436 0f82f2ac486a9719 d4cf02c28a1f5c43 ce4581e4443ecd77 791ac1abaa864a90 2bdc1f892e22c55c 8e956f6ef99f205d 3fe8594cae28819b 6d51bd5a822260df 1168cea6be88ed91 9e16b485a27cd10c',
    )
    expect(r.eventos).toBe(11192)
    expect(r.sustancias).toBe(31)
    expect(r.violaciones.length).toBe(97)
  }, 300_000)

  it('la partida es reproducible dentro de esta corrida', () => {
    // Control mínimo: si esto fallara, el número de arriba no significaría nada.
    expect(correr(300, 20260727).hashFinal).toBe(correr(300, 20260727).hashFinal)
    // Y control negativo: otra semilla, otro mundo.
    expect(correr(300, 20260727).hashFinal).not.toBe(correr(300, 99).hashFinal)
  }, 300_000)
})
