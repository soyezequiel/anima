// ─── EL NO-OP CON CARA DE PROGRESO — tramo L del Hito 5 ─────────────────────
//
//   pnpm --filter @anima/mind test
//
// ═══ EL BUG QUE ESTE ARCHIVO PINA, Y POR QUÉ NADIE LO VIO EN ONCE TRAMOS ════
//
// Una criatura se pasó el **98% de su vida** dando un paso que ya estaba dado:
//
//     tanque  310 ....  6045 despegues de `ir(suelta:-6:-7:2)` en  6171 ticks
//     tanque 1000 ... 19846 despegues                          en 19971 ticks
//
// `plan()` contestaba `gap` con un `nearest` de UN paso —«acercate a lo que
// podría hacer de parrilla»— y la criatura YA ESTABA a una celda. La innata `ir`
// tiene su salida temprana («si ya estoy, no gasto una intención»), así que el
// vuelo volvía con `ok:true` **sin haberle pedido nada al mundo**; al tick
// siguiente D4 volvía a pedir el mismo plan, salía el mismo `gap`, y con él el
// mismo `ir`.
//
// **Y FALLABA EN VERDE.** Cada paso aterrizaba bien, el arnés de invariantes no
// veía nada, y la criatura se moría de hambre haciendo algo que técnicamente
// funcionaba. Es la misma familia que el contador que leía DESPEGUES en vez de
// aterrizajes y reportaba «pescó 199» cuando había pescado una: **el sistema no
// distinguía «avancé» de «hice una acción exitosa»**.
//
// ═══ LA DEFINICIÓN DE «AVANZAR», Y ESTE ARCHIVO ES SU PRUEBA ═══════════════
//
//   **UN DESPEGUE AVANZA SI EL PASO QUE DESPEGA TODAVÍA NO ESTÁ CUMPLIDO
//   CONTRA LA VISTA DE HOY.**
//
// Se descartaron las dos candidatas obvias, y las dos por lo mismo:
//
//   · «que haya cambiado el estado del mundo relevante al plan» — «relevante»
//     habría que definirlo, y lo que un `frotar` mueve durante los primeros
//     ticks es un `dt` acumulado que la vista no publica;
//   · «que la misma decisión no se repita N veces seguidas» — **es la regla que
//     rompe lo que este tramo vino a arreglar.** Está medido en este repo que un
//     proceso NO avanza si no se re-emite la intención: una fricción más 100
//     ticks vacíos deja la vara a 15 °C. Desde afuera, la vara que se calienta y
//     el `ir` que no mueve son la MISMA SERIE —la misma decisión, una y otra
//     vez— y ningún N las separa.
//
// Por eso los dos bloques de este archivo son las dos mitades del mismo criterio
// y hay que leerlos juntos: **(1) exige cortar el bucle** y **(2) exige
// perseverar el proceso**. Un arreglo que pase sólo uno de los dos es el arreglo
// equivocado, y cada bloque dice explícitamente qué le haría la otra regla.

import { describe, expect, it } from 'vitest'

import type { QualityId } from '@anima/physics'
import type { Ref, Step } from '@anima/plan'
import { firmaDe } from '@anima/plan'
import type {
  BodyId,
  BodyView,
  Cell,
  CellQuality,
  Clock,
  PlaceMemory,
  SelfView,
  Where,
} from '@anima/skills'

import { decidir, nuevoEstado } from '../src/escalera.js'
import type { EstadoDeLaEscalera } from '../src/escalera.js'
import type { Decision, MenteOptions, VistaDeLaMente } from '../src/tipos.js'

// ─── La escena mínima ────────────────────────────────────────────────────────
//
// Sin mundo y a propósito: `VistaDeLaMente` es un subconjunto estructural de
// `Ctx`, así que la escalera se puede interrogar con un objeto literal. Lo que
// se mide acá es LA DECISIÓN —qué despega y qué no—, y para eso el mundo sólo
// aportaría ruido y cuarenta segundos por corrida.

interface Cosa {
  readonly id: BodyId
  at: Cell
  readonly q: Record<string, number>
  enMano?: boolean
}

interface Escena {
  at: Cell
  stamina: number
  readonly cosas: Cosa[]
}

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

/** El `temperature` de la criatura. Tiene que estar bien abajo o D0 dispara. */
const T_DEL_CUERPO = 37

