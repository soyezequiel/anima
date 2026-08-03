// ─── @anima/mind/escalera.ts ─────────────────────────────────────────────────
//
// D0 A D5, CON CORTE AL PRIMERO QUE DECIDE. Es el peldaño donde el Hito 5 se
// gana o se pierde: si esto anda, hay criatura aunque el modelo nunca se conecte.
//
// Seis decisiones viven acá, y conviene leerlas antes que el código porque tres
// de ellas cambian la FORMA de lo que el andamio prometía.
//
// ─── 1. `decidir` LEE LA VISTA Y ESCRIBE EL ESTADO ──────────────────────────
//
// La firma es `decidir(v, e, o): Decision` y devuelve una `Decision` y nada más.
// Pero la escalera tiene que acordarse de tres cosas de un tick al otro y
// NINGUNA de las tres entra en una `Decision`:
//
//   · **la frontera de `plan()`**, que es lo que hace que D4 sea anytime de
//     verdad (`PlanResult` tiene la variante `parcial` justamente para eso);
//   · **desde cuándo sostiene la meta**, que es la mitad de la histéresis;
//   · **qué le falta del plan**, que es lo que hace que D1 cubra el grueso.
//
// O sea que el estado NO puede ser inmutable con la firma que el contrato fija:
// `decidir` lo escribe. Está dicho acá arriba y no escondido, y la consecuencia
// para el test de determinismo (requisito 7) es que «el mismo estado» se dice
// con `clonarEstado`, no con el mismo objeto.
//
// ─── 2. LO QUE LA ESCALERA EMITE NO ES UN `Step` ────────────────────────────
//
// `@anima/plan` lo dice con todas las letras: de las quince innatas, su `Step`
// cubre diez, y las cinco que faltan —`esperar`, `guarecerse`, `huirDelDolor`,
// `seguirOrdenDeMovimiento`, `tantear`— **son conducta y las emite la escalera
// de decisión, no la regresión**. Y el andamio escribía `Decision.volar.paso:
// Step`, o sea que D0 no podía huir y D5 no podía guarecerse: las dos conductas
// que el documento de arquitectura les pone en la fila.
//
// La reparación es `Intencion = Step | Conducta` en `tipos.ts`. `Conducta` tiene
// las DOS que esta escalera usa y ni una más —`huir` y `guarecerse`—, sin
// parámetros: los radios y los umbrales los pone cada innata por omisión, y
// escribirlos acá sería inventar números que ya existen en otro lado.
//
// ─── 3. `volar` Y `plan` QUIEREN DECIR «CORTÁ Y PONÉ ESTO» ──────────────────
//
// `Partida.volar` LANZA si el actor ya tiene una habilidad en vuelo —dos
// corridas del mismo actor emiten el mismo `seq` y `stepWorld` rechaza a las
// dos—, así que quien ejecute tiene que abortar antes, siempre. Que eso sea el
// contrato y no un descuido es lo que hace que un reflejo sea un reflejo: si
// `volar` NO implicara el corte, D0 tendría que gastar un tick en `abortar` y
// otro en huir, y la criatura se quemaría un tick más por una convención.
//
//   `seguir`   no toques nada.
//   `volar`    cortá lo que vuele y poné `paso`.
//   `plan`     lo mismo con `pasos[0]`; el resto ya se lo guardó la escalera.
//   `abortar`  cortá y no pongas nada.
//
// ─── 4. EL RELOJ DE LA MENTE LO LLEVA EL ESTADO ─────────────────────────────
//
// `PERMANENCIA_EN_TICKS` cuenta ticks y **la vista no publica ninguno**: medido,
// `VistaDelPlan` es `see/recall/q/qAt/self/clock` y `Clock` habla de segundos de
// mundo, no de índices de tick. Lo único que trae un número de tick es
// `PlaceMemory.atTick`, que es cuándo se vio un lugar y no qué hora es.
//
// Así que el tick lo lleva `EstadoDeLaEscalera.tick` y lo avanza `avanzarReloj`,
// una vez por tick, ANTES de decidir. Es la misma frontera que `RelojDePared` en
// `@anima/perceive`: el tiempo entra por parámetro y la lógica no lo puede pedir.
//
// ─── 5. EL MARGEN SÓLO PROTEGE CONTRA EL RUIDO DE LA MISMA MEDIDA ───────────
//
// `MARGEN_DE_HISTERESIS` es 0,15 y `Opportunity.valor` es `p·sat/costo`, que no
// está acotado arriba y está en aliento⁻¹; `Drive.peso` es un peso adimensional
// en [0,1]. **No son la misma escala y nadie midió la conversión.** Restarlas
// para ver si la diferencia llega a 0,15 sería inventar esa conversión.
//
// Entonces: el margen se aplica cuando el retador y el que manda salieron del
// MISMO peldaño; entre peldaños distintos el único amortiguador que significa
// algo es el tiempo, y la permanencia se aplica igual. Sin esto la histéresis
// sería una cuenta con unidades mezcladas, que es exactamente lo que el ADR
// II-0008 castiga un piso más abajo.
//
// ─── 6. EL DRIVE SE COMPARA CONTRA SU COMPLEMENTO ───────────────────────────
//
// `Drive.peso` está documentado como «cuánto vale contra lo que la criatura
// elegiría sola, en [0, 1]». Por la decisión 5 no se puede convertir a valor de
// oportunidad, así que lo que se compara es el peso contra lo que le queda a la
// criatura: `peso > 1 − peso`. Hoy eso es un umbral en 0,5 y hay que decirlo sin
// maquillaje —`peso` está funcionando como un booleano con decimales—; se afina
// el día que las dos escalas sean comparables, y hoy no lo son.
//
// Lo que SÍ es fino es la excepción, y sale del corpus: *«un swap cada 20 ticks
// salvo orden explícita»*. Una orden NUEVA —`drive.desdeTick` posterior a
// `e.desdeTick`— se saltea la permanencia. Hacer esperar ocho ticks al cuidador
// que acaba de hablar es la clase de obediencia que se lee como sordera.
//
// ─── 7. NO SE QUIERE LO QUE NINGÚN ESQUEMA SABE ESTABLECER ──────────────────
//
// El adversario lo midió y es de los que matan el hito: de los tres tags que el
// instinto puede querer, `plan()` sabe conseguir UNO. `holding(tag:vegetal)` y
// `holding(tag:fibroso)` contestan `gap` con `nearest` vacío y con el motivo
// «ningún esquema conocido establece …», **idéntico a 64 y a 4000 expansiones**.
// Y `planificar` estaba escrito para NO tirar la meta en ese caso, con un
// comentario que sólo vale para un `gap` de PAISAJE («D5 manda a deambular, la
// vista cambia, y la próxima búsqueda corre sobre otro paisaje»). Un `gap` de
// VOCABULARIO no lo arregla ningún paisaje: `SCHEMA_INDEX` es una tabla estática
// y `esquemasQueAportan` no mira la vista ni una vez.
//
// Medido sobre la MISMA escena con la que se declara el criterio de corte,
// cambiando sólo la `stamina` inicial de 310 a 1000: la criatura tomaba
// `holding(tag:vegetal)` en el tick 0 y no lo soltaba hasta el 12.000 de 20.000,
// con el pozo de pescado a UNA celda y sin emitir un solo paso.
//
// La reparación va en la ELECCIÓN y no en el fracaso, y ésa es la decisión: en
// vez de tomar la meta, descubrir que no se puede y tirarla —que dejaría a D3
// tomándola y tirándola un tick sí y otro también, porque `puedeCambiar` deja
// cambiar libremente cuando no hay meta en curso—, **D3 saltea las oportunidades
// que ninguna cadena de esquemas puede establecer** y `tomarMeta` se planta antes
// de escribir nada. La consecuencia es que el segundo cerrojo que el adversario
// temía —`valorEnCurso` envenenado por una meta que nunca se supo ejecutar— no
// llega a existir: esa meta nunca entra en curso.
//
// Y no se lee el `why` en prosa, que sería transcribir un mensaje de otro
// paquete: se lee la TABLA. Ver `sinVocabulario`.
//
// ─── 8. LA RUEDA DE D5 ES UNA MÁSCARA, NO UN PUNTERO ────────────────────────
//
// `fondoQueFallo` era UN índice y `elFondo` hacía `if (i === e.fondoQueFallo) i =
// (i + 1) % 3`. Con `refugio` arriba —que es lo normal desde media tarde hasta el
// amanecer, o sea tres cuartos del ciclo— el índice que la necesidad elige es
// SIEMPRE 0, así que el puntero rebotaba 0 → 1 → 0 → 1 y **nunca llegaba al 2**,
// que es `explorar`, la única de las tres que camina. Y las dos primeras no
// gastan un tick de mundo cuando no hay nada: `guarecerse` sin techo en radio y
// `juntar` sin candidatos se rinden sin ceder ninguna intención.
//
// Medido contra `stepWorld` en el páramo, 20.000 ticks: 13.645 de 16.823 ticks
// sin moverse, una racha de 3.992 ticks seguidos en la misma celda y VEINTICINCO
// celdas pisadas en un mundo infinito.
//
// La reparación es que lo que se recuerda deje de ser «cuál falló» y pase a ser
// «cuáles fallaron desde el último éxito»: tres bits en vez de un índice. Con las
// dos primeras marcadas la tercera sale sola, y cuando las tres fallan la cuenta
// se limpia y se vuelve a la que la necesidad pide.

import {
  CATALOGO_CORE,
  EXPANSIONES_POR_TICK,
  cumple,
  cumpleCuerpo,
  esquemasDe,
  firmaDe,
  implica,
  interpretar,
  pasoYaEstaHecho,
  plan,
  resolverCuerpo,
  type PlannerCatalogView,
} from '@anima/plan'
import { HZ_DE_REFERENCIA } from '@anima/physics'
import type { Frontera, GoalNode, Predicado, PredicateSignature, Ref, Step } from '@anima/plan'
import type { Where } from '@anima/skills'
import { CONTRATO_HUIR_DEL_DOLOR } from '@anima/skills/innatas'

import { porEpoch } from './catalogo.js'
import { necesidades } from './necesidades.js'
import { opportunities } from './oportunidades.js'
import type {
  AffordanceMemory,
  Conducta,
  ContextKey,
  Decision,
  Intencion,
  MenteOptions,
  NeedVector,
  Opportunity,
  Peldano,
  VistaDeLaMente,
} from './tipos.js'
import { MARGEN_DE_HISTERESIS, PERMANENCIA_EN_TICKS } from './tipos.js'

// ─── Los números, y de dónde sale cada uno ──────────────────────────────────

/**
 * EL CALOR QUE DUELE, leído del contrato de la innata que va a correr.
 *
 * `huir-del-dolor.ts` dice que su 60 °C «es una elección de este archivo» y que
 * no hay rango sano publicado para el cuerpo de la criatura. Es cableado, y ya
 * está cableado allá: escribirlo otra vez acá lo cablearía DOS veces, y el día
 * que alguien lo mueva la escalera dispararía en un umbral y la habilidad se
 * volvería con `done()` sin haber caminado, todos los ticks, para siempre.
 *
 * Así que se lee de `Contrato.establece`, que existe justamente para que lo que
 * una habilidad promete sea DATO y no comentario. Si la fila deja de estar, esto
 * lanza AL CARGAR el módulo: un reflejo que se apagó solo no se descubre nunca.
 */
