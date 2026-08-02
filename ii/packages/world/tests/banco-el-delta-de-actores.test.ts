// ─── EL BANCO DEL DELTA DE ACTORES ───────────────────────────────────────────
//
// Publicar `haciendo` y `esperando` en la escena tiene un precio que NO es el
// tamaño de los campos, y por eso hace falta medirlo antes de darlo por bueno.
//
// El delta manda **los actores enteros si alguno cambió**, y eso se justificó en
// su día con un supuesto escrito: «son dos o tres, cada uno pesa cuatro campos, y
// `undefined` quiere decir que no cambió ninguno, **que es el caso de casi todos
// los cuadros**». Ese supuesto se apoyaba en que `holding` y `capacity` cambian
// muy de vez en cuando.
//
// `haciendo.segundos` no: **cambia en cada tick mientras hay algo en curso**. O
// sea que la frase «casi todos los cuadros» puede pasar a ser falsa, y con ella el
// motivo por el que la lista de actores no se manda por diferencias.
//
// ─── QUÉ MIDE, Y CONTRA QUÉ ────────────────────────────────────────────────
//
// La misma partida, tick a tick, produciendo dos escenas: la de ahora y una
// RECORTADA a los cuatro campos viejos. De cada una sale su delta, y de los dos
// deltas salen los dos números que importan:
//
//   1. en qué fracción de los ticks el delta lleva la lista de actores;
//   2. cuántos bytes pesa el delta entero, que es lo que viajaría por una red.
//
// Los bytes se miden con `JSON.stringify` y no con un serializador propio, porque
// es la misma cuenta con la que se compara igualdad en `deltaEntre`.
//
// ─── Y DOS ESCENARIOS, PORQUE UNO SOLO NO ALCANZA ──────────────────────────
//
// El del azar dice cuánto cuesta esto en un mundo vivo. Pero un promedio esconde
// el peor caso, y el peor caso acá tiene nombre: `friccion` **no declara
// `completion`** —frotar no termina, termina la criatura—, así que una criatura
// frotando dos piedras tiene actividad en el 100% de los ticks. Ése es el techo, y
// es el número que decide si esto entra o si la lista de actores necesita deltas
// propios.

import { describe, expect, it } from 'vitest'
import { qualityOf } from '@anima/physics'

import { deltaEntre, escenaDe } from '../src/escena.js'
import type { ActorEnEscena, Escena } from '../src/escena.js'
import { stepWorld } from '../src/step.js'
import type { WorldState } from '../src/step.js'
import type { Intent } from '../src/intent.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, intencionesAlAzar, lcg, mundo } from './mundo-minimo.js'

const FOCO = { x: 0, y: 0 }
const RADIO = 4
const TICKS = 400

/**
 * La escena como era en la v1: los cuatro campos del actor y nada más.
 *
 * El cast es deliberado y vale la pena decir por qué: esto arma una escena que
 * **ya no existe** —sin `aliento`, sin actividad—, y el tipo de hoy no la admite.
 * Que `tsc` la rechace es la prueba de que el contrato cambió; el cast dice que
 * acá se la construye a propósito, para tener contra qué medir.
 */
function comoEraAntes(e: Escena): Escena {
  const actores = e.actores.map((a) => ({
    id: a.id,
    body: a.body,
    holding: a.holding,
    capacity: a.capacity,
  }))
  return { ...e, actores: actores as unknown as readonly ActorEnEscena[] }
}

interface Medida {
  /** En cuántos ticks el delta llevó la lista de actores. */
  readonly conActores: number
  /** Bytes de todos los deltas de la corrida, sumados. */
  readonly bytes: number
}

interface Corrida {
  readonly ticks: number
  readonly antes: Medida
  readonly ahora: Medida
  /** En cuántos ticks la criatura tenía algo en curso. */
  readonly conActividad: number
  /** El primero y el último, para saber si la actividad se cortó y dónde. */
  readonly primeroConActividad: number
  readonly ultimoConActividad: number
  /**
   * BYTES QUE PESA LA LISTA DE ACTORES, sumados sobre la corrida.
   *
   * Es el único número de este banco que NO depende del tamaño del mundo: el
   * total del delta lo dominan las celdas y los cuerpos, así que un porcentaje de
   * crecimiento dice más sobre cuán chico es el mundo de prueba que sobre cuánto
   * pesa un actor.
   */
  readonly bytesDeActores: number
  /** El aliento que le quedaba al final. Es lo que explica dónde se cortó. */
  readonly alientoFinal: number
  /**
   * EL TEXTO MÁS LARGO QUE ESCRIBIÓ EL ALIENTO, en caracteres.
   *
   * `aliento` viaja crudo, y un número de punto flotante que sale de restarle
   * una fracción a otra se escribe `3999.9999999999995`: dieciocho caracteres por
   * tick, por actor, para siempre. Si eso pasara, la decisión de publicarlo crudo
   * habría que rediscutirla — así que el banco lo mira en vez de suponerlo.
   */
  readonly alientoMasLargo: number
}

