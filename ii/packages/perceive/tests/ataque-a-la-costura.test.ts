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

import { beforeEach, describe, expect, it } from 'vitest'
import { buildSeedPhysics, qualityOf, unir, type Body, type Physics, type SubstanceId } from '@anima/physics'
import {
  celdaDecretada,
  crearDios,
  decretoDe,
  hashWorldState,
  idDePozo,
  keyOfCell,
  mapaDeActores,
  mapaDeCuerpos,
  apply,
  restoreWorld,
  revisarInvariantes,
  stepWorld,
  worldSlots,
  type EstadoDelDios,
  type Placement,
  type SimEvent,
  type WorldBody,
  type WorldState,
} from '@anima/world'
import type { BodyView, Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import { aplicarProceso, comer, frotar, poner } from '@anima/skills/innatas'

import { IndiceDelTick, Partida, Proyeccion } from '../src/index.js'
import { actor, conElla, criatura, cuerpo, mundo } from './mundo.js'

// ─── EL RESPIRO QUE MANTIENE VIVO AL WORKER DE VITEST ────────────────────────
//
// birpc le pone 60 s de vencimiento al aviso de cada test, y un `for` sincrónico
// largo no deja correr ni el temporizador ni la lectura del socket; cuando suelta
// el hilo, Node corre la fase de temporizadores antes que la de poll y el
// vencimiento gana la carrera aunque la respuesta ya esté en la cola. El síntoma
// es la peor clase de rojo: TODOS los tests en verde y `exit 1` con
// `Timeout calling "onTaskUpdate"`.
//
// Desde que el mundo materializa el decreto (`world/src/step.ts`, `abrirChunk`)
// las corridas de este archivo cuestan diez veces más por tick, así que varias
// cruzan los 60 s. Se arregla con una MACROTAREA de verdad —`setTimeout(…, 0)`;
// un `await` sobre una promesa resuelta es una microtarea y no drena la fase de
// poll— en un `beforeEach` de raíz, que no toca el cuerpo de ningún test ni puede
// mover ninguna medición: corre antes de que el test empiece.
beforeEach(async () => {
  await new Promise((listo) => {
    setTimeout(listo, 0)
  })
})

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
    // Y LOS 32 TICKS, CLAVADOS. El número estaba en el comentario y en ningún
    // `expect`, así que podía derivar sin que nadie se enterara — y el ADR II-0011
    // movió física que este vuelo pisa. REMEDIDO después de ese ADR: siguen siendo
    // 32 (un `wait` de 0,05 más los 1,5 s de `EXTRACCION.completion`, más el paso
    // en el que la habilidad lee el resultado).
    expect(v.ticks, 'los 32 ticks del criterio se movieron').toBe(32)
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
    // ─── Y LOS TAGS, QUE SON EL CASO PEOR DE TODOS ───────────────────────────
    //
    // `joints` y `at` son de este cuerpo; `tags` NO. `tagsDe` lo memoriza por el
    // arreglo de partes y devuelve EL MISMO arreglo a todo el que pregunte por la
    // misma materia, así que un `push` desde una habilidad no ensuciaría una vista:
    // le agregaría un tag a la física, para todos los cuerpos de esa materia y
    // hasta el final de la partida. Lo congela `tagsDe` —una vez por arreglo de
    // partes, no una por vista— y acá se clava que llega congelado a la superficie.
    expect(Object.isFrozen(b.tags), 'los tags de la vista no quedaron congelados').toBe(true)
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
  it('CERRADO · el `explore` del mundo ya no vuelve al origen cada ocho ticks', () => {
    // ─── ESTE BLOQUE AFIRMABA EL BUG, y queda el recorrido viejo escrito ────
    //
    // Decía «recorre OCHO celdas y vuelve al origen: confirmado», y clavaba
    // `distintas === 8`, `camino[7] === '0,0'` y `camino[15] === '0,0'`. Era
    // exacto: `intencionExplorar` sumaba los ocho rumbos, que dan (0,0). El
    // recorrido de entonces, para que el número viejo no se pierda:
    //
    //   -1,1 -2,1 -3,0 -3,-1 -2,-2 -1,-2 0,-1 0,0   (y repetido tres veces)
    //
    // Ahora el rumbo dura `TICKS_POR_RUMBO = 16` ticks y sale de los bits altos de
    // una avalancha, así que en 24 ticks hay a lo sumo dos rumbos y el ciclo no
    // cierra. El porqué del 16 y por qué la reparación obvia repetía el bug están
    // en `las-quince.test.ts` y al lado de `revuelto` en `world/src/step.ts`.
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
    // Clavado en el número nuevo, no aflojado a «> 8»: es lo que el mundo hace hoy.
    expect(distintas).toBe(24)
    // Y las dos que afirmaban el ciclo, dadas vuelta: en los ticks donde antes
    // estaba de vuelta en el origen, ahora no está.
    expect(camino[7]).not.toBe('0,0')
    expect(camino[15]).not.toBe('0,0')
    // Ni una sola celda repetida en 24 ticks: con dos rumbos rectos no puede haber.
    expect(distintas).toBe(camino.length)
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

// ═══ 7. EL PRIMER CRITERIO DEL HITO 5, ENTERO ════════════════════════════════
//
// El bloque 2 de este archivo dejó la mitad: la criatura ve el pozo desde el
// primer paso y saca un pescado en 32 ticks de vuelo. Faltaba el eslabón que el
// mundo no daba — **encender, cocinar y comer** —, y no faltaba por la costura:
// faltaba porque hasta el ADR II-0011 el fuego se apagaba en un tick y no había
// nada que cocinar con él. Ahora hay.
//
// Lo de acá abajo corre POR LA COSTURA ENTERA, en UN SOLO VUELO y con una sola
// habilidad: `Partida` → `Contexto` → `SkillRun` → `stepWorld` → `desenlaceDe` →
// `Vuelo`, con el dios detrás y sin una sola llamada al modelo. Las cinco cosas
// —pescar, encender, poner sobre la parrilla, esperar, comer— salen de cinco
// innatas del Hito 4 que nadie escribió para esto.

/** La masa de vara más barata con la que el fuego COCINA. La tabla, más abajo. */
const VARA_QUE_COCINA = 0.47

/** Los tres roles de `friccion`, para el banco de este bloque. */
const ROLES_DE_FROTAR = [
  { name: 'a', body: 'va' },
  { name: 'b', body: 'vb' },
  { name: 'actor', body: 'ana-cuerpo' },
]

/**
 * El campamento: la orilla, la caña, dos varas y la fogata SIN ENCENDER.
 *
 * La geometría no es comodidad y es la misma de `world/tests/el-fuego.test.ts`:
 * `friccion` pide `arrangement: held`, así que las dos varas están en las manos y
 * por lo tanto en la celda de la criatura; y `montajeDe` sólo da `contacto` —la
 * única exposición con la que una llama chica prende algo— a lo que APOYA o TAPA
 * a la fuente. De ahí que la yesca tape la vara, el leño se apoye en la yesca y la
 * parrilla en el leño. Una celda admite UNA sola pila, así que la yesca cuelga de
 * la criatura: es la única geometría legal, y que sea la única es información.
 *
 * El pescado NO se pone acá: lo saca la criatura del pozo y lo apoya ella.
 *
 * La YESCA es un parámetro desde el bloque 8: el campamento nació con una
 * `hoja-seca` de 1 kg, y ese cuerpo **el mundo no lo deja tirado en ningún lado**
 * —los tres biomas que siembran hoja seca la sueltan de 0,01 a 0,08 kg, y ninguno
 * de ellos es una orilla—. Qué pasa con la yesca que el mundo sí deja está medido
 * en ese bloque.
 */
function elCampamento(masaDeLaVara = VARA_QUE_COCINA, yesca: SubstanceId = 'hoja-seca', masaDeLaYesca = 1): WorldState {
  const p = ORILLA.parada
  const bodies: readonly WorldBody[] = [
    { body: criatura('ana', 1000), at: p },
    { body: cana(), at: p, heldBy: 'ana' },
    { body: cuerpo('va', 'madera', masaDeLaVara, { temperature: 15 }), at: p, heldBy: 'ana' },
    { body: cuerpo('vb', 'madera-dura', masaDeLaVara, { temperature: 15 }), at: p, heldBy: 'ana' },
    { body: cuerpo('yesca', yesca, masaDeLaYesca), at: p, supportedBy: 'ana-cuerpo', covering: 'va' },
    { body: cuerpo('leno', 'madera', 1), at: p, supportedBy: 'yesca' },
    { body: cuerpo('parrilla', 'piedra', 0.5), at: p, supportedBy: 'leno' },
  ]
  return {
    tick: 0,
    hz: 20,
    phys: PHYS,
    bodies: mapaDeCuerpos(bodies),
    actors: mapaDeActores([actor('ana', { holding: ['cana', 'va', 'vb'], capacity: 6 })]),
    cells: new Map(),
    nextId: 1,
    dios: ORILLA.dios,
  }
}

/** El campamento con `cuantos` pescados de 2 kg ya apoyados sobre la parrilla. */
function conPescadosEnLaParrilla(
  masaDeLaVara: number,
  cuantos: number,
  yesca: SubstanceId = 'hoja-seca',
  masaDeLaYesca = 1,
): WorldState {
  const w = elCampamento(masaDeLaVara, yesca, masaDeLaYesca)
  const peces: WorldBody[] = []
  for (let k = 0; k < cuantos; k++) {
    peces.push({
      body: { ...cuerpo(`pez${String(k)}`, 'pescado', 2), form: 'filete' },
      at: ORILLA.parada,
      supportedBy: 'parrilla',
    })
  }
  return { ...w, bodies: mapaDeCuerpos([...w.bodies.values(), ...peces]) }
}

/**
 * Las violaciones de un paso, separadas en DOS MONTONES.
 *
 * `conservada-aumento` va aparte porque en una partida CON DIOS el arnés no la
 * puede juzgar: el decreto crea materia que ningún evento `convierte` respalda, y
 * `acreditado()` —lo único que `revisarInvariantes` sabe leer— no la ve. Los tres
 * momentos están medidos en el `it.fails` del final de este bloque. Contarlas como
 * violaciones de la cadena sería medir la ignorancia del arnés; taparlas sin
 * decirlo sería peor, así que se devuelven las dos listas y cada test dice qué
 * hace con cuál.
 *
 * Las OTRAS cinco clases —orden canónico, sólidos solapados, referencias colgadas,
 * inventarios y cualidades fuera de rango— sí juzgan esta cadena, y son las que
 * dicen si apilar una parrilla sobre un fuego y poner un pescado encima es
 * geometría legal.
 */
function violacionesDelPaso(
  antes: WorldState,
  despues: WorldState,
  events: readonly SimEvent[],
  n: number,
): { readonly duras: readonly string[]; readonly conservacion: readonly string[] } {
  const duras: string[] = []
  const conservacion: string[] = []
  for (const v of revisarInvariantes(antes, despues, events)) {
    if (v.k === 'conservada-aumento') conservacion.push(`t=${String(n)} ${v.q} ${v.antes.toFixed(2)} → ${v.despues.toFixed(2)}`)
    else duras.push(`t=${String(n)} ${v.k}`)
  }
  return { duras, conservacion }
}

/**
 * Frota hasta que la vara prende y después mira nomás —que es lo que hace la
 * innata `frotar`, y es lo que hace que el precio sea EL precio— durante
 * `segundos` de mundo.
 */
function encenderYMirar(w0: WorldState, segundos: number): { w: WorldState; costo: number; violaciones: string[] } {
  let w = w0
  const s0 = qualityOf(w.bodies.get('ana-cuerpo')!.body, 'stamina', PHYS)
  let costo = Number.NaN
  const violaciones: string[] = []
  for (let n = 1; n <= 20 * segundos; n++) {
    const i = Number.isNaN(costo)
      ? apply({ by: 'ana', seq: n }, w.phys, 'friccion', ROLES_DE_FROTAR)
      : undefined
    const antes = w
    const r = stepWorld(w, i === undefined ? [] : [i])
    w = r.state
    for (const x of violacionesDelPaso(antes, w, r.events, n).duras) violaciones.push(x)
    const va = w.bodies.get('va')
    if (Number.isNaN(costo) && va !== undefined && qualityOf(va.body, 'temperature', PHYS) >= 300) {
      costo = s0 - qualityOf(w.bodies.get('ana-cuerpo')!.body, 'stamina', PHYS)
    }
  }
  return { w, costo, violaciones }
}

describe('7. la cadena entera por la costura: pescar, encender, cocinar y comer', () => {
  it('LAS CINCO COSAS EN UN SOLO VUELO, con los segundos de cada una', () => {
    // ─── EL CRITERIO DEL HITO 5, COMPLETO POR PRIMERA VEZ ─────────────────
    //
    // Cinco innatas encadenadas en un generador y nada más: `aplicarProceso`
    // (extracción), `frotar`, `poner`, un `wait` en bucle y `comer`. Ninguna se
    // escribió para esta cadena y ninguna se tocó para que ande.
    //
    // Los hitos se sellan DESDE AFUERA con `p.state.tick` — el `Clock` de la API
    // publica `phase`, `secondsToNightfall` y `dayLength`, y no el tick, que es
    // correcto (ADR II-0008: el ritmo no se mide en muestras) pero deja al arnés
    // sin reloj de adentro.
    const p = new Partida(elCampamento())
    const banco = idDePozo(ORILLA.cx, ORILLA.cy)
    const hitos = new Map<string, number>()
    const notas: string[] = []
    let ahora = 0
    let staminaAlNacer = 0
    let staminaAlEncender = 0
    let staminaAntesDeComer = 0
    let staminaAlFinal = 0
    let crudo = 0
    let cocido = 0
    const v = p.volar(
      'ana',
      function* (ctx: Ctx): Hab {
        staminaAlNacer = ctx.self.stamina
        const anotar = (k: string): void => {
          if (!hitos.has(k)) hitos.set(k, ahora)
        }

        // 1 · PESCAR. Lo mismo que el bloque 2, ahora adentro de la cadena.
        const gear = ctx.self.holding.find((b) => b.id === 'cana')
        const source = ctx.see([{ q: 'mass', op: '>', v: 0 }]).find((b) => b.id === banco)
        if (gear === undefined || source === undefined) return { ok: false, why: 'no veo el pozo' }
        const pesca = yield* aplicarProceso(ctx, { proceso: 'extraccion', roles: { gear, source }, intentos: 20 })
        if (!pesca.ok) return { ok: false, why: `pescar: ${pesca.why ?? ''}` }
        anotar('pescó')
        const pez = ctx.self.holding.find((b) => ctx.q(b, 'calories') > 0)
        if (pez === undefined) return { ok: false, why: 'el pescado no quedó en la mano' }
        crudo = ctx.q(pez, 'calories')
        notas.push(
          `el pozo dio ${ctx.q(pez, 'mass').toFixed(2)} kg de pescado · digestibility ` +
            `${ctx.q(pez, 'digestibility').toFixed(3)} · ${crudo.toFixed(2)} calorías`,
        )

        // 2 · ENCENDER. `frotar` sin `hasta` apunta al `ignitionPoint` del cuerpo,
        // o sea que lograr el contrato ES prender. Nadie escribió «encender».
        const va = ctx.self.holding.find((b) => b.id === 'va')
        const vb = ctx.self.holding.find((b) => b.id === 'vb')
        if (va === undefined || vb === undefined) return { ok: false, why: 'me faltan las varas' }
        const fuego = yield* frotar(ctx, { a: va, b: vb })
        if (!fuego.ok) return { ok: false, why: `frotar: ${fuego.why ?? ''}` }
        anotar('encendió')
        staminaAlEncender = ctx.self.stamina

        // 3 · PONER EL PESCADO SOBRE LA PARRILLA. `sobre` y no `tapando`: apoyar
        // no es tapar, y taparlo ahogaría el fuego (ADR II-0002).
        const parrilla = ctx.see([{ q: 'mass', op: '>', v: 0 }]).find((b) => b.id === 'parrilla')
        if (parrilla === undefined) return { ok: false, why: 'no veo la parrilla' }
        const puesto = yield* poner(ctx, { que: pez, en: parrilla.at, sobre: parrilla })
        if (!puesto.ok) return { ok: false, why: `poner: ${puesto.why ?? ''}` }
        anotar('lo puso al fuego')

        // 4 · ESPERAR A QUE SE COCINE. Sin frotar: el fuego ya no depende de la
        // mano que lo hizo, que es lo que el ADR II-0011 vino a arreglar.
        const verlo = (): BodyView | undefined =>
          ctx.see([{ q: 'mass', op: '>', v: 0 }]).find((b) => b.id === pez.id)
        for (let k = 0; k < 2000; k++) {
          const sigue = verlo()
          if (sigue !== undefined && ctx.q(sigue, 'digestibility') >= 0.85) break
          yield ctx.wait(0.05)
        }
        const listo = verlo()
        if (listo === undefined) return { ok: false, why: 'el pescado dejó de existir' }
        if (ctx.q(listo, 'digestibility') < 0.85) return { ok: false, why: 'no se cocinó' }
        anotar('se cocinó')
        cocido = ctx.q(listo, 'calories')
        notas.push(
          `cocido: digestibility ${ctx.q(listo, 'digestibility').toFixed(4)} · ` +
            `${cocido.toFixed(2)} calorías · charred ${ctx.q(listo, 'charred').toFixed(3)}`,
        )

        // 5 · COMER.
        staminaAntesDeComer = ctx.self.stamina
        const bocado = yield* comer(ctx, { bocado: listo })
        if (!bocado.ok) return { ok: false, why: `comer: ${bocado.why ?? ''}` }
        anotar('se lo comió')
        // Un tick más, para que `ctx.self` traiga la stamina ya acreditada.
        yield ctx.wait(0.05)
        staminaAlFinal = ctx.self.stamina
        return { ok: true }
      },
      undefined,
    )
    const violaciones: string[] = []
    const delDios: string[] = []
    for (let i = 0; i < 4000 && !v.terminado; i++) {
      ahora = p.state.tick
      const antes = p.state
      // Los EVENTOS del paso, y no una lista vacía: `revisarInvariantes` los usa
      // para saber qué creación de materia estaba autorizada. Y `p.tick()` se
      // guarda en una variable ANTES de armar la llamada: pasarlo como tercer
      // argumento de `revisarInvariantes(antes, p.state, p.tick())` evalúa
      // `p.state` primero y compara el estado consigo mismo, o sea que el arnés
      // aprueba siempre. Ese error lo cometí escribiendo este test.
      const eventos = p.tick()
      const juicio = violacionesDelPaso(antes, p.state, eventos, i + 1)
      for (const d of juicio.duras) violaciones.push(d)
      for (const c of juicio.conservacion) delDios.push(c)
    }
    const seg = (k: string): number => (hitos.get(k) as number) / 20
    console.log(
      `\n─── EL PRIMER CRITERIO DEL HITO 5, ENTERO ───\n` +
        `${notas.join('\n')}\n` +
        `pescó ................ ${seg('pescó').toFixed(2)} s\n` +
        `encendió ............. ${seg('encendió').toFixed(2)} s   (frotar tardó ${(seg('encendió') - seg('pescó')).toFixed(2)} s)\n` +
        `lo puso al fuego ..... ${seg('lo puso al fuego').toFixed(2)} s\n` +
        `se cocinó ............ ${seg('se cocinó').toFixed(2)} s   (${(seg('se cocinó') - seg('lo puso al fuego')).toFixed(2)} s sobre la parrilla, sin que nadie frote)\n` +
        `se lo comió .......... ${seg('se lo comió').toFixed(2)} s\n` +
        `el vuelo entero ...... ${String(v.ticks)} ticks = ${(v.ticks / 20).toFixed(2)} s\n` +
        `stamina: ${staminaAlNacer.toFixed(2)} → ${staminaAlEncender.toFixed(2)} al encender → ` +
        `${staminaAntesDeComer.toFixed(2)} antes de comer → ${staminaAlFinal.toFixed(2)}\n` +
        `  el fuego costó ${(staminaAlNacer - staminaAlEncender).toFixed(2)} · el bocado devolvió ` +
        `${(staminaAlFinal - staminaAntesDeComer).toFixed(2)} · NETA ${(staminaAlFinal - staminaAlNacer).toFixed(2)}\n` +
        `  cocinar multiplicó lo que ese mismo bicho rinde por ${(cocido / crudo).toFixed(2)}×\n` +
        `violaciones de invariantes (todas menos conservación): ${String(violaciones.length)}\n` +
        `lo que el arnés NO PUEDE juzgar con un dios en el mundo:\n  ${delDios.join('\n  ')}\n`,
    )

    // LAS CINCO, EN ORDEN. Que estén las cinco y que el orden sea el de la
    // técnica: sin fuego no se cocina y sin cocinar no hay qué comer.
    expect(v.outcome, JSON.stringify(v.outcome)).toEqual({ ok: true })
    expect([...hitos.keys()]).toEqual(['pescó', 'encendió', 'lo puso al fuego', 'se cocinó', 'se lo comió'])
    expect(violaciones).toEqual([])

    // LOS SEGUNDOS, CLAVADOS. Son los del ADR II-0011 vistos desde la costura:
    // pescar es el 1,5 s de `EXTRACCION.completion`; encender es (300−15)/120 =
    // 2,375 s redondeado al tick de 0,05; y cocinar son los segundos que el
    // pescado tarda en pasar de 0,380 a 0,85 sobre la parrilla, CON LA CRIATURA
    // MIRANDO. Antes del ADR II-0011 ese último tramo no existía: el fuego se
    // apagaba junto con el `done` de `frotar`.
    expect(seg('pescó')).toBeCloseTo(1.5, 6)
    expect(seg('encendió') - seg('pescó')).toBeCloseTo(2.4, 6)
    expect(seg('lo puso al fuego') - seg('encendió')).toBeCloseTo(0.05, 6)
    expect(seg('se cocinó') - seg('lo puso al fuego')).toBeCloseTo(4.7, 6)
    expect(v.ticks, 'el vuelo entero').toBe(176)

    // Y LA ARITMÉTICA, que es lo que este vuelo le agrega al criterio: la cadena
    // entera es NETA NEGATIVA, porque el fuego cuesta órdenes más que lo que un
    // bocado devuelve. La criatura sobrevive y NO puede repetirlo: el segundo
    // fuego no lo puede pagar.
    //
    // NO ES UN DEFECTO DE LA CADENA, y por eso no lleva `it.fails` acá: es la
    // ventana del ADR II-0009, medida con el precio del fuego adentro en
    // `oracle/tests/presupuesto.test.ts`, bloque 5, que es donde vive su hueco.
    // El fuego costó 658,7889: los 658,2789 que el modelo de `@anima/oracle`
    // despeja para una vara de 0,47 kg, MÁS el 0,51 de vivir los 1,5 segundos que
    // tardó en pescar antes de empezar a frotar. Que los dos números coincidan
    // hasta la cuarta cifra es lo que hace que el modelo de allá sea el mundo de
    // acá y no una cuenta paralela.
    //
    // ERA 661,3629 (= 659,8629 + 1,50) y bajó 2,574 al pasar
    // `COSTO_VIVIR_POR_SEGUNDO` de 1,0 a 0,34 en `world/src/step.ts`. Los dos
    // sumandos se movieron y ninguno es una perilla de este archivo: el precio del
    // fuego trae adentro lo que cuesta VIVIR los 2,4 s que dura el frotar (2,40 →
    // 0,816, o sea −1,584) y el peaje de pescar antes son 1,5 s de vida (1,50 →
    // 0,51, o sea −0,99). 1,584 + 0,99 = 2,574, que es exactamente lo que se movió:
    // la parte TÉRMICA —657,4629— no se movió ni un decimal, porque el fuego no se
    // abarató, se abarató estar vivo mientras se lo hace.
    expect(Number((staminaAlNacer - staminaAlEncender).toFixed(4))).toBe(658.7889)
    expect(staminaAlFinal - staminaAlNacer).toBeLessThan(0)
    expect(staminaAlFinal).toBeGreaterThan(0)
    // ─── EL BOCADO DEVUELVE MENOS DESDE EL ADR II-0013 ────────────────────
    //
    // Este `expect` pedía > 18 y ahora mide 16,08. La diferencia son 2,25 y es el
    // veneno que el mundo cobra al tragar: el pescado llega a la boca con
    // `toxicity` 0,0345 —la ley 5 le sacó el 86% de los 0,25 que traía crudo—, y
    // sobre 1,93 kg de pieza a 25 de `COSTO_POR_TOXICIDAD_Y_KILO` eso son 1,66,
    // más los 0,017 de vivir el tick —eran 0,05 antes de que
    // `COSTO_VIVIR_POR_SEGUNDO` bajara a 0,34— y el resto del redondeo del instante
    // exacto en que la criatura decidió comer.
    //
    // **Y ES LA MITAD BUENA DE LA NOTICIA**: el mismo bicho comido CRUDO habría
    // dejado −6,42, o sea que cocinar acá no mejora un rendimiento, cambia un
    // signo. Lo que este vuelo mide es que la cadena entera —pescar, encender,
    // cocinar y comer— termina con el bocado en positivo aunque el fuego no.
    expect(staminaAlFinal - staminaAntesDeComer).toBeGreaterThan(16)
    expect(staminaAlFinal - staminaAntesDeComer).toBeLessThan(17)
    // COCINAR MULTIPLICA POR 2,13 LO QUE RINDE ESE MISMO BICHO, y no por los
    // 2,50 que la digestibilidad sola daría (0,95 / 0,38). La diferencia está
    // medida y es información: `calories` es `nutrition × mass × digestibility`, y
    // el pescado sobre la parrilla PIERDE MASA mientras se cocina —la ley 11 lo
    // seca—. O sea que la digestibilidad sube 2,50× y la masa baja lo suficiente
    // para comerse 15 centésimas del negocio. El modelo de
    // `oracle/tests/presupuesto.test.ts` usa el 2,50 porque cocina la misma pieza
    // sin correr el mundo: es OPTIMISTA por ese 15%, y queda dicho acá.
    expect(cocido / crudo).toBeGreaterThan(2)
    expect(cocido / crudo).toBeLessThan(0.95 / 0.38)
  })

  // EL PLAZO, Y QUÉ LO MOVIÓ. Estos tres bloques barren masas contra `stepWorld`
  // sobre `elCampamento`, que tiene `dios` puesto para tener el agua del río. Desde
  // que el mundo materializa las `sueltas` del decreto (`world/src/step.ts`,
  // `abrirChunk`), esa escena de siete cuerpos pasa a tener ~90: el dios le pone la
  // leña, el junco y la corteza de los 3×3 chunks alrededor de la orilla. Los
  // NÚMEROS no se movieron ni un decimal —282,1714 · 645,8743 · 659,8629 ·
  // 701,8286, y los 200 pescados siguen saliendo los 200 cocidos— y lo único que se
  // movió es el reloj: 31 barridos de 1600 ticks cuestan diez veces más cuerpos por
  // tick. Se agranda el plazo y no se toca una aserción.
  //
  // LOS QUE SÍ SE MOVIERON, Y TODOS LO MISMO: al bajar
  // `COSTO_VIVIR_POR_SEGUNDO` de 1,0 a 0,34, los cuatro precios de la tabla
  // perdieron **1,584** exactos y ninguno perdió otra cosa: 282,1714 → 280,5874 ·
  // 645,8743 → 644,2903 · 659,8629 → 658,2789 · 701,8286 → 700,2446. Los 1,584 son
  // los 2,4 segundos de frotar cobrados al precio nuevo de estar vivo (2,40 →
  // 0,816), y que la resta sea LA MISMA para las cuatro masas es la prueba de que
  // la parte térmica —que es la que depende de la masa— no la tocó nadie.
  it('EL PRECIO DEL FUEGO QUE COCINA: 658,28 y no 280,59, con la tabla', () => {
    // ─── EL NÚMERO QUE `@anima/oracle` NO PUEDE MEDIR ─────────────────────
    //
    // `oracle/tests/presupuesto.test.ts` despeja el precio de encender de la
    // física, pero **no puede saber cuál es la vara más barata que sirve**: que la
    // yesca prenda depende de `emitsPower` —`fuelEnergy × masa`— y de la ley 3, o
    // sea de correr el mundo, y `@anima/oracle` no importa `@anima/world`. Este
    // test es el que lo mide, y el de allá lo cita por nombre.
    //
    // LO QUE LA TABLA DICE, y es la corrección más grande de este tramo: **encender
    // y cocinar son dos umbrales distintos**. El `it.fails` de
    // `world/tests/ataque-2-al-fuego.test.ts` (e) hace su cuenta con los 282,17 de
    // una vara de 0,2 kg, que es el fuego más barato que ENCIENDE — y ese fuego no
    // cocina nada: el pescado sobre la parrilla se queda en 0,3800, o sea crudo,
    // porque un cuerpo de 0,2 kg emite un quinto de la potencia de uno de 1 kg, no
    // alcanza para prender la yesca, y sin yesca no hay leño.
    const filas: string[] = []
    const medido = new Map<number, { costo: number; digestibilidad: number }>()
    for (const masa of [0.2, 0.46, 0.47, 0.5]) {
      const { w, costo, violaciones } = encenderYMirar(conPescadosEnLaParrilla(masa, 1), 80)
      expect(violaciones).toEqual([])
      const pez = w.bodies.get('pez0')
      const d = pez === undefined ? Number.NaN : qualityOf(pez.body, 'digestibility', PHYS)
      medido.set(masa, { costo, digestibilidad: d })
      filas.push(
        `  vara de ${masa.toFixed(2)} kg → ${costo.toFixed(4)} de stamina · el pescado termina en ` +
          `digestibility ${d.toFixed(4)}${d >= 0.85 ? '  ← COCINA' : ''}`,
      )
    }
    console.log(`\n─── EL PRECIO DEL FUEGO QUE COCINA ───\n${filas.join('\n')}\n`)

    const de = (m: number): { costo: number; digestibilidad: number } =>
      medido.get(m) as { costo: number; digestibilidad: number }
    // Los cuatro, clavados. El de 0,47 es el que `@anima/oracle` usa de perilla.
    // Ver la nota de arriba: los cuatro bajaron 1,584 con `COSTO_VIVIR_POR_SEGUNDO`
    // en 0,34 (eran 282,1714 · 645,8743 · 659,8629 · 701,8286).
    expect(Number(de(0.2).costo.toFixed(4))).toBe(280.5874)
    expect(de(0.2).digestibilidad).toBeCloseTo(0.38, 6)
    expect(Number(de(0.46).costo.toFixed(4))).toBe(644.2903)
    expect(de(0.46).digestibilidad).toBeLessThan(0.85)
    expect(Number(de(0.47).costo.toFixed(4))).toBe(658.2789)
    expect(de(0.47).digestibilidad).toBeCloseTo(0.95, 6)
    expect(Number(de(0.5).costo.toFixed(4))).toBe(700.2446)
    // El factor entre los dos umbrales, que es el que hay que tener en la cabeza.
    // Era 2,339 y ahora es 2,346: el peaje de vivir el frotar era una parte más
    // gorda del fuego barato que del caro, así que sacarlo SEPARA los dos umbrales
    // en vez de acercarlos. El factor de 2,3 largos se banca el cambio de constante.
    expect(de(0.47).costo / de(0.2).costo).toBeCloseTo(2.346, 3)
  }, 300_000)

  it('COCINAR NO ES RIVAL: un fuego cocina todo lo que se le ponga encima, al mismo precio', () => {
    // ─── LA SORPRESA DEL TRAMO, y es la que decide el número económico ─────
    //
    // La exposición de la ley 5 se calcula POR CUERPO contra la fuente que más lo
    // calienta, y nada la reparte entre los cuerpos que están a la vez sobre la
    // parrilla. O sea que un fuego cocina **N pescados por el precio de uno**, y N
    // no tiene tope en ninguna regla: doscientos pescados de 2 kg —cuatrocientos
    // kilos de comida sobre una piedra de medio kilo— salen los doscientos cocidos
    // y sin carbonizar, y el arnés de invariantes no dice nada porque no hay nada
    // que decir: la pila tiene una sola raíz y ninguna conservada se movió.
    //
    // ES LO QUE HACE QUE EL FUEGO SE PUEDA PAGAR. Si cocinar fuera rival —una
    // fogata, un pescado— harían falta 73 fuegos por partida y la aritmética del
    // ADR II-0009 no tendría ninguna salida. Con esto hace falta UN fuego y 73
    // pescados, contra las 76 piezas que saca la partida más flaca de las cien
    // (`oracle/tests/presupuesto.test.ts`, bloque 5).
    //
    // Y queda escrito como sorpresa y no como logro: que la exposición no se
    // reparta es una decisión que nadie tomó, y el día que alguien quiera que una
    // fogata chica no cocine media tonelada, este test es el que se va a poner
    // rojo primero.
    const cuantos = 200
    const { w, violaciones } = encenderYMirar(conPescadosEnLaParrilla(VARA_QUE_COCINA, cuantos), 90)
    let cocidos = 0
    let arruinados = 0
    for (let k = 0; k < cuantos; k++) {
      const b = w.bodies.get(`pez${String(k)}`)
      if (b === undefined) continue
      const d = qualityOf(b.body, 'digestibility', PHYS)
      const ch = qualityOf(b.body, 'charred', PHYS)
      if (d >= 0.85 && ch < 0.5) cocidos++
      else arruinados++
    }
    console.log(
      `\n─── COCINAR NO ES RIVAL ───\n` +
        `${String(cuantos)} pescados de 2 kg sobre UNA parrilla y UN fuego de ${String(VARA_QUE_COCINA)} kg de vara\n` +
        `cocidos ${String(cocidos)} · arruinados ${String(arruinados)} · violaciones de invariantes ${String(violaciones.length)}\n`,
    )
    expect(cocidos).toBe(cuantos)
    expect(arruinados).toBe(0)
    expect(violaciones).toEqual([])
  }, 300_000)

  it.fails('SIGUE ABIERTO · pero por UN camino de tres: lo que sale del banco no tiene la nutrición del banco', () => {
    // POR QUÉ SIGUE ABIERTO: `revisarInvariantes` compara los totales de las
    // conservadas antes y después del paso, y sólo acepta un aumento si algún
    // evento lo respalda (`acreditado()` y `decretado()`, `world/src/invariants.ts`).
    // El dios creaba materia por TRES caminos y ninguno emitía uno.
    //
    // MEDIDO ENTONCES, sobre la cadena de este bloque:
    //
    //   t=1   `materializarPozos` pone el banco, y saltan LAS TRES conservadas:
    //         mass 6,74 → 482,57, nutrition 18,00 → 3321,43 y fuelEnergy
    //         78,13 → 902,52. Son 129,92 kg de pescado que no estaban.
    //   t=30  la extracción: el banco baja de 129,915 a 127,028 kg y nace un
    //         pescado de 2,887 — y aun así `nutrition` SUBE, de 3291,48 a 3299,92,
    //         porque lo que sale del pozo no hereda el estado del banco.
    //   t=119 la REPOSICIÓN del stock: el banco vuelve solo de 127,028 a 129,915 kg
    //         y las tres conservadas suben con él, en un tick cuyo único evento es
    //         `espero`.
    //
    // ─── LO QUE CERRÓ EL EVENTO `decreta`, Y LO QUE NO ─────────────────────
    //
    // `world/src/step.ts` narra ahora, por tick y por cuenta conservada, cuánta
    // materia puso el dios: al abrir un chunk y al reponer un pozo. Con eso los
    // caminos 1 y 3 se apagaron enteros, y el barrido de 400 ticks de caminata del
    // paquete `world` pasó de 96 y 21 violaciones a CERO y CERO
    // (`world/tests/ataque-a-las-sueltas.test.ts`, bloque 5, con el control ciego
    // al lado que sigue dando 96 y 21).
    //
    // MEDIDO HOY sobre esta misma cadena, y es UNA sola línea:
    //
    //   t=30  nutrition 3310,72 → 3319,15
    //
    // O sea: no queda nada de «el dios materializa sin declarar». Lo que queda es
    // otra cosa, y hay que decirla con su nombre porque cambia a quién le toca
    // arreglarla: **la pieza que sale del banco no tiene la misma nutrición por
    // kilo que el banco**. La masa cuadra al bit —no hay una sola violación de
    // `mass`—, así que no es materia de más: es que `cuerpoDePozo` proyecta el
    // stock con `stock.yields` y `draw` puede entregar otra cosa
    // (`intencionAplicar`, `r.yields`), y las dos sustancias no valen lo mismo por
    // kilo. Declararlo con un `decreta` sería taparlo: el evento diría «el dios
    // puso 8,43 de nutrición» cuando lo que pasó es que el banco mentía sobre lo
    // que tenía adentro.
    //
    // QUÉ HARÍA FALTA AHORA: que el banco proyecte lo que de verdad va a salir, o
    // que la pieza salga con la sustancia que el banco declara. Es de `dios.ts` +
    // `@anima/oracle` y no de la costura, y es una decisión de modelo: pide su ADR.
    // Mientras tanto `Partida` sigue con las cinco preguntas de `revisarEstado`
    // —ver `PartidaOptions.vigilar`—, porque la sexta acusaría en cada pesca, y la
    // partida del criterio pesca.
    //
    // Se mide con la cadena entera y no con un mundo de juguete a propósito: el
    // agujero sólo aparece cuando hay dios, y ningún test del corpus de
    // determinismo del mundo tiene uno.
    const p = new Partida(elCampamento())
    const banco = idDePozo(ORILLA.cx, ORILLA.cy)
    p.volar(
      'ana',
      function* (ctx: Ctx): Hab {
        const gear = ctx.self.holding.find((b) => b.id === 'cana')
        const source = ctx.see([{ q: 'mass', op: '>', v: 0 }]).find((b) => b.id === banco)
        if (gear === undefined || source === undefined) return { ok: false, why: 'no veo el pozo' }
        const r = yield* aplicarProceso(ctx, { proceso: 'extraccion', roles: { gear, source }, intentos: 20 })
        if (!r.ok) return r
        for (let k = 0; k < 200; k++) yield ctx.wait(0.05)
        return { ok: true }
      },
      undefined,
    )
    const conservacion: string[] = []
    for (let i = 0; i < 200; i++) {
      const antes = p.state
      const eventos = p.tick()
      for (const c of violacionesDelPaso(antes, p.state, eventos, i + 1).conservacion) conservacion.push(c)
    }
    console.log(
      ['', '─── LO QUE EL ARNÉS NO PUEDE JUZGAR CON UN DIOS ───', ...conservacion, ''].join('\n'),
    )
    expect(conservacion, 'el dios crea materia que ningún evento respalda').toEqual([])
  })
})

// ═══ 8. LA LEÑA: LO QUE `@anima/oracle` CITA Y NO PUEDE MEDIR ════════════════
//
// El bloque 6 de `oracle/tests/presupuesto.test.ts` hace la economía con el precio
// de la leña adentro, y para eso necesita tres números que sólo se pueden sacar
// corriendo `stepWorld`. Están acá, medidos, y allá se los cita por nombre:
//
//   · cuántos SEGUNDOS de fuego hay en un kilo, contra la fórmula que aquel
//     archivo despeja de las dos ramas de la ley 4;
//   · cuál es la vara MÁS BARATA que enciende un fuego que cocina, con el barrido
//     fino y no con cuatro puntos sueltos;
//   · con qué YESCA, que es la pregunta que nadie había hecho y que tiene una
//     respuesta incómoda.
//
// Todo esto es del ADR II-0011 y del commit «la masa decide cuánto arde». Que se
// remida acá no es redundancia: `@anima/oracle` no importa `@anima/world`, así que
// del otro lado la fórmula es una CUENTA y acá es el mundo corriendo. Que las dos
// den lo mismo es la única forma de saber que el modelo económico modela algo.

/** Un cuerpo solo, ya encendido, ardiendo al aire libre hasta que se apaga. */
function cuantoArde(substance: SubstanceId, masa: number): { segundos: number; queda: string } {
  let w = mundo({ bodies: [{ body: cuerpo('leno', substance, masa, { temperature: 700 }), at: { x: 0, y: 0 } }] })
  let queda = substance as string
  for (let n = 1; n <= 40_000; n++) {
    w = stepWorld(w, []).state
    const b = w.bodies.get('leno')
    if (b === undefined) return { segundos: n / 20, queda: 'nada' }
    queda = b.body.parts.map((x) => x.substance).join('+')
    // Por debajo del punto de ignición de la madera ya no prende nada ni cocina
    // nada: ése es el criterio de «se apagó» y es el mismo con el que la cadena
    // del bloque 7 decide que hay fuego.
    if (qualityOf(b.body, 'temperature', PHYS) < 300) return { segundos: n / 20, queda }
  }
  return { segundos: Number.POSITIVE_INFINITY, queda }
}

describe('8. la leña, medida contra `stepWorld`', () => {
  it('LOS SEGUNDOS DE FUEGO POR KILO: 50 para la madera, y la masa manda en todo el rango', () => {
    // ─── EL NÚMERO QUE `oracle` NECESITA Y NO PUEDE MEDIR ─────────────────
    //
    // La fórmula de allá es `min(fuelEnergy / 0,3 ; 0,8 / 0,016)` por kilo, o sea
    // la primera de las dos ramas de la ley 4 que llegue. Acá se corre el mundo y
    // se mira cuándo el cuerpo deja de estar encendido. Los dos tienen que dar lo
    // mismo dentro del tick, y si un día no dan, el modelo económico de allá está
    // midiendo una física que ya no existe.
    const filas: string[] = []
    const medido = new Map<string, number>()
    for (const [s, masas] of [
      ['madera', [0.2, 0.5, 1, 2, 5, 20]],
      ['madera-dura', [1]],
      ['hoja-seca', [1]],
      ['junco', [1]],
      ['corteza', [1]],
      ['liana', [1]],
      ['raiz', [1]],
      ['grano', [1]],
    ] as const) {
      for (const m of masas) {
        const r = cuantoArde(s, m)
        medido.set(`${s}:${String(m)}`, r.segundos)
        filas.push(
          `  ${s.padEnd(12)} ${String(m).padStart(4)} kg → ${r.segundos.toFixed(2).padStart(7)} s ` +
            `(${(r.segundos / m).toFixed(2)} s/kg) · queda «${r.queda}»`,
        )
      }
    }
    console.log(`\n─── CUÁNTO ARDE UN CUERPO, CONTRA \`stepWorld\` ───\n${filas.join('\n')}\n`)

    // LA MASA DECIDE, EN TODO EL RANGO. Antes del commit «la masa decide cuánto
    // arde» esta columna era 49,95 desde 1 kg hasta 50: las dos constantes se
    // cancelaban. Cien veces más masa, cien veces más fuego.
    const seg = (k: string): number => medido.get(k) as number
    expect(seg('madera:0.2')).toBeCloseTo(10.05, 6)
    expect(seg('madera:1')).toBeCloseTo(50.05, 6)
    expect(seg('madera:5')).toBeCloseTo(250.05, 6)
    // 1000,10 y no 1000,05: el leño de 20 kg se apaga UN TICK más tarde que lo que
    // da la regla de tres, y el tick de más es el redondeo del paso —`charred`
    // avanza de a `porPaso(0,016 / masa)` y el cruce de 0,8 cae adentro de un
    // paso—. Queda escrito con el número medido y no con el esperado, porque el
    // esperado era 1000,05 y la diferencia es exactamente el tipo de cosa que se
    // ajusta sin querer para que el número quede lindo.
    expect(seg('madera:20')).toBeCloseTo(1000.1, 6)
    // Y ESE ES EL NÚMERO DE LA PARTIDA: 20 kg de madera son los 1000 segundos que
    // dura una partida del test económico. El de allá lo despeja de las constantes
    // y acá está corrido.
    expect(seg('madera:20')).toBeGreaterThanOrEqual(1000)

    // La FÓRMULA de `oracle`, verificada sustancia por sustancia. `0,8 / 0,016` son
    // los 50 s por kilo del calor; `fuelEnergy / 0,3` es la llama. Lo que se apaga
    // primero manda, y para la liana, la raíz y el grano manda la llama.
    const porKilo = (s: SubstanceId): number => {
      const kilo: Body = { id: 'k', form: 'bloque', parts: [{ substance: s, mass: 1, q: {} }], joints: [], state: {} }
      const f = qualityOf(kilo, 'fuelEnergy', PHYS)
      return Math.min(f / 0.3, 0.8 / 0.016)
    }
    for (const s of ['madera', 'madera-dura', 'hoja-seca', 'junco', 'corteza', 'liana', 'raiz', 'grano'] as const) {
      // Dentro de un tick de 0,05 s: la fórmula es continua y el mundo avanza a
      // pasos, así que exigir igualdad exacta sería exigirle al mundo que no tenga
      // ticks. Medio tick de tolerancia para cada lado.
      expect([s, Math.abs(seg(`${s}:1`) - porKilo(s)) <= 0.25]).toEqual([s, true])
    }

    // Y LA LEÑA FALSA NO VOLVIÓ, que es la otra mitad del commit: todo termina en
    // residuo mineral, incluso lo que pesa menos de un kilo y lo que la llama apaga
    // antes de que el calor lo carbonice.
    for (const [s, m] of [
      ['madera', 0.2],
      ['liana', 1],
      ['grano', 1],
    ] as const) {
      expect([`${s}:${String(m)}`, cuantoArde(s, m).queda]).toEqual([
        `${s}:${String(m)}`,
        `residuo-mineral-de-${s}`,
      ])
    }
  })

  it('EL BARRIDO FINO DE LA VARA: 0,47 kg es el umbral, y no es una elección', () => {
    // El bloque 7 mide cuatro puntos —0,20, 0,46, 0,47 y 0,50— y de ahí sale la
    // perilla `MASA_DE_LA_VARA_QUE_ENCIENDE` de `oracle`. Cuatro puntos no dicen si
    // el umbral está en 0,47 o si hay un hueco antes: esto barre de a 0,01 y lo
    // deja clavado, que es lo que «verificar el número» quiere decir.
    const filas: string[] = []
    let primeraQueCocina = Number.NaN
    let precioDeLaPrimera = Number.NaN
    for (let m = 20; m <= 50; m++) {
      const masa = m / 100
      const { w, costo } = encenderYMirar(conPescadosEnLaParrilla(masa, 1), 80)
      const pez = w.bodies.get('pez0')
      const d = pez === undefined ? Number.NaN : qualityOf(pez.body, 'digestibility', PHYS)
      if (d >= 0.85 && Number.isNaN(primeraQueCocina)) {
        primeraQueCocina = masa
        precioDeLaPrimera = costo
      }
      filas.push(`  ${masa.toFixed(2)} kg → ${costo.toFixed(4).padStart(9)} · pescado ${d.toFixed(4)}${d >= 0.85 ? '  ← COCINA' : ''}`)
    }
    console.log(`\n─── LA VARA MÁS BARATA QUE COCINA, DE A UN CENTÉSIMO ───\n${filas.join('\n')}\n`)
    // 0,47 kg y 658,2789, verificados y no citados. Y el salto es una PARED: en
    // 0,46 el pescado se queda en 0,7461 y en 0,47 llega a 0,95 — no hay pendiente
    // suave que permita negociar el precio.
    //
    // EL UMBRAL NO SE MOVIÓ Y EL PRECIO SÍ: bajar `COSTO_VIVIR_POR_SEGUNDO` de 1,0
    // a 0,34 le sacó 1,584 al precio (era 659,8629) y dejó los 0,47 kg donde
    // estaban, que es lo que había que confirmar — la masa que cocina la decide la
    // ley 3 y no el hambre.
    expect(primeraQueCocina).toBe(0.47)
    expect(Number(precioDeLaPrimera.toFixed(4))).toBe(658.2789)
    // 30 s eran de sobra con siete cuerpos en la escena; con el decreto
    // materializado son ~90 y el barrido tarda cuatro veces más. Ver la nota del
    // bloque 7: los números no se movieron, se movió el reloj.
  }, 300_000)

  it.fails('SIGUE ABIERTO · LA YESCA DEL CAMPAMENTO ES UN CUERPO QUE EL MUNDO NO DEJA TIRADO', () => {
    // POR QUÉ SIGUE ABIERTO: el campamento del bloque 7 —y con él los 658,2789 que
    // el modelo económico de `@anima/oracle` usa de perilla— enciende con una yesca
    // de **`hoja-seca` de 1 kg**, y ese cuerpo no existe en ningún lado del mundo.
    // La tabla de biomas (`oracle/src/bioma.ts`) siembra `hoja-seca` en tres biomas
    // —bosque, matorral y estepa— y en los tres el rango de masa es **0,01 a 0,08
    // kg**: doce veces menos que la yesca del banco. Y ninguno de esos tres es una
    // orilla, o sea que en el lugar donde se pesca no hay una sola hoja seca.
    //
    // MEDIDO acá abajo, y el resultado no es «un poco peor»: es que el fuego del
    // banco **es un punto aislado**. Con la misma vara de 0,47 kg,
    //
    //   yesca                            el pescado termina en
    //   hoja-seca 0,01 kg                0,8451  ← NO cocina
    //   hoja-seca 0,08 kg (lo más gordo
    //     que el mundo deja de verdad)   0,8161  ← NO cocina
    //   hoja-seca 0,50 kg                0,7768  ← NO cocina
    //   hoja-seca 1,00 kg (el banco)     0,9500  ← cocina
    //
    // O sea que la masa de la yesca no es una pendiente: hay una ventana angosta y
    // el banco cayó adentro sin que nadie lo eligiera. Un test que enciende un fuego
    // con un cuerpo que el mundo no produce está midiendo una técnica que la
    // criatura no puede ejecutar, y la economía que se apoya en ese número está
    // comprando algo que no está a la venta.
    //
    // LA BUENA NOTICIA, que se mide igual porque es la salida: **el junco sí**. La
    // orilla siembra `junco` de 0,05 a 0,4 kg con el peso más alto de su tabla, y
    // con junco de CUALQUIER masa del rango el pescado llega a 0,8619. O sea que la
    // técnica existe en el mundo, con la yesca que la orilla deja tirada de verdad
    // y con la misma vara. Y el precio, barrido acá abajo, **no se mueve**: con
    // junco de 0,05 kg la más barata que cocina sigue siendo la de 0,47 kg y sigue
    // saliendo 658,2789 (eran 659,8629 antes de que `COSTO_VIVIR_POR_SEGUNDO` pasara
    // a 0,34: los mismos 1,584 de menos que la tabla del bloque 7, y la yesca sigue
    // sin cambiar el precio). O sea que la perilla de `oracle/tests/presupuesto.test.ts`
    // está bien aunque la yesca con la que se midió no exista, y eso hay que
    // decirlo: el número económico NO cuelga de este hueco.
    //
    // QUÉ HARÍA FALTA PARA CERRARLO: que el campamento del bloque 7 encienda con lo
    // que la orilla deja tirado, o sea junco, y que `MASA_DE_LA_VARA_QUE_ENCIENDE`
    // de `oracle/tests/presupuesto.test.ts` se remida contra ESE fuego. No es un
    // cambio de arnés: mueve el precio del fuego, que es el número del que cuelga la
    // ventana entera del ADR II-0009, y por eso no se hace de costado en este
    // tramo. Y hay una pregunta de física atrás que ningún ADR contestó: **por qué
    // la ventana de la yesca es angosta y no monótona**, que es lo que hace que este
    // hueco sea un hallazgo y no un ajuste.
    const filas: string[] = []
    const cocina = new Map<string, boolean>()
    for (const [y, masas] of [
      ['hoja-seca', [0.01, 0.08, 0.5, 1]],
      ['junco', [0.05, 0.2, 0.4]],
      ['corteza', [0.05, 0.5]],
      ['liana', [0.05, 0.6]],
      ['madera', [0.3, 2.5]],
    ] as const) {
      for (const my of masas) {
        const { w } = encenderYMirar(conPescadosEnLaParrilla(VARA_QUE_COCINA, 1, y, my), 80)
        const pez = w.bodies.get('pez0')
        const d = pez === undefined ? Number.NaN : qualityOf(pez.body, 'digestibility', PHYS)
        cocina.set(`${y}:${String(my)}`, d >= 0.85)
        filas.push(`  yesca ${y.padEnd(10)} ${String(my).padStart(5)} kg → pescado ${d.toFixed(4)}${d >= 0.85 ? '  ← COCINA' : ''}`)
      }
    }
    // Y CUÁNTO SALE EL FUEGO CON LA YESCA DEL MUNDO, que es la perilla que
    // `oracle/tests/presupuesto.test.ts` tendría que usar el día que esto se cierre.
    const conJunco: string[] = []
    let masBarataConJunco = Number.NaN
    let precioConJunco = Number.NaN
    for (let m = 44; m <= 48; m++) {
      const masa = m / 100
      const { w, costo } = encenderYMirar(conPescadosEnLaParrilla(masa, 1, 'junco', 0.05), 80)
      const pez = w.bodies.get('pez0')
      const d = pez === undefined ? Number.NaN : qualityOf(pez.body, 'digestibility', PHYS)
      if (d >= 0.85 && Number.isNaN(masBarataConJunco)) {
        masBarataConJunco = masa
        precioConJunco = costo
      }
      conJunco.push(`  vara ${masa.toFixed(2)} kg + junco 0,05 → ${costo.toFixed(4)} · pescado ${d.toFixed(4)}${d >= 0.85 ? '  ← COCINA' : ''}`)
    }
    console.log(
      `\n─── CON QUÉ YESCA PRENDE, CON LA VARA DE ${String(VARA_QUE_COCINA)} kg ───\n${filas.join('\n')}\n` +
        `\n─── Y EL PRECIO CON LA YESCA QUE LA ORILLA SÍ DEJA ───\n${conJunco.join('\n')}\n` +
        `la más barata que cocina con junco: ${masBarataConJunco.toFixed(2)} kg → ${precioConJunco.toFixed(4)} ` +
        `(la perilla de \`oracle\` es 658,2789: NO se mueve, aunque la yesca con la que se midió no exista)\n`,
    )

    // Lo que sí se puede afirmar hoy, y queda como regresión adentro del hueco: el
    // junco es la salida y anda en todo su rango.
    expect(cocina.get('junco:0.05')).toBe(true)
    expect(cocina.get('junco:0.4')).toBe(true)
    expect(masBarataConJunco).toBeLessThanOrEqual(VARA_QUE_COCINA)
    // Y el hueco: la hoja seca del banco cocina, y la que el mundo deja NO.
    expect(cocina.get('hoja-seca:1')).toBe(true)
    expect(cocina.get('hoja-seca:0.08'), 'la yesca del campamento no existe en el mundo').toBe(true)
  }, 30_000)
})
