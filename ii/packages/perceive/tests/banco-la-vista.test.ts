/**
 * EL BANCO DE LA PERCEPCIÓN. Los números con los que se tomaron las decisiones
 * (a) y (b) del tramo B, medidos y no argumentados.
 *
 *   (a) `see(w)` no puede ser O(cuerpos del mundo). Se comparan los dos caminos
 *       posibles sobre el mismo mundo del banco del Hito 2 —5000 cuerpos— con
 *       diez `see()` por tick, que es la carga que el enunciado nombra.
 *   (b) mutar `at` no puede mover al cuerpo, y clonar una celda por cuerpo y por
 *       tick es el gasto que el Hito 2 se pasó cuatro semanas sacando. Se miden
 *       las dos alternativas y la que se eligió.
 *
 * Este archivo usa `performance.now()` y es el ÚNICO del paquete que lo hace:
 * medir es del banco, no del mundo. El guardián de la regla 2
 * (`ataque-determinismo.test.ts`) lee `src/` y por eso no lo ve.
 *
 * Los números son de esta máquina y van a cambiar en otra. Lo que NO cambia es
 * la relación entre las columnas, que es lo que decide.
 */

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, qualityOf } from '@anima/physics'
import type { Physics, QualityId } from '@anima/physics'
import type { WorldBody, WorldState } from '@anima/world'

import { IndiceDelTick, Proyeccion, RADIO_DE_PERCEPCION } from '../src/index.js'
import { actor, criatura, lcg, mundo } from './mundo.js'
import { CONTRA_EL_RELOJ, NO_SE_AFIRMA } from './reloj-de-pared.js'

const CUERPOS = 5000
const MIRADAS_POR_TICK = 10
const TICKS = 20

/**
 * EL PATRÓN YA DECIDIDO DEL PROYECTO PARA LOS MILISEGUNDOS DE PARED, aplicado
 * acá porque a este archivo le faltaba y se puso rojo por eso.
 *
 * Está escrito entero en `world/tests/banco-el-tick.test.ts`: «un test de
 * rendimiento adentro de la suite normal es un test flaky, y un test flaky es
 * peor que ninguno: enseña a ignorar el rojo». `pnpm ii:test` corre los nueve
 * paquetes EN PARALELO.
 *
 * LO QUE SE MIDIÓ ACÁ, y por eso este cerco existe: el «primer tick» de (b)
 * —congelar 5000 objetos por primera vez, o sea JIT y caché fría— contra su
 * techo de 2 ms dio, cinco corridas seguidas con el paquete SOLO:
 *
 *     2,858 · 0,787 · 0,496 · 0,681 · 0,808 ms
 *
 * o sea que UNA de cada cinco se pasa del techo sin que nadie haya tocado el
 * código, y corriendo al lado de los otros paquetes dio 2,945 y 3,026. El número
 * que gobierna la decisión (b) no es ése —es el de régimen, el de los ticks
 * siguientes, que asigna cero— y ése sigue afirmado siempre.
 */
const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

const SUSTANCIAS = ['madera', 'piedra', 'liana', 'hoja', 'carne', 'arcilla', 'hueso', 'junco']

/** El mundo del banco del Hito 2: 5000 cuerpos repartidos, y una criatura. */
function mundoGrande(): WorldState {
  const r = lcg(4242)
  const cuerpos: WorldBody[] = [{ body: criatura('ella', 900), at: { x: 0, y: 0 } }]
  for (let i = 0; i < CUERPOS; i++) {
    const s = SUSTANCIAS[r.entero(SUSTANCIAS.length)] as string
    cuerpos.push({
      body: {
        id: `c${String(i).padStart(5, '0')}`,
        form: 'vara',
        parts: [{ substance: s, mass: 0.2 + r.entero(50) / 10, q: {} }],
        joints: [],
        state: {},
      },
      // Repartidos en un cuadrado de 200×200: el radio de percepción cubre una
      // fracción, que es la situación real de una criatura en un mundo grande.
      at: { x: r.entero(201) - 100, y: r.entero(201) - 100 },
    })
  }
  return mundo({ bodies: cuerpos, actors: [actor('ella')] })
}

