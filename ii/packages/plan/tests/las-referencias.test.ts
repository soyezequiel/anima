// ─── LAS REFERENCIAS — el módulo que desconfía de la foto ────────────────────
//
//   pnpm --filter @anima/plan test
//
// SE TESTEA SIN MUNDO, Y ESO NO ES UNA COMODIDAD: es la decisión 3 del encabezado
// de `tipos.ts` («los pasos son datos, no habilidades») cobrada. Una `VistaDelPlan`
// de mentira es un objeto literal de veinte líneas porque la interfaz es un
// SUBCONJUNTO ESTRUCTURAL de `Ctx` — si un día hiciera falta arrancar un mundo
// para probar una resolución, la interfaz habría dejado de ser un subconjunto y
// eso sería la noticia.
//
// La vista de mentira además MIENTE A PROPÓSITO en un punto: tiene cuerpos en la
// mano que `see()` no devuelve. En el mundo de hoy eso no pasa —lo que se lleva
// en la mano viaja con la criatura y cae adentro del radio—, pero el contrato de
// `VistaDelPlan` no lo promete, y la resolución tiene que ser correcta contra el
// contrato y no contra la implementación de hoy.
//
// Lo que se pina acá, y por qué cada cosa:
//
//   · las cinco formas de `Ref`, incluida la que NO devuelve un cuerpo;
//   · el empate de distancia: la MISMA resolución con la lista de entrada en dos
//     órdenes distintos tiene que dar el mismo cuerpo. `see()` no promete orden,
//     así que sin esto el planificador es no-determinista y no se nota hasta que
//     dos réplicas del mismo mundo divergen en el tick 400;
//   · que la elección coincide con `porCercania(...)[0]` de `@anima/skills`. Hay
//     dos escrituras del mismo orden —acá un barrido, allá un `sort`— y lo que
//     impide que digan cosas distintas es este test y nada más;
//   · la métrica: Chebyshev, la de `aMano()` del mundo. Con una carnada que elige
//     un cuerpo distinto si alguien la cambia por euclídea o por Manhattan;
//   · el costo, contado en cuerpos mirados y no en milisegundos, para que sea el
//     mismo número en toda máquina. Los milisegundos están en `banco-las-referencias`.

import { describe, expect, it } from 'vitest'
import type { QualityId } from '@anima/physics'
import type { BodyId, BodyView, Cell, Clock, SelfView, Where } from '@anima/skills'
import { distancia, porCercania } from '@anima/skills/innatas'

import { resolver, resolverCuerpo, resolverTodos, type Rindes } from '../src/referencias.js'
import type { Ref, VistaDelPlan } from '../src/tipos.js'

// ─── El mundito de mentira ──────────────────────────────────────────────────

type Cualidades = Partial<Record<QualityId, number>>

function cuerpo(id: string, x: number, y: number): BodyView {
  return { id, at: { x, y }, name: id, madeByMe: false, joints: [] }
}

function criatura(o?: { at?: Cell; holding?: readonly BodyView[] }): SelfView {
  return {
    id: 'yo',
    at: o?.at ?? { x: 0, y: 0 },
    name: 'criatura',
    madeByMe: false,
    joints: [],
    holding: o?.holding ?? [],
    capacity: 2,
    stamina: 10,
    permits: 'reversible',
  }
}

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

/** La vista de mentira, más dos contadores: sin ellos el costo es una opinión. */
interface VistaFalsa extends VistaDelPlan {
  llamadasASee(): number
  cuerposMirados(): number
}

function vista(m: {
  self?: SelfView
  cuerpos?: readonly BodyView[]
  qs?: ReadonlyMap<BodyId, Cualidades>
}): VistaFalsa {
  const self = m.self ?? criatura()
  const cuerpos = m.cuerpos ?? []
  let llamadas = 0
  let mirados = 0
  const qde = (b: BodyView, q: QualityId): number => m.qs?.get(b.id)?.[q] ?? 0
  return {
    see(w: Where): readonly BodyView[] {
      llamadas++
      const out: BodyView[] = []
      for (const b of cuerpos) {
        // Se cuenta ANTES de filtrar: `see` materializa la lista entera pase lo
        // que pase, y eso es lo que se paga.
        mirados++
        let ok = true
        for (const t of w) {
          const v = qde(b, t.q)
          const pasa =
            t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
          if (!pasa) {
            ok = false
            break
          }
        }
        if (ok) out.push(b)
      }
      return out
    },
    recall: () => [],
    q: qde,
    qAt: () => 0,
    self,
    clock: RELOJ,
    llamadasASee: () => llamadas,
    cuerposMirados: () => mirados,
  }
}

