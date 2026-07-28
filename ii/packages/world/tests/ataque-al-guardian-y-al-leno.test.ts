// ═══ EL ADVERSARIO DEL GUARDIÁN NUEVO, Y DEL LEÑO QUE NO EXISTE ══════════════
//
// Dos cosas que el tramo anterior dejó adentro sin medir, y una tercera que la
// reparación de la ley 3 pone en duda.
//
//   (A) `revisarConservacion` aprendió a perseguir las BAJADAS. Un invariante que
//       grita en falso se termina apagando, así que la primera pregunta es si
//       salta donde no debe — y la segunda, más incómoda, es si el piso que
//       inventó tiene fondo. NO LO TIENE: `loQueSeFueConLosCuerpos` le perdona a
//       la bajada TODO lo que viajaba en un cuerpo que dejó de existir, sin
//       preguntar quién lo recibió. Medido: un cuerpo con 999 de `stamina` que
//       alguien se come acredita 6,08 y borra 992,97, con CERO violaciones;
//   (B) la ley 4 le tira el 94% de la masa a las partes MINERALES de un cuerpo
//       mixto, y `mass` no está en `CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO`, así que
//       tampoco eso lo ve nadie. El hacha entera: 0,7000 → 0,0420 kg, sin una
//       violación;
//   (C) la cuenta del fuego se hace con leños de 5, 20 y 21 kg. **El dios no
//       siembra ninguno.** Medido sobre 30 semillas × 64 chunks: la madera más
//       gorda del mundo pesa 2,991 kg y el cuerpo que arde más tiempo del mundo
//       entero es una `madera-dura` de 3,999 kg que da 200,0 s.
//
// Y una que se verificó y NO se rompió, con su matiz: tapar sigue dando carbón,
// pero en el mundo eso pide que la TAPA SEA COMBUSTIBLE. Con una tapa de arcilla
// o de piedra no sale nada — ni carbón ni ceniza —, porque la ventana del carbón
// (oxígeno < 0,35) y la ventana de la llama que se sostiene (oxígeno ≥ 0,475) son
// DISJUNTAS.

