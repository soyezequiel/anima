// ─── LAS OPORTUNIDADES — necesidad × creencia × escasez ─────────────────────
//
//   pnpm --filter @anima/mind test
//
// SE TESTEA SIN MUNDO, igual que el planificador y por la misma razón:
// `VistaDeLaMente` es `VistaDelPlan`, o sea un SUBCONJUNTO ESTRUCTURAL de `Ctx`.
// Si algún día hiciera falta arrancar un mundo para preguntar qué se puede
// querer, la interfaz habría dejado de ser un subconjunto y ESA sería la noticia.
//
// Lo que se pina acá, y por qué cada cosa:
//
//   · LA CORRIDA CANÓNICA del documento de arquitectura, con el río visto por
//     `qAt` y no por `see`. Es el ejemplo que se rompió una vez justamente por
//     eso —el agua es un campo de celda, no un cuerpo— y es la única oportunidad
//     que importa en el criterio del Hito 5;
//   · que los `segundos` no se inventan: salen de `SCHEMA_INDEX`, y el test los
//     lee de ahí antes de pinar el costo;
//   · el ORDEN: la misma vista con los cuerpos en distinto orden de llegada tiene
//     que dar la MISMA lista. Sin desempate por `id`, un `sort` por float depende
//     del orden de llegada y el orden de llegada depende del índice del tick;
//   · el costo cero, que es el que hace `Infinity` y arruina el orden;
//   · una necesidad en cero, que no tiene que producir nada;
//   · las cotas: `OPORTUNIDADES_QUE_MIRA` y el barrido de celdas;
//   · y el contrato con D4: el `meta` que sale de acá tiene que ser el MISMO
//     TEXTO que `SCHEMA_INDEX` indexa, o el plan de la pesca no arranca nunca.

import { describe, expect, it } from 'vitest'
import { interpretar, SCHEMA_INDEX } from '@anima/plan'
import type { BodyView, Cell, CellQuality, PlaceMemory, SelfView, Where, WhereCell } from '@anima/skills'
import { COSTO_POR_CELDA, COSTO_VIVIR_POR_SEGUNDO } from '@anima/world'

import { caloriasDelPeorDeTag } from '../src/necesidades.js'
import {
  alientoDelEsquema,
  ALIENTO_POR_CELDA,
  celdaDeLugar,
  costoEstimado,
  lugarDeCelda,
  metaComestibleDe,
  metaDe,
  opportunities,
  PISO_DE_COSTO,
  RADIO_DE_AGUA,
  SEGUNDOS_DE_UNA_INTENCION,
  valorDe,
  venenoQueBanca,
  type GanchosDeOportunidad,
} from '../src/oportunidades.js'
import type { AffordanceMemory, Beta, ContextKey, NeedVector, VistaDeLaMente } from '../src/tipos.js'
import { OPORTUNIDADES_QUE_MIRA } from '../src/tipos.js'

/** La cola con la que se nombra la oportunidad «que además se pueda comer». */
const COLA = '+rescate'

// ─── El mundito de mentira ──────────────────────────────────────────────────

function cuerpo(id: string, x: number, y: number, nombre?: string): BodyView {
  return { id, at: { x, y }, name: nombre ?? id, tags: [], madeByMe: false, joints: [] }
}

function criatura(o?: { at?: Cell; holding?: readonly BodyView[] }): SelfView {
  return {
    id: 'yo',
    at: o?.at ?? { x: 0, y: 0 },
    name: 'criatura',
    // En este mundito nada tiene sustancia, asi que nada tiene clase de materia.
    // En la partida la vista lo saca de `tagsDe(body, phys)`.
    tags: [],
    madeByMe: false,
    joints: [],
    holding: o?.holding ?? [],
    capacity: 2,
    // 0,31 de tanque es el `stamina` del tick 0 de la corrida canónica.
    stamina: 0.31,
    permits: 'reversible',
  }
}

/** La vista de mentira, con dos contadores: sin ellos las cotas son una opinión. */
interface VistaFalsa extends VistaDeLaMente {
  llamadasAqAt(): number
  cuerposDevueltos(): readonly string[]
}