const CALOR_QUE_DUELE = ((): number => {
  for (const p of CONTRATO_HUIR_DEL_DOLOR.establece) {
    if (p.sujeto === 'la-celda' && p.q === 'temperature' && p.op === '<') return p.v
  }
  throw new RangeError(
    '`CONTRATO_HUIR_DEL_DOLOR` ya no promete `la-celda.temperature < …`: D0 se quedó sin umbral',
  )
})()

// ─── El vocabulario del catálogo, leído UNA vez POR CATÁLOGO ────────────────

/**
 * TODO LO QUE LA TABLA DE ESQUEMAS SABE DEJAR ESTABLECIDO, ya interpretado.
 *
 * Sigue sin calcularse por tick, y por el mismo motivo de siempre:
 * `esquemasQueAportan` —el único lugar donde la regresión decide qué esquema
 * aplica a una cláusula— **no recibe la vista**, o sea que «este predicado tiene
 * esquema» es una propiedad de la TABLA y no del mundo, y se puede contestar sin
 * correr una búsqueda.
 *
 * Lo que cambió con el Gate 5→6 es la otra mitad de la frase vieja. Decía «no
 * cambia nunca: `ESQUEMAS` es una constante de `@anima/plan`», y eso deja de ser
 * cierto el día que hay overlay de sesión: **una capacidad registrada agrega
 * predicados establecibles**, y un vocabulario clavado al cargar vetaría como
 * imposible una meta que la criatura acaba de aprender a cumplir. Ahora se
 * recalcula cuando cambia el `catalogEpoch` y no más seguido que eso.
 */
const vocabularioDe = porEpoch((c: PlannerCatalogView): readonly Predicado[] => {
  const out: Predicado[] = []
  for (const e of esquemasDe(c)) {
    const p = interpretar(firmaDe(e.establishes))
    if (p !== undefined) out.push(p)
  }
  return out
})

/**
 * Si algún `establishes` del catálogo es CONJUNTIVO, o sea que `interpretar` no
 * lo sabe leer de una pieza.
 *
 * Hoy es `false` y está medido: las ocho firmas indexadas son de una sola
 * cláusula y las ocho interpretan. Pero el formato admite `'catch>0 & reach>=2'`
 * —lo dice `firmaDe`, que las parte y las ordena— y partirlas acá exigiría
 * transcribir el separador de otro paquete, que es la clase de segunda copia que
 * este repo castiga por nombre.
 *
 * Así que cuando aparezca una conjuntiva, `sinVocabulario` se APAGA entera y
 * contesta que todo se puede querer. Es el lado conservador a propósito: de los
 * dos errores posibles, dejar pasar una meta imposible cuesta una búsqueda por
 * tick, y vetar una meta posible cuesta que la criatura no la persiga NUNCA.
 */
const hayEstablecidasQueNoSeLeen = porEpoch(
  (c: PlannerCatalogView): boolean => vocabularioDe(c).length !== esquemasDe(c).length,
)

/**
 * SI NINGUNA CADENA DE ESQUEMAS PUEDE ESTABLECER ESTA META, NI HOY NI NUNCA.
 *
 * Es la decisión 7 del encabezado, hecha cuenta. Se pregunta por IMPLICACIÓN y
 * no por igualdad de texto —`implica` es la misma función con la que la
 * regresión decide si un esquema aporta— porque un esquema que deja
 * `temperature>=400` cubre un pedido de `temperature>=300`, y compararlos por
 * texto haría vetar una meta que el catálogo sabe cumplir.
 *
 * Y NO se lee el `why` que trae el `gap`, aunque ahí esté escrita la respuesta en
 * castellano: ese texto lo arma `porqueMurio` en `@anima/plan` para que el Hito 8
 * se lo lleve a la fragua, y reconocerlo desde acá sería cablear su formato. La
 * tabla es dato; la prosa es prosa.
 *
 * Lo que esto NO contesta, y hay que decirlo: que una meta TENGA esquema no
 * quiere decir que se pueda hacer hoy. `holding(tag:carnoso)` tiene esquema y en
 * un mundo sin nada rígido igual no sale. De ese caso se sigue encargando
 * `plan()`, que es quien mira el paisaje.
 */
export function sinVocabulario(meta: PredicateSignature, catalogo: PlannerCatalogView = CATALOGO_CORE): boolean {
  if (hayEstablecidasQueNoSeLeen(catalogo)) return false
  const p = interpretar(meta)
  // Una firma que el intérprete no lee no la puede establecer nadie: no hay con
  // qué compararla. `planificar` la tira igual, con motivo; acá se evita tomarla.
  if (p === undefined) return true
  for (const q of vocabularioDe(catalogo)) if (implica(q, p)) return false
  return true
}

/**
 * ¿ESTO SE CONSIGUE ESTIRANDO LA MANO? La otra mitad del portón, y mira el
 * PAISAJE en vez de la tabla.
 *
 * ─── POR QUÉ HACE FALTA UNA SEGUNDA PREGUNTA ──────────────────────────────
 *
 * `sinVocabulario` contesta mirando el catálogo de esquemas, y eso alcanzaba
 * mientras el catálogo fuera la lista completa de lo que se puede conseguir. Dejó
 * de serlo: la regresión aprendió a resolver un «tenerlo» caminando hasta algo
 * que ya lo cumple y agarrándolo (`agarrarLoQueYaHay`, en `plan/src/regresion.ts`),
 * y eso no es un esquema porque agarrar no transforma nada.
 *
 * ─── Y POR QUÉ NO ALCANZABA CON SACAR EL VETO, QUE FUE EL PRIMER INTENTO ──
 *
 * Se probó devolver `false` para todo `sostiene`, y el precio se midió en la
 * escena del ancla: con una brasa de 20 kg —no portable, o sea que **no hay nada
 * agarrable**— la criatura tomaba `holding(tag:vegetal)` igual, no encontraba
 * plan, y deambulaba persiguiéndola. O sea que pasaba a querer cosas que no puede
 * conseguir, que es exactamente lo que el veto existía para impedir.
 *
 * El veto era demasiado —vetaba también lo que la regresión sí sabe hacer— y
 * sacarlo entero es demasiado poco. Lo que corresponde es preguntarle a quien
 * tiene la respuesta: **si hay algo a la vista que ya lo cumpla, se puede
 * querer**; si no lo hay, sigue sin poder quererse y la escalera baja al peldaño
 * siguiente como toda la vida.
 *
 * Las tres condiciones son las mismas que usa el planificador para elegir qué
 * agarrar, y están escritas allá con lo que costó cada una: portable porque es lo
 * que el mundo exige para dejar levantar algo, no una fuente porque un pozo que
 * se mueve deja de ser un pozo, y no una criatura porque una criatura no es una
 * cosa.
 */
function seConsigueAgarrando(meta: PredicateSignature, v: VistaDeLaMente): boolean {
  const p = interpretar(meta)
  if (p === undefined || p.k !== 'sostiene') return false
  for (const b of v.see(p.tests ?? [])) {
    if (b.id === v.self.id || b.esFuente === true || b.esDeAlguien === true) continue
    if (!(v.q(b, 'portable') > 0)) continue
    if (cumpleCuerpo(p, b, (x, id) => v.q(x, id))) return true
  }
  return false
}

/**
 * Cuánto dura una conducta de fondo, en ticks. NO es un número nuevo: es
 * `PERMANENCIA_EN_TICKS`.
 *
 * Y la derivación importa porque los dos extremos se pagan. Una conducta de
 * fondo más larga que la permanencia le TAPA LA VISTA a la próxima decisión —D1
 * corta antes que D3, así que mientras deambula no mira oportunidades—; una más
 * corta gasta un tick de escalera por cada tick de camino. Ocho es exactamente
 * el ritmo con el que esta mente ya declaró que cambia de idea.
 */
const TICKS_DE_FONDO = PERMANENCIA_EN_TICKS

/** Lo que se junta cuando lo que duele es el frío: algo que arda. */
const ALGO_QUE_ARDE: Where = Object.freeze([{ q: 'fuelEnergy', op: '>', v: 0 }]) as Where

/** Lo que hace de un lugar un lugar: comida (el pozo es un cuerpo con calorías). */
const ALGO_QUE_ALIMENTA: Where = Object.freeze([{ q: 'calories', op: '>', v: 0 }]) as Where

/** Y lo otro que ancla: un fuego encendido, que costó carísimo y no se abandona. */
const ALGO_QUE_ARDE_YA: Where = Object.freeze([{ q: 'emitsPower', op: '>', v: 0 }]) as Where

/**
 * Cuánto espera la criatura anclada, en SEGUNDOS de mundo: los mismos
 * `TICKS_DE_FONDO` ticks del deambular, a la frecuencia de referencia. La espera
 * tiene que durar lo que dura cualquier conducta de fondo y por la misma razón
 * (ver `TICKS_DE_FONDO`): más larga le tapa la vista a la próxima decisión, más
 * corta gasta un tick de escalera por cada tick de mundo.
 */
const SEGUNDOS_DE_ANCLA = TICKS_DE_FONDO / HZ_DE_REFERENCIA

/** La firma vacía: «esto no lo pidió ningún predicado». Es la del nodo terminal. */
const SIN_META: PredicateSignature = ''

// ─── El estado ───────────────────────────────────────────────────────────────

/**
 * Lo que la escalera arrastra de un tick al otro.
 *
 * MUTABLE y con los campos opcionales escritos como `T | undefined` en vez de
 * `?:`. Las dos cosas son consecuencia de la decisión 1 del encabezado: `decidir`
 * escribe acá, y con `exactOptionalPropertyTypes` un `e.meta = undefined` sobre
 * un `meta?:` no compila —habría que `delete`— y un `delete` por campo es más
 * fácil de olvidar que una asignación.
 */
