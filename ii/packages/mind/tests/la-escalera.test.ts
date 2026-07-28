// ─── LA ESCALERA — D0 a D5, con corte al primero que decide ─────────────────
//
//   pnpm --filter @anima/mind test
//
// SE TESTEA SIN MUNDO, igual que el planificador, las oportunidades y las
// creencias, y por la misma razón: `VistaDeLaMente` es `VistaDelPlan`, o sea un
// SUBCONJUNTO ESTRUCTURAL de `Ctx`. Si algún día hiciera falta arrancar un mundo
// para preguntarle a la mente qué hace, la interfaz habría dejado de ser un
// subconjunto y ÉSA sería la noticia.
//
// ─── QUÉ ES EL «EJECUTOR DE MENTIRA», Y QUÉ NO ES ───────────────────────────
//
// La mitad de este archivo es una `Escena` mutable con un ejecutor arriba. No
// pretende ser `stepWorld`: pretende ser **la parte del mundo que decide cuántos
// ticks tarda cada cosa**, porque de ahí y de ningún otro lado sale el número
// del requisito 2 («qué porcentaje de los ticks corta en D1»).
//
// Y las dos duraciones que mandan NO son inventadas acá:
//
//   · **caminar cuesta un tick por celda.** Lo hace `intencionCaminar` del
//     mundo, que avanza una celda por intención, y lo verifica
//     `world/tests/el-tiempo-no-depende-del-tick.test.ts` a cuatro frecuencias.
//   · **aplicar un proceso cuesta `completion.at × hz` ticks.** Es la misma
//     cuenta que hace `Vuelo.#abrir` en `@anima/perceive` para armar su tope, y
//     acá se le pregunta al MISMO catálogo con `procesoDe`.
//
// O sea que el porcentaje que sale de esta corrida es una predicción de la
// conducta del mundo calculada con las tasas del mundo, no una calibración. La
// corrida contra `stepWorld` de verdad es del tramo de `mente.ts`, que es quien
// tiene una `Partida`.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { QualityId } from '@anima/physics'
import { HZ_DE_REFERENCIA, evalQuality, specOf } from '@anima/physics'
import type { GoalId, PredicateSignature, Ref, Step } from '@anima/plan'
import { EXPANSIONES_POR_TICK, firmaDe, interpretar, plan, procesoDe, resolver, SCHEMA_INDEX } from '@anima/plan'
import type { BodyId, BodyView, Cell, CellQuality, Clock, PlaceMemory, SelfView, Where, WhereCell } from '@anima/skills'

import { Creencias, contextoDe } from '../src/creencias.js'
import {
  aterrizar,
  avanzarReloj,
  clonarEstado,
  decidir,
  nuevoEstado,
  sinVocabulario,
  type EstadoDeLaEscalera,
} from '../src/escalera.js'
import { necesidades } from '../src/necesidades.js'
import { metaDe } from '../src/oportunidades.js'
import type {
  AffordanceMemory,
  Decision,
  Drive,
  Intencion,
  MenteOptions,
  NeedVector,
  Opportunity,
  Peldano,
  VistaDeLaMente,
} from '../src/tipos.js'
import { MARGEN_DE_HISTERESIS, PERMANENCIA_EN_TICKS } from '../src/tipos.js'

// ─── La escena ──────────────────────────────────────────────────────────────

type Cualidades = Partial<Record<QualityId, number>>

interface Cosa {
  id: BodyId
  at: Cell
  name: string
  q: Cualidades
  /** En la mano de la criatura. */
  enMano: boolean
  /** Se lo comió `union`: sigue en el mapa para que nadie lo vuelva a nombrar. */
  gastado: boolean
}

interface Escena {
  at: Cell
  stamina: number
  cosas: Map<BodyId, Cosa>
  mojadas: Cell[]
  reloj: Clock
  /** La temperatura de la celda donde está parada. Es lo que dispara D0. */
  temperaturaDelSuelo: number
  cobijo: number
  /** Cuántos cuerpos nuevos se crearon: para los ids. */
  nacidos: number
}

const T_DEL_CUERPO = 15

function cosa(id: string, x: number, y: number, q: Cualidades, name = id): Cosa {
  return { id, at: { x, y }, name, q, enMano: false, gastado: false }
}

function escena(o: {
  at?: Cell
  stamina?: number
  cosas?: readonly Cosa[]
  mojadas?: readonly Cell[]
  reloj?: Clock
  temperaturaDelSuelo?: number
  cobijo?: number
}): Escena {
  const m = new Map<BodyId, Cosa>()
  for (const c of o.cosas ?? []) m.set(c.id, c)
  return {
    at: o.at ?? { x: 0, y: 0 },
    stamina: o.stamina ?? 310,
    cosas: m,
    mojadas: [...(o.mojadas ?? [])],
    // Mediodía: `secondsToNightfall` es la mitad de la luz, o sea `refugio = 0`.
    reloj: o.reloj ?? { phase: 'dia', secondsToNightfall: 100, dayLength: 200 },
    temperaturaDelSuelo: o.temperaturaDelSuelo ?? T_DEL_CUERPO,
    cobijo: o.cobijo ?? 0,
    nacidos: 0,
  }
}

/**
 * `portable` LA CONTESTA EL MOTOR y no el fixture, igual que en el arnés del
 * planificador: la regresión le agrega `portable > 0` a todo rol de un proceso
 * `held`, y escribir el tope de 8 kg acá sería una segunda copia del catálogo.
 */
function portableDe(mass: number): number {
  const d = specOf('portable').derived
  if (d === undefined) throw new Error('`portable` dejó de ser derivada: el arnés se quedó viejo')
  const noHace = (): never => {
    throw new RangeError('`portable` sólo depende de `own(mass)`')
  }
  return evalQuality(d, {
    own: (q) => (q === 'mass' ? mass : 0),
    geom: noHace,
    sumParts: noHace,
    maxParts: noHace,
    substance: noHace,
  })
}

function visibles(s: Escena): Cosa[] {
  return [...s.cosas.values()].filter((c) => !c.gastado)
}

function vistaDe(s: Escena): VistaDeLaMente {
  const qde = (b: BodyView, q: QualityId): number => {
    if (b.id === 'yo') {
      if (q === 'stamina') return s.stamina
      if (q === 'temperature') return T_DEL_CUERPO
      return q === 'portable' ? portableDe(2) : 0
    }
    const c = s.cosas.get(b.id)
    const puesta = c?.q[q]
    if (puesta !== undefined) return puesta
    return q === 'portable' ? portableDe(c?.q.mass ?? 0) : 0
  }
  const comoVista = (c: Cosa): BodyView => ({
    id: c.id,
    at: c.enMano ? s.at : c.at,
    name: c.name,
    madeByMe: false,
    joints: [],
  })
  const self: SelfView = {
    id: 'yo',
    at: s.at,
    name: 'criatura',
    madeByMe: false,
    joints: [],
    holding: visibles(s).filter((c) => c.enMano).map(comoVista),
    capacity: 3,
    stamina: s.stamina,
    permits: 'reversible',
  }
  return {
    see(w: Where): readonly BodyView[] {
      const out: BodyView[] = []
      for (const c of visibles(s)) {
        const b = comoVista(c)
        let ok = true
        for (const t of w) {
          const x = qde(b, t.q)
          const pasa = t.op === '>=' ? x >= t.v : t.op === '<=' ? x <= t.v : t.op === '>' ? x > t.v : x < t.v
          if (!pasa) ok = false
        }
        if (ok) out.push(b)
      }
      return out
    },
    // El libro de lugares sólo anota lo que se PISÓ, y una criatura no camina
    // adentro del agua franca: la rama del agua recordada está medida como
    // hueco en `oportunidades.ts` y acá se deja vacía a propósito.
    recall: (_w: WhereCell): readonly PlaceMemory[] => [],
    q: qde,
    qAt: (at: Cell, q: CellQuality): number => {
      if (q === 'wet') return s.mojadas.some((c) => c.x === at.x && c.y === at.y) ? 1 : 0
      if (q === 'temperature') return at.x === s.at.x && at.y === s.at.y ? s.temperaturaDelSuelo : T_DEL_CUERPO
      if (q === 'sheltered') return at.x === s.at.x && at.y === s.at.y ? s.cobijo : 0
      return 0
    },
    self,
    clock: s.reloj,
  }
}

// ─── El ejecutor de mentira ─────────────────────────────────────────────────

function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

/** Cuántos ticks tarda una intención. Ver el encabezado: las tasas son del mundo. */
function duracion(i: Intencion, s: Escena, rindes: ReadonlyMap<GoalId, BodyView>): number {
  switch (i.k) {
    case 'ir': {
      const donde = resolver(i.a, vistaDe(s), rindes)
      if (donde === undefined) return 1
      const at = 'at' in donde ? donde.at : donde
      // `goTo(within: 1)` se da por llegado a una celda de distancia, que es la
      // condición de `aMano()` del mundo.
      return Math.max(1, chebyshev(s.at, at) - 1)
    }
    case 'aplicar': {
      const at = procesoDe(i.proceso).completion?.at
      return at === undefined ? 1 : Math.ceil(at * HZ_DE_REFERENCIA) + 1
    }
    case 'explorar':
      return i.maxTicks
    default:
      return 1
  }
}

