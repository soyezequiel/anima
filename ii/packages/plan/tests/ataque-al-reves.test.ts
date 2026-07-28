// ─── EL ATAQUE AL REVÉS — lo que una criatura razonable querría pedir ────────
//
//   pnpm --filter @anima/plan test
//
// Los otros ocho archivos de `tests/` preguntan «¿lo que el planificador hace,
// lo hace bien?». Éste pregunta la otra: **¿qué cosas honestas rebota?** Es el
// lente que en este proyecto encontró el hallazgo más caro de todos —que `comer`
// no se podía escribir, o sea que la criatura pescaba y no comía—, y la primera
// sección de acá es ese mismo hallazgo un piso más arriba: el paso `comer` ahora
// EXISTE en `Step` y sigue sin haber ningún camino que lo emita.
//
// ─── LA REGLA DEL ARCHIVO ───────────────────────────────────────────────────
//
// Un hueco se MIDE, no se opina. Cada test de acá escribe el objetivo que una
// criatura querría perseguir, llama a `plan()` de verdad, y clava la salida REAL
// —no la deseable—. Los que además dicen qué debería salir van con `it.fails` y
// el porqué al lado. Ningún test de este archivo toca `src/`: son todos
// observaciones desde afuera, con la vista de mentira que ya usa
// `la-regresion.test.ts`.
//
// ─── LOS OCHO PEDIDOS, Y LO QUE MIDIÓ CADA UNO ──────────────────────────────
//
//   1 «quiero comer»       el paso existe y es INALCANZABLE. Y con el pescado en
//                          la mano, el plan vuelve a pescar — ADENTRO DEL PESCADO.
//   2 «quiero calentarme»  `Predicado` no tiene SUJETO: una brasa ajena a nueve
//                          celdas da el objetivo por cumplido y el plan sale vacío.
//   3 «quiero el pescado cocido»  `binds` sale de `goalGraph` y `plan()` no lo lee:
//                          el resultado es idéntico byte a byte con y sin ligadura.
//   4 «quiero fuego»       gap con `nearest` vacío. La distancia hasta el plan es
//                          UNA FILA, y la fila se puede derivar del catálogo.
//   5 «quiero la vara de vuelta»  el `Yield` de desarme existe en la física y
//                          ningún proceso semilla lo declara. `union` es de ida sola.
//   6 «quiero llegar al río»  no hay predicado de CELDA, y `qAt`, `recall` y
//                          `clock` de la vista se llaman CERO veces.
//   7 «quiero dos hebras»  pedir dos es LITERALMENTE pedir una: la firma colapsa.
//   8 «quiero guarecerme antes de la noche»  `GoalNode` no tiene `temporal`, que
//                          el documento de arquitectura sí le pone (línea 799).
//
// Y una novena que salió sola mientras se medían las otras: la META no puede ser
// una conjunción. `catch>0 ∧ reach>=2` —la conjunción sobre la que está construido
// el paquete entero— se puede pedir como rol y NO como objetivo.

import { describe, expect, it } from 'vitest'

import { SEED_PROCESSES, evalQuality, specOf } from '@anima/physics'
import type { QualityExpr, QualityId, Yield } from '@anima/physics'
import type {
  BodyId,
  BodyView,
  Cell,
  CellQuality,
  Clock,
  JointView,
  PlaceMemory,
  SelfView,
  Where,
  WhereCell,
} from '@anima/skills'

import { ESQUEMAS } from '../src/esquemas.js'
import { goalGraph } from '../src/objetivos.js'
import { firmaDe, interpretar } from '../src/predicado.js'
import { plan } from '../src/regresion.js'
import type {
  ConstructionSchema,
  GoalNode,
  PlanResult,
  Predicado,
  Ref,
  Step,
  VistaDelPlan,
} from '../src/tipos.js'

// ─── El mundito de mentira, con un espía adentro ────────────────────────────
//
// Es el mismo objeto literal de `la-regresion.test.ts` —`VistaDelPlan` es un
// subconjunto ESTRUCTURAL de `Ctx`, así que treinta líneas alcanzan— más un
// contador opcional sobre los tres miembros que la sección 6 viene a medir:
// `qAt`, `recall` y `clock`. `clock` es una PROPIEDAD y no un método, así que se
// espía con un getter; no es un truco, es la única forma de contar lecturas de
// algo que la interfaz declara como campo.

type Cualidades = Partial<Record<QualityId, number>>

interface Espia {
  qAt: number
  recall: number
  clock: number
}

function cuerpo(id: string, x: number, y: number, joints: readonly JointView[] = []): BodyView {
  return { id, at: { x, y }, name: id, madeByMe: false, joints }
}

function criatura(o?: { holding?: readonly BodyView[]; stamina?: number }): SelfView {
  return {
    id: 'yo',
    at: { x: 0, y: 0 },
    name: 'criatura',
    madeByMe: false,
    joints: [],
    holding: o?.holding ?? [],
    capacity: 3,
    stamina: o?.stamina ?? 1000,
    // `irreversible` y no `reversible`: comer ES irreversible (la primitiva `eat`
    // destruye el bocado), así que una criatura en cuarentena no podría comer ni
    // aunque el paso existiera. Se le da el permiso máximo para que lo que este
    // archivo mida sea el planificador y no la cuarentena.
    permits: 'irreversible',
  }
}

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

/**
 * `portable` la contesta EL MOTOR: la regresión se la pide a todo rol de un
 * proceso `held` —`take` rebota con `no-portable`— y escribir el tope de 8 kg acá
 * sería su segunda copia.
 */
function portableDe(mass: number): number {
  const d = specOf('portable').derived
  if (d === undefined) throw new Error('`portable` dejó de ser derivada: el arnés se quedó viejo')
  const noHace = (): never => {
    throw new RangeError('`portable` sólo depende de `own(mass)`')
  }
  return evalQuality(d, { own: (q) => (q === 'mass' ? mass : 0), geom: noHace, sumParts: noHace, maxParts: noHace, substance: noHace })
}

