// ─── EL POZO Y LA MANO — el eslabón que se comía la corrida del Hito 5 ───────
//
//   pnpm --filter @anima/plan test tests/el-pozo-y-la-mano.test.ts
//
// La corrida del criterio (`mind/tests/hito-5-el-criterio.test.ts`) murió en el
// tick 6194 con esta cuenta, y no es una interpretación: son eventos del mundo.
//
//     despegues       aplicar(extraccion) × 199
//     aterrizajes ok  aplicar(extraccion) × 1
//     rechazos        sin-pozo × 196   ·   no-pico × 1
//     el banco del dios termina con 129,91 kg  →  NO se vació
//
// `sin-pozo` quiere decir «detrás de ese cuerpo no hay ningún stock». No es que no
// picara —eso sería `no-pico`— ni que se hubiera vaciado el río. **Le estaba
// pescando a otra cosa**, y el paso que emitía el planificador decía a qué:
//
//     aplicar(extraccion)  gear   = w000000001  (la caña que ella misma ató)
//                          source = w000000002  (EL PESCADO DE SU PROPIA MANO)
//
// Eran DOS huecos que se tocaban, y este archivo mide los dos por separado, con el
// mundo de verdad —el dios, su decreto, su banco de peces— y sin arnés que plante
// la escena a mano:
//
//   (b) `cumpleCuerpo` contestaba `false` para TODA forma `sostiene`, así que
//       `holding(tag:carnoso)` no se daba por cumplida NUNCA, ni con el pescado
//       agarrado: todo plan de comida arrancaba con «pescá uno». Cerrado leyendo el
//       tag desde la superficie (ver `BodyView.tags`; estuvo cerrado leyendo el
//       NOMBRE al revés contra el catálogo, y esa lectura mentía sobre los
//       residuos de la ley 4).
//   (a) el rol `source` de `extraccion` pide `mass > 0` y nada más, y
//       `candidatosPara` PREFIERE lo que ya está en la mano: el cuerpo más cercano
//       que califica es, siempre, el que se lleva puesto. Cerrado con el
//       `roleNoDeLaMano` de la fila de la pesca — «no se pesca adentro de lo que
//       uno lleva agarrado». (Estuvo cerrado con `roleFilters: portable<=0` —«un
//       pozo no entra en una mano»— y esa condición se sacó midiendo: descartaba
//       todo cuerpo de menos de 8 kg, y once de las veinte partidas del banco de
//       la emergencia no tienen ningún banco más pesado que eso, así que en esas
//       once no tiraba la caña una sola vez. Ver `esquemas.ts`.)
//
// ─── POR QUÉ LOS DOS SE MIDEN CON UNA PIEDRA Y NO CON EL PESCADO ────────────
//
// Porque están entrelazados y el orden en que se arreglan cambia lo que se puede
// ver: con (b) cerrado, la meta `holding(tag:carnoso)` con un pescado en la mano ya
// no llega a regresar a ningún `source`, así que por ESE camino (a) se vuelve
// inobservable. Y no está arreglado por eso: sigue vivo para cualquier otra cosa
// portátil que la criatura tenga agarrada mientras pesca metida en el agua. La
// piedra de estos tests es esa otra cosa, y hace visible el mismo mecanismo exacto
// —lo de la mano gana— sin depender de que la meta siga sin cumplirse.
//
// ─── LA REGLA DEL ARCHIVO ───────────────────────────────────────────────────
//
// Todo número de acá sale de correr. El A/B se hace con `opciones.esquemas`, que es
// entrada pública de `plan()` y existe para esto: la misma tabla con UNA condición
// sacada. El control negativo no es un argumento, es la fila mutilada corriendo en
// el mismo mundo con la misma semilla.

import { describe, expect, it } from 'vitest'

