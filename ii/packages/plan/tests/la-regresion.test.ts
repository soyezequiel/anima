// ─── LA REGRESIÓN — el peldaño D4, contra una vista de mentira ───────────────
//
//   pnpm --filter @anima/plan test
//
// SE TESTEA SIN MUNDO, Y ESO ES EL DISEÑO Y NO UN ATAJO. `plan()` no importa
// generadores, no ejecuta habilidades, no toca combustible y no simula el
// futuro: lee una vista y escribe una lista de `Step`. Si un día para probar una
// regresión hubiera que levantar un mundo, la noticia sería que el planificador
// dejó de ser una función de la vista — y eso es justo lo que el ADR II-0004
// prohíbe.
//
// LO QUE ESTE ARCHIVO PINA, Y POR QUÉ CADA COSA:
//
//   · LA PESCA ENTERA, paso por paso. Es el criterio del Hito 5 escrito en el
//     documento de arquitectura, y es el único test que dice si el paquete
//     sirve: si la caña sale de la aritmética, nadie tuvo que escribir «caña».
//   · EL ANYTIME, con el `toEqual` que no perdona: cortar en 1 y seguir 40 veces
//     tiene que dar EL MISMO objeto que una corrida sola. Si la frontera se
//     olvidara de un campo, este test se pone rojo y ningún otro lo haría.
//   · EL `gap`, que NO es un error: es un contrato recién nacido. Se le saca una
//     fila a la tabla y se mira qué dice que falta, con qué se puede hacer
//     mientras tanto, y por qué.
//   · EL ORDEN, con la tabla barajada. Un planificador cuyo plan depende del
//     orden del array de esquemas es un planificador no determinista, y no se
//     nota hasta que dos réplicas del mismo mundo divergen en el tick 400.
//   · LOS DOS CORTES QUE IMPIDEN QUE CUELGUE: el linaje del nodo —su propia pila
//     de marcos— y `PROFUNDIDAD_MAXIMA`, cada uno con su carnada.
//   · LA REGLA 2 sobre `src/`, porque este paquete nació sin guardián.
//
// Y hay una cosa que este archivo mide y NO le gusta al documento: la cadena
// canónica de la pesca no lleva `deshilachar`, y está escrita con el número al
// lado y con un `it.fails`. La otra —que el `nearest` mandaba a caminar hasta una
// vara para pescar adentro— dejó de pasar cuando el esquema de `extraccion`
// aprendió a pedirle agua a la celda del `source`.
//
// ─── VERIFICADO POR MUTACIÓN, NO POR LECTURA ────────────────────────────────
//
// Trece mutaciones sobre `regresion.ts`, una por invariante, cada una corrida
// entera. Las que encontraron un test que no existía están anotadas ARRIBA DEL
// TEST que salió de ellas, con la cuenta de cuántos seguían en verde:
//
//   · el desempate de la cola por contenido — 39/39 en verde sin él;
//   · la frontera acordándose de las ramas muertas — 40/40 en verde sin ella;
//   · y una que no era un test faltante sino un BUG: la firma vacía leída como
//     «no se entiende» en vez de «cero cláusulas», que rechazaba `union` entera
//     cada vez que se le pedía `catch>0` sin `reach>=2`.
//
// Las otras diez matan tests que ya estaban: el conjunto de cerrados (2), el
// tope de profundidad (1), el orden de roles por cantidad de candidatos (1), la
// cuenta de lo gastado (2), la cuenta de lo que ya está en la mano (2), la
// verificación del rol que paga (1), el rol opcional `b` (3), los roles iguales
// entre esquemas (1), el residuo extensivo (1), la ligadura diferida (6), los
// cerrados en la frontera (1) y el acumulado de expansiones (4).

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { QualityId, QualityTest } from '@anima/physics'
import { evalQuality, specOf } from '@anima/physics'
import type { BodyId, BodyView, Cell, CellQuality, Clock, SelfView, Where } from '@anima/skills'

import { ESQUEMAS, procesoDe } from '../src/esquemas.js'
import { plan } from '../src/regresion.js'
import { EXPANSIONES_POR_TICK, PROFUNDIDAD_MAXIMA } from '../src/tipos.js'
import type {
  ConstructionSchema,
  Frontera,
  GoalNode,
  PlanResult,
  Predicado,
  Step,
  VistaDelPlan,
} from '../src/tipos.js'

// ─── El mundito de mentira ──────────────────────────────────────────────────
//
// Un objeto literal de treinta líneas, porque `VistaDelPlan` es un subconjunto
// ESTRUCTURAL de `Ctx`. La única sutileza es `q`: contesta la `stamina` de la
// criatura desde `self.stamina`, que es exactamente lo que hace el `Ctx` de
// verdad —el campo está documentado como «atajo de `ctx.q(ctx.self,'stamina')`»—.
// Sin eso, el rol que paga nunca pasaría su verificación y no habría fuego.

type Cualidades = Partial<Record<QualityId, number>>

function cuerpo(id: string, x: number, y: number): BodyView {
  return { id, at: { x, y }, name: id, madeByMe: false, joints: [] }
}

/**
 * `portable` LA CONTESTA EL MOTOR, no el fixture.
 *
 * Desde que la regresión le agrega `portable > 0` a todo rol de un proceso con
 * `arrangement: held` —porque `take` rebota con `no-portable` y el plan mandaba
 * a levantar un tronco de 20 kg—, esta vista de mentira tiene que saber
 * contestarla. Se calcula con `specOf('portable').derived` y `evalQuality`, o sea
 * con la MISMA expresión del catálogo, para no escribir el tope de 8 kg una
 * segunda vez acá: si mañana el tope cambia, los tests cambian solos.
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

function criatura(o?: { at?: Cell; holding?: readonly BodyView[]; stamina?: number }): SelfView {
  return {
    id: 'yo',
    at: o?.at ?? { x: 0, y: 0 },
    name: 'criatura',
    madeByMe: false,
    joints: [],
    holding: o?.holding ?? [],
    capacity: 3,
    stamina: o?.stamina ?? 1000,
    permits: 'reversible',
  }
}

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

function vista(m: {
  self?: SelfView
  cuerpos?: readonly BodyView[]
  qs?: ReadonlyMap<BodyId, Cualidades>
  /**
   * Las celdas que son AGUA FRANCA. Sin esto no hay pozo, y no es un adorno del
   * arnés: el esquema de `extraccion` le pide a la celda del `source`
   * `wet >= 0.9`, porque `mass > 0` no distingue un banco de peces de un
   * pedrusco y el planificador elegía el pedrusco por estar más cerca. El
   * decreto del dios le da `wet = 1,0000` al agua franca y `0,6000` a la orilla
   * desde la que se pesca —medido en `los-esquemas-contra-el-mundo.test.ts`— así
   * que acá el agua vale 1 y todo lo demás 0.
   */
  mojadas?: readonly Cell[]
}): VistaDelPlan {
  const self = m.self ?? criatura()
  const cuerpos = m.cuerpos ?? []
  const mojadas = m.mojadas ?? []
  const qde = (b: BodyView, q: QualityId): number => {
    if (b.id === self.id && q === 'stamina') return self.stamina
    const puesta = m.qs?.get(b.id)?.[q]
    if (puesta !== undefined) return puesta
    return q === 'portable' ? portableDe(qde(b, 'mass')) : 0
  }
  return {
    see(w: Where): readonly BodyView[] {
      const out: BodyView[] = []
      for (const b of cuerpos) {
        let ok = true
        for (const t of w) {
          const v = qde(b, t.q)
          const pasa =
            t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
          if (!pasa) ok = false
        }
        if (ok) out.push(b)
      }
      return out
    },
    recall: () => [],
    q: qde,
    qAt: (at: Cell, q: CellQuality): number =>
      q === 'wet' && mojadas.some((c) => c.x === at.x && c.y === at.y) ? 1 : 0,
    self,
    clock: RELOJ,
  }
}

