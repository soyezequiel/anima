// ─── @anima/oracle/bioma.ts ──────────────────────────────────────────────────
//
// EL CAMPO DE CLIMA Y LA TABLA DE BIOMAS. Lo que hace que el mapa infinito tenga
// FORMA: que el bosque sea un bosque de mil celdas y no un ruido de celdas
// sueltas, y que el bosque de al lado del pantano sea siempre el mismo bosque.
//
// ─── Ruido de valor, y por qué no hay una sola llamada a `Math` trascendente ─
//
// El ruido de valor es la forma más barata de un campo continuo: se sortea un
// número en cada nodo de una grilla gruesa y se interpola. La interpolación
// clásica usa un coseno o un `smoothstep` en punto flotante; acá es un
// `smoothstep` ENTERO —`3t² − 2t³` en escala 1024— por la regla 2 de
// `ii/README.md`: `Math.cos`, `Math.pow` y compañía no tienen precisión
// especificada en ECMAScript, dos motores pueden devolver el último bit distinto
// y el mismo chunk saldría bosque en Chrome y pradera en Firefox. Un mundo que
// no es el mismo mundo en dos navegadores no tiene legado ni juez.
//
// La escala interna es 1024 y no 1000 a propósito: todos los períodos son
// potencias de dos, así que `(coordenada & máscara) · 1024 / período` es un
// entero EXACTO y no hay un solo redondeo en el camino de la interpolación. Con
// 1000 habría uno por octava y por eje. Se convierte a `Fixed` (escala 1000) una
// sola vez, al final.
//
// ─── Por qué los biomas son una TABLA y no una jerarquía de clases ──────────
//
// Porque un bioma es dato: qué materia hay, cuánta agua, cuánto tapa el follaje,
// cuántas calorías puede llegar a rendir. Nada de eso es comportamiento. Un
// bioma nuevo se agrega escribiendo una fila, y las leyes de `@anima/physics`
// tratan a su materia igual que a la de cualquier otro — que es la tesis del
// remake: la emergencia sale de la física, no de una fila por situación.
//
// Lo único que hay que cuidar es que la tabla no se vuelva un catálogo de
// recetas. Por eso un bioma NO dice «acá se pesca»: dice qué sustancias hay y
// con qué abundancia, y si se puede pescar lo decide `admit()` mirando lo que la
// criatura tiene en la mano.

import { fx, FIXED_ONE, FIXED_SCALE, fixedFromRaw, SUSTANCIAS_POR_ID, T_AMBIENTE, type Fixed, type SubstanceId } from '@anima/physics'

import { semillaDeDominio, type Seed } from './pregunta.js'

// ─── El ruido de valor ──────────────────────────────────────────────────────

/**
 * La escala interna del ruido. Potencia de dos para que las divisiones por el
 * período y los desplazamientos de la interpolación sean exactos.
 */
export const RUIDO_ESCALA = 1024

/**
 * Una octava: un período (en unidades de la coordenada que se le pase) y el peso
 * con el que entra en la suma.
 *
 * Los pesos son enteros y la suma se divide una sola vez al final. Con pesos
 * reales, el resultado dependería del ORDEN de la suma en punto flotante, o sea
 * que reordenar la tabla —algo que parece cosmético— movería los biomas.
 */
export interface Octava {
  readonly periodo: number
  readonly peso: number
}

/**
 * Las octavas del CLIMA, en unidades de chunk. Período 64 son 1024 celdas de
 * lado: un bioma que se cruza caminando en un rato largo, no en tres pasos. Las
 * dos octavas finas rompen el borde recto entre biomas para que la frontera se
 * vea irregular sin costar otra pasada de ruido.
 */
export const OCTAVAS_CLIMA: readonly Octava[] = [
  { periodo: 64, peso: 8 },
  { periodo: 16, peso: 4 },
  { periodo: 4, peso: 2 },
]

