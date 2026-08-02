// ═══ EL BANCO DE LA MENTE: las cohortes del criterio, repartidas ═════════════
//
// Acá viven la corrida canónica (tanque 310) y su control (tanque 1000): la
// definición de UNA partida (`correrPartida`), el banco de veinte
// (`correrElBanco`) y el reparto entre archivos. Vivían adentro de
// `hito-5-la-emergencia.test.ts`; se mudaron por la misma razón por la que el
// control del azar vive en `azar.ts`: **la unidad de paralelismo de vitest es el
// archivo**, y las dos cohortes son 40 partidas de 20.000 ticks corridas de a
// una — ~13 de los ~17 minutos del banco caro, medido en la corrida del tramo Ñ
// (747 s el paquete entero, con las dos cohortes secuenciales adentro de un solo
// archivo mientras las cinco tandas del azar ya corrían en paralelo).
//
// El reparto es EL MISMO de `azar.ts`, patrón por patrón: cada partida se guarda
// en `node_modules/.azar/banco-<tanque>-<tope>/<semilla>.json`, cinco archivos
// «tanda» (`el-banco-tanda-N.test.ts`) se reparten las veinte semillas de a
// cuatro —cada una con sus DOS tanques— y los consumidores leen del disco lo que
// ya está y corren lo que falte. El candado es un `mkdir`, que falla si existe y
// por eso es atómico hasta en Windows; el `globalSetup` (`el-azar-global.ts`)
// borra `.azar/` entero antes de que arranque ningún worker, así que un veredicto
// de una corrida anterior —otro árbol, otra mente— no puede colarse.
//
// ─── POR QUÉ REPARTIR NO PUEDE MOVER UN NÚMERO ─────────────────────────────
//
// **No se acorta ni una partida ni un tick.** Cada partida es función pura de
// `(semilla, tanque, tope)`: `laOrilla(semilla)` arma una `Physics` NUEVA por
// llamada —la caché del decreto no puede cruzar de una partida a otra—, la
// `Mente` y el `Detector` nacen adentro, y no se consulta reloj de pared ni
// dado global. Correr la semilla 20260731 en otro proceso da byte por byte lo
// mismo. Y los consumidores agregan con sumas y conteos (`resumir` cuenta
// filas), así que el orden en que llegan las veinte tampoco mueve una cifra.
// La verificación de este refactor fue la de la casa: las tablas del banco,
// antes y después, renglón por renglón.
//
// ─── QUÉ VIAJA POR EL DISCO, y las dos trampas de serializar ───────────────
//
// `Corrida` tiene dos campos que `JSON.stringify` pierde EN SILENCIO: `semilla`
// es `bigint` (lanza) y `vuelos` es un `Map` (se convierte en `{}`). Viajan como
// texto y como pares, y `deDisco` los reconstruye. El resto —veredicto,
// situaciones, violaciones— es dato plano de punta a punta.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { cumpleRol, EXTRACCION, qualityOf } from '@anima/physics'
import type { Body } from '@anima/physics'
import {
  COSTO_POR_TOXICIDAD_Y_KILO,
  decretoDe,
  hashWorldState,
  STAMINA_POR_CALORIA,
} from '@anima/world'
import type { Placement, Violacion } from '@anima/world'
import { Partida } from '@anima/perceive'
import { Creencias, Mente } from '@anima/mind'

import { Detector, potenciaSiArdiera, ROL_A_DE_FRICCION } from '../src/index.js'
import type { Situaciones, Veredicto } from '../src/index.js'
import {
  escenaDe,
  firmaDeSueltas,
  laOrilla,
  PARTIDAS,
  RADIO_EN_CHUNKS,
  respirar,
  semillasQueSeJuegan,
} from './el-mundo-decretado.js'

/** Ver el encabezado del consumidor: acá el gatillo es el COSTO y no la varianza. */
export const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

/** §10: 20.000 ticks a 20 Hz = 1000 s de mundo, la ventana con la que está medida la economía. */
export const TICKS = 20_000

