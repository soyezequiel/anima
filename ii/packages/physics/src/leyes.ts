// ─── @anima/physics/leyes.ts ─────────────────────────────────────────────────
//
// EL MOTOR. Lo que `admit()` es a los procesos que la criatura propone, esto es
// al mundo: las leyes que corren solas, sin que nadie las invoque.
//
// De las doce leyes, solo CUATRO son aplicables por la criatura (`process.ts`).
// Las otras ocho viven acá y no tienen verbo: la criatura las PROVOCA colocando
// las cosas. Ver ADR II-0001 — encender no es una acción, es una consecuencia, y
// en este archivo eso es literal: no hay ninguna función que se llame `encender`.
//
// ─── Lo único cerrado sigue siendo la física ────────────────────────────────
//
// Acá no hay ni una fila por sustancia. Cada ley pregunta por TAGS y por
// CUALIDADES, y una sustancia que el oráculo invente mañana se quema, se cocina
// y se pudre igual. Los únicos nombres propios de este archivo son los de las
// leyes; los de las cosas no aparecen nunca. Que eso sea cierto lo prueba
// `tests/emergencia.test.ts`, que no menciona ni una sustancia por su nombre.
//
// ─── Determinismo ───────────────────────────────────────────────────────────
//
// No hay `Math.exp`, `Math.pow`, `Math.log`, `**`, `Math.random`, `Date`, `Intl`
// ni `performance`. Solo `+ − × ÷`, comparaciones y `Math.min`/`Math.max`, que
// ECMAScript SÍ especifica bit a bit (IEEE-754). Es el mismo argumento que hace
// `quality.ts` para su evaluador, y vale por la misma razón.
//
// La integración es INCREMENTAL a propósito. El barrido térmico del Hito 0
// resolvió estas mismas ecuaciones en forma cerrada —con `Math.exp` y `Math.log`,
// porque es un banco y corre una vez— y acá no se puede: la forma cerrada
// necesita exponenciales. Un tick de `d += r·(techo − d)` es la MISMA curva
// muestreada, y solo usa multiplicar y sumar.
//
// ─── El candado ─────────────────────────────────────────────────────────────
//
// Todo paso termina en `conservar()`, que es un solo lugar y no una promesa
// repartida por seis leyes: ninguna cuenta conservada puede salir del tick
// valiendo más de lo que entró. No es solo una red contra bugs futuros: es que
// `nutrition` y `fuelEnergy` son INTENSIVAS y lo que se conserva es el producto
// `q · mass`, así que reescalar la masa obliga a reescalar el intensivo, y ese
// ida y vuelta en doubles puede devolver un último bit de más. Con el candado,
// «no aumenta» es exacto y no «no aumenta salvo 1e-16», que es la clase de
// promesa que no se puede testear de verdad.

import type { Body, Joint, Part } from './body.js'
import { MAX_JOINTS, MAX_PARTS, qualityOf, violationsOf } from './body.js'
import type { Physics } from './physics.js'
import { buildSeedPhysics } from './physics.js'
import type { QualityId, QualityVector } from './quality.js'
import { clampToRange, CONSERVED, QUALITY_IDS, specOf } from './quality.js'
import type { QualityTest, Role } from './process.js'
import type { Substance, SubstanceId, Tag } from './substance.js'

// ─── Ley 1 · térmica ─────────────────────────────────────────────────────────
//
// LA TABLA NO ERA UNA TABLA. El documento de arquitectura traía cuatro
// `formFactor` escritos a mano (0.012 / 0.03 / 0.60 / 0.125) y la auditoría los
// acusó de ser «la tabla de recetas disfrazada, pero en la ley 1». El barrido
// del Hito 0 despejó que las cuatro filas son la MISMA función evaluada en
// cuatro puntos, con tres constantes de montaje. Ver
// `ii/docs/hito-0-barrido-termico.md`, hallazgo 1.

/**
 * Cuánto de la superficie del cuerpo mira a la fuente. Enumeración CERRADA de
 * relaciones espaciales —apoyado en el piso, sostenido encima, tocando la
 * brasa—, no una fila por situación: agregar un montaje es agregar una manera de
 * poner las cosas en el mundo, no un caso especial.
 */
export type Montaje = 'piso' | 'parrilla' | 'contacto'

export const MONTAJES: readonly Montaje[] = ['piso', 'parrilla', 'contacto']

export const EXPOSICION: Readonly<Record<Montaje, number>> = {
  piso: 0.06,
  parrilla: 0.25,
  contacto: 0.6,
}

/** Temperatura del mundo cuando no hay nada que la mueva. */
export const T_AMBIENTE = 15

/** Acoplamiento DESNUDO del cuerpo con el ambiente. La ley lo divide por `heatCapacity`. */
export const H_PERDIDA = 0.5

/** `exposicion(montaje) / (1 + d²)`. Las cuatro filas del documento, exactas. */
export function formFactor(distancia: number, montaje: Montaje): number {
  const d = distancia > 0 ? distancia : 0
  return EXPOSICION[montaje] / (1 + d * d)
}

/** `T_eq = T_ambiente + potencia · formFactor / h`. La ley 1 en régimen. */
export function temperaturaDeEquilibrio(
  potencia: number,
  distancia: number,
  montaje: Montaje,
  ambiente: number = T_AMBIENTE,
): number {
  return ambiente + (potencia * formFactor(distancia, montaje)) / H_PERDIDA
}

// ─── El entorno ──────────────────────────────────────────────────────────────

