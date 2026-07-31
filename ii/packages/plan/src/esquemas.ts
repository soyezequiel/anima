// ─── @anima/plan/esquemas.ts ─────────────────────────────────────────────────
//
// QUÉ ESTABLECE QUÉ. Es la tabla sobre la que regresa `plan()`, y es el módulo
// que decide si el paquete sirve: si estas diez filas son recetas, el
// planificador es un recetario con pasos de más; si son física verificada, la
// caña la arma la aritmética y nadie escribió «caña».
//
// ─── LAS TRES FUENTES, Y POR QUÉ NO ALCANZA CON UNA ─────────────────────────
//
//   (a) LO DECLARADO. Cada trozo de `Process.establishes` de los cuatro procesos
//       de la semilla. Es mecánico y sale del catálogo: seis filas.
//   (b) LOS PUENTES DE PROCESO. Lo que `establishes` NO dice y el proceso SÍ
//       hace. Tres filas, y cada una lleva su evidencia medida en `PUENTES`.
//   (c) LAS LEYES. Lo que no hace ningún proceso porque no lo hace NADIE: corre
//       solo. Una fila —la cocción— y es puente por construcción: una ley no
//       tiene `establishes` que declarar, así que lo único que la respalda es una
//       medición. Ver `EsquemaDeLey` en `tipos.ts` para el porqué de la forma.
//
// El puente que ordena todo el módulo: `extraccion` le pide al rol `gear`
// `reach >= 2 ∧ catch > 0`, y NINGUNO de los cuatro procesos declara `catch` en
// su `establishes`. Un índice derivado de `establishes` sería honesto y estaría
// VACÍO justo en la única cualidad que separa una vara de una caña. Pero la
// pesca funciona hoy: `union` de una vara de 1 kg con una hebra de liana de
// 0,2 kg da `catch = 0,1500`, medido —ver `PUENTES`—. O sea que `union`
// establece `catch > 0`, con la condición de que los roles sean los correctos, y
// esa condición es conocimiento humano que hay que escribir.
//
// ─── LA CONDICIÓN MÁS CARA DE TODAS, Y NO SE PUEDE ESCRIBIR EN `roleHints` ───
//
// Para que `union` deje `catch > 0` el rol OPCIONAL `b` tiene que estar AUSENTE.
// Con `b`, el atador se gasta en la atadura y queda como `Joint.via`: no
// sobrevive como parte, no hay hebra, no hay punta libre y `catch` da CERO —
// medido: la misma vara y la misma hebra atando dos varas dan `reach = 8,0000` y
// `catch = 0,0000`—. Sin `b`, el atador sobrevive atado de un solo lado y le
// queda una punta suelta.
//
// `roleHints` es un `Record<RoleName, Where>`: sabe pedirle cosas a un rol y NO
// sabe decir «este rol va vacío». Así que la ausencia de `b` se escribe
// OMITIENDO la clave, y la convención queda dicha acá porque no está en el tipo:
// **quien ejecute un esquema llena exactamente los roles que `roleHints` nombra,
// y ninguno más**. Un esquema que quisiera un rol sin condiciones extra lo pide
// con un `Where` vacío (`[]`), que no es lo mismo que no nombrarlo.
//
// ─── POR QUÉ `segundos` NO ESTÁ ESCRITO EN NINGUNA FILA ─────────────────────
//
// Sale del catálogo con `segundosDe()`. Escribirlo a mano sería la segunda copia
// de un número que ya existe —el bug de `DSL_REFERENCE` de Ánima I— y encima uno
// que se lee mal: `completion.at` es una `Duracion` EN SEGUNDOS DE MUNDO
// (ADR II-0008), no un conteo de ticks, y atar tarda un segundo a 20 Hz y a
// 100 Hz.

import {
  HUMEDAD_QUE_APAGA,
  MONTAJES,
  SEED_PROCESSES,
  SUSTANCIAS_SEMILLA,
  T_AMBIENTE,
  baseRoleName,
  evalQuality,
  temperaturaDeEquilibrio,
  specOf,
  type Montaje,
  type Process,
  type ProcessId,
  type QualityTest,
  type Substance,
  type Tag,
} from '@anima/physics'

import { firmaDe, textoDe } from './predicado.js'
import type {
  ConstructionSchema,
  EsquemaDeLey,
  EsquemaDeProceso,
  PredicateSignature,
  RoleName,
} from './tipos.js'

// ─── Los dos números de calibración que este módulo aporta ──────────────────

/**
 * Cuánta `heatCapacity` puede llevar a 400 °C una criatura con el tanque LLENO.
 *
 * No es una preferencia: es el despeje de la cuenta que el mundo cobra de verdad
 * en `world/src/step.ts` (`aplicarEfectos`, caso `drive`), que es
 * `heatCapacity × ΔT / eficiencia` de `stamina`. Con el techo de `stamina` del
 * catálogo (1000), la eficiencia del `poweredBy` de `friccion` (0,35) y el salto
 * desde el ambiente hasta lo que `friccion` promete (400 − 15 = 385 grados), el
 * techo exacto es 1000 × 0,35 / 385 = **0,909091**. Acá va 0,9 y no 0,909091 a
 * propósito: el tanque nunca está lleno cuando hay hambre, y redondear PARA
 * ABAJO se equivoca del lado de no prometer un fuego que no va a salir.
 *
 * Y de este número solo sale, sin que nadie escriba «yesca»: madera de 0,2 kg
 * tiene `heatCapacity` 0,3400 y cuesta 374 de aliento; la de 0,5 kg tiene 0,8500
 * y cuesta 935; la de 1 kg tiene 1,7000 y cuesta 1870, o sea casi dos tanques
 * llenos, o sea que NO SE PUEDE ENCENDER. Medido — ver `PUENTES`.
 *
 * El test cruza este 0,9 contra el catálogo, así que si mañana `stamina` cambia
 * de techo o `friccion` cambia de eficiencia, se pone rojo.
 */
export const TECHO_DE_YESCA = 0.9

/**
 * Y cuánta `heatCapacity` puede tener lo que se deshilacha para que la hebra que
 * salga entre abajo del techo de arriba.
 *
 * `deshilachar` parte a favor del grano y la hebra que sale se lleva
 * `FRACCION_DE_HEBRA = 0,1` de la masa (`world/src/step.ts`). `heatCapacity` es
 * EXTENSIVA —es `mass × specificHeat`— así que la hebra se lleva también la
 * décima parte del calor que hay que pagar: 0,9 / 0,1 = **9**.
 *
 * Los dos números están escritos como literales y no como una división entre
 * ellos porque `0.9 / 0.1` da 8,999999999999998 en IEEE-754 y esa firma no la
 * empareja nadie. El test verifica la relación contra la constante REAL del
 * mundo, que es la única forma honesta de apoyarse en algo que vive en otro
 * paquete.
 */
export const TECHO_DE_LO_DESHILACHABLE = 9

// ─── El catálogo, mirado de a un proceso ────────────────────────────────────

const POR_ID: ReadonlyMap<ProcessId, Process> = new Map(SEED_PROCESSES.map((p) => [p.id, p]))

/**
 * Lanza si el proceso no existe, igual que `specOf` con una cualidad y por la
 * misma razón: un `via` que el catálogo no conoce es un error de programa, no un
 * dato faltante, y devolver `undefined` lo dejaría propagarse hasta un esquema
 * con `segundos = NaN` que ordena la búsqueda al azar cuarenta ticks después.
 *
 * Exportada porque la regresión necesita LO MISMO —los roles, el `arrangement`,
 * los efectos y los rendimientos del proceso que un esquema nombra— y una
 * segunda búsqueda sobre `SEED_PROCESSES` escrita allá sería la segunda copia
 * de esta decisión, incluido el «lanza en vez de devolver `undefined`».
 */
export function procesoDe(via: ProcessId): Process {
  const p = POR_ID.get(via)
  if (p === undefined) throw new RangeError(`proceso que el catálogo no conoce: ${via}`)
  return p
}

/**
 * Cuántos SEGUNDOS DE MUNDO cuesta aplicar este proceso, leídos del catálogo.
 *
 * Dos formas, porque los cuatro procesos de la semilla son de dos clases:
 *
 *   - los que TERMINAN (`union`, `deshilachar`, `extraccion`) traen
 *     `completion.at`, que ya es una duración en segundos. Se lee y listo;
 *   - `friccion` NO TERMINA: no tiene `completion`, tiene un `drive` que empuja
 *     mientras haya con qué pagar. Lo que dura es lo que tarda ese empuje en
 *     cruzar lo que el proceso promete, saliendo del ambiente: 400 − 15 grados a
 *     120 grados por segundo son **3,2083 segundos**. Los tres segundos del
 *     comentario de `FRICCION` son hasta 375 °C, no hasta los 400 que promete.
 *
 * Ninguno de los dos números se escribe acá: los dos se calculan de `Process`.
 */
function segundosDe(via: ProcessId): number {
  const p = procesoDe(via)
  const at = p.completion?.at
  if (at !== undefined) return at
  let peor = 0
  for (const e of p.effects) {
    if (e.k !== 'drive') continue
    if (!(e.porSegundo > 0)) continue
    const d = (e.toward - T_AMBIENTE) / e.porSegundo
    const abs = d < 0 ? -d : d
    if (abs > peor) peor = abs
  }
  return peor
}

/**
 * Una fila, con los `segundos` puestos por el catálogo y no por quien escribe.
 *
 * Los dos campos opcionales se agregan sólo si vinieron, y no con `undefined`: un
 * `{ cellHints: undefined }` no es lo mismo que no tener la clave para nada que
 * recorra el objeto —una traza, un `toEqual`, una firma— y `exactOptionalPropertyTypes`
 * lo rechazaría de todos modos.
 */
function esquema(
  establishes: PredicateSignature,
  via: ProcessId,
  roleHints: ConstructionSchema['roleHints'],
  extra?: {
    readonly cellHints?: ConstructionSchema['cellHints']
    readonly roleFilters?: ConstructionSchema['roleFilters']
    readonly roleNoDeLaMano?: ConstructionSchema['roleNoDeLaMano']
  },
): EsquemaDeProceso {
  return {
    k: 'proceso',
    establishes,
    via,
    roleHints,
    ...(extra?.roleFilters === undefined ? {} : { roleFilters: extra.roleFilters }),
    ...(extra?.roleNoDeLaMano === undefined ? {} : { roleNoDeLaMano: extra.roleNoDeLaMano }),
    ...(extra?.cellHints === undefined ? {} : { cellHints: extra.cellHints }),
    segundos: segundosDe(via),
  }
}

/**
 * LA CLAVE DE AGRUPACIÓN: qué esquemas se pueden juntar en UNA sola aplicación.
 *
 * Dos esquemas del mismo proceso se aplican juntos y el costo se cobra UNA vez —es
 * lo que hace que `catch>0 ∧ reach>=2` salga de un solo `union`—. Dos esquemas de
 * ley NO se juntan: cada fila declara su propia pila y su propio `mientras`, y
 * juntarlas exigiría decidir cómo se apilan dos pilas, que es una decisión que
 * ninguna de las dos filas tiene. Por eso la clave de una ley lleva adentro su
 * `establishes` y la de un proceso no.
 */
