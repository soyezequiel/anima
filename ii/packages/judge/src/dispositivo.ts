/**
 * JUZGAR UN DISPOSITIVO DESPLEGADO — Hito 7, tramo H.
 *
 * Hasta acá el juez tenía un solo sujeto: una habilidad con un objetivo
 * delante. El caso de aceptación pide otro, y **es el que importa**:
 *
 *   > un **dispositivo autónomo desplegado** sobre un `Stock`. Se la puede
 *   > dejar, alejarse, volver y **retirar la captura**.
 *
 * Los cuatro mundos adversos que el tramo G no pudo escribir eran todos de este
 * sujeto —stock vacío, ubicación incorrecta, dos compitiendo, restauración a
 * mitad—, y el motivo estaba medido: `escena.ts` arma dos cuerpos, sin dios y
 * sin celdas. Un pozo no cabe ahí.
 *
 * ─── LO QUE ESTE SUJETO DESTRABA, y es lo que lo justifica ──────────────────
 *
 * **`utilidad` deja de ser `inconcluso`.** Para una habilidad, «sirve» era una
 * pregunta sin con-respecto-a-qué. Para un dispositivo hay una respuesta y es un
 * número: **`desplegados.get(id).captura.length`**. Atrapó o no atrapó.
 *
 * Y ahí está la mitad del caso de aceptación que el documento marca como la que
 * no existía: **construir algo no demuestra que funcione**. Un aparejo que se
 * arma perfecto y saca cero piezas tiene `construccion` en verde y `utilidad` en
 * rojo, y eso es un resultado legítimo y no un error del arnés.
 *
 * ─── POR QUÉ NO HAY CONTRATO ACÁ ────────────────────────────────────────────
 *
 * Una habilidad promete por escrito (`Contrato.establece`). Un dispositivo no
 * habla: es un cuerpo. Lo único que promete lo dice su geometría —**`catch > 0`,
 * una cualidad DERIVADA de las puntas sueltas**— y eso el juez lo lee del cuerpo,
 * no de una declaración.
 *
 * Es a propósito y es el punto 12 del gate: si el dispositivo declarara lo que
 * hace, habría dónde escribir «trampa» y el caso de aceptación dejaría de medir
 * nada.
 */

import { HZ_DE_REFERENCIA, qualityOf } from '@anima/physics'
import type { Body, Physics } from '@anima/physics'
import {
  crearDios,
  decretoDe,
  idDePozo,
  mapaDeActores,
  mapaDeCuerpos,
  place,
  stepWorld,
} from '@anima/world'
import type { Actor, EstadoDelDios, Intent, Placement, WorldBody, WorldState } from '@anima/world'
import { EL_ACTOR } from './escena.js'
import { elPeor, SIN_CORRER } from './tipos.js'
import type { Cargo, Dictamen, Grado, Regresion, Veredicto } from './tipos.js'

/**
 * CUÁNTOS TICKS TRABAJA SOLO.
 *
 * Veinte segundos de mundo a la frecuencia de referencia, que es el mismo número
 * que usa `world/tests/el-dispositivo-retiene-solo.test.ts` para su criterio (a).
 * No se eligió acá: se copió de donde ya estaba medido, para que los dos digan lo
 * mismo sobre la misma física.
 */
const TICKS_SOLO = 400

export interface Orilla {
  readonly dios: EstadoDelDios
  readonly cx: number
  readonly cy: number
  readonly pozo: Placement
  /** Una celda seca pegada al pozo: desde acá lo despliega la criatura. */
  readonly parada: Placement
}

/**
 * Un chunk con pozo y una celda SECA pegada. Barrido canónico, sin azar.
 *
 * Sin azar porque el banco tiene que ser reproducible: un juez que sortea su
 * orilla no puede repetir un veredicto, y un veredicto que no se repite no es un
 * veredicto.
 */
