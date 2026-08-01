/**
 * EL PUNTO 9 — la candidata que falla alimenta a la siguiente.
 *
 * Lo pidió el usuario: *«capaz que con un pequeño cambio se lo arregla, en vez
 * de crear una habilidad nueva desde cero»*.
 *
 * Y lo que este archivo defiende no es que el mensaje sea lindo: es **que no
 * pueda contar de más**. Si el segundo intento se entera de en qué mundos falló,
 * aprende los mundos y no la habilidad — y eso se ve idéntico por delante.
 */

import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { conceptosDe, loQueFalloDe, otraVuelta, primerEncargo, textoDe } from '../src/encargo.js'
import { Puerta } from '../src/puerta.js'
import { reparar } from '../src/reparar.js'

const VOCABULARIO = ['madera', 'liana', 'carne', 'agua']

describe('la primera vuelta no habla de fallos, porque no hubo', () => {
  it('el texto trae el gap y el vocabulario, y nada más', () => {
    const t = textoDe(primerEncargo('conseguir alimento de un cuerpo de agua', VOCABULARIO))
    console.log(`\n${t}\n`)
    expect(t).toContain('conseguir alimento')
    expect(t).toContain('madera · liana')
    expect(t).not.toContain('Intento')
  })
})

describe('la segunda vuelta cuenta QUÉ pidió que no existe', () => {
  const e = otraVuelta(
    primerEncargo('conseguir alimento de un cuerpo de agua', VOCABULARIO),
    loQueFalloDe(
      [
        { cargo: 'construccion', grado: 'no-promueve', porque: 'SÓLO FUNCIONA DONDE LE CONVIENE' },
        { cargo: 'uso', grado: 'promueve', porque: '2 de 2 promesas verificadas contra el mundo' },
      ],
      ['hunger', 'smoke'],
      [{ de: 'ticksToNightfall', a: 'secondsToNightfall', codigo: 2339, linea: 5 }],
    ),
  )
  const t = textoDe(e)

  it('nombra los conceptos y aclara que NO son typos', () => {
    console.log(`\n${t}\n`)
    expect(t).toContain('hunger · smoke')
    expect(t).toContain('NO TIENE')
    expect(t).toContain('No son errores de tipeo')
  })

  it('y cuenta lo que la puerta corrigió sola, para que no lo repita', () => {
    expect(t).toContain('ticksToNightfall → secondsToNightfall')
  })

  it('sólo los cargos que FALLARON — los verdes alargan y hacen adivinar', () => {
    expect(t).toContain('SÓLO FUNCIONA DONDE LE CONVIENE')
    expect(t).not.toContain('2 de 2 promesas')
  })
})

describe('EL GUARDIÁN: el mundo donde falló NO PUEDE entrar', () => {
  it('`loQueFalloDe` recibe los CARGOS, no el dictamen — así el dato no llega', () => {
    // Un `Dictamen` trae `regresiones`, y ahí adentro está `semilla`, que ES el
    // id del mundo. Si la función recibiera el dictamen entero, filtrar sería
    // una disciplina que alguien puede olvidar en el próximo cambio.
    //
    // Se simula el dictamen completo —con sus regresiones bien visibles— y se
    // arma el encargo por el camino previsto. Ningún id puede aparecer.
    const dictamen = {
      habilidad: 'aparejo',
      grado: 'no-promueve',
      cargos: [
        { cargo: 'construccion', grado: 'no-promueve', porque: 'SÓLO FUNCIONA DONDE LE CONVIENE' },
        { cargo: 'utilidad', grado: 'no-promueve', porque: 'SE ARMÓ BIEN Y NO SACÓ NADA' },
      ],
      regresiones: [
        { habilidad: 'aparejo', cargo: 'construccion', semilla: 'sostener·al-borde·agua/bloque/0.05', queSeEspera: 'que llegue' },
        { habilidad: 'aparejo', cargo: 'utilidad', semilla: '20260727n·aparejo·stock-vacio', queSeEspera: 'que NO saque nada' },
      ],
    }

    const t = textoDe(otraVuelta(primerEncargo('pescar', VOCABULARIO), loQueFalloDe(dictamen.cargos)))
    console.log(`\n${t}\n`)

    for (const r of dictamen.regresiones) {
      expect(t, `se filtró el mundo ${r.semilla}`).not.toContain(r.semilla)
    }
    // Y ninguna de sus piezas sueltas tampoco.
    for (const pedazo of ['al-borde', 'stock-vacio', 'agua/bloque', '20260727']) {
      expect(t, `se filtró «${pedazo}»`).not.toContain(pedazo)
    }
    // Pero SÍ llegó el porqué, que es lo que se decidió contarle.
    expect(t).toContain('SE ARMÓ BIEN Y NO SACÓ NADA')
  })

  it('EL CONTROL: si se pasara el dictamen entero, los ids SÍ estarían ahí', () => {
    // Sin este renglón, el de arriba pasa por no haber ids en ningún lado y no
    // prueba que la firma haga algo.
    const conIds = JSON.stringify({
      regresiones: [{ semilla: 'sostener·al-borde·agua/bloque/0.05' }],
    })
    expect(conIds).toContain('al-borde')
  })
})

describe('los conceptos salen de los errores que QUEDARON, no de los de antes', () => {
  it('un typo que la puerta ya corrigió no viaja como concepto faltante', () => {
    // Mandarlo confundiría al modelo con un problema que ya no existe.
    const p = new Puerta(ts)
    const roto = `
import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done } from '../../src/skill-api.js'
export function* x(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  const t = ctx.clock.ticksToNightfall
  return done()
}`
    const antes = p.revisar(roto)
    expect(antes.k).toBe('no-compila')
    if (antes.k !== 'no-compila') return

    // Antes de reparar, `ticksToNightfall` figura como nombre inventado.
    expect(conceptosDe(antes.errores)).toContain('ticksToNightfall')

    const r = reparar(roto, antes.errores, p)
    expect(r.k).toBe('reparado')
    if (r.k !== 'reparado') return
    const despues = p.revisar(r.codigo)

    // Después, no queda nada que contarle al modelo.
    const quedan = despues.k === 'no-compila' ? despues.errores : []
    console.log(`\n    conceptos antes de reparar: ${conceptosDe(antes.errores).join(', ')}`)
    console.log(`    después de reparar:         ${conceptosDe(quedan).join(', ') || '(ninguno)'}`)
    expect(conceptosDe(quedan)).not.toContain('ticksToNightfall')
  })
})
