// ─── LA OBRA QUEDA DESPLEGADA, Y ESO ES ESTADO DEL MUNDO ────────────────────
//
// Criterio del **tramo D del Gate 5→6**, escrito antes de implementar. Es el
// primer pedazo del punto 5 y de todo lo que cuelga de él: sin un lugar donde
// anotar «esta obra quedó funcionando acá», no hay dispositivo que retenga, no
// hay captura que recuperar y no hay nada que guardar ni restaurar.
//
// ─── QUÉ CAMBIÓ, Y SALIÓ DE UNA MEDICIÓN ────────────────────────────────────
//
// La intención `place` existía con la firma `place(blueprint, at)` y el mundo la
// rechazaba con `'no-implementado'`. La lectura natural de esa firma era «levantá
// este plano acá». **El tramo C·bis midió que esa lectura no se sostiene**:
// construir un plano son N−1 uniones encadenadas —once cuerpos para una obra de
// seis piezas— y cada paso intermedio es un cuerpo legal. Cuando algo se puede
// desplegar, el plano YA se realizó y lo que hay en la mano es un cuerpo.
//
// Así que `place` toma un CUERPO ([ADR II-0022](../../docs/decisions/II-0022-place-despliega-un-cuerpo-no-construye-un-plano.md)),
// y de qué revisión de plano salió se anota en **la tabla del mundo**
// ([ADR II-0020](../../docs/decisions/II-0020-la-captura-vive-en-una-tabla-del-mundo.md)),
// no en el `Body` — que es materia física y la procedencia no lo es.
//
// ─── LOS CINCO CRITERIOS ────────────────────────────────────────────────────
//
//   (a) desplegar suelta el cuerpo Y anota la entrada;
//   (b) la entrada ENTRA AL HASH: dos mundos que difieren sólo en lo desplegado
//       no son el mismo mundo. Es el contrato del Hito 2, revalidado;
//   (c) es IDEMPOTENTE: desplegar dos veces no deja dos entradas ni cambia el sitio;
//   (d) levantar la obra retira la entrada — la tabla no se llena de fantasmas;
//   (e) la tabla se recorre en orden de ID y no de llegada, que es el agujero que
//       el ataque al determinismo del Hito 2 ya encontró una vez con `seq`.
//
// ─── LO QUE ESTE ARCHIVO NO PRUEBA ──────────────────────────────────────────
//
// Que el dispositivo HAGA algo. Retener, sacar del pozo solo, acumular captura:
// eso es el tramo siguiente y necesita el destino nuevo de `drawFromStock`, que
// pasa por `admit()`. Acá sólo se afirma que una obra puede quedar puesta, que el
// mundo lo sabe, y que lo sabe de forma reproducible.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type Physics } from '@anima/physics'

import { place, take, type Intent } from '../src/intent.js'
import { hashWorldState, restoreWorld, worldSlots } from '../src/mundo.js'
import { stepWorld, type WorldState } from '../src/step.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, mundo } from './mundo-minimo.js'

const PHYS: Physics = buildSeedPhysics()
const PARADA = { x: 0, y: 0 }
/**
 * EL SITIO: la celda de al lado, y no la de la criatura.
 *
 * La celda donde está parada la ocupa ella —lo dice `intencionSoltar`: «a los
 * pies, no encima»— así que desplegar ahí se rechaza con `celda-ocupada`. Y se
 * rechaza en vez de correr la obra a la celda libre más cercana A PROPÓSITO: la
 * obra tiene UN sitio y es el que se pidió (ADR 0049 de Ánima I, portado). Una
 * obra que se muda sola deja media choza abandonada en el sitio anterior.
 */
const SITIO = { x: 1, y: 0 }

/**
 * Una obra en la mano de la criatura. No se llama de ninguna manera y no tiene
 * ningún `kind`: es un cuerpo de madera, y lo que la hace obra es haberla puesto.
 */
function escena(o: { enMano?: boolean } = {}): WorldState {
  const yo = criatura('yo')
  const obra = cuerpo('obra', 'madera', 1)
  return mundo({
    phys: PHYS,
    bodies: [
      enElPiso(yo, PARADA),
      o.enMano === false ? enElPiso(obra, PARADA) : enLaMano(obra, PARADA, 'yo'),
    ],
    actors: [actor('yo', { holding: o.enMano === false ? [] : ['obra'] })],
  })
}

function corre(s: WorldState, ...is: readonly Intent[]): WorldState {
  return stepWorld(s, is).state
}

const QUIEN = { by: 'yo', seq: 0 }

// ─── (a) Desplegar ──────────────────────────────────────────────────────────

