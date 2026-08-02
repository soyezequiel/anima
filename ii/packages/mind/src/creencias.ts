// ─── @anima/mind/creencias.ts ────────────────────────────────────────────────
//
// LA MEMORIA DE AFORDANCIAS: qué rinde qué, y con cuánta evidencia detrás.
//
// Tres fuentes de prior, en este orden, y la del medio PISA a la de arriba:
//
//   1. INSTINTO       las cinco filas heredables. Es cableado, y se dice sin
//                     maquillaje: lo que antes era un `if (frío) pursueWarmth()`
//                     ahora es una fila de una tabla de priors. Los animales
//                     tienen instintos y esto es legítimo — pero es cableado.
//   2. EVIDENCIA      pescó tres veces acá y sacó dos. Se SUMA sobre el prior, o
//                     sea que con suficientes intentos el instinto deja de
//                     mandar. Cuántos intentos hacen falta está MEDIDO en
//                     `tests/las-creencias.test.ts`: **dos**, y de dónde sale ese
//                     dos está abajo, en `INSTINTO`.
//   3. SEMILLA DEL    para contextos genuinamente nuevos. No hay modelo hasta el
//      MODELO         Hito 8: el método existe, nadie lo llama, y su regla —no
//                     puede hablar por encima del instinto— está escrita y
//                     testeada igual, porque una regla que sólo vive en un
//                     comentario no es una regla.
//
// ═══ LA DECISIÓN QUE MÁS IMPORTA: LA `ContextKey` ═══════════════════════════
//
// La clave es lo que decide CUÁNTO GENERALIZA la criatura. Más fina, no aprende
// nunca —cada celda es un mundo nuevo y toda evidencia queda huérfana—; más
// gruesa, aprende mal —la piedra hereda lo que rindió el río—.
//
// ─── Lo primero, que cambia el problema: LA MENTE NO VE EL BIOMA ────────────
//
// `tipos.ts` dice «hoy la clave es el bioma más la forma de lo que se ve», y la
// mitad izquierda de esa frase NO SE PUEDE ESCRIBIR: `VistaDeLaMente` es
// `VistaDelPlan`, y `VistaDelPlan` tiene `see`, `recall`, `q`, `qAt`, `self` y
// `clock`. No hay ningún accesor de bioma, y no puede haberlo por la regla del
// paquete: el bioma vive en `@anima/oracle`, que acá es dependencia de TESTS.
// Lo único que queda del lugar son las cuatro cualidades de celda (ADR II-0002).
//
// ─── Y LA PREGUNTA DE VERDAD NO ES «¿SE PUEDE?» SINO «¿CONVIENE?» ──────────
//
// Sí se puede aproximar el bioma: `temperature` de celda es exactamente
// `T_AMBIENTE + bioma.deltaTemperatura`, constante en todo el chunk, y **nada en
// `world/src/step.ts` escribe `WorldState.cells`** —medido: `grep 'cells.set'`
// da cero— así que hoy es un número perfectamente estable que separa los nueve
// biomas en ocho temperaturas (medido: sólo `agua-dulce` y `bosque` comparten los
// 13 °C). Meterla en la clave era gratis. No se hizo, y el motivo NO es la
// estabilidad:
//
//   **UNA CREENCIA ES SOBRE LA FÍSICA, Y EL BIOMA ES GEOGRAFÍA.** Un Beta por
//   (contexto, tag) contesta «si actúo sobre esto acá, ¿sale?». Esa respuesta no
//   depende de en qué bosque estoy: un leño se deshilacha igual en el bosque y
//   en la estepa. Lo que el bioma cambia es la ABUNDANCIA —cuántas cosas de cada
//   clase hay tiradas y cuán lejos— y la abundancia no vive en esta memoria: vive
//   en `costoEstimado` y en el `LibroDeLugares`, que sí saben de distancias.
//
//   MEDIDO, y es la mitad que convierte el argumento en un número: en 41×41
//   chunks de la semilla 20260727n hay pozos en CUATRO biomas —`agua-dulce`,
//   `pantano`, `pradera` y `bosque`— y los tres rendimientos que decretan
//   (`pescado`, `molusco`, `carne`) tienen los tres el tag `carnoso`. O sea que
//   la creencia «del agua sale carne» transfiere de un bioma al otro **y
//   transfiere bien**. Una clave que separara biomas habría partido esa evidencia
//   en cuatro montones de un cuarto del tamaño, sin ganar nada.
//
// Y la estabilidad tampoco habría sido un argumento a favor, porque no es
// distinta: `IndiceDelTick.celda` entrega la celda YA OCLUIDA, y la oclusión
// mueve las cuatro. Medido en el test: tapar la celda de un pozo con una piedra
// le mueve `wet` de 1,0000 a 0,0200 y la saca del contexto «agua» — o sea que
// cualquier clave apoyada en cualquier cualidad de celda hereda ese hueco, y una
// apoyada en `temperature` lo heredaría igual.
//
// Las otras dos quedan afuera por razones más chicas: `oxygen` vale 1 en todo el
// mundo libre y no separa nada, y `sheltered` es CERO salvo que algo esté tapando
// esa celda — es un hecho sobre el techo, no sobre el lugar.
//
// ─── La otra mitad: «la forma de lo que se ve» tampoco es lo obvio ─────────
//
// Un `BodyView` **no trae sustancia ni tags** —está medido en
// `plan/tests/los-esquemas-contra-el-mundo.test.ts`, con su `it.fails`— así que
// «es un pescado» no se puede preguntar. Lo que trae es `name`, y `name` está
// descartado por dos razones y no por gusto:
//
//   · es una VISTA con adjetivos de cocción y de fuego (`nameOf` de la física):
//     el mismo cuerpo se llama «pescado crudo» y «pescado asado», o sea que la
//     evidencia se partiría en dos contextos por haberlo cocinado;
//   · la escalera de capacidades ya prohibió `b.name` como predicado, con el
//     motivo escrito: «es la tabla de kinds renacida donde ningún validador la
//     ve».
//
// Lo que queda es `v.q(b, ...)`, y ahí está la decisión de verdad: **la criatura
// distingue dos cosas cuando la diferencia cambia lo que podría HACER con
// ellas**. Los cinco rasgos de `RASGOS` son las cinco preguntas que la semilla ya
// le hace a un cuerpo, y **ni uno solo de sus umbrales está escrito acá**: tres
// se leen de los roles y de la tabla de esquemas, dos son el piso del rango que
// declara el catálogo de cualidades. Si `union` cambia lo que le pide a un
// atador, la clave cambia con él y no hay una segunda copia que se olvide.
//
// ─── El presupuesto de la clave ────────────────────────────────────────────
//
// 3 lugares × 32 formas = 96 contextos, y sobre 7 tags dan 672 casilleros
// posibles. Es POCO, y a propósito: una criatura que vive 20.000 ticks llena unos
// pocos casilleros con evidencia de verdad, y no 20.000 con una observación cada
// uno.
//
// El tercer lugar es `mano`, y no salió de querer más resolución: salió de un
// defecto medido —el lugar de un cuerpo agarrado era el de los pies de quien lo
// agarraba, así que la misma liana rendía `fibroso` en tierra y nada parada en el
// agua—. El porqué largo está en `MANO`.
//
// ─── LO QUE ESTA FUNCIÓN NO SABE CONTESTAR, Y NO SE TAPA ───────────────────
//
// `contextoDe(v, id)` recibe el id de un CUERPO y lo busca en `see([])`. Una
// celda de agua vacía no es un cuerpo —«el agua NO es un cuerpo […] buscar agua
// es `qAt` o `recall`, nunca `see`», dice el propio `Ctx`— así que cae en
// `SIN_CUERPO`, que no tiene tags, y no produce ninguna oportunidad. O sea que
// hoy el río entra por el POZO —que sí es un cuerpo con masa parado en agua
// franca, y es la fila 1 del instinto— y no entra el caso «veo el agua y todavía
// no veo nada adentro».
//
// `@anima/mind/oportunidades` ya lo midió desde su lado y lo tiene pinado con un
// `it.fails`; acá queda dicho por qué no se cierra desde ÉSTE: la clave de un
// lugar sin cuerpo necesita un formato de id compartido —hoy `oportunidades.ts`
// usa `celda:x,y`— y las dos únicas formas de leerlo desde acá son transcribir
// ese formato (la segunda copia que este repo castiga por nombre) o importar de
// `oportunidades.js`, que importa de acá: un ciclo de módulos con inicialización
// de nivel superior en el medio (`RASGOS` se calcula al cargar). La reparación es
// que el formato viva en un tercer lugar —`tipos.ts`, junto a `ContextKey`— y eso
// es una decisión sobre el contrato compartido, no sobre este archivo.

