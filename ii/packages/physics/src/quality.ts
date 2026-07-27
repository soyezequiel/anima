/**
 * EL CATÁLOGO DE CUALIDADES — el único vocabulario cerrado del sistema.
 *
 * Y es física, no objetos. Acá no hay `pescado`, no hay `caña`, no hay `carbón`:
 * hay temperatura, humedad, rigidez y filo. Una sustancia que el oráculo invente
 * mañana se comporta bien sin fila propia porque las leyes leen ESTAS 29
 * cualidades y ninguna otra.
 *
 * La cuenta, y no es arbitraria:
 *
 *   4 conservadas   su total no puede aumentar nunca, salvo aporte del dios.
 *                   Son las cuentas contra las que se paga todo trabajo.
 *   17 con ley      las mueve alguna de las doce leyes.
 *   8 derivadas     NO SE GUARDAN: se calculan al leerlas. Una cualidad derivada
 *                   no puede quedar vieja, y ésa es toda su razón de ser.
 *   ───
 *   29 de cuerpo, más 4 de celda (`CellQuality`, ADR II-0002) = 33.
 *
 * Por qué el catálogo está cerrado y la tabla de sustancias no: agregar una
 * sustancia es agregar un punto en un espacio que ya existe; agregar una cualidad
 * es agregar una dimensión, y toda ley escrita antes queda sin decir nada sobre
 * ella. Por eso las sustancias las inventa el oráculo y las cualidades no.
 *
 * ─── Sobre la aritmética de este archivo ────────────────────────────────────
 *
 * El evaluador de `QualityExpr` trabaja en doubles y no en `Fixed`. No es una
 * inconsistencia con `fixed.ts`: `+ − × ÷`, `Math.min` y `Math.max` SÍ están
 * especificados bit a bit en IEEE-754, y son lo único que el evaluador usa. Lo
 * que no está especificado —y por eso está prohibido— son las trascendentes.
 * Ninguna expresión derivada las necesita, y ninguna debería: si una afordancia
 * hiciera falta calcularla con un exponencial, sería una ley, no una vista.
 */

import { fx, type Fixed } from './fixed.js'

// ─── Los 29 nombres ─────────────────────────────────────────────────────────

/** Las 4 conservadas. Nada las sube salvo un aporte declarado del dios. */
export type ConservedQualityId = 'mass' | 'nutrition' | 'stamina' | 'fuelEnergy'

/** Las 17 que mueve alguna de las doce leyes. */
export type LawQualityId =
  | 'temperature'
  | 'ignitionPoint'
  | 'moisture'
  | 'oxygen'
  | 'charred'
  | 'rigidity'
  | 'toughness'
  | 'flexibility'
  | 'tensile'
  | 'sharpness'
  | 'cohesion'
  | 'digestibility'
  | 'toxicity'
  | 'decay'
  | 'denaturesAt'
  | 'pyrolysisAt'
  | 'permeability'

/** Las 8 que no se guardan. */
export type DerivedQualityId =
  'reach' | 'catch' | 'calories' | 'solid' | 'portable' | 'footing' | 'emitsPower' | 'heatCapacity'

export type QualityId = ConservedQualityId | LawQualityId | DerivedQualityId

/**
 * Las 4 de celda (ADR II-0002). `oxygen` y `temperature` se llaman igual que las
 * del cuerpo A PROPÓSITO: son la misma magnitud física leída en el otro lado del
 * intercambio, y la ley 1 y la ley 3 acoplan justamente esos dos pares. `wet` y
 * `sheltered` no existen como cualidades de cuerpo — un cuerpo tiene `moisture`,
 * y estar a reparo es una relación con la celda, no una propiedad que se pueda
 * guardar (si se guardara, habría que resincronizarla cada vez que algo se mueve).
 */
export type CellQuality = 'wet' | 'oxygen' | 'temperature' | 'sheltered'

// ─── La gramática de las derivadas ──────────────────────────────────────────

export type GeomFn = 'longestAxis' | 'freeStrandEnds' | 'jointCount'
export type ExprOp = '+' | '-' | '*' | '/' | 'min' | 'max' | 'step'

