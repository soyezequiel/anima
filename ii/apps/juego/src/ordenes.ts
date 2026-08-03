// ─── HABLARLE A LA CRIATURA, DESDE EL JUEGO ─────────────────────────────────
//
// Los puntos 4, 5 y 6 de la vertical del Hito 12B: escribir una orden, recibir
// acuse **inmediato**, y ver que algo pasa. `@anima/lang` está entero desde el
// Hito 6 y hasta hoy su único consumidor era un demo de terminal.
//
// ─── EL CAMINO, Y POR QUÉ LA MENTE SIGUE HACIENDO FALTA ────────────────────
//
// Uno esperaría que «traé un palo» se convierta en una intención y se la mande al
// mundo. No es así, y la razón es del diseño de Ánima II: una frase se convierte
// en una **meta** —una firma de predicado como `emitsPower>0`— y quien sabe
// convertir una meta en pasos es la escalera de la mente. El chat no reemplaza a
// la mente: **le pone el objetivo**.
//
//     frase → leer() → encargoDe() → drive de la Mente → habilidades → intents
//
// La consecuencia práctica es la que importa: ordenar desde el chat no es un
// atajo que evita la mente, es la mente trabajando para vos en vez de para sus
// propias necesidades.
//
// ─── LAS DOS COSAS QUE ESTE ARCHIVO NO INVENTA ─────────────────────────────
//
//   1. **el acuse sale de `leer()` y de ningún otro lado.** El criterio pide que
//      aparezca en el mismo cuadro que el mensaje, así que no puede esperar a que
//      nada se planifique. Acá se muestra tal cual viene;
//   2. **una frase con varias cláusulas se manda de a una.** No es una
//      simplificación de esta app: el único canal hacia la mente es
//      `MenteOptions.drive`, que lleva UNA firma. `EncargoEnCurso` es el cursor
//      que `@anima/lang` ya escribió para eso.
//
// ═══ LO QUE CAMBIÓ EN EL C1 DE LA CONVERGENCIA CONVERSACIONAL ══════════════
//
// El tramo entero está en `docs/product/convergencia-conversacional.md` y el
// mapa de integración en `ii/docs/convergencia.md`. Acá se pagaron tres
// deudas, y ninguna era código que faltara escribir: era código escrito que
// nadie llamaba.
//
//   1. **había DOS rutas de salida.** `CanalDeHabla` existe desde el Hito 6 con
//      sus clases y su tick, y este archivo tenía su propia lista de
//      `{de:'vos'|'ella'}`. En la de acá, «voy por X» y «listo» quedaban
//      guardados **como si el personaje los hubiera dicho**, que es exactamente
//      lo que el documento prohíbe. Ahora hay un solo canal y la clase distingue;
//   2. **el historial no era durable.** La lista moría con la pestaña. Ahora es
//      la cuarta ranura de `@anima/store` y vuelve con su orden y su identidad;
//   3. **el turno anterior no llegaba al lector.** `leer()` acepta una
//      `MemoriaDeLaCharla` desde el Hito 6 y nadie se la pasaba, así que «comé
//      eso» salía por `orientacion` siempre. Ahora la memoria se DERIVA de la
//      ventana reciente del log, que es lo que hace que el historial alimente la
//      lectura y no sólo la pantalla.
//
// ═══ Y LO QUE AGREGÓ EL C2 ═════════════════════════════════════════════════
//
// La misma decisión, un piso más arriba: **los recuerdos también son una vista
// del log**, no un almacén nuevo (ver el encabezado de `recuerdos.ts`). De ahí
// salen las dos cosas que se enchufaron acá:
//
//   1. **«hacé lo que te pedí» recupera el pedido.** La línea de `entrada` guarda
//      la META que la frase pidió, así que el pedido sobrevive a la recarga
//      aunque el encargo no —el encargo es efímero y el durable es C3—;
//   2. **se puede citar qué recuerda y de dónde.** `queRecuerda()` devuelve cada
//      recuerdo con sus turnos y su procedencia, y el panel los pinta. Lo que el
//      cuidador AFIRMA queda como `dicho` y nunca como `hecho`: una frase no se
//      promueve a observación.
//
// ═══ Y EL C3: EL ENCARGO DEJA DE MORIRSE CON LA PESTAÑA ════════════════════
//
// `EncargoEnCurso` era un cursor sobre una lista de metas, con un índice adentro
// y sin identidad. Ahora es un GRAFO con nombre, con lo hecho anotado por nodo y
// con el tick en que el mundo lo probó, y se guarda en la quinta ranura.
//
// La consecuencia es la del criterio: **una recarga a mitad de un pedido de
// varias partes no repite la parte que ya estaba hecha**. Y no la repite ni
// siquiera si el mundo dejó de cumplirla, porque lo que se afirma es que se
// cumplió una vez — el ADR 0083 de Ánima I portado.
//
// El `Plan` sigue sin guardarse: es una hipótesis sobre el mundo de ahora y se
// reconstruye contra el que quedó.
//
// Lo que NO se hizo, y se dice para que nadie lo busque: aplicar la respuesta del
// proveedor (C4), prioridad e interrupción (C5), fragua y juez (C6). Y del C3
// mismo quedan dos mitades medidas y sin hacer: **el vocabulario de objetivo para
// cantidad y lugar** —«dos troncos», «junto al fuego»— y **el ejecutor de la
// ligadura diferida**, que se anota pero todavía no la usa nadie.

import { QUALITIES, TAGS, nameOf } from '@anima/physics'
import type { Physics } from '@anima/physics'
import { Contexto } from '@anima/perceive'
import type { Partida } from '@anima/perceive'
import { Creencias, Mente, PERMANENCIA_EN_TICKS, necesidades } from '@anima/mind'
import type { Drive, NeedVector, PedidoALaFragua } from '@anima/mind'
import { CATALOGO_CORE, ESQUEMAS, conOverlay, cumple, cumpleCuerpo, interpretar } from '@anima/plan'
import type { CatalogCapability, PlannerCatalogView } from '@anima/plan'
import {
  CanalDeHabla,
  EncargoEnCurso,
  PUENTE,
  consultaDe,
  encargoDe,
  enPalabras,
  leer,
  lexicoDe,
  loQuePidio,
  memoriaDe,
  recuerdosDe,
  recuperar,
  revisar,
} from '@anima/lang'
import type {
  Consulta,
  Dicho,
  EncargoGuardado,
  Lectura,
  Lexico,
  LoRecuperado,
  Recuerdo,
  RespuestaDelModelo,
} from '@anima/lang'

/** Lo que se está persiguiendo ahora, para mostrarlo al lado del progreso. */
export interface EnCurso {
  readonly meta: string
  /**
   * DE QUIÉN ES LA META, y no es un adorno.
   *
   * Se descubrió escribiendo el test: con la mente conectada y sin ninguna orden,
   * la criatura ya persigue metas propias —camina, junta— porque el `drive` del
   * cuidador **compite** con sus necesidades en vez de reemplazarlas. Entonces
   * «hay una meta en curso» no distingue obedecer de vivir, y una pantalla que no
   * lo dijera haría creer al jugador que todo lo que ve es consecuencia de lo que
   * pidió.
   */
  readonly de: 'vos' | 'ella'
  readonly hechas: number
  readonly total: number
}

/**
 * UNA META EN CASTELLANO, con dos intentos y en este orden.
 *
 *   1. **el puente**, que mapea «fuego» ↔ `emitsPower>0`. Leído al revés da el
 *      nombre humano, sale gratis y da la palabra corta y linda. Es exacto;
 *   2. **armar la frase leyendo el predicado**, para todo lo demás.
 *
 * El segundo existe porque el panel llegó a mostrar esto tal cual:
 *
 *     holding(tag:carnoso,toxicity<0.0528) (suya)
 *
 * y no se arreglaba agregando una fila: **el `0,0528` lo calcula la criatura en
 * el momento** —es cuánto veneno le conviene tragar, y depende de lo vacío que
 * tenga el tanque— así que cambia a cada tick. Una tabla necesitaría una fila por
 * número posible. Hoy eso se lee «tener algo carnoso y poco venenoso».
 *
 * Si los dos fallan sale la firma cruda, y eso se deja a propósito: verla en
 * pantalla es la señal de que a esa meta le falta una palabra.
 */
export function enCastellano(firma: string): string {
  for (const a of PUENTE) {
    if (a.denota.k === 'meta' && a.denota.firma === firma) return a.dice[0] ?? firma
  }
  const p = interpretar(firma)
  return p === undefined ? firma : enPalabras(p)
}

const ESTABLECIBLES = new Set(ESQUEMAS.map((e) => e.establishes))

/**
 * CUÁNTO PESA LO QUE LE PEDÍS, y es una decisión de producto que hay que decir.
 *
 * Estaba en 1, y `Drive.peso` está documentado como «cuánto vale contra lo que la
 * criatura elegiría sola, en [0,1]». O sea que 1 quería decir, literalmente, «lo
 * que te pido vale más que cualquier cosa que te pase». Medido: con el hambre en
 * 0,92 y un pescado a los pies, la criatura frotó dos palos 400 ticks seguidos.
 * Un peso de 1 no es obediencia, es sordera.
 *
 * 0,8 y no otro número, y las dos puntas del rango explican el lugar:
 *
 *   · **abajo**, la escalera sólo toma una orden si `peso > 1 − peso`, o sea
 *     arriba de 0,5. Debajo de eso el pedido directamente no se escucha;
 *   · **arriba**, `energia` llega a 0,8 con el tanque en 106 de 1000 —la curva
 *     es `((tanque − aliento)/tanque)²` y está escrita en `necesidades.ts`— o sea
 *     hambre de morirse.
 *
 * Entre esas dos, cualquier valor es un lugar en la cuerda. Éste dice «te hago
 * caso salvo que me esté muriendo», y se mueve el día que alguien lo juegue y le
 * parezca otra cosa. Lo que no se puede es no elegirlo: 1 también era una
 * elección, sólo que sin decirlo.
 */
