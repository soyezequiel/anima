// ─── EL RELOJ DEL MUNDO ──────────────────────────────────────────────────────
//
// El criterio verificable de la decisión 4 del ADR II-0009, escrito antes que el
// reloj. Tres cosas, y la primera es la que manda:
//
//   (a) **el mismo segundo de mundo da el mismo `secondsToNightfall` a 10, 20,
//       25, 50 y 100 Hz.** Es el ADR II-0008 aplicado al reloj: la frecuencia es
//       la perilla del RENDIMIENTO y no puede adelantar la noche. La tabla de las
//       cinco frecuencias sale por consola, como en
//       `physics/tests/el-tiempo-en-segundos.test.ts`;
//   (b) **el reloj es DERIVADO**: cero campos nuevos en `WorldState`, cero cambio
//       en la forma del hash, y `relojDe` no puede contestar nada que no salga de
//       `tick` y `hz`;
//   (c) **los tres números del 200**: entero a las cinco frecuencias, cien
//       segundos de luz donde entran dos cocciones de cuero, y 20.000 ticks a
//       20 Hz que son exactamente cinco días.
//
// Y con su control negativo: si el reloj NO dependiera del tiempo, (a) daría
// verde midiendo nada. El control está abajo y mide que el mismo NÚMERO DE TICK a
// distinta frecuencia sí da horas distintas — que es lo correcto, porque un tick
// no es una unidad de tiempo.

import { describe, expect, it } from 'vitest'
import { FRECUENCIAS_ADMISIBLES, HZ_DE_REFERENCIA, dtDeFrecuencia } from '@anima/physics'

import { LARGO_DEL_DIA, relojDe } from '../src/reloj.js'
import type { Clock } from '../src/reloj.js'
import { stepWorld } from '../src/step.js'
import { actor, criatura, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number) => ({ x, y })

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

/** La hora en el segundo `s` de mundo, muestreando a `hz`. */
function alSegundo(s: number, hz: number): Clock {
  return relojDe({ tick: s * hz, hz })
}

/** Los segundos de la tabla: el amanecer, un cuero, el mediodía, la noche y la vuelta. */
const MUESTRAS: readonly (readonly [number, string])[] = [
  [0, 'amanecer'],
  [41, 'un cuero cocido'],
  [82, 'dos cueros cocidos'],
  [99, 'último segundo de luz'],
  [100, 'anochecer'],
  [199, 'último segundo de noche'],
  [200, 'amanecer del día 2'],
  [1000, 'fin del criterio del Hito 5'],
]

// ─── (a) EL CRITERIO: la misma hora a las cinco frecuencias ─────────────────

describe('el mismo segundo de mundo da la misma hora a 10, 20, 25, 50 y 100 Hz', () => {
  it('EXACTO, no aproximado, en los 200 segundos del día entero', () => {
    // Exacto y no «dentro de una tolerancia», al revés que los hechos de la
    // física: acá no hay integración que acumule error. La cuenta es entera hasta
    // la última división y `(100 − s) × hz / hz` devuelve `100 − s` bit a bit.
    for (let s = 0; s <= LARGO_DEL_DIA; s++) {
      const referencia = alSegundo(s, HZ_DE_REFERENCIA)
      for (const hz of FRECUENCIAS_ADMISIBLES) {
        expect([s, hz, alSegundo(s, hz)]).toEqual([s, hz, referencia])
      }
    }
  })

  it('y la tabla, para que el número se vea', () => {
    const filas = MUESTRAS.map(([s, que]) => {
      const columnas = FRECUENCIAS_ADMISIBLES.map((hz) => {
        const r = alSegundo(s, hz)
        return `${r.secondsToNightfall.toFixed(2)}${r.phase === 'dia' ? '' : 'n'}`.padStart(9)
      })
      return `  ${`${String(s)} s`.padStart(6)}  ${que.padEnd(28)}${columnas.join('')}`
    })
    log([
      `══ EL RELOJ, EN SEGUNDOS HASTA EL ANOCHECER ══  día de ${String(LARGO_DEL_DIA)} s, mitad luz y mitad noche`,
      `  ${'segundo de mundo'.padStart(6)}  ${''.padEnd(28)}${FRECUENCIAS_ADMISIBLES.map((h) => `${String(h)} Hz`.padStart(9)).join('')}`,
      ...filas,
      '  (la `n` marca que ya es de noche, y de noche el anochecer ya pasó: 0)',
    ])
    // La tabla no es decorado: se afirma lo que imprime.
    expect(alSegundo(0, HZ_DE_REFERENCIA).secondsToNightfall).toBe(100)
    expect(alSegundo(99, HZ_DE_REFERENCIA).secondsToNightfall).toBe(1)
    expect(alSegundo(100, HZ_DE_REFERENCIA).secondsToNightfall).toBe(0)
  })

  it('EL CONTROL NEGATIVO: el mismo TICK a distinta frecuencia sí da horas distintas', () => {
    // Sin esto, el test de arriba podría estar midiendo un reloj parado. Un tick
    // NO es una unidad de tiempo —es una muestra— y el tick 1000 son cien segundos
    // de mundo a 10 Hz y diez a 100. Que esto cambie es lo correcto; lo que no
    // puede cambiar es el SEGUNDO.
    const alTick1000 = FRECUENCIAS_ADMISIBLES.map((hz) => relojDe({ tick: 1000, hz }))
    expect(alTick1000.map((r) => r.secondsToNightfall)).toEqual([0, 50, 60, 80, 90])
    expect(alTick1000.map((r) => r.phase)).toEqual(['noche', 'dia', 'dia', 'dia', 'dia'])
  })
})

