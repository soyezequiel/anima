// ─── LA ESCENA: el view model del Hito 12A, derivado y sin una sola opinión ──
//
// El Hito 12A pide «datos de mapa · criatura · cuerpos · objetos · relaciones ·
// obras · dispositivos · **deltas deterministas** · descriptor visual canónico ·
// `renderDescriptorHash` · fallback procedural».
//
// La mitad de esa lista existe desde el tramo D·quater: `descriptor.ts` contesta
// qué se dibuja de un CUERPO. Lo que falta —y es lo que hay acá— es lo que rodea
// a los cuerpos: **el mapa, las relaciones, quién es la criatura, y qué cambió
// entre dos ticks**.
//
// ─── POR QUÉ ESTO SE ADELANTA A LA UI, QUE VA DESPUÉS DEL HITO 11 ──────────
//
// Por lo mismo por lo que el gate exige el descriptor visual sin que la UI
// exista: **es dato derivado del estado, así que se puede afirmar sin dibujar un
// píxel**. Un view model que sólo se pueda probar mirando la pantalla no se
// prueba nunca, y para cuando la pantalla exista ya va a tener adentro tres
// decisiones que nadie midió.
//
// ─── LAS TRES REGLAS, HEREDADAS DEL ADR II-0017 ────────────────────────────
//
//   1. es una FUNCIÓN PURA del estado. Mirar, pensar o renderizar nunca consume
//      RNG — la regla del Hito 2 que este archivo no puede romper;
//   2. NO INVENTA nada que la física no modele. Sin orientaciones, sin aberturas,
//      sin contención, sin tamaño de dibujo;
//   3. NADA COSMÉTICO entra: ni textos, ni nombres narrativos, ni colores. Si
//      entraran, dos clientes con distinto idioma dejarían de coincidir y el E2E
//      no podría comparar nada.
//
// ─── Y UNA CUARTA QUE ES DE ESTE ARCHIVO: TODO VA ORDENADO ────────────────
//
// Las celdas por fila y columna, los cuerpos por id, los actores por id. Un
// `Map` recorrido en orden de inserción produciría dos escenas distintas del
// mismo mundo según cómo se armó, y el `escenaHash` dejaría de significar algo.

import { qualityOf } from '@anima/physics'
import type { Duracion, ProcessId } from '@anima/physics'

import { hashWorld } from './hash.js'
import type { WorldHash } from './hash.js'
import { descriptorDe } from './descriptor.js'
import type { RenderDescriptor } from './descriptor.js'
import { celdaDecretada } from './dios.js'
import { keyOfCell } from './cell.js'
import { CELDA_POR_OMISION, shelteredDe } from './step.js'
import type { ActorId, BodyId, Placement, RoleBinding } from './intent.js'
import type { CellState, WorldState } from './step.js'

/**
 * LA VERSIÓN DE LA ESCENA. Sube cuando cambia QUÉ se publica de un mundo.
 *
 * Entra en el hash por lo mismo que la del descriptor: dos clientes con distinta
 * versión ven cosas distintas del mismo mundo, y el E2E tiene que verlo.
 */
export const VERSION_DE_LA_ESCENA = 3

/**
 * UNA CELDA DEL MAPA. Las tres que se guardan más `sheltered`, que es derivada.
 *
 * `sheltered` va aunque sea derivada —y no es una excepción a la regla 2— porque
 * la física SÍ la modela: sale de la oclusión de lo que haya puesto encima
 * (ADR II-0002), y es lo que distingue estar bajo techo de estar al aire. Sin
 * ella, un mapa no puede mostrar por qué la criatura se guareció ahí.
 */
export interface CeldaEnEscena {
  readonly at: Placement
  readonly wet: number
  readonly oxygen: number
  readonly temperature: number
  readonly sheltered: number
}

/**
 * UN CUERPO EN LA ESCENA: su descriptor más sus tres relaciones espaciales.
 *
 * Las relaciones viven acá y no adentro del `RenderDescriptor` a propósito: el
 * descriptor habla de UN cuerpo y se puede calcular sin el mundo (por eso
 * `descriptorDe` toma un cuerpo suelto), y una relación es entre DOS. Meterlas
 * adentro obligaría a que dibujar una vara suelta necesite el mapa entero.
 *
 * Son las tres que el mundo guarda y ni una más. `inside` no está, y su ausencia
 * es la mitad del ADR II-0002: el mundo evalúa `inside` como «tiene algo encima o
 * lo sostiene alguien», y publicarlo haría que la pantalla afirme una CONTENCIÓN
 * que la física no tiene. El jugador vería una jaula donde hay un estado.
 */
