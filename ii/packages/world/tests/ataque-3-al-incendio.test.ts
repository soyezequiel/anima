// ═══ EL ATAQUE AL ADR II-0011 ════════════════════════════════════════════════
//
// «Arder libera calor, y la ley 1 se integra en forma cerrada.»
//
// El tramo anterior hizo que el fuego DURE. Este archivo pregunta lo que un
// fuego que dura obliga a preguntar y que nadie había preguntado nunca, porque
// hasta ayer no había con qué: **¿se apaga? ¿se queda quieto? ¿la criatura puede
// quemar el mundo, o quemarse ella?**
//
// Todo lo de acá se mide contra `stepWorld` y contra `paso()`. Ningún número
// sale de rehacer una ecuación al lado del motor.
//
// ─── EL VEREDICTO, EN CUATRO LÍNEAS ─────────────────────────────────────────
//
//   1. EL FUEGO SE PROPAGA, y eso es NUEVO. Una pila de cinco leños de 1 kg
//      prende entera en 0,90 s; cuatro pilas de 20 kg separadas por una celda
//      prenden a los 5,35 · 9,40 · 13,40 s, o sea una celda cada cuatro
//      segundos, y sin techo. Revirtiendo `physics/src` a HEAD: NUNCA.
//   2. LA DURACIÓN NO CRECE CON LA MASA arriba de 0,84 kg. Un leño de 1 kg y
//      uno de 50 arden los MISMOS 50,00 s; el de 50 kg tira el 98,3% de su
//      combustible. La promesa del ADR —«60 s por kilo», «juntar leña ES la
//      respuesta a que el fuego se apague»— vale sólo en el tramo 0–0,83 kg,
//      que es exactamente el tramo que el constructor midió.
//   3. LA CONSERVACIÓN AGUANTA. `fuelEnergy` no sube nunca, ni al transmutar
//      (el tizón concentra ×1,6 sobre el 0,28 de la masa = 0,448×), ni en el
//      mundo, ni a ninguna de las cinco frecuencias. No hay ciclo rentable.
//   4. LA FRECUENCIA AGUANTA. Todo lo que el fuego toca —duración, meseta,
//      transmutación, cocción, propagación, la muerte de la criatura— da lo
//      mismo a 10, 20, 25, 50 y 100 Hz, dentro de un tick.
//
// ─── CÓMO SE LEE ────────────────────────────────────────────────────────────
//
//   · `it(...)`             → medido, y el cuerpo clava el número.
//   · `it.fails(...)`       → HUECO ABIERTO, con su «POR QUÉ SIGUE ABIERTO».

import { describe, expect, it } from 'vitest'
import { dtDeFrecuencia, FRECUENCIAS_ADMISIBLES, paso, qualityOf } from '@anima/physics'
import type { Entorno } from '@anima/physics'