import { baseRoleName, specOf } from '@anima/physics'
import { AGUA_FRANCA, CATALOGO_CORE, procesoDe } from '@anima/plan'
import type { Where } from '@anima/skills'

import type {
  AffordanceMemory,
  Beta,
  BodyView,
  ContextKey,
  QualityId,
  VistaDeLaMente,
} from './tipos.js'
import { cuantasVeces } from './tipos.js'

// ─── Los umbrales, LEÍDOS y no transcritos ──────────────────────────────────
//
// Las cinco lecturas fallan al CARGAR el módulo, como la tabla de biomas de
// `@anima/oracle` y por la misma razón: un test se puede no correr, y el modo de
// falla de un umbral que quedó viejo es feo y callado —la criatura sigue
// aprendiendo, en cubetas que ya no corresponden a nada, y nadie se entera—.

/** Un umbral con su procedencia. `estricto` es `>` y no `>=`. */
export interface Umbral {
  readonly v: number
  readonly estricto: boolean
  /** De dónde salió. Se imprime en la tabla del test. */
  readonly de: string
}

/**
 * Lo que un ESQUEMA le pide a un rol. El umbral que la criatura necesitaría cumplir.
 *
 * ─── LEE EL CORE, Y ESO NO ES DEUDA DEL GATE 5→6 ────────────────────────────
 *
 * Los otros tres lectores del catálogo que había en `@anima/mind` dejaron de ser
 * constantes de módulo y ahora siguen al `catalogEpoch`. Éste NO, y es a
 * propósito. Dos motivos, y el segundo es el que decide:
 *
 *   · **un overlay agrega, no reemplaza.** `esquemasDe` concatena core y
 *     capacidades; ninguna fila del core se puede ir, así que la de `catch>0`
 *     que se busca acá siempre está y este `throw` no lo puede disparar una
 *     partida;
 *   · **las claves de contexto quedarían atadas al catálogo.** `CUANTAS_FORMAS`
 *     y `SIN_CUERPO` se derivan de `RASGOS.length`, o sea que si los rasgos
 *     siguieran al epoch, TODO lo aprendido antes de un registro quedaría en
 *     cubetas que ya no nombran nada. La memoria de afordancias es lo que la
 *     criatura sabe del mundo, y el mundo no cambia porque ella aprenda a
 *     construir algo.
 *
 * Lo que sí cambió es de dónde lo lee: por `CATALOGO_CORE.coreSchemas` y no por
 * la constante suelta, para que «el core es lo único que se lee acá» sea una
 * afirmación del código y no del comentario.
 */