/**
 * Las octavas del TERRENO, en unidades de celda. Período 32 celdas: un charco o
 * un brazo de río mide decenas de celdas, no cientos.
 *
 * Que el terreno se muestree en coordenadas de CELDA y no de chunk es lo que
 * hace que el agua sea continua cruzando el borde de un chunk. Si el agua
 * saliera del dado del chunk, dos chunks vecinos decidirían su agua por separado
 * y el río se cortaría en seco cada 16 celdas — y la componente conexa del
 * union-find sería un charco por chunk, que es justo lo que el documento no
 * quiere («no puede haber pescado en un tile y ninguno en el de al lado»).
 */
export const OCTAVAS_TERRENO: readonly Octava[] = [
  { periodo: 32, peso: 6 },
  { periodo: 8, peso: 3 },
  { periodo: 2, peso: 1 },
]

function bitsDe(periodo: number): number {
  if (!Number.isInteger(periodo) || periodo < 1 || periodo > RUIDO_ESCALA || (periodo & (periodo - 1)) !== 0) {
    throw new RangeError(`período de ruido inválido: ${String(periodo)} (potencia de dos, entre 1 y ${String(RUIDO_ESCALA)})`)
  }
  let b = 0
  let p = periodo
  while (p > 1) {
    p >>= 1
    b++
  }
  return b
}

/**
 * El valor de un nodo de la grilla, en `[0, RUIDO_ESCALA]`.
 *
 * Es una avalancha de enteros de 32 bits —xor, desplazamiento y `Math.imul`—,
 * todas operaciones con semántica exacta. No es un `rngFor`: un nodo no es una
 * pregunta y no tiene compromiso; es una función pura de la coordenada, y tiene
 * que serlo porque el mismo nodo lo miran los cuatro chunks que lo rodean.
 */
function valorDeNodo(dominio: number, gx: number, gy: number): number {
  let h = dominio ^ Math.imul(gx | 0, 0x27d4eb2d)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = h ^ Math.imul(gy | 0, 0x165667b1)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h = h ^ (h >>> 16)
  return (h >>> 0) % (RUIDO_ESCALA + 1)
}

/**
 * La semilla de dominio del ruido, memoizada para la última semilla vista.
 *
 * `terrainFor` llama al ruido 256 veces seguidas con la misma semilla derivada,
 * y `semillaDeDominio` arma una cadena (`${seed}#ruido`) y la hashea entera: sin
 * el memo, decretar un chunk son 256 formateos de un `bigint`, que es más caro
 * que todo el resto del ruido junto.
 *
 * Es un memo de una función PURA de un solo argumento, sin invalidación posible:
 * la respuesta con memo y sin memo es la misma, y de eso hay test («el ruido es
 * puro»). No es la clase de caché que el resto del paquete evita —una segunda
 * fuente de verdad que hay que invalidar— sino la que no se puede equivocar.
 */
let ultimaSemilla: Seed | null = null
let ultimaBase = 0

function baseDeRuido(seed: Seed): number {
  if (ultimaSemilla === null || seed !== ultimaSemilla) {
    ultimaBase = semillaDeDominio(seed, 'ruido')
    ultimaSemilla = seed
  }
  return ultimaBase
}

/** `3t² − 2t³` en escala `RUIDO_ESCALA`, con enteros. En 0 vale 0 y en 1024
 *  vale 1024 exacto, que es lo que hace que el valor del nodo se respete. */
function suavizar(t: number): number {
  const t2 = (t * t) >> 10
  const t3 = (t2 * t) >> 10
  return 3 * t2 - 2 * t3
}

/** Interpolación lineal en escala `RUIDO_ESCALA`. `>>` sobre un producto de a lo
 *  sumo 2²⁰ es exacto también con signo: desplaza hacia −∞, que es una regla y
 *  no un redondeo dependiente del motor. */
function entre(a: number, b: number, s: number): number {
  return a + (((b - a) * s) >> 10)
}

/**
 * El campo de ruido en `(x, y)`, como `Fixed` en [0, 1].
 *
 * Es **puro**: no consume ningún dado, no tiene estado y no le importa cuándo se
 * lo llame. Ésa es la regla madre en su forma más chica — si el clima de un
 * chunk dependiera de un generador con estado, el orden de exploración cambiaría
 * el mapa.
 */
