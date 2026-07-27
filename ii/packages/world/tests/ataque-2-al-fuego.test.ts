// ─── EL ATAQUE AL FUEGO — el adversario del ADR II-0010 ──────────────────────
//
// El tramo anterior escribió `world/tests/el-fuego.test.ts` y midió lo que el
// ADR II-0010 vino a arreglar: la vara llega a 375 °C en 3,00 s, la cadena
// yesca → leño → cocinar enciende entera, y el fuego no sobrevive a la mano.
// Todo eso es cierto y está bien medido; este archivo no lo repite.
//
// Este archivo mide lo que la reparación DEJÓ ATRÁS, y son cinco cosas:
//
//   (a) EL DIENTE DE SIERRA NO ES UN DIENTE: es un DERRUMBE. Al saturar el
//       `drive` la temperatura cae de 400 a 15,000 °C en UN tick a 20 Hz —385
//       grados, de arriba del punto de ignición al ambiente de partida— y a las
//       cinco frecuencias cae debajo de la ignición en un solo paso. El único
//       test que lo cuida hoy afirma `toBeLessThan(400)`, que una caída de un
//       grado cumple igual que una de 385: es un detector de diez rotos.
//   (b) `friccion` DECLARA `establishes: ['temperature>=400']` Y ESE HECHO VIVE
//       CERO TICKS. Lo que la fragua lee para planificar es falso el paso
//       siguiente al único en que fue cierto.
//   (c) SOLTAR NO ES QUEDARSE SIN FUERZAS. El hueco del tramo anterior culpa a
//       la `stamina` que se acaba a los 3,55 s; medido con el tanque lleno, la
//       misma caída pasa por dejar de frotar y nada más.
//   (d) EL CATÁLOGO PROHÍBE COCINAR FROTANDO POR CINCO CENTÉSIMAS, y ATAR lo
//       destraba: un tubérculo atado a una vara da `rigidity` 0,540 ≥ 0,5 y se
//       cocina SIN FUEGO. Nadie escribió «horno».
//   (e) EL CORPUS DE DETERMINISMO DEL MUNDO NO TOCA UN SOLO `drive`.
//       `intencionesAlAzar` emite ocho clases de intención y `friccion` no es
//       ninguna, así que «ninguna huella del mundo se movió» es cierto y no es
//       evidencia: `Empuje`, `anotarEmpuje` y la rama nueva de `entornoDe`
//       tenían CERO cobertura en gemelos, snapshot y crónica. Acá la tienen.
//
// ─── CÓMO SE LEE ────────────────────────────────────────────────────────────
//
//   · `it(...)`             → la promesa se cumple, con su número medido.
//   · `it(... documentado)` → un número que hoy es así; el cuerpo lo clava.
//   · `it.fails(...)`       → HUECO ABIERTO, con su «POR QUÉ SIGUE ABIERTO».

import { describe, expect, it } from 'vitest'
import { FRECUENCIAS_ADMISIBLES, qualityOf } from '@anima/physics'
import type { Body, QualityId } from '@anima/physics'

import { stepWorld } from '../src/step.js'
import type { WorldState } from '../src/step.js'
import { apply, eat } from '../src/intent.js'
import { hashWorldState, restoreWorld, worldSlots } from '../src/mundo.js'
import { createJournal, replay } from '../src/journal.js'
import type { Intent } from '../src/intent.js'
import { revisarInvariantes } from '../src/invariants.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, intencionesAlAzar, lcg, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

function leer(w: WorldState, id: string, q: QualityId): number {
  const b = w.bodies.get(id)
  return b === undefined ? Number.NaN : qualityOf(b.body, q, w.phys)
}

const ROLES = [
  { name: 'a', body: 'va' },
  { name: 'b', body: 'vb' },
  { name: 'actor', body: 'dina-cuerpo' },
]

/**
 * La criatura con dos varas en la mano.
 *
 * `stamina` arranca a 1000 y no más alto AUNQUE SE LO PIDAS: `conCualidad` pasa
 * por `clampToRange` y el techo de `stamina` en el catálogo es 1000. O sea que
 * el «tanque idealizado a infinito» que el banco de `physics` usa para medir el
 * techo TÉRMICO no existe adentro del mundo, y cualquier banco del mundo que se
 * lo crea está midiendo el techo ECONÓMICO sin saberlo. Está medido abajo.
 */
function banco(masa: number, hz = 20, sustancia = 'madera'): WorldState {
  return mundo({
    hz,
    bodies: [
      enElPiso(criatura('dina', 1000), EN(0, 0)),
      enLaMano(cuerpo('va', sustancia, masa, { temperature: 15 }), EN(0, 0), 'dina'),
      enLaMano(cuerpo('vb', 'madera-dura', masa, { temperature: 15 }), EN(0, 0), 'dina'),
    ],
    actors: [actor('dina', { holding: ['va', 'vb'], capacity: 3 })],
  })
}

/** Frota `pasos` veces y devuelve la temperatura de `va` después de cada uno. */
function frotarYAnotar(masa: number, pasos: number, hz = 20, hasta = pasos): readonly number[] {
  let w = banco(masa, hz)
  const t: number[] = []
  for (let n = 1; n <= pasos; n++) {
    const i = n <= hasta ? apply({ by: 'dina', seq: n }, w.phys, 'friccion', ROLES) : undefined
    w = stepWorld(w, i === undefined ? [] : [i]).state
    t.push(leer(w, 'va', 'temperature'))
  }
  return t
}

