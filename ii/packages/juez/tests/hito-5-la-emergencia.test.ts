// ═══ EL CRITERIO DE EMERGENCIA, CORRIDO ═════════════════════════════════════
//
// El documento de arquitectura (`docs/architecture/remake-anima-ii.md:~1462`) pide
// esto y no otra cosa:
//
//   «se define ANTES una lista de 10 secuencias objetivo que nadie implementó. En
//    20 partidas con semillas distintas tienen que aparecer al menos 4 de las 10,
//    registradas por UN DETECTOR AUTOMÁTICO DE SECUENCIAS, no por observación.»
//
// La lista está cerrada en `ii/docs/hito-5-las-diez-secuencias.md` y tiene NUEVE
// entradas; el detector es `@anima/juez`, escrito sin ver la mente. Este archivo
// es la corrida: veinte partidas, una criatura con su `Mente`, un mundo decretado
// por el dios, y el juez escuchando tick a tick.
//
// ═══ EL VEREDICTO, ARRIBA Y CON LOS NÚMEROS DE ESTA CORRIDA ═════════════════
//
//   APARECIERON 0 DE 9, y **el resultado NO ES INTERPRETABLE** — que es peor y
//   más útil que un cero. §10 del documento lo dejó escrito antes de correr: «si
//   quedan más de tres sin medir sobre nueve, el resultado no es interpretable».
//   Quedaron **nueve sin medir sobre nueve**: los nueve contra-detectores dieron
//   `false` en las veinte partidas. El mundo no le puso NINGUNO de los nueve
//   problemas delante a la criatura, ni una vez.
//
//   Y la causa no es la mente, ni el hambre, ni la semilla. Son tres cosas
//   medidas acá, en este orden de importancia:
//
//   ─── (A) EL MUNDO NO MATERIALIZA NADA DE LO QUE EL DIOS SIEMBRA ───────────
//
//   El dios decreta 90 cosas sueltas en los 3×3 chunks alrededor de la criatura
//   —junco, piedra, hueso, hoja, grano, raíz, tubérculo— y **el mundo materializa
//   CERO**. Verificado por lectura y por corrida: `decretoDe(...).chunk.sueltas`
//   no tiene UN SOLO consumidor en `@anima/world` (`grep -rn "sueltas" world/src`
//   devuelve nueve renglones y los nueve son prosa), y lo único que `stepWorld`
//   materializa es el banco de peces (`materializarPozos`, `step.ts:2904`). En las
//   veinte partidas, el mundo puso de su lado exactamente **0 cuerpos**: los
//   únicos que hay son la criatura, los pozos, los tres que este arnés coloca a
//   mano y los que nacieron de un proceso.
//
//   Con eso, siete de las nueve secuencias son inalcanzables por construcción: no
//   hay corteza, no hay yesca, no hay una segunda vara, no hay piedra con qué
//   hacer parrilla y no hay nada con filo. No es que la criatura no lo descubrió:
//   **no estaba**.
//
//   ─── (B) LAS VEINTE SEMILLAS SON UN SOLO MUNDO ────────────────────────────
//
//   `decretoDe` memoiza por `(Physics, "cx:cy")` y **la semilla no entra en la
//   clave** (`world/src/dios.ts:305-317`). Dos dioses distintos que compartan el
//   objeto `Physics` comparten el decreto: medido abajo, y no «igual» sino EL
//   MISMO OBJETO (`a === b`). Como todo el repositorio construye la física una
//   vez por módulo, «veinte partidas con semillas distintas» corridas de la forma
//   obvia son **veinte partidas con el mismo mundo**. Este banco lo esquiva
//   construyendo UNA `Physics` por partida, y lo deja marcado en rojo: el arnés no
//   puede ser el que arregla un agujero del motor.
//
//   ─── (C) LA CRIATURA NO COME, Y NO ES LO QUE MANDA ────────────────────────
//
//   Con el tanque de la escena canónica (310) se muere entre el tick 6.133 y el
//   6.198 en las veinte partidas —el 29,9% del presupuesto de 400.000 ticks—, con
//   193 a 199 pescas hechas y CERO bocados, que es lo que
//   `mind/tests/hito-5-el-criterio.test.ts` ya tenía medido. Pero **el control con
//   el tanque lleno (1000) no mueve una sola fila**: las veinte llegan al 96,5%
//   del presupuesto —dieciocho mueren pasado el tick 19.870 y las otras dos en el
//   14.392 y el 12.012—, con 12 a 645 pescas y CERO bocados, y el juez sigue
//   diciendo 0 de 9 con 9 sin medir. O sea: la muerte temprana NO es la razón por
//   la que las secuencias no aparecen. Esa separación es la que el número
//   necesitaba para significar algo, y es la que el encargo pedía.
//
//   ─── (D) TRECE DE LAS VEINTE SEMILLAS DE §10 NO TIENEN RÍO ────────────────
//
//   La escena del Hito 5 es «con hambre y un río a la vista» y pide un pozo con
//   una celda seca al lado. De las veinte semillas que §10 fijó, **siete lo
//   tienen y trece no** en 13×13 chunks alrededor del origen. §10 previó
//   exactamente esto —«si alguna resulta no resoluble se reemplaza en orden por
//   `20260728n + 20 + j` y el reemplazo se anota»— y así se hizo: las trece
//   ranuras vacías se llenaron con las primeras semillas libres que sí tienen
//   orilla, y la lista completa de reemplazos se publica en la salida.
//
//   Que sean trece y no una o dos tampoco es mala suerte: por el agujero (B),
//   cualquier barrido de las veinte con una sola `Physics` encuentra orilla en
//   las veinte —la misma veinte veces—, así que este 13/20 es el primer número
//   que alguien mide sobre esa lista de semillas.
//
// ═══ QUÉ SE PUBLICA, QUE ES LO QUE §10 MANDA ════════════════════════════════
//
// Las nueve filas con sus tres cifras (apareció en N/20 · la situación existió en
// M/20 · no medida en 20−M), el tick de la primera aparición de cada una, la lista
// de semillas, el tanque de arranque, `PHYSICS_VERSION` y el hash de cada partida.
// Lo que §10 pide y esta corrida NO puede publicar —la masa del cuerpo elegido en
// cada disparo de las entradas 2 y 8, y si el fuego de cada disparo era de vara
// sola o de cadena— no se publica porque **no hubo un solo disparo ni un solo
// fuego**, y eso está dicho en la salida en vez de omitido.
//
// ═══ EL UMBRAL: NO SE TOCA ACÁ ══════════════════════════════════════════════
//
// El criterio publicado es «al menos 4», y §10 del documento ya resolvió cómo se
// lee con nueve entradas en vez de diez: el 4 absoluto y el 40% proporcional
// (3,6 → 4) caen en el mismo número, así que no hay nada que elegir. Este archivo
// **no ajusta nada**: reporta el número crudo —aparecieron K de 9— y deja la
// discusión escrita. Con K = 0 la disyuntiva es académica de todos modos.
//
// ═══ CÓMO SE MIDE ACÁ ═══════════════════════════════════════════════════════
//
// Todo lo de este archivo es DETERMINISTA: no se mide un milisegundo que decida
// nada, así que el `ANIMA_BANCO` de abajo no está por flakiness sino por COSTO —el
// control con el tanque lleno son 400.000 ticks de mundo con una mente encima—.
// Se imprime siempre y se afirma sólo midiendo en serio, con una corrida corta que
// sí afirma siempre, que es el patrón que `world/tests/banco-el-tick.test.ts:165`
// dejó escrito. Lo que NO se gatilla es el banco del criterio: son veinte partidas
// que se mueren a un tercio del camino, sale barato, y es el criterio de corte del
// proyecto — un criterio que sólo corre si alguien se acuerda de exportar una
// variable de entorno no es un criterio.
//
// Y lo que no se cumple no se ablanda: va en `it.fails` con la salida medida al
// lado, que es el idioma con el que este repositorio ya dejó abiertos el techo del
// tick, los diez huecos de `admit()` y el criterio (2) del Hito 5.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, HZ_DE_REFERENCIA, PHYSICS_VERSION, qualityOf, T_AMBIENTE } from '@anima/physics'
import type { Body, FormId, Physics, QualityVector } from '@anima/physics'
import { crearDios, decretoDe, hashWorldState, mapaDeActores, mapaDeCuerpos } from '@anima/world'
import type { Actor, EstadoDelDios, Placement, WorldBody, WorldState } from '@anima/world'
import { Partida } from '@anima/perceive'
import { Creencias, Mente } from '@anima/mind'