function delEsquema(firma: string, rol: string, q: QualityId): Umbral {
  for (const e of CATALOGO_CORE.coreSchemas) {
    if (e.establishes !== firma) continue
    for (const t of e.roleHints[rol] ?? []) {
      if (t.q === q) return { v: t.v, estricto: t.op === '>', de: `esquema «${firma}», rol \`${rol}\`` }
    }
  }
  throw new RangeError(
    `@anima/mind/creencias: ningún esquema de «${firma}» le pide «${q}» al rol «${rol}». ` +
      `La clave de contexto se apoya en ese umbral: o la tabla de esquemas cambió de forma, ` +
      `o el rasgo tiene que salir de otro lado — pero no de un número escrito acá.`,
  )
}

/** Lo que un PROCESO del catálogo le pide a un rol. */
function delProceso(via: string, rol: string, q: QualityId): Umbral {
  for (const r of procesoDe(via).roles) {
    if (baseRoleName(r.name) !== rol) continue
    for (const t of r.where) {
      if (t.q === q) return { v: t.v, estricto: t.op === '>', de: `proceso \`${via}\`, rol \`${rol}\`` }
    }
  }
  throw new RangeError(
    `@anima/mind/creencias: el proceso «${via}» no le pide «${q}» al rol «${rol}». ` +
      `Ver el porqué en \`delEsquema\`: el umbral se lee, no se escribe.`,
  )
}

/**
 * EL PISO DEL RANGO que declara el catálogo de cualidades, con `>` estricto.
 *
 * No es «elegir cero»: es preguntarle al catálogo dónde empieza la cualidad. Para
 * `nutrition` y `fuelEnergy` el piso es la frontera entre «tiene» y «no tiene»,
 * que es la única división que se puede hacer sin inventar una calibración — y
 * tiene que ser ESTRICTA, porque `>= piso` no separa absolutamente nada.
 */
function delPisoDelRango(q: QualityId): Umbral {
  const v = specOf(q).range[0]
  return { v, estricto: true, de: `el piso del rango de \`${q}\` en el catálogo` }
}

// ─── Los cinco rasgos ───────────────────────────────────────────────────────

export interface Rasgo {
  /** La letra que ocupa su posición en el código de forma. Una sola, y fija. */
  readonly letra: string
  readonly q: QualityId
  readonly umbral: Umbral
  readonly porque: string
}

/**
 * LAS CINCO PREGUNTAS QUE LA SEMILLA LE HACE A UN CUERPO, en orden fijo.
 *
 * El orden ES el formato de la clave: `mc--e` no es lo mismo que `em--c`, y una
 * clave cuyo orden dependiera de cómo se recorrió un objeto sería
 * no-determinismo con cara de firma.
 *
 * `mass` es la única EXTENSIVA de las cinco, y por eso está: `nutrition` y
 * `fuelEnergy` son INTENSIVAS —lo dice el catálogo, y está medido: el banco de
 * moluscos de la semilla sigue marcando `nutrition = 6,0000` con la población en
 * cero— así que sin `mass` **un pozo agotado sería indistinguible de uno lleno**.
 * Con `mass`, no lo es; ver `EL COLAPSO DE CAUSAS` al final del archivo.
 */
export const RASGOS: readonly Rasgo[] = [
  {
    letra: 'm',
    q: 'mass',
    // El umbral con mejor procedencia de los cinco: es LITERALMENTE la condición
    // con la que el mundo decide si un pozo todavía sirve de `source`.
    umbral: delProceso('extraccion', 'source', 'mass'),
    porque: 'hay algo: es lo que `extraccion` le pide al pozo para seguir siendo un pozo',
  },
  {
    letra: 'c',
    q: 'nutrition',
    umbral: delPisoDelRango('nutrition'),
    porque: 'alimenta: `calories = nutrition · mass · digestibility`, y sin nutrition no hay caloría',
  },
  {
    letra: 'a',
    q: 'flexibility',
    umbral: delEsquema('catch>0', 'binder', 'flexibility'),
    porque: 'ata: es lo que la fila de `catch>0` le pide al `binder` para que quede punta suelta',
  },
  {
    letra: 'r',
    q: 'rigidity',
    umbral: delProceso('friccion', 'a', 'rigidity'),
    porque: 'se frota: es lo que `friccion` le pide a los roles `a` y `b`',
  },
  {
    letra: 'e',
    q: 'fuelEnergy',
    umbral: delPisoDelRango('fuelEnergy'),
    porque: 'arde: separa el leño de la piedra, que si no caen los dos en «lo duro»',
  },
]

/** Cuántas formas hay. Es la cota del espacio de claves, y la usa el test. */
export const CUANTAS_FORMAS = 1 << RASGOS.length

const AGUA = 'agua'
const TIERRA = 'tierra'

