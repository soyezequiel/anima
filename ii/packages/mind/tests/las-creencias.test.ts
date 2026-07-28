// ─── LAS CREENCIAS, Y SOBRE TODO LA CLAVE ────────────────────────────────────
//
// La `ContextKey` es la decisión más cara de este módulo: es lo que decide cuánto
// GENERALIZA la criatura. Más fina, no aprende nunca; más gruesa, aprende mal. El
// encabezado de `src/creencias.ts` explica POR QUÉ salió como salió; este archivo
// mide QUÉ HACE, y lo mide contra el mundo de verdad —el dios, sus biomas, sus
// pozos— y no contra cuerpos de laboratorio.
//
// ─── EL CRITERIO, ESCRITO ANTES DE MEDIR ────────────────────────────────────
//
//   1. dos ríos DISTINTOS del MISMO bioma tienen que ser el mismo contexto, o la
//      criatura no aprende nada que le sirva dos veces;
//   2. lo que se pesca y lo que se ata y lo que se frota tienen que ser contextos
//      distintos, o la evidencia de uno envenena a los otros;
//   3. la evidencia propia tiene que poder DAR VUELTA al instinto, y cuántas
//      observaciones hacen falta es un número que hay que medir y publicar;
//   4. `tagsDe` tiene que devolver un orden total y estable;
//   5. dos criaturas con la misma historia tienen que tener las mismas creencias;
//   6. y hay que ir a buscar el colapso de causas que el propio proyecto le
//      reprochó al Beta, y decir cuál de las tres se distingue y cuáles no.
//
// Lo que este archivo NO hace: no le baja el listón a nada. El hueco que quedó
// abierto está en un `it.fails` con el porqué medido al lado, y los dos límites
// que la clave se come —la geografía y la oclusión— están medidos en verde,
// porque no son defectos de este módulo sino consecuencias de la clave elegida.

import { describe, expect, it } from 'vitest'

import {
  buildSeedPhysics,
  HZ_DE_REFERENCIA,
  qualityOf,
  T_AMBIENTE,
  unir,
  type Body,
  type Physics,
} from '@anima/physics'
import { AGUA_FRANCA } from '@anima/plan'
import { BIOMAS, dadoDelMundo, temperaturaDelBioma, type BiomaId } from '@anima/oracle'
import { Contexto, IndiceDelTick, LibroDeLugares, Partida, Proyeccion } from '@anima/perceive'
import {
  apply,
  celdaDecretada,
  crearDios,
  cuerpoDePozo,
  decretoDe,
  idDePozo,
  mapaDeActores,
  mapaDeCuerpos,
  stepWorld,
  type BodyId,
  type CellKey,
  type CellState,
  type EstadoDelDios,
  type Placement,
  type RoleBinding,
  type WorldBody,
  type WorldState,
} from '@anima/world'

import {
  contextoDe,
  Creencias,
  CUANTAS_FORMAS,
  INSTINTO,
  LUGARES,
  RASGOS,
  SIN_CUERPO,
} from '../src/creencias.js'
import { cuantasVeces, media, type ContextKey, type VistaDeLaMente } from '../src/tipos.js'

// ─── El banco ────────────────────────────────────────────────────────────────

const PHYS: Physics = buildSeedPhysics()
const ANA = 'ana'
/** La misma semilla que la pesca del Hito 5 y que los esquemas contra el mundo. */
const SEMILLA = 20260727n

const num = (v: number): string => v.toFixed(4).replace('.', ',')

