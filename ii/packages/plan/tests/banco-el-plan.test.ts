// ─── EL BANCO DEL PLAN — ¿entra D4 en sus 8 ms, y vale 64? ───────────────────
//
//   pnpm --filter @anima/plan banco
//
// EL DOCUMENTO DE ARQUITECTURA LE PRESUPUESTA 8 ms A D4, el peldaño de la
// escalera de decisión que llama a `plan()`. Y `EXPANSIONES_POR_TICK = 64` es una
// apuesta: el comentario de `tipos.ts` dice que «el número sale del banco, no de
// la intuición», y el banco no existía. Éste es el banco.
//
// Tres preguntas, y las tres se contestan con números corridos:
//
//   1. ¿cuánto tarda `plan()` con presupuesto 64 sobre la pesca? p50 y p99;
//   2. ¿cuántas expansiones entran DE VERDAD en 8 ms?
//   3. ¿reanudar desde una frontera sale más barato que empezar de cero? Si sale
//      casi lo mismo, el anytime entero no sirve para nada y hay que decirlo.
//
// ─── LO QUE ESTE BANCO ENCONTRÓ, ADELANTE Y NO ESCONDIDO ─────────────────────
//
// `EXPANSIONES_POR_TICK = 64` NUNCA CORTA. La búsqueda más profunda que el
// catálogo semilla puede producir —nueve metas por tres tamaños de vista, medido
// abajo— gasta SEIS expansiones. El presupuesto es diez veces la búsqueda entera:
// no está mal calibrado en la dirección peligrosa (no se pasa de los 8 ms), está
// suelto —no toca nada—. Y el camino `parcial` de `plan()`, con toda su frontera
// y su `toEqual` que no perdona, es código que en producción hoy no se ejecuta
// ni una vez. Eso no es un motivo para borrarlo: es un motivo para saberlo.
//
// Y lo único que de verdad se acerca a los 8 ms no es la búsqueda: es LA PRIMERA
// LLAMADA DEL PROCESO, que paga el JIT y la inicialización perezosa de los
// catálogos de la física. Mide 2,3 ms —28% del presupuesto de D4— contra 48 µs de
// la misma llamada ya caliente. Se paga una sola vez, en el primer tick en que
// alguna criatura llega a D4, y por eso se mide arriba de todo: en cuanto
// `plan()` corrió una vez, ese número desaparece y no se puede volver a medir.
//
// ─── POR QUÉ PERCENTILES Y NO EL MÍNIMO DE VARIAS RONDAS ────────────────────
//
// `world/tests/banco-el-tick.test.ts` toma el MÍNIMO de siete rondas, y tiene
// razón para lo que él pregunta: «¿cuánto cuesta este código?» — y el mínimo es
// lo único atribuible al programa, porque el resto es la máquina ocupada.
//
// Acá la pregunta es otra: «¿ENTRA en 8 ms?». Un presupuesto no se cumple en el
// mejor tick, se cumple en el peor, y el tick malo —el que cayó junto a una pausa
// del recolector— es exactamente el que hay que mirar. Por eso se cronometra CADA
// LLAMADA por separado y se reportan p50 y p99: el p50 dice cuánto cuesta, el p99
// dice si el presupuesto aguanta.
//
// Los dos estimadores conviven: el MARGINAL por expansión sí se calcula restando
// dos p50 —dos medianas de la misma distribución, que es una resta honesta—
// porque ahí la pregunta vuelve a ser «cuánto cuesta una expansión».
//
// ─── QUÉ SE MIDE Y QUÉ NO, dicho antes de que alguien cite el número de más ──
//
//   · la `VistaDelPlan` es DE MENTIRA, igual que en `banco-las-referencias`. El
//     `see()` de verdad arma la lista desde el índice del tick
//     (`perceive/src/vista.ts`) y cuesta más. Así que todo lo de acá es una COTA
//     OPTIMISTA: el plan real cuesta más, y «entran 105 expansiones en 8 ms» hay
//     que leerlo como «no entran más de 105». Con una salvedad que va en la otra
//     dirección y hay que decirla: desde que la regresión le pide `portable` a
//     todo rol de un proceso `held`, esta vista de mentira contesta esa cualidad
//     con `evalQuality` sobre la expresión del catálogo, o sea que acá el arnés
//     hace parte del trabajo que en producción hace `qualityOf`. Parte del salto
//     de 37,7 a 73,8 µs por expansión en la vista de 625 es eso;
//   · los tres tamaños de vista no son inventados. `RADIO_DE_PERCEPCION` es 12
//     —25×25 = 625 celdas— y el banco de la percepción, corrido, imprime «71 de
//     5000 en un mundo de 200×200». De ahí: 3 es el escenario del documento,
//     80 es la vista típica redondeada para arriba, 625 es el peor caso honesto
//     —un cuerpo por celda percibida, o sea el mundo lleno—;
//   · el relleno son cuerpos inertes con `mass: 1` y puestos LEJOS (distancia ≥ 12
//     de la criatura, que es Chebyshev en `skills/innatas/comun.ts`), para que el
//     plan que sale sea EL MISMO que el de la vista de tres. Si el relleno cambiara
//     el plan, esto mediría dos problemas distintos y no el mismo problema con la
//     vista cargada.
//
// LA REGLA DEL BANCO: se IMPRIME siempre, se AFIRMA sólo midiendo en serio. Ver
// `MIDIENDO_EN_SERIO` abajo, y `world/tests/banco-el-tick.test.ts:165` para el
// porqué entero. Un test de rendimiento adentro de la suite normal es un test
// flaky, y un test flaky es peor que ninguno: enseña a ignorar el rojo.