import {
  HZ_DE_REFERENCIA,
  T_AMBIENTE,
  buildSeedPhysics,
  nameOf,
  qualityOf,
  tagsDe,
  unir,
  type Body,
  type Physics,
  type QualityId,
} from '@anima/physics'
import {
  apply,
  celdaDecretada,
  crearDios,
  decretoDe,
  eat,
  idDePozo,
  mapaDeActores,
  mapaDeCuerpos,
  stepWorld,
  type CellKey,
  type CellState,
  type EstadoDelDios,
  type Placement,
  type RoleBinding,
  type WorldBody,
  type WorldState,
} from '@anima/world'
import type { BodyView, Cell, CellQuality, Clock, SelfView, Where, WhereCell } from '@anima/skills'

import { ESQUEMAS } from '../src/esquemas.js'
import { interpretar } from '../src/predicado.js'
import { plan } from '../src/regresion.js'
import { resolverTodos } from '../src/referencias.js'
import { EXPANSIONES_POR_TICK, type ConstructionSchema, type Ref, type Step, type VistaDelPlan } from '../src/tipos.js'

const PHYS: Physics = buildSeedPhysics()
const ANA = 'ana'
/** La misma semilla que `world/tests/hito-5-la-pesca.test.ts`: el mismo río. */
const SEMILLA = 20260727n

const num = (v: number): string => v.toFixed(4).replace('.', ',')

// ─── El mundo, armado acá ───────────────────────────────────────────────────
//
// Mismo armado que `los-esquemas-contra-el-mundo.test.ts` y por la misma razón: los
// `tests/` de otro paquete no se exportan. Lo que se copia es el ARMADO; ni una
// regla del mundo ni un número de la física.

function cuerpoDe(id: string, substance: string, mass: number, form: Body['form']): Body {
  return { id, form, parts: [{ substance, mass, q: {} }], joints: [], state: { temperature: T_AMBIENTE } }
}

function criatura(id: string, stamina: number): Body {
  return {
    id: `${id}-cuerpo`,
    form: 'bloque',
    parts: [{ substance: 'carne', mass: 2, q: {} }],
    joints: [],
    state: { stamina, temperature: T_AMBIENTE },
  }
}

interface Orilla {
  readonly dios: EstadoDelDios
  readonly cx: number
  readonly cy: number
  /** La celda del banco: agua franca. */
  readonly pozo: Placement
  /** La celda SECA pegada al pozo. */
  readonly parada: Placement
}

/**
 * El primer chunk con pozo Y con una celda seca pegada, en orden canónico.
 *
 * Hay que salir a buscarla: el 88,8% de los chunks de `agua-dulce` de esta semilla
 * está enteramente inundado. Es el mismo barrido que hacen los otros dos archivos
 * que tocan el dios.
 */
function buscarOrilla(): Orilla {
  const dios = crearDios(SEMILLA)
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      const dec = decretoDe(dios, PHYS, cx, cy)
      if (dec.pozo === undefined) continue
      const p = dec.pozo.at
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const parada = { x: p.x + dx, y: p.y + dy }
        const vecino = decretoDe(dios, PHYS, Math.floor(parada.x / 16), Math.floor(parada.y / 16))
        const i = (((parada.y % 16) + 16) % 16) * 16 + (((parada.x % 16) + 16) % 16)
        if ((vecino.celdas[i] as { wet: number }).wet < 0.9) return { dios, cx, cy, pozo: p, parada }
      }
    }
  }
  throw new Error('la semilla no tiene una sola orilla en 13×13 chunks')
}

let orillaMemo: Orilla | undefined
function orilla(): Orilla {
  orillaMemo ??= buscarOrilla()
  return orillaMemo
}

/** La caña de la pesca, atada con `unir` del motor y no a mano. */
function cana(id: string): Body {
  const b = unir(
    cuerpoDe('molde-vara', 'madera', 1, 'vara'),
    undefined,
    cuerpoDe('molde-hebra', 'liana', 0.2, 'hebra'),
    PHYS,
    id,
  )
  if (b === undefined) throw new Error('`unir` cambió de forma: el banco no pudo atar la caña')
  return b
}

interface Escena {
  readonly w: WorldState
  /** Dónde está parada, para poder decirlo en la tabla. */
  readonly at: Placement
}