export interface EstadoDeLaEscalera {
  /** El reloj de la mente. Lo avanza `avanzarReloj`, una vez por tick. */
  tick: number
  /** Desde qué tick se sostiene `metaEnCurso`. La mitad de la histéresis. */
  desdeTick: number
  /** Qué se está persiguiendo, en firma de predicado. */
  metaEnCurso: PredicateSignature | undefined
  /** Con cuánto ganó la meta en curso. La otra mitad de la histéresis. */
  valorEnCurso: number
  /**
   * DE QUÉ CASILLERO DE CREENCIAS SALIÓ LA META EN CURSO.
   *
   * Es la reparación que el hueco del Hito 5 pedía con estas palabras: *«que
   * `Opportunity` viaje hasta la `Decision` —o que la escalera se guarde de qué
   * oportunidad salió la meta en curso»*. Se guarda acá, que es la segunda de las
   * dos formas y la barata: son dos strings por meta, no una oportunidad entera.
   *
   * `undefined` cuando la meta no salió de una apuesta —una orden del cuidador
   * (D2) no tiene casillero detrás— y ahí no se anota nada. Anotar el éxito de
   * una orden contra un casillero inventado sería peor que no anotar: le
   * enseñaría a la criatura que el río rinde porque alguien le dijo que pescara.
   */
  deDondeSalio: { readonly ctx: ContextKey; readonly rinde: string } | undefined
  /** De qué peldaño salió la meta. Sin esto el margen mezcla escalas (decisión 5). */
  porQuien: Peldano | undefined
  /** Lo que falta hacer del plan, en orden de ejecución. */
  pasosPendientes: Intencion[]
  /** Lo que se le entregó al ejecutor y todavía no aterrizó. */
  enVuelo: Intencion | undefined
  /**
   * Si lo que vuela NO salió de un plan.
   *
   * Se llamaba así porque hasta hoy sólo lo ponía D5, y el nombre quedó: lo que
   * el campo decide son dos cosas y ninguna habla de peldaños — que un fracaso no
   * se lleve puesto el plan que sigue esperando (`aterrizar`), y que D0 no
   * devuelva la intención a la cola de pasos cuando un reflejo la interrumpe. El
   * bocado de D3 también lo pone, y por las dos mismas razones.
   */
  deFondo: boolean
  /** La búsqueda de D4 a medio hacer, y para qué meta era. */
  frontera: Frontera | undefined
  metaDeLaFrontera: PredicateSignature | undefined
  /** Cuántas veces se cortó por presupuesto la búsqueda de la meta en curso. */
  cortes: number
  /**
   * LO QUE UN PLAN DE ESTA MENTE YA CONSIGUIÓ, y todavía tiene en la mano.
   *
   * ─── POR QUÉ HACE FALTA ACORDARSE DE ALGO QUE SE PUEDE MIRAR ──────────────
   *
   * Porque no se puede mirar. `cumpleCuerpo` de `@anima/plan` contesta `false`
   * para TODA forma `sostiene` —una `BodyView` no trae la sustancia ni sus tags,
   * y está dicho en su propio comentario—, así que `holding(tag:carnoso)` **no se
   * da por cumplida nunca, ni con el pescado en la mano**.
   *
   * Y eso no es cosmético: es el bucle que mató la primera corrida del Hito 5. La
   * meta barata no se completa, así que no se suelta; como no se suelta, D3 no
   * mira nunca la meta cara —«algo carnoso que además no me envenene»— y la
   * criatura vuelve a pescar sobre un pescado que ya tiene agarrado. **199 veces,
   * medido.**
   *
   * Lo que esta ranura guarda es la única evidencia que la mente sí tiene: **un
   * plan suyo corrió entero y salió bien**. Eso no es una sospecha — es lo que
   * `plan()` promete cuando devuelve pasos: que esos pasos establecen la meta. Y
   * se guarda con el CUERPO que rindió, así que la respuesta deja de valer sola
   * en cuanto ese cuerpo se va de la mano (se lo comió, se lo quitaron, se pudrió
   * y desapareció). No hay que limpiarla: la pregunta se contesta mirando la mano.
   *
   * Se limita sola al caso para el que sirve, y por eso no lleva ningún filtro:
   * la única forma de que dé `true` es que el cuerpo rendido esté EN LA MANO, que
   * es exactamente lo que dice `sostiene`. Una meta de temperatura o de alcance no
   * la puede activar aunque su plan haya rendido algo.
   */
  conseguido: { readonly meta: PredicateSignature; readonly cuerpo: string } | undefined
  /**
   * EL ÚLTIMO BOCADO QUE NO SE PUDO TRAGAR, para no volver a intentarlo.
   *
   * Es el mismo cerrojo que `fondosQueFallaron` y por el mismo motivo: un
   * `tragar` que fracasa no gasta aliento y no cambia nada, así que si D3 vuelve a
   * elegir el mismo cuerpo el tick que viene lo elige para siempre. La lista de
   * bocados sale de leer `calories`, `mass` y `toxicity`, que no cambian porque
   * uno haya fallado: sin esto, un solo rechazo del mundo tilda a la criatura.
   *
   * Se limpia con el primer `aterrizar(e, true)`, igual que la rueda: lo que
   * falló una vez merece otra cuando algo volvió a salir bien.
   */
  bocadoQueFallo: string | undefined
  /**
   * CUÁLES de las tres conductas de fondo fracasaron desde el último éxito, en
   * una máscara de tres bits (bit `i` ↔ `ORDEN_DE_FONDO[i]`).
   *
   * Sin esto la criatura se traba: `guarecerse` sin nada a reparo alrededor
   * vuelve con `ok: false` en un tick, y si D5 la vuelve a elegir por la misma
   * necesidad —que no bajó, porque no hizo nada— la elige otra vez, y otra. Es
   * un bucle que no gasta aliento y no avanza, que es la peor clase.
   *
   * Y ES UNA MÁSCARA Y NO UN ÍNDICE, que es la decisión 8 del encabezado: con un
   * índice solo, la que se saltea es siempre la última que falló y el puntero
   * rebota entre dos. Con la máscara, la que falló no vuelve hasta que algo salga
   * bien, así que la tercera sale sola.
   */
  fondosQueFallaron: number
  /**
   * EL «MIENTRAS TANTO» DE UN `gap` QUE YA SE HIZO, por firma, para no volver a
   * hacerlo idéntico contra el mismo paisaje.
   *
   * ─── EL BUCLE QUE ESTE CERROJO MATA, MEDIDO ────────────────────────────────
   *
   * Es el mismo cerrojo que `fondosQueFallaron` y que `bocadoQueFallo`, y llegó
   * por el mismo camino: un paso que no gasta aliento y no cambia nada se vuelve
   * a elegir para siempre, porque lo que lo eligió no se movió. La diferencia es
   * que acá el paso **sale bien**, y ésa es la parte que costó ver.
   *
   * MEDIDO sobre el mundo decretado (`hito-5-el-criterio.test.ts`), con la
   * criatura pidiendo `holding(tag:carnoso,toxicity<0.0528)`: `plan()` contesta
   * `gap` con `missing «emitsPower<410&emitsPower>=253»` y un `nearest` de UN
   * paso, `ir(suelta:-6:-7:2, within:1)`, que es «acercate a lo que podría hacer
   * de parrilla». La criatura ya está **a una celda** de esa pieza, así que `ir`
   * aterriza con `ok:true` en un tick sin mover una pata; al tick siguiente D4
   * vuelve a pedir el mismo plan, sale el mismo `gap`, y con él el mismo `ir`.
   *
   *     tanque 310 ..... 6045 despegues de `ir(suelta:-6:-7:2)` en 6171 ticks
   *     tanque 1000 ... 19846 despegues de `ir(suelta:-6:-7:2)` en 19971 ticks
   *
   * O sea: el 98% de la vida de la criatura, dando el mismo paso que ya estaba
   * dado. Antes de que el mundo materializara el decreto esto no se veía porque
   * no había ninguna pieza que pudiera hacer de parrilla: `nearest` venía vacío y
   * la escalera caía a D5, que es la rama que el encabezado de `planificar` ya
   * describe («D5 manda a deambular, la vista cambia, y la próxima búsqueda de la
   * misma meta corre sobre otro paisaje»). El cerrojo no inventa esa salida: le
   * hace tomar la misma al `nearest` que no cambió nada.
   *
   * Se guarda la FIRMA de los pasos y no un `boolean`: un `nearest` que nombra
   * otro cuerpo es otro «mientras tanto» y merece su turno. Y se pone al DESPEGAR
   * y no al aterrizar, así que un `nearest` que fracasa también queda cerrado —
   * igual que un fondo que falla—.
   *
   * ─── QUÉ ES ESTE CERROJO Y QUÉ NO ES, dicho en el tramo L ──────────────────
   *
   * NO es «la misma decisión N veces seguidas», que es la regla que este proyecto
   * descartó por escrito (ver el bloque `salteaLoQueYaEstaHecho`): esa regla no
   * distingue la vara que se calienta del `ir` que no mueve. Éste es otra cosa, y
   * la llave lo dice: **la meta está adentro**, porque se limpia en cuanto la meta
   * cambia o en cuanto aparece un plan de verdad. Lo que afirma es
   *
   *     «este mientras-tanto ya lo intenté PARA ESTA META, y después de hacerlo
   *      la meta seguía sin tener plan»
   *
   * que es evidencia y no un contador: la corrida siguiente de `plan()` sobre el
   * paisaje resultante volvió a contestar `gap` con el mismo `nearest`. Es la
   * misma definición de «avanzar» del portón de despegue —¿esto cambió algo que
   * antes no podía?— aplicada un nivel más arriba: al paso, allá; a la meta, acá.
   *
   * Y el grueso del bucle no lo mata este cerrojo, lo mata la poda de
   * `@anima/plan`: con el prefijo ya cumplido podado, este mismo `nearest` sale
   * VACÍO y la escalera cae a D5 sin necesidad de acordarse de nada. Medido, con
   * el cerrojo apagado a propósito para poder separar las dos capas: **6045 → 22**
   * en 6171 ticks y **19.846 → 68** en 19.971.
   *
   * Se limpia cuando la meta cambia (`tomarMeta`), cuando aparece un plan de
   * verdad para ella (`planificar`) y cuando la meta se tira (`olvidarMeta`). NO
   * se limpia con un fondo que sale bien, y es a propósito: si se limpiara, la
   * criatura alternaría un tick de deambular con un tick del mismo `ir` para
   * siempre — el mismo bucle, más caro, porque deambular sí cuesta patas.
   */
  mientrasTantoYaHecho: string | undefined
  /**
   * POR QUÉ META YA SE DEAMBULÓ, estando anclada. Es el cerrojo que convierte el
   * deambular-con-meta de un bucle en UNA herramienta: la primera vez que la
   * rueda cae en deambular con una meta en curso y un ancla a la vista, se
   * deambula —el paisaje puede cambiar la respuesta—; las siguientes, para la
   * MISMA meta, se espera anclada. Es la misma forma que `mientrasTantoYaHecho`
   * y por el mismo motivo: «esto ya lo intenté PARA ESTA META y la meta sigue
   * igual» no es un contador, es una firma.
   *
   * Sin este cerrojo el ancla no salvaba nada, y está medido: el diagnóstico 10
   * moría en el tick 9482 CON el ancla puesta, porque después del primer bocado
   * la criatura queda con hambre, la meta vive casi siempre, y el deambular con
   * meta la paseaba hasta la muerte igual. La cuenta que manda: deambular cuesta
   * ~0,067/tick contra 0,017 de esperar, o sea que pasearse sin encontrar es
   * morirse 4× más rápido.
   */
  yaDeambulePor: PredicateSignature | undefined
  /**
   * CUÁNTOS PASOS YA CUMPLIDOS NO SE DESPEGARON, en toda la vida de esta mente.
   *
   * No es telemetría de adorno: es el número que dice si el portón de despegue
   * sirve para algo, y sin él la única forma de saberlo sería que la corrida
   * viviera más — que es exactamente el proxy que este tramo vino a dejar de
   * mirar. Cada unidad es un tick de vida que no se tiró. Ver el bloque
   * `salteaLoQueYaEstaHecho`.
   */
  salteados: number
}

export function nuevoEstado(): EstadoDeLaEscalera {
  return {
    tick: 0,
    desdeTick: 0,
    metaEnCurso: undefined,
    valorEnCurso: 0,
    deDondeSalio: undefined,
    porQuien: undefined,
    pasosPendientes: [],
    enVuelo: undefined,
    deFondo: false,
    frontera: undefined,
    metaDeLaFrontera: undefined,
    cortes: 0,
    conseguido: undefined,
    bocadoQueFallo: undefined,
    fondosQueFallaron: 0,
    mientrasTantoYaHecho: undefined,
    yaDeambulePor: undefined,
    salteados: 0,
  }
}

/** Una copia que no comparte ni un array. Es cómo se dice «el mismo estado». */
export function clonarEstado(e: EstadoDeLaEscalera): EstadoDeLaEscalera {
  return { ...e, pasosPendientes: [...e.pasosPendientes] }
}