/** Una fuente de calor vista desde el cuerpo. `potencia` sale de `emitsPower`. */
export interface Fuente {
  potencia: number
  distancia: number
  montaje: Montaje
}

/** Las cuatro cualidades de celda del ADR II-0002, menos `sheltered`, que es derivada. */
export interface Celda {
  oxygen: number
  wet: number
  ambiente: number
}

export interface Entorno {
  celda: Celda
  fuente?: Fuente
}

export const CELDA_AL_AIRE: Celda = { oxygen: 1, wet: 0, ambiente: T_AMBIENTE }

/**
 * Una celda con la oclusión de la ley 12 puesta: tapar baja el oxígeno. 0.2 está
 * por debajo del 0.35 con el que la ley 4 decide residuo carbonoso, y ésa es la
 * técnica entera — tapar el fuego no es un caso especial, es bajar un número.
 */
export const CELDA_TAPADA: Celda = { oxygen: 0.2, wet: 0, ambiente: T_AMBIENTE }

export const AL_AIRE: Entorno = { celda: CELDA_AL_AIRE }

// ─── Constantes de calibración, todas con nombre y con porqué ────────────────

/**
 * Techo de la ley 5: por más que se cocine, nada se digiere del todo. Es el
 * `toward` del `drive` de `digestibility` del documento.
 */
export const DIGESTIBILIDAD_TECHO = 0.95

/** Ley 5, tasa de cocción: `r = 0.010·k/(0.2 + toughness)`. */
const COCCION_BASE = 0.01
const COCCION_DUREZA_PISO = 0.2

/** Ley 5, lo que baja la toxicidad y la putrefacción por unidad de `k`. */
const COCCION_DESTOXIFICA = 0.03
const COCCION_DESPUDRE = 0.008

/**
 * Ley 5, evaporación: `0.0006 · k²`. **EL EXPONENTE 2 ES UN HALLAZGO, NO UN
 * TIPEO** (`ii/docs/hito-0-barrido-termico.md`, hallazgo 2). Con `evap ∝ k`, el
 * agua perdida por unidad de cocción no depende de la temperatura, más caliente
 * es siempre mejor, y cocinar deja de ser una técnica para ser una receta. Con
 * `k²` aparece la tensión «comer antes o comer mejor», que es lo que hay que
 * aprender. Tocar esto obliga a volver a correr `pnpm ii:barrido`.
 */
const EVAPORACION_BASE = 0.0006
const EVAPORACION_EXPONENTE = 2

/**
 * Humedad por encima de la cual nada prende. Es la ley 11 metida en la 3: la
 * leña mojada no arde, y no hace falta un caso especial para decirlo.
 */
export const HUMEDAD_QUE_APAGA = 0.45

/** Sin algo de aire no hay llama. Pirolizar, en cambio, no necesita oxígeno. */
const OXIGENO_MINIMO = 0.05

/**
 * Debajo de esto el residuo conserva su esqueleto de carbono; encima, se quema
 * también y queda lo mineral. Es la única línea que separa las dos técnicas, y
 * por eso tapar el fuego es algo que la criatura puede descubrir en vez de un
 * caso escrito a mano.
 */
export const OXIGENO_QUE_HACE_CENIZA = 0.35

/** Ley 3: cuánto carboniza por tick lo que superó su punto de pirólisis. */
const TASA_CARBONIZACION = 0.01

/** Ley 3: cuánto combustible por unidad de masa se lleva la llama por tick. */
const TASA_COMBUSTION = 0.05

/** Ley 4: dónde deja de haber materia orgánica y empieza el residuo. */
export const CARBONIZADO_QUE_TRANSMUTA = 0.8

/** Ley 6: cuánto se pudre por tick, con humedad 1 y a temperatura de trabajo. */
const TASA_DESCOMPOSICION = 0.0004

/** Ley 11: cuánto seca un grado por encima del ambiente, por tick. */
const SECADO_POR_GRADO = 0.00002

/** Ley 11: cuánto se acerca la humedad del cuerpo a la de la celda por tick. */
const TASA_MOJADO = 0.01

// ─── Ley 4 · el residuo, derivado del tag y no de una fila ───────────────────

export type ClaseDeResiduo = 'carbonoso' | 'mineral'

/** Con poco aire queda el esqueleto de carbono. Nadie escribió la palabra. */
export const TAG_RESIDUO_SIN_AIRE: ClaseDeResiduo = 'carbonoso'

/** Con aire de sobra se quema también, y queda lo que no arde. */
export const TAG_RESIDUO_CON_AIRE: ClaseDeResiduo = 'mineral'

/**
 * Qué fracción de la masa sobrevive a la transmutación. Los dos números son del
 * documento de arquitectura y son la diferencia visible entre las dos técnicas:
 * tapar rinde casi cinco veces más materia que no tapar.
 */
export const FRACCION_DE_RESIDUO: Readonly<Record<ClaseDeResiduo, number>> = {
  carbonoso: 0.28,
  mineral: 0.06,
}

/** Lo único que VIAJA de la sustancia madre al residuo, tal cual el documento. */
const RESIDUO_CONCENTRA_COMBUSTIBLE = 1.6
const RESIDUO_RIGIDEZ = 0.3

/** El residuo que conserva el carbono vuelve a prender, pero mucho más arriba. */
const RESIDUO_IGNICION = 420

/** Lo que no arde no tiene techo térmico útil; alto y finito, nunca infinito. */
const NO_ARDE = 900

