// ─── @anima/world/step.ts ────────────────────────────────────────────────────
//
// El paso del mundo. Es el corazón del determinismo y por eso es el archivo con
// más comentarios por línea de todo el paquete: acá cualquier orden que dependa
// de un `Object.keys`, de la estabilidad de un `sort` o de un `Map` armado en
// otro orden se convierte, cuatrocientos ticks después, en dos mundos gemelos con
// distinto hash y en un juez que no sirve.
//
// El tick tiene DOS mitades y el orden entre ellas es contrato:
//
//   1. las INTENCIONES, en orden total por id de actor. Lo que la criatura
//      quiere. Cada una se juzga contra el mundo tal como está.
//   2. los SISTEMAS, en orden fijo. Lo que el mundo hace pase lo que pase: las
//      doce leyes de `@anima/physics` sobre cada cuerpo, y el metabolismo.
//
// Primero las intenciones y después las leyes, y no al revés: si las leyes
// corrieran primero, la criatura actuaría sobre un mundo que ya se movió y que
// ella no vio —su percepción se congela al principio del tick— y «saqué el
// pescado del fuego a tiempo» dependería de un tick de suerte.
//
// ─── Sobre la firma ─────────────────────────────────────────────────────────
//
// El documento de arquitectura escribe `stepWorld(state, intents): SimEvent[]`.
// Acá devuelve `{ state, events }`, y la diferencia es a propósito: `WorldState`
// es inmutable, así que devolver SOLO los eventos obligaría a que alguien
// reconstruya el estado aplicándolos, o sea a escribir una SEGUNDA implementación
// de la misma transición. Dos implementaciones de la misma cuenta divergen —el
// paquete de física ya se comió esa lección con `capacidadTermica`— y acá
// divergir significa que el journal y el mundo dejan de contar lo mismo, que es
// justo lo que el journal existe para garantizar. Los eventos son la NARRACIÓN
// del tick, no su definición.

import type {
  Body,
  Commitment,
  Part,
  Physics,
  Process,
  ProcessId,
  QualityId,
  QualityVector,
  Role,
  Substance,
  Yield,
} from '@anima/physics'
import {
  baseRoleName,
  clampToRange,
  conSustancia,
  cumpleRol,
  dtDeFrecuencia,
  isOptionalRole,
  paso,
  porPaso,
  qualityOf,
  seg,
  sumarPaso,
  T_AMBIENTE,
  unfx,
  unir,
} from '@anima/physics'
import type { Celda, Dt, Duracion, Empuje, Entorno, Fuente, Montaje } from '@anima/physics'
// EL DIOS ENTRA A LA PARTIDA. Es la única importación de `@anima/oracle` del
// paso, y va por `dios.ts` —la costura— y no directo: acá adentro no se decreta
// nada ni se traduce nada, sólo se consulta y se cobra. Ver el encabezado de
// `dios.ts` por qué la flecha va del mundo al dios y no al revés.
import type { DadoDelMundo, LibroCalorico, Stock } from '@anima/oracle'
import { draw, population } from '@anima/oracle'
import type { EstadoDelDios } from './dios.js'
import {
  celdaDecretada,
  cuerpoDePozo,
  dadoDe,
  decretoDe,
  entornoDecretado,
  idDePozo,
  libroDe,
  ordenarPozos,
} from './dios.js'
import { segundosDe } from './reloj.js'
import type { ActorId, BodyId, Intent, IntentKind, Placement, RoleBinding } from './intent.js'
import {
  chebyshev,
  compararTexto,
  enRango,
  ordenarIntenciones,
  revisarCompromiso,
} from './intent.js'
// La clave de celda es la de `cell.ts`, que es la única del paquete: las claves
// que este archivo pone en `WorldState.cells` son las MISMAS que indexan el
// terreno de la grilla, así que `cellFromKey` funciona sobre las dos y un mundo
// no puede terminar con dos numeraciones de sus propias celdas.
import type { CellKey } from './cell.js'
import { chunkCoord, chunkKey, keyOfCell } from './cell.js'

// ─── El estado ───────────────────────────────────────────────────────────────

/**
 * Las tres cualidades de celda que se GUARDAN (`quality.ts`, `CELL_QUALITIES`).
 * `sheltered` no está porque es derivada: sale de la oclusión de lo que haya
 * puesto encima y se calcula al leerla, que es toda la decisión del ADR II-0002.
 */
export interface CellState {
  readonly wet: number
  readonly oxygen: number
  readonly temperature: number
}

/**
 * Lo que hay en una celda de la que nadie dijo nada. Es el aire libre: seco, con
 * todo el oxígeno, a temperatura ambiente. Coincide con `CELDA_AL_AIRE` de la
 * física, y coincidir importa: si el mundo tuviera otro «por omisión», las doce
 * leyes se calibrarían contra un ambiente y correrían contra otro.
 */
export const CELDA_POR_OMISION: CellState = { wet: 0, oxygen: 1, temperature: T_AMBIENTE }

/**
 * Un cuerpo EN el mundo: el cuerpo de la física más sus relaciones espaciales.
 *
 * Las relaciones viven acá y no adentro de `Body` porque son del mundo y no de la
 * materia: la misma vara, con las mismas partes y las mismas cualidades, apoyada
 * en el piso o sostenida sobre las brasas es el mismo cuerpo en dos situaciones.
 * Meterlas en `Body` obligaría a `@anima/physics` a saber que existe un mapa.
 */
export interface WorldBody {
  readonly body: Body
  readonly at: Placement
  /** En la mano de quién. Un cuerpo en la mano se mueve con su actor. */
  readonly heldBy?: ActorId
  /** Ley 8: sobre qué se apoya. La parrilla vive acá. */
  readonly supportedBy?: BodyId
  /** Ley 12 (ADR II-0002): a qué está TAPANDO. Es lo que hace el carbón. */
  readonly covering?: BodyId
}

/** Un proceso en curso. Es una de las dos cosas que un actor arrastra de un tick al otro. */
export interface Activity {
  readonly process: ProcessId
  readonly roles: readonly RoleBinding[]
  /**
   * Cuántos SEGUNDOS DE MUNDO lleva, no cuántos ticks (ADR II-0008).
   * `completion.at` dice cuántos hacen falta, y también está en segundos: atar
   * tarda un segundo a 20 Hz y a 100 Hz, y lo único que cambia es en cuántas
   * muestras se parte.
   *
   * Se acumula con `sumarPaso` y no con `+= dt`, porque veinte veces 0,05 da
   * 0,9999999999999999 y atar pasaría a tardar un tick de más, siempre, sin que
   * ningún test dijera por qué.
   */
  readonly segundos: Duracion
}

/**
 * Una espera en curso. La OTRA cosa que un actor arrastra de un tick al otro.
 *
 * ─── Por qué un campo aparte y no un caso de `Activity` ─────────────────────
 *
 * Las dos acumulan segundos con `sumarPaso` y ahí se termina el parecido. Son
 * tres diferencias y ninguna es de estilo:
 *
 *   1. **`Activity.process` es un `ProcessId` del catálogo.** `intencionAplicar`
 *      lo busca ahí y `cumpleRol` juzga contra los roles que declara. Meter la
 *      espera en ese campo obligaría a inventar un proceso `wait` que nadie
 *      escribió, y a que el día que el modelo escriba uno con ese id el mundo
 *      confunda una cosa con la otra.
 *   2. **Duran al revés.** Una actividad se pierde en cuanto el actor no la
 *      sostiene —`stepWorld` se la saca a todo el que no actuó, porque frotar es
 *      frotar todos los ticks— y una espera es exactamente lo contrario: el que
 *      espera NO emite nada, y si perderla dependiera de no emitir, esperar sería
 *      imposible. Un solo campo con dos reglas de vida es un campo mintiendo.
 *   3. **Continúan al revés.** Una actividad sigue si se repite igual (mismo
 *      proceso, mismos cuerpos); una espera sigue sola y se corta cuando el actor
 *      hace otra cosa.
 *
 * ─── Y por qué es opcional ──────────────────────────────────────────────────
 *
 * Va en `Actor`, o sea que entra en `hashWorldState` y en la ranura `actor:<id>`
 * del snapshot. Es dato plano y finito —tres números y nada más, ninguna función
 * ni clase, que es lo que `hashWorld` LANZA— y es OPCIONAL: `hashWorld` saltea las
 * claves ausentes, así que el hash de un mundo donde nadie espera no se mueve ni
 * un bit. El que sí se mueve es el de un mundo con alguien esperando, y eso es
 * correcto: dos mundos idénticos salvo que en uno hay una criatura a mitad de una
 * espera de treinta segundos NO son el mismo mundo.
 */
export interface Espera {
  /**
   * Cuántos SEGUNDOS DE MUNDO pidió esperar. Es el `segundos` de la intención
   * `wait`, y como toda duración va en segundos y no en ticks (ADR II-0008):
   * `wait(2)` son dos segundos a 20 Hz y a 100 Hz.
   */
  readonly pedido: Duracion
  /** Cuántos lleva. Se acumula con `sumarPaso`, por lo mismo que `Activity`. */
  readonly segundos: Duracion
  /**
   * El `seq` de la intención que la abrió.
   *
   * Es lo que hace que la espera se pueda correlacionar: la intención se emite
   * UNA vez y la respuesta llega ticks después, cuando ya no hay ninguna intención
   * en la mesa de la cual sacar el número. Sin esto, el evento que dice «tu espera
   * terminó» no tendría a quién decírselo.
   */
  readonly seq: number
}

export interface Actor {
  readonly id: ActorId
  /** La criatura ES un cuerpo: `SelfView extends BodyView`. Su posición es la de él. */
  readonly body: BodyId
  readonly holding: readonly BodyId[]
  /** Cuántas cosas le entran en las manos. Lo fija el cuidador, no la habilidad. */
  readonly capacity: number
  /**
   * Hasta dónde le está permitido comprometer al mundo. Una candidata que solo
   * pasó el smoke test entra con `reversible` y no puede quemar la casa que la
   * criatura construyó en la vida anterior.
   */
  readonly permits: Commitment
  readonly doing?: Activity
  /** La espera en curso, si está esperando. Ver `Espera` y `avanzarEsperas`. */
  readonly esperando?: Espera
}

/**
 * El mundo entero como dato.
 *
 * `bodies` y `actors` son `Map`, y el orden de iteración de un `Map` de JS es el
 * de inserción: **los dos se mantienen SIEMPRE ordenados por id**, y hay un
 * invariante que lo verifica. Es la única forma de tener a la vez búsqueda O(1)
 * —el mundo mira un cuerpo por id muchas veces por tick— y un recorrido canónico
 * que no dependa de en qué orden se fueron creando las cosas. Ordenar 5000 ids en
 * cada tick costaría alrededor de un milisegundo del presupuesto de cuatro; con
 * el mapa ya ordenado, el recorrido es gratis y solo se paga al crear o destruir.
 */
export interface WorldState {
  readonly tick: number
  /**
   * La FRECUENCIA del mundo, en Hz. Gobierna el RENDIMIENTO —cuánto tiempo de CPU
   * hay por paso— y nada más: el ritmo lo gobiernan las tasas de las leyes, que
   * son por segundo (ADR II-0007 y II-0008).
   *
   * Está en el estado y no en un parámetro de `stepWorld` porque es parte de la
   * IDENTIDAD de la partida: dos mundos con la misma semilla y distinta
   * frecuencia muestrean la misma física con distinta finura y no producen la
   * misma traza. Eso es correcto y esperado, y por eso la frecuencia va en el
   * journal y cargar un guardado con otra es un error explícito.
   *
   * Solo son admisibles las que dan un `dt = 1/Hz` exacto en la escala de las
   * tasas: ver `esFrecuenciaAdmisible`. `crearMundo` las rechaza.
   */
  readonly hz: number
  readonly phys: Physics
  readonly bodies: ReadonlyMap<BodyId, WorldBody>
  readonly actors: ReadonlyMap<ActorId, Actor>
  /**
   * Lo que el mundo ESCRIBIÓ sobre el terreno. No es el terreno entero: lo que
   * no está acá lo contesta el decreto del dios (`celdaDecretada`), y si no hay
   * dios, `CELDA_POR_OMISION`.
   *
   * Que sea un delta y no una copia es lo que hace que **pisar un chunk no cambie
   * el mundo**: el río está donde el dios dice sin que nadie lo escriba, así que
   * dos partidas gemelas exploradas en distinto orden tienen las mismas celdas.
   * Ver el punto 3 del encabezado de `dios.ts`.
   */
  readonly cells: ReadonlyMap<CellKey, CellState>
  /** El contador de ids. No hay azar en el mundo: los nombres también se cuentan. */
  readonly nextId: number
  /**
   * EL DIOS DE ESTA PARTIDA: la semilla, el dado del mundo, los pozos que ya se
   * tocaron y el diario del libro calórico.
   *
   * **Opcional**, y no por comodidad de los tests: un mundo sin dios es un mundo
   * sin terreno decretado y sin pozos, y eso es una configuración legítima —el
   * banco de rendimiento, un test de una ley, el mundito de las habilidades— que
   * no tiene por qué pagar el costo de decretar chunks. Lo que NO pasa es que un
   * mundo sin dios pueda sacar comida gratis: sin stock, `drawFromStock` rechaza
   * con `sin-pozo`. La ausencia se nota, no se disimula.
   *
   * Entra al hash y al snapshot (ver `mundo.ts`), y tiene que entrar: dos mundos
   * gemelos que tiraron el dado distinta cantidad de veces no son el mismo mundo.
   */
  readonly dios?: EstadoDelDios
}

// ─── Los eventos ─────────────────────────────────────────────────────────────

export type Motivo =
  | 'actor-desconocido'
  | 'proceso-desconocido'
  | 'compromiso-mal-declarado'
  | 'sin-permiso'
  | 'orden-duplicado'
  | 'ya-actuo'
  | 'cuerpo-desconocido'
  | 'fuera-de-rango'
  | 'no-esta-a-mano'
  | 'no-lo-tiene'
  | 'no-portable'
  | 'manos-llenas'
  | 'celda-ocupada'
  | 'sin-fuerza'
  | 'rol-sin-cuerpo'
  | 'rol-no-cumple'
  | 'arreglo-incorrecto'
  | 'compuerta-cerrada'
  | 'nada-que-comer'
  | 'no-implementado'
  // ─── Los cuatro finales de una extracción que no dio nada ──────────────────
  //
  // Son cuatro y no un «no salió» porque las cuatro piden decisiones OPUESTAS, y
  // ésa es la misma razón por la que `RazonDeExtraccion` tiene cuatro valores en
  // el oráculo: «este cuerpo no es un pozo» se arregla apuntando a otro lado,
  // «no picó» se arregla insistiendo, «el pozo está vacío» se arregla caminando,
  // y «el lugar ya dio todo» no se arregla nunca más y hay que mudarse. Una
  // criatura que no las pueda distinguir insiste para siempre en un río muerto.
  /** No hay stock detrás de ese cuerpo: no es un pozo, o el mundo no tiene dios. */
  | 'sin-pozo'
  /** Se tiró el dado del mundo y esta vez no picó. */
  | 'no-pico'
  /** El pozo está agotado. Se repone: volver más tarde tiene sentido. */
  | 'pozo-vacio'
  /** El chunk llegó a su techo calórico. No se repone jamás: hay que mudarse. */
  | 'sin-presupuesto'

/**
 * La FIRMA de una respuesta: a qué intención le está contestando.
 *
 * `by` estuvo siempre; `seq` es lo que faltaba, y sin él la correlación entre lo
 * que se pidió y lo que pasó era un ACCIDENTE: funcionaba sólo porque cada actor
 * despacha una sola intención por tick (`yaActuo`), o sea que alcanzaba con mirar
 * `by`. El día que eso cambie —o hoy mismo, con los rechazos que nacen adentro de
 * `rendir` mientras el mismo `apply` sale «completo»— mirar `by` deja de alcanzar.
 *
 * Sumarlo salió gratis: `hashWorldState` hashea `tick, hz, nextId, hashPhysics,
 * bodies, actors, cells` y **los eventos no entran al hash**. Agregarle campos a
 * un `SimEvent` no mueve la identidad de ninguna partida.
 */
export interface Firma {
  readonly by: ActorId
  readonly seq: number
}

/**
 * Los eventos que CONTESTAN una intención. Todos llevan firma.
 *
 * Se declaran sin ella y `SimEvent` se la agrega de una sola vez, porque quien los
 * empuja —cada `intencionX`, `rendir`, `avanzarEsperas`— no siempre tiene la
 * intención a mano, y la firma la pone el bucle (ver `firmar`). Escribirla doce
 * veces a mano sería doce lugares donde olvidarse.
 */
export type Respuesta =
  | { readonly k: 'rechazada'; readonly que: IntentKind; readonly por: Motivo }
  | { readonly k: 'movio'; readonly de: Placement; readonly a: Placement }
  | { readonly k: 'tomo'; readonly what: BodyId }
  | { readonly k: 'solto'; readonly what: BodyId; readonly at: Placement }
  | { readonly k: 'puso'; readonly what: BodyId; readonly at: Placement }
  | { readonly k: 'comio'; readonly what: BodyId; readonly calorias: number }
  /**
   * Una cuenta conservada que se convirtió en otra. Es el ÚNICO permiso para que
   * un total conservado suba, y por eso es un evento y no un detalle interno: el
   * invariante de conservación lo lee y verifica que lo acreditado nunca supere
   * lo gastado. Sin este evento, comer sería indistinguible de inventar energía.
   */
  | {
      readonly k: 'convierte'
      readonly de: QualityId
      readonly a: QualityId
      readonly gastado: number
      readonly acreditado: number
    }
  | { readonly k: 'proceso'; readonly process: ProcessId; readonly segundos: Duracion; readonly completo: boolean }
  /**
   * Un cuerpo nuevo. Es el ÚNICO de los tres eventos de materia que lleva firma, y
   * la asimetría no es un descuido:
   *
   *   - `nacio` es la única forma que tiene quien pidió el proceso de enterarse de
   *     QUÉ consiguió — nada más nombra el cuerpo nuevo, y `StepResult.got` de
   *     `@anima/skills` es justamente esa lista;
   *   - `murio` ya tiene quien lo cuente: el que come recibe un `comio` con el
   *     `what`, así que el `murio` no le agrega información y puede ser lo que es,
   *     un hecho del mundo (y el de hambre no tiene ninguna intención detrás);
   *   - `sustancia` no nace de ninguna intención: la da de alta la ley 4.
   *
   * O sea que la regla es «lleva firma lo que le contesta a alguien», y no «lleva
   * firma lo que pasó mientras alguien actuaba».
   */
  | { readonly k: 'nacio'; readonly id: BodyId; readonly por: 'rendimiento' }
  /**
   * El turno pasó sin novedad, y ESO ES LA RESPUESTA. Lo emiten el `goTo` de quien
   * ya estaba donde quería, el `explore` sin presupuesto, y —desde que esperar
   * dura— el último tick de una espera: `espero` en pasado quiere decir terminada.
   */
  | { readonly k: 'espero' }
  /**
   * Todavía no. Lo emite `avanzarEsperas` en cada tick de una espera abierta; el
   * tick que la cierra emite `espero`.
   *
   * `segundos` es cuántos LLEVA esperados, no cuántos faltan, y es exactamente el
   * mismo campo que `proceso`: los dos son un avance acumulado con `sumarPaso`,
   * los dos son múltiplos exactos de 10⁻⁶ y ninguno de los dos se calcula
   * restando. Cuánto falta lo sabe quien preguntó, que tiene la intención con el
   * pedido; el mundo no le va a devolver una resta con ruido de punto flotante
   * —`2 − 1,95` da 0,050000000000000044— para ahorrarle una cuenta.
   *
   * Es un evento por tick y por actor que espera, y eso es a propósito: la
   * ALTERNATIVA —callar hasta el final— hace que el silencio signifique dos cosas
   * distintas, «seguí esperando» y «tu espera ya no existe», y la segunda pasa de
   * verdad (el que se muere de hambre a mitad de una espera se lleva la espera
   * puesta). Un runtime que tiene que adivinar cuál de las dos es no es un runtime.
   */
  | { readonly k: 'esperando'; readonly segundos: Duracion }

