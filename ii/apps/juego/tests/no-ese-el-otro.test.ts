// ─── C3 · «NO ÉSE, EL OTRO»: LA CORRECCIÓN REVISA, NO REEMPLAZA ────────────
//
// El documento lo pide en la sección del encargo durable:
//
//   > Debe admitir correcciones multi-turno sin perder identidad: «no ése, el
//   > otro tronco» revisa la ligadura del nodo pendiente y deja traza; no crea
//   > silenciosamente otro encargo.
//
// ─── LO QUE LA MEDICIÓN ENCONTRÓ ANTES DE ESCRIBIR NADA ────────────────────
//
// Corrida la frase contra el lector, salía esto:
//
//   «no ése, el otro» → ref=demostrativa → resuelve a «ése»
//
// O sea que **la corrección apuntaba a lo que se estaba rechazando**.
// `referenciaDe` devuelve la primera clase distinta de `ninguna` que encuentra
// barriendo la frase, y en «no ÉSE, el OTRO» el demostrativo va primero. El
// arreglo es de precedencia y está en el bloque (1).
//
// ─── Y LO QUE ESTE ARCHIVO NO PRUEBA ───────────────────────────────────────
//
// Que la criatura AGARRE el otro. Para eso la referencia tendría que llegar al
// planificador, y ése es el ejecutor de la ligadura diferida: `Drive.meta` lleva
// una firma de texto y nada más, y `Mente.#rindes` se vacía en cada plan nuevo.
// Lo que acá se prueba es que el pedido queda BIEN ANOTADO — con su identidad,
// su nodo y su traza— que es lo que el documento pide de este tramo.

