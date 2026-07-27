// ─── EL FUEGO, MEDIDO EN EL MUNDO ENTERO ─────────────────────────────────────
//
// El ADR II-0010 («frotar no relaja») se mide sobre `paso()` en
// `physics/tests/el-empuje-no-se-relaja.test.ts`. Acá se mide lo que de verdad
// importa, que es otra cosa: **la criatura, con dos palos en la mano, enciende un
// fuego y cocina**. Con el tick del mundo adentro —las intenciones primero, las
// leyes después, el metabolismo cobrando— y con el arnés de invariantes puesto
// en todos los ticks, porque una cadena que enciende violando la conservación no
// enciende nada.
//
// ─── CÓMO SE LEE ────────────────────────────────────────────────────────────
//
//   · `it(...)`             → la promesa se cumple, con su número medido.
//   · `it(... documentado)` → un número que hoy es así; el cuerpo lo clava.
//   · `it.fails(...)`       → HUECO ABIERTO, con su «POR QUÉ SIGUE ABIERTO».
//
// ─── EL VEREDICTO, EN DOS LÍNEAS ────────────────────────────────────────────
//
// ENCIENDE: la vara pasa sus 300 °C a los 2,40 s, la yesca sus 180 a los 2,70 y
// el leño sus 300 a los 2,95. Nadie escribió «encender» en ningún lado — es el
// `step(temperature ≥ ignitionPoint)` de `emitsPower` (ADR II-0001). El pescado
// sobre la parrilla sube de `digestibility` 0,380 a 0,513.
//
// Y NO DURA: el fuego se apaga con la mano que lo hizo. Un cuerpo que arde no es
// fuente de calor de sí mismo, así que la ley 1 lo relaja hacia el ambiente como
// a cualquier otro, y una madera de 0,2 kg a 700 °C cae por debajo de su ignición
// EN UN TICK. Está medido abajo, con su `it.fails`.

import { describe, expect, it } from 'vitest'
import { dtDeFrecuencia, FRECUENCIAS_ADMISIBLES, qualityOf } from '@anima/physics'
import type { QualityId } from '@anima/physics'

import { COSTO_VIVIR_POR_SEGUNDO, stepWorld } from '../src/step.js'
import type { WorldBody, WorldState } from '../src/step.js'
import { apply } from '../src/intent.js'
import { revisarInvariantes } from '../src/invariants.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

/** La eficiencia del `poweredBy` de `friccion`, leída del catálogo y no copiada. */
function eficienciaDeFrotar(w: WorldState): number {
  const e = w.phys.processes.get('friccion')?.effects[0]
  if (e === undefined || e.k !== 'drive' || e.poweredBy === undefined) {
    throw new Error('friccion cambió de forma')
  }
  return e.poweredBy.efficiency
}

// ─── EL BANCO: una criatura con dos varas ────────────────────────────────────

/**
 * Las varas nacen A TEMPERATURA AMBIENTE y eso no es decoración: un cuerpo sin
 * `temperature` escrita arranca en 0 °C, y el primer tick se le va en llegar a
 * los 15 del ambiente. Medido, ese arranque corre el hito 0,1 s a 10 Hz — o sea
 * que el banco estaría midiendo el frío inicial y no la tasa de la fricción.
 */
function elBanco(masa: number, hz: number, stamina = 1000): WorldState {
  return mundo({
    hz,
    bodies: [
      enElPiso(criatura('dina', stamina), EN(0, 0)),
      enLaMano(cuerpo('va', 'madera', masa, { temperature: 15 }), EN(0, 0), 'dina'),
      enLaMano(cuerpo('vb', 'madera', masa, { temperature: 15 }), EN(0, 0), 'dina'),
    ],
    actors: [actor('dina', { holding: ['va', 'vb'], capacity: 3 })],
  })
}

const ROLES_DE_FROTAR = [
  { name: 'a', body: 'va' },
  { name: 'b', body: 'vb' },
  { name: 'actor', body: 'dina-cuerpo' },
]