export interface CuerpoEnEscena {
  readonly d: RenderDescriptor
  readonly heldBy?: ActorId
  readonly supportedBy?: BodyId
  readonly covering?: BodyId
}

/**
 * LO QUE LA CRIATURA TIENE ENTRE MANOS AHORA. `Activity` recortada, y el recorte
 * es la decisión.
 *
 * ─── LO QUE NO ESTÁ, Y ES LO PRIMERO QUE UNO ESCRIBIRÍA ────────────────────
 *
 * **El total no está.** Una barra de progreso necesita «lleva 0,6 de 1 segundo»,
 * y acá sólo está el 0,6. El 1 vive en el proceso —`Process.completion.at`— y
 * quien dibuja ya recibe la `Physics` entera, así que lo busca por id. Copiarlo
 * acá sería duplicar un número que ya existe, con la única consecuencia posible
 * de que un día quede viejo respecto del catálogo que lo define.
 *
 * Y hay un caso que lo confirma en vez de ser una preferencia: `completion` es
 * OPCIONAL. `friccion` no la declara —frotar no termina, termina la criatura—,
 * así que ese proceso no tiene barra: tiene «en curso». Que la pantalla decida
 * eso mirando el catálogo es lo correcto; que la escena publique un total
 * inventado para esos casos sería violar la regla 2.
 *
 * **El nombre tampoco.** `Process.lexeme.nombre` diría «atar» y sería cómodo,
 * pero es texto, y la regla 3 de este archivo lo prohíbe: dos clientes con
 * distinto idioma verían escenas distintas del mismo mundo y `escenaHash`
 * dejaría de comparar nada. Va el id; la palabra la pone quien dibuja.
 */
export interface ActividadEnEscena {
  readonly proceso: ProcessId
  /**
   * QUÉ CUERPO LLENA QUÉ ROL, entero y no como lista de ids.
   *
   * Mandar sólo los `BodyId` sería más corto y perdería cuál es cuál: con los
   * nombres, la pantalla puede resaltar la liana y la vara que la acción está
   * tocando y saber cuál es el atador. Ya viene en orden canónico —el mundo lo
   * normaliza una vez con `ordenarRoles`—, así que no hay que reordenar acá.
   */
  readonly roles: readonly RoleBinding[]
  /** Cuántos SEGUNDOS DE MUNDO lleva, no cuántos ticks (ADR II-0008). */
  readonly segundos: Duracion
}

/**
 * UNA ESPERA ABIERTA. `Espera` sin el `seq`.
 *
 * El `seq` correlaciona la intención que abrió la espera con el evento que la
 * cierra ticks después: es del protocolo entre la mente y el mundo, no del mundo
 * visible. Una pantalla que lo recibiera no tendría qué hacer con él, y estaría
 * en el hash de la escena obligando a que dos clientes coincidan en un número de
 * secuencia que no se ve.
 */
export interface EsperaEnEscena {
  readonly segundos: Duracion
  readonly pedido: Duracion
}

