// ─── @anima/oracle/resolubilidad.ts ──────────────────────────────────────────
//
// QUE EL MUNDO DECRETADO POR RUIDO SE PUEDA JUGAR.
//
// Un mundo hecho de ruido de valor puede poner un río hermoso en un chunk donde
// no hay con qué armar la caña. Y el fallo sería SILENCIOSO, que es lo que lo
// hace grave: `admit()` no falla —el proceso está perfectamente bien escrito—,
// el mundo no tira ningún error, y lo único que pasa es que `extraccion` nunca
// encuentra un cuerpo que llene el rol `gear`. La criatura queda tanteando para
// siempre al lado del agua y nadie sabe por qué.
//
// El requisito del usuario dice literalmente «con la materia prima que hay EN EL
// LUGAR». Esto es esa frase hecha código: al decretar un chunk con bioma
// acuático se GARANTIZA co-presencia, en radio 2, de al menos un insumo por rol
// de cada proceso núcleo que establezca `holding(tag:carnoso)`.
//
// Es una restricción del GENERADOR, no una plegaria. El generador no reza para
// que el ruido haya sido amable: mira lo que quedó, y si falta algo, lo pone.
//
// ─── Por qué la resolubilidad se JUZGA con la física, no con una tabla ──────
//
// La tentación era escribir «si el bioma es acuático, sembrar una vara y una
// liana». Eso es una receta con otro nombre, y se pudre igual que todas: el día
// que `catch` cambie de fórmula, o que aparezca una sustancia flexible nueva, la
// tabla sigue diciendo «liana» y nadie se entera de que la garantía dejó de
// garantizar.
//
// Acá la pregunta «¿esto llena el rol?» la contesta `cumpleRol` de
// `@anima/physics` —la MISMA función con la que el mundo va a juzgar a la
// criatura cuando intente pescar— sobre los cuerpos que se pueden ARMAR con lo
// que hay, usando `unir` de la física. Si la caña deja de servir para pescar,
// este archivo se entera en el mismo tick que el mundo.
//
// Por eso `ensureSolvable` pide una `Physics` que el documento no le pasaba: la
// alternativa era reimplementar el juicio de rol acá, y dos implementaciones de
// la misma cuenta divergen. Ya pasó en este repo con `capacidadTermica`.
//
// ─── Determinismo ───────────────────────────────────────────────────────────
//
// Acá no hay `Math.random`, `Date`, `performance`, `Intl`, `localeCompare` ni
// `Math` trascendente. El único azar es el DADO DEL DIOS (`DiosRng`), que sale
// de la pregunta y de la semilla: decretar el mismo chunk dos veces siembra
// exactamente lo mismo. Y el dado del MUNDO no entra a este archivo ni por tipo
// —`WorldRng` no se importa—: sembrar un chunk no puede correrle la suerte a la
// partida.

import type { Body, Fixed, FormId, Physics, Process, ProcessId, Role, SubstanceId } from '@anima/physics'
import { cumpleRol, isOptionalRole, unfx, unir } from '@anima/physics'

import { FLEXIBILIDAD_DE_ATADURA, RIGIDEZ_DE_VARA } from './bioma.js'
import type { DiosRng } from './pregunta.js'
import { diosEntero } from './pregunta.js'

// ─── Las constantes, y de dónde sale cada una ───────────────────────────────

/**
 * El predicado que define qué proceso es NÚCLEO para esta garantía.
 *
 * Es el `establishes` de `EXTRACCION`, y se compara por texto a propósito: el
 * proceso que mañana escriba el modelo para sacar carne de otra forma entra en
 * la garantía sin tocar este archivo, con solo declarar lo mismo que declara el
 * de la semilla. Un `id === 'extraccion'` habría dejado afuera todo lo que no
 * se llame igual, que es la manera cara de descubrir que el catálogo era una
 * lista de recetas.
 */
export const PREDICADO_DE_CARNE = 'holding(tag:carnoso)'