import { describe, expect, it } from 'vitest'
import { FRECUENCIAS_ADMISIBLES, nameOf, totalConservado } from '@anima/physics'
import { resolveChunk } from '@anima/oracle'
import { hashWorldState, revisarInvariantes, stepWorld } from '../src/index.js'
import type { Intent, Violacion, WorldBody, WorldState } from '../src/index.js'
import { actor, criatura, cuerpo, enElPiso, huella, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

function totalDe(w: WorldState, q: 'stamina' | 'mass'): number {
  let t = 0
  for (const c of w.bodies.values()) t += totalConservado(c.body, q, w.phys)
  return t
}

// ═══ (A) EL GUARDIÁN: DONDE SALTA Y DONDE NO ═════════════════════════════════

describe('(A) el guardián de la conservación, de los dos lados', () => {
  it('NO salta en falso: quemar, transmutar, comer y morir quemada, en 200 s y a las cinco', () => {
    // Las cuatro cosas que bajan conservadas LEGÍTIMAMENTE, todas juntas y con
    // actores de verdad: una fogata que arde y transmuta, un pescado sobre ella
    // que se cocina, una criatura APOYADA ENCIMA —la carnada que le costó la vida
    // a la generación anterior— y otra que come.
    //
    // Y a las cinco frecuencias, porque el piso del invariante compara totales
    // entre dos ticks y el tamaño del paso decide cuánto se movió cada uno.
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const bodies: WorldBody[] = [
        enElPiso(cuerpo('fogata', 'madera', 3, { temperature: 700 }), EN(0, 0)),
        { body: criatura('dina', 1000), at: EN(0, 0), supportedBy: 'fogata' },
        { body: cuerpo('asado', 'pescado', 0.8, { moisture: 0.5 }), at: EN(0, 0), supportedBy: 'dina-cuerpo' },
        enElPiso(criatura('rita', 1000), EN(3, 0)),
        { body: cuerpo('cena', 'pescado', 1, { moisture: 0.2 }), at: EN(3, 0), heldBy: 'rita' },
        enElPiso(cuerpo('mojado', 'madera', 1, { moisture: 0.9 }), EN(4, 0)),
      ]
      let s: WorldState = mundo({
        hz,
        bodies,
        actors: [actor('dina'), actor('rita', { holding: ['cena'] })],
        cells: [[EN(0, 0), { wet: 0, oxygen: 1, temperature: 15 }]],
      })
      const violaciones: Violacion[] = []
      const muertes: string[] = []
      let comio = false
      for (let t = 1; t <= Math.round(hz * 200); t++) {
        const antes = s
        // Que rita coma a los 10 s, cuando la fogata ya transmutó a nadie todavía.
        const intents: Intent[] =
          !comio && t === Math.round(hz * 10)
            ? [{ k: 'eat', by: 'rita', seq: t, commitment: 'irreversible', what: 'cena' }]
            : []
        if (intents.length > 0) comio = true
        const p = stepWorld(s, intents)
        s = p.state
        for (const v of revisarInvariantes(antes, s, p.events)) violaciones.push(v)
        for (const e of p.events) if (e.k === 'murio') muertes.push(`${e.id}/${e.por}`)
      }
      // CERO violaciones, con las cuatro leyes que bajan conservadas corriendo.
      expect([hz, violaciones]).toEqual([hz, []])
      // Y la carnada murió de lo que se murió: QUEMADA y no de hambre.
      expect([hz, muertes.includes('dina-cuerpo/quemado')]).toEqual([hz, true])
      expect([hz, muertes.some((m) => m.endsWith('/hambre'))]).toEqual([hz, false])
      filas.push(`  ${String(hz).padStart(3)} Hz · 0 violaciones · muertes: ${muertes.join(', ')}`)
    }
    log([
      '══ (A) EL GUARDIÁN NO GRITA EN FALSO ═════════════════════════════════',
      ...filas,
      '  quemar, transmutar, cocinar, comer y morir quemada, todo junto y a las cinco.',
    ])
  }, 900_000)

  it('SÍ salta cuando la `stamina` desaparece de verdad, y lo dice con los dos números', () => {
    // La otra mitad. Se le borra la `stamina` a mano a un cuerpo —una evaporación
    // pura, sin ninguna ley detrás— y se le pregunta al guardián.
    const antes = mundo({ bodies: [enElPiso(criatura('dina', 900), EN(0, 0))], actors: [actor('dina')] })
    const c = antes.bodies.get('dina-cuerpo') as WorldBody
    const despues: WorldState = {
      ...antes,
      tick: antes.tick + 1,
      bodies: new Map(antes.bodies).set('dina-cuerpo', {
        ...c,
        body: { ...c.body, state: { ...c.body.state, stamina: 0 } },
      }),
    }
    const v = revisarInvariantes(antes, despues, [])
    expect(v.length).toBe(1)
    const u = v[0] as Violacion & { k: 'conservada-evaporada' }
    expect(u.k).toBe('conservada-evaporada')
    expect(u.antes).toBe(900)
    expect(u.despues).toBe(0)
    expect(u.gastado).toBe(0)
    expect(u.conLosQueSeFueron).toBe(0)
  })

  it.fails('SIGUE ABIERTO — borrar el cuerpo lava la cuenta: 992,97 de `stamina` sin una violación', () => {
    // POR QUÉ SIGUE ABIERTO: el piso de la bajada es `antes − gastado − idos`, y
    // `idos` es `loQueSeFueConLosCuerpos` (`world/src/invariants.ts:212`), que suma
    // TODO lo conservado que viajaba en un cuerpo que dejó de existir. El
    // comentario dice por qué existe —«comer BORRA el cuerpo comido»— y es cierto.
    // Lo que no dice es que el término no tiene tope y no pregunta quién recibió
    // nada: `sacarCuerpo` es el mismo camino para comer, para `union` y para
    // cualquier proceso que el modelo escriba mañana, así que **cualquier borrado
    // de cuerpo es una amnistía por el monto que ese cuerpo llevara encima**.
    //
    // Medido acá: un pescado con `stamina` 999 escrita. Rita se lo come, el mundo
    // declara `convierte nutrition→stamina acreditado 6,08`, el total del mundo
    // cae 992,97 y `revisarInvariantes` devuelve la lista vacía. Es exactamente la
    // forma del agujero que este guardián vino a cerrar, entrando por la puerta
    // que el guardián dejó abierta.
    //
    // Y es alcanzable sin escribir `stamina` a mano: una criatura muerta QUEMADA
    // conserva 985,85 de `stamina` en sus restos (lo mide el (A) de arriba), y
    // esos restos son un cuerpo como cualquier otro.
    //
    // QUÉ HARÍA FALTA, en `world/src/invariants.ts`: que el término no sea «lo que
    // se fue» sino «lo que se fue Y ALGUIEN DECLARÓ HABERSE LLEVADO». O sea, que
    // `sacarCuerpo` anote en el libro del tick un evento por cuerpo borrado con lo
    // conservado que llevaba —hoy hay `murio`, que dice el id y la causa pero no
    // el monto— y que el piso sume ese libro en vez de recorrer `antes`. Es un
    // cambio en el contrato de los eventos del tick, no una línea del invariante.
    const bodies: WorldBody[] = [
      enElPiso(criatura('rita', 500), EN(0, 0)),
      { body: cuerpo('pez', 'pescado', 2, { stamina: 999, moisture: 0.2 }), at: EN(0, 0), heldBy: 'rita' },
    ]
    const antes = mundo({ bodies, actors: [actor('rita', { holding: ['pez'] })] })
    const p = stepWorld(antes, [
      { k: 'eat', by: 'rita', seq: 1, commitment: 'irreversible', what: 'pez' },
    ])
    const perdido = totalDe(antes, 'stamina') - totalDe(p.state, 'stamina')
    expect(perdido).toBeGreaterThan(900)
    // Con 992,97 de `stamina` evaporados, el guardián tendría que decir algo.
    expect(revisarInvariantes(antes, p.state, p.events)).not.toEqual([])
  })
})