const PREDICADO: readonly { q: QualityId; op: '>='; v: number }[] = [
  { q: 'rigidity', op: '>=', v: 0.5 },
]

/** OPCIÓN A: `see()` recorre `state.bodies` en cada llamada. Es lo que hace el mundito. */
function verRecorriendoTodo(w: WorldState, phys: Physics): number {
  let n = 0
  for (const c of w.bodies.values()) {
    let ok = true
    for (const t of PREDICADO) if (qualityOf(c.body, t.q, phys) < t.v) ok = false
    if (ok) n++
  }
  return n
}

function cronometro(f: () => void): number {
  const a = performance.now()
  f()
  return performance.now() - a
}

/**
 * El MEJOR de cinco, y hay que decir por qué no es el promedio.
 *
 * La primera versión medía una sola pasada y el número saltaba de 1,60 a 2,53
 * ms según se corriera el archivo solo o con los otros seis del paquete: el
 * proceso es compartido, así que la corrida arrastra la basura del test
 * anterior y la pausa del recolector cae donde cae. El promedio mide eso; el
 * mínimo mide el trabajo, que es lo que se está comparando. Es la misma razón
 * por la que un banco reporta el p50 y no el promedio con la cola adentro.
 */
function mejorDe(veces: number, f: () => void): number {
  let mejor = Number.POSITIVE_INFINITY
  for (let i = 0; i < veces; i++) {
    const t = cronometro(f)
    if (t < mejor) mejor = t
  }
  return mejor
}

