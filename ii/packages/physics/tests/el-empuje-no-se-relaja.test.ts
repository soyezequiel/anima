// ─── EL ADR II-0010, MEDIDO SOBRE `paso()` ───────────────────────────────────
//
// «Mientras un `drive` está activo, ninguna ley que RELAJE esa cualidad la mueve
// en contra del empuje, en ese cuerpo.»
//
// Este archivo mide la REGLA, no el fuego. El fuego —la vara que prende, la
// yesca, el leño, el pescado— se mide en `world/tests/el-fuego.test.ts`, porque
// quien compone el `drive` con las leyes es el tick del mundo y no la física.
// Acá se arma la partición a mano, que es la forma más honesta de aislar lo que
// cambió: un paso de empuje, un `paso()`, y a ver qué queda.
//
// ─── LO QUE ESTABA ROTO, EN UNA CUENTA ──────────────────────────────────────
//
// `FRICCION` empuja `temperature` a 120 °C/s hacia 400 y su comentario promete
// «tres segundos de 15 a 375». La ley 1 relaja PROPORCIONAL AL HUECO, así que las
// dos juntas se estancan en un punto fijo muy por debajo de cualquier ignición.
// La cuenta del proceso suponía que nada lo relajaba; la ley se lo comía. Ver el
// ADR II-0010, y la CARNADA de acá abajo, que es esa cuenta escrita.
//
// ─── Y LO QUE CAMBIÓ CON EL ADR II-0011 ─────────────────────────────────────
//
// Dos cosas, y las dos se ven en los números de este archivo:
//
//   · la ley 1 se integra en FORMA CERRADA, así que la meseta de la carnada ya no
//     es la del Euler explícito (`15 + 12·heatCapacity − 120/hz`) sino
//     `15 − Δ + Δ/acople`. Las dos coinciden cuando el paso es chico y difieren
//     cuando es grande, que es justo donde el Euler mentía: a 10 Hz, 29,98
//     contra 23,40;
//   · **arder libera calor**, así que la vara ya no llega a 375 °C por la
//     fricción: llega porque a los 2,375 s cruza sus 300 de ignición y de ahí la
//     sube la llama. 2,40 s en las cinco frecuencias, contra los 3,00 que tarda
//     la fricción sola sobre algo que no puede prender.

import { describe, expect, it } from 'vitest'
import {
  acopleTermico,
  AL_AIRE,
  buildSeedPhysics,
  clampToRange,
  correr,
  dtDeFrecuencia,
  FRECUENCIAS_ADMISIBLES,
  paso,
  porPaso,
  qualityOf,
  T_AMBIENTE,
} from '../src/index.js'
import type { Body, Empuje, Entorno, Physics } from '../src/index.js'

const F: Physics = buildSeedPhysics()

/** La tasa y el techo de `FRICCION`, leídos del catálogo y no copiados. */
const FRICCION = F.processes.get('friccion')
const EMPUJE = FRICCION?.effects[0]
if (EMPUJE === undefined || EMPUJE.k !== 'drive') throw new Error('friccion cambió de forma')
const POR_SEGUNDO = EMPUJE.porSegundo
const TOWARD = EMPUJE.toward

const CALIENTE: readonly Empuje[] = [{ q: 'temperature', rumbo: 1 }]

function vara(masa: number, sustancia = 'madera', t = T_AMBIENTE): Body {
  return {
    id: 'v',
    form: 'vara',
    parts: [{ substance: sustancia, mass: masa, q: {} }],
    joints: [],
    state: { temperature: t },
  }
}

/**
 * LA PARTICIÓN, tal como la hace el tick del mundo: primero el empuje de la
 * intención, después las leyes. Es la misma cuenta que `aplicarEfectos` hace en
 * `world/src/step.ts` para un `drive` sin `poweredBy` —el pago de `stamina` es
 * del mundo y no de la física, y acá se lo idealiza a infinito a propósito: lo
 * que se mide es el TECHO TÉRMICO, no el económico—.
 */