/** Un tick pasó. Se llama UNA vez por tick y ANTES de decidir (decisión 4). */
export function avanzarReloj(e: EstadoDeLaEscalera): void {
  e.tick += 1
}

/**
 * El vuelo terminó. Lo llama quien ejecuta, con lo que le contestó el mundo.
 *
 * Un paso que falla se lleva puesto **el plan entero** y no sólo a sí mismo, y
 * es deliberado: los pasos de un plan están encadenados por `{k:'rinde'}` —la
 * caña que sale de `unir` no existía cuando el plan se armó— así que seguir con
 * el paso siguiente después de que el anterior no rindiera es ejecutar un plan
 * que nombra algo que no se hizo. Replanificar cuesta a lo sumo un presupuesto
 * de expansiones; ejecutar un plan roto cuesta un rechazo del mundo por paso.
 */
export function aterrizar(e: EstadoDeLaEscalera, ok: boolean, rindio?: string): void {
  const era = e.enVuelo
  e.enVuelo = undefined
  if (ok) {
    // Algo salió bien: la rueda vuelve a tener las tres conductas disponibles y
    // el bocado que había fallado vuelve a estar sobre la mesa.
    e.fondosQueFallaron = 0
    e.bocadoQueFallo = undefined
    // Y si lo que aterrizó fue UN PASO DE PLAN, el mundo se movió de verdad: el
    // deambular vuelve a estar disponible para la meta en curso. Un aterrizaje
    // de fondo NO limpia el cerrojo —el esperar anclado aterriza bien cada ocho
    // ticks, y limpiarlo con eso sería re-armar el paseo que el cerrojo corta—.
    if (!e.deFondo) e.yaDeambulePor = undefined
    // ─── Y SI ERA EL ÚLTIMO PASO DE UN PLAN, LA META SE CONSIGUIÓ ──────────
    //
    // «El último» se lee del propio estado y no de un contador: D1 saca el paso
    // de la cola ANTES de entregarlo, así que una cola vacía al aterrizar quiere
    // decir que no queda nada del plan. `deFondo` afuera porque una conducta de
    // fondo no establece ninguna meta — deambular no consigue nada.
    if (!e.deFondo && e.pasosPendientes.length === 0 && e.metaEnCurso !== undefined && rindio !== undefined) {
      e.conseguido = { meta: e.metaEnCurso, cuerpo: rindio }
    }
    return
  }
  // El bocado se anota ANTES que la rueda: `tragar` viaja con `deFondo` puesto
  // —no sale de un plan, así que fallar no puede llevarse ningún plan puesto— y
  // `indiceDeFondo` lo contesta `-1`, o sea que sin esta rama un `tragar` fallido
  // no dejaría rastro en ningún lado.
  if (era !== undefined && era.k === 'tragar') {
    e.bocadoQueFallo = era.bocado.k === 'id' ? era.bocado.id : undefined
    return
  }
  if (e.deFondo) {
    const i = era === undefined ? -1 : indiceDeFondo(era)
    // `huir` es de fondo y NO es de la rueda (`indiceDeFondo` la contesta `-1`):
    // una huida que falla no tiene por qué apagarle a nadie su turno.
    if (i >= 0) e.fondosQueFallaron |= 1 << i
    return
  }
  olvidarPlan(e)
}

/** Se tira el plan y se deja la meta: quien la tenga que replanificar es D4. */
function olvidarPlan(e: EstadoDeLaEscalera): void {
  e.pasosPendientes = []
  e.enVuelo = undefined
  e.deFondo = false
  e.frontera = undefined
  e.metaDeLaFrontera = undefined
}

/** Se tira la meta también. La escalera vuelve a elegir desde cero. */
function olvidarMeta(e: EstadoDeLaEscalera): void {
  olvidarPlan(e)
  e.metaEnCurso = undefined
  e.metaDeLaFrontera = undefined
  e.valorEnCurso = 0
  e.deDondeSalio = undefined
  e.porQuien = undefined
  e.cortes = 0
  e.mientrasTantoYaHecho = undefined
}

// ─── La escalera ─────────────────────────────────────────────────────────────

/**
 * D0 a D5, en orden, con corte al primero que decida.
 *
 * NUNCA devuelve `undefined`: D5 siempre tiene algo. Una mente que a veces no
 * decide es una criatura que se tilda, y en 20.000 ticks eso pasa seguro
 * (decisión 2 de `tipos.ts`).
 *
 * El presupuesto de cada peldaño es ESTRUCTURAL y no microsegundos (decisión 1
 * de `tipos.ts`): D0 hace tres lecturas, D1 una interpretación y un barrido de
 * los `Ref` de un paso, D3 mira a lo sumo `OPORTUNIDADES_QUE_MIRA` contextos y
 * D4 expande a lo sumo `EXPANSIONES_POR_TICK` nodos. Ninguno de los seis mira
 * una cantidad de cosas que dependa del tamaño del mundo.
 */
export function decidir(
  v: VistaDeLaMente,
  e: EstadoDeLaEscalera,
  o: MenteOptions,
): Decision {
  const d0 = elReflejo(v, e)
  if (d0 !== undefined) return d0

  const d1 = continuar(v, e, o.memoria)
  if (d1 !== undefined) return d1

  // Desde acá para abajo NO HAY NADA VOLANDO: D1 devuelve `seguir` mientras lo
  // haya. Es lo que deja que D2/D3 escriban `enVuelo` sin pisar a nadie.
  const n = necesidades(v)

  // UNA sola búsqueda por tick, y hace falta decirlo con una variable: si D2 o
  // D3 acaban de tomar una meta y `plan()` se cortó por presupuesto, D4 —que es
  // «seguí pensando lo que ya elegiste»— arrancaría la MISMA búsqueda otra vez
  // en el mismo tick. Medido: con presupuesto 1, `cortes` subía de a dos por
  // tick, o sea que el presupuesto del peldaño valía el doble de lo que decía.
  const penso: Pensado = { si: false }

  const d2 = elDrive(v, e, o, penso)
  if (d2 !== undefined) return d2

  const d3 = lasOportunidades(v, e, o, n, penso)
  if (d3 !== undefined) return d3

  if (!penso.si) {
    const d4 = laBusqueda(v, e, o)
    if (d4 !== undefined) return d4
  }

  return elFondo(v, e, n)
}

/** Si ya se gastó el presupuesto de búsqueda de este tick. Ver `decidir`. */
interface Pensado {
  si: boolean
}

// ─── D0 · el reflejo ─────────────────────────────────────────────────────────

/**
 * LA TABLA ESTÁTICA. Tres filas en el documento —dolor, caída, fuego encima— y
 * dos acá, porque **la caída no existe en este mundo**: `grep -rniE
 * '\bcaida|\bfall|gravedad|gravity'` sobre `world/src` y `physics/src` da UNA
 * coincidencia y es la palabra «caída» adentro de un comentario sobre hojarasca.
 * No hay altura, no hay gravedad y no hay ninguna ley que las mueva. Escribir la
 * fila igual sería un reflejo que no puede disparar nunca.
 *
 * Las dos que quedan son las dos únicas cosas legibles que pueden lastimar, y no
 * es una opinión: lo midió `huir-del-dolor.ts` («ninguna de las 29 cualidades es
 * `pain`, `health`, `damage`, `injury` ni `threat`, y ninguno de los 20 `Motivo`
 * habla de daño»).
 *
 *   1. **fuego encima** — `temperature >= ignitionPoint` sobre el propio cuerpo,
 *      que es LITERALMENTE la condición de la ley 3. No hay un número escrito:
 *      cada sustancia trae el suyo y la vista lo contesta.
 *   2. **calor que duele** — el cuerpo o la celda por encima del umbral que
 *      publica el contrato de la innata que va a correr.
 *
 * Y el reflejo NO se re-dispara sobre sí mismo: si lo que está volando ya es
 * `huir`, contesta `seguir`. Sin esa línea, D0 le entregaría al ejecutor una
 * huida nueva por tick y la anterior nunca llegaría a dar un paso — un reflejo
 * que se interrumpe a sí mismo es una criatura temblando adentro del fuego.
 */
function elReflejo(v: VistaDeLaMente, e: EstadoDeLaEscalera): Decision | undefined {
  const enElCuerpo = v.q(v.self, 'temperature')
  const ignicion = v.q(v.self, 'ignitionPoint')
  const enLaCelda = v.qAt(v.self.at, 'temperature')

  const ardiendo = ignicion > 0 && enElCuerpo >= ignicion
  const duele = enElCuerpo >= CALOR_QUE_DUELE || enLaCelda >= CALOR_QUE_DUELE
  if (!ardiendo && !duele) return undefined

  const porque = ardiendo
    ? `me estoy prendiendo fuego (${grados(enElCuerpo)} sobre un punto de ignición de ${grados(ignicion)})`
    : `esto quema (cuerpo ${grados(enElCuerpo)}, celda ${grados(enLaCelda)}, duele desde ${grados(CALOR_QUE_DUELE)})`

  if (e.enVuelo !== undefined && e.enVuelo.k === 'huir') {
    return { k: 'seguir', por: 'D0', porque: `sigo huyendo: ${porque}` }
  }

  // ─── LA HUIDA NO SE LLEVA PUESTO EL PASO QUE ESTABA EN EL AIRE ────────────
  //
  // `entregar` escribe `enVuelo` sin mirar lo que había. Para D5 da igual —cuando
  // D5 corre no hay plan que pisar— pero **D0 corre PRIMERO** y puede pisar un
  // paso de plan a mitad de camino: `mente.ts#poner` aborta el vuelo del mundo y
  // el paso queda cortado sin haber establecido nada. La cola seguía en el paso
  // SIGUIENTE, o sea que el plan se reanudaba salteando un eslabón; con la cadena
  // de la caña eso es «atá la vara que nunca agarraste», y el `{k:'rinde'}` del
  // paso encadenado resuelve a `undefined` o el mundo lo rechaza.
  //
  // Medido por el adversario sobre un plan de tres pasos con el fuego en el tick
  // 1: `sostener(vara)` se entregaba UNA vez, se cortaba en vuelo y no se volvía
  // a entregar nunca.
  //
  // Se devuelve a la cabeza de la cola y no se tira el plan entero porque el paso
  // no falló: lo interrumpió un reflejo. Cuando la huida termine, D1 lo retoma
  // desde donde estaba y `sigueEnPie` se encarga de descubrir si mientras tanto
  // el mundo se movió abajo. La alternativa —`olvidarPlan` y que D4 replanifique—
  // cuesta un presupuesto de expansiones y tira trabajo que sigue siendo bueno.
  if (e.enVuelo !== undefined && !e.deFondo) {
    e.pasosPendientes = [e.enVuelo, ...e.pasosPendientes]
  }

  const huir: Conducta = { k: 'huir', porQue: porque }
  return entregar(e, 'D0', huir, porque, true)
}

function grados(x: number): string {
  return `${x.toFixed(1).replace('.', ',')} °C`
}

// ─── D1 · continuar ──────────────────────────────────────────────────────────