import {
  createJournal,
  createSnapshotChain,
  hashWorldState,
  pasoDelMundo,
  replay,
  restoreAt,
  restoreWorld,
  revisarInvariantes,
  stepWorld,
  worldSlots,
} from '../src/index.js'
import type { Intent, WorldBody, WorldState } from '../src/index.js'
import { actor, criatura, cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

/** Los segundos que llevaba el mundo en el tick `t`, a esta frecuencia. */
const seg = (t: number, hz: number): number => t * dtDeFrecuencia(hz)

/**
 * Corre el mundo anotando en qué segundo prendió cada cuerpo. «Prendió» no lo
 * decide una lista: es `emitsPower > 0`, que es el `step(temperature ≥
 * ignitionPoint)` del ADR II-0001 y la única definición de fuego que hay.
 */
function cuandoPrendeCadaUno(
  inicial: WorldState,
  ticks: number,
  hz: number,
): ReadonlyMap<string, number> {
  let s = inicial
  const out = new Map<string, number>()
  for (let t = 1; t <= ticks; t++) {
    s = stepWorld(s, []).state
    for (const [id, c] of s.bodies) {
      if (!out.has(id) && qualityOf(c.body, 'emitsPower', s.phys) > 0) out.set(id, seg(t, hz))
    }
  }
  return out
}

/** Una pila: cada leño apoyado sobre el de abajo. Sólo el de abajo nace ardiendo. */
function pilaApilada(n: number, masa: number): WorldBody[] {
  const out: WorldBody[] = []
  for (let i = 0; i < n; i++) {
    const b = cuerpo(`leno${i}`, 'madera', masa, { temperature: i === 0 ? 700 : 15 })
    out.push(i === 0 ? enElPiso(b, EN(0, 0)) : { body: b, at: EN(0, 0), supportedBy: `leno${i - 1}` })
  }
  return out
}

// ═══ 1 · EL INCENDIO ═════════════════════════════════════════════════════════

describe('1 · el incendio: el fuego que dura es un fuego que se propaga', () => {
  it('una pila de cinco leños de 1 kg prende ENTERA en 0,90 s, y termina en ceniza', () => {
    // Nadie escribió «propagación» en ningún lado, y por eso hay que medirla:
    // sale sola de dos piezas que ya existían y que hasta ayer no se tocaban.
    // `emitsPower` de un leño de 1 kg vale 300,6 (`fuelEnergy·mass·16,7`), y el
    // `formFactor` de `contacto` es 0,6, así que el que está apoyado encima
    // equilibra a `15 + 300,6·0,6/0,5` = 375,7 °C — arriba de los 300 de la
    // madera. Eso valía antes también. Lo que NO valía antes es que el de abajo
    // se quedara caliente el tiempo suficiente para que el de arriba llegara.
    const prende = cuandoPrendeCadaUno(mundo({ bodies: pilaApilada(5, 1) }), 4000, 20)

    expect([...prende.keys()].sort()).toEqual(['leno0', 'leno1', 'leno2', 'leno3', 'leno4'])
    expect(prende.get('leno0')).toBeCloseTo(0.05, 6)
    expect(prende.get('leno1')).toBeCloseTo(0.3, 6)
    expect(prende.get('leno2')).toBeCloseTo(0.5, 6)
    expect(prende.get('leno3')).toBeCloseTo(0.7, 6)
    expect(prende.get('leno4')).toBeCloseTo(0.9, 6)

    // Y los cinco terminan en ceniza: la pila entera se consume.
    let s = mundo({ bodies: pilaApilada(5, 1) })
    for (let t = 0; t < 4000; t++) s = stepWorld(s, []).state
    const sustancias = [...s.bodies.values()].map((c) => c.body.parts[0]?.substance ?? '?')
    expect(sustancias).toEqual(new Array(5).fill('residuo-mineral-de-madera'))

    log([
      '══ 1a · LA PILA PRENDE ENTERA ═════════════════════════════════════════',
      ...[...prende].map(([id, t]) => `  ${id} prende a los ${t.toFixed(2)} s`),
      '  y a los 200 s los cinco son residuo-mineral-de-madera',
    ])
  })

  it('CARNADA: sin el calor de la ley 3, el leño de abajo cruza para abajo sus 300 °C en 0,15 s', () => {
    // La carnada de que la propagación es NUEVA. Lo definitivo se mide
    // revirtiendo `physics/src/{fixed,leyes}.ts` a HEAD y corriendo ESTE MISMO
    // archivo: hecho a mano, `leno1..leno4` no prenden nunca, las cuatro pilas
    // del test de acá abajo dan NUNCA a las cinco frecuencias, y en la pila
    // apilada «hubo fuego hasta 0,10 s» contra los 50,75 s de ahora.
    //
    // Acá queda la mitad que se puede clavar sin revertir nada, y es la causa:
    // con la ley 3 vieja el leño no repone NADA de lo que la ley 1 le saca, así
    // que su temperatura es una exponencial que baja y nada más. Se le corta el
    // oxígeno para apagar el aporte nuevo —la ley 3 sólo da calor si `arde`, y
    // `arde` pide `oxygen > 0,05`— y se cuenta cuánto tarda en cruzar para abajo
    // sus 300 °C. Tres pasos a 20 Hz. Con `emitsPower` en cero desde el cuarto,
    // el leño de arriba nunca ve más de los 15 °C del ambiente.
    const dt = dtDeFrecuencia(20)
    let b = { id: 'l', form: 'vara' as const, parts: [{ substance: 'madera', mass: 1, q: {} }], joints: [], state: { temperature: 700 } }
    const F = mundo({}).phys
    const sinOxigeno: Entorno = { celda: { oxygen: 0, wet: 0, ambiente: 15 } }
    let pasos = 0
    while (qualityOf(b, 'temperature', F) >= 300 && pasos < 1000) {
      b = paso(b, sinOxigeno, F, dt).body as typeof b
      pasos++
    }
    expect(pasos).toBe(3)
    expect(seg(pasos, 20)).toBeCloseTo(0.15, 6)
    // Y con oxígeno —o sea con la ley 3 nueva puesta— no cruza NUNCA: se queda
    // en la meseta de 615 hasta que la ley 4 se lo lleva.
    let c = { id: 'l', form: 'vara' as const, parts: [{ substance: 'madera', mass: 1, q: {} }], joints: [], state: { temperature: 700 } }
    for (let t = 0; t < 200; t++) c = paso(c, { celda: { oxygen: 1, wet: 0, ambiente: 15 } }, F, dt).body as typeof c
    expect(qualityOf(c, 'temperature', F)).toBeCloseTo(615, 3)
  })

  it('cuatro pilas de 20 kg separadas por una celda: el fuego camina, y camina igual a las cinco', () => {
    // `piso` a distancia 1 tiene `formFactor` 0,06/(1+1) = 0,03, así que un
    // cuerpo con `emitsPower` 6012 —20 kg de madera— pone al vecino de al lado en
    // `15 + 6012·0,03/0,5` = 375,7 °C. Otra vez arriba de los 300. Y `chebyshev`
    // no distingue direcciones: esto camina en las ocho.
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const bodies: WorldBody[] = []
      for (let i = 0; i < 4; i++) {
        bodies.push(enElPiso(cuerpo(`pila${i}`, 'madera', 20, { temperature: i === 0 ? 700 : 15 }), EN(i, 0)))
      }
      const prende = cuandoPrendeCadaUno(mundo({ bodies, hz }), Math.round(30 / dtDeFrecuencia(hz)), hz)
      expect(prende.size).toBe(4)
      // La misma marcha a las cinco, DENTRO DE UN TICK de la más gruesa. La
      // tolerancia es 0,1 s y no 0,05 porque a 10 Hz el instante cae en una
      // grilla de 0,1 s: pedir menos que eso sería medir dónde cae la grilla y no
      // si el hecho tarda lo mismo. Medido: 5,35–5,40 · 9,39–9,50 · 13,38–13,50.
      const cerca = (v: number | undefined, esperado: number): void => {
        expect(Math.abs((v ?? Number.NaN) - esperado)).toBeLessThanOrEqual(0.1)
      }
      cerca(prende.get('pila1'), 5.36)
      cerca(prende.get('pila2'), 9.42)
      cerca(prende.get('pila3'), 13.42)
      filas.push(
        `  ${String(hz).padStart(4)}Hz  pila1=${(prende.get('pila1') ?? 0).toFixed(2)} s · pila2=${(prende.get('pila2') ?? 0).toFixed(2)} s · pila3=${(prende.get('pila3') ?? 0).toFixed(2)} s`,
      )
    }
    log([
      '══ 1b · EL FUEGO CAMINA UNA CELDA CADA CUATRO SEGUNDOS ════════════════',
      ...filas,
      '  (a HEAD, `pila1..pila3` = NUNCA a las cinco)',
    ])
  })

  it('la criatura parada al lado de una fogata de 5 kg pierde la MITAD de su cuerpo', () => {
    // No prende —la carne tiene `moisture` 0,72 y la ley 3 pide seco— pero
    // `piso@0` con 5 kg da 195,4 °C, que cae adentro de su ventana de cocción. La
    // criatura SE COCINA: la ley 5 le evapora el agua y la masa se va con ella.
    //
    // Antes esto no pasaba, y no porque la ley fuera otra: porque la fogata se
    // apagaba en 0,15 s. Medido revirtiendo `physics/src` a HEAD: 1,996 kg.
    const bodies: WorldBody[] = [
      enElPiso(cuerpo('fogata', 'madera', 5, { temperature: 700 }), EN(0, 0)),
      enElPiso(criatura('dina', 100000), EN(0, 0)),
    ]
    let s = mundo({ bodies, actors: [actor('dina')] })
    let minima = 2
    for (let t = 1; t <= 4000; t++) {
      s = stepWorld(s, []).state
      const c = s.bodies.get('dina-cuerpo')
      if (c !== undefined) minima = Math.min(minima, qualityOf(c.body, 'mass', s.phys))
    }
    expect(minima).toBeCloseTo(1.01, 2)
    log([
      '══ 1c · LA CRIATURA SE COCINA SOLA ════════════════════════════════════',
      `  fogata de 5 kg en la misma celda · dina 2,000 kg → ${minima.toFixed(3)} kg`,
      '  (a HEAD, con el mismo mundo: 1,996 kg — la fogata se apagaba en 0,15 s)',
    ])
  })

  it('la criatura APOYADA sobre una fogata de 20 kg muere quemada, y la crónica dice «hambre»', () => {
    // Tres cosas de una vez, y sólo la tercera es de este ADR:
    //
    //   · la ley 4 le transmuta el cuerpo a `residuo-mineral-de-carne`, y al
    //     hacerlo se queda con `state: { temperature }` y TIRA TODO LO DEMÁS.
    //     `stamina` es CONSERVADA y desaparece: 949,70 → 0,00 en un tick;
    //   · `revisarInvariantes` no ve nada, porque la conservación sólo mira que
    //     no SUBA. Una cualidad conservada que se evapora entera es legal;
    //   · el evento que sale es `{k:'murio', por:'hambre'}` con 949,70 de
    //     stamina en el cuerpo el tick anterior. La crónica va a contar que se
    //     murió de hambre una criatura que se quemó viva.
    //
    // Lo pre-existente son las dos primeras: a HEAD esto pasa a los 4,35 s (con
    // `TASA_CARBONIZACION` 0,2). Lo que este ADR mueve es CUÁNDO, no SI.
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const bodies: WorldBody[] = [
        enElPiso(cuerpo('fogata', 'madera', 20, { temperature: 700 }), EN(0, 0)),
        { body: criatura('dina', 100000), at: EN(0, 0), supportedBy: 'fogata' },
      ]
      let s = mundo({ bodies, actors: [actor('dina')], hz })
      let muere = Number.NaN
      let stam = Number.NaN
      let por = ''
      let violaciones = -1
      for (let t = 1; seg(t, hz) <= 120; t++) {
        const antes = s
        const r = stepWorld(s, [])
        s = r.state
        if (antes.actors.has('dina') && !s.actors.has('dina')) {
          muere = seg(t, hz)
          stam = qualityOf(antes.bodies.get('dina-cuerpo')?.body ?? { id: '', form: 'vara', parts: [], joints: [], state: {} }, 'stamina', antes.phys)
          for (const e of r.events) if (e.k === 'murio') por = e.por
          violaciones = revisarInvariantes(antes, s, r.events).length
          break
        }
      }
      // Muere quemada, con casi toda la stamina, y el arnés no ve nada. La
      // tolerancia es un tick de la frecuencia más gruesa: 50,300 · 50,350 ·
      // 50,400 · 50,400 · 50,380 medidos.
      expect(Math.abs(muere - 50.37)).toBeLessThanOrEqual(0.1)
      expect(stam).toBeGreaterThan(900)
      expect(por).toBe('hambre')
      expect(violaciones).toBe(0)
      filas.push(
        `  ${String(hz).padStart(4)}Hz muere a los ${muere.toFixed(3)} s con stamina ${stam.toFixed(2)} · la crónica dice «${por}» · violaciones ${violaciones}`,
      )
    }
    log([
      '══ 1d · MUERE QUEMADA Y EL MUNDO DICE QUE FUE HAMBRE ══════════════════',
      ...filas,
      '  (a HEAD, lo mismo a los 4,30–4,38 s con stamina 995,6–995,8)',
    ])
  })

  it.fails('SIGUE ABIERTO — la ley 4 borra `stamina`, que es CONSERVADA, y nadie lo ve', () => {
    // POR QUÉ SIGUE ABIERTO: son dos arreglos y ninguno es de este ADR ni cabe
    // adentro de él.
    //
    //   (1) `leyTransmutacion` de `physics/src/leyes.ts` devuelve
    //       `state: { temperature: l.temperature }`, y su comentario lo dice con
    //       todas las letras: «Del estado sobrevive la temperatura […] Todo lo
    //       demás lo dice la sustancia nueva». Para la humedad de un leño eso
    //       está bien. Para `stamina` no: `stamina` no sale de ninguna sustancia
    //       —lo dice `mundo-minimo.ts`, «es una cuenta que el cuerpo lleva»— así
    //       que no hay de dónde volver a sacarla. Arreglarlo es decidir qué
    //       cualidades del `state` sobreviven a un cambio de materia, y eso es
    //       una regla del motor, no una línea.
    //   (2) `revisarConservacion` de `world/src/invariants.ts` sólo persigue los
    //       AUMENTOS. Una conservada que se evapora entera pasa. Cerrarlo pide
    //       decidir qué bajadas son legítimas —la ley 5 evapora agua y baja masa
    //       a propósito— y eso también es un ADR.
    //
    // Lo que este test clava mientras tanto: el número, para que el día que se
    // arregle se caiga solo.
    const bodies: WorldBody[] = [
      enElPiso(cuerpo('fogata', 'madera', 20, { temperature: 700 }), EN(0, 0)),
      { body: criatura('dina', 100000), at: EN(0, 0), supportedBy: 'fogata' },
    ]
    let s = mundo({ bodies, actors: [actor('dina')] })
    let antesDeMorir = 0
    let despues = -1
    for (let t = 1; t <= 4000; t++) {
      const antes = s
      s = stepWorld(s, []).state
      const c = s.bodies.get('dina-cuerpo')
      const p = antes.bodies.get('dina-cuerpo')
      if (c === undefined || p === undefined) continue
      if (c.body.parts[0]?.substance !== p.body.parts[0]?.substance) {
        antesDeMorir = qualityOf(p.body, 'stamina', antes.phys)
        despues = qualityOf(c.body, 'stamina', s.phys)
        break
      }
    }
    expect(antesDeMorir).toBeGreaterThan(900)
    // Esto es lo que tendría que valer y no vale: la stamina no se quema.
    expect(despues).toBe(antesDeMorir)
  })
})