// ═══ (a) EL DIENTE DE SIERRA ES UN DERRUMBE ══════════════════════════════════

describe('(a) al saturar el `drive`, la temperatura no baja: se derrumba', () => {
  it('documentado · de 400 °C a debajo de la ignición en UN tick, a las cinco frecuencias', () => {
    // El ADR II-0010 lo anota como «aparece un diente de sierra cuando el `drive`
    // satura» y dice que «es CORRECTO que mantener cueste». Lo que no dice —y es
    // lo que este test pone en número— es CUÁNTO cuesta y cómo es la forma de
    // onda: no hay meseta arriba ni bajada suave. Hay un solo paso a `toward` y
    // el siguiente ya está debajo del punto de ignición, o sea que el cuerpo dejó
    // de ser fuego. A 20 Hz vuelve EXACTAMENTE al ambiente.
    //
    // La aritmética de por qué es un derrumbe y no un diente:
    //   `acople = min(1, H_PERDIDA_POR_SEGUNDO · dt / heatCapacity)`, y para una
    //   madera de 0,2 kg `heatCapacity` es 0,34, así que a 10, 20 y 25 Hz el
    //   `min` SATURA en 1 y la ley 1 lleva el cuerpo al ambiente entero en un
    //   paso. La saturación ya estaba medida
    //   (`el-tiempo-no-depende-del-tick.test.ts`, «a 10 Hz el acople de la ley 1
    //   satura»); lo que el ADR II-0010 agrega es un cuerpo que llega a 400 °C
    //   para que la saturación tenga 385 grados de dónde caer.
    //
    // Y LO QUE ESO DESTAPA: la caída DEPENDE DE LA FRECUENCIA, y ahora se nota.
    // A 20 Hz el cuerpo aterriza en 15,00 y a 100 Hz en 286,76 — 272 grados de
    // diferencia entre dos frecuencias admisibles, sobre el mismo hecho y el
    // mismo segundo de mundo. Antes del ADR II-0010 la divergencia existía igual
    // pero valía unas décimas, porque nada llegaba alto. El hecho GRUESO sí
    // sobrevive a las cinco —el cuerpo cae debajo de su ignición en un solo
    // paso—, y es lo único que este test afirma.
    //
    // POR QUÉ IMPORTA Y NO ES COSMÉTICA: el ciclo entero son 65 pasos a 20 Hz
    // —64 subiendo de a 6 grados y 1 cayendo— y en 200 pasos hay TRES derrumbes.
    // Medido: la vara está arriba de sus 300 °C de ignición en 36 de esos 200
    // pasos. O sea que la primera fuente de calor del mundo ARDE EL 18% DEL
    // TIEMPO y se apaga sola cada 3,25 s aunque nadie suelte nada y aunque sobre
    // `stamina`.
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      // El paso del pico se BUSCA y no se predice: acumular (400−15)/(120/hz)
      // sumas en IEEE-754 no cae siempre en el mismo entero.
      const subida = Math.ceil((400 - 15) / (120 / hz)) + 4
      const t = frotarYAnotar(0.2, subida + 3, hz)
      const pico = t.indexOf(400)
      expect([hz, pico >= 0]).toEqual([hz, true])
      const despues = t[pico + 1] as number
      // Lo que vale a las CINCO: en UN paso el cuerpo deja de estar encendido.
      expect([hz, despues < 300]).toEqual([hz, true])
      filas.push(
        `  ${String(hz).padStart(3)} Hz → sube ${String(pico + 1)} pasos hasta 400,00 °C y el paso ` +
          `${String(pico + 2)} lo deja en ${despues.toFixed(2)} °C  (cae ${(400 - despues).toFixed(2)} en ${(1000 / hz).toFixed(0)} ms)`,
      )
    }
    // Y el ciclo completo, con el tiempo que la vara pasa arriba de su ignición.
    const t = frotarYAnotar(0.2, 200, 20)
    let derrumbes = 0
    let ardiendo = 0
    for (let i = 1; i < t.length; i++) {
      if ((t[i - 1] as number) - (t[i] as number) > 100) derrumbes++
      if ((t[i] as number) >= 300) ardiendo++
    }
    log([
      '══ (a) EL DERRUMBE, NO EL DIENTE ══════════════════════════════════════',
      ...filas,
      `  en 200 pasos a 20 Hz hubo ${String(derrumbes)} derrumbes y la vara estuvo arriba de sus`,
      `  300 °C en ${String(ardiendo)} de 200 pasos (${((ardiendo / 200) * 100).toFixed(0)}% del tiempo)`,
    ])
    expect(derrumbes).toBeGreaterThanOrEqual(2)
  })

  it('CARNADA · el test que hoy cuida el derrumbe lo cumple una caída de UN grado', () => {
    // `physics/tests/el-empuje-no-se-relaja.test.ts` («mantener no es gratis»)
    // afirma `expect(temperatura).toBeLessThan(TOWARD)` sobre un cuerpo puesto a
    // 400. Eso es cierto para 399,99 y para 15,00 exactamente igual, así que si
    // mañana alguien amortigua el derrumbe —o lo empeora— ese test no se entera.
    // Éste sí: afirma el valor, no la desigualdad.
    //
    // Si se revierte `pelea` a `return false`, este test cae por el otro lado: la
    // vara nunca llega a 400 y `t[subida-1]` no es 400.
    const t = frotarYAnotar(0.2, 70, 20)
    const pico = t.indexOf(400)
    expect(pico, 'la vara tiene que llegar a `toward` para que haya de dónde caer').toBeGreaterThan(0)
    expect(t[pico + 1]).toBe(15)
    // Lo que la desigualdad floja NO distingue, dicho como número:
    expect((t[pico] as number) - (t[pico + 1] as number)).toBe(385)
  })
})

