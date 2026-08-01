/**
 * EL CONTADOR QUE NO FRENA — Hito 8, tramo A.
 *
 * **Por defecto no hay límite.** Lo decidió el usuario: la criatura aprende todo
 * lo que quiera. El primer bloque de abajo es el que afirma eso, y va primero
 * porque es lo que el juego usa.
 *
 * Los otros bloques prueban el techo, que **existe apagado** y sólo lo enciende
 * quien corre el test de CI: el criterio pide que «el episodio completo no supere
 * N consultas», y eso ataja que un cambio lleve un episodio de 8 llamadas a 400
 * sin que nadie lo note hasta la factura.
 *
 * Y siguen siendo DOS carriles aunque ya no compitan: «gastamos 3000 milésimas»
 * no dice nada y «la fragua gastó 2800 y el chat 200» sí.
 */

import { describe, expect, it } from 'vitest'
import { Presupuesto, sinLimite, SIN_LIMITE, TECHO_DE_CI } from '../src/presupuesto.js'
import type { Carril, Cuota } from '../src/presupuesto.js'

const una = { consultas: 1, milesimas: 16 }
const chico = (n: number): Readonly<Record<Carril, Cuota>> => ({
  fragua: { consultas: n, milesimas: 1000 },
  chat: { consultas: n, milesimas: 1000 },
})

describe('POR DEFECTO NO FRENA NADA — es lo que usa el juego', () => {
  it('mil consultas seguidas y ninguna se niega', () => {
    const p = sinLimite()
    for (let i = 0; i < 1000; i++) {
      expect(p.puedo('fragua', una).k).toBe('dale')
      p.gastar('fragua', una)
    }
    expect(p.negados('fragua')).toBe(0)
    expect(p.agotado('fragua')).toBe(false)
    expect(p.seExcedio('fragua')).toBe(false)
  })

  it('pero CUENTA, que es lo único que se conservó del límite', () => {
    // Sin esto no habría forma de saber qué salió un episodio, y el plan avisa:
    // «si no se diseña temprano, la factura decide la arquitectura por vos».
    const p = sinLimite()
    p.gastar('fragua', { consultas: 8, milesimas: 640 })
    p.gastar('chat', { consultas: 3, milesimas: 48 })
    console.log(`
${p.informe()}`)
    expect(p.gastado('fragua').consultas).toBe(8)
    expect(p.gastado('chat').milesimas).toBe(48)
  })

  it('y el camino sin límite NO es una rama aparte', () => {
    // `Infinity` y no `undefined`: la aritmética es la misma con techo y sin
    // techo, así que el camino que usa el juego es el mismo que prueba CI.
    expect(SIN_LIMITE.fragua.consultas).toBe(Infinity)
    expect(sinLimite().queda('chat').milesimas).toBe(Infinity)
  })
})

describe('EL TECHO, que existe APAGADO y lo enciende CI', () => {
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

describe('CON techo, los dos carriles son INDEPENDIENTES', () => {
  it('la fragua agotada deja al chat entero', () => {
    // Sólo aplica cuando alguien enciende el techo — el juego corre sin él. Vale
    // igual porque es el modo en que CI corre: un techo por carril no puede
    // hacer que el guardián de la fragua apague al del chat.
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

describe('el techo es un PARÁMETRO, no una medición', () => {
  it('el techo de CI existe y está declarado como puesto a dedo', () => {
    const p = new Presupuesto(TECHO_DE_CI)
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
