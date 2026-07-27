// ─── CAZA DEL ÍNDICE MAL INVALIDADO ──────────────────────────────────────────
//
// El camino de intenciones dejó de recorrer el mundo entero. `estorbo` le pregunta
// a un índice de cuerpos por celda y `olvidar` a un conjunto de cuerpos con
// relación espacial, los dos armados perezosamente adentro del `Borrador` y
// mantenidos por `ponerCuerpo` y `sacarCuerpo`. La ganancia está medida en
// `tests/banco-el-camino-de-intenciones.test.ts`: el p99 del tick con 5000 cuerpos
// y 5000 criaturas caminando bajó de 668 ms a 31.
//
// El argumento por el que el índice no puede quedar viejo es correcto —muere con
// el tick, y adentro del tick `ponerCuerpo` y `sacarCuerpo` son el único camino de
// escritura de posiciones y relaciones—. Pero un argumento correcto sobre una
// precondición que nadie verifica es exactamente el modo de falla de este tipo de
// optimización. Acá se verifica, y de dos maneras distintas a propósito:
//
//   1. CONTRA LA FUERZA BRUTA. Una partida larga en la que, antes de cada tick, el
//      test recorre el mundo entero y calcula QUÉ TENDRÍA QUE PASAR —incluido cuál
//      de los cuerpos de la celda es el que estorba, que es lo que decide el
//      `supportedBy`— y después compara con lo que pasó. La reimplementación es
//      deliberada: si el test importara `estorbo`, un índice mal armado haría
//      pasar el test por la peor razón posible;
//
//   2. LOS CINCO CAMINOS, ADENTRO DE UN MISMO TICK. Un índice se rompe cuando algo
//      cambia DESPUÉS de que el índice se armó y ANTES de que se lo consulte. Eso
//      solo pasa entre dos intenciones del mismo tick, así que cada escenario de
//      abajo pone dos actores y hace que el segundo pregunte por lo que el primero
//      acaba de cambiar: nacer, morir, cambiar de mano, soltarse y mudarse.
//
// Y cada escenario trae su CONTROL: el mismo mundo con el primer actor esperando.
// Sin él, un test que afirma «b se apoya en la piedra» pasaría igual si b se
// apoyara en la piedra por cualquier otro motivo, y no estaría midiendo nada.
//
// El precedente es `packages/physics/tests/cache-mal-invalidada.test.ts`, que hizo
// lo mismo con las cinco memoizaciones de la optimización del Hito 2.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, HZ_DE_REFERENCIA, qualityOf, seg } from '@anima/physics'
import type { Body, QualityVector } from '@anima/physics'

import { mapaDeActores, mapaDeCuerpos, stepWorld, unPasoHacia } from '../src/step.js'
import type { Actor, CellState, SimEvent, WorldBody, WorldState } from '../src/step.js'
import type { Intent, Placement } from '../src/intent.js'
import { chebyshev, enRango } from '../src/intent.js'
import { keyOfCell } from '../src/cell.js'
import { revisarInvariantes } from '../src/invariants.js'

// ─── Armado ──────────────────────────────────────────────────────────────────

function cuerpo(id: string, substance: string, mass: number, state: QualityVector = {}): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state }
}

function mundo(bodies: readonly WorldBody[], actors: readonly Actor[], nextId = 1): WorldState {
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: buildSeedPhysics(),
    bodies: mapaDeCuerpos(bodies),
    actors: mapaDeActores(actors),
    cells: new Map<number, CellState>(),
    nextId,
  }
}

/**
 * Una criatura con `stamina` de sobra.
 *
 * De sobra a propósito: este archivo mide el ÍNDICE, y una criatura que se queda
 * sin fuerzas a mitad de la partida cambiaría el camino de `intencionCaminar` sin
 * que nadie lo pida. El número no sale de ninguna constante del mundo —ni de
 * `COSTO_POR_CELDA` ni de `COSTO_VIVIR_POR_SEGUNDO`— para que el archivo no se
 * rompa el día que el ADR II-0009 les mueva el valor.
 */
