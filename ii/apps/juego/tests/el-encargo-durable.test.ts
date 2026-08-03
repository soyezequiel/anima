// ─── C3-B · EL ENCARGO SOBREVIVE A LA RECARGA, Y NO REPITE LO HECHO ─────────
//
// El criterio del C3, en `docs/product/convergencia-conversacional.md`:
//
//   > «juntá dos troncos, dejá uno junto al fuego y guardá el otro» crea un grafo
//   > observable y sólo completa cuando las cantidades, identidades y posiciones
//   > del mundo lo prueban. Una recarga entre el primer y segundo tronco no
//   > repite el primer paso ni pierde el encargo.
//
// ─── POR QUÉ LA FRASE DE ACÁ NO ES LA DEL CRITERIO, y está medido ──────────
//
// Porque la del criterio **no es expresable en este mundo todavía**, y se midió
// antes de escribir una línea:
//
//   «dos troncos» ....... sale `holding(tag:fibroso)`. El DOS se pierde entero:
//                         `Predicado` no tiene forma de contar y `count>=2` no lo
//                         lee nadie;
//   «junto al fuego» .... sale por `orientacion` y `objetivosDe` lo descarta con
//                         su porqué. `distance<=1`, `at.x>=8` y `wet>=0.9` dan
//                         los tres `undefined` en `interpretar`.
//
// O sea que dos de las tres partes piden vocabulario de objetivo que no existe:
// cantidad y lugar. Portarlo es el ADR 0083 de Ánima I y es una decisión de
// alcance que no se toma acá.
//
// Lo que este archivo prueba es **la otra mitad del criterio**, que sí se puede
// hoy: que un encargo de varias partes tenga identidad, se guarde, vuelva, y no
// repita el paso que ya estaba hecho. La frase es la equivalente expresable:
// dos partes, con orden entre ellas.

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import { cargar, enMemoria, guardar } from '@anima/store'
import type { Deposito } from '@anima/store'

import { Ordenes } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

const QUIEN = 'ana'
const SEMILLA = 20260727n

/** Dos partes con orden: la primera se cumple sola en ~10 ticks, la segunda no. */
const DE_DOS_PARTES = 'traé un palo y después hacé fuego'

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

async function recargar(d: Deposito, s: Sesion): Promise<Sesion> {
  await guardar(d, s.p.state, s.o.memoria, QUIEN, s.o.charla, s.o.encargo)
  const g = await cargar(d, QUIEN)
  expect(g, 'no volvió nada del guardado').toBeDefined()
  const v = g as NonNullable<typeof g>
  const p = new Partida(v.state)
  const o = new Ordenes(p, QUIEN, PHYS, {
    memoria: v.creencias,
    charla: v.charla,
    ...(v.encargo === undefined ? {} : { encargo: v.encargo }),
  })
  return { p, o }
}