/**
 * LA MANO NO ES UN BIOMA, Y ÉSE ES EL TERCER LUGAR.
 *
 * ─── EL DEFECTO QUE ESTO REPARA, MEDIDO ────────────────────────────────────
 *
 * `lugarDe` armaba la mitad izquierda de la clave con `qAt(b.at, 'wet')`, y el
 * `at` de un cuerpo EN UNA MANO es el de quien lo lleva, no el de donde lo
 * levantó. O sea que para todo lo que se lleva encima el LUGAR de la clave no
 * decía nada del cuerpo: decía dónde estaban los pies. El adversario lo midió
 * sobre la misma liana, en la misma mano, sin que a la liana le pasara nada:
 *
 *     t= 8  wet=1,00  ctx(matorral)=agua|m-a-e    tags=[]           (no rinde nada)
 *     t= 9  wet=0,15  ctx(matorral)=tierra|m-a-e  tags=["fibroso"]  valor 9,810
 *     t=15  wet=1,00  ctx(matorral)=agua|m-a-e    tags=[]           (no rinde nada)
 *
 * La mejor oportunidad de toda la lista —cinco veces la segunda— aparecía y
 * desaparecía según la celda que pisaba. Quince de veinticinco ticks con la
 * liana en la mano, la liana no rendía nada.
 *
 * ─── POR QUÉ UN LUGAR PROPIO Y NO CONGELAR EL DE ORIGEN ────────────────────
 *
 * Congelar «el lugar donde se lo vio la primera vez» exige estado nuevo —un
 * registro de dónde entró cada cuerpo a la mano— y ese estado tendría que vivir
 * en algún lado, ensuciarse cuando el cuerpo se suelta y volver a nacer cuando se
 * levanta otro. Un lugar propio no inventa nada: dice lo que efectivamente se
 * sabe, que es que este cuerpo está en una mano y que su celda no habla de él.
 *
 * ─── LO QUE ESTO CUESTA, DICHO SIN MAQUILLAJE ──────────────────────────────
 *
 * Ninguna de las cinco filas del instinto es de `mano`, así que **lo que se lleva
 * encima no rinde ningún tag**. Es deliberado y es coherente con lo que
 * `Opportunity` significa: una oportunidad es algo que se podría CONSEGUIR, y lo
 * que ya está en la mano no hay que conseguirlo. Lo que se pierde de verdad es
 * que la evidencia que un día escriba `observe()` va a quedar en dos casilleros
 * —`mano|forma` mientras se lo lleva y `tierra|forma` mientras está en el suelo—
 * y eso NO lo arregla este cambio: lo arregla el día que la clave deje de tener
 * mitad izquierda para los cuerpos que la criatura toca. Lo que sí arregla es el
 * parpadeo, que es lo que hacía que la misma criatura, en el mismo tick, quisiera
 * cosas distintas según en qué celda hubiera pisado.
 *
 * La fila 1 del instinto —`agua|mc--e` → carnoso, el pozo— no se toca: un pozo no
 * está en la mano de nadie y sigue leyendo el agua en la que está parado.
 */
const MANO = 'mano'

/**
 * Los tres lugares: los dos que `wet` separa, más la mano.
 *
 * `wet` es la única cualidad de celda que sirve (ver el encabezado); la mano no
 * sale de ninguna cualidad de celda porque no es una celda.
 */
export const LUGARES: readonly string[] = [AGUA, MANO, TIERRA]

/**
 * El contexto de un cuerpo que la vista ya no tiene.
 *
 * Existe para que un id viejo no se lleve puesto el tick, y es un contexto
 * DISJUNTO de todos los demás: ningún cuerpo visible cae acá —«?» no es ninguno
 * de los dos lugares— no tiene fila de instinto, y `tagsDe` lo devuelve vacío,
 * así que `opportunities()` lo saltea. Lo que se anote contra él es basura
 * inerte, y así queda dicho en vez de escondido detrás de un `throw` que haría
 * fallar el tick de una criatura porque un cuerpo se movió.
 *
 * Se arma con `RASGOS.length` y no con cinco signos escritos: un sexto rasgo lo
 * alarga solo, y el día que no lo hiciera esta clave dejaría de tener la forma de
 * las otras sin que nada se pusiera rojo.
 */
export const SIN_CUERPO: ContextKey = `?|${'?'.repeat(RASGOS.length)}`

const NINGUN_FILTRO: Where = Object.freeze([]) as Where

/**
 * Qué clase de lugar es la celda de este cuerpo. Ver el encabezado y `MANO`.
 *
 * `heldBy` primero y sin mirar la celda: el `at` de un cuerpo agarrado es el de
 * quien lo agarra, así que preguntarle `wet` es preguntar por los pies del otro.
 * Vale para CUALQUIER mano y no sólo para la propia, y por el mismo motivo.
 */
function lugarDe(v: VistaDeLaMente, b: BodyView): string {
  if (b.heldBy !== undefined) return MANO
  return v.qAt(b.at, 'wet') >= AGUA_FRANCA ? AGUA : TIERRA
}

/** El código de cinco letras. Una letra por rasgo presente, `-` por ausente. */
function formaDe(v: VistaDeLaMente, b: BodyView): string {
  let out = ''
  for (const r of RASGOS) {
    const x = v.q(b, r.q)
    out += (r.umbral.estricto ? x > r.umbral.v : x >= r.umbral.v) ? r.letra : '-'
  }
  return out
}

function claveDe(lugar: string, forma: string): ContextKey {
  return `${lugar}|${forma}`
}

/**
 * La clave del contexto de un cuerpo visto.
 *
 * Recorre `see([])` y busca por id, que es O(cuerpos a la vista) por llamada: el
 * contrato del andamio recibe un `id` y no un `BodyView`, y resolverlo es lo que
 * cuesta. La cota no es preocupante porque quien llama ya tiene la lista
 * —`opportunities()` mira a lo sumo `OPORTUNIDADES_QUE_MIRA` cuerpos— pero queda
 * dicho: si el peldaño D3 se pone caro, esto es lo primero que hay que mirar.
 */
export function contextoDe(v: VistaDeLaMente, id: string): ContextKey {
  for (const b of v.see(NINGUN_FILTRO)) {
    if (b.id === id) return claveDe(lugarDe(v, b), formaDe(v, b))
  }
  return SIN_CUERPO
}

// ─── El instinto ────────────────────────────────────────────────────────────