interface Efecto {
  ok: boolean
  /** El cuerpo que nació, si nació alguno: es lo que se anota bajo `rinde`. */
  rindio?: BodyId
}

/**
 * Qué le hace al mundo una intención que se completó.
 *
 * Es lo mínimo para que la cadena de la caña AVANCE: si `sostener` no pusiera
 * nada en la mano y `unir` no consumiera nada, el plan del tick siguiente sería
 * idéntico al de éste y la corrida no mediría ningún progreso.
 */
function aplicarEfecto(i: Intencion, s: Escena, rindes: ReadonlyMap<GoalId, BodyView>): Efecto {
  const v = vistaDe(s)
  const cuerpoDe = (r: Ref): Cosa | undefined => {
    const x = resolver(r, v, rindes)
    if (x === undefined || !('id' in x)) return undefined
    return s.cosas.get(x.id)
  }
  switch (i.k) {
    case 'ir': {
      const donde = resolver(i.a, v, rindes)
      if (donde === undefined) return { ok: false }
      const at = 'at' in donde ? donde.at : donde
      // Se para AL LADO, que es lo que `goTo(within: 1)` promete.
      s.at = { x: at.x === s.at.x ? at.x : at.x - Math.sign(at.x - s.at.x), y: at.y }
      return { ok: true }
    }
    case 'sostener': {
      const c = cuerpoDe(i.que)
      if (c === undefined) return { ok: false }
      c.enMano = true
      return { ok: true }
    }
    case 'unir': {
      const binder = cuerpoDe(i.binder)
      const a = cuerpoDe(i.a)
      if (binder === undefined || a === undefined) return { ok: false }
      binder.gastado = true
      a.gastado = true
      s.nacidos += 1
      const id = `hecho-${String(s.nacidos)}`
      // Lo que sale de atar una vara con una liana: alcanza y engancha. Los dos
      // números son los que el esquema de `catch>0 & reach>=2` pide.
      const nuevo = cosa(id, s.at.x, s.at.y, { mass: 4, reach: 4, catch: 1, flexibility: 0.5 }, 'la caña')
      nuevo.enMano = true
      s.cosas.set(id, nuevo)
      return { ok: true, rindio: id }
    }
    case 'deshilachar': {
      const f = cuerpoDe(i.fuente)
      if (f === undefined) return { ok: false }
      s.nacidos += 1
      const id = `hebra-${String(s.nacidos)}`
      const nuevo = cosa(id, s.at.x, s.at.y, { mass: 0.1, flexibility: 0.9, tensile: 0.7 }, 'una hebra')
      nuevo.enMano = true
      s.cosas.set(id, nuevo)
      return { ok: true, rindio: id }
    }
    case 'aplicar': {
      if (i.proceso !== 'extraccion') return { ok: true }
      s.nacidos += 1
      const id = `pesca-${String(s.nacidos)}`
      const nuevo = cosa(id, s.at.x, s.at.y, { mass: 0.4, nutrition: 8, digestibility: 0.6 }, 'un pescado')
      nuevo.enMano = true
      s.cosas.set(id, nuevo)
      return { ok: true, rindio: id }
    }
    // Deambular gasta ticks y no consigue nada, que es lo que deambular es. Las
    // dos conductas fallan porque en esta escena no hay ni reparo ni sombra: es
    // el caso que hace falta para probar que la rueda de D5 no se traba.
    case 'explorar':
      return { ok: true }
    default:
      return { ok: false }
  }
}

interface Corrida {
  readonly peldanos: Readonly<Record<Peldano, number>>
  readonly clases: Readonly<Record<Decision['k'], number>>
  readonly ticks: number
  readonly hechas: readonly string[]
  readonly estado: EstadoDeLaEscalera
  readonly escena: Escena
}

/** El bucle: avanzar el reloj, decidir, y hacerle al mundo lo que se decidió. */
function correr(s: Escena, o: MenteOptions, ticks: number): Corrida {
  const e = nuevoEstado()
  const peldanos: Record<Peldano, number> = { D0: 0, D1: 0, D2: 0, D3: 0, D4: 0, D5: 0 }
  const clases: Record<Decision['k'], number> = { seguir: 0, volar: 0, plan: 0, abortar: 0 }
  const hechas: string[] = []
  const rindes = new Map<GoalId, BodyView>()
  let enCurso: { i: Intencion; faltan: number } | undefined

  for (let t = 0; t < ticks; t++) {
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, o)
    peldanos[d.por] += 1
    clases[d.k] += 1

    if (d.k === 'abortar') enCurso = undefined
    if (d.k === 'volar') enCurso = { i: d.paso, faltan: duracion(d.paso, s, rindes) }
    if (d.k === 'plan') {
      const primero = d.pasos[0]
      if (primero !== undefined) enCurso = { i: primero, faltan: duracion(primero, s, rindes) }
    }

    if (enCurso !== undefined) {
      enCurso.faltan -= 1
      if (enCurso.faltan <= 0) {
        const r = aplicarEfecto(enCurso.i, s, rindes)
        const llave = 'rinde' in enCurso.i ? enCurso.i.rinde : undefined
        if (r.rindio !== undefined && llave !== undefined) {
          const b = vistaDe(s).see([]).find((x) => x.id === r.rindio)
          if (b !== undefined) rindes.set(llave, b)
        }
        hechas.push(resumir(enCurso.i))
        aterrizar(e, r.ok)
        enCurso = undefined
      }
    }
  }
  return { peldanos, clases, ticks, hechas, estado: e, escena: s }
}

function resumir(i: Intencion): string {
  switch (i.k) {
    case 'ir':
      return `ir(${corto(i.a)})`
    case 'sostener':
      return `sostener(${corto(i.que)})`
    case 'unir':
      return `unir(binder=${corto(i.binder)}, a=${corto(i.a)})`
    case 'deshilachar':
      return `deshilachar(${corto(i.fuente)})`
    case 'aplicar':
      return `aplicar(${i.proceso})`
    case 'explorar':
      return 'explorar'
    case 'juntar':
      return 'juntar'
    default:
      return i.k
  }
}

function corto(r: Ref): string {
  if (r.k === 'id') return r.id
  if (r.k === 'rinde') return 'lo-que-hice'
  return r.k
}

function pasosDe(d: Decision): readonly Step[] {
  if (d.k !== 'plan') throw new Error(`se esperaba un plan y salió ${d.k}: ${d.porque}`)
  return d.pasos
}

// ─── La escena canónica del documento ───────────────────────────────────────
//
// «Tengo hambre, veo un río, probablemente haya pescado.» Es la misma escena que
// pina `plan/tests/la-regresion.test.ts`, con dos cambios que la mente necesita
// y el planificador no:
//
//   · el pozo lleva `nutrition` y `fuelEnergy`, porque la CLAVE DE CONTEXTO de
//     `creencias.ts` los mide: sin ellos el pozo no cae en `agua|mc--e` y la fila
//     de instinto que dice «un cuerpo de agua rinde carnoso» no se activa nunca.
//     Los dos valores son los de un banco de peces de la semilla, medidos por el
//     tramo de creencias;
//   · la `stamina` es 310 de un tanque de 1000 —el `0,31` del documento leído
//     como fracción—, porque el catálogo dice `range: [0, 1000]` y un 0,31
//     literal sería una criatura a tres décimas de segundo de morirse.

function elRio(): Escena {
  return escena({
    stamina: 310,
    cosas: [
      cosa('matorral', 2, 0, { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }, 'el matorral'),
      cosa('vara', 5, 0, { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }, 'la vara'),
      cosa('pozo', 8, 0, { mass: 50, nutrition: 6, fuelEnergy: 4 }, 'el pozo'),
    ],
    mojadas: [{ x: 8, y: 0 }],
  })
}

function conCreencias(extra: Partial<MenteOptions> = {}): MenteOptions {
  return { actor: 'yo', memoria: new Creencias(), ...extra }
}

const COMIDA: PredicateSignature = metaDe('carnoso')

// ─── (1) LA CORRIDA DEL DOCUMENTO ───────────────────────────────────────────

