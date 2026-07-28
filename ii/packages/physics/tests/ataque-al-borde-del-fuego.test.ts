// ═══ EL ADVERSARIO DE «CINCUENTA SEGUNDOS POR KILO» ══════════════════════════
//
// El tramo anterior reparó `TASA_CARBONIZACION` —la hizo POR KILO— y publicó la
// promesa: «50 s por kilo, en todo el rango». `la-masa-decide-lo-que-arde.test.ts`
// la mide en nueve masas y a las cinco frecuencias, y da.
//
// La mide sobre UNA sustancia: `madera`. El barrido que sí toca las veintiséis
// —el (c) de aquel archivo— pregunta otra cosa (que no quede leña falsa) y NUNCA
// mira la duración. Este archivo mira la duración de las veintiséis, las masas que
// aquel barrido no tiene, los cuerpos de más de una parte y los cuerpos mojados.
//
// Toda promesa tiene un borde. Éstos son los cuatro que se encontraron, con el
// número de cada uno:
//
//   (1) la ley verdadera es `min(50, fuelEnergy/0,3)` segundos por kilo, y va de
//       3,33 s/kg (el hongo) a 106,7 s/kg (el carbón). Los 50 valen para SIETE de
//       las veintiséis;
//   (2) el barrido va de 0,05 a 50 kg y el mundo siembra de 0,01 a 5. La yesca
//       —`hoja-seca`, 0,01 a 0,08 kg— cae ENTERA por debajo de la masa más chica
//       que alguien midió. Ahí no hay bug: se verifica y se cierra, abajo, con la
//       comparación sub-tick que lo demuestra;
//   (3) en un cuerpo de varias partes la masa que decide es la TOTAL, incluida la
//       que no arde — y la ley 4 convierte en residuo TAMBIÉN a las partes
//       minerales. Un hacha de mango de madera y cabeza de pedernal se hace
//       ceniza entera en 24 s;
//   (4) secarse NO depende de la masa. Es la misma constante intensiva que la
//       reparación de este tramo persiguió, en la ley 11 en vez de en la 3, y
//       tiene la consecuencia dada vuelta: la lluvia protege la leña chica y no le
//       hace NADA a la grande.
//
// Y lo que se verificó y NO se rompió: la ley 4 sigue dando carbón con tapa y
// ceniza sin tapa a las cinco frecuencias, y el tizón sigue sin cerrar un ciclo.

import { describe, expect, it } from 'vitest'
import {
  AL_AIRE,
  buildSeedPhysics,
  CARBONIZADO_QUE_TRANSMUTA,
  CELDA_AL_AIRE,
  CELDA_TAPADA,
  conSustancia,
  dtDeFrecuencia,
  FRECUENCIAS_ADMISIBLES,
  paso,
  qualityOf,
  SUSTANCIAS_SEMILLA,
} from '../src/index.js'
import type { Body, Entorno, Montaje, Part, Physics } from '../src/index.js'

const F: Physics = buildSeedPhysics()

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

/** El valor de `COMBUSTIBLE_POR_SEGUNDO`, que el paquete no exporta. */
const COMBUSTIBLE_POR_SEGUNDO = 0.3

function conPartes(parts: readonly Part[], state: Record<string, number>): Body {
  return { id: 'x', form: 'vara', parts: [...parts], joints: [], state }
}

function cuerpo(s: string, m: number, state: Record<string, number> = { temperature: 700 }): Body {
  return conPartes([{ substance: s, mass: m, q: {} }], state)
}

interface Arco {
  /** Segundos hasta que la ley 4 transmutó. `NaN` si no transmutó. */
  readonly transmuta: number
  readonly cuerpo: Body
  readonly phys: Physics
}

/**
 * El mismo arnés que usa `la-masa-decide-lo-que-arde`: se da de alta la sustancia
 * que la ley 4 invente, o el cuerpo transmutado queda hecho de una materia que
 * `qualityOf` no encuentra y todas sus cualidades vuelven al valor por omisión.
 */
function arder(b0: Body, e: Entorno, hz: number, techo: number): Arco {
  const dt = dtDeFrecuencia(hz)
  let b = b0
  let phys = F
  let transmuta = Number.NaN
  const pasos = Math.round(techo / dt)
  for (let n = 1; n <= pasos; n++) {
    const r = paso(b, e, phys, dt)
    b = r.body
    if (r.nueva !== undefined) {
      phys = conSustancia(phys, r.nueva)
      if (Number.isNaN(transmuta)) transmuta = n / hz
    }
  }
  return { transmuta, cuerpo: b, phys }
}

