// ─── EL HITO 5, TRAMO F: LA DESCOMPOSICIÓN Y EL ORDEN PARCIAL ────────────────
//
// El requisito 6 del documento de arquitectura, que es el ADR 0053 + 0082 de
// Ánima I portados. Los criterios, escritos ANTES de implementar:
//
//   (a) EL EJEMPLO DEL DOCUMENTO, ENTERO. «hacé una caña y andá a pescar,
//       después asá el pescado» da TRES nodos, con dos sueltos entre sí y el
//       tercero después de los dos —orden parcial y no lista— y con la ligadura
//       diferida del pescado apuntando a la cláusula que lo pesca.
//   (b) UNA CLÁUSULA SOLA no es un caso especial: un nodo, sin `after`, sin
//       `binds`. Es la forma en que la mente va a pedir la enorme mayoría de las
//       cosas hasta el Hito 6, así que si sólo anduviera el caso de tres, el
//       paquete no serviría para lo que se usa todos los ticks.
//   (c) UN CICLO SE DETECTA Y SE NOMBRA. Ni se cuelga ni devuelve una lista corta
//       en silencio, que es lo que hace Kahn si nadie mira el largo.
//   (d) EL ORDEN ES ESTABLE CONTRA EL ORDEN DE ENTRADA. Mismo grafo, nodos
//       barajados, mismo resultado — para todas las permutaciones, no para una.
//   (e) UN `after` QUE APUNTA AFUERA DEL GRAFO LANZA. Es la restricción que no se
//       puede ni mirar, y dejarla pasar libera al nodo para correr antes de lo
//       que esperaba: plan verde, mundo mal.
//
// Y dos que este archivo agregó porque sin ellos los de arriba no significarían
// nada:
//
//   · LA TRAMPA DEL COMPARADOR NO TRANSITIVO, con su contraejemplo corriendo. Un
//     desempate que mezcla criterios sin clave común le da a `sort` un resultado
//     que depende del algoritmo del motor, o sea no-determinismo escondido justo
//     en la función que existe para que el orden sea determinista.
//   · LAS DOS CONTRADICCIONES DE LA LECTURA (bindear al vacío, bindear sin
//     ordenar) LANZAN. Si en vez de lanzar soltaran el `binds`, el grafo saldría
//     verde y plausible con una referencia menos, y el fracaso aparecería tres
//     capas más abajo como un `Ref` que no resuelve — que es exactamente el vicio
//     de `parsePromesa` que este paquete vino a no repetir.

import { describe, expect, it } from 'vitest'

import { goalGraph, orden, type Lectura } from '../src/objetivos.js'
import type { GoalNode, Predicado } from '../src/tipos.js'

// ─── El vocabulario ──────────────────────────────────────────────────────────
//
// Predicados REALES del mundo semilla y no inventados para el test: `catch>0` es
// lo que `extraccion` le pide al aparejo, `holding(tag:carnoso)` es lo que
// `extraccion` establece, y `temperature>=400` es lo que `friccion` establece.
// Un test de descomposición no toca la física, pero usar predicados que no
// existen invitaría a que el grafo signifique algo que el mundo no puede cumplir.

const CAÑA: Predicado = { k: 'cualidad', test: { q: 'catch', op: '>', v: 0 } }
const PESCADO_EN_MANO: Predicado = { k: 'sostiene', tag: 'carnoso' }
const ASADO: Predicado = { k: 'cualidad', test: { q: 'temperature', op: '>=', v: 400 } }

/**
 * La frase del documento, tal cual: dos cláusulas ligadas con «y» y una tercera
 * con «después» que además nombra el rendimiento de la segunda.
 */
const LECTURA_DEL_DOCUMENTO: Lectura = {
  clausulas: [
    { goal: CAÑA, liga: 'y', porque: 'hacé una caña' },
    { goal: PESCADO_EN_MANO, liga: 'y', porque: 'andá a pescar' },
    { goal: ASADO, liga: 'despues', bindeaSlot: 'target', porque: 'después asá el pescado' },
  ],
}

