// ─── C0 · LA LÍNEA BASE QUE FALLA POR LA RAZÓN CORRECTA ─────────────────────
//
// El tramo entero está en `docs/product/convergencia-conversacional.md` y el
// mapa de integración en `ii/docs/convergencia.md`. Este archivo es el C0:
// **se escribió antes que la solución** y sus cinco predicados son los del C1.
//
// ─── QUÉ SE AFIRMA, Y NINGUNO ES UN SELECTOR ───────────────────────────────
//
//   1. tres turnos, una recarga y un cuarto conservan ORDEN e IDENTIDAD;
//   2. una salida no aparece dos veces;
//   3. el turno anterior LLEGA AL LECTOR — «comé eso» resuelve por lo que dice
//      el log restaurado, y con el log vacío no resuelve (control negativo);
//   4. el progreso no se guarda como si el personaje lo hubiera dicho;
//   5. el mundo avanza con una consulta al proveedor pendiente PARA SIEMPRE.
//
// ─── LA RECARGA ES DE VERDAD, y por eso hay dos `Partida` ──────────────────
//
// No se «resetea» nada: se guarda con las mismas funciones que usa `main.ts`, se
// lee del mismo depósito, y con lo que vuelve se construye una `Partida` NUEVA y
// unas `Ordenes` NUEVAS. Un test que reusara el objeto viejo probaría que un
// campo sigue en memoria, que es exactamente lo que no está en duda.
//
// ─── LO QUE ESTE ARCHIVO NO PRUEBA ─────────────────────────────────────────
//
// Que la referencia resuelta llegue al OBJETIVO. No llega: `objetivosDe` no
// copia `referencia` al `GoalNode` y hacerlo es C3. Acá se prueba que el
// contexto previo cambia la LECTURA, que es lo que C1 promete.

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import { cargar, enMemoria, guardar } from '@anima/store'
import type { Deposito } from '@anima/store'
import { VENTANA_RECIENTE } from '@anima/lang'

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

/** El mismo bucle de `main.ts`: pensar antes del paso, mirar después. */
function correr({ p, o }: Sesion, n: number): void {
  for (let k = 0; k < n; k++) {
    o.antesDelTick(p.state.tick)
    vivir(p, o.mentes, 1)
    o.despuesDelTick()
  }
}

/**
 * CERRAR Y REABRIR LA PESTAÑA.
 *
 * Guarda con `guardar` y carga con `cargar` —las dos de `@anima/store`, las dos
 * que llama `main.ts`— y arma la sesión de nuevo desde lo que volvió.
 */
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

/** Dónde está y qué agarró: lo observable de «el mundo avanzó». */
function huella(p: Partida): string {
  const c = p.state.bodies.get(`${QUIEN}-cuerpo`)
  const a = p.state.actors.get(QUIEN)
  return `${String(c?.at.x)},${String(c?.at.y)}|${[...(a?.holding ?? [])].sort().join(',')}`
}

/** Las tres primeras vueltas de charla, iguales en todos los bloques. */
function tresTurnos(s: Sesion): void {
  s.o.decir('hacé fuego')
  correr(s, 10)
  s.o.decir('traé un palo')
  correr(s, 10)
  s.o.decir('atá la vara con la hebra')
  correr(s, 10)
}

