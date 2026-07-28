// ═══ LAS DOS CONSTANTES QUE SE CANCELABAN ════════════════════════════════════
//
// El ADR II-0011 hizo `COMBUSTIBLE_POR_SEGUNDO` EXTENSIVO —«ahora dura
// `fuelEnergy · mass / 0.3`, o sea 60 s por kilo de madera; juntar leña ES la
// respuesta a que el fuego se apague»— y dejó `TASA_CARBONIZACION` INTENSIVA. Las
// dos se cancelan, y el adversario lo midió contra `stepWorld`:
//
//     masa    dura(s)   queda
//      0,2      12,00   madera (fuelEnergy 0.00)      <- leña falsa
//      0,5      30,05   madera (fuelEnergy 0.00)      <- leña falsa
//      0,8      48,10   madera (fuelEnergy 0.00)      <- leña falsa
//     0,83      49,90   madera (fuelEnergy 0.00)      <- leña falsa
//        1      49,95   residuo-mineral-de-madera
//        5      49,95   residuo-mineral-de-madera
//       20      49,95   residuo-mineral-de-madera
//       50      49,95   residuo-mineral-de-madera
//
// Dos problemas y son distintos: **arriba de 0,83 kg la masa deja de decidir** —un
// leño de 50 kg arde lo mismo que uno de 1 y tira el 98% de su combustible— y
// **debajo de 0,83 kg el cuerpo se apaga sin transmutar** y queda hecho de madera
// con el tanque en cero: leña que se ve como leña, que la criatura puede juntar, y
// que no va a arder nunca más.
//
// ─── LA REPARACIÓN, EN DOS FRASES ───────────────────────────────────────────
//
//   1. `TASA_CARBONIZACION` es POR KILO. Carbonizar un cuerpo cuesta proporcional
//      a la materia que hay que carbonizar, que es exactamente el mismo movimiento
//      que el ADR II-0011 le hizo al combustible y que esta constante se había
//      quedado sin hacer. **50 s por kilo, en todo el rango.**
//   2. Y `charred` avanza además con la fracción de combustible que la llama ya se
//      llevó, escalada por `CARBONIZADO_QUE_TRANSMUTA` para que la cuenta cierre
//      donde tiene que cerrar. Se toma la MÁS ADELANTADA de las dos. Eso cierra la
//      leña falsa por aritmética y no por un caso especial: cuando la llama se
//      llevó todo, esa rama sumó exactamente 0,8.
//
// ─── LOS CRITERIOS, ESCRITOS ANTES DE TOCAR CÓDIGO ──────────────────────────
//
//   (a) la duración crece con la masa en TODO el rango —0,05 · 0,2 · 0,5 · 0,83 ·
//       1 · 2 · 5 · 20 · 50 kg— y a las cinco frecuencias. Tabla completa, y con
//       los extremos adentro: el bug anterior existió porque alguien midió hasta
//       0,8 y no más;
//   (c) no queda leña falsa: ninguna de las treinta sustancias termina hecha de la
//       sustancia madre con el combustible en cero SIN QUE SE NOTE;
//   (e) nada del ADR II-0011 se movió: meseta 615,00 a las cinco, el pescado llega
//       a 0,85, la ventana de cocción de las doce sigue existiendo, y tapar sigue
//       rindiendo un tizón más rico que la madera de la que salió.
//
// (e) se mide entero en `el-fuego-que-dura.test.ts`, que es el archivo del ADR;
// acá está lo que esta reparación podía haber roto y no rompió.

import { describe, expect, it } from 'vitest'
import {
  AL_AIRE,
  buildSeedPhysics,
  CARBONIZADO_QUE_TRANSMUTA,
  CELDA_AL_AIRE,
  CELDA_TAPADA,
  combustibleDeOrigen,
  conSustancia,
  dtDeFrecuencia,
  FRECUENCIAS_ADMISIBLES,
  nameOf,
  paso,
  qualityOf,
  regimenDeLlama,
  SUSTANCIAS_SEMILLA,
  T_AMBIENTE,
} from '../src/index.js'
import type { Body, Entorno, Montaje, Physics } from '../src/index.js'

const F: Physics = buildSeedPhysics()

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

function cuerpo(sustancia: string, masa: number, t = 700): Body {
  return {
    id: 'x',
    form: 'vara',
    parts: [{ substance: sustancia, mass: masa, q: {} }],
    joints: [],
    state: { temperature: t },
  }
}

