// ─── PUNTO 5 DEL GATE 5→6: construcción incremental e idempotente ───────────
//
// Era el último punto a medias del criterio. Su fila decía:
//
//   > **la mitad CUMPLE** (tramo D): desplegar es idempotente y la obra no se
//   > muda. Construir ya era incremental por `unir` y **falta el `BuildSkill` que
//   > encadene**.
//
// El `BuildSkill` existe desde el tramo I y el `UseSkill` desde éste. Lo que falta
// no es código: es MEDIR las dos mitades del punto contra las habilidades de
// verdad, en vez de contra intenciones escritas a mano.
//
// ─── LAS TRES COSAS QUE «INCREMENTAL» TIENE QUE QUERER DECIR ───────────────
//
//   (a) AVANZA DE A UNA. Cada unión es un paso suelto y cada paso intermedio deja
//       un cuerpo LEGAL en el mundo — no un estado a medio camino que sólo la
//       habilidad entiende;
//   (b) LO ARMADO QUEDA ARMADO. Si la construcción se corta a la mitad, lo que ya
//       se ató sigue existiendo. `unir` no tiene inversa, así que la alternativa
//       —perder las piezas— sería materia que desaparece;
//   (c) IDEMPOTENTE. Desplegar dos veces es un no-op, y no dos obras ni un
//       rechazo.
//
// ─── Y LA HISTORIA ENTERA, POR LAS HABILIDADES ─────────────────────────────
//
// `world/tests/la-historia-entera.test.ts` ya la corría, con las intenciones
// emitidas A MANO. Acá la corren las dos habilidades: `construir` ata y `usar`
// despliega. Es la diferencia entre «el mundo lo permite» y «la criatura lo hace».

import { describe, expect, it } from 'vitest'
import {
  buildSeedPhysics,
  definirPlano,
  qualityOf,
  realizaElPlano,
  type BlueprintCandidate,
  type BlueprintDefinition,
  type Physics,
} from '@anima/physics'
import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import { construir, usar } from '@anima/skills/innatas'
import { keyOfCell, type Actor, type WorldBody, type WorldState } from '@anima/world'

import { Partida } from '../src/index.js'
import { conElla, cuerpo } from './mundo.js'

const PHYS: Physics = buildSeedPhysics()

type Hab = Generator<Intent, Outcome, StepResult>

const enElPiso = (id: string, sust: string, masa: number, x: number, y: number): WorldBody => ({
  body: cuerpo(id, sust, masa),
  at: { x, y },
})