function vistaDe(s: Escena): VistaDeLaMente {
  const q = (b: BodyView, id: QualityId): number => {
    if (b.id === 'yo') {
      if (id === 'stamina') return s.stamina
      if (id === 'temperature') return T_DEL_CUERPO
      // `ignitionPoint` 0 quiere decir «no arde», que es lo que D0 mira primero.
      return 0
    }
    const c = s.cosas.find((x) => x.id === b.id)
    return c?.q[id] ?? 0
  }
  const comoVista = (c: Cosa): BodyView => ({
    id: c.id,
    at: c.enMano === true ? s.at : c.at,
    name: c.id,
    tags: [],
    madeByMe: false,
    joints: [],
  })
  const self: SelfView = {
    id: 'yo',
    at: s.at,
    name: 'criatura',
    tags: [],
    madeByMe: false,
    joints: [],
    holding: s.cosas.filter((c) => c.enMano === true).map(comoVista),
    capacity: 3,
    stamina: s.stamina,
    permits: 'reversible',
  }
  return {
    see(w: Where): readonly BodyView[] {
      const out: BodyView[] = []
      for (const c of s.cosas) {
        const b = comoVista(c)
        let pasa = true
        for (const t of w) {
          const x = q(b, t.q)
          const ok = t.op === '>=' ? x >= t.v : t.op === '<=' ? x <= t.v : t.op === '>' ? x > t.v : x < t.v
          if (!ok) {
            pasa = false
            break
          }
        }
        if (pasa) out.push(b)
      }
      return out
    },
    recall: (): readonly PlaceMemory[] => [],
    q,
    qAt: (_at: Cell, _cq: CellQuality): number => 0,
    self,
    clock: RELOJ,
  }
}

const OPCIONES: MenteOptions = {
  actor: 'ana',
  // D3 apagada: lo que este archivo mide es D1, y una oportunidad que aparezca
  // en el medio cambiaría la meta y con ella el plan. Que D3 esté inyectable es
  // exactamente para esto.
  oportunidades: () => [],
}

/**
 * Un estado de escalera con un plan puesto a mano, listo para que D1 lo saque.
 *
 * La meta es una que la escena NUNCA cumple —`temperature>=400` sobre algo que
 * está a 15 °C— para que D1 no la levante por cumplida y el plan siga en pie.
 */
function conPlan(pasos: readonly Step[]): EstadoDeLaEscalera {
  const e = nuevoEstado()
  e.metaEnCurso = firmaDe('temperature>=400')
  e.valorEnCurso = 1
  e.porQuien = 'D3'
  e.pasosPendientes = [...pasos]
  return e
}

function ref(id: BodyId): Ref {
  return { k: 'id', id }
}

/** Qué despegó una decisión, en texto. `—` si no despegó nada. */
function queDespego(d: Decision): string {
  if (d.k !== 'volar' && d.k !== 'plan') return `—(${d.k}/${d.por})`
  const i = d.k === 'volar' ? d.paso : d.pasos[0]
  if (i === undefined) return '—(plan vacío)'
  switch (i.k) {
    case 'ir':
      return `ir(${i.a.k === 'id' ? i.a.id : i.a.k},${String(i.within ?? 0)})`
    case 'sostener':
      return `sostener(${i.que.k === 'id' ? i.que.id : i.que.k})`
    case 'frotar':
      return `frotar(${i.a.k === 'id' ? i.a.id : i.a.k},hasta=${String(i.hasta ?? 0)})`
    default:
      return i.k
  }
}

// ═══ (1) CORTAR EL BUCLE ═══════════════════════════════════════════════════