function meta(goal: Predicado): GoalNode {
  return { id: 'g0', goal, after: [], porque: 'test' }
}

const COMER: Predicado = { k: 'sostiene', tag: 'carnoso' }
const ARDER: Predicado = { k: 'cualidad', test: { q: 'temperature', op: '>=', v: 400 } }

/** Un presupuesto que no corta: los tests de contenido no son tests de corte. */
const SIN_CORTE = 500

// ─── Los dos escenarios del documento ───────────────────────────────────────

/**
 * «Tengo hambre, veo un río»: un matorral de liana a 2 celdas, una vara a 5, un
 * pozo a 8. Los números no son de fantasía —son los de las sustancias semilla—:
 * la liana tiene `flexibility` 0,90 y `tensile` 0,72, la madera 0,20 y 0,55, y
 * una vara de madera de 1 kg tiene `reach` 4 (medido en `hito-5-la-pesca`).
 *
 * El pozo lleva `mass: 50` porque es lo ÚNICO que `extraccion` le pide al rol
 * `source` en cualidades DE CUERPO, y eso sigue siendo un hueco del catálogo
 * dicho en `esquemas.ts`: el mundo distingue un banco de peces de un matorral
 * con el motivo `sin-pozo`, que no sale de ninguna cualidad. Acá el matorral
 * también tiene masa a propósito: si no la tuviera, el test estaría escondiendo
 * el problema en vez de medirlo.
 *
 * Y el pozo está EN EL AGUA, que es la mitad del hueco que sí se puede decir: el
 * esquema le pide a la celda del `source` `wet >= 0.9`. Sin eso, cualquier cosa
 * con masa más cerca que el río se llevaba el rol.
 */
function elRio(): VistaDelPlan {
  return vista({
    self: criatura(),
    cuerpos: [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0)],
    qs: new Map<BodyId, Cualidades>([
      ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
      ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
      ['pozo', { mass: 50 }],
    ]),
    mojadas: [{ x: 8, y: 0 }],
  })
}

/**
 * «Tengo frío y lo único que hay es un leño que no puedo encender.»
 *
 * Un solo cuerpo, y ahí está toda la gracia: `friccion` necesita DOS cosas
 * rígidas y sólo hay una, así que la segunda tiene que salir de la primera. Los
 * números son los de la madera medidos en `el-fuego.test.ts`: 1 kg de madera son
 * 1,70 de `heatCapacity`, y encender eso cuesta 1870 de aliento sobre un tanque
 * que topa en 1000. O sea que NO SE PUEDE, y la aritmética lo sabe sin que nadie
 * escriba «yesca».
 */
function elLeno(stamina = 1000): VistaDelPlan {
  return vista({
    self: criatura({ stamina }),
    cuerpos: [cuerpo('leno', 3, 0)],
    qs: new Map<BodyId, Cualidades>([
      ['leno', { rigidity: 0.7, heatCapacity: 1.7, tensile: 0.55, flexibility: 0.2, mass: 1, temperature: 15 }],
    ]),
  })
}

function pasosDe(r: PlanResult): readonly Step[] {
  if (r.k !== 'plan') throw new Error(`se esperaba un plan y salió ${r.k}`)
  return r.steps
}

/** La forma corta de un paso, para leer un plan de un vistazo en el diff. */
function resumir(pasos: readonly Step[]): readonly string[] {
  return pasos.map((s) => {
    switch (s.k) {
      case 'ir':
        return `ir(${nombreDeRef(s)})`
      case 'sostener':
        return `sostener(${refCorto(s.que)})`
      case 'unir':
        return `unir(binder=${refCorto(s.binder)}, a=${refCorto(s.a)}${s.b === undefined ? '' : `, b=${refCorto(s.b)}`})`
      case 'deshilachar':
        return `deshilachar(${refCorto(s.fuente)}, ${String(s.cuantas)})`
      case 'frotar':
        return `frotar(a=${refCorto(s.a)}, b=${refCorto(s.b)}, hasta=${String(s.hasta ?? 0)})`
      case 'aplicar':
        return `aplicar(${s.proceso})`
      default:
        return s.k
    }
  })
}

function nombreDeRef(s: Extract<Step, { k: 'ir' }>): string {
  return refCorto(s.a)
}

function refCorto(r: { readonly k: string } & Record<string, unknown>): string {
  if (r.k === 'id') return String(r['id'])
  if (r.k === 'rinde') return 'lo-que-hice'
  if (r.k === 'yo') return 'yo'
  return r.k
}

// ─── (1) La pesca entera ────────────────────────────────────────────────────

