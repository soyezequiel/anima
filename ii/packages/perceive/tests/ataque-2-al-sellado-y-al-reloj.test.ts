// ─── EL SEGUNDO ATAQUE A LA COSTURA ──────────────────────────────────────────
//
// El tramo anterior cerró cuatro de los cinco agujeros que el primer adversario
// dejó: el primer `see()`, `ticksPerdidos`, el sellado de la vista y el dado.
// Este archivo va contra las reparaciones, no contra los agujeros.
//
// Lo que encontró, en cuatro líneas:
//
//   (a) EL SELLADO AGUANTA MÁS DE LO QUE SU BARRIDO PRUEBA. El barrido de nueve
//       campos toca la SUPERFICIE de la vista; acá se atacan quince vías más
//       —`supportedBy.supportedBy`, `covering.at`, los elementos de `joints` y
//       de `holding`, `delete`, `defineProperty`, `setPrototypeOf` y agregar un
//       campo nuevo— y rebotan las quince. Y el mundo no se movió, cuerpo por
//       cuerpo. Lo ÚNICO mutable que quedó es el arreglo que `see()` devuelve, y
//       está medido por qué no importa.
//   (b) `ctx` NO EXPONE NINGÚN OBJETO DE CELDA. `qAt` devuelve un número, así
//       que `CeldaVista` —que sí es mutable y se construye fresca por llamada—
//       no es alcanzable desde una habilidad. Es una defensa por AUSENCIA de
//       superficie, y las defensas por ausencia se rompen solas el día que
//       alguien agrega el getter: queda clavada.
//   (c) `ticksPerdidos` SE MUEVE EN LAS DOS DIRECCIONES y el mismo tick lento
//       cuenta lo mismo esté donde esté. Pero el crédito NO desapareció: se
//       acotó a UNA ventana. Dos ticks lentos idénticos cuentan 39 pegados y 38
//       separados, y el test que afirma la propiedad eligió el único valor
//       —1000 ms, veinte ventanas exactas— donde el resto vale cero.
//   (d) `ticksPerdidos === 0` SOBRE 2000 TICKS SIGUE SIENDO CIERTO, y ahora está
//       AFIRMADO y no sólo impreso. Con el contador viejo era cero por
//       construcción; con el arreglado es cero con 2000 ticks corridos en 14 ms
//       de reloj de pared contra 100 000 ms de presupuesto.
//
// ─── CÓMO SE LEE ────────────────────────────────────────────────────────────
//
//   · `it(...)`             → la promesa se cumple, con su número medido.
//   · `it(... documentado)` → un número que hoy es así; el cuerpo lo clava.
//   · `it.fails(...)`       → HUECO ABIERTO, con su «POR QUÉ SIGUE ABIERTO».

import { describe, expect, it } from 'vitest'
import { qualityOf } from '@anima/physics'
import { hashWorldState } from '@anima/world'
import type { BodyView, Ctx, Intent, Outcome, StepResult } from '@anima/skills'

import { Partida } from '../src/index.js'
import { actor, conElla, criatura, cuerpo, mundo } from './mundo.js'

type Hab = Generator<Intent, Outcome, StepResult>

/**
 * El patrón de siempre para los milisegundos de pared: **se imprime siempre, se
 * afirma sólo midiendo en serio**. Lo usa el bloque (d), que corre con
 * `Date.now()` de verdad y por lo tanto mide la MÁQUINA además del bucle.
 *
 * Hizo falta cuando la suite pasó a poder correrse con los ocho paquetes en
 * paralelo —239 s a ~80 s de verificación—: ahí la guarda de margen de (d) hizo
 * exactamente su trabajo y dijo que el cero no significaba nada. Tenía razón, y
 * la respuesta correcta no es aflojar la guarda sino no afirmar el reloj cuando
 * la máquina está llena.
 */
const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

// ═══ (a) EL SELLADO, POR LAS VÍAS QUE EL BARRIDO NO TOCA ═════════════════════