function vista(m: {
  self?: SelfView
  cuerpos?: readonly BodyView[]
  /** Las celdas con agua franca. Todo lo demás vale `wet = 0`. */
  mojadas?: readonly Cell[]
  /** Lo que el libro de lugares recuerda, con la humedad anotada. */
  recuerdos?: readonly { at: Cell; wet: number }[]
}): VistaFalsa {
  const self = m.self ?? criatura()
  const cuerpos = m.cuerpos ?? []
  const mojadas = m.mojadas ?? []
  let llamadas = 0
  const devueltos: string[] = []
  return {
    see(_w: Where): readonly BodyView[] {
      // La mente sólo pide `see([])` —«todo lo que veo»— así que el filtro no se
      // implementa: implementarlo sería testear el filtro de la vista y no la
      // mente. Se ANOTA lo devuelto, que es lo que el test necesita para poder
      // decir «el río no salió de acá».
      for (const b of cuerpos) devueltos.push(b.id)
      return cuerpos
    },
    recall(w: WhereCell): readonly PlaceMemory[] {
      const out: PlaceMemory[] = []
      for (const r of m.recuerdos ?? []) {
        let ok = true
        for (const t of w) {
          const q = t.q === 'wet' ? r.wet : 0
          const pasa =
            t.op === '>=' ? q >= t.v : t.op === '<=' ? q <= t.v : t.op === '>' ? q > t.v : q < t.v
          if (!pasa) {
            ok = false
            break
          }
        }
        if (ok) out.push({ at: r.at, atTick: 0, what: [], q: (x) => (x === 'wet' ? r.wet : 0) })
      }
      return out
    },
    q: () => 0,
    qAt(at: Cell, q: CellQuality): number {
      llamadas++
      if (q !== 'wet') return 0
      return mojadas.some((c) => c.x === at.x && c.y === at.y) ? 1 : 0
    },
    self,
    clock: { phase: 'dia', secondsToNightfall: 100, dayLength: 200 },
    llamadasAqAt: () => llamadas,
    cuerposDevueltos: () => devueltos,
  }
}

/**
 * La memoria de mentira. `observe` y `seed` LANZAN a propósito: mirar
 * oportunidades no es aprender, y si algún día D3 empieza a escribir en la
 * memoria de afordancias, todos los tests de este archivo se ponen rojos.
 */
function memoria(tabla: Readonly<Record<ContextKey, Readonly<Record<string, Beta>>>>): AffordanceMemory {
  return {
    belief: (ctx, rinde) => tabla[ctx]?.[rinde] ?? { a: 1, b: 1 },
    tagsDe: (ctx) => Object.keys(tabla[ctx] ?? {}),
    observe: () => {
      throw new Error('D3 no observa: la evidencia la trae el mundo')
    },
    seed: () => {
      throw new Error('D3 no siembra')
    },
  }
}

// ─── La escena canónica ─────────────────────────────────────────────────────
//
// «tengo hambre, veo un río, probablemente haya pescado». El río está a 6 celdas
// y NO ES UN CUERPO: es una celda con `wet = 1`. El matorral está a 2 y sí lo es.

const AGUA: ContextKey = 'monte/agua'
const MATORRAL: ContextKey = 'monte/matorral'

const CONTEXTOS: Readonly<Record<string, ContextKey>> = {
  'celda:6,0': AGUA,
  matorral: MATORRAL,
}

const HAMBRE: NeedVector = { energia: 0.69, calor: 0, refugio: 0 }

/**
 * La tabla de satisfacción del DOCUMENTO: `carnoso` calma 0,9 y `vegetal` 0,2.
 *
 * Es un gancho y no la tabla de verdad (que vive en `necesidades.ts`) porque lo
 * que este archivo prueba es la fórmula, el orden y el costo. Pinar acá los
 * números de otro módulo sería probar dos cosas a la vez y romper por las dos.
 */
const CALMA: Readonly<Record<string, number>> = { carnoso: 0.9, vegetal: 0.2 }

const SAT = (n: NeedVector, tag: string): number => (n.energia > 0 ? (CALMA[tag] ?? 0) : 0)

const CTX_DE = (_v: VistaDeLaMente, lugar: string): ContextKey =>
  CONTEXTOS[lugar] ?? `desconocido/${lugar}`

const GANCHOS: GanchosDeOportunidad = { sat: SAT, ctxDe: CTX_DE }

function escenaCanonica(o?: { cuerpos?: readonly BodyView[] }): VistaFalsa {
  return vista({
    cuerpos: o?.cuerpos ?? [cuerpo('matorral', 2, 0, 'el matorral')],
    mojadas: [{ x: 6, y: 0 }],
  })
}

const CREENCIAS = memoria({
  // β(2,2): el instinto pelado, sin evidencia propia. p = 0,50.
  [AGUA]: { carnoso: { a: 2, b: 2 } },
  // β(2,6): cuatro fracasos anotados encima del prior. p = 0,25.
  [MATORRAL]: { vegetal: { a: 2, b: 6 } },
})