interface Frotada {
  /** Segundos de mundo hasta los 375 °C. `NaN` si no llegó. */
  readonly segundos: number
  /** El mismo hito en PASOS, que es lo único exacto. */
  readonly pasos: number
  readonly pico: number
  /** Lo que le costó de `stamina`, costo de vivir incluido. */
  readonly costo: number
  readonly violaciones: readonly string[]
}

/** Frotar sin parar hasta llegar a 375 °C o hasta que no dé más. */
function frotarHasta375(masa: number, hz: number, techo = 12): Frotada {
  let w = elBanco(masa, hz)
  const dt = dtDeFrecuencia(hz)
  const violaciones: string[] = []
  const s0 = leer(w, 'dina-cuerpo', 'stamina')
  let pico = 0
  for (let n = 1; n <= Math.round(techo / dt); n++) {
    const i = apply({ by: 'dina', seq: n }, w.phys, 'friccion', ROLES_DE_FROTAR)
    const antes = w
    const r = stepWorld(w, i === undefined ? [] : [i])
    w = r.state
    for (const v of revisarInvariantes(antes, w, r.events)) violaciones.push(`t=${String(n / hz)} ${v.k}`)
    const grados = leer(w, 'va', 'temperature')
    if (grados > pico) pico = grados
    if (grados >= 375) {
      return {
        segundos: Math.round((n / hz) * 1e6) / 1e6,
        pasos: n,
        pico,
        costo: s0 - leer(w, 'dina-cuerpo', 'stamina'),
        violaciones,
      }
    }
  }
  return {
    segundos: Number.NaN,
    pasos: Number.NaN,
    pico,
    costo: s0 - leer(w, 'dina-cuerpo', 'stamina'),
    violaciones,
  }
}

function leer(w: WorldState, id: string, q: QualityId): number {
  const b = w.bodies.get(id)
  return b === undefined ? Number.NaN : qualityOf(b.body, q, w.phys)
}

// ─── (a) LA TASA ─────────────────────────────────────────────────────────────

describe('frotar lleva la vara a 375 °C en tres segundos, a cualquier frecuencia', () => {
  it('las cinco frecuencias admisibles, en el mundo entero', () => {
    // Es lo que el comentario de `FRICCION` promete desde que se escribió —«TRES
    // SEGUNDOS llevan la madera de 15 a 375 °C»— y lo que hasta el ADR II-0010 no
    // pasaba: la ley 1 relajaba proporcional al hueco y las dos se estancaban en
    // 29,40 °C para esta misma vara.
    //
    // La afirmación va en PASOS y no en segundos. El margen es UN TICK —un hecho
    // no se observa cuando ocurre sino en el primer paso posterior— y «un tick»
    // en segundos es un double: a 50 Hz, `3,02 − 3` da 0,020000000000000018 y una
    // comparación honesta contra 0,02 falla por el último bit. En pasos la cuenta
    // es entera. El paso 3·hz es el que la cuenta cerrada predice; el 3·hz+1 sale
    // de acumular 150 sumas de 2,4 en IEEE-754, que llega a 374,99999999999994.
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const r = frotarHasta375(0.2, hz)
      expect([hz, r.violaciones]).toEqual([hz, []])
      expect([hz, r.pasos === 3 * hz || r.pasos === 3 * hz + 1]).toEqual([hz, true])
      filas.push(
        `  ${String(hz).padStart(3)} Hz → 375 °C a los ${r.segundos.toFixed(3)} s` +
          `  (paso ${String(r.pasos)} de ${String(3 * hz)})   costó ${r.costo.toFixed(2)} de stamina`,
      )
    }
    log([
      '══ (a) FROTAR LLEGA, EN EL MUNDO ══════════════════════════════════════',
      '  vara de madera de 0,2 kg, criatura con el tanque a tope',
      ...filas,
    ])
  })

  it('y el número no depende de la masa: lo que depende de la masa es el PRECIO', () => {
    // La tasa es 120 °C por segundo y punto. Lo que la masa mueve es cuánta
    // `stamina` cuesta cada grado, porque `heatCapacity = mass × specificHeat` es
    // EXTENSIVA. Ver la tabla de (b).
    for (const m of [0.2, 0.4, 0.55]) {
      const r = frotarHasta375(m, 20)
      expect([m, r.pasos]).toEqual([m, 60])
    }
  })
})