/**
 * El radio de co-presencia, en celdas y en distancia de Chebyshev (la del
 * mundo: moverse en diagonal cuesta lo mismo que en recto).
 *
 * Dos porque es lo que dice el requisito, y el número tiene sentido: es lo que
 * se puede juntar sin abandonar la orilla. Si fuera 10, «en el lugar» querría
 * decir «en algún lado del mapa» y la garantía no garantizaría nada.
 */
export const RADIO_DE_COPRESENCIA = 2

/**
 * El rol que llena la CRIATURA, no el suelo.
 *
 * `friccion` y `deshilachar` piden un rol `actor` con `stamina`, y ninguna
 * materia tirada en el piso tiene stamina. Sin esta excepción, la garantía
 * intentaría sembrar una sustancia con stamina, no encontraría ninguna, y
 * lanzaría por algo que no está roto. La convención del nombre ya es la de
 * `@anima/physics`: los tres procesos semilla que necesitan a alguien lo llaman
 * así.
 */
export const ROL_DEL_ACTOR = 'actor'

/**
 * Las formas en que el dios deja caer materia, con su masa.
 *
 * Son dos y la elección importa MUCHO más de lo que parece:
 *
 *   - una `vara` de masa 1 tiene `reach = 4` (esbeltez 4 × masa), o sea que sola
 *     ya pasa `reach >= 2` — pero es rígida, no tiene punta suelta y su `catch`
 *     es cero;
 *   - una `hebra` de masa 0.3 tiene `catch > 0` si su sustancia es flexible,
 *     pero `reach = 6 × 0.3 = 1.8`, y eso NO llega a 2.
 *
 * Ninguna de las dos, sola, llena el rol `gear` de `extraccion`. Las dos juntas
 * y atadas, sí. **La caña emerge de la aritmética de la garantía sin que nadie
 * escriba «caña»**, y eso no es una casualidad afortunada: es la prueba de que
 * la garantía está juzgando con la física y no con una lista.
 *
 * Si mañana estas masas cambian, lo que cambia es qué hace falta juntar, no si
 * la garantía se cumple: la búsqueda es sobre lo que la física dice, no sobre
 * lo que este comentario cuenta.
 */
export const FORMAS_SEMBRABLES: readonly { readonly form: FormId; readonly mass: number }[] = [
  { form: 'vara', mass: 1 },
  { form: 'hebra', mass: 0.3 },
]

/**
 * Cuántas vueltas de siembra se permiten antes de rendirse con un error.
 *
 * Existe porque la alternativa a rendirse con nombre es un `while` que no
 * termina en el hilo que decreta el mundo. Ocho es holgado: cada vuelta cierra
 * al menos un test de rol, y el rol más exigente de los procesos semilla tiene
 * dos.
 */
export const MAX_VUELTAS = 8

/**
 * Cuántas sueltas entran en la combinatoria de armado.
 *
 * El cierre prueba todos los pares, o sea que cuesta el cuadrado. Veinte da 400
 * llamadas a `unir` por consulta, que es nada en el momento de decretar un
 * chunk y muchísimo si alguien lo llamara por tick. Lo sembrado en esta misma
 * llamada va SIEMPRE primero, para que la poda no pueda tirar justo lo que se
 * acaba de poner —eso sí convertiría la garantía en un bucle que no cierra—.
 */
export const MAX_PARA_ARMAR = 20

// ─── Las formas ─────────────────────────────────────────────────────────────

/** Una posición en celdas. El marco es el que use quien llama: lo único que
 *  importa es que `SueltaSembrable.at` y `ChunkSembrable.ancla` estén en el mismo. */
export interface Punto {
  readonly x: number
  readonly y: number
}

/** Materia tirada en el suelo, que es de lo único que se puede agarrar el
 *  planificador cuando dice «con lo que hay acá». */
export interface SueltaSembrable {
  readonly substance: SubstanceId
  readonly form: FormId
  readonly mass: number
  readonly at: Punto
  /** Quién la puso: el ruido del bioma, o esta garantía. Es para la crónica —y
   *  para que un test pueda preguntar qué hizo falta agregar—. */
  readonly por?: 'ruido' | 'resolubilidad'
}

