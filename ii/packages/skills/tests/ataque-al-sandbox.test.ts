import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { ForbiddenError, scanDeterminism, shadowScope } from '../src/aislamiento.js'
import { SUSPENSION, instrument, mount, type FuelCell } from '../src/combustible.js'
import { SkillRun, type Step, type WorldCtx } from '../src/ejecutor.js'
import type { StepResult } from '../src/ctx.js'
import { Mundito } from './mundito.js'

/**
 * ATAQUE AL SANDBOX — Hito 4.
 *
 * El mismo lente con el que siete adversarios tiraron 132 procesos contra
 * `admit()`, apuntado ahora a la caja donde corre el código que escribe el
 * modelo. No es una lista de buenas prácticas: es una lista de intentos, cada
 * uno corrido de verdad, y **lo que se cuela está marcado con `it.fails` y su
 * porqué**, no borrado.
 *
 * ─── EL MODELO DE AMENAZA, dicho antes de medir ─────────────────────────────
 *
 * El documento de arquitectura lo fija y hay que respetarlo o los resultados no
 * significan nada: *código tonto de un proveedor de confianza media, no un
 * adversario con exploits de motor*. La caja existe para que **equivocarse sea
 * imposible**, no para contener a alguien que quiere salirse. Por eso el escape
 * por `(function(){}).constructor` está abajo con `it.fails` y no con un parche:
 * taparlo pide un intérprete propio, y eso es un proyecto, no un renglón.
 *
 * ─── DÓNDE VIVE CADA DEFENSA, que es lo que este archivo vino a separar ─────
 *
 * Hay TRES puertas y no una, y confundirlas es cómo se declara segura una que no
 * lo es:
 *
 *   1. el ESCÁNER de determinismo — sintaxis y métodos de prototipo (`**`,
 *      `localeCompare`) que ninguna sombra puede tapar;
 *   2. el TYPECHECK contra el `.d.ts` emitido — lo que el compilador prohíbe,
 *      que resultó ser TODO el capítulo de mutación: `readonly` de verdad rebota
 *      las cuatro mutaciones probadas acá;
 *   3. las SOMBRAS y el alcance cerrado de `mount()` — lo que queda.
 *
 * Cuando una defensa vive en la puerta 2, hay que decirlo: significa que
 * cualquier camino que se saltee el typecheck queda desnudo.
 */

const scope = shadowScope()

function montar(fuente: string, tanque = 1_000_000): { exports: Record<string, unknown>; cell: FuelCell } {
  const { js } = instrument(ts, fuente)
  const m = mount(js, { scope })
  m.cell.refill(tanque)
  return m
}

const mundoMudo = (): WorldCtx => ({ phase: undefined }) as unknown as WorldCtx

/**
 * Monta y corre la función exportada; devuelve el error, o `null` si no lanzó.
 *
 * El `try` envuelve TAMBIÉN el montaje, y no es prolijidad: un `import` de nivel
 * superior se resuelve al montar y no al llamar, así que la mitad de los ataques
 * de acá abajo rebotan antes de que exista una función a la que llamar.
 */
function loQuePasa(fuente: string): Error | null {
  try {
    const m = montar(fuente)
    ;(m.exports['correr'] as () => unknown)()
    return null
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e))
  }
}

// ─── 1. SALIR DE LA CAJA ────────────────────────────────────────────────────