/**
 * EL TANQUE DE ARRANQUE, publicado como §3 exige («el tanque de arranque decide
 * si el criterio se puede medir»).
 *
 * 310 y no 1000, y el motivo es de la mente y no del juez: con el tanque lleno
 * `energia` vale 0,0025 y D3 no elige comida, así que la criatura ni siquiera va
 * al río (`mind/tests/hito-5-el-criterio.test.ts`, la escena del documento). 310
 * es el número con el que la cadena de la caña sale sola, o sea el único con el
 * que el Hito 5 tiene una corrida canónica. El otro se corre igual, como control.
 */
export const TANQUE = 310

/** El control de §3: el tanque entero. Es el que separa «no llega» de «no vivió». */
export const TANQUE_LLENO = 1000

/** Cuántas partidas del banco se corren cuando NO se está midiendo en serio. */
export const PARTIDAS_CORTAS = 3

/**
 * Y los TICKS del muestreo, que es donde estaba el costo de verdad.
 *
 * Acortar de 20 partidas a 3 sin tocar los ticks dejaba 60.000 ticks: medido,
 * el archivo seguía tardando 592 s. El costo no está en cuántas partidas hay
 * sino en cuántos ticks se corren, y por eso las dos cosas se acortan juntas.
 *
 * 2.000 ticks son 100 segundos de mundo: alcanza para que la cadena de la caña
 * ocurra entera —el pescado entra a la mano en el tick 109— y para que los
 * detectores tengan de dónde disparar. Lo que NO alcanza es para el veredicto,
 * y por eso el veredicto sale de `ANIMA_BANCO=1`.
 */
export const TICKS_CORTOS = 2_000

/** Las que corre una corrida de HOY, con el gatillo de hoy. Una sola fuente. */
export const PARTIDAS_DEL_BANCO = MIDIENDO_EN_SERIO ? PARTIDAS : PARTIDAS_CORTAS
export const TICKS_DEL_BANCO = MIDIENDO_EN_SERIO ? TICKS : TICKS_CORTOS

/** Los dos tanques del criterio, con nombre, para que tandas y consumidores nombren lo MISMO. */
export const LAS_DOS_COHORTES = [TANQUE, TANQUE_LLENO] as const

// ─── La corrida de una partida ───────────────────────────────────────────────