/**
 * El mínimo estructural de un `ChunkFacts` para poder sembrarlo.
 *
 * Se declara acá, chico y explícito, en vez de importar el `ChunkFacts` del
 * decretador: la forma completa del chunk la publica quien decreta, y adivinarla
 * desde este archivo sería atarse a algo que todavía se está escribiendo. Un
 * `ChunkFacts` que tenga estos campos entra sin adaptador, porque TypeScript es
 * estructural; si no los tiene, el adaptador es de una línea y vive del lado de
 * quien lo publica.
 *
 * `sueltas` es un array MUTABLE, y es lo único mutable de todo el archivo:
 * `ensureSolvable` empuja ahí. Esa mutación es correcta acá y en ningún otro
 * lado del proyecto, porque el chunk todavía no es del mundo — se está
 * decretando, no ha sido visto por nadie, y no entró en ningún delta ni en
 * ningún hash. Una vez que se lo comprometa, es inmutable como todo lo demás.
 */
export interface ChunkSembrable {
  readonly cx: number
  readonly cy: number
  /** Si el bioma tiene agua. Es la condición que dispara la garantía. */
  readonly acuatico: boolean
  /** El punto alrededor del cual se exige co-presencia: la orilla. */
  readonly ancla: Punto
  /** Lo que hay tirado. `ensureSolvable` agrega acá lo que falte. */
  readonly sueltas: SueltaSembrable[]
  /**
   * DE DÓNDE PUEDE SACAR EL DIOS lo que siembra. Todo lo que no esté acá no cae
   * del cielo, por más que llenara el rol.
   *
   * Antes esto no existía y la garantía buscaba en el catálogo ENTERO. Medido en
   * 1681 chunks, dejaba en la orilla `agua/hebra`, `savia/hebra`, `pluma/hebra`,
   * `piel/hebra` y `tendon/hebra`: un hilo de agua atado a una vara, plumas sin
   * pájaro, tendones sin animal. No rompía ningún invariante —rompía la
   * coherencia que el propio paquete ya verifica para `scatter`: **lo que está
   * tirado tiene que ser de lo que el lugar está hecho**—, y el mundo se volvía
   * una escenografía a la que le podés encontrar cualquier cosa si mirás bien.
   *
   * Quien decreta pasa acá `CANTERA_DEL_MUNDO`: lo que ALGÚN bioma deja tirado.
   * No es una lista escrita a mano ni un tag prohibido; es la tabla de biomas
   * mirada desde otro lado, y crece sola cuando la tabla crece.
   */
  readonly cantera: readonly SubstanceId[]
  /**
   * Y lo de ACÁ, que no restringe: DESEMPATA.
   *
   * Entre las candidatas que empatan en cuánto mejoran el rol, si alguna es de lo
   * que este lugar y los de al lado dan, el dado elige sólo entre ésas. Es la
   * frase «con la materia prima que hay en el lugar» aplicada donde no cuesta
   * nada: no puede hacer que la garantía falle —si ninguna es de acá, se elige
   * entre todas las empatadas igual— y hace que una orilla de pantano tienda a
   * tener junco y no una raíz dura de estepa.
   *
   * Vacío es legítimo y quiere decir «no desempates».
   */
  readonly canteraLocal: readonly SubstanceId[]
}

/** Un rol de un proceso núcleo que hoy nadie puede llenar con lo que hay cerca. */
export interface RolFaltante {
  readonly process: ProcessId
  readonly role: string
}

// ─── La costura con lo que decreta el chunk ─────────────────────────────────
//
// Lo que `scatter` deja tirado —la `Suelta` de `ley.ts`— dice QUÉ sustancia, EN
// QUÉ CELDA y CUÁNTA MASA. No dice la FORMA, y sin forma no hay geometría:
// `reach` es `esbeltez(forma) × masa`, así que sin forma no se puede contestar
// si lo que hay en el piso llega a dos celdas, que es la mitad exacta del rol
// `gear`. La misma rama, hecha vara o hecha bloque, alcanza o no alcanza.
//
// Las dos funciones de acá abajo son esa costura, y están de este lado a
// propósito: quien decreta no tiene por qué saber qué necesita la resolubilidad.
// El día que la siembra publique su propia forma, `formaDeLoSuelto` se borra y
// el adaptador pasa a leerla — y hasta ese día, la forma se INFIERE de las
// cualidades con los dos umbrales que la tabla de biomas ya usa para su propio
// chequeo (`FLEXIBILIDAD_DE_ATADURA`, `RIGIDEZ_DE_VARA`), y no con dos números
// nuevos escritos acá.