function criatura(
  id: string,
  x: number,
  y: number,
  o: { capacity?: number; holding?: readonly string[]; doing?: Actor['doing'] } = {},
): { readonly c: WorldBody; readonly a: Actor } {
  const a: Actor = {
    id,
    body: `${id}-cuerpo`,
    holding: o.holding ?? [],
    capacity: o.capacity ?? 2,
    permits: 'irreversible',
    ...(o.doing === undefined ? {} : { doing: o.doing }),
  }
  return { c: { body: cuerpo(`${id}-cuerpo`, 'carne', 2, { stamina: 900 }), at: { x, y } }, a }
}

/** Sobre qué quedó apoyado el cuerpo de un actor, o `'-'`. */
function apoyoDe(w: WorldState, id: string): string {
  return w.bodies.get(`${id}-cuerpo`)?.supportedBy ?? '-'
}

function celdaDe(w: WorldState, id: string): string {
  const c = w.bodies.get(id)
  return c === undefined ? 'NO ESTÁ' : `${c.at.x},${c.at.y}`
}

const esperar = (by: string): Intent => ({ k: 'wait', by, seq: 0, commitment: 'reversible', segundos: 1 })
const caminar = (by: string, to: Placement): Intent => ({
  k: 'goTo',
  by,
  seq: 0,
  commitment: 'reversible',
  to,
  within: 0,
})

// ─── 1 · Contra la fuerza bruta, tick a tick ─────────────────────────────────

/**
 * `estorbo` reimplementado a la brutísima: recorre TODOS los cuerpos del estado y
 * devuelve el primero que estorba, en el orden del mapa.
 *
 * Es una copia deliberada de los cinco filtros de `step.ts`, escrita acá y no
 * importada, por la misma razón que `mundo-minimo.ts` tiene su propia `huella`: si
 * el test usara el código del mundo, un índice mal armado haría pasar el test por
 * la peor razón posible.
 */
function estorboALaBruta(s: WorldState, at: Placement, quien: string): WorldBody | undefined {
  const k = keyOfCell(at)
  for (const c of s.bodies.values()) {
    if (c.body.id === quien) continue
    if (c.heldBy !== undefined) continue
    if (keyOfCell(c.at) !== k) continue
    if (c.supportedBy === quien || c.covering === quien) continue
    if (qualityOf(c.body, 'solid', s.phys) <= 0) continue
    return c
  }
  return undefined
}

interface Lcg {
  n(max: number): number
}

function azar(semilla: number): Lcg {
  let s = semilla >>> 0
  // Los dieciséis bits altos: los bajos de un LCG de módulo 2³² tienen período
  // corto y dos semillas distintas darían la misma sucesión corrida un lugar.
  return {
    n: (max: number): number => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return max <= 0 ? 0 : (s >>> 16) % max
    },
  }
}

