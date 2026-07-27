// ─── @anima/world/hash.ts ────────────────────────────────────────────────────
//
// EL HASH DEL MUNDO. Es la única afirmación que el Hito 2 hace sobre sí mismo:
// «dos mundos gemelos con 10⁵ intenciones producen el MISMO `hashWorld`». Si
// esta función miente —si dos estados iguales dan hashes distintos, o peor, si
// dos estados distintos dan el mismo— el juez no sirve, el legado no sirve y el
// replay no sirve. Todo lo demás del paquete se apoya acá.
//
// ─── Por qué serialización CANÓNICA y no `JSON.stringify` ────────────────────
//
// `JSON.stringify` recorre las claves en **orden de propiedad del objeto**, que
// para claves de texto es el orden de INSERCIÓN. Dos mundos que llegaron al
// mismo estado por caminos distintos —uno creó el cuerpo antes de calentarlo y
// el otro después— tienen las mismas claves en distinto orden y `JSON` los
// escribe distinto. El hash cambiaría sin que cambie el estado, y eso es un
// falso positivo de divergencia: el peor de los dos errores, porque el juez
// empieza a rechazar partidas idénticas y nadie encuentra por qué.
//
// Y hay una trampa peor: las claves que parecen enteros («0», «12») salen
// PRIMERO y en orden numérico, sin importar cuándo se insertaron. O sea que el
// orden de inserción ni siquiera es consistente consigo mismo. Por eso acá las
// claves se ORDENAN siempre, con `<` sobre unidades de código UTF-16 —que
// ECMAScript sí especifica bit a bit— y nunca con `localeCompare`, que depende
// del locale del sistema y está prohibido por la regla 2 de `ii/README.md`.
//
// ─── Por qué FNV-1a ─────────────────────────────────────────────────────────
//
// Porque es cuatro líneas, no tiene tablas, y sus dos operaciones —XOR y
// multiplicación de 32 bits— están especificadas EXACTAMENTE en ECMAScript vía
// `^` y `Math.imul`. `Math.imul` no es una optimización: es la única forma de
// multiplicar dos enteros de 32 bits en JS sin pasar por un double de 53 bits
// de mantisa, que desbordaría y redondearía distinto según el motor. Un hash
// que use `a * b` en vez de `Math.imul(a, b)` da resultados distintos en cuanto
// el producto pasa 2⁵³, y eso pasa en el primer byte.
//
// ─── Dos carriles, no uno ───────────────────────────────────────────────────
//
// Un FNV-1a de 32 bits daría una colisión ciega cada 4·10⁹ comparaciones. En
// una prueba de equivalencia eso es un FALSO NEGATIVO: dos mundos que YA
// divergieron se declaran iguales y el test pasa en verde. Con 20 partidas ×
// 20.000 ticks de verificación en el Hito 5 no es un riesgo teórico.
//
// Se corren dos FNV-1a sobre el mismo flujo de bytes, con offset y primo
// distintos, y el hash es la concatenación de los dos. Es honesto decir qué es
// y qué no es: NO es un hash criptográfico de 64 bits, y los dos carriles no
// son independientes en sentido estricto (leen el mismo flujo). Es una cota de
// colisión accidental muchísimo mejor que 2⁻³² para el uso que tiene —comparar
// estados de mundo, no resistir a un adversario— por un costo de un `imul` más
// por byte. Si alguna vez hace falta resistencia adversaria, se cambia acá y en
// ningún otro lado.
//
// ─── Endianness EXPLÍCITA ───────────────────────────────────────────────────
//
// `new Uint8Array(float64array.buffer)` devuelve los bytes en el orden del
// procesador. Todo lo que corre hoy es little-endian, pero la norma no lo
// promete y «funciona en todas las máquinas que probé» es exactamente la clase
// de suposición que hace divergir un replay dentro de dos años. Los números
// pasan por un `DataView` con `littleEndian = false` escrito a mano, así que el
// flujo de bytes es el mismo en cualquier procesador.
//
// ─── Lo que NO entra al hash, y por qué se lanza en vez de ignorar ──────────
//
// El catálogo de valores es una LISTA BLANCA: primitivos, objetos planos,
// arreglos, `Map`, `Set` y arreglos tipados. Todo lo demás lanza.
//
// La tentación era aceptar cualquier objeto y recorrer sus claves propias. Con
// eso, un `Date` —que no tiene claves propias enumerables— hashea igual que
// `{}`, y dos estados con fechas distintas dan el mismo hash EN SILENCIO. Un
// `RegExp`, igual. Una instancia de clase con todo su estado en el prototipo,
// igual. La lista blanca convierte ese silencio en un error con nombre, y el
// error aparece en el primer test que toque ese estado, no en el tick 400 de
// una partida de otro.