import { describe, expect, it } from 'vitest'

import type { QualityId } from '@anima/physics'
import { evalQuality, specOf } from '@anima/physics'
import type { BodyId, BodyView, Cell, CellQuality, Clock, SelfView, Tag, Where } from '@anima/skills'

import { ESQUEMAS } from '../src/esquemas.js'
import { plan } from '../src/regresion.js'
import { EXPANSIONES_POR_TICK } from '../src/tipos.js'
import type { Frontera, GoalNode, PlanResult, Predicado, VistaDelPlan } from '../src/tipos.js'

// ─── El mundito de mentira ──────────────────────────────────────────────────
//
// Copiado de `la-regresion.test.ts` y no importado de ahí: un banco que depende
// del archivo de test de al lado se rompe cuando el de al lado se reordena, y lo
// que un banco tiene que poder hacer es correrse solo dentro de un año.

type Cualidades = Partial<Record<QualityId, number>>

function cuerpo(id: string, x: number, y: number, tags: readonly Tag[] = []): BodyView {
  // `tags` es lo que la superficie publica de la MATERIA (`tagsDe(body, phys)`),
  // y acá no hay materia: un cuerpo de mentira no está hecho de nada, así que por
  // omisión no tiene ninguna clase. Los tests que prueban `holding(tag:…)` la pasan.
  return { id, at: { x, y }, name: id, tags, madeByMe: false, joints: [] }
}

function criatura(): SelfView {
  return {
    id: 'yo',
    at: { x: 0, y: 0 },
    name: 'criatura',
    // En este mundito nada tiene sustancia, asi que nada tiene clase de materia:
    // `[]` es la respuesta honesta y es la misma que da `cuerpo()` por omision. En
    // la partida la vista lo saca de `tagsDe(body, phys)`.
    tags: [],
    madeByMe: false,
    joints: [],
    holding: [],
    capacity: 3,
    stamina: 1000,
    permits: 'reversible',
  }
}

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

/**
 * `portable` la contesta EL MOTOR: la regresión se la pide a todo rol de un
 * proceso `held`, y escribir el tope de 8 kg acá sería su segunda copia. Cuesta
 * una evaluación de expresión por candidato, y eso ENTRA en lo que el banco mide.
 */
function portableDe(mass: number): number {
  const d = specOf('portable').derived
  if (d === undefined) throw new Error('`portable` dejó de ser derivada: el arnés se quedó viejo')
  const noHace = (): never => {
    throw new RangeError('`portable` sólo depende de `own(mass)`')
  }
  return evalQuality(d, { own: (q) => (q === 'mass' ? mass : 0), geom: noHace, sumParts: noHace, maxParts: noHace, substance: noHace })
}

/** La celda del pozo es agua franca: sin eso `extraccion` no tiene `source`. */
const AGUA: readonly Cell[] = [{ x: 8, y: 0 }]

function vista(m: { cuerpos?: readonly BodyView[]; qs?: ReadonlyMap<BodyId, Cualidades> }): VistaDelPlan {
  const self = criatura()
  const cuerpos = m.cuerpos ?? []
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
          const pasa = t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
          if (!pasa) ok = false
        }
        if (ok) out.push(b)
      }
      return out
    },
    recall: () => [],
    q: qde,
    qAt: (at: Cell, q: CellQuality): number =>
      q === 'wet' && AGUA.some((c) => c.x === at.x && c.y === at.y) ? 1 : 0,
    self,
    clock: RELOJ,
  }
}

function meta(goal: Predicado): GoalNode {
  return { id: 'g0', goal, after: [], porque: 'banco' }
}