interface Instinto {
  readonly ctx: ContextKey
  readonly rinde: string
  readonly prior: Beta
}

/**
 * Escribir una fila de instinto sin poder inventar una clave que `contextoDe`
 * nunca produzca: el lugar tiene que estar en `LUGARES` y el código de forma
 * tiene que tener la letra de `RASGOS` o un `-` en cada posición.
 *
 * Sin esto, una fila con un typo —`'agua|mc--E'`— sería una creencia que ningún
 * cuerpo del mundo puede activar jamás, y no fallaría nada: la criatura
 * simplemente nunca tendría ese instinto. Es el mismo modo de falla silencioso
 * que la tabla de biomas ataja verificándose al cargar.
 */
function fila(lugar: string, forma: string, rinde: string, prior: Beta): Instinto {
  if (!LUGARES.includes(lugar)) throw new RangeError(`lugar que no existe: «${lugar}»`)
  if (forma.length !== RASGOS.length) {
    throw new RangeError(`«${forma}» no tiene ${String(RASGOS.length)} letras: no es una forma`)
  }
  for (let i = 0; i < RASGOS.length; i++) {
    const esperada = RASGOS[i]?.letra
    const puesta = forma[i]
    if (puesta !== '-' && puesta !== esperada) {
      throw new RangeError(`«${forma}» tiene «${String(puesta)}» donde va «${String(esperada)}» o «-»`)
    }
  }
  // El prior de un instinto es una creencia con CERO observaciones propias
  // detrás, y quien define «cero» es el contrato: `cuantasVeces` de `tipos.ts`.
  // Ver el porqué largo en `Creencias.seed`.
  if (cuantasVeces(prior) !== 0) {
    throw new RangeError(
      `el prior Beta(${String(prior.a)}, ${String(prior.b)}) de «${lugar}|${forma}» → ${rinde} ` +
        `dice tener ${String(cuantasVeces(prior))} observaciones propias, y un instinto no vio nada`,
    )
  }
  return { ctx: claveDe(lugar, forma), rinde, prior }
}

/**
 * LAS CINCO FILAS DEL INSTINTO. Se dice sin maquillaje: **es cableado**, movido
 * de un `pursueWarmth` a una tabla de priors. Los animales tienen instintos y
 * esto es legítimo — pero es cableado, y hay que presupuestarlo.
 *
 * ─── POR QUÉ SE INCLINAN Y NO SON Beta(2,2) COMO DICE EL DOCUMENTO ─────────
 *
 * El documento de arquitectura escribe la fila del agua como Beta(2,2), y con el
 * contrato de `tipos.ts` eso NO SE PUEDE: `cuantasVeces` es `a + b − 2`, así que
 * un prior de fuerza 4 hace que una criatura recién nacida informe **n = 2** —y
 * ese `n` se imprime en el `porque` de cada `Opportunity`: «creo que el río rinde
 * carnoso (p=0,50, n=2)», dicho por una criatura que nunca pescó—.
 *
 * O sea que el contrato fija la fuerza del prior en 2, y de ahí sale todo lo
 * demás: **un prior de fuerza 2 que además fuera simétrico sería Beta(1,1), que
 * es exactamente «no tengo ni idea»**. Un instinto que no se inclina no es un
 * instinto. Por eso las cinco filas son asimétricas: la fuerza la fija el
 * contrato y lo único que queda por decir es hacia dónde.
 *
 * Beta(1,5, 0,5) tiene media 0,75 y Beta(0,5, 1,5) media 0,25. Los dos números
 * son exactos en binario, así que dos motores calculan la misma media.
 *
 * Y de la fuerza 2 sale el número que el tramo pedía, MEDIDO en el test: **dos
 * observaciones seguidas en contra dan vuelta cualquiera de las cinco filas**
 * (0,75 → 0,60 → 0,375). Es rápido, y es la consecuencia directa de que el
 * contrato no deje priors más fuertes: quien quiera un instinto más terco tiene
 * que cambiar `cuantasVeces`, no esta tabla.
 *
 * ─── EL PRESUPUESTO, que es la parte incómoda ─────────────────────────────
 *
 * «Cinco filas hoy son cincuenta cuando el mundo tenga treinta sustancias» es la
 * advertencia del documento, y con ESTA clave la aritmética es otra y conviene
 * escribirla porque cambia qué hay que vigilar:
 *
 *   · **agregar una sustancia no agrega ni una fila.** Una sustancia nueva cae
 *     en una de las 64 claves que ya existen, porque la clave no la nombra: la
 *     mide. Ésa es toda la razón de haber tirado `b.name`.
 *   · **agregar un TAG multiplica los casilleros**: hoy son 64 × 7 = 448, y un
 *     octavo tag los lleva a 512. El catálogo de tags está CERRADO (7).
 *   · **agregar un RASGO duplica los contextos**: un sexto rasgo lleva 64 a 128,
 *     y con él hay que revisar las cinco filas una por una, porque una fila
 *     escrita para `mc--e` deja de cubrir a `mc--e-`. Que la tabla no pueda
 *     escribir una forma inválida lo ataja `fila()`, que se corre al cargar.
 *
 * O sea: el presupuesto no crece con las sustancias —que es lo abierto— sino con
 * las cualidades y los tags, que son catálogos cerrados. Lo que hay que vigilar
 * no es el mundo creciendo: es alguien agregando un rasgo acá.
 */
