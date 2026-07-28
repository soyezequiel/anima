// ─── QUÉ LE PASÓ A MI INTENCIÓN ──────────────────────────────────────────────
//
// El tramo de runtime que viene necesita, para cada intención que emitió, saber
// qué le pasó: es lo que alimenta el `StepResult` que espera el `yield` de una
// habilidad. Hoy eso se puede hacer y funciona, pero funciona POR ACCIDENTE: de
// los doce `SimEvent` sólo `rechazada` lleva `seq`, los de éxito llevan `by` sin
// `seq`, y correlacionar evento con intención sale bien únicamente porque cada
// actor despacha una sola intención por tick (`yaActuo`).
//
// Un accidente no es un contrato. Este archivo escribe el criterio antes que el
// código.

import { describe, expect, it } from 'vitest'

import { desenlaceDe, esRespuesta, stepWorld } from '../src/step.js'
import type { SimEvent, WorldState } from '../src/step.js'
import { apply, eat, goTo, take, wait } from '../src/intent.js'
import type { Intent } from '../src/intent.js'
import {
  actor,
  criatura,
  cuerpo,
  enElPiso,
  enLaMano,
  intencionesAlAzar,
  lcg,
  mundo,
} from './mundo-minimo.js'

const EN = (x: number, y: number) => ({ x, y })

// ─── El caso que HOY falla ───────────────────────────────────────────────────

/**
 * Los ocho rumbos alrededor del origen, tapados con piedra.
 *
 * `piedra` tiene `rigidity` 0.95 y `solid` sale de `step(rigidity, 0.05)`, así que
 * las ocho celdas quedan ocupadas de verdad. La novena —la del origen— la ocupa el
 * cuerpo de la criatura, que también es sólido: `carne` tiene `rigidity` 0.05, que
 * es exactamente el umbral.
 */
function ochoPiedras() {
  const rumbos = [
    EN(1, 0), EN(1, 1), EN(0, 1), EN(-1, 1),
    EN(-1, 0), EN(-1, -1), EN(0, -1), EN(1, -1),
  ]
  return rumbos.map((at, n) => enElPiso(cuerpo(`r${String(n)}`, 'piedra', 3), at))
}

/**
 * Una criatura deshilachando corteza, con la mano ocupada por la propia corteza y
 * las nueve celdas tapadas. Cuando el proceso se completa, la hebra no tiene dónde
 * caer y `rendir` rechaza.
 */
function elMundoSinLugar() {
  return mundo({
    bodies: [
      enElPiso(criatura('ana', 1000), EN(0, 0)),
      enLaMano(cuerpo('c1', 'corteza', 1), EN(0, 0), 'ana'),
      ...ochoPiedras(),
    ],
    actors: [actor('ana', { holding: ['c1'], capacity: 1 })],
  })
}

function deshilachar(w: ReturnType<typeof mundo>, seq: number): Intent {
  return apply({ by: 'ana', seq }, w.phys, 'deshilachar', [
    { name: 'actor', body: 'ana-cuerpo' },
    { name: 'source', body: 'c1' },
  ])!
}

/** Corre hasta que `rendir` rechace, y devuelve el tick, los eventos y la intención. */
function correrHastaElRechazo(): {
  readonly events: readonly SimEvent[]
  readonly intent: Intent
} {
  let w = elMundoSinLugar()
  for (let t = 0; t < 60; t++) {
    // El `seq` es el número del tick a propósito: así el que salga en el evento no
    // puede coincidir por casualidad con el 0 ni con ningún otro número redondo.
    const i = deshilachar(w, t)
    const r = stepWorld(w, [i])
    w = r.state
    if (r.events.some((e) => e.k === 'rechazada')) return { events: r.events, intent: i }
  }
  throw new Error('el proceso nunca llegó a rendir: el mundo de prueba está mal armado')
}

