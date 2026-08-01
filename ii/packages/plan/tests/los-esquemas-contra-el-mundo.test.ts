// ─── LAS OCHO FILAS, CONTRA EL MUNDO DE VERDAD ───────────────────────────────
//
// `los-esquemas.test.ts` cierra su archivo diciendo que «la verificación PESADA
// de cada fila contra una partida real es de otra fase». Ésta es esa fase, y es
// la que decide si `SCHEMA_INDEX` es conocimiento o es un recetario: cada
// `ConstructionSchema` promete «aplicando ESTE proceso con roles que cumplan
// ESTOS hints, queda establecido ESTE predicado», y una promesa sin una partida
// que la haya cumplido es un paso de más disfrazado de física.
//
// ─── EL CRITERIO, ESCRITO ANTES DE MEDIR ────────────────────────────────────
//
// Para CADA fila de `ESQUEMAS`, sin excepción y sin lista escrita a mano:
//
//   1. se arma un mundo de verdad —`stepWorld`, la física semilla, y el dios
//      cuando hace falta un pozo—;
//   2. se llena cada rol que `roleHints` nombra con un cuerpo que cumpla la
//      CONJUNCIÓN de lo que el proceso le exige y lo que el esquema le pide;
//   3. se emite el mismo `apply` tick a tick hasta que el predicado quede
//      establecido o se acabe el presupuesto;
//   4. se decide si quedó establecido LLAMANDO AL MOTOR —`qualityOf`,
//      `evalQuality`, `cumpleCuerpo`— y nunca transcribiendo una fórmula.
//
// El bucle es `for (const e of ESQUEMAS)` con un `it` por fila: una fila nueva
// que alguien agregue mañana entra sola al barrido y se pone roja sola si no se
// puede armar, si no completa, o si el predicado no queda.
//
// ─── Y LAS FILAS QUE NO SON PROCESOS ────────────────────────────────────────
//
// Desde el tramo H la tabla tiene filas de LEY —cocinar no es un `ProcessId`, lo
// hace la ley 5— y el criterio es EXACTAMENTE el mismo, con dos diferencias que
// salen de qué es una ley y no de una comodidad del banco:
//
//   · el paso 3 no emite ningún `apply`. Se corre `stepWorld` con CERO
//     intenciones, porque las leyes corren solas: si la comida se cocina, no la
//     cocinó nadie;
//   · el paso 2 arma una PILA —`supportedBy` de abajo hacia arriba— en vez de
//     llenar roles del catálogo, y verifica que los tres cuerpos cumplan lo que
//     la fila les pide ANTES de correr, para que la tilde verde no mida al banco.
//
// Y se mide en el PEOR CASO ADMISIBLE: el fuego en el borde de abajo de su
// ventana, la comida corrida para las seis sustancias carnosas del catálogo, y el
// presupuesto igual al `mientras` que la fila declara y ni un tick más.
//
// ─── LO ÚNICO ESCRITO A MANO, Y POR QUÉ NO SE PUEDE DERIVAR ─────────────────
//
// Dos tablas chicas, y las dos fallan RUIDOSAMENTE cuando no alcanzan:
//
//   · `CANDIDATOS` — de qué está hecho el mundo de este banco. No es una tabla
//     de «para este `Where`, este cuerpo»: es una lista de materia, y quien elige
//     es `qualityOf` preguntándole a cada candidato si cumple. Un `Where` nuevo
//     que ninguno satisfaga LANZA con el pedido escrito; no se saltea la fila.
//   · `DEL_MUNDO` — los roles que no se pueden llenar con materia inventada
//     porque el mundo exige que el cuerpo sea OTRA COSA. Hoy tiene una sola
//     entrada, `extraccion.source`, y es exactamente el hueco que el propio
//     esquema documenta: «el mundo rechaza la extracción con motivo `sin-pozo`
//     si el cuerpo no es un banco decretado por el dios», y eso NO se puede decir
//     ENTERO en cualidades —las dos condiciones que la fila sí sabe decir, estar en
//     el agua y no entrar en una mano, son necesarias y no suficientes—. Un rol
//     nuevo que necesite algo así y no esté acá no pasa
//     desapercibido: la fila corre, no establece nada, y sale roja con el conteo
//     de rechazos del mundo al lado.
//
// ─── ERAN DOS LOS HUECOS DE LA SUPERFICIE. QUEDA UNO ────────────────────────
//
// `cumpleCuerpo` contesta las cualidades, y `predicado.ts` documentaba DOS formas
// que no podía contestar. Hoy queda una: `freeStrandEnds` no tiene alias en el
// catálogo y despejarla desde la vista exige `maxParts(sharpness)`, que una
// `BodyView` no puede dar. La otra —el TAG de la forma `sostiene`— se cerró
// leyendo al revés el mismo catálogo que escribe `name`, y abajo se mide sobre EL
// PESCADO QUE ESTA CORRIDA SACÓ DEL RÍO, cruzando las dos fuentes: los tags que
// dice el catálogo de sustancias y los que dice el nombre.
//
// Este archivo NO arregla nada —no toca `src/`— pero tampoco tapa: la fila que
// todavía cae en el hueco se verifica por el camino que sí llega (el despeje de
// `catch`), la columna `vista` de la tabla dice qué contestó `cumpleCuerpo`, y el
// `it.fails` que queda mide el hueco sobre la caña que ató esta corrida. Un hueco
// medido sobre un cuerpo de laboratorio se puede discutir; medido sobre la caña
// que pescó, no.

import { describe, expect, it, beforeAll } from 'vitest'

import {
  baseRoleName,
  buildSeedPhysics,
  estaEnVentanaDeCoccion,
  evalQuality,
  isDerived,
  nameOf,
  qualityOf,
  tagsDe as tagsDelMotor,
  specOf,
  temperaturaDeEquilibrio,
  unir,
  HZ_DE_REFERENCIA,
  SUSTANCIAS_SEMILLA,
  T_AMBIENTE,
  type Body,
  type ExprContext,
  type Physics,
  type Process,
  type QualityId,
} from '@anima/physics'
import {
  apply,
  celdaDecretada,
  crearDios,
  decretoDe,
  idDePozo,
  mapaDeActores,
  mapaDeCuerpos,
  stepWorld,
  take,
  type CellKey,
  type CellState,
  type EstadoDelDios,
  type Placement,
  type RoleBinding,
  type WorldBody,
  type WorldState,
} from '@anima/world'
import type { BodyView } from '@anima/skills'

import {
  AGUA_FRANCA,
  COMBUSTIBLES_DE_FROTAR,
  ESQUEMAS,
  GEOMETRIAS_DE_LA_COCCION,
  GEOMETRIAS_DESCARTADAS,
  MASA_QUE_NO_ENTRA_EN_LA_MANO,
  NO_ENTRA_EN_LA_MANO,
  PISO_DE_PORTABLE,
  SEGUNDOS_DE_COCCION,
  VENTANA_CARNOSA,
  YESCAS_DE_COCINA,
  YESCAS_IMPOSIBLES,
  claveDeVia,
  procesoDe,
} from '../src/esquemas.js'
import { cumpleCuerpo, interpretar } from '../src/predicado.js'
import type { ConstructionSchema, EsquemaDeLey, EsquemaDeProceso, Predicado } from '../src/tipos.js'

/**
 * LA ÚNICA YESCA DE COCINA QUE LA TABLA GENERA, y el test la exige en singular.
 *
 * Si mañana hubiera dos, este `throw` lo dice en vez de que el banco se quede
 * midiendo la primera y callando la otra. Que sea UNA es el resultado del tramo:
 * de las tres ventanas de cocción, sólo la del contacto entra en el tanque de
 * aliento — las otras dos están en `YESCAS_IMPOSIBLES` con su porqué.
 */
const YESCA_DE_COCINA = (() => {
  const y = YESCAS_DE_COCINA[0]
  if (y === undefined || YESCAS_DE_COCINA.length !== 1) {
    throw new Error(`el banco esperaba UNA yesca de cocina y hay ${String(YESCAS_DE_COCINA.length)}`)
  }
  return y
})()

// ─── El banco ────────────────────────────────────────────────────────────────

const PHYS: Physics = buildSeedPhysics()
const ANA = 'ana'
/** La misma semilla que `world/tests/hito-5-la-pesca.test.ts`: el mismo río. */
const SEMILLA = 20260727n

/**
 * Un test sobre una cualidad, en la forma más floja que sirve para LEER.
 *
 * `Role.where` de la física lo trae con campos mutables y `Where` de
 * `@anima/skills` con campos `readonly`, y los dos hay que recorrerlos en el
 * mismo bucle. Declarar el alias acá evita el `as` que taparía el día que las dos
 * formas dejen de coincidir.
 */
interface Test {
  readonly q: QualityId
  readonly op: '>=' | '<=' | '>' | '<'
  readonly v: number
}

/**
 * El operador, y NADA MÁS que el operador.
 *
 * No es una fórmula del motor reimplementada —la regla del adversario de las
 * secuencias de emergencia es sobre las fórmulas, y `>=` no es una—: todos los
 * VALORES que entran acá salieron de `qualityOf` o de `evalQuality`.
 */
function compara(a: number, op: Test['op'], v: number): boolean {
  switch (op) {
    case '>=':
      return a >= v
    case '<=':
      return a <= v
    case '>':
      return a > v
    case '<':
      return a < v
  }
}

const num = (v: number): string => v.toFixed(4).replace('.', ',')
const texto = (t: Test): string => `${t.q}${t.op}${String(t.v)}`
const clave = (e: ConstructionSchema): string => `${claveDeVia(e)}:${e.establishes}`

// ─── El mundo, armado acá y no importado del `tests/` de otro paquete ───────
//
// Los `tests/` no se exportan, así que compartirlos exigiría mover el arnés a
// `src/`. Es la misma copia deliberada que hizo `perceive/tests/mundo.ts` de
// `world/tests/mundo-minimo.ts`, y lo que se copia es el ARMADO: ni una regla del
// mundo, ni un número de la física.

function cuerpoDe(
  id: string,
  substance: string,
  mass: number,
  form: Body['form'],
): Body {
  // Nace a temperatura ambiente y no a cero. Un cuerpo sin `temperature` escrita
  // arranca en 0 °C y el primer tick se le va en llegar a los 15 del ambiente:
  // sobre la fila de `friccion` eso corre el hito y mide el frío inicial en vez
  // de la tasa del proceso. Medido en `world/tests/el-fuego.test.ts`.
  return { id, form, parts: [{ substance, mass, q: {} }], joints: [], state: { temperature: T_AMBIENTE } }
}

/**
 * La criatura: materia como cualquier otra cosa, con `stamina` escrita.
 *
 * `form: 'bloque'` porque `FormId` es un catálogo cerrado de seis formas y no hay
 * una para un cuerpo vivo. `stamina` va en `state` porque no es una propiedad de
 * la carne: es una cuenta que el cuerpo lleva.
 */
function criatura(id: string, stamina: number): Body {
  return {
    id: `${id}-cuerpo`,
    form: 'bloque',
    parts: [{ substance: 'carne', mass: 2, q: {} }],
    joints: [],
    state: { stamina, temperature: T_AMBIENTE },
  }
}

// ─── LA PRIMERA TABLA A MANO: de qué está hecho este banco ──────────────────

interface Candidato {
  readonly nombre: string
  readonly body: Body
  /** La criatura no se copia: se liga por el id de su propio cuerpo. */
  readonly esElla: boolean
}

/**
 * Los cinco candidatos, EN ORDEN, y el primero que cumple gana.
 *
 * El orden es la única regla de desempate y es total, así que dos corridas eligen
 * lo mismo. No es una tabla «`Where` → cuerpo»: nadie escribió qué llena qué. Lo
 * que se escribió es de qué está hecho el mundo, y quién llena cada rol lo decide
 * `qualityOf` contra el pedido — que es la única forma de que la fila de
 * `friccion` elija sola la vara liviana y ninguna otra.
 *
 * La caña está armada con `unir` del motor y no a mano, y va cuarta a propósito:
 * es lo único que llena el rol `gear` de `extraccion` —`reach >= 2 ∧ catch > 0`—
 * y es, exactamente, el producto del esquema puente de `catch>0`. O sea que la
 * fila que pesca se apoya en la fila que ata, y eso está medido aparte abajo.
 *
 * La criatura va última: es la única con `stamina`, así que los roles `actor` la
 * encuentran igual, y estando última no le gana ningún rol con `Where` vacío a la
 * materia inerte.
 */
const CANDIDATOS: readonly Candidato[] = (() => {
  const vara = cuerpoDe('molde-vara', 'madera', 1, 'vara')
  const liviana = cuerpoDe('molde-liviana', 'madera', 0.2, 'vara')
  // La yesca DE COCINA: la masa sale del punto medio de la banda que la fila de
  // `emitsPower` acotado despeja, y no de un número lindo. Va TERCERA, después de la
  // liviana, para que no le robe ningún rol a las filas viejas: todo lo que pedía
  // «algo liviano y rígido» sigue quedándose con la de 0,2 kg, que es la primera que
  // cumple. Sólo la fila nueva, que pide la masa por las dos puntas, llega hasta acá.
  const media = (YESCA_DE_COCINA.masaMin + YESCA_DE_COCINA.masaMax) / 2
  const yesca = cuerpoDe('molde-yesca-de-cocina', 'madera', media, 'vara')
  const hebra = cuerpoDe('molde-hebra', 'liana', 0.2, 'hebra')
  const cana = unir(vara, undefined, hebra, PHYS, 'molde-cana')
  if (cana === undefined) throw new Error('el banco no pudo atar la caña: `unir` cambió de forma')
  return [
    { nombre: 'vara de madera de 1 kg', body: vara, esElla: false },
    { nombre: 'vara de madera de 0,2 kg', body: liviana, esElla: false },
    { nombre: `vara de madera de ${num(media)} kg (la yesca de cocina)`, body: yesca, esElla: false },
    { nombre: 'hebra de liana de 0,2 kg', body: hebra, esElla: false },
    { nombre: 'la caña (vara + hebra, sin `b`)', body: cana, esElla: false },
    { nombre: 'ella misma', body: criatura('molde', 1000), esElla: true },
  ]
})()

/**
 * El candidato que cumple el pedido entero, o una excepción con el pedido escrito.
 *
 * LANZA y no devuelve `undefined`, y ésa es la mitad del contrato de este archivo:
 * un `Where` que ninguna materia de acá satisface no puede convertirse en una fila
 * salteada en silencio. El día que un esquema pida algo que este banco no tiene,
 * el mensaje dice qué pedía y quién lo pedía.
 */
