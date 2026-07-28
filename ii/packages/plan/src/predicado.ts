// ─── @anima/plan/predicado.ts ────────────────────────────────────────────────
//
// EL TEXTO QUE UN PROCESO PROMETE, INTERPRETADO — Y LO QUE NO SE ENTIENDE, DICHO.
//
// El parser de promesas de la puerta (`admit.ts`) descarta en silencio lo que no
// entiende, y para la puerta eso está bien: una promesa ilegible no se puede
// premiar, así que no promete nada y listo. Acá es exactamente al revés, y por
// eso este módulo existe: el planificador NECESITA las dos promesas que aquel
// parser tira —`freeStrandEnds>=1`, que es una función geométrica y no una
// cualidad, y `holding(tag:carnoso)`, que ni siquiera tiene operador— porque son
// justo las dos sobre las que se apoya la pesca. Un índice que sólo indexara lo
// que la puerta entiende quedaría vacío donde importa.
//
// De ahí la regla de este archivo: `interpretar` devuelve `undefined` y NO
// silencia. Quien llama decide qué hacer con lo que no se entiende — el índice de
// esquemas lo puede rechazar al construirse, la regresión lo puede reportar como
// `gap`. Descartar en silencio es tomar esa decisión por ellos y sin decirlo.
//
// ─── LAS TRES FORMAS, Y POR QUÉ NO HAY UNA CUARTA ───────────────────────────
//
//   cualidad  `temperature>=400`  — un `QualityTest` pelado, del catálogo cerrado.
//   geometria `freeStrandEnds>=1` — una de las tres `GeomFn`, que NO son cualidades.
//   sostiene  `holding(tag:carnoso)` — no habla de un cuerpo: habla de la MANO.
//
// `reach>=2` es de la PRIMERA y no de la segunda, y ésa es la trampa entera del
// vocabulario: `reach` es una de las 29 cualidades del catálogo (derivada, sí,
// pero cualidad), mientras `longestAxis` —la función geométrica que la calcula—
// no lo es. Quien las separe con una lista escrita a mano se equivoca el día que
// la física mueva una de un lado al otro; acá la separación sale de preguntarle
// al catálogo del motor, que es la única fuente que no se puede desincronizar.
//
// ─── DETERMINISMO ───────────────────────────────────────────────────────────
//
// Ningún orden de este archivo depende de una comparación sensible al idioma: las
// firmas se ordenan por unidades de código con `<` y `>`, que es un orden TOTAL y
// el mismo en toda máquina. Y el desempate no hace falta porque las claves son
// distintas entre sí: dos cláusulas iguales colapsan antes de ordenar.

import type { BodyView } from '@anima/skills'
import type { ExprContext, GeomFn, QualityExpr, QualityId, QualityTest } from '@anima/physics'
import { QUALITY_IDS, TAGS, evalQuality, specOf } from '@anima/physics'

import type { Comparador, Predicado, PredicateSignature, VistaDelPlan } from './tipos.js'

/** Cómo se lee una cualidad de un cuerpo VISTO. Es `Ctx.q`, y por eso llega el motor. */
type Lector = (b: BodyView, q: QualityId) => number

// ─── El vocabulario, preguntado y no transcripto ────────────────────────────

/**
 * Los operadores, del más largo al más corto para que `>=` gane antes que `>`.
 *
 * Los dos de matemática (`≥`, `≤`) están por el mismo ataque que se los agregó a
 * la puerta —«charlatán-unicode»—: un `establishes` escrito con el signo lindo
 * dejaba de parsear, y lo que no parsea «no promete nada». Acá el daño sería otro
 * y peor: dos escrituras del MISMO predicado darían dos firmas distintas, o sea
 * dos entradas en el índice, o sea un esquema que nadie encuentra. Aceptarlos y
 * normalizarlos a la forma ASCII cierra las dos puertas de una.
 */
const OPERADORES: readonly { readonly texto: string; readonly op: Comparador }[] = [
  { texto: '>=', op: '>=' },
  { texto: '<=', op: '<=' },
  { texto: '≥', op: '>=' },
  { texto: '≤', op: '<=' },
  { texto: '>', op: '>' },
  { texto: '<', op: '<' },
]