// ═══ (b) LA PROMESA DEL CATÁLOGO VIVE CERO TICKS ═════════════════════════════

describe('(b) `friccion` promete `temperature>=400` y la promesa no dura un paso', () => {
  it.fails('SIGUE ABIERTO · lo que `establishes` publica tiene que seguir siendo cierto al paso siguiente', () => {
    // POR QUÉ SIGUE ABIERTO: `FRICCION.establishes` es `['temperature>=400']`
    // (`physics/src/process.ts`), y `establishes` no es documentación: es lo que
    // la fragua LEE PARA PLANIFICAR y con lo que arma las aristas entre procesos
    // (`physics/src/admit.ts`, «`establishes` es lo que la fragua lee para
    // PLANIFICAR»). Un plan que encadena «frotar hasta 400, y entonces …» encadena
    // sobre un hecho que es cierto en el paso 64 y falso en el 65.
    //
    // Antes del ADR II-0010 el predicado era falso SIEMPRE —la vara se estancaba
    // en 29,4 °C— así que nadie podía notarlo. Ahora es cierto exactamente un
    // paso, que es peor: es la clase de hecho que pasa un test y rompe un plan.
    //
    // Medido a 20 Hz con una vara de madera de 0,2 kg: el predicado se cumple en
    // el paso 65 (t = 3,25 s) y en el 66 la temperatura es 15,00.
    //
    // QUÉ HARÍA FALTA: que el `drive` no se apague al tocar `toward` sino que
    // SOSTENGA —que anote el empuje también cuando `delta` da 0, pagando el
    // mantenimiento— o que `toward` deje de ser un tope duro y pase a ser un
    // punto fijo con su propio término de pérdida. Lo primero son dos líneas en
    // `world/src/step.ts` (`aplicarEfectos`, el `if (delta <= 0) break`) más su
    // precio en `stamina`, y le cambia la conducta a todo `drive`: es un ADR.
    // Lo segundo toca la forma del efecto en `physics/src/process.ts` y con ella
    // el `.d.ts` del sandbox.
    const t = frotarYAnotar(0.2, 80, 20)
    const cumple = t.indexOf(400)
    expect(cumple).toBeGreaterThan(0)
    // Lo que el hueco afirma: la promesa tiene que sobrevivir al paso siguiente.
    expect(t[cumple + 1]).toBeGreaterThanOrEqual(400)
  })

  it('documentado · el número exacto: cierto en el paso 65, falso en el 66', () => {
    // El mismo hecho sin la afirmación, para que el número quede aunque el hueco
    // tarde en cerrarse.
    const t = frotarYAnotar(0.2, 80, 20)
    const cumple = t.indexOf(400)
    expect(cumple + 1).toBe(65)
    expect(t[cumple + 1]).toBe(15)
    log([
      '══ (b) `establishes: temperature>=400` ════════════════════════════════',
      `  se cumple en el paso ${String(cumple + 1)} (t = ${((cumple + 1) / 20).toFixed(2)} s) y en el ${String(cumple + 2)} la vara está a 15,00 °C`,
      '  lo que la fragua lee para planificar es cierto durante 50 ms',
    ])
  })
})

// ═══ (c) SOLTAR NO ES QUEDARSE SIN FUERZAS ═══════════════════════════════════