const PESO_DEL_ENCARGO = 0.8

/**
 * CÓMO SE DICE CADA NECESIDAD. Las tres de `NeedVector`, y ni una más.
 *
 * La enumeración es cerrada —`necesidades()` devuelve exactamente estas tres— así
 * que esta tabla no se puede quedar corta sin que alguien toque la mente, y ahí
 * el tipo lo dice antes que ninguna prueba.
 */
const PALABRA_DE_NECESIDAD: Readonly<Record<keyof NeedVector, string>> = {
  energia: 'hambre',
  calor: 'frío',
  refugio: 'que se me viene la noche',
}

/**
 * ═══ C6 · LO QUE VUELVE DE UN EPISODIO DE LA FRAGUA, YA JUZGADO ═══════════════
 *
 * ─── POR QUÉ ESTE TIPO VIVE ACÁ Y NO SE IMPORTA DE `@anima/forge` ───────────
 *
 * Es la misma decisión que `@anima/forge` tomó con `CargoDelJuez` y que
 * `@anima/mind` tomó con `PedidoALaFragua`, y por el mismo motivo: **importarlo
 * haría que el juego dependa de la fragua y del juez**, y esos dos arrastran el
 * modelo, el presupuesto y un compilador de TypeScript. Una pestaña de navegador
 * no necesita nada de eso para jugar.
 *
 * Lo que cruza es un dato chico: un nombre, un grado y una fila de catálogo. Si
 * alguno cambia de nombre del otro lado, el que arma el puente —que ve los dos
 * lados— no compila. Es la misma garantía que los precedentes y no más que ésa.
 */
export interface Forjado {
  readonly nombre: string
  /**
   * EL GRADO DEL JUEZ, tal como lo publica `@anima/judge`: `promueve`,
   * `no-promueve`, `inconcluso` o `injuzgable`. Se compara contra el único que
   * habilita, que es el primero — los otros tres no son «casi»: son que no.
   */
  readonly grado: string
  /** En sus palabras, para poder decirlo por el canal. */
  readonly porQue: string
  /**
   * LA FILA DEL CATÁLOGO, y es opcional por un techo medido que no es de acá.
   *
   * `ConstructionSchema` tiene tres formas —proceso, ley, obra— y ninguna es «una
   * habilidad que establece X». O sea que una candidata CON plano se puede
   * publicar y una suelta no: se instala, se vuela, cambia el mundo, y el
   * planificador no la puede elegir porque no hay fila que la represente. Está
   * escrito y contado en `Instalada.capacidad` de `@anima/forge`.
   *
   * Acá se respeta y se dice: promovida sin capacidad se avisa y no se publica.
   */
  readonly capacidad?: CatalogCapability
}

/** El único grado del juez que habilita a usar lo que se forjó. */
const PROMUEVE = 'promueve'

/**
 * TODO LO QUE ESTE MUNDO SABE NOMBRAR, en un solo conjunto.
 *
 * Las tres enumeraciones son CERRADAS y salen de `@anima/physics`: las 29
 * cualidades, los 7 tags y las 6 formas. Las sustancias entran aparte porque son
 * de la partida y no del módulo.
 *
 * Se arma una vez por física y no por consulta: es una función pura de `phys` y
 * el portón la mira en cada hueco.
 */
function loQueSeSabeNombrar(phys: Physics): ReadonlySet<string> {
  const s = new Set<string>()
  for (const q of QUALITIES) s.add(q.id)
  for (const t of TAGS) s.add(t)
  for (const f of phys.substances.keys()) s.add(f)
  // Las palabras de la propia gramática de firmas. No son materia: son cómo se
  // escribe una firma, y confundirlas con vocabulario del mundo haría que
  // `holding(...)` se leyera como una sustancia que nadie declaró.
  for (const g of ['holding', 'tag', 'count', 'cerca']) s.add(g)
  return s
}

/** Las palabras de una firma. Todo lo que no sea número ni operador. */
const PALABRAS_DE_FIRMA = /[A-Za-z][A-Za-z0-9_]*/g

/**
 * «TENERLO» SIEMPRE TIENE CAMINO, aunque ningún esquema lo establezca.
 *
 * El acuse distingue «dale, voy» de «te entendí, pero no sé cómo hacerlo
 * todavía», y para eso pregunta si algún ESQUEMA establece la firma. Eso dejó de
 * alcanzar: el planificador aprendió una vía que no es un esquema —caminar hasta
 * algo que ya cumple la meta y agarrarlo, ver `agarrarLoQueYaHay`— así que
 * «traé un palo» tenía plan y el acuse seguía diciendo que no sabía.
 *
 * Lo que se afirma acá es lo que el planificador puede intentar, no que vaya a
 * encontrar algo: si no hay ningún palo a la vista no va a poder, y eso se ve
 * cuando no pasa nada. Es la misma honestidad que el resto del acuse — dice si
 * entendió y si conoce un camino, no si va a salir bien.
 */
function esUnTenerlo(firma: string): boolean {
  return interpretar(firma)?.k === 'sostiene'
}

/**
 * LO QUE UNA SESIÓN TRAE PUESTO, y las tres cosas entran juntas por una razón.
 *
 * Las tres son lo que una partida CARGADA tiene que recuperar —lo que aprendió,
 * de qué hablaron— más el borde asincrónico. Un cuarto parámetro posicional por
 * cada una convierte `new Ordenes(p, quien, phys, undefined, undefined, x)` en
 * algo que nadie lee.
 */
export interface OpcionesDeOrdenes {
  /** Lo que la criatura aprendió. Sin esto, una partida cargada vuelve a fallar en lo que sabía. */
  readonly memoria?: Creencias
  /** El log conversacional guardado. Sin esto, vuelve el mundo y se pierde la charla. */
  readonly charla?: readonly Dicho[]
  /**
   * EL ENCARGO EN CURSO, guardado. Sin esto, una recarga a mitad de un pedido de
   * varias partes lo pierde entero y hay que volver a pedirlo (C3).
   */
  readonly encargo?: EncargoGuardado
  /**
   * EL BORDE DEL PROVEEDOR, y lo importante es lo que NO hace.
   *
   * `@anima/lang` **describe** la consulta y no la manda (ADR II-0024): el que
   * espera es el de afuera. Acá se le entrega y **no se la espera**: no hay
   * `await`, la respuesta no se aplica y el tick ni se entera.
   *
   * ─── Y EL C4 LE PUSO LA OTRA MITAD: qué se hace con la respuesta ──────────
   *
   * En el C1 la respuesta se descartaba a propósito. Ahora se aplica, y **sólo en
   * la frontera de un tick** (ver `#aplicarLoQueLlego`). El `AbortSignal` es lo
   * que permite que una corrección del cuidador corte el viaje en vez de sólo
   * ignorar lo que vuelva: ignorar una respuesta que ya se pagó es tarde.
   */
  readonly preguntar?: (c: Consulta, signal?: AbortSignal) => Promise<RespuestaDelModelo | undefined>
  /**
   * ═══ C6 · LA FRAGUA, y es un PUERTO y no una implementación ═══════════════
   *
   * Recibe lo que la mente no supo planificar y devuelve lo que se forjó **ya
   * juzgado**, o `undefined` si no salió nada. Adentro pasa todo lo caro —armar
   * el encargo, el viaje al modelo, la puerta que typechequea, el banco del
   * juez— y nada de eso vive acá, por lo mismo que el resto de este archivo no
   * sabe pescar: **el juego no es el lugar donde se compila TypeScript**.
   *
   * Se le entrega y **no se la espera**: no hay `await`, el tick no se entera, y
   * lo que vuelva se aplica en la frontera junto con lo del proveedor. Es el
   * mismo borde del C4 y la misma razón — un episodio de fragua se mide en
   * segundos y un tick dura 50 ms.
   *
   * El que decide si se usa NO es este puerto: es el grado del juez, y lo lee el
   * portón de acá. Un puerto que decidiera solo sería la UI promoviendo
   * habilidades, que es exactamente lo que el hito prohíbe con esas palabras.
   */
  readonly fragua?: (p: PedidoALaFragua, signal?: AbortSignal) => Promise<Forjado | undefined>
}

/**
 * ═══ CUANDO EL JUEGO QUISO IR AL MODELO Y NO LLEGÓ ═════════════════════════
 *
 * Los dos puertos de arriba —`preguntar` y `fragua`— son opcionales, y hasta hoy
 * la ausencia de cada uno se leía como un `return` en silencio. Eso no es un
 * detalle de cableado: es la diferencia entre «no hacía falta preguntar» y «hacía
 * falta y no había a quién», y desde afuera se veían **idénticas**.
 *
 * Está medido en una partida real: `pedidos a la fragua: 2` contra `consultas al
 * modelo: 0`, con la lámpara de Claude diciendo «vive · en espera». Los tres
 * números eran ciertos por separado y juntos decían lo contrario de lo que
 * pasaba, que era que la criatura pidió ayuda dos veces y el pedido no salió del
 * cuarto.
 *
 * ─── POR QUÉ ES UN DATO Y NO UN `console.warn` ─────────────────────────────
 *
 * Porque tiene tres consumidores y ninguno es la consola: la lámpara de arriba,
 * el cartel que aparece, y el aviso que queda EN EL LOG —o sea en el guardado, o
 * sea en el reporte que se puede leer sin estar sentado adelante—. Un `warn` sirve
 * para el que ya está mirando las herramientas del navegador; esto es para el que
 * está jugando y para el que va a debuggear la partida mañana.
 */