function frotar(
  b0: Body,
  segundos: number,
  hz: number,
  entorno: Entorno = AL_AIRE,
  conEmpujes = true,
): { body: Body; pico: number; t375: number; pasos: number } {
  const dt = dtDeFrecuencia(hz)
  const e: Entorno = conEmpujes ? { ...entorno, empujes: CALIENTE } : entorno
  let b = b0
  let pico = qualityOf(b, 'temperature', F)
  let t375 = Number.NaN
  let enPasos = Number.NaN
  const pasos = Math.round(segundos / dt)
  for (let n = 1; n <= pasos; n++) {
    const t = qualityOf(b, 'temperature', F)
    const falta = TOWARD - t
    const empuje = porPaso(POR_SEGUNDO, dt)
    const delta = falta < empuje ? falta : empuje
    // Un empuje que no mueve nada no se anota, igual que en el mundo.
    const hayEmpuje = delta > 0
    b = delta > 0 ? { ...b, state: { ...b.state, temperature: clampToRange('temperature', t + delta) } } : b
    b = paso(b, hayEmpuje ? e : entorno, F, dt).body
    const ahora = qualityOf(b, 'temperature', F)
    if (ahora > pico) pico = ahora
    if (ahora >= 375 && Number.isNaN(t375)) {
      t375 = Math.round((n / hz) * 1e6) / 1e6
      enPasos = n
    }
  }
  return { body: b, pico, t375, pasos: enPasos }
}

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

// ─── EL CRITERIO ─────────────────────────────────────────────────────────────