// ═══ (1) LA PROMESA VALE PARA SIETE DE VEINTISÉIS ════════════════════════════

describe('(1) «cincuenta segundos por kilo» tiene sustancia, y no es cualquiera', () => {
  it('la ley que rige de verdad es `min(50, fuelEnergy/0,3)` s/kg, medida en las 25 orgánicas', () => {
    // Las dos ramas de `avanceDeCarbon` compiten con un `Math.max` y se cruzan en
    // `fuelEnergy = 15 · oxígeno`: el CALOR da 50 s/kg y la LLAMA da
    // `fuelDeOrigen / COMBUSTIBLE_POR_SEGUNDO` s/kg. Para todo lo que tiene menos
    // de 15 unidades por kilo manda la llama, y la llama termina ANTES.
    //
    // Está dicho en el comentario de `leyes.ts` y no está medido en ninguna parte:
    // el único barrido que toca las veintiséis pregunta si queda leña falsa.
    //
    // Se lo suelta SECO y a 950 °C para aislar la combustión: catorce de las
    // veintiséis nacen con humedad por encima de `HUMEDAD_QUE_APAGA`, así que
    // soltarlas como vienen mide la ley 11 y no la 3.
    const filas: string[] = []
    const enLos50: string[] = []
    let miradas = 0
    for (const s of SUSTANCIAS_SEMILLA) {
      const fe = s.perUnitMass.fuelEnergy ?? 0
      if (fe <= 0) continue
      // El carbón va aparte: no piroliza, así que la rama del calor no lo toca.
      if (s.perUnitMass.charred === 1) continue
      miradas++
      const a = arder(
        conPartes([{ substance: s.id, mass: 1, q: { moisture: 0 } }], { temperature: 950, moisture: 0 }),
        AL_AIRE,
        20,
        250,
      )
      const esperado = Math.min(50, fe / COMBUSTIBLE_POR_SEGUNDO)
      // Un hecho no se observa cuando ocurre sino en el primer tick posterior.
      expect([s.id, Math.abs(a.transmuta - esperado) <= 0.05]).toEqual([s.id, true])
      if (esperado === 50) enLos50.push(s.id)
      filas.push(
        `  ${s.id.padEnd(14)} fuel ${String(fe).padStart(5)} · transmuta ${a.transmuta.toFixed(2).padStart(7)} s · min(50, fuel/0,3) = ${esperado.toFixed(2).padStart(6)}`,
      )
    }
    expect(miradas).toBe(25)
    // SIETE de las veinticinco orgánicas llegan a los 50. El resto arde menos, y
    // la más corta —el hongo— arde QUINCE VECES menos por kilo que la madera.
    expect(enLos50).toEqual([
      'madera',
      'madera-verde',
      'madera-dura',
      'corteza',
      'junco',
      'hoja-seca',
      'grasa',
    ])
    log([
      '══ (1) LA DURACIÓN POR KILO, SUSTANCIA POR SUSTANCIA ═════════════════',
      ...filas,
      '',
      `  llegan a los 50 s/kg: ${String(enLos50.length)} de 25 (${enLos50.join(', ')})`,
      '  el resto arde entre 3,35 s/kg (hongo) y 46,70 (liana). «50 s por kilo» es',
      '  el TECHO de la ley, no la ley: la ley es `min(50, fuelEnergy/0,3)`.',
    ])
  }, 300_000)

  it('EL CARBÓN ES EL ÚNICO QUE SE VA PARA ARRIBA: 106,7 s por kilo, más del doble', () => {
    // El carbón nace con `charred` 1 y `pyrolysisAt` fuera de alcance, así que la
    // rama del CALOR —la que pone el techo de 50— nunca lo mira. Lo único que lo
    // corta es su propio tanque: 32 unidades por kilo a 0,3 por segundo.
    //
    // Importa por dos motivos y ninguno está medido en el árbol: es lo que la
    // técnica emblema del ADR II-0002 PRODUCE, y es la única fila del catálogo
    // donde «50 s por kilo» se queda corta por un factor de dos.
    const filas: string[] = []
    for (const m of [0.2, 1, 5]) {
      const dt = dtDeFrecuencia(20)
      let b = cuerpo('carbon', m, { temperature: 950 })
      let dura = Number.NaN
      for (let n = 1; n <= Math.round((250 * m) / dt); n++) {
        b = paso(b, AL_AIRE, F, dt).body
        if (Number.isNaN(dura) && qualityOf(b, 'fuelEnergy', F) === 0) dura = n / 20
      }
      expect([m, Math.abs(dura - (32 / COMBUSTIBLE_POR_SEGUNDO) * m) <= 0.06]).toEqual([m, true])
      // Y NO transmuta: sigue siendo carbón con el tanque en cero.
      expect(b.parts[0]?.substance).toBe('carbon')
      filas.push(
        `  ${String(m).padStart(4)} kg · se queda sin combustible a los ${dura.toFixed(2).padStart(8)} s · 50·m habría dado ${(50 * m).toFixed(2)}`,
      )
    }
    log([
      '══ (1 bis) EL CARBÓN, 106,7 s POR KILO ═══════════════════════════════',
      ...filas,
      '  2,13 veces la madera de la que salió, por kilo. No abre ningún ciclo —el',
      '  tizón se queda con 0,28 de la masa— pero el techo de 50 no lo alcanza.',
    ])
  }, 300_000)

  it.fails('SIGUE ABIERTO — «50 s por kilo» se sigue diciendo sin la sustancia adelante', () => {
    // POR QUÉ SIGUE ABIERTO: no es un bug del motor, es una promesa que se mide
    // sobre la única fila del catálogo donde vale y se escribe como si valiera
    // para todas. `packages/physics/tests/la-masa-decide-lo-que-arde.test.ts:127`
    // se llama «cincuenta segundos por kilo, en las nueve masas y a las cinco
    // frecuencias» y corre `arder('madera', …)` y nada más; el barrido de las 26
    // —la línea 221 del mismo archivo— nunca pregunta cuánto duran.
    //
    // QUÉ HARÍA FALTA: una de dos, y las dos son decisiones y no líneas.
    //   · o la promesa se reescribe como `min(50, fuelEnergy/0,3)` en el
    //     comentario de `TASA_CARBONIZACION` (`physics/src/leyes.ts:275`), en el
    //     título de aquel test y en el ADR II-0011 — y entonces esto se cierra
    //     midiendo lo que ya mide el (1) de acá;
    //   · o `COMBUSTIBLE_POR_SEGUNDO` se hace proporcional a `fuelDeOrigen` para
    //     que las veintiséis duren lo mismo por kilo, que es cambiar la física y
    //     borrar la diferencia entre un leño y una hoja.
    //
    // Lo que queda clavado mientras tanto es la promesa LITERAL, para que el día
    // que se elija cualquiera de las dos esto se caiga solo.
    for (const s of SUSTANCIAS_SEMILLA) {
      const fe = s.perUnitMass.fuelEnergy ?? 0
      if (fe <= 0 || s.perUnitMass.charred === 1) continue
      const a = arder(
        conPartes([{ substance: s.id, mass: 1, q: { moisture: 0 } }], { temperature: 950, moisture: 0 }),
        AL_AIRE,
        20,
        250,
      )
      expect([s.id, Math.abs(a.transmuta - 50) <= 0.11]).toEqual([s.id, true])
    }
  }, 300_000)
})