export type QualityExpr =
  | { k: 'const'; v: number }
  | { k: 'own'; q: QualityId }
  | { k: 'sumParts'; q: QualityId }
  | { k: 'maxParts'; q: QualityId }
  | { k: 'geom'; f: GeomFn }
  | { k: 'op'; f: ExprOp; a: QualityExpr; b: QualityExpr }

export interface QualitySpec {
  id: QualityId
  range: readonly [number, number]
  /**
   * `intensive` no se suma al juntar cuerpos (temperatura, filo); `extensive` sí
   * (masa, calorías). La distinción no es decorativa: decide qué hace `union`
   * con el vector de estado cuando dos cuerpos pasan a ser uno.
   */
  extent: 'intensive' | 'extensive'
  conserved: boolean
  relaxesTo?: { target: 'ambient' | number; perTick: number }
  /** Si está, la cualidad NO se guarda: se calcula cada vez que se lee. */
  derived?: QualityExpr
}

export type QualityVector = Partial<Record<QualityId, number>>

// ─── Constantes de calibración con nombre ───────────────────────────────────
//
// Cada número suelto adentro de una expresión derivada es un número que nadie va
// a poder discutir después. Los tres que hay viven acá arriba con su porqué.

/**
 * `catch` de una hebra pelada, sin punta. Es lo que atrapa una liana colgando:
 * poco, pero no cero — y que no sea cero es lo que hace que pescar con una caña
 * cruda sea posible y malo, en vez de imposible.
 */
const CATCH_BARE_STRAND = 0.15

/** Cuánto suma el filo de la punta al `catch`. Un anzuelo de espina vale más que la hebra. */
const CATCH_PER_SHARPNESS = 0.5

/**
 * Masa que la criatura levanta con las dos manos. Por encima hay que arrastrar,
 * desarmar, o inventar algo — que es exactamente el tipo de hambre bloqueada del
 * que salen las técnicas nuevas.
 */
const PORTABLE_MAX_MASS = 8

/**
 * Rigidez mínima para que algo cuente como sólido. El agua tiene `rigidity` 0;
 * cualquier cosa con algo de rigidez ya se apila y ya sostiene.
 */
const SOLID_MIN_RIGIDITY = 0.05

/** Cohesión mínima para pararse encima: un montón de grano no es piso. */
const FOOTING_MIN_COHESION = 0.3

/**
 * Potencia emitida por unidad de `fuelEnergy · mass` ardiendo.
 *
 * Es el único número libre de este archivo, y está clavado por la calibración
 * del Hito 0: la fogata del documento tiene `emitsPower = 300`, la madera tiene
 * `fuelEnergy = 18` por unidad de masa, y una fogata pesa del orden de una
 * unidad. 300 / 18 ≈ 16.7. Si esto se toca, se mueve la ventana de cocción de
 * las doce sustancias del barrido térmico y hay que volver a correrlo.
 */
const EMISSION_PER_FUEL = 16.7

// ─── El catálogo ────────────────────────────────────────────────────────────