/**
 * Una pila de tres —`suelo` ← `base` ← `p`— con una tapa encima y una caña de
 * dos partes en la mano.
 *
 * La pila tiene TRES niveles a propósito: el barrido del tramo anterior probó
 * `b.supportedBy = undefined`, que es la superficie. Lo que no probó es
 * `b.supportedBy.supportedBy.name = 'X'` — la vista anidada de la vista anidada,
 * que la fábrica construye en una llamada recursiva distinta y que podría
 * perfectamente haberse quedado sin congelar sin que nada lo notara.
 */
function laPila(): ReturnType<typeof mundo> {
  return mundo({
    bodies: [
      { body: criatura('ella'), at: { x: 0, y: 0 } },
      { body: cuerpo('suelo', 'piedra', 20), at: { x: 1, y: 0 } },
      { body: cuerpo('base', 'piedra', 9), at: { x: 1, y: 0 }, supportedBy: 'suelo' },
      { body: cuerpo('p', 'piedra', 5), at: { x: 1, y: 0 }, supportedBy: 'base' },
      { body: cuerpo('tapa', 'hoja', 1), at: { x: 1, y: 0 }, covering: 'p' },
      {
        body: {
          id: 'mano',
          form: 'vara' as const,
          parts: [
            { substance: 'madera', mass: 0.3, q: {} },
            { substance: 'liana', mass: 0.1, q: {} },
          ],
          joints: [{ a: 0, b: 1, via: 'liana', strength: 0.7 }],
          state: {},
        },
        at: { x: 0, y: 0 },
        heldBy: 'ella',
      },
    ],
    actors: [actor('ella', { holding: ['mano'] })],
  })
}

/** Todo lo que el mundo guarda de un cuerpo, aplanado, para comparar cuerpo por cuerpo. */
function retrato(w: ReturnType<typeof mundo>): readonly string[] {
  const out: string[] = []
  for (const [id, c] of w.bodies) {
    const qs = ['mass', 'temperature', 'moisture', 'rigidity', 'stamina'] as const
    out.push(
      [
        id,
        `at=${String(c.at.x)},${String(c.at.y)}`,
        `heldBy=${c.heldBy ?? '-'}`,
        `supportedBy=${c.supportedBy ?? '-'}`,
        `covering=${c.covering ?? '-'}`,
        `parts=${c.body.parts.map((p) => `${p.substance}:${String(p.mass)}`).join('+')}`,
        `joints=${c.body.joints.map((j) => `${String(j.a)}-${String(j.b)}@${String(j.strength)}`).join(',')}`,
        ...qs.map((q) => `${q}=${qualityOf(c.body, q, w.phys).toFixed(6)}`),
      ].join(' '),
    )
  }
  for (const [id, a] of w.actors) {
    out.push(`actor:${id} holding=${a.holding.join('+')} capacity=${String(a.capacity)} permits=${a.permits}`)
  }
  return out
}

