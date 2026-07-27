// ─── @anima/skills/aislamiento.ts ────────────────────────────────────────────
//
// LOS GLOBALS SOMBREADOS. La regla 2 de `ii/README.md` dicha en código:
//
//   «Ningún paquete determinista toca el reloj ni el azar del sistema.
//    `Math.random`, `Date`, `performance`, `Intl`, `localeCompare` y `Math`
//    trascendente están prohibidos. `Math.exp` y `Math.pow` NO TIENEN PRECISIÓN
//    ESPECIFICADA en ECMAScript: dos navegadores pueden devolver el último bit
//    distinto y el replay diverge en el tick 400.»
//
// En los paquetes que escribimos nosotros esa regla la vigila el lint. Acá no
// sirve: este código lo escribe un modelo en tiempo de partida y no pasa por
// ningún lint nuestro. Entonces la regla se hace cumplir de dos maneras, y hacen
// falta las dos porque ninguna sola alcanza:
//
//   1. POR ALCANCE (`shadowScope`). Los nombres prohibidos se atan como
//      parámetros de la función que envuelve al código generado, así que el
//      global queda tapado por alcance léxico. `Date` no existe, y no porque lo
//      hayamos borrado —no se toca nada global, y dos habilidades pueden tener
//      sombras distintas— sino porque adentro de ese alcance ese nombre ya está
//      ocupado.
//
//   2. POR ESCÁNER (`scanDeterminism`). Hay cosas que el alcance no puede tapar:
//      `x ** 2` es un OPERADOR, y `(1.5).toLocaleString()` y `a.localeCompare(b)`
//      son métodos de un prototipo, no nombres globales. Se detectan sobre el
//      AST, antes de compilar, y cuestan una fracción de milisegundo.
//
// El escáner corre ANTES que el typecheck en el orden del juez, porque es diez
// veces más barato y porque su mensaje es más útil: «`Date` no existe adentro
// del sandbox, usá `ctx.clock`» le dice al modelo qué escribir, y
// «Cannot find name 'Date'» le dice que se equivocó de lenguaje.
//
// ─── Por qué no alcanza con que el nombre sea `undefined` ───────────────────
//
// Alcanzaría para el determinismo: `new Date()` con `Date === undefined` tira
// «Date is not a constructor» y la habilidad muere. Pero muere sin decir qué
// hacer en su lugar, y el bucle de reparación del Hito 8 se come un viaje al
// modelo para descubrir algo que ya sabíamos. Por eso las sombras son objetos
// que LANZAN CON INSTRUCCIONES, y la instrucción es siempre la misma forma:
// «esto no existe acá; lo que querés está en `ctx.…`».
//
// La contra de esa decisión, dicha entera: una sombra que lanza SÍ EXISTE para
// `typeof`, así que `typeof fetch !== 'undefined'` da verdadero y el código
// entra a una rama que después explota. Se acepta a sabiendas, porque el caso
// que ese patrón intenta cubrir —«si hay reloj, medí»— es justamente el que no
// queremos que exista: preferimos que reviente con un mensaje que enseña antes
// que dejarlo tomar un camino alternativo que el mundo no puede reproducir.

import type * as TS from 'typescript'
import { FUEL_PREFIX, type ApiTS } from './combustible.js'

/** Lo que se rompió al querer usar algo que no existe adentro del sandbox. */
export class ForbiddenError extends Error {
  readonly what: string
  constructor(what: string, instead: string) {
    super(`"${what}" no existe adentro del sandbox: ${instead}`)
    this.name = 'ForbiddenError'
    this.what = what
  }
}

/**
 * Los nombres que se tapan, con qué hay que usar en su lugar.
 *
 * Está ordenado por MOTIVO y no alfabéticamente, porque el motivo es lo que hay
 * que poder auditar: cada renglón tiene que poder contestar «¿y éste por qué?».
 */