export const QUALITIES: readonly QualitySpec[] = [
  // ── Las 4 conservadas ─────────────────────────────────────────────────────
  //
  // OJO con `extent` acá: `mass` y `stamina` son extensivas (se suman), pero
  // `nutrition` y `fuelEnergy` viven en `Substance.perUnitMass`, o sea que el
  // número es POR UNIDAD DE MASA y es intensivo. Lo que se conserva en esos dos
  // casos es el producto `q · mass`, no `q`. La regla 1 de `admit()` tiene que
  // comparar el producto; comparar el intensivo dejaría pasar una bomba de
  // materia que sube la nutrición al partir un cuerpo en dos.
  {
    id: 'mass',
    range: [0, 10000],
    extent: 'extensive',
    conserved: true,
  },
  {
    id: 'nutrition',
    range: [0, 100],
    extent: 'intensive',
    conserved: true,
  },
  {
    // No relaja. Si la stamina volviera sola, el hambre dejaría de doler en el
    // tick 300 y con ella se iría el motor de toda la historia.
    id: 'stamina',
    range: [0, 1000],
    extent: 'extensive',
    conserved: true,
  },
  {
    id: 'fuelEnergy',
    range: [0, 100],
    extent: 'intensive',
    conserved: true,
  },

  // ── Las 17 con ley ────────────────────────────────────────────────────────
  {
    // Ley 1. `perTick` es el acoplamiento DESNUDO con el ambiente: la ley lo
    // divide por `heatCapacity`, y por eso una piedra grande se enfría lento y
    // una hoja se enfría en dos ticks sin que nadie escriba ninguna de las dos.
    id: 'temperature',
    range: [-100, 2000],
    extent: 'intensive',
    conserved: false,
    relaxesTo: { target: 'ambient', perTick: 0.02 },
  },
  {
    // Constante de material, pero está «con ley» y no es un error: la ley 11 la
    // divide por la humedad. La leña mojada no prende, y no hace falta un caso
    // especial para decirlo.
    id: 'ignitionPoint',
    range: [0, 2000],
    extent: 'intensive',
    conserved: false,
  },
  {
    // Ley 11. Relaja MUY lento hacia el ambiente: el sol y el fuego secan rápido
    // (eso lo hace la ley 5 con `k²`), pero una cosa olvidada en la sombra tarda
    // horas. Si esto fuera rápido, mojar algo no tendría consecuencia.
    id: 'moisture',
    range: [0, 1],
    extent: 'intensive',
    conserved: false,
    relaxesTo: { target: 'ambient', perTick: 0.001 },
  },
  {
    // La fuente de verdad del oxígeno es la CELDA (ADR II-0002); en el cuerpo es
    // una lectura del entorno que relaja rápido hacia él. Por eso tapar la
    // fogata la ahoga: baja el oxígeno de la celda y el cuerpo lo sigue.
    id: 'oxygen',
    range: [0, 1],
    extent: 'intensive',
    conserved: false,
    relaxesTo: { target: 'ambient', perTick: 0.05 },
  },
  {
    // Ley 3 y ley 4. No relaja: quemarse no se deshace. Es la cualidad que hace
    // irreversible el olvido sobre las brasas.
    id: 'charred',
    range: [0, 1],
    extent: 'intensive',
    conserved: false,
  },
  { id: 'rigidity', range: [0, 1], extent: 'intensive', conserved: false },
  {
    // Gobierna el tiempo de cocción de la ley 5: `r = 0.010·k/(0.2 + toughness)`.
    // El barrido térmico lo dejó escrito: es lo que separa el hongo del cuero.
    id: 'toughness',
    range: [0, 1],
    extent: 'intensive',
    conserved: false,
  },
  { id: 'flexibility', range: [0, 1], extent: 'intensive', conserved: false },
  { id: 'tensile', range: [0, 1], extent: 'intensive', conserved: false },
  { id: 'sharpness', range: [0, 1], extent: 'intensive', conserved: false },
  { id: 'cohesion', range: [0, 1], extent: 'intensive', conserved: false },
  { id: 'digestibility', range: [0, 1], extent: 'intensive', conserved: false },
  { id: 'toxicity', range: [0, 1], extent: 'intensive', conserved: false },
  {
    // Ley 6. Solo sube. Lo único que la baja es cocinar (ley 5), y ésa es toda
    // la razón por la que guardar comida asada tiene sentido.
    id: 'decay',
    range: [0, 1],
    extent: 'intensive',
    conserved: false,
  },
  {
    // El umbral de la ley 5, en grados. Está «con ley» porque la ley 5 lo lee
    // para calcular `k = (T − denaturesAt)/100`, que es el corazón del barrido.
    id: 'denaturesAt',
    range: [0, 500],
    extent: 'intensive',
    conserved: false,
  },
  {
    // El techo de la ley 5 y el piso de la ley 3: entre `denaturesAt` y
    // `pyrolysisAt` está la ventana de cocción, y que esa ventana exista para
    // doce sustancias sin números por caso es lo que probó el Hito 0.
    id: 'pyrolysisAt',
    range: [0, 1000],
    extent: 'intensive',
    conserved: false,
  },
  {
    // Ley 12 (ADR II-0002). Una malla tapa distinto que una losa, y por eso
    // tejer vale la pena. Sin esto, `sheltered` sería un booleano por situación.
    id: 'permeability',
    range: [0, 1],
    extent: 'intensive',
    conserved: false,
  },

  // ── Las 8 derivadas ───────────────────────────────────────────────────────
  {
    // Nadie escribió «caña»: alcance es el eje más largo del ensamble. Un palo
    // con una liana lo tiene; una piedra en la mano, no.
    id: 'reach',
    range: [0, 16],
    extent: 'intensive',
    conserved: false,
    derived: { k: 'geom', f: 'longestAxis' },
  },
  {
    // freeStrandEnds · (0.15 + max(sharpness)·0.5). Tal cual el documento.
    // Cualquier cosa larga con una hebra colgando atrapa algo; si además la
    // punta tiene filo, atrapa más. Un anzuelo de espina no es un tipo nuevo.
    id: 'catch',
    range: [0, 8],
    extent: 'intensive',
    conserved: false,
    derived: {
      k: 'op',
      f: '*',
      a: { k: 'geom', f: 'freeStrandEnds' },
      b: {
        k: 'op',
        f: '+',
        a: { k: 'const', v: CATCH_BARE_STRAND },
        b: {
          k: 'op',
          f: '*',
          a: { k: 'maxParts', q: 'sharpness' },
          b: { k: 'const', v: CATCH_PER_SHARPNESS },
        },
      },
    },
  },
  {
    // `nutrition · mass · digestibility`. Comer SIEMPRE está permitido: lo que
    // varía es cuánto rinde. Por eso `edible` no existe como cualidad ni como
    // permiso — era la puerta cerrada que este modelo vino a abrir.
    id: 'calories',
    range: [0, 100000],
    extent: 'extensive',
    conserved: false,
    derived: {
      k: 'op',
      f: '*',
      a: { k: 'op', f: '*', a: { k: 'own', q: 'nutrition' }, b: { k: 'own', q: 'mass' } },
      b: { k: 'own', q: 'digestibility' },
    },
  },
  {
    id: 'solid',
    range: [0, 1],
    extent: 'intensive',
    conserved: false,
    derived: {
      k: 'op',
      f: 'step',
      a: { k: 'own', q: 'rigidity' },
      b: { k: 'const', v: SOLID_MIN_RIGIDITY },
    },
  },
  {
    // Los argumentos van al revés a propósito: `step` es el único comparador de
    // la gramática y responde `a ≥ b`, así que «la masa no pasa el tope» se
    // escribe «el tope alcanza a la masa». Preferible a agregar un nodo `<=` que
    // duplicaría la gramática por una sola expresión.
    id: 'portable',
    range: [0, 1],
    extent: 'intensive',
    conserved: false,
    derived: {
      k: 'op',
      f: 'step',
      a: { k: 'const', v: PORTABLE_MAX_MASS },
      b: { k: 'own', q: 'mass' },
    },
  },
  {
    // Pararse encima pide rigidez Y que las partes estén pegadas: un montón de
    // grano rígido tampoco es piso. Sale rigidez ponderada por si hay cohesión.
    id: 'footing',
    range: [0, 1],
    extent: 'intensive',
    conserved: false,
    derived: {
      k: 'op',
      f: '*',
      a: { k: 'own', q: 'rigidity' },
      b: {
        k: 'op',
        f: 'step',
        a: { k: 'own', q: 'cohesion' },
        b: { k: 'const', v: FOOTING_MIN_COHESION },
      },
    },
  },
  {
    // ADR II-0001 hecho aritmética: encender no es una acción, es una
    // consecuencia. El `step(temperature ≥ ignitionPoint)` es literalmente eso —
    // no hay verbo «encender» en ninguna parte, hay un cuerpo que pasó su punto.
    // La ley 3 después modula esto por el oxígeno de la celda y por la humedad;
    // acá vive solo la parte que es geometría del cuerpo.
    id: 'emitsPower',
    range: [0, 20000],
    extent: 'extensive',
    conserved: false,
    derived: {
      k: 'op',
      f: '*',
      a: {
        k: 'op',
        f: 'step',
        a: { k: 'own', q: 'temperature' },
        b: { k: 'own', q: 'ignitionPoint' },
      },
      b: {
        k: 'op',
        f: '*',
        a: { k: 'op', f: '*', a: { k: 'own', q: 'fuelEnergy' }, b: { k: 'own', q: 'mass' } },
        b: { k: 'const', v: EMISSION_PER_FUEL },
      },
    },
  },
  {
    // `heatCapacity = mass · specificHeat` y NO LLEVA `derived`. No es un olvido:
    // `specificHeat` es un campo de `Substance`, no un `QualityId`, y la gramática
    // de `QualityExpr` no tiene ningún nodo que llegue hasta ahí. Se podía forzar
    // de dos maneras feas —clavar un calor específico constante, o inventar un
    // `QualityId` que no está en el catálogo cerrado— y las dos mienten.
    //
    // Queda declarada como derivada por `DERIVED_FROM_SUBSTANCE` y se calcula con
    // `heatCapacityOf()`. Ver el reporte del Hito 1: o `QualityExpr` gana un nodo
    // `{ k: 'substance'; f: 'specificHeat' }`, o `specificHeat` entra al catálogo.
    id: 'heatCapacity',
    range: [0, 100000],
    extent: 'extensive',
    conserved: false,
  },
]