describe('la corrida del documento: hambre, un río a la vista, y la cadena de la caña', () => {
  it('el pozo cae en el contexto del instinto, que es lo que hace que el río exista para la mente', () => {
    const s = elRio()
    // Si esto se rompe, todo lo demás de este bloque se cae con un mensaje que
    // no dice por qué: la mente no ve «un río», ve una clave de contexto.
    expect(contextoDe(vistaDe(s), 'pozo')).toBe('agua|mc--e')
  })

  it('con hambre, D3 elige la comida y el plan que sale es la cadena de la caña', () => {
    const s = elRio()
    const e = nuevoEstado()
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, conCreencias())

    expect(d.por).toBe('D3')
    expect(d.k).toBe('plan')
    if (d.k !== 'plan') throw new Error('imposible')
    expect(d.meta).toBe(COMIDA)
    expect(pasosDe(d).map(resumir)).toEqual([
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(binder=matorral, a=vara)',
      'ir(pozo)',
      'aplicar(extraccion)',
    ])
    console.log(`\n  D3 dijo: ${d.porque}\n  y el plan salió por ${d.por} con ${String(d.pasos.length)} pasos`)
  })

  it('y la corrida entera llega a pescar: los siete pasos se ejecutan en orden', () => {
    const r = correr(elRio(), conCreencias(), 60)
    expect(r.hechas.slice(0, 7)).toEqual([
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(binder=matorral, a=vara)',
      'ir(pozo)',
      'aplicar(extraccion)',
    ])
    // Y el pescado quedó en la mano. Es el criterio del Hito 5 dicho sobre esta
    // escena: de «tengo hambre» a «tengo algo carnoso», sin una línea cableada.
    const enMano = [...r.escena.cosas.values()].filter((c) => c.enMano && !c.gastado).map((c) => c.name)
    expect(enMano).toContain('un pescado')
    console.log(`\n  la corrida hizo: ${r.hechas.slice(0, 7).join(' · ')}`)
  })

  it('el `gear` de la pesca es un RENDIMIENTO diferido, y la escalera lo entrega sin resolverlo', () => {
    // El ADR 0082 portado, visto desde la mente: la caña que sale de `unir` no
    // existe cuando el plan se arma —`union` consume la vara y la liana y crea
    // un cuerpo con id nuevo— así que el paso que la usa la nombra por
    // `{k:'rinde'}`. Lo que este test pina es que la escalera **no resuelve los
    // `Ref` al decidir**: los entrega tal cual, y quien los liga es el ejecutor
    // con la vista del momento. Si la escalera los resolviera acá, la cadena se
    // caería en el tercer eslabón, que es el bug exacto que el 0082 arregló.
    const s = elRio()
    const e = nuevoEstado()
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, conCreencias())
    const extraer = pasosDe(d).find((p) => p.k === 'aplicar')
    expect(extraer).toBeDefined()
    if (extraer === undefined || extraer.k !== 'aplicar') throw new Error('imposible')
    expect(extraer.roles['gear']).toEqual({ k: 'rinde', de: 'catch>0&reach>=2@./gear' })
    expect(extraer.roles['source']).toEqual({ k: 'id', id: 'pozo' })

    // Y el ejecutor lo liga: la corrida entera termina con un pescado, o sea que
    // la referencia diferida se resolvió contra el cuerpo que `unir` creó.
    const r = correr(elRio(), conCreencias(), 60)
    expect(r.hechas[6]).toBe('aplicar(extraccion)')
  })

  it('HUECO MEDIDO: la meta nunca se da por cumplida, así que vuelve a pescar', () => {
    // `cumpleCuerpo` contesta `false` a todo `holding(tag:…)` y lo dice en su
    // propio comentario: «para contestar esto hay que saber de qué sustancia
    // está hecho el cuerpo, y una `BodyView` no trae ninguna de las dos». La
    // consecuencia para la escalera está acá y no escondida: con el pescado en
    // la mano, D1 no corta por «ya lo tengo» y D4 arma otro plan.
    const p = interpretar(COMIDA)
    expect(p).toBeDefined()
    const s = elRio()
    const pescado = cosa('pescado', 0, 0, { mass: 0.4, nutrition: 8 }, 'un pescado')
    pescado.enMano = true
    s.cosas.set('pescado', pescado)
    const e = nuevoEstado()
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, conCreencias())
    // Con la meta contestable, esto sería una conducta de fondo (D5) o un
    // objetivo distinto. Es un plan para volver a pescar.
    expect(d.k).toBe('plan')
    expect(d.k === 'plan' && d.meta).toBe(COMIDA)
  })
})

// ─── (2) D0 · el reflejo ────────────────────────────────────────────────────

describe('D0 · el reflejo', () => {
  it('la celda que quema corta todo y manda a huir, y no hay número escrito en la escalera', () => {
    const s = elRio()
    s.temperaturaDelSuelo = 400
    const e = nuevoEstado()
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, conCreencias())
    expect(d.por).toBe('D0')
    expect(d.k).toBe('volar')
    expect(d.k === 'volar' && d.paso.k).toBe('huir')
  })

  it('el reflejo NO se interrumpe a sí mismo: mientras huye, contesta `seguir`', () => {
    const s = elRio()
    s.temperaturaDelSuelo = 400
    const e = nuevoEstado()
    const o = conCreencias()
    avanzarReloj(e)
    expect(decidir(vistaDe(s), e, o).k).toBe('volar')
    avanzarReloj(e)
    const otra = decidir(vistaDe(s), e, o)
    expect(otra.por).toBe('D0')
    expect(otra.k).toBe('seguir')
  })

  it('el umbral se lee del contrato de la innata, no se escribe: 59 no dispara y 60 sí', () => {
    // Lo que ataja: que alguien mueva el 60 de `huir-del-dolor.ts` y la escalera
    // se quede disparando en un umbral que la habilidad ya no reconoce —la
    // criatura huiría, `huirDelDolor` contestaría `done()` sin caminar, y el
    // bucle se repetiría todos los ticks sin gastar aliento ni avanzar.
    for (const [t, esperado] of [[59, false], [60, true]] as const) {
      const s = elRio()
      s.temperaturaDelSuelo = t
      const e = nuevoEstado()
      avanzarReloj(e)
      expect(decidir(vistaDe(s), e, conCreencias()).por === 'D0').toBe(esperado)
    }
  })

  it('la fila de la CAÍDA no existe, y es una medición: el mundo no tiene altura', () => {
    // `grep -rniE '\bcaida|\bfall|gravedad|gravity' world/src physics/src` da UNA
    // coincidencia y es la palabra «caída» adentro de un comentario sobre
    // hojarasca. Se verifica acá para que la ausencia sea una afirmación con
    // fecha y no un olvido.
    const raiz = fileURLToPath(new URL('../../', import.meta.url))
    const patron = /\b(caida|caída|falling|gravedad|gravity)\b/i
    const golpes: string[] = []
    for (const paquete of ['world', 'physics']) {
      const dir = `${raiz}${paquete}/src/`
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
        const codigo = readFileSync(dir + f, 'utf8')
          .split('\n')
          .filter((l) => {
            const t = l.trimStart()
            return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
          })
          .join('\n')
        if (patron.test(codigo)) golpes.push(`${paquete}/src/${f}`)
      }
    }
    expect(golpes).toEqual([])
  })
})

// ─── (3) REQUISITO 2 · D1 cubre el grueso ───────────────────────────────────

