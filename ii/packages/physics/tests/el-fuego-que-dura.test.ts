// ═══ EL ADR II-0011, MEDIDO ═══════════════════════════════════════════════════
//
// «Arder libera calor, y la ley 1 se integra en forma cerrada.»
//
// Los siete criterios verificables del ADR, escritos ANTES de tocar el código y
// medidos acá contra `paso()` — el motor, no un banco que reimplemente las
// ecuaciones. Ver `ataque-2-al-barrido.test.ts`: `pnpm ii:barrido` NO importa una
// sola línea del paquete, así que no puede ser control de nada de esto.
//
// ─── LOS SIETE ──────────────────────────────────────────────────────────────
//
//   (a) un leño de 1 kg encendido arde N segundos y se apaga solo, y N es el
//       MISMO a 10, 20, 25, 50 y 100 Hz;
//   (b) la meseta de temperatura mientras arde es la misma a las cinco;
//   (c) `charred` llega a 0,8 y la ley 4 transmuta: tapado da residuo carbonoso
//       y sin tapar, mineral;
//   (d) el pescado sobre la parrilla llega a `digestibility ≥ 0,85` sin que nadie
//       lo frote;
//   (e) la ventana de cocción de las doce sustancias sigue existiendo;
//   (f) `friccion` cumple su `establishes` por más de un tick;
//   (g) el `fuelEnergy` total del mundo nunca sube.
//
// (f) se mide además en `el-empuje-no-se-relaja.test.ts` sobre la partición del
// tick, y en `world/tests/el-fuego.test.ts` con la criatura de verdad. Acá está
// la mitad que es de la física: una vara encendida no vuelve al ambiente.

import { describe, expect, it } from 'vitest'
import {
  acopleTermico,
  AL_AIRE,
  buildSeedPhysics,
  CALOR_POR_COMBUSTIBLE,
  CARBONIZADO_QUE_TRANSMUTA,
  CELDA_AL_AIRE,
  CELDA_TAPADA,
  conSustancia,
  correr,
  dtDeFrecuencia,
  estaEnVentanaDeCoccion,
  FRECUENCIAS_ADMISIBLES,
  H_PERDIDA_POR_SEGUNDO,
  paso,
  porPaso,
  qualityOf,
  regimenDeLlama,
  T_AMBIENTE,
  TAG_RESIDUO_CON_AIRE,
  TAG_RESIDUO_SIN_AIRE,
  totalConservado,
} from '../src/index.js'
import type { Body, Entorno, Montaje, Physics, Substance } from '../src/index.js'

const F: Physics = buildSeedPhysics()

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

function cuerpo(sustancia: string, masa: number, t: number, id = 'x'): Body {
  return {
    id,
    form: 'vara',
    parts: [{ substance: sustancia, mass: masa, q: {} }],
    joints: [],
    state: { temperature: t },
  }
}

/**
 * Una corrida que sigue a un cuerpo hasta que se apaga, dando de alta la
 * sustancia que la ley 4 invente. Sin esto, un cuerpo que transmutó queda hecho
 * de una materia que `qualityOf` no encuentra y todas sus cualidades vuelven al
 * valor por omisión — que es un bug de arnés, no del motor.
 */
interface Arco {
  /** Segundos hasta que `emitsPower` vuelve a 0. `NaN` si no se apagó. */
  readonly seApaga: number
  /** Segundos hasta que la ley 4 transmutó, y en qué. `NaN` si no transmutó. */
  readonly transmuta: number
  readonly residuo: string
  /** La temperatura a los `mirarEn` segundos, ya en régimen. */
  readonly meseta: number
  readonly cuerpo: Body
  readonly phys: Physics
}