// ─── El resultado de un tick ─────────────────────────────────────────────────

export type LeyId =
  | 'termica'
  | 'combustion'
  | 'transmutacion'
  | 'desnaturalizacion'
  | 'descomposicion'
  | 'humedad'

export interface Paso {
  body: Body
  /**
   * Si la ley 4 transmutó, la sustancia NUEVA que hay que dar de alta. No sale
   * de ninguna tabla: se deriva de la clase de residuo y del `fuelEnergy` de la
   * madre.
   */
  nueva?: Substance
  /** Qué leyes corrieron, en orden. Para que un test pueda decir POR QUÉ. */
  leyes: readonly LeyId[]
}

// ─── Lectura y escritura del estado ──────────────────────────────────────────

/**
 * El estado del cuerpo que las leyes leen.
 *
 * Se lee con `qualityOf`, que ya resuelve las tres fuentes (derivada, `state`,
 * partes) y ya recorta al rango. Se escribe SIEMPRE en `state`, salvo la masa,
 * que vive en las partes y no se duplica: dos lugares para la masa es un lugar
 * donde puede quedar vieja.
 */
interface Lectura {
  temperature: number
  moisture: number
  charred: number
  digestibility: number
  toxicity: number
  decay: number
  nutrition: number
  fuelEnergy: number
  ignitionPoint: number
  pyrolysisAt: number
  denaturesAt: number | undefined
  toughness: number
  mass: number
}

function leer(b: Body, phys: Physics): Lectura {
  return {
    temperature: qualityOf(b, 'temperature', phys),
    moisture: qualityOf(b, 'moisture', phys),
    charred: qualityOf(b, 'charred', phys),
    digestibility: qualityOf(b, 'digestibility', phys),
    toxicity: qualityOf(b, 'toxicity', phys),
    decay: qualityOf(b, 'decay', phys),
    nutrition: qualityOf(b, 'nutrition', phys),
    fuelEnergy: qualityOf(b, 'fuelEnergy', phys),
    ignitionPoint: qualityOf(b, 'ignitionPoint', phys),
    pyrolysisAt: qualityOf(b, 'pyrolysisAt', phys),
    denaturesAt: puntoDeCoccion(b, phys),
    toughness: qualityOf(b, 'toughness', phys),
    mass: qualityOf(b, 'mass', phys),
  }
}

/**
 * `denaturesAt` es `undefined` para lo que no se cocina, y esa diferencia
 * importa: la madera no está cruda, y no hace falta ninguna lista de comestibles
 * para saberlo. `qualityOf` devolvería 0, que es un umbral de cocción a 0 °C —
 * o sea, todo lo que no se cocina se cocinaría siempre.
 */
function puntoDeCoccion(b: Body, phys: Physics): number | undefined {
  if (b.state.denaturesAt !== undefined) return b.state.denaturesAt
  for (const p of b.parts) {
    if (p.q.denaturesAt !== undefined) return qualityOf(b, 'denaturesAt', phys)
    if (phys.substances.get(p.substance)?.perUnitMass.denaturesAt !== undefined) {
      return qualityOf(b, 'denaturesAt', phys)
    }
  }
  return undefined
}

/** Los tags de la materia de este cuerpo, unidos. Una sola parte orgánica lo hace orgánico. */
export function tagsDe(b: Body, phys: Physics): readonly Tag[] {
  const out: Tag[] = []
  for (const p of b.parts) {
    const s = phys.substances.get(p.substance)
    if (s === undefined) continue
    for (const t of s.tags) if (!out.includes(t)) out.push(t)
  }
  return out
}

/**
 * La parte que manda para decidir de qué está hecho el cuerpo: la más pesada.
 * Con empate gana el índice más chico, que es estable y no depende del orden en
 * que el mundo agregó las partes.
 */
function parteDominante(b: Body): Part | undefined {
  let best: Part | undefined
  let bestMass = -1
  for (const p of b.parts) {
    const m = p.q.mass ?? p.mass
    if (m > bestMass) {
      best = p
      bestMass = m
    }
  }
  return best
}

function conEstado(b: Body, cambios: QualityVector): Body {
  return { ...b, state: { ...b.state, ...cambios } }
}

/** Una sola cualidad, por si la clave es dinámica. Evita un objeto con índice suelto. */
function conCualidad(b: Body, q: QualityId, v: number): Body {
  const state: QualityVector = { ...b.state }
  state[q] = v
  return { ...b, state }
}

/** Reescala la masa de todas las partes por el mismo factor. La masa vive ahí y en ningún otro lado. */
function escalarMasa(b: Body, factor: number): Body {
  if (factor === 1) return b
  const f = factor > 0 ? factor : 0
  const parts: Part[] = b.parts.map((p) => {
    const q: QualityVector = { ...p.q }
    if (q.mass !== undefined) q.mass = q.mass * f
    return { substance: p.substance, mass: p.mass * f, q }
  })
  // Si alguien había escrito la masa a nivel cuerpo, se reescala también: dejar
  // una de las dos vieja es el mismo bug que `isDerived` evita en otro lado.
  const state: QualityVector = { ...b.state }
  if (state.mass !== undefined) state.mass = state.mass * f
  return { ...b, parts, state }
}

function masaDePartes(b: Body): number {
  let total = 0
  for (const p of b.parts) total += p.q.mass ?? p.mass
  return total
}