describe('(a) desplegar suelta el cuerpo y lo anota', () => {
  it('la premisa: antes de desplegar, la tabla está vacía', () => {
    expect(escena().desplegados.size).toBe(0)
  })

  it('después de `place`, hay una entrada con el sitio', () => {
    const s = corre(escena(), place(QUIEN, 'obra', SITIO))
    expect(s.desplegados.size).toBe(1)
    expect(s.desplegados.get('obra')?.at).toEqual(SITIO)
  })

  it('y el cuerpo dejó de estar en la mano: una obra desplegada no es carga', () => {
    const s = corre(escena(), place(QUIEN, 'obra', SITIO))
    expect(s.bodies.get('obra')?.heldBy).toBeUndefined()
    expect(s.actors.get('yo')?.holding).not.toContain('obra')
  })

  it('lo que NO se tiene no se puede desplegar', () => {
    const s = corre(escena({ enMano: false }), place(QUIEN, 'obra', SITIO))
    expect(s.desplegados.size).toBe(0)
  })
})

// ─── (b) El hash ────────────────────────────────────────────────────────────

describe('(b) lo desplegado entra al hash del mundo', () => {
  it('dos mundos que difieren SÓLO en lo desplegado tienen hashes distintos', () => {
    // El contrato del Hito 2, revalidado con el estado nuevo adentro. Si esto
    // fuera igual, dos réplicas podrían divergir en el tick 400 y el hash diría
    // que son la misma partida hasta el final.
    const sin = escena()
    const con = corre(escena(), place(QUIEN, 'obra', SITIO))
    expect(hashWorldState(con)).not.toBe(hashWorldState(sin))
  })

  it('y el mismo despliegue hecho dos veces da EL MISMO hash', () => {
    // El piso de todo: el mundo es función de lo que pasó. Si esto se pusiera
    // rojo, adentro habría estado que no sale del journal.
    const a = corre(escena(), place(QUIEN, 'obra', SITIO))
    const b = corre(escena(), place(QUIEN, 'obra', SITIO))
    expect(hashWorldState(a)).toBe(hashWorldState(b))
  })
})

// ─── (c) Idempotencia ───────────────────────────────────────────────────────

describe('(c) desplegar dos veces no deja dos obras', () => {
  it('la segunda vez no agrega una entrada', () => {
    // Es la mitad del punto 5 que se puede afirmar hoy. La otra —que construir de
    // a poco no rehaga lo hecho— es del `BuildSkill`.
    let s = corre(escena(), place(QUIEN, 'obra', SITIO))
    s = corre(s, place({ by: 'yo', seq: 1 }, 'obra', SITIO))
    expect(s.desplegados.size).toBe(1)
  })

  it('y no le cambia el sitio: la obra tiene UN sitio y se retoma, no se muda', () => {
    // ADR 0049 de Ánima I, portado: retomar una obra es seguir la misma, no
    // empezar otra al lado. Acá se aplica al despliegue: una vez puesta, un
    // `place` a otra celda no la teletransporta.
    let s = corre(escena(), place(QUIEN, 'obra', SITIO))
    s = corre(s, place({ by: 'yo', seq: 1 }, 'obra', { x: 3, y: 3 }))
    expect(s.desplegados.get('obra')?.at).toEqual(SITIO)
  })
})

// ─── (d) Levantarla ─────────────────────────────────────────────────────────

describe('(d) levantar la obra retira su entrada', () => {
  it('un `take` sobre una obra desplegada la saca de la tabla', () => {
    // Sin esto la tabla se llena de fantasmas: entradas de dispositivos que ya
    // nadie tiene puestos, que el mundo igual recorrería todos los ticks y que el
    // hash igual contaría.
    let s = corre(escena(), place(QUIEN, 'obra', SITIO))
    expect(s.desplegados.size).toBe(1)
    s = corre(s, take({ by: 'yo', seq: 0 }, 'obra'))
    expect(s.actors.get('yo')?.holding).toContain('obra')
    expect(s.desplegados.size).toBe(0)
  })
})

// ─── (e) El orden ───────────────────────────────────────────────────────────

