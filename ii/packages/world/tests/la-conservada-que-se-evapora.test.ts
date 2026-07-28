// ═══ LA CONSERVADA QUE SE EVAPORABA, Y EL GUARDIÁN QUE MIRABA PARA UN SOLO LADO ═
//
// `revisarConservacion` sabía decir que ninguna cuenta conservada SUBE. No sabía
// decir nada de las bajadas, y por eso esto pasaba sin una sola violación:
//
//   · una criatura apoyada sobre una fogata de 20 kg se carboniza, la ley 4 le
//     transmuta el cuerpo, y al hacerlo devolvía `state: { temperature }` y tiraba
//     todo lo demás. `stamina` es CONSERVADA y no sale de ninguna sustancia, así
//     que no había de dónde volver a sacarla: **986,35 → 0,00 en un tick**;
//   · el metabolismo encontraba el cero medio segundo después y emitía
//     `murio{por:'hambre'}`. La crónica contaba que se murió de hambre una que se
//     quemó viva;
//   · y `revisarInvariantes` devolvía `[]`.
//
// ─── LOS CRITERIOS, ESCRITOS ANTES DE TOCAR CÓDIGO ──────────────────────────
//
//   (b) alimentar el fuego funciona, CON EL NÚMERO, y se dice cuántos leños de qué
//       masa hacen falta para sostener uno los 1000 s de una partida;
//   (c) dos cuerpos —uno virgen y uno gastado— se distinguen con lo que `Ctx`
//       publica. Acá se mide con `nameOf`, que es lo que `see()` devuelve adentro
//       de cada `BodyView`;
//   (d) ninguna conservada se evapora: la criatura sobre la fogata muere y el
//       invariante lo VE, o muere de otra cosa y el evento dice la verdad.
//
// ─── LO QUE QUEDA ABIERTO, y está declarado ─────────────────────────────────
//
// El invariante nuevo persigue las bajadas de `stamina` y NADA MÁS, porque
// `stamina` es la única conservada que ninguna ley de la física toca. Para `mass`,
// `nutrition` y `fuelEnergy` no se puede hoy: cuatro leyes las bajan
// legítimamente y ninguna declara cuánto. Está abajo con su `it.fails`.

import { describe, expect, it } from 'vitest'
import { dtDeFrecuencia, nameOf, qualityOf } from '@anima/physics'
import { revisarInvariantes, stepWorld } from '../src/index.js'
import type { Intent, Violacion, WorldBody, WorldState } from '../src/index.js'
import { actor, criatura, cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })
const seg = (t: number, hz: number): number => t * dtDeFrecuencia(hz)

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

// ═══ (d) NINGUNA CONSERVADA SE EVAPORA ═══════════════════════════════════════