export function claveDeVia(e: ConstructionSchema): string {
  if (e.k === 'proceso') return `proceso:${e.via}`
  // ─── UNA OBRA ES SU REVISIÓN, Y NADA MÁS LA AGRUPA ────────────────────────
  //
  // Dos filas que arman la MISMA revisión se pueden aplicar juntas —es la misma
  // construcción prometiendo dos cosas— y dos revisiones distintas nunca, aunque
  // prometan lo mismo: son dos obras y hay que armar las dos. El `establishes` NO
  // entra en la clave, al revés que en la ley, y la asimetría tiene motivo: una
  // ley se distingue por la SITUACIÓN que hay que armarle, y dos situaciones
  // distintas de la misma ley son dos pilas incompatibles; una obra se distingue
  // por la obra, y armarla es armarla.
  if (e.k === 'obra') return `obra:${e.revision}`
  return (
    // ─── Y LA GEOMETRÍA ENTRA EN LA CLAVE, QUE ES LO QUE HACE QUE HAYA TRES ──
      //
      // Desde que la cocción tiene una fila POR MONTAJE, tres filas comparten ley y
      // `establishes` y se distinguen sólo en dónde va la comida. Con la clave
      // vieja las tres caían en la misma vía, `esquemasQueAportan` las devolvía
      // juntas y `armarMarco` rechazaba la vía entera con «no nombran los mismos
      // roles» —una nombra `parrilla` y las otras no—: la tabla habría tenido tres
      // filas y la búsqueda, ninguna. La pila y la distancia SON la fila.
    `ley:${e.ley}:${e.establishes}:${e.pila.join('>')}@${String(e.distancia)}`
  )
}

/**
 * A partir de cuánta humedad de celda una celda ES AGUA y no orilla.
 *
 * El número no es una preferencia: el agua franca del decreto vale exactamente
 * `wet = 1,0000` en los ocho primeros pozos de la semilla, y la orilla desde la
 * que se pesca —la celda seca pegada al pozo, donde la criatura se para— vale
 * `0,6000`. Medido en `los-esquemas-contra-el-mundo.test.ts`. 0,9 cae en el medio
 * de las dos poblaciones y del lado del agua, que es el lado seguro: lo que se
 * quiere evitar es que una piedra tirada en la orilla pase por pozo, no que un
 * pozo deje de serlo por una décima.
 *
 * Está exportado para que el test pueda cruzarlo contra el mundo en vez de
 * transcribirlo: si el decreto cambiara la humedad del agua franca, se pone rojo.
 */
export const AGUA_FRANCA = 0.9

// ─── LO QUE NO ENTRA EN UNA MANO, PREGUNTADO AL CATÁLOGO ────────────────────

/**
 * El «no» de `portable`, que es el PISO DE SU RANGO y no un cero elegido.
 *
 * `portable` es una cualidad derivada con forma de escalón —`step(8 − mass)`, ver
 * abajo— así que sólo toma los dos extremos de su rango, y decir «no entra en la
 * mano» es decir «vale el mínimo». Se lee de `specOf` y no se escribe: si mañana
 * el catálogo le cambiara el rango, esto lo sigue.
 */
export const PISO_DE_PORTABLE: number = specOf('portable').range[0]

/**
 * A PARTIR DE CUÁNTOS KILOS ALGO DEJA DE ENTRAR EN UNA MANO, despejado de la
 * expresión derivada de `portable` y no transcripto.
 *
 * El número no es de este archivo ni de este paquete: es la constante con la que
 * `world/src/step.ts` rechaza un `take` con motivo `no-portable`
 * (`qualityOf(c.body,'portable') <= 0`). O sea que **todo lo que una criatura
 * pudo levantar tiene `portable > 0` por construcción del mundo**, y ésa es la
 * mitad que hace que la condición de la pesca no sea una aproximación: pedirle al
 * `source` que NO sea portátil descarta la mano entera.
 *
 * Se verifica la FORMA antes de leer el número —igual que `puntasLibres` hace con
 * `catch` en el arnés— porque un `portable` que dejara de ser un escalón sobre la
 * masa haría que este despeje devolviera un número equivocado en silencio.
 * Medido: 8 kg.
 */
export const MASA_QUE_NO_ENTRA_EN_LA_MANO: number = (() => {
  const e = specOf('portable').derived
  if (e === undefined || e.k !== 'op' || e.f !== 'step' || e.a.k !== 'const' || e.b.k !== 'own' || e.b.q !== 'mass') {
    throw new RangeError('`portable` dejó de ser `step(const, mass)`: el despeje de su umbral ya no vale')
  }
  return e.a.v
})()

/**
 * «NO ENTRA EN UNA MANO», DESPEJADO DEL CATÁLOGO — Y NO LA USA NINGUNA FILA.
 *
 * Fue la condición del `source` de la pesca y se sacó: ver el bloque de la fila,
 * que lleva escrito lo que costaba (11 partidas de 20 sin un solo banco elegible).
 * Queda exportada porque lo que dice sobre el MUNDO es cierto y hay dos tests que
 * lo cruzan contra el motor —el mundo rechaza `take` sobre el banco con
 * `no-portable`, y el escalón separa de verdad al banco de su pieza—, y porque el
 * día que la superficie sepa decir «esto es un pozo» este umbral es una de las dos
 * cosas que van a querer volver a mirarse. Escribirla acá y no adentro de la fila
 * es lo que deja que el test la cruce contra el catálogo sin transcribirla, igual
 * que `AGUA_FRANCA`.
 */
export const NO_ENTRA_EN_LA_MANO: QualityTest = { q: 'portable', op: '<=', v: PISO_DE_PORTABLE }

// ─── LO QUE HACE FALTA PARA COCINAR, DESPEJADO DEL CATÁLOGO ─────────────────
//
// Nada de este bloque es una preferencia. Son tres cuentas sobre números que ya
// existen —`denaturesAt` e `ignitionPoint` de las sustancias, las tres
// exposiciones de montaje, el acoplamiento con el ambiente— y de ellas sale sola
// la técnica emblema del proyecto: **la parrilla**.

/**
 * ¿Hasta dónde puede calentar un fuego de esta potencia, según cómo se apoye lo
 * que se cocina y a qué distancia? Es la ley 1 en régimen, PREGUNTADA AL MOTOR
 * (`temperaturaDeEquilibrio`) y no transcripta.
 */
function equilibrioSobre(potencia: number, montaje: Montaje, distancia: number): number {
  return temperaturaDeEquilibrio(potencia, distancia, montaje)
}

/**
 * LA INVERSA, DESPEJADA SOBRE DOS PUNTOS DEL MOTOR Y NO TRANSCRIPTA.
 *
 * Acá estaba escrito `((t − T_AMBIENTE) · H_PERDIDA) / EXPOSICION[montaje]`, que
 * es la fórmula de la ley 1 copiada a mano, y una fórmula copiada mide su propia
 * copia: el día que `formFactor` deje de ser lineal en la potencia —o que aparezca
 * un término más— este módulo seguiría contestando lo de siempre, en verde.
 *
 * La ley 1 en régimen SÍ es afín en la potencia (`T = a + b·P` con `b` función del
 * montaje y de la distancia), así que se la invierte muestreándola en `P = 0` y
 * `P = 1` y nada más. Los tres números que antes se importaban —el ambiente, el
 * acoplamiento y la exposición— dejan de estar escritos acá: los tres viajan
 * adentro de los dos puntos.
 */
function potenciaPara(temperatura: number, montaje: Montaje, distancia: number): number {
  const cero = temperaturaDeEquilibrio(0, distancia, montaje)
  const porUnidad = temperaturaDeEquilibrio(1, distancia, montaje) - cero
  return (temperatura - cero) / porUnidad
}

/**
 * LA VENTANA DE COCCIÓN DE UN TAG, en grados, leída de las sustancias.
 *
 * `piso` es el `denaturesAt` MÁS ALTO de las sustancias del tag —abajo de eso hay
 * alguna que ni empieza— y `techo` el `ignitionPoint` MÁS BAJO —arriba de eso hay
 * alguna que se prende fuego—. Las dos puntas son la ventana que la ley 5 lee de
 * verdad: `ventanaDeCoccion` en `physics/src/leyes.ts` pide
 * `denaturesAt ≤ temperature < ignitionPoint` y encima exige el tag `organico`,
 * así que las sustancias sin `denaturesAt` no entran y no se saltean en silencio:
 * es que la ley no las cocina.
 *
 * Medido para `carnoso`: piso 63 (la carne, que es la que más tarda en empezar) y
 * techo 220 (el huevo, que es el que antes se prende). Las seis del tag, en orden
 * de catálogo: carne 63/280, pescado 55/260, molusco 48/240, huevo 62/220,
 * médula 52/230, grasa 45/300.
 */
interface VentanaDeTag {
  readonly piso: number
  readonly techo: number
  readonly cuantas: number
}

function ventanaDelTag(tag: Tag): VentanaDeTag {
  let piso = Number.NEGATIVE_INFINITY
  let techo = Number.POSITIVE_INFINITY
  let cuantas = 0
  for (const s of SUSTANCIAS_SEMILLA) {
    if (!s.tags.includes(tag)) continue
    // La ley 5 sólo corre sobre lo `organico`: pedirlo acá no es un filtro extra,
    // es la misma guarda leída del mismo lado.
    if (!s.tags.includes('organico')) continue
    const d = s.perUnitMass.denaturesAt
    const ig = s.perUnitMass.ignitionPoint
    if (d === undefined || ig === undefined) continue
    if (d > piso) piso = d
    if (ig < techo) techo = ig
    cuantas++
  }
  if (cuantas === 0) throw new RangeError(`ninguna sustancia orgánica con tag «${tag}» se cocina`)
  return { piso, techo, cuantas }
}

/**
 * A QUÉ TEMPERATURA TIENE QUE QUEDAR LA COMIDA, y por qué no alcanza con el borde
 * de abajo de su ventana.
 *
 * Porque **en el borde la ley empuja a tasa cero**: `leyDesnaturalizacion` calcula
 * `k = (temperature − denaturesAt) / 100` y multiplica las cuatro tasas por `k`,
 * así que una comida parada exactamente en su `denaturesAt` no se cocina nunca. Un
 * esquema que pusiera ahí el piso prometería algo con un `mientras` infinito.
 *
 * El punto medio de la ventana es el único punto de adentro que **los dos bordes
 * determinan**: no hay que elegir un margen, sale de restar los dos números que el
 * catálogo ya tiene. Medido para `carnoso`: (63 + 220) / 2 = 141,5 °C.
 */
function temperaturaDeTrabajo(v: VentanaDeTag): number {
  return (v.piso + v.techo) / 2
}

