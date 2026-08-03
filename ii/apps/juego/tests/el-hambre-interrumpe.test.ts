// ─── C5 · LA ORDEN SE PAUSA CUANDO A LA CRIATURA LE PASA ALGO PEOR ─────────
//
// ─── LA MEDICIÓN QUE ORDENA TODO ESTO, hecha antes de escribir una línea ────
//
// Se le pidió «juntá dos troncos y hacé fuego», y en el tick 8 —con el encargo
// a mitad de camino— se le puso el hambre en 0,92 y un pescado A LOS PIES.
// Esto es lo que hizo, tick por tick:
//
//     t8  meta=emitsPower>0 por=D2 vuela=ir
//     t15 meta=emitsPower>0 por=D2 vuela=sostener
//     t18 meta=emitsPower>0 por=D2 vuela=frotar
//     … y 382 ticks más frotando dos palos, con el pescado ahí.
//
// **La orden del cuidador no se interrumpe nunca.** Y no es un olvido: son dos
// cosas, las dos escritas a propósito y ninguna pensada para esto.
//
//   1. **`Ordenes` mandaba `peso: 1`.** `Drive.peso` está documentado como
//      «cuánto vale contra lo que la criatura elegiría sola, en [0,1]», así que
//      1 quiere decir literalmente «lo que te pido vale más que cualquier cosa
//      que te pase». Eso no es obediencia, es sordera;
//   2. **D1 devuelve `seguir` mientras haya algo volando.** Es la regla que
//      evita que la criatura tiemble entre dos ideas, y funciona: mientras
//      `frotar` esté en vuelo, la escalera ni siquiera baja a D3, que es el
//      peldaño donde el hambre podría ganar. El único que puede cortar algo en
//      vuelo es D0, y D0 es sólo para lo que quema.
//
// ─── DÓNDE VA LA REPARACIÓN, y por qué no adentro de la mente ───────────────
//
// El scheduler del documento vive AFUERA, en `Ordenes`, por la misma razón por
// la que el encargo vive afuera desde el C3: la mente recibe UNA meta y no un
// grafo, y quien sabe que hay un encargo con partes es el de afuera. La pausa se
// decide en la frontera del tick —el mismo lugar donde el C4 aplica lo que llegó
// del proveedor— y se ejecuta con la operación que este archivo ya hacía en cada
// orden nueva: soltar el drive y reconstruir la mente.
//
// ─── EL NÚMERO, dicho sin maquillaje ───────────────────────────────────────
//
// La orden pesa 0,8 y la pausa dispara cuando una necesidad le gana. Las dos
// puntas del rango explican el lugar: la escalera sólo toma una orden si el peso
// pasa de 0,5, y una necesidad llega a 0,8 con el tanque en 106 de 1000 — o sea
// hambre de morirse. Lo que este número dice es «te hago caso salvo que me esté
// muriendo», y se mueve el día que alguien lo juegue y le parezca otra cosa.

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'

import { Ordenes } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

const QUIEN = 'ana'
const SEMILLA = 20260727n
const PEDIDO = 'juntá dos troncos y hacé fuego'

interface Sesion {
  readonly p: Partida
  readonly o: Ordenes
}

function nueva(): Sesion {
  const { state } = arrancar(SEMILLA)
  const p = new Partida(state)
  return { p, o: new Ordenes(p, QUIEN, PHYS) }
}

/** El tanque de aliento, que es de dónde sale la necesidad de energía. */
function aliento(p: Partida, cuanto: number): void {
  const c = p.state.bodies.get('ana-cuerpo')
  if (c === undefined) throw new Error('no está el cuerpo de la criatura')
  c.body = { ...c.body, state: { ...c.body.state, stamina: cuanto } }
}

/** Un pescado a los pies, para que el hambre tenga adónde ir. */
function ponerComida(p: Partida, q: Record<string, number> = {}): void {
  const donde = p.state.bodies.get('ana-cuerpo')?.at
  if (donde === undefined) return
  p.state.bodies.set('pescadito', {
    body: { id: 'pescadito', form: 'bloque', parts: [{ substance: 'pescado', mass: 0.4, q }], joints: [], state: {} },
    at: { x: donde.x, y: donde.y },
  })
}

function correr(s: Sesion, n: number): void {
  for (let k = 0; k < n; k++) {
    s.o.antesDelTick(s.p.state.tick)
    vivir(s.p, s.o.mentes, 1)
    s.o.despuesDelTick()
  }
}

/** La escena del criterio: encargo andando, y de golpe el hambre encima. */
function conHambreAMitadDeCamino(q: Record<string, number> = {}): Sesion {
  const s = nueva()
  s.o.decir(PEDIDO)
  correr(s, 8)
  aliento(s.p, 60)
  ponerComida(s.p, q)
  return s
}