describe('la ley 1 no pelea contra la mano que frota (ADR II-0010)', () => {
  it('lo que NO puede prender llega a 375 °C en 3,00 s exactos, a las cinco', () => {
    // La tasa de `FRICCION` sola, aislada: 120 grados por segundo, 15 + 120×3 =
    // 375. Se mide sobre HUESO —`ignitionPoint` 500, que el `toward` de 400 no
    // alcanza nunca— justamente para que la llama no se meta en el medio. Ni un
    // grado de calibración nueva: lo único que el ADR II-0010 cambió es que la
    // ley 1 dejó de comérselos.
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const r = frotar(vara(1, 'hueso'), 6, hz)
      expect([hz, qualityOf(r.body, 'emitsPower', F)]).toEqual([hz, 0])
      // La afirmación va en PASOS y no en segundos, y no es una comodidad: el
      // margen es UN TICK —el hecho no se observa cuando ocurre sino en el primer
      // paso posterior— y «un tick» en segundos es un double que a 50 Hz da
      // 0,020000000000000018 al restarlo. En pasos la cuenta es entera y exacta.
      // El paso 3·hz es el que la cuenta cerrada predice; el 3·hz+1 es la
      // acumulación de 150 sumas de 2,4 en IEEE-754, que llega a
      // 374,99999999999994 y necesita un paso más.
      expect([hz, r.pasos === 3 * hz || r.pasos === 3 * hz + 1]).toEqual([hz, true])
      filas.push(
        `  ${String(hz).padStart(3)} Hz → 375 °C a los ${r.t375.toFixed(3)} s  (paso ${String(r.pasos)} de ${String(3 * hz)} que predice la cuenta)`,
      )
    }
    log(['══ LA TASA DE FRICCION, SOLA ═════════════════════════════════════════', ...filas])
  })

  it('y la vara de madera llega ANTES, a los 2,40 s, porque en el camino PRENDE', () => {
    // El ADR II-0011 en una línea. La fricción cruza los 300 de ignición de lo
    // leñoso a los 2,375 s —(300 − 15)/120— y de ahí la temperatura ya no la pone
    // la mano: la pone la llama, que empuja hacia los 615 °C de régimen. Los 375
    // llegan en el MISMO tick en las cinco frecuencias, y ninguna de las cinco
    // tarda los 3,00 s que tardaba antes.
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const r = frotar(vara(1), 6, hz)
      expect([hz, r.t375]).toEqual([hz, 2.4])
      expect([hz, r.pasos]).toEqual([hz, Math.round(2.4 * hz)])
      // Y sigue encendida al final de los 6 s: no es un pico de un tick.
      expect(qualityOf(r.body, 'emitsPower', F)).toBeGreaterThan(0)
      filas.push(
        `  ${String(hz).padStart(3)} Hz → 375 °C a los ${r.t375.toFixed(3)} s (paso ${String(r.pasos)}) · a los 6 s: ${qualityOf(r.body, 'temperature', F).toFixed(2)} °C`,
      )
    }
    log([
      '══ Y CON LLAMA LLEGA ANTES (ADR II-0011) ═════════════════════════',
      '  la ignición de lo leñoso a los 2,375 s; los 375 °C, un tick después',
      ...filas,
    ])
  })

  it('CARNADA · sin la regla la misma vara se estanca en la meseta que la cuenta predice', () => {
    // Si alguien revierte `pelea`, esto es lo que vuelve. La cuenta cerrada
    // del ADR está escrita acá para que el número no sea un misterio, y se
    // verifica contra la simulación.
    //
    // Desde el ADR II-0011 la cuenta es OTRA, porque la ley 1 dejó de ser un
    // Euler explícito. Un paso es: empujar `Δ = 120/hz` y después relajar cerrando
    // la fracción `acople` del hueco al ambiente. El punto fijo de eso es
    // `T* = 15 − Δ + Δ/acople`. La vieja `15 + 12·heatCapacity − 120/hz` es su
    // primer término cuando el paso es chico; a 10 Hz predecía 23,40 y la meseta
    // de verdad es 29,98, o sea que el Euler la subestimaba un 21%.
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const sin = frotar(vara(1), 600, hz, AL_AIRE, false)
      const cap = qualityOf(vara(1), 'heatCapacity', F)
      const delta = POR_SEGUNDO / hz
      const predicho = T_AMBIENTE - delta + delta / acopleTermico(cap, dtDeFrecuencia(hz))
      expect([hz, Number.isNaN(sin.t375)]).toEqual([hz, true])
      expect(sin.pico).toBeCloseTo(predicho, 6)
      filas.push(
        `  ${String(hz).padStart(3)} Hz → meseta ${sin.pico.toFixed(2)} °C  (predicha ${predicho.toFixed(2)})`,
      )
    }
    // Y las tres del catálogo que el ADR mide, con su punto de ignición al lado.
    const tabla: string[] = []
    for (const [s, ign] of [
      ['madera', 300],
      ['corteza', 250],
      ['hoja', 180],
    ] as const) {
      const sin = frotar(vara(2, s), 600, 20, AL_AIRE, false)
      expect(sin.pico).toBeLessThan(ign)
      tabla.push(`  ${s.padEnd(8)} 2 kg → ${sin.pico.toFixed(2)} °C   (ignición ${String(ign)})`)
    }
    log([
      '══ LA CARNADA · lo que vuelve si se revierte `pelea` ═══════════════════',
      ...filas,
      '  y ninguna sustancia del catálogo alcanza su ignición:',
      ...tabla,
    ])
  })

  it('NO se suspende de más: un cuerpo frotado ADENTRO del fuego se sigue calentando', () => {
    // Es la mitad de la decisión 2 del ADR. La suspensión es del SENTIDO, no de
    // la ley: si el entorno empuja para el mismo lado que la mano, la ley 1 sigue
    // sumando. Suspender la ley entera dejaría frío al que está en la fogata.
    const fuego: Entorno = {
      celda: { oxygen: 1, wet: 0, ambiente: T_AMBIENTE },
      fuente: { potencia: 1000, distancia: 0, montaje: 'contacto' },
    }
    // Un solo paso, desde el ambiente, con y sin empuje: el aporte de la fuente
    // tiene que ser el MISMO, porque va para arriba.
    const dt = dtDeFrecuencia(20)
    const b = vara(1)
    const conMano = paso(b, { ...fuego, empujes: CALIENTE }, F, dt).body
    const sinMano = paso(b, fuego, F, dt).body
    expect(qualityOf(conMano, 'temperature', F)).toBe(qualityOf(sinMano, 'temperature', F))
    expect(qualityOf(conMano, 'temperature', F)).toBeGreaterThan(T_AMBIENTE)
    // Y al aire, donde el aporte va para ABAJO, sí son distintos.
    const caliente = { ...vara(1), state: { temperature: 200 } }
    const q = (x: Body): number => qualityOf(x, 'temperature', F)
    expect(q(paso(caliente, { ...AL_AIRE, empujes: CALIENTE }, F, dt).body)).toBe(200)
    expect(q(paso(caliente, AL_AIRE, F, dt).body)).toBeLessThan(200)
  })

  it('el rumbo importa: un empuje HACIA ABAJO no impide que el ambiente baje', () => {
    // El espejo del test de arriba. Si `pelea` mirara sólo «hay un empuje» y
    // no su rumbo, esto quedaría congelado.
    const dt = dtDeFrecuencia(20)
    const caliente = { ...vara(1), state: { temperature: 200 } }
    const frio: readonly Empuje[] = [{ q: 'temperature', rumbo: -1 }]
    const q = (x: Body): number => qualityOf(x, 'temperature', F)
    expect(q(paso(caliente, { ...AL_AIRE, empujes: frio }, F, dt).body)).toBeLessThan(200)
    expect(q(paso(caliente, { ...AL_AIRE, empujes: frio }, F, dt).body)).toBe(
      q(paso(caliente, AL_AIRE, F, dt).body),
    )
  })

  it('NO se suspende ninguna ley que TRANSFORME: la vara frotada PRENDE y se carboniza', () => {
    // La otra mitad de la decisión 2, y es todo el objetivo del ADR: la ley 3
    // corre entera mientras la mano empuja, o el fuego no existiría.
    const r = frotar(vara(1), 6, 20)
    expect(qualityOf(r.body, 'temperature', F)).toBeGreaterThanOrEqual(300)
    expect(qualityOf(r.body, 'emitsPower', F)).toBeGreaterThan(0)
    expect(qualityOf(r.body, 'charred', F)).toBeGreaterThan(0)
    log([
      '══ Y PRENDE ═══════════════════════════════════════════════════════════',
      `  a los 6 s: ${qualityOf(r.body, 'temperature', F).toFixed(1)} °C · emitsPower ${qualityOf(r.body, 'emitsPower', F).toFixed(1)} · charred ${qualityOf(r.body, 'charred', F).toFixed(3)}`,
    ])
  })

  it('la regla es GENERAL: la ley 11 tampoco relaja contra un empuje sobre `moisture`', () => {
    // No es un caso de la ley 1. Un `drive` sobre `moisture` —mojar un cuero—
    // tiene el mismo bug con la ley 11, y por eso la regla pasa por un solo
    // lugar. Acá se mide sin ningún proceso: el empuje se declara y se mira qué
    // hace la ley.
    const dt = dtDeFrecuencia(20)
    const seco: Body = {
      id: 'c',
      form: 'filete',
      parts: [{ substance: 'cuero', mass: 1, q: {} }],
      joints: [],
      state: { moisture: 0.5, temperature: T_AMBIENTE },
    }
    const enElAgua: Entorno = { celda: { oxygen: 1, wet: 1, ambiente: T_AMBIENTE } }
    const q = (x: Body): number => qualityOf(x, 'moisture', F)
    // Al aire (celda seca) la ley 11 le baja la humedad; con la mano empujando
    // hacia arriba, no.
    expect(q(paso(seco, AL_AIRE, F, dt).body)).toBeLessThan(0.5)
    const mojando: readonly Empuje[] = [{ q: 'moisture', rumbo: 1 }]
    expect(q(paso(seco, { ...AL_AIRE, empujes: mojando }, F, dt).body)).toBe(0.5)
    // Y en la celda mojada, donde la ley empuja para el MISMO lado, la mano no
    // cambia nada: sigue subiendo lo que subía.
    expect(q(paso(seco, { ...enElAgua, empujes: mojando }, F, dt).body)).toBe(
      q(paso(seco, enElAgua, F, dt).body),
    )
    // Y un empuje sobre OTRA cualidad no toca la humedad.
    expect(q(paso(seco, { ...AL_AIRE, empujes: CALIENTE }, F, dt).body)).toBe(
      q(paso(seco, AL_AIRE, F, dt).body),
    )
  })

  it('un `Entorno` sin `empujes` da EXACTAMENTE los mismos bits que antes del ADR', () => {
    // Es lo que sostiene que ni la huella de conducta de este paquete ni el
    // barrido térmico se muevan: `pelea` sale `false` en su primera línea y la
    // ley escribe la MISMA expresión que escribía. Se verifica contra
    // `empujes: []`, que recorre el bucle y no encuentra nada — si el camino
    // corto y el largo difirieran, el atajo estaría cambiando conducta.
    //
    // Ya pasó una vez, y por eso `pelea` es un predicado y no una función que
    // recorta el `delta`: con la versión que devolvía el número, la ley 11
    // quedaba escrita como `moisture + f(a − b)` en vez de `moisture + a − b`, la
    // asociatividad de IEEE-754 no vale, y la huella de `huella-de-conducta.test.ts`
    // se movió de 3705094564 a 139010573 sin que ninguna conducta cambiara.
    const dt = dtDeFrecuencia(20)
    for (const t of [0, 15, 63, 200, 400]) {
      for (const s of ['madera', 'carne', 'hoja-seca', 'piedra']) {
        const b = vara(1.5, s, t)
        const a = paso(b, AL_AIRE, F, dt).body
        const c = paso(b, { ...AL_AIRE, empujes: [] }, F, dt).body
        expect([s, t, qualityOf(a, 'temperature', F)]).toEqual([s, t, qualityOf(c, 'temperature', F)])
        expect([s, t, qualityOf(a, 'moisture', F)]).toEqual([s, t, qualityOf(c, 'moisture', F)])
        expect([s, t, qualityOf(a, 'charred', F)]).toEqual([s, t, qualityOf(c, 'charred', F)])
      }
    }
  })

  it('mantener no es gratis: al llegar a `toward` el empuje se apaga y la ley vuelve', () => {
    // La consecuencia anotada en el ADR. Un `drive` que ya no mueve nada no se
    // anota, así que la ley 1 relaja a fondo y hay que volver a subir. Si esto
    // NO pasara, frotar sería una batería: temperatura sostenida a costo cero.
    //
    // Se mide sobre algo QUE NO ARDE —piedra, con el punto de ignición fuera de
    // alcance— porque desde el ADR II-0011 una vara de madera a 400 °C no baja:
    // sube, y eso es lo contrario de lo que este test afirma. Los dos hechos son
    // ciertos y son distintos; el de abajo los separa.
    const dt = dtDeFrecuencia(20)
    const aTope = { ...vara(1, 'piedra'), state: { temperature: TOWARD } }
    // Con el empuje saturado (delta = 0, o sea sin anotar) la ley 1 relaja.
    const despues = paso(aTope, AL_AIRE, F, dt).body
    expect(qualityOf(despues, 'temperature', F)).toBeLessThan(TOWARD)
  })

  it('ADR II-0011 · y la que SÍ arde no vuelve: la mano se va y el fuego se queda', () => {
    // El otro lado del test de arriba, y el criterio (f) del ADR II-0011: hasta
    // este ADR `friccion` prometía `establishes: ['temperature>=400']` y ese hecho
    // vivía UN TICK. Ahora la vara encendida se sostiene sola.
    const dt = dtDeFrecuencia(20)
    const aTope = { ...vara(1), state: { temperature: TOWARD } }
    const unTick = paso(aTope, AL_AIRE, F, dt).body
    expect(qualityOf(unTick, 'temperature', F)).toBeGreaterThan(TOWARD)
    // Y treinta segundos después, sin nadie tocándola, sigue arriba de 400.
    const largo = correr(aTope, AL_AIRE, F, dt, 30)
    expect(qualityOf(largo.body, 'temperature', largo.phys)).toBeGreaterThan(TOWARD)
    expect(qualityOf(largo.body, 'emitsPower', largo.phys)).toBeGreaterThan(0)
    log([
      '══ EL FUEGO SOBREVIVE A LA MANO (ADR II-0011) ═════════════════════',
      `  vara de madera de 1 kg soltada a ${String(TOWARD)} °C, al aire, sin nadie:`,
      `    un tick después ...... ${qualityOf(unTick, 'temperature', F).toFixed(2)} °C`,
      `    treinta segundos ..... ${qualityOf(largo.body, 'temperature', largo.phys).toFixed(2)} °C · emitsPower ${qualityOf(largo.body, 'emitsPower', largo.phys).toFixed(1)}`,
    ])
  })
})