/** Todas las permutaciones, para probar contra el orden de entrada y no contra uno. */
function permutaciones<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]]
  const salida: T[][] = []
  for (let i = 0; i < xs.length; i++) {
    const cabeza = xs[i]
    if (cabeza === undefined) continue
    for (const resto of permutaciones([...xs.slice(0, i), ...xs.slice(i + 1)])) {
      salida.push([cabeza, ...resto])
    }
  }
  return salida
}

function nodo(id: string, after: readonly string[]): GoalNode {
  return { id, goal: CAÑA, after, porque: `nodo ${id}` }
}

// ─── (a) el ejemplo del documento ────────────────────────────────────────────

describe('«hacé una caña y andá a pescar, después asá el pescado»', () => {
  it('da tres nodos, con el orden parcial y la ligadura diferida', () => {
    const g = goalGraph(LECTURA_DEL_DOCUMENTO)

    // El grafo ENTERO y no tres `expect` sueltos: así un campo de más —un `binds`
    // que se cuela donde nadie lo pidió— también falla.
    expect(g).toEqual([
      { id: 'g0', goal: CAÑA, after: [], porque: 'hacé una caña' },
      { id: 'g1', goal: PESCADO_EN_MANO, after: [], porque: 'andá a pescar' },
      {
        id: 'g2',
        goal: ASADO,
        after: ['g0', 'g1'],
        // El documento lo escribe `{ slot: 'target', from: 'g2' }` sobre ids que
        // empiezan en `g1`; acá los ids salen del índice de la cláusula, que
        // empieza en cero, así que el mismo nodo se llama `g1`. La ligadura es la
        // misma: apunta a la cláusula que pesca, no a la que hace la caña.
        binds: { slot: 'target', from: 'g1' },
        porque: 'después asá el pescado',
      },
    ])
  })

  it('las dos primeras quedan SUELTAS entre sí: ninguna nombra a la otra', () => {
    // Es la mitad del requisito que se pierde si uno escribe una lista: el orden
    // total saldría igual de `orden()`, pero el grafo estaría MINTIENDO sobre una
    // restricción que la frase no puso, y el planificador la respetaría.
    const g = goalGraph(LECTURA_DEL_DOCUMENTO)
    expect(g[0]?.after).toEqual([])
    expect(g[1]?.after).toEqual([])
  })

  it('y se linealiza en el orden en que se dijo', () => {
    expect(orden(goalGraph(LECTURA_DEL_DOCUMENTO))).toEqual(['g0', 'g1', 'g2'])
  })

  it('una cláusula «despues» SIN `bindeaSlot` ordena y no bindea', () => {
    // El otro lado del contrato: el `after` es de la ligadura temporal, el
    // `binds` es de la referencia. Pedir uno no puede regalar el otro.
    const g = goalGraph({
      clausulas: [
        { goal: CAÑA, liga: 'y', porque: 'hacé una caña' },
        { goal: ASADO, liga: 'despues', porque: 'después prendé fuego' },
      ],
    })
    expect(g[1]?.after).toEqual(['g0'])
    expect(g[1]?.binds).toBeUndefined()
  })

  it('un grupo puede tener varios hermanos, y siguen sueltos entre ellos', () => {
    // «hacé una caña, después andá a pescar y prendé fuego»: los dos últimos van
    // después del primero y en cualquier orden entre ellos.
    const g = goalGraph({
      clausulas: [
        { goal: CAÑA, liga: 'y', porque: 'hacé una caña' },
        { goal: PESCADO_EN_MANO, liga: 'despues', porque: 'después andá a pescar' },
        { goal: ASADO, liga: 'y', porque: 'y prendé fuego' },
      ],
    })
    expect(g.map((n) => n.after)).toEqual([[], ['g0'], ['g0']])
  })

  it('las aristas son mínimas: el tercer grupo no repite el primero', () => {
    // La transitividad no se escribe. `g2` va después de `g1`, que va después de
    // `g0`, y `orden()` lo cierra solo; meter `g0` adentro de `g2.after` sería la
    // misma verdad escrita dos veces, y dos copias de un hecho se separan.
    const g = goalGraph({
      clausulas: [
        { goal: CAÑA, liga: 'y', porque: 'uno' },
        { goal: PESCADO_EN_MANO, liga: 'despues', porque: 'dos' },
        { goal: ASADO, liga: 'despues', porque: 'tres' },
      ],
    })
    expect(g.map((n) => n.after)).toEqual([[], ['g0'], ['g1']])
    expect(orden(g)).toEqual(['g0', 'g1', 'g2'])
  })
})