describe('(c) el fuego se apaga por soltar, no por quedarse sin aliento', () => {
  it('documentado · con 706 de `stamina` en el tanque, dejar de frotar apaga igual', () => {
    // El hueco abierto del tramo anterior («el fuego no sobrevive a la mano que lo
    // hizo») lo mide con una criatura que se muere de hambre a los 3,55 s, así que
    // las dos causas —soltar y agotarse— llegan juntas y no se distinguen. Acá se
    // separan: la criatura DEJA de frotar en el paso 50 con el tanque a 706,07 de
    // 1000, y la vara cae de 315,00 a 15,000 en el paso siguiente igual.
    //
    // No cambia el veredicto del hueco; lo hace más chico y más nítido: no falta
    // aliento, falta que el fuego tenga dónde vivir.
    let w = banco(0.2, 20)
    const s0 = leer(w, 'dina-cuerpo', 'stamina')
    let antes = Number.NaN
    let despues = Number.NaN
    let tanque = Number.NaN
    for (let n = 1; n <= 60; n++) {
      const i = n <= 50 ? apply({ by: 'dina', seq: n }, w.phys, 'friccion', ROLES) : undefined
      w = stepWorld(w, i === undefined ? [] : [i]).state
      if (n === 50) {
        antes = leer(w, 'va', 'temperature')
        tanque = leer(w, 'dina-cuerpo', 'stamina')
      }
      if (n === 51) despues = leer(w, 'va', 'temperature')
    }
    expect(antes).toBe(315)
    expect(despues).toBe(15)
    expect(tanque).toBeGreaterThan(600)
    log([
      '══ (c) SOLTAR APAGA, CON EL TANQUE LLENO ══════════════════════════════',
      `  se frota hasta el paso 50: la vara está a ${antes.toFixed(2)} °C y quedan ${tanque.toFixed(2)} de ${s0.toFixed(0)} de stamina`,
      `  se deja de frotar: el paso 51 la deja en ${despues.toFixed(3)} °C`,
      '  la mano que suelta apaga tan rápido como la que se desmaya',
    ])
  })

  it('documentado · el «tanque infinito» no existe adentro del mundo: `stamina` topa en 1000', () => {
    // Trampa de banco, y hay que dejarla escrita porque el banco de `physics` la
    // idealiza a propósito y el del mundo NO PUEDE. `criatura('dina', 1e9)` deja
    // 1e9 escrito en `Body.state`, pero la primera vez que el mundo le toca la
    // `stamina` —y se la toca todos los ticks, con el costo de vivir—
    // `clampToRange` la lleva al techo del catálogo, y ni siquiera hace falta un
    // tick: `qualityOf` ya la recorta al LEERLA. Medido: quien escribe mil
    // millones tiene 1000 desde el primer instante, y la fricción se lo come en
    // 174 pasos (8,7 s) con una vara de 0,2 kg.
    let w = mundo({
      hz: 20,
      bodies: [enElPiso(criatura('dina', 1e9), EN(0, 0))],
      actors: [actor('dina')],
    })
    const escrito = w.bodies.get('dina-cuerpo')?.body.state['stamina']
    expect(escrito).toBe(1e9)
    // Escrito 1e9, leído 1000: el techo lo pone la lectura y no el mundo.
    expect(leer(w, 'dina-cuerpo', 'stamina')).toBe(1000)
    w = stepWorld(w, []).state
    const tras = leer(w, 'dina-cuerpo', 'stamina')
    expect(tras).toBeLessThanOrEqual(1000)

    // Y lo que eso le hace a un banco: con «el tanque a infinito», la criatura de
    // `banco()` se muere igual, y el pico de la vara sale del techo económico.
    let v = banco(0.2, 20)
    let murioEn = Number.NaN
    for (let n = 1; n <= 400 && Number.isNaN(murioEn); n++) {
      const i = apply({ by: 'dina', seq: n }, v.phys, 'friccion', ROLES)
      const r = stepWorld(v, i === undefined ? [] : [i])
      v = r.state
      if (r.events.some((e) => e.k === 'murio')) murioEn = n
    }
    expect(murioEn).toBe(174)
    log([
      '══ EL TANQUE QUE NO ES INFINITO ═══════════════════════════════════════',
      `  se escribió 1e9 de stamina y qualityOf devuelve ${leer(w, 'dina-cuerpo', 'stamina').toFixed(2)} desde el tick 0`,
      `  frotando sin parar, la criatura se muere en el paso ${String(murioEn)} (${(murioEn / 20).toFixed(2)} s)`,
      '  cualquier banco DEL MUNDO que crea estar midiendo el techo térmico',
      '  está midiendo el económico: el techo térmico sólo se puede medir sobre `paso()`',
    ])
  })

  it('documentado · la tabla de masas se dio VUELTA, y la vieja sigue escrita en `las-quince`', () => {
    // `perceive/tests/las-quince.test.ts` lleva una tabla de masas en el cuerpo de
    // su `it.fails` de la fricción, medida ANTES del ADR II-0010, donde el óptimo
    // era una vara de 3 kg («46,77 °C ← el mejor de todos») y las livianas no
    // subían nada. Con la relajación suspendida el orden es el CONTRARIO: la tasa
    // ya no depende de `heatCapacity` —son 120 °C/s y punto— y lo único que la
    // masa mueve es el PRECIO, así que gana la más liviana que se pueda sostener.
    //
    //   masa    heatCapacity   ANTES (400 ticks)   AHORA (pico, 1000 de tanque)
    //   0,05    0,085          15,00               400,00
    //   0,1     0,170          15,00               400,00
    //   0,3     0,510          15,09               400,00
    //   1       1,700          26,25               220,53
    //   3       5,100          46,77  ← el mejor   83,59   ← el peor de los que suben
    //   10      17,00          20,66               35,59
    //   30      51,00           7,03               21,86
    const filas: string[] = []
    const picos = new Map<number, number>()
    for (const m of [0.05, 0.1, 0.3, 1, 3, 10, 30]) {
      let w = banco(m, 20)
      let pico = 0
      let pasos = 0
      for (let n = 1; n <= 400; n++) {
        const i = apply({ by: 'dina', seq: n }, w.phys, 'friccion', ROLES)
        const r = stepWorld(w, i === undefined ? [] : [i])
        w = r.state
        pico = Math.max(pico, leer(w, 'va', 'temperature'))
        pasos = n
        if (r.events.some((e) => e.k === 'murio')) break
      }
      picos.set(m, pico)
      filas.push(
        `  madera ${String(m).padStart(5)} kg · heatCapacity ${(m * 1.7).toFixed(3).padStart(6)} → pico ${pico.toFixed(2).padStart(7)} °C  (frotó ${String(pasos)} pasos)`,
      )
    }
    // Lo que se da vuelta, afirmado y no narrado: las livianas pasan la ignición
    // de la madera (300) y la de 3 kg —«el mejor de todos» de la tabla vieja— no.
    expect(picos.get(0.1)).toBeGreaterThanOrEqual(300)
    expect(picos.get(0.3)).toBeGreaterThanOrEqual(300)
    expect(picos.get(3)).toBeLessThan(300)
    expect(picos.get(3)).toBeLessThan(picos.get(1) as number)
    log(['══ LA TABLA DE MASAS, DADA VUELTA ═════════════════════════════════════', ...filas])
  })
})