export interface Corrida {
  readonly semilla: bigint
  readonly cx: number
  readonly cy: number
  readonly parada: Placement
  /** Ticks que avanzó el mundo. Se CORTA en la muerte: ver el encabezado del bucle. */
  readonly ticks: number
  /** El tick en que la criatura se fue de `state.actors`, o `-1` si llegó viva. */
  readonly murioEn: number
  readonly alientoFinal: number
  readonly veredicto: Veredicto
  /** Los nueve contra-detectores de ESTA partida, para poder decir CUÁL faltó. */
  readonly situaciones: Situaciones
  /** Qué habilidades despegaron y cuántas veces. El denominador de todo diagnóstico. */
  readonly vuelos: ReadonlyMap<string, number>
  /**
   * CUERPOS QUE NACIERON DE UN PROCESO, y cuántos de ellos tenían calorías.
   *
   * ─── POR QUÉ ESTA COLUMNA REEMPLAZA A «pescas», y no es un detalle ─────────
   *
   * La corrida anterior publicaba `pescas` contando DESPEGUES de
   * `aplicar(extraccion)`, y el proyecto entero leyó ese número como pescados:
   * «pescó 199 y le faltaban 83» (`mind/tests/hito-5-el-criterio.test.ts`).
   * Medido acá, en la misma semilla: 198 extracciones COMPLETAS y **dos cuerpos
   * comestibles nacidos en toda la partida**. Un despegue no es un proceso
   * completo y un proceso completo no es una pieza: el que rinde es el dado del
   * mundo contra el `catch` del aparejo, y el pozo tiene `capacity: 1`.
   */
  readonly nacidos: number
  readonly comestibles: number
  /** Procesos `extraccion` COMPLETOS. Ni despegues ni piezas: lo del medio. */
  readonly extraccionesCompletas: number
  /** Lo que el MUNDO narró de comer, que es la única verdad sobre bocados. */
  readonly comio: number
  readonly enveneno: number
  /**
   * EL MEJOR BOCADO QUE EL MUNDO OFRECIÓ ALGUNA VEZ, en stamina neta.
   *
   * `calories · STAMINA_POR_CALORIA − toxicity · masa · COSTO_POR_TOXICIDAD_Y_KILO`,
   * o sea las dos mitades de `intencionComer` (ADR II-0013) con las dos constantes
   * IMPORTADAS del motor y no copiadas. Se calcula sobre todo cuerpo con calorías
   * que no sea una criatura, en todos los ticks.
   *
   * Es una COTA SUPERIOR y a propósito: la mente topa lo acreditado contra lo que
   * todavía entra en el tanque y acá no se topa nada. Si hasta la cota es
   * negativa, no hubo un solo bocado que valiera la pena en toda la partida.
   */
  readonly mejorNeto: number | undefined
  /**
   * EL CUERPO ENCENDIBLE MÁS LIVIANO QUE EXISTIÓ, en cualquier tick.
   *
   * «Encendible» es la misma pregunta que hace el juez para los detectores 1 y 2:
   * cumple el rol `a` de `friccion` Y entregaría potencia si ardiera. Es el número
   * que decide si en esta partida podía haber fuego, porque frotar se paga del
   * tanque y el techo medido es `TECHO_DE_LA_FRICCION`.
   */
  readonly encendible: { readonly id: string; readonly masa: number } | undefined
  /** Cuántas cosas sueltas decretó el dios en los 3×3 chunks alrededor de la parada. */
  readonly sueltasDecretadas: number
  /**
   * Cuántas de esas pudo sembrar el arnés. La diferencia son las que el decreto
   * puso en una celda ya ocupada, que la ley 8 no admite: ver `escenaDe`.
   */
  readonly sueltasSembradas: number
  /** Y cuántos cuerpos puso el mundo por su cuenta: ni sembrados, ni pozo, ni nacidos. */
  readonly cuerposDelMundo: number
  /**
   * LA FIRMA DEL MUNDO que le tocó a esta partida: dónde está la orilla y qué
   * sembró el dios en los 3×3 chunks de alrededor. Es lo que hace verificable la
   * premisa del banco —«veinte partidas con semillas distintas»— sin creerle a la
   * semilla: dos semillas distintas con la misma firma son una partida repetida.
   */
  readonly firma: string
  readonly hash: string
  /**
   * LOS ESTADOS ILEGALES QUE EL ARNÉS VIO EN ESTA PARTIDA.
   *
   * Es la otra mitad de que un cero signifique algo. Un «0 de 9 secuencias» sobre
   * un mundo que nadie auditó no distingue «no emergió nada» de «el mundo estaba
   * roto y nadie miró»: hasta este tramo, `revisarEstado` no lo llamaba una sola
   * línea de `ii/` fuera de su propio test.
   */
  readonly violaciones: readonly { readonly tick: number; readonly v: Violacion }[]
}

/**
 * UNA PARTIDA. El bucle es el de producción con UNA diferencia declarada.
 *
 * `vivir(p, mentes, 1)` es lo que corre en `@anima/mind`, y adentro hace
 * `m.pensar(p)` y después `p.avanzar(1)`. Acá se llama a `p.tick()` en vez de a
 * `p.avanzar(1)` por una sola razón: **`avanzar` se come los `SimEvent`** —los
 * devuelve `tick()` y `avanzar` los descarta (`perceive/src/bucle.ts:420-451`)— y
 * el juez come `{ state, events }` por tick. Sin reloj de pared las dos son la
 * MISMA función: `avanzar` sin `#reloj` es `for (…) this.tick()`, y ese `if` está
 * en la primera línea del bucle. Lo que se pierde es la contabilidad de
 * `ticksPerdidos`, que es del criterio (4) y no de éste.
 *
 * **SE CORTA EN LA MUERTE**, y es lo que el informe necesita para separar «la
 * mente no llega» de «no vivió lo suficiente»: seguir corriendo un mundo sin
 * criatura agrega ticks al denominador y ni una decisión al numerador.
 *
 * ─── `costura` — Hito 11 · punto 5 ──────────────────────────────────────────
 *
 * Un OBSERVADOR y nada más: se lo llama cada vez que la mente choca contra un
 * hueco y le pediría algo a la fragua, que es lo que el criterio del Hito 11
 * llama «consulta». No devuelve nada, no decide nada y la mente no lo mira, así
 * que pasarlo o no pasarlo no puede mover un tick — y eso no hay que creerlo:
 * los seis hashes del banco de 20 semillas lo dicen, y su guardián está en
 * `hito-5-la-emergencia.test.ts`.
 */