export const FORBIDDEN_GLOBALS: Readonly<Record<string, string>> = Object.freeze({
  // ── Reloj y azar: la regla 2, literal ──────────────────────────────────
  Date: 'el tiempo del mundo se lee con `ctx.tick` y `ctx.clock` (ADR II-0008)',
  performance: 'el mundo no tiene reloj de pared; un tick es un tick',
  Intl: 'el formateo depende del locale del sistema y hace divergir el replay',
  // `Math` NO va acá: se reemplaza por un objeto propio, ver `safeMath`.

  // ── Salir de la caja ───────────────────────────────────────────────────
  globalThis: 'no hay acceso al alcance global desde una habilidad',
  global: 'no hay acceso al alcance global desde una habilidad',
  window: 'una habilidad corre en el worker del mundo, no en la página',
  self: 'una habilidad corre en el worker del mundo; lo tuyo es `ctx.self`',
  document: 'una habilidad no dibuja: describe intenciones y el mundo las juzga',
  navigator: 'no hay navegador acá adentro',
  location: 'no hay navegador acá adentro',
  process: 'no hay proceso ni entorno acá adentro',
  module: 'una habilidad exporta con `export`, y nada más',
  Function: 'no se puede fabricar código nuevo adentro de una habilidad',
  WebAssembly: 'no se puede fabricar código nuevo adentro de una habilidad',
  importScripts: 'no se puede traer código nuevo adentro de una habilidad',

  // ── Red y almacenamiento: efectos que el mundo no puede rebobinar ──────
  fetch: 'una habilidad no habla con afuera; lo que sabe lo sabe por `ctx`',
  XMLHttpRequest: 'una habilidad no habla con afuera',
  WebSocket: 'una habilidad no habla con afuera',
  EventSource: 'una habilidad no habla con afuera',
  localStorage: 'lo único que sobrevive a un guardado es `ctx.memory`',
  sessionStorage: 'lo único que sobrevive a un guardado es `ctx.memory`',
  indexedDB: 'lo único que sobrevive a un guardado es `ctx.memory`',
  caches: 'lo único que sobrevive a un guardado es `ctx.memory`',
  crypto: 'el azar del mundo es `ctx.rng`, y es reproducible',

  // ── Tiempo y concurrencia: lo que rompería el orden del tick ───────────
  setTimeout: 'para dejar pasar el tiempo del mundo está `ctx.wait(segundos)`',
  setInterval: 'para dejar pasar el tiempo del mundo está `ctx.wait(segundos)`',
  setImmediate: 'una habilidad corre sincrónica adentro del tick',
  clearTimeout: 'no hay temporizadores adentro del sandbox',
  clearInterval: 'no hay temporizadores adentro del sandbox',
  queueMicrotask: 'una habilidad corre sincrónica adentro del tick',
  requestAnimationFrame: 'una habilidad no dibuja',
  cancelAnimationFrame: 'una habilidad no dibuja',
  Promise: 'una habilidad es un generador sincrónico: se cede con `yield`, no con `await`',
  Worker: 'una habilidad no crea hilos',
  SharedArrayBuffer: 'una habilidad no comparte memoria con nadie',
  Atomics: 'una habilidad no comparte memoria con nadie',
  postMessage: 'lo que la criatura dice se dice con `ctx.say`',

  // ── Observables por recolección de basura: no deterministas ────────────
  WeakRef: 'cuándo se recolecta algo depende del motor, y eso hace divergir el replay',
  FinalizationRegistry: 'cuándo se recolecta algo depende del motor',

  // ── El canal de habla es uno solo ──────────────────────────────────────
  console: 'la criatura habla por `ctx.say`, que el jugador puede leer',
})

/**
 * Los miembros de `Math` que no se pueden usar, con el reemplazo adentro del
 * mensaje. Se declaran como ACCESORES QUE LANZAN y no se omiten: con
 * `Math.random` ausente el error sería «Math.random is not a function», que no
 * dice nada.
 *
 * Y NO se hace lo cómodo, que sería atar `Math.exp` a `ctx.math.exp`. Sería un
 * renglón y le ahorraría un error al modelo, pero le enseñaría que `Math.exp`
 * está bien: el mismo código copiado a cualquier otro lado del proyecto —donde
 * no hay sombra— divergiría en silencio, que es exactamente el modo de falla que
 * la regla 2 existe para evitar. Una API sola para las trascendentes, y es
 * `ctx.math`.
 */
