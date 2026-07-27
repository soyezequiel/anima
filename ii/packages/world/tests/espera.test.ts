// ─── ESPERAR ES ESPERAR, Y DURA ──────────────────────────────────────────────
//
// `wait.segundos` no significaba nada: el despacho empujaba un `espero` y volvía,
// así que `wait(30)` y `wait(0.05)` hacían exactamente lo mismo —un tick— y
// esperar hasta que se enfríe el pescado era imposible de escribir.
//
// EL CRITERIO, escrito antes que el código:
//
//   a. `wait(2)` tarda DOS SEGUNDOS DE MUNDO a 10, 20, 25, 50 y 100 Hz. No veinte
//      ticks: dos segundos. Esperar es un concepto de RITMO (ADR II-0008), y la
//      frecuencia sólo decide en cuántas muestras se parte;
//   b. el que espera NO emite nada, y no perderla por eso es la mitad de lo que
//      significa esperar;
//   c. el que hace otra cosa deja de esperar, y ahí sí;
//   d. la espera sobrevive a un guardado y a una restauración, porque cae adentro
//      del `Actor` y el `Actor` es una ranura del snapshot;
//   e. y NO TOCA LA MATERIA: agrega un campo al estado y cambia el hash de un
//      mundo con alguien esperando, pero no mueve un solo cuerpo. Eso está medido
//      acá abajo contra un mundo gemelo, y no de palabra.

import { describe, expect, it } from 'vitest'
import { dtDeFrecuencia, FRECUENCIAS_ADMISIBLES } from '@anima/physics'

import { stepWorld } from '../src/step.js'
import type { Actor, SimEvent, WorldState } from '../src/step.js'
import { hashWorldState, restoreWorld, worldSlots } from '../src/mundo.js'
import { hashWorld } from '../src/hash.js'
import { apply, explore, goTo, wait } from '../src/intent.js'
import type { Intent } from '../src/intent.js'
import {
  actor,
  criatura,
  cuerpo,
  enElPiso,
  enLaMano,
  huella,
  intencionesAlAzar,
  lcg,
  mundo,
} from './mundo-minimo.js'

const EN = (x: number, y: number) => ({ x, y })

/** Una criatura sola en el mundo, a la frecuencia que se pida. */
function sola(hz?: number): WorldState {
  return mundo({
    ...(hz === undefined ? {} : { hz }),
    bodies: [enElPiso(criatura('ana', 1000), EN(0, 0))],
    actors: [actor('ana')],
  })
}

/** El `Desenlace` no hace falta acá: lo único que se mira es el evento terminal. */
function termino(events: readonly SimEvent[]): boolean {
  return events.some((e) => e.k === 'espero')
}

function sigueEsperando(events: readonly SimEvent[]): boolean {
  return events.some((e) => e.k === 'esperando')
}

// ─── (a) dos segundos son dos segundos ───────────────────────────────────────

describe('el criterio: `wait(2)` dura dos segundos de mundo a cualquier frecuencia', () => {
  it('a 10, 20, 25, 50 y 100 Hz', () => {
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const dt = dtDeFrecuencia(hz)
      // La intención se emite UNA VEZ, en el primer tick, y después la criatura se
      // calla. Es el uso previsto: una habilidad hace `yield wait(2)` y el runtime
      // no vuelve a emitir nada hasta que el mundo conteste.
      let r = stepWorld(sola(hz), [wait({ by: 'ana', seq: 7 }, 2)])
      let ticks = 1
      while (!termino(r.events)) {
        expect(sigueEsperando(r.events)).toBe(true)
        r = stepWorld(r.state, [])
        ticks++
        if (ticks > 5000) throw new Error(`la espera no terminó nunca a ${String(hz)} Hz`)
      }
      // El tick exacto cambia con la frecuencia —tiene que cambiar—, pero el
      // SEGUNDO en el que termina es el mismo.
      expect([hz, ticks]).toEqual([hz, 2 * hz])
      expect([hz, ticks * dt]).toEqual([hz, 2])
      // Y cuando terminó, terminó: el actor ya no está esperando.
      expect(r.state.actors.get('ana')?.esperando).toBeUndefined()
      filas.push(
        `  ${String(hz).padStart(3)} Hz   ${String(ticks).padStart(4)} ticks   ${String(ticks * dt).padStart(4)} s   dt = ${String(dt)}`,
      )
    }
    /* eslint-disable no-console */
    console.log(
      ['', '══ wait(2) a las cinco frecuencias admisibles ════════════', ...filas, ''].join('\n'),
    )
    /* eslint-enable no-console */
  })

  it('y `esperando` dice cuánto lleva, en segundos y no en ticks', () => {
    // Un paso de mundo después de pedirla, la espera lleva exactamente un paso: a
    // 10 Hz 0,1 y a 100 Hz 0,01, el mismo pedido muestreado más fino.
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const r = stepWorld(sola(hz), [wait({ by: 'ana', seq: 0 }, 2)])
      const e = r.events.find((x) => x.k === 'esperando')
      expect([hz, e?.k === 'esperando' ? e.segundos : -1]).toEqual([hz, 1 / hz])
    }
    // Y el último `esperando` de una espera de dos segundos a 20 Hz dice 1,95 SIN
    // un ulp de sobra: `sumarPaso` acumula en micros enteros, así que treinta y
    // nueve pasos de 0,05 son 1,95 y no 1,9499999999999995. Es lo que hace que la
    // comparación contra el pedido sea exacta y la espera no termine un tick tarde.
    let r = stepWorld(sola(20), [wait({ by: 'ana', seq: 0 }, 2)])
    let ultimo = -1
    while (!termino(r.events)) {
      const e = r.events.find((x) => x.k === 'esperando')
      if (e?.k === 'esperando') ultimo = e.segundos
      r = stepWorld(r.state, [])
    }
    expect(ultimo).toBe(1.95)
  })
})

