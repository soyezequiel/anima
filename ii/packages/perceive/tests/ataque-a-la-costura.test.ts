/**
 * EL ATAQUE A LA COSTURA — el adversario del tramo B.
 *
 * Los ocho archivos de test que `@anima/perceive` trajo arman TODOS sus mundos
 * con `mundo()`/`conElla()` de `tests/mundo.ts`, y ese armador no sabe poner un
 * `dios`. El otro frente del tramo —el que le cosió `@anima/oracle` a
 * `@anima/world`— arma los suyos a mano y NUNCA pasa por la percepción. O sea que
 * los dos frentes que se escribieron esta semana no se tocan en ningún test, y
 * justo en la juntura está el primer criterio del Hito 5:
 *
 *   «con hambre y un río a la vista, la criatura deshilacha un matorral, ata una
 *    vara, va y pesca. Sin una sola llamada al modelo.»
 *
 * Este archivo es esa juntura. Lo que encontró está en cada bloque con su número
 * medido; lo que se pudo arreglar está arreglado y quedó como regresión, y lo que
 * no, con su `it.fails` y su «POR QUÉ SIGUE ABIERTO».
 */

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, qualityOf, unir, type Body, type Physics } from '@anima/physics'
import {
  celdaDecretada,
  crearDios,
  decretoDe,
  hashWorldState,
  idDePozo,
  keyOfCell,
  mapaDeActores,
  mapaDeCuerpos,
  restoreWorld,
  stepWorld,
  worldSlots,
  type EstadoDelDios,
  type Placement,
  type WorldBody,
  type WorldState,
} from '@anima/world'
import type { BodyView, Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import { aplicarProceso } from '@anima/skills/innatas'

import { IndiceDelTick, Partida, Proyeccion } from '../src/index.js'
import { actor, conElla, criatura, cuerpo, mundo } from './mundo.js'

type Hab = Generator<Intent, Outcome, StepResult>

const PHYS: Physics = buildSeedPhysics()
const SEMILLA = 20260727n

// ─── El mundo con dios, que es el que ningún test de este paquete armaba ────

interface Orilla {
  readonly dios: EstadoDelDios
  readonly cx: number
  readonly cy: number
  /** La celda mojada donde el dios puso el banco de peces. */
  readonly pozo: Placement
  /** Una celda seca pegada al pozo: desde acá se pesca. */
  readonly parada: Placement
}

/** La misma búsqueda que `world/tests/hito-5-la-pesca.test.ts`, para medir sobre
 *  la MISMA orilla de la MISMA semilla y que los dos números se puedan comparar. */
function buscarOrilla(dios: EstadoDelDios): Orilla {
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      const dec = decretoDe(dios, PHYS, cx, cy)
      if (dec.pozo === undefined) continue
      const p = dec.pozo.at
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const parada = { x: p.x + dx, y: p.y + dy }
        const vecino = decretoDe(dios, PHYS, Math.floor(parada.x / 16), Math.floor(parada.y / 16))
        const i = (((parada.y % 16) + 16) % 16) * 16 + (((parada.x % 16) + 16) % 16)
        if ((vecino.celdas[i] as { wet: number }).wet < 0.9) return { dios, cx, cy, pozo: p, parada }
      }
    }
  }
  throw new Error('la semilla no tiene una sola orilla en 13×13 chunks')
}

const ORILLA = buscarOrilla(crearDios(SEMILLA))

function cana(): Body {
  const vara: Body = {
    id: 'cana',
    form: 'vara',
    parts: [
      { substance: 'madera', mass: 1, q: {} },
      { substance: 'pedernal', mass: 0.1, q: {} },
    ],
    joints: [{ a: 0, b: 1, via: 'liana', strength: 1 }],
    state: {},
  }
  const hebra: Body = {
    id: 'h',
    form: 'hebra',
    parts: [{ substance: 'liana', mass: 0.2, q: {} }],
    joints: [],
    state: {},
  }
  const c = unir(vara, undefined, hebra, PHYS, 'cana')
  if (c === undefined) throw new Error('no se pudo atar la caña')
  return c
}

/** Una criatura parada en la orilla, con el aparejo en la mano y un dios detrás. */
function enLaOrilla(o: Orilla, extra: readonly WorldBody[] = [], aparejo = cana()): WorldState {
  return {
    tick: 0,
    hz: 20,
    phys: PHYS,
    bodies: mapaDeCuerpos([
      { body: criatura('ana', 1000), at: o.parada },
      { body: aparejo, at: o.parada, heldBy: 'ana' },
      ...extra,
    ]),
    actors: mapaDeActores([actor('ana', { holding: [aparejo.id], capacity: 3 })]),
    cells: new Map(),
    nextId: 1,
    dios: o.dios,
  }
}

// ═══ 1. LA VISTA ERA CIEGA AL AGUA DEL DIOS ══════════════════════════════════
//
// ARREGLADO en `src/indice.ts` (`IndiceDelTick.#base`). Lo que sigue son las
// regresiones, con el número que había antes del arreglo adentro de cada una.

