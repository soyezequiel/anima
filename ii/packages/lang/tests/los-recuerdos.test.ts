/**
 * LOS RECUERDOS Y EL RETRIEVAL — el C2, probado donde vive.
 *
 * Lo que este archivo afirma es el contrato del paquete: que la destilación sea
 * una función del log y nada más, que la procedencia distinga lo que le contaron
 * de lo que vio, y que la recuperación léxica encuentre lo que tiene que
 * encontrar **sin una lista de palabras vacías escrita a mano**.
 *
 * La otra mitad —que todo eso sobreviva una recarga y llegue a la mente— se
 * prueba en `apps/juego/tests/lo-que-te-pedi.test.ts`, con la partida entera.
 */

import { buildSeedPhysics } from '@anima/physics'
import { describe, expect, it } from 'vitest'
import { PUENTE } from '../src/alias.js'
import { consultaDe } from '../src/consulta.js'
import { CanalDeHabla } from '../src/habla.js'
import type { Dicho } from '../src/habla.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { loQuePidio, recuerdosDe, recuperar, TOPE_DE_TURNOS } from '../src/recuerdos.js'

/** Una charla de juguete, escrita a mano para que se vea entera. */
function charla(): readonly Dicho[] {
  const c = new CanalDeHabla()
  c.decir(0, 'entrada', 'hacé fuego', { meta: 'emitsPower>0', confianza: 0.9 })
  c.decir(0, 'acuse', 'dale, voy')
  c.decir(5, 'progreso', 'agarró vara de madera', { sobre: 'vara' })
  c.decir(9, 'progreso', 'agarró vara de madera', { sobre: 'vara' })
  c.decir(12, 'entrada', 'hay un pescado en el río', { confianza: 0.4 })
  c.decir(12, 'acuse', 'no te entendí. ¿qué querés que haga?')
  c.decir(30, 'listo', 'listo')
  return c.todo
}

describe('los recuerdos son una vista del log', () => {
  it('cada línea sale con su clase y su procedencia', () => {
    const rs = recuerdosDe(charla())
    const porClase = new Map(rs.map((r) => [r.clase, r]))

    expect(porClase.get('pedido')?.procedencia).toBe('cuidador')
    expect(porClase.get('pedido')?.meta).toBe('emitsPower>0')
    expect(porClase.get('promesa')?.procedencia).toBe('agente')
    expect(porClase.get('hecho')?.procedencia).toBe('mundo')
    expect(porClase.get('resultado')?.procedencia).toBe('agente')
  })

  it('LA REGLA DE PROMOCIÓN: lo que dice el cuidador no llega a `hecho`', () => {
    // «Hay un pescado en el río» es una afirmación, no un pedido y no una
    // observación. La única fila de la tabla cuya procedencia es el mundo es la
    // que sale de lo que la criatura HIZO.
    const rs = recuerdosDe(charla())
    const dicho = rs.find((r) => r.texto.includes('pescado'))
    expect(dicho?.clase).toBe('dicho')
    expect(dicho?.procedencia).toBe('cuidador')

    const delMundo = rs.filter((r) => r.procedencia === 'mundo')
    expect(delMundo.every((r) => r.clase === 'hecho')).toBe(true)
    // Y el control: NINGUNA línea del cuidador puede terminar con procedencia
    // del mundo, diga lo que diga. Si esto se pusiera rojo, una frase se estaría
    // promoviendo a hecho.
    expect(rs.filter((r) => r.procedencia === 'cuidador').every((r) => r.clase !== 'hecho')).toBe(true)
  })

  it('los repetidos se funden y se cuentan, con todos sus turnos', () => {
    const rs = recuerdosDe(charla())
    const agarro = rs.find((r) => r.clase === 'hecho')
    expect(agarro?.veces).toBe(2)
    expect(agarro?.turnos).toHaveLength(2)
    // Y el tick es el del más nuevo: la vigencia se lee de ahí.
    expect(agarro?.tick).toBe(9)
  })

  it('lo observado vale 1 y lo dicho vale lo que se entendió', () => {
    const rs = recuerdosDe(charla())
    expect(rs.find((r) => r.clase === 'hecho')?.confianza).toBe(1)
    expect(rs.find((r) => r.clase === 'pedido')?.confianza).toBe(0.9)
    expect(rs.find((r) => r.texto.includes('pescado'))?.confianza).toBe(0.4)
  })

  it('el mismo log da los mismos recuerdos: no hay estado en el medio', () => {
    expect(recuerdosDe(charla())).toEqual(recuerdosDe(charla()))
    expect(recuerdosDe([])).toEqual([])
  })
})

describe('«lo que te pedí» es el último pedido, no el más parecido', () => {
  it('devuelve la última `entrada` con meta', () => {
    expect(loQuePidio(charla())?.meta).toBe('emitsPower>0')
  })

  it('y una charla sin pedidos no inventa uno', () => {
    const c = new CanalDeHabla()
    c.decir(0, 'entrada', 'hola')
    c.decir(0, 'acuse', 'no te entendí. ¿qué querés que haga?')
    expect(loQuePidio(c.todo)).toBeUndefined()
  })

  it('con dos pedidos gana el ÚLTIMO', () => {
    const c = new CanalDeHabla()
    c.decir(0, 'entrada', 'hacé fuego', { meta: 'emitsPower>0' })
    c.decir(9, 'entrada', 'traé un palo', { meta: 'holding(tag:fibroso)' })
    expect(loQuePidio(c.todo)?.meta).toBe('holding(tag:fibroso)')
  })
})

