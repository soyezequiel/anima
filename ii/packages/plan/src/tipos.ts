// ─── @anima/plan/tipos.ts ────────────────────────────────────────────────────
//
// EL CONTRATO COMPARTIDO del planificador. Nada de lógica: sólo las formas que
// los cuatro módulos del paquete tienen que respetar, escritas en un solo lugar
// para que no haya dos versiones de la misma idea.
//
// Tres decisiones viven acá y conviene leerlas antes que el código:
//
//   1. UN PLAN NO PUEDE GUARDAR UN `BodyView`. La vista está congelada por tick
//      —es lo que cierra el agujero 2 del ataque al sandbox— y un plan dura
//      decenas de ticks. Guardar el objeto sería guardar una foto vieja y creerle.
//      Por eso todo paso se refiere a las cosas por `Ref`, que se RESUELVE contra
//      la vista de HOY en el momento de ejecutar. Es la misma razón por la que
//      `PlaceMemory` trae `atTick`: un recuerdo es una hipótesis.
//
//   2. EL PRESUPUESTO DE `plan()` SE MIDE EN EXPANSIONES, NO EN MILISEGUNDOS
//      (ADR II-0012). El documento de arquitectura dice «8 ms» y ése es el número
//      honesto en tiempo de pared, pero medirlo adentro exigiría `performance.now`
//      —prohibido por la regla 2— y haría que dos máquinas planifiquen distinto.
//      El presupuesto es un entero de nodos expandidos; que ese entero entre en
//      8 ms lo mide un banco aparte, y si un día no entra se baja el entero.
//
//   3. LOS PASOS SON DATOS, NO HABILIDADES. `@anima/plan` no importa ni ejecuta
//      generadores: emite una lista de `Step`, y quien la corre es la mente.
//      Así el planificador se puede testear sin sandbox, sin combustible y sin
//      mundo — con una vista de mentira alcanza.

import type { LeyId, ProcessId, QualityId, QualityTest } from '@anima/physics'
import type {
  BodyId,
  BodyView,
  Cell,
  CellQuality,
  Clock,
  PlaceMemory,
  SelfView,
  Where,
  WhereCell,
} from '@anima/skills'

import type { PlannerCatalogView } from './catalogo.js'

export type { WhereCell }

// ─── Lo que el planificador ve ───────────────────────────────────────────────

/**
 * La parte de `Ctx` que el planificador necesita, y ni un método más.
 *
 * Es un subconjunto ESTRUCTURAL: el `Ctx` de producción lo satisface sin
 * adaptador, y un objeto literal de test también. Lo que queda afuera es todo lo
 * que MUEVE el mundo (`goTo`, `apply`, `eat`, `yield`): el planificador mira y
 * no toca, que es la mitad del ADR II-0004 —una habilidad no simula el futuro,
 * el planificador sí— dicha en el sistema de tipos.
 */
export interface VistaDelPlan {
  see(w: Where): readonly BodyView[]
  recall(w: WhereCell): readonly PlaceMemory[]
  q(b: BodyView, q: QualityId): number
  qAt(at: Cell, q: CellQuality): number
  readonly self: SelfView
  readonly clock: Clock
}

// ─── Predicados ──────────────────────────────────────────────────────────────

/**
 * La firma de un predicado: EL MISMO TEXTO que el proceso escribe en su
 * `establishes`, normalizado (sin espacios de sobra, cláusulas ordenadas).
 *
 * Se compara por texto a propósito, igual que `oracle/src/resolubilidad.ts:59`.
 * La alternativa —comparar estructuras parseadas— suena mejor y es peor: dos de
 * los cuatro `establishes` de la semilla NO PARSEAN con `parsePromesa`
 * (`freeStrandEnds>=1` es un `GeomFn` y no un `QualityId`; `holding(tag:carnoso)`
 * no tiene operador), y un índice que sólo indexa lo que parsea deja afuera
 * justo las dos promesas sobre las que se apoya la pesca.
 */
export type PredicateSignature = string

/**
 * Un predicado ya interpretado. `plan()` regresa sobre esto; `SCHEMA_INDEX` se
 * indexa por su firma.
 *
 * Las tres formas son las tres que la semilla necesita, y cada una existe porque
 * hay un `establishes` real que no entra en las otras:
 *
 *   cualidad  `temperature>=400`, `flexibility>=0.8` — un `QualityTest` pelado.
 *   geometria `freeStrandEnds>=1`, `reach>=2` — las tres `GeomFn` del cuerpo.
 *   sostiene  `holding(tag:carnoso)` — no es sobre un cuerpo, es sobre la MANO.
 *
 * ─── POR QUÉ `sostiene` LLEVA AHORA TESTS DE CUALIDAD ────────────────────────
 *
 * Porque «tener algo carnoso en la mano» y «tener algo carnoso en la mano QUE NO
 * ENVENENE» son dos metas distintas, y hasta acá la segunda no se podía escribir.
 * Desde el ADR II-0013 el mundo cobra `toxicity × masa` al tragar, así que la
 * diferencia entre las dos es la diferencia entre comer y adelgazar comiendo — y
 * `comer` ya trae `toxicidadTolerada` en su firma, o sea que la habilidad
 * distingue lo que el vocabulario de metas no distinguía.
 *
 * Va DENTRO del paréntesis y no como una segunda cláusula conjuntiva, y no es
 * cosmética: `toxicity<=0.2` suelta quiere decir «veo algún cuerpo con poca
 * toxicidad», que es lo que contesta `cumple` para las otras dos formas. Lo que
 * hace falta decir es que **el cuerpo de la mano** la cumple, y eso es una
 * relación entre la criatura y UN cuerpo — exactamente la razón por la que
 * `sostiene` existe como forma aparte.
 *
 * El separador de adentro es la COMA y no el `&`: `firmaDe` parte por `&` antes
 * de interpretar nada, así que un `holding(tag:carnoso&toxicity<=0.2)` se
 * rompería en dos trozos ilegibles. La coma no aparece en ningún `QualityId`, en
 * ninguna `GeomFn` ni en ningún `Tag`, así que no puede juntar dos cosas
 * distintas.
 */