function arder(
  sustancia: string,
  masa: number,
  e: Entorno,
  hz: number,
  techo: number,
  mirarEn: number,
  t0 = 700,
): Arco {
  const dt = dtDeFrecuencia(hz)
  let b = cuerpo(sustancia, masa, t0)
  let phys = F
  let seApaga = Number.NaN
  let transmuta = Number.NaN
  let residuo = ''
  let meseta = Number.NaN
  const pasos = Math.round(techo / dt)
  for (let n = 1; n <= pasos; n++) {
    const r = paso(b, e, phys, dt)
    b = r.body
    if (r.nueva !== undefined) {
      phys = conSustancia(phys, r.nueva)
      if (Number.isNaN(transmuta)) {
        transmuta = n / hz
        residuo = r.nueva.id
      }
    }
    if (n === Math.round(mirarEn * hz)) meseta = qualityOf(b, 'temperature', phys)
    if (Number.isNaN(seApaga) && qualityOf(b, 'emitsPower', phys) === 0) seApaga = n / hz
  }
  return { seApaga, transmuta, residuo, meseta, cuerpo: b, phys }
}

// ═══ (a) UN LEÑO ARDE N SEGUNDOS Y SE APAGA SOLO ══════════════════════════════

describe('(a) un fuego dura, y dura lo mismo a las cinco frecuencias', () => {
  it('un leño de 1 kg arde 50,00 s y se apaga solo, a 10, 20, 25, 50 y 100 Hz', () => {
    // Los 50 s no son un contador: son el punto en que `charred` cruza los 0,8 de
    // `CARBONIZADO_QUE_TRANSMUTA` a 0,016 por segundo y la ley 4 lo convierte en
    // ceniza, que no tiene combustible. El leño se apaga porque se GASTÓ.
    const filas: string[] = []
    const medidos: number[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const a = arder('madera', 1, AL_AIRE, hz, 120, 20)
      medidos.push(a.seApaga)
      // El margen es UN TICK: un hecho no se observa cuando ocurre sino en el
      // primer paso posterior, y a 25 Hz un tick son 0,04 s.
      // La comparación va en PASOS: 'un tick' en segundos es un double, y a
      // 50 Hz 'seApaga − 50' da 0,020000000000000018 contra un margen de 0,02.
      expect([hz, Math.abs(Math.round(a.seApaga * hz) - 50 * hz) <= 1]).toEqual([hz, true])
      expect([hz, a.transmuta]).toEqual([hz, a.seApaga])
      filas.push(
        `  ${String(hz).padStart(3)} Hz → arde ${a.seApaga.toFixed(3)} s y se apaga (${a.residuo})`,
      )
    }
    // Y el carbón, que NO se piroliza —`pyrolysisAt` fuera de alcance— y por lo
    // tanto no puede transmutar: ése se apaga por la otra vía, que es quedarse sin
    // combustible. 1 kg × 32 unidades ÷ 0,3 por segundo = 106,67 s.
    const carbon: number[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const a = arder('carbon', 1, AL_AIRE, hz, 200, 20)
      carbon.push(a.seApaga)
      expect([hz, Number.isNaN(a.transmuta)]).toEqual([hz, true])
      expect([hz, Math.abs(Math.round(a.seApaga * hz) - Math.round((32 / 0.3) * hz)) <= 1]).toEqual([hz, true])
    }
    log([
      '══ (a) EL FUEGO DURA ══════════════════════════════════════════════════',
      '  madera 1 kg al aire, soltada a 700 °C, sin nadie:',
      ...filas,
      `  y el carbón de 1 kg, que no transmuta: ${carbon.map((s) => `${s.toFixed(2)}s`).join('  ')}`,
      '  (antes del ADR II-0011: una madera de 0,2 kg a 700 °C caía debajo de su',
      '   ignición EN UN TICK, y la más pesada que se puede levantar aguantaba 1,20 s)',
    ])
  })

  it('y cuánto dura lo decide la MASA, que es lo que hace que juntar leña sirva', () => {
    // `COMBUSTIBLE_POR_SEGUNDO` es extensivo (ADR II-0011): la llama se lleva 0,3
    // unidades por segundo, y lo que hay para quemar es `fuelEnergy · mass`. Con
    // la tasa intensiva de antes, una astilla y un tronco ardían los mismos 18 s.
    const filas: string[] = []
    for (const m of [0.05, 0.2, 0.5, 0.8]) {
      const a = arder('madera', m, AL_AIRE, 20, 120, 20)
      // Estas masas se quedan sin combustible ANTES de llegar a los 50 s de la
      // ley 4, así que la duración es exactamente `18·m/0,3`.
      expect([m, Number.isNaN(a.transmuta)]).toEqual([m, true])
      expect([m, Math.abs(a.seApaga - 60 * m) <= 0.1]).toEqual([m, true])
      filas.push(`  madera ${String(m).padStart(4)} kg → arde ${a.seApaga.toFixed(2)} s`)
    }
    log([
      '══ (a bis) MÁS LEÑA, MÁS FUEGO ════════════════════════════════════════',
      ...filas,
      '  60 s por kilo de madera, y la temperatura es la misma para todas',
    ])
  })
})