describe('el retrieval léxico, sin lista de palabras vacías', () => {
  /** Un log con mucho ruido y un solo turno que habla de fuego. */
  function conRuido(): readonly Dicho[] {
    const c = new CanalDeHabla()
    c.decir(0, 'entrada', 'hacé fuego', { meta: 'emitsPower>0', confianza: 0.9 })
    for (let i = 0; i < 40; i++) {
      c.decir(i, 'entrada', `qué es lo que hay que hacer con esto ${String(i)}`)
      c.decir(i, 'acuse', 'no te entendí. ¿qué querés que haga?')
    }
    return c.todo
  }

  it('ENCUENTRA EL TURNO QUE IMPORTA entre ochenta que no', () => {
    const r = recuperar(conRuido(), { texto: 'hacé fuego' })
    expect(r.turnos[0]?.texto, 'el turno del pedido no salió primero').toBe('hacé fuego')
    expect(r.mirados).toBe(81)
  })

  it('LAS PALABRAS DE RELLENO SE APAGAN SOLAS, y por eso no hay lista', () => {
    // «que» está en casi todas las líneas y «fuego» en una. Si el peso no cayera
    // con la frecuencia, la frase entera empataría con cualquier renglón de
    // ruido y el primero saldría por orden de llegada.
    //
    // Es el reemplazo de la IDF, que usa `Math.log` y está prohibido en `src/`.
    const r = recuperar(conRuido(), { texto: 'que es lo que hay de fuego' })
    expect(r.turnos[0]?.texto).toBe('hacé fuego')
  })

  it('EL TOPE se cumple y se puede auditar', () => {
    const r = recuperar(conRuido(), { texto: 'qué hay que hacer' })
    expect(r.turnos.length).toBeLessThanOrEqual(TOPE_DE_TURNOS)
    expect(r.mirados).toBe(81)
    // Un tope sin `mirados` al lado no se puede leer: tres de tres y tres de
    // ochenta se ven iguales.
    expect(r.mirados).toBeGreaterThan(r.turnos.length)
  })

  it('una entidad señalada pesa aunque la frase no la nombre', () => {
    // Es el caso de «el otro»: la frase no dice «madera» en ningún lado, y el
    // turno que habla de ese cuerpo tiene que poder subir igual.
    const c = new CanalDeHabla()
    c.decir(0, 'entrada', 'hacé fuego', { meta: 'emitsPower>0' })
    c.decir(4, 'progreso', 'agarró vara de madera', { sobre: 'vara' })
    const r = recuperar(c.todo, { texto: 'traé el otro', entidades: ['vara'] })
    expect(r.turnos.some((t) => t.sobre === 'vara')).toBe(true)
  })

  it('sin nada que buscar no devuelve nada, y lo dice', () => {
    const r = recuperar(charla(), { texto: '' })
    expect(r.turnos).toEqual([])
    expect(r.recuerdos).toEqual([])
    expect(r.mirados).toBe(7)
  })

  it('y es determinista: dos veces la misma consulta, el mismo orden', () => {
    const log = conRuido()
    const a = recuperar(log, { texto: 'hacé fuego' })
    const b = recuperar(log, { texto: 'hacé fuego' })
    expect(a.turnos.map((t) => t.turno)).toEqual(b.turnos.map((t) => t.turno))
  })
})

describe('EL MISMO CONTEXTO va a la consulta del modelo', () => {
  it('la ventana viaja adentro de la `Consulta`, no se queda en el lector local', () => {
    // Es el punto del documento que más fácil se incumple sin que nada falle:
    // «no se mantienen contextos incompatibles para `dialogue`,
    // `interpret.command` y la fragua». Si el modelo lee la frase suelta y el
    // lector local la lee con el turno anterior, comparar sus respuestas deja de
    // significar algo — y ésa es la medición del Hito 6.
    const lexico = lexicoDe(buildSeedPhysics(), PUENTE)
    const l = leer('xyzzy plugh', { phys: buildSeedPhysics(), lexico })
    const ventana = charla()
    const c = consultaDe(l, lexico, ['emitsPower>0'], ventana)
    expect(c, 'una frase que nadie entiende tiene que ser consultable').toBeDefined()
    expect(c?.contexto.map((d) => d.turno)).toEqual(ventana.map((d) => d.turno))
  })

  it('y sin pasarla, la consulta sale con el contexto vacío en vez de inventarlo', () => {
    const lexico = lexicoDe(buildSeedPhysics(), PUENTE)
    const l = leer('xyzzy plugh', { phys: buildSeedPhysics(), lexico })
    expect(consultaDe(l, lexico, [])?.contexto).toEqual([])
  })
})