describe('(d) la criatura sobre la fogata muere de lo que se murió, y con su stamina', () => {
  it('muere QUEMADA a los 13,71 s, la stamina no se mueve y el arnés no ve nada porque no hay nada', () => {
    const bodies: WorldBody[] = [
      enElPiso(cuerpo('fogata', 'madera', 20, { temperature: 700 }), EN(0, 0)),
      { body: criatura('dina', 1000), at: EN(0, 0), supportedBy: 'fogata' },
    ]
    let s: WorldState = mundo({ bodies, actors: [actor('dina')] })
    let muere = Number.NaN
    let antesDeMorir = Number.NaN
    let despuesDeMorir = Number.NaN
    let por = ''
    let violaciones: readonly Violacion[] = []
    for (let t = 1; seg(t, 20) <= 120; t++) {
      const antes = s
      const r = stepWorld(s, [])
      s = r.state
      // Se mira el cambio de MATERIA y no la muerte: lo que se quiere ver es el
      // tick exacto en el que la ley 4 le pasa por encima, que es donde la stamina
      // se evaporaba.
      const a = antes.bodies.get('dina-cuerpo')
      const d = s.bodies.get('dina-cuerpo')
      if (a === undefined || d === undefined) continue
      if (a.body.parts[0]?.substance === d.body.parts[0]?.substance) continue
      muere = seg(t, 20)
      antesDeMorir = qualityOf(a.body, 'stamina', antes.phys)
      despuesDeMorir = qualityOf(d.body, 'stamina', s.phys)
      for (const e of r.events) if (e.k === 'murio') por = e.por
      violaciones = revisarInvariantes(antes, s, r.events)
      break
    }

    // LA STAMINA NO SE MOVIÓ: la ley 4 le cambió la materia y la cuenta que la
    // materia no sabe contestar viajó con el cuerpo.
    expect(antesDeMorir).toBeGreaterThan(900)
    expect(despuesDeMorir).toBe(antesDeMorir)
    // Y el mundo dice de qué se murió.
    expect(por).toBe('quemado')
    expect(muere).toBeCloseTo(13.7, 1)
    // El arnés no ve nada porque no hay nada que ver. La carnada de que sí lo
    // vería está en `ataque-3-al-incendio.test.ts`.
    expect(violaciones).toEqual([])

    log([
      '══ (d) MUERE QUEMADA, Y CON LA STAMINA PUESTA ════════════════════════',
      `  la ley 4 le cambia la materia a los ${muere.toFixed(2)} s`,
      `  stamina ${antesDeMorir.toFixed(2)} → ${despuesDeMorir.toFixed(2)} · el evento dice «${por}» · violaciones ${String(violaciones.length)}`,
      '  (antes: 986,35 → 0,00, el evento decía «hambre» y las violaciones eran 0)',
    ])
  })

  it('el invariante persigue las bajadas de `stamina` y el mundo le declara cuánto gastó', () => {
    // La mitad que hace que el guardián funcione: el mundo emite un evento `gasto`
    // por tick con lo que se llevó de `stamina` —vivir, caminar, y lo que un
    // `poweredBy` paga— y el invariante compara el total contra ese piso.
    //
    // Se mide sobre una partida donde la criatura CAMINA, que es la que más gasta:
    // si el piso estuviera mal calculado, caminar sería una evaporación.
    let s: WorldState = mundo({
      bodies: [enElPiso(criatura('dina', 1000), EN(0, 0))],
      actors: [actor('dina')],
    })
    let gastoTotal = 0
    let violaciones = 0
    const inicial = qualityOf(s.bodies.get('dina-cuerpo')?.body ?? { id: '', form: 'vara', parts: [], joints: [], state: {} }, 'stamina', s.phys)
    for (let t = 1; t <= 400; t++) {
      const antes = s
      const intents: Intent[] = [
        { k: 'goTo', by: 'dina', seq: t, commitment: 'reversible', to: EN(t % 5, 0), within: 0 },
      ]
      const r = stepWorld(s, intents)
      s = r.state
      for (const e of r.events) if (e.k === 'gasto') gastoTotal += e.cuanto
      violaciones += revisarInvariantes(antes, s, r.events).length
    }
    const final = qualityOf(s.bodies.get('dina-cuerpo')?.body ?? { id: '', form: 'vara', parts: [], joints: [], state: {} }, 'stamina', s.phys)
    expect(violaciones).toBe(0)
    // Y el libro CIERRA: lo que declaró haberse llevado es exactamente lo que
    // falta. Si el mundo gastara sin declarar, el invariante saltaría; si
    // declarara de más, esto se cae.
    expect(inicial - final).toBeCloseTo(gastoTotal, 9)
    expect(gastoTotal).toBeGreaterThan(20)
    log([
      '══ (d bis) EL LIBRO CIERRA ═══════════════════════════════════════════',
      `  400 ticks caminando · stamina ${inicial.toFixed(2)} → ${final.toFixed(2)} · el mundo declaró ${gastoTotal.toFixed(6)}`,
      `  violaciones acumuladas: ${String(violaciones)}`,
    ])
  })

  it.fails('SIGUE ABIERTO — las bajadas de `mass`, `nutrition` y `fuelEnergy` nadie las vigila', () => {
    // POR QUÉ SIGUE ABIERTO: no se puede distinguir la bajada legítima de la
    // evaporación sin que cada ley declare cuánto se llevó, y hoy ninguna lo hace.
    //
    //   · la ley 5 evapora agua y con ella `mass` (`escalarMasa(1 − evap)`);
    //   · la ley 3 quema `fuelEnergy` y baja `nutrition` por `1 − charred`;
    //   · la ley 4 tira el 94% de la `mass` y pone `nutrition` en cero;
    //   · la ley 6 pudre `nutrition`.
    //
    // Las cuatro son correctas y ninguna es declarable con lo que `paso()` devuelve
    // hoy: devuelve el cuerpo nuevo y se termina ahí. Cerrarlo pide que `Paso` traiga
    // un libro —cuánto se llevó cada ley, por cuenta— y eso es una decisión sobre el
    // contrato de la física, no una línea del invariante. `stamina` se pudo vigilar
    // porque es la ÚNICA que ninguna ley toca: ver
    // `CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO` en `step.ts`.
    //
    // Lo que este test clava mientras tanto: el agujero, para que el día que se
    // cierre se caiga solo. Se le borra a mano la `nutrition` de un pescado —una
    // evaporación pura, sin ninguna ley detrás— y se le pregunta al guardián.
    const bodies: WorldBody[] = [enElPiso(cuerpo('pez', 'pescado', 2), EN(0, 0))]
    const antes = mundo({ bodies })
    const c = antes.bodies.get('pez') as WorldBody
    const despues: WorldState = {
      ...antes,
      tick: antes.tick + 1,
      bodies: new Map(antes.bodies).set('pez', {
        ...c,
        body: { ...c.body, state: { ...c.body.state, nutrition: 0 } },
      }),
    }
    // Se fue toda la nutrición del mundo y ninguna ley la explica.
    expect(revisarInvariantes(antes, despues, [])).toHaveLength(1)
  })
})