describe('1 · el índice contesta lo mismo que recorrer el mundo', () => {
  /**
   * Una partida de 400 ticks con UNA intención por tick.
   *
   * Una y no varias, y es lo que hace exacta la comparación: `estorbo` mira el
   * mundo tal como está en el momento del despacho, y con una sola intención ese
   * momento es el principio del tick — o sea el estado que el test tiene en la
   * mano. Los cambios de ADENTRO del tick los cubre el bloque 2.
   */
  function partidaDeUnaIntencion(semilla: number): {
    readonly ticks: number
    readonly conApoyo: number
    readonly sinApoyo: number
    readonly rechazos: number
    readonly discrepancias: readonly string[]
  } {
    const r = azar(semilla)
    const bodies: WorldBody[] = []
    const actores: Actor[] = []
    const nombres = ['ana', 'beto', 'cira', 'dani']
    for (let i = 0; i < nombres.length; i++) {
      const k = criatura(nombres[i] as string, i - 2, 0)
      bodies.push(k.c)
      actores.push(k.a)
    }
    // Un tablero de materias elegidas por lo que le hacen a `estorbo`, que son
    // tres cosas distintas y las tres tienen que estar o el diferencial mide una
    // sola rama:
    //
    //   - piedra, madera, liana ... sólidas CON `footing`: estorban y se las pisa;
    //   - grano, hoja-seca ........ sólidas SIN `footing`: estorban y no se las
    //     pisa, que es de donde salen los `celda-ocupada`;
    //   - pescado ................. NO sólido: no estorba y no aparece nunca.
    const materias = ['piedra', 'madera', 'grano', 'liana', 'hoja-seca', 'pescado']
    let n = 0
    for (let x = -3; x <= 3; x++) {
      for (let y = -3; y <= 3; y++) {
        if ((x + y) % 3 !== 0) continue
        bodies.push({ body: cuerpo(`t${n}`, materias[n % materias.length] as string, 1), at: { x, y } })
        n += 1
      }
    }
    // Dos pilas legales: dos sólidos en una celda, uno apoyado en el otro. Es el
    // caso donde CUÁL de los dos devuelve `estorbo` cambia el estado, y por lo
    // tanto el hash.
    bodies.push({ body: cuerpo('pila-base', 'piedra', 1), at: { x: 2, y: 2 } })
    bodies.push({ body: cuerpo('pila-alta', 'madera', 1), at: { x: 2, y: 2 }, supportedBy: 'pila-base' })

    let w = mundo(bodies, actores)
    const discrepancias: string[] = []
    let conApoyo = 0
    let sinApoyo = 0
    let rechazos = 0
    const TICKS = 400

    for (let t = 0; t < TICKS && discrepancias.length === 0; t++) {
      const by = nombres[r.n(nombres.length)] as string
      const to: Placement = { x: r.n(9) - 4, y: r.n(9) - 4 }
      const mio = w.bodies.get(`${by}-cuerpo`) as WorldBody

      // ─── LO QUE TENDRÍA QUE PASAR, derivado del estado entero ────────────
      const quieto = chebyshev(mio.at, to) <= 0
      const destino = unPasoHacia(mio.at, to)
      const choque = quieto ? undefined : estorboALaBruta(w, destino, mio.body.id)
      const pisable = choque !== undefined && qualityOf(choque.body, 'footing', w.phys) > 0
      const bloqueado = choque !== undefined && !pisable

      const paso = stepWorld(w, [caminar(by, to)])
      // `'by' in e` y no `e.by`: `murio` y `sustancia` son NARRACIÓN y no llevan
      // firma de nadie (ver `cerrar` en `step.ts`), así que el tipo no promete el
      // campo. Filtrarlos acá es más honesto que castear.
      const ev = paso.events.find((e) => 'by' in e && e.by === by) as SimEvent | undefined
      const nuevo = paso.state.bodies.get(`${by}-cuerpo`) as WorldBody

      const dijo =
        ev === undefined
          ? 'nada'
          : ev.k === 'movio'
            ? `movio sobre:${nuevo.supportedBy ?? '-'}`
            : ev.k === 'espero'
              ? 'espero'
              : ev.k === 'rechazada'
                ? `rechazada:${ev.por}`
                : ev.k
      const esperado = quieto
        ? 'espero'
        : !enRango(destino)
          ? 'rechazada:fuera-de-rango'
          : bloqueado
            ? 'rechazada:celda-ocupada'
            : `movio sobre:${choque === undefined ? '-' : choque.body.id}`

      if (dijo !== esperado) {
        discrepancias.push(`t${t} ${by} a (${to.x},${to.y}): el mundo dijo «${dijo}» y la fuerza bruta «${esperado}»`)
      }
      if (esperado.startsWith('movio sobre:-')) sinApoyo += 1
      else if (esperado.startsWith('movio')) conApoyo += 1
      else if (esperado.startsWith('rechazada')) rechazos += 1

      w = paso.state
    }
    return { ticks: TICKS, conApoyo, sinApoyo, rechazos, discrepancias }
  }

  it('400 ticks: ninguna decisión de estorbo se separa de la fuerza bruta', () => {
    const r = partidaDeUnaIntencion(20260727)
    expect(r.discrepancias).toEqual([])
  })

  it('y la partida ejercita las TRES respuestas, así que la comparación no es vacía', () => {
    // Un diferencial en el que todo da «movio sin apoyo» estaría comparando dos
    // maneras de contestar que no. Las tres tienen que aparecer, y la del medio
    // —moverse APOYÁNDOSE en un cuerpo concreto— es la única que depende de CUÁL
    // devuelve `estorbo`, o sea del orden de las cubetas del índice.
    const r = partidaDeUnaIntencion(20260727)
    expect(r.sinApoyo).toBeGreaterThan(0)
    expect(r.conApoyo).toBeGreaterThan(0)
    expect(r.rechazos).toBeGreaterThan(0)
  })

  it('con otra semilla también, que es el control de que la partida depende de la semilla', () => {
    const a = partidaDeUnaIntencion(11)
    const b = partidaDeUnaIntencion(99)
    expect(a.discrepancias).toEqual([])
    expect(b.discrepancias).toEqual([])
    // Dos semillas, dos partidas: si dieran el mismo reparto de respuestas,
    // «probé con otra semilla» no significaría nada.
    expect([a.conApoyo, a.sinApoyo, a.rechazos]).not.toEqual([b.conApoyo, b.sinApoyo, b.rechazos])
  })
})

