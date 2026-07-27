// ─── UNA PARTIDA DE 2000 TICKS, HASHEADA ─────────────────────────────────────
//
// El control que los tests unitarios NO pueden hacer.
//
// Los 783 tests del árbol prueban, cada uno, la cosa que su autor pensó en
// preguntar. Una caché mal invalidada no falla ahí: falla cuando el mismo cuerpo
// se lee dos veces con algo cambiado en el medio, y eso pasa recién adentro de
// una partida larga, con las leyes corriendo tick tras tick sobre cuerpos que se
// calientan, se cocinan, se pudren, se queman y transmutan.
//
// Este archivo corre esa partida y publica UN NÚMERO: el hash del mundo final,
// más once checkpoints en el camino. Los checkpoints no son adorno — este mundo
// DISIPA, así que un motor que diverge en el tick 400 puede volver a converger
// para el 2000 y el hash final diría que todo está bien.
//
// El número se compara contra el que da el MISMO archivo con las fuentes de
// `@anima/physics` anteriores a la optimización del tick. Si coinciden, no se
// movió ninguna conducta. Si no, el `it` de abajo lo dice con los dos números.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics } from '@anima/physics'
import type { Body, QualityVector } from '@anima/physics'

import { mapaDeActores, mapaDeCuerpos, stepWorld } from '../src/step.js'
import type { Actor, CellState, WorldBody, WorldState } from '../src/step.js'
import type { Intent } from '../src/intent.js'
import { keyOfCell } from '../src/cell.js'
import { hashWorldState } from '../src/mundo.js'
import { revisarInvariantes } from '../src/invariants.js'

// ─── Azar propio ─────────────────────────────────────────────────────────────

interface Rng {
  (): number
  n(max: number): number
}

function azar(semilla: number): Rng {
  let s = semilla >>> 0
  const f = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s
  }
  const r = f as Rng
  // Los bits altos: los bajos de un LCG de módulo 2³² tienen período corto y dos
  // semillas distintas darían la misma sucesión corrida un lugar.
  r.n = (max: number): number => (max <= 0 ? 0 : (f() >>> 16) % max)
  return r
}

// ─── El mundo de la partida ──────────────────────────────────────────────────

const NOMBRES = ['ana', 'beto', 'cira', 'dani', 'eze', 'fina', 'gero', 'hilda']
const COSAS = ['madera', 'liana', 'pescado', 'corteza', 'hoja', 'piedra', 'hueso', 'junco']

function cuerpo(id: string, substance: string, mass: number, state: QualityVector = {}): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state }
}

/**
 * La partida. Ocho criaturas, dieciséis cosas y CUATRO FOGATAS.
 *
 * Las fogatas son lo que hace que esto valga la pena: un cuerpo de madera por
 * encima de su punto de ignición emite potencia, y la potencia arrastra a la ley
 * 1 de todo lo que tenga cerca, que arrastra a la 5, a la 3 y —cuando el
 * carbonizado pasa de 0,8— a la 4, que da de alta una sustancia nueva y cambia la
 * `Physics` del mundo a mitad de la partida. Ése es exactamente el camino donde
 * una memoización por identidad de `Physics` se rompería.
 */