const TENSIL: Where = [{ q: 'tensile', op: '>=', v: 0.3 }]

// ─── Las cinco formas ───────────────────────────────────────────────────────

describe('las cinco formas de `Ref`', () => {
  it('`yo` es la criatura misma, y sale por identidad', () => {
    // Por identidad y no por igualdad estructural: `friccion` la pide como rol
    // `actor` —así se enciende el primer fuego de la partida— y una copia sería
    // otra foto del mismo tick, o sea la clase de objeto que este módulo evita.
    const v = vista({})
    expect(resolver({ k: 'yo' }, v)).toBe(v.self)
    expect(resolverCuerpo({ k: 'yo' }, v)).toBe(v.self)
    expect(v.llamadasASee()).toBe(0)
  })

  it('`celda` devuelve la celda, y `resolverCuerpo` devuelve `undefined`', () => {
    // Una celda no es un cuerpo. El agua del mundo es un campo de celda, y quien
    // pida el cuerpo del agua tiene que enterarse acá y no en `apply`.
    const v = vista({ cuerpos: [cuerpo('a', 1, 1)] })
    const at: Cell = { x: 7, y: -3 }
    expect(resolver({ k: 'celda', at }, v)).toBe(at)
    expect(resolverCuerpo({ k: 'celda', at }, v)).toBeUndefined()
    expect(v.llamadasASee()).toBe(0)
  })

  it('`id` encuentra el cuerpo a la vista, y `undefined` el que ya no está', () => {
    const v = vista({ cuerpos: [cuerpo('vara', 3, 0), cuerpo('pez', 1, 1)] })
    const hallado = resolverCuerpo({ k: 'id', id: 'pez' }, v)
    expect(hallado?.id).toBe('pez')
    expect(hallado?.at).toEqual({ x: 1, y: 1 })
    expect(resolverCuerpo({ k: 'id', id: 'humo' }, v)).toBeUndefined()
  })

  it('`id` encuentra la criatura misma y lo que tiene en la mano, sin mirar `see`', () => {
    // La vista miente a propósito: la caña está en la mano y NO está en `see`.
    // Contra el contrato de `VistaDelPlan` eso es legal, y la resolución tiene
    // que ser correcta contra el contrato.
    const cana = cuerpo('cana', 0, 0)
    const v = vista({ self: criatura({ holding: [cana] }), cuerpos: [cuerpo('otro', 5, 5)] })
    expect(resolverCuerpo({ k: 'id', id: 'cana' }, v)).toBe(cana)
    expect(resolverCuerpo({ k: 'id', id: 'yo' }, v)).toBe(v.self)
    expect(v.llamadasASee()).toBe(0)
  })

  it('`donde` elige entre los que cumplen, y `undefined` si no cumple ninguno', () => {
    // El más cercano de los que CUMPLEN, no el más cercano a secas: `pegado` está
    // al lado y no tiene `tensile`, así que gana el matorral de más allá.
    const qs = new Map<BodyId, Cualidades>([['matorral', { tensile: 0.5 }]])
    const v = vista({ cuerpos: [cuerpo('pegado', 1, 0), cuerpo('matorral', 4, 0)], qs })
    expect(resolverCuerpo({ k: 'donde', where: TENSIL }, v)?.id).toBe('matorral')

    const vacia = vista({ cuerpos: [cuerpo('pegado', 1, 0)] })
    expect(resolverCuerpo({ k: 'donde', where: TENSIL }, vacia)).toBeUndefined()
  })

  it('`rinde` sale del mapa, y `undefined` si el mapa no vino o no lo tiene', () => {
    const pez = cuerpo('pez', 1, 1)
    const v = vista({ cuerpos: [pez] })
    const rindes: Rindes = new Map([['g1', pez]])
    expect(resolverCuerpo({ k: 'rinde', de: 'g1' }, v, rindes)).toBe(pez)
    expect(resolverCuerpo({ k: 'rinde', de: 'g2' }, v, rindes)).toBeUndefined()
    expect(resolverCuerpo({ k: 'rinde', de: 'g1' }, v)).toBeUndefined()
  })
})