export type Predicado =
  | { readonly k: 'cualidad'; readonly test: QualityTest }
  | { readonly k: 'geometria'; readonly f: string; readonly op: Comparador; readonly v: number }
  | { readonly k: 'sostiene'; readonly tag: string; readonly tests?: readonly QualityTest[] }

export type Comparador = '>=' | '<=' | '>' | '<'

// ─── Referencias diferidas ───────────────────────────────────────────────────

/**
 * A quién se refiere un paso, sin guardar el objeto.
 *
 * `rinde` es la ligadura diferida del ADR 0082 de Ánima I, portada: «asá el
 * pescado» nombra algo que TODAVÍA NO EXISTE cuando se arma el plan, y se liga
 * al rendimiento del nodo anterior. Sin esto, la tercera cláusula de cualquier
 * orden encadenada se resuelve a `missing` y el plan se cae — que es exactamente
 * el bug que el ADR 0082 arregló y que tirar el planificador viejo reintroducía.
 */
export type Ref =
  /** Ya lo vi y lo tengo fichado. Se resuelve por id contra la vista de hoy. */
  | { readonly k: 'id'; readonly id: BodyId }
  /** Lo que cumpla esto, lo más cerca. Se resuelve con `see`. */
  | { readonly k: 'donde'; readonly where: Where }
  /** Una celda del mundo, que no es un cuerpo. */
  | { readonly k: 'celda'; readonly at: Cell }
  /** Lo que rindió un paso anterior del mismo plan. */
  | { readonly k: 'rinde'; readonly de: GoalId }
  /** La criatura misma. `friccion` la pide como rol `actor`. */
  | { readonly k: 'yo' }

// ─── Objetivos ───────────────────────────────────────────────────────────────

export type GoalId = string

/**
 * Un nodo del grafo de objetivos. Orden PARCIAL, no lista: «hacé una caña y andá
 * a pescar, después asá el pescado» tiene un después de verdad y dos cosas que
 * pueden ir en cualquier orden.
 */
export interface GoalNode {
  readonly id: GoalId
  readonly goal: Predicado
  /** Orden parcial: estos nodos van antes. */
  readonly after: readonly GoalId[]
  /** Referencia diferida al rendimiento de otro nodo. */
  readonly binds?: { readonly slot: string; readonly from: GoalId }
  /** De dónde salió: para el «por qué» y para no premiar lo que nadie pidió. */
  readonly porque: string
}

// ─── Esquemas de construcción ────────────────────────────────────────────────

export type RoleName = string

/**
 * CONOCIMIENTO HUMANO SOBRE LAS LEYES, no una consecuencia de ellas.
 *
 * Cada esquema dice: «este predicado se puede establecer aplicando este proceso,
 * con roles que cumplan esto». Sin el índice, regresar `catch>0 ∧ reach>=2` a
 * través de un `yield: join` exige INVERTIR una expresión geométrica sobre el
 * espacio de ensambles posibles — síntesis constructiva con ramificación
 * combinatoria, que no entra en ningún presupuesto.
 *
 * ─── Y POR QUÉ NO SE DERIVA SOLO ────────────────────────────────────────────
 *
 * Porque `establishes` es un array de strings que escribe quien propone el
 * proceso, y `parsePromesa` descarta en silencio lo que no entiende. Un índice
 * derivado sería honesto y estaría VACÍO justo donde importa. La reparación no
 * es adivinar: es escribir los puentes a mano Y VERIFICAR CADA UNO CONTRA EL
 * MUNDO REAL. Un esquema sin su verificación es una tabla de recetas con pasos
 * de más.
 */
