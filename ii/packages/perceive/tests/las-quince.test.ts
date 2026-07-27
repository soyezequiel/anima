/**
 * LAS QUINCE INNATAS CONTRA EL MUNDO DE VERDAD — criterio (a) del tramo B.
 *
 * ─── EL CRITERIO, escrito ANTES de implementar ──────────────────────────────
 *
 *   (a) las quince innatas corren de punta a punta contra el mundo REAL, no
 *       contra el Mundito. Cuántas terminan, cuántas se rompen, y por qué cada
 *       una que se rompe. Ése es el número que dice si la costura sirve.
 *
 * Es esperable que varias no anden: el Hito 4 las corrió contra un juguete de
 * quinientas líneas cuyo `goTo` TELETRANSPORTA y cuyo `apply('union')` devuelve
 * el ensamble en el mismo tick. **El número se reporta, no se arregla escondiendo
 * las que fallan**: cada una que no termina bien queda en la tabla de abajo con
 * su motivo, y el `expect` final compara contra la tabla entera.
 *
 * ─── QUÉ SIGNIFICA CADA COLUMNA ─────────────────────────────────────────────
 *
 *   corre    el generador llegó a un `return`. Lo contrario es «rota»: una
 *            excepción, o el ejecutor la cortó por trabada o sin combustible.
 *   ok       ese `return` fue `done()` y no `fail()`. Un `fail` honesto —«no
 *            llegué», «no me da el aliento»— NO es un defecto de la costura: es
 *            la habilidad diciendo que el mundo no la dejó. Se distingue igual,
 *            porque una habilidad que siempre falla no sirve para nada.
 */