function vista(m: {
  self?: SelfView
  cuerpos?: readonly BodyView[]
  qs?: ReadonlyMap<BodyId, Cualidades>
  espia?: Espia
  /** Las celdas de agua franca: el `source` de `extraccion` pide `wet >= 0.9`. */
  mojadas?: readonly Cell[]
}): VistaDelPlan {
  const self = m.self ?? criatura()
  const cuerpos = m.cuerpos ?? []
  const espia = m.espia
  const mojadas = m.mojadas ?? []
  const qde = (b: BodyView, q: QualityId): number => {
    if (b.id === self.id && q === 'stamina') return self.stamina
    const puesta = m.qs?.get(b.id)?.[q]
    if (puesta !== undefined) return puesta
    return q === 'portable' ? portableDe(qde(b, 'mass')) : 0
  }
  const v = {
    see(w: Where): readonly BodyView[] {
      const out: BodyView[] = []
      for (const b of cuerpos) {
        let ok = true
        for (const t of w) {
          const val = qde(b, t.q)
          const pasa =
            t.op === '>=' ? val >= t.v : t.op === '<=' ? val <= t.v : t.op === '>' ? val > t.v : val < t.v
          if (!pasa) ok = false
        }
        if (ok) out.push(b)
      }
      return out
    },
    recall: (_w: WhereCell): readonly PlaceMemory[] => {
      if (espia !== undefined) espia.recall++
      return []
    },
    q: qde,
    qAt: (at: Cell, q: CellQuality): number => {
      if (espia !== undefined) espia.qAt++
      return q === 'wet' && mojadas.some((c) => c.x === at.x && c.y === at.y) ? 1 : 0
    },
    self,
  }
  Object.defineProperty(v, 'clock', {
    get: () => {
      if (espia !== undefined) espia.clock++
      return RELOJ
    },
    enumerable: true,
  })
  return v as VistaDelPlan
}

function meta(goal: Predicado): GoalNode {
  return { id: 'g0', goal, after: [], porque: 'el ataque al revés' }
}

/** Un presupuesto que no corta: acá no se mide el corte, se mide qué se puede pedir. */
const SIN_CORTE = 500

function pasosDe(r: PlanResult): readonly Step[] {
  if (r.k !== 'plan') throw new Error(`se esperaba un plan y salió ${r.k}`)
  return r.steps
}

/** Los pasos que un resultado trae, sea plan o `nearest` de un gap. */
function pasosDeCualquiera(r: PlanResult): readonly Step[] {
  return r.k === 'plan' ? r.steps : r.k === 'gap' ? r.nearest : []
}

function refCorto(r: Ref | undefined): string {
  if (r === undefined) return '-'
  return r.k === 'id' ? r.id : r.k === 'rinde' ? 'lo-que-hice' : r.k
}

function resumir(pasos: readonly Step[]): readonly string[] {
  return pasos.map((s) => {
    switch (s.k) {
      case 'ir':
        return `ir(${refCorto(s.a)})`
      case 'sostener':
        return `sostener(${refCorto(s.que)})`
      case 'unir':
        return `unir(binder=${refCorto(s.binder)}, a=${refCorto(s.a)}${s.b === undefined ? '' : `, b=${refCorto(s.b)}`})`
      case 'deshilachar':
        return `deshilachar(${refCorto(s.fuente)}, ${String(s.cuantas)})`
      case 'frotar':
        return `frotar(a=${refCorto(s.a)}, b=${refCorto(s.b)}, hasta=${String(s.hasta ?? 0)})`
      case 'aplicar':
        return `aplicar(${s.proceso}, source=${refCorto(s.roles['source'])})`
      case 'comer':
        return `comer(${refCorto(s.bocado)})`
      default:
        return s.k
    }
  })
}

// ─── Los escenarios ─────────────────────────────────────────────────────────

/** El río del documento: matorral de liana a 2, vara a 5, pozo a 8. */
function elRio(): VistaDelPlan {
  return vista({
    self: criatura(),
    cuerpos: [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0)],
    qs: new Map<BodyId, Cualidades>([
      ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
      ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
      ['pozo', { mass: 50 }],
    ]),
    // El pozo está en el agua: el esquema de `extraccion` le pide a la celda del
    // `source` `wet >= 0.9`, porque `mass > 0` no distingue un banco de un canto
    // rodado y el planificador se quedaba con lo más cercano.
    mojadas: [{ x: 8, y: 0 }],
  })
}

/**
 * El leño solo. Lleva `ignitionPoint`, `fuelEnergy` y `moisture` además de lo que
 * usa `la-regresion.test.ts`, porque la sección 4 le pregunta al mundo si arde y
 * las tres cualidades que gobiernan la ignición son ésas (ADR II-0001).
 */
function elLeno(): VistaDelPlan {
  return vista({
    self: criatura(),
    cuerpos: [cuerpo('leno', 3, 0)],
    qs: new Map<BodyId, Cualidades>([
      [
        'leno',
        {
          rigidity: 0.7,
          heatCapacity: 1.7,
          tensile: 0.55,
          flexibility: 0.2,
          mass: 1,
          temperature: 15,
          ignitionPoint: 300,
          fuelEnergy: 12,
          moisture: 0.1,
        },
      ],
    ]),
  })
}

/**
 * Los ocho objetivos que el paquete SÍ sabe perseguir: las ocho firmas de
 * `ESQUEMAS`, que son por definición todo lo que la tabla promete establecer.
 * Se usan de corpus en los barridos — si el planificador no emite un paso ni
 * siquiera acá, no lo emite en ninguna parte.
 */
const LO_QUE_SE_PUEDE_PEDIR: readonly Predicado[] = [
  { k: 'sostiene', tag: 'carnoso' },
  { k: 'cualidad', test: { q: 'temperature', op: '>=', v: 400 } },
  { k: 'cualidad', test: { q: 'catch', op: '>', v: 0 } },
  { k: 'cualidad', test: { q: 'reach', op: '>=', v: 2 } },
  { k: 'cualidad', test: { q: 'flexibility', op: '>=', v: 0.8 } },
  { k: 'cualidad', test: { q: 'tensile', op: '>=', v: 0.3 } },
  { k: 'cualidad', test: { q: 'heatCapacity', op: '<=', v: 0.9 } },
  { k: 'geometria', f: 'freeStrandEnds', op: '>=', v: 1 },
]

// ════════════════════════════════════════════════════════════════════════════
// 1 · «QUIERO COMER»
// ════════════════════════════════════════════════════════════════════════════