import { Detector, resumir, SECUENCIAS } from '../src/index.js'
import type { NombreDeSecuencia, Veredicto } from '../src/index.js'
import { ruidoDelAzar, tablaDelControl, correrElControl } from './azar.js'

/** Ver el encabezado: acá el gatillo es el COSTO y no la varianza. */
const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

/** §10: veinte partidas. No es un largo elegido acá. */
const PARTIDAS = 20

/** §10: 20.000 ticks a 20 Hz = 1000 s de mundo, la ventana con la que está medida la economía. */
const TICKS = 20_000

/** §10: `20260728n + k` para `k = 0..19`, fijadas ANTES de correr y escritas en el documento. */
const SEMILLA_BASE = 20260728n

/** §10: el reemplazo en orden si una semilla resulta no resoluble. */
const SEMILLA_DE_REEMPLAZO = SEMILLA_BASE + 20n

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
const TANQUE = 310

/** El control de §3: el tanque entero. Es el que separa «no llega» de «no vivió». */
const TANQUE_LLENO = 1000

/** Cuántas partidas del control se corren cuando NO se está midiendo en serio. */
const PARTIDAS_CORTAS = 3

// ─── El arnés: la orilla de verdad, y una física por partida ─────────────────
//
// Es la CUARTA copia del mismo armado —`world/tests/mundo-minimo.ts` →
// `perceive/tests/mundo.ts` → `plan/tests/los-esquemas-contra-el-mundo.ts` →
// `mind/tests/mundo.ts` → ésta— y la copia es deliberada por la razón que la
// segunda escribió: los `tests/` de un paquete no se exportan, así que compartirla
// exigiría mover el arnés adentro de `src/`, o sea meterle al paquete un módulo
// que sólo existe para los tests. Y en ESTE paquete sería peor todavía: `src/`
// tiene prohibido nombrar a `@anima/mind` y a `@anima/perceive`, así que un arnés
// compartido metería la mente adentro del juez.
//
// Lo que se copia es EL ARMADO: ni una regla del mundo, ni un número de la física.

/**
 * UNA `Physics` POR PARTIDA, y no es una optimización al revés: es el rodeo del
 * agujero (B) del encabezado.
 *
 * `decretoDe` memoiza por `(Physics, "cx:cy")` sin la semilla, así que veinte
 * dioses distintos que compartan el objeto `Physics` decretan un solo mundo. Está
 * medido abajo, en el bloque (0), y el hueco queda marcado en rojo ahí: esto es un
 * rodeo del arnés, no una reparación.
 */
function nuevaFisica(): Physics {
  return buildSeedPhysics()
}

/**
 * Un cuerpo cualquiera, A TEMPERATURA AMBIENTE. Lo de la temperatura no es adorno:
 * un cuerpo sin `temperature` escrita nace a 0 °C, y sobre una mente eso importa
 * el doble —`necesidades` mide el frío del CUERPO y D5 la manda a juntar leña
 * antes de mirar nada más—. Es un artefacto del armado, no del mundo.
 */
function cuerpo(
  id: string,
  substance: string,
  mass: number,
  state: QualityVector = {},
  form: FormId = 'vara',
): Body {
  return {
    id,
    form,
    parts: [{ substance, mass, q: {} }],
    joints: [],
    state: { temperature: T_AMBIENTE, ...state },
  }
}

function criatura(id: string, stamina: number): Body {
  return cuerpo(`${id}-cuerpo`, 'carne', 2, { stamina }, 'bloque')
}

function actor(id: string): Actor {
  // `irreversible` y no `reversible`: `comer` mira `ctx.self.permits` antes de
  // gastar un turno. Una criatura del Hito 5 no está en cuarentena.
  return { id, body: `${id}-cuerpo`, holding: [], capacity: 3, permits: 'irreversible' }
}

interface Orilla {
  readonly dios: EstadoDelDios
  readonly phys: Physics
  readonly cx: number
  readonly cy: number
  /** La celda mojada donde el dios puso el banco. */
  readonly pozo: Placement
  /** Una celda SECA pegada al pozo: desde acá se pesca. */
  readonly parada: Placement
}

/**
 * Una orilla de verdad de la semilla, BUSCADA y no inventada.
 *
 * Barre chunks en orden canónico hasta encontrar uno con pozo y una celda seca
 * pegada. `undefined` —y no una excepción— cuando la semilla no tiene ninguna en
 * 13×13 chunks, porque §10 tiene escrito qué hacer con eso: se reemplaza en orden
 * y el reemplazo se anota.
 */
function laOrilla(semilla: bigint): Orilla | undefined {
  const phys = nuevaFisica()
  const dios = crearDios(semilla)
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      const dec = decretoDe(dios, phys, cx, cy)
      if (dec.pozo === undefined) continue
      const p = dec.pozo.at
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const parada = { x: p.x + dx, y: p.y + dy }
        const vecino = decretoDe(dios, phys, Math.floor(parada.x / 16), Math.floor(parada.y / 16))
        const i = (((parada.y % 16) + 16) % 16) * 16 + (((parada.x % 16) + 16) % 16)
        if ((vecino.celdas[i] as { wet: number }).wet < 0.9) {
          return { dios, phys, cx, cy, pozo: p, parada }
        }
      }
    }
  }
  return undefined
}