/**
 * QUIÉN ES LA CRIATURA, en lo que se puede mostrar.
 *
 * `permits` NO está: es la cuarentena de una habilidad candidata, o sea de la
 * fragua, no del mundo visible.
 *
 * ─── POR QUÉ `haciendo` Y `esperando` SON DOS CAMPOS Y NO UNO ──────────────
 *
 * Para la pantalla son la misma barra, así que unificarlos se ve tentador. Pero
 * en el mundo son cosas distintas —una consume, la otra sólo deja pasar el
 * tiempo— y **nada en el tipo garantiza que no coexistan**: son dos campos
 * opcionales de `Actor` que se limpian por caminos separados. Unificarlos acá
 * obligaría a elegir cuál gana cuando hay los dos, y eso es inventar una regla
 * que el mundo no tiene (regla 2). Que la pantalla los junte en una sola barra si
 * quiere: ésa sí es una decisión de dibujo.
 *
 * ─── Y EL PRECIO, QUE NO ES EL TAMAÑO ──────────────────────────────────────
 *
 * `segundos` cambia en CADA TICK mientras hay algo en curso. Hasta acá un actor
 * entraba al delta sólo al cambiar `holding` o `capacity`, o sea casi nunca; a
 * partir de ahora viaja entero en cada tick que la criatura esté haciendo algo.
 *
 * Medido en `banco-el-delta-de-actores`, con una criatura y 400 ticks:
 *
 *   - en un mundo vivo, la lista de actores pasa de viajar en el **2,2%** de los
 *     ticks al **27,5%**, y cuesta 53 bytes por tick;
 *   - en el techo —frotar, que no declara `completion`— pasa al **90,2%** y
 *     cuesta **206 bytes por tick**, o sea 4,1 kB/s a 20 Hz.
 *
 * Y el techo es 90 y no 100 por una razón del mundo y no del protocolo: a los 359
 * ticks la criatura se queda sin aliento y suelta. Para reponerlo hay que dejar
 * las piedras y comer, así que no existe la partida que esté ocupada siempre.
 *
 * Con esos números la lista sigue viajando entera. El día que no alcance, lo que
 * cambia es cómo se manda —deltas propios para los actores— y no qué se publica.
 */
export interface ActorEnEscena {
  readonly id: ActorId
  readonly body: BodyId
  readonly holding: readonly BodyId[]
  readonly capacity: number
  /**
   * EL ALIENTO. `stamina` del cuerpo de la criatura, cruda.
   *
   * ─── POR QUÉ ACÁ Y NO EN EL DESCRIPTOR DEL CUERPO ──────────────────────
   *
   * `stamina` es una cualidad del CUERPO, así que el lugar obvio parecía el
   * `RenderDescriptor`. Dos razones para que no:
   *
   *   - el descriptor publica BANDAS y no números —`estado`, `porte`— y la razón
   *     está escrita en `body.ts`: para que el hash no cambie porque una gota de
   *     agua se evaporó. Meterle un número que se mueve solo rompería eso para
   *     los 30 cuerpos de una escena, no para uno;
   *   - el aliento sólo significa algo en quien actúa. `qualityOf` es total y le
   *     daría `0` a una piedra, así que publicarlo en el descriptor sería un
   *     campo que dice cero en el 99% de los cuerpos.
   *
   * ─── Y EL MÁXIMO NO VA, POR LO MISMO QUE NO VA EL TOTAL DE LA BARRA ─────
   *
   * Una barra de vida necesita «600 de 1000», y el 1000 no es del actor: es el
   * `range` que `stamina` declara en el catálogo de cualidades. No es decorativo
   * —comer se recorta contra él, que es por qué una criatura llena rechaza lo que
   * una flaca acepta— y quien dibuja ya tiene la `Physics`, así que lo lee de ahí.
   *
   * ─── VA EN ENTEROS, Y ESO SE DECIDIÓ MIDIENDO ──────────────────────────
   *
   * La primera versión publicaba la `stamina` cruda, con el argumento de que
   * redondear es una decisión de presentación. El banco la desarmó en una
   * corrida:
   *
   *   - el aliento crudo escribe hasta **18 caracteres** —`3999.9999999999995`,
   *     que es lo que queda de restarle una fracción a otra— por tick y por
   *     actor, y ninguno de esos catorce decimales se ve en una barra;
   *   - peor: el metabolismo drena aliento en CADA tick, así que la lista de
   *     actores pasaba a viajar en el **100%** de los cuadros. No cuando la
   *     criatura hace algo: siempre.
   *
   * En enteros escribe cuatro caracteres y el actor sólo entra al delta cuando el
   * número que se ve cambia de verdad. La resolución que se pierde no existe en
   * pantalla: `stamina` va de 0 a 1000, o sea mil escalones para una barra que en
   * el mejor de los casos mide cien píxeles.
   *
   * Y no contradice «redondear es presentación», que era el argumento bueno: lo
   * que lo hacía peligroso era que **cada cliente** redondeara por su cuenta.
   * Redondeando acá hay una sola verdad, y entra al hash como cualquier otra.
   *
   * Es la misma disciplina que ya usan `estado` y `porte` en el descriptor —no
   * viaja el número, viaja lo que se ve— sólo que con mil escalones en vez de
   * cuatro. `Math.trunc` y no `Math.round`: truncar no puede hacer que un aliento
   * de 0,4 se muestre como 1, o sea que una criatura acabada nunca se ve viva.
   *
   * Sin `?`: todo actor tiene cuerpo y todo cuerpo tiene `stamina`, aunque sea
   * cero. Un cero acá es información —esta criatura no puede más—, no una
   * ausencia.
   */
  readonly aliento: number
  readonly haciendo?: ActividadEnEscena
  readonly esperando?: EsperaEnEscena
}

