// ─── EL RUIDO DEL AZAR: la hipótesis nula de las nueve ───────────────────────
//
// No es un test: es el CONTROL que hace significativo a todo lo demás, y vive
// aparte porque lo consumen dos archivos —el adversario del detector, que lo
// encontró, y el banco del criterio, que tiene que publicarlo al lado del número
// de la mente—.
//
// ─── QUÉ ES LA CRIATURA AL AZAR, y por qué es LA hipótesis nula ─────────────
//
// Elige la FORMA del acto y los CUERPOS con el dado del mundo —`dadoDe(crearDios(
// semilla))`, la misma aritmética `mulberry32` con la que el motor tira el dado
// del dios, nunca `Math.random`— y **no consulta una sola cualidad**: no mira
// masa, ni rigidez, ni permeabilidad, ni `fuelEnergy`, ni calorías, ni montaje.
// Ésa es exactamente la hipótesis nula de las nueve entradas, porque las nueve
// dicen medir UNA ELECCIÓN DE CUERPO. Lo que este control contesta es: ¿cuántas
// de las nueve firma alguien que no elige nada?
//
// ─── POR QUÉ PERSEVERA, y no es hacerle un favor ────────────────────────────
//
// Medido en `ataque-al-detector.test.ts`: un proceso NO AVANZA si no se re-emite
// la intención —una fricción más cien ticks vacíos dejan la vara en 15,0 °C y el
// `doing` en `undefined`—, así que un azar sin memoria de un tick no completa
// NINGÚN proceso y el control mediría cero por construcción. Un control amañado
// para dar cero no es un control. Elige un acto y lo repite entre 1 y 80 ticks,
// que cubre los 48 de una ignición y los 20 de una unión.
//
// ─── LAS DOS CONCESIONES, y las dos van A FAVOR DEL CONTROL ─────────────────
//
// La corrida CON fuego le regala una fogata prendida y un tanque de 40.000,
// porque siete de las nueve cuelgan de que haya fuego y con 1000 el bicho se
// muere de puro vivir antes de que el fuego grande se apague. Las dos concesiones
// le facilitan las cosas al azar, así que lo que salga de acá es un PISO del
// ruido y no un techo.
//
// Y las dos se dejaron tal cual al mudar el control al mundo decretado, aunque el
// motivo del tanque grande se aflojó: sobre esta escena el bicho SIN fuego vive
// 19.212 ticks de los 20.000 con un tanque de 1000 —come lo que hay tirado— y CON
// el fuego regalado y 40.000 vive 16.104, porque se quema al lado de la fogata.
// Bajarle el tanque ahora sería cambiarle la concesión al control en el mismo
// tramo en que se le cambia el mundo, y entonces no se sabría cuál de las dos
// cosas movió el número.
//
// ═══ Y EL MUNDO ES EL MISMO QUE EL DE LA MENTE, QUE ES LO QUE CAMBIÓ ════════
//
// Hasta este tramo el control corría sobre una escena propia: diez sueltas
// sorteadas de una tabla de cinco sustancias ESCRITA ACÁ, cuatro peces regalados y
// un mundo de 5×5 sin dios. Y el banco de la mente corría sobre otra escena, la
// suya, también a mano. Dos escenas distintas, dos números, y una resta entre
// ellos que no medía nada: si el arnés cambia de mundo y el control no, la
// comparación no vale.
//
// Ahora los dos juegan **las mismas veinte semillas, el mismo decreto y la misma
// orilla** (`el-mundo-decretado.ts`). Lo único que sigue siendo del control son
// las dos concesiones de arriba —la fogata regalada y el tanque de 40.000—, que
// están declaradas y van a favor del dado.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { crearDios, dadoDe, apply, drop, eat, goTo, put, stepWorld, take, wait } from '@anima/world'
import type { Intent, Placement, WorldState } from '@anima/world'
import { FRICCION, UNION } from '@anima/physics'
import type { Body, Physics } from '@anima/physics'