describe('C5 · el hambre urgente pausa el encargo', () => {
  it('(1) LA ORDEN SE PAUSA, que es lo que 400 ticks de frotar decían que no pasaba', () => {
    const s = conHambreAMitadDeCamino()
    expect(s.o.encargo?.estado, 'el encargo seguía activo con el hambre encima').toBe('activo')
    correr(s, 2)
    expect(s.o.encargo?.estado).toBe('pausado')
  })

  it('(2) Y SE DICE, con el motivo — una pausa callada es una criatura que te ignora', () => {
    const s = conHambreAMitadDeCamino()
    correr(s, 2)
    const avisos = s.o.charla.filter((d) => d.clase === 'aviso')
    expect(avisos.length, 'no avisó nada').toBeGreaterThan(0)
    expect(avisos.at(-1)?.texto).toContain('hambre')
  })

  it('(3) MIENTRAS ESTÁ PAUSADO la mente deja de perseguir la orden', () => {
    // El observable de que la pausa es de verdad y no un rótulo: la meta que la
    // criatura tiene puesta deja de ser la del encargo.
    const s = conHambreAMitadDeCamino()
    correr(s, 2)
    expect(s.o.metaEnCurso).toBeUndefined()
    expect(s.o.enCurso?.de).not.toBe('vos')
  })

  it('(3b) Y NO ES UN RÓTULO: la escalera cambió de meta', () => {
    // El bloque de arriba mide `Ordenes.metaEnCurso`, que es la contabilidad de
    // quien pausa. Éste le pregunta a la ESCALERA, que es la que decide de
    // verdad — un instrumento que vive adentro del sistema que mide no lo puede
    // desmentir. Ver el bloque gemelo en `para-y-segui.test.ts`.
    //
    // Y NO ES REDUNDANTE: sacándole a `#soltarElDrive` la reconstrucción de la
    // mente —la pausa se vuelve un rótulo— el bloque (3) sigue VERDE y éste se
    // pone rojo. `#ultimaPuesta` se anula igual; lo que cambia es la conducta.
    const s = conHambreAMitadDeCamino()
    const antes = s.o.mentes.get(QUIEN)?.estado.metaEnCurso
    expect(antes, 'la precondición: la mente no perseguía nada').toBeDefined()
    correr(s, 4)
    expect(s.o.encargo?.estado).toBe('pausado')
    expect(s.o.mentes.get(QUIEN)?.estado.metaEnCurso, 'la escalera sigue con la orden puesta').not.toBe(antes)
  })

  it('(4) CUANDO SE LE PASA, retoma sola y NO repite lo que ya estaba hecho', () => {
    const s = conHambreAMitadDeCamino()
    correr(s, 2)
    const hechosAlPausar = s.o.encargo?.hechos.length ?? 0
    expect(hechosAlPausar, 'la escena no probó nada antes de pausar').toBeGreaterThan(0)
    // Se le llena el tanque, que es lo que haría comer.
    aliento(s.p, 1000)
    correr(s, 12)
    expect(s.o.encargo?.estado).toBe('activo')
    expect(s.o.encargo?.hechos.length, 'volvió a hacer lo que ya estaba hecho').toBe(hechosAlPausar)
    expect(s.o.metaEnCurso, 'no retomó ninguna meta del encargo').toBeDefined()
  })

  it('(5) LAS DOS TRANSICIONES QUEDAN GUARDADAS, con su porqué y su tick', () => {
    const s = conHambreAMitadDeCamino()
    correr(s, 2)
    aliento(s.p, 1000)
    correr(s, 12)
    const t = s.o.encargo?.transiciones ?? []
    expect(t.length, 'no se anotó ninguna transición').toBe(2)
    expect(t[0]?.a).toBe('pausado')
    expect(t[0]?.porque).toContain('hambre')
    expect(t[1]?.a).toBe('activo')
    expect(t[1]?.enTick, 'las dos transiciones cayeron en el mismo tick').toBeGreaterThan(t[0]?.enTick ?? 0)
  })

  it('(6) Y SOBREVIVEN LA RECARGA: se vuelve pausado y se retoma igual', () => {
    const s = conHambreAMitadDeCamino()
    correr(s, 2)
    const guardado = s.o.encargo
    expect(guardado?.estado).toBe('pausado')

    // La recarga: otra sesión, mismo mundo, con lo que se había guardado.
    const p2 = new Partida(s.p.state)
    const o2 = new Ordenes(p2, QUIEN, PHYS, { encargo: guardado, charla: s.o.charla })
    expect(o2.encargo?.estado).toBe('pausado')
    expect(o2.encargo?.transiciones.length).toBe(1)
    aliento(p2, 1000)
    for (let k = 0; k < 12; k++) {
      o2.antesDelTick(p2.state.tick)
      vivir(p2, o2.mentes, 1)
      o2.despuesDelTick()
    }
    expect(o2.encargo?.estado).toBe('activo')
    expect(o2.encargo?.hechos.length).toBe(guardado?.hechos.length)
  })

  it('(7) Y MIENTRAS TANTO COME, que es para lo que se pausó', () => {
    // El criterio dice «anuncia la pausa, COME, retoma». Sin este bloque, pausar
    // sería soltar el pedido y quedarse mirando el horizonte — que desde afuera
    // se ve igual de bien y es exactamente lo contrario de lo que se quería.
    //
    // El pescado va sin veneno (`toxicity: 0`) a propósito: crudo tiene 0,1 y la
    // criatura no lo traga con el tanque en 60, y con razón. Eso es la ley de
    // cocción haciendo su trabajo y no tiene nada que ver con la pausa; forzarlo
    // acá es lo que deja que este bloque mida UNA cosa.
    const s = conHambreAMitadDeCamino({ toxicity: 0 })
    correr(s, 40)
    expect(s.o.encargo?.estado).toBe('pausado')
    expect(s.p.state.bodies.has('pescadito'), 'no lo tocó en 40 ticks').toBe(false)
  })

  it('(8) EL CONTROL: sin hambre no se pausa nunca', () => {
    // Sin este bloque, «se pausa» y «se pausa siempre» se ven igual desde afuera.
    const s = nueva()
    s.o.decir(PEDIDO)
    correr(s, 40)
    const t = s.o.encargo?.transiciones ?? []
    expect(t.length, 'pausó sin que le pasara nada').toBe(0)
  })
})