describe('(a) el sellado, por las quince vías que el barrido de nueve no toca', () => {
  it('las quince rebotan, y el mundo no se movió cuerpo por cuerpo', () => {
    // Se ataca desde ADENTRO de una habilidad —el único camino por el que la
    // vista llega memoizada y devuelta por identidad, que es donde vivía el
    // agujero— y con la habilidad corriendo de verdad: si la habilidad no
    // arranca, la lista de resultados queda vacía y `every` la aprueba. Por eso
    // se afirma la CANTIDAD además del contenido.
    //
    // CARNADA, revertida a mano y medida: sacando el `Object.freeze(v)` del final
    // de `Proyeccion.vista` (`perceive/src/vista.ts`) quedan en MUTA OCHO de las
    // quince —`supportedBy.name`, `supportedBy.supportedBy.name`, `delete`,
    // `defineProperty`, `setPrototypeOf`, el campo nuevo, `holding[0].name` y
    // `heldBy`—. Sacando ADEMÁS los dos `Object.freeze` de `joints`, DIEZ: se
    // suman `coveredBy.joints.push` y `holding[0].joints[0].strength`.
    //
    // Las cinco que rebotan igual son las cinco de `at`, y no rebotan por este
    // congelado sino por `sellar()`, que congela el `Placement` DEL MUNDO. Por eso
    // el barrido no puede probar sólo `at`: con `at` solo, la carnada da verde.
    // EL CONTROL ES UNA GEMELA, y tiene que serlo: `p.tick()` corre el mundo, así
    // que comparar contra el estado inicial mediría las doce leyes y no el
    // ataque. La gemela vive los mismos ticks con una habilidad que sólo espera.
    const control = new Partida(laPila())
    const vc = control.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        yield ctx.wait(0)
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 10 && !vc.terminado; i++) control.tick()

    const p = new Partida(laPila())
    const hechos: string[] = []
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        const b = ctx.see([{ q: 'mass', op: '>=', v: 1 }]).find((x) => x.id === 'p') as BodyView
        const m = ctx.self.holding[0] as BodyView
        const probar = (que: string, f: () => void): void => {
          try {
            f()
            hechos.push(`${que}: MUTA`)
          } catch {
            hechos.push(`${que}: rebota`)
          }
        }
        // Las vistas ANIDADAS, que son las que la fábrica arma en una llamada
        // recursiva distinta de la que se cachea.
        probar('supportedBy.name', () => {
          ;(b.supportedBy as unknown as { name: string }).name = 'X'
        })
        probar('supportedBy.supportedBy.name', () => {
          ;(b.supportedBy?.supportedBy as unknown as { name: string }).name = 'X'
        })
        probar('supportedBy.at.x', () => {
          ;(b.supportedBy?.at as unknown as { x: number }).x = 999
        })
        probar('supportedBy.supportedBy.at.y', () => {
          ;(b.supportedBy?.supportedBy?.at as unknown as { y: number }).y = 999
        })
        probar('coveredBy.at.y', () => {
          ;(b.coveredBy?.at as unknown as { y: number }).y = 999
        })
        probar('coveredBy.joints.push', () => {
          ;(b.coveredBy?.joints as unknown as unknown[]).push({ a: 0, b: 1, strength: 1 })
        })
        // Las CUATRO formas de escribir que no son una asignación de campo.
        probar('delete b.name', () => {
          delete (b as unknown as { name?: string }).name
        })
        probar('defineProperty(b, name)', () => {
          Object.defineProperty(b, 'name', { value: 'X' })
        })
        probar('setPrototypeOf(b, null)', () => {
          Object.setPrototypeOf(b, null)
        })
        probar('b.campoNuevo = 1', () => {
          ;(b as unknown as Record<string, unknown>)['campoNuevo'] = 1
        })
        // Los ELEMENTOS de las dos colecciones. `joints` y `holding` rebotan un
        // `push` desde el tramo anterior; lo que no estaba probado es escribir
        // ADENTRO de un elemento, que es la mutación que de verdad miente.
        probar('holding[0].name', () => {
          ;(m as unknown as { name: string }).name = 'X'
        })
        probar('holding[0].joints[0].strength', () => {
          ;(m.joints[0] as unknown as { strength: number }).strength = 9
        })
        probar('holding[0].at.x', () => {
          ;(m.at as unknown as { x: number }).x = 77
        })
        // Y los tres campos de `BodyView` que el barrido de nueve no nombra.
        probar('self.id', () => {
          ;(ctx.self as unknown as { id: string }).id = 'otra'
        })
        probar('b.heldBy', () => {
          ;(b as unknown as { heldBy?: string }).heldBy = 'ella'
        })
        yield ctx.wait(0)
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 10 && !v.terminado; i++) p.tick()
    log(['══ (a) LAS QUINCE VÍAS ════════════════════════════════════════════════', ...hechos.map((h) => `  ${h}`)])
    // Que la habilidad haya corrido de verdad, y las quince.
    expect(v.outcome?.ok).toBe(true)
    expect(hechos.length).toBe(15)
    expect(hechos.filter((h) => h.endsWith('MUTA'))).toEqual([])
    // Y la pila estaba puesta de verdad: si `supportedBy` fuera `undefined` las
    // pruebas anidadas habrían rebotado por otra razón.
    const vista = p.proyeccion.cuerpo('p', 'ella')
    expect(vista?.supportedBy?.id).toBe('base')
    expect(vista?.supportedBy?.supportedBy?.id).toBe('suelo')
    expect(vista?.coveredBy?.id).toBe('tapa')
    // EL MUNDO NO SE MOVIÓ, cuerpo por cuerpo y no sólo por el hash: un hash
    // igual con dos cambios que se compensan es exactamente lo que un adversario
    // busca, y el retrato lo hace imposible de esconder. Se compara contra la
    // gemela que vivió los mismos ticks sin atacar nada.
    expect(retrato(p.state)).toEqual(retrato(control.state))
    expect(hashWorldState(p.state)).toBe(hashWorldState(control.state))
    // Y que la gemela haya vivido: un mundo que no se movió aprobaría lo de
    // arriba con cualquier cosa.
    expect(p.state.tick).toBe(control.state.tick)
    expect(p.state.tick).toBeGreaterThan(0)
  })

  it('documentado · lo ÚNICO mutable que queda es el arreglo de `see()`, y es fresco por llamada', () => {
    // No se congela y no hace falta: `#see` arma un arreglo nuevo en cada
    // llamada, así que un `push` se lo lleva quien lo hizo y nadie más lo ve. Los
    // ELEMENTOS sí son los objetos memoizados y compartidos, y ésos sí están
    // congelados — que es la parte que importa.
    //
    // Queda escrito porque la próxima vez que alguien memoice el arreglo para
    // ahorrarse una asignación por tick, esto pasa de «no hace falta» a agujero
    // sin que ninguna línea de `vista.ts` haya cambiado.
    const p = new Partida(laPila())
    const medido: string[] = []
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        const donde = [{ q: 'mass' as const, op: '>=' as const, v: 1 }]
        const a = ctx.see(donde)
        const b = ctx.see(donde)
        medido.push(`arreglos distintos: ${String(a !== b)}`)
        medido.push(`elementos por identidad: ${String(a[0] === b[0])}`)
        medido.push(`elementos congelados: ${String(a.every((x) => Object.isFrozen(x)))}`)
        const largo = a.length
        a.push(a[0] as BodyView)
        medido.push(
          `push al arreglo: ${String(a.length === largo + 1)} · la mirada siguiente sigue en ${String(largo)}: ${String(ctx.see(donde).length === largo)}`,
        )
        yield ctx.wait(0)
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 10 && !v.terminado; i++) p.tick()
    expect(v.outcome?.ok).toBe(true)
    expect(medido).toEqual([
      'arreglos distintos: true',
      'elementos por identidad: true',
      'elementos congelados: true',
      'push al arreglo: true · la mirada siguiente sigue en 5: true',
    ])
    log(['══ (a) EL ARREGLO DE `see()` ══════════════════════════════════════════', ...medido.map((x) => `  ${x}`)])
  })
})

