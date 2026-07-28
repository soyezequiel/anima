// ─── @anima/plan/esquemas.ts ─────────────────────────────────────────────────
//
// QUÉ PROCESO ESTABLECE QUÉ. Es la tabla sobre la que regresa `plan()`, y es el
// módulo que decide si el paquete sirve: si estas ocho filas son recetas, el
// planificador es un recetario con pasos de más; si son física verificada, la
// caña la arma la aritmética y nadie escribió «caña».
//
// ─── LAS DOS FUENTES, Y POR QUÉ NO ALCANZA CON UNA ──────────────────────────
//
//   (a) LO DECLARADO. Cada trozo de `Process.establishes` de los cuatro procesos
//       de la semilla. Es mecánico y sale del catálogo: seis filas.
//   (b) LOS PUENTES. Lo que `establishes` NO dice y el mundo SÍ hace. Dos filas,
//       y cada una lleva su evidencia medida en `PUENTES`.
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
  SEED_PROCESSES,
  T_AMBIENTE,
  type Process,
  type ProcessId,
} from '@anima/physics'

import type { ConstructionSchema, PredicateSignature } from './tipos.js'

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

/** Una fila, con los `segundos` puestos por el catálogo y no por quien escribe. */
function esquema(
  establishes: PredicateSignature,
  via: ProcessId,
  roleHints: ConstructionSchema['roleHints'],
  cellHints?: ConstructionSchema['cellHints'],
): ConstructionSchema {
  return cellHints === undefined
    ? { establishes, via, roleHints, segundos: segundosDe(via) }
    : { establishes, via, roleHints, cellHints, segundos: segundosDe(via) }
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
  readonly via: ProcessId
  /** Qué hace el mundo que `establishes` no dice. */
  readonly porque: string
  /** Dónde está MEDIDO, en rutas desde `ii/`. */
  readonly medidoEn: readonly string[]
}

export const PUENTES: readonly Evidencia[] = [
  {
    establishes: 'catch>0',
    via: 'union',
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
    establishes: 'heatCapacity<=0.9',
    via: 'deshilachar',
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
]

// ─── Los ocho esquemas ──────────────────────────────────────────────────────
//
// El orden es el de `SEED_PROCESSES`, y adentro de cada proceso primero lo
// declarado y después sus puentes. No es cosmético: `SCHEMA_INDEX` conserva este
// orden, y de él depende qué esquema prueba primero la regresión cuando dos
// establecen la misma firma. Un orden que dependiera de cómo se construyó un
// `Map` sería no-determinismo con otro nombre.

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
  // sabe de cualidades de cuerpo. Mientras esta fila no dijo nada de la celda, el
  // planificador elegía el `source` POR CERCANÍA entre todo lo que tuviera masa:
  // una piedra de 5 kg a una celda le ganaba al río de 50 kg a ocho, el plan
  // salía verde y el mundo contestaba `sin-pozo`. La pesca del Hito 5 funcionaba
  // por casualidad —el río del test tiene tres cuerpos y `union` se come dos, así
  // que el tercero quedaba de pozo por descarte—.
  //
  // `cellHints` es lo que faltaba, y no inventa un vocabulario: `VistaDelPlan` ya
  // traía `qAt`. Un pozo de esta semilla está SIEMPRE en agua franca (los únicos
  // `Stock` que decreta el dios son bancos de agua), y el agua franca vale
  // `wet = 1,0000` contra `0,6000` de la orilla desde la que se pesca. Es NECESARIA y
  // no suficiente —una piedra adentro del río sigue pasando, y ahí sigue mandando
  // `sin-pozo`—, y así queda escrito: lo que compra es que el hueco deje de
  // elegir, no que desaparezca.
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
    { source: [{ q: 'wet', op: '>=', v: AGUA_FRANCA }] },
  ),
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