const COMER: Predicado = { k: 'sostiene', tag: 'carnoso' }

/** Los números de las sustancias semilla, los mismos de `hito-5-la-pesca`. */
const QS_RIO: readonly (readonly [BodyId, Cualidades])[] = [
  ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
  ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
  ['pozo', { mass: 50 }],
]

/**
 * «Tengo hambre, veo un río», con `relleno` cuerpos inertes de más.
 *
 * El relleno arranca en la celda (12,12) y llena un cuadrado de 25×25: TODOS
 * quedan a distancia ≥ 12 de la criatura, más lejos que el pozo, que está a 8.
 * Por eso el plan no cambia —está verificado abajo, no supuesto— y lo único que
 * cambia es cuántos cuerpos barre `candidatosPara` en cada expansión.
 */
function elRio(relleno = 0): VistaDelPlan {
  const cuerpos: BodyView[] = [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0)]
  const qs = new Map<BodyId, Cualidades>(QS_RIO)
  for (let i = 0; i < relleno; i++) {
    const id = `r${String(i).padStart(4, '0')}`
    cuerpos.push(cuerpo(id, 12 + (i % 25), 12 + ((i / 25) | 0)))
    qs.set(id, { mass: 1 })
  }
  return vista({ cuerpos, qs })
}

const TIPICA = 77 // 80 cuerpos con los tres del río
const PEOR = 622 // 625 cuerpos: un cuerpo por celda percibida

// ─── El cronómetro ──────────────────────────────────────────────────────────

/**
 * Los `n` tiempos de `n` llamadas, EN NANOSEGUNDOS Y ORDENADOS.
 *
 * `process.hrtime.bigint()` y no `Date.now()` —que tiene resolución de
 * milisegundos y acá se miden decenas de microsegundos—, y en `tests/` está
 * permitido: la regla 2 gobierna `src/`.
 *
 * Se calienta antes de medir porque las primeras llamadas pagan el JIT y son de
 * otra distribución; cuánto cuesta esa primera llamada se mide aparte, arriba de
 * todo, que es donde significa algo.
 */
function muestras(f: () => void, n: number, calentar = 200): number[] {
  for (let i = 0; i < calentar; i++) f()
  const xs: number[] = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const t0 = process.hrtime.bigint()
    f()
    xs[i] = Number(process.hrtime.bigint() - t0)
  }
  return xs.sort((a, b) => a - b)
}

/** El percentil `q` de una lista YA ordenada, por el método del más cercano. */
function pct(ordenadas: readonly number[], q: number): number {
  const i = Math.min(ordenadas.length - 1, Math.max(0, Math.ceil((q / 100) * ordenadas.length) - 1))
  return ordenadas[i] as number
}

const us = (ns: number, d = 1): string => (ns / 1000).toFixed(d)
const num = (x: number, d = 2): string => x.toFixed(d)

/** Los 8 ms de D4, en nanosegundos, que es la unidad en la que se mide acá. */
const D4_NS = 8_000_000