// ═══ 2 · LA DURACIÓN NO CRECE CON LA MASA ════════════════════════════════════

describe('2 · «sesenta segundos por kilo» vale hasta 0,83 kg y ni un gramo más', () => {
  /** Segundos hasta que este leño deja de emitir, y cuánto combustible tiró. */
  function arco(masa: number, hz = 20): { dura: number; quemado: number; tirado: number } {
    let s = mundo({ bodies: [enElPiso(cuerpo('l', 'madera', masa, { temperature: 700 }), EN(0, 0))], hz })
    const inicial = 18 * masa
    for (let t = 1; seg(t, hz) <= 400; t++) {
      const antes = s
      s = stepWorld(s, []).state
      const c = s.bodies.get('l')
      const p = antes.bodies.get('l')
      if (c === undefined || p === undefined) break
      const cambioDeMateria = c.body.parts[0]?.substance !== p.body.parts[0]?.substance
      const seApago = qualityOf(c.body, 'emitsPower', s.phys) === 0 && t > 2
      if (cambioDeMateria || seApago) {
        const vivo = cambioDeMateria ? p : c
        const phys = cambioDeMateria ? antes.phys : s.phys
        const quemado = inicial - qualityOf(vivo.body, 'fuelEnergy', phys) * qualityOf(vivo.body, 'mass', phys)
        return { dura: seg(t, hz), quemado, tirado: inicial - quemado }
      }
    }
    return { dura: Number.NaN, quemado: Number.NaN, tirado: Number.NaN }
  }

  it('un leño de 1 kg y uno de 50 arden los MISMOS 50,00 s, y el de 50 tira el 98,3%', () => {
    // La razón es la TERCERA constante del ADR, la que no estaba en el encargo:
    // `TASA_CARBONIZACION` 0,016 hace que `charred` cruce los 0,8 de la ley 4 a
    // los 50 s EXACTOS, y la ley 4 no pregunta cuánto combustible quedaba. Lo que
    // quedaba se va con el 94% de la masa que la transmutación tira.
    //
    // O sea: las DOS constantes que el constructor agregó se cancelan. Hacer
    // `COMBUSTIBLE_POR_SEGUNDO` extensivo existe para que la masa decida la
    // duración; `TASA_CARBONIZACION` le pone un techo de 50 s que no depende de
    // la masa. Arriba de 0,83 kg la primera no hace nada.
    const filas: string[] = ['  masa    combustible  quemado   TIRADO   %tirado  dura(s)']
    const medido = new Map<number, ReturnType<typeof arco>>()
    for (const m of [0.2, 0.5, 0.8, 1, 2, 5, 8, 20, 50]) {
      const a = arco(m)
      medido.set(m, a)
      filas.push(
        `${String(m).padStart(6)} ${(18 * m).toFixed(2).padStart(14)} ${a.quemado.toFixed(2).padStart(8)} ${a.tirado.toFixed(2).padStart(8)} ${((100 * a.tirado) / (18 * m)).toFixed(1).padStart(8)}% ${a.dura.toFixed(2).padStart(8)}`,
      )
    }

    // Abajo del piso, la promesa del ADR se cumple: 60 s por kilo.
    expect(medido.get(0.2)?.dura).toBeCloseTo(12.05, 2)
    expect(medido.get(0.5)?.dura).toBeCloseTo(30.05, 2)
    expect(medido.get(0.8)?.dura).toBeCloseTo(48.0, 2)
    // Arriba del piso, deja de cumplirse y no se mueve más.
    for (const m of [1, 2, 5, 8, 20, 50]) expect(medido.get(m)?.dura).toBeCloseTo(50.0, 2)
    // Y lo que se quema es SIEMPRE lo mismo: 0,3 por segundo durante 50 s.
    for (const m of [1, 2, 5, 8, 20, 50]) expect(medido.get(m)?.quemado).toBeCloseTo(15, 1)
    expect((100 * (medido.get(50)?.tirado ?? 0)) / 900).toBeCloseTo(98.3, 1)

    log(['══ 2a · LA DURACIÓN TIENE TECHO ═══════════════════════════════════════', ...filas])
  })

  it('juntar leña compra 0,8 segundos de fuego', () => {
    // «Juntar leña ES la respuesta a que el fuego se apague», dice el ADR.
    // Medido: apilar cinco leños de 1 kg da 50,75 s de fuego contra los 50,00 de
    // uno solo, porque los cinco prenden en el primer segundo y arden A LA VEZ.
    // Dejarlos sueltos en la misma celda da 49,95 s y deja el 80% sin tocar.
    function hastaCuandoHayFuego(bodies: readonly WorldBody[]): { hasta: number; quemado: number } {
      let s = mundo({ bodies })
      let hasta = 0
      for (let t = 1; t <= 4000; t++) {
        s = stepWorld(s, []).state
        for (const c of s.bodies.values()) {
          if (qualityOf(c.body, 'emitsPower', s.phys) > 0) hasta = seg(t, 20)
        }
      }
      let queda = 0
      for (const c of s.bodies.values()) {
        queda += qualityOf(c.body, 'fuelEnergy', s.phys) * qualityOf(c.body, 'mass', s.phys)
      }
      return { hasta, quemado: 90 - queda }
    }
    const sueltos: WorldBody[] = []
    for (let i = 0; i < 5; i++) {
      sueltos.push(enElPiso(cuerpo(`leno${i}`, 'madera', 1, { temperature: i === 0 ? 700 : 15 }), EN(0, 0)))
    }
    const apilada = hastaCuandoHayFuego(pilaApilada(5, 1))
    const suelta = hastaCuandoHayFuego(sueltos)

    expect(apilada.hasta).toBeCloseTo(50.75, 2)
    expect(apilada.quemado).toBeCloseTo(90, 1)
    expect(suelta.hasta).toBeCloseTo(49.95, 2)
    expect(suelta.quemado).toBeCloseTo(18, 1)
    // Cinco veces la leña, 1,5% más de fuego.
    expect(apilada.hasta / 50.0).toBeLessThan(1.02)

    log([
      '══ 2b · JUNTAR LEÑA ═══════════════════════════════════════════════════',
      `  cinco leños de 1 kg APILADOS ... fuego hasta ${apilada.hasta.toFixed(2)} s · quemó ${apilada.quemado.toFixed(2)} de 90,00 (${((100 * apilada.quemado) / 90).toFixed(1)}%)`,
      `  cinco leños de 1 kg SUELTOS .... fuego hasta ${suelta.hasta.toFixed(2)} s · quemó ${suelta.quemado.toFixed(2)} de 90,00 (${((100 * suelta.quemado) / 90).toFixed(1)}%)`,
      '  uno solo de 1 kg ............... fuego hasta 50,00 s',
    ])
  })

  it('debajo de 0,84 kg NADA se hace carbón, y lo que queda es un leño que no puede volver a arder', () => {
    // El otro filo de la misma constante. `charred` sube 0,016 por segundo y el
    // cuerpo arde `fuelEnergy·mass/0,3` segundos, así que para llegar a 0,8 hacen
    // falta 50 s, o sea 15 unidades de combustible, o sea 0,833 kg de madera.
    //
    // Debajo de eso el cuerpo se apaga con `charred` abajo de 0,8, no transmuta
    // NUNCA, y queda hecho de `madera` con `fuelEnergy` 0: una vara que se ve
    // como leña, que la criatura puede juntar, y que no va a arder nunca más.
    // La yesca de 0,2 kg del ADR II-0010 —la que hizo que el fuego encendiera por
    // primera vez— es exactamente ese caso.
    const filas: string[] = ['   masa   dura(s)  charred_máx  termina en']
    const resultado = new Map<number, { ch: number; sust: string }>()
    for (const m of [0.05, 0.2, 0.5, 0.8, 0.83, 0.9, 1]) {
      let s = mundo({ bodies: [enElPiso(cuerpo('l', 'madera', m, { temperature: 700 }), EN(0, 0))] })
      let ch = 0
      let dura = Number.NaN
      for (let t = 1; t <= 4000; t++) {
        s = stepWorld(s, []).state
        const c = s.bodies.get('l')
        if (c === undefined) break
        ch = Math.max(ch, qualityOf(c.body, 'charred', s.phys))
        if (Number.isNaN(dura) && qualityOf(c.body, 'emitsPower', s.phys) === 0 && t > 2) dura = seg(t, 20)
        if (c.body.parts[0]?.substance !== 'madera') break
      }
      const sust = s.bodies.get('l')?.body.parts[0]?.substance ?? '?'
      resultado.set(m, { ch, sust })
      filas.push(`  ${String(m).padStart(5)} ${dura.toFixed(2).padStart(8)} ${ch.toFixed(4).padStart(12)}  ${sust}`)
    }

    // El piso está entre 0,83 y 0,9 kg, y 0,83 se queda a 8 milésimas.
    expect(resultado.get(0.83)?.ch).toBeCloseTo(0.7992, 3)
    expect(resultado.get(0.83)?.sust).toBe('madera')
    expect(resultado.get(0.9)?.sust).toBe('residuo-mineral-de-madera')
    // La yesca del ADR II-0010 no llega ni a la cuarta parte.
    expect(resultado.get(0.2)?.ch).toBeCloseTo(0.1928, 3)

    log(['══ 2c · EL PISO DE 0,84 kg PARA HACER CARBÓN ══════════════════════════', ...filas])
  })

  it.fails('SIGUE ABIERTO — «la masa decide cuánto dura» es falso arriba de 0,83 kg', () => {
    // POR QUÉ SIGUE ABIERTO: es una decisión de calibración y no un bug de una
    // línea, y tocarla mueve las tres constantes del ADR II-0011 a la vez.
    //
    // El ADR promete, y su comentario en `COMBUSTIBLE_POR_SEGUNDO` de
    // `physics/src/leyes.ts` lo escribe: «Ahora dura `fuelEnergy · mass / 0.3`, o
    // sea 60 s por kilo de madera. Juntar leña ES la respuesta a que el fuego se
    // apague». Medido, eso es cierto para 0,05 · 0,2 · 0,5 · 0,8 kg —los cuatro
    // casos que el constructor midió— y falso para 1 · 2 · 5 · 8 · 20 · 50, que
    // dan 50,00 s los seis.
    //
    // Cerrarlo pide una de tres, y ninguna es de este archivo:
    //   · que `TASA_CARBONIZACION` sea por unidad de combustible QUEMADO y no por
    //     segundo, con lo que un tronco tardaría en carbonizarse lo que tarda en
    //     gastarse — es la reparación honesta y cambia la ley 3;
    //   · que la ley 4 transmute sólo la parte carbonizada y deje el resto —
    //     cambia la ley 4 y con ella el `residuoDe` entero;
    //   · o aceptar el techo y BORRAR la promesa de `COMBUSTIBLE_POR_SEGUNDO`,
    //     que es lo barato y lo que este test impide hacer en silencio.
    //
    // Mientras tanto: un leño de 2 kg tendría que durar el doble que uno de 1.
    let uno = mundo({ bodies: [enElPiso(cuerpo('l', 'madera', 1, { temperature: 700 }), EN(0, 0))] })
    let dos = mundo({ bodies: [enElPiso(cuerpo('l', 'madera', 2, { temperature: 700 }), EN(0, 0))] })
    const durar = (s0: WorldState): number => {
      let s = s0
      for (let t = 1; t <= 8000; t++) {
        s = stepWorld(s, []).state
        const c = s.bodies.get('l')
        if (c === undefined) return Number.NaN
        if (qualityOf(c.body, 'emitsPower', s.phys) === 0 && t > 2) return seg(t, 20)
      }
      return Number.NaN
    }
    const d1 = durar(uno)
    const d2 = durar(dos)
    expect(d1).toBeCloseTo(50.0, 2)
    expect(d2 / d1).toBeCloseTo(2, 1)
  })
})