// ─── Lo que cuesta, MEDIDO ──────────────────────────────────────────────────
//
// Con Node 24 en la máquina del banco del Hito 0:
//
//   5000 cuerpos (id, forma, una parte con dos cualidades, estado)  7.5 ms
//   un campo `Int32Array` de 65 536 celdas                          0.31 ms
//
// La conclusión operativa, que es la razón por la que el número está escrito
// acá: **`hashWorld` NO se llama por tick.** El presupuesto del tick entero son
// 4 ms para 5000 cuerpos, y hashear el mundo sola ya cuesta casi el doble. El
// hash es para los checkpoints, los snapshots y el juez, que corren cada N ticks
// y fuera del tick. Un invariante por tick que quiera comparar hashes no puede
// usar éste; tiene que mirar lo que cambió.
//
// El camino de enteros va a 200 MB/s largos porque no pasa por el `DataView`:
// un chunk de terreno es casi gratis comparado con los cuerpos.

/**
 * El hash de un estado, como texto de 16 dígitos hexadecimales.
 *
 * Es un tipo NOMINAL, igual que `Fixed` y `Rate` en `@anima/physics` (ADR
 * II-0006): un `string` cualquiera no es un `WorldHash`. La marca no existe en
 * tiempo de ejecución —no cuesta un bit— y sirve para que un hash que vino de
 * un JSON sin validar no se pueda comparar contra uno calculado sin pasar antes
 * por `worldHashFromHex`.
 */
export type WorldHash = string & { readonly __worldHash: unique symbol }

// FNV-1a de 32 bits, carril A: los parámetros originales de Fowler-Noll-Vo.
const OFFSET_A = 0x811c9dc5 | 0
const PRIME_A = 0x01000193

// Carril B: otro offset y otro primo FNV conocido (709607). Distintos a
// propósito: dos carriles con los mismos parámetros serían el mismo carril
// escrito dos veces.
const OFFSET_B = 0x9dc5811c | 0
const PRIME_B = 0x000ad3e7

/**
 * Etiquetas de tipo. Sin ellas, `[1]`, `1` y `"1"` podrían compartir flujo de
 * bytes y colisionar por construcción, que es peor que colisionar por azar: es
 * una colisión REPRODUCIBLE, la que un adversario encuentra primero.
 */
const T_NULL = 0x01
const T_FALSE = 0x02
const T_TRUE = 0x03
const T_NUMBER = 0x04
const T_STRING = 0x05
const T_ARRAY = 0x06
const T_OBJECT = 0x07
const T_MAP = 0x08
const T_SET = 0x09
const T_TYPED = 0x0a

/**
 * Cota de profundidad. Un estado con un ciclo —un cuerpo que apunta a su
 * contenedor que apunta al cuerpo— haría que el recorrido no terminara nunca y
 * el worker del mundo se colgara sin mensaje. Con la cota, el ciclo sale como
 * error en el primer test que lo toque.
 *
 * 64 es cómodo: la estructura más profunda que el mundo tiene hoy es
 * mundo → chunk → celda → cuerpo → partes → vector de cualidades, seis niveles.
 */
const MAX_DEPTH = 64

/** Los dos acumuladores. Vive en un objeto y no en variables de módulo porque
 *  el recorrido es recursivo y `Set`/`Map` hashean sus elementos por separado:
 *  con estado de módulo, la llamada anidada pisaría a la de afuera. */