// ─── (b) y (c) cuándo se pierde una espera ───────────────────────────────────

describe('una espera se pierde por hacer otra cosa, no por no hacer nada', () => {
  it('el que espera y NO emite ninguna intención no la pierde', () => {
    // Es el caso que el barrido de `stepWorld` estaba a punto de romper: ahí se le
    // saca la ACTIVIDAD a todo el que no actuó, y con la misma regla la espera
    // sería imposible — esperar es justamente no emitir nada.
    let r = stepWorld(sola(), [wait({ by: 'ana', seq: 3 }, 1)])
    for (let t = 0; t < 10; t++) {
      expect(r.state.actors.get('ana')?.esperando?.pedido).toBe(1)
      r = stepWorld(r.state, [])
    }
    expect(r.state.actors.get('ana')?.esperando?.seq).toBe(3)
  })

  it('el que emite CUALQUIER otra cosa la pierde en ese mismo tick', () => {
    const abierta = stepWorld(sola(), [wait({ by: 'ana', seq: 0 }, 10)]).state
    expect(abierta.actors.get('ana')?.esperando).toBeDefined()
    const r = stepWorld(abierta, [goTo({ by: 'ana', seq: 1 }, EN(3, 0))])
    expect(r.state.actors.get('ana')?.esperando).toBeUndefined()
    // Y no queda narrando una espera que ya no existe.
    expect(sigueEsperando(r.events)).toBe(false)
    expect(r.events.some((e) => e.k === 'movio')).toBe(true)
  })

  it('incluso si esa otra cosa termina rechazada: intentar ya es dejar de esperar', () => {
    const abierta = stepWorld(sola(), [wait({ by: 'ana', seq: 0 }, 10)]).state
    // `goTo` fuera del mundo: se despacha y se rechaza. El actor gastó su turno.
    const lejos = { x: 1 << 25, y: 0 }
    const r = stepWorld(abierta, [goTo({ by: 'ana', seq: 1 }, lejos)])
    expect(r.events.some((e) => e.k === 'rechazada')).toBe(true)
    expect(r.state.actors.get('ana')?.esperando).toBeUndefined()
  })

  it('pero un rechazo del PORTÓN no la toca: eso no llegó a ser un acto', () => {
    // `sin-permiso` se resuelve antes de despachar nada. La intención no tocó el
    // mundo, así que tampoco puede haberle cortado la espera a nadie.
    const s = mundo({
      bodies: [enElPiso(criatura('ana', 1000), EN(0, 0)), enElPiso(cuerpo('c2', 'pescado', 1), EN(0, 1))],
      actors: [{ ...actor('ana'), permits: 'reversible' as const }],
    })
    const abierta = stepWorld(s, [wait({ by: 'ana', seq: 0 }, 10)]).state
    const comer: Intent = { k: 'eat', by: 'ana', seq: 1, commitment: 'irreversible', what: 'c2' }
    const r = stepWorld(abierta, [comer])
    expect(r.events.some((e) => e.k === 'rechazada' && e.por === 'sin-permiso')).toBe(true)
    expect(r.state.actors.get('ana')?.esperando?.pedido).toBe(10)
  })

  it('reemitir el MISMO `wait` no reinicia la cuenta', () => {
    // Una habilidad que no sabe que el mundo se acuerda reemite todos los ticks.
    // Si eso reiniciara la espera, `wait(2)` no terminaría nunca: se reiniciaría
    // veinte veces por segundo.
    let r = stepWorld(sola(), [wait({ by: 'ana', seq: 0 }, 2)])
    let ticks = 1
    while (!termino(r.events)) {
      r = stepWorld(r.state, [wait({ by: 'ana', seq: ticks }, 2)])
      ticks++
      if (ticks > 500) throw new Error('reemitir el mismo `wait` reinició la espera')
    }
    expect(ticks).toBe(40)
    // Y el que contesta es el ÚLTIMO que preguntó: el `seq` de la espera se
    // actualiza en cada reemisión, porque quien acaba de preguntar es quien quiere
    // la respuesta.
    const fin = r.events.find((e) => e.k === 'espero')
    expect(fin?.k === 'espero' ? fin.seq : -1).toBe(39)
  })

  it('un `wait` con OTRO pedido abre una espera nueva desde cero', () => {
    let r = stepWorld(sola(), [wait({ by: 'ana', seq: 0 }, 10)])
    for (let t = 0; t < 5; t++) r = stepWorld(r.state, [])
    expect(r.state.actors.get('ana')?.esperando?.segundos).toBe(0.3)
    const cambio = stepWorld(r.state, [wait({ by: 'ana', seq: 1 }, 2)])
    expect(cambio.state.actors.get('ana')?.esperando?.pedido).toBe(2)
    // Un paso y no cero: el tick en el que se pide la espera YA es el primer paso
    // de la espera, igual que el tick en el que se pide un `apply` ya es el primer
    // paso del proceso. Los 0,3 de arriba se descartaron enteros.
    expect(cambio.state.actors.get('ana')?.esperando?.segundos).toBe(0.05)
  })
})