export function buscarOrilla(dios: EstadoDelDios, phys: Physics): Orilla | undefined {
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
        if ((vecino.celdas[i] as { wet: number }).wet < 0.9) return { dios, cx, cy, pozo: p, parada }
      }
    }
  }
  return undefined
}

export type ClaseDeDispositivo =
  | 'normal'
  | 'stock-vacio'
  | 'ubicacion-incorrecta'
  | 'dispositivo-roto'
  | 'a-medio-armar'
  | 'al-borde-del-fuego'
  | 'dos-compitiendo'
  | 'restauracion-a-mitad'

export const ADVERSAS_DE_DISPOSITIVO: readonly ClaseDeDispositivo[] = [
  'stock-vacio',
  'ubicacion-incorrecta',
  'dispositivo-roto',
]

/**
 * LA FLEXIBILIDAD DE LO QUEMADO — y no es un número elegido acá.
 *
 * Es el que la **ley 4** le escribe al residuo cuando algo arde
 * (`physics/src/leyes.ts:1499`, `flexibility: 0.02`). Se copia en vez de
 * inventarse uno, y hay un guardián que lee ese archivo y se pone rojo si el
 * número se mueve: si la ley cambiara, este mundo estaría rompiendo un aparejo
 * de una forma que el mundo ya no produce.
 */
export const FLEXIBILIDAD_DE_LO_QUEMADO = 0.02

/**
 * EL APAREJO QUEMADO, y por qué esto ES «dispositivo roto» sin inventar nada.
 *
 * El mundo no tiene estado «roto» —se midió: no hay cualidad de integridad, ni
 * desgaste, ni nada que `stepWorld` mire— y la conclusión rápida fue que este
 * mundo no se podía escribir. **Estaba mal.**
 *
 * Lo único que hace retener a un cuerpo es `catch > 0`, que sale de
 * `freeStrandEnds`, que sólo cuenta las partes con `flexibility >= 0.8`. Y la
 * ley 4 le pone **0,02** a lo que arde. Medido, con el umbral exacto:
 *
 *   hebra con flexibility 0.80   →  catch 0.150
 *   hebra con flexibility 0.79   →  catch 0.000   ← dejó de pescar
 *
 * O sea que **un aparejo al que se le quema la hebra deja de pescar**, y nadie
 * programó «roto»: sale de la geometría, igual que el punto 12 del gate.
 *
 * Se queman TODAS las partes y no sólo las hebras, porque un fuego no elige.
 */
export function quemado(obra: Body): Body {
  const b = obra as unknown as { parts: { q?: Record<string, number> }[] }
  return {
    ...obra,
    parts: b.parts.map((p) => ({ ...p, q: { ...(p.q ?? {}), flexibility: FLEXIBILIDAD_DE_LO_QUEMADO } })),
  } as unknown as Body
}

/**
 * EL UMBRAL DE LA HEBRA — `STRAND_FLEXIBILITY` de `physics/src/body.ts:429`.
 *
 * Es privado allá, así que se copia con su guardián, igual que el número de lo
 * quemado. Un cuerpo justo EN el umbral todavía retiene; uno un pelo abajo, no.
 */
export const FLEXIBILIDAD_MINIMA_DE_HEBRA = 0.8

/**
 * MUNDOS ESTADIFICADOS: la obra agarrada A MITAD de algo.
 *
 * El documento pide «evaluación jerárquica con **mundos estadificados**» y hasta
 * el tramo H había uno solo de verdad —`restauracion-a-mitad`, que agarra el
 * ciclo por la mitad—. Estos dos agarran a la OBRA por la mitad, que es la otra
 * lectura y la que faltaba:
 *
 * | | qué estado a medias |
 * |---|---|
 * | `a-medio-armar` | las piezas están, la atadura no |
 * | `al-borde-del-fuego` | la hebra chamuscada justo hasta el umbral |
 *
 * Ninguno es adverso. Son los que separan «funciona» de «funciona porque el
 * arnés se lo puso perfecto».
 */
export function aMedioArmar(obra: Body): Body {
  return { ...obra, joints: [] } as unknown as Body
}