// ─── (b) EL PRECIO ───────────────────────────────────────────────────────────

describe('encender se paga por MASA, y por eso se enciende con yesca', () => {
  it('el costo medido es `heatCapacity × ΔT / eficiencia`, y la tabla', () => {
    // `heatCapacity` es EXTENSIVA, así que el precio de subir un cuerpo ΔT grados
    // es `heatCapacity × ΔT` de energía y `heatCapacity × ΔT / 0,35` de `stamina`.
    // Con un tanque de arranque de 500 y un techo de catálogo de 1000, eso separa
    // lo que se puede encender de lo que no — sin que ninguna regla diga «la
    // yesca prende y el leño no».
    const w = elBanco(1, 20)
    const efic = eficienciaDeFrotar(w)
    expect(efic).toBe(0.35)

    const filas: string[] = []
    const esperado: number[] = []
    for (const [s, m, ign] of [
      ['hoja-seca', 0.2, 180],
      ['madera', 0.2, 300],
      ['madera', 1, 300],
      ['madera', 2, 300],
    ] as const) {
      const cap = qualityOf(cuerpo('x', s, m), 'heatCapacity', w.phys)
      const costo = (cap * (ign - 15)) / efic
      esperado.push(Number(costo.toFixed(2)))
      filas.push(
        `  ${s.padEnd(10)} ${String(m).padStart(4)} kg → ΔT ${String(ign - 15)} · heatCapacity ${cap.toFixed(2)} → ${costo.toFixed(1)} de stamina`,
      )
    }
    // Los cuatro números de la tabla del ADR II-0010, clavados.
    expect(esperado).toEqual([141.43, 276.86, 1384.29, 2768.57])

    // Y MEDIDO EN EL MUNDO, no sólo despejado: lo que la criatura gasta de verdad
    // en llevar la vara a 375 °C es el precio térmico más lo que cuesta estar viva
    // los tres segundos que tarda. Los dos sumandos, ninguno más.
    const medidas: string[] = []
    for (const m of [0.2, 0.4, 0.5, 0.55]) {
      const r = frotarHasta375(m, 20)
      const termico = (m * 1.7 * (375 - 15)) / efic
      const vivir = 3 * COSTO_VIVIR_POR_SEGUNDO
      expect([m, Number(r.costo.toFixed(4))]).toEqual([m, Number((termico + vivir).toFixed(4))])
      medidas.push(
        `  madera ${String(m).padStart(4)} kg → 375 °C cuesta ${r.costo.toFixed(2)}` +
          `  (${termico.toFixed(2)} de calor + ${vivir.toFixed(2)} de vivir)`,
      )
    }
    // Y a los 0,6 kg ya no alcanza: el tanque tiene techo 1000.
    const noLlega = frotarHasta375(0.6, 20)
    expect(Number.isNaN(noLlega.pasos)).toBe(true)
    expect(noLlega.pico).toBeLessThan(375)
    medidas.push(
      `  madera  0,6 kg → NO LLEGA: se queda en ${noLlega.pico.toFixed(2)} °C con el tanque vacío`,
    )
    log([
      '══ (b) EL PRECIO DE ENCENDER, POR MASA ════════════════════════════════',
      '  costo despejado hasta el punto de ignición de cada sustancia:',
      ...filas,
      '  costo MEDIDO en el mundo hasta los 375 °C:',
      ...medidas,
    ])
  })

  it('documentado · los «48 de stamina» del comentario de `FRICCION` no son reproducibles', () => {
    // El comentario decía «se comen 48 de `stamina`». Con la cuenta que el mundo
    // cobra hoy —`heatCapacity × ΔT / 0,35`— 48 corresponden a una vara de 27
    // gramos. El número es anterior a que `heatCapacity` entrara en el precio.
    // Queda medido acá para que nadie lo busque de nuevo.
    const w = elBanco(1, 20)
    const masaQueCostaria48 = (48 * 0.35) / (1.7 * 360)
    expect(masaQueCostaria48).toBeLessThan(0.03)
    // La vara de 1 kg del comentario cuesta 1748,57, o sea 1,75 tanques llenos.
    const deVerdad = (qualityOf(cuerpo('x', 'madera', 1), 'heatCapacity', w.phys) * 360) / 0.35
    expect(Number(deVerdad.toFixed(2))).toBe(1748.57)
    log([
      '══ LOS 48 DEL COMENTARIO ══════════════════════════════════════════════',
      `  48 de stamina alcanzan para una vara de ${(masaQueCostaria48 * 1000).toFixed(1)} gramos.`,
      `  La de 1 kg que el comentario nombra cuesta ${deVerdad.toFixed(2)}, o sea 1,75 tanques.`,
    ])
  })
})