// ─── 2 · Los cinco caminos, adentro de un mismo tick ─────────────────────────

describe('2 · el índice sobrevive a lo que pasa ADENTRO del tick', () => {
  /**
   * SE MUEVEN. `a` sale de (0,0) y entra a (1,0); en el mismo tick `b` viene de
   * (2,0) y `c` de (−1,0).
   *
   * Las dos mitades de una mudanza, y las dos importan:
   *
   *   - `b` tiene que ENCONTRAR a `a` en su celda nueva. La carne tiene `footing`
   *     0,05, así que se le sube encima y queda `supportedBy: a-cuerpo`. Si el
   *     índice no se hubiera enterado de la mudanza, `b` entraría a (1,0) suelta;
   *   - `c` tiene que NO encontrar a `a` en la celda que dejó. Si la entrada vieja
   *     siguiera en la cubeta, `c` se apoyaría en alguien que ya no está ahí.
   *
   * El orden lo fija `ordenarIntenciones` por id de actor: a, b, c.
   */
  it('se mueven: el que entra encuentra al que llegó y no al que se fue', () => {
    const A = criatura('a', 0, 0)
    const B = criatura('b', 2, 0)
    const C = criatura('c', -1, 0)
    const w = mundo([A.c, B.c, C.c], [A.a, B.a, C.a])
    const r = stepWorld(w, [caminar('a', { x: 1, y: 0 }), caminar('b', { x: 1, y: 0 }), caminar('c', { x: 0, y: 0 })])

    expect(celdaDe(r.state, 'a-cuerpo')).toBe('1,0')
    expect(celdaDe(r.state, 'b-cuerpo')).toBe('1,0')
    expect(celdaDe(r.state, 'c-cuerpo')).toBe('0,0')
    expect(apoyoDe(r.state, 'b')).toBe('a-cuerpo')
    expect(apoyoDe(r.state, 'c')).toBe('-')
    expect(revisarInvariantes(w, r.state, r.events)).toEqual([])
  })

  it('CONTROL: si `a` se queda quieta, `b` no llega a (1,0) y `c` se apoya en `a`', () => {
    // El mismo mundo con `a` esperando. Las dos respuestas se dan vuelta, así que
    // el test de arriba está midiendo la mudanza y no una casualidad del armado.
    const A = criatura('a', 0, 0)
    const B = criatura('b', 2, 0)
    const C = criatura('c', -1, 0)
    const w = mundo([A.c, B.c, C.c], [A.a, B.a, C.a])
    const r = stepWorld(w, [esperar('a'), caminar('b', { x: 1, y: 0 }), caminar('c', { x: 0, y: 0 })])

    expect(celdaDe(r.state, 'a-cuerpo')).toBe('0,0')
    expect(apoyoDe(r.state, 'b')).toBe('-')
    expect(apoyoDe(r.state, 'c')).toBe('a-cuerpo')
  })

  /**
   * EL ORDEN DE LA CUBETA, que es la parte del índice que más fácil se escribe
   * mal y menos fácil se nota.
   *
   * `estorbo` devuelve EL PRIMERO que estorba, y «primero» quiere decir el primero
   * que aparecería recorriendo `d.bodies` — o sea, en orden canónico de id. Cuando
   * un cuerpo se muda a una celda que YA tenía otro, la cubeta tiene dos, y meter
   * al recién llegado al final es lo natural y es lo incorrecto.
   *
   * Acá `zzz` está en (1,0) desde el principio y `a-cuerpo` se muda ahí. Como
   * `a-cuerpo` va antes que `zzz` en el orden canónico, cuando `b` llega tiene que
   * apoyarse en `a-cuerpo`. Si la cubeta guardara por orden de llegada, `b` se
   * apoyaría en `zzz` — y el mundo tendría otro hash sin que ningún evento cambie.
   *
   * Está verificado que este test DETECTA: con la cubeta guardando al final en vez
   * de en su lugar, éste falla.
   */
  it('el orden de la cubeta es el del mundo, no el de llegada', () => {
    const A = criatura('a', 0, 0)
    const B = criatura('b', 2, 0)
    const w = mundo([A.c, B.c, { body: cuerpo('zzz', 'piedra', 0.5), at: { x: 1, y: 0 } }], [A.a, B.a])
    // El orden canónico de `bodies`: a-cuerpo, b-cuerpo, zzz.
    expect([...w.bodies.keys()]).toEqual(['a-cuerpo', 'b-cuerpo', 'zzz'])

    const r = stepWorld(w, [caminar('a', { x: 1, y: 0 }), caminar('b', { x: 1, y: 0 })])
    // `a` se sube a la piedra…
    expect(apoyoDe(r.state, 'a')).toBe('zzz')
    // …y `b` se sube a `a`, que es el primero de la celda en el orden del mundo.
    expect(celdaDe(r.state, 'b-cuerpo')).toBe('1,0')
    expect(apoyoDe(r.state, 'b')).toBe('a-cuerpo')
  })

  /**
   * SE SUELTAN. `a` suelta una piedra —`celdaLibreCerca` la manda a (1,0), porque
   * la celda propia la ocupa ella— y en el mismo tick `b` camina a (1,0).
   *
   * La piedra tiene `footing` 0,95, así que `b` se le sube encima. Si el índice no
   * hubiera visto el `drop`, `b` entraría suelta y quedarían dos raíces sólidas en
   * la misma celda: el `solidos-solapados` que `revisarInvariantes` caza.
   */
  it('se sueltan: lo que cae ocupa la celda para el que viene después en el mismo tick', () => {
    const A = criatura('a', 0, 0, { holding: ['pie'] })
    const B = criatura('b', 2, 0)
    const w = mundo([A.c, B.c, { body: cuerpo('pie', 'piedra', 0.5), at: { x: 0, y: 0 }, heldBy: 'a' }], [A.a, B.a])
    const r = stepWorld(w, [
      { k: 'drop', by: 'a', seq: 0, commitment: 'reversible', what: 'pie' },
      caminar('b', { x: 1, y: 0 }),
    ])

    expect(celdaDe(r.state, 'pie')).toBe('1,0')
    expect(apoyoDe(r.state, 'b')).toBe('pie')
    expect(revisarInvariantes(w, r.state, r.events)).toEqual([])
  })

  it('CONTROL: si `a` no suelta nada, `b` entra a (1,0) suelta', () => {
    const A = criatura('a', 0, 0, { holding: ['pie'] })
    const B = criatura('b', 2, 0)
    const w = mundo([A.c, B.c, { body: cuerpo('pie', 'piedra', 0.5), at: { x: 0, y: 0 }, heldBy: 'a' }], [A.a, B.a])
    const r = stepWorld(w, [esperar('a'), caminar('b', { x: 1, y: 0 })])
    expect(apoyoDe(r.state, 'b')).toBe('-')
  })

  /**
   * CAMBIAN DE MANO. `a` levanta la piedra de abajo de una pila de dos.
   *
   * Esto es el otro índice: `intencionTomar` llama a `olvidar`, que ahora mira
   * `conRelaciones(d)` en vez de recorrer el mundo. Si `encima` no estuviera en ese
   * conjunto, se quedaría con un `supportedBy` apuntando a una piedra que está en
   * una mano y en otra celda — la relación colgada que `olvidar` existe para
   * evitar.
   */
  it('cambian de mano: levantar el de abajo le saca el apoyo al de arriba', () => {
    const A = criatura('a', 0, 0)
    const w = mundo(
      [
        A.c,
        { body: cuerpo('base', 'piedra', 0.5), at: { x: 1, y: 0 } },
        { body: cuerpo('encima', 'piedra', 0.5), at: { x: 1, y: 0 }, supportedBy: 'base' },
      ],
      [A.a],
    )
    const r = stepWorld(w, [{ k: 'take', by: 'a', seq: 0, commitment: 'reversible', what: 'base' }])

    expect(r.state.bodies.get('base')?.heldBy).toBe('a')
    expect(celdaDe(r.state, 'base')).toBe('0,0')
    expect(r.state.bodies.get('encima')?.supportedBy).toBeUndefined()
    expect(revisarInvariantes(w, r.state, r.events)).toEqual([])
  })

  /**
   * MUEREN. `a` se come la base de la pila.
   *
   * `sacarCuerpo` borra el cuerpo y llama a `olvidar`, o sea el mismo conjunto de
   * relaciones que el caso de arriba pero por el camino de la destrucción. Si
   * `encima` no estuviera en el conjunto, quedaría apoyada en un cuerpo que ya no
   * existe: `referencia-colgada`, que es la violación que `revisarInvariantes`
   * levanta.
   */
  it('mueren: comerse la base le saca el apoyo al de arriba, en el mismo tick', () => {
    const A = criatura('a', 0, 0)
    const w = mundo(
      [
        A.c,
        { body: cuerpo('base', 'pescado', 1), at: { x: 1, y: 0 } },
        { body: cuerpo('encima', 'piedra', 0.5), at: { x: 1, y: 0 }, supportedBy: 'base' },
      ],
      [A.a],
    )
    const r = stepWorld(w, [{ k: 'eat', by: 'a', seq: 0, commitment: 'irreversible', what: 'base' }])

    expect(r.state.bodies.has('base')).toBe(false)
    expect(r.state.bodies.get('encima')?.supportedBy).toBeUndefined()
    expect(r.events.some((e) => e.k === 'murio')).toBe(true)
    expect(revisarInvariantes(w, r.state, r.events)).toEqual([])
  })

  /**
   * NACEN. A `b` le falta un solo tick para terminar de deshilachar, y `a` se mete
   * en (1,0) en ese mismo tick.
   *
   * La hebra sale por `celdaLibreCerca` desde (0,0): la celda propia la ocupa `b`,
   * el primer rumbo es (1,0) —donde `a` acaba de llegar— y el segundo es (1,1).
   * O sea que **dónde nace la hebra depende de que el índice se haya enterado de
   * la mudanza de `a`**, que es exactamente lo que este archivo vigila. Si no se
   * hubiera enterado, la hebra caería encima de `a`.
   *
   * El deshilachado arranca a 1,95 s de 2 en vez de correr cuarenta ticks: es el
   * mismo estado al que llegaría solo, y así el escenario cabe en UN tick, que es
   * donde vive el peligro.
   */
  it('nacen: el recién nacido esquiva la celda a la que otro acaba de mudarse', () => {
    const A = criatura('a', 2, 0)
    const B = criatura('b', 0, 0, {
      capacity: 1,
      holding: ['lia'],
      doing: {
        process: 'deshilachar',
        segundos: seg(1.95),
        roles: [
          { name: 'actor', body: 'b-cuerpo' },
          { name: 'source', body: 'lia' },
        ],
      },
    })
    const deshilachar: Intent = {
      k: 'apply',
      by: 'b',
      seq: 0,
      commitment: 'costly',
      process: 'deshilachar',
      roles: [
        { name: 'actor', body: 'b-cuerpo' },
        { name: 'source', body: 'lia' },
      ],
    }
    const w = mundo([A.c, B.c, { body: cuerpo('lia', 'liana', 1), at: { x: 0, y: 0 }, heldBy: 'b' }], [A.a, B.a])
    const r = stepWorld(w, [caminar('a', { x: 1, y: 0 }), deshilachar])

    const nacio = r.events.find((e) => e.k === 'nacio')
    expect(nacio).toBeDefined()
    const hijo = (nacio as { id: string }).id
    expect(celdaDe(r.state, 'a-cuerpo')).toBe('1,0')
    expect(celdaDe(r.state, hijo)).toBe('1,1')
    expect(revisarInvariantes(w, r.state, r.events)).toEqual([])
  })

  it('CONTROL: si `a` no se mueve, la hebra SÍ nace en (1,0)', () => {
    // La misma escena con `a` lejos. La hebra va al primer rumbo, que es (1,0):
    // o sea que el (1,1) de arriba lo produjo la mudanza y nada más.
    const A = criatura('a', 6, 6)
    const B = criatura('b', 0, 0, {
      capacity: 1,
      holding: ['lia'],
      doing: {
        process: 'deshilachar',
        segundos: seg(1.95),
        roles: [
          { name: 'actor', body: 'b-cuerpo' },
          { name: 'source', body: 'lia' },
        ],
      },
    })
    const w = mundo([A.c, B.c, { body: cuerpo('lia', 'liana', 1), at: { x: 0, y: 0 }, heldBy: 'b' }], [A.a, B.a])
    const r = stepWorld(w, [
      esperar('a'),
      {
        k: 'apply',
        by: 'b',
        seq: 0,
        commitment: 'costly',
        process: 'deshilachar',
        roles: [
          { name: 'actor', body: 'b-cuerpo' },
          { name: 'source', body: 'lia' },
        ],
      },
    ])
    const nacio = r.events.find((e) => e.k === 'nacio')
    expect(nacio).toBeDefined()
    expect(celdaDe(r.state, (nacio as { id: string }).id)).toBe('1,0')
  })
})