function correr(inicial: WorldState, intenciones: (t: number) => readonly Intent[]): Corrida {
  let w = inicial
  let previa = escenaDe(w, FOCO, RADIO)
  let bytesAntes = 0
  let bytesAhora = 0
  let conActoresAntes = 0
  let conActoresAhora = 0
  let conActividad = 0
  let bytesDeActores = 0
  let primero = -1
  let ultimo = -1
  let alientoMasLargo = 0

  for (let t = 0; t < TICKS; t++) {
    w = stepWorld(w, intenciones(t)).state
    const ahora = escenaDe(w, FOCO, RADIO)

    const dAhora = deltaEntre(previa, ahora)
    const dAntes = deltaEntre(comoEraAntes(previa), comoEraAntes(ahora))

    bytesAhora += JSON.stringify(dAhora).length
    bytesAntes += JSON.stringify(dAntes).length
    if (dAhora.actores !== undefined) {
      conActoresAhora++
      bytesDeActores += JSON.stringify(dAhora.actores).length
    }
    if (dAntes.actores !== undefined) conActoresAntes++
    for (const a of ahora.actores) {
      const largo = JSON.stringify(a.aliento).length
      if (largo > alientoMasLargo) alientoMasLargo = largo
    }
    if (ahora.actores.some((a) => a.haciendo !== undefined || a.esperando !== undefined)) {
      conActividad++
      if (primero < 0) primero = t
      ultimo = t
    }

    previa = ahora
  }

  const cuerpoDeAna = w.bodies.get('ana-cuerpo')
  return {
    ticks: TICKS,
    antes: { conActores: conActoresAntes, bytes: bytesAntes },
    ahora: { conActores: conActoresAhora, bytes: bytesAhora },
    conActividad,
    primeroConActividad: primero,
    ultimoConActividad: ultimo,
    bytesDeActores,
    alientoFinal: cuerpoDeAna === undefined ? -1 : qualityOf(cuerpoDeAna.body, 'stamina', w.phys),
    alientoMasLargo,
  }
}

function informe(quien: string, c: Corrida): string {
  return (
    `[${quien}] ticks ${String(c.ticks)}` +
    ` · con actividad ${String(porcentaje(c.conActividad, c.ticks))}%` +
    ` (del tick ${String(c.primeroConActividad)} al ${String(c.ultimoConActividad)})` +
    ` · actores en el delta: antes ${String(porcentaje(c.antes.conActores, c.ticks))}%,` +
    ` ahora ${String(porcentaje(c.ahora.conActores, c.ticks))}%` +
    ` · delta entero: ${String(Math.trunc(c.antes.bytes / c.ticks))} → ${String(Math.trunc(c.ahora.bytes / c.ticks))} bytes/tick` +
    ` · de eso, actores: ${String(Math.trunc(c.bytesDeActores / c.ticks))} bytes/tick` +
    ` · aliento final ${String(Math.trunc(c.alientoFinal))}` +
    ` · el aliento más largo escribió ${String(c.alientoMasLargo)} caracteres`
  )
}

function porcentaje(parte: number, total: number): number {
  return Math.trunc((parte * 1000) / total) / 10
}

// ─── Los dos mundos ──────────────────────────────────────────────────────────

/** Un mundo vivo: una criatura, seis cosas, e intenciones al azar. */
function elMundoDelAzar(): WorldState {
  const cosas = ['madera', 'liana', 'pescado', 'corteza', 'piedra', 'junco']
  return mundo({
    bodies: [
      enElPiso(criatura('ana', 4000), { x: 0, y: 0 }),
      ...cosas.map((s, i) => enElPiso(cuerpo(`c${String(i)}`, s, 1), { x: (i % 3) - 1, y: ((i / 3) | 0) - 1 })),
    ],
    actors: [actor('ana', { capacity: 3 })],
  })
}