function elegir(where: readonly Test[], quien: string): Candidato {
  for (const c of CANDIDATOS) {
    if (where.every((t) => compara(qualityOf(c.body, t.q, PHYS), t.op, t.v))) return c
  }
  throw new Error(
    `el banco no tiene con qué llenar ${quien}: nadie cumple ${where.map(texto).join(' ∧ ')}. ` +
      `Agregá un candidato a CANDIDATOS —y no un caso especial— o el esquema pide algo que el mundo no da.`,
  )
}

// ─── LA SEGUNDA TABLA A MANO: lo que un `Where` no sabe decir ───────────────

/**
 * Roles cuyo cuerpo lo pone el MUNDO y no la materia de `CANDIDATOS`.
 *
 * Una sola entrada, y no es una comodidad del test: `extraccion.source` pide
 * `mass > 0` y con eso alcanza para que cualquier vara CALIFIQUE —lo dice el
 * encabezado de `NodoAbierto` en `tipos.ts`, que por eso lleva `gastados`— pero el
 * mundo la rechaza con motivo `sin-pozo` si el cuerpo no es un banco decretado por
 * el dios. Eso es conocimiento sobre el mundo que `Where` no puede expresar,
 * porque `Where` sólo sabe de cualidades.
 *
 * Su ausencia para un rol nuevo NO es un salteo silencioso: la fila se arma con
 * materia, corre, no establece nada, y la tabla la muestra en rojo con el conteo
 * de rechazos que el mundo devolvió.
 */
const DEL_MUNDO: Readonly<Record<string, string>> = {
  'extraccion:source': 'el pozo que decretó el dios',
}

// ─── La orilla, buscada en la semilla y no inventada ────────────────────────

interface Orilla {
  readonly dios: EstadoDelDios
  readonly cx: number
  readonly cy: number
  readonly pozo: Placement
  /** Una celda SECA pegada al pozo: desde acá se pesca. */
  readonly parada: Placement
}

/**
 * Barre chunks en orden canónico hasta encontrar uno con pozo y una celda seca
 * pegada. Es el mismo barrido que `world/tests/hito-5-la-pesca.test.ts`, y por la
 * misma razón: el 88,8% de los chunks de `agua-dulce` está enteramente inundado,
 * así que la orilla hay que buscarla.
 */
function buscarOrilla(): Orilla {
  const dios = crearDios(SEMILLA)
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      const dec = decretoDe(dios, PHYS, cx, cy)
      if (dec.pozo === undefined) continue
      const p = dec.pozo.at
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const parada = { x: p.x + dx, y: p.y + dy }
        const vecino = decretoDe(dios, PHYS, Math.floor(parada.x / 16), Math.floor(parada.y / 16))
        const i = (((parada.y % 16) + 16) % 16) * 16 + (((parada.x % 16) + 16) % 16)
        if ((vecino.celdas[i] as { wet: number }).wet < 0.9) return { dios, cx, cy, pozo: p, parada }
      }
    }
  }
  throw new Error('la semilla no tiene una sola orilla en 13×13 chunks')
}

let orillaMemo: Orilla | undefined
function orilla(): Orilla {
  orillaMemo ??= buscarOrilla()
  return orillaMemo
}

// ─── El montaje de una fila ─────────────────────────────────────────────────

interface Puesta {
  readonly w: WorldState
  readonly roles: readonly RoleBinding[]
  /** Qué llenó cada rol, para la tabla. */
  readonly reparto: string
}

/** Lo que un rol tiene que cumplir: lo del proceso Y lo del esquema, al mismo cuerpo. */
function pedido(p: Process, rol: string, e: ConstructionSchema): readonly Test[] {
  const delProceso = p.roles.find((r) => baseRoleName(r.name) === rol)?.where ?? []
  return [...delProceso, ...(e.roleHints[rol] ?? [])]
}

/**
 * El mundo de una fila.
 *
 * Se llenan EXACTAMENTE los roles que `roleHints` nombra y ninguno más, que es la
 * convención que `esquemas.ts` declara en su encabezado y de la que depende la
 * caña entera: con el rol opcional `b` lleno, el atador se gasta en la atadura y
 * `catch` da cero. El recorrido es por `p.roles` —el orden del catálogo— y no por
 * `Object.keys(roleHints)`, para que dos corridas armen los roles igual.
 */
function montar(e: EsquemaDeProceso): Puesta {
  const p = procesoDe(e.via)
  const conPozo = p.roles.some((r) => DEL_MUNDO[`${e.via}:${baseRoleName(r.name)}`] !== undefined)
  const o = conPozo ? orilla() : undefined
  const at: Placement = o?.parada ?? { x: 0, y: 0 }

  const cuerpos: WorldBody[] = [{ body: criatura(ANA, 1000), at }]
  const roles: RoleBinding[] = []
  const enMano: string[] = []
  const reparto: string[] = []

  for (const r of p.roles) {
    const rol = baseRoleName(r.name)
    if (e.roleHints[rol] === undefined) continue
    const delMundo = DEL_MUNDO[`${e.via}:${rol}`]
    if (delMundo !== undefined) {
      if (o === undefined) throw new Error(`${clave(e)}: ${rol} necesita el mundo y no hay orilla`)
      roles.push({ name: rol, body: idDePozo(o.cx, o.cy) })
      reparto.push(`${rol}=${delMundo}`)
      continue
    }
    const c = elegir(pedido(p, rol, e), `${e.via}.${rol}`)
    if (c.esElla) {
      roles.push({ name: rol, body: `${ANA}-cuerpo` })
      reparto.push(`${rol}=${c.nombre}`)
      continue
    }
    cuerpos.push({ body: { ...c.body, id: rol }, at, heldBy: ANA })
    enMano.push(rol)
    roles.push({ name: rol, body: rol })
    reparto.push(`${rol}=${c.nombre}`)
  }

  const base: WorldState = {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos(cuerpos),
    actors: mapaDeActores([
      { id: ANA, body: `${ANA}-cuerpo`, holding: enMano, capacity: 6, permits: 'irreversible' },
    ]),
    cells: new Map<CellKey, CellState>(),
    desplegados: new Map(),
    nextId: 1,
  }
  return {
    w: o === undefined ? base : { ...base, dios: o.dios },
    roles,
    reparto: reparto.join(' · '),
  }
}

// ─── Dónde queda establecido lo que el esquema promete ──────────────────────

type Destino = { readonly k: 'nacido' } | { readonly k: 'mano' } | { readonly k: 'rol'; readonly rol: string }

/**
 * Sobre QUÉ hay que mirar el predicado, leído del catálogo y no de una tabla.
 *
 * Las tres respuestas salen de lo que el proceso declara y no de su nombre:
 *
 *   · un `join` o un `split` fabrican un cuerpo NUEVO —la caña no es la vara y la
 *     hebra no es el leño—, así que lo establecido queda sobre lo que nació;
 *   · un `drawFromStock` con `into: 'hands'` no habla de un cuerpo sino de la
 *     mano, que es justo la forma `sostiene` del predicado;
 *   · un proceso SIN `completion` no rinde nada, y lo que establece queda sobre el
 *     cuerpo que su `drive` empuja — el rol `on`. Por eso `friccion` no lleva
 *     `rinde` en `Step` y quien quiera nombrar la yesca encendida nombra la yesca.
 *
 * Lanza ante una cuarta forma: un proceso nuevo cuyo rendimiento nadie mapeó no
 * puede pasar como fila verificada.
 */
function dondeQueda(p: Process): Destino {
  for (const y of p.completion?.yields ?? []) {
    if (y.k === 'join' || y.k === 'split') return { k: 'nacido' }
    if (y.k === 'drawFromStock') return y.into === 'hands' ? { k: 'mano' } : { k: 'nacido' }
  }
  for (const ef of p.effects) if (ef.k === 'drive') return { k: 'rol', rol: baseRoleName(ef.on) }
  throw new Error(`no sé sobre qué queda lo que establece «${p.id}»: ni rinde nada ni empuja nada`)
}

// ─── La vista, para poder llamar a `cumpleCuerpo` ───────────────────────────

/**
 * Un `BodyView` armado sobre un cuerpo del mundo.
 *
 * Es la superficie de verdad y no un atajo: `cumpleCuerpo` recibe esto y un
 * lector, y el lector le pregunta al MOTOR por el cuerpo real. O sea que lo que se
 * está midiendo es exactamente lo que una habilidad vería.
 */
function vistaDe(c: WorldBody, w: WorldState): BodyView {
  return {
    id: c.body.id,
    at: c.at,
    name: nameOf(c.body, w.phys),
    // Igual que `perceive/src/vista.ts`: la Physics VIVA, no el catalogo de la semilla.
    tags: tagsDelMotor(c.body, w.phys),
    madeByMe: c.body.madeBy === ANA,
    joints: c.body.joints.map((j) => ({ a: j.a, b: j.b, strength: j.strength })),
  }
}

function lectorDe(w: WorldState): (b: BodyView, q: QualityId) => number {
  return (b, q) => {
    const c = w.bodies.get(b.id)
    if (c === undefined) throw new Error(`el test preguntó por un cuerpo que el mundo no tiene: ${b.id}`)
    return qualityOf(c.body, q, w.phys)
  }
}

// ─── `freeStrandEnds` de un cuerpo real, sin escribir la fórmula ────────────

/**
 * EL PROBLEMA: `geomOf` es privada de `physics/src/body.ts` y ninguna cualidad del
 * catálogo es su alias, así que desde afuera del motor no hay forma directa de
 * preguntar cuántas puntas libres tiene un cuerpo. Es el mismo hueco que
 * `predicado.ts` documenta y por el que `cumpleCuerpo` contesta `false`.
 *
 * LA SALIDA HONESTA, y no es transcribir la fórmula: `catch` SÍ es una cualidad
 * del catálogo, y su expresión derivada —que se LEE con `specOf`, no se copia— es
 * un producto cuyo factor izquierdo es `geom(freeStrandEnds)`. Se verifica esa
 * FORMA antes de invertirla (si el catálogo cambiara, esto lanza en vez de
 * devolver un número equivocado), se evalúa el factor derecho con `evalQuality`
 * del motor, y se despeja dividiendo el `catch` que devuelve `qualityOf`.
 *
 * El único trozo de contexto que hace falta es `maxParts`, y tampoco se calcula a
 * mano: el valor de cada parte se lo pregunta a `qualityOf` sobre un cuerpo de UNA
 * sola parte, que es el camino por el que el propio motor contesta una intensiva
 * sin promediar. El máximo es un máximo, no una ley.
 */
function puntasLibres(b: Body, phys: Physics): number {
  const e = specOf('catch').derived
  if (
    e === undefined ||
    e.k !== 'op' ||
    e.f !== '*' ||
    e.a.k !== 'geom' ||
    e.a.f !== 'freeStrandEnds'
  ) {
    throw new Error('`catch` dejó de ser `geom(freeStrandEnds) × algo`: el despeje ya no vale')
  }
  const factor = evalQuality(e.b, contextoDe(b, phys))
  if (!(factor > 0)) throw new Error(`el factor de \`catch\` dio ${String(factor)}: no se puede despejar`)
  const enganche = qualityOf(b, 'catch', phys)
  const techo = specOf('catch').range[1]
  if (enganche >= techo) throw new Error('`catch` llegó a su tope: el despeje mediría el recorte')
  return enganche / factor
}

function contextoDe(b: Body, phys: Physics): ExprContext {
  const noHay = (que: string): never => {
    throw new RangeError(`este banco no sabe contestar ${que} sin reimplementar el motor`)
  }
  return {
    own: (q) => qualityOf(b, q, phys),
    maxParts: (q) => {
      // Una derivada por parte no se puede preguntar así: `qualityOf` de un cuerpo
      // de una parte la EVALUARÍA sobre ese cuerpo recortado, que es otra cosa que
      // el `partQuality` del motor. Que lance es la respuesta correcta.
      if (isDerived(q)) noHay(`maxParts(${q}) sobre una cualidad derivada`)
      let mejor = 0
      for (let i = 0; i < b.parts.length; i++) {
        const p = b.parts[i]
        if (p === undefined) continue
        const solo: Body = { id: `${b.id}#${String(i)}`, form: b.form, parts: [p], joints: [], state: {} }
        const v = qualityOf(solo, q, phys)
        if (i === 0 || v > mejor) mejor = v
      }
      return mejor
    },
    sumParts: () => noHay('sumParts'),
    geom: () => noHay('geom'),
    substance: () => noHay('substance'),
  }
}

/** Los tags de la sustancia de un cuerpo, preguntados al catálogo. */
function tagsDe(b: Body, phys: Physics): readonly string[] {
  const out: string[] = []
  for (const p of b.parts) {
    for (const t of phys.substances.get(p.substance)?.tags ?? []) if (!out.includes(t)) out.push(t)
  }
  return out
}

// ─── La medición ────────────────────────────────────────────────────────────

interface Medicion {
  readonly ok: boolean
  /** Sobre qué cuerpo (o «la mano») quedó, o no. */
  readonly sobre: string
  /**
   * El número, pelado. `NaN` cuando la forma del predicado no tiene uno —`sostiene`
   * pregunta por un tag y no por una cantidad— y sirve para una sola cosa: seguir
   * el máximo a lo largo de la corrida. Un valor FINAL puede mentir sobre lo que
   * pasó, y está medido acá abajo: la fricción sobre un leño llega a más de 200 °C
   * y termina en 15, porque la criatura se muere y la ley 1 relaja la madera hacia
   * el ambiente. Sin el pico, el control negativo diría «no subió» en vez de «subió
   * y no alcanzó», que es otra cosa.
   */
  readonly valor: number
  /** El valor medido, con su nombre. */
  readonly medido: string
  /** Contra qué umbral. */
  readonly umbral: string
  /** Con qué se decidió: `cumpleCuerpo` o el camino que sí llega. */
  readonly como: string
  /** Qué contestó `cumpleCuerpo`, aunque no sea quien decide. Ver los dos huecos. */
  readonly vista: boolean
}

const NADA: Medicion = {
  ok: false,
  sobre: '—',
  valor: Number.NaN,
  medido: 'todavía no hay sobre qué mirar',
  umbral: '—',
  como: '—',
  vista: false,
}

/**
 * LAS CLÁUSULAS de lo que una fila promete, y son varias desde este tramo.
 *
 * `interpretar` contesta UNA —`Predicado` no tiene forma conjuntiva— y la fila que
 * promete un fuego acotado por las dos puntas escribe `emitsPower>=105,42 &
 * emitsPower<170,83`, que son dos. Se parte por `&` igual que `firmaDe` y se
 * verifican TODAS: quedarse con la primera mediría media promesa, y la mitad que se
 * caería es justo la del techo — la que separa cocinar de quemar.
 */