// ═══ (b) LA MESETA ═══════════════════════════════════════════════════════════

/**
 * La ley 1 COMO ERA antes del ADR II-0011, reescrita acá para poder poner las dos
 * tablas una al lado de la otra. Es una copia y se declara como tal: el motor no
 * tiene esta línea en ningún lado desde este ADR.
 */
function unPasoEuler(t: number, objetivo: number, cap: number, hz: number): number {
  const acople = cap > 0 ? Math.min(1, H_PERDIDA_POR_SEGUNDO / hz / cap) : 1
  return t + (objetivo - t) * acople
}

describe('(b) la meseta de un cuerpo que arde no depende de la frecuencia', () => {
  it('615,00 °C a las cinco, y la tabla vieja al lado', () => {
    // El punto fijo del par ley 1 + ley 3 es `ambiente + régimen` para CUALQUIER
    // `dt`, y eso es una identidad y no una calibración: la ley 1 cierra la
    // fracción `acople` del hueco y la ley 3 suma `régimen · acople`, así que en
    // el punto fijo el `acople` se cancela. Ver `regimenDe` en `leyes.ts`.
    const meseta = T_AMBIENTE + regimenDeLlama(1)
    expect(meseta).toBe(615)
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const a = arder('madera', 1, AL_AIRE, hz, 40, 20, 400)
      // Nueve decimales y no bit a bit: al punto fijo se llega asintóticamente y
      // a 10 Hz el último bit todavía no cerró (614,9999999999998).
      expect(a.meseta).toBeCloseTo(meseta, 9)
      filas.push(`  ${String(hz).padStart(3)} Hz → ${a.meseta.toFixed(4)} °C`)
    }

    // ─── LA TABLA VIEJA, que es el diagnóstico que motivó el ADR ────────────
    //
    // Un cuerpo a 400 °C soltado al aire, UN paso, con el Euler explícito. El
    // umbral de inestabilidad (`r > 1`) es exactamente el régimen de la yesca: los
    // cuerpos livianos que se pueden encender son los que la ley no sabía
    // integrar. Y el mismo hecho físico daba 15,00 a 20 Hz y 286,76 a 100.
    const viejas: string[] = []
    const nuevas: string[] = []
    const alSegundo: string[] = []
    for (const masa of [0.2, 0.5, 1, 5]) {
      const cap = masa * 1.7
      const r20 = H_PERDIDA_POR_SEGUNDO / 20 / cap
      const euler = [20, 100].map((hz) => unPasoEuler(400, T_AMBIENTE, cap, hz))
      const cerrado = [20, 100].map(
        (hz) => 400 + (T_AMBIENTE - 400) * acopleTermico(cap, dtDeFrecuencia(hz)),
      )
      viejas.push(
        `  ${String(masa).padStart(4)} kg  heatCap ${cap.toFixed(2).padStart(5)}  r = ${r20.toFixed(3)}` +
          `${r20 > 1 ? '  INESTABLE' : '          '}   ${(euler[0] as number).toFixed(2).padStart(7)}   ${(euler[1] as number).toFixed(2).padStart(7)}`,
      )
      nuevas.push(
        `  ${String(masa).padStart(4)} kg  heatCap ${cap.toFixed(2).padStart(5)}  ` +
          `acople = ${acopleTermico(cap, dtDeFrecuencia(20)).toFixed(3)}              ` +
          `${(cerrado[0] as number).toFixed(2).padStart(7)}   ${(cerrado[1] as number).toFixed(2).padStart(7)}`,
      )
      // Y LO QUE DE VERDAD IMPORTA: a UN SEGUNDO de mundo —no a un paso— las dos
      // frecuencias tienen que dar lo mismo. El Euler no lo daba ni de cerca.
      const unSegundo = [20, 100].map((hz) => {
        let t = 400
        const ac = acopleTermico(cap, dtDeFrecuencia(hz))
        for (let n = 0; n < hz; n++) t = t + (T_AMBIENTE - t) * ac
        return t
      })
      const unSegundoEuler = [20, 100].map((hz) => {
        let t = 400
        for (let n = 0; n < hz; n++) t = unPasoEuler(t, T_AMBIENTE, cap, hz)
        return t
      })
      expect(unSegundo[0]).toBeCloseTo(unSegundo[1] as number, 5)
      alSegundo.push(
        `  ${String(masa).padStart(4)} kg  cerrada: ${(unSegundo[0] as number).toFixed(4).padStart(9)} / ${(unSegundo[1] as number).toFixed(4).padStart(9)}` +
          `      Euler: ${(unSegundoEuler[0] as number).toFixed(4).padStart(9)} / ${(unSegundoEuler[1] as number).toFixed(4).padStart(9)}`,
      )
    }
    log([
      '══ (b) LA MESETA, A LAS CINCO FRECUENCIAS ═════════════════════════════',
      ...filas,
      '',
      '  LA TABLA VIEJA · un paso de Euler desde 400 °C al aire (20 Hz / 100 Hz)',
      ...viejas,
      '',
      '  LA TABLA NUEVA · el mismo paso con la forma cerrada',
      ...nuevas,
      '',
      '  Y A UN SEGUNDO DE MUNDO (20 Hz / 100 Hz), que es lo que el ADR II-0008 pide',
      ...alSegundo,
    ])
  })

  it('y la trayectoria entera coincide, no sólo el punto fijo', () => {
    // El punto fijo lo cumpliría también un integrador malo que llegue por otro
    // camino. Esto compara la temperatura a CINCO instantes de mundo mientras el
    // cuerpo sube hacia el régimen, en las cinco frecuencias.
    const filas: string[] = []
    let peor = 0
    // Los instantes son múltiplos de los CINCO ticks (0,1 / 0,05 / 0,04 / 0,02 /
    // 0,01), o el test mediría dónde cae la grilla de muestreo en vez de la
    // trayectoria: a 25 Hz, «medio segundo» son 12,5 pasos y el arnés mira el 13.
    for (const t of [0.4, 1, 2, 4, 8]) {
      const medidas = FRECUENCIAS_ADMISIBLES.map(
        (hz) => arder('madera', 1, AL_AIRE, hz, t + 0.001, t, 400).meseta,
      )
      const ref = medidas[1] as number
      for (const m of medidas) {
        const d = Math.abs(m - ref) / ref
        if (d > peor) peor = d
      }
      filas.push(`  t = ${String(t).padStart(4)} s   ${medidas.map((m) => m.toFixed(6).padStart(12)).join('')}`)
    }
    // La cota: 1e-9 relativo, y el peor MEDIDO es 4,8e-13. Lo que queda es el
    // último bit del double, no error de integración: la forma cerrada compone
    // exacto entre frecuencias porque `e^(−r·n·dt)` sólo mira el tiempo total, y
    // por eso esto no es una tolerancia sino una identidad con ruido de redondeo.
    expect(peor).toBeLessThan(1e-9)
    log([
      `══ (b bis) LA TRAYECTORIA ═════════  peor desvío relativo: ${peor.toExponential(2)}`,
      `  ${''.padStart(13)}${FRECUENCIAS_ADMISIBLES.map((h) => `${String(h)} Hz`.padStart(12)).join('')}`,
      ...filas,
    ])
  })
})