// ─── (c) LA CADENA: yesca → leño → cocinar ───────────────────────────────────

/**
 * EL MUNDO DE LA CADENA, y por qué está armado así.
 *
 * `friccion` pide `arrangement: held`, o sea que las dos varas están en las manos
 * de la criatura y por lo tanto en SU celda. Y `montajeDe` sólo da `contacto`
 * —la exposición 0,6, la única con la que una llama chica alcanza a encender algo—
 * a lo que se APOYA o TAPA a la fuente. Así que la yesca tiene que estar tapando
 * la vara encendida, y eso la pone en la celda de la criatura.
 *
 * Una celda admite UNA SOLA PILA de sólidos (`invariants.ts`, `revisarEspacio`),
 * así que la yesca cuelga de la criatura (`supportedBy`) y tapa a la vara
 * (`covering`): la pila tiene una sola raíz y el arnés no se queja. No es un
 * truco para pasar el invariante — es la única geometría legal en la que una mano
 * que frota puede prender algo, y que sea la única es información.
 *
 * El pescado va sobre una piedra y no sobre el leño, para que su montaje sea
 * `parrilla` (0,25) y no `contacto` (0,6): en contacto directo con un leño
 * encendido el equilibrio da 375 °C, que está arriba de los 260 en que el pescado
 * se piroliza. La parrilla no es un objeto con nombre: es cualquier cosa apoyada
 * sobre algo que está en la celda del fuego.
 */
function elMundoDeLaCadena(hz: number): WorldState {
  const bodies: readonly WorldBody[] = [
    enElPiso(criatura('dina', 1000), EN(0, 0)),
    enLaMano(cuerpo('va', 'madera', 0.5, { temperature: 15 }), EN(0, 0), 'dina'),
    enLaMano(cuerpo('vb', 'madera', 0.5, { temperature: 15 }), EN(0, 0), 'dina'),
    // La yesca: hoja seca, el `ignitionPoint` más bajo de las treinta (180).
    { body: cuerpo('yesca', 'hoja-seca', 1), at: EN(0, 0), supportedBy: 'dina-cuerpo', covering: 'va' },
    { body: cuerpo('leno', 'madera', 1), at: EN(0, 0), supportedBy: 'yesca' },
    { body: cuerpo('parrilla', 'piedra', 0.5), at: EN(0, 0), supportedBy: 'leno' },
    { body: { ...cuerpo('pez', 'pescado', 1), form: 'filete' }, at: EN(0, 0), supportedBy: 'parrilla' },
  ]
  return mundo({ hz, bodies, actors: [actor('dina', { holding: ['va', 'vb'], capacity: 3 })] })
}

interface Cadena {
  readonly hitos: ReadonlyMap<string, number>
  readonly digestibilidad: number
  readonly violaciones: readonly string[]
  readonly murioEn: number
}

