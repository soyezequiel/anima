import { describe, expect, it } from 'vitest'

import { hashWorld } from '../src/hash.js'
import type { WorldHash } from '../src/hash.js'
import { createJournal, journalFromData, replay } from '../src/journal.js'
import type { Journal, JournalData } from '../src/journal.js'
import { createSnapshotChain } from '../src/snapshot.js'
import type { Bicho, Intencion, Mundo } from './mundo-de-juguete.js'
import { intencionAlAzar, lcg, mundoInicial, paso } from './mundo-de-juguete.js'

/**
 * EL CRITERIO DEL HITO 2, la parte que le toca a la crónica.
 *
 * Del documento de arquitectura:
 *   «dos mundos gemelos con 10⁵ intenciones → mismo `hashWorld`»
 *   «restaurar a mitad reproduce el final exacto»
 *
 * Las otras dos mitades del criterio —5000 cuerpos a menos de 4 ms por tick, y
 * el mismo hash en dos motores de JS— no se verifican acá: la primera es del
 * bucle del mundo, y la segunda se verifica corriendo la huella de
 * `hash.test.ts` en el otro motor. Está dicho para que no parezca que este
 * archivo cierra el hito entero.
 *
 * El mundo que se corre es el de juguete de `mundo-de-juguete.ts`, a propósito:
 * si estos tests corrieran contra el mundo de verdad, una divergencia podría ser
 * de la crónica o de las doce leyes. Acá, si esto se pone rojo, es de acá.
 */

const BICHOS = 100
const POR_TICK = 10
const TICKS = 10_000
const INTENCIONES = TICKS * POR_TICK // 100 000

interface Corrida {
  readonly j: Journal<Intencion>
  readonly fin: Mundo
  readonly checkpoints: Map<number, WorldHash>
  readonly mitad: { readonly tick: number; readonly state: Mundo }
}

/**
 * Corre una partida entera y va anotando todo: el journal, un checkpoint cada
 * mil ticks y una foto a la mitad.
 *
 * `inicial` entra por parámetro porque los dos mundos gemelos arrancan con las
 * MISMAS ranuras insertadas en distinto orden: es la única forma de probar que
 * el hash no depende del orden de inserción sobre una partida larga de verdad, y
 * no sobre un objeto de dos claves.
 */
function correr(inicial: Mundo, semilla: number): Corrida {
  const j = createJournal<Intencion>()
  const rnd = lcg(semilla)
  const checkpoints = new Map<number, WorldHash>()
  let m = inicial
  let mitad: { tick: number; state: Mundo } = { tick: 0, state: inicial }

  for (let t = 0; t < TICKS; t++) {
    if (t % 1000 === 0) checkpoints.set(t, hashWorld(m))
    if (t === TICKS / 2) mitad = { tick: t, state: m }
    const intents: Intencion[] = []
    for (let k = 0; k < POR_TICK; k++) {
      const i = intencionAlAzar(rnd, BICHOS)
      j.append(t, i)
      intents.push(i)
    }
    m = paso(m, intents, t)
  }
  checkpoints.set(TICKS, hashWorld(m))
  return { j, fin: m, checkpoints, mitad }
}

/** El mismo mundo, con las ranuras insertadas en otro orden. */
function revuelto(m: Mundo, semilla: number): Mundo {
  const claves = [...m.keys()]
  const rnd = lcg(semilla)
  for (let i = claves.length - 1; i > 0; i--) {
    const jdx = rnd() % (i + 1)
    const tmp = claves[i] as string
    claves[i] = claves[jdx] as string
    claves[jdx] = tmp
  }
  const out: Mundo = new Map()
  for (const k of claves) out.set(k, m.get(k) as Bicho)
  return out
}