export type PorQueNoLlego =
  /** No hay puerto enchufado. Es el de la partida medida, y es de cableado. */
  | 'sin-cable'
  /** Hubo viaje y reventó: la promesa se rechazó. Es de red o del CLI. */
  | 'se-cayo'
  /**
   * Llegó y volvió con las manos vacías.
   *
   * NO es una falla de acceso y por eso tiene motivo propio en vez de entrar en
   * `se-cayo`: el modelo contestó, dijo que no tenía nada mejor, y decir «no
   * llegué» sobre eso sería la misma mentira que este archivo vino a arreglar,
   * al revés. Se registra igual porque para el que mira la pantalla el síntoma
   * es el mismo —pidió ayuda y sigue sin poder— y el texto es el que distingue.
   */
  | 'no-trajo-nada'

/** Un momento en que el juego quiso ir al modelo y no le salió. */
export interface IntentoAlModelo {
  readonly tick: number
  /**
   * PARA QUÉ LO QUERÍA, y son las dos únicas cosas que este juego le pide a un
   * modelo: releer una frase que no terminó de entender (`preguntar`), o escribir
   * una habilidad que no tiene (`fragua`). Van separadas porque se arreglan en
   * lugares distintos y porque al que juega le importan cosas distintas: una es
   * «no te entendí» y la otra es «no sé hacerlo».
   */
  readonly para: 'entender' | 'aprender'
  readonly porque: PorQueNoLlego
  /** La frase o la meta que quedó sin atender, en castellano. */
  readonly sobre: string
}

/**
 * CUÁNTOS SE RETIENEN. El mismo criterio que el vigía usa con las roturas: lo que
 * entra en un reporte sin volverlo ilegible. La cuenta total no se recorta.
 */
const CUANTOS_INTENTOS_SE_RECUERDAN = 50

/** Una consulta en el aire, con lo que hace falta para juzgar su respuesta. */
interface EnVuelo {
  readonly llave: string
  /** El turno que la disparó. La otra mitad de la correlación. */
  readonly turno: number
  /** La lectura contra la que se pidió. `revisar` la necesita entera. */
  readonly lectura: Lectura
  /** Las firmas que la consulta ofreció. Sin esto, el modelo puede inventar una. */
  readonly ofrecidas: readonly string[]
  readonly corte: AbortController
}

/** Lo que volvió del proveedor, esperando la frontera. */
interface Llegada {
  readonly llave: string
  readonly turno: number
  readonly respuesta?: RespuestaDelModelo
  readonly falla?: unknown
}

export class Ordenes {
  readonly #partida: Partida
  readonly #quien: string
  readonly #lexico: Lexico
  readonly #memoria: Creencias
  #mente: Mente
  readonly #mentes = new Map<string, Mente>()
  #encargo: EncargoEnCurso | undefined
  /** La última meta puesta, para no reconstruir la `Mente` en cada tick. */
  #ultimaPuesta: string | undefined
  /** EL ÚNICO canal de salida: entrada, acuse, aviso, progreso y listo. */
  readonly #canal = new CanalDeHabla()
  readonly #preguntar: OpcionesDeOrdenes['preguntar']
  #ultimaLectura: Lectura | undefined
  #ventanaUsada = 0
  #consultas = 0
  #aplicadas = 0
  #descartadas = 0
  /** La única consulta viva. Un turno nuevo la reemplaza y la corta. */
  #enVuelo: EnVuelo | undefined
  /**
   * LO QUE YA VOLVIÓ Y TODAVÍA NO SE APLICÓ.
   *
   * Existe porque una promesa se resuelve cuando el motor quiere —en el medio de
   * un cuadro, entre dos ticks, mientras se dibuja— y aplicar ahí sería cambiarle
   * el objetivo a la criatura con la vista a mitad de camino. Acá se apila y en
   * `antesDelTick` se vacía: **la frontera es un lugar del código, no una
   * intención**.
   */
  #llegadas: Llegada[] = []
  /**
   * LO QUE TENÍA EN LA MANO EN EL TICK ANTERIOR.
   *
   * Arranca con lo que la criatura YA lleva y no vacío, y esa línea es la que
   * evita duplicar una salida al restaurar: con la lista vacía, el primer tick
   * después de una recarga narraría «agarró» todo lo que venía en la mano desde
   * antes de cerrar la pestaña.
   */
  #manosAntes: readonly string[]
  /** El último destino que se narró, para no repetir la línea cada tick. */
  #yendoA: string | undefined
  /**
   * DESDE CUÁNDO ESTÁ PAUSADO, para la histéresis de la vuelta. Ver
   * `#revisarLaPausa`. No se guarda con el encargo a propósito: la transición sí
   * queda anotada con su tick, y esto es el reloj de una decisión que se vuelve a
   * tomar contra el mundo que haya al abrir. Guardarlo sería reanudar por un
   * hambre que se midió antes de cerrar la pestaña.
   */
  #pausadaEn: number | undefined
  /**
   * LO QUE LA MENTE LE PIDIÓ A LA FRAGUA Y TODAVÍA NO SE MIRÓ.
   *
   * La costura la llama `escalera.ts` **adentro del tick**, mientras la criatura
   * decide. Trabajar ahí sería exactamente lo que el hito prohíbe: el episodio de
   * la fragua es un typecheck y un viaje al modelo, y el tick dura 50 ms. Así que
   * acá sólo se apila, y se mira en `antesDelTick`. Es la misma frontera que el
   * C4 usó para el proveedor, por la misma razón y en el mismo lugar.
   */
  #paraLaFragua: PedidoALaFragua[] = []
  /** Todos los que llegaron alguna vez. Es lo que se mide desde afuera. */
  readonly #pedidos: PedidoALaFragua[] = []
  /** Los gaps que ya se atendieron, para no pedir dos veces por lo mismo. */
  readonly #yaPedidos = new Set<string>()
  /** Lo que volvió de la fragua y espera la frontera. Igual que `#llegadas`. */
  #forjados: (Forjado | undefined)[] = []
  /** Cuántos episodios hay en el aire. Si hay uno, no se manda otro. */
  #forjando = 0
  /**
   * EL CATÁLOGO DE ESTA PARTIDA: el de fábrica más lo que se haya promovido.
   *
   * Vive acá y no en la mente porque la mente se reconstruye —en cada orden, en
   * cada pausa— y lo aprendido no se puede perder en cada reconstrucción. Es el
   * mismo motivo por el que `Creencias` vive acá desde el Hito 12.
   */
  #catalogo: PlannerCatalogView = CATALOGO_CORE
  /** Las capacidades promovidas, en orden. El overlay se re-arma desde el core. */
  readonly #promovidas: CatalogCapability[] = []
  readonly #sabeNombrar: ReadonlySet<string>
  readonly #fragua: OpcionesDeOrdenes['fragua']
  /** Los últimos intentos que no llegaron. Ver `IntentoAlModelo`. */
  #noLlego: IntentoAlModelo[] = []
  /**
   * Y cuántos hubo en total, que NO es `#noLlego.length`.
   *
   * La lista se recorta y la cuenta no: si fueran el mismo número, la partida
   * número 51 diría «50» para siempre y el panel se vería congelado justo cuando
   * más está pasando.
   */
  #cuantosNoLlegaron = 0
  /** Los avisos de charla ya dichos, para no repetirlos. Ver `#noLlegue`. */
  readonly #yaAvisados = new Set<string>()

  constructor(partida: Partida, quien: string, phys: Physics, o: OpcionesDeOrdenes = {}) {
    this.#partida = partida
    this.#quien = quien
    this.#lexico = lexicoDe(phys, PUENTE)
    this.#memoria = o.memoria ?? new Creencias()
    this.#preguntar = o.preguntar
    this.#fragua = o.fragua
    this.#sabeNombrar = loQueSeSabeNombrar(phys)
    this.#mente = this.#nuevaMente()
    if (o.charla !== undefined) this.#canal.cargar(o.charla)
    // El encargo vuelve con lo que ya estaba probado adentro. El plan NO vuelve:
    // se replanifica contra el mundo que quedó, que es la promesa del ADR 0009.
    if (o.encargo !== undefined) {
      const e = EncargoEnCurso.desdeGuardado(o.encargo)
      this.#encargo = e
      // ─── DE QUIÉN ERA LA PAUSA QUE ME ENCONTRÉ PUESTA ────────────────────
      //
      // El scheduler sólo levanta las pausas que puso él, y una sesión recién
      // abierta no puso ninguna. Sin esta línea, un encargo que se guardó pausado
      // por hambre volvía pausado PARA SIEMPRE: el reloj de la vuelta arrancaba
      // vacío y la regla lo leía como «la pausó el cuidador».
      //
      // El tick de la transición vieja y no el de ahora: lo que se recupera es
      // desde cuándo está parada, y si ya pasó la permanencia vuelve en el primer
      // tick — que es lo correcto, porque estuvo parada todo ese rato.
      const t = e.ultimaTransicion
      if (e.pausado && t?.quien === 'ella') this.#pausadaEn = t.enTick
    }
    this.#manosAntes = [...(partida.state.actors.get(quien)?.holding ?? [])]
  }

  /** Lo que aprendió. Lo necesita quien guarda. */
  get memoria(): Creencias {
    return this.#memoria
  }

  get mentes(): ReadonlyMap<string, Mente> {
    return this.#mentes
  }

  /** EL LOG, entero y en orden. Lo pinta la UI y lo guarda `@anima/store`. */
  get charla(): readonly Dicho[] {
    return this.#canal.todo
  }

  /** La última lectura, tal como salió. Es lo observable de «entendió qué». */
  get ultimaLectura(): Lectura | undefined {
    return this.#ultimaLectura
  }

  /** Cuántos turnos previos entraron como contexto en la última lectura. */
  get ventanaUsada(): number {
    return this.#ventanaUsada
  }

  /** Cuántas consultas se le pasaron al proveedor. Ninguna se esperó. */
  get consultas(): number {
    return this.#consultas
  }

  /** Cuántas respuestas del proveedor se aplicaron, siempre en frontera de tick. */
  get aplicadas(): number {
    return this.#aplicadas
  }