// ═══ (B) LA MASA MINERAL QUE SE VA, Y NADIE LA VE ════════════════════════════

describe('(B) el hacha en el fuego', () => {
  it.fails('SIGUE ABIERTO — 300 g de pedernal terminan en 18 g de ceniza, con cero violaciones', () => {
    // POR QUÉ SIGUE ABIERTO: son dos agujeros que se tocan y ninguno se cierra
    // solo.
    //
    //   · la ley 4 transmuta TODAS las partes (`physics/src/leyes.ts:1381`),
    //     incluidas las que ninguna ley podría haber quemado. El borde está medido
    //     en `physics/tests/ataque-al-borde-del-fuego.test.ts`, en (3);
    //   · y `mass` no está en `CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO`
    //     (`world/src/step.ts:1657`), así que el guardián de las bajadas ni la
    //     mira. Eso ya tiene su `it.fails` en `la-conservada-que-se-evapora.test.ts:135`
    //     con el motivo correcto —cuatro leyes la bajan legítimamente—, y lo que
    //     este test agrega es que hay un quinto caso que NO es legítimo y que se
    //     esconde adentro de los otros cuatro.
    //
    // QUÉ HARÍA FALTA: cerrar el primero. Mientras la ley 4 pueda convertir
    // pedernal en ceniza de madera, ningún invariante sobre `mass` puede
    // distinguir eso de un leño que se quemó — los dos son «la ley 4 se llevó el
    // 94%».
    //
    // Lo que queda clavado: que la cabeza del hacha siga pesando lo que pesaba.
    const hacha = {
      id: 'hacha',
      form: 'vara' as const,
      parts: [
        { substance: 'madera', mass: 0.4, q: {} },
        { substance: 'pedernal', mass: 0.3, q: {} },
      ],
      joints: [],
      state: { temperature: 700 },
    }
    let s: WorldState = mundo({ bodies: [enElPiso(hacha, EN(0, 0))] })
    const m0 = totalDe(s, 'mass')
    const violaciones: Violacion[] = []
    for (let t = 1; t <= 20 * 60; t++) {
      const antes = s
      const p = stepWorld(s, [])
      s = p.state
      for (const v of revisarInvariantes(antes, s, p.events)) violaciones.push(v)
    }
    const c = s.bodies.get('hacha') as WorldBody
    // Lo que PASA hoy, dicho antes de pedir lo que debería pasar: la masa se fue y
    // nadie dijo nada. Estas dos líneas describen el bug y por eso NO se invierten.
    expect(totalDe(s, 'mass')).toBeCloseTo(0.042, 4)
    expect(violaciones).toEqual([])
    // Y esto es lo que el mundo debería sostener.
    expect(m0 - totalDe(s, 'mass')).toBeLessThan(0.4)
    expect(nameOf(c.body, s.phys)).toContain('pedernal')
  }, 300_000)
})

