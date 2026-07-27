import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { ForbiddenError, scanDeterminism, shadowScope } from '../src/aislamiento.js'
import { SUSPENSION, instrument, mount, type FuelCell } from '../src/combustible.js'
import { SkillRun, type Step, type WorldCtx } from '../src/ejecutor.js'
import type { StepResult } from '../src/ctx.js'
import { ACTOR, Mundito } from './mundito.js'

/**
 * ATAQUE AL SANDBOX — Hito 4.
 *
 * El mismo lente con el que siete adversarios tiraron 132 procesos contra
 * `admit()`, apuntado ahora a la caja donde corre el código que escribe el
 * modelo. No es una lista de buenas prácticas: es una lista de intentos, cada
 * uno corrido de verdad, y **lo que se cuela está marcado con `it.fails` y su
 * porqué**, no borrado.
 *
 * ─── LOS SEIS QUE SE COLABAN, Y CÓMO QUEDARON ───────────────────────────────
 *
 * De los seis `it.fails` con los que este archivo nació, CUATRO están cerrados y
 * pasaron a ser regresiones; los dos que quedan siguen en rojo con su porqué
 * adentro, que es la única forma honesta de dejarlos:
 *
 *   1. `(function(){}).constructor` sale al alcance global   ABIERTO, declarado
 *   2. mutar `at` mueve al cuerpo sin emitir intención        ABIERTO, es de
 *                                                            `@anima/perceive`
 *   3. el estado de MÓDULO sobrevive a la corrida             cerrado en la
 *                                                            puerta 1
 *   4. `abort()` mentía sobre si el generador cerró           cerrado
 *   5. `yield 42` viajaba al mundo como intención             cerrado
 *   6. una habilidad firmaba con el `by` de otro actor        cerrado — era el
 *                                                            grave, y era la
 *                                                            puerta de atrás de
 *                                                            la cuarentena
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
 * OJO CON UNA COSA, que es lo que hace al agujero 6 distinto de los otros cinco:
 * la firma de la intención NO es una defensa contra un adversario, es la
 * CONDICIÓN para que la cuarentena del ADR II-0003 signifique algo. Los permisos
 * se comparan contra el actor que firma; si el actor que firma lo elige el
 * firmante, no hay permisos. Eso no cae del lado de «equivocarse es imposible»:
 * cae del lado de «el mundo es el árbitro».
 *
 * ─── DÓNDE VIVE CADA DEFENSA, que es lo que este archivo vino a separar ─────
 *
 * Hay TRES puertas y no una, y confundirlas es cómo se declara segura una que no
 * lo es:
 *
 *   1. el ESCÁNER de determinismo — sintaxis y métodos de prototipo (`**`,
 *      `localeCompare`) que ninguna sombra puede tapar, y desde el cierre del
 *      agujero 3 también el estado mutable de nivel superior;
 *   2. el TYPECHECK contra el `.d.ts` emitido — lo que el compilador prohíbe,
 *      que resultó ser TODO el capítulo de mutación: `readonly` de verdad rebota
 *      las cuatro mutaciones probadas acá;
 *   3. las SOMBRAS y el alcance cerrado de `mount()` — lo que queda.
 *
 * Y una CUARTA que este archivo hizo aparecer: el EJECUTOR. No es una puerta de
 * entrada sino de salida —firma la autoría, numera la emisión, verifica la forma
 * de lo cedido y cierra de verdad lo que aborta— y es la única que puede hablar
 * de la corrida, porque es la única que sabe de quién es.
 *
 * Cuando una defensa vive en la puerta 2, hay que decirlo: significa que
 * cualquier camino que se saltee el typecheck queda desnudo. Lo mismo vale para
 * la 1, y por eso el agujero 3 tiene abajo su test de tiempo de ejecución.
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
    // POR QUÉ SIGUE ABIERTO: ESTE SE CUELA, está dicho en `mount()` desde el
    // primer día, y se deja en rojo a propósito para que nadie lea el archivo de
    // arriba y crea que la caja es hermética. No entra en la tanda de cierres del
    // ataque porque no es una reparación: es un cambio de motor de ejecución.
    //
    // EL DETALLE: el constructor de una función se alcanza desde
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
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, { by: ACTOR, cell: m.cell })
    const p = run.step()
    expect(p.k).toBe('intent')
    if (p.k === 'intent') expect((p.intent as unknown as { out: string }).out).toBe('rebotó')
  })

  it.fails('SE CUELA EN TIEMPO DE EJECUCIÓN: mutar `at` MUEVE al cuerpo y a la criatura', () => {
    // POR QUÉ SIGUE ABIERTO: la reparación no vive en este paquete. Quien
    // comparte la referencia de la celda con el mundo es la capa de PERCEPCIÓN, y
    // `@anima/perceive` no existe todavía; congelar las vistas o devolver la
    // celda como dos números es una decisión de esa capa y hay que medirla ahí,
    // no acá. Cerrarlo desde el ejecutor sería clonar en el lugar equivocado.
    //
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
    const run = new SkillRun(m.exports['habilidad'] as never, worldCtx(mundo), undefined as never, { by: ACTOR, cell: m.cell })
    run.step()
    expect(mundo.cuerpo('p')?.at.x, 'el cuerpo se movió sin intención').toBe(3)
    expect(mundo.posicion.y, 'la criatura se movió sin intención').toBe(0)
  })
})

// ─── 3. GUARDARSE EL MUNDO ENTRE CORRIDAS ───────────────────────────────────

describe('una habilidad que guarda una referencia al mundo entre corridas', () => {
  it('CERRADO EN LA PUERTA 1: el escáner no deja montar un módulo con estado mutable arriba', () => {
    // DÓNDE VIVE LA DEFENSA, que es lo primero que hay que decir: en el ESCÁNER,
    // o sea en la puerta 1. En tiempo de ejecución el agujero sigue existiendo
    // —el test de acá abajo lo deja pinchado— y no se puede cerrar sin montar de
    // nuevo por corrida, que cuesta un `new Function` por habilidad y por vida.
    // Lo que se cierra es la ENTRADA: un módulo con un `let` de nivel superior no
    // llega a montarse nunca, y eso es barato, sintáctico y verificable.
    //
    // La consecuencia, dicha porque es la misma que la del capítulo de mutación:
    // una defensa que vive en una sola puerta es una defensa con horario. Lo que
    // se cargue de un guardado sin volver a pasar por el escáner queda desnudo.
    const h = scanDeterminism(
      ts,
      `let guardado = null
       var contadas = 0
       const TABLA = { agua: 1 }
       export function* habilidad(ctx) {
         let local = guardado
         for (let i = 0; i < 3; i++) local = i
         yield { k: 'wait' }
         return { ok: true }
       }`,
    )
    // Los dos de arriba, y NINGUNO de los de adentro de la habilidad: una local
    // nace y muere con la llamada, y prohibirlas sería prohibir programar.
    expect(h.map((x) => x.what)).toEqual(['let guardado', 'var contadas'])
    expect(h[0]?.why).toMatch(/ctx\.memory/)
  })

  it('y las quince innatas y los 28 borradores pasan la regla nueva', () => {
    // La otra mitad de una regla nueva, y sin esto no se puede decir «cerrado»:
    // una puerta que rechaza el corpus que ya existe no está cerrando nada, está
    // rompiendo. Se miran los DOS corpus —las quince que escribimos a mano y los
    // 28 borradores de la escalera de capacidades, que son lo más parecido que
    // hay a lo que va a escribir el modelo— y ninguno usa estado de módulo.
    const rechazadas: string[] = []
    const mirar = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, e.name)
        if (e.isDirectory()) {
          mirar(ruta)
          continue
        }
        if (!e.name.endsWith('.ts')) continue
        const h = scanDeterminism(ts, readFileSync(ruta, 'utf8'), e.name).filter((x) => /^(let|var) /.test(x.what))
        if (h.length > 0) rechazadas.push(`${e.name}: ${h.map((x) => x.what).join(', ')}`)
      }
    }
    mirar(resolve(__dirname, '../src/innatas'))
    mirar(resolve(__dirname, '../borradores'))
    expect(rechazadas, `la regla nueva rechaza código que ya existe: ${rechazadas.join(' · ')}`).toEqual([])
  })

  it('el agujero de TIEMPO DE EJECUCIÓN sigue tal cual, y por eso la puerta 1 es la defensa', () => {
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
    // LAS DOS REPARACIONES, y por qué se eligió la segunda: (1) montar de nuevo
    // por corrida, que cierra el agujero de verdad y cuesta un `new Function` por
    // habilidad y por vida, y hay que medirlo antes; (2) que el escáner rechace
    // toda declaración mutable de nivel superior — barato, sintáctico y
    // verificable, y es el que se hizo (test de más arriba).
    //
    // Este test se queda midiendo el agujero TAL COMO ES para que nadie lea
    // «cerrado» de más: si algún día se paga la reparación (1), esto cambia de
    // conducta y hay que venir a mirarlo.
    const m = montar(`let guardado = null
      export function* habilidad(ctx) {
        const visto = guardado
        guardado = 'me acuerdo del mundo anterior'
        yield { k: 'wait', visto }
        return { ok: true }
      }`)
    const skill = m.exports['habilidad'] as never

    const primera = new SkillRun(skill, mundoMudo(), undefined as never, { by: ACTOR, cell: m.cell })
    const p1 = primera.step()
    expect(p1.k).toBe('intent')
    if (p1.k === 'intent') expect((p1.intent as unknown as { visto: unknown }).visto).toBe(null)
    // Y `save()` no lo ve: para el ejecutor esa habilidad no tiene estado.
    expect(primera.save().memory).toEqual({})

    m.cell.refill(1_000_000)
    const segunda = new SkillRun(skill, mundoMudo(), undefined as never, { by: ACTOR, cell: m.cell })
    const p2 = segunda.step()
    expect(p2.k).toBe('intent')
    if (p2.k !== 'intent') throw new Error('cambió de conducta: volver a mirar')
    expect(segunda.save().memory).toEqual({})
    // ACÁ ESTÁ EL AGUJERO: una corrida NUEVA, con memoria vacía, se acuerda de la
    // anterior. El escáner es lo único que impide que un módulo así llegue hasta
    // acá.
    expect((p2.intent as unknown as { visto: unknown }).visto, 'dejó de acordarse: volver a mirar').toBe(
      'me acuerdo del mundo anterior',
    )
  })

  it('lo que el ejecutor SÍ garantiza: dos habilidades no comparten `ctx.memory`', () => {
    // La otra mitad, y ésta está cerrada: `installSkillState` lanza si el `ctx`
    // ya tiene una memoria instalada, en vez de pisarla. Sin eso, dos habilidades
    // en vuelo sobre el mismo `ctx` compartirían su estado privado.
    const m = montar(`export function* habilidad(ctx) { ctx.memory.set('x', 1); yield { k: 'wait' }; return { ok: true } }`)
    const compartido = mundoMudo()
    void new SkillRun(m.exports['habilidad'] as never, compartido, undefined as never, { by: ACTOR, cell: m.cell })
    expect(() => new SkillRun(m.exports['habilidad'] as never, compartido, undefined as never, { by: ACTOR, cell: m.cell })).toThrow(
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
      by: ACTOR,
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

  it('EL MOTOR NO CAMBIÓ, y por eso hacía falta reparar el ejecutor', () => {
    // Se deja PINCHADO el hecho del motor sobre el que se apoya todo lo de abajo,
    // porque no es una elección nuestra y no se puede arreglar: un `yield` adentro
    // de un `finally` SECUESTRA el `return`. La especificación dice que el
    // generador se reanuda ahí y que `return()` devuelve `{ done: false }`, y como
    // la inyección de combustible ES un `yield`, cualquier `finally` con un bucle
    // suficientemente largo lo consigue sin proponérselo.
    //
    // Si algún día esto empieza a dar `done: true`, el motor cambió y hay que
    // volver a mirar `#cortar`.
    const m = montar(CON_FINALLY_INFINITO, 2_000)
    const skill = m.exports['habilidad'] as (c: unknown) => Generator<unknown, unknown, unknown>
    const g = skill({ phase: () => {} })
    expect(g.next().done).toBe(false)
    expect(g.return({ ok: false }).done, 'el motor ya no deja que el `finally` se coma el return').toBe(false)
    expect(g.next().value, 'sigue viva y sigue cediendo suspensiones').toBe(SUSPENSION)
  })

  it('CERRADO: `abort()` deja terminar el `finally` entero antes de declararla terminada', () => {
    // ES LA CARNADA: el `finally` tarda más de un tanque en soltar lo que tiene
    // en la mano. Con el `abort()` de antes —un solo `gen.return()`, sin mirar el
    // `done`— el `finally` quedaba a mitad de camino, `soltó` nunca se marcaba, y
    // el ejecutor reportaba `terminada` igual. Eso era el agujero: no se perdía
    // nada del mundo, se perdía la garantía que `abort()` estaba comprando, que
    // era «los `finally` de la habilidad corrieron».
    //
    // El tanque es chico a propósito (500 contra las ~2000 vueltas del bucle):
    // así hacen falta varias reanudaciones y se mide la insistencia, no la
    // suerte. En producción el tanque son 200.000 y un `finally` honesto cierra
    // en el primer intento.
    const marcas: string[] = []
    const mundoQueEscucha = (): WorldCtx =>
      ({ phase: undefined, say: (t: string) => void marcas.push(t) }) as unknown as WorldCtx
    const m = montar(`export function* habilidad(ctx) {
      try {
        yield { k: 'wait' }
      } finally {
        let n = 0
        while (n < 2000) { n++ }
        ctx.say('solté lo que tenía en la mano')
      }
    }`)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoQueEscucha(), undefined as never, {
      by: ACTOR,
      cell: m.cell,
      fuelPerStep: 500,
    })
    expect(run.step().k).toBe('intent')
    const paso = run.abort('la revocaron')
    expect(marcas, 'el `finally` quedó a mitad de camino y la habilidad se llevó el objeto a la tumba').toEqual([
      'solté lo que tenía en la mano',
    ])
    expect(paso).toEqual({ k: 'terminada', outcome: { ok: false, why: 'la revocaron' } })
    expect(run.status).toBe('terminada')
  })

  it('CERRADO: y si el `finally` no cierra NUNCA, el informe deja de decir «terminada»', () => {
    // La otra mitad, y es la que importaba de verdad: contra un `finally`
    // infinito no hay insistencia que alcance, así que se lo saca con
    // `gen.throw()` — y entonces sus `finally` NO corrieron enteros, que es
    // exactamente lo que `abort()` prometía. El informe lo dice en vez de
    // taparlo: un informe que miente envenena la grilla del juez del Hito 7
    // entera, y es peor que uno que falla.
    const m = montar(CON_FINALLY_INFINITO)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, {
      by: ACTOR,
      cell: m.cell,
      fuelPerStep: 500,
    })
    expect(run.step().k).toBe('intent')
    const paso = run.abort('la revocaron')
    expect(paso.k, 'volvió a declarar terminada una corutina que no cerró').toBe('rota')
    if (paso.k === 'rota') {
      expect(paso.why).toMatch(/la revocaron/)
      expect(paso.why).toMatch(/excepción/)
    }
    expect(run.status).toBe('rota')
    // Y quedó cerrada de verdad: el ejecutor no la vuelve a avanzar.
    expect(() => run.step()).toThrow(/no se puede avanzar/)
  })
})

// ─── 5. CEDER CUALQUIER COSA ────────────────────────────────────────────────

describe('una habilidad que hace `yield` de algo que no es un `Intent`', () => {
  function cede(valor: string): Step {
    const m = montar(`export function* habilidad(ctx) { yield ${valor}; return { ok: true } }`)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, { by: ACTOR, cell: m.cell })
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
    // para gastar ticks sin emitir ninguna intención.
    //
    // CAMBIÓ EL DESENLACE, y para mejor: antes la copia salía por `intent` y la
    // rechazaba el MUNDO; ahora la corta el ejecutor en la puerta, porque no
    // tiene `k` y la comprobación de forma del agujero 5 la ataja. Lo que este
    // test mide sigue siendo lo mismo —que no se la tome por una suspensión— y
    // se mide mejor: no cuenta como suspensión, no toca `maxStalls`, y muere con
    // el nombre de la habilidad y no con el del mundo.
    const p = cede(`{ __anima: 'suspension' }`)
    expect(p.k).toBe('rota')
    if (p.k === 'rota') expect(p.why).toMatch(/no es una intención/)
  })

  it('CERRADO: `yield 42`, `yield "hola"` y `yield {}` se cortan con el nombre de la HABILIDAD', () => {
    // Antes el ejecutor comprobaba `null`/`undefined` y la identidad de la
    // suspensión, y nada más: cualquier otra cosa salía por
    // `{ k: 'intent', intent }`. Un número llegaba a `stepWorld`, que lo rechaza
    // igual —`i.k` es `undefined` y no hay rama para eso— pero el rechazo nombra
    // al MUNDO y no a la habilidad, y el informe del juez lo cuenta como «el
    // mundo rechazó»: el diagnóstico equivocado en el archivo equivocado.
    //
    // POR QUÉ NO ERA PARANOIA: el modo de falla honesto es `yield goTo(...)`
    // escrito sin el `ctx.`, con un ayudante local que devuelve otra cosa; y
    // `yield` de una función que olvidó su `return`, que devuelve `undefined` y
    // ése ya estaba atajado. El de arriba no.
    for (const v of ['42', `'hola'`, 'true', '{}', '[]', `{ what: 'x' }`]) {
      const p = cede(v)
      expect(p.k, `yield ${v} se coló como intención`).toBe('rota')
      if (p.k === 'rota') expect(p.why).toMatch(/no es una intención/)
    }
  })

  it('y la frontera es la FORMA, no el contenido: un `k` que el mundo no conoce pasa igual', () => {
    // La contracara, y hay que dejarla escrita o la reparación de arriba se
    // convierte en otra cosa: el ejecutor ataja lo que ni siquiera tiene forma de
    // intención, y NO juzga si el `k` existe, si el cuerpo está, ni si el
    // compromiso está bien declarado. Eso es `stepWorld`, y tiene que seguir
    // siéndolo — es el mismo argumento por el que el ejecutor no le corrige el
    // `commitment` a nadie.
    const p = cede(`{ k: 'volar', commitment: 'reversible' }`)
    expect(p.k).toBe('intent')
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
    //
    // Y ESTO ES LA FRONTERA DE LA FIRMA, que desde el cierre del agujero 6 hay
    // que poder decir en una línea: el ejecutor estampa `by` y `seq` —que son
    // suyos, porque sabe de quién es la corrida y en qué orden emite— y NO toca
    // el `commitment`, que es del mundo. El día que alguien agregue una tercera
    // clave a la firma, tiene que poder contestar de cuál de los dos lados cae.
    const m = montar(`export function* habilidad(ctx) {
      yield { k: 'eat', what: 'x', by: 'ella', seq: 0, commitment: 'reversible' }
      return { ok: true }
    }`)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, { by: ACTOR, cell: m.cell })
    const p = run.step()
    expect(p.k).toBe('intent')
    // El ejecutor la deja pasar TAL CUAL, sin corregirle el compromiso: eso es lo
    // correcto, y es lo que permite que el mundo la rechace por mentir.
    if (p.k === 'intent') expect((p.intent as unknown as { commitment: string }).commitment).toBe('reversible')
  })

  it('CERRADO: la firma es de la casa — el `by` que escriba la habilidad no llega al mundo', () => {
    // ERA EL AGUJERO MÁS GRAVE DE LOS SEIS, y no por suplantación sola: era la
    // puerta de atrás de la CUARENTENA. `stepWorld` busca `d.actors.get(i.by)` y
    // compara los permisos DEL ACTOR QUE FIRMA, así que una habilidad
    // `provisional` —que entra con `permits: 'reversible'` por el ADR II-0003—
    // firmando con el `by` de otro se saltea el portón de confirmación entero. Y
    // el mundo no lo puede notar: le llega un arreglo plano de intenciones y no
    // sabe de qué corrida salió cada una. El único que lo sabe es el ejecutor.
    //
    // Cerrado en `SkillRun.step`, que devuelve `{ ...cedido, by: dueño, seq: n++ }`
    // con el spread ADELANTE para que la firma gane siempre.
    const m = montar(`export function* habilidad(ctx) {
      yield { k: 'eat', what: 'x', by: 'EL-CUIDADOR', seq: 77, commitment: 'irreversible' }
      return { ok: true }
    }`)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, { by: ACTOR, cell: m.cell })
    const p = run.step()
    expect(p.k).toBe('intent')
    if (p.k !== 'intent') throw new Error('cambió de conducta: volver a mirar')
    // Lo que la habilidad quiso hacer sigue viajando entero: acá no se le corrige
    // la intención, se le estampa la autoría.
    expect((p.intent as unknown as { what: string }).what).toBe('x')
    // Y la autoría es la de la corrida, no la que ella escribió.
    expect((p.intent as unknown as { by: string }).by, 'la intención salió firmada por otro').toBe(ACTOR)
    expect((p.intent as unknown as { seq: number }).seq, 'el `seq` también es de la casa').toBe(0)
  })

  it('CERRADO: el `seq` lo lleva la casa, y no se lo puede pisar para autorrechazarse', () => {
    // La otra mitad del mismo agujero, y tiene su propio daño: `stepWorld`
    // rechaza con `orden-duplicado` a las DOS intenciones que compartan
    // `(by, seq)`. Con el `seq` en manos de la habilidad, una que escribiera
    // `seq: 0` en todas se autorrechazaba —o peor, le arruinaba el tick a otra—.
    // Ahora sube de a uno por intención emitida y no hay forma de tocarlo.
    const m = montar(`export function* habilidad(ctx) {
      yield { k: 'wait', segundos: 1, by: 'OTRA', seq: 0, commitment: 'reversible' }
      yield { k: 'wait', segundos: 1, by: 'OTRA', seq: 0, commitment: 'reversible' }
      yield { k: 'wait', segundos: 1, by: 'OTRA', seq: 0, commitment: 'reversible' }
      return { ok: true }
    }`)
    const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, { by: ACTOR, cell: m.cell })
    const seqs: number[] = []
    const contestar: StepResult = { status: 'done', got: [] }
    for (let i = 0; i < 3; i++) {
      const p = run.step(i === 0 ? undefined : contestar)
      if (p.k !== 'intent') throw new Error(`paso ${i}: ${p.k}`)
      seqs.push((p.intent as unknown as { seq: number }).seq)
    }
    expect(seqs).toEqual([0, 1, 2])
  })

  it('CERRADO: el `seq` sale de LA CORRIDA, así que dos corridas iguales dan el mismo hash', () => {
    // ES LA CARNADA DE LA REPARACIÓN, y el motivo por el que estampar la autoría
    // no era de cinco líneas: el hash de la traza se toma sobre el `Intent`
    // ENTERO —`by` y `seq` adentro— y el criterio (d) del Hito 4 es «una
    // habilidad corrida dos veces da el mismo hash». Con un contador GLOBAL, la
    // segunda corrida arrancaría en 3 y el criterio se caería sin que se rompa
    // ningún test del ejecutor: se rompería el del juez, dos hitos después.
    const fuente = `export function* habilidad(ctx) {
      yield { k: 'wait', segundos: 1, commitment: 'reversible' }
      yield { k: 'wait', segundos: 2, commitment: 'reversible' }
      return { ok: true }
    }`
    const correr = (): { hash: string; seqs: number[] } => {
      const m = montar(fuente)
      const run = new SkillRun(m.exports['habilidad'] as never, mundoMudo(), undefined as never, {
        by: ACTOR,
        cell: m.cell,
      })
      const seqs: number[] = []
      let paso = run.step()
      for (let i = 0; paso.k === 'intent' && i < 5; i++) {
        seqs.push((paso.intent as unknown as { seq: number }).seq)
        paso = run.step({ status: 'done', got: [] })
      }
      return { hash: run.hash(), seqs }
    }
    const a = correr()
    const b = correr()
    expect(a.seqs).toEqual([0, 1])
    expect(b.seqs, 'la segunda corrida arrancó donde terminó la primera: el contador es global').toEqual(a.seqs)
    expect(b.hash, 'dos corridas iguales dieron hashes distintos: se cayó el criterio (d)').toBe(a.hash)
  })
})