import { describe, expect, it } from 'vitest'
import { Contexto, Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import { interpretar, plan } from '@anima/plan'
import type { PlanResult } from '@anima/plan'
import { tagsDe } from '@anima/physics'
import { cargar, enMemoria, guardar } from '@anima/store'

import { Ordenes } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

/** A qué cuerpo manda un plan de «tenerlo»: el `ir` del primer paso. */
function destinoDe(r: PlanResult): string | undefined {
  if (r.k !== 'plan') return undefined
  for (const s of r.steps) {
    if (s.k === 'ir' && s.a.k === 'id') return s.a.id
    if (s.k === 'sostener' && s.que.k === 'id') return s.que.id
  }
  return undefined
}

/** ¿Este cuerpo está en el piso y es fibroso? Los dos candidatos salen de acá. */
function cumpleEnElPiso(p: Partida, id: string): boolean {
  const c = p.state.bodies.get(id)
  if (c === undefined || c.heldBy !== undefined) return false
  return tagsDe(c.body, p.state.phys).includes('fibroso')
}

const QUIEN = 'ana'
const SEMILLA = 20260727n
/**
 * Dura lo suficiente para que haya encargo vivo cuando llega la corrección.
 *
 * Medido: «hacé fuego» vive del tick 0 al ~70 y en el medio la criatura levanta
 * cosas del piso, que es lo que llena la memoria de la charla. «Juntá dos palos»
 * NO sirve acá aunque suene mejor: se cumple alrededor del tick 20 —agarra la
 * vara y la hebra que tiene al lado— y para cuando llega la corrección no queda
 * nada que corregir.
 */
const PEDIDO = 'hacé fuego'

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

/** Un pedido en curso con al menos dos cuerpos nombrados en la charla. */
function conDosNombrados(): Sesion {
  const s = nueva()
  s.o.decir(PEDIDO)
  correr(s, 30)
  const nombrados = new Set(s.o.charla.filter((d) => d.sobre !== undefined).map((d) => d.sobre))
  expect(nombrados.size, 'la criatura no nombró dos cuerpos en 30 ticks').toBeGreaterThanOrEqual(2)
  expect(s.o.encargo, 'el encargo ya se cerró: no habría nada que corregir').toBeDefined()
  return s
}

describe('C3 · la corrección multi-turno', () => {
  it('(1) «EL OTRO» LE GANA A «ÉSE» EN LA MISMA FRASE', () => {
    const s = conDosNombrados()
    s.o.decir('el otro')
    const otro = s.o.ultimaLectura?.clausulas[0]?.referencia?.ref

    s.o.decir('no ése, el otro')
    const c = s.o.ultimaLectura?.clausulas[0]
    expect(c?.polaridad, 'la negación no se leyó').toBe('niega')
    // La medición decía `demostrativa`, y con ella la corrección apuntaba a lo
    // que se rechazaba. Manda la más específica: «el otro» sólo aparece cuando
    // alguien está distinguiendo entre dos.
    expect(c?.referencia?.clase).toBe('otra')
    expect(c?.referencia?.ref, 'la corrección sigue apuntando a «ése»').toEqual(otro)
  })

  it('(2) NO CREA UN SEGUNDO ENCARGO: el mismo id, el mismo grafo', () => {
    const s = conDosNombrados()
    const antes = s.o.encargo
    s.o.decir('no ése, el otro')

    expect(s.o.encargo?.id, 'la corrección creó otro encargo').toBe(antes?.id)
    expect(s.o.encargo?.nodos.map((n) => n.meta)).toEqual(antes?.nodos.map((n) => n.meta))
    expect(s.o.encargo?.hechos).toEqual(antes?.hechos)
  })

  it('(3) REVISA EL NODO PENDIENTE, y deja traza de quién lo pidió', () => {
    const s = conDosNombrados()
    s.o.decir('no ése, el otro')
    const e = s.o.encargo
    const revision = e?.revisiones.at(-1)

    expect(revision, 'no quedó traza de la corrección').toBeDefined()
    // La traza dice las tres cosas que hacen falta para poder auditarla: qué
    // nodo, a qué cuerpo pasó a apuntar, y de qué turno del log salió.
    expect(revision?.nodo).toBe(e?.nodos[0]?.id)
    expect(revision?.sobre).toBe(s.o.ultimaLectura?.clausulas[0]?.referencia?.ref?.k === 'id'
      ? s.o.ultimaLectura.clausulas[0].referencia.ref.id
      : undefined)
    expect(s.o.charla.some((d) => d.turno === revision?.turno)).toBe(true)
    // Y el nodo quedó apuntando ahí.
    expect(e?.nodos[0]?.sobre).toBe(revision?.sobre)
  })

  it('(4) Y LA TRAZA SOBREVIVE LA RECARGA', async () => {
    const d = enMemoria()
    const s = conDosNombrados()
    s.o.decir('no ése, el otro')
    const antes = s.o.encargo

    await guardar(d, s.p.state, s.o.memoria, QUIEN, s.o.charla, s.o.encargo)
    const g = await cargar(d, QUIEN)
    const o = new Ordenes(new Partida((g as NonNullable<typeof g>).state), QUIEN, PHYS, {
      charla: (g as NonNullable<typeof g>).charla,
      ...((g as NonNullable<typeof g>).encargo === undefined
        ? {}
        : { encargo: (g as NonNullable<typeof g>).encargo }),
    })
    expect(o.encargo?.revisiones).toEqual(antes?.revisiones)
    expect(o.encargo?.nodos[0]?.sobre).toBe(antes?.nodos[0]?.sobre)
  })

  it('(5) EL CONTROL: una negación que no señala nada no revisa nada', () => {
    // «No hagas fuego» es una prohibición, no una corrección: no dice a qué
    // apuntar. Tiene que seguir sin tocar el encargo — y sin crear uno.
    const s = conDosNombrados()
    const antes = s.o.encargo
    s.o.decir('no hagas fuego')
    expect(s.o.encargo?.revisiones ?? []).toHaveLength(0)
    expect(s.o.encargo?.id).toBe(antes?.id)
  })

  it('(6) Y SIN ENCARGO ABIERTO, una corrección no inventa uno', () => {
    const s = nueva()
    correr(s, 30)
    s.o.decir('no ése, el otro')
    expect(s.o.encargo, 'corregir sin nada que corregir dejó un encargo').toBeUndefined()
  })

  it('(8) LA REFERENCIA LLEGA AL PLAN: la criatura va a buscar EL SEÑALADO', () => {
    // ─── EL ESLABÓN QUE FALTABA, y es el que cierra el C3 ──────────────────
    //
    // Hasta acá el `sobre` se guardaba y no lo leía nadie: `Drive.meta` es una
    // firma EXISTENCIAL —«algo fibroso»— así que «traé el otro tronco» y «traé un
    // tronco» llegaban al planificador idénticos, y ganaba el más cercano.
    //
    // El control es un GEMELO sin corrección: sin él, «terminó con el señalado en
    // la mano» podría ser que iba a agarrar ése de todos modos.
    // Se prueba contra `plan()` con la vista de la partida de verdad, y no
    // corriendo ticks, por lo que la corrida de arriba destapó: **la charla sólo
    // sabe nombrar lo que la criatura AGARRÓ** —la memoria se deriva de las
    // líneas de progreso— así que «el otro» nunca apunta a algo del piso, que es
    // justo lo que un cuidador señalaría. Ese hueco está dicho abajo del test.
    //
    // Lo que acá se afirma es el eslabón: con el mismo mundo y la misma meta, un
    // objetivo que señala un cuerpo planifica IR A ÉSE, y sin señalar planifica ir
    // al que gana por cercanía. Los dos con la misma llamada.
    const s = nueva()
    const v = new Contexto(s.p.proyeccion, {
      actor: QUIEN,
      rng: s.p.dado.tirar,
      lugares: s.p.lugares,
    }).ctx
    const meta = interpretar('holding(tag:fibroso)')
    expect(meta).toBeDefined()

    const sinSenalar = plan({ id: 'm', goal: meta as never, after: [], porque: 'el test' }, v, 200)
    expect(sinSenalar.k).toBe('plan')
    const elQueGana = destinoDe(sinSenalar)
    expect(elQueGana, 'el plan sin señalar no eligió ningún cuerpo').toBeDefined()

    // Otro que también cumple: el que NO ganó por cercanía.
    const otro = [...s.p.state.bodies.values()]
      .map((b) => b.body.id)
      .find((id) => id !== elQueGana && cumpleEnElPiso(s.p, id))
    expect(otro, 'la escena no tiene un segundo candidato').toBeDefined()

    const senalando = plan(
      { id: 'm', goal: meta as never, after: [], sobre: otro, porque: 'el test' },
      v,
      200,
    )
    expect(senalando.k).toBe('plan')
    expect(destinoDe(senalando), 'el plan ignoró el cuerpo señalado').toBe(otro)
  })

  /**
   * EL HUECO QUE DESTAPÓ EL BLOQUE (8), medido y sin disimular.
   *
   * La memoria de la charla se deriva del log, y las únicas líneas del log que
   * traen un cuerpo son los `progreso` de **lo que la criatura agarró**. O sea
   * que «el otro» sólo puede apuntar a algo que ella ya tuvo en la mano — y un
   * cuidador que dice «no ése, el otro tronco» está señalando uno del PISO.
   *
   * Medido en la corrida: a los 20 ticks los dos cuerpos nombrados eran los dos
   * que había levantado, y uno de ellos ya lo había consumido `unir`. La cadena
   * hasta el planificador funciona —bloque (8)— y lo que falta es que la
   * conversación pueda nombrar lo que se VE.
   *
   * No se arregla acá: lo que la criatura ve entra por la percepción, y meterlo
   * en el log sería escribir una línea de progreso por cada cosa que pasa a la
   * vista. Pide su propia decisión sobre qué se nombra y cuándo.
   */
  it('(9) LA CHARLA NOMBRA A DÓNDE VA, y por eso «el otro» tiene a qué apuntar', () => {
    const s = conDosNombrados()
    const destinos = s.o.charla.filter((d) => d.texto.startsWith('va por') && d.sobre !== undefined)
    expect(destinos.length, 'la charla sigue nombrando sólo lo que agarró').toBeGreaterThan(0)

    // Y no se repite cada tick: una línea por DESTINO, no una por tick de
    // camino. Sin esto, ir a buscar algo a diez celdas llenaría el log de diez
    // líneas idénticas y la ventana reciente no serviría para nada.
    const ids = destinos.map((d) => d.sobre)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('(7) la corrección se contesta como corrección, no con «no te entendí»', () => {
    const s = conDosNombrados()
    s.o.decir('no ése, el otro')
    const ultimo = s.o.charla.at(-1)
    expect(ultimo?.clase).toBe('acuse')
    expect(ultimo?.texto).not.toContain('no te entendí')
  })
})