// ─── `rinde` no devuelve la foto vieja ──────────────────────────────────────

describe('`rinde` se lava por `id`, que es de lo que trata el módulo', () => {
  it('devuelve la vista de HOY y no la que quedó guardada en el mapa', () => {
    // El mapa guarda `BodyView`, o sea la foto del tick en que el paso rindió.
    // Cuarenta ticks después el pescado está en otro lado. Si `resolver`
    // devolviera la foto, la criatura caminaría hasta donde el pescado ESTABA.
    const viejo = cuerpo('pez', 99, 99)
    const hoy = cuerpo('pez', 2, 0)
    const v = vista({ cuerpos: [hoy] })
    const r = resolverCuerpo({ k: 'rinde', de: 'g1' }, v, new Map([['g1', viejo]]))
    expect(r).toBe(hoy)
    expect(r?.at).toEqual({ x: 2, y: 0 })
    expect(r).not.toBe(viejo)
  })

  it('y si lo que rindió ya no está a la vista, es `undefined` y no un fantasma', () => {
    // `union` se come al atador, la criatura suelta el pescado y se aleja: el id
    // no está en la vista de hoy. La foto sigue teniendo `at`, `name` y `joints`,
    // y devolverla sería creerle.
    const viejo = cuerpo('hebra', 5, 5)
    const v = vista({ cuerpos: [cuerpo('otra-cosa', 1, 1)] })
    expect(resolverCuerpo({ k: 'rinde', de: 'g1' }, v, new Map([['g1', viejo]]))).toBeUndefined()
  })

  it('y si lo que rindió está en la mano, lo encuentra sin barrer la vista', () => {
    const enMano = cuerpo('pez', 0, 0)
    const viejo = cuerpo('pez', 40, 40)
    const v = vista({ self: criatura({ holding: [enMano] }), cuerpos: [cuerpo('x', 9, 9)] })
    expect(resolverCuerpo({ k: 'rinde', de: 'g1' }, v, new Map([['g1', viejo]]))).toBe(enMano)
    expect(v.llamadasASee()).toBe(0)
  })
})

// ─── Un `Ref` sobrevive al tick; una vista, no ──────────────────────────────

describe('el mismo `Ref` contra dos ticks devuelve la vista de cada tick', () => {
  it('la referencia dura y la foto no, que es todo el módulo en un test', () => {
    // Esto es lo que un plan hace de verdad: se arma una vez y se ejecuta durante
    // decenas de ticks, y el mismo `{k:'id'}` tiene que contestar la posición de
    // HOY cada vez. Si el plan hubiera guardado el `BodyView` en vez del `Ref`,
    // las dos resoluciones darían el mismo objeto y la criatura caminaría hasta
    // donde el pescado estaba en el tick 100.
    const ref: Ref = { k: 'id', id: 'pez' }
    const tick100 = vista({ cuerpos: [cuerpo('pez', 3, 0)] })
    const tick140 = vista({ cuerpos: [cuerpo('pez', 3, 9)] })
    expect(resolverCuerpo(ref, tick100)?.at).toEqual({ x: 3, y: 0 })
    expect(resolverCuerpo(ref, tick140)?.at).toEqual({ x: 3, y: 9 })
    // Y en el tick en que el pescado ya no está, la referencia no miente: se cae.
    expect(resolverCuerpo(ref, vista({ cuerpos: [] }))).toBeUndefined()
  })

  it('y `donde` puede elegir un cuerpo distinto en cada tick, que es lo correcto', () => {
    // «Lo que cumpla esto, lo más cerca» no nombra un cuerpo: nombra un criterio.
    // Que la respuesta cambie cuando el mundo cambia no es inestabilidad, es la
    // diferencia entre `donde` e `id`, y por eso las dos formas existen.
    const qs = new Map<BodyId, Cualidades>([
      ['hebra-a', { tensile: 0.5 }],
      ['hebra-b', { tensile: 0.5 }],
    ])
    const antes = vista({ cuerpos: [cuerpo('hebra-a', 1, 0), cuerpo('hebra-b', 6, 0)], qs })
    const despues = vista({ cuerpos: [cuerpo('hebra-a', 9, 0), cuerpo('hebra-b', 6, 0)], qs })
    const donde: Ref = { k: 'donde', where: TENSIL }
    expect(resolverCuerpo(donde, antes)?.id).toBe('hebra-a')
    expect(resolverCuerpo(donde, despues)?.id).toBe('hebra-b')
  })
})