interface Lanes {
  a: number
  b: number
}

// Un solo buffer para convertir números a bytes. Es reentrante porque se usa y
// se consume dentro de la misma llamada sincrónica, sin ceder el control.
const scratch = new DataView(new ArrayBuffer(8))

function mixByte(l: Lanes, byte: number): void {
  l.a = Math.imul(l.a ^ byte, PRIME_A)
  l.b = Math.imul(l.b ^ byte, PRIME_B)
}

function mixU32(l: Lanes, v: number): void {
  mixByte(l, (v >>> 24) & 0xff)
  mixByte(l, (v >>> 16) & 0xff)
  mixByte(l, (v >>> 8) & 0xff)
  mixByte(l, v & 0xff)
}

function mixNumber(l: Lanes, v: number): void {
  if (!Number.isFinite(v)) {
    // `NaN` no tiene UNA representación: el estándar deja libres 2⁵¹ patrones de
    // bits y dos motores pueden producir patrones distintos para el mismo
    // cálculo. Hashearlo sería hashear ruido. Y de todos modos un `NaN` o un
    // `Infinity` en el estado del mundo es un error de física —`fixed.ts` satura
    // en vez de desbordar, justamente para que esto no pase—, así que el hash es
    // buen lugar para que salte.
    throw new RangeError(`número no finito en el estado: ${String(v)}`)
  }
  // `-0` y `0` son el mismo número para `===` pero tienen bits distintos. Si no
  // se normaliza, una resta que da cero negativo cambia el hash del mundo sin
  // cambiar el mundo.
  const n = v === 0 ? 0 : v
  scratch.setFloat64(0, n, false)
  for (let i = 0; i < 8; i++) mixByte(l, scratch.getUint8(i))
}

function mixString(l: Lanes, s: string): void {
  // El largo va adelante para que "ab" + "c" no comparta flujo con "a" + "bc".
  mixU32(l, s.length)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    mixByte(l, (c >>> 8) & 0xff)
    mixByte(l, c & 0xff)
  }
}

/** Orden por unidad de código UTF-16. `localeCompare` está prohibido: con
 *  locale turco «I» y «ı» se ordenan distinto y el mundo hashea distinto según
 *  la configuración del sistema operativo del jugador. */
function compareKeys(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0
}

function isPlainObject(v: object): boolean {
  const p = Object.getPrototypeOf(v) as object | null
  return p === Object.prototype || p === null
}

function walk(l: Lanes, v: unknown, depth: number): void {
  if (depth > MAX_DEPTH) {
    throw new RangeError(`estado demasiado profundo o con un ciclo (más de ${MAX_DEPTH} niveles)`)
  }

  if (v === null) {
    mixByte(l, T_NULL)
    return
  }

  switch (typeof v) {
    case 'boolean':
      mixByte(l, v ? T_TRUE : T_FALSE)
      return
    case 'number':
      mixByte(l, T_NUMBER)
      mixNumber(l, v)
      return
    case 'string':
      mixByte(l, T_STRING)
      mixString(l, v)
      return
    case 'undefined':
      // Adentro de un objeto, `undefined` se OMITE (ver más abajo). Suelto o
      // adentro de un arreglo no tiene representación honesta: `JSON.stringify`
      // lo convierte en `null` dentro de un arreglo, así que guardar el estado y
      // volver a cargarlo CAMBIARÍA el hash. Un hash que no sobrevive a un
      // guardado no sirve para el legado, que es la mitad del producto.
      throw new TypeError('`undefined` suelto o dentro de un arreglo no entra al hash')
    case 'bigint':
    case 'symbol':
    case 'function':
      throw new TypeError(`\`${typeof v}\` no entra al estado del mundo`)
  }

  // A partir de acá es un objeto. La lista blanca, en orden de frecuencia.
  const o = v as object

  if (Array.isArray(o)) {
    mixByte(l, T_ARRAY)
    mixU32(l, o.length)
    for (let i = 0; i < o.length; i++) walk(l, o[i], depth + 1)
    return
  }

  if (o instanceof Map) {
    mixMap(l, o as Map<unknown, unknown>, depth)
    return
  }

  if (o instanceof Set) {
    mixSet(l, o as Set<unknown>, depth)
    return
  }

  if (ArrayBuffer.isView(o)) {
    mixTyped(l, o)
    return
  }

  if (!isPlainObject(o)) {
    throw new TypeError(
      'al hash solo entran primitivos, objetos planos, arreglos, Map, Set y arreglos tipados; ' +
        `llegó una instancia de \`${o.constructor?.name ?? 'anónimo'}\``,
    )
  }

  const keys = Object.keys(o).sort(compareKeys)
  const rec = o as Record<string, unknown>

  // Cuántas claves entran de verdad: las de valor `undefined` se saltean, así
  // que el conteo se hace después de filtrarlas. Un `{ a: 1, b: undefined }`
  // tiene que hashear IGUAL que `{ a: 1 }` porque eso es lo que queda después de
  // guardar la partida en JSON y volver a cargarla. Si no fuera igual, cargar
  // una partida cambiaría su hash y el legado no cerraría nunca.
  let n = 0
  for (const k of keys) if (rec[k] !== undefined) n++

  mixByte(l, T_OBJECT)
  mixU32(l, n)
  for (const k of keys) {
    const val = rec[k]
    if (val === undefined) continue
    mixString(l, k)
    walk(l, val, depth + 1)
  }
}