describe('la pesca entera, que es el criterio del Hito 5', () => {
  it('de «tener algo carnoso en la mano» sale una caña, y nadie escribió «caña»', () => {
    const r = plan(meta(COMER), elRio(), SIN_CORTE)
    expect(resumir(pasosDe(r))).toEqual([
      // Primero se FABRICA y después se liga lo que queda: ver el test de más
      // abajo sobre por qué el orden inverso manda a pescar adentro de la caña.
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(binder=matorral, a=vara)',
      'ir(pozo)',
      'aplicar(extraccion)',
    ])
  })

  it('el `unir` va SIN el rol opcional `b`, que es la caña entera', () => {
    // Con `b` el atador se gasta como `Joint.via`, no queda hebra, no queda punta
    // libre y `catch` da CERO —medido en `esquemas.ts`, `PUENTES`—. O sea: con `b`
    // lleno el plan sale verde y la caña no engancha nada. La ausencia se
    // verifica sobre la CLAVE y no sobre el valor: con
    // `exactOptionalPropertyTypes`, «ausente» y «presente y `undefined`» son dos
    // cosas, y la que hay que pinar es la primera.
    const unir = pasosDe(plan(meta(COMER), elRio(), SIN_CORTE)).find((s) => s.k === 'unir')
    expect(unir).toBeDefined()
    expect(unir !== undefined && 'b' in unir).toBe(false)
  })

  it('el `gear` de la extracción es un rendimiento diferido y no un id: la caña TODAVÍA NO EXISTE', () => {
    // Es el ADR 0082 de Ánima I portado. `union` con `yield: join` consume la
    // vara y la liana y crea un cuerpo con id NUEVO (`world/src/step.ts`), así
    // que nombrar la caña por id sería nombrar algo que no existe cuando el plan
    // se arma. Sin `{k:'rinde'}` el tercer paso de cualquier cadena se cae — el
    // bug exacto que el 0082 arregló.
    const pasos = pasosDe(plan(meta(COMER), elRio(), SIN_CORTE))
    const unir = pasos.find((s) => s.k === 'unir')
    const extraer = pasos.find((s) => s.k === 'aplicar')
    // La llave del rendimiento es CONTENIDO —qué establece y por qué camino de
    // roles se llegó hasta él— y no un contador ni una profundidad. La
    // profundidad no alcanza y está medido: cuando dos marcos hermanos a la misma
    // altura establecen la misma firma —los dos rígidos que `friccion` necesita—
    // rendían bajo la misma llave y el plan frotaba la hebra contra sí misma.
    expect(unir?.rinde).toBe('catch>0&reach>=2@./gear')
    expect(extraer?.roles['gear']).toEqual({ k: 'rinde', de: 'catch>0&reach>=2@./gear' })
  })

  it('NO manda a pescar adentro de la caña, y sin la cuenta de lo gastado lo haría', () => {
    // `extraccion` le pide al rol `source` `mass > 0` y NADA MÁS. El matorral
    // tiene masa 3 y está a 2 celdas; el pozo tiene 50 y está a 8. Por cercanía
    // gana el matorral —y el matorral es lo que el paso anterior convirtió en
    // caña—. Lo único que lo impide es que el plan lleve la cuenta de lo que ya
    // se comió: `union` consume `a`, `b` y `via`.
    const pasos = pasosDe(plan(meta(COMER), elRio(), SIN_CORTE))
    const extraer = pasos.find((s) => s.k === 'aplicar')
    expect(extraer?.roles['source']).toEqual({ k: 'id', id: 'pozo' })
  })

  it('cuesta 6 expansiones, que entran de sobra en el presupuesto de un tick', () => {
    const r = plan(meta(COMER), elRio(), SIN_CORTE)
    expect(r.expansiones).toBe(6)
    expect(r.expansiones).toBeLessThanOrEqual(EXPANSIONES_POR_TICK)
    // Y con el presupuesto de un tick, de una sola vez, ya sale entero.
    expect(plan(meta(COMER), elRio(), EXPANSIONES_POR_TICK)).toEqual(r)
  })

  it.fails('la cadena del documento lleva `deshilachar` y ésta no — y no es un bug de la búsqueda', () => {
    // El documento escribe:
    //   PLAN: [ir(matorral), deshilachar, ir(vara), tomar, unir, ir(río), extraer]
    // y acá el `deshilachar` no aparece NUNCA para hacer un atador. La razón está
    // medida en el test de abajo, no supuesta: el esquema de `flexibility>=0.8`
    // por `deshilachar` le pide al `source` EXACTAMENTE lo mismo que `union` le
    // pide al `binder`, porque `flexibility` es INTENSIVA y deshilachar no la
    // fabrica —lo dice el propio encabezado de esa fila—. Entonces todo cuerpo
    // que se puede deshilachar para hacer un atador YA ES un atador, y la regla
    // «lo que ya se cumple no se planifica» lo liga derecho.
    //
    // Se deja rojo y no se arregla acá porque el arreglo no es del planificador:
    // o `deshilachar` establece algo que hoy no declara —que la hebra es LIVIANA
    // y CORTA, que es lo que de verdad la distingue de un matorral entero— o la
    // fila del esquema miente. Las dos cosas viven en `esquemas.ts`.
    expect(resumir(pasosDe(plan(meta(COMER), elRio(), SIN_CORTE)))).toContain('deshilachar(matorral, 1)')
  })

  it('y el porqué, medido: para deshilachar un atador ya hay que tener un atador', () => {
    // Las dos exigencias, calculadas del catálogo y de la tabla, sin números
    // escritos a mano. Si algún día `deshilachar` deja de pedirle flexibilidad a
    // la fuente, este test se pone rojo y el `it.fails` de arriba se pone verde:
    // los dos son el mismo hallazgo mirado de los dos lados.
    expect(exigenciaDe('union', 'binder', ['catch>0', 'reach>=2'])).toEqual(
      exigenciaDe('deshilachar', 'source', ['flexibility>=0.8']),
    )
  })
})

/**
 * Lo que un proceso Y sus esquemas le exigen a un rol, calculado en el test por
 * un camino independiente del de `regresion.ts`.
 *
 * Independiente a propósito: si el test llamara a la función del módulo, estaría
 * comprobando que el módulo coincide consigo mismo. Acá se junta a mano lo que
 * declara `Process.roles` con lo que declaran las `roleHints`, se ordena, y se
 * compara.
 */