// ═══ (d) EL FUEGO NO SE PROPAGA, Y COCINAR FROTANDO SE DESTRABA ATANDO ═══════

describe('(d) qué prende y qué no', () => {
  it('el fuego NO se propaga a lo que no lo toca, ni quema a quien lo sostiene', () => {
    // Lo que había que descartar: que la reparación hubiera encendido el mundo.
    // No lo hizo, y por un margen enorme. Con la criatura frotando dos varas
    // hasta 400 °C durante 200 pasos, en la misma celda y en la de al lado:
    //
    //   hoja seca a UNA celda (ignición 180) ... 18,6 °C
    //   hoja seca a TRES celdas ................ 15,7 °C
    //   un trozo de carne a una celda .......... 18,3 °C
    //   la criatura que las tiene en la mano ... 20,2 °C
    //
    // `montajeDe` sólo da `contacto` (exposición 0,6) a lo que APOYA o TAPA a la
    // fuente; todo lo demás es `piso` (0,06) y con la distancia al cuadrado no
    // alcanza para nada. Que sostener dos brasas no queme es una consecuencia de
    // que la criatura tampoco apoya ni tapa, y es información: no hay daño por
    // calor en Ánima II, sólo hay temperatura.
    let w = mundo({
      hz: 20,
      bodies: [
        enElPiso(criatura('dina', 1000), EN(0, 0)),
        enLaMano(cuerpo('va', 'madera', 0.2, { temperature: 15 }), EN(0, 0), 'dina'),
        enLaMano(cuerpo('vb', 'madera-dura', 0.2, { temperature: 15 }), EN(0, 0), 'dina'),
        // Una por celda: una celda admite UNA SOLA pila de sólidos
        // (`invariants.ts`, `revisarEspacio`), y dos cuerpos sueltos en la misma
        // celda son `solidos-solapados`.
        { body: cuerpo('hoja-cerca', 'hoja-seca', 0.1), at: EN(1, 0) },
        { body: cuerpo('hoja-lejos', 'hoja-seca', 0.1), at: EN(3, 0) },
        { body: cuerpo('carne-cerca', 'carne', 1), at: EN(0, 1) },
      ],
      actors: [actor('dina', { holding: ['va', 'vb'], capacity: 3 })],
    })
    const max = new Map<string, number>()
    for (let n = 1; n <= 200; n++) {
      const i = apply({ by: 'dina', seq: n }, w.phys, 'friccion', ROLES)
      const antes = w
      const r = stepWorld(w, i === undefined ? [] : [i])
      w = r.state
      expect(revisarInvariantes(antes, w, r.events)).toEqual([])
      for (const id of ['hoja-cerca', 'hoja-lejos', 'carne-cerca', 'dina-cuerpo']) {
        max.set(id, Math.max(max.get(id) ?? 0, leer(w, id, 'temperature')))
      }
    }
    // La hoja seca tiene la ignición más baja de las treinta (180) y ni se acerca.
    expect(max.get('hoja-cerca')).toBeLessThan(180)
    expect(max.get('hoja-lejos')).toBeLessThan(30)
    expect(max.get('dina-cuerpo')).toBeLessThan(50)
    log([
      '══ (d) EL FUEGO NO SE PROPAGA ═════════════════════════════════════════',
      `  hoja seca a UNA celda (ignición 180) .. ${(max.get('hoja-cerca') as number).toFixed(1)} °C`,
      `  hoja seca a TRES celdas ............... ${(max.get('hoja-lejos') as number).toFixed(1)} °C`,
      `  carne a una celda ..................... ${(max.get('carne-cerca') as number).toFixed(1)} °C`,
      `  la criatura, con las dos en la mano ... ${(max.get('dina-cuerpo') as number).toFixed(1)} °C`,
    ])
  })

  it('documentado · el catálogo prohíbe cocinar frotando por cinco centésimas, y ATAR lo destraba', () => {
    // `friccion` pide `rigidity >= 0,5` en el rol que calienta. Ninguna de las
    // doce sustancias cocinables llega: la más rígida es `cuero` con 0,45. Así que
    // frotar un tubérculo se rechaza con `rol-no-cumple` y cocinar sigue pidiendo
    // fuego — que es lo que la calibración del ADR II-0009 supone.
    //
    // Pero `rigidity` de un cuerpo COMPUESTO sale de sus partes, y una vara de
    // madera de 0,3 kg atada a un tubérculo de 0,2 da **0,540**, que pasa. Frotando
    // ese cuerpo, el tubérculo que lleva adentro atraviesa su ventana de cocción
    // (75–300) y su `digestibility` sube de 0,084 a 0,435 en 40 pasos, SIN FUEGO.
    // Nadie escribió «horno»: es el mismo mecanismo que hace la caña.
    //
    // Antes del ADR II-0010 esto era imposible y no por el catálogo: el cuerpo
    // compuesto se estancaba abajo de su ventana. Es conducta NUEVA, y es de las
    // que hay que saber que existen antes de que aparezcan en una crónica.
    //
    // NO ES UN EXPLOIT ECONÓMICO, y el número lo dice: frotar hasta cocinarlo
    // cuesta 755,91 de `stamina` y el bocado devuelve 0,54. Ver el bloque (e).
    const pelado = mundo({
      hz: 20,
      bodies: [
        enElPiso(criatura('dina', 1000), EN(0, 0)),
        enLaMano(cuerpo('va', 'tuberculo', 0.2, { temperature: 15 }), EN(0, 0), 'dina'),
        enLaMano(cuerpo('vb', 'madera-dura', 0.2, { temperature: 15 }), EN(0, 0), 'dina'),
      ],
      actors: [actor('dina', { holding: ['va', 'vb'], capacity: 3 })],
    })
    const i0 = apply({ by: 'dina', seq: 1 }, pelado.phys, 'friccion', ROLES)
    const r0 = stepWorld(pelado, i0 === undefined ? [] : [i0])
    expect(r0.events.map((e) => (e.k === 'rechazada' ? e.por : e.k))).toEqual(['rol-no-cumple'])

    const atado: Body = {
      id: 'va',
      form: 'vara',
      parts: [
        { substance: 'madera', mass: 0.3, q: {} },
        { substance: 'tuberculo', mass: 0.2, q: {} },
      ],
      joints: [{ a: 0, b: 1, via: 'liana', strength: 1 }],
      state: { temperature: 15 },
    }
    let w = mundo({
      hz: 20,
      bodies: [
        enElPiso(criatura('dina', 1000), EN(0, 0)),
        enLaMano(atado, EN(0, 0), 'dina'),
        enLaMano(cuerpo('vb', 'madera-dura', 0.3, { temperature: 15 }), EN(0, 0), 'dina'),
      ],
      actors: [actor('dina', { holding: ['va', 'vb'], capacity: 3 })],
    })
    const rig = leer(w, 'va', 'rigidity')
    const d0 = leer(w, 'va', 'digestibility')
    for (let n = 1; n <= 40; n++) {
      const i = apply({ by: 'dina', seq: n }, w.phys, 'friccion', ROLES)
      w = stepWorld(w, i === undefined ? [] : [i]).state
    }
    const d1 = leer(w, 'va', 'digestibility')
    expect(rig).toBeGreaterThanOrEqual(0.5)
    expect(rig).toBeCloseTo(0.54, 6)
    expect(d1).toBeGreaterThan(d0 * 4)
    log([
      '══ (d) EL HORNO QUE NADIE ESCRIBIÓ ════════════════════════════════════',
      '  tubérculo pelado (rigidity 0,30) → frotar RECHAZADO por `rol-no-cumple`',
      `  tubérculo atado a una vara       → rigidity ${rig.toFixed(3)} ≥ 0,50, y frotar es legal`,
      `  40 pasos frotando: digestibility ${d0.toFixed(3)} → ${d1.toFixed(3)}, sin encender nada`,
    ])
  })

  it('documentado · frotar SECA, y por eso una vara empapada termina prendiendo', () => {
    // La otra conducta que el ADR II-0010 movió y no midió, y ésta es de la ley 11
    // y no de la 1. `secado` es proporcional a `temperature − ambiente`: con la
    // meseta vieja de 29,4 °C secaba 0,0003 por paso y una vara empapada tardaba
    // miles de pasos —muchas veces lo que la criatura vive—. Con la relajación
    // suspendida la vara pasa por 400 °C y la misma vara baja de los 0,45 que la
    // innata cablea en el paso 53 (2,65 s), y para el 200 tiene `charred` 0,340.
    //
    // Es exactamente el hueco que la innata `frotar` cablea a mano
    // (`HUMEDAD_QUE_APAGA_CABLEADA = 0.45`, `skills/src/innatas/frotar.ts`): la
    // habilidad se rinde de entrada si el palo está mojado, y el mundo dice que
    // frotar un palo mojado LO SECA. La habilidad es más pesimista que la física.
    let w = mundo({
      hz: 20,
      bodies: [
        enElPiso(criatura('dina', 1000), EN(0, 0)),
        enLaMano(cuerpo('va', 'madera', 0.2, { temperature: 15, moisture: 1 }), EN(0, 0), 'dina'),
        enLaMano(cuerpo('vb', 'madera-dura', 0.2, { temperature: 15 }), EN(0, 0), 'dina'),
      ],
      actors: [actor('dina', { holding: ['va', 'vb'], capacity: 3 })],
    })
    let seca = Number.NaN
    for (let n = 1; n <= 200; n++) {
      const i = apply({ by: 'dina', seq: n }, w.phys, 'friccion', ROLES)
      w = stepWorld(w, i === undefined ? [] : [i]).state
      if (Number.isNaN(seca) && leer(w, 'va', 'moisture') < 0.45) seca = n
    }
    expect(seca).toBeLessThan(200)
    expect(leer(w, 'va', 'charred')).toBeGreaterThan(0)
    log([
      '══ (d) FROTAR SECA ════════════════════════════════════════════════════',
      `  una vara con moisture 1,00 baja de los 0,45 que la innata cablea en el paso ${String(seca)} (${(seca / 20).toFixed(2)} s)`,
      `  y para el paso 200 tiene charred ${leer(w, 'va', 'charred').toFixed(3)}: se secó y empezó a pirolizar`,
    ])
  })
})