describe('(a) `see()` no puede ser O(cuerpos del mundo)', () => {
  it('los dos caminos, medidos sobre 5000 cuerpos y diez miradas por tick', () => {
    const w = mundoGrande()
    const phys = w.phys

    // Calentar los dos: la primera pasada paga el JIT y la memoización de
    // `qualityOf`, y medir eso sería medir el motor.
    verRecorriendoTodo(w, phys)
    new Proyeccion(new IndiceDelTick(w)).aLaVista({ x: 0, y: 0 }, 'ella')

    const msTodo = mejorDe(5, () => {
      for (let t = 0; t < TICKS; t++) {
        for (let k = 0; k < MIRADAS_POR_TICK; k++) verRecorriendoTodo(w, phys)
      }
    })

    const msIndice = mejorDe(5, () => {
      for (let t = 0; t < TICKS; t++) {
        // UNA proyección por tick, compartida por todas las miradas: es el punto
        // entero del diseño. El armado del índice se paga una vez.
        const proy = new Proyeccion(new IndiceDelTick(w))
        for (let k = 0; k < MIRADAS_POR_TICK; k++) {
          const vistos = proy.aLaVista({ x: 0, y: 0 }, 'ella')
          for (const b of vistos) {
            const c = w.bodies.get(b.id)!
            for (const t2 of PREDICADO) qualityOf(c.body, t2.q, phys)
          }
        }
      }
    })

    const porTickTodo = msTodo / TICKS
    const porTickIndice = msIndice / TICKS
    // El presupuesto: el tick a 20 Hz son 50 ms, y el mundo ya se lleva el 17,6%
    // (ADR II-0007). La percepción no puede llevarse otro tanto.
    console.log(
      [
        '',
        '─── (a) `see()` con 5000 cuerpos, 10 miradas por tick ───',
        `A · recorrer todos los cuerpos en cada mirada   ${porTickTodo.toFixed(3)} ms/tick  (${((porTickTodo / 50) * 100).toFixed(1)}% del tick a 20 Hz)`,
        `C · índice de celdas compartido + radio ${String(RADIO_DE_PERCEPCION)}        ${porTickIndice.toFixed(3)} ms/tick  (${((porTickIndice / 50) * 100).toFixed(1)}% del tick)`,
        `                                        razón   ${(porTickTodo / porTickIndice).toFixed(1)}×`,
        '',
      ].join('\n'),
    )
    // LAS DOS COTAS, y hay que decir de dónde sale cada una porque la primera que
    // se escribió —«menos de 1 ms»— la medición la rebotó dos veces: 1,60 ms
    // corriendo el archivo solo y 2,53 corriendo los siete del paquete en el
    // mismo proceso. O sea que un umbral absoluto sobre una sola pasada mide el
    // ruido y no el trabajo.
    //
    //   · la RAZÓN es lo que decide, y es estable: la opción A tiene que costar
    //     al menos el DOBLE. Es la comparación que la decisión (a) necesitaba y
    //     no depende de la máquina;
    //   · el ABSOLUTO se afirma flojo a propósito —10% del tick a 20 Hz— porque
    //     es lo único que se puede sostener en un proceso compartido. El número
    //     fino se mide con `pnpm --filter @anima/perceive banco`, que corre este
    //     archivo solo: ahí da 1,60 ms/tick, o sea 3,2% del tick.
    //
    // El presupuesto contra el que se compara ya está repartido: `stepWorld` se
    // lleva el 17,6% (ADR II-0007) y el combustible el 2% (ADR II-0005).
    // La RAZÓN se queda en la suite determinista, y es una decisión y no un
    // olvido: son dos `mejorDe(5, …)` sobre el mismo proceso y en la misma
    // ventana, así que la contención los castiga a los dos parejo. Medido, la
    // razón da ~10× contra un umbral de 2×: para darla vuelta habría que
    // encontrar una máquina que ralentice la opción C cinco veces más que la A,
    // y eso no es carga, es otro programa.
    expect(porTickIndice).toBeLessThan(porTickTodo / 2)
    // El ABSOLUTO no: ése sí es el reloj de pared, y el comentario de arriba
    // cuenta cómo la medición ya rebotó dos veces el umbral que se había
    // escrito. Ver `./reloj-de-pared.ts`.
    if (CONTRA_EL_RELOJ) expect(porTickIndice).toBeLessThan(5)
    else console.log(`  el absoluto (${porTickIndice.toFixed(3)} ms/tick) ${NO_SE_AFIRMA}`)
  })

  it('y el índice se arma UNA vez por tick aunque miren diez veces', () => {
    // Lo que hace que el O(cuerpos) del armado se amortice. Si se armara por
    // llamada, la opción C sería la opción A con un paso más.
    const w = mundoGrande()
    const proy = new Proyeccion(new IndiceDelTick(w))
    const primera = cronometro(() => proy.aLaVista({ x: 0, y: 0 }, 'ella'))
    const novena = cronometro(() => {
      for (let k = 0; k < 9; k++) proy.aLaVista({ x: 0, y: 0 }, 'ella')
    })
    console.log(
      `\n─── el índice es perezoso y se paga una vez ───\nprimera mirada ${primera.toFixed(3)} ms · las nueve siguientes ${novena.toFixed(3)} ms en total\n`,
    )

    // ─── LO QUE SE AFIRMA SIEMPRE: EL MECANISMO, NO EL RELOJ ─────────────────
    //
    // Acá había un `expect(novena).toBeLessThan(primera)`, y se cayó corriendo la
    // suite entera —los nueve paquetes en paralelo— mientras pasaba en verde
    // corriendo sola. O sea el modo de falla que este repositorio ya tiene
    // decidido y escrito en `world/tests/banco-el-tick.test.ts:162`: «un test de
    // rendimiento adentro de la suite normal es un test flaky, y un test flaky es
    // peor que ninguno: enseña a ignorar el rojo».
    //
    // La reparación NO es aflojar el umbral —`novena < primera * 3` seguiría
    // siendo un reloj, sólo que más perezoso— sino AFIRMAR OTRA COSA: que la
    // segunda mirada devuelve LOS MISMOS OBJETOS. Ésa es la caché, que es lo que
    // el test quería probar; el tiempo era el síntoma. Y es determinista: no
    // depende de cuántos núcleos haya libres.
    const unaVez = proy.aLaVista({ x: 0, y: 0 }, 'ella')
    const otraVez = proy.aLaVista({ x: 0, y: 0 }, 'ella')
    expect(unaVez.length).toBeGreaterThan(0)
    expect(otraVez.length).toBe(unaVez.length)
    for (let k = 0; k < unaVez.length; k++) {
      // Identidad, no igualdad: si armara la vista de nuevo, `toEqual` pasaría
      // igual y el test no mediría nada.
      expect(otraVez[k]).toBe(unaVez[k])
    }

    // Y el reloj, que sigue siendo la medida que importa para el presupuesto,
    // se afirma sólo midiendo en serio. Ver `MIDIENDO_EN_SERIO` arriba.
    if (!MIDIENDO_EN_SERIO) return
    expect(novena).toBeLessThan(primera)
  })
})