function exigenciaDe(via: string, rol: string, firmas: readonly string[]): readonly string[] {
  const p = procesoDe(via)
  const tests: QualityTest[] = []
  for (const r of p.roles) if (r.name === rol) for (const t of r.where) tests.push(t)
  for (const f of firmas) {
    const e = ESQUEMAS.find((x) => x.establishes === f && x.via === via)
    if (e === undefined) throw new Error(`no hay esquema «${f}» por «${via}»`)
    for (const t of e.roleHints[rol] ?? []) tests.push(t)
  }
  const textos = tests.map((t) => `${t.q}${t.op}${String(t.v)}`)
  return [...new Set(textos)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

// ─── (2) El fuego: la yesca sale sola ───────────────────────────────────────

describe('el fuego con un leño que no se puede encender', () => {
  it('la regresión deshilacha el leño y frota la hebra CONTRA el leño', () => {
    // Nadie escribió «yesca». El esquema puente dice que `deshilachar` fabrica
    // cosas livianas, `friccion` pide que lo que calienta tenga `heatCapacity`
    // bajo, y de esas dos filas sale una hebra. El `b` de la fricción sigue
    // siendo el leño porque `split` NO consume: el `resto` vuelve al mundo con el
    // mismo id (`world/src/step.ts`, caso `'split'`).
    const pasos = pasosDe(plan(meta(ARDER), elLeno(), SIN_CORTE))
    expect(resumir(pasos)).toEqual([
      'ir(leno)',
      'sostener(leno)',
      'deshilachar(leno, 1)',
      'frotar(a=lo-que-hice, b=leno, hasta=400)',
    ])
  })

  it('el `hasta` sale del predicado que se persigue y no del punto de ignición', () => {
    // Sin esto, `frotar` cae en su valor por defecto —`ignitionPoint` del cuerpo—
    // que es OTRO número: lo que `friccion` promete es 400, y a 400 llega
    // empujando. Dejar que se confundan hace frotar de menos o de más según qué
    // se agarró.
    const frotar = pasosDe(plan(meta(ARDER), elLeno(), SIN_CORTE)).find((s) => s.k === 'frotar')
    expect(frotar?.hasta).toBe(400)
  })

  it('sin aliento no se planifica el fuego: el rol que paga se verifica contra la criatura', () => {
    // `deshilachar` le pide al que paga `stamina >= 3`. Con 2 no hay yesca, y sin
    // yesca no hay nada que se pueda calentar. El rol que paga no se busca entre
    // los cuerpos: se descubre leyendo de dónde sale la `stamina` en los efectos
    // del proceso, y se verifica contra `self`. Es medio hueco menos de los que
    // `esquemas.ts` dejó anotados.
    const r = plan(meta(ARDER), elLeno(2), SIN_CORTE)
    expect(r.k).toBe('gap')
    if (r.k === 'gap') expect(r.why).toContain('stamina>=3')
  })

  it('y con aliento de sobra el mismo mundo sí planifica', () => {
    // El control. Sin él, el test de arriba pasaría también si la vista estuviera
    // rota de cualquier otra forma.
    expect(plan(meta(ARDER), elLeno(1000), SIN_CORTE).k).toBe('plan')
  })
})

// ─── (3) Lo que ya se cumple no se planifica ────────────────────────────────

describe('la regla 6', () => {
  it('con algo ya ardiendo a la vista, el plan es vacío y no de cinco pasos', () => {
    const ardiendo = vista({
      self: criatura(),
      cuerpos: [cuerpo('brasa', 1, 0)],
      qs: new Map<BodyId, Cualidades>([['brasa', { temperature: 700, rigidity: 0.7, heatCapacity: 0.2 }]]),
    })
    // DOS expansiones y no una, y el número dice algo: la primera mira y
    // descubre que ya está; la segunda saca de la cola el nodo terminal. El
    // terminal no se devuelve en el momento de armarlo —se lo mete en la cola y
    // se lo saca por costo como a cualquier otro— porque si no, el PRIMER plan
    // encontrado ganaría sobre uno más barato que ya estaba esperando, y encima
    // el corte por presupuesto caería en un lugar distinto según qué rama se
    // estaba mirando. Dos expansiones es el precio de ese uniforme.
    const r = plan(meta(ARDER), ardiendo, SIN_CORTE)
    expect(r).toEqual({ k: 'plan', steps: [], expansiones: 2 })
  })

  it('y una expansión no es cero: mirar cuesta, y el presupuesto lo cobra', () => {
    // El corte por presupuesto es UNIFORME: no hay atajo antes del bucle. Un
    // presupuesto de cero devuelve `parcial` incluso para una meta ya cumplida, y
    // eso es coherente con «el presupuesto se mide en expansiones». Si un día
    // molesta, se cambia acá y no en cinco llamadores.
    const ardiendo = vista({
      self: criatura(),
      cuerpos: [cuerpo('brasa', 1, 0)],
      qs: new Map<BodyId, Cualidades>([['brasa', { temperature: 700 }]]),
    })
    expect(plan(meta(ARDER), ardiendo, 0).k).toBe('parcial')
  })

  it('lo que ya está en la mano no se va a buscar', () => {
    // `enMano` arranca con `self.holding`, así que ni `ir` ni `sostener`.
    const leno = cuerpo('leno', 3, 0)
    const v = vista({
      self: criatura({ holding: [leno] }),
      cuerpos: [leno],
      qs: new Map<BodyId, Cualidades>([
        ['leno', { rigidity: 0.7, heatCapacity: 1.7, tensile: 0.55, mass: 1 }],
      ]),
    })
    expect(resumir(pasosDe(plan(meta(ARDER), v, SIN_CORTE)))).toEqual([
      'deshilachar(leno, 1)',
      'frotar(a=lo-que-hice, b=leno, hasta=400)',
    ])
  })
})

// ─── (4) El anytime, que es el test que no perdona ──────────────────────────

/**
 * Corre la búsqueda de a `presupuesto` expansiones hasta que deje de ser
 * `parcial`, y devuelve el resultado final más cuántas llamadas hicieron falta.
 *
 * El tope de vueltas no es paranoia: si el `parcial` devolviera una frontera que
 * no avanza, esto sería un `while (true)` adentro de un test, o sea una suite
 * colgada sin mensaje. Con el tope, se rompe diciendo qué pasó.
 */
function aTirones(
  g: GoalNode,
  v: VistaDelPlan,
  presupuesto: number,
  opciones?: { readonly esquemas?: readonly ConstructionSchema[] },
): { readonly r: PlanResult; readonly vueltas: number } {
  let frontera: Frontera | undefined
  for (let i = 1; i <= 500; i++) {
    const r: PlanResult = plan(g, v, presupuesto, frontera, opciones)
    if (r.k !== 'parcial') return { r, vueltas: i }
    if (r.frontera.abiertos.length === 0) throw new Error('un `parcial` sin nodos abiertos no puede seguir')
    frontera = r.frontera
  }
  throw new Error('500 llamadas y la búsqueda no terminó: la frontera no avanza')
}

describe('el anytime', () => {
  it('la pesca cortada de a UNA expansión converge al mismo plan que de una sola vez', () => {
    // El `toEqual` es contra el resultado ENTERO, `expansiones` incluido. Si la
    // frontera se olvidara de un campo —los cerrados, los muertos, las manos, lo
    // gastado— el plan reanudado sería otro, o costaría otro número, y esto se
    // pondría rojo. Ningún otro test de este archivo lo haría.
    const deUna = plan(meta(COMER), elRio(), SIN_CORTE)
    const { r, vueltas } = aTirones(meta(COMER), elRio(), 1)
    expect(r).toEqual(deUna)
    // Seis expansiones son seis llamadas de a una: no hay ninguna que se cuele.
    expect(vueltas).toBe(6)
  })

  it('el fuego también, y también el `gap`', () => {
    expect(aTirones(meta(ARDER), elLeno(), 1).r).toEqual(plan(meta(ARDER), elLeno(), SIN_CORTE))
    const sinPuente = ESQUEMAS.filter((e) => e.establishes !== 'catch>0')
    expect(aTirones(meta(COMER), elRio(), 1, { esquemas: sinPuente }).r).toEqual(
      plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: sinPuente }),
    )
  })

  it('una rama que murió en el tick 2 sigue contando en el `gap` del tick 4', () => {
    // ─── EL TEST QUE FALTABA, Y SE SUPO POR MUTACIÓN ────────────────────────
    //
    // `Frontera` lleva un campo `muertos` y hay que probar que hace falta.
    // Borrándolo —o sea, arrancando cada llamada con la lista vacía— los 40
    // tests seguían en verde, porque en todos los escenarios de arriba la única
    // rama que muere lo hace en la MISMA llamada en que se vacía la cola. El
    // olvido no se notaba.
    //
    // Acá mueren dos ramas en momentos distintos: una barata (una vía que pide
    // un filo que nadie establece, 1 s) en la expansión 2, y una cara (la caña
    // sin el puente de `catch`, 2,5 s) en la 4. El `gap` reporta la MÁS BARATA
    // —lo primero que la búsqueda hubiera querido hacer— así que si la primera
    // se olvida entre tick y tick, el `gap` cambia de dueño.
    const dosMuertes: readonly ConstructionSchema[] = [
      ...ESQUEMAS.filter((e) => e.establishes !== 'catch>0'),
      comoEnLaTabla('holding(tag:carnoso)', 'union', {
        a: [{ q: 'sharpness', op: '>=', v: 0.99 }],
        binder: [],
      }),
    ]
    const deUna = plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: dosMuertes })
    expect(deUna.k).toBe('gap')
    if (deUna.k === 'gap') expect(deUna.missing).toBe('sharpness>=0.99')
    expect(aTirones(meta(COMER), elRio(), 1, { esquemas: dosMuertes }).r).toEqual(deUna)
  })

  it('cortar de a 2, 3, 5 y 64 da lo mismo que no cortar', () => {
    // El corte no puede depender de DÓNDE cayó. Con un solo tamaño de tirón
    // podría pasar que el único punto de corte probado fuera inofensivo.
    const deUna = plan(meta(COMER), elRio(), SIN_CORTE)
    for (const p of [2, 3, 5, EXPANSIONES_POR_TICK]) {
      expect(aTirones(meta(COMER), elRio(), p).r, `cortando de a ${String(p)}`).toEqual(deUna)
    }
  })

  it('un presupuesto chico devuelve `parcial` con la frontera adentro', () => {
    const r = plan(meta(COMER), elRio(), 2)
    expect(r.k).toBe('parcial')
    if (r.k !== 'parcial') return
    expect(r.expansiones).toBe(2)
    expect(r.frontera.expansiones).toBe(2)
    expect(r.frontera.abiertos.length).toBeGreaterThan(0)
    // Y el LINAJE viaja adentro de cada nodo abierto, que es donde vive desde que
    // el corte de ciclos dejó de ser una lista global: la pila de marcos del nodo
    // dice qué firmas se abrieron para llegar hasta él. Sin eso, el tramo
    // siguiente volvería a abrir lo que ya se abrió y el ciclo dejaría de estar
    // cortado.
    expect(
      r.frontera.abiertos.some((n) => n.marcos.some((m) => m.establece === 'holding(tag:carnoso)')),
    ).toBe(true)
  })

  it('el `expansiones` que devuelve el plan es el ACUMULADO, no el del último tirón', () => {
    // Si fuera el del último tirón, el `toEqual` de arriba habría que aflojarlo —
    // y aflojar el test es exactamente lo que no se hace acá.
    const { r } = aTirones(meta(COMER), elRio(), 1)
    expect(r.expansiones).toBe(6)
  })
})