describe('una habilidad que intenta alcanzar lo que no existe adentro', () => {
  const REBOTES: readonly { readonly nombre: string; readonly cuerpo: string; readonly dice: RegExp }[] = [
    { nombre: 'Math.random()', cuerpo: 'return Math.random()', dice: /ctx\.rng/ },
    { nombre: 'new Date()', cuerpo: 'return new Date().getTime()', dice: /ctx\.tick|ctx\.clock/ },
    { nombre: 'Date.now()', cuerpo: 'return Date.now()', dice: /ctx\.tick|ctx\.clock/ },
    { nombre: 'globalThis', cuerpo: 'return globalThis.process', dice: /alcance global/ },
    { nombre: 'process.env', cuerpo: 'return process.env.HOME', dice: /proceso ni entorno/ },
    { nombre: 'performance.now()', cuerpo: 'return performance.now()', dice: /reloj de pared/ },
    { nombre: 'fetch(…)', cuerpo: "return fetch('http://x')", dice: /no habla con afuera/ },
    { nombre: 'setTimeout', cuerpo: 'return setTimeout(function(){}, 0)', dice: /ctx\.wait/ },
    { nombre: 'console.log', cuerpo: "return console.log('hola')", dice: /ctx\.say/ },
    { nombre: 'new Function(…)', cuerpo: "return new Function('return 1')()", dice: /fabricar código nuevo/ },
    { nombre: 'localStorage', cuerpo: "return localStorage.getItem('x')", dice: /ctx\.memory/ },
  ]

  for (const r of REBOTES) {
    it(`${r.nombre} rebota, y el error dice qué usar en su lugar`, () => {
      const e = loQuePasa(`export function correr() { ${r.cuerpo} }`)
      expect(e, `${r.nombre} NO rebotó`).toBeInstanceOf(ForbiddenError)
      expect(e?.message, `el error de ${r.nombre} no enseña nada: "${e?.message}"`).toMatch(r.dice)
    })
  }

  it('`require` solo sirve lo que el host le pasó, y lo demás lo nombra', () => {
    const e = loQuePasa(`import * as fs from 'node:fs'\nexport function correr() { return fs.readFileSync('/etc/passwd') }`)
    expect(e).toBeInstanceOf(Error)
    expect(e?.message).toMatch(/importa "node:fs", que no existe adentro del sandbox/)
  })

  it('`import()` dinámico no llega al host, y tiene DOS puertas y no una', async () => {
    // La primera puerta es de empaquetado y hay que decirla en voz alta porque es
    // frágil: `instrument()` emite CommonJS, y TypeScript reescribe
    // `import(x)` a `Promise.resolve().then(() => require(x))`. O sea que muere
    // en la sombra de `Promise`, que está prohibida porque una habilidad es un
    // generador SINCRÓNICO. Si algún día el target pasa a ESM, esa puerta se
    // cae sola y nadie se entera.
    //
    // La segunda es la que sobrevive a eso: el `require` del sandbox no conoce
    // ningún módulo que el host no le haya pasado. Por eso el test verifica LAS
    // DOS —la de hoy por su mensaje, y la de mañana quitándole la sombra a
    // `Promise` para ver qué queda debajo—.
    const conSombra = loQuePasa(`export function correr() { return import('node:fs') }`)
    expect(conSombra?.message).toMatch(/"Promise" no existe/)

    const { js } = instrument(ts, `export function correr() { return import('node:fs') }`)
    const sinSombraDePromise = { ...scope }
    delete sinSombraDePromise['Promise']
    const m = mount(js, { scope: sinSombraDePromise })
    m.cell.refill(1_000_000)
    // Sin la sombra, `import()` es una promesa de verdad y el rebote llega
    // rechazándola: hay que esperarla o el error se pierde y el test miente.
    let debajo: unknown
    try {
      await (m.exports['correr'] as () => Promise<unknown>)()
    } catch (e) {
      debajo = e
    }
    expect((debajo as Error | undefined)?.message).toMatch(/importa "node:fs", que no existe adentro del sandbox/)
  })

  it('lo que ninguna sombra puede tapar lo ataja el escáner, antes de correr una línea', () => {
    // `**` es SINTAXIS y `localeCompare` es un método de prototipo: taparlos
    // sería parchear los intrínsecos para todo el hilo y romperle el mundo al
    // mundo. Por eso el escáner corre antes que el typecheck.
    const h = scanDeterminism(ts, `export function correr(a, b) { return (a ** 2) + a.localeCompare(b) + b.toLocaleString() }`)
    expect(h.map((x) => x.what).sort()).toEqual(['**', '.localeCompare()', '.toLocaleString()'].sort())
  })

  it.fails('EL ESCAPE DECLARADO: `(function(){}).constructor` sale al alcance global', () => {
    // ESTE SE CUELA, está dicho en `mount()` desde el primer día, y se deja en
    // rojo a propósito para que nadie lea el archivo de arriba y crea que la caja
    // es hermética.
    //
    // POR QUÉ NO SE TAPA: el constructor de una función se alcanza desde
    // CUALQUIER función que la habilidad pueda ver, incluida una que se escriba
    // ella misma. Cerrarlo pide congelar `Function.prototype` para todo el hilo
    // —lo que le rompe el motor al mundo, que corre en el mismo worker— o
    // ejecutar en un intérprete propio, que es exactamente la decisión que el
    // documento tomó al revés cuando descartó QuickJS por el costo del cruce de
    // frontera.
    //
    // POR QUÉ SE ACEPTA: el modelo de amenaza es «código tonto de un proveedor de
    // confianza media». Nadie escribe `(function(){}).constructor` por
    // distracción; se escribe para salirse. Y el día que se ejecuten habilidades
    // COMPARTIDAS ENTRE USUARIOS este renglón deja de ser aceptable y hay que
    // volver a un intérprete: queda escrito acá para que esa decisión no se tome
    // sin verlo.
    const e = loQuePasa(`export function correr() { return (function(){}).constructor('return typeof process')() }`)
    // Primero se PINCHA el agujero tal como es hoy —no lanza nada, o sea que
    // corrió código en el alcance global y vio `process`— para que este test no
    // pueda quedar rojo por otra razón y parecer que sigue midiendo esto.
    expect(e, 'lanzó algo: el escape cambió de forma y hay que volver a mirarlo').toBeNull()
    // Y recién después lo que DEBERÍA pasar, que es lo que hace fallar al test.
    expect(e, 'el escape se cerró: hay que actualizar el modelo de amenaza').toBeInstanceOf(ForbiddenError)
  })
})