/**
 * Lo que el mundo NARRA por su cuenta. Nadie lo pidió, así que no lleva firma:
 * ponerle una obligaría a inventar un culpable, y un culpable inventado es peor
 * que ninguno.
 */
export type Narracion =
  /**
   * Un cuerpo que dejó de existir, o un actor que dejó de ser uno.
   *
   * `'hambre'` es el de la criatura que se quedó sin `stamina` (ADR II-0009), y
   * es el único que NO lleva `by`: no lo causa ninguna intención, lo causa el
   * paso del tiempo. Su `id` es el del CUERPO, que sigue en el mundo tirado en su
   * celda: lo que se fue es el actor, no la materia.
   *
   * Sumarlo salió gratis porque `hashWorldState` hashea `tick, hz, nextId,
   * hashPhysics, bodies, actors, cells` y los eventos no entran.
   *
   * `'quemado'` es el de la criatura a la que la ley 4 le transmutó el cuerpo: se
   * quemó del todo y lo que queda es residuo. Hasta que existió, esa criatura
   * moría igual pero el mundo contaba que había sido `'hambre'` —le habían borrado
   * la `stamina` al cambiarle la materia— y la crónica mentía sobre la única cosa
   * que un jugador iba a querer saber. Ver `morir` y `loQueSobrevive` en
   * `@anima/physics`.
   *
   * `'consumido'` sigue declarado y sin emisor —lo estaba antes de esto—, y queda
   * anotado para que la unión no se llene de valores que nadie manda.
   */
  | {
      readonly k: 'murio'
      readonly id: BodyId
      readonly por: 'comido' | 'consumido' | 'hambre' | 'quemado'
    }
  | { readonly k: 'sustancia'; readonly id: string }
  /**
   * LO QUE EL MUNDO GASTÓ de una cuenta conservada en este tick, sumado.
   *
   * ─── Para qué existe: el guardián sólo perseguía los aumentos ──────────────
   *
   * `revisarConservacion` sabía decir que ninguna cuenta conservada SUBE. No sabía
   * decir nada de las bajadas, así que una conservada que se evaporaba entera
   * pasaba sin una sola violación — y pasó: la ley 4 borraba la `stamina` de la
   * criatura al transmutarle el cuerpo, 949,70 → 0,00 en un tick, con cero
   * violaciones y un evento que decía «murió de hambre».
   *
   * Perseguir las bajadas necesita distinguir la que una ley explica de la que
   * nadie explica, y para `mass`, `nutrition` y `fuelEnergy` eso hoy no se puede:
   * la ley 5 evapora agua, la 3 quema combustible y la 4 tira el 94% de la masa,
   * todas legítimamente y ninguna declarando cuánto. Para `stamina` SÍ, y por una
   * razón que no es de conveniencia: **ninguna de las doce leyes de la física
   * escribe `stamina`.** Lo único que la mueve es el mundo —vivir, caminar, y lo
   * que un `poweredBy` paga— y el mundo sabe exactamente cuánto movió.
   *
   * ─── Uno por tick y por cuenta, no uno por cobro ───────────────────────────
   *
   * Se acumula en el borrador y sale sumado al final. Un evento por cobro serían
   * uno por actor y por tick sólo de metabolismo, para decir un número que
   * únicamente el invariante mira; la crónica no tiene por qué llenarse de eso.
   */
  | { readonly k: 'gasto'; readonly q: QualityId; readonly cuanto: number }

/**
 * LA NARRACIÓN DEL TICK. Lo que salió a la salida de `stepWorld`, ya firmado.
 *
 * La distinción entre las dos mitades es lo único nuevo: todo lo que contesta una
 * intención lleva `by` y `seq`, y quien quiera saber qué pasó con la suya no tiene
 * que adivinarlo — se lo dice `desenlaceDe`.
 */
export type SimEvent = (Respuesta & Firma) | Narracion

/**
 * Lo mismo, ANTES de que el bucle firme. Es lo que los despachos empujan.
 *
 * `seq` es opcional acá y sólo acá: `rechazo` sí lo tiene a mano —recibe la
 * intención entera— y por eso lo escribe, y `avanzarEsperas` lo saca de la
 * `Espera`; los demás no lo conocen y se lo pone `firmar`. Que el tipo público
 * NO lo tenga opcional es la mitad del punto: a la salida de `stepWorld` ya no hay
 * evento de respuesta sin firmar, y eso el compilador lo sabe.
 */
export type SimEventSinFirmar =
  | (Respuesta & { readonly by: ActorId; readonly seq?: number })
  | Narracion

export interface StepOutcome {
  readonly state: WorldState
  readonly events: readonly SimEvent[]
}

// ─── La correlación: qué le pasó a MI intención ──────────────────────────────

/**
 * Qué le pasó a una intención, según los eventos de un tick.
 *
 * **Es una forma del MUNDO y no el `StepResult` de `@anima/skills`**, y no por
 * prolijidad: `@anima/skills` depende de `@anima/world` y no al revés, así que el
 * mundo no puede importar ese tipo ni aunque quisiera. Pero además no debería: los
 * seis estados de `StepResult` —`arrived`, `found`, `done`, `blocked`, `rejected`,
 * `timeout`— son categorías de la MENTE, que sabe qué estaba buscando y cuánto
 * presupuesto le quedaba. El mundo sabe tres cosas y ninguna más: si lo que pidió
 * pasó, si se lo rechazó, o si todavía está pasando. **El traductor de `Desenlace`
 * a `StepResult` es del tramo de runtime**, y va a necesitar la memoria de la
 * habilidad para escribir los otros tres.
 */
export interface Desenlace {
  /**
   * - `logrado` — pasó algo y nada fue rechazado;
   * - `rechazado` — el mundo dijo que no. `por` dice por qué;
   * - `en-curso` — sigue pasando: una espera abierta o un proceso incompleto. La
   *   mente que espera un `yield` tiene que volver a preguntar el tick que viene;
   * - `sin-respuesta` — el mundo no dijo NADA sobre esta intención. Con
   *   `stepWorld` no puede pasar —hasta una intención de un actor inventado sale
   *   rechazada— así que si aparece, o la intención no era de este tick o alguien
   *   perdió eventos por el camino. Vale la pena poder nombrarlo.
   */
  readonly k: 'logrado' | 'rechazado' | 'en-curso' | 'sin-respuesta'
  /** Todo lo que esta intención causó, en el orden en que el mundo lo narró. */
  readonly events: readonly SimEvent[]
  /** El motivo del PRIMER rechazo. Sólo cuando `k === 'rechazado'`. */
  readonly por?: Motivo
  /** Los cuerpos que nacieron por esta intención. Es lo que `StepResult.got` quiere. */
  readonly nacidos: readonly BodyId[]
}

/**
 * ¿Este evento le contesta a alguien?
 *
 * Se pregunta por los TRES que no, y no por los diez que sí: la lista corta es la
 * que no se olvida de crecer. Un evento nuevo nace firmado salvo que quien lo
 * escriba diga lo contrario acá, que es el default correcto — el otro default
 * deja eventos sin dueño a la espera de que alguien note que faltan.
 *
 * `gasto` es de la `Narracion` por el mismo motivo que los otros dos: sale sumado
 * al final del tick y cuenta lo que el mundo se llevó de todos, no lo que le pasó
 * a la intención de alguno. Ponerle firma obligaría a repartir un total entre los
 * actores que lo causaron, que es una cuenta que nadie pidió.
 */
export function esRespuesta(e: SimEvent): e is Respuesta & Firma {
  return e.k !== 'murio' && e.k !== 'sustancia' && e.k !== 'gasto'
}

/**
 * QUÉ LE PASÓ A ESTA INTENCIÓN. La función que el runtime va a llamar una vez por
 * `yield`.
 *
 * La clave es el par `(by, seq)` y no `by` solo, que es lo que se venía usando de
 * hecho. El segundo argumento es un `{ by, seq }` y no un `Intent` a propósito:
 * una `Intent` lo satisface estructuralmente, y el runtime que preguntó ticks
 * después por una espera abierta ya no tiene la intención entera — tiene el par.
 *
 * ─── Qué gana el par sobre `by` solo, con nombres ───────────────────────────
 *
 *   - un `apply` que COMPLETA y cuyo rendimiento no encuentra dónde poner la
 *     hebra saca dos eventos: `proceso` completo y `rechazada` por
 *     `celda-ocupada`. Con `by` solo, los dos son «de ana» y el segundo se lee
 *     como si contestara otra cosa; el rechazo tenía además un `seq: -1` que no
 *     era de nadie;
 *   - la segunda intención de un actor en el mismo tick sale `ya-actuo`, y con
 *     `by` solo no hay forma de decir cuál de las dos se despachó;
 *   - una espera contesta ticks DESPUÉS de que se la pidió, cuando ya no hay
 *     ninguna intención en la mesa.
 *
 * El orden de las tres preguntas importa y es éste: **un rechazo gana sobre todo
 * lo demás**. `apply` puede completar el proceso y no rendir nada, y quien
 * preguntó tiene que enterarse de lo que NO consiguió, no de lo que sí.
 */
export function desenlaceDe(
  events: readonly SimEvent[],
  de: { readonly by: ActorId; readonly seq: number },
): Desenlace {
  const mios: SimEvent[] = []
  const nacidos: BodyId[] = []
  let por: Motivo | undefined
  let enCurso = false
  for (const e of events) {
    if (!esRespuesta(e) || e.by !== de.by || e.seq !== de.seq) continue
    mios.push(e)
    if (e.k === 'nacio') nacidos.push(e.id)
    if (e.k === 'rechazada' && por === undefined) por = e.por
    if (e.k === 'esperando') enCurso = true
    if (e.k === 'proceso' && !e.completo) enCurso = true
  }
  if (mios.length === 0) return { k: 'sin-respuesta', events: [], nacidos: [] }
  if (por !== undefined) return { k: 'rechazado', events: mios, por, nacidos }
  return { k: enCurso ? 'en-curso' : 'logrado', events: mios, nacidos }
}

// ─── Calibración, con nombre y con porqué ────────────────────────────────────

/**
 * Cuánta `stamina` cuesta entrar en UNA CELDA. Es la razón por la que caminar
 * hasta el río tiene precio y por la que explorar sin comer termina mal.
 *
 * **NO es una tasa, y por eso no pasa por `porPaso`** (ADR II-0009). Sus unidades
 * son stamina POR CELDA, no stamina por segundo, y ya son independientes de la
 * frecuencia: está medido que diez celdas cuestan exactamente
 * `10 × (COSTO_POR_CELDA + COSTO_VIVIR_POR_SEGUNDO/hz)` a las cinco frecuencias
 * admisibles. Dividirla por la frecuencia haría que el mismo viaje de diez celdas
 * saliera 5× más barato a 100 Hz que a 20, que es el mismo bug al revés.
 *
 * Lo que sí se mide en muestras es la VELOCIDAD —`intencionCaminar` avanza una
 * celda por tick, así que la criatura camina a 20 celdas por segundo a 20 Hz y a
 * 100 a 100 Hz—, y eso es locomoción y no metabolismo: cerrarlo pide una
 * velocidad en celdas por segundo con un resto sub-celda acumulado en `Actor`, o
 * sea un campo nuevo y un hash nuevo. Merece su propio ADR. El hueco está abierto
 * y medido en `tests/el-tiempo-no-depende-del-tick.test.ts` (hueco 2).
 */
export const COSTO_POR_CELDA = 0.05

/**
 * Lo que cuesta estar vivo UN SEGUNDO DE MUNDO, hambre incluida. El motor de la
 * historia, y desde el ADR II-0009 una tasa POR SEGUNDO como todas las demás:
 * `sistemaMetabolismo` la aplica con `porPaso(…, d.dt)`, que es la única
 * conversión entre el ritmo del mundo y el muestreo del tick.
 *
 * ─── Por qué 1,0 y no otro ──────────────────────────────────────────────────
 *
 * Es 5× lo que se cobraba antes (0,01 por tick × 20 Hz = 0,20 por segundo), y el
 * número cae adentro de una ventana MEDIDA sobre cien partidas en
 * `oracle/tests/presupuesto.test.ts`:
 *
 *   0,766 por segundo ... lo que rinde comiendo CRUDO la partida que más comió
 *   1,000 ............... esto
 *   1,155 por segundo ... lo que rinde COCINANDO la partida que menos comió
 *
 * Adentro de esa ventana —y sólo adentro— pasan las dos cosas a la vez en las cien
 * partidas: comer crudo da neto negativo y cocinar da neto positivo. O sea que la
 * diferencia entre vivir y morirse es COCINAR, y nadie lo escribió: sale de que
 * `digestibility` sube de 0,38 a 0,95. La ventana mide 1,51× de ancho, así que el
 * número no tiene lugar para pasearse — si alguien recalibra `digestibility`, la
 * masa de una pieza o el pozo, hay que volver a medirla.
 *
 * Con esto **`stamina` se mide en segundos de vida**: mil de `stamina` son mil
 * segundos de mundo, un pescado crudo de 2 kg compra 6 y el mismo pescado
 * cocinado compra 15. Y a la frecuencia de referencia caminar cuesta lo mismo que
 * vivir —20 celdas por segundo × 0,05 = 1,0 por segundo— sin que ninguna de las
 * dos constantes se haya elegido mirando a la otra.
 */
export const COSTO_VIVIR_POR_SEGUNDO = 1.0

/**
 * La oclusión de un cuerpo que TAPA, en función de su permeabilidad, y lo que la
 * oclusión total le corta al oxígeno de la celda.
 *
 * El 0.8 NO es un número elegido: sale de que la física ya publica
 * `CELDA_TAPADA.oxygen === 0.2` como la celda tapada de referencia. Una celda al
 * aire tiene oxígeno 1; tapada del todo con algo impermeable tiene que dar 0.2,
 * o sea `1 × (1 − 1 × 0.8)`. Y 0.2 está por debajo de `OXIGENO_QUE_HACE_CENIZA`
 * (0.35), que es lo único que separa el carbón de la ceniza. Si esto se toca, se
 * mueve la técnica emblema de toda la arquitectura.
 */
export const OCLUSION_CORTA_OXIGENO = 0.8

/**
 * Cuánto rinde una unidad de `calories` en `stamina`.
 *
 * Es 1 y no es una perilla: `calories = nutrition × mass × digestibility` y la
 * digestibilidad tiene techo 0.95, así que la conversión ya paga su ineficiencia
 * ahí adentro. Poner otro número acá sería cobrarla dos veces —o, peor, menos de
 * una vez— y el invariante de conservación lo rechazaría con razón. Que la
 * eficiencia de comer SEA la digestibilidad es lo que hace que cocinar valga la
 * pena sin que nadie escriba «cocinar rinde más».
 */
export const STAMINA_POR_CALORIA = 1

/** Qué fracción de la masa se lleva una hebra al deshilachar. */
export const FRACCION_DE_HEBRA = 0.1

/**
 * **YA NO LA USA NADIE, y está acá para que se lea por qué.**
 *
 * Era «cuánta masa saca del stock una extracción lograda», medio kilo fijo, y era
 * la mitad del agujero más caro del Hito 4: con una masa fija, **un anzuelo de
 * pedernal rendía exactamente igual que una caña pelada** —el rol `gear` pedía
 * `catch > 0` y después el `catch` no entraba en ninguna cuenta—. Una conducta
 * que no paga no la aprende nadie ni la puede distinguir un juez, y el criterio
 * de emergencia del Hito 5 es un juez.
 *
 * Desde el tramo B, lo que sale del pozo pesa `Stock.masaPorUnidad` —lo que el
 * dios decretó que pesa una pieza de ese lugar— y si sale o no lo decide el dado
 * del mundo contra `probabilidadDePicar`, que sí lee el `catch`. Medido con las
 * dos cañas sobre el mismo pozo y la misma semilla: 3,29× a favor del anzuelo.
 *
 * Se conserva EXPORTADA a propósito. Borrarla dejaría el número sin historia, y
 * el número tiene historia: alguien que vuelva a escribir «saca una fracción fija»
 * tiene que toparse con esto antes.
 *
 * @deprecated la extracción de la partida pasa por `draw` del oráculo. Ver
 * `sacarDelPozo`.
 */
export const MASA_POR_EXTRACCION = 0.5

// ─── Utilidades de estado ────────────────────────────────────────────────────

function mapaOrdenado<V>(pares: readonly (readonly [string, V])[]): Map<string, V> {
  const orden = [...pares].sort((a, b) => compararTexto(a[0], b[0]))
  const m = new Map<string, V>()
  for (const [k, v] of orden) m.set(k, v)
  return m
}

/** Un mapa de cuerpos en orden canónico de id. */
export function mapaDeCuerpos(cuerpos: readonly WorldBody[]): ReadonlyMap<BodyId, WorldBody> {
  return mapaOrdenado(cuerpos.map((c) => [c.body.id, c] as const)) as ReadonlyMap<BodyId, WorldBody>
}

/** Un mapa de actores en orden canónico de id. */
export function mapaDeActores(actores: readonly Actor[]): ReadonlyMap<ActorId, Actor> {
  return mapaOrdenado(actores.map((a) => [a.id, a] as const)) as ReadonlyMap<ActorId, Actor>
}

/**
 * El mundo mutable de UN tick.
 *
 * `stepWorld` es puro hacia afuera —no toca el `WorldState` que le dan— y por
 * dentro trabaja sobre esta copia. La alternativa, reconstruir el estado entero
 * en cada intención, cuesta una copia de 5000 entradas por cada cosa que la
 * criatura hace; y la alternativa opuesta, mutar el estado de entrada, rompe la
 * garantía que sostiene el replay. La copia se hace UNA vez, al entrar.
 */