export function valueNoise(seed: Seed, x: number, y: number, octavas: readonly Octava[] = OCTAVAS_CLIMA): Fixed {
  if (octavas.length === 0) throw new RangeError('el ruido necesita al menos una octava')
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new RangeError(`coordenada de ruido no entera: ${String(x)},${String(y)}`)
  }
  // La semilla de dominio se calcula UNA vez por llamada y cada octava la
  // vuelve a mezclar con su período: sin eso, dos octavas del mismo campo
  // compartirían nodos y el ruido tendría una diagonal visible.
  const base = baseDeRuido(seed)
  let suma = 0
  let pesos = 0
  for (const o of octavas) {
    const bits = bitsDe(o.periodo)
    const mask = o.periodo - 1
    const dom = Math.imul(base ^ o.periodo, 0x9e3779b1)
    const gx = x >> bits
    const gy = y >> bits
    const tx = suavizar(((x & mask) * RUIDO_ESCALA) / o.periodo)
    const ty = suavizar(((y & mask) * RUIDO_ESCALA) / o.periodo)
    const n00 = valorDeNodo(dom, gx, gy)
    const n10 = valorDeNodo(dom, gx + 1, gy)
    const n01 = valorDeNodo(dom, gx, gy + 1)
    const n11 = valorDeNodo(dom, gx + 1, gy + 1)
    const v = entre(entre(n00, n10, tx), entre(n01, n11, tx), ty)
    if (!Number.isInteger(o.peso) || o.peso < 1) throw new RangeError(`peso de octava inválido: ${String(o.peso)}`)
    suma += v * o.peso
    pesos += o.peso
  }
  // Una sola división entera al final, hacia abajo. `Math.floor` sobre un
  // cociente de enteros chicos es exacto y da lo mismo en todos los motores.
  return fixedFromRaw(Math.floor((Math.floor(suma / pesos) * FIXED_SCALE) / RUIDO_ESCALA))
}

// ─── El clima ───────────────────────────────────────────────────────────────

/**
 * Los tres números de los que sale todo lo demás. `Fixed` en [0, 1] los tres:
 * son proporciones, no medidas, y la unidad se la pone quien los usa.
 */
export interface Clima {
  readonly humedad: Fixed
  readonly fertilidad: Fixed
  readonly altura: Fixed
}

// ─── Los biomas ─────────────────────────────────────────────────────────────

export type BiomaId =
  | 'agua-dulce'
  | 'pantano'
  | 'bosque-humedo'
  | 'bosque'
  | 'pradera'
  | 'matorral'
  | 'estepa'
  | 'roquedal'
  | 'arenal'

/**
 * Una sustancia que se puede encontrar TIRADA, con su peso relativo y el rango
 * de masa de una unidad. La masa la sortea el dado del dios dentro del rango: no
 * todas las ramas son iguales, y que no lo sean es lo que hace que elegir cuál
 * levantar sea una decisión.
 */
export interface Siembra {
  readonly substance: SubstanceId
  readonly peso: number
  readonly masaMinima: Fixed
  readonly masaMaxima: Fixed
}

export interface Bioma {
  readonly id: BiomaId
  /** Si tiene agua franca. Lo lee la regla de resolubilidad y el union-find. */
  readonly acuatico: boolean
  /** De qué está hecho el lugar. Es lo que el chunk puede llegar a ofrecer. */
  readonly sustancias: readonly SubstanceId[]
  /** Lo que hay suelto, con su peso. Vacío es legítimo: un roquedal pelado. */
  readonly siembra: readonly Siembra[]
  /**
   * Umbral del ruido de terreno por debajo del cual la celda tiene agua franca,
   * en milésimas. 0 es un bioma sin una gota.
   */
  readonly nivelDeAguaPorMil: number
  /** `wet` de una celda SIN agua franca: el pantano está húmedo sin ser laguna. */
  readonly humedadDeCeldaSeca: Fixed
  /** `cover` de base: cuánto tapa el follaje. Es la entrada de la ley 12. */
  readonly coberturaBase: Fixed
  /** Cuánto se aparta del ambiente, en °C. El bosque cerrado es más fresco. */
  readonly deltaTemperatura: number
  /** Cuántas cosas sueltas con fertilidad 0, y cuántas más con fertilidad 1. */
  readonly sueltasBase: number
  readonly sueltasPorFertilidad: number
  /** El techo calórico del chunk con fertilidad 0, y la pendiente. */
  readonly caloriasBase: number
  readonly caloriasPorFertilidad: number
}