// ═══ 3 · LA MÁQUINA DE MOVIMIENTO PERPETUO QUE NO ESTÁ ═══════════════════════

describe('3 · el combustible sólo baja, y el tizón no es un ciclo rentable', () => {
  it('el tizón concentra ×1,6 sobre el 0,28 de la masa: 0,448×, y por eso no cierra', () => {
    // `residuoDe` concentra `fuelEnergy` por 1,6 —el intensivo SUBE— y
    // `FRACCION_DE_RESIDUO.carbonoso` deja 0,28 de la masa. El total es el
    // producto: 1,6 × 0,28 = 0,448. La sospecha del encargo era que el ×1,6
    // abriera un ciclo «quemar → carbón con más combustible → quemar»; no lo
    // abre, y el factor exacto de por qué no es éste.
    //
    // Medido sobre el motor, no despejado: un leño de 1 kg tapado y con una
    // fuente en contacto —la técnica— llega a la transmutación con 15,00 unidades
    // y sale con 6,72, y después arde hasta cero sin volver a transmutar (el
    // tizón tiene `pyrolysisAt` 900).
    const F = mundo({}).phys
    const dt = dtDeFrecuencia(20)
    const e: Entorno = {
      celda: { oxygen: 0.2, wet: 0, ambiente: 15 },
      fuente: { potencia: 300.6, distancia: 0, montaje: 'contacto' },
    }
    let b = { id: 'l', form: 'vara' as const, parts: [{ substance: 'madera', mass: 1, q: {} }], joints: [], state: { temperature: 15 } }
    let phys = F
    let antes = Number.NaN
    let despues = Number.NaN
    let residuo = ''
    let peorSubida = 0
    let total = qualityOf(b, 'fuelEnergy', phys) * qualityOf(b, 'mass', phys)
    for (let t = 0; t * 0.05 < 400; t++) {
      const previo = total
      const r = paso(b, e, phys, dt)
      if (r.nueva !== undefined && residuo === '') {
        antes = previo
        residuo = r.nueva.id
      }
      b = r.body as typeof b
      if (r.nueva !== undefined) phys = { ...phys, substances: new Map([...phys.substances, [r.nueva.id, r.nueva]]) }
      total = qualityOf(b, 'fuelEnergy', phys) * qualityOf(b, 'mass', phys)
      if (residuo !== '' && Number.isNaN(despues)) despues = total
      if (total - previo > peorSubida) peorSubida = total - previo
    }
    expect(residuo).toBe('residuo-carbonoso-de-madera')
    expect(antes).toBeCloseTo(15.0, 1)
    expect(despues / antes).toBeCloseTo(0.448, 3)
    expect(peorSubida).toBe(0)
    expect(total).toBe(0)
    log([
      '══ 3a · EL TIZÓN NO ES RENTABLE ═══════════════════════════════════════',
      `  antes de transmutar ${antes.toFixed(4)} → después ${despues.toFixed(4)} (${(despues / antes).toFixed(4)}×)`,
      '  y de ahí arde hasta 0,0000 sin volver a transmutar · peor subida en toda la corrida: 0',
    ])
  })

  it('en el mundo entero, con fuego y con transmutaciones, `fuelEnergy` no sube ni un tick', () => {
    // Seis cuerpos, uno tapando al otro, la criatura adentro, 200 s. Se compara
    // el total en TODOS los pasos y no sólo al final: un ciclo rentable que
    // subiera y bajara dentro del mismo tick no se vería en el final.
    const bodies: WorldBody[] = [
      enElPiso(cuerpo('a-fogata', 'madera', 5, { temperature: 700 }), EN(0, 0)),
      enElPiso(cuerpo('b-carbon', 'carbon', 2, { temperature: 15 }), EN(2, 0)),
      enElPiso(cuerpo('c-pez', 'pescado', 1, { temperature: 15 }), EN(1, 0)),
      enElPiso(cuerpo('d-hoja', 'hoja-seca', 0.2, { temperature: 700 }), EN(4, 4)),
      enElPiso(cuerpo('e-grasa', 'grasa', 0.5, { temperature: 15 }), EN(0, 1)),
      enElPiso(criatura('f-dina', 100000), EN(6, 6)),
    ]
    let s = mundo({ bodies, actors: [actor('f-dina')] })
    const total = (w: WorldState): number => {
      let t = 0
      for (const c of w.bodies.values()) {
        t += qualityOf(c.body, 'fuelEnergy', w.phys) * qualityOf(c.body, 'mass', w.phys)
      }
      return t
    }
    const inicial = total(s)
    let previo = inicial
    let subidas = 0
    let pasos = 0
    for (let t = 1; t <= 4000; t++) {
      s = stepWorld(s, []).state
      const ahora = total(s)
      if (ahora > previo) subidas++
      previo = ahora
      pasos++
    }
    expect(pasos).toBe(4000)
    expect(subidas).toBe(0)
    expect(previo).toBeLessThan(inicial)
    log([
      '══ 3b · EL LAZO SE CIERRA ═════════════════════════════════════════════',
      `  ${pasos} pasos · combustible ${inicial.toFixed(3)} → ${previo.toFixed(3)} · SUBIDAS: ${subidas}`,
    ])
  })
})