export const INSTINTO: readonly Instinto[] = [
  // 1. LA FILA DEL DOCUMENTO. «Un cuerpo de agua rinde carnoso.» Lo que la
  //    criatura ve en el pozo es algo que hay, que alimenta y que arde, parado en
  //    agua franca — medido sobre los pozos de verdad de la semilla en el test.
  fila('agua', 'mc--e', 'carnoso', { a: 1.5, b: 0.5 }),
  // 2. Y en tierra también: lo que alimenta rinde carne. Es la misma inclinación
  //    con el lugar cambiado, y hace falta porque si no, una criatura con hambre
  //    parada al lado de un animal no tendría ninguna razón para acercarse.
  fila('tierra', 'mc--e', 'carnoso', { a: 1.5, b: 0.5 }),
  // 3. De lo que sirve de atadura salen hebras. Es la que abre la cadena de la
  //    caña: sin ella, deshilachar el matorral no se le ocurre a nadie.
  fila('tierra', 'm-a-e', 'fibroso', { a: 1.5, b: 0.5 }),
  // 4. LA QUE REEMPLAZA A `pursueWarmth`: de lo duro que arde sale con qué hacer
  //    fuego. No dice «leña» ni nombra la madera; dice rígido y combustible, que
  //    es lo que la criatura puede medir.
  fila('tierra', 'm--re', 'vegetal', { a: 1.5, b: 0.5 }),
  // 5. LA ÚNICA QUE SE INCLINA AL NO, y hace falta tanto como las otras cuatro:
  //    de lo duro que NO arde no sale carne. Sin ella, una criatura con hambre
  //    gasta el tick tanteando piedras, porque un contexto sin fila arranca en
  //    Beta(1,1) —media 0,5— y medio punto de probabilidad sobre una piedra a una
  //    celda le gana a un río a ocho.
  fila('tierra', 'm--r-', 'carnoso', { a: 0.5, b: 1.5 }),
]

// ─── Las creencias ──────────────────────────────────────────────────────────

/**
 * El prior de un contexto del que nadie dijo nada: uniforme, fuerza 2, cero
 * observaciones propias. `media` da 0,5 y `cuantasVeces` da 0.
 *
 * Congelado porque `belief` lo devuelve POR IDENTIDAD cuando el casillero no
 * existe —que es el camino más caliente de todos, uno por tag y por cuerpo a la
 * vista y por tick— y quien lo reciba tiene el mismo objeto que todos los demás.
 * `readonly` lo cuida en tipos; esto lo cuida en runtime. Es el mismo argumento
 * de `Contexto.#muerta` en `@anima/perceive`.
 */
const PRIOR_LLANO: Beta = Object.freeze({ a: 1, b: 1 })

/** De dónde salió el prior de un casillero. `'nadie'` es el `PRIOR_LLANO`. */
type Origen = 'nadie' | 'instinto' | 'modelo'

interface Cuenta {
  prior: Beta
  por: Origen
  /**
   * La evidencia PROPIA, guardada aparte del prior a propósito: es lo que hace
   * que `seed()` pueda cambiar el prior sin borrar lo que la criatura vivió, que
   * es la mitad de «la evidencia pisa al instinto». Con un solo Beta acumulado no
   * habría forma de reemplazar uno sin llevarse puesto lo otro.
   */
  exitos: number
  fracasos: number
}

interface Cajon {
  /** Ordenados por unidad de código. Ver `tagsDe`. */
  readonly tags: string[]
  readonly cuentas: Map<string, Cuenta>
}

const NINGUN_TAG: readonly string[] = Object.freeze([])

/**
 * UN CASILLERO VOLCADO, en datos planos que aguantan el viaje por JSON.
 *
 * Ver `Creencias.volcar` para por qué el prior sólo viaja cuando lo puso el
 * modelo, y para el error que eso evita.
 */
export interface CreenciaVolcada {
  readonly ctx: ContextKey
  readonly rinde: string
  readonly exitos: number
  readonly fracasos: number
  /** Sólo cuando el prior NO es de fábrica: el que puso el modelo. */
  readonly prior?: { readonly a: number; readonly b: number }
}

export class Creencias implements AffordanceMemory {
  readonly #cajones = new Map<ContextKey, Cajon>()

  /**
   * Nace con el instinto puesto. No es una comodidad: una criatura sin instinto
   * y con la clave de arriba tiene 64 contextos todos en 0,5, así que su primera
   * decisión la toma el desempate por id — o sea que ninguna criatura recién
   * nacida iría nunca al río, y el criterio del Hito 5 no arrancaría.
   */
  constructor() {
    for (const i of INSTINTO) this.seed(i.ctx, i.rinde, i.prior, 'instinto')
  }

  /**
   * El posterior: el prior más lo que la criatura vio.
   *
   * NO CREA el casillero, y eso importa más de lo que parece: `opportunities()`
   * pregunta por cada tag de cada cuerpo a la vista, y si preguntar anotara,
   * `tagsDe` crecería con cada pregunta hasta devolver los siete tags en los 64
   * contextos. Una lectura que escribe convierte a la memoria en un registro de
   * lo que se preguntó, no de lo que pasó.
   */
  belief(ctx: ContextKey, rinde: string): Beta {
    const c = this.#cajones.get(ctx)?.cuentas.get(rinde)
    if (c === undefined) return PRIOR_LLANO
    return { a: c.prior.a + c.exitos, b: c.prior.b + c.fracasos }
  }

  /** Una observación propia. Se suma sobre el prior; el prior no se toca. */
  observe(ctx: ContextKey, rinde: string, ok: boolean): void {
    const c = this.#cuenta(ctx, rinde)
    if (ok) c.exitos += 1
    else c.fracasos += 1
  }