/**
 * Deja la masa en UN solo lugar: las partes.
 *
 * `body.ts` declara que un `state.mass` escrito le gana a la suma de las partes,
 * y tiene razón —la ley 5 evapora a nivel cuerpo y esa masa es más nueva—, pero
 * un cuerpo donde los dos números discrepan es una bomba de materia esperando:
 * cualquier operación que reconstruya las partes (transmutar, atar, partir) usa
 * las partes y se queda con el número viejo. Acá se reconcilia una vez, al
 * entrar, bajando el valor del cuerpo a las partes que lo componen.
 *
 * Si las partes suman cero y el cuerpo declaraba masa, no hay cómo repartirla:
 * se pierde. Preferimos perder materia a inventarla, y eso es una decisión.
 */
export function normalizarMasa(b: Body): Body {
  const declarada = b.state.mass
  if (declarada === undefined) return b
  const suma = masaDePartes(b)
  const state: QualityVector = { ...b.state }
  delete state.mass
  const sinEstado: Body = { ...b, state }
  if (suma === declarada) return sinEstado
  if (suma <= 0) return sinEstado
  return escalarMasa(sinEstado, declarada / suma)
}

// ─── El candado de conservación ──────────────────────────────────────────────

/**
 * El TOTAL conservado de una cualidad en un cuerpo.
 *
 * `mass` y `stamina` son extensivas y su total es su valor. `nutrition` y
 * `fuelEnergy` viven en `Substance.perUnitMass`, o sea que el número es POR
 * UNIDAD DE MASA: lo que se conserva es el producto `q · mass`, y comparar el
 * intensivo dejaría pasar una bomba de materia que sube la nutrición al partir
 * un cuerpo en dos. Está dicho con esas palabras en `quality.ts`; acá es código.
 */
export function totalConservado(b: Body, q: QualityId, phys: Physics): number {
  const v = qualityOf(b, q, phys)
  return specOf(q).extent === 'extensive' ? v : v * qualityOf(b, 'mass', phys)
}

/**
 * Después de un tick, ninguna cuenta conservada vale más que antes. Punto.
 *
 * Baja el intensivo hasta que el producto entre; el bucle está acotado porque
 * cada vuelta baja un ulp relativo y con una o dos alcanza para cualquier
 * redondeo de IEEE-754. Si en cinco vueltas no entró, se pone en cero:
 * preferimos perder materia a inventarla, y eso es una decisión, no un descuido.
 */
function conservar(antes: Body, despues: Body, phys: Physics): Body {
  let out = despues
  for (const q of CONSERVED) {
    const techo = totalConservado(antes, q, phys)
    if (totalConservado(out, q, phys) <= techo) continue
    if (specOf(q).extent === 'extensive') {
      if (q === 'mass') {
        const ahora = qualityOf(out, 'mass', phys)
        if (ahora > 0) out = bajarMasaHasta(out, techo, ahora, phys)
      } else {
        out = conCualidad(out, q, clampToRange(q, techo))
      }
      continue
    }
    const masa = qualityOf(out, 'mass', phys)
    if (masa <= 0) {
      out = conCualidad(out, q, 0)
      continue
    }
    let v = techo / masa
    for (let i = 0; i < 5 && v * masa > techo; i++) v = v * (1 - Number.EPSILON)
    if (v * masa > techo) v = 0
    out = conCualidad(out, q, clampToRange(q, v))
  }
  return out
}

/**
 * Reescala las partes hasta que la masa del cuerpo entre en el techo.
 *
 * Un solo `escalarMasa(techo/ahora)` no alcanza: repartir el factor entre varias
 * partes y volver a sumarlas puede caer un ulp por encima, y «un ulp por encima»
 * de una cuenta conservada es materia inventada, aunque sea poquita. Cada vuelta
 * baja un ulp relativo; con dos alcanza para cualquier redondeo de IEEE-754.
 */
function bajarMasaHasta(b: Body, techo: number, ahora: number, phys: Physics): Body {
  let f = techo / ahora
  for (let i = 0; i < 5; i++) {
    const probado = escalarMasa(b, f)
    if (qualityOf(probado, 'mass', phys) <= techo) return probado
    f = f * (1 - Number.EPSILON)
  }
  return escalarMasa(b, 0)
}

const EN_EL_CATALOGO: ReadonlySet<string> = new Set<string>(QUALITY_IDS)

/**
 * Todo lo guardado, dentro de su rango y finito. Ninguna ley escribe sin cruzar
 * por acá. El recorrido es sobre las claves que hay, y el orden no importa
 * porque cada una se recorta sola: no hay ninguna decisión que dependa de en qué
 * orden se escribieron.
 */
function recortar(b: Body): Body {
  const state: QualityVector = {}
  let cambio = false
  for (const k of Object.keys(b.state)) {
    const q = k as QualityId
    const v = b.state[q]
    if (v === undefined) continue
    if (!EN_EL_CATALOGO.has(k)) {
      state[q] = v
      continue
    }
    const r = Number.isFinite(v) ? clampToRange(q, v) : 0
    state[q] = r
    if (r !== v) cambio = true
  }
  return cambio ? { ...b, state } : b
}

// ─── Ley 1 ───────────────────────────────────────────────────────────────────

/**
 * `heatCapacity = Σ partes (masa · calor específico)`. Por eso una piedra grande
 * se enfría lento y una hoja se enfría en dos ticks, sin que nadie escriba
 * «piedra» ni «hoja».
 */
