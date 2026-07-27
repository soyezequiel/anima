// El criterio del Hito 2 verificado con una HUELLA INDEPENDIENTE del paquete.
//
//   - dos mundos gemelos con 10⁵ intenciones producen la misma huella
//   - restaurar a mitad reproduce el final exacto
//
// El criterio con el `hashWorld` del paquete —que es la frase literal del
// documento— está en `tests/hito-2-el-criterio.test.ts`. Este archivo NO es
// redundante con aquél, y la razón es la única que justifica escribir dos veces
// la misma prueba: **la huella de acá sale de `tests/mundo-minimo.ts`, escrita a
// mano y sin una línea en común con `hash.ts`**. Si el criterio se verificara
// solo con `hashWorld`, un bug en el hash haría pasar todo por la peor razón
// posible, que es dos mundos distintos hasheando igual. Dos jueces
// independientes que coinciden dicen algo; uno solo, no.
//
// El criterio de rendimiento se mudó a `tests/banco-el-tick.test.ts` (ver el
// final del archivo).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ordenarIntenciones } from '../src/intent.js'
import type { WorldBody, WorldState } from '../src/step.js'
import { stepWorld } from '../src/step.js'
import { revisarInvariantes } from '../src/invariants.js'
import {
  actor,
  criatura,
  cuerpo,
  enElPiso,
  huella,
  intencionesAlAzar,
  lcg,
  mundo,
} from './mundo-minimo.js'

const EN = (x: number, y: number) => ({ x, y })

const NOMBRES = ['ana', 'beto', 'cira', 'dani', 'eze', 'fina', 'gero', 'hilda', 'ivo', 'juli']

function partida(): WorldState {
  const bodies: WorldBody[] = []
  const actores = []
  for (let i = 0; i < NOMBRES.length; i++) {
    const n = NOMBRES[i]!
    bodies.push(enElPiso(criatura(n, 4000), EN(i - 5, i - 5)))
    actores.push(actor(n, { capacity: 3 }))
  }
  const materia = ['madera', 'liana', 'pescado', 'corteza', 'hoja', 'piedra']
  for (let i = 0; i < 6; i++) {
    bodies.push(enElPiso(cuerpo(`c${i}`, materia[i]!, 1), EN(i - 3, 3)))
  }
  return mundo({ bodies, actors: actores })
}

/** Corre `ticks` ticks con el mismo chorro reproducible de intenciones. */
function correr(s0: WorldState, semilla: number, ticks: number, porTick: number): WorldState {
  const r = lcg(semilla)
  let s = s0
  for (let t = 0; t < ticks; t++) s = stepWorld(s, intencionesAlAzar(r, NOMBRES, porTick)).state
  return s
}

describe('dos mundos gemelos', () => {
  it('con 10⁵ intenciones, la misma huella', () => {
    // 10 000 ticks × 10 intenciones. La mitad son basura a propósito: el
    // determinismo tiene que valer también para el camino del RECHAZO, que es el
    // que más ramas tiene y el que nadie mira.
    const TICKS = 10_000
    const POR_TICK = 10
    expect(TICKS * POR_TICK).toBe(100_000)
    const uno = correr(partida(), 20260727, TICKS, POR_TICK)
    const otro = correr(partida(), 20260727, TICKS, POR_TICK)
    expect(huella(uno)).toBe(huella(otro))
    // Y no es que la huella no mire nada: dos semillas distintas dan distinto.
    expect(huella(correr(partida(), 1, 200, POR_TICK))).not.toBe(
      huella(correr(partida(), 2, 200, POR_TICK)),
    )
  }, 300_000)

  it('el orden de LLEGADA de las intenciones no cambia nada', () => {
    // Es la mitad del determinismo que no se ve: dos mentes que contestan en
    // distinto orden no pueden producir dos mundos.
    const s = partida()
    const is = intencionesAlAzar(lcg(7), NOMBRES, 20)
    expect(huella(stepWorld(s, is).state)).toBe(huella(stepWorld(s, [...is].reverse()).state))
  })

  it('ordenar es idempotente y el orden es total', () => {
    const una = ordenarIntenciones(intencionesAlAzar(lcg(11), NOMBRES, 200))
    expect(ordenarIntenciones([...una].reverse())).toEqual(una)
    for (let i = 1; i < una.length; i++) {
      const a = una[i - 1]!
      const b = una[i]!
      expect(a.by < b.by || (a.by === b.by && a.seq <= b.seq)).toBe(true)
    }
  })
})