// ─── (b) una cláusula sola ───────────────────────────────────────────────────

describe('una lectura de una sola cláusula', () => {
  it('es un nodo pelado, sin `after` y sin `binds`', () => {
    const g = goalGraph({
      clausulas: [{ goal: PESCADO_EN_MANO, liga: 'y', porque: 'tengo hambre' }],
    })
    expect(g).toEqual([{ id: 'g0', goal: PESCADO_EN_MANO, after: [], porque: 'tengo hambre' }])
    expect(orden(g)).toEqual(['g0'])
  })

  it('y una que empieza con «después» tampoco inventa un antes', () => {
    // Una lectura que arranca con «después...» es una lectura de un solo grupo.
    // No lanza porque la restricción se cumple sola: no hay nada antes que violar.
    const g = goalGraph({
      clausulas: [{ goal: PESCADO_EN_MANO, liga: 'despues', porque: 'después comé' }],
    })
    expect(g[0]?.after).toEqual([])
  })

  it('y una lectura vacía da un grafo vacío, no una excepción', () => {
    expect(goalGraph({ clausulas: [] })).toEqual([])
    expect(orden([])).toEqual([])
  })
})

// ─── (c) el ciclo ────────────────────────────────────────────────────────────

describe('un ciclo se detecta y se nombra', () => {
  it('dos nodos que se esperan mutuamente', () => {
    const g = [nodo('g0', ['g1']), nodo('g1', ['g0'])]
    expect(() => orden(g)).toThrow(/ciclo: g0 → g1 → g0/u)
  })

  it('un nodo que se espera a sí mismo', () => {
    expect(() => orden([nodo('g0', ['g0'])])).toThrow(/ciclo: g0 → g0/u)
  })

  it('nombra el ciclo y no la lista de trabados', () => {
    // `g2` está trabado pero no es culpable: va después de `g1`, y `g1` nunca
    // llega. Un mensaje que dijera «g0, g1, g2» mandaría a mirar al inocente.
    const g = [nodo('g0', ['g1']), nodo('g1', ['g0']), nodo('g2', ['g1'])]
    let mensaje = ''
    try {
      orden(g)
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e)
    }
    expect(mensaje).toContain('g0 → g1 → g0')
    expect(mensaje).toContain('3 nodo(s)')
  })

  it('y el ciclo reportado no depende del orden de entrada', () => {
    const g = [nodo('g0', ['g1']), nodo('g1', ['g0']), nodo('g2', ['g1'])]
    const mensajes = new Set<string>()
    for (const p of permutaciones(g)) {
      try {
        orden(p)
      } catch (e) {
        mensajes.add(e instanceof Error ? e.message : String(e))
      }
    }
    expect(mensajes.size).toBe(1)
  })

  it('NO devuelve una lista corta en silencio', () => {
    // El fracaso caro: Kahn sin mirar el largo devuelve `['g2']` para un grafo de
    // tres nodos, y quien lo reciba ejecuta un plan al que le faltan dos pasos.
    const g = [nodo('g0', ['g1']), nodo('g1', ['g0']), nodo('g2', [])]
    expect(() => orden(g)).toThrow()
  })

  it('dos nodos con el mismo id lanzan antes de ordenar nada', () => {
    expect(() => orden([nodo('g0', []), nodo('g0', [])])).toThrow(/dos nodos con el id «g0»/u)
  })
})

// ─── (d) la estabilidad ──────────────────────────────────────────────────────