function interpretados(e: ConstructionSchema): readonly Predicado[] {
  const out: Predicado[] = []
  for (const trozo of e.establishes.split('&')) {
    if (trozo.length === 0) continue
    const p = interpretar(trozo)
    if (p === undefined) throw new Error(`«${trozo}» no se interpreta: la fila «${e.establishes}» no se puede verificar`)
    out.push(p)
  }
  const primero = out[0]
  if (primero === undefined) throw new Error(`«${e.establishes}» no tiene ninguna cláusula que verificar`)
  return out
}

function interpretado(e: ConstructionSchema): Predicado {
  const cl = interpretados(e)
  const p = cl[0]
  if (p === undefined) throw new Error(`«${e.establishes}» no se interpreta: la fila no se puede verificar`)
  return p
}

function medir(
  e: EsquemaDeProceso,
  w: WorldState,
  nacidos: readonly string[],
  roles: readonly RoleBinding[],
): Medicion {
  const pred = interpretado(e)
  const destino = dondeQueda(procesoDe(e.via))
  const lector = lectorDe(w)

  if (pred.k === 'sostiene') {
    const ana = w.actors.get(ANA)
    const enMano = (ana?.holding ?? []).map((id) => w.bodies.get(id)).filter((c) => c !== undefined)
    // QUIÉN DECIDE Y QUIÉN OPINA, y no cambia porque el hueco se haya cerrado: lo
    // que decide es el CATÁLOGO DE SUSTANCIAS, que es donde viven los tags, y lo
    // que `cumpleCuerpo` contesta va a la columna `vista` como segunda fuente. Que
    // las dos coincidan es una medición; que la fila se verifique con la que no
    // depende de `src/` es lo que hace que este archivo pueda medir a `src/`.
    const vista = enMano.some((c) => cumpleCuerpo(pred, vistaDe(c, w), lector))
    const conTag = enMano.filter((c) => tagsDe(c.body, w.phys).includes(pred.tag))
    const primero = conTag[0]
    return {
      ok: conTag.length > 0,
      sobre: 'la mano',
      valor: Number.NaN,
      medido:
        primero === undefined
          ? `en la mano: ${enMano.map((c) => c.body.parts[0]?.substance ?? '?').join(', ') || 'nada'}`
          : `${primero.body.id} es de ${primero.body.parts[0]?.substance ?? '?'}, tags [${tagsDe(primero.body, w.phys).join(', ')}]`,
      umbral: `algún cuerpo en la mano con tag «${pred.tag}»`,
      como: 'tags del catálogo de sustancias (la fuente que no depende de `src/`)',
      vista,
    }
  }

  // Las otras dos formas hablan de UN cuerpo. Cuál, lo dice el catálogo.
  const id =
    destino.k === 'nacido'
      ? nacidos[nacidos.length - 1]
      : destino.k === 'rol'
        ? roles.find((r) => r.name === destino.rol)?.body
        : undefined
  const c = id === undefined ? undefined : w.bodies.get(id)
  if (c === undefined) return NADA

  if (pred.k === 'cualidad') {
    // TODAS las cláusulas de cualidad, y no sólo la primera: la fila del fuego
    // acotado promete dos —el piso y el techo— y medir una sola diría «cocina» de un
    // fuego que quema. El `valor` que se sigue a lo largo de la corrida es el de la
    // primera, que es la que tiene el pico interesante.
    const cualidades = interpretados(e).filter((p): p is Extract<Predicado, { k: 'cualidad' }> => p.k === 'cualidad')
    const v = qualityOf(c.body, pred.test.q, w.phys)
    const ok = cualidades.every((p) => cumpleCuerpo(p, vistaDe(c, w), lector))
    return {
      ok,
      sobre: c.body.id,
      valor: v,
      medido: cualidades.map((p) => `${p.test.q}=${num(qualityOf(c.body, p.test.q, w.phys))}`).join(' · '),
      umbral: cualidades.map((p) => `${p.test.op} ${String(p.test.v)}`).join(' ∧ '),
      como: '`cumpleCuerpo` (que entra por `qualityOf`)',
      vista: ok,
    }
  }

  // EL PRIMER HUECO: `cumpleCuerpo` devuelve `false` para toda `GeomFn` sin alias
  // en el catálogo, y `freeStrandEnds` es la única que no lo tiene. Se mide igual
  // —despejando de `catch`, con la expresión leída del catálogo— y la columna
  // `vista` deja escrito qué contestó la superficie.
  const puntas = puntasLibres(c.body, w.phys)
  const vista = cumpleCuerpo(pred, vistaDe(c, w), lector)
  return {
    ok: compara(puntas, pred.op, pred.v),
    sobre: c.body.id,
    valor: puntas,
    medido: `${pred.f}=${num(puntas)}`,
    umbral: `${pred.op} ${String(pred.v)}`,
    como: 'despeje de `catch` con la expresión del catálogo (`cumpleCuerpo` no puede: el hueco)',
    vista,
  }
}

// ─── La corrida ─────────────────────────────────────────────────────────────

interface Resultado {
  readonly e: ConstructionSchema
  readonly reparto: string
  readonly ticks: number
  readonly segundos: number
  readonly medicion: Medicion
  /** El mayor valor que el predicado llegó a tener. Ver `Medicion.valor`. */
  readonly pico: number
  readonly nacidos: readonly string[]
  readonly rechazos: string
  readonly w?: WorldState
  readonly error?: string
}

/**
 * El presupuesto de ticks de una fila.
 *
 * Sale de lo que la propia fila dice que tarda, por cuatro y con piso — salvo la
 * que saca de un stock, que es la única PROBABILÍSTICA del catálogo: `extraccion`
 * completa cada 1,5 s y el dado decide si picó. Ahí el presupuesto no lo puede
 * poner `segundos`, y son 300 segundos de mundo, que es lo que la pesca del Hito 5
 * necesitó para sacar piezas con una caña pelada.
 */
function tope(e: ConstructionSchema): number {
  // Una ley no completa ni sortea: lo que promete lo promete EN `mientras`
  // segundos, así que el presupuesto es exactamente ése. Darle más sería medir otra
  // afirmación que la que la fila hace.
  if (e.k === 'ley') return Math.ceil(e.mientras * HZ_DE_REFERENCIA)
  if (e.k === 'obra') throw new Error(SIN_OBRAS)
  const p = procesoDe(e.via)
  const sortea = (p.completion?.yields ?? []).some((y) => y.k === 'drawFromStock')
  return sortea ? 6000 : Math.ceil(e.segundos * HZ_DE_REFERENCIA) * 4 + 60
}

// ─── LA FILA QUE NO ES UN PROCESO: SE ARMA LA PILA Y SE ESPERA ──────────────
//
// Mismo criterio que las de proceso, y ni un renglón más flojo: se pone el mundo
// EXACTAMENTE en la situación que la fila declara, se corre, y se decide con el
// motor. Lo que cambia es que no hay `apply` que emitir —las leyes corren solas,
// que es el punto entero del ADR II-0001— así que la corrida es `stepWorld` con
// CERO intenciones. Si la comida se cocina, no la cocinó nadie.
//
// ─── LAS TRES COSAS QUE SE MIDEN EN EL PEOR CASO ADMISIBLE Y NO EN UNO CÓMODO ─
//
//   · el fuego va en el BORDE DE ABAJO de la ventana de potencia que la fila
//     declara. Con uno más grande la cocción es más rápida y la fila parecería
//     mejor de lo que promete;
//   · la comida se corre PARA CADA SUSTANCIA CARNOSA del catálogo y se reporta la
//     que más tarda. Elegir una sería elegir la cómoda;
//   · el presupuesto es `mientras` y nada más.
//
// Y la mitad que la ley no hace: la fila promete algo SOBRE LA MANO, y la ley deja
// la comida arriba de la parrilla. Así que al final se emite un `take` —una
// intención del mundo, no un atajo del test— y recién ahí se mira la mano.

/**
 * La masa de leña que emite EXACTAMENTE la potencia pedida, despejada y no
 * tanteada: `emitsPower` es extensiva y lineal en la masa, así que se mide sobre
 * un kilo ardiendo y se escala. Nadie escribe el 16,7 del catálogo.
 */
function lenaQueEmite(potencia: number): number {
  const uno: Body = {
    ...cuerpoDe('patron', 'madera', 1, 'vara'),
    state: { temperature: IGNICION_DE_PRUEBA },
  }
  const porKilo = qualityOf(uno, 'emitsPower', PHYS)
  if (!(porKilo > 0)) throw new Error('un kilo de madera a 400 °C dejó de emitir: el despeje no vale')
  return potencia / porKilo
}

/** A qué temperatura se enciende el banco su fuego. 400 es lo que `friccion` promete. */
const IGNICION_DE_PRUEBA = 400

/** Las sustancias del tag que la ley 5 cocina, leídas del catálogo. */
function sustanciasDelTag(tag: string): readonly string[] {
  const out: string[] = []
  for (const s of SUSTANCIAS_SEMILLA) {
    if (!s.tags.includes(tag as never) || !s.tags.includes('organico')) continue
    if (s.perUnitMass.denaturesAt === undefined) continue
    out.push(s.id)
  }
  return out
}

/**
 * La masa de la comida. Dos kilos y no cien gramos: `heatCapacity` es extensiva y
 * la ley 1 divide por ella, así que una pieza grande tarda más en llegar al
 * equilibrio. Es el lado exigente, y sigue entrando en la mano (`portable` topa en
 * 8 kg).
 */
const MASA_DE_LA_COMIDA = 2

interface PuestaDeLey {
  readonly w: WorldState
  readonly sujeto: string
  readonly reparto: string
  readonly potencia: number
}

/**
 * EL BORDE DE ABAJO DE LA VENTANA QUE **ESTA** FILA DECLARA, leído de su `roleHint`
 * y no de una constante del módulo.
 *
 * Desde que hay una fila por geometría, «el peor fuego admisible» es distinto para
 * cada una —1054 en el piso, 253 en la parrilla, 105 en contacto— y leer una sola
 * constante mediría una fila con la exigencia de otra. Que salga del `roleHint` es,
 * además, lo que hace que el banco no pueda montar una situación que la fila no
 * declara: el mismo número que el planificador va a pedir es el que se enciende.
 */
function potenciaDelBordeDeAbajo(e: EsquemaDeLey): number {
  for (const t of e.roleHints['fuego'] ?? []) if (t.op === '>=' || t.op === '>') return t.v
  throw new Error(`la fila «${claveDeVia(e)}» no le pone piso a la potencia del fuego: no hay peor caso que montar`)
}

/**
 * El mundo de una fila de ley: la pila que la fila declara, armada de abajo hacia
 * arriba con `supportedBy`, que es la misma lectura que hace `montajeDe`.
 *
 * El sujeto TIENE que estar en la pila —`emitirLey` rechaza la fila que lo deje
 * afuera, porque `poner` sólo sabe apoyar— y acá se verifica antes de montar: una
 * fila que el planificador no podría emitir no se puede verificar armándola a mano,
 * porque estaría midiendo una situación que ningún plan va a producir.
 */
function montarLey(e: EsquemaDeLey, sustancia: string): PuestaDeLey {
  const at: Placement = { x: 0, y: 0 }
  const potencia = potenciaDelBordeDeAbajo(e)
  const masaDeLena = lenaQueEmite(potencia)
  const fuego: Body = {
    ...cuerpoDe(e.pila[0] ?? 'fuego', 'madera', masaDeLena, 'vara'),
    state: { temperature: IGNICION_DE_PRUEBA },
  }
  // Un cuerpo por rol, y el rol dice de qué está hecho: el sujeto es la comida y
  // todo lo que la fila apile en el medio es una piedra —que es lo único del
  // catálogo que aguanta el contacto—. Nada de esto elige la geometría: la
  // geometría la eligió la fila y acá se la copia.
  const cuerpos: WorldBody[] = [{ body: criatura(ANA, 1000), at }, { body: fuego, at }]
  const materia = new Map<string, Body>([[e.pila[0] ?? 'fuego', fuego]])
  for (let i = 1; i < e.pila.length; i++) {
    const rol = e.pila[i]
    const debajo = e.pila[i - 1]
    if (rol === undefined || debajo === undefined) continue
    const body =
      rol === e.sujeto
        ? cuerpoDe(rol, sustancia, MASA_DE_LA_COMIDA, 'bloque')
        : cuerpoDe(rol, 'piedra', 0.5, 'bloque')
    materia.set(rol, body)
    cuerpos.push({ body, at, supportedBy: debajo })
  }
  if (!e.pila.includes(e.sujeto)) {
    throw new Error(
      `la fila «${claveDeVia(e)}» deja su sujeto «${e.sujeto}» afuera de la pila: `.concat(
        '`emitirLey` la rechaza, así que armarla acá mediría una situación que ningún plan produce',
      ),
    )
  }

  // Y se verifica que todos cumplan lo que la fila les pide ANTES de correr: si el
  // banco montara una situación que el esquema no declara, la tilde verde no
  // mediría la fila sino al banco.
  for (const [rol, body] of materia) {
    for (const t of e.roleHints[rol] ?? []) {
      const x = qualityOf(body, t.q, PHYS)
      if (!compara(x, t.op, t.v)) {
        throw new Error(
          `el banco montó un «${rol}» que la fila no admite: ${t.q}=${num(x)} contra ${texto(t)}. ` +
            `O la fila cambió de condiciones, o este montaje dejó de medirla.`,
        )
      }
    }
  }
  // Y la simétrica, que es la que ataja el error caro: que no haya ningún rol de la
  // fila sin cuerpo. Sin esto, una fila que nombrara un rol que el banco no arma
  // saldría verde midiendo una situación más chica que la que declara.
  for (const rol of [...e.pila, e.sujeto]) {
    if (!materia.has(rol)) throw new Error(`el banco no armó el rol «${rol}» de la fila «${claveDeVia(e)}»`)
  }

  const w: WorldState = {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos(cuerpos),
    actors: mapaDeActores([{ id: ANA, body: `${ANA}-cuerpo`, holding: [], capacity: 6, permits: 'irreversible' }]),
    cells: new Map<CellKey, CellState>(),
    desplegados: new Map(),
    nextId: 1,
  }
  return {
    w,
    sujeto: e.sujeto,
    reparto:
      `pila [${e.pila.join(' > ')}] · ` +
      `fuego=leña de ${num(masaDeLena)} kg ardiendo (emitsPower ${num(potencia)}, el borde de abajo) · ` +
      `${e.sujeto}=${sustancia} de ${String(MASA_DE_LA_COMIDA)} kg`,
    potencia,
  }
}