// ═══ (c) LA TÉCNICA EMBLEMA: TAPAR O NO TAPAR ════════════════════════════════

describe('(c) `charred` llega a 0,8 y la ley 4 transmuta, y el aire decide en qué', () => {
  it('al aire da mineral, tapado da residuo carbonoso, y la diferencia es un número', () => {
    // Era IMPOSIBLE antes del ADR II-0011, y no por la ley 4: porque nada se
    // sostenía arriba de su punto de pirólisis el tiempo suficiente para
    // carbonizarse. Un leño encendido volvía al ambiente en un tick.
    //
    // El caso TAPADO lleva `fuente`, y no es una comodidad: con oxígeno 0,2 la
    // llama propia sostiene 135 °C —por debajo de los 280 de pirólisis— así que
    // hace falta el calor de al lado. Ésa ES la técnica: el leño que TAPA la
    // fogata, `montaje: contacto`, que es lo que `montajeDe` del mundo da a lo que
    // apoya o tapa a la fuente.
    const fuente = { potencia: 300.6, distancia: 0, montaje: 'contacto' as Montaje }
    const alAire = arder('madera', 1, { celda: CELDA_AL_AIRE }, 20, 120, 20)
    const tapado = arder('madera', 1, { celda: CELDA_TAPADA, fuente }, 20, 120, 20)

    expect(alAire.residuo).toContain(TAG_RESIDUO_CON_AIRE)
    expect(tapado.residuo).toContain(TAG_RESIDUO_SIN_AIRE)
    // Y `charred` cruzó de verdad el umbral que la ley 4 pide: no transmutó por
    // otra razón.
    expect(alAire.transmuta).toBeCloseTo(CARBONIZADO_QUE_TRANSMUTA / 0.016, 1)

    // La diferencia, que es toda la recompensa de la técnica: lo tapado conserva
    // el esqueleto de carbono, o sea masa y poder calorífico. Lo destapado no.
    const masaAire = qualityOf(alAire.cuerpo, 'mass', alAire.phys)
    const masaTapado = qualityOf(tapado.cuerpo, 'mass', tapado.phys)
    expect(masaTapado / masaAire).toBeCloseTo(0.28 / 0.06, 6)
    const combustibleAire = totalConservado(alAire.cuerpo, 'fuelEnergy', alAire.phys)
    const combustibleTapado = totalConservado(tapado.cuerpo, 'fuelEnergy', tapado.phys)
    expect(combustibleAire).toBe(0)
    expect(combustibleTapado).toBeGreaterThan(0)
    log([
      '══ (c) TAPAR O NO TAPAR ═══════════════════════════════════════════════',
      `  al aire  → ${alAire.residuo} a los ${alAire.transmuta.toFixed(2)} s · masa ${masaAire.toFixed(3)} kg · combustible ${combustibleAire.toFixed(2)}`,
      `  tapado   → ${tapado.residuo} a los ${tapado.transmuta.toFixed(2)} s · masa ${masaTapado.toFixed(3)} kg · combustible ${combustibleTapado.toFixed(2)}`,
      `  tapar rinde ${(masaTapado / masaAire).toFixed(2)}× la materia, y lo que sale VUELVE A ARDER`,
    ])
  })

  it('y lo que sale de tapar arde otra vez: se apaga cuando se le acaba', () => {
    // El residuo carbonoso tiene `ignitionPoint` 420 y `pyrolysisAt` fuera de
    // alcance, así que no puede volver a transmutar: la única forma de que se
    // apague es quedarse sin combustible. Es el lazo del criterio (g) cerrándose
    // con la materia que el propio fuego fabricó.
    const fuente = { potencia: 300.6, distancia: 0, montaje: 'contacto' as Montaje }
    const largo = arder('madera', 1, { celda: CELDA_TAPADA, fuente }, 20, 400, 20)
    expect(largo.seApaga).toBeGreaterThan(largo.transmuta)
    expect(Number.isNaN(largo.seApaga)).toBe(false)
    expect(qualityOf(largo.cuerpo, 'fuelEnergy', largo.phys)).toBe(0)
  })
})