// ─── (5) El `gap` ───────────────────────────────────────────────────────────

describe('el `gap`, que no es un error sino un contrato recién nacido', () => {
  const sinPuente = ESQUEMAS.filter((e) => e.establishes !== 'catch>0')

  it('sin el puente de `catch>0` falta exactamente lo que el documento dice que falta', () => {
    // El documento escribe `{ gap: 'catch>0 & reach>=2', ... }`. La firma
    // canónica no lleva espacios y ordena las cláusulas, así que sale
    // `catch>0&reach>=2`: el mismo predicado, normalizado.
    const r = plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: sinPuente })
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.missing).toBe('catch>0&reach>=2')
  })

  it('el `why` nombra la cláusula huérfana antes que la mecánica de la búsqueda', () => {
    // «ningún proceso conocido establece enganche», que es lo que el Hito 8 le
    // lleva a la fragua. Lo mecánico —que la regresión intentó pedirle el
    // `catch` prestado a la vara y volvió al mismo pedido— va después del guion,
    // porque sin eso alguien podría creer que ni se intentó.
    const r = plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: sinPuente })
    if (r.k !== 'gap') throw new Error('se esperaba un gap')
    expect(r.why).toContain('ningún esquema conocido establece «catch>0»')
    expect(r.why).toContain('«reach>=2» sí tiene esquema')
    // Lo mecánico es que la rama volvió a pedir lo mismo que un marco de su
    // propio linaje ya venía a establecer. El mensaje nombra al ancestro: un
    // «esto es un ciclo» sin decir contra qué no se puede discutir — y la versión
    // vieja decía «más arriba en esta misma búsqueda», que era una lista global y
    // mentía cuando la firma repetida estaba en el rol HERMANO.
    expect(r.why).toContain('ya está en el linaje de este nodo')
    expect(r.why).toContain('el marco de «catch>0&reach>=2» vino a establecerlo')
  })

  it('el `nearest` trae lo que sí se puede hacer mientras tanto, y lo que trae está medido', () => {
    // El documento pone `[ir(río), tantear]`. `tantear` NO ESTÁ en `Step` —su
    // ausencia está decidida y escrita en `tipos.ts`— y `explorar`, que sería el
    // reemplazo, pide `maxTicks` en TICKS: `VistaDelPlan` no tiene `hz` con qué
    // convertir los segundos del reloj, así que inventar el número sería el tipo
    // de dato que después nadie puede discutir.
    //
    // Lo que sale es el prefijo ejecutable: agarrar el atador —que la caña iba a
    // necesitar igual— y caminar HASTA EL POZO, que está a ocho celdas.
    //
    // Y ese último paso es el que cambió, y vale anotar de dónde venía: mientras
    // el esquema de `extraccion` no le pidió nada a la CELDA del `source`, el
    // `nearest` mandaba a caminar hasta la VARA —el rol sólo pide `mass > 0` y la
    // vara estaba más cerca—, o sea a pescar adentro de la materia de la caña que
    // esa misma rama no supo hacer. Con `wet >= 0.9` el único candidato es el
    // agua, y el consuelo que el `gap` ofrece pasa a ser el correcto: se sabe
    // pescar en el río, no se sabe hacer la caña, y mientras nace el contrato el
    // cuerpo ya está caminando al agua.
    const r = plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: sinPuente })
    if (r.k !== 'gap') throw new Error('se esperaba un gap')
    expect(resumir(r.nearest)).toEqual(['ir(matorral)', 'sostener(matorral)', 'ir(pozo)'])
  })

  it('todo lo que sale en `nearest` es ejecutable hoy: sólo `ir` y `sostener`, y sólo contra ids', () => {
    // Un `nearest` con un paso que necesita algo que todavía no existe no sería
    // «lo que se puede hacer mientras tanto»: sería la mitad del plan que no
    // salió, con otro nombre.
    const r = plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: sinPuente })
    if (r.k !== 'gap') throw new Error('se esperaba un gap')
    for (const s of r.nearest) {
      expect(['ir', 'sostener']).toContain(s.k)
      const ref = s.k === 'ir' ? s.a : s.k === 'sostener' ? s.que : undefined
      expect(ref?.k).toBe('id')
    }
  })

  it('si a la meta raíz le falta el esquema, el `gap` es sobre la meta y no sobre un subobjetivo', () => {
    const sinPesca = ESQUEMAS.filter((e) => e.establishes !== 'holding(tag:carnoso)')
    const r = plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: sinPesca })
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.missing).toBe('holding(tag:carnoso)')
    expect(r.why).toBe('ningún esquema conocido establece «holding(tag:carnoso)»')
    expect(r.nearest).toEqual([])
  })

  it('un mundo vacío no da un plan de fantasía: da el `gap` de lo que no se ve', () => {
    const desierto = vista({ self: criatura(), cuerpos: [] })
    const r = plan(meta(COMER), desierto, SIN_CORTE)
    expect(r.k).toBe('gap')
  })
})