import { describe, expect, it } from 'vitest'
import type { CellState, WorldBody, WorldState } from '@anima/world'
import { keyOfCell } from '@anima/world'
import type { BodyView, Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import {
  aplicarProceso,
  comer,
  deshilachar,
  esperar,
  explorar,
  frotar,
  guarecerse,
  huirDelDolor,
  ir,
  juntar,
  poner,
  seguirOrdenDeMovimiento,
  sostener,
  tantear,
  unir,
} from '@anima/skills/innatas'

import { Partida } from '../src/index.js'
import { conElla, cuerpo } from './mundo.js'

type Hab = Generator<Intent, Outcome, StepResult>

const enElPiso = (id: string, sust: string, masa: number, x: number, y: number): WorldBody => ({
  body: cuerpo(id, sust, masa),
  at: { x, y },
})

const caliente = (t: number): CellState => ({ wet: 0, oxygen: 1, temperature: t })

interface Caso {
  readonly nombre: string
  /** El mundo en el que corre. Cada una necesita el suyo: no hay escenario neutro. */
  readonly mundo: () => WorldState
  readonly correr: (ctx: Ctx) => Hab
  readonly ticks?: number
}

/** Un mundo con una celda escrita a mano. Es cómo se pone agua o calor. */
function conCelda(w: WorldState, at: { x: number; y: number }, c: CellState): WorldState {
  const cells = new Map(w.cells)
  cells.set(keyOfCell(at), c)
  return { ...w, cells }
}

/** Busca en la vista por cualidad; explota con un mensaje útil si no está. */
function unica(ctx: Ctx, q: import('@anima/skills').QualityId, v: number): BodyView {
  const b = ctx.see([{ q, op: '>=', v }])[0]
  if (b === undefined) throw new Error(`no hay nada con ${q} >= ${String(v)} a la vista`)
  return b
}

function enMano(ctx: Ctx, id: string): BodyView {
  const b = ctx.self.holding.find((x) => x.id === id)
  if (b === undefined) throw new Error(`${id} no está en la mano`)
  return b
}

const CASOS: readonly Caso[] = [
  {
    nombre: 'ir',
    mundo: () => conElla([]),
    correr: (ctx) => ir(ctx, { a: { x: 5, y: -3 } }),
  },
  {
    nombre: 'explorar',
    // El agua no es un cuerpo: es `wet`, un campo de celda. Se busca con `qAt`,
    // que es lo que el propio `Ctx` dice («buscar agua es `qAt` o `recall`, nunca
    // `see`»). La celda mojada está a ocho de distancia, o sea FUERA del disco de
    // radio 6 que `explorar` barre al arrancar: si no, la habilidad terminaría
    // sin explorar y el test no probaría nada.
    mundo: () => conCelda(conElla([]), { x: 8, y: 0 }, { wet: 1, oxygen: 1, temperature: 20 }),
    correr: (ctx) =>
      explorar(ctx, { buscoEnLaCelda: { q: 'wet', op: '>=', v: 0.5 }, maxTicks: 300 }),
    ticks: 500,
  },
  {
    nombre: 'juntar',
    mundo: () => conElla([enElPiso('r1', 'raiz-dura', 0.3, 1, 0), enElPiso('r2', 'raiz-dura', 0.3, 2, 1)]),
    correr: (ctx) => juntar(ctx, { que: [{ q: 'rigidity', op: '>=', v: 0.4 }], cuantos: 2 }),
  },
  {
    nombre: 'comer',
    mundo: () => conElla([enElPiso('bocado', 'medula', 1, 1, 0)], { stamina: 200 }),
    correr: (ctx) => comer(ctx, {}),
  },
  {
    nombre: 'unir',
    mundo: () =>
      conElla([enElPiso('vara', 'madera', 0.4, 0, 0), enElPiso('atadura', 'liana', 0.2, 0, 0)], {
        holding: ['vara', 'atadura'],
      }),
    correr: (ctx) => unir(ctx, { a: enMano(ctx, 'vara'), binder: enMano(ctx, 'atadura') }),
  },
  {
    nombre: 'deshilachar',
    mundo: () => conElla([enElPiso('cuerda', 'liana', 1, 0, 0)], { holding: ['cuerda'] }),
    correr: (ctx) => deshilachar(ctx, { fuente: enMano(ctx, 'cuerda'), cuantas: 1 }),
    ticks: 400,
  },
  {
    nombre: 'aplicar-proceso',
    mundo: () => conElla([enElPiso('cuerda', 'liana', 1, 0, 0)], { holding: ['cuerda'] }),
    correr: (ctx) =>
      aplicarProceso(ctx, {
        proceso: 'deshilachar',
        roles: { source: enMano(ctx, 'cuerda'), actor: ctx.self },
      }),
    ticks: 400,
  },
  {
    nombre: 'poner',
    mundo: () => conElla([enElPiso('vara', 'madera', 0.4, 0, 0)], { holding: ['vara'] }),
    correr: (ctx) => poner(ctx, { que: enMano(ctx, 'vara'), en: { x: 1, y: 0 } }),
  },
  {
    nombre: 'sostener',
    mundo: () => conElla([enElPiso('vara', 'madera', 0.4, 2, 0)]),
    correr: (ctx) => sostener(ctx, { que: unica(ctx, 'rigidity', 0.6) }),
  },
  {
    nombre: 'frotar',
    mundo: () =>
      conElla([enElPiso('palo', 'madera', 0.3, 0, 0), enElPiso('otro', 'madera-dura', 0.3, 0, 0)], {
        holding: ['palo', 'otro'],
        stamina: 900,
      }),
    correr: (ctx) => frotar(ctx, { a: enMano(ctx, 'palo'), b: enMano(ctx, 'otro'), hasta: 60 }),
    ticks: 1200,
  },
  {
    nombre: 'tantear',
    mundo: () => conElla([enElPiso('piedra', 'piedra', 2, 1, 0)]),
    correr: (ctx) => tantear(ctx, { que: unica(ctx, 'rigidity', 0.9) }),
    ticks: 200,
  },
  {
    nombre: 'huir-del-dolor',
    mundo: () => conCelda(conElla([]), { x: 0, y: 0 }, caliente(200)),
    correr: (ctx) => huirDelDolor(ctx, {}),
  },
  {
    nombre: 'guarecerse',
    mundo: () => conElla([enElPiso('techo', 'arcilla', 2, 0, 0)], { holding: ['techo'] }),
    correr: (ctx) => guarecerse(ctx, { conQue: enMano(ctx, 'techo') }),
  },
  {
    nombre: 'esperar',
    mundo: () => conElla([]),
    correr: (ctx) => esperar(ctx, { segundos: 2 }),
    ticks: 200,
  },
  {
    nombre: 'seguir-orden-de-movimiento',
    mundo: () => conElla([]),
    correr: (ctx) => seguirOrdenDeMovimiento(ctx, { orden: { verbo: 'ir', a: { x: -4, y: 2 } } }),
  },
]

interface Resultado {
  readonly nombre: string
  readonly corre: boolean
  readonly ok: boolean
  readonly why: string
  readonly ticks: number
  readonly fase: string
}

function correrCaso(c: Caso): Resultado {
  const p = new Partida(c.mundo())
  // El argumento se arma ADENTRO de la habilidad, con la vista viva: no hay forma
  // de construir un `BodyView` desde afuera sin duplicar la proyección.
  const skill = function* (ctx: Ctx): Hab {
    return yield* c.correr(ctx)
  }
  const v = p.volar('ella', skill, undefined)
  const tope = c.ticks ?? 120
  let n = 0
  while (!v.terminado && n < tope) {
    p.tick()
    n++
  }
  const u = v.ultimo
  const corre = v.outcome !== undefined && u?.k === 'terminada'
  const why =
    u?.k === 'rota'
      ? `ROTA: ${u.why}`
      : v.outcome === undefined
        ? `NO TERMINÓ en ${String(tope)} ticks`
        : v.outcome.ok
          ? ''
          : v.outcome.why
  return { nombre: c.nombre, corre, ok: v.outcome?.ok === true, why, ticks: n, fase: v.run.phase }
}

describe('(a) las quince innatas contra `stepWorld`', () => {
  it('las quince corren de punta a punta, y acá está el número', () => {
    const salida: Resultado[] = CASOS.map(correrCaso)

    const tabla = salida
      .map(
        (r) =>
          `${r.nombre.padEnd(28)} ${r.corre ? 'corre' : 'ROTA '} ${r.ok ? 'logra ' : 'NO    '} ${String(r.ticks).padStart(4)}t  ${r.why}`,
      )
      .join('\n')
    const corren = salida.filter((r) => r.corre).length
    const logran = salida.filter((r) => r.ok).length
    // La tabla se imprime SIEMPRE, pase o falle el test: es el entregable del
    // criterio (a), y un número que sólo se ve cuando algo falla no es un número.
    console.log(
      `\n─── LAS QUINCE CONTRA EL MUNDO DE VERDAD ───\n${tabla}\n\ncorren ${String(corren)}/15 · logran su contrato ${String(logran)}/15\n`,
    )

    expect(salida.length).toBe(15)

    // NINGUNA se rompe. «Rota» es una excepción o un corte del ejecutor, o sea la
    // costura fallando; que las quince lleguen a un `return` es lo que dice que la
    // costura sirve.
    const rotas = salida.filter((r) => !r.corre).map((r) => `${r.nombre}: ${r.why}`)
    expect(rotas, 'habilidades ROTAS contra el mundo de verdad').toEqual([])

    // Y las que NO logran su contrato se listan por nombre y por motivo, para que
    // el número no pueda derivar en silencio ni para arriba ni para abajo. Las dos
    // que quedan **no son huecos de la costura**: son dos cosas que el mundo y la
    // física no dan, medidas abajo con su `it.fails` cada una.
    const noLogran = salida.filter((r) => !r.ok).map((r) => `${r.nombre}: ${r.why}`)
    expect(noLogran).toEqual([
      'explorar: no encontré en 300 ticks',
      'frotar: el calor se va más rápido de lo que entra',
    ])
    expect(corren).toBe(15)
    expect(logran).toBe(13)
  })

  it('`guarecerse` cierra el hueco del `covering: ctx.self`, y se verifica releyendo', () => {
    // El Hito 4 lo dejó anotado como «el modo de fallo caro: pasa tipos, pasa
    // smoke, produce un número que vale 0 para siempre», porque
    // `put(techo, at, {covering: ctx.self})` TYPECHEQUEA —`SelfView extends
    // BodyView`— y nadie había escrito nunca si la ley 12 ocluye sobre la
    // criatura. Contra el mundo de verdad: SÍ ocluye.
    const p = new Partida(conElla([enElPiso('techo', 'arcilla', 2, 0, 0)], { holding: ['techo'] }))
    const v = p.volar('ella', (ctx: Ctx) => guarecerse(ctx, { conQue: enMano(ctx, 'techo') }), undefined)
    for (let i = 0; i < 40 && !v.terminado; i++) p.tick()
    expect(v.outcome?.ok).toBe(true)
    expect(p.proyeccion.indice.celda({ x: 0, y: 0 }).sheltered).toBeGreaterThanOrEqual(0.5)
  })
})

// ─── LOS DOS QUE NO LOGRAN, MEDIDOS ─────────────────────────────────────────

describe('los dos que no logran su contrato, y por qué', () => {
  it.fails('EL `explore` DEL MUNDO NO LLEGA A NINGUNA PARTE: es un ciclo cerrado de 8 celdas', () => {
    // POR QUÉ SIGUE ABIERTO: el hueco está en `@anima/world`, no en la costura, y
    // es aritmético. `intencionExplorar` (`world/src/step.ts`) elige el rumbo con
    // `OCHO_RUMBOS[(tick + huellaDeTexto(actorId)) % 8]`, y **la suma de los ocho
    // rumbos es exactamente (0,0)**: (1,0)+(1,1)+(0,1)+(-1,1)+(-1,0)+(-1,-1)+
    // (0,-1)+(1,-1). Como el índice avanza de a uno por tick, cada ocho ticks la
    // criatura vuelve al punto de partida. Medido: el recorrido de 20 ticks es
    // `-1,1 -2,1 -3,0 -3,-1 -2,-2 -1,-2 0,-1 0,0` repetido dos veces y media.
    //
    // O sea que `explore` visita OCHO CELDAS y nunca sale de ahí, por mucho
    // `maxTicks` que se le dé. El propio archivo del mundo dice que es
    // «deliberadamente pobre» y que la exploración con memoria y frontera es de
    // otro hito; lo que no dice —y es lo que este número agrega— es que el neto
    // es cero, o sea que no explora NADA.
    //
    // Y toca el primer criterio del Hito 5 de frente: «con hambre y un río a la
    // vista» se salva porque el río está a la vista, pero cualquier cosa que haya
    // que ir a buscar más allá del radio de percepción es inalcanzable.
    //
    // QUÉ HARÍA FALTA: que el rumbo tenga PERSISTENCIA —el mismo durante N ticks—
    // o que salga de una frontera de lo no visitado. Es `intencionExplorar` en
    // `world/src/step.ts`, y como cambia la conducta del mundo, cambia el hash de
    // toda partida guardada: pide su ADR.
    const p = new Partida(conElla([], { stamina: 900 }))
    p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        yield ctx.explore({ until: () => false, maxTicks: 100 })
        return { ok: true }
      },
      undefined,
    )
    p.avanzar(100)
    const at = p.state.bodies.get('ella-cuerpo')!.at
    expect(Math.max(Math.abs(at.x), Math.abs(at.y)), 'cien ticks explorando y no se alejó').toBeGreaterThan(10)
  })

  it.fails('LA FRICCIÓN NO PRENDE FUEGO: llega a 46,77 °C y la ignición de la madera está en 300', () => {
    // POR QUÉ SIGUE ABIERTO: el hueco está en la CALIBRACIÓN de `@anima/physics`,
    // no en la costura. `friccion` declara `drive` de `temperature` hacia 400 a
    // 120 por segundo, con `poweredBy: {from:'actor', q:'stamina', efficiency:
    // 0.35}`, y la ley 1 relaja hacia el ambiente con un coeficiente dividido por
    // `heatCapacity`. Con `heatCapacity = 1.7 × masa` para la madera, las dos
    // curvas se cruzan MUY por debajo del punto de ignición, y el óptimo no está
    // en ningún extremo:
    //
    //   masa   heatCapacity   T tras 400 ticks
    //   0,05   0,085          15,00   (el ambiente: no sube nada)
    //   0,1    0,170          15,00
    //   0,3    0,510          15,09
    //   1      1,700          26,25
    //   3      5,100          46,77   ← el mejor de todos
    //   10     17,00          20,66
    //   30     51,00           7,03
    //
    // Y en todos salvo el primero la criatura **se muere de hambre antes de los
    // 400 ticks**: frotar cuesta `heatCapacity × 6 / 0,35` de stamina por tick,
    // que a masa 3 son 87 por tick contra los 1000 de tope.
    //
    // O sea: **encender el primer fuego frotando dos palos es imposible con el
    // catálogo semilla**, y es la técnica emblema de toda la arquitectura. Que
    // `frotar` lo detecte y se rinda con «el calor se va más rápido de lo que
    // entra» es la habilidad funcionando bien: mide `ctx.rateOf` y corta.
    //
    // QUÉ HARÍA FALTA: recalibrar. O `H_PERDIDA` de la ley 1
    // (`physics/src/leyes.ts`), o la eficiencia de `FRICCION`
    // (`physics/src/process.ts`), o que el `drive` no compita contra la ley 1 en
    // el mismo tick. Es una perilla de diseño con una ventana medible —igual que
    // `COSTO_VIVIR_POR_SEGUNDO` en el ADR II-0009— y pide su ADR con el barrido
    // adelante. Elegir el número acá sería calibrar la física desde el arnés.
    const p = new Partida(
      conElla([enElPiso('palo', 'madera', 3, 0, 0), enElPiso('otro', 'madera-dura', 3, 0, 0)], {
        holding: ['palo', 'otro'],
        stamina: 1000,
      }),
    )
    const v = p.volar(
      'ella',
      (ctx: Ctx) => frotar(ctx, { a: enMano(ctx, 'palo'), b: enMano(ctx, 'otro') }),
      undefined,
    )
    for (let i = 0; i < 500 && !v.terminado; i++) p.tick()
    expect(v.outcome?.ok, 'la fricción no llegó al punto de ignición').toBe(true)
  })
})
