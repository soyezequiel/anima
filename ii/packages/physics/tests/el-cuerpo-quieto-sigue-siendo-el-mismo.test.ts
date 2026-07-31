// ─── UN CUERPO QUE NO CAMBIA SIGUE SIENDO EL MISMO OBJETO ────────────────────
//
// `Body` es inmutable, y de eso el motor saca una consecuencia que usa en todos
// lados: **si el objeto es el mismo, el cuerpo es el mismo**. Con eso
// `sistemaLeyes` no reescribe el mapa (`if (r.body !== c.body)`), el juez saltea
// cuerpos ya interrogados (`yaMirados`), y `tagsDe` se memoriza por el array de
// partes. Todos esos atajos son exactos SÓLO si la recíproca se sostiene: que un
// paso que no cambia nada devuelva el mismo objeto.
//
// No se sostenía. `conCualidad` —que es por donde escriben la ley 1 y la ley 11,
// o sea las dos que corren para TODO cuerpo en TODO tick— armaba un `state`
// nuevo y un `Body` nuevo aunque el valor que escribía fuera el que ya estaba.
// Un mundo en equilibrio se recreaba entero, tick tras tick, y todos los atajos
// de identidad quedaban en cero sin que nada se pusiera rojo.
//
// ─── CÓMO SE ENCONTRÓ, que es lo que conviene recordar ──────────────────────
//
// Perfilando el criterio del p99. La primera pregunta fue «¿cuántos de los 5000
// cuerpos cambian por tick?», esperando que fueran pocos y poder saltear el
// resto: contestó **5000 de 5000, los 120 ticks**. Perseguir ese número llevó
// hasta acá. (La respuesta completa a esa pregunta está en el encabezado de
// `world/tests/banco-el-camino-de-intenciones.test.ts`: en esa escena los
// cuerpos cambian de verdad, porque están relajando hacia el ambiente y la
// relajación es asintótica. Pero el hallazgo del camino vale igual.)
//
// Este archivo afirma la propiedad, no el rendimiento: **cuánto se gana depende
// de cuántos cuerpos estén quietos, y eso es de la escena.**

import { describe, expect, it } from 'vitest'
import {
  buildSeedPhysics,
  CELDA_AL_AIRE,
  dtDeFrecuencia,
  HZ_DE_REFERENCIA,
  paso,
  qualityOf,
  T_AMBIENTE,
} from '../src/index.js'
import type { Body } from '../src/index.js'

const PHYS = buildSeedPhysics()
const DT = dtDeFrecuencia(HZ_DE_REFERENCIA)

/** Una piedra a la temperatura y la humedad de la celda: nada tiene que moverse. */
function piedraEnEquilibrio(): Body {
  return {
    id: 'x',
    form: 'vara',
    parts: [{ substance: 'piedra', mass: 1, q: {} }],
    joints: [],
    state: { temperature: T_AMBIENTE, moisture: CELDA_AL_AIRE.wet },
  }
}

describe('un cuerpo quieto sigue siendo el mismo objeto', () => {
  it('en equilibrio con su celda, `paso` devuelve EL MISMO cuerpo, tick tras tick', () => {
    let b = piedraEnEquilibrio()
    const primero = b
    for (let t = 0; t < 200; t += 1) {
      const r = paso(b, { celda: CELDA_AL_AIRE }, PHYS, DT)
      expect(r.body, `cambió de objeto en el tick ${String(t)}`).toBe(b)
      b = r.body
    }
    // Y es el MISMO de los doscientos ticks atrás, no uno que se estabilizó a mitad.
    expect(b).toBe(primero)
    // La guarda contra el test que pasa sin probar nada: el cuerpo estaba de
    // verdad en el equilibrio del que hablamos.
    expect(qualityOf(b, 'temperature', PHYS)).toBe(T_AMBIENTE)
    expect(qualityOf(b, 'moisture', PHYS)).toBe(CELDA_AL_AIRE.wet)
  })

  it('y el control: uno FUERA de equilibrio sí cambia de objeto, y termina quieto', () => {
    // La otra mitad, sin la cual lo de arriba lo cumpliría un `paso` que no hace
    // nada: un cuerpo frío en una celda templada tiene que moverse.
    let b: Body = { ...piedraEnEquilibrio(), state: { temperature: 0, moisture: 0 } }
    const r = paso(b, { celda: CELDA_AL_AIRE }, PHYS, DT)
    expect(r.body).not.toBe(b)
    expect(qualityOf(r.body, 'temperature', PHYS)).toBeGreaterThan(0)

    // Y CONVERGE: la relajación es asintótica, así que en algún tick el paso deja
    // de mover el último bit y el cuerpo se queda quieto de verdad. Cuándo pasa
    // es del punto flotante y no de una tolerancia elegida: por eso se busca y se
    // publica en vez de clavarlo.
    b = r.body
    let quietoEn = -1
    for (let t = 1; t < 5_000; t += 1) {
      const siguiente = paso(b, { celda: CELDA_AL_AIRE }, PHYS, DT)
      if (siguiente.body === b) {
        quietoEn = t
        break
      }
      b = siguiente.body
    }
    console.log(
      `\n─── CUÁNDO SE QUEDA QUIETO ───\n` +
        `  una piedra a 0 °C en una celda a ${String(T_AMBIENTE)} °C deja de cambiar de objeto en el tick ${String(quietoEn)}\n` +
        `  (temperatura final ${qualityOf(b, 'temperature', PHYS).toFixed(15)})\n`,
    )
    expect(quietoEn).toBeGreaterThan(0)
  })
})