// ═══ 4 · LA FRECUENCIA ═══════════════════════════════════════════════════════

describe('4 · el ADR II-0008 aguanta todo lo que el fuego toca', () => {
  it('duración, meseta y transmutación de un leño de 1 kg dan lo mismo a las cinco', () => {
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      let s = mundo({ bodies: [enElPiso(cuerpo('l', 'madera', 1, { temperature: 700 }), EN(0, 0))], hz })
      let meseta = Number.NaN
      let transmuta = Number.NaN
      let residuo = ''
      for (let t = 1; seg(t, hz) <= 120; t++) {
        const antes = s
        s = stepWorld(s, []).state
        const c = s.bodies.get('l')
        if (c === undefined) break
        if (Math.abs(seg(t, hz) - 20) < dtDeFrecuencia(hz) / 2) meseta = qualityOf(c.body, 'temperature', s.phys)
        if (c.body.parts[0]?.substance !== antes.bodies.get('l')?.body.parts[0]?.substance) {
          transmuta = seg(t, hz)
          residuo = c.body.parts[0]?.substance ?? '?'
          break
        }
      }
      expect(meseta).toBeCloseTo(615.0, 3)
      expect(transmuta).toBeCloseTo(50.0, 1)
      expect(residuo).toBe('residuo-mineral-de-madera')
      filas.push(`  ${String(hz).padStart(4)}Hz  meseta a los 20 s = ${meseta.toFixed(4)} °C · transmuta a los ${transmuta.toFixed(3)} s`)
    }
    log(['══ 4a · LA MESETA Y EL RELOJ ══════════════════════════════════════════', ...filas])
  })

  it('el pescado sobre la parrilla llega a 0,85 en el mismo instante a las cinco', () => {
    const F = mundo({}).phys
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const dt = dtDeFrecuencia(hz)
      const e: Entorno = {
        celda: { oxygen: 1, wet: 0, ambiente: 15 },
        fuente: { potencia: 300.6, distancia: 0, montaje: 'parrilla' },
      }
      let b = { id: 'p', form: 'filete' as const, parts: [{ substance: 'pescado', mass: 1, q: {} }], joints: [], state: { temperature: 15 } }
      let a85 = Number.NaN
      for (let t = 1; t * dt <= 60; t++) {
        b = paso(b, e, F, dt).body as typeof b
        if (Number.isNaN(a85) && qualityOf(b, 'digestibility', F) >= 0.85) a85 = t * dt
      }
      // Un tick de la más gruesa de tolerancia: a 10 Hz el instante cae en una
      // grilla de 0,1 s y medir más fino sería medir la grilla.
      expect(a85).toBeCloseTo(3.41, 1)
      expect(qualityOf(b, 'digestibility', F)).toBeCloseTo(0.95, 4)
      expect(qualityOf(b, 'charred', F)).toBe(0)
      filas.push(`  ${String(hz).padStart(4)}Hz  0,85 a los ${a85.toFixed(3)} s · termina en ${qualityOf(b, 'digestibility', F).toFixed(4)}`)
    }
    log(['══ 4b · LA COCCIÓN ════════════════════════════════════════════════════', ...filas])
  })
})