const MATH_PROHIBIDO: Readonly<Record<string, string>> = Object.freeze({
  random: 'el azar del mundo es `ctx.rng()`, que es reproducible',
  exp: 'usá `ctx.math.exp`, que es punto fijo e igual en toda máquina',
  pow: 'usá `ctx.math.pow`, que es punto fijo e igual en toda máquina',
  log: 'usá `ctx.math.log`, que es punto fijo e igual en toda máquina',
  sin: 'usá `ctx.math.sin`, que es punto fijo e igual en toda máquina',
  cos: 'no tiene precisión especificada en ECMAScript; lo que hay es `ctx.math`',
  tan: 'no tiene precisión especificada en ECMAScript; lo que hay es `ctx.math`',
  sqrt: 'no tiene precisión especificada; compará distancias AL CUADRADO',
  hypot: 'no tiene precisión especificada; compará distancias AL CUADRADO',
  cbrt: 'no tiene precisión especificada en ECMAScript',
  log2: 'no tiene precisión especificada en ECMAScript',
  log10: 'no tiene precisión especificada en ECMAScript',
  log1p: 'no tiene precisión especificada en ECMAScript',
  expm1: 'no tiene precisión especificada en ECMAScript',
  atan: 'no tiene precisión especificada en ECMAScript',
  atan2: 'no tiene precisión especificada en ECMAScript',
  asin: 'no tiene precisión especificada en ECMAScript',
  acos: 'no tiene precisión especificada en ECMAScript',
  sinh: 'no tiene precisión especificada en ECMAScript',
  cosh: 'no tiene precisión especificada en ECMAScript',
  tanh: 'no tiene precisión especificada en ECMAScript',
})

/**
 * `Math`, pero solo con lo que ECMAScript especifica EXACTAMENTE.
 *
 * La lista corta no es prudencia de más: `Math.sqrt`, `Math.exp`, `Math.pow`,
 * `Math.log`, `Math.sin`, `Math.hypot` y `Math.cbrt` están definidos en la
 * especificación como «implementation-approximated», o sea que dos motores
 * pueden devolver el último bit distinto. Lo que queda —`abs`, `floor`, `ceil`,
 * `round`, `trunc`, `sign`, `min`, `max`, `imul`, `clz32`, `fround`— está
 * definido con operaciones exactas sobre el double, y `PI`/`E` son constantes
 * literales, así que dan lo mismo en toda máquina.
 *
 * `sqrt` DUELE y hay que decirlo: sin él no se puede calcular una distancia
 * euclidiana. La salida es comparar distancias AL CUADRADO, que es lo que
 * conviene hacer igual y que ordena idéntico. Si algún día hace falta la
 * distancia de verdad —para mostrarla, o para dividir por ella— el lugar es
 * `ctx.math`, que es punto fijo nuestro, y no `Math`.
 */
export function safeMath(): Readonly<Record<string, unknown>> {
  const seguro: Record<string, unknown> = {
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    trunc: Math.trunc,
    sign: Math.sign,
    min: Math.min,
    max: Math.max,
    imul: Math.imul,
    clz32: Math.clz32,
    fround: Math.fround,
    PI: Math.PI,
    E: Math.E,
  }
  for (const [nombre, porque] of Object.entries(MATH_PROHIBIDO)) {
    Object.defineProperty(seguro, nombre, {
      get() {
        throw new ForbiddenError(`Math.${nombre}`, porque)
      },
      enumerable: true,
    })
  }
  return Object.freeze(seguro)
}