// ─── 2. MUTAR EN VEZ DE DEVOLVER ────────────────────────────────────────────

describe('una habilidad que muta el objeto que recibe en vez de devolver uno nuevo', () => {
  /** El `Ctx` del mundito sin `memory`/`phase`, con los getters intactos. */
  function worldCtx(m: Mundito): WorldCtx {
    const base = m.ctx() as unknown as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(base)) {
      if (k === 'memory' || k === 'phase') continue
      const d = Object.getOwnPropertyDescriptor(base, k)
      if (d) Object.defineProperty(out, k, { ...d, configurable: true, enumerable: true })
    }
    return out as unknown as WorldCtx
  }

  const CUATRO_MUTACIONES = `import type { Ctx, Intent, Outcome, StepResult } from './skill-api.js'
import { done } from './skill-api.js'
export function* f(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  const b = ctx.see([{ q: 'mass', op: '>=', v: 1 }])[0]
  if (b) { b.at.x = 999 }
  ctx.self.at.y = 777
  ctx.hz = 999
  ctx.memory = null
  yield ctx.wait(1)
  return done()
}
`

  it('LA DEFENSA ES EL COMPILADOR: las cuatro mutaciones son errores de tipos', () => {
    // Y hay que decir dónde vive la defensa, porque de eso depende quién la
    // pierde: `readonly` no existe en tiempo de ejecución. Estas cuatro no pasan
    // porque el `.d.ts` emitido declara `Cell` con `readonly x/y`, `Ctx.hz`
    // `readonly` y `Ctx.memory` `readonly`, y esos `readonly` salen del código
    // real de `@anima/world` y de `src/ctx.ts` — o sea que no se pueden olvidar
    // de actualizar.
    const RUTA = 'F:/proyectos/Anima/ii/packages/skills/src/__ataque.ts'
    const host = ts.createCompilerHost({})
    const orig = host.getSourceFile.bind(host)
    host.getSourceFile = (f, l, e, s) => (f === RUTA ? ts.createSourceFile(f, CUATRO_MUTACIONES, l) : orig(f, l, e, s))
    host.fileExists = (f) => f === RUTA || ts.sys.fileExists(f)
    const prog = ts.createProgram([RUTA], {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noEmit: true,
      skipLibCheck: true,
      lib: ['lib.es2022.d.ts'],
      types: [],
    }, host)
    const mensajes = prog
      .getSemanticDiagnostics(prog.getSourceFile(RUTA))
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
    expect(mensajes).toEqual([
      `Cannot assign to 'x' because it is a read-only property.`,
      `Cannot assign to 'y' because it is a read-only property.`,
      `Cannot assign to 'hz' because it is a read-only property.`,
      `Cannot assign to 'memory' because it is a read-only property.`,
    ])
  })

  it('`ctx.memory` no se puede pisar ni siquiera salteándose el typecheck', () => {
    // Ésta sí está defendida en tiempo de ejecución, y a propósito: la instala
    // `installSkillState` con `defineProperty` sin `writable`, y el sandbox corre
    // en `"use strict"`, donde asignar a una propiedad de solo lectura LANZA en
    // vez de no hacer nada en silencio. Es la única sede de estado que sobrevive
    // a un guardado: pisarla es perder la partida sin enterarse.
    const m = montar(`export function* habilidad(ctx) {
      let out = 'PISADA'
      try { ctx.memory = { get(){}, set(){}, del(){} } } catch (e) { out = 'rebotó' }
      yield { k: 'wait', out }
      return { ok: true }
    }`)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, { cell: m.cell })
    const p = run.step()
    expect(p.k).toBe('intent')
    if (p.k === 'intent') expect((p.intent as unknown as { out: string }).out).toBe('rebotó')
  })

  it.fails('SE CUELA EN TIEMPO DE EJECUCIÓN: mutar `at` MUEVE al cuerpo y a la criatura', () => {
    // El typecheck lo rebota (test de arriba). El SANDBOX no: la vista de
    // percepción comparte la referencia de la celda con el mundo, así que
    // `b.at.x = 999` teletransporta un cuerpo y `ctx.self.at.y = 777` mueve a la
    // criatura, sin emitir ninguna intención y sin pasar por `stepWorld`.
    //
    // Medido acá contra el mundito, que copia la forma del mundo de verdad:
    // `BodyView.at` sale de `Body.at` sin clonar, porque clonar una celda por
    // cuerpo y por tick es exactamente el gasto que el Hito 2 se pasó cuatro
    // semanas sacando.
    //
    // POR QUÉ IMPORTA IGUAL AUNQUE EL COMPILADOR LO ATAJE: la puerta 2 la
    // atraviesa TODO lo que el modelo escribe, pero no lo que se carga de un
    // guardado, ni una innata que alguien parchee, ni un camino futuro en JS sin
    // tipos. Una defensa que vive en una sola puerta es una defensa con horario.
    //
    // REPARACIÓN, si algún día se decide pagarla: congelar las vistas con
    // `Object.freeze` al construirlas (cuesta, y hay que medirlo), o devolver la
    // celda como dos números y no como objeto.
    const mundo = new Mundito({ cuerpos: [{ id: 'p', at: { x: 3, y: 0 }, name: 'piedra', q: { mass: 5 } }] })
    const m = montar(`export function* habilidad(ctx) {
      const b = ctx.see([{ q: 'mass', op: '>=', v: 1 }])[0]
      b.at.x = 999
      ctx.self.at.y = 777
      yield { k: 'wait' }
      return { ok: true }
    }`)
    const run = new SkillRun(m.exports['habilidad'] as never, worldCtx(mundo), undefined as never, { cell: m.cell })
    run.step()
    expect(mundo.cuerpo('p')?.at.x, 'el cuerpo se movió sin intención').toBe(3)
    expect(mundo.posicion.y, 'la criatura se movió sin intención').toBe(0)
  })
})

