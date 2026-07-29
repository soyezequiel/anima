// ─── EL GUARDIÁN DE LA REGLA 2, para un paquete que nació sin uno ────────────
//
//   «Ningún paquete determinista toca el reloj ni el azar del sistema.
//    `Math.random`, `Date`, `performance`, `Intl`, `localeCompare` y `Math`
//    trascendente están prohibidos.» (`ii/README.md`)
//
// Y hay que decir la parte incómoda, que es la razón de que este archivo exista:
// **esa regla no la hace cumplir ningún lint** — `grep -rn "no-restricted"` sobre
// el repo da cero. La cuidan copias de esta lista de regex en los tests de cada
// paquete, o sea que **un paquete nuevo nace SIN guardián**. `@anima/plan` nació
// así. Está copiado de `perceive/tests/ataque-determinismo.test.ts`, que a su vez
// lo copió de `world/`, y la copia es deliberada: una lista compartida entre
// paquetes sería un import de test a test —un test que depende del archivo de
// test de otro paquete— y eso es peor que tres copias que se leen solas.
//
// Vive en su propio archivo, con su propio nombre, por la misma razón por la que
// `banco-el-plan.test.ts` vive en el suyo: que la prohibición sea revisable de un
// vistazo. Quien quiera saber qué protege a `src/` del reloj abre el archivo que
// se llama como la pregunta.
//
// Lee `readdirSync(src/)`, así que **un archivo nuevo entra solo**. La cota de
// cuántos hay está para que BORRAR uno también se note: un guardián que lee un
// directorio vacío está en verde y no cuida nada.
//
// ─── Y ADEMÁS SE ATACA LO QUE LOS REGEX NO PUEDEN VER ───────────────────────
//
// Los regex miran el texto y no la conducta. Un `sort` por un float sin desempate
// por id no tiene ni una palabra prohibida y es no-determinismo puro: dos réplicas
// del mismo mundo eligen cuerpos distintos y divergen en el tick 400. Por eso la
// segunda mitad de este archivo no lee `src/` sino que lo CORRE, y lo corre con
// la entrada revuelta: `see()` no promete ningún orden —lo dice
// `skills/src/innatas/comun.ts:28`— así que un plan que dependa del orden en que
// la percepción devolvió los cuerpos es un plan que cambia solo.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { QualityId } from '@anima/physics'
import { evalQuality, specOf } from '@anima/physics'
import type { BodyId, BodyView, Cell, CellQuality, Clock, SelfView, Tag, Where } from '@anima/skills'

import { ESQUEMAS } from '../src/esquemas.js'
import { plan } from '../src/regresion.js'
import type { GoalNode, Predicado, VistaDelPlan } from '../src/tipos.js'

// ─── (1) El texto de `src/` ─────────────────────────────────────────────────

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