/**
 * LA HEBRA CHAMUSCADA JUSTO HASTA EL UMBRAL, y el `min` no es un detalle.
 *
 * La primera versión le PONÍA `0.8` a todas las partes, y eso subía la
 * flexibilidad de la madera de 0,4 a 0,8: no era «a medio quemar», era «la
 * madera se volvió soga». Se veía en el número —`catch` saltaba de 0,150 a
 * 0,450, o sea que el fuego MEJORABA el aparejo— y es al revés de lo que hace
 * el fuego, que endurece.
 *
 * Con `min` sólo BAJA lo que estaba por encima: la hebra queda justo en el
 * umbral y la madera no se toca. El aparejo sigue pescando, por un pelo.
 */
export function alBordeDelFuego(obra: Body, phys: Physics): Body {
  const b = obra as unknown as { parts: { substance: string; mass: number; q?: Record<string, number> }[] }
  return {
    ...obra,
    parts: b.parts.map((p) => {
      const suyo = p.q?.['flexibility'] ?? (phys.substances.get(p.substance)?.perUnitMass.flexibility ?? 0)
      return {
        ...p,
        q: { ...(p.q ?? {}), flexibility: Math.min(suyo, FLEXIBILIDAD_MINIMA_DE_HEBRA) },
      }
    }),
  } as unknown as Body
}

export interface MundoDeDispositivo {
  readonly id: string
  readonly clase: ClaseDeDispositivo
  readonly adverso: boolean
  readonly reservado: boolean
  /** Lo que se espera. En los adversos, que NO atrape. */
  readonly deberiaAtrapar: boolean
}

function criatura(): Body {
  return {
    id: `${EL_ACTOR}-cuerpo`,
    form: 'bloque',
    parts: [{ substance: 'carne', mass: 2, q: {} }],
    joints: [],
    state: { stamina: 5000 },
  } as unknown as Body
}

function elActor(holding: readonly string[]): Actor {
  return { id: EL_ACTOR, body: `${EL_ACTOR}-cuerpo`, holding, capacity: 4, permits: 'irreversible' }
}

function escena(o: Orilla, obras: readonly Body[], phys: Physics): WorldState {
  const cuerpos: WorldBody[] = [
    { body: criatura(), at: o.parada },
    ...obras.map((b) => ({ body: b, at: o.parada, heldBy: EL_ACTOR })),
  ]
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys,
    bodies: mapaDeCuerpos(cuerpos),
    actors: mapaDeActores([elActor(obras.map((b) => b.id))]),
    cells: new Map(),
    desplegados: new Map(),
    nextId: 1,
    dios: o.dios,
  } as unknown as WorldState
}

function corre(s: WorldState, n: number, is: readonly Intent[] = []): WorldState {
  let w = s
  for (let i = 0; i < n; i++) w = stepWorld(w, i === 0 ? is : []).state
  return w
}

/** Cuántas piezas tiene retenidas un dispositivo. Es el número de `utilidad`. */
export function cuantoAtrapo(w: WorldState, id: string): number {
  return (w.desplegados.get(id)?.captura ?? []).length
}

export interface CorridaDeDispositivo {
  readonly mundo: MundoDeDispositivo
  readonly atrapo: number
  readonly quedoDesplegado: boolean
  readonly comoDebia: boolean
}

/**
 * EL BANCO DE UN DISPOSITIVO — los cuatro mundos que el tramo G no podía escribir.
 *
 * `stock-vacio` y `ubicacion-incorrecta` son los adversos: el dispositivo tiene
 * que NO sacar nada. Los otros dos no son adversos, son **controles de que el
 * mundo no se rompe**: dos aparejos sobre el mismo pozo tienen que repartirse lo
 * que hay, y guardar y cargar a mitad de ciclo tiene que dar lo mismo.
 */