/**
 * Las tres funciones geométricas, como registro EXHAUSTIVO y no como arreglo.
 *
 * La diferencia no es de estilo: un `readonly GeomFn[]` con dos de las tres
 * compila igual de bien, y el día que la física agregue una cuarta nadie se
 * entera. Un `Record<GeomFn, true>` al que le falte una clave NO compila. Es el
 * mismo trato que `@anima/skills` le da a la unión de los cuatro procesos: lo que
 * no se puede derivar en tipos, se clava con un tipo que rompe al divergir.
 */
const FUNCIONES_GEOM: Readonly<Record<GeomFn, true>> = {
  longestAxis: true,
  freeStrandEnds: true,
  jointCount: true,
}

/**
 * Qué CUALIDAD del catálogo es un alias exacto de qué función geométrica.
 *
 * Sale del catálogo y no de una tabla mía: una cualidad cuya expresión derivada
 * es LITERALMENTE `geom(f)` —sin sumas, sin productos, sin nada alrededor— es esa
 * función geométrica con otro nombre, y preguntarla por su nombre de cualidad da
 * el mismo número. Hoy da una sola fila, `longestAxis → reach`, y esa fila es la
 * que hace contestable `longestAxis>=2` desde una vista.
 *
 * `catch` NO entra, y es el punto: su expresión es un PRODUCTO de
 * `geom(freeStrandEnds)` por un factor que depende de `maxParts(sharpness)`, así
 * que no es un alias sino una función de dos cosas. Despejar la primera exige la
 * segunda, y la segunda no está en la superficie. Ver `geomDeVista`.
 */
const ALIAS_DE_GEOM: ReadonlyMap<GeomFn, QualityId> = (() => {
  const m = new Map<GeomFn, QualityId>()
  // `QUALITY_IDS` viene en el orden del catálogo, que es fijo; si algún día dos
  // cualidades fueran alias de la misma función, gana la primera y el resultado
  // no depende de cómo se construyó ningún mapa.
  for (const id of QUALITY_IDS) {
    const e = specOf(id).derived
    if (e === undefined || e.k !== 'geom') continue
    if (!m.has(e.f)) m.set(e.f, id)
  }
  return m
})()

const PREFIJO_SOSTIENE = 'holding(tag:'
const CIERRE_SOSTIENE = ')'

/**
 * Cómo se separan el tag y sus condiciones adentro del paréntesis.
 *
 * NO es `&`, y ésa es toda la razón por la que hay una constante acá en vez de un
 * literal: `firmaDe` parte el texto crudo por `&` ANTES de interpretar nada —tiene
 * que hacerlo, es lo que junta `'catch>0 & reach>=2'` con `'reach>=2&catch>0'`— así
 * que un `holding(tag:carnoso&toxicity<=0.2)` llegaría acá partido en dos trozos
 * ilegibles, `'holding(tag:carnoso'` y `'toxicity<=0.2)'`. La coma no aparece en
 * ningún `QualityId`, en ninguna `GeomFn` ni en ningún `Tag`, así que separa sin
 * poder confundir dos cosas distintas.
 */
const SEPARADOR_INTERNO = ','

function esCualidad(nombre: string): boolean {
  return (QUALITY_IDS as readonly string[]).includes(nombre)
}

function comoGeom(nombre: string): GeomFn | undefined {
  return Object.hasOwn(FUNCIONES_GEOM, nombre) ? (nombre as GeomFn) : undefined
}

// ─── Texto ──────────────────────────────────────────────────────────────────

/**
 * Los blancos NO son información en ninguna de las tres formas: ni un `QualityId`
 * ni una `GeomFn` ni un `Tag` tiene espacios adentro, así que borrarlos todos no
 * puede confundir dos cosas distintas y sí junta dos escrituras de la misma.
 *
 * Es un pelo más liberal que el parser de la puerta, que sólo recorta alrededor
 * del operador: acá `holding(tag: carnoso)` también entra. A propósito — el que
 * escribe un `establishes` es una persona o un modelo, no un compilador.
 */
function sinBlancos(s: string): string {
  return s.replace(/\s+/g, '')
}

/**
 * El número, en su forma canónica: la que le da el propio lenguaje.
 *
 * `0.80` y `.8` y `8e-1` son el mismo número y salen los tres como `0.8`, que es
 * justo lo que hace falta para que dos escrituras den la misma llave.
 */
