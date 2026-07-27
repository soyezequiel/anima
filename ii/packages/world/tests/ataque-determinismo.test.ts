// ─── ATAQUE AL PROPIO DETERMINISMO ───────────────────────────────────────────
//
// Los tests de los tres agentes prueban que el mundo ES determinista. Éste
// intenta lo contrario: buscar por dónde DEJARÍA de serlo. Son dos trabajos
// distintos y hace falta hacer los dos, porque un test de determinismo escrito
// por quien escribió el motor prueba lo que el autor pensó que podía fallar, y
// las divergencias de verdad salen de lo que nadie pensó.
//
// Los seis vectores, que son los seis lugares donde JavaScript te regala un orden
// que parece estable y no lo es:
//
//   1. recorrer un `Map` o un `Set` en orden de INSERCIÓN sin ordenar;
//   2. un `Object.keys()` que dependa del orden de creación;
//   3. punto flotante donde debería haber punto fijo;
//   4. `Math` trascendente colado en algún lado;
//   5. un snapshot que comparte referencia con el estado vivo en vez de copiarlo;
//   6. dos intenciones del mismo tick resueltas en distinto orden según quién las
//      emitió.
//
// Lo que se encontró y NO se pudo arreglar sin rediseñar queda con `it.fails` y
// el porqué al lado. Lo que se encontró y sí, está arreglado y con su prueba.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fx, unfx } from '@anima/physics'

import {
  CELL_LIMIT,
  cellFromKey,
  celdaAt,
  chunkKeysInOrder,
  compararIntenciones,
  createGrid,
  createSnapshotChain,
  hashWorld,
  hashWorldState,
  keyOfCell,
  ordenarIntenciones,
  placeBody,
  readCell,
  restoreAt,
  restoreWorld,
  serializeGrid,
  stepWorld,
  worldSlots,
  writeCell,
} from '../src/index.js'
import type { Intent, WorldBody, WorldState } from '../src/index.js'
import { actor, criatura, cuerpo, enElPiso, intencionesAlAzar, lcg, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number) => ({ x, y })
const NOMBRES = ['ana', 'beto', 'cira', 'dani', 'eze']

function partida(): WorldState {
  const bodies: WorldBody[] = []
  const actores = []
  for (let i = 0; i < NOMBRES.length; i++) {
    const n = NOMBRES[i] as string
    bodies.push(enElPiso(criatura(n, 500), EN(i - 2, i - 2)))
    actores.push(actor(n, { capacity: 3 }))
  }
  for (let i = 0; i < 4; i++) {
    bodies.push(enElPiso(cuerpo(`c${i}`, ['madera', 'liana', 'pescado', 'piedra'][i] as string, 1), EN(i, 4)))
  }
  return mundo({ bodies, actors: actores })
}

// ─── 1. El orden de inserción de un Map o un Set ─────────────────────────────