// Los dos costos de la escena, medidos y no despejados:
//   río      6 celdas × 0,067 de aliento + 1,5 s × 0,34 de `extraccion` = 0,912
//   matorral 2 celdas × 0,067 de aliento + 0,05 s × 0,34 de una intención = 0,151
//
// ─── LOS CUATRO BAJARON, Y LOS BAJÓ `COSTO_VIVIR_POR_SEGUNDO` ───────────────
//
// Eran 2,10 · 0,25 · 0,21428571428571427 · 0,2 mientras la constante valió 1,0.
// Hoy vale **0,34** y los cuatro salen de correr, no de despejar: el aliento de
// una celda pasó de 0,10 a 0,067 (el paso no se movió, lo que se abarató es el
// TIEMPO del paso) y el de un segundo de proceso de 1,00 a 0,34. Los dos costos
// bajaron y los dos valores subieron, porque el valor es `p · sat / costo`.
//
// Y el renglón viejo del río decía «+ 1,5 s de `extraccion`» sumando SEGUNDOS a
// ALIENTO: daba el número justo sólo porque el segundo costaba 1,0. La cuenta de
// verdad —la que `alientoDeConseguir` hace— es `COSTO_VIVIR_POR_SEGUNDO × 1,5`.
const COSTO_DEL_RIO = 0.912
const COSTO_DEL_MATORRAL = 0.15100000000000002
const VALOR_DEL_RIO = 0.4934210526315789
const VALOR_DEL_MATORRAL = 0.3311258278145695

// ─── La corrida canónica ────────────────────────────────────────────────────