function partida(): WorldState {
  const bodies: WorldBody[] = []
  const actores: Actor[] = []
  for (let i = 0; i < NOMBRES.length; i++) {
    const n = NOMBRES[i] as string
    bodies.push({
      body: cuerpo(`${n}-cuerpo`, 'carne', 2, { stamina: 4000 }),
      at: { x: i - 4, y: i - 4 },
    })
    actores.push({ id: n, body: `${n}-cuerpo`, holding: [], capacity: 3, permits: 'irreversible' })
  }
  for (let i = 0; i < 16; i++) {
    bodies.push({
      body: cuerpo(`c${i}`, COSAS[i % COSAS.length] as string, 1 + (i % 3) * 0.5, {
        // Una cuarta parte arranca mojada y otra cuarta parte ya algo podrida:
        // la ley 11 y la ley 6 tienen de dónde agarrar desde el tick 0.
        ...(i % 4 === 0 ? { moisture: 0.7 } : {}),
        ...(i % 4 === 1 ? { decay: 0.2 } : {}),
      }),
      at: { x: (i % 8) - 4, y: 4 + ((i / 8) | 0) },
    })
  }
  // Las cuatro fogatas: madera muy por encima de su ignición.
  for (let i = 0; i < 4; i++) {
    bodies.push({
      body: cuerpo(`fuego${i}`, 'madera', 3, { temperature: 700 }),
      at: { x: i * 2 - 3, y: -4 },
    })
  }
  // Y una cosa apoyada sobre cada fogata, que es la parrilla del ADR II-0002:
  // el camino `montaje: 'parrilla'` de la ley 1, con exposición 0,25.
  for (let i = 0; i < 4; i++) {
    bodies.push({
      body: cuerpo(`asa${i}`, 'pescado', 0.8, { moisture: 0.5 }),
      at: { x: i * 2 - 3, y: -4 },
      supportedBy: `fuego${i}`,
    })
  }
  const cells = new Map<number, CellState>()
  // Cuatro celdas con condiciones raras: mojada, seca y sin aire (la técnica de
  // tapar, que es la que decide carbón contra ceniza en la ley 4).
  cells.set(keyOfCell({ x: -3, y: -4 }), { wet: 0, oxygen: 0.15, temperature: 15 })
  cells.set(keyOfCell({ x: -1, y: -4 }), { wet: 0, oxygen: 1, temperature: 15 })
  cells.set(keyOfCell({ x: 0, y: 4 }), { wet: 0.9, oxygen: 1, temperature: 5 })
  cells.set(keyOfCell({ x: 1, y: 4 }), { wet: 0.1, oxygen: 0.5, temperature: 40 })

  // Los mapas en ORDEN CANÓNICO de id, que es lo que el invariante de orden pide:
  // un `Map` conserva el orden de inserción, así que armarlo a mano dejaría el
  // hash dependiendo de en qué orden se dieron de alta las cosas.
  return {
    tick: 0,
    phys: buildSeedPhysics(),
    bodies: mapaDeCuerpos(bodies),
    actors: mapaDeActores(actores),
    cells,
    nextId: 1,
  }
}

/** Intenciones arbitrarias: la mitad honestas, la mitad basura. El rechazo también tiene que ser determinista. */
function intenciones(r: Rng, seqBase: number, cuantas: number): Intent[] {
  const out: Intent[] = []
  for (let i = 0; i < cuantas; i++) {
    const by = NOMBRES[r.n(NOMBRES.length)] as string
    const seq = seqBase + i
    const que = `c${r.n(20)}`
    switch (r.n(8)) {
      case 0:
        out.push({ k: 'wait', by, seq, commitment: 'reversible', ticks: 1 })
        break
      case 1:
        out.push({
          k: 'goTo',
          by,
          seq,
          commitment: 'reversible',
          to: { x: r.n(11) - 5, y: r.n(11) - 5 },
          within: 0,
        })
        break
      case 2:
        out.push({ k: 'take', by, seq, commitment: 'reversible', what: que })
        break
      case 3:
        out.push({ k: 'drop', by, seq, commitment: 'reversible', what: que })
        break
      case 4:
        out.push({
          k: 'put',
          by,
          seq,
          commitment: 'reversible',
          what: que,
          at: { x: r.n(9) - 4, y: r.n(9) - 4 },
        })
        break
      case 5:
        out.push({ k: 'eat', by, seq, commitment: 'irreversible', what: que })
        break
      case 6:
        out.push({
          k: 'apply',
          by,
          seq,
          commitment: 'costly',
          process: 'deshilachar',
          roles: [
            { name: 'actor', body: `${by}-cuerpo` },
            { name: 'source', body: que },
          ],
        })
        break
      default:
        out.push({
          k: 'apply',
          by,
          seq,
          commitment: 'reversible',
          process: 'union',
          roles: [
            { name: 'a', body: que },
            { name: 'binder', body: `c${r.n(20)}` },
          ],
        })
        break
    }
  }
  return out
}

interface Resultado {
  readonly hashFinal: string
  readonly checkpoints: readonly string[]
  readonly sustancias: number
  readonly cuerpos: number
  readonly eventos: number
  readonly violaciones: readonly string[]
}

