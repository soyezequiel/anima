// ─── LA HABILIDAD QUE ARMA, CONTRA EL MUNDO DE VERDAD ───────────────────────
//
// `construir` es la innata 16 y el `BuildSkill` del [ADR II-0015]: recibe la forma
// de un plano y los cuerpos ligados a cada rol, y encuentra el ORDEN de las
// uniones. Es la mitad de abajo del punto 3 del Gate 5→6 — el planificador ya
// sabía PEDIR «armá esta obra», y hasta ahora no había quien lo hiciera.
//
// ─── POR QUÉ ESTE ARCHIVO NO ALCANZA CON EL MUNDITO ────────────────────────
//
// Porque el mundito de `@anima/skills` es un juguete cuyo `apply('union')`
// devuelve el ensamble en el mismo tick y cuyo `goTo` teletransporta. Lo que hay
// que probar acá es lo contrario: que contra `stepWorld` de verdad, con `union`
// tardando un segundo de mundo y las manos contando, **la obra que sale ES el
// plano**.
//
// Y «es el plano» no es una opinión: lo contesta `realizaElPlano` de
// `@anima/physics`, que compara la cuenta de piezas, la TOPOLOGÍA en roles, y el
// `pide` de cada rol contra el cuerpo como entró. El mismo juez que el tramo F.
//
// ─── LOS TRES CASOS, Y NINGUNO SOBRA ───────────────────────────────────────
//
//   (a) LA CAÑA — dos piezas, una junta, y el atador es uno de sus extremos. Es
//       el caso de aceptación del gate: la hebra sobrevive con la punta suelta,
//       que es lo único que da `catch`, que es lo único que pesca;
//   (b) LA CADENA — tres piezas en fila, con atadores propios. Es el caso que
//       obliga a elegir el orden: encadenar de a una da una ESTRELLA, que es otra
//       obra con las mismas piezas;
//   (c) LO QUE PASA CUANDO NO SE PUEDE — el plano que no cabe en las manos.