// ═══ (c) LO GASTADO SE DISTINGUE DE LO ENTERO, DESDE LA PERCEPCIÓN ═══════════

describe('(c) la mente no puede confundir un leño con lo que queda de un leño', () => {
  it('el nombre que publica el mundo cambia, y cambia en las nueve masas', () => {
    // La mente del Hito 5 ve `BodyView.name`, que sale de `nameOf(body, phys)`
    // (`perceive/src/vista.ts`). Si un leño gastado se llamara igual que uno
    // entero, iba a juntar el gastado creyendo que sirve.
    //
    // Se corre el mundo de verdad —`stepWorld`, no `paso()`— para que lo que se
    // compara sea lo que la criatura tendría delante.
    const filas: string[] = []
    for (const m of [0.05, 0.2, 0.5, 0.83, 1, 2, 5, 20, 50]) {
      let s: WorldState = mundo({
        bodies: [
          enElPiso(cuerpo('quemado', 'madera', m, { temperature: 700 }), EN(0, 0)),
          enElPiso(cuerpo('entero', 'madera', m), EN(9, 9)),
        ],
      })
      for (let t = 1; t <= Math.round(20 * (50 * m + 20)); t++) s = stepWorld(s, []).state
      const q = s.bodies.get('quemado') as WorldBody
      const e = s.bodies.get('entero') as WorldBody
      const nq = nameOf(q.body, s.phys)
      const ne = nameOf(e.body, s.phys)
      // Se distinguen POR EL NOMBRE, que es lo que `see()` publica…
      expect([m, nq === ne]).toEqual([m, false])
      // …y también por `q(b,'fuelEnergy')`, que es la otra mitad de `Ctx`.
      expect([m, qualityOf(q.body, 'fuelEnergy', s.phys)]).toEqual([m, 0])
      expect([m, qualityOf(e.body, 'fuelEnergy', s.phys) > 0]).toEqual([m, true])
      // Y el entero NO se quemó de rebote: está lejos y sigue entero.
      expect([m, e.body.parts[0]?.substance]).toEqual([m, 'madera'])
      filas.push(`  ${String(m).padStart(5)} kg · entero «${ne}» · gastado «${nq}»`)
    }
    log([
      '══ (c) LO GASTADO SE VE GASTADO ══════════════════════════════════════',
      ...filas,
    ])
  }, 300_000)
})

// ═══ (b) ALIMENTAR EL FUEGO ══════════════════════════════════════════════════