export function capacidadTermica(b: Body, phys: Physics): number {
  let total = 0
  for (const p of b.parts) {
    const s = phys.substances.get(p.substance)
    total += (p.q.mass ?? p.mass) * (s?.specificHeat ?? 1)
  }
  return total
}

function leyTermica(b: Body, e: Entorno, phys: Physics, l: Lectura): Body {
  const objetivo =
    e.fuente === undefined
      ? e.celda.ambiente
      : temperaturaDeEquilibrio(
          e.fuente.potencia,
          e.fuente.distancia,
          e.fuente.montaje,
          e.celda.ambiente,
        )
  const cap = capacidadTermica(b, phys)
  // Sin masa no hay inercia térmica: el cuerpo ES el ambiente. Y el acople no
  // puede superar 1, o el cuerpo pasaría de largo el equilibrio y oscilaría.
  const acople = cap > 0 ? Math.min(1, H_PERDIDA / cap) : 1
  const t = l.temperature + (objetivo - l.temperature) * acople
  return conEstado(b, { temperature: clampToRange('temperature', t) })
}

// ─── Ley 5 · desnaturalización ───────────────────────────────────────────────

/** ¿Este cuerpo está, ahora, en su ventana de cocción? */
export function estaEnVentanaDeCoccion(b: Body, phys: Physics): boolean {
  return ventanaDeCoccion(leer(b, phys), tagsDe(b, phys))
}

function ventanaDeCoccion(l: Lectura, tags: readonly Tag[]): boolean {
  if (!tags.includes('organico')) return false
  if (l.denaturesAt === undefined) return false
  return l.temperature >= l.denaturesAt && l.temperature < l.ignitionPoint
}

/**
 * La ley que hace la comida cocida, y no dice ni el nombre de la comida ni el
 * del verbo.
 *
 * Sube `digestibility`, baja `toxicity` y `decay`, y evapora agua.
 *
 * ─── Qué quiere decir «se va agua, NO nutrientes» ───────────────────────────
 *
 * La ley NO TOCA `nutrition`, y eso es exactamente lo que el documento pide: el
 * número de la sustancia —9 para lo carnoso— sigue siendo 9 después de cocinar.
 * Lo que baja es la MASA, y por lo tanto el total `nutrition · mass` y las
 * calorías, que son `nutrition · mass · digestibility`.
 *
 * Tuve la tentación de hacer lo contrario: subir el intensivo para que el total
 * se conservara exacto (evaporar agua concentra los nutrientes, que es lo que
 * pasa de verdad en una olla). No se puede, y el motivo es el barrido térmico
 * del Hito 0: si el total no baja con el agua, el rendimiento de cocinar deja de
 * depender de cuánta agua se perdió, y con eso se va la tensión «comer antes o
 * comer mejor» que el `k²` de la evaporación existe para producir. Medido: con
 * el intensivo concentrándose, el sitio rápido rinde IGUAL o más que el lento y
 * el barrido entero pierde sentido. El documento y el barrido dicen lo mismo;
 * la intuición de la olla, no.
 */
function leyDesnaturalizacion(b: Body, l: Lectura): Body {
  const k = (l.temperature - (l.denaturesAt ?? 0)) / 100
  if (k <= 0) return b
  const r = (COCCION_BASE * k) / (COCCION_DUREZA_PISO + l.toughness)
  const evap = Math.min(l.moisture, EVAPORACION_BASE * potenciaEntera(k, EVAPORACION_EXPONENTE))

  const out = conEstado(b, {
    digestibility: clampToRange(
      'digestibility',
      l.digestibility + r * (DIGESTIBILIDAD_TECHO - l.digestibility),
    ),
    toxicity: clampToRange('toxicity', l.toxicity * (1 - Math.min(1, COCCION_DESTOXIFICA * k))),
    decay: clampToRange('decay', l.decay * (1 - Math.min(1, COCCION_DESPUDRE * k))),
    moisture: clampToRange('moisture', l.moisture - evap),
  })
  return evap > 0 ? escalarMasa(out, 1 - evap) : out
}

/**
 * `x^n` con `n` entero chico, por multiplicación. `Math.pow` está prohibido —no
 * tiene precisión especificada— y para n = 2, que es el que pide la ley 5, esto
 * es exacto en IEEE-754.
 */
function potenciaEntera(x: number, n: number): number {
  let acc = 1
  for (let i = 0; i < n; i++) acc = acc * x
  return acc
}

// ─── Ley 11 · humedad ────────────────────────────────────────────────────────

/**
 * El agua moja lo que toca, y el sol y el fuego secan.
 *
 * NO mueve masa, y la asimetría con la ley 5 es deliberada: el agua de un cuerpo
 * ya está adentro de su `mass`, así que cobrarla dos veces —una como `moisture`
 * que baja y otra como `mass` que baja— sería contar dos veces la misma agua. El
 * único lugar donde evaporar cuesta masa es la ley 5, porque ESE número
 * (`0.0006·k²`) es el que el barrido del Hito 0 midió y el que hace existir la
 * decisión «comer antes o comer mejor». Fuera de la ventana de cocción, secarse
 * es un cambio de estado, no de materia.
 */
function leyHumedad(b: Body, e: Entorno, l: Lectura): Body {
  const haciaLaCelda = (e.celda.wet - l.moisture) * TASA_MOJADO
  const secado = Math.max(0, l.temperature - e.celda.ambiente) * SECADO_POR_GRADO
  const m = l.moisture + haciaLaCelda - secado
  return conEstado(b, { moisture: clampToRange('moisture', m) })
}