/** El mínimo estructural de lo que `scatter` deja tirado. Se declara
 *  estructuralmente —y no se importa— para que este archivo no cierre un ciclo
 *  con el que decreta: es el decretador el que llama a `ensureSolvable`. */
export interface SueltaDecretada {
  readonly substance: SubstanceId
  /** Índice local de la celda dentro del chunk, en orden por filas. */
  readonly i: number
  /** Masa en `Fixed` (escala 1000), como la sortea el dado del dios. */
  readonly masa: Fixed
}

/**
 * Qué forma tiene tirada una sustancia.
 *
 * Lo flexible cae hecho hebra (una liana, un tendón); lo rígido y no mineral,
 * hecho vara (una rama); lo demás es un bloque (una piedra, un terrón). No es
 * una tabla por sustancia: son dos umbrales y un tag, así que la sustancia que
 * el oráculo invente mañana cae con la forma que le toca sin fila propia — que
 * es la misma promesa que hace el resto del catálogo.
 *
 * ─── Y es DELIBERADAMENTE conservadora ──────────────────────────────────────
 *
 * La forma no es una propiedad de la materia: una piedra puede ser un canto o
 * una lasca, y la misma madera puede estar tirada como rama o como tronco. O sea
 * que esto ADIVINA, y adivinar tiene dos formas de equivocarse que no son
 * simétricas:
 *
 *   - de menos (llamarle bloque a lo que era una rama) hace que la garantía
 *     siembre una vara de más. Cuesta una suelta;
 *   - de más (llamarle vara a un canto rodado) hace que la garantía CREA que el
 *     rol ya está lleno y no siembre. Cuesta un chunk injugable, en silencio.
 *
 * Por eso lo mineral va a bloque aunque sea rigidísimo. Cuando la siembra
 * publique la forma de cada cosa, esto se borra.
 */
export function formaDeLoSuelto(substance: SubstanceId, phys: Physics): FormId {
  const s = phys.substances.get(substance)
  if (s === undefined) throw new RangeError(`sustancia que el catálogo no conoce: ${substance}`)
  if ((s.perUnitMass.flexibility ?? 0) >= FLEXIBILIDAD_DE_ATADURA) return 'hebra'
  if (s.tags.includes('mineral')) return 'bloque'
  if ((s.perUnitMass.rigidity ?? 0) >= RIGIDEZ_DE_VARA) return 'vara'
  return 'bloque'
}

/**
 * Lo decretado, visto como algo que la resolubilidad puede juzgar y sembrar.
 *
 * `celdasDeLado` y `origen` entran por parámetro y no por `import`: el tamaño
 * del chunk lo define quien decreta, y traérmelo desde acá cerraría un ciclo de
 * módulos con él. `origen` es la celda del chunk en el marco en el que se va a
 * medir el radio — pasar `{x: 0, y: 0}` da coordenadas locales, y pasar la
 * esquina del chunk las da globales.
 */
export function sembrablesDelChunk(
  sueltas: readonly SueltaDecretada[],
  celdasDeLado: number,
  origen: Punto,
  phys: Physics,
  forma: (substance: SubstanceId, phys: Physics) => FormId = formaDeLoSuelto,
): SueltaSembrable[] {
  if (!Number.isInteger(celdasDeLado) || celdasDeLado <= 0) {
    throw new RangeError(`un chunk de ${String(celdasDeLado)} celdas de lado no es un chunk`)
  }
  return sueltas.map((s) => {
    if (!Number.isInteger(s.i) || s.i < 0 || s.i >= celdasDeLado * celdasDeLado) {
      throw new RangeError(`celda ${String(s.i)} fuera del chunk`)
    }
    return {
      substance: s.substance,
      form: forma(s.substance, phys),
      mass: unfx(s.masa),
      at: { x: origen.x + (s.i % celdasDeLado), y: origen.y + Math.floor(s.i / celdasDeLado) },
      por: 'ruido',
    }
  })
}