  /**
   * Cuántas se tiraron por viejas, por no corresponder o por no mejorar nada.
   *
   * Se cuenta y no se calla: un descarte silencioso hace que «el modelo no sirve»
   * y «el modelo llegó tarde» se vean igual desde afuera.
   */
  get descartadas(): number {
    return this.#descartadas
  }

  /**
   * LOS ÚLTIMOS INTENTOS QUE NO LLEGARON AL MODELO, del más viejo al más nuevo.
   *
   * Es lo que la pantalla mira para saber si tiene algo que decir. Se devuelve
   * una copia por lo mismo que `pedidosALaFragua`: quien pinta no puede cambiar
   * lo que pasó.
   */
  get loQueNoLlego(): readonly IntentoAlModelo[] {
    return [...this.#noLlego]
  }

  /** Cuántos hubo en total, sin recortar. Ver `#cuantosNoLlegaron`. */
  get cuantosNoLlegaron(): number {
    return this.#cuantosNoLlegaron
  }

  /**
   * LO QUE RECUERDA DE LA CHARLA, con su fuente. El C2 lo pide para poder citar.
   *
   * Se deriva del log en la llamada y no se guarda: los recuerdos son una vista.
   * Ver el encabezado de `recuerdos.ts` — el repo ya rechazó dos veces abrir una
   * sede de estado más.
   */
  queRecuerda(): readonly Recuerdo[] {
    return recuerdosDe(this.#canal.todo)
  }

  /**
   * EL ENCARGO EN CURSO, como dato. Es lo que se guarda y lo que se puede leer
   * desde afuera para saber qué se pidió y qué parte de eso el mundo ya probó.
   */
  get encargo(): EncargoGuardado | undefined {
    return this.#encargo?.volcar()
  }

  /** La meta que la mente tiene puesta ahora mismo, cruda. `undefined` si ninguna. */
  get metaEnCurso(): string | undefined {
    return this.#ultimaPuesta
  }

  /**
   * A QUÉ CUERPO APUNTA EL NODO PENDIENTE, sea por corrección o por ligadura.
   *
   * Es lo que cruza al `drive`, y se expone porque es el observable de las dos
   * mitades de la identidad: «no ése, el otro» y «asá el pescado». Sin esto, que
   * la referencia llegue o no llegue al plan sólo se ve corriendo la partida.
   */
  senaladoDelPendiente(): string | undefined {
    return this.#encargo?.senaladoDelPendiente()
  }

  /** Lo que el historial tiene que ver con una frase, con su tope. */
  recuperar(texto: string): LoRecuperado {
    return recuperar(this.#canal.todo, {
      texto,
      entidades: memoriaDe(this.#canal.ventana()).nombrados,
    })
  }

  get enCurso(): EnCurso | undefined {
    const e = this.#encargo
    const meta = this.#mente.estado.metaEnCurso ?? this.#ultimaPuesta
    if (meta === undefined) return undefined
    // Es tuya sólo si hay un encargo abierto Y la meta que la escalera persigue es
    // la que se le puso. Si la mente cambió a una suya —porque el hambre le ganó
    // al pedido— esto lo dice, en vez de seguir mostrando la orden vieja.
    const tuya = e !== undefined && this.#ultimaPuesta === meta
    return {
      meta: enCastellano(meta),
      de: tuya ? 'vos' : 'ella',
      hechas: e?.hechas ?? 0,
      total: tuya ? e.total : 1,
    }
  }

  /**
   * ¿EL MUNDO YA CUMPLE ESTA FIRMA? Contra la vista de AHORA y no contra una foto.
   *
   * Existe por una medición del Hito 6 que conviene no perder: «fabricá una
   * trampa» sale como `catch>0`, y un `Predicado` es EXISTENCIAL —dice «que haya
   * algo que atrape», no «que vos hagas uno»—. Con una caña a la vista la meta ya
   * está cumplida y la mente la descarta con razón; lo que estaba mal era que
   * desde afuera se veía igual que «no me hace caso».
   */
  /**
   * ¿EL CATÁLOGO SABE ESTABLECER ESTA FIRMA? Una sola definición, dos lectores.
   *
   * La usan `leer()` en el camino rápido y `revisar()` cuando vuelve el modelo, y
   * tienen que ser LA MISMA: si el portón del modelo fuera más flojo que el
   * local, el modelo podría comprometer conducta sobre metas que el planificador
   * no sabe alcanzar — que es el portón que `consulta.ts` ya cobró una vez.
   */
  #sabeElCatalogo = (f: string): boolean => ESTABLECIBLES.has(f) || esUnTenerlo(f)

  /**
   * CON QUÉ CUERPO DE LA MANO SE CUMPLE ESTA FIRMA. Es lo que rinde un nodo.
   *
   * Sólo la mano y sólo la forma `sostiene`: las otras dos hablan de lo que se
   * ve, y «lo que rindió el nodo» tiene que ser algo que la criatura CONSIGUIÓ.
   * Un `emitsPower>0` cumplido por una fogata que estaba prendida desde antes no
   * rindió nada — y decir que sí haría que el nodo siguiente atara su ligadura a
   * un cuerpo que la criatura nunca tocó.
   */
  /**
   * LA VISTA DE AHORA, que es la misma que ve la mente.
   *
   * Se arma en la llamada y no se guarda, por lo mismo que `yaEstaCumplida` no
   * cachea: una vista es lo que se ve EN ESTE tick, y la de hace veinte es una
   * foto de un mundo que ya no está.
   */
  #vista(): Parameters<typeof cumple>[1] {
    return new Contexto(this.#partida.proyeccion, {
      actor: this.#quien,
      rng: this.#partida.dado.tirar,
      lugares: this.#partida.lugares,
    }).ctx
  }