describe('1. el agua del dios, que la percepción no veía', () => {
  it('parada ADENTRO del río, `qAt(at,"wet")` da lo que el dios decretó', () => {
    // ANTES DEL ARREGLO: decreto 1, vista 0. `celda()` leía `state.cells` y caía a
    // `CELDA_POR_OMISION`, o sea que se salteaba la capa del medio de las tres que
    // `celdaDe` del mundo tiene desde este tramo. Y `state.cells` de una partida
    // recién empezada está VACÍO a propósito: el decreto es el piso y las celdas
    // son sólo lo que el mundo escribió encima.
    const p = new Partida(enLaOrilla(ORILLA))
    const decretado = celdaDecretada(ORILLA.dios, PHYS, ORILLA.pozo.x, ORILLA.pozo.y)
    const visto = p.proyeccion.indice.celda(ORILLA.pozo)
    expect(decretado.wet, 'la orilla elegida no tiene agua: el test no probaría nada').toBe(1)
    expect(visto.wet).toBe(decretado.wet)
    expect(visto.oxygen).toBe(decretado.oxygen)
    expect(visto.temperature).toBe(decretado.temperature)
  })

  it('el espejo COMPLETO: las 256 celdas del chunk, y no sólo `sheltered`', () => {
    // El espejo que ya existía (`la-vista.test.ts`) compara contra `shelteredDe`,
    // que es la única mitad de `celdaDe` que el mundo exporta — y `sheltered` es
    // justamente la que NO pasa por el decreto. Por eso el agujero pasó ocho
    // archivos de test: el espejo miraba el pedazo que ya estaba bien.
    const w = enLaOrilla(ORILLA)
    const idx = new IndiceDelTick(w)
    let mojadas = 0
    for (let ly = 0; ly < 16; ly++) {
      for (let lx = 0; lx < 16; lx++) {
        const at = { x: ORILLA.cx * 16 + lx, y: ORILLA.cy * 16 + ly }
        const dec = celdaDecretada(ORILLA.dios, PHYS, at.x, at.y)
        const mio = idx.celda(at)
        expect(mio.wet, `celda ${String(at.x)},${String(at.y)}`).toBe(dec.wet)
        expect(mio.oxygen).toBe(dec.oxygen)
        expect(mio.temperature).toBe(dec.temperature)
        if (dec.wet > 0.5) mojadas++
      }
    }
    // Un espejo sobre un chunk seco no compara nada.
    expect(mojadas, 'el chunk elegido no tiene agua').toBeGreaterThan(0)
  })

  it('y el mundo usa ESA agua: un palo en el pozo se moja y uno en la orilla no', () => {
    // La otra mitad, y es la que hace que el espejo no sea circular: que la vista
    // y el decreto coincidan no prueba que el MUNDO use el mismo dato. Acá se
    // mide por la conducta — la ley 11 moja lo que está sobre una celda mojada—
    // así que si el mundo leyera otra agua, los dos palos saldrían iguales.
    const enElAgua: WorldBody = { body: cuerpo('mojado', 'madera', 1), at: ORILLA.pozo }
    const enTierra: WorldBody = { body: cuerpo('seco', 'madera', 1), at: ORILLA.parada }
    let w = enLaOrilla(ORILLA, [enElAgua, enTierra])
    for (let t = 0; t < 40; t++) w = stepWorld(w, []).state
    const q = (id: string): number => qualityOf(w.bodies.get(id)!.body, 'moisture', PHYS)
    expect(q('mojado'), 'la ley 11 no mojó lo que está en el río').toBeGreaterThan(q('seco'))
    // Y lo que la criatura LEE de las dos celdas ordena igual que lo que el mundo
    // le hizo a los dos palos. (`moisture` es la humedad DEL CUERPO; `wet` es la de
    // la celda, y la ley 11 va de la segunda a la primera.)
    const idx = new IndiceDelTick(w)
    expect(idx.celda(ORILLA.pozo).wet).toBeGreaterThan(idx.celda(ORILLA.parada).wet)
  })

  it('`recall` encuentra el río después de caminarlo', () => {
    // El libro de lugares anota `proy.indice.celda(at)`, así que heredaba la
    // ceguera entera: una criatura podía cruzar el río a pie y `recall` seguía
    // devolviendo la lista vacía. Es el uso que `PlaceMemory` nombra primero.
    const p = new Partida(enLaOrilla(ORILLA))
    let cuantos = -1
    const v = p.volar(
      'ana',
      function* (ctx: Ctx): Hab {
        yield ctx.goTo(ORILLA.pozo, {})
        cuantos = ctx.recall([{ q: 'wet', op: '>=', v: 0.5 }]).length
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 40 && !v.terminado; i++) p.tick()
    expect(cuantos, 'pisó el río y no lo recuerda').toBeGreaterThan(0)
  })

  it('control negativo: SIN dios la celda sigue siendo el aire libre', () => {
    // El arreglo no puede inventar agua donde no hay dios: el banco de 5000
    // cuerpos y el mundito corren así.
    const idx = new IndiceDelTick(conElla([]))
    const c = idx.celda({ x: 3, y: 3 })
    expect(c.wet).toBe(0)
    expect(c.oxygen).toBe(1)
    expect(c.sheltered).toBe(0)
  })

  it('y con el mundo escribiendo ENCIMA, gana lo escrito', () => {
    // Las tres capas en el orden de `celdaDe`: lo escrito, el decreto, el aire.
    const base = enLaOrilla(ORILLA)
    const cells = new Map(base.cells)
    cells.set(keyOfCell(ORILLA.pozo), { wet: 0.25, oxygen: 0.5, temperature: 3 })
    const idx = new IndiceDelTick({ ...base, cells })
    expect(idx.celda(ORILLA.pozo).wet, 'una fogata que secó el suelo tiene que ganarle al río').toBe(
      0.25,
    )
  })
})

// ═══ 2. EL PRIMER PASO VE UN MUNDO AL QUE EL DIOS NO LE HABLÓ ════════════════

describe('2. el tick 0 de una habilidad', () => {
  it('pescar POR LA COSTURA funciona, y desde el PRIMER paso', () => {
    // La buena noticia primero, porque es el criterio: con el proveedor apagado y
    // por la costura entera (`Partida` → `Contexto` → `SkillRun` → `stepWorld` →
    // `desenlaceDe` → `Vuelo`), una criatura con una caña en la orilla saca un
    // pescado. MEDIDO: sale en 32 ticks de vuelo, con 1 cobro en el libro
    // calórico y el dado del mundo movido.
    //
    // El título decía «pero recién desde el segundo paso» y ya no: el paso 1 y el
    // paso 2 ven la MISMA lista, con el banco adentro. Ver el test de abajo.
    const p = new Partida(enLaOrilla(ORILLA))
    const banco = idDePozo(ORILLA.cx, ORILLA.cy)
    let paso1: readonly string[] = []
    let paso2: readonly string[] = []
    const v = p.volar(
      'ana',
      function* (ctx: Ctx): Hab {
        paso1 = ctx.see([{ q: 'mass', op: '>', v: 0 }]).map((b) => b.id)
        yield ctx.wait(0.05)
        paso2 = ctx.see([{ q: 'mass', op: '>', v: 0 }]).map((b) => b.id)
        const gear = ctx.self.holding[0]
        const source = ctx.see([{ q: 'mass', op: '>', v: 0 }]).find((b) => b.id === banco)
        if (gear === undefined || source === undefined) return { ok: false, why: 'no veo el pozo' }
        return yield* aplicarProceso(ctx, {
          proceso: 'extraccion',
          roles: { gear, source },
          intentos: 20,
        })
      },
      undefined,
    )
    for (let i = 0; i < 900 && !v.terminado; i++) p.tick()
    console.log(
      `\n─── EL CRITERIO DEL HITO 5, POR LA COSTURA ───\n` +
        `paso 1 ve: ${paso1.join(', ')}\n` +
        `paso 2 ve: ${paso2.join(', ')}\n` +
        `salió: ${String(v.outcome?.ok)} en ${String(v.ticks)} ticks de vuelo · ` +
        `cobros ${String(p.state.dios?.cobros.length)} · dado ${String(p.state.dios?.dado)}\n`,
    )
    expect(v.outcome?.ok, JSON.stringify(v.outcome)).toBe(true)
    expect(paso2).toContain(banco)
    // El criterio (a) de este tramo, sobre el mismo criterio del Hito 5: las dos
    // listas son la MISMA. Antes de la reparación, el paso 1 no traía el banco.
    expect(paso1).toEqual(paso2)
  })

  it('EL PRIMER `see()` VE LO QUE EL DIOS PONE — cerrado, y con su carnada', () => {
    // CÓMO ERA. Quien materializa lo del dios es `materializarPozos`, y corre
    // ADENTRO de `stepWorld`. `Partida` construía su `Proyeccion` en el
    // constructor, sobre el `WorldState` crudo del tick 0 —donde el banco de peces
    // todavía NO EXISTE—, y `Vuelo.intencionDelTick()` avanza el generador ANTES
    // del primer `stepWorld`, que es el orden correcto para todo lo demás («la
    // criatura actúa sobre el mundo que vio») y que NO se tocó.
    //
    // MEDIDO ANTES, sobre la orilla de la semilla 20260727n:
    //   paso 1 de la habilidad veía: ana-cuerpo, cana
    //   paso 2 veía:                 ana-cuerpo, cana, pozo:-6:-6
    //
    // POR QUÉ IMPORTABA: doce de las quince innatas arrancan con un `see()` o un
    // `goTo` derivado de un `see()`, y el argumento se arma en la PRIMERA línea
    // del generador (así lo hace `tests/las-quince.test.ts` y así lo hace el
    // ejemplo canónico). Una criatura que abría los ojos en la orilla no veía el
    // banco de peces y la habilidad se rendía con «no veo el pozo» sin que nada
    // fallara. Era invisible en todos los tests del paquete porque ninguno tiene
    // dios: sin dios, `stepWorld` no materializa nada y el tick 0 y el 1 se ven
    // igual.
    //
    // CÓMO SE CERRÓ: `conLoQueElDiosPone` en `perceive/src/bucle.ts`. La
    // proyección del tick 0 se arma sobre un mundo al que se le pidió AL MUNDO
    // —un `stepWorld` en sombra, con cero intenciones, que se tira— los cuerpos
    // del dios que faltaban. No se copió ninguna ley y `#state` sigue crudo: el
    // paso del tick 1 vuelve a materializar el banco desde el decreto. El porqué
    // entero, con lo que cuesta, está en el encabezado de esa función.
    //
    // CARNADA, verificada a mano: revertir el constructor a `new Proyeccion(new
    // IndiceDelTick(state))` deja rojos los CUATRO tests de este bloque, éste
    // incluido, con `paso1` en `ana-cuerpo, cana`.
    const p = new Partida(enLaOrilla(ORILLA))
    const banco = idDePozo(ORILLA.cx, ORILLA.cy)
    let paso1: readonly string[] = []
    const v = p.volar(
      'ana',
      function* (ctx: Ctx): Hab {
        paso1 = ctx.see([{ q: 'mass', op: '>', v: 0 }]).map((b) => b.id)
        yield ctx.wait(0.05)
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 10 && !v.terminado; i++) p.tick()
    expect(paso1, 'el primer paso no ve lo que el dios pone').toContain(banco)
  })

  it('el paso de sombra NO le mueve el mundo a la partida', () => {
    // La otra mitad de la reparación, y es la que la hace pagable: el `stepWorld`
    // en sombra se TIRA. Si `#state` se quedara con el mundo del paso de sombra,
    // toda partida arrancaría un tick adelantada y la traza de todas cambiaría.
    const w = enLaOrilla(ORILLA)
    const p = new Partida(w)
    expect(p.state.tick, 'la partida arrancó adelantada').toBe(0)
    expect(hashWorldState(p.state), 'el constructor le movió el mundo').toBe(hashWorldState(w))
    // Y el banco NO está en el estado del mundo: está sólo en la vista, que es
    // exactamente lo que se quería. El mundo lo materializa en su primer paso.
    const banco = idDePozo(ORILLA.cx, ORILLA.cy)
    expect(p.state.bodies.has(banco)).toBe(false)
    expect(p.proyeccion.cuerpo(banco, 'ana')).toBeDefined()
    p.tick()
    expect(p.state.bodies.has(banco), 'el mundo no materializó el banco en su paso').toBe(true)
  })

  it('un mundo SIN dios no paga el paso de sombra: control negativo', () => {
    // La primera línea de `conLoQueElDiosPone` es `if (state.dios === undefined)
    // return state`, y de eso depende que el banco de 5000 cuerpos y los ocho
    // archivos de test del paquete no paguen un `stepWorld` de más por partida.
    // Se mide por identidad: sin dios, la proyección cuelga del MISMO objeto de
    // estado que entró.
    const w = conElla([])
    const p = new Partida(w)
    expect(p.proyeccion.state).toBe(w)
    // Y con dios, no: hay un mapa de cuerpos nuevo con el banco adentro.
    const conDios = new Partida(enLaOrilla(ORILLA))
    expect(conDios.proyeccion.state).not.toBe(conDios.state)
  })
})

// ═══ 3. `ticksPerdidos`: EL CONTADOR ACREDITA HOLGURA ════════════════════════

/** Corre `n` ticks con un reloj de pared falso que tarda `ms(tick)` por tick. */
function conReloj(ms: (tick: number) => number, n: number): { porTiempo: number } {
  let ahora = 0
  let lecturas = 0
  const reloj = (): number => {
    // `avanzar` lee dos veces por tick. La de salida es la que consume.
    lecturas++
    if (lecturas % 2 === 0) ahora += ms(lecturas / 2 - 1)
    return ahora
  }
  const p = new Partida(conElla([], { stamina: 9000 }), { reloj })
  p.volar(
    'ella',
    function* (ctx: Ctx): Hab {
      for (;;) yield ctx.goTo({ x: 5, y: 0 }, {})
    },
    undefined,
  )
  return { porTiempo: p.avanzar(n).porTiempo }
}

describe('3. lo que `ticksPerdidos` mide, y lo que no', () => {
  it('el número del criterio (b) sale de una corrida SIN reloj de pared, REMEDIDO', () => {
    // `porTiempo` se cuenta contra un `RelojDePared` INYECTADO, y el criterio (b)
    // —2000 ticks, `ticksPerdidos === 0`— construye la `Partida` sin pasarle uno.
    // O sea que en la corrida que da el número, `porTiempo` es cero POR
    // CONSTRUCCIÓN y lo único que podía moverse era `porFalla`. No es un defecto
    // del bucle: es lo que el número quiere decir, y conviene que esté escrito
    // donde se lo lee.
    const sinReloj = new Partida(conElla([], { stamina: 9000 }))
    sinReloj.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        for (;;) yield ctx.goTo({ x: 5, y: 0 }, {})
      },
      undefined,
    )
    const a = sinReloj.avanzar(200)
    expect(a.porTiempo).toBe(0)

    // Y con un reloj de pared DE VERDAD, en esta máquina, sobre 2000 ticks.
    //
    // ─── ESTE NÚMERO CAMBIÓ DE SIGNIFICADO Y HAY QUE VOLVER A LEERLO ────────
    //
    // Cuando se reportó por primera vez, el contador acreditaba holgura sin tope y
    // el cero no distinguía «llegamos a horario» de «nunca llegamos a estar en
    // deuda» (ver el bloque de abajo). Con el acumulador saturado en cero, un tick
    // que se pase de su ventana AHORA SE CUENTA, venga de donde venga la corrida:
    // este cero ya es el cero que el criterio quería decir. La cota se afirma
    // floja a propósito —el proceso es compartido con los otros ocho archivos y
    // una pausa del recolector de 50 ms es un tick perdido de verdad— pero el
    // número exacto queda impreso.
    const real = new Partida(conElla([], { stamina: 9000 }), { reloj: () => Date.now() })
    real.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        for (;;) yield ctx.goTo({ x: 5, y: 0 }, {})
      },
      undefined,
    )
    const b = real.avanzar(2000)
    console.log(
      `\n─── ticksPerdidos ───\nsin reloj: porTiempo ${String(a.porTiempo)} (no puede ser otra cosa)\n` +
        `con Date.now() sobre 2000 ticks: porTiempo ${String(b.porTiempo)} · porFalla ${String(b.porFalla)}\n`,
    )
    expect(b.ticks).toBe(2000)
  })

  it('EL MISMO TICK TARDÍO CUENTA LO MISMO ESTÉ DONDE ESTÉ — cerrado, con su carnada', () => {
    // CÓMO ERA: `avanzar` llevaba un `#vence` al que le sumaba UNA ventana por
    // tick pase lo que pase, y no lo volvía a anclar cuando el tick terminaba
    // ANTES de su ventana. O sea que un bucle que corre más rápido que el tiempo
    // real —que es todo bucle sin `sleep`, o sea todos los de este repositorio—
    // ACUMULABA CRÉDITO sin tope: a 20 Hz, cada tick que tarda 1 ms en vez de 50
    // guardaba 49 ms de holgura, y sobre los 2000 ticks del criterio (b) eso son
    // 98 SEGUNDOS de colchón. Después de eso, para que `porTiempo` se moviera una
    // sola vez hacía falta un tick que tardara un minuto y medio.
    //
    // MEDIDO ANTES, con el MISMO tick de 1000 ms (veinte ventanas a 20 Hz) puesto
    // en dos lugares distintos de la misma corrida de 102 ticks:
    //
    //   el tick lento PRIMERO, sin crédito acumulado ....... porTiempo 20
    //   el tick lento después de 100 ticks de 1 ms .........  porTiempo  0
    //   diez ticks de 1000 ms después de 100 rápidos ....... porTiempo 93
    //   control negativo, los 102 a 1 ms ...................  porTiempo  0
    //   control positivo, los 102 a 60 ms ..................  porTiempo 21
    //
    // CÓMO SE CERRÓ: el acumulador de un motor de paso fijo, SATURADO EN CERO
    // (`perceive/src/bucle.ts:avanzar`). Cada tick suma lo que pasó de reloj menos
    // una ventana, y si el atraso queda negativo se lo lleva a cero: adelantarse
    // no es un crédito que se pueda gastar después, porque el mundo no puede
    // correr dos ticks de física en un cuadro. Cada ventana entera de atraso es un
    // tick perdido y se descuenta del acumulador.
    //
    // MEDIDO DESPUÉS, y los cinco números se imprimen abajo:
    //
    //   el tick lento PRIMERO .............................. porTiempo 19
    //   el MISMO tick lento en el 101 ...................... porTiempo 19  ← igual
    //   diez de 1000 ms después de 100 rápidos ............. porTiempo 190
    //   control negativo, los 102 a 1 ms ...................  porTiempo  0
    //   control positivo, los 102 a 60 ms ..................  porTiempo 20
    //
    // POR QUÉ 19 Y NO 20: un tick de 1000 ms gasta su propia ventana y se pasa
    // 950 ms, que son diecinueve ventanas enteras que nadie corrió. El 20 de antes
    // contaba también la ventana propia, o sea el tick que SÍ se corrió. Y el 20
    // del control de 60 ms es la lectura honesta de la deuda: 102 ticks que se
    // pasan 10 ms cada uno son 1020 ms, o sea veinte ventanas y sobra media —no
    // 102, que sería contar «ticks que llegaron tarde» y no «ticks que se
    // perdieron», que es lo que la definición del encabezado dice.
    //
    // CARNADA, verificada a mano: sacar la línea `if (this.#atraso < 0)
    // this.#atraso = 0` de `avanzar` deja este test rojo con `despues` en 0 y
    // `primero` en 19, y el de abajo con `conMilAntes` en 0 y `solo` en 3. Los
    // dos controles siguen dando lo mismo, que es por qué hacen falta las cuatro
    // filas y no una.
    const tarde = 1000
    const primero = conReloj((t) => (t === 0 ? tarde : 1), 102).porTiempo
    const despues = conReloj((t) => (t === 100 ? tarde : 1), 102).porTiempo
    const diez = conReloj((t) => (t >= 100 ? tarde : 1), 110).porTiempo
    const rapidos = conReloj(() => 1, 102).porTiempo
    const aSesenta = conReloj(() => 60, 102).porTiempo
    console.log(
      `\n─── el crédito del deadline, después de la reparación ───\n` +
        `un tick de ${String(tarde)} ms al principio → porTiempo ${String(primero)}\n` +
        `el MISMO tick de ${String(tarde)} ms en el 101 → porTiempo ${String(despues)}\n` +
        `diez de ${String(tarde)} ms después de 100 rápidos → porTiempo ${String(diez)}\n` +
        `control: 102 a 1 ms → ${String(rapidos)} · 102 a 60 ms → ${String(aSesenta)}\n`,
    )
    // LA FILA QUE IMPORTA: el mismo tick lento, en dos lugares, el mismo número.
    expect(despues, 'el mismo tick tardío tiene que contar lo mismo esté donde esté').toBe(primero)
    expect(primero).toBe(19)
    // Y las otras tres, para que «da lo mismo» no lo pueda cumplir un cero fijo.
    expect(diez, 'diez ticks lentos cuentan diez veces uno').toBe(10 * primero)
    expect(rapidos, 'un bucle que llega a horario no pierde nada').toBe(0)
    expect(aSesenta, 'la deuda de 102 ticks 10 ms tarde son 1020 ms = 20 ventanas').toBe(20)
  })

  it('y el crédito no se puede acumular: mil ticks de sobra no pagan uno lento', () => {
    // El contrapositivo directo del agujero, escrito como test y no como número
    // en un comentario. Mil ticks de 1 ms guardaban 49 segundos de holgura con el
    // vencimiento que marchaba; con el acumulador saturado guardan cero, así que
    // el tick lento del final cuesta exactamente lo que cuesta.
    const solo = conReloj((t) => (t === 0 ? 200 : 1), 2).porTiempo
    const conMilAntes = conReloj((t) => (t === 1000 ? 200 : 1), 1002).porTiempo
    expect(conMilAntes, 'mil ticks rápidos le compraron perdón al lento').toBe(solo)
    expect(solo, 'un tick de 200 ms se pasa de tres ventanas enteras').toBe(3)
  })
})