// ═══ (b) LA CELDA NO ES ALCANZABLE ═══════════════════════════════════════════

describe('(b) `CeldaVista` es mutable y no importa porque `ctx` no la publica', () => {
  it('`Ctx` no tiene ningún método que devuelva un objeto de celda: `qAt` devuelve un número', () => {
    // `IndiceDelTick.celda()` devuelve un `CeldaVista` fresco, sin congelar, y
    // eso está bien mientras nadie de afuera lo pueda tocar. La superficie de la
    // MENTE no lo publica: lo único que hay es `qAt(at, q) → number`, y un número
    // no se muta.
    //
    // Es una defensa por AUSENCIA de superficie, que es la clase que se rompe sin
    // que nadie toque el archivo defendido: el día que alguien agregue
    // `ctx.celda(at)` porque una habilidad necesita las cuatro cualidades juntas,
    // la vista de celda entra sin sellar y este test no se entera —hay que
    // acordarse—. Por eso además de afirmar el tipo, se afirma que el objeto que
    // el índice devuelve HOY es fresco y mutable, que es lo que habría que
    // congelar entonces.
    const p = new Partida(laPila())
    const c1 = p.proyeccion.indice.celda({ x: 1, y: 0 })
    const c2 = p.proyeccion.indice.celda({ x: 1, y: 0 })
    expect(c1).not.toBe(c2)
    expect(Object.isFrozen(c1)).toBe(false)

    const medido: string[] = []
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        medido.push(`qAt devuelve ${typeof ctx.qAt({ x: 1, y: 0 }, 'wet')}`)
        medido.push(`hay ctx.celda: ${String('celda' in (ctx as unknown as Record<string, unknown>))}`)
        yield ctx.wait(0)
        return { ok: true }
      },
      undefined,
    )
    for (let i = 0; i < 10 && !v.terminado; i++) p.tick()
    expect(medido).toEqual(['qAt devuelve number', 'hay ctx.celda: false'])
  })
})