import { Detector, resumir } from '../src/index.js'
import type { FilaDelBanco, NombreDeSecuencia, Veredicto } from '../src/index.js'
import {
  celdaLibrePegada,
  escenaDe,
  laOrilla,
  PARTIDAS,
  respirar,
  semillasQueSeJuegan,
} from './el-mundo-decretado.js'

const QUIEN = { by: 'ana', seq: 1 } as const

/** Un cuerpo con temperatura escrita. Sin eso nace a 0 °C y toda medición miente. */
function pieza(id: string, substance: string, mass: number, t = 15): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state: { temperature: t } }
}

interface Azar {
  readonly entero: (n: number) => number
}

function azarDe(semilla: bigint): Azar {
  const dado = dadoDe(crearDios(semilla))
  return { entero: (n) => Math.floor(dado.tirar() * n) }
}

/**
 * LA ORILLA DEL CONTROL: la del decreto, más —o no— la fogata regalada.
 *
 * La escena entera sale de `escenaDe`, o sea de la semilla. Lo único que este
 * archivo agrega es la primera de las dos concesiones: una `fogata` de 2,5 kg de
 * madera a 700 °C, pegada a la criatura, en la primera de las ocho celdas vecinas
 * que el decreto haya dejado vacía. Si las ocho estuvieran ocupadas no se pone y
 * se sigue: regalar el fuego encima de algo sería regalar además un solapamiento.
 */
function orillaDeControl(
  semilla: bigint,
  conFuego: boolean,
  tanque: number,
): { readonly w: WorldState; readonly ids: string[]; readonly phys: Physics; readonly parada: Placement } | undefined {
  const o = laOrilla(semilla)
  if (o === undefined) return undefined
  const escena = escenaDe(o, tanque)
  let w = escena.state
  if (conFuego) {
    const at = celdaLibrePegada(w, o.parada)
    if (at !== undefined) {
      const bodies = new Map(w.bodies)
      bodies.set('fogata', { body: pieza('fogata', 'madera', 2.5, 700), at })
      w = { ...w, bodies }
    }
  }
  const ids = [...w.bodies.keys()].filter((x) => x !== 'ana-cuerpo')
  return { w, ids, phys: o.phys, parada: o.parada }
}

/** Una partida del control. Devuelve el veredicto y cuántos ticks vivió. */
export function partidaAlAzar(
  semilla: bigint,
  conFuego: boolean,
  tanque: number,
  tope: number,
): { readonly v: Veredicto; readonly ticks: number } {
  const a = azarDe(semilla)
  const orilla = orillaDeControl(semilla, conFuego, tanque)
  // `semillasQueSeJuegan` sólo devuelve semillas con orilla, así que esto no pasa;
  // si pasara, un veredicto vacío mentiría menos que una excepción a medio camino.
  if (orilla === undefined) return { v: new Detector().veredicto(), ticks: 0 }
  const { ids, phys, parada } = orilla
  let w = orilla.w
  const d = new Detector()
  d.observar({ state: w, events: [] })
  const elegir = (): string => ids[a.entero(ids.length)] ?? 'ana-cuerpo'
  /** Una celda del entorno de la criatura, en el marco del mundo y no en el origen. */
  const cerca = (): Placement => ({ x: parada.x + a.entero(5) - 2, y: parada.y + a.entero(5) - 2 })
  let plan: Intent | undefined
  let quedan = 0
  let t = 0
  // Los bancos de peces los materializa `stepWorld` en el primer paso, así que en
  // el tick 0 todavía no están en `ids`. Se agregan una sola vez, después del
  // primer paso, recorriendo `w.bodies` en su orden canónico: el bicho al azar
  // tiene que poder nombrar el pozo, igual que lo nombra la mente.
  let faltanLosPozos = true
  for (; t < tope; t++) {
    const act = w.actors.get('ana')
    if (act === undefined) break
    if (quedan <= 0 || plan === undefined) {
      quedan = 1 + a.entero(80)
      const held = act.holding
      const enMano = (): string => held[a.entero(held.length)] ?? elegir()
      // Con menos de dos cosas en la mano casi todo rebota, así que las tres
      // primeras opciones apuntan a llenarla. Sigue sin mirar QUÉ levanta.
      const k = held.length < 2 ? a.entero(3) : a.entero(8)
      if (k === 0 || k === 2) plan = take(QUIEN, elegir())
      else if (k === 1) plan = goTo(QUIEN, cerca(), 0)
      else if (k === 3) plan = drop(QUIEN, enMano())
      else if (k === 4) {
        plan = put(QUIEN, enMano(), cerca(), a.entero(2) === 0 ? { onTopOf: elegir() } : { covering: elegir() })
      } else if (k === 5) plan = eat(QUIEN, elegir())
      else if (k === 6) {
        plan =
          apply(QUIEN, phys, FRICCION.id, [
            { name: 'a', body: enMano() },
            { name: 'b', body: enMano() },
            { name: 'actor', body: 'ana-cuerpo' },
          ]) ?? wait(QUIEN, 0.05)
      } else {
        plan =
          apply(QUIEN, phys, UNION.id, [
            { name: 'binder', body: enMano() },
            { name: 'a', body: enMano() },
            ...(a.entero(2) === 0 ? [{ name: 'b', body: enMano() }] : []),
          ]) ?? wait(QUIEN, 0.05)
      }
    }
    quedan -= 1
    const out = stepWorld(w, [plan])
    w = out.state
    d.observar({ state: w, events: out.events })
    for (const e of out.events) if (e.k === 'nacio') ids.push(e.id)
    if (faltanLosPozos) {
      faltanLosPozos = false
      const yaEstan = new Set(ids)
      for (const id of w.bodies.keys()) if (id !== 'ana-cuerpo' && !yaEstan.has(id)) ids.push(id)
    }
  }
  return { v: d.veredicto(), ticks: t }
}