// ─── El día, la noche y el amanecer ─────────────────────────────────────────

describe('la forma del día', () => {
  it('el tick 0 es el amanecer, y son cien segundos de luz y cien de noche', () => {
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const r = relojDe({ tick: 0, hz })
      expect([hz, r.phase]).toEqual([hz, 'dia'])
      expect([hz, r.secondsToNightfall]).toEqual([hz, LARGO_DEL_DIA / 2])
      expect([hz, r.dayLength]).toEqual([hz, LARGO_DEL_DIA])
    }
    for (let s = 0; s < LARGO_DEL_DIA; s++) {
      const r = alSegundo(s, HZ_DE_REFERENCIA)
      expect([s, r.phase]).toEqual([s, s < LARGO_DEL_DIA / 2 ? 'dia' : 'noche'])
    }
  })

  it('de noche el anochecer ya pasó y `secondsToNightfall` es 0, que es lo que la habilidad esperaba', () => {
    // `skills/src/innatas/guarecerse.ts:114` escribe
    // `clock.phase === 'noche' ? 0 : clock.secondsToNightfall` desde antes de que
    // existiera quien le contestara. El reloj no la contradice.
    for (let s = LARGO_DEL_DIA / 2; s < LARGO_DEL_DIA; s++) {
      expect([s, alSegundo(s, HZ_DE_REFERENCIA).secondsToNightfall]).toEqual([s, 0])
    }
  })

  it('da la vuelta: el día 6 amanece igual que el día 1', () => {
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const dia = LARGO_DEL_DIA * hz
      for (const n of [0, 1, 5, 99]) {
        expect([hz, n, relojDe({ tick: n * dia, hz })]).toEqual([hz, n, relojDe({ tick: 0, hz })])
      }
      // Y el último tick de un día es el más oscuro, no el primero del siguiente.
      expect([hz, relojDe({ tick: dia - 1, hz }).phase]).toEqual([hz, 'noche'])
    }
  })

  it('el anochecer se acerca UN PASO por tick, y ni un micro más', () => {
    // Es lo que hace que el reloj sirva para decidir: si el resto de la división
    // se moviera de a saltos, «me vuelvo cuando falten veinte segundos» sería una
    // frase sin punto de corte.
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const dt = dtDeFrecuencia(hz)
      for (let t = 0; t < (LARGO_DEL_DIA / 2) * hz; t++) {
        const antes = relojDe({ tick: t, hz }).secondsToNightfall
        const despues = relojDe({ tick: t + 1, hz }).secondsToNightfall
        expect([hz, t, Number((antes - despues).toFixed(9))]).toEqual([hz, t, Number(dt.toFixed(9))])
      }
    }
  })

  it('un tick negativo —un guardado editado a mano— no devuelve un anochecer negativo', () => {
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      for (const t of [-1, -LARGO_DEL_DIA * hz, -LARGO_DEL_DIA * hz - 1]) {
        const r = relojDe({ tick: t, hz })
        expect([hz, t, r.secondsToNightfall >= 0]).toEqual([hz, t, true])
        expect([hz, t, r.secondsToNightfall <= LARGO_DEL_DIA / 2]).toEqual([hz, t, true])
      }
    }
  })

  it('una frecuencia inadmisible no da un reloj redondeado: lanza', () => {
    // La misma disciplina de `dtDeFrecuencia`. Redondear sería lo cómodo y lo
    // fatal: una partida que corre a otro ritmo del que su crónica dice.
    for (const hz of [30, 60, 0, 7.5, -20]) {
      expect(() => relojDe({ tick: 0, hz })).toThrow(new RegExp(String(hz)))
    }
  })
})

