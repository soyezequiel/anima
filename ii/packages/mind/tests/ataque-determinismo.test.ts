/**
 * EL GUARDIÁN DE LA REGLA 2, para el paquete que nació sin uno.
 *
 * «Ningún paquete determinista toca el reloj ni el azar del sistema.
 *  `Math.random`, `Date`, `performance`, `Intl`, `localeCompare` y `Math`
 *  trascendente están prohibidos.» (`ii/README.md`)
 *
 * Y hay que decir la parte incómoda, que es la misma que dice el guardián de
 * `@anima/perceive`: **esa regla no la hace cumplir ningún lint** — `grep -rn
 * "no-restricted"` sobre el repo da cero. La cuidan copias de esta lista de regex
 * en tests de cada paquete, o sea que **un paquete nuevo nace SIN guardián**.
 * `@anima/mind` nació sin el suyo: se escribieron `necesidades`, `creencias`,
 * `oportunidades`, `escalera` y `mente` con la regla en la cabeza y con nadie
 * mirando. Éste es el que mira.
 *
 * Está copiado de `perceive/tests/ataque-determinismo.test.ts` —que a su vez
 * viene de `world/tests/ataque-determinismo.test.ts:294`— a propósito: una lista
 * de prohibidos mantenida en un solo lugar y compartida entre paquetes sería un
 * import de test a test, y un test que se rompe cuando el de al lado se reordena
 * es peor que una copia que se lee entera en treinta segundos.
 *
 * Lee `readdirSync(src/)`, así que **un archivo nuevo entra solo**. La cota de
 * cuántos hay está para que BORRAR uno también se note.
 *
 * ─── LO ÚNICO QUE ESTA COPIA CAMBIA, Y POR QUÉ ──────────────────────────────
 *
 * La fila de la regla 1 está COMPLETA y no con cinco de los catorce nombres.
 * Medido: `packages/` publica diez paquetes `@anima/*` y `apps/` cuatro más, y la
 * copia de `perceive` nombra cinco. Los otros nueve entrarían sin que nada se
 * pusiera rojo, y `@anima/memory` —que es la memoria de Ánima I— es exactamente
 * la clase de módulo que alguien importaría de buena fe desde un paquete que se
 * llama «mind». La alternancia es de nombres exactos y termina en la comilla, así
 * que `@anima/mind`, `@anima/plan` y los otros seis del remake no la tocan; el
 * control negativo de abajo lo verifica uno por uno.
 *
 * ─── LO QUE ESTE GUARDIÁN NO PUEDE VER ──────────────────────────────────────
 *
 * Es un barrido de texto: ataja lo que está escrito, no lo que se importa. Un
 * `Math.random` adentro de una dependencia sigue siendo `Math.random`. Lo que
 * cubre esa mitad es el test de determinismo de la escalera —dos corridas con el
 * estado clonado, misma historia peldaño por peldaño— y el de la mente —dos
 * partidas gemelas con el mapa al revés, mismo hash de mundo tick a tick—. Este
 * archivo es la mitad barata; aquéllos son la cara.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const FUENTES = readdirSync(SRC).filter((f) => f.endsWith('.ts'))

/** Los diez de `packages/` y los cuatro de `apps/`, que es todo Ánima I. */
const ANIMA_I =
  'agent-core|memory|missions|model-providers|persistence|shared|sim-core|skill-evaluator|skill-runtime|test-scenarios|api|demo|missions-runner|web'