// ═══ (d) EL PESCADO SOBRE LA PARRILLA ════════════════════════════════════════

describe('(d) el pescado se cocina entero sin que nadie frote', () => {
  it('llega a `digestibility` 0,85 a los 3,50 s, con el leño ardiendo solo', () => {
    // Dos cuerpos y ninguna mano: un leño de 1 kg encendido y un pescado apoyado
    // sobre algo que está en la celda del leño (`montaje: parrilla`). El leño se
    // sostiene solo y su `emitsPower` sale de su combustible, que baja mientras
    // arde: la parrilla se va enfriando sola, que es lo que hace una fogata.
    const dt = dtDeFrecuencia(20)
    let leno = cuerpo('madera', 1, 400, 'leno')
    let pez: Body = {
      id: 'pez',
      form: 'filete',
      parts: [{ substance: 'pescado', mass: 1, q: {} }],
      joints: [],
      state: { temperature: T_AMBIENTE },
    }
    let physLeno = F
    let a85 = Number.NaN
    let dig = 0
    const marcas: string[] = []
    for (let n = 1; n <= 20 * 60; n++) {
      const p = qualityOf(leno, 'emitsPower', physLeno)
      const e: Entorno =
        p > 0
          ? { celda: CELDA_AL_AIRE, fuente: { potencia: p, distancia: 0, montaje: 'parrilla' } }
          : AL_AIRE
      pez = paso(pez, e, F, dt).body
      const r = paso(leno, { celda: CELDA_AL_AIRE }, physLeno, dt)
      leno = r.body
      if (r.nueva !== undefined) physLeno = conSustancia(physLeno, r.nueva)
      dig = qualityOf(pez, 'digestibility', F)
      if (dig >= 0.85 && Number.isNaN(a85)) a85 = n / 20
      if (n % (20 * 10) === 0) {
        marcas.push(
          `  t = ${String(n / 20).padStart(2)} s   digestibility ${dig.toFixed(4)}   el leño emite ${p.toFixed(1)}`,
        )
      }
    }
    expect(Number.isNaN(a85)).toBe(false)
    expect(a85).toBeLessThan(10)
    expect(dig).toBeGreaterThanOrEqual(0.85)
    // Y no se quemó: la parrilla deja el pescado en su ventana y no arriba de su
    // punto de pirólisis.
    expect(qualityOf(pez, 'charred', F)).toBe(0)
    log([
      '══ (d) EL PESCADO SE COCINA SOLO ══════════════════════════════════════',
      `  llega a digestibility 0,85 a los ${a85.toFixed(2)} s y termina en ${dig.toFixed(4)}`,
      ...marcas,
      '  (antes del ADR II-0011 el pescado de la cadena se quedaba en 0,513)',
    ])
  })
})