// ═══ (2) LAS MASAS QUE EL MUNDO SÍ TIENE, QUE EL BARRIDO NO TENÍA ════════════

describe('(2) el borde de abajo: la yesca del mundo cae debajo del barrido', () => {
  it('de 0,01 a 0,04 kg la duración sigue siendo 50·m, y lo que se mueve es el TICK y no la física', () => {
    // El barrido del tramo anterior arranca en 0,05 kg. El dios siembra
    // `hoja-seca` —la yesca— entre 0,01 y 0,08, o sea que la mitad de abajo de la
    // única sustancia con la que se enciende un fuego nunca se midió.
    //
    // La sospecha era una divergencia por frecuencia, porque el barrido crudo la
    // muestra: a 0,005 kg las cinco frecuencias dan 0,300 / 0,250 / 0,280 / 0,260
    // / 0,250 s, un 20% de dispersión. NO ES UNA DIVERGENCIA: es que a 10 Hz la
    // vida entera de ese cuerpo son dos ticks y medio, y un cruce sólo se observa
    // en el primer tick posterior. `ceil(0,25/0,1)·0,1 = 0,30` explica la fila
    // entera.
    //
    // La forma de decirlo sin el tick de por medio es comparar `charred` a un
    // MISMO instante, que es lo que hace este test: si la física dependiera de la
    // frecuencia, ahí se vería.
    const filas: string[] = []
    let peorRelativo = 0
    for (const m of [0.005, 0.01, 0.02, 0.04, 0.08]) {
      // Un instante que es múltiplo exacto del paso de las cinco: 0,2 s.
      const enUnQuinto = FRECUENCIAS_ADMISIBLES.map((hz) => {
        const dt = dtDeFrecuencia(hz)
        let b = cuerpo('madera', m, { temperature: 700 })
        for (let n = 1; n <= Math.round(0.2 * hz); n++) b = paso(b, AL_AIRE, F, dt).body
        return qualityOf(b, 'charred', F)
      })
      const min = Math.min(...enUnQuinto)
      const max = Math.max(...enUnQuinto)
      const rel = max > 0 ? (max - min) / max : 0
      if (rel > peorRelativo) peorRelativo = rel
      filas.push(
        `  ${String(m).padStart(6)} kg · charred a los 0,2 s: ${enUnQuinto.map((v) => v.toFixed(9).padStart(13)).join('')}`,
      )
    }
    // La misma trayectoria a las cinco, hasta el último bit que la suma permite.
    expect(peorRelativo).toBeLessThan(1e-9)

    // Y la duración sigue siendo 50·m, medida con la cota del TICK adentro y no
    // con un margen absoluto: `|medido − 50·m| ≤ un tick` es la afirmación
    // correcta, y el margen fijo de 0,11 s del barrido viejo es 22 veces más
    // flojo que eso en la masa más chica que el mundo siembra.
    const dur: string[] = []
    for (const m of [0.01, 0.02, 0.04, 0.08]) {
      for (const hz of FRECUENCIAS_ADMISIBLES) {
        const a = arder(cuerpo('madera', m), AL_AIRE, hz, 70 * m + 1)
        const cota = 1 / hz + 1e-9
        expect([m, hz, a.transmuta - 50 * m >= -1e-9 && a.transmuta - 50 * m <= cota]).toEqual([m, hz, true])
      }
      dur.push(
        `  ${String(m).padStart(5)} kg · ${FRECUENCIAS_ADMISIBLES.map((hz) => arder(cuerpo('madera', m), AL_AIRE, hz, 70 * m + 1).transmuta.toFixed(3).padStart(8)).join('')}   (50·m = ${(50 * m).toFixed(3)})`,
      )
    }
    log([
      '══ (2) LA YESCA, DEBAJO DEL BARRIDO ══════════════════════════════════',
      `  peor desvío relativo de \`charred\` a un instante común: ${peorRelativo.toExponential(2)}`,
      ...filas,
      '',
      `  y la duración, ${FRECUENCIAS_ADMISIBLES.join('/')} Hz:`,
      ...dur,
      '',
      '  NO HAY BORDE ACÁ. Lo que se ve en el barrido crudo es la cuantización del',
      '  tick, no la física: a 10 Hz un cuerpo de 0,01 kg vive cinco ticks.',
    ])
  }, 300_000)
})