/**
 * LA VENTANA DE POTENCIA DEL FUEGO **PARA UNA GEOMETRÍA**, y acá está el arreglo
 * entero de este tramo.
 *
 * Un fuego de potencia `P` deja la comida en `ambiente + P · exposicion(montaje) /
 * (1 + d²) / h`. O sea que la temperatura tiene TRES variables libres y no una, y
 * mientras esta función devolvió una sola ventana —la del montaje `parrilla`, a
 * distancia cero— la tabla estaba resolviendo por la única de las tres que no se
 * puede elegir cada vez: **la potencia se elige UNA sola vez, cuando se enciende, y
 * el LUGAR se elige cada vez que se apoya algo.**
 *
 * Con la misma fogata de 1 kg de leña que el Hito 0 calibró (`emitsPower` 300):
 *
 *     piso       15 + 300 · 0,06 / 0,5 =  51 °C  → por debajo de los 63 de la carne
 *     parrilla   15 + 300 · 0,25 / 0,5 = 165 °C  → adentro de la ventana
 *     contacto   15 + 300 · 0,60 / 0,5 = 375 °C  → por encima de los 220 del huevo
 *
 * Leído al derecho, eso decía «hay un montaje que sirve». Leído al revés —que es
 * como hay que leerlo, porque el fuego lo trae la suerte y el lugar lo pone la
 * mano— dice **cada montaje sirve para un fuego distinto**, y cada uno tiene su
 * propia ventana. Nadie escribe cuál: se barren los tres de `MONTAJES`.
 */
function ventanaDePotencia(
  v: VentanaDeTag,
  montaje: Montaje,
  distancia: number,
): { readonly minima: number; readonly maxima: number } {
  return {
    minima: potenciaPara(temperaturaDeTrabajo(v), montaje, distancia),
    maxima: potenciaPara(v.techo, montaje, distancia),
  }
}

/**
 * LO QUE SE LE PIDE A LA PARRILLA, y también sale de la resta.
 *
 * La parrilla NO está en `parrilla`: está en `contacto` con el fuego —es lo que la
 * sostiene—, así que le toca la exposición 0,6 y el equilibrio más bravo de los
 * tres. Con el fuego más grande que ESA fila admite eso da **507 °C** para lo
 * carnoso, y de ahí sale la única condición: que no se prenda fuego a esa
 * temperatura. La piedra (`ignitionPoint` 900, el techo de lo que no arde) entra;
 * una vara de madera (300) no, y por eso una parrilla de madera no es una parrilla
 * sino más leña.
 *
 * El argumento se pasa: es la punta de arriba de la ventana de LA GEOMETRÍA que la
 * usa, no una constante del módulo. Una fila con otro montaje pediría otra cosa —y
 * las dos que no llevan parrilla no piden nada, porque no hay tercer cuerpo.
 */
function ignicionQueAguantaLaParrilla(maxima: number): number {
  return equilibrioSobre(maxima, 'contacto', 0)
}

/** Hasta dónde promete empujar la temperatura un proceso, leído de su `drive`. */
function temperaturaQuePromete(via: ProcessId): number {
  let peor = 0
  for (const e of procesoDe(via).effects) {
    if (e.k !== 'drive') continue
    if (e.q !== 'temperature') continue
    if (e.toward > peor) peor = e.toward
  }
  return peor
}

/**
 * LO QUE FROTAR PUEDE ENCENDER: hasta 400 °C, que es lo que `friccion` promete.
 *
 * Una cosa que se prenda MÁS ARRIBA no la enciende nadie frotando, y ése es
 * exactamente el `step(temperature ≥ ignitionPoint)` del ADR II-0001 leído al
 * revés: no hay verbo «encender», hay un umbral que se cruza o no se cruza.
 */
export const IGNICION_QUE_ALCANZA_FROTANDO = temperaturaQuePromete('friccion')

/** La ventana de la cocción de lo carnoso, expuesta para que el test la cruce. */
export const VENTANA_CARNOSA = ventanaDelTag('carnoso')

/**
 * LA VENTANA DEL FUEGO QUE COCINA **EN LA PARRILLA**, que es lo que este nombre
 * quiso decir siempre. Medido: [253,0000 ; 410,0000), 1,62× de ancho.
 *
 * Se conserva el nombre y la forma porque `@anima/mind` lo lee en sus tests para
 * cotizar y para decidir si un fuego de la partida sirve, y porque sigue siendo
 * cierto lo que decía. Lo que ya no es cierto es que sea LA ventana: son tres, una
 * por montaje, y están en `GEOMETRIAS_DE_LA_COCCION`.
 */
export const POTENCIA_QUE_COCINA_LO_CARNOSO = ventanaDePotencia(VENTANA_CARNOSA, 'parrilla', 0)

/**
 * CUÁNTOS SEGUNDOS HAY QUE DEJAR LA COMIDA EN LA PARRILLA.
 *
 * No se puede despejar: las cuatro tasas de la ley 5 (`COCCION_BASE`,
 * `COCCION_DESTOXIFICA`, `COCCION_DUREZA_PISO`, `DIGESTIBILIDAD_TECHO`) son
 * constantes privadas de `physics/src/leyes.ts` y este paquete no las ve. Así que
 * es un número MEDIDO, y como el `segundos` de `friccion`, es una COTA SUPERIOR y
 * no una predicción — la ley no completa, empuja.
 *
 * Se mide sobre el peor caso admisible y no sobre uno cómodo: el fuego más flojo
 * de la ventana y la sustancia carnosa que más tarda. Ver
 * `tests/los-esquemas-contra-el-mundo.test.ts`, que corre exactamente eso y se pone
 * rojo si este número se queda corto.
 *
 * MEDIDO, con el fuego en el borde de abajo (`emitsPower` 253,00) y piezas de 2 kg,
 * las seis sustancias carnosas de la semilla:
 *
 *     grasa 2,00 s · huevo 3,45 · médula 4,45 · pescado 5,05 · carne 7,50 · molusco 10,10
 *
 * El peor es el molusco —`toughness` 0,55, el más alto, y `toxicity` 0,45, la más
 * alta— y son 10,10 s. Acá van 15, o sea **1,49× de margen**, y no 30: este número
 * también ORDENA la búsqueda, así que inflarlo hace que cocinar parezca más caro de
 * lo que es y que la regresión prefiera cadenas peores.
 *
 * Y hay una razón física para no estirarlo: **el fuego se consume mientras cocina**.
 * Medido en la misma corrida, la leña del borde baja de 253,00 a 202,65 en los
 * 10 s del molusco, o sea que se sale de la ventana que la fila le exige. Alcanza
 * porque para entonces la comida ya está caliente, pero dice algo que la fila no
 * puede decir: `emitsPower` se verifica al planificar y no se sostiene solo.
 */
export const SEGUNDOS_DE_COCCION = 15

/**
 * CUÁNDO ALGO ESTÁ COCIDO. Dos números, y los dos son calibración con respaldo.
 *
 * `digestibility >= 0,85` es el umbral que este proyecto llama «cocido» desde el
 * Hito 0 y con el que se cierra la cadena del fuego en el mundo
 * (`world/tests/el-fuego.test.ts`: `expect(digestibilidad).toBeGreaterThanOrEqual(0.85)`).
 * Está cómodo abajo del techo real de la ley, `DIGESTIBILIDAD_TECHO = 0,95`, que es
 * un límite asintótico: prometer el techo sería prometer un `mientras` infinito.
 *
 * `toxicity <= 0,05` es más fino y sale de otro lado: de LO QUE EL QUE COME PIDE.
 * La innata `comer` se autoimpone `toxicidadTolerada = 0,2` y desde el ADR II-0013
 * esa tolerancia defiende de algo real —el mundo cobra `toxicity × masa` de
 * `stamina` al tragar—. O sea que 0,2 es el umbral que hace que cocinar sirva para
 * algo, y esta fila promete CUATRO VECES más abajo para que la promesa aguante el
 * peor caso admisible sin quedar pegada al borde.
 *
 * Y hay que decir el riesgo: el 0,2 vive como literal adentro de `comer.ts`, no
 * como constante exportada, así que no se puede importar y esto es una segunda
 * copia de una decisión ajena. La mitigación es del test: cruza que lo prometido
 * sea AL MENOS tan fuerte como lo que `comer` tolera, y si alguien afloja `comer`
 * la fila deja de tener sentido y hay que venir a mirarla.
 */
export const DIGESTIBILIDAD_DE_COCIDO = 0.85
export const TOXICIDAD_DE_COCIDO = 0.05

/**
 * La firma que promete la cocción de lo carnoso, ARMADA y no escrita.
 *
 * Pasa por `textoDe` para que salga con las condiciones ordenadas y deduplicadas
 * igual que las escribe `firmaDe`: si esta firma se escribiera a mano con las dos
 * condiciones al revés, el índice tendría una entrada que la regresión no
 * encuentra —el mismo bug que `firmaDe` existe para cerrar—.
 */
export const FIRMA_DE_LO_COCIDO: PredicateSignature = textoDe({
  k: 'sostiene',
  tag: 'carnoso',
  tests: [
    { q: 'digestibility', op: '>=', v: DIGESTIBILIDAD_DE_COCIDO },
    { q: 'toxicity', op: '<=', v: TOXICIDAD_DE_COCIDO },
  ],
})

// ─── LAS GEOMETRÍAS: EL MONTAJE Y LA DISTANCIA, BARRIDOS Y NO ELEGIDOS ───────
//
// Este bloque es el tramo entero. Antes había UNA fila de cocción con el montaje
// clavado en la parrilla y la distancia clavada en cero, y su ventana de potencia
// —[253 ; 410)— no la podía llenar ningún fuego que la criatura sepa encender: el
// techo de la yesca son 0,53 kg de madera, que ardiendo emiten 159. El `gap` decía
// «ningún esquema conocido establece emitsPower<410», y la lectura obvia —«hay que
// poder encender más fuerte»— era la equivocada.
//
// Lo que la ley 1 pide no es una potencia: es una TERNA (fuente, montaje,
// distancia) cuya temperatura de equilibrio caiga en la ventana del cuerpo. Así que
// acá se barren los tres montajes de `MONTAJES` por tres distancias —nueve
// combinaciones—, se le pregunta al motor la ventana de cada una, y las que se
// pueden ARMAR con los pasos que existen se vuelven filas. Ninguna se elige a mano,
// y las siete que se descartan quedan escritas con su ventana y su motivo, que es lo
// que hace que el descarte se pueda discutir en vez de tener que adivinarlo.
//
// Medido: entran DOS —parrilla y contacto, las dos a distancia 0— y de esas dos sólo
// una se puede encender frotando. Ver `yescaPara`.

const FUEGO: RoleName = 'fuego'
const PARRILLA: RoleName = 'parrilla'
const COMIDA: RoleName = 'comida'