// ─── Geometría ──────────────────────────────────────────────────────────────

/** Distancia de Chebyshev, la del mundo: la diagonal cuesta lo mismo que el
 *  recto. Escrita acá y no importada de `@anima/world` porque el oráculo NO
 *  depende del mundo — la flecha va del mundo al dios, y en los dos sentidos
 *  sería un ciclo de paquetes. */
export function chebyshev(a: Punto, b: Punto): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.max(dx < 0 ? -dx : dx, dy < 0 ? -dy : dy)
}

/** Lo que está a mano de la orilla, en el orden en que está en el chunk. */
export function sueltasEnRadio(chunk: ChunkSembrable, radio = RADIO_DE_COPRESENCIA): readonly SueltaSembrable[] {
  return chunk.sueltas.filter((s) => chebyshev(s.at, chunk.ancla) <= radio)
}

// ─── De materia tirada a cuerpo, y de cuerpos a lo que se puede armar ───────

/** Una suelta vista como el cuerpo que sería si alguien la levantara. Las
 *  cualidades NO se escriben acá: salen de la sustancia por `qualityOf`, que es
 *  la única forma de que una sustancia nueva se comporte bien sin fila propia. */
export function cuerpoDeSuelta(s: SueltaSembrable, id: string): Body {
  return { id, form: s.form, parts: [{ substance: s.substance, mass: s.mass, q: {} }], joints: [] , state: {} }
}

/**
 * Todo lo que se puede tener en la mano con lo que hay: lo suelto, y lo suelto
 * atado de a dos.
 *
 * ─── Por qué el cierre llega hasta atar y no más lejos ──────────────────────
 *
 * Con `unir(a, undefined, binder)` el atador SOBREVIVE como parte y le queda una
 * punta suelta; esa punta es `freeStrandEnds`, `freeStrandEnds` es lo único que
 * da `catch`, y sin `catch` no se califica para `extraccion`. O sea que el paso
 * «atar» es el que convierte materia en herramienta, y sin él la garantía sería
 * imposible de cumplir en cualquier chunk.
 *
 * ─── Y por qué NO incluye deshilachar ───────────────────────────────────────
 *
 * Porque en esta física no agrega nada. `partir` a favor del grano escala la
 * masa y cambia la forma a `hebra`, pero `flexibility` y `tensile` son
 * INTENSIVAS: la hebra de corteza tiene la flexibilidad de la corteza (0.7), no
 * 0.8. O sea que deshilachar no fabrica atadores que no existieran ya, y
 * meterlo acá solo multiplicaría el costo del cierre.
 *
 * Eso es una propiedad de la física de HOY y hay un test que la vigila: si
 * alguna vez partir cambiara una cualidad intensiva, el test falla y este cierre
 * se queda corto. Es la única forma honesta de apoyarse en algo que puede
 * cambiar en otro paquete.
 */
export function armables(sueltas: readonly SueltaSembrable[], phys: Physics): readonly Body[] {
  const base: Body[] = []
  for (let i = 0; i < sueltas.length && i < MAX_PARA_ARMAR; i++) {
    base.push(cuerpoDeSuelta(sueltas[i]!, `s${String(i)}`))
  }
  const out: Body[] = [...base]
  for (let i = 0; i < base.length; i++) {
    for (let j = 0; j < base.length; j++) {
      if (i === j) continue
      // `a` es lo que se sigue siendo y `binder` lo que queda colgando. El par
      // ordenado importa: atar la liana a la vara deja una punta suelta con el
      // largo de la vara, y atar la vara a la liana deja el largo de la liana.
      const e = unir(base[i]!, undefined, base[j]!, phys, `u${String(i)}+${String(j)}`)
      if (e !== undefined) out.push(e)
    }
  }
  return out
}