/** Lo que la fila promete, mirado sobre el sujeto y sobre la mano. */
function medirLey(e: EsquemaDeLey, w: WorldState, sujeto: string, conMano: boolean): Medicion {
  const pred = interpretado(e)
  if (pred.k !== 'sostiene') throw new Error(`la fila de ley «${e.establishes}» no promete sobre la mano`)
  const c = w.bodies.get(sujeto)
  if (c === undefined) return NADA
  const lector = lectorDe(w)
  const tags = tagsDe(c.body, w.phys)
  const medidos = (pred.tests ?? []).map((t) => ({ t, x: qualityOf(c.body, t.q, w.phys) }))
  const cumplen = medidos.every((m) => compara(m.x, m.t.op, m.t.v))
  const ana = w.actors.get(ANA)
  const enMano = (ana?.holding ?? []).includes(sujeto)
  // La `digestibility` es la más lenta de las dos que la ley mueve, así que es la
  // que sigue el pico y la que dice cuánto falta.
  const cocido = qualityOf(c.body, 'digestibility', w.phys)
  return {
    ok: cumplen && tags.includes(pred.tag) && (!conMano || enMano),
    sobre: conMano ? 'la mano' : c.body.id,
    valor: cocido,
    medido:
      `${medidos.map((m) => `${m.t.q}=${num(m.x)}`).join(' · ')} · tags [${tags.join(', ')}]` +
      `${conMano ? ` · en la mano: ${enMano ? 'sí' : 'no'}` : ''}`,
    umbral: (pred.tests ?? []).map(texto).join(' ∧ ') + ` ∧ tag «${pred.tag}»`,
    como: '`qualityOf` sobre el sujeto y el catálogo de sustancias para el tag',
    // Y la segunda fuente al lado: lo que contesta `cumpleCuerpo` leyendo el nombre.
    // Que coincida con la de arriba se mide aparte, sobre el pescado que salió del río.
    vista: cumpleCuerpo(pred, vistaDe(c, w), lector),
  }
}

/**
 * Correr la fila de ley con CERO intenciones, una vez por cada sustancia del tag, y
 * quedarse con la que peor sale. Al final, un `take` de verdad para la mitad de la
 * promesa que la ley no hace.
 */
function correrLey(e: EsquemaDeLey): Resultado {
  const pred = interpretado(e)
  if (pred.k !== 'sostiene') throw new Error(`la fila de ley «${e.establishes}» no promete sobre la mano`)
  const limite = tope(e)
  let peor: Resultado | undefined
  const detalle: string[] = []

  for (const sustancia of sustanciasDelTag(pred.tag)) {
    const puesta = montarLey(e, sustancia)
    let w = puesta.w
    let m = medirLey(e, w, puesta.sujeto, false)
    let pico = m.valor
    let ventanas = 0
    let potenciaMinima = Number.POSITIVE_INFINITY
    let t = 0
    while (t < limite && !m.ok) {
      // NADIE APLICA NADA. Si esto cocina, lo cocinó la ley.
      const r = stepWorld(w, [])
      w = r.state
      t++
      const comida = w.bodies.get(puesta.sujeto)
      if (comida !== undefined && estaEnVentanaDeCoccion(comida.body, w.phys)) ventanas++
      const fuego = w.bodies.get('fuego')
      const pot = fuego === undefined ? 0 : qualityOf(fuego.body, 'emitsPower', w.phys)
      if (pot < potenciaMinima) potenciaMinima = pot
      m = medirLey(e, w, puesta.sujeto, false)
      if (!(pico >= m.valor)) pico = m.valor
    }
    // La otra mitad de la promesa: la fila habla de la MANO, y la ley deja la
    // comida arriba de la parrilla. Se levanta con una intención del mundo.
    const rechazos: Record<string, number> = {}
    const conTake = stepWorld(w, [take({ by: ANA, seq: t + 1 }, puesta.sujeto)])
    for (const ev of conTake.events) if (ev.k === 'rechazada') rechazos[ev.por] = (rechazos[ev.por] ?? 0) + 1
    w = conTake.state
    t++
    const final = medirLey(e, w, puesta.sujeto, true)
    detalle.push(
      `  ${sustancia.padEnd(11)} ${(t / HZ_DE_REFERENCIA).toFixed(2).padStart(6)} s · ${final.medido} · ` +
        `en la ventana de la ley 5 ${String(ventanas)} de ${String(t - 1)} ticks · ` +
        `el fuego bajó hasta emitsPower ${num(potenciaMinima)}`,
    )
    const r: Resultado = {
      e,
      reparto: puesta.reparto,
      ticks: t,
      segundos: t / HZ_DE_REFERENCIA,
      medicion: final,
      pico,
      nacidos: [],
      rechazos: Object.entries(rechazos)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, n]) => `${k}×${String(n)}`)
        .join(' '),
      w,
    }
    // La peor es la que no se cocinó; entre las que sí, la que más tardó.
    if (peor === undefined) peor = r
    else if (peor.medicion.ok && (!r.medicion.ok || r.ticks > peor.ticks)) peor = r
  }
  if (peor === undefined) throw new Error(`ninguna sustancia con tag «${pred.tag}» se cocina: la fila no mide nada`)
  console.log(
    `\n── LA COCCIÓN, SUSTANCIA POR SUSTANCIA, EN EL PEOR FUEGO ADMISIBLE ${'─'.repeat(10)}\n` +
      `  ${peor.reparto}\n` +
      detalle.join('\n') +
      `\n  el presupuesto de la fila es ${String(e.mientras)} s (${String(limite)} ticks)\n`,
  )
  return peor
}

/**
 * Emitir el MISMO `apply` tick a tick hasta que el predicado quede establecido.
 *
 * La condición de corte es el predicado y no «el proceso completó», y la
 * diferencia importa en las dos puntas: `friccion` no completa nunca —empuja— y
 * `extraccion` completa cada 1,5 segundos sin rendir nada la mayoría de las veces.
 * Una sola condición para las cuatro, y la que la fila promete.
 */
/**
 * Este archivo verifica el CATÁLOGO CORE contra el mundo, y el core no tiene ni va
 * a tener filas de obra: una obra es de una partida y entra por el overlay (ver
 * `EsquemaDeObra` en `tipos.ts`). Verificar una pediría además armarla, que es
 * otra afirmación y tiene su propio arnés.
 *
 * Se lanza en vez de saltear porque una fila de obra ACÁ sería un error de quien
 * la puso, y saltearla en silencio dejaría una fila del core sin verificar.
 */
const SIN_OBRAS = 'este arnés verifica el catálogo core contra el mundo, y el core no tiene filas de obra'

function correr(e: ConstructionSchema): Resultado {
  if (e.k === 'ley') return correrLey(e)
  if (e.k === 'obra') throw new Error(SIN_OBRAS)
  const puesta = montar(e)
  let w = puesta.w
  const nacidos: string[] = []
  const rechazos: Record<string, number> = {}
  let m = medir(e, w, nacidos, puesta.roles)
  let pico = m.valor
  const limite = tope(e)
  let t = 0
  while (t < limite && !m.ok) {
    const i = apply({ by: ANA, seq: t }, w.phys, e.via, puesta.roles)
    const r = stepWorld(w, i === undefined ? [] : [i])
    for (const ev of r.events) {
      if (ev.k === 'nacio' && ev.por === 'rendimiento') nacidos.push(ev.id)
      if (ev.k === 'rechazada') rechazos[ev.por] = (rechazos[ev.por] ?? 0) + 1
    }
    w = r.state
    t++
    m = medir(e, w, nacidos, puesta.roles)
    if (!(pico >= m.valor)) pico = m.valor
  }
  return {
    e,
    reparto: puesta.reparto,
    ticks: t,
    segundos: t / HZ_DE_REFERENCIA,
    medicion: m,
    pico,
    nacidos,
    rechazos: Object.entries(rechazos)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, n]) => `${k}×${String(n)}`)
      .join(' '),
    w,
  }
}

/**
 * Con red, para que una fila que no se puede ni armar no se lleve puestas a las
 * demás: el `it` de esa fila cuenta el error y las otras siguen midiendo.
 */
function correrConRed(e: ConstructionSchema): Resultado {
  try {
    return correr(e)
  } catch (x) {
    return {
      e,
      reparto: '—',
      ticks: 0,
      segundos: 0,
      medicion: NADA,
      pico: Number.NaN,
      nacidos: [],
      rechazos: '',
      error: x instanceof Error ? x.message : String(x),
    }
  }
}

/**
 * ─── LOS HUECOS ABIERTOS DE LA TABLA, CON SU MEDICIÓN ───────────────────────
 *
 * Una fila que hoy NO cumple lo que promete entra acá y su `it` se corre con
 * `it.fails`: la afirmación es la misma —el peor caso admisible, sin aflojar una
 * coma— y lo que cambia es que está declarado que falla y por qué. Una fila que se
 * arregle y siga en esta lista pone rojo el test de abajo.
 *
 * ─── EL ÚNICO, Y ES UN HALLAZGO DEL TRAMO: EL FUEGO DE CONTACTO SE APAGA ────
 *
 * La fila del contacto es la única de las tres que una criatura puede encender —las
 * otras dos piden yescas que no entran en el tanque de aliento— y por eso mismo es
 * la que trabaja con la brasa MÁS CHICA: 0,3507 kg de leña en el borde de abajo de
 * su ventana, contra 0,8417 de la parrilla y 3,5069 del piso. Y ahí muerde algo que
 * ninguna de las otras dos siente: **el fuego se consume mientras cocina.**
 *
 * Medido, con el fuego en el borde de abajo (emitsPower 105,4167) y piezas de 2 kg:
 *
 *     grasa 2,00 s · huevo 3,60 · medula 4,85 · pescado 5,55 · carne 10,10 · molusco NUNCA
 *     el fuego se apaga a los 17,55 s — `emitsPower` llega a 0,00
 *
 * Cinco de las seis carnosas cocinan, **incluido el pescado**, que es el que la
 * cadena del Hito 5 consigue. La sexta, el molusco (`toughness` 0,55, el más alto
 * del tag), se queda en `digestibility` 0,8396 y no llega nunca, porque para cuando
 * la ley 5 lo empezó a empujar en serio el fuego ya se apagó. Y no es la masa de la
 * comida: con moluscos de 0,5, 1, 1,5 y 2 kg el fuego se apaga a los 17,55 s igual y
 * la digestibilidad topa en 0,8448 / 0,8431 / 0,8414 / 0,8396.
 *
 * Con el fuego a mitad de ventana (138,13, o sea 0,4595 kg de leña) el molusco SÍ
 * cocina, en 7,50 s. O sea que el borde de abajo de la ventana está mal puesto para
 * esta geometría y no para las otras dos, y la razón es que la ventana la calcula la
 * ley 1 EN RÉGIMEN —una foto— mientras que la ley 3 vacía el tanque.
 *
 * ─── POR QUÉ NO SE ARREGLA ACÁ, Y QUÉ HARÍA FALTA ──────────────────────────
 *
 * La condición que falta es «que al fuego le quede combustible para todo el
 * `mientras` CON MARGEN», y se puede decir: la reserva de un fuego es exactamente
 * `emitsPower / 16,7` unidades de combustible, así que un piso de `emitsPower` es un
 * piso de duración. Lo que no se puede es despejar CUÁNTO: la tasa es
 * `COMBUSTIBLE_POR_SEGUNDO`, una constante PRIVADA de `physics/src/leyes.ts` que
 * este paquete no ve, y el margen que hace falta está medido sólo por sus dos lados
 * —1,17× de duración sobre `mientras` no alcanza, 1,84× sí—. Elegir un número ahí
 * adentro sin bisecarlo sería inventar una calibración; ponerle el `it.fails` con
 * las dos cotas medidas deja el trabajo hecho para quien la bisecte.
 */
const HUECOS_DE_LA_TABLA: Readonly<Record<string, string>> = {
  'ley:desnaturalizacion:holding(tag:carnoso,digestibility>=0.85,toxicity<=0.05):fuego>comida@0':
    'el fuego del borde de abajo se apaga a los 17,55 s y el molusco topa en digestibility 0,8396',
}

const RESULTADOS = new Map<string, Resultado>()

function resultadoDe(e: ConstructionSchema): Resultado {
  const r = RESULTADOS.get(clave(e))
  if (r === undefined) throw new Error(`la fila ${clave(e)} no se corrió`)
  return r
}

// ─── El barrido ─────────────────────────────────────────────────────────────