// ═══ (c) EL RELOJ: LAS DOS DIRECCIONES Y EL RESTO ════════════════════════════

/** Corre `n` ticks con un reloj de pared falso que tarda `ms(tick)` por tick. */
function conReloj(ms: (tick: number) => number, n: number): number {
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
  return p.avanzar(n).porTiempo
}

describe('(c) `ticksPerdidos` se mueve para los dos lados, y lo que le quedó de crédito', () => {
  it('sube con un tick lento, baja a cero con ticks rápidos, y no depende del lugar', () => {
    // Las dos direcciones, que es lo que el criterio pide y lo que el contador
    // viejo no podía: sube cuando se llega tarde y vuelve a cero cuando se llega
    // a horario. Y el mismo tick lento, en el paso 1 y en el 101, cuenta igual.
    const barrido: string[] = []
    for (const tarde of [1000, 1025, 1049, 60, 99, 149, 200, 275]) {
      const primero = conReloj((t) => (t === 0 ? tarde : 1), 102)
      const enEl101 = conReloj((t) => (t === 100 ? tarde : 1), 102)
      expect([tarde, enEl101]).toEqual([tarde, primero])
      barrido.push(
        `  un tick de ${String(tarde).padStart(4)} ms → ${String(primero).padStart(3)} perdidos, esté en el paso 1 o en el 101`,
      )
    }
    // SUBE: y no de a un escalón fijo, sino proporcional al atraso.
    expect(conReloj((t) => (t === 0 ? 1000 : 1), 102)).toBe(19)
    expect(conReloj((t) => (t >= 100 ? 1000 : 1), 110)).toBe(190)
    // BAJA A CERO: un bucle que llega a horario no debe nada, y uno que se
    // adelanta tampoco acumula crédito para gastar.
    expect(conReloj(() => 1, 102)).toBe(0)
    expect(conReloj(() => 50, 102)).toBe(0)
    // Y la deuda chica y sostenida se cobra: 102 ticks 10 ms tarde son 20
    // ventanas enteras, no 102 y no 0.
    expect(conReloj(() => 60, 102)).toBe(20)
    log(['══ (c) LAS DOS DIRECCIONES ════════════════════════════════════════════', ...barrido])
  })

  it('documentado · el crédito no desapareció: se acotó a UNA ventana, y el test que lo cuida eligió el número redondo', () => {
    // LO QUE SE ARREGLÓ, y está bien arreglado: el contador viejo acreditaba
    // holgura SIN TOPE, así que mil ticks rápidos le compraban perdón a uno
    // lento. Con el acumulador saturado en cero, el perdón máximo es UNA ventana.
    //
    // LO QUE QUEDA, medido: el resto sub-ventana de un tick lento SÍ se puede
    // pagar corriendo rápido, así que dos ticks lentos IDÉNTICOS no cuentan lo
    // mismo según estén pegados o separados.
    //
    //   tick lento   dos PEGADOS   dos SEPARADOS por 50 rápidos
    //   1000 ms      38            38    ← veinte ventanas exactas: no hay resto
    //   1025 ms      39            38
    //   1049 ms      39            38
    //     99 ms       1             0
    //    149 ms       3             2
    //    275 ms       9             8
    //
    // Y ACÁ ESTÁ LO QUE HAY QUE DECIR: el test que afirma la propiedad
    // («EL MISMO TICK TARDÍO CUENTA LO MISMO ESTÉ DONDE ESTÉ», en
    // `ataque-a-la-costura.test.ts`) usa `tarde = 1000`, que a 20 Hz son VEINTE
    // VENTANAS EXACTAS. Es el único valor de la tabla donde el resto vale cero,
    // o sea el único donde la propiedad no se puede romper. La propiedad que sí
    // vale para todo valor es la de UN tick lento —afirmada arriba, para ocho
    // valores— y no la de dos.
    //
    // NO ES UN HUECO: para un bucle de tiempo real es la lectura correcta. Si
    // entre los dos ticks lentos el bucle se puso al día, ya no está en deuda, y
    // «ticks perdidos» cuenta ventanas que nadie corrió y no ticks que llegaron
    // tarde. Queda documentado porque el número está a un `tarde` de distancia de
    // parecer un bug, y porque la cota —una ventana, nunca más— es lo que hay que
    // volver a verificar si alguien toca `avanzar`.
    const filas: string[] = []
    for (const tarde of [1000, 1025, 1049, 99, 149, 275]) {
      const pegados = conReloj((t) => (t === 0 || t === 1 ? tarde : 1), 102)
      const separados = conReloj((t) => (t === 0 || t === 50 ? tarde : 1), 102)
      const uno = conReloj((t) => (t === 0 ? tarde : 1), 102)
      // LA COTA, que es lo único que hay que cuidar: el perdón que un tramo
      // rápido puede comprar vale como mucho UNA ventana por tick lento, así que
      // dos idénticos difieren en 0 o en 1 según estén pegados o separados —
      // nunca más—. Con el contador viejo esa diferencia no tenía tope.
      expect([tarde, pegados - separados]).toEqual([tarde, pegados === separados ? 0 : 1])
      // Y los dos pegados son exactamente el doble de uno, o uno más: lo que
      // sobra del primero se acumula en vez de perdonarse.
      expect([tarde, pegados - 2 * uno]).toEqual([tarde, pegados === 2 * uno ? 0 : 1])
      // Los separados nunca cuentan de más.
      expect([tarde, separados]).toEqual([tarde, 2 * uno])
      filas.push(
        `  ${String(tarde).padStart(4)} ms → uno ${String(uno).padStart(3)} · dos pegados ${String(pegados).padStart(3)} · dos separados ${String(separados).padStart(3)}`,
      )
    }
    // El caso del test hermano, aislado: con veinte ventanas exactas los dos dan
    // lo mismo, y por eso ese número no puede mostrar el resto.
    expect(conReloj((t) => (t === 0 || t === 1 ? 1000 : 1), 102)).toBe(
      conReloj((t) => (t === 0 || t === 50 ? 1000 : 1), 102),
    )
    // Y con un valor que no es múltiplo, no dan lo mismo.
    expect(conReloj((t) => (t === 0 || t === 1 ? 1025 : 1), 102)).not.toBe(
      conReloj((t) => (t === 0 || t === 50 ? 1025 : 1), 102),
    )
    log(['══ (c) LO QUE LE QUEDÓ DE CRÉDITO ═════════════════════════════════════', ...filas])
  })
})

