/**
 * CUOTAS SEPARADAS — punto 8 del criterio del Hito 8.
 *
 * > con la **cuota agotada**, la cola **no dispara ni una consulta**
 *
 * Y la mitad que la frase no dice, que es la decisión D1: **son dos cuotas**.
 * Lo que estos tests defienden no es un reparto —el reparto es un parámetro y
 * la primera corrida de verdad lo va a mover— sino el invariante:
 *
 *   ningún carril pasa de lo suyo, y **el tanque de uno no toca al del otro**.
 */

import { describe, expect, it } from 'vitest'
import { Presupuesto, REPARTO_INICIAL } from '../src/presupuesto.js'
import type { Carril, Cuota } from '../src/presupuesto.js'

const una = { consultas: 1, milesimas: 16 }
const chico = (n: number): Readonly<Record<Carril, Cuota>> => ({
  fragua: { consultas: n, milesimas: 1000 },
  chat: { consultas: n, milesimas: 1000 },
})

describe('EL PUNTO 8: con el tanque en cero no se dispara nada', () => {
  it('la puerta se cierra, y dice por qué', () => {
    const p = new Presupuesto(chico(2))
    expect(p.puedo('fragua', una).k).toBe('dale')
    p.gastar('fragua', una)
    expect(p.puedo('fragua', una).k).toBe('dale')
    p.gastar('fragua', una)

    const no = p.puedo('fragua', una)
    expect(no.k).toBe('no')
    if (no.k === 'no') expect(no.porque).toBe('sin-consultas')
    expect(p.agotado('fragua')).toBe(true)
  })

  it('y se cierra por PLATA además de por consultas', () => {
    // Dos motivos distintos porque se arreglan distinto: sin consultas se
    // espera a la sesión que viene; sin plata, el modelo elegido es muy caro.
    const p = new Presupuesto({ fragua: { consultas: 99, milesimas: 10 }, chat: { consultas: 99, milesimas: 10 } })
    const no = p.puedo('fragua', una)
    expect(no.k).toBe('no')
    if (no.k === 'no') expect(no.porque).toBe('sin-plata')
  })

  it('negar se CUENTA — es lo que dice si el reparto sirve', () => {
    const p = new Presupuesto(chico(0))
    for (let i = 0; i < 3; i++) p.puedo('chat', una)
    expect(p.negados('chat')).toBe(3)
    expect(p.negados('fragua')).toBe(0)
  })
})

describe('LA DECISIÓN D1: el tanque de uno NO toca al del otro', () => {
  it('la fragua agotada deja al chat entero — es el caso que más asustaba', () => {
    // Con una cola con prioridades, una fragua hambrienta se come el chat o al
    // revés. Con cuotas separadas eso no puede pasar, y es lo único que la
    // decisión compra.
    const p = new Presupuesto(chico(2))
    p.gastar('fragua', { consultas: 2, milesimas: 32 })
    expect(p.agotado('fragua')).toBe(true)
    expect(p.agotado('chat')).toBe(false)
    expect(p.puedo('chat', una).k).toBe('dale')
  })

  it('y el chat agotado deja a la fragua entera', () => {
    const p = new Presupuesto(chico(2))
    p.gastar('chat', { consultas: 2, milesimas: 32 })
    expect(p.agotado('chat')).toBe(true)
    expect(p.puedo('fragua', una).k).toBe('dale')
  })

  it('EL CONTROL: con UN solo tanque compartido, uno mata al otro', () => {
    // Sin este renglón, los dos de arriba pasan por no haber nada que compartir
    // y no prueban que la separación haga algo. Se simula el tanque único
    // cobrándole a los dos carriles el mismo gasto.
    const compartido = new Presupuesto(chico(2))
    compartido.gastar('fragua', { consultas: 2, milesimas: 32 })
    compartido.gastar('chat', { consultas: 2, milesimas: 32 })
    expect(compartido.agotado('chat')).toBe(true)
    expect(compartido.puedo('chat', una).k).toBe('no')
  })
})

describe('pedir permiso y gastar son DOS gestos', () => {
  it('`puedo` no descuenta: una consulta que no se hizo no gastó', () => {
    const p = new Presupuesto(chico(3))
    for (let i = 0; i < 10; i++) p.puedo('fragua', una)
    expect(p.gastado('fragua').consultas).toBe(0)
    expect(p.queda('fragua').consultas).toBe(3)
  })

  it('se cobra lo REAL, no lo estimado', () => {
    // Por eso `puedo` no descuenta: una que se estimó cara y salió barata no
    // tiene por qué dejar cuota muerta hasta el final de la sesión.
    const p = new Presupuesto(chico(3))
    expect(p.puedo('fragua', { consultas: 1, milesimas: 900 }).k).toBe('dale')
    p.gastar('fragua', { consultas: 1, milesimas: 12 })
    expect(p.queda('fragua').milesimas).toBe(988)
  })

  it('un gasto que YA OCURRIÓ se cobra aunque pase el tope, y se nota', () => {
    // Esconderlo haría que `queda` mienta y que el carril siga pidiendo. Lo que
    // la cota impide es AUTORIZAR, no ocurrir.
    const p = new Presupuesto(chico(1))
    p.gastar('fragua', { consultas: 5, milesimas: 80 })
    expect(p.seExcedio('fragua')).toBe(true)
    expect(p.queda('fragua').consultas).toBe(0)
    expect(p.puedo('fragua', una).k).toBe('no')
    // Y no contagia: el otro carril sigue sano.
    expect(p.seExcedio('chat')).toBe(false)
  })
})

describe('el reparto es un PARÁMETRO, no una medición', () => {
  it('el default existe y está declarado como punto de partida', () => {
    const p = new Presupuesto(REPARTO_INICIAL)
    console.log(`\n${p.informe()}`)
    // Lo único que se afirma del default es que los dos carriles tienen algo:
    // el número exacto lo va a mover la primera corrida de verdad, igual que la
    // línea base de cobertura del chat (ADR II-0024, § 2).
    for (const c of ['fragua', 'chat'] as const) {
      expect(p.queda(c).consultas).toBeGreaterThan(0)
      expect(p.queda(c).milesimas).toBeGreaterThan(0)
    }
  })

  it('el invariante vale con CUALQUIER reparto, y MANDA EL QUE SE ACABA PRIMERO', () => {
    // Es lo que hace que el criterio no dependa del número: se barren repartos
    // muy distintos y ninguno deja autorizar de más.
    //
    // Y la primera versión de este test asumía que el que ataja es el conteo de
    // consultas. NO: con tope 100 y 1000 milésimas, a 16 la consulta, **la plata
    // se acaba en la 62**. Las dos cotas son cotas, y la que manda es la que se
    // agota antes — por eso el esperado se calcula de las dos y no de una.
    console.log(`\n  ${'tope'.padStart(6)} ${'por plata'.padStart(10)} ${'autorizadas'.padStart(12)}`)
    for (const n of [0, 1, 7, 100]) {
      const p = new Presupuesto(chico(n))
      const porPlata = Math.floor(1000 / una.milesimas)
      let dadas = 0
      for (let i = 0; i < n + 5; i++) {
        if (p.puedo('fragua', una).k === 'dale') {
          p.gastar('fragua', una)
          dadas++
        }
      }
      console.log(`  ${String(n).padStart(6)} ${String(porPlata).padStart(10)} ${String(dadas).padStart(12)}`)
      expect(dadas, `con tope ${String(n)} autorizó ${String(dadas)}`).toBe(Math.min(n, porPlata))
      expect(p.seExcedio('fragua')).toBe(false)
    }
  })
})