/**
 * EL PELDAÑO QUE CUBRE EL GRUESO, y la razón es aritmética y no una estimación:
 * el mundo avanza UNA CELDA POR TICK (`intencionCaminar`), así que un `ir` a
 * ocho celdas son ocho ticks en los que la escalera no tiene nada que decidir, y
 * `extraccion` dura `1,5 s × hz` ticks más. La medición está en el test.
 *
 * «Si sigue válida» son tres condiciones y las tres están:
 *
 *   · **la meta no se cumplió todavía.** Si se cumplió, lo que quede del plan es
 *     trabajo para nada: se corta lo que vuele y se tira el plan.
 *   · **hay algo volando** → `seguir`, y no se toca nada.
 *   · **el paso que sigue todavía se puede hacer**: sus `Ref` por id tienen que
 *     resolver contra la vista de HOY. Un plan es una hipótesis y `@anima/plan`
 *     ya lo dice en su decisión 1 («un plan no puede guardar un `BodyView`»).
 */
function continuar(v: VistaDeLaMente, e: EstadoDeLaEscalera, memoria?: AffordanceMemory): Decision | undefined {
  const meta = e.metaEnCurso
  if (meta !== undefined && yaEstaCumplida(meta, v, e)) {
    // ─── ACÁ SE LE DEVUELVE LA EVIDENCIA A LAS CREENCIAS ──────────────────
    //
    // Es el cierre del hueco que el Hito 5 dejó escrito y medido: `observe`
    // existía desde el principio y **nadie lo llamaba, porque no sabía con qué**.
    // Ahora sí: `deDondeSalio` trae el casillero del que salió la apuesta.
    //
    // ─── Y VA ACÁ Y NO EN `aterrizar`, QUE ES DONDE LO PUSE PRIMERO ───────
    //
    // Porque medido, `aterrizar(e, true)` NO SE ENTERA de la pesca. El propio
    // Hito 5 lo había escrito: *«el vuelo que de verdad sacó el pescado aterriza
    // con `ok:false` —"ya tengo «holding(tag:carnoso)»: corto lo que estaba
    // haciendo"—, porque la mente lo interrumpe en el mismo tick en que la meta
    // se cumple»*. Con la anotación en el aterrizaje daba **cero logros en 200
    // ticks** y la criatura seguía sin aprender.
    //
    // El único lugar que no se puede leer mal es éste: **el mundo dice que la
    // meta está cumplida**. No se le cree al `outcome` de la habilidad, se le
    // cree al estado — que es la misma regla con la que el Hito 5 arregló su
    // contador de pescas y con la que el juez mide el cargo `uso`.
    //
    // ─── SÓLO SE ANOTA EL ÉXITO, Y HAY QUE DECIR POR QUÉ ──────────────────
    //
    // Lo simétrico sería anotar un fracaso cada vez que una meta se abandona sin
    // conseguirse, y **no es simétrico**: una meta se abandona por muchas razones
    // que no dicen nada del casillero —apareció algo mejor, otro se llevó la
    // vara, se acabó el aliento—. Contar todas ésas como «el río no rinde»
    // enseñaría lo contrario de lo que pasó, y con volumen: los abandonos son
    // mucho más frecuentes que los logros.
    //
    // Cuál de esos abandonos ES evidencia en contra tiene respuesta medible y
    // todavía sin medir, así que se deja abierta en vez de adivinarla. El costo
    // de la asimetría también va dicho: las creencias sólo pueden subir, o sea
    // que hoy la criatura no se puede desengañar de un lugar que dejó de rendir.
    // Ese caso llega cuando un pozo se agota, y ahí hay con qué medirlo.
    const d = e.deDondeSalio
    if (memoria !== undefined && d !== undefined) memoria.observe(d.ctx, d.rinde, true)
    const habia = e.enVuelo !== undefined
    olvidarMeta(e)
    // El corte se informa; la meta ya no está, así que el tick que viene la
    // escalera elige de nuevo desde arriba.
    if (habia) return { k: 'abortar', por: 'D1', porque: `ya tengo «${meta}»: corto lo que estaba haciendo` }
    return undefined
  }

  const volando = e.enVuelo
  if (volando !== undefined) {
    return { k: 'seguir', por: 'D1', porque: `sigo con ${nombreDe(volando)}` }
  }

  // EL PORTÓN DE DESPEGUE, y es lo primero que se pregunta sobre el paso que
  // sigue: los que ya están dados se saltean EN ESTE MISMO TICK. Ver
  // `salteaLoQueYaEstaHecho`.
  const salteados = salteaLoQueYaEstaHecho(e, v)
  if (salteados > 0 && e.pasosPendientes.length === 0) {
    // El plan entero era cosa hecha. No se despega nada y no se finge que se
    // hizo algo: se tira el plan y D4 replanifica —o la meta ya estaba cumplida
    // y `yaEstaCumplida` la va a levantar arriba el tick que viene—.
    olvidarPlan(e)
    return undefined
  }

  const paso = e.pasosPendientes[0]
  if (paso === undefined) return undefined

  if (!sigueEnPie(paso, v)) {
    // El mundo se movió abajo del plan. No es un error: es lo que `Ref` existe
    // para poder descubrir. Se tira el plan y se replanifica más abajo.
    olvidarPlan(e)
    return undefined
  }

  e.pasosPendientes = e.pasosPendientes.slice(1)
  const faltan = e.pasosPendientes.length
  return entregar(
    e,
    'D1',
    paso,
    `sigo el plan: ${nombreDe(paso)}${faltan === 0 ? ' (el último)' : `, y quedan ${String(faltan)}`}`,
    false,
  )
}

// ═══ EL PORTÓN DE DESPEGUE, o CÓMO SE DEFINE «AVANZAR» ══════════════════════
//
// ─── QUÉ PROBLEMA ES ÉSTE Y POR QUÉ NO LO VIO NADIE DURANTE ONCE TRAMOS ─────
//
// Una criatura se pasó el **98% de su vida** —6045 despegues de
// `ir(suelta:-6:-7:2)` en 6171 ticks, y 19.846 en 19.971 con el tanque lleno—
// dando un paso que ya estaba dado, y **todo aterrizaba en verde**. La innata
// `ir` tiene su salida temprana («si ya estoy, no gasto una intención»), así que
// el vuelo volvía con `ok:true` sin haberle pedido NADA al mundo. El arnés de
// invariantes no ve nada, la corrida no se pone roja, y la criatura se muere de
// hambre haciendo algo que técnicamente funciona.
//
// Es la misma familia que el contador que leía DESPEGUES en vez de aterrizajes
// y reportaba «pescó 199» cuando había pescado una: **el sistema no distinguía
// «avancé» de «hice una acción exitosa»**.
//
// ─── LA DEFINICIÓN QUE SE ELIGIÓ, Y LAS DOS QUE SE DESCARTARON ──────────────
//
//   **UN DESPEGUE AVANZA SI EL PASO QUE DESPEGA TODAVÍA NO ESTÁ CUMPLIDO
//   CONTRA LA VISTA DE HOY.**
//
// Las dos candidatas obvias, y por qué ninguna de las dos:
//
//   · **«que haya cambiado el estado del mundo relevante al plan».** Es la más
//     honesta de las tres y no se puede escribir: «relevante» habría que
//     definirlo, y la mitad de lo que un paso mueve no se lee desde la vista —el
//     `dt` acumulado de una actividad, por ejemplo, no es ninguna de las 29
//     cualidades—. Una definición que se aproxima por `at` + la mano miraría
//     exactamente lo que un `frotar` NO cambia, y cortaría el fuego.
//   · **«que la misma decisión no se repita N veces seguidas».** Es barata y es
//     la que rompe lo que este tramo vino a arreglar. **Está medido en este repo
//     que un proceso NO avanza si no se re-emite la intención**: una fricción más
//     100 ticks vacíos deja la vara a 15 °C. Desde afuera, la vara que se
//     calienta y el `ir` que no mueve se ven IDÉNTICOS —la misma decisión, una y
//     otra vez— y ningún N los separa: con N chico se apaga el fuego, con N
//     grande vuelve el bucle. No es una calibración difícil: es una calibración
//     imposible, porque las dos series son la misma serie.
//
// La que se eligió los separa **por construcción y sin ningún umbral**:
//
//   `frotar(hasta=400)` con la vara a 15 °C   NO está cumplido → despega SIEMPRE,
//                                             las cien veces que haga falta.
//   `frotar(hasta=400)` con la vara a 400 °C  ya está cumplido → y repetirlo sería
//                                             exactamente el no-op que sobra.
//   `ir(x, within:1)` a dos celdas            NO está cumplido → despega.
//   `ir(x, within:1)` a una celda             ya está cumplido → no despega.
//
// O sea: **perseverar nunca se corta mientras perseverar todavía pueda
// conseguir algo**, y se corta en el instante exacto en que ya no. No hay N que
// elegir, no hay «relevante» que definir, y la pregunta la contesta el propio
// paso, que es quien sabe qué venía a establecer.
//
// ─── POR QUÉ ADEMÁS DE LA PODA DE `@anima/plan`, Y NO EN VEZ DE ─────────────
//
// `plan()` poda el prefijo ya cumplido en el momento de PLANIFICAR. Este portón
// pregunta en el momento de DESPEGAR, y son dos momentos distintos separados por
// decenas de ticks:
//
//   · un plan de 15 pasos se arma una vez y se consume de a uno. Entre el paso 3
//     y el 4 el mundo se movió —lo movió el paso 3— y el 4 puede haber quedado
//     cumplido solo. `plan()` no lo puede saber: cuando planificó, el paso 3
//     todavía no había pasado;
//   · D0 devuelve un paso a la cola después de una huida, y para cuando la huida
//     termina la criatura está en otro lado;
//   · y los pasos que NO vienen de `plan()` —lo que D2 y D3 emiten sueltos— no
//     pasan por la poda de la regresión ni una vez.
//
// ─── EL COSTO, Y CUÁNTAS VECES DISPARÓ DE VERDAD ───────────────────────────
//
// El costo es **una llamada a `pasoYaEstaHecho` por tick en el caso normal** —se
// corta en el primer paso que sí hay que dar—, o sea una resolución de `Ref`:
// 2,146 µs en el peor caso medido (un `{k:'id'}` que no está en la mano, con 15
// cuerpos a la vista) y 0,030 µs para cualquiera de los diez eventos. Y sólo
// corre cuando D1 va a sacar un paso de la cola: mientras algo vuela, D1
// contesta `seguir` y esto no se ejecuta.
//
// Y HAY QUE DECIR ESTO, porque es lo que el número honesto pide: **en las cuatro
// corridas del criterio (6200 a 20.000 ticks, con y sin leña) `salteados` quedó
// en CERO**. El portón no disparó ni una vez. No es que no sirva: es que la poda
// de `@anima/plan` llega antes —`plan()` se llama con la MISMA vista y el MISMO
// predicado en el mismo tick, así que el primer paso de lo que emite nunca está
// hecho— y ningún paso de MEDIO plan quedó cumplido en el camino en esas
// corridas. Lo que el portón cubre es lo que la poda no puede ver: un paso que
// D0 devolvió a la cola después de una huida, y los pasos que D2 y D3 emiten
// sueltos sin pasar por la regresión. Que dispare está probado en
// `tests/el-no-op-con-cara-de-progreso.test.ts`; que en esta escena no haga
// falta, medido.

/**
 * Saca de la cola los pasos que YA ESTÁN DADOS y devuelve cuántos sacó.
 *
 * Es un prefijo y no un filtro, por la misma razón que la poda de `@anima/plan`:
 * «ya está hecho» es una afirmación sobre un ESTADO, y el único estado conocido
 * es el de hoy. El segundo paso de la cola se va a ejecutar después del primero,
 * o sea contra un mundo que todavía no existe.
 */