export interface EsquemaComun {
  /** El predicado que este esquema establece, en firma. */
  readonly establishes: PredicateSignature
  /**
   * Qué le pide a cada rol, más allá de lo que el proceso ya exige, DE LO QUE SE
   * PUEDE FABRICAR. Va a parar a `PedidoDeRol.firma`, o sea que es sobre esto que
   * la regresión regresa y es esto lo que el `gap` reporta cuando no hay esquema.
   */
  readonly roleHints: Readonly<Record<RoleName, Where>>
  /**
   * QUÉ TIENE QUE **SER** EL CUERPO QUE LLENA CADA ROL, de lo que nadie fabrica.
   *
   * ─── POR QUÉ NO ES OTRA CLÁUSULA DE `roleHints` ────────────────────────────
   *
   * Porque `roleHints` viaja a la FIRMA, y la firma es lo que se regresa y lo que
   * el `gap` le lleva a la fragua del Hito 8. `PedidoDeRol` ya tenía separadas las
   * dos clases de condición y ya tenía escrito el precio de mezclarlas: meter
   * `portable` en la firma hacía que el `why` dijera «ningún esquema conocido
   * establece «portable>0»», y el Hito 8 le habría pedido a la fragua un proceso
   * para volver portátil un tronco de veinte kilos. Lo que faltaba era la mitad de
   * este lado: un esquema no tenía cómo decir «esto se busca, no se fabrica», y la
   * única condición de esa clase que había —la del `arrangement`— la ponía la
   * regresión sola.
   *
   * ─── LA CONDICIÓN QUE LO PIDIÓ, Y POR QUÉ HOY NO LA USA NADIE ──────────────
   *
   * Este campo nació para la fila de la pesca, con `source: [portable<=0]` — «un
   * pozo no entra en una mano»— y esa condición SE SACÓ, medida: ver
   * `roleNoDeLaMano` acá abajo y el bloque de la fila en `esquemas.ts`. El campo
   * queda porque la distinción que encarna sigue siendo verdadera y es la que
   * `PedidoDeRol` ya tenía escrita: hay condiciones de cuerpo que ningún
   * `establishes` promete ni va a prometer, y meterlas en la firma le hace pedir a
   * la fragua del Hito 8 procesos que no existen. Hoy la única de esa clase la
   * pone la regresión sola (el `portable` del `arrangement`), y el mecanismo de
   * SUMARLAS —no pisarlas— se sigue verificando con una fila sintética en
   * `tests/el-pozo-y-la-mano.test.ts`.
   *
   * Ausente = el rol no tiene ninguna condición de las que sólo se encuentran, que
   * es el caso de las diez filas.
   */
  readonly roleFilters?: Readonly<Record<RoleName, Where>>
  /**
   * LOS ROLES QUE NO SE PUEDEN LLENAR CON ALGO QUE LA CRIATURA TENGA AGARRADO.
   *
   * ─── POR QUÉ ESTO NO ES UN `roleFilters` MÁS ───────────────────────────────
   *
   * Porque «lo tengo en la mano» NO ES UNA CUALIDAD DE CUERPO. Es una relación
   * entre la criatura y el cuerpo, exactamente igual que `sostiene` es una forma
   * aparte de `Predicado` y no una cualidad. Un `Where` no la puede decir, y el
   * intento de decirla con una cualidad —`portable <= 0`, «si no entra en una mano
   * entonces no está en la mano»— es lo que este campo viene a reemplazar.
   *
   * ─── EL PRECIO DE LA APROXIMACIÓN VIEJA, MEDIDO SOBRE LAS VEINTE PARTIDAS ──
   *
   * `portable <= 0` es verdadera de toda la mano, sí, pero también es verdadera de
   * casi todo lo demás: descarta CUALQUIER cuerpo de menos de 8 kg, y los bancos
   * que el dios decreta son casi siempre más chicos que eso. Medido sobre las
   * veinte semillas que juega el banco de la emergencia
   * (`juez/tests/ataque-al-tramo-i.test.ts`, bloque 3):
   *
   *     partidas SIN UN SOLO banco elegible          11 de 20
   *     de esas once, partidas con alguna tirada      0 de 11
   *     piezas de pescado que el filtro regalaba     58 de 332 (17,5%)
   *
   * El 4,4% que la fila publicaba como precio salía de UNA semilla (la del test de
   * esquemas, cuyo banco pesa 129,9150 kg). Y el mundo SÍ deja pescar en los otros:
   * `stockDe` decide qué es un pozo POR IDENTIDAD (`banco.body.id !== idDePozo(...)`),
   * la masa no entra, y un banco de 2,2630 kg rindió su pieza sin que el mundo
   * dijera `sin-pozo` una sola vez.
   *
   * La exclusión por TENENCIA no le cuesta una pieza a ningún banco —un banco
   * decretado no está en la mano de nadie— y caza exactamente al impostor que se
   * midió: el pescado que la criatura ya llevaba agarrado, que `candidatosPara`
   * encima PREFIERE.
   *
   * Ausente = ningún rol la pide, que es el caso de nueve de las diez filas.
   */
  readonly roleNoDeLaMano?: readonly RoleName[]
  /**
   * QUÉ LE PIDE A LA CELDA EN LA QUE ESTÁ EL CUERPO QUE LLENA CADA ROL.
   *
   * ─── POR QUÉ NO ALCANZA CON `roleHints` ────────────────────────────────────
   *
   * Porque un `Where` habla de CUALIDADES DE CUERPO, y hay una cosa que la
   * criatura necesita distinguir y no es una cualidad de cuerpo: **un pozo de un
   * pedrusco**. El rol `source` de `extraccion` pide `mass > 0` y nada más —el
   * mundo distingue el banco de peces con el motivo `sin-pozo`, que sale de un
   * decreto del dios y no de ninguna cualidad— así que con sólo `roleHints`
   * CUALQUIER cuerpo con masa califica de pozo, y `elegirCuerpo` desempata por
   * cercanía: una piedra a una celda le gana al río que está a ocho. Medido: el
   * plan salía «unir(vara, matorral) · ir(piedra) · aplicar(extraccion,
   * source=piedra)», verde, y el mundo lo rechazaba con `sin-pozo`.
   *
   * `VistaDelPlan` YA TRAÍA con qué: `qAt(cell, CellQuality)`. Las cuatro
   * cualidades de celda (ADR II-0002) son `wet`, `oxygen`, `temperature` y
   * `sheltered`, y el agua franca del decreto vale `wet = 1,0000` contra `0,6000`
   * de la orilla desde la que se pesca —medido sobre los ocho primeros pozos de
   * la semilla en `tests/los-esquemas-contra-el-mundo.test.ts`—. O sea que «está
   * en el agua» sí se puede decir, y es una condición NECESARIA de todo pozo de
   * esta semilla: los únicos `Stock` que decreta el dios son bancos de agua.
   *
   * No es SUFICIENTE, y eso queda escrito y no escondido: una piedra tirada
   * adentro del río también cumple `wet >= 0.9`, y ahí sigue mandando `sin-pozo`.
   * Lo que esta condición compra es que el hueco deje de ELEGIR: sin ella la
   * elección era activa y era mala; con ella el plan sólo se equivoca donde el
   * mundo ya no le da a la criatura forma de saber.
   *
   * Ausente = el rol no le pide nada a la celda, que es el caso de siete de las
   * ocho filas.
   */
  readonly cellHints?: Readonly<Record<RoleName, WhereCell>>
  /**
   * Cuántos SEGUNDOS DE MUNDO tarda, no cuántos ticks (ADR II-0008). El nombre
   * del documento de arquitectura decía `estimatedTicks` y era mentira de
   * unidades: `union` tarda un segundo a 20 Hz y un segundo a 100 Hz.
   */
  readonly segundos: number
}

/**
 * Lo de siempre: **un proceso aplicado**. `apply(via, roles)`, la puerta lo
 * juzga, el mundo lo corre y `completion` lo cierra.
 */
export interface EsquemaDeProceso extends EsquemaComun {
  readonly k: 'proceso'
  /** Con qué proceso. */
  readonly via: ProcessId
}