// ─── El juicio: ¿hay con qué llenar este rol? ───────────────────────────────

/**
 * Cuántos de los requisitos del rol pasa el MEJOR cuerpo armable, o −1 si no hay
 * ni un cuerpo.
 *
 * El puntaje parcial no es cosmético: es lo que hace que la siembra pueda
 * necesitar DOS cosas. Sembrar una hebra flexible en un chunk pelado no cierra
 * `gear` (le falta alcance) pero acerca; sembrar después una vara lo cierra. Sin
 * crédito parcial, el generador no podría distinguir «esto no sirve para nada»
 * de «esto es la mitad de lo que hace falta», y se rendiría en chunks
 * perfectamente sembrables.
 *
 * Cada requisito se juzga con `cumpleRol` sobre un rol de un solo test, y no con
 * un comparador propio: el operador `>=` contra `>` en un umbral es exactamente
 * la clase de detalle que se copia mal una vez y no se descubre nunca.
 */
export function puntajeDeRol(cuerpos: readonly Body[], r: Role, phys: Physics): number {
  let mejor = -1
  for (const b of cuerpos) {
    let n = 0
    for (const t of r.where) if (cumpleRol(b, { name: r.name, where: [t] }, phys)) n++
    if (n > mejor) mejor = n
  }
  return mejor
}

/** ¿Alguno de estos cuerpos llena el rol entero? Lo contesta la física. */
export function llenaRol(cuerpos: readonly Body[], r: Role, phys: Physics): boolean {
  for (const b of cuerpos) if (cumpleRol(b, r, phys)) return true
  return false
}

/** Los procesos que establecen `holding(tag:carnoso)`: los que la garantía mira. */
export function esNucleoDeCarne(p: Process): boolean {
  return p.establishes.includes(PREDICADO_DE_CARNE)
}

/**
 * Los roles que tiene que llenar el SUELO.
 *
 * Se van dos clases: los opcionales (por definición, el proceso corre sin
 * ellos) y el del actor (lo llena la criatura). Lo que queda es lo que el lugar
 * tiene que tener.
 */
export function rolesDelSuelo(p: Process): readonly Role[] {
  return p.roles.filter((r) => !isOptionalRole(r.name) && r.name !== ROL_DEL_ACTOR)
}

/**
 * LA PREGUNTA VERIFICABLE: ¿qué roles de qué procesos núcleo no se pueden llenar
 * con lo que hay a radio 2 de la orilla?
 *
 * Es pura, no toca el dado y no modifica nada. `ensureSolvable` la usa para
 * saber qué le falta, y los tests la usan como criterio — que sean la misma
 * función es a propósito: un criterio que se calcula distinto que la garantía
 * es un criterio que puede estar de acuerdo con ella por casualidad.
 *
 * Devuelve la lista en orden canónico —procesos en el orden en que vinieron,
 * roles en el orden en que los declara el proceso— porque de ese orden depende
 * qué se siembra primero, y de eso depende el mundo entero.
 */
export function faltantesParaResolver(
  chunk: ChunkSembrable,
  core: readonly Process[],
  phys: Physics,
): readonly RolFaltante[] {
  const cerca = sueltasEnRadio(chunk)
  const cuerpos = armables(cerca, phys)
  const faltan: RolFaltante[] = []
  for (const p of core) {
    if (!esNucleoDeCarne(p)) continue
    for (const r of rolesDelSuelo(p)) {
      if (!llenaRol(cuerpos, r, phys)) faltan.push({ process: p.id, role: r.name })
    }
  }
  return faltan
}

// ─── La garantía ────────────────────────────────────────────────────────────

interface Candidata {
  readonly substance: SubstanceId
  readonly form: FormId
  readonly mass: number
}

/** Lo sembrado primero, y después el resto: ver `MAX_PARA_ARMAR`. */
function paraArmar(cerca: readonly SueltaSembrable[], sembradas: readonly SueltaSembrable[]): readonly SueltaSembrable[] {
  if (cerca.length <= MAX_PARA_ARMAR) return cerca
  const nuevas = new Set<SueltaSembrable>(sembradas)
  return [...cerca.filter((s) => nuevas.has(s)), ...cerca.filter((s) => !nuevas.has(s))]
}