export function correrElBancoDeDispositivo(
  obra: Body,
  o: Orilla,
  phys: Physics,
): readonly CorridaDeDispositivo[] {
  const out: CorridaDeDispositivo[] = []
  const meter = (clase: ClaseDeDispositivo, atrapo: number, quedoDesplegado: boolean, i: number): void => {
    const adverso = ADVERSAS_DE_DISPOSITIVO.includes(clase)
    const deberiaAtrapar = !adverso
    out.push({
      mundo: {
        id: `${obra.id}·${clase}`,
        clase,
        adverso,
        reservado: i % 4 === 1,
        deberiaAtrapar,
      },
      atrapo,
      quedoDesplegado,
      comoDebia: deberiaAtrapar ? atrapo > 0 : atrapo === 0,
    })
  }

  const desplegar = (s: WorldState, id: string, at: Placement): WorldState =>
    corre(s, 1, [place({ by: EL_ACTOR, seq: 0 }, id, at)])

  // ─── normal ──────────────────────────────────────────────────────────────
  {
    const w = corre(desplegar(escena(o, [obra], phys), obra.id, o.pozo), TICKS_SOLO)
    meter('normal', cuantoAtrapo(w, obra.id), w.desplegados.has(obra.id), 0)
  }

  // ─── stock vacío ─────────────────────────────────────────────────────────
  //
  // OJO CON CÓMO SE VACÍA UN POZO, que la forma obvia NO HACE NADA.
  //
  // `stockDe` (world/src/step.ts) busca primero el stock VIVO —el índice que
  // sale de `dios.stocks`— y **si no lo encuentra cae al DECRETO**. Y
  // `dios.stocks` está vacío hasta que alguien lo toca: medido, sigue en cero
  // después de tres ticks con la criatura parada al lado.
  //
  // O sea que mapear `dios.stocks` poniendo `amount: 0` recorre una lista vacía
  // y no cambia nada: el mundo sigue leyendo los 45 peces del decreto. Este
  // banco lo hizo así en su primera versión y el aparejo sacó **3 piezas de un
  // pozo supuestamente agotado** — el test lo agarró.
  //
  // Lo que sí funciona es AGREGAR la entrada viva, que es la que gana.
  //
  // Y SE CONGELA LA REPOBLACIÓN, que fue el segundo hallazgo. Con `amount: 0`
  // solo, el aparejo seguía sacando **una** pieza — y estaba bien: el pozo
  // repone `perMillePorSegundo = 225`, o sea **4,5 individuos en los 20
  // segundos** que dura la corrida. Un pozo que se repuebla no está vacío, y
  // medir «vacío» sin congelar la reposición mide la tasa de reposición en vez
  // del dispositivo.
  {
    const banco = idDePozo(o.cx, o.cy)
    const decretado = decretoDe(o.dios, phys, o.cx, o.cy).pozo?.stock
    const stocks = [
      ...(o.dios.stocks ?? []),
      ...(decretado === undefined
        ? []
        : [{ banco, stock: { ...decretado, amount: 0, perMillePorSegundo: 0 } }]),
    ]
    const vacio = { ...o.dios, stocks } as unknown as EstadoDelDios
    const w = corre(desplegar(escena({ ...o, dios: vacio }, [obra], phys), obra.id, o.pozo), TICKS_SOLO)
    meter('stock-vacio', cuantoAtrapo(w, obra.id), w.desplegados.has(obra.id), 1)
  }

  // ─── ubicación incorrecta ────────────────────────────────────────────────
  // Desplegado en la celda seca en vez de sobre el pozo. El `Desplegado`
  // resuelve contra qué pozo trabaja AL DESPLEGAR, así que acá no resuelve
  // ninguno y no puede sacar nada.
  {
    const w = corre(desplegar(escena(o, [obra], phys), obra.id, o.parada), TICKS_SOLO)
    meter('ubicacion-incorrecta', cuantoAtrapo(w, obra.id), w.desplegados.has(obra.id), 2)
  }

  // ─── dispositivo roto ────────────────────────────────────────────────────
  // El mismo aparejo con las hebras quemadas. Sobre el mismo pozo lleno, así
  // que lo único que cambia es él: si igual saca algo, `catch` no era lo que
  // hacía el trabajo. Ver `quemado()`.
  {
    const roto = quemado(obra)
    const w = corre(desplegar(escena(o, [roto], phys), roto.id, o.pozo), TICKS_SOLO)
    meter('dispositivo-roto', cuantoAtrapo(w, roto.id), w.desplegados.has(roto.id), 3)
  }

  // ─── estadificados: la obra a mitad de algo ──────────────────────────────
  for (const [clase, hecho] of [
    ['a-medio-armar', aMedioArmar(obra)],
    ['al-borde-del-fuego', alBordeDelFuego(obra, phys)],
  ] as const) {
    const w = corre(desplegar(escena(o, [hecho], phys), hecho.id, o.pozo), TICKS_SOLO)
    meter(clase, cuantoAtrapo(w, hecho.id), w.desplegados.has(hecho.id), clase === 'a-medio-armar' ? 4 : 5)
  }

  // ─── dos compitiendo ─────────────────────────────────────────────────────
  {
    const otro: Body = { ...obra, id: `${obra.id}-bis` }
    let s = escena(o, [obra, otro], phys)
    s = desplegar(s, obra.id, o.pozo)
    s = corre(s, 1, [place({ by: EL_ACTOR, seq: 0 }, otro.id, o.pozo)])
    const w = corre(s, TICKS_SOLO)
    meter('dos-compitiendo', cuantoAtrapo(w, obra.id) + cuantoAtrapo(w, otro.id), w.desplegados.has(obra.id), 6)
  }

  // ─── restauración a mitad del ciclo ──────────────────────────────────────
  // Se corre la mitad, se copia el estado entero y se sigue desde la copia. Si
  // el ciclo dependiera de algo que no está en el estado, acá se rompe.
  {
    const mitad = corre(desplegar(escena(o, [obra], phys), obra.id, o.pozo), TICKS_SOLO / 2)
    const copia: WorldState = JSON.parse(
      JSON.stringify(mitad, (_k, v: unknown) =>
        v instanceof Map ? { __map: [...v.entries()] } : typeof v === 'bigint' ? { __big: String(v) } : v,
      ),
      (_k, v: unknown) => {
        const o2 = v as { __map?: [unknown, unknown][]; __big?: string }
        if (o2 !== null && typeof o2 === 'object' && Array.isArray(o2.__map)) return new Map(o2.__map)
        if (o2 !== null && typeof o2 === 'object' && typeof o2.__big === 'string') return BigInt(o2.__big)
        return v
      },
    ) as WorldState
    const w = corre(copia, TICKS_SOLO / 2)
    meter('restauracion-a-mitad', cuantoAtrapo(w, obra.id), w.desplegados.has(obra.id), 7)
  }

  return out
}