/**
 * El alcance que recibe `mount()`: cada nombre prohibido atado a un objeto que
 * lanza en cuanto se lo toca.
 *
 * Se atan a un objeto que lanza y no a `undefined` por lo mismo que arriba: para
 * que el error diga qué usar. La excepción es que muchos de estos nombres se
 * usan como CONSTRUCTORES (`new Date()`) y otros como funciones (`fetch(…)`), y
 * un objeto plano no sirve para ninguno de los dos casos, así que la sombra es
 * una función que lanza y que además lanza al leerle cualquier propiedad.
 */
export function shadowScope(): Record<string, unknown> {
  const alcance: Record<string, unknown> = {}
  for (const [nombre, instead] of Object.entries(FORBIDDEN_GLOBALS)) {
    // OJO: tiene que ser una `function` y no una flecha. Un `Proxy` es
    // construible solo si su BLANCO lo es, y una flecha no lo es: con una
    // flecha adentro, `new Date()` muere con «Date is not a constructor» —el
    // motor ni llega a llamar a la trampa— y el mensaje que enseña se pierde.
    // Lo encontró el test, no la lectura.
    function explotar(): never {
      throw new ForbiddenError(nombre, instead)
    }
    // Un `Proxy` sobre una función: sirve de función (`fetch(x)`), de
    // constructor (`new Date()`) y de objeto (`performance.now()`), y los tres
    // caminos terminan en el mismo error con la misma instrucción adentro.
    alcance[nombre] = new Proxy(explotar, {
      apply: explotar,
      construct: explotar,
      get: (_t, k) => {
        // `typeof x` y las conversiones a texto de los motores tocan estas dos
        // claves para armar mensajes de error; si lanzáramos ahí, el error que
        // ve el modelo sería sobre otra cosa.
        if (k === Symbol.toPrimitive || k === Symbol.toStringTag) return undefined
        return explotar()
      },
    })
  }
  alcance['Math'] = safeMath()
  return alcance
}

// ─── El escáner ─────────────────────────────────────────────────────────────

export interface Finding {
  /** Qué se encontró, tal cual está escrito. */
  readonly what: string
  /** Por qué no se puede, y qué hay en su lugar. */
  readonly why: string
  readonly line: number
  readonly column: number
}

/**
 * Los métodos de prototipo que dependen del locale del sistema. Ninguna sombra
 * de alcance los puede tapar: son propiedades de `String.prototype` y
 * `Number.prototype`, y taparlos sería parchear los intrínsecos del motor para
 * todo el hilo, que rompería al mundo y a la UI junto con la habilidad.
 */
const METODOS_DE_LOCALE: Readonly<Record<string, string>> = Object.freeze({
  localeCompare: 'ordená con `<` sobre las unidades de código, que ECMAScript sí especifica',
  toLocaleString: 'depende del locale del sistema; usá `String(x)`',
  toLocaleDateString: 'depende del locale del sistema',
  toLocaleTimeString: 'depende del locale del sistema',
  toLocaleUpperCase: 'depende del locale del sistema; usá `toUpperCase()`',
  toLocaleLowerCase: 'depende del locale del sistema; usá `toLowerCase()`',
})

/**
 * Revisa un fuente ANTES de compilarlo. No sustituye al typecheck ni al
 * `admit()`: es la puerta más barata de las tres y la única que puede hablar de
 * determinismo, que es algo que los tipos no ven.
 *
 * Devuelve TODOS los hallazgos y no el primero, a propósito: el bucle de
 * reparación del Hito 8 arregla de a un viaje, y darle los cinco problemas
 * juntos es la diferencia entre una reparación y cinco.
 */