describe('requisito 2 · cuánto corta D1', () => {
  it('la corrida canónica, con el porcentaje medido y no estimado', () => {
    const r = correr(elRio(), conCreencias(), 200)
    const total = r.ticks
    const enD1 = r.peldanos.D1
    const pct = (100 * enD1) / total
    console.log(
      `\n  ── el reparto de ${String(total)} ticks ──\n` +
        (['D0', 'D1', 'D2', 'D3', 'D4', 'D5'] as const)
          .map((p) => `  ${p}: ${String(r.peldanos[p])} (${((100 * r.peldanos[p]) / total).toFixed(1)}%)`)
          .join('\n') +
        `\n  y por clase: ${(['seguir', 'volar', 'plan', 'abortar'] as const)
          .map((k) => `${k} ${String(r.clases[k])}`)
          .join(', ')}\n`,
    )
    // ─── POR QUÉ DA 97 Y NO 60, y no se ajusta ────────────────────────────
    //
    // El documento estima ~60%. Acá da 97,0%, y la diferencia NO es una
    // calibración que falte: son las duraciones del mundo. De los 46 ticks que
    // dura un ciclo de pesca en esta escena, **31 son el `aplicar(extraccion)`**
    // —`completion.at` es 1,5 s y la frecuencia de referencia es 20 Hz— y otros
    // 12 son caminata a una celda por tick. Sólo 7 ticks del ciclo tienen algo
    // que decidir. O sea que en una criatura QUE SIEMPRE TIENE UN PLAN, D1 no
    // puede dar 60: la aritmética de las duraciones lo prohíbe.
    //
    // El 60% del documento es una vida MEZCLADA: ratos con plan y ratos sin
    // nada que hacer. La otra punta está medida en el test de abajo —el páramo
    // da 87,5%, que es 7 de cada 8 ticks de deambular— y las dos juntas dicen
    // que **el número no es una propiedad de la escalera sino de la agenda**.
    // Lo que la escalera garantiza y esto sí verifica es lo que importa: D1
    // carga el tick, y solo, contra los otros cinco peldaños juntos.
    expect(pct).toBeGreaterThan(50)
    expect(enD1).toBeGreaterThan(r.peldanos.D3 + r.peldanos.D4 + r.peldanos.D5)

    // Y la aritmética de arriba, verificada y no afirmada: el `aplicar` dura lo
    // que dice el catálogo, y eso es lo que se come el ciclo.
    const at = procesoDe('extraccion').completion?.at
    expect(at).toBeDefined()
    if (at === undefined) throw new Error('imposible')
    const ticksDePesca = Math.ceil(at * HZ_DE_REFERENCIA) + 1
    expect(ticksDePesca).toBe(31)
    expect(ticksDePesca / total).toBeGreaterThan(0.1)
  })

  it('y el grueso de D1 es `seguir`: caminar es lo que llena los ticks', () => {
    const r = correr(elRio(), conCreencias(), 200)
    // Un `ir` a ocho celdas son siete ticks de `seguir` y uno de `volar`. Si esta
    // proporción se diera vuelta, la mente estaría re-decidiendo en el medio de
    // cada paso, que es exactamente lo que D1 existe para no hacer.
    expect(r.clases.seguir).toBeGreaterThan(r.clases.volar)
  })

  it('LA OTRA PUNTA: sin nada que hacer, D1 baja y el que carga el tick es D5', () => {
    // El porcentaje de D1 no es una constante de la mente: es **cuánta parte de
    // su vida la criatura pasa ejecutando algo largo**. Medir sólo la escena
    // donde hay un plan de siete pasos daría un número alto y mudo. Acá está la
    // otra punta —una criatura sola en el páramo, sin nada a la vista y sin
    // creencias que activar— y las dos juntas son el rango honesto.
    const r = correr(escena({ cosas: [], stamina: 1000 }), { actor: 'yo', memoria: MEMORIA_MUDA }, 200)
    const pct = (100 * r.peldanos.D1) / r.ticks
    console.log(
      `\n  ── el páramo, ${String(r.ticks)} ticks ──\n` +
        (['D0', 'D1', 'D2', 'D3', 'D4', 'D5'] as const)
          .map((p) => `  ${p}: ${String(r.peldanos[p])} (${((100 * r.peldanos[p]) / r.ticks).toFixed(1)}%)`)
          .join('\n'),
    )
    // Deambular dura `PERMANENCIA_EN_TICKS`, así que de cada ocho ticks siete son
    // D1 y uno es D5. La cota de abajo es lo que hace que el número diga algo.
    expect(r.peldanos.D5).toBeGreaterThan(0)
    expect(pct).toBeLessThan(100)
  })
})

// ─── (3 bis) D1 · cuándo la actividad DEJA de ser válida ────────────────────

describe('D1 · las tres formas de que un plan deje de valer', () => {
  it('si el cuerpo que el plan nombraba ya no está, el plan se tira y se replanifica', () => {
    const s = elRio()
    const e = nuevoEstado()
    const o = conCreencias()
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, o)
    expect(d.k).toBe('plan')
    // Se ejecuta el primer paso y se le saca del mundo el cuerpo que el segundo
    // nombraba. Es lo que pasa cuando otra criatura se lleva la vara.
    aterrizar(e, true)
    s.cosas.delete('vara')
    avanzarReloj(e)
    const otra = decidir(vistaDe(s), e, o)
    // NO es un `seguir` sobre un plan roto: se rehízo.
    expect(otra.k).toBe('plan')
    expect(otra.por).toBe('D4')
    expect(pasosDe(otra).map(resumir)[0]).not.toBe('sostener(vara)')
    console.log(`\n  se llevaron la vara → ${otra.por}: ${pasosDe(otra).map(resumir).join(' · ')}`)
  })

  it('si la meta ya está cumplida, D1 ABORTA lo que estuviera volando', () => {
    // Hace falta una meta que se pueda dar por cumplida, o sea una de cualidad:
    // `holding(tag:…)` no la contesta nadie (ver el hueco medido más arriba).
    const caliente: PredicateSignature = 'temperature>=400'
    const s = escena({ cosas: [cosa('brasa', 3, 0, { temperature: 900, mass: 1 }, 'una brasa')] })
    const e = nuevoEstado()
    const o: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      oportunidades: () => [oportunidad(caliente, 1)],
    }
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, o)
    // La brasa ya cumple `temperature>=400`, así que el primer tick ya la ve
    // cumplida y no arranca nada.
    expect(d.por).toBe('D5')
    expect(e.metaEnCurso).toBeUndefined()

    // Y con algo volando, el aviso es un `abortar`.
    const s2 = escena({ cosas: [cosa('brasa', 3, 0, { temperature: 10, mass: 1 }, 'una brasa fría')] })
    const e2 = nuevoEstado()
    const o2: MenteOptions = { ...o, oportunidades: () => [oportunidad(caliente, 1)] }
    avanzarReloj(e2)
    decidir(vistaDe(s2), e2, o2)
    expect(e2.metaEnCurso).toBe(caliente)
    expect(e2.enVuelo).toBeDefined()
    // El mundo la calienta por su cuenta mientras la criatura iba en camino.
    const brasa = s2.cosas.get('brasa')
    expect(brasa).toBeDefined()
    if (brasa === undefined) throw new Error('imposible')
    brasa.q.temperature = 900
    avanzarReloj(e2)
    const otra = decidir(vistaDe(s2), e2, o2)
    expect(otra.k).toBe('abortar')
    expect(otra.por).toBe('D1')
    expect(e2.metaEnCurso).toBeUndefined()
  })

  it('un paso que falla se lleva el plan entero, no sólo a sí mismo', () => {
    const s = elRio()
    const e = nuevoEstado()
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, conCreencias())
    expect(d.k).toBe('plan')
    expect(e.pasosPendientes.length).toBe(6)
    aterrizar(e, false)
    // Los pasos siguientes se encadenan por `{k:'rinde'}`: ejecutar el que sigue
    // después de que el anterior no rindió es correr un plan que nombra algo que
    // no se hizo.
    expect(e.pasosPendientes.length).toBe(0)
    expect(e.metaEnCurso).toBe(COMIDA)
  })
})

// ─── (4) REQUISITO 3 · la histéresis no oscila ──────────────────────────────
//
// Se prueba con la costura de D3 inyectada, y el porqué está en `MenteOptions`:
// armar «dos valores que se cruzan de a poco» moviendo cuerpos por el mapa
// probaría el costo, la creencia y la satisfacción a la vez, y rompería por las
// tres. Lo que este bloque prueba es EL PORTÓN.

function oportunidad(meta: PredicateSignature, valor: number): Opportunity {
  return { meta, valor, id: meta, porque: `vale ${valor.toFixed(3)}` }
}

const META_A = metaDe('carnoso')

/**
 * LA SEGUNDA META TIENE QUE SER UNA QUE LA ESCALERA PUEDA QUERER.
 *
 * Era `metaDe('vegetal')` y dejó de servir el día que D3 aprendió a saltear las
 * metas que ningún esquema establece (decisión 7 de `escalera.ts`): con
 * `holding(tag:vegetal)` el portón de la histéresis no se llegaba a probar,
 * porque el retador se caía un peldaño antes por otro motivo.
 *
 * `temperature>=400` sí está en el catálogo —la establece `friccion`— y no la
 * cumple nada de estas escenas, que es lo que hace falta: un retador legítimo
 * que la escalera pueda tomar si el portón se lo permite. Lo que se prueba acá
 * sigue siendo EL PORTÓN, no el tag.
 */
const META_B: PredicateSignature = 'temperature>=400'

/** El memoria de mentira: D3 no le pregunta nada cuando la costura está puesta. */
const MEMORIA_MUDA: AffordanceMemory = {
  belief: () => ({ a: 1, b: 1 }),
  tagsDe: () => [],
  observe: () => undefined,
  seed: () => undefined,
}

/** Dos metas cuyos valores se cruzan de a `paso` por tick. */
function cruce(paso: number, arranque = 0.5): (t: number) => readonly Opportunity[] {
  return (t: number) => {
    const a = arranque - paso * t
    const b = arranque - 0.001 + paso * t
    return [oportunidad(META_A, a), oportunidad(META_B, b)].sort((x, y) =>
      x.valor !== y.valor ? (x.valor > y.valor ? -1 : 1) : x.id < y.id ? -1 : 1,
    )
  }
}