/**
 * HASTA QUÉ DISTANCIA SE BARRE. Tres celdas, que es lo que `formFactor` necesita
 * para mostrar su forma: el `1 + d²` divide por 1, por 2 y por 5, o sea que la
 * distancia mueve la ventana MÁS que la diferencia entre dos montajes vecinos.
 *
 * No es «cuántas distancias soporta el emisor» —eso lo decide
 * `porQueNoSePuedeArmar`, y hoy es una sola—: es hasta dónde se mira antes de
 * descartar. Un barrido que sólo mirara el cero no podría decir qué se está
 * perdiendo, y lo que se está perdiendo es lo que el Hito 8 tiene que leer.
 */
const DISTANCIAS_BARRIDAS: readonly number[] = [0, 1, 2]

/**
 * QUÉ PILA DEJA A LA COMIDA EN CADA MONTAJE.
 *
 * Es la única cosa de este bloque que no sale de una cuenta: es cómo lee la
 * geometría `montajeDe` (`world/src/step.ts`), o sea conocimiento del mundo. Por eso
 * cada fila que sale de acá viaja con su evidencia en `PUENTES` y se verifica
 * armando la situación en una partida de verdad.
 *
 *   contacto  la comida APOYADA sobre el fuego —`supportedBy` la fuente—      pila de 2
 *   parrilla  la comida apoyada sobre algo que está en la celda del fuego     pila de 3
 *   piso      la comida en la celda y apoyada en NADA                         NO ES UNA PILA
 *
 * La de `piso` devuelve una pila SIN el sujeto, y eso no es un descuido: `piso` es
 * literalmente la ausencia de apoyo y una pila es una lista de apoyos, así que la
 * geometría del piso no se puede decir con este vocabulario. `porQueNoSePuedeArmar`
 * la descarta con ese motivo escrito; ver ahí el precio y por qué no cuesta nada
 * medible.
 */
function pilaQueMonta(montaje: Montaje): readonly RoleName[] {
  switch (montaje) {
    case 'contacto':
      return [FUEGO, COMIDA]
    case 'parrilla':
      return [FUEGO, PARRILLA, COMIDA]
    case 'piso':
      return [FUEGO]
  }
}

/**
 * ¿ESTA GEOMETRÍA SE PUEDE ARMAR CON LOS PASOS QUE HAY? El motivo, o `undefined`
 * si se puede.
 *
 * Está separado de la ventana a propósito: la ventana es física y este límite es
 * del VOCABULARIO DE PASOS, y mezclarlos haría creer que el mundo no permite algo
 * que sí permite. Lo que falta es un `Ref`: `poner` sabe decir «en la celda de ese
 * cuerpo» y «apoyado sobre ese cuerpo», y no sabe decir «en la celda que está a dos
 * de ese cuerpo». Con `{k:'celda', at}` habría que congelar una coordenada al
 * planificar y usarla decenas de ticks después, que es justo lo que `tipos.ts`
 * prohíbe en su primera decisión.
 */
function porQueNoSePuedeArmar(montaje: Montaje, distancia: number): string | undefined {
  // ─── LO QUE UNA PILA NO PUEDE DECIR: LA AUSENCIA DE APOYO ─────────────────
  //
  // `piso` es «todo lo demás» de `montajeDe`: el cuerpo está cerca de la fuente y no
  // lo sostiene ni ella ni nada que esté en su celda. Con `pila` —que es una lista
  // de apoyos— eso sólo se podría escribir dejando al SUJETO afuera de la pila, y
  // ese camino está cerrado por dos lados: rompe el invariante «el sujeto aparece
  // exactamente una vez en la pila», que ya está afirmado FUERA de este paquete
  // (`mind/tests/ataque-al-reves-2.test.ts`), y obliga al emisor a un `poner` sin
  // `sobre` que ninguna fila generada usa.
  //
  // Y no cuesta nada medible, que es lo que hace que descartarla no sea una excusa:
  // la ventana del piso es [1054,17 ; 1708,33), o sea entre 3,5 y 5,7 kg de leña
  // ARDIENDO. El dios no siembra nada de ese tamaño —la vara más pesada de las
  // veinte semillas anda por el kilo— así que la fila existiría para no ligarse
  // nunca. El día que el mundo tenga incendios, esto es lo primero que hay que
  // volver a mirar, y por eso queda en `GEOMETRIAS_DESCARTADAS` con su ventana.
  if (!pilaQueMonta(montaje).includes(COMIDA)) {
    return `«${montaje}» es la AUSENCIA de apoyo, y una pila es una lista de apoyos: no se puede escribir`
  }
  if (distancia === 0) return undefined
  return `apoyarse es estar en la misma celda: «${montaje}» sólo existe a distancia 0`
}

/** Una geometría de la ley 1, con la ventana de fuego que le corresponde. */
export interface Geometria {
  readonly montaje: Montaje
  readonly distancia: number
  readonly pila: readonly RoleName[]
  readonly minima: number
  readonly maxima: number
}

/** Y una que se barrió y no entró, con el porqué escrito al lado. */
export interface Descartada extends Geometria {
  readonly porque: string
}

const BARRIDO: readonly (Geometria & { readonly porque?: string })[] = (() => {
  const out: (Geometria & { porque?: string })[] = []
  // `MONTAJES` es la enumeración CERRADA del motor: si mañana la física agrega un
  // cuarto montaje, entra acá solo y `pilaQueMonta` no compila hasta que alguien
  // diga cómo se arma. Eso es lo que hace que esto sea un barrido y no una lista.
  for (const montaje of MONTAJES) {
    for (const distancia of DISTANCIAS_BARRIDAS) {
      const v = ventanaDePotencia(VENTANA_CARNOSA, montaje, distancia)
      const no = porQueNoSePuedeArmar(montaje, distancia)
      const g: Geometria & { porque?: string } = {
        montaje,
        distancia,
        pila: pilaQueMonta(montaje),
        minima: v.minima,
        maxima: v.maxima,
        ...(no === undefined ? {} : { porque: no }),
      }
      out.push(g)
    }
  }
  return out
})()

/** Las que se pueden armar. De acá sale una fila de cocción por cada una. */
export const GEOMETRIAS_DE_LA_COCCION: readonly Geometria[] = BARRIDO.filter((g) => g.porque === undefined)

/** Y las que no, con el motivo, para que el barrido se pueda leer entero. */
export const GEOMETRIAS_DESCARTADAS: readonly Descartada[] = BARRIDO.filter(
  (g): g is Geometria & { porque: string } => g.porque !== undefined,
)

// ─── QUÉ FUEGO SE PUEDE ENCENDER PARA CADA VENTANA ──────────────────────────
//
// La otra mitad del arreglo, y la que hace que la cadena cierre en vez de mover el
// `gap` de lugar. Una fila de cocción le pide al rol `fuego` una potencia acotada
// POR LAS DOS PUNTAS, y el único esquema de `friccion` que hablaba de `emitsPower`
// prometía `emitsPower > 0` — que no garantiza ni el piso ni el techo, así que la
// regresión no lo podía usar y la rama moría igual.
//
// Lo que falta es una fila que diga QUÉ HAY QUE FROTAR para que salga un fuego de
// ESA ventana. Y se puede decir sin inventar nada, porque `emitsPower` es, palabra
// por palabra del catálogo, `step(temperature ≥ ignitionPoint) · fuelEnergy · mass ·
// 16,7`: acotar el producto `fuelEnergy · mass` acota la potencia, y las dos son
// cualidades que un `Where` sabe pedir.

/**
 * `emitsPower` de un cuerpo que ya cruzó su ignición, PREGUNTADA AL MOTOR.
 *
 * Se evalúa la expresión derivada del catálogo con un contexto de mentira —una
 * temperatura por encima de la ignición para que el `step` valga 1— en vez de
 * escribir `fuelEnergy · mass · 16,7`. El 16,7 es «el único número libre» de
 * `quality.ts` y está calibrado contra el barrido térmico: una segunda copia acá
 * sería el bug de `DSL_REFERENCE` otra vez.
 */
const EXPRESION_DE_EMITIR = specOf('emitsPower').derived

function potenciaDeArder(fuelEnergy: number, mass: number): number {
  if (EXPRESION_DE_EMITIR === undefined) {
    throw new RangeError('`emitsPower` dejó de ser derivada: no hay a quién preguntarle cuánto emite lo que arde')
  }
  const noHace = (): never => {
    throw new RangeError('`emitsPower` dejó de depender sólo de cualidades propias')
  }
  return evalQuality(EXPRESION_DE_EMITIR, {
    own: (q) =>
      q === 'temperature' ? 1 : q === 'ignitionPoint' ? 0 : q === 'fuelEnergy' ? fuelEnergy : q === 'mass' ? mass : 0,
    geom: noHace,
    sumParts: noHace,
    maxParts: noHace,
    substance: noHace,
  })
}

/** Lo que `friccion` le exige al rol que se calienta, leído del catálogo. */
const LO_QUE_FRICCION_LE_PIDE_AL_QUE_ARDE: readonly QualityTest[] = (() => {
  const p = procesoDe('friccion')
  for (const e of p.effects) {
    if (e.k !== 'drive') continue
    const rol = baseRoleName(e.on)
    for (const r of p.roles) if (baseRoleName(r.name) === rol) return r.where
  }
  throw new RangeError('`friccion` dejó de empujar sobre ningún rol: no se sabe qué se frota')
})()

/**
 * LAS SUSTANCIAS QUE SE PUEDEN PRENDER FROTANDO, barridas del catálogo con las
 * MISMAS condiciones que la fila de encender ya le pone al rol `a`.
 *
 * No es una lista: es un filtro sobre `SUSTANCIAS_SEMILLA` con las cuatro
 * condiciones del puente de `emitsPower>0` —arde (`fuelEnergy > 0`), se prende
 * abajo de lo que frotar promete, no está mojada— más lo que el proceso ya le pide
 * al rol. Medido, dan dos: **madera** (fuelEnergy 18, calor específico 1,7) y
 * **madera-dura** (21 y 1,6). Las otras ocho que arden no pasan la rigidez.
 */
export const COMBUSTIBLES_DE_FROTAR: readonly Substance[] = SUSTANCIAS_SEMILLA.filter((s) => {
  const p = s.perUnitMass
  const fe = p.fuelEnergy
  const ig = p.ignitionPoint
  if (fe === undefined || !(fe > 0)) return false
  if (ig === undefined || ig > IGNICION_QUE_ALCANZA_FROTANDO) return false
  if ((p.moisture ?? 0) >= HUMEDAD_QUE_APAGA) return false
  for (const t of LO_QUE_FRICCION_LE_PIDE_AL_QUE_ARDE) {
    const x = p[t.q as keyof typeof p]
    const val = typeof x === 'number' ? x : 0
    const pasa = t.op === '>=' ? val >= t.v : t.op === '<=' ? val <= t.v : t.op === '>' ? val > t.v : val < t.v
    if (!pasa) return false
  }
  return true
})

/** Lo que hay que frotar para que salga un fuego de una ventana, o el porqué de que no. */
export interface Yesca {
  readonly minima: number
  readonly maxima: number
  readonly fuelEnergyMin: number
  readonly fuelEnergyMax: number
  readonly masaMin: number
  readonly masaMax: number
}