// ─── 3. GUARDARSE EL MUNDO ENTRE CORRIDAS ───────────────────────────────────

describe('una habilidad que guarda una referencia al mundo entre corridas', () => {
  it.fails('SE CUELA: el estado de MÓDULO sobrevive a la corrida, y `save()` no lo ve', () => {
    // El documento es explícito: «la ÚNICA sede de estado que sobrevive a un
    // guardado es `ctx.memory`». Y es verdad para las variables LOCALES de la
    // habilidad —una corutina suspendida no se serializa—, pero no para las de
    // MÓDULO: `mount()` evalúa el módulo UNA vez y sus `let` de nivel superior
    // viven mientras viva el montaje, o sea entre corridas y entre criaturas.
    //
    // Es la peor forma de esta clase de bug, y por eso está acá y no en una nota:
    // ese estado NO viaja en `save()` —así que se pierde al cargar la partida— y
    // SÍ sobrevive dentro de una sesión —así que la habilidad anda distinto la
    // segunda vez—. Las dos mitades de lo contrario de lo que hace falta. Una
    // habilidad que memorice así el pozo de agua «funciona» toda la partida y
    // aparece rota recién después de cargar, que es cuando ya nadie relaciona
    // las dos cosas.
    //
    // REPARACIÓN, en orden de costo: (1) montar de nuevo por corrida, que cuesta
    // un `new Function` por habilidad y por vida y hay que medirlo; (2) que el
    // escáner rechace toda declaración mutable de nivel superior en el módulo de
    // una habilidad — barato, sintáctico y verificable, y es el que conviene.
    const m = montar(`let guardado = null
      export function* habilidad(ctx) {
        const visto = guardado
        guardado = 'me acuerdo del mundo anterior'
        yield { k: 'wait', visto }
        return { ok: true }
      }`)
    const skill = m.exports['habilidad'] as never

    const primera = new SkillRun(skill, mundoMudo(), undefined as never, { cell: m.cell })
    const p1 = primera.step()
    expect(p1.k).toBe('intent')
    if (p1.k === 'intent') expect((p1.intent as unknown as { visto: unknown }).visto).toBe(null)
    // Y `save()` no lo ve: para el ejecutor esa habilidad no tiene estado.
    expect(primera.save().memory).toEqual({})

    m.cell.refill(1_000_000)
    const segunda = new SkillRun(skill, mundoMudo(), undefined as never, { cell: m.cell })
    const p2 = segunda.step()
    expect(p2.k).toBe('intent')
    if (p2.k !== 'intent') throw new Error('cambió de conducta: volver a mirar')
    expect(segunda.save().memory).toEqual({})
    // ACÁ SE CAE: una corrida NUEVA, con memoria vacía, se acuerda de la anterior.
    expect((p2.intent as unknown as { visto: unknown }).visto, 'la corrida nueva se acordó de la vieja').toBe(null)
  })

  it('lo que el ejecutor SÍ garantiza: dos habilidades no comparten `ctx.memory`', () => {
    // La otra mitad, y ésta está cerrada: `installSkillState` lanza si el `ctx`
    // ya tiene una memoria instalada, en vez de pisarla. Sin eso, dos habilidades
    // en vuelo sobre el mismo `ctx` compartirían su estado privado.
    const m = montar(`export function* habilidad(ctx) { ctx.memory.set('x', 1); yield { k: 'wait' }; return { ok: true } }`)
    const compartido = mundoMudo()
    void new SkillRun(m.exports['habilidad'] as never, compartido, undefined as never, { cell: m.cell })
    expect(() => new SkillRun(m.exports['habilidad'] as never, compartido, undefined as never, { cell: m.cell })).toThrow(
      /cada habilidad en vuelo necesita el suyo/,
    )
  })
})