describe('(b) alimentar el fuego, con el número', () => {
  /**
   * Un fuego base ardiendo, y `n` leños de `m` kg que la criatura le tira encima
   * de a uno. Devuelve hasta qué segundo hubo fuego en el mundo.
   *
   * Cada leño se apoya sobre el ANTERIOR y no sobre la base, que es lo que un
   * fuego alimentado es de verdad: la base ya se hizo ceniza cuando entra el
   * tercero, y una ceniza no enciende nada.
   */
  function alimentar(base: number, n: number, m: number, desde: number, cada: number): number {
    const bodies: WorldBody[] = [
      enElPiso(cuerpo('fogata', 'madera', base, { temperature: 700 }), EN(0, 0)),
      enElPiso(criatura('dina', 1000), EN(1, 0)),
    ]
    const manos: string[] = []
    for (let i = 0; i < n; i++) {
      bodies.push({ body: cuerpo(`l${i}`, 'madera', m), at: EN(1, 0), heldBy: 'dina' })
      manos.push(`l${i}`)
    }
    let s: WorldState = mundo({
      bodies,
      actors: [actor('dina', { holding: manos, capacity: n + 2 })],
    })
    let hasta = 0
    let siguiente = 0
    for (let t = 1; t <= 20 * 1400; t++) {
      const intents: Intent[] = []
      if (siguiente < n && t === Math.round(20 * (desde + cada * siguiente))) {
        intents.push({
          k: 'put',
          by: 'dina',
          seq: t,
          commitment: 'reversible',
          what: `l${siguiente}`,
          at: EN(0, 0),
          onTopOf: siguiente === 0 ? 'fogata' : `l${siguiente - 1}`,
        })
        siguiente++
      }
      s = stepWorld(s, intents).state
      for (const c of s.bodies.values()) {
        if (qualityOf(c.body, 'emitsPower', s.phys) > 0) hasta = seg(t, 20)
      }
    }
    return hasta
  }

  it('un fuego alimentado dura más que el mismo fuego sin alimentar, y sostiene los 1000 s', () => {
    // ─── LO QUE MIDE, Y LO QUE NO ──────────────────────────────────────────
    //
    // Alimentar funciona, pero NO como el ADR II-0011 lo prometía. La promesa era
    // «juntar leña ES la respuesta a que el fuego se apague», y juntar leña
    // —apilarla— no lo es: los leños de una pila prenden todos en el primer
    // segundo y arden A LA VEZ, así que cinco de 1 kg dan 50,75 s contra los 50,00
    // de uno solo. Eso está medido en `ataque-3-al-incendio.test.ts`.
    //
    // Lo que sí funciona es REPONER: tirarle un leño nuevo antes de que el que
    // está ardiendo deje de poder encenderlo. Y ahí aparece la otra cota, que no
    // es de esta reparación sino de `emitsPower`: la potencia que un cuerpo irradia
    // sale del combustible que le QUEDA, así que un leño que ya ardió la mitad no
    // enciende a nadie. Un leño de 1 kg sólo puede prender a otro durante sus
    // primeros 12,7 s; uno de 5 kg, durante 250.
    //
    // De ahí la respuesta a «cuántos leños de qué masa»: **cinco de 5 kg**,
    // repuestos cada 230 s, sostienen 1130 s. Con leños de 1 kg no alcanza ni
    // reponiendo, porque la ventana para encender el siguiente es más corta que lo
    // que el anterior dura.
    const sola = alimentar(5, 0, 1, 60, 60)
    const conChicos = alimentar(5, 4, 1, 200, 40)
    const conGrandes = alimentar(5, 4, 5, 200, 230)
    const unTronco = alimentar(21, 0, 1, 60, 60)

    // La base sola: 250 s, que son los 50 s por kilo de sus 5 kg.
    expect(sola).toBeCloseTo(250, 0)
    // Reponer con leños de 1 kg NO COMPRA NADA, y el porqué está medido: el
    // primero SÍ prende —la base de 5 kg irradia 501 y lo pone a 616 °C— pero se
    // apaga junto con ella, y los otros tres se apoyan sobre uno que ya gastó la
    // mitad y que sólo llega a ponerlos a 303 °C, tres grados arriba de su
    // ignición y por muy poco tiempo. Es el mismo número que sin alimentar.
    expect(conChicos).toBeCloseTo(sola, 0)
    // Reponer con leños de 5 kg SÍ funciona, y sostiene una partida entera.
    expect(conGrandes).toBeGreaterThan(1000)
    // Y un solo tronco de 21 kg también, sin reponer nada: 50 × 21 = 1050 s.
    expect(unTronco).toBeGreaterThan(1000)

    log([
      '══ (b) ALIMENTAR EL FUEGO ════════════════════════════════════════════',
      `  base de 5 kg sola ............................ ${sola.toFixed(2)} s`,
      `  base de 5 kg + 4 de 1 kg desde 200 s cada 40 . ${conChicos.toFixed(2)} s`,
      `  base de 5 kg + 4 de 5 kg desde 200 s cada 230  ${conGrandes.toFixed(2)} s`,
      `  UN tronco de 21 kg, sin reponer nada ......... ${unTronco.toFixed(2)} s`,
      '',
      '  para sostener los 1000 s de una partida: CINCO leños de 5 kg repuestos',
      '  cada 230 s, o UNO de 21 kg. Con leños de 1 kg no alcanza — no porque duren',
      '  poco sino porque un leño medio gastado ya no puede encender al siguiente.',
      '',
      '  ANTES de la reparación, la misma tabla daba 50 s en las cuatro filas: la',
      '  duración no dependía de la masa arriba de 0,83 kg y no había con qué.',
    ])
    // Cuatro partidas de 28 000 ticks cada una, y el techo por omisión de vitest
    // son 5 s.
  }, 300_000)
})
