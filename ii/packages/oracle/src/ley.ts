// ─── @anima/oracle/ley.ts ────────────────────────────────────────────────────
//
// EL NIVEL 1 DEL DIOS: LA LEY. Contesta el 99% de las preguntas en ~0 ms, es
// pura, y no espera a nadie.
//
// ─── Qué quiere decir «perezoso» y qué NO quiere decir ──────────────────────
//
// Perezoso quiere decir que un chunk se decide la primera vez que alguien mira,
// y NO que se decide «cuando hay tiempo libre». Una de las propuestas que el
// documento desarma pre-decretaba regiones en el tiempo ocioso entre ticks y las
// dejaba reponiendo por tick: con eso, la población de un río depende del reloj
// de pared y de si el Taller estaba compilando. Misma semilla, mismas órdenes,
// dos mundos distintos.
//
// Acá `resolveChunk` es una FUNCIÓN de `(seed, cx, cy)`. Llamarla en el tick 40,
// en el 398 o dos veces seguidas da lo mismo, bit a bit, porque no hay ningún
// estado que se pueda haber movido entre medio. Ésa es la regla madre, y la
// forma de protegerla es no tener nada que proteger: **idempotente por
// construcción, no por memoria**.
//
// El corolario operativo, que el documento manda escribir en el CLAUDE.md:
// ningún trabajo de tiempo ocioso puede escribir estado que entre en
// `hashWorld`. Pre-decretar el anillo de chunks vecinos es seguro justamente
// porque el resultado no depende de cuándo se hizo.
//
// ─── Y la reposición, que es el mismo problema con otra ropa ────────────────
//
// Un stock que se repone «un poco por tick» es un estado que avanza con el
// reloj. Si el chunk se materializa en el tick 398, ¿corrió la reposición de los
// 398 ticks anteriores? Si la corriste, pagaste 398 iteraciones; si no, el río
// está vacío según cuándo lo miraste. Las dos respuestas son malas.
//
// La reposición se INTEGRA: `population` es una función cerrada del tiempo, sin
// bucle y sin historia. Y desde el ADR II-0008 el tiempo del mundo se mide en
// SEGUNDOS, no en ticks, así que la tasa es por segundo: un río se repone al
// mismo ritmo a 10 Hz que a 100 Hz. Con la tasa por tick, cambiar la frecuencia
// para que el juego corriera mejor habría cambiado cuánto pescado hay.

import {
  FIXED_ONE,
  FIXED_SCALE,
  MICROS_POR_SEGUNDO,
  fixedFromRaw,
  fx,
  type Duracion,
  type Fixed,
  type SubstanceId,
} from '@anima/physics'

import {
  biomaPorClima,
  caloricBudget,
  OCTAVAS_TERRENO,
  temperaturaDelBioma,
  valueNoise,
  type Bioma,
  type Clima,
} from './bioma.js'
import { diosElegir, diosEntero, rngFor, type DiosRng, type Seed, type StockId } from './pregunta.js'

// ─── La geometría del chunk ─────────────────────────────────────────────────

/**
 * 16×16 celdas, el mismo chunk de `@anima/world`.
 *
 * **Está escrito acá y no importado a propósito, y es una deuda declarada.** El
 * oráculo no puede depender de `@anima/world`: el mundo lo llama a él (ver el
 * diagrama del documento) y la flecha en los dos sentidos sería un ciclo de
 * paquetes. La alternativa era un paquete «geometría» compartido, que es la
 * clase de dependencia que en tres meses tiene adentro la mitad del juego.
 *
 * Lo que hace que la duplicación no sea una bomba es que el ORDEN también está
 * fijado —por filas, `i = ly · 16 + lx`, igual que `localIndex` de `cell.ts`— y
 * que quien pegue los dos paquetes tiene que verificar que coinciden. Si algún
 * día no coinciden, el síntoma es feo: las cosas sueltas aparecen en la celda
 * espejada y nada falla.
 */
export const CELDAS_DE_LADO = 16
export const CELDAS_POR_CHUNK = CELDAS_DE_LADO * CELDAS_DE_LADO

/** El índice local de una celda dentro del chunk. Orden por filas. */
export function indiceLocal(lx: number, ly: number): number {
  return ly * CELDAS_DE_LADO + lx
}

