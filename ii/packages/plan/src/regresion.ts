// ─── @anima/plan/regresion.ts ────────────────────────────────────────────────
//
// LA CAÑA LA ARMA LA ARITMÉTICA, Y NADIE ESCRIBIÓ «CAÑA».
//
// Encadenado hacia atrás: se arranca del predicado que se quiere («tener algo
// carnoso en la mano»), se busca qué proceso lo establece, se mira qué le pide
// ese proceso a cada rol, y lo que NO se tiene se vuelve a preguntar. La pesca
// entera del documento de arquitectura sale de tres vueltas de eso y de ninguna
// rama cableada: no hay `if (hambre) pescar`, no hay una receta «caña», no hay
// una lista de objetos. Hay una tabla de qué establece qué y una búsqueda.
//
// ─── LO QUE NO ES, Y HAY QUE DECIRLO ANTES ──────────────────────────────────
//
// No es un planificador clásico sobre un espacio de ESTADOS. No hay simulación
// del futuro, no hay «aplicar el efecto y ver cómo queda el mundo»: el ADR
// II-0004 se lo prohíbe a las habilidades y acá no hace falta, porque la tabla
// de esquemas ya dice qué queda establecido. La consecuencia buena es que una
// expansión cuesta lecturas de la vista y nada más; la consecuencia incómoda es
// que **el plan es una hipótesis**, no una promesa. `can()` del mundo tiene la
// última palabra y va a rebotar cosas que acá salieron verdes. Eso está bien y
// es el reparto de trabajo: el planificador propone barato y el mundo dispone.
//
// ─── Y NO TODO LO QUE ESTABLECE ALGO ES UN PROCESO ──────────────────────────
//
// La tabla tiene dos clases de fila y la regresión las trata igual salvo en cinco
// preguntas concretas. Un `EsquemaDeProceso` termina en un `apply` que alguien
// paga con `stamina`; un `EsquemaDeLey` no termina en nada, porque **cocinar no es
// un proceso**: lo hace la ley 5 sobre todo cuerpo orgánico que esté en su
// ventana, y lo mismo vale para secar, pudrir y carbonizar. Lo que la regresión
// emite para una ley son POSICIONES —una pila de `poner`— y lo que la ley
// necesita para correr es que esas posiciones se sostengan un rato.
//
// Las cinco preguntas y sus dos respuestas están en el bloque «Las leyes, que no
// son procesos y contestan las mismas preguntas», abajo. Ninguna es una excepción
// metida a mano: son las mismas cinco que el bloque de arriba le hace a `Process`.
//
// ─── LAS NUEVE DECISIONES ───────────────────────────────────────────────────
//
// 1. SE REGRESA SOBRE LA TABLA, NO SOBRE EL ÍNDICE, Y POR IMPLICACIÓN Y NO POR
//    TEXTO. `SCHEMA_INDEX` está indexado por firma EXACTA, y lo que la regresión
//    necesita es otra pregunta: «los esquemas cuyas promesas ENTRAN TODAS en esta
//    conjunción». Dos cosas se apilan ahí. Una, que entra es SUBCONJUNTO:
//    `extraccion` le pide al `gear` `catch>0 ∧ reach>=2` —dos cláusulas— y ningún
//    esquema establece las dos; hay uno para cada una, los dos por `union`, y la
//    regresión los junta en UNA aplicación. El documento de arquitectura escribe
//    `SCHEMA_INDEX['catch>0 & reach>=2']` como si la llave conjuntiva existiera;
//    no existe, y no es un olvido del tramo de esquemas: cada trozo de
//    `Process.establishes` es UNA cláusula, así que una tabla derivada del
//    catálogo no puede tener llaves conjuntivas. Dos, que «entra» se pregunta con
//    `implica` y no con `includes`: `temperature>=400` GARANTIZA
//    `temperature>=399`, y mientras esto se comparó por texto el mismo plan de
//    cuatro pasos servía para los dos objetivos y el planificador sólo lo
//    encontraba para uno.
//
// 2. UN NODO ES UNA PILA DE APLICACIONES A MEDIO ARMAR. La pesca no es una
//    cadena: `extraccion` necesita `gear` Y `source`, y ninguno de los dos es
//    subobjetivo del otro. Con un `falta` por nodo —lo que el andamio daba— eso
//    no entra. La pila de `MarcoDePlan` es el nodo AND, y `falta` sigue siendo
//    uno solo porque es el rol del tope que toca ahora.
//
// 3. LO QUE YA SE CUMPLE NO SE PLANIFICA, Y VALE PARA LOS ROLES TAMBIÉN. Si un
//    cuerpo a la vista cumple el pedido, se liga y se sigue; no se abre además
//    la rama de fabricarlo. Es la regla 6 del encargo llevada hacia adentro, y
//    tiene su precio dicho: no hay vuelta atrás. Si el cuerpo elegido resulta
//    inservible tres pasos después, el plan se cae y la mente replanifica —que
//    es más barato que expandir las dos ramas 5000 veces por tick—.
//
// 4. EL COSTO SON LOS SEGUNDOS DE LOS PROCESOS Y NADA MÁS. La caminata NO entra,
//    y no porque no importe: importa mucho. Entra el día que la vista diga a qué
//    velocidad camina la criatura. Meter hoy un número inventado ahí ordenaría la
//    búsqueda por una ficción, y una búsqueda ordenada por una ficción elige mal
//    con cara de elegir bien. La consecuencia se ve en la pesca: los pasos salen
//    en orden de ROL y no de cercanía, así que el plan camina de más. Está
//    medido en el test y anotado como hueco.
//
// 5. LOS EMPATES SE ROMPEN POR CONTENIDO, NUNCA POR ORDEN DE LLEGADA. La cola se
//    ordena por costo y después por una clave de texto armada con TODO lo que el
//    nodo es (profundidad, pedido, pila, camino, manos). Desempatar por orden de
//    inserción sería desempatar por el orden de `ESQUEMAS`, y entonces barajar la
//    tabla —que no cambia lo que la física puede hacer— cambiaría el plan.
//
// 6. LA FRONTERA ES EL ESTADO ENTERO, INCLUIDOS LOS MUERTOS. `plan()` es anytime
//    de verdad: cortar en 1, 7 o 64 expansiones y seguir tiene que dar EL MISMO
//    resultado que una corrida sola. Eso obliga a que en la frontera viaje todo
//    lo que la búsqueda mira, y lo que se olvida siempre es lo mismo: las ramas
//    que ya murieron. Sin ellas el `gap` de una búsqueda cortada sería otro.
//
// 7. LOS CICLOS SE CORTAN CON EL LINAJE DEL NODO Y CON LA PROFUNDIDAD, LOS DOS.
//    El linaje es la propia pila de marcos: si lo que ahora falta GARANTIZA lo
//    que un marco de más abajo venía a establecer, conseguirlo pide tenerlo y la
//    rama muere. La profundidad alcanza para que una cadena infinita sin repetir
//    firma tampoco cuelgue, y ninguna de las dos sobra: un residuo intensivo que
//    viaja al rol material puede fabricar firmas nuevas para siempre sin repetir
//    ninguna. Acá hubo una lista de firmas COMPARTIDA POR TODA LA BÚSQUEDA y
//    cortaba de más: mataba ramas HERMANAS —sacarle dos hebras al mismo matorral
//    es legal, `split` no consume la fuente— con un mensaje que decía «más
//    arriba» sobre algo que estaba al lado.
//
// 8. EL PEDIDO DE UN ROL TIENE DOS MITADES, Y SÓLO UNA SE REGRESA. La firma es lo
//    que un proceso podría dejar establecido; el FILTRO es lo que ningún
//    `establishes` promete ni va a prometer y por lo tanto sólo se puede
//    encontrar: `portable > 0` cuando el `arrangement` es `held` (en la mano no
//    entra un tronco de 20 kg) y la condición de celda del esquema (un pozo está
//    en el agua). Mezclarlas hacía que el `gap` le pidiera a la fragua del Hito 8
//    un proceso para volver liviano un leño.
//
// 9. LO QUE EL MUNDO VA A REBOTAR NO SE EMITE. `capacity`, `portable` y la celda
//    del `source` son tres cosas que la vista contesta y que este módulo no
//    miraba, y las tres terminaban en un `Motivo` del mundo —`manos-llenas`,
//    `no-portable`, `sin-pozo`— después de haber mandado a caminar. Se pierden
//    planes que quizás habrían salido; es el error barato, el mismo que elige
//    `cumpleCuerpo`.
//
// Regla 2: no hay reloj, ni azar, ni `Math` trascendente, ni `await`. El
// presupuesto se mide en EXPANSIONES (ADR II-0012) y no en milisegundos, que es
// lo que hace que dos máquinas planifiquen igual.

import type { Effect, Process, QualityId, QualityTest, Yield } from '@anima/physics'
import { baseRoleName, isOptionalRole, specOf } from '@anima/physics'
import type { BodyId, BodyView, Cell, Where, WhereCell } from '@anima/skills'
import { distancia } from '@anima/skills/innatas'

import { CATALOGO_CORE, catalogoDe, esquemasDe } from './catalogo.js'
import { claveDeVia, procesoDe } from './esquemas.js'
import { cumple, cumpleCuerpo, firmaDe, implica, interpretar, textoDe } from './predicado.js'
import { resolver } from './referencias.js'
import type {
  ConstructionSchema,
  EsquemaDeLey,
  EsquemaDeObra,
  Frontera,
  GoalId,
  GoalNode,
  MarcoDePlan,
  MarcoPor,
  NodoAbierto,
  OpcionesDePlan,
  PedidoDeRol,
  PlanResult,
  Predicado,
  PredicateSignature,
  RamaMuerta,
  Ref,
  RoleName,
  Step,
  VistaDelPlan,
} from './tipos.js'
import { PROFUNDIDAD_MAXIMA } from './tipos.js'

// ─── Preguntarle al catálogo en vez de escribir una tabla ───────────────────
//
// Todo lo que este bloque contesta se podría escribir como cuatro filas: «de
// `union` sale un cuerpo nuevo», «`deshilachar` cobra al rol `actor`», «`friccion`
// calienta el rol `a`». Cuatro filas que hoy serían ciertas y que el día que el
// modelo escriba el quinto proceso quedarían mudas sobre él —que es el día para
// el que se hizo todo esto—. Así que se leen del `Process`, que es el mismo dato
// que el mundo va a ejecutar.

/**
 * ¿De aplicar esto sale un cuerpo NUEVO, o lo que promete queda sobre un cuerpo
 * que ya existía?
 *
 * La diferencia decide cómo lo nombra el paso de arriba. `union` consume la vara
 * y la liana y crea la caña con un id que no existía (`world/src/step.ts`, caso
 * `'join'`): el `extraccion` que la va a usar de `gear` sólo la puede nombrar
 * como `{k:'rinde'}`. `friccion` no tiene `completion`, no rinde nada, y los 400
 * grados quedan sobre el cuerpo que ya se le pasó como rol `a`: ahí el `Ref` del
 * rendimiento ES el `Ref` del rol.
 *
 * `transmute` cuenta como «no rinde cuerpo» y no es un descuido: transforma la
 * materia del rol en el lugar, sin id nuevo. Hoy el mundo lo rechaza con
 * `no-implementado`, así que ningún esquema puede apoyarse en él igual.
 */
function rindeCuerpoNuevo(p: Process): boolean {
  for (const y of p.completion?.yields ?? []) {
    if (y.k === 'join' || y.k === 'split' || y.k === 'drawFromStock') return true
  }
  return false
}

/**
 * EL ROL MATERIAL: de cuál de los roles sale lo que se obtiene.
 *
 * Sirve para dos cosas y las dos son estructurales. Una: cuando el proceso no
 * rinde cuerpo nuevo, el rendimiento ES ese rol. Dos: es el único rol al que
 * tiene sentido pasarle un residuo —una cláusula que la conjunción pedía y que
 * ningún esquema del proceso establece—, porque es el que aporta la materia y
 * por lo tanto sus cualidades intensivas.
 *
 * Sale del `Yield` y no de una tabla: `split` parte al `role`, `join` se queda
 * con la forma y las partes de `a` (`unir` en `physics/src/leyes.ts`:
 * `form: a.form`), `transmute` transforma al `role`. `drawFromStock` no tiene
 * ninguno —lo que sale del pozo lo decreta el dios, no lo aporta ningún rol— y
 * por eso devuelve `undefined`: pasarle un residuo a la caña con la que se pesca
 * sería pedirle a la caña que tenga las cualidades del pescado.
 *
 * Sin `completion` se mira el `drive`: `friccion` empuja la temperatura del rol
 * `on`, o sea `a`, y ése es el cuerpo que queda caliente.
 */
function rolMaterialDe(p: Process): RoleName | undefined {
  for (const y of p.completion?.yields ?? []) {
    const r = rolDeRendimiento(y)
    if (r !== undefined) return r
  }
  for (const e of p.effects) {
    if (e.k === 'drive') return baseRoleName(e.on)
  }
  return undefined
}

function rolDeRendimiento(y: Yield): RoleName | undefined {
  switch (y.k) {
    case 'split':
      return baseRoleName(y.role)
    case 'join':
      return baseRoleName(y.a)
    case 'transmute':
      return baseRoleName(y.role)
    case 'drawFromStock':
      return undefined
  }
}

/**
 * EL ROL QUE PAGA, que es siempre la criatura y nunca se planifica.
 *
 * La tentación es mirar si el rol se llama `'actor'`. No se hace, por lo mismo de
 * siempre: un proceso que escriba el modelo puede llamarlo `quien` y la regla se
 * quedaría muda. Lo que se mira es de dónde sale la `stamina` —el `poweredBy` de
 * un `drive` o el `drain` de un `drain`—, porque `stamina` es la cualidad
 * conservada que sólo tienen las criaturas.
 *
 * Y una vez encontrado, sus condiciones se verifican CONTRA LA CRIATURA. Ése es
 * medio hueco menos de los que el tramo de esquemas dejó anotados: `friccion`
 * pide `stamina >= 1` y `deshilachar` `stamina >= 3`, y una criatura vacía deja
 * de planificar un fuego que no le va a salir. El otro medio sigue abierto y hay
 * que decirlo: el techo de `heatCapacity` del esquema es el de un tanque LLENO,
 * y eso no se verifica acá porque el esquema no dice a cuánta stamina se calculó.
 */
function rolQuePaga(p: Process): RoleName | undefined {
  for (const e of p.effects) {
    const r = rolPagadorDe(e)
    if (r !== undefined) return r
  }
  return undefined
}

function rolPagadorDe(e: Effect): RoleName | undefined {
  if (e.k === 'drive' && e.poweredBy?.q === 'stamina') return baseRoleName(e.poweredBy.from)
  if (e.k === 'drain' && e.q === 'stamina') return baseRoleName(e.on)
  return undefined
}

/**
 * ¿Hay que tenerlo en la mano, o alcanza con estar cerca?
 *
 * `arrangement: {k:'held'}` son los tres procesos de taller —atar, deshilachar,
 * frotar— y ahí el paso `sostener` no es una cortesía: sin él, `can()` rebota. El
 * pozo de peces es `{k:'within', radius:1}` y no se levanta: se pesca desde la
 * orilla. Se lee del catálogo porque la superficie no lo dice —lo dice `can()`
 * cuando ya es tarde—, que es exactamente lo que anota el contrato de `unir`.
 */
function hayQueTenerloEnLaMano(p: Process): boolean {
  return p.arrangement.k === 'held'
}

/** A qué distancia hay que llegar. `within` trae la suya; el resto, pegado. */
function alcanceDe(p: Process): number {
  return p.arrangement.k === 'within' ? p.arrangement.radius : 1
}

/** Qué cuerpos deja de haber después de aplicar esto. */
function consumidosPor(p: Process, roles: Readonly<Record<RoleName, Ref>>): readonly BodyId[] {
  const out: BodyId[] = []
  const anotar = (rol: string | undefined): void => {
    if (rol === undefined) return
    const ref = roles[baseRoleName(rol)]
    if (ref !== undefined && ref.k === 'id' && !out.includes(ref.id)) out.push(ref.id)
  }
  for (const y of p.completion?.yields ?? []) {
    switch (y.k) {
      case 'join':
        // Las tres piezas se van: `sacarCuerpo` las saca del mundo y de las manos.
        anotar(y.a)
        anotar(y.b)
        anotar(y.via)
        break
      case 'transmute':
        anotar(y.role)
        break
      // `split` NO consume: el `resto` vuelve al mundo con el mismo id, que es lo
      // que hace posible deshilachar el leño y después frotar contra el leño.
      case 'split':
      case 'drawFromStock':
        break
    }
  }
  return out
}

/** Lo que el proceso ya le exige a un rol. Lanza si el esquema nombra un rol que no existe. */
function whereDelProceso(p: Process, rol: RoleName): Where | undefined {
  for (const r of p.roles) if (baseRoleName(r.name) === rol) return r.where
  return undefined
}

/**
 * Los roles SIN los que el proceso no corre, leídos del sufijo `?` del nombre.
 *
 * `Role` no tiene campo `optional` y la opcionalidad viaja en el nombre —`'b?'`—
 * a propósito, así que la pregunta se le hace a `isOptionalRole` del catálogo y
 * no a una lista de acá. Un proceso que el modelo escriba mañana declara su rol
 * opcional y esta función lo entiende sin que nadie la toque.
 */