/** Los tres cuerpos que este arnés pone a mano, por id. Ver `escenaDe`. */
const A_MANO: readonly string[] = ['ana-cuerpo', 'vara', 'matorral']

/**
 * LA ESCENA, y hay que declarar exactamente qué se le regala a la criatura.
 *
 * Es la escena canónica del Hito 5 —«con hambre y un río a la vista»,
 * `mind/tests/hito-5-el-criterio.test.ts`— y se usa ésa y no otra porque es la
 * única que el proyecto tiene medida de punta a punta. Se ponen a mano TRES
 * cuerpos y ninguno más:
 *
 *   · la criatura, con el tanque que se publica;
 *   · una vara de madera de 1 kg, a tres celdas;
 *   · un matorral de liana de 0,2 kg, a dos celdas y media.
 *
 * NO se pone a mano nada que cablee una secuencia: ni fuego, ni yesca, ni corteza,
 * ni una segunda vara, ni piedra, ni nada con filo. La vara y el matorral son los
 * dos eslabones de la caña, que es el criterio (1) del Hito 5 y no es ninguna de
 * las nueve; la entrada 4 —`ponerle-punta-al-aparejo`— pide una SEGUNDA unión con
 * algo filoso y con `catch` estrictamente mayor, y eso no se regala.
 *
 * Y hay que decir la parte incómoda: con el agujero (A) del encabezado, estos tres
 * cuerpos son **todo lo que hay en el mundo** además de los pozos. No es que la
 * escena sea pobre: es que el mundo no agrega nada.
 */
function escenaDe(o: Orilla, stamina: number): WorldState {
  const p = o.parada
  const bodies: readonly WorldBody[] = [
    { body: criatura('ana', stamina), at: p },
    { body: cuerpo('vara', 'madera', 1), at: { x: p.x + 3, y: p.y } },
    { body: cuerpo('matorral', 'liana', 0.2, {}, 'hebra'), at: { x: p.x - 2, y: p.y + 1 } },
  ]
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: o.phys,
    bodies: mapaDeCuerpos(bodies),
    actors: mapaDeActores([actor('ana')]),
    cells: new Map(),
    nextId: 1,
    dios: o.dios,
  }
}

// ─── La corrida de una partida ───────────────────────────────────────────────

interface Corrida {
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
  /** Qué habilidades despegaron y cuántas veces. El denominador de todo diagnóstico. */
  readonly vuelos: ReadonlyMap<string, number>
  /** Cuántas cosas sueltas decretó el dios en los 3×3 chunks alrededor de la parada. */
  readonly sueltasDecretadas: number
  /** Y cuántos cuerpos puso el mundo por su cuenta: ni a mano, ni pozo, ni nacidos. */
  readonly cuerposDelMundo: number
  /**
   * LA FIRMA DEL MUNDO que le tocó a esta partida: dónde está la orilla y qué
   * sembró el dios en los 3×3 chunks de alrededor. Es lo que hace verificable la
   * premisa del banco —«veinte partidas con semillas distintas»— sin creerle a la
   * semilla: dos semillas distintas con la misma firma son una partida repetida.
   */
  readonly firma: string
  readonly hash: string
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
 */
function correrPartida(semilla: bigint, tanque: number, tope: number): Corrida | undefined {
  const o = laOrilla(semilla)
  if (o === undefined) return undefined

  const p = new Partida(escenaDe(o, tanque))
  const m = new Mente({ actor: 'ana', memoria: new Creencias() })
  const d = new Detector()
  // El contrato de alimentación del detector: la primera muestra es el estado
  // INICIAL con la lista de eventos vacía.
  d.observar({ state: p.state, events: [] })

  const vuelos = new Map<string, number>()
  const nacidos = new Set<string>()
  const vistos = new Set<string>()
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
    d.observar({ state: p.state, events: eventos })
    for (const e of eventos) if (e.k === 'nacio') nacidos.add(e.id)
    for (const id of p.state.bodies.keys()) vistos.add(id)
    const cuerpo = p.state.bodies.get('ana-cuerpo')
    if (p.state.actors.has('ana')) {
      if (cuerpo !== undefined) aliento = qualityOf(cuerpo.body, 'stamina', p.state.phys)
    } else {
      murioEn = t
      break
    }
  }

  // CUERPOS QUE PUSO EL MUNDO POR SU CUENTA. Todo lo que se vio alguna vez, menos
  // los tres que este arnés colocó, menos los bancos de peces —que `stepWorld` sí
  // materializa— menos los que nacieron de un proceso. Lo que queda es lo que el
  // dios sembró y el mundo trajo. Ver el agujero (A) del encabezado.
  let cuerposDelMundo = 0
  for (const id of vistos) {
    if (A_MANO.includes(id) || id.startsWith('pozo:') || nacidos.has(id)) continue
    cuerposDelMundo += 1
  }

  let sueltasDecretadas = 0
  let firma = `${String(o.cx)}:${String(o.cy)}|${String(o.pozo.x)},${String(o.pozo.y)}|${String(o.parada.x)},${String(o.parada.y)}`
  const cx = Math.floor(o.parada.x / 16)
  const cy = Math.floor(o.parada.y / 16)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const sueltas = decretoDe(o.dios, o.phys, cx + dx, cy + dy).chunk.sueltas
      sueltasDecretadas += sueltas.length
      firma += `#${firmaDeSueltas(sueltas)}`
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
    vuelos,
    sueltasDecretadas,
    cuerposDelMundo,
    firma,
    hash: hashWorldState(p.state),
  }
}

/**
 * LAS VEINTE, con la política de reemplazo de §10 escrita y no improvisada: «si
 * alguna resulta no resoluble se reemplaza en orden por `20260728n + 20 + j` y el
 * reemplazo se anota». Acá «no resoluble» es lo único que puede serlo desde
 * afuera: que la semilla no tenga una sola orilla en 13×13 chunks.
 */
interface Banco {
  readonly corridas: readonly Corrida[]
  readonly reemplazos: readonly string[]
}