// ─── (b) DERIVADO: cero campos nuevos, cero hash nuevo ──────────────────────

describe('el reloj es derivado y no guardado', () => {
  it('no hay un campo de reloj en `WorldState`: son los mismos siete de siempre', () => {
    // El guardián de la decisión. Un reloj guardado es una SEGUNDA copia del
    // tick, y dos copias del mismo hecho se desincronizan. Si alguien agrega
    // `phase` al estado, este test lo dice antes de que el hash se mueva.
    expect([...Object.keys(mundo({}))].sort()).toEqual([
      'actors',
      'bodies',
      'cells',
      'hz',
      'nextId',
      'phys',
      'tick',
    ])
  })

  it('la hora sale de `tick` y `hz` y de nada más: el mundo entero no la cambia', () => {
    const vacio = mundo({ tick: 1234 })
    const poblado = mundo({
      tick: 1234,
      bodies: [enElPiso(criatura('ana', 500), EN(0, 0))],
      actors: [actor('ana')],
    })
    expect(relojDe(poblado)).toEqual(relojDe(vacio))
    // Y un `{ tick, hz }` escrito a mano contesta lo mismo que el estado entero:
    // ésa es la prueba de que no lee un tercer campo.
    expect(relojDe({ tick: poblado.tick, hz: poblado.hz })).toEqual(relojDe(poblado))
  })

  it('el mundo que avanza mueve el reloj sin que nadie lo escriba', () => {
    let w = mundo({ bodies: [enElPiso(criatura('ana', 500), EN(0, 0))], actors: [actor('ana')] })
    expect(relojDe(w).secondsToNightfall).toBe(LARGO_DEL_DIA / 2)
    for (let t = 0; t < 40; t++) w = stepWorld(w, []).state
    // Cuarenta ticks a 20 Hz son dos segundos de mundo, y el anochecer está dos
    // segundos más cerca. Nadie escribió una hora en ningún lado.
    expect(relojDe(w).secondsToNightfall).toBe(LARGO_DEL_DIA / 2 - 2)
    expect(w.tick).toBe(40)
  })
})

// ─── (c) LOS TRES NÚMEROS DEL 200 ───────────────────────────────────────────

describe('por qué el día dura 200 segundos y no otra cosa', () => {
  it('1. es entero a las cinco frecuencias, y su mitad también', () => {
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const ticksPorDia = LARGO_DEL_DIA * hz
      expect([hz, Number.isInteger(ticksPorDia)]).toEqual([hz, true])
      expect([hz, Number.isInteger(ticksPorDia / 2)]).toEqual([hz, true])
    }
  })

  it('2. en la luz entran DOS cocciones de cuero, que es lo más lento del catálogo', () => {
    // 41 s medidos en `physics/tests/el-tiempo-en-segundos.test.ts:114`, y ya
    // independientes de la frecuencia (41,00 s a 10 Hz y 41,19 a 100). Con menos
    // luz el día sería una interrupción; con mucha más, la noche dejaría de ser
    // una restricción.
    const COCER_EL_CUERO = 41.19
    const luz = LARGO_DEL_DIA / 2
    expect(luz / COCER_EL_CUERO).toBeGreaterThanOrEqual(2)
    expect(luz / COCER_EL_CUERO).toBeLessThan(3)
  })

  it('3. los 20.000 ticks del criterio del Hito 5 son exactamente CINCO DÍAS', () => {
    const TICKS_DEL_CRITERIO = 20_000
    const segundos = TICKS_DEL_CRITERIO / HZ_DE_REFERENCIA
    expect(segundos).toBe(1000)
    expect(segundos / LARGO_DEL_DIA).toBe(5)
    // Y el final del criterio cae en un amanecer, no a mitad de una noche.
    expect(relojDe({ tick: TICKS_DEL_CRITERIO, hz: HZ_DE_REFERENCIA })).toEqual(
      relojDe({ tick: 0, hz: HZ_DE_REFERENCIA }),
    )
  })
})