function correr(ticks: number, semilla: number): Resultado {
  const r = azar(semilla)
  let w = partida()
  const checkpoints: string[] = []
  let eventos = 0
  const violaciones: string[] = []
  for (let t = 0; t < ticks; t++) {
    const antes = w
    const paso = stepWorld(w, intenciones(r, t * 10, 4))
    w = paso.state
    eventos += paso.events.length
    // Los invariantes en TODOS los ticks, y con `antes` y `despues`: una caché
    // mal invalidada que invente materia rompe la conservación antes de mover el
    // hash de una manera que se pueda leer.
    for (const v of revisarInvariantes(antes, w, paso.events)) {
      violaciones.push(`t${t} ${JSON.stringify(v)}`)
    }
    if (t % 200 === 0) checkpoints.push(hashWorldState(w))
  }
  checkpoints.push(hashWorldState(w))
  return {
    hashFinal: hashWorldState(w),
    checkpoints,
    sustancias: w.phys.substances.size,
    cuerpos: w.bodies.size,
    eventos,
    violaciones,
  }
}

describe('una partida de 2000 ticks', () => {
  it('el hash final y los checkpoints, publicados', () => {
    const r = correr(2000, 20260727)
    /* eslint-disable no-console */
    console.log(
      [
        '',
        '══ PARTIDA DE 2000 TICKS ════════════════════════════════',
        `  hash final ......... ${r.hashFinal}`,
        `  checkpoints ........ ${r.checkpoints.join(' ')}`,
        `  sustancias al final  ${r.sustancias}   (26 semilla + las que dio de alta la ley 4)`,
        `  cuerpos al final ... ${r.cuerpos}`,
        `  eventos ............ ${r.eventos}`,
        `  violaciones ........ ${r.violaciones.length}`,
        ...r.violaciones.slice(0, 5).map((v) => `      ${v}`),
        '',
      ].join('\n'),
    )
    /* eslint-enable no-console */

    // La partida tiene que HACER algo: una partida en la que no pasa nada no
    // prueba nada sobre ninguna caché.
    expect(r.eventos).toBeGreaterThan(1000)
    // La ley 4 tiene que haber dado de alta al menos una sustancia: ése es el
    // camino donde la `Physics` cambia a mitad de la partida.
    expect(r.sustancias).toBeGreaterThan(26)

    // NINGUNA violación de CONSERVACIÓN ni de materia. Son las que una caché mal
    // invalidada produce: leer una masa vieja después de que la ley 5 evaporara
    // agua es materia inventada, y el candado no la ve porque el candado lee con
    // la misma caché.
    //
    // Las `solidos-solapados` que sí aparecen son de OTRA cosa y son previas a
    // esta optimización: mi chorro de intenciones deja que dos criaturas caminen
    // a la misma celda, y el invariante de la pila —correctamente— se queja. Está
    // verificado que el mismo número sale con las fuentes de física de 11b49ae, o
    // sea que no lo trajo el que optimizó el tick. Se cuentan, no se toleran en
    // silencio.
    expect(r.violaciones.filter((v) => !v.includes('solidos-solapados'))).toEqual([])

    // EL NÚMERO. Es el mismo que da esta partida con las fuentes anteriores a la
    // optimización del tick, verificado corriendo este archivo contra las tres
    // fuentes de `@anima/physics` de 11b49ae (`body.ts`, `leyes.ts`, `quality.ts`).
    expect(r.hashFinal).toBe('61d4b9588a81717d')
    expect(r.checkpoints.join(' ')).toBe(
      '983e8cc3041387d6 2325bb7f2980c65c 65e5af5df3d1b412 ecf0b49b2e357f2a fb90249f3d5e5682 1ff8adb430ee53f3 38a64ee031c67e2b c1a887653dcc3aae a2eb00e96725e15c 71bfb8b64dfa2a71 61d4b9588a81717d',
    )
    expect(r.eventos).toBe(8004)
    expect(r.sustancias).toBe(30)
    expect(r.violaciones.length).toBe(97)
  }, 300_000)

  it('la partida es reproducible dentro de esta corrida', () => {
    // Control mínimo: si esto fallara, el número de arriba no significaría nada.
    expect(correr(300, 20260727).hashFinal).toBe(correr(300, 20260727).hashFinal)
    // Y control negativo: otra semilla, otro mundo.
    expect(correr(300, 20260727).hashFinal).not.toBe(correr(300, 99).hashFinal)
  }, 300_000)
})