/**
 * La escena: Ana con la caña en la mano y, si se pide, algo más agarrado.
 *
 * `enElAgua` es la diferencia que hace visible el hueco (a): parada en la orilla
 * seca, la condición de celda de la fila ya descarta lo de la mano —viaja en la
 * celda de quien lo lleva, que es seca—; parada en el agua, no. Y parada en el agua
 * es donde la deja el propio plan cuando el pozo es lo que persigue.
 *
 * El paso de sombra del final NO es un truco del test: es lo mismo que hace
 * `perceive` (`conLoQueElDiosPone`) para que los cuerpos que el dios decreta estén
 * a la vista antes del primer tick. Sin él, el banco no existe todavía.
 */
function escena(o: {
  readonly enElAgua: boolean
  readonly tambien?: readonly Body[]
  /** Un leño de 20 kg tirado EN LA ORILLA: tiene masa, no entra en la mano, y no es un pozo. */
  readonly conLeno?: boolean
}): Escena {
  const or = orilla()
  const at: Placement = o.enElAgua ? or.pozo : or.parada
  const extras = o.tambien ?? []
  const cuerpos: WorldBody[] = [
    { body: criatura(ANA, 1000), at },
    { body: cana('cana'), at, heldBy: ANA },
    ...extras.map((b) => ({ body: b, at, heldBy: ANA })),
    ...(o.conLeno === true ? [{ body: cuerpoDe('leno', 'madera', 20, 'vara'), at: or.parada }] : []),
  ]
  const base: WorldState = {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos(cuerpos),
    actors: mapaDeActores([
      { id: ANA, body: `${ANA}-cuerpo`, holding: ['cana', ...extras.map((b) => b.id)], capacity: 6, permits: 'irreversible' },
    ]),
    cells: new Map<CellKey, CellState>(),
    nextId: 1,
    dios: or.dios,
  }
  return { w: stepWorld({ ...base }, []).state, at }
}

// ─── La vista, que es la superficie de verdad y no un atajo ─────────────────

function vistaDeCuerpo(c: WorldBody): BodyView {
  return {
    id: c.body.id,
    at: c.at,
    name: nameOf(c.body, PHYS),
    // Lo mismo que hace `perceive/src/vista.ts`: los tags salen de la Physics viva
    // y no del nombre. Un arnes que los inventara dejaria de medir la superficie.
    tags: tagsDe(c.body, PHYS),
    madeByMe: c.body.madeBy === ANA,
    joints: c.body.joints.map((j) => ({ a: j.a, b: j.b, strength: j.strength })),
  }
}

/**
 * `VistaDelPlan` sobre un `WorldState`.
 *
 * Las cuatro lecturas van al motor y al decreto, no a una tabla: `q` es
 * `qualityOf` sobre el cuerpo de verdad y `qAt` es `celdaDecretada`, que es de
 * donde la saca `perceive`. `sheltered` va en cero porque la oclusión es del
 * índice de la percepción y en una orilla abierta no hay nada tapando nada.
 */
function vistaDelPlan(w: WorldState): VistaDelPlan {
  const ana = w.actors.get(ANA)
  if (ana === undefined) throw new Error('el mundo perdió a la criatura')
  const suCuerpo = w.bodies.get(ana.body)
  if (suCuerpo === undefined) throw new Error('la criatura perdió el cuerpo')
  const dios = w.dios
  if (dios === undefined) throw new Error('sin dios no hay pozo que buscar')
  const self: SelfView = {
    ...vistaDeCuerpo(suCuerpo),
    holding: ana.holding.map((id) => {
      const c = w.bodies.get(id)
      if (c === undefined) throw new Error(`en la mano hay un fantasma: ${id}`)
      return vistaDeCuerpo(c)
    }),
    capacity: ana.capacity,
    stamina: qualityOf(suCuerpo.body, 'stamina', PHYS),
    permits: 'irreversible',
  }
  return {
    see(where: Where): readonly BodyView[] {
      const out: BodyView[] = []
      for (const c of w.bodies.values()) {
        if (c.body.id === self.id) continue
        let ok = true
        for (const t of where) {
          const x = qualityOf(c.body, t.q, PHYS)
          const pasa = t.op === '>=' ? x >= t.v : t.op === '<=' ? x <= t.v : t.op === '>' ? x > t.v : x < t.v
          if (!pasa) ok = false
        }
        if (ok) out.push(vistaDeCuerpo(c))
      }
      return out
    },
    recall: (_w: WhereCell) => [],
    q: (b: BodyView, id: QualityId): number => {
      const c = w.bodies.get(b.id)
      return c === undefined ? 0 : qualityOf(c.body, id, PHYS)
    },
    qAt: (at: Cell, cq: CellQuality): number => {
      if (cq === 'sheltered') return 0
      return celdaDecretada(dios, PHYS, at.x, at.y)[cq]
    },
    self,
    clock: { phase: 'dia', secondsToNightfall: 10_000, dayLength: 20_000 } as Clock,
  }
}