/**
 * ─── LO QUE FALTABA, Y ES EL ADR II-0001 DICHO POR TERCERA VEZ ───────────────
 *
 * **COCINAR NO ES UN PROCESO.** Los cuatro `ProcessId` de la semilla son atar,
 * deshilachar, frotar y extraer, y ninguno cocina: lo que cocina es la LEY 5,
 * que corre sola sobre todo cuerpo orgánico que esté entre su `denaturesAt` y su
 * `ignitionPoint`. Es literalmente lo mismo que el ADR II-0001 dice de encender
 * —«encender no es una acción, es una consecuencia»— y vale igual para secar
 * (ley 11), pudrir (ley 6) y carbonizar (ley 4): las doce leyes tienen todas la
 * misma forma, **«poné esto en esta situación y esperá»**, y ninguna es un
 * `ProcessId`.
 *
 * Mientras `ConstructionSchema.via` fue un `ProcessId` a secas, el planificador
 * NO PODÍA PLANIFICAR COCINAR — y sin eso la criatura no puede comer nada
 * carnoso, porque el pescado crudo trae `toxicity` 0,25 contra la tolerancia
 * 0,20 que `comer` se autoimpone y que el ADR II-0013 volvió real.
 *
 * ─── LA ALTERNATIVA QUE SE DESCARTÓ ──────────────────────────────────────────
 *
 * Tratar «cocinar» como caso especial adentro de la mente: un `if` que, cuando
 * la meta habla de comida, arme a mano la pila fuego/parrilla/comida. Es UNA FILA
 * POR SITUACIÓN, que es lo que este proyecto rechaza en cada página, y encima
 * dejaría mudo el planificador sobre las otras once leyes.
 *
 * ─── Y LA TERCERA FORMA, QUE TAMBIÉN SE DESCARTÓ ─────────────────────────────
 *
 * Inventar un quinto `Process` «coccion» y meterlo en el catálogo. Es la más
 * tentadora porque no toca ningún tipo — y es exactamente el error que el ADR
 * II-0001 nombra: un proceso es algo que ALGUIEN APLICA gastando `stamina`, y
 * cocinar no lo aplica nadie. Con un proceso «coccion», soltar el pescado sobre
 * la parrilla y VOLVER MÁS TARDE dejaría de cocinar, porque no habría nadie
 * corriendo el proceso; y el fuego que ya arde sin que nadie lo sople dejaría de
 * ser el mismo fuego para las leyes que para el planificador.
 *
 * ─── LA FORMA, Y POR QUÉ CADA CAMPO ──────────────────────────────────────────
 *
 * Una ley no tiene roles en el catálogo, así que los nombra el esquema. Y no
 * tiene `apply`: lo que la arma son POSICIONES, y la única innata que mueve algo
 * a una posición es `poner`.
 */
export interface EsquemaDeLey extends EsquemaComun {
  readonly k: 'ley'
  /**
   * Cuál de las doce. Sale de `LeyId` del motor —enumeración cerrada— y no de un
   * string libre: un esquema que dijera apoyarse en una ley que no existe no
   * compilaría, y la verificación contra el mundo puede preguntar si esa ley
   * corrió de verdad en vez de creerle al nombre.
   */
  readonly ley: LeyId
  /**
   * EL ROL SOBRE EL QUE LA LEY EMPUJA. Es el equivalente del rol material de un
   * proceso: sobre él queda lo que el esquema promete, y a él le viaja el residuo.
   */
  readonly sujeto: RoleName
  /**
   * CÓMO SE ARMA LA SITUACIÓN: una pila de roles, de abajo hacia arriba.
   *
   * El primero NO SE MUEVE —es el fuego, y a un fuego no se lo levanta—; cada uno
   * de los demás se pone en la celda del anterior y APOYADO sobre él (`onTopOf`,
   * que es la ley 8 y no la 12: apoyar no es tapar).
   *
   * Un solo campo, y de él sale la geometría entera. El `montaje` que la ley 1
   * lee —`piso`, `parrilla` o `contacto`— NO SE DECLARA: es una consecuencia de
   * dónde quedó cada cuerpo, igual que en el mundo (`montajeDe`, en
   * `world/src/step.ts`, contesta `parrilla` cuando algo está apoyado sobre algo
   * que está en la celda del fuego). O sea que una pila de TRES da `parrilla`, una
   * de DOS da `contacto`, y una de UNO —con el sujeto AFUERA de la pila, o sea
   * apoyado en nada— da `piso`. La diferencia entre las tres es la diferencia
   * entre cocinar, quemar y no hacer nada. Medida, en `esquemas.ts`.
   *
   * ─── EL SUJETO PUEDE NO ESTAR EN LA PILA, Y ESO ES EL TERCER MONTAJE ────────
   *
   * Una pila dice «apoyado sobre», y `piso` es exactamente la AUSENCIA de apoyo:
   * el cuerpo está en la celda de la fuente y no lo sostiene nada. Por eso la fila
   * del piso lleva `pila: ['fuego']` y su sujeto queda afuera — no es un olvido,
   * es la geometría, y `rolesDeLaLey` cuenta pila ∪ sujeto justamente para eso.
   */
  readonly pila: readonly RoleName[]
  /**
   * A CUÁNTAS CELDAS DE LA FUENTE QUEDA EL SUJETO. La segunda variable libre de la
   * ley 1, y hasta este tramo no existía.
   *
   * `T_eq = ambiente + potencia · exposicion(montaje) / (1 + d²) / h`. La tabla
   * resolvía siempre por la POTENCIA —«que el fuego sea de tanto»— con las otras
   * dos variables clavadas en un solo valor cada una: la pila de tres y el pegado.
   * Y la potencia es justamente la que NO se puede elegir cada vez: se elige UNA
   * vez, cuando se enciende, y depende de lo que haya para quemar. El lugar, en
   * cambio, se elige cada vez que se apoya algo.
   *
   * Va como campo y no como consecuencia de la pila porque no lo es: una pila
   * SIEMPRE deja el sujeto en la celda de la base —apoyarse es estar encima—, o
   * sea `distancia = 0`, y un sujeto fuera de la pila puede quedar donde uno lo
   * deje. Que hoy la única distancia que la tabla usa sea 0 no es una decisión de
   * este campo sino un límite de `Step`: ningún `Ref` sabe decir «la celda que
   * está a `d` de ese cuerpo», y `emitirLey` RECHAZA —con el motivo escrito— la
   * fila que pida una distancia que no sabe armar, en vez de emitir una pila que
   * pone la comida en otro lado. El barrido de las nueve combinaciones, con la
   * ventana de potencia de cada una y el porqué de cada descarte, está en
   * `GEOMETRIAS_DE_LA_COCCION` y `GEOMETRIAS_DESCARTADAS` de `esquemas.ts`.
   */
  readonly distancia: number
  /**
   * CUÁNTOS SEGUNDOS DE MUNDO HAY QUE DEJARLO AHÍ.
   *
   * Una ley no completa: empuja mientras la situación se sostenga. Este número es
   * una COTA SUPERIOR medida —lo mismo que `segundos` es para `friccion`, que
   * tampoco completa— y `segundos` sale de él.
   */
  readonly mientras: number
}