/** Un flotante para arriba y uno para abajo. Ver `yescaPara`. */
function siguiente(x: number): number {
  return x + (x < 0 ? -x : x) * Number.EPSILON
}
function anterior(x: number): number {
  return x - (x < 0 ? -x : x) * Number.EPSILON
}

/**
 * QUÉ COMBUSTIBLE DA UN FUEGO DE ESTA VENTANA — y de acá sale, sin que nadie la
 * escriba, que sólo una de las tres geometrías se puede encender.
 *
 * `emitsPower = fuelEnergy · mass · 16,7`, y un `Where` no sabe acotar un producto:
 * sabe acotar cada factor. Así que se acota `fuelEnergy` a la banda de las
 * sustancias que la fila ya admite —de `F` a `G`, medido [18 ; 21]— y se despeja la
 * masa contra la punta que cada lado necesita:
 *
 *     mass >= minima / (16,7 · F)     ⟹  emitsPower >= minima  para cualquier fe ≥ F
 *     mass <  maxima / (16,7 · G)     ⟹  emitsPower <  maxima  para cualquier fe ≤ G
 *
 * Las dos son verdaderas de cualquier cuerpo, ensamblado o no, porque no se apoyan
 * en la sustancia: se apoyan en la misma expresión que el motor usa para contestar
 * `emitsPower`. Y la banda existe sólo si `mLo < mHi`, o sea si `G/F` es más chico
 * que el ancho de la ventana (1,62×): medido, 21/18 = 1,17, entra.
 *
 * ─── Y LA SEGUNDA CONDICIÓN, QUE ES LA QUE DESCARTA DOS DE LAS TRES ─────────
 *
 * Que la yesca ENTRE EN EL TANQUE: frotar cobra `heatCapacity × ΔT / eficiencia` de
 * `stamina`, y por eso la fila de encender topa `heatCapacity` en 0,9. La masa
 * mínima de la banda, multiplicada por el calor específico de alguna de las
 * sustancias admitidas, tiene que caer abajo de ese techo. Medido:
 *
 *     contacto  masa desde 0,3507 kg → heatCapacity 0,5962 (madera)  ENTRA
 *     parrilla  masa desde 0,8415 kg → heatCapacity 1,4305           no entra
 *     piso      masa desde 3,5069 kg → heatCapacity 5,9617           no entra
 *
 * O sea: **el único fuego de cocina que una criatura sola puede encender es el que
 * cocina en contacto.** Nadie escribió eso; sale de cruzar el tanque de aliento con
 * la exposición de cada montaje.
 */
function yescaPara(minima: number, maxima: number): Yesca | string {
  let F = Number.POSITIVE_INFINITY
  let G = 0
  for (const s of COMBUSTIBLES_DE_FROTAR) {
    const fe = s.perUnitMass.fuelEnergy ?? 0
    if (fe < F) F = fe
    if (fe > G) G = fe
  }
  if (!(F > 0) || !(G > 0)) return 'ninguna sustancia del catálogo se prende frotando: no hay banda de combustible'

  // El despeje y la vuelta al motor no dan el mismo número en IEEE-754 —dividir y
  // volver a multiplicar pierde el último bit— así que el despeje se COMPRUEBA
  // contra `potenciaDeArder` y, si se queda corto, se corre UN flotante para el lado
  // seguro. No es un margen elegido: es el sucesor.
  let masaMin = minima / potenciaDeArder(F, 1)
  for (let i = 0; i < 8 && potenciaDeArder(F, masaMin) < minima; i++) masaMin = siguiente(masaMin)
  let masaMax = maxima / potenciaDeArder(G, 1)
  for (let i = 0; i < 8 && potenciaDeArder(G, masaMax) > maxima; i++) masaMax = anterior(masaMax)

  if (!(masaMin < masaMax)) {
    return (
      `la banda de combustible del catálogo (${String(F)} a ${String(G)} de fuelEnergy) es más ancha que la ` +
      `ventana de potencia: la masa tendría que estar entre ${masaMin.toFixed(4)} y ${masaMax.toFixed(4)} kg`
    )
  }
  let masaQueEntra = Number.POSITIVE_INFINITY
  for (const s of COMBUSTIBLES_DE_FROTAR) {
    const c = masaMin * s.specificHeat
    if (c < masaQueEntra) masaQueEntra = c
  }
  if (masaQueEntra > TECHO_DE_YESCA) {
    return (
      `no entra en el tanque: la yesca más chica que da ${minima.toFixed(2)} de potencia pesa ` +
      `${masaMin.toFixed(4)} kg y tiene heatCapacity ${masaQueEntra.toFixed(4)}, arriba del techo ` +
      `${String(TECHO_DE_YESCA)} que frotar puede pagar`
    )
  }
  return { minima, maxima, fuelEnergyMin: F, fuelEnergyMax: G, masaMin, masaMax }
}

/** Lo que se puede encender, y lo que no con su porqué. Los dos se exportan. */
export const YESCAS_DE_COCINA: readonly Yesca[] = GEOMETRIAS_DE_LA_COCCION.map((g) =>
  yescaPara(g.minima, g.maxima),
).filter((y): y is Yesca => typeof y !== 'string')

export const YESCAS_IMPOSIBLES: readonly { readonly geometria: Geometria; readonly porque: string }[] =
  GEOMETRIAS_DE_LA_COCCION.map((g) => ({ geometria: g, resultado: yescaPara(g.minima, g.maxima) }))
    .filter((x): x is { geometria: Geometria; resultado: string } => typeof x.resultado === 'string')
    .map((x) => ({ geometria: x.geometria, porque: x.resultado }))

/**
 * LAS DOS PUNTAS VAN EN DOS FILAS Y NO EN UNA CONJUNTIVA, y no es estética.
 *
 * La primera versión de esto era UNA fila con `establishes:
 * 'emitsPower>=105,42&emitsPower<170,83'`, y funcionaba acá y rompía tres tests de
 * `@anima/mind`. El motivo está escrito allá y es una decisión suya: `sinVocabulario`
 * —el portón que evita querer lo que ningún esquema sabe hacer— lee las llaves de
 * `SCHEMA_INDEX` con `interpretar`, que devuelve UNA cláusula, y su contrato dice
 * que **el día que alguna llave sea conjuntiva la función se apaga entera y
 * contesta que todo se puede querer**. O sea que una firma conjuntiva no rompía
 * `mind`: la desarmaba en silencio, abriendo el portón para todo.
 *
 * Partirla en dos es además más honesto de este lado: cada fila lleva EXACTAMENTE
 * los `roleHints` que hacen verdadera SU promesa, así que un pedido que sólo quiera
 * el piso —«un fuego de al menos tanto»— usa una sola fila y no arrastra la
 * condición de la otra. Y las dos se aplican JUNTAS cuando el pedido las pide
 * juntas, porque van por la misma vía (`proceso:friccion`) y `esquemasQueAportan`
 * suma los `roleHints` de todas las filas de una vía que entren en el pedido — que
 * es el mismo mecanismo que hace la caña con `catch>0` y `reach>=2`.
 */
function firmaDelPiso(y: Yesca): PredicateSignature {
  return firmaDe(textoDe({ k: 'cualidad', test: { q: 'emitsPower', op: '>=', v: y.minima } }))
}

function firmaDelTecho(y: Yesca): PredicateSignature {
  return firmaDe(textoDe({ k: 'cualidad', test: { q: 'emitsPower', op: '<', v: y.maxima } }))
}

// ─── Las filas de la cocción, una por geometría ─────────────────────────────

const ESQUEMAS_DE_LA_COCCION: readonly EsquemaDeLey[] = GEOMETRIAS_DE_LA_COCCION.map((g) => ({
  k: 'ley' as const,
  ley: 'desnaturalizacion' as const,
  establishes: FIRMA_DE_LO_COCIDO,
  sujeto: COMIDA,
  pila: g.pila,
  distancia: g.distancia,
  mientras: SEGUNDOS_DE_COCCION,
  segundos: SEGUNDOS_DE_COCCION,
  roleHints: {
    fuego: [
      { q: 'emitsPower' as const, op: '>=' as const, v: g.minima },
      { q: 'emitsPower' as const, op: '<' as const, v: g.maxima },
    ],
    // La parrilla sólo existe donde la pila la nombra, y lo que se le pide sale de
    // la ventana de ESA fila: es el cuerpo que está en CONTACTO con el fuego.
    ...(g.pila.includes(PARRILLA)
      ? {
          parrilla: [{ q: 'ignitionPoint' as const, op: '>' as const, v: ignicionQueAguantaLaParrilla(g.maxima) }],
        }
      : {}),
    comida: [],
  },
}))

// ─── Y las de encender un fuego de cocina, una por yesca que exista ─────────

/**
 * Las tres condiciones que las dos filas comparten, y son las de la ley 3: sin
 * combustible no emite, mojado no prende, y lo que se prende más arriba de lo que
 * frotar promete no lo enciende nadie frotando. Más el techo del tanque de aliento.
 */
const LO_QUE_SE_PUEDE_PRENDER_FROTANDO: readonly QualityTest[] = [
  { q: 'heatCapacity', op: '<=', v: TECHO_DE_YESCA },
  { q: 'ignitionPoint', op: '<=', v: IGNICION_QUE_ALCANZA_FROTANDO },
  { q: 'moisture', op: '<', v: HUMEDAD_QUE_APAGA },
]

const ESQUEMAS_DE_ENCENDER_PARA_COCINAR: readonly EsquemaDeProceso[] = YESCAS_DE_COCINA.flatMap((y) => [
  // EL PISO: para que emita AL MENOS tanto, el combustible tiene que rendir al menos
  // tanto por kilo y pesar al menos tanto. Las dos juntas garantizan el producto.
  esquema(firmaDelPiso(y), 'friccion', {
    a: [
      ...LO_QUE_SE_PUEDE_PRENDER_FROTANDO,
      { q: 'fuelEnergy', op: '>=', v: y.fuelEnergyMin },
      { q: 'mass', op: '>=', v: y.masaMin },
    ],
    b: [],
    actor: [],
  }),
  // Y EL TECHO, que es la otra punta del mismo producto y la que separa cocinar de
  // quemar. Sin esta fila la regresión podía prometer un fuego «de al menos tanto»
  // y traer uno que carboniza la comida.
  esquema(firmaDelTecho(y), 'friccion', {
    a: [
      ...LO_QUE_SE_PUEDE_PRENDER_FROTANDO,
      { q: 'fuelEnergy', op: '<=', v: y.fuelEnergyMax },
      { q: 'mass', op: '<', v: y.masaMax },
    ],
    b: [],
    actor: [],
  }),
])

// ─── La evidencia de los puentes ────────────────────────────────────────────