// ─── La tabla mutilada: la MISMA fila con UNA condición sacada ──────────────

/**
 * `ESQUEMAS` sin el `roleNoDeLaMano` de nadie. Es el control negativo de la
 * condición que este archivo viene a justificar: si con la fila entera y con la
 * fila mutilada saliera lo mismo, la condición sería decoración.
 *
 * ─── ACÁ SE MUTILABA `roleFilters`, Y EL CAMPO CAMBIÓ ───────────────────────
 *
 * La condición del `source` era `portable <= 0` —«un pozo no entra en una mano»—
 * y se sacó midiendo: descartaba TODO cuerpo de menos de 8 kg, y once de las
 * veinte partidas del banco de la emergencia no tienen ningún banco más pesado
 * que eso, así que en esas once la criatura no tiraba la caña una sola vez. Ver
 * `EsquemaComun.roleNoDeLaMano`. Lo que quedó dice lo mismo que la medición
 * mostró y nada más: no se pesca adentro de lo que uno lleva agarrado.
 */
const SIN_FILTRO: readonly ConstructionSchema[] = ESQUEMAS.map((e) => {
  if (e.roleNoDeLaMano === undefined) return e
  const { roleNoDeLaMano: _fuera, ...resto } = e
  return resto as ConstructionSchema
})

/** Ídem, sin el `cellHints`: para poder decir cuánto aporta cada una por separado. */
const SIN_CELDA: readonly ConstructionSchema[] = ESQUEMAS.map((e) => {
  if (e.cellHints === undefined) return e
  const { cellHints: _fuera, ...resto } = e
  return resto as ConstructionSchema
})

const META = (() => {
  const p = interpretar('holding(tag:carnoso)')
  if (p === undefined) throw new Error('`holding(tag:carnoso)` dejó de interpretarse')
  return { id: 'quiero-comer', goal: p, after: [], porque: 'el pozo y la mano' } as const
})()

/** El presupuesto: sesenta ticks de expansiones. Acá no se mide el corte. */
const SIN_CORTE = EXPANSIONES_POR_TICK * 60

function pasoDeExtraccion(w: WorldState, esquemas: readonly ConstructionSchema[]): Step | undefined {
  const r = plan(META, vistaDelPlan(w), SIN_CORTE, undefined, { esquemas })
  const pasos = r.k === 'plan' ? r.steps : r.k === 'gap' ? r.nearest : []
  return pasos.find((s) => s.k === 'aplicar' && s.proceso === 'extraccion')
}

function fuenteDe(paso: Step | undefined): Ref | undefined {
  return paso !== undefined && paso.k === 'aplicar' ? paso.roles['source'] : undefined
}

// ─── La corrida: planificar y EMITIR, tick a tick ──────────────────────────

interface Corrida {
  /** Cuántas veces el mundo hizo NACER una pieza por rendimiento. */
  readonly aterrizajes: number
  /**
   * Cuántos `apply` se EMITIERON, que no es cuántas veces se pescó y hay que
   * decirlo: `extraccion` completa cada 1,5 s —treinta ticks a 20 Hz— y el `apply`
   * se emite todos los ticks para sostener el vuelo. Las veces que el proceso llegó
   * a COMPLETAR son `aterrizajes + no-pico`, y ése es el denominador honesto.
   * Confundir los dos es lo que hacía que la corrida del criterio se leyera como
   * «pescó 199 veces» cuando había pescado UNA.
   */
  readonly emitidas: number
  readonly rechazos: ReadonlyMap<string, number>
  /** A quién le apuntó el `source`, por id, con cuántas veces. */
  readonly fuentes: ReadonlyMap<string, number>
  readonly stockFinal: number
}