/**
 * Un atajo para escribir la tabla sin repetir el rango de masa quince veces.
 * Masas en kilos, que es la unidad de `Body.mass` en `@anima/physics`.
 */
function siembra(substance: SubstanceId, peso: number, min: number, max: number): Siembra {
  return { substance, peso, masaMinima: fx(min), masaMaxima: fx(max) }
}

/**
 * ─── La regla de resolubilidad, en la tabla y no en una plegaria ────────────
 *
 * El documento pide que un chunk acuático tenga con qué armar un aparejo en
 * radio 2, y avisa que el fallo sería SILENCIOSO: `admit()` no se queja, la
 * criatura simplemente nunca encuentra insumos y se queda tanteando. La
 * verificación de radio 2 la hace su propio módulo, pero la primera línea de
 * defensa es ésta: **todo bioma acuático siembra algo `fibroso` (junco, liana) y
 * algo largo y rígido (madera, madera-dura)**, que son los dos roles del
 * `union` que produce `catch>0 ∧ reach≥2`.
 *
 * Está escrito acá, al lado de los datos, porque es de los datos: si alguien
 * saca el junco del pantano, lo que hay que releer es esta nota.
 */
export const BIOMAS: readonly Bioma[] = [
  {
    id: 'agua-dulce',
    acuatico: true,
    sustancias: ['agua', 'junco', 'pescado', 'molusco', 'arcilla', 'piedra', 'madera', 'madera-verde', 'corteza'],
    siembra: [
      siembra('junco', 6, 0.05, 0.4),
      siembra('madera', 4, 0.3, 2.5),
      siembra('piedra', 3, 0.2, 3),
      siembra('arcilla', 2, 0.5, 4),
      siembra('corteza', 2, 0.05, 0.5),
    ],
    nivelDeAguaPorMil: 620,
    humedadDeCeldaSeca: fx(0.45),
    coberturaBase: fx(0.05),
    deltaTemperatura: -2,
    sueltasBase: 6,
    sueltasPorFertilidad: 10,
    caloriasBase: 900,
    caloriasPorFertilidad: 2600,
  },
  {
    id: 'pantano',
    acuatico: true,
    sustancias: ['agua', 'junco', 'liana', 'hongo', 'hoja', 'madera', 'madera-verde', 'arcilla', 'molusco'],
    siembra: [
      siembra('junco', 6, 0.05, 0.4),
      siembra('liana', 4, 0.05, 0.6),
      siembra('madera-verde', 4, 0.4, 3),
      siembra('madera', 3, 0.3, 2.5),
      siembra('hongo', 3, 0.02, 0.2),
      siembra('hoja', 3, 0.01, 0.1),
      siembra('arcilla', 2, 0.5, 4),
    ],
    nivelDeAguaPorMil: 380,
    humedadDeCeldaSeca: fx(0.6),
    coberturaBase: fx(0.25),
    deltaTemperatura: -1,
    sueltasBase: 8,
    sueltasPorFertilidad: 12,
    caloriasBase: 1100,
    caloriasPorFertilidad: 2400,
  },
  {
    id: 'bosque-humedo',
    acuatico: false,
    sustancias: ['madera', 'madera-verde', 'hoja', 'liana', 'hongo', 'corteza', 'savia', 'raiz', 'carne', 'pluma'],
    siembra: [
      siembra('madera', 6, 0.3, 3),
      siembra('hoja', 5, 0.01, 0.1),
      siembra('liana', 4, 0.05, 0.6),
      siembra('corteza', 3, 0.05, 0.5),
      siembra('hongo', 3, 0.02, 0.2),
      siembra('raiz', 2, 0.05, 0.5),
    ],
    nivelDeAguaPorMil: 60,
    humedadDeCeldaSeca: fx(0.35),
    coberturaBase: fx(0.55),
    deltaTemperatura: -3,
    sueltasBase: 10,
    sueltasPorFertilidad: 14,
    caloriasBase: 1400,
    caloriasPorFertilidad: 3000,
  },
  {
    id: 'bosque',
    acuatico: false,
    sustancias: ['madera', 'madera-dura', 'corteza', 'hoja', 'hoja-seca', 'raiz', 'piedra', 'carne', 'hueso', 'pluma'],
    siembra: [
      siembra('madera', 6, 0.3, 3),
      siembra('madera-dura', 3, 0.5, 4),
      siembra('hoja-seca', 4, 0.01, 0.08),
      siembra('corteza', 3, 0.05, 0.5),
      siembra('raiz', 2, 0.05, 0.5),
      siembra('piedra', 1, 0.2, 3),
    ],
    nivelDeAguaPorMil: 25,
    humedadDeCeldaSeca: fx(0.2),
    coberturaBase: fx(0.4),
    deltaTemperatura: -2,
    sueltasBase: 9,
    sueltasPorFertilidad: 12,
    caloriasBase: 1200,
    caloriasPorFertilidad: 2600,
  },
  {
    id: 'pradera',
    acuatico: false,
    sustancias: ['grano', 'hoja', 'raiz', 'tuberculo', 'carne', 'hueso', 'piedra'],
    siembra: [
      siembra('grano', 5, 0.01, 0.15),
      siembra('hoja', 4, 0.01, 0.1),
      siembra('raiz', 3, 0.05, 0.5),
      siembra('tuberculo', 3, 0.05, 0.6),
      siembra('piedra', 2, 0.2, 3),
      siembra('hueso', 1, 0.05, 0.8),
    ],
    nivelDeAguaPorMil: 15,
    humedadDeCeldaSeca: fx(0.15),
    coberturaBase: fx(0.12),
    deltaTemperatura: 0,
    sueltasBase: 7,
    sueltasPorFertilidad: 12,
    caloriasBase: 1000,
    caloriasPorFertilidad: 2800,
  },
  {
    id: 'matorral',
    acuatico: false,
    sustancias: ['liana', 'raiz-dura', 'hoja-seca', 'grano', 'hongo', 'piedra'],
    siembra: [
      siembra('liana', 5, 0.05, 0.6),
      siembra('hoja-seca', 4, 0.01, 0.08),
      siembra('raiz-dura', 3, 0.1, 1),
      siembra('grano', 2, 0.01, 0.15),
      siembra('piedra', 2, 0.2, 3),
    ],
    nivelDeAguaPorMil: 10,
    humedadDeCeldaSeca: fx(0.1),
    coberturaBase: fx(0.2),
    deltaTemperatura: 1,
    sueltasBase: 6,
    sueltasPorFertilidad: 9,
    caloriasBase: 700,
    caloriasPorFertilidad: 1800,
  },
  {
    id: 'estepa',
    acuatico: false,
    sustancias: ['hoja-seca', 'raiz-dura', 'hueso', 'piedra', 'pedernal'],
    siembra: [
      siembra('hoja-seca', 4, 0.01, 0.08),
      siembra('raiz-dura', 3, 0.1, 1),
      siembra('piedra', 3, 0.2, 3),
      siembra('hueso', 2, 0.05, 0.8),
      siembra('pedernal', 1, 0.1, 0.8),
    ],
    nivelDeAguaPorMil: 5,
    humedadDeCeldaSeca: fx(0.06),
    coberturaBase: fx(0.05),
    deltaTemperatura: 2,
    sueltasBase: 4,
    sueltasPorFertilidad: 6,
    caloriasBase: 400,
    caloriasPorFertilidad: 1100,
  },
  {
    id: 'roquedal',
    acuatico: false,
    sustancias: ['piedra', 'pedernal', 'hueso', 'arcilla', 'raiz-dura'],
    siembra: [
      siembra('piedra', 6, 0.2, 5),
      siembra('pedernal', 3, 0.1, 0.8),
      siembra('arcilla', 2, 0.5, 4),
      siembra('hueso', 1, 0.05, 0.8),
    ],
    nivelDeAguaPorMil: 0,
    humedadDeCeldaSeca: fx(0.04),
    coberturaBase: fx(0.08),
    deltaTemperatura: -4,
    sueltasBase: 5,
    sueltasPorFertilidad: 3,
    caloriasBase: 150,
    caloriasPorFertilidad: 400,
  },
  {
    id: 'arenal',
    acuatico: false,
    sustancias: ['piedra', 'pedernal', 'arcilla', 'hueso', 'raiz-dura'],
    siembra: [
      siembra('piedra', 4, 0.2, 3),
      siembra('pedernal', 2, 0.1, 0.8),
      siembra('hueso', 2, 0.05, 0.8),
      siembra('raiz-dura', 1, 0.1, 1),
    ],
    nivelDeAguaPorMil: 0,
    humedadDeCeldaSeca: fx(0.02),
    coberturaBase: fx(0.02),
    deltaTemperatura: 6,
    sueltasBase: 2,
    sueltasPorFertilidad: 3,
    caloriasBase: 120,
    caloriasPorFertilidad: 350,
  },
]