// ═══ (d) EL CERO DE 2000 TICKS, AFIRMADO ═════════════════════════════════════

describe('(d) `ticksPerdidos === 0` sobre 2000 ticks, con el contador arreglado', () => {
  it('cinco corridas con `Date.now()` de verdad, y el margen que hace que el cero signifique algo', () => {
    // El criterio (b) del Hito 5 dice `ticksPerdidos === 0` sobre 2000 ticks. El
    // archivo hermano lo IMPRIME y afirma solamente `ticks === 2000`, que es
    // honesto —con el contador viejo el cero era por construcción— pero deja el
    // criterio sin afirmar. Con el acumulador saturado el cero ya significa lo que
    // decía, así que acá se afirma.
    //
    // Y con el margen a la vista, que es lo que lo hace un test y no una lotería:
    // 2000 ticks a 20 Hz presupuestan 100 000 ms de reloj de pared y la corrida
    // entera tarda 11–17 ms en esta máquina, o sea 6000× más rápido que el tiempo
    // real. Para que `porTiempo` se moviera una sola vez haría falta una pausa de
    // 50 ms adentro de una corrida de 14 ms. Si algún día esto se pone rojo, el
    // `pared` impreso dice si fue la máquina o el bucle.
    const filas: string[] = []
    for (let k = 0; k < 5; k++) {
      const p = new Partida(conElla([], { stamina: 9000 }), { reloj: () => Date.now() })
      p.volar(
        'ella',
        function* (ctx: Ctx): Hab {
          for (;;) yield ctx.goTo({ x: 5, y: 0 }, {})
        },
        undefined,
      )
      const t0 = Date.now()
      const r = p.avanzar(2000)
      const pared = Date.now() - t0
      filas.push(
        `  corrida ${String(k + 1)}: ticks ${String(r.ticks)} · porTiempo ${String(r.porTiempo)} · porFalla ${String(r.porFalla)} · pared ${String(pared)} ms de 100000 presupuestados`,
      )
      expect(r.ticks).toBe(2000)
      expect(r.porFalla).toBe(0)
      // Lo del RELOJ va detrás de `ANIMA_BANCO=1`, y lo de arriba no: `ticks` y
      // `porFalla` son del bucle y no de la máquina, así que se afirman siempre.
      if (!MIDIENDO_EN_SERIO) continue
      // El margen primero: si la máquina estuvo tan cargada que 2000 ticks
      // tardaron más de dos segundos, el cero de abajo no querría decir nada y
      // conviene fallar acá, con el número, y no allá.
      expect(pared, 'la máquina tardó tanto que el cero de `porTiempo` no significaría nada').toBeLessThan(2000)
      expect(r.porTiempo, 'ticksPerdidos dejó de ser cero sobre 2000 ticks').toBe(0)
    }
    log(['══ (d) 2000 TICKS CON RELOJ DE VERDAD ═════════════════════════════════', ...filas])
  })

  it('y el cero se puede mover: el mismo bucle con un reloj que tarda de más lo rompe', () => {
    // El contrapositivo, que es lo que hace que el cero de arriba sea una
    // medición y no una tautología. Mismo bucle, mismos 2000 ticks, un reloj de
    // pared que gasta 60 ms por tick: 400 ticks perdidos.
    const perdidos = conReloj(() => 60, 2000)
    expect(perdidos).toBe(400)
  })
})