// ═══ 4. EL DADO: CUÁL ENTRA EN EL HASH Y CUÁL NO ═════════════════════════════

describe('4. los DOS dados de una partida', () => {
  it('el dado DEL MUNDO sí entra en el hash y sí sobrevive a `JSON.stringify`', () => {
    // Esto contradice el `it.fails` de `el-bucle.test.ts` («el estado del DADO DEL
    // MUNDO no entra en `hashWorldState`»), cuyo porqué escrito —«`@anima/world`
    // no importa `@anima/oracle` en ninguna línea»— dejó de ser cierto en el otro
    // frente de este mismo tramo: `world/src/dios.ts` existe y `WorldState.dios`
    // lleva el entero del dado. Ese `it.fails` sigue rojo por otra razón, que es
    // que el mundo con el que lo mide no tiene dios.
    const a = enLaOrilla(ORILLA)
    const b: WorldState = { ...a, dios: { ...ORILLA.dios, dado: 12345 } }
    expect(hashWorldState(a)).not.toBe(hashWorldState(b))
    const enDisco = JSON.parse(JSON.stringify([...worldSlots(a)])) as [string, unknown][]
    expect(hashWorldState(restoreWorld(new Map(enDisco)))).toBe(hashWorldState(a))
  })

  it('la costura no le agrega azar: dos partidas gemelas que pescan hashean igual', () => {
    const correr = (): string => {
      const p = new Partida(enLaOrilla(ORILLA))
      const banco = idDePozo(ORILLA.cx, ORILLA.cy)
      p.volar(
        'ana',
        function* (ctx: Ctx): Hab {
          yield ctx.wait(0.05)
          const gear = ctx.self.holding[0]!
          const source = ctx.see([{ q: 'mass', op: '>', v: 0 }]).find((x) => x.id === banco)!
          return yield* aplicarProceso(ctx, {
            proceso: 'extraccion',
            roles: { gear, source },
            intentos: 20,
          })
        },
        undefined,
      )
      p.avanzar(400)
      return hashWorldState(p.state)
    }
    expect(correr()).toBe(correr())
  })

  it('EL DADO QUE VE LA HABILIDAD ES EL DEL MUNDO Y VIAJA — cerrado, con su carnada', () => {
    // CÓMO ERA: `Partida` construía su PROPIO dado (`dadoDelMundo(o.semilla ?? 0)`)
    // y se lo daba a `ctx.rng`. El mundo tenía otro, adentro de `WorldState.dios`.
    // MEDIDO sobre una partida con dios después de pescar: el dado del mundo iba
    // en 1831565813 y el de la `Partida` seguía en el 7 que le pasaron. Eran dos
    // generadores independientes.
    //
    // Consecuencia, y es la que importaba: `worldSlots`/`restoreWorld` restauran
    // el dado DEL MUNDO y no el de la habilidad, así que **guardar y cargar a
    // mitad de una partida le reiniciaba la suerte a la mente**. Hoy no se nota
    // porque ninguna de las quince innatas usa `ctx.rng`; se notaría el día que
    // una elija a dónde caminar tirando el dado, que es la primera cosa que va a
    // hacer una mente sin LLM.
    //
    // CÓMO SE CERRÓ: hay UNA ranura y no dos. `Partida.#tirar` lee
    // `state.dios.dado`, lo hace avanzar con `dadoDe` —el del mundo, no una
    // segunda implementación— y lo escribe de vuelta en el estado, que es la
    // ranura que el snapshot ya guarda. La consecuencia hay que decirla: una
    // habilidad que tira el dado le corre la suerte al mundo. Es lo correcto: son
    // la misma partida y el mismo azar.
    //
    // LO QUE SIGUE ABIERTO: un mundo SIN dios no tiene dónde guardar el entero, y
    // ahí se cae al dado propio de `o.semilla`. Su `it.fails` vive en
    // `tests/el-bucle.test.ts` y se mide justo sobre ese caso.
    //
    // CARNADA, verificada a mano y con el detalle que importa: devolverle a
    // `Partida` su dado propio (`this.dado = this.#propio`) deja rojos TRES de
    // este bloque —éste, el de abajo y el control negativo—. Y una reversión
    // PARCIAL —dejar el getter pero pasarle `#propio.tirar` a `ctx.rng`— deja
    // rojo sólo el de abajo: por eso ese test existe, porque éste solo no alcanza
    // para detectarla.
    const p = new Partida(enLaOrilla(ORILLA), { semilla: 7 })
    const banco = idDePozo(ORILLA.cx, ORILLA.cy)
    const tiradas: number[] = []
    p.volar(
      'ana',
      function* (ctx: Ctx): Hab {
        yield ctx.wait(0.05)
        tiradas.push(ctx.rng())
        const gear = ctx.self.holding[0]!
        const source = ctx.see([{ q: 'mass', op: '>', v: 0 }]).find((x) => x.id === banco)!
        return yield* aplicarProceso(ctx, {
          proceso: 'extraccion',
          roles: { gear, source },
          intentos: 20,
        })
      },
      undefined,
    )
    p.avanzar(200)
    // El estado del mundo, guardado y restaurado, tiene que alcanzar para reanudar
    // la partida entera. Lo que le faltaba era este entero.
    const enDisco = JSON.parse(JSON.stringify([...worldSlots(p.state)])) as [string, unknown][]
    const seguida = new Partida(restoreWorld(new Map(enDisco)))
    expect(
      seguida.dado.estado(),
      'el snapshot del mundo no trae el dado que la mente estaba usando',
    ).toBe(p.dado.estado())
    // Y la tirada que la mente hizo NO se perdió en un dado paralelo: quedó
    // escrita en el mundo. Sin esto, el test de arriba lo cumpliría un dado que no
    // se mueve nunca.
    expect(tiradas.length, 'la habilidad no llegó a tirar').toBe(1)
    expect(p.dado.estado(), 'la mente tiró y el mundo no se enteró').not.toBe(0)
  })

  it('la tirada de la MENTE le mueve el mundo, y por eso viaja', () => {
    // El contrapositivo, que es lo que hace que el test de arriba no sea una
    // tautología: dos partidas gemelas con dios, una que tira el dado y otra que
    // no, terminan con mundos DISTINTOS. Antes eran idénticos —la suerte de la
    // mente vivía afuera del estado— y por eso el snapshot no la podía traer.
    const correr = (tira: boolean): string => {
      const p = new Partida(enLaOrilla(ORILLA))
      p.volar(
        'ana',
        function* (ctx: Ctx): Hab {
          if (tira) ctx.rng()
          yield ctx.wait(0.5)
          return { ok: true }
        },
        undefined,
      )
      p.avanzar(20)
      return hashWorldState(p.state)
    }
    expect(correr(true)).not.toBe(correr(false))
    // Y sigue siendo determinista: la misma partida dos veces, el mismo hash.
    expect(correr(true)).toBe(correr(true))
  })

  it('sin dios NO hay dónde guardarlo, y se cae al dado propio: control negativo', () => {
    // El hueco que queda, escrito acá para que no haya que buscarlo. `conElla` no
    // arma dios —como los ocho archivos de test del paquete— así que ahí el dado
    // de la mente sigue siendo un estado paralelo y `semilla` sigue mandando.
    const a = new Partida(conElla([]), { semilla: 1 })
    const b = new Partida(conElla([]), { semilla: 999 })
    expect(a.dado.estado()).toBe(1)
    expect(b.dado.estado()).toBe(999)
    a.dado.tirar()
    // Dos suertes distintas, un solo hash: eso es el hueco, y es el que mide el
    // `it.fails` de `tests/el-bucle.test.ts`.
    expect(hashWorldState(a.state)).toBe(hashWorldState(b.state))
    // Y con dios, `semilla` se ignora: el que manda es el del mundo.
    const conDios = new Partida(enLaOrilla(ORILLA), { semilla: 999 })
    expect(conDios.dado.estado(), 'la semilla le ganó al dado del mundo').toBe(ORILLA.dios.dado)
  })
})