describe('1 · «quiero comer»: el paso existe y ningún camino lo emite', () => {
  /**
   * `Step` declara diez variantes. Este barrido corre `plan()` sobre los ocho
   * objetivos que la tabla sabe perseguir, en tres mundos distintos, y junta los
   * `k` que salieron. Son SEIS.
   *
   * Las cuatro que faltan no son un accidente del corpus: `emitirMarco` y
   * `pasoDelProceso` son los dos únicos lugares de `src/` que construyen pasos, y
   * entre los dos hay exactamente seis literales `k:`. Las otras cuatro —`comer`,
   * `juntar`, `poner`, `explorar`— son tipo sin productor.
   */
  it('de los diez `Step` del tipo, el planificador puede emitir SEIS', () => {
    const emitidos = new Set<Step['k']>()
    for (const v of [elRio(), elLeno()]) {
      for (const m of LO_QUE_SE_PUEDE_PEDIR) {
        for (const s of pasosDeCualquiera(plan(meta(m), v, SIN_CORTE))) emitidos.add(s.k)
      }
    }
    expect([...emitidos].sort()).toEqual(['aplicar', 'deshilachar', 'frotar', 'ir', 'sostener', 'unir'])
    // Y las cuatro que no salieron, nombradas de a una para que el diff diga cuál
    // se arregló el día que alguna aparezca.
    expect(emitidos.has('comer')).toBe(false)
    expect(emitidos.has('juntar')).toBe(false)
    expect(emitidos.has('poner')).toBe(false)
    expect(emitidos.has('explorar')).toBe(false)
  })

  /**
   * EL PLAN DEL HAMBRE TERMINA CON EL PESCADO EN LA MANO.
   *
   * Es el criterio del Hito 5 cumplido y el bucle central del juego sin cerrar:
   * `holding(tag:carnoso)` es «tener algo carnoso agarrado», no «haber comido».
   * La `stamina` no se movió, el hambre sigue, y el plan dice que terminó.
   */
  it('el plan del hambre termina en `aplicar(extraccion)`: pesca y no come', () => {
    const pasos = pasosDe(plan(meta({ k: 'sostiene', tag: 'carnoso' }), elRio(), SIN_CORTE))
    expect(resumir(pasos)).toEqual([
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(binder=matorral, a=vara)',
      'ir(pozo)',
      'aplicar(extraccion, source=pozo)',
    ])
    const ultimo = pasos[pasos.length - 1]
    expect(ultimo?.k).toBe('aplicar')
  })

  /**
   * Lo mismo dicho como lo que debería pasar, para que quede un test rojo con
   * nombre en vez de un comentario.
   *
   * NO SE PUEDE ARREGLAR CON UNA FILA de `ESQUEMAS`, y por eso va `it.fails` y no
   * un puente como el del fuego: `ConstructionSchema.via` es un `ProcessId`, y
   * comer NO ES UN PROCESO —es la primitiva `eat` de `stepWorld`, sin roles y sin
   * `establishes` (`skills/src/innatas/comer.ts` lo documenta con todas las
   * letras: la física tiene dos cosas llamadas «comer» y sólo manda la primitiva)—.
   * O sea: la tabla no tiene dónde escribir esta fila. Falta una segunda fuente
   * de esquemas, la de las habilidades innatas y sus `Contrato.establece`.
   */
  it.fails('el plan del hambre debería terminar comiendo', () => {
    const pasos = pasosDe(plan(meta({ k: 'sostiene', tag: 'carnoso' }), elRio(), SIN_CORTE))
    expect(pasos[pasos.length - 1]?.k).toBe('comer')
  })

  /**
   * Y el hambre tampoco se puede nombrar como lo que es.
   *
   * Lo que duele es la `stamina` —`SelfView` lo dice y la física no tiene ninguna
   * cualidad `hunger`—, así que el objetivo honesto de una criatura hambrienta es
   * `stamina > 0`. Ningún esquema lo establece, y el `nearest` sale VACÍO: el gap
   * ni siquiera puede decir «mientras tanto andá al río».
   */
  it('«quiero aliento» (`stamina>0`) es un gap con el `nearest` vacío', () => {
    const r = plan(meta({ k: 'cualidad', test: { q: 'stamina', op: '>', v: 0 } }), elRio(), SIN_CORTE)
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') throw new Error('imposible')
    expect(r.missing).toBe('stamina>0')
    expect(r.why).toBe('ningún esquema conocido establece «stamina>0»')
    expect(r.nearest).toEqual([])
  })

  /**
   * ─── Y ACÁ EMPIEZA LO PEOR, QUE NO ES QUE FALTE: ES QUE CONTESTA MAL ───────
   *
   * `Predicado` no tiene SUJETO. `cumple` resuelve una cualidad barriendo
   * `see()`, o sea CUALQUIER cuerpo a la vista. Así que «quiero tener aliento» lo
   * cumple **el aliento de otra**: con una vecina bien alimentada a tres celdas,
   * la regla 6 del planificador —«lo que ya se cumple no se planifica»— declara el
   * objetivo hecho y devuelve el plan vacío.
   *
   * Es el error CARO de los dos que `cumpleCuerpo` documenta: no es «reconstruir
   * algo que ya tengo», es «darme por satisfecha mirando a otro». La criatura se
   * muere de hambre con el plan en verde.
   */
  it('«quiero aliento» se da por CUMPLIDO porque la vecina tiene aliento', () => {
    const conVecina = vista({
      self: criatura(),
      cuerpos: [cuerpo('vecina', 3, 0), cuerpo('vara', 5, 0)],
      qs: new Map<BodyId, Cualidades>([
        ['vecina', { stamina: 900, mass: 60 }],
        ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, mass: 1 }],
      ]),
    })
    const r = plan(meta({ k: 'cualidad', test: { q: 'stamina', op: '>=', v: 500 } }), conVecina, SIN_CORTE)
    expect(r.k).toBe('plan')
    expect(pasosDe(r)).toEqual([])
  })

  /**
   * ─── Y LA OTRA MITAD DEL MISMO AGUJERO, MEDIDA — MEDIO ARREGLADA ───────────
   *
   * Con el pescado YA EN LA MANO, el plan vuelve a pescar entero. Eso SIGUE
   * PASANDO y sigue siendo un hueco de la superficie, no del planificador:
   * `cumpleCuerpo` contesta `false` a `sostiene` porque una `BodyView` no trae
   * sustancia, así que un objetivo de comida no se da por cumplido nunca.
   *
   * Lo que este test medía además, y era lo grave, era lo que pasaba DESPUÉS de
   * esa respuesta equivocada:
   *
   *   **el plan salía pescando ADENTRO DEL PESCADO.**
   *
   * `extraccion` le pide al rol `source` `mass > 0` y nada más, y `candidatosPara`
   * prefiere lo que ya está en la mano antes que lo cercano: el pescado era lo
   * único en la mano y ganaba. Salían seis pasos verdes, coherentes y absurdos
   * para meter una caña adentro de un pescado de 400 gramos.
   *
   * Eso SÍ está arreglado: el `source` ahora pide `wet >= 0.9` a su celda, y el
   * pescado —que está en la mano, o sea en la celda seca donde está la criatura—
   * deja de calificar. Queda el viaje de más, que es el hueco de `sostiene`.
   */
  it('con el pescado en la mano el plan vuelve a pescar, pero YA NO adentro del pescado', () => {
    const pescado = cuerpo('pescado', 0, 0)
    const conPescado = vista({
      self: criatura({ holding: [pescado] }),
      cuerpos: [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0), pescado],
      qs: new Map<BodyId, Cualidades>([
        ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
        ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
        ['pozo', { mass: 50 }],
        ['pescado', { calories: 120, nutrition: 8, mass: 0.4, digestibility: 0.3 }],
      ]),
      mojadas: [{ x: 8, y: 0 }],
    })
    const pasos = pasosDe(plan(meta({ k: 'sostiene', tag: 'carnoso' }), conPescado, SIN_CORTE))
    expect(resumir(pasos)).toEqual([
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(binder=matorral, a=vara)',
      // El pozo, a ocho celdas, le gana al pescado que está en la mano: es el
      // único que está en agua franca. El plan es absurdo por otra razón —ya hay
      // pescado— y esa razón vive en `cumpleCuerpo`, no acá.
      'ir(pozo)',
      'aplicar(extraccion, source=pozo)',
    ])
    // Y que el pescado NO aparezca en ningún paso es la mitad que se arregló.
    expect(resumir(pasos).some((s) => s.includes('pescado'))).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 2 · «QUIERO CALENTARME»
// ════════════════════════════════════════════════════════════════════════════

describe('2 · «quiero calentarme»: el predicado no tiene sujeto', () => {
  /** Control positivo: sobre un cuerpo cualquiera, el plan sale y sale con yesca. */
  it('sobre un cuerpo, el plan sale: la yesca la pone la aritmética', () => {
    const pasos = pasosDe(plan(meta({ k: 'cualidad', test: { q: 'temperature', op: '>=', v: 400 } }), elLeno(), SIN_CORTE))
    expect(resumir(pasos)).toEqual([
      'ir(leno)',
      'sostener(leno)',
      'deshilachar(leno, 1)',
      'frotar(a=lo-que-hice, b=leno, hasta=400)',
    ])
  })

  /**
   * SOBRE MÍ MISMA NO SE PUEDE DECIR, y el sistema tiene DOS candados para eso,
   * no uno:
   *
   *   · `Predicado` no nombra a nadie. Las tres formas son `{cualidad}`,
   *     `{geometria}` y `{sostiene}`, y ninguna trae un campo `sujeto`. El
   *     vocabulario de al lado SÍ lo tiene —`Contrato.Predicado` de
   *     `skills/src/innatas/contrato.ts` declara
   *     `sujeto: 'yo' | 'el-objetivo' | 'lo-que-devuelve' | 'la-celda'`, y su
   *     comentario dice por qué: «`Where` no lo dice: un `QualityTest` habla de
   *     un cuerpo, sin decir cuál»—. O sea que el proyecto ya descubrió que hacía
   *     falta y el planificador quedó del otro lado del descubrimiento.
   *   · `candidatosPara` me excluye por id (`if (b.id === v.self.id) return`), así
   *     que aunque el objetivo pudiera nombrarme, ningún rol me podría ligar.
   *
   * La medición es la de abajo: me pongo a mí misma en la vista, fría, con un leño
   * al lado. El plan calienta EL LEÑO. Nunca a mí.
   */
  it('el plan calienta el leño y no a la criatura, y no hay forma de pedir lo contrario', () => {
    const yoFria = vista({
      self: criatura(),
      cuerpos: [cuerpo('yo', 0, 0), cuerpo('leno', 3, 0)],
      qs: new Map<BodyId, Cualidades>([
        ['yo', { temperature: 15, mass: 60, rigidity: 0.3, heatCapacity: 60 }],
        ['leno', { rigidity: 0.7, heatCapacity: 1.7, tensile: 0.55, mass: 1, temperature: 15 }],
      ]),
    })
    const pasos = pasosDe(plan(meta({ k: 'cualidad', test: { q: 'temperature', op: '>=', v: 400 } }), yoFria, SIN_CORTE))
    const frotar = pasos.find((s) => s.k === 'frotar')
    expect(frotar).toBeDefined()
    // Ningún paso nombra a la criatura como cuerpo a calentar. `{k:'yo'}` tampoco
    // aparece: `friccion` la usa de rol `actor` y `pasoDelProceso` no lo escribe
    // en el paso, porque la habilidad innata pasa `ctx.self` y no puede pasar otra.
    const nombraAlYo = pasos.some((s) => JSON.stringify(s).includes('"yo"'))
    expect(nombraAlYo).toBe(false)
  })

  /**
   * Y el mismo agujero del sujeto, del lado de «ya está cumplido»: una BRASA
   * AJENA a nueve celdas —que no calienta a nadie— hace que «quiero 400 grados»
   * salga como plan vacío.
   *
   * Nótese que ni siquiera hace falta que la brasa sea inalcanzable para que esto
   * sea grave: la temperatura de un cuerpo a nueve celdas no tiene absolutamente
   * nada que ver con si la criatura tiene frío.
   */
  it('una brasa ajena a nueve celdas da «quiero calentarme» por cumplido', () => {
    const conBrasa = vista({
      self: criatura(),
      cuerpos: [cuerpo('yo', 0, 0), cuerpo('brasa', 9, 0), cuerpo('leno', 3, 0)],
      qs: new Map<BodyId, Cualidades>([
        ['yo', { temperature: 15, mass: 60 }],
        ['brasa', { temperature: 700, mass: 0.5 }],
        ['leno', { rigidity: 0.7, heatCapacity: 1.7, tensile: 0.55, mass: 1, temperature: 15 }],
      ]),
    })
    const r = plan(meta({ k: 'cualidad', test: { q: 'temperature', op: '>=', v: 400 } }), conBrasa, SIN_CORTE)
    expect(r.k).toBe('plan')
    expect(pasosDe(r)).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 3 · «QUIERO EL PESCADO COCIDO»
// ════════════════════════════════════════════════════════════════════════════

describe('3 · «quiero el pescado cocido»: la ligadura diferida que nadie lee', () => {
  /**
   * La lectura de las dos cláusulas del ejemplo, y `goalGraph` hace bien su parte:
   * el segundo nodo va después del primero y bindea su slot al rendimiento del
   * primero. Es el ADR 0082 de Ánima I portado, tal como dice `objetivos.ts`.
   */
  it('control positivo: `goalGraph` sí produce la ligadura diferida', () => {
    const g = grafoDelPescadoCocido()
    expect(g[1]?.after).toEqual(['g0'])
    expect(g[1]?.binds).toEqual({ slot: 'target', from: 'g0' })
  })

  /**
   * ─── Y `plan()` NO LA LEE. NI A ELLA NI A `after`. ──────────────────────────
   *
   * La firma es `plan(g: GoalNode, …)` y adentro `g` se usa dos veces:
   * `textoDe(g.goal)` para armar el nodo inicial y `cumple(g.goal, v)` para la
   * regla 6. `g.binds` y `g.after` no aparecen en `regresion.ts` en ninguna forma.
   *
   * La medición no es una lectura del código: es que el resultado con la ligadura
   * y el resultado sin ella son **el mismo objeto**, comparado entero. Y no hay
   * ningún parámetro por donde entre lo que rindió el nodo anterior: `plan()` toma
   * UN nodo, no el grafo, y `PlanResult` no tiene dónde devolver el rendimiento.
   *
   * O sea: el módulo `objetivos.ts` produce dos campos que el único consumidor del
   * paquete tira. La cadena «pescá, después cociná lo que pescaste» se puede LEER
   * y no se puede PLANIFICAR.
   */
  it('`plan()` da el MISMO resultado con `binds`/`after` y sin ellos: los ignora', () => {
    const g = grafoDelPescadoCocido()
    const segundo = g[1]
    if (segundo === undefined) throw new Error('el grafo del ejemplo tiene dos nodos')
    const pelado: GoalNode = { id: segundo.id, goal: segundo.goal, after: [], porque: segundo.porque }
    expect(plan(segundo, elRio(), SIN_CORTE)).toEqual(plan(pelado, elRio(), SIN_CORTE))
  })

  /**
   * Y cocinar, además, no tiene esquema — y no lo tiene por una razón de fondo y
   * no por olvido: **la cocción es ley ambiente** (ley 5, `leyes.ts`), no un
   * proceso aplicable. Sube `digestibility` hacia 0,95 sola, con el pescado cerca
   * del fuego. Los cuatro procesos aplicables no la tocan.
   *
   * Es el mismo problema que «quiero fuego» de la sección 4: el planificador
   * regresa sobre procesos y el mundo hace la mitad de las cosas sin ninguno.
   */
  it('«cocido» (`digestibility>=0.8`) es un gap: cocinar lo hace una ley, no un proceso', () => {
    const r = plan(meta({ k: 'cualidad', test: { q: 'digestibility', op: '>=', v: 0.8 } }), elRio(), SIN_CORTE)
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') throw new Error('imposible')
    expect(r.why).toBe('ningún esquema conocido establece «digestibility>=0.8»')
    expect(r.nearest).toEqual([])
  })

  /**
   * Y aunque el esquema existiera, faltaría el paso. Poner el pescado sobre las
   * brasas es `poner` —que en `Step` tiene los cuatro campos exactos que hacen
   * falta: `que`, `en`, `sobre`, `tapando`— y `poner` es una de las cuatro
   * variantes que ningún camino de `src/` construye. Medido arriba, en 1.
   */
  it('y el paso que haría falta (`poner`) tampoco se puede emitir', () => {
    const emitidos = new Set<Step['k']>()
    for (const m of LO_QUE_SE_PUEDE_PEDIR) {
      for (const s of pasosDeCualquiera(plan(meta(m), elRio(), SIN_CORTE))) emitidos.add(s.k)
    }
    expect(emitidos.has('poner')).toBe(false)
  })
})

function grafoDelPescadoCocido(): readonly GoalNode[] {
  return goalGraph({
    clausulas: [
      { goal: { k: 'sostiene', tag: 'carnoso' }, liga: 'y', porque: 'tengo hambre' },
      {
        goal: { k: 'cualidad', test: { q: 'digestibility', op: '>=', v: 0.8 } },
        liga: 'despues',
        bindeaSlot: 'target',
        porque: 'crudo no',
      },
    ],
  })
}

// ════════════════════════════════════════════════════════════════════════════
// 4 · «QUIERO FUEGO»
// ════════════════════════════════════════════════════════════════════════════

describe('4 · «quiero fuego»: planificar una consecuencia', () => {
  /**
   * El ADR II-0001 decide que encender NO es una acción: la criatura sube la
   * temperatura con `friccion` y **la ley 3 decide si prende**. La consecuencia
   * para el planificador no estaba escrita en ningún lado, y es ésta: el objetivo
   * «que esto arda» no tiene proceso que lo establezca, así que es un gap.
   *
   * Lo que lo vuelve un hueco y no una limitación aceptada es el `nearest`: sale
   * VACÍO. La criatura tiene el leño a tres celdas, sabe deshilacharlo, sabe
   * frotar —el plan de `temperature>=400` sale en cuatro pasos, medido arriba— y
   * el gap de «quiero fuego» no le ofrece ni uno de esos pasos.
   */
  it('«quiero fuego» (`emitsPower>0`) es un gap, y el `nearest` sale vacío', () => {
    const r = plan(meta({ k: 'cualidad', test: { q: 'emitsPower', op: '>', v: 0 } }), elLeno(), SIN_CORTE)
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') throw new Error('imposible')
    expect(r.missing).toBe('emitsPower>0')
    expect(r.why).toBe('ningún esquema conocido establece «emitsPower>0»')
    expect(r.nearest).toEqual([])
  })

  /**
   * ─── Y LA REPARACIÓN NO ES UN DISEÑO NUEVO: ES UNA FILA ────────────────────
   *
   * Éste es el único hueco de los ocho que se puede cerrar sin tocar un tipo.
   * `emitsPower` es una cualidad DERIVADA del catálogo y su expresión dice, en la
   * gramática de la física, exactamente qué hace falta: un `step(temperature ≥
   * ignitionPoint)` multiplicando a `fuelEnergy × mass × K`. O sea que subir la
   * temperatura por encima del punto de ignición ES establecer `emitsPower > 0`,
   * y eso es lo que hace `friccion`.
   *
   * Con esa fila metida por `opciones.esquemas` —la puerta que existe justo para
   * poder interrogar a la tabla— el plan sale, y sale con la yesca:
   */
  it('con UNA fila puente, «quiero fuego» sale en cuatro pasos', () => {
    const r = plan(meta({ k: 'cualidad', test: { q: 'emitsPower', op: '>', v: 0 } }), elLeno(), SIN_CORTE, undefined, {
      esquemas: [...ESQUEMAS, PUENTE_DEL_FUEGO],
    })
    expect(resumir(pasosDe(r))).toEqual([
      'ir(leno)',
      'sostener(leno)',
      'deshilachar(leno, 1)',
      // `hasta=0` es «sin `hasta`», y acá está BIEN: `hastaDe` lee el número del
      // predicado que se persigue y `emitsPower>0` no trae temperatura, así que
      // `frotar` cae en su valor por defecto, que es el `ignitionPoint` del cuerpo.
      // Para el fuego eso es exactamente lo que hay que frotar hasta.
      'frotar(a=lo-que-hice, b=leno, hasta=0)',
    ])
  })

  /**
   * Y que la fila no es invento se verifica contra el catálogo, sin transcribir la
   * fórmula: se recorre la expresión derivada de `emitsPower` y se juntan las
   * cualidades que nombra. Si mañana la física cambia de qué depende arder, este
   * test se pone rojo y la fila de arriba queda marcada como sospechosa.
   */
  it('el puente sale del catálogo: `emitsPower` depende de la ignición y del combustible', () => {
    const e = specOf('emitsPower').derived
    expect(e).toBeDefined()
    if (e === undefined) throw new Error('imposible')
    expect([...cualidadesDe(e)].sort()).toEqual(['fuelEnergy', 'ignitionPoint', 'mass', 'temperature'])
    // Y las tres condiciones del `roleHint` del puente son cualidades del catálogo
    // que la ley 3 mira: combustible, humedad y el techo de yesca que ya tiene la
    // tabla para `temperature>=400`.
    expect(Object.keys(PUENTE_DEL_FUEGO.roleHints).sort()).toEqual(['a', 'actor', 'b'])
  })
})

/**
 * La fila que falta, escrita acá y NO en `src/esquemas.ts` porque este archivo no
 * toca `src/`: es una propuesta medida, no un cambio.
 *
 * `segundos` va con el mismo número que la tabla le pone a `friccion`
 * —`(400 − 15) / 120`, que sale de su `drive`— para que el costo no sea inventado.
 */
const PUENTE_DEL_FUEGO: ConstructionSchema = {
  establishes: 'emitsPower>0',
  via: 'friccion',
  roleHints: {
    a: [
      // El techo de yesca: lo mismo que la tabla ya le pide a `temperature>=400`.
      { q: 'heatCapacity', op: '<=', v: 0.9 },
      // Sin combustible no hay emisión por más caliente que esté.
      { q: 'fuelEnergy', op: '>', v: 0 },
      // Ley 11 metida en la 3: la leña mojada no arde (`HUMEDAD_QUE_APAGA`).
      { q: 'moisture', op: '<=', v: 0.45 },
    ],
    b: [],
    actor: [],
  },
  segundos: (400 - 15) / 120,
}

/** Las cualidades que una expresión derivada nombra, sin copiar la fórmula. */
function cualidadesDe(e: QualityExpr): ReadonlySet<QualityId> {
  const out = new Set<QualityId>()
  const ver = (n: QualityExpr): void => {
    switch (n.k) {
      case 'own':
      case 'sumParts':
      case 'maxParts':
        out.add(n.q)
        return
      case 'op':
        ver(n.a)
        ver(n.b)
        return
      case 'const':
      case 'geom':
      case 'substance':
        return
    }
  }
  ver(e)
  // `mass` entra por el `substance('specificHeat')`? No: entra por el producto
  // explícito con `own(mass)`. El nodo `substance` no nombra ninguna cualidad.
  return out
}

// ════════════════════════════════════════════════════════════════════════════
// 5 · «QUIERO LA VARA DE VUELTA»
// ════════════════════════════════════════════════════════════════════════════

describe('5 · «quiero la vara de vuelta»: el desarme que la física acepta y nadie declara', () => {
  /**
   * `Yield` acepta `{k:'split', role, at:'joint'}` —el literal de abajo
   * typechequea— y el mundo sabe ejecutarlo: `partir(d, b, 'joint')` recupera la
   * última parte atada. Lo que no existe es la PUERTA: ninguno de los tres yields
   * de la semilla es ése. `deshilachar` parte a favor del GRANO.
   *
   * Sin proceso no hay `ConstructionSchema` posible —`ConstructionSchema.via` es un
   * `ProcessId`— así que este hueco no es del planificador: es del catálogo, y el
   * planificador es donde se nota.
   */
  it('el `Yield` de desarme existe en la física y ningún proceso semilla lo declara', () => {
    const desarme: Yield = { k: 'split', role: 'source', at: 'joint' }
    expect(desarme.at).toBe('joint')

    const declarados = SEED_PROCESSES.flatMap((p) =>
      (p.completion?.yields ?? []).map((y) => `${p.id}:${y.k}${y.k === 'split' ? `@${y.at}` : ''}`),
    )
    expect(declarados).toEqual(['union:join', 'deshilachar:split@grain', 'extraccion:drawFromStock'])
    expect(declarados.some((d) => d.endsWith('@joint'))).toBe(false)
  })

  /**
   * Y el objetivo tampoco se puede perseguir. «Suelto» se dice `jointCount<=0` —es
   * una de las tres `GeomFn` y `interpretar` la entiende— y no hay esquema.
   *
   * El escenario es el que importa: la caña ya está atada y es LO ÚNICO que hay.
   * Sin esto —una vara suelta en la vista— el objetivo se daría por cumplido con
   * la vara de al lado, que es otro caso.
   */
  it('«que esto quede suelto» (`jointCount<=0`) es un gap', () => {
    const soloLaCania = vista({
      self: criatura(),
      cuerpos: [cuerpo('cania', 2, 0, [{ a: 0, b: 1, strength: 1 }])],
      qs: new Map<BodyId, Cualidades>([['cania', { reach: 4.8, catch: 0.15, mass: 1.2, tensile: 0.55 }]]),
    })
    const r = plan(meta({ k: 'geometria', f: 'jointCount', op: '<=', v: 0 }), soloLaCania, SIN_CORTE)
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') throw new Error('imposible')
    expect(r.missing).toBe('jointCount<=0')
    expect(r.why).toBe('ningún esquema conocido establece «jointCount<=0»')
  })

  /**
   * La consecuencia práctica, medida sobre la pesca: `union` es de ida sola. El
   * planificador CUENTA lo que se gastó —`NodoAbierto.gastados`, y sin esa cuenta
   * el plan pescaba adentro del matorral— pero contar no es poder deshacer. Una
   * vez que la vara entró en la caña, ningún plan la puede volver a nombrar.
   */
  it('la vara desaparece del plan en cuanto entra en la caña, y no hay paso que la devuelva', () => {
    const pasos = pasosDe(plan(meta({ k: 'sostiene', tag: 'carnoso' }), elRio(), SIN_CORTE))
    const iUnir = pasos.findIndex((s) => s.k === 'unir')
    expect(iUnir).toBeGreaterThanOrEqual(0)
    const despues = pasos.slice(iUnir + 1)
    const nombraLaVara = despues.some((s) => JSON.stringify(s).includes('"vara"'))
    expect(nombraLaVara).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 6 · «QUIERO LLEGAR AL RÍO»
// ════════════════════════════════════════════════════════════════════════════

describe('6 · «quiero llegar al río»: un objetivo sobre una CELDA', () => {
  /**
   * Las cuatro cualidades de celda del ADR II-0002 son `wet`, `oxygen`,
   * `temperature` y `sheltered`, y el planificador las trata de tres maneras
   * distintas, ninguna correcta:
   *
   *   · `wet` y `sheltered` NO SE ENTIENDEN. `interpretar` devuelve `undefined`,
   *     así que «quiero estar donde hay agua» y «quiero estar a reparo» no son
   *     predicados. Y son, respectivamente, la mitad de pescar y la mitad de
   *     sobrevivir la noche.
   *   · `oxygen` y `temperature` SÍ se entienden — **y contestan sobre otra cosa**.
   *     Las dos son también cualidades de CUERPO, así que `oxygen>=0.1` parsea
   *     como «un cuerpo con oxígeno» sin decir una palabra. Es el error caro otra
   *     vez: no falta, contesta mal.
   */
  it('dos de las cuatro cualidades de celda no se entienden, y las otras dos se entienden MAL', () => {
    expect(interpretar('wet>=1')).toBeUndefined()
    expect(interpretar('sheltered>=1')).toBeUndefined()
    // Y las que sí: salen como cualidad de CUERPO, sin marca de que el sujeto es otro.
    expect(interpretar('oxygen>=0.1')).toEqual({ k: 'cualidad', test: { q: 'oxygen', op: '>=', v: 0.1 } })
    expect(interpretar('temperature>=400')).toEqual({
      k: 'cualidad',
      test: { q: 'temperature', op: '>=', v: 400 },
    })
    // La firma conserva lo que no entiende —igual que hace la puerta—, así que
    // `wet>=1` sobrevive como texto y no como predicado: viaja hasta el gap.
    expect(firmaDe('wet>=1')).toBe('wet>=1')
  })

  /**
   * `Ref` sabe nombrar una celda (`{k:'celda', at}`) y sabe nombrar una
   * descripción (`{k:'donde', where}`). El planificador no emite ninguna de las
   * dos: todos los `ir` de todos los planes de todos los objetivos que la tabla
   * sabe perseguir van a un `{k:'id'}`, o sea a un cuerpo QUE YA SE VE.
   *
   * Consecuencia: no hay forma de planificar «andá al río» si el río no está en la
   * vista de este tick. El paso que serviría —`explorar`— tampoco se emite, y su
   * ausencia está explicada en `regresion.ts`: pide `maxTicks` y `VistaDelPlan` no
   * tiene `hz` con qué convertir los segundos del reloj.
   */
  it('todos los `ir` van a un cuerpo que ya se ve: nunca a una celda ni a una descripción', () => {
    const formas = new Set<Ref['k']>()
    for (const v of [elRio(), elLeno()]) {
      for (const m of LO_QUE_SE_PUEDE_PEDIR) {
        for (const s of pasosDeCualquiera(plan(meta(m), v, SIN_CORTE))) {
          if (s.k === 'ir') formas.add(s.a.k)
        }
      }
    }
    expect([...formas]).toEqual(['id'])
  })

  /**
   * ─── Y LA MEDICIÓN QUE LO RESUME: DE TRES MIEMBROS MUDOS QUEDAN DOS ────────
   *
   * `VistaDelPlan` declara seis cosas. `plan()` usaba tres —`see`, `q`, `self`— y
   * las otras tres no las tocaba NUNCA. Ahora son cuatro y dos:
   *
   *   qAt     LAS LEE. Es lo que arregló que cualquier piedra con masa se
   *           convirtiera en el pozo: el `source` de `extraccion` pide
   *           `wet >= 0.9` a la celda del candidato. El conteo de abajo lo
   *           afirma en positivo, así que si alguien saca el `cellHints` de la
   *           tabla, este test se pone rojo y no al revés.
   *   recall  la memoria de lugares, todavía muda. Sin esto el planificador sólo
   *           conoce lo que ve en este tick, y `PlaceMemory` trae `atTick`
   *           justamente para poder razonar sobre lo que se vio antes. Un pozo
   *           que se recuerda —«acá había peces»— sigue sin poderse perseguir.
   *   clock   el día y la noche, todavía mudo. Ver la sección 8.
   */
  it('`qAt` ya se usa; `recall` y `clock` siguen sin llamarse ni una vez en ocho objetivos', () => {
    const espia: Espia = { qAt: 0, recall: 0, clock: 0 }
    const conEspia = vista({
      self: criatura(),
      cuerpos: [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0)],
      qs: new Map<BodyId, Cualidades>([
        ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
        ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
        ['pozo', { mass: 50 }],
      ]),
      espia,
      mojadas: [{ x: 8, y: 0 }],
    })
    for (const m of LO_QUE_SE_PUEDE_PEDIR) plan(meta(m), conEspia, SIN_CORTE)
    // Y uno que es un gap, para que la cuenta cubra también el camino de morir.
    plan(meta({ k: 'cualidad', test: { q: 'emitsPower', op: '>', v: 0 } }), conEspia, SIN_CORTE)
    expect(espia.recall).toBe(0)
    expect(espia.clock).toBe(0)
    // Cuatro lecturas de celda: las que decidieron cuál de los tres cuerpos con
    // masa es un pozo, en las dos metas que llegan a pedir un `source`. El número
    // exacto no es el punto —cambia si cambia el orden de los roles— pero que sea
    // MAYOR QUE CERO sí lo es.
    expect(espia.qAt).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 7 · «QUIERO DOS HEBRAS»
// ════════════════════════════════════════════════════════════════════════════

describe('7 · «quiero dos hebras»: la cantidad no se puede pedir', () => {
  /**
   * PEDIR DOS ES LITERALMENTE PEDIR UNA.
   *
   * `firmaDe` colapsa las cláusulas repetidas —y hace bien, porque `a ∧ a` es `a`
   * en lógica— pero eso deja el vocabulario sin ninguna forma de decir «dos». La
   * conjunción no cuenta: es un conjunto, no una bolsa.
   *
   * No es teórico. `union` necesita un `binder` flexible y un `a`; un trípode
   * necesita tres varas; una red necesita muchas hebras. Todos esos pedidos se
   * escriben igual que el pedido de una sola pieza.
   */
  it('«dos hebras flexibles» y «una hebra flexible» son la MISMA firma', () => {
    expect(firmaDe('flexibility>=0.8&flexibility>=0.8')).toBe('flexibility>=0.8')
    expect(firmaDe('flexibility>=0.8&flexibility>=0.8&flexibility>=0.8')).toBe(firmaDe('flexibility>=0.8'))
  })

  /**
   * Y del lado del paso, el número está clavado en 1 con un comentario que lo
   * justifica —«pedir más sería una decisión que nadie tomó»—, que es correcto
   * MIENTRAS no haya forma de tomarla. Este test mide que no la hay: sobre todos
   * los objetivos que producen un `deshilachar`, `cuantas` siempre vale 1.
   */
  it('todo `deshilachar` que el planificador emite pide UNA hebra', () => {
    const cantidades = new Set<number>()
    for (const v of [elRio(), elLeno()]) {
      for (const m of LO_QUE_SE_PUEDE_PEDIR) {
        for (const s of pasosDeCualquiera(plan(meta(m), v, SIN_CORTE))) {
          if (s.k === 'deshilachar') cantidades.add(s.cuantas)
        }
      }
    }
    expect([...cantidades]).toEqual([1])
  })

  /**
   * `juntar` es el único paso del tipo que lleva `cuantos`, y es una de las cuatro
   * variantes muertas. O sea: el lugar donde la cantidad se podría expresar existe
   * y no tiene productor, exactamente igual que `comer`.
   */
  it('`juntar`, el único paso con `cuantos`, nunca se emite', () => {
    const emitidos = new Set<Step['k']>()
    for (const v of [elRio(), elLeno()]) {
      for (const m of LO_QUE_SE_PUEDE_PEDIR) {
        for (const s of pasosDeCualquiera(plan(meta(m), v, SIN_CORTE))) emitidos.add(s.k)
      }
    }
    expect(emitidos.has('juntar')).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 8 · «QUIERO GUARECERME ANTES DE LA NOCHE»
// ════════════════════════════════════════════════════════════════════════════

describe('8 · «quiero guarecerme antes de la noche»: el tiempo no entra', () => {
  /**
   * El documento de arquitectura le pone a `GoalNode` un quinto campo:
   *
   *     temporal?: GoalTemporal;   // ADR 0085: startWhen / until / plazo
   *
   * (`docs/architecture/remake-anima-ii.md`, línea 799). El `GoalNode` que se
   * implementó tiene cuatro campos y ése no está.
   *
   * El registro exhaustivo de abajo es la forma de medirlo sin leer el archivo del
   * documento: `Record<keyof GoalNode, true>` NO COMPILA si le falta una clave, así
   * que la lista es la verdad del tipo. El día que alguien agregue `temporal`, este
   * archivo deja de compilar y hay que venir a borrar el test — que es exactamente
   * lo que se quiere que pase.
   */
  it('`GoalNode` tiene cuatro campos y ninguno es el tiempo', () => {
    const campos: Readonly<Record<keyof GoalNode, true>> = {
      id: true,
      goal: true,
      after: true,
      binds: true,
      porque: true,
    }
    expect(Object.keys(campos).sort()).toEqual(['after', 'binds', 'goal', 'id', 'porque'])
    expect(Object.hasOwn(campos, 'temporal')).toBe(false)
  })

  /**
   * Y lo que se pierde con eso, dicho concreto: el reloj ESTÁ en la vista —`Clock`
   * con `phase`, `secondsToNightfall` y `dayLength`, portado a segundos por el ADR
   * II-0008— y `plan()` no lo mira ni una vez (medido en la sección 6).
   *
   * O sea que hoy dos planes idénticos salen a mediodía y a un segundo de que
   * caiga la noche. El plan de la pesca cuesta, por la propia tabla, 1 + 1,5
   * segundos de proceso más la caminata; si faltaran 0,5 segundos para la noche,
   * el planificador lo devolvería igual.
   */
  it('el mismo objetivo a mediodía y a un segundo de la noche da EXACTAMENTE el mismo plan', () => {
    const cuerpos = [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0)]
    const qs = new Map<BodyId, Cualidades>([
      ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
      ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
      ['pozo', { mass: 50 }],
    ])
    const deDia = vista({ self: criatura(), cuerpos, qs, mojadas: [{ x: 8, y: 0 }] })
    const casiDeNoche: VistaDelPlan = {
      ...deDia,
      clock: { phase: 'dia', secondsToNightfall: 0.5, dayLength: 200 },
    }
    const g = meta({ k: 'sostiene', tag: 'carnoso' })
    expect(plan(g, casiDeNoche, SIN_CORTE)).toEqual(plan(g, deDia, SIN_CORTE))
  })

  /**
   * Y guarecerse tampoco se puede decir: `sheltered` es cualidad de CELDA, así que
   * no hay predicado. Es el cruce de dos huecos —el del tiempo y el del lugar— y
   * por eso la conducta anticipatoria de la noche es la única de las diez
   * secuencias de emergencia que falla por las dos puntas a la vez.
   */
  it('«a reparo» no es un predicado que se pueda escribir', () => {
    expect(interpretar('sheltered>=1')).toBeUndefined()
    expect(interpretar('sheltered>0')).toBeUndefined()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 9 · LA QUE SALIÓ SOLA: LA META NO PUEDE SER UNA CONJUNCIÓN
// ════════════════════════════════════════════════════════════════════════════

describe('9 · la meta no puede ser una conjunción', () => {
  /**
   * `GoalNode.goal` es UN `Predicado`, y `Predicado` es una unión de tres formas
   * atómicas: no hay variante conjuntiva. `plan()` arranca con `textoDe(g.goal)`,
   * que devuelve una sola cláusula.
   *
   * Adentro, en cambio, la conjunción es el pan de cada día: el rol `gear` de
   * `extraccion` pide `catch>0 ∧ reach>=2`, y la decisión 1 de `regresion.ts` está
   * escrita entera alrededor de juntar dos esquemas para cubrirla.
   *
   * O sea: **la conjunción sobre la que está construido el paquete no se puede
   * pedir desde afuera**. «Quiero una caña» —para pescar mañana, para guardarla,
   * para lo que sea— no es un objetivo expresable; sólo lo es como efecto lateral
   * de pedir un pescado.
   */
  it('la conjunción que el paquete resuelve adentro no se puede escribir como objetivo', () => {
    // Como firma existe y está bien formada: es la que aparece en los `porQue`.
    expect(firmaDe('catch>0 & reach>=2')).toBe('catch>0&reach>=2')
    // Como `Predicado` no existe: `interpretar` es de UNA cláusula.
    expect(interpretar('catch>0&reach>=2')).toBeUndefined()
    // Y las tres formas de `Predicado`, exhaustivas: ninguna es una conjunción.
    const formas: Readonly<Record<Predicado['k'], true>> = { cualidad: true, geometria: true, sostiene: true }
    expect(Object.keys(formas).sort()).toEqual(['cualidad', 'geometria', 'sostiene'])
  })

  /**
   * Y el sucedáneo —pedir una de las dos cláusulas y esperar que la otra venga de
   * arrastre— da lo que tiene que dar: pedir sólo `catch>0` produce una caña que
   * NO cumple `reach>=2`, porque el esquema del enganche no le pide nada a `a`.
   *
   * El plan sale con el matorral de binder y el matorral de `a`... o con lo que
   * haya. Lo que este test clava es que el plan que sale de pedir media conjunción
   * NO es el mismo que el de pedirla entera, o sea que la mitad no se puede usar
   * como sustituto.
   */
  it('pedir media conjunción da otro plan, así que la mitad no sustituye al todo', () => {
    const soloCatch = plan(meta({ k: 'cualidad', test: { q: 'catch', op: '>', v: 0 } }), elRio(), SIN_CORTE)
    const laPesca = plan(meta({ k: 'sostiene', tag: 'carnoso' }), elRio(), SIN_CORTE)
    expect(soloCatch.k).toBe('plan')
    expect(resumir(pasosDe(soloCatch))).not.toEqual(resumir(pasosDe(laPesca)))
  })
})
