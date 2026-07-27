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
import { qualityOf } from '@anima/physics'
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
    // el número no pueda derivar en silencio ni para arriba ni para abajo. La que
    // queda **no es un hueco de la costura**: es una cosa que el mundo no da,
    // medida abajo con su `it.fails`.
    //
    // ERA 13/15 Y AHORA ES 14/15, y el número cambió sin que la costura se tocara:
    // `frotar` fallaba con «el calor se va más rápido de lo que entra» —su guarda
    // de `rateOf`— porque la ley 1 relajaba la temperatura en el mismo tick en que
    // la fricción la subía. El ADR II-0010 («frotar no relaja») suspendió esa
    // relajación mientras el `drive` está activo, así que la tasa neta pasó a ser
    // los +120 °C/s que `FRICCION` declara y la guarda ya no se dispara. El número
    // viejo queda escrito acá al lado del nuevo, como pide el proyecto: un hueco
    // que se cierra sin dejar rastro se puede volver a abrir sin que nadie lo note.
    const noLogran = salida.filter((r) => !r.ok).map((r) => `${r.nombre}: ${r.why}`)
    expect(noLogran).toEqual(['explorar: no encontré en 300 ticks'])
    expect(corren).toBe(15)
    expect(logran).toBe(14)
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

// ─── LO QUE NO LOGRA, Y LO QUE PASÓ A LOGRAR ─────────────────────────────────
//
// ERAN DOS y ahora es UNA. `frotar` pasó a lograr su contrato con el ADR II-0010
// y su hueco quedó CERRADO abajo, con la tabla vieja escrita al lado de la nueva
// y con lo que el 14/15 no dice: el contrato dura un tick.
describe('el que no logra su contrato, y el que pasó a lograrlo', () => {
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

  it('CERRADO · con una vara LIVIANA la fricción sí llega al punto de ignición', () => {
    // ERA UN `it.fails` («LA FRICCIÓN NO PRENDE FUEGO: llega a 46,77 °C y la
    // ignición de la madera está en 300») y lo cerró el ADR II-0010, «frotar no
    // relaja». Lo que estaba mal no era la calibración: era que la ley 1 relajaba
    // la temperatura en el MISMO tick en que el `drive` la subía, así que las dos
    // se estancaban en un punto fijo muy por debajo de la ignición.
    //
    // Y con la relajación suspendida la TABLA SE DA VUELTA, que es lo que hace
    // falta escribir para que el hueco no se reabra por el lado equivocado. Antes
    // ganaba la vara más PESADA —más `heatCapacity`, meseta más alta— y ahora la
    // tasa es 120 °C/s y punto, así que lo único que la masa mueve es el PRECIO y
    // gana la más liviana:
    //
    //   masa   heatCapacity   ANTES (400 ticks)     AHORA (pico, tanque de 1000)
    //   0,05   0,085          15,00                 400,00
    //   0,1    0,170          15,00                 400,00
    //   0,3    0,510          15,09                 400,00
    //   1      1,700          26,25                 220,53
    //   3      5,100          46,77 ← el mejor      83,59 ← el peor de los que suben
    //   10     17,00          20,66                 35,59
    //   30     51,00           7,03                 21,86
    //
    // La tabla está medida en `world/tests/ataque-2-al-fuego.test.ts`.
    const p = new Partida(
      conElla([enElPiso('palo', 'madera', 0.3, 0, 0), enElPiso('otro', 'madera-dura', 0.3, 0, 0)], {
        holding: ['palo', 'otro'],
        stamina: 1000,
      }),
    )
    const v = p.volar(
      'ella',
      (ctx: Ctx) => frotar(ctx, { a: enMano(ctx, 'palo'), b: enMano(ctx, 'otro') }),
      undefined,
    )
    let pico = 0
    for (let i = 0; i < 500 && !v.terminado; i++) {
      p.tick()
      const b = p.state.bodies.get('palo')
      if (b !== undefined) pico = Math.max(pico, qualityOf(b.body, 'temperature', p.state.phys))
    }
    // `frotar` sin `hasta` apunta al `ignitionPoint` del cuerpo, que para la
    // madera son 300: o sea que lograr el contrato ES dejarla lista para prender.
    expect(v.outcome?.ok, 'la fricción no llegó al punto de ignición').toBe(true)
    expect(pico).toBeGreaterThanOrEqual(300)

    // ─── Y ACÁ ESTÁ LO QUE EL 14/15 NO DICE ────────────────────────────────
    //
    // La habilidad devuelve `done(a)` —«lo dejé listo para que prenda»— y UN TICK
    // DESPUÉS la vara está a 20,6 °C. No es un bug de la habilidad: el `drive`
    // deja de empujar cuando el vuelo termina, y la ley 1 relaja a fondo porque
    // el acople satura para todo cuerpo liviano (ADR II-0010, «el diente de
    // sierra», medido en `world/tests/ataque-2-al-fuego.test.ts`). O sea que el
    // contrato de `frotar` es cierto en el instante del `return` y falso para
    // quien lo lea. El 14/15 cuenta un contrato que dura un tick.
    //
    // Queda escrito acá y no en un `it.fails` propio porque el hueco YA está
    // abierto y con su porqué en `world/tests/el-fuego.test.ts` («el fuego
    // tendría que sobrevivir a la mano que lo hizo»): esto es el mismo hueco
    // visto desde la superficie de la mente, y es donde más se nota.
    const t = p.state.bodies.get('palo')
    const alFinal = qualityOf(t!.body, 'temperature', p.state.phys)
    expect(alFinal).toBeLessThan(300)
    console.log(
      `\n─── frotar logra su contrato y el contrato dura un tick ───\n` +
        `pico durante el vuelo: ${pico.toFixed(2)} °C (ignición 300)\n` +
        `un tick después del \`done\`: ${alFinal.toFixed(2)} °C\n`,
    )
  })

  it.fails('SIGUE ABIERTO · con una vara de 3 kg la fricción sigue sin llegar, y ahora es por el PRECIO', () => {
    // POR QUÉ SIGUE ABIERTO: cambió la causa y hay que decirlo, porque el porqué
    // que este hueco tenía escrito («la ley 1 relaja proporcional al hueco y las
    // dos curvas se cruzan muy por debajo de la ignición») YA NO ES CIERTO — el
    // ADR II-0010 lo arregló. Lo que queda es económico y no térmico.
    //
    // `friccion` cobra `heatCapacity × ΔT / 0,35` de `stamina`, y `heatCapacity`
    // es EXTENSIVA: una vara de 3 kg de madera tiene 5,10 y cuesta 87,4 por paso a
    // 20 Hz. El tanque topa en 1000 —`clampToRange`, y no hay forma de escribir
    // más— así que alcanza para ONCE pasos. MEDIDO en el mundo entero: la criatura
    // se muere en el paso 12 (0,60 s) con la vara a 83,59 °C, contra 300 de
    // ignición. Antes del ADR II-0010 el mismo banco daba 46,77 °C tras 400 ticks;
    // ahora sube casi el doble en la treintava parte del tiempo y se queda sin
    // fuerzas igual.
    //
    // O sea: encender el primer fuego frotando dos palos YA NO ES IMPOSIBLE —el
    // test de arriba lo hace con 0,3 kg— pero sigue habiendo un tamaño a partir
    // del cual no se puede, y ese tamaño es 0,55 kg de madera (medido en
    // `world/tests/el-fuego.test.ts`). El hueco que queda abierto es el de este
    // banco: la vara de 3 kg que la habilidad emblema usaba.
    //
    // QUÉ HARÍA FALTA: o que un tanque de `stamina` pueda pasar de 1000
    // (`physics/src/data/cualidades.ts`, el rango de `stamina`), o que el fuego se
    // pueda hacer por partes —encender una yesca liviana y pasarle el fuego al
    // leño, que es lo que la cadena de `world/tests/el-fuego.test.ts` hace y que
    // sólo cierra el día que el fuego sobreviva a la mano que lo hizo—. Lo segundo
    // es el hueco abierto del ADR II-0010 y es un ADR con barrido.
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