/**
 * Un esquema PUENTE es el que NO sale de ningún `establishes`. Como no hay
 * catálogo que lo respalde, lo respalda una medición, y acá está dicho cuál y
 * dónde vive.
 *
 * El test hace dos cosas con esto, y la segunda es la que importa: verifica que
 * todo esquema que no es declarado esté acá (que ningún puente entre de
 * contrabando) Y que todo lo que está acá sea de verdad un puente (que nadie
 * marque como conocimiento humano algo que el catálogo ya decía, para inflar la
 * lista). Además abre cada archivo citado: una evidencia que apunta a un archivo
 * que no existe es peor que ninguna.
 */
export interface Evidencia {
  readonly establishes: PredicateSignature
  /**
   * Por dónde, en la misma clave que agrupa las vías: `proceso:union`, `ley:…`.
   *
   * Es la clave y no el `ProcessId` pelado desde que hay esquemas de ley: **una
   * fila de ley es SIEMPRE un puente**, porque ninguna ley tiene un `establishes`
   * que declarar —las leyes no proponen, corren— así que no hay catálogo del que
   * pueda salir y lo único que la respalda es una medición.
   */
  readonly por: string
  /** Qué hace el mundo que `establishes` no dice. */
  readonly porque: string
  /** Dónde está MEDIDO, en rutas desde `ii/`. */
  readonly medidoEn: readonly string[]
}

export const PUENTES: readonly Evidencia[] = [
  {
    establishes: 'catch>0',
    por: 'proceso:union',
    porque:
      'ningún proceso declara `catch`, y sin `catch` no hay `gear` para `extraccion`. ' +
      'Atar una hebra flexible SIN el rol opcional `b` deja al atador vivo como parte con una ' +
      'punta suelta; esa punta es `freeStrandEnds`, y `catch = freeStrandEnds × (0,15 + ' +
      'max(sharpness) × 0,5)`. Medido: vara de madera de 1 kg + hebra de liana de 0,2 kg da ' +
      'catch 0,1500 y reach 4,8000; la MISMA hebra atando dos varas (con `b`) da catch 0,0000.',
    medidoEn: [
      // Los dos aparejos de `aparejos()`, y el criterio (c) que mide la razón
      // entre el catch pelado y el del anzuelo sobre el mismo pozo.
      'packages/world/tests/hito-5-la-pesca.test.ts',
      // La fórmula de `catch`, con sus dos constantes con nombre.
      'packages/physics/src/quality.ts',
      // `geomOf`, caso `freeStrandEnds`: una punta deja de estar libre cuando
      // algo que pesa igual o más la ancla.
      'packages/physics/src/body.ts',
      // `unir`: con `b` el atador se gasta en la atadura; sin `b` sobrevive.
      'packages/physics/src/leyes.ts',
      // `armables()`: la garantía de resolubilidad del dios ata con `b`
      // ausente, y su encabezado explica por qué el cierre llega hasta atar.
      'packages/oracle/src/resolubilidad.ts',
    ],
  },
  {
    establishes: 'emitsPower>0',
    por: 'proceso:friccion',
    porque:
      '`friccion` declara que establece `temperature>=400` y no declara la consecuencia que hace ' +
      'existir al fuego: un cuerpo que cruza su `ignitionPoint` EMITE. No es una ley aparte ni un ' +
      'verbo: `emitsPower` es una cualidad DERIVADA, `step(temperature ≥ ignitionPoint) · ' +
      'fuelEnergy · mass · 16,7`, y el `step` es el ADR II-0001 hecho aritmética. Medido: una vara ' +
      'de madera de 0,2 kg (ignición 300) frotada cruza los 300 °C y pasa de `emitsPower` 0 a 60,12; ' +
      'la misma vara fría vale 0 aunque nadie la haya tocado. El `roleHint` pide `ignitionPoint <= ' +
      '400` porque 400 es hasta donde el `drive` de `friccion` empuja: lo que se prende más arriba ' +
      'no lo enciende nadie frotando.',
    medidoEn: [
      // La cadena entera medida en el mundo: la vara pasa sus 300 °C a los 2,40 s.
      'packages/world/tests/el-fuego.test.ts',
      // La expresión derivada de `emitsPower`, con su `step`.
      'packages/physics/src/quality.ts',
      // Y acá, esta misma fila corrida contra una partida.
      'packages/plan/tests/los-esquemas-contra-el-mundo.test.ts',
    ],
  },
  ...ESQUEMAS_DE_ENCENDER_PARA_COCINAR.map((e, i) => {
    // Dos filas por yesca —el piso y el techo—, así que la yesca es la mitad del
    // índice. Ver `firmaDelPiso` para por qué son dos y no una conjuntiva.
    const y = YESCAS_DE_COCINA[i >> 1]
    const punta = i % 2 === 0 ? 'EL PISO' : 'EL TECHO'
    return {
      establishes: e.establishes,
      por: claveDeVia(e),
      porque:
        `LA MISMA CONSECUENCIA QUE LA FILA DE ARRIBA, PERO ACOTADA — y ésta pone ${punta}. ` +
        '`emitsPower>0` no acota nada, y la cocción necesita las dos puntas: un fuego chico no llega a la ' +
        'ventana y uno grande quema la comida. La fila de arriba dice que frotar hace fuego; ésta dice DE QUÉ ' +
        'TAMAÑO, y sale de que `emitsPower` es `step(temperature ≥ ignitionPoint) · fuelEnergy · mass · 16,7`: ' +
        'acotar los dos factores acota el producto, y los dos son cualidades que un `Where` sabe pedir. La banda ' +
        'de `fuelEnergy` es la de las sustancias que la fila de arriba ya admitía —medido, ' +
        `[${String(y?.fuelEnergyMin ?? 0)} ; ${String(y?.fuelEnergyMax ?? 0)}], que son madera y madera-dura— y la ` +
        `masa se despeja contra cada punta: de ${(y?.masaMin ?? 0).toFixed(4)} a ${(y?.masaMax ?? 0).toFixed(4)} kg. ` +
        'Lo que las dos filas aportan y el catálogo no dice: que de las TRES ventanas de cocción, ésta es la ' +
        'única que entra en el tanque de aliento —las otras dos piden yescas de 0,84 y 3,51 kg, o sea ' +
        'heatCapacity 1,35 y 5,61 contra el techo 0,9 que frotar puede pagar—.',
      medidoEn: [
        // La cadena entera medida en el mundo: la vara pasa sus 300 °C a los 2,40 s.
        'packages/world/tests/el-fuego.test.ts',
        // La expresión derivada de `emitsPower`, con su `step` y su 16,7.
        'packages/physics/src/quality.ts',
        // El precio de frotar: `heatCapacity × ΔT / eficiencia` de `stamina`.
        'packages/world/src/step.ts',
        // Y acá, esta misma fila corrida contra una partida.
        'packages/plan/tests/los-esquemas-contra-el-mundo.test.ts',
      ],
    }
  }),
  {
    establishes: 'heatCapacity<=0.9',
    por: 'proceso:deshilachar',
    porque:
      '`deshilachar` declara que establece flexibilidad y tracción, y NO declara lo único que ' +
      'de verdad fabrica: cuerpos LIVIANOS. La hebra se lleva 0,1 de la masa, `heatCapacity` es ' +
      'extensiva, y encender cuesta `heatCapacity × ΔT / 0,35` de `stamina`. Medido: un leño de ' +
      'madera de 1 kg tiene heatCapacity 1,7000 y encenderlo cuesta 1870 de aliento sobre un ' +
      'tanque que topa en 1000 —no se puede—; la hebra de 0,1 kg que sale de él tiene 0,1700, ' +
      'cuesta 187, y conserva la rigidez de la madera (0,7000, intensiva) que `friccion` le pide ' +
      'al rol `a`. De ahí sale sola la yesca, sin que ninguna regla diga «la yesca prende y el ' +
      'leño no».',
    medidoEn: [
      // La tabla del precio por masa, medida en el mundo y no despejada.
      'packages/world/tests/el-fuego.test.ts',
      // `aplicarEfectos`, caso `drive`: el cobro `heatCapacity × ΔT / eficiencia`,
      // y `FRACCION_DE_HEBRA` con el `partir` a favor del grano.
      'packages/world/src/step.ts',
      // `heatCapacity = mass × specificHeat`, declarada como derivada.
      'packages/physics/src/quality.ts',
    ],
  },
  ...ESQUEMAS_DE_LA_COCCION.map((e, i) => {
    const g = GEOMETRIAS_DE_LA_COCCION[i]
    const m = g?.montaje ?? 'piso'
    return {
      establishes: e.establishes,
      por: claveDeVia(e),
      porque:
        'COCINAR NO ES UN PROCESO: no hay `ProcessId` que lo haga, lo hace la ley 5 sobre todo cuerpo ' +
        'orgánico que esté entre su `denaturesAt` y su `ignitionPoint`. O sea que ningún `establishes` ' +
        'lo puede declarar —las leyes no proponen, corren— y lo único que respalda esta fila es una ' +
        `medición. Lo que ESTA fila aporta y el catálogo no dice: que la ventana de lo carnoso es ` +
        `[${String(VENTANA_CARNOSA.piso)} ; ${String(VENTANA_CARNOSA.techo)}) °C, y que el montaje «${m}» ` +
        `—que en el mundo se arma poniendo ${String(g?.pila.length ?? 0)} cuerpo(s) en la celda del fuego— ` +
        `la sirve con un fuego de [${(g?.minima ?? 0).toFixed(4)} ; ${(g?.maxima ?? 0).toFixed(4)}) de potencia. ` +
        'Nadie escribió «parrilla» ni «contacto»: los tres montajes salen de `MONTAJES`, la ventana de cada ' +
        'uno sale de invertir la ley 1 sobre el motor, y la pila que lo arma sale de cómo lee la geometría ' +
        '`montajeDe`. Lo que se elige cada vez es el LUGAR; la potencia se elige una sola vez, al encender.',
      medidoEn: [
        // La ley 5, con su `k = (T − denaturesAt)/100` y sus cuatro tasas.
        'packages/physics/src/leyes.ts',
        // `montajeDe`: los tres montajes salen de la geometría y de ninguna tabla.
        'packages/world/src/step.ts',
        // La cadena entera en el mundo: el pescado sobre la parrilla llega a 0,950.
        'packages/world/tests/el-fuego.test.ts',
        // La misma fogata en los tres lugares, con la tabla de qué le pasa a cada una.
        'packages/world/tests/donde-se-pone-la-comida.test.ts',
        // Y acá, esta misma fila corrida contra una partida, en el peor caso admisible.
        'packages/plan/tests/los-esquemas-contra-el-mundo.test.ts',
      ],
    }
  }),
]

// ─── Las diez filas ─────────────────────────────────────────────────────────
//
// El orden es el de `SEED_PROCESSES`, y adentro de cada proceso primero lo
// declarado y después sus puentes. No es cosmético: `SCHEMA_INDEX` conserva este
// orden, y de él depende qué esquema prueba primero la regresión cuando dos
// establecen la misma firma. Un orden que dependiera de cómo se construyó un
// `Map` sería no-determinismo con otro nombre.
//
// Las de LEY van últimas, y también es orden y no gusto: `regresar` prueba las
// vías en el orden de la tabla, y lo que un proceso sabe hacer sale más barato que
// armar una situación y esperar. Está afirmado en `los-esquemas.test.ts`.