interface Arco {
  /** Segundos hasta que `emitsPower` vuelve a 0. `NaN` si no se apagó. */
  readonly seApaga: number
  /** Segundos hasta que la ley 4 transmutó. `NaN` si no transmutó. */
  readonly transmuta: number
  readonly cuerpo: Body
  readonly phys: Physics
}

/**
 * Sigue a un cuerpo hasta que se apaga, dando de alta la sustancia que la ley 4
 * invente. Sin eso, un cuerpo que transmutó queda hecho de una materia que
 * `qualityOf` no encuentra y todas sus cualidades vuelven al valor por omisión —
 * que es un bug de arnés y no del motor.
 */
function arder(sustancia: string, masa: number, e: Entorno, hz: number, techo: number): Arco {
  const dt = dtDeFrecuencia(hz)
  let b = cuerpo(sustancia, masa)
  let phys = F
  let seApaga = Number.NaN
  let transmuta = Number.NaN
  const pasos = Math.round(techo / dt)
  for (let n = 1; n <= pasos; n++) {
    const r = paso(b, e, phys, dt)
    b = r.body
    if (r.nueva !== undefined) {
      phys = conSustancia(phys, r.nueva)
      if (Number.isNaN(transmuta)) transmuta = n / hz
    }
    if (Number.isNaN(seApaga) && qualityOf(b, 'emitsPower', phys) === 0) seApaga = n / hz
  }
  return { seApaga, transmuta, cuerpo: b, phys }
}

/** El barrido del criterio (a). Los extremos ADENTRO, que es la mitad del punto. */
const MASAS: readonly number[] = [0.05, 0.2, 0.5, 0.83, 1, 2, 5, 20, 50]

// ═══ (a) LA DURACIÓN CRECE CON LA MASA, EN TODO EL RANGO ══════════════════════