function correrElBanco(tanque: number, cuantas: number, tope = TICKS): Banco {
  const corridas: Corrida[] = []
  const reemplazos: string[] = []
  // `j` NO se reinicia entre ranuras: «se reemplaza EN ORDEN» quiere decir que la
  // segunda ranura que falla toma la siguiente semilla libre, no la misma que
  // tomó la primera. Si se reiniciara, dos ranuras jugarían el mismo mundo y la
  // premisa de las veinte semillas distintas se caería sin que nada lo dijera.
  let j = 0
  for (let k = 0; k < cuantas; k++) {
    const original = SEMILLA_BASE + BigInt(k)
    let c = correrPartida(original, tanque, tope)
    const intentadas: string[] = []
    while (c === undefined) {
      const reemplazo = SEMILLA_DE_REEMPLAZO + BigInt(j)
      j += 1
      intentadas.push(String(reemplazo))
      c = correrPartida(reemplazo, tanque, tope)
    }
    corridas.push(c)
    if (intentadas.length > 0) {
      const ultima = intentadas[intentadas.length - 1] ?? ''
      const fallidas = intentadas.slice(0, -1)
      reemplazos.push(
        `  ranura ${String(k)}: ${String(original)} sin orilla` +
          (fallidas.length === 0 ? '' : ` · también ${fallidas.join(', ')}`) +
          ` → juega ${ultima}`,
      )
    }
  }
  return { corridas, reemplazos }
}

// ─── Memoización, para no correr el mismo banco dos veces ────────────────────

let elCanonico: Banco | undefined
function canonico(): Banco {
  elCanonico ??= correrElBanco(TANQUE, PARTIDAS)
  return elCanonico
}

let elControl: Banco | undefined
function control(): Banco {
  elControl ??= correrElBanco(TANQUE_LLENO, MIDIENDO_EN_SERIO ? PARTIDAS : PARTIDAS_CORTAS)
  return elControl
}

// ─── El informe ──────────────────────────────────────────────────────────────

const dos = (x: number): string => x.toFixed(2)

/** El tick de la PRIMERA aparición de cada secuencia sobre todas las partidas. */
function primerasApariciones(b: Banco): ReadonlyMap<NombreDeSecuencia, number> {
  const out = new Map<NombreDeSecuencia, number>()
  for (const c of b.corridas) {
    for (const f of c.veredicto.filas) {
      if (!f.aparecio || f.tick === undefined) continue
      const y = out.get(f.nombre)
      if (y === undefined || f.tick < y) out.set(f.nombre, f.tick)
    }
  }
  return out
}

/**
 * LA TABLA CRUDA. Las tres cifras de §10 por secuencia, más el tick de la primera
 * aparición y la evidencia del primer disparo si lo hubo.
 */
function tablaDelBanco(b: Banco, titulo: string): string {
  const r = resumir(b.corridas.map((c) => c.veredicto))
  const primeras = primerasApariciones(b)
  const ruido = new Set(ruidoDelAzar())
  const n = b.corridas.length
  const lineas: string[] = [
    ``,
    `═══ ${titulo} ═══`,
    ``,
    `  ${'secuencia'.padEnd(38)} apareció  situación  no medida  azar  cuenta  1ª vez`,
    `  ${'─'.repeat(38)} ────────  ─────────  ─────────  ────  ──────  ──────`,
  ]
  for (const f of r.filas) {
    const t = primeras.get(f.nombre)
    lineas.push(
      `  ${f.nombre.padEnd(38)} ${`${String(f.aparecioEn)}/${String(n)}`.padStart(8)}  ` +
        `${`${String(f.situacionEn)}/${String(n)}`.padStart(9)}  ` +
        `${`${String(f.noMedidaEn)}/${String(n)}`.padStart(9)}  ` +
        `${(ruido.has(f.nombre) ? 'SÍ' : '·').padStart(4)}  ` +
        `${(f.cuenta && !ruido.has(f.nombre) ? 'SÍ' : 'no').padStart(6)}  ` +
        `${(t === undefined ? '—' : `t=${String(t)}`).padStart(6)}`,
    )
  }
  const cuentanDeVerdad = r.filas.filter((f) => f.cuenta && !ruido.has(f.nombre)).length
  lineas.push(
    ``,
    `  APARECIERON ${String(cuentanDeVerdad)} DE ${String(r.filas.length - ruido.size)} ` +
      `(§10.2: cuenta la que apareció en ≥ 2 de las ${String(n)} con situación, y que el azar NO firma)`,
    `  el azar firma ${String(ruido.size)} de ${String(r.filas.length)}: ${[...ruido].join(', ')}`,
    `  el crudo, sin descontar el ruido: ${String(r.cuantasCuentan)} de ${String(r.filas.length)}`,
    `  sin medir: ${String(r.filas.filter((f) => f.situacionEn === 0).length)} de ${String(r.filas.length)} ` +
      `→ ${r.interpretable ? 'interpretable' : 'NO INTERPRETABLE (§10: más de tres sin medir sobre nueve)'}`,
    `  contradicciones (disparó y el contra-detector negó la situación): ` +
      `${String(r.filas.reduce((a, f) => a + f.contradictorioEn, 0))}`,
  )
  // §10, «qué se publica pase lo que pase»: la masa del cuerpo elegido en cada
  // disparo de las entradas 2 y 8, y si el fuego era de vara sola o de cadena. Si
  // no hubo disparos se dice que no hubo, en vez de omitir la fila.
  const evidencias: string[] = []
  for (const c of b.corridas) {
    for (const f of c.veredicto.filas) {
      if (f.evidencia !== undefined) evidencias.push(`  ${String(c.semilla)} · ${f.nombre}: ${f.evidencia}`)
    }
  }
  lineas.push(
    ``,
    `  evidencia de los disparos (§10 pide la masa elegida y si el fuego era de vara o de cadena):`,
    evidencias.length === 0 ? `    NO HUBO UN SOLO DISPARO, ni un solo fuego en ninguna partida.` : evidencias.join('\n'),
    ``,
  )
  return lineas.join('\n')
}

/** El presupuesto: cuánto de los 20.000 ticks se usó de verdad. */
function tablaDelPresupuesto(b: Banco, titulo: string): string {
  const lineas: string[] = [``, `═══ ${titulo} ═══`, ``]
  let vividos = 0
  let muertas = 0
  for (const c of b.corridas) {
    if (c.murioEn >= 0) muertas += 1
    vividos += c.ticks
    const pesca = c.vuelos.get('aplicar(extraccion)') ?? 0
    const comidas = [...c.vuelos].filter(([k]) => k.startsWith('comer')).reduce((a, [, v]) => a + v, 0)
    lineas.push(
      `  ${String(c.semilla)} · chunk ${String(c.cx)}:${String(c.cy)} · ` +
        `parada ${String(c.parada.x)},${String(c.parada.y)} · ` +
        `${c.murioEn < 0 ? 'viva' : `murió t=${String(c.murioEn)}`} ` +
        `(${((c.ticks * 100) / TICKS).toFixed(1)}% del presupuesto) · ` +
        `aliento ${dos(c.alientoFinal)} · pescas ${String(pesca)} · bocados ${String(comidas)} · ` +
        `hash ${c.hash.slice(0, 8)}`,
    )
  }
  const presupuesto = b.corridas.length * TICKS
  lineas.push(
    ``,
    `  ${String(muertas)} de ${String(b.corridas.length)} partidas terminaron con la criatura muerta`,
    `  presupuesto usado: ${String(vividos)} de ${String(presupuesto)} ticks ` +
      `(${((vividos * 100) / presupuesto).toFixed(1)}%)`,
    ``,
  )
  return lineas.join('\n')
}