// ─── El empate, que es donde se cuela el no-determinismo ────────────────────

describe('el empate de distancia se resuelve igual venga como venga la lista', () => {
  it('la misma resolución con la entrada en dos órdenes da el mismo cuerpo', () => {
    // Tres empatados a distancia 2 y uno más lejos. `see()` no promete orden, así
    // que la resolución tiene que ser invariante a ese orden o dos réplicas del
    // mismo mundo eligen cuerpos distintos y divergen sin que nada falle.
    const xs = [cuerpo('m', 2, 0), cuerpo('a', 0, 2), cuerpo('z', 2, 2), cuerpo('b', 3, 0)]
    const donde: Ref = { k: 'donde', where: [] }
    const derecho = resolverCuerpo(donde, vista({ cuerpos: xs }))
    const alReves = resolverCuerpo(donde, vista({ cuerpos: [...xs].reverse() }))
    const barajado = resolverCuerpo(donde, vista({ cuerpos: barajar(xs, 12345) }))
    expect(derecho?.id).toBe('a')
    expect(alReves?.id).toBe('a')
    expect(barajado?.id).toBe('a')
  })

  it('y con veinte cuerpos y seis barajadas distintas, siempre el mismo', () => {
    // Cuatro celdas y veinte cuerpos: el empate no es un caso de borde armado a
    // mano, es lo normal en cuanto hay un matorral de varias ramas.
    const xs: BodyView[] = []
    for (let i = 0; i < 20; i++) {
      const c = [
        { x: 3, y: 0 },
        { x: 0, y: 3 },
        { x: 3, y: 3 },
        { x: 1, y: 1 },
      ][i % 4] as Cell
      xs.push(cuerpo(`b${String(i).padStart(2, '0')}`, c.x, c.y))
    }
    const esperado = resolverCuerpo({ k: 'donde', where: [] }, vista({ cuerpos: xs }))?.id
    expect(esperado).toBeDefined()
    for (let s = 1; s <= 6; s++) {
      const otro = resolverCuerpo({ k: 'donde', where: [] }, vista({ cuerpos: barajar(xs, s * 7919) }))
      expect(otro?.id, `con la semilla ${String(s)}`).toBe(esperado)
    }
  })

  it('coincide con `porCercania(...)[0]` de `@anima/skills`, que es el otro orden escrito', () => {
    // Hay dos escrituras del mismo orden total: el barrido de `masCercano` y el
    // `sort` de `porCercania`. Este test es lo único que impide que un día digan
    // cosas distintas, y si un día difieren, el hallazgo es de las quince
    // innatas también y no sólo de acá.
    const xs: BodyView[] = []
    for (let i = 0; i < 30; i++) xs.push(cuerpo(`c${String(i).padStart(2, '0')}`, i % 6, (i / 6) | 0))
    for (const desde of [
      { x: 0, y: 0 },
      { x: 3, y: 2 },
      { x: 5, y: 4 },
      { x: -4, y: 7 },
      { x: 2, y: 2 },
    ] as const) {
      const v = vista({ self: criatura({ at: desde }), cuerpos: barajar(xs, desde.x * 31 + desde.y) })
      const mio = resolverCuerpo({ k: 'donde', where: [] }, v)
      const suyo = porCercania(xs, desde)[0]
      expect(mio?.id, `desde ${String(desde.x)},${String(desde.y)}`).toBe(suyo?.id)
      expect(distancia(mio?.at ?? desde, desde)).toBe(distancia(suyo?.at ?? desde, desde))
    }
  })

  it('la métrica es Chebyshev y no euclídea ni Manhattan', () => {
    // La carnada: contra (0,0), `z-cerca` está a Chebyshev 3 y euclídea 4,24;
    // `a-lejos` está a Chebyshev 4 y euclídea 4,00 (Manhattan 6 contra 4). Las
    // tres métricas eligen cosas distintas, y el id está puesto para que el
    // desempate alfabético tampoco pueda salvar a la respuesta equivocada.
    const v = vista({ cuerpos: [cuerpo('a-lejos', 0, 4), cuerpo('z-cerca', 3, 3)] })
    expect(resolverCuerpo({ k: 'donde', where: [] }, v)?.id).toBe('z-cerca')
  })

  it('y no le ordena la lista a `see` por abajo', () => {
    // `see()` puede devolver la lista que la percepción tiene armada. Un `sort`
    // en el lugar le cambiaría el orden a todo el que la mire después, y el bug
    // aparecería en otro módulo.
    const lista: readonly BodyView[] = [cuerpo('z', 1, 0), cuerpo('a', 4, 4), cuerpo('m', 1, 0)]
    const antes = lista.map((b) => b.id)
    const v: VistaDelPlan = {
      see: () => lista,
      recall: () => [],
      q: () => 0,
      qAt: () => 0,
      self: criatura(),
      clock: RELOJ,
    }
    expect(resolverCuerpo({ k: 'donde', where: [] }, v)?.id).toBe('m')
    expect(lista.map((b) => b.id)).toEqual(antes)
  })
})