describe('(b) sellar la celda contra clonarla', () => {
  it('los dos caminos, medidos sobre 5000 cuerpos y 20 ticks', () => {
    const w = mundoGrande()
    const celdas = [...w.bodies.values()].map((c) => c.at)

    // Se descongelan para poder medir el primer sellado. `Object.freeze` no se
    // puede deshacer, así que se copian.
    const frescas = celdas.map((c) => ({ x: c.x, y: c.y }))

    const msSellarPrimera = cronometro(() => {
      for (const c of frescas) if (!Object.isFrozen(c)) Object.freeze(c)
    })
    const msSellarDespues = cronometro(() => {
      for (let t = 0; t < TICKS; t++) {
        for (const c of frescas) if (!Object.isFrozen(c)) Object.freeze(c)
      }
    })
    const msClonar = cronometro(() => {
      let n = 0
      for (let t = 0; t < TICKS; t++) {
        for (const c of celdas) {
          const copia = { x: c.x, y: c.y }
          n += copia.x
        }
      }
      return n
    })

    console.log(
      [
        '',
        '─── (b) que mutar `at` no mueva el cuerpo ───',
        `clonar la celda por cuerpo y por tick        ${(msClonar / TICKS).toFixed(3)} ms/tick  (${String(CUERPOS)} objetos nuevos por tick)`,
        `sellar: el PRIMER tick, congelando 5000      ${msSellarPrimera.toFixed(3)} ms`,
        `sellar: los siguientes (ya congeladas)       ${(msSellarDespues / TICKS).toFixed(3)} ms/tick  (0 objetos nuevos)`,
        '',
      ].join('\n'),
    )

    // ─── EL NÚMERO NO DIO LO QUE SE ESPERABA, Y SE REPORTA ────────────────
    //
    // La hipótesis con la que se eligió sellar era que también iba a ser más
    // BARATO en CPU. **No lo es**: `Object.isFrozen` sobre 5000 objetos cuesta
    // 0,280 ms y asignar 5000 objetos chicos cuesta 0,156. V8 asigna en el
    // vivero más rápido de lo que consulta el mapa oculto de un objeto.
    //
    // La decisión NO cambia, y ahora se puede decir por qué sin apoyarse en el
    // número que no dio:
    //
    //   1. **asigna cero**. 5000 objetos por tick a 20 Hz son 100.000 objetos
    //      por segundo de basura, y el costo de eso no está en esta medición
    //      —está en la pausa del recolector, que es justo la que hace perder un
    //      tick—. El criterio (b) del tramo es `ticksPerdidos === 0`;
    //   2. **la mutación es VISIBLE**. Es lo que decide de verdad: contra una
    //      celda clonada, `b.at.x = 999` ANDA —escribe en la copia— y la
    //      habilidad se queda creyendo que movió el cuerpo. Un verde falso que
    //      dura toda la partida. Contra una congelada, LANZA. Este repositorio ya
    //      pagó esa lección con `q(fogata,'oxygen')`, que typechequeaba y
    //      contestaba sobre la cosa equivocada;
    //   3. **la comparación de arriba no es la carga real**. Se sella lo que se
    //      MIRA y no todo el mundo: 71 cuerpos de 5000 en el test de abajo. Y
    //      `stepWorld` crea un `at` nuevo sólo cuando el cuerpo se muda, así que
    //      en régimen se sella UNO por tick, no cinco mil.
    //
    // Lo que se afirma, entonces, es lo que se midió: sellar cuesta menos del 1%
    // del tick a la escala del banco, y no asigna. Éste es el número de RÉGIMEN
    // —los ticks en que ya está todo congelado— y es el que sostiene la decisión.
    //
    // ─── Y SE AFIRMA MIDIENDO EN SERIO, que antes era «siempre» ─────────────
    //
    // Decía «se afirma siempre», y era la última aserción de reloj de la suite
    // que quedaba sin gatear. La suite pasó a poder correrse con los ocho
    // paquetes EN PARALELO —239 s a ~80 s de verificación— y con la máquina así
    // este renglón midió **7,761 ms/tick contra un techo de 0,5**: quince veces
    // el umbral, sin que nadie tocara una línea. No es que sellar se encareció:
    // es `Object.isFrozen` sobre 5000 objetos peleándose los núcleos con otros
    // siete vitest.
    //
    // La regla del proyecto ya estaba escrita y es la que se aplica: **un test de
    // rendimiento adentro de la suite normal es un test flaky, y un test flaky
    // enseña a ignorar el rojo.** Se imprime siempre; el techo se afirma con
    // `ANIMA_BANCO=1`, que es cuando la máquina está tranquila. Lo que este
    // bloque afirma SIEMPRE es lo de abajo, que no mira el reloj.
    if (!MIDIENDO_EN_SERIO) return
    expect(msSellarDespues / TICKS).toBeLessThan(0.5)
    // Y el del PRIMER tick, que es JIT y caché fría: se pasaba del techo una de
    // cada cinco corridas sin que nadie tocara nada.
    expect(msSellarPrimera).toBeLessThan(2)
  })

  it('y en la práctica se sella lo que se MIRA, que con radio 12 son un puñado', () => {
    const w = mundoGrande()
    const proy = new Proyeccion(new IndiceDelTick(w))
    const vistos = proy.aLaVista({ x: 0, y: 0 }, 'ella')
    console.log(
      `\n─── cuántos cuerpos entran en el radio ───\n${String(vistos.length)} de ${String(CUERPOS)} en un mundo de 200×200\n`,
    )
    expect(vistos.length).toBeLessThan(CUERPOS / 10)
  })
})

