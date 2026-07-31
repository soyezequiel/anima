/**
 * EL GUARDIÁN DE LA REGLA 2, para un paquete que nació sin uno.
 *
 * «Ningún paquete determinista toca el reloj ni el azar del sistema.
 *  `Math.random`, `Date`, `performance`, `Intl`, `localeCompare` y `Math`
 *  trascendente están prohibidos.» (`ii/README.md`)
 *
 * Y hay que decir la parte incómoda: **esa regla no la hace cumplir ningún
 * lint** — `grep -rn "no-restricted"` sobre el repo da cero. La cuidan copias de
 * esta lista de regex en tests de cada paquete, o sea que **un paquete nuevo nace
 * SIN guardián**. Éste nació con el suyo, y está copiado de
 * `perceive/tests/ataque-determinismo.test.ts` a propósito: una lista de
 * prohibidos mantenida en un solo lugar y compartida entre paquetes sería un
 * import de test a test, que es peor.
 *
 * Lee `readdirSync(src/)`, así que **un archivo nuevo entra solo**. La cota de
 * cuántos hay está para que BORRAR uno también se note.
 *
 * ─── Este paquete no tiene ninguna excepción declarada en `src/` ────────────
 *
 * `perceive` tiene una —`src/bucle.ts` recibe el reloj de pared por parámetro— y
 * acá no hay ninguna: el juez no mide tiempo de pared ni tira un solo dado. Lee
 * el estado de un mundo que ya pasó y cuenta. Si algún día necesitara medir
 * cuánto tarda en juzgar, eso es del banco y no del juez.
 *
 * En `tests/` sí hay una y está acotada abajo, con su motivo y con su cerco: el
 * arnés que corre el criterio de emergencia importa `@anima/mind` y
 * `@anima/perceive` para poner una criatura viva adentro de veinte partidas. Es
 * UN archivo, y que sea uno se afirma.
 *
 * ─── Y una razón propia, que en este paquete pesa más que en los otros ──────
 *
 * El juez decide si el proyecto sigue. Un juez que dependa del `Math.random` del
 * sistema daría veredictos distintos sobre la misma partida, y un criterio de
 * corte que no se puede repetir no es un criterio: es una opinión con decimales.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const FUENTES = readdirSync(SRC).filter((f) => f.endsWith('.ts'))

const PROHIBIDOS: readonly (readonly [RegExp, string])[] = [
  [/\bMath\.random\b/, 'el azar del sistema no se puede reproducir'],
  [/\bnew Date\b|\bDate\.now\b/, 'el reloj del mundo es el contador de ticks'],
  [/\bperformance\./, 'medir es del banco, no del juez'],
  [/\bIntl\b|\blocaleCompare\b|\btoLocaleString\b/, 'el orden dependería del idioma del sistema'],
  [
    /\bMath\.(exp|pow|log|log2|log10|sqrt|cbrt|sin|cos|tan|asin|acos|atan|atan2|hypot|expm1|log1p|fround)\b/,
    'ECMAScript no especifica su precisión: dos motores devuelven el último bit distinto',
  ],
  [/\*\*/, 'la potencia es `Math.pow` con otra cara'],
  [/from '@anima\/(sim-core|agent-core|skill-runtime|web|api)'/, 'regla 1: nada de Ánima I'],
  [/from '(\.\.\/)+packages\//, 'regla 1: nada de Ánima I'],
  [/\bawait\b|\basync\b/, 'principio 1: el tick no tiene un solo `await`'],
  // Propia de este paquete, y es la que más importa acá: el juez NO puede
  // depender de la mente. Si algún día alguien lo importa para «tener a mano» una
  // constante, el criterio de emergencia pasa a estar evaluado por el autor de las
  // tablas, que es exactamente lo que el documento de arquitectura prohíbe.
  [/from '@anima\/(mind|plan|skills|perceive)'/, 'el juez es EXTERNO: no toca la mente'],
  // Y ésta es la otra mitad de la misma regla, del lado del dato en vez del
  // paquete: **el juez no mira intenciones**. `Intent` está exportado por
  // `@anima/world` y sería la puerta más fácil de todas — con el chorro de
  // intenciones a mano, «eligió la vara más liviana» se contesta leyendo el
  // `apply` que la mente emitió, incluido el que el mundo RECHAZÓ. Eso no es una
  // secuencia que ocurrió: es un plan que alguien tuvo. El juez sólo puede mirar
  // el estado del mundo y lo que el mundo narró.
  [/\bIntent\b/, 'una secuencia es un patrón de estado que OCURRIÓ, no un plan que alguien tuvo'],
]