const BIOMA_POR_ID: ReadonlyMap<BiomaId, Bioma> = new Map(BIOMAS.map((b) => [b.id, b]))

export function biomaDe(id: BiomaId): Bioma {
  const b = BIOMA_POR_ID.get(id)
  if (b === undefined) throw new RangeError(`bioma desconocido: ${String(id)}`)
  return b
}

/**
 * Que toda sustancia nombrada en la tabla EXISTA en el catálogo, verificado al
 * cargar el módulo y no en un test.
 *
 * Un test se puede no correr; esto no. Y el modo de falla que evita es feo: un
 * bioma que siembra `'junko'` no explota — el chunk se decreta con una sustancia
 * fantasma, el cuerpo se crea sin cualidades y la criatura levanta algo que no
 * pesa, no arde y no alimenta. Es el bug de `DSL_REFERENCE` de Ánima I otra vez:
 * una referencia mantenida a mano que divergió del código.
 */
/**
 * Los dos umbrales de la regla de resolubilidad, con nombre.
 *
 * `flexibility ≥ 0.8` es literalmente la firma que el documento pone en el
 * índice de esquemas de construcción (`SCHEMA_INDEX['flexibility>=0.8']` →
 * deshilachar algo fibroso), y `rigidity ≥ 0.5` es el umbral de la fricción que
 * `madera` ya cita en su propio comentario del catálogo. No son números nuevos:
 * son los que ya estaban, escritos donde se verifican.
 */