/**
 * Una celda cuenta como AGUA FRANCA a partir de acá. No es una constante suelta:
 * `terrainFor` escribe exactamente `FIXED_ONE` en las celdas de agua y como
 * mucho `humedadDeCeldaSeca` (0,6 en el pantano, el máximo de la tabla) en las
 * demás, así que el umbral está lejos de los dos lados. El union-find de cuerpos
 * de agua lo usa para decidir qué celdas conecta.
 */
export const UMBRAL_DE_AGUA: Fixed = fx(0.9)

// ─── Lo que el dios contesta sobre un chunk ─────────────────────────────────

/** El terreno decretado. Arreglos de `Fixed`, igual que los campos del chunk del
 *  mundo, para que copiarlo sea copiar y no convertir. */
export interface Terreno {
  readonly lado: number
  /** `wet` por celda, en orden por filas. `FIXED_ONE` es agua franca. */
  readonly wet: Int32Array
  /** `cover` por celda: lo que el follaje tapa, que es la entrada de la ley 12. */
  readonly cover: Int32Array
  /** La temperatura ambiente del chunk, en °C. Es del chunk y no de la celda:
   *  el clima no cambia entre dos celdas vecinas, y guardarlo 256 veces sería
   *  guardar 256 veces el mismo número. */
  readonly temperatura: number
  /** El oxígeno del aire libre del chunk. */
  readonly oxigeno: Fixed
}

/** Algo tirado en el suelo, esperando que alguien lo levante. */
export interface Suelta {
  readonly substance: SubstanceId
  /** Índice local dentro del chunk, orden por filas. */
  readonly i: number
  /** Masa en kilos, como `Fixed`. */
  readonly masa: Fixed
}

/**
 * Todo lo que el dios decide de un chunk, de una sola vez.
 *
 * Sale ENTERO y no campo por campo porque las partes no son independientes: el
 * agua sale del bioma, el bioma de la altura y la humedad, lo suelto de la
 * fertilidad y del bioma. Contestar «¿qué bioma es?» sin contestar el resto
 * dejaría media decisión tomada y la otra media colgando de una segunda llamada
 * que podría venir en otro tick — que es exactamente la ventana por la que se
 * cuela una contradicción.
 */
export interface ChunkFacts {
  readonly cx: number
  readonly cy: number
  readonly clima: Clima
  readonly bioma: Bioma
  readonly terreno: Terreno
  /** De qué está hecho el lugar. Es la lista del bioma, expuesta acá para que
   *  quien planifique no tenga que conocer la tabla de biomas. */
  readonly sustancias: readonly SubstanceId[]
  readonly sueltas: readonly Suelta[]
  /** El techo de lo que este chunk puede aportar, jamás. Función pura de la
   *  semilla: ningún sorteo, ninguna propuesta del oráculo lo mueve. */
  readonly presupuestoCalorico: number
}

// ─── Los tres campos de clima ───────────────────────────────────────────────

/**
 * Las tres sales de dominio. Están acá arriba, con nombre, porque son parte del
 * formato: cambiar una sal cambia TODOS los mapas de TODAS las partidas
 * guardadas. Es tan de guardado como el formato de la clave.
 *
 * El documento las escribe como `seed ^ 0xA1n`; acá pasan por
 * `semillaDeDominio`, que mezcla la semilla entera en vez de solo sus bits bajos
 * (ver el porqué en `pregunta.ts`). Lo que importa es que sean TRES distintas:
 * con una sola, la humedad y la fertilidad serían el mismo mapa y no habría
 * bosque húmedo ni estepa fértil, solo una diagonal.
 */
const SAL_HUMEDAD = 0xa1n
const SAL_FERTILIDAD = 0xb2n
const SAL_ALTURA = 0xc3n
const SAL_AGUA = 0xd4n

/**
 * El clima de un chunk. Público porque el pre-decreto del anillo de vecinos y el
 * render del mapa lo quieren sin pagar el chunk entero, y porque es lo que hace
 * verificable que el campo sea CONTINUO: dos chunks vecinos tienen climas
 * parecidos, y de eso hay test.
 */
export function climaDe(seed: Seed, cx: number, cy: number): Clima {
  return {
    humedad: valueNoise(seed ^ SAL_HUMEDAD, cx, cy),
    fertilidad: valueNoise(seed ^ SAL_FERTILIDAD, cx, cy),
    altura: valueNoise(seed ^ SAL_ALTURA, cx, cy),
  }
}

// ─── El terreno ─────────────────────────────────────────────────────────────