/**
 * A CUÁNTAS CELDAS LLEGA LA VISTA DESDE EL FOCO, y por eje.
 *
 * ─── POR QUÉ SON DOS NÚMEROS Y NO UNO ──────────────────────────────────────
 *
 * Era uno solo, y eso hacía que el área visible fuera siempre un CUADRADO. La
 * consecuencia se ve en cuanto hay una pantalla de verdad adelante: una ventana
 * apaisada tiene el doble de ancho que de alto útil, y un cuadrado sólo puede
 * crecer hasta lo que da el LADO CORTO. En una pantalla de 1900×900 eso dejaba
 * setecientos píxeles a la derecha del mapa **sin nada dibujado**, y ningún zoom
 * los llenaba: agrandar un cuadrado lo frena el alto antes que el ancho.
 *
 * Con dos radios, la vista tiene la forma del lugar donde se la mira.
 *
 * ─── LO QUE NO CAMBIA, Y ES LA PARTE QUE IMPORTA ───────────────────────────
 *
 * Sigue siendo una CAJA y no una elipse. La razón es la de siempre y no se
 * movió: la distancia del mundo es Chebyshev —tocar algo es estar a 1 en el
 * máximo de las dos coordenadas—, así que el borde de lo alcanzable es recto.
 * Lo que se relajó es que los dos lados midan igual, que nunca fue una propiedad
 * del mundo: era una comodidad de quien escribió el primer `escenaDe`.
 */
export interface RadioDeEscena {
  readonly x: number
  readonly y: number
}

/** LO QUE HAY QUE SABER PARA DIBUJAR UN MUNDO, y nada más. */
export interface Escena {
  readonly v: number
  readonly tick: number
  /** El centro del área visible, y a cuántas celdas llega por eje. */
  readonly foco: Placement
  readonly radio: RadioDeEscena
  /** Ordenadas por fila y después por columna. */
  readonly celdas: readonly CeldaEnEscena[]
  /** Por id, y el `Map` se recorre en orden de id. */
  readonly cuerpos: ReadonlyMap<BodyId, CuerpoEnEscena>
  /** Ordenados por id. */
  readonly actores: readonly ActorEnEscena[]
}

// ─── Armar una escena ───────────────────────────────────────────────────────

/**
 * LA CELDA QUE RIGE EN `at`, en las mismas tres capas que usan las doce leyes:
 * lo que el mundo escribió, lo que el dios decretó, y el aire libre.
 *
 * ─── POR QUÉ ESTO NO REUSA `celdaDe` DE `step.ts`, Y HAY QUE DECIRLO ───────
 *
 * Porque `celdaDe` devuelve la `Celda` de la FÍSICA —`oxygen`, `wet`,
 * `ambiente`, con la oclusión ya mezclada adentro— y una escena necesita las tres
 * guardadas SIN mezclar más `sheltered` aparte, para que el mapa pueda mostrar
 * las dos cosas. Y porque su camino caliente lee `entornoDecretado`, otro arreglo
 * memoizado, con cero asignaciones por cuerpo y por tick: meterle una rama para
 * el renderizador sería pagar en el tick por algo que se mira una vez por cuadro.
 *
 * O sea que son dos lectores de las mismas tres fuentes, y eso es una deuda
 * chica pero real. Se paga con un test que los compara celda por celda
 * (`tests/la-escena.test.ts`, bloque de las capas): si algún día divergen, se
 * pone rojo ahí y no en la pantalla.
 */
function celdaGuardadaEn(s: WorldState, at: Placement): CellState {
  const propia = s.cells.get(keyOfCell(at))
  if (propia !== undefined) return propia
  if (s.dios !== undefined) return celdaDecretada(s.dios, s.phys, at.x, at.y)
  return CELDA_POR_OMISION
}