/** Qué despegó, sumado sobre todas las partidas. El diagnóstico de la mente. */
function tablaDeVuelos(b: Banco): string {
  const total = new Map<string, number>()
  for (const c of b.corridas) for (const [k, v] of c.vuelos) total.set(k, (total.get(k) ?? 0) + v)
  const orden = [...total].sort((a, x) => x[1] - a[1])
  return (
    `  habilidades que despegaron en las ${String(b.corridas.length)} partidas:\n` +
    (orden.length === 0 ? '    (ninguna)' : orden.map(([k, v]) => `    ${k.padEnd(24)} ×${String(v)}`).join('\n'))
  )
}

// ═══ (0) ANTES DE CORRER: ¿SON VEINTE MUNDOS O ES UNO? ══════════════════════

describe('(0) las veinte semillas, antes de correr una sola partida', () => {
  it.fails('LA CACHÉ DEL DECRETO NO LLEVA LA SEMILLA: dos dioses con una `Physics` son un mundo', () => {
    // POR QUÉ FALLA, Y POR QUÉ NO SE BORRA: `decretoDe` arma su clave con
    // `${cx}:${cy}` y busca en un `WeakMap` indexado por el objeto `Physics`
    // (`world/src/dios.ts:305-317`). La semilla vive en `EstadoDelDios`, que es el
    // PRIMER argumento, y no entra en la clave ni en el `WeakMap`. Así que la
    // segunda pregunta devuelve la respuesta de la primera — y no una copia
    // equivalente: EL MISMO OBJETO.
    //
    // MEDIDO, y es lo que imprime este test: con dos `Physics` distintas las dos
    // semillas dan dos mundos, y con una sola `Physics` dan uno.
    //
    // POR QUÉ IMPORTA MÁS QUE UN BUG DE CACHÉ: «20 partidas con semillas
    // distintas» es media frase del criterio de corte del proyecto. Todo el
    // repositorio construye la física una vez por módulo (`const PHYS =
    // buildSeedPhysics()` arriba de cada arnés), así que el banco obvio —una
    // `Physics`, veinte dioses— mide **la misma partida veinte veces** y nadie se
    // entera: la salida es idéntica renglón por renglón, que es exactamente lo que
    // uno esperaría de un mundo determinista.
    //
    // Este arnés lo esquiva con una `Physics` por partida (`nuevaFisica`). Eso es
    // un rodeo y no una reparación: la reparación es del motor —meter la semilla
    // en la clave— y por eso queda acá en rojo.
    const compartida = buildSeedPhysics()
    const a = decretoDe(crearDios(SEMILLA_BASE), compartida, 7, 7)
    const b = decretoDe(crearDios(SEMILLA_BASE + 1n), compartida, 7, 7)

    const pA = buildSeedPhysics()
    const pB = buildSeedPhysics()
    const separadas = [
      decretoDe(crearDios(SEMILLA_BASE), pA, 7, 7),
      decretoDe(crearDios(SEMILLA_BASE + 1n), pB, 7, 7),
    ].map((d) => firmaDeSueltas(d.chunk.sueltas))

    console.log(
      `\n─── LA CACHÉ DEL DECRETO, MEDIDA ───\n` +
        `  con UNA \`Physics\` compartida, chunk 7:7:\n` +
        `    semilla ${String(SEMILLA_BASE)}      ${firmaDeSueltas(a.chunk.sueltas).slice(0, 90)}\n` +
        `    semilla ${String(SEMILLA_BASE + 1n)}      ${firmaDeSueltas(b.chunk.sueltas).slice(0, 90)}\n` +
        `    ¿es el mismo objeto?  ${String(a === b)}\n` +
        `  con una \`Physics\` POR SEMILLA, el mismo chunk 7:7:\n` +
        `    semilla ${String(SEMILLA_BASE)}      ${(separadas[0] ?? '').slice(0, 90)}\n` +
        `    semilla ${String(SEMILLA_BASE + 1n)}      ${(separadas[1] ?? '').slice(0, 90)}\n`,
    )
    // Lo que SÍ vale hoy, y se afirma acá aunque el test esté en rojo: con una
    // física por partida las semillas se separan. Es la premisa del rodeo.
    expect(separadas[0]).not.toBe(separadas[1])
    // Y esto es lo que tendría que valer y no vale.
    expect(
      firmaDeSueltas(a.chunk.sueltas),
      'dos semillas distintas decretaron el mismo chunk',
    ).not.toBe(firmaDeSueltas(b.chunk.sueltas))
  })

  it('DE LAS VEINTE SEMILLAS DE §10, sólo siete tienen orilla: el resto se reemplaza', () => {
    // §10 fijó las semillas `20260728n + k` y dejó escrita la política: «si alguna
    // resulta no resoluble se reemplaza en orden por `20260728n + 20 + j` y el
    // reemplazo se anota». Acá se publica cuáles y por qué.
    //
    // «No resoluble» acá es lo único que puede serlo desde afuera, y es específico
    // de la escena canónica: **la semilla no tiene una sola orilla en 13×13
    // chunks**, o sea que no hay dónde poner «con hambre y un río a la vista». No
    // es un juicio sobre el mundo: es que la escena del criterio (1) del Hito 5
    // necesita un pozo con una celda seca al lado, y `world/tests/hito-5-la-pesca`
    // ya tenía medido que el 88,8% de los chunks de `agua-dulce` está enteramente
    // inundado.
    //
    // Y hay que decir de dónde sale que sean TRECE de veinte: la lista de §10 se
    // fijó sin correrla, y el agujero (B) —la caché sin semilla— hacía que
    // cualquier barrido de las veinte con una sola `Physics` encontrara orilla en
    // las veinte, todas la misma. O sea que el 13/20 no es mala suerte: es el
    // primer número que alguien mide sobre esas semillas.
    const filas: string[] = []
    let conOrilla = 0
    for (let k = 0; k < PARTIDAS; k++) {
      const semilla = SEMILLA_BASE + BigInt(k)
      const o = laOrilla(semilla)
      if (o === undefined) {
        filas.push(`  ${String(semilla)} · SIN ORILLA en 13×13 chunks → se reemplaza (§10)`)
        continue
      }
      conOrilla += 1
      filas.push(
        `  ${String(semilla)} · chunk ${String(o.cx).padStart(3)}:${String(o.cy).padStart(3)} · ` +
          `pozo ${String(o.pozo.x)},${String(o.pozo.y)} · parada ${String(o.parada.x)},${String(o.parada.y)}`,
      )
    }
    console.log(
      `\n─── LAS VEINTE SEMILLAS DE §10, UNA POR UNA ───\n${filas.join('\n')}\n` +
        `  ${String(conOrilla)} de ${String(PARTIDAS)} tienen orilla; ` +
        `las otras ${String(PARTIDAS - conOrilla)} se reemplazan en orden desde ${String(SEMILLA_DE_REEMPLAZO)}\n`,
    )
    expect(conOrilla).toBeGreaterThan(0)
    expect(conOrilla).toBeLessThanOrEqual(PARTIDAS)
  }, 300_000)

  it('y las veinte partidas que SE JUGARON son veinte mundos distintos', () => {
    // La premisa del banco, verificada sobre las semillas que de verdad se
    // corrieron —las de §10 más los reemplazos— y no sobre las que se pensaban
    // correr. Si esto fuera falso, la tabla de más abajo sería una partida
    // repetida veinte veces y el criterio no diría nada.
    //
    // La firma no es la semilla: es DÓNDE quedó la orilla y QUÉ sembró el dios en
    // los 3×3 chunks de alrededor. Comparar semillas no probaría nada —son
    // distintas por construcción— y es exactamente el error que el agujero (B)
    // deja pasar.
    const b = canonico()
    const firmas = new Set(b.corridas.map((c) => c.firma))
    console.log(
      `\n─── LAS VEINTE QUE SE JUGARON ───\n` +
        b.corridas
          .map(
            (c) =>
              `  ${String(c.semilla)} · chunk ${String(c.cx).padStart(3)}:${String(c.cy).padStart(3)} · ` +
              `parada ${String(c.parada.x)},${String(c.parada.y)} · ` +
              `${String(c.sueltasDecretadas)} sueltas decretadas alrededor`,
          )
          .join('\n') +
        `\n  firmas distintas: ${String(firmas.size)} de ${String(b.corridas.length)}\n`,
    )
    expect(firmas.size).toBe(PARTIDAS)
  }, 600_000)
})