/**
 * El umbral de agua de ESTE chunk: el del bioma, corrido por el clima.
 *
 * ─── Por qué el bioma solo no alcanza ───────────────────────────────────────
 *
 * El campo de agua se muestrea en coordenadas de celda y no sabe nada de la
 * humedad ni de la altura; el bioma sí. Con el umbral fijo del bioma, un chunk
 * que apenas calificó como pantano y uno empapado tenían la misma agua, y —
 * medido— el 44% de los chunks acuáticos quedaba sin una sola celda mojada.
 *
 * Acá el mismo clima que decidió que es agua empuja el nivel: más húmedo y más
 * bajo, más agua. El ajuste es entero y simétrico (media de los dos
 * apartamientos), así que no hay una sola división que redondee distinto en dos
 * motores.
 *
 * Los topes de 20 y 960 existen para que el nivel nunca sea «todo» ni «nada» por
 * accidente: un chunk enteramente bajo el agua no tiene dónde pararse, y uno con
 * el nivel en cero deja de ser acuático sin que el bioma se entere.
 */
export function nivelDeAgua(b: Bioma, clima: Clima): number {
  if (b.nivelDeAguaPorMil === 0) return 0
  const ajuste = Math.floor((clima.humedad - FIXED_SCALE / 2 + (FIXED_SCALE / 2 - clima.altura)) / 2)
  const v = b.nivelDeAguaPorMil + ajuste
  return v < 20 ? 20 : v > 960 ? 960 : v
}

/**
 * El campo de agua crudo en una celda del mundo, en coordenadas ABSOLUTAS.
 *
 * Es lo que `terrainFor` muestrea para cada celda, expuesto acá para que haya
 * UNA sola forma de preguntar por el agua de una celda. La usa el decreto para
 * mirar del otro lado del borde de un chunk —la orilla de un lago es casi
 * siempre una frontera entre dos chunks— y sin ella ese chequeo sería una
 * segunda copia de esta línea, que es exactamente como divergen dos
 * implementaciones de la misma cuenta.
 */
export function alturaDeAgua(seed: Seed, x: number, y: number): Fixed {
  return valueNoise(seed ^ SAL_AGUA, x, y, OCTAVAS_TERRENO)
}

/** Si esa altura de campo, con ese nivel, es agua franca. Un nivel en cero es un
 *  bioma sin una gota, y ahí no hay altura que valga. */
export function hayAguaFranca(nivel: number, altura: Fixed): boolean {
  return nivel > 0 && altura < nivel
}

/** El nivel de agua del chunk `(cx, cy)`, sin decretar el chunk entero. Dos
 *  llamadas a ruido y una tabla: es lo que hace barato mirar al vecino. */
export function nivelDeAguaDeChunk(seed: Seed, cx: number, cy: number): number {
  const clima = climaDe(seed, cx, cy)
  return nivelDeAgua(biomaPorClima(clima), clima)
}

/** Cuánto puede apartarse el `cover` de una celda del valor base del bioma, en
 *  milésimas. Poco: es textura, no otra decisión. Si fuera mucho, el follaje
 *  sería ruido y taparse dejaría de ser una técnica para ser una lotería. */
const JITTER_DE_COBERTURA = 60

/**
 * El terreno del chunk: el agua celda por celda y lo que tapa el follaje.
 *
 * ─── Por qué el agua NO sale del dado del chunk ─────────────────────────────
 *
 * El dado de `resolveChunk` está sembrado con `c:cx:cy`, así que dos chunks
 * vecinos sortean por separado. Si el agua saliera de ahí, un río se cortaría en
 * seco en cada borde de chunk y la componente conexa del union-find sería «un
 * charco por chunk» — justo lo que el documento no quiere («no puede haber
 * pescado en un tile y ninguno en el de al lado»).
 *
 * El agua sale de un campo de ruido muestreado en coordenadas de CELDA, que no
 * sabe dónde están los bordes de los chunks. La única discontinuidad que queda
 * es la del umbral, que cambia con el bioma: el agua se corta donde se corta el
 * bioma, que es donde tiene sentido que se corte.
 *
 * El dado sí se usa para el `cover`, que es textura local y no tiene por qué ser
 * continuo entre chunks.
 */