// ─── `resolverTodos` ────────────────────────────────────────────────────────

describe('`resolverTodos` es todo o nada', () => {
  it('resuelve un registro completo, con las claves en orden', () => {
    const vara = cuerpo('vara', 1, 0)
    const pez = cuerpo('pez', 2, 0)
    const v = vista({ cuerpos: [vara, pez] })
    const roles = { source: { k: 'id', id: 'pez' }, gear: { k: 'id', id: 'vara' } } as const
    const r = resolverTodos(roles, v)
    expect(r).toBeDefined()
    expect(r?.['gear']).toBe(vara)
    expect(r?.['source']).toBe(pez)
    // El orden de las claves es el alfabético y no el de inserción: dos
    // llamadores que arman el mismo registro al revés tienen que producir el
    // mismo objeto para cualquiera que lo recorra.
    expect(Object.keys(r ?? {})).toEqual(['gear', 'source'])
    const alReves = resolverTodos({ gear: { k: 'id', id: 'vara' }, source: { k: 'id', id: 'pez' } }, v)
    expect(Object.keys(alReves ?? {})).toEqual(['gear', 'source'])
  })

  it('con un rol que no resuelve devuelve `undefined`, y no un registro a medias', () => {
    // Un registro a medias viaja hasta el mundo y vuelve como `rol-sin-cuerpo`
    // con el turno ya gastado. Enterarse acá cuesta un `undefined`.
    const v = vista({ cuerpos: [cuerpo('vara', 1, 0)] })
    const r = resolverTodos({ gear: { k: 'id', id: 'vara' }, source: { k: 'id', id: 'pez' } }, v)
    expect(r).toBeUndefined()
  })

  it('un rol que nombra una celda tampoco resuelve: una celda no es un cuerpo', () => {
    const v = vista({ cuerpos: [cuerpo('vara', 1, 0)] })
    const roles: Readonly<Record<string, Ref>> = {
      gear: { k: 'id', id: 'vara' },
      source: { k: 'celda', at: { x: 3, y: 3 } },
    }
    expect(resolverTodos(roles, v)).toBeUndefined()
  })

  it('una clave presente con valor `undefined` se cae, no se saltea en silencio', () => {
    // Saltearla sería descartar en silencio lo que no se entiende — el pecado de
    // `parsePromesa`, que es en parte por lo que este paquete existe.
    const v = vista({ cuerpos: [cuerpo('vara', 1, 0)] })
    const roto = { gear: { k: 'id', id: 'vara' }, b: undefined } as unknown as Record<string, Ref>
    expect(resolverTodos(roto, v)).toBeUndefined()
  })

  it('un registro vacío es un registro vacío, y no un fracaso', () => {
    // `deshilachar` no lo usa, pero un rol opcional ausente sí llega acá como un
    // registro más chico: cero roles tiene que ser `{}` y no `undefined`.
    expect(resolverTodos({}, vista({}))).toEqual({})
  })

  it('y comparte la resolución con `resolverCuerpo`: `rinde` también se lava acá', () => {
    const hoy = cuerpo('pez', 2, 0)
    const v = vista({ cuerpos: [hoy] })
    const rindes: Rindes = new Map([['g1', cuerpo('pez', 80, 80)]])
    const r = resolverTodos({ source: { k: 'rinde', de: 'g1' } }, v, rindes)
    expect(r?.['source']).toBe(hoy)
  })
})