// ═══ (3) LA PARTE QUE NO ARDE, ARDIENDO ══════════════════════════════════════

describe('(3) en un cuerpo de varias partes la masa mineral arde y desaparece', () => {
  it('la piedra de un cuerpo mixto se hace ceniza: 500 g de piedra terminan en 30', () => {
    // `pyrolysisAt` e `ignitionPoint` son INTENSIVAS: en un cuerpo de dos partes
    // salen del promedio pesado por masa. La piedra los declara en 900 (`NO_ARDE`)
    // y la madera en 280/300, así que la mezcla queda en el medio — y por debajo
    // de la meseta de 615 °C de la llama mientras la piedra no pase de la mitad.
    //
    // Y la ley 4 `parts.map`ea TODAS las partes al residuo. El comentario lo dice
    // —«dejar media rama sin quemar adentro de un tizón sería un cuerpo que
    // miente»— y para un cuerpo de una sola materia es cierto. Para uno mixto es
    // que la piedra se hace ceniza.
    const filas: string[] = []
    for (const fp of [0, 0.1, 0.25, 0.5, 0.52, 0.55]) {
      const b = conPartes(
        [
          { substance: 'madera', mass: 1 - fp, q: {} },
          { substance: 'piedra', mass: fp, q: {} },
        ],
        { temperature: 700 },
      )
      const a = arder(b, AL_AIRE, 20, 200)
      const masaFinal = a.cuerpo.parts.reduce((t, p) => t + p.mass, 0)
      filas.push(
        `  piedra ${(fp * 1000).toFixed(0).padStart(4)} g · ign ${qualityOf(b, 'ignitionPoint', F).toFixed(0).padStart(4)} · transmuta ${a.transmuta.toFixed(2).padStart(7)} s · 1000 g → ${(masaFinal * 1000).toFixed(1).padStart(7)} g`,
      )
    }
    // La mitad de piedra: transmuta, y de los 500 g de piedra quedan 30.
    const mitad = arder(
      conPartes(
        [
          { substance: 'madera', mass: 0.5, q: {} },
          { substance: 'piedra', mass: 0.5, q: {} },
        ],
        { temperature: 700 },
      ),
      AL_AIRE,
      20,
      200,
    )
    expect(mitad.transmuta).toBeCloseTo(30.05, 2)
    const partePiedra = mitad.cuerpo.parts[1] as Part
    expect(partePiedra.substance).toBe('residuo-mineral-de-madera')
    expect(partePiedra.mass).toBeCloseTo(0.03, 6)
    log([
      '══ (3) LA PIEDRA QUE ARDE ════════════════════════════════════════════',
      ...filas,
      '',
      '  el corte está donde el `ignitionPoint` promedio pasa los 615 °C de la',
      '  meseta: con más de ~52% de mineral el cuerpo no se sostiene y no pasa nada.',
      '  Por debajo, arde ENTERO — y arde más RÁPIDO cuanto más mineral tenga,',
      '  porque el mineral diluye `fuelDeOrigen` y ahí manda la rama de la llama.',
    ])
  }, 300_000)

  it.fails('SIGUE ABIERTO — el hacha de mango de madera y cabeza de pedernal se hace ceniza entera', () => {
    // POR QUÉ SIGUE ABIERTO: la ley 4 convierte TODAS las partes de un cuerpo en
    // el residuo de la parte dominante (`physics/src/leyes.ts:1381`), y para un
    // cuerpo de una sola materia eso es correcto. Para el cuerpo que este proyecto
    // existe para que la criatura arme —mango de madera, cabeza de piedra, atado
    // con liana— significa que dejarlo cerca del fuego lo destruye entero, cabeza
    // incluida, y que 300 g de pedernal terminan en 18 g de ceniza de MADERA.
    //
    // QUÉ HARÍA FALTA: que la ley 3 y la ley 4 corran POR PARTE y no por cuerpo —
    // que cada parte tenga su `charred`, su `fuelEnergy` y su umbral, y que la ley
    // 4 transmute sólo las partes que cruzaron el suyo. Es una decisión sobre el
    // contrato de `Lectura` (hoy es una lectura de CUERPO, `leyes.ts:460`) y sobre
    // qué es un cuerpo cuando la mitad se quemó y la otra mitad no, no una línea.
    //
    // Lo que queda clavado: lo que uno esperaría del hacha —que el pedernal siga
    // siendo pedernal y siga pesando lo que pesaba—.
    const hacha = conPartes(
      [
        { substance: 'madera', mass: 0.4, q: {} },
        { substance: 'pedernal', mass: 0.3, q: {} },
      ],
      { temperature: 700 },
    )
    const a = arder(hacha, AL_AIRE, 20, 120)
    const cabeza = a.cuerpo.parts[1] as Part
    expect(cabeza.substance).toBe('pedernal')
    expect(cabeza.mass).toBeCloseTo(0.3, 6)
  }, 300_000)
})