describe('C1 · la charla es durable y sale por un solo canal', () => {
  it('(1) tres turnos, una recarga y un cuarto: ORDEN e IDENTIDAD', async () => {
    const d = enMemoria()
    const antes = nueva()
    tresTurnos(antes)

    const textosAntes = antes.o.charla.map((x) => x.texto)
    const turnosAntes = antes.o.charla.map((x) => x.turno)
    expect(textosAntes.length, 'tres turnos tienen que dejar al menos seis líneas').toBeGreaterThanOrEqual(6)

    const despues = await recargar(d, antes)

    // ORDEN: lo que vuelve es lo mismo y en el mismo orden. No un `Set`: el
    // orden ES la mitad de lo que se afirma.
    expect(despues.o.charla.map((x) => x.texto)).toEqual(textosAntes)
    // IDENTIDAD: cada línea vuelve con su mismo número de turno.
    expect(despues.o.charla.map((x) => x.turno)).toEqual(turnosAntes)

    // Y EL CUARTO TURNO sigue la numeración en vez de empezar de cero.
    despues.o.decir('hacé fuego')
    const ultimo = despues.o.charla.at(-1)
    expect(ultimo?.turno, 'el cuarto turno reinició la numeración').toBeGreaterThan(
      Math.max(...turnosAntes),
    )

    const nums = despues.o.charla.map((x) => x.turno)
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i] as number, 'los turnos no vienen crecientes').toBeGreaterThan(nums[i - 1] as number)
    }
  })

  it('(2) UNA SALIDA NO APARECE DOS VECES, ni al guardar dos veces', async () => {
    const d = enMemoria()
    const antes = nueva()
    tresTurnos(antes)

    // Guardar dos veces seguidas es lo que hace el juego cada 300 cuadros.
    await guardar(d, antes.p.state, antes.o.memoria, QUIEN, antes.o.charla)
    const despues = await recargar(d, antes)
    despues.o.decir('hacé fuego')

    const turnos = despues.o.charla.map((x) => x.turno)
    expect(new Set(turnos).size, 'hay dos líneas con el mismo turno').toBe(turnos.length)

    // Y el control por contenido: el acuse del primer turno está una vez sola.
    const primerAcuse = antes.o.charla.find((x) => x.clase === 'acuse')
    expect(primerAcuse, 'no hubo acuse en el primer turno').toBeDefined()
    const repetidas = despues.o.charla.filter(
      (x) => x.clase === 'acuse' && x.turno === primerAcuse?.turno,
    )
    expect(repetidas).toHaveLength(1)
  })

  it('(3) EL TURNO ANTERIOR LLEGA AL LECTOR, y sobrevive la recarga', async () => {
    const d = enMemoria()
    const antes = nueva()
    // Lo que la criatura agarra queda dicho en el log con el cuerpo al lado; eso
    // es lo que «eso» va a señalar después.
    correr(antes, 200)
    const conCuerpo = antes.o.charla.filter((x) => x.sobre !== undefined)
    expect(conCuerpo.length, 'en 200 ticks no agarró nada, no hay a qué apuntar').toBeGreaterThan(0)
    // ─── LA PRECONDICIÓN, y cambió de forma cuando entró el C6 ──────────────
    //
    // Decía «el log entero entra en la ventana» y era cierto hasta que la
    // criatura empezó a decir cuándo el catálogo no le alcanza («no sé cómo
    // cocinar todavía», que sale a los ~90 ticks). Con esa línea el log de 200
    // ticks son NUEVE y la ventana ocho.
    //
    // Lo que este bloque necesita no era que entrara el log entero: es que entre
    // **la línea a la que «eso» tiene que apuntar**. Eso es lo que se afirma
    // ahora, y es más fuerte que lo de antes — lo de antes lo garantizaba de
    // rebote y dejaba de garantizarlo por cualquier línea nueva.
    const posicion = antes.o.charla.length - antes.o.charla.lastIndexOf(conCuerpo[conCuerpo.length - 1]!)
    expect(posicion, 'la línea que «eso» señala se cayó de la ventana').toBeLessThanOrEqual(VENTANA_RECIENTE)

    const despues = await recargar(d, antes)
    despues.o.decir('comé eso')
    const c = despues.o.ultimaLectura?.clausulas[0]
    expect(c?.referencia?.clase).toBe('demostrativa')
    expect(c?.referencia?.ref, 'el log restaurado no le dijo a qué apuntar').toEqual({
      k: 'id',
      id: conCuerpo.at(-1)?.sobre,
    })

    // ─── EL CONTROL NEGATIVO ────────────────────────────────────────────────
    //
    // Sin él, el `Ref` de arriba podría venir del MUNDO —la criatura sigue con
    // la vara en la mano después de restaurar— y no del log. Con el mismo mundo
    // y el log vacío no tiene a qué apuntar.
    const sinLog = new Ordenes(new Partida(despues.p.state), QUIEN, PHYS)
    sinLog.decir('comé eso')
    expect(
      sinLog.ultimaLectura?.clausulas[0]?.referencia?.ref,
      'resolvió sin log: el contexto no venía de la charla',
    ).toBeUndefined()
  })

  it('(4) EL PROGRESO NO SE GUARDA COMO HABLA DEL PERSONAJE', async () => {
    const d = enMemoria()
    const antes = nueva()
    antes.o.decir('hacé fuego')
    correr(antes, 200)

    const clases = new Set(antes.o.charla.map((x) => x.clase))
    expect(clases.has('entrada'), 'lo que escribió el cuidador no tiene clase propia').toBe(true)
    expect(clases.has('acuse')).toBe(true)
    // El progreso existe y NO comparte clase con el acuse: una tarjeta verde no
    // acredita obediencia, y guardarlo como habla sería exactamente eso.
    expect(clases.has('progreso'), 'no se narró un solo progreso en 200 ticks').toBe(true)

    const despues = await recargar(d, antes)
    expect(new Set(despues.o.charla.map((x) => x.clase))).toEqual(clases)
  })

  it('(5) EL TICK NO ESPERA AL PROVEEDOR: pendiente para siempre y el mundo sigue', () => {
    let preguntas = 0
    const { state } = arrancar(SEMILLA)
    const p = new Partida(state)
    const o = new Ordenes(p, QUIEN, PHYS, {
      preguntar: () => {
        preguntas++
        // Nunca contesta. Es el proveedor colgado del criterio del Hito 6.
        return new Promise(() => {})
      },
    })

    o.decir('xyzzy plugh')
    // El acuse ya está, en la misma llamada y sin correr un tick.
    expect(o.charla.at(-1)?.clase).toBe('acuse')
    expect(preguntas, 'no se armó la consulta: el hueco del proveedor no está enchufado').toBe(1)

    correr({ p, o }, 120)

    // Y el mundo quedó EXACTAMENTE donde queda sin proveedor: una consulta
    // pendiente no puede cambiar la partida.
    const gemela = nueva()
    gemela.o.decir('xyzzy plugh')
    correr(gemela, 120)
    expect(huella(p)).toBe(huella(gemela.p))
    expect(o.charla.map((x) => x.texto)).toEqual(gemela.o.charla.map((x) => x.texto))
  })

  it('LA LÍNEA BASE, impresa: las métricas que C0 pide capturar', async () => {
    const d = enMemoria()
    const antes = nueva()
    tresTurnos(antes)
    const guardadas = antes.o.charla.length
    const despues = await recargar(d, antes)
    // Se cuenta ANTES del cuarto turno: lo que sobrevivió es lo que volvió del
    // guardado, no lo que hay en la lista después de seguir hablando.
    const sobrevivieron = despues.o.charla.length
    despues.o.decir('comé eso')

    const filas: readonly (readonly [string, string])[] = [
      ['líneas del log antes de la recarga', String(guardadas)],
      ['líneas que sobrevivieron', `${String(sobrevivieron)} de ${String(guardadas)}`],
      ['turnos usados como contexto', String(despues.o.ventanaUsada)],
      ['ticks hasta el acuse', '0'],
      [
        'referencias resueltas por lo dicho antes',
        despues.o.ultimaLectura?.clausulas[0]?.referencia?.ref === undefined ? '0' : '1',
      ],
      ['recuerdos recuperados', '— (C2)'],
      ['pausas/reanudaciones', '— (C5)'],
    ]
    console.log('\n  ── LA LÍNEA BASE ──')
    for (const [q, v] of filas) console.log(`  ${q.padEnd(42, '.')} ${v}`)
  })
})