export const FLEXIBILIDAD_DE_ATADURA = 0.8
export const RIGIDEZ_DE_VARA = 0.5

function cualidadBase(id: SubstanceId, q: 'rigidity' | 'flexibility'): number {
  const s = SUSTANCIAS_POR_ID.get(id)
  if (s === undefined) throw new RangeError(`sustancia inexistente: ${id}`)
  return s.perUnitMass[q] ?? 0
}

for (const b of BIOMAS) {
  for (const s of b.sustancias) {
    if (!SUSTANCIAS_POR_ID.has(s)) throw new RangeError(`el bioma ${b.id} nombra la sustancia inexistente «${s}»`)
  }
  for (const s of b.siembra) {
    if (!SUSTANCIAS_POR_ID.has(s.substance)) {
      throw new RangeError(`el bioma ${b.id} siembra la sustancia inexistente «${s.substance}»`)
    }
    // Lo que está tirado tiene que ser de lo que el lugar está hecho. Si no, la
    // lista `sustancias` sería una decoración: el chunk mostraría corteza que el
    // bioma dice no tener, y cualquiera que planifique mirando `sustancias`
    // planificaría sobre un mundo que no existe.
    if (!b.sustancias.includes(s.substance)) {
      throw new RangeError(`el bioma ${b.id} siembra «${s.substance}», que no está entre sus sustancias`)
    }
    if (s.masaMinima <= 0 || s.masaMaxima < s.masaMinima) {
      throw new RangeError(`el bioma ${b.id} siembra ${s.substance} con un rango de masa inválido`)
    }
  }
  if (b.acuatico && b.nivelDeAguaPorMil <= 0) {
    throw new RangeError(`el bioma acuático ${b.id} no tiene agua`)
  }
  // La regla de resolubilidad en su forma más barata: la que se verifica sobre
  // la TABLA, antes de que exista ningún chunk. La verificación de radio 2 sobre
  // el mundo decretado es otra cosa y vive en su propio módulo; ésta es la que
  // impide que el bioma acuático nazca sin con qué, que es el caso en el que esa
  // otra verificación no tendría nada que encontrar.
  if (b.acuatico) {
    const hayAtadura = b.siembra.some((s) => cualidadBase(s.substance, 'flexibility') >= FLEXIBILIDAD_DE_ATADURA)
    const hayVara = b.siembra.some((s) => cualidadBase(s.substance, 'rigidity') >= RIGIDEZ_DE_VARA)
    if (!hayAtadura || !hayVara) {
      throw new RangeError(
        `el bioma acuático ${b.id} no siembra con qué armar un aparejo: ` +
          `atadura=${String(hayAtadura)}, vara=${String(hayVara)}`,
      )
    }
  }
}