// ═══ (C) EL LEÑO GRANDE NO EXISTE ════════════════════════════════════════════

describe('(C) de dónde sale el leño de la cuenta', () => {
  it('30 semillas × 64 chunks: la madera más gorda pesa 2,991 kg y el fuego más largo dura 200 s', () => {
    // La cuenta del fuego del ADR II-0009 y la receta de
    // `la-conservada-que-se-evapora.test.ts:258` —«CINCO leños de 5 kg repuestos
    // cada 230 s, o UNO de 21 kg»— se miden sobre cuerpos que se escriben a mano.
    // Acá se le pregunta al dios cuál es el más gordo que sabe hacer.
    //
    // El techo lo pone la tabla de biomas de `oracle/src/bioma.ts`, y no hay
    // ninguna fila que pase de 5 kg: `piedra` en el roquedal (0,2 a 5) es la más
    // pesada de todas, y la más pesada que ARDE es `madera-dura` en el bosque
    // (0,5 a 4).
    const FUEL: Record<string, number> = {
      madera: 18,
      'madera-dura': 21,
      'madera-verde': 15,
      corteza: 16,
      'hoja-seca': 17,
      junco: 15,
      liana: 14,
      raiz: 13,
      'raiz-dura': 6,
      hueso: 4,
      grano: 7,
      hoja: 2,
      tuberculo: 3,
      hongo: 1,
    }
    let maxMasa = 0
    let maxArde = 0
    let quien = ''
    let sueltas = 0
    for (let seed = 1n; seed <= 30n; seed++) {
      for (let cx = -4; cx <= 3; cx++) {
        for (let cy = -4; cy <= 3; cy++) {
          for (const s of resolveChunk(seed, cx, cy).sueltas) {
            sueltas++
            const m = Number(s.masa) / 1000
            if (m > maxMasa) maxMasa = m
            const fe = FUEL[s.substance]
            if (fe === undefined) continue
            const dura = Math.min(50, fe / 0.3) * m
            if (dura > maxArde) {
              maxArde = dura
              quien = `${s.substance} de ${m.toFixed(3)} kg`
            }
          }
        }
      }
    }
    expect(sueltas).toBeGreaterThan(15000)
    // Nada de lo que el dios siembra pasa de 5 kg, y el fuego de un solo cuerpo
    // tiene techo en 200 s. Los 1000 s de una partida NO salen de un cuerpo.
    expect(maxMasa).toBeLessThan(5)
    expect(maxArde).toBeLessThan(210)
    expect(maxArde).toBeGreaterThan(190)
    log([
      '══ (C) EL TECHO DEL DIOS ═════════════════════════════════════════════',
      `  ${String(sueltas)} cuerpos sueltos decretados`,
      `  el más pesado de cualquier materia .... ${maxMasa.toFixed(3)} kg`,
      `  el fuego más largo de UN cuerpo ....... ${maxArde.toFixed(1)} s (${quien})`,
      '',
      '  la receta publicada pide cinco leños de 5 kg o uno de 21. Ninguno de los',
      '  dos existe: hay que UNIR, y unir cuesta, y eso todavía no está medido.',
    ])
  }, 600_000)

  it.fails('SIGUE ABIERTO — la receta de los 1000 s se escribe con cuerpos que el mundo no hace', () => {
    // POR QUÉ SIGUE ABIERTO: `la-conservada-que-se-evapora.test.ts:258` concluye
    // «para sostener los 1000 s de una partida: CINCO leños de 5 kg repuestos cada
    // 230 s, o UNO de 21 kg», y las dos masas están por encima del techo del dios
    // —3,999 kg, medido arriba—. La conclusión es correcta sobre el motor y
    // **inejecutable sobre el mundo decretado**.
    //
    // QUÉ HARÍA FALTA, y son dos caminos y hay que elegir uno:
    //   · medir el camino de `union` —juntar tres leños de 3 kg en uno de 9— con
    //     su costo en stamina, su cupo de mano (`capacity`) y su techo de
    //     portabilidad (`PORTABLE_MAX_MASS` = 8 en `physics/src/quality.ts:144`,
    //     que ya deja afuera al de 21 kg), y reescribir la receta con eso;
    //   · o subir el techo de `siembra('madera', …)` en `oracle/src/bioma.ts:336`,
    //     que es mover el mundo para que una cuenta cierre y hay que decirlo así.
    //
    // Lo que queda clavado: que el dios sepa hacer el leño que la receta pide.
    let maxArde = 0
    for (let seed = 1n; seed <= 30n; seed++) {
      for (let cx = -4; cx <= 3; cx++) {
        for (let cy = -4; cy <= 3; cy++) {
          for (const s of resolveChunk(seed, cx, cy).sueltas) {
            if (s.substance !== 'madera' && s.substance !== 'madera-dura') continue
            const dura = 50 * (Number(s.masa) / 1000)
            if (dura > maxArde) maxArde = dura
          }
        }
      }
    }
    expect(maxArde).toBeGreaterThan(1000)
  }, 600_000)
})

