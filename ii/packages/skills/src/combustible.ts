// ─── @anima/skills/combustible.ts ────────────────────────────────────────────
//
// EL COMBUSTIBLE. La versión de producción del transformer que el Hito 0 midió
// en `banco/fuel-transformer.mjs`, con los dos hallazgos del banco convertidos
// en requisitos por el ADR II-0005 y sin las perillas que permitían violarlos.
//
// Qué hace: recibe el TypeScript que escribió el modelo y le inyecta un
// contador de presupuesto en los DOS únicos lugares por los que un programa
// puede correr para siempre.
//
//   back-edge de bucle    un bucle es la única forma de gastar tiempo ilimitado
//                         sin crecer el stack. `while (true) {}` tiene que morir.
//   entrada de función    la recursión es la otra forma, y no tiene back-edge.
//
// Con esos dos, no hay programa que corra para siempre sin tocar el contador.
// Instrumentar cada sentencia sería más preciso y mucho más caro, y la precisión
// no hace falta: el presupuesto es un TOPE, no una factura.
//
// ─── Lo que el ADR II-0005 fijó, y acá no es opcional ────────────────────────
//
// El prototipo tenía tres perillas (`modo`, `conFunciones`, `nombreContador`)
// porque su trabajo era MEDIR las variantes. Dos de esas tres mediciones
// terminaron en requisitos, así que las perillas no sobreviven: una opción que
// permite incumplir un ADR es un ADR que no existe.
//
//   1. LA INYECCIÓN VA EN LÍNEA. `if (--__fuelLeft < 0) …` y no `__fuel()`.
//      Medido: 33% → 22% de overhead. Un tercio del costo era la llamada.
//   2. SE INSTRUMENTAN TAMBIÉN LAS ENTRADAS DE FUNCIÓN. Sacarlas no ahorra nada
//      medible (52,6% → 51,9%) y hace que la recursión infinita muera por
//      `RangeError` en vez de por combustible.
//
// ─── La promesa que el documento hace, y dónde se puede cumplir ──────────────
//
// El documento de arquitectura dice, sobre el combustible:
//
//   «Al agotarse NO lanza: emite un yield cooperativo.»
//
// y le reprocha a QuickJS que `setInterruptHandler` no suspenda sino que lance,
// porque «un generador atravesado por una excepción queda `completed` para
// siempre». Tenía razón, y por eso acá la inyección NO ES UNA SOLA: `yield` solo
// es legal DENTRO del cuerpo de un generador, nunca dentro de una función común
// anidada —ni de una flecha, aunque esté escrita adentro del generador—. La
// gramática de ECMAScript no lo permite, y no hay manera de rodearla sin
// reescribir todas las funciones a generadores y todas las llamadas a `yield*`,
// que es un CPS completo: cambia la semántica de cualquier callback que se le
// pase a `filter` o a `sort`, y cuesta bastante más que el 22% que estamos
// discutiendo.
//
// Entonces el transformer inyecta lo que corresponda en cada sitio:
//
//   dónde se acaba el combustible          qué pasa
//   ────────────────────────────────────   ────────────────────────────────────
//   cuerpo de la habilidad (generador)     `yield` de suspensión: el ejecutor
//                                          recarga y reanuda el tick siguiente,
//                                          EN EL MISMO PUNTO. Reanudable de
//                                          verdad, que es lo que QuickJS no
//                                          podía dar.
//   generador auxiliar delegado con        idem: sus yields atraviesan el `yield*`
//   `yield*`                               y llegan al ejecutor.
//   función común, flecha, método          `OutOfFuel`. La habilidad muere y el
//                                          ejecutor lo informa con su fase.
//
// O sea: el caso que importa —la habilidad computando de más en su propio
// cuerpo— suspende y sigue; el caso que no se puede salvar —recursión sin fondo,
// bucle infinito adentro de un helper— muere rápido, con nombre y con la fase
// en la que estaba. Que muera por combustible y no por `RangeError` es lo que
// pedía el ADR: el `RangeError` de stack puede dejar estructuras a medio
// escribir en cualquier lado, el corte por combustible cae en un punto que
// nosotros elegimos.
//
// La única trampa de esto está anotada donde vive: un generador auxiliar que la
// habilidad maneje A MANO (`const g = helper(); g.next()`) en vez de delegarlo
// con `yield*` se come sus propias suspensiones y recibe el centinela como si
// fuera un `StepResult`. Es un patrón que nadie escribe y que el escáner de
// `aislamiento.ts` no puede detectar sin tipos; queda dicho acá y no escondido.
//
// ─── LA EXCEPCIÓN DEL `for…of`, que salió de medir y no de pensar ───────────
//
// El `yield` de suspensión NO se inyecta en `for…of` ni en `for…in`, ni siquiera
// adentro de un generador. Ahí va el throw, como en una función común. Cuesta
// explicarlo y por eso está acá con los números:
//
//   la carga realista del banco (un generador que recorre 40 cuerpos y cede el
//   tick, 160.000 vueltas de bucle interno), medida en Node con el mismo
//   montaje que usa el ejecutor
//
//   sin instrumentar                                   0,272 ms
//   con el throw en todos lados                        0,414 ms   +0,14
//   con el `yield` en todos lados                      2,023 ms   +1,75   ✘
//   con el `yield` salvo en el `for…of`                0,366 ms   +0,09   ✔
//
// **Un `yield` adentro de un `for…of` cuesta trece veces más que en cualquier
// otro lugar.** El mecanismo se ve en las mediciones de al lado: en un `for`
// con índice el `yield` sale IGUAL que el throw (1,375 contra 1,368 ms en
// 400.000 vueltas), y en un `for…of` sale 1,8× más caro. Lo que pasa es que el
// punto de suspensión obliga a que el iterador sobreviva a la suspensión, así
// que V8 no puede quedarse con el camino rápido de iteración de arrays: pasa a
// asignar un objeto iterador por entrada al bucle y a llamar `.next()` por
// elemento. Con el bucle interno entrándose 4000 veces, eso son 4000 iteradores
// y 160.000 llamadas genéricas.
//
// Y lo que se pierde por no ceder ahí es NADA, que es lo que hace que la
// decisión sea fácil: `for…of` y `for…in` recorren una colección que ya existe,
// o sea que TERMINAN. Las tres formas de escribir un bucle infinito —`while
// (true)`, `do…while (true)` y `for (;;)`— siguen cediendo y siguen siendo
// reanudables. Lo único que queda sin suspensión es `for (const x of
// unGeneradorInfinito())`, que muere por combustible como cualquier función
// común; es un patrón exótico y el precio está medido y dicho.
//
// La alternativa que se descartó era la regla «ceder solo en bucles de primer
// nivel» (anidar → throw). Da el mismo número —0,366 ms— pero por casualidad, no
// por causa: sacrifica justo el caso peligroso, un `while (true)` adentro de un
// `for…of`, que con la regla de arriba sigue suspendiendo bien.