export function terrainFor(
  seed: Seed,
  bioma: Bioma,
  clima: Clima,
  cx: number,
  cy: number,
  rng: DiosRng,
): Terreno {
  const wet = new Int32Array(CELDAS_POR_CHUNK)
  const cover = new Int32Array(CELDAS_POR_CHUNK)
  const base = bioma.coberturaBase
  const nivel = nivelDeAgua(bioma, clima)
  // La celda más baja del chunk según el campo de agua, con su empate resuelto
  // por índice. Es lo que sostiene la garantía de más abajo.
  let masBaja = 0
  let valorMasBajo = Number.POSITIVE_INFINITY
  let conAgua = 0
  for (let ly = 0; ly < CELDAS_DE_LADO; ly++) {
    for (let lx = 0; lx < CELDAS_DE_LADO; lx++) {
      const i = indiceLocal(lx, ly)
      const x = cx * CELDAS_DE_LADO + lx
      const y = cy * CELDAS_DE_LADO + ly
      const v = alturaDeAgua(seed, x, y)
      if (v < valorMasBajo) {
        valorMasBajo = v
        masBaja = i
      }
      const hayAgua = hayAguaFranca(nivel, v)
      if (hayAgua) conAgua++
      wet[i] = hayAgua ? FIXED_ONE : bioma.humedadDeCeldaSeca
      // El jitter se sortea SIEMPRE, con agua o sin ella: si se salteara en las
      // celdas mojadas, la cantidad de tiradas dependería del agua y el `cover`
      // del resto del chunk cambiaría al mover el nivel del río. El orden de
      // consumo del dado es parte del formato.
      const j = diosEntero(rng, -JITTER_DE_COBERTURA, JITTER_DE_COBERTURA)
      const c = base + j
      cover[i] = c < 0 ? 0 : c > FIXED_ONE ? FIXED_ONE : c
    }
  }
  // ─── El charco garantizado ────────────────────────────────────────────────
  //
  // Un chunk de bioma acuático SIN una sola celda de agua es una contradicción
  // que se paga lejos de acá: la regla de resolubilidad se activa por
  // `bioma.acuatico` y buscaría insumos para pescar en un pantano seco, y el
  // union-find no encontraría componente que nombrar. Medido antes de esta
  // línea, pasaba en el 44% de los chunks acuáticos — el campo de agua no sabía
  // nada del clima que había decidido el bioma.
  //
  // El acople con el clima (`nivelDeAgua`) arregla el grueso; esto cierra la
  // cola: si aun así no quedó nada, se inunda la celda MÁS BAJA del chunk, que
  // es adonde el agua iría. Un charco de una celda en un pantano es un charco,
  // no un parche. Es una restricción del generador, no una plegaria, y es
  // determinista: no consume dado y el empate lo resuelve el índice.
  if (bioma.acuatico && conAgua === 0) wet[masBaja] = FIXED_ONE
  return {
    lado: CELDAS_DE_LADO,
    wet,
    cover,
    temperatura: temperaturaDelBioma(bioma),
    // El aire libre tiene oxígeno pleno; lo que lo baja es la oclusión de la ley
    // 12, que es un acumulado del mundo y no una decisión del dios.
    oxigeno: FIXED_ONE,
  }
}

/** Verdadero si esa celda del chunk tiene agua franca. */
export function tieneAgua(t: Terreno, i: number): boolean {
  const v = t.wet[i]
  if (v === undefined) throw new RangeError(`índice de celda fuera del chunk: ${String(i)}`)
  return v >= UMBRAL_DE_AGUA
}

// ─── Lo que hay tirado ──────────────────────────────────────────────────────

/**
 * Lo suelto del chunk. La fertilidad decide CUÁNTO y el bioma decide QUÉ.
 *
 * Nada cae en el agua: una rama flotando sería un caso especial —¿se hunde?,
 * ¿se moja?, ¿se va con la corriente?— y el mundo no tiene corriente. Es una
 * decisión de generador, no una ley: si mañana hay materia flotante, se cambia
 * acá y en ningún otro lado.
 */