/**
 * El fuente SIN comentarios: este paquete EXPLICA por qué no tiene `performance`
 * y por qué el presupuesto se mide en expansiones, y explicarlo no puede ser la
 * infracción. `tipos.ts` nombra `performance.now` en su decisión 2.
 */
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
    // La cuenta va en el NOMBRE del test para que agregar un módulo y olvidarse
    // de mirarlo sea visible en la salida sin abrir el archivo.
    //
    // Siete: `predicado`, `referencias`, `esquemas`, `objetivos`, `regresion`,
    // `tipos` e `index`. La cota es `>= 7` y no `=== 7` porque un módulo nuevo
    // tiene que entrar sin tocar el guardián; lo que la cota ataja es el borrado.
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
    // Un guardián que no se prueba a sí mismo puede estar leyendo el directorio
    // equivocado, o con una expresión que no engancha nada, y da verde para
    // siempre. La carnada es una línea por patrón: si alguien agrega un patrón
    // y no su carnada, la cuenta de abajo lo delata.
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
      const pegó = PROHIBIDOS.some(([p]) => p.test(linea))
      expect(pegó, `el guardián no vio «${linea}»`).toBe(true)
    }
    // Cada patrón tiene que quedar cubierto por al menos una carnada. Sin esto,
    // agregar un regex mal escrito —uno que no engancha nada— pasa el test de
    // arriba porque las trece líneas ya las enganchaban los otros.
    for (const [p, porque] of PROHIBIDOS) {
      expect(
        carnada.some((l) => p.test(l)),
        `el patrón ${String(p)} (${porque}) no tiene carnada que lo pruebe`,
      ).toBe(true)
    }
  })

  it('y NO rebota lo que sí está permitido', () => {
    // El control negativo. Sin él, un patrón demasiado ancho —`/Math\./`— pasaría
    // el test de arriba y volvería inusable el paquete: `Math.max`, `Math.min`,
    // `Math.abs`, `Math.floor`, `Math.ceil` y `Math.imul` son EXACTAMENTE los que
    // la regla 2 permite, porque su resultado está especificado al bit.
    const inocentes: readonly string[] = [
      'const d = Math.max(a, b)',
      'const n = Math.abs(x)',
      'const c = Math.min(cuantos, tope)',
      'const f = Math.floor(x / 2)',
      'const t = Math.ceil(segundos * hz)',
      'const h = Math.imul(a, b)',
      "import { specOf, qualityOf } from '@anima/physics'",
      "import { distancia, porCercania } from '@anima/skills/innatas'",
      'const nombres = Object.keys(r).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))',
    ]
    for (const linea of inocentes) {
      const pegó = PROHIBIDOS.filter(([p]) => p.test(linea))
      expect(pegó.map(([p]) => String(p)), `el guardián rebotó «${linea}»`).toEqual([])
    }
  })
})

// ─── (2) La conducta: el orden en que llega la percepción no puede decidir ───
//
// Lo de arriba mira el texto. Esto corre el planificador, que es donde el
// no-determinismo de verdad se esconde: un `sort` sin desempate, un `Object.keys`
// que se recorre en orden de inserción, un «el primero que gana» sobre una lista
// que nadie ordenó. Nada de eso tiene una palabra prohibida adentro.
//
// El mundito es el mismo de `la-regresion.test.ts` —copiado y no importado: un
// test que depende del archivo de test de al lado se rompe cuando el de al lado
// se reordena— y lo único que cambia entre corridas es EL ORDEN DE `cuerpos`.

type Cualidades = Partial<Record<QualityId, number>>

function cuerpo(id: string, x: number, y: number, tags: readonly Tag[] = []): BodyView {
  // `tags` es lo que la superficie publica de la MATERIA (`tagsDe(body, phys)`),
  // y acá no hay materia: un cuerpo de mentira no está hecho de nada, así que por
  // omisión no tiene ninguna clase. Los tests que prueban `holding(tag:…)` la pasan.
  return { id, at: { x, y }, name: id, tags, madeByMe: false, joints: [] }
}

/**
 * `portable` la contesta EL MOTOR y no el fixture: la regresión se la pide a todo
 * rol de un proceso `held`, y escribir el tope de 8 kg acá sería su segunda copia.
 */
function portableDe(mass: number): number {
  const d = specOf('portable').derived
  if (d === undefined) throw new Error('`portable` dejó de ser derivada: el arnés se quedó viejo')
  const noHace = (): never => {
    throw new RangeError('`portable` sólo depende de `own(mass)`')
  }
  return evalQuality(d, { own: (q) => (q === 'mass' ? mass : 0), geom: noHace, sumParts: noHace, maxParts: noHace, substance: noHace })
}

/** Las celdas de agua franca: sin ellas no hay pozo. Ver `esquemas.ts`, `cellHints`. */
const AGUA: readonly Cell[] = [{ x: 8, y: 0 }]

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