describe('(c) congelar la vista entera, y no sólo su `at`', () => {
  it('lo que agrega el congelado, medido contra el sellado que ya estaba', () => {
    // La DECISIÓN 4 de `src/vista.ts`: la vista se memoiza y se devuelve por
    // identidad, así que `b.name = 'PIEDRA FALSA'` sobrevivía al tick entero
    // mientras `q()` y `can()` seguían contestando la verdad. La reparación es
    // `Object.freeze` sobre la `BodyView` y sobre `joints`/`holding`, y lo que se
    // mide acá es lo ÚNICO discutible: cuánto cuesta.
    //
    // Se mide el MARGINAL —el congelado y nada más— restándole a la pasada
    // completa el costo de armar los mismos objetos sin congelarlos. Medir sólo la
    // pasada completa mezclaría el congelado con la asignación, que es lo que la
    // vista paga igual.
    const w = mundoGrande()
    const proy = new Proyeccion(new IndiceDelTick(w))
    const vistos = proy.aLaVista({ x: 0, y: 0 }, 'ella')

    // Objetos equivalentes a los que la fábrica arma, frescos en cada pasada: no
    // se puede medir congelar dos veces lo mismo, que es gratis.
    const frescas = (): { joints: unknown[] }[] =>
      vistos.map((v) => ({ id: v.id, at: v.at, name: v.name, madeByMe: v.madeByMe, joints: [] }))

    frescas()
    const msSolaAsignacion = mejorDe(5, () => {
      for (let t = 0; t < TICKS; t++) frescas()
    })
    const msConCongelado = mejorDe(5, () => {
      for (let t = 0; t < TICKS; t++) {
        for (const o of frescas()) {
          Object.freeze(o.joints)
          Object.freeze(o)
        }
      }
    })
    const marginal = (msConCongelado - msSolaAsignacion) / TICKS

    console.log(
      [
        '',
        '─── (c) congelar la vista entera ───',
        `armar las ${String(vistos.length)} vistas del tick, sin congelar     ${(msSolaAsignacion / TICKS).toFixed(3)} ms/tick`,
        `las mismas, congelándolas (vista + juntas)         ${(msConCongelado / TICKS).toFixed(3)} ms/tick`,
        `                            LO QUE AGREGA          ${marginal.toFixed(3)} ms/tick  (${((marginal / 50) * 100).toFixed(3)}% del tick a 20 Hz)`,
        '',
        'contra lo que ya estaba medido en este mismo banco, en corridas sucesivas:',
        '  clonar la celda por cuerpo y por tick (5000)     0,075–0,157 ms/tick',
        '  sellar el `at` (5000 ya congeladas)              0,147–0,206 ms/tick',
        '  el tick entero de la percepción (5000 cuerpos)   0,67–0,72 ms/tick',
        '',
      ].join('\n'),
    )

    // ─── LO QUE SE AFIRMA, Y POR QUÉ ES ESTA COTA ─────────────────────────
    //
    // El congelado se paga sobre lo que se MIRA —71 cuerpos de 5000 con radio 12—
    // y UNA vez por tick y por cuerpo, porque la caché de vistas ya devolvía el
    // mismo objeto a las diez `see()` del tick. O sea que la escala de esta
    // medición es la real y no la del mundo entero, que es la diferencia con el
    // sellado del `at` (que se mide sobre 5000 a propósito, porque ahí la
    // pregunta era otra).
    //
    // La cota absoluta va floja —1% del tick— por la misma razón que la del bloque
    // (a): el proceso es compartido con los otros ocho archivos y una pausa del
    // recolector cae donde cae. El número fino se lee del `console.log`.
    //
    // Y va detrás de `ANIMA_BANCO=1` por lo mismo que las otras dos de este
    // archivo: con la suite en paralelo la cota floja tampoco alcanza.
    if (!MIDIENDO_EN_SERIO) return
    expect(marginal).toBeLessThan(0.5)
  })

  it('y se congela lo que se MIRA, una vez por tick: la caché no se rompió', () => {
    // La mitad del argumento de costo. Si el congelado se pagara por MIRADA en vez
    // de por tick, la cuenta de arriba habría que multiplicarla por diez.
    const w = mundoGrande()
    const proy = new Proyeccion(new IndiceDelTick(w))
    const a = proy.aLaVista({ x: 0, y: 0 }, 'ella')
    const b = proy.aLaVista({ x: 0, y: 0 }, 'ella')
    expect(a.length).toBe(b.length)
    for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i])
    expect(Object.isFrozen(a[0])).toBe(true)
  })
})

