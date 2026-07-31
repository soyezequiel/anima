// ═══ EL ADVERSARIO DE LA PARRILLA ═══════════════════════════════════════════
//
//   pnpm --filter @anima/mind test tests/ataque-a-la-parrilla.test.ts
//
// El tramo del montaje sacó una conclusión fuerte y bien medida: la ley 1 tiene
// TRES variables libres —potencia, montaje y distancia—, la potencia se elige una
// sola vez y el lugar se elige cada vez, así que hay una fila de cocción por
// geometría. Sobre eso se cerró la cadena y la criatura comió por primera vez algo
// que ella cocinó. Este archivo NO discute nada de eso: lo da por bueno y le busca
// las juntas, midiendo.
//
// Se toca UN archivo —éste— y ningún `src/`.
//
// ═══ EL VEREDICTO, ARRIBA Y SIN ADORNOS ═════════════════════════════════════
//
// **LA CADENA DE LA COCCIÓN, MEDIDA EN LA ÚNICA MONEDA DEL HITO 5, ES UNA PÉRDIDA
// DEL 96,5%.** Leído de la corrida de verdad, tick a tick, con la escena de la
// contraprueba (leña seca de 0,40 kg en celdas secas y el tanque lleno):
//
//     tick 102   frotar(lena1×caña)   994,6500 → 432,6571   −561,9929
//     tick 153   esperar(15s)         432,5571 → 417,5071    −15,0500
//     tick 457   tragar(el pescado)   417,3571 → 437,1937    +19,8366
//                                                          ───────────
//                                                            −557,2063
//
// Y no hay salida por el lado de comerlo crudo, que es lo que hace que esto sea el
// criterio y no una ineficiencia: el pescado crudo tiene `toxicity` 0,25 y la innata
// `comer` se autoimpone `toxicidadTolerada = 0,2`, así que **la criatura NO PUEDE
// comerlo crudo**. Cocinar no es un lujo: es la única puerta que la escena del Hito 5
// le ofrece a la comida. Y esa única puerta **devuelve 20,3758 y cuesta 553,7143, o
// sea el 3,7%**.
//
// Los dos números que arman la razón, cada uno de su lado: cocinar AGREGA 11,5994 de
// aliento (8,7765 crudo → 20,3758 cocido) y el fuego que hace falta para agregarlos
// cuesta 553,7143. Hacen falta **47,7 bocados cocidos para amortizar UN fuego**, y un
// fuego alcanza para UNO: dura 20 s y la espera ciega de la fila se come 15.
//
// Esto no es el diagnóstico 9 del tramo anterior con otras palabras. Aquél decía
// «el fuego cuesta 485,45 y la escena le da 310 de tanque», o sea **el tanque es
// chico**. La cuenta de arriba dice otra cosa: **el signo está mal**, y agrandar el
// tanque no lo da vuelta. Con el tanque en 1000 la corrida entera de 20.000 ticks
// mide, medida:
//
//     capacidad de manos │ frotar │ poner │ tragar │ murió en │ aliento final
//                      3 │      1 │     1 │      1 │     5744 │ 0,0437
//                      6 │      3 │     1 │      1 │      574 │ 0,0794
//
// Un bocado en 20.000 ticks, y **con más manos se muere DIEZ VECES ANTES**, porque
// las manos libres la dejan encender tres fuegos y cada fuego es medio tanque.
//
// Los otros cuatro frentes, en una línea cada uno:
//
//   · **el mundo no sostiene lo que la fila verifica.** `fuentes()` no tiene límite
//     de distancia y `entornoDe` elige por POTENCIA: un fuego más grande a 60
//     celdas le roba el único hueco de `Fuente` y el pescado, apoyado en la brasa
//     correcta, se queda en `digestibility` 0,3800. Y el empate se desempata por
//     `compararTexto` del id: la MISMA escena cocina o no según el abecedario.
//   · **sí se quema la comida**, y lo único que lo evita es el `roleHint`
//     `ignitionPoint > 507` de la parrilla. Con una rejilla de madera en vez de
//     piedra el pescado llega a **892,43 °C**, `charred` 0,7820 y **0 calorías**.
//   · **no hay condición de parada** y la fila no la necesita para el carbón —abajo
//     de 260 °C `charred` no se mueve— pero sí para el veneno: la promesa
//     `toxicity <= 0,05` **se vence entre los 30 y los 60 segundos** en la celda que
//     `laOrilla()` llama seca, y a los 300 s ya está arriba de lo que `comer` tolera.
//   · **el planificador NO es no-determinista.** Con dos piedras empatadas y con
//     dos fuegos empatados, dando la vista al derecho y al revés, salen los cuatro
//     planes idénticos. Frente cerrado en falso.
//   · **la regresión está limpia.** Los 2347 tests de la línea de base siguen
//     verdes, los nueve typechecks también, ningún `it.fails` se volvió `it` sin que
//     la conducta cambiara —los contadores SUBIERON en los cinco archivos tocados—
//     y no se movió ningún hash.
//
// ═══ CÓMO SE LEE ════════════════════════════════════════════════════════════
//
// Cada bloque afirma el MECANISMO y no el reloj: que el pescado se quede crudo, que
// el orden alfabético cambie el resultado, que la nutrición llegue a cero. Los
// números van en el `console.log` y en los comentarios, con cuatro decimales, para
// que el próximo pueda ver si se movieron sin que un `toBeCloseTo` de nueve dígitos
// ponga rojo la suite cuando alguien recalibre una tasa.

import { beforeEach, describe, expect, it } from 'vitest'

import type { Body, QualityId } from '@anima/physics'
import { HUMEDAD_QUE_APAGA, SUSTANCIAS_SEMILLA, qualityOf, temperaturaDeEquilibrio } from '@anima/physics'
import type { Placement, WorldState } from '@anima/world'
import { decretoDe, mapaDeActores, stepWorld } from '@anima/world'
import { Partida } from '@anima/perceive'
import { plan } from '@anima/plan'
import type { Predicado, Step, VistaDelPlan } from '@anima/plan'

import { Creencias } from '../src/creencias.js'
import { Mente, vivir } from '../src/mente.js'
import { PHYS, actor, criatura, cuerpo, enElPiso, laOrilla, mundo } from './mundo.js'
import type { Orilla } from './mundo.js'

// ─── EL RESPIRO QUE MANTIENE VIVO AL WORKER DE VITEST ────────────────────────
//
// birpc le pone 60 s de vencimiento al aviso de cada test, y un `for` sincrónico
// largo no deja correr ni el temporizador ni la lectura del socket; cuando suelta
// el hilo, Node corre la fase de temporizadores antes que la de poll y el
// vencimiento gana la carrera aunque la respuesta ya esté en la cola. El síntoma
// es la peor clase de rojo: TODOS los tests en verde y `exit 1` con
// `Timeout calling "onTaskUpdate"`.
//
// Desde que el mundo materializa el decreto (`world/src/step.ts`, `abrirChunk`)
// las corridas de este archivo cuestan diez veces más por tick, así que varias
// cruzan los 60 s. Se arregla con una MACROTAREA de verdad —`setTimeout(…, 0)`;
// un `await` sobre una promesa resuelta es una microtarea y no drena la fase de
// poll— en un `beforeEach` de raíz, que no toca el cuerpo de ningún test ni puede
// mover ninguna medición: corre antes de que el test empiece.
beforeEach(async () => {
  await new Promise((listo) => {
    setTimeout(listo, 0)
  })
})

const num = (x: number): string => x.toFixed(4)
const log = (l: readonly string[]): void => {
  console.log(['', ...l, ''].join('\n'))
}

const EN = (x: number, y: number): Placement => ({ x, y })

/**
 * Un cuerpo YA ARDIENDO, y por qué se lo pone a 700 °C y no se lo enciende.
 *
 * Porque encender es lo que este archivo está midiendo por otro lado: si cada banco
 * tuviera que pagar los 553 de aliento de la fricción, la mitad de las mediciones
 * estaría midiendo el precio en vez de la cocción. 700 °C es «arriba de la ignición
 * de la madera (300) con margen», y la ley 1 lo baja al régimen de la llama en los
 * primeros ticks sola — no es una temperatura sostenida a mano.
 */