describe('un rechazo que nace adentro de `rendir` sabe a quién le contesta', () => {
  it('lleva el `seq` de la intención que lo causó, y no el −1 mágico', () => {
    // ESTE ES EL CASO QUE HOY FALLA. `rendir` no recibe la intención, así que
    // escribe `seq: -1`: un evento que dice contestarle a la intención número
    // menos uno, que nadie emitió nunca. Quien preguntó «¿qué pasó con mi apply
    // número 40?» ve un `proceso` completo y NO ve el rechazo — se queda creyendo
    // que consiguió la hebra.
    const { events, intent } = correrHastaElRechazo()
    const rech = events.find((e) => e.k === 'rechazada')
    expect(rech?.k === 'rechazada' ? rech.por : undefined).toBe('celda-ocupada')
    expect(rech?.k === 'rechazada' ? rech.seq : undefined).toBe(intent.seq)
  })

  it('y ningún evento del mundo dice contestarle a una intención que no existe', () => {
    const { events } = correrHastaElRechazo()
    const imposibles = events.filter((e) => 'seq' in e && !Number.isInteger(e.seq as number))
    const negativos = events.filter((e) => 'seq' in e && (e.seq as number) < 0)
    expect([...imposibles, ...negativos]).toEqual([])
  })

  it('y el que preguntó se entera de que NO consiguió la hebra', () => {
    // La otra mitad del mismo bug, dicha desde donde duele: el `apply` sale
    // «completo» —el proceso terminó de verdad— y el rendimiento no rindió. Con la
    // correlación por `by` solo, el emisor veía el `proceso` completo y se iba
    // contento. Un rechazo gana sobre cualquier otra cosa que haya pasado.
    const { events, intent } = correrHastaElRechazo()
    const d = desenlaceDe(events, intent)
    expect(d.k).toBe('rechazado')
    expect(d.por).toBe('celda-ocupada')
    expect(d.nacidos).toEqual([])
    // Y los dos eventos son suyos, en el orden en que el mundo los narró: el
    // rendimiento se resuelve ANTES de que salga el `proceso`, así que el rechazo
    // va primero.
    expect(d.events.map((e) => e.k)).toEqual(['rechazada', 'proceso'])
  })
})

// ─── El criterio: N intenciones en el mismo tick, cada una con su respuesta ───

/**
 * Cinco actores en cinco rincones. Los ids están elegidos para que el orden de
 * llegada NO sea el orden en que el tick los procesa: `ordenarIntenciones` compara
 * por unidad de código UTF-16, así que las mayúsculas van antes que el `_` y el
 * `_` antes que las minúsculas. Entran `zoe, ana, Zoe, _bob, Ana` y se despachan
 * `Ana, Zoe, _bob, ana, zoe`.
 */
const CINCO = ['zoe', 'ana', 'Zoe', '_bob', 'Ana'] as const

function cincoEnSusRincones(): WorldState {
  return mundo({
    bodies: [
      enElPiso(criatura('Ana', 1000), EN(0, 0)),
      enElPiso(criatura('Zoe', 1000), EN(0, 5)),
      enElPiso(cuerpo('c1', 'liana', 0.4), EN(1, 5)),
      enElPiso(criatura('_bob', 1000), EN(0, 10)),
      enElPiso(cuerpo('c2', 'pescado', 1), EN(1, 10)),
      enElPiso(criatura('ana', 1000), EN(0, 15)),
      enElPiso(criatura('zoe', 1000), EN(0, 20)),
    ],
    actors: CINCO.map((id) => actor(id)),
  })
}