// ═══ (D) TAPAR, EN EL MUNDO Y NO EN UN `Entorno` A MANO ══════════════════════

describe('(D) la técnica emblema, corrida por `stepWorld`', () => {
  it('las dos ventanas son disjuntas: entre 0,35 y 0,475 de oxígeno no pasa NADA', () => {
    // El carbón pide `oxygen < OXIGENO_QUE_HACE_CENIZA` (0,35). Sostener la llama
    // pide que la meseta `15 + 600·oxígeno` pase el `ignitionPoint` de la madera
    // (300), o sea `oxygen ≥ 0,475`. Las dos condiciones no se cumplen juntas.
    //
    // En `@anima/physics` eso no se nota porque los tests le pasan una `fuente`
    // escrita a mano —una fogata al lado que no está en la celda tapada—. En el
    // mundo la fogata está adentro de la celda que uno tapó, y ahí la cuenta se
    // cierra sola.
    const filas: string[] = []
    const resultados = new Map<number, string>()
    for (const ox of [0.2, 0.34, 0.4, 0.475, 0.6, 1]) {
      let s: WorldState = mundo({
        bodies: [
          enElPiso(cuerpo('fogata', 'madera', 3, { temperature: 700 }), EN(0, 0)),
          { body: cuerpo('leno', 'madera', 1, {}), at: EN(0, 0), supportedBy: 'fogata' },
        ],
        cells: [[EN(0, 0), { wet: 0, oxygen: ox, temperature: 15 }]],
      })
      let residuo = 'NADA'
      for (let t = 1; t <= 20 * 400; t++) {
        s = stepWorld(s, []).state
        const l = s.bodies.get('leno') as WorldBody
        const sub = l.body.parts[0]?.substance as string
        if (residuo === 'NADA' && sub !== 'madera') residuo = sub
      }
      resultados.set(ox, residuo)
      filas.push(`  oxígeno ${ox.toFixed(3)} · el leño termina en ${residuo}`)
    }
    // Debajo de 0,475 no pasa nada, y arriba sale ceniza. Carbón: nunca.
    expect(resultados.get(0.2)).toBe('NADA')
    expect(resultados.get(0.34)).toBe('NADA')
    expect(resultados.get(0.4)).toBe('NADA')
    expect(resultados.get(0.475)).toBe('residuo-mineral-de-madera')
    expect(resultados.get(1)).toBe('residuo-mineral-de-madera')
    log([
      '══ (D) LA CELDA POBRE EN OXÍGENO ═════════════════════════════════════',
      ...filas,
      '  ninguna fila da carbón: bajar el oxígeno apaga la llama antes de cambiarle',
      '  la clase al residuo.',
    ])
  }, 900_000)

  it('y el carbón SÍ sale — con una tapa que además arde, que es lo que nadie había dicho', () => {
    // La salida existe y es bonita: si la tapa es COMBUSTIBLE, la tapa arde y le
    // pone al leño el calor que la celda pobre en oxígeno ya no puede sostener. Con
    // una tapa de madera el oxígeno queda en 0,296 —por debajo de los 0,35 que
    // deciden la clase— y el leño sale tizón.
    //
    // Con arcilla, piedra o pedernal —lo que uno taparía un pozo de carbón— no
    // sale nada. Ésa es la técnica que el mundo tiene hoy, y no es la que el ADR
    // II-0002 describe.
    const filas: string[] = []
    const salida = new Map<string, string>()
    for (const tapa of ['arcilla', 'piedra', 'pedernal', 'cuero', 'madera', 'hoja']) {
      let s: WorldState = mundo({
        bodies: [
          enElPiso(cuerpo('fogata', 'madera', 3, { temperature: 700 }), EN(0, 0)),
          { body: cuerpo('leno', 'madera', 1, {}), at: EN(0, 0), supportedBy: 'fogata' },
          { body: cuerpo('tapa', tapa, 1, {}), at: EN(0, 0), covering: 'leno' },
        ],
      })
      let residuo = 'NADA'
      for (let t = 1; t <= 20 * 300; t++) {
        s = stepWorld(s, []).state
        const l = s.bodies.get('leno') as WorldBody
        const sub = l.body.parts[0]?.substance as string
        if (residuo === 'NADA' && sub !== 'madera') residuo = sub
      }
      salida.set(tapa, residuo)
      filas.push(`  tapa de ${tapa.padEnd(9)} → ${residuo}`)
    }
    expect(salida.get('arcilla')).toBe('NADA')
    expect(salida.get('piedra')).toBe('NADA')
    expect(salida.get('pedernal')).toBe('NADA')
    expect(salida.get('madera')).toBe('residuo-carbonoso-de-madera')
    log([
      '══ (D bis) LA TAPA QUE ARDE ══════════════════════════════════════════',
      ...filas,
      '  el único carbón que el mundo sabe hacer hoy pide tapar el fuego con leña.',
    ])
  }, 900_000)
})