// ═══ (e) LO QUE RINDE COCINAR CONTRA LO QUE CUESTA ENCENDER ══════════════════

describe('(e) la aritmética que el ADR II-0010 dice venir a desbloquear', () => {
  it.fails('SIGUE ABIERTO · cocinar tendría que pagar el fuego que hace falta para cocinar', () => {
    // POR QUÉ SIGUE ABIERTO: el ADR II-0010 existe, dicho en su primer párrafo,
    // para «desbloquear la calibración del ADR II-0009, que eligió
    // COSTO_VIVIR_POR_SEGUNDO = 1,0 para que comer crudo dé neto negativo y
    // cocinar positivo — y para cocinar hay que poder encender». Encender ya se
    // puede. La aritmética sigue sin cerrar, y por tres órdenes de magnitud.
    //
    // Medido en este mismo archivo, con `eat` de verdad y el libro calórico del
    // mundo:
    //
    //   un pescado de 1 kg crudo      (digestibility 0,380) →  +2,99 de stamina
    //   el mismo a 0,513              (lo que la cadena logra) →  +4,05
    //   el mismo a 0,850              («cocido» del banco hermano) →  +6,75
    //   un pescado de 3 kg a 0,850    →  +20,35
    //
    // O sea que cocinar un pescado de 1 kg vale **+1,06 de stamina** hoy, y +3,76
    // en el mejor de los casos. Encender la vara MÁS BARATA que el mundo permite
    // —madera de 0,2 kg— cuesta **352,71**. Hacen falta 94 pescados por fuego para
    // empatar con lo que la cadena logra hoy, o 94 pescados cocinados en los 17 de
    // 65 pasos en que la vara arde.
    //
    // Y comer crudo NO da neto negativo: da +2,99 contra un costo de vivir de 0,05
    // por paso. La premisa que el ADR II-0010 cita como su motivo es falsa en el
    // mundo tal como está construido, y eso hay que decirlo aunque no sea culpa de
    // este ADR.
    //
    // QUÉ HARÍA FALTA: es del ADR II-0009 y no de éste. O el rendimiento de
    // `nutrition → stamina` sube dos órdenes, o el precio de `friccion` baja dos,
    // o el fuego deja de pagarse por cuerpo y pasa a pagarse una vez (que es el
    // otro hueco abierto: el fuego que sobrevive a la mano). Los tres mueven la
    // calibración del hambre y piden barrido.
    const bocado = (dig: number | undefined, masa: number, sust: string): number => {
      const estado: Record<string, number> = { }
      if (dig !== undefined) estado['digestibility'] = dig
      let w = mundo({
        hz: 20,
        bodies: [
          enElPiso(criatura('dina', 500), EN(0, 0)),
          enLaMano(cuerpo('bocado', sust, masa, estado), EN(0, 0), 'dina'),
        ],
        actors: [actor('dina', { holding: ['bocado'], capacity: 3 })],
      })
      const s0 = leer(w, 'dina-cuerpo', 'stamina')
      w = stepWorld(w, [eat({ by: 'dina', seq: 1 }, 'bocado')]).state
      return leer(w, 'dina-cuerpo', 'stamina') - s0
    }
    const crudo = bocado(undefined, 1, 'pescado')
    const cadena = bocado(0.513, 1, 'pescado')
    const cocido = bocado(0.85, 1, 'pescado')
    // Encender la vara más barata, medido y no copiado.
    const encender = (() => {
      let w = banco(0.2, 20)
      const s0 = leer(w, 'dina-cuerpo', 'stamina')
      for (let n = 1; n <= 60; n++) {
        const i = apply({ by: 'dina', seq: n }, w.phys, 'friccion', ROLES)
        w = stepWorld(w, i === undefined ? [] : [i]).state
        if (leer(w, 'va', 'temperature') >= 375) break
      }
      return s0 - leer(w, 'dina-cuerpo', 'stamina')
    })()
    log([
      '══ (e) LO QUE PAGA COCINAR ════════════════════════════════════════════',
      `  pescado 1 kg crudo (0,380) ......... ${crudo.toFixed(2)} de stamina`,
      `  el mismo a 0,513 (la cadena) ....... ${cadena.toFixed(2)}   → cocinar vale ${(cadena - crudo).toFixed(2)}`,
      `  el mismo a 0,850 (el ideal) ........ ${cocido.toFixed(2)}   → cocinar vale ${(cocido - crudo).toFixed(2)}`,
      `  encender la vara más barata ........ ${encender.toFixed(2)} de stamina`,
      `  pescados por fuego para empatar .... ${Math.ceil(encender / (cadena - crudo)).toFixed(0)}`,
    ])
    // Lo que el hueco afirma: un fuego tiene que pagarse con una cantidad de
    // comida que una criatura pueda juntar. Diez bocados es generoso.
    expect(cadena - crudo).toBeGreaterThanOrEqual(encender / 10)
  })
})