// ─── (6) Los dos cortes que impiden que cuelgue ─────────────────────────────

/** Un esquema de prueba con el `segundos` LEÍDO de la tabla real, no inventado. */
function comoEnLaTabla(
  establishes: string,
  via: string,
  roleHints: Readonly<Record<string, Where>>,
): ConstructionSchema {
  const gemelo = ESQUEMAS.find((e) => e.via === via)
  if (gemelo === undefined) throw new Error(`la tabla no tiene ningún esquema por «${via}»`)
  return { establishes, via, roleHints, segundos: gemelo.segundos }
}

describe('los ciclos y la profundidad', () => {
  /** El mundo donde hay un atador y NADA más: lo justo para que `union` arranque. */
  function conAtador(): VistaDelPlan {
    return vista({
      self: criatura(),
      cuerpos: [cuerpo('liana', 1, 0)],
      qs: new Map<BodyId, Cualidades>([['liana', { flexibility: 0.9, tensile: 0.72, mass: 0.2 }]]),
    })
  }

  it('A establece lo que B necesita y B lo que A: no cuelga, y dice por qué', () => {
    // El corte lo hace el LINAJE del nodo —su propia pila de marcos—: cuando lo
    // que falta garantiza lo que un marco de más abajo venía a establecer, la
    // rama muere. Sin él, esta llamada no vuelve nunca y el test se cuelga sin
    // mensaje, que es el peor de los fracasos posibles.
    //
    // Antes el corte era una lista de firmas COMPARTIDA POR TODA LA BÚSQUEDA, y
    // cortaba de más: mataba ramas hermanas que no eran ciclos. El caso está en
    // `ataque-al-plan.test.ts` («lo mismo SÍ se puede fabricar dos veces»).
    const enCirculo: readonly ConstructionSchema[] = [
      comoEnLaTabla('rigidity>=0.5', 'union', { a: [{ q: 'cohesion', op: '>=', v: 0.9 }], binder: [] }),
      comoEnLaTabla('cohesion>=0.9', 'union', { a: [{ q: 'rigidity', op: '>=', v: 0.5 }], binder: [] }),
    ]
    const r = plan(
      meta({ k: 'cualidad', test: { q: 'rigidity', op: '>=', v: 0.5 } }),
      conAtador(),
      SIN_CORTE,
      undefined,
      { esquemas: enCirculo },
    )
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toContain('ya está en el linaje de este nodo')
    // Y no expandió miles de nodos para descubrirlo.
    expect(r.expansiones).toBeLessThan(20)
  })

  it('una cadena más larga que `PROFUNDIDAD_MAXIMA` muere por profundidad y no por ciclo', () => {
    // Cinco eslabones distintos, ninguno repetido: acá el conjunto de cerrados no
    // corta nada y el único freno es la profundidad. Los dos cortes hacen falta y
    // ésta es la carnada del segundo.
    const escalera: readonly ConstructionSchema[] = [
      comoEnLaTabla('rigidity>=0.5', 'union', { a: [{ q: 'cohesion', op: '>=', v: 0.9 }], binder: [] }),
      comoEnLaTabla('cohesion>=0.9', 'union', { a: [{ q: 'toughness', op: '>=', v: 0.9 }], binder: [] }),
      comoEnLaTabla('toughness>=0.9', 'union', { a: [{ q: 'sharpness', op: '>=', v: 0.9 }], binder: [] }),
      comoEnLaTabla('sharpness>=0.9', 'union', { a: [{ q: 'moisture', op: '>=', v: 0.9 }], binder: [] }),
      comoEnLaTabla('moisture>=0.9', 'union', { a: [{ q: 'decay', op: '>=', v: 0.9 }], binder: [] }),
    ]
    const r = plan(
      meta({ k: 'cualidad', test: { q: 'rigidity', op: '>=', v: 0.5 } }),
      conAtador(),
      SIN_CORTE,
      undefined,
      { esquemas: escalera },
    )
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toContain(`profundidad máxima (${String(PROFUNDIDAD_MAXIMA)})`)
  })
})

// ─── (7) El orden: total, estable, y ciego al orden de la tabla ─────────────