// ─── 4. EL COMBUSTIBLE ADENTRO DE UN `finally` ──────────────────────────────

describe('una habilidad que agota el combustible adentro de un `finally`', () => {
  const CON_FINALLY_INFINITO = `export function* habilidad(ctx) {
      try { yield { k: 'wait' } } finally { let n = 0; while (true) { n++ } }
    }`

  it('se corta igual: cede, y a las N suspensiones el ejecutor la declara trabada', () => {
    // El `finally` está en el CUERPO del generador, así que la inyección puede
    // ceder ahí y cede: la habilidad no se cuelga, suspende. Lo que el
    // combustible solo no puede dar es el corte —cede prolijamente para siempre—
    // y por eso existe `maxStalls`. Las dos piezas juntas cierran el caso.
    const m = montar(CON_FINALLY_INFINITO)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, {
      cell: m.cell,
      maxStalls: 3,
      fuelPerStep: 2_000,
    })
    expect(run.step().k).toBe('intent')
    let paso: Step = run.step({ status: 'done', got: [] } as StepResult)
    let reanudaciones = 0
    while (paso.k === 'suspendida' && reanudaciones++ < 50) paso = run.step()
    expect(paso.k).toBe('rota')
    if (paso.k === 'rota') expect(paso.why).toMatch(/trabada/)
  })

  it.fails('SE CUELA: `abort()` la declara terminada, pero el generador NO se cerró', () => {
    // `abort()` usa `gen.return()` y no un `throw` para que corran los `finally`
    // que la habilidad haya escrito, que es lo correcto. Pero un `yield` adentro
    // de un `finally` SECUESTRA el `return`: la especificación dice que el
    // generador se reanuda y `return()` devuelve `{ done: false }`. Como la
    // inyección de combustible ES un `yield`, cualquier `finally` con un bucle
    // suficientemente largo lo consigue sin proponérselo.
    //
    // Medido: `g.return(x)` devuelve `{ value: SUSPENSION, done: false }` y el
    // siguiente `g.next()` sigue devolviendo lo mismo. El ejecutor no mira
    // `done`, así que reporta `terminada` sobre una corutina que sigue viva.
    //
    // QUÉ SE PIERDE: nada del mundo —el ejecutor no la vuelve a avanzar— pero sí
    // la garantía que `abort()` estaba comprando, que era «los `finally` de la
    // habilidad corrieron». Un `finally` que suelta lo que tenía en la mano NO
    // corre, y la habilidad se lleva el objeto a la tumba.
    //
    // REPARACIÓN: mirar el `done` de `gen.return()` y, si es `false`, insistir un
    // número acotado de veces (el `finally` va a ceder por combustible) y si aún
    // así no cierra, `gen.throw()`. Son cinco líneas en `abort()` y valen la pena
    // porque hoy el informe MIENTE, que es peor que fallar.
    const m = montar(CON_FINALLY_INFINITO)
    const skill = m.exports['habilidad'] as (c: unknown) => Generator<unknown, unknown, unknown>
    const g = skill({ phase: () => {} })
    expect(g.next().done).toBe(false)
    expect(g.return({ ok: false }).done, 'el `finally` se comió el return: el generador sigue vivo').toBe(true)
    expect(g.next().value).not.toBe(SUSPENSION)
  })
})