function mixMap(l: Lanes, m: Map<unknown, unknown>, depth: number): void {
  mixByte(l, T_MAP)
  mixU32(l, m.size)

  // Camino rápido y camino general, y la rama la decide EL DATO, no quien
  // llama: un `Map` con todas las claves de texto siempre toma la primera, y no
  // puede ser igual a uno que toma la segunda. El camino rápido existe porque es
  // el caso real —los cuerpos indexados por id— y evita construir un hash
  // auxiliar por entrada sobre 5000 cuerpos.
  let allStrings = true
  for (const k of m.keys()) {
    if (typeof k !== 'string') {
      allStrings = false
      break
    }
  }

  if (allStrings) {
    const keys = [...(m.keys() as Iterable<string>)].sort(compareKeys)
    for (const k of keys) {
      mixString(l, k)
      walk(l, m.get(k), depth + 1)
    }
    return
  }

  // Claves que no son texto: no hay un orden natural, así que se ordena por el
  // hash de cada par. Es determinista y no depende del orden de inserción, que
  // es todo lo que se le pide.
  const digests: string[] = []
  for (const [k, val] of m) digests.push(digest([k, val], depth + 1))
  digests.sort(compareKeys)
  for (const d of digests) mixString(l, d)
}

function mixSet(l: Lanes, s: Set<unknown>, depth: number): void {
  mixByte(l, T_SET)
  mixU32(l, s.size)
  // Un conjunto no tiene orden. Si se recorriera en orden de inserción, dos
  // conjuntos con los mismos elementos hashearían distinto — y agregar y sacar
  // el mismo elemento cambiaría el hash del mundo. Se ordena por el hash de cada
  // elemento, que es el único orden que no depende de la historia.
  //
  // La profundidad se ARRASTRA a la sub-llamada. Si se reiniciara en cero, un
  // ciclo que pasa por un `Set` esquivaría la cota de `MAX_DEPTH` y en vez de un
  // error con nombre habría un desborde de pila.
  const digests: string[] = []
  for (const e of s) digests.push(digest(e, depth + 1))
  digests.sort(compareKeys)
  for (const d of digests) mixString(l, d)
}

/**
 * Los arreglos tipados que el mundo usa para los campos de terreno. Cada clase
 * lleva su propia etiqueta: un `Int32Array` y un `Float64Array` con los mismos
 * valores son estados distintos y tienen que hashear distinto.
 *
 * Se distingue con `instanceof` y no con `constructor.name` porque un empacador
 * puede renombrar clases, y un hash que dependa del empacador ya no es el mismo
 * hash entre el navegador y Node —que es justo la comparación que el criterio
 * del Hito 2 pide.
 */