function rolesObligatorios(p: Process): readonly RoleName[] {
  const out: RoleName[] = []
  for (const r of p.roles) if (!isOptionalRole(r.name)) out.push(baseRoleName(r.name))
  return out
}

/**
 * EL PEDIDO QUE EL `arrangement` AGREGA Y NINGÚN ESQUEMA ESCRIBE: `portable > 0`.
 *
 * `arrangement: {k:'held'}` quiere decir que el mundo va a exigir los cuerpos EN
 * LA MANO al mismo tiempo (`arregloOk`), y en la mano no entra cualquier cosa:
 * `portable` es `step(PORTABLE_MAX_MASS, mass)`, o sea cero en cuanto la masa
 * pasa de 8 kg, y `take` rebota con `no-portable`. Medido: el rol `b` de
 * `friccion` sólo pide `rigidity >= 0.5`, así que un tronco de 20 kg calificaba,
 * y como estaba más cerca que la ramita, GANABA — el plan salía verde y el mundo
 * contestaba `no-portable`.
 *
 * Sale del `arrangement` y no de las ocho filas por la misma razón que
 * `segundos` sale de `completion`: escribirlo en cada fila sería la segunda copia
 * de una regla que el `Process` ya dice, y quedaría muda sobre el proceso que
 * escriba el modelo. Un proceso nuevo que pida `held` hereda esta exigencia sola.
 */
const PORTABLE: QualityTest = { q: 'portable', op: '>', v: 0 }

// ─── Las leyes, que no son procesos y contestan las mismas preguntas ─────────
//
// Todo lo que este bloque hace es contestar, para una fila de ley, las mismas
// cinco preguntas que el bloque de arriba le hace a un `Process`: qué roles
// necesita, cuál aporta la materia, quién paga, qué hay que llevar en la mano y a
// qué distancia. Las respuestas son distintas y ninguna es una excepción:
//
//   roles      los que la fila nombra, y son obligatorios TODOS —una ley no tiene
//              roles opcionales porque no tiene una firma que llenar: tiene una
//              situación que armar, y una situación a la que le falta un cuerpo
//              no es esa situación.
//   material   el `sujeto`: es el cuerpo sobre el que la ley empuja, así que es a
//              él a quien se le puede pedir el residuo.
//   paga       NADIE. Una ley no cuesta `stamina`: corre igual con la criatura
//              dormida, y ése es justo el punto del ADR II-0011 —el fuego le
//              sobrevive a la mano que lo hizo—.
//   en la mano lo que está APOYADO en la pila hay que haberlo levantado, así que
//              la exigencia de `portable` sale de estar en `pila` y no de un
//              `arrangement`. El primero de la pila no: a un fuego no se lo alza.
//   alcance    una celda. `poner` exige Chebyshev ≤ 1 de la celda destino.

/** El nombre con el que un marco se cuenta en un mensaje de rechazo o en una clave. */
function nombreDeVia(por: MarcoPor): string {
  if (por.k === 'proceso') return por.via
  if (por.k === 'obra') return `la obra ${por.esquema.revision}`
  return `ley ${por.esquema.ley}`
}

/**
 * Los roles sin los que la situación no es la situación: los de la pila más el
 * sujeto. Sale de los dos campos y no de `Object.keys(roleHints)` a propósito: un
 * `roleHint` de más es una condición sobre un rol que nadie llena, y eso hay que
 * poder decirlo.
 */
function rolesDeLaLey(e: EsquemaDeLey): readonly RoleName[] {
  const out: RoleName[] = [...e.pila]
  if (!out.includes(e.sujeto)) out.push(e.sujeto)
  return out
}

/**
 * LO QUE EL SUJETO YA TENÍA QUE SER, DERIVADO DE LA PROMESA Y NO DECLARADO.
 *
 * Una ley mueve CUALIDADES y nada más: la ley 5 baja `toxicity` y sube
 * `digestibility`, y no convierte una piedra en carne. O sea que de todo lo que la
 * fila promete, las cláusulas de cualidad las pone la ley y **todo el resto lo
 * tenía que traer el sujeto**. Eso es una regla sobre qué son las leyes, no un
 * campo más en la tabla, y por eso se despeja acá en vez de escribirse en la fila.
 *
 * Para `holding(tag:carnoso,digestibility>=0.85,toxicity<=0.05)` despeja
 * `holding(tag:carnoso)`: hay que conseguir algo carnoso —y el catálogo sabe, es
 * `extraccion`— y la ley se encarga del resto. Para una promesa que sea una
 * cualidad pelada despeja la firma vacía, que es «no le pido nada más».
 */
function loQueElSujetoYaTraia(e: EsquemaDeLey): PredicateSignature {
  const p = interpretar(e.establishes)
  if (p === undefined || p.k !== 'sostiene') return ''
  return textoDe({ k: 'sostiene', tag: p.tag })
}

/**
 * ¿LO QUE PROMETE ES SOBRE LA MANO?
 *
 * De acá sale el último paso, y sale de la FORMA del predicado y no de un campo:
 * la ley deja la comida donde estaba —arriba de la parrilla— así que una promesa
 * que habla de la mano obliga a volver a levantarla, y una que habla de un cuerpo
 * no. Un `recupera: true` en la fila diría lo mismo y podría mentir; esto no puede.
 */
function prometeSobreLaMano(firma: PredicateSignature): boolean {
  return interpretar(firma)?.k === 'sostiene'
}

// ─── Firmas y cláusulas ─────────────────────────────────────────────────────

/**
 * Una firma conjuntiva de vuelta en cláusulas. `undefined` si alguna no se
 * entiende, y eso NO se saltea: una conjunción de la que se descarta un trozo es
 * una conjunción más floja, o sea una promesa más grande que la que se puede
 * cumplir. Es el pecado de `parsePromesa` visto desde el otro lado.
 *
 * ─── LA FIRMA VACÍA ES CERO CLÁUSULAS, NO UNA CLÁUSULA ILEGIBLE ─────────────
 *
 * Y la diferencia no es filosófica: costó un bug. `union` declara su rol `a` con
 * `where: []` y el esquema de `catch>0` lo pide con `a: []`, así que hay un rol
 * REAL de la tabla semilla cuya exigencia es la conjunción vacía —«cualquier
 * cosa sirve»—. Devolviendo `undefined` ahí, `armarMarco` rechazaba `union`
 * entera con el motivo «el pedido del rol no se entiende», y la única razón de
 * que la pesca funcionara igual es que ese rol se pide JUNTO con `reach>=2`, que
 * sí trae cláusula. El día que alguien pidiera `catch>0` solo, no había caña.
 *
 * Se descubrió por mutación —el desempate de la cola no se podía probar porque
 * la rama que debía empatar moría antes— y está pinado por su propio test.
 */
function clausulasDe(firma: PredicateSignature): readonly Predicado[] | undefined {
  const out: Predicado[] = []
  for (const trozo of firma.split('&')) {
    if (trozo.length === 0) continue
    const p = interpretar(trozo)
    if (p === undefined) return undefined
    out.push(p)
  }
  return out
}

/** Los tests de cualidad de una conjunción, para pedírselos al índice del mundo. */
function testsDe(clausulas: readonly Predicado[]): QualityTest[] {
  const out: QualityTest[] = []
  for (const p of clausulas) if (p.k === 'cualidad') out.push(p.test)
  return out
}

/**
 * Hasta qué temperatura hay que frotar, leído del predicado que se persigue.
 *
 * Sin esto, `frotar` cae en su valor por defecto —`ignitionPoint` del cuerpo— y
 * eso es OTRA cosa: el objetivo `temperature>=400` de `friccion` no es el punto
 * de ignición de nadie, es el techo al que empuja el proceso. Dejar que se
 * confundan hace que la criatura frote de menos o de más según qué agarró.
 */
function hastaDe(clausulas: readonly Predicado[]): number | undefined {
  for (const p of clausulas) {
    if (p.k !== 'cualidad') continue
    if (p.test.q !== 'temperature') continue
    if (p.test.op !== '>=' && p.test.op !== '>') continue
    return p.test.v
  }
  return undefined
}

