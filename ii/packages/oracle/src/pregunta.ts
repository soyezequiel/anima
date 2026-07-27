// ─── @anima/oracle/pregunta.ts ───────────────────────────────────────────────
//
// LA PREGUNTA, SU CLAVE Y EL DADO DEL DIOS. El nivel 1 del dios perezoso empieza
// acá: antes de decidir NADA hay que poder decir, sin ambigüedad, QUÉ se está
// preguntando. Todo lo demás del paquete —la ley, el ledger, la enmienda del
// oráculo— se indexa por la clave que sale de este archivo.
//
// ─── La regla madre, y por qué vive en la clave ─────────────────────────────
//
// «La respuesta a una pregunta NO depende de cuándo ni en qué orden se
// preguntó.» Eso NO se consigue con memoria: se consigue haciendo que la
// respuesta sea una FUNCIÓN de la pregunta y de la semilla, y nada más. El
// ledger es autoridad para lo que la ley no puede reproducir (lo que enmendó el
// oráculo) más una caché; si mañana se borrara entero, el mundo tendría que
// volver a decir lo mismo sobre todo lo que decidió la ley.
//
// De ahí sale el requisito duro de este archivo: `keyOf` tiene que ser
// **inyectiva**. Dos preguntas distintas con la misma clave son dos hechos del
// mundo compartiendo destino — el río y la cueva de al lado decidiéndose con el
// mismo dado— y el síntoma no sería un error sino una correlación rarísima que
// nadie va a poder explicar. Por eso los ids se VALIDAN en vez de confiarse: un
// id con dos puntos adentro (`d:pez:3` con stock `pez:3` y n indeterminado)
// rompe la inyectividad en silencio, y un id con `|` se mete en la separación
// entre la semilla y la clave.
//
// ─── Por qué el dado del dios es un tipo NOMINAL ────────────────────────────
//
// `DiosRng` y `WorldRng` son los dos `() => number`, y ahí está el peligro: si
// fueran el mismo tipo, cualquier función del decretador podría recibir el dado
// del MUNDO por descuido y consumirlo. Consumir el dado del mundo desde el dios
// significa que **mirar el mapa corre la partida**: dos jugadores con la misma
// semilla y las mismas órdenes divergen según cuánto exploraron. Ese bug no da
// error, no da excepción y no aparece en ningún test que no compare hashes de
// partidas largas; aparece seis meses después, cuando un guardado no reproduce.
//
// La marca cuesta cero bits en tiempo de ejecución y la verifica `tsc`. Es
// barato de prevenir y carísimo de descubrir.

import { FIXED_SCALE, fixedFromRaw, type Fixed } from '@anima/physics'

// ─── Las identidades ────────────────────────────────────────────────────────

/**
 * La semilla del mundo. `bigint` y no `number` porque una semilla es una
 * IDENTIDAD, no una cantidad: no se suma, no se promedia y no se le aplica
 * ninguna cuenta. Un `number` con 53 bits de mantisa invita a hacerle
 * aritmética que redondea; un `bigint` no redondea nunca y su forma de texto
 * (`String(seed)`) es exacta y la misma en todos los motores.
 *
 * Nota para quien lo guarde: un `bigint` NO entra en `hashWorld` (lanza a
 * propósito). Al journal va como texto.
 */
export type Seed = bigint

/**
 * Un cuerpo de agua es una COMPONENTE CONEXA de celdas mojadas, no una celda.
 * El id lo fabrica el union-find; acá solo se lo nombra para que las firmas
 * digan de qué hablan.
 */
export type WaterBodyId = string

/** Una población extraíble. Es de la POBLACIÓN, no del agua ni de la celda. */
export type StockId = string

// ─── La pregunta ────────────────────────────────────────────────────────────

/**
 * Las cuatro cosas que se le pueden preguntar al dios.
 *
 * Son cuatro y no «una pregunta genérica con un tema de texto» porque cada una
 * tiene un GRANO de compromiso distinto (ver el ledger): el chunk se compromete
 * al verlo, el stock del cuerpo de agua al interactuar. Con una pregunta
 * genérica esa distinción tendría que vivir en una tabla paralela, y una tabla
 * paralela se desincroniza.
 */
export type Question =
  | { readonly k: 'chunk'; readonly cx: number; readonly cy: number }
  | { readonly k: 'waterBody'; readonly id: WaterBodyId }
  | { readonly k: 'draw'; readonly stock: StockId; readonly n: number }
  | { readonly k: 'novelty'; readonly topic: string; readonly nonce: number }