describe('el orden topológico es estable', () => {
  it('mismo grafo, nodos barajados, mismo resultado', () => {
    // `g1` y `g2` no tienen relación entre sí, y `g3` va después de los dos. Las
    // 24 permutaciones del array de entrada tienen que dar la misma salida: si el
    // desempate fuera la posición en el array —lo primero que sale si uno recorre
    // el grafo y emite— habría 2 resultados distintos y los dos «válidos».
    const g = [nodo('g0', []), nodo('g1', ['g0']), nodo('g2', ['g0']), nodo('g3', ['g1', 'g2'])]
    const salidas = new Set(permutaciones(g).map((p) => orden(p).join(',')))
    expect(salidas).toEqual(new Set(['g0,g1,g2,g3']))
  })

  it('y el desempate es por índice de cláusula, no por texto: g2 antes que g10', () => {
    // Once nodos sueltos. Ordenados como texto darían `g0, g1, g10, g2, …`, que
    // es determinista pero deja de decir la verdad: el id lleva adentro el índice
    // de la cláusula, o sea el orden en que la persona lo dijo, y ésa es la única
    // preferencia que hay cuando el grafo no impone ninguna.
    const ids = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10']
    const g = ids.map((id) => nodo(id, []))
    expect(orden([...g].reverse())).toEqual(ids)
  })

  it('la trampa del comparador no transitivo, con su contraejemplo corriendo', () => {
    // Un desempate «numérico si los dos son canónicos, textual si no» da
    // `g2 < g10` (numérico), `g1x < g2` (textual) y `g10 < g1x` (textual): un
    // ciclo en el comparador. `sort` con un comparador así devuelve lo que le
    // salga según su algoritmo interno, y el orden pasa a depender del motor.
    // Las 6 permutaciones tienen que dar la misma respuesta, y una sola.
    const g = [nodo('g10', []), nodo('g2', []), nodo('g1x', [])]
    const salidas = new Set(permutaciones(g).map((p) => orden(p).join(',')))
    expect(salidas.size).toBe(1)
    // Y la respuesta: los canónicos primero por número, los demás después por
    // texto. Que los no canónicos vayan al final es arbitrario; que vayan SIEMPRE
    // al final es lo que hace total al orden.
    expect(salidas).toEqual(new Set(['g2,g10,g1x']))
  })

  it('un `after` repetido no inventa un ciclo', () => {
    // Y este test NO es el guardián de la deduplicación de `orden()`, aunque lo
    // parezca: está MEDIDO que pasa con y sin esa línea, porque el conteo de
    // grados y el descuento salen del mismo bucle y un repetido se cancela solo.
    // Lo que este test fija es la SALIDA —un `after` repetido no traba a nadie—,
    // que es lo que le importa a quien llama; por qué se deduplica igual está
    // escrito arriba de la línea, en `objetivos.ts`.
    const g = [nodo('g0', []), nodo('g1', ['g0', 'g0'])]
    expect(orden(g)).toEqual(['g0', 'g1'])
  })
})

// ─── (e) el `after` que apunta afuera ────────────────────────────────────────

describe('un `after` que apunta a un id inexistente', () => {
  it('lanza, y nombra al que falta', () => {
    // Ignorarlo dejaría a `g1` libre para correr ANTES de lo que esperaba, y el
    // plan saldría verde con el mundo mal. El id va en el mensaje porque el
    // culpable casi siempre es quien armó el grafo, no quien lo ordena.
    const g = [nodo('g1', ['g7'])]
    expect(() => orden(g)).toThrow(/«g1» dice ir después de «g7»/u)
  })

  it('incluso cuando el resto del grafo se podría ordenar igual', () => {
    // El caso peligroso: `g0` y `g1` se ordenan sin problema, así que un
    // topológico distraído devuelve `['g0','g1']` y nadie se entera de que `g1`
    // tenía una tercera dependencia que nunca existió.
    const g = [nodo('g0', []), nodo('g1', ['g0', 'g7'])]
    expect(() => orden(g)).toThrow(/«g7»/u)
  })
})

// ─── Las dos contradicciones de la lectura ───────────────────────────────────