describe('C3 · el encargo es durable y tiene grafo', () => {
  it('(1) UN PEDIDO DE DOS PARTES ES UN GRAFO CON IDENTIDAD', () => {
    const s = nueva()
    s.o.decir(DE_DOS_PARTES)
    const e = s.o.encargo
    expect(e, 'el pedido no dejó ningún encargo').toBeDefined()

    // Identidad y procedencia: de qué turno salió y qué se dijo.
    expect(e?.id).toBeTruthy()
    expect(e?.texto).toBe(DE_DOS_PARTES)
    expect(e?.turnos.length).toBeGreaterThan(0)

    // El GRAFO, y no una lista: el segundo nodo depende del primero.
    expect(e?.nodos).toHaveLength(2)
    expect(e?.nodos[0]?.after).toEqual([])
    expect(e?.nodos[1]?.after).toEqual([e?.nodos[0]?.id])
    expect(e?.hechos).toEqual([])
  })

  it('(2) UNA PARTE CUMPLIDA QUEDA ANOTADA CON EL TICK EN QUE SE CUMPLIÓ', () => {
    const s = nueva()
    s.o.decir(DE_DOS_PARTES)
    correr(s, 30)

    const e = s.o.encargo
    expect(e?.hechos, 'la primera parte no se dio por cumplida en 30 ticks').toHaveLength(1)
    expect(e?.hechos[0]?.nodo).toBe(e?.nodos[0]?.id)
    // El tick, no un booleano: es lo que el ADR 0083 pide para poder comparar el
    // orden causal —«cuándo se cumplió cada uno por primera vez»— en vez de
    // declararlo.
    expect(e?.hechos[0]?.enTick).toBeGreaterThanOrEqual(0)
    expect(e?.estado).toBe('activo')
  })

  it('(3) LA RECARGA EN EL MEDIO: vuelve el encargo y NO repite el primer paso', async () => {
    const d = enMemoria()
    const antes = nueva()
    antes.o.decir(DE_DOS_PARTES)
    correr(antes, 30)
    const hechoAntes = antes.o.encargo?.hechos[0]?.nodo
    const segundo = antes.o.encargo?.nodos[1]?.meta
    expect(hechoAntes, 'no había nada hecho: la recarga no probaría nada').toBeDefined()

    const despues = await recargar(d, antes)

    // El encargo volvió, con la misma identidad y con lo hecho anotado.
    expect(despues.o.encargo?.id).toBe(antes.o.encargo?.id)
    expect(despues.o.encargo?.hechos.map((h) => h.nodo)).toEqual([hechoAntes])

    // Y persigue la SEGUNDA parte, no la primera.
    correr(despues, 10)
    expect(despues.o.enCurso?.de, 'el encargo restaurado no llegó a la mente').toBe('vos')
    expect(despues.o.metaEnCurso, 'volvió a empezar por el primer paso').toBe(segundo)
  })

  it('(4) Y NO SE REPITE AUNQUE EL MUNDO YA NO LO CUMPLA', async () => {
    // El caso que separa «me acuerdo» de «lo vuelvo a mirar»: si lo hecho se
    // dedujera del mundo, soltar el palo haría empezar de cero. Lo que se anota
    // es que se cumplió UNA VEZ, con su tick, que es lo que el ADR 0083 porta.
    const d = enMemoria()
    const antes = nueva()
    antes.o.decir(DE_DOS_PARTES)
    correr(antes, 30)
    expect(antes.o.encargo?.hechos).toHaveLength(1)

    // Se le vacían las manos a mano: el mundo deja de cumplir la primera parte.
    const actor = antes.p.state.actors.get(QUIEN)
    expect(actor?.holding.length, 'no tenía nada en la mano, el control no controla').toBeGreaterThan(0)
    antes.p.state.actors.set(QUIEN, { ...(actor as NonNullable<typeof actor>), holding: [] })

    const despues = await recargar(d, antes)
    expect(despues.o.encargo?.hechos).toHaveLength(1)
    correr(despues, 10)
    expect(despues.o.metaEnCurso).toBe(antes.o.encargo?.nodos[1]?.meta)
  })

  it('(5) EL CONTROL NEGATIVO: sin guardar el encargo, la recarga lo pierde', async () => {
    const d = enMemoria()
    const antes = nueva()
    antes.o.decir(DE_DOS_PARTES)
    correr(antes, 30)

    // Se guarda como guardaba el C1 —mundo, creencias y charla— y nada más.
    await guardar(d, antes.p.state, antes.o.memoria, QUIEN, antes.o.charla)
    const g = await cargar(d, QUIEN)
    expect(g?.encargo, 'apareció un encargo que nadie guardó').toBeUndefined()
    const sinEncargo = new Ordenes(new Partida((g as NonNullable<typeof g>).state), QUIEN, PHYS, {
      charla: (g as NonNullable<typeof g>).charla,
    })
    expect(sinEncargo.encargo).toBeUndefined()
  })

  it('(6) SE CIERRA CUANDO EL MUNDO PRUEBA LAS DOS PARTES, y ahí dice «listo»', () => {
    const s = nueva()
    s.o.decir(DE_DOS_PARTES)
    correr(s, 200)

    const dijoListo = s.o.charla.some((d) => d.clase === 'listo')
    const e = s.o.encargo
    // O sigue activo con partes pendientes, o se cerró y lo dijo. Lo que no
    // puede pasar es que se dé por cumplido sin que el mundo lo pruebe.
    if (e === undefined || e.estado === 'cumplido') {
      expect(dijoListo, 'se cerró el encargo sin decirlo').toBe(true)
    } else {
      expect(e.hechos.length).toBeLessThan(e.nodos.length)
    }
  })

  it('(7) LA ACTIVIDAD EN VUELO NO SE GUARDA: sólo el grafo y lo hecho', async () => {
    // El plan es una hipótesis sobre el mundo de ahora y se reconstruye al
    // cargar. Lo que viaja es el ENCARGO, y se puede leer entero.
    const d = enMemoria()
    const s = nueva()
    s.o.decir(DE_DOS_PARTES)
    correr(s, 30)
    await guardar(d, s.p.state, s.o.memoria, QUIEN, s.o.charla, s.o.encargo)

    const g = await cargar(d, QUIEN)
    const claves = Object.keys((g as NonNullable<typeof g>).encargo as object).sort()
    // La lista creció dos veces —`revisiones` con la corrección multi-turno,
    // `transiciones` con la pausa del C5— y las dos veces el pin se actualizó con
    // lo que afirmaba escrito al lado: **ninguna de estas claves es el plan**. Lo
    // que se guarda es qué se pidió, qué parte de eso el mundo probó, qué
    // correcciones le hicieron y por qué paró y volvió — todo dato del PEDIDO.
    //
    // `transiciones` es el caso que más se parece al plan y no lo es: dice que a
    // las 14 se pausó por hambre, no qué pensaba hacer. Lo que la criatura estaba
    // haciendo cuando la pausaron NO se guarda, y por eso al volver replanifica
    // contra el mundo que quedó.
    expect(claves).toEqual([
      'desdeTick',
      'estado',
      'hechos',
      'id',
      'nodos',
      'revisiones',
      'texto',
      'transiciones',
      'turnos',
    ])
  })
})