export function correrPartida(
  semilla: bigint,
  tanque: number,
  tope: number,
  costura?: (gap: string, tick: number) => void,
): Corrida | undefined {
  const o = laOrilla(semilla)
  if (o === undefined) return undefined

  // `vigilar: true`: las cinco preguntas que un estado contesta solo, corridas
  // sobre cada uno de los 20.000 ticks. Hasta este tramo el arnés de invariantes
  // no lo llamaba una sola línea de `ii/` fuera de su propio test, y el adversario
  // del veneno midió un estado ilegal —un actor sin cuerpo— que atravesaba una
  // corrida entera sin que nada se pusiera rojo. Un cero de secuencias emergentes
  // sobre un mundo que nadie está auditando vale menos que un cero auditado.
  const escena = escenaDe(o, tanque)
  const p = new Partida(escena.state, { vigilar: true })
  const m = new Mente(
    costura === undefined
      ? { actor: 'ana', memoria: new Creencias() }
      : { actor: 'ana', memoria: new Creencias(), costura: (pedido) => costura(pedido.gap, pedido.tick) },
  )
  const d = new Detector()
  // El contrato de alimentación del detector: la primera muestra es el estado
  // INICIAL con la lista de eventos vacía.
  d.observar({ state: p.state, events: [] })

  const vuelos = new Map<string, number>()
  const nacidos = new Set<string>()
  const vistos = new Set<string>()
  let comestibles = 0
  let extraccionesCompletas = 0
  let comio = 0
  let enveneno = 0
  let mejorNeto: number | undefined
  let encendible: { readonly id: string; readonly masa: number } | undefined
  /** Los `Body` que el recorrido del diagnóstico ya interrogó. Ver el bucle. */
  const yaMirados = new Set<Body>()
  const rolA = ROL_A_DE_FRICCION()
  let murioEn = -1
  let aliento = tanque
  let t = 0
  for (; t < tope; t++) {
    const antes = m.despegues
    if (p.state.actors.has('ana')) m.pensar(p)
    if (m.despegues > antes) {
      const n = m.ultimoDespegue ?? '?'
      vuelos.set(n, (vuelos.get(n) ?? 0) + 1)
    }
    const eventos = p.tick()
    const w = p.state
    d.observar({ state: w, events: eventos })
    for (const e of eventos) {
      if (e.k === 'nacio') {
        nacidos.add(e.id)
        const b = w.bodies.get(e.id)
        if (b !== undefined && qualityOf(b.body, 'calories', w.phys) > 0) comestibles += 1
      }
      if (e.k === 'proceso' && e.process === EXTRACCION.id && e.completo) extraccionesCompletas += 1
      if (e.k === 'comio') comio += 1
      if (e.k === 'enveneno') enveneno += 1
    }
    // ─── EL RECORRIDO DEL DIAGNÓSTICO, y por qué es por tick ────────────────
    //
    // Las dos preguntas —«¿hubo alguna vez un bocado que valiera la pena?» y
    // «¿hubo alguna vez algo lo bastante liviano como para poder encenderlo?»—
    // son sobre TODA la partida y no sobre el estado final: el cuerpo que las
    // contesta puede haber existido treinta ticks. Mirar sólo el final diría que
    // no hubo vara justo porque la vara se gastó en la caña.
    //
    // ─── Y POR QUÉ SE SALTEA EL CUERPO QUE YA SE MIRÓ ───────────────────────
    //
    // Antes de este tramo el mundo tenía tres cuerpos y esto era gratis. Ahora
    // tiene entre 26 y 152 —los que el dios decretó—, y mirarlos todos en cada uno
    // de los 20.000 ticks era la mitad de lo que costaba el banco.
    //
    // El salteo es EXACTO y no una aproximación, y el porqué es del mundo: los
    // `WorldState` son inmutables por copia, así que el objeto `Body` de un cuerpo
    // que no cambió es EL MISMO objeto tick a tick. Y las cuatro preguntas de acá
    // abajo —masa, calorías, toxicidad, y si cumple el rol `a` con potencia— son
    // funciones puras de `(Body, Physics)`, con la `Physics` fija en la partida.
    // O sea que preguntarle de nuevo al mismo objeto da lo mismo por construcción.
    // Un cuerpo que se calienta, se parte o se ata es OTRO objeto y se vuelve a
    // mirar.
    const cuerpoDeAna = w.actors.get('ana')?.body
    for (const [id, b] of w.bodies) {
      if (id === cuerpoDeAna || yaMirados.has(b.body)) continue
      yaMirados.add(b.body)
      const masa = qualityOf(b.body, 'mass', w.phys)
      const cal = qualityOf(b.body, 'calories', w.phys)
      if (cal > 0) {
        const neto = cal * STAMINA_POR_CALORIA - qualityOf(b.body, 'toxicity', w.phys) * masa * COSTO_POR_TOXICIDAD_Y_KILO
        if (mejorNeto === undefined || neto > mejorNeto) mejorNeto = neto
      }
      if (encendible !== undefined && masa >= encendible.masa) continue
      if (!cumpleRol(b.body, rolA, w.phys) || potenciaSiArdiera(b.body, w.phys) <= 0) continue
      encendible = { id, masa }
    }
    for (const id of w.bodies.keys()) vistos.add(id)
    const cuerpo = w.bodies.get('ana-cuerpo')
    if (w.actors.has('ana')) {
      if (cuerpo !== undefined) aliento = qualityOf(cuerpo.body, 'stamina', w.phys)
    } else {
      murioEn = t
      break
    }
  }

  // CUERPOS QUE PUSO EL MUNDO POR SU CUENTA. Todo lo que se vio alguna vez, menos
  // lo que el ARNÉS plantó —hoy sólo la criatura—, menos los bancos de peces
  // —que `stepWorld` materializa desde el Hito 3— menos los que nacieron de un
  // proceso. Lo que queda es lo que el mundo trajo solo.
  //
  // **DABA CERO Y AHORA NO**, y ése es el tramo K entero: `stepWorld` materializa
  // las `sueltas` del decreto igual que materializa el pozo
  // (`world/src/step.ts`, `abrirChunk`). Los `suelta:cx:cy:n` NO se descuentan a
  // propósito: son exactamente lo que esta columna existe para contar.
  let cuerposDelMundo = 0
  for (const id of vistos) {
    if (escena.plantados.has(id) || id.startsWith('pozo:') || nacidos.has(id)) continue
    cuerposDelMundo += 1
  }

  let firma = `${String(o.cx)}:${String(o.cy)}|${String(o.pozo.x)},${String(o.pozo.y)}|${String(o.parada.x)},${String(o.parada.y)}`
  const cx = Math.floor(o.parada.x / 16)
  const cy = Math.floor(o.parada.y / 16)
  for (let dx = -RADIO_EN_CHUNKS; dx <= RADIO_EN_CHUNKS; dx++) {
    for (let dy = -RADIO_EN_CHUNKS; dy <= RADIO_EN_CHUNKS; dy++) {
      firma += `#${firmaDeSueltas(decretoDe(o.dios, o.phys, cx + dx, cy + dy).chunk.sueltas)}`
    }
  }

  return {
    semilla,
    cx: o.cx,
    cy: o.cy,
    parada: o.parada,
    ticks: t,
    murioEn,
    alientoFinal: aliento,
    veredicto: d.veredicto(),
    situaciones: { ...d.cronica.situaciones },
    vuelos,
    nacidos: nacidos.size,
    comestibles,
    extraccionesCompletas,
    comio,
    enveneno,
    mejorNeto,
    encendible,
    sueltasDecretadas: escena.decretadas,
    sueltasSembradas: escena.sembradas,
    cuerposDelMundo,
    firma,
    hash: hashWorldState(p.state),
    violaciones: p.informe.violaciones,
  }
}