// ─── 3 · Una partida apretada, con los invariantes en cada tick ──────────────

describe('3 · muchos actores en poco lugar, con invariantes en cada tick', () => {
  /**
   * Seis criaturas y doce cosas en un cuadrado de 5×5, seis intenciones por tick
   * durante 600 ticks. La densidad es el punto: es donde dos actores se pelean por
   * la misma celda en el mismo tick, que es el único momento en que un índice mal
   * mantenido cambia una respuesta.
   *
   * Lo que se afirma es que NO aparecen las dos violaciones que un índice roto
   * produce —`solidos-solapados` porque alguien entró a una celda ocupada, y
   * `referencia-colgada` porque `olvidar` no encontró a quién limpiar— y no que no
   * aparezca ninguna: las otras hablan de otras cosas y silenciarlas de paso sería
   * tapar un invariante ajeno con este test.
   */
  it('600 ticks apretados: ni un solapamiento ni una referencia colgada', () => {
    const r = azar(20260727)
    const nombres = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5']
    const bodies: WorldBody[] = []
    const actores: Actor[] = []
    for (let i = 0; i < nombres.length; i++) {
      const k = criatura(nombres[i] as string, i % 3, (i / 3) | 0, { capacity: 3 })
      bodies.push(k.c)
      actores.push(k.a)
    }
    const materias = ['piedra', 'madera', 'liana', 'hueso', 'corteza', 'pescado']
    for (let i = 0; i < 12; i++) {
      bodies.push({
        body: cuerpo(`t${i}`, materias[i % materias.length] as string, 1),
        at: { x: i % 4, y: 2 + ((i / 4) | 0) },
      })
    }
    let w = mundo(bodies, actores)
    const malas: string[] = []
    let movidas = 0

    for (let t = 0; t < 600 && malas.length === 0; t++) {
      const intents: Intent[] = []
      for (let i = 0; i < 6; i++) {
        const by = nombres[r.n(6)] as string
        const que = `t${r.n(14)}`
        const seq = t * 10 + i
        switch (r.n(6)) {
          case 0:
          case 1:
            intents.push({ k: 'goTo', by, seq, commitment: 'reversible', to: { x: r.n(5), y: r.n(5) }, within: 0 })
            break
          case 2:
            intents.push({ k: 'take', by, seq, commitment: 'reversible', what: que })
            break
          case 3:
            intents.push({ k: 'drop', by, seq, commitment: 'reversible', what: que })
            break
          case 4:
            intents.push({ k: 'eat', by, seq, commitment: 'irreversible', what: que })
            break
          default:
            intents.push({ k: 'explore', by, seq, commitment: 'reversible', maxTicks: 3 })
            break
        }
      }
      const antes = w
      const paso = stepWorld(w, intents)
      w = paso.state
      movidas += paso.events.filter((e) => e.k === 'movio').length
      for (const v of revisarInvariantes(antes, w, paso.events)) {
        if (v.k === 'solidos-solapados' || v.k === 'referencia-colgada') {
          malas.push(`t${t} ${JSON.stringify(v)}`)
        }
      }
    }

    expect(malas).toEqual([])
    // Y que la partida haya HECHO algo: 600 ticks en los que nadie se movió no
    // probarían nada sobre ningún índice.
    expect(movidas).toBeGreaterThan(300)
  }, 120_000)
})
