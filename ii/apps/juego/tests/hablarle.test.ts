// ─── HABLARLE Y QUE PASE ALGO ───────────────────────────────────────────────
//
// Los puntos 4, 5 y 6 de la vertical, probados donde se pueden probar: el acuse
// es una función pura de la frase, y «hace caso» es una propiedad del mundo
// después de N ticks. Ninguna de las dos necesita un navegador.
//
// Lo que este archivo NO prueba: que se vea. Eso es Playwright y va aparte.
//
// ─── EL CONTROL NEGATIVO, Y CÓMO SE ESCRIBIÓ MAL LA PRIMERA VEZ ────────────
//
// «la criatura hizo algo después de una orden» no vale nada sin su contraparte.
// La primera versión afirmaba **sin orden no hace nada**, y se puso roja: con la
// mente conectada y sin ninguna orden, la criatura caminó nueve celdas y levantó
// tres cosas del piso en doscientos ticks.
//
// No era un bug: es el diseño. La `Mente` persigue sus propias necesidades, y el
// `drive` del cuidador compite con ellas en vez de reemplazarlas. Lo que no hacía
// nada era el bucle de ANTES, el que llamaba `partida.tick()` sin que nadie
// pensara — y ése es el control negativo honesto, el de abajo.
//
// La obediencia, entonces, no se mide por «se movió»: se mide por si la meta que
// persigue es la que le dijeron.

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'

import { Ordenes, enCastellano } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

const QUIEN = 'ana'

function partidaNueva(): { p: Partida; o: Ordenes } {
  const { state } = arrancar(20260727n)
  const p = new Partida(state)
  return { p, o: new Ordenes(p, QUIEN, PHYS) }
}

function correr(p: Partida, o: Ordenes, n: number): void {
  for (let k = 0; k < n; k++) {
    o.antesDelTick(p.state.tick)
    vivir(p, o.mentes, 1)
  }
}

/** Dónde está y qué agarró. Es lo observable de «hizo algo». */
function huella(p: Partida): string {
  const c = p.state.bodies.get(`${QUIEN}-cuerpo`)
  const a = p.state.actors.get(QUIEN)
  return `${String(c?.at.x)},${String(c?.at.y)}|${[...(a?.holding ?? [])].sort().join(',')}`
}

describe('hablarle a la criatura desde el juego', () => {
  it('EL ACUSE SALE EN LA MISMA LLAMADA, sin correr un solo tick', () => {
    const { o } = partidaNueva()
    o.decir('hacé fuego')

    // Dos líneas: lo que dijo el jugador y lo que contestó ella. Y la segunda
    // existe ANTES de que el mundo avance, que es lo que pide el criterio.
    expect(o.registro.length).toBe(2)
    expect(o.registro[0]).toEqual({ de: 'vos', texto: 'hacé fuego' })
    expect(o.registro[1]?.texto).toBe('dale, voy')
    expect(o.registro[1]?.de).toBe('ella')
    expect(o.registro[1]?.texto.length).toBeGreaterThan(0)
  })

  it('EL CONTROL NEGATIVO: sin mente, el mundo avanza y la criatura no hace nada', () => {
    // Es el bucle que tenía la app hasta este cambio: `tick()` pelado, sin que
    // nadie piense. Doscientos ticks y la criatura sigue exactamente donde estaba.
    const { p } = partidaNueva()
    const antes = huella(p)
    for (let k = 0; k < 200; k++) p.tick()
    expect(huella(p)).toBe(antes)
  })

  it('CON MENTE Y SIN ORDEN ya hace cosas: el drive compite, no reemplaza', () => {
    const { p, o } = partidaNueva()
    const antes = huella(p)
    correr(p, o, 200)

    // Camina y levanta cosas por su cuenta, persiguiendo sus necesidades. Hay
    // meta en curso, y es SUYA: eso es lo que distingue vivir de obedecer.
    expect(huella(p)).not.toBe(antes)
    expect(o.enCurso?.de).toBe('ella')
  })

  it('CON UNA ORDEN persigue LA META QUE LE DIJERON, y eso es la obediencia', () => {
    const { p, o } = partidaNueva()
    o.decir('hacé fuego')
    correr(p, o, 40)

    // No alcanza con que se mueva —se movía igual—: lo que cambia es que la meta
    // que la escalera persigue es TUYA y no suya.
    expect(o.enCurso?.de, 'la orden no llegó a la mente').toBe('vos')
    expect(o.enCurso?.total).toBeGreaterThan(0)
  })

  it('una frase que no se entiende NO cancela lo que estaba haciendo', () => {
    const { p, o } = partidaNueva()
    o.decir('hacé fuego')
    correr(p, o, 20)
    const perseguía = o.enCurso?.meta

    o.decir('xyzzy plugh')
    // Contesta —el acuse siempre sale— pero la meta sigue siendo la de antes.
    expect(o.registro.at(-1)?.de).toBe('ella')
    correr(p, o, 5)
    expect(o.enCurso?.meta).toBe(perseguía)
  })

  it('«TRAÉ UN PALO» YA TIENE CAMINO, y este test decía lo contrario', () => {
    // ─── EL DÍA QUE ESTE TEST PIDIÓ QUE LO VINIERAN A CAMBIAR ──────────────
    //
    // Decía: «"traé un palo" se lee perfecto y sale como `holding(tag:fibroso)`,
    // pero ningún esquema de @anima/plan establece esa firma, así que la escalera
    // no tiene por dónde empezar». Y cerraba pidiendo que el día que alguien
    // escribiera lo que faltaba, se viniera a borrarlo. Es hoy.
    //
    // Lo que faltaba no era un esquema: era la vía más corta a «tenerlo» —caminar
    // hasta algo que ya lo cumple y agarrarlo—, que no es proceso, ni ley, ni
    // obra, y por eso vive como caso base de la regresión. Ver `agarrarLoQueYaHay`
    // en `plan/src/regresion.ts`.
    //
    // Y el acuse tuvo que aprenderlo aparte: preguntaba si algún ESQUEMA
    // establecía la firma, así que decía «no sé cómo» sobre algo que el
    // planificador ya sabía hacer. Ver `esUnTenerlo` en `src/ordenes.ts`.
    const { o } = partidaNueva()
    o.decir('traé un palo')
    expect(o.registro[1]?.texto).toBe('dale, voy')
  })

  it('el puente traduce la firma a una palabra, y lo que no nombra se ve crudo', () => {
    // Que una firma cruda llegue a la pantalla no es un bug: es la señal de que a
    // esa meta le falta una palabra humana en `alias.ts`.
    expect(enCastellano('emitsPower>0')).not.toBe('emitsPower>0')
    expect(enCastellano('unaFirmaQueNadieNombra>0')).toBe('unaFirmaQueNadieNombra>0')
  })

  it('el mundo del juego sigue siendo determinista con la mente adentro', () => {
    // Dos partidas gemelas, las mismas órdenes, el mismo resultado. Sin esto, el
    // chat habría metido una fuente de azar en el camino del mundo.
    const uno = partidaNueva()
    const dos = partidaNueva()
    for (const c of [uno, dos]) {
      c.o.decir('hacé fuego')
      correr(c.p, c.o, 120)
    }
    expect(huella(uno.p)).toBe(huella(dos.p))
    expect(uno.o.registro.map((d) => d.texto)).toEqual(dos.o.registro.map((d) => d.texto))
  })
})