  #conQueSeCumple = (firma: string): string | undefined => {
    const pr = interpretar(firma)
    if (pr === undefined || pr.k !== 'sostiene') return undefined
    const v = this.#vista()
    for (const b of v.self.holding) if (cumpleCuerpo(pr, b, (x, q) => v.q(x, q))) return b.id
    return undefined
  }

  #yaEstaCumplida = (firma: string): boolean => {
    const pr = interpretar(firma)
    if (pr === undefined) return false
    return cumple(pr, this.#vista())
  }

  /**
   * LO QUE MÁS LE DUELE AHORA, con su palabra. Las tres necesidades, la peor.
   *
   * Se le pregunta a `necesidades()` de `@anima/mind` y no se calcula acá: es la
   * MISMA función que la escalera usa para decidir, así que el scheduler de
   * afuera y la mente de adentro no pueden estar mirando dos hambres distintas.
   * Escribir la cuenta otra vez sería fabricar esa diferencia.
   */
  #loQueMasDuele(): { readonly cuanto: number; readonly palabra: string } {
    const n = necesidades(this.#vista())
    let cual: keyof NeedVector = 'energia'
    for (const k of ['calor', 'refugio'] as const) if (n[k] > n[cual]) cual = k
    return { cuanto: n[cual], palabra: PALABRA_DE_NECESIDAD[cual] }
  }

  /** Lo que se le dice. El acuse entra al log en la misma llamada. */
  decir(texto: string): void {
    const dicho = texto.trim()
    if (dicho === '') return
    const tick = this.#partida.state.tick

    // ─── LA VENTANA SE TOMA ANTES DE ESCRIBIR ESTE TURNO ────────────────────
    //
    // Son «los turnos PREVIOS», así que el que se está escribiendo no cuenta. Da
    // igual para la memoria —una entrada del cuidador no trae cuerpo— y no da
    // igual para el número: `ventanaUsada` es una medición y tiene que decir
    // cuánto contexto había, no cuánto hay contando lo que se acaba de agregar.
    // Un turno nuevo corta lo que esté en el aire: la respuesta que venía era
    // sobre otro contexto. Va ANTES de leer, para que ni siquiera pueda colarse
    // entre la lectura y el encargo de esta misma llamada.
    this.#cortarLoQueEsteEnElAire()

    const ventana = this.#canal.ventana()
    this.#ventanaUsada = ventana.length

    // ─── SE LEE ANTES DE ESCRIBIR EL TURNO, y el orden es del C2 ────────────
    //
    // Porque la línea de `entrada` guarda LA META que la frase pidió, y esa meta
    // sale de la lectura. Escribir primero y corregir después dejaría un turno
    // que por un instante dice que no pidió nada — y lo que se guarda es lo que
    // se lee. En el log el orden sigue siendo entrada → acuse, y las dos salen
    // de esta misma llamada sincrónica: el acuse no espera nada.
    const l = leer(dicho, {
      phys: this.#partida.state.phys,
      lexico: this.#lexico,
      sabeElCatalogo: this.#sabeElCatalogo,
      yaEstaCumplida: this.#yaEstaCumplida,
      // EL CONTEXTO PREVIO, derivado del log durable. Es lo que hace que «comé
      // eso» tenga a qué apuntar — también después de cerrar la pestaña.
      memoria: memoriaDe(ventana),
      // Y la otra mitad: a qué TURNO apunta «lo que te pedí». Sale del log
      // entero y no de la ventana — un pedido de hace veinte líneas sigue siendo
      // el último pedido.
      loQuePidio: () => loQuePidio(this.#canal.todo)?.meta,
    })
    this.#ultimaLectura = l

    const meta = l.clausulas[0]?.firma
    this.#canal.decir(tick, 'entrada', dicho, {
      ...(meta === undefined ? {} : { meta }),
      confianza: l.confianza,
    })
    const turno = this.#canal.todo.at(-1)?.turno ?? 0

    // ─── ¿ES UN CONTROL DEL ENCARGO? Primero de todo, y por eso ─────────────
    //
    // «Pará» no es una orden nueva ni una corrección de la vieja: es una frase
    // SOBRE el encargo. Si se leyera después, `encargoDe` ya habría decidido que
    // no hay meta y la frase se habría perdido — que es lo que pasaba.
    const controlado = this.#controlar(tick)
    if (controlado !== undefined) {
      this.#canal.decir(tick, 'acuse', controlado)
      return
    }

    // ─── ¿ES UNA CORRECCIÓN? Antes del encargo, porque cambia hasta el acuse ─
    const corregido = this.#corregir(turno, dicho)
    if (corregido !== undefined) {
      this.#canal.decir(tick, 'acuse', corregido)
      return
    }

    this.#canal.decir(tick, 'acuse', l.acuse)
    // El turno de la `entrada` es lo que correlaciona la respuesta con el pedido:
    // la llave sola no alcanza, porque la misma frase dicha dos veces da la misma.
    this.#consultar(l, turno, tick)

    const e = encargoDe(l)
    // Un encargo vacío NO se pisa sobre el anterior: si la frase no se pudo
    // convertir en nada, lo que la criatura estaba haciendo sigue. Borrarlo sería
    // castigar una frase mal entendida cancelando una orden que sí se entendió.
    if (e.metas.length === 0) return
    // El turno de la `entrada` es la procedencia del encargo: de ahí salió, y por
    // ahí se vuelve a la conversación que lo pidió.
    this.#encargo = EncargoEnCurso.nuevo(e, [turno], dicho, tick)
    this.#ultimaPuesta = undefined
  }

  /**
   * LA CONSULTA AL PROVEEDOR, QUE NO SE ESPERA. Ver `OpcionesDeOrdenes.preguntar`.
   *
   * `consultaDe` devuelve `undefined` cuando no hay nada que preguntar —la
   * lectura se entendió, o falla el mundo y no la frase— así que sin proveedor y
   * con una frase clara esto no cuesta nada.
   *
   * La respuesta se descarta A PROPÓSITO: aplicarla es C4. Lo único que se hace
   * con ella es contarla, y el `catch` está para que un proveedor que revienta no
   * tire un rechazo sin dueño a la consola del jugador.
   */
  /**
   * ANOTAR QUE NO SE LLEGÓ, y opcionalmente decirlo.
   *
   * El `aviso` es opcional porque DOS de los cuatro puntos de registro ya tenían
   * su frase escrita desde antes (`no pude pensarlo mejor…`, `no me salió…`) y
   * pisarlas acá dejaría dos líneas diciendo lo mismo con distintas palabras. Los
   * que no la tenían son justamente los del cable, que es lo que no se decía.
   *
   * ─── EL AVISO SE DICE UNA VEZ; EL REGISTRO SE ANOTA SIEMPRE ────────────────
   *
   * Y la asimetría no es una comodidad: son dos canales con dos duraciones. El
   * registro alimenta la lámpara y el cartel, que hablan del AHORA y se apagan
   * solos; el aviso entra al log, o sea al guardado, o sea al reporte, y ahí una
   * línea repetida cuarenta veces no informa cuarenta veces — tapa lo que había
   * alrededor.
   *
   * Está medido y no supuesto: sin este cerrojo, un test que escribe treinta
   * frases seguidas metía treinta avisos idénticos y el buscador de recuerdos
   * dejaba de encontrar el turno que importaba. La pantalla se veía bien y la
   * memoria de la criatura se había llenado de ruido.
   *
   * Es el mismo cerrojo que `#alaFragua` tiene desde antes y por la misma razón.
   */
  #noLlegue(tick: number, i: Omit<IntentoAlModelo, 'tick'>, aviso?: string): void {
    this.#cuantosNoLlegaron++
    this.#noLlego.push({ tick, ...i })
    if (this.#noLlego.length > CUANTOS_INTENTOS_SE_RECUERDAN) {
      this.#noLlego = this.#noLlego.slice(-CUANTOS_INTENTOS_SE_RECUERDAN)
    }
    if (aviso === undefined) return
    // ─── QUÉ CUENTA COMO «EL MISMO AVISO», y depende de para qué era ────────
    //
    // Con `aprender`, el `sobre` es el hueco que faltó y sale del catálogo: son
    // pocos, son distintos entre sí, y «me falta secar la leña» y «me falta un
    // filo» son dos cosas que vale la pena decir las dos.
    //
    // Con `entender`, el `sobre` es LA FRASE QUE ESCRIBISTE. Meterla en la llave
    // sería no tener llave: cada frase nueva es una llave nueva, y el cerrojo no
    // cerraría nada. Ahí lo que se dice una vez es que no hay a quién preguntarle,
    // que es un hecho de la partida y no de la frase.
    const llave = i.para === 'aprender' ? `${i.para}|${i.porque}|${i.sobre}` : `${i.para}|${i.porque}`
    if (this.#yaAvisados.has(llave)) return
    this.#yaAvisados.add(llave)
    this.#canal.decir(tick, 'aviso', aviso)
  }

  #consultar(l: Lectura, turno: number, tick: number): void {
    // ─── LA CONSULTA SE ARMA ANTES DE MIRAR SI HAY A QUIÉN MANDARLA ─────────
    //
    // El orden estaba al revés y no era gratis: con el `preguntar === undefined`
    // primero, la salida silenciosa tapaba las dos preguntas de golpe —«¿había
    // algo que consultar?» y «¿había con qué?»— y sólo la segunda es de cableado.
    // Armarla primero cuesta una lectura del léxico por FRASE ESCRITA, no por
    // tick, y compra poder decir «te habría preguntado».
    //
    // La ventana va adentro de la consulta: el modelo tiene que leer la frase
    // con el mismo contexto con el que la leyó el lector local, o los dos
    // contestan sobre entradas distintas.
    const c = consultaDe(l, this.#lexico, [...ESTABLECIBLES], this.#canal.ventana())
    if (c === undefined) return
    const preguntar = this.#preguntar
    if (preguntar === undefined) {
      this.#noLlegue(
        tick,
        { para: 'entender', porque: 'sin-cable', sobre: l.crudo },
        'no te entendí del todo y no tengo a quién preguntarle',
      )
      return
    }
    this.#consultas++
    const corte = new AbortController()
    const ofrecidas = [...ESTABLECIBLES]
    this.#enVuelo = { llave: c.llave, turno, lectura: l, ofrecidas, corte }
    void preguntar(c, corte.signal).then(
      (respuesta) => {
        this.#llegadas.push({ llave: c.llave, turno, ...(respuesta === undefined ? {} : { respuesta }) })
      },
      (falla: unknown) => {
        this.#llegadas.push({ llave: c.llave, turno, falla })
      },
    )
  }

  /**
   * «PARÁ ESO», «SEGUÍ», «OLVIDATE»: las tres frases que hablan DEL PEDIDO.
   *
   * Devuelve el acuse, o `undefined` si la frase no era una de ésas.
   *
   * ─── LO ÚNICO QUE HACE FALTA ES ESCUCHAR ───────────────────────────────────
   *
   * El verbo ya venía leído: `alias.ts` tiene la fila de `parar` desde el Hito 6
   * y `componer` lo mandaba al cajón de «no lleva a un estado del mundo», que es
   * cierto y era todo lo que se hacía con él. El cuidador leía «no te entendí del
   * todo» y la criatura seguía con lo mismo. Es la misma forma que tenía «no ése,
   * el otro» antes del C3: una frase leída que no escuchaba nadie.
   *
   * ─── Y LA ÚNICA QUE NO OBEDECE, con su porqué ──────────────────────────────
   *
   * «Seguí» sobre una pausa que puso el HAMBRE se contesta que no. Va contra la
   * regla del C3 —lo último que dijo una persona gana siempre— a propósito: esa
   * regla vale para lo que el cuidador sabe (cuál tronco quiso decir) y no para
   * lo que el cuerpo de la criatura tiene. Y la alternativa está medida: reanudar
   * la deja lista para que el scheduler la vuelva a pausar en el tick siguiente,
   * o sea un «tengo hambre» por tick para siempre.
   */
  #controlar(tick: number): string | undefined {
    const c = this.#ultimaLectura?.clausulas[0]
    const verbo = c?.verbo
    if (verbo !== 'parar' && verbo !== 'seguir' && verbo !== 'cancelar') return undefined
    // ─── «PARA» SIN ACENTO TAMBIÉN ES PREPOSICIÓN, y lo encontró un test ─────
    //
    // El del C4 usa «dale para el agua» como frase floja, y con el control recién
    // puesto esa frase paraba el encargo: `clave()` saca los acentos, así que la
    // preposición «para» y el imperativo «pará» son la misma palabra para el
    // léxico. No se arregla con acentos —nadie los escribe en un chat— y se
    // arregla con lo que estos tres verbos son, que ya estaba escrito en
    // `alias.ts`: **son los que no piden nada**.
    //
    // «Pará eso» no nombra ninguna cosa. «Dale para el agua» nombra el agua. Si la
    // frase nombra algo, «para» está uniendo dos partes de una oración y no es una
    // orden de parar.
    if ((c?.objetos.length ?? 0) > 0) return undefined
    const e = this.#encargo
    // Sin encargo abierto no hay qué parar, y decirlo es mejor que callarse: el
    // cuidador que escribe «pará» está seguro de que algo está pasando.
    if (e === undefined) return 'no estoy haciendo nada que me hayas pedido'

    if (verbo === 'cancelar') {
      e.cancelar(tick, 'me lo pediste', 'vos')
      // Se suelta el objeto y no sólo el estado: un encargo cancelado que sigue
      // colgado del cursor volvería a mirarse en cada tick. Lo que queda de él es
      // la charla, que es donde vive lo que pasó.
      this.#encargo = undefined
      this.#soltarElDrive()
      return 'dale, me olvido'
    }

    if (verbo === 'parar') {
      if (e.pausar(tick, 'me lo pediste', 'vos') === undefined) return 'ya estaba parada'
      // `#pausadaEn` queda en `undefined` A PROPÓSITO: es el reloj del scheduler
      // del hambre, y el que pausa es el que reanuda. Sin esto, «pará» duraría
      // ocho ticks y el cuidador no tendría cómo pararla de verdad.
      this.#pausadaEn = undefined
      this.#soltarElDrive()
      return 'dale, lo dejo'
    }

    const duele = this.#loQueMasDuele()
    if (duele.cuanto > PESO_DEL_ENCARGO) return `no puedo, tengo ${duele.palabra}`
    if (e.reanudar(tick, 'me lo pediste', 'vos') === undefined) return 'si no había parado'
    this.#pausadaEn = undefined
    return 'dale, sigo'
  }

  /**
   * «NO ÉSE, EL OTRO»: revisar el encargo abierto en vez de perder la frase.
   *
   * Devuelve el acuse de la corrección, o `undefined` si la frase no lo era.
   *
   * ─── LA REGLA, y es una sola ────────────────────────────────────────────────
   *
   * **Una cláusula que señala un cuerpo, no pide ninguna meta propia, y llega con
   * un encargo abierto, es una corrección de ese encargo.** No hace falta
   * entender la negación: si dijera una meta sería un pedido nuevo, y si no
   * señalara nada no habría a qué cambiar.
   *
   * Antes de esto, «no ése, el otro» no hacía absolutamente nada: la lectura
   * salía `no-entendida`, `objetivosDe` la descartaba, y `decir` volvía sin tocar
   * el encargo. El cuidador veía «no te entendí» y la criatura seguía con lo
   * mismo — que es lo peor de los dos mundos, porque parece que entendió que no.
   */
  #corregir(turno: number, dicho: string): string | undefined {
    const e = this.#encargo
    const c = this.#ultimaLectura?.clausulas[0]
    if (e === undefined || c === undefined) return undefined
    if (c.firma !== undefined) return undefined
    const ref = c.referencia?.ref
    if (ref === undefined || ref.k !== 'id') return undefined

    const r = e.revisar(turno, ref.id, dicho)
    if (r === undefined) return undefined
    // Se lo nombra y no se contesta «ése»: «dale, ése entonces» es exactamente
    // igual de ambiguo que la frase que se está corrigiendo, y el punto de la
    // corrección es que quede claro cuál.
    const cuerpo = this.#partida.state.bodies.get(r.sobre)
    const como = cuerpo === undefined ? r.sobre : nameOf(cuerpo.body, this.#partida.state.phys)
    return `dale, ${como} entonces`
  }

  /**
   * CORTAR LO QUE ESTÉ EN EL AIRE. Lo llama cada turno nuevo del cuidador.
   *
   * **Cualquier turno, no sólo una corrección.** El documento habla de «una
   * corrección del usuario», y distinguir una corrección de un cambio de tema
   * pide entender la frase — que es justo lo que se estaba esperando. La regla
   * que no necesita adivinar es la de arriba: un turno nuevo cambia el contexto
   * con el que se pidió, así que la respuesta que venía ya no es sobre esto.
   */
  #cortarLoQueEsteEnElAire(): void {
    const v = this.#enVuelo
    if (v === undefined) return
    this.#enVuelo = undefined
    v.corte.abort()
  }

  /**
   * LA FRONTERA: lo que volvió del proveedor se aplica ACÁ y en ningún otro lado.
   *
   * ─── Los tres portones, y ninguno es de lujo ────────────────────────────────
   *
   *   1. **correlación** — la respuesta tiene que ser de la consulta que sigue
   *      viva, por llave Y por turno. Una respuesta tardía no puede pisar un
   *      encargo más nuevo;
   *   2. **`revisar` no empeora nunca** — devuelve la MISMA lectura por identidad
   *      cuando la respuesta no valida, y ahí se descarta. La llave de contexto,
   *      las firmas ofrecidas y el grado los vuelve a mirar él;
   *   3. **una caída se dice** — con un `aviso`, que es la clase de «lo que no se
   *      pudo, con su porqué». Un proveedor caído en silencio es indistinguible
   *      de uno que contestó que no había nada, y eso es un falso éxito.
   */
  #aplicarLoQueLlego(tick: number): void {
    if (this.#llegadas.length === 0) return
    const llegadas = this.#llegadas
    this.#llegadas = []
    for (const x of llegadas) {
      const v = this.#enVuelo
      if (v === undefined || v.llave !== x.llave || v.turno !== x.turno) {
        this.#descartadas++
        continue
      }
      this.#enVuelo = undefined
      if (x.falla !== undefined) {
        // El aviso lo dice el llamador y no `#noLlegue`: esta frase es más vieja
        // que el registro y hay un test que la nombra.
        this.#canal.decir(tick, 'aviso', 'no pude pensarlo mejor, sigo con lo que entendí')
        this.#noLlegue(tick, { para: 'entender', porque: 'se-cayo', sobre: v.lectura.crudo })
        continue
      }
      if (x.respuesta === undefined) {
        this.#descartadas++
        this.#noLlegue(tick, { para: 'entender', porque: 'no-trajo-nada', sobre: v.lectura.crudo })
        continue
      }
      const nueva = revisar(v.lectura, x.respuesta, this.#lexico, {
        ofrecidas: v.ofrecidas,
        sabeElCatalogo: this.#sabeElCatalogo,
      })
      // Identidad y no comparación de contenido: `revisar` promete devolver el
      // mismo objeto cuando no aporta nada, y ése es su contrato.
      if (nueva === v.lectura) {
        this.#descartadas++
        continue
      }
      this.#aplicadas++
      this.#ultimaLectura = nueva
      // «Lo pensé mejor» y no «el modelo dijo»: para el cuidador, lo que cambió
      // es lo que ella entendió. Que la corrección vino de afuera queda en
      // `ClausulaLeida.leidaPor`, que es donde se mide.
      this.#canal.decir(tick, 'acuse', `lo pensé mejor: ${nueva.acuse}`)
      const e = encargoDe(nueva)
      if (e.metas.length === 0) continue
      this.#encargo = EncargoEnCurso.nuevo(e, [x.turno], v.lectura.crudo, tick)
      this.#ultimaPuesta = undefined
    }
  }

  /**
   * LO QUE HIZO, NARRADO — y se llama DESPUÉS del paso, no antes.
   *
   * Es la regla que `narrarProgreso` ya declaraba: **el progreso se narra por lo
   * que la criatura HIZO, no por lo que va a hacer**. Un «ya casi» sacado de una
   * estimación convierte una espera en una mentira; «agarró una vara» es un hecho
   * y se comprueba mirando el mundo.
   *
   * Y el cuerpo va en `sobre` porque es lo que hace de esta línea un dato y no una
   * frase: lo último con cuerpo es a lo que apunta «eso» en el turno siguiente.
   */
  /**
   * A QUÉ CUERPO VA LA INTENCIÓN QUE ESTÁ VOLANDO, si va a alguno.
   *
   * Sólo `ir` y `sostener`, que son los dos pasos que nombran un destino. Un
   * `aplicar` nombra roles y un `esperar` no nombra nada: mirarlos daría una
   * línea por cada cosa que la criatura toca, que es exactamente el ruido que
   * este mecanismo evita.
   */
  #aDondeVa(): string | undefined {
    const paso = this.#mente.estado.enVuelo
    if (paso === undefined) return undefined
    if (paso.k === 'ir' && paso.a.k === 'id') return paso.a.id
    if (paso.k === 'sostener' && paso.que.k === 'id') return paso.que.id
    return undefined
  }

  despuesDelTick(): void {
    // ─── LO QUE VA A BUSCAR SE NOMBRA, y por eso «el otro» puede existir ─────
    //
    // La medición que lo pidió: la charla sólo sabía nombrar lo que la criatura
    // YA HABÍA AGARRADO, porque las únicas líneas con cuerpo eran los `agarró`.
    // Un cuidador que dice «no ése, el otro tronco» está señalando algo del
    // PISO, y de eso el log no sabía nada — así que la corrección no tenía a qué
    // apuntar y el ejecutor de la referencia no servía para nada.
    //
    // La regla es la más barata que resuelve eso: **se nombra a dónde va**, no
    // todo lo que se ve. Una línea por destino y no una por cuerpo a la vista:
    // lo que el cuidador corrige es la decisión, no el paisaje.
    const va = this.#aDondeVa()
    if (va !== undefined && va !== this.#yendoA) {
      this.#yendoA = va
      const c = this.#partida.state.bodies.get(va)
      const como = c === undefined ? va : nameOf(c.body, this.#partida.state.phys)
      this.#canal.decir(this.#partida.state.tick, 'progreso', `va por ${como}`, { sobre: va })
    }

    const s = this.#partida.state
    const ahora = s.actors.get(this.#quien)?.holding ?? []
    if (ahora.length === this.#manosAntes.length && ahora.every((id, i) => this.#manosAntes[i] === id)) {
      return
    }
    for (const id of ahora) {
      if (this.#manosAntes.includes(id)) continue
      const c = s.bodies.get(id)
      // El id crudo si el cuerpo no está: no se calla la línea. Que una cosa
      // aparezca en la mano sin nombre es información, no un motivo para no
      // decirlo.
      const como = c === undefined ? id : nameOf(c.body, s.phys)
      this.#canal.decir(s.tick, 'progreso', `agarró ${como}`, { sobre: id })
    }
    this.#manosAntes = [...ahora]
  }

  /**
   * ═══ EL SCHEDULER DEL C5: CUÁNDO SE PAUSA Y CUÁNDO SE VUELVE ═══════════════
   *
   * ─── POR QUÉ ESTO VIVE ACÁ Y NO ADENTRO DE LA MENTE ────────────────────────
   *
   * Porque la mente **no sabe que hay un encargo**. Recibe UNA meta y no un
   * grafo —es la costura del C3, y está medida— así que el único que puede
   * decir «esto que estás haciendo es la segunda de dos partes de algo que te
   * pidieron, y lo vamos a dejar para después» es el de afuera.
   *
   * Y hay una segunda razón, más dura, y también medida: **la escalera no puede
   * interrumpirse a sí misma**. D1 devuelve `seguir` mientras haya una intención
   * en vuelo, así que mientras `frotar` esté volando la escalera ni siquiera baja
   * a D3, que es donde el hambre podría ganar. El único peldaño que corta algo en
   * vuelo es D0, y D0 es sólo para lo que quema. Con el hambre en 0,92 y un
   * pescado a los pies, la criatura frotó dos palos 400 ticks.
   *
   * Así que la pausa no es «bajarle la prioridad al drive»: es **soltar el
   * drive**, que es la operación que este archivo ya hacía en cada orden nueva.
   * La mente se reconstruye sin objetivo del cuidador y elige lo suyo, que es
   * exactamente lo que tiene que pasar cuando se está muriendo de hambre.
   *
   * ─── LA VUELTA NO ES SIMÉTRICA, y ahí está el número de la escalera ────────
   *
   * Se pausa apenas duele, y se vuelve recién `PERMANENCIA_EN_TICKS` después de
   * que dejó de doler. No es prudencia: una necesidad que oscila alrededor del
   * umbral pausaría y reanudaría un tick sí y otro también, y el cuidador leería
   * ocho «tengo hambre» seguidos. Es la misma histéresis que la escalera aplica
   * entre peldaños y es el MISMO número, leído de allá: dos anti-oscilaciones con
   * dos constantes distintas serían dos ideas de cuánto dura una idea.
   */
  #revisarLaPausa(e: EncargoEnCurso, tick: number): void {
    const duele = this.#loQueMasDuele()

    if (!e.pausado) {
      if (duele.cuanto <= PESO_DEL_ENCARGO) return
      const t = e.pausar(tick, duele.palabra, 'ella')
      if (t === undefined) return
      this.#pausadaEn = tick
      // `aviso` y no habla: es la clase de «lo que no se pudo, con su porqué», y
      // esto es exactamente eso. Que lo diga es la mitad del hito — una pausa
      // callada es indistinguible de una criatura que te ignora.
      this.#canal.decir(tick, 'aviso', `tengo ${duele.palabra}, dejo esto y vuelvo`)
      this.#soltarElDrive()
      return
    }

    if (duele.cuanto > PESO_DEL_ENCARGO) {
      // Sigue doliendo: se corre el reloj de la vuelta. Sin esta línea, una
      // necesidad que baja y sube volvería a la orden a los ocho ticks de la
      // PRIMERA vez que aflojó, aunque ahora esté peor.
      this.#pausadaEn = tick
      return
    }
    // EL QUE PAUSA ES EL QUE REANUDA. `#pausadaEn` sólo lo escribe la pausa
    // automática, así que en `undefined` quiere decir «esta pausa no es mía» —la
    // puso el cuidador— y no se levanta sola. Sin esta línea, «pará eso» duraría
    // ocho ticks.
    if (this.#pausadaEn === undefined) return
    if (tick - this.#pausadaEn < PERMANENCIA_EN_TICKS) return
    const t = e.reanudar(tick, 'se le pasó', 'ella')
    if (t === undefined) return
    this.#pausadaEn = undefined
    this.#canal.decir(tick, 'aviso', 'listo, sigo con lo que me pediste')
  }

  /**
   * ═══ C6 · LA COSTURA CON LA FRAGUA ════════════════════════════════════════
   *
   * Lo llama `escalera.ts` cuando `plan()` contesta `gap`, o sea cuando el
   * catálogo no alcanza. **Acá no se trabaja**: se apila y se vuelve, porque esto
   * corre adentro del tick.
   *
   * Medido antes de escribirlo: `MenteOptions.costura` tenía CERO llamadores en
   * producción, así que el gancho no podía dispararse ni una vez. Es el mismo
   * verde por omisión que el propio `PedidoALaFragua` denuncia en su comentario
   * —«la fragua no se despierta ni una vez» era cierto porque no había por dónde
   * despertarla— sólo que un piso más arriba.
   */
  #alaFragua = (p: PedidoALaFragua): void => {
    // EL MISMO HUECO NO SE PIDE DOS VECES. `gap` puede repetirse todos los ticks
    // mientras la meta siga sin plan, y sin este cerrojo un pedido se convertiría
    // en veinte viajes al modelo por la misma cosa.
    if (this.#yaPedidos.has(p.gap)) return
    this.#yaPedidos.add(p.gap)
    this.#paraLaFragua.push(p)
    this.#pedidos.push(p)
  }

  /**
   * TODOS LOS HUECOS QUE LA MENTE PIDIÓ FORJAR, y no los que faltan atender.
   *
   * Son dos listas y no una: la cola se vacía a medida que se atiende, así que
   * medir sobre ella diría «no pidió nada» justo después de haber pedido. Lo que
   * se quiere contar acá es cuántas veces el catálogo no alcanzó.
   */
  get pedidosALaFragua(): readonly PedidoALaFragua[] {
    return [...this.#pedidos]
  }

  /** El catálogo de esta partida: el de fábrica más lo que se haya promovido. */
  get catalogo(): PlannerCatalogView {
    return this.#catalogo
  }

  /**
   * EL PORTÓN DE LA MATERIA, y es el límite escrito del hito: «un gap de materia
   * o física queda `unsupported`».
   *
   * ─── CÓMO SE DECIDE, y por qué no se interpreta la firma ───────────────────
   *
   * La tentación es `interpretar(gap)` y mirar la estructura. No sirve: el hueco
   * que la mente pide de verdad es `emitsPower<410&emitsPower>=253` —una
   * conjunción— y `Predicado` tiene cuatro formas y ninguna es «y». Un portón que
   * se apoyara en eso diría que no a todo, que desde afuera se ve igual de bien
   * que decir que sí a todo.
   *
   * Lo que se mira son LAS PALABRAS: toda firma nombra cualidades, tags,
   * sustancias o palabras de su propia gramática, y las cuatro listas son
   * cerradas. Una palabra que no está en ninguna es materia o física que este
   * mundo no tiene, y forjar código contra eso sería pedirle al modelo que
   * invente una ley.
   *
   * ─── LO QUE ESTE PORTÓN NO PROMETE ─────────────────────────────────────────
   *
   * Que lo que pase sea forjable. Promete que lo que NO pasa es imposible, que es
   * la mitad que el hito pide: nada se crea por accidente.
   */
  sePuedeForjar(gap: string): boolean {
    const palabras = gap.match(PALABRAS_DE_FIRMA) ?? []
    if (palabras.length === 0) return false
    return palabras.every((p) => this.#sabeNombrar.has(p))
  }

  /**
   * ═══ EL EPISODIO DE LA FRAGUA, EN LA FRONTERA DEL TICK ════════════════════
   *
   * Tres pasos y ninguno cuesta un tick: se mira lo que volvió, se decide si el
   * hueco que sigue se puede pedir, y se pide sin esperar.
   */
  #atenderLaFragua(tick: number): void {
    this.#aplicarLoForjado(tick)

    const p = this.#paraLaFragua[0]
    if (p === undefined) return
    // UNO A LA VEZ. Sin esto, seis huecos pendientes son seis episodios en vuelo
    // y seis viajes al modelo pagados a la vez.
    if (this.#forjando > 0) return
    this.#paraLaFragua = this.#paraLaFragua.slice(1)

    if (!this.sePuedeForjar(p.gap)) {
      // `unsupported` y se dice. Y NO se toca nada: ni el catálogo, ni las
      // recetas, ni la física. Es el límite del hito escrito como una salida.
      this.#canal.decir(tick, 'aviso', `«${enCastellano(p.meta)}» me pide algo que este mundo no tiene`)
      return
    }

    const fragua = this.#fragua
    // Se dice SIEMPRE que la mente pidió, haya fragua enchufada o no: que el
    // catálogo no alcance es información del mundo y no del cableado.
    this.#canal.decir(tick, 'progreso', `no sé cómo «${enCastellano(p.meta)}» todavía`)
    if (fragua === undefined) {
      // ─── ACÁ ESTABA EL SILENCIO MÁS CARO DE LOS CUATRO ────────────────────
      //
      // La línea de arriba se dice igual «haya fragua enchufada o no» —y está
      // bien, es información del mundo—, pero era la ÚNICA, así que un catálogo
      // que no alcanza y un catálogo que no alcanza *y encima nadie puede
      // ampliarlo* se leían con las mismas seis palabras. La segunda mitad es la
      // que se puede arreglar, y era la que no se veía.
      //
      // El gap y no la meta: la meta ya la dijo la línea de arriba, y repetirla
      // acá gastaría el aviso en decir dos veces lo mismo. Lo que falta saber es
      // qué pieza puntual quedó sin forjar.
      this.#noLlegue(
        tick,
        { para: 'aprender', porque: 'sin-cable', sobre: enCastellano(p.gap) },
        `para «${enCastellano(p.meta)}» me falta ${enCastellano(p.gap)}, y no tengo a quién pedírselo`,
      )
      return
    }

    this.#forjando++
    void fragua(p).then(
      (f) => {
        this.#forjados.push(f)
      },
      () => {
        this.#forjados.push(undefined)
      },
    )
  }

  /**
   * LO QUE VOLVIÓ DE LA FRAGUA, con los DOS portones — y son dos porque son dos
   * preguntas distintas.
   *
   *   1. **¿el juez la promueve?** Es el del hito: nada se usa sin veredicto. Los
   *      otros tres grados no son «casi»: son que no, y se dicen;
   *   2. **¿trae con qué publicarse?** Es el techo del catálogo, medido y ajeno:
   *      una habilidad sin plano se puede volar y el planificador no la puede
   *      elegir. Promoverla y no poder publicarla es un resultado legítimo, y
   *      callarlo lo haría ver como un fracaso del juez.
   */
  #aplicarLoForjado(tick: number): void {
    if (this.#forjados.length === 0) return
    const forjados = this.#forjados
    this.#forjados = []
    for (const f of forjados) {
      this.#forjando--
      if (f === undefined) {
        // La frase es de antes que el registro, igual que la del proveedor.
        this.#canal.decir(tick, 'aviso', 'no me salió, sigo con lo que sé')
        this.#noLlegue(tick, { para: 'aprender', porque: 'se-cayo', sobre: 'lo que no sabía hacer' })
        continue
      }
      if (f.grado !== PROMUEVE) {
        this.#canal.decir(tick, 'aviso', `no me salió: ${f.porQue}`)
        continue
      }
      if (f.capacidad === undefined) {
        this.#canal.decir(tick, 'aviso', `me salió algo pero no la sé usar todavía: ${f.nombre}`)
        continue
      }
      // ─── LA PROMOCIÓN, y el overlay se re-arma desde el core ─────────────
      //
      // `conOverlay` acumula, así que apilarlo sobre el catálogo de ayer dejaría
      // la capacidad vieja publicada para siempre cuando una revisión reemplace a
      // otra. Es la misma línea que `Registro.instalar` explica en `@anima/forge`,
      // y se paga el mismo precio: guardar la lista aparte.
      this.#promovidas.push(f.capacidad)
      this.#catalogo = conOverlay(CATALOGO_CORE, this.#promovidas)
      this.#canal.decir(tick, 'progreso', `aprendí a ${f.nombre}`)
      // La mente se reconstruye para que el catálogo nuevo le llegue: `catalogo`
      // es de sólo lectura en `MenteOptions`, igual que `drive`.
      this.#nuevaMente(this.#driveDeAhora(tick))
    }
  }

  /** El drive que corresponde ahora, para no perderlo al reconstruir la mente. */
  #driveDeAhora(tick: number): Drive | undefined {
    const meta = this.#ultimaPuesta
    if (meta === undefined) return undefined
    const sobre = this.#encargo?.senaladoDelPendiente()
    return { meta, peso: PESO_DEL_ENCARGO, desdeTick: tick, ...(sobre === undefined ? {} : { sobre }) }
  }

  /**
   * SOLTAR EL OBJETIVO DEL CUIDADOR. Una mente nueva sin `drive`, y nada más.
   *
   * Lo que se pierde a propósito: la intención en vuelo. Es el punto seguro que
   * el documento pide y es el que este mundo tiene — `Mente` se reconstruye
   * entera en cada orden nueva desde el Hito 6, así que no se inventa una
   * operación, se usa la que ya estaba. La memoria —lo que aprendió— se pasa
   * entera: lo único que se reinicia es la escalera.
   */
  #soltarElDrive(): void {
    this.#ultimaPuesta = undefined
    this.#nuevaMente()
  }

  /**
   * ═══ LO QUE VOLVIÓ DE AFUERA, TAMBIÉN CON EL MUNDO EN PAUSA ════════════════
   *
   * ─── EL AGUJERO QUE ESTO TAPA, y lo encontró un e2e ────────────────────────
   *
   * La frontera vivía SÓLO adentro de `antesDelTick`, y `antesDelTick` sólo se
   * llama cuando el mundo avanza. O sea que con la partida pausada la respuesta
   * del proveedor se quedaba en `#llegadas` para siempre: la consulta salía, se
   * pagaba, volvía, y no la aplicaba nadie.
   *
   * Y no es un caso raro: **el juego arranca en pausa a propósito** —una pestaña
   * abierta avanza la partida real y este proyecto ya perdió una generación por
   * eso—. Así que el primer uso natural del chat era el que no funcionaba.
   *
   * ─── POR QUÉ NO ROMPE LA REGLA DE LA FRONTERA ─────────────────────────────
   *
   * Porque la frontera nunca fue «cuando el mundo avanza»: es «en un punto donde
   * nadie está a mitad de camino». Lo que prohíbe es aplicar en el medio de una
   * promesa resolviéndose, con la vista dibujándose o el tick corriendo. Entre
   * dos cuadros con el mundo quieto es el punto más seguro que hay.
   *
   * Es idempotente: las dos listas se vacían al aplicarse, así que llamarlo acá
   * y desde `antesDelTick` en el mismo cuadro no aplica nada dos veces.
   */
  loQueVolvioDeAfuera(tick: number): void {
    this.#aplicarLoQueLlego(tick)
    this.#aplicarLoForjado(tick)
  }

  /**
   * SE LLAMA ANTES DE CADA TICK, y el orden importa: si la meta de ahora ya está
   * cumplida, la criatura tiene que arrancar la siguiente EN ESTE tick y no en el
   * que viene. Con el orden al revés se pierde un tick por cláusula.
   */
  antesDelTick(tick: number): void {
    // LA FRONTERA, y va primero: lo que volvió del proveedor puede CAMBIAR el
    // encargo, así que aplicarlo después de mirarlo sería perseguir un tick la
    // meta vieja. Va acá y no en `despuesDelTick` por lo mismo que `vivir` hace
    // pensar antes del paso: la criatura actúa sobre el mundo que vio.
    this.#aplicarLoQueLlego(tick)
    // LA FRAGUA, en la misma frontera y por la misma razón. Va acá arriba y no
    // colgada del encargo: la mente pide forjar **también cuando vive sola** —
    // medido: sin ninguna orden, en 600 ticks pide igual, y pide lo mismo.
    this.#atenderLaFragua(tick)
    const e = this.#encargo
    if (e === undefined) return

    // EL SCHEDULER, y va acá por lo mismo que la frontera del proveedor: pausar
    // en el medio de un cuadro sería soltarle el objetivo a la criatura con la
    // vista a mitad de camino.
    this.#revisarLaPausa(e, tick)
    // Un encargo pausado NO SE MIRA: nadie le pregunta qué nodo va ahora, y por
    // eso tampoco lo puede dar por cumplido de casualidad. La pausa es una pausa
    // y no un rótulo — lo que la criatura haga mientras tanto es asunto suyo.
    if (e.pausado) return

    const quiere = e.ahora(this.#yaEstaCumplida, tick, this.#conQueSeCumple)
    if (quiere === undefined) {
      this.#canal.decir(tick, 'listo', 'listo')
      this.#encargo = undefined
      return
    }
    // ─── LA GUARDA ES SÓLO CONTRA `#ultimaPuesta`, Y ANTES ERAN DOS ────────
    //
    // Decía `if (quiere === metaEnCurso || quiere === ultimaPuesta) return`, y esa
    // primera mitad tenía un agujero que el spec de Playwright encontró: **si la
    // mente YA perseguía esa meta por su cuenta**, la función salía antes de
    // registrar la orden, `#ultimaPuesta` quedaba en `undefined` y el panel
    // mostraba «fuego (suya)» para siempre — aunque vos acabaras de pedir fuego.
    //
    // Pasa seguido, no es un borde raro: pedirle a la criatura algo que ya estaba
    // por hacer es lo más normal del mundo. Y era invisible desde adentro, porque
    // la mente hacía exactamente lo correcto: lo que estaba mal era quién se
    // llevaba el crédito.
    //
    // Ahora la meta se registra siempre y la guarda sólo evita reconstruir la
    // `Mente` en cada tick, que es para lo único que estaba.
    if (quiere === this.#ultimaPuesta) return

    this.#ultimaPuesta = quiere
    if (e.total > 1) {
      // `progreso` y no habla: explica algo verificable —cuál de las cláusulas
      // está en curso— y el documento pide que no se guarde como una frase del
      // personaje. Antes entraba con la misma marca que el acuse.
      this.#canal.decir(
        tick,
        'progreso',
        `voy por «${enCastellano(quiere)}» (${String(e.hechas + 1)} de ${String(e.total)})`,
      )
    }
    // Una `Mente` nueva y no un setter: `drive` es de sólo lectura en
    // `MenteOptions`, y la memoria —lo que aprendió— se pasa entera, así que lo
    // único que se reinicia es la escalera. Es lo que hace el demo del Hito 6.
    // Y CUÁL, si el cuidador lo señaló. Es el último eslabón de la corrección:
    // la referencia sale de «no ése, el otro», se anota en el nodo del encargo, y
    // acá cruza a la mente. Sin esta línea el `sobre` se guardaba y no lo leía
    // nadie — que es donde estaba cortado el camino.
    const sobre = e.senaladoDelPendiente()
    this.#nuevaMente({
      meta: quiere,
      peso: PESO_DEL_ENCARGO,
      desdeTick: tick,
      ...(sobre === undefined ? {} : { sobre }),
    })
  }

  /**
   * LA ÚNICA FÁBRICA DE MENTES DE ESTE ARCHIVO, y por eso existe.
   *
   * Había tres `new Mente(...)` sueltos —el del arranque, el de soltar el drive y
   * el de tomar una meta— y cada opción nueva había que acordarse de ponerla en
   * los tres. La costura con la fragua es la primera que se olvidaría: una mente
   * construida sin ella no falla, sólo deja de pedir, y eso no se ve.
   */
  #nuevaMente(drive?: Drive): Mente {
    const m = new Mente({
      actor: this.#quien,
      memoria: this.#memoria,
      // LA COSTURA CON LA FRAGUA. `escalera.ts` la llama cuando `plan()` contesta
      // `gap` —o sea cuando el catálogo no alcanza— y hasta el C6 no se la pasaba
      // nadie, así que el gancho no podía dispararse ni una vez. Ver `#alaFragua`.
      costura: this.#alaFragua,
      // Y EL CATÁLOGO DE ESTA PARTIDA, que es el de fábrica más lo promovido. Sin
      // esta línea, una habilidad forjada, juzgada y publicada seguiría sin
      // existir para la mente: el default de `MenteOptions` es `CATALOGO_CORE`.
      catalogo: this.#catalogo,
      ...(drive === undefined ? {} : { drive }),
    })
    this.#mente = m
    this.#mentes.set(this.#quien, m)
    return m
  }
}