describe('el determinismo del plan', () => {
  /**
   * Fisher-Yates con un LCG de semilla fija. Nada de `Math.random`: un test que
   * baraja al azar de verdad falla una vez cada tanto y nadie sabe con qué.
   */
  function barajar<T>(xs: readonly T[], semilla: number): readonly T[] {
    const out = [...xs]
    let s = semilla >>> 0
    for (let i = out.length - 1; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      const j = s % (i + 1)
      const a = out[i]
      const b = out[j]
      if (a === undefined || b === undefined) continue
      out[i] = b
      out[j] = a
    }
    return out
  }

  it('la tabla barajada de ocho formas distintas da EXACTAMENTE el mismo plan', () => {
    // Es el test de la decisión 5: los empates se rompen por CONTENIDO. Si se
    // rompieran por orden de llegada, el orden de llegada sería el de `ESQUEMAS`
    // y barajar la tabla —que no cambia nada de lo que la física puede hacer—
    // cambiaría el plan.
    const patron = plan(meta(COMER), elRio(), SIN_CORTE)
    for (let s = 1; s <= 8; s++) {
      const mezclado = barajar(ESQUEMAS, s * 7919)
      expect(plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: mezclado }), `semilla ${String(s)}`).toEqual(
        patron,
      )
    }
  })

  it('y también el mismo `gap`, que es donde el orden se escondería mejor', () => {
    // El `gap` elige UN muerto entre varios. Si esa elección dependiera del orden
    // en que murieron, el `why` cambiaría con la tabla barajada y el plan no.
    const sinPuente = ESQUEMAS.filter((e) => e.establishes !== 'catch>0')
    const patron = plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: sinPuente })
    for (let s = 1; s <= 8; s++) {
      expect(
        plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: barajar(sinPuente, s * 104729) }),
        `semilla ${String(s)}`,
      ).toEqual(patron)
    }
  })

  it('dos vías que cuestan LO MISMO: el empate lo rompe el contenido y no quién llegó primero', () => {
    // ─── ESTE TEST EXISTE PORQUE EL DE ARRIBA NO ALCANZABA, Y SE MIDIÓ ──────
    //
    // Barajar `ESQUEMAS` con la tabla semilla NO prueba el desempate, y se
    // comprobó por mutación: reemplazando la comparación por contenido con un
    // `return 0` —o sea, dejando que gane el que llegó primero— los 39 tests
    // seguían en verde. Hay dos razones y las dos son del mundo, no del código:
    //
    //   · los CUATRO procesos de la semilla cuestan CUATRO números distintos
    //     (1 · 1,5 · 2 · 3,2083 s), así que dos sucesores nacidos de la misma
    //     expansión nunca empatan en costo;
    //   · dos sucesores nacidos en expansiones distintas se insertan en un orden
    //     que fija el algoritmo y no la tabla, así que barajar tampoco los mueve.
    //
    // O sea: **con la tabla semilla el empate es inalcanzable**, y un desempate
    // que nunca se ejerce es un desempate que nadie sabe si funciona. Así que se
    // fabrica el adversario: dos vías distintas para la misma firma con el MISMO
    // `segundos`. Ese `segundos` es el único número de este archivo que no sale
    // del catálogo, y está forzado a propósito — es justo la condición que la
    // semilla no puede producir y que un proceso escrito por el modelo sí.
    const conCosto = (
      establishes: string,
      via: string,
      roleHints: Readonly<Record<string, Where>>,
      segundos: number,
    ): ConstructionSchema => ({ establishes, via, roleHints, segundos })

    const empatadas: readonly ConstructionSchema[] = [
      conCosto('rigidity>=0.5', 'union', { a: [], binder: [] }, 1),
      conCosto('rigidity>=0.5', 'deshilachar', { source: [], actor: [] }, 1),
    ]
    const mundo = (): VistaDelPlan =>
      vista({
        self: criatura(),
        cuerpos: [cuerpo('mata', 1, 0), cuerpo('palo', 2, 0)],
        qs: new Map<BodyId, Cualidades>([
          ['mata', { flexibility: 0.9, tensile: 0.72, mass: 0.2 }],
          ['palo', { tensile: 0.55, mass: 1 }],
        ]),
      })
    const g = meta({ k: 'cualidad', test: { q: 'rigidity', op: '>=', v: 0.5 } })
    const patron = plan(g, mundo(), SIN_CORTE, undefined, { esquemas: empatadas })
    expect(patron.k).toBe('plan')
    for (let s = 1; s <= 8; s++) {
      expect(
        plan(g, mundo(), SIN_CORTE, undefined, { esquemas: barajar(empatadas, s * 31337) }),
        `semilla ${String(s)}`,
      ).toEqual(patron)
    }
  })

  it('y un rol SIN CONDICIONES se llena con lo más cercano en vez de rechazar el proceso', () => {
    // La conjunción vacía es cero cláusulas, no una cláusula ilegible. `union`
    // declara su rol `a` con `where: []` y el esquema de `catch>0` lo pide con
    // `a: []`: hay un rol REAL de la tabla semilla cuya exigencia es vacía. Con
    // la lectura equivocada, `union` se rechazaba entera con el motivo «el pedido
    // del rol no se entiende», y la pesca funcionaba nada más que porque ese rol
    // se pide junto con `reach>=2`. Pedir `catch>0` solo no daba caña.
    const soloCatch = ESQUEMAS.filter((e) => e.establishes === 'catch>0')
    const r = plan(
      meta({ k: 'cualidad', test: { q: 'catch', op: '>', v: 0 } }),
      elRio(),
      SIN_CORTE,
      undefined,
      { esquemas: soloCatch },
    )
    // El `binder` se elige PRIMERO —es el rol apretado, un solo candidato— y el
    // `a`, que no pide nada, se queda con el más cercano de los que sobran. Los
    // pasos, en cambio, salen en orden de nombre de rol: `a` antes que `binder`.
    expect(resumir(pasosDe(r))).toEqual([
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(binder=matorral, a=vara)',
    ])
  })

  it('dos corridas del mismo problema son iguales hasta el último campo', () => {
    expect(plan(meta(COMER), elRio(), SIN_CORTE)).toEqual(plan(meta(COMER), elRio(), SIN_CORTE))
    expect(plan(meta(ARDER), elLeno(), SIN_CORTE)).toEqual(plan(meta(ARDER), elLeno(), SIN_CORTE))
  })

  it('el empate de distancia lo rompe el `id` y no el orden en que `see` los devolvió', () => {
    // Dos varas a la misma distancia. `see()` no promete orden —el nuestro las
    // devuelve en el orden del array— así que sin el desempate por `id` el plan
    // dependería de cómo se armó la percepción de ese tick.
    const conDos = (orden: readonly string[]): VistaDelPlan =>
      vista({
        self: criatura(),
        cuerpos: [
          ...orden.map((id) => cuerpo(id, id === 'vara-a' ? 3 : -3, 0)),
          cuerpo('matorral', 1, 0),
          cuerpo('pozo', 8, 0),
        ],
        qs: new Map<BodyId, Cualidades>([
          ['vara-a', { reach: 4, rigidity: 0.7, tensile: 0.55, mass: 1 }],
          ['vara-b', { reach: 4, rigidity: 0.7, tensile: 0.55, mass: 1 }],
          ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3 }],
          ['pozo', { mass: 50 }],
        ]),
        mojadas: [{ x: 8, y: 0 }],
      })
    const uno = plan(meta(COMER), conDos(['vara-a', 'vara-b']), SIN_CORTE)
    const otro = plan(meta(COMER), conDos(['vara-b', 'vara-a']), SIN_CORTE)
    expect(uno).toEqual(otro)
    expect(resumir(pasosDe(uno))).toContain('ir(vara-a)')
  })
})

// ─── (8) Los rechazos que el planificador NO deja pasar ─────────────────────