/**
 * El peor caso: una criatura frotando dos piedras hasta que no puede más.
 *
 * Las dos piedras van EN LA MANO porque el arreglo de `friccion` es `held`.
 *
 * ─── Y «HASTA QUE NO PUEDE MÁS» ES LITERAL, MEDIDO ────────────────────────
 *
 * Con 4000 de aliento, la actividad corre del tick 0 al 359 y ahí se corta: el
 * banco imprime **aliento final 0**. O sea que el techo de este escenario no lo
 * pone el protocolo ni la duración de un proceso — lo pone el metabolismo, que es
 * exactamente lo que `friccion` dice de sí misma al no declarar `completion`:
 * frotar no termina, termina la criatura.
 *
 * Deja el escenario en 90% de ticks con actividad, y ése es el techo real: **no
 * existe una partida donde una criatura tenga algo en curso el 100% del tiempo**,
 * porque para reponer el aliento hay que soltar las piedras y comer.
 */
function elMundoQueFrota(): WorldState {
  return mundo({
    bodies: [
      enElPiso(criatura('ana', 4000), { x: 0, y: 0 }),
      enLaMano(cuerpo('p0', 'piedra', 0.5), { x: 0, y: 0 }, 'ana'),
      enLaMano(cuerpo('p1', 'piedra', 0.5), { x: 0, y: 0 }, 'ana'),
    ],
    actors: [actor('ana', { holding: ['p0', 'p1'], capacity: 3 })],
  })
}

const FROTAR = (t: number): readonly Intent[] => [
  {
    k: 'apply',
    by: 'ana',
    seq: t,
    commitment: 'reversible',
    process: 'friccion',
    roles: [
      { name: 'a', body: 'p0' },
      { name: 'b', body: 'p1' },
      { name: 'actor', body: 'ana-cuerpo' },
    ],
  },
]

// ─── El banco ────────────────────────────────────────────────────────────────

describe('el precio de publicar la actividad en la escena', () => {
  it('en un mundo vivo, la lista de actores pasa a viajar más seguido', () => {
    const r = lcg(20260802)
    const c = correr(elMundoDelAzar(), () => intencionesAlAzar(r, ['ana'], 2))

    console.log(informe('azar', c))

    // ─── EL CONTROL QUE ESTE BANCO SE GANÓ ─────────────────────────────────
    //
    // El aliento se publicó primero CRUDO, y este mismo escenario lo desarmó:
    // escribía 18 caracteres (`3999.9999999999995`) y hacía que la lista de
    // actores viajara en el 100% de los ticks, porque el metabolismo drena en
    // todos. Truncado a entero escribe 3 y baja al 27,5%.
    //
    // Cuatro es la cota: `stamina` llega hasta 1000, así que un entero no puede
    // pasar de cuatro dígitos. Que esto se ponga rojo quiere decir que alguien
    // sacó el `Math.trunc` de `escenaDe`.
    expect(c.alientoMasLargo).toBeLessThanOrEqual(4)

    // El delta nunca puede llevar MENOS actores que antes: los campos nuevos sólo
    // pueden agregar motivos para que la lista cambie, nunca quitarlos.
    expect(c.ahora.conActores).toBeGreaterThanOrEqual(c.antes.conActores)
    expect(c.ahora.bytes).toBeGreaterThanOrEqual(c.antes.bytes)
  })

  it('frotando hasta quedarse sin aliento —el techo— los actores pesan 194 bytes por tick', () => {
    const c = correr(elMundoQueFrota(), FROTAR)

    console.log(informe('frotar', c))

    // El control de que el escenario es el que se cree: si la puerta rechazara
    // `friccion`, este banco mediría un mundo quieto y daría un crecimiento
    // tranquilizador y falso. La cota es 0,9 y no 1 porque los últimos 40 ticks la
    // criatura ya no tiene aliento, y eso es parte del techo, no un defecto.
    expect(c.conActividad).toBeGreaterThanOrEqual(c.ticks * 0.9)
    expect(c.alientoFinal).toBe(0)

    // ─── LA COTA, Y EN BYTES POR TICK Y NO EN PORCENTAJE ────────────────────
    //
    // La razón contra el delta viejo da 3,6× acá, y ese número no significa lo
    // que parece: la base es un mundo de tres cuerpos donde no cambia nada, o sea
    // 79 bytes por tick. Un porcentaje sobre una base así mide cuán chico es el
    // mundo de prueba, no cuánto pesa un actor. Lo que decide si esto viaja por
    // una red son los BYTES, y a 20 Hz el techo de 512 por tick son 10 kB/s.
    expect(c.bytesDeActores / c.ticks).toBeLessThan(512)
  })
})