/**
 * Las dos maneras de que algo quede establecido: aplicando un proceso, o poniendo
 * el mundo en la situación en la que una ley lo hace sola.
 *
 * `k` discrimina, y las dos comparten `establishes`, `roleHints`, `roleFilters`,
 * `cellHints` y `segundos` a propósito: son los campos que `@anima/mind` lee de la tabla
 * (`creencias.ts` saca de `roleHints` los umbrales de sus claves de contexto, y
 * `oportunidades.ts` cotiza con `segundos`), y partirlos habría obligado a esa
 * mente a preguntar de qué clase es cada fila para leer lo que a ella no le
 * importa.
 */
export type ConstructionSchema = EsquemaDeProceso | EsquemaDeLey

// ─── Pasos ───────────────────────────────────────────────────────────────────

/**
 * Un paso del plan. Cada variante corresponde a una habilidad innata y sus
 * argumentos, con los `BodyView` reemplazados por `Ref`.
 *
 * NO están las quince: faltan `guarecerse`, `huirDelDolor`,
 * `seguirOrdenDeMovimiento` y `tantear`. Tres de ellas son conducta y no plan
 * —las emite la escalera de decisión, no la regresión—; `tantear` es percepción
 * activa y todavía no hay ningún objetivo que la pida. Cuando lo haya, entra acá y
 * no en un segundo tipo paralelo.
 *
 * ─── `esperar` DEJÓ DE SER CONDUCTA: EL TIEMPO ES UN PASO ───────────────────
 *
 * Acá decía que las CUATRO primeras eran conducta, y de `esperar` era cierto
 * mientras nada del plan necesitara que pasara el tiempo. Con los esquemas de ley
 * deja de serlo: una ley no se aplica, se le arma la situación y **se espera**, y
 * cuánto está escrito en el `mientras` de la fila. O sea que el tiempo ES el paso.
 *
 * Y acá decía, además, «no se agrega en este tramo», con los tres errores de
 * `tsc` que costaba anotados. Se agregó, y los tres eran los tres: uno en
 * `firmaDePaso` de este paquete y dos en `@anima/mind` —el `switch` de `refsDe` y
 * el de `aHabilidad`—. La innata `esperar` ya existía y ya tomaba segundos
 * (`skills/src/innatas/esperar.ts`): no faltaba física ni superficie, faltaba la
 * costura, y era esto.
 *
 * LO QUE SE MIDIÓ CUANDO SE CERRÓ, porque es la diferencia entre cocinar y no:
 * el plan ponía la comida sobre el fuego y la levantaba DOS TICKS después
 * (medido: `poner` en el tick 151, `sostener` en el 153), así que la ley 5 corría
 * dos ticks y la `digestibility` del pescado no se movía de 0,3800 en toda la
 * corrida. Con la espera puesta, el mismo pescado sobre la misma leña de 0,40 kg
 * llega a `digestibility` 0,8555 y `toxicity` 0,0323 en CINCO segundos —cien
 * ticks— y a 0,9432 / 0,0016 en los quince que la fila declara.
 *
 * NO LLEVA `mirando`, y es una decisión con su número: la innata sabe muestrear
 * con `rateOf` y despertarse cerca del final, pero para eso hace falta nombrarle
 * la cualidad y el umbral, o sea despejar el `establishes` de la fila acá adentro.
 * Sin eso la espera es a ciegas y cuesta `segundos / pasoMinimo` despertadas —15 /
 * 0,25 = 60 en los 300 ticks de la cocción—, que es barato. El día que una ley
 * declare un `mientras` de minutos, esto es lo primero que hay que apretar.
 */
/**
 * BAJO QUÉ NOMBRE SE ANOTA LO QUE UN PASO RINDE.
 *
 * Sin esto un plan encadenado NO SE PUEDE ESCRIBIR, y el agujero es exactamente
 * el que el ADR 0082 de Ánima I cerró. `union` con `yield: join` **consume las
 * piezas y crea un cuerpo con id nuevo** (`world/src/step.ts`, caso `'join'`):
 * la caña que sale de atar la vara con la liana no es la vara, no es la liana, y
 * no existía cuando el plan se armó. El paso siguiente —`extraccion` con esa
 * caña de `gear`— tiene que nombrarla, y las cinco formas de `Ref` sólo tienen
 * una que puede: `{k:'rinde', de}`. `de` es un `GoalId`, o sea que el paso que
 * produce tiene que anunciar bajo qué llave se anota lo que produjo.
 *
 * Está en las TRES variantes que crean cuerpo y en ninguna más. `frotar` no lo
 * lleva y es información: `friccion` no tiene `completion`, no rinde nada, y lo
 * que establece (`temperature>=400`) queda sobre el cuerpo que ya se le pasó
 * como rol `a`. Quien quiera referirse a la yesca encendida nombra la yesca, no
 * un rendimiento que no existe.
 */