describe('(1) el paso que ya está dado NO despega', () => {
  it('un `ir` a algo que está a una celda no se vuela: se salta y despega el paso siguiente', () => {
    // LA ESCENA DEL BUG, reducida a lo mínimo: la criatura en (0,0), la cosa en
    // (1,0) —Chebyshev 1— y un `ir` que pide `within: 1`. La innata contestaría
    // `done()` en el tick cero sin emitir una sola intención al mundo; el tick
    // se tiraría y al siguiente saldría el mismo paso.
    const s: Escena = { at: { x: 0, y: 0 }, stamina: 500, cosas: [{ id: 'losa', at: { x: 1, y: 0 }, q: { mass: 1 } }] }
    const e = conPlan([
      { k: 'ir', a: ref('losa'), within: 1, porQue: 'la parrilla' },
      { k: 'sostener', que: ref('losa'), porQue: 'la parrilla' },
    ])
    const d = decidir(vistaDe(s), e, OPCIONES)

    // El `ir` no despegó; despegó el `sostener`, o sea el primer paso que SÍ
    // hace algo. Y todo en el MISMO tick: saltear no cuesta un tick de vida.
    expect(queDespego(d)).toBe('sostener(losa)')
    expect(e.salteados).toBe(1)
  })

  it('un plan que es UN SOLO paso ya dado no despega nada, y el plan se tira', () => {
    // Éste es literalmente el `nearest` del bug: una lista de un solo `ir` que ya
    // está dado. La escalera no puede fingir que hizo algo —eso es el bucle— así
    // que no despega nada y cae a D5, que es la salida honesta.
    const s: Escena = { at: { x: 4, y: 4 }, stamina: 500, cosas: [{ id: 'losa', at: { x: 5, y: 4 }, q: { mass: 1 } }] }
    const e = conPlan([{ k: 'ir', a: ref('losa'), within: 1, porQue: 'la parrilla' }])
    const d = decidir(vistaDe(s), e, OPCIONES)

    expect(e.salteados).toBe(1)
    // Lo que sale es una conducta de fondo (D5) y no el `ir`.
    expect(queDespego(d)).not.toBe('ir(losa,1)')
    expect(d.por).toBe('D5')
    // Y el plan se tiró: no queda medio plan colgado para el tick que viene.
    expect(e.pasosPendientes).toEqual([])
  })

  it('un `sostener` de algo que ya está en la mano tampoco despega', () => {
    // La otra mitad de la familia. `grep -n 'return done' skills/src/innatas/*.ts`
    // da CINCO habilidades con salida temprana en el tick cero —`ir`, `sostener`,
    // `frotar`, `esperar` y `explorar`— y de las cinco, dos se pueden dar por
    // hechas antes de tocar el mundo mirando sólo la vista: éstas dos. Las otras
    // tres dependen de cualidades que el paso anterior del mismo plan cambia, y
    // decidirlas exigiría simular.
    const s: Escena = {
      at: { x: 0, y: 0 },
      stamina: 500,
      cosas: [
        { id: 'vara', at: { x: 0, y: 0 }, q: { mass: 1 }, enMano: true },
        { id: 'piedra', at: { x: 3, y: 0 }, q: { mass: 1 } },
      ],
    }
    const e = conPlan([
      { k: 'sostener', que: ref('vara'), porQue: 'frotar' },
      { k: 'ir', a: ref('piedra'), within: 1, porQue: 'frotar' },
    ])
    const d = decidir(vistaDe(s), e, OPCIONES)

    expect(queDespego(d)).toBe('ir(piedra,1)')
    expect(e.salteados).toBe(1)
  })

  it('EL CONTROL POSITIVO: el mismo paso, con la cosa una celda más lejos, SÍ despega', () => {
    // Sin este bloque el de arriba no significa nada: una escalera que no
    // despegara NUNCA los pasaría todos. La única diferencia con el primer test
    // es que `losa` está en (2,0) en vez de (1,0).
    const s: Escena = { at: { x: 0, y: 0 }, stamina: 500, cosas: [{ id: 'losa', at: { x: 2, y: 0 }, q: { mass: 1 } }] }
    const e = conPlan([
      { k: 'ir', a: ref('losa'), within: 1, porQue: 'la parrilla' },
      { k: 'sostener', que: ref('losa'), porQue: 'la parrilla' },
    ])
    const d = decidir(vistaDe(s), e, OPCIONES)

    expect(queDespego(d)).toBe('ir(losa,1)')
    expect(e.salteados).toBe(0)
  })

  it('EL BUCLE, CONTADO: cien ticks contra un `ir` ya dado dan CERO despegues de ese `ir`', () => {
    // La forma del bug, en el tamaño en que se midió. Antes del arreglo esta
    // misma corrida daba 100 de 100; el número real de la partida fue 6045 en
    // 6171 ticks con el tanque de 310, y 19.846 en 19.971 con el de 1000.
    //
    // Se le vuelve a poner el plan en cada vuelta porque eso es exactamente lo
    // que hacía D4: la meta seguía sin cumplirse, `plan()` volvía a contestar
    // `gap` con el mismo `nearest`, y el mismo paso volvía a la cola.
    const s: Escena = { at: { x: 0, y: 0 }, stamina: 5000, cosas: [{ id: 'losa', at: { x: 1, y: 0 }, q: { mass: 1 } }] }
    const e = conPlan([])
    let despegoElIr = 0
    for (let t = 0; t < 100; t++) {
      e.pasosPendientes = [{ k: 'ir', a: ref('losa'), within: 1, porQue: 'la parrilla' }]
      e.enVuelo = undefined
      const d = decidir(vistaDe(s), e, OPCIONES)
      if (queDespego(d) === 'ir(losa,1)') despegoElIr++
    }
    expect(despegoElIr).toBe(0)
    expect(e.salteados).toBe(100)
  })
})

// ═══ (2) PERSEVERAR EL PROCESO ═════════════════════════════════════════════