// ═══ (E) DETERMINISMO, CON FUEGO Y TRANSMUTACIÓN ADENTRO ═════════════════════

describe('(E) dos mundos gemelos con fuego, y uno que pasó por `JSON.stringify`', () => {
  it('mismo hash, misma huella, y el JSON no mueve nada — a las cinco frecuencias', () => {
    const arma = (hz: number): WorldState =>
      mundo({
        hz,
        bodies: [
          enElPiso(cuerpo('fogata', 'madera', 3, { temperature: 700 }), EN(0, 0)),
          { body: cuerpo('leno', 'madera', 1, {}), at: EN(0, 0), supportedBy: 'fogata' },
          { body: cuerpo('tapa', 'madera', 1, {}), at: EN(0, 0), covering: 'leno' },
          enElPiso(cuerpo('pez', 'pescado', 0.5, { moisture: 0.4 }), EN(1, 0)),
        ],
      })
    const filas: string[] = []
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      let a = arma(hz)
      let b = arma(hz)
      for (let t = 1; t <= Math.round(hz * 200); t++) {
        a = stepWorld(a, []).state
        b = stepWorld(b, []).state
      }
      expect([hz, hashWorldState(a)]).toEqual([hz, hashWorldState(b)])
      expect([hz, huella(a)]).toEqual([hz, huella(b)])
      // La ley 4 corrió: hay una sustancia que no estaba en la semilla.
      const sub = (a.bodies.get('leno') as WorldBody).body.parts[0]?.substance as string
      expect([hz, sub]).toEqual([hz, 'residuo-carbonoso-de-madera'])

      // Y ahora el estado por `JSON.stringify` y de vuelta. `phys` se lleva la
      // sustancia inventada, que es lo que un `Map` mal serializado se comería.
      const crudo = JSON.stringify({ bodies: [...a.bodies.values()], cells: [...a.cells.entries()] })
      const vuelto = JSON.parse(crudo) as { bodies: WorldBody[] }
      const rehecho: WorldState = {
        ...a,
        bodies: new Map(vuelto.bodies.map((c) => [c.body.id, c])),
      }
      expect([hz, hashWorldState(rehecho)]).toEqual([hz, hashWorldState(a)])
      // Y sigue corriendo igual, que es lo que el hash solo no prueba.
      let c1 = a
      let c2 = rehecho
      for (let t = 1; t <= Math.round(hz * 40); t++) {
        c1 = stepWorld(c1, []).state
        c2 = stepWorld(c2, []).state
      }
      expect([hz, hashWorldState(c1)]).toEqual([hz, hashWorldState(c2)])
      filas.push(`  ${String(hz).padStart(3)} Hz · ${hashWorldState(a)} → (JSON) → ${hashWorldState(c2)}`)
    }
    log(['══ (E) GEMELOS Y JSON ════════════════════════════════════════════════', ...filas])
  }, 900_000)
})