// ─── El reparto por disco, calcado de `azar.ts` ──────────────────────────────

const GUARDADO = fileURLToPath(new URL('../node_modules/.azar/', import.meta.url))

/** La carpeta de una cohorte. Del CONTENIDO —tanque y tope—, no de un título. */
const carpetaDe = (tanque: number, tope: number): string =>
  `${GUARDADO}banco-${String(tanque)}-${String(tope)}/`

/** Cuánto se espera a que otro archivo termine la partida que agarró. */
const PACIENCIA = 600_000

/** La `Corrida` como viaja: `semilla` en texto (bigint) y `vuelos` en pares (Map). */
interface EnDisco extends Omit<Corrida, 'semilla' | 'vuelos'> {
  readonly semilla: string
  readonly vuelos: readonly (readonly [string, number])[]
}

function aDisco(c: Corrida): string {
  return JSON.stringify({ ...c, semilla: String(c.semilla), vuelos: [...c.vuelos] })
}

function deDisco(s: string): Corrida {
  const d = JSON.parse(s) as EnDisco
  return { ...d, semilla: BigInt(d.semilla), vuelos: new Map(d.vuelos) }
}

/**
 * UNA PARTIDA DEL BANCO, corrida por quien llegue primero. El mismo contrato que
 * `partidaGuardada` de `azar.ts`: el candado es un `mkdir` atómico, el que lo
 * consigue corre y escribe, el que no espera el `.json`; si el dueño se muere sin
 * escribir, al vencerse la paciencia el que espera la corre él mismo — trabajo
 * repetido antes que una suite colgada, y el resultado no depende de quién lo
 * calculó porque la partida es pura.
 */