describe('1. recorrer un Map o un Set en orden de inserción', () => {
  it('el hash de un Map no cambia si se inserta al revés', () => {
    const derecho = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    const revés = new Map([
      ['c', 3],
      ['b', 2],
      ['a', 1],
    ])
    expect([...revés.keys()]).not.toEqual([...derecho.keys()])
    expect(hashWorld(revés)).toBe(hashWorld(derecho))
  })

  it('ni el de un Map de claves NUMÉRICAS, que es el caso de `cells`', () => {
    // `WorldState.cells` va por clave de celda, que es un número: no toma el
    // camino rápido de claves de texto sino el general, que ordena por el hash de
    // cada par. Es el camino menos transitado del hash y por eso se ataca aparte.
    const a = new Map<number, string>([
      [10, 'x'],
      [2, 'y'],
    ])
    const b = new Map<number, string>([
      [2, 'y'],
      [10, 'x'],
    ])
    expect([...b.keys()]).not.toEqual([...a.keys()])
    expect(hashWorld(b)).toBe(hashWorld(a))
  })

  it('un Set al que se le saca y se le vuelve a poner el mismo elemento no cambia', () => {
    // Ésta es la trampa fina: sacar y reinsertar manda el elemento AL FINAL del
    // orden de iteración. Un hash que recorriera el `Set` como viene diría que el
    // mundo cambió sin que cambiara nada.
    const s = new Set([1, 2, 3])
    const antes = hashWorld(s)
    s.delete(1)
    s.add(1)
    expect([...s]).toEqual([2, 3, 1])
    expect(hashWorld(s)).toBe(antes)
  })

  it('los chunks de la grilla salen ORDENADOS y no en orden de exploración', () => {
    const g = createGrid()
    // Se materializan en un orden que no es el canónico: primero lejos, después
    // cerca. Es lo que pasa cuando la criatura camina hacia el noroeste.
    for (const [x, y] of [
      [64, 64],
      [-64, -64],
      [0, 0],
      [16, -32],
    ]) {
      writeCell(g, EN(x as number, y as number), 'temperature', fx(20))
    }
    const enOrden = chunkKeysInOrder(g)
    expect(enOrden).not.toEqual([...g.chunks.keys()])
    expect([...enOrden].sort((a, b) => a - b)).toEqual(enOrden)
    // Y el snapshot sale en ese orden, no en el del `Map`.
    const s = serializeGrid(g)
    const claves = s.chunks.map((c) => c.cx + c.cy * 1e6)
    expect(claves.length).toBe(4)
    expect(hashWorld(serializeGrid(g))).toBe(hashWorld(s))
  })

  it('el mundo restaurado tiene los mapas en orden canónico, no en el del guardado', () => {
    // Un mundo que vuelve de un snapshot con los mapas en el orden en que se
    // escribieron las ranuras sería un mundo con la misma información y otro
    // recorrido — y `revisarOrden` lo rechazaría en el primer tick.
    const s = partida()
    const ranuras = new Map([...worldSlots(s)].reverse())
    const vuelto = restoreWorld(ranuras)
    expect([...vuelto.bodies.keys()]).toEqual([...s.bodies.keys()])
    expect([...vuelto.actors.keys()]).toEqual([...s.actors.keys()])
    expect(hashWorldState(vuelto)).toBe(hashWorldState(s))
  })

  it('y el catálogo de sustancias hashea igual venga en el orden que venga', () => {
    // La ley 4 da de alta sustancias en el orden en que los cuerpos se carbonizan.
    // Dos partidas que llegaron al mismo catálogo por caminos distintos lo tienen
    // en distinto orden de alta, y tienen que hashear igual: un catálogo es un
    // conjunto, no una historia.
    const s = partida()
    const alReves = { ...s.phys, substances: new Map([...s.phys.substances].reverse()) }
    expect([...alReves.substances.keys()]).not.toEqual([...s.phys.substances.keys()])
    expect(hashWorldState({ ...s, phys: alReves })).toBe(hashWorldState(s))
  })
})

// ─── 2. Object.keys y el orden de creación ───────────────────────────────────