// ═══ 5. EL AISLAMIENTO MÁS ALLÁ DE `at` ══════════════════════════════════════

describe('5. qué más se puede mutar de la vista', () => {
  const conPiedra = (): WorldState =>
    conElla([{ body: cuerpo('p', 'piedra', 5), at: { x: 3, y: 0 } }])

  it('LAS CUATRO REBOTAN y el mundo no se mueve: es lo que el agujero 2 pedía', () => {
    // MEDIDO ANTES DE LA REPARACIÓN: `at: rebota · joints: MUTA · name: MUTA ·
    // holding: MUTA`. Los tres que mutaban no llegaban al mundo —lo que se mutaba
    // era una copia— pero se quedaban escritos en la vista MEMOIZADA del tick, que
    // es el agujero que mide el test de abajo. Hoy rebotan los cuatro.
    const p = new Partida(conPiedra())
    const hechos: string[] = []
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        const b = ctx.see([{ q: 'mass', op: '>=', v: 1 }]).find((x) => x.id === 'p') as BodyView
        const probar = (que: string, f: () => void): void => {
          try {
            f()
            hechos.push(`${que}: MUTA`)
          } catch {
            hechos.push(`${que}: rebota`)
          }
        }
        probar('at', () => {
          ;(b.at as unknown as { x: number }).x = 999
        })
        probar('joints', () => {
          ;(b.joints as unknown as unknown[]).push({ a: 0, b: 1, strength: 1 })
        })
        probar('name', () => {
          ;(b as { name: string }).name = 'mentira'
        })
        probar('holding', () => {
          ;(ctx.self.holding as unknown as unknown[]).push(b)
        })
        yield ctx.wait(0)
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 10 && !v.terminado; i++) p.tick()
    console.log(`\n─── mutar la vista ───\n${hechos.join(' · ')}\n`)
    const c = p.state.bodies.get('p')!
    expect(c.at.x, 'el cuerpo se movió sin intención').toBe(3)
    expect(c.body.joints.length, 'le crecieron juntas al cuerpo').toBe(0)
    expect(p.state.actors.get('ella')!.holding.length, 'le aparecieron cosas en la mano').toBe(0)
    expect(hechos).toEqual(['at: rebota', 'joints: rebota', 'name: rebota', 'holding: rebota'])
  })

  it('EL BARRIDO: los NUEVE campos que la vista expone rebotan, uno por uno', () => {
    // El criterio (c) del tramo, campo por campo y no de palabra. La lista sale de
    // `BodyView` + `SelfView` enteras (`skills/src/tipos.ts`), y están las nueve
    // porque un barrido que elige cuáles mirar mide lo que ya se arregló: `at` y
    // `joints` eran los dos que alguien había pensado, y `name`, `stamina`,
    // `capacity` y `permits` son los que nadie había probado nunca.
    //
    // Se mide ADENTRO de una habilidad y no sobre `Proyeccion` a mano, porque el
    // agujero vivía en el camino que recorre una habilidad: la vista memoizada que
    // `see()` devuelve por identidad.
    //
    // CARNADA, verificada a mano: sacar el `Object.freeze(v)` de
    // `Proyeccion.vista` deja este barrido rojo con tres `MUTA` —`name`,
    // `supportedBy` y `covering`— y con él los otros tres tests de este bloque.
    // `joints` y `holding` siguen rebotando porque llevan su propio congelado:
    // por eso el barrido tiene que probar los nueve campos y no dos.
    const conApoyo = mundo({
      bodies: [
        { body: criatura('ella'), at: { x: 0, y: 0 } },
        { body: cuerpo('base', 'piedra', 9), at: { x: 1, y: 0 } },
        { body: cuerpo('p', 'piedra', 5), at: { x: 1, y: 0 }, supportedBy: 'base' },
        { body: cuerpo('tapa', 'hoja', 1), at: { x: 1, y: 0 }, covering: 'p' },
        { body: cuerpo('mano', 'madera', 0.3), at: { x: 0, y: 0 }, heldBy: 'ella' },
      ],
      actors: [actor('ella', { holding: ['mano'] })],
    })
    const p = new Partida(conApoyo)
    const rebotes: string[] = []
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        const b = ctx.see([{ q: 'mass', op: '>=', v: 1 }]).find((x) => x.id === 'p') as BodyView
        const probar = (que: string, f: () => void): void => {
          try {
            f()
            rebotes.push(`${que}: MUTA`)
          } catch {
            rebotes.push(`${que}: rebota`)
          }
        }
        probar('at', () => {
          ;(b.at as unknown as { x: number }).x = 999
        })
        probar('joints', () => {
          ;(b.joints as unknown as unknown[]).push({ a: 0, b: 1, strength: 1 })
        })
        probar('name', () => {
          ;(b as { name: string }).name = 'PIEDRA FALSA'
        })
        probar('holding', () => {
          ;(ctx.self.holding as unknown as unknown[]).push(b)
        })
        probar('supportedBy', () => {
          ;(b as { supportedBy: unknown }).supportedBy = undefined
        })
        probar('covering', () => {
          ;(b.coveredBy as unknown as { covering: unknown }).covering = undefined
        })
        probar('stamina', () => {
          ;(ctx.self as { stamina: number }).stamina = 99999
        })
        probar('capacity', () => {
          ;(ctx.self as { capacity: number }).capacity = 99
        })
        probar('permits', () => {
          ;(ctx.self as { permits: string }).permits = 'irreversible'
        })
        yield ctx.wait(0)
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 10 && !v.terminado; i++) p.tick()
    console.log(`\n─── el barrido de los nueve campos ───\n${rebotes.join('\n')}\n`)
    // Que la habilidad haya corrido de verdad: un barrido sobre una habilidad que
    // nunca arrancó da la lista vacía y `every` la aprueba.
    expect(rebotes.length).toBe(9)
    expect(rebotes.filter((r) => r.endsWith('MUTA'))).toEqual([])
    // Y `supportedBy`/`coveredBy` estaban puestos de verdad: si fueran `undefined`
    // las dos pruebas de arriba habrían explotado por otra razón.
    const vistaP = p.proyeccion.cuerpo('p', 'ella')!
    expect(vistaP.supportedBy?.id).toBe('base')
    expect(vistaP.coveredBy?.id).toBe('tapa')
  })

  it('LA MENTIRA YA NO SOBREVIVE AL TICK — cerrado, con su carnada', () => {
    // CÓMO ERA: `Proyeccion.#vistas` memoiza la `BodyView` por `(actor, cuerpo)` y
    // la devuelve por identidad, así que la vista es un objeto COMPARTIDO por todo
    // lo que mire ese cuerpo en ese tick — `see()`, `got` de un `StepResult`, y el
    // `base` del que sale `ctx.self`. Sellar el `Placement` había cerrado la única
    // vía por la que la mutación llegaba al mundo; no cerraba que una habilidad se
    // mintiera a sí misma para el resto del tick.
    //
    // MEDIDO ANTES: `b.name = 'PIEDRA FALSA'`, y el `see()` siguiente del MISMO
    // tick devolvía el mismo objeto con el nombre falso, mientras `q()` y `can()`
    // seguían contestando la verdad —que es la peor combinación posible: la vista
    // y el juez diciendo cosas distintas—.
    //
    // CÓMO SE CERRÓ: DECISIÓN 4 en `perceive/src/vista.ts` — `Object.freeze` sobre
    // la `BodyView` al salir de la fábrica y sobre `joints` y `holding`. El costo
    // está medido en `tests/banco-la-vista.test.ts`, bloque (c).
    //
    // CARNADA, verificada a mano: sacar ese `Object.freeze` deja este test rojo
    // en la primera de las dos mitades («la mentira se escribió sin que nadie se
    // enterara»).
    const p = new Partida(conPiedra())
    let segundoNombre = ''
    let rebotó = false
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        const a = ctx.see([{ q: 'mass', op: '>=', v: 1 }]).find((x) => x.id === 'p') as BodyView
        try {
          ;(a as { name: string }).name = 'PIEDRA FALSA'
        } catch {
          rebotó = true
        }
        const b = ctx.see([{ q: 'mass', op: '>=', v: 1 }]).find((x) => x.id === 'p') as BodyView
        segundoNombre = b.name
        yield ctx.wait(0)
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 10 && !v.terminado; i++) p.tick()
    // Las dos mitades, y las dos hacen falta. Sin la primera, un `see()` que
    // devolviera una vista NUEVA por llamada también pasaría —y eso costaría una
    // asignación por cuerpo y por mirada, que es lo que la caché existe para no
    // pagar—. Sin la segunda, la habilidad no se entera de nada.
    expect(rebotó, 'la mentira se escribió sin que nadie se enterara').toBe(true)
    expect(segundoNombre, 'la segunda mirada del mismo tick se lleva la mentira').not.toBe(
      'PIEDRA FALSA',
    )
    // Y la caché SIGUE devolviendo el mismo objeto: la reparación no la rompió.
    expect(p.proyeccion.cuerpo('p', 'ella')).toBe(p.proyeccion.cuerpo('p', 'ella'))
  })

  it('LA COBERTURA REAL DEL AGUJERO 2 VIVE ACÁ, y no en `@anima/skills`', () => {
    // POR QUÉ ESTE TEST EXISTE, con nombre propio. El `it` que reemplazó al
    // agujero 2 en `skills/tests/ataque-al-sandbox.test.ts` («CERRADO EN LA
    // PERCEPCIÓN: mutar `at` NO mueve al cuerpo ni a la criatura») aplica el
    // sellado **en su propio helper `worldCtx`**, sobre el mundito. O sea que si
    // mañana alguien saca el `sellar` de `perceive/src/vista.ts`, ESE TEST SIGUE
    // VERDE: mide una copia de la regla, no la regla.
    //
    // No se puede arreglar moviéndolo de paquete —`@anima/skills` no puede
    // importar `@anima/perceive` sin cerrar un ciclo— así que la cobertura de
    // verdad tiene que estar de este lado, escrita como tal, y allá tiene que
    // estar dicho que lo de allá es una copia. Las dos cosas están hechas.
    //
    // Lo que se clava acá es el invariante contra el `Proyeccion` DE PRODUCCIÓN y
    // contra `stepWorld` de verdad, que es lo que el mundito no puede dar. Las
    // otras regresiones del mismo invariante están en `tests/la-vista.test.ts`
    // (bloque «(c) mutar `at` no mueve el cuerpo»).
    const p = new Partida(conPiedra())
    const b = p.proyeccion.cuerpo('p', 'ella')!
    expect(Object.isFrozen(b.at), 'el `Placement` del mundo no quedó sellado').toBe(true)
    expect(Object.isFrozen(b), 'la vista entera no quedó congelada').toBe(true)
    expect(Object.isFrozen(b.joints), 'las juntas de la vista no quedaron congeladas').toBe(true)
    const self = p.proyeccion.self(p.state.actors.get('ella')!)!
    expect(Object.isFrozen(self), 'la `SelfView` no quedó congelada').toBe(true)
    expect(Object.isFrozen(self.holding), 'la mano no quedó congelada').toBe(true)
    // Y el mundo, que es la mitad que importa: el `at` congelado es el DEL MUNDO,
    // no una copia. Si fuera una copia, esto sería `false` y la mutación andaría
    // en silencio.
    expect(p.state.bodies.get('p')!.at).toBe(b.at)
  })
})