function correrLaCadena(hz: number, techo = 12): Cadena {
  let w = elMundoDeLaCadena(hz)
  const dt = dtDeFrecuencia(hz)
  const hitos = new Map<string, number>()
  const violaciones: string[] = []
  let digestibilidad = 0
  let murioEn = Number.NaN
  for (let n = 1; n <= Math.round(techo / dt); n++) {
    const i = apply({ by: 'dina', seq: n }, w.phys, 'friccion', ROLES_DE_FROTAR)
    const antes = w
    const r = stepWorld(w, i === undefined ? [] : [i])
    w = r.state
    for (const v of revisarInvariantes(antes, w, r.events)) violaciones.push(`t=${String(n / hz)} ${v.k}`)
    if (r.events.some((e) => e.k === 'murio' && e.por === 'hambre') && Number.isNaN(murioEn)) {
      murioEn = Math.round((n / hz) * 1e6) / 1e6
    }
    const t = Math.round((n / hz) * 1e6) / 1e6
    const anotar = (k: string, ok: boolean): void => {
      if (ok && !hitos.has(k)) hitos.set(k, t)
    }
    anotar('vara', leer(w, 'va', 'temperature') >= 300)
    anotar('yesca', leer(w, 'yesca', 'temperature') >= 180)
    anotar('leno', leer(w, 'leno', 'temperature') >= 300)
    const d = leer(w, 'pez', 'digestibility')
    if (d > digestibilidad) digestibilidad = d
  }
  return { hitos, digestibilidad, violaciones, murioEn }
}