function salteaLoQueYaEstaHecho(e: EstadoDeLaEscalera, v: VistaDeLaMente): number {
  let n = 0
  while (e.pasosPendientes.length > 0) {
    const s = e.pasosPendientes[0]
    // Las tres `Conducta` —`huir`, `guarecerse`, `tragar`— no son pasos de plan y
    // no tienen «ya está hecho»: `Step` es el único vocabulario con contrato
    // escrito. Que el portón las deje pasar es correcto y no un olvido.
    if (s === undefined || !esPasoDePlan(s) || !pasoYaEstaHecho(s, v)) break
    e.pasosPendientes = e.pasosPendientes.slice(1)
    e.salteados += 1
    n += 1
  }
  return n
}

/** Si una `Intencion` es un `Step` del planificador y no una de las tres conductas. */
function esPasoDePlan(i: Intencion): i is Step {
  return i.k !== 'huir' && i.k !== 'guarecerse' && i.k !== 'tragar'
}

/**
 * Si el mundo de hoy ya cumple la meta.
 *
 * Una firma que el intérprete no entiende NO cuenta como cumplida: se contesta
 * `false` y quien la tenga que planificar se va a caer en `planificar`, que es
 * donde la meta se tira con un motivo. Contestar `true` acá sería declarar
 * cumplido lo que no se sabe leer, que es la peor de las dos respuestas.
 */
function yaEstaCumplida(meta: PredicateSignature, v: VistaDeLaMente, e: EstadoDeLaEscalera): boolean {
  if (loConseguido(e, meta, v)) return true
  const p = interpretar(meta)
  return p !== undefined && cumple(p, v)
}

/**
 * Si un plan de esta mente ya estableció esta meta y lo que rindió sigue en la
 * mano. Ver `EstadoDeLaEscalera.conseguido`.
 *
 * Va ANTES de `cumple` y no después: es la barata —dos comparaciones contra una
 * lista de tres— y es la única que hoy sabe contestar por `sostiene`.
 */
function loConseguido(e: EstadoDeLaEscalera, meta: PredicateSignature, v: VistaDeLaMente): boolean {
  const c = e.conseguido
  if (c === undefined || c.meta !== meta) return false
  for (const b of v.self.holding) if (b.id === c.cuerpo) return true
  return false
}

/**
 * Si el paso todavía se puede intentar contra la vista de hoy.
 *
 * Sólo se miran los `Ref` de forma `{k:'id'}`, y es a propósito:
 *
 *   · `{k:'rinde'}` nombra lo que va a rendir un paso ANTERIOR del mismo plan.
 *     No existe todavía y no puede existir: resolverlo acá daría `undefined`
 *     siempre y tiraría todo plan encadenado —o sea, la pesca entera— en el
 *     primer tick.
 *   · `{k:'donde'}` y `{k:'celda'}` se resuelven al ejecutar, contra la vista de
 *     ese momento, que es más nueva que ésta.
 *   · `{k:'yo'}` es la criatura y siempre está.
 */
function sigueEnPie(i: Intencion, v: VistaDeLaMente): boolean {
  for (const r of refsDe(i)) {
    if (r.k !== 'id') continue
    if (resolverCuerpo(r, v) === undefined) return false
  }
  return true
}

/**
 * LA FIRMA DE UN «MIENTRAS TANTO»: qué pasos son y sobre qué caen.
 *
 * Es lo que deja decir «esto ya lo hice» sin guardar los pasos. Se arma con la
 * `k` de cada paso y sus `Ref`, que es lo único que distingue dos pedidos: el
 * mismo `ir` sobre otro cuerpo es otro «mientras tanto» y merece su turno.
 *
 * `{k:'donde'}` colapsa a la palabra `donde` a propósito y no a su `Where`: un
 * `Where` se resuelve contra la vista al ejecutar, así que dos `donde` idénticos
 * pueden caer en cuerpos distintos y dos distintos en el mismo. Colapsarlos hace
 * que el cerrojo se cierre ANTES —lo cual es el lado seguro: cerrarse de más
 * manda a D5, que es exactamente lo que la escalera hace cuando `nearest` viene
 * vacío; abrirse de más devuelve el bucle—.
 *
 * Sin `join` sobre nada ordenado por el sistema y sin `localeCompare`: `refsDe`
 * ya entrega los roles en orden total propio (regla 2).
 */
function firmaDeLoQueSePuede(pasos: readonly Intencion[]): string {
  return pasos.map((i) => `${i.k}(${refsDe(i).map(firmaDeRef).join(',')})`).join(';')
}

function firmaDeRef(r: Ref): string {
  switch (r.k) {
    case 'id':
      return `id:${r.id}`
    case 'celda':
      return `celda:${String(r.at.x)}:${String(r.at.y)}`
    case 'rinde':
      return `rinde:${r.de}`
    default:
      return r.k
  }
}

/** Los `Ref` de una intención. Exhaustivo sobre las trece variantes. */
function refsDe(i: Intencion): readonly Ref[] {
  switch (i.k) {
    case 'ir':
      return [i.a]
    case 'deshilachar':
      return [i.fuente]
    case 'unir':
      return i.b === undefined ? [i.binder, i.a] : [i.binder, i.a, i.b]
    case 'aplicar':
      return Object.keys(i.roles)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .flatMap((k) => {
          const r = i.roles[k]
          return r === undefined ? [] : [r]
        })
    // `armar` nombra un cuerpo por rol DEL PLANO, igual que `aplicar` nombra uno
    // por rol del proceso. Que los dos se lean igual no es casualidad: los dos
    // ligan cuerpos a nombres, y lo unico que cambia es de donde salen los nombres.
    case 'armar':
      return Object.keys(i.roles)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .flatMap((k) => {
          const r = i.roles[k]
          return r === undefined ? [] : [r]
        })
    case 'comer':
      return i.bocado === undefined ? [] : [i.bocado]
    // `tragar` SIEMPRE nombra su bocado: la cuenta del veneno se hizo sobre ese
    // cuerpo, así que dejar elegir a la innata sería usar un número calculado
    // para otra cosa.
    case 'tragar':
      return [i.bocado]
    case 'frotar':
      return [i.a, i.b]
    case 'poner':
      return [i.que, i.en, ...(i.sobre === undefined ? [] : [i.sobre]), ...(i.tapando === undefined ? [] : [i.tapando])]
    case 'sostener':
      return [i.que]
    // `juntar` y `explorar` hablan de `Where`, no de cuerpos; `esperar` habla de
    // segundos; las dos conductas no nombran nada. No tienen nada que se pueda
    // quedar viejo.
    //
    // Y en `esperar` eso no es un descuido, es la mitad de por qué la cocción
    // funciona: la espera del plan de cocinar dura 300 ticks, y si nombrara el
    // pescado, `sigueEnPie` lo tendría que encontrar A LA VISTA en cada uno de
    // ellos. El pescado está APOYADO SOBRE EL FUEGO durante toda la espera —no en
    // la mano— así que cualquier tick en que la vista no lo alcanzara mataría el
    // plan a mitad de la cocción. No nombrar nada es lo correcto por la misma
    // razón que `juntar` no nombra: el paso no depende de ningún cuerpo, depende
    // del reloj.
    case 'juntar':
    case 'explorar':
    case 'esperar':
    case 'huir':
    case 'guarecerse':
      return []
  }
}

// ─── D2 · el drive del cuidador ──────────────────────────────────────────────

/**
 * LO QUE PIDIÓ EL CHAT, con la histéresis puesta. Ver las decisiones 5 y 6.
 *
 * Tres portones y en este orden:
 *
 *   1. si ya se está haciendo, no hay nada que decidir;
 *   2. el peso contra su complemento;
 *   3. la permanencia — salvo que la orden sea NUEVA, que es la excepción del
 *      corpus («un swap cada 20 ticks salvo orden explícita»).
 */
function elDrive(
  v: VistaDeLaMente,
  e: EstadoDeLaEscalera,
  o: MenteOptions,
  penso: Pensado,
): Decision | undefined {
  const drive = o.drive
  if (drive === undefined) return undefined
  if (drive.meta === e.metaEnCurso) return undefined
  if (!(drive.peso > 1 - drive.peso)) return undefined

  const ordenNueva = drive.desdeTick > e.desdeTick
  if (!ordenNueva && !puedeCambiar(e, 'D2', drive.peso)) return undefined

  const porque = `me lo pidieron: «${drive.meta}» (peso ${dosDecimales(drive.peso)}${ordenNueva ? ', y es una orden nueva' : ''})`
  return tomarMeta(v, e, o, 'D2', drive.meta, drive.peso, porque, penso)
}

// ─── D3 · las oportunidades ──────────────────────────────────────────────────

/**
 * NECESIDAD × CREENCIA × ESCASEZ. La lista la arma `oportunidades.ts`; acá se
 * decide si vale la pena cambiar de idea.
 *
 * Sin memoria de afordancias D3 está APAGADO, y no se le fabrica una: una
 * `Creencias` nueva por tick olvidaría todo lo aprendido cada vez y la criatura
 * informaría `n = 0` para siempre. Que la mente sin memoria no tenga D3 es
 * correcto y la escalera igual nunca devuelve vacío, que es de lo que se encarga
 * D5.
 *
 * Y se REFRESCA el valor del que manda antes de compararlo. El costo de una
 * oportunidad baja a medida que la criatura camina hacia ella, así que comparar
 * al retador de hoy contra el valor que el que manda tenía hace ocho ticks es
 * compararlo contra un número viejo — y viejo justo para el lado que hace que el
 * retador gane.
 */
