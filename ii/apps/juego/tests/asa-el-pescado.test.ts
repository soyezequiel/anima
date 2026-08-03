// ─── C3 · «ASÁ EL PESCADO»: LA LIGADURA DIFERIDA, CON EJECUTOR ─────────────
//
// La otra mitad de la identidad, y es de otra especie que «el otro tronco».
// Aquélla señala un cuerpo que ya existe; ésta señala **el rendimiento de un
// nodo hermano**: el pescado que saques recién, que cuando la frase se dice
// TODAVÍA NO EXISTE.
//
// ─── LO QUE ESTABA CORTADO, y estaba medido ────────────────────────────────
//
//   `objetivosDe` ata el nodo ..... `binds: {slot:'comida', from:'g0'}`  ✔
//   el encargo lo guarda .......... `bindeaSlot: 'comida'`               ✔
//   alguien lo ejecuta ............ NADIE
//
// `Mente.#rindes` resuelve `{k:'rinde'}` DENTRO de un plan y se vacía en cada
// plan nuevo, así que una ligadura entre nodos del ENCARGO —que son planes
// distintos, separados por ticks— no tenía dónde vivir.
//
// La reparación no inventa un canal: **reusa el `sobre` de la corrección**. Lo
// que rindió el nodo anterior es el cuerpo que el siguiente señala, y de ahí en
// adelante es el mismo camino que «no ése, el otro».

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import { cargar, enMemoria, guardar } from '@anima/store'

import { Ordenes } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

const QUIEN = 'ana'
const SEMILLA = 20260727n
/** La única frase del corpus con ligadura medida: el par (destino, slot) de `LIGABLES`. */
const CON_LIGADURA = 'pescá algo y después asá el pescado'

interface Sesion {
  readonly p: Partida
  readonly o: Ordenes
}

function nueva(): Sesion {
  const { state } = arrancar(SEMILLA)
  const p = new Partida(state)
  return { p, o: new Ordenes(p, QUIEN, PHYS) }
}

function correr({ p, o }: Sesion, n: number): void {
  for (let k = 0; k < n; k++) {
    o.antesDelTick(p.state.tick)
    vivir(p, o.mentes, 1)
    o.despuesDelTick()
  }
}

/** Corre hasta que el primer nodo quede cumplido, o hasta el tope. */
function hastaQueRindaElPrimero(s: Sesion, tope: number): boolean {
  for (let k = 0; k < tope; k++) {
    correr(s, 1)
    if ((s.o.encargo?.hechos.length ?? 0) > 0) return true
    if (s.o.encargo === undefined) return false
  }
  return false
}

describe('C3 · la ligadura diferida tiene ejecutor', () => {
  it('(1) EL ENCARGO GUARDA LA LIGADURA, que es de donde arranca todo', () => {
    const s = nueva()
    s.o.decir(CON_LIGADURA)
    const e = s.o.encargo
    expect(e?.nodos).toHaveLength(2)
    expect(e?.nodos[1]?.bindeaSlot, 'el segundo nodo no quedó atado al primero').toBe('comida')
  })

  it('(2) AL CUMPLIRSE EL PRIMERO, queda anotado CON QUÉ se cumplió', () => {
    const s = nueva()
    s.o.decir(CON_LIGADURA)
    const rindio = hastaQueRindaElPrimero(s, 400)
    expect(rindio, 'el primer nodo no se cumplió en 400 ticks').toBe(true)

    const hecho = s.o.encargo?.hechos[0]
    expect(hecho?.rindio, 'se anotó QUE se cumplió y no CON QUÉ').toBeDefined()
    // Y es un cuerpo del mundo, no un nombre inventado.
    expect(s.p.state.bodies.has(hecho?.rindio as string)).toBe(true)
  })

  it('(3) Y EL NODO QUE LIGA LO RECIBE: «el pescado» es ÉSE', () => {
    const s = nueva()
    s.o.decir(CON_LIGADURA)
    expect(hastaQueRindaElPrimero(s, 400)).toBe(true)

    const rindio = s.o.encargo?.hechos[0]?.rindio
    // Un tick más para que la escalera tome la meta que sigue.
    correr(s, 1)
    expect(s.o.senaladoDelPendiente(), 'la ligadura no llegó al nodo siguiente').toBe(rindio)
  })

  it('(4) SOBREVIVE LA RECARGA: lo que rindió no se vuelve a buscar', async () => {
    const d = enMemoria()
    const s = nueva()
    s.o.decir(CON_LIGADURA)
    expect(hastaQueRindaElPrimero(s, 400)).toBe(true)
    const antes = s.o.encargo?.hechos[0]?.rindio

    await guardar(d, s.p.state, s.o.memoria, QUIEN, s.o.charla, s.o.encargo)
    const g = await cargar(d, QUIEN)
    const v = g as NonNullable<typeof g>
    const o = new Ordenes(new Partida(v.state), QUIEN, PHYS, {
      charla: v.charla,
      ...(v.encargo === undefined ? {} : { encargo: v.encargo }),
    })
    expect(o.encargo?.hechos[0]?.rindio).toBe(antes)
    expect(o.senaladoDelPendiente()).toBe(antes)
  })

  it('(5) EL CONTROL: sin ligadura no se arrastra nada', () => {
    // «Traé un palo y después hacé fuego» son dos nodos SIN `bindeaSlot` —el par
    // (destino, slot) no está en la tabla medida de `LIGABLES`— así que lo que
    // rindió el primero no tiene por qué señalar al segundo. Arrastrarlo igual
    // sería inventar una ligadura que nadie midió, que es justo lo que
    // `objetivosDe` se niega a hacer.
    const s = nueva()
    s.o.decir('traé un palo y después hacé fuego')
    expect(s.o.encargo?.nodos[1]?.bindeaSlot).toBeUndefined()
    expect(hastaQueRindaElPrimero(s, 200)).toBe(true)
    correr(s, 1)
    expect(s.o.senaladoDelPendiente()).toBeUndefined()
  })
})