/**
 * Las sustancias que este lugar puede recibir, en el orden del CATÁLOGO.
 *
 * El orden de un `Map` de JS es el de alta, o sea que es el mismo en dos
 * partidas que llegaron al mismo catálogo por el mismo camino. Para las que
 * llegaron por caminos distintos —una transmutó antes que la otra— NO es el
 * mismo, y por eso la elección entre candidatas se hace con el dado y no con
 * «la primera»: con «la primera», dos partidas con el mismo chunk y distinta
 * historia de altas sembrarían cosas distintas.
 *
 * Recorrer el catálogo y filtrar por la cantera —y no recorrer la cantera— es lo
 * que conserva ese argumento intacto: el orden en que se ofrecen las candidatas
 * sigue siendo el del catálogo, y la cantera entra sólo como pertenencia. Una
 * sustancia de la cantera que el catálogo no conoce simplemente no aparece: eso
 * pasa si alguna vez la tabla de biomas nombra algo que la física no tiene, y
 * `bioma.ts` ya lo rechaza al cargar.
 */
function candidatasDelLugar(phys: Physics, cantera: ReadonlySet<SubstanceId>): readonly SubstanceId[] {
  return [...phys.substances.keys()].filter((s) => cantera.has(s))
}

/**
 * Todo lo que, agregado al chunk, mejora lo que se puede hacer con este rol.
 *
 * Devuelve las candidatas que MÁS lo mejoran: las que lo cierran si alguna lo
 * cierra, y si ninguna, las que suben el puntaje parcial. Empatadas, todas, para
 * que el dado elija entre iguales y el mundo tenga variedad sin tener sesgo —
 * salvo que alguna sea de acá, y entonces gana lo de acá (ver `canteraLocal`).
 */
function candidatasPara(
  r: Role,
  cerca: readonly SueltaSembrable[],
  sembradas: readonly SueltaSembrable[],
  ancla: Punto,
  phys: Physics,
  cantera: ReadonlySet<SubstanceId>,
  local: ReadonlySet<SubstanceId>,
): { readonly puntaje: number; readonly opciones: readonly Candidata[] } {
  let mejor = puntajeDeRol(armables(paraArmar(cerca, sembradas), phys), r, phys)
  let opciones: Candidata[] = []
  for (const substance of candidatasDelLugar(phys, cantera)) {
    for (const f of FORMAS_SEMBRABLES) {
      // La tentativa se prueba EN LA ORILLA y se siembra en algún punto a radio
      // 2 de ella. Que eso no cambie el juicio es justamente lo que significa
      // «co-presencia en radio 2»: adentro del radio, dónde exactamente caiga es
      // sabor y no economía. Si algún día el radio importara para llenar un rol,
      // la evaluación tendría que mudarse al punto real y este comentario sería
      // el que quedó viejo.
      const tentativa: SueltaSembrable = { substance, form: f.form, mass: f.mass, at: ancla, por: 'resolubilidad' }
      const conElla = [...cerca, tentativa]
      const p = puntajeDeRol(armables(paraArmar(conElla, [...sembradas, tentativa]), phys), r, phys)
      if (p > mejor) {
        mejor = p
        opciones = [{ substance, form: f.form, mass: f.mass }]
      } else if (p === mejor && opciones.length > 0) {
        opciones.push({ substance, form: f.form, mass: f.mass })
      }
    }
  }
  // El desempate por el lugar. Filtra sobre las EMPATADAS, así que no puede
  // cambiar el puntaje ni hacer que la garantía deje de cerrar: en el peor caso
  // no hay ninguna de acá y quedan todas, que es exactamente lo de antes.
  const deAca = opciones.filter((o) => local.has(o.substance))
  return { puntaje: mejor, opciones: deAca.length > 0 ? deAca : opciones }
}

