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
  EXPOSICION,
  HUMEDAD_QUE_APAGA,
  H_PERDIDA,
  SEED_PROCESSES,
  SUSTANCIAS_SEMILLA,
  T_AMBIENTE,
  temperaturaDeEquilibrio,
  specOf,
  type Process,
  type ProcessId,
  type QualityTest,
  type Tag,
} from '@anima/physics'

import { textoDe } from './predicado.js'
import type { ConstructionSchema, EsquemaDeProceso, PredicateSignature } from './tipos.js'

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
  return e.k === 'proceso' ? `proceso:${e.via}` : `ley:${e.ley}:${e.establishes}`
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
 * que se cocina? Es la ley 1 en régimen, PREGUNTADA AL MOTOR (`temperaturaDeEquilibrio`)
 * y no transcripta.
 */
function equilibrioSobre(potencia: number, montaje: 'piso' | 'parrilla' | 'contacto'): number {
  return temperaturaDeEquilibrio(potencia, 0, montaje)
}

/** La inversa: qué potencia hace falta para llegar a esa temperatura con ese montaje. */
function potenciaPara(temperatura: number, montaje: 'piso' | 'parrilla' | 'contacto'): number {
  return ((temperatura - T_AMBIENTE) * H_PERDIDA) / EXPOSICION[montaje]
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
 * LA VENTANA DE POTENCIA DEL FUEGO, y de acá sale la parrilla sin que nadie la
 * escriba.
 *
 * Con `EXPOSICION` y `H_PERDIDA` del motor, un fuego de potencia `P` deja la comida
 * en `T_ambiente + P · exposicion / h`. Los tres montajes que el mundo distingue
 * (`montajeDe`, en `world/src/step.ts`) dan tres respuestas MUY distintas, y para un
 * fuego de leña de 1 kg —`emitsPower` 300, la fogata que el Hito 0 calibró— son:
 *
 *     piso       15 + 300 · 0,06 / 0,5 =  51 °C  → por debajo de los 63 de la carne:
 *                                                  no cocina
 *     parrilla   15 + 300 · 0,25 / 0,5 = 165 °C  → adentro de la ventana: cocina
 *     contacto   15 + 300 · 0,60 / 0,5 = 375 °C  → por encima de los 220 del huevo y
 *                                                  de los 260 del pescado: se quema
 *
 * O sea que **de los tres montajes del mundo, uno solo cae adentro de la ventana**,
 * y es el que se consigue apoyando la comida sobre algo que está en la celda del
 * fuego. Nadie escribió «parrilla»: es la única geometría que sobrevive a la resta.
 * Por eso `pila` tiene tres roles y no dos.
 */
function ventanaDePotencia(v: VentanaDeTag): { readonly minima: number; readonly maxima: number } {
  return {
    minima: potenciaPara(temperaturaDeTrabajo(v), 'parrilla'),
    maxima: potenciaPara(v.techo, 'parrilla'),
  }
}

/**
 * LO QUE SE LE PIDE A LA PARRILLA, y también sale de la resta.
 *
 * La parrilla NO está en `parrilla`: está en `contacto` con el fuego —es lo que la
 * sostiene—, así que le toca la exposición 0,6 y el equilibrio más bravo de los
 * tres. Con el fuego más grande que el esquema admite eso da **507 °C** para lo
 * carnoso, y de ahí sale la única condición: que no se prenda fuego a esa
 * temperatura. La piedra (`ignitionPoint` 900, el techo de lo que no arde) entra;
 * una vara de madera (300) no, y por eso una parrilla de madera no es una parrilla
 * sino más leña.
 */
function ignicionQueAguantaLaParrilla(v: VentanaDeTag): number {
  return equilibrioSobre(ventanaDePotencia(v).maxima, 'contacto')
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

/** Y la del fuego que la sirve. Medido: [273,0000 ; 450,0000), 1,65× de ancho. */
export const POTENCIA_QUE_COCINA_LO_CARNOSO = ventanaDePotencia(VENTANA_CARNOSA)

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
  {
    establishes: FIRMA_DE_LO_COCIDO,
    por: `ley:desnaturalizacion:${FIRMA_DE_LO_COCIDO}`,
    porque:
      'COCINAR NO ES UN PROCESO: no hay `ProcessId` que lo haga, lo hace la ley 5 sobre todo cuerpo ' +
      'orgánico que esté entre su `denaturesAt` y su `ignitionPoint`. O sea que ningún `establishes` ' +
      'lo puede declarar —las leyes no proponen, corren— y lo único que respalda esta fila es una ' +
      'medición. Lo que la fila aporta y el catálogo no dice: que la ventana de lo carnoso es ' +
      '[63 ; 220) °C, que de los TRES montajes que el mundo distingue uno solo cae adentro —piso 51, ' +
      'parrilla 165, contacto 375 sobre una fogata de 300—, y que por eso la pila tiene tres cuerpos ' +
      'y no dos. Nadie escribió «parrilla»: es la única geometría que sobrevive a la resta.',
    medidoEn: [
      // La ley 5, con su `k = (T − denaturesAt)/100` y sus cuatro tasas.
      'packages/physics/src/leyes.ts',
      // `montajeDe`: la parrilla sale de la geometría y de ninguna tabla.
      'packages/world/src/step.ts',
      // La cadena entera en el mundo: el pescado sobre la parrilla llega a 0,950.
      'packages/world/tests/el-fuego.test.ts',
      // Y acá, esta misma fila corrida contra una partida, en el peor caso admisible.
      'packages/plan/tests/los-esquemas-contra-el-mundo.test.ts',
    ],
  },
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
  // `emitsPower > 0` no es `emitsPower >= 273`, que es lo que la cocción pide. La
  // cuenta es la de la yesca leída al derecho: `heatCapacity <= 0,9` sobre madera
  // (calor específico 1,7) topa la masa en 0,529 kg, y 0,529 kg de madera ardiendo
  // emiten 159 — la mitad de lo que hace falta para cocinar. Así que **la criatura
  // puede encender y no puede, sólo con eso, cocinar**, y el `gap` lo va a decir
  // con estas dos firmas al lado. No es un defecto de esta fila: es el dato.
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

  // ── ley 5 · desnaturalización ─────────────────────────────────────────────
  //
  // LA PRIMERA FILA QUE NO ES UN PROCESO. Ver `EsquemaDeLey` en `tipos.ts` para el
  // porqué de la forma; acá va el porqué de los números, que salen todos de restar
  // cosas del catálogo.
  //
  // Los tres roles y lo que se les pide:
  //
  //   fuego     la ventana de potencia. Abajo del piso la comida no llega a su
  //             `denaturesAt` (o llega tan justo que la ley empuja a tasa cero);
  //             arriba del techo cruza su `ignitionPoint` y se quema en vez de
  //             cocinarse. Los dos bordes salen de `ventanaDelTag('carnoso')`.
  //   parrilla  que no se prenda fuego estando en CONTACTO con el fuego, que es
  //             la exposición más brava de las tres. Y `portable`: hay que poder
  //             levantarla, y eso lo agrega la regresión sola por estar en `pila`.
  //   comida    nada en cualidades. Lo que tiene que ser —carnosa y en la mano—
  //             sale de la propia promesa: ver `EsquemaDeLey.sujeto` y el residuo
  //             que la regresión le pasa.
  //
  // ─── LO QUE ESTA FILA NO DICE, Y HAY QUE DECIRLO ──────────────────────────
  //
  // No dice que la parrilla AGUANTE el peso: la ley 8 es otra, `footing` es una
  // cualidad que existe y `pila` no la mira. Hoy no muerde porque lo que se apoya
  // pesa kilos y no toneladas, y queda escrito para que el día que muerda no
  // parezca un accidente.
  //
  // Y no hay una fila por cada tag comestible: hay UNA, la de lo carnoso, porque
  // es la que el criterio del Hito 5 necesita. La de lo vegetal es la misma cuenta
  // con otro tag —`ventanaDelTag` no sabe de carne— y entra el día que haya un
  // objetivo que la pida, sin tocar nada de este módulo salvo la lista.
  {
    k: 'ley',
    ley: 'desnaturalizacion',
    establishes: FIRMA_DE_LO_COCIDO,
    sujeto: 'comida',
    pila: ['fuego', 'parrilla', 'comida'],
    mientras: SEGUNDOS_DE_COCCION,
    segundos: SEGUNDOS_DE_COCCION,
    roleHints: {
      fuego: [
        { q: 'emitsPower', op: '>=', v: POTENCIA_QUE_COCINA_LO_CARNOSO.minima },
        { q: 'emitsPower', op: '<', v: POTENCIA_QUE_COCINA_LO_CARNOSO.maxima },
      ],
      parrilla: [{ q: 'ignitionPoint', op: '>', v: ignicionQueAguantaLaParrilla(VENTANA_CARNOSA) }],
      comida: [],
    },
  },
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