export function scanDeterminism(ts: ApiTS, code: string, fileName = 'habilidad.ts'): Finding[] {
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2022, true)
  const hallazgos: Finding[] = []

  const anotar = (nodo: TS.Node, what: string, why: string): void => {
    const { line, character } = sf.getLineAndCharacterOfPosition(nodo.getStart(sf))
    hallazgos.push({ what, why, line: line + 1, column: character + 1 })
  }

  // Los nombres que el propio fuente declara dejan de ser el global del mismo
  // nombre. Sin esto, una habilidad con una variable local llamada `location`
  // sería rechazada por algo que no hizo. Se junta TODO el archivo de una y no
  // por alcance: es una aproximación, y se equivoca hacia dejar pasar (una
  // sombra local en otra función tapa el hallazgo), que es el lado correcto —
  // el alcance de `mount()` lo va a atajar igual en tiempo de ejecución.
  const declarados = new Set<string>()
  const juntarNombres = (nodo: TS.Node): void => {
    if (
      (ts.isVariableDeclaration(nodo) ||
        ts.isFunctionDeclaration(nodo) ||
        ts.isClassDeclaration(nodo) ||
        ts.isParameter(nodo) ||
        ts.isBindingElement(nodo) ||
        ts.isImportSpecifier(nodo)) &&
      nodo.name !== undefined &&
      ts.isIdentifier(nodo.name)
    ) {
      declarados.add(nodo.name.text)
    }
    ts.forEachChild(nodo, juntarNombres)
  }
  ts.forEachChild(sf, juntarNombres)

  const ver = (nodo: TS.Node): void => {
    // ── El operador de potencia ──────────────────────────────────────────
    // No es un nombre: es sintaxis, y por eso ninguna sombra lo puede tapar.
    // ECMAScript no especifica su precisión, igual que `Math.pow`.
    if (
      ts.isBinaryExpression(nodo) &&
      (nodo.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskToken ||
        nodo.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken)
    ) {
      anotar(nodo, '**', 'no tiene precisión especificada en ECMAScript; usá `ctx.math.pow`')
    }

    // ── `async` / `await`: una habilidad es un generador sincrónico ───────
    if (ts.isAwaitExpression(nodo)) {
      anotar(nodo, 'await', 'una habilidad cede con `yield`, no con `await`')
    }

    // ── Métodos de locale, y las trascendentes de `Math` ─────────────────
    if (ts.isPropertyAccessExpression(nodo)) {
      const nombre = nodo.name.text
      const porLocale = Object.prototype.hasOwnProperty.call(METODOS_DE_LOCALE, nombre)
        ? METODOS_DE_LOCALE[nombre]
        : undefined
      if (porLocale !== undefined) anotar(nodo.name, `.${nombre}()`, porLocale)
      // `Math.random` lo ataja igual la sombra en tiempo de ejecución, pero
      // atajarlo acá lo convierte en una reparación sin viaje al modelo y sin
      // haber corrido un solo tick.
      if (
        ts.isIdentifier(nodo.expression) &&
        nodo.expression.text === 'Math' &&
        !declarados.has('Math') &&
        Object.prototype.hasOwnProperty.call(MATH_PROHIBIDO, nombre)
      ) {
        anotar(nodo, `Math.${nombre}`, MATH_PROHIBIDO[nombre] ?? '')
      }
    }

    // ── Nombres prohibidos y nombres reservados del andamio ──────────────
    if (ts.isIdentifier(nodo)) {
      const texto = nodo.text
      const padre = nodo.parent as TS.Node | undefined
      // `algo.Date` no es el global `Date`, y `{ Date: 1 }` tampoco.
      const esPropiedad =
        padre !== undefined &&
        ((ts.isPropertyAccessExpression(padre) && padre.name === nodo) ||
          (ts.isPropertyAssignment(padre) && padre.name === nodo) ||
          (ts.isPropertySignature(padre) && padre.name === nodo) ||
          (ts.isBindingElement(padre) && padre.propertyName === nodo))
      if (!esPropiedad) {
        if (texto.startsWith(FUEL_PREFIX)) {
          anotar(nodo, texto, `el prefijo "${FUEL_PREFIX}" lo usa el contador de combustible de la casa`)
        } else if (!declarados.has(texto) && Object.prototype.hasOwnProperty.call(FORBIDDEN_GLOBALS, texto)) {
          anotar(nodo, texto, FORBIDDEN_GLOBALS[texto] ?? '')
        }
      }
    }

    ts.forEachChild(nodo, ver)
  }
  ts.forEachChild(sf, ver)
  return hallazgos
}