export const PARTIDAS_DEL_CONTROL = PARTIDAS
export const TICKS_DEL_CONTROL = 20_000

// ═══ EL CONTROL, REPARTIDO ENTRE ARCHIVOS ═══════════════════════════════════
//
// ─── EL NÚMERO QUE MOTIVA TODO ESTO ────────────────────────────────────────
//
// Medido con `pnpm --filter @anima/juez test`: el paquete tardaba **536 s**, y
// **510 de esos 536 son estos dos controles** —247 s el de sin fuego y 263 el del
// fuego regalado, 20 partidas de 20.000 ticks cada uno—. Y peor: los corrían DOS
// archivos, `hito-5-la-emergencia.test.ts` y `ataque-al-detector.test.ts`, o sea
// que el trabajo se hacía **dos veces**. La memoización de acá abajo es por MÓDULO
// y vitest aísla el grafo de módulos por archivo, así que no cruzaba de uno al otro.
//
// Y no era el banco de la mente: ése ya se acorta sin `ANIMA_BANCO=1` (3 partidas
// de 2.000 ticks) y sale por 24 s. **El control del azar no está gateado**, y ésa
// es la asimetría que costaba los ocho minutos.
//
// ─── LO QUE SE HIZO, Y LO QUE NO ───────────────────────────────────────────
//
// **No se acortó ni una partida ni un tick.** Se sigue corriendo 20 × 20.000 por
// control, con las mismas semillas y las mismas dos concesiones. Lo único que
// cambia es DÓNDE se corre cada una: el resultado de cada partida se guarda en
// `node_modules/.azar/<control>/<semilla>.json`, y cinco archivos de test —las
// «tandas», `el-azar-tanda-N.test.ts`— se reparten las veinte semillas de a cuatro
// y las corren EN PARALELO. Los consumidores leen del disco lo que ya está y
// esperan lo que falta.
//
// Que esto no cambie ningún número no es una esperanza: **cada partida del control
// es función pura de su semilla**. `azarDe(semilla)` es un `mulberry32` propio y
// `laOrilla(semilla)` arma una `Physics` NUEVA por llamada (`nuevaFisica()`), así
// que la caché del decreto —que memoiza por `(Physics, "cx:cy")` SIN la semilla, y
// que ya produjo un número mal en este proyecto— no puede cruzar de una partida a
// otra ni adentro de un archivo ni entre archivos. Correr la semilla 20260731 en
// otro proceso da byte por byte lo mismo, y la comparación antes/después de las dos
// tablas del control lo confirma renglón por renglón.
//
// Y `resumir()` cuenta filas, así que el ORDEN en que llegan las veinte partidas no
// puede mover una cifra; `vivas` y `ticksVividos` son sumas. Por eso repartirlas es
// seguro y agruparlas de otra manera también lo sería.