interface Borrador {
  tick: number
  /** La frecuencia del mundo. Viaja del estado de entrada al de salida sin tocarse. */
  hz: number
  /** El paso de tiempo de este tick, en segundos. Sale de `state.hz`. */
  dt: Dt
  phys: Physics
  bodies: Map<BodyId, WorldBody>
  actors: Map<ActorId, Actor>
  cells: Map<CellKey, CellState>
  nextId: number
  /** Si cambió el juego de ids, el mapa hay que volver a ordenarlo al salir. */
  reordenar: boolean
  /** Adentro del tick los eventos están SIN FIRMAR: la firma la pone `firmar`. */
  events: SimEventSinFirmar[]
  /**
   * EL LIBRO DE LO QUE EL MUNDO GASTÓ de cada cuenta conservada, en este tick.
   *
   * Lo escriben los tres lugares que bajan una conservada sin que sea una ley de
   * la física —`cobrarStamina`, `sistemaMetabolismo` y lo que un `poweredBy` o un
   * `drain` pagan— y lo lee `stepWorld` una sola vez al final para narrarlo. Ver
   * el evento `gasto`.
   *
   * PEREZOSO, como los índices: un tick donde nadie gasta nada no paga un `Map`.
   * Y muere con el borrador, así que no puede quedar viejo entre ticks.
   */
  gastado: Map<QualityId, number> | undefined
  /**
   * El índice de cuerpos por celda. PEREZOSO: `undefined` hasta que la primera
   * intención pregunta qué hay en una celda. Ver `indiceDeCeldas` y `estorbo`.
   */
  celdas: IndiceDeCeldas | undefined
  /**
   * Los cuerpos que tienen alguna relación espacial —`supportedBy` o `covering`—.
   * PEREZOSO igual que el otro. Ver `conRelaciones` y `olvidar`.
   */
  conRelacion: Set<BodyId> | undefined
  /**
   * QUÉ MANO ESTÁ EMPUJANDO QUÉ, en este tick (ADR II-0010).
   *
   * Lo escribe `aplicarEfectos` cuando un `drive` mueve de verdad una cualidad, y
   * lo lee `entornoDe` una fase después, para pasárselo a `paso()` adentro de
   * `Entorno.empujes`. Es el canal entero entre las dos mitades del tick, y es
   * de UNA sola dirección: las intenciones escriben, los sistemas leen.
   *
   * PEREZOSO como los dos índices de arriba, y por una razón más fuerte: en un
   * tick corriente nadie frota nada, y un `Map` por tick para no guardar nada es
   * una asignación por tick que el presupuesto de 4 ms no tiene por qué pagar.
   * Cuando está en `undefined`, `entornoDe` devuelve exactamente los mismos
   * objetos compartidos que devolvía antes de este ADR.
   *
   * Muere con el borrador, así que no puede quedar viejo entre ticks: un empuje
   * dura UN paso, que es lo que dura la mano en el palo. El que se distrae pierde
   * la actividad (`stepWorld` se la saca a quien no actuó) y con ella el empuje.
   */
  empujes: Map<BodyId, Empuje[]> | undefined
  // ─── El dios del tick ──────────────────────────────────────────────────────
  //
  // Las tres piezas del dios son PEREZOSAS y por la misma razón que los dos
  // índices de arriba: un tick en el que nadie pesca no tiene por qué armar un
  // dado, reconstruir un libro de cobros ni copiar un mapa de stocks. Medido en
  // la aritmética: el libro cuesta O(cobros) y hay del orden de un cobro cada
  // treinta ticks aunque la criatura no haga otra cosa que pescar.
  //
  // Que sean `undefined` es además lo que le dice a `cerrar` si el estado del
  // dios cambió: si las tres siguen vacías, el `EstadoDelDios` sale POR
  // IDENTIDAD, o sea que la ranura del snapshot no genera delta.
  /** La semilla, el dado, los pozos tocados y el diario. `undefined` sin dios. */
  dios: EstadoDelDios | undefined
  /** El dado del mundo de este tick. Se arma en la primera tirada. */
  dado: DadoDelMundo | undefined
  /** El libro calórico de este tick, reconstruido del diario en el primer cobro. */
  libro: LibroCalorico | undefined
  /**
   * EL ÍNDICE DE POZOS del tick, por id de banco. PEREZOSO, como los otros dos.
   *
   * En el estado los pozos viven en un ARREGLO —una ranura tiene que sobrevivir a
   * JSON y un `Map` no— y acá adentro hacen falta por clave: `materializarPozos`
   * pregunta hasta nueve veces por actor y por tick. Es el mismo trato que
   * `indiceDeCeldas`: la forma canónica afuera, el índice adentro, y el índice
   * muere con el borrador así que no puede quedar viejo entre ticks.
   *
   * Copia al escribir, igual que todo lo demás del borrador: `retirarUno` MUTA el
   * stock que le pasan, así que lo que se le pasa es siempre un clon. Sin el clon,
   * `stepWorld` estaría escribiendo adentro del `WorldState` que le dieron y el
   * replay dejaría de reproducir.
   */
  stocks: Map<BodyId, Stock> | undefined
  /** Si alguno de los pozos CAMBIÓ. Aparte del índice porque el índice se arma
   *  también para leer, y leer no genera delta. */
  pozosTocados: boolean
  /** El segundo de mundo de este tick. `tick / hz`, con la cuenta exacta de
   *  `segundosDe`. Lo piden `population`, `retirarUno` y `Cobro.at`. */
  segundos: Duracion
}

function abrir(s: WorldState): Borrador {
  return {
    tick: s.tick,
    hz: s.hz,
    // Acá, y no en cada ley: `dtDeFrecuencia` LANZA si la frecuencia no es
    // admisible, y el único momento honesto para enterarse es antes de que el
    // paso escriba nada.
    dt: dtDeFrecuencia(s.hz),
    phys: s.phys,
    bodies: new Map(s.bodies),
    actors: new Map(s.actors),
    cells: new Map(s.cells),
    nextId: s.nextId,
    reordenar: false,
    events: [],
    gastado: undefined,
    // Los dos índices nacen VACÍOS y mueren con el borrador. Un índice que no
    // sobrevive al tick no puede quedar viejo entre ticks, que es la mitad de los
    // modos de falla de una caché; la otra mitad —quedar vieja ADENTRO del tick—
    // la cierra que `ponerCuerpo` y `sacarCuerpo` sean el único camino de
    // escritura, y la mira `tests/el-indice-mal-invalidado.test.ts`.
    celdas: undefined,
    conRelacion: undefined,
    empujes: undefined,
    dios: s.dios,
    dado: undefined,
    libro: undefined,
    stocks: undefined,
    pozosTocados: false,
    segundos: segundosDe(s),
  }
}

/** El índice de pozos, armado a demanda del arreglo canónico del estado. */
function indiceDePozos(d: Borrador): Map<BodyId, Stock> {
  let i = d.stocks
  if (i === undefined) {
    i = new Map()
    for (const p of d.dios?.stocks ?? []) i.set(p.banco, p.stock)
    d.stocks = i
  }
  return i
}

/**
 * El estado del dios de salida.
 *
 * Sale POR IDENTIDAD cuando nadie lo tocó, y eso no es una optimización de
 * asignaciones: `worldSlots` entrega las ranuras SIN COPIAR y el snapshot por
 * delta compara identidades. Un `{...d.dios}` por tick metería la ranura del dios
 * en todos los deltas de la partida, para no decir nada nuevo.
 */
function diosDeSalida(d: Borrador): EstadoDelDios | undefined {
  const previo = d.dios
  if (previo === undefined) return undefined
  if (d.dado === undefined && !d.pozosTocados && d.libro === undefined) return previo
  return {
    semilla: previo.semilla,
    dado: d.dado === undefined ? previo.dado : d.dado.estado(),
    stocks: d.pozosTocados
      ? ordenarPozos([...indiceDePozos(d)].map(([banco, stock]) => ({ banco, stock })))
      : previo.stocks,
    // El diario se COPIA al salir: `LibroCalorico` devuelve el suyo por
    // referencia y le hace `push` al cobrar, así que dejarlo entrar tal cual
    // pondría un arreglo vivo adentro de un estado que se dice inmutable — y el
    // snapshot promete que «una ranura que entró a un delta no se muta nunca
    // más».
    cobros: d.libro === undefined ? previo.cobros : [...d.libro.cobros()],
  }
}

function cerrar(d: Borrador): StepOutcome {
  const bodies = d.reordenar ? mapaDeCuerpos([...d.bodies.values()]) : d.bodies
  const dios = diosDeSalida(d)
  return {
    state: {
      tick: d.tick + 1,
      hz: d.hz,
      phys: d.phys,
      bodies,
      actors: d.actors,
      cells: d.cells,
      nextId: d.nextId,
      ...(dios === undefined ? {} : { dios }),
    },
    // LA ÚNICA ASEVERACIÓN DE TIPO DEL ARCHIVO, y hay que decir por qué se
    // sostiene: adentro del tick los eventos son `SimEventSinFirmar`, o sea que a
    // los de respuesta les puede faltar el `seq`. A la salida no le falta a
    // ninguno, y son tres caminos y no más:
    //
    //   - lo que empuja un despacho lo firma `firmar`, que corre INMEDIATAMENTE
    //     después de `despachar` sobre exactamente lo que ese despacho agregó;
    //   - lo que empuja `avanzarEsperas` sale firmado con el `seq` de la `Espera`;
    //   - lo que empujan los sistemas es `Narracion` —`sustancia` de la ley 4 y
    //     `murio` de hambre—, y la narración no lleva firma.
    //
    // El compilador no puede ver eso, así que lo mira un test: la partida al azar
    // de `tests/correlacion.test.ts` recorre TODOS los eventos de 300 ticks y
    // exige que cada respuesta traiga un `seq` entero y de alguien.
    events: d.events as readonly SimEvent[],
  }
}

function nuevoId(d: Borrador): BodyId {
  // Con relleno a la izquierda para que el orden por id sea el de creación hasta
  // el cuerpo 10^9. Sin el relleno, `w10` iría antes que `w9` en orden de unidad
  // de código y el recorrido canónico dejaría de parecerse a la historia.
  const n = d.nextId
  d.nextId = n + 1
  return `w${String(n).padStart(9, '0')}`
}

/**
 * **El único camino por el que un cuerpo entra o se muda dentro del tick**, y por
 * eso es donde se mantienen los dos índices del borrador.
 *
 * Que sea el único no es una convención: los tres `d.bodies.set` sueltos que
 * quedan en el archivo —`olvidar`, `sistemaLeyes`, `sistemaMetabolismo`— cambian
 * el CUERPO y no su lugar ni sus relaciones, que es lo único que los índices
 * miran. `tests/el-indice-mal-invalidado.test.ts` lo verifica corriendo partidas
 * enteras contra el índice reconstruido desde cero.
 */
function ponerCuerpo(d: Borrador, c: WorldBody): void {
  const antes = d.bodies.get(c.body.id)
  if (antes === undefined) d.reordenar = true
  d.bodies.set(c.body.id, c)
  anotar(d, antes, c)
}

function sacarCuerpo(d: Borrador, id: BodyId): void {
  // Sobre qué se apoyaba, LEÍDO ANTES DE BORRARLO: es lo que hereda la pila.
  const habia = d.bodies.get(id)
  const abajo = habia?.supportedBy
  if (d.bodies.delete(id)) d.reordenar = true
  desanotar(d, habia)
  olvidar(d, id, abajo)
  desenmanar(d, id)
}

// ─── Los dos índices del borrador ────────────────────────────────────────────

/**
 * De celda a los cuerpos que hay ahí, para que `estorbo` deje de recorrer el
 * mundo entero.
 *
 * MEDIDO, y es la razón de existir de todo esto: con 5000 cuerpos y 5000
 * criaturas caminando, el p99 del tick era 668 ms — 133 veces el techo del Hito 5
 * — porque `estorbo` y `olvidar` son O(cuerpos) y corren UNA VEZ POR ACTOR. El
 * banco está en `tests/banco-el-camino-de-intenciones.test.ts` con la tabla del
 * antes y la del después.
 *
 * ─── Por qué `orden` ────────────────────────────────────────────────────────
 *
 * `estorbo` devuelve **el primero** que estorba, y «primero» quiere decir el
 * primero que aparecería recorriendo `d.bodies`. Cuando dos sólidos comparten
 * celda —pasa: el arnés de la partida de 2000 ticks cuenta 97 solapamientos— cuál
 * de los dos vuelve NO es indiferente: `intencionCaminar` se apoya en él
 * (`supportedBy: choque.body.id`) y eso entra al hash. Así que las cubetas se
 * mantienen ordenadas por el lugar que cada cuerpo ocupa en el recorrido, y no por
 * orden de llegada a la cubeta. Sin esto, un cuerpo que se muda a una celda que ya
 * tenía otro quedaría último aunque en `d.bodies` fuera primero, y la partida
 * divergiría en el primer choque.
 *
 * ─── Por qué NO se usa la `Grid` de `grid.ts` ───────────────────────────────
 *
 * `grid.ts` tiene un índice espacial O(1) —`placeBody`, `bodiesAt`— y no sirve
 * acá, por dos razones que están medidas en el banco:
 *
 *   - `placeBody` MATERIALIZA el chunk, o sea que indexar un cuerpo asigna los
 *     arreglos de terreno de 1024 celdas de ese chunk. El propio encabezado de
 *     `grid.ts` dice que leer no materializa, justamente porque materializar es lo
 *     que hace que dos partidas exploradas en distinto orden difieran;
 *   - `WorldState` no tiene una `Grid`, así que habría que armar una por tick
 *     —1,50 ms contra 0,80 del `Map`, medido— o meterla en el estado, que le
 *     cambia el hash al mundo entero y es un ADR, no una optimización.
 */
interface IndiceDeCeldas {
  /** De clave de celda a los ids que hay ahí, en orden de recorrido de `bodies`. */
  readonly porCelda: Map<CellKey, BodyId[]>
  /** El lugar de cada cuerpo en el recorrido de `bodies`. */
  readonly orden: Map<BodyId, number>
  /** El próximo lugar a repartir: los cuerpos que nacen van al final, como en el `Map`. */
  proximo: number
}

/**
 * El índice, armado la primera vez que alguien pregunta y no antes.
 *
 * PEREZOSO y no armado en `abrir`, porque un tick sin intenciones no pregunta por
 * ninguna celda y no tiene por qué pagar la pasada: el banco viejo
 * —`stepWorld(s, [])` sobre 5000 cuerpos— mide exactamente lo mismo que antes.
 */
function indiceDeCeldas(d: Borrador): IndiceDeCeldas {
  const hay = d.celdas
  if (hay !== undefined) return hay
  const porCelda = new Map<CellKey, BodyId[]>()
  const orden = new Map<BodyId, number>()
  let n = 0
  for (const c of d.bodies.values()) {
    orden.set(c.body.id, n++)
    // Se recorre `d.bodies` en su orden, así que las cubetas salen ya ordenadas
    // por `orden` y acá alcanza con empujar al final.
    const k = keyOfCell(c.at)
    const cubeta = porCelda.get(k)
    if (cubeta === undefined) porCelda.set(k, [c.body.id])
    else cubeta.push(c.body.id)
  }
  const i: IndiceDeCeldas = { porCelda, orden, proximo: n }
  d.celdas = i
  return i
}

/**
 * Los cuerpos con `supportedBy` o `covering`, armado la primera vez que se
 * pregunta. Es todo lo que `olvidar` necesita mirar, y en cualquier mundo real son
 * un puñado contra los cinco mil que recorría.
 */
function conRelaciones(d: Borrador): Set<BodyId> {
  const hay = d.conRelacion
  if (hay !== undefined) return hay
  const s = new Set<BodyId>()
  for (const c of d.bodies.values()) {
    if (c.supportedBy !== undefined || c.covering !== undefined) s.add(c.body.id)
  }
  d.conRelacion = s
  return s
}

/** Un cuerpo que entra o que se mudó. Sin índices armados no cuesta nada. */
function anotar(d: Borrador, antes: WorldBody | undefined, ahora: WorldBody): void {
  const i = d.celdas
  if (i !== undefined) {
    const id = ahora.body.id
    if (antes === undefined) {
      // Nace: va al final del recorrido, que es donde el `Map` lo pone.
      i.orden.set(id, i.proximo)
      i.proximo += 1
      enCubeta(i, keyOfCell(ahora.at), id)
    } else if (antes.at.x !== ahora.at.x || antes.at.y !== ahora.at.y) {
      // Se mudó. Comparar las coordenadas y no las claves ahorra dos `keyOfCell`
      // en el camino más transitado: `cobrarStamina` y las leyes reescriben el
      // cuerpo sin moverlo, y ése es el caso normal.
      deCubeta(i, keyOfCell(antes.at), id)
      enCubeta(i, keyOfCell(ahora.at), id)
    }
  }
  const r = d.conRelacion
  if (r !== undefined) {
    if (ahora.supportedBy !== undefined || ahora.covering !== undefined) r.add(ahora.body.id)
    else r.delete(ahora.body.id)
  }
}

/** Un cuerpo que se fue del mundo. */
function desanotar(d: Borrador, habia: WorldBody | undefined): void {
  if (habia === undefined) return
  const i = d.celdas
  if (i !== undefined) {
    deCubeta(i, keyOfCell(habia.at), habia.body.id)
    i.orden.delete(habia.body.id)
  }
  if (d.conRelacion !== undefined) d.conRelacion.delete(habia.body.id)
}

/** Mete el id en la cubeta EN SU LUGAR del recorrido. Ver `IndiceDeCeldas`. */
function enCubeta(i: IndiceDeCeldas, k: CellKey, id: BodyId): void {
  const cubeta = i.porCelda.get(k)
  if (cubeta === undefined) {
    i.porCelda.set(k, [id])
    return
  }
  const n = i.orden.get(id) ?? 0
  // Búsqueda lineal desde el final y no binaria: una celda tiene uno o dos
  // cuerpos, y en la pila más alta que el arnés produjo tenía tres.
  let p = cubeta.length
  while (p > 0 && (i.orden.get(cubeta[p - 1] as BodyId) ?? 0) > n) p -= 1
  cubeta.splice(p, 0, id)
}

/** Saca el id de la cubeta, y la cubeta si quedó vacía: una celda sin cuerpos no se indexa. */
function deCubeta(i: IndiceDeCeldas, k: CellKey, id: BodyId): void {
  const cubeta = i.porCelda.get(k)
  if (cubeta === undefined) return
  const p = cubeta.indexOf(id)
  if (p >= 0) cubeta.splice(p, 1)
  if (cubeta.length === 0) i.porCelda.delete(k)
}