/**
 * Cota de coordenada de chunk. El mundo de `@anima/world` va de −2²⁰ a 2²⁰−1
 * celdas, o sea ±65 536 chunks; acá se acepta bastante más para no atarse a esa
 * constante desde otro paquete, pero SÍ hay un techo: el ruido de valor
 * multiplica coordenadas por sus períodos, y arriba de 2²⁶ esos productos dejan
 * de ser exactos en un double. Un límite escrito es una divergencia menos.
 */
export const LIMITE_DE_CHUNK = 1 << 26

/** Largo máximo de un id o de un tema. No es estética: una clave sin cota es
 *  una clave que alguien puede hacer crecer hasta que hashearla cueste el tick. */
export const LARGO_MAXIMO_DE_ID = 128

/**
 * Los caracteres que NO pueden aparecer en un id ni en un tema.
 *
 * `:` es el separador de los campos de la clave y `|` el que separa la semilla
 * de la clave. Sin esta prohibición, `{k:'draw', stock:'a:1', n:2}` y
 * `{k:'draw', stock:'a', n:...}` podrían escribir la misma cadena, que es
 * exactamente la pérdida de inyectividad que este archivo existe para evitar.
 */
const PROHIBIDOS = [':', '|']

function validarTexto(v: string, qué: string): string {
  if (v.length === 0) throw new RangeError(`${qué} vacío`)
  if (v.length > LARGO_MAXIMO_DE_ID) {
    throw new RangeError(`${qué} de ${String(v.length)} caracteres, el techo es ${String(LARGO_MAXIMO_DE_ID)}`)
  }
  for (const c of PROHIBIDOS) {
    if (v.includes(c)) throw new RangeError(`${qué} con «${c}», que es separador de la clave: ${v}`)
  }
  return v
}

function validarEntero(v: number, qué: string, lo: number, hi: number): number {
  if (!Number.isInteger(v)) throw new RangeError(`${qué} no es entero: ${String(v)}`)
  if (v < lo || v > hi) throw new RangeError(`${qué} fuera de rango [${String(lo)}, ${String(hi)}]: ${String(v)}`)
  return v
}

/**
 * La clave canónica de una pregunta: ordenada, estable y única.
 *
 * **Estable** quiere decir que este texto entra en guardados y en la crónica: si
 * mañana cambia el formato, todas las claves de todas las partidas guardadas
 * dejan de encontrar su compromiso y el mundo se re-decreta entero. Cambiar esto
 * es un cambio de formato de guardado, y hay que tratarlo como tal.
 *
 * El prefijo de una letra por variante es lo que impide que un chunk y un
 * cuerpo de agua compartan clave. `String(v)` sobre un entero es exacto y no
 * depende del locale: `-0` sale «0» —y por eso `Object.is(-0, 0)` no importa
 * acá— y ningún entero seguro sale en notación exponencial.
 */
export function keyOf(q: Question): string {
  switch (q.k) {
    case 'chunk':
      return `c:${String(validarEntero(q.cx, 'cx', -LIMITE_DE_CHUNK, LIMITE_DE_CHUNK - 1))}:${String(
        validarEntero(q.cy, 'cy', -LIMITE_DE_CHUNK, LIMITE_DE_CHUNK - 1),
      )}`
    case 'waterBody':
      return `w:${validarTexto(q.id, 'id de cuerpo de agua')}`
    case 'draw':
      // `n` es el ORDINAL de la extracción, no la cantidad: la primera vez que
      // alguien mete la mano en este stock, la segunda, la tercera. Sin él, dos
      // extracciones del mismo stock compartirían clave y el dios les debería la
      // misma respuesta para siempre.
      return `d:${validarTexto(q.stock, 'id de stock')}:${String(validarEntero(q.n, 'n', 0, Number.MAX_SAFE_INTEGER))}`
    case 'novelty':
      return `n:${validarTexto(q.topic, 'tema')}:${String(validarEntero(q.nonce, 'nonce', 0, Number.MAX_SAFE_INTEGER))}`
  }
}

// ─── El hash de la clave ────────────────────────────────────────────────────

const FNV_OFFSET = 0x811c9dc5 | 0
const FNV_PRIME = 0x01000193

/**
 * FNV-1a de 32 bits sobre las unidades de código UTF-16, byte alto primero.
 *
 * Escrito acá y no importado de `@anima/world`: **el oráculo no depende del
 * mundo**. El mundo lo llama a él (ver el diagrama del documento), y si la
 * flecha fuera en los dos sentidos habría un ciclo de paquetes. Son ocho líneas
 * y la duplicación es explícita; la alternativa —un paquete «util» compartido—
 * es la clase de dependencia que en tres meses tiene adentro la mitad del juego.
 *
 * `Math.imul` y no `a * b`: la multiplicación de dos enteros de 32 bits pasa
 * 2⁵³ en el primer byte y un double redondearía distinto según el motor.
 */