function veredicto(cargo: Cargo, grado: Grado, porque: string, cs: readonly CorridaDeDispositivo[]): Veredicto {
  const adversos = cs.filter((c) => c.mundo.adverso)
  return {
    cargo,
    grado,
    porque,
    corrida: {
      mundos: cs.length,
      aprobados: cs.filter((c) => c.comoDebia).length,
      adversos: adversos.length,
      adversosAprobados: adversos.filter((c) => c.comoDebia).length,
    },
  }
}

/**
 * EL DICTAMEN DE UN DISPOSITIVO.
 *
 * Los mismos cuatro cargos, y acá los cuatro se pueden medir. El que cambia de
 * verdad es `utilidad`: para una habilidad no había con qué; para un aparejo hay
 * un número y se llama captura.
 */
export function juzgarDispositivo(obra: Body, phys: Physics, semilla: bigint): Dictamen {
  const nombre = obra.id
  const o = buscarOrilla(crearDios(semilla), phys)
  if (o === undefined) {
    return {
      habilidad: nombre,
      cargos: [veredicto('plano', 'injuzgable', 'la semilla no tiene una orilla en 13×13 chunks', [])],
      grado: 'injuzgable',
      regresiones: [],
    }
  }

  // `plano` es la geometría, no una declaración: lo único que hace retener a un
  // cuerpo es `catch > 0`, derivada de las puntas sueltas. Ver el encabezado.
  const catchDe = qualityOf(obra, 'catch', phys)
  if (catchDe <= 0) {
    return {
      habilidad: nombre,
      cargos: [
        veredicto('plano', 'no-promueve', `su geometría no retiene: catch = ${catchDe.toFixed(3)}`, []),
      ],
      grado: 'no-promueve',
      regresiones: [],
    }
  }

  const cs = correrElBancoDeDispositivo(obra, o, phys)
  const normal = cs.find((c) => c.mundo.clase === 'normal')
  const adversos = cs.filter((c) => c.mundo.adverso)
  const pasaronAdversos = adversos.filter((c) => !c.comoDebia)

  const cargos: Veredicto[] = [
    veredicto('plano', 'promueve', `catch = ${catchDe.toFixed(3)}`, cs),
    // `construccion` pregunta si el despliegue AGARRA, y por eso mira sólo los
    // mundos donde se lo puso sobre el pozo.
    //
    // Medido: en `ubicacion-incorrecta` el mundo NO registra el `Desplegado` —
    // no se puede dejar un aparejo en tierra seca—. La primera versión de este
    // cargo miraba los cinco mundos y sacaba «se cayó del despliegue» con los
    // cinco comportándose como debían: estaba castigando al dispositivo por un
    // mundo diseñado para estar mal. Que ahí no agarre es el resultado correcto
    // de ESE mundo, y quien lo cobra es `uso`.
    ((): Veredicto => {
      const sobreElPozo = cs.filter((c) => c.mundo.clase !== 'ubicacion-incorrecta')
      const agarraron = sobreElPozo.filter((c) => c.quedoDesplegado)
      return veredicto(
        'construccion',
        agarraron.length === sobreElPozo.length ? 'promueve' : 'no-promueve',
        agarraron.length === sobreElPozo.length
          ? `quedó desplegado en los ${String(sobreElPozo.length)} mundos donde se lo puso sobre el pozo`
          : `se cayó del despliegue en ${String(sobreElPozo.length - agarraron.length)} mundo(s) sobre el pozo`,
        cs,
      )
    })(),
    veredicto(
      'uso',
      pasaronAdversos.length === 0 ? 'promueve' : 'no-promueve',
      pasaronAdversos.length === 0
        ? `se quedó quieto en los ${String(adversos.length)} mundos donde no hay nada que sacar`
        : `SACÓ EN ${String(pasaronAdversos.length)} MUNDO(S) DONDE NO HAY NADA: ${pasaronAdversos.map((c) => c.mundo.clase).join(', ')}`,
      cs,
    ),
    veredicto(
      'utilidad',
      normal === undefined ? 'inconcluso' : normal.atrapo > 0 ? 'promueve' : 'no-promueve',
      normal === undefined
        ? 'no se pudo correr el mundo normal'
        : normal.atrapo > 0
          ? `sacó ${String(normal.atrapo)} pieza(s) en ${String(TICKS_SOLO)} ticks, sola`
          : 'SE ARMÓ BIEN Y NO SACÓ NADA: construir algo no demuestra que funcione',
      cs,
    ),
  ]

  const regresiones: Regresion[] = cs
    .filter((c) => !c.comoDebia)
    .map((c) => ({
      habilidad: nombre,
      cargo: 'utilidad' as const,
      semilla: `${String(semilla)}·${c.mundo.id}`,
      queSeEspera: c.mundo.deberiaAtrapar ? 'que saque algo' : 'que NO saque nada',
    }))

  return { habilidad: nombre, cargos, grado: elPeor(cargos.map((c) => c.grado)), regresiones }
}

export { SIN_CORRER }