// ═══ (f) EL DETERMINISMO QUE EL CORPUS DEL MUNDO NO TOCABA ═══════════════════

/** Corre `n` pasos frotando y devuelve el estado. Determinista por construcción. */
function correrFrotando(n: number, desde?: WorldState): WorldState {
  let w = desde ?? banco(0.5, 20)
  const primero = desde === undefined ? 1 : w.tick + 1
  for (let k = primero; k < primero + n; k++) {
    const i = apply({ by: 'dina', seq: k }, w.phys, 'friccion', ROLES)
    w = stepWorld(w, i === undefined ? [] : [i]).state
  }
  return w
}

describe('(f) gemelos, snapshot y crónica CON un `drive` de por medio', () => {
  it('`intencionesAlAzar` no emite un solo `apply` de `friccion`: la cobertura no existía', () => {
    // El ADR II-0010 dice, y es cierto, que ninguna huella del mundo se movió y
    // que eso es «consistente con lo declarado» porque `intencionesAlAzar` no
    // emite `friccion`. Lo que sigue de ahí es lo otro: la partida de 2000 ticks,
    // los gemelos, el snapshot y la crónica —el corpus entero de determinismo del
    // paquete— corren SIN un solo `drive`, o sea que `Borrador.empujes`,
    // `anotarEmpuje` y la rama nueva de `entornoDe` no estaban cubiertos por
    // ninguno. Los tres tests de abajo son esa cobertura.
    //
    // Esto se afirma CORRIENDO el generador y no leyéndolo: si alguien le agrega
    // `friccion`, este test se pone rojo y los de abajo dejan de ser necesarios.
    const r = lcg(20260727)
    const clases = new Set<string>()
    for (let i = 0; i < 400; i++) {
      for (const x of intencionesAlAzar(r, ['a', 'b'], 8)) {
        clases.add(x.k === 'apply' ? `apply:${x.process}` : x.k)
      }
    }
    expect([...clases].sort()).toEqual([
      'apply:deshilachar',
      'apply:union',
      'drop',
      'eat',
      'explore',
      'goTo',
      'put',
      'take',
      'wait',
    ])
    expect(clases.has('apply:friccion')).toBe(false)
  })

  it('dos partidas gemelas que frotan dan el mismo `hashWorldState`, paso por paso', () => {
    // No sólo el hash final: el hash de CADA paso. Un empuje que se filtrara al
    // cuerpo equivocado, o un `Map` recorrido en orden distinto, se ve acá y no
    // en el final —donde una divergencia y su compensación dan el mismo número—.
    const a: string[] = []
    const b: string[] = []
    for (const lista of [a, b]) {
      let w = banco(0.5, 20)
      for (let k = 1; k <= 80; k++) {
        const i = apply({ by: 'dina', seq: k }, w.phys, 'friccion', ROLES)
        w = stepWorld(w, i === undefined ? [] : [i]).state
        lista.push(hashWorldState(w))
      }
    }
    expect(a).toEqual(b)
    // Control: que la corrida haya hecho algo. Ochenta hashes iguales entre sí
    // aprobarían este test con un mundo que no se mueve.
    expect(new Set(a).size).toBe(80)
    log([
      '══ (f) GEMELOS QUE FROTAN ═════════════════════════════════════════════',
      `  80 pasos, 80 hashes distintos, los mismos 80 en las dos corridas`,
      `  hash final: ${a[79] as string}`,
    ])
  })

  it('cortar a la mitad, pasar por `JSON.stringify` y seguir reconstruye el hash exacto', () => {
    // El empuje vive en el borrador del tick y no en el estado, así que la
    // afirmación fuerte es que restaurar EN MEDIO de una fricción no pierde nada:
    // el tick 41 tiene que salir igual arrancando del snapshot que corrido de una.
    const directo = correrFrotando(80)
    const mitad = correrFrotando(40)
    const crudo = JSON.parse(JSON.stringify([...worldSlots(mitad)])) as [string, unknown][]
    const restaurado = restoreWorld(new Map(crudo))
    expect(hashWorldState(restaurado)).toBe(hashWorldState(mitad))
    const seguido = correrFrotando(40, restaurado)
    expect(hashWorldState(seguido)).toBe(hashWorldState(directo))
    log([
      '══ (f) SNAPSHOT A MITAD DE FRICCIÓN ═══════════════════════════════════',
      `  hash a los 40 pasos, ida y vuelta por JSON: ${hashWorldState(mitad)}`,
      `  hash a los 80, directo y reanudado: ${hashWorldState(directo)}`,
    ])
  })

  it('el replay del journal reproduce una fricción tick por tick, con checkpoints', () => {
    // Y con `checkpoints`, que es lo que corta en el PRIMER tick que diverge en
    // vez de dejar un hash final distinto sin causa visible.
    const j = createJournal<Intent>({ hz: 20, semilla: 0 })
    let w = banco(0.5, 20)
    const checkpoints = new Map<number, ReturnType<typeof hashWorldState>>()
    for (let k = 1; k <= 80; k++) {
      checkpoints.set(k - 1, hashWorldState(w))
      const i = apply({ by: 'dina', seq: k }, w.phys, 'friccion', ROLES)
      if (i !== undefined) j.append(k - 1, i)
      w = stepWorld(w, i === undefined ? [] : [i]).state
    }
    const final = hashWorldState(w)
    const rehecho = replay<WorldState, Intent>(
      j,
      { tick: 0, state: banco(0.5, 20) },
      (s, ints) => stepWorld(s, ints).state,
      { hasta: 79, checkpoints, hashOf: hashWorldState },
    )
    expect(hashWorldState(rehecho)).toBe(final)
  })
})