/** Las claves de un registro, en orden total. `<` y no `localeCompare`: regla 2. */
function nombresOrdenados(r: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.keys(r).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

// ─── Elegir un cuerpo de los que se ven ─────────────────────────────────────

/**
 * El cuerpo que cumple TODA la conjunción, o `undefined`.
 *
 * El orden de preferencia tiene dos escalones y los dos son totales:
 *
 *   1. LO QUE YA ESTÁ EN LA MANO GANA. No es cariño por lo propio: un cuerpo en
 *      la mano no cuesta ni caminata ni `sostener`, y encima viaja con la
 *      criatura, así que ningún paso posterior lo puede perder de vista. Cuenta
 *      como «en la mano» lo que el plan YA se comprometió a agarrar, no sólo lo
 *      que está agarrado hoy: el plan es una secuencia, y para cuando llegue el
 *      paso, la mano va a estar llena de lo que los pasos de antes pusieron.
 *   2. DESPUÉS, EL MÁS CERCANO, Y EL EMPATE LO ROMPE EL `id`. La métrica es la
 *      `distancia` de `@anima/skills/innatas` —Chebyshev, la de `aMano()`—
 *      IMPORTADA, la misma que usa `referencias.ts`. Dos métricas contra el mismo
 *      `within` es el bug que en la grilla se ve como «a veces no llega».
 *
 * `see(tests)` es un PREFILTRO y no la respuesta: las geometrías no entran en un
 * `Where`, y los cuerpos en la mano pueden no venir en `see`. La última palabra
 * la tiene `cumpleCuerpo` sobre cada cláusula, que es la misma definición de
 * «este cuerpo lo cumple» que usa el resto del paquete.
 *
 * `excluidos` son dos cosas: los cuerpos que este mismo marco ya ligó a otro rol
 * —una vara no se frota contra sí misma, y `friccion` con `a === b` es un proceso
 * que el mundo rebota después de haber gastado el turno— y los que el plan YA SE
 * COMIÓ. Lo segundo no es refinamiento: sin eso, el plan de la pesca manda a
 * pescar adentro del matorral que el paso anterior convirtió en caña, porque el
 * rol `source` de `extraccion` sólo pide `mass > 0` y el matorral está más cerca
 * que el río.
 */
function elegirCuerpo(
  clausulas: readonly Predicado[],
  extra: Extra,
  v: VistaDelPlan,
  enMano: readonly BodyId[],
  excluidos: readonly BodyId[],
  preferido?: BodyId,
): BodyView | undefined {
  return candidatosPara(clausulas, extra, v, enMano, excluidos, preferido).mejor
}

/**
 * Lo que un rol pide y no se puede fabricar: se filtra y no se regresa.
 *
 * Es `PedidoDeRol` sin la firma — la firma es lo otro, lo que sí se regresa—, y
 * está acá como tipo propio para que las cuatro funciones que lo pasan de mano en
 * mano no lo desarmen en dos parámetros que un día alguien va a mezclar.
 */
interface Extra {
  readonly filtro?: Where
  readonly celda?: WhereCell
  /**
   * «Este rol no lo puede llenar algo que la criatura tenga agarrado.» No es una
   * cualidad —ver `PedidoDeRol.noDeLaMano`— y por eso viaja como bandera y no como
   * cláusula: `candidatosPara` la contesta con la lista de la mano, que ya tenía
   * en la mano para desempatar.
   */
  readonly noDeLaMano?: true
}

const SIN_EXTRA: Extra = {}

/** Las cláusulas del filtro de cuerpo, en el vocabulario de `Predicado`. */
function comoPredicados(w: Where | undefined): readonly Predicado[] {
  if (w === undefined) return []
  return w.map((test) => ({ k: 'cualidad', test }) as const)
}

/**
 * ¿La celda donde está este cuerpo cumple lo que el rol le pide al lugar?
 *
 * Se pregunta con `v.qAt`, que es la misma lectura de terreno que va a hacer la
 * habilidad cuando ejecute. Sin condición, cualquier celda sirve — que es el caso
 * de siete de las ocho filas.
 */
function cumpleCelda(celda: WhereCell | undefined, at: Cell, v: VistaDelPlan): boolean {
  if (celda === undefined) return true
  for (const t of celda) {
    const x = v.qAt(at, t.q)
    const pasa = t.op === '>=' ? x >= t.v : t.op === '<=' ? x <= t.v : t.op === '>' ? x > t.v : x < t.v
    if (!pasa) return false
  }
  return true
}

/**
 * El mejor candidato Y CUÁNTOS HAY, del mismo barrido.
 *
 * El conteo no es curiosidad: es lo que ordena los roles. Ver `armarMarco`.
 */
function candidatosPara(
  clausulas: readonly Predicado[],
  extra: Extra,
  v: VistaDelPlan,
  enMano: readonly BodyId[],
  excluidos: readonly BodyId[],
  /**
   * EL QUE EL CUIDADOR SEÑALÓ. Gana **entre los que cumplen**, no en vez de ellos.
   *
   * Va acá adentro y no como un filtro afuera por una razón: si el señalado ya no
   * está —se lo llevó el agua, lo consumió una ley— un filtro dejaría a la
   * criatura sin candidatos y sin plan, y una referencia vieja no puede costar
   * eso. Como preferencia, lo peor que pasa es que se elija otro.
   */
  preferido?: BodyId,
): { readonly mejor: BodyView | undefined; readonly cuantos: number } {
  const lector = (b: BodyView, id: QualityId): number => v.q(b, id)
  const filtro = comoPredicados(extra.filtro)
  // Las dos manos que existen, unidas: la de AHORA (`v.self.holding`) y la que el
  // plan promete (`enMano`, que el nodo raíz siembra con la de ahora y que los
  // pasos van editando). Se unen y no se elige una porque las dos mienten por
  // separado: `enMano` pierde lo que un paso consume, y `holding` no sabe de los
  // pasos. Sólo se construye si alguien va a preguntar.
  const mano: ReadonlySet<BodyId> =
    extra.noDeLaMano === true ? new Set<BodyId>([...enMano, ...v.self.holding.map((b) => b.id)]) : new Set<BodyId>()
  const vistos = new Set<BodyId>()
  let mejor: BodyView | undefined
  let mejorEnMano = false
  let mejorD = 0
  let cuantos = 0
  /** El señalado, si pasó TODOS los filtros. Se decide al final. */
  let elSenalado: BodyView | undefined

  const mirar = (b: BodyView): void => {
    // La criatura no se presta como material: el único rol que puede jugar es el
    // que paga, y ése se liga a `{k:'yo'}` sin pasar por acá.
    if (b.id === v.self.id) return
    if (excluidos.includes(b.id)) return
    // ─── LO QUE UNO LLEVA PUESTO NO ES EL RÍO ────────────────────────────────
    //
    // La exclusión por TENENCIA, y va acá arriba junto a las otras dos de su misma
    // clase —la criatura, lo ya ligado— y no abajo con las cláusulas: no se le
    // pregunta nada al cuerpo, se pregunta dónde está. `mano` está vacío cuando
    // nadie lo pidió, así que esto le cuesta una consulta a un `Set` vacío a las
    // nueve filas que no lo declaran.
    if (mano.has(b.id)) return
    if (vistos.has(b.id)) return
    vistos.add(b.id)
    for (const p of clausulas) if (!cumpleCuerpo(p, b, lector)) return
    for (const p of filtro) if (!cumpleCuerpo(p, b, lector)) return
    // La celda se pregunta DESPUÉS de las cláusulas de cuerpo y no antes: es una
    // lectura de terreno por candidato, y las cláusulas ya descartaron casi todo.
    if (!cumpleCelda(extra.celda, b.at, v)) return
    cuantos++
    // Se anota DESPUÉS de los filtros: señalar algo que no cumple no lo vuelve
    // candidato. Y no corta el barrido, porque `cuantos` tiene que seguir siendo
    // cuántos hay — es lo que distingue «no hay ninguno» de «hay y elegí uno».
    if (b.id === preferido) elSenalado = b
    const suyoEnMano = enMano.includes(b.id)
    const d = distancia(b.at, v.self.at)
    if (mejor === undefined || ganaA(suyoEnMano, d, b.id, mejorEnMano, mejorD, mejor.id)) {
      mejor = b
      mejorEnMano = suyoEnMano
      mejorD = d
    }
  }

  for (const b of v.self.holding) mirar(b)
  for (const b of v.see([...testsDe(clausulas), ...(extra.filtro ?? [])])) mirar(b)
  // El señalado gana al desempate por cercanía, que es exactamente lo que una
  // corrección viene a decir: «ése no, el otro» sólo tiene sentido si el otro
  // puede ganarle al que estaba más a mano.
  return { mejor: elSenalado ?? mejor, cuantos }
}

/** Los tres criterios en una sola comparación: separarlos deja ventanas de empate. */
function ganaA(
  enMano: boolean,
  d: number,
  id: BodyId,
  otroEnMano: boolean,
  otroD: number,
  otroId: BodyId,
): boolean {
  if (enMano !== otroEnMano) return enMano
  if (d !== otroD) return d < otroD
  return id < otroId
}

// ─── Emitir los pasos de un marco ya completo ───────────────────────────────

interface Emision {
  readonly pasos: readonly Step[]
  readonly enMano: readonly BodyId[]
  readonly gastados: readonly BodyId[]
}

/** Lo que devuelve todo lo que puede fracasar sin que sea un error de programa. */
interface Rechazo {
  readonly rechazo: string
}

/**
 * Un marco con todos los roles resueltos se convierte en pasos: primero ir a
 * buscar cada pieza (y agarrarla, si el proceso las quiere en la mano), después
 * aplicar.
 *
 * El orden entre los roles es el ALFABÉTICO del nombre del rol, y hay que decir
 * lo que eso cuesta: la pesca sale con `ir(vara)` antes que `ir(matorral)`
 * porque `a < binder`, aunque el matorral esté más cerca. Ordenar por cercanía
 * sería mejor plan y peor honestidad: el costo de la búsqueda no cuenta la
 * caminata (decisión 4), así que optimizarla acá sería optimizar algo que la
 * búsqueda no midió, con un criterio que se evalúa sobre la vista de HOY y se
 * ejecuta decenas de ticks después. Queda anotado como hueco.
 *
 * Los `Ref` que no son `id` no generan caminata y eso es exacto: `{k:'yo'}` es la
 * criatura, que ya está donde está, y `{k:'rinde'}` es algo que el paso anterior
 * acaba de fabricar —y lo que se fabrica con las manos queda en las manos
 * (`destinoDeUnNacido`)—.
 */
function emitirMarco(
  m: MarcoDePlan,
  enMano: readonly BodyId[],
  gastados: readonly BodyId[],
  capacidad: number,
): Emision | Rechazo {
  if (m.por.k === 'ley') return emitirLey(m, m.por.esquema, enMano, gastados, capacidad)
  if (m.por.k === 'obra') return emitirObra(m, m.por.esquema, enMano, gastados, capacidad)
  const p = procesoDe(m.por.via)
  const aLaMano = hayQueTenerloEnLaMano(p)
  const alcance = alcanceDe(p)
  const pasos: Step[] = []
  const mano: BodyId[] = [...enMano]

  for (const rol of nombresOrdenados(m.roles)) {
    const ref = m.roles[rol]
    if (ref === undefined || ref.k !== 'id') continue
    if (mano.includes(ref.id)) continue
    const porQue = m.porRol[rol] ?? m.establece
    pasos.push({ k: 'ir', a: ref, within: alcance, porQue })
    if (aLaMano) {
      // ─── LAS MANOS SON DOS, Y HASTA ACÁ EL PLAN CONTABA HASTA INFINITO ────
      //
      // `arregloOk` exige que TODOS los cuerpos ligados estén agarrados al mismo
      // tiempo, y `take` rebota con `manos-llenas` en cuanto se pasa de
      // `capacity`. Medido: con `capacity: 1` y dos varas, el plan salía
      // «ir(v1)·sostener(v1)·ir(v2)·sostener(v2)·frotar» y el mundo contestaba
      // `manos-llenas` en el segundo `sostener`.
      //
      // Se RECHAZA en vez de soltar algo, y hay que decir de qué lado se
      // equivoca. Soltar sería mejor plan —`poner` está en `Step`— y es una
      // decisión más grande que ésta: hay que elegir QUÉ se suelta (lo que
      // ningún marco de la pila vaya a volver a pedir, y la pila no lo sabe
      // hasta que cierra) y DÓNDE, y `poner` quiere un `Ref` de celda, o sea una
      // foto de dónde está la criatura HOY para un paso que se ejecuta decenas
      // de ticks después. Rechazar pierde planes que habrían salido; emitir un
      // `sostener` que el mundo rebota manda a la criatura a hacer un viaje al
      // pedo. Es el error barato, el mismo que elige `cumpleCuerpo`.
      //
      // Y la cuenta es CONSERVADORA por otro lado más: `enMano` nunca se vacía
      // sola. Lo que un marco anterior mandó a agarrar sigue contando aunque ya
      // no lo necesite nadie, porque el plan no tiene ningún paso que suelte.
      if (mano.length >= capacidad) {
        return {
          rechazo:
            `«${m.establece}» por «${nombreDeVia(m.por)}» necesita «${ref.id}» en la mano y no entra: ` +
            `la mano ya lleva ${String(mano.length)} y la capacidad es ${String(capacidad)}`,
        }
      }
      pasos.push({ k: 'sostener', que: ref, porQue })
      mano.push(ref.id)
    }
  }

  pasos.push(pasoDelProceso(m, p))
  const consumidos = consumidosPor(p, m.roles)
  const comidos = [...gastados]
  for (const id of consumidos) if (!comidos.includes(id)) comidos.push(id)
  return { pasos, enMano: mano.filter((id) => !consumidos.includes(id)), gastados: comidos }
}

/**
 * UNA OBRA NO SE APLICA NI SE ESPERA: SE ARMA, Y LA ARMA UNA HABILIDAD.
 *
 * Es el tercer emisor, y el único cuyo paso final no le pide nada al mundo sino a
 * una habilidad. El porqué está entero en `EsquemaDeObra` de `tipos.ts`, y en una
 * frase: **cada `union` produce un ensamble nuevo y el siguiente lo necesita como
 * argumento, y no hay `Ref` que pueda nombrar un cuerpo que todavía no nació**.
 * Enumerar las N−1 uniones acá obligaría a inventar ese `Ref`.
 *
 * Lo que sí emite, y es lo mismo que emite un proceso: **ir a buscar cada pieza y
 * agarrarla**. `union` pide `arrangement: { k: 'held' }` para sus tres roles, así
 * que todo lo que va a entrar en la obra tiene que pasar por las manos.
 *
 * ─── LA CUENTA DE LAS MANOS, QUE ES DONDE ESTO SE CAE ─────────────────────
 *
 * Y se cae de verdad: una obra de N piezas necesita **N piezas más N−1 atadores**
 * —once cuerpos para seis piezas, medido en el tramo C·bis— y las manos son
 * cuatro. La cuenta se hace acá, con `cuantos`, y se RECHAZA con el número
 * adelante en vez de emitir un plan que el mundo va a rebotar con `manos-llenas`
 * en la tercera unión.
 *
 * De qué lado se equivoca: rechazar pierde planes que habrían salido soltando
 * algo en el medio. Emitirlos manda a la criatura a hacer un viaje al pedo. Es el
 * mismo error barato que elige `emitirMarco`, y por el mismo motivo — soltar pide
 * decidir QUÉ y DÓNDE, y `poner` quiere un `Ref` de celda, o sea una foto de hoy
 * para un paso que corre decenas de ticks después.
 *
 * ─── LO QUE ESTO NO CHEQUEA, Y HAY QUE DECIRLO ────────────────────────────
 *
 * Que el plano sea CONSTRUIBLE. Eso ya lo hizo `definirPlano` en la física —las
 * juntas son piezas−1, el grafo es conexo, la hondura entra en `MAX_ASSEMBLY_DEPTH`—
 * y volver a hacerlo acá sería una segunda verdad sobre lo mismo. Acá sólo se
 * chequea lo que este emisor puede saber: si lo que hay que juntar entra en las
 * manos.
 */
function emitirObra(
  m: MarcoDePlan,
  e: EsquemaDeObra,
  enMano: readonly BodyId[],
  gastados: readonly BodyId[],
  capacidad: number,
): Emision | Rechazo {
  const pasos: Step[] = []
  const mano: BodyId[] = [...enMano]
  const quien = `«${m.establece}» por la obra ${e.revision}`

  // ─── EL LÍMITE DE HOY, MEDIDO, Y ES LO PRIMERO QUE SE CHEQUEA ─────────────
  //
  // **La regresión liga UN cuerpo por rol.** `MarcoDePlan.roles` es
  // `Record<RoleName, Ref>` y un `Ref` nombra un cuerpo, así que un rol que
  // necesita DOS —un atador que aparece en dos juntas— sale del plan con uno solo.
  //
  // Medido, y es un plan verde que no se puede construir: con el plano de tres
  // piezas y dos juntas, y tres hebras a la vista, el plan salía con
  // `cola=h1 · punta=h2 · atadura=h0` y ninguna hebra libre para la segunda
  // atadura. La criatura ataba una junta y se quedaba parada.
  //
  // Se rechaza en vez de emitirlo, y de este lado se equivoca a propósito: pierde
  // planes que se podrían armar yendo a buscar la segunda atadura en el medio, y
  // no manda a nadie a un viaje que termina en una obra a medias. Es el mismo
  // criterio con el que `emitirMarco` rechaza cuando las manos no alcanzan.
  //
  // Lo que falta para levantarlo NO es este chequeo: es que un rol pueda ligar N
  // cuerpos, o sea `Record<RoleName, readonly Ref[]>`, y eso toca la búsqueda
  // entera —`candidatosPara`, el orden por rol más apretado, la frontera—. Tiene
  // su `it.fails` con este número en
  // `tests/construir-y-usar-se-publican-aparte.test.ts`.
  //
  // Y no deja afuera el caso de aceptación: la caña es `unir(vara, ·, hebra)` con
  // el binder siendo su propio extremo, o sea **un cuerpo por rol** (ver
  // `cuantosCuerpos`). Lo que queda afuera son los planos con un atador compartido.
  // SIN JUNTAS NO HAY NADA QUE ATAR, y el paso que se emitiria no se puede correr:
  // `construir` lo rechaza en su primera linea. `definirPlano` ya no deja definir
  // un plano asi, pero `opciones.esquemas` es entrada publica y una fila escrita a
  // mano llega hasta aca. Y hay un agravante medido: `esquemaDeObra` le pone
  // `segundos = juntas.length`, o sea COSTO CERO, asi que esa fila le gana a
  // cualquier via que si se pueda ejecutar.
  if (e.juntas.length === 0) {
    return { rechazo: `${quien} no declara ninguna junta: no hay nada que atar` }
  }

  const multiples = nombresOrdenados(e.cuantos).filter((r) => (e.cuantos[r] ?? 0) > 1)
  if (multiples.length > 0) {
    return {
      rechazo:
        `${quien} necesita más de un cuerpo para ${multiples.map((r) => `«${r}» (${String(e.cuantos[r] ?? 0)})`).join(' y ')}, ` +
        `y el plan liga UN cuerpo por rol: la obra saldría a medias`,
    }
  }

  // CUÁNTOS CUERPOS EN TOTAL. Es la suma de `cuantos`, y es lo que tiene que
  // caber: los atadores se consumen DE A UNO por unión, pero todos tienen que
  // estar juntados antes de la primera —no hay paso que vuelva a buscar.
  let hacenFalta = 0
  for (const rol of nombresOrdenados(e.cuantos)) hacenFalta += e.cuantos[rol] ?? 0
  if (hacenFalta > capacidad) {
    return {
      rechazo:
        `${quien} necesita ${String(hacenFalta)} cuerpos juntados a la vez ` +
        `(${nombresOrdenados(e.cuantos)
          .map((r) => `${String(e.cuantos[r] ?? 0)}× «${r}»`)
          .join(' + ')}) y la capacidad es ${String(capacidad)}`,
    }
  }

  for (const rol of nombresOrdenados(m.roles)) {
    const ref = m.roles[rol]
    if (ref === undefined || ref.k !== 'id') continue
    if (mano.includes(ref.id)) continue
    const porQue = m.porRol[rol] ?? m.establece
    // Alcance 1: `take` exige Chebyshev ≤ 1, igual que para cualquier proceso.
    pasos.push({ k: 'ir', a: ref, within: 1, porQue })
    if (mano.length >= capacidad) {
      return {
        rechazo:
          `${quien} necesita «${ref.id}» en la mano y no entra: ` +
          `la mano ya lleva ${String(mano.length)} y la capacidad es ${String(capacidad)}`,
      }
    }
    pasos.push({ k: 'sostener', que: ref, porQue })
    mano.push(ref.id)
  }

  pasos.push({
    k: 'armar',
    revision: e.revision,
    roles: m.roles,
    cuantos: e.cuantos,
    juntas: e.juntas,
    porQue: m.establece,
    rinde: m.rinde,
  })

  // TODO lo que entró se gasta, y ésa es la diferencia con un proceso: las piezas
  // quedan adentro de la obra y los atadores se consumen en las juntas. Lo que
  // sale es un cuerpo NUEVO, que se nombra por `rinde`.
  const consumidos = mano.filter((id) => !enMano.includes(id) || esDeLaObra(id, m))
  const comidos = [...gastados]
  for (const id of consumidos) if (!comidos.includes(id)) comidos.push(id)
  return { pasos, enMano: mano.filter((id) => !consumidos.includes(id)), gastados: comidos }
}

/** Si este id quedó ligado a algún rol de la obra. Lo que se liga, se consume. */
function esDeLaObra(id: BodyId, m: MarcoDePlan): boolean {
  for (const rol of nombresOrdenados(m.roles)) {
    const r = m.roles[rol]
    if (r !== undefined && r.k === 'id' && r.id === id) return true
  }
  return false
}

/**
 * UNA LEY NO SE APLICA: SE ARMA LA SITUACIÓN Y SE ESPERA.
 *
 * Un marco de proceso termina en un `aplicar` —o en uno de sus tres azúcares— y
 * éste no termina en nada, porque no hay a quién pedírselo. Lo que emite son
 * POSICIONES: ir hasta donde está el de más abajo de la pila (a un fuego no se lo
 * lleva a ningún lado) y después ir apoyando cada cuerpo sobre el anterior, de
 * abajo hacia arriba. De esos dos o tres `poner` sale el `montaje` que la ley 1
 * lee, y de ahí la temperatura, y de ahí que la ley 5 corra.
 *
 * ─── EL PASO QUE FALTABA YA ESTÁ, Y ACÁ ESTÁ SU HISTORIA ────────────────────
 *
 * Acá decía «falta un paso que `Step` no tiene: `esperar`», con los tres errores
 * de `tsc` que costaba anotados y la consecuencia medida —el emisor ponía la
 * comida en el fuego y la levantaba dos ticks después, la ley 5 corría dos ticks y
 * la `digestibility` del pescado no se movía de 0,3800—. **Se agregó, y los tres
 * eran los tres**: uno en `firmaDePaso` de este archivo y dos en el `switch` de
 * `@anima/mind` (`refsDe` y `aHabilidad`). La innata `esperar` ya existía y ya
 * tomaba segundos: no faltaba física ni superficie, faltaba la costura.
 *
 * Y después faltó una segunda mitad, que es la de este tramo: la espera era
 * CIEGA. Gastaba el `mientras` entero —que es una cota sobre el peor caso
 * admisible— cuando la comida estaba lista mucho antes, y el fuego no dura lo
 * suficiente para pagar esa diferencia. Medido: cocido a los 5 s, la fila hace
 * esperar 15, el fuego se apaga a los 20. Lo arregla `esperarPor`, acá abajo,
 * despejando las condiciones del `establishes` con `interpretar`.
 */
function emitirLey(
  m: MarcoDePlan,
  e: EsquemaDeLey,
  enMano: readonly BodyId[],
  gastados: readonly BodyId[],
  capacidad: number,
): Emision | Rechazo {
  const pasos: Step[] = []
  let mano = [...enMano]
  const quien = `«${m.establece}» por la ley ${e.ley}`

  const base = e.pila[0]
  if (base === undefined) return { rechazo: `${quien} no declara ninguna pila: no hay situación que armar` }
  const refBase = m.roles[base]
  if (refBase === undefined) return { rechazo: `${quien} quedó sin el rol «${base}», que es la base de su pila` }

  // ─── LA DISTANCIA QUE NO SE SABE ARMAR SE RECHAZA, NO SE IGNORA ────────────
  //
  // La fila declara a cuántas celdas de la fuente tiene que quedar el sujeto, y de
  // ese número depende su ventana de potencia: `formFactor` divide por `1 + d²`, o
  // sea que una fila pensada para distancia 2 pide un fuego CINCO VECES más grande
  // que la misma a distancia 0. Emitirla igual —poniendo la comida pegada, que es
  // lo único que `poner` sabe hacer— sería multiplicar por cinco la temperatura que
  // la fila calculó, o sea quemar la comida con un plan verde.
  //
  // Lo que falta no es física: es un `Ref`. `poner` sabe decir «en la celda de ese
  // cuerpo» y «apoyado sobre ese cuerpo», y no sabe decir «en la celda que está a
  // dos de ese cuerpo». Con `{k:'celda', at}` habría que congelar la coordenada al
  // planificar y usarla decenas de ticks después, que es lo que la primera decisión
  // de `tipos.ts` prohíbe. Por eso la tabla no genera esas filas —ver
  // `GEOMETRIAS_DESCARTADAS`— y por eso esto igual está: `opciones.esquemas` es
  // entrada pública y es lo que va a escribir la fragua del Hito 8.
  if (e.distancia !== 0) {
    return {
      rechazo:
        `${quien} pide que el sujeto quede a ${String(e.distancia)} celdas del fuego, y ningún \`Ref\` sabe ` +
        `nombrar esa celda: \`poner\` sólo llega a «la celda de ese cuerpo»`,
    }
  }

  // ─── Y EL SUJETO TIENE QUE ESTAR EN LA PILA, QUE ES LO MISMO POR EL OTRO LADO ─
  //
  // Una pila es una lista de APOYOS y lo único que este emisor sabe emitir es
  // `poner … sobre …`. Una fila cuyo sujeto quede afuera está pidiendo el montaje
  // `piso` —«en la celda y apoyado en nada», que es el «todo lo demás» de
  // `montajeDe`— y armarla con la pila le daría `contacto`, que es una exposición
  // DIEZ VECES mayor que la que esa fila usó para calcular su ventana. La tabla no
  // genera esas filas —ver `porQueNoSePuedeArmar`— y esto está igual porque
  // `opciones.esquemas` es entrada pública.
  if (!e.pila.includes(e.sujeto)) {
    return {
      rechazo:
        `${quien} deja su sujeto «${e.sujeto}» afuera de la pila (${e.pila.join(' → ')}), o sea apoyado en ` +
        `nada, y \`poner\` sólo sabe apoyar: armarlo daría otro montaje y otra temperatura`,
    }
  }

  // La base no se mueve: es el fuego, y a un fuego no se lo levanta. Lo único que
  // hace falta es estar al lado, porque `poner` exige Chebyshev ≤ 1 de la celda.
  if (refBase.k === 'id' && !mano.includes(refBase.id)) {
    pasos.push({ k: 'ir', a: refBase, within: 1, porQue: m.porRol[base] ?? m.establece })
  }

  for (let i = 1; i < e.pila.length; i++) {
    const rol = e.pila[i]
    const debajo = e.pila[i - 1]
    if (rol === undefined || debajo === undefined) continue
    const que = m.roles[rol]
    const sobre = m.roles[debajo]
    if (que === undefined) return { rechazo: `${quien} quedó sin el rol «${rol}» de su pila` }
    if (sobre === undefined) return { rechazo: `${quien} quedó sin el rol «${debajo}» de su pila` }
    // `en` y `sobre` son el MISMO cuerpo y eso no es redundancia: `en` es la celda
    // —`poner` la resuelve como «la celda de eso»— y `sobre` es el apoyo, que es la
    // ley 8. Apoyar no es tapar (ADR II-0002): si esto fuera `tapando`, la parrilla
    // ocluiría el fuego, la ley 12 le bajaría el oxígeno y la fogata se ahogaría.
    pasos.push({ k: 'poner', que, en: sobre, sobre, porQue: m.porRol[rol] ?? m.establece })
    // Después de ponerlo, ya no está en la mano. Y hay una cuenta que este emisor NO
    // hace y conviene decirla: `poner` LEVANTA primero —la innata hace `take` y
    // después `put`— así que con la mano llena el mundo la rebota con `manos-llenas`
    // aunque la mano se vacíe un tick después. Es transitorio y no se modela; el
    // error es del lado caro (un plan que el mundo rechaza) y queda anotado.
    mano = mano.filter((id) => !(que.k === 'id' && id === que.id))
  }

  // ─── Y ACÁ VA EL TIEMPO, QUE ES EL PASO QUE FALTABA ───────────────────────
  //
  // La situación armada no cocina sola en un tick: la ley empuja mientras se
  // sostenga, y cuánto tiene que sostenerse está en el `mientras` de la fila. Sin
  // este paso el emisor ponía la comida sobre el fuego y la levantaba dos ticks
  // después —medido: `poner` en el 151, `sostener` en el 153— y la
  // `digestibility` del pescado no se movía de 0,3800. No es que cocinara mal: no
  // cocinaba.
  //
  // Va DESPUÉS de los `poner` y ANTES del `sostener`, que es el único orden en el
  // que significa algo: esperar antes de armar la situación es esperar al lado de
  // un fuego apagado, y esperar después de levantar la comida es esperar con la
  // comida cruda en la mano.
  //
  // `e.mientras` y no `e.segundos`: son el mismo número en la tabla de hoy y
  // quieren decir cosas distintas —`segundos` es lo que la vía CUESTA, que es lo
  // que ordena la cola de la búsqueda, y `mientras` es cuánto hay que aguantar la
  // situación—. El paso emitido es el segundo.
  //
  // ─── Y LA ESPERA SABE QUÉ ESTÁ ESPERANDO ──────────────────────────────────
  //
  // `mientras` es una COTA y no una predicción, así que gastarla entera es tirar
  // fuego: medido, el pescado sobre la brasa está cocido a los 5 s, la fila hace
  // esperar 15, y el fuego dura 20. Ver `Step.esperar.mirando` en `tipos.ts`.
  //
  // Las condiciones salen del `establishes` de la fila con `interpretar`, que es la
  // vuelta que `firmaDe` ya usa: la firma es la forma canónica del predicado y el
  // predicado tiene los `QualityTest` adentro. No se escribe ningún umbral acá.
  if (e.mientras > 0) {
    pasos.push(esperarPor(m, e))
  }

  if (prometeSobreLaMano(m.establece)) {
    const sujeto = m.roles[e.sujeto]
    if (sujeto === undefined) return { rechazo: `${quien} quedó sin su sujeto, el rol «${e.sujeto}»` }
    const yaEsta = sujeto.k === 'id' && mano.includes(sujeto.id)
    if (!yaEsta) {
      if (mano.length >= capacidad) {
        return {
          rechazo:
            `${quien} promete algo sobre la mano y no entra: la mano ya lleva ` +
            `${String(mano.length)} y la capacidad es ${String(capacidad)}`,
        }
      }
      pasos.push({ k: 'sostener', que: sujeto, porQue: m.establece })
      if (sujeto.k === 'id') mano.push(sujeto.id)
    }
  }

  // Una ley no consume nada: no hay `yields`. Lo que entró sigue existiendo, con
  // otras cualidades y —si evaporó agua— con menos masa, pero con el mismo id.
  return { pasos, enMano: mano, gastados }
}

/**
 * LA ESPERA CON SU CONDICIÓN, despejada del `establishes` de la fila.
 *
 * Tres cosas tienen que estar a la vez para poder llenar `mirando`, y si falta
 * cualquiera la espera sale CIEGA —con su cota de segundos y nada más— en vez de
 * rechazar la fila: una espera ciega es caro y correcto, y rechazar la fila
 * dejaría a la criatura sin cocinar por una limitación del vocabulario del
 * predicado.
 *
 *   1. que el sujeto de la ley tenga un `Ref` en el marco. Es el mismo `Ref` que
 *      el `sostener` de más abajo usa: el cuerpo sobre el que la ley empuja.
 *   2. que la firma prometida se pueda interpretar. `interpretar` contesta
 *      `undefined` para una conjunción de varias cláusulas —`Predicado` no tiene
 *      forma conjuntiva— y eso está bien acá: si la promesa son dos predicados,
 *      este emisor no sabe cuál mirar.
 *   3. que sea un `sostiene` CON condiciones de cualidad. Un `sostiene(tag)`
 *      pelado no dice nada que se pueda muestrear, y una `geometria` tampoco:
 *      `freeStrandEnds` no se contesta desde una vista.
 *
 * Para `FIRMA_DE_LO_COCIDO` las tres se cumplen y salen los dos números que la
 * fila ya traía: `digestibility >= 0,85` y `toxicity <= 0,05`.
 *
 * ─── Y SE MIRA `e.establishes` Y NO `m.establece`, Y LA DIFERENCIA ES REAL ────
 *
 * `m.establece` es LA META sobre la que se está regresando y `e.establishes` es lo
 * que LA FILA promete, y la regresión sólo exige que la segunda IMPLIQUE la
 * primera: la meta puede ser más floja. Medido en la corrida de la contraprueba, la
 * meta que la escalera traía era `holding(tag:carnoso,toxicity<0.0528)` —la cuenta
 * del veneno del ADR II-0013 sobre ESE tanque— y la fila promete además
 * `digestibility >= 0,85`. Con `m.establece` la espera cortaba en el tick 238 con la
 * digestibilidad en 0,8212, o sea **sacaba la comida del fuego antes de que
 * estuviera cocida** y la fila quedaba mintiendo: `Creencias` anotaría la promesa
 * entera cumplida por una situación que sólo cumplió la mitad floja. Con
 * `e.establishes` corta cuando la fila dice, que es lo que la fila mide y lo que el
 * proyecto llama cocido desde el Hito 0.
 */
function esperarPor(m: MarcoDePlan, e: EsquemaDeLey): Step {
  const base: { k: 'esperar'; segundos: number; porQue: PredicateSignature } = {
    k: 'esperar',
    segundos: e.mientras,
    porQue: m.establece,
  }
  const que = m.roles[e.sujeto]
  if (que === undefined) return base
  const p = interpretar(e.establishes)
  if (p === undefined || p.k !== 'sostiene') return base
  const tests = p.tests ?? []
  if (tests.length === 0) return base
  return { ...base, mirando: { que, tests } }
}

/**
 * El paso que aplica el proceso, en la variante de `Step` que le corresponde.
 *
 * Los tres azúcares —`unir`, `deshilachar`, `frotar`— existen en el tipo, así que
 * emitir `aplicar` para todo los dejaría muertos y le pasaría a la mente un
 * `roles` genérico donde el tipo ya sabe distinguir. Y hay una cosa que los tres
 * dicen y `aplicar` no: **el rol que paga no viaja en el paso**. `frotar` no
 * lleva `actor` porque la habilidad innata pasa `ctx.self` y no puede pasar otra
 * cosa; escribirlo en el paso sería ofrecer una elección que no existe.
 */
function pasoDelProceso(m: MarcoDePlan, p: Process): Step {
  const porQue = m.establece
  const rinde = m.rinde
  const via = m.por.k === 'proceso' ? m.por.via : ''
  if (via === 'union') {
    const binder = exigirRef(m, 'binder')
    const a = exigirRef(m, 'a')
    const b = m.roles['b']
    // El rol opcional AUSENTE es la caña entera: con `b` el atador se gasta como
    // `Joint.via`, no queda hebra, no queda punta libre y `catch` da cero. Se
    // omite la clave y no se manda `undefined`: con `exactOptionalPropertyTypes`
    // no son lo mismo, y el que lee el paso tiene que ver la ausencia.
    return b === undefined
      ? { k: 'unir', binder, a, porQue, rinde }
      : { k: 'unir', binder, a, b, porQue, rinde }
  }
  if (via === 'deshilachar') {
    // UNA hebra. Pedir más sería una decisión que nadie tomó: el esquema
    // establece que hace falta UN cuerpo que cumpla algo, y con uno se cumple.
    return { k: 'deshilachar', fuente: exigirRef(m, 'source'), cuantas: 1, porQue, rinde }
  }
  if (via === 'friccion') {
    const hasta = hastaDe(clausulasDe(m.establece) ?? [])
    const a = exigirRef(m, 'a')
    const b = exigirRef(m, 'b')
    return hasta === undefined ? { k: 'frotar', a, b, porQue } : { k: 'frotar', a, b, hasta, porQue }
  }
  return rindeCuerpoNuevo(p)
    ? { k: 'aplicar', proceso: via, roles: m.roles, porQue, rinde }
    : { k: 'aplicar', proceso: via, roles: m.roles, porQue }
}

function exigirRef(m: MarcoDePlan, rol: RoleName): Ref {
  const ref = m.roles[rol]
  if (ref === undefined) {
    throw new Error(`el marco de «${m.establece}» por «${nombreDeVia(m.por)}» quedó sin el rol «${rol}»`)
  }
  return ref
}

/**
 * Cómo nombra el marco de abajo lo que éste produce.
 *
 * Cuerpo nuevo → `{k:'rinde'}`, que es la ligadura diferida del ADR 0082: nombra
 * algo que TODAVÍA NO EXISTE cuando el plan se arma. Sin cuerpo nuevo → el `Ref`
 * del rol material, porque lo que quedó establecido quedó sobre él: la yesca
 * caliente es la yesca, no un rendimiento.
 */
function refDelRendimiento(m: MarcoDePlan): Ref {
  // Una ley nunca rinde cuerpo nuevo: empuja cualidades sobre el que ya estaba, y
  // ese cuerpo es el `sujeto`. Es el mismo caso que `friccion` —la yesca caliente
  // es la yesca— y por eso no hay una tercera respuesta.
  if (m.por.k === 'ley') return exigirRef(m, m.por.esquema.sujeto)
  // Una obra SÍ rinde cuerpo nuevo, y es el único caso en que el cuerpo que sale
  // no es ninguno de los que entraron: las piezas quedan adentro y los atadores se
  // consumen. Por eso se nombra por el rendimiento del objetivo y no por un rol.
  if (m.por.k === 'obra') return { k: 'rinde', de: m.rinde }
  const p = procesoDe(m.por.via)
  if (rindeCuerpoNuevo(p)) return { k: 'rinde', de: m.rinde }
  const material = rolMaterialDe(p)
  if (material === undefined) {
    throw new Error(`«${m.por.via}» no rinde cuerpo nuevo y tampoco tiene rol material: no hay qué nombrar`)
  }
  return exigirRef(m, material)
}

// ─── Cerrar los marcos que ya no esperan nada ───────────────────────────────

/**
 * Emite y desapila todos los marcos que quedaron completos, en cascada.
 *
 * La cascada es el corazón: cuando el marco de `union` se completa, lo que rinde
 * llena el `gear` del marco de `extraccion`, y si ése era su último rol, también
 * se completa. Un solo paso de ligadura puede terminar el plan entero.
 *
 * Cuando se desapila el marco RAÍZ el nodo queda TERMINAL: `marcos` vacía y
 * `falta` en `''`. No se devuelve el plan de una: se devuelve el nodo, se lo
 * mete en la cola y se lo saca por costo como a cualquier otro. Devolverlo de
 * una haría que el primer plan encontrado ganara sobre uno más barato que ya
 * estaba en la cola — y encima haría que el corte por presupuesto cayera en un
 * lugar distinto según qué rama se estaba mirando.
 */
function cerrar(base: NodoAbierto, capacidad: number): NodoAbierto | Rechazo {
  let camino = base.camino
  let enMano = base.enMano
  let gastados = base.gastados
  const marcos = [...base.marcos]

  for (;;) {
    const tope = marcos[marcos.length - 1]
    if (tope === undefined || tope.faltan.length > 0) break
    const e = emitirMarco(tope, enMano, gastados, capacidad)
    if ('rechazo' in e) return e
    camino = [...camino, ...e.pasos]
    enMano = e.enMano
    gastados = e.gastados
    marcos.pop()
    if (tope.paraRol === undefined) {
      return { falta: '', camino, profundidad: 0, costo: base.costo, marcos: [], enMano, gastados }
    }
    const padre = marcos[marcos.length - 1]
    if (padre === undefined) {
      throw new Error(`«${tope.establece}» dice llenar el rol «${tope.paraRol}» y abajo no hay marco`)
    }
    const rol = tope.paraRol
    marcos[marcos.length - 1] = {
      ...padre,
      roles: { ...padre.roles, [rol]: refDelRendimiento(tope) },
      faltan: padre.faltan.filter((q) => q.rol !== rol),
    }
  }

  const tope = marcos[marcos.length - 1]
  const siguiente = tope?.faltan[0]
  if (siguiente === undefined) {
    throw new Error('un nodo se quedó sin marcos y sin meta: la búsqueda perdió su propio estado')
  }
  return {
    falta: siguiente.firma,
    camino,
    profundidad: marcos.length,
    costo: base.costo,
    marcos,
    enMano,
    gastados,
  }
}

// ─── Regresar: de un pedido a una aplicación de proceso ─────────────────────

type Resultado =
  | { readonly k: 'nodos'; readonly nodos: readonly NodoAbierto[] }
  | { readonly k: 'muerto'; readonly muerto: RamaMuerta }

interface Armado {
  readonly marco: MarcoDePlan
  readonly segundos: number
}

/**
 * Los esquemas de este proceso cuyas promesas ENTRAN TODAS en el pedido.
 *
 * «Entran» y no «son iguales», por dos motivos distintos que se acumulan:
 *
 *   · SUBCONJUNTO. `catch>0 ∧ reach>=2` no lo establece ningún esquema solo, y lo
 *     establecen DOS —los dos por `union`— que juntos lo cubren entero. Una sola
 *     aplicación de `union` deja las dos cosas, así que se aplican los dos
 *     esquemas a la vez y se cobra el segundo UNA vez.
 *   · IMPLICACIÓN. Una promesa entra si GARANTIZA alguna cláusula del pedido, no
 *     si se escribe igual. Con la comparación de texto que había acá,
 *     `temperature>=400` tenía plan y `temperature>=399` era un `gap` — el mismo
 *     plan de cuatro pasos cumple los dos, y el planificador no lo encontraba
 *     para el más flojo. Ver `implica` en `predicado.ts`.
 */
function esquemasQueAportan(
  todos: readonly ConstructionSchema[],
  clave: string,
  pedido: readonly Predicado[],
): readonly ConstructionSchema[] {
  const out: ConstructionSchema[] = []
  // ─── Y APORTAR NO ES SÓLO ENTRAR: TIENE QUE CUBRIR ALGO QUE FALTABA ───────
  //
  // Acá se juntaban TODAS las filas de la vía que entraran en el pedido, y eso
  // alcanzaba mientras dos filas de un mismo proceso nunca hablaran de la misma
  // cualidad. Desde que `friccion` tiene la fila del piso de la potencia deja de
  // ser cierto, y el precio fue inmediato y medido: el objetivo «quiero fuego»
  // —`emitsPower>0` pelado— hacía entrar TAMBIÉN a `emitsPower>=105,42`, porque una
  // promesa más fuerte implica a la floja. Las dos filas se aplicaban juntas, sus
  // `roleHints` se sumaban, y para encender una ramita cualquiera el plan pasaba a
  // exigir una yesca de 0,35 kg de madera. Un `gap` donde había plan, y por pedir
  // de más.
  //
  // La regla que lo arregla es la del recubrimiento MÍNIMO, en el orden de la tabla:
  // una fila entra si además de caber CUBRE alguna cláusula del pedido que ninguna
  // de las anteriores cubría. Lo que se pierde no se pierde: si `emitsPower>0` ya
  // cubrió la única cláusula, la fila más fuerte no aporta NADA a la promesa —sólo
  // condiciones— así que saltearla no afloja lo que el plan establece.
  //
  // El orden de `ESQUEMAS` decide cuál gana cuando dos cubren lo mismo, y eso ya era
  // así y está afirmado en `los-esquemas.test.ts`: la tabla está agrupada por
  // proceso y adentro va primero lo declarado y después los puentes.
  const cubiertas = new Set<number>()
  for (const e of todos) {
    if (claveDeVia(e) !== clave) continue
    const cl = clausulasDe(firmaDe(e.establishes))
    if (cl === undefined) continue
    let cabe = true
    for (const p of cl) if (!pedido.some((q) => implica(p, q))) cabe = false
    if (!cabe) continue
    const nuevas: number[] = []
    for (let i = 0; i < pedido.length; i++) {
      const q = pedido[i]
      if (q === undefined || cubiertas.has(i)) continue
      if (cl.some((p) => implica(p, q))) nuevas.push(i)
    }
    if (nuevas.length === 0) continue
    for (const i of nuevas) cubiertas.add(i)
    out.push(e)
  }
  return out
}

/**
 * Bajo qué `GoalId` se anota lo que rinda un marco.
 *
 * Sale del CONTENIDO —qué establece y por qué camino de roles se llegó hasta
 * él— y no de un contador. Un contador global haría que la misma partida
 * planificada dos veces diera dos planes que no son iguales para nada que los
 * compare, que es el mismo bug que `objetivos.ts` documenta para los `GoalId`.
 *
 * ─── Y POR QUÉ EL CAMINO ENTERO Y NO LA PROFUNDIDAD ─────────────────────────
 *
 * Porque la profundidad NO ES ÚNICA entre hermanos, y en cuanto el corte de
 * ciclos dejó de ser global apareció el caso: `friccion` necesita dos cuerpos
 * rígidos, `deshilachar` los fabrica, y salen DOS marcos a la misma altura de la
 * pila estableciendo la misma firma —uno para el rol `a` y otro para el `b`—.
 * Con `firma@profundidad`, los dos rendían bajo la misma llave y el plan frotaba
 * la hebra contra sí misma. Con el camino de roles, `rigidity>=0.5@./a` y
 * `rigidity>=0.5@./b` son dos hebras distintas, que es lo que son.
 */
function rindeDe(nodo: NodoAbierto, paraRol: RoleName | undefined): GoalId {
  const camino: string[] = ['.']
  for (const m of nodo.marcos) if (m.paraRol !== undefined) camino.push(m.paraRol)
  if (paraRol !== undefined) camino.push(paraRol)
  return `${nodo.falta}@${camino.join('/')}`
}

/**
 * Un marco listo para entrar en la pila, o el motivo por el que este proceso no
 * sirve para este pedido.
 *
 * Cada rechazo se escribe con su porqué porque los rechazos SON el `gap`: cuando
 * ninguna vía sirve, lo que la criatura le va a pedir a la fragua del Hito 8 es
 * exactamente esta lista.
 */
function armarMarco(
  nodo: NodoAbierto,
  g: GoalNode,
  usados: readonly ConstructionSchema[],
  residuo: readonly Predicado[],
  v: VistaDelPlan,
): Armado | Rechazo {
  const primero = usados[0]
  if (primero === undefined) return { rechazo: 'una vía sin ningún esquema no aporta ninguna cláusula' }
  const via =
    primero.k === 'proceso'
      ? primero.via
      : primero.k === 'obra'
        ? `la obra ${primero.revision}`
        : `ley ${primero.ley}`
  // Un proceso trae sus roles del catálogo; una ley y una obra los nombran ellas
  // mismas, así que `p` no existe y todo lo que se le preguntaba al `Process` lo
  // contesta la fila.
  const p = primero.k === 'proceso' ? procesoDe(primero.via) : undefined
  const ley = primero.k === 'ley' ? primero : undefined
  const obra = primero.k === 'obra' ? primero : undefined

  // Los esquemas de una misma aplicación tienen que nombrar LOS MISMOS roles. Si
  // uno nombra `b` y otro lo omite, la aplicación que salga va a llenar `b`, y el
  // que lo omitía lo omitía por algo: en `union`, con `b` lleno el atador se gasta
  // y `catch` da cero. Juntarlos en silencio daría un plan verde y una caña que
  // no engancha. Se rechaza y se dice.
  const roles = nombresOrdenados(primero.roleHints)
  const clave = roles.join(',')
  for (const e of usados) {
    const suyos = nombresOrdenados(e.roleHints).join(',')
    if (suyos !== clave) {
      return {
        rechazo:
          `«${e.establishes}» y «${primero.establishes}» van los dos por «${via}» pero no nombran los mismos roles ` +
          `(«${suyos}» contra «${clave}»): una aplicación no puede llenar un rol y omitirlo a la vez`,
      }
    }
  }

  // ─── Y LA TERCERA: QUE ESTÉN TODOS LOS QUE EL PROCESO NECESITA ────────────
  //
  // Las dos guardas de arriba revisan que los esquemas se pongan de acuerdo entre
  // ellos y que cada rol que nombran EXISTA en el proceso. Faltaba la simétrica:
  // que no falte ninguno de los que el proceso no puede correr sin ellos. Y no es
  // una hipótesis de laboratorio — `opciones.esquemas` es entrada pública y es lo
  // que va a escribir la fragua del Hito 8. Medido con la tabla real y UNA fila
  // mutilada, las dos formas de fallar que esto cierra de una:
  //
  //   · `extraccion` sin `source` daba un plan VERDE que pescaba sin río: un
  //     `aplicar` sin la clave `source`, sin ningún `ir` hasta el pozo, y el mundo
  //     rechazándolo con `rol-sin-cuerpo`;
  //   · `friccion` sin `b` LANZABA desde `exigirRef`, en el medio de la búsqueda.
  //     Y eso contradice lo que este mismo paquete argumenta en `predicado.ts`
  //     para que `cumpleCuerpo` devuelva `false` en vez de tirar: «una excepción
  //     en el medio de la búsqueda voltea el tick de las 5000 criaturas por un
  //     predicado mal escrito». Acá lo volteaba una FILA mal escrita.
  //
  // El motivo va a parar al `why` del `gap`, con el nombre del rol adentro, que es
  // donde el Hito 8 lo tiene que leer. Y `exigirRef` queda siendo lo que dice ser:
  // un invariante interno que ya no se puede violar desde afuera.
  // `rolesObligatorios` de un proceso sale del sufijo `?` del catálogo; el de una
  // ley sale de su pila más su sujeto, y son todos obligatorios: una situación a
  // la que le falta un cuerpo no es esa situación.
  // Los de una OBRA son TODOS los que declara, y no hay opcionales: un plano cuyo
  // rol nadie llena no se puede armar — la unión que lo nombra se queda sin cuerpo
  // y la obra queda a medias, que es un cuerpo legal y no es la obra.
  const obligatorios =
    obra !== undefined
      ? nombresOrdenados(obra.cuantos)
      : ley === undefined
        ? p === undefined
          ? []
          : rolesObligatorios(p)
        : rolesDeLaLey(ley)
  const faltantes = obligatorios.filter((r) => primero.roleHints[r] === undefined)
  if (faltantes.length > 0) {
    return {
      rechazo:
        `el esquema de «${primero.establishes}» por «${via}» no nombra ` +
        `${faltantes.map((r) => `«${r}»`).join(' ni ')}, que «${via}» necesita sí o sí`,
    }
  }

  // Una obra NO tiene rol material, y no es un olvido: lo que sale de armarla es un
  // cuerpo NUEVO —las piezas quedan adentro y los atadores se consumen— así que no
  // hay ningún rol sobre el que caiga el residuo. Una fila de obra con cláusulas
  // sobrantes se rechaza abajo, con el mensaje que ya existe.
  const material = ley !== undefined ? ley.sujeto : p === undefined ? undefined : rolMaterialDe(p)
  if (residuo.length > 0 && material === undefined) {
    return { rechazo: `«${via}» no tiene rol material: no hay a quién pasarle el residuo` }
  }
  // Una ley no la paga nadie: corre igual con la criatura dormida. Es el ADR
  // II-0011 —el fuego le sobrevive a la mano que lo hizo— dicho desde este lado.
  const paga = p === undefined ? undefined : rolQuePaga(p)

  const resueltos: Record<RoleName, Ref> = {}
  const porRol: Record<RoleName, PredicateSignature> = {}
  const pendientes: { readonly pedido: PedidoDeRol; readonly cuantos: number }[] = []

  // Y una obra SIEMPRE los quiere en la mano: armarla son N−1 `union` encadenados
  // y `union` pide `arrangement: { k: 'held' }` para sus tres roles. Es tenencia,
  // no proximidad, y de ahí sale que un plano tenga que caber en las manos.
  const aLaMano = obra !== undefined || (p !== undefined && hayQueTenerloEnLaMano(p))

  for (const rol of roles) {
    // ─── ¿ESTE ROL EXISTE PARA ESTA VÍA? ───────────────────────────────────
    //
    // Un proceso lo contesta el catálogo. Una ley no declara roles en ningún lado
    // —los nombra ella— así que lo que hace las veces es su propia estructura: un
    // rol existe si está en la PILA o es el SUJETO, porque son los dos únicos
    // lugares donde un cuerpo hace algo. Un `roleHint` sobre un nombre que no está
    // en ninguno de los dos es una condición que nadie va a cumplir nunca, y eso hay
    // que decirlo en vez de buscar un cuerpo para un rol que después no se usa.
    //
    // La guarda no es de laboratorio: `opciones.esquemas` es entrada pública y es lo
    // que va a escribir la fragua del Hito 8. `[]` es «no le pido nada más» y
    // `undefined` es «este rol no existe», y la diferencia es toda la guarda.
    //
    // Y en una OBRA lo contesta el plano: un rol existe si el plano lo declara, y
    // eso lo dice `cuantos` —que es la lista de roles con cuántos cuerpos hace
    // falta de cada uno—. Un `roleHint` sobre un rol que el plano no declara es
    // una condición que nadie va a cumplir nunca.
    const delProceso =
      obra !== undefined
        ? obra.cuantos[rol] === undefined
          ? undefined
          : []
        : ley !== undefined
          ? ley.pila.includes(rol) || ley.sujeto === rol
            ? []
            : undefined
          : p === undefined
            ? undefined
            : whereDelProceso(p, rol)
    if (delProceso === undefined) {
      return {
        rechazo:
          obra !== undefined
            ? `el plano ${obra.revision} no declara el rol «${rol}» que el esquema le pide`
            : ley === undefined
            ? `«${via}» no declara el rol «${rol}» que el esquema le pide`
            : `el esquema de «${primero.establishes}» por «${via}» le pide cosas al rol «${rol}», ` +
              `que no está en su pila (${ley.pila.join(' → ')}) ni es su sujeto («${ley.sujeto}»): ` +
              `nadie lo va a llenar`,
      }
    }
    const tests: QualityTest[] = [...delProceso]
    for (const e of usados) for (const t of e.roleHints[rol] ?? []) tests.push(t)
    if (rol === material) for (const r of residuo) if (r.k === 'cualidad') tests.push(r.test)
    // ─── LO QUE EL SUJETO DE UNA LEY YA TENÍA QUE SER ────────────────────────
    //
    // Una ley mueve cualidades y nada más, así que de todo lo que la fila promete,
    // lo que NO es una cláusula de cualidad lo tenía que traer el sujeto. Para la
    // cocción eso despeja `holding(tag:carnoso)`, y de ahí sale sola la mitad de
    // abajo de la cadena: para asar un pescado primero hay que pescarlo, y eso el
    // catálogo ya lo sabe hacer. Ver `loQueElSujetoYaTraia`.
    const yaEra = ley !== undefined && rol === ley.sujeto ? loQueElSujetoYaTraia(ley) : ''
    const firma = firmaDe([...tests.map((t) => textoDe({ k: 'cualidad', test: t })), yaEra].join('&'))
    porRol[rol] = firma
    // Lo que el `arrangement` exige y ninguna fila escribe. Va en el FILTRO y no
    // en la firma —ver `PedidoDeRol`—: `portable` no la establece ningún proceso
    // ni la va a establecer, así que meterla en lo que se regresa haría que el
    // `gap` le pidiera a la fragua un proceso para volver liviano un tronco.
    // El rol que paga queda afuera: es la criatura, y no se carga a sí misma.
    //
    // Y en una ley la misma exigencia sale de otro lado y llega a lo mismo: TODO lo
    // que la situación mueve hay que haberlo levantado, así que `portable` se le
    // pide a todos menos al primero de la pila, que es el que no se mueve. Se
    // pregunta por la base y no por «estar en la pila» desde que el montaje `piso`
    // existe: ahí el sujeto NO está en la pila y hay que cargarlo igual —hay que
    // llevar la comida hasta el fuego— y con la pregunta vieja se le podía asignar
    // un cadáver de veinte kilos que el mundo rebota con `no-portable`.
    const hayQueAlzarlo = ley !== undefined && rol !== ley.pila[0]
    // Y lo que las FILAS declaran de esa misma clase —lo que el cuerpo tiene que
    // ser y nadie fabrica— se SUMA, no se pisa: son dos fuentes distintas de la
    // misma exigencia (el `arrangement` del catálogo y el `roleFilters` del
    // esquema) y quedarse con una sola las haría depender del orden en que se
    // escribió este objeto. Si las dos hablaran de la misma cualidad en
    // direcciones opuestas —`portable>0` de un proceso `held` contra el
    // `portable<=0` de la fila de la pesca— la conjunción no la cumple nadie y el
    // rol se queda sin candidatos, que es exactamente lo que hay que decir: un
    // proceso que exige tener el pozo en la mano no se puede aplicar a un pozo.
    const filtro: QualityTest[] = [
      ...((aLaMano && rol !== paga) || hayQueAlzarlo ? [PORTABLE] : []),
      ...filtroDelRol(usados, rol),
    ]
    const extra: Extra = {
      ...(filtro.length === 0 ? {} : { filtro }),
      ...celdaDelRol(usados, rol),
      ...manoDelRol(usados, rol),
    }

    if (rol === paga) {
      // El que paga es la criatura y no se busca: se verifica. Y se verifica con
      // `v.q` sobre `v.self`, o sea con el motor, en vez de leer `self.stamina` —
      // que es un atajo de una sola cualidad y este chequeo es de todas las que
      // el proceso pida.
      const clausulas = clausulasDe(firma)
      if (clausulas === undefined) return { rechazo: `el pedido del rol «${rol}» no se entiende: «${firma}»` }
      const lector = (b: BodyView, id: QualityId): number => v.q(b, id)
      for (const c of clausulas) {
        if (!cumpleCuerpo(c, v.self, lector)) {
          return { rechazo: `la criatura no cumple «${textoDe(c)}» para el rol «${rol}» de «${via}»` }
        }
      }
      resueltos[rol] = { k: 'yo' }
      continue
    }

    const clausulas = clausulasDe(firma)
    if (clausulas === undefined) return { rechazo: `el pedido del rol «${rol}» no se entiende: «${firma}»` }

    // ─── LA LIGADURA DIFERIDA ENTRE NODOS DEL GRAFO (ADR 0082) ─────────────
    //
    // `goalGraph` emite `binds: {slot, from}` cuando una cláusula nombra lo que
    // rindió la anterior —«hacé una caña y andá a pescar, DESPUÉS asá el
    // pescado»— y hasta acá no lo leía nadie: `plan()` daba EL MISMO objeto con
    // `binds` y sin él, medido con `toEqual`. El pescado se buscaba contra la
    // vista de hoy, donde todavía no existe, y el plan se caía en el paso tres —
    // que es exactamente el bug que el ADR 0082 cerró en Ánima I.
    //
    // Se liga sólo en el marco RAÍZ, y eso no es una limitación: `binds.slot` es
    // un nombre de rol del proceso que cumple ESTE objetivo, no de uno de los
    // subobjetivos que la regresión inventa por el camino. El `GoalId` que viaja
    // en el `Ref` es el del NODO HERMANO del grafo, así que quien ejecute tiene
    // que tener anotado lo que ese nodo rindió — que es el contrato del ADR y la
    // razón por la que `Step` lleva `rinde`.
    if (nodo.marcos.length === 0 && g.binds !== undefined && g.binds.slot === rol) {
      resueltos[rol] = { k: 'rinde', de: g.binds.from }
      continue
    }

    pendientes.push({
      pedido: { rol, firma, ...extra },
      cuantos: candidatosPara(clausulas, extra, v, nodo.enMano, nodo.gastados).cuantos,
    })
  }

  // ─── EL ROL MÁS APRETADO VA PRIMERO, Y ESO CUBRE DOS COSAS DE UNA ─────────
  //
  // Se ordena por CUÁNTOS CUERPOS pueden llenar cada rol, de menos a más. Es la
  // heurística clásica de la variable más restringida, y acá arregla dos
  // fracasos distintos que empezaron siendo dos reglas separadas:
  //
  //   · CERO candidatos —hay que fabricarlo— queda primero solo. Y tiene que
  //     quedar primero, porque **fabricar CONSUME**: `extraccion` le pide al rol
  //     `source` `mass > 0` y nada más —el mundo distingue un pozo de un matorral
  //     con el motivo `sin-pozo`, que no es expresable en un `Where`— así que el
  //     matorral califica de pozo y está más cerca que el río. Ligándolo primero,
  //     el plan sale mandando a pescar adentro de la caña que él mismo hizo con
  //     ese matorral.
  //   · UN candidato antes que TRES. Sin esto, el rol `a` de `union` —que no pide
  //     nada, `where: []` en el catálogo— se queda con el matorral por ser el más
  //     cercano, y después el `binder`, que sólo el matorral podía llenar, se
  //     queda sin nadie. Un `gap` donde había plan. Está medido en su test.
  //
  // No hay vuelta atrás en esta elección —decisión 3— así que el orden en que se
  // eligen los roles ES la calidad del plan. El desempate es por nombre de rol,
  // que es total.
  pendientes.sort((x, y) => {
    if (x.cuantos !== y.cuantos) return x.cuantos < y.cuantos ? -1 : 1
    return x.pedido.rol < y.pedido.rol ? -1 : x.pedido.rol > y.pedido.rol ? 1 : 0
  })

  let segundos = 0
  for (const e of usados) {
    if (!Number.isFinite(e.segundos)) {
      return { rechazo: `el esquema «${e.establishes}» por «${via}» no tiene un costo finito` }
    }
    if (e.segundos > segundos) segundos = e.segundos
  }

  const por: MarcoPor =
    obra !== undefined
      ? { k: 'obra', esquema: obra }
      : ley === undefined
        ? { k: 'proceso', via: primero.k === 'proceso' ? primero.via : '' }
        : { k: 'ley', esquema: ley }

  // El id del rendimiento sale del CONTENIDO, no de un contador: ver `rindeDe`.
  const marco: MarcoDePlan =
    nodo.marcos.length === 0
      ? {
          por,
          establece: nodo.falta,
          rinde: rindeDe(nodo, undefined),
          roles: resueltos,
          porRol,
          faltan: pendientes.map((x) => x.pedido),
        }
      : {
          por,
          establece: nodo.falta,
          paraRol: rolDelTope(nodo),
          rinde: rindeDe(nodo, rolDelTope(nodo)),
          roles: resueltos,
          porRol,
          faltan: pendientes.map((x) => x.pedido),
        }
  return { marco, segundos }
}

/**
 * Lo que los esquemas de esta aplicación le piden al CUERPO de un rol y no se
 * puede fabricar. Es el gemelo de `celdaDelRol`, sobre el otro campo.
 *
 * Devuelve un arreglo y no un `{filtro?}` porque quien llama tiene que
 * CONCATENARLO con lo que sale del `arrangement`, y un registro opcional invita a
 * pisar en vez de sumar.
 */
function filtroDelRol(usados: readonly ConstructionSchema[], rol: RoleName): readonly QualityTest[] {
  const out: QualityTest[] = []
  for (const e of usados) for (const t of e.roleFilters?.[rol] ?? []) out.push(t)
  return out
}

/**
 * ¿Alguno de los esquemas de esta aplicación dice que este rol NO se llena con lo
 * que la criatura tenga agarrado?
 *
 * Basta con que lo diga UNO —es una prohibición, y las prohibiciones se suman—, y
 * por eso es un `some` y no una intersección. Devuelve el fragmento de `Extra` y
 * no un booleano por lo mismo que `celdaDelRol`: el campo se OMITE cuando nadie lo
 * pide, y así `PedidoDeRol` sigue siendo comparable con `toEqual` contra los
 * pedidos de las nueve filas que no lo declaran.
 */
function manoDelRol(usados: readonly ConstructionSchema[], rol: RoleName): { readonly noDeLaMano?: true } {
  const prohibido = usados.some((e) => (e.roleNoDeLaMano ?? []).includes(rol))
  return prohibido ? { noDeLaMano: true } : {}
}

/** Lo que los esquemas de esta aplicación le piden a la CELDA de un rol. */
function celdaDelRol(usados: readonly ConstructionSchema[], rol: RoleName): { readonly celda?: WhereCell } {
  const out: WhereCell[number][] = []
  for (const e of usados) for (const t of e.cellHints?.[rol] ?? []) out.push(t)
  return out.length === 0 ? {} : { celda: out }
}

/** A qué rol del marco de arriba de la pila viene a contestar el marco nuevo. */
function rolDelTope(nodo: NodoAbierto): RoleName {
  const tope = nodo.marcos[nodo.marcos.length - 1]
  const pedido = tope?.faltan[0]
  if (pedido === undefined) {
    throw new Error('se quiso apilar un marco sobre un tope que no está esperando ningún rol')
  }
  return pedido.rol
}

// ─── La expansión ───────────────────────────────────────────────────────────

function expandir(
  nodo: NodoAbierto,
  g: GoalNode,
  v: VistaDelPlan,
  todos: readonly ConstructionSchema[],
): Resultado {
  const clausulas = clausulasDe(nodo.falta)

  // ── La regla 6: lo que ya se cumple no se planifica ──────────────────────
  //
  // Se pregunta con `cumple`, que es la definición del paquete de «el mundo, tal
  // como se ve hoy, cumple esto» — la misma que va a usar la mente para decidir
  // si el plan terminó. Dos definiciones de eso serían un plan que se da por
  // hecho y una criatura que sigue caminando.
  if (nodo.marcos.length === 0 && cumple(g.goal, v)) {
    return { k: 'nodos', nodos: [{ ...nodo, falta: '', marcos: [] }] }
  }

  // ── AGARRAR LO QUE YA HAY, que es la vía más corta a «tenerlo» ───────────
  //
  // Va ANTES de regresar y **no en lugar de**: el nodo que sale compite por costo
  // con los de las demás vías, que es cómo elige esta búsqueda. Ver
  // `agarrarLoQueYaHay`.
  const directo = clausulas === undefined ? undefined : agarrarLoQueYaHay(nodo, clausulas, v, g.sobre)

  // ── ¿Lo cumple algo que veo? ─────────────────────────────────────────────
  if (nodo.marcos.length > 0 && clausulas !== undefined) {
    const tope = nodo.marcos[nodo.marcos.length - 1]
    const yaLigados: BodyId[] = [...nodo.gastados]
    for (const rol of nombresOrdenados(tope?.roles ?? {})) {
      const ref = tope?.roles[rol]
      if (ref !== undefined && ref.k === 'id' && !yaLigados.includes(ref.id)) yaLigados.push(ref.id)
    }
    // El señalado también pesa acá, y no sólo en `agarrarLoQueYaHay`: «asá EL
    // pescado» no se resuelve agarrando nada —el pescado ya está en la mano—, se
    // resuelve eligiéndolo para el rol `comida` de la cocción. Sin esta línea la
    // ligadura diferida llegaba hasta el objetivo y se moría en el reparto de
    // roles, que es donde de verdad se decide cuál se cocina.
    const cuerpo = elegirCuerpo(clausulas, tope?.faltan[0] ?? SIN_EXTRA, v, nodo.enMano, yaLigados, g.sobre)
    if (cuerpo !== undefined && tope !== undefined) {
      const pedido = tope.faltan[0]
      if (pedido === undefined) throw new Error(`el marco de «${tope.establece}» no espera ningún rol`)
      const marcos = [...nodo.marcos]
      marcos[marcos.length - 1] = {
        ...tope,
        roles: { ...tope.roles, [pedido.rol]: { k: 'id', id: cuerpo.id } },
        faltan: tope.faltan.slice(1),
      }
      const cerrado = cerrar({ ...nodo, marcos }, v.self.capacity)
      if ('rechazo' in cerrado) return morir(nodo, v, todos, clausulas, cerrado.rechazo)
      return { k: 'nodos', nodos: directo === undefined ? [cerrado] : [directo, cerrado] }
    }
  }

  const regresado = regresar(nodo, g, v, todos, clausulas)
  if (directo === undefined) return regresado
  // Con el directo en la mano, una regresión que murió NO mata la rama: hay plan.
  // Su `RamaMuerta` se pierde y es correcto — el `gap` es lo que la criatura NO
  // puede hacer, y esto lo puede hacer.
  return regresado.k === 'nodos'
    ? { k: 'nodos', nodos: [directo, ...regresado.nodos] }
    : { k: 'nodos', nodos: [directo] }
}

/**
 * LA VÍA MÁS CORTA A «TENERLO»: caminar hasta algo que ya lo cumple y agarrarlo.
 *
 * ─── POR QUÉ ESTO NO ES UNA FILA DE `ESQUEMAS` ─────────────────────────────
 *
 * Porque no hay proceso, ni ley, ni obra: agarrar no transforma nada. Las tres
 * clases de `ConstructionSchema` contestan «con qué se fabrica esto», y acá la
 * respuesta es «no se fabrica, ya existe». Es un caso base de la regresión, del
 * mismo orden que la regla 6 —«lo que ya se cumple no se planifica»— sólo que un
 * paso más lejos: lo que se cumpliría con estirar la mano.
 *
 * ─── EL DEFECTO QUE HABÍA, Y SE VEÍA DESDE AFUERA ──────────────────────────
 *
 * `holding(tag:carnoso)` tenía UNA vía declarada —`extraccion`, o sea pescar— así
 * que para comer la criatura armaba una caña **siempre**, aunque tuviera un
 * pescado a un paso. Y `holding(tag:fibroso)` no tenía ninguna: «traé un palo» se
 * leía perfecto y el planificador contestaba que ningún esquema la establece.
 *
 * ─── LAS DOS CONDICIONES, Y LAS DOS LAS PUSO UNA MEDICIÓN ──────────────────
 *
 *   1. **`portable`**, porque es lo que el mundo exige para dejar levantar algo
 *      (`no-portable`). Sin ella el plan sale verde y se cae al ejecutarlo;
 *   2. **que no sea una fuente**, y ésta costó un intento entero. La primera
 *      versión pedía sólo `portable` y se dio por buena midiendo que «el pozo no
 *      es portable». **Es falso**: los bancos que el dios decreta pesan casi
 *      siempre menos de 8 kg. Con la meta pelada `holding(tag:carnoso)`, el plan
 *      pasaba a ser *llevate el banco de pescado en la mano* — y eso no es sólo
 *      raro: `stockDe` reconoce un pozo comparando su id con el del chunk donde
 *      está, así que **un pozo que se mueve deja de ser un pozo**. La criatura se
 *      llevaría el río y lo destruiría.
 *
 * `BodyView.esFuente` es lo que hace contestable la segunda, y existe por esto.
 *
 * ─── LO QUE ESTO NO ROMPE, MEDIDO ──────────────────────────────────────────
 *
 * El criterio del Hito 5 pasa igual y su plan canónico no se mueve: la meta que
 * la mente persigue de verdad es `holding(tag:carnoso,toxicity<0.0528)`, y ningún
 * cuerpo agarrable de esa escena la cumple. La cadena de siete eslabones se
 * ejercita igual. Donde sí cambia el plan es en la contraprueba del propio
 * criterio —`conRegalo` con cien pescados cocidos al alcance— y ahí es correcto.
 */
function agarrarLoQueYaHay(
  nodo: NodoAbierto,
  clausulas: readonly Predicado[],
  v: VistaDelPlan,
  /** El cuerpo que el cuidador señaló, si señaló uno. Ver `GoalNode.sobre`. */
  senalado?: BodyId,
): NodoAbierto | undefined {
  // ─── SÓLO LA META, NUNCA UN ROL — Y LA PRIMERA VERSIÓN NO LO DISTINGUÍA ───
  //
  // Un nodo con marcos abiertos NO busca la meta: busca el cuerpo que llena un
  // rol, y para eso está el bloque de «¿lo cumple algo que veo?», que lo LIGA al
  // marco en vez de cerrar el plan.
  //
  // La primera versión miraba la meta RAÍZ y decidía con eso mientras usaba las
  // cláusulas del nodo ACTUAL. Con una meta raíz `sostiene`, cualquier
  // subobjetivo intermedio se cerraba como plan terminado apenas hubiera algo
  // levantable a la vista. Cuatro guardas de `la-cocina` que esperaban `gap`
  // pasaron a devolver `plan`, y el plan era mentira.
  if (nodo.marcos.length > 0) return undefined
  // Y lo que falta tiene que ser UN «tenerlo» y nada más: `sostiene` ya lleva sus
  // condiciones adentro, así que uno acompañado de otra cláusula pide algo más
  // que tenerlo en la mano.
  const sola = clausulas.length === 1 ? clausulas[0] : undefined
  if (sola === undefined || sola.k !== 'sostiene') return undefined

  // `cumpleCuerpo` ya sabe contestar un `sostiene` sobre un cuerpo —mira `b.tags`
  // y las condiciones, las dos sobre el mismo— así que la cláusula viaja tal cual.
  const cuerpo = elegirCuerpo([sola, SE_PUEDE_LEVANTAR], SIN_EXTRA, v, nodo.enMano, nodo.gastados, senalado)
  // Ni una fuente ni una criatura. Las dos exclusiones las puso una corrida y no
  // un razonamiento: con la primera faltando, el plan era llevarse el banco de
  // pescado; con la segunda, `ir(beto-cuerpo) → sostener(beto-cuerpo)`, o sea
  // salir a levantar a la otra criatura porque es de carne y pesa poco.
  if (cuerpo === undefined || cuerpo.esFuente === true || cuerpo.esDeAlguien === true) return undefined

  const ref: Ref = { k: 'id', id: cuerpo.id }
  return {
    falta: '',
    camino: [
      ...nodo.camino,
      { k: 'ir', a: ref, within: 1, porQue: nodo.falta },
      { k: 'sostener', que: ref, porQue: nodo.falta },
    ],
    profundidad: 0,
    costo: nodo.costo + SEGUNDOS_DE_AGARRAR,
    marcos: [],
    enMano: [...nodo.enMano, cuerpo.id],
    gastados: nodo.gastados,
  }
}

/**
 * Lo que el mundo exige para dejar levantar algo, dicho como predicado.
 *
 * `portable` es derivada y vale 1 o 0 según si la masa pasa un tope; se pide `>0`
 * y no `>=1` porque el umbral lo decide la física y esto sólo pregunta de qué
 * lado está.
 */
const SE_PUEDE_LEVANTAR: Predicado = { k: 'cualidad', test: { q: 'portable', op: '>', v: 0 } }

/**
 * LO QUE CUESTA AGARRAR, y por qué no es cero.
 *
 * Un `take` lo resuelve el mundo en un tick, así que el costo honesto es un tick
 * de la frecuencia de referencia. Cero sería más simple y estaría mal: con costo
 * cero esta vía empata con «ya está cumplido» y ganaría cualquier desempate por
 * accidente en vez de ganar por barata.
 *
 * Y barata es: armar una caña son 1 s de `union` más 1,5 s de `extraccion`, o sea
 * cincuenta veces esto. Es lo que hace que agarrar el pescado que está al lado le
 * gane a pescarlo, y que pescar siga ganando cuando no hay ninguno.
 */
const SEGUNDOS_DE_AGARRAR = 0.05

/**
 * El marco del linaje al que este pedido DOMINA, si hay alguno.
 *
 * Domina cuando conseguir lo que ahora falta garantizaría lo que aquel marco
 * venía a establecer: ahí la regresión estaría pidiendo, para hacer X, algo que
 * ya implica X. Devuelve la firma del ancestro para que el motivo la nombre —un
 * «esto es un ciclo» sin decir contra qué no se puede discutir—.
 */
function dominante(
  clausulas: readonly Predicado[],
  marcos: readonly MarcoDePlan[],
): PredicateSignature | undefined {
  for (const m of marcos) {
    const suyas = clausulasDe(m.establece)
    if (suyas === undefined || suyas.length === 0) continue
    let cubre = true
    for (const c of suyas) if (!clausulas.some((p) => implica(p, c))) cubre = false
    if (cubre) return m.establece
  }
  return undefined
}

function regresar(
  nodo: NodoAbierto,
  g: GoalNode,
  v: VistaDelPlan,
  todos: readonly ConstructionSchema[],
  clausulas: readonly Predicado[] | undefined,
): Resultado {
  if (clausulas === undefined) {
    return morir(nodo, v, todos, clausulas, `«${nodo.falta}» no se entiende como predicado: no hay nada que regresar`)
  }
  if (nodo.marcos.length >= PROFUNDIDAD_MAXIMA) {
    return morir(
      nodo,
      v,
      todos,
      clausulas,
      `se llegó a la profundidad máxima (${String(PROFUNDIDAD_MAXIMA)}) con «${nodo.falta}» sin cerrar`,
    )
  }
  // ─── EL CORTE DE CICLOS ES POR LINAJE, Y EL LINAJE YA VIAJA EN EL NODO ────
  //
  // Antes había una lista de firmas ya abiertas compartida por TODA la búsqueda,
  // y cortaba de más: mataba ramas que no eran ciclos sino HERMANAS. Medido —
  // `friccion` necesita dos cuerpos rígidos, `deshilachar` sabe fabricarlos y su
  // `split` no consume la fuente, así que sacarle dos hebras al mismo matorral es
  // legal; el planificador sacaba una y contestaba «ya se había abierto más
  // arriba en esta misma búsqueda», que además de matar el plan era falso: la
  // firma no estaba en ningún ancestro, estaba en el rol de al lado.
  //
  // El linaje del nodo es su propia pila de marcos, que es lo que el mensaje
  // prometía desde el principio. Y la comparación es por DOMINANCIA y no por
  // igualdad, que es lo que hace falta desde que la regresión entiende de
  // implicación: si lo que ahora falta GARANTIZA lo que un marco de más abajo
  // venía a establecer, conseguirlo pide tenerlo, y eso no avanza. La igualdad de
  // texto está adentro de la dominancia, así que esto no afloja nada.
  //
  // `PROFUNDIDAD_MAXIMA` sigue haciendo la otra mitad: corta las cadenas
  // infinitas que no repiten firma —un residuo intensivo que viaja al rol
  // material puede fabricar firmas nuevas para siempre— y ahora también las que
  // bajan de a poco el umbral de la misma cualidad.
  const ancestro = dominante(clausulas, nodo.marcos)
  if (ancestro !== undefined) {
    return morir(
      nodo,
      v,
      todos,
      clausulas,
      `«${nodo.falta}» ya está en el linaje de este nodo —el marco de «${ancestro}» vino a establecerlo—: ` +
        `para conseguirlo haría falta tenerlo`,
    )
  }

  // Las vías, en el orden de la tabla. Una vía es un PROCESO —todas sus filas se
  // aplican juntas y el costo se cobra una vez— o UNA FILA DE LEY, que no se junta
  // con nadie: ver `claveDeVia`.
  const vias: string[] = []
  for (const e of todos) {
    const c = claveDeVia(e)
    if (!vias.includes(c)) vias.push(c)
  }

  const nodos: NodoAbierto[] = []
  const rechazos: string[] = []

  for (const via of vias) {
    const usados = esquemasQueAportan(todos, via, clausulas)
    if (usados.length === 0) continue

    // Lo que este puñado de esquemas promete, y lo que del pedido queda sin
    // cubrir. Las dos cuentas van por IMPLICACIÓN y no por texto: si el esquema
    // deja `temperature>=400` y el pedido era `temperature>=300`, no hay residuo.
    const promesas: Predicado[] = []
    for (const e of usados) for (const c of clausulasDe(firmaDe(e.establishes)) ?? []) promesas.push(c)
    const residuo = clausulas.filter((c) => !promesas.some((p) => implica(p, c)))

    // ── EL RESIDUO, QUE ES LA PARTE QUE SE PUEDE DISCUTIR ──────────────────
    //
    // Lo que la conjunción pide y este proceso no promete tiene que salir de
    // algún lado, y el único lado posible es la materia que entra: se le exige
    // al rol material. Vale para las cualidades INTENSIVAS y sólo para ellas,
    // porque son las que la materia se lleva puestas —deshilachar un leño rígido
    // da una hebra rígida—; una extensiva NO viaja —la hebra se lleva la décima
    // parte del `heatCapacity`— y pedírsela a la fuente sería exigir diez veces
    // de más o de menos según el signo. Ahí el proceso se rechaza.
    //
    // Y hay que decir de qué lado se equivoca: exigirle al material lo que el
    // proceso quizás fabricaba es DEMASIADO ESTRICTO. Se pierden planes que
    // habrían salido —`union` fabrica `catch` de la nada y esta regla se lo hace
    // pedir prestado a la vara—. Es el error barato de los dos: no encontrar un
    // plan cuesta trabajo; encontrar uno que no funciona manda a la criatura al
    // río con las manos vacías. Es la misma elección que `cumpleCuerpo`.
    let extensiva: string | undefined
    for (const c of residuo) {
      if (c.k !== 'cualidad') {
        extensiva = `«${textoDe(c)}» no es una cualidad y no puede viajar por la materia`
        break
      }
      if (specOf(c.test.q).extent !== 'intensive') {
        extensiva = `«${textoDe(c)}» es extensiva: la materia que entra no la conserva al salir`
        break
      }
    }
    if (extensiva !== undefined) {
      rechazos.push(`«${via}» no alcanza para «${nodo.falta}»: ${extensiva}`)
      continue
    }

    const armado = armarMarco(nodo, g, usados, residuo, v)
    if ('rechazo' in armado) {
      rechazos.push(armado.rechazo)
      continue
    }
    const cerrado = cerrar(
      {
        falta: nodo.falta,
        camino: nodo.camino,
        profundidad: nodo.marcos.length + 1,
        costo: nodo.costo + armado.segundos,
        marcos: [...nodo.marcos, armado.marco],
        enMano: nodo.enMano,
        gastados: nodo.gastados,
      },
      v.self.capacity,
    )
    if ('rechazo' in cerrado) {
      rechazos.push(cerrado.rechazo)
      continue
    }
    nodos.push(cerrado)
  }

  if (nodos.length === 0) {
    const causa = rechazos.length > 0 ? rechazos.join('; ') : SIN_VIA
    return morir(nodo, v, todos, clausulas, causa)
  }
  return { k: 'nodos', nodos }
}

/**
 * El «por qué» del `gap`, con LO ACCIONABLE ADELANTE.
 *
 * Una rama puede morir por cuatro motivos mecánicos —no se entiende, tope de
 * profundidad, ciclo, ninguna vía sirve— y ninguno de los cuatro es lo que el
 * Hito 8 necesita leer. Lo que necesita leer es CUÁL CLÁUSULA NO TIENE NINGÚN
 * ESQUEMA, porque eso no es un accidente de la búsqueda: es un agujero del
 * catálogo, y es el pedido que se le lleva a la fragua —«ningún proceso conocido
 * establece enganche»—.
 *
 * Y los dos se dicen, no uno. El motivo mecánico se conserva después del guion
 * porque es lo que explica por qué la búsqueda no encontró la vuelta larga: con
 * el puente de `catch>0` sacado, la cláusula huérfana es `catch>0` Y ADEMÁS la
 * regresión intentó pedírsela prestada a la vara y volvió al mismo pedido. Sin
 * la segunda mitad, alguien podría creer que ni se intentó.
 *
 * La única excepción es `SIN_VIA`, que no explica nada que la cabeza no diga ya:
 * «no hay esquema para esto» y «ninguna vía aplicó» son la misma frase dos veces.
 */
const SIN_VIA = 'ningún esquema conocido aplica'
function porqueMurio(
  clausulas: readonly Predicado[] | undefined,
  todos: readonly ConstructionSchema[],
  causa: string,
): string {
  if (clausulas === undefined) return causa
  const establecidas: Predicado[] = []
  for (const e of todos) for (const c of clausulasDe(firmaDe(e.establishes)) ?? []) establecidas.push(c)
  // Huérfana es la que NINGÚN esquema garantiza, y «garantiza» es `implica`: con
  // la comparación de texto que había acá, `temperature>=300` salía como huérfana
  // teniendo `temperature>=400` en la tabla, y el Hito 8 iba a pedirle a la
  // fragua un proceso para calentar a 300 grados que el catálogo ya sabe hacer.
  const cubre = (c: Predicado): boolean => establecidas.some((e) => implica(e, c))
  const huerfanas = clausulas.filter((c) => !cubre(c))
  if (huerfanas.length === 0) return causa
  const nombres = huerfanas.map((c) => `«${textoDe(c)}»${loMasCerca(c, establecidas)}`).join(' ni ')
  const otras = clausulas.filter(cubre)
  const cabeza =
    otras.length === 0
      ? `ningún esquema conocido establece ${nombres}`
      : `ningún esquema conocido establece ${nombres}; ${otras
          .map((c) => `«${textoDe(c)}»`)
          .join(', ')} sí tiene esquema, y por sí solo no alcanza`
  return causa === SIN_VIA ? cabeza : `${cabeza} — ${causa}`
}

/**
 * LO MÁS CERCA QUE LLEGA EL CATÁLOGO, dicho al lado de la cláusula huérfana.
 *
 * Hay dos clases de huérfana y el Hito 8 tiene que poder distinguirlas, porque
 * lo que le va a pedir a la fragua es distinto:
 *
 *   · NADIE SABE NADA DE ESTA MAGNITUD. `emitsPower>0`: hace falta un proceso.
 *   · ALGUIEN SABE, PERO NO LLEGA. `catch>0.0001` con el puente de `catch>0` dos
 *     filas más arriba: no hace falta un proceso nuevo, hace falta uno MEJOR, o
 *     bajar la vara. Decir «ningún esquema conocido establece catch» ahí era
 *     falso y mandaba a inventar lo que ya está inventado.
 *
 * Lo que se nombra es lo que el catálogo promete sobre la misma magnitud, sin
 * elegir cuál es «el más fuerte»: elegir exigiría un orden total entre umbrales
 * que sólo existe adentro de la misma dirección, y las promesas se listan en el
 * orden de la tabla, que es fijo.
 */
function loMasCerca(c: Predicado, establecidas: readonly Predicado[]): string {
  const misma = (e: Predicado): boolean =>
    (c.k === 'cualidad' && e.k === 'cualidad' && e.test.q === c.test.q) ||
    (c.k === 'geometria' && e.k === 'geometria' && e.f === c.f)
  const cerca: string[] = []
  for (const e of establecidas) {
    if (!misma(e)) continue
    const t = textoDe(e)
    if (!cerca.includes(t)) cerca.push(t)
  }
  if (cerca.length === 0) return ''
  return ` (lo más cerca que llega el catálogo es ${cerca.map((t) => `«${t}»`).join(', ')})`
}

function morir(
  nodo: NodoAbierto,
  v: VistaDelPlan,
  todos: readonly ConstructionSchema[],
  clausulas: readonly Predicado[] | undefined,
  causa: string,
): Resultado {
  return {
    k: 'muerto',
    muerto: {
      falta: nodo.falta,
      why: porqueMurio(clausulas, todos, causa),
      nearest: pasosPosibles(nodo, v),
      profundidad: nodo.marcos.length,
      costo: nodo.costo,
    },
  }
}

/**
 * LO QUE SÍ SE PUEDE HACER MIENTRAS TANTO: el `nearest` del `gap`.
 *
 * No es una consolación ni una heurística: son los pasos de esta rama que SÍ se
 * pueden dar hoy —los marcos completos que ya emitió, más las idas y tomas de
 * cada rol que se puede llenar con algo que se ve, esté ligado o no—. Lo de
 * «esté ligado o no» es lo que hace que salga el ejemplo del documento: la
 * regresión fabrica primero y liga después, así que cuando la caña resulta
 * imposible el `source` de `extraccion` TODAVÍA NO ESTÁ LIGADO, y sin mirar los
 * pendientes el `nearest` saldría vacío. Se sabe pescar en el río, no se sabe
 * hacer la caña, y mientras nace el contrato el cuerpo ya está caminando al agua.
 *
 * ─── LO QUE EL DOCUMENTO PONE ACÁ Y NO SE PUEDE PONER ───────────────────────
 *
 * `nearest: [ir(río), tantear]`. `tantear` NO ESTÁ en `Step`, y su ausencia está
 * decidida y escrita en `tipos.ts`: es percepción activa y todavía no hay ningún
 * objetivo que la pida. `explorar` sí está y sería el reemplazo natural —«andá a
 * buscar algo con `catch>0`»— y tampoco se puede emitir: `explorar` pide
 * `maxTicks`, que son TICKS, y `VistaDelPlan` no tiene `hz` con qué convertir los
 * segundos del reloj. Inventar el número sería la clase de dato que después nadie
 * puede discutir. Queda como hueco medido y no como comentario al pasar.
 */
function pasosPosibles(nodo: NodoAbierto, v: VistaDelPlan): readonly Step[] {
  const pasos: Step[] = [...nodo.camino]
  const nombrados = new Set<BodyId>(nodo.enMano)
  // De arriba hacia abajo de la pila: es el orden en que se hubieran usado —el
  // marco de más adentro se completa primero—.
  for (let i = nodo.marcos.length - 1; i >= 0; i--) {
    const m = nodo.marcos[i]
    if (m === undefined) continue
    // Un marco de ley no pide nada en la mano —lo que hace es apoyar— y su alcance
    // es una celda, que es lo que `poner` exige de la celda destino.
    const p = m.por.k === 'proceso' ? procesoDe(m.por.via) : undefined
    const aLaMano = p !== undefined && hayQueTenerloEnLaMano(p)
    const alcance = p === undefined ? 1 : alcanceDe(p)
    const anotar = (ref: Ref, porQue: PredicateSignature): void => {
      if (ref.k !== 'id' || nombrados.has(ref.id)) return
      nombrados.add(ref.id)
      pasos.push({ k: 'ir', a: ref, within: alcance, porQue })
      if (aLaMano) pasos.push({ k: 'sostener', que: ref, porQue })
    }
    for (const rol of nombresOrdenados(m.roles)) {
      const ref = m.roles[rol]
      if (ref !== undefined) anotar(ref, m.porRol[rol] ?? m.establece)
    }
    for (const pedido of m.faltan) {
      const cl = clausulasDe(pedido.firma)
      if (cl === undefined) continue
      const cuerpo = elegirCuerpo(cl, pedido, v, nodo.enMano, [...nodo.gastados, ...nombrados])
      if (cuerpo !== undefined) anotar({ k: 'id', id: cuerpo.id }, pedido.firma)
    }
  }
  return pasos
}

// ─── Lo que ya está hecho no es un paso ─────────────────────────────────────
//
// ═══ EL BUG QUE ESTO CIERRA, MEDIDO ═════════════════════════════════════════
//
// Con el pescado en la mano y `holding(tag:carnoso,toxicity<0.0528)` de meta,
// `plan()` contestaba `gap` con un `nearest` de UN paso —`ir(suelta:-6:-7:2,
// within:1)`, «acercate a lo que podría hacer de parrilla»— y la criatura YA
// ESTABA a una celda. La innata `ir` tiene su salida temprana («si ya estoy, no
// gasto una intención»), así que el paso aterrizaba `ok:true` **sin emitir una
// sola intención al mundo**; al tick siguiente D4 volvía a pedir el mismo plan,
// salía el mismo `gap` y con él el mismo `ir`:
//
//     tanque  310 ....  6045 despegues de `ir(suelta:-6:-7:2)` en  6171 ticks
//     tanque 1000 ... 19846 despegues                          en 19971 ticks
//
// El 98% de la vida dando un paso que ya estaba dado, **y todo en verde**: cada
// vuelo aterriza bien y ningún invariante se rompe. Es la misma familia que el
// contador que leía despegues en vez de aterrizajes: el sistema no distinguía
// «avancé» de «hice una acción exitosa».
//
// ═══ Y NO ES SÓLO `ir` ══════════════════════════════════════════════════════
//
// Es de toda habilidad cuyo contrato establece un ESTADO en vez de un EVENTO:
// si el estado ya vale, correrla es un no-op con cara de progreso. `grep -n
// 'return done' skills/src/innatas/*.ts` da cinco con salida temprana en el
// tick cero: `ir` (ya estoy adentro del `within`), `sostener` (ya lo tengo en la
// mano), `frotar` (ya está a temperatura), `esperar` (`hasta()` ya se cumple) y
// `explorar` (ya lo veo). Las otras diez son eventos —`unir`, `aplicar`,
// `comer`, `poner`, `juntar`, `deshilachar`…— y aplicarlas dos veces hace dos
// cosas, no una.
//
// De esas cinco, `Step` sólo puede emitir dos ya cumplidas antes de tocar el
// mundo: `ir` y `sostener`. `frotar(hasta)`, `esperar(hasta)` y `explorar`
// dependen de cualidades que el paso anterior del mismo plan cambia, y decidir
// «ya está» sobre ellas exigiría simular. Se contestan `false` y está dicho en
// `pasoYaEstaHecho`: preferimos gastar un tick antes que podar un paso que hacía
// falta.
//
// ═══ POR QUÉ SÓLO EL PREFIJO, Y ESTO ES LO QUE HACE QUE SEA CORRECTO ════════
//
// Porque «ya está hecho» es una afirmación SOBRE UN ESTADO, y el único estado
// que el planificador conoce es el de HOY. El primer paso de la lista se ejecuta
// contra la vista de hoy, así que sobre él la pregunta se puede contestar; sobre
// el segundo ya no, porque depende de lo que haga el primero. Podar
// `ir(vara-2)` porque la criatura hoy está al lado de `vara-2` sería un error
// cuando el paso anterior la manda a caminar diez celdas hasta `vara-1`.
//
// Así que se recorre desde el frente y se corta en el primer paso que NO se
// puede dar por hecho. Lo que queda es exactamente lo mismo que se hubiera
// ejecutado, sin los ticks que no hacían nada.
//
// ═══ Y UNA LISTA QUE QUEDA VACÍA NO ES «NO HAY NADA QUE HACER» ══════════════
//
// Son dos cosas distintas y quien las confunda vuelve a caer en el mismo pozo:
//
//   `nearest` VACÍO DE ENTRADA  la rama muerta no dejó nada listo — ni siquiera
//                               sabe hacia dónde acercarse.
//   `nearest` VACÍO DESPUÉS DE  todo lo que había para acercarse YA ESTÁ HECHO:
//   PODAR                       la criatura está tan cerca como puede estar y
//                               sigue sin poder. Es información distinta, y es
//                               la que el Hito 8 le tiene que llevar a la fragua.
//
// Por eso la poda escribe en el `why` cuántos pasos sacó y por qué, en vez de
// devolver una lista corta y callarse. La mente reacciona igual a las dos —cae a
// D5, que es lo honesto: no hay nada que hacer HOY para esta meta— pero se
// entera de cuál de las dos es.

/**
 * ¿Este paso, contra la vista de hoy, ya está cumplido antes de despegar?
 *
 * EXPORTADA, y es la única función de este archivo que sale del paquete además
 * de `plan()`. La mente se hace la misma pregunta en el momento de volar —ver
 * `escalera.ts`, el portón de despegue— y tener dos escrituras de «ya está
 * dado» es garantizarse que un día digan cosas distintas.
 */
export function pasoYaEstaHecho(s: Step, v: VistaDelPlan): boolean {
  switch (s.k) {
    case 'ir': {
      // El mismo `resolver` que la mente va a usar para armar los argumentos, y
      // la misma `distancia` (Chebyshev) que la innata compara contra `within`.
      // Dos lecturas del mismo número escritas dos veces es el bug que en la
      // grilla se ve como «a veces no llega».
      const a = resolver(s.a, v)
      if (a === undefined) return false
      const destino: Cell = 'at' in a ? a.at : a
      return distancia(v.self.at, destino) <= (s.within ?? 0)
    }
    case 'sostener': {
      // `enLaMano` de la innata es identidad de `id` sobre `self.holding`, y eso
      // es lo que se pregunta acá: no hace falta resolver contra `see`.
      if (s.que.k !== 'id') return false
      const id = s.que.id
      return v.self.holding.some((b) => b.id === id)
    }
    // Los diez eventos y las tres condicionales. Ver el encabezado: acá se
    // contesta `false` a propósito, y el precio es a lo sumo un tick.
    default:
      return false
  }
}

/**
 * El prefijo de pasos que ya están dados, sacado. Ver el encabezado del bloque.
 *
 * ─── EL COSTO, MEDIDO Y NO ESTIMADO ────────────────────────────────────────
 *
 * Se corta en el primer paso que no está hecho, así que el caso normal —el
 * primer paso hay que darlo— es **UNA** resolución de `Ref`. El peor caso es un
 * plan entero de no-ops, y ése es justamente el que había que dejar de ejecutar.
 *
 * Medido sobre la orilla del criterio a los 400 ticks (15 cuerpos a la vista),
 * 20.000 llamadas por fila:
 *
 *     `ir` con `{k:'id'}` que NO está en la mano ... 2,146 µs   ← el peor caso
 *     `sostener` .................................. 0,278 µs
 *     cualquiera de los diez eventos .............. 0,030 µs
 *
 * Los 2,1 µs son casi todos el `see([])` de `porId` —`referencias.ts` ya lo dice
 * en su decisión 2: «`id` NO TIENE ÍNDICE, y el costo se dice en voz alta»— y no
 * son costo nuevo de esta poda: es el mismo barrido que la mente iba a pagar
 * igual al traducir el paso. Contra el `plan()` que lo contiene, que el banco
 * mide entre 100 y 1400 µs según el tamaño de la escena, es entre el 0,15% y el
 * 2%.
 *
 * Y de punta a punta no se mide: cuatro corridas de 6200 a 20.000 ticks dan
 * 0,5835 · 0,5848 · 0,4136 · 0,2366 ms/tick contra 0,6094 · 0,5596 · 0,4289 ·
 * 0,2446 de antes — deltas de ±5% y de los dos signos, o sea ruido de reloj de
 * pared. Lo que sí se mueve es cuántos vuelos hay que pagar.
 */
function sinLoQueYaEstaHecho(pasos: readonly Step[], v: VistaDelPlan): readonly Step[] {
  let i = 0
  while (i < pasos.length) {
    const s = pasos[i]
    if (s === undefined || !pasoYaEstaHecho(s, v)) break
    i++
  }
  return i === 0 ? pasos : pasos.slice(i)
}

// ─── El orden de la cola ────────────────────────────────────────────────────

/**
 * La clave de desempate: TODO lo que el nodo es, en texto.
 *
 * Que sea total no es un lujo: si dos nodos empataran, `sort` los dejaría en el
 * orden en que llegaron, que es el orden de `ESQUEMAS`, y barajar la tabla
 * cambiaría el plan. Dos nodos con la misma clave son el mismo nodo en todo lo
 * que la búsqueda mira, así que empatar ahí no puede cambiar nada.
 */
function claveDe(n: NodoAbierto): string {
  return [
    String(n.profundidad).padStart(3, '0'),
    n.falta,
    n.marcos.map(firmaDeMarco).join(';'),
    n.camino.map(firmaDePaso).join(';'),
    [...n.enMano].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(','),
    [...n.gastados].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(','),
  ].join('|')
}

function firmaDeMarco(m: MarcoDePlan): string {
  const roles = nombresOrdenados(m.roles)
    .map((r) => `${r}=${firmaDeRef(m.roles[r])}`)
    .join(',')
  const faltan = m.faltan.map((q) => `${q.rol}:${q.firma}${firmaDeExtra(q)}`).join(',')
  // La vía entra en la clave con la MISMA forma con la que la tabla la agrupa —y se
  // le pregunta a `claveDeVia` en vez de rearmarla acá, que es lo que hacía que dos
  // marcos de la misma ley con geometrías distintas empataran: desde que la cocción
  // tiene una fila por montaje, `ley:desnaturalizacion:<firma>` ya no identifica una
  // fila. Dos claves iguales en `claveDe` son «el mismo nodo en todo lo que la
  // búsqueda mira», y eso dejaría de ser cierto.
  const via = m.por.k === 'proceso' ? `proceso:${m.por.via}` : claveDeVia(m.por.esquema)
  return `${via}[${m.establece}]${m.paraRol ?? '-'}{${roles}}(${faltan})`
}

/**
 * La mitad del pedido que no se regresa, también en la clave.
 *
 * Hoy no puede desempatar nada —el filtro y la celda son función de la vía y del
 * pedido, que ya están en la clave, así que dos marcos que empaten en todo lo
 * demás tienen el mismo filtro— y va igual: la clave promete ser TODO lo que el
 * nodo es, y una promesa que se cumple por accidente deja de cumplirse el día que
 * el accidente cambie.
 */
function firmaDeExtra(q: PedidoDeRol): string {
  const f = (q.filtro ?? []).map((t) => `${t.q}${t.op}${String(t.v)}`).join(',')
  const c = (q.celda ?? []).map((t) => `${t.q}${t.op}${String(t.v)}`).join(',')
  return f.length === 0 && c.length === 0 ? '' : `<${f}|${c}>`
}

function firmaDeRef(r: Ref | undefined): string {
  if (r === undefined) return '-'
  switch (r.k) {
    case 'id':
      return `id:${r.id}`
    case 'donde':
      return `donde:${r.where.map((t) => `${t.q}${t.op}${String(t.v)}`).join(',')}`
    case 'celda':
      return `celda:${String(r.at.x)},${String(r.at.y)}`
    case 'rinde':
      return `rinde:${r.de}`
    case 'yo':
      return 'yo'
  }
}

function firmaDePaso(s: Step): string {
  switch (s.k) {
    case 'ir':
      return `ir(${firmaDeRef(s.a)},${String(s.within ?? 0)})`
    case 'juntar':
      return `juntar(${String(s.cuantos)})`
    case 'deshilachar':
      return `deshilachar(${firmaDeRef(s.fuente)},${String(s.cuantas)},${s.rinde ?? '-'})`
    case 'unir':
      return `unir(${firmaDeRef(s.binder)},${firmaDeRef(s.a)},${firmaDeRef(s.b)},${s.rinde ?? '-'})`
    case 'aplicar':
      return `aplicar(${s.proceso},${nombresOrdenados(s.roles)
        .map((r) => `${r}=${firmaDeRef(s.roles[r])}`)
        .join(',')},${s.rinde ?? '-'})`
    // La REVISIÓN y los roles ligados. `cuantos` NO entra, y no es un olvido: sale
    // de la forma del plano, o sea de la revisión, así que dos pasos con la misma
    // revisión y distinto `cuantos` no pueden existir. Meterlo sería agrandar la
    // clave con algo que ya está adentro de la primera letra.
    case 'armar':
      return `armar(${s.revision},${nombresOrdenados(s.roles)
        .map((r) => `${r}=${firmaDeRef(s.roles[r])}`)
        .join(',')},${s.rinde ?? '-'})`
    case 'comer':
      return `comer(${firmaDeRef(s.bocado)})`
    case 'frotar':
      return `frotar(${firmaDeRef(s.a)},${firmaDeRef(s.b)},${String(s.hasta ?? 0)})`
    case 'poner':
      return `poner(${firmaDeRef(s.que)},${firmaDeRef(s.en)})`
    // Los segundos SÍ entran en la firma: dos esperas de distinto largo son dos
    // pasos distintos, y esta firma es lo que distingue un nodo de otro.
    //
    // Y `mirando` NO ENTRA, y esto se probó de las dos maneras. `claveDe` no es una
    // llave de deduplicación: es el DESEMPATE de la cola, o sea que cambiarla
    // reordena nodos de igual costo y con eso cambia qué plan sale. Metiendo el
    // `mirando` acá, el plan de ligar un fuego que ya existe pasó de 5 pasos a 7 —
    // medido en `mind/tests/hito-5-el-criterio.test.ts`— sin que ninguna de las dos
    // versiones fuera mejor: era el orden lexicográfico moviéndose.
    //
    // Y no se pierde nada, porque `mirando` no discrimina: sale del `establishes` de
    // la fila y del rol sujeto, y los dos ya están en la clave por otro lado —la
    // promesa en `n.falta` y los roles en `firmaDeMarco`—. Dos caminos que sólo
    // difirieran en el sujeto de la espera difieren también en los `poner` y el
    // `sostener` que lo nombran.
    case 'esperar':
      return `esperar(${String(s.segundos)})`
    case 'sostener':
      return `sostener(${firmaDeRef(s.que)})`
    case 'explorar':
      return `explorar(${String(s.maxTicks)})`
  }
}

function comparaNodos(a: NodoAbierto, b: NodoAbierto): number {
  if (a.costo !== b.costo) return a.costo < b.costo ? -1 : 1
  const x = claveDe(a)
  const y = claveDe(b)
  return x === y ? 0 : x < y ? -1 : 1
}

/** El muerto que se reporta: el más barato, y el empate lo rompe el contenido. */
function comparaMuertos(a: RamaMuerta, b: RamaMuerta): number {
  if (a.costo !== b.costo) return a.costo < b.costo ? -1 : 1
  if (a.profundidad !== b.profundidad) return a.profundidad < b.profundidad ? -1 : 1
  if (a.falta !== b.falta) return a.falta < b.falta ? -1 : 1
  return a.why === b.why ? 0 : a.why < b.why ? -1 : 1
}

// ─── `plan()` ───────────────────────────────────────────────────────────────

/**
 * Encadenado hacia atrás sobre la tabla de esquemas, ANYTIME.
 *
 * `presupuesto` son EXPANSIONES, no milisegundos (ADR II-0012). `frontera`, si
 * viene, es lo que devolvió un `parcial` de un tick anterior: la búsqueda sigue
 * desde ahí y el resultado es EL MISMO que el de una corrida sin cortes.
 *
 * `opciones.catalogo` es la vista explícita del Gate 5→6: core inmutable más el
 * overlay de ESTA sesión, con su identidad. Es por donde entra lo que la criatura
 * inventó y es lo que le va a pasar la mente.
 *
 * `opciones.esquemas` reemplaza la tabla entera y queda como la escotilla de
 * laboratorio que siempre fue, para dos preguntas que no se pueden hacer de otra
 * manera: «¿el orden de la tabla cambia el plan?» y «¿qué `gap` sale si le falta
 * una fila?». Si vienen las dos, gana el catálogo: tiene identidad y la lista
 * pelada no.
 */
export function plan(
  g: GoalNode,
  v: VistaDelPlan,
  presupuesto: number,
  frontera?: Frontera,
  opciones?: OpcionesDePlan,
): PlanResult {
  // Un solo lugar donde se resuelve QUÉ TABLA se usa, y el caso por omisión sale
  // de la VISTA del core y no de `ESQUEMAS`: ésa es la puerta que el Gate 5→6
  // cierra, y no tiene una segunda.
  //
  // La escotilla de laboratorio entra por la MISMA puerta, envuelta en una vista.
  // Puede hacerlo porque sellar es perezoso (ver `sellar` en `catalogo.ts`): una
  // lista pelada no paga el hash hasta que alguien le pregunte la identidad, y
  // acá eso pasa sólo cuando hay una frontera de por medio.
  const catalogo =
    opciones?.catalogo ?? (opciones?.esquemas === undefined ? CATALOGO_CORE : catalogoDe(opciones.esquemas))
  const todos = esquemasDe(catalogo)

  // UNA FRONTERA DE OTRO CATÁLOGO NO SIRVE, y se tira acá y no más adelante para
  // que el resto de la función no tenga que preguntarse nunca de dónde salió.
  // El `&&` corta antes de leer `catalogEpoch`, así que una corrida sin frontera
  // —que es la mayoría— no toca el sello.
  const vigente = frontera !== undefined && frontera.catalogEpoch === catalogo.catalogEpoch ? frontera : undefined

  const abiertos: NodoAbierto[] =
    vigente === undefined
      ? [
          {
            falta: textoDe(g.goal),
            camino: [],
            profundidad: 0,
            costo: 0,
            marcos: [],
            // Lo que ya está en la mano arranca contado: si la caña ya está
            // agarrada, el plan no manda a buscarla.
            enMano: v.self.holding.map((b) => b.id),
            gastados: [],
          },
        ]
      : [...vigente.abiertos]
  const muertos: RamaMuerta[] = vigente === undefined ? [] : [...vigente.muertos]
  let hechas = vigente?.expansiones ?? 0
  let enEstaLlamada = 0

  abiertos.sort(comparaNodos)

  while (abiertos.length > 0) {
    if (enEstaLlamada >= presupuesto) {
      return {
        k: 'parcial',
        frontera: { abiertos, muertos, expansiones: hechas, catalogEpoch: catalogo.catalogEpoch },
        expansiones: hechas,
      }
    }
    const nodo = abiertos.shift()
    if (nodo === undefined) break
    hechas++
    enEstaLlamada++

    // El nodo TERMINAL: `marcos` vacía y `falta` en `''`. Se lo saca de la cola
    // como a cualquier otro, así que gana el plan más barato y no el primero.
    if (nodo.marcos.length === 0 && nodo.falta.length === 0) {
      // LO QUE YA ESTÁ HECHO NO SE EMITE, tampoco en un plan de verdad. Acá no
      // hay bucle —un plan se consume paso a paso y el siguiente sí mueve el
      // mundo— pero es el mismo no-op y cuesta un tick, que a la frecuencia de
      // referencia son 50 ms de vida. Ver el bloque `sinLoQueYaEstaHecho`.
      return { k: 'plan', steps: sinLoQueYaEstaHecho(nodo.camino, v), expansiones: hechas }
    }

    const r = expandir(nodo, g, v, todos)
    if (r.k === 'muerto') muertos.push(r.muerto)
    else for (const s of r.nodos) abiertos.push(s)
    abiertos.sort(comparaNodos)
  }

  // La cola se vació sin plan: hay `gap`. NO es un error —es un contrato recién
  // nacido— y por eso lleva con qué seguir: qué faltó, qué se puede hacer igual,
  // y por qué. El Hito 8 lee esto y le pide un proceso nuevo a la fragua.
  const ordenados = [...muertos].sort(comparaMuertos)
  const peor = ordenados[0]
  if (peor === undefined) {
    return {
      k: 'gap',
      missing: textoDe(g.goal),
      nearest: [],
      why: 'la búsqueda se quedó sin nodos abiertos y sin ninguna rama muerta que explique por qué',
      expansiones: hechas,
    }
  }
  // Y EL «MIENTRAS TANTO» TAMBIÉN SE PODA, que es donde el no-op costaba una
  // vida entera: el `gap` se vuelve a pedir cada tick mientras la meta siga sin
  // cumplirse, así que un paso ya dado adelante de la lista se re-emite para
  // siempre. Ver el bloque `sinLoQueYaEstaHecho`.
  const queda = sinLoQueYaEstaHecho(peor.nearest, v)
  const podados = peor.nearest.length - queda.length
  // Y SE DICE EN EL `why`, porque «quedó vacío después de podar» NO es lo mismo
  // que «no había nada»: la primera dice «estoy tan cerca como puedo estar y
  // sigue sin alcanzar», que es lo que el Hito 8 le lleva a la fragua.
  const why =
    podados === 0
      ? peor.why
      : `${peor.why} (y de lo que se podía hacer mientras tanto, ${String(podados)} paso${podados === 1 ? '' : 's'} ya estaba${podados === 1 ? '' : 'n'} dado${podados === 1 ? '' : 's'}${queda.length === 0 ? ': no queda nada por acercar' : ''})`
  return { k: 'gap', missing: peor.falta, nearest: queda, why, expansiones: hechas }
}