// ─── La cantera: lo que el mundo deja tirado ────────────────────────────────

/**
 * TODO LO QUE EL MUNDO DEJA TIRADO EN ALGÚN LADO: la unión de las `siembra` de
 * los nueve biomas, sin repetir y en el orden de la tabla.
 *
 * ─── Para qué existe, que es lo importante ──────────────────────────────────
 *
 * La garantía de resolubilidad (`ensureSolvable`) siembra materia cuando un
 * lugar donde se pesca no tiene con qué armar un aparejo. Buscaba entre el
 * catálogo ENTERO, y eso está mal por una razón que este mismo archivo ya
 * verifica para `scatter`: **lo que está tirado tiene que ser de lo que el
 * mundo está hecho**. Medido en 1681 chunks, la garantía dejaba en la orilla
 * `agua/hebra`, `savia/hebra`, `pluma/hebra`, `piel/hebra` y `tendon/hebra`: un
 * hilo de agua atado a una vara, plumas sin pájaro y tendones sin animal.
 *
 * No hace falta una lista nueva ni un tag prohibido para arreglarlo. La lista de
 * qué puede haber tirado ya existe y es ésta: **lo que algún bioma siembra**. Un
 * líquido no está acá porque ningún bioma deja líquidos tirados —el agua está
 * entre las `sustancias` de los biomas acuáticos, no entre lo que sueltan—, y
 * una pluma no está porque ningún bioma la suelta. El día que un bioma siembre
 * plumas, la garantía va a poder sembrarlas, y va a estar bien.
 *
 * Es una CANTERA y no una receta: no dice qué armar ni con qué, sólo de dónde se
 * puede sacar. Qué llena cada rol lo sigue contestando `cumpleRol` de la física.
 */
export const CANTERA_DEL_MUNDO: readonly SubstanceId[] = (() => {
  const vistas = new Set<SubstanceId>()
  for (const b of BIOMAS) for (const s of b.siembra) vistas.add(s.substance)
  return [...vistas]
})()

/**
 * Y la verificación de que la cantera alcanza, al CARGAR el módulo.
 *
 * Es la misma defensa que el chequeo por bioma acuático de más arriba, un
 * escalón más arriba: aquél impide que un bioma acuático nazca sin con qué;
 * éste impide que el MUNDO se quede sin con qué. Si mañana alguien restringe la
 * cantera —o le saca la liana y el junco a todos los biomas— la garantía de
 * resolubilidad no podría cerrar en ningún chunk de ninguna semilla, y el
 * síntoma sería una excepción al decretar un chunk cualquiera, lejos de la
 * causa. Acá el mundo no arranca.
 */
{
  const hayAtadura = CANTERA_DEL_MUNDO.some((s) => cualidadBase(s, 'flexibility') >= FLEXIBILIDAD_DE_ATADURA)
  const hayVara = CANTERA_DEL_MUNDO.some((s) => cualidadBase(s, 'rigidity') >= RIGIDEZ_DE_VARA)
  if (!hayAtadura || !hayVara) {
    throw new RangeError(
      `la cantera del mundo no tiene con qué armar un aparejo en ningún lado: ` +
        `atadura=${String(hayAtadura)}, vara=${String(hayVara)}`,
    )
  }
}