/**
 * LA ESCENA DE UN MUNDO, centrada en `foco` y con `radio` celdas alrededor.
 *
 * El área es una CAJA y no un círculo porque la distancia del mundo es
 * Chebyshev —tocar algo es estar a 1 en el máximo de las dos coordenadas— y una
 * vista circular mostraría celdas que no se pueden alcanzar y escondería celdas
 * que sí. La forma de lo que se ve tiene que ser la forma de lo que se puede
 * hacer. Cuán ancha y cuán alta es esa caja lo decide quien mira: ver
 * `RadioDeEscena`.
 *
 * ─── UN NÚMERO PELADO SIGUE VALIENDO, Y NO ES POR NO TOCAR LOS TESTS ───────
 *
 * `escenaDe(w, foco, 7)` quiere decir «una caja de 7 para cada lado», o sea el
 * cuadrado de siempre. Se acepta porque para casi todo el que arma una escena
 * —los bancos, los ataques, los criterios— la forma del encuadre no es parte de
 * lo que se está afirmando: piden «un pedazo de mundo alrededor de esto». El
 * único que tiene una opinión sobre la forma es el que dibuja en una pantalla,
 * y ése pasa los dos números.
 *
 * Un cuerpo entra si su celda entra. Un cuerpo EN LA MANO de alguien está en la
 * celda de ese alguien, así que entra o sale con él, que es lo correcto.
 */
export function escenaDe(s: WorldState, foco: Placement, radio: number | RadioDeEscena): Escena {
  const r: RadioDeEscena = typeof radio === 'number' ? { x: radio, y: radio } : radio
  const celdas: CeldaEnEscena[] = []
  // Fila por fila y dentro de cada fila columna por columna: es el orden que la
  // regla 4 promete y del que depende el delta, que compara `celdas[i]` contra
  // `celdas[i]` sin volver a mirar las coordenadas.
  for (let y = foco.y - r.y; y <= foco.y + r.y; y++) {
    for (let x = foco.x - r.x; x <= foco.x + r.x; x++) {
      const at = { x, y }
      const c = celdaGuardadaEn(s, at)
      celdas.push({
        at,
        wet: c.wet,
        oxygen: c.oxygen,
        temperature: c.temperature,
        sheltered: shelteredDe(s, keyOfCell(at)),
      })
    }
  }

  const cuerpos = new Map<BodyId, CuerpoEnEscena>()
  for (const id of [...s.bodies.keys()].sort(comparaTexto)) {
    const b = s.bodies.get(id)
    if (b === undefined) continue
    if (!seVe(b.at, foco, r)) continue
    // Las claves opcionales sólo si hay algo que decir: un `heldBy: undefined`
    // explícito viaja al hash como una clave más. Misma razón que en el descriptor.
    const rel: { heldBy?: ActorId; supportedBy?: BodyId; covering?: BodyId } = {}
    if (b.heldBy !== undefined) rel.heldBy = b.heldBy
    if (b.supportedBy !== undefined) rel.supportedBy = b.supportedBy
    if (b.covering !== undefined) rel.covering = b.covering
    cuerpos.set(id, { d: descriptorDe(b, s.phys, s.desplegados.get(id)), ...rel })
  }

  const actores: ActorEnEscena[] = []
  for (const id of [...s.actors.keys()].sort(comparaTexto)) {
    const a = s.actors.get(id)
    if (a === undefined) continue
    // Las claves opcionales sólo si hay algo que decir, por lo mismo que las
    // relaciones de un cuerpo: con `exactOptionalPropertyTypes` un
    // `haciendo: undefined` explícito no es lo mismo que no tener la clave, y al
    // hash viaja como una clave más.
    const enCurso: { haciendo?: ActividadEnEscena; esperando?: EsperaEnEscena } = {}
    if (a.doing !== undefined) {
      enCurso.haciendo = { proceso: a.doing.process, roles: [...a.doing.roles], segundos: a.doing.segundos }
    }
    if (a.esperando !== undefined) {
      enCurso.esperando = { segundos: a.esperando.segundos, pedido: a.esperando.pedido }
    }
    // El cuerpo se busca en `s.bodies` y no en los `cuerpos` de arriba: ésos son
    // los que ENTRAN EN EL ENCUADRE, y un actor puede estar fuera del radio y
    // seguir siendo un actor de este mundo. Sin cuerpo el aliento es cero, que es
    // lo mismo que dice `qualityOf` de un cuerpo sin `stamina`.
    const suCuerpo = s.bodies.get(a.body)
    const aliento = suCuerpo === undefined ? 0 : Math.trunc(qualityOf(suCuerpo.body, 'stamina', s.phys))
    actores.push({
      id: a.id,
      body: a.body,
      holding: [...a.holding],
      capacity: a.capacity,
      aliento,
      ...enCurso,
    })
  }

  return { v: VERSION_DE_LA_ESCENA, tick: s.tick, foco, radio: r, celdas, cuerpos, actores }
}