import type * as TS from 'typescript'

/** La API de TypeScript se INYECTA, no se importa. */
// Dos razones, y la segunda es la que manda: (1) el mismo transformer tiene que
// correr en Node (tests, juez) y en el navegador (la fragua compila ahí, y el
// Hito 0 midió que el toolchain arranca en 6 ms), y en el navegador `ts` llega
// como un módulo ya cargado, no como un `import` resoluble; (2) `import type`
// no deja ni un byte en el bundle, así que este paquete no arrastra los 10 MB
// de `typescript` a quien solo quiera EJECUTAR una habilidad ya compilada.
export type ApiTS = typeof import('typescript')

// ─── Los nombres del andamio ────────────────────────────────────────────────
// Son identificadores libres en el código instrumentado: los resuelve el alcance
// que arma `mount()`. Empiezan con `__fuel` y ese prefijo está reservado: el
// escáner de `aislamiento.ts` rechaza cualquier fuente que lo use, porque una
// habilidad que declare su propio `__fuelLeft` se estaría comprando el
// presupuesto de la casa.
export const FUEL_LEFT = '__fuelLeft'
export const FUEL_OUT = '__fuelOut'
export const FUEL_SUSPEND = '__fuelSuspend'
export const FUEL_PREFIX = '__fuel'