// ─── 5. CEDER CUALQUIER COSA ────────────────────────────────────────────────

describe('una habilidad que hace `yield` de algo que no es un `Intent`', () => {
  function cede(valor: string): Step {
    const m = montar(`export function* habilidad(ctx) { yield ${valor}; return { ok: true } }`)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, { cell: m.cell })
    return run.step()
  }

  it('`yield null` y `yield undefined` se cortan con nombre', () => {
    for (const v of ['null', 'undefined']) {
      const p = cede(v)
      expect(p.k, `yield ${v}`).toBe('rota')
      if (p.k === 'rota') expect(p.why).toMatch(/no es una intención/)
    }
  })

  it('una suspensión FALSIFICADA no se toma por una suspensión', () => {
    // `isSuspension` compara por IDENTIDAD y no por forma, y esto es lo que esa
    // decisión compra: una habilidad no puede fabricarse una suspensión para
    // saltearse el contador de suspensiones (y con él el corte de `maxStalls`) ni
    // para gastar ticks sin emitir ninguna intención. La copia se trata como lo
    // que es —una intención rarísima— y la rechaza el mundo.
    const p = cede(`{ __anima: 'suspension' }`)
    expect(p.k).toBe('intent')
    if (p.k === 'intent') expect(p.intent).not.toBe(SUSPENSION)
  })

  it.fails('SE CUELA: `yield 42` y `yield "hola"` viajan al mundo como si fueran intenciones', () => {
    // El ejecutor comprueba `null`/`undefined` y la identidad de la suspensión, y
    // nada más: cualquier otra cosa sale por `{ k: 'intent', intent }`. Un número
    // llega a `stepWorld`, que lo va a rechazar —`i.k` es `undefined` y no hay
    // rama para eso— pero el rechazo va a nombrar al MUNDO y no a la habilidad,
    // y el informe del juez lo va a contar como «el mundo rechazó», que es el
    // diagnóstico equivocado en el archivo equivocado.
    //
    // POR QUÉ NO ES PARANOIA: el modo de falla honesto es `yield ctx.goTo(...)`
    // escrito sin el `ctx.` —`yield goTo(...)` con un helper local que devuelve
    // otra cosa— y `yield` de una función que olvidó su `return`, que devuelve
    // `undefined` y ése SÍ está atajado. El de arriba no.
    //
    // REPARACIÓN: dos líneas en `SkillRun.step` —`typeof cedido !== 'object'` o
    // `typeof cedido.k !== 'string'` es `rota` con «cedió algo que no es una
    // intención»— y el mismo mensaje que ya existe para `null`. Es exactamente el
    // criterio con el que el mundo rechaza un `commitment` mal declarado: el
    // constructor evita el error honesto y la verificación ataja el deshonesto.
    // Primero se pincha el agujero tal como es hoy: los tres salen por `intent`.
    for (const v of ['42', `'hola'`, 'true']) {
      const p = cede(v)
      expect(p.k, `yield ${v} cambió de conducta: volver a mirar`).toBe('intent')
      if (p.k === 'intent') expect(typeof p.intent).not.toBe('object')
    }
    // Y esto es lo que debería pasar.
    for (const v of ['42', `'hola'`, 'true']) {
      expect(cede(v).k, `yield ${v} se coló como intención`).toBe('rota')
    }
  })
})