function seVe(at: Placement, foco: Placement, radio: RadioDeEscena): boolean {
  return Math.abs(at.x - foco.x) <= radio.x && Math.abs(at.y - foco.y) <= radio.y
}

/** Sin `localeCompare`: el orden no puede depender del idioma del cliente. */
function comparaTexto(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

/**
 * EL HASH DE LO QUE SE VE. La cuarta capa, y la que el E2E del Hito 12 compara.
 *
 * Usa `hashWorld` y no un mezclador propio por lo mismo que `hashWorldState` y
 * `renderDescriptorHash`: dos verdades sobre «lo mismo» obligarían al juez a
 * elegir una.
 */
export function escenaHash(e: Escena): WorldHash {
  return hashWorld(e)
}

// ─── LOS DELTAS: qué cambió entre dos escenas ───────────────────────────────
//
// ─── PARA QUÉ, Y NO ES OPTIMIZACIÓN PREMATURA ──────────────────────────────
//
// El Hito 12B pide que «el mapa se actualiza en tiempo real» y que «las acciones
// y construcciones se ven mientras ocurren», o sea veinte cuadros por segundo. Una
// escena entera son (2·radio.x+1)·(2·radio.y+1) celdas más todos los cuerpos: un
// encuadre de pantalla ancha son varios cientos por cuadro, y casi todas iguales
// a las del cuadro anterior. Mandar
// eso veinte veces por segundo funciona en la máquina de uno y se cae en cuanto
// hay una red en el medio.
//
// ─── LA PROPIEDAD QUE LO HACE CONFIABLE, Y ES UNA SOLA ────────────────────
//
//     aplicarDelta(a, deltaEntre(a, b))  ===  b
//
// Escrita como igualdad de HASH y no campo por campo, porque comparar campo por
// campo se olvida del campo que alguien agregue mañana. Un delta que pierda
// información hace que el cliente se desincronice despacio: no falla, muestra un
// mundo cada vez más viejo, y nadie sabe desde cuándo.

export interface DeltaDeEscena {
  readonly v: number
  readonly de: number
  readonly a: number
  /** Cuerpos que aparecieron o entraron al área visible. */
  readonly entraron: readonly (readonly [BodyId, CuerpoEnEscena])[]
  /** Cuerpos que se fueron o dejaron de existir. Ordenados por id. */
  readonly salieron: readonly BodyId[]
  /** Cuerpos que siguen y cambiaron en algo. */
  readonly cambiaron: readonly (readonly [BodyId, CuerpoEnEscena])[]
  /** Sólo las celdas que cambiaron, en el orden de la escena. */
  readonly celdas: readonly CeldaEnEscena[]
  /**
   * LOS ACTORES, ENTEROS SI ALGUNO CAMBIÓ.
   *
   * Es la única lista que no se manda por diferencias, y es a propósito: son dos
   * o tres, cada uno pesa cuatro campos, y calcular el delta de una lista tan
   * chica cuesta más código que mandarla. `undefined` quiere decir «no cambió
   * ninguno», que es el caso de casi todos los cuadros.
   */
  readonly actores?: readonly ActorEnEscena[]
}

/**
 * QUÉ CAMBIÓ DE `a` A `b`. Las dos escenas tienen que ser del mismo foco y radio.
 *
 * Si no lo son, el delta no se puede calcular —la lista de celdas no es la misma
 * grilla— y devolver algo igual sería devolver basura. Lo dice lanzando, y no
 * con un delta vacío, porque un delta vacío es indistinguible de «no pasó nada».
 */
export function deltaEntre(a: Escena, b: Escena): DeltaDeEscena {
  if (a.foco.x !== b.foco.x || a.foco.y !== b.foco.y || a.radio.x !== b.radio.x || a.radio.y !== b.radio.y) {
    throw new RangeError('no se puede diferenciar dos escenas de distinto encuadre: la grilla no es la misma')
  }
  if (a.v !== b.v) {
    throw new RangeError(`no se puede diferenciar la escena v${String(a.v)} contra la v${String(b.v)}`)
  }

  const entraron: (readonly [BodyId, CuerpoEnEscena])[] = []
  const cambiaron: (readonly [BodyId, CuerpoEnEscena])[] = []
  for (const [id, c] of b.cuerpos) {
    const antes = a.cuerpos.get(id)
    if (antes === undefined) entraron.push([id, c])
    else if (!igual(antes, c)) cambiaron.push([id, c])
  }
  const salieron: BodyId[] = []
  for (const id of a.cuerpos.keys()) if (!b.cuerpos.has(id)) salieron.push(id)

  const celdas: CeldaEnEscena[] = []
  for (let i = 0; i < b.celdas.length; i++) {
    const antes = a.celdas[i]
    const ahora = b.celdas[i]
    if (ahora === undefined) continue
    if (antes === undefined || !igual(antes, ahora)) celdas.push(ahora)
  }

  const base: DeltaDeEscena = { v: b.v, de: a.tick, a: b.tick, entraron, salieron, cambiaron, celdas }
  return igual(a.actores, b.actores) ? base : { ...base, actores: b.actores }
}

/**
 * LA ESCENA `b` RECONSTRUIDA desde `a` y el delta. Es la mitad que se verifica.
 *
 * Existe para que la propiedad se pueda afirmar, y no porque el cliente vaya a
 * llamarla tal cual: un cliente de verdad va a aplicar el delta sobre su propia
 * estructura de dibujo. Pero si esta función no puede reconstruir `b`, ninguna
 * otra va a poder, y el bug se vería como un mapa que se atrasa sin motivo.
 */
export function aplicarDelta(a: Escena, d: DeltaDeEscena): Escena {
  const cuerpos = new Map(a.cuerpos)
  for (const id of d.salieron) cuerpos.delete(id)
  for (const [id, c] of d.entraron) cuerpos.set(id, c)
  for (const [id, c] of d.cambiaron) cuerpos.set(id, c)

  // Reordenar por id: el `Map` heredado trae el orden de `a`, y un cuerpo que
  // entró quedaría al final. Sin esto, dos clientes que llegaron al mismo estado
  // por caminos distintos hashean distinto — que es exactamente lo que el delta
  // no puede hacer.
  const ordenados = new Map<BodyId, CuerpoEnEscena>()
  for (const id of [...cuerpos.keys()].sort(comparaTexto)) {
    const c = cuerpos.get(id)
    if (c !== undefined) ordenados.set(id, c)
  }

  const porClave = new Map<string, CeldaEnEscena>()
  for (const c of d.celdas) porClave.set(`${String(c.at.x)},${String(c.at.y)}`, c)
  const celdas = a.celdas.map((c) => porClave.get(`${String(c.at.x)},${String(c.at.y)}`) ?? c)

  return {
    v: a.v,
    tick: d.a,
    foco: a.foco,
    radio: a.radio,
    celdas,
    cuerpos: ordenados,
    actores: d.actores ?? a.actores,
  }
}

/**
 * Igualdad por el TEXTO CANÓNICO, que es el mismo criterio con el que se hashea.
 *
 * Comparar campo por campo obligaría a acordarse de cada campo nuevo. Comparar
 * por `JSON.stringify` pelado sería frágil por el orden de las claves — pero acá
 * los dos lados los construye ESTE archivo con el mismo orden de escritura, así
 * que el orden es el mismo por construcción. Que eso valga lo sostiene el test de
 * la propiedad: si dejara de valer, `aplicarDelta` no reconstruiría `b`.
 */
function igual(x: unknown, y: unknown): boolean {
  return JSON.stringify(x) === JSON.stringify(y)
}