  /**
   * Poner un prior. Nunca toca la evidencia.
   *
   * ─── LA FUERZA DEL PRIOR LA FIJA EL CONTRATO, Y ACÁ SE HACE CUMPLIR ───────
   *
   * `cuantasVeces` de `tipos.ts` resta 2 y su comentario dice «los priors valen 2
   * y no cuentan». O sea que un prior de cualquier otra fuerza hace que la
   * criatura informe observaciones que no tuvo — y ese número no se queda
   * adentro: `Opportunity.porque` lo imprime («p=0,50, n=3») y el cuidador lo lee.
   * Por eso esto LANZA en vez de normalizar: normalizar cambiaría en silencio lo
   * que el llamador quiso decir, y un prior más fuerte es una decisión legítima
   * que hay que tomar cambiando el contrato, no acá.
   *
   * La comparación es contra `cuantasVeces(prior) !== 0` y no contra `a+b !== 2`
   * para no transcribir el 2: si mañana el contrato cambia la resta, esto la sigue
   * sola.
   *
   * ─── Y LA REGLA DE LAS TRES FUENTES, EJECUTABLE ─────────────────────────
   *
   * El modelo siembra CONTEXTOS NUEVOS: `por: 'modelo'` sobre un casillero que ya
   * tiene instinto no hace nada. No es desconfianza del modelo, es la precedencia
   * escrita: el instinto es del genoma y el modelo es una hipótesis de afuera.
   * Sobre la EVIDENCIA no manda ninguno de los dos, y de eso se encarga que
   * `exitos`/`fracasos` no se toquen nunca acá.
   */
  seed(ctx: ContextKey, rinde: string, prior: Beta, por: 'instinto' | 'modelo'): void {
    if (!(prior.a > 0) || !(prior.b > 0)) {
      throw new RangeError(
        `Beta(${String(prior.a)}, ${String(prior.b)}) no es una Beta: los dos parámetros son > 0`,
      )
    }
    if (cuantasVeces(prior) !== 0) {
      throw new RangeError(
        `Beta(${String(prior.a)}, ${String(prior.b)}) dice tener ${String(cuantasVeces(prior))} ` +
          `observaciones propias detrás, y un prior no vio nada. La fuerza de un prior la fija ` +
          `\`cuantasVeces\` de \`tipos.ts\`, que resta 2: un prior tiene que sumar exactamente eso.`,
      )
    }
    const c = this.#cuenta(ctx, rinde)
    if (por === 'modelo' && c.por === 'instinto') return
    c.prior = prior
    c.por = por
  }

  /**
   * Los tags que alguna vez se creyó que rinden acá, EN ORDEN TOTAL Y ESTABLE.
   *
   * Ordenados por unidad de código y no por orden de llegada. Con el orden de
   * llegada, dos criaturas que vivieron lo mismo en distinto orden listarían lo
   * mismo distinto, y `opportunities()` —que recorre esta lista para armar los
   * `id` con los que después desempata— produciría dos órdenes de oportunidades
   * para el mismo estado. Es el mismo argumento de la decisión 4 de `tipos.ts`,
   * un piso más abajo.
   *
   * `localeCompare` está prohibido por la regla 2 (el orden dependería del idioma
   * del sistema); la comparación es la de siempre, `<` sobre las unidades de
   * código, que es total y la misma en todo motor.
   */
  tagsDe(ctx: ContextKey): readonly string[] {
    return this.#cajones.get(ctx)?.tags ?? NINGUN_TAG
  }