describe('el banco del plan', () => {
  /**
   * Las aserciones de tiempo sólo corren cuando alguien pide medir en serio:
   *
   *   ANIMA_BANCO=1 pnpm --filter @anima/plan banco
   *
   * En la suite normal los números se imprimen y no se afirman. `pnpm ii:test`
   * corre los paquetes EN PARALELO, y un banco que mide microsegundos contra una
   * máquina ocupada da cualquier cosa. Ver el encabezado.
   */
  const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

  // ─── (0) La primera llamada, la que paga el JIT ───────────────────────────

  it('la primera llamada del proceso cuesta más que las siguientes', () => {
    // VA PRIMERA EN EL ARCHIVO A PROPÓSITO, y es la única medición que no se
    // puede repetir: en cuanto `plan()` corrió una vez, V8 ya la compiló y el
    // número desaparece para siempre. En la partida esto se paga UNA vez, en el
    // primer tick en que alguna criatura llega a D4, y es bueno saber que no es
    // un orden de magnitud distinto.
    const v = elRio()
    const t0 = process.hrtime.bigint()
    const r = plan(meta(COMER), v, EXPANSIONES_POR_TICK)
    const fria = Number(process.hrtime.bigint() - t0)
    const tibias = muestras(() => {
      plan(meta(COMER), v, EXPANSIONES_POR_TICK)
    }, 500)
    console.log(
      `\n── LA PRIMERA LLAMADA ────────────  ${MIDIENDO_EN_SERIO ? 'MIDIENDO EN SERIO: los tiempos se afirman' : 'sólo imprimiendo (ANIMA_BANCO=1 para afirmar)'}\n` +
        `  en frío (una sola, sin repetición posible) .... ${us(fria)} µs\n` +
        `  ya caliente, p50 .............................. ${us(pct(tibias, 50))} µs\n` +
        `  la fría es ${num(fria / Math.max(pct(tibias, 50), 1), 1)}× la caliente, y es ${num((fria / D4_NS) * 100, 2)}% de los 8 ms de D4\n`,
    )
    // Esto sí se afirma siempre: es una propiedad del resultado, no del reloj.
    expect(r.k).toBe('plan')
    if (!MIDIENDO_EN_SERIO) return
    expect(fria).toBeLessThan(D4_NS)
  })

  // ─── (1) La pesca con presupuesto 64: p50 y p99 ──────────────────────────

  it('(1) `plan()` con presupuesto 64 sobre la pesca: p50 y p99', () => {
    const casos: readonly (readonly [string, VistaDelPlan, number])[] = [
      ['el río del documento (3 cuerpos)', elRio(), 3000],
      [`la vista típica (${String(TIPICA + 3)} cuerpos)`, elRio(TIPICA), 2000],
      [`la vista saturada (${String(PEOR + 3)} cuerpos)`, elRio(PEOR), 400],
    ]

    const filas: string[] = []
    const p99s: number[] = []
    for (const [nombre, v, n] of casos) {
      const r = plan(meta(COMER), v, EXPANSIONES_POR_TICK)
      // El plan tiene que ser el MISMO en los tres: si el relleno lo cambiara,
      // las tres filas medirían tres problemas distintos y la comparación entre
      // ellas no diría nada. Se compara contra el del río pelado.
      expect(r.k, nombre).toBe('plan')
      const xs = muestras(() => {
        plan(meta(COMER), v, EXPANSIONES_POR_TICK)
      }, n, n > 1000 ? 200 : 50)
      p99s.push(pct(xs, 99))
      filas.push(
        `  ${nombre.padEnd(34)} exp=${String(r.expansiones)}  ` +
          `p50 ${us(pct(xs, 50)).padStart(7)} µs  p99 ${us(pct(xs, 99)).padStart(7)} µs  ` +
          `máx ${us(xs[xs.length - 1] as number).padStart(7)} µs   ` +
          `p99 = ${num((pct(xs, 99) / D4_NS) * 100, 2)}% de los 8 ms`,
      )
    }

    console.log(
      `\n── (1) LA PESCA CON PRESUPUESTO ${String(EXPANSIONES_POR_TICK)} ─────────────  presupuesto de D4: 8 ms\n` +
        filas.join('\n') +
        `\n  El presupuesto 64 NO INTERVIENE: la pesca termina en 6 expansiones y\n` +
        `  \`plan()\` devuelve antes de mirar la cuota. Ver (2).\n`,
    )

    if (!MIDIENDO_EN_SERIO) return
    // EL CRITERIO: el peor de los tres p99 entra en los 8 ms de D4. Es la única
    // aserción que este banco de verdad tiene que hacer, y hoy sobra 10×.
    for (const p99 of p99s) expect(p99).toBeLessThan(D4_NS)
  })

  it('el relleno no cambia el plan, así que las tres filas miden el mismo problema', () => {
    // Sin esto, la fila de 625 podría estar midiendo un plan más corto —pescar en
    // un cuerpo de relleno, que califica de `source` porque `extraccion` sólo le
    // pide `mass > 0`— y la comparación entre filas sería falsa. No es una
    // medición: es determinista y se afirma siempre.
    const pelado = JSON.stringify(plan(meta(COMER), elRio(), EXPANSIONES_POR_TICK))
    expect(JSON.stringify(plan(meta(COMER), elRio(TIPICA), EXPANSIONES_POR_TICK))).toBe(pelado)
    expect(JSON.stringify(plan(meta(COMER), elRio(PEOR), EXPANSIONES_POR_TICK))).toBe(pelado)
  })

  // ─── (2) El techo del catálogo: la búsqueda entera son 6 expansiones ─────

  /**
   * Las nueve metas alcanzables: las ocho firmas que la tabla establece, más una
   * huérfana. Es todo lo que hoy se le puede pedir a `plan()`.
   */
  const METAS: readonly (readonly [string, Predicado])[] = [
    ['holding(tag:carnoso)', COMER],
    ['temperature>=400', { k: 'cualidad', test: { q: 'temperature', op: '>=', v: 400 } }],
    ['catch>0', { k: 'cualidad', test: { q: 'catch', op: '>', v: 0 } }],
    ['reach>=2', { k: 'cualidad', test: { q: 'reach', op: '>=', v: 2 } }],
    ['flexibility>=0.8', { k: 'cualidad', test: { q: 'flexibility', op: '>=', v: 0.8 } }],
    ['tensile>=0.3', { k: 'cualidad', test: { q: 'tensile', op: '>=', v: 0.3 } }],
    ['heatCapacity<=0.9', { k: 'cualidad', test: { q: 'heatCapacity', op: '<=', v: 0.9 } }],
    ['freeStrandEnds>=1', { k: 'geometria', f: 'freeStrandEnds', op: '>=', v: 1 }],
    ['sharpness>=0.99 (huérfana)', { k: 'cualidad', test: { q: 'sharpness', op: '>=', v: 0.99 } }],
  ]

  /** Cuántas expansiones gasta cada meta en cada vista, y cuál es la peor. */
  function techoDelCatalogo(): { readonly peor: number; readonly filas: readonly string[] } {
    const vistas: readonly (readonly [string, VistaDelPlan])[] = [
      ['vacía', vista({})],
      ['río (3)', elRio()],
      [`río + ${String(PEOR)}`, elRio(PEOR)],
    ]
    let peor = 0
    const filas: string[] = []
    for (const [nv, v] of vistas) {
      const partes: string[] = []
      for (const [nm, g] of METAS) {
        const r = plan(meta(g), v, 5000)
        if (r.expansiones > peor) peor = r.expansiones
        partes.push(`${nm}=${String(r.expansiones)}${r.k === 'plan' ? '✓' : '✗'}`)
      }
      filas.push(`  vista ${nv.padEnd(10)} ${partes.join('  ')}`)
    }
    return { peor, filas }
  }

  it('(2) el catálogo semilla no llega ni a 7 expansiones, así que 64 nunca corta', () => {
    // ESTA MEDICIÓN NO ES DE TIEMPO: contar expansiones es determinista, da lo
    // mismo en cualquier máquina, y por eso se afirma SIEMPRE y no sólo midiendo
    // en serio. Es el hallazgo que ordena todo el informe.
    const { peor, filas } = techoDelCatalogo()
    console.log(
      `\n── (2) EL TECHO DEL CATÁLOGO SEMILLA ──────────────────────────────\n` +
        `  ✓ salió plan · ✗ salió gap · el número son las expansiones gastadas\n` +
        filas.join('\n') +
        `\n  PEOR CASO: ${String(peor)} expansiones, contra un presupuesto de ${String(EXPANSIONES_POR_TICK)}.\n` +
        `  El presupuesto es ${num(EXPANSIONES_POR_TICK / peor, 1)}× la búsqueda más cara que existe.\n`,
    )
    expect(peor).toBeGreaterThan(0)
    // El tripwire: mientras esto valga, el camino `parcial` no se ejecuta nunca
    // en producción. Ver el `it.fails` de abajo, que es la otra mitad de la
    // misma noticia.
    expect(peor).toBeLessThan(EXPANSIONES_POR_TICK)
  })

  it.fails('alguna búsqueda del catálogo gasta las 64 expansiones y obliga a un corte', () => {
    // ─── EL HUECO, MARCADO Y NO TAPADO ──────────────────────────────────────
    //
    // «¿Cuántas expansiones entran de verdad en 8 ms?» se contesta abajo con el
    // MARGINAL medido, y eso es una proyección y no una medición directa: para
    // medir una corrida de 64 expansiones haría falta una que exista, y con este
    // catálogo no existe. Seis es el techo.
    //
    // No se relaja el criterio ni se inventa un catálogo de fantasía para llegar
    // a 64: se marca el hueco con el idioma del proyecto. El día que el Hito 8 le
    // agregue procesos a la fragua y alguna búsqueda pase de 64, esto se cae solo
    // por «test esperado fallido que pasó» — y ahí hay que volver a correr este
    // banco, porque recién ahí el número 64 empieza a significar algo.
    const { peor } = techoDelCatalogo()
    expect(peor).toBeGreaterThanOrEqual(EXPANSIONES_POR_TICK)
  })

  // ─── (3) Cuántas expansiones entran de verdad en 8 ms ────────────────────

  it('(3) cuántas expansiones entran en 8 ms, por el marginal medido', () => {
    // ─── CÓMO SE SACA EL NÚMERO, porque la resta importa ─────────────────────
    //
    // `plan(meta, v, k)` con `k` chico corta y devuelve `parcial`, así que se
    // puede medir la curva `t(k)` para k = 1..7 sobre el MISMO problema. Lo que
    // gobierna no es `t(6)/6` —eso reparte entre las seis un costo fijo que se
    // paga una vez: interpretar la meta, armar el nodo raíz y las dos primeras
    // regresiones, que son las que barren la vista entera para contar candidatos—
    // sino la PENDIENTE: cuánto agrega una expansión más.
    //
    // Se toma entre k=2 y k=6 porque las dos primeras son de otra naturaleza
    // (regresión con `candidatosPara` sobre todos los roles) y meterlas en la
    // pendiente sobreestimaría el costo de las siguientes.
    const casos: readonly (readonly [number, number, number])[] = [
      [0, 3000, 200],
      [TIPICA, 1500, 200],
      [PEOR, 300, 50],
    ]

    const filas: string[] = []
    const techos: number[] = []
    for (const [relleno, n, calentar] of casos) {
      const v = elRio(relleno)
      const ts: number[] = []
      for (let k = 1; k <= 7; k++) {
        ts.push(
          pct(
            muestras(() => {
              plan(meta(COMER), v, k)
            }, n, calentar),
            50,
          ),
        )
      }
      const t2 = ts[1] as number
      const t6 = ts[5] as number
      const marginal = (t6 - t2) / 4
      // Lo que entra en 8 ms: las seis primeras se pagan enteras y el resto va al
      // marginal. Es la cuenta que un presupuesto de verdad tendría que hacer.
      const entran = marginal > 0 ? Math.floor((D4_NS - t6) / marginal) + 6 : Number.POSITIVE_INFINITY
      techos.push(entran)
      filas.push(
        `  ${String(relleno + 3).padStart(3)} cuerpos: ` +
          ts.map((t, i) => `t(${String(i + 1)})=${us(t)}`).join(' ') +
          ` µs\n              marginal ${us(marginal, 2)} µs/expansión  →  ${String(entran)} expansiones entran en 8 ms`,
      )
    }

    // Cuántos nodos hay en la cola: `plan()` reordena `abiertos` DESPUÉS DE CADA
    // EXPANSIÓN, y `comparaNodos` arma dos claves de texto por comparación cuando
    // los costos empatan. Con la cola en un solo nodo eso es gratis; con una cola
    // de decenas sería O(n log n) de armado de strings por expansión, y el
    // marginal de arriba dejaría de valer. Se mide para saber si vale.
    const abiertos: number[] = []
    for (let k = 1; k <= 6; k++) {
      const r = plan(meta(COMER), elRio(PEOR), k)
      abiertos.push(r.k === 'parcial' ? r.frontera.abiertos.length : 0)
    }

    console.log(
      `\n── (3) CUÁNTAS EXPANSIONES ENTRAN EN 8 ms ─────────────────────────\n` +
        filas.join('\n') +
        `\n\n  nodos abiertos en la cola tras k=1..6: ${abiertos.join(', ')} (0 = terminó)\n` +
        `  con la cola en uno o dos nodos, el \`sort\` de cada expansión no cuesta nada;\n` +
        `  el día que la cola tenga decenas, este marginal hay que volver a medirlo.\n` +
        `  El que gobierna es el PEOR: ${String(Math.min(...techos))} expansiones — y es ${num(Math.min(...techos) / EXPANSIONES_POR_TICK, 1)}× el presupuesto de ${String(EXPANSIONES_POR_TICK)}.\n`,
    )

    // ─── LA COLA DEJÓ DE SER DE UN SOLO NODO, Y SE SABE POR QUÉ ────────────
    //
    // Hasta el tramo G esto afirmaba `<= 1` y era cierto: para cada firma había una
    // sola vía. Después fue `<= 2`, cuando la tabla ganó la fila de la cocción:
    // `extraccion` declara `holding(tag:carnoso)` y la ley 5 promete una versión más
    // fuerte, y una versión más fuerte implica a la floja, así que la meta de comida
    // abre dos ramas. La de la ley cuesta 15 s contra 1,5: se arma, se ordena detrás
    // y NUNCA sale de la cola.
    //
    // Desde el tramo J son UNA POR GEOMETRÍA: la cocción tiene una fila por montaje
    // que se pueda armar —la parrilla y el contacto—, las dos prometen lo mismo y
    // las dos se abren. El techo se DERIVA de la tabla y no se escribe: agregar una
    // geometría lo mueve solo, y agregar una vía que no sea de ley lo pone rojo, que
    // es lo que hay que saber. Medido: la cola llega a 3 (una por ley más la de
    // `extraccion`).
    //
    // Lo que esto cuida no cambió: que la cola no llegue a decenas, porque ahí el
    // `sort` de cada expansión —dos claves de texto por comparación— dejaría de ser
    // gratis y el marginal de arriba habría que volver a medirlo.
    const techoDeLaCola = ESQUEMAS.filter((e) => e.k === 'ley').length + 1
    expect(techoDeLaCola).toBe(3)
    for (const a of abiertos) expect(a).toBeLessThanOrEqual(techoDeLaCola)
    if (!MIDIENDO_EN_SERIO) return
    // EL CRITERIO DEL TRAMO: 64 tiene que entrar en 8 ms hasta en la vista
    // saturada. Si esto se pone rojo, se BAJA `EXPANSIONES_POR_TICK` —nunca se
    // sube el presupuesto de D4, que comparte el tick con las otras 4999
    // criaturas— y el número al que se lo baja es el que esta línea imprimió.
    expect(Math.min(...techos)).toBeGreaterThan(EXPANSIONES_POR_TICK)
    // El tiempo de pared de este `it` —no el que mide, el que TARDA— pasó de 4,6 s a
    // 7,0 s cuando entró la fila de la cocción: son 4800 llamadas a `plan()` y cada
    // una arma una vía más. Se declara el techo en vez de dejar que el corte por
    // omisión de vitest (5 s) lo mate, que es un fallo que no dice nada de nada.
  }, 60_000)

  // ─── (4) Reanudar contra empezar de cero ─────────────────────────────────

  it('(4) reanudar desde la frontera contra empezar de cero', () => {
    // ─── LA PREGUNTA QUE PUEDE MATAR AL ANYTIME ─────────────────────────────
    //
    // Si reanudar costara casi lo mismo que empezar de cero, toda la maquinaria
    // de `Frontera` —los abiertos, los cerrados, los muertos, el `toEqual` que
    // los cuida— sería trabajo de más para no ahorrar nada, y lo correcto sería
    // replanificar entero cada tick. Se mide de las dos maneras que importan:
    //
    //   · EL TOTAL. La misma búsqueda cortada de a una expansión contra la misma
    //     búsqueda de una sola vez. Lo que la diferencia mide es el PEAJE del
    //     anytime: copiar los tres arreglos de la frontera y reordenar la cola,
    //     una vez por tirón.
    //   · EL TIRÓN. Lo que cuesta la expansión k+1 saliendo de la frontera de k,
    //     contra lo que costaría llegar a k+1 desde cero — que es lo que un
    //     planificador sin frontera paga TODOS los ticks.
    const casos: readonly (readonly [number, number, number])[] = [
      [0, 3000, 200],
      [PEOR, 300, 50],
    ]

    const filas: string[] = []
    const ahorros: number[] = []
    for (const [relleno, n, calentar] of casos) {
      const v = elRio(relleno)

      const entero = pct(
        muestras(() => {
          plan(meta(COMER), v, 5000)
        }, n, calentar),
        50,
      )
      const aTirones = pct(
        muestras(() => {
          let f: Frontera | undefined
          for (;;) {
            const r: PlanResult = plan(meta(COMER), v, 1, f)
            if (r.k !== 'parcial') break
            f = r.frontera
          }
        }, n, calentar),
        50,
      )

      // Las fronteras intermedias, una por cada corte posible.
      const fronteras: Frontera[] = []
      for (;;) {
        const r: PlanResult = plan(meta(COMER), v, 1, fronteras[fronteras.length - 1])
        if (r.k !== 'parcial') break
        fronteras.push(r.frontera)
      }

      const detalle: string[] = []
      let peorRazon = Number.POSITIVE_INFINITY
      for (let k = 1; k <= fronteras.length; k++) {
        const f = fronteras[k - 1] as Frontera
        const reanudando = pct(
          muestras(() => {
            plan(meta(COMER), v, 1, f)
          }, n, calentar),
          50,
        )
        const deCero = pct(
          muestras(() => {
            plan(meta(COMER), v, k + 1)
          }, n, calentar),
          50,
        )
        const razon = deCero / Math.max(reanudando, 1)
        if (razon < peorRazon) peorRazon = razon
        detalle.push(
          `      expansión ${String(k + 1)}: reanudando ${us(reanudando, 2).padStart(6)} µs   ` +
            `desde cero ${us(deCero, 2).padStart(6)} µs   ${num(razon, 1)}× más barato`,
        )
      }
      ahorros.push(peorRazon)

      // El peaje sale a veces NEGATIVO —las dos mediciones son medianas de series
      // distintas— y decir «−0,8%» sería presentar ruido como resultado. Lo que
      // el número dice de verdad es que el peaje está por debajo de la resolución
      // de este banco. Misma decisión que `banco-el-tick.test.ts` con la resta
      // del costo propio del mundo.
      const peaje = (aTirones / entero - 1) * 100
      filas.push(
        `  ${String(relleno + 3)} cuerpos:\n` +
          `      de una sola vez ......... ${us(entero, 2)} µs\n` +
          `      a tirones de 1 (${String(fronteras.length + 1)} llamadas) ... ${us(aTirones, 2)} µs   ` +
          `peaje del anytime: ${peaje > 2 ? `${num(peaje, 1)}%` : 'por debajo del ruido (< 2%)'}\n` +
          detalle.join('\n'),
      )
    }

    console.log(
      `\n── (4) REANUDAR CONTRA EMPEZAR DE CERO ────────────────────────────\n` +
        filas.join('\n') +
        `\n  El anytime SÍ sirve: el peor tirón sigue siendo ${num(Math.min(...ahorros), 1)}× más barato que\n` +
        `  rehacer la búsqueda, y cortarla entera de a una expansión cuesta casi lo\n` +
        `  mismo que no cortarla. Lo que hoy no sirve es el presupuesto: nunca corta.\n`,
    )

    if (!MIDIENDO_EN_SERIO) return
    // El criterio: reanudar tiene que ser estrictamente más barato que rehacer.
    // Si esto se cayera, la frontera sería peso muerto y habría que sacarla.
    expect(Math.min(...ahorros)).toBeGreaterThan(1)
  }, 60_000)

  // ─── (5) Lo que la fila de la cocción le cuesta a una meta de comida ─────

  it('(5) lo que la vía nueva le cuesta a la pesca, medido A/B', () => {
    // ─── LA PREGUNTA QUE HAY QUE HACERSE AL AGREGAR UNA FILA ────────────────
    //
    // `regresar` prueba TODAS las vías cuyos esquemas aporten alguna cláusula, y
    // armar una vía no es gratis: `armarMarco` llama a `candidatosPara` una vez por
    // rol pendiente, y eso barre la vista. La fila de la cocción tiene tres roles,
    // así que le agrega tres barridos a toda meta que hable de comida — incluida la
    // pesca pelada, que no la va a usar nunca porque cuesta diez veces más.
    //
    // Se mide A/B con la MISMA tabla menos esa fila, que es para lo que existe
    // `opciones.esquemas`. Si el sobrecosto creciera hasta comerse el presupuesto de
    // D4, la reparación no sería sacar la fila: sería que la regresión no arme una
    // vía cuyo costo ya supera al del mejor plan que tiene en la cola.
    const sinLey = ESQUEMAS.filter((e) => e.k !== 'ley')
    const filas: string[] = []
    let peorRazon = 0
    for (const [relleno, n, calentar] of [
      [0, 3000, 200],
      [TIPICA, 1500, 200],
      [PEOR, 300, 50],
    ] as const) {
      const v = elRio(relleno)
      const con = pct(
        muestras(() => {
          plan(meta(COMER), v, EXPANSIONES_POR_TICK)
        }, n, calentar),
        50,
      )
      const sin = pct(
        muestras(() => {
          plan(meta(COMER), v, EXPANSIONES_POR_TICK, undefined, { esquemas: sinLey })
        }, n, calentar),
        50,
      )
      const razon = con / Math.max(sin, 1)
      if (razon > peorRazon) peorRazon = razon
      filas.push(
        `  ${String(relleno + 3).padStart(3)} cuerpos: con la fila ${us(con, 1).padStart(8)} µs   ` +
          `sin ella ${us(sin, 1).padStart(8)} µs   ${num(razon, 2)}×`,
      )
    }
    // Y el plan que sale es EL MISMO: la vía nueva se arma, se ordena detrás por
    // costo y no cambia una coma de lo que la criatura va a hacer. Si esto fallara,
    // la fila no estaría costando tiempo: estaría cambiando la conducta.
    const conFila = plan(meta(COMER), elRio(0), EXPANSIONES_POR_TICK)
    const sinFila = plan(meta(COMER), elRio(0), EXPANSIONES_POR_TICK, undefined, { esquemas: sinLey })
    expect(conFila.k).toBe('plan')
    expect(conFila).toEqual(sinFila)
    console.log(
      `\n── (5) EL PRECIO DE LA VÍA NUEVA ──────────────────────────────────\n` +
        filas.join('\n') +
        `\n  el plan que sale es idéntico con y sin la fila: lo que cuesta es MIRARLA\n`,
    )
    if (!MIDIENDO_EN_SERIO) return
    expect(peorRazon).toBeLessThan(2)
  }, 60_000)
})