/**
 * El fuente SIN comentarios: este paquete EXPLICA por qué `Math.exp` está
 * prohibido y por qué no importa `@anima/mind`, y explicarlo no puede ser la
 * infracción.
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
    // de mirarlo sea visible en la salida.
    expect(FUENTES.length).toBeGreaterThanOrEqual(6)
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
      'Math.pow(2, 3)',
      'const y = 2 ** 3',
      "import x from '@anima/sim-core'",
      'await algo()',
      "import { Mente } from '@anima/mind'",
      "import { decidir } from '@anima/plan'",
      'function mirar(i: Intent): void {}',
      "import type { Intent } from '@anima/world'",
    ]
    for (const linea of carnada) {
      const pegó = PROHIBIDOS.some(([p]) => p.test(linea))
      expect(pegó, `el guardián no vio «${linea}»`).toBe(true)
    }
  })

  it('y NO detecta lo que sí está permitido', () => {
    // El control negativo. Sin él, un patrón demasiado ancho —`/Math\./`— pasaría
    // el test de arriba y volvería inusable el paquete. Y el de `@anima/` tiene
    // que dejar pasar las DOS dependencias que el juez sí tiene.
    const inocentes: readonly string[] = [
      'const d = Math.max(a, b)',
      'const n = Math.abs(x)',
      'const t = Math.ceil(at * hz)',
      'const f = Math.floor(ms / ventana)',
      'const h = Math.imul(a, b)',
      "import { qualityOf, cumpleRol } from '@anima/physics'",
      "import { chebyshev } from '@anima/world'",
      "import type { SimEvent, WorldState } from '@anima/world'",
      // `IntentKind` no existe acá, pero `intencionPoner` sí aparece en los
      // comentarios y el filtro los saca; lo que este renglón cuida es que el
      // patrón de arriba pida la palabra ENTERA y no cualquier cosa que la
      // contenga, o el juez no podría ni nombrar al que escribe `covering`.
      'const escribeCovering = "intencionPoner"',
    ]
    for (const linea of inocentes) {
      const pegó = PROHIBIDOS.filter(([p]) => p.test(linea))
      expect(pegó.map(([p]) => String(p)), `el guardián rebotó «${linea}»`).toEqual([])
    }
  })

  it('el juez NO depende de la mente EN RUNTIME: `dependencies` son dos y son el motor', () => {
    // El guardián de arriba mira `src/`. Éste mira el manifiesto, que es donde la
    // dependencia se declara. Lo que se afirma es `dependencies` y nada más: es el
    // grafo que se despacha, el que dice de qué está hecho el juez, y ahí adentro
    // no puede aparecer nada que la mente toque.
    const deps = campoDelManifiesto('dependencies')
    expect(deps).toEqual(['@anima/physics', '@anima/world'])
  })

  it('y en `devDependencies` la mente SÍ está, con el motivo escrito y con su cerco', () => {
    // ─── POR QUÉ ESTE TEST CAMBIÓ, Y NO SE CAMBIÓ PARA DAR VERDE ──────────────
    //
    // La versión anterior afirmaba la lista ENTERA de dependencias
    // —`dependencies` + `devDependencies` + `peerDependencies`— con el argumento
    // de que «un `devDependencies` con la mente adentro sería igual de fatal,
    // porque el juez pasaría a poder mirar las tablas que juzga».
    //
    // El argumento es correcto sobre `src/` y no se toca: `src/` sigue teniendo
    // PROHIBIDO nombrar a `@anima/mind`, y lo vigila el primer test de este
    // archivo, leyendo el directorio, así que un módulo nuevo entra solo.
    //
    // Lo que el argumento no contemplaba es que el criterio de emergencia hay que
    // CORRERLO, y correrlo es poner una criatura con su `Mente` adentro de veinte
    // partidas. Ese arnés tiene que vivir en algún lado. Vive en
    // `tests/hito-5-la-emergencia.test.ts`, que es un test y no el juez: importa
    // la mente para ARMAR la partida y le pasa al `Detector` lo mismo que le
    // pasaría cualquier otro banco —`{ state, events }` por tick—. El juez no ve
    // la mente ni por accidente, que es lo que el documento de arquitectura pide.
    //
    // La alternativa era poner el banco en `@anima/mind` e importar el juez desde
    // ahí. Es defendible y se descartó por una razón: el que corre el criterio
    // debe poder decir «yo no toqué la mente», y con el banco adentro del paquete
    // de la mente la lista de secuencias y el arnés quedarían del mismo lado del
    // grafo. Acá quedan de lados distintos y el cerco es este archivo.
    //
    // EL CERCO, que es lo que hace que esto sea más fuerte y no más flojo: el
    // manifiesto se afirma campo por campo, y además se verifica que **un solo
    // archivo de `tests/` nombra a la mente**. Si mañana un segundo test la
    // importa —o peor, un helper compartido—, esto se pone rojo.
    expect(campoDelManifiesto('devDependencies')).toEqual([
      '@anima/mind',
      '@anima/perceive',
      'typescript',
      'vitest',
    ])
    expect(campoDelManifiesto('peerDependencies')).toEqual([])

    // Se busca la forma de IMPORT REAL —una línea que ARRANCA con `import`— y no
    // la mención del nombre. Hace falta por este archivo mismo: el guardián nombra
    // lo que prohíbe, en `PROHIBIDOS` y en la carnada, y las dos son código y no
    // comentario. Un import de ESM va siempre en la columna cero, así que la
    // diferencia entre nombrar y traer es exactamente el margen izquierdo.
    const dir = fileURLToPath(new URL('./', import.meta.url))
    const IMPORTA_LA_MENTE = /^import\b[^\n]*from '@anima\/(mind|perceive)'/m
    const tocan: string[] = []
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      if (IMPORTA_LA_MENTE.test(readFileSync(dir + f, 'utf8'))) tocan.push(f)
    }
    // ─── EL SEGUNDO ARCHIVO, Y POR QUÉ SE LO DEJA ENTRAR ─────────────────────
    //
    // Esta lista tenía UN nombre y el cerco funcionó exactamente como prometía:
    // se puso rojo cuando entró `ataque-al-tramo-i.test.ts`, y obligó a decidir en
    // vez de dejar pasar. La decisión, escrita acá y no en el archivo que entra:
    //
    // El ataque al tramo I mide si la reparación del `source` deja a la MENTE sin
    // banco para pescar, y esa pregunta no se puede contestar sin correr la mente:
    // «el planificador no elige este cuerpo» es una afirmación sobre `@anima/plan`,
    // y `@anima/juez` no lo tiene ni lo puede tener. Lo que sí puede es poner la
    // mente de verdad en la orilla y contar si la caña sale. Igual que el banco de
    // la emergencia, el archivo importa la mente para ARMAR la partida; el juez
    // —`src/`— sigue sin poder nombrarla, y eso lo vigila el PRIMER test de este
    // archivo leyendo el directorio, que es el cerco que de verdad importa.
    //
    // Y el cerco no se aflojó: sigue siendo una lista EXACTA, así que un tercer
    // archivo lo vuelve a poner rojo. Lo que cambió es el largo, no la regla.
    //
    // ─── EL TERCER ARCHIVO, Y POR QUÉ SE LO DEJA ENTRAR ──────────────────────
    //
    // `el-banco-de-la-mente.ts` no es un import NUEVO de la mente: es el banco de
    // la emergencia —`correrPartida`, las dos cohortes— que vivía adentro de
    // `hito-5-la-emergencia.test.ts` y se mudó a su propio módulo para que cinco
    // tandas lo corran en paralelo (la unidad de paralelismo de vitest es el
    // archivo, mismo movimiento que `azar.ts`). El import de `Mente` se mudó CON
    // el código que la usa, para lo mismo de siempre: ARMAR la partida. `src/`
    // sigue sin poder nombrarla, y eso lo vigila el primer test de este archivo.
    expect(tocan).toEqual([
      'ataque-al-tramo-i.test.ts',
      'el-banco-de-la-mente.ts',
      'hito-5-la-emergencia.test.ts',
    ])
  })
})

/** Las claves de un campo del manifiesto, ordenadas. `[]` si el campo no está. */
function campoDelManifiesto(campo: string): string[] {
  const raiz = fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg: unknown = JSON.parse(readFileSync(raiz, 'utf8'))
  if (typeof pkg !== 'object' || pkg === null) return []
  const d = (pkg as Record<string, unknown>)[campo]
  if (typeof d !== 'object' || d === null) return []
  // Con `<` y no con `localeCompare`: la regla 2 vale también acá.
  return Object.keys(d).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}