/** La firma de lo que el dios sembró en un chunk. Sin `toLocaleString` ni orden de sistema. */
function firmaDeSueltas(
  sueltas: readonly { readonly substance: string; readonly i: number; readonly masa: number }[],
): string {
  return sueltas.map((s) => `${s.substance}@${String(s.i)}:${String(s.masa)}`).join(',')
}

// ═══ (1) EL MUNDO NO LE PONE EL PROBLEMA DELANTE ════════════════════════════

describe('(1) lo que el dios siembra y lo que el mundo materializa', () => {
  it.fails('EL DIOS SIEMBRA 90 COSAS ALREDEDOR Y EL MUNDO MATERIALIZA CERO', () => {
    // POR QUÉ FALLA, Y ES EL HALLAZGO QUE DECIDE LA CORRIDA ENTERA.
    //
    // `decretoDe(...).chunk.sueltas` trae lo que el dios sembró en cada chunk
    // —junco, piedra, hueso, hoja, grano, raíz, tubérculo alrededor de esta
    // orilla— y **`@anima/world` no lo lee en ningún lado**: `grep -rn "sueltas"
    // world/src` devuelve nueve renglones y los nueve son comentarios. Lo único
    // que `stepWorld` materializa del decreto es el banco de peces
    // (`materializarPozos`, `step.ts:2904`), y `conLoQueElDiosPone` de la capa de
    // percepción copia de la sombra únicamente lo que empieza con `pozo:`
    // (`perceive/src/bucle.ts:193-198`).
    //
    // CONSECUENCIA, y por eso este test está acá y no en un informe: los NUEVE
    // contra-detectores del documento preguntan por materia —dos candidatos de
    // fricción con masas distintas, dos permeabilidades, algo con filo, corteza y
    // atadura, algo sólido con qué hacer parrilla— y en este mundo la única
    // materia que existe es la que el arnés puso a mano. La Regla 4 del documento
    // dice qué hacer con eso: **no es una ausencia, es una no-medida**. Y §10 dice
    // qué significa nueve no-medidas sobre nueve: el resultado no es interpretable.
    //
    // QUÉ HABRÍA QUE CAMBIAR: que `stepWorld` materialice `chunk.sueltas` como ya
    // materializa `pozo`. Es del motor, no del juez ni del arnés — sembrarlas a
    // mano acá sería fabricar el mundo que uno quiere medir, que es exactamente lo
    // que la Regla 5 del documento castiga.
    const b = canonico()
    const filas = b.corridas.map(
      (c) =>
        `  ${String(c.semilla)} · el dios sembró ${String(c.sueltasDecretadas)} sueltas en 3×3 chunks · ` +
        `el mundo materializó ${String(c.cuerposDelMundo)}`,
    )
    const decretadas = b.corridas.reduce((a, c) => a + c.sueltasDecretadas, 0)
    const materializadas = b.corridas.reduce((a, c) => a + c.cuerposDelMundo, 0)
    console.log(
      `\n─── LO QUE EL DIOS SIEMBRA Y LO QUE EL MUNDO TRAE ───\n${filas.join('\n')}\n` +
        `  TOTAL: ${String(decretadas)} decretadas · ${String(materializadas)} materializadas\n`,
    )
    expect(decretadas).toBeGreaterThan(0)
    expect(materializadas, `el mundo materializó ${String(materializadas)} de ${String(decretadas)}`).toBeGreaterThan(0)
  }, 600_000)

  it('y por eso los nueve contra-detectores dan `false`: es no-medida, no ausencia', () => {
    // La Regla 4, hecha aserción. No se afirma que las secuencias no aparecieron
    // —eso sería leer un cero que nadie pudo mover— sino que **la situación no
    // existió**, que es un hecho del mundo y no de la mente.
    const b = canonico()
    const r = resumir(b.corridas.map((c) => c.veredicto))
    const conSituacion = r.filas.filter((f) => f.situacionEn > 0).map((f) => f.nombre)
    console.log(
      `\n  contra-detectores que dieron verdadero en alguna de las ${String(b.corridas.length)} partidas: ` +
        `${conSituacion.length === 0 ? 'NINGUNO' : conSituacion.join(', ')}\n`,
    )
    expect(r.filas.length).toBe(SECUENCIAS.length)
    expect(r.interpretable, 'con más de tres sin medir sobre nueve el resultado no es interpretable').toBe(false)
  }, 600_000)
})

// ═══ (2) EL BANCO DEL CRITERIO: VEINTE PARTIDAS ═════════════════════════════