/**
 * LOS DOS CONTROLES, con nombre, para que las tandas y los consumidores nombren lo
 * MISMO. Si alguien agrega un tercero y no lo pone acá, las tandas no lo precalculan
 * y el consumidor lo corre solo: sale lento, no sale mal.
 */
export const LOS_DOS_CONTROLES = [
  { titulo: 'EL AZAR SIN FUEGO', conFuego: false, tanque: 1000 },
  { titulo: 'EL AZAR CON EL FUEGO REGALADO', conFuego: true, tanque: 40_000 },
] as const

const GUARDADO = fileURLToPath(new URL('../node_modules/.azar/', import.meta.url))

/** El nombre de la carpeta de un control. Del CONTENIDO, no del título. */
const carpetaDe = (conFuego: boolean, tanque: number): string =>
  `${GUARDADO}${conFuego ? 'con' : 'sin'}-fuego-${String(tanque)}/`

/** Cuánto se espera a que otro archivo termine la partida que agarró. */
const PACIENCIA = 600_000

interface Guardada {
  readonly v: Veredicto
  readonly ticks: number
}

/**
 * UNA PARTIDA DEL CONTROL, corrida por quien llegue primero.
 *
 * El reparto no se coordina con nadie: el que quiere una semilla intenta crear su
 * `.lock` con `mkdir`, que **falla si ya existe** y por lo tanto es un candado
 * atómico hasta en Windows. El que lo consigue corre la partida y escribe el
 * `.json`; el que no, espera a que aparezca.
 *
 * Si el que agarró el candado se muere sin escribir, el que espera **corre la
 * partida él mismo** al vencerse la paciencia. Eso cuesta trabajo repetido, que es
 * exactamente el precio correcto: colgar la suite para siempre sería peor, y un
 * resultado no puede depender de quién lo calculó.
 */
async function partidaGuardada(
  semilla: bigint,
  conFuego: boolean,
  tanque: number,
  tope: number,
): Promise<Guardada> {
  const carpeta = carpetaDe(conFuego, tanque)
  const json = `${carpeta}${String(semilla)}.json`
  const lock = `${carpeta}${String(semilla)}.lock`
  if (existsSync(json)) return JSON.parse(readFileSync(json, 'utf8')) as Guardada
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
    if (existsSync(json)) return JSON.parse(readFileSync(json, 'utf8')) as Guardada
    // El que la agarró se cayó. Se corre acá y no se cachea: el dueño del candado
    // sigue siendo él, y dos procesos escribiendo el mismo archivo no hace falta.
    return partidaAlAzar(semilla, conFuego, tanque, tope)
  }
  try {
    const r = partidaAlAzar(semilla, conFuego, tanque, tope)
    writeFileSync(json, JSON.stringify(r), 'utf8')
    return r
  } finally {
    rmSync(lock, { recursive: true, force: true })
  }
}

/**
 * LO QUE CORRE UNA TANDA: las semillas `[desde, desde + cuantas)` de los dos
 * controles. Devuelve cuántas partidas dejó guardadas, que es lo que su test afirma.
 */
export async function correrLaTanda(desde: number, cuantas: number): Promise<number> {
  const { semillas } = semillasQueSeJuegan(PARTIDAS_DEL_CONTROL)
  let hechas = 0
  for (const c of LOS_DOS_CONTROLES) {
    for (const semilla of semillas.slice(desde, desde + cuantas)) {
      await respirar()
      await partidaGuardada(semilla, c.conFuego, c.tanque, TICKS_DEL_CONTROL)
      hechas += 1
    }
  }
  return hechas
}

export interface Control {
  readonly titulo: string
  readonly filas: readonly FilaDelBanco[]
  readonly vivas: number
  readonly ticksPromedio: number
  /** Las que el azar firma en ≥ 2 de las 20. Ninguna de éstas puede contar. */
  readonly cuentan: readonly NombreDeSecuencia[]
}