describe('cinco intenciones en el mismo tick, cada una con su respuesta', () => {
  it('cada actor recibe la suya y ninguna otra, con el MISMO `seq` los cinco', () => {
    // Todos con `seq: 7` a propósito: si la clave fuera el `seq` solo, los cinco
    // se llevarían los eventos de los otros cuatro. La clave es el PAR.
    const s = cincoEnSusRincones()
    const intents: Intent[] = [
      goTo({ by: 'Ana', seq: 7 }, EN(3, 0)),
      take({ by: 'Zoe', seq: 7 }, 'c1'),
      eat({ by: '_bob', seq: 7 }, 'c2'),
      // El rechazo mezclado entre los éxitos: sin él, un test así pasa por
      // coincidencia —todos los eventos serían de la misma familia—.
      take({ by: 'ana', seq: 7 }, 'fantasma'),
      wait({ by: 'zoe', seq: 7 }, 1),
    ]
    const r = stepWorld(s, intents)

    const desenlaces = intents.map((i) => desenlaceDe(r.events, i))
    expect(desenlaces.map((d) => d.k)).toEqual([
      'logrado',
      'logrado',
      'logrado',
      'rechazado',
      'en-curso',
    ])
    expect(desenlaces.map((d) => d.events.map((e) => e.k))).toEqual([
      ['movio'],
      ['tomo'],
      ['comio', 'convierte'],
      ['rechazada'],
      ['esperando'],
    ])
    expect(desenlaces[3]?.por).toBe('cuerpo-desconocido')

    // Y cada evento de respuesta tiene EXACTAMENTE un dueño: ni uno se pierde ni
    // uno se cuenta dos veces. Ésta es la afirmación fuerte del criterio.
    const respuestas = r.events.filter(esRespuesta)
    const repartidos = desenlaces.flatMap((d) => d.events)
    expect(repartidos).toHaveLength(respuestas.length)
    expect(new Set(repartidos).size).toBe(repartidos.length)
    // Lo único que queda sin dueño es la narración: el `murio` del pescado que se
    // comió `_bob` —que no le contesta a nadie porque el `comio` ya dijo cuál
    // era— y el `gasto`, que es el total de `stamina` que el mundo se llevó de
    // todos en este tick y que por eso no puede tener un dueño solo.
    expect(r.events.filter((e) => !esRespuesta(e)).map((e) => e.k)).toEqual(['murio', 'gasto'])
  })

  it('y el `seq` también es parte de la clave: dos intenciones del mismo actor', () => {
    // La segunda sale `ya-actuo` —un cuerpo tiene un turno por tick— y con la
    // correlación por `by` solo no había forma de decir cuál de las dos se
    // despachó: los dos eventos eran «de Ana».
    const s = cincoEnSusRincones()
    const primera = goTo({ by: 'Ana', seq: 0 }, EN(3, 0))
    const segunda = take({ by: 'Ana', seq: 1 }, 'c1')
    const r = stepWorld(s, [primera, segunda])
    expect(desenlaceDe(r.events, primera).events.map((e) => e.k)).toEqual(['movio'])
    const d = desenlaceDe(r.events, segunda)
    expect([d.k, d.por]).toEqual(['rechazado', 'ya-actuo'])
  })

  it('una intención que no se emitió no tiene respuesta, y se puede decir', () => {
    const s = cincoEnSusRincones()
    const r = stepWorld(s, [goTo({ by: 'Ana', seq: 0 }, EN(3, 0))])
    const d = desenlaceDe(r.events, { by: 'Ana', seq: 99 })
    expect([d.k, d.events.length]).toEqual(['sin-respuesta', 0])
  })
})

// ─── La espera: la respuesta llega ticks después ─────────────────────────────

describe('una espera contesta cuando ya no hay ninguna intención en la mesa', () => {
  it('`en-curso` todos los ticks y `logrado` en el último, con el `seq` de siempre', () => {
    // Es EL caso que la correlación por `by` no podía cubrir ni por accidente: la
    // intención se emitió una vez, hace treinta y nueve ticks, y el actor no volvió
    // a decir nada. El `seq` viaja en la `Espera`.
    const s = cincoEnSusRincones()
    const esperar = wait({ by: 'zoe', seq: 13 }, 2)
    let r = stepWorld(s, [esperar])
    let ticks = 1
    while (desenlaceDe(r.events, esperar).k === 'en-curso') {
      r = stepWorld(r.state, [])
      ticks++
      if (ticks > 500) throw new Error('la espera no terminó')
    }
    expect(ticks).toBe(40)
    expect(desenlaceDe(r.events, esperar).k).toBe('logrado')
  })
})

// ─── Lo que nació es de quien lo pidió ───────────────────────────────────────