// ─── El costo, contado y no estimado ────────────────────────────────────────

describe('lo que cuesta cada forma, en cuerpos mirados', () => {
  it('`yo`, `celda` y `rinde`-en-la-mano no miran ni un cuerpo', () => {
    const cana = cuerpo('cana', 0, 0)
    const v = vista({ self: criatura({ holding: [cana] }), cuerpos: poblacion(200) })
    resolver({ k: 'yo' }, v)
    resolver({ k: 'celda', at: { x: 1, y: 1 } }, v)
    resolver({ k: 'id', id: 'cana' }, v)
    resolver({ k: 'rinde', de: 'g1' }, v, new Map([['g1', cana]]))
    expect(v.cuerposMirados()).toBe(0)
    expect(v.llamadasASee()).toBe(0)
  })

  it('`id` de algo que está en el piso mira TODOS los cuerpos a la vista', () => {
    // Acá está el costo que no se esconde: `VistaDelPlan` no tiene `porId` —ni lo
    // tiene `Ctx`—, así que ir de un `BodyId` a su vista de hoy es `see([])` y
    // filtrar. Es O(cuerpos a la vista) POR RESOLUCIÓN, y da lo mismo que el
    // cuerpo sea el primero de la lista: `see` materializa la lista entera igual.
    const v = vista({ cuerpos: poblacion(200) })
    expect(resolverCuerpo({ k: 'id', id: 'b000' }, v)?.id).toBe('b000')
    expect(v.llamadasASee()).toBe(1)
    expect(v.cuerposMirados()).toBe(200)

    const w = vista({ cuerpos: poblacion(200) })
    expect(resolverCuerpo({ k: 'id', id: 'no-existe' }, w)).toBeUndefined()
    expect(w.cuerposMirados()).toBe(200)
  })

  it('`donde` mira todos también, y `rinde` cuesta lo mismo que `id`', () => {
    const v = vista({ cuerpos: poblacion(200) })
    resolverCuerpo({ k: 'donde', where: [] }, v)
    expect(v.cuerposMirados()).toBe(200)

    const w = vista({ cuerpos: poblacion(200) })
    resolverCuerpo({ k: 'rinde', de: 'g1' }, w, new Map([['g1', cuerpo('b100', 0, 0)]]))
    expect(w.llamadasASee()).toBe(1)
    expect(w.cuerposMirados()).toBe(200)
  })

  it('y un registro de tres roles paga tres barridos, uno por rol', () => {
    // No hay caché entre roles y no se inventa una: cachear adentro de una
    // resolución sería guardar una foto por el rato que dura la llamada, y el
    // rato que dura una llamada es justo donde nadie mira si envejeció.
    const v = vista({ cuerpos: poblacion(100) })
    resolverTodos(
      { a: { k: 'id', id: 'b001' }, b: { k: 'id', id: 'b002' }, actor: { k: 'id', id: 'b003' } },
      v,
    )
    expect(v.llamadasASee()).toBe(3)
    expect(v.cuerposMirados()).toBe(300)
  })
})

// ─── Herramientas del test ──────────────────────────────────────────────────

function poblacion(n: number): BodyView[] {
  const out: BodyView[] = []
  for (let i = 0; i < n; i++) out.push(cuerpo(`b${String(i).padStart(3, '0')}`, i % 10, (i / 10) | 0))
  return out
}

/**
 * Fisher-Yates con un LCG de semilla fija. Nada de `Math.random`: un test que
 * baraja al azar es un test que falla una vez cada tanto y no se puede reproducir,
 * que es exactamente el bug que este archivo persigue.
 */
function barajar<T>(xs: readonly T[], semilla: number): T[] {
  const out = [...xs]
  let s = semilla >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    const t = out[i] as T
    out[i] = out[j] as T
    out[j] = t
  }
  return out
}
