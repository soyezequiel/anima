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

describe('frotar lleva la vara a 375 °C en 2,40 s, a cualquier frecuencia', () => {
  it('las cinco frecuencias admisibles, en el mundo entero', () => {
    // ERAN TRES SEGUNDOS Y AHORA SON 2,40, y la diferencia es el ADR II-0011: la
    // fricción empuja 120 °C por segundo y cruza los 300 de ignición de lo leñoso
    // a los 2,375 s; de ahí en adelante los grados no los pone la mano sino la
    // llama, que empuja hacia los 615 °C de régimen. La vieja cuenta
    // —15 + 120×3 = 375— sigue siendo cierta para lo que NO puede prender, y eso se
    // mide en `physics/tests/el-empuje-no-se-relaja.test.ts` sobre hueso.
    //
    // La afirmación va en PASOS y no en segundos. El margen es UN TICK —un hecho
    // no se observa cuando ocurre sino en el primer paso posterior— y «un tick»
    // en segundos es un double: a 50 Hz, `2,42 − 2,4` da 0,020000000000000018 y
    // una comparación honesta contra 0,02 falla por el último bit. En pasos la
    // cuenta es entera: `ceil(2,375·hz)` es el primer paso en que el empuje cruza
    // la ignición, y los 375 llegan en ese mismo paso o en el siguiente.
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const r = frotarHasta375(0.2, hz)
      expect([hz, r.violaciones]).toEqual([hz, []])
      const ignicion = Math.ceil(2.375 * hz)
      expect([hz, r.pasos === ignicion || r.pasos === ignicion + 1]).toEqual([hz, true])
      filas.push(
        `  ${String(hz).padStart(3)} Hz → 375 °C a los ${r.segundos.toFixed(3)} s` +
          `  (paso ${String(r.pasos)} de ${String(ignicion)})   costó ${r.costo.toFixed(2)} de stamina`,
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
      // 48 y no 60: el ADR II-0011 le puso la llama al camino y los 375 °C llegan
      // a los 2,40 s en vez de a los 3,00. Sigue sin depender de la masa.
      expect([m, r.pasos]).toEqual([m, 48])
    }
  })
})

// ─── (b) EL PRECIO ───────────────────────────────────────────────────────────

