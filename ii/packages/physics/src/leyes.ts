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

import type { Dt } from './fixed.js'
import { HZ_DE_REFERENCIA, porPaso } from './fixed.js'
import type { Body, Joint, Part } from './body.js'
import { esDerivadaEn, MAX_JOINTS, MAX_PARTS, qualityOf, violationsOf } from './body.js'
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

/**
 * Acoplamiento DESNUDO del cuerpo con el ambiente, en las MISMAS unidades de
 * potencia en las que está calibrada `emitsPower`. La ley 1 en régimen lo usa
 * como divisor: `T_eq = ambiente + potencia · formFactor / h`, y ahí lo único
 * que importa es el COCIENTE `potencia / h`, que no tiene unidades de tiempo.
 * Por eso este número no se toca: `T_eq` es una temperatura, no una tasa.
 */
export const H_PERDIDA = 0.5

/**
 * El MISMO acoplamiento, por SEGUNDO de mundo. Es lo que la ley 1 INTEGRA: cuánto
 * del hueco al equilibrio se cierra por unidad de tiempo y de `heatCapacity`.
 *
 * ─── LA DEUDA DECLARADA DEL ADR II-0008, y es una sola ──────────────────────
 *
 * Esta multiplicación es el ÚNICO lugar de `@anima/physics` donde queda escrita
 * la frecuencia de referencia, y está acá porque `emitsPower` —la otra mitad del
 * cociente— sigue calibrada en potencia por tick: el Hito 0 midió la fogata del
 * documento en 300 contra una ventana de cocción que se resolvió tick a tick.
 * Moverla a vatios obliga a multiplicar `EMISSION_PER_FUEL` y el rango de
 * `emitsPower`, o sea a rehacer el barrido térmico de las doce sustancias.
 *
 * Se deriva y no se escribe dos veces a propósito: dos constantes para el mismo
 * acoplamiento divergen el día que alguien recalibre una, y la ley 1 pasaría a
 * relajar hacia un equilibrio distinto del que ella misma calcula.
 */
export const H_PERDIDA_POR_SEGUNDO = H_PERDIDA * HZ_DE_REFERENCIA

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

/**
 * UN EMPUJE SOSTENIDO sobre este cuerpo, en este paso (ADR II-0010).
 *
 * Es un `drive` de un proceso que ALGUIEN está corriendo ahora mismo: `q` es la
 * cualidad que empuja y `rumbo` para dónde. No dice cuánto —eso ya lo aplicó
 * quien corre el proceso, antes de llamar acá— y no dice quién: a las leyes no
 * les importa de qué mano viene.
 *
 * ─── Para qué existe ────────────────────────────────────────────────────────
 *
 * `friccion` empuja `temperature` a 120 °C por segundo y la ley 1 la relaja
 * proporcional al hueco al ambiente, así que las dos juntas se estancan en un
 * punto fijo: 49,8 °C para una madera de 2 kg, contra 300 de ignición. El
 * comentario de `FRICCION` prometía «tres segundos de 15 a 375 °C» y la cuenta
 * era exacta —15 + 120×3 = 375— pero suponía que nada lo relajaba. Dos piezas
 * escritas por separado que nadie compuso. Ver el ADR II-0010.
 */
export interface Empuje {
  readonly q: QualityId
  readonly rumbo: 1 | -1
}