describe('requisito 3 · la histéresis de D2/D3 no oscila', () => {
  it('cruzándose de a 0,001 por tick, la criatura cambia de idea UNA vez en 200 ticks', () => {
    const s = escena({})
    const e = nuevoEstado()
    const ver = cruce(0.001)
    let t = 0
    const o: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      oportunidades: () => ver(t),
    }
    const cambios: number[] = []
    let anterior: string | undefined
    for (t = 0; t < 200; t++) {
      avanzarReloj(e)
      decidir(vistaDe(s), e, o)
      // La meta se lee del ESTADO y no de la decisión: la decisión de un tick de
      // deambular no dice qué se está persiguiendo.
      if (e.metaEnCurso !== anterior) {
        cambios.push(t)
        anterior = e.metaEnCurso
      }
      aterrizar(e, false)
    }
    // Uno es el arranque (de «nada» a A). El otro es el cambio de verdad.
    expect(cambios.length).toBe(2)
    const [arranque, cambio] = cambios
    expect(arranque).toBe(0)
    expect(cambio).toBeDefined()
    if (cambio === undefined) throw new Error('imposible')
    // El margen: en el tick del cambio, B le tiene que sacar 0,15 a A.
    const enEseTick = ver(cambio)
    const a = enEseTick.find((x) => x.meta === META_A)
    const b = enEseTick.find((x) => x.meta === META_B)
    expect(b).toBeDefined()
    expect(a).toBeDefined()
    if (a === undefined || b === undefined) throw new Error('imposible')
    expect(b.valor - a.valor).toBeGreaterThanOrEqual(MARGEN_DE_HISTERESIS)
    console.log(
      `\n  cambió de idea en el tick ${String(cambio)}, con una diferencia de ` +
        `${(b.valor - a.valor).toFixed(3)} (el margen es ${String(MARGEN_DE_HISTERESIS)})`,
    )
  })

  it('sin el margen, la misma escena oscilaría: el cruce ocurre en el tick 1', () => {
    // La carnada del portón. Los dos valores se cruzan casi enseguida, así que
    // una escalera que eligiera «el mejor de hoy» cambiaría de idea en el tick 1
    // y después se quedaría cambiando cada vez que el ruido los diera vuelta.
    const ver = cruce(0.001)
    const primerCruce = (() => {
      for (let t = 0; t < 200; t++) {
        const [mejor] = ver(t)
        if (mejor?.meta === META_B) return t
      }
      return -1
    })()
    expect(primerCruce).toBe(1)
  })

  it('el portón de la permanencia: ni con una diferencia enorme cambia antes de 8 ticks', () => {
    const s = escena({})
    const e = nuevoEstado()
    let t = 0
    const o: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      // A gana el tick 0; desde el tick 1 B le saca UN PUNTO ENTERO.
      oportunidades: () => (t === 0 ? [oportunidad(META_A, 1)] : [oportunidad(META_B, 2), oportunidad(META_A, 1)]),
    }
    const cambios: number[] = []
    let anterior: string | undefined
    for (t = 0; t < 20; t++) {
      avanzarReloj(e)
      decidir(vistaDe(s), e, o)
      if (e.metaEnCurso !== anterior) {
        cambios.push(t)
        anterior = e.metaEnCurso
      }
      aterrizar(e, false)
    }
    expect(cambios).toEqual([0, PERMANENCIA_EN_TICKS])
  })

  it('D2 manda cuando el drive gana, y el plan sale POR D2', () => {
    // Sin oportunidades propias —`MEMORIA_MUDA` no cree nada— el único que
    // propone es el cuidador. Y su meta es plannable en esta escena, así que la
    // decisión sale entera del peldaño: `plan` con `por: 'D2'`.
    const s = elRio()
    const e = nuevoEstado()
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      drive: { meta: COMIDA, peso: 0.9, desdeTick: 0 },
    })
    expect(d.por).toBe('D2')
    expect(d.k).toBe('plan')
    expect(e.metaEnCurso).toBe(COMIDA)
    expect(e.porQuien).toBe('D2')
  })

  it('la orden explícita del cuidador se saltea la permanencia, y sólo ella', () => {
    // Lo que se mira es **quién eligió la meta**, no de qué peldaño salió la
    // decisión: D2 decide QUÉ se persigue, y si eso se convierte hoy en pasos es
    // asunto de D4. Con `META_B` sin nada que frotar a la vista la decisión del
    // tick cae a D5 y la meta igual cambió, que es exactamente lo que este test
    // tiene que separar.
    const s = escena({})
    const e = nuevoEstado()
    const o1: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      oportunidades: () => [oportunidad(META_A, 1)],
    }
    avanzarReloj(e)
    decidir(vistaDe(s), e, o1)
    expect(e.metaEnCurso).toBe(META_A)
    expect(e.porQuien).toBe('D3')
    aterrizar(e, false)

    // Un drive VIEJO (anterior a la meta en curso) tiene que esperar.
    const viejo: Drive = { meta: META_B, peso: 0.9, desdeTick: 0 }
    avanzarReloj(e)
    decidir(vistaDe(s), e, { ...o1, drive: viejo })
    expect(e.metaEnCurso).toBe(META_A)
    aterrizar(e, false)

    // Uno NUEVO manda en el acto: hacer esperar ocho ticks al cuidador que acaba
    // de hablar se lee como sordera, y el corpus ya lo dice («salvo orden
    // explícita»).
    avanzarReloj(e)
    const nuevo: Drive = { meta: META_B, peso: 0.9, desdeTick: e.tick }
    decidir(vistaDe(s), e, { ...o1, drive: nuevo })
    expect(e.metaEnCurso).toBe(META_B)
    expect(e.porQuien).toBe('D2')
  })

  it('un drive con peso 0,5 NO manda: empatado gana la criatura', () => {
    const s = escena({})
    const e = nuevoEstado()
    const o: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      oportunidades: () => [oportunidad(META_A, 1)],
      drive: { meta: META_B, peso: 0.5, desdeTick: 5 },
    }
    avanzarReloj(e)
    decidir(vistaDe(s), e, o)
    expect(e.metaEnCurso).toBe(META_A)
  })
})

// ─── (5) REQUISITO 4 · D4 es anytime de verdad ──────────────────────────────

describe('requisito 4 · la frontera se guarda entre ticks', () => {
  it('un plan que no entra en un tick se termina en varios y da EL MISMO plan', () => {
    // El plan de la pesca cuesta 6 expansiones (medido en `@anima/plan`), así
    // que con presupuesto 1 se corta cinco veces.
    const deUnaVez = plan(
      { id: 'meta', goal: interpretar(COMIDA)!, after: [], porque: 'test' },
      vistaDe(elRio()),
      EXPANSIONES_POR_TICK,
    )
    expect(deUnaVez.k).toBe('plan')
    if (deUnaVez.k !== 'plan') throw new Error('imposible')

    const s = elRio()
    const e = nuevoEstado()
    const o = conCreencias({ presupuesto: 1 })
    const decisiones: Decision[] = []
    for (let t = 0; t < 12; t++) {
      avanzarReloj(e)
      const d = decidir(vistaDe(s), e, o)
      decisiones.push(d)
      if (d.k === 'plan') break
      // No se ejecuta nada: lo que se prueba es la búsqueda, no el mundo. El
      // `aterrizar` cierra el vuelo de fondo que D5 abrió mientras se pensaba.
      aterrizar(e, true)
    }
    const ultima = decisiones[decisiones.length - 1]
    expect(ultima).toBeDefined()
    if (ultima === undefined) throw new Error('imposible')
    expect(ultima.k).toBe('plan')
    expect(pasosDe(ultima)).toEqual(deUnaVez.steps)
    // Y NO salió en el primer tick: si saliera, la frontera no estaría haciendo
    // nada y este test estaría verde por casualidad.
    expect(decisiones.length).toBeGreaterThan(1)
    console.log(
      `\n  con presupuesto 1 la búsqueda tardó ${String(decisiones.length)} ticks, ` +
        `se cortó ${String(e.cortes)} veces, y dio el mismo plan de ${String(deUnaVez.steps.length)} pasos`,
    )
  })

  it('mientras piensa, el cuerpo hace algo: los ticks parciales caen a D5', () => {
    const s = elRio()
    const e = nuevoEstado()
    const o = conCreencias({ presupuesto: 1 })
    avanzarReloj(e)
    const primera = decidir(vistaDe(s), e, o)
    // La búsqueda no terminó, así que el peldaño que decide es el último.
    expect(primera.por).toBe('D5')
    expect(primera.k).toBe('volar')
    // Y la frontera quedó guardada, con la meta a la que pertenece.
    expect(e.frontera).toBeDefined()
    expect(e.metaDeLaFrontera).toBe(COMIDA)
    expect(e.cortes).toBe(1)
  })

  it('la frontera es de UNA meta: cambiar de idea la tira', () => {
    const s = elRio()
    const e = nuevoEstado()
    avanzarReloj(e)
    decidir(vistaDe(s), e, conCreencias({ presupuesto: 1 }))
    expect(e.frontera).toBeDefined()
    // Una orden nueva del cuidador cambia la meta y la búsqueda arranca de cero:
    // una frontera es una búsqueda a medio hacer CONTRA OTRA PREGUNTA, y seguir
    // expandiéndola contra la nueva daría un plan para lo que ya no se quiere.
    aterrizar(e, true)
    avanzarReloj(e)
    const drive: Drive = { meta: META_B, peso: 1, desdeTick: e.tick }
    decidir(vistaDe(s), e, conCreencias({ presupuesto: 1, drive }))
    expect(e.metaEnCurso).toBe(META_B)
    // La frontera de la comida se tiró. La meta nueva puede dejar una propia o
    // ninguna —eso depende de si su búsqueda se corta o muere— y no es lo que
    // este test mira: lo que NO puede quedar es la vieja.
    expect(e.metaDeLaFrontera).not.toBe(COMIDA)
  })
})

