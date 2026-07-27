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
  it('pescar POR LA COSTURA funciona — pero recién desde el segundo paso', () => {
    // La buena noticia primero, porque es el criterio: con el proveedor apagado y
    // por la costura entera (`Partida` → `Contexto` → `SkillRun` → `stepWorld` →
    // `desenlaceDe` → `Vuelo`), una criatura con una caña en la orilla saca un
    // pescado. MEDIDO: sale en 32 ticks de vuelo, con 1 cobro en el libro
    // calórico y el dado del mundo movido.
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
  })

  it.fails('EL PRIMER `see()` DE UNA HABILIDAD NO VE NADA DE LO QUE PONE EL DIOS', () => {
    // POR QUÉ SIGUE ABIERTO: quien materializa lo del dios es `materializarPozos`,
    // y corre ADENTRO de `stepWorld`. `Partida` construye su `Proyeccion` en el
    // constructor, sobre el `WorldState` crudo del tick 0 — donde el banco de
    // peces todavía NO EXISTE—, y `Vuelo.intencionDelTick()` avanza el generador
    // ANTES del primer `stepWorld`, que es el orden correcto para todo lo demás
    // («la criatura actúa sobre el mundo que vio»).
    //
    // MEDIDO, sobre la orilla de la semilla 20260727n:
    //   paso 1 de la habilidad ve: ana-cuerpo, cana
    //   paso 2 ve:                 ana-cuerpo, cana, pozo:-6:-6
    //
    // POR QUÉ IMPORTA: doce de las quince innatas arrancan con un `see()` o un
    // `goTo` derivado de un `see()`, y el argumento se arma en la PRIMERA línea
    // del generador (así lo hace `tests/las-quince.test.ts` y así lo hace el
    // ejemplo canónico). Una criatura que abre los ojos en la orilla no ve el
    // banco de peces, y la habilidad se rinde con «no veo el pozo» sin que nada
    // falle. Es invisible en todos los tests del paquete porque ninguno tiene
    // dios: sin dios, `stepWorld` no materializa nada y el tick 0 y el 1 se ven
    // igual.
    //
    // QUÉ HARÍA FALTA, y es una decisión de diseño y no un parche: que el mundo
    // separe «materializar» de «dar un paso» —una `materializarWorld(state)`
    // exportada por `world/src/step.ts` que `Partida` pueda llamar en el
    // constructor— o que `Partida` dé un paso vacío antes de poner nada en vuelo,
    // lo cual le cambia el tick inicial a toda partida y por lo tanto su traza.
    // Archivos: `world/src/step.ts` (`materializarPozos`) y
    // `perceive/src/bucle.ts` (el constructor de `Partida`).
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
  it('el número del criterio (b) sale de una corrida SIN reloj de pared', () => {
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

    // Y con un reloj de pared DE VERDAD, en esta máquina, sobre 2000 ticks:
    // también 0. Eso sí es una medición y no una tautología — pero ver el bloque
    // de abajo por qué tampoco puede dar otra cosa.
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

  it.fails('EL MISMO TICK TARDÍO SE CUENTA 20 VECES O 0, SEGÚN LO QUE PASÓ ANTES', () => {
    // POR QUÉ SIGUE ABIERTO: `avanzar` lleva `#vence` sumándole UNA ventana por
    // tick pase lo que pase, y no lo vuelve a anclar cuando el tick termina
    // ANTES de su ventana. O sea que un bucle que corre más rápido que el tiempo
    // real —que es todo bucle sin `sleep`, o sea todos los de este repositorio—
    // ACUMULA CRÉDITO sin tope: a 20 Hz, cada tick que tarda 1 ms en vez de 50
    // guarda 49 ms de holgura, y sobre los 2000 ticks del criterio (b) eso son
    // 98 SEGUNDOS de colchón. Después de eso, para que `porTiempo` se mueva una
    // sola vez haría falta un tick que tarde un minto y medio.
    //
    // MEDIDO, con el MISMO tick de 1000 ms (veinte ventanas a 20 Hz) puesto en
    // dos lugares distintos de la misma corrida de 102 ticks:
    //
    //   el tick lento PRIMERO, sin crédito acumulado ....... porTiempo 20
    //   el tick lento después de 100 ticks de 1 ms .........  porTiempo  0
    //   diez ticks de 1000 ms después de 100 rápidos ....... porTiempo 93
    //     (de arranque habrían sido 200: el crédito se come 107)
    //   control negativo, los 102 a 1 ms ...................  porTiempo  0
    //   control positivo, los 102 a 60 ms ..................  porTiempo 21
    //
    // El test «el contador se puede mover» de `el-bucle.test.ts` usa un reloj que
    // llega tarde DESDE EL PRIMER TICK, que es exactamente el único régimen en el
    // que el contador se mueve. Con crédito acumulado no se mueve nunca, y el
    // cero del criterio (b) no distingue «llegamos a horario» de «nunca llegamos
    // a estar en deuda».
    //
    // QUÉ HARÍA FALTA: en `perceive/src/bucle.ts:avanzar`, volver a anclar la
    // ventana cuando el tick terminó antes de tiempo —`if (fin < this.#vence)
    // this.#vence = fin + ventana`, que es lo que hace un game loop de verdad
    // cuando duerme hasta el próximo cuadro—. Es una línea, pero le cambia el
    // significado al número que el criterio (b) ya reportó, así que la decisión
    // (¿el bucle duerme o no duerme?) es de quien escribió el criterio.
    const tarde = 1000
    const primero = conReloj((t) => (t === 0 ? tarde : 1), 102).porTiempo
    const despues = conReloj((t) => (t === 100 ? tarde : 1), 102).porTiempo
    console.log(
      `\n─── el crédito del deadline ───\n` +
        `un tick de ${String(tarde)} ms al principio → porTiempo ${String(primero)}\n` +
        `el MISMO tick de ${String(tarde)} ms en el 101 → porTiempo ${String(despues)}\n` +
        `diez de ${String(tarde)} ms después de 100 rápidos → porTiempo ${String(conReloj((t) => (t >= 100 ? tarde : 1), 110).porTiempo)}\n` +
        `control: 102 a 1 ms → ${String(conReloj(() => 1, 102).porTiempo)} · 102 a 60 ms → ${String(conReloj(() => 60, 102).porTiempo)}\n`,
    )
    expect(despues, 'el mismo tick tardío tiene que contar lo mismo esté donde esté').toBe(primero)
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

  it.fails('EL DADO QUE VE LA HABILIDAD (`ctx.rng`) NO ES EL DEL MUNDO Y NO VIAJA', () => {
    // POR QUÉ SIGUE ABIERTO: `Partida` construye su PROPIO dado
    // (`dadoDelMundo(o.semilla ?? 0)`) y se lo da a `ctx.rng`. El mundo tiene otro,
    // adentro de `WorldState.dios`. MEDIDO sobre una partida con dios después de
    // pescar: el dado del mundo va en 1831565813 y el de la `Partida` sigue en el
    // que le pasaron. Son dos generadores independientes.
    //
    // Consecuencia, y es la que importa: `worldSlots`/`restoreWorld` restauran el
    // dado DEL MUNDO y no el de la habilidad, así que **guardar y cargar a mitad
    // de una partida le reinicia la suerte a la mente**. Hoy no se nota porque
    // ninguna de las quince innatas usa `ctx.rng`; se nota el día que una elija a
    // dónde caminar tirando el dado, que es la primera cosa que va a hacer una
    // mente sin LLM.
    //
    // QUÉ HARÍA FALTA: que `Contexto` reciba `dadoDe(state.dios)` en vez de un dado
    // propio —el mundo ya lo tiene y ya lo guarda— o, si la mente tiene que tener
    // su propio azar para no correrle el dado al mundo, que ese entero viva en una
    // ranura del snapshot. Archivos: `perceive/src/bucle.ts` (`Partida.dado`) y
    // `perceive/src/contexto.ts` (`ContextoOptions.rng`).
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
    // El estado del mundo, guardado y restaurado, tendría que alcanzar para
    // reanudar la partida entera. Lo que le falta es este entero.
    const enDisco = JSON.parse(JSON.stringify([...worldSlots(p.state)])) as [string, unknown][]
    const seguida = new Partida(restoreWorld(new Map(enDisco)))
    expect(
      seguida.dado.estado(),
      'el snapshot del mundo no trae el dado que la mente estaba usando',
    ).toBe(p.dado.estado())
  })
})

// ═══ 5. EL AISLAMIENTO MÁS ALLÁ DE `at` ══════════════════════════════════════

describe('5. qué más se puede mutar de la vista', () => {
  const conPiedra = (): WorldState =>
    conElla([{ body: cuerpo('p', 'piedra', 5), at: { x: 3, y: 0 } }])

  it('EL MUNDO NO SE MUEVE por ninguna de las cuatro: es lo que el agujero 2 pedía', () => {
    // La parte buena, verificada campo por campo y no de palabra. `at` rebota
    // (sellado); los otros tres se dejan mutar pero lo que se muta es una COPIA,
    // así que ni el cuerpo, ni sus juntas, ni lo que la criatura tiene en la mano
    // se mueven en `WorldState`.
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
  })

  it.fails('PERO LA MENTIRA SOBREVIVE AL TICK: la vista está memoizada y no sellada', () => {
    // POR QUÉ SIGUE ABIERTO: `Proyeccion.#vistas` memoiza la `BodyView` por
    // `(actor, cuerpo)` y la devuelve por identidad, así que la vista es un objeto
    // COMPARTIDO por todo lo que mire ese cuerpo en ese tick — `see()`, `got` de
    // un `StepResult`, y el `base` del que sale `ctx.self`. Sellar el `Placement`
    // cerró la única vía por la que la mutación llegaba al mundo; no cerró que una
    // habilidad se mienta a sí misma para el resto del tick.
    //
    // MEDIDO: `b.name = 'PIEDRA FALSA'`, y el `see()` siguiente del MISMO tick
    // devuelve el mismo objeto con el nombre falso. Lo mismo vale para `joints`
    // (le crecen juntas que no existen) y para `holding` (le aparecen cosas en la
    // mano que el mundo no le dio) — y `q()`/`can()` siguen contestando la verdad,
    // que es la peor combinación posible: la vista y el juez dicen cosas
    // distintas.
    //
    // POR QUÉ IMPORTA aunque hoy haya una habilidad por actor: es la misma clase
    // de agujero que el agujero 2, y el argumento con el que se cerró aquél vale
    // igual acá — el `readonly` del tipo es «una defensa con horario» que no cubre
    // lo que se carga de un guardado ni una innata parcheada.
    //
    // QUÉ HARÍA FALTA: `Object.freeze` sobre la `BodyView` y sobre sus arreglos
    // (`joints`, `holding`) al salir de la caché, en `perceive/src/vista.ts`
    // (`Proyeccion.vista` y `Proyeccion.self`). Cuesta lo mismo que sellar el
    // `Placement` —las vistas ya se asignan una sola vez por tick y por cuerpo— y
    // el banco de `banco-la-vista.test.ts` ya tiene el arnés para medirlo.
    const p = new Partida(conPiedra())
    let segundoNombre = ''
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        const a = ctx.see([{ q: 'mass', op: '>=', v: 1 }]).find((x) => x.id === 'p') as BodyView
        ;(a as { name: string }).name = 'PIEDRA FALSA'
        const b = ctx.see([{ q: 'mass', op: '>=', v: 1 }]).find((x) => x.id === 'p') as BodyView
        segundoNombre = b.name
        yield ctx.wait(0)
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 10 && !v.terminado; i++) p.tick()
    expect(segundoNombre, 'la segunda mirada del mismo tick se lleva la mentira').not.toBe(
      'PIEDRA FALSA',
    )
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