describe('lo que la regresión se niega a armar', () => {
  it('dos esquemas del mismo proceso que no nombran los mismos roles no se juntan', () => {
    // Es el rechazo más importante de todos y no se ve nunca en la tabla semilla:
    // si un esquema de `union` nombrara `b` y otro lo omitiera, juntarlos daría
    // una aplicación que llena `b` — y el que lo omitía lo omitía porque con `b`
    // lleno el atador se gasta y `catch` da CERO. Plan verde, caña que no
    // engancha. Se rechaza, y el motivo se dice.
    const conflictiva: readonly ConstructionSchema[] = [
      ...ESQUEMAS.filter((e) => e.establishes !== 'reach>=2'),
      comoEnLaTabla('reach>=2', 'union', {
        a: [{ q: 'reach', op: '>=', v: 2 }],
        binder: [],
        b: [],
      }),
    ]
    const r = plan(meta(COMER), elRio(), SIN_CORTE, undefined, { esquemas: conflictiva })
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toContain('no nombran los mismos roles')
  })

  it('un residuo EXTENSIVO no viaja por la materia, y el proceso se rechaza', () => {
    // Una cláusula que la conjunción pide y el proceso no promete tiene que salir
    // de la materia que entra. Las INTENSIVAS viajan —deshilachar un leño rígido
    // da una hebra rígida, y de eso vive la cadena de la yesca—; `mass` no viaja:
    // la hebra se lleva la décima parte. Exigirle `mass>=5` a la vara para que el
    // ensamble tenga 5 sería exigir de menos con cara de exigir de más, y el plan
    // saldría verde sobre una cuenta que nadie hizo.
    //
    // ─── Y EL ESCENARIO TUVO QUE CAMBIAR, POR UNA RAZÓN QUE VALE ANOTAR ─────
    //
    // Éste era un solo esquema `reach>=8` por `union` con `a: [mass>=5,
    // reach>=8]`: el rol pedía otra vez el mismo alcance, se volvía a `union`, y
    // ahí caía el residuo extensivo. Desde que el corte de ciclos es por LINAJE y
    // por DOMINANCIA, esa rama ya no llega hasta acá — muere antes, y con razón:
    // pedir `mass>=5 ∧ reach>=8` para establecer `reach>=8` es pedir algo que ya
    // implica lo que se quería. El guardián del residuo no se puede probar con un
    // pedido que domina a su propio ancestro.
    //
    // Así que la cadena tiene DOS eslabones y el de arriba es de otra magnitud:
    // `deshilachar` promete flexibilidad y su `source` pide masa y alcance; ese
    // pedido no dice nada de flexibilidad, así que no domina a nadie y la
    // regresión sigue. Ahí `union` cubre el `reach>=8`, el `mass>=5` queda de
    // residuo, y el residuo es extensivo.
    const conResiduoExtensivo: readonly ConstructionSchema[] = [
      comoEnLaTabla('flexibility>=0.8', 'deshilachar', {
        source: [
          { q: 'mass', op: '>=', v: 5 },
          { q: 'reach', op: '>=', v: 8 },
        ],
        actor: [],
      }),
      comoEnLaTabla('reach>=8', 'union', { a: [], binder: [] }),
    ]
    const r = plan(
      meta({ k: 'cualidad', test: { q: 'flexibility', op: '>=', v: 0.8 } }),
      vista({
        self: criatura(),
        cuerpos: [cuerpo('vara', 2, 0)],
        qs: new Map<BodyId, Cualidades>([['vara', { reach: 4, tensile: 0.55, mass: 1 }]]),
      }),
      SIN_CORTE,
      undefined,
      { esquemas: conResiduoExtensivo },
    )
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.missing).toBe('mass>=5&reach>=8&tensile>=0.3')
    expect(r.why).toContain('«mass>=5» es extensiva')
  })

  it('un esquema que nombra un rol que el proceso no tiene se rechaza en vez de armar basura', () => {
    const inventado: readonly ConstructionSchema[] = [
      comoEnLaTabla('reach>=2', 'deshilachar', { source: [], actor: [], ayudante: [] }),
    ]
    const r = plan(
      meta({ k: 'cualidad', test: { q: 'reach', op: '>=', v: 2 } }),
      vista({ self: criatura(), cuerpos: [] }),
      SIN_CORTE,
      undefined,
      { esquemas: inventado },
    )
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toContain('no declara el rol «ayudante»')
  })

  it('un mismo cuerpo no llena dos roles del mismo proceso: una vara no se frota contra sí misma', () => {
    // `friccion` con `a === b` es un proceso que el mundo va a rebotar después de
    // haber gastado el turno. Con un solo leño a la vista el plan tiene que
    // fabricar el segundo cuerpo (la hebra), no reusar el primero — y eso es
    // exactamente lo que hace el test de la yesca. Acá se pina el negativo: los
    // dos roles de la fricción nombran cosas distintas.
    const frotar = pasosDe(plan(meta(ARDER), elLeno(), SIN_CORTE)).find((s) => s.k === 'frotar')
    expect(frotar).toBeDefined()
    if (frotar === undefined) return
    expect(JSON.stringify(frotar.a)).not.toBe(JSON.stringify(frotar.b))
  })
})

// ─── (9) La regla 2, sobre todo `src/` ──────────────────────────────────────
//
// EL PAQUETE NACIÓ SIN GUARDIÁN. «Ningún paquete determinista toca el reloj ni el
// azar del sistema» no la hace cumplir ningún lint —`grep -rn "no-restricted"`
// sobre el repo da cero— sino copias de esta lista de regex en los tests de cada
// paquete. `@anima/plan` no tenía ninguna. Esto está copiado de
// `perceive/tests/ataque-determinismo.test.ts`, que a su vez lo copió de
// `world/`: una lista compartida sería un import de test a test, que es peor.
//
// Lee `readdirSync(src/)`, así que un archivo nuevo entra solo.

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const FUENTES = readdirSync(SRC).filter((f) => f.endsWith('.ts'))

const PROHIBIDOS: readonly (readonly [RegExp, string])[] = [
  [/\bMath\.random\b/, 'el azar del sistema no se puede reproducir'],
  [/\bnew Date\b|\bDate\.now\b/, 'el reloj del mundo es el contador de ticks'],
  [/\bperformance\./, 'el presupuesto se mide en expansiones, no en milisegundos (ADR II-0012)'],
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

/** El fuente SIN comentarios: este paquete EXPLICA lo que tiene prohibido. */
function codigoDe(archivo: string): string {
  return readFileSync(SRC + archivo, 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

describe('la regla 2, sobre todo `src/`', () => {
  it(`los ${String(FUENTES.length)} fuentes del paquete, leídos del directorio`, () => {
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
    // Un guardián que no se prueba a sí mismo puede estar leyendo el archivo
    // equivocado y dar verde para siempre.
    const carnada: readonly string[] = [
      'const x = Math.random()',
      'const t = Date.now()',
      'const t = new Date()',
      'performance.now()',
      'a.localeCompare(b)',
      'Math.pow(2, 3)',
      'const y = 2 ** 3',
      "import x from '@anima/sim-core'",
      'await algo()',
    ]
    for (const linea of carnada) {
      expect(
        PROHIBIDOS.some(([p]) => p.test(linea)),
        `el guardián no vio «${linea}»`,
      ).toBe(true)
    }
  })

  it('y NO rebota lo que sí está permitido', () => {
    const inocentes: readonly string[] = [
      'const d = Math.max(a, b)',
      'const n = Math.abs(x)',
      'const f = Math.floor(x / 2)',
      'const h = Math.imul(a, b)',
      "import { specOf } from '@anima/physics'",
      "import { distancia } from '@anima/skills/innatas'",
    ]
    for (const linea of inocentes) {
      expect(
        PROHIBIDOS.filter(([p]) => p.test(linea)).map(([p]) => String(p)),
        `el guardián rebotó «${linea}»`,
      ).toEqual([])
    }
  })
})
