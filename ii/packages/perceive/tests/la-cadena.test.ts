/**
 * LA CADENA — tres innatas encadenadas contra el mundo de verdad.
 *
 * Los cuatro criterios del tramo miden la costura pieza por pieza. Esto mide lo
 * único que importa después: que se puedan ENCADENAR. El primer criterio del
 * Hito 5 es «con hambre y un río a la vista, la criatura deshilacha un matorral,
 * ata una vara, va y pesca», y hasta este tramo **no se podía ni intentar**: no
 * había quien construyera un `Ctx`, ni quien tradujera un evento a `StepResult`,
 * ni quien repitiera un `apply` hasta que el proceso completara.
 *
 * Acá se corren las dos primeras patas —deshilachar y atar— con las innatas tal
 * como el Hito 4 las escribió, sin tocarles una línea, y se verifica lo que la
 * física dice que tiene que salir: un cuerpo con `catch > 0`, que es lo ÚNICO
 * que califica para `extraccion`. Nadie escribe «caña» en ningún lado.
 *
 * La tercera pata —pescar— necesita un stock del oráculo y es de otro frente.
 */

import { describe, expect, it } from 'vitest'
import { qualityOf } from '@anima/physics'
import type { WorldBody } from '@anima/world'
import type { BodyView, Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import { deshilachar, unir } from '@anima/skills/innatas'

import { Partida } from '../src/index.js'
import { conElla, cuerpo } from './mundo.js'

type Hab = Generator<Intent, Outcome, StepResult>

const enElPiso = (id: string, sust: string, masa: number, x: number, y: number): WorldBody => ({
  body: cuerpo(id, sust, masa),
  at: { x, y },
})

describe('deshilachar y atar, encadenadas', () => {
  it('sale un cuerpo con `catch > 0`, y nadie escribió «caña»', () => {
    const p = new Partida(
      conElla(
        [
          enElPiso('matorral', 'liana', 2, 1, 0),
          enElPiso('vara', 'madera', 0.5, 2, 0),
        ],
        { stamina: 900 },
      ),
    )
    let ensamble: BodyView | undefined
    let porQue = ''
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        // 1. la hebra. `deshilachar` va, agarra el matorral y aplica el proceso
        //    hasta que completa — dos segundos de mundo, o sea cuarenta ticks a
        //    20 Hz, que sólo pasan porque el ejecutor REPITE el `apply`.
        const matorral = ctx.see([{ q: 'tensile', op: '>=', v: 0.6 }])[0]
        if (matorral === undefined) return { ok: false, why: 'no hay matorral a la vista' }
        const h = yield* deshilachar(ctx, { fuente: matorral, cuantas: 1 })
        if (!h.ok) {
          porQue = h.why
          return h
        }
        const hebra = h.got
        if (hebra === undefined) return { ok: false, why: 'deshilachar no devolvió la hebra' }

        // 2. la unión. `union` sin el rol `b` deja al atador con una punta
        //    suelta, y esa punta suelta es `freeStrandEnds`, que es lo único que
        //    da `catch`. Con `b` obligatorio, pescar sería imposible.
        const varaVista = ctx.see([{ q: 'rigidity', op: '>=', v: 0.6 }])[0]
        if (varaVista === undefined) return { ok: false, why: 'no hay vara a la vista' }
        const u = yield* unir(ctx, { a: varaVista, binder: hebra })
        if (!u.ok) {
          porQue = u.why
          return u
        }
        ensamble = u.got
        return { ok: true }
      },
      undefined,
    )

    for (let i = 0; i < 400 && !v.terminado; i++) p.tick()

    expect(v.terminado, 'la cadena no terminó en 400 ticks').toBe(true)
    expect(v.outcome?.ok, `${porQue} · fase ${v.run.phase}`).toBe(true)
    expect(ensamble, 'la unión no devolvió el ensamble').toBeDefined()

    const c = p.state.bodies.get(ensamble!.id)
    expect(c, 'el ensamble no está en el mundo').toBeDefined()
    const catchDe = qualityOf(c!.body, 'catch', p.state.phys)
    const reach = qualityOf(c!.body, 'reach', p.state.phys)
    console.log(
      `\n─── LA CADENA ───\n${String(v.ticks)} ticks de mundo · el ensamble se llama «${ensamble!.name}» · catch=${catchDe.toFixed(3)} reach=${reach.toFixed(3)}\n`,
    )
    // `catch > 0` es LA condición del rol `gear` de `extraccion`, junto con
    // `reach >= 2`. Que salga de dos innatas encadenadas y no de una tabla es el
    // punto entero de la arquitectura.
    expect(catchDe).toBeGreaterThan(0)
  })
})