/** Un punto a mano de la orilla. Dos tiradas del dado, en este orden: x, y. */
function puntoCerca(ancla: Punto, rng: DiosRng): Punto {
  const dx = diosEntero(rng, -RADIO_DE_COPRESENCIA, RADIO_DE_COPRESENCIA)
  const dy = diosEntero(rng, -RADIO_DE_COPRESENCIA, RADIO_DE_COPRESENCIA)
  return { x: ancla.x + dx, y: ancla.y + dy }
}

/**
 * LA GARANTÍA. Al decretar un chunk con bioma acuático, deja el lugar en
 * condiciones de que la criatura pueda sacar algo carnoso del agua con lo que
 * tiene alrededor.
 *
 * Muta `chunk.sueltas` —ver `ChunkSembrable`— y además devuelve lo que sembró,
 * que es para la crónica: «el dios puso una liana acá porque si no, no había con
 * qué» es exactamente la clase de hecho que el juez va a querer leer. Ignorar el
 * valor de retorno es seguro: el trabajo ya está hecho en el chunk.
 *
 * ─── Lanza en vez de rendirse en silencio ───────────────────────────────────
 *
 * Si el catálogo no tiene con qué llenar un rol, esto lanza. Es deliberado y es
 * el corazón de la decisión: la falla que este archivo existe para evitar es
 * silenciosa, así que la garantía no puede fallar callada. Un catálogo donde
 * nada tiene `flexibility >= 0.8` es un mundo donde no se puede pescar, y hay
 * que enterarse al decretarlo y no cuatro horas después mirando a una criatura
 * tantear la orilla.
 *
 * ─── El orden en que se consume el dado es contrato ─────────────────────────
 *
 * Por cada cosa sembrada: una tirada para elegir la candidata, una para el `x`,
 * una para el `y`. Cambiar ese orden cambia todos los mundos generados con todas
 * las semillas. Y si no falta nada, NO SE TIRA NI UNA VEZ: volver a preguntar es
 * idempotente, que es la regla madre del dios perezoso.
 */
export function ensureSolvable(
  chunk: ChunkSembrable,
  core: readonly Process[],
  rng: DiosRng,
  phys: Physics,
): readonly SueltaSembrable[] {
  // La garantía es del bioma ACUÁTICO. En un chunk seco no hay de dónde sacar
  // nada carnoso, y sembrarle una caña sería el dios contando una historia que
  // el lugar no tiene.
  if (!chunk.acuatico) return []

  const cantera = new Set(chunk.cantera)
  const local = new Set(chunk.canteraLocal)
  const sembradas: SueltaSembrable[] = []
  for (let vuelta = 0; ; vuelta++) {
    const faltan = faltantesParaResolver(chunk, core, phys)
    if (faltan.length === 0) return sembradas
    if (vuelta >= MAX_VUELTAS) {
      throw new Error(
        `el chunk ${String(chunk.cx)},${String(chunk.cy)} no se pudo hacer resoluble en ${String(MAX_VUELTAS)} vueltas; falta ${faltan[0]!.process}.${faltan[0]!.role}`,
      )
    }
    const objetivo = faltan[0]!
    const proceso = core.find((p) => p.id === objetivo.process)!
    const rol = proceso.roles.find((r) => r.name === objetivo.role)!

    const cerca = sueltasEnRadio(chunk)
    const antes = puntajeDeRol(armables(paraArmar(cerca, sembradas), phys), rol, phys)
    const { puntaje, opciones } = candidatasPara(rol, cerca, sembradas, chunk.ancla, phys, cantera, local)
    if (opciones.length === 0 || puntaje <= antes) {
      throw new Error(
        `en la cantera (${String(cantera.size)} sustancias) no hay con qué llenar ${objetivo.process}.${objetivo.role} en el chunk ${String(chunk.cx)},${String(chunk.cy)}: ninguna mejora lo que ya hay`,
      )
    }
    const elegida = opciones[diosEntero(rng, 0, opciones.length - 1)]!
    const suelta: SueltaSembrable = {
      substance: elegida.substance,
      form: elegida.form,
      mass: elegida.mass,
      at: puntoCerca(chunk.ancla, rng),
      por: 'resolubilidad',
    }
    chunk.sueltas.push(suelta)
    sembradas.push(suelta)
  }
}