describe('2. un Object.keys() que dependa del orden de creación', () => {
  it('dos vectores de cualidades armados en distinto orden hashean igual', () => {
    const a: Record<string, number> = {}
    a['stamina'] = 3
    a['temperature'] = 40
    a['wet'] = 0.5
    const b: Record<string, number> = {}
    b['wet'] = 0.5
    b['stamina'] = 3
    b['temperature'] = 40
    expect(Object.keys(b)).not.toEqual(Object.keys(a))
    expect(hashWorld(b)).toBe(hashWorld(a))
  })

  it('LA TRAMPA FINA: las claves que parecen enteros saltan al principio', () => {
    // El orden de `Object.keys` ni siquiera es consistente consigo mismo: las
    // claves que parecen índices salen PRIMERO y en orden numérico, sin importar
    // cuándo se insertaron. Un hash que heredara ese orden sería impredecible.
    const o: Record<string, number> = {}
    o['b'] = 1
    o['10'] = 2
    o['a'] = 3
    o['2'] = 4
    expect(Object.keys(o)).toEqual(['2', '10', 'b', 'a'])
    const otro: Record<string, number> = { '2': 4, a: 3, '10': 2, b: 1 }
    expect(hashWorld(otro)).toBe(hashWorld(o))
  })

  it('un cuerpo con la misma materia escrita en otro orden es el mismo cuerpo', () => {
    const s = partida()
    const c0 = s.bodies.get('c0') as WorldBody
    const conEstadoAlReves: WorldBody = {
      ...c0,
      body: { ...c0.body, state: { temperature: 30, stamina: 0.2 } },
    }
    const conEstadoDerecho: WorldBody = {
      ...c0,
      body: { ...c0.body, state: { stamina: 0.2, temperature: 30 } },
    }
    const uno = new Map(s.bodies).set('c0', conEstadoAlReves)
    const otro = new Map(s.bodies).set('c0', conEstadoDerecho)
    expect(hashWorldState({ ...s, bodies: uno })).toBe(hashWorldState({ ...s, bodies: otro }))
  })

  it('una propiedad `undefined` hashea igual que la propiedad ausente', () => {
    // Es el criterio de sobrevivir al viaje por JSON: `JSON.stringify` borra las
    // propiedades `undefined`. Si no hashearan igual, guardar la partida y volver
    // a cargarla CAMBIARÍA su hash y el legado no cerraría nunca.
    expect(hashWorld({ a: 1, b: undefined })).toBe(hashWorld({ a: 1 }))
    // Y adentro de un arreglo LANZA, porque ahí JSON lo convierte en `null`.
    expect(() => hashWorld([1, undefined])).toThrow(TypeError)
  })
})

// ─── 3. Punto flotante donde debería haber punto fijo ────────────────────────

describe('3. punto flotante donde debería haber punto fijo', () => {
  it('el terreno de la grilla NO puede guardar una fracción viva', () => {
    // Los campos de celda son `Int32Array` de `Fixed` (ADR II-0006): lo que entra
    // se cuantiza a milésimos. Es la propiedad que hace que el terreno no acumule
    // error, y se verifica en vez de confiarse.
    const g = createGrid()
    writeCell(g, EN(3, 3), 'temperature', fx(0.1 + 0.2))
    const leido = readCell(g, EN(3, 3), 'temperature')
    expect(Number.isInteger(leido as number)).toBe(true)
    expect(unfx(leido)).toBe(0.3)
    // El clásico: en doubles, 0.1 + 0.2 no es 0.3. En punto fijo, sí.
    expect(0.1 + 0.2).not.toBe(0.3)
  })

  it('sumar y restar la misma cobertura vuelve exactamente al mismo terreno', () => {
    // La simetría de poner y sacar. En doubles esto acumula error y el estado
    // pasa a depender del ORDEN en que se puso cada cosa, que es exactamente lo
    // que el criterio del hito prohíbe.
    const g = createGrid()
    const antes = hashWorld(serializeGrid(g))
    for (let i = 0; i < 100; i++) writeCell(g, EN(1, 1), 'wet', fx(0.1 * (i % 7)))
    writeCell(g, EN(1, 1), 'wet', fx(0))
    expect(hashWorld(serializeGrid(g))).toBe(antes)
  })

  /**
   * HUECO ABIERTO, y es el más grande que queda del hito.
   *
   * `chunk.ts` guarda el terreno en `Fixed` —enteros de milésimos— y `step.ts`
   * guarda `WorldState.cells` en `number` pelado. Son DOS representaciones de la
   * misma celda, con dos precisiones distintas, y hoy no se hablan: el paso del
   * mundo no lee la grilla. El día que se enchufen —que es lo que el Hito 3
   * necesita, porque el oráculo escribe terreno— una celda que valga 15.0004 en
   * el paso del mundo va a valer 15.000 al pasar por el chunk, y el mundo va a
   * tener dos temperaturas para el mismo lugar según a quién se le pregunte.
   *
   * No se arregla acá porque no es un bug del mundo: es que `@anima/physics`
   * corre en doubles y su migración a punto fijo es otro trabajo (ADR II-0006 lo
   * dice: `fx`/`unfx` es la única puerta y `celdaAt` es el único sitio donde el
   * mundo la cruza). Lo que sí se puede hacer hoy es dejarlo MEDIDO, para que
   * cuando alguien enchufe las dos mitades sepa cuánto se pierde.
   */
  it.fails('las dos representaciones de una celda coinciden bit a bit', () => {
    const g = createGrid()
    const enDoubles = { wet: 0.5, oxygen: 1, temperature: 15.0004 }
    writeCell(g, EN(0, 0), 'wet', fx(enDoubles.wet))
    writeCell(g, EN(0, 0), 'oxygen', fx(enDoubles.oxygen))
    writeCell(g, EN(0, 0), 'temperature', fx(enDoubles.temperature))
    const enLaGrilla = celdaAt(g, EN(0, 0))
    expect(enLaGrilla.ambiente).toBe(enDoubles.temperature)
  })

  it('y lo que se pierde en ese cruce está acotado: media milésima', () => {
    // La cota es la mitad de la escala de `Fixed`. Que esté escrita convierte el
    // hueco de arriba en un número: cuando se enchufen las dos mitades, el error
    // por celda y por tick va a ser ≤ 0.0005, y de ahí sale si hace falta migrar
    // las leyes a punto fijo antes del Hito 3 o después.
    const g = createGrid()
    let peor = 0
    for (let i = 0; i < 500; i++) {
      const v = 15 + i * 0.0007
      writeCell(g, EN(0, 0), 'temperature', fx(v))
      const d = Math.abs(celdaAt(g, EN(0, 0)).ambiente - v)
      if (d > peor) peor = d
    }
    // La cota es 0.0005 más el propio ruido de esta resta: `peor` se calcula en
    // doubles, así que medir medio milésimo cuesta unos ulps. Escribir 0.00051 y
    // no «≤ 0.0005» es decir la verdad sobre lo que se midió.
    expect(peor).toBeLessThan(0.00051)
  })
})