export function fnv1a(s: string): number {
  let h = FNV_OFFSET
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h = Math.imul(h ^ ((c >>> 8) & 0xff), FNV_PRIME)
    h = Math.imul(h ^ (c & 0xff), FNV_PRIME)
  }
  return h >>> 0
}

// ─── Los dos dados ──────────────────────────────────────────────────────────

/**
 * El dado del DIOS: decide QUÉ EXISTE. Se deriva de la pregunta, así que
 * preguntar dos veces da el mismo dado y no consume nada.
 */
export type DiosRng = (() => number) & { readonly __diosRng: unique symbol }

/**
 * El dado del MUNDO: decide SI ESTA VEZ PICÓ. Es un flujo con estado que avanza
 * con la partida, y consumirlo es un acto que cambia el futuro.
 *
 * Se declara acá aunque el dado viva en el mundo, porque lo que hay que poder
 * escribir es la DISTINCIÓN: una función que pide `DiosRng` no acepta un
 * `WorldRng` y `tsc` lo dice. Sin los dos tipos, la separación es un comentario.
 */
export type WorldRng = (() => number) & { readonly __worldRng: unique symbol }

/**
 * mulberry32: un generador de 32 bits de estado, cuatro líneas y ninguna tabla.
 *
 * Todas sus operaciones —`|0`, `^`, `>>>`, `Math.imul`— están especificadas EXACTO
 * en ECMAScript, así que dos motores producen la misma secuencia bit a bit. La
 * división final es por 2³², una potencia de dos: el cociente de un entero de 32
 * bits por 2³² es exacto en un double, sin redondeo.
 *
 * No es criptográfico y no pretende serlo. Lo que se le pide es que dos claves
 * parecidas (`c:0:0` y `c:0:1`) den secuencias que no se parezcan, y eso lo
 * garantiza la avalancha de FNV-1a en la semilla, no el generador.
 */
export function mulberry32(semilla: number): DiosRng {
  let a = semilla | 0
  const f = (): number => {
    a = (a + 0x6d2b79f5) | 0
    return valorMulberry(a)
  }
  return f as DiosRng
}

/**
 * La mezcla de mulberry32 sobre un estado ya avanzado.
 *
 * Está separada por una sola razón: **el dado del dios y el del mundo tienen que
 * ser el MISMO generador**, y la única forma de que no se separen es que la
 * cuenta esté escrita una vez. Copiada dos veces, cambiarle una constante a uno
 * y no al otro no rompe ningún test —los dos siguen dando números— y el día que
 * se note es cuando un guardado viejo no reproduce.
 */