// ─── El pedido que no es un número ───────────────────────────────────────────

describe('un pedido imposible no envenena el mundo', () => {
  it('`wait(0)`, `wait(-5)`, `wait(NaN)` y `wait(Infinity)` pasan UN tick', () => {
    for (const cuanto of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = stepWorld(sola(), [wait({ by: 'ana', seq: 0 }, cuanto)])
      expect([cuanto, termino(r.events)]).toEqual([cuanto, true])
      expect(r.state.actors.get('ana')?.esperando).toBeUndefined()
      // Y el mundo se sigue pudiendo hashear, que es lo que de verdad estaba en
      // juego: `hashWorld` LANZA ante un número no finito, así que un `NaN`
      // guardado en el `Actor` sería una habilidad hostil dejando la partida sin
      // identidad con una sola línea.
      expect(() => hashWorldState(r.state)).not.toThrow()
    }
  })
})

// ─── (d) la espera es estado del mundo, y se guarda ──────────────────────────

describe('la espera viaja en el guardado', () => {
  it('guardar y restaurar a mitad de una espera reproduce el final exacto', () => {
    let r = stepWorld(sola(), [wait({ by: 'ana', seq: 11 }, 2)])
    for (let t = 0; t < 9; t++) r = stepWorld(r.state, [])
    const vuelto = restoreWorld(worldSlots(r.state))
    expect(hashWorldState(vuelto)).toBe(hashWorldState(r.state))
    expect(vuelto.actors.get('ana')?.esperando).toEqual(r.state.actors.get('ana')?.esperando)

    // Y los dos terminan la espera en el mismo tick y con el mismo hash.
    let a = r.state
    let b = vuelto
    let ticks = 10
    for (;;) {
      const ra = stepWorld(a, [])
      const rb = stepWorld(b, [])
      a = ra.state
      b = rb.state
      ticks++
      expect(hashWorldState(a)).toBe(hashWorldState(b))
      if (termino(ra.events)) {
        expect(termino(rb.events)).toBe(true)
        break
      }
      if (ticks > 200) throw new Error('la espera restaurada no terminó')
    }
    expect(ticks).toBe(40)
  })

  it('el campo es OPCIONAL: un mundo donde nadie espera hashea como antes', () => {
    // La forma de decirlo sin un número clavado: el hash de un mundo sin esperas
    // tiene que ser el mismo que el de ese mundo con el campo explícitamente
    // ausente, y `hashWorld` saltea las claves ausentes. Lo que se verifica es que
    // ABRIR y CERRAR una espera devuelve el mundo a su hash anterior, o sea que el
    // campo no deja rastro.
    const s = sola()
    const antes = hashWorldState(s)
    const abierta = stepWorld(s, [wait({ by: 'ana', seq: 0 }, 1)]).state
    expect(hashWorldState(abierta)).not.toBe(antes)
    // Se le corta la espera y se le devuelve la `stamina` que el metabolismo le
    // cobró, que es lo único que había cambiado además del tick.
    const ana = abierta.actors.get('ana') as Actor
    expect(ana.esperando).toBeDefined()
    const { esperando: _sinEspera, ...limpio } = ana
    const comoAntes: WorldState = {
      ...s,
      actors: new Map([['ana', limpio]]),
    }
    expect(hashWorldState(comoAntes)).toBe(antes)
  })
})