// ─── Índice y consultas ─────────────────────────────────────────────────────

const BY_ID: ReadonlyMap<QualityId, QualitySpec> = new Map(QUALITIES.map((s) => [s.id, s]))

export const QUALITY_IDS: readonly QualityId[] = QUALITIES.map((s) => s.id)

/**
 * Lanza si la cualidad no existe, y eso es a propósito: un `QualityId` que no
 * está en el catálogo es un error de programa, no un dato faltante, y devolver
 * `undefined` lo dejaría propagarse hasta un `NaN` en el tick 400.
 */
export function specOf(q: QualityId): QualitySpec {
  const s = BY_ID.get(q)
  if (s === undefined) throw new RangeError(`cualidad desconocida: ${String(q)}`)
  return s
}

/** Las 4 conservadas, en el orden del catálogo. */
export const CONSERVED: readonly QualityId[] = QUALITIES.filter((s) => s.conserved).map((s) => s.id)

/**
 * La única cualidad que se deriva de la sustancia y no del vector de estado.
 * Ver el comentario de `heatCapacity`.
 */
export const DERIVED_FROM_SUBSTANCE: ReadonlySet<QualityId> = new Set<QualityId>(['heatCapacity'])

/**
 * Verdadero si la cualidad NO SE GUARDA. `body.ts` tiene que preguntar esto y no
 * `spec.derived !== undefined`: si no, `heatCapacity` se guardaría y quedaría
 * vieja apenas el cuerpo pierda masa evaporando.
 */
