// ─── C2 · LA MEMORIA DE LA CHARLA, Y DE DÓNDE SALIÓ CADA COSA ───────────────
//
// El criterio está en `docs/product/convergencia-conversacional.md`:
//
//   > después de conversación irrelevante y recarga, «hacé lo que te pedí con el
//   > otro» recupera el encargo y referente correctos. Ánima puede citar qué
//   > recuerda y su fuente; una afirmación del cuidador no altera el mundo ni se
//   > presenta como observación confirmada.
//
// Se escribe ANTES de la solución, como el C0. Y hereda su decisión de fondo: el
// log durable es el único almacén, y los recuerdos son una VISTA de él. Por eso
// el control negativo de abajo puede existir — con el mismo mundo y sin log, no
// se recupera nada.
//
// ─── LO QUE ESTE ARCHIVO NO PRUEBA ─────────────────────────────────────────
//
// Que el encargo recuperado sea DURABLE. No lo es: `EncargoEnCurso` es efímero y
// el `Commission` con su grafo es C3. Lo que se recupera es el TURNO en que se
// pidió, que sí es durable, y de ahí sale la meta otra vez.

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import { hashWorldState } from '@anima/world'
import { cargar, enMemoria, guardar } from '@anima/store'
import type { Deposito } from '@anima/store'

import { Ordenes } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

const QUIEN = 'ana'
const SEMILLA = 20260727n

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
  await guardar(d, s.p.state, s.o.memoria, QUIEN, s.o.charla)
  const g = await cargar(d, QUIEN)
  expect(g, 'no volvió nada del guardado').toBeDefined()
  const p = new Partida((g as NonNullable<typeof g>).state)
  const o = new Ordenes(p, QUIEN, PHYS, {
    memoria: (g as NonNullable<typeof g>).creencias,
    charla: (g as NonNullable<typeof g>).charla,
  })
  return { p, o }
}

/**
 * Charla que no pide nada. Es el ruido que el retrieval tiene que atravesar.
 *
 * Las tres se eligieron midiendo, no a ojo: tienen que salir `no-entendida` para
 * que no pisen el encargo (`decir` no reemplaza un encargo con uno vacío). Una
 * frase «irrelevante» que sin querer produjera una meta convertiría este ruido en
 * otra orden, y el bloque mediría otra cosa.
 */
function charlaIrrelevante(s: Sesion): void {
  s.o.decir('hola')
  s.o.decir('xyzzy plugh')
  s.o.decir('bla bla bla')
}