// ═══ (e) LA VENTANA DE COCCIÓN DE LAS DOCE ═══════════════════════════════════

/** Las doce del barrido del Hito 0: todo lo que alimenta y tiene punto de cocción. */
const LAS_DOCE: readonly string[] = [
  'carne',
  'pescado',
  'molusco',
  'huevo',
  'tuberculo',
  'raiz-dura',
  'grano',
  'hongo',
  'hoja',
  'savia',
  'cuero',
  'medula',
]

describe('(e) la ventana de cocción de las doce sigue existiendo, medida contra el MOTOR', () => {
  it('las doce tienen al menos un sitio donde se cocinan y ninguno donde se quemen', () => {
    // NO contra `pnpm ii:barrido`. Ese script no importa una sola línea del
    // paquete —lo prueba `ataque-2-al-barrido.test.ts`— así que da la misma tabla
    // con el motor roto y con el motor arreglado. Acá se corre `paso()`.
    //
    // Un sitio es una terna (potencia, distancia, montaje) de las que el mundo
    // sabe construir. Para cada sustancia se buscan los sitios donde la ley 5 de
    // verdad sube `digestibility` en veinte segundos SIN que la ley 3 la
    // carbonice, y se afirma que hay al menos uno y que hay al menos uno donde no.
    const dt = dtDeFrecuencia(20)
    const potencias = [150, 300, 600, 900]
    const distancias = [0, 1, 2]
    const montajes: readonly Montaje[] = ['piso', 'parrilla', 'contacto']
    const filas: string[] = []
    for (const s of LAS_DOCE) {
      let cocinan = 0
      let queman = 0
      let mejor = 0
      let mejorSitio = ''
      for (const potencia of potencias) {
        for (const distancia of distancias) {
          for (const montaje of montajes) {
            const b: Body = {
              id: 'x',
              form: 'filete',
              parts: [{ substance: s, mass: 0.5, q: {} }],
              joints: [],
              state: { temperature: T_AMBIENTE },
            }
            const e: Entorno = { celda: CELDA_AL_AIRE, fuente: { potencia, distancia, montaje } }
            const r = correr(b, e, F, dt, 20)
            const d = qualityOf(r.body, 'digestibility', r.phys)
            const c = qualityOf(r.body, 'charred', r.phys)
            const d0 = qualityOf(b, 'digestibility', F)
            if (c > 0) queman++
            else if (d > d0 + 0.05) {
              cocinan++
              if (d > mejor) {
                mejor = d
                mejorSitio = `${String(potencia)}/${String(distancia)}/${montaje}`
              }
            }
          }
        }
      }
      // LA VENTANA EXISTE: hay sitios donde se cocina y sitios donde se arruina.
      // Las dos mitades importan — si todo cocinara, no habría decisión.
      expect([s, cocinan > 0]).toEqual([s, true])
      expect([s, queman > 0]).toEqual([s, true])
      filas.push(
        `  ${s.padEnd(10)} ${String(cocinan).padStart(2)} sitios cocinan · ${String(queman).padStart(2)} arruinan · ` +
          `mejor ${mejor.toFixed(3)} en ${mejorSitio}`,
      )
    }
    log([
      '══ (e) LA VENTANA DE LAS DOCE, CONTRA `paso()` ════════════════════════',
      '  36 sitios por sustancia (4 potencias × 3 distancias × 3 montajes), 20 s',
      ...filas,
    ])
  })

  it('y `estaEnVentanaDeCoccion` dice lo mismo que la ley 5 hace', () => {
    // El predicado del motor contra su propia consecuencia: si el predicado
    // dijera que sí y la ley no cocinara —o al revés— la ventana sería una
    // afirmación sin respaldo.
    const dt = dtDeFrecuencia(20)
    for (const s of LAS_DOCE) {
      const sub = F.substances.get(s) as Substance
      const dentro = (sub.perUnitMass.denaturesAt as number) + 10
      const b: Body = {
        id: 'x',
        form: 'filete',
        parts: [{ substance: s, mass: 0.5, q: {} }],
        joints: [],
        state: { temperature: dentro },
      }
      expect([s, estaEnVentanaDeCoccion(b, F)]).toEqual([s, true])
      const r = paso(b, { celda: CELDA_AL_AIRE, fuente: { potencia: 300, distancia: 1, montaje: 'parrilla' } }, F, dt)
      expect([s, qualityOf(r.body, 'digestibility', F) > qualityOf(b, 'digestibility', F)]).toEqual([s, true])
    }
  })
})