export type Step =
  | { readonly k: 'ir'; readonly a: Ref; readonly within?: number; readonly porQue: PredicateSignature }
  | {
      readonly k: 'juntar'
      readonly que: Where
      readonly cuantos: number
      readonly porQue: PredicateSignature
    }
  | {
      readonly k: 'deshilachar'
      readonly fuente: Ref
      readonly cuantas: number
      readonly porQue: PredicateSignature
      readonly rinde?: GoalId
    }
  | {
      readonly k: 'unir'
      readonly binder: Ref
      readonly a: Ref
      readonly b?: Ref
      readonly porQue: PredicateSignature
      readonly rinde?: GoalId
    }
  | {
      readonly k: 'aplicar'
      readonly proceso: ProcessId
      readonly roles: Readonly<Record<RoleName, Ref>>
      readonly porQue: PredicateSignature
      readonly rinde?: GoalId
    }
  | { readonly k: 'comer'; readonly bocado?: Ref; readonly porQue: PredicateSignature }
  | {
      readonly k: 'frotar'
      readonly a: Ref
      readonly b: Ref
      readonly hasta?: number
      readonly porQue: PredicateSignature
    }
  | {
      readonly k: 'poner'
      readonly que: Ref
      readonly en: Ref
      readonly sobre?: Ref
      readonly tapando?: Ref
      readonly porQue: PredicateSignature
    }
  | { readonly k: 'sostener'; readonly que: Ref; readonly porQue: PredicateSignature }
  // El paso que no le pide nada al mundo: sólo deja pasar el tiempo. `segundos`
  // son SEGUNDOS DE MUNDO y no ticks, que es la unidad del ADR II-0008 y la que
  // la innata toma.
  | {
      readonly k: 'esperar'
      readonly segundos: number
      /**
         * QUÉ SE ESTÁ ESPERANDO, Y POR QUÉ EL PASO DEJÓ DE SER CIEGO.
         *
         * `segundos` es una COTA SUPERIOR —el `mientras` de la fila, medido sobre el
         * peor caso admisible— y no una predicción. Sin este campo la innata gastaba
         * la cota entera: medido, el pescado sobre la brasa está cocido a los **5 s**
         * (`digestibility` 0,8715 · `toxicity` 0,0261) y la fila hace esperar **15**,
         * y el fuego dura **20**. O sea que la espera ciega se comía tres cuartos del
         * fuego para nada y la segunda pieza habría empezado a cocinarse con la brasa
         * apagada: ése era el techo duro de «un fuego, un bocado», y no venía de que
         * la criatura fuera lenta.
         *
         * `tests` son las condiciones del `establishes` de la fila que hablan de
         * CUALIDADES del sujeto, despejadas con `interpretar` sobre la firma. La
         * innata ya sabía qué hacer con esto (`hasta` y `mirando` de
         * `skills/src/innatas/esperar.ts`, que muestrea con `rateOf` y se despierta
         * cuando la cualidad llega): no faltaba física ni superficie, faltaba pasar el
         * dato. Es el mismo movimiento que agregó este paso.
         *
         * Es OPCIONAL y no obligatorio porque hay esperas que no esperan nada —el
         * `esperarLaNoche` de la innata, por ejemplo— y porque un `establishes` que no
         * hable de cualidades del sujeto (una geometría, un tag pelado) no tiene con
         * qué llenarlo. Sin él el paso vuelve a ser lo que era, que es correcto y
         * caro, y no un error.
         *
         * Y ATENCIÓN CON `refsDe`: este `Ref` **no entra** en los `Ref` que
         * `sigueEnPie` revisa cada tick, a propósito y con el número al lado. La
         * espera de la cocción dura 300 ticks y el sujeto está APOYADO SOBRE EL FUEGO
         * —no en la mano— así que un solo tick en que la vista no lo alcanzara mataría
         * el plan a mitad de la cocción. Se resuelve UNA vez, al despegar, y si no
         * resuelve la espera sale ciega en vez de envejecer el plan.
         */
      readonly mirando?: { readonly que: Ref; readonly tests: readonly QualityTest[] }
      readonly porQue: PredicateSignature
    }
  | {
      readonly k: 'explorar'
      readonly busco?: Where
      readonly buscoEnLaCelda?: { readonly q: CellQuality; readonly op: '>=' | '<='; readonly v: number }
      readonly maxTicks: number
      readonly porQue: PredicateSignature
    }

// ─── El resultado ────────────────────────────────────────────────────────────

/**
 * El estado guardado de una búsqueda que se quedó sin presupuesto. `plan()` es
 * ANYTIME: se corta a mitad, devuelve esto, y el tick siguiente sigue desde acá
 * en vez de empezar de cero.
 *
 * Es opaco a propósito: quien lo guarda no lo interpreta.
 *
 * ─── LO QUE TENÍA Y YA NO: `cerrados` ───────────────────────────────────────
 *
 * Había acá una lista de firmas ya abiertas, COMPARTIDA POR TODAS LAS RAMAS, y
 * era un corte de ciclos que cortaba de más. Medido: `friccion` necesita dos
 * cuerpos rígidos, `deshilachar` sabe fabricarlos y su `split` NO consume la
 * fuente, así que sacarle dos hebras al mismo matorral es legal en el mundo — y
 * el planificador sacaba una y se declaraba sin salida con el mensaje «ya se
 * había abierto MÁS ARRIBA en esta misma búsqueda», que era falso: la firma no
 * estaba en ningún ancestro, estaba en el rol HERMANO que el marco de al lado
 * acababa de llenar.
 *
 * El ciclo se corta ahora por LINAJE, y el linaje ya viajaba acá adentro: es
 * `NodoAbierto.marcos`, la pila de aplicaciones a medio armar del propio nodo.
 * O sea que el arreglo saca un campo de la frontera en vez de agregarle uno.
 */