/**
 * Lo saca de TODA mano, no solo de la de quien lo hizo desaparecer.
 *
 * Lo encontró el arnés de invariantes en el tick 42 de una partida de diez
 * actores peleándose por seis cosas: la criatura A come algo que la criatura B
 * tenía en la mano —`aMano` alcanza con estar en una celda vecina, y comer no
 * pregunta de quién es—, el cuerpo se borra del mundo y el `holding` de B sigue
 * nombrándolo. El resultado es un inventario que apunta a la nada: materia que
 * para el invariante se evaporó, y para la percepción de B una cosa que tiene y
 * no existe.
 *
 * Va acá y no en cada sitio que destruye un cuerpo por la misma razón que
 * `olvidar`: hay tres lugares que sacan cuerpos —comer, `join` y lo que venga— y
 * el que se olvide de limpiar no da error, deja un fantasma.
 */
function desenmanar(d: Borrador, id: BodyId): void {
  for (const a of d.actors.values()) {
    if (!a.holding.includes(id)) continue
    d.actors.set(a.id, { ...a, holding: a.holding.filter((x) => x !== id) })
  }
}

/**
 * Borra toda relación que apunte a este cuerpo, y **deja caer la pila un
 * escalón**: lo que se apoyaba en él pasa a apoyarse en lo que él se apoyaba, si
 * eso sigue en la misma celda.
 *
 * Se llama al sacarlo del mundo, al levantarlo y al mudarlo: lo que estaba
 * apoyado sobre algo que ya no está en el piso no está apoyado en nada, y lo que
 * tapaba una fogata deja de taparla en cuanto se lo llevan. Sin esto, la relación
 * queda colgada y el efecto es peor que un puntero suelto: la ley 12 seguiría
 * contando una tapa que ya no está, y la criatura haría carbón desde el otro lado
 * del mapa.
 *
 * ─── Por qué se HEREDA el apoyo y no se borra ───────────────────────────────
 *
 * Lo encontró el arnés en el tick 811: en la celda (1,−1) había una pila legal de
 * tres criaturas —hilda en el piso, cira sobre hilda, ana sobre cira— y cira se
 * fue caminando. Con el borrado a secas, ana quedaba apoyada en nada, o sea DOS
 * cosas sueltas en la misma celda: un solapamiento que ninguna intención pidió y
 * que nadie podía deshacer. Sacar un bloque del medio de una pila hace que lo de
 * arriba baje, no que quede flotando.
 *
 * La tapa NO se hereda, y la asimetría es física: apoyarse es contra lo que haya
 * abajo, y siempre hay algo. Tapar es tapar A ALGO; si ese algo se fue, la tapa
 * no tapa nada nuevo — la losa sobre la fogata no pasa a tapar la piedra que
 * había debajo de la fogata.
 */
/*
 * ─── Y por qué NO recorre el mundo ──────────────────────────────────────────
 *
 * Recorría `[...d.bodies.values()]`: O(cuerpos) Y una copia del arreglo entero,
 * por cada mudanza de actor, por cada `take` y por cada `sacarCuerpo`. Con 5000
 * cuerpos y 5000 criaturas caminando eso son veinticinco millones de
 * comparaciones y cinco mil copias de cinco mil punteros POR TICK, y fue —junto
 * con `estorbo`— lo que ponía el p99 del tick en 668 ms contra un techo de 5.
 *
 * Ahora mira `conRelaciones(d)`, que es el juego de cuerpos que TIENEN una
 * relación espacial. Es el mismo conjunto de candidatos —ninguno que no tenga
 * `supportedBy` ni `covering` puede apuntar a nadie— y en cualquier mundo real son
 * un puñado.
 *
 * Se copia el conjunto a un arreglo antes de recorrerlo por la misma razón que
 * antes se copiaba el mapa: el cuerpo, al limpiarse, sale del conjunto, y borrar
 * de un `Set` que se está recorriendo es la clase de cosa que funciona hasta que
 * deja de funcionar. El ORDEN del recorrido no importa —cada cuerpo se reescribe a
 * partir de sí mismo, y lo único que `soporteQueHereda` lee de otro cuerpo son su
 * celda y su mano, que `olvidar` no toca— pero la copia es barata y la garantía
 * no.
 */
function olvidar(d: Borrador, id: BodyId, abajo?: BodyId): void {
  for (const otro of [...conRelaciones(d)]) {
    const c = d.bodies.get(otro)
    if (c === undefined) continue
    if (c.supportedBy !== id && c.covering !== id) continue
    const { supportedBy: _s, covering: _c, ...resto } = c
    const heredado = c.supportedBy === id ? soporteQueHereda(d, abajo, c) : c.supportedBy
    const conApoyo =
      heredado !== undefined && heredado !== id ? { ...resto, supportedBy: heredado } : resto
    const limpio = c.covering !== undefined && c.covering !== id
      ? { ...conApoyo, covering: c.covering }
      : conApoyo
    // Por `ponerCuerpo` y no por `d.bodies.set`: es lo que saca del conjunto a los
    // que quedaron sin relación. La clave ya existe, así que `reordenar` no se
    // mueve y el resultado es idéntico.
    ponerCuerpo(d, limpio)
  }
}

/**
 * Sobre qué queda apoyado el huérfano. `undefined` es una respuesta legítima: se
 * apoya en el piso, que no es un cuerpo.
 *
 * Las tres condiciones son las tres formas de mentir con una herencia: que lo
 * heredado ya no exista, que esté en otra celda —apoyarse en algo que está a tres
 * pasos es la misma mentira que el `supportedBy` viejo que esto vino a arreglar—,
 * o que sea el propio huérfano, que sería un cuerpo apoyado en sí mismo.
 */
function soporteQueHereda(d: Borrador, abajo: BodyId | undefined, c: WorldBody): BodyId | undefined {
  if (abajo === undefined || abajo === c.body.id) return undefined
  const base = d.bodies.get(abajo)
  if (base === undefined || base.heldBy !== undefined) return undefined
  return base.at.x === c.at.x && base.at.y === c.at.y ? abajo : undefined
}

// ─── La celda, con la ley 12 adentro ─────────────────────────────────────────

/**
 * La ley 12, `oclusion` (ADR II-0002), y vive acá y no en `@anima/physics` por
 * una razón estructural: es la única de las doce que **no habla de un cuerpo sino
 * de una celda**, y una celda es un concepto del mundo. `@anima/physics` no sabe
 * que hay un mapa; le entregamos la `Celda` ya ocluida y sus leyes 1, 3, 4 y 11
 * la leen sin enterarse de nada.
 *
 * `sheltered = 1 − Π permeabilidad(tapas)`. Es una ley general y no una tabla por
 * situación: tapar con una hoja (permeable) y tapar con una losa (impermeable) no
 * dan lo mismo, dos tapas multiplican, y una tapa perfectamente permeable no tapa
 * nada. Eso es lo que le da función a la malla y al tejido, que hoy son formas sin
 * consecuencia, y es lo que hace que la criatura tenga algo que descubrir.
 */
interface ConCuerpos {
  readonly bodies: ReadonlyMap<BodyId, WorldBody>
  readonly phys: Physics
}

/**
 * La oclusión de TODAS las celdas tapadas, en una sola pasada.
 *
 * Se calcula una vez por tick y no una vez por cuerpo, y la diferencia no es de
 * estilo: preguntar «¿cuánto tapa esta celda?» recorriendo los cuerpos cuesta
 * O(n) y hay que preguntarlo por cada cuerpo, o sea O(n²) — con 5000 cuerpos son
 * veinticinco millones de comparaciones por tick, y el presupuesto entero del
 * criterio del Hito 2 son cuatro milisegundos. El mapa solo tiene entradas para
 * las celdas donde alguien puso algo encima, que en cualquier mundo real son un
 * puñado.
 */
function oclusiones(d: ConCuerpos): ReadonlyMap<CellKey, number> {
  const productos = new Map<CellKey, number>()
  for (const c of d.bodies.values()) {
    if (c.covering === undefined) continue
    const k = keyOfCell(c.at)
    const p = qualityOf(c.body, 'permeability', d.phys)
    const limpio = p < 0 ? 0 : p > 1 ? 1 : p
    productos.set(k, (productos.get(k) ?? 1) * limpio)
  }
  const out = new Map<CellKey, number>()
  for (const [k, prod] of productos) {
    const s = 1 - prod
    out.set(k, s < 0 ? 0 : s > 1 ? 1 : s)
  }
  return out
}

/** Cuánto tapa UNA celda. Es la consulta suelta; el tick usa `oclusiones`. */
export function shelteredDe(d: ConCuerpos, celda: CellKey): number {
  return oclusiones(d).get(celda) ?? 0
}

/**
 * La `Celda` que ven las leyes, con la oclusión ya aplicada. Las tres
 * consecuencias del ADR II-0002 salen de la MISMA cuenta, que es el punto:
 *
 *   - baja el `oxygen` → la ley 3 arde peor y la ley 4 da carbonoso: **carbón**;
 *   - acerca el `ambiente` de la ley 1 a lo que la celda ya tiene: **reparo**;
 *   - baja el `wet` que la ley 11 le pasa a lo que esté ahí: **techo**.
 *
 * Queda un hueco y conviene decirlo: el «reparo» correcto sería bajar el
 * ACOPLAMIENTO térmico con el ambiente, y `H_PERDIDA` no es alcanzable desde
 * `Entorno` —la única perilla que la física expone es la temperatura objetivo—.
 * Mover el objetivo da el mismo signo y no la misma curva.
 */
/**
 * La celda y el entorno de una celda de la que nadie dijo nada, compartidos.
 *
 * Son de solo lectura y las leyes no los mutan, así que reusarlos es sano. Y hace
 * falta: sin esto, un mundo de 5000 cuerpos al aire libre asigna dos objetos por
 * cuerpo y por tick, o sea 300 000 objetos por segundo a 30 Hz — todos iguales,
 * todos basura. Medido, esa sola asignación era la mitad del costo que el mundo
 * le agrega a la física.
 */
const CELDA_LIBRE: Celda = {
  oxygen: CELDA_POR_OMISION.oxygen,
  wet: CELDA_POR_OMISION.wet,
  ambiente: CELDA_POR_OMISION.temperature,
}
const ENTORNO_LIBRE: Entorno = { celda: CELDA_LIBRE }

/**
 * La celda que rige en `at`, en TRES capas y en este orden:
 *
 *   1. lo que el mundo ESCRIBIÓ (`d.cells`) — una fogata que secó el suelo;
 *   2. lo que el dios DECRETÓ (`celdaDecretada`) — el río, el pantano, el frío
 *      del bosque cerrado;
 *   3. el aire libre (`CELDA_POR_OMISION`) — cuando no hay dios.
 *
 * Sin la capa 2, el mundo nacía entero en ambiente y **el río no existía**: el
 * dios decretaba `wet = 1` en las celdas de agua y no lo leía nadie. Con ella, el
 * agua está donde el dios dice, cruza los bordes de chunk sin costura y no se
 * puede secar, porque no está guardada en ningún lado que alguien pueda secar.
 *
 * El atajo del aire libre se conserva para el mundo SIN dios, que es el caso del
 * banco de 5000 cuerpos: ahí `CELDA_LIBRE` compartido evitaba dos asignaciones
 * por cuerpo y por tick, medido como la mitad del costo que el mundo le agrega a
 * la física. Con dios, el que evita las asignaciones es el decreto memoizado, que
 * devuelve el MISMO objeto para la misma celda.
 */
function celdaDe(d: Borrador, at: Placement, ocl: ReadonlyMap<CellKey, number>): Celda {
  const k = keyOfCell(at)
  const propia = d.cells.get(k)
  const s = ocl.get(k) ?? 0
  if (propia === undefined && d.dios !== undefined) {
    // El camino caliente con dios: el decreto ya tiene la `Celda` armada y
    // compartida, así que leerla no asigna nada. Sólo se sale de acá si hay
    // oclusión, que es lo raro.
    if (s === 0) return entornoDecretado(d.dios, d.phys, at.x, at.y)
    const dec = celdaDecretada(d.dios, d.phys, at.x, at.y)
    return {
      oxygen: dec.oxygen * (1 - s * OCLUSION_CORTA_OXIGENO),
      wet: dec.wet * (1 - s),
      ambiente: T_AMBIENTE + s * (dec.temperature - T_AMBIENTE),
    }
  }
  if (propia === undefined && s === 0) return CELDA_LIBRE
  const base = propia ?? CELDA_POR_OMISION
  if (s === 0) return { oxygen: base.oxygen, wet: base.wet, ambiente: base.temperature }
  return {
    oxygen: base.oxygen * (1 - s * OCLUSION_CORTA_OXIGENO),
    wet: base.wet * (1 - s),
    ambiente: T_AMBIENTE + s * (base.temperature - T_AMBIENTE),
  }
}

// ─── Las fuentes de calor ────────────────────────────────────────────────────

/**
 * El punto de ignición más bajo de todo el catálogo, memorizado por `Physics`.
 *
 * Sirve para una criba SANA antes de preguntar `emitsPower`, que es una cualidad
 * derivada y cuesta: medida sobre 5000 cuerpos, preguntarla a todos son 3,15 ms
 * de un presupuesto de tick de 4. Y la criba es sana porque `emitsPower` lleva un
 * `step(temperature ≥ ignitionPoint)` adentro: ningún cuerpo cuya temperatura sea
 * menor que el mínimo del catálogo puede estar emitiendo. No se saltea ninguna
 * fogata; se saltea preguntar por 4980 piedras frías.
 */
const MENOR_IGNICION = new WeakMap<Physics, number>()

function menorIgnicion(phys: Physics): number {
  const memo = MENOR_IGNICION.get(phys)
  if (memo !== undefined) return memo
  let min = Number.POSITIVE_INFINITY
  for (const s of phys.substances.values()) {
    const v = s.perUnitMass.ignitionPoint
    if (v !== undefined && v < min) min = v
  }
  const r = min === Number.POSITIVE_INFINITY ? 0 : min
  MENOR_IGNICION.set(phys, r)
  return r
}

/**
 * Cota SUPERIOR de la temperatura del cuerpo, leída sin agregar nada.
 *
 * `qualityOf` para una intensiva devuelve el valor guardado si está, y si no el
 * promedio pesado por masa de las partes — y un promedio nunca supera al máximo.
 * Ninguna de las treinta sustancias semilla declara `temperature` en su
 * `perUnitMass` (la temperatura es estado, no materia), así que el máximo entre
 * lo que escribió el cuerpo y lo que escribieron sus partes acota de verdad.
 */
function temperaturaTecho(b: Body): number {
  let max = b.state.temperature ?? 0
  for (const p of b.parts) {
    const t = p.q.temperature
    if (t !== undefined && t > max) max = t
  }
  return max
}

interface FuenteEnMundo {
  readonly at: Placement
  readonly id: BodyId
  readonly potencia: number
}

function fuentes(d: Borrador): readonly FuenteEnMundo[] {
  const piso = menorIgnicion(d.phys)
  const out: FuenteEnMundo[] = []
  for (const c of d.bodies.values()) {
    if (temperaturaTecho(c.body) < piso) continue
    const p = qualityOf(c.body, 'emitsPower', d.phys)
    if (p > 0) out.push({ at: c.at, id: c.body.id, potencia: p })
  }
  return out
}

/**
 * Cómo mira este cuerpo a esa fuente. Los tres montajes de la física salen de la
 * geometría que el mundo ya tiene, y de ninguna tabla:
 *
 *   - `contacto` — está apoyado sobre la fuente misma, o tapándola;
 *   - `parrilla` — está apoyado sobre algo que está en la celda de la fuente;
 *   - `piso`     — todo lo demás.
 *
 * Que la parrilla salga de «apoyado sobre algo que está sobre el fuego» y no de
 * un campo `esParrilla` es lo que permite que cualquier cosa sirva de parrilla.
 */
function montajeDe(d: Borrador, c: WorldBody, f: FuenteEnMundo): Montaje {
  if (c.supportedBy === f.id || c.covering === f.id) return 'contacto'
  if (c.supportedBy !== undefined) {
    const sobre = d.bodies.get(c.supportedBy)
    if (sobre !== undefined && keyOfCell(sobre.at) === keyOfCell(f.at)) return 'parrilla'
  }
  return 'piso'
}

/**
 * El entorno de un cuerpo: su celda ocluida más la fuente que más lo calienta.
 *
 * UNA fuente y no la suma de todas, porque `Entorno` de la física acepta una
 * sola. Se elige la de mayor potencia y, a igualdad, la de id menor: con dos
 * fogatas idénticas a la misma distancia, quedarse con «la primera que apareció
 * en el mapa» haría que el resultado dependiera del orden de creación.
 */
function entornoDe(
  d: Borrador,
  c: WorldBody,
  fs: readonly FuenteEnMundo[],
  ocl: ReadonlyMap<CellKey, number>,
): Entorno {
  // Lo que alguien está empujando sobre este cuerpo en este tick (ADR II-0010).
  // Se pregunta primero porque decide si se puede devolver un entorno COMPARTIDO:
  // sin empujes, los caminos rápidos de abajo salen tal cual estaban.
  const empujes = d.empujes?.get(c.body.id)
  const celda = celdaDe(d, c.at, ocl)
  if (fs.length === 0) {
    if (empujes !== undefined) return { celda, empujes }
    return celda === CELDA_LIBRE ? ENTORNO_LIBRE : { celda }
  }
  let mejor: Fuente | undefined
  let mejorId = ''
  for (const f of fs) {
    if (f.id === c.body.id) continue
    const dist = chebyshev(c.at, f.at)
    const cand: Fuente = { potencia: f.potencia, distancia: dist, montaje: montajeDe(d, c, f) }
    if (mejor === undefined || cand.potencia > mejor.potencia) {
      mejor = cand
      mejorId = f.id
    } else if (cand.potencia === mejor.potencia && compararTexto(f.id, mejorId) < 0) {
      mejor = cand
      mejorId = f.id
    }
  }
  if (empujes !== undefined) {
    return mejor === undefined ? { celda, empujes } : { celda, fuente: mejor, empujes }
  }
  return mejor === undefined ? { celda } : { celda, fuente: mejor }
}

// ─── Lectura y escritura de cualidades sobre un cuerpo del mundo ─────────────

function conCualidad(b: Body, q: QualityId, v: number): Body {
  const state: QualityVector = { ...b.state }
  state[q] = clampToRange(q, v)
  return { ...b, state }
}

/** Escala la masa de todas las partes. La masa vive en las partes y en ningún otro lado. */
function escalarMasa(b: Body, factor: number): Body {
  const f = factor > 0 ? factor : 0
  const parts: Part[] = b.parts.map((p) => {
    const q: QualityVector = { ...p.q }
    if (q.mass !== undefined) q.mass = q.mass * f
    return { substance: p.substance, mass: p.mass * f, q }
  })
  const state: QualityVector = { ...b.state }
  if (state.mass !== undefined) state.mass = state.mass * f
  return { ...b, parts, state }
}

function masaDe(b: Body, phys: Physics): number {
  return qualityOf(b, 'mass', phys)
}

// ─── Las intenciones ─────────────────────────────────────────────────────────