export interface Entorno {
  celda: Celda
  fuente?: Fuente
  /**
   * Los empujes que un proceso sostiene sobre ESTE cuerpo en ESTE paso. Ausente
   * es lo normal: sólo lo trae el cuerpo que alguien está frotando (o mojando, o
   * lo que el modelo escriba mañana).
   *
   * Va en el entorno y no en el cuerpo a propósito. Una mano que frota es algo
   * que le pasa al cuerpo DESDE AFUERA y dura un paso, igual que la celda y la
   * fuente; guardarlo en `Body.state` lo metería en el hash del mundo y en el
   * snapshot, y habría que acordarse de borrarlo — que es la mitad de los modos
   * de falla de una caché.
   */
  empujes?: readonly Empuje[]
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

/** Ley 5, tasa de cocción POR SEGUNDO: `r = 0.2·k/(0.2 + toughness)`. */
const COCCION_BASE = 0.2
/** Adimensional: es un piso de dureza, no una tasa. No lo toca el `dt`. */
const COCCION_DUREZA_PISO = 0.2

/** Ley 5, lo que baja la toxicidad y la putrefacción por unidad de `k` y por segundo. */
const COCCION_DESTOXIFICA = 0.6
const COCCION_DESPUDRE = 0.16

/**
 * Ley 5, evaporación: `0.012 · k²` POR SEGUNDO. **EL EXPONENTE 2 ES UN HALLAZGO,
 * NO UN TIPEO** (`ii/docs/hito-0-barrido-termico.md`, hallazgo 2). Con
 * `evap ∝ k`, el agua perdida por unidad de cocción no depende de la
 * temperatura, más caliente es siempre mejor, y cocinar deja de ser una técnica
 * para ser una receta. Con `k²` aparece la tensión «comer antes o comer mejor»,
 * que es lo que hay que aprender. Tocar esto obliga a volver a correr
 * `pnpm ii:barrido`.
 *
 * EL LITERAL DICE `0.011999999999999999` Y NO `0.012`, y el ulp de diferencia es
 * a propósito: es el double que dividido por la frecuencia devuelve EXACTAMENTE
 * la tasa por paso con la que el barrido calibró la ventana de cocción de las
 * doce sustancias. Con `0.012` la tasa a 20 Hz sale `0.0006000000000000001` en
 * vez de `0.0006`, y la huella de conducta de `paso()` —que mezcla los bits de
 * cada double que las leyes escriben— se mueve: una migración que no cambió
 * ninguna conducta quedaría indistinguible de una que sí. De las diez tasas de
 * este archivo es la única que lo necesita; el día que se rehaga el barrido, se
 * escribe redonda.
 */
const EVAPORACION_BASE = 0.011999999999999999
/** Adimensional: es la forma de la curva, no una tasa. No lo toca el `dt`. */
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

/** Ley 3: cuánto carboniza por SEGUNDO lo que superó su punto de pirólisis. */
const TASA_CARBONIZACION = 0.2

/** Ley 3: cuánto combustible por unidad de masa se lleva la llama por SEGUNDO. */
const TASA_COMBUSTION = 1

/** Ley 4: dónde deja de haber materia orgánica y empieza el residuo. */
export const CARBONIZADO_QUE_TRANSMUTA = 0.8

/** Ley 6: cuánto se pudre por SEGUNDO, con humedad 1 y a temperatura de trabajo. */
const TASA_DESCOMPOSICION = 0.008

/** Ley 11: cuánto seca un grado por encima del ambiente, por SEGUNDO. */
const SECADO_POR_GRADO = 0.0004

/** Ley 11: cuánto se acerca la humedad del cuerpo a la de la celda por SEGUNDO. */
const TASA_MOJADO = 0.2

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
 *
 * ─── PEREZOSA, y por qué ────────────────────────────────────────────────────
 *
 * Esto era un objeto con trece campos calculados de golpe. Cada ley usa dos o
 * tres, y `paso()` armaba la lectura cinco veces por cuerpo: sesenta y cinco
 * `qualityOf` por cuerpo y por tick para usar, con suerte, veinte. Medido, ERA
 * EL TICK ENTERO — 39,66 ms para 5000 cuerpos contra un techo de 4.
 *
 * Ahora cada campo se calcula la primera vez que alguien lo pide y se recuerda.
 * La conducta es idéntica porque `qualityOf` es pura y porque **una `Lectura`
 * está atada a UN cuerpo**: los cuerpos no se mutan nunca —toda ley devuelve uno
 * nuevo—, así que un valor memoizado no puede quedar viejo mientras su lectura
 * viva. Quien cambia el cuerpo pide una lectura nueva, y eso lo hace `paso()`.
 *
 * No es una caché con invalidación: es un valor que se termina de construir
 * solo. La diferencia importa — una caché hay que acordarse de invalidarla, y
 * ésta se muere con el cuerpo que la explica.
 */
interface Lectura {
  readonly temperature: number
  readonly moisture: number
  readonly charred: number
  readonly digestibility: number
  readonly toxicity: number
  readonly decay: number
  readonly nutrition: number
  readonly fuelEnergy: number
  readonly ignitionPoint: number
  readonly pyrolysisAt: number
  readonly denaturesAt: number | undefined
  readonly toughness: number
  readonly mass: number
}

/**
 * La lectura perezosa. Campos planos y no `#privados` a propósito: esto es el
 * camino más caliente del motor y los campos privados de verdad se pagan en cada
 * acceso.
 *
 * `undefined` es el «todavía no» de los doce campos numéricos, y no puede
 * confundirse con un valor porque `qualityOf` devuelve siempre un número.
 * `denaturesAt` SÍ puede valer `undefined` legítimamente —es lo que distingue lo
 * que no se cocina de lo que se cocina a 0 °C—, así que lleva su propia bandera
 * de «ya se preguntó» y esa diferencia no se pierde.
 */
class LecturaPerezosa implements Lectura {
  private readonly b: Body
  private readonly phys: Physics
  private _temperature: number | undefined
  private _moisture: number | undefined
  private _charred: number | undefined
  private _digestibility: number | undefined
  private _toxicity: number | undefined
  private _decay: number | undefined
  private _nutrition: number | undefined
  private _fuelEnergy: number | undefined
  private _ignitionPoint: number | undefined
  private _pyrolysisAt: number | undefined
  private _toughness: number | undefined
  private _mass: number | undefined
  private _denaturesAt: number | undefined
  private _denaturesAtLeido = false