// ═══ (f) EL `establishes` QUE DURA ═══════════════════════════════════════════

describe('(f) una vara encendida no vuelve al ambiente', () => {
  it('a 400 °C sube y no baja, y cuarenta y nueve segundos después sigue arriba de 400', () => {
    // `friccion` declara `establishes: ['temperature>=400']`, y eso no es
    // documentación: es lo que la fragua lee para planificar. Antes del ADR
    // II-0010 el predicado era falso siempre; después, cierto exactamente un paso
    // —que para un planificador es peor—; ahora dura lo que dura el combustible.
    const dt = dtDeFrecuencia(20)
    const b = cuerpo('madera', 1, 400)
    const unTick = paso(b, AL_AIRE, F, dt).body
    expect(qualityOf(unTick, 'temperature', F)).toBeGreaterThan(400)
    const filas: string[] = []
    for (const t of [1, 5, 12, 30, 49, 51]) {
      const r = correr(b, AL_AIRE, F, dt, t)
      const grados = qualityOf(r.body, 'temperature', r.phys)
      filas.push(`  a los ${String(t).padStart(2)} s → ${grados.toFixed(2)} °C`)
      if (t <= 49) expect([t, grados >= 400]).toEqual([t, true])
      // Y a los 51 ya no: se volvió ceniza a los 50. La promesa dura mientras hay
      // de qué, no para siempre, y eso también es lo correcto.
      if (t === 51) expect(grados).toBeLessThan(400)
    }
    log([
      '══ (f) EL `establishes` QUE DURA ══════════════════════════════════════',
      '  vara de madera de 1 kg soltada a 400 °C, al aire, sin nadie:',
      ...filas,
      '  (antes del ADR II-0011: 20,64 °C un tick después)',
    ])
  })
})

// ═══ (g) NO ES UNA MÁQUINA DE MOVIMIENTO PERPETUO ════════════════════════════