// ─── Ley 3 · combustión ──────────────────────────────────────────────────────

/**
 * Dos umbrales y no uno, y ésa es la física que las sustancias semilla ya
 * declaraban sin que nadie la corriera: `pyrolysisAt` es donde la materia se
 * descompone dejando su esqueleto de carbono, `ignitionPoint` es donde eso que
 * se desprende arde con llama. En lo cocinable los dos números coinciden; en la
 * madera la pirólisis empieza VEINTE GRADOS ANTES de que haya llama.
 *
 * Pirolizar no necesita aire. Arder sí. De esa única diferencia sale que tapar
 * el fuego dé una cosa y no taparlo dé otra, sin ningún caso especial.
 */
function leyCombustion(b: Body, e: Entorno, l: Lectura): Body {
  const seca = l.moisture < HUMEDAD_QUE_APAGA
  const piroliza = seca && l.temperature >= l.pyrolysisAt
  const arde = seca && l.temperature >= l.ignitionPoint && e.celda.oxygen > OXIGENO_MINIMO
  if (!piroliza && !arde) return b

  const charred = piroliza ? Math.min(1, l.charred + TASA_CARBONIZACION) : l.charred
  const cambios: QualityVector = { charred: clampToRange('charred', charred) }

  if (arde) {
    cambios.fuelEnergy = clampToRange(
      'fuelEnergy',
      Math.max(0, l.fuelEnergy - TASA_COMBUSTION * e.celda.oxygen),
    )
  }
  // Lo que se carboniza deja de ser comida, y no porque una lista lo prohíba:
  // `nutrition` es conservada y esto solo la baja. Es el «olvidado sobre las
  // brasas» del documento hecho aritmética, sin ningún nombre propio adentro.
  if (l.nutrition > 0) cambios.nutrition = clampToRange('nutrition', l.nutrition * (1 - charred))
  if (l.digestibility > 0) {
    cambios.digestibility = clampToRange('digestibility', l.digestibility * (1 - charred))
  }
  return conEstado(b, cambios)
}

// ─── Ley 6 · descomposición ──────────────────────────────────────────────────

/**
 * Lo guardado se pudre: `decay` sube con la humedad, baja `nutrition` y sube
 * `toxicity`. El calor la corta —arriba del punto de cocción no hay putrefacción,
 * hay cocción— y por eso guardar comida cocida tiene sentido sin que nadie
 * escriba «la comida cocida dura más».
 */
function leyDescomposicion(b: Body, l: Lectura): Body {
  if (l.nutrition <= 0) return b
  if (l.charred > 0) return b
  if (l.denaturesAt !== undefined && l.temperature >= l.denaturesAt) return b
  const r = TASA_DESCOMPOSICION * l.moisture * (1 + Math.max(0, l.temperature - T_AMBIENTE) / 100)
  if (r <= 0) return b
  return conEstado(b, {
    decay: clampToRange('decay', l.decay + r * (1 - l.decay)),
    nutrition: clampToRange('nutrition', l.nutrition * (1 - r)),
    toxicity: clampToRange('toxicity', l.toxicity + r * (1 - l.toxicity)),
  })
}

// ─── Ley 4 · transmutación ───────────────────────────────────────────────────

/**
 * La ley que hace el residuo negro sin escribir su nombre.
 *
 * Se resuelve por TAG y por una sola pregunta al entorno: cuánto aire hay. No
 * hay `into: <id>` en ningún lado; hay una sustancia derivada de la madre, con
 * su `fuelEnergy` concentrado y su nutrición en cero. Un hongo que el dios
 * inventó ayer se piroliza igual, sin fila propia — eso lo prueba
 * `tests/emergencia.test.ts`.
 *
 * Y el residuo NO lleva el tag `organico`, que es lo que impide que lo recién
 * hecho vuelva a transmutar y se deshaga adentro del fuego que lo hizo. Ése era
 * el bug del ejemplo (a) de una de las propuestas.
 */
function leyTransmutacion(
  b: Body,
  e: Entorno,
  phys: Physics,
  l: Lectura,
): { body: Body; nueva: Substance } | undefined {
  if (l.charred < CARBONIZADO_QUE_TRANSMUTA) return undefined
  if (!tagsDe(b, phys).includes('organico')) return undefined
  const madre = parteDominante(b)
  if (madre === undefined) return undefined
  const sMadre = phys.substances.get(madre.substance)
  if (sMadre === undefined) return undefined

  const sinAire = e.celda.oxygen < OXIGENO_QUE_HACE_CENIZA
  const clase = sinAire ? TAG_RESIDUO_SIN_AIRE : TAG_RESIDUO_CON_AIRE
  const nueva = residuoDe(sMadre, clase, l.fuelEnergy)
  const fraccion = FRACCION_DE_RESIDUO[clase]

  // Todas las partes pasan a ser el residuo: lo que se quemó se quemó entero, y
  // dejar media rama sin quemar adentro de un tizón sería un cuerpo que miente.
  const parts: Part[] = b.parts.map((p) => ({
    substance: nueva.id,
    mass: (p.q.mass ?? p.mass) * fraccion,
    q: {},
  }))
  // Del estado sobrevive la temperatura, que es del cuerpo y no de la materia.
  // Todo lo demás lo dice la sustancia nueva; arrastrarlo sería que el residuo
  // recuerde la humedad de lo que ya no es.
  return { body: { ...b, parts, state: { temperature: l.temperature } }, nueva }
}