describe('la cadena: la vara prende la yesca, la yesca prende el leño, el leño cocina', () => {
  it('los tres eslabones encienden, y el mundo no viola ningún invariante', () => {
    const c = correrLaCadena(20)
    expect(c.violaciones).toEqual([])
    // Los tres, en orden y adentro del primer tanque de `stamina`.
    for (const k of ['vara', 'yesca', 'leno']) {
      expect([k, c.hitos.has(k)], `${k} no encendió`).toEqual([k, true])
    }
    const vara = c.hitos.get('vara') as number
    const yesca = c.hitos.get('yesca') as number
    const leno = c.hitos.get('leno') as number
    expect(vara).toBeLessThan(yesca)
    expect(yesca).toBeLessThan(leno)
    // La vara pasa sus 300 °C cuando la cuenta dice: (300 − 15)/120 = 2,375 s,
    // redondeado al tick de 0,05.
    expect(vara).toBeCloseTo(2.4, 6)
    // Y el pescado se cocina: sube de su 0,38 crudo.
    expect(c.digestibilidad).toBeGreaterThan(0.38)
    log([
      '══ (c) LA CADENA ══════════════════════════════════════════════════════',
      `  la vara de 0,5 kg pasa sus 300 °C y PRENDE ....... ${vara.toFixed(2)} s`,
      `  la yesca pasa sus 180 °C y PRENDE ................ ${yesca.toFixed(2)} s`,
      `  el leño de 1 kg pasa sus 300 °C y PRENDE ......... ${leno.toFixed(2)} s`,
      `  el pescado sobre la parrilla llega a digestibility ${c.digestibilidad.toFixed(3)} (crudo: 0,380)`,
      `  y la criatura se muere de hambre a los ........... ${c.murioEn.toFixed(2)} s`,
      '  (nadie escribió «encender»: es `step(temperature ≥ ignitionPoint)`)',
    ])
  })

  it('documentado · el fuego dura lo que dura la mano, y por eso el pescado no se cocina entero', () => {
    // Éste es el eslabón que NO cierra, y el número es la razón: a los 3,55 s la
    // criatura agota los 1000 de `stamina`, deja de frotar y se muere. El tick
    // siguiente, TODO vuelve al ambiente.
    const c = correrLaCadena(20)
    expect(c.murioEn).toBeCloseTo(3.55, 6)
    // El pescado se queda a mitad de camino: el criterio de «cocido» del banco
    // hermano es 0,85 y acá no se llega ni cerca.
    expect(c.digestibilidad).toBeGreaterThan(0.38)
    expect(c.digestibilidad).toBeLessThan(0.85)
  })

  it.fails('SIGUE ABIERTO · el fuego tendría que sobrevivir a la mano que lo hizo', () => {
    // POR QUÉ SIGUE ABIERTO: no lo causa el ADR II-0010 y no lo arregla el ADR
    // II-0010. Lo causa que **un cuerpo que arde no es fuente de calor de sí
    // mismo**: `entornoDe` (`world/src/step.ts`) se saltea `f.id === c.body.id`
    // —y tiene que saltearlo, o un cuerpo se calentaría solo hasta el infinito—,
    // así que la ley 1 relaja una brasa hacia el ambiente igual que a una piedra.
    // El equilibrio de un cuerpo encendido es el AMBIENTE.
    //
    // Medido abajo, al aire, a 20 Hz, sin nadie sosteniendo nada: una madera de
    // 0,2 kg a 700 °C cae por debajo de sus 300 de ignición EN UN TICK (0,05 s), y
    // la más pesada que la criatura puede levantar —8 kg, el techo de `portable`—
    // aguanta 1,20 s. No hay ningún cuerpo del mundo con el que un fuego dure.
    //
    // QUÉ HARÍA FALTA PARA CERRARLO: que el fuego tenga dónde vivir. Dos caminos,
    // y los dos son un ADR con barrido:
    //
    //   · que la ley 3 escriba la `temperature` de la CELDA mientras algo arde
    //     ahí. Es lo único del mundo que hoy no relaja —`stepWorld` copia
    //     `cells` y las devuelve intactas—, y es exactamente lo que el banco de
    //     `el-tiempo-no-depende-del-tick.test.ts` idealiza a mano con su «hoyo
    //     tapado a 700 °C». Toca `CellState`, el hash y el snapshot;
    //   · o que un cuerpo encendido se sostenga a su propia temperatura de llama
    //     mientras le quede `fuelEnergy` — el mismo `pelea` de este ADR pero
    //     con la combustión como empuje en vez de una mano.
    //
    // El primero es más barato y es el que el resto del mundo ya asume. Los dos
    // mueven la ventana de cocción de las doce sustancias, así que hay que volver
    // a correr `pnpm ii:barrido`.
    const filas: string[] = []
    let peor = 0
    for (const [s, m, ign] of [
      ['madera', 0.2, 300],
      ['madera', 1, 300],
      ['madera', 3, 300],
      ['madera', 8, 300],
      ['carbon', 2.5, 420],
    ] as const) {
      const dura = cuantoDuraEncendido(s, m, 700, ign)
      if (dura > peor) peor = dura
      filas.push(`  ${s} ${String(m)} kg a 700 °C → cae debajo de ${String(ign)} a los ${dura.toFixed(2)} s`)
    }
    log(['══ EL HUECO · UNA BRASA SUELTA ════════════════════════════════════════', ...filas])
    // Lo que el hueco afirma: un fuego tiene que durar más que un puñado de
    // ticks. Diez segundos es el mínimo con el que se cocina algo.
    expect(peor).toBeGreaterThanOrEqual(10)
  })
})

/** Cuántos segundos se sostiene encendido un cuerpo ya caliente, al aire, sin nadie. */
function cuantoDuraEncendido(sust: string, masa: number, t0: number, ign: number, hz = 20): number {
  const dt = dtDeFrecuencia(hz)
  let w = mundo({ hz, bodies: [enElPiso(cuerpo('brasa', sust, masa, { temperature: t0 }), EN(0, 0))] })
  for (let n = 1; n <= Math.round(60 / dt); n++) {
    w = stepWorld(w, []).state
    if (leer(w, 'brasa', 'temperature') < ign) return Math.round((n / hz) * 1e6) / 1e6
  }
  return 60
}