async function partidaDelBanco(semilla: bigint, tanque: number, tope: number): Promise<Corrida> {
  const carpeta = carpetaDe(tanque, tope)
  const json = `${carpeta}${String(semilla)}.json`
  const lock = `${carpeta}${String(semilla)}.lock`
  const correrla = (): Corrida => {
    const c = correrPartida(semilla, tanque, tope)
    // `semillasQueSeJuegan` ya garantizó que cada una tiene orilla, así que un
    // `undefined` acá es un mundo que dejó de ser el mismo entre dos llamadas —o
    // sea un determinismo roto— y no un caso de §10 que haya que reemplazar.
    if (c === undefined) throw new Error(`la semilla ${String(semilla)} tenía orilla y ahora no`)
    return c
  }
  if (existsSync(json)) return deDisco(readFileSync(json, 'utf8'))
  mkdirSync(carpeta, { recursive: true })
  let mia = false
  try {
    mkdirSync(lock)
    mia = true
  } catch {
    mia = false
  }
  if (!mia) {
    const hasta = Date.now() + PACIENCIA
    while (!existsSync(json) && Date.now() < hasta) {
      await new Promise((listo) => setTimeout(listo, 200))
    }
    if (existsSync(json)) return deDisco(readFileSync(json, 'utf8'))
    return correrla()
  }
  try {
    const r = correrla()
    writeFileSync(json, aDisco(r), 'utf8')
    return r
  } finally {
    rmSync(lock, { recursive: true, force: true })
  }
}

/**
 * Cuántas partidas le tocan a una tanda con el reparto de hoy. Con las veinte,
 * las cinco tandas se llevan cuatro semillas cada una y dan 8 (cuatro × dos
 * cohortes); con la muestra corta, la primera se lleva las tres y las otras
 * cuatro no hacen nada. Un `toBe(8)` clavado se pondría rojo sin que nada esté mal.
 */
export function loQueLeTocaDelBanco(desde: number, cuantas: number): number {
  const { semillas } = semillasQueSeJuegan(PARTIDAS_DEL_BANCO)
  return semillas.slice(desde, desde + cuantas).length * LAS_DOS_COHORTES.length
}