describe('(2) veinte partidas con semillas distintas, cortadas en la muerte', () => {
  it('LA TABLA CRUDA, que es lo que este archivo existe para publicar', () => {
    const b = canonico()
    console.log(
      `\n═══ EL BANCO ═══\n` +
        `  ${String(b.corridas.length)} partidas · tope ${String(TICKS)} ticks (${String(TICKS / HZ_DE_REFERENCIA)} s de mundo)\n` +
        `  tanque de arranque: ${String(TANQUE)} de 1000 · capacity 3 · PHYSICS_VERSION ${String(PHYSICS_VERSION)}\n` +
        `  semillas: ${b.corridas.map((c) => String(c.semilla)).join(' ')}\n` +
        `  reemplazos de §10 (${String(b.reemplazos.length)}):\n` +
        (b.reemplazos.length === 0 ? '    ninguno\n' : `${b.reemplazos.join('\n')}\n`) +
        tablaDelPresupuesto(b, 'EL PRESUPUESTO: CUÁNTO DE LOS 20.000 TICKS SE USÓ') +
        tablaDeVuelos(b) +
        '\n' +
        tablaDelBanco(b, 'LAS NUEVE SECUENCIAS, PARTIDA POR PARTIDA'),
    )
    // Lo que se afirma siempre acá es lo ESTRUCTURAL: que el banco corrió lo que
    // dijo que iba a correr. Los números del veredicto van abajo, cada uno con su
    // aserción y su color.
    expect(b.corridas.length).toBe(PARTIDAS)
    expect(new Set(b.corridas.map((c) => c.semilla)).size).toBe(PARTIDAS)
    for (const c of b.corridas) expect(c.veredicto.filas.length).toBe(SECUENCIAS.length)
  }, 600_000)

  it('EL RUIDO DEL AZAR, publicado al lado del de la mente', () => {
    // ─── POR QUÉ ESTE NÚMERO VA ACÁ Y NO SÓLO EN EL ARCHIVO DEL ADVERSARIO ────
    //
    // Porque es el denominador. Una criatura que elige la FORMA del acto y los
    // CUERPOS con el dado del mundo —y que no consulta una sola cualidad, que es
    // exactamente la hipótesis nula de las nueve— firma TRES de las nueve sobre 20
    // semillas y 20.000 ticks. Ninguna de esas tres puede contar para el piso de
    // cuatro: una firma que produce un dado no distingue una mente de un dado.
    //
    // O sea que el criterio real que la mente tiene que cruzar es **4 sobre las 6
    // que quedan**, y no 4 sobre 9. Está medido y no estimado, con `dadoDe(
    // crearDios(semilla))` y sin un solo `Math.random`, en `tests/azar.ts`.
    const sin = correrElControl('EL AZAR SIN FUEGO', false, 1000)
    const con = correrElControl('EL AZAR CON EL FUEGO REGALADO', true, 40_000)
    const ruido = ruidoDelAzar()
    console.log(
      `\n═══ EL RUIDO DEL AZAR, EL DENOMINADOR DEL CRITERIO ═══\n` +
        `${tablaDelControl(sin)}\n\n${tablaDelControl(con)}\n\n` +
        `  ══ EL AZAR FIRMA ${String(ruido.length)} DE ${String(SECUENCIAS.length)} ══ ${ruido.join(' · ')}\n` +
        `  ⇒ el piso de cuatro hay que cruzarlo sobre las ${String(SECUENCIAS.length - ruido.length)} que quedan\n`,
    )
    // Se afirma que el control corrió y midió las nueve, no cuánto dio: el número
    // es un hallazgo y va en la salida, no en un umbral.
    expect(sin.filas.length).toBe(SECUENCIAS.length)
    expect(con.filas.length).toBe(SECUENCIAS.length)
    expect(ruido.length).toBeLessThanOrEqual(SECUENCIAS.length)
  }, 900_000)

  it.fails('EL CRITERIO DE CORTE: al menos 4 de las 9 — aparecieron 0', () => {
    // EL NÚMERO CRUDO, que es lo único que este archivo decide: **aparecieron 0 de
    // 9**. El umbral no se toca acá y no hace falta tocarlo: §10 del documento ya
    // dejó escrito, antes de correr, que con nueve entradas el 4 absoluto del
    // criterio publicado y el 40% proporcional (3,6 → 4) caen en el mismo número.
    //
    // Y hay que leerlo con la fila de al lado: con NUEVE no-medidas sobre nueve,
    // este cero **no dice nada sobre la mente**. §10: «si quedan más de tres sin
    // medir sobre nueve, el resultado no es interpretable». El bloque (1) tiene la
    // causa medida.
    const b = canonico()
    const r = resumir(b.corridas.map((c) => c.veredicto))
    console.log(
      `\n─── EL CRITERIO ───\n` +
        `  aparecieron ${String(r.cuantasCuentan)} de ${String(r.filas.length)} · ` +
        `el criterio publicado pide 4 · sin medir ${String(r.filas.filter((f) => f.situacionEn === 0).length)}\n`,
    )
    expect(r.cuantasCuentan, `aparecieron ${String(r.cuantasCuentan)} de ${String(r.filas.length)}`).toBeGreaterThanOrEqual(4)
  }, 600_000)

  it('CUÁNTO DEL PRESUPUESTO SE USÓ, que es la mitad de la pregunta', () => {
    // La otra mitad —«¿cuántas no aparecieron porque la criatura se murió antes de
    // poder intentarlas?»— la contesta el control del bloque (3). Acá va el
    // denominador: cuánto vivió de verdad cada partida.
    const b = canonico()
    const vividos = b.corridas.reduce((a, c) => a + c.ticks, 0)
    const presupuesto = b.corridas.length * TICKS
    const muertas = b.corridas.filter((c) => c.murioEn >= 0).length
    const ticksDeMuerte = b.corridas.filter((c) => c.murioEn >= 0).map((c) => c.murioEn)
    const menor = ticksDeMuerte.length === 0 ? -1 : Math.min(...ticksDeMuerte)
    const mayor = ticksDeMuerte.length === 0 ? -1 : Math.max(...ticksDeMuerte)
    console.log(
      `\n─── EL PRESUPUESTO ───\n` +
        `  ${String(muertas)}/${String(b.corridas.length)} partidas terminaron en muerte, ` +
        `entre el tick ${String(menor)} y el ${String(mayor)}\n` +
        `  ${String(vividos)} de ${String(presupuesto)} ticks vividos = ` +
        `${((vividos * 100) / presupuesto).toFixed(1)}% del presupuesto del criterio\n`,
    )
    // Se afirma que el banco midió el presupuesto, no cuánto dio: el número exacto
    // depende de la mente y esto es el juez.
    expect(vividos).toBeGreaterThan(0)
    expect(vividos).toBeLessThanOrEqual(presupuesto)
  }, 600_000)
})

// ═══ (3) EL CONTROL: ¿ES LA MUERTE O ES LA MENTE? ═══════════════════════════