/**
 * Un bucle mínimo con la forma del de la mente: planificar con la vista de HOY,
 * emitir el `aplicar(extraccion)` que salga, y contar lo que el mundo contesta.
 *
 * ─── LO ÚNICO QUE ESTE BUCLE HACE Y LA MENTE NO ────────────────────────────
 *
 * Comerse la pieza. Y no es una comodidad: con el hueco (b) cerrado, `holding(tag:
 * carnoso)` queda CUMPLIDA en cuanto entra el primer pescado, así que sin comer el
 * bucle mide un solo aterrizaje y no dice nada sobre el segundo. Emitir `comer` no
 * lo sabe hacer el planificador —es otro hueco, medido en `ataque-al-reves`— así
 * que lo emite el test, con una intención del mundo y no con un atajo.
 */
function pescar(esquemas: readonly ConstructionSchema[], ticks: number, enElAgua: boolean, tambien?: readonly Body[]): Corrida {
  let w = escena({ enElAgua, ...(tambien === undefined ? {} : { tambien }) }).w
  const rechazos = new Map<string, number>()
  const fuentes = new Map<string, number>()
  let aterrizajes = 0
  let emitidas = 0

  for (let t = 0; t < ticks; t++) {
    const v = vistaDelPlan(w)
    const paso = pasoDeExtraccion(w, esquemas)
    let intencion
    if (paso === undefined || paso.k !== 'aplicar') {
      // Nada que aplicar: o la meta está cumplida —tiene el pescado— o no hay plan.
      // Si tiene algo carnoso agarrado, se lo come y vuelve a tener hambre.
      const bocado = v.self.holding.find((b) => nameOf(w.bodies.get(b.id)?.body ?? criatura('x', 0), PHYS).startsWith('pescado'))
      if (bocado === undefined) break
      intencion = eat({ by: ANA, seq: t }, bocado.id)
    } else {
      const roles = resolverTodos(paso.roles, v)
      if (roles === undefined) break
      const fuente = roles['source']
      if (fuente !== undefined) fuentes.set(fuente.id, (fuentes.get(fuente.id) ?? 0) + 1)
      const binds: RoleBinding[] = Object.keys(roles)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map((name) => ({ name, body: (roles[name] as BodyView).id }))
      intencion = apply({ by: ANA, seq: t }, w.phys, 'extraccion', binds)
      if (intencion !== undefined) emitidas++
    }
    const r = stepWorld(w, intencion === undefined ? [] : [intencion])
    for (const ev of r.events) {
      if (ev.k === 'nacio' && ev.por === 'rendimiento') aterrizajes++
      if (ev.k === 'rechazada') rechazos.set(ev.por, (rechazos.get(ev.por) ?? 0) + 1)
    }
    w = r.state
  }

  const o = orilla()
  const banco = w.bodies.get(idDePozo(o.cx, o.cy))
  return {
    aterrizajes,
    emitidas,
    rechazos,
    fuentes,
    stockFinal: banco === undefined ? 0 : qualityOf(banco.body, 'mass', PHYS),
  }
}

const cuenta = (m: ReadonlyMap<string, number>): string =>
  [...m]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, n]) => `${k}×${String(n)}`)
    .join(' · ') || '(ninguno)'

/** Una piedra de 2 kg: entra en la mano, tiene masa, y no es un pozo. */
function piedra(): Body {
  return cuerpoDe('piedra', 'piedra', 2, 'bloque')
}

// ════════════════════════════════════════════════════════════════════════════
// (a) EL HUECO DEL `source`, REPRODUCIDO Y CERRADO
// ════════════════════════════════════════════════════════════════════════════