function ardiendo(id: string, sustancia: string, masa: number): Body {
  return cuerpo(id, sustancia, masa, { temperature: 700 }, 'vara')
}

/** `n` ticks de mundo sin una sola intención: sólo las doce leyes. */
function correr(w: WorldState, n: number): WorldState {
  let s = w
  for (let i = 0; i < n; i++) s = stepWorld(s, []).state
  return s
}

function q(w: WorldState, id: string, cual: QualityId): number {
  const b = w.bodies.get(id)
  return b === undefined ? Number.NaN : qualityOf(b.body, cual, w.phys)
}

const VACIO: Body = { id: '', form: 'vara', parts: [], joints: [], state: {} }

function aliento(w: WorldState, quien = 'ana'): number {
  return qualityOf(w.bodies.get(`${quien}-cuerpo`)?.body ?? VACIO, 'stamina', w.phys)
}

// ─── La escena de la contraprueba del criterio, copiada tal cual ─────────────
//
// Es `conLenaSeca` de `hito-5-el-criterio.test.ts`, con `celdasSecas` y todo. Se
// copia y no se importa por la misma razón que ese archivo copió el arnés de
// `perceive`: los `tests/` de un paquete no se exportan, y un test que depende del
// de al lado se rompe cuando el de al lado se reordena. Lo que se copia es el
// ARMADO; ni un número de la física ni una regla del mundo.

function humedadDeLaCelda(o: Orilla, c: { x: number; y: number }): number {
  const dec = decretoDe(o.dios, PHYS, Math.floor(c.x / 16), Math.floor(c.y / 16))
  const i = (((c.y % 16) + 16) % 16) * 16 + (((c.x % 16) + 16) % 16)
  return (dec.celdas[i] as { wet: number }).wet
}

/** Las celdas de VERDAD secas (`wet < HUMEDAD_QUE_APAGA`) más cercanas a la parada. */
function celdasSecas(o: Orilla, cuantas: number): { x: number; y: number }[] {
  const out: { x: number; y: number; d: number }[] = []
  for (let dx = -12; dx <= 12; dx++) {
    for (let dy = -12; dy <= 12; dy++) {
      const c = { x: o.parada.x + dx, y: o.parada.y + dy }
      if (humedadDeLaCelda(o, c) >= HUMEDAD_QUE_APAGA) continue
      const ax = dx < 0 ? -dx : dx
      const ay = dy < 0 ? -dy : dy
      out.push({ ...c, d: ax > ay ? ax : ay })
    }
  }
  out.sort((a, b) => (a.d !== b.d ? a.d - b.d : a.x !== b.x ? a.x - b.x : a.y - b.y))
  return out.slice(0, cuantas).map((c) => ({ x: c.x, y: c.y }))
}

function conLenaSeca(stamina: number, capacidad = 3, cuantas = 4): WorldState {
  const o = laOrilla()
  const p = o.parada
  const secas = celdasSecas(o, cuantas)
  const base = mundo({
    dios: o.dios,
    bodies: [
      enElPiso(criatura('ana', stamina), p),
      enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: p.x + 3, y: p.y }),
      enElPiso(cuerpo('matorral', 'liana', 0.2, {}, 'hebra'), { x: p.x - 2, y: p.y + 1 }),
      ...secas.map((c, i) => enElPiso(cuerpo(`lena${String(i)}`, 'madera', 0.4, {}, 'vara'), c)),
    ],
    actors: [actor('ana', { capacity: capacidad })],
  })
  return {
    ...base,
    actors: mapaDeActores([
      { id: 'ana', body: 'ana-cuerpo', holding: [], capacity: capacidad, permits: 'irreversible' },
    ]),
  }
}

/** Un vuelo terminado de la corrida: qué despegó, cuándo, y qué le costó. */
interface Vuelo {
  readonly tick: number
  readonly nombre: string
  readonly antes: number
  readonly despues: number
}

interface Corrida {
  readonly vuelos: readonly Vuelo[]
  readonly cuenta: ReadonlyMap<string, number>
  readonly murioEn: number
  readonly alientoFinal: number
}

/**
 * `n` ticks con una mente puesta, anotando el aliento de ANTES y de DESPUÉS de cada
 * despegue.
 *
 * El «después» es el aliento del tick anterior al despegue SIGUIENTE, que es la
 * única forma de leer lo que costó un vuelo sin duplicar el bucle de producción: la
 * habilidad no cobra en el tick en que despega, cobra mientras vuela.
 */