function vista(cuerpos: readonly BodyView[], qs: ReadonlyMap<BodyId, Cualidades>): VistaDelPlan {
  const self = criatura()
  const qde = (b: BodyView, q: QualityId): number => {
    if (b.id === self.id && q === 'stamina') return self.stamina
    const puesta = qs.get(b.id)?.[q]
    if (puesta !== undefined) return puesta
    return q === 'portable' ? portableDe(qde(b, 'mass')) : 0
  }
  return {
    see(w: Where): readonly BodyView[] {
      // Se respeta el orden de `cuerpos` a propósito: eso es lo que se revuelve.
      return cuerpos.filter((b) =>
        w.every((t) => {
          const v = qde(b, t.q)
          return t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
        }),
      )
    },
    recall: () => [],
    q: qde,
    qAt: (at: Cell, q: CellQuality): number =>
      q === 'wet' && AGUA.some((c) => c.x === at.x && c.y === at.y) ? 1 : 0,
    self,
    clock: RELOJ,
  }
}

/** Los tres cuerpos de la pesca, con los números de las sustancias semilla. */
const CUERPOS_DEL_RIO: readonly BodyView[] = [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0)]

const QS_DEL_RIO = new Map<BodyId, Cualidades>([
  ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
  ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
  ['pozo', { mass: 50 }],
])

const COMER: Predicado = { k: 'sostiene', tag: 'carnoso' }

function meta(goal: Predicado): GoalNode {
  return { id: 'g0', goal, after: [], porque: 'ataque' }
}

/** Las `n!` permutaciones de una lista chica. Con tres cuerpos son seis. */
function permutaciones<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]]
  const out: T[][] = []
  for (let i = 0; i < xs.length; i++) {
    const resto = [...xs.slice(0, i), ...xs.slice(i + 1)]
    for (const p of permutaciones(resto)) out.push([xs[i] as T, ...p])
  }
  return out
}

describe('el orden en que la percepción entrega los cuerpos no decide nada', () => {
  it('las seis permutaciones de la vista del río dan EL MISMO plan', () => {
    // `see()` NO PROMETE ORDEN. Lo dice el comentario de `porCercania` en
    // `skills/src/innatas/comun.ts:28`, y de ahí sale el desempate por `id` que
    // `referencias.ts:202` y `regresion.ts:ganaA` copian. Este test es lo que
    // cae si alguien saca cualquiera de los dos: sin desempate, el rol `a` de
    // `union` —que no pide nada— se queda con el primero que llegó, y el primero
    // que llega depende del índice espacial del tick.
    const permutadas = permutaciones(CUERPOS_DEL_RIO)
    expect(permutadas).toHaveLength(6)
    const planes = permutadas.map((cs) => JSON.stringify(plan(meta(COMER), vista(cs, QS_DEL_RIO), 500)))
    const primero = planes[0] as string
    // Que sea un plan y no un `gap`: comparar seis fracasos idénticos sería
    // verde y no probaría nada.
    expect(primero).toContain('"k":"plan"')
    for (let i = 1; i < planes.length; i++) {
      expect(planes[i], `la permutación ${String(i)} dio otro plan`).toBe(primero)
    }
  })

  it('y con la tabla de esquemas revuelta, también', () => {
    // El otro orden que nadie promete: `ESQUEMAS` es un array, y `regresar()`
    // recorre sus vías en orden de aparición. Un planificador cuyo plan depende
    // de dónde quedó una fila en la tabla es no determinista de la peor manera:
    // no se nota hasta que alguien agrega un esquema al medio.
    const derecho = JSON.stringify(plan(meta(COMER), vista(CUERPOS_DEL_RIO, QS_DEL_RIO), 500))
    const alReves = JSON.stringify(
      plan(meta(COMER), vista(CUERPOS_DEL_RIO, QS_DEL_RIO), 500, undefined, { esquemas: [...ESQUEMAS].reverse() }),
    )
    expect(alReves).toBe(derecho)
  })

  it('y la misma llamada cien veces devuelve cien veces lo mismo', () => {
    // El piso de todo: `plan()` es una función de la vista. Si esto se pusiera
    // rojo, adentro habría estado global, y el estado global entre ticks es lo
    // que hace que dos réplicas del mismo mundo dejen de ser la misma partida.
    const v = vista(CUERPOS_DEL_RIO, QS_DEL_RIO)
    const primero = JSON.stringify(plan(meta(COMER), v, 500))
    for (let i = 0; i < 100; i++) expect(JSON.stringify(plan(meta(COMER), v, 500))).toBe(primero)
  })
})
