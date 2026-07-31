// ─── LA FRECUENCIA ES PARTE DE LA IDENTIDAD DE UNA PARTIDA ───────────────────
//
// El ADR II-0008 pide tres cosas del mundo, y las tres se verifican acá:
//
//   1. que RECHACE una frecuencia cuyo `dt = 1/Hz` no sea exacto, en vez de
//      redondearla en silencio;
//   2. que la frecuencia entre en el journal junto a la semilla;
//   3. que cargar un guardado con otra frecuencia sea un ERROR EXPLÍCITO.
//
// Por qué las tres: dos mundos con la misma semilla y distinta frecuencia
// muestrean la misma física con distinta finura y NO producen la misma traza. Eso
// es correcto y esperado. Lo que no puede pasar es que la diferencia aparezca
// como una divergencia de hash mil ticks después, sin causa visible — que es
// exactamente la clase de bug que este paquete existe para hacer imposible.

import { describe, expect, it } from 'vitest'
import { dtDeFrecuencia, FRECUENCIAS_ADMISIBLES, HZ_DE_REFERENCIA, PHYSICS_VERSION } from '@anima/physics'

import { stepWorld } from '../src/step.js'
import { hashWorldState, restoreWorld, worldSlots, pasoDelMundoA } from '../src/mundo.js'
import { createJournal, journalFromData, CRONICA_POR_OMISION } from '../src/journal.js'
import type { CronicaDe } from '../src/journal.js'
import { apply, wait } from '../src/intent.js'
import type { Intent } from '../src/intent.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number) => ({ x, y })

describe('el mundo rechaza una frecuencia que no da un `dt` exacto', () => {
  it('30 Hz no arranca: se para al primer paso y dice por qué', () => {
    // Los 30 Hz que el documento de arquitectura declaraba «fijos». La auditoría
    // los marcó como decretados sin argumento, y acá está el argumento que
    // faltaba: `1/30` no es exacto en la escala de las tasas.
    const s = mundo({ hz: 30, bodies: [enElPiso(criatura('ana'), EN(0, 0))], actors: [actor('ana')] })
    expect(() => stepWorld(s, [])).toThrow(/30 Hz/)
    expect(() => stepWorld(s, [])).toThrow(/no es exacto/)
  })

  it('y no redondea: 30 Hz no se convierte calladamente en 25 ni en 50', () => {
    // Redondear sería lo cómodo y lo fatal. El síntoma no sería un número raro
    // sino dos motores que divergen en el tick 400 sin ninguna causa visible.
    const s = mundo({ hz: 30 })
    let corrio = false
    try {
      stepWorld(s, [])
      corrio = true
    } catch {
      corrio = false
    }
    expect(corrio).toBe(false)
  })

  it('las cinco admisibles arrancan y avanzan el reloj', () => {
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const s = mundo({ hz, bodies: [enElPiso(criatura('ana'), EN(0, 0))], actors: [actor('ana')] })
      const r = stepWorld(s, [])
      expect([hz, r.state.tick, r.state.hz]).toEqual([hz, 1, hz])
    }
  })
})

describe('la frecuencia entra en la identidad del mundo', () => {
  const conCosas = (hz: number) =>
    mundo({
      hz,
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enLaMano(cuerpo('c1', 'liana', 0.4), EN(0, 0), 'ana')],
      actors: [actor('ana', { holding: ['c1'] })],
    })

  it('dos mundos idénticos salvo la frecuencia NO hashean igual', () => {
    // Y tienen que no hashear igual: son dos muestreos distintos del mismo mundo.
    // Si hashearan igual, el juez no podría distinguir «la misma partida» de «la
    // misma partida corrida más fino», que es la primera pregunta ante una
    // divergencia.
    expect(hashWorldState(conCosas(20))).not.toBe(hashWorldState(conCosas(25)))
  })

  it('la frecuencia sobrevive a guardar y restaurar', () => {
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const s = conCosas(hz)
      const vuelto = restoreWorld(worldSlots(s))
      expect([hz, vuelto.hz]).toEqual([hz, hz])
      expect(hashWorldState(vuelto)).toBe(hashWorldState(s))
    }
  })

  it('un guardado con una frecuencia inadmisible no se abre', () => {
    // No se puede fabricar un `WorldState` a 30 Hz y correrlo, pero SÍ se puede
    // escribir un archivo con ese número: un guardado viejo, una edición a mano,
    // un bug de otra versión. Abrirlo tiene que fallar acá y no en el tick 400.
    const slots = worldSlots(conCosas(20))
    const cabecera = slots.get('mundo') as { tick: number; hz: number; nextId: number; version: number }
    const roto = new Map(slots)
    roto.set('mundo', { ...cabecera, hz: 30 })
    expect(() => restoreWorld(roto)).toThrow(/30 Hz/)
  })
})