// ─── 6. UN `Intent` CONSTRUIDO A MANO ───────────────────────────────────────

describe('una habilidad que devuelve un `Intent` construido a mano en vez de por `ctx`', () => {
  it('el mundo revisa el `commitment`: declarar `reversible` un `eat` no sirve de nada', () => {
    // Ésta está cerrada, y no acá: la cierra `stepWorld`, que RECALCULA el
    // compromiso de cada intención y rechaza con `compromiso-mal-declarado` si no
    // coincide (`revisarCompromiso`, `world/src/intent.ts:243`). Es lo que hace
    // verdadera la frase del documento: «código real y aislado no significa
    // código privilegiado». Los constructores de `ctx` evitan el error honesto;
    // la verificación del mundo ataja el deshonesto, y hacen falta los dos.
    //
    // Acá se verifica la mitad que le toca a este paquete: que el ejecutor NO
    // pretenda arreglarlo, porque si lo arreglara el mundo dejaría de ser el
    // árbitro y una habilidad podría mentirle a `stepWorld` sin que se note.
    const m = montar(`export function* habilidad(ctx) {
      yield { k: 'eat', what: 'x', by: 'ella', seq: 0, commitment: 'reversible' }
      return { ok: true }
    }`)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, { cell: m.cell })
    const p = run.step()
    expect(p.k).toBe('intent')
    // El ejecutor la deja pasar TAL CUAL, sin corregirle el compromiso: eso es lo
    // correcto, y es lo que permite que el mundo la rechace por mentir.
    if (p.k === 'intent') expect((p.intent as unknown as { commitment: string }).commitment).toBe('reversible')
  })

  it.fails('SE CUELA: una habilidad puede firmar una intención con el `by` DE OTRO actor', () => {
    // `SkillRun.step()` devuelve lo cedido verbatim: no estampa `by` ni `seq`.
    // O sea que una habilidad puede emitir `{ k: 'eat', by: 'el-cuidador', … }` y
    // el mundo la va a atender como si viniera del cuidador — `stepWorld` busca
    // `d.actors.get(i.by)` y si ese actor existe, actúa. No hay forma de que el
    // mundo lo note: le llega un array plano de intenciones y no sabe de qué
    // corrida salió cada una.
    //
    // Y no es solo suplantación: es la puerta de atrás de la CUARENTENA. Una
    // habilidad `provisional` entra con `permits: 'reversible'` y `stepWorld`
    // compara contra los permisos DEL ACTOR QUE FIRMA. Firmando con otro `by`, el
    // ADR II-0003 y el portón de confirmación se saltean juntos.
    //
    // REPARACIÓN, y va en este paquete porque es el único que sabe de quién es la
    // corrida: `SkillRun` recibe el `ActorId` dueño y `step()` devuelve
    // `{ ...cedido, by: dueño, seq: n++ }`. El `seq` de la casa además cierra el
    // otro agujero —dos intenciones con el mismo `seq` las rechaza el mundo con
    // `orden-duplicado`, así que hoy una habilidad puede autorechazarse—.
    const m = montar(`export function* habilidad(ctx) {
      yield { k: 'eat', what: 'x', by: 'EL-CUIDADOR', seq: 0, commitment: 'irreversible' }
      return { ok: true }
    }`)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, { cell: m.cell })
    const p = run.step()
    // Se pincha el agujero: hoy la intención sale entera y sin tocar.
    expect(p.k).toBe('intent')
    if (p.k !== 'intent') throw new Error('cambió de conducta: volver a mirar')
    expect((p.intent as unknown as { what: string }).what).toBe('x')
    // Y esto es lo que debería pasar: el ejecutor estampa la autoría.
    expect((p.intent as unknown as { by: string }).by, 'la intención salió firmada por otro').not.toBe('EL-CUIDADOR')
  })
})