describe('las diez filas de `ESQUEMAS`, cada una contra una partida de verdad', () => {
  beforeAll(() => {
    for (const e of ESQUEMAS) RESULTADOS.set(clave(e), correrConRed(e))

    // La tabla se imprime SIEMPRE, pasen o fallen las filas: es el entregable de
    // este archivo, y un número que sólo se ve cuando algo se rompe no es un
    // número. El ancho está calculado sobre lo que hay, no clavado.
    const filas = ESQUEMAS.map((e) => resultadoDe(e))
    const col = (xs: readonly string[]): number => xs.reduce((n, s) => Math.max(n, s.length), 0)
    const firma = filas.map((r) => r.e.establishes)
    const via = filas.map((r) =>
      r.e.k === 'proceso' ? r.e.via : r.e.k === 'obra' ? `obra ${r.e.revision}` : `ley ${r.e.ley}`,
    )
    const medido = filas.map((r) => r.medicion.medido)
    const umbral = filas.map((r) => r.medicion.umbral)
    const lineas = filas.map((r, i) =>
      [
        r.medicion.ok ? '✓' : '✗',
        (firma[i] ?? '').padEnd(col(firma)),
        (via[i] ?? '').padEnd(col(via)),
        `${r.segundos.toFixed(2)}s`.padStart(7),
        (medido[i] ?? '').padEnd(col(medido)),
        (umbral[i] ?? '').padEnd(col(umbral)),
        r.error ?? `${r.medicion.sobre} · ${r.reparto}`,
      ].join('  '),
    )
    console.log(
      `\n─── LOS ESQUEMAS CONTRA EL MUNDO ───\n${lineas.join('\n')}\n\n` +
        `cómo se decidió cada una, y qué contestó la SUPERFICIE sobre lo mismo:\n` +
        filas
          .map(
            (r) =>
              `    ${r.e.establishes}: ${r.medicion.como} · \`cumpleCuerpo\` dijo ${r.medicion.vista ? 'que SÍ' : 'que NO'}` +
              `${r.rechazos === '' ? '' : ` · rechazos: ${r.rechazos}`}`,
          )
          .join('\n') +
        `\n\nquedaron establecidas ${String(filas.filter((r) => r.medicion.ok).length)}/${String(filas.length)}\n`,
    )
  }, 300_000)

  it('el barrido cubre `ESQUEMAS` entero: ni una fila de menos', () => {
    // Lo que ataja: agregar una fila y no verificarla. El barrido sale de la
    // constante, así que la fila nueva entra sola — y si no se puede armar, su
    // propio `it` lo dice.
    expect(RESULTADOS.size).toBe(ESQUEMAS.length)
    expect([...RESULTADOS.keys()].sort()).toEqual([...ESQUEMAS.map(clave)].sort())
  })

  for (const e of ESQUEMAS) {
    // Un hueco ABIERTO no se tapa aflojando la afirmación: se corre la MISMA
    // afirmación y se declara que hoy falla, con el porqué medido al lado. Ver
    // `HUECOS_DE_LA_TABLA`.
    const corre = HUECOS_DE_LA_TABLA[claveDeVia(e)] === undefined ? it : it.fails
    corre(`«${e.establishes}» vía \`${claveDeVia(e)}\` queda establecido de verdad`, () => {
      const r = resultadoDe(e)
      expect(r.error, `la fila no se pudo ni armar: ${r.error ?? ''}`).toBeUndefined()
      expect(
        r.medicion.ok,
        `«${e.establishes}» no quedó establecido en ${String(r.segundos)} s de mundo. ` +
          `Roles: ${r.reparto}. Medido sobre ${r.medicion.sobre}: ${r.medicion.medido} contra ${r.medicion.umbral}. ` +
          `Rechazos del mundo: ${r.rechazos === '' ? 'ninguno' : r.rechazos}.`,
      ).toBe(true)
    })
  }

  it('la lista de huecos no tiene entradas de más: cada una nombra una fila que existe', () => {
    // El error simétrico del `it.fails`, y es el que haría inútil a la lista: dejar
    // una entrada vieja después de arreglar la fila convierte un `it` en `it.fails`
    // para siempre, y un `it.fails` que pasaría es un test que nadie mira.
    const filas = new Set(ESQUEMAS.map((e) => claveDeVia(e)))
    expect(Object.keys(HUECOS_DE_LA_TABLA).filter((k) => !filas.has(k))).toEqual([])
    expect(Object.keys(HUECOS_DE_LA_TABLA).length).toBe(1)
  })
})

// ─── Lo que la tabla sola no dice ───────────────────────────────────────────

describe('las condiciones que hacen andar a las filas, medidas aparte', () => {
  it('cada esquema nombra todos los roles OBLIGATORIOS de su proceso', () => {
    // La convención de `esquemas.ts` es «se llenan exactamente los roles que
    // `roleHints` nombra». Un esquema que se olvidara de uno obligatorio no
    // fallaría al escribirse: fallaría en el mundo, con `rol-sin-cuerpo`, ticks
    // después y sin decir de quién es la culpa.
    const faltantes: string[] = []
    for (const e of ESQUEMAS) {
      // Una ley no tiene roles en el catálogo: los suyos los verifica
      // `armarMarco` contra su pila y su sujeto, y `los-esquemas.test.ts` los cruza.
      if (e.k !== 'proceso') continue
      for (const r of procesoDe(e.via).roles) {
        if (r.name.endsWith('?')) continue
        if (e.roleHints[baseRoleName(r.name)] === undefined) {
          faltantes.push(`${clave(e)}: no nombra el rol obligatorio «${r.name}»`)
        }
      }
    }
    expect(faltantes).toEqual([])
  })

  it('ningún esquema de `union` nombra el rol opcional `b`, y por eso hay caña', () => {
    // Está afirmado en `los-esquemas.test.ts` sobre la tabla; acá está la
    // consecuencia MEDIDA en el mundo: la misma corrida con `b` lleno da catch
    // cero, o sea que el `gear` de `extraccion` no se puede llenar nunca.
    const conB = ESQUEMAS.filter((e) => e.k === 'proceso' && e.via === 'union' && e.roleHints['b'] !== undefined)
    expect(conB.map((e) => e.establishes)).toEqual([])

    const vara = cuerpoDe('v1', 'madera', 1, 'vara')
    const otra = cuerpoDe('v2', 'madera', 1, 'vara')
    const hebra = cuerpoDe('h', 'liana', 0.2, 'hebra')
    const sinB = unir(vara, undefined, hebra, PHYS, 'sin-b')
    const conBLleno = unir(vara, otra, hebra, PHYS, 'con-b')
    if (sinB === undefined || conBLleno === undefined) throw new Error('no se pudo atar')
    expect(puntasLibres(sinB, PHYS)).toBe(1)
    expect(qualityOf(conBLleno, 'catch', PHYS)).toBe(0)
    console.log(
      `\nel rol opcional `.concat(
        `\`b\`: sin él la caña tiene ${String(puntasLibres(sinB, PHYS))} punta libre y catch ` +
          `${num(qualityOf(sinB, 'catch', PHYS))}; con él, catch ${num(qualityOf(conBLleno, 'catch', PHYS))}\n`,
      ),
    )
  })

  it('la fila del fuego cruza los 400 ANTES de sus 3,2083 s, y no es la fricción quien la cruza', () => {
    // ─── LO QUE LA TILDE VERDE NO DICE, Y HAY QUE DECIRLO ──────────────────
    //
    // `friccion` empuja `temperature` hacia 400 a 120 °C/s desde el ambiente, o sea
    // que la fila declara 3,2083 s. Medido, el predicado queda establecido ANTES —y
    // con la vara MUCHO más caliente que 400—, y el motivo no es que el esquema se
    // haya quedado corto: es que la madera pasa su `ignitionPoint` de 300 en el
    // camino, la ley 3 se hace cargo, y el cuerpo se va al régimen de la llama. O
    // sea que quien termina de cruzar los 400 es la combustión y no la mano.
    //
    // Eso NO invalida la fila —el predicado queda establecido aplicando el proceso
    // que el esquema nombra, que es todo lo que la fila promete— pero convierte
    // `segundos` en una cota superior y no en una predicción, y eso es información
    // para la regresión, que ordena la búsqueda por ese número.
    //
    // Y la otra mitad, que es la que impide leer esto como «pasa por accidente»: la
    // fricción SOLA habría llegado igual. El precio es `heatCapacity × ΔT /
    // eficiencia` y con la yesca da 374 de un tanque de 1000, así que lo que sobra
    // al final del vuelo dice que el aliento nunca fue el límite.
    const e = ESQUEMAS.find((x) => x.establishes === 'temperature>=400')
    if (e === undefined) throw new Error('no está el esquema del fuego')
    const r = resultadoDe(e)
    expect(r.error).toBeUndefined()
    const ignicion = qualityOf(r.w?.bodies.get('a')?.body ?? criatura('x', 0), 'ignitionPoint', PHYS)
    const ella = r.w?.bodies.get(`${ANA}-cuerpo`)
    const aliento = ella === undefined ? 0 : qualityOf(ella.body, 'stamina', PHYS)
    console.log(
      `\nla fila del fuego · el esquema declara ${e.segundos.toFixed(4)} s y cruzó los 400 a los ` +
        `${r.segundos.toFixed(2)} s, con la vara a ${num(r.medicion.valor)} °C\n` +
        `  la ignición de lo que se frota está en ${num(ignicion)} °C, o sea POR DEBAJO de los 400 ` +
        `que el proceso promete: la ley 3 entra antes del final\n` +
        `  aliento al terminar: ${num(aliento)} de 1000 — el tanque nunca fue el límite\n`,
    )
    expect(r.segundos).toBeLessThanOrEqual(e.segundos)
    expect(ignicion).toBeGreaterThan(0)
    expect(ignicion).toBeLessThan(400)
    expect(aliento).toBeGreaterThan(0)
  })

  it('la caña que pesca sale de correr el esquema de `catch>0`, no de una fábrica del test', () => {
    // ─── LA COMPOSICIÓN, QUE ES LO QUE UNA TABLA DE RECETAS NO TIENE ────────
    //
    // El barrido de arriba le da a `extraccion` una caña armada con `unir`, y eso
    // deja una pregunta abierta: ¿el `gear` que la fila necesita lo puede FABRICAR
    // la fila de `catch>0` corriendo en el mundo, o hace falta una caña que venga
    // de afuera? Acá se encadena: se corre la fila de `catch>0` en el mundo, se
    // toma lo que nació, y se comprueba que ese cuerpo llena el rol `gear` de
    // `extraccion` con lo que el catálogo le exige. Es el primer criterio del
    // Hito 5 —«deshilacha un matorral, ata una vara, va y pesca»— desde el lado de
    // los esquemas.
    const atar = ESQUEMAS.find((e) => e.establishes === 'catch>0')
    if (atar === undefined) throw new Error('no está el esquema de `catch>0`')
    const r = resultadoDe(atar)
    expect(r.error).toBeUndefined()
    const nacida = r.nacidos[r.nacidos.length - 1]
    expect(nacida, 'atar no fabricó ningún cuerpo').toBeDefined()
    const cana = r.w?.bodies.get(nacida ?? '')
    expect(cana).toBeDefined()
    if (cana === undefined) return

    const gear = procesoDe('extraccion').roles.find((x) => x.name === 'gear')
    if (gear === undefined) throw new Error('`extraccion` perdió el rol `gear`')
    const medidas = gear.where.map((t) => `${t.q}=${num(qualityOf(cana.body, t.q, PHYS))} contra ${texto(t)}`)
    console.log(`\nlo que ató la fila de \`catch>0\` como \`gear\`: ${medidas.join(' · ')}\n`)
    const incumple = gear.where.filter((t) => !compara(qualityOf(cana.body, t.q, PHYS), t.op, t.v))
    expect(incumple.map(texto)).toEqual([])
  })

  it('el `heatCapacity` del leño NO entra en el techo, y el de su hebra sí', () => {
    // La fila de `heatCapacity<=0.9` sólo dice que la hebra entra. Lo que le da
    // sentido es que la fuente NO entraba: sin eso, el esquema sería un paso de
    // más y la criatura podría frotar el leño directamente. Los dos números salen
    // de la misma corrida.
    const e = ESQUEMAS.find((x) => x.establishes === 'heatCapacity<=0.9')
    if (e === undefined) throw new Error('no está el esquema de la yesca')
    const r = resultadoDe(e)
    expect(r.error).toBeUndefined()
    const fuente = r.w?.bodies.get('source')
    const hebra = r.w?.bodies.get(r.nacidos[r.nacidos.length - 1] ?? '')
    expect(fuente).toBeDefined()
    expect(hebra).toBeDefined()
    if (fuente === undefined || hebra === undefined) return
    const techo = e.roleHints['source']?.[0]?.v
    const hcFuente = qualityOf(fuente.body, 'heatCapacity', PHYS)
    const hcHebra = qualityOf(hebra.body, 'heatCapacity', PHYS)
    console.log(
      `\nla yesca: lo que queda de la fuente tiene heatCapacity ${num(hcFuente)} y la hebra ${num(hcHebra)} ` +
        `(el techo de la fila es 0,9; el del \`source\` es ${String(techo ?? Number.NaN)})\n`,
    )
    expect(hcHebra).toBeLessThanOrEqual(0.9)
    // Y la hebra conserva la rigidez que `friccion` le pide al rol `a`: sin eso
    // sería liviana y no se podría frotar, o sea que el puente no serviría.
    const rigidez = procesoDe('friccion').roles.find((x) => x.name === 'a')?.where[0]
    if (rigidez === undefined) throw new Error('`friccion` perdió lo que le pide al rol `a`')
    expect(qualityOf(hebra.body, rigidez.q, PHYS)).toBeGreaterThanOrEqual(rigidez.v)
  })
})

// ─── EL CONTROL NEGATIVO: UN ESQUEMA QUE MIENTE TIENE QUE SALIR ROJO ────────
//
// Ocho tildes verdes no prueban nada por sí solas: podrían salir de un arnés que
// no sabe decir que no. Estos dos MUTANTES son las dos filas reales con UNA sola
// condición dada vuelta, corridos por el mismo `correr` y el mismo `medir`, y los
// dos tienen que quedar SIN establecer. Si alguno pasara, la tabla de arriba no
// mediría nada.
//
// Y de paso son la medición que las filas verdaderas no pueden hacer sobre sí
// mismas: la fila de `catch>0` no puede demostrar que omitir `b` importa —omite el
// rol y no hay con qué comparar— y la de `temperature>=400` no puede demostrar que
// su `heatCapacity <= 0,9` no es decoración.