describe('el tick entero de la costura', () => {
  it('mundo + proyección + una habilidad, medido', () => {
    // El número que importa para el criterio (b) del tramo: cuánto le agrega esta
    // capa al tick del mundo. Si fuera comparable al `stepWorld`, el bucle
    // perdería ticks por culpa de la percepción.
    const w = mundoGrande()
    const soloIndice = cronometro(() => {
      for (let t = 0; t < TICKS; t++) {
        const proy = new Proyeccion(new IndiceDelTick(w))
        proy.aLaVista({ x: 0, y: 0 }, 'ella')
        proy.self(w.actors.get('ella')!)
      }
    })
    console.log(
      `\n─── lo que la percepción le agrega al tick ───\n${(soloIndice / TICKS).toFixed(3)} ms/tick con ${String(CUERPOS)} cuerpos (${((soloIndice / TICKS / 50) * 100).toFixed(2)}% del tick a 20 Hz)\n`,
    )
    // Mismo criterio que el resto del archivo: se imprime siempre, se afirma
    // midiendo en serio. Con los ocho paquetes en paralelo esto midió 13,05 ms
    // contra un techo de 5 — el techo sigue siendo el bueno, la máquina no.
    if (!MIDIENDO_EN_SERIO) return
    expect(soloIndice / TICKS).toBeLessThan(5)
  })
})

// Se usa `buildSeedPhysics` a través de `mundo()`; la referencia explícita existe
// para que un cambio de catálogo rompa acá y no en un número raro.
expect(buildSeedPhysics().substances.size).toBeGreaterThan(20)