/**
 * El centinela de suspensión. Es un OBJETO CONGELADO y no un símbolo ni una
 * llamada, por dos motivos: `yield __fuelSuspend` no paga una llamada a función
 * en el camino caliente (que es justo lo que el hallazgo 1 del banco vino a
 * sacar), y la comparación por identidad es lo más barato que hay para que el
 * ejecutor lo distinga de un `Intent` de verdad.
 */
export interface SuspensionSignal {
  readonly __anima: 'suspension'
}

export const SUSPENSION: SuspensionSignal = Object.freeze({ __anima: 'suspension' as const })

/**
 * Se compara por IDENTIDAD y no por forma, así que hay un invariante de
 * empaquetado atrás: quien monta la habilidad y quien la ejecuta tienen que
 * estar mirando la misma instancia de este módulo. Es lo normal —un worker, un
 * grafo de módulos— y si alguna vez se rompiera (un bundle que duplique el
 * paquete, ESM y CJS conviviendo) el síntoma es fuerte y aparece en el primer
 * test: la suspensión se ve como una intención y el mundo la rechaza. La
 * alternativa, mirar el campo `__anima`, dejaría que una habilidad se fabrique
 * suspensiones falsas, y una mentira que no se puede ver no se puede castigar.
 */
export function isSuspension(v: unknown): v is SuspensionSignal {
  return v === SUSPENSION
}

/**
 * Se acabó el combustible en un sitio donde NO se puede ceder: una función
 * común, una flecha, un método. No es un error del programa de la habilidad —es
 * el presupuesto— y por eso tiene clase propia: el ejecutor lo distingue de un
 * `TypeError` para no reportar «la habilidad se rompió» cuando lo que pasó es
 * «la habilidad se pasó de larga».
 */
export class OutOfFuel extends Error {
  readonly budget: number
  constructor(budget: number) {
    super(`sin combustible: se agotaron ${budget} unidades adentro de una función común`)
    this.name = 'OutOfFuel'
    this.budget = budget
  }
}

// ─── El transformer ─────────────────────────────────────────────────────────

const esGenerador = (n: TS.Node): boolean =>
  (n as { asteriskToken?: TS.Node }).asteriskToken !== undefined

/**
 * La fábrica de transformación, con la firma que el documento de arquitectura
 * declara. Un plugin de esbuild NO sirve para esto: esbuild no expone su AST a
 * los plugins, opera sobre texto. `ts.transform()` sí da AST.
 */