/** Lo que corre una tanda: sus semillas, en las DOS cohortes. Devuelve cuántas dejó. */
export async function correrLaTandaDelBanco(desde: number, cuantas: number): Promise<number> {
  const { semillas } = semillasQueSeJuegan(PARTIDAS_DEL_BANCO)
  let hechas = 0
  for (const tanque of LAS_DOS_COHORTES) {
    for (const semilla of semillas.slice(desde, desde + cuantas)) {
      await respirar()
      await partidaDelBanco(semilla, tanque, TICKS_DEL_BANCO)
      hechas += 1
    }
  }
  return hechas
}

// ─── El banco entero, y los dos consumidores con nombre ──────────────────────

/**
 * LAS VEINTE, con la política de reemplazo de §10 escrita y no improvisada: «si
 * alguna resulta no resoluble se reemplaza en orden por `20260728n + 20 + j` y el
 * reemplazo se anota». Acá «no resoluble» es lo único que puede serlo desde
 * afuera: que la semilla no tenga una sola orilla en 13×13 chunks.
 */
export interface Banco {
  readonly corridas: readonly Corrida[]
  readonly reemplazos: readonly string[]
}

export async function correrElBanco(tanque: number, cuantas: number, tope = TICKS): Promise<Banco> {
  // La lista de semillas NO se calcula acá: sale de `semillasQueSeJuegan`, que la
  // comparten este banco y el control del azar. Ver allá el porqué — si cada
  // archivo arma la suya, la mente y el dado se miden en mundos distintos.
  const { semillas, reemplazos } = semillasQueSeJuegan(cuantas)
  const corridas: Corrida[] = []
  for (const semilla of semillas) {
    // Un respiro entre partida y partida, para que el canal del worker no se
    // caiga por los 60 s de birpc. No cambia una sola medición: ver `respirar`.
    await respirar()
    // Del disco si alguna tanda ya la corrió, y si no se corre acá. Ninguna de
    // las dos ramas cambia el resultado: la partida es función pura de la semilla.
    corridas.push(await partidaDelBanco(semilla, tanque, tope))
  }
  return { corridas, reemplazos }
}

// ─── Memoización, para no correr el mismo banco dos veces ────────────────────

// Se memoriza LA PROMESA y no el resultado: así dos tests que pidan el banco a la
// vez lo corren una sola vez, y el `await` de cada uno espera al mismo trabajo.
// Esta memoria es POR MÓDULO, o sea por archivo de test; la que cruza de un
// archivo a otro es la de disco (`partidaDelBanco`).
let elCanonico: Promise<Banco> | undefined
export function canonico(): Promise<Banco> {
  // ─── LA CORRIDA CANÓNICA TAMBIÉN SE GATEA, y hasta hoy no lo hacía ─────────
  //
  // El control ya se acortaba sin `ANIMA_BANCO=1` y la canónica no, así que la
  // suite normal pagaba **20 partidas × 20.000 ticks** en cada corrida. Medido
  // paquete por paquete: `@anima/mind` tarda 101 s, `@anima/world` 81, y este
  // paquete solo se comía más que los siete restantes juntos.
  //
  // No es aflojar el criterio: el veredicto del Hito 5 sale de la corrida con
  // `ANIMA_BANCO=1`, que es la que el documento pide y la única que se cita. Lo
  // que corre en la suite normal es una MUESTRA, y el informe la etiqueta como
  // tal (ver el `«sin ANIMA_BANCO=1»` del cuadro). Es el mismo patrón que
  // `world/tests/banco-el-tick.test.ts` ya tenía decidido: se imprime siempre, se
  // afirma sólo midiendo en serio.
  elCanonico ??= correrElBanco(TANQUE, PARTIDAS_DEL_BANCO, TICKS_DEL_BANCO)
  return elCanonico
}

let elControl: Promise<Banco> | undefined
export function control(): Promise<Banco> {
  elControl ??= correrElBanco(TANQUE_LLENO, PARTIDAS_DEL_BANCO, TICKS_DEL_BANCO)
  return elControl
}