describe('(a) el `source` de la extracción no es «cualquier cosa con masa»', () => {
  it('REPRODUCIDO: sin la condición, le tira la caña adentro de lo que tiene en la mano', () => {
    // La escena es la del bug: parada EN EL AGUA —que es donde la deja el propio
    // plan cuando el pozo es lo que persigue— con la caña y una piedra agarradas.
    // La piedra hace de lo que en la corrida real era el pescado: algo portátil, con
    // masa, en la misma celda mojada, y en la mano.
    const paso = pasoDeExtraccion(escena({ enElAgua: true, tambien: [piedra()] }).w, SIN_FILTRO)
    const fuente = fuenteDe(paso)
    const o = orilla()
    console.log(
      `\n── SIN \`roleNoDeLaMano\`: A QUIÉN LE APUNTA ${'─'.repeat(23)}\n` +
        `  parada en (${String(o.pozo.x)},${String(o.pozo.y)}), wet ` +
        `${num(celdaDecretada(o.dios, PHYS, o.pozo.x, o.pozo.y).wet)} · en la mano: cana, piedra\n` +
        `  el paso: ${JSON.stringify(paso)}\n`,
    )
    expect(fuente).toEqual({ k: 'id', id: 'piedra' })
  })

  it('CERRADO: con la condición, le apunta al banco que decretó el dios', () => {
    const paso = pasoDeExtraccion(escena({ enElAgua: true, tambien: [piedra()] }).w, ESQUEMAS)
    const o = orilla()
    console.log(`\n── CON \`roleNoDeLaMano\`: ${JSON.stringify(paso)}\n`)
    expect(fuenteDe(paso)).toEqual({ k: 'id', id: idDePozo(o.cx, o.cy) })
  })

  it('LAS DOS CONDICIONES HACEN FALTA: cada una tapa exactamente lo que la otra deja pasar', () => {
    // ─── LA TABLA QUE JUSTIFICA QUE LA FILA LLEVE DOS CAMPOS Y NO UNO ────────
    //
    // La escena tiene los DOS impostores posibles, y son impostores distintos a
    // propósito, porque cada condición atrapa a uno solo:
    //
    //   · LA PIEDRA de 2 kg EN LA MANO. Entra en una mano (`portable` 1) y está en
    //     la celda de la criatura, así que cuando pesca metida en el agua cumple
    //     `wet` igual que el banco. Sólo la caza `roleNoDeLaMano`.
    //   · EL LEÑO de 20 kg TIRADO EN LA ORILLA. No entra en una mano (`portable` 0)
    //     y tiene masa de sobra, así que pasa el filtro de cuerpo entero. Sólo lo
    //     caza `cellHints`.
    //
    // Y la posición de la criatura decide cuál de los dos gana el desempate por
    // cercanía, que es lo que hace que cada condición falle en una posición y no en
    // la otra. Sin las dos, hay siempre una posición en la que el plan sale verde y
    // el mundo contesta `sin-pozo`.
    const o = orilla()
    const banco = idDePozo(o.cx, o.cy)
    const casos: readonly { readonly nombre: string; readonly tabla: readonly ConstructionSchema[] }[] = [
      { nombre: 'la fila entera', tabla: ESQUEMAS },
      { nombre: 'sin `roleNoDeLaMano`', tabla: SIN_FILTRO },
      { nombre: 'sin `cellHints`', tabla: SIN_CELDA },
    ]
    const filas: string[] = []
    const salida = new Map<string, string>()
    for (const c of casos) {
      for (const enElAgua of [false, true]) {
        const paso = pasoDeExtraccion(escena({ enElAgua, tambien: [piedra()], conLeno: true }).w, c.tabla)
        const f = fuenteDe(paso)
        const quien = f === undefined ? '(sin paso)' : f.k === 'id' ? f.id : f.k
        salida.set(`${c.nombre}|${String(enElAgua)}`, quien)
        filas.push(`  ${c.nombre.padEnd(20)} ${(enElAgua ? 'en el agua' : 'en la orilla').padEnd(13)} → source = ${quien}`)
      }
    }
    console.log(
      [
        '',
        `── LAS DOS CONDICIONES, UNA POR VEZ ${'─'.repeat(30)}`,
        `  en la mano: cana + piedra de 2 kg · en la orilla: leño de 20 kg · en el agua: el banco`,
        ...filas,
        '',
      ].join('\n'),
    )

    // La fila entera acierta en las dos posiciones. Es lo único que hay que pedirle.
    expect(salida.get('la fila entera|false')).toBe(banco)
    expect(salida.get('la fila entera|true')).toBe(banco)
    // Sin `roleNoDeLaMano` falla EN EL AGUA y sólo ahí: la piedra viaja en la celda
    // de quien la lleva, así que cumple `wet` igual que el banco y encima le gana por
    // estar en la mano. Ése es, exactamente, el bug del criterio.
    expect(salida.get('sin `roleNoDeLaMano`|false')).toBe(banco)
    expect(salida.get('sin `roleNoDeLaMano`|true')).toBe('piedra')
    // Sin `cellHints` falla EN LA ORILLA y sólo ahí: el leño está tirado en el suelo
    // y no en la mano, así que la exclusión por tenencia no lo toca, y desde la
    // orilla está a cero celdas contra la una del banco.
    expect(salida.get('sin `cellHints`|false')).toBe('leno')
    expect(salida.get('sin `cellHints`|true')).toBe(banco)
  })

  it('`roleFilters` sigue vivo aunque ninguna fila lo use: una fila sintética lo prueba', () => {
    // ─── POR QUÉ ESTE TEST EXISTE ───────────────────────────────────────────
    //
    // `roleFilters` era de la fila de la pesca y se sacó, así que HOY NO LO USA
    // NINGUNA FILA (lo verifica `los-esquemas-contra-el-mundo.test.ts`). El campo
    // queda porque la distinción que encarna sigue siendo verdadera —lo que un
    // cuerpo tiene que SER y nadie fabrica no puede viajar en la firma, o el `gap`
    // le pide a la fragua del Hito 8 un proceso para volver liviano un tronco—, y
    // un mecanismo vivo sin un solo usuario es un mecanismo que se pudre en
    // silencio. Se prueba con una fila sintética que entra por `opciones.esquemas`,
    // que es entrada pública de `plan()` y es como la fragua va a escribir filas.
    //
    // Lo que NO cubre y hay que decirlo: la rama de SUMAR el `roleFilters` de la
    // fila con el `portable` del `arrangement` no tiene hoy ningún usuario donde
    // las dos estén presentes a la vez, así que está pinada por construcción
    // (`filtro` es una concatenación de dos arreglos en `regresion.ts`) y no por
    // una medición.
    const o = orilla()
    const conFiltroImposible: readonly ConstructionSchema[] = ESQUEMAS.map((e) =>
      e.establishes === 'holding(tag:carnoso)' && e.k === 'proceso'
        ? ({ ...e, roleFilters: { source: [{ q: 'mass', op: '>=', v: 1e6 }] } } as ConstructionSchema)
        : e,
    )
    // Con la fila entera el `source` es el banco; con un `roleFilters` que nadie
    // cumple, no hay candidato y el paso desaparece. La diferencia es el campo.
    expect(fuenteDe(pasoDeExtraccion(escena({ enElAgua: true }).w, ESQUEMAS))).toEqual({
      k: 'id',
      id: idDePozo(o.cx, o.cy),
    })
    expect(pasoDeExtraccion(escena({ enElAgua: true }).w, conFiltroImposible)).toBeUndefined()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// (b) LA META DE COMIDA, QUE NO SE DABA POR CUMPLIDA NUNCA
// ════════════════════════════════════════════════════════════════════════════

describe('(b) con algo carnoso en la mano, la meta de comida está cumplida', () => {
  it('CERRADO: el plan es vacío, y con la mano vacía el mismo mundo saca el plan entero', () => {
    // El pescado que se le pone en la mano es de la misma sustancia que el banco
    // rinde —`pescado`, del catálogo— y con la masa que rinde esta semilla.
    const conPescado = escena({ enElAgua: true, tambien: [cuerpoDe('pescado', 'pescado', 2.887, 'bloque')] }).w
    const r = plan(META, vistaDelPlan(conPescado), SIN_CORTE)
    expect(r.k).toBe('plan')
    expect(r.k === 'plan' ? r.steps : ['no es plan']).toEqual([])

    // El control: sin el pescado, la misma escena y la misma tabla sí planifican.
    // Sin esto, un plan vacío podría ser una búsqueda rota en vez de una meta hecha.
    const sinPescado = escena({ enElAgua: true }).w
    const r2 = plan(META, vistaDelPlan(sinPescado), SIN_CORTE)
    const pasos = r2.k === 'plan' ? r2.steps : []
    console.log(
      `\n── LA META, CON Y SIN PESCADO EN LA MANO ${'─'.repeat(26)}\n` +
        `  con pescado: ${r.k} con ${String(r.k === 'plan' ? r.steps.length : -1)} pasos\n` +
        `  sin pescado: ${r2.k} con ${String(pasos.length)} pasos → ` +
        `${pasos.map((s) => s.k).join(' · ')}\n`,
    )
    expect(pasos.some((s) => s.k === 'aplicar' && s.proceso === 'extraccion')).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// EL A/B QUE CUENTA LO QUE IMPORTA: CUÁNTAS EXTRACCIONES ATERRIZAN
// ════════════════════════════════════════════════════════════════════════════

describe('el bucle entero, corrido en el mundo: lo que despega contra lo que aterriza', () => {
  /**
   * 2000 ticks son 100 segundos de mundo a 20 Hz, o sea unas 66 aplicaciones de
   * `extraccion` —completa cada 1,5 s— si ninguna se rechaza. Es holgado y no es
   * arbitrario: alcanza para que el dado de la pesca se pronuncie muchas veces, y
   * es una fracción chica de los 6194 ticks que la criatura del criterio vivió.
   */
  const TICKS = 2000

  it('con la fila entera aterriza de verdad; con la fila mutilada, 0 de todos los intentos', () => {
    const bien = pescar(ESQUEMAS, TICKS, true, [piedra()])
    const mal = pescar(SIN_FILTRO, TICKS, true, [piedra()])
    console.log(
      `\n── ${String(TICKS)} TICKS, LA MISMA ESCENA, LA MISMA SEMILLA ${'─'.repeat(18)}\n` +
        `  CON la condición   ${String(bien.emitidas)} \`apply\` emitidos · ` +
        `completó ${String(bien.aterrizajes + (bien.rechazos.get('no-pico') ?? 0))} veces · ` +
        `${String(bien.aterrizajes)} ATERRIZAJES\n` +
        `                     rechazos: ${cuenta(bien.rechazos)}\n` +
        `                     le apuntó a: ${cuenta(bien.fuentes)}\n` +
        `                     el banco terminó con ${num(bien.stockFinal)} kg\n` +
        `  SIN la condición   ${String(mal.emitidas)} \`apply\` emitidos · ` +
        `completó ${String((mal.rechazos.get('sin-pozo') ?? 0) + (mal.rechazos.get('no-pico') ?? 0))} veces · ` +
        `${String(mal.aterrizajes)} ATERRIZAJES\n` +
        `                     rechazos: ${cuenta(mal.rechazos)}\n` +
        `                     le apuntó a: ${cuenta(mal.fuentes)}\n` +
        `                     el banco terminó con ${num(mal.stockFinal)} kg\n`,
    )

    // LO QUE HAY QUE PEDIRLE: que aterrice. Más de una vez, para que no sea suerte.
    expect(bien.aterrizajes).toBeGreaterThan(1)
    expect(bien.rechazos.get('sin-pozo') ?? 0).toBe(0)
    expect(bien.fuentes.has(idDePozo(orilla().cx, orilla().cy))).toBe(true)
    // Y el banco pagó lo que rindió: si el stock no bajara, los nacimientos no
    // saldrían del pozo y esto estaría midiendo otra cosa.
    expect(bien.stockFinal).toBeLessThan(129.915)

    // EL CONTROL NEGATIVO: la fila mutilada despega igual y no aterriza NUNCA, y el
    // mundo dice por qué con la misma palabra que dijo en la corrida del criterio.
    expect(mal.aterrizajes).toBe(0)
    expect(mal.rechazos.get('sin-pozo') ?? 0).toBeGreaterThan(50)
    expect(mal.fuentes.has('piedra')).toBe(true)
  }, 300_000)
})