function correrConMente(w: WorldState, n: number): Corrida {
  const p = new Partida(w)
  const m = new Mente({ actor: 'ana', memoria: new Creencias() })
  const mentes = new Map([['ana', m]])
  const vuelos: Vuelo[] = []
  const cuenta = new Map<string, number>()
  let despegues = 0
  let previo = aliento(p.state)
  let abierto: { nombre: string; tick: number; antes: number } | undefined
  let murioEn = -1
  let ultimo = previo
  for (let t = 0; t < n; t++) {
    vivir(p, mentes, 1)
    if (m.despegues > despegues) {
      despegues = m.despegues
      if (abierto !== undefined) vuelos.push({ ...abierto, despues: previo })
      const nombre = m.ultimoDespegue ?? '?'
      abierto = { nombre, tick: t, antes: previo }
      const clase = nombre.replace(/[(×].*/, '')
      cuenta.set(clase, (cuenta.get(clase) ?? 0) + 1)
    }
    previo = aliento(p.state)
    if (murioEn < 0) {
      if (p.state.actors.has('ana')) ultimo = previo
      else murioEn = t
    }
    // SE CORTA EN LA MUERTE. Todo lo que esta función devuelve —los vuelos, la
    // cuenta, el tick de la muerte y el último aliento— queda escrito cuando la
    // criatura cae; los ticks que siguen mueven el mundo y nadie los lee. En el
    // bloque de las manos, la de seis muere en el 361 de 20.000 (la de tres,
    // desde el ancla del fondo, llega viva y corre entera).
    if (murioEn >= 0) break
  }
  if (abierto !== undefined) vuelos.push({ ...abierto, despues: previo })
  return { vuelos, cuenta, murioEn, alientoFinal: murioEn < 0 ? previo : ultimo }
}

// ════════════════════════════════════════════════════════════════════════════
// 1 · ¿EL ESQUEMA POR LEY PROMETE MÁS DE LO QUE EL MUNDO CUMPLE?
// ════════════════════════════════════════════════════════════════════════════
//
// La fila verifica `emitsPower ∈ [105,4167 ; 170,8333)` SOBRE UN CUERPO, en el
// momento de planificar, y de ahí deduce una temperatura de equilibrio. Los tres
// bloques de acá abajo son tres formas de que esa deducción sea falsa en el mundo, y
// las tres están medidas contra `stepWorld`.

describe('1 · la fila verifica una potencia y el mundo entrega otra cosa', () => {
  it('LA FUENTE SECUESTRADA: ARREGLADA — el fuego lejano ya no le roba el lugar a la brasa', () => {
    // ─── EL MECANISMO QUE ERA, Y LO QUE SE HIZO CON ÉL ─────────────────────
    //
    // Este bloque encontró esto y lo dejó medido: `Entorno` de la física acepta UNA
    // fuente, `entornoDe` (`world/src/step.ts`) la elegía por POTENCIA, y `fuentes()`
    // barre `d.bodies` ENTERO sin ningún límite de distancia. Entonces el fuego más
    // grande ganaba el único hueco por lejos que estuviera, se le calculaba el
    // montaje contra ÉL —`piso`, porque la comida no está apoyada en él— y la
    // exposición caía de 0,60 a 0,06/(1 + d²). LA TABLA QUE SALIÓ:
    //
    //     d del otro fuego │ T del pez │ dig    │ ¿cocinó?
    //                    1 │   28.7390 │ 0.3800 │ NO
    //                    2 │   20.4956 │ 0.3800 │ NO
    //                    5 │   16.0568 │ 0.3800 │ NO
    //                   20 │   15.0685 │ 0.3800 │ NO
    //                   60 │   15.0076 │ 0.3800 │ NO
    //
    // 0,3800 es la `digestibility` del pescado crudo del catálogo: la ley 5 no
    // corría un solo tick, y no había radio a partir del cual dejara de pasar.
    //
    // **Y SE ARREGLÓ, EN EL MUNDO Y NO EN LA FILA.** `entornoDe` ordena las fuentes
    // por CALOR ENTREGADO —`potencia · formFactor(distancia, montaje)`, que es lo que
    // la ley 1 usa dos líneas después— y no por potencia. No hace falta ningún radio
    // de corte porque el `(1 + d²)` ya lo pone. El test se da vuelta y afirma la
    // conducta nueva; la vieja queda arriba, con sus cinco números, para que el día
    // que vuelva se la reconozca. La medición completa del arreglo, con el control
    // sin segundo fuego y el orden que NO se rompió, está en
    // `world/tests/la-fuente-se-elige-por-calor.test.ts`.
    //
    // Lo que este bloque decía de la FILA sigue siendo cierto y por eso se deja
    // escrito: su vocabulario son `roleHints` sobre cuerpos y una pila de apoyos, y
    // «que no haya en todo el mundo un fuego más grande que éste» no es una cualidad
    // de ningún cuerpo. La fila nunca podría haberse defendido de esto sola.
    const filas: string[] = ['d del otro fuego │ T del pez a los 15 s │ dig │ ¿cocinó?']
    const digestibilidades: number[] = []
    for (const d of [1, 2, 5, 20, 60]) {
      const w = mundo({
        bodies: [
          enElPiso(criatura('ana', 1000), EN(200, 200)),
          // El fuego CORRECTO: 0,40 kg de madera, `emitsPower` 120,24, adentro de la
          // ventana que la fila del contacto pide. Es el mismo que la escena de la
          // contraprueba del criterio enciende de verdad.
          enElPiso(ardiendo('fuego', 'madera', 0.4), EN(0, 0)),
          { body: cuerpo('pez', 'pescado', 2, {}, 'bloque'), at: EN(0, 0), supportedBy: 'fuego' },
          // Y otro más grande, LEJOS. 1 kg de madera ardiendo emite 300.
          enElPiso(ardiendo('otro', 'madera', 1), EN(d, 0)),
        ],
        actors: [actor('ana')],
      })
      const t = correr(w, 300)
      const dig = q(t, 'pez', 'digestibility')
      digestibilidades.push(dig)
      filas.push(
        `${String(d).padStart(16)} │ ${num(q(t, 'pez', 'temperature')).padStart(19)} │ ${num(dig)} │ ${dig >= 0.85 ? 'sí' : 'NO'}`,
      )
    }
    filas.push(
      '',
      '  ANTES las cinco daban 0,3800 (crudo). Hoy `entornoDe` ordena por calor entregado',
      '  —`potencia · formFactor(distancia, montaje)`— y el fuego pegado le gana al lejano solo.',
    )
    log(filas)

    // Las cinco cocinan, la de 1 celda incluida: el fuego de 1 kg a cualquier
    // distancia ya no le roba el hueco a la brasa que la comida tiene debajo.
    for (const dig of digestibilidades) expect(dig).toBeGreaterThanOrEqual(0.85)
    // Y el número que el bug dejaba es el control negativo: si alguna volviera a
    // 0,38, la ley 5 dejó de correr y el secuestro volvió.
    for (const dig of digestibilidades) expect(dig).not.toBeCloseTo(0.38, 3)
  })

  it('EL EMPATE POR NOMBRE: ARREGLADO — el abecedario ya no decide si cocina', () => {
    // ─── LO QUE ERA, Y NO ERA NO-DETERMINISMO: ERA PEOR ────────────────────
    //
    // `entornoDe` desempataba con `compararTexto(f.id, mejorId) < 0` sobre la
    // POTENCIA, o sea que con dos fuegos de potencia exactamente igual ganaba el id
    // alfabéticamente menor sin mirar dónde estaba. LOS DOS NÚMEROS QUE SALIERON:
    //
    //     fuego de contacto │ fuego a 6 celdas │ T del pez │ dig    │ ¿cocinó?
    //                 zorro │             alfa │   15.1577 │ 0.3800 │ NO
    //                  alfa │            zorro │   73.0813 │ 0.9438 │ SÍ
    //
    // La misma geometría, la misma potencia, la misma distancia, y decidía el nombre.
    // Es determinista y es arbitrario, y las dos cosas juntas eran lo malo: un bug
    // así no se ve nunca como una corrida que varía, se ve como un mundo donde
    // cocinar «a veces no anda».
    //
    // **Se arregló con el mismo cambio que el bloque de arriba**, y cae solo con él:
    // comparando por calor entregado, el fuego pegado le gana al lejano sin que el
    // nombre entre en la cuenta. El desempate por id sigue existiendo y sigue
    // haciendo falta —con dos fuentes de igual potencia, igual montaje e igual
    // distancia hay que elegir una y no puede ser «la primera del mapa»—, y eso está
    // medido aparte en `world/tests/la-fuente-se-elige-por-calor.test.ts`.
    const filas: string[] = ['fuego de contacto │ fuego a 6 celdas │ T del pez │ dig │ ¿cocinó?']
    const veredictos = new Map<string, boolean>()
    for (const [contacto, lejano] of [
      ['zorro', 'alfa'],
      ['alfa', 'zorro'],
    ] as const) {
      const w = mundo({
        bodies: [
          enElPiso(criatura('ana', 1000), EN(200, 200)),
          enElPiso(ardiendo(contacto, 'madera', 0.4), EN(0, 0)),
          { body: cuerpo('pez', 'pescado', 2, {}, 'bloque'), at: EN(0, 0), supportedBy: contacto },
          enElPiso(ardiendo(lejano, 'madera', 0.4), EN(6, 0)),
        ],
        actors: [actor('ana')],
      })
      const t = correr(w, 300)
      const dig = q(t, 'pez', 'digestibility')
      veredictos.set(contacto, dig >= 0.85)
      filas.push(
        `${contacto.padStart(17)} │ ${lejano.padStart(16)} │ ${num(q(t, 'pez', 'temperature')).padStart(9)} │ ${num(dig)} │ ${dig >= 0.85 ? 'SÍ' : 'NO'}`,
      )
    }
    log(filas)

    // Las dos cocinan: el nombre dejó de entrar en la cuenta.
    expect(veredictos.get('alfa')).toBe(true)
    expect(veredictos.get('zorro')).toBe(true)
  })

  it('LA PROMESA SE VENCE: `toxicity <= 0,05` dura entre 30 y 60 segundos, y nadie lo sabe', () => {
    // ─── QUÉ CLASE DE PROMESA ES UN `establishes` ──────────────────────────
    //
    // `FIRMA_DE_LO_COCIDO` promete `digestibility >= 0,85 ∧ toxicity <= 0,05`, y las
    // dos mitades envejecen distinto. La digestibilidad NO baja —nada la baja abajo
    // de 260 °C— y la toxicidad SÍ: apagado el fuego, la comida sale de su ventana
    // de cocción, la ley 6 vuelve a correr, y `toxicity` sube con la humedad. La
    // humedad, a su vez, la trae la ley 11 desde la celda.
    //
    // Y acá muerde el diagnóstico 8 del tramo anterior desde el otro lado: la celda
    // que `laOrilla()` llama seca mide `wet` 0,6000. Lo que ahogaba la yesca antes
    // de encender es lo que repudre el pescado después de cocinarlo.
    const o = laOrilla()
    const donde = celdasSecas(o, 1)[0] ?? { x: 0, y: 0 }
    const w = mundo({
      dios: o.dios,
      bodies: [
        enElPiso(criatura('ana', 1000), o.parada),
        enElPiso(ardiendo('fuego', 'madera', 0.4), donde),
        { body: cuerpo('pez', 'pescado', 2.887, {}, 'bloque'), at: donde, supportedBy: 'fuego' },
      ],
      actors: [actor('ana')],
    })
    const filas: string[] = ['ticks │ segundos │ dig │ tox │ calorías │ ¿la fila cumple? │ ¿`comer` lo acepta?']
    const medidas = new Map<number, { dig: number; tox: number; cal: number }>()
    for (const n of [300, 600, 1200, 2400, 6000, 20000]) {
      const t = correr(w, n)
      const m = { dig: q(t, 'pez', 'digestibility'), tox: q(t, 'pez', 'toxicity'), cal: q(t, 'pez', 'calories') }
      medidas.set(n, m)
      filas.push(
        `${String(n).padStart(5)} │ ${String(n / 20).padStart(8)} │ ${num(m.dig)} │ ${num(m.tox)} │ ${num(m.cal).padStart(8)} │ ${m.dig >= 0.85 && m.tox <= 0.05 ? 'sí' : 'NO'} │ ${m.tox <= 0.2 ? 'sí' : 'NO'}`,
      )
    }
    filas.push(
      '',
      '  El 0,2 de la última columna es la `toxicidadTolerada` de la innata `comer`.',
      '  O sea: a los 300 s de mundo la criatura se niega a comer lo que ella misma cocinó.',
    )
    log(filas)

    const a15 = medidas.get(300)
    const a30 = medidas.get(600)
    const a60 = medidas.get(1200)
    const a300 = medidas.get(6000)
    if (a15 === undefined || a30 === undefined || a60 === undefined || a300 === undefined) {
      throw new Error('el barrido no midió los cuatro puntos')
    }
    // Al terminar el `mientras` de la fila, la promesa se cumple. Eso es lo que el
    // banco de `@anima/plan` verifica, y está bien.
    expect(a15.dig).toBeGreaterThanOrEqual(0.85)
    expect(a15.tox).toBeLessThanOrEqual(0.05)
    // A los 30 s todavía; a los 60 ya no. La promesa tiene vencimiento y ni la fila
    // ni `Creencias` tienen dónde escribirlo.
    expect(a30.tox).toBeLessThanOrEqual(0.05)
    expect(a60.tox).toBeGreaterThan(0.05)
    // Y a los 300 s cruzó lo que el que come tolera: cocinar dejó de servir.
    expect(a300.tox).toBeGreaterThan(0.2)
    // La digestibilidad, en cambio, no se mueve: la mitad que envejece es una sola.
    expect(a300.dig).toBeCloseTo(a15.dig, 2)
    // Y las calorías se van con la nutrición que la ley 6 se lleva: 20,38 → 14,22.
    expect(a300.cal).toBeLessThan(a15.cal * 0.75)
    // EL PLAZO, Y QUÉ LO MOVIÓ: este bloque corre 300 s de mundo (6000 ticks) sobre
    // una escena con `dios`. Desde que el mundo materializa las `sueltas` del
    // decreto (`world/src/step.ts`, `abrirChunk`), esa escena tiene ~90 cuerpos más y
    // las doce leyes corren sobre todos. Los números de arriba no se movieron.
  }, 300_000)

  it.fails('HUECO · un `establishes` es una promesa sobre un INSTANTE y `Creencias` lo trata como durable', () => {
    // ─── POR QUÉ SIGUE ABIERTO, Y POR QUÉ NO SE ARREGLA DESDE ACÁ ──────────
    //
    // El bloque de arriba mide que la promesa se vence. Éste escribe lo que HARÍA
    // FALTA, para que quede contado como hueco y no como curiosidad: que la fila
    // pudiera decir CUÁNTO DURA lo que promete, o que `Creencias` supiera vencer una
    // creencia sobre una cualidad que la física relaja.
    //
    // Hoy no hay ni una cosa ni la otra. `ConstructionSchema.establishes` es una
    // `PredicateSignature` —un texto— y no tiene dónde escribir una vida útil;
    // `Creencias` guarda β por (meta, vía) y tampoco. Así que el plan promete
    // `toxicity <= 0,05`, lo cumple, y sesenta segundos después es falso sin que
    // nadie lo haya deshecho.
    //
    // LAS DOS SALIDAS, con su forma:
    //
    //   (a) un campo de vida útil en la CREENCIA y no en la fila —la fila dice qué
    //       establece, no cuánto aguanta el mundo—, y `Creencias` que lo mire antes
    //       de contestar «esto se puede».
    //   (b) que el plan de cocinar termine en `comer` y no en `sostener`, y entonces
    //       el vencimiento no llega a existir. Es el arreglo chico, y es además el
    //       que la cuenta del bloque 4 quiere; pero hoy `plan()` **no emite
    //       `Step.comer` en ninguna rama** —está afirmado en
    //       `plan/tests/la-cocina.test.ts`, `expect(emitidos.has('comer')).toBe(false)`—
    //       porque ningún `establishes` habla de la `stamina` de la criatura. Comer
    //       lo decide la escalera cuando la meta ya está cumplida, y eso es una
    //       decisión de diseño y no un olvido.
    //
    // Lo que se afirma acá es (a) en su forma más chica: que la promesa siga siendo
    // verdadera un minuto después de cumplirse. Falla, y va a fallar hasta que se
    // elija una de las dos.
    const o = laOrilla()
    const donde = celdasSecas(o, 1)[0] ?? { x: 0, y: 0 }
    const w = mundo({
      dios: o.dios,
      bodies: [
        enElPiso(criatura('ana', 1000), o.parada),
        enElPiso(ardiendo('fuego', 'madera', 0.4), donde),
        { body: cuerpo('pez', 'pescado', 2.887, {}, 'bloque'), at: donde, supportedBy: 'fuego' },
      ],
      actors: [actor('ana')],
    })
    const t = correr(w, 1200)
    log([
      `a los 60 s de mundo: dig ${num(q(t, 'pez', 'digestibility'))} · tox ${num(q(t, 'pez', 'toxicity'))}`,
      '  la fila prometió `toxicity <= 0,05` y ya no es cierto.',
    ])
    expect(q(t, 'pez', 'toxicity')).toBeLessThanOrEqual(0.05)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 2 · ¿SE QUEMA LA COMIDA?
// ════════════════════════════════════════════════════════════════════════════

describe('2 · el carbón: dónde está el borde y quién lo cuida', () => {
  it('con el techo de la fila NO se quema, y el margen contra el huevo es el último flotante', () => {
    // ─── POR QUÉ NO SE PUEDE QUEMAR POR ARRIBA DE LA FILA ──────────────────
    //
    // `charred` sólo se mueve si `avanceDeCarbon` entra, y entra sólo si
    // `piroliza`, que pide `pico >= pyrolysisAt`. En lo carnoso `pyrolysisAt` e
    // `ignitionPoint` coinciden, así que abajo de la ignición de la comida NO HAY
    // CARBÓN POSIBLE, se la deje una hora o veinte mil ticks.
    //
    // Y el techo de la fila del contacto —`emitsPower < 170,8333`— sale de
    // `potenciaPara(techoDelTag)`, donde el techo del tag es el `ignitionPoint` MÁS
    // BAJO de las seis carnosas: el huevo, 220. Contra el huevo el margen es
    // exactamente el último flotante; contra el pescado, que es lo que la cadena del
    // Hito 5 consigue, sobran 40,59 °C.
    const TECHO_DEL_CONTACTO = 170.8333333333333
    const conElTecho = temperaturaDeEquilibrio(TECHO_DEL_CONTACTO, 0, 'contacto')
    log([
      `con el fuego pegado al techo de la fila (emitsPower ${num(TECHO_DEL_CONTACTO)}) la comida queda en ${num(conElTecho)} °C`,
      `  el huevo se prende en   220 → margen ${num(220 - conElTecho)} °C`,
      `  el pescado se prende en 260 → margen ${num(260 - conElTecho)} °C`,
    ])
    expect(conElTecho).toBeLessThan(220)
    expect(conElTecho).toBeLessThan(260)

    // Y la contraprueba en el mundo: el pescado en el peor lugar admisible, veinte
    // mil ticks, y `charred` no se mueve de cero.
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 1000), EN(9, 9)),
        enElPiso(ardiendo('fuego', 'madera', 0.4), EN(0, 0)),
        { body: cuerpo('pez', 'pescado', 2, {}, 'bloque'), at: EN(0, 0), supportedBy: 'fuego' },
      ],
      actors: [actor('ana')],
    })
    const t = correr(w, 20_000)
    log([`veinte mil ticks del pescado apoyado en la brasa: charred ${num(q(t, 'pez', 'charred'))}`])
    expect(q(t, 'pez', 'charred')).toBe(0)
  })

  it('SÍ SE QUEMA, Y LO ÚNICO QUE LO EVITA ES EL `roleHint` DE LA PARRILLA', () => {
    // ─── EL AGUJERO QUE LA FILA TAPA, MEDIDO CON LA FILA MUTILADA ──────────
    //
    // La fila de la parrilla le pide al rol `parrilla` `ignitionPoint > 507`, y ese
    // 507 es `equilibrioSobre(maxima, 'contacto', 0)`: la parrilla está en CONTACTO
    // con el fuego, así que le toca la exposición más brava de las tres. Del
    // catálogo eso deja pasar sólo a la piedra (900).
    //
    // Acá se corren las dos, y lo que pasa con la de madera es una cascada: la
    // rejilla cruza sus 300 °C y EMPIEZA A EMITIR; con 1 kg emite 300, más que la
    // brasa de 0,8417 que emite 253; `entornoDe` la elige por potencia; y ahora la
    // comida está en CONTACTO con una fuente de 300 → 375 °C, arriba de sus 260. Y
    // ahí se prende ella también —el pescado tiene `fuelEnergy` 2— y su propia llama
    // la lleva a 892,43.
    //
    // O sea: ese `roleHint` no es una precaución, es lo único que hay entre el plan
    // y el carbón. El día que alguien lo relaje «porque una vara también sostiene»,
    // esto es lo que pasa.
    const filas: string[] = ['rejilla │ ¿ardió? │ T del pez │ charred │ dig │ nutrición │ calorías']
    const salidas = new Map<string, { charred: number; cal: number; dig: number }>()
    for (const mat of ['piedra', 'madera'] as const) {
      const w = mundo({
        bodies: [
          enElPiso(criatura('ana', 1000), EN(9, 9)),
          // La brasa del borde de abajo de la fila de la PARRILLA: 0,8417 kg → 253.
          enElPiso(ardiendo('fuego', 'madera', 0.8417), EN(0, 0)),
          { body: cuerpo('rejilla', mat, 1, {}, 'bloque'), at: EN(0, 0), supportedBy: 'fuego' },
          { body: cuerpo('pez', 'pescado', 2, {}, 'bloque'), at: EN(0, 0), supportedBy: 'rejilla' },
        ],
        actors: [actor('ana')],
      })
      const t = correr(w, 300)
      salidas.set(mat, {
        charred: q(t, 'pez', 'charred'),
        cal: q(t, 'pez', 'calories'),
        dig: q(t, 'pez', 'digestibility'),
      })
      filas.push(
        `${mat.padEnd(7)} │ ${q(t, 'rejilla', 'emitsPower') > 0 ? 'SÍ' : 'no'} │ ${num(q(t, 'pez', 'temperature')).padStart(9)} │ ${num(q(t, 'pez', 'charred'))} │ ${num(q(t, 'pez', 'digestibility'))} │ ${num(q(t, 'pez', 'nutrition'))} │ ${num(q(t, 'pez', 'calories'))}`,
      )
    }
    log(filas)

    const piedra = salidas.get('piedra')
    const madera = salidas.get('madera')
    if (piedra === undefined || madera === undefined) throw new Error('faltó una de las dos rejillas')
    // Con piedra: cocina y queda comida.
    expect(piedra.charred).toBe(0)
    expect(piedra.dig).toBeGreaterThanOrEqual(0.85)
    expect(piedra.cal).toBeGreaterThan(0)
    // Con madera: carbón. Y `nada-que-comer` en el mundo, porque `intencionComer`
    // rechaza cuando las calorías son cero.
    expect(madera.charred).toBeGreaterThan(0.5)
    // `digestibility × (1 − charred)` repetido trescientas veces no da CERO exacto en
    // IEEE-754: da 1,66e-65. Se afirma lo que la cuenta significa —que no queda nada—
    // y no el cero de imprenta, porque el cero de imprenta lo cambia el `hz`.
    expect(madera.dig).toBeLessThan(1e-6)
    expect(madera.cal).toBeLessThan(1e-6)
  })

  it('y lo que deja a la GRASA afuera no es el techo del montaje: es `fuelEnergy <= 21`', () => {
    // Barrido del catálogo: de todo lo que se prende frotando (`ignitionPoint <= 400`,
    // seco, `fuelEnergy > 0`), cuánto puede pesar como máximo para entrar en el techo
    // de la yesca (`heatCapacity <= 0,9`) y qué temperatura de contacto da ese máximo.
    //
    // La grasa da **285,54 °C**, o sea 25,54 por encima de la ignición del pescado:
    // hay materia encendible que carboniza la comida. Lo que impide que el plan la
    // ligue no es la ventana del montaje —esa la mira `emitsPower`, y 225,45 la
    // supera— sino la banda de `fuelEnergy` de las dos filas de encender, que sale de
    // las sustancias que la fila ya admitía y topa en 21. La grasa tiene 30.
    //
    // Vale decirlo porque es una defensa INDIRECTA: si mañana el dios inventa una
    // sustancia con `fuelEnergy` 20 y calor específico 0,9, la banda la deja pasar,
    // pesa 1 kg y emite 334.
    const filas: string[] = ['sustancia │ fuelEnergy │ masa que entra en 0,9 │ emitsPower │ T en contacto │ ¿pasa el techo 170,83?']
    let peligrosas = 0
    for (const s of SUSTANCIAS_SEMILLA) {
      const fe = s.perUnitMass.fuelEnergy ?? 0
      const ig = s.perUnitMass.ignitionPoint
      if (fe <= 0 || ig === undefined || ig > 400) continue
      if ((s.perUnitMass.moisture ?? 0) >= HUMEDAD_QUE_APAGA) continue
      const masa = 0.9 / s.specificHeat
      const p = fe * masa * 16.7
      const tc = temperaturaDeEquilibrio(p, 0, 'contacto')
      if (tc >= 260) peligrosas++
      filas.push(
        `${s.id.padEnd(11)} │ ${num(fe).padStart(10)} │ ${num(masa).padStart(20)} │ ${num(p).padStart(10)} │ ${num(tc).padStart(13)} │ ${p < 170.8333333333333 ? 'sí' : 'NO'}`,
      )
    }
    log(filas)
    // Hay al menos una sustancia encendible que pondría el pescado por encima de su
    // punto de ignición. Que hoy no llegue al plan es cierto y es por otra puerta.
    expect(peligrosas).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 3 · ¿LA MENTE SABE CUÁNDO SACARLA?
// ════════════════════════════════════════════════════════════════════════════

describe('3 · la espera es ciega, y lo que cuesta que lo sea', () => {
  it('el pescado está cocido a los 5 s y la fila la hace esperar 15: un fuego, un bocado', () => {
    // `mente.ts` lo dice con todas las letras en el `case 'esperar'`: la innata sabe
    // muestrear con `rateOf` y despertarse cuando la cualidad llega, y no se le pasa
    // `hasta` ni `mirando` porque eso vive en el `establishes` de la fila y ese
    // archivo no lo despeja. Acá está el precio, medido: no en despertadas —eso ya
    // estaba contado— sino en SEGUNDOS DE FUEGO.
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 1000), EN(9, 9)),
        enElPiso(ardiendo('fuego', 'madera', 0.4), EN(0, 0)),
        { body: cuerpo('pez', 'pescado', 2, {}, 'bloque'), at: EN(0, 0), supportedBy: 'fuego' },
      ],
      actors: [actor('ana')],
    })
    const filas: string[] = ['s │ emitsPower del fuego │ dig │ tox │ ¿ya está cocido?']
    let listoEn = -1
    let seApagoEn = -1
    for (let s = 0; s <= 20; s++) {
      const t = correr(w, s * 20)
      const dig = q(t, 'pez', 'digestibility')
      const tox = q(t, 'pez', 'toxicity')
      const pot = q(t, 'fuego', 'emitsPower')
      if (listoEn < 0 && dig >= 0.85 && tox <= 0.05) listoEn = s
      if (seApagoEn < 0 && pot <= 0) seApagoEn = s
      filas.push(
        `${String(s).padStart(2)} │ ${num(pot).padStart(19)} │ ${num(dig)} │ ${num(tox)} │ ${dig >= 0.85 && tox <= 0.05 ? 'SÍ' : ''}`,
      )
    }
    filas.push(
      '',
      `  cocido a los ${String(listoEn)} s · el fuego se apaga a los ${String(seApagoEn)} s · la fila hace esperar 15 s`,
      '  o sea que la espera se come el fuego entero y lo que sobra no alcanza para un segundo bocado.',
    )
    log(filas)

    // El mecanismo, no el reloj: la comida está lista MUCHO antes de que la espera
    // termine, y el fuego no sobrevive a la espera con margen para otra pieza.
    expect(listoEn).toBeGreaterThan(0)
    expect(listoEn).toBeLessThan(15)
    expect(seApagoEn).toBeGreaterThan(15)
    // Y LO QUE SALE DE AHÍ: un fuego no aguanta DOS esperas. Medido, dura 20 s y la
    // fila pide 15, así que la segunda pieza empezaría a cocinarse con el fuego ya
    // apagado. Ése es el techo duro de «un fuego, un bocado», y no depende de que la
    // criatura sea rápida: depende de que la espera sea ciega.
    expect(seApagoEn).toBeLessThan(2 * 15)
    // Sobra menos de lo que tardó la primera pieza más un ir y un sostener.
    expect(seApagoEn - 15).toBeLessThanOrEqual(listoEn)
  })

  it('ARREGLADO: la corrida real ponía en el 151 y levantaba en el 454; hoy levanta en el 253', () => {
    // ─── LO QUE ERA, Y CON QUÉ SE CERRÓ ────────────────────────────────────
    //
    // Este bloque midió la espera ciega en la corrida de verdad —`poner` en el 151,
    // `esperar(15s)` en el 153, `sostener` en el **454**: 301 ticks sin que nadie
    // mire la comida— y `mente.ts` ya tenía escrito el porqué: la innata sabe
    // muestrear y despertarse cuando la cualidad llega, y para eso hay que nombrarle
    // la cualidad y el umbral, que viven en el `establishes` de la fila.
    //
    // Se cosió: `@anima/plan` despeja las condiciones con `interpretar` y las manda
    // en `Step.esperar.mirando` (ver `esperarPor` en `regresion.ts`), y `mente.ts`
    // arma el cierre `hasta`. **La espera pasó de 301 ticks a 100** —los 5 s en que
    // la comida está lista de verdad— y el bocado se adelantó del tick 457 al 257.
    //
    // Lo que eso le devuelve al fuego: de los 20 s que dura, la espera se llevaba 15
    // y ahora se lleva 5. El techo de «un fuego, un bocado» sube a tres o cuatro. Y
    // NO alcanza para dar vuelta la cuenta del bloque 4 —81,5 contra 553,71 sigue
    // siendo 6,8× negativo—, que es exactamente lo que este archivo advirtió que iba
    // a pasar si se hacía esto primero.
    const r = correrConMente(conLenaSeca(1000), 700)
    const interesantes = r.vuelos.filter((v) =>
      ['frotar', 'poner', 'esperar', 'sostener', 'tragar', 'comer'].some((k) => v.nombre.startsWith(k)),
    )
    log([
      'tick │ despegue │ aliento antes │ aliento después │ Δ',
      ...interesantes.map(
        (v) =>
          `${String(v.tick).padStart(4)} │ ${v.nombre.padEnd(26)} │ ${num(v.antes).padStart(13)} │ ${num(v.despues).padStart(15)} │ ${num(v.despues - v.antes)}`,
      ),
    ])
    const puso = r.vuelos.find((v) => v.nombre.startsWith('poner'))
    const espero = r.vuelos.find((v) => v.nombre.startsWith('esperar'))
    const levanto = r.vuelos.find((v) => v.nombre.startsWith('sostener') && v.tick > (espero?.tick ?? 0))
    if (puso === undefined || espero === undefined || levanto === undefined) {
      throw new Error('la corrida no llegó a poner, esperar y levantar')
    }
    // La espera dura lo que la COCCIÓN dura y no lo que la cota dice: 100 ticks
    // (5 s) y no 301 (15 s). Se afirma el mecanismo con margen y no el 100 exacto,
    // porque el tick en que la `digestibility` cruza 0,85 lo mueve cualquier
    // recalibración de la ley 5 — lo que no se puede mover sin que esto sea otra cosa
    // es que corte MUY por debajo de la cota.
    const espera = levanto.tick - espero.tick
    log([`la espera duró ${String(espera)} ticks de los 300 que la cota permite`])
    expect(espera).toBeGreaterThan(0)
    expect(espera).toBeLessThan(200)
    expect(espero.tick - puso.tick).toBeLessThan(5)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 4 · LA CUENTA — Y ES LA QUE MATA EL CRITERIO
// ════════════════════════════════════════════════════════════════════════════

describe('4 · lo que cuesta el fuego contra lo que rinde el bocado, en la misma unidad', () => {
  it('EL HALLAZGO: cocinar cuesta 553,71 de aliento y agrega 11,60', () => {
    // Las dos mitades de la cuenta, cada una leída de donde vive:
    //
    //   · lo que AGREGA cocinar sale de `calories = nutrition × mass × digestibility`,
    //     preguntado al motor sobre el MISMO cuerpo antes y después de los 15 s;
    //   · lo que CUESTA el fuego sale de `aplicarEfectos` del mundo, caso `drive`:
    //     `heatCapacity × ΔT / eficiencia` de `stamina`, con la eficiencia 0,35 de la
    //     fricción y el ΔT que va del ambiente a la ignición de la madera.
    //
    // Y las dos están en la misma unidad, que es la que decide el criterio (2):
    // `STAMINA_POR_CALORIA = 1`, y `COSTO_VIVIR_POR_SEGUNDO / hz` = 0,05 por tick, o
    // sea que el tanque de 1000 son exactamente 20.000 ticks de vida sin comer.
    const arma = (): WorldState =>
      mundo({
        bodies: [
          enElPiso(criatura('ana', 1000), EN(9, 9)),
          enElPiso(ardiendo('fuego', 'madera', 0.4), EN(0, 0)),
          { body: cuerpo('pez', 'pescado', 2.887, {}, 'bloque'), at: EN(0, 0), supportedBy: 'fuego' },
        ],
        actors: [actor('ana')],
      })
    const crudo = arma()
    const cocido = correr(arma(), 300)
    const calCrudo = q(crudo, 'pez', 'calories')
    const calCocido = q(cocido, 'pez', 'calories')
    const yesca = cuerpo('y', 'madera', 0.4)
    const hc = qualityOf(yesca, 'heatCapacity', PHYS)
    const precio = (hc * (300 - 15)) / 0.35
    log([
      `pescado de 2,887 kg CRUDO  → calorías ${num(calCrudo)}  (dig ${num(q(crudo, 'pez', 'digestibility'))} · tox ${num(q(crudo, 'pez', 'toxicity'))})`,
      `pescado de 2,887 kg COCIDO → calorías ${num(calCocido)} (dig ${num(q(cocido, 'pez', 'digestibility'))} · tox ${num(q(cocido, 'pez', 'toxicity'))})`,
      '',
      `lo que cocinar AGREGA      → ${num(calCocido - calCrudo)} de aliento`,
      `lo que CUESTA el fuego     → heatCapacity ${num(hc)} × 285 / 0,35 = ${num(precio)}`,
      `la razón                   → ${num(precio / (calCocido - calCrudo))} a 1 EN CONTRA`,
      '',
      '  Y la yesca más chica que la fila admite (0,3506875 kg) cuesta 485,45: el piso',
      '  de la banda no es una elección de este banco, es el borde de abajo de la ventana.',
    ])

    // ─── Y NO HAY SALIDA POR COMERLO CRUDO ─────────────────────────────────
    //
    // Que es lo que convierte esta cuenta en el criterio y no en una ineficiencia:
    // `comer` filtra con `ctx.q(b,'toxicity') <= veneno` y `veneno` es 0,2 por
    // omisión, y el pescado crudo trae 0,25 del catálogo. O sea que cocinar es la
    // ÚNICA puerta, y cuesta 27 veces lo que da.
    const TOLERANCIA_DE_COMER = 0.2
    const toxCrudo = q(crudo, 'pez', 'toxicity')
    log([
      `el pescado crudo tiene toxicity ${num(toxCrudo)} y \`comer\` tolera ${num(TOLERANCIA_DE_COMER)}: NO se puede comer crudo`,
      `o sea que el fuego no es una mejora opcional, y devuelve ${num((calCocido / precio) * 100)}% de lo que cuesta`,
    ])
    expect(toxCrudo).toBeGreaterThan(TOLERANCIA_DE_COMER)

    // Cocinar sirve: casi triplica las calorías. Eso es verdad y hay que decirlo.
    expect(calCocido).toBeGreaterThan(calCrudo * 2)
    // Y el fuego que hace falta para conseguirlo cuesta más de CUARENTA VECES lo que
    // esa mejora rinde. La conclusión no es «el tanque es chico»: es que el signo
    // está mal, y un tanque más grande lo empeora porque deja encender más fuegos.
    expect(precio).toBeGreaterThan((calCocido - calCrudo) * 40)
    // Y también más que el bocado ENTERO, crudo o cocido: el fuego no se paga ni
    // regalando el pescado.
    expect(precio).toBeGreaterThan(calCocido * 25)
  })

  it('LA CORRIDA DE VERDAD: −231,23 por el fuego, +19,84 por el bocado', () => {
    const r = correrConMente(conLenaSeca(1000), 700)
    const frota = r.vuelos.find((v) => v.nombre.startsWith('frotar'))
    const espera = r.vuelos.find((v) => v.nombre.startsWith('esperar'))
    const traga = r.vuelos.find((v) => v.nombre.startsWith('tragar') || v.nombre.startsWith('comer'))
    if (frota === undefined || espera === undefined || traga === undefined) {
      throw new Error('la corrida no encendió, esperó y comió: la cuenta no se puede leer')
    }
    const dFrota = frota.despues - frota.antes
    const dEspera = espera.despues - espera.antes
    const dTraga = traga.despues - traga.antes
    log([
      'lo que la cadena de la cocción movió, leído de la corrida:',
      `  ${String(frota.tick).padStart(4)}  ${frota.nombre.padEnd(26)} ${num(frota.antes).padStart(10)} → ${num(frota.despues).padStart(10)}   ${num(dFrota)}`,
      `  ${String(espera.tick).padStart(4)}  ${espera.nombre.padEnd(26)} ${num(espera.antes).padStart(10)} → ${num(espera.despues).padStart(10)}   ${num(dEspera)}`,
      `  ${String(traga.tick).padStart(4)}  ${traga.nombre.padEnd(26)} ${num(traga.antes).padStart(10)} → ${num(traga.despues).padStart(10)}   ${num(dTraga)}`,
      `  ${' '.repeat(70)}────────────`,
      `  ${' '.repeat(70)}${num(dFrota + dEspera + dTraga)}`,
    ])
    // ─── EL FUEGO PASÓ DE MEDIO TANQUE A UN CUARTO, Y EL SIGNO NO CAMBIÓ ───
    //
    // Esto decía «el fuego se lleva más de la mitad del tanque lleno» y lo afirmaba
    // con `dFrota < -500`: eran −561,99. Con la eficiencia de `friccion` en 0,85
    // (tramo N) son **−231,23**, o sea el 23% del tanque. Se afirma la banda de los
    // dos lados —menos de medio tanque, más de cien— porque lo que este bloque mide
    // es la PROPORCIÓN entre lo que el fuego cuesta y lo que el bocado devuelve, y
    // esa proporción sigue siendo la misma historia con otro número.
    expect(dFrota).toBeGreaterThan(-500)
    expect(dFrota).toBeLessThan(-100)
    // El bocado devuelve menos del 10% de eso. Era menos del 5%, y no subió porque
    // el bocado rinda más: sube porque el fuego bajó. El bocado no se movió.
    expect(dTraga).toBeGreaterThan(0)
    expect(dTraga).toBeLessThan(-dFrota * 0.1)
    // Y LA CADENA ENTERA SIGUE SIENDO NEGATIVA, que es lo que el bloque vino a
    // decir: encender, esperar y comer deja a la criatura peor que si no hubiera
    // hecho nada. Abaratar el fuego 2,43× no dio vuelta el signo, lo acercó.
    expect(dFrota + dEspera + dTraga).toBeLessThan(-100)
  })

  it('20.000 TICKS: con tres manos LLEGA VIVA, y con más manos muere en el 1210', () => {
    // ─── LA NO-MONOTONÍA, QUE ES LA QUE DELATA EL SIGNO ────────────────────
    //
    // Con tres manos la criatura enciende UNA vez y se queda con el tizón apagado en
    // la mano —`lena1`, 0,024 kg, `rigidity` 0,3, `fuelEnergy` 0—, así que las tres
    // manos quedan tomadas (la caña, el tizón y un pescado crudo) y no puede levantar
    // ninguna de las otras tres leñas de 0,40 kg que siguen en el suelo. Nunca vuelve
    // a encender.
    //
    // ─── Y LA DE TRES AHORA LLEGA VIVA, que es el ancla del fondo cobrando ──
    //
    // Este título decía «muere en el 5744». De qué se moría estaba medido al lado,
    // en el 6/6 del criterio: no del fuego sino del PASEO — el fondo deambulaba y
    // las patas eran el 65% del gasto. Con el ancla (`hayAncla` + `yaDeambulePor`
    // en `mind/src/escalera.ts`, número 35 de la sección 5) la criatura del tizón
    // espera al lado de su pozo en vez de pasearse, y el mismo tanque que antes
    // duraba 5744 ticks ahora cubre los 20.000 con 116,7 de sobra: **la escena
    // buena cumple el criterio (2) por primera vez con la cadena de verdad**, un
    // bocado y todo.
    //
    // Con seis manos SÍ puede volver a encender, enciende dos veces, y se muere en
    // el 361. Un recurso MÁS convierte una viva en una muerta, y eso no es un bug
    // de la mente: es la cuenta del bloque de arriba haciéndose visible. Cuando una
    // capacidad extra empeora el resultado, lo que está mal es el signo de la
    // actividad que habilita — y la no-monotonía quedó MÁS cruda que antes, no
    // menos: era 5744 contra 574, ahora es viva contra 361.
    const filas: string[] = ['manos │ frotar │ poner │ tragar │ murió en │ aliento final']
    const porManos = new Map<number, Corrida>()
    for (const cap of [3, 6]) {
      const r = correrConMente(conLenaSeca(1000, cap), 20_000)
      porManos.set(cap, r)
      filas.push(
        `${String(cap).padStart(5)} │ ${String(r.cuenta.get('frotar') ?? 0).padStart(6)} │ ${String(r.cuenta.get('poner') ?? 0).padStart(5)} │ ${String((r.cuenta.get('tragar') ?? 0) + (r.cuenta.get('comer') ?? 0)).padStart(6)} │ ${String(r.murioEn).padStart(8)} │ ${num(r.alientoFinal)}`,
      )
    }
    filas.push(
      '',
      '  Y ésta es la escena BUENA: leña seca del tamaño justo, en celdas de verdad secas,',
      '  con el tanque lleno y el río al lado. La del documento muere en el 3627 con cero bocados.',
    )
    log(filas)

    const tres = porManos.get(3)
    const seis = porManos.get(6)
    if (tres === undefined || seis === undefined) throw new Error('faltó una de las dos corridas')
    // Con tres manos: cocina UNA vez en veinte mil ticks…
    expect(tres.cuenta.get('poner') ?? 0).toBe(1)
    expect((tres.cuenta.get('tragar') ?? 0) + (tres.cuenta.get('comer') ?? 0)).toBe(1)
    // …y LLEGA: anclada, el criterio (2) se cumple en la escena buena.
    expect(tres.murioEn).toBe(-1)
    expect(tres.alientoFinal).toBeGreaterThan(100)
    // La no-monotonía, que es el hallazgo: más manos, más fuegos, y la que podía
    // volver a encender es la que se muere.
    //
    // EL TICK SE CORRIÓ DEL 361 AL 1210 CON LA EFICIENCIA EN 0,85 (tramo N), y el
    // hallazgo NO se movió ni un poco: la de tres manos llega viva a los 20.000 y la
    // de seis se muere en el primer 6% de la partida. Abaratar el fuego 2,43× le
    // compró 849 ticks a la que se mata encendiendo, y sigue matándose. **Eso es lo
    // que quiere decir que el problema sea el SIGNO y no el precio**: mover el
    // precio corre el tick de la muerte y no la cambia de lado.
    expect(seis.cuenta.get('frotar') ?? 0).toBeGreaterThan(tres.cuenta.get('frotar') ?? 0)
    expect(seis.murioEn).toBeGreaterThan(0)
    expect(seis.murioEn).toBeLessThan(20_000 / 10)
  }, 300_000)
})

// ════════════════════════════════════════════════════════════════════════════
// 5 · NO-DETERMINISMO — EL FRENTE QUE SE CIERRA EN FALSO
// ════════════════════════════════════════════════════════════════════════════
//
// Se buscó y NO HAY. Va igual, porque un frente cerrado con la medición al lado vale
// lo mismo que uno abierto: el próximo no tiene que volver a buscar acá.

type Cualidades = Partial<Record<QualityId, number>>

const COMIDA_SANA: Predicado = { k: 'sostiene', tag: 'carnoso', tests: [{ q: 'toxicity', op: '<=', v: 0.2 }] }

function cortoDe(s: Step): string {
  const ref = (r: { k: string; id?: string } | undefined): string =>
    r === undefined ? '-' : r.k === 'id' ? (r.id ?? '?') : r.k === 'rinde' ? 'lo-que-hice' : r.k
  switch (s.k) {
    case 'ir':
      return `ir(${ref(s.a)})`
    case 'poner':
      return `poner(${ref(s.que)} sobre ${ref(s.sobre)})`
    case 'sostener':
      return `sostener(${ref(s.que)})`
    case 'unir':
      return `unir(${ref(s.binder)}+${ref(s.a)})`
    case 'deshilachar':
      return `deshilachar(${ref(s.fuente)})`
    case 'frotar':
      return `frotar(${ref(s.a)}×${ref(s.b)})`
    case 'aplicar':
      return `aplicar(${s.proceso})`
    case 'esperar':
      return `esperar(${String(s.segundos)}s)`
    default:
      return s.k
  }
}

/**
 * El río de `plan/tests/la-cocina.test.ts` con DOS candidatos empatados al mismo
 * rol, y la opción de darle la vista al revés.
 *
 * Los dos gemelos son idénticos en todo lo que la fila mira y están a distancias
 * DISTINTAS de la criatura, que es lo que hace que el empate se pueda romper de dos
 * maneras (por orden de `see` o por cercanía) y que se pueda ver cuál de las dos
 * pasó.
 */
function laVista(caso: 'dos piedras' | 'dos fuegos', ids: readonly string[], alReves: boolean): VistaDelPlan {
  const fuego: Cualidades = { mass: 1, emitsPower: 300, temperature: 400, ignitionPoint: 300, fuelEnergy: 18 }
  const piedra: Cualidades = { mass: 0.5, ignitionPoint: 900, rigidity: 0.9 }
  const cuerpos: { id: string; x: number; y: number; q: Cualidades }[] = [
    { id: 'matorral', x: 2, y: 0, q: { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 } },
    { id: 'vara', x: 5, y: 0, q: { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 } },
    { id: 'pozo', x: 8, y: 0, q: { mass: 50 } },
    ...(caso === 'dos piedras'
      ? [
          { id: 'fogata', x: 2, y: 1, q: fuego },
          { id: ids[0] ?? 'a', x: 1, y: 0, q: piedra },
          { id: ids[1] ?? 'b', x: 4, y: 3, q: piedra },
        ]
      : [
          { id: 'piedra', x: 1, y: 0, q: piedra },
          { id: ids[0] ?? 'a', x: 2, y: 1, q: fuego },
          { id: ids[1] ?? 'b', x: 4, y: 3, q: fuego },
        ]),
  ]
  const lista = alReves ? [...cuerpos].reverse() : cuerpos
  const qde = (b: { id: string }, cual: QualityId): number => {
    if (b.id === 'yo' && cual === 'stamina') return 1000
    const puesta = lista.find((c) => c.id === b.id)?.q[cual]
    if (puesta !== undefined) return puesta
    // `portable` es derivada del catálogo; acá alcanza con la forma monótona, porque
    // lo que este bloque mide es el ORDEN de la ligadura y no un umbral de masa.
    if (cual === 'portable') {
      const m = lista.find((c) => c.id === b.id)?.q.mass ?? 0
      return m <= 0 ? 1 : m >= 20 ? 0 : 1 - m / 20
    }
    return 0
  }
  return {
    see: (donde) =>
      lista
        .filter((c) =>
          donde.every((t) => {
            const x = qde(c, t.q)
            return t.op === '>=' ? x >= t.v : t.op === '<=' ? x <= t.v : t.op === '>' ? x > t.v : x < t.v
          }),
        )
        .map((c) => ({ id: c.id, at: { x: c.x, y: c.y }, name: c.id, tags: [], madeByMe: false, joints: [] })),
    recall: () => [],
    q: (b, cual) => qde(b, cual),
    qAt: (at, cual) => (cual === 'wet' && at.x === 8 && at.y === 0 ? 1 : 0),
    self: {
      id: 'yo',
      at: { x: 0, y: 0 },
      name: 'criatura',
      tags: [],
      madeByMe: false,
      joints: [],
      holding: [],
      capacity: 3,
      stamina: 1000,
      permits: 'irreversible',
    },
    clock: { phase: 'dia', secondsToNightfall: 100, dayLength: 200 },
  }
}

describe('5 · dos candidatos empatados al mismo rol, con la vista al derecho y al revés', () => {
  it('el planificador emite el MISMO plan en las cuatro corridas', () => {
    const salidas = new Map<string, string>()
    const filas: string[] = []
    for (const orden of ['derecho', 'al revés'] as const) {
      for (const caso of ['dos piedras', 'dos fuegos'] as const) {
        const ids = caso === 'dos piedras' ? ['piedraA', 'piedraB'] : ['fogataA', 'fogataB']
        const r = plan({ id: 'g0', goal: COMIDA_SANA, after: [], porque: 'el ataque' }, laVista(caso, ids, orden === 'al revés'), 500)
        const pasos = r.k === 'plan' ? r.steps.map(cortoDe).join(' · ') : r.k
        salidas.set(`${caso}|${orden}`, pasos)
        filas.push(`${caso.padEnd(12)} │ vista ${orden.padEnd(9)} │ ${pasos}`)
      }
    }
    log(filas)
    // Cuatro corridas, dos planes: uno por caso, y el orden de la vista no lo mueve.
    expect(salidas.get('dos piedras|derecho')).toBe(salidas.get('dos piedras|al revés'))
    expect(salidas.get('dos fuegos|derecho')).toBe(salidas.get('dos fuegos|al revés'))
    // Y en los dos casos hay plan y no `gap`: el empate no lo bloquea.
    for (const s of salidas.values()) expect(s).toContain('esperar')
  })
})