// ─── (e) la espera no toca la materia ────────────────────────────────────────

describe('esto mueve el hash de un mundo con alguien esperando, y NADA MÁS', () => {
  it('la misma partida con `wait` y con un no-op deja la materia idéntica', () => {
    // LA DEMOSTRACIÓN DE QUE ES FORMA Y NO CONDUCTA, y no contra un número clavado
    // —que otros dos agentes están moviendo en este mismo paquete— sino contra un
    // mundo gemelo:
    //
    //   partida A: el chorro de intenciones al azar tal como sale, con sus `wait`;
    //   partida B: el MISMO chorro con cada `wait` cambiado por `explore(0)`, que
    //              es exactamente lo que `wait` hacía antes de esto — gasta el
    //              turno, emite `espero` y no toca nada.
    //
    // Si la espera fuera un cambio de conducta, los cuerpos de A y los de B
    // terminarían en otro lado. Terminan en el mismo, y los actores también en
    // cuanto se les saca el campo nuevo.
    const r = lcg(20260727)
    const actores = ['ana', 'bru', 'cira']
    const intents: Intent[][] = []
    for (let t = 0; t < 200; t++) intents.push(intencionesAlAzar(r, actores, 3))
    // Y una espera abierta al final, a propósito: con tres intenciones por tick
    // sobre tres actores casi nadie se queda callado, y una espera que se corta
    // enseguida no deja el campo nuevo en el estado final. Los cinco ticks de
    // silencio son para que la espera esté abierta cuando se comparan los hashes.
    intents.push([wait({ by: 'cira', seq: 0 }, 5)])
    for (let t = 0; t < 5; t++) intents.push([])

    const semilla = (): WorldState =>
      mundo({
        bodies: [
          ...actores.map((id, n) => enElPiso(criatura(id, 1000), EN(n * 2, 0))),
          enElPiso(cuerpo('c0', 'corteza', 1), EN(0, 2)),
          enElPiso(cuerpo('c1', 'liana', 0.4), EN(1, 2)),
          enElPiso(cuerpo('c2', 'pescado', 1), EN(2, 2)),
          enLaMano(cuerpo('c3', 'corteza', 1), EN(0, 0), 'ana'),
        ],
        actors: actores.map((id) => actor(id, id === 'ana' ? { holding: ['c3'] } : {})),
      })

    let ticksConAlguienEsperando = 0
    const correr = (mapear: (i: Intent) => Intent): WorldState => {
      let w = semilla()
      for (const lote of intents) {
        w = stepWorld(w, lote.map(mapear)).state
        if ([...w.actors.values()].some((a) => a.esperando !== undefined)) ticksConAlguienEsperando++
      }
      return w
    }

    const conEspera = correr((i) => i)
    ticksConAlguienEsperando = 0
    const sinEspera = correr((i) =>
      i.k === 'wait' ? explore({ by: i.by, seq: i.seq }, 0) : i,
    )
    // La partida B no espera nunca: es la de antes de este trabajo.
    expect(ticksConAlguienEsperando).toBe(0)

    // Y el test no vale nada si la partida A no esperó: que haya alguien esperando
    // al final es lo que hace que la comparación mida algo.
    const esperando = [...conEspera.actors.values()].filter((a) => a.esperando !== undefined)
    expect(esperando.length).toBeGreaterThan(0)

    const materia = (s: WorldState) => hashWorld({ nextId: s.nextId, bodies: s.bodies, cells: s.cells })
    expect(materia(conEspera)).toBe(materia(sinEspera))

    const actoresSinEspera = (s: WorldState) =>
      hashWorld([...s.actors.values()].map(({ esperando: _e, ...resto }) => resto))
    expect(actoresSinEspera(conEspera)).toBe(actoresSinEspera(sinEspera))

    // Y el hash entero SÍ se mueve, que es lo que tiene que pasar: dos mundos
    // idénticos salvo que en uno hay alguien a mitad de una espera no son el
    // mismo mundo.
    expect(hashWorldState(conEspera)).not.toBe(hashWorldState(sinEspera))
  })
})