describe('(2) el paso que TODAVÍA no está dado despega siempre, las veces que haga falta', () => {
  it('cien ticks del mismo `frotar` sobre una vara fría dan CIEN despegues', () => {
    // ─── POR QUÉ ESTE TEST ES LA MITAD QUE FALTABA ─────────────────────────
    //
    // Está medido en este repo que **un proceso NO avanza si no se re-emite la
    // intención**: una fricción más 100 ticks vacíos deja la vara a 15 °C. O sea
    // que una mente que abandonara un `frotar` porque «no avanza» rompería
    // exactamente lo que el tramo vino a arreglar — la criatura no encendería
    // nunca, que es el único camino a la comida que la escena ofrece.
    //
    // Y ACÁ ESTÁ EL CONTRASTE QUE DECIDE LA DEFINICIÓN: desde afuera, esta serie
    // y la del bloque (1) son **la misma serie** —la misma decisión, cien veces
    // seguidas—. La regla «la misma decisión no se repite N veces» daría, para
    // cualquier N, N despegues acá y N allá: apagaría el fuego para salvar el
    // bucle, o salvaría el bucle para apagar el fuego. La regla que se eligió da
    // 100 y 0, porque no mira la repetición: mira si el paso ya está dado.
    const s: Escena = {
      at: { x: 0, y: 0 },
      stamina: 5000,
      cosas: [
        { id: 'vara', at: { x: 0, y: 0 }, q: { mass: 0.4, temperature: 15 }, enMano: true },
        { id: 'piedra', at: { x: 0, y: 0 }, q: { mass: 0.4, temperature: 15 }, enMano: true },
      ],
    }
    const e = conPlan([])
    const paso: Step = { k: 'frotar', a: ref('vara'), b: ref('piedra'), hasta: 400, porQue: 'temperature>=400' }
    let despegues = 0
    for (let t = 0; t < 100; t++) {
      e.pasosPendientes = [paso]
      e.enVuelo = undefined
      if (queDespego(decidir(vistaDe(s), e, OPCIONES)) === 'frotar(vara,hasta=400)') despegues++
    }
    expect(despegues).toBe(100)
    expect(e.salteados).toBe(0)
  })

  it('y la vara que SUBE de a poco tampoco corta: 99 ticks de calentarse son 99 despegues', () => {
    // La perseverancia que de verdad importa no es la del proceso que no cambia
    // nada: es la del que cambia MUY POCO por tick. `frotar` sube la temperatura
    // unas décimas por tick, así que durante casi toda la subida la escena de un
    // tick y la del siguiente son indistinguibles para cualquier huella barata
    // que se quisiera usar de llave. Acá sube 4 °C por tick desde 15: cruza los
    // 400 recién en el tick 97.
    const vara: Cosa = { id: 'vara', at: { x: 0, y: 0 }, q: { mass: 0.4, temperature: 15 }, enMano: true }
    const s: Escena = {
      at: { x: 0, y: 0 },
      stamina: 5000,
      cosas: [vara, { id: 'piedra', at: { x: 0, y: 0 }, q: { mass: 0.4, temperature: 15 }, enMano: true }],
    }
    const e = conPlan([])
    const paso: Step = { k: 'frotar', a: ref('vara'), b: ref('piedra'), hasta: 400, porQue: 'temperature>=400' }
    let despegues = 0
    const noVolo: number[] = []
    for (let t = 0; t < 120; t++) {
      e.pasosPendientes = [paso]
      e.enVuelo = undefined
      if (queDespego(decidir(vistaDe(s), e, OPCIONES)) === 'frotar(vara,hasta=400)') despegues++
      else noVolo.push(t)
      vara.q['temperature'] = (vara.q['temperature'] ?? 0) + 4
    }
    // ─── Y EL ÚNICO TICK QUE NO VOLÓ DICE EXACTAMENTE LO QUE HABÍA QUE DECIR ──
    //
    // De 120 ticks voló 119, y el que no es el **97**: `15 + 4t ≥ 400` en
    // `t = 96,25`, así que el 97 es el primero con la vara a 403 °C. Ese tick D1
    // levanta la meta por CUMPLIDA —«ya tengo temperature>=400: corto lo que
    // estaba haciendo»— y suelta el plan, que es lo correcto y no tiene nada que
    // ver con la repetición: al tick siguiente vuelve a volar el mismo `frotar`.
    //
    // Lo que este número prueba es que **la escalera no cortó nunca por repetir**:
    // 119 despegues idénticos seguidos, y el único corte lo produjo el mundo al
    // cumplir la meta. Con la regla de «la misma decisión N veces» los cortes
    // habrían sido 120/N y el primero habría llegado en el tick N.
    expect(noVolo).toEqual([97])
    expect(despegues).toBe(119)
    // Y ninguno de los 120 se salteó por «ya estaba hecho»: `frotar` es un EVENTO
    // y no un estado, así que `pasoYaEstaHecho` contesta `false` para él siempre
    // —igual que para las otras nueve variantes que no son `ir` ni `sostener`—.
    expect(e.salteados).toBe(0)
  })
})