export function scatter(bioma: Bioma, fertilidad: Fixed, terreno: Terreno, rng: DiosRng): readonly Suelta[] {
  if (bioma.siembra.length === 0) return []

  // Las celdas secas, en orden por filas: el orden canónico del chunk. Se arma
  // una vez y se elige por índice, en vez de sortear una celda y reintentar si
  // salió mojada — el reintento haría que la cantidad de tiradas dependiera del
  // agua, y mover el nivel del río movería todo lo demás.
  const secas: number[] = []
  for (let i = 0; i < CELDAS_POR_CHUNK; i++) if (!tieneAgua(terreno, i)) secas.push(i)
  if (secas.length === 0) return []

  const cuantas = bioma.sueltasBase + Math.floor((bioma.sueltasPorFertilidad * fertilidad) / FIXED_SCALE)
  const opciones = bioma.siembra.map((s) => ({ peso: s.peso, qué: s }))
  const out: Suelta[] = []
  for (let n = 0; n < cuantas; n++) {
    const qué = diosElegir(rng, opciones)
    const donde = secas[diosEntero(rng, 0, secas.length - 1)]
    if (donde === undefined) throw new RangeError('celda seca fuera de rango')
    // La masa se sortea en las MILÉSIMAS del `Fixed`, que son enteras: sortear
    // un real y redondearlo daría un valor distinto según cómo redondee el
    // motor, y `Fixed` existe justamente para que eso no pase.
    const masa = fixedFromRaw(diosEntero(rng, qué.masaMinima, qué.masaMaxima))
    out.push({ substance: qué.substance, i: donde, masa })
  }
  return out
}

// ─── La respuesta entera ────────────────────────────────────────────────────

/**
 * QUÉ HAY EN ESTE CHUNK. La función del nivel 1, y la que sostiene el criterio
 * del Hito 3: «el mismo mundo explorado en dos órdenes y con dos historias
 * distintas entre medio produce el mismo hash».
 *
 * Es pura y no toca nada de afuera: ni reloj, ni azar del sistema, ni locale, ni
 * `Math` trascendente. Lo único que entra es `(seed, cx, cy)` y lo único que
 * sale es la respuesta.
 *
 * **No memoiza**, y eso es a propósito. Una caché acá sería una segunda fuente de
 * verdad que hay que invalidar, y el día que se invalide mal el mundo se
 * contradice sin que nadie lo note. Quien quiera caché que la ponga en el ledger,
 * que ya existe para eso y además lleva el compromiso.
 */
export function resolveChunk(seed: Seed, cx: number, cy: number): ChunkFacts {
  // El dado se deriva de la PREGUNTA. Que pase por `rngFor` y no por un
  // `mulberry32` armado a mano acá es lo que garantiza que el chunk y cualquier
  // otra pregunta sobre el mismo chunk compartan la misma derivación.
  const rng = rngFor({ k: 'chunk', cx, cy }, seed)
  const clima = climaDe(seed, cx, cy)
  const bioma = biomaPorClima(clima)
  const terreno = terrainFor(seed, bioma, clima, cx, cy, rng)
  const sueltas = scatter(bioma, clima.fertilidad, terreno, rng)
  return {
    cx,
    cy,
    clima,
    bioma,
    terreno,
    sustancias: bioma.sustancias,
    sueltas,
    presupuestoCalorico: caloricBudget(bioma, clima.fertilidad),
  }
}

// ─── Los stocks, con integración perezosa ───────────────────────────────────

/** Techo de una población. Con la cota, `capacidad · 10⁹` sigue siendo exacto en
 *  un double y ninguna cuenta de `population` puede desbordar. */
export const CAPACIDAD_MAXIMA = 1_000_000

/** Techo de la tasa: mil individuos por segundo es absurdo y sirve de cota. */
export const PER_MILLE_MAXIMO = 1_000_000

/**
 * El horizonte del mundo, en segundos. 10⁹ segundos son 31 años de tiempo de
 * juego: de sobra, y deja `t · 10⁶` cómodamente por debajo de 2⁵³, que es lo que
 * hace exacta la conversión a microsegundos.
 */
export const SEGUNDOS_MAXIMOS = 1_000_000_000

/**
 * Una población extraíble.
 *
 * `amount` y `atSecond` son mutables y van juntos: son UNA marca —«tenía tanto en
 * tal momento»— y moverlos por separado es corromper el stock. Todo lo demás es
 * `readonly` porque es decreto: la capacidad y la tasa las fijó el dios cuando
 * decretó el cuerpo de agua, y no se negocian después.
 */
export interface Stock {
  readonly id: StockId
  readonly yields: SubstanceId
  readonly capacity: number
  /** Milésimas de individuo por SEGUNDO de mundo (ADR II-0008). Por segundo y no
   *  por tick: con la tasa por tick, bajar la frecuencia para que el juego
   *  corriera mejor habría hecho que el río se repusiera más lento. */
  readonly perMillePorSegundo: number
  /** Cuánto alcance hace falta para llegar. Lo lee la extracción, no esto. */
  readonly depth: Fixed
  atSecond: Duracion
  amount: number
}