export interface Frontera {
  readonly abiertos: readonly NodoAbierto[]
  /**
   * Las ramas que ya murieron. Viven en la frontera y no en una variable local
   * de `plan()` porque el `gap` se arma con ellas: una búsqueda cortada en cinco
   * pedazos que olvidara los muertos de los primeros cuatro devolvería un `gap`
   * distinto que la misma búsqueda de una sola vez, y el `toEqual` del anytime
   * es lo único que prueba que la frontera está completa.
   */
  readonly muertos: readonly RamaMuerta[]
  readonly expansiones: number
  /**
   * CON QUÉ CATÁLOGO SE ARMÓ ESTA BÚSQUEDA.
   *
   * Una frontera es una promesa sobre un catálogo: los nodos abiertos se
   * expandieron contra unas filas, y los muertos murieron porque ninguna fila
   * los cubría. Si el catálogo cambió entre dos ticks —la criatura aprendió algo
   * o se le revocó algo— retomarla sería seguir buscando con media tabla vieja,
   * y peor: una rama que murió por «no hay esquema» seguiría muerta aunque el
   * esquema acabe de entrar.
   *
   * `plan()` la DESCARTA y replantea desde cero cuando no coincide. Es la misma
   * disciplina que el ADR II-0012 le puso al presupuesto anytime, y el precio es
   * el correcto: se pierde una búsqueda a medias, no se gana un plan mentiroso.
   *
   * Va como campo de la frontera y no como argumento de `plan()` porque es un
   * dato DE LA FRONTERA: quien la guarda no tiene por qué acordarse aparte de
   * con qué se armó, y si se lo dejara al que llama, el día que se olvide nadie
   * se entera.
   */
  readonly catalogEpoch: number
}

/**
 * Un pedido de rol: qué tiene que cumplir el cuerpo que llene este rol.
 *
 * `firma` NO es lo que el proceso pide ni lo que el esquema pide: es la
 * CONJUNCIÓN de los dos, más lo que le pasó de arriba el residuo. Un rol de
 * `union` que sale del esquema de `catch>0` pide `flexibility>=0.8` por el
 * esquema y `tensile>=0.3` por el catálogo, y las dos cosas al mismo cuerpo.
 */
export interface PedidoDeRol {
  readonly rol: RoleName
  /**
   * LO QUE SE PUEDE FABRICAR. Es sobre esto —y sólo sobre esto— que se regresa.
   */
  readonly firma: PredicateSignature
  /**
   * ─── LO QUE SÓLO SE PUEDE ENCONTRAR ────────────────────────────────────────
   *
   * Un rol pide dos clases de cosas y hasta acá viajaban mezcladas. La firma es
   * lo que un proceso podría dejar establecido, y por eso es lo que la regresión
   * REGRESA y lo que el `gap` reporta cuando no hay esquema. Estos dos campos
   * son la otra clase: condiciones que ningún `establishes` promete ni va a
   * prometer, así que se FILTRAN sobre lo que se ve y no se regresan nunca.
   *
   *   `filtro`  sobre el cuerpo. Hoy tiene una sola cláusula y la pone el
   *             `arrangement`: un proceso `held` necesita los cuerpos en la mano
   *             y en la mano no entra lo que pesa más de 8 kg (`portable`).
   *   `celda`   sobre el lugar. Hoy la pone el esquema de `extraccion`: un pozo
   *             está en el agua.
   *
   * Meterlas en la firma no era sólo feo: hacía que el `gap` dijera «ningún
   * esquema conocido establece «portable>0»», y el Hito 8 lee ese `why` para
   * pedirle procesos nuevos a la fragua. Le habría pedido un proceso para volver
   * portátil un tronco de veinte kilos, que no es lo que hace falta —lo que hace
   * falta es sacarle una hebra, y eso el catálogo ya lo sabe hacer—.
   *
   * Viajan en la frontera porque son DATO PURO, como todo lo demás de acá.
   */
  readonly filtro?: Where
  readonly celda?: WhereCell
  /**
   * Y LA TERCERA, QUE NO ES UNA CONDICIÓN SOBRE UN CUERPO NI SOBRE UN LUGAR.
   *
   * «No lo tengo agarrado» es una relación entre la criatura y el candidato, así
   * que no cabe en un `Where` ni en un `WhereCell` — y tampoco se regresa nunca,
   * que es lo que la pone de este lado y no en la firma. La pone el esquema de
   * `extraccion`: no se pesca adentro de lo que uno lleva en la mano. Ver
   * `EsquemaComun.roleNoDeLaMano` para lo que costaba decirlo con una cualidad.
   */
  readonly noDeLaMano?: true
}

/**
 * Una aplicación de proceso A MEDIO ARMAR: el nodo AND de la búsqueda.
 *
 * `NodoAbierto` con un solo `falta` alcanza para una regresión donde cada
 * subobjetivo tiene un solo hijo, y la pesca no es eso: `extraccion` necesita
 * `gear` Y `source`, y ninguno de los dos es el objetivo del otro. La pila de
 * marcos es lo que hace que «me falta la caña» y «me falta el río» quepan en la
 * misma búsqueda sin inventar un segundo tipo de nodo.
 *
 * Es DATO PURO —sin funciones, sin cuerpos, sin `BodyView`— por la misma razón
 * que todo lo demás de este archivo: viaja adentro de `Frontera` de un tick al
 * otro, y lo que sobrevive un tick no puede ser una foto de la vista.
 */
export type MarcoPor =
  | { readonly k: 'proceso'; readonly via: ProcessId }
  | { readonly k: 'ley'; readonly esquema: EsquemaDeLey }