export function isDerived(q: QualityId): boolean {
  return specOf(q).derived !== undefined || DERIVED_FROM_SUBSTANCE.has(q)
}

export function isConserved(q: QualityId): boolean {
  return specOf(q).conserved
}

/** Recorta al rango declarado. Ningún estado guardado debería salir de acá sin pasar por esto. */
export function clampToRange(q: QualityId, v: number): number {
  const [lo, hi] = specOf(q).range
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * `heatCapacity = Σ partes (masa · calor específico)`. Es una función y no una
 * `QualityExpr` porque el calor específico vive en la sustancia. La ley 1 divide
 * el acoplamiento por esto, y por eso una hoja se enfría antes que una piedra sin
 * que nadie escriba «hoja» ni «piedra».
 */
export function heatCapacityOf(parts: readonly { mass: number; specificHeat: number }[]): number {
  let total = 0
  for (const p of parts) total += p.mass * p.specificHeat
  return total
}

// ─── El evaluador ───────────────────────────────────────────────────────────

/**
 * Lo que una expresión derivada puede preguntarle al cuerpo. Es una interfaz y
 * no el `Body` entero para que `quality.ts` no dependa de `body.ts`: las
 * cualidades tienen que poder existir —y testearse— sin que haya cuerpos.
 */
export interface ExprContext {
  /** El valor de la cualidad en el cuerpo, ya agregado según su `extent`. */
  own(q: QualityId): number
  sumParts(q: QualityId): number
  maxParts(q: QualityId): number
  geom(f: GeomFn): number
}

/**
 * `step(a, b) = a ≥ b ? 1 : 0`. Es el ÚNICO comparador de la gramática, y con
 * eso alcanza: cualquier «menor que» se escribe dando vuelta los argumentos, y
 * cualquier condición compuesta se escribe multiplicando (Y) o con `max` (O).
 * Menos nodos es menos superficie que el modelo puede usar mal.
 */
function step(a: number, b: number): number {
  return a >= b ? 1 : 0
}

export function evalQuality(e: QualityExpr, ctx: ExprContext): number {
  switch (e.k) {
    case 'const':
      return e.v
    case 'own':
      return ctx.own(e.q)
    case 'sumParts':
      return ctx.sumParts(e.q)
    case 'maxParts':
      return ctx.maxParts(e.q)
    case 'geom':
      return ctx.geom(e.f)
    case 'op': {
      const a = evalQuality(e.a, ctx)
      const b = evalQuality(e.b, ctx)
      switch (e.f) {
        case '+':
          return a + b
        case '-':
          return a - b
        case '*':
          return a * b
        // Dividir por cero da 0 y no `Infinity`. Un `Infinity` suelto se
        // convierte en `NaN` en la primera resta y envenena el estado del mundo
        // muchos ticks después, lejos de donde estuvo la causa.
        case '/':
          return b === 0 ? 0 : a / b
        case 'min':
          return Math.min(a, b)
        case 'max':
          return Math.max(a, b)
        case 'step':
          return step(a, b)
      }
    }
  }
}

/**
 * Calcula una cualidad derivada, o `undefined` si esa cualidad se guarda.
 * `heatCapacity` devuelve `undefined` acá a propósito: no se puede calcular sin
 * la sustancia, y para eso está `heatCapacityOf`.
 */
export function derivedValue(q: QualityId, ctx: ExprContext): number | undefined {
  const e = specOf(q).derived
  return e === undefined ? undefined : clampToRange(q, evalQuality(e, ctx))
}

// ─── Las cualidades de celda (ADR II-0002) ──────────────────────────────────

export interface CellQualitySpec {
  id: CellQuality
  range: readonly [number, number]
  /** `sheltered` no se guarda: es la oclusión acumulada, y se calcula al leerla. */
  derived: boolean
  relaxesTo?: { target: 'ambient' | number; perTick: number }
}

export const CELL_QUALITIES: readonly CellQualitySpec[] = [
  {
    // Mojado de celda: lo que la ley 11 le pasa a la `moisture` de lo que esté
    // encima. Relaja rápido porque un charco al sol se seca.
    id: 'wet',
    range: [0, 1],
    derived: false,
    relaxesTo: { target: 'ambient', perTick: 0.01 },
  },
  {
    // Lo que la ley 3 consume y la ley 4 lee para decidir carbón o ceniza. Que
    // vuelva al ambiente es lo que impide que la criatura se selle adentro de su
    // refugio y se asfixie sin haber hecho nada raro.
    id: 'oxygen',
    range: [0, 1],
    derived: false,
    relaxesTo: { target: 'ambient', perTick: 0.05 },
  },
  {
    id: 'temperature',
    range: [-100, 2000],
    derived: false,
    relaxesTo: { target: 'ambient', perTick: 0.05 },
  },
  {
    // Derivada, y ahí está toda la decisión del ADR II-0002: guardarla la
    // convertiría en una propiedad que hay que resincronizar cada vez que algo se
    // mueve, y en una tabla por situación disfrazada de ley. Sale de la oclusión
    // que aportan los cuerpos colocados encima, pesada por su `permeability`.
    id: 'sheltered',
    range: [0, 1],
    derived: true,
  },
]

const CELL_BY_ID: ReadonlyMap<CellQuality, CellQualitySpec> = new Map(
  CELL_QUALITIES.map((s) => [s.id, s]),
)

export function cellSpecOf(q: CellQuality): CellQualitySpec {
  const s = CELL_BY_ID.get(q)
  if (s === undefined) throw new RangeError(`cualidad de celda desconocida: ${String(q)}`)
  return s
}

// ─── Puente al punto fijo ───────────────────────────────────────────────────

/**
 * El catálogo declara sus rangos en reales porque así se leen y se discuten. El
 * mundo los va a querer en `Fixed`. Se convierte acá y no en cada llamador, para
 * que el redondeo del borde del rango sea uno solo en todo el sistema.
 */
export function rangeFixed(q: QualityId): readonly [Fixed, Fixed] {
  const [lo, hi] = specOf(q).range
  return [fx(lo), fx(hi)]
}