function mixTyped(l: Lanes, o: ArrayBufferView): void {
  mixByte(l, T_TYPED)

  if (o instanceof Float64Array || o instanceof Float32Array) {
    mixByte(l, o instanceof Float64Array ? 9 : 8)
    mixU32(l, o.length)
    // Flotantes: por `DataView` explícito, igual que cualquier otro número.
    for (let i = 0; i < o.length; i++) mixNumber(l, o[i] as number)
    return
  }

  // Enteros: se mezclan por desplazamientos, sin `DataView`, y por eso NO
  // dependen del endianness del procesador. Es el camino caliente —un chunk de
  // terreno son miles de enteros— y ahorrarse los ocho `getUint8` por elemento
  // del camino de flotantes se nota.
  let tag = 0
  if (o instanceof Int8Array) tag = 1
  else if (o instanceof Uint8ClampedArray) tag = 3
  else if (o instanceof Uint8Array) tag = 2
  else if (o instanceof Int16Array) tag = 4
  else if (o instanceof Uint16Array) tag = 5
  else if (o instanceof Int32Array) tag = 6
  else if (o instanceof Uint32Array) tag = 7
  else {
    // `DataView`, `BigInt64Array` y compañía. El terreno no los usa y no hay una
    // representación obvia; mejor un error que una elección silenciosa.
    throw new TypeError(`arreglo tipado no soportado: ${String(o.constructor?.name)}`)
  }

  mixByte(l, tag)
  const arr = o as Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array
  mixU32(l, arr.length)
  for (let i = 0; i < arr.length; i++) mixU32(l, (arr[i] as number) | 0)
}

function toHex8(v: number): string {
  return (v >>> 0).toString(16).padStart(8, '0')
}

/** El recorrido completo con una profundidad de arranque dada. `hashWorld`
 *  arranca en 0; `Map` y `Set` lo llaman con la profundidad que traían para que
 *  la cota contra ciclos siga valiendo dentro de ellos. */
function digest(v: unknown, depth: number): string {
  const l: Lanes = { a: OFFSET_A, b: OFFSET_B }
  walk(l, v, depth)
  return toHex8(l.a) + toHex8(l.b)
}

/**
 * El hash del estado entero. La función que sostiene el criterio del Hito 2.
 *
 * Es PURA y no toca el reloj, el azar, el locale ni `Math` trascendente. Dos
 * llamadas con estados estructuralmente iguales dan el mismo texto en cualquier
 * motor de JS y en cualquier procesador.
 *
 * Lanza —a propósito, y fuerte— ante lo que no puede hashear de forma canónica:
 * números no finitos, `undefined` fuera de una propiedad de objeto, `bigint`,
 * símbolos, funciones e instancias de clase. Un hash que se traga lo que no
 * entiende no es un hash: es una fuente de falsos «son iguales».
 */
export function hashWorld(state: unknown): WorldHash {
  return digest(state, 0) as WorldHash
}

/** El hash de un mundo vacío. Sirve como semilla de cadenas y como valor
 *  esperado en los tests de arranque. */
export const HASH_VACIO: WorldHash = hashWorld(null)

/**
 * La ÚNICA puerta desde un texto pelado hacia un `WorldHash`, igual que
 * `fixedFromRaw` en `@anima/physics`.
 *
 * Existe porque los hashes vuelven del disco: un journal guardado, un
 * checkpoint de una partida vieja, el sello de una habilidad juzgada. Sin esta
 * puerta cada llamador escribe su propio `as WorldHash` y el invariante «un
 * `WorldHash` son 16 hexadecimales en minúscula» deja de valer justo para lo que
 * viene de afuera, que es lo único de lo que no nos podemos fiar.
 */
export function worldHashFromHex(s: string): WorldHash {
  if (s.length !== 16) throw new RangeError(`hash de largo ${s.length}, se esperaban 16: ${s}`)
  for (let i = 0; i < 16; i++) {
    const c = s.charCodeAt(i)
    const ok = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) // 0-9, a-f
    if (!ok) throw new RangeError(`hash con carácter inválido en ${i}: ${s}`)
  }
  return s as WorldHash
}