export function fuelTransformer(ts: ApiTS): TS.TransformerFactory<TS.SourceFile> {
  return (ctx) => {
    const f = ctx.factory

    // ¿Estamos DIRECTAMENTE adentro del cuerpo de un generador, sin haber
    // cruzado ninguna frontera de función? Es la primera de las dos preguntas
    // que deciden si la inyección puede ser un `yield` o tiene que ser un throw
    // —la otra es la clase de bucle, ver la excepción del `for…of`—. Se lleva
    // como una variable con guardado y restauración alrededor de cada frontera
    // —flecha incluida, que no puede contener `yield` ni estando escrita adentro
    // de un generador— en vez de mirar padres, porque los nodos sintéticos que
    // vamos creando no tienen `parent` confiable.
    let enGenerador = false

    const inyeccion = (cede: boolean): TS.Statement =>
      f.createIfStatement(
        f.createBinaryExpression(
          f.createPrefixUnaryExpression(ts.SyntaxKind.MinusMinusToken, f.createIdentifier(FUEL_LEFT)),
          ts.SyntaxKind.LessThanToken,
          f.createNumericLiteral(0),
        ),
        f.createExpressionStatement(
          cede
            ? f.createYieldExpression(undefined, f.createIdentifier(FUEL_SUSPEND))
            : f.createCallExpression(f.createIdentifier(FUEL_OUT), undefined, []),
        ),
      )

    /**
     * Mete la comprobación al principio de un cuerpo. Si el cuerpo no es un
     * bloque —`while (x) paso()`, o una flecha con cuerpo de expresión— hay que
     * envolverlo primero, porque no hay dónde insertar una sentencia.
     */
    const conCombustible = (cuerpo: TS.ConciseBody | TS.Statement, cede = enGenerador): TS.Block => {
      if (ts.isBlock(cuerpo)) return f.updateBlock(cuerpo, [inyeccion(cede), ...cuerpo.statements])
      // Sentencia suelta como cuerpo de bucle: `while (x) paso()`.
      if (ts.isStatement(cuerpo)) return f.createBlock([inyeccion(cede), cuerpo], true)
      // Flecha con cuerpo de expresión: `(x) => x + 1` pasa a
      // `(x) => { if (--__fuelLeft < 0) __fuelOut(); return x + 1 }`.
      return f.createBlock([inyeccion(cede), f.createReturnStatement(cuerpo)], true)
    }

    const esFrontera = (n: TS.Node): boolean =>
      ts.isFunctionDeclaration(n) ||
      ts.isFunctionExpression(n) ||
      ts.isArrowFunction(n) ||
      ts.isMethodDeclaration(n) ||
      ts.isGetAccessorDeclaration(n) ||
      ts.isSetAccessorDeclaration(n) ||
      ts.isConstructorDeclaration(n) ||
      ts.isClassStaticBlockDeclaration(n)

    const visitarFuncion = (nodo: TS.Node): TS.Node => {
      const anterior = enGenerador
      // Una flecha nunca es generadora, un accesor tampoco, un bloque estático
      // menos: cualquiera de los tres APAGA la posibilidad de ceder aunque esté
      // escrito adentro de una habilidad.
      enGenerador = esGenerador(nodo)
      const n = ts.visitEachChild(nodo, visitar, ctx)
      let salida: TS.Node = n
      if (ts.isFunctionDeclaration(n) && n.body) {
        salida = f.updateFunctionDeclaration(
          n,
          n.modifiers,
          n.asteriskToken,
          n.name,
          n.typeParameters,
          n.parameters,
          n.type,
          conCombustible(n.body),
        )
      } else if (ts.isFunctionExpression(n)) {
        salida = f.updateFunctionExpression(
          n,
          n.modifiers,
          n.asteriskToken,
          n.name,
          n.typeParameters,
          n.parameters,
          n.type,
          conCombustible(n.body),
        )
      } else if (ts.isArrowFunction(n)) {
        salida = f.updateArrowFunction(
          n,
          n.modifiers,
          n.typeParameters,
          n.parameters,
          n.type,
          n.equalsGreaterThanToken,
          conCombustible(n.body),
        )
      } else if (ts.isMethodDeclaration(n) && n.body) {
        salida = f.updateMethodDeclaration(
          n,
          n.modifiers,
          n.asteriskToken,
          n.name,
          n.questionToken,
          n.typeParameters,
          n.parameters,
          n.type,
          conCombustible(n.body),
        )
      } else if (ts.isGetAccessorDeclaration(n) && n.body) {
        salida = f.updateGetAccessorDeclaration(
          n,
          n.modifiers,
          n.name,
          n.parameters,
          n.type,
          conCombustible(n.body),
        )
      } else if (ts.isSetAccessorDeclaration(n) && n.body) {
        salida = f.updateSetAccessorDeclaration(n, n.modifiers, n.name, n.parameters, conCombustible(n.body))
      } else if (ts.isConstructorDeclaration(n) && n.body) {
        // OJO: en un constructor derivado, `super()` tiene que correr antes de
        // tocar `this`. La comprobación no toca `this`, así que puede ir antes
        // sin romper esa regla.
        salida = f.updateConstructorDeclaration(n, n.modifiers, n.parameters, conCombustible(n.body))
      }
      enGenerador = anterior
      return salida
    }

    const visitar = (nodo: TS.Node): TS.Node => {
      // ── Bucles: el back-edge ────────────────────────────────────────────
      // El cuerpo se visita ANTES de inyectar, para que la comprobación nueva
      // —que ya viene armada— no se vuelva a visitar.
      if (ts.isWhileStatement(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateWhileStatement(n, n.expression, conCombustible(n.statement))
      }
      if (ts.isDoStatement(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateDoStatement(n, conCombustible(n.statement), n.expression)
      }
      if (ts.isForStatement(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateForStatement(n, n.initializer, n.condition, n.incrementor, conCombustible(n.statement))
      }
      // `for…of` y `for…in`: la comprobación NUNCA cede, ni adentro de un
      // generador. Ver «LA EXCEPCIÓN DEL `for…of`» en el encabezado: un `yield`
      // acá cuesta 13× y no compra nada, porque estos dos bucles recorren una
      // colección que ya existe y por lo tanto TERMINAN.
      if (ts.isForOfStatement(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateForOfStatement(
          n,
          n.awaitModifier,
          n.initializer,
          n.expression,
          conCombustible(n.statement, false),
        )
      }
      if (ts.isForInStatement(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateForInStatement(n, n.initializer, n.expression, conCombustible(n.statement, false))
      }

      // ── Funciones: la recursión, y la frontera del `yield` ───────────────
      if (esFrontera(nodo)) return visitarFuncion(nodo)

      return ts.visitEachChild(nodo, visitar, ctx)
    }

    return (sf) => ts.visitNode(sf, visitar, ts.isSourceFile) ?? sf
  }
}

/** Cuenta cuántos puntos de inyección tendría un fuente, sin transformarlo. */
export function countInjectionPoints(ts: ApiTS, code: string): number {
  const sf = ts.createSourceFile('conteo.ts', code, ts.ScriptTarget.ES2022, true)
  let n = 0
  const ver = (nodo: TS.Node): void => {
    if (
      ts.isWhileStatement(nodo) ||
      ts.isDoStatement(nodo) ||
      ts.isForStatement(nodo) ||
      ts.isForOfStatement(nodo) ||
      ts.isForInStatement(nodo) ||
      ts.isArrowFunction(nodo) ||
      ts.isFunctionExpression(nodo) ||
      (ts.isFunctionDeclaration(nodo) && nodo.body !== undefined) ||
      (ts.isMethodDeclaration(nodo) && nodo.body !== undefined) ||
      (ts.isGetAccessorDeclaration(nodo) && nodo.body !== undefined) ||
      (ts.isSetAccessorDeclaration(nodo) && nodo.body !== undefined) ||
      (ts.isConstructorDeclaration(nodo) && nodo.body !== undefined)
    ) {
      n++
    }
    ts.forEachChild(nodo, ver)
  }
  ts.forEachChild(sf, ver)
  return n
}

export interface Instrumented {
  /** JavaScript listo para `mount()`. */
  readonly js: string
  /** Cuántos puntos de inyección tenía el fuente. Va al informe del juez. */
  readonly points: number
}

/**
 * TypeScript de la habilidad → JavaScript instrumentado.
 *
 * ORDEN, que importa y no es negociable: primero el juez TYPECHEQUEA EL FUENTE
 * —el `.d.ts` es el árbitro y el fuente es lo que el modelo escribió—, y recién
 * después se instrumenta. Al revés no funciona: el código inyectado hace
 * `yield __fuelSuspend` adentro de un `Generator<Intent, …>`, así que el
 * instrumentado NO typechequea contra la API, y nunca tiene que hacerlo.
 *
 * Se emite CommonJS y no ESM porque `mount()` evalúa el resultado adentro de una
 * función: un `export` es ilegal ahí, `exports.pescar = …` no.
 */
export function instrument(ts: ApiTS, code: string, o?: { readonly fileName?: string }): Instrumented {
  const salida = ts.transpileModule(code, {
    fileName: o?.fileName ?? 'habilidad.ts',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      // Sin `importHelpers` ni downlevel: los generadores son nativos en ES2022.
      // Si algún día se baja el target, `tslib` entraría al alcance del sandbox
      // y habría que dejarlo pasar explícitamente.
      removeComments: false,
    },
    transformers: { before: [fuelTransformer(ts)] },
  })
  return { js: salida.outputText, points: countInjectionPoints(ts, code) }
}

// ─── El montaje: del texto a algo que se puede llamar ───────────────────────

export interface FuelCell {
  /** Recarga el tanque. El ejecutor la llama antes de CADA reanudación. */
  refill(n: number): void
  /** Lo que queda. Negativo si se acaba de agotar. */
  readonly left: number
  /** Lo gastado desde la última recarga. */
  readonly spent: number
}

export interface MountedSkill {
  readonly cell: FuelCell
  readonly exports: Record<string, unknown>
}

export interface MountOptions {
  /**
   * Los globals sombreados. Cada clave se ata como PARÁMETRO de la función que
   * envuelve al código, así que tapa al global del mismo nombre por alcance
   * léxico y no por borrado: nada global se toca, y dos habilidades pueden
   * tener sombras distintas. Ver `aislamiento.ts`.
   */
  readonly scope?: Record<string, unknown>
  /** Lo que puede pedir un `import` de la habilidad. Todo lo demás lanza. */
  readonly modules?: Record<string, unknown>
}

/** Nombres que el andamio ya usa adentro. Una sombra no puede pisarlos. */
const INTERNOS = new Set(['__anima', 'exports', 'require', FUEL_LEFT, FUEL_OUT, FUEL_SUSPEND, '__fuelBudget'])

/**
 * Evalúa el JavaScript instrumentado en un alcance cerrado y devuelve sus
 * exportaciones más la celda de combustible.
 *
 * Por qué `new Function` y no un `<script type=module>` ni un `import()` de un
 * data URL: los dos evalúan en el alcance GLOBAL, donde no hay forma de tapar
 * `Date` ni `fetch` sin romperlos para todo el mundo, y los dos son asíncronos
 * —el ejecutor es síncrono adentro del worker del mundo, por decisión del
 * documento, y esperar una promesa para arrancar una habilidad sería volver a
 * meter el reloj de pared en el medio del tick—.
 *
 * MODELO DE AMENAZA, declarado como lo declara el documento: *código tonto de un
 * proveedor de confianza media, no un adversario con exploits de motor*. El
 * alcance cerrado impide equivocarse; no impide a alguien que quiera escaparse
 * hacerlo por el prototipo de una función (`(function(){}).constructor`). Si
 * algún día se ejecutan habilidades compartidas ENTRE usuarios, esto no alcanza
 * y hay que volver a un intérprete propio. Está anotado, no escondido.
 */
export function mount(js: string, o: MountOptions = {}): MountedSkill {
  const scope = o.scope ?? {}
  const modules = o.modules ?? {}

  const nombres = Object.keys(scope)
  for (const n of nombres) {
    if (INTERNOS.has(n)) throw new Error(`el alcance no puede sombrear "${n}": lo usa el andamio del combustible`)
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n)) throw new Error(`"${n}" no es un identificador atable`)
  }

  const cuerpo =
    '"use strict";\n' +
    // El contador es una variable del alcance de esta función, no una propiedad
    // de un objeto: `--__fuelLeft` compila a una operación sobre una ranura de
    // contexto, que es lo más barato que se puede escribir en JS. Con un
    // `cell.left--` se pagaría una búsqueda de propiedad por iteración de todo
    // bucle del programa, y eso sí se vería en el tick.
    `let ${FUEL_LEFT} = 0;\n` +
    'let __fuelBudget = 0;\n' +
    `const ${FUEL_SUSPEND} = __anima.suspension;\n` +
    `const ${FUEL_OUT} = () => { throw __anima.outOfFuel(__fuelBudget) };\n` +
    'const exports = {};\n' +
    'const require = __anima.require;\n' +
    js +
    '\nreturn { exports, cell: {\n' +
    `  refill(n) { __fuelBudget = n; ${FUEL_LEFT} = n },\n` +
    `  get left() { return ${FUEL_LEFT} },\n` +
    `  get spent() { return __fuelBudget - ${FUEL_LEFT} },\n` +
    '} };\n'

  const fabrica = new Function('__anima', ...nombres, cuerpo) as (
    anima: unknown,
    ...sombras: unknown[]
  ) => MountedSkill

  const anima = {
    suspension: SUSPENSION,
    outOfFuel: (budget: number) => new OutOfFuel(budget),
    require: (id: string): unknown => {
      if (Object.prototype.hasOwnProperty.call(modules, id)) return modules[id]
      // Un `import` que no está en la lista es un error del programa y tiene que
      // doler acá, al montar, y no dentro de un tick.
      throw new Error(`la habilidad importa "${id}", que no existe adentro del sandbox`)
    },
  }

  return fabrica(anima, ...nombres.map((n) => scope[n]))
}

/**
 * UN TANQUE PARA UNA HABILIDAD PARTIDA EN VARIOS MÓDULOS.
 *
 * El contador `__fuelLeft` es una variable del alcance de CADA `mount()`, y eso
 * es lo que lo hace barato (una ranura de contexto en vez de una búsqueda de
 * propiedad por iteración). El precio es que **cada mount tiene su propio
 * tanque**, y el ejecutor recarga uno solo: en cuanto la habilidad llama a un
 * ayudante que vive en otro módulo, ese módulo arranca con el tanque en cero y
 * el primer `--__fuelLeft` de adentro lanza `OutOfFuel`.
 *
 * No es hipotético: **once de las quince innatas morían así** la primera vez que
 * se las montó de verdad, todas en la primera llamada a un ayudante de
 * `comun.js`. Desde afuera se ve como «la habilidad se pasó del presupuesto» —
 * el peor diagnóstico posible, porque manda a optimizar código que no gastó
 * nada—. El síntoma es inconfundible una vez que se sabe: `spent` del tanque que
 * el ejecutor sí recarga sale en 3 y la habilidad está rota por combustible.
 *
 * `unirCeldas` devuelve una celda que recarga TODAS con el mismo tanque y
 * reporta el peor gasto. Recargar cada una con el tanque entero y no con una
 * fracción es a propósito: la habilidad tiene UN presupuesto y no sabe cuántos
 * módulos la componen; repartirlo haría que agregar un `import` la ahogue.
 *
 * La cota que se pierde es de un factor N (N módulos podrían gastar N tanques en
 * un paso). Se acepta porque N lo fija quien EMPAQUETA la habilidad y no quien
 * la escribe, y porque el tanque ya tiene 9× de margen contra el 10% del tick.
 * Si algún día una habilidad se empaqueta en veinte módulos, esto se cambia por
 * un contador compartido —una propiedad de objeto— y se vuelve a medir lo que
 * cuesta.
 */
export function unirCeldas(celdas: readonly FuelCell[]): FuelCell {
  return {
    refill(n: number): void {
      for (const c of celdas) c.refill(n)
    },
    get left(): number {
      // La más apretada manda: es la primera que va a lanzar.
      return celdas.reduce((min, c) => (c.left < min ? c.left : min), Number.POSITIVE_INFINITY)
    },
    get spent(): number {
      return celdas.reduce((max, c) => (c.spent > max ? c.spent : max), 0)
    },
  }
}

// ─── El presupuesto, en un solo lugar ───────────────────────────────────────
//
// Los números del ADR II-0007: el tick es un parámetro y el presupuesto es una
// FRACCIÓN, porque una fracción sobrevive a que cambie la frecuencia y un número
// en milisegundos solo significa algo contra un tick que hay que acordarse.
// Están acá y no en el test para que el banco no pueda acomodar su propio
// umbral: quien mide no elige contra qué.

/** ADR II-0008: la frecuencia de referencia, la única con `dt` exacto y barata. */
export const HZ_DE_REFERENCIA = 20

export const tickMs = (hz: number = HZ_DE_REFERENCIA): number => 1000 / hz

/** ADR II-0005: lo que puede costar INSTRUMENTAR. 2% del tick. */
export const FRACCION_INSTRUMENTAR = 0.02

/** ADR II-0005: lo que puede COMPUTAR una habilidad en un paso. 10% del tick. */
export const FRACCION_COMPUTO = 0.1

/**
 * El tanque por reanudación, en unidades de combustible (una por back-edge y
 * por entrada de función).
 *
 * De dónde sale el número, medido y no elegido: agotar 200.000 unidades con la
 * carga realista del banco cuesta **0,56 ms** (`presupuesto.test.ts` lo vuelve a
 * medir en cada corrida). Eso es el 1,1% del tick a 20 Hz, y la novena parte de
 * lo que el ADR II-0005 le concede a una habilidad para computar. Una habilidad
 * que lo agote no está pensando: está colgada, y lo que corresponde es que ceda
 * y la vea el ejecutor.
 */
export const FUEL_POR_PASO = 200_000