/** La única puerta para fabricar un stock: valida los rangos de los que depende
 *  la exactitud de `population`. Sin ella, cada llamador se inventaría su propio
 *  objeto y las cotas serían un comentario. */
export function crearStock(s: Stock): Stock {
  if (!Number.isInteger(s.capacity) || s.capacity < 0 || s.capacity > CAPACIDAD_MAXIMA) {
    throw new RangeError(`capacidad inválida: ${String(s.capacity)}`)
  }
  if (!Number.isInteger(s.amount) || s.amount < 0 || s.amount > s.capacity) {
    throw new RangeError(`cantidad inválida: ${String(s.amount)} sobre una capacidad de ${String(s.capacity)}`)
  }
  if (!Number.isInteger(s.perMillePorSegundo) || s.perMillePorSegundo < 0 || s.perMillePorSegundo > PER_MILLE_MAXIMO) {
    throw new RangeError(`tasa de reposición inválida: ${String(s.perMillePorSegundo)}`)
  }
  microsDe(s.atSecond)
  return s
}

function microsDe(t: Duracion): number {
  if (!Number.isFinite(t) || t < 0 || t > SEGUNDOS_MAXIMOS) {
    throw new RangeError(`segundo de mundo fuera de rango [0, ${String(SEGUNDOS_MAXIMOS)}]: ${String(t)}`)
  }
  // El tiempo del mundo es múltiplo de 10⁻⁶ por construcción (`sumarPaso` suma en
  // microsegundos enteros), así que este redondeo es una identidad. Está para que
  // un `Duracion` que vino de afuera —de un guardado, de un test— no arrastre
  // basura de punto flotante a una cuenta que tiene que ser exacta.
  return Math.round(t * MICROS_POR_SEGUNDO)
}

/**
 * CUÁNTOS HAY en el segundo `t`. La reposición, integrada de una.
 *
 * Materializar el chunk en el segundo 2 o en el 20 000 da **exactamente lo
 * mismo**: no hay bucle, no hay acumulador y no hay historia. Es la regla madre
 * aplicada al único estado que el dios sí lleva.
 *
 * ─── Por qué se acota el tiempo antes de multiplicar ────────────────────────
 *
 * `perMille · microsegundos` con un mundo viejo pasa de 2⁵³ y el producto deja de
 * ser exacto: el resultado quedaría a merced del redondeo del motor, que es la
 * definición de divergencia. Como el resultado está topeado por la capacidad de
 * todos modos, el tiempo se recorta primero a lo que hace falta para llenar el
 * stock. Es la misma cuenta con los mismos números, sin ningún producto grande.
 *
 * Y NO se repone hacia atrás: preguntar por un instante anterior a la marca
 * devuelve lo que había, sin restar. Restar sería inventar una historia que el
 * stock no tiene, y el estado del mundo no viaja al pasado — lo que viaja es el
 * replay, que reconstruye la marca desde el principio.
 */
export function population(s: Stock, t: Duracion): number {
  const micros = microsDe(t) - microsDe(s.atSecond)
  const falta = s.capacity - s.amount
  if (micros <= 0 || falta <= 0 || s.perMillePorSegundo === 0) {
    return s.amount < s.capacity ? s.amount : s.capacity
  }
  // Los microsegundos que harían falta para llenarlo. Con `falta ≤ 10⁶`, esto es
  // a lo sumo 10¹⁵ y sigue siendo exacto.
  const paraLlenar = Math.ceil((falta * 1_000_000_000) / s.perMillePorSegundo)
  const usados = micros < paraLlenar ? micros : paraLlenar
  const crecido = s.amount + Math.floor((s.perMillePorSegundo * usados) / 1_000_000_000)
  return crecido < s.capacity ? crecido : s.capacity
}

/**
 * Saca uno y deja la marca al día. **No tira ningún dado**: si esta vez picó lo
 * decide el mundo con SU dado, porque es una acción y las acciones corren la
 * partida. Acá está solamente la contabilidad, que es del dios.
 *
 * Devuelve `null` si no había nada. Y la marca se re-ancla en `t` SIEMPRE que se
 * saque algo: sin re-anclar, la reposición se seguiría contando desde la marca
 * vieja y el río daría más de lo que puede.
 */
export function retirarUno(s: Stock, t: Duracion): SubstanceId | null {
  const pob = population(s, t)
  if (pob <= 0) return null
  s.amount = pob - 1
  s.atSecond = t
  return s.yields
}