function cuerpo(id: string, substance: string, mass: number, form: Body['form'] = 'vara'): Body {
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

function mundo(
  cuerpos: readonly WorldBody[],
  o: { dios?: EstadoDelDios; enMano?: readonly BodyId[] } = {},
): WorldState {
  const base: WorldState = {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos(cuerpos),
    actors: mapaDeActores([
      { id: ANA, body: `${ANA}-cuerpo`, holding: [...(o.enMano ?? [])], capacity: 6, permits: 'irreversible' },
    ]),
    cells: new Map<CellKey, CellState>(),
    nextId: 1,
  }
  return o.dios === undefined ? base : { ...base, dios: o.dios }
}

/**
 * La vista que ve la mente, armada con las piezas de producción y no con un
 * objeto literal: `Proyeccion` + `Contexto` son las mismas dos clases con las que
 * `Partida` le arma el `Ctx` a una habilidad en vuelo. O sea que lo que se mide
 * es exactamente lo que la criatura vería.
 */
function vistaDe(state: WorldState): VistaDeLaMente {
  const c = new Contexto(new Proyeccion(new IndiceDelTick(state)), {
    actor: ANA,
    rng: dadoDelMundo(0).tirar,
    lugares: new LibroDeLugares(),
  })
  return c.ctx
}

/** La vista con los cuerpos que el dios pone YA materializados. Ver `Partida`. */
function vistaConElDios(state: WorldState): VistaDeLaMente {
  const p = new Partida(state)
  const c = new Contexto(p.proyeccion, { actor: ANA, rng: p.dado.tirar, lugares: p.lugares })
  return c.ctx
}

// ─── Los ríos de la semilla, buscados y no inventados ───────────────────────

interface Rio {
  readonly cx: number
  readonly cy: number
  readonly at: Placement
  readonly bioma: BiomaId
  readonly id: BodyId
  /** Qué sustancia decreta el dios que sale de este pozo. */
  readonly rinde: string
}

/**
 * Barre chunks en orden canónico y devuelve TODOS los que tienen pozo en el
 * cuadrado de lado `2·radio+1`.
 *
 * El orden del barrido es total y no depende de nada más que de la semilla, así
 * que dos corridas encuentran los mismos ríos. Es el mismo barrido que usan
 * `world/tests/hito-5-la-pesca.test.ts` y
 * `plan/tests/los-esquemas-contra-el-mundo.test.ts`, con el radio abierto porque
 * acá hace falta encontrar pozos de MÁS DE UN bioma, y en 13×13 chunks los 1076
 * primeros son todos de `agua-dulce`.
 */
function buscarRios(dios: EstadoDelDios, radio: number): Rio[] {
  const out: Rio[] = []
  for (let cx = -radio; cx <= radio; cx++) {
    for (let cy = -radio; cy <= radio; cy++) {
      const dec = decretoDe(dios, PHYS, cx, cy)
      if (dec.pozo === undefined) continue
      out.push({
        cx,
        cy,
        at: dec.pozo.at,
        bioma: dec.chunk.bioma.id,
        id: idDePozo(cx, cy),
        rinde: dec.pozo.stock.yields,
      })
    }
  }
  if (out.length === 0) throw new Error('la semilla no tiene un solo pozo')
  return out
}

let diosMemo: EstadoDelDios | undefined
function dios(): EstadoDelDios {
  diosMemo ??= crearDios(SEMILLA)
  return diosMemo
}

let riosMemo: Rio[] | undefined
function rios(): readonly Rio[] {
  riosMemo ??= buscarRios(dios(), 20)
  return riosMemo
}

/** Un río por bioma, el primero del barrido canónico. */
function unoPorBioma(): ReadonlyMap<BiomaId, Rio> {
  const m = new Map<BiomaId, Rio>()
  for (const r of rios()) if (!m.has(r.bioma)) m.set(r.bioma, r)
  return m
}

/** La clave del pozo de este río, con la criatura parada encima del agua. */
function claveDelRio(r: Rio): ContextKey {
  const v = vistaConElDios(mundo([{ body: criatura(ANA, 1000), at: r.at }], { dios: dios() }))
  return contextoDe(v, r.id)
}

// ═══ (1) QUÉ SEPARA LA CLAVE, sobre la materia de la semilla ════════════════

describe('la clave: qué junta y qué separa', () => {
  it('ningún umbral de la clave está escrito en `creencias.ts`: los cinco se leen', () => {
    // Lo que ataja: que alguien escriba `0.8` a mano. Si el esquema de `catch>0`
    // cambiara lo que le pide al `binder`, la clave lo sigue sola; si alguien lo
    // transcribiera, el día que cambien las dos copias divergirían y nadie se
    // enteraría — que es el bug de `DSL_REFERENCE` de Ánima I.
    expect(RASGOS.length).toBe(5)
    expect(CUANTAS_FORMAS).toBe(32)
    // TRES lugares y no dos: los dos que separa `wet`, más la mano. El tercero no
    // salió de querer más resolución sino de un defecto medido —el lugar de un
    // cuerpo agarrado era el de los pies de quien lo agarraba, así que la misma
    // liana rendía `fibroso` en tierra y nada parada en el agua—. El porqué largo
    // está en `MANO`, y el parpadeo que esto mata está medido dos bloques abajo.
    expect(LUGARES).toEqual(['agua', 'mano', 'tierra'])
    console.log(
      `\n─── LOS CINCO RASGOS, Y DE DÓNDE SALE CADA UMBRAL ───\n` +
        RASGOS.map(
          (r) =>
            `  ${r.letra}  ${r.q.padEnd(12)} ${r.umbral.estricto ? '> ' : '>='} ${num(r.umbral.v).padEnd(8)} ` +
            `← ${r.umbral.de}\n       ${r.porque}`,
        ).join('\n') +
        `\n  lugar: wet >= ${num(AGUA_FRANCA)} ← el \`cellHints\` de la pesca en \`@anima/plan\`\n` +
        `  espacio de claves: ${String(LUGARES.length)} lugares × ${String(CUANTAS_FORMAS)} formas = ` +
        `${String(LUGARES.length * CUANTAS_FORMAS)} contextos\n`,
    )
    // Cada letra una sola vez, o dos rasgos escribirían en la misma posición y la
    // clave dejaría de ser legible sin dejar de compilar.
    expect(new Set(RASGOS.map((r) => r.letra)).size).toBe(RASGOS.length)
  })

  it('la materia de la semilla cae en contextos distintos según lo que se pueda hacer con ella', () => {
    // Cinco sustancias que el mundo deja tiradas, en una celda seca. Lo que se
    // afirma es que la clave las SEPARA — si la liana y la piedra cayeran en el
    // mismo contexto, la evidencia de deshilachar un matorral se le sumaría a la
    // creencia sobre las piedras.
    const at: Placement = { x: 0, y: 0 }
    const materia: readonly (readonly [string, string, number])[] = [
      ['pescado', 'pescado', 1],
      ['liana', 'liana', 0.2],
      ['madera', 'madera', 1],
      ['piedra', 'piedra', 1],
      ['hoja-seca', 'hoja-seca', 0.05],
    ]
    const cuerpos: WorldBody[] = [{ body: criatura(ANA, 1000), at }]
    for (const [id, sub, masa] of materia) cuerpos.push({ body: cuerpo(id, sub, masa), at })
    const v = vistaDe(mundo(cuerpos))

    const claves = new Map<string, ContextKey>()
    const filas: string[] = []
    for (const [id, sub, masa] of materia) {
      const k = contextoDe(v, id)
      claves.set(id, k)
      const b = cuerpos.find((c) => c.body.id === id)?.body
      if (b === undefined) throw new Error(`falta ${id}`)
      filas.push(
        `  ${id.padEnd(10)} ${k.padEnd(14)} ` +
          RASGOS.map((r) => `${r.q}=${num(qualityOf(b, r.q, PHYS))}`).join(' · ') +
          `  (${String(masa)} kg de ${sub})`,
      )
    }
    console.log(`\n─── LA MATERIA DE LA SEMILLA, EN CELDA SECA ───\n${filas.join('\n')}\n`)

    // Lo que se pesca, lo que se ata y lo que se frota son tres contextos.
    expect(claves.get('pescado')).not.toBe(claves.get('liana'))
    expect(claves.get('liana')).not.toBe(claves.get('madera'))
    // Y el leño no es la piedra, que es lo que compró el rasgo `e` (`arde`): sin
    // él los dos son «lo duro» y la criatura cree que de una piedra sale leña.
    expect(claves.get('madera')).not.toBe(claves.get('piedra'))
  })

  it('el mismo cuerpo en el agua y en la tierra son dos contextos', () => {
    // La otra mitad de la clave. Sin esto, «pescar» y «juntar del piso» serían la
    // misma creencia y el instinto del agua no podría existir.
    const r = rios()[0]
    if (r === undefined) throw new Error('no hay ríos')
    const seco = vistaDe(
      mundo([
        { body: criatura(ANA, 1000), at: { x: 0, y: 0 } },
        { body: cuerpo('p', 'pescado', 1), at: { x: 0, y: 0 } },
      ]),
    )
    const mojado = vistaConElDios(
      mundo([{ body: criatura(ANA, 1000), at: r.at }, { body: cuerpo('p', 'pescado', 1), at: r.at }], {
        dios: dios(),
      }),
    )
    const a = contextoDe(seco, 'p')
    const b = contextoDe(mojado, 'p')
    console.log(`\nel mismo pescado de 1 kg: en tierra «${a}», en el agua «${b}»\n`)
    expect(a).not.toBe(b)
    expect(b.startsWith('agua|')).toBe(true)
  })

  /**
   * LA REPARACIÓN DEL PARPADEO, medida por los dos lados.
   *
   * El defecto: `lugarDe` leía `qAt(b.at, 'wet')` y el `at` de un cuerpo EN UNA
   * MANO es el de quien lo lleva. O sea que la mitad izquierda de la clave —el
   * LUGAR— no hablaba del cuerpo: hablaba de dónde estaban los pies. El
   * adversario lo midió sobre la misma liana en la misma mano: `tierra|m-a-e`
   * pisando seco y `agua|m-a-e` pisando el río, con la mejor oportunidad de toda
   * la lista (valor 9,81) apareciendo y desapareciendo según la celda.
   *
   * Lo que se afirma acá es lo que hace falta y nada más: **el cuerpo agarrado
   * tiene UNA clave, la misma pise donde pise**, y esa clave no se pisa con las
   * de los cuerpos que están en el piso.
   */
  it('lo que está en una mano tiene UNA sola clave, pise donde pise quien lo lleva', () => {
    const r = rios()[0]
    if (r === undefined) throw new Error('no hay ríos')
    const seco: Placement = { x: 0, y: 0 }

    // La celda seca es un mundo SIN dios —igual que el bloque de arriba—: con el
    // dios puesto, el origen de esta semilla cae en agua franca, y entonces «seco»
    // no sería seco y el test no estaría midiendo lo que dice.
    const clave = (at: Placement, enLaMano: boolean, conDios: boolean): ContextKey => {
      const pez: WorldBody = enLaMano
        ? { body: cuerpo('p', 'pescado', 1), at, heldBy: ANA }
        : { body: cuerpo('p', 'pescado', 1), at }
      const w = mundo(
        [{ body: criatura(ANA, 1000), at }, pez],
        conDios
          ? enLaMano
            ? { dios: dios(), enMano: ['p'] }
            : { dios: dios() }
          : enLaMano
            ? { enMano: ['p'] }
            : {},
      )
      return contextoDe(conDios ? vistaConElDios(w) : vistaDe(w), 'p')
    }
    const enLaManoEnTierra = clave(seco, true, false)
    const enLaManoEnElAgua = clave(r.at, true, true)
    // Y el mismo pescado en el PISO, para que se vea que la otra mitad sigue viva.
    const enElPisoSeco = clave(seco, false, false)
    const enElPisoMojado = clave(r.at, false, true)

    console.log(
      '\n─── EL MISMO PESCADO DE 1 KG, EN CUATRO SITUACIONES ───\n' +
        `  en la mano, parada en tierra ... «${enLaManoEnTierra}»\n` +
        `  en la mano, parada en el agua .. «${enLaManoEnElAgua}»\n` +
        `  en el piso seco ................ «${enElPisoSeco}»\n` +
        `  en el piso mojado .............. «${enElPisoMojado}»\n`,
    )

    // LO QUE REPARA: en la mano no parpadea.
    expect(enLaManoEnElAgua).toBe(enLaManoEnTierra)
    expect(enLaManoEnTierra.startsWith('mano|')).toBe(true)
    // LO QUE NO ROMPE: en el piso el agua sigue separando, que es de lo que vive
    // la fila 1 del instinto (`agua|mc--e` → carnoso, el pozo).
    expect(enElPisoSeco).not.toBe(enElPisoMojado)
    expect(enElPisoMojado.startsWith('agua|')).toBe(true)
    // Y la mano no se confunde con ninguno de los dos.
    expect(enLaManoEnTierra).not.toBe(enElPisoSeco)
    expect(enLaManoEnTierra).not.toBe(enElPisoMojado)
  })

  it('un id que la vista ya no tiene cae en un contexto disjunto y no rompe el tick', () => {
    // Y de paso queda medida la consecuencia que `@anima/mind/oportunidades` ya
    // tiene pinada del otro lado: `contextoDe` sólo sabe contestar por CUERPOS,
    // así que una celda de agua sin nada adentro —que no es un cuerpo, porque
    // `wet` es campo de celda— resuelve acá y no produce ninguna oportunidad. El
    // río entra por el POZO, que sí es un cuerpo. Ver el encabezado de
    // `creencias.ts` para por qué no se cierra desde este lado.
    const v = vistaDe(mundo([{ body: criatura(ANA, 1000), at: { x: 0, y: 0 } }]))
    expect(contextoDe(v, 'un-cuerpo-que-no-existe')).toBe(SIN_CUERPO)
    expect(contextoDe(v, 'celda:6,0')).toBe(SIN_CUERPO)
    expect(new Creencias().tagsDe(SIN_CUERPO)).toEqual([])
  })
})

// ═══ (2) LA GENERALIZACIÓN: EL NÚMERO DEL TRAMO ════════════════════════════

describe('dos ríos, y qué se lleva la criatura de uno al otro', () => {
  it('dos ríos distintos del MISMO bioma son el mismo contexto: la creencia viaja', () => {
    // ─── EL CRITERIO, y por qué éste y no otro ──────────────────────────────
    //
    // «La criatura pesca en un río, camina a otro río del mismo bioma, y o bien
    // lleva su creencia o no.» Los dos ríos son POZOS DE VERDAD que el dios
    // decretó en dos chunks distintos de la semilla: distinta celda, distinto id
    // de cuerpo, distinta masa de banco. Si la clave llevara la celda, o el id, o
    // la masa exacta, esto saldría rojo.
    const primero = rios()[0]
    if (primero === undefined) throw new Error('no hay ríos')
    const mismos = rios().filter((r) => r.bioma === primero.bioma)
    const a = mismos[0]
    const b = mismos[1]
    if (a === undefined || b === undefined) throw new Error('la semilla no dio dos pozos del mismo bioma')

    const ka = claveDelRio(a)
    const kb = claveDelRio(b)

    // Y la consecuencia MEDIDA, que es lo que importa: pescar en A mueve la
    // creencia sobre B. Tres intentos, dos con suerte, como el ejemplo del
    // documento de arquitectura.
    const m = new Creencias()
    const antes = m.belief(kb, 'carnoso')
    m.observe(ka, 'carnoso', true)
    m.observe(ka, 'carnoso', true)
    m.observe(ka, 'carnoso', false)
    const despues = m.belief(kb, 'carnoso')

    console.log(
      `\n─── LA GENERALIZACIÓN, MEDIDA ───\n` +
        `  río A  chunk (${String(a.cx)},${String(a.cy)}) celda (${String(a.at.x)},${String(a.at.y)}) ` +
        `bioma ${a.bioma} · cuerpo ${a.id} · rinde ${a.rinde} → «${ka}»\n` +
        `  río B  chunk (${String(b.cx)},${String(b.cy)}) celda (${String(b.at.x)},${String(b.at.y)}) ` +
        `bioma ${b.bioma} · cuerpo ${b.id} · rinde ${b.rinde} → «${kb}»\n` +
        `  misma clave: ${ka === kb ? 'SÍ' : 'NO'}\n` +
        `  creencia sobre B antes de tocar A:            p=${num(media(antes))} n=${String(cuantasVeces(antes))}\n` +
        `  después de pescar 3 veces en A (2 de 3):      p=${num(media(despues))} n=${String(cuantasVeces(despues))}\n`,
    )

    expect(a.id).not.toBe(b.id)
    expect(ka).toBe(kb)
    expect(cuantasVeces(despues)).toBe(3)
    expect(media(despues)).not.toBe(media(antes))
  })

  it('EL PRECIO: dos ríos de biomas DISTINTOS también son el mismo contexto, y transfiere BIEN', () => {
    // ─── ESTO NO ES UN BONUS, ES LA FACTURA — Y HAY QUE MIRARLA ENTERA ─────
    //
    // La mente no ve el bioma, así que la creencia cruza de bioma. La pregunta
    // que decide si eso está mal no es «¿cruza?» sino «¿cruza bien?», y se
    // contesta mirando qué decreta el dios que sale de cada pozo: si dos biomas
    // rindieran tags distintos, la transferencia sería una mentira.
    //
    // MEDIDO sobre 41×41 chunks: los pozos de esta semilla salen en cuatro biomas
    // y los tres rendimientos son `pescado`, `molusco` y `carne` — los tres con el
    // tag `carnoso`. O sea que «del agua sale carne» vale en los cuatro, y una
    // clave que separara biomas habría partido la evidencia en cuatro montones
    // sin ganar nada.
    const porBioma = unoPorBioma()
    const filas = [...porBioma.entries()].map(([bioma, r]) => ({
      bioma,
      r,
      tags: [...(PHYS.substances.get(r.rinde)?.tags ?? [])].sort(),
      clave: claveDelRio(r),
    }))
    console.log(
      `\n─── EL PRECIO DE NO VER EL BIOMA ───\n` +
        filas
          .map(
            (f) =>
              `  ${f.bioma.padEnd(12)} chunk (${String(f.r.cx)},${String(f.r.cy)}) rinde ` +
              `${f.r.rinde.padEnd(9)} tags [${f.tags.join(', ')}] → «${f.clave}»`,
          )
          .join('\n') +
        `\n  claves distintas: ${String(new Set(filas.map((f) => f.clave)).size)} para ` +
        `${String(filas.length)} biomas con pozo\n`,
    )
    expect(porBioma.size).toBeGreaterThan(1)
    // Todos los pozos de la semilla rinden algo carnoso: la transferencia es sana.
    for (const f of filas) expect(f.tags).toContain('carnoso')
    // Y todos caen en la misma clave, que es el precio dicho con un número.
    expect(new Set(filas.map((f) => f.clave)).size).toBe(1)
  })

  it('la temperatura de celda habría separado los biomas, y NO es más estable que `wet`', () => {
    // El encabezado de `creencias.ts` deja `temperature` afuera de la clave y da
    // dos razones. Las dos, medidas:
    //
    //   (a) SÍ habría servido: los nueve biomas usan varias temperaturas
    //       decretadas distintas, o sea que como firma del lugar funcionaba. No se
    //       descartó por inútil: se descartó porque es GEOGRAFÍA y una creencia es
    //       sobre la FÍSICA (ver el test de arriba).
    //   (b) y NO habría sido más estable: `IndiceDelTick.celda` entrega la celda
    //       YA OCLUIDA, y la oclusión mueve las cuatro cualidades. Tapar la celda
    //       de un pozo con una piedra le mueve `wet` y lo saca del contexto
    //       «agua». Cualquier clave apoyada en cualquier cualidad de celda hereda
    //       ese hueco — o sea que la estabilidad no era el criterio.
    const temps = new Map<number, string[]>()
    for (const b of BIOMAS) {
      const t = temperaturaDelBioma(b)
      const ya = temps.get(t)
      if (ya === undefined) temps.set(t, [b.id])
      else ya.push(b.id)
    }
    const filas = [...temps.entries()]
      .sort(([x], [y]) => x - y)
      .map(([t, ids]) => `  ${String(t).padStart(3)} °C  ${ids.join(', ')}`)

    const r = rios()[0]
    if (r === undefined) throw new Error('no hay ríos')
    const destapado = mundo([{ body: criatura(ANA, 1000), at: r.at }], { dios: dios() })
    // Una losa de piedra TAPANDO la celda del pozo. `covering` es el campo de la
    // ley 12, y `armarOclusiones` lo lee para armar el mapa de oclusión del tick.
    const tapado = mundo(
      [
        { body: criatura(ANA, 1000), at: r.at },
        { body: cuerpo('losa', 'piedra', 5, 'bloque'), at: r.at, covering: r.id },
      ],
      { dios: dios() },
    )
    const vDestapado = vistaConElDios(destapado)
    const vTapado = vistaConElDios(tapado)
    const wetAbierto = vDestapado.qAt(r.at, 'wet')
    const wetTapado = vTapado.qAt(r.at, 'wet')
    const claveAbierta = contextoDe(vDestapado, r.id)
    const claveTapada = contextoDe(vTapado, r.id)

    console.log(
      `\n─── LA CUALIDAD DE CELDA QUE SE DEJÓ AFUERA ───\n` +
        `(a) los nueve biomas, por temperatura decretada:\n${filas.join('\n')}\n` +
        `(b) la celda del pozo, destapada y tapada con una losa de piedra:\n` +
        `      wet ${num(wetAbierto)} → ${num(wetTapado)}   ·   clave «${claveAbierta}» → «${claveTapada}»\n`,
    )
    // (a) separa: hay más de una temperatura entre los nueve biomas.
    expect(temps.size).toBeGreaterThan(1)
    // (b) y la oclusión se lleva puesta la clave, apoyada en `wet` o en lo que sea.
    expect(wetTapado).toBeLessThan(wetAbierto)
    expect(claveTapada).not.toBe(claveAbierta)
  })
})

// ═══ (3) LA EVIDENCIA PISA AL INSTINTO ═════════════════════════════════════

describe('la evidencia propia contra el instinto', () => {
  it('las cinco filas del instinto están puestas al nacer, y son cinco', () => {
    expect(INSTINTO.length).toBe(5)
    const m = new Creencias()
    const filas = INSTINTO.map(
      (i) =>
        `  ${i.ctx.padEnd(14)} → ${i.rinde.padEnd(8)} Beta(${String(i.prior.a)}, ${String(i.prior.b)}) ` +
        `p=${num(media(m.belief(i.ctx, i.rinde)))} n=${String(cuantasVeces(m.belief(i.ctx, i.rinde)))}`,
    )
    console.log(`\n─── EL INSTINTO, AL NACER ───\n${filas.join('\n')}\n`)
    // Lo que ataja: un prior de fuerza 4 —el Beta(2,2) del documento— haría que
    // una criatura recién nacida informara n=2 y que el `porque` de cada
    // oportunidad dijera «n=2» sin haber pescado nunca.
    for (const i of INSTINTO) expect(cuantasVeces(m.belief(i.ctx, i.rinde))).toBe(0)
    // Y ninguna es simétrica: un instinto que no se inclina es el prior llano.
    for (const i of INSTINTO) expect(media(i.prior)).not.toBe(0.5)
  })

  it('la fila del documento —«un cuerpo de agua rinde carnoso»— es la del pozo de verdad', () => {
    // El puente entre la tabla y el mundo. Si el pozo de la semilla no cayera en
    // la clave que la fila 1 nombra, el instinto sería una fila que no se activa
    // nunca y ningún test lo diría.
    const r = rios()[0]
    if (r === undefined) throw new Error('no hay ríos')
    const clave = claveDelRio(r)
    const m = new Creencias()
    console.log(
      `\nel pozo ${r.id} de la semilla cae en «${clave}» · instinto: ` +
        `${m.origenDe(clave, 'carnoso')} · p=${num(media(m.belief(clave, 'carnoso')))}\n`,
    )
    expect(INSTINTO.some((i) => i.ctx === clave && i.rinde === 'carnoso')).toBe(true)
    expect(m.origenDe(clave, 'carnoso')).toBe('instinto')
    expect(media(m.belief(clave, 'carnoso'))).toBeGreaterThan(0.5)
  })

  it('cuántas observaciones hacen falta para dar vuelta el instinto: MEDIDO', () => {
    // ─── EL NÚMERO QUE EL TRAMO PIDE ────────────────────────────────────────
    //
    // Se cuenta, no se calcula: se le da de comer fracasos a una fila que se
    // inclina al sí hasta que la media cruza el 0,5, y se informa en qué
    // observación pasó. Y lo mismo del otro lado con la fila que se inclina al no.
    const fuerte = INSTINTO.find((i) => media(i.prior) > 0.5)
    const negativa = INSTINTO.find((i) => media(i.prior) < 0.5)
    if (fuerte === undefined || negativa === undefined) {
      throw new Error('el instinto dejó de inclinarse para los dos lados: este test mide otra cosa')
    }

    function cuantasParaCruzar(ctx: ContextKey, tag: string, ok: boolean): { n: number; p: number } {
      const m = new Creencias()
      const arranque = media(m.belief(ctx, tag))
      for (let n = 1; n <= 64; n++) {
        m.observe(ctx, tag, ok)
        const p = media(m.belief(ctx, tag))
        if (arranque > 0.5 ? p < 0.5 : p > 0.5) return { n, p }
      }
      throw new Error(`${ctx}/${tag} no cruzó el 0,5 en 64 observaciones`)
    }

    const abajo = cuantasParaCruzar(fuerte.ctx, fuerte.rinde, false)
    const arriba = cuantasParaCruzar(negativa.ctx, negativa.rinde, true)

    // Y la otra mitad: la evidencia no BORRA el instinto, se le suma. Se ve en que
    // la misma cantidad de éxitos deja al contexto con instinto por encima del que
    // no lo tiene.
    const conInstinto = new Creencias()
    const sinInstinto = new Creencias()
    const virgen: ContextKey = 'tierra|-----'
    for (let k = 0; k < 3; k++) {
      conInstinto.observe(fuerte.ctx, fuerte.rinde, true)
      sinInstinto.observe(virgen, fuerte.rinde, true)
    }
    const pCon = media(conInstinto.belief(fuerte.ctx, fuerte.rinde))
    const pSin = media(sinInstinto.belief(virgen, fuerte.rinde))

    console.log(
      `\n─── LA EVIDENCIA CONTRA EL INSTINTO ───\n` +
        `  «${fuerte.ctx}» → ${fuerte.rinde}: arranca en p=${num(media(fuerte.prior))} y cruza el 0,5 ` +
        `con ${String(abajo.n)} fracaso(s) seguidos (p=${num(abajo.p)})\n` +
        `  «${negativa.ctx}» → ${negativa.rinde}: arranca en p=${num(media(negativa.prior))} y cruza el 0,5 ` +
        `con ${String(arriba.n)} éxito(s) seguidos (p=${num(arriba.p)})\n` +
        `  tres éxitos: con instinto p=${num(pCon)} · sin instinto p=${num(pSin)} — el prior se suma, no se borra\n`,
    )

    expect(abajo.n).toBeGreaterThan(0)
    expect(arriba.n).toBeGreaterThan(0)
    expect(pCon).toBeGreaterThan(pSin)
  })

  it('`seed` cambia el prior y NO toca la evidencia', () => {
    const m = new Creencias()
    const ctx: ContextKey = 'tierra|mc--e'
    m.observe(ctx, 'carnoso', true)
    m.observe(ctx, 'carnoso', false)
    expect(cuantasVeces(m.belief(ctx, 'carnoso'))).toBe(2)
    m.seed(ctx, 'carnoso', { a: 0.5, b: 1.5 }, 'instinto')
    // El prior cambió —la media se movió— y las dos observaciones siguen ahí.
    expect(cuantasVeces(m.belief(ctx, 'carnoso'))).toBe(2)
    expect(m.belief(ctx, 'carnoso')).toEqual({ a: 1.5, b: 2.5 })
  })

  it('el prior tiene que tener CERO observaciones propias detrás, o `seed` lanza', () => {
    const m = new Creencias()
    // El Beta(2,2) del documento de arquitectura, que con este contrato miente:
    // `cuantasVeces` da 2 y el `porque` de la oportunidad lo imprimiría.
    expect(() => m.seed('tierra|-----', 'carnoso', { a: 2, b: 2 }, 'modelo')).toThrow(/observaciones propias/)
    expect(() => m.seed('tierra|-----', 'carnoso', { a: 0, b: 2 }, 'modelo')).toThrow(/no es una Beta/)
  })

  it('el modelo siembra contextos NUEVOS y no habla por encima del instinto', () => {
    // La tercera fuente, con su regla ejecutable. No hay modelo hasta el Hito 8;
    // la regla se testea igual, porque una regla que sólo vive en un comentario no
    // es una regla.
    const m = new Creencias()
    const conInstinto = INSTINTO[0]
    if (conInstinto === undefined) throw new Error('no hay instinto')
    const antes = m.belief(conInstinto.ctx, conInstinto.rinde)
    m.seed(conInstinto.ctx, conInstinto.rinde, { a: 0.5, b: 1.5 }, 'modelo')
    expect(m.belief(conInstinto.ctx, conInstinto.rinde)).toEqual(antes)
    expect(m.origenDe(conInstinto.ctx, conInstinto.rinde)).toBe('instinto')
    // Y sobre un contexto que nadie tocó, sí manda.
    const nuevo: ContextKey = 'tierra|m-a--'
    m.seed(nuevo, 'fibroso', { a: 1.5, b: 0.5 }, 'modelo')
    expect(media(m.belief(nuevo, 'fibroso'))).toBe(0.75)
    expect(m.origenDe(nuevo, 'fibroso')).toBe('modelo')
  })
})

// ═══ (4) EL ORDEN Y LA REPRODUCIBILIDAD ════════════════════════════════════

describe('el orden es total y estable, y dos historias iguales dan creencias iguales', () => {
  it('`tagsDe` devuelve el mismo orden sin importar en qué orden llegó la evidencia', () => {
    // Lo que ataja: devolver el orden de inserción del `Map`. Con él, dos
    // criaturas que vivieron lo mismo en distinto orden listarían lo mismo
    // distinto — y `opportunities()` recorre esta lista para armar los `id` con
    // los que después desempata, o sea que el orden se propagaría a la decisión.
    const ctx: ContextKey = 'tierra|mc-re'
    const uno = new Creencias()
    const otro = new Creencias()
    const tags = ['vegetal', 'carnoso', 'fibroso', 'mineral', 'carbonoso']
    for (const t of tags) uno.observe(ctx, t, true)
    for (const t of [...tags].reverse()) otro.observe(ctx, t, true)
    expect(uno.tagsDe(ctx)).toEqual(otro.tagsDe(ctx))
    expect([...uno.tagsDe(ctx)]).toEqual(['carbonoso', 'carnoso', 'fibroso', 'mineral', 'vegetal'])
    // Y el orden es el de las unidades de código, no el del idioma del sistema
    // (`localeCompare` está prohibido por la regla 2).
    const copia = [...uno.tagsDe(ctx)]
    expect(copia).toEqual([...copia].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
  })

  it('preguntar no anota: `belief` sobre un contexto que nadie tocó no crea nada', () => {
    // Lo que ataja: que `opportunities()` —que pregunta por cada tag de cada
    // cuerpo a la vista— convierta la memoria en un registro de lo preguntado.
    const m = new Creencias()
    const antes = m.contextos().length
    for (let k = 0; k < 20; k++) m.belief('tierra|-----', 'carnoso')
    expect(m.contextos().length).toBe(antes)
    expect(m.tagsDe('tierra|-----')).toEqual([])
  })

  it('dos criaturas con la misma historia tienen exactamente las mismas creencias', () => {
    // La historia se arma con el MUNDO adelante: las claves salen de `contextoDe`
    // sobre los pozos de la semilla, no de literales.
    const historia: readonly (readonly [Rio, string, boolean])[] = [...unoPorBioma().values()].flatMap(
      (r, i) => [
        [r, 'carnoso', i % 2 === 0] as const,
        [r, 'fibroso', i % 3 === 0] as const,
      ],
    )

    function vivir(): Creencias {
      const m = new Creencias()
      for (const [r, tag, ok] of historia) m.observe(claveDelRio(r), tag, ok)
      return m
    }

    const a = vivir()
    const b = vivir()
    expect(historia.length).toBeGreaterThan(0)
    expect(a.contextos()).toEqual(b.contextos())
    for (const ctx of a.contextos()) {
      expect(a.tagsDe(ctx)).toEqual(b.tagsDe(ctx))
      for (const tag of a.tagsDe(ctx)) expect(a.belief(ctx, tag)).toEqual(b.belief(ctx, tag))
    }
    console.log(
      `\ndos criaturas, la misma historia de ${String(historia.length)} observaciones: ` +
        `${String(a.contextos().length)} contexto(s), creencias idénticas\n`,
    )
  })
})

// ═══ (5) EL COLAPSO DE CAUSAS ══════════════════════════════════════════════
//
// La prueba T2.4 de `docs/escalera-capacidades.md` lo dice con tres causas: «no
// pica», «no hay» y «se me rompió la herramienta». El apéndice del documento de
// arquitectura ya se lo había reprochado al Beta. Acá se mide cuál de las tres
// distingue este diseño y cuáles no, y las condiciones se arman en el mundo de
// verdad para que los `Motivo` que se comparan sean los del mundo.

interface Intento {
  readonly como: string
  /** Los motivos con los que el mundo rechazó, contados. Vacío = no rechazó. */
  readonly motivos: string
  /** ¿Salió algo carnoso? Es el único bit que `observe` sabe recibir. */
  readonly ok: boolean
}

/**
 * Un intento de pesca de verdad: se emite el mismo `apply` tick a tick y se mira
 * qué contesta el mundo. Es el mismo bucle que
 * `plan/tests/los-esquemas-contra-el-mundo.test.ts`.
 */
function pescar(como: string, gear: Body, source: BodyId, extra: readonly WorldBody[], ticks: number): Intento {
  const r = rios()[0]
  if (r === undefined) throw new Error('no hay ríos')
  const d = crearDios(SEMILLA)
  const cuerpos: WorldBody[] = [
    { body: criatura(ANA, 1000), at: r.at },
    { body: gear, at: r.at, heldBy: ANA },
    ...extra,
  ]
  let w = mundo(cuerpos, { dios: d, enMano: [gear.id] })
  const roles: RoleBinding[] = [
    { name: 'gear', body: gear.id },
    { name: 'source', body: source },
  ]
  const cuenta: Record<string, number> = {}
  let saco = false
  for (let t = 0; t < ticks && !saco; t++) {
    const i = apply({ by: ANA, seq: t }, w.phys, 'extraccion', roles)
    const paso = stepWorld(w, i === undefined ? [] : [i])
    for (const ev of paso.events) if (ev.k === 'rechazada') cuenta[ev.por] = (cuenta[ev.por] ?? 0) + 1
    w = paso.state
    const ana = w.actors.get(ANA)
    for (const id of ana?.holding ?? []) {
      const c = w.bodies.get(id)
      if (c === undefined || c.body.id === gear.id) continue
      for (const p of c.body.parts) {
        if ((w.phys.substances.get(p.substance)?.tags ?? []).includes('carnoso')) saco = true
      }
    }
  }
  return {
    como,
    motivos:
      Object.entries(cuenta)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, n]) => `${k}×${String(n)}`)
        .join(' ') || 'ninguno',
    ok: saco,
  }
}