// ─── (6) REQUISITO 5 · el `gap` no es un error ──────────────────────────────

describe('requisito 5 · el `gap` se hace y se sigue viviendo', () => {
  it('sin pozo a la vista, la meta de comida da `gap` y la escalera NO se planta', () => {
    // Se le saca el pozo a la escena y se le deja la creencia: la criatura sigue
    // pensando que hay algo carnoso que conseguir y no tiene con qué.
    const s = elRio()
    s.cosas.delete('pozo')
    const e = nuevoEstado()
    const o: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      oportunidades: () => [oportunidad(COMIDA, 1)],
    }
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, o)
    // Sea `plan` con el `nearest` o `volar` de fondo, lo que NO puede es lanzar
    // ni devolver algo vacío. Y la meta sigue puesta: no se olvidó del hambre.
    expect(['plan', 'volar']).toContain(d.k)
    expect(e.metaEnCurso).toBe(COMIDA)
    console.log(`\n  con `+ 'gap' + `: ${d.por} → ${d.k} — ${d.porque}`)
  })

  it('el `nearest` del gap se EJECUTA: lo que la rama muerta dejó listo se hace', () => {
    // El `gap` de esta escena tiene `nearest` con algo adentro; si un día no lo
    // tuviera, el `expect` de abajo lo dice en vez de dejarlo pasar.
    const s = elRio()
    s.cosas.delete('pozo')
    const r = plan(
      { id: 'meta', goal: interpretar(COMIDA)!, after: [], porque: 'test' },
      vistaDe(s),
      EXPANSIONES_POR_TICK,
    )
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') throw new Error('imposible')
    console.log(
      `\n  el gap dice: falta «${r.missing}» (${r.why}), y deja listo: ` +
        `${r.nearest.map(resumir).join(' · ') || '(nada)'}`,
    )
    const e = nuevoEstado()
    const o: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      oportunidades: () => [oportunidad(COMIDA, 1)],
    }
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, o)
    if (r.nearest.length > 0) {
      expect(d.k).toBe('plan')
      expect(d.k === 'plan' && d.pasos).toEqual(r.nearest)
    } else {
      expect(d.por).toBe('D5')
    }
  })

  it('y una meta que el intérprete no lee se tira con motivo, no se arrastra', () => {
    const s = escena({})
    const e = nuevoEstado()
    const o: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      oportunidades: () => [oportunidad('esto no es un predicado', 1)],
    }
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, o)
    expect(d.por).toBe('D5')
    expect(e.metaEnCurso).toBeUndefined()
  })
})

// ─── (6 bis) NO SE QUIERE LO QUE NINGÚN ESQUEMA SABE ESTABLECER ─────────────
//
// La decisión 7 de `escalera.ts`, y el porqué está allá: un `gap` de PAISAJE lo
// puede arreglar caminar, y un `gap` de VOCABULARIO no lo arregla nada. La
// diferencia se lee de la TABLA de esquemas y no del `why` en prosa que trae el
// `PlanResult`, porque ese texto lo arma otro paquete para otra cosa.

describe('el vocabulario del catálogo, y qué se puede querer', () => {
  it('lo que ningún esquema establece se reconoce SIN correr una búsqueda', () => {
    // Las tres metas que el instinto puede querer, contra la tabla.
    expect(sinVocabulario(metaDe('carnoso'))).toBe(false)
    expect(sinVocabulario(metaDe('vegetal'))).toBe(true)
    expect(sinVocabulario(metaDe('fibroso'))).toBe(true)
    // Y las que no son `holding`: `temperature>=400` la establece `friccion`;
    // ninguna fila del índice establece masa (medido en `ataque-al-reves`).
    expect(sinVocabulario('temperature>=400')).toBe(false)
    expect(sinVocabulario('mass>=1')).toBe(true)
    // Una firma que el intérprete no lee tampoco se puede establecer.
    expect(sinVocabulario('esto no es un predicado')).toBe(true)

    // LA COMPARACIÓN ES POR IMPLICACIÓN Y NO POR TEXTO, y esto es lo que lo
    // separa de un `SCHEMA_INDEX.get()`: el catálogo promete `temperature>=400` y
    // eso CUBRE un pedido de 300, que como texto no está en ninguna llave.
    expect(SCHEMA_INDEX.has('temperature>=300')).toBe(false)
    expect(sinVocabulario('temperature>=300')).toBe(false)
    // Y al revés: pedir más de lo que el catálogo promete sí queda afuera.
    expect(sinVocabulario('temperature>=500')).toBe(true)

    // El supuesto sobre el que descansa la rama conservadora de `sinVocabulario`,
    // afirmado y no supuesto: HOY las ocho firmas del índice son de una sola
    // cláusula y las ocho interpretan. El día que alguna sea conjuntiva, la
    // función se apaga entera y contesta que todo se puede querer.
    const ilegibles = [...SCHEMA_INDEX.keys()].filter((f) => interpretar(firmaDe(f)) === undefined)
    console.log(
      `\n  firmas indexadas: ${String(SCHEMA_INDEX.size)} · conjuntivas (que apagarían el portón): ${String(ilegibles.length)}`,
    )
    expect(ilegibles).toEqual([])
  })

  it('D3 saltea la oportunidad imposible y toma la SEGUNDA, en el mismo tick', () => {
    // La lista llega ordenada por valor y la que gana es la que no se puede hacer.
    // Antes esto se tomaba igual, `plan()` contestaba `gap` con `nearest` vacío,
    // `planificar` devolvía `undefined` SIN tirar la meta, y la criatura se
    // quedaba pegada a ella —12.000 de 20.000 ticks, medido contra `stepWorld`—
    // porque `puedeCambiar` le exigía al retador `MARGEN_DE_HISTERESIS` sobre un
    // valor que la escalera nunca supo ejecutar.
    const s = elRio()
    const e = nuevoEstado()
    const o: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      oportunidades: () => [oportunidad(metaDe('vegetal'), 9), oportunidad(COMIDA, 1)],
    }
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, o)
    expect(e.metaEnCurso).toBe(COMIDA)
    expect(e.porQuien).toBe('D3')
    expect(d.por).toBe('D3')
    expect(d.k).toBe('plan')
    // Y el valor que queda en curso es el de la que SÍ se tomó, no el de la que se
    // salteó: si se guardara el 9, ningún retador honesto podría desplazarla nunca.
    expect(e.valorEnCurso).toBe(1)
  })

  it('si NINGUNA de la lista se puede querer, no se toma ninguna y se cae a D5', () => {
    const s = elRio()
    const e = nuevoEstado()
    const o: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      oportunidades: () => [oportunidad(metaDe('vegetal'), 9), oportunidad(metaDe('fibroso'), 8)],
    }
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, o)
    expect(e.metaEnCurso).toBeUndefined()
    expect(d.por).toBe('D5')
    expect(d.k).toBe('volar')
  })

  it('y el portón vale también para el cuidador: una orden imposible no queda en curso', () => {
    // D2 no se hace el sordo —D3 sigue corriendo abajo y toma lo que puede— pero
    // tampoco se queda parado esperando un esquema que nadie va a escribir en esta
    // partida. Sin esto, un `drive` imposible tapaba todo lo demás para siempre.
    const s = elRio()
    const e = nuevoEstado()
    const o: MenteOptions = {
      actor: 'yo',
      memoria: MEMORIA_MUDA,
      oportunidades: () => [oportunidad(COMIDA, 1)],
      drive: { meta: metaDe('vegetal'), peso: 1, desdeTick: 0 },
    }
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, o)
    expect(e.metaEnCurso).toBe(COMIDA)
    expect(e.porQuien).toBe('D3')
    expect(d.por).toBe('D3')
  })
})

// ─── (7) REQUISITO 1 · nunca devuelve nada vacío ────────────────────────────