/**
 * El residuo de una sustancia, derivado de su clase y de nada más.
 *
 * Lo ÚNICO que viaja de la madre es su `fuelEnergy`, concentrado por el factor
 * del documento: la masa se fue en volátiles y el poder calorífico que quedaba
 * está ahora en menos materia. Todo el resto son las constantes de la clase, que
 * son dos y están arriba con su porqué. Si esto fuera una tabla por sustancia,
 * una sustancia nueva no tendría residuo hasta que alguien le escribiera la fila
 * — que es exactamente lo que este modelo vino a no hacer.
 */
export function residuoDe(madre: Substance, clase: ClaseDeResiduo, fuelEnergy: number): Substance {
  const conservaCarbono = clase === TAG_RESIDUO_SIN_AIRE
  const combustible = conservaCarbono
    ? clampToRange('fuelEnergy', fuelEnergy * RESIDUO_CONCENTRA_COMBUSTIBLE)
    : 0
  return {
    id: `residuo-${clase}-de-${madre.id}`,
    lexeme: {
      nombre: `${madre.lexeme.nombre} ${conservaCarbono ? 'hecho tizón' : 'hecho ceniza'}`,
      genero: madre.lexeme.genero,
      sinonimos: [],
    },
    tags: [clase],
    perUnitMass: {
      // Lo que ardió no alimenta. `nutrition` es conservada: esto solo la baja.
      nutrition: 0,
      digestibility: 0,
      toxicity: 0.1,
      fuelEnergy: combustible,
      ignitionPoint: conservaCarbono ? RESIDUO_IGNICION : NO_ARDE,
      pyrolysisAt: NO_ARDE,
      moisture: 0,
      rigidity: RESIDUO_RIGIDEZ,
      flexibility: 0.02,
      tensile: 0.05,
      cohesion: 0.3,
      toughness: 0.2,
      sharpness: 0.1,
      decay: 0,
      permeability: 0.4,
      charred: 1,
    },
    specificHeat: 0.9,
    provenance: { by: 'oraculo' },
  }
}

// ─── El tick ─────────────────────────────────────────────────────────────────

/**
 * Un tick de mundo sobre un cuerpo. Puro: mismo cuerpo y mismo entorno, mismo
 * resultado, en cualquier máquina y en cualquier orden.
 *
 * El orden de las leyes está fijo y es parte del contrato: primero se decide la
 * temperatura, después lo que la temperatura hace, y al final lo que queda. Un
 * orden que dependiera de un mapa o de un `Object.keys` haría divergir el
 * replay, que es la razón por la que este paquete existe.
 */
export function paso(entrada: Body, e: Entorno, phys: Physics): Paso {
  const leyes: LeyId[] = []
  // La masa se reconcilia ANTES de que corra ninguna ley: media docena de leyes
  // reconstruyen las partes, y si el cuerpo trae una masa escrita que no coincide
  // con las suyas, la primera que reconstruya se queda con el número viejo.
  const b0 = normalizarMasa(entrada)
  const tags = tagsDe(b0, phys)

  let b = leyTermica(b0, e, phys, leer(b0, phys))
  leyes.push('termica')

  let l = leer(b, phys)
  if (ventanaDeCoccion(l, tags)) {
    b = leyDesnaturalizacion(b, l)
    leyes.push('desnaturalizacion')
  } else {
    // Fuera de la ventana la humedad la mueve la ley 11; adentro, la 5. Nunca
    // las dos, o el agua se contaría dos veces.
    b = leyHumedad(b, e, l)
    leyes.push('humedad')
  }

  l = leer(b, phys)
  const ardido = leyCombustion(b, e, l)
  if (ardido !== b) {
    b = ardido
    leyes.push('combustion')
  }

  l = leer(b, phys)
  const podrido = leyDescomposicion(b, l)
  if (podrido !== b) {
    b = podrido
    leyes.push('descomposicion')
  }

  l = leer(b, phys)
  const mutado = leyTransmutacion(b, e, phys, l)
  let nueva: Substance | undefined
  if (mutado !== undefined) {
    b = mutado.body
    nueva = mutado.nueva
    leyes.push('transmutacion')
  }

  // El techo de conservación es el cuerpo TAL COMO ENTRÓ, no el normalizado:
  // normalizar no puede ser una excusa para ganar un ulp.
  b = conservar(entrada, recortar(b), nueva === undefined ? phys : conSustancia(phys, nueva))
  return nueva === undefined ? { body: b, leyes } : { body: b, nueva, leyes }
}

/** Una `Physics` nueva con esta sustancia adentro. La vieja no se toca. */
export function conSustancia(phys: Physics, s: Substance): Physics {
  const substances: Substance[] = []
  for (const v of phys.substances.values()) if (v.id !== s.id) substances.push(v)
  substances.push(s)
  return buildSeedPhysics({
    qualities: phys.qualities,
    substances,
    processes: [...phys.processes.values()],
    version: phys.version,
  })
}

export interface Corrida {
  body: Body
  /** La física resultante: si algo transmutó, trae la sustancia nueva adentro. */
  phys: Physics
  /** Las sustancias que el mundo tuvo que dar de alta, en orden. */
  nuevas: readonly Substance[]
  /** Las leyes que corrieron alguna vez a lo largo de la corrida. */
  leyes: readonly LeyId[]
}