describe('el criterio del Hito 2 — la crónica', () => {
  const A = correr(mundoInicial(BICHOS), 12345)

  // Nada de `toLocaleString` para escribir el número, ni siquiera en el título
  // de un test: `Intl` está prohibido en el paquete por la regla 2, y una regla
  // que se afloja «porque es solo un título» deja de ser una regla.
  it(`dos mundos gemelos con ${INTENCIONES} intenciones dan el mismo hashWorld`, () => {
    const B = correr(revuelto(mundoInicial(BICHOS), 999), 12345)

    expect(A.j.length).toBe(INTENCIONES)
    expect(B.j.length).toBe(INTENCIONES)
    // Los dos journals son el mismo journal: misma cadena de hashes.
    expect(B.j.chain).toBe(A.j.chain)
    // Y los dos mundos son el mismo mundo, aunque las ranuras estén guardadas en
    // otro orden y lo hayan estado durante los diez mil ticks.
    expect(hashWorld(B.fin)).toBe(hashWorld(A.fin))
    // El mundo terminó vivo: si se hubiera vaciado, todo esto sería el hash de
    // un Map vacío y el test pasaría sin probar nada.
    expect(A.fin.size).toBeGreaterThan(10)
  })

  it('reproducir la partida entera desde el journal da el mismo hashWorld', () => {
    const rehecho = replay(A.j, { tick: 0, state: mundoInicial(BICHOS) }, paso, {
      hasta: TICKS - 1,
      checkpoints: A.checkpoints,
      hashOf: hashWorld,
    })
    expect(hashWorld(rehecho)).toBe(hashWorld(A.fin))
  })

  it('restaurar a mitad reproduce el final EXACTO', () => {
    // La foto de la mitad pasa por la cadena de snapshots —no se usa el estado
    // vivo— porque lo que hay que probar es que lo GUARDADO alcanza, no que la
    // variable seguía en memoria.
    const snaps = createSnapshotChain<Bicho>()
    snaps.take(0, mundoInicial(BICHOS))
    const d = snaps.take(A.mitad.tick, A.mitad.state)

    const restaurado = snaps.restore(d.index)
    expect(hashWorld(restaurado)).toBe(hashWorld(A.mitad.state))

    const desdeMitad = replay(A.j, { tick: A.mitad.tick, state: restaurado }, paso, {
      hasta: TICKS - 1,
      checkpoints: A.checkpoints,
      hashOf: hashWorld,
    })
    expect(hashWorld(desdeMitad)).toBe(hashWorld(A.fin))
  })

  it('guardar la crónica, cargarla y reproducirla da el mismo hashWorld', () => {
    // El ciclo completo tal como lo va a usar `@anima/store`: el journal va a
    // disco como JSON, vuelve, se revalida la cadena entera y se reproduce.
    const viaje = JSON.parse(JSON.stringify(A.j.toData())) as JournalData<Intencion>
    const cargado = journalFromData(viaje)
    expect(cargado.chain).toBe(A.j.chain)

    const rehecho = replay(cargado, { tick: 0, state: mundoInicial(BICHOS) }, paso, { hasta: TICKS - 1 })
    expect(hashWorld(rehecho)).toBe(hashWorld(A.fin))
  })

  it('el control negativo, y la razón por la que existen los checkpoints', () => {
    // Sin control negativo, todos los tests de arriba podrían estar comparando
    // dos veces la misma cosa por accidente. Pero el control negativo obvio
    // —cambiar una intención y ver que el hash final cambia— SALIÓ ROJO, y la
    // razón vale más que el test:
    //
    //   **este mundo olvida.** El calor se disipa un octavo por tick y el agua
    //   se topa contra cero, así que una intención cambiada en el tick 3 se ve a
    //   los 100 ticks y a los 500 ya no queda ni rastro. Los dos mundos vuelven
    //   a ser el mismo mundo.
    //
    // O sea que **comparar solo el hash final es una prueba débil en un mundo
    // disipativo**, y el mundo de verdad —las doce leyes de `@anima/physics`—
    // también lo es: enfriarse, secarse y saturar son todas funciones que borran
    // información. Un motor con un bug de determinismo puede divergir en el tick
    // 400 y volver a converger para el 20.000, y el hash final diría que todo
    // está bien.
    //
    // Por eso `replay` acepta CHECKPOINTS y por eso el criterio del hito se
    // verifica con ellos y no solo con el final.
    const otra = createJournal<Intencion>()
    for (const e of A.j.entries()) {
      otra.append(e.tick, e.seq === 0 && e.tick === 3 ? { k: 'calentar', id: '7', cuanto: 33 } : e.intent)
    }
    expect(otra.chain).not.toBe(A.j.chain)

    const alTick = (j: Journal<Intencion>, hasta: number): WorldHash =>
      hashWorld(replay(j, { tick: 0, state: mundoInicial(BICHOS) }, paso, { hasta }))

    expect(alTick(otra, 99)).not.toBe(alTick(A.j, 99)) // a los 100 ticks se nota
    expect(alTick(otra, TICKS - 1)).toBe(hashWorld(A.fin)) // a los 10 000, ya no
  })

  it('la cadena de snapshots cada 250 ticks reconstruye la partida entera', () => {
    // Y de paso mide lo que el snapshot por delta promete: guardar cuarenta
    // veces no cuesta cuarenta mundos.
    const snaps = createSnapshotChain<Bicho>()
    let m: Mundo = mundoInicial(BICHOS)
    let ranuras = 0
    for (let t = 0; t < TICKS; t++) {
      if (t % 250 === 0) {
        const d = snaps.take(t, m)
        ranuras += d.set.length + d.del.length
      }
      m = paso(
        m,
        A.j.at(t).map((e) => e.intent),
        t,
      )
    }

    // Cada eslabón que cae sobre un checkpoint de la corrida en vivo tiene que
    // dar exactamente ese hash. Son diez verificaciones cruzadas entre dos
    // caminos independientes: la cadena de deltas y la partida corrida de una.
    let verificados = 0
    for (const d of snaps.deltas) {
      const esperado = A.checkpoints.get(d.tick)
      if (esperado === undefined) continue
      expect(hashWorld(snaps.restore(d.index))).toBe(esperado)
      verificados++
    }
    expect(verificados).toBe(10)

    // La base sola ya son 100 ranuras. Guardar el mundo entero cuarenta veces
    // serían miles; el delta cobra por lo que cambió.
    const completos = snaps.deltas.length * BICHOS
    expect(ranuras).toBeLessThan(completos)
  })
})