describe('requisito 1 · D5 siempre tiene algo', () => {
  it('mil vistas degeneradas, y en las mil sale una `Decision`', () => {
    // El barrido es determinista y exhaustivo sobre seis ejes binarios más el
    // tick: sin `Math.random`, porque un test que no se puede repetir no sirve
    // para encontrar la vista que rompió.
    const clases = new Map<string, number>()
    let n = 0
    for (let k = 0; k < 1000; k++) {
      const bit = (i: number): boolean => ((k >> i) & 1) === 1
      const s = escena({
        // sin ver nada / con el río entero
        cosas: bit(0) ? [] : [...elRio().cosas.values()],
        // sin stamina / con el tanque lleno
        stamina: bit(1) ? 0 : 1000,
        // de noche / de día
        reloj: bit(2)
          ? { phase: 'noche', secondsToNightfall: 0, dayLength: 200 }
          : { phase: 'dia', secondsToNightfall: 100, dayLength: 200 },
        temperaturaDelSuelo: bit(3) ? 900 : T_DEL_CUERPO,
        cobijo: bit(4) ? 1 : 0,
        mojadas: bit(5) ? [{ x: 8, y: 0 }] : [],
      })
      // con las manos llenas
      if (bit(6)) for (const c of s.cosas.values()) c.enMano = true
      const e = nuevoEstado()
      e.tick = k
      e.desdeTick = k % 13
      // y a veces con algo a medio hacer encima
      if (bit(7)) e.pasosPendientes = [{ k: 'sostener', que: { k: 'id', id: 'fantasma' }, porQue: COMIDA }]
      const o = bit(8)
        ? conCreencias({ drive: { meta: COMIDA, peso: k / 1000, desdeTick: k } })
        : conCreencias()
      const d = decidir(vistaDe(s), e, o)
      expect(d).toBeDefined()
      expect(['D0', 'D1', 'D2', 'D3', 'D4', 'D5']).toContain(d.por)
      expect(d.porque.length).toBeGreaterThan(0)
      if (d.k === 'plan') expect(d.pasos.length).toBeGreaterThan(0)
      clases.set(`${d.por}/${d.k}`, (clases.get(`${d.por}/${d.k}`) ?? 0) + 1)
      n++
    }
    expect(n).toBe(1000)
    console.log(
      `\n  ── las mil vistas degeneradas ──\n` +
        [...clases.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, c]) => `  ${k}: ${String(c)}`).join('\n'),
    )
  })

  it('la rueda de D5 da la vuelta ENTERA: con las tres fallando, salen las tres', () => {
    // Una criatura de noche, sin nada a la vista y sin reparo alrededor:
    // `guarecerse` es la que la necesidad elige y es la que va a fallar. Sin la
    // rueda, la escalera la elegiría otra vez, y otra, sin gastar aliento ni
    // avanzar — que es la peor clase de bucle.
    //
    // Y con la rueda de UN ÍNDICE tampoco alcanzaba, que es lo que el adversario
    // midió: se salteaba «la última que falló», así que con `refugio` siempre
    // arriba el puntero rebotaba 0 → 1 → 0 → 1 y `explorar` —la única que camina y
    // la única que dura más de un tick— no salía nunca. Lo que se recuerda es
    // ahora «cuáles fallaron desde el último éxito», y por eso esto mira las TRES.
    const s = escena({ cosas: [], reloj: { phase: 'noche', secondsToNightfall: 0, dayLength: 200 } })
    const n: NeedVector = necesidades(vistaDe(s))
    expect(n.refugio).toBeGreaterThan(0)
    const e = nuevoEstado()
    const o = conCreencias()
    const salieron: string[] = []
    for (let k = 0; k < 6; k++) {
      avanzarReloj(e)
      const d = decidir(vistaDe(s), e, o)
      salieron.push(d.k === 'volar' ? d.paso.k : d.k)
      aterrizar(e, false)
    }
    console.log(`\n  la rueda, con las tres fallando: ${salieron.join(' → ')}`)
    // La vuelta entera, y después vuelve a empezar por la que la necesidad pide.
    expect(salieron).toEqual([
      'guarecerse',
      'juntar',
      'explorar',
      'guarecerse',
      'juntar',
      'explorar',
    ])
  })

  it('y un éxito limpia la cuenta: la que salió bien vuelve a ser la primera', () => {
    // La otra mitad de la máscara, que es lo que la hace una rueda y no una lista
    // de descarte: cuando algo sale bien, las tres vuelven a estar disponibles.
    const s = escena({ cosas: [], reloj: { phase: 'noche', secondsToNightfall: 0, dayLength: 200 } })
    const e = nuevoEstado()
    const o = conCreencias()
    avanzarReloj(e)
    expect(decidir(vistaDe(s), e, o).k).toBe('volar')
    aterrizar(e, false) // guarecerse falló
    avanzarReloj(e)
    const segunda = decidir(vistaDe(s), e, o)
    expect(segunda.k === 'volar' && segunda.paso.k).toBe('juntar')
    aterrizar(e, true) // ésta salió bien
    avanzarReloj(e)
    const tercera = decidir(vistaDe(s), e, o)
    expect(tercera.k === 'volar' && tercera.paso.k).toBe('guarecerse')
  })

  it('con el tanque lleno, sin nada a la vista y a mediodía, deambula', () => {
    const s = escena({ cosas: [], stamina: 1000 })
    const e = nuevoEstado()
    avanzarReloj(e)
    const d = decidir(vistaDe(s), e, conCreencias())
    expect(d.por).toBe('D5')
    expect(d.k === 'volar' && d.paso.k).toBe('explorar')
  })
})

// ─── (8) REQUISITO 7 · determinismo ─────────────────────────────────────────

describe('requisito 7 · la misma vista y el mismo estado dan la misma decisión', () => {
  it('doscientas veces sobre la escena canónica, con el estado clonado', () => {
    const s = elRio()
    const base = nuevoEstado()
    avanzarReloj(base)
    // Se lo lleva a un estado con historia: una escalera recién nacida es el
    // caso fácil.
    decidir(vistaDe(s), base, conCreencias())
    for (let k = 0; k < 5; k++) {
      avanzarReloj(base)
      decidir(vistaDe(s), base, conCreencias())
    }

    const primera = decidir(vistaDe(s), clonarEstado(base), conCreencias())
    for (let k = 0; k < 200; k++) {
      const otra = decidir(vistaDe(s), clonarEstado(base), conCreencias())
      expect(otra).toEqual(primera)
    }
  })

  it('y dos corridas enteras dan la misma historia, peldaño por peldaño', () => {
    const a = correr(elRio(), conCreencias(), 200)
    const b = correr(elRio(), conCreencias(), 200)
    expect(a.hechas).toEqual(b.hechas)
    expect(a.peldanos).toEqual(b.peldanos)
    expect(a.clases).toEqual(b.clases)
  })

  it('el orden en que la vista devuelve los cuerpos no cambia la decisión', () => {
    // `see()` no promete orden —lo dice `skills/src/innatas/comun.ts:28`— así que
    // una escalera que dependiera de él cambiaría sola entre dos réplicas del
    // mismo mundo.
    const derecho = elRio()
    const alReves = elRio()
    const cosas = [...alReves.cosas.values()].reverse()
    alReves.cosas = new Map(cosas.map((c) => [c.id, c]))

    const ea = nuevoEstado()
    const eb = nuevoEstado()
    avanzarReloj(ea)
    avanzarReloj(eb)
    expect(decidir(vistaDe(alReves), eb, conCreencias())).toEqual(
      decidir(vistaDe(derecho), ea, conCreencias()),
    )
  })
})

// ─── (9) REQUISITO 6 · presupuestos estructurales, y la regla 2 ─────────────
//
// EL GUARDIÁN DEL PAQUETE, que `@anima/mind` no tenía. Está copiado de
// `plan/tests/ataque-determinismo.test.ts`, que lo copió de `perceive/`, que lo
// copió de `world/`: la copia es deliberada y su porqué está escrito allá — una
// lista compartida entre paquetes sería un test que importa del archivo de test
// de otro paquete, y eso es peor que cuatro copias que se leen solas.
//
// Lee `readdirSync(src/)`, así que **un archivo nuevo entra solo**.

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const FUENTES = readdirSync(SRC).filter((f) => f.endsWith('.ts'))