describe('(3) el control con el tanque lleno', () => {
  it('con 1000 de aliento la criatura vive casi los 20.000 — y el juez dice lo mismo', () => {
    // LA PREGUNTA QUE ESTE BLOQUE CONTESTA, y sin ella el cero de arriba no
    // significa nada: ¿las secuencias no aparecieron porque la mente no llega, o
    // porque la criatura no vivió lo suficiente para intentarlas?
    //
    // Se corre el mismo banco con el tanque entero. Si el cero se moviera, la
    // respuesta sería «no vivió»; si no se mueve, la muerte temprana no es lo que
    // manda. **No se mueve.**
    //
    // COSTO: son 20 × 20.000 ticks de mundo con una mente encima. Se corren las
    // veinte sólo con `ANIMA_BANCO=1`; sin él se corren tres y se dice cuántas.
    // Ver el encabezado: acá el gatillo es el costo y no la varianza.
    const b = control()
    console.log(
      `\n═══ EL CONTROL, TANQUE ${String(TANQUE_LLENO)} ═══\n` +
        `  ${String(b.corridas.length)} partidas` +
        `${MIDIENDO_EN_SERIO ? ' (midiendo en serio)' : ` de ${String(PARTIDAS)} — sin ANIMA_BANCO=1`}\n` +
        tablaDelPresupuesto(b, 'EL PRESUPUESTO DEL CONTROL') +
        tablaDeVuelos(b) +
        '\n' +
        tablaDelBanco(b, 'LAS NUEVE, CON EL TANQUE LLENO'),
    )

    const vividos = b.corridas.reduce((a, c) => a + c.ticks, 0)
    const presupuesto = b.corridas.length * TICKS
    const r = resumir(b.corridas.map((c) => c.veredicto))
    console.log(
      `\n─── LA SEPARACIÓN ───\n` +
        `  con tanque ${String(TANQUE)}:  ${((canonico().corridas.reduce((a, c) => a + c.ticks, 0) * 100) / (PARTIDAS * TICKS)).toFixed(1)}% del presupuesto · ` +
        `${String(resumir(canonico().corridas.map((c) => c.veredicto)).cuantasCuentan)} de 9\n` +
        `  con tanque ${String(TANQUE_LLENO)}: ${((vividos * 100) / presupuesto).toFixed(1)}% del presupuesto · ` +
        `${String(r.cuantasCuentan)} de 9\n` +
        `  ⇒ ${r.cuantasCuentan === 0 ? 'multiplicar por tres el tiempo vivido no movió una sola fila: NO es la muerte' : 'el tiempo vivido SÍ mueve la aguja'}\n`,
    )

    // La corrida corta que sí afirma siempre: el control corrió y el juez lo
    // juzgó. Es lo que garantiza que el bloque no se rompa en silencio.
    expect(b.corridas.length).toBeGreaterThanOrEqual(PARTIDAS_CORTAS)
    for (const c of b.corridas) expect(c.veredicto.filas.length).toBe(SECUENCIAS.length)

    // Y lo caro se afirma sólo midiendo en serio.
    if (!MIDIENDO_EN_SERIO) return
    expect(b.corridas.length).toBe(PARTIDAS)
    expect(vividos / presupuesto).toBeGreaterThan(0.9)
  }, 900_000)
})

// ═══ EL CUADRO ══════════════════════════════════════════════════════════════

describe('el criterio de emergencia, con los números de esta corrida', () => {
  it('el cuadro', () => {
    const c = canonico()
    const k = control()
    const rc = resumir(c.corridas.map((x) => x.veredicto))
    const rk = resumir(k.corridas.map((x) => x.veredicto))
    const usado = c.corridas.reduce((a, x) => a + x.ticks, 0)
    const usadoK = k.corridas.reduce((a, x) => a + x.ticks, 0)
    const decretadas = c.corridas.reduce((a, x) => a + x.sueltasDecretadas, 0)
    const materializadas = c.corridas.reduce((a, x) => a + x.cuerposDelMundo, 0)
    console.log(
      [
        '',
        '════ EL CRITERIO DE EMERGENCIA, MEDIDO ════════════════════════════════════',
        '',
        `  el criterio ............... «al menos 4 de las 10» sobre una lista de ${String(SECUENCIAS.length)}`,
        `  APARECIERON ............... ${String(rc.cuantasCuentan)} de ${String(SECUENCIAS.length)}`,
        `  RUIDO DEL AZAR ............ ${String(ruidoDelAzar().length)} de ${String(SECUENCIAS.length)} las firma un bicho que elige con el dado:`,
        `                              ${ruidoDelAzar().join(', ')}`,
        `                              ⇒ el piso de cuatro hay que cruzarlo sobre las ${String(SECUENCIAS.length - ruidoDelAzar().length)} que quedan`,
        `  SIN MEDIR ................. ${String(rc.filas.filter((f) => f.situacionEn === 0).length)} de ${String(SECUENCIAS.length)}` +
          `  →  ${rc.interpretable ? 'interpretable' : 'EL RESULTADO NO ES INTERPRETABLE (§10)'}`,
        '',
        `  (A) el mundo no siembra ... el dios decretó ${String(decretadas)} cosas sueltas alrededor de la criatura`,
        `                              y el mundo materializó ${String(materializadas)}`,
        `  (B) las semillas .......... ${String(PARTIDAS)} mundos distintos SÓLO porque el arnés arma una \`Physics\` por`,
        `                              partida; \`decretoDe\` no lleva la semilla en la clave de su caché`,
        `  (C) el hambre ............. tanque ${String(TANQUE)}:  ${((usado * 100) / (c.corridas.length * TICKS)).toFixed(1)}% del presupuesto · ${String(rc.cuantasCuentan)} de ${String(SECUENCIAS.length)}`,
        `                              tanque ${String(TANQUE_LLENO)}: ${((usadoK * 100) / (k.corridas.length * TICKS)).toFixed(1)}% del presupuesto · ${String(rk.cuantasCuentan)} de ${String(SECUENCIAS.length)}`,
        `                              ⇒ la muerte temprana NO es lo que decide el cero`,
        `  (D) las semillas de §10 .... ${String(c.reemplazos.length)} de ${String(PARTIDAS)} no tienen orilla en 13×13 chunks`,
        `                              y se reemplazaron en orden desde ${String(SEMILLA_DE_REEMPLAZO)}, como §10 manda`,
        '',
        `  semillas jugadas .......... ${c.corridas.map((x) => String(x.semilla)).join(' ')}`,
        `  tanque publicado (§3) ..... ${String(TANQUE)} · control ${String(TANQUE_LLENO)}`,
        `  PHYSICS_VERSION ........... ${String(PHYSICS_VERSION)}`,
        `  hashes .................... ${c.corridas.map((x) => x.hash.slice(0, 6)).join(' ')}`,
        '',
        '═══════════════════════════════════════════════════════════════════════════',
        '',
      ].join('\n'),
    )
    expect(rc.filas.length).toBe(SECUENCIAS.length)
  }, 900_000)
})