// ═══ (4) MOJADO: LA OTRA CONSTANTE INTENSIVA ═════════════════════════════════

describe('(4) secarse no depende de la masa, y por eso la lluvia está dada vuelta', () => {
  it('de moisture 0,9 a 0,45, a 300 °C fijos: 3,45 s con 0,05 kg y 1,85 s con 500', () => {
    // `SECADO_POR_GRADO` (`leyes.ts:378`) es por segundo y por grado, sin dividir
    // por nada. Es la MISMA forma que `TASA_CARBONIZACION` tenía antes de este
    // tramo, en la ley 11 en vez de en la 3.
    //
    // Se mide con la temperatura clavada a 300 °C cada paso, para aislar el secado
    // de lo que la ley 1 haga con la masa.
    const filas: string[] = []
    const medidos: number[] = []
    for (const m of [0.05, 0.2, 1, 5, 20, 50, 500]) {
      const dt = dtDeFrecuencia(20)
      let b = conPartes([{ substance: 'madera', mass: m, q: {} }], { temperature: 300, moisture: 0.9 })
      let seco = Number.NaN
      for (let n = 1; n <= 20 * 400; n++) {
        b = paso(b, AL_AIRE, F, dt).body
        b = { ...b, state: { ...b.state, temperature: 300 } }
        if (qualityOf(b, 'moisture', F) < 0.45) {
          seco = n / 20
          break
        }
      }
      medidos.push(seco)
      filas.push(`  ${String(m).padStart(5)} kg · ${seco.toFixed(2).padStart(6)} s`)
    }
    // Diez mil veces más masa y el secado se mueve MENOS DE DOS VECES — y para el
    // lado equivocado: el cuerpo grande se seca ANTES.
    const chico = medidos[0] as number
    const enorme = medidos[medidos.length - 1] as number
    expect(chico / enorme).toBeLessThan(2)
    expect(enorme).toBeLessThan(chico)
    log([
      '══ (4) EL SECADO NO MIRA LA MASA ═════════════════════════════════════',
      ...filas,
      `  10 000× de masa mueven el secado ${(chico / enorme).toFixed(2)}×, y para el otro lado.`,
    ])
  }, 300_000)

  it.fails('SIGUE ABIERTO — un leño de 20 kg EMPAPADO arde igual y uno de 1 kg húmedo no prende', () => {
    // POR QUÉ SIGUE ABIERTO: no hay una línea que arreglar, hay una constante que
    // decidir. `SECADO_POR_GRADO` es intensiva, así que lo que decide si un cuerpo
    // llega a secarse antes de enfriarse no es su humedad sino su INERCIA TÉRMICA
    // — y ésa sí crece con la masa. Resultado medido, soltando a 700 °C al aire:
    //
    //     masa      seco   w=0,44    w=0,5    w=0,7    w=0,9      w=1
    //      1 kg   50,00     50,00        —        —        —        —
    //     20 kg  1000,00   1000,00  1000,10  1000,65  1001,20  1001,50
    //
    // El leño de 20 kg empapado hasta el tope pierde 1,5 s de 1000 —el 0,15%— y el
    // de 1 kg a la mitad de eso no prende NUNCA. La lluvia protege la leña chica y
    // no le hace nada a la grande, que es al revés de lo que el mundo debería
    // enseñar y al revés de por qué existe `HUMEDAD_QUE_APAGA`.
    //
    // QUÉ HARÍA FALTA: la misma reparación que este tramo le hizo a
    // `TASA_CARBONIZACION`, en `leyCombustion`/`leyHumedad` de
    // `physics/src/leyes.ts:1106` — que el secado cueste proporcional al agua que
    // hay que evaporar, o sea `porPaso(SECADO_POR_GRADO, dt) / masa`. No se hace
    // acá porque mueve la ventana de cocción de las doce sustancias del ADR
    // II-0011 y la calibración entera de la ley 11, y eso es un ADR.
    //
    // Lo que queda clavado: que empapar un leño le cueste algo.
    const seco = arder(
      conPartes([{ substance: 'madera', mass: 20, q: {} }], { temperature: 700, moisture: 0 }),
      AL_AIRE,
      20,
      1300,
    ).transmuta
    const empapado = arder(
      conPartes([{ substance: 'madera', mass: 20, q: {} }], { temperature: 700, moisture: 1 }),
      AL_AIRE,
      20,
      1300,
    ).transmuta
    // Empapar hasta el tope tendría que costar más que el 1% del fuego.
    expect((empapado - seco) / seco).toBeGreaterThan(0.01)
  }, 300_000)
})