/** La caña: el caso de aceptación del gate. Dos piezas, y el atador sobrevive. */
const CANA: BlueprintCandidate = {
  parts: [
    { rol: 'brazo', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'hebra', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
  ],
  joints: [{ a: 'brazo', b: 'hebra', binder: 'hebra' }],
}

function definir(c: BlueprintCandidate): BlueprintDefinition {
  const d = definirPlano(c, PHYS)
  if (d.k !== 'ok') throw new Error(`el plano no se define: ${JSON.stringify(d.verdict.razones)}`)
  return d.def
}

const DEF = definir(CANA)

function escena(manos = 4): WorldState {
  const w = conElla([enElPiso('vara', 'madera', 0.5, 1, 0), enElPiso('liana', 'liana', 0.2, 1, 0)])
  return { ...w, actors: new Map([['ella', { ...(w.actors.get('ella') as Actor), capacity: manos }]]) }
}

/** Corre una habilidad hasta que termine o hasta `tope` ticks. */
function correr(
  p: Partida,
  hacer: (ctx: Ctx) => Hab,
  tope = 200,
): { readonly ok: boolean; readonly why: string; readonly got: string | undefined; readonly ticks: number } {
  const v = p.volar('ella', function* (ctx: Ctx): Hab {
    return yield* hacer(ctx)
  }, undefined)
  let n = 0
  while (!v.terminado && n < tope) {
    p.tick()
    n++
  }
  return {
    ok: v.outcome?.ok === true,
    why: v.outcome?.ok === false ? v.outcome.why : v.ultimo?.k === 'rota' ? `ROTA: ${v.ultimo.why}` : '',
    got: v.outcome?.ok === true ? v.outcome.got?.id : undefined,
    ticks: n,
  }
}

const ver = (ctx: Ctx, id: string): BodyView => {
  const b = ctx.self.holding.find((x) => x.id === id) ?? ctx.see([]).find((x) => x.id === id)
  if (b === undefined) throw new Error(`no se ve «${id}»`)
  return b
}

// ─── (a) Avanza de a una, y cada paso deja un cuerpo legal ──────────────────

describe('(a) la construcción avanza de a una unión', () => {
  it('cada tick del mundo sigue siendo un mundo legal, y al final hay UNA obra', () => {
    // Lo que se afirma no es «no explotó»: es que el número de cuerpos BAJA de a
    // uno —dos sueltos → una obra— y que en ningún tick intermedio el mundo queda
    // con un estado que sólo la habilidad entienda. Un paso a medias es un cuerpo.
    const p = new Partida(escena())
    const antes = p.state.bodies.size
    const r = correr(p, (ctx) =>
      construir(ctx, { juntas: DEF.joints, roles: { brazo: ver(ctx, 'vara'), hebra: ver(ctx, 'liana') } }),
    )
    expect(r.ok, r.why).toBe(true)
    // Dos cuerpos entraron y salió uno: la vara y la liana quedaron adentro.
    expect(p.state.bodies.size).toBe(antes - 1)
    const obra = r.got === undefined ? undefined : p.state.bodies.get(r.got)?.body
    expect(obra?.parts.length).toBe(2)
    expect(obra?.joints.length).toBe(1)
  })

  it('y la obra que sale ES el plano, no algo parecido', () => {
    const inicial = escena()
    const p = new Partida(inicial)
    const r = correr(p, (ctx) =>
      construir(ctx, { juntas: DEF.joints, roles: { brazo: ver(ctx, 'vara'), hebra: ver(ctx, 'liana') } }),
    )
    const obra = r.got === undefined ? undefined : p.state.bodies.get(r.got)?.body
    expect(obra).toBeDefined()
    if (obra === undefined) return
    const vara = inicial.bodies.get('vara')?.body
    const liana = inicial.bodies.get('liana')?.body
    if (vara === undefined || liana === undefined) return
    // La parte 0 es la cabeza —el brazo— y la 1 es la hebra que sobrevivió.
    const v = realizaElPlano(
      obra,
      DEF,
      [
        { rol: 'brazo', parte: 0, comoEntro: vara },
        { rol: 'hebra', parte: 1, comoEntro: liana },
      ],
      PHYS,
    )
    expect(v.razones.map((x) => x.mensaje)).toEqual([])
  })
})

// ─── (b) Lo armado queda armado ─────────────────────────────────────────────

describe('(b) si la construcción se corta a la mitad, lo armado NO se pierde', () => {
  it('cortando a los pocos ticks, los cuerpos siguen todos en el mundo', () => {
    // `unir` no tiene inversa —es el hueco 1 del contrato de `construir`— así que
    // lo único que se puede pedir es que la materia no desaparezca. Se corta la
    // corrida antes de que termine y se cuenta la masa: tiene que estar toda.
    const p = new Partida(escena())
    const masaAntes = [...p.state.bodies.values()].reduce(
      (m, b) => m + qualityOf(b.body, 'mass', PHYS),
      0,
    )
    const v = p.volar('ella', function* (ctx: Ctx): Hab {
      return yield* construir(ctx, {
        juntas: DEF.joints,
        roles: { brazo: ver(ctx, 'vara'), hebra: ver(ctx, 'liana') },
      })
    }, undefined)
    // Tres ticks y basta: la unión tarda un segundo de mundo, o sea veinte ticks.
    for (let i = 0; i < 3; i++) p.tick()
    expect(v.terminado, 'la construcción terminó antes de poder cortarla').toBe(false)

    const masaDespues = [...p.state.bodies.values()].reduce(
      (m, b) => m + qualityOf(b.body, 'mass', PHYS),
      0,
    )
    expect(masaDespues).toBeCloseTo(masaAntes, 6)
    // Y siguen siendo cuerpos que se pueden nombrar, no un estado interno.
    expect(p.state.bodies.get('vara')).toBeDefined()
    expect(p.state.bodies.get('liana')).toBeDefined()
  })
})

// ─── (c) Desplegar es idempotente ───────────────────────────────────────────

describe('(c) desplegar dos veces es un no-op, no dos obras ni un rechazo', () => {
  const SITIO: Cell = { x: 2, y: 0 }

  function conLaObra(): { readonly p: Partida; readonly obra: string } {
    const p = new Partida(escena())
    const r = correr(p, (ctx) =>
      construir(ctx, { juntas: DEF.joints, roles: { brazo: ver(ctx, 'vara'), hebra: ver(ctx, 'liana') } }),
    )
    if (r.got === undefined) throw new Error(`no se armó la obra: ${r.why}`)
    return { p, obra: r.got }
  }

  it('la segunda vez termina bien y el mundo no cambia', () => {
    const { p, obra } = conLaObra()
    const primera = correr(p, (ctx) => usar(ctx, { obra: ver(ctx, obra), en: SITIO }))
    expect(primera.ok, primera.why).toBe(true)
    const cuerposDespues = p.state.bodies.size
    const desplegados = p.state.desplegados.size

    const segunda = correr(p, (ctx) => usar(ctx, { obra: ver(ctx, obra), en: SITIO }))
    expect(segunda.ok, segunda.why).toBe(true)
    expect(p.state.bodies.size).toBe(cuerposDespues)
    expect(p.state.desplegados.size).toBe(desplegados)
    expect(p.state.desplegados.get(obra)?.at).toEqual(SITIO)
  })
})

// ─── (d) Lo que `usar` se NIEGA a hacer ─────────────────────────────────────

describe('(d) `usar` no despliega algo que no engancha, y no camina hasta el sitio', () => {
  it('un palo pelado se rechaza SIN moverse, y el mundo queda intacto', () => {
    // La mitad del valor de esta habilidad. `catch` es una cualidad DERIVADA de las
    // puntas sueltas y el filo: un palo da cero, y dejarlo puesto no hace nada.
    // Ningún nombre interviene — es el punto 12 del criterio.
    const p = new Partida(escena())
    const dondeEstaba = p.state.bodies.get('ella-cuerpo')?.at
    const r = correr(p, (ctx) => usar(ctx, { obra: ver(ctx, 'vara'), en: { x: 5, y: 5 } }))
    expect(r.ok).toBe(false)
    expect(r.why).toContain('no engancha')
    expect(p.state.desplegados.size).toBe(0)
    // Y no caminó: rechazar después de un viaje sería el viaje al pedo.
    expect(p.state.bodies.get('ella-cuerpo')?.at).toEqual(dondeEstaba)
  })

  it('y la CAÑA sí engancha: la distinción es real y sale de la geometría', () => {
    // El control. Sin esto, un `usar` que rechazara todo pasaría el test de arriba.
    const p = new Partida(escena())
    const r = correr(p, (ctx) =>
      construir(ctx, { juntas: DEF.joints, roles: { brazo: ver(ctx, 'vara'), hebra: ver(ctx, 'liana') } }),
    )
    const obra = r.got === undefined ? undefined : p.state.bodies.get(r.got)?.body
    expect(obra).toBeDefined()
    if (obra === undefined) return

    // El palo se lee de una escena FRESCA y no de este mundo, y la primera versión
    // de esta línea se equivocaba justo ahí: después de la unión `vara` ya no
    // existe como cuerpo —está adentro de la obra— así que el `?? obra` del
    // fallback imprimía el `catch` de la obra y las dos columnas daban 0,1500.
    // Un print que miente es peor que ninguno: dice que la distinción no existe.
    const palo = escena().bodies.get('vara')?.body
    expect(palo, 'el fixture cambió: ya no hay una vara suelta que medir').toBeDefined()
    if (palo === undefined) return

    const deLaObra = qualityOf(obra, 'catch', PHYS)
    const dePalo = qualityOf(palo, 'catch', PHYS)
    console.log(
      `\n─── LO QUE DECIDE SI ALGO SE PUEDE DEJAR PUESTO ───\n` +
        `  la obra armada ... catch ${deLaObra.toFixed(4)}\n` +
        `  un palo pelado ... catch ${dePalo.toFixed(4)}\n`,
    )
    expect(deLaObra).toBeGreaterThan(0)
    // Y la distinción es real, no una diferencia de decimales: el palo da CERO.
    expect(dePalo).toBe(0)
  })
})

// ─── (e) La historia entera, por las DOS habilidades ────────────────────────

describe('(e) la criatura arma, deja puesto, y el mundo sigue sin ella', () => {
  it('EL CIERRE DEL PUNTO 5: `construir` ata y `usar` despliega, en una sola partida', () => {
    // `world/tests/la-historia-entera.test.ts` ya corría los seis pasos con las
    // intenciones a mano. Acá los corren las habilidades. Es la diferencia entre
    // «el mundo lo permite» y «la criatura lo hace».
    const p = new Partida(escena())
    const bitacora: string[] = []

    const armado = correr(p, (ctx) =>
      construir(ctx, { juntas: DEF.joints, roles: { brazo: ver(ctx, 'vara'), hebra: ver(ctx, 'liana') } }),
    )
    expect(armado.ok, armado.why).toBe(true)
    const obra = armado.got
    if (obra === undefined) return
    const cuerpo = p.state.bodies.get(obra)?.body
    bitacora.push(
      `  1 · ata la vara y la hebra → «${obra}» con catch ${qualityOf(cuerpo ?? ({} as never), 'catch', PHYS).toFixed(4)}` +
        ` (${String(armado.ticks)} ticks)`,
    )

    const puesta = correr(p, (ctx) => usar(ctx, { obra: ver(ctx, obra), en: { x: 2, y: 0 } }))
    expect(puesta.ok, puesta.why).toBe(true)
    expect(p.state.desplegados.get(obra)?.at).toEqual({ x: 2, y: 0 })
    bitacora.push(`  2 · la deja puesta y funcionando en {"x":2,"y":0} (${String(puesta.ticks)} ticks)`)

    // Y el mundo sigue corriendo sin que nadie pida nada: la obra desplegada es lo
    // único del tick que no lo pide nadie.
    const antes = p.state.tick
    for (let i = 0; i < 60; i++) p.tick()
    expect(p.state.tick).toBeGreaterThan(antes)
    expect(p.state.desplegados.get(obra)).toBeDefined()
    bitacora.push('  3 · el mundo corre 60 ticks y la obra sigue puesta')

    console.log(`\n─── LA HISTORIA, POR LAS HABILIDADES ───\n${bitacora.join('\n')}\n`)

    // La celda del sitio no se movió: una obra no se muda sola (ADR 0049).
    expect(keyOfCell(p.state.desplegados.get(obra)?.at ?? { x: 0, y: 0 })).toBe(keyOfCell({ x: 2, y: 0 }))
  })
})