// ═══ (e) EL DETERMINISMO DE LA COSTURA CON UN `drive` DE POR MEDIO ═══════════

describe('(e) dos partidas gemelas que FROTAN dan el mismo mundo', () => {
  it('mismo `hashWorldState` paso por paso, con la habilidad en vuelo', () => {
    // Lo mismo que `world/tests/ataque-2-al-fuego.test.ts` hace sobre `stepWorld`
    // pelado, pero por la COSTURA entera: `Partida` → `Contexto` → `SkillRun` →
    // `stepWorld`. Acá se agrega lo que el mundo pelado no tiene: el ejecutor de
    // habilidades, la repetición del `Vuelo` y la vista congelada de por medio.
    // Ninguno de los tres debería poder mover un bit, y hasta el ADR II-0010
    // ninguno había corrido nunca con un `drive` activo.
    const gemela = (): readonly string[] => {
      const p = new Partida(
        mundo({
          bodies: [
            { body: criatura('ella', 1000), at: { x: 0, y: 0 } },
            { body: cuerpo('palo', 'madera', 0.2, { temperature: 15 }), at: { x: 0, y: 0 }, heldBy: 'ella' },
            { body: cuerpo('otro', 'madera-dura', 0.2, { temperature: 15 }), at: { x: 0, y: 0 }, heldBy: 'ella' },
          ],
          actors: [actor('ella', { holding: ['palo', 'otro'] })],
        }),
      )
      p.volar(
        'ella',
        function* (ctx: Ctx): Hab {
          const a = ctx.self.holding.find((x) => x.id === 'palo') as BodyView
          const b = ctx.self.holding.find((x) => x.id === 'otro') as BodyView
          for (;;) yield ctx.apply('friccion', { a, b, actor: ctx.self })
        },
        undefined,
      )
      const hs: string[] = []
      for (let i = 0; i < 80; i++) {
        p.tick()
        hs.push(hashWorldState(p.state))
      }
      return hs
    }
    const a = gemela()
    const b = gemela()
    expect(a).toEqual(b)
    // Control: que la fricción haya pasado de verdad. Ochenta hashes iguales
    // entre sí aprobarían este test con una habilidad que no hace nada.
    expect(new Set(a).size).toBe(80)
    log([
      '══ (e) GEMELAS QUE FROTAN, POR LA COSTURA ═════════════════════════════',
      `  80 ticks · 80 hashes distintos · los mismos 80 en las dos partidas`,
      `  hash final ${a[79] as string}`,
    ])
  })
})