function rechazo(d: Borrador, i: Intent, por: Motivo): void {
  d.events.push({ k: 'rechazada', by: i.by, seq: i.seq, que: i.k, por })
}

/** El cuerpo de un actor, o `undefined` si el mundo lo perdió. */
function cuerpoDe(d: Borrador, a: Actor): WorldBody | undefined {
  return d.bodies.get(a.body)
}

/** ¿Está al alcance de la mano? Misma celda o adyacente. */
function aMano(d: Borrador, a: Actor, c: WorldBody): boolean {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) return false
  if (c.heldBy === a.id) return true
  return chebyshev(mio.at, c.at) <= 1
}

/**
 * ¿Puede este cuerpo entrar a esa celda sin solaparse con otro sólido?
 *
 * Dos sólidos no ocupan la misma celda, salvo que uno esté apoyado o tapando al
 * otro. Es la mitad de la ley 8 que el mundo puede sostener: apilar es una
 * relación explícita, no un accidente de coordenadas. Y por eso la criatura puede
 * caminar sobre algo que tenga `footing`, que sale de rigidez y cohesión y no de
 * ninguna lista de superficies caminables.
 *
 * ─── Y por qué NO recorre el mundo ──────────────────────────────────────────
 *
 * Recorría `d.bodies.values()` entero para contestar por UNA celda, y lo llaman
 * `goTo`, `explore`, `put` y `celdaLibreCerca` —hasta nueve veces por `drop`—, o
 * sea una vez por actor y por tick como mínimo. Eso es O(actores × cuerpos), y
 * medido con 5000 de cada uno daba un p99 de tick de 668 ms contra un techo de 5.
 *
 * Ahora le pregunta a la cubeta de la celda. La lista de filtros de abajo es la
 * MISMA y en el mismo orden, menos la comparación de celda —que es lo que la
 * cubeta ya garantiza— y devuelve el mismo cuerpo: el índice mantiene cada cubeta
 * en el orden del recorrido de `d.bodies`, que es de lo que este `return c`
 * dependía. Ver `IndiceDeCeldas`.
 */
function estorbo(d: Borrador, at: Placement, quien: BodyId, phys: Physics): WorldBody | undefined {
  const cubeta = indiceDeCeldas(d).porCelda.get(keyOfCell(at))
  if (cubeta === undefined) return undefined
  for (const id of cubeta) {
    if (id === quien) continue
    const c = d.bodies.get(id)
    // Un id indexado sin cuerpo detrás sería un índice roto, no un dato faltante.
    // Se saltea en vez de lanzar porque `estorbo` corre adentro del tick y tirar
    // la partida entera es peor que contestar de más; lo que caza el fantasma es
    // `tests/el-indice-mal-invalidado.test.ts`, que compara contra el índice
    // reconstruido desde cero en cada tick.
    if (c === undefined) continue
    if (c.heldBy !== undefined) continue
    if (c.supportedBy === quien || c.covering === quien) continue
    if (qualityOf(c.body, 'solid', phys) <= 0) continue
    return c
  }
  return undefined
}

/**
 * La primera celda libre a partir de una, en un orden fijo: la propia y después
 * los ocho rumbos.
 *
 * Existe porque soltar algo a los pies no es «ponerlo donde estoy»: donde estoy
 * estoy yo, y dos sólidos no comparten celda. Sin esto, soltar cualquier cosa
 * dejaba al cuerpo de la criatura solapado con lo que soltó — y lo encontró el
 * arnés de invariantes en el tick 116 de una partida al azar, que es exactamente
 * para lo que el arnés existe.
 *
 * El orden de los rumbos es fijo y no depende de nada del mundo: dos partidas
 * gemelas sueltan en la misma celda.
 *
 * Son hasta NUEVE `estorbo` para una sola intención, y por eso es donde más se
 * nota que `estorbo` haya dejado de recorrer el mundo: eran nueve pasadas de 5000
 * cuerpos por cada `drop`, y ahora son nueve búsquedas en un `Map`. La función no
 * cambió una línea; cambió lo que cuesta cada una de las nueve.
 */
function celdaLibreCerca(d: Borrador, desde: Placement, quien: BodyId): Placement | undefined {
  if (enRango(desde) && estorbo(d, desde, quien, d.phys) === undefined) return desde
  for (const r of OCHO_RUMBOS) {
    const c = { x: desde.x + r.x, y: desde.y + r.y }
    if (!enRango(c)) continue
    if (estorbo(d, c, quien, d.phys) === undefined) return c
  }
  return undefined
}

function moverActor(d: Borrador, a: Actor, destino: Placement): void {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) return
  // MUDARSE SUELTA LAS RELACIONES ESPACIALES, en las dos direcciones: no se
  // apoya en lo que dejó atrás, y lo que se apoyaba en ella deja de tener sobre
  // qué. Llevarlas puestas produce dos daños, y el arnés encontró los dos:
  //
  //   - un `supportedBy` viejo que `montajeDe` lee como `contacto`, o sea que la
  //     criatura cocinaría sobre una fogata desde el otro lado del mapa;
  //   - un CICLO: A pisa a B y después B pisa a A, y las dos quedan apoyadas una
  //     en la otra. `revisarReferencias` recorre esa cadena con una cota, y la
  //     cota existe justamente porque sin ella el tick no termina.
  //
  // Es lo mismo que hace `intencionTomar` al levantar algo, mirado desde el que
  // se va en vez de desde el que se lo llevan.
  const { supportedBy: _apoyo, covering: _tapa, ...suelto } = mio
  ponerCuerpo(d, { ...suelto, at: destino })
  olvidar(d, mio.body.id, mio.supportedBy)
  // Lo que lleva en la mano viaja con ella. Si no, la criatura camina y la caña
  // se queda donde estaba, que es el bug que se descubre pescando en seco.
  for (const id of a.holding) {
    const c = d.bodies.get(id)
    if (c !== undefined) ponerCuerpo(d, { ...c, at: destino })
  }
}

/**
 * Cobrar un precio FIJO de `stamina`, o no cobrar nada.
 *
 * No pasa por `porPaso` a propósito: lo que se cobra acá son precios por acto
 * —una celda, un intento— y no tasas por segundo (ADR II-0009). Ver
 * `COSTO_POR_CELDA`.
 *
 * Y no cobra a medias: si no alcanza, devuelve `false` y el acto se rechaza con
 * `'sin-fuerza'` en vez de dejar a la criatura media celda adentro de la celda
 * siguiente. Gastar hasta EXACTAMENTE cero sí está permitido, y desde el ADR
 * II-0009 tiene consecuencia: `sistemaMetabolismo` corre después de las
 * intenciones, así que quien llegó a cero dando el último paso se muere de hambre
 * en el mismo tick que lo dio.
 */
function cobrarStamina(d: Borrador, a: Actor, cuanto: number): boolean {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) return false
  const tiene = qualityOf(mio.body, 'stamina', d.phys)
  if (tiene < cuanto) return false
  ponerCuerpo(d, { ...mio, body: conCualidad(mio.body, 'stamina', tiene - cuanto) })
  anotarGasto(d, 'stamina', cuanto)
  return true
}

/**
 * LAS CONSERVADAS QUE NINGUNA LEY DE LA FÍSICA TOCA.
 *
 * Es una lista de una sola cuenta y va a seguir siéndolo mientras las doce leyes
 * sean éstas, pero es una lista y no un `if (q === 'stamina')` porque lo que
 * define al conjunto es una propiedad y no un nombre: `stamina` está acá porque
 * ninguna de las leyes de `@anima/physics` la escribe —ni la 1, ni la 3, ni la 5,
 * ni la 4 desde que devuelve lo que la sustancia nueva no sabe contestar— y
 * porque ninguna sustancia la declara. O sea que TODO lo que le pasa a la
 * `stamina` del mundo lo hace el mundo, y el mundo lo puede contar exacto.
 *
 * `mass`, `nutrition` y `fuelEnergy` NO están, y no es un olvido: la ley 5 evapora
 * agua y con ella masa, la 3 quema combustible, la 4 tira el 94% de la materia y
 * la 6 pudre la nutrición. Las cuatro bajan cuentas conservadas legítimamente y
 * ninguna declara cuánto, así que para ésas no hay forma HOY de separar la bajada
 * legítima de la evaporación. Queda dicho, y con su `it.fails` en
 * `tests/la-conservada-que-se-evapora.test.ts`.
 *
 * Las dos son EXTENSIVAS —`stamina` y `mass`—, y eso también importa para el día
 * que la lista crezca: el total conservado de una intensiva es `q · mass`, así que
 * un libro que anote el intensivo pelado no se puede comparar contra el total.
 */
export const CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO: readonly QualityId[] = ['stamina']

/**
 * Anotar en el libro del tick que el mundo se llevó `cuanto` de esta cuenta.
 *
 * Sólo las cuentas que el invariante puede vigilar, y no por ahorrar: anotar el
 * gasto de una cuenta que además bajan las leyes daría un piso que no significa
 * nada, porque le faltaría todo lo que las leyes se llevaron.
 *
 * Se anota lo que se COBRÓ de verdad, no lo que se quiso cobrar. Un cobro que no
 * alcanzó ya salió por otro lado sin tocar el cuerpo, y anotarlo igual haría que
 * el piso del invariante fuera más bajo que la realidad — o sea, un guardián que
 * perdona de más.
 */
function anotarGasto(d: Borrador, q: QualityId, cuanto: number): void {
  if (!(cuanto > 0)) return
  if (!CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO.includes(q)) return
  let libro = d.gastado
  if (libro === undefined) {
    libro = new Map<QualityId, number>()
    d.gastado = libro
  }
  libro.set(q, (libro.get(q) ?? 0) + cuanto)
}

function intencionCaminar(d: Borrador, a: Actor, i: Intent & { k: 'goTo' }): void {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  if (!enRango(i.to)) {
    rechazo(d, i, 'fuera-de-rango')
    return
  }
  if (chebyshev(mio.at, i.to) <= i.within) {
    d.events.push({ k: 'espero', by: a.id })
    return
  }
  const destino = unPasoHacia(mio.at, i.to)
  const choque = estorbo(d, destino, mio.body.id, d.phys)
  // Se puede pisar lo que sostiene el peso: `footing` sale de rigidez y cohesión.
  if (choque !== undefined && qualityOf(choque.body, 'footing', d.phys) <= 0) {
    rechazo(d, i, 'celda-ocupada')
    return
  }
  if (!cobrarStamina(d, a, COSTO_POR_CELDA)) {
    rechazo(d, i, 'sin-fuerza')
    return
  }
  moverActor(d, a, destino)
  if (choque !== undefined) {
    const ahora = d.bodies.get(mio.body.id)
    if (ahora !== undefined) ponerCuerpo(d, { ...ahora, supportedBy: choque.body.id })
  }
  d.events.push({ k: 'movio', by: a.id, de: mio.at, a: destino })
}

/**
 * Un paso hacia el destino. Los dos ejes se mueven a la vez cuando conviene, que
 * es lo que hace que la distancia de Chebyshev sea la distancia de verdad: la
 * diagonal cuesta un paso, como caminar.
 */
export function unPasoHacia(desde: Placement, hasta: Placement): Placement {
  const sx = hasta.x > desde.x ? 1 : hasta.x < desde.x ? -1 : 0
  const sy = hasta.y > desde.y ? 1 : hasta.y < desde.y ? -1 : 0
  return { x: desde.x + sx, y: desde.y + sy }
}

/**
 * Explorar: un paso en una dirección que depende del tick y del id, y de nada
 * más. No hay azar en el mundo, así que «vagar» es una función del reloj.
 *
 * Es deliberadamente pobre y está anotado como tal: la exploración con memoria y
 * con frontera es del Hito 3, cuando exista el dios perezoso que decide qué hay
 * en el chunk de al lado. Lo que acá importa es que consuma el tick, cueste
 * `stamina` y sea reproducible bit a bit.
 */
const OCHO_RUMBOS: readonly Placement[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
]