describe('el control negativo: las dos condiciones que hacen andar las filas', () => {
  /** La misma fila, con UNA condición cambiada. `segundos` sale igual del catálogo. */
  function mutante(firma: string, roleHints: ConstructionSchema['roleHints']): ConstructionSchema {
    const real = ESQUEMAS.find((e) => e.establishes === firma)
    if (real === undefined) throw new Error(`no está el esquema de «${firma}»`)
    return { ...real, roleHints }
  }

  it('`catch>0` CON el rol opcional `b` lleno no queda establecido: catch 0,0000', () => {
    // Lo que el mundo hace y `roleHints` no sabe decir: con `b`, el atador se gasta
    // como `Joint.via`, no sobrevive como parte, no hay punta suelta. Con la caña
    // atada de las dos puntas no se pesca nunca más, y no habría ningún error: sólo
    // una caña que no engancha.
    const r = correrConRed(mutante('catch>0', { binder: [{ q: 'flexibility', op: '>=', v: 0.8 }], a: [], b: [] }))
    expect(r.error).toBeUndefined()
    expect(r.reparto).toContain('b=')
    expect(r.nacidos.length, 'el mutante ni siquiera ató').toBeGreaterThan(0)
    console.log(
      `\ncontrol negativo · \`union\` CON \`b\`: ${r.reparto}\n` +
        `  quedó ${r.medicion.medido} contra ${r.medicion.umbral} → ${r.medicion.ok ? 'establecido' : 'NO establecido'}\n`,
    )
    expect(r.medicion.ok).toBe(false)
  })

  it.fails('`temperature>=400` con un leño en vez de yesca no queda establecido, y el aliento dice por qué — ROJO DECLARADO: el leño AHORA entra', () => {
    // El `heatCapacity <= 0,9` de la fila de `friccion` no es decoración: el precio
    // del `drive` es `heatCapacity × ΔT / eficiencia` de `stamina`, y `heatCapacity`
    // es EXTENSIVA. Dando vuelta el hint —pidiendo el cuerpo MÁS pesado en vez del
    // más liviano— el banco elige la vara de 1 kg y la criatura se queda sin tanque
    // antes de llegar. De ahí sale la yesca, y no de una regla que diga «la yesca
    // prende y el leño no».
    //
    // ─── Y ESTE CONTROL NEGATIVO DEJÓ DE CONTROLAR, MEDIDO ─────────────────
    //
    // La eficiencia de `friccion` pasó de 0,35 a 0,85 (tramo N). Con eso el leño de
    // 1 kg **llega a 455,89 °C y le sobran 423,18 de aliento de 1000**: la condición
    // `temperature>=400` QUEDA ESTABLECIDA y las dos afirmaciones de abajo —que hay
    // rechazos por `actor-desconocido`, o sea que se murió frotando, y que la
    // medición da `false`— son las dos falsas.
    //
    // LO QUE ESO SÍ Y NO QUIERE DECIR:
    //   · NO quiere decir que el `heatCapacity <= 0,9` de la fila sobre: sigue
    //     valiendo para la criatura del criterio (5), que arranca con 310 y no con
    //     el tanque lleno. Con 310 el leño de 1 kg (770 de precio) la mata igual.
    //   · SÍ quiere decir que esta ESCENA ya no puede mostrarlo, porque le regala
    //     el tanque lleno y el cuerpo más pesado que tiene es de 1 kg.
    //
    // QUÉ LO ARREGLA, para el que vuelva: una vara más pesada en la escena (a 0,85
    // el borde está en 1,30 kg) o darle a la criatura el tanque del criterio. Las
    // dos son cambios del arnés y no de la fila, y no entran en este tramo: mover
    // el tanque de `correr()` mueve las diez filas de la tabla a la vez.
    //
    // Queda con la afirmación ENTERA y sin aflojar una coma, que es la regla de la
    // casa para un hueco: el día que la escena crezca, esto pasa a verde y el
    // `it.fails` se vuelve rojo pidiendo que lo borren.
    const r = correrConRed(mutante('temperature>=400', { a: [{ q: 'heatCapacity', op: '>=', v: 1 }], b: [], actor: [] }))
    expect(r.error).toBeUndefined()
    const leno = r.w?.bodies.get('a')
    const ella = r.w?.bodies.get(`${ANA}-cuerpo`)
    expect(leno).toBeDefined()
    console.log(
      `\ncontrol negativo · \`friccion\` sobre un leño: ${r.reparto}\n` +
        `  heatCapacity ${num(leno === undefined ? Number.NaN : qualityOf(leno.body, 'heatCapacity', PHYS))} ` +
        `(el techo de la fila es 0,9) · llegó a ${num(r.pico)} °C y terminó en ${num(r.medicion.valor)}, ` +
        `contra ${r.medicion.umbral}, en ${r.segundos.toFixed(2)} s de mundo\n` +
        `  aliento que le quedó: ${num(ella === undefined ? 0 : qualityOf(ella.body, 'stamina', PHYS))} ` +
        `de 1000 · rechazos: ${r.rechazos === '' ? 'ninguno' : r.rechazos}\n`,
    )
    // Y falla por el motivo que se afirma y no por otro: el leño SÍ se calienta
    // —la fricción funciona— y lo que se acaba es el tanque. Sin esto, el control
    // negativo pasaría igual el día que `friccion` dejara de empujar del todo, que
    // es una rotura distinta y mucho peor.
    expect(r.pico, 'el mutante ni siquiera calentó: entonces no mide lo que dice medir').toBeGreaterThan(100)
    expect(r.rechazos).toContain('actor-desconocido')
    expect(r.medicion.ok).toBe(false)
  })
})

// ─── LOS DOS HUECOS DE LA SUPERFICIE, SOBRE CUERPOS DE ESTA CORRIDA ─────────
//
// No son bugs nuevos: `predicado.ts` los documenta y `tests/el-predicado.test.ts`
// los mide sobre cuerpos armados a mano. Lo que agregan estos dos es el lugar
// donde MUERDEN: sobre la caña que la fila de `catch>0` ató y sobre el pescado que
// la fila de `holding(tag:carnoso)` sacó del río. No se arreglan acá —este archivo
// no toca `src/`— y quedan en `it.fails` para que el día que se cierren alguien
// venga a borrarlos.

describe('lo que `cumpleCuerpo` no puede contestar sobre lo que este archivo fabricó', () => {
  it.fails('sobre la caña que ató el mundo, `cumpleCuerpo` dice que NO tiene puntas libres', () => {
    // POR QUÉ SIGUE ABIERTO: `geomDeVista` (en `predicado.ts`) contesta
    // `jointCount` entera y `longestAxis` por el alias `reach`, y para
    // `freeStrandEnds` devuelve `undefined` porque NINGUNA cualidad del catálogo
    // es su alias: la única que la usa es `catch`, y la usa multiplicada por
    // `0,15 + maxParts(sharpness) × 0,5`. Despejarla desde la vista exige
    // `maxParts(sharpness)`, y una `BodyView` sólo puede dar `own(sharpness)`, que
    // es el promedio pesado por masa — otro número.
    //
    // QUÉ HARÍA FALTA: o una cualidad del catálogo que sea `geom(freeStrandEnds)`
    // pelada —y entonces el alias existe y `predicado.ts` no cambia—, o que
    // `BodyView` traiga las partes con su masa y su sustancia, que es una decisión
    // sobre la superficie entera y no sobre este módulo.
    //
    // LA CONSECUENCIA MEDIDA: el esquema `freeStrandEnds>=1` de `union` se
    // verifica en la tabla de arriba despejando de `catch`, y una mente que
    // quisiera preguntarse «¿ya tengo algo con una punta suelta?» con las
    // herramientas del paquete se contestaría que no, teniendo la caña en la mano.
    const atar = ESQUEMAS.find((e) => e.establishes === 'freeStrandEnds>=1')
    if (atar === undefined) throw new Error('no está el esquema de `freeStrandEnds>=1`')
    const r = resultadoDe(atar)
    const w = r.w
    const id = r.nacidos[r.nacidos.length - 1]
    if (w === undefined || id === undefined) throw new Error('la fila de atar no fabricó nada')
    const c = w.bodies.get(id)
    if (c === undefined) throw new Error('la caña no está en el mundo')
    const pred = interpretar('freeStrandEnds>=1')
    if (pred === undefined) throw new Error('`freeStrandEnds>=1` dejó de interpretarse')
    // Tiene UNA punta libre, medida despejando de `catch`. La superficie dice que no.
    expect(puntasLibres(c.body, w.phys)).toBeGreaterThanOrEqual(1)
    expect(cumpleCuerpo(pred, vistaDe(c, w), lectorDe(w))).toBe(true)
  })

  it('CERRADO: sobre el pescado que salió del río, `cumpleCuerpo` dice que SÍ es carnoso', () => {
    // ─── ERA UN `it.fails` Y ES LA MEDICIÓN QUE LO CIERRA ────────────────────
    //
    // Decía: «los tags son de la sustancia y una `BodyView` no trae sustancia».
    // Hoy SÍ la trae, dicha por lo que es: `BodyView.tags` es `tagsDe(body, phys)`
    // con la `Physics` VIVA, puesto en `perceive/src/vista.ts` al lado de `name`.
    //
    // ─── Y ACÁ SE CRUZABA CONTRA EL NOMBRE, QUE ERA EL BUG ──────────────────
    //
    // Este mismo test cruzaba la respuesta contra `tagsDeLoQueSeVe(nameOf(...))`,
    // un índice `nombre → tags` derivado del catálogo de la semilla y buscado por
    // prefijo. Sobre un pescado recién sacado del río coincidían, así que el cruce
    // pasaba; sobre un pescado PASADO DE FUEGO no, porque la ley 4 lo bautiza
    // «pescado hecho tizón» y el prefijo seguía contestando `carnoso` sobre un
    // carbón con `nutrition 0`. La lectura por nombre se fue entera.
    //
    // Lo que este test aporta y `el-predicado.test.ts` no puede: el cuerpo no es
    // uno de laboratorio. Es EL PESCADO QUE ESTA MISMA CORRIDA SACÓ DEL RÍO, con la
    // sustancia que le puso el dios.
    //
    // Y las dos fuentes se siguen cruzando, sólo que ahora las dos son honestas: el
    // `tagsDe` LOCAL de este arnés le pregunta a `phys.substances` parte por parte
    // sin tocar `src/`, y la vista publica el de la física. Que coincidan es la
    // prueba; si la vista empezara a inventar tags, coincidir dejaría de pasar.
    const pescar = ESQUEMAS.find((e) => e.establishes === 'holding(tag:carnoso)')
    if (pescar === undefined) throw new Error('no está el esquema de la pesca')
    const r = resultadoDe(pescar)
    const w = r.w
    if (w === undefined) throw new Error('la fila de pescar no corrió')
    const ana = w.actors.get(ANA)
    const pred = interpretar('holding(tag:carnoso)')
    if (pred === undefined) throw new Error('`holding(tag:carnoso)` dejó de interpretarse')
    const enMano = (ana?.holding ?? []).map((x) => w.bodies.get(x)).filter((c) => c !== undefined)
    const carnoso = enMano.filter((c) => tagsDe(c.body, w.phys).includes('carnoso'))
    const primero = carnoso[0]
    if (primero === undefined) throw new Error('la fila de pescar no dejó nada carnoso en la mano')
    console.log(
      `\n── EL TAG, SOBRE EL PESCADO QUE SALIÓ DEL RÍO ${'─'.repeat(22)}\n` +
        `  ${primero.body.id}: sustancia «${primero.body.parts[0]?.substance ?? '?'}» · ` +
        `nombre «${nameOf(primero.body, w.phys)}»\n` +
        `  tags del catálogo (arnés): [${tagsDe(primero.body, w.phys).join(', ')}] · ` +
        `tags que publica la vista: [${vistaDe(primero, w).tags.join(', ')}]\n`,
    )
    expect(carnoso.length).toBeGreaterThan(0)
    expect(carnoso.some((c) => cumpleCuerpo(pred, vistaDe(c, w), lectorDe(w)))).toBe(true)
    // Las dos lecturas, cruzadas sobre el mismo cuerpo del mundo.
    expect([...vistaDe(primero, w).tags].sort()).toEqual([...tagsDe(primero.body, w.phys)].sort())
    // Y el negativo sobre el mismo cuerpo: la caña que lo pescó NO es carnosa.
    const cana = w.bodies.get('gear')
    if (cana === undefined) throw new Error('la caña no está en el mundo')
    expect(cumpleCuerpo(pred, vistaDe(cana, w), lectorDe(w))).toBe(false)
  })
})

// ─── LA MATRIZ: CADA FUEGO EN CADA LUGAR, CORRIDA EN EL MUNDO ───────────────
//
// Acá vivía el control negativo de UNA pila: con la fogata que la fila de la
// parrilla pide, el piso se quedaba corto y el contacto quemaba. Era cierto y era
// media verdad, y la media que faltaba es la que reordenó el tramo: **eso no dice
// que la parrilla sea la geometría buena, dice que ESE fuego pide la parrilla.**
//
// Lo que se corre ahora es la matriz entera: los tres fuegos que las tres filas
// declaran (el borde de abajo de cada ventana) contra los tres montajes que el
// mundo distingue. Nueve corridas, cero intenciones, y lo que tiene que salir es la
// DIAGONAL: cada fuego cocina exactamente en el lugar de su fila, y fuera de ahí se
// queda corto o quema.