  /** Los contextos de los que sabe algo, en orden estable. Para tests y crónica. */
  contextos(): readonly ContextKey[] {
    return [...this.#cajones.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  }

  /** De dónde salió el prior de un casillero. Para el «por qué» y para los tests. */
  origenDe(ctx: ContextKey, rinde: string): 'nadie' | 'instinto' | 'modelo' {
    return this.#cajones.get(ctx)?.cuentas.get(rinde)?.por ?? 'nadie'
  }

  /**
   * LO QUE ESTA CRIATURA VIVIÓ, en datos planos y sin el instinto adentro.
   *
   * ─── POR QUÉ NO VUELCA EL PRIOR, Y ES LA LÍNEA ENTERA ───────────────────────
   *
   * Porque **el constructor ya siembra el instinto**: una `Creencias` nueva nace
   * con `INSTINTO` puesto. Si esto volcara `belief()` —que es el posterior, o sea
   * prior más evidencia— y del otro lado se cargara sobre una criatura recién
   * nacida, el instinto se contaría DOS VECES, y cada guardado y restaurado lo
   * volvería a duplicar. Una criatura que se guarda diez veces terminaría con un
   * instinto diez veces más terco que el de fábrica, sin haber visto nada.
   *
   * Así que se vuelca **sólo lo propio**: los éxitos y los fracasos que ella
   * contó. El prior lo pone el constructor de la heredera, que es de quien tiene
   * que ser.
   *
   * Lo que sí viaja aparte es el ORIGEN de los priors que NO son de fábrica —los
   * que puso el modelo con `seed(..., 'modelo')`—, porque ésos no los reconstruye
   * ningún constructor y perderlos sería perder lo que el cuidador enseñó.
   *
   * ─── Y POR QUÉ ES UN ARREGLO Y NO UN OBJETO ────────────────────────────────
   *
   * Una `ContextKey` lleva `|` y `:` adentro (`agua|mc--e`, `celda:3,4`) y usarla
   * de clave de objeto la hace pasar por `JSON.parse`, que no garantiza el orden
   * de las claves. El orden acá es estable —`contextos()` ordena— y un arreglo lo
   * conserva, que es lo que hace que dos volcados de la misma memoria sean el
   * mismo texto.
   */
  volcar(): readonly CreenciaVolcada[] {
    const out: CreenciaVolcada[] = []
    for (const ctx of this.contextos()) {
      const cajon = this.#cajones.get(ctx)
      if (cajon === undefined) continue
      for (const rinde of cajon.tags) {
        const c = cajon.cuentas.get(rinde)
        if (c === undefined) continue
        // Lo que no aporta nada no viaja: un casillero con el prior de fábrica y
        // cero observaciones es exactamente lo que la heredera ya va a tener.
        if (c.exitos === 0 && c.fracasos === 0 && c.por !== 'modelo') continue
        out.push(
          c.por === 'modelo'
            ? { ctx, rinde, exitos: c.exitos, fracasos: c.fracasos, prior: { a: c.prior.a, b: c.prior.b } }
            : { ctx, rinde, exitos: c.exitos, fracasos: c.fracasos },
        )
      }
    }
    return out
  }

  /**
   * CARGA LO VOLCADO ENCIMA DE LO QUE HAY. No reemplaza: suma.
   *
   * Es una decisión y no una comodidad. La heredera nace con su instinto y
   * después recibe el testimonio de la anterior, que es exactamente el orden del
   * ADR 0009 —*«la heredera recibe testimonio, no hechos»*—. Reemplazar borraría
   * el instinto de fábrica en los casilleros heredados, y la heredera arrancaría
   * peor que una recién nacida en todo lo que su antecesora tocó poco.
   */
  cargar(volcado: readonly CreenciaVolcada[]): void {
    for (const v of volcado) {
      const c = this.#cuenta(v.ctx, v.rinde)
      if (v.prior !== undefined) {
        c.prior = { a: v.prior.a, b: v.prior.b }
        c.por = 'modelo'
      }
      c.exitos += v.exitos
      c.fracasos += v.fracasos
    }
  }

  #cuenta(ctx: ContextKey, rinde: string): Cuenta {
    let cajon = this.#cajones.get(ctx)
    if (cajon === undefined) {
      cajon = { tags: [], cuentas: new Map<string, Cuenta>() }
      this.#cajones.set(ctx, cajon)
    }
    let c = cajon.cuentas.get(rinde)
    if (c === undefined) {
      c = { prior: PRIOR_LLANO, por: 'nadie', exitos: 0, fracasos: 0 }
      cajon.cuentas.set(rinde, c)
      // Inserción ordenada. La lista tiene a lo sumo tantos elementos como tags
      // haya (7), así que buscar el lugar de a uno es más barato que ordenar.
      let i = 0
      while (i < cajon.tags.length && (cajon.tags[i] ?? '') < rinde) i++
      cajon.tags.splice(i, 0, rinde)
    }
    return c
  }
}

// ═══ EL COLAPSO DE CAUSAS ═══════════════════════════════════════════════════
//
// El propio proyecto ya se lo reprochó al Beta —«un Beta por (contexto, tag) no
// distingue "no hay pescado" de "no sé pescar"; colapsa dos causas del fracaso en
// un solo posterior»— y la prueba T2.4 de la escalera de capacidades lo dice con
// tres: **«no pica», «no hay» y «se me rompió la herramienta»**.
//
// Y el MUNDO ya las distingue, con todas las letras. `world/src/step.ts` declara
// cuatro motivos de fracaso de una extracción y escribe al lado por qué son
// cuatro: «las cuatro piden decisiones OPUESTAS […] "este cuerpo no es un pozo"
// se arregla apuntando a otro lado, "no picó" se arregla insistiendo, "el pozo
// está vacío" se arregla caminando, y "el lugar ya dio todo" no se arregla nunca
// más y hay que mudarse. Una criatura que no las pueda distinguir insiste para
// siempre en un río muerto». O sea que la información existe y viaja: lo que
// falta es por dónde meterla acá.
//
// Este diseño distingue UNA de las tres, y no por el Beta:
//
//   «NO HAY» → SÍ, y por la CLAVE, gracias al rasgo `m`. Un pozo agotado tiene
//     masa cero —`cuerpoDePozo` con población 0, que es lo que `stepWorld`
//     construye cuando el stock se vacía— y cae en `agua|-c--e` en vez de
//     `agua|mc--e`. La criatura no aprende «el agua no rinde»: deja de reconocer
//     eso como la clase de cosa que rinde, que es distinto y es lo correcto.
//     Medido en el test. Y no salió gratis: `nutrition` y `fuelEnergy` son
//     INTENSIVAS —un banco vacío sigue marcando `nutrition = 6,0000`— así que sin
//     el rasgo `m` los dos pozos eran LA MISMA CLAVE. Se midió primero y se
//     agregó el rasgo después, que es el orden correcto.
//
//   «NO PICA» vs «SE ME ROMPIÓ» → NO, y es un hueco real, con su `it.fails`.
//     Las dos son `observe(ctx, 'carnoso', false)` y las dos caen en el mismo
//     casillero, porque **la herramienta no está en la clave**: la clave describe
//     el cuerpo AL QUE SE LE SACA algo, y la caña gastada es otro cuerpo. Dos
//     criaturas —una con la caña sana y el pozo con suerte esquiva, otra con la
//     caña deshecha— terminan con el MISMO Beta, y tendrían que hacer cosas
//     opuestas: la primera insistir, la segunda ir a atar otra.
//
// QUÉ COSTARÍA CERRARLO, dicho para que no parezca gratis: `observe` tendría que
// llevar la causa —el `Motivo` del mundo, que ya existe—, y eso es `tipos.ts`, el
// contrato compartido que este tramo no toca; el casillero pasaría de un Beta a
// uno por causa; y `Opportunity.valor` tendría que componerlos, porque «p»
// dejaría de ser un número. Lo que falta no es información: es ancho de banda en
// la firma.