// ─── El hueco que queda abierto ──────────────────────────────────────────────

describe('lo que la espera destapó y no cierra', () => {
  it('CERRADO — la huella independiente de los tests ya ve la espera', () => {
    // CERRADO por el adversario en `tests/mundo-minimo.ts`, con las tres líneas
    // que este hueco pedía (`t.n(pedido)`, `t.n(segundos)`, `t.n(seq)`) al lado
    // del `if (a.doing !== undefined)`.
    //
    // Por qué importaba: `huella()` es la SEGUNDA implementación del hash,
    // escrita a propósito sin compartir una línea con el paquete —«si el test de
    // gemelos usara el mismo código que el mundo, un bug en el hash haría pasar
    // el test de determinismo por la peor razón posible»—, y no recorría
    // `Actor.esperando`. Como `intencionesAlAzar` emite `wait`, los gemelos de
    // `tests/paso-determinista.test.ts` estaban comparando mundos CON esperas
    // abiertas usando un juez que no las miraba: una divergencia que viviera sólo
    // en la espera se le escapaba entera. Medido antes del arreglo: los dos
    // mundos de abajo daban la misma huella (2933914144).
    const s = sola()
    const esperando = stepWorld(s, [wait({ by: 'ana', seq: 0 }, 10)]).state
    const noEspera = stepWorld(s, [explore({ by: 'ana', seq: 0 }, 0)]).state
    // El hash del paquete los distingue; la huella de los tests, no.
    expect(hashWorldState(esperando)).not.toBe(hashWorldState(noEspera))
    expect(huella(esperando)).not.toBe(huella(noEspera))
  })

  it.fails('SIGUE ABIERTO — esperar no debería sostener la actividad en curso', () => {
    // POR QUÉ SIGUE ABIERTO: no es de la espera, es del barrido de `stepWorld`
    // (`if (a.doing !== undefined && !yaActuo.has(a.id))`). Ese barrido le saca la
    // actividad a quien NO ACTUÓ, así que cualquier intención la conserva —un
    // `take`, un `goTo`, y ahora también un `wait`—, y la criatura puede frotar un
    // palo, irse a esperar dos segundos, volver, y seguir frotando desde donde
    // estaba con el palo ya frío por la ley 1. La actividad tendría que perderse
    // cuando el actor hace OTRA cosa, y no sólo cuando no hace nada.
    //
    // Es previo a este trabajo y vale para las nueve clases de intención, no sólo
    // para `wait`: cerrarlo es cambiar la condición del barrido en `stepWorld` por
    // «se conserva sólo si la intención de este tick fue el MISMO `apply`», y eso
    // mueve la conducta de cualquier partida donde alguien intercale algo en medio
    // de un proceso — o sea que mueve la huella de `partida-de-2000-ticks.test.ts`
    // y necesita su propia demostración de que se movió por el motivo declarado.
    // Se deja medido y nombrado, que es lo que se puede hacer sin salirse del
    // frente.
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana', 1000), EN(0, 0)),
        enLaMano(cuerpo('c1', 'corteza', 1), EN(0, 0), 'ana'),
      ],
      actors: [actor('ana', { holding: ['c1'] })],
    })
    const deshilachar = (seq: number): Intent =>
      apply({ by: 'ana', seq }, s.phys, 'deshilachar', [
        { name: 'actor', body: 'ana-cuerpo' },
        { name: 'source', body: 'c1' },
      ])!
    const uno = stepWorld(s, [deshilachar(0)]).state
    expect(uno.actors.get('ana')?.doing?.segundos).toBe(0.05)
    const dos = stepWorld(uno, [wait({ by: 'ana', seq: 1 }, 2)]).state
    const tres = stepWorld(dos, [deshilachar(2)]).state
    // Lo que debería pasar: la actividad se cortó al esperar y vuelve a empezar.
    // Lo que pasa: sigue de 0,05 a 0,10 como si nunca se hubiera ido.
    expect(tres.actors.get('ana')?.doing?.segundos).toBe(0.05)
  })
})