describe('la matriz de los tres fuegos por los tres lugares: lo que cocina es la diagonal', () => {
  interface Corrida {
    readonly digestibilidad: number
    readonly pico: number
    readonly ardio: boolean
    readonly enVentana: number
  }

  /** Corre `SEGUNDOS_DE_COCCION` con ese fuego y la comida puesta como diga el montaje. */
  function correrMontaje(potencia: number, montaje: 'piso' | 'parrilla' | 'contacto'): Corrida {
    const at: Placement = { x: 0, y: 0 }
    const otra: Placement = { x: 1, y: 0 }
    const masaDeLena = lenaQueEmite(potencia)
    const fuego: Body = {
      ...cuerpoDe('fuego', 'madera', masaDeLena, 'vara'),
      state: { temperature: IGNICION_DE_PRUEBA },
    }
    const parrilla = cuerpoDe('parrilla', 'piedra', 0.5, 'bloque')
    const comida = cuerpoDe('comida', 'pescado', MASA_DE_LA_COMIDA, 'bloque')
    // Los tres montajes que `montajeDe` sabe distinguir, dichos en geometría y no en
    // un campo: en la celda del fuego y apoyada en NADA, apoyada sobre la piedra que
    // está sobre el fuego, o apoyada sobre el fuego mismo. El `piso` va en la MISMA
    // celda —distancia 0— porque es lo que las filas declaran: alejarse es la otra
    // variable, y las filas que la usarían están en `GEOMETRIAS_DESCARTADAS`.
    const cuerpos: readonly WorldBody[] =
      montaje === 'piso'
        ? [{ body: fuego, at }, { body: comida, at }]
        : montaje === 'contacto'
          ? [{ body: fuego, at }, { body: comida, at, supportedBy: 'fuego' }]
          : [
              { body: fuego, at },
              { body: parrilla, at, supportedBy: 'fuego' },
              { body: comida, at, supportedBy: 'parrilla' },
            ]
    let w: WorldState = {
      tick: 0,
      hz: HZ_DE_REFERENCIA,
      phys: PHYS,
      bodies: mapaDeCuerpos([{ body: criatura(ANA, 1000), at: otra }, ...cuerpos]),
      actors: mapaDeActores([{ id: ANA, body: `${ANA}-cuerpo`, holding: [], capacity: 6, permits: 'irreversible' }]),
      cells: new Map<CellKey, CellState>(),
      desplegados: new Map(),
    nextId: 1,
    }
    let pico = 0
    let enVentana = 0
    let ardio = false
    for (let t = 0; t < Math.ceil(SEGUNDOS_DE_COCCION * HZ_DE_REFERENCIA); t++) {
      w = stepWorld(w, []).state
      const c = w.bodies.get('comida')
      if (c === undefined) break
      const grados = qualityOf(c.body, 'temperature', w.phys)
      if (grados > pico) pico = grados
      if (grados >= qualityOf(c.body, 'ignitionPoint', w.phys)) ardio = true
      if (estaEnVentanaDeCoccion(c.body, w.phys)) enVentana++
    }
    const c = w.bodies.get('comida')
    return {
      digestibilidad: c === undefined ? Number.NaN : qualityOf(c.body, 'digestibility', w.phys),
      pico,
      ardio,
      enVentana,
    }
  }

  it('EL CRITERIO: cada fuego cocina en SU lugar, y fuera de su lugar se queda corto o quema', () => {
    const MONTAJES_DEL_MUNDO = ['piso', 'parrilla', 'contacto'] as const
    // Las TRES geometrías a distancia cero, no sólo las dos que la tabla genera. La
    // del piso se descarta por VOCABULARIO —una pila no puede decir «apoyado en
    // nada»— y no por física, así que el mundo la puede armar y hay que medirla: si
    // resultara que su fuego cocina en cualquier lado, la ventana por geometría
    // sería decorado. Las ventanas de las descartadas salen calculadas igual, que es
    // justo para lo que `GEOMETRIAS_DESCARTADAS` guarda sus números.
    const todas = [...GEOMETRIAS_DE_LA_COCCION, ...GEOMETRIAS_DESCARTADAS].filter((g) => g.distancia === 0)
    expect(todas.length).toBe(MONTAJES_DEL_MUNDO.length)
    const filas: string[] = [
      '─── LA MATRIZ: TRES FUEGOS × TRES LUGARES, CORRIDOS EN EL MUNDO ───',
      '  el fuego de cada fila es el BORDE DE ABAJO de su ventana; la comida es pescado de 2 kg',
      '',
      '  fuego de la fila │ potencia │      en el piso │    en parrilla │    en contacto',
      '  ─────────────────┼──────────┼─────────────────┼────────────────┼───────────────',
    ]
    const veredictos = new Map<string, string>()
    for (const g of todas) {
      const celdas: string[] = []
      for (const m of MONTAJES_DEL_MUNDO) {
        const r = correrMontaje(g.minima, m)
        const v = r.ardio ? 'QUEMA' : r.digestibilidad >= 0.85 ? 'cocina' : 'corto'
        veredictos.set(`${g.montaje}/${m}`, v)
        celdas.push(`${v} ${num(r.digestibilidad)}`.padStart(15))
      }
      filas.push(`  ${g.montaje.padEnd(16)} │ ${g.minima.toFixed(2).padStart(8)} │ ${celdas.join(' │ ')}`)
    }
    console.log(`\n${filas.join('\n')}\n`)

    // LA DIAGONAL: cada geometría cocina en el montaje que declara. Es lo que hace
    // que la ventana por geometría no sea una cuenta linda sino la cuenta correcta.
    for (const g of todas) {
      expect(veredictos.get(`${g.montaje}/${g.montaje}`), `${g.montaje} no cocinó en su propio montaje`).toBe('cocina')
    }
    // Y FUERA DE LA DIAGONAL nada cocina, que es la otra mitad: si cocinara igual en
    // cualquier lado, tener una fila por geometría sería decorado.
    const fuera: string[] = []
    for (const g of todas) {
      for (const m of MONTAJES_DEL_MUNDO) {
        if (m === g.montaje) continue
        const v = veredictos.get(`${g.montaje}/${m}`)
        if (v === 'cocina') fuera.push(`el fuego de «${g.montaje}» también cocina en «${m}»`)
      }
    }
    expect(fuera).toEqual([])
    // Y falla por las DOS puntas y no siempre por la misma: más exposición que la de
    // su fila quema, menos se queda corto. `EXPOSICION` ordena piso < parrilla <
    // contacto, así que el veredicto tiene que seguir ese orden.
    expect(veredictos.get('parrilla/piso')).toBe('corto')
    expect(veredictos.get('parrilla/contacto')).toBe('QUEMA')
    expect(veredictos.get('contacto/piso')).toBe('corto')
    expect(veredictos.get('contacto/parrilla')).toBe('corto')
    expect(veredictos.get('piso/parrilla')).toBe('QUEMA')
    expect(veredictos.get('piso/contacto')).toBe('QUEMA')
  })
})

// ─── EL HUECO DEL FUEGO QUE SE APAGA, ACOTADO POR LOS DOS LADOS ────────────
//
// El `it.fails` de arriba dice que la fila del contacto no cumple en el peor caso.
// Un `it.fails` solo es información pobre: no dice si falla por poco o por todo, ni
// si la cadena del Hito 5 se cae con él. Acá se acota, y las dos cotas son verdes.

describe('el fuego de contacto se apaga: qué cocina igual y qué no', () => {
  /** Cuántos segundos tarda esta sustancia, o `Infinity` si no llega. */
  function tardanza(potencia: number, sustancia: string): { readonly s: number; readonly dig: number } {
    const at: Placement = { x: 0, y: 0 }
    const otra: Placement = { x: 1, y: 0 }
    const fuego: Body = {
      ...cuerpoDe('fuego', 'madera', lenaQueEmite(potencia), 'vara'),
      state: { temperature: IGNICION_DE_PRUEBA },
    }
    const comida = cuerpoDe('comida', sustancia, MASA_DE_LA_COMIDA, 'bloque')
    let w: WorldState = {
      tick: 0,
      hz: HZ_DE_REFERENCIA,
      phys: PHYS,
      bodies: mapaDeCuerpos([
        { body: criatura(ANA, 1000), at: otra },
        { body: fuego, at },
        { body: comida, at, supportedBy: 'fuego' },
      ]),
      actors: mapaDeActores([{ id: ANA, body: `${ANA}-cuerpo`, holding: [], capacity: 6, permits: 'irreversible' }]),
      cells: new Map<CellKey, CellState>(),
      desplegados: new Map(),
    nextId: 1,
    }
    // Cuatro veces el `mientras` de la fila: darle exactamente `mientras` mediría
    // «no entró en el presupuesto», y lo que hay que distinguir es «tarda más» de
    // «no llega nunca porque el fuego se apagó».
    const limite = Math.ceil(SEGUNDOS_DE_COCCION * 4 * HZ_DE_REFERENCIA)
    let t = 0
    let dig = 0
    while (t < limite) {
      w = stepWorld(w, []).state
      t++
      const c = w.bodies.get('comida')
      if (c === undefined) break
      dig = qualityOf(c.body, 'digestibility', w.phys)
      if (dig >= 0.85) return { s: t / HZ_DE_REFERENCIA, dig }
    }
    return { s: Number.POSITIVE_INFINITY, dig }
  }

  it('cinco de las seis carnosas cocinan igual, y EL PESCADO —el del Hito 5— es una de ellas', () => {
    const contacto = GEOMETRIAS_DE_LA_COCCION.find((g) => g.montaje === 'contacto')
    if (contacto === undefined) throw new Error('no está la geometría del contacto')
    const filas: string[] = []
    const nollegan: string[] = []
    for (const sustancia of sustanciasDelTag('carnoso')) {
      const r = tardanza(contacto.minima, sustancia)
      filas.push(
        `  ${sustancia.padEnd(10)} ${Number.isFinite(r.s) ? `${r.s.toFixed(2)} s` : 'NO LLEGA'.padStart(7)} · ` +
          `digestibility ${num(r.dig)}`,
      )
      if (!Number.isFinite(r.s)) nollegan.push(sustancia)
    }
    // Y el mismo fuego a mitad de ventana, que es la cota de arriba del hueco.
    const medio = (contacto.minima + contacto.maxima) / 2
    const conMedio = tardanza(medio, 'molusco')
    console.log(
      `\n── EL FUEGO DE CONTACTO EN SU BORDE DE ABAJO (${contacto.minima.toFixed(2)}) ${'─'.repeat(14)}\n` +
        filas.join('\n') +
        `\n  el mismo molusco con el fuego a mitad de ventana (${medio.toFixed(2)}): ` +
        `${Number.isFinite(conMedio.s) ? `${conMedio.s.toFixed(2)} s` : 'NO LLEGA'}\n`,
    )
    // La cota de abajo del hueco: es UNO solo, y es el más duro del tag.
    expect(nollegan).toEqual(['molusco'])
    // La cota que importa para el criterio del Hito 5: lo que la criatura pesca.
    expect(Number.isFinite(tardanza(contacto.minima, 'pescado').s)).toBe(true)
    // Y la cota de arriba: no es que la geometría no sirva, es que el borde de abajo
    // está mal puesto. Con más fuego —dentro de la MISMA ventana— el molusco cocina.
    expect(Number.isFinite(conMedio.s)).toBe(true)
  })
})

// ─── EL BARRIDO DE GEOMETRÍAS, LEÍDO ENTERO ────────────────────────────────
//
// La tabla no elige el montaje: barre `MONTAJES` por las distancias y se queda con
// lo que se puede armar. Acá se imprime el barrido completo —las que entraron y las
// que no, con su porqué— y se cruzan las dos afirmaciones que lo sostienen: que la
// ventana de cada geometría es la que el motor contesta, y que el descarte es por
// vocabulario de pasos y no por física.

describe('el barrido de geometrías: qué se eligió, qué se descartó y con qué número', () => {
  it('las que entran son las que una PILA puede armar, a distancia 0, y cada ventana la contesta el motor', () => {
    expect(GEOMETRIAS_DE_LA_COCCION.map((g) => g.montaje).sort()).toEqual(['contacto', 'parrilla'])
    for (const g of GEOMETRIAS_DE_LA_COCCION) expect(g.distancia).toBe(0)
    // La ventana no se transcribe: se le pregunta a la ley 1 dónde cae cada punta.
    // El piso de la ventana deja la comida en el PUNTO MEDIO de su ventana de
    // cocción, y el techo justo en el `ignitionPoint` más bajo del tag.
    const medio = (VENTANA_CARNOSA.piso + VENTANA_CARNOSA.techo) / 2
    for (const g of GEOMETRIAS_DE_LA_COCCION) {
      expect(temperaturaDeEquilibrio(g.minima, g.distancia, g.montaje)).toBeCloseTo(medio, 9)
      expect(temperaturaDeEquilibrio(g.maxima, g.distancia, g.montaje)).toBeCloseTo(VENTANA_CARNOSA.techo, 9)
    }
    console.log(
      `\n── EL BARRIDO DE GEOMETRÍAS ${'─'.repeat(40)}\n` +
        GEOMETRIAS_DE_LA_COCCION.map(
          (g) =>
            `  ✓ ${g.montaje.padEnd(9)} d=${String(g.distancia)}  pila [${g.pila.join(' > ')}]  ` +
            `fuego [${g.minima.toFixed(4)} ; ${g.maxima.toFixed(4)})`,
        ).join('\n') +
        '\n' +
        GEOMETRIAS_DESCARTADAS.map(
          (g) =>
            `  ✗ ${g.montaje.padEnd(9)} d=${String(g.distancia)}  ` +
            `fuego [${g.minima.toFixed(4)} ; ${g.maxima.toFixed(4)})  · ${g.porque}`,
        ).join('\n') +
        '\n',
    )
  })

  it('lo descartado se descarta por el VOCABULARIO, y el mundo sí lo permitiría', () => {
    // La distinción importa para el Hito 8: si el descarte fuera físico, no habría
    // nada que pedirle a nadie. Es de VOCABULARIO —lo que `pila` y `Ref` saben
    // decir— y por eso cada motivo nombra qué no se puede escribir. La prueba de que
    // el mundo lo permitiría es doble: la ley 1 contesta una temperatura
    // perfectamente razonable para las nueve combinaciones, y la matriz de arriba
    // corre la del piso EN EL MUNDO y cocina.
    expect(GEOMETRIAS_DESCARTADAS.length).toBe(7)
    for (const g of GEOMETRIAS_DESCARTADAS) {
      expect(Number.isFinite(temperaturaDeEquilibrio(g.minima, g.distancia, g.montaje))).toBe(true)
    }
    // Las tres del PISO —a cualquier distancia— se descartan porque una pila es una
    // lista de apoyos y `piso` es la ausencia de apoyo.
    const porApoyo = GEOMETRIAS_DESCARTADAS.filter((g) => g.montaje === 'piso')
    expect(porApoyo.length).toBe(3)
    for (const g of porApoyo) expect(g.porque).toContain('AUSENCIA de apoyo')
    // Y las cuatro de `contacto` y `parrilla` a distancia, por lo simétrico: apoyarse
    // es estar en la misma celda, así que esas filas no existen ni en el mundo.
    const porCelda = GEOMETRIAS_DESCARTADAS.filter((g) => g.montaje !== 'piso')
    expect(porCelda.length).toBe(4)
    for (const g of porCelda) {
      expect(g.distancia).toBeGreaterThan(0)
      expect(g.porque).toContain('misma celda')
    }
  })

  it('de las dos ventanas que la tabla arma, sólo UNA se puede encender frotando — y la otra dice por qué', () => {
    // El resultado que reordena el problema, medido contra el catálogo: la yesca que
    // haría falta para la parrilla NO ENTRA EN EL TANQUE de aliento. Nadie eligió el
    // contacto: quedó solo.
    expect(YESCAS_DE_COCINA.length).toBe(1)
    expect(YESCAS_IMPOSIBLES.length).toBe(GEOMETRIAS_DE_LA_COCCION.length - 1)
    for (const y of YESCAS_IMPOSIBLES) expect(y.porque).toContain('no entra en el tanque')

    // Y la banda que sí entra se verifica CONTRA EL MOTOR, no contra el despeje: se
    // arman los cuatro cuerpos de las esquinas (las dos puntas de la masa por las dos
    // del poder calorífico), se los prende, y se les pregunta `emitsPower`.
    const esquinas: string[] = []
    for (const s of COMBUSTIBLES_DE_FROTAR) {
      for (const masa of [YESCA_DE_COCINA.masaMin, YESCA_DE_COCINA.masaMax]) {
        const b: Body = { ...cuerpoDe('yesca', s.id, masa, 'vara'), state: { temperature: IGNICION_DE_PRUEBA } }
        const p = qualityOf(b, 'emitsPower', PHYS)
        const c = qualityOf(b, 'heatCapacity', PHYS)
        esquinas.push(`  ${s.id.padEnd(12)} ${num(masa)} kg → emitsPower ${num(p)} · heatCapacity ${num(c)}`)
        // El piso se cumple con `>=` y el techo con `<`: la fila pide `mass < masaMax`,
        // así que en el borde de arriba se admite la igualdad de la potencia.
        expect(p).toBeGreaterThanOrEqual(YESCA_DE_COCINA.minima)
        expect(p).toBeLessThanOrEqual(YESCA_DE_COCINA.maxima)
      }
    }
    // Y que la yesca ENTRE en el tanque es la otra mitad: el precio de frotar es
    // `heatCapacity × ΔT / eficiencia`, y por eso la fila la topa en 0,9.
    const masaChica = YESCA_DE_COCINA.masaMin
    const laMasBarata = COMBUSTIBLES_DE_FROTAR.map((s) =>
      qualityOf(cuerpoDe('y', s.id, masaChica, 'vara'), 'heatCapacity', PHYS),
    ).reduce((a, b) => (a < b ? a : b), Number.POSITIVE_INFINITY)
    console.log(
      `\n── LA YESCA DE COCINA, MEDIDA CONTRA EL MOTOR ${'─'.repeat(22)}\n` +
        `  ventana [${YESCA_DE_COCINA.minima.toFixed(4)} ; ${YESCA_DE_COCINA.maxima.toFixed(4)}) → ` +
        `fuelEnergy [${String(YESCA_DE_COCINA.fuelEnergyMin)} ; ${String(YESCA_DE_COCINA.fuelEnergyMax)}] · ` +
        `masa [${YESCA_DE_COCINA.masaMin.toFixed(4)} ; ${YESCA_DE_COCINA.masaMax.toFixed(4)})\n` +
        esquinas.join('\n') +
        `\n  la más barata de encender cuesta heatCapacity ${num(laMasBarata)} contra el techo 0,9\n` +
        YESCAS_IMPOSIBLES.map((y) => `  ✗ ${y.geometria.montaje}: ${y.porque}`).join('\n') +
        '\n',
    )
    expect(laMasBarata).toBeLessThanOrEqual(0.9)
  })
})