describe('`nacio` lleva firma, y `murio` y `sustancia` no', () => {
  it('el que ata se lleva el `nacidos` de su propia intención', () => {
    // `StepResult.got` de `@anima/skills` es exactamente esta lista, y `nacio` es
    // el ÚNICO evento que nombra el cuerpo nuevo: sin firma, quien ató no tenía
    // cómo saber qué le quedó en la mano.
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana', 1000), EN(0, 0)),
        enLaMano(cuerpo('vara', 'madera', 0.5), EN(0, 0), 'ana'),
        enLaMano(cuerpo('liana', 'liana', 0.2), EN(0, 0), 'ana'),
      ],
      actors: [actor('ana', { holding: ['vara', 'liana'], capacity: 3 })],
    })
    const atar = (seq: number): Intent =>
      apply({ by: 'ana', seq }, s.phys, 'union', [
        { name: 'a', body: 'vara' },
        { name: 'binder', body: 'liana' },
      ])!
    let w = s
    let d = desenlaceDe([], atar(0))
    for (let t = 0; t < 40; t++) {
      const i = atar(t)
      const r = stepWorld(w, [i])
      w = r.state
      d = desenlaceDe(r.events, i)
      if (d.nacidos.length > 0) break
    }
    expect(d.k).toBe('logrado')
    expect(d.nacidos).toHaveLength(1)
    expect(w.bodies.get(d.nacidos[0] as string)?.heldBy).toBe('ana')
  })
})

// ─── El barrido: ningún evento sin firmar en una partida entera ──────────────

describe('el sello aguanta una partida al azar', () => {
  it('toda respuesta de 300 ticks trae un `seq` que es de alguien', () => {
    // Es el test que sostiene la única aseveración de tipo del paquete: `cerrar`
    // devuelve `SimEvent[]` —con `seq` obligatorio en toda respuesta— sobre un
    // arreglo que adentro del tick era `SimEventSinFirmar[]`. El compilador no
    // puede verificarlo; esto sí.
    const r = lcg(4242)
    const actores = ['ana', 'bru', 'cira', 'dan']
    let w = mundo({
      bodies: [
        ...actores.map((id, n) => enElPiso(criatura(id, 1000), EN(n * 3, 0))),
        enElPiso(cuerpo('c0', 'corteza', 1), EN(0, 2)),
        enElPiso(cuerpo('c1', 'liana', 0.4), EN(1, 2)),
        enElPiso(cuerpo('c2', 'pescado', 1), EN(2, 2)),
        enElPiso(cuerpo('c3', 'madera', 0.5), EN(3, 2)),
        enElPiso(cuerpo('c4', 'piedra', 0.3), EN(4, 2)),
        enElPiso(cuerpo('c5', 'junco', 0.2), EN(5, 2)),
      ],
      actors: actores.map((id) => actor(id)),
    })
    let respuestas = 0
    const huerfanos: string[] = []
    for (let t = 0; t < 300; t++) {
      const lote = intencionesAlAzar(r, actores, 3)
      // El par (by, seq) de todo lo que se puede estar contestando en este tick:
      // las intenciones que entran, y las esperas que ya estaban abiertas.
      const legitimos = new Set(lote.map((i) => `${i.by}#${String(i.seq)}`))
      for (const a of w.actors.values()) {
        if (a.esperando !== undefined) legitimos.add(`${a.id}#${String(a.esperando.seq)}`)
      }
      const paso = stepWorld(w, lote)
      w = paso.state
      for (const e of paso.events) {
        if (!esRespuesta(e)) continue
        respuestas++
        if (!Number.isInteger(e.seq) || e.seq < 0 || !legitimos.has(`${e.by}#${String(e.seq)}`)) {
          huerfanos.push(`tick ${String(t)}: ${e.k} de ${e.by} con seq ${String(e.seq)}`)
        }
      }
      // Y cada intención del lote tiene su desenlace, siempre: el mundo contesta
      // todo lo que entra, aunque sea para decir que no.
      for (const i of lote) {
        if (desenlaceDe(paso.events, i).k === 'sin-respuesta') {
          huerfanos.push(`tick ${String(t)}: ${i.k} de ${i.by} con seq ${String(i.seq)} sin respuesta`)
        }
      }
    }
    expect(huerfanos.slice(0, 10)).toEqual([])
    // Que la partida haya narrado algo, o el test no mide nada.
    expect(respuestas).toBeGreaterThan(500)
  })
})