function textoDeNumero(v: number): string {
  return String(v)
}

function compara(a: number, op: Comparador, v: number): boolean {
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

// ─── La vista como contexto de expresión ────────────────────────────────────

/**
 * QUÉ LE PUEDE CONTESTAR UNA `BodyView` AL EVALUADOR DEL MOTOR, MEDIDO.
 *
 * El motor calcula las derivadas con `evalQuality` sobre un `ExprContext`, y ese
 * contexto tiene cinco entradas. Desde una vista se pueden honrar dos y media:
 *
 *   own(q)        SÍ — es `ctx.q`, que río abajo termina en `qualityOf` sobre el
 *                 cuerpo de verdad. Preguntar por acá ES llamar al motor.
 *   geom(f)       LA MITAD — ver `geomDeVista`.
 *   sumParts(q)   NO — la vista no tiene partes.
 *   maxParts(q)   NO — ídem, y es la que falta para despejar `freeStrandEnds`.
 *   substance(f)  NO — la vista no tiene sustancia, tiene `name`, que es otra cosa.
 *
 * Las tres que no se pueden LANZAN en vez de devolver cero. Un cero es una
 * respuesta, y una respuesta inventada acá se convierte en una cualidad derivada
 * mal calculada que nadie va a poder rastrear cuarenta ticks después. Que lance
 * está bien porque los únicos nodos que este archivo evalúa son `geom`, y antes
 * de evaluarlos pregunta si se pueden: nunca se llega a las tres de abajo.
 */
function contextoDeVista(b: BodyView, q: Lector): ExprContext {
  const noHay = (que: string): never => {
    throw new RangeError(`la vista de un cuerpo no puede contestar ${que}`)
  }
  return {
    own: (id) => q(b, id),
    geom: (f) => {
      const v = geomDeVista(f, b, q)
      return v === undefined ? noHay(`geom(${f})`) : v
    },
    sumParts: () => noHay('sumParts'),
    maxParts: () => noHay('maxParts'),
    substance: () => noHay('substance'),
  }
}

/**
 * La geometría de un cuerpo VISTO, o `undefined` si desde la vista no se llega.
 *
 * ─── EL HALLAZGO, Y ES EL QUE DECIDE SI ESTE MÓDULO SIRVE ───────────────────
 *
 * El motor calcula las tres funciones en `geomOf(b: Body, …)`, que necesita
 * `form`, `parts` (con su masa y su sustancia) y `joints`. Una `BodyView` tiene
 * `joints` Y NADA MÁS de esa lista: ni forma, ni partes, ni masas. O sea que
 * «llamar al motor» para la geometría no es una opción desde acá, y la única
 * pregunta honesta es cuánto se salva igual:
 *
 *   jointCount      SE SALVA ENTERA. El motor devuelve `b.joints.length`, y la
 *                   vista trae las mismas juntas (`JointView` es `Joint` sin el
 *                   `via`, que no entra en la cuenta). No es una fórmula
 *                   paralela: es literalmente la misma expresión sobre el mismo
 *                   arreglo.
 *   longestAxis     SE SALVA POR ALIAS. `reach` está declarada en el catálogo
 *                   como `geom(longestAxis)` y nada más, así que `q(b,'reach')`
 *                   entra por `qualityOf` y sale de `geomOf`: es el motor
 *                   contestando, con el cuerpo de verdad del otro lado. Lo único
 *                   que se pierde es el recorte al rango de `reach` ([0,16]); un
 *                   eje más largo que 16 vuelve como 16, y ningún predicado de la
 *                   semilla se acerca.
 *   freeStrandEnds  NO SE SALVA. No hay ninguna cualidad que sea su alias: la
 *                   única que la usa es `catch`, y la usa multiplicada por
 *                   `0.15 + maxParts(sharpness)·0.5`. Para despejarla haría falta
 *                   `maxParts(sharpness)`, y la vista sólo sabe dar
 *                   `own(sharpness)`, que es el promedio PESADO POR MASA de las
 *                   partes — otro número. Medido sobre la caña con anzuelo de la
 *                   pesca: `maxParts(sharpness)` es 0,85 (el pedernal) y
 *                   `own(sharpness)` es 0,0653846…, así que despejar con el que
 *                   se puede leer da 3,1473684… puntas libres donde hay
 *                   exactamente 1.
 *
 * Y no se inventa una fórmula paralela para tapar el agujero: el hueco es de la
 * SUPERFICIE, no del cálculo, y taparlo acá lo volvería invisible justo donde hay
 * que arreglarlo. Está medido en `tests/el-predicado.test.ts` con dos `it.fails`.
 */
function geomDeVista(f: GeomFn, b: BodyView, q: Lector): number | undefined {
  if (f === 'jointCount') return b.joints.length
  const alias = ALIAS_DE_GEOM.get(f)
  return alias === undefined ? undefined : q(b, alias)
}

// ─── Las cinco del contrato ─────────────────────────────────────────────────

/**
 * El texto crudo de un `establishes`, normalizado a firma.
 *
 * Un `establishes` puede traer varias cláusulas unidas por `&` —la puerta las
 * parte igual, en `trozosDe`— y las dos escrituras `'catch>0 & reach>=2'` y
 * `'reach>=2&catch>0'` son el mismo predicado. Si dieran dos llaves, el índice
 * tendría dos entradas para una cosa y la regresión encontraría una de las dos
 * según cómo la escribió quien propuso el proceso.
 *
 * Tres normalizaciones, y cada una tiene su porqué:
 *
 *   1. cada cláusula se canoniza pasándola por `interpretar` + `textoDe`, así que
 *      `≥` y `>=` y `0.80` y `.8` colapsan. Lo que no se entiende se conserva
 *      —igual que hace la puerta—, sólo que sin blancos: es la única
 *      normalización posible sin interpretar, y no puede juntar dos cosas
 *      distintas porque ningún nombre del vocabulario tiene espacios.
 *   2. las repetidas colapsan. `'a & a'` y `'a'` dicen lo mismo.
 *   3. el orden es por unidades de código, que es total y no depende del idioma
 *      de la máquina.
 */
export function firmaDe(crudo: string): PredicateSignature {
  const partes: string[] = []
  for (const trozo of crudo.split('&')) {
    const s = trozo.trim()
    if (s.length === 0) continue
    const p = interpretar(s)
    const clave = p === undefined ? sinBlancos(s) : textoDe(p)
    if (!partes.includes(clave)) partes.push(clave)
  }
  partes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return partes.join('&')
}

/**
 * Texto crudo → `Predicado`. `undefined` si no se entiende, y eso NO es un
 * fracaso silencioso: quien llama tiene que decidir qué hacer con lo que no
 * entiende, que es justo lo que `parsePromesa` no hace.
 *
 * UNA cláusula, no varias: `Predicado` no tiene forma conjuntiva, así que
 * `'catch>0 & reach>=2'` no es un predicado sino dos y devuelve `undefined`. Cae
 * solo, sin caso especial: el `&` se lleva puesto al número y `Number` da `NaN`.
 */
export function interpretar(crudo: string): Predicado | undefined {
  const s = sinBlancos(crudo)

  // Primero la forma sin operador de PRIMER nivel. Si empieza y termina como
  // ella, es ella o no es nada: no tiene sentido caer al parser de operadores con
  // un `>` que estaría adentro del paréntesis.
  if (s.startsWith(PREFIJO_SOSTIENE) && s.endsWith(CIERRE_SOSTIENE)) {
    const adentro = s.slice(PREFIJO_SOSTIENE.length, s.length - CIERRE_SOSTIENE.length)
    const trozos = adentro.split(SEPARADOR_INTERNO)
    const tag = trozos[0]
    // Los tags son una enumeración CERRADA de la física, y se pregunta ahí. Un
    // `holding(tag:pescado)` no es un predicado con un tag nuevo: es alguien
    // confundiendo la sustancia con la superficie por la que las leyes la agarran.
    if (tag === undefined || !(TAGS as readonly string[]).includes(tag)) return undefined
    if (trozos.length === 1) return { k: 'sostiene', tag }
    const tests: QualityTest[] = []
    for (const t of trozos.slice(1)) {
      const p = conOperador(t)
      // Sólo CUALIDADES. Una geometría adentro del paréntesis se rechaza entera en
      // vez de descartarse en silencio: `freeStrandEnds` no se puede contestar desde
      // una vista (ver `geomDeVista`), así que un `holding(tag:x,freeStrandEnds>=1)`
      // sería una promesa que nadie puede verificar ni cumplir. Es la regla del
      // archivo: lo que no se entiende, se dice.
      if (p === undefined || p.k !== 'cualidad') return undefined
      tests.push(p.test)
    }
    return { k: 'sostiene', tag, tests }
  }

  return conOperador(s)
}

/**
 * Un `nombre OP valor` pelado. Es la mitad de `interpretar` que también necesita
 * la forma `sostiene` para leer lo de adentro del paréntesis, y está afuera para
 * que las dos lecturas sean LA MISMA —dos parsers de umbrales divergen, y el día
 * que uno acepte `≥` y el otro no, la misma firma daría dos llaves—.
 */
function conOperador(s: string): Predicado | undefined {
  for (const { texto, op } of OPERADORES) {
    const i = s.indexOf(texto)
    if (i < 0) continue
    const nombre = s.slice(0, i)
    const cola = s.slice(i + texto.length)
    if (nombre.length === 0 || cola.length === 0) return undefined
    const v = Number(cola)
    // `Number('')` es 0 y no `NaN`, así que sin el largo de arriba `'reach>='`
    // habría entrado como `reach>=0` — un predicado que cumple cualquier cosa.
    if (!Number.isFinite(v)) return undefined
    // El catálogo primero: `reach` es cualidad, no geometría. Si algún día una
    // `GeomFn` se llamara igual que una cualidad, gana la cualidad, que es la que
    // sabe contestar sola.
    if (esCualidad(nombre)) return { k: 'cualidad', test: { q: nombre as QualityId, op, v } }
    const f = comoGeom(nombre)
    return f === undefined ? undefined : { k: 'geometria', f, op, v }
  }
  return undefined
}

/**
 * El texto canónico de un predicado ya interpretado.
 *
 * Sin espacios, como escribe la puerta sus promesas canónicas. La ida y la vuelta
 * es el contrato que sostiene al índice: `textoDe(interpretar(x)!) === firmaDe(x)`
 * para todo `x` de una sola cláusula que se entienda, y hay un test que lo corre
 * sobre los seis trozos que promete la semilla.
 */
export function textoDe(p: Predicado): string {
  switch (p.k) {
    case 'cualidad':
      return `${p.test.q}${p.test.op}${textoDeNumero(p.test.v)}`
    case 'geometria':
      return `${p.f}${p.op}${textoDeNumero(p.v)}`
    case 'sostiene': {
      // Las condiciones se ORDENAN y se DEDUPLICAN acá, igual que `firmaDe` hace
      // con las cláusulas de una conjunción y por lo mismo: dos escrituras del
      // mismo predicado tienen que dar la misma llave, o el índice de esquemas
      // tiene dos entradas para una cosa. El orden es por unidades de código, que
      // es total y no depende del idioma de la máquina.
      const cond: string[] = []
      for (const t of p.tests ?? []) {
        const s = textoDe({ k: 'cualidad', test: t })
        if (!cond.includes(s)) cond.push(s)
      }
      cond.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      const cola = cond.length === 0 ? '' : SEPARADOR_INTERNO + cond.join(SEPARADOR_INTERNO)
      return `${PREFIJO_SOSTIENE}${p.tag}${cola}${CIERRE_SOSTIENE}`
    }
  }
}

/**
 * ¿CUMPLIR `a` GARANTIZA CUMPLIR `b`? El orden que el índice no tenía.
 *
 * ─── EL DEFECTO QUE ESTO ARREGLA, MEDIDO ────────────────────────────────────
 *
 * El índice de esquemas se compara por TEXTO —y tiene que seguir comparándose
 * así, por las dos promesas de la semilla que no parsean—, pero la regresión
 * preguntaba lo mismo con el mismo `includes` de texto, y de ahí salía esto:
 * `temperature>=400` tenía plan y `temperature>=399` era un `gap`, con los
 * mismos cuatro pasos sirviendo para los dos. Lo mismo con 300, 100 y 20. El
 * planificador sabía hacer exactamente los seis strings de la tabla y nada que
 * se les pareciera, y el `why` le decía a la fragua del Hito 8 que nadie sabe
 * calentar a 300 grados — que es falso y es el peor de los dos daños.
 *
 * Las tres formas de `Predicado` no son iguales frente a esto y por eso hay tres
 * ramas y no una:
 *
 *   cualidad / geometria  TIENEN ORDEN. `q >= 400` garantiza `q >= 399`, y
 *                         `q <= 0.9` garantiza `q <= 9`. Es la única fuente de
 *                         implicación que existe acá: dos cualidades distintas
 *                         nunca se implican, aunque una se derive de la otra —
 *                         `catch` sale de `freeStrandEnds` multiplicada por algo
 *                         que depende de `sharpness`, y despejarla necesita una
 *                         parte de la vista que no existe—.
 *   sostiene              EL TAG NO TIENE ORDEN, SUS CONDICIONES SÍ.
 *                         `holding(tag:carnoso)` y `holding(tag:organico)` son dos
 *                         tags de una enumeración plana; que uno «contenga» al
 *                         otro sería conocimiento sobre las sustancias y no sobre
 *                         los predicados. Lo que sí ordena son los umbrales de
 *                         adentro, y con la MISMA regla que las otras dos formas:
 *                         tener en la mano algo carnoso con `toxicity<=0.05`
 *                         garantiza tenerlo con `toxicity<=0.2`. Y va en la
 *                         dirección que hace falta y no en la otra —el que promete
 *                         MÁS condiciones implica al que pide MENOS—, que es lo
 *                         que hace que el esquema de la cocción conteste una meta
 *                         de comida sin que nadie escriba las dos firmas iguales.
 *
 * Reflexiva: `implica(p, p)` es verdadero para las tres, y ésa es la propiedad de
 * la que depende que este cambio no rompa nada de lo que ya andaba — la
 * comparación vieja era la igualdad de texto, y la igualdad de texto está adentro.
 */
export function implica(a: Predicado, b: Predicado): boolean {
  if (a.k === 'cualidad' && b.k === 'cualidad') {
    return a.test.q === b.test.q && cubreUmbral(a.test.op, a.test.v, b.test.op, b.test.v)
  }
  if (a.k === 'geometria' && b.k === 'geometria') {
    return a.f === b.f && cubreUmbral(a.op, a.v, b.op, b.v)
  }
  if (a.k === 'sostiene' && b.k === 'sostiene') {
    if (a.tag !== b.tag) return false
    const suyas = a.tests ?? []
    for (const pide of b.tests ?? []) {
      const cubierta = suyas.some(
        (t) => t.q === pide.q && cubreUmbral(t.op, t.v, pide.op, pide.v),
      )
      if (!cubierta) return false
    }
    return true
  }
  return false
}

/**
 * El orden entre dos umbrales sobre la MISMA magnitud.
 *
 * Dos reglas y nada más. La primera: los que miran para arriba (`>=`, `>`) y los
 * que miran para abajo (`<=`, `<`) no se implican nunca — no porque sea
 * imposible en la aritmética (`q <= -1` implica `q < 0` y también `q < 5`), sino
 * porque para saberlo haría falta el rango de la cualidad, y una implicación que
 * dependa del rango del catálogo es una que cambia cuando alguien recalibra.
 *
 * La segunda: contestarle a un pedido ESTRICTO con una promesa que no lo es
 * necesita un umbral estrictamente mejor. `q >= 0` no garantiza `q > 0` —el cero
 * lo cumple y no lo cumple— y ése es justo el caso que aparece en la semilla:
 * el puente promete `catch > 0`, así que un objetivo `catch > 0.0001` NO tiene
 * plan, y eso está bien. Lo que estaba mal era el mensaje.
 */
function cubreUmbral(opA: Comparador, vA: number, opB: Comparador, vB: number): boolean {
  const arriba = (o: Comparador): boolean => o === '>=' || o === '>'
  if (arriba(opA) !== arriba(opB)) return false
  const estricto = (o: Comparador): boolean => o === '>' || o === '<'
  const hayQueMejorar = estricto(opB) && !estricto(opA)
  if (arriba(opA)) return hayQueMejorar ? vA > vB : vA >= vB
  return hayQueMejorar ? vA < vB : vA <= vB
}

/**
 * ¿El mundo, tal como se ve HOY, cumple este predicado?
 *
 * `sostiene` mira la mano y las otras dos miran lo que se ve, y esa asimetría es
 * la razón de que `sostiene` sea una forma aparte y no una cualidad más: «tengo
 * carne en la mano» no es una propiedad de ningún cuerpo, es una relación entre
 * la criatura y un cuerpo. Un pescado tirado en la orilla no la cumple.
 *
 * El filtro se le pide al mundo cuando se puede —una cualidad ES un `Where`, y el
 * índice del mundo lo resuelve mejor que un barrido— y se hace acá cuando no. En
 * los dos casos la última palabra la tiene `cumpleCuerpo`: una sola definición de
 * «este cuerpo lo cumple», y no una acá y otra adentro de `see`.
 */
export function cumple(p: Predicado, v: VistaDelPlan): boolean {
  const q: Lector = (b, id) => v.q(b, id)
  if (p.k === 'sostiene') {
    for (const b of v.self.holding) if (cumpleCuerpo(p, b, q)) return true
    return false
  }
  // Una geometría no se puede escribir como `QualityTest`, así que ahí se pide
  // todo lo visible y se filtra. `[]` es «lo que veo», no «el mundo»: la vista ya
  // está acotada al radio de percepción del tick.
  const donde = p.k === 'cualidad' ? [p.test] : []
  for (const b of v.see(donde)) if (cumpleCuerpo(p, b, q)) return true
  return false
}

/**
 * ¿Este cuerpo en particular lo cumple?
 *
 * Las cualidades se preguntan con `q`, que es el motor con el cuerpo de verdad del
 * otro lado; las geometrías pasan por `evalQuality` del motor con el contexto de
 * arriba, y las que la superficie no puede contestar devuelven `false`.
 *
 * ─── POR QUÉ `false` Y NO UNA EXCEPCIÓN ─────────────────────────────────────
 *
 * Porque de los dos errores posibles, éste es el barato. Decir que no se cumple
 * algo que sí se cumple hace que el planificador vuelva a construir algo que ya
 * tiene: cuesta trabajo. Decir que se cumple algo que no, hace que la criatura
 * vaya al río con las manos vacías y no entienda por qué no pesca. Y una excepción
 * en el medio de la búsqueda voltea el tick de las 5000 criaturas por un
 * predicado mal escrito.
 *
 * Que sea el barato no lo vuelve gratis: con `holding(tag:carnoso)` sin contestar,
 * un objetivo de comida NUNCA se da por cumplido y el plan se rehace para siempre.
 * Por eso los dos huecos están medidos con `it.fails` y no comentados al pasar.
 */
export function cumpleCuerpo(p: Predicado, b: BodyView, q: Lector): boolean {
  switch (p.k) {
    case 'cualidad':
      return compara(q(b, p.test.q), p.test.op, p.test.v)
    case 'geometria': {
      const f = comoGeom(p.f)
      if (f === undefined) return false
      // Se pregunta ANTES de evaluar: adentro del contexto, lo que no se puede
      // lanza, y acá lo que no se puede es una respuesta y no un accidente.
      if (geomDeVista(f, b, q) === undefined) return false
      const expr: QualityExpr = { k: 'geom', f }
      return compara(evalQuality(expr, contextoDeVista(b, q)), p.op, p.v)
    }
    // EL SEGUNDO HUECO DE LA SUPERFICIE. Para contestar esto hay que saber de qué
    // sustancia está hecho el cuerpo y qué tags tiene esa sustancia, y una
    // `BodyView` no trae ninguna de las dos: trae `name`, que es una VISTA
    // (`nameOf`) armada con el léxico de la sustancia dominante más adjetivos de
    // cocción. Adivinar el tag desde el nombre sería reconstruir a mano lo que la
    // física ya sabe, y quedaría mal el día que el oráculo invente una carne que
    // se llame distinto — que es el día exacto para el que se hizo todo esto.
    //
    // ─── Y LAS CONDICIONES DE ADENTRO SÍ SE PODRÍAN CONTESTAR ────────────────
    //
    // `toxicity<=0.2` es una cualidad y `q` la sabe leer. No se contestan igual, y
    // no por comodidad: la forma es una CONJUNCIÓN —tag Y condiciones— y contestar
    // la mitad que se puede daría `true` sobre una piedra poco tóxica. De los dos
    // errores, decir que no se cumple algo que sí es el barato (ver arriba); decir
    // que se cumple algo que no manda a la criatura a comerse una piedra.
    case 'sostiene':
      return false
  }
}