const PROHIBIDOS: readonly (readonly [RegExp, string])[] = [
  [/\bMath\.random\b/, 'el azar del sistema no se puede reproducir'],
  [/\bnew Date\b|\bDate\.now\b/, 'el reloj del mundo es el contador de ticks'],
  [/\bperformance\./, 'el presupuesto es estructural, no microsegundos (decisión 1 de `tipos.ts`)'],
  [/\bIntl\b|\blocaleCompare\b|\btoLocaleString\b/, 'el orden dependería del idioma del sistema'],
  [
    /\bMath\.(exp|pow|log|log2|log10|sqrt|cbrt|sin|cos|tan|asin|acos|atan|atan2|hypot|expm1|log1p|fround)\b/,
    'ECMAScript no especifica su precisión: dos motores devuelven el último bit distinto',
  ],
  [/\*\*/, 'la potencia es `Math.pow` con otra cara'],
  [/from '@anima\/(sim-core|agent-core|skill-runtime|web|api)'/, 'regla 1: nada de Ánima I'],
  [/from '(\.\.\/)+packages\//, 'regla 1: nada de Ánima I'],
  [/\bawait\b|\basync\b/, 'principio 1: el tick no tiene un solo `await`'],
]

function codigoDe(archivo: string): string {
  return readFileSync(SRC + archivo, 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

describe('requisito 6 · la regla 2 sobre todo `src/`, y ningún reloj de pared', () => {
  it(`los ${String(FUENTES.length)} fuentes del paquete, leídos del directorio`, () => {
    // Seis: `necesidades`, `creencias`, `oportunidades`, `escalera`, `mente`,
    // `tipos` e `index`. La cota es `>=` para que un módulo nuevo entre sin
    // tocar el guardián; lo que ataja es el BORRADO — un guardián que lee un
    // directorio vacío está en verde y no cuida nada.
    expect(FUENTES.length).toBeGreaterThanOrEqual(7)
    const infracciones: string[] = []
    for (const archivo of FUENTES) {
      const codigo = codigoDe(archivo)
      for (const [patron, porque] of PROHIBIDOS) {
        const m = codigo.match(patron)
        if (m !== null) infracciones.push(`${archivo}: «${m[0]}» — ${porque}`)
      }
    }
    expect(infracciones).toEqual([])
  })

  it('y el detector detecta: carnada para cada patrón', () => {
    const carnada: readonly string[] = [
      'const x = Math.random()',
      'const t = Date.now()',
      'const t = new Date()',
      'performance.now()',
      'a.localeCompare(b)',
      'const s = n.toLocaleString()',
      'Math.pow(2, 3)',
      'Math.sqrt(dx * dx + dy * dy)',
      'const y = 2 ** 3',
      "import x from '@anima/sim-core'",
      "import y from '../../packages/sim-core/src/index.js'",
      'await algo()',
      'async function f() {}',
    ]
    for (const linea of carnada) {
      expect(PROHIBIDOS.some(([p]) => p.test(linea))).toBe(true)
    }
    expect(carnada.length).toBeGreaterThanOrEqual(PROHIBIDOS.length)
  })

  it('lo que la escalera EMITE no cabe en un `Step`, y esa es la razón de `Intencion`', () => {
    // La decisión 2 del encabezado de `escalera.ts`, hecha test. Las diez `k` de
    // `Step` están escritas en `@anima/plan` y `guarecerse`/`huir` no están entre
    // ellas: con `Decision.volar.paso: Step`, D0 no podía huir y D5 no podía
    // guarecerse. Se verifica que la escalera EMITE las dos de verdad, no que el
    // tipo las admita — un tipo más ancho que nadie usa no arregla nada.
    const DE_PLAN: readonly string[] = [
      'ir', 'juntar', 'deshilachar', 'unir', 'aplicar', 'comer', 'frotar', 'poner', 'sostener', 'explorar',
    ]
    const quemando = escena({ cosas: [], temperaturaDelSuelo: 900 })
    const eA = nuevoEstado()
    avanzarReloj(eA)
    const dA = decidir(vistaDe(quemando), eA, conCreencias())
    expect(dA.k === 'volar' && dA.paso.k).toBe('huir')
    expect(DE_PLAN).not.toContain('huir')

    const anochece = escena({ cosas: [], reloj: { phase: 'noche', secondsToNightfall: 0, dayLength: 200 } })
    const eB = nuevoEstado()
    avanzarReloj(eB)
    const dB = decidir(vistaDe(anochece), eB, conCreencias())
    expect(dB.k === 'volar' && dB.paso.k).toBe('guarecerse')
    expect(DE_PLAN).not.toContain('guarecerse')
  })

  // ─── LO QUE UN TICK DE ESCALERA LE PIDE A LA VISTA, contado ──────────────
  //
  // El presupuesto estructural no es una promesa: es un número. Se cuenta con
  // una vista espía —los mismos datos, con dos contadores— y se compara la misma
  // escena con 3 cuerpos y con 203, donde los 200 de más son PIEDRAS: caen todas
  // en la misma clave de contexto, o sea que agregan cuerpos sin agregar ni un
  // contexto. Es el caso que separa las dos cotas posibles.

  function espiarUnTick(cuantasPiedras: number): { qAt: number; see: number } {
    let qAt = 0
    let see = 0
    const s = escena({
      cosas: [
        ...[...elRio().cosas.values()],
        ...Array.from({ length: cuantasPiedras }, (_, i) =>
          cosa(`piedra-${String(i)}`, 1 + (i % 5), 1, { mass: 1, rigidity: 0.95 }),
        ),
      ],
      mojadas: [{ x: 8, y: 0 }],
    })
    const base = vistaDe(s)
    const espia: VistaDeLaMente = {
      ...base,
      see: (w: Where) => {
        see++
        return base.see(w)
      },
      qAt: (at: Cell, q: CellQuality) => {
        qAt++
        return base.qAt(at, q)
      },
    }
    const e = nuevoEstado()
    avanzarReloj(e)
    decidir(espia, e, conCreencias())
    return { qAt, see }
  }

  it('el barrido de celdas NO crece con los cuerpos: es un disco de radio fijo', () => {
    const pocos = espiarUnTick(0)
    const muchos = espiarUnTick(200)
    console.log(
      `
  ── el trabajo de UN tick de escalera ──
` +
        `  con 3 cuerpos:   see×${String(pocos.see)}  qAt×${String(pocos.qAt)}
` +
        `  con 203 cuerpos: see×${String(muchos.see)}  qAt×${String(muchos.qAt)}
` +
        `  o sea: +${String(muchos.see - pocos.see)} see y +${String(muchos.qAt - pocos.qAt)} qAt por 200 cuerpos ` +
        `que no agregan NI UN contexto`,
    )
    // El disco de `RADIO_DE_AGUA` son 169 celdas y son las mismas 169 haya lo que
    // haya en ellas. Lo que crece es de a UNA por cuerpo (`lugarDe` le pregunta a
    // la celda de cada candidato qué tan mojada está), no de a 169.
    expect(muchos.qAt - pocos.qAt).toBeLessThan(4 * 200)
    expect(pocos.qAt).toBeGreaterThan(100)
  })

  it.fails('LO QUE SE QUERRÍA Y NO ES: que el trabajo de D3 lo acote `OPORTUNIDADES_QUE_MIRA`', () => {
    // ─── EL HUECO, MEDIDO ────────────────────────────────────────────────────
    //
    // `OPORTUNIDADES_QUE_MIRA` vale 12 y `opportunities()` corta cuando junta 12
    // CONTEXTOS distintos. Eso hace creer que el peldaño mira doce cosas. No es
    // así: para saber en qué contexto cae un cuerpo hay que llamar a
    // `contextoDe`, y `contextoDe` resuelve un id **recorriendo `see([])`** —lo
    // dice su propio comentario, que además señala este peldaño: «si D3 se pone
    // caro, esto es lo primero que hay que mirar»—.
    //
    // O sea que con 200 piedras que comparten contexto, el bucle recorre las 200
    // sin llenar nunca la cuota de 12, y cada vuelta cuesta un `see` que a su vez
    // recorre los 203 cuerpos.
    //
    // MEDIDO ACÁ, con la vista espía de arriba:
    //
    //     3 cuerpos   →  see×12    qAt×179
    //   203 cuerpos   →  see×212   qAt×779
    //
    // `see` crece 1:1 con los cuerpos a la vista, y cada `see` es lineal en los
    // cuerpos: **el tick de D3 es cuadrático en lo que se ve**. Con el radio de
    // percepción en 12 el techo son 625 celdas, así que el peor caso está acotado
    // pero es grande, y no es el 12 que la constante sugiere.
    //
    // La reparación no es de este archivo ni de este tramo: es que `contextoDe`
    // tome un `BodyView` en vez de un id —quien llama YA tiene la lista— o que
    // `opportunities()` corte también por lugares mirados. Las dos son de
    // `@anima/mind/creencias.ts` y `oportunidades.ts`, y las dos cambian firmas
    // que otros tests pinan. Queda escrito, medido, y en rojo.
    const pocos = espiarUnTick(0)
    const muchos = espiarUnTick(200)
    expect(muchos.see).toBeLessThanOrEqual(pocos.see * 2)
  })

  it('el presupuesto de D4 es un entero de expansiones y se puede bajar sin tocar el módulo', () => {
    // Es la decisión 1 de `tipos.ts` hecha test: con presupuesto 1 la escalera
    // hace MENOS trabajo por tick, y eso se puede observar desde afuera. Con un
    // presupuesto en milisegundos, esta misma corrida daría distinto en una
    // máquina cargada.
    const conMucho = correr(elRio(), conCreencias({ presupuesto: EXPANSIONES_POR_TICK }), 40)
    const conPoco = correr(elRio(), conCreencias({ presupuesto: 1 }), 40)
    expect(conPoco.estado.cortes + conPoco.peldanos.D5).toBeGreaterThan(
      conMucho.estado.cortes + conMucho.peldanos.D5,
    )
  })
})