export const ESQUEMAS: readonly ConstructionSchema[] = [
  // ── friccion ──────────────────────────────────────────────────────────────
  //
  // DECLARADO: `temperature>=400`.
  //
  // El único `roleHint` del proceso es el que hace la diferencia entre encender
  // y agotarse: `a` es el cuerpo sobre el que empuja el `drive`, y lo que se
  // paga por empujarlo es proporcional a su `heatCapacity`. Los roles `b` y
  // `actor` van con `Where` vacío y NO omitidos: los dos hacen falta para que el
  // proceso corra —hay que frotar CONTRA algo, y alguien tiene que frotar—, y lo
  // que el proceso ya les pide (`rigidity >= 0.5`, `stamina >= 1`) no hay que
  // repetirlo acá.
  //
  // Lo que este esquema NO puede decir, y es un hueco del contrato: el techo de
  // arriba es el de una criatura con el tanque lleno. `ConstructionSchema` no ve
  // al actor, así que una criatura a media máquina va a planificar un fuego que
  // no le va a salir, y se va a enterar frotando.
  esquema('temperature>=400', 'friccion', {
    a: [{ q: 'heatCapacity', op: '<=', v: TECHO_DE_YESCA }],
    b: [],
    actor: [],
  }),

  // PUENTE: `emitsPower>0`. Ver `PUENTES`.
  //
  // Lo que `friccion` fabrica y no declara: una FUENTE DE CALOR. `emitsPower` es
  // derivada —`step(temperature ≥ ignitionPoint) · fuelEnergy · mass · 16,7`— y el
  // `step` es el ADR II-0001 hecho aritmética: no hay verbo «encender», hay un
  // umbral. Frotar cruza el umbral, y lo que queda del otro lado emite.
  //
  // Los dos `roleHints` de `a` son las dos mitades de la misma frase. El techo de
  // `heatCapacity` es el mismo de la yesca (frotar algo más pesado no se paga), y
  // el `ignitionPoint <= 400` es hasta dónde llega el `drive` del proceso: lo que
  // se prende más arriba de lo que frotar promete no lo enciende nadie frotando.
  // Ninguno de los dos números está escrito acá.
  //
  // ─── Y LO QUE ESTA FILA NO ALCANZA A PROMETER, DICHO ANTES DE QUE MUERDA ──
  //
  // `emitsPower > 0` NO ACOTA NADA POR ARRIBA NI POR ABAJO, y la cocción pide las
  // dos puntas: un fuego chico no llega a la ventana y uno grande la quema. Por eso
  // la regresión no podía usar esta fila para llenar el rol `fuego` de la cocción
  // —`emitsPower>0` no GARANTIZA `emitsPower>=105,42`— y la rama moría con el `gap`
  // del `emitsPower`. Lo que faltaba no era encender más fuerte: era poder pedir un
  // fuego DE UN TAMAÑO, y eso lo dice la fila de abajo.
  //
  // Esta fila se queda igual y sigue haciendo falta: es la que contesta «quiero
  // fuego» a secas —para ver, para calentarse, para propagar— sin exigir tamaño.
  // Las otras dos condiciones de `a` no son de `friccion` sino de la ley 3, y
  // están porque un cuerpo calentísimo sin combustible no emite nada y uno mojado
  // tampoco: `arde` en `physics/src/leyes.ts` es
  // `moisture < HUMEDAD_QUE_APAGA ∧ pico >= ignitionPoint ∧ oxígeno`. Las dos salen
  // del motor —la constante está exportada— y las propuso el adversario del tramo
  // F antes de que esta fila existiera, en `tests/ataque-al-reves.test.ts`.
  esquema('emitsPower>0', 'friccion', {
    a: [
      { q: 'heatCapacity', op: '<=', v: TECHO_DE_YESCA },
      { q: 'ignitionPoint', op: '<=', v: IGNICION_QUE_ALCANZA_FROTANDO },
      { q: 'fuelEnergy', op: '>', v: 0 },
      { q: 'moisture', op: '<', v: HUMEDAD_QUE_APAGA },
    ],
    b: [],
    actor: [],
  }),

  // PUENTE: `emitsPower` ACOTADO POR LAS DOS PUNTAS, una fila por ventana que se
  // pueda encender. Ver `PUENTES` y `yescaPara`.
  //
  // Es la fila que cierra la cadena de cocinar sin fuego a la vista, y la que dice
  // —sin que nadie lo escriba— que de las tres ventanas de cocción sólo UNA se
  // puede encender frotando: las otras dos piden yescas que no entran en el tanque
  // de aliento. Las condiciones de `a` son las mismas cuatro de arriba (menos
  // `fuelEnergy>0`, que queda subsumida) más las dos bandas despejadas del producto
  // `fuelEnergy · mass` que es `emitsPower`.
  ...ESQUEMAS_DE_ENCENDER_PARA_COCINAR,

  // ── union ─────────────────────────────────────────────────────────────────
  //
  // DECLARADO: `freeStrandEnds>=1`.
  //
  // `b` está OMITIDO a propósito y es toda la fila: con el rol opcional lleno el
  // atador se gasta en la atadura y no queda ninguna hebra que pueda tener una
  // punta suelta.
  //
  // El `flexibility >= 0.8` del `binder` parece una repetición del rol y no lo
  // es: el 0,8 del rol es el umbral de `union` para aceptar un atador, y el 0,8
  // que hace falta acá es `STRAND_FLEXIBILITY` de `physics/src/body.ts`, que es
  // el umbral a partir del cual `freeStrandEnds` cuenta una parte como hebra.
  // Hoy los dos números coinciden; son dos constantes distintas en dos archivos
  // distintos, y este esquema depende de la segunda. Si `union` bajara su
  // exigencia a 0,7, el esquema seguiría pidiendo lo que la geometría necesita.
  esquema('freeStrandEnds>=1', 'union', {
    binder: [{ q: 'flexibility', op: '>=', v: 0.8 }],
    a: [],
  }),

  // DECLARADO: `reach>=2`.
  //
  // ─── Y ES LA FILA MÁS FLOJA DE LAS OCHO, DICHO ACÁ Y NO ESCONDIDO ─────────
  //
  // `union` NO fabrica alcance: lo hereda. El ensamble se queda con la forma de
  // `a` (`unir` en `physics/src/leyes.ts`: `form: a.form`) y su grafo de juntas
  // CONTIENE al de `a`, así que el camino más largo del resultado no puede ser
  // más corto que el de `a`. Medido: una vara de madera de 1 kg tiene
  // `reach = 4,0000` y la caña que sale de atarle una hebra tiene 4,8000.
  //
  // O sea que lo que `union` promete de verdad es «atar no acorta», y el
  // `roleHint` honesto es pedirle a `a` el mismo alcance que se quiere obtener.
  // Eso lo deja casi tautológico y hay que decir la consecuencia: **por sí sola
  // esta fila no le sirve a la regresión**, porque regresar `reach>=2` a
  // `reach>=2` no acerca a nada. La fila que hace el trabajo es el puente de
  // `catch>0`, que es lo que una vara NO tiene. La alternativa —un umbral más
  // bajo, del estilo «con que `a` llegue a 1 alcanza»— sería mentira medible:
  // dos hebras de liana de 0,2 kg atadas llegan a 1,2 + algo y no a 2.
  esquema('reach>=2', 'union', {
    a: [{ q: 'reach', op: '>=', v: 2 }],
    binder: [],
  }),

  // PUENTE: `catch>0`. Ver `PUENTES` para la evidencia y las mediciones.
  //
  // Mismas dos condiciones que `freeStrandEnds>=1` —una hebra de verdad y `b`
  // ausente— porque `catch` es `freeStrandEnds` multiplicado por algo que nunca
  // es cero (0,15 mínimo, la liana pelada colgando). O sea: en esta física
  // `catch > 0` y `freeStrandEnds >= 1` son la misma condición dicha en dos
  // vocabularios, y las dos filas existen porque `extraccion` pregunta por una y
  // `union` promete la otra.
  //
  // A `a` no se le pide nada: con la hebra más liviana que la parte a la que se
  // ata queda una punta libre, y con la hebra más pesada quedan las dos. Las dos
  // dan `catch > 0`. Lo que sí hace falta para que el resultado sirva de `gear`
  // es `reach >= 2`, y eso es OTRA firma y otro esquema — juntarlas acá sería
  // pedirle a este esquema que establezca algo que no establece.
  esquema('catch>0', 'union', {
    binder: [{ q: 'flexibility', op: '>=', v: 0.8 }],
    a: [],
  }),

  // ── deshilachar ───────────────────────────────────────────────────────────
  //
  // DECLARADO: `flexibility>=0.8`.
  //
  // ─── EL `establishes` MÁS ENGAÑOSO DE LA SEMILLA ─────────────────────────
  //
  // `deshilachar` NO fabrica flexibilidad. Parte a favor del grano, y partir
  // escala la masa y cambia la forma a `hebra`, pero `flexibility` es INTENSIVA:
  // la hebra sale con la flexibilidad de la sustancia de la que salió. Medido:
  // la hebra de una vara de madera tiene `flexibility = 0,2000`, que es la de la
  // madera, y no llega ni cerca al 0,8 que el proceso promete. La corteza (0,7)
  // tampoco. La liana (0,9) y el tendón (0,82) sí, y ya lo eran antes de
  // deshilacharlos.
  //
  // Por eso el `roleHint` le pide a `source` la flexibilidad que el proceso
  // promete: es la única lectura del `establishes` que no es falsa. Lo que el
  // proceso hace de verdad es CONVERTIR EN HEBRA algo que ya era flexible.
  esquema('flexibility>=0.8', 'deshilachar', {
    source: [{ q: 'flexibility', op: '>=', v: 0.8 }],
    actor: [],
  }),

  // DECLARADO: `tensile>=0.3`.
  //
  // Ésta sí se cumple sola, y por la MISMA razón por la que la de arriba no: el
  // rol `source` ya exige `tensile >= 0.3`, `tensile` es intensiva, y lo que
  // sale del grano se lleva la tracción de lo que entró. Medido: la hebra de una
  // vara de madera tiene `tensile = 0,5500`, igual que la vara. Así que acá no
  // hay nada que agregar «más allá de lo que el proceso ya exige», y el
  // `roleHint` de `source` va vacío. Que esté vacío es información: dice que
  // esta promesa la sostiene el propio catálogo.
  esquema('tensile>=0.3', 'deshilachar', {
    source: [],
    actor: [],
  }),

  // PUENTE: `heatCapacity<=0.9`. Ver `PUENTES`.
  //
  // Lo que `deshilachar` fabrica y no declara: cosas livianas. Es el esquema que
  // le contesta a `friccion` cuando lo único rígido que hay alrededor es un leño
  // que no se puede encender — y la respuesta es «hacete una yesca».
  //
  // El `heatCapacity <= 9` del `source` es el techo de arriba dividido por la
  // fracción que se lleva la hebra.
  //
  // ─── Y ACÁ ESTABA ESCRITA UNA MENTIRA, QUE SE MIDIÓ Y SE BORRA ────────────
  //
  // Decía: «Un leño de 20 kg no entra, y entonces la regresión lo deshilacha dos
  // veces, que es lo que hay que hacer». No lo deshilacha ninguna vez, y el techo
  // de 9 no es el primer escalón de una escalera: es un tope duro. La segunda
  // vuelta pediría `heatCapacity <= 9` como RESIDUO al rol material, y el residuo
  // extensivo se rechaza —con razón, porque la hebra se lleva la décima parte y
  // exigírsela a la fuente sería pedir diez veces de más—. Para que hubiera
  // escalera, el esquema tendría que saber decir «lo que salga pesa una décima de
  // lo que entre», y eso es aritmética sobre los rendimientos que
  // `ConstructionSchema` no tiene. Medido en `tests/ataque-al-plan.test.ts`.
  esquema('heatCapacity<=0.9', 'deshilachar', {
    source: [{ q: 'heatCapacity', op: '<=', v: TECHO_DE_LO_DESHILACHABLE }],
    actor: [],
  }),

  // ── extraccion ────────────────────────────────────────────────────────────
  //
  // DECLARADO: `holding(tag:carnoso)`.
  //
  // Los dos `roleHints` van vacíos porque lo que el proceso exige de los CUERPOS
  // ya es exactamente lo que hace falta: `gear` con `reach >= 2 ∧ catch > 0` —la
  // caña— y `source` con `mass > 0` —lo que quede en el pozo—.
  //
  // ─── PERO `mass > 0` NO DISTINGUE UN POZO DE UN PEDRUSCO, Y ESO ELEGÍA MAL ──
  //
  // El mundo rechaza la extracción con motivo `sin-pozo` si el cuerpo no es un
  // banco decretado por el dios, y eso no es expresable en un `Where`, que sólo
  // sabe de cualidades de cuerpo. Mientras esta fila no dijo nada, el
  // planificador elegía el `source` POR CERCANÍA entre todo lo que tuviera masa:
  // una piedra de 5 kg a una celda le ganaba al río de 50 kg a ocho, el plan
  // salía verde y el mundo contestaba `sin-pozo`. La pesca del Hito 5 funcionaba
  // por casualidad —el río del test tiene tres cuerpos y `union` se come dos, así
  // que el tercero quedaba de pozo por descarte—.
  //
  // Hacen falta las DOS condiciones de abajo y ninguna sobra, y se sabe porque las
  // dos se midieron sobre la misma corrida que se murió:
  //
  //   `cellHints` — EL POZO ESTÁ EN EL AGUA. No inventa vocabulario: `VistaDelPlan`
  //     ya traía `qAt`. Un pozo de esta semilla está SIEMPRE en agua franca (los
  //     únicos `Stock` que decreta el dios son bancos de agua), y el agua franca
  //     vale `wet = 1,0000` contra `0,6000` de la orilla desde la que se pesca.
  //     Descarta las piedras de la orilla y NO descarta lo que la criatura lleva en
  //     la mano cuando pesca metida en el agua: un cuerpo agarrado viaja en la celda
  //     de quien lo agarra (`world/src/step.ts`), así que ahí cumple `wet >= 0,9`
  //     igual que el pozo. Medido: parada en la orilla el plan elige el banco, y
  //     parada en el agua elige el pescado de su propia mano.
  //
  //   `roleNoDeLaMano` — Y NO SE PESCA ADENTRO DE LO QUE UNO LLEVA PUESTO. Es la
  //     condición que cierra lo otro, dicha por lo que es: una relación entre la
  //     criatura y el candidato, no una cualidad del candidato. Caza exactamente al
  //     impostor que se midió —el pescado agarrado, que además está a distancia
  //     cero y que `candidatosPara` PREFIERE por estar en la mano— y no le cuesta
  //     nada a ningún banco, porque un banco decretado no está en la mano de nadie.
  //
  // ─── ACÁ ESTUVO ESCRITO `roleFilters: {source:[portable<=0]}`, Y COSTÓ ONCE ──
  //
  // La condición vieja era «el pozo no entra en una mano», con este argumento:
  // `portable` es LA MISMA cualidad con la que el mundo rechaza un `take`
  // (`no-portable`), así que todo lo que la criatura pudo levantar la cumple por
  // construcción y pedirle al `source` que NO sea portátil descarta la mano entera.
  // La premisa es cierta. Lo que no se siguió es que descarta MUCHÍSIMO MÁS que la
  // mano: descarta todo cuerpo de menos de 8 kg, y los bancos que el dios decreta
  // casi siempre pesan menos que eso. El precio publicado —«le regala al río las
  // últimas 2 piezas de 45, un 4,4%»— salía de UNA semilla, la del banco de 129,9150
  // kg del test de esquemas. Sobre las VEINTE que juega el banco de la emergencia
  // (`juez/tests/ataque-al-tramo-i.test.ts`, bloque 3):
  //
  //     partidas sin UN SOLO banco elegible          11 de 20
  //     de esas once, partidas con alguna tirada      0 de 11
  //     piezas regaladas                             58 de 332 (17,5%)
  //
  // Y el mundo sí deja pescar ahí: `stockDe` (`world/src/step.ts`) decide qué es un
  // pozo POR IDENTIDAD del cuerpo, la masa no entra en la cuenta, y un banco de
  // 2,2630 kg rindió su pieza sin que el mundo dijera `sin-pozo` una sola vez.
  //
  // Van en campos distintos porque son de clases distintas y `PedidoDeRol` ya tenía
  // la distinción escrita: `roleHints` viaja a la firma —lo que se REGRESA— y esto
  // no se fabrica. Ver `EsquemaComun.roleNoDeLaMano` para el porqué del campo nuevo.
  //
  // ─── Y LO QUE SIGUE SIN SER SUFICIENTE, DICHO Y NO ESCONDIDO ───────────────
  //
  // Una piedra tirada adentro del río cumple las dos y no es un pozo, y ahí el mundo
  // sigue contestando `sin-pozo`. Con la condición vieja esa piedra quedaba tapada
  // si pesaba más de 8 kg, y ése es el único lado por el que la vieja compraba algo
  // que ésta no; costaba once partidas de veinte. Lo que estas dos condiciones
  // compran es que el planificador deje de ELEGIR ACTIVAMENTE MAL —el pescado de la
  // mano estaba SIEMPRE, era el más cercano de todos y encima ganaba por estar en la
  // mano—; no compran que el hueco desaparezca. El hueco desaparece el día que la
  // superficie sepa decir «esto es un pozo», y eso es una decisión sobre `BodyView`.
  //
  // La firma `holding(tag:carnoso)` tampoco parsea como `QualityTest` —no tiene
  // operador— y por eso el índice se compara por texto y no por estructura.
  esquema(
    'holding(tag:carnoso)',
    'extraccion',
    {
      gear: [],
      source: [],
    },
    {
      roleNoDeLaMano: ['source'],
      cellHints: { source: [{ q: 'wet', op: '>=', v: AGUA_FRANCA }] },
    },
  ),

  // ── ley 5 · desnaturalización, UNA FILA POR GEOMETRÍA ─────────────────────
  //
  // LAS FILAS QUE NO SON PROCESOS. Ver `EsquemaDeLey` en `tipos.ts` para el porqué
  // de la forma y `GEOMETRIAS_DE_LA_COCCION` para el porqué de los números, que
  // salen todos de barrer `MONTAJES` × distancias contra el motor.
  //
  // Los roles y lo que se les pide:
  //
  //   fuego     la ventana de potencia DE ESA GEOMETRÍA. Abajo del piso la comida
  //             no llega a su `denaturesAt` (o llega tan justo que la ley empuja a
  //             tasa cero); arriba del techo cruza su `ignitionPoint` y se quema en
  //             vez de cocinarse. Los dos bordes salen de invertir la ley 1.
  //   parrilla  sólo donde la pila la nombra: que no se prenda fuego estando en
  //             CONTACTO con el fuego, que es la exposición más brava de las tres.
  //             Y `portable`, que lo agrega la regresión sola por no ser la base.
  //   comida    nada en cualidades. Lo que tiene que ser —carnosa y en la mano—
  //             sale de la propia promesa: ver `EsquemaDeLey.sujeto` y el residuo
  //             que la regresión le pasa.
  //
  // ─── LO QUE ESTAS FILAS NO DICEN, Y HAY QUE DECIRLO ───────────────────────
  //
  // No dicen que la parrilla AGUANTE el peso: la ley 8 es otra, `footing` es una
  // cualidad que existe y `pila` no la mira. Hoy no muerde porque lo que se apoya
  // pesa kilos y no toneladas, y queda escrito para que el día que muerda no
  // parezca un accidente.
  //
  // Y no hay filas por cada tag comestible: hay las de lo carnoso, porque es lo que
  // el criterio del Hito 5 necesita. Las de lo vegetal son la misma cuenta con otro
  // tag —`ventanaDelTag` no sabe de carne— y entran el día que haya un objetivo que
  // las pida, sin tocar nada de este módulo salvo el barrido.
  ...ESQUEMAS_DE_LA_COCCION,
]