describe('la corrida canónica del documento', () => {
  it('gana el río, y el río se ve por `qAt` y no por `see`', () => {
    const v = escenaCanonica()
    const lista = opportunities(v, CREENCIAS, HAMBRE, GANCHOS)

    // TRES Y NO DOS desde el ADR II-0013, y la tercera es la que faltaba: la
    // MISMA creencia sobre el MISMO río, pidiendo que lo que salga se pueda
    // comer. Sale sólo para `carnoso` y eso es información, no un descuido:
    // `venenoQueBanca` mira el PEOR miembro del tag, y `vegetal` tiene miembros
    // sin calorías (la madera), o sea que ningún umbral de veneno vuelve comida a
    // un tag que te puede entregar un palo. Se ordena TERCERA porque cuesta más:
    // lleva encima el esquema que tenga que prometerlo.
    expect(lista.map((o) => o.id)).toEqual([
      'celda:6,0#carnoso',
      'cuerpo:matorral#vegetal',
      'celda:6,0#carnoso+rescate',
    ])
    expect(lista[2]?.meta).toBe(metaComestibleDe('carnoso'))
    expect(lista[0]?.meta).toBe('holding(tag:carnoso)')
    expect(lista[0]?.valor).toBe(VALOR_DEL_RIO)
    expect(lista[1]?.valor).toBe(VALOR_DEL_MATORRAL)
    expect(lista[0]?.valor).toBeGreaterThan(lista[1]?.valor ?? 0)

    // LA MITAD QUE IMPORTA: `see()` nunca devolvió ningún río. La oportunidad
    // ganadora salió del campo de celda, que es lo que el `Ctx` dice y lo que
    // rompió el ejemplo canónico la primera vez.
    expect(v.cuerposDevueltos()).toEqual(['matorral'])
  })

  it('el «por qué» se lee, y dice la evidencia que hay detrás', () => {
    const lista = opportunities(escenaCanonica(), CREENCIAS, HAMBRE, GANCHOS)
    // n es la evidencia PROPIA: los priors valen 2 y no cuentan. β(2,2) → 2.
    expect(lista[0]?.porque).toBe('creo que el agua en (6, 0) rinde carnoso (p=0,50, n=2)')
    expect(lista[1]?.porque).toBe('creo que el matorral rinde vegetal (p=0,25, n=6)')
  })

  it.fails('los valores del documento —0,009 y 0,006— no son los de este mundo', () => {
    // HUECO MEDIDO, y no un test debilitado. El documento escribe «cost≈50» para
    // un río a 6 celdas y «cost≈8» para un matorral a 2, y de ahí saca 0,009 y
    // 0,006. Esos costos no salen de NINGÚN modelo lineal sobre esta física: 6a+b
    // = 50 y 2a+b = 8 dan b = −13, o sea una caminata con costo de arranque
    // negativo. Vienen de `estimatedTicks`, que el ADR II-0008 ya declaró mentira
    // de unidades y renombró a `segundos`.
    //
    // Lo que este mundo contesta, medido: 0,4934 y 0,3311, con costos 0,912 y
    // 0,151 (eran 0,2143 y 0,2000 con costos 2,10 y 0,25, cuando
    // `COSTO_VIVIR_POR_SEGUNDO` valía 1,0). Lo que el documento afirma y SÍ se
    // reproduce —que gana el río— está pinado en el test de arriba; que gane «por
    // poco» ya NO, y eso está medido dos tests más abajo.
    const lista = opportunities(escenaCanonica(), CREENCIAS, HAMBRE, GANCHOS)
    expect(lista[0]?.valor).toBeCloseTo(0.009, 4)
    expect(lista[1]?.valor).toBeCloseTo(0.006, 4)
  })

  it('la elección se decide por un 49%, y ya no por un 7%', () => {
    // ─── EL MARGEN SE MULTIPLICÓ POR SIETE, Y NO LO TOCÓ ESTE MÓDULO ────────
    //
    // Era **1,0714** —el «se decide por un 7%» del nombre viejo— mientras
    // `COSTO_VIVIR_POR_SEGUNDO` valió 1,0. Hoy vale 0,34 y mide **1,4901**: el
    // río gana por un 49%. La causa está en qué parte de cada costo se abarató.
    // El río paga 1,5 segundos de `extraccion` y el matorral 0,05, o sea que el
    // término que la constante divide es TREINTA veces más grande del lado del
    // río; bajarla de 1,0 a 0,34 le sacó 1,02 de costo al río y 0,034 al
    // matorral. La escena no cambió, las creencias tampoco: cambió el precio del
    // segundo.
    const lista = opportunities(escenaCanonica(), CREENCIAS, HAMBRE, GANCHOS)
    expect((lista[0]?.valor ?? 0) / (lista[1]?.valor ?? 1)).toBeCloseTo(1.4901, 4)
  })

  it.fails('LA FRAGILIDAD SE DESACTIVÓ: con el paso sin su tiempo ya NO se da vuelta', () => {
    // ─── ESTE HUECO ES NUEVO Y LO ABRIÓ LA CALIBRACIÓN, NO UN CAMBIO DE CÓDIGO ─
    //
    // Este bloque vivía adentro del test de arriba y afirmaba: si el costo de la
    // celda fuera sólo el paso (`COSTO_POR_CELDA`) y no el paso MÁS el tiempo del
    // paso, la misma escena con las mismas creencias elegiría el matorral. Era el
    // argumento de por qué la decisión 3 del módulo está escrita con esa
    // aritmética, y con `COSTO_VIVIR_POR_SEGUNDO = 1,0` se cumplía: 0,2500 contra
    // 0,3333.
    //
    // Con la constante en **0,34** ya no. Medido acá abajo:
    //
    //     río      0,45 ÷ (6 × 0,05 + 0,34 × 1,5)  = 0,45 ÷ 0,810 = **0,5556**
    //     matorral 0,05 ÷ (2 × 0,05 + 0,34 × 0,05) = 0,05 ÷ 0,117 = **0,4274**
    //
    // El río gana igual, así que el contrafáctico ya no distingue las dos
    // aritméticas EN ESTA ESCENA. Y el motivo es el mismo que hizo crecer el
    // margen del test de arriba: el tiempo del paso pasó de valer lo mismo que el
    // paso (0,05 y 0,05) a valer un tercio (0,017 contra 0,05), o sea que sacarlo
    // de la cuenta mueve mucho menos que antes.
    //
    // **NO se ablanda y no se borra**: queda en rojo con el número al lado, porque
    // lo que perdió no es la decisión 3 —que sigue siendo la aritmética correcta y
    // la que `world/tests/el-tiempo-no-depende-del-tick.test.ts` verifica en el
    // mundo— sino la ESCENA que la delataba. El día que alguien quiera volver a
    // tener el guardián, hace falta una escena nueva con el proceso más liviano o
    // la caminata más larga, y eso es una decisión de diseño del test.
    const rio = 6 * COSTO_POR_CELDA + COSTO_VIVIR_POR_SEGUNDO * 1.5
    const matorral = 2 * COSTO_POR_CELDA + COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_UNA_INTENCION
    expect((0.5 * 0.9) / rio).toBeLessThan((0.25 * 0.2) / matorral)
  })
})

// ─── El costo ───────────────────────────────────────────────────────────────