describe('restaurar a mitad reproduce el final exacto', () => {
  it('cortar en el tick 500, guardar y seguir da el mismo mundo que no cortar', () => {
    const TOTAL = 1000
    const MITAD = 500
    const seguido = correr(partida(), 424242, TOTAL, 4)

    // Cortando: se guarda el estado en la mitad y se sigue desde el guardado. El
    // chorro de intenciones tiene que ser el mismo, y por eso el generador se
    // rearma y se lo hace avanzar hasta donde iba: lo que un journal guarda son
    // las INTENCIONES, no el generador que las produjo.
    const r1 = lcg(424242)
    let s = partida()
    for (let t = 0; t < MITAD; t++) s = stepWorld(s, intencionesAlAzar(r1, NOMBRES, 4)).state
    const guardado = clonar(s)
    const r2 = lcg(424242)
    for (let t = 0; t < MITAD; t++) intencionesAlAzar(r2, NOMBRES, 4)
    let vuelto = guardado
    for (let t = MITAD; t < TOTAL; t++) {
      vuelto = stepWorld(vuelto, intencionesAlAzar(r2, NOMBRES, 4)).state
    }
    expect(huella(vuelto)).toBe(huella(seguido))
  }, 120_000)

  it('el estado guardado y vuelto a cargar es el mismo estado', () => {
    const s = correr(partida(), 99, 50, 4)
    expect(huella(clonar(s))).toBe(huella(s))
    expect(revisarInvariantes(s, clonar(s))).toEqual([])
  })
})

/**
 * Una copia profunda por estructura, que es lo que hace un guardado honesto: si
 * el estado sobreviviera al viaje solo porque las dos mitades comparten los
 * mismos objetos, el test no probaría nada.
 */
function clonar(s: WorldState): WorldState {
  const bodies = new Map<string, WorldBody>()
  for (const [id, c] of s.bodies) {
    bodies.set(id, {
      ...c,
      at: { x: c.at.x, y: c.at.y },
      body: {
        ...c.body,
        parts: c.body.parts.map((p) => ({ ...p, q: { ...p.q } })),
        joints: c.body.joints.map((j) => ({ ...j })),
        state: { ...c.body.state },
      },
    })
  }
  const actors = new Map(
    [...s.actors].map(([id, a]) => [
      id,
      a.doing === undefined
        ? { ...a, holding: [...a.holding] }
        : { ...a, holding: [...a.holding], doing: { ...a.doing, roles: [...a.doing.roles] } },
    ]),
  )
  return { ...s, bodies, actors, cells: new Map(s.cells) }
}

describe('la regla 2 de la carpeta, verificada sobre el código', () => {
  it('ni azar, ni reloj, ni Math sin precisión especificada, ni Ánima I', () => {
    // `Math.exp` y `Math.pow` NO tienen precisión especificada en ECMAScript: dos
    // navegadores pueden devolver el último bit distinto y el replay diverge en
    // el tick 400. Es la regla 2 de `ii/README.md` verificada por un test y no
    // por la buena voluntad de quien escribe.
    const prohibidos: readonly RegExp[] = [
      /\bMath\.random\b/,
      /\bnew Date\b/,
      /\bDate\.now\b/,
      /\bperformance\./,
      /\bIntl\b/,
      /\blocaleCompare\b/,
      /\btoLocaleString\b/,
      /\bMath\.(exp|pow|log|log2|log10|sqrt|cbrt|sin|cos|tan|atan2|hypot|expm1|log1p)\b/,
      /\*\*/,
      /from '@anima\/(sim-core|agent-core|skill-runtime|web|api)'/,
      /from '(\.\.\/)+packages\//,
    ]
    for (const archivo of ['intent.ts', 'step.ts', 'invariants.ts']) {
      const ruta = fileURLToPath(new URL(`../src/${archivo}`, import.meta.url))
      // Se leen las líneas de CÓDIGO y no los comentarios: este paquete explica
      // por qué `Math.exp` está prohibido, y explicarlo no puede ser la infracción.
      const codigo = readFileSync(ruta, 'utf8')
        .split('\n')
        .filter((l) => {
          const t = l.trimStart()
          return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
        })
        .join('\n')
      for (const p of prohibidos) {
        expect(`${archivo} ${String(p)}: ${String(codigo.match(p))}`).toBe(
          `${archivo} ${String(p)}: null`,
        )
      }
    }
  })
})

// ─── El criterio de rendimiento vive en el banco ─────────────────────────────
//
// Lo medía este archivo y se mudó entero a `tests/banco-el-tick.test.ts`, que es
// el ÚNICO del paquete que toca el reloj. No es orden por el orden: `process.hrtime`
// es un reloj, la regla 2 de `ii/README.md` lo prohíbe en el mundo, y tenerlo en
// un solo archivo con nombre propio es lo que hace que la prohibición se pueda
// revisar de un vistazo. El banco además mide más —de dónde sale el costo adentro
// de `paso()`— y deja UN solo `it.fails` para el criterio en vez de dos.