describe('encender se paga por MASA, y por eso se enciende con yesca', () => {
  it('el costo medido es `heatCapacity × ΔT / eficiencia`, y la tabla', () => {
    // `heatCapacity` es EXTENSIVA, así que el precio de subir un cuerpo ΔT grados
    // es `heatCapacity × ΔT` de energía y `heatCapacity × ΔT / eficiencia` de
    // `stamina`. Con un tanque de arranque de 500 y un techo de catálogo de 1000,
    // eso separa lo que se puede encender de lo que no — sin que ninguna regla diga
    // «la yesca prende y el leño no».
    //
    // LA EFICIENCIA PASÓ DE 0,35 A 0,85 (tramo N) y toda esta tabla bajó con ella,
    // en la misma razón porque es el único factor que cambió. El porqué está en el
    // encabezado de `FRICCION` y la ventana en
    // `la-cuenta-de-los-veinte-mil.test.ts`, bloque 6; el corto es que con 0,35 la
    // criatura del criterio (5) no podía encender NADA.
    const w = elBanco(1, 20)
    const efic = eficienciaDeFrotar(w)
    expect(efic).toBe(0.85)

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
    // Los cuatro con 0,35 eran [141,43 · 276,86 · 1384,29 · 2768,57], y bajaron
    // todos en la misma razón (0,35/0,85 = 0,4118) porque la eficiencia es el único
    // factor que se movió: la tabla del ADR II-0010 sigue diciendo lo mismo sobre la
    // MASA, que es lo que vino a decir.
    expect(esperado).toEqual([58.24, 114, 570, 1140])

    // Y MEDIDO EN EL MUNDO, no sólo despejado: lo que la criatura gasta de verdad
    // es el precio térmico más lo que cuesta estar viva los 2,40 s que tarda.
    //
    // OJO CON EL ΔT, que el ADR II-0011 cambió y es lo mejor que trajo: la mano ya
    // no paga hasta los 375 °C, paga **hasta la ignición**. En el paso 48 el
    // empuje deja la vara en 15 + 6×48 = 303 °C, cruza los 300 de lo leñoso, y los
    // grados que faltan los pone la llama gratis. Encender pasó de costar 352,71
    // a costar 282,17 para la vara de 0,2 kg, y el techo de lo que se puede
    // encender con un tanque de 1000 subió de 0,55 kg a algo más de 0,6.
    //
    // Y CON LA EFICIENCIA EN 0,85 ESE TECHO SE FUE A ~1,7 kg: la vara de 0,2 sale
    // 116,02 y la de 1 kg —que era LA que no se podía encender, y de donde salía
    // «se enciende con yesca y no con leños»— sale 576,82 y SÍ entra en un tanque
    // lleno. La frase sigue valiendo para la criatura del criterio (5), que arranca
    // con 310, y dejó de valer para una con el tanque lleno. Está medido abajo.
    const medidas: string[] = []
    const empujadoHasta = 15 + (120 / 20) * 48
    expect(empujadoHasta).toBe(303)
    for (const m of [0.2, 0.4, 0.5, 0.55, 0.6, 1]) {
      const r = frotarHasta375(m, 20)
      const termico = (m * 1.7 * (empujadoHasta - 15)) / efic
      const vivir = (48 / 20) * COSTO_VIVIR_POR_SEGUNDO
      expect([m, Number(r.costo.toFixed(4))]).toEqual([m, Number((termico + vivir).toFixed(4))])
      medidas.push(
        `  madera ${String(m).padStart(4)} kg → 375 °C cuesta ${r.costo.toFixed(2)}` +
          `  (${termico.toFixed(2)} de calor + ${vivir.toFixed(2)} de vivir)`,
      )
    }
    // ─── EL BORDE SE CORRIÓ DE 1 kg A ~1,8 kg, Y SIGUE EXISTIENDO ──────────
    //
    // Acá decía «y a 1 kg ya no alcanza: el tanque tiene techo 1000 y hacen falta
    // 1401», y lo afirmaba con `Number.isNaN(noLlega.pasos)`. Con la eficiencia en
    // 0,85 el kilo sale 576,82 y entra, así que el borde se busca donde HOY está:
    // 1,8 kg pide 1038,1 y no entra. Lo que el bloque afirma no es el número, es que
    // el borde EXISTA — que es lo que hace que encender sea una decisión y no un
    // trámite—, y sigue existiendo.
    const noLlega = frotarHasta375(1.8, 20)
    expect(Number.isNaN(noLlega.pasos)).toBe(true)
    expect(noLlega.pico).toBeLessThan(375)
    medidas.push(
      `  madera  1.8 kg → NO LLEGA: se queda en ${noLlega.pico.toFixed(2)} °C con el tanque vacío`,
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
    // cobra hoy —`heatCapacity × ΔT / eficiencia`— 48 corresponden a una vara de 67
    // gramos. El número es anterior a que `heatCapacity` entrara en el precio.
    // Queda medido acá para que nadie lo busque de nuevo.
    //
    // Los dos números tenían el 0,35 COPIADO y se movieron con la calibración del
    // tramo N; ahora la eficiencia se lee del mundo, que es de donde tendría que
    // haber salido siempre. Con 0,35 eran 27 gramos y 1748,57.
    const w = elBanco(1, 20)
    const efic = eficienciaDeFrotar(w)
    const masaQueCostaria48 = (48 * efic) / (1.7 * 360)
    expect(masaQueCostaria48).toBeLessThan(0.07)
    // La vara de 1 kg del comentario cuesta 720, o sea 0,72 tanques llenos.
    const deVerdad = (qualityOf(cuerpo('x', 'madera', 1), 'heatCapacity', w.phys) * 360) / efic
    expect(Number(deVerdad.toFixed(2))).toBe(720)
    log([
      '══ LOS 48 DEL COMENTARIO ══════════════════════════════════════════════',
      `  48 de stamina alcanzan para una vara de ${(masaQueCostaria48 * 1000).toFixed(1)} gramos.`,
      `  La de 1 kg que el comentario nombra cuesta ${deVerdad.toFixed(2)}, o sea ${(deVerdad / 1000).toFixed(2)} tanques.`,
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

  it('ADR II-0011 · el fuego le SOBREVIVE a la mano, y el pescado se cocina entero', () => {
    // ÉSTE ERA EL ESLABÓN QUE NO CERRABA. El texto viejo decía: «a los 3,55 s la
    // criatura agota los 1000 de `stamina`, deja de frotar y se muere; el tick
    // siguiente, TODO vuelve al ambiente», y el pescado se quedaba en 0,513 contra
    // los 0,85 que el banco hermano llama «cocido».
    //
    // La criatura se sigue muriendo —pero el fuego que dejó hecho sigue ahí, y el
    // pescado llega a 0,950. Es el criterio (d) del ADR II-0011: cocinar sin que
    // nadie frote.
    //
    // EL SEGUNDO EN QUE SE MUERE SE MOVIÓ DE 3,45 A 8,35, Y ES POR LA CALIBRACIÓN.
    // Con la eficiencia de `friccion` en 0,85 (tramo N) frotar cuesta 2,43× menos,
    // así que el mismo tanque de 1000 le dura 2,42× más frotando. No aguanta más
    // porque coma: aguanta más porque el fuego salió más barato, y eso es
    // exactamente lo que la calibración vino a comprar. El texto viejo decía «a los
    // 3,55 s la criatura agota los 1000 de `stamina`, deja de frotar y se muere; el
    // tick siguiente, TODO vuelve al ambiente», y el pescado se quedaba en 0,513.
    const c = correrLaCadena(20)
    expect(c.murioEn).toBeCloseTo(8.35, 6)
    expect(c.digestibilidad).toBeGreaterThanOrEqual(0.85)
    // 0,9456 en los doce segundos que corre la cadena; con sesenta llega al techo
    // de 0,95 que la ley 5 declara. Contra 0,513 antes del ADR II-0011.
    expect(c.digestibilidad).toBeCloseTo(0.9456, 4)
  })

  it('CERRADO por el ADR II-0011 · una brasa suelta se sostiene sola', () => {
    // ESTO ERA UN `it.fails`. Su «POR QUÉ SIGUE ABIERTO» decía: «un cuerpo que arde
    // no es fuente de calor de sí mismo— `entornoDe` (`world/src/step.ts`) se
    // saltea `f.id === c.body.id`, y tiene que saltearlo, o un cuerpo se
    // calentaría solo hasta el infinito—, así que la ley 1 relaja una brasa hacia
    // el ambiente igual que a una piedra». Medía que una madera de 0,2 kg a 700 °C
    // caía debajo de sus 300 de ignición EN UN TICK, y que ni la más pesada que se
    // puede levantar aguantaba más de 1,20 s.
    //
    // Proponía dos caminos y el ADR II-0011 tomó el segundo: «que un cuerpo
    // encendido se sostenga a su propia temperatura de llama mientras le quede
    // `fuelEnergy`». `entornoDe` NO SE TOCÓ y sigue salteándose a sí mismo — el
    // calor no viene de ser su propio ambiente, viene de la ley 3.
    //
    // Los números de abajo son los mismos casos, con la misma función.
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
    log(['══ LA BRASA SUELTA, YA NO UN HUECO ════════════════════════════', ...filas])
    // Lo que el hueco afirmaba: un fuego tiene que durar más que un puñado de
    // ticks. Diez segundos es el mínimo con el que se cocina algo.
    expect(peor).toBeGreaterThanOrEqual(10)
    // Y lo que ahora se puede afirmar de más: hasta la más liviana aguanta los
    // diez, y el leño de 1 kg dura los 50 s que tarda en volverse ceniza.
    expect(cuantoDuraEncendido('madera', 0.2, 700, 300)).toBeGreaterThanOrEqual(10)
    expect(cuantoDuraEncendido('madera', 1, 700, 300)).toBeGreaterThan(45)
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