/**
 * Corre el control entero. Caro —20 × 20.000 ticks sobre el mundo decretado— y por
 * eso memorizado, y `async` para poder respirar entre partida y partida: ver
 * `respirar` en `el-mundo-decretado.ts`. Lo que se memoriza es la PROMESA, así que
 * dos tests que lo pidan a la vez corren el control una sola vez.
 *
 * Esta memoria es POR MÓDULO, o sea por archivo de test. La que cruza de un archivo
 * a otro es la de disco: ver `partidaGuardada` y el bloque «EL CONTROL, REPARTIDO
 * ENTRE ARCHIVOS» de más arriba.
 */
export function correrElControl(titulo: string, conFuego: boolean, tanque: number): Promise<Control> {
  const clave = `${titulo}|${String(conFuego)}|${String(tanque)}`
  const guardado = CACHE.get(clave)
  if (guardado !== undefined) return guardado
  const corriendo = correrlo(titulo, conFuego, tanque)
  CACHE.set(clave, corriendo)
  return corriendo
}

async function correrlo(titulo: string, conFuego: boolean, tanque: number): Promise<Control> {
  const vs: Veredicto[] = []
  let vivas = 0
  let ticksVividos = 0
  // LAS MISMAS VEINTE QUE JUEGA LA MENTE, reemplazos de §10 incluidos. Es la
  // mitad de que la comparación signifique algo: ver el encabezado.
  for (const semilla of semillasQueSeJuegan(PARTIDAS_DEL_CONTROL).semillas) {
    await respirar()
    // Del disco si alguna tanda ya la corrió, y si no la corre acá. Ninguna de las
    // dos ramas cambia el resultado: la partida es función pura de la semilla.
    const r = await partidaGuardada(semilla, conFuego, tanque, TICKS_DEL_CONTROL)
    vs.push(r.v)
    ticksVividos += r.ticks
    if (r.ticks >= TICKS_DEL_CONTROL) vivas += 1
  }
  const res = resumir(vs)
  return {
    titulo,
    filas: res.filas,
    vivas,
    ticksPromedio: Math.round(ticksVividos / PARTIDAS_DEL_CONTROL),
    cuentan: res.filas.filter((f) => f.cuenta).map((f) => f.nombre),
  }
}

const CACHE = new Map<string, Promise<Control>>()

/** La tabla de un control, en texto. Sin `toLocaleString`: la regla 2 vale acá también. */
export function tablaDelControl(c: Control): string {
  const lineas = [
    `  ── ${c.titulo} · ${String(PARTIDAS_DEL_CONTROL)} partidas de ${String(TICKS_DEL_CONTROL)} ticks ──`,
  ]
  for (const f of c.filas) {
    lineas.push(
      `     apareció ${String(f.aparecioEn).padStart(2)}/20 · situación ${String(f.situacionEn).padStart(2)}/20  ` +
        `${f.nombre.padEnd(38)}${f.cuenta ? ' ← CUENTA' : ''}`,
    )
  }
  lineas.push(
    `     CUENTAN ${String(c.cuentan.length)} DE 9 · llegaron vivas ${String(c.vivas)}/20` +
      ` · vivieron ${String(c.ticksPromedio)} ticks en promedio`,
  )
  return lineas.join('\n')
}

/**
 * LAS QUE EL AZAR FIRMA, con y sin fuego regalado.
 *
 * Es el número que el banco del criterio tiene que publicar al lado del de la
 * mente: **ninguna secuencia que el azar dispare en ≥ 2 de las 20 puede contar
 * para el piso de cuatro**, porque una firma que produce un bicho que elige
 * cuerpos con el dado no distingue una mente de un dado.
 */
export async function ruidoDelAzar(): Promise<readonly NombreDeSecuencia[]> {
  const sin = await correrElControl('EL AZAR SIN FUEGO', false, 1000)
  const con = await correrElControl('EL AZAR CON EL FUEGO REGALADO', true, 40_000)
  return [...new Set([...sin.cuentan, ...con.cuentan])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}