describe('(a) la masa decide cuánto arde, de 0,05 kg a 50', () => {
  it('cincuenta segundos por kilo, en las nueve masas y a las cinco frecuencias', () => {
    // La tabla entera. Cada fila es un leño de madera soltado a 700 °C al aire,
    // sin nadie, corrido hasta bastante después de que se apague.
    const filas: string[] = []
    const a20: number[] = []
    let peorDesvio = 0
    for (const m of MASAS) {
      const medidos = FRECUENCIAS_ADMISIBLES.map(
        (hz) => arder('madera', m, AL_AIRE, hz, 60 * m + 60).seApaga,
      )
      a20.push(medidos[1] as number)
      for (const [i, s] of medidos.entries()) {
        const hz = FRECUENCIAS_ADMISIBLES[i] as number
        // NO ocurrió es una falla: el criterio pide que se apague, no que aguante.
        expect([m, hz, Number.isNaN(s)]).toEqual([m, hz, false])
        // 50 s por kilo, con un tick de la frecuencia más gruesa de margen. Un
        // hecho no se observa cuando ocurre sino en el primer paso posterior.
        expect([m, hz, Math.abs(s - 50 * m) <= 0.11]).toEqual([m, hz, true])
        const d = Math.abs(s - (medidos[1] as number))
        if (d > peorDesvio) peorDesvio = d
      }
      filas.push(
        `  ${String(m).padStart(5)} kg ${medidos.map((s) => s.toFixed(2).padStart(10)).join('')}`,
      )
    }
    // Y las cinco frecuencias coinciden dentro de un tick de la más gruesa. La
    // comparación va en TICKS DE 10 Hz y no en segundos: «0,1 s» es un double que
    // no existe, y el peor desvío medido da 0,10000000000002274 contra un margen
    // escrito como 0,1. Es la misma trampa que `el-fuego-que-dura` documenta.
    expect(Math.round(peorDesvio * 10)).toBeLessThanOrEqual(1)

    // LA MONOTONÍA, dicha aparte: no alcanza con que cada fila dé su número, hace
    // falta que la duración CREZCA. El bug era exactamente una meseta. Se lee la
    // columna de 20 Hz de la tabla de arriba en vez de volver a correr el barrido:
    // son las mismas corridas y correrlas dos veces duplicaría el tiempo del
    // archivo para no medir nada nuevo.
    for (let i = 1; i < a20.length; i++) {
      expect([MASAS[i], (a20[i] as number) > (a20[i - 1] as number)]).toEqual([MASAS[i], true])
    }
    // Y crece PROPORCIONAL, que es más fuerte que crecer: el de 50 kg dura mil
    // veces lo que el de 0,05.
    expect((a20[a20.length - 1] as number) / (a20[0] as number)).toBeCloseTo(1000, 0)

    log([
      `══ (a) LA DURACIÓN, POR MASA Y POR FRECUENCIA ══  peor desvío: ${peorDesvio.toFixed(3)} s`,
      `  ${'masa'.padStart(8)}${FRECUENCIAS_ADMISIBLES.map((h) => `${String(h)} Hz`.padStart(10)).join('')}`,
      ...filas,
      '',
      '  ANTES (medido por el adversario contra `stepWorld`, con la constante intensiva):',
      '    0,2 → 12,00 · 0,5 → 30,05 · 0,83 → 49,90 · 1 → 49,95 · 5 → 49,95 · 50 → 49,95',
      '  y las cuatro primeras quedaban hechas de `madera` con el combustible en cero.',
    ])
    // 45 corridas largas —la de 50 kg son 60 000 pasos— y el techo por omisión de
    // vitest son 5 s. Bajo carga, este archivo lo pasaba.
  }, 300_000)

  it('CARNADA · con la constante intensiva de vuelta, 1 kg y 50 kg dan los mismos 50 s', () => {
    // La carnada se corrió A MANO revirtiendo `avanceDeCarbon` de
    // `physics/src/leyes.ts` a lo que era —`porPaso(TASA_CARBONIZACION, dt)` sin
    // dividir por la masa, y sin la rama de la llama— y midiendo este mismo
    // barrido. Da EXACTAMENTE la tabla del adversario:
    //
    //     0,05 kg →  3,00 s · queda madera        fuelEnergy 0,000
    //      0,2 kg → 12,05 s · queda madera        fuelEnergy 0,000
    //      0,5 kg → 30,05 s · queda madera        fuelEnergy 0,000
    //     0,83 kg → 49,85 s · queda madera        fuelEnergy 0,000
    //        1 kg → 50,00 s · queda residuo-mineral-de-madera
    //        2 kg → 50,00 s · queda residuo-mineral-de-madera
    //        5 kg → 50,00 s · queda residuo-mineral-de-madera
    //       20 kg → 50,00 s · queda residuo-mineral-de-madera
    //       50 kg → 50,00 s · queda residuo-mineral-de-madera
    //
    // Lo que queda clavado acá sin revertir nada es la CAUSA, y es una identidad:
    // con la constante intensiva el tiempo hasta `CARBONIZADO_QUE_TRANSMUTA` no
    // depende de la masa, y con la extensiva es proporcional a ella. Si alguien le
    // saca el `/ masa`, esto se cae.
    const dt = dtDeFrecuencia(20)
    const unPaso = (m: number): number => {
      const b = cuerpo('madera', m, 700)
      return qualityOf(paso(b, AL_AIRE, F, dt).body, 'charred', F)
    }
    // El avance de `charred` en un paso es inversamente proporcional a la masa.
    expect(unPaso(1) / unPaso(2)).toBeCloseTo(2, 6)
    expect(unPaso(1) / unPaso(50)).toBeCloseTo(50, 6)
    // Y el tiempo hasta el umbral es `0,8 · masa / 0,016`, que es la duración
    // medida arriba. La fórmula se escribe con la constante del catálogo, no con
    // un número copiado: si la calibración se mueve, esto se mueve con ella.
    expect((CARBONIZADO_QUE_TRANSMUTA * 20) / 0.016).toBeCloseTo(1000, 6)
  })
})

// ═══ (c) NO QUEDA LEÑA FALSA ═════════════════════════════════════════════════