// ═══ (5) LO QUE SE VERIFICÓ Y NO SE ROMPIÓ ═══════════════════════════════════

describe('(5) la ley 4 y el tizón, después de la reparación', () => {
  it('carbón con tapa y ceniza sin tapa, a las cinco frecuencias, y la misma masa', () => {
    // La técnica emblema del ADR II-0002. Se mide con `fuente` en contacto —una
    // fogata al lado— porque sin ella un leño tapado no se sostiene: la meseta con
    // oxígeno 0,2 son 135 °C, muy por debajo de sus 300 de ignición. Ver el
    // archivo del mundo para lo que eso significa cuando la fogata también está
    // adentro de la celda tapada.
    const fuente = { potencia: 300.6, distancia: 0, montaje: 'contacto' as Montaje }
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const tapado = arder(cuerpo('madera', 1, { temperature: 15 }), { celda: CELDA_TAPADA, fuente }, hz, 200)
      const aire = arder(cuerpo('madera', 1), { celda: CELDA_AL_AIRE }, hz, 200)
      const st = tapado.cuerpo.parts[0]?.substance as string
      const sa = aire.cuerpo.parts[0]?.substance as string
      expect([hz, st]).toEqual([hz, 'residuo-carbonoso-de-madera'])
      expect([hz, sa]).toEqual([hz, 'residuo-mineral-de-madera'])
      // Y la masa que queda es la de la clase, no la de la frecuencia.
      expect([hz, Math.abs(qualityOf(tapado.cuerpo, 'mass', tapado.phys) - 0.28) < 1e-9]).toEqual([hz, true])
      expect([hz, Math.abs(qualityOf(aire.cuerpo, 'mass', aire.phys) - 0.06) < 1e-9]).toEqual([hz, true])
      filas.push(
        `  ${String(hz).padStart(3)} Hz · tapado ${tapado.transmuta.toFixed(2).padStart(7)} s → ${st} (${qualityOf(tapado.cuerpo, 'mass', tapado.phys).toFixed(4)} kg) · al aire ${aire.transmuta.toFixed(2).padStart(7)} s → ${sa} (${qualityOf(aire.cuerpo, 'mass', aire.phys).toFixed(4)} kg)`,
      )
    }
    log(['══ (5) LA LEY 4 A LAS CINCO ══════════════════════════════════════════', ...filas])
  }, 300_000)

  it('el tizón sigue sin cerrar un ciclo: 0,448× del combustible, y cero subidas', () => {
    // El ×1,6 de `RESIDUO_CONCENTRA_COMBUSTIBLE` sobre el 0,28 de la masa. Se
    // vuelve a medir acá porque `avanceDeCarbon` es lo que decide CUÁNDO se cruza
    // el umbral, y este tramo lo cambió: cruzar antes dejaría más tanque adentro
    // del tizón, y ahí el ciclo sí podría abrirse.
    const dt = dtDeFrecuencia(20)
    const e: Entorno = {
      celda: CELDA_TAPADA,
      fuente: { potencia: 300.6, distancia: 0, montaje: 'contacto' },
    }
    let b = cuerpo('madera', 1, { temperature: 15 })
    let phys = F
    let antes = Number.NaN
    let despues = Number.NaN
    let peorSubida = 0
    let total = qualityOf(b, 'fuelEnergy', phys) * qualityOf(b, 'mass', phys)
    for (let n = 1; n <= 20 * 400; n++) {
      const previo = total
      const r = paso(b, e, phys, dt)
      if (r.nueva !== undefined && Number.isNaN(antes)) antes = previo
      b = r.body
      if (r.nueva !== undefined) phys = conSustancia(phys, r.nueva)
      total = qualityOf(b, 'fuelEnergy', phys) * qualityOf(b, 'mass', phys)
      if (!Number.isNaN(antes) && Number.isNaN(despues)) despues = total
      if (total - previo > peorSubida) peorSubida = total - previo
    }
    expect(peorSubida).toBe(0)
    expect(despues / antes).toBeCloseTo(0.448, 3)
    expect(total).toBe(0)
    // Y la cuenta ENTERA del ciclo, que es la que importa y no se había escrito:
    // el tizón dura 106,7 s/kg contra los 50 de la madera, y pesa 0,28. El fuego
    // que sale del tizón dura `0,28 · 106,7 = 29,9 s` contra los 50 del leño.
    expect(0.28 * (32 / COMBUSTIBLE_POR_SEGUNDO)).toBeLessThan(CARBONIZADO_QUE_TRANSMUTA / 0.016)
    log([
      '══ (5 bis) EL TIZÓN NO CIERRA ════════════════════════════════════════',
      `  combustible al transmutar ${antes.toFixed(4)} → ${despues.toFixed(4)} (${(despues / antes).toFixed(4)}×) · subidas: 0`,
      `  y en SEGUNDOS DE FUEGO: un kilo de madera da 50,0 s y el tizón que deja da ${(0.28 * (32 / COMBUSTIBLE_POR_SEGUNDO)).toFixed(1)} s`,
    ])
  }, 300_000)
})