/** `ticks` pasos seguidos. El entorno no cambia: quien lo quiera mover, que llame a `paso`. */
export function correr(b: Body, e: Entorno, phys: Physics, ticks: number): Corrida {
  let body = b
  let actual = phys
  const nuevas: Substance[] = []
  const leyes: LeyId[] = []
  for (let i = 0; i < ticks; i++) {
    const r = paso(body, e, actual)
    body = r.body
    if (r.nueva !== undefined) {
      actual = conSustancia(actual, r.nueva)
      nuevas.push(r.nueva)
    }
    for (const id of r.leyes) if (!leyes.includes(id)) leyes.push(id)
  }
  return { body, phys: actual, nuevas, leyes }
}

// ─── Ley 7 · unión ───────────────────────────────────────────────────────────
//
// La ley que hace la caña sin que nadie escriba «caña». Es el rendimiento `join`
// del proceso `union` hecho función; vive acá y no en `process.ts` porque
// `process.ts` es un catálogo de datos y esto es el motor que los ejecuta.

/**
 * `strength = f(tensile, cohesion)` del atador. Tirar de una atadura pone a
 * trabajar la fibra a tracción y el agarre entre las caras: pesan 70/30 porque
 * una liana con `cohesion` cero igual ata, y una resina con `tensile` cero no.
 */
/**
 * ¿Este cuerpo, ahora, puede llenar este rol?
 *
 * Es la otra mitad de `admit()`: la puerta juzga si un proceso PUEDE existir,
 * esto juzga si el mundo tiene con qué correrlo. Y no pregunta por sustancia ni
 * por forma: pregunta por cualidades, incluidas las derivadas de la geometría.
 * Por eso una caña califica para `extraccion` sin que nadie escriba «caña», y
 * por eso califica también cualquier otra cosa larga con una hebra colgando.
 */
export function cumpleRol(b: Body, r: Role, phys: Physics): boolean {
  for (const t of r.where) if (!cumpleTest(qualityOf(b, t.q, phys), t)) return false
  return true
}

function cumpleTest(v: number, t: QualityTest): boolean {
  switch (t.op) {
    case '>=':
      return v >= t.v
    case '<=':
      return v <= t.v
    case '>':
      return v > t.v
    case '<':
      return v < t.v
  }
}

const UNION_PESO_TENSILE = 0.7
const UNION_PESO_COHESION = 0.3

export function fuerzaDeAtadura(tensile: number, cohesion: number): number {
  const f = tensile * UNION_PESO_TENSILE + cohesion * UNION_PESO_COHESION
  return f < 0 ? 0 : f > 1 ? 1 : f
}

/**
 * Atar. Con `b` el atador se GASTA en la atadura y quedan dos cuerpos unidos y
 * firmes; sin `b` el atador SOBREVIVE como parte, atado de un solo lado, y le
 * queda una punta suelta.
 *
 * Esa punta suelta es `freeStrandEnds`, `freeStrandEnds` es lo único que da
 * `catch`, y sin `catch` no se califica para `extraccion`. O sea: el rol
 * opcional de `union` no es una comodidad de firma, es la caña entera.
 *
 * Devuelve `undefined` si el ensamble no entra en las cotas duras de `body.ts`.
 * Un cuerpo fuera de cotas no se construye a medias: se rechaza y se dice.
 */
export function unir(
  a0: Body,
  b0: Body | undefined,
  binder0: Body,
  phys: Physics,
  id: string,
): Body | undefined {
  // Misma razón que en `paso`: el ensamble se arma con las PARTES, así que una
  // masa escrita a nivel cuerpo que discrepe de ellas se convertiría en materia
  // nueva —o desaparecida— en el momento exacto de atar.
  const a = normalizarMasa(a0)
  const b = b0 === undefined ? undefined : normalizarMasa(b0)
  const binder = normalizarMasa(binder0)

  const binderParte = binder.parts[0]
  if (binderParte === undefined) return undefined
  const via: SubstanceId = binderParte.substance
  const strength = fuerzaDeAtadura(
    qualityOf(binder, 'tensile', phys),
    qualityOf(binder, 'cohesion', phys),
  )

  const parts: Part[] = [...a.parts]
  const joints: Joint[] = [...a.joints]
  const otro = b ?? binder
  const base = parts.length
  for (const p of otro.parts) parts.push(p)
  for (const j of otro.joints) joints.push({ ...j, a: j.a + base, b: j.b + base })
  joints.push({ a: 0, b: base, via, strength })

  if (parts.length > MAX_PARTS || joints.length > MAX_JOINTS) return undefined
  // El estado del ensamble sale del cuerpo `a`, que es el que se sigue siendo;
  // `mass` ya no puede estar en ninguno de los dos, y ésa es la garantía de que
  // el ensamble pesa lo que pesaban sus partes y ni un gramo más.
  const ensamble: Body = {
    id,
    form: a.form,
    parts,
    joints,
    state: { ...otro.state, ...a.state },
  }
  return violationsOf(ensamble).length === 0 ? ensamble : undefined
}

// ─── Lo que este archivo NO tiene, y es el punto ─────────────────────────────
//
// No hay `encender()`, no hay `cocinar()`, no hay una función por producto. No
// hay ni un `switch` sobre un id de sustancia, ni un `if (s.id === ...)`. Lo
// único que las leyes preguntan es por tags y por cualidades, y por eso una
// sustancia que nadie escribió se comporta bien.
//
// Que eso sea cierto no es una promesa de este comentario: hay un test que lee
// este archivo y falla si aparece adentro el id de alguna sustancia semilla.