// ─── 4. Math trascendente, el reloj y el azar ────────────────────────────────

describe('4. Math trascendente, el reloj, el azar y Ánima I', () => {
  /**
   * Los tres agentes dejaron cada uno un guardián sobre SUS archivos: uno miraba
   * tres, otro miraba tres, y `mundo.ts` e `index.ts` no los miraba nadie. Un
   * guardián que cubre una parte del paquete da una falsa sensación de cobertura,
   * que es peor que no tenerlo: éste lee el directorio y se entera solo de los
   * archivos nuevos.
   */
  const SRC = fileURLToPath(new URL('../src/', import.meta.url))
  const FUENTES = readdirSync(SRC).filter((f) => f.endsWith('.ts'))

  const PROHIBIDOS: readonly (readonly [RegExp, string])[] = [
    [/\bMath\.random\b/, 'el azar del sistema no se puede reproducir'],
    [/\bnew Date\b|\bDate\.now\b/, 'el reloj del mundo es el contador de ticks'],
    [/\bperformance\./, 'medir es del banco, no del mundo'],
    [/\bIntl\b|\blocaleCompare\b|\btoLocaleString\b/, 'el orden dependería del idioma del sistema'],
    [
      /\bMath\.(exp|pow|log|log2|log10|sqrt|cbrt|sin|cos|tan|asin|acos|atan|atan2|hypot|expm1|log1p|fround)\b/,
      'ECMAScript no especifica su precisión: dos motores devuelven el último bit distinto',
    ],
    [/\*\*/, 'la potencia es `Math.pow` con otra cara'],
    [/from '@anima\/(sim-core|agent-core|skill-runtime|web|api)'/, 'regla 1: nada de Ánima I'],
    [/from '(\.\.\/)+packages\//, 'regla 1: nada de Ánima I'],
  ]

  /** El fuente sin comentarios: este paquete EXPLICA por qué `Math.exp` está
   *  prohibido, y explicarlo no puede ser la infracción. */
  function codigoDe(archivo: string): string {
    return readFileSync(SRC + archivo, 'utf8')
      .split('\n')
      .filter((l) => {
        const t = l.trimStart()
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
      })
      .join('\n')
  }

  it(`los ${FUENTES.length} fuentes del paquete, no tres`, () => {
    // La cuenta va en el nombre del test para que agregar un módulo y olvidarse
    // de mirarlo sea visible en la salida.
    expect(FUENTES.length).toBeGreaterThanOrEqual(11)
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
    const carnada = [
      'const x = Math.random()',
      'const t = Date.now()',
      'const t = new Date()',
      'performance.now()',
      "a.localeCompare(b)",
      'new Intl.Collator()',
      'Math.exp(1)',
      'Math.pow(2, 3)',
      'Math.sqrt(2)',
      'const y = 2 ** 3',
      "import { x } from '@anima/sim-core'",
      "import { y } from '../../packages/sim-core/src/x.js'",
    ]
    for (const linea of carnada) {
      const enganchado = PROHIBIDOS.some(([p]) => p.test(linea))
      expect(`${linea} -> ${String(enganchado)}`).toBe(`${linea} -> true`)
    }
  })

  it('el único Math que aparece es el de precisión especificada', () => {
    // `imul`, `floor`, `trunc`, `abs`, `min` y `max` sí están especificadas bit a
    // bit. La lista blanca se escribe una vez y se verifica; sin ella, «no hay
    // Math trascendente» es una promesa y no un hecho.
    const PERMITIDO = new Set(['imul', 'floor', 'trunc', 'abs', 'min', 'max', 'isInteger', 'isSafeInteger'])
    const vistos = new Set<string>()
    for (const archivo of FUENTES) {
      for (const m of codigoDe(archivo).matchAll(/\bMath\.([A-Za-z0-9_]+)/g)) {
        vistos.add(m[1] as string)
      }
    }
    expect([...vistos].filter((v) => !PERMITIDO.has(v))).toEqual([])
  })
})

// ─── 5. Un snapshot que comparte referencia con el estado vivo ───────────────

describe('5. un snapshot que comparte referencia con el estado vivo', () => {
  it('el paso del mundo no muta lo que le dan: es copia-al-escribir', () => {
    // Es el contrato que hace segura la referencia. `snapshot.ts` guarda el valor
    // tal cual —clonarlo sería el `structuredClone` que existe para no pagar— así
    // que si `stepWorld` mutara un cuerpo en el lugar, el delta VIEJO cambiaría
    // con él y la historia se reescribiría sola.
    let s = partida()
    const r = lcg(99)
    for (let t = 0; t < 40; t++) {
      const previo = s
      const antes = hashWorldState(previo)
      s = stepWorld(previo, intencionesAlAzar(r, NOMBRES, 5)).state
      expect(hashWorldState(previo)).toBe(antes)
    }
  })

  it('un delta tomado hace veinte ticks sigue describiendo el mundo de hace veinte ticks', () => {
    const cadena = createSnapshotChain<unknown>()
    let s = partida()
    cadena.take(0, worldSlots(s))
    const enElCinco: number[] = []
    const r = lcg(7)
    for (let t = 0; t < 20; t++) {
      s = stepWorld(s, intencionesAlAzar(r, NOMBRES, 5)).state
      if (t === 4) enElCinco.push(t)
    }
    const d = cadena.take(20, worldSlots(s))
    const foto = hashWorldState(restoreWorld(restoreAt(cadena.deltas, d.index)))
    // Se sigue corriendo el mundo veinte ticks más: el eslabón guardado NO se
    // puede mover por eso.
    for (let t = 0; t < 20; t++) s = stepWorld(s, intencionesAlAzar(r, NOMBRES, 5)).state
    expect(hashWorldState(restoreWorld(restoreAt(cadena.deltas, d.index)))).toBe(foto)
    expect(hashWorldState(s)).not.toBe(foto)
    expect(enElCinco).toEqual([4])
  })

  /**
   * LA TRAMPA, DEMOSTRADA. Si alguien muta una ranura que ya entró a un delta, el
   * snapshot viejo cambia con ella. Ningún modo de comparación salva de eso —lo
   * único que salva es que el mundo sea de copia-al-escribir— pero el hash de cada
   * delta hace que se caiga RUIDOSAMENTE al restaurar, con el índice del eslabón,
   * en vez de devolver un mundo coherente y falso.
   *
   * Se prueba con una ranura mutable a mano porque el mundo de verdad no la tiene:
   * es la prueba de que la defensa funciona el día que alguien la introduzca.
   */
  it('y si alguien muta una ranura guardada, restaurar LANZA en vez de mentir', () => {
    const cadena = createSnapshotChain<{ calor: number }>()
    const ranura = { calor: 1 }
    cadena.take(0, new Map([['x', ranura]]))
    ranura.calor = 2
    expect(() => cadena.restore(0)).toThrow(/snapshot corrupto/)
  })
})

// ─── 6. Dos intenciones del mismo tick, según quién las emitió ───────────────

describe('6. dos intenciones del mismo tick resueltas en distinto orden', () => {
  it('el orden es TOTAL: entre dos intenciones distintas nunca hay empate', () => {
    // Si dos pudieran empatar, quién va primero lo decidiría la estabilidad del
    // `sort` del motor — y ahí se acabó el mismo hash en dos navegadores. Se
    // barren 400 intenciones arbitrarias y se exige que ningún par distinto dé 0.
    const is = intencionesAlAzar(lcg(13), NOMBRES, 400)
    const ordenadas = ordenarIntenciones(is)
    let empates = 0
    for (let i = 1; i < ordenadas.length; i++) {
      const a = ordenadas[i - 1] as Intent
      const b = ordenadas[i] as Intent
      if (compararIntenciones(a, b) === 0) empates++
    }
    // Los únicos empates posibles son (mismo actor, mismo seq), y ésos el mundo
    // los RECHAZA a los dos en vez de desempatarlos.
    for (let i = 1; i < ordenadas.length; i++) {
      const a = ordenadas[i - 1] as Intent
      const b = ordenadas[i] as Intent
      if (compararIntenciones(a, b) === 0) expect(a.by === b.by && a.seq === b.seq).toBe(true)
    }
    expect(empates).toBe(0)
  })

  it('ordenar es idempotente y no depende de por dónde venga el arreglo', () => {
    const una = ordenarIntenciones(intencionesAlAzar(lcg(11), NOMBRES, 200))
    expect(ordenarIntenciones([...una].reverse())).toEqual(una)
    expect(ordenarIntenciones(una)).toEqual(una)
  })

  it('la comparación de texto NO usa el locale: la «I» turca no reordena el mundo', () => {
    // `localeCompare` con locale turco ordena «I» e «ı» distinto que con el de
    // acá. Un mundo que ordenara actores así hashearía distinto según la
    // configuración del sistema operativo del jugador.
    // La demostración: LA MISMA PAREJA, dos locales, dos respuestas opuestas. En
    // alemán la «ä» va con la «a» y antes de la «z»; en sueco es una letra aparte
    // y va DESPUÉS de la «z». Un mundo que ordenara así hashearía distinto según
    // la configuración del sistema operativo del jugador.
    expect('ä'.localeCompare('z', 'de')).toBeLessThan(0)
    expect('ä'.localeCompare('z', 'sv')).toBeGreaterThan(0)

    // El del paquete contesta una sola cosa, y es la unidad de código: 0x00E4
    // contra 0x007A. No depende de nada de afuera.
    const ä: Intent = { k: 'wait', by: 'ä', seq: 0, commitment: 'reversible', ticks: 1 }
    const z: Intent = { k: 'wait', by: 'z', seq: 0, commitment: 'reversible', ticks: 1 }
    expect(compararIntenciones(ä, z)).toBeGreaterThan(0)
    expect(compararIntenciones(z, ä)).toBeLessThan(0)
  })

  it('barajar las intenciones de un tick no mueve el mundo, veinte veces seguidas', () => {
    // El ataque de fuerza bruta al vector 6: el mismo tick con las mismas
    // intenciones en veinte órdenes de llegada distintos.
    const s = partida()
    const is = [...intencionesAlAzar(lcg(21), NOMBRES, 25)]
    const esperado = hashWorldState(stepWorld(s, is).state)
    const r = lcg(1234)
    for (let v = 0; v < 20; v++) {
      const barajado = [...is]
      for (let i = barajado.length - 1; i > 0; i--) {
        const j = r.entero(i + 1)
        const tmp = barajado[i] as Intent
        barajado[i] = barajado[j] as Intent
        barajado[j] = tmp
      }
      expect(hashWorldState(stepWorld(s, barajado).state)).toBe(esperado)
    }
  })

  it('y dos intenciones EMPATADAS se rechazan las dos, no se desempatan', () => {
    const s = partida()
    const dos: Intent[] = [
      { k: 'goTo', by: 'ana', seq: 0, commitment: 'reversible', to: EN(9, 9), within: 0 },
      { k: 'goTo', by: 'ana', seq: 0, commitment: 'reversible', to: EN(-9, -9), within: 0 },
    ]
    const derecho = stepWorld(s, dos)
    const revés = stepWorld(s, [...dos].reverse())
    expect(hashWorldState(revés.state)).toBe(hashWorldState(derecho.state))
    expect(derecho.events.filter((e) => e.k === 'rechazada' && e.por === 'orden-duplicado')).toHaveLength(2)
  })
})

// ─── La geometría, que es donde una divergencia sería silenciosa ─────────────

describe('la clave de celda, atacada', () => {
  it('es biyectiva en los cuatro cuadrantes y en los bordes', () => {
    // Del lado negativo del mundo es donde un `>>` mal elegido rompe: `-1 >> 4` es
    // −1 (piso) y `Math.trunc(-1/16)` es 0. El error solo aparece a la izquierda
    // del origen, o sea en la mitad del mapa que nadie prueba.
    const vistos = new Set<number>()
    for (const x of [-CELL_LIMIT, -1000, -17, -1, 0, 1, 17, 1000, CELL_LIMIT - 1]) {
      for (const y of [-CELL_LIMIT, -1000, -17, -1, 0, 1, 17, 1000, CELL_LIMIT - 1]) {
        const k = keyOfCell(EN(x, y))
        expect(Number.isSafeInteger(k)).toBe(true)
        expect(vistos.has(k)).toBe(false)
        vistos.add(k)
        expect(cellFromKey(k)).toEqual({ x, y })
      }
    }
  })

  it('la cota del mundo mantiene las claves bajo 2⁵³, que es donde el double miente', () => {
    const maxima = keyOfCell(EN(CELL_LIMIT - 1, CELL_LIMIT - 1))
    expect(maxima).toBeLessThan(Number.MAX_SAFE_INTEGER)
    // Y la de al lado es DISTINTA: si la clave máxima pasara de 2⁵³, dos celdas
    // vecinas caerían en el mismo double y el mundo colisionaría en silencio.
    expect(keyOfCell(EN(CELL_LIMIT - 2, CELL_LIMIT - 1))).not.toBe(maxima)
  })

  it('mover un cuerpo a la misma celda no reordena la cubeta', () => {
    // Si sacara y volviera a poner, el cuerpo saltaría al final y el orden de
    // llegada dejaría de ser el orden de llegada — o sea que el estado dependería
    // de cuántas veces alguien pidió lo mismo.
    const g = createGrid()
    placeBody(g, 'a', EN(0, 0))
    placeBody(g, 'b', EN(0, 0))
    placeBody(g, 'c', EN(0, 0))
    const antes = hashWorld(serializeGrid(g))
    for (let i = 0; i < 10; i++) placeBody(g, 'a', EN(0, 0))
    expect(hashWorld(serializeGrid(g))).toBe(antes)
  })

  it('y LEER el mundo no lo cambia: mirar no materializa', () => {
    // La propiedad que el Hito 3 va a exigir. Si leer materializara, dos partidas
    // idénticas exploradas en distinto orden tendrían distinta cantidad de chunks
    // vivos y distinto hash.
    const g = createGrid()
    writeCell(g, EN(0, 0), 'wet', fx(0.5))
    const antes = hashWorld(serializeGrid(g))
    for (let x = -200; x < 200; x += 7) {
      for (let y = -200; y < 200; y += 7) readCell(g, EN(x, y), 'temperature')
    }
    expect(hashWorld(serializeGrid(g))).toBe(antes)
  })
})