describe('(g) el combustible del mundo nunca sube, y por eso el lazo termina', () => {
  it('en una partida larga con fuego, el total de `fuelEnergy` es monótono no creciente', () => {
    // `fuelEnergy` es CONSERVADA (`quality.ts`) y `conservar()` cierra cada paso:
    // ninguna ley puede subirla. La ley 3 la baja y la 4 la reparte en una
    // sustancia nueva con menos masa. El lazo se corta solo porque el combustible
    // es un stock finito que sólo se gasta.
    //
    // Se mide sobre SEIS cuerpos a la vez —los que arden, los que se cocinan y
    // los que no hacen nada— y en TODOS los pasos, no sólo al final: una subida y
    // su compensación darían el mismo total al final y esto lo ve.
    const dt = dtDeFrecuencia(20)
    const casos: readonly (readonly [string, number, Entorno])[] = [
      ['madera', 1, { celda: CELDA_AL_AIRE }],
      ['madera', 1, { celda: CELDA_TAPADA, fuente: { potencia: 600, distancia: 0, montaje: 'contacto' } }],
      ['hoja-seca', 0.2, { celda: CELDA_AL_AIRE }],
      ['carbon', 2, { celda: CELDA_AL_AIRE }],
      ['pescado', 1, { celda: CELDA_AL_AIRE, fuente: { potencia: 300, distancia: 1, montaje: 'parrilla' } }],
      ['grasa', 0.5, { celda: CELDA_AL_AIRE, fuente: { potencia: 900, distancia: 0, montaje: 'contacto' } }],
    ]
    let subidas = 0
    const filas: string[] = []
    for (const [s, m, e] of casos) {
      let b = cuerpo(s, m, 700)
      let phys = F
      let anterior = totalConservado(b, 'fuelEnergy', phys)
      const inicial = anterior
      for (let n = 1; n <= 20 * 200; n++) {
        const r = paso(b, e, phys, dt)
        b = r.body
        if (r.nueva !== undefined) phys = conSustancia(phys, r.nueva)
        const ahora = totalConservado(b, 'fuelEnergy', phys)
        if (ahora > anterior) subidas++
        anterior = ahora
      }
      filas.push(
        `  ${s.padEnd(10)} ${String(m).padStart(4)} kg → de ${inicial.toFixed(3)} a ${anterior.toFixed(3)} unidades en 200 s`,
      )
      expect([s, anterior <= inicial]).toEqual([s, true])
    }
    // NI UNA subida, en 24 000 pasos.
    expect(subidas).toBe(0)
    log([
      '══ (g) EL COMBUSTIBLE SÓLO BAJA ═══════════════════════════════════════',
      ...filas,
      '  24 000 pasos, 0 subidas del total conservado',
    ])
  })

  it('CARNADA · el calor de la ley 3 sale de combustible que existe, no de la nada', () => {
    // Lo que impediría que fuera perpetuo si el calor se cobrara mal: un cuerpo
    // SIN combustible no calienta a nadie, por caliente que esté. La piedra tiene
    // `fuelEnergy` 0 y `ignitionPoint` fuera de alcance; puesta a 700 °C se enfría
    // y punto.
    const dt = dtDeFrecuencia(20)
    const r = correr(cuerpo('piedra', 1, 700), AL_AIRE, F, dt, 20)
    expect(qualityOf(r.body, 'temperature', r.phys)).toBeCloseTo(T_AMBIENTE, 9)
    expect(qualityOf(r.body, 'emitsPower', r.phys)).toBe(0)

    // Y la cuenta del calor, despejada contra la constante: los grados de régimen
    // son `CALOR_POR_COMBUSTIBLE × quemado / porPaso(H_PERDIDA_POR_SEGUNDO)`. Si
    // alguien mueve la constante, esto se mueve con ella; si alguien borra el
    // término, se cae.
    const quemadoPorPaso = porPaso(0.3, dt)
    const regimen = (CALOR_POR_COMBUSTIBLE * quemadoPorPaso) / porPaso(H_PERDIDA_POR_SEGUNDO, dt)
    expect(regimen).toBeCloseTo(regimenDeLlama(1), 9)
    expect(regimen).toBeCloseTo(600, 9)
  })
})