  constructor(b: Body, phys: Physics) {
    this.b = b
    this.phys = phys
  }

  get temperature(): number {
    const v = this._temperature
    return v !== undefined ? v : (this._temperature = qualityOf(this.b, 'temperature', this.phys))
  }
  get moisture(): number {
    const v = this._moisture
    return v !== undefined ? v : (this._moisture = qualityOf(this.b, 'moisture', this.phys))
  }
  get charred(): number {
    const v = this._charred
    return v !== undefined ? v : (this._charred = qualityOf(this.b, 'charred', this.phys))
  }
  get digestibility(): number {
    const v = this._digestibility
    return v !== undefined
      ? v
      : (this._digestibility = qualityOf(this.b, 'digestibility', this.phys))
  }
  get toxicity(): number {
    const v = this._toxicity
    return v !== undefined ? v : (this._toxicity = qualityOf(this.b, 'toxicity', this.phys))
  }
  get decay(): number {
    const v = this._decay
    return v !== undefined ? v : (this._decay = qualityOf(this.b, 'decay', this.phys))
  }
  get nutrition(): number {
    const v = this._nutrition
    return v !== undefined ? v : (this._nutrition = qualityOf(this.b, 'nutrition', this.phys))
  }
  get fuelEnergy(): number {
    const v = this._fuelEnergy
    return v !== undefined ? v : (this._fuelEnergy = qualityOf(this.b, 'fuelEnergy', this.phys))
  }
  get ignitionPoint(): number {
    const v = this._ignitionPoint
    return v !== undefined
      ? v
      : (this._ignitionPoint = qualityOf(this.b, 'ignitionPoint', this.phys))
  }
  get pyrolysisAt(): number {
    const v = this._pyrolysisAt
    return v !== undefined ? v : (this._pyrolysisAt = qualityOf(this.b, 'pyrolysisAt', this.phys))
  }
  get toughness(): number {
    const v = this._toughness
    return v !== undefined ? v : (this._toughness = qualityOf(this.b, 'toughness', this.phys))
  }
  get mass(): number {
    const v = this._mass
    return v !== undefined ? v : (this._mass = qualityOf(this.b, 'mass', this.phys))
  }
  get denaturesAt(): number | undefined {
    if (!this._denaturesAtLeido) {
      this._denaturesAt = puntoDeCoccion(this.b, this.phys)
      this._denaturesAtLeido = true
    }
    return this._denaturesAt
  }
}

function leer(b: Body, phys: Physics): Lectura {
  return new LecturaPerezosa(b, phys)
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

/**
 * Los tags de la materia de este cuerpo, unidos. Una sola parte orgánica lo hace
 * orgánico.
 *
 * ─── Por qué se puede recordar por el array de partes ───────────────────────
 *
 * Esto no mira el estado: mira de qué está hecho el cuerpo, y eso son las partes
 * y nada más. Y las partes NO SE MUTAN NUNCA — toda operación que las toca
 * (`escalarMasa`, la ley 4, `unir`) construye partes nuevas y un array nuevo,
 * mientras que las leyes que solo escriben estado conservan el mismo array. Así
 * que el array de partes identifica exactamente lo que esta función calcula: dos
 * cuerpos que lo comparten tienen los mismos tags, y un cuerpo cuyas partes
 * cambiaron trae un array nuevo y una entrada nueva.
 *
 * No es una caché con invalidación —no hay nada que acordarse de invalidar—: es
 * un valor guardado junto a la única cosa de la que depende. Si algún día alguien
 * mutara un `Part` en su lugar, esto quedaría viejo; pero eso rompería antes el
 * determinismo del replay, que es el motivo por el que los cuerpos son inmutables.
 */
const TAGS_POR_PARTES = new WeakMap<readonly Part[], { phys: Physics; tags: readonly Tag[] }>()

export function tagsDe(b: Body, phys: Physics): readonly Tag[] {
  const visto = TAGS_POR_PARTES.get(b.parts)
  if (visto !== undefined && visto.phys === phys) return visto.tags
  const out: Tag[] = []
  for (const p of b.parts) {
    const s = phys.substances.get(p.substance)
    if (s === undefined) continue
    for (const t of s.tags) if (!out.includes(t)) out.push(t)
  }
  TAGS_POR_PARTES.set(b.parts, { phys, tags: out })
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
 * ¿Las cuatro cuentas conservadas se GUARDAN en esta física?
 *
 * Es la primera mitad de lo que habilita leer una vez en vez de dos, y no depende
 * de los cuerpos sino solo del catálogo: se pregunta una vez por `Physics` en vez
 * de cuatro veces por cuerpo. En el catálogo cerrado la respuesta es siempre sí
 * —ninguna conservada es derivada—, pero un test puede armar una `Physics` con
 * otro catálogo, y una DERIVADA no sirve para este razonamiento: puede mirar las
 * juntas, la forma o cualquier otra cualidad, así que compartir partes y estado
 * no alcanzaría para decidir nada.
 */
const CONSERVADAS_SE_GUARDAN = new WeakMap<Physics, boolean>()

function conservadasSeGuardan(phys: Physics): boolean {
  const visto = CONSERVADAS_SE_GUARDAN.get(phys)
  if (visto !== undefined) return visto
  let todas = true
  for (const q of CONSERVED) if (esDerivadaEn(phys, q)) todas = false
  CONSERVADAS_SE_GUARDAN.set(phys, todas)
  return todas
}

/**
 * Después de un tick, ninguna cuenta conservada vale más que antes. Punto.
 *
 * Baja el intensivo hasta que el producto entre; el bucle está acotado porque
 * cada vuelta baja un ulp relativo y con una o dos alcanza para cualquier
 * redondeo de IEEE-754. Si en cinco vueltas no entró, se pone en cero:
 * preferimos perder materia a inventarla, y eso es una decisión, no un descuido.
 *
 * ─── Ocho lecturas de cualidad, y antes eran doce ───────────────────────────
 *
 * Una cualidad GUARDADA mira exactamente dos cosas: lo que el cuerpo escribió en
 * `state[q]` y, si no escribió nada, sus partes. Los dos cuerpos que se comparan
 * acá comparten el array de partes siempre que ninguna ley las haya reconstruido
 * —el caso corriente, porque `conEstado` y `conCualidad` conservan `parts`—, así
 * que para las cuentas que ninguna ley tocó las dos lecturas son el mismo número
 * bit a bit y alcanza con hacer una.
 *
 * OJO CON LO QUE ESTO NO HACE: no saltea ninguna comparación ni ninguna
 * corrección. Si la lectura diera `NaN` —una parte con `NaN` escrito—, el candado
 * sigue entrando por donde entraba, porque `NaN <= NaN` sigue siendo falso. La
 * versión que se saltea el bucle entero cuando «nada cambió» NO es equivalente
 * por exactamente ese caso, y por eso no está escrita acá.
 */
function conservar(antes: Body, despues: Body, phys: Physics): Body {
  let out = despues
  // Las partes se comparan UNA vez: no cambian mientras el bucle no reescriba
  // `out`, y las cuatro vueltas preguntaban lo mismo cuatro veces. Cuando el
  // bucle SÍ reescribe `out` se vuelve a mirar, porque bajar la masa reconstruye
  // las partes.
  const guardadas = conservadasSeGuardan(phys)
  let mismaMateria = guardadas && antes.parts === out.parts

  // La masa se lee UNA vez por lado y no tres. `totalConservado` la vuelve a
  // pedir para cada cuenta intensiva —son dos, `nutrition` y `fuelEnergy`— y son
  // siempre las mismas partes: seis lecturas de masa por cuerpo y por tick para
  // obtener dos números. Era el renglón más caro que quedaba en el tick.
  const masaAntes = qualityOf(antes, 'mass', phys)
  let masaOut =
    mismaMateria && antes.state.mass === out.state.mass
      ? masaAntes
      : qualityOf(out, 'mass', phys)

  for (const q of CONSERVED) {
    const extensiva = specOf(q).extent === 'extensive'
    const vAntes = q === 'mass' ? masaAntes : qualityOf(antes, q, phys)
    const vOut =
      q === 'mass'
        ? masaOut
        : mismaMateria && antes.state[q] === out.state[q]
          ? vAntes
          : qualityOf(out, q, phys)
    const techo = extensiva ? vAntes : vAntes * masaAntes
    if ((extensiva ? vOut : vOut * masaOut) <= techo) continue

    if (extensiva) {
      if (q === 'mass') {
        if (vOut > 0) out = bajarMasaHasta(out, techo, vOut, phys)
      } else {
        out = conCualidad(out, q, clampToRange(q, techo))
      }
      mismaMateria = guardadas && antes.parts === out.parts
      masaOut = qualityOf(out, 'mass', phys)
      continue
    }
    if (masaOut <= 0) {
      out = conCualidad(out, q, 0)
      mismaMateria = guardadas && antes.parts === out.parts
      masaOut = qualityOf(out, 'mass', phys)
      continue
    }
    let v = techo / masaOut
    for (let i = 0; i < 5 && v * masaOut > techo; i++) v = v * (1 - Number.EPSILON)
    if (v * masaOut > techo) v = 0
    out = conCualidad(out, q, clampToRange(q, v))
    mismaMateria = guardadas && antes.parts === out.parts
    masaOut = qualityOf(out, 'mass', phys)
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
  // Primero MIRAR, y recién construir si hace falta.
  //
  // Lo corriente es que nada esté fuera de rango —las leyes ya recortan lo que
  // escriben—, y la versión de un solo paso armaba igual un `state` nuevo para
  // tirarlo enseguida: una asignación por cuerpo y por tick que casi nunca se
  // usaba. El recorrido de comprobación es el mismo y decide lo mismo; lo único
  // que cambia es cuándo se paga el objeto.
  const claves = Object.keys(b.state)
  let cambio = false
  for (let i = 0; i < claves.length; i++) {
    const k = claves[i] as string
    if (!EN_EL_CATALOGO.has(k)) continue
    const q = k as QualityId
    const v = b.state[q]
    if (v === undefined) continue
    if ((Number.isFinite(v) ? clampToRange(q, v) : 0) !== v) {
      cambio = true
      break
    }
  }
  if (!cambio) return b

  const state: QualityVector = {}
  for (let i = 0; i < claves.length; i++) {
    const k = claves[i] as string
    const q = k as QualityId
    const v = b.state[q]
    if (v === undefined) continue
    if (!EN_EL_CATALOGO.has(k)) {
      state[q] = v
      continue
    }
    state[q] = Number.isFinite(v) ? clampToRange(q, v) : 0
  }
  return { ...b, state }
}

// ─── La regla de los empujes: una ley no relaja contra una mano ──────────────
//
// ADR II-0010, y es una REGLA y no un caso de la ley 1: mientras un `drive` está
// activo sobre una cualidad de un cuerpo, ninguna ley que RELAJE esa cualidad la
// mueve en contra del empuje. Vale igual para `temperature` (ley 1) y para
// `moisture` (ley 11), y va a valer para la que el modelo escriba mañana.
//
// ─── Qué NO suspende, y es la mitad de la decisión ──────────────────────────
//
// Suspende la RELAJACIÓN —el tirón del mundo hacia donde las cosas quedan cuando
// nadie hace nada, que es justamente lo que deja de ser cierto mientras alguien
// frota— y nada más. Las leyes que TRANSFORMAN la materia siguen enteras: la 3
// piroliza y quema, la 4 transmuta, la 5 cocina, la 6 pudre. Por eso la vara que
// se frota SÍ prende cuando pasa su punto de ignición, que es todo el punto.
//
// Y es EN CONTRA y no «a secas»: si el entorno empuja para el MISMO lado que la
// mano —un cuerpo que alguien frota adentro del fuego—, la ley 1 sigue
// calentándolo. Suspender la ley entera haría que frotar algo en la fogata lo
// dejara frío, que es absurdo, y el signo es lo único que hace falta para
// distinguir los dos casos.

/**
 * ¿Hay un empuje sostenido sobre `q` que va al revés que este `delta`?
 *
 * Es un PREDICADO y no una función que devuelve el `delta` recortado, y la
 * diferencia costó una huella de conducta. La versión que devolvía el número
 * obligaba a escribir la ley 11 como `moisture + f(haciaLaCelda − secado)`, y eso
 * NO es la misma cuenta que `moisture + haciaLaCelda − secado`: en IEEE-754 la
 * asociatividad no vale, y la huella de `paso()` —que mezcla los bits de cada
 * double que las leyes escriben— se movió 3705094564 → 139010573 sin que ninguna
 * conducta hubiera cambiado. Con un predicado, la rama que no suspende conserva
 * la expresión LETRA POR LETRA.
 *
 * El camino sin empujes —todos los cuerpos del mundo salvo el que alguien está
 * frotando— sale en la primera línea, así que `paso()` sobre un `Entorno` sin
 * `empujes` es bit a bit el de antes de este ADR: por eso ni la huella de
 * conducta de `@anima/physics` ni el barrido térmico se mueven.
 */
function pelea(e: Entorno, q: QualityId, delta: number): boolean {
  const empujes = e.empujes
  if (empujes === undefined) return false
  for (const x of empujes) {
    if (x.q !== q) continue
    if (x.rumbo > 0 ? delta < 0 : delta > 0) return true
  }
  return false
}

// ─── Ley 1 ───────────────────────────────────────────────────────────────────

/**
 * `heatCapacity = Σ partes (masa · calor específico)`. Por eso una piedra grande
 * se enfría lento y una hoja se enfría en dos ticks, sin que nadie escriba
 * «piedra» ni «hoja».
 *
 * ─── Por qué esto NO llama a `qualityOf(b, 'heatCapacity', phys)` ───────────
 *
 * Desde el ADR II-0006 la fórmula está declarada en el catálogo —`mass ×
 * substance('specificHeat')`— y ésa es la única DECLARACIÓN. Esto de acá es el
 * camino caliente de la ley 1, que corre una vez por cuerpo y por tick, y la
 * delegación se probó y se midió: **1.55 ms contra 0.41 ms para 5000 cuerpos,
 * 3.8×**. El criterio del Hito 2 es 4 ms por tick para 5000 cuerpos: delegar
 * gastaba el 39% del presupuesto entero en UNA de las doce leyes.
 *
 * Dos implementaciones de una fórmula divergen, y por eso hay un test que las
 * clava juntas (`leyes.test.ts`, «la declaración del catálogo y el camino
 * caliente dicen lo mismo»). Coinciden a 1 ulp relativo —medido sobre 200 000
 * cuerpos al azar: peor desvío 2.2e-16— y la diferencia es de redondeo, no de
 * fórmula: la derivada calcula `M · (Σ mᵢshᵢ / M)` y esto calcula `Σ mᵢshᵢ`
 * directo.
 */
export function capacidadTermica(b: Body, phys: Physics): number {
  let total = 0
  for (const p of b.parts) {
    const s = phys.substances.get(p.substance)
    total += (p.q.mass ?? p.mass) * (s?.specificHeat ?? 1)
  }
  return total
}

function leyTermica(b: Body, e: Entorno, phys: Physics, l: Lectura, dt: Dt): Body {
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
  // puede superar 1, o el cuerpo pasaría de largo el equilibrio y oscilaría —
  // que es exactamente lo que pasa si `dt` se agranda demasiado, y por eso el
  // `min` es también el techo de estabilidad de la integración.
  const acople = cap > 0 ? Math.min(1, porPaso(H_PERDIDA_POR_SEGUNDO, dt) / cap) : 1
  // El `pelea` es el ADR II-0010: si alguien está frotando este cuerpo, la
  // relajación no le come el empuje. Sigue calentándolo si el objetivo está
  // ARRIBA —un cuerpo frotado adentro del fuego se calienta igual—; lo único que
  // se suspende es el tirón hacia abajo.
  const relaja = (objetivo - l.temperature) * acople
  const t = pelea(e, 'temperature', relaja) ? l.temperature : l.temperature + relaja
  // `conCualidad` y no `conEstado`: esto corre para TODO cuerpo en TODO tick, y
  // `conEstado` obliga a armar un objeto de cambios de una sola entrada para
  // desarmarlo enseguida. El estado resultante es el mismo, clave por clave.
  return conCualidad(b, 'temperature', clampToRange('temperature', t))
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
function leyDesnaturalizacion(b: Body, l: Lectura, dt: Dt): Body {
  const k = (l.temperature - (l.denaturesAt ?? 0)) / 100
  if (k <= 0) return b
  // Las cuatro tasas se llevan al paso ANTES de entrar en la cuenta, y no
  // después: `(a·k/b)·dt` y `(a·dt)·k/b` son la misma cuenta en el álgebra y no
  // en IEEE-754. Convertir la constante es lo que deja la aritmética idéntica a
  // la que calibró el barrido térmico.
  const coccion = porPaso(COCCION_BASE, dt)
  const destoxifica = porPaso(COCCION_DESTOXIFICA, dt)
  const despudre = porPaso(COCCION_DESPUDRE, dt)
  const evaporacion = porPaso(EVAPORACION_BASE, dt)
  const r = (coccion * k) / (COCCION_DUREZA_PISO + l.toughness)
  const evap = Math.min(l.moisture, evaporacion * potenciaEntera(k, EVAPORACION_EXPONENTE))

  const out = conEstado(b, {
    digestibility: clampToRange(
      'digestibility',
      l.digestibility + r * (DIGESTIBILIDAD_TECHO - l.digestibility),
    ),
    toxicity: clampToRange('toxicity', l.toxicity * (1 - Math.min(1, destoxifica * k))),
    decay: clampToRange('decay', l.decay * (1 - Math.min(1, despudre * k))),
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
function leyHumedad(b: Body, e: Entorno, l: Lectura, dt: Dt): Body {
  const haciaLaCelda = (e.celda.wet - l.moisture) * porPaso(TASA_MOJADO, dt)
  const secado = Math.max(0, l.temperature - e.celda.ambiente) * porPaso(SECADO_POR_GRADO, dt)
  // Los dos términos se juzgan JUNTOS (ADR II-0010) y no por separado: los dos
  // son la misma relajación —hacia la humedad de la celda y hacia lo que el calor
  // deja—, y lo que la regla mira es para dónde se mueve la cualidad al final del
  // paso, no cuántos sumandos la movieron.
  //
  // La rama que NO suspende es la expresión original letra por letra. Ver `pelea`:
  // `x + f(a − b)` no es `x + a − b` en IEEE-754, y esa diferencia sola movió la
  // huella de conducta.
  const m = pelea(e, 'moisture', haciaLaCelda - secado)
    ? l.moisture
    : l.moisture + haciaLaCelda - secado
  // Misma razón que en la ley 1: una sola cualidad, y esto corre por cuerpo y
  // por tick.
  return conCualidad(b, 'moisture', clampToRange('moisture', m))
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
function leyCombustion(b: Body, e: Entorno, l: Lectura, dt: Dt): Body {
  const seca = l.moisture < HUMEDAD_QUE_APAGA
  const piroliza = seca && l.temperature >= l.pyrolysisAt
  const arde = seca && l.temperature >= l.ignitionPoint && e.celda.oxygen > OXIGENO_MINIMO
  if (!piroliza && !arde) return b

  const charred = piroliza ? Math.min(1, l.charred + porPaso(TASA_CARBONIZACION, dt)) : l.charred
  const cambios: QualityVector = { charred: clampToRange('charred', charred) }

  if (arde) {
    cambios.fuelEnergy = clampToRange(
      'fuelEnergy',
      Math.max(0, l.fuelEnergy - porPaso(TASA_COMBUSTION, dt) * e.celda.oxygen),
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
function leyDescomposicion(b: Body, l: Lectura, dt: Dt): Body {
  if (l.nutrition <= 0) return b
  if (l.charred > 0) return b
  if (l.denaturesAt !== undefined && l.temperature >= l.denaturesAt) return b
  const r =
    porPaso(TASA_DESCOMPOSICION, dt) *
    l.moisture *
    (1 + Math.max(0, l.temperature - T_AMBIENTE) / 100)
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
 * UN PASO de mundo sobre un cuerpo. Puro: mismo cuerpo, mismo entorno y mismo
 * `dt`, mismo resultado, en cualquier máquina y en cualquier orden.
 *
 * El orden de las leyes está fijo y es parte del contrato: primero se decide la
 * temperatura, después lo que la temperatura hace, y al final lo que queda. Un
 * orden que dependiera de un mapa o de un `Object.keys` haría divergir el
 * replay, que es la razón por la que este paquete existe.
 *
 * ─── `dt` es un parámetro y no una constante (ADR II-0008) ──────────────────
 *
 * Las diez tasas de este archivo son POR SEGUNDO de mundo, y `dt` dice cuánto
 * mundo pasa en este paso. Bajar la frecuencia no hace que las cosas tarden más:
 * hace que el mismo segundo se muestree en menos pasos, cada uno más grande.
 *
 * Lo que SÍ cambia con la frecuencia es la trayectoria, y tiene que cambiar: las
 * leyes no son lineales, así que dos muestreos distintos del mismo mundo dan dos
 * trazas distintas. Por eso `dt` es parte de la identidad de una partida y va en
 * el journal.
 */
export function paso(entrada: Body, e: Entorno, phys: Physics, dt: Dt): Paso {
  const leyes: LeyId[] = []
  // La masa se reconcilia ANTES de que corra ninguna ley: media docena de leyes
  // reconstruyen las partes, y si el cuerpo trae una masa escrita que no coincide
  // con las suyas, la primera que reconstruya se queda con el número viejo.
  const b0 = normalizarMasa(entrada)
  const tags = tagsDe(b0, phys)

  let b = leyTermica(b0, e, phys, leer(b0, phys), dt)
  leyes.push('termica')

  // Una lectura NUEVA solo cuando el cuerpo cambió.
  //
  // Antes se releía después de cada ley, sin preguntar. Pero varias leyes
  // devuelven el mismo cuerpo sin tocarlo —no todo arde, no todo se pudre, casi
  // nada transmuta—, y para un cuerpo que no cambió la lectura vieja dice
  // exactamente lo mismo que diría una nueva: `leer` es puro y los cuerpos son
  // inmutables. Releer ahí era recalcular trece cualidades para obtener los trece
  // números que ya estaban.
  let l = leer(b, phys)

  if (ventanaDeCoccion(l, tags)) {
    const cocido = leyDesnaturalizacion(b, l, dt)
    leyes.push('desnaturalizacion')
    if (cocido !== b) {
      b = cocido
      l = leer(b, phys)
    }
  } else {
    // Fuera de la ventana la humedad la mueve la ley 11; adentro, la 5. Nunca
    // las dos, o el agua se contaría dos veces.
    const secado = leyHumedad(b, e, l, dt)
    leyes.push('humedad')
    if (secado !== b) {
      b = secado
      l = leer(b, phys)
    }
  }

  const ardido = leyCombustion(b, e, l, dt)
  if (ardido !== b) {
    b = ardido
    leyes.push('combustion')
    l = leer(b, phys)
  }

  const podrido = leyDescomposicion(b, l, dt)
  if (podrido !== b) {
    b = podrido
    leyes.push('descomposicion')
    l = leer(b, phys)
  }

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

/**
 * `segundos` de mundo seguidos, muestreados de a `dt`. El entorno no cambia:
 * quien lo quiera mover, que llame a `paso`.
 *
 * La duración va en SEGUNDOS y no en pasos (ADR II-0008): «cuarenta pasos»
 * quiere decir dos segundos a 20 Hz y cuatro a 10 Hz, así que un test escrito en
 * pasos mediría cosas distintas según la frecuencia. Cuántas muestras entran en
 * esos segundos lo decide `dt`, y si no entra un número entero se redondea a la
 * más cercana — el resto es menos de medio paso.
 */
export function correr(
  b: Body,
  e: Entorno,
  phys: Physics,
  dt: Dt,
  segundos: number,
): Corrida {
  let body = b
  let actual = phys
  const nuevas: Substance[] = []
  const leyes: LeyId[] = []
  const pasos = Math.round(segundos / dt)
  for (let i = 0; i < pasos; i++) {
    const r = paso(body, e, actual, dt)
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