describe('una lectura que se contradice grita', () => {
  it('bindear en la primera cláusula: no hay rendimiento anterior', () => {
    expect(() =>
      goalGraph({
        clausulas: [{ goal: ASADO, liga: 'y', bindeaSlot: 'target', porque: 'asá el pescado' }],
      }),
    ).toThrow(/no hay anterior/u)
  })

  it('bindear con «y»: pide no ordenar y usar lo que salga de la anterior', () => {
    // Una ligadura ES un orden —no se puede usar lo que todavía no se produjo—,
    // así que `'y'` y `bindeaSlot` juntos son dos pedidos incompatibles. Elegir
    // uno en silencio es elegir mal la mitad de las veces.
    expect(() =>
      goalGraph({
        clausulas: [
          { goal: PESCADO_EN_MANO, liga: 'y', porque: 'andá a pescar' },
          { goal: ASADO, liga: 'y', bindeaSlot: 'target', porque: 'y asá el pescado' },
        ],
      }),
    ).toThrow(/se contradicen/u)
  })

  it('el `binds` apunta a la cláusula anterior, no al grupo entero', () => {
    // «hacé una caña y andá a pescar, después asá el pescado»: el pescado lo
    // rindió la segunda, no la primera. Un `binds` contra el grupo entero
    // necesitaría decidir cuál de los hermanos rindió el pescado, y esa decisión
    // no está en la frase.
    const g = goalGraph(LECTURA_DEL_DOCUMENTO)
    expect(g[2]?.binds).toEqual({ slot: 'target', from: 'g1' })
    expect(g[2]?.after).toContain('g0')
  })

  it('y el `from` de un `binds` SIEMPRE está adentro del `after`', () => {
    // El invariante que hace resoluble la ligadura: quien ejecuta el plan lee
    // `{k:'rinde', de}` contra lo que ya rindieron los pasos anteriores, así que
    // si `from` no estuviera ordenado antes, el `Ref` se resolvería contra un
    // rendimiento que todavía no pasó. Sale gratis por construcción —la cláusula
    // anterior es el último miembro del grupo que se acaba de cerrar— y por eso
    // mismo conviene que un test lo fije: los invariantes gratis son los que se
    // rompen sin que nadie lo note.
    for (const l of [
      LECTURA_DEL_DOCUMENTO,
      {
        clausulas: [
          { goal: CAÑA, liga: 'y', porque: 'uno' },
          { goal: PESCADO_EN_MANO, liga: 'y', porque: 'dos' },
          { goal: PESCADO_EN_MANO, liga: 'y', porque: 'tres' },
          { goal: ASADO, liga: 'despues', bindeaSlot: 'target', porque: 'cuatro' },
        ],
      } satisfies Lectura,
    ]) {
      for (const n of goalGraph(l)) {
        if (n.binds !== undefined) expect(n.after).toContain(n.binds.from)
      }
    }
  })
})

// ─── Los ids ─────────────────────────────────────────────────────────────────

describe('los ids salen del índice de la cláusula', () => {
  it('y no de un contador global: dos lecturas iguales dan dos grafos iguales', () => {
    // Un contador que sobrevive entre lecturas haría que el mismo pedido diera
    // `g7` la primera vez y `g19` la segunda: lo mismo, con otro nombre, y por lo
    // tanto incomparable contra una crónica guardada.
    const uno = goalGraph(LECTURA_DEL_DOCUMENTO)
    const otro = goalGraph(LECTURA_DEL_DOCUMENTO)
    expect(otro).toEqual(uno)
    expect(uno.map((n) => n.id)).toEqual(['g0', 'g1', 'g2'])
  })

  it('y el `porque` de cada nodo es el de su cláusula, sin retocar', () => {
    // Es lo que después contesta el «por qué», y también lo que impide premiar lo
    // que nadie pidió. Reescribirlo acá sería inventarle una intención al pedido.
    expect(goalGraph(LECTURA_DEL_DOCUMENTO).map((n) => n.porque)).toEqual([
      'hacé una caña',
      'andá a pescar',
      'después asá el pescado',
    ])
  })
})