describe('el costo', () => {
  it('los segundos salen de `SCHEMA_INDEX` y no de una duración inventada', () => {
    // Se leen del índice ANTES de pinar el costo: si mañana `extraccion` tardara
    // otra cosa, este test dice cuál de las dos afirmaciones se movió.
    const filas = SCHEMA_INDEX.get(metaDe('carnoso'))
    expect(filas?.length).toBe(1)
    const fila = filas?.[0]
    // `k === 'proceso'`: la tabla ya tiene filas de LEY, que no van por ningún
    // proceso. La de `holding(tag:carnoso)` pelado sigue siendo una sola y de proceso.
    expect(fila?.k === 'proceso' ? fila.via : undefined).toBe('extraccion')
    expect(fila?.segundos).toBe(1.5)

    // Y `vegetal` no tiene esquema: en la semilla, `holding(tag:carnoso)` es el
    // único `holding` que algún proceso promete. Lo demás se levanta con la mano.
    expect(SCHEMA_INDEX.get(metaDe('vegetal'))).toBeUndefined()

    const v = escenaCanonica()
    expect(costoEstimado(v, 'celda:6,0#carnoso')).toBe(COSTO_DEL_RIO)
    expect(costoEstimado(v, 'cuerpo:matorral#vegetal')).toBe(COSTO_DEL_MATORRAL)
  })

  it('caminar una celda cuesta 0,067 de aliento, y una intención 0,017', () => {
    // Los dos números salen de constantes del MUNDO y de la física, no de acá:
    // `COSTO_POR_CELDA` (0,05) más un tick de `COSTO_VIVIR_POR_SEGUNDO` a
    // `HZ_DE_REFERENCIA` (0,34 ÷ 20 = 0,017). Pinarlos es pinar la cuenta que
    // `world/tests/el-tiempo-no-depende-del-tick.test.ts` verifica en el mundo.
    //
    // ERAN 0,10 y 0,05, y los movió la calibración: `COSTO_VIVIR_POR_SEGUNDO`
    // bajó de 1,0 a 0,34. Con eso se rompió la coincidencia que el comentario de
    // `ALIENTO_POR_CELDA` festejaba —«caminar cuesta lo mismo que vivir», o sea
    // 0,05 y 0,05, y el total el doble del paso— y **caminar pasó a costar casi
    // tres veces lo que vivir el mismo tiempo**: 0,05 de paso contra 0,017 de
    // segundo. Es exactamente lo que hace que la criatura del criterio (2) gaste
    // 2,89× lo de estar quieta.
    expect(ALIENTO_POR_CELDA).toBe(0.067)
    expect(PISO_DE_COSTO).toBe(0.017)
  })

  it('un lugar pelado, sin tag, cuesta sólo la caminata', () => {
    const v = escenaCanonica()
    expect(costoEstimado(v, 'celda:6,0')).toBe(6 * ALIENTO_POR_CELDA)
    expect(costoEstimado(v, 'cuerpo:matorral')).toBe(2 * ALIENTO_POR_CELDA)
  })

  it('lo que está en la mano no cuesta caminata', () => {
    const pez = cuerpo('pez', 9, 9)
    const v = vista({ self: criatura({ holding: [pez] }), cuerpos: [pez] })
    // El cuerpo está a nueve celdas SEGÚN LA VISTA y en la mano según `self`.
    // Gana la mano: lo que se lleva encima viaja con la criatura.
    expect(costoEstimado(v, 'cuerpo:pez')).toBe(0)
  })

  it('el costo que usó la lista es el que `costoEstimado` contesta', () => {
    // Hay dos escrituras de la misma cuenta —una adentro del barrido, con la
    // distancia ya calculada, y otra que resuelve el id contra la vista— y lo
    // único que impide que digan cosas distintas es este test.
    const v = escenaCanonica()
    const lista = opportunities(v, CREENCIAS, HAMBRE, GANCHOS)
    for (const o of lista) {
      const corte = o.id.lastIndexOf('#')
      const lugar = o.id.slice(0, corte)
      const cola = o.id.slice(corte + 1)
      // La oportunidad «que se pueda comer» lleva UN TÉRMINO MÁS y `costoEstimado`
      // no lo puede adivinar: su id nombra un tag y el término extra sale del
      // ESQUEMA que prometa las condiciones. Se suma acá, leído de la misma
      // función que lo suma allá, en vez de dejar el caso afuera del barrido: lo
      // que este test cuida es que las dos escrituras de la cuenta no se
      // desincronicen, y la comestible es una escritura más.
      const comestible = cola.endsWith(COLA)
      const tag = comestible ? cola.slice(0, -COLA.length) : cola
      const pedido = comestible ? interpretar(metaComestibleDe(tag) ?? '') : undefined
      const extra = pedido === undefined ? 0 : alientoDelEsquema(pedido)
      const costo = costoEstimado(v, `${lugar}#${tag}`) + extra
      const p = tag === 'carnoso' ? 0.5 : 0.25
      expect(o.valor).toBe(valorDe(p, CALMA[tag] ?? 0, costo))
    }
  })

  it('el umbral de veneno de un tag sale del PEOR de sus miembros, y se mide', () => {
    // 1,32 calorías por kilo es el molusco, que es el carnoso más flojo del
    // catálogo; dividido por `COSTO_POR_TOXICIDAD_Y_KILO` da el veneno máximo con
    // el que tragar cualquier carnoso todavía deja algo. Nadie escribió 0,0528.
    expect(caloriasDelPeorDeTag('carnoso')).toBe(1.32)
    expect(venenoQueBanca('carnoso')).toBeCloseTo(0.0528, 12)
    expect(metaComestibleDe('carnoso')).toBe('holding(tag:carnoso,toxicity<0.0528)')
    // Y `vegetal` no tiene umbral porque tiene miembros sin calorías: no hay
    // forma de pedir «algo vegetal que se coma» sin arriesgarse a un palo.
    expect(caloriasDelPeorDeTag('vegetal')).toBe(0)
    expect(metaComestibleDe('vegetal')).toBeUndefined()
  })

  it('un id que la vista de hoy no puede resolver vale infinito, y eso es valor cero', () => {
    const v = escenaCanonica()
    expect(costoEstimado(v, 'cuerpo:fantasma#carnoso')).toBe(Number.POSITIVE_INFINITY)
    expect(costoEstimado(v, 'nada-de-esto#carnoso')).toBe(Number.POSITIVE_INFINITY)
    expect(costoEstimado(v, 'celda:,#carnoso')).toBe(Number.POSITIVE_INFINITY)
    expect(costoEstimado(v, 'celda:1.5,0')).toBe(Number.POSITIVE_INFINITY)
    // Un `Infinity` de COSTO es inofensivo: da valor 0, que se ordena como
    // cualquier otro número. El que envenena es el `Infinity` de VALOR.
    expect(valorDe(0.5, 0.9, Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('`celdaDeLugar` es el inverso exacto de `lugarDeCelda`, negativos incluidos', () => {
    // La ida y la vuelta, sobre las cuatro esquinas del signo: el mundo va de
    // −2²⁰ a 2²⁰−1 en las dos direcciones y la mitad de las celdas es negativa.
    // Un parseo que se coma el `-` manda a la criatura al otro lado del mapa.
    for (const c of [
      { x: 0, y: 0 },
      { x: -3, y: 7 },
      { x: 7, y: -3 },
      { x: -12, y: -12 },
    ]) {
      expect(celdaDeLugar(lugarDeCelda(c))).toEqual(c)
    }
    expect(celdaDeLugar('cuerpo:matorral')).toBeUndefined()
  })
})

// ─── El orden ───────────────────────────────────────────────────────────────

describe('el orden es total y estable', () => {
  it('la misma vista con los cuerpos en distinto orden de llegada da la misma lista', () => {
    const a = cuerpo('alfa', 2, 0)
    const z = cuerpo('zeta', 2, 0)
    const ctx: Readonly<Record<string, ContextKey>> = { alfa: 'a', zeta: 'z' }
    const ganchos: GanchosDeOportunidad = {
      sat: SAT,
      ctxDe: (_v, lugar) => ctx[lugar] ?? lugar,
    }
    const m = memoria({ a: { vegetal: { a: 2, b: 6 } }, z: { vegetal: { a: 2, b: 6 } } })

    const uno = opportunities(vista({ cuerpos: [a, z] }), m, HAMBRE, ganchos)
    const otro = opportunities(vista({ cuerpos: [z, a] }), m, HAMBRE, ganchos)

    // Empatan en valor EXACTAMENTE —misma distancia, misma creencia, mismo tag—
    // así que lo único que los ordena es el `id`. Sin ese desempate, `sort`
    // conserva el orden de llegada y las dos listas serían distintas.
    expect(uno[0]?.valor).toBe(uno[1]?.valor)
    expect(uno).toEqual(otro)
    expect(uno.map((o) => o.id)).toEqual(['cuerpo:alfa#vegetal', 'cuerpo:zeta#vegetal'])
  })

  it('el río y el matorral no cambian de lugar si el matorral llega primero o último', () => {
    const otros = [cuerpo('piedra', 1, 1), cuerpo('matorral', 2, 0, 'el matorral')]
    const lista = opportunities(escenaCanonica({ cuerpos: otros }), CREENCIAS, HAMBRE, GANCHOS)
    // La piedra no tiene creencia: no produce oportunidad, y no desordena nada.
    expect(lista.map((o) => o.id)).toEqual([
      'celda:6,0#carnoso',
      'cuerpo:matorral#vegetal',
      `celda:6,0#carnoso${COLA}`,
    ])
  })
})

// ─── El peligro de dividir ──────────────────────────────────────────────────

describe('el peligro de dividir', () => {
  it('costo cero no es `Infinity`: se divide por el piso', () => {
    const gratis = valorDe(0.5, 0.9, 0)
    expect(Number.isFinite(gratis)).toBe(true)
    expect(gratis).toBe((0.5 * 0.9) / PISO_DE_COSTO)
  })

  it('y dos cosas gratis se siguen ordenando entre sí por `p · sat`', () => {
    // ÉSTE es el argumento y no el susto por el `Infinity`: con `Infinity` las
    // dos empatan, el desempate cae en el `id` y la que calma nueve veces más se
    // ordena por orden alfabético.
    expect(valorDe(0.5, 0.9, 0)).toBeGreaterThan(valorDe(0.25, 0.2, 0))
    // Era 9 —`0,45 ÷ 0,05`— y hoy es `0,45 ÷ PISO_DE_COSTO` = 26,47, porque el
    // piso es un tick de estar viva y el tick bajó de 0,05 a 0,017. El número no
    // se copia: se lo pide a la misma constante que el módulo divide, que es lo
    // que el test de arriba (`costo cero no es Infinity`) ya hacía.
    expect(valorDe(0.5, 0.9, 0)).toBe((0.5 * 0.9) / PISO_DE_COSTO)
    expect(valorDe(0.5, 0.9, 0)).toBeCloseTo(26.4706, 4)
  })

  it('un valor que no es finito no entra en la lista', () => {
    // β(0,0) da `p = 0/0 = NaN`. Un `NaN` adentro del comparador rompe la
    // transitividad y `sort` pasa a depender del motor: no-determinismo con cara
    // de heurística. Se cae antes de llegar al `sort`.
    const m = memoria({ [MATORRAL]: { vegetal: { a: 0, b: 0 } } })
    const lista = opportunities(escenaCanonica(), m, HAMBRE, GANCHOS)
    expect(lista.map((o) => o.id)).toEqual([])
  })
})

// ─── El hambre ──────────────────────────────────────────────────────────────

describe('la necesidad manda', () => {
  it('una necesidad en cero no produce ninguna oportunidad', () => {
    const saciada: NeedVector = { energia: 0, calor: 0, refugio: 0 }
    expect(opportunities(escenaCanonica(), CREENCIAS, saciada, GANCHOS)).toEqual([])
  })

  it('un tag que no calma nada tampoco, aunque se crea a pie juntillas', () => {
    // p = 1 y el lugar al lado: si `sat` es 0, no hay oportunidad. Es la línea
    // `if (sat <= 0) continue` del documento.
    const m = memoria({ [MATORRAL]: { mineral: { a: 100, b: 1 } } })
    expect(opportunities(escenaCanonica(), m, HAMBRE, GANCHOS)).toEqual([])
  })
})

// ─── Las cotas ──────────────────────────────────────────────────────────────

describe('el trabajo está acotado', () => {
  it('nunca devuelve más de `OPORTUNIDADES_QUE_MIRA`, y se queda con lo más cerca', () => {
    const cuerpos: BodyView[] = []
    const tabla: Record<ContextKey, Record<string, Beta>> = {}
    const ctx: Record<string, ContextKey> = {}
    for (let i = 1; i <= 20; i++) {
      const id = `c${String(i).padStart(2, '0')}`
      cuerpos.push(cuerpo(id, i, 0))
      ctx[id] = `ctx-${id}`
      tabla[`ctx-${id}`] = { vegetal: { a: 2, b: 2 } }
    }
    const lista = opportunities(vista({ cuerpos }), memoria(tabla), HAMBRE, {
      sat: SAT,
      ctxDe: (_v, lugar) => ctx[lugar] ?? lugar,
    })
    expect(lista.length).toBe(OPORTUNIDADES_QUE_MIRA)
    // El corte es por CERCANÍA —lo caro se pierde— y el orden por valor lo
    // confirma: a igual creencia, más cerca es más barato y vale más.
    expect(lista[0]?.id).toBe('cuerpo:c01#vegetal')
    expect(lista[OPORTUNIDADES_QUE_MIRA - 1]?.id).toBe(`cuerpo:c${String(OPORTUNIDADES_QUE_MIRA).padStart(2, '0')}#vegetal`)
  })

  it('dos cuerpos del mismo contexto son un solo lugar, y gana el más cercano', () => {
    const cerca = cuerpo('cerca', 1, 0)
    const lejos = cuerpo('lejos', 5, 0)
    const m = memoria({ [MATORRAL]: { vegetal: { a: 2, b: 6 } } })
    const ganchos: GanchosDeOportunidad = { sat: SAT, ctxDe: () => MATORRAL }
    const lista = opportunities(vista({ cuerpos: [lejos, cerca] }), m, HAMBRE, ganchos)
    expect(lista.map((o) => o.id)).toEqual(['cuerpo:cerca#vegetal'])
  })

  it('el barrido de celdas se corta en la primera agua y nunca pasa el disco', () => {
    const cerca = vista({ mojadas: [{ x: 1, y: 0 }] })
    opportunities(cerca, CREENCIAS, HAMBRE, GANCHOS)
    expect(cerca.llamadasAqAt()).toBeLessThan(12)

    // Sin agua, el barrido es el disco entero y ni una celda más: (2·6+1)² = 169.
    const seca = vista({})
    opportunities(seca, CREENCIAS, HAMBRE, GANCHOS)
    const lado = 2 * RADIO_DE_AGUA + 1
    expect(seca.llamadasAqAt()).toBe(lado * lado)
  })

  it('el agua recordada entra aunque esté fuera del disco', () => {
    // Hoy el libro sólo anota lo que se PISÓ, así que esto casi nunca contesta
    // en producción —el hueco está medido en `perceive/tests/los-lugares.test.ts`—
    // pero la mente ya lo mira: el día que el libro anote lo que se ve, funciona.
    const v = vista({ recuerdos: [{ at: { x: 30, y: 0 }, wet: 1 }] })
    const m = memoria({ [AGUA]: { carnoso: { a: 2, b: 2 } } })
    const lista = opportunities(v, m, HAMBRE, {
      sat: SAT,
      ctxDe: (_v, lugar) => (lugar === 'celda:30,0' ? AGUA : lugar),
    })
    expect(lista.map((o) => o.id)).toEqual(['celda:30,0#carnoso', `celda:30,0#carnoso${COLA}`])
    // El `+ 1,5` que había acá sumaba SEGUNDOS a ALIENTO y daba el número justo
    // sólo porque `COSTO_VIVIR_POR_SEGUNDO` valía 1,0. Con la constante en 0,34 la
    // cuenta se separó (2,52 contra 3,51) y quedó a la vista: lo que
    // `alientoDeConseguir` suma es `COSTO_VIVIR_POR_SEGUNDO × segundos`.
    expect(lista[0]?.valor).toBe(
      valorDe(0.5, 0.9, 30 * ALIENTO_POR_CELDA + COSTO_VIVIR_POR_SEGUNDO * 1.5),
    )
  })
})

// ─── El contrato con el planificador ────────────────────────────────────────

describe('el contrato con D4', () => {
  it('`meta` es el MISMO TEXTO que `SCHEMA_INDEX` indexa', () => {
    // Si esto se rompe, la mente pide algo que el índice no conoce y el plan de
    // la pesca no arranca nunca. El texto no se escribe en `oportunidades.ts`:
    // lo escribe `textoDe` de `@anima/plan`, que es el mismo que arma el índice.
    expect(metaDe('carnoso')).toBe('holding(tag:carnoso)')
    expect(SCHEMA_INDEX.has(metaDe('carnoso'))).toBe(true)

    const lista = opportunities(escenaCanonica(), CREENCIAS, HAMBRE, GANCHOS)
    expect(SCHEMA_INDEX.has(lista[0]?.meta ?? '')).toBe(true)
  })

  it('un tag que la física no conoce no llega a D4', () => {
    // `pescado` es una SUSTANCIA, no un tag: `interpretar` lo rechaza y la
    // oportunidad no se emite. Sin este filtro, la fila mal escrita de la tabla
    // de creencias se descubre tres peldaños más abajo, disfrazada de objetivo
    // imposible.
    const m = memoria({ [MATORRAL]: { pescado: { a: 9, b: 1 } } })
    const ganchos: GanchosDeOportunidad = {
      sat: () => 0.9,
      ctxDe: CTX_DE,
    }
    expect(opportunities(escenaCanonica(), m, HAMBRE, ganchos)).toEqual([])
  })

  it.fails('el agua a la vista todavía no tiene clave de contexto', () => {
    // LA MITAD DE LA COSTURA QUE FALTA DEL OTRO LADO, medida y no comentada al
    // pasar. Acá NO se inyecta `ctxDe`: corre el `contextoDe` de verdad, el de
    // `creencias.ts`. Y ése sólo sabe de cuerpos —recorre `see([])` buscando el
    // id y devuelve `SIN_CUERPO` si no está—, así que `celda:6,0` resuelve a
    // `SIN_CUERPO`, que no tiene tags, y el río no produce nada: la lista sale
    // VACÍA. Verificado directamente: `contextoDe(v, 'celda:6,0') === SIN_CUERPO`.
    //
    // La reparación es de aquel lado y es chica: que `contextoDe` reconozca la
    // forma `celda:x,y` y devuelva la clave del lugar sin forma de cuerpo. Este
    // módulo ya le pasa la clave correcta, así que cuando eso pase, este test se
    // pone verde solo y hay que sacarle el `.fails`.
    const m = memoria({ 'agua|c--e': { carnoso: { a: 1.5, b: 0.5 } } })
    const lista = opportunities(escenaCanonica(), m, HAMBRE, { sat: SAT })
    expect(lista.map((o) => o.id)).toEqual(['celda:6,0#carnoso'])
  })

  it('D3 no escribe en la memoria', () => {
    // `observe` y `seed` de la memoria de mentira lanzan. Que la corrida
    // canónica pase es la prueba: mirar oportunidades no es aprender.
    expect(() => opportunities(escenaCanonica(), CREENCIAS, HAMBRE, GANCHOS)).not.toThrow()
  })
})