function valorMulberry(a: number): number {
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * EL DADO DEL MUNDO, con su estado a la vista.
 *
 * `WorldRng` existía como tipo desde el Hito 3 y **no tenía fábrica**: la única
 * forma de conseguir uno era un `as WorldRng`, que hoy sólo aparece en tests. Un
 * tipo nominal sin constructor es una promesa que nadie puede cumplir sin hacer
 * trampa, así que la puerta es ésta.
 *
 * ─── Por qué el estado sale por una función y no es el objeto ───────────────
 *
 * Porque el estado del dado **tiene que poder vivir adentro del `WorldState`**, y
 * ahí no entra una clausura: `hashWorld` LANZA con una función, y un guardado
 * tiene que sobrevivir a `JSON.stringify`. Lo que viaja es el entero; la
 * clausura se arma al empezar el tick y se tira al terminarlo, y `estado()` es
 * lo que se guarda.
 *
 * Si el estado viviera afuera del mundo, el replay divergiría en la primera
 * tirada: el journal reconstruiría las intenciones pero no la suerte.
 */
export interface DadoDelMundo {
  /** La tirada. Es `WorldRng`, o sea que `tsc` no la deja pasar por dado del dios. */
  readonly tirar: WorldRng
  /** El estado actual, para guardarlo. Cambia con cada tirada. */
  estado(): number
}

/**
 * Un dado del mundo arrancado en `estado`. Misma aritmética que `mulberry32`
 * —no una segunda implementación: dos generadores que dicen ser el mismo
 * divergen— y por eso comparte el paso con él a través de `pasoMulberry`.
 */
export function dadoDelMundo(estado: number): DadoDelMundo {
  let a = estado | 0
  const tirar = (): number => {
    a = (a + 0x6d2b79f5) | 0
    return valorMulberry(a)
  }
  return { tirar: tirar as WorldRng, estado: () => a }
}

/**
 * El dado de una pregunta. **La función entera del nivel 1**: no hay estado, no
 * hay orden y no hay reloj. `rngFor(q, s)` hoy y `rngFor(q, s)` dentro de mil
 * ticks devuelven generadores que producen exactamente la misma secuencia.
 *
 * La semilla y la clave se separan con `|`, que está prohibido dentro de las
 * claves: sin el separador, la semilla 1 con la clave `2:x` y la semilla 12 con
 * la clave `:x` hashearían igual.
 */
export function rngFor(q: Question, seed: Seed): DiosRng {
  return mulberry32(fnv1a(`${String(seed)}|${keyOf(q)}`))
}

/**
 * Una semilla derivada, para separar DOMINIOS dentro de la misma partida.
 *
 * El documento la escribe como `seed ^ 0xA1n`, y esa forma tiene un problema
 * chico y real: mezcla solo los bits bajos, así que dos dominios con sales
 * parecidas comparten casi toda la semilla y sus campos de ruido quedan
 * correlacionados —la humedad y la fertilidad dibujarían el mismo mapa corrido—.
 * Acá la sal pasa por FNV-1a junto con la semilla entera, que es lo mismo que
 * cuesta y descorrelaciona de verdad.
 */
export function semillaDeDominio(seed: Seed, sal: string): number {
  return fnv1a(`${String(seed)}#${validarTexto(sal, 'sal de dominio')}`)
}

// ─── Sacar cosas del dado, sin perder la exactitud ──────────────────────────

/**
 * El rango más grande que se le puede pedir a `diosEntero` sin perder
 * exactitud. `r · span` con `r = k/2³²` y `k < 2³²` es exacto mientras
 * `span ≤ 2²¹`, porque `k · span < 2⁵³`. Arriba de eso el producto redondea y el
 * `Math.floor` puede caer del otro lado en un motor y no en otro.
 */
export const RANGO_MAXIMO = 1 << 21

/**
 * Un entero en `[lo, hi]`, los dos incluidos.
 *
 * **Lanza** si el rango es más grande que `RANGO_MAXIMO` en vez de dar un número
 * casi bien. Un sesgo de un valor en 2²¹ no se ve nunca; una divergencia entre
 * dos motores tampoco se ve, hasta que un guardado no carga.
 */
export function diosEntero(rng: DiosRng, lo: number, hi: number): number {
  if (!Number.isInteger(lo) || !Number.isInteger(hi)) {
    throw new RangeError(`rango no entero: [${String(lo)}, ${String(hi)}]`)
  }
  if (hi < lo) throw new RangeError(`rango dado vuelta: [${String(lo)}, ${String(hi)}]`)
  const span = hi - lo + 1
  if (span > RANGO_MAXIMO) {
    throw new RangeError(`rango de ${String(span)} valores, el techo exacto es ${String(RANGO_MAXIMO)}`)
  }
  return lo + Math.floor(rng() * span)
}

/** Un `Fixed` en [0, 1]. La forma en que el dios entrega una proporción. */
export function diosFixed(rng: DiosRng): Fixed {
  return fixedFromRaw(Math.floor(rng() * (FIXED_SCALE + 1)))
}

/**
 * Verdadero con probabilidad `porMil / 1000`. Nombre en milésimas y no en real
 * porque `0.3` no es representable en binario y `300` sí: dos formas de escribir
 * la misma probabilidad, una exacta y la otra no.
 */
export function diosOcurre(rng: DiosRng, porMil: number): boolean {
  const p = validarEntero(porMil, 'probabilidad en milésimas', 0, FIXED_SCALE)
  return Math.floor(rng() * FIXED_SCALE) < p
}

/**
 * Elige un elemento por peso. Los pesos son enteros positivos: con pesos reales
 * la suma acumulada dependería del orden de la suma en punto flotante, o sea que
 * reordenar la tabla —algo que parece cosmético— cambiaría el mundo.
 */
export function diosElegir<T>(rng: DiosRng, opciones: readonly { readonly peso: number; readonly qué: T }[]): T {
  if (opciones.length === 0) throw new RangeError('no hay opciones para elegir')
  let total = 0
  for (const o of opciones) total += validarEntero(o.peso, 'peso', 1, RANGO_MAXIMO)
  let corte = diosEntero(rng, 0, total - 1)
  for (const o of opciones) {
    corte -= o.peso
    if (corte < 0) return o.qué
  }
  // Inalcanzable: `corte < total` y los pesos suman `total`. Está para que el
  // tipo de retorno no necesite `| undefined` y para que, si alguna vez alguien
  // rompe la invariante, salga con nombre en vez de devolver `undefined`.
  throw new RangeError('la elección por peso no cerró: pesos inconsistentes')
}