describe('(c) ningún cuerpo termina hecho de la madre con el tanque en cero sin que se note', () => {
  it('las veintiséis sustancias que arden, a cinco masas, y ninguna queda indistinguible', () => {
    // El barrido completo: TODA sustancia semilla con combustible, a 0,05 · 0,2 ·
    // 1 · 5 · 20 kg, al aire y soltada a 700 °C. Se busca el caso malo: terminar
    // hecho de la sustancia MADRE con `fuelEnergy` en cero, que es una cosa que se
    // ve igual que la buena y que la mente del Hito 5 va a juntar creyendo que
    // sirve.
    const malas: string[] = []
    const nombres: string[] = []
    let miradas = 0
    for (const s of SUSTANCIAS_SEMILLA) {
      if ((s.perUnitMass.fuelEnergy ?? 0) <= 0) continue
      for (const m of [0.05, 0.2, 1, 5, 20]) {
        miradas++
        const a = arder(s.id, m, AL_AIRE, 20, Math.max(120, 70 * m))
        const sub = a.cuerpo.parts[0]?.substance
        const fuel = qualityOf(a.cuerpo, 'fuelEnergy', a.phys)
        if (sub !== s.id || fuel > 0) continue
        // Sigue siendo la materia madre y no le queda nada para arder. Sólo pasa
        // si NO SE NOTA: el nombre tiene que decirlo.
        const virgen = nameOf(cuerpo(s.id, m, T_AMBIENTE), F)
        const gastado = nameOf(a.cuerpo, a.phys)
        if (virgen === gastado) malas.push(`  ${s.id} ${String(m)} kg → «${gastado}» igual que el entero`)
        else nombres.push(`  ${s.id.padEnd(10)} ${String(m).padStart(5)} kg · entero «${virgen}» · gastado «${gastado}»`)
      }
    }
    expect(malas).toEqual([])
    expect(miradas).toBeGreaterThan(100)
    log([
      '══ (c) LA LEÑA FALSA NO ESTÁ ═════════════════════════════════════════',
      `  ${String(miradas)} combinaciones (sustancia × masa), 0 indistinguibles`,
      '  las únicas que siguen siendo la materia madre con el tanque en cero:',
      ...(nombres.length === 0 ? ['  ninguna'] : nombres),
      '  (el carbón no puede transmutar: `pyrolysisAt` fuera de alcance y sin el tag',
      '   `organico`, así que la ley 4 no lo agarra — por eso lo dice el NOMBRE)',
    ])
  }, 300_000)

  it('un tizón entero y uno gastado no se llaman igual, y la diferencia la publica `nameOf`', () => {
    // El caso que el barrido de arriba encuentra, mirado de cerca. Un
    // `residuo-carbonoso-de-madera` recién hecho tiene 5,76 unidades de
    // combustible por kilo; el mismo después de arder tiene 0. Los dos tienen
    // `charred` 1 y los dos son la MISMA sustancia: lo único que los distingue es
    // el tanque, y hasta la reparación los dos se llamaban «madera hecho tizón
    // quemada».
    const fuente = { potencia: 300.6, distancia: 0, montaje: 'contacto' as Montaje }
    const tapado: Entorno = { celda: CELDA_TAPADA, fuente }
    // Se lo saca del fuego para mirarlo —`temperature` al ambiente— o el nombre
    // diría «ardiendo» y estaríamos comparando la temperatura en vez del tanque,
    // que es lo que este test existe para distinguir.
    const caliente = arder('madera', 1, tapado, 20, 60)
    const recien = {
      cuerpo: { ...caliente.cuerpo, state: { ...caliente.cuerpo.state, temperature: T_AMBIENTE } },
      phys: caliente.phys,
    }
    expect(recien.cuerpo.parts[0]?.substance).toContain('carbonoso')
    expect(qualityOf(recien.cuerpo, 'fuelEnergy', recien.phys)).toBeGreaterThan(0)

    const gastado = arder('madera', 1, tapado, 20, 400)
    expect(gastado.cuerpo.parts[0]?.substance).toBe(recien.cuerpo.parts[0]?.substance)
    expect(qualityOf(gastado.cuerpo, 'fuelEnergy', gastado.phys)).toBe(0)

    const nRecien = nameOf(recien.cuerpo, recien.phys)
    const nGastado = nameOf(gastado.cuerpo, gastado.phys)
    expect(nRecien).not.toBe(nGastado)
    expect(nGastado).toContain('consumid')
    // Y la ceniza NO se dice consumida: nunca tuvo nada que perder. Que la regla
    // sepa distinguir eso es lo que la hace una regla y no un caso.
    const ceniza = arder('madera', 1, { celda: CELDA_AL_AIRE }, 20, 120)
    expect(combustibleDeOrigen(ceniza.cuerpo, ceniza.phys)).toBe(0)
    expect(nameOf(ceniza.cuerpo, ceniza.phys)).not.toContain('consumid')

    log([
      '══ (c bis) EL TIZÓN QUE YA NO SIRVE SE VE ════════════════════════════',
      `  recién hecho ... «${nRecien}» · fuelEnergy ${qualityOf(recien.cuerpo, 'fuelEnergy', recien.phys).toFixed(2)}`,
      `  gastado ........ «${nGastado}» · fuelEnergy ${qualityOf(gastado.cuerpo, 'fuelEnergy', gastado.phys).toFixed(2)}`,
      `  la ceniza ...... «${nameOf(ceniza.cuerpo, ceniza.phys)}» · nunca tuvo combustible`,
    ])
  })
})