describe('C2 · recuerda de qué hablaron, y de dónde lo sacó', () => {
  it('(1) charla irrelevante, recarga, y «hacé lo que te pedí» recupera el pedido', async () => {
    // ─── LOS NÚMEROS SON MEDIDOS, no elegidos ───────────────────────────────
    //
    // Se sondeó tick a tick antes de escribir el bloque: «hacé fuego» sale
    // `emitsPower>0` y la mente la persigue del tick 0 al ~70. «Traé un palo»
    // NO sirve acá: se cumple sola alrededor del tick 10 —agarra la vara que
    // tiene al lado— y entonces no habría nada pendiente que recuperar.
    const d = enMemoria()
    const antes = nueva()
    antes.o.decir('hacé fuego')
    correr(antes, 20)
    const firma = antes.o.ultimaLectura?.clausulas[0]?.firma
    expect(antes.o.enCurso?.de, 'la orden original no llegó a la mente').toBe('vos')
    expect(firma).toBeDefined()

    charlaIrrelevante(antes)
    correr(antes, 10)

    const despues = await recargar(d, antes)
    // El encargo NO sobrevive, y está bien: es efímero y el durable es C3. Lo
    // que sobrevive es el TURNO en que se pidió.
    expect(despues.o.enCurso?.de, 'el encargo efímero sobrevivió: esto ya sería C3').not.toBe('vos')

    despues.o.decir('hacé lo que te pedí')
    // La lectura recupera la MISMA firma del turno de hace siete líneas, y no la
    // de la última frase, que no pedía nada.
    expect(despues.o.ultimaLectura?.clausulas[0]?.firma).toBe(firma)

    correr(despues, 10)
    expect(despues.o.enCurso?.de, 'lo recuperado no llegó a la mente').toBe('vos')
  })

  it('(2) EL CONTROL NEGATIVO: con el mismo mundo y sin log, no recupera nada', async () => {
    const d = enMemoria()
    const antes = nueva()
    antes.o.decir('hacé fuego')
    correr(antes, 20)
    const despues = await recargar(d, antes)

    // Misma partida restaurada, log vacío: la frase no tiene de dónde sacar nada.
    const sinLog = new Ordenes(new Partida(despues.p.state), QUIEN, PHYS)
    sinLog.decir('hacé lo que te pedí')
    expect(sinLog.ultimaLectura?.clausulas[0]?.firma, 'recuperó una meta sin log').toBeUndefined()
    expect(sinLog.charla.at(-1)?.texto, 'contestó como si supiera qué recuperar').not.toBe('dale, voy')
  })

  it('(3) «EL OTRO» es el segundo cuerpo nombrado, no el último', () => {
    const s = nueva()
    correr(s, 200)
    const nombrados = s.o.charla.filter((x) => x.sobre !== undefined).map((x) => x.sobre)
    expect(new Set(nombrados).size, 'la criatura no agarró dos cosas distintas').toBeGreaterThanOrEqual(2)

    s.o.decir('traé eso')
    const eso = s.o.ultimaLectura?.clausulas[0]?.referencia?.ref
    s.o.decir('traé el otro')
    const otro = s.o.ultimaLectura?.clausulas[0]?.referencia?.ref

    expect(eso, '«eso» no resolvió').toBeDefined()
    expect(otro, '«el otro» no resolvió').toBeDefined()
    // Y son cuerpos DISTINTOS: si «el otro» diera lo mismo que «eso», la
    // distinción no existiría y el test estaría midiendo dos veces lo mismo.
    expect(otro).not.toEqual(eso)
  })

  it('(4) CITA QUÉ RECUERDA Y SU FUENTE: turno y procedencia, no prosa', async () => {
    const d = enMemoria()
    const s = nueva()
    s.o.decir('traé un palo')
    correr(s, 200)
    const despues = await recargar(d, s)

    const rs = despues.o.queRecuerda()
    expect(rs.length, 'no recuerda nada después de una recarga').toBeGreaterThan(0)

    // Cada recuerdo dice de qué TURNOS salió y quién lo dijo. Sin las dos cosas
    // no se puede distinguir lo que le contaron de lo que vio.
    for (const r of rs) {
      expect(r.turnos.length, `«${r.texto}» no dice de qué turno salió`).toBeGreaterThan(0)
      expect(['cuidador', 'agente', 'mundo']).toContain(r.procedencia)
      // Y el turno que cita existe en el log: una fuente que no se puede seguir
      // es una fuente inventada.
      for (const t of r.turnos) {
        expect(despues.o.charla.some((d2) => d2.turno === t), `el turno ${String(t)} no está en el log`).toBe(true)
      }
    }

    // El pedido está entre lo que recuerda, y salió del cuidador.
    const pedido = rs.find((r) => r.clase === 'pedido')
    expect(pedido?.procedencia).toBe('cuidador')
    expect(pedido?.texto).toContain('palo')
  })

  it('(5) UNA AFIRMACIÓN DEL CUIDADOR NO ALTERA EL MUNDO, y no se anota como visto', () => {
    // Las dos mitades del criterio, y la segunda es la que no es obvia: no
    // alcanza con que el mundo no cambie, tiene que quedar claro que eso fue
    // DICHO y no observado.
    const conDicho = nueva()
    const gemela = nueva()
    conDicho.o.decir('hay un pescado acá')

    correr(conDicho, 120)
    correr(gemela, 120)
    expect(hashWorldState(conDicho.p.state), 'una frase cambió el mundo').toBe(
      hashWorldState(gemela.p.state),
    )

    const r = conDicho.o.queRecuerda().find((x) => x.texto.includes('pescado'))
    expect(r, 'no quedó registro de lo que le dijeron').toBeDefined()
    expect(r?.procedencia).toBe('cuidador')
    // `hecho` es lo que la criatura VIO; lo que le contaron nunca llega a serlo.
    expect(r?.clase, 'una afirmación del cuidador se anotó como hecho del mundo').not.toBe('hecho')

    // ─── Y EL CONTROL MÁS FINO, que no es el de arriba ──────────────────────
    //
    // Arriba se compara después de 120 ticks, así que un desvío chico podría
    // haberse disuelto. Acá se compara SIN UN SOLO TICK y con una frase que sí
    // se entiende: `yaEstaCumplida` arma un `Contexto` con el dado de la partida
    // adentro, o sea que si preguntar consumiera azar, **hablar movería la
    // partida sin que el mundo avance**. Es el modo de falla que ningún test de
    // obediencia vería.
    const quieta = nueva()
    const hash = hashWorldState(quieta.p.state)
    quieta.o.decir('hacé fuego')
    expect(hashWorldState(quieta.p.state), 'leer una frase movió el mundo').toBe(hash)
  })

  it('LOS TOPES, medidos: el retrieval devuelve pocos y dice cuántos miró', () => {
    const s = nueva()
    s.o.decir('traé un palo')
    correr(s, 200)
    for (let i = 0; i < 30; i++) s.o.decir(`bla bla ${String(i)}`)

    const r = s.o.recuperar('hacé lo que te pedí')
    // Y el que importa: buscar por una palabra de contenido tiene que traer el
    // turno que la dijo, entre treinta que no. Sin esto, «devuelve pocos» se
    // cumpliría devolviendo pocos y equivocados.
    const porFuego = s.o.recuperar('palo')
    console.log('\n  ── LOS TOPES DEL RETRIEVAL ──')
    console.log(`  líneas en el log ......... ${String(s.o.charla.length)}`)
    console.log(`  miradas .................. ${String(r.mirados)}`)
    console.log(`  turnos devueltos ......... ${String(r.turnos.length)}`)
    console.log(`  recuerdos devueltos ...... ${String(r.recuerdos.length)}`)
    console.log(`  buscar «palo» trae ....... «${String(porFuego.turnos[0]?.texto)}»`)
    expect(r.turnos.length, 'devolvió el log entero: no hay tope').toBeLessThan(s.o.charla.length)
    expect(r.mirados).toBe(s.o.charla.length)
    expect(porFuego.turnos[0]?.texto ?? '', 'el retrieval no encontró el turno del palo').toContain('palo')
  })
})