/** La caña de verdad: vara de madera atada con una hebra de liana, sin rol `b`. */
function cana(id: string): Body {
  const c = unir(cuerpo('vara-de', 'madera', 1), undefined, cuerpo('hebra-de', 'liana', 0.2), PHYS, id)
  if (c === undefined) throw new Error('no se pudo atar la caña: `unir` cambió de forma')
  return c
}

describe('el colapso de causas: cuál de las tres distingue esta memoria', () => {
  it('«NO HAY» SÍ se distingue, y no por el Beta sino por la CLAVE', () => {
    // ─── LA MITAD BUENA, MEDIDA ─────────────────────────────────────────────
    //
    // El banco agotado se construye con `cuerpoDePozo` DEL MUNDO —la misma
    // función que `stepWorld` llama cada tick para resincronizar el cuerpo del
    // pozo con su stock, y cuyo propio comentario dice «cuando se lo vaciaron la
    // masa es cero»—. No se vacía un stock de verdad porque eso son miles de
    // ticks de dado; lo que se mide es la CLAVE del cuerpo que el mundo pone
    // cuando la población llega a cero, y ese cuerpo lo fabrica el mundo.
    //
    // Y el número que hace falta al lado, porque sin él esto parece trivial y no
    // lo es: `nutrition` y `fuelEnergy` son INTENSIVAS, así que el pozo vacío
    // sigue teniendo `nutrition = 8`. Sin el rasgo `m` —`mass > 0`, que es
    // literalmente lo que `extraccion` le pide al `source`— los dos pozos caían en
    // la misma clave. Se midió primero y se agregó el rasgo después.
    const r = rios()[0]
    if (r === undefined) throw new Error('no hay ríos')
    const d = crearDios(SEMILLA)
    const dec = decretoDe(d, PHYS, r.cx, r.cy)
    if (dec.pozo === undefined) throw new Error('el primer río perdió el pozo')

    const cuerpoLleno = cuerpoDePozo(r.id, dec.pozo.stock, 10)
    const cuerpoVacio = cuerpoDePozo(r.id, dec.pozo.stock, 0)
    const lleno = claveDelRio(r)
    const vacio = contextoDe(
      vistaDe(mundo([{ body: criatura(ANA, 1000), at: r.at }, { body: cuerpoVacio, at: r.at }], { dios: d })),
      r.id,
    )
    console.log(
      `\n─── «NO HAY», VISTO DESDE LA CLAVE ───\n` +
        `  el pozo con peces:  «${lleno}»   mass=${num(qualityOf(cuerpoLleno, 'mass', PHYS))} ` +
        `nutrition=${num(qualityOf(cuerpoLleno, 'nutrition', PHYS))}\n` +
        `  el pozo agotado:    «${vacio}»   mass=${num(qualityOf(cuerpoVacio, 'mass', PHYS))} ` +
        `nutrition=${num(qualityOf(cuerpoVacio, 'nutrition', PHYS))}  (mismo id ${r.id}, misma celda)\n` +
        `  wet de la celda: ${num(celdaDecretada(d, PHYS, r.at.x, r.at.y).wet)} contra el umbral ${num(AGUA_FRANCA)}\n`,
    )
    // La `nutrition` no distingue nada: es intensiva y no depende de la masa.
    expect(qualityOf(cuerpoVacio, 'nutrition', PHYS)).toBe(qualityOf(cuerpoLleno, 'nutrition', PHYS))
    // La clave sí.
    expect(vacio).not.toBe(lleno)
    // Y sigue estando en el agua: lo que cambió es la forma, no el lugar.
    expect(vacio.startsWith('agua|')).toBe(true)
    // Y el instinto del agua NO aplica al pozo vacío: la criatura no arranca
    // creyendo que de una masa de agua sin peces sale carne.
    const m = new Creencias()
    expect(media(m.belief(lleno, 'carnoso'))).toBeGreaterThan(0.5)
    expect(media(m.belief(vacio, 'carnoso'))).toBe(0.5)
    expect(m.origenDe(vacio, 'carnoso')).toBe('nadie')
  })

  it('el mundo SÍ distingue las causas, y lo dice con motivos distintos', () => {
    // La medición que le da sentido al `it.fails` de abajo: la información existe
    // y el mundo la entrega. `world/src/step.ts` declara CUATRO motivos de fracaso
    // de una extracción y escribe al lado por qué son cuatro —«las cuatro piden
    // decisiones OPUESTAS […] una criatura que no las pueda distinguir insiste
    // para siempre en un río muerto»—. Acá se provocan tres de los cuatro.
    const r = rios()[0]
    if (r === undefined) throw new Error('no hay ríos')
    const tres: readonly Intento[] = [
      // «no pica»: caña sana, pozo de verdad, y el dado que decide.
      pescar('no pica (caña sana, pozo de verdad)', cana('cana-1'), r.id, [], 40),
      // «no hay»: la misma caña sana apuntada a algo que no es un pozo. Es el
      // motivo `sin-pozo` del mundo: «no hay stock detrás de ese cuerpo».
      pescar('no hay (caña sana, apuntando a una piedra)', cana('cana-2'), 'piedra-suelta', [
        { body: cuerpo('piedra-suelta', 'piedra', 3, 'bloque'), at: r.at },
      ], 40),
      // «se me rompió»: el pozo de verdad y una vara pelada, que es el estado en
      // el que termina una caña cuya atadura se aflojó — deja de cumplir `catch>0`.
      pescar('se rompió (vara pelada, pozo de verdad)', cuerpo('vara-pelada', 'madera', 1), r.id, [], 40),
    ]
    console.log(
      `\n─── LAS CAUSAS, PREGUNTÁNDOLE AL MUNDO ───\n` +
        tres
          .map(
            (i) =>
              `  ${i.como.padEnd(42)} rechazos: ${i.motivos.padEnd(24)} ¿sacó algo carnoso? ${i.ok ? 'sí' : 'no'}`,
          )
          .join('\n') +
        `\n`,
    )
    // Tres condiciones, tres respuestas distintas del mundo.
    expect(new Set(tres.map((i) => i.motivos)).size).toBe(3)
    // Y las tres se resumen en el mismo bit para `observe`: ninguna sacó nada.
    expect(tres.every((i) => !i.ok)).toBe(true)
  })

  it.fails('«no pica» y «se me rompió» dan EXACTAMENTE la misma creencia', () => {
    // ─── EL HUECO, Y ESTÁ EN EL CONTRATO, NO EN ESTA CLASE ──────────────────
    //
    // POR QUÉ SIGUE ABIERTO: `AffordanceMemory.observe(ctx, rinde, ok: boolean)`
    // vive en `tipos.ts` —el contrato compartido, que este tramo no toca— y su
    // tercer parámetro es UN BIT. El test de arriba acaba de medir que el mundo
    // distingue las causas con motivos distintos (`no-pico` contra
    // `rol-no-cumple`); acá se ve que las dos entran por el mismo agujero de un
    // bit y salen indistinguibles.
    //
    // Y la clave tampoco puede ayudar en este par, a diferencia de «no hay»: la
    // clave describe el cuerpo AL QUE SE LE SACA algo —el pozo— y la caña gastada
    // es OTRO cuerpo, que no entra en la clave por ningún lado.
    //
    // LA CONSECUENCIA MEDIDA: las dos criaturas de abajo tendrían que hacer cosas
    // opuestas —la del pozo con suerte esquiva tiene que insistir, la de la caña
    // deshecha tiene que ir a atar otra— y la memoria les da el mismo número. Es
    // literalmente el control decisivo de T2.4: «mundo con el stock agotado y la
    // herramienta sana → NO la jubila».
    //
    // QUÉ COSTARÍA CERRARLO: `observe` tendría que llevar la causa (el `Motivo`
    // del mundo, que ya existe y ya distingue cuatro); el casillero pasaría de un
    // Beta a uno por causa; y `Opportunity.valor` tendría que componerlos, porque
    // «p» dejaría de ser un número. Es una decisión sobre `tipos.ts` y sobre la
    // forma de `Opportunity`, no sobre este archivo.
    const r = rios()[0]
    if (r === undefined) throw new Error('no hay ríos')
    const ctx = claveDelRio(r)

    const noPica = new Creencias()
    const rota = new Creencias()
    for (let k = 0; k < 6; k++) {
      noPica.observe(ctx, 'carnoso', false)
      rota.observe(ctx, 'carnoso', false)
    }
    // Los dos posteriores. Tendrían que decir cosas distintas y dicen la misma.
    expect(noPica.belief(ctx, 'carnoso')).not.toEqual(rota.belief(ctx, 'carnoso'))
  })
})