function lasOportunidades(
  v: VistaDeLaMente,
  e: EstadoDeLaEscalera,
  o: MenteOptions,
  n: NeedVector,
  penso: Pensado,
): Decision | undefined {
  const m = o.memoria
  if (m === undefined) return undefined
  const ver = o.oportunidades ?? opportunities
  // El catálogo viaja hasta D3 porque el PRECIO de una meta sale de la tabla de
  // esquemas: una capacidad registrada en esta partida cambia lo que cuesta
  // conseguir algo, y con un precio del core la mente ordenaría mal.
  const ops = ver(v, m, n, {}, o.catalogo ?? CATALOGO_CORE)

  if (e.porQuien === 'D3' && e.metaEnCurso !== undefined) {
    for (const x of ops) {
      if (x.meta === e.metaEnCurso) {
        e.valorEnCurso = x.valor
        break
      }
    }
  }

  // EL MEJOR QUE SE PUEDE QUERER, y no el mejor a secas: una oportunidad cuya
  // meta ninguna cadena de esquemas establece no es una oportunidad, es una
  // tentación. Se saltea acá —en la elección— y no al fracasar, y el porqué largo
  // está en la decisión 7 del encabezado. El barrido está acotado por la lista,
  // que `opportunities()` ya recorta a `OPORTUNIDADES_QUE_MIRA`.
  //
  // UN BOCADO NO PASA POR ESE PORTÓN, y no es una excepción: es que el portón
  // pregunta otra cosa. `sinVocabulario` contesta «¿sabe el PLANIFICADOR llegar
  // hasta acá?», y un bocado no va al planificador — lo establece la mente, de un
  // mordisco, con la habilidad `comer` cuyo contrato dice que deja `stamina > 0`.
  // Pasarlo por la tabla de esquemas lo vetaría siempre: ningún proceso de la
  // semilla establece `stamina`, ni tiene por qué.
  //
  // Y TAMPOCO ENTRA LO QUE YA ESTÁ CUMPLIDO. `tomarMeta` ya se planta ahí, pero
  // plantarse ahí GASTA EL TICK: D3 elige la mejor, descubre que ya la tiene, no
  // toma nada y el tick se cae a D5. Con dos metas parecidas —«algo carnoso» y
  // «algo carnoso que no me envenene»— eso es un tapón: la barata gana siempre,
  // ya está cumplida siempre, y la cara no se mira nunca. Saltearla acá es lo que
  // deja que la criatura pase de una a la otra.
  let mejor: Opportunity | undefined
  for (const x of ops) {
    if (x.bocado === undefined) {
      if (sinVocabulario(x.meta, o.catalogo)) continue
      if (yaEstaCumplida(x.meta, v, e)) continue
    } else if (x.bocado.id === e.bocadoQueFallo) continue
    mejor = x
    break
  }
  if (mejor === undefined) return undefined

  // ─── EL BOCADO SE CIERRA ACÁ MISMO: NO ES UNA META, ES UN ACTO ────────────
  //
  // No toma meta, no pide plan y **no consulta la histéresis**, y las tres cosas
  // son la misma razón: la histéresis existe para que la criatura no cambie de
  // objetivo cada tick —«no sueltes lo que estabas haciendo por algo apenas
  // mejor»— y tragar no suelta nada. Dura un tick, no cambia `metaEnCurso`, y
  // cuando termina D1 retoma el plan por donde iba (`pasosPendientes` sigue
  // intacto). Hacerlo esperar `PERMANENCIA_EN_TICKS` sería una criatura con la
  // comida en la mano contando hasta ocho.
  //
  // Y no puede quedarse en bucle: el bocado desaparece del mundo apenas se traga,
  // y si el mundo lo rechaza queda anotado en `bocadoQueFallo` y no se vuelve a
  // ofrecer hasta que algo salga bien.
  const b = mejor.bocado
  if (b !== undefined) {
    const tragar: Conducta = {
      k: 'tragar',
      bocado: { k: 'id', id: b.id },
      toxicidadTolerada: b.toxicidadTolerada,
      porQue: mejor.porque,
    }
    // `deFondo` en `true` quiere decir «esto no salió de un plan», que es lo que
    // el campo decide de verdad: que un fracaso no se lleve puesto el plan que
    // sigue esperando, y que D0 no lo devuelva a la cola de pasos si el fuego lo
    // interrumpe. Que hasta hoy sólo lo pusiera D5 era una coincidencia.
    return entregar(e, 'D3', tragar, mejor.porque, true)
  }

  if (mejor.meta === e.metaEnCurso) return undefined
  if (!puedeCambiar(e, 'D3', mejor.valor)) return undefined

  return tomarMeta(v, e, o, 'D3', mejor.meta, mejor.valor, mejor.porque, penso, mejor.deDonde)
}

// ─── D4 · la búsqueda anytime ────────────────────────────────────────────────

/**
 * `plan()` CON LA FRONTERA GUARDADA. Es el peldaño donde se termina de pensar lo
 * que otro peldaño eligió.
 *
 * D2 y D3 sólo cortan cuando CAMBIAN la meta; mientras la meta se sostiene, la
 * búsqueda que quedó a medias sigue por acá. Eso es lo que hace que la frontera
 * sirva de algo: si D3 volviera a elegir cada tick, cada tick empezaría una
 * búsqueda nueva y `parcial` sería un `undefined` con más campos.
 */
function laBusqueda(v: VistaDeLaMente, e: EstadoDeLaEscalera, o: MenteOptions): Decision | undefined {
  const meta = e.metaEnCurso
  if (meta === undefined) return undefined
  const cuantos = e.cortes
  const porque =
    cuantos === 0
      ? `pienso cómo llegar a «${meta}»`
      : `sigo pensando cómo llegar a «${meta}» (${String(cuantos)} ${cuantos === 1 ? 'corte' : 'cortes'} de presupuesto)`
  // La caja va vacía y se tira: D4 es el ÚLTIMO que piensa en el tick, así que
  // nadie de más abajo la va a leer. Pasarle la de arriba sería sugerir que
  // alguien pregunta después, y no lo hace nadie.
  return planificar(v, e, o, 'D4', porque, { si: false })
}

// ─── D5 · la conducta de fondo ───────────────────────────────────────────────

/**
 * LO QUE SIEMPRE HAY, y es el requisito 1: cobertura 100%.
 *
 * Tres conductas, una por necesidad, y la que gana es la de la necesidad más
 * grande. Nada de umbrales: un umbral acá sería un número sin fuente, y el orden
 * de las tres necesidades es información que ya está calculada.
 *
 *   refugio → `guarecerse`. La única necesidad cuya satisfacción es un LUGAR.
 *   calor   → `juntar` algo que arda. Es la fila que reemplaza a `pursueWarmth`.
 *   energía → deambular. Lo que se busca cuando no se sabe dónde está.
 *
 * El desempate es por índice y con `>` estricto: orden total y estable, y con
 * todas las necesidades en cero gana deambular, que es la única de las tres que
 * no le pide NADA al mundo. Ésa es la que hace que el peldaño no pueda fallar.
 */
const ORDEN_DE_FONDO = ['guarecerse', 'juntar', 'deambular'] as const

/**
 * ¿HAY UN ANCLA A LA VISTA? Comida —el pozo es un cuerpo con calorías— o un
 * fuego encendido. El propio cuerpo no cuenta: la carne propia tiene calorías y
 * sin ese filtro toda criatura estaría anclada a sí misma (es el mismo `soyYo`
 * que `comer` tuvo que aprender).
 *
 * ─── POR QUÉ EXISTE, y viene de una medición y no de una intuición ──────────
 *
 * El deambular de fondo se apoyaba, sin que nadie lo supiera, en un BUG del
 * mundo: `explore` caminaba un ciclo cerrado de 8 celdas que sumaba (0,0), así
 * que deambular era gratis en distancia — la criatura «exploraba» sin irse nunca
 * de al lado de su pozo. El día que el rumbo se arregló (dura 16 ticks y sale de
 * los bits altos de una avalancha), la exploración pasó de 8 celdas distintas a
 * 96 en 100 ticks… y DOS logros del criterio se cayeron: el diagnóstico 10 pasó
 * de llegar viva a los 20.000 a morir en el 9482, y la contraprueba del eslabón
 * regalado a morir en el 18.971. No porque explorar se encareciera —cobra
 * `COSTO_POR_CELDA` igual dando vueltas que caminando derecho— sino por EL VIAJE
 * DE VUELTA: la criatura se alejaba y tenía que volver al pozo y al fuego
 * (`ir(pozo:-12:-3)` ×31 contra una guarda de 10). El número 35 de la sección 5
 * de `como-se-trabaja.md` tiene la historia entera.
 *
 * O sea que el ancla no es una optimización: es la conducta que el bug
 * PROVEÍA POR ACCIDENTE, escrita ahora como decisión. Una criatura que sabe
 * dónde comer no tiene nada que buscar, y caminar es el 65% de su gasto.
 */
function hayAncla(v: VistaDeLaMente): boolean {
  if (v.see(ALGO_QUE_ALIMENTA).some((b) => b.id !== v.self.id)) return true
  return v.see(ALGO_QUE_ARDE_YA).some((b) => b.id !== v.self.id)
}

function elFondo(v: VistaDeLaMente, e: EstadoDeLaEscalera, n: NeedVector): Decision {
  const pesos = [n.refugio, n.calor, n.energia]
  let pedida = 2
  for (let k = 0; k < 2; k++) {
    const p = pesos[k]
    const mejor = pesos[pedida]
    if (p !== undefined && mejor !== undefined && p > mejor) pedida = k
  }
  // Las que fracasaron desde el último éxito no se vuelven a elegir: se corre la
  // rueda hasta la primera que todavía no falló. Ver `fondosQueFallaron` y la
  // decisión 8 del encabezado.
  let i = pedida
  for (let k = 0; k < ORDEN_DE_FONDO.length && (e.fondosQueFallaron & (1 << i)) !== 0; k++) {
    i = (i + 1) % ORDEN_DE_FONDO.length
  }
  if ((e.fondosQueFallaron & (1 << i)) !== 0) {
    // LAS TRES FALLARON. Se limpia la cuenta y se vuelve a la que la necesidad
    // pide: una rueda sin ruedas no es una rueda, y el último peldaño tiene que
    // devolver algo igual (decisión 2 de `tipos.ts`). Lo que se pierde es un tick
    // por vuelta completa, y lo que se gana es que la criatura vuelva a intentar
    // guarecerse cuando el paisaje cambió.
    e.fondosQueFallaron = 0
    i = pedida
  }

  const porQue = e.metaEnCurso ?? SIN_META
  const cual = ORDEN_DE_FONDO[i]

  // ─── EL ANCLA: la criatura que sabe dónde comer no se pasea, espera ───────
  //
  // Sólo la rama del deambular: las otras dos filas de la rueda piden cosas
  // concretas y no alejan a nadie. Y con una meta en curso el deambular sigue
  // siendo LA HERRAMIENTA que desbloquea un gap («la vista cambia, y la próxima
  // búsqueda de la MISMA meta encuentra») — pero es una herramienta y no un
  // bucle: se usa UNA vez por meta (`yaDeambulePor`). Si esa vuelta no cambió la
  // respuesta, la criatura anclada espera; pasearse sin encontrar cuesta 4× lo
  // que esperar y es exactamente de lo que se murió el diagnóstico 10.
  let anclada = false
  if (cual === 'deambular' && hayAncla(v)) {
    const meta = e.metaEnCurso
    if (meta === undefined) {
      anclada = true
    } else if (e.yaDeambulePor === meta) {
      anclada = true
    } else {
      e.yaDeambulePor = meta
    }
  }

  const conducta: Intencion =
    cual === 'guarecerse'
      ? { k: 'guarecerse', porQue: `la noche viene (refugio ${dosDecimales(n.refugio)})` }
      : cual === 'juntar'
        ? { k: 'juntar', que: ALGO_QUE_ARDE, cuantos: 1, porQue }
        : anclada
          ? { k: 'esperar', segundos: SEGUNDOS_DE_ANCLA, porQue }
          : { k: 'explorar', maxTicks: TICKS_DE_FONDO, porQue }

  const porque =
    cual === 'guarecerse'
      ? `de fondo: me guarezco (refugio ${dosDecimales(n.refugio)})`
      : cual === 'juntar'
        ? `de fondo: junto algo que arda (calor ${dosDecimales(n.calor)})`
        : anclada
          ? `de fondo: espero anclada (hay dónde comer y nada que buscar)`
          : `de fondo: deambulo ${String(TICKS_DE_FONDO)} ticks (energía ${dosDecimales(n.energia)})`

  // `entregar` NUNCA devuelve `undefined` para una conducta: `elFondo` es el
  // último peldaño y su tipo de retorno lo dice. Ver la decisión 2 de `tipos.ts`.
  return entregar(e, 'D5', conducta, porque, true)
}

/** Qué índice de la rueda es una intención de fondo. `-1` si no es ninguna. */
function indiceDeFondo(i: Intencion): number {
  if (i.k === 'guarecerse') return 0
  if (i.k === 'juntar') return 1
  if (i.k === 'explorar') return 2
  return -1
}

// ─── La histéresis ───────────────────────────────────────────────────────────