function huellaDeTexto(s: string): number {
  // FNV-1a de 32 bits, entero puro. No es criptografía: es una forma barata y
  // determinista de que dos actores no exploren siempre en el mismo rumbo.
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

function intencionExplorar(d: Borrador, a: Actor, i: Intent & { k: 'explore' }): void {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  if (i.maxTicks <= 0) {
    d.events.push({ k: 'espero', by: a.id })
    return
  }
  const r = OCHO_RUMBOS[(d.tick + huellaDeTexto(a.id)) % OCHO_RUMBOS.length]!
  const destino = { x: mio.at.x + r.x, y: mio.at.y + r.y }
  if (!enRango(destino)) {
    rechazo(d, i, 'fuera-de-rango')
    return
  }
  if (estorbo(d, destino, mio.body.id, d.phys) !== undefined) {
    rechazo(d, i, 'celda-ocupada')
    return
  }
  if (!cobrarStamina(d, a, COSTO_POR_CELDA)) {
    rechazo(d, i, 'sin-fuerza')
    return
  }
  moverActor(d, a, destino)
  d.events.push({ k: 'movio', by: a.id, de: mio.at, a: destino })
}

function intencionTomar(d: Borrador, a: Actor, i: Intent & { k: 'take' }): void {
  const c = d.bodies.get(i.what)
  if (c === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  if (c.heldBy !== undefined) {
    rechazo(d, i, c.heldBy === a.id ? 'no-lo-tiene' : 'no-esta-a-mano')
    return
  }
  if (!aMano(d, a, c)) {
    rechazo(d, i, 'no-esta-a-mano')
    return
  }
  if (qualityOf(c.body, 'portable', d.phys) <= 0) {
    rechazo(d, i, 'no-portable')
    return
  }
  if (a.holding.length >= a.capacity) {
    rechazo(d, i, 'manos-llenas')
    return
  }
  const mio = cuerpoDe(d, a)
  // Al levantar algo se sueltan sus relaciones espaciales: lo que estaba apoyado
  // sobre otra cosa deja de estarlo, y lo que tapaba deja de tapar. Arrastrar la
  // relación en la mano haría que la criatura tape una fogata desde el otro lado
  // del mapa.
  const suelto: WorldBody = {
    body: c.body,
    at: mio?.at ?? c.at,
    heldBy: a.id,
  }
  ponerCuerpo(d, suelto)
  olvidar(d, c.body.id, c.supportedBy)
  d.actors.set(a.id, { ...a, holding: [...a.holding, c.body.id] })
  d.events.push({ k: 'tomo', by: a.id, what: c.body.id })
}

function soltar(d: Borrador, a: Actor, id: BodyId, at: Placement, o?: { onTopOf?: BodyId; covering?: BodyId }): void {
  const c = d.bodies.get(id)
  if (c === undefined) return
  const base = { body: c.body, at }
  const conApoyo = o?.onTopOf !== undefined ? { ...base, supportedBy: o.onTopOf } : base
  const puesto = o?.covering !== undefined ? { ...conApoyo, covering: o.covering } : conApoyo
  ponerCuerpo(d, puesto)
  d.actors.set(a.id, { ...a, holding: a.holding.filter((x) => x !== id) })
}

function intencionSoltar(d: Borrador, a: Actor, i: Intent & { k: 'drop' }): void {
  if (!a.holding.includes(i.what)) {
    rechazo(d, i, 'no-lo-tiene')
    return
  }
  const mio = cuerpoDe(d, a)
  if (mio === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  // A los pies, no encima: la celda donde está la criatura la ocupa ella.
  const donde = celdaLibreCerca(d, mio.at, i.what)
  if (donde === undefined) {
    rechazo(d, i, 'celda-ocupada')
    return
  }
  soltar(d, a, i.what, donde)
  d.events.push({ k: 'solto', by: a.id, what: i.what, at: donde })
}

function intencionPoner(d: Borrador, a: Actor, i: Intent & { k: 'put' }): void {
  if (!a.holding.includes(i.what)) {
    rechazo(d, i, 'no-lo-tiene')
    return
  }
  const mio = cuerpoDe(d, a)
  if (mio === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  if (!enRango(i.at) || chebyshev(mio.at, i.at) > 1) {
    rechazo(d, i, 'fuera-de-rango')
    return
  }
  // `onTopOf` y `covering` tienen que existir y estar donde se dice, o el mundo
  // guardaría una relación colgada: un cuerpo apoyado sobre nada.
  for (const ref of [i.onTopOf, i.covering]) {
    if (ref === undefined) continue
    const r = d.bodies.get(ref)
    if (r === undefined || keyOfCell(r.at) !== keyOfCell(i.at)) {
      rechazo(d, i, 'cuerpo-desconocido')
      return
    }
  }
  // Apoyar o tapar es la ÚNICA forma de compartir celda con un sólido. Sin
  // ninguna de las dos, la celda tiene que estar libre.
  if (i.onTopOf === undefined && i.covering === undefined) {
    if (estorbo(d, i.at, i.what, d.phys) !== undefined) {
      rechazo(d, i, 'celda-ocupada')
      return
    }
  }
  const o: { onTopOf?: BodyId; covering?: BodyId } = {}
  if (i.onTopOf !== undefined) o.onTopOf = i.onTopOf
  if (i.covering !== undefined) o.covering = i.covering
  soltar(d, a, i.what, i.at, o)
  d.events.push({ k: 'puso', by: a.id, what: i.what, at: i.at })
}

/**
 * Comer. Es la conversión: `nutrition · mass` deja de existir como comida y
 * aparece como `stamina` de quien comió, y lo que se pierde en el camino es
 * exactamente `1 − digestibility`.
 *
 * Es la única operación del mundo que hace SUBIR una cuenta conservada, y por eso
 * emite un evento `convierte` que el invariante audita. Todo lo demás baja.
 */
function intencionComer(d: Borrador, a: Actor, i: Intent & { k: 'eat' }): void {
  const c = d.bodies.get(i.what)
  if (c === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  if (!aMano(d, a, c)) {
    rechazo(d, i, 'no-esta-a-mano')
    return
  }
  const mio = cuerpoDe(d, a)
  if (mio === undefined) {
    rechazo(d, i, 'cuerpo-desconocido')
    return
  }
  const nutricion = qualityOf(c.body, 'nutrition', d.phys)
  const masa = masaDe(c.body, d.phys)
  const gastado = nutricion * masa
  const calorias = qualityOf(c.body, 'calories', d.phys)
  if (gastado <= 0 || calorias <= 0) {
    rechazo(d, i, 'nada-que-comer')
    return
  }
  const acreditado = calorias * STAMINA_POR_CALORIA
  const stamina = qualityOf(mio.body, 'stamina', d.phys)
  ponerCuerpo(d, { ...mio, body: conCualidad(mio.body, 'stamina', stamina + acreditado) })
  // `sacarCuerpo` lo saca de todas las manos, incluida la de quien come y la de
  // cualquier otro que lo tuviera. Antes acá se filtraba solo `a.holding`, y por
  // eso comerle algo de la mano a otro le dejaba el inventario roto.
  sacarCuerpo(d, c.body.id)
  d.events.push({ k: 'comio', by: a.id, what: c.body.id, calorias })
  d.events.push({
    k: 'convierte',
    by: a.id,
    de: 'nutrition',
    a: 'stamina',
    gastado,
    acreditado,
  })
  d.events.push({ k: 'murio', id: c.body.id, por: 'comido' })
}

// ─── `apply`: los cuatro procesos ────────────────────────────────────────────

interface Ligadura {
  readonly role: Role
  readonly cuerpo: WorldBody | undefined
}

/** Ata cada rol declarado con el cuerpo que le mandaron. Los `?` pueden faltar. */
function ligar(d: Borrador, p: Process, roles: readonly RoleBinding[]): Ligadura[] | Motivo {
  const out: Ligadura[] = []
  for (const role of p.roles) {
    const base = baseRoleName(role.name)
    const lig = roles.find((r) => r.name === base || r.name === role.name)
    if (lig === undefined) {
      if (isOptionalRole(role.name)) {
        out.push({ role, cuerpo: undefined })
        continue
      }
      return 'rol-sin-cuerpo'
    }
    const c = d.bodies.get(lig.body)
    if (c === undefined) return 'cuerpo-desconocido'
    out.push({ role, cuerpo: c })
  }
  return out
}

/**
 * `arrangement`: dónde tienen que estar los cuerpos para que el proceso corra.
 *
 * No es decoración. Es lo que hace que frotar dos palos exija tenerlos en la mano
 * y que pescar exija estar al lado del agua, sin que ninguna habilidad tenga que
 * acordarse de comprobarlo: el mundo no negocia.
 */
function arregloOk(d: Borrador, a: Actor, p: Process, ligs: readonly Ligadura[]): boolean {
  const mio = cuerpoDe(d, a)
  if (mio === undefined) return false
  const cuerpos = ligs.map((l) => l.cuerpo).filter((c): c is WorldBody => c !== undefined)
  switch (p.arrangement.k) {
    case 'held':
      // El cuerpo de la propia criatura cuenta como «en la mano»: es ella.
      return cuerpos.every((c) => c.heldBy === a.id || c.body.id === mio.body.id)
    case 'within': {
      const r = p.arrangement.radius
      return cuerpos.every((c) => chebyshev(mio.at, c.at) <= r)
    }
    case 'contact': {
      const k = keyOfCell(cuerpos[0]?.at ?? mio.at)
      return cuerpos.every((c) => keyOfCell(c.at) === k)
    }
    case 'supported':
      return cuerpos.every((c) => c.supportedBy !== undefined || c.heldBy === a.id)
    case 'inside':
      return cuerpos.every((c) => c.covering !== undefined || c.heldBy === a.id)
  }
}

/**
 * La compuerta del proceso, evaluada contra el cuerpo del PRIMER rol declarado.
 *
 * HUECO ANOTADO: el contrato de `Process` no dice sobre qué se evalúa `gate`.
 * Ninguno de los cuatro procesos semilla la usa, así que hoy no cambia nada, pero
 * el día que el modelo escriba uno con compuerta esta lectura hay que confirmarla
 * o cambiarla — y está acá, en un solo lugar, para que se pueda.
 */
function compuertaOk(d: Borrador, p: Process, ligs: readonly Ligadura[]): boolean {
  if (p.gate.length === 0) return true
  const primero = ligs[0]?.cuerpo
  if (primero === undefined) return false
  for (const t of p.gate) {
    const v = qualityOf(primero.body, t.q, d.phys)
    const ok =
      t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
    if (!ok) return false
  }
  return true
}

function mismosRoles(a: readonly RoleBinding[], b: readonly RoleBinding[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (x.name !== y.name || x.body !== y.body) return false
  }
  return true
}

function intencionAplicar(d: Borrador, a: Actor, i: Intent & { k: 'apply' }): void {
  const p = d.phys.processes.get(i.process)
  if (p === undefined) {
    rechazo(d, i, 'proceso-desconocido')
    return
  }
  const ligs = ligar(d, p, i.roles)
  if (!Array.isArray(ligs)) {
    rechazo(d, i, ligs)
    return
  }
  for (const l of ligs) {
    if (l.cuerpo === undefined) continue
    if (!cumpleRol(l.cuerpo.body, l.role, d.phys)) {
      rechazo(d, i, 'rol-no-cumple')
      return
    }
  }
  if (!arregloOk(d, a, p, ligs)) {
    rechazo(d, i, 'arreglo-incorrecto')
    return
  }
  if (!compuertaOk(d, p, ligs)) {
    rechazo(d, i, 'compuerta-cerrada')
    return
  }

  // La actividad continúa si es LA MISMA: mismo proceso y mismos cuerpos en los
  // mismos roles. Cambiar de palo a mitad de frotar empieza de cero, y así tiene
  // que ser: el calor acumulado está en el palo, no en la voluntad.
  const sigue =
    a.doing !== undefined && a.doing.process === i.process && mismosRoles(a.doing.roles, i.roles)
  const segundos = sumarPaso(sigue && a.doing !== undefined ? a.doing.segundos : seg(0), d.dt)

  aplicarEfectos(d, p, ligs)

  const at = p.completion?.at
  const completo = at !== undefined && segundos >= at
  if (completo) {
    for (const y of p.completion?.yields ?? []) rendir(d, a, y, ligs)
    d.actors.set(a.id, quitarActividad(d.actors.get(a.id) ?? a))
  } else {
    const actual = d.actors.get(a.id) ?? a
    d.actors.set(a.id, { ...actual, doing: { process: i.process, roles: i.roles, segundos } })
  }
  d.events.push({ k: 'proceso', by: a.id, process: i.process, segundos, completo })
}

function quitarActividad(a: Actor): Actor {
  const { doing: _descartado, ...resto } = a
  return resto
}

function cuerpoDeRol(ligs: readonly Ligadura[], nombre: string): WorldBody | undefined {
  for (const l of ligs) if (baseRoleName(l.role.name) === baseRoleName(nombre)) return l.cuerpo
  return undefined
}

/**
 * Los cuatro efectos, en UN PASO.
 *
 * Las tasas del proceso son POR SEGUNDO (ADR II-0008) y `porPaso` las lleva al
 * paso. A la frecuencia de referencia da exactamente lo que daba la tasa por
 * tick de antes: `friccion` empuja 120 grados por segundo, o sea 6 por paso a
 * 20 Hz, que es el número con el que se calibró.
 *
 *
 * `drive` con `poweredBy` es la única forma de que algo suba sin que sea gratis, y
 * la cuenta está escrita para que no pueda ser una máquina de movimiento
 * perpetuo: la energía que hace falta para subir `ΔT` grados es
 * `heatCapacity × ΔT` —la misma `heatCapacity` que divide la ley 1— y lo que se
 * cobra es esa energía DIVIDIDA por la eficiencia. Con eficiencia 0.35 entra
 * casi el triple del trabajo que sale de calor. Y si no hay con qué pagar, sube
 * lo que se pueda pagar y nada más: ésa es la distancia entre querer y poder.
 */
function aplicarEfectos(d: Borrador, p: Process, ligs: readonly Ligadura[]): void {
  for (const e of p.effects) {
    switch (e.k) {
      case 'drain': {
        const c = cuerpoDeRol(ligs, e.on)
        if (c === undefined) break
        const actual = d.bodies.get(c.body.id)
        if (actual === undefined) break
        const v = qualityOf(actual.body, e.q, d.phys)
        const baja = porPaso(e.porSegundo, d.dt)
        ponerCuerpo(d, { ...actual, body: conCualidad(actual.body, e.q, v - baja) })
        // Igual que en el metabolismo: lo que se anota es lo que había para
        // sacar, porque `conCualidad` topa contra el rango.
        anotarGasto(d, e.q, v > baja ? baja : v)
        break
      }
      case 'drive': {
        const c = cuerpoDeRol(ligs, e.on)
        if (c === undefined) break
        const actual = d.bodies.get(c.body.id)
        if (actual === undefined) break
        const v = qualityOf(actual.body, e.q, d.phys)
        const rumbo = e.toward > v ? 1 : -1
        const falta = rumbo > 0 ? e.toward - v : v - e.toward
        const empuje = porPaso(e.porSegundo, d.dt)
        let delta = falta < empuje ? falta : empuje
        if (delta <= 0) break
        if (e.poweredBy !== undefined) {
          const fuente = cuerpoDeRol(ligs, e.poweredBy.from)
          if (fuente === undefined) break
          const actualF = d.bodies.get(fuente.body.id)
          if (actualF === undefined) break
          const cap = qualityOf(actual.body, 'heatCapacity', d.phys)
          const efic = e.poweredBy.efficiency > 0 ? e.poweredBy.efficiency : 1
          const pedido = (cap > 0 ? cap : 1) * delta / efic
          const hay = qualityOf(actualF.body, e.poweredBy.q, d.phys)
          if (hay <= 0) break
          const pagado = hay < pedido ? hay : pedido
          delta = (pagado * efic) / (cap > 0 ? cap : 1)
          ponerCuerpo(d, {
            ...actualF,
            body: conCualidad(actualF.body, e.poweredBy.q, hay - pagado),
          })
          // El aliento que la fricción convirtió en calor. Es la tercera —y la
          // más grande— de las tres formas que tiene el mundo de bajar `stamina`,
          // y sin anotarla el invariante de las bajadas acusaría de evaporación a
          // una criatura que estaba frotando un palo.
          anotarGasto(d, e.poweredBy.q, pagado)
        }
        const despues = d.bodies.get(actual.body.id) ?? actual
        ponerCuerpo(d, { ...despues, body: conCualidad(despues.body, e.q, v + rumbo * delta) })
        // EL EMPUJE QUEDA ANOTADO PARA LAS LEYES (ADR II-0010). Va acá abajo y no
        // arriba del `if` a propósito: se anota lo que se MOVIÓ, no lo que se
        // quiso mover. Un `drive` que no encontró con qué pagar —`delta <= 0`, o
        // `hay <= 0`— ya salió por un `break` y no anota nada, así que la ley 1
        // relaja normal: la mano que no puede no suspende nada.
        anotarEmpuje(d, despues.body.id, e.q, rumbo)
        break
      }
      case 'transfer': {
        const de = cuerpoDeRol(ligs, e.from)
        const a = cuerpoDeRol(ligs, e.to)
        if (de === undefined || a === undefined) break
        const cd = d.bodies.get(de.body.id)
        const ca = d.bodies.get(a.body.id)
        if (cd === undefined || ca === undefined) break
        const hay = qualityOf(cd.body, e.q, d.phys)
        const mover = porPaso(e.porSegundo, d.dt)
        const mueve = hay < mover ? hay : mover
        if (mueve <= 0) break
        ponerCuerpo(d, { ...cd, body: conCualidad(cd.body, e.q, hay - mueve) })
        const cb = d.bodies.get(ca.body.id) ?? ca
        ponerCuerpo(d, {
          ...cb,
          body: conCualidad(cb.body, e.q, qualityOf(cb.body, e.q, d.phys) + mueve),
        })
        break
      }
      case 'couple': {
        const c = cuerpoDeRol(ligs, e.on)
        const seguido = cuerpoDeRol(ligs, e.follows.of)
        if (c === undefined || seguido === undefined) break
        const actual = d.bodies.get(c.body.id)
        if (actual === undefined) break
        const v = qualityOf(seguido.body, e.follows.q, d.phys)
        // El acople inverso es el ESPEJO dentro del rango declarado, no `-v`:
        // una cualidad con rango [0,1] no tiene valores negativos que espejar.
        ponerCuerpo(d, { ...actual, body: conCualidad(actual.body, e.q, e.follows.inverse === true ? espejo(e.follows.q, v) : v) })
        break
      }
    }
  }
}

/**
 * Anota que alguien está empujando esta cualidad de este cuerpo, en este tick.
 *
 * Idempotente por par `(cuerpo, cualidad, rumbo)`: dos actores frotando el mismo
 * palo anotan un solo empuje, y tienen que anotar uno solo — la regla del ADR
 * II-0010 no es «cuánto», es «para dónde», y dos manos que empujan al mismo lado
 * no suspenden más que una. Si empujaran en sentidos OPUESTOS quedan las dos
 * anotadas y la ley 1 no se mueve para ninguno de los dos lados, que es la
 * lectura literal de la regla y también la única que no depende del orden.
 */
function anotarEmpuje(d: Borrador, id: BodyId, q: QualityId, rumbo: number): void {
  let m = d.empujes
  if (m === undefined) {
    m = new Map()
    d.empujes = m
  }
  const r: 1 | -1 = rumbo > 0 ? 1 : -1
  const lista = m.get(id)
  if (lista === undefined) {
    m.set(id, [{ q, rumbo: r }])
    return
  }
  for (const x of lista) if (x.q === q && x.rumbo === r) return
  lista.push({ q, rumbo: r })
}

function espejo(q: QualityId, v: number): number {
  // `clampToRange` ya conoce el rango; se lo pide dos veces y se arma el espejo
  // con los extremos que él mismo devuelve para los infinitos.
  const lo = clampToRange(q, Number.NEGATIVE_INFINITY)
  const hi = clampToRange(q, Number.POSITIVE_INFINITY)
  return lo + hi - v
}

/**
 * Dónde puede caer algo que acaba de nacer: en la mano, o en una celda libre.
 *
 * `undefined` significa «no hay dónde», y es una respuesta legítima: la mano
 * llena y el suelo ocupado son un mundo que no tiene lugar para una cosa más.
 * Devolver la celda del actor igual sería inventar una celda con dos sólidos, que
 * es la mitad de una bomba de materia — el cuerpo queda ahí, invisible para
 * cualquier cosa que recorra el suelo.
 */
function destinoDeUnNacido(
  d: Borrador,
  a: Actor,
  cerca: Placement,
): { readonly mano: true } | { readonly mano: false; readonly at: Placement } | undefined {
  const actual = d.actors.get(a.id) ?? a
  if (actual.holding.length < actual.capacity) return { mano: true }
  const libre = celdaLibreCerca(d, cerca, '')
  return libre === undefined ? undefined : { mano: false, at: libre }
}

function guardar(
  d: Borrador,
  a: Actor,
  body: Body,
  donde: { readonly mano: true } | { readonly mano: false; readonly at: Placement },
): void {
  const actual = d.actors.get(a.id) ?? a
  if (donde.mano) {
    const at = d.bodies.get(a.body)?.at ?? { x: 0, y: 0 }
    ponerCuerpo(d, { body, at, heldBy: a.id })
    d.actors.set(a.id, { ...actual, holding: [...actual.holding, body.id] })
    return
  }
  ponerCuerpo(d, { body, at: donde.at })
}

/**
 * Los rendimientos del `completion`. Ninguno inventa masa: todos la mueven.
 *
 * NO recibe la intención, y no hace falta que la reciba: los cuatro eventos que
 * empuja salen SIN `seq` y `firmar` les pone el de la intención que está en curso,
 * que es la única que puede haber llegado hasta acá. Antes escribían `seq: -1`
 * —un número mágico que decía contestarle a una intención que nadie emitió— y el
 * rechazo del rendimiento se perdía: el `apply` salía «completo», el emisor no se
 * enteraba de que la hebra no había tenido dónde caer, y el −1 no le correspondía
 * a nada. Está clavado en `tests/correlacion.test.ts`.
 */
function rendir(d: Borrador, a: Actor, y: Yield, ligs: readonly Ligadura[]): void {
  switch (y.k) {
    case 'join': {
      const ca = cuerpoDeRol(ligs, y.a)
      const cbinder = cuerpoDeRol(ligs, y.via)
      if (ca === undefined || cbinder === undefined) return
      const cb = y.b === undefined ? undefined : cuerpoDeRol(ligs, y.b)
      const id = nuevoId(d)
      const nuevo = unir(ca.body, cb?.body, cbinder.body, d.phys, id)
      if (nuevo === undefined) return
      // Primero se sacan las piezas —del mundo y de las manos— y RECIÉN DESPUÉS
      // se busca dónde va el ensamble. Al revés, la caña no entraría en la mano
      // que acaba de dejar libre la vara con la que se hizo.
      const enMano = a.holding.includes(ca.body.id)
      sacarCuerpo(d, ca.body.id)
      if (cb !== undefined) sacarCuerpo(d, cb.body.id)
      sacarCuerpo(d, cbinder.body.id)
      const previo = d.actors.get(a.id) ?? a
      d.actors.set(a.id, {
        ...previo,
        holding: previo.holding.filter(
          (x) => x !== ca.body.id && x !== cbinder.body.id && x !== cb?.body.id,
        ),
      })
      const donde = enMano
        ? destinoDeUnNacido(d, a, ca.at)
        : ({ mano: false, at: ca.at } as const)
      if (donde === undefined) return
      guardar(d, a, { ...nuevo, madeBy: a.id }, donde)
      d.events.push({ k: 'nacio', by: a.id, id, por: 'rendimiento' })
      return
    }
    case 'split': {
      const c = cuerpoDeRol(ligs, y.role)
      if (c === undefined) return
      const actual = d.bodies.get(c.body.id)
      if (actual === undefined) return
      // Se busca dónde va a caer ANTES de partir: si no hay lugar, no se parte.
      // Partir primero y no saber dónde poner el pedazo sería materia sin celda.
      const donde = destinoDeUnNacido(d, a, actual.at)
      if (donde === undefined) {
        d.events.push({ k: 'rechazada', by: a.id, que: 'apply', por: 'celda-ocupada' })
        return
      }
      const hijo = partir(d, actual.body, y.at)
      if (hijo === undefined) return
      ponerCuerpo(d, { ...actual, body: hijo.resto })
      guardar(d, a, { ...hijo.parte, madeBy: a.id }, donde)
      d.events.push({ k: 'nacio', by: a.id, id: hijo.parte.id, por: 'rendimiento' })
      return
    }
    case 'drawFromStock':
      sacarDelPozo(d, a, y.of, ligs)
      return
    case 'transmute':
      // La transmutación de la ley 4 la hace `paso()` sola, cuando el carbonizado
      // pasa su umbral; ningún proceso semilla la rinde. Un `transmute` escrito
      // por el modelo entraría por acá, y no está: rendir algo a medias sería
      // peor que decir que no está hecho.
      d.events.push({ k: 'rechazada', by: a.id, que: 'apply', por: 'no-implementado' })
      return
  }
}

// ─── Sacar del pozo ──────────────────────────────────────────────────────────

/**
 * EL APAREJO: el cuerpo ligado que más engancha, sin nombrar ningún rol.
 *
 * `Yield.drawFromStock` nombra el rol del que se saca (`of`) y **no nombra el del
 * aparejo**, así que había dos caminos: escribir `'gear'` acá adentro —el nombre
 * que usa `EXTRACCION`, o sea meter el catálogo semilla adentro del motor— o
 * preguntarle a la física cuál de los cuerpos ligados engancha. Es lo segundo, y
 * no por elegancia: el día que el modelo escriba un proceso que saque de un stock
 * con un rol llamado `red` o `arpon`, con la primera opción el aparejo sería
 * `undefined` y **la extracción rendiría igual, con probabilidad cero, para
 * siempre**. Un motor que sólo funciona con los nombres de la semilla no es un
 * motor.
 *
 * El empate lo rompe el id, que es la misma regla de `entornoDe` con dos fogatas
 * iguales: quedarse con «el primero que apareció» haría que el resultado
 * dependiera del orden de las ligaduras.
 */
function aparejoDe(d: Borrador, ligs: readonly Ligadura[], salvo: string): WorldBody | undefined {
  let mejor: WorldBody | undefined
  let mejorCatch = 0
  for (const l of ligs) {
    if (l.cuerpo === undefined) continue
    if (baseRoleName(l.role.name) === baseRoleName(salvo)) continue
    const engancha = qualityOf(l.cuerpo.body, 'catch', d.phys)
    if (engancha <= 0) continue
    if (
      mejor === undefined ||
      engancha > mejorCatch ||
      (engancha === mejorCatch && compararTexto(l.cuerpo.body.id, mejor.body.id) < 0)
    ) {
      mejor = l.cuerpo
      mejorCatch = engancha
    }
  }
  return mejor
}

/** El stock de este banco: el que el tick ya tocó, el que el mundo guardó, o el
 *  que decreta el dios. En ese orden, que es de lo más nuevo a lo más viejo. */
function stockDe(d: Borrador, banco: WorldBody): Stock | undefined {
  if (d.dios === undefined) return undefined
  const tocado = indiceDePozos(d).get(banco.body.id)
  if (tocado !== undefined) return tocado
  const cx = chunkCoord(banco.at.x)
  const cy = chunkCoord(banco.at.y)
  // Sólo cuenta si el banco ES el del chunk donde está: si no, cualquier cuerpo
  // parado sobre un pozo sería un pozo.
  if (banco.body.id !== idDePozo(cx, cy)) return undefined
  return decretoDe(d.dios, d.phys, cx, cy).pozo?.stock
}

/**
 * SACAR UNA PIEZA DEL POZO. La costura entera, en una función.
 *
 * Antes de esto había **dos extracciones y sólo una cobraba**: este camino
 * escalaba la masa del cuerpo por un `MASA_POR_EXTRACCION` fijo de 0,5 y no tocaba
 * ni el stock, ni la población, ni el libro calórico; el otro —`draw`, del
 * oráculo— hacía las tres cosas y en la partida no lo recorría nadie. Las
 * consecuencias eran dos, y las dos matan el Hito 5:
 *
 *   - **el techo calórico era código muerto**. Medido al 100,00% sobre 314 chunks
 *     en el arnés del dios, y cobrado en un camino que la partida no pisaba.
 *   - **`catch` no rendía**. El rol `gear` pedía `catch > 0` y después salían 0,5
 *     kg fijos, así que **un anzuelo de pedernal rendía exactamente igual que una
 *     caña pelada**. Una conducta que no paga no la aprende nadie ni la puede
 *     distinguir un juez, y el criterio de emergencia del Hito 5 es justamente un
 *     juez que tiene que poder distinguirla.
 *
 * Ahora hay una sola extracción y es la del dios. Lo que aporta este lado es lo
 * que el dios no puede hacer: encontrar el pozo, tener el dado, y meter la pieza
 * en una mano.
 *
 * ─── Los cuatro finales, todos narrados ─────────────────────────────────────
 *
 * `draw` distingue cuatro razones y las cuatro salen como `rechazada` con motivo
 * propio. Que el `apply` salga «completo» y ADEMÁS haya un rechazo no es una
 * contradicción: el proceso se completó —la criatura tiró la caña los 1,5
 * segundos— y el rendimiento no dio nada. Es exactamente el caso que `rendir`
 * documenta y que `tests/correlacion.test.ts` clava.
 */
function sacarDelPozo(d: Borrador, a: Actor, rol: string, ligs: readonly Ligadura[]): void {
  const c = cuerpoDeRol(ligs, rol)
  if (c === undefined) return
  const banco = d.bodies.get(c.body.id)
  if (banco === undefined) return
  const stock = stockDe(d, banco)
  if (stock === undefined || d.dios === undefined) {
    d.events.push({ k: 'rechazada', by: a.id, que: 'apply', por: 'sin-pozo' })
    return
  }
  const aparejo = aparejoDe(d, ligs, rol)
  if (aparejo === undefined) {
    // Sin nada que enganche la probabilidad es cero por definición, y `draw`
    // tiraría el dado igual para descubrirlo. Cortar acá es lo mismo que dice el
    // encabezado de `draw` sobre el pozo vacío: no hay resultado posible que
    // valga una tirada, y una tirada de más corre la partida entera.
    d.events.push({ k: 'rechazada', by: a.id, que: 'apply', por: 'no-pico' })
    return
  }

  // El clon es obligatorio: `retirarUno` MUTA el stock. Sin él, `stepWorld`
  // estaría escribiendo adentro del `WorldState` de entrada y el replay dejaría
  // de reproducir — la garantía que sostiene todo el paquete.
  const mio: Stock = { ...stock }
  if (d.dado === undefined) d.dado = dadoDe(d.dios)
  if (d.libro === undefined) d.libro = libroDe(d.dios)
  const r = draw({ phys: d.phys, rng: d.dado.tirar, calorias: d.libro }, mio, aparejo.body, d.segundos)

  if (r.yields === null) {
    // El stock se guarda igual cuando NO salió nada, y no es un descuido:
    // `retirarUno` no lo tocó, así que `mio` es idéntico a `stock` y guardarlo es
    // gratis; lo que no es gratis es haber TIRADO el dado, y eso ya quedó en
    // `d.dado`, que `cerrar` lee. Lo que sí importa: la marca de reposición no se
    // re-ancla en un intento fallido, o el río se repondría más lento cuanto más
    // lo intentaran (ver `draw`).
    d.events.push({
      k: 'rechazada',
      by: a.id,
      que: 'apply',
      por: r.razon === 'vacio' ? 'pozo-vacio' : r.razon === 'sin-presupuesto' ? 'sin-presupuesto' : 'no-pico',
    })
    return
  }

  const cuna = d.bodies.get(a.body)?.at ?? banco.at
  const donde = destinoDeUnNacido(d, a, cuna)
  if (donde === undefined) {
    // No hay dónde ponerla. El stock YA bajó y el chunk YA pagó, y eso es lo
    // correcto aunque duela: la pieza salió del agua. Se la deja caer al agua de
    // vuelta sería inventar una devolución que el dios no tiene —`retirarUno` no
    // se puede deshacer sin re-anclar la marca, o sea sin regalar reposición— así
    // que lo que se pierde es la pieza, no la contabilidad.
    indiceDePozos(d).set(banco.body.id, mio)
    d.pozosTocados = true
    d.events.push({ k: 'rechazada', by: a.id, que: 'apply', por: 'celda-ocupada' })
    return
  }
  const sacado: Body = {
    id: nuevoId(d),
    form: 'bloque',
    parts: [{ substance: r.yields, mass: unfx(r.masa), q: {} }],
    joints: [],
    state: {},
  }
  indiceDePozos(d).set(banco.body.id, mio)
  d.pozosTocados = true
  // Y el banco encoge con su población: `process.ts` ya lo había escrito —«un
  // banco de peces es un cuerpo con masa, y cuando se lo vaciaron la masa es
  // cero»— y es lo que hace que un pozo agotado deje de cumplir el rol `source`
  // sin que nadie escriba una regla de «pozo vacío».
  ponerCuerpo(d, { ...banco, body: cuerpoDePozo(banco.body.id, mio, population(mio, d.segundos)) })
  guardar(d, a, sacado, donde)
  d.events.push({ k: 'nacio', by: a.id, id: sacado.id, por: 'rendimiento' })
}

/**
 * Partir un cuerpo. Es la mitad de `split` que conserva materia: lo que sale
 * tiene la masa que lo que queda perdió, ni un gramo más.
 */
function partir(
  d: Borrador,
  b: Body,
  donde: 'joint' | 'grain',
): { resto: Body; parte: Body } | undefined {
  const masa = masaDe(b, d.phys)
  if (masa <= 0) return undefined
  if (donde === 'grain') {
    // A favor del grano: sale una hebra, que es una fracción de la misma materia.
    const f = FRACCION_DE_HEBRA
    const parte: Body = { ...escalarMasa(b, f), id: nuevoId(d), form: 'hebra', joints: [] }
    return { resto: escalarMasa(b, 1 - f), parte }
  }
  // Por la junta: se recupera la ÚLTIMA parte atada, que es la que se agregó
  // último. Romper el ensamble para recuperar la vara es una conducta esperada.
  if (b.parts.length < 2 || b.joints.length === 0) return undefined
  const ultima = b.parts[b.parts.length - 1]!
  const resto: Body = {
    ...b,
    parts: b.parts.slice(0, -1),
    joints: b.joints.filter((j) => j.a < b.parts.length - 1 && j.b < b.parts.length - 1),
  }
  const parte: Body = {
    id: nuevoId(d),
    form: b.form,
    parts: [ultima],
    joints: [],
    state: {},
  }
  return { resto, parte }
}

// ─── La espera, que dura ─────────────────────────────────────────────────────
//
// `wait.segundos` no significaba nada: el despacho empujaba un `espero` y se
// terminaba ahí, así que `wait(30)` y `wait(0.05)` hacían exactamente lo mismo —un
// tick— y esperar media hora de mundo era imposible de escribir. Esperar es un
// concepto de RITMO (ADR II-0008): dos segundos son dos segundos a 20 Hz y a
// 100 Hz, y lo único que cambia es en cuántas muestras se parten.

/**
 * Abre la espera, o continúa la que ya estaba.
 *
 * ─── Continuar en vez de reiniciar ──────────────────────────────────────────
 *
 * Una habilidad puede emitir `wait(2)` UNA vez y callarse —es el uso previsto—, o
 * reemitirlo todos los ticks, que es lo que hace quien no sabe que el mundo se
 * acuerda. Si reemitir reiniciara la cuenta, lo segundo no terminaría NUNCA: la
 * espera se reiniciaría veinte veces por segundo. Así que un `wait` con el mismo
 * pedido que la espera abierta la CONTINÚA, que es la misma regla que ya usa
 * `intencionAplicar` para la actividad («es la misma: mismo proceso y mismos
 * cuerpos»). Lo que sí se actualiza es el `seq`: quien acaba de preguntar es quien
 * quiere la respuesta.
 *
 * Un `wait` con OTRO pedido abre una espera nueva desde cero, y eso también es lo
 * que hay que hacer: cambiar de «esperá dos segundos» a «esperá treinta» es una
 * decisión nueva, no la continuación de la anterior.
 *
 * ─── Un pedido que no es un número ──────────────────────────────────────────
 *
 * `wait(NaN)` y `wait(Infinity)` no se rechazan: se tratan como `wait(0)`, o sea
 * un tick, que es lo que hacía el mundo con CUALQUIER `wait` hasta hoy. Guardar un
 * `NaN` en la `Espera` sería peor que un tick de menos — el `NaN` entra al `Actor`,
 * el `Actor` entra en `hashWorldState`, y `hashWorld` LANZA ante un número no
 * finito: una habilidad hostil podría dejar el mundo sin hash con una línea.
 */
function esperar(d: Borrador, a: Actor, i: Intent & { k: 'wait' }): void {
  const pedido = seg(Number.isFinite(i.segundos) && i.segundos > 0 ? i.segundos : 0)
  const actual = d.actors.get(a.id) ?? a
  const previa = actual.esperando
  const abierta: Espera =
    previa !== undefined && previa.pedido === pedido
      ? { ...previa, seq: i.seq }
      : { pedido, segundos: seg(0), seq: i.seq }
  d.actors.set(a.id, { ...actual, esperando: abierta })
}

/**
 * Un paso de todas las esperas abiertas. Corre UNA vez por tick, después de las
 * intenciones.
 *
 * ─── Por qué no está en `SISTEMAS` ──────────────────────────────────────────
 *
 * Porque no es una ley de la materia: es la segunda mitad de la fase de las
 * intenciones. Lo que emite son RESPUESTAS —firmadas, con el `seq` de un `wait`
 * que se emitió ticks atrás—, y los sistemas narran hechos del mundo que no le
 * contestan a nadie. Corre antes que las leyes por la misma razón que las
 * intenciones corren antes que las leyes: la criatura actúa sobre el mundo que
 * vio, no sobre el que quedó después de que la física se moviera.
 *
 * ─── Un solo lugar donde se cuenta el tiempo ────────────────────────────────
 *
 * El `sumarPaso` está acá y en ningún otro lado, ni siquiera en el tick en que la
 * espera se abre. Contarlo también en el despacho haría que la espera pedida en el
 * mismo tick en que se la reemite avanzara el doble, y el error sería de un tick
 * por reemisión: invisible en un test de cuarenta ticks y de medio segundo en uno
 * de veinte mil.
 */
function avanzarEsperas(d: Borrador): void {
  for (const a of d.actors.values()) {
    const e = a.esperando
    if (e === undefined) continue
    const segundos = sumarPaso(e.segundos, d.dt)
    // La misma comparación que `intencionAplicar` hace contra `completion.at`, y
    // por la misma razón: los dos lados son múltiplos exactos de 10⁻⁶ —`sumarPaso`
    // acumula en micros enteros— así que `>=` es exacto y no hay que restar nada.
    // Restar sí traería ruido: `2 − 1,95` en doubles da 0,050000000000000044.
    if (segundos >= e.pedido) {
      // Se cierra ANTES de narrar: el que preguntó recibe `espero` y en el estado
      // que sale ya no está esperando, así que el tick que viene puede pedir otra
      // cosa sin que nada se le cancele por su cuenta.
      d.actors.set(a.id, sinEspera(a))
      d.events.push({ k: 'espero', by: a.id, seq: e.seq })
      continue
    }
    d.actors.set(a.id, { ...a, esperando: { ...e, segundos } })
    d.events.push({ k: 'esperando', by: a.id, seq: e.seq, segundos })
  }
}

/** Sin la espera. Destructurando, como `quitarActividad`: con
 *  `exactOptionalPropertyTypes` un `esperando: undefined` no es lo mismo que no
 *  tener la clave, y la clave presente viajaría hasta la ranura del snapshot. */
function sinEspera(a: Actor): Actor {
  const { esperando: _descartada, ...resto } = a
  return resto
}

// ─── El despacho de una intención ────────────────────────────────────────────

function despachar(d: Borrador, a: Actor, i: Intent): void {
  // CUALQUIER otra cosa corta la espera. Es la contracara de que esperar sobreviva
  // al silencio: la espera se pierde cuando el actor gasta su turno en otra cosa,
  // y no cuando no hace nada. Va acá y no en cada `intencionX` porque vale hasta
  // para las que terminan rechazadas: el que intentó agarrar algo y no llegó ya
  // dejó de esperar, decidió otra cosa. Las que se rechazan en el portón —mal
  // declarado, sin permiso, actor desconocido— ni siquiera llegan hasta acá, y
  // está bien: ésas no son actos.
  if (i.k !== 'wait') {
    const actual = d.actors.get(i.by)
    if (actual?.esperando !== undefined) d.actors.set(i.by, sinEspera(actual))
  }
  switch (i.k) {
    case 'wait':
      esperar(d, a, i)
      return
    case 'goTo':
      intencionCaminar(d, a, i)
      return
    case 'explore':
      intencionExplorar(d, a, i)
      return
    case 'take':
      intencionTomar(d, a, i)
      return
    case 'drop':
      intencionSoltar(d, a, i)
      return
    case 'put':
      intencionPoner(d, a, i)
      return
    case 'eat':
      intencionComer(d, a, i)
      return
    case 'apply':
      intencionAplicar(d, a, i)
      return
    case 'place':
      // Las obras son el ADR 0032 de Ánima I y no existen todavía en Ánima II.
      // Rechazar con nombre es mejor que fingir: una habilidad que las use se
      // entera hoy, no el día que alguien note que no pasaba nada.
      rechazo(d, i, 'no-implementado')
      return
  }
}

// ─── Los sistemas ────────────────────────────────────────────────────────────

/**
 * Las doce leyes, sobre cada cuerpo, en orden canónico de id.
 *
 * El orden importa aunque `paso()` sea independiente por cuerpo: cuando la ley 4
 * transmuta, da de alta una sustancia NUEVA en la `Physics`, y el orden en que se
 * dan de alta es parte del estado. Recorrer un `Map` en orden de inserción haría
 * que dos mundos que llegaron al mismo estado por caminos distintos registraran
 * las sustancias en distinto orden.
 *
 * COSTO MEDIDO, y hay que decirlo porque es el criterio del Hito 2: `paso()` sobre
 * 5000 cuerpos cuesta ~41 ms en esta máquina, y el techo del criterio es 4 ms.
 * El grueso no está acá: `paso()` llama a `leer()` cinco veces y cada `leer()` son
 * doce `qualityOf`, o sea unas sesenta lecturas por cuerpo y por tick; medido
 * aparte, un solo `leer()` sobre los 5000 ya cuesta 6,4 ms. El techo no se alcanza
 * bajando el costo del bucle sino el de `qualityOf`, y eso es trabajo dentro de
 * `@anima/physics`. Está clavado con números en `tests/banco.test.ts`.
 */
function sistemaLeyes(d: Borrador): void {
  const fs = fuentes(d)
  const ocl = oclusiones(d)
  const nuevas: Substance[] = []
  // Se recorre el `Map` en vivo y no una copia: este bucle solo REEMPLAZA claves
  // que ya existen —ningún cuerpo nace ni muere por una ley que no sea la 4, y la
  // 4 solo cambia la sustancia de sus partes—, y reemplazar una clave existente
  // durante la iteración de un `Map` está especificado y es seguro. Copiar el
  // arreglo serían 5000 punteros más por tick, y el tick tiene cuatro
  // milisegundos.
  // Los cuerpos a los que la ley 4 les cambió la materia. Si alguno de ellos es
  // el cuerpo de una criatura, esa criatura se quemó del todo. Ver abajo.
  let transmutados: Set<BodyId> | undefined
  for (const c of d.bodies.values()) {
    const r = paso(c.body, entornoDe(d, c, fs, ocl), d.phys, d.dt)
    if (r.body !== c.body) d.bodies.set(c.body.id, { ...c, body: r.body })
    if (r.nueva !== undefined) {
      nuevas.push(r.nueva)
      if (transmutados === undefined) transmutados = new Set<BodyId>()
      transmutados.add(c.body.id)
    }
  }
  for (const s of nuevas) {
    d.phys = conSustancia(d.phys, s)
    d.events.push({ k: 'sustancia', id: s.id })
  }
  if (transmutados !== undefined) quemarVivas(d, transmutados)
}

/**
 * LA SEGUNDA MUERTE DEL MUNDO: la que se quemó del todo.
 *
 * Una criatura cuyo cuerpo la ley 4 acaba de transmutar ya no es una criatura: lo
 * que queda de ella es residuo mineral o un tizón. Que siguiera en `actors` sería
 * una ceniza caminando con una caña en la mano.
 *
 * ─── Por qué no alcanzaba con dejarla morir de hambre ───────────────────────
 *
 * Porque no se moría de hambre: se moría porque la ley 4 le BORRABA la `stamina`
 * al cambiarle la materia —949,70 → 0,00 en un tick, medido— y el metabolismo
 * encontraba el cero medio segundo después. El evento decía `por: 'hambre'` con
 * casi mil de stamina el tick anterior, y ningún invariante veía nada. Arreglar
 * `loQueSobrevive` en `@anima/physics` sacó la mentira y dejó al descubierto lo
 * que la mentira tapaba: sin esto, la criatura hecha ceniza sobrevive.
 *
 * El cuerpo se queda donde cayó, igual que en la muerte por hambre: la materia no se
 * destruye, y la ceniza de una criatura es ceniza que sigue en el mundo.
 */
function quemarVivas(d: Borrador, transmutados: ReadonlySet<BodyId>): void {
  // La lista se junta antes de ejecutar nada, por lo mismo que en el metabolismo:
  // `morir` borra del `Map` que se estaría iterando. Sale en el orden canónico de
  // `actors`, así que quién suelta primero no lo decide nada del motor.
  const muertas: Actor[] = []
  for (const a of d.actors.values()) if (transmutados.has(a.body)) muertas.push(a)
  for (const a of muertas) morir(d, a, 'quemado')
}

/**
 * Estar vivo cuesta, y cuando no queda con qué pagar, se muere.
 *
 * `stamina` es conservada y no relaja: lo que se gasta no vuelve solo, y por eso
 * el hambre duele. Si volviera, el motor de toda la historia se apagaría en el
 * tick 300.
 *
 * ─── El costo va por SEGUNDO, no por tick (ADR II-0009) ─────────────────────
 *
 * `porPaso` es la misma y única conversión que `aplicarEfectos` hace veinte
 * líneas más arriba para las tasas de los procesos. Antes esta resta era la única
 * del mundo que se había quedado contando en ticks, y la consecuencia era que **la
 * frecuencia calibraba el hambre**: subir el muestreo de 20 a 100 Hz porque el
 * render se veía entrecortado dejaba a la criatura sin fuerzas cinco veces antes.
 * Es exactamente lo que el ADR II-0007 prohíbe con todas las letras.
 *
 * ─── Y llegar a cero MATA (ADR II-0009) ─────────────────────────────────────
 *
 * Antes acá había un `if (s <= 0) continue` y la criatura se quedaba congelada
 * para siempre: no podía caminar —`cobrarStamina` devolvía `false`— ni hacer nada
 * más, pero seguía en `actors`, seguía costando su vuelta del tick y se quedaba
 * con la caña en la mano hasta el final de los tiempos. Un mundo viejo se llenaba
 * de estatuas sosteniendo herramientas que nadie podía volver a usar. Y peor:
 * «sobrevive 20.000 ticks sola», el criterio del Hito 5, era trivialmente
 * verdadero — lo cumple una piedra.
 */
function sistemaMetabolismo(d: Borrador): void {
  const muertos: Actor[] = []
  for (const a of d.actors.values()) {
    const c = d.bodies.get(a.body)
    if (c === undefined) continue
    const s = qualityOf(c.body, 'stamina', d.phys)
    const cobro = porPaso(COSTO_VIVIR_POR_SEGUNDO, d.dt)
    const queda = s - cobro
    // Lo que se anota es lo que el cuerpo tenía para dar y no el precio de lista:
    // `conCualidad` topa en cero, así que a quien le quedaban 0,03 de stamina el
    // mundo le sacó 0,03 y no 0,05. Anotar el precio dejaría el piso del
    // invariante dos centésimas por debajo del real, todos los ticks, y esa deuda
    // se acumula hasta perdonar una evaporación entera.
    anotarGasto(d, 'stamina', s > cobro ? cobro : s)
    // `conCualidad` topa contra el rango declarado —`stamina` es `[0, 1000]` y
    // conservada—, así que lo que se guarda es 0 y no una deuda. La deuda se
    // descartó a propósito: lo negativo no es representable y hacerlo
    // representable cambiaría el contrato de una cualidad que leen otras diez
    // cosas, para modelar una idea que la muerte ya modela mejor.
    d.bodies.set(c.body.id, { ...c, body: conCualidad(c.body, 'stamina', queda) })
    if (queda <= 0) muertos.push(a)
  }
  // La lista se junta adentro del recorrido y se ejecuta afuera: `morir`
  // borra del mismo `Map` que se está iterando y además mueve cuerpos que otro
  // actor de este mismo bucle podría estar sosteniendo. `muertos` sale en el orden
  // canónico de `actors`, así que quién suelta primero no lo decide nada del
  // motor.
  for (const a of muertos) morir(d, a, 'hambre')
}

/**
 * MORIRSE, y el mundo dice de qué (ADR II-0009, decisión 3).
 *
 * El actor se va de `actors` y **el cuerpo se queda donde cayó**: la materia no
 * se destruye, y el cadáver de una criatura es carne con `nutrition`, o sea que la
 * que viene puede comerse a la que no llegó. Borrar el cuerpo habría sido tirar
 * comida además de tirar materia.
 *
 * `por` es un PARÁMETRO y no la constante `'hambre'` que era, y ésa es la mitad
 * del arreglo que se nota desde afuera: hay dos formas de morirse —quedarse sin
 * fuerzas y quemarse del todo— y hasta acá las dos salían con la misma palabra.
 * La crónica contaba que se murió de hambre una que se quemó viva.
 *
 * Soltar lo que tenía en la mano NO es opcional: `invariants.ts:258` emite
 * `referencia-colgada` en cuanto un `heldBy` nombra a un actor que ya no está en
 * el mapa. El detector estaba escrito antes de que existiera la muerte.
 *
 * Y el journal no necesita nada nuevo: las intenciones posteriores del muerto se
 * rechazan con `'actor-desconocido'`, que es un motivo que ya existía.
 */
function morir(d: Borrador, a: Actor, por: 'hambre' | 'quemado'): void {
  const mio = d.bodies.get(a.body)
  for (const id of a.holding) {
    const c = d.bodies.get(id)
    if (c === undefined) continue
    const { heldBy: _mano, ...suelto } = c
    // Cae donde caería si lo soltara viva: la primera celda libre a partir de la
    // suya, que es la que ya usa `intencionSoltar`. La propia no es libre —ahí
    // queda el cadáver, que es sólido— y dos sólidos sueltos en la misma celda son
    // un `solidos-solapados`.
    const desde = mio?.at ?? c.at
    const donde = celdaLibreCerca(d, desde, id)
    // Y si no hay ni una celda libre alrededor, queda APOYADO sobre el cadáver, que
    // es la única forma que el mundo tiene de poner dos sólidos en un lugar sin
    // mentir: una pila declarada, no un accidente de coordenadas.
    if (donde !== undefined) ponerCuerpo(d, { ...suelto, at: donde })
    else ponerCuerpo(d, { ...suelto, at: desde, supportedBy: a.body })
  }
  d.actors.delete(a.id)
  // El `id` es el del CUERPO y no el del actor, como en el `murio` de comer: lo
  // que el evento nombra es la cosa que quedó en el mundo. Y no lleva `by` ni
  // `seq` porque no lo causó ninguna intención.
  if (mio !== undefined) d.events.push({ k: 'murio', id: mio.body.id, por })
}

// ─── Materializar lo que el dios decretó ─────────────────────────────────────

/** Los nueve chunks alrededor del actor: el suyo y los ocho vecinos. Nueve y no
 *  uno porque **la orilla es casi siempre del chunk de al lado**: medido en el
 *  Hito 3, el 88,8% de los chunks de `agua-dulce` está enteramente inundado, así
 *  que quien pesca está parado en el chunk seco y el pozo está en el mojado. */
const NUEVE: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

/**
 * EL BANCO DE PECES ENTRA AL MUNDO, y se pone al día con su pozo.
 *
 * ─── Por qué corre ANTES de las intenciones y no es un sistema ──────────────
 *
 * Los `SISTEMAS` corren al final del tick, y esto tiene que correr al principio
 * por dos razones distintas:
 *
 *   1. **el banco tiene que existir cuando la intención lo nombra**. Una criatura
 *      que llega a la orilla y tira la caña en el mismo tick nombraría un cuerpo
 *      que no existe todavía, y el rechazo sería `cuerpo-desconocido` — o sea que
 *      pescar dependería de haber llegado un tick antes;
 *   2. **la masa tiene que estar al día cuando `cumpleRol` la juzga**. El rol
 *      `source` pide `mass > 0` y la masa del banco es `población × masa por
 *      pieza`. Si se resincronizara al final, un pozo que se repuso recién
 *      calificaría un tick tarde, y uno que se vació seguiría calificando un tick
 *      de más — y ese tick de más es una pieza que sale de un pozo vacío.
 *
 * ─── Por qué materializar acá NO rompe el determinismo ──────────────────────
 *
 * Los ids salen del LUGAR (`idDePozo`) y no del contador `nextId`, así que dos
 * partidas gemelas que exploraron el mismo mundo en distinto orden le ponen el
 * mismo nombre al mismo pozo. Lo que sí depende del camino es CUÁNTOS bancos hay
 * materializados, y eso es correcto y es la diferencia con el criterio del Hito 3:
 * allá lo que no puede cambiar el mundo es LEER el terreno —y no lo cambia, porque
 * el terreno no se copia a ningún lado—; acá lo que entra al mundo es un cuerpo, y
 * un mundo donde alguien ya llegó al río no es el mismo que uno donde no.
 */
function materializarPozos(d: Borrador): void {
  const dios = d.dios
  if (dios === undefined) return
  // El conjunto de chunks ya mirados en ESTE tick, con clave NUMÉRICA. Con clave
  // de texto la pasada armaba nueve cadenas por actor y por tick —45 000 cadenas
  // con 5000 criaturas, todas basura— y eso era la mitad de lo que costaba. Es la
  // misma `chunkKey` que usa la grilla: una sola forma de nombrar un chunk.
  const vistos = new Set<number>()
  for (const a of d.actors.values()) {
    const mio = d.bodies.get(a.body)
    if (mio === undefined) continue
    const acx = chunkCoord(mio.at.x)
    const acy = chunkCoord(mio.at.y)
    for (const [dx, dy] of NUEVE) {
      const cx = acx + dx
      const cy = acy + dy
      const clave = chunkKey(cx, cy)
      if (vistos.has(clave)) continue
      vistos.add(clave)
      const pozo = decretoDe(dios, d.phys, cx, cy).pozo
      if (pozo === undefined) continue
      const id = idDePozo(cx, cy)
      const stock = indiceDePozos(d).get(id) ?? pozo.stock
      const cuerpo = cuerpoDePozo(id, stock, population(stock, d.segundos))
      const habia = d.bodies.get(id)
      // Se reemplaza sólo si la masa se movió. Sin esta comparación, cada tick
      // reescribiría los bancos con un cuerpo nuevo y equivalente, y el snapshot
      // por delta —que compara IDENTIDADES— metería una ranura por banco en todos
      // los deltas de la partida para no decir nada.
      if (habia !== undefined && masaDe(habia.body, d.phys) === masaDe(cuerpo, d.phys)) continue
      ponerCuerpo(d, habia === undefined ? { body: cuerpo, at: pozo.at } : { ...habia, body: cuerpo })
    }
  }
}

/**
 * El registro de sistemas. Es una lista y no un `Set` ni un mapa por nombre: lo
 * único que importa de un sistema es CUÁNDO corre, y un contenedor sin orden
 * declarado es una divergencia esperando a que alguien agregue el sistema trece.
 */
export const SISTEMAS: readonly { readonly nombre: string; readonly correr: (d: Borrador) => void }[] =
  [
    { nombre: 'leyes', correr: sistemaLeyes },
    { nombre: 'metabolismo', correr: sistemaMetabolismo },
  ]

// ─── El paso ─────────────────────────────────────────────────────────────────

/**
 * Un tick de mundo. Puro: mismo estado y mismas intenciones, mismos bits, en
 * cualquier máquina y en cualquier motor de JavaScript.
 *
 * Lo que hace, en este orden y no en otro:
 *
 *   1. ordena las intenciones por id de actor y número de emisión — orden TOTAL;
 *   2. rechaza las que mienten sobre su compromiso o no tienen permiso;
 *   3. deja actuar a lo sumo una vez a cada actor, y FIRMA lo que cada una narró;
 *   4. avanza las esperas abiertas, que son intenciones de ticks anteriores que
 *      todavía están contestando;
 *   5. corre los sistemas registrados.
 *
 * El portón del punto 2 es lo que hace que dejar que un LLM escriba conducta sea
 * seguro: nada de lo que devuelve el modelo se ejecuta, el modelo PROPONE y el
 * mundo determinista valida y aplica.
 */
export function stepWorld(state: WorldState, intents: readonly Intent[]): StepOutcome {
  const d = abrir(state)
  // Lo que el dios decretó y todavía no estaba, ANTES de que nadie actúe. Ver
  // `materializarPozos`: sin esto, pescar dependería de haber llegado un tick
  // antes, y un pozo repuesto calificaría un tick tarde.
  materializarPozos(d)
  const ordenadas = ordenarIntenciones(intents)

  // ─── Los empates, marcados ANTES de despachar nada ────────────────────────
  //
  // Dos intenciones del mismo actor con el mismo número de emisión no tienen
  // orden entre sí, y el mundo no se lo inventa: las dos se rechazan y quien las
  // emitió se entera. Desempatarlas por dentro sería elegir con la estabilidad
  // del `sort`, que es exactamente lo que no puede decidir nada acá.
  //
  // Esta pasada previa existe porque la versión que detectaba el empate AL VUELO
  // no cumplía lo que decía. Con ella, la primera del par ya se había despachado
  // cuando aparecía la segunda: se movía, gastaba `stamina`, y recién entonces
  // las dos salían «rechazadas». O sea que el mundo dependía de CUÁL DE LAS DOS
  // LLEGÓ ANTES en el arreglo de entrada — y eso es justo lo que decide la
  // estabilidad del `sort` del motor, que ECMAScript garantiza desde 2019 pero
  // que acá no debería decidir nada porque el orden de llegada es el orden en que
  // contestaron las mentes. Lo encontró `tests/ataque-determinismo.test.ts`, y es
  // el único agujero de determinismo real que quedaba en el paso del mundo.
  const empatada = new Set<number>()
  for (let i = 1; i < ordenadas.length; i++) {
    const a = ordenadas[i - 1] as Intent
    const b = ordenadas[i] as Intent
    if (a.by === b.by && a.seq === b.seq) {
      empatada.add(i - 1)
      empatada.add(i)
    }
  }

  const yaActuo = new Set<ActorId>()
  for (let idx = 0; idx < ordenadas.length; idx++) {
    const i = ordenadas[idx] as Intent
    if (empatada.has(idx)) {
      rechazo(d, i, 'orden-duplicado')
      continue
    }

    const a = d.actors.get(i.by)
    if (a === undefined) {
      rechazo(d, i, 'actor-desconocido')
      continue
    }
    const mal = revisarCompromiso(i, d.phys, a.permits)
    if (mal !== undefined) {
      rechazo(
        d,
        i,
        mal.k === 'proceso-desconocido'
          ? 'proceso-desconocido'
          : mal.k === 'mal-declarado'
            ? 'compromiso-mal-declarado'
            : 'sin-permiso',
      )
      continue
    }
    // Un cuerpo tiene un turno por tick. Hablar no gasta turno porque hablar no
    // es una intención: es UI, y no debería costarle un tick al cuerpo.
    if (yaActuo.has(i.by)) {
      rechazo(d, i, 'ya-actuo')
      continue
    }
    yaActuo.add(i.by)
    // El corchete de la firma: todo lo que este despacho narre queda entre las dos
    // líneas, así que no hay que confiar en que cada `intencionX` se acuerde de
    // pasar el `seq` — y son ocho, más los cuatro rendimientos, más los que
    // vengan. Un contrato que depende de que doce lugares no se olviden no es un
    // contrato.
    const desde = d.events.length
    despachar(d, a, i)
    firmar(d, i, desde)
  }

  // Quien no actuó pierde la actividad en curso. Frotar es frotar todos los
  // ticks: si se distrae, el palo se enfría solo por la ley 1 y hay que empezar
  // de nuevo. Sin esto, una actividad quedaría acumulando ticks sin que nadie la
  // esté haciendo.
  //
  // LA ESPERA NO ENTRA ACÁ, y es la diferencia entera entre las dos: el que espera
  // no emite nada, así que si la espera se perdiera por no actuar, esperar sería
  // imposible. Se pierde de la otra forma, en `despachar`: cuando el actor gasta
  // el turno en otra cosa.
  for (const a of d.actors.values()) {
    if (a.doing !== undefined && !yaActuo.has(a.id)) d.actors.set(a.id, quitarActividad(a))
  }

  // La segunda mitad de la fase de las intenciones: las respuestas que salen sin
  // que nadie haya preguntado en ESTE tick. Ver `avanzarEsperas` para por qué no
  // es un sistema.
  avanzarEsperas(d)

  for (const s of SISTEMAS) s.correr(d)

  // El libro del tick, narrado. Va DESPUÉS de los sistemas porque el metabolismo
  // es el último que cobra, y va en el orden de
  // `CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO` y no en el de inserción del `Map`: dos
  // mundos gemelos que gastaron lo mismo por caminos distintos tienen que narrar
  // los mismos eventos en el mismo orden, o el replay deja de valer.
  const libro = d.gastado
  if (libro !== undefined) {
    for (const q of CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO) {
      const cuanto = libro.get(q)
      if (cuanto !== undefined && cuanto > 0) d.events.push({ k: 'gasto', q, cuanto })
    }
  }
  return cerrar(d)
}

/**
 * Le pone a cada evento del despacho la firma de la intención que lo causó.
 *
 * Firma lo que se agregó entre `desde` y el final, y nada más: los eventos de los
 * despachos anteriores ya están firmados y los de los sistemas todavía no
 * existen. Sobrescribe `by` además de poner `seq`, y eso no cambia nada —todo
 * despacho narra con el `a.id` del actor de la intención— pero deja una sola
 * verdad sobre quién firmó qué.
 *
 * La `Narracion` se saltea entera: `murio`, `sustancia` y `gasto` no le contestan
 * a nadie ni cuando ocurren en medio de un despacho. Comer mata un cuerpo, y el
 * que comió ya se entera por su `comio`, que dice cuál.
 */
function firmar(d: Borrador, i: Intent, desde: number): void {
  for (let n = desde; n < d.events.length; n++) {
    const e = d.events[n] as SimEventSinFirmar
    if (e.k === 'murio' || e.k === 'sustancia' || e.k === 'gasto') continue
    d.events[n] = { ...e, by: i.by, seq: i.seq }
  }
}
