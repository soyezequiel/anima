// ─── QUE UN HUECO SE PUEDA JUZGAR ───────────────────────────────────────────
//
// `contratoDelGap` existe porque el juez pide un contrato y en una partida no hay
// quien lo escriba. Lo que hay que probar no es que devuelva un objeto con los
// campos llenos —eso lo dice el compilador— sino las dos cosas que hacen que
// sirva de algo:
//
//   1. **que el reparto sea el correcto.** Una condición que la materia ya trae
//      es una PRECONDICIÓN; la que falta es la PROMESA. Al revés, el juez
//      ablaciona justo lo que se le está pidiendo a la habilidad y exige que
//      fracase — o sea que el contrato pediría lo contrario del hueco;
//   2. **que el contrato discrimine.** Es la mitad que importa: si una habilidad
//      que no hace nada pasa, la fragua entera se vuelve un generador de código
//      promovido al azar, y eso es peor que no tenerla.
//
// El gap de los tests es el REAL: salió de una partida donde la criatura no pudo
// hacer fuego, y está copiado del reporte que el juego bajó.

import { describe, expect, it } from 'vitest'

import { bancoDe, juzgar } from '@anima/judge'
import { buildSeedPhysics } from '@anima/physics'
import type { QualityTest } from '@anima/physics'
import type { Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import { done } from '@anima/skills'
import { condicionesDelGap, contratoDelGap } from '../src/contrato-del-gap.js'

const phys = buildSeedPhysics()

/** El hueco que la criatura no supo llenar, tal como lo dijo el juego. */
const EL_GAP = 'fuelEnergy>0&heatCapacity<=9&ignitionPoint<=400&moisture<0.45&rigidity>=0.5&tensile>=0.3'

/**
 * LO QUE LA VARA DE MADERA TRAÍA, medido contra el guardado de esa partida.
 *
 * Cinco de seis. La que falla es la humedad: la vara estaba en 0,6000 y el corte
 * de la ley 3 es 0,45. No es un caso inventado para que el test dé lindo — es el
 * estado exacto de lo que la criatura tenía en la mano cuando pidió ayuda.
 */
const COMO_LA_VARA = (t: QualityTest): boolean => t.q !== 'moisture'

describe('el reparto entre lo que se trae y lo que se promete', () => {
  it('LO QUE FALTA VA A `establece` Y LO QUE HAY A `precondiciones`', () => {
    const r = contratoDelGap(EL_GAP, 'secar', COMO_LA_VARA)
    expect(r.k).toBe('contrato')
    if (r.k !== 'contrato') return

    expect(r.contrato.establece.map((p) => p.q)).toEqual(['moisture'])
    expect(r.contrato.precondiciones.map((p) => p.q).sort()).toEqual([
      'fuelEnergy',
      'heatCapacity',
      'ignitionPoint',
      'rigidity',
      'tensile',
    ])
    // El contrato, leído en voz alta: «agarrá algo que arda, rígido y liviano, y
    // devolvémelo seco». Que es el pedido que la criatura no supo cumplir.
    expect(r.contrato.establece[0]).toEqual({ sujeto: 'el-objetivo', q: 'moisture', op: '<', v: 0.45 })
  })

  it('AL REVÉS SERÍA PEDIR LO CONTRARIO, y por eso el reparto no es libre', () => {
    // Si `moisture<0.45` fuera precondición, `bancoDe` armaría el objetivo YA
    // SECO y ablacionaría ese mismo predicado esperando que la habilidad falle.
    // Se comprueba mirando qué materia elige el banco para cada reparto.
    const r = contratoDelGap(EL_GAP, 'secar', COMO_LA_VARA)
    if (r.k !== 'contrato') throw new Error('no salió contrato')
    const conElRepartoBueno = bancoDe(r.contrato, phys)
    const objetivos = conElRepartoBueno.filter((m) => m.objetivo !== undefined)
    expect(objetivos.length, 'el banco no armó ningún objetivo: no hay qué secar').toBeGreaterThan(0)
    // Y ninguno de los cuerpos amables llega ya seco: si llegaran, la habilidad
    // pasaría sin hacer nada.
    const amables = conElRepartoBueno.filter((m) => !m.adverso && m.objetivo !== undefined)
    expect(amables.length, 'no hay un solo mundo amable con objetivo').toBeGreaterThan(0)
  })

  it('las condiciones se leen con el mismo parser que el planificador', () => {
    const { condiciones, noSeLeyeron } = condicionesDelGap(EL_GAP)
    expect(condiciones).toHaveLength(6)
    expect(noSeLeyeron).toEqual([])
  })

  it('y lo que NO es de materia se cuenta en vez de romper', () => {
    // Un gap con una relación adentro no se puede repartir en cuerpos: `bancoDe`
    // construye materia y `holding(...)` no describe materia.
    const { condiciones, noSeLeyeron } = condicionesDelGap('holding(tag:carnoso)&moisture<0.45')
    expect(condiciones.map((c) => c.test.q)).toEqual(['moisture'])
    expect(noSeLeyeron).toEqual(['holding(tag:carnoso)'])
  })
})

describe('los tres huecos que NO dan contrato, y se dicen', () => {
  it('si no falta nada, no había qué forjar', () => {
    const r = contratoDelGap(EL_GAP, 'secar', () => true)
    expect(r).toEqual({ k: 'no', porque: 'no-falta-nada' })
  })

  it('si no se cumple ninguna, no hay de dónde agarrar', () => {
    // Sin precondiciones de `el-objetivo`, `bancoDe` devuelve UN mundo sin
    // objetivo, y ahí `establece` habla de un cuerpo que no existe: el juez
    // contestaría sobre la nada. Mejor no pagar el viaje al modelo.
    const r = contratoDelGap(EL_GAP, 'secar', () => false)
    expect(r).toEqual({ k: 'no', porque: 'no-hay-de-donde-agarrar' })
  })

  it('y un gap que no habla de materia tampoco da contrato', () => {
    const r = contratoDelGap('holding(tag:carnoso)', 'agarrar', () => false)
    expect(r).toEqual({ k: 'no', porque: 'no-es-de-materia' })
  })
})

// ═══ LA MITAD QUE IMPORTA: QUE EL CONTRATO BAJE LO QUE NO SIRVE ════════════
//
// El modo de falla peligroso de todo este tramo no es que el juez rechace algo
// bueno: es que APRUEBE algo que no hace nada. Una fragua que promueve al azar es
// peor que no tener fragua, porque instala en el catálogo de la partida y el
// planificador después elige eso.
//
// La habilidad de acá abajo es el peor caso honesto: compila, corre, y contesta
// que llegó sin haber tocado el mundo. Es exactamente lo que un modelo escribe
// cuando entendió la firma y no el pedido.

/** Dice que sí y no hace nada. `yield` ninguno: no emite un solo intent. */
function* laQueNoHaceNada(_ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  return done()
}

describe('el veredicto sobre una habilidad que no hace el trabajo', () => {
  it('NO LA PROMUEVE, aunque diga que llegó', () => {
    const r = contratoDelGap(EL_GAP, 'secar', COMO_LA_VARA)
    if (r.k !== 'contrato') throw new Error('no salió contrato')

    const d = juzgar(
      {
        acusada: { nombre: 'secar', contrato: r.contrato },
        skill: laQueNoHaceNada as never,
        argsDe: () => ({}) as Record<string, never>,
      },
      phys,
    )

    // El grado, que es lo único que `Ordenes` mira para instalar.
    expect(d.grado, `el juez la promovió: ${d.cargos.map((c) => c.porque).join(' · ')}`).not.toBe('promueve')
    // Y no por no haberla podido correr: eso sería el arnés fallando, no ella.
    expect(d.grado, 'no se la pudo juzgar: el contrato no arma banco').not.toBe('injuzgable')
  })

  it('y el motivo nombra la promesa que no cumplió', () => {
    const r = contratoDelGap(EL_GAP, 'secar', COMO_LA_VARA)
    if (r.k !== 'contrato') throw new Error('no salió contrato')
    const d = juzgar(
      {
        acusada: { nombre: 'secar', contrato: r.contrato },
        skill: laQueNoHaceNada as never,
        argsDe: () => ({}) as Record<string, never>,
      },
      phys,
    )
    // Sin esto, «no promueve» podría ser por cualquier cosa y el aviso que el
    // juego muestra no diría nada útil.
    expect(d.cargos.map((c) => `${c.cargo}:${c.porque}`).join(' | ')).toContain('moisture')
  })
})