/**
 * SI SE PUEDE CAMBIAR DE IDEA. Los dos portones del documento, y hacen falta los
 * dos: sin ellos dos metas casi empatadas se alternan cada tick y la criatura
 * tiembla en el lugar sin avanzar en ninguna de las dos.
 *
 *   · **permanencia** — hay que haber sostenido la meta `PERMANENCIA_EN_TICKS`.
 *     Es el único portón que significa algo entre peldaños distintos (decisión 5).
 *   · **margen** — sólo entre valores del MISMO peldaño, porque sólo ahí las dos
 *     cantidades son la misma cantidad.
 *
 * Sin meta no hay de qué sostenerse y se cambia: una criatura que no está
 * haciendo nada no tiene inercia que respetar.
 */
function puedeCambiar(e: EstadoDeLaEscalera, quien: Peldano, valor: number): boolean {
  if (e.metaEnCurso === undefined) return true
  if (e.tick - e.desdeTick < PERMANENCIA_EN_TICKS) return false
  if (e.porQuien !== quien) return true
  return valor - e.valorEnCurso >= MARGEN_DE_HISTERESIS
}

// ─── Tomar una meta y planificarla ───────────────────────────────────────────

/**
 * Se cambia de idea: meta nueva, reloj de permanencia a cero, frontera tirada.
 *
 * La frontera se tira SIEMPRE y no se cachea por meta. Una frontera es una
 * búsqueda a medio hacer CONTRA UNA VISTA, y la vista de dentro de veinte ticks
 * es otra: retomar la vieja sería seguir buscando sobre cuerpos que capaz ya no
 * están. `plan()` resuelve los `Ref` contra la vista de hoy en cada expansión,
 * así que una frontera vieja no está mal formada — está desactualizada, que es
 * peor porque no se nota.
 */
function tomarMeta(
  v: VistaDeLaMente,
  e: EstadoDeLaEscalera,
  o: MenteOptions,
  quien: Peldano,
  meta: PredicateSignature,
  valor: number,
  porque: string,
  penso: Pensado,
  deDonde?: { readonly ctx: ContextKey; readonly rinde: string },
): Decision | undefined {
  // NO SE PERSIGUE LO QUE YA SE TIENE, y el portón va acá y no en D1: D1 mira la
  // meta EN CURSO, y una meta que llega cumplida no llegó a estar en curso nunca.
  // Sin esta línea, la criatura toma la meta, `plan()` devuelve el plan vacío
  // —no hay nada que hacer— y la meta queda puesta para siempre tapándole el
  // paso a la que sí tiene trabajo detrás.
  if (yaEstaCumplida(meta, v, e)) return undefined
  // NI LO QUE NINGÚN ESQUEMA SABE ESTABLECER (decisión 7). Va DESPUÉS de mirar si
  // ya está cumplida y no antes: `mass>=1` no tiene esquema y aun así puede estar
  // cumplida de entrada, y contestar «no se puede» sobre algo que ya se tiene
  // sería mentir por el lado caro.
  //
  // El portón vale también para D2: una orden del cuidador que el catálogo no
  // sabe cumplir NO SE TOMA, en vez de quedar en curso tapando todo lo demás. La
  // criatura no se hace la sorda —D3 sigue corriendo abajo— pero tampoco se
  // queda parada esperando un esquema que nadie va a escribir en esta partida.
  //
  // ─── Y EL PORTÓN TIENE DOS PREGUNTAS, NO UNA ──────────────────────────────
  //
  // `sinVocabulario` mira la TABLA de esquemas, y eso alcanzaba mientras la tabla
  // fuera la lista completa de lo que se puede conseguir. Dejó de serlo cuando la
  // regresión aprendió a resolver un «tenerlo» agarrando algo que ya lo cumple, y
  // eso no es un esquema.
  //
  // Así que lo que la tabla veta, el PAISAJE lo puede desmentir: ver
  // `seConsigueAgarrando`. Las dos preguntas juntas son el portón — no se toma lo
  // que ni el catálogo sabe fabricar ni hay a la vista para levantar.
  if (sinVocabulario(meta, o.catalogo) && !seConsigueAgarrando(meta, v)) return undefined
  olvidarPlan(e)
  e.metaEnCurso = meta
  e.valorEnCurso = valor
  // De qué casillero salió, para poder anotarle el resultado cuando termine. Va
  // acá y no en `planificar` porque es de la META y no del plan: un plan que se
  // rompe y se rehace sigue persiguiendo la misma apuesta.
  e.deDondeSalio = deDonde
  e.porQuien = quien
  e.desdeTick = e.tick
  e.cortes = 0
  // Meta nueva, «mientras tanto» nuevo: el cerrojo es POR META, no por vida.
  e.mientrasTantoYaHecho = undefined
  return planificar(v, e, o, quien, porque, penso)
}

/**
 * DE META A PASOS, con las tres respuestas de `plan()` atendidas.
 *
 * ─── EL `gap` NO ES UN ERROR (requisito 5) ─────────────────────────────────
 *
 * `PlanResult.gap` viene con `nearest`: «lo que se puede hacer mientras tanto».
 * La escalera lo EJECUTA y sigue viviendo. Es el contrato que el Hito 8 le va a
 * pedir a la fragua —«ahí nace un contrato, mientras el cuerpo ya está
 * caminando»— y si la mente se plantara acá, el hueco nunca se descubriría desde
 * adentro de una partida.
 *
 * Y cuando `nearest` viene vacío tampoco se planta: se cae a D5. La meta NO se
 * tira, y es a propósito: D5 manda a deambular, la vista cambia, y la próxima
 * búsqueda de la misma meta corre sobre otro paisaje. Tirar la meta haría que la
 * criatura se olvidara de que tiene hambre porque hoy no supo cómo comer.
 */
function planificar(
  v: VistaDeLaMente,
  e: EstadoDeLaEscalera,
  o: MenteOptions,
  quien: Peldano,
  porque: string,
  penso: Pensado,
): Decision | undefined {
  const meta = e.metaEnCurso
  if (meta === undefined) return undefined

  const p = interpretar(meta)
  if (p === undefined) {
    // Una meta que el intérprete no lee no se puede planificar NI verificar: no
    // hay forma de saber si se cumplió. Se tira acá, con motivo, en vez de
    // dejarla dando vueltas para siempre.
    olvidarMeta(e)
    return undefined
  }

  penso.si = true
  const g: GoalNode = { id: 'meta', goal: p, after: [], porque }
  const presupuesto = o.presupuesto ?? EXPANSIONES_POR_TICK
  // LA VISTA DEL CATÁLOGO VIAJA HASTA ACÁ, y ésta es la mitad de la costura que
  // el Gate 5→6 anotó como faltante: `plan()` aceptaba una tabla inyectada desde
  // el tramo anterior y la mente lo llamaba pelado, o sea que lo que la criatura
  // inventara nunca habría llegado al planificador.
  const r = plan(g, v, presupuesto, e.frontera, { catalogo: o.catalogo ?? CATALOGO_CORE })

  switch (r.k) {
    case 'plan':
      e.frontera = undefined
      e.metaDeLaFrontera = undefined
      // Apareció una vía de verdad: lo que se hizo «mientras tanto» deja de ser
      // un mientras tanto, y si mañana el plan se rompe y vuelve el `gap`, ese
      // paso se puede volver a hacer sobre un paisaje que ya cambió.
      e.mientrasTantoYaHecho = undefined
      return arrancarPlan(e, quien, r.steps, meta, porque)
    case 'parcial':
      // La frontera se guarda y el tick se cae a D5: el cuerpo hace algo
      // mientras la cabeza sigue. Es la mitad de «anytime» que no es el `plan`.
      e.frontera = r.frontera
      e.metaDeLaFrontera = meta
      e.cortes += 1
      return undefined
    case 'gap': {
      e.frontera = undefined
      e.metaDeLaFrontera = undefined
      // ─── LA COSTURA CON LA FRAGUA ────────────────────────────────────────
      //
      // Va ANTES del `nearest.length === 0`, y no es un detalle: un hueco sin
      // nada que hacer mientras tanto es el que MÁS hay que forjar, y ponerlo
      // después haría que justo ése no se pidiera nunca.
      //
      // No espera respuesta y no puede fallar el tick: quien escucha se lleva
      // un dato y hace lo suyo en otro hilo (Hito 8, `episodio.ts`). Ver
      // `PedidoALaFragua`.
      o.costura?.({ gap: r.missing, meta, porQue: r.why, tick: e.tick })
      if (r.nearest.length === 0) return undefined
      // EL MISMO «MIENTRAS TANTO» NO SE HACE DOS VECES PARA LA MISMA META. Ver
      // `EstadoDeLaEscalera.mientrasTantoYaHecho`: no es «la misma decisión N
      // veces» —es «esto ya lo intenté PARA ESTA META y la meta sigue sin tener
      // plan»—, y por eso la llave lleva la meta adentro (el cerrojo se limpia
      // cuando la meta cambia) y no un contador.
      const firma = firmaDeLoQueSePuede(r.nearest)
      if (e.mientrasTantoYaHecho === firma) return undefined
      e.mientrasTantoYaHecho = firma
      return arrancarPlan(
        e,
        quien,
        r.nearest,
        meta,
        `me falta «${r.missing}» (${r.why}); hago lo que puedo mientras tanto`,
      )
    }
  }
}

/**
 * Se guarda el plan y se entrega el primer paso EN EL MISMO TICK.
 *
 * Devolver sólo el anuncio y esperar a que D1 vuele el primero el tick que viene
 * costaría un tick por plan, y un tick es 50 ms de vida a la frecuencia de
 * referencia. Por eso `plan` quiere decir «tomá, y arrancá con `pasos[0]`»
 * (decisión 3).
 */
function arrancarPlan(
  e: EstadoDeLaEscalera,
  quien: Peldano,
  pasos: readonly Step[],
  meta: PredicateSignature,
  porque: string,
): Decision | undefined {
  const primero = pasos[0]
  // Un plan de cero pasos quiere decir «no hay nada que hacer para esto». No se
  // entrega nada y se cae a D5, que es lo único honesto: fabricar un `seguir`
  // sobre un plan vacío sería decir que se está haciendo algo.
  if (primero === undefined) return undefined
  e.pasosPendientes = pasos.slice(1)
  e.enVuelo = primero
  e.deFondo = false
  return { k: 'plan', por: quien, pasos, meta, porque }
}

// ─── Entregar ────────────────────────────────────────────────────────────────

/** Anota lo que sale a volar y arma la `Decision`. Es el único lugar que escribe `enVuelo`. */
function entregar(
  e: EstadoDeLaEscalera,
  quien: Peldano,
  i: Intencion,
  porque: string,
  deFondo: boolean,
): Decision {
  e.enVuelo = i
  e.deFondo = deFondo
  return { k: 'volar', por: quien, paso: i, porque }
}

// ─── Cómo se leen las cosas ──────────────────────────────────────────────────

/**
 * Dos decimales con coma. `toFixed` y no `toLocaleString`: la regla 2 prohíbe
 * todo lo que dependa del idioma del sistema, y `toFixed` está especificado al
 * último dígito por ECMAScript.
 */
function dosDecimales(x: number): string {
  return x.toFixed(2).replace('.', ',')
}

/** El nombre corto de una intención, para el «por qué». */
function nombreDe(i: Intencion): string {
  switch (i.k) {
    case 'aplicar':
      return `aplicar(${i.proceso})`
    case 'explorar':
      return `explorar(${String(i.maxTicks)} ticks)`
    case 'juntar':
      return `juntar(${String(i.cuantos)})`
    default:
      return i.k
  }
}