const PROHIBIDOS: readonly (readonly [RegExp, string])[] = [
  [/\bMath\.random\b/, 'el azar del sistema no se puede reproducir'],
  [/\bnew Date\b|\bDate\.now\b/, 'el reloj del mundo es el contador de ticks'],
  [/\bperformance\./, 'medir es del banco, no de la mente'],
  [/\bIntl\b|\blocaleCompare\b|\btoLocaleString\b/, 'el orden dependería del idioma del sistema'],
  [
    /\bMath\.(exp|pow|log|log2|log10|sqrt|cbrt|sin|cos|tan|asin|acos|atan|atan2|hypot|expm1|log1p|fround)\b/,
    'ECMAScript no especifica su precisión: dos motores devuelven el último bit distinto',
  ],
  [/\*\*/, 'la potencia es `Math.pow` con otra cara'],
  [new RegExp(`from '@anima/(${ANIMA_I})'`), 'regla 1: nada de Ánima I'],
  [/from '(\.\.\/)+packages\//, 'regla 1: nada de Ánima I'],
  [/from '(\.\.\/)+apps\//, 'regla 1: nada de Ánima I'],
  [/\bawait\b|\basync\b/, 'principio 1: el tick no tiene un solo `await`'],
]

/**
 * El fuente SIN comentarios: este paquete EXPLICA por qué `Math.exp` está
 * prohibido, por qué `toFixed` y no `toLocaleString`, y por qué no hay `await`, y
 * explicarlo no puede ser la infracción.
 *
 * El filtro es por línea y por su primer carácter no blanco, que es exactamente
 * la forma en que están escritos los comentarios de este repo: `//` para los de
 * encabezado y `*` para el cuerpo de un JSDoc. Un `/**` abre con `/*` y también
 * cae. Lo que NO tapa es un comentario al final de una línea de código, y está
 * bien que no lo tape: ahí el código está.
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
    // La cuenta va en el nombre del test para que agregar un módulo y olvidarse
    // de mirarlo sea visible en la salida. Siete: necesidades, creencias,
    // oportunidades, escalera, mente, tipos e index.
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
    // equivocado, o con una expresión que no engancha nada, y siempre da verde.
    const carnada: readonly string[] = [
      'const x = Math.random()',
      'const t = Date.now()',
      'const t = new Date()',
      'performance.now()',
      'a.localeCompare(b)',
      'const s = x.toLocaleString()',
      'Math.pow(2, 3)',
      'Math.sqrt(d2)',
      'const y = 2 ** 3',
      "import x from '@anima/sim-core'",
      "import { recordar } from '@anima/memory'",
      "import { algo } from '../../../packages/shared/src/x.js'",
      "import { algo } from '../../../apps/api/src/x.js'",
      'await algo()',
      'async function pensar() {}',
    ]
    for (const linea of carnada) {
      const pegó = PROHIBIDOS.some(([p]) => p.test(linea))
      expect(pegó, `el guardián no vio «${linea}»`).toBe(true)
    }
  })

  it('y NO detecta lo que sí está permitido', () => {
    // El control negativo. Sin él, un patrón demasiado ancho —`/Math\./`, o un
    // `@anima/` sin la lista de nombres— pasaría el test de arriba y volvería
    // inusable el paquete. Los siete imports de abajo son los que este `src/` usa
    // de verdad: si la fila de la regla 1 se pusiera glotona, la mente no podría
    // importar ni el planificador.
    const inocentes: readonly string[] = [
      'const d = Math.max(a, b)',
      'const n = Math.abs(x)',
      'const t = Math.ceil(at * hz)',
      'const f = Math.floor(ms / ventana)',
      'const h = Math.imul(a, b)',
      'const p = β.a / (β.a + β.b)',
      'return x.toFixed(2).replace(".", ",")',
      "import { specOf } from '@anima/physics'",
      "import { plan } from '@anima/plan'",
      "import { Contexto } from '@anima/perceive'",
      "import { ir } from '@anima/skills/innatas'",
      "import { COSTO_POR_CELDA } from '@anima/world'",
      "import { crearDios } from '@anima/oracle'",
      "import { decidir } from './escalera.js'",
    ]
    for (const linea of inocentes) {
      const pegó = PROHIBIDOS.filter(([p]) => p.test(linea))
      expect(pegó.map(([p]) => String(p)), `el guardián rebotó «${linea}»`).toEqual([])
    }
  })
})