// ═══ (e) NADA DEL ADR II-0011 SE MOVIÓ ═══════════════════════════════════════

describe('(e) lo que esta reparación podía romper y no rompió', () => {
  it('la meseta sigue siendo 615,00 °C a las cinco frecuencias, para las nueve masas', () => {
    // La meseta la fija `regimenDe` y esta reparación no la toca, pero la toca
    // `charred` —que decide cuándo transmuta— así que un leño que se hiciera
    // ceniza antes de llegar al régimen daría otra tabla. Se mira a la MITAD de la
    // vida de cada uno, que es donde el régimen ya cerró y todavía queda materia.
    const esperada = T_AMBIENTE + regimenDeLlama(1)
    expect(esperada).toBe(615)
    const filas: string[] = []
    for (const m of MASAS) {
      const medidas = FRECUENCIAS_ADMISIBLES.map((hz) => {
        const dt = dtDeFrecuencia(hz)
        let b = cuerpo('madera', m, 400)
        // Hasta la mitad de su vida, o hasta 20 s si es más chico que eso.
        const hasta = Math.min(Math.max(20, 25 * m), 25 * m)
        for (let n = 1; n <= Math.round(hasta / dt); n++) b = paso(b, AL_AIRE, F, dt).body
        return qualityOf(b, 'temperature', F)
      })
      for (const [i, t] of medidas.entries()) {
        expect([m, FRECUENCIAS_ADMISIBLES[i], Math.abs(t - esperada) < 1e-6]).toEqual([
          m,
          FRECUENCIAS_ADMISIBLES[i],
          true,
        ])
      }
      filas.push(`  ${String(m).padStart(5)} kg ${medidas.map((t) => t.toFixed(4).padStart(11)).join('')}`)
    }
    log([
      '══ (e) LA MESETA, POR MASA Y POR FRECUENCIA ══════════════════════════',
      `  ${'masa'.padStart(8)}${FRECUENCIAS_ADMISIBLES.map((h) => `${String(h)} Hz`.padStart(11)).join('')}`,
      ...filas,
    ])
  }, 300_000)

  it('tapar sigue rindiendo, y el tizón sigue saliendo más rico que la madera', () => {
    // La técnica emblema del ADR II-0002, que es lo que la rama del CALOR de
    // `avanceDeCarbon` existe para no romper. Con oxígeno 0,2 la llama se lleva
    // cinco veces menos, así que si `charred` dependiera SÓLO del combustible
    // quemado, el leño tapado tardaría cinco veces más y llegaría a la ley 4 con
    // el tanque casi vacío: tapar dejaría de rendir. Medido con esa versión: el
    // tizón salía con 5,76 de `fuelEnergy` contra los 18 de la madera.
    const fuente = { potencia: 300.6, distancia: 0, montaje: 'contacto' as Montaje }
    const tapado = arder('madera', 1, { celda: CELDA_TAPADA, fuente }, 20, 120)
    const madre = F.substances.get('madera')
    const tizon = tapado.phys.substances.get(tapado.cuerpo.parts[0]?.substance ?? '')
    expect(tizon?.perUnitMass.fuelEnergy ?? 0).toBeGreaterThan(madre?.perUnitMass.fuelEnergy ?? 0)
    // Y los dos caminos —tapado y al aire— siguen tardando lo mismo, porque para
    // la madera manda el calor en los dos.
    const alAire = arder('madera', 1, { celda: CELDA_AL_AIRE }, 20, 120)
    expect(tapado.transmuta).toBeCloseTo(alAire.transmuta, 1)
    log([
      '══ (e bis) TAPAR SIGUE RINDIENDO ═════════════════════════════════════',
      `  madera fuelEnergy ${(madre?.perUnitMass.fuelEnergy ?? 0).toFixed(2)} → tizón ${(tizon?.perUnitMass.fuelEnergy ?? 0).toFixed(2)}`,
      `  y los dos transmutan a los ${tapado.transmuta.toFixed(2)} s (tapado) / ${alAire.transmuta.toFixed(2)} s (al aire)`,
    ])
  })
})
