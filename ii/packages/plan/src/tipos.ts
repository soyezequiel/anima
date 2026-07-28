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

import type { ProcessId, QualityId, QualityTest } from '@anima/physics'
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
 */
export type Predicado =
  | { readonly k: 'cualidad'; readonly test: QualityTest }
  | { readonly k: 'geometria'; readonly f: string; readonly op: Comparador; readonly v: number }
  | { readonly k: 'sostiene'; readonly tag: string }

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
export interface ConstructionSchema {
  /** El predicado que este esquema establece, en firma. */
  readonly establishes: PredicateSignature
  /** Con qué proceso. */
  readonly via: ProcessId
  /** Qué le pide a cada rol, más allá de lo que el proceso ya exige. */
  readonly roleHints: Readonly<Record<RoleName, Where>>
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

// ─── Pasos ───────────────────────────────────────────────────────────────────

/**
 * Un paso del plan. Cada variante corresponde a una habilidad innata y sus
 * argumentos, con los `BodyView` reemplazados por `Ref`.
 *
 * NO están las quince: faltan `esperar`, `guarecerse`, `huirDelDolor`,
 * `seguirOrdenDeMovimiento` y `tantear`. Las cuatro primeras son conducta y no
 * plan —las emite la escalera de decisión, no la regresión—; `tantear` es
 * percepción activa y todavía no hay ningún objetivo que la pida. Cuando lo
 * haya, entra acá y no en un segundo tipo paralelo.
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
export interface MarcoDePlan {
  readonly via: ProcessId
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