// ─── La novena verificación: la condición DE CELDA del pozo ─────────────────

describe('el `cellHints` de `extraccion`, medido contra el terreno que decreta el dios', () => {
  /**
   * ES LA ÚNICA FILA DE LA TABLA QUE LE PIDE ALGO AL LUGAR, y como todo lo demás
   * de este archivo, su respaldo no es un argumento: es una medición.
   *
   * El esquema dice «el `source` de una extracción está en agua franca». Lo dice
   * porque `mass > 0` —lo único que el proceso exige en cualidades de cuerpo— no
   * distingue un banco de peces de un canto rodado, y el planificador desempata
   * por cercanía: una piedra a una celda le ganaba al río a ocho, el plan salía
   * verde y el mundo contestaba `sin-pozo`.
   *
   * Lo que se mide acá son las dos poblaciones que el umbral tiene que separar:
   * la celda del pozo y la orilla seca de al lado, sobre los pozos que la semilla
   * de este archivo decreta de verdad.
   */
  it('el agua franca y la tierra donde se para la criatura caen de los dos lados del umbral', () => {
    const dios = crearDios(SEMILLA)
    const filas: string[] = []
    let mojadas = 0
    for (let cx = -6; cx <= 6 && filas.length < 8; cx++) {
      for (let cy = -6; cy <= 6 && filas.length < 8; cy++) {
        const dec = decretoDe(dios, PHYS, cx, cy)
        if (dec.pozo === undefined) continue
        const at = dec.pozo.at
        const enElPozo = celdaDecretada(dios, PHYS, at.x, at.y).wet
        filas.push(`${idDePozo(cx, cy)} en (${String(at.x)},${String(at.y)}): wet ${enElPozo.toFixed(4)}`)
        expect(enElPozo).toBeGreaterThanOrEqual(AGUA_FRANCA)
        mojadas++
      }
    }
    // LA OTRA POBLACIÓN, y hay que ir a buscarla: el 88,8% de los chunks de
    // `agua-dulce` está enteramente inundado, así que los ocho primeros pozos
    // tienen agua franca hasta en los vecinos. La celda que importa es la SECA
    // desde la que se pesca, que es la que `buscarOrilla` sale a encontrar — la
    // misma que usan las ocho filas de la tabla de arriba para montar el mundo.
    const o = orilla()
    const enLaOrilla = celdaDecretada(dios, PHYS, o.parada.x, o.parada.y).wet
    filas.push(`la orilla desde la que se pesca (${String(o.parada.x)},${String(o.parada.y)}): wet ${enLaOrilla.toFixed(4)}`)
    console.log(['', `── EL POZO ESTÁ EN EL AGUA ${'─'.repeat(40)}`, ...filas.map((f) => `  ${f}`)].join('\n'))
    expect(mojadas).toBeGreaterThanOrEqual(6)
    // Y ésta es la que hace que el umbral separe algo: si todo fuera agua franca,
    // la condición no descartaría a nadie y la fila sería decorativa. La criatura
    // pesca parada en tierra, y una piedra tirada a sus pies no califica de pozo.
    expect(enLaOrilla).toBeLessThan(AGUA_FRANCA)
  })

  it('la fila de la pesca es la única con `cellHints`, y pide exactamente eso', () => {
    // La cota es «una y sólo una»: una fila nueva con condición de celda entra
    // acá, y entra sin verificación si nadie mira. Ésta mira.
    const conCelda = ESQUEMAS.filter((e) => e.cellHints !== undefined)
    expect(conCelda.map((e) => e.establishes)).toEqual(['holding(tag:carnoso)'])
    const pesca = conCelda[0]
    if (pesca === undefined) throw new Error('no está la fila de la pesca')
    expect(pesca.cellHints).toEqual({ source: [{ q: 'wet', op: '>=', v: AGUA_FRANCA }] })
    // Y la celda se le pide al rol que el `drawFromStock` nombra como `of`, que es
    // de donde el mundo saca el stock. Eso sale del catálogo y no de la fila.
    if (pesca.k !== 'proceso') throw new Error('la fila de la pesca dejó de ir por un proceso')
    const y = procesoDe(pesca.via).completion?.yields.find((z) => z.k === 'drawFromStock')
    if (y === undefined || y.k !== 'drawFromStock') throw new Error('`extraccion` dejó de sacar de un stock')
    expect(Object.keys(pesca.cellHints ?? {})).toEqual([baseRoleName(y.of)])
  })
})

// ─── La décima verificación: qué separa al pozo de lo demás ─────────────────

describe('las condiciones del `source` de `extraccion`, medidas contra el banco que decreta el dios', () => {
  /**
   * LA SEGUNDA CONDICIÓN DEL POZO, Y LA QUE CIERRA LO QUE `wet` DEJABA ABIERTO.
   *
   * `wet >= 0,9` descarta las piedras de la orilla y NO descarta lo que la criatura
   * lleva en la mano cuando pesca metida en el agua: un cuerpo agarrado viaja en la
   * celda de quien lo agarra, así que cumple la condición de celda igual que el
   * banco — y encima le gana, porque `candidatosPara` prefiere lo que ya está en la
   * mano. Eso es exactamente lo que la corrida del criterio midió: 196 rechazos
   * `sin-pozo` en 6300 ticks, con el `source` ligado a lo que tenía agarrado.
   *
   * La condición que falta es que **el pozo no entra en una mano**, y `portable` no
   * es una cualidad elegida entre varias que sirvieran: es LA MISMA con la que el
   * mundo rechaza un `take` (`no-portable`, `world/src/step.ts`). Lo que se mide
   * acá son las dos poblaciones que separa, sobre el banco de verdad y sobre la
   * pieza que ese banco rindió en esta misma corrida — no sobre cuerpos de molde.
   */
  it('el banco no entra en una mano y la pieza que rinde sí: las dos poblaciones, medidas', () => {
    const pescar = ESQUEMAS.find((e) => e.establishes === 'holding(tag:carnoso)')
    if (pescar === undefined) throw new Error('no está el esquema de la pesca')
    const r = resultadoDe(pescar)
    const w = r.w
    if (w === undefined) throw new Error('la fila de pescar no corrió')
    const o = orilla()
    const banco = w.bodies.get(idDePozo(o.cx, o.cy))
    if (banco === undefined) throw new Error('el mundo no materializó el banco del dios')
    const pieza = r.nacidos.map((id) => w.bodies.get(id)).find((c) => c !== undefined)
    if (pieza === undefined) throw new Error('la fila de pescar no sacó ninguna pieza: no hay con qué comparar')

    const masaBanco = qualityOf(banco.body, 'mass', w.phys)
    const masaPieza = qualityOf(pieza.body, 'mass', w.phys)
    const portableBanco = qualityOf(banco.body, 'portable', w.phys)
    const portablePieza = qualityOf(pieza.body, 'portable', w.phys)
    // Cuántas piezas le quedan al banco antes de que deje de calificar. Es el
    // PRECIO de la condición, y se dice: las últimas piezas de un pozo casi vacío
    // se vuelven inalcanzables. Sale de una división y no de una estimación.
    const piezas = masaBanco / masaPieza
    const piezasQueSeRegalan = Math.floor(MASA_QUE_NO_ENTRA_EN_LA_MANO / masaPieza)

    console.log(
      `\n── EL POZO NO ENTRA EN UNA MANO ${'─'.repeat(35)}\n` +
        `  el banco ${banco.body.id}: mass ${num(masaBanco)} kg → portable ${num(portableBanco)}\n` +
        `  la pieza ${pieza.body.id} que rindió: mass ${num(masaPieza)} kg → portable ${num(portablePieza)}\n` +
        `  el umbral del catálogo (despejado de \`portable\`): ${num(MASA_QUE_NO_ENTRA_EN_LA_MANO)} kg\n` +
        `  el banco tiene ${piezas.toFixed(1)} piezas, y esta condición le regala las últimas ` +
        `${String(piezasQueSeRegalan)} (${((100 * piezasQueSeRegalan) / piezas).toFixed(1)}%)\n`,
    )

    // Las dos poblaciones, de los dos lados del escalón.
    expect(portableBanco).toBeLessThanOrEqual(PISO_DE_PORTABLE)
    expect(portablePieza).toBeGreaterThan(PISO_DE_PORTABLE)
    // Y que el escalón separe algo de verdad y no por un pelo.
    expect(masaBanco).toBeGreaterThan(MASA_QUE_NO_ENTRA_EN_LA_MANO * 2)
    expect(masaPieza).toBeLessThan(MASA_QUE_NO_ENTRA_EN_LA_MANO / 2)
  })

  it('el umbral es el del MUNDO: el mundo rechaza levantar el banco con `no-portable`', () => {
    // ─── LO QUE VUELVE EXACTA A UNA CONDICIÓN QUE PARECE UNA APROXIMACIÓN ────
    //
    // «El pozo no entra en la mano» suena a proxy de «el pozo es grande». No lo es:
    // `portable` es la MISMA cualidad con la que `intencionTomar` rebota un `take`,
    // así que **todo lo que una criatura pudo levantar tiene `portable > 0` por
    // construcción del mundo**. Pedirle al `source` que no sea portátil no descarta
    // «el pescado»: descarta la mano ENTERA.
    //
    // Y no se afirma leyendo el código del mundo: se le pide al mundo que levante
    // el banco y se mira con qué motivo dice que no.
    const pescar = ESQUEMAS.find((e) => e.establishes === 'holding(tag:carnoso)')
    if (pescar === undefined) throw new Error('no está el esquema de la pesca')
    const r = resultadoDe(pescar)
    const w = r.w
    if (w === undefined) throw new Error('la fila de pescar no corrió')
    const o = orilla()
    const idBanco = idDePozo(o.cx, o.cy)
    const conTake = stepWorld(w, [take({ by: ANA, seq: 99_999 }, idBanco)])
    const motivos = conTake.events.filter((ev) => ev.k === 'rechazada').map((ev) => ev.por)
    console.log(
      `\n  \`take(${idBanco})\` → el mundo contesta: ${motivos.join(', ') || '(no lo rechazó)'}\n`,
    )
    expect(motivos).toContain('no-portable')
  })

  it('la fila de la pesca es la única con `roleNoDeLaMano`, y se lo pide al rol del `drawFromStock`', () => {
    // Misma cota que la de `cellHints`: una fila nueva con condición de las que no
    // se fabrican entra acá, y entra sin verificación si nadie mira.
    const conMano = ESQUEMAS.filter((e) => e.roleNoDeLaMano !== undefined)
    expect(conMano.map((e) => e.establishes)).toEqual(['holding(tag:carnoso)'])
    const pesca = conMano[0]
    if (pesca === undefined) throw new Error('no está la fila de la pesca')
    // Y se le pide al MISMO rol que el `drawFromStock` nombra como `of`: es de donde
    // el mundo saca el stock, y sale del catálogo y no de la fila.
    if (pesca.k !== 'proceso') throw new Error('la fila de la pesca dejó de ir por un proceso')
    const y = procesoDe(pesca.via).completion?.yields.find((z) => z.k === 'drawFromStock')
    if (y === undefined || y.k !== 'drawFromStock') throw new Error('`extraccion` dejó de sacar de un stock')
    expect([...(pesca.roleNoDeLaMano ?? [])]).toEqual([baseRoleName(y.of)])
  })

  it('NINGUNA fila declara ya `roleFilters`, y el umbral que la fila usaba sigue siendo el del mundo', () => {
    // ─── LA CONDICIÓN QUE SE SACÓ, Y POR QUÉ SE MIDE IGUAL ──────────────────
    //
    // La fila de la pesca declaraba `roleFilters: {source: [portable<=0]}`. El
    // argumento era correcto de un lado —todo lo que la criatura pudo levantar
    // tiene `portable > 0`, así que la condición descarta la mano entera— y falso
    // del otro: descarta ADEMÁS todo cuerpo de menos de 8 kg, y los bancos que el
    // dios decreta casi siempre pesan menos. Once de las veinte partidas del banco
    // de la emergencia se quedaban sin un solo banco elegible, y en esas once la
    // criatura no tiraba la caña una sola vez (`emergencia/tests/ataque-al-tramo-i.test.ts`,
    // bloque 3). Los dos `it` de arriba de este mismo `describe` siguen midiendo lo
    // que de esa condición ERA cierto —el escalón separa el banco de su pieza, y el
    // mundo rechaza el `take` con `no-portable`—, así que lo único que hace falta
    // acá es no perder los dos números derivados ni dejar que el campo vuelva sin
    // que nadie mire.
    expect(ESQUEMAS.filter((e) => e.roleFilters !== undefined)).toEqual([])
    // El umbral no está escrito en el paquete: sale de la expresión derivada de
    // `portable`, y esto lo cruza contra el motor evaluándola.
    expect(NO_ENTRA_EN_LA_MANO.v).toBe(specOf('portable').range[0])
    expect(MASA_QUE_NO_ENTRA_EN_LA_MANO).toBe(8)
  })
})