// ═══ 5 · LO QUE LA REPARACIÓN CAMBIÓ SIN DECIRLO ═════════════════════════════

describe('5 · el integrador nuevo también corre cuando no hay fuego', () => {
  it('el comentario de `paso()` dice que la ley 5 y la ley 3 son excluyentes, y no lo son', () => {
    // El comentario del `acople` en `physics/src/leyes.ts` justifica calcularlo
    // UNA sola vez así: «lo único que mueve masa antes de la ley 3 es la ley 5, y
    // la ley 5 corre sólo dentro de la ventana de cocción, que exige
    // `T < ignitionPoint` — o sea justo cuando la ley 3 no arde. Las dos ramas
    // son excluyentes, no es una aproximación».
    //
    // Dejó de ser cierto en este mismo ADR: la ley 3 ya no mira `l.temperature`
    // sino el PICO del paso. Un cuerpo que ENTRA arriba de su ignición y que la
    // ley 1 baja adentro de la ventana de cocción corre las dos: `ventanaDeCoccion`
    // mira la temperatura de salida y dice que sí, `arde` mira el pico y dice que
    // sí también.
    //
    // La buena noticia, y va acá para que nadie se asuste de más: el error que
    // esto mete en el `acople` es de 3e-4 en el peor caso medido. Es un comentario
    // falso, no un número roto — pero un comentario falso en el lugar donde se
    // justifica una optimización es cómo se pierde una tarde dentro de seis meses.
    const F = mundo({}).phys
    const juntas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const dt = dtDeFrecuencia(hz)
      for (const [s, m, t0, moist] of [
        ['grano', 0.05, 400, 0.1],
        ['grasa', 0.1, 500, 0.05],
        ['cuero', 0.05, 400, 0.15],
      ] as const) {
        const b0 = { id: 'x', form: 'vara' as const, parts: [{ substance: s, mass: m, q: {} }], joints: [], state: { temperature: t0, moisture: moist } }
        const r = paso(b0, { celda: { oxygen: 1, wet: 0, ambiente: 15 } }, F, dt)
        if (r.leyes.includes('desnaturalizacion') && r.leyes.includes('combustion')) {
          juntas.push(`  ${String(hz).padStart(4)}Hz ${s} ${m} kg → leyes=[${r.leyes.join(',')}]`)
        }
      }
    }
    expect(juntas.length).toBeGreaterThan(0)
    log([
      '══ 5a · LAS DOS RAMAS QUE SE SUPONE QUE NO SE TOCAN ═══════════════════',
      ...juntas,
      '  error introducido en el `acople` por la masa que la ley 5 se llevó: ≤ 3,1e-4 relativo',
    ])
  })

  it('borrar el `min(1, …)` cambió el enfriamiento de TODO lo liviano, no sólo del fuego', () => {
    // El `acople` nuevo corre en la ley 1 de cada cuerpo y de cada tick, arda o
    // no. Para un cuerpo con `heatCapacity` chica, el Euler viejo saturaba en 1 y
    // lo pegaba al ambiente EN UN PASO; ahora relaja. Medido sobre un pescado
    // cocido a 165 °C que se saca del fuego, un paso a 20 Hz:
    //
    //   0,05 kg → antes 15,00 °C   ahora 22,92    (el bocado ya no nace frío)
    //   0,10 kg → antes 15,00 °C   ahora 49,47
    //   0,20 kg → antes 54,71 °C   ahora 86,90
    //
    // Está bien que sea así —es el arreglo— pero no es «el fuego»: es la comida,
    // la humedad que depende de la temperatura, y la ventana de cocción de todo
    // lo chico. Queda clavado para que se vea si alguien lo mueve.
    const F = mundo({}).phys
    const dt = dtDeFrecuencia(20)
    const trasUnPaso = (masa: number): number => {
      const b = { id: 'p', form: 'filete' as const, parts: [{ substance: 'pescado', mass: masa, q: {} }], joints: [], state: { temperature: 165 } }
      return qualityOf(paso(b, { celda: { oxygen: 1, wet: 0, ambiente: 15 } }, F, dt).body, 'temperature', F)
    }
    expect(trasUnPaso(0.05)).toBeCloseTo(22.92, 2)
    expect(trasUnPaso(0.1)).toBeCloseTo(49.47, 2)
    expect(trasUnPaso(0.2)).toBeCloseTo(86.9, 2)
    expect(trasUnPaso(1)).toBeCloseTo(144.49, 2)
  })
})