import { describe, expect, it } from 'vitest'
import {
  buildSeedPhysics,
  definirPlano,
  qualityOf,
  realizaElPlano,
  type BlueprintCandidate,
  type BlueprintDefinition,
  type Body,
  type Physics,
} from '@anima/physics'
import type { BlueprintJoint, BodyView, Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import { construir } from '@anima/skills/innatas'
import type { Actor, WorldBody, WorldState } from '@anima/world'

import { Partida } from '../src/index.js'
import { conElla, cuerpo } from './mundo.js'

const PHYS: Physics = buildSeedPhysics()

type Hab = Generator<Intent, Outcome, StepResult>

const enElPiso = (id: string, sust: string, masa: number, x: number, y: number): WorldBody => ({
  body: cuerpo(id, sust, masa),
  at: { x, y },
})

function definir(c: BlueprintCandidate): BlueprintDefinition {
  const d = definirPlano(c, PHYS)
  if (d.k !== 'ok') throw new Error(`el plano no se define: ${JSON.stringify(d.verdict.razones)}`)
  return d.def
}

/**
 * Corre `construir` en el mundo, y devuelve la obra que quedó MÁS lo que hacía
 * falta para juzgarla: los cuerpos tal como entraron.
 *
 * Los cuerpos «como entraron» se sacan del estado INICIAL y no de la vista, y es a
 * propósito: `realizaElPlano` mide el `pide` contra el cuerpo suelto, que después
 * de la primera unión ya no existe como cuerpo.
 */
interface Corrida {
  readonly obra: Body | undefined
  readonly ok: boolean
  readonly why: string
  readonly ticks: number
  readonly w: WorldState
}

function armar(inicial: WorldState, juntas: readonly BlueprintJoint[], deRol: Record<string, string>): Corrida {
  const p = new Partida(inicial)
  const skill = function* (ctx: Ctx): Hab {
    const roles: Record<string, BodyView> = {}
    for (const rol of Object.keys(deRol).sort()) {
      const id = deRol[rol]
      const b = ctx.self.holding.find((x) => x.id === id) ?? ctx.see([])[0]
      const elegido = ctx.self.holding.find((x) => x.id === id) ?? ctx.see([]).find((x) => x.id === id)
      if (elegido === undefined) throw new Error(`no se ve «${String(id)}» para el rol «${rol}»`)
      roles[rol] = elegido ?? (b as BodyView)
    }
    return yield* construir(ctx, { juntas, roles })
  }
  const v = p.volar('ella', skill, undefined)
  let n = 0
  while (!v.terminado && n < 400) {
    p.tick()
    n++
  }
  const id = v.outcome?.ok === true ? v.outcome.got?.id : undefined
  const w = p.state
  return {
    obra: id === undefined ? undefined : w.bodies.get(id)?.body,
    ok: v.outcome?.ok === true,
    why: v.outcome?.ok === false ? v.outcome.why : (v.ultimo?.k === 'rota' ? `ROTA: ${v.ultimo.why}` : ''),
    ticks: n,
    w,
  }
}

/** Qué parte de la obra terminó siendo cada rol, comparando la materia. */
function asignacionDe(
  obra: Body,
  deRol: Record<string, string>,
  inicial: WorldState,
  juntas: readonly BlueprintJoint[],
): readonly { rol: string; parte: number; comoEntro: Body }[] {
  const piezas = new Set<string>()
  for (const j of juntas) {
    piezas.add(j.a)
    piezas.add(j.b)
  }
  const out: { rol: string; parte: number; comoEntro: Body }[] = []
  const usadas = new Set<number>()
  for (const rol of [...piezas].sort()) {
    const id = deRol[rol]
    const entro = id === undefined ? undefined : inicial.bodies.get(id)?.body
    if (entro === undefined) continue
    const suya = entro.parts[0]
    if (suya === undefined) continue
    for (let i = 0; i < obra.parts.length; i++) {
      if (usadas.has(i)) continue
      const p = obra.parts[i]
      if (p === undefined) continue
      if (p.substance === suya.substance && p.mass === suya.mass) {
        usadas.add(i)
        out.push({ rol, parte: i, comoEntro: entro })
        break
      }
    }
  }
  return out
}

// ─── (a) La caña ────────────────────────────────────────────────────────────

const CANA: BlueprintCandidate = {
  parts: [
    { rol: 'brazo', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'hebra', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
  ],
  joints: [{ a: 'brazo', b: 'hebra', binder: 'hebra' }],
}

describe('(a) la caña: el atador es uno de sus extremos y sobrevive adentro', () => {
  const def = definir(CANA)

  function escena(): WorldState {
    return conElla([enElPiso('vara', 'madera', 0.5, 1, 0), enElPiso('liana', 'liana', 0.2, 1, 0)])
  }

  it('la habilidad termina bien y devuelve una obra de dos piezas', () => {
    const r = armar(escena(), def.joints, { brazo: 'vara', hebra: 'liana' })
    expect(r.ok, r.why).toBe(true)
    expect(r.obra).toBeDefined()
    expect(r.obra?.parts.length).toBe(2)
    expect(r.obra?.joints.length).toBe(1)
  })

  it('EL CRITERIO: la obra que salió ES el plano, y lo dice `realizaElPlano`', () => {
    const inicial = escena()
    const r = armar(inicial, def.joints, { brazo: 'vara', hebra: 'liana' })
    expect(r.obra).toBeDefined()
    if (r.obra === undefined) return
    const asignacion = asignacionDe(r.obra, { brazo: 'vara', hebra: 'liana' }, inicial, def.joints)
    const v = realizaElPlano(r.obra, def, asignacion, PHYS)
    expect(v.razones.map((x) => x.mensaje)).toEqual([])
    expect(v.ok).toBe(true)
  })

  it('y la obra ENGANCHA, que es lo único que hace que una caña sea una caña', () => {
    // Sin `b`, el atador sobrevive con la punta suelta. Esa punta es
    // `freeStrandEnds`, que es lo único que da `catch`, que es lo único que
    // califica para pescar. Si la habilidad hubiera mandado la unión CON `b`, la
    // obra tendría las mismas dos piezas y `catch` daría cero.
    const r = armar(escena(), def.joints, { brazo: 'vara', hebra: 'liana' })
    expect(r.obra).toBeDefined()
    if (r.obra === undefined) return
    expect(qualityOf(r.obra, 'catch', PHYS)).toBeGreaterThan(0)
  })
})

// ─── (b) El árbol de tres piezas ────────────────────────────────────────────

/**
 * UNA CADENA, y no una estrella. La diferencia es todo el bloque.
 *
 * ─── POR QUE ESTE PLANO Y NO EL DE ANTES ──────────────────────────────────
 *
 * La primera version de este bloque usaba una ESTRELLA centrada en «centro», que
 * es la pieza primera por texto — o sea exactamente la obra que sale de encadenar
 * de a una sobre la misma obra, sin elegir nada. El describe decia «hay que elegir
 * el orden» y el test habria quedado verde con un armador que no elige.
 *
 * Una CADENA no: encadenar da `p1-p2` y `p1-p3`, y la cadena pide `p1-p2` y
 * `p2-p3`. Son dos obras distintas con las mismas tres piezas, y la unica forma de
 * conseguir la segunda es armar el subarbol del hijo ANTES de atarlo al padre.
 */
const ARBOL: BlueprintCandidate = {
  parts: [
    { rol: 'p1', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'p2', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'p3', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'at-1', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
    { rol: 'at-2', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
  ],
  joints: [
    { a: 'p1', b: 'p2', binder: 'at-1' },
    { a: 'p2', b: 'p3', binder: 'at-2' },
  ],
}

const CUERPOS_DEL_ARBOL: readonly WorldBody[] = [
  enElPiso('v1', 'madera', 0.5, 1, 0),
  enElPiso('v2', 'madera', 0.4, 1, 0),
  enElPiso('v3', 'madera', 0.3, 1, 0),
  enElPiso('l1', 'liana', 0.2, 1, 0),
  enElPiso('l2', 'liana', 0.15, 1, 0),
]

const DE_ROL_ARBOL = { p1: 'v1', p2: 'v2', p3: 'v3', 'at-1': 'l1', 'at-2': 'l2' }

describe('(b) la cadena: tres piezas en fila, y encadenar de a una daria OTRA obra', () => {
  const def = definir(ARBOL)

  /**
   * CINCO MANOS, y el número es la medición del tramo C·bis puesta en el arnés.
   *
   * Una obra de tres piezas necesita **cinco cuerpos**: tres piezas y dos
   * atadores, porque `unir` consume el atador. El arnés de este paquete le da tres
   * manos a la criatura por omisión, así que con la escena por defecto la
   * habilidad falla — y falla bien, ver el bloque (c).
   */
  function escena(manos = 5): WorldState {
    const w = conElla(CUERPOS_DEL_ARBOL)
    return { ...w, actors: new Map([['ella', { ...(w.actors.get('ella') as Actor), capacity: manos }]]) }
  }

  const DE_ROL = DE_ROL_ARBOL

  it('EL CRITERIO: tres piezas atadas como el plano dice, y los atadores se gastaron', () => {
    const inicial = escena()
    const r = armar(inicial, def.joints, DE_ROL)
    expect(r.ok, r.why).toBe(true)
    expect(r.obra).toBeDefined()
    if (r.obra === undefined) return
    // Tres piezas y no cinco: los dos atadores se consumieron en las juntas.
    expect(r.obra.parts.length).toBe(3)
    expect(r.obra.joints.length).toBe(2)

    const v = realizaElPlano(r.obra, def, asignacionDe(r.obra, DE_ROL, inicial, def.joints), PHYS)
    expect(v.razones.map((x) => x.mensaje)).toEqual([])
    expect(v.ok).toBe(true)

    console.log(
      `\n─── LA OBRA QUE ARMÓ LA HABILIDAD ───\n` +
        `  ${String(r.obra.parts.length)} piezas · ${String(r.obra.joints.length)} juntas · ` +
        `${String(r.ticks)} ticks de mundo\n` +
        `  juntas: ${r.obra.joints.map((j) => `${String(j.a)}-${String(j.b)} via ${j.via}`).join(' · ')}\n`,
    )
  })

  it('EL CONTROL: la obra que sale NO es la que sale de encadenar de a una', () => {
    // Sin esto, el bloque de arriba lo cumpliria un armador que no elige nada.
    // Encadenar de a una sobre la misma obra da una ESTRELLA con centro en la
    // primera pieza —medido en `physics/tests/el-orden-de-las-uniones...`— o sea
    // las juntas 0-1 y 0-2. Una cadena tiene una junta que NO sale de la parte 0.
    const r = armar(escena(), def.joints, DE_ROL)
    expect(r.obra).toBeDefined()
    if (r.obra === undefined) return
    expect(r.obra.joints.every((j) => j.a === 0), 'salio una estrella: el armador no eligio nada').toBe(false)
  })

  it('y es REPRODUCIBLE: dos corridas dan la misma obra, junta por junta', () => {
    // El orden lo elige la habilidad recorriendo el árbol, y el recorrido está
    // ordenado por texto a propósito. Si dependiera del orden de un `Map`, dos
    // corridas darían dos obras distintas y el hash del mundo dejaría de cerrar.
    const a = armar(escena(), def.joints, DE_ROL)
    const b = armar(escena(), def.joints, DE_ROL)
    // Que las DOS armaron algo, primero. Sin esto el test es verde vacio: con la
    // habilidad rota, `a.obra` y `b.obra` son los dos `undefined` y el `toEqual`
    // compara `undefined` contra `undefined` y pasa.
    expect(a.obra, a.why).toBeDefined()
    expect(b.obra, b.why).toBeDefined()
    expect(a.obra?.joints.length).toBe(2)
    expect(a.obra?.joints.map((j) => `${String(j.a)}-${String(j.b)}`)).toEqual(
      b.obra?.joints.map((j) => `${String(j.a)}-${String(j.b)}`),
    )
  })
})

// ─── (b·bis) EL CASO QUE LA CABEZA HACE DIFICIL ────────────────────────────
//
// ─── EL HALLAZGO, Y SALIO DE MEDIR DONDE QUEDA LA CABEZA ──────────────────
//
// `unir(A, B, atador)` deja la parte 0 de A en el indice 0 del resultado, o sea
// que **la cabeza del ensamble es la del cuerpo IZQUIERDO**. Medido:
//
//     unir(vara, undefined, hebra)  ->  parts: madera, liana   (cabeza: la vara)
//     unir(eso, otra, atador)       ->  juntas: 0-1, 0-2       (siguio siendo la vara)
//
// De ahi sale el invariante del que depende el armador: **la cabeza de cada
// subarbol tiene que ser su raiz**. Si se cumple, atar padre con hijo realiza
// exactamente la arista del plano.
//
// Y hay UNA forma de romperlo. Cuando el atador de una junta es uno de sus propios
// extremos —el caso de la cana— la union va sin `b` y el atador NO puede ir de
// izquierda: `unir(x, undefined, x)` no es nada. Asi que el que queda de cabeza es
// el OTRO extremo. Si ese atador-extremo tenia ademas otro hijo, el ensamble queda
// con la cabeza equivocada y la union siguiente ata las piezas que no son.
//
// La reparacion no es un caso especial: es ELEGIR LA RAIZ. Un rol que es atador y
// extremo tiene que quedar de HIJO en esa junta, y con seis piezas como maximo
// probar todas las raices cuesta nada.

const CON_ATADOR_QUE_ES_EXTREMO: BlueprintCandidate = {
  parts: [
    { rol: 'aguja', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
    { rol: 'tres', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'zeta', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'at-2', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
  ],
  joints: [
    // La aguja se ata a zeta y SOBREVIVE con la punta suelta: es atador y extremo.
    { a: 'aguja', b: 'zeta', binder: 'aguja' },
    // Y ademas cuelga de tres, con un atador propio.
    { a: 'aguja', b: 'tres', binder: 'at-2' },
  ],
}

describe('(b bis) un atador que ademas es pieza en otra junta NO SE PUEDE ARMAR', () => {
  it('LA PUERTA LO RECHAZA, y esto se descubrio escribiendo el constructor', () => {
    // ─── COMO APARECIO ────────────────────────────────────────────────────────
    //
    // Este bloque se escribio afirmando lo contrario: que la obra saldria. El
    // constructor fallo con «el atador "aguja" no sirve: madera con liana no
    // cumple lo que binder pide» —un mensaje de tres niveles mas abajo que el
    // problema— y al buscar el porque aparecio la demostracion.
    //
    // Es la QUINTA del mismo tipo que las cuatro del tramo C-bis: un plano que la
    // puerta aceptaba y no se puede construir. Y sale del mismo hecho medido:
    // `unir` deja la cabeza del ensamble en el cuerpo izquierdo.
    //
    // La reparacion NO fue en el constructor. Un plano que no se puede armar no
    // tiene que llegar hasta ahi: se rechaza donde se juzgan los planos.
    const d = definirPlano(CON_ATADOR_QUE_ES_EXTREMO, PHYS)
    expect(d.k).toBe('rechazado')
    if (d.k !== 'rechazado') return
    expect(d.verdict.razones.map((r) => r.codigo)).toContain('atador-que-no-es-punta')
    const razon = d.verdict.razones.find((r) => r.codigo === 'atador-que-no-es-punta')
    expect(razon?.rol).toBe('aguja')
    expect(razon?.encontrado).toBe(2)
  })

  it('y la cana SIGUE pasando: el atador-extremo con UNA sola junta es legal', () => {
    // El control, y es el que hace que la guarda nueva valga: si rechazara todo
    // atador que es extremo, se llevaria puesto el caso de aceptacion del gate.
    // Lo que se prohibe es que ademas tenga OTRA junta.
    const d = definirPlano(CANA, PHYS)
    expect(d.k).toBe('ok')
  })
})

// ─── (c) Cuando no se puede ─────────────────────────────────────────────────

describe('(c) lo que pasa cuando no entra en las manos', () => {
  const def = definir(ARBOL)

  it('EL MISMO LÍMITE QUE EL PLANIFICADOR: con tres manos no se puede, y lo dice', () => {
    // ─── LAS DOS PUNTAS TIENEN QUE COINCIDIR ─────────────────────────────────
    //
    // El planificador rechaza este plano con «necesita 5 cuerpos juntados a la vez
    // y la capacidad es N» ANTES de emitir el plan, y la habilidad lo rechaza
    // ANTES de la primera unión. Los dos números salen de la misma medición del
    // tramo C·bis: tres piezas más dos atadores.
    //
    // Que coincidan importa más de lo que parece: si la habilidad fuera más
    // permisiva que el plan, habría planes que el plan rechaza y la habilidad
    // podría correr —conocimiento perdido—; si fuera menos, habría planes verdes
    // que se rompen a mitad de camino, y `unir` no tiene inversa.
    const w = conElla(CUERPOS_DEL_ARBOL)
    const conTresManos: WorldState = {
      ...w,
      actors: new Map([['ella', { ...(w.actors.get('ella') as Actor), capacity: 3 }]]),
    }
    const r = armar(conTresManos, def.joints, DE_ROL_ARBOL)
    expect(r.ok).toBe(false)
    expect(r.why).toContain('no me entran las piezas en las manos')
  })

  it('y falla ANTES de atar nada: no deja materia inmovilizada', () => {
    // `unir` no tiene inversa —está escrito como hueco 1 del contrato— así que una
    // obra a medias es materia que no se recupera. Por eso la habilidad junta
    // TODO antes de la primera unión: si no entra, no ató nada.
    const w = conElla(CUERPOS_DEL_ARBOL)
    const conTresManos: WorldState = {
      ...w,
      actors: new Map([['ella', { ...(w.actors.get('ella') as Actor), capacity: 3 }]]),
    }
    const r = armar(conTresManos, def.joints, DE_ROL_ARBOL)
    expect(r.ok).toBe(false)
    // Los cinco cuerpos siguen existiendo, cada uno por su lado: ninguno se ató.
    for (const id of ['v1', 'v2', 'v3', 'l1', 'l2']) {
      expect(r.w.bodies.get(id), `«${id}» desapareció adentro de una obra a medias`).toBeDefined()
    }
  })
})