describe('la crónica dice con qué se corrió', () => {
  it('el journal guarda frecuencia y semilla, y las devuelve al cargarlo', () => {
    const de: CronicaDe = { hz: 25, semilla: 20260727, physicsVersion: PHYSICS_VERSION }
    const j = createJournal<Intent>(de)
    j.append(0, wait({ by: 'ana', seq: 0 }, 1))
    j.append(1, wait({ by: 'ana', seq: 0 }, 1))
    const data = j.toData()
    expect(data.de).toEqual(de)
    expect(journalFromData(data).de).toEqual(de)
  })

  it('cargarlo con OTRA frecuencia es un error explícito, no una divergencia', () => {
    const j = createJournal<Intent>({ hz: 25, semilla: 7, physicsVersion: PHYSICS_VERSION })
    j.append(0, wait({ by: 'ana', seq: 0 }, 1))
    const data = j.toData()
    expect(() => journalFromData(data, { hz: 20, semilla: 7, physicsVersion: PHYSICS_VERSION })).toThrow(/25 Hz/)
    expect(() => journalFromData(data, { hz: 20, semilla: 7, physicsVersion: PHYSICS_VERSION })).toThrow(/muestreos distintos/)
    // Y la semilla, por la misma razón: son las dos cosas que hay que volver a
    // tener para llegar al mismo lado.
    expect(() => journalFromData(data, { hz: 25, semilla: 8, physicsVersion: PHYSICS_VERSION })).toThrow(/semilla/)
    // Con las dos iguales, abre.
    expect(journalFromData(data, { hz: 25, semilla: 7, physicsVersion: PHYSICS_VERSION }).length).toBe(1)
  })

  it('una crónica con frecuencia inadmisible no se crea ni se abre', () => {
    expect(() => createJournal<Intent>({ hz: 30, semilla: 0, physicsVersion: PHYSICS_VERSION })).toThrow(/30 Hz/)
    const j = createJournal<Intent>({ hz: 20, semilla: 0, physicsVersion: PHYSICS_VERSION })
    j.append(0, wait({ by: 'ana', seq: 0 }, 1))
    const roto = { ...j.toData(), de: { hz: 30, semilla: 0, physicsVersion: PHYSICS_VERSION } }
    expect(() => journalFromData(roto)).toThrow(/30 Hz/)
  })

  it('por omisión, la frecuencia de referencia', () => {
    expect(CRONICA_POR_OMISION.hz).toBe(HZ_DE_REFERENCIA)
    expect(createJournal<Intent>().de).toEqual(CRONICA_POR_OMISION)
  })

  it('y reproducir a otra frecuencia se para en el primer paso', () => {
    // El gemelo de la verificación del tick en `pasoDelMundo`: reproducir a otra
    // frecuencia no da un error natural, da un mundo COHERENTE y distinto. Por eso
    // hay que preguntarlo a propósito.
    const s = mundo({ hz: 20, bodies: [enElPiso(criatura('ana'), EN(0, 0))], actors: [actor('ana')] })
    const paso = pasoDelMundoA(25)
    expect(() => paso(s, [], 0)).toThrow(/25 Hz/)
    expect(pasoDelMundoA(20)(s, [], 0).tick).toBe(1)
  })
})

describe('el mismo segundo de mundo, a cualquier frecuencia', () => {
  it('deshilachar rinde su hebra a los dos segundos, se muestree como se muestree', () => {
    // EL CRITERIO, del lado del mundo. `deshilachar` declara dos segundos, y dos
    // segundos son dos segundos: a 10 Hz son veinte pasos y a 100 son doscientos.
    // Antes eran «40 ticks», o sea cuatro segundos a 10 Hz y 0,4 a 100.
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const s = mundo({
        hz,
        bodies: [
          enElPiso(criatura('ana', 1000), EN(0, 0)),
          enLaMano(cuerpo('c1', 'corteza', 1), EN(0, 0), 'ana'),
        ],
        actors: [actor('ana', { holding: ['c1'] })],
      })
      const at = s.phys.processes.get('deshilachar')!.completion!.at
      const dt = dtDeFrecuencia(hz)
      const pasos = Math.round(at / dt)
      let w = s
      let cuandoNacio = -1
      for (let i = 0; i < pasos + 2; i++) {
        const r = stepWorld(w, [aplicarDeshilachar(w, i)])
        w = r.state
        for (const e of r.events) if (e.k === 'nacio' && cuandoNacio < 0) cuandoNacio = i + 1
      }
      // El paso exacto cambia con la frecuencia —tiene que cambiar—, pero el
      // SEGUNDO en el que ocurre es el mismo.
      expect([hz, cuandoNacio]).toEqual([hz, pasos])
      expect([hz, cuandoNacio * dt]).toEqual([hz, at])
    }
  })
})

function aplicarDeshilachar(w: ReturnType<typeof mundo>, seq: number): Intent {
  return apply({ by: 'ana', seq }, w.phys, 'deshilachar', [
    { name: 'actor', body: 'ana-cuerpo' },
    { name: 'source', body: 'c1' },
  ])!
}