// ═══ 6. LO QUE SÍ SE REPRODUJO ═══════════════════════════════════════════════

describe('6. los números del tramo, medidos de nuevo', () => {
  it('el `explore` del mundo recorre OCHO celdas y vuelve al origen: confirmado', () => {
    // El `it.fails` de `las-quince.test.ts` lo dice y es exacto. Acá queda el
    // recorrido entero, que es el dato que hace falta para el ADR.
    const p = new Partida(conElla([], { stamina: 9000 }))
    p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        yield ctx.explore({ until: () => false, maxTicks: 40 })
        return { ok: true }
      },
      undefined,
    )
    const camino: string[] = []
    for (let i = 0; i < 24; i++) {
      p.tick()
      const at = p.state.bodies.get('ella-cuerpo')!.at
      camino.push(`${String(at.x)},${String(at.y)}`)
    }
    const distintas = new Set(camino).size
    console.log(`\n─── el explore del mundo, 24 ticks ───\n${camino.join(' ')}\nceldas distintas: ${String(distintas)}\n`)
    expect(distintas).toBe(8)
    // La suma de los ocho rumbos es exactamente (0,0): por eso el ciclo cierra.
    expect(camino[7]).toBe('0,0')
    expect(camino[15]).toBe('0,0')
  })

  it('`explore` pone en la mesa EXACTAMENTE `maxTicks` intenciones', () => {
    const p = new Partida(conElla([], { stamina: 9000 }))
    let n = 0
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        const r = yield ctx.explore({ until: () => false, maxTicks: 7 })
        return r.status === 'timeout' ? { ok: true } : { ok: false, why: r.status }
      },
      undefined,
    )
    for (let i = 0; i < 30 && !v.terminado; i++) {
      p.tick()
      if (v.enMesa?.k === 'explore') n++
    }
    expect(n).toBe(7)
    expect(v.outcome?.ok).toBe(true)
  })

  it('la caché de vistas va por `(actor, cuerpo)` y `madeByMe` no se contamina', () => {
    const hecho: WorldBody = { body: { ...cuerpo('h', 'liana', 0.2), madeBy: 'ella' }, at: { x: 1, y: 0 } }
    const w = mundo({
      bodies: [{ body: criatura('ella'), at: { x: 0, y: 0 } }, { body: criatura('otra'), at: { x: 1, y: 1 } }, hecho],
      actors: [actor('ella'), actor('otra')],
    })
    const proy = new Proyeccion(new IndiceDelTick(w))
    expect(proy.cuerpo('h', 'ella')!.madeByMe).toBe(true)
    expect(proy.cuerpo('h', 'otra')!.madeByMe).toBe(false)
    // Y al revés, que es el orden en el que el bug original aparecía.
    const otra = new Proyeccion(new IndiceDelTick(w))
    expect(otra.cuerpo('h', 'otra')!.madeByMe).toBe(false)
    expect(otra.cuerpo('h', 'ella')!.madeByMe).toBe(true)
  })
})