// ═══ 6 · EL DETERMINISMO, CON FUEGO ADENTRO ══════════════════════════════════

describe('6 · un mundo que se incendia sigue siendo el mismo mundo dos veces', () => {
  /** Una partida que se incendia sola: pilas gordas, una encendida, y la criatura. */
  function incendio(ordenDeAlta: 'natural' | 'al-reves' = 'natural'): WorldState {
    const bodies: WorldBody[] = []
    for (let i = 0; i < 4; i++) {
      bodies.push(enElPiso(cuerpo(`pila${i}`, 'madera', 20, { temperature: i === 0 ? 700 : 15 }), EN(i, 0)))
    }
    bodies.push(enElPiso(cuerpo('pez', 'pescado', 1, { temperature: 15 }), EN(1, 1)))
    bodies.push(enElPiso(criatura('dina', 100000), EN(3, 3)))
    const actores = [actor('dina')]
    return ordenDeAlta === 'natural'
      ? mundo({ bodies, actors: actores })
      : mundo({ bodies: [...bodies].reverse(), actors: actores })
  }

  const TICKS = 1500

  it('dos gemelos dados de alta en distinto orden dan el mismo `hashWorldState`, y los checkpoints también', () => {
    const correr = (w: WorldState): { fin: WorldState; checkpoints: string[] } => {
      let s = w
      const checkpoints: string[] = []
      for (let t = 0; t < TICKS; t++) {
        if (t % 100 === 0) checkpoints.push(hashWorldState(s))
        s = stepWorld(s, []).state
      }
      checkpoints.push(hashWorldState(s))
      return { fin: s, checkpoints }
    }
    const a = correr(incendio('natural'))
    const b = correr(incendio('al-reves'))
    expect(b.checkpoints).toEqual(a.checkpoints)
    expect(hashWorldState(b.fin)).toBe(hashWorldState(a.fin))
    // Y el mundo se incendió de verdad: si no, esto sería un test sobre nada.
    const sustancias = new Set([...a.fin.bodies.values()].map((c) => c.body.parts[0]?.substance ?? '?'))
    expect(sustancias.has('residuo-mineral-de-madera')).toBe(true)
    log([
      '══ 6a · GEMELOS CON FUEGO ═════════════════════════════════════════════',
      `  ${TICKS} ticks · ${a.checkpoints.length} checkpoints idénticos · hash final ${hashWorldState(a.fin)}`,
      `  sustancias al final: ${[...sustancias].sort().join(', ')}`,
    ])
  })

  it('restaurar a mitad reconstruye el hash exacto, y el replay del journal cierra', () => {
    const journal = createJournal<Intent>()
    const cadena = createSnapshotChain<unknown>()
    let s = incendio()
    let mitad = { tick: 0, state: s }
    let indiceDeLaMitad = 0
    for (let t = 0; t < TICKS; t++) {
      const delta = cadena.take(t, worldSlots(s))
      if (t === Math.trunc(TICKS / 2)) {
        mitad = { tick: t, state: s }
        indiceDeLaMitad = delta.index
      }
      s = stepWorld(s, []).state
    }
    const fin = hashWorldState(s)

    const desdeElDisco = restoreWorld(restoreAt(cadena.deltas, indiceDeLaMitad))
    expect(hashWorldState(desdeElDisco)).toBe(hashWorldState(mitad.state))

    const rehecho = replay(journal, { tick: mitad.tick, state: desdeElDisco }, pasoDelMundo, {
      // `hasta` es INCLUSIVO: el bucle derecho corrió los ticks 0..TICKS-1, así
      // que el replay tiene que parar en TICKS-1. Pedir `TICKS` corre un tick de
      // más y da un hash distinto — que es una divergencia del arnés y no del
      // mundo, y por eso queda dicho acá.
      hasta: TICKS - 1,
      hashOf: hashWorldState,
    })
    expect(hashWorldState(rehecho)).toBe(fin)

    const desdeCero = replay(journal, { tick: 0, state: incendio() }, pasoDelMundo, {
      hasta: TICKS - 1,
      hashOf: hashWorldState,
    })
    expect(hashWorldState(desdeCero)).toBe(fin)
    log([
      '══ 6b · RESTAURAR Y REPLAY, CON EL MUNDO ARDIENDO ═════════════════════',
      `  restaurado en el tick ${mitad.tick} y llevado a ${TICKS}: ${fin}`,
    ])
  })
})