describe('(e) la tabla se recorre por ID, no por orden de llegada', () => {
  it('el ORDEN DE LLEGADA de dos despliegues del mismo tick no decide nada', () => {
    // El agujero que el ataque al determinismo del Hito 2 ya encontró una vez con
    // `seq`: resolver por orden de llegada hace que dos réplicas del mismo mundo
    // dejen de ser la misma partida. Con dos dispositivos sobre el mismo pozo eso
    // deja de ser teórico, y es el caso que el tramo siguiente va a necesitar.
    //
    // ─── LOS DOS VAN EN EL MISMO TICK, y eso lo enseñó un rojo ──────────────
    //
    // La primera versión los desplegaba en dos `stepWorld` seguidos y daba verde
    // — pero verde por casualidad: **estaba midiendo en qué TICK se desplegó cada
    // uno**, que sí es otra partida. No se notaba porque nada del mundo dependía
    // todavía del tick de despliegue. Se puso roja sola al entrar el sistema de
    // dispositivos, que le anota a cada uno cuándo vuelve a intentar.
    //
    // Y hacen falta DOS actores: un actor no emite dos intenciones en un tick —la
    // segunda sale `ya-actuo`—. Lo que se revuelve es el arreglo de entrada, que
    // es el orden en que contestaron las mentes y no puede decidir nada.
    function conDos(alReves: boolean): WorldState {
      const s = mundo({
        phys: PHYS,
        bodies: [
          enElPiso(criatura('yo'), PARADA),
          enElPiso(criatura('vos'), PARADA),
          enLaMano(cuerpo('obra-a', 'madera', 1), PARADA, 'yo'),
          enLaMano(cuerpo('obra-b', 'madera', 1), PARADA, 'vos'),
        ],
        actors: [
          actor('yo', { holding: ['obra-a'], capacity: 4 }),
          actor('vos', { holding: ['obra-b'], capacity: 4 }),
        ],
      })
      const is: readonly Intent[] = [
        place({ by: 'yo', seq: 0 }, 'obra-a', SITIO),
        place({ by: 'vos', seq: 0 }, 'obra-b', { x: 0, y: 1 }),
      ]
      return stepWorld(s, alReves ? [...is].reverse() : is).state
    }
    const derecho = conDos(false)
    // La premisa: los dos quedaron puestos. Sin esto el test compararía dos
    // mundos con una sola obra y pasaría sin medir nada.
    expect(derecho.desplegados.size).toBe(2)
    expect(hashWorldState(conDos(true))).toBe(hashWorldState(derecho))
  })

  it('y las claves salen ordenadas, no en orden de inserción', () => {
    let s = mundo({
      phys: PHYS,
      bodies: [
        enElPiso(criatura('yo'), PARADA),
        enLaMano(cuerpo('z-obra', 'madera', 1), PARADA, 'yo'),
        enLaMano(cuerpo('a-obra', 'madera', 1), PARADA, 'yo'),
      ],
      actors: [actor('yo', { holding: ['z-obra', 'a-obra'], capacity: 4 })],
    })
    s = corre(s, place({ by: 'yo', seq: 0 }, 'z-obra', SITIO))
    s = corre(s, place({ by: 'yo', seq: 0 }, 'a-obra', { x: 0, y: 1 }))
    expect([...s.desplegados.keys()]).toEqual(['a-obra', 'z-obra'])
  })
})

// ─── (f) Guardar y restaurar ────────────────────────────────────────────────

describe('(f) guardar y restaurar conserva la obra Y SU REVISIÓN EXACTA', () => {
  // Es el punto 8 del criterio del gate, y la parte que importa es la de la
  // revisión: sin ella, una partida cargada tiene una trampa que funciona y NADIE
  // sabe de qué plano salió — o sea que el juez no le puede atribuir el resultado
  // a nada y la herencia del Hito 10 no tiene qué heredar.
  //
  // La ida y vuelta se hace por JSON A PROPÓSITO, y no clonando objetos: un
  // guardado de verdad pasa por texto, y ahí es donde un `Map` se convierte en
  // `{}` en silencio y un `bigint` lanza. Es el mismo camino que usan los ataques
  // al fuego.
  const REVISION = 'a1b2c3d4e5f60718'

  function idaYVuelta(w: WorldState): WorldState {
    const crudo = JSON.parse(JSON.stringify([...worldSlots(w)])) as [string, unknown][]
    return restoreWorld(new Map(crudo))
  }

  it('la obra vuelve, con su sitio y con su revisión', () => {
    const puesta = corre(escena(), place(QUIEN, 'obra', SITIO, REVISION))
    const vuelta = idaYVuelta(puesta)
    expect(vuelta.desplegados.get('obra')?.at).toEqual(SITIO)
    expect(vuelta.desplegados.get('obra')?.revision).toBe(REVISION)
  })

  it('y el HASH es el mismo: guardar y cargar no es otra partida', () => {
    // El control que hace valioso al anterior. Comparar campo por campo se olvida
    // del campo que alguien agregue mañana; el hash mira todo.
    const puesta = corre(escena(), place(QUIEN, 'obra', SITIO, REVISION))
    expect(hashWorldState(idaYVuelta(puesta))).toBe(hashWorldState(puesta))
  })

  it('una obra SIN revisión también vuelve, y sin inventarle una', () => {
    // El mundo no exige procedencia para dejar poner algo: una obra armada a mano
    // no salió de ningún plano. Lo que no puede pasar es que la restauración le
    // invente una clave, porque eso movería el hash.
    const puesta = corre(escena(), place(QUIEN, 'obra', SITIO))
    const vuelta = idaYVuelta(puesta)
    expect(vuelta.desplegados.get('obra')).toBeDefined()
    expect(vuelta.desplegados.get('obra')?.revision).toBeUndefined()
    expect(hashWorldState(vuelta)).toBe(hashWorldState(puesta))
  })

  it('y un mundo SIN obras desplegadas vuelve igual que siempre', () => {
    // El control de compatibilidad: el campo nuevo no puede cambiarle el guardado
    // a una partida que no lo usa.
    const w = corre(escena())
    expect(hashWorldState(idaYVuelta(w))).toBe(hashWorldState(w))
  })
})