// ─── El índice ──────────────────────────────────────────────────────────────

/**
 * Los esquemas por firma, DERIVADO de `ESQUEMAS` y no escrito a mano dos veces.
 *
 * Dos filas pueden compartir firma (dos procesos que establecen lo mismo), y por
 * eso el valor es una lista y no un esquema: el día que el modelo escriba un
 * proceso que también deje algo carnoso en la mano, entra en la misma entrada y
 * la regresión elige por costo. El orden adentro de cada entrada es el de
 * `ESQUEMAS`.
 */
export const SCHEMA_INDEX: ReadonlyMap<PredicateSignature, readonly ConstructionSchema[]> =
  construirIndice(ESQUEMAS)

function construirIndice(
  todos: readonly ConstructionSchema[],
): ReadonlyMap<PredicateSignature, readonly ConstructionSchema[]> {
  const m = new Map<PredicateSignature, ConstructionSchema[]>()
  for (const e of todos) {
    const ya = m.get(e.establishes)
    if (ya === undefined) m.set(e.establishes, [e])
    else ya.push(e)
  }
  return m
}

/**
 * Una sola lista vacía compartida. No es micro-optimización: `esquemasPara` la
 * llama la regresión una vez por nodo expandido y por cada firma que NO tiene
 * esquema —que es el caso del `gap`, o sea el caso interesante— y devolver un
 * array nuevo cada vez sería basura por tick en el peldaño más caliente.
 */
const NINGUNO: readonly ConstructionSchema[] = []

/** Los esquemas que establecen esta firma, o vacío. */
export function esquemasPara(f: PredicateSignature): readonly ConstructionSchema[] {
  return SCHEMA_INDEX.get(f) ?? NINGUNO
}