export interface MarcoDePlan {
  /**
   * POR DÓNDE. Un proceso del catálogo, o un esquema de ley entero.
   *
   * La ley viaja como el ESQUEMA y no como su `LeyId`, y es la única forma que no
   * miente: dos filas pueden apoyarse en la misma ley con pilas distintas —cocinar
   * lo carnoso y cocinar lo vegetal son las dos ley 5— así que el `LeyId` solo no
   * alcanza para volver a encontrar la fila cuando el marco se cierra tres ticks
   * después. Y sigue siendo DATO PURO, que es lo que la frontera exige: un
   * `EsquemaDeLey` no tiene funciones, ni cuerpos, ni `BodyView`.
   */
  readonly por: MarcoPor
  /** La conjunción que esta aplicación viene a establecer. */
  readonly establece: PredicateSignature
  /** A qué rol del marco de abajo va a parar lo que salga. Ausente = es la raíz. */
  readonly paraRol?: RoleName
  /** Bajo qué `GoalId` se anota lo que rinda, para que el padre lo nombre. */
  readonly rinde: GoalId
  /** Los roles ya resueltos. */
  readonly roles: Readonly<Record<RoleName, Ref>>
  /** Lo que cada rol pidió, guardado para el `porQue` de los pasos. */
  readonly porRol: Readonly<Record<RoleName, PredicateSignature>>
  /** Los que faltan, en el orden en que se van a intentar. */
  readonly faltan: readonly PedidoDeRol[]
}

/**
 * Una rama que no llegó a ningún lado, con el porqué YA ESCRITO.
 *
 * Se escribe en el momento de morir y no al final a propósito: en el momento de
 * morir se sabe qué cláusula no tenía esquema y qué había resuelto la rama hasta
 * ahí; reconstruirlo después, desde la frontera vacía, sería adivinarlo.
 */
export interface RamaMuerta {
  readonly falta: PredicateSignature
  readonly why: string
  /** Lo que esta rama SÍ dejó listo para hacer: el `nearest` del `gap`. */
  readonly nearest: readonly Step[]
  readonly profundidad: number
  readonly costo: number
}

export interface NodoAbierto {
  /**
   * La conjunción que toca resolver. Es `marcos[tope].faltan[0].firma` salvo en
   * dos nodos: el inicial —donde es la meta— y el TERMINAL, donde es `''` y
   * `marcos` está vacía, que es cómo se dice «este nodo ya es un plan».
   */
  readonly falta: PredicateSignature
  readonly camino: readonly Step[]
  readonly profundidad: number
  /** Cuántos segundos de mundo cuesta el camino hasta acá. Ordena la búsqueda. */
  readonly costo: number
  /** La pila de aplicaciones a medio armar. El tope es la que se está llenando. */
  readonly marcos: readonly MarcoDePlan[]
  /**
   * Los cuerpos que el plan YA se comprometió a llevar en la mano, arrancando
   * por los que ya están. Sin esta cuenta el plan manda a caminar hasta el leño
   * y a levantarlo dos veces: una para deshilacharlo y otra para frotar contra
   * él —y la segunda `sostener` la rebota el mundo con `ya-lo-tengo`—.
   */
  readonly enMano: readonly BodyId[]
  /**
   * Los cuerpos que el plan YA SE COMIÓ: `union` consume la vara y la liana para
   * dar la caña (`world/src/step.ts`, caso `'join'`), y a partir de ese paso esos
   * dos ids no nombran nada.
   *
   * Sin esta cuenta el planificador se contradice a sí mismo, y está medido: el
   * rol `source` de `extraccion` sólo pide `mass > 0`, así que el matorral de la
   * pesca CALIFICA COMO POZO, está más cerca que el río, y el plan sale mandando
   * a pescar adentro del matorral que el paso anterior convirtió en caña.
   */
  readonly gastados: readonly BodyId[]
}

/**
 * Lo que se le puede cambiar a una corrida sin tocar el módulo.
 *
 * Existe por dos tests que no se pueden escribir sin él, y los dos son de los
 * que importan: «el mismo problema con `ESQUEMAS` en distinto orden da el mismo
 * plan» necesita barajar la tabla, y «qué `gap` produce cuando le sacás un
 * esquema» necesita sacarle uno. Un planificador que sólo sabe leer la constante
 * del módulo no se puede interrogar sobre su propia tabla.
 */
export interface OpcionesDePlan {
  readonly esquemas?: readonly ConstructionSchema[]
  /**
   * EL CATÁLOGO COMO VISTA EXPLÍCITA, con su core y su overlay de sesión.
   *
   * Es la puerta del Gate 5→6 y la que va a usar la mente. Gana sobre
   * `esquemas`, que queda como la escotilla de laboratorio que siempre fue: una
   * lista pelada de filas, sin identidad ni procedencia.
   *
   * El `import type` es a propósito y no un descuido: `catalogo.ts` importa
   * `ConstructionSchema` de este archivo, así que un import de VALOR sería un
   * ciclo en tiempo de ejecución. Un import de tipo se borra al compilar.
   */
  readonly catalogo?: PlannerCatalogView
}

export type PlanResult =
  /** Salió. `steps` está en orden de ejecución. */
  | { readonly k: 'plan'; readonly steps: readonly Step[]; readonly expansiones: number }
  /**
   * No hay esquema que establezca `missing`. NO es un error: es un CONTRATO
   * recién nacido, y `nearest` es lo que se puede hacer mientras tanto. El
   * Hito 8 lee esto y le pide a la fragua un proceso nuevo.
   */
  | {
      readonly k: 'gap'
      readonly missing: PredicateSignature
      readonly nearest: readonly Step[]
      readonly why: string
      readonly expansiones: number
    }
  /** Se acabó el presupuesto. Seguí el tick que viene con `frontera`. */
  | { readonly k: 'parcial'; readonly frontera: Frontera; readonly expansiones: number }

// ─── El presupuesto ──────────────────────────────────────────────────────────

/**
 * Cuántos nodos expande `plan()` por tick antes de guardar la frontera y
 * devolver `parcial`.
 *
 * El número sale del banco, no de la intuición: es el mayor que entra en el 8 ms
 * que el documento de arquitectura le presupuestó a D4. Si el banco deja de
 * cumplirlo, se baja ESTE número — nunca se sube el presupuesto del peldaño,
 * porque D4 comparte el tick con las otras 4999 criaturas.
 */
export const EXPANSIONES_POR_TICK = 64

/**
 * Hasta dónde encadena la regresión. Tres es lo que la pesca necesita
 * —extraccion ← union ← deshilachar— y uno más de margen.
 */
export const PROFUNDIDAD_MAXIMA = 4