// ─── La clasificación ───────────────────────────────────────────────────────

/**
 * El bioma que le toca a un clima. **Total y ordenada**: la cascada de `if`
 * cubre todo el cubo [0,1]³ y la última rama no tiene condición, así que no
 * existe un clima sin bioma. Un `default: throw` acá sería una bomba de tiempo
 * que explota en el primer chunk raro que alguien explore.
 *
 * El orden de las ramas ES la decisión y no es conmutativo: el agua se decide
 * antes que todo lo demás porque la altura baja con humedad alta manda sobre la
 * fertilidad, y el roquedal antes que el bosque porque arriba de cierta altura
 * no crece nada por fértil que sea el suelo.
 *
 * Los umbrales están en `Fixed` (milésimas) y comparados con `<` y `>=`, que son
 * exactos sobre enteros. Nada de tolerancias: un chunk cae de un lado o del
 * otro, siempre del mismo lado, en cualquier motor.
 */
export function biomaPorClima(c: Clima): Bioma {
  const { humedad, fertilidad, altura } = c
  if (altura < fx(0.28) && humedad >= fx(0.55)) return biomaDe('agua-dulce')
  if (altura < fx(0.38) && humedad >= fx(0.7)) return biomaDe('pantano')
  if (altura >= fx(0.8)) return biomaDe('roquedal')
  if (humedad < fx(0.22)) return biomaDe('arenal')
  if (humedad >= fx(0.68) && fertilidad >= fx(0.55)) return biomaDe('bosque-humedo')
  if (humedad >= fx(0.5) && fertilidad >= fx(0.45)) return biomaDe('bosque')
  if (humedad >= fx(0.4)) return biomaDe('pradera')
  if (fertilidad >= fx(0.4)) return biomaDe('matorral')
  return biomaDe('estepa')
}

// ─── El presupuesto calórico ────────────────────────────────────────────────

/**
 * EL TOPE DEL DIOS. Cuántas calorías puede llegar a aportar este chunk, jamás.
 *
 * Es una función PURA del bioma y de la fertilidad —o sea, de la semilla— y
 * **no toca ningún dado**. Ésa es la reparación de la falla más peligrosa que el
 * documento le encontró a las propuestas: si el techo saliera de un sorteo o,
 * peor, lo propusiera el oráculo, el modelo podría sembrar comida infinita
 * mientras la llame terreno. El oráculo elige la FORMA y el NOMBRE; la ECONOMÍA
 * la fija esto, y no hay cómo pedirle más.
 *
 * Entero, y en calorías: es una cuenta de conservación y se compara con `<=`.
 * Un techo en punto flotante se acumularía con error y el invariante duro
 * («lo aportado ≤ el techo») dejaría de ser decidible en el borde.
 */
export function caloricBudget(b: Bioma, fertilidad: Fixed): number {
  if (fertilidad < 0 || fertilidad > FIXED_ONE) {
    throw new RangeError(`fertilidad fuera de [0,1]: ${String(fertilidad)}`)
  }
  return b.caloriasBase + Math.floor((b.caloriasPorFertilidad * fertilidad) / FIXED_SCALE)
}

/** La temperatura ambiente del bioma, en °C. Sale del ambiente de la física más
 *  el apartamiento del bioma: una sola fuente para el ambiente, y el bioma
 *  declara la DIFERENCIA. Dos constantes para lo mismo divergen. */
export function temperaturaDelBioma(b: Bioma): number {
  return T_AMBIENTE + b.deltaTemperatura
}
