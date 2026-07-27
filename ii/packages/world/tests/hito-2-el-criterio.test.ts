// ─── EL CRITERIO VERIFICABLE DEL HITO 2, sobre el mundo de verdad ────────────
//
// Del plan de construcción, palabra por palabra:
//
//   «dos mundos gemelos con 10⁵ intenciones → mismo `hashWorld`; restaurar a
//    mitad reproduce el final exacto; 5000 cuerpos a menos de 4 ms por tick;
//    **el mismo hash en Chrome y en Firefox**.»
//
// Este archivo verifica las cuatro sobre las piezas de verdad y no sobre
// sustitutos: el `hashWorld` del paquete —no una huella escrita para el test—, el
// `stepWorld` del paquete —no un mundo de juguete—, el `Journal` y la
// `SnapshotChain` del paquete. Los tres agentes verificaron dos de las cuatro
// cada uno, pero cada uno contra su propia pieza: el criterio decía `hashWorld` y
// lo que corría era una huella local sobre el mundo real, o `hashWorld` sobre un
// mundo de juguete. Ninguna de las dos era la frase.
//
// Se importa todo desde `../src/index.js` a propósito: si la puerta del paquete
// no exporta lo que hace falta, o si dos módulos chocan en un nombre, este
// archivo no compila. Es la prueba más barata de que las tres partes son una.
//
// El cuarto criterio —el mismo hash en dos motores— NO se puede correr desde
// Node, y está anotado abajo con lo que haría falta.

import { describe, expect, it } from 'vitest'

import {
  createJournal,
  createSnapshotChain,
  hashPhysics,
  hashWorldState,
  mapaDeActores,
  pasoDelMundo,
  replay,
  restoreAt,
  restoreWorld,
  revisarInvariantes,
  stepWorld,
  worldSlots,
} from '../src/index.js'
import type { Intent, WorldBody, WorldHash, WorldState } from '../src/index.js'
import { actor, criatura, cuerpo, enElPiso, intencionesAlAzar, lcg, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number) => ({ x, y })
const NOMBRES = ['ana', 'beto', 'cira', 'dani', 'eze', 'fina', 'gero', 'hilda', 'ivo', 'juli']
const MATERIA = ['madera', 'liana', 'pescado', 'corteza', 'hoja', 'piedra']

/**
 * La partida. Diez criaturas y seis cosas, que es suficiente para que las
 * intenciones se pisen entre sí: dos que quieren el mismo palo, uno que suelta
 * donde otro está parado, tres que aplican el mismo proceso a los mismos cuerpos.
 * Un mundo con un actor solo no prueba determinismo, prueba una función.
 */
function partida(ordenDeAlta: 'natural' | 'al-reves' = 'natural'): WorldState {
  const bodies: WorldBody[] = []
  const actores = []
  for (let i = 0; i < NOMBRES.length; i++) {
    const n = NOMBRES[i] as string
    bodies.push(enElPiso(criatura(n, 4000), EN(i - 5, i - 5)))
    actores.push(actor(n, { capacity: 3 }))
  }
  for (let i = 0; i < 6; i++) {
    bodies.push(enElPiso(cuerpo(`c${i}`, MATERIA[i] as string, 1), EN(i - 3, 3)))
  }
  // El gemelo se arma con las cosas dadas de alta EN OTRO ORDEN. No es adorno:
  // el orden de inserción de un `Map` de JS se conserva, así que si el hash lo
  // heredara, dos partidas que crearon lo mismo en distinto orden divergirían —
  // y eso es exactamente lo que va a pasar cuando el oráculo del Hito 3 resuelva
  // los chunks según por dónde caminó la criatura.
  return ordenDeAlta === 'natural'
    ? mundo({ bodies, actors: actores })
    : mundo({ bodies: [...bodies].reverse(), actors: [...actores].reverse() })
}

interface Corrida {
  readonly journal: ReturnType<typeof createJournal<Intent>>
  readonly fin: WorldState
  readonly checkpoints: Map<number, WorldHash>
  readonly mitad: { readonly tick: number; readonly state: WorldState }
}

/**
 * Corre una partida entera anotando todo lo que el criterio necesita: el journal
 * de intenciones, un checkpoint cada `cada` ticks y la foto de la mitad.
 *
 * Los checkpoints no son adorno. Este mundo DISIPA —el calor se va, la humedad se
 * topa contra cero, la `stamina` satura— así que comparar solo el hash final es
 * una prueba débil: un motor con un bug de determinismo puede divergir en el tick
 * 400 y volver a converger para el 9000. El hash intermedio es lo que lo ve.
 */
function correr(inicial: WorldState, semilla: number, ticks: number, porTick: number, cada: number): Corrida {
  const journal = createJournal<Intent>()
  const r = lcg(semilla)
  const checkpoints = new Map<number, WorldHash>()
  let s = inicial
  let mitad = { tick: 0, state: inicial }
  for (let t = 0; t < ticks; t++) {
    if (t % cada === 0) checkpoints.set(t, hashWorldState(s))
    if (t === Math.trunc(ticks / 2)) mitad = { tick: t, state: s }
    const intents = intencionesAlAzar(r, NOMBRES, porTick)
    for (const i of intents) journal.append(t, i)
    s = stepWorld(s, intents).state
  }
  checkpoints.set(ticks, hashWorldState(s))
  return { journal, fin: s, checkpoints, mitad }
}

// ─── (a) dos mundos gemelos con 10⁵ intenciones ──────────────────────────────

describe('(a) dos mundos gemelos con 10⁵ intenciones dan el mismo hashWorld', () => {
  const TICKS = 10_000
  const POR_TICK = 10

  it('cien mil intenciones exactas, y el gemelo se armó en otro orden', () => {
    expect(TICKS * POR_TICK).toBe(100_000)
    const uno = correr(partida('natural'), 20260727, TICKS, POR_TICK, 1000)
    const otro = correr(partida('al-reves'), 20260727, TICKS, POR_TICK, 1000)

    expect(uno.journal.length).toBe(100_000)
    expect(otro.journal.length).toBe(100_000)
    // Los dos journals son el mismo journal: cada `append` hashea la intención,
    // así que la cadena coincide solo si las 100 000 son bit a bit iguales.
    expect(otro.journal.chain).toBe(uno.journal.chain)

    // Y los dos mundos son el mismo mundo, con el `hashWorld` del paquete.
    expect(hashWorldState(otro.fin)).toBe(hashWorldState(uno.fin))
    // Los ONCE checkpoints también, uno por uno: si divergieran en el tick 4000 y
    // volvieran a converger, el hash final no lo vería y esto sí.
    expect(otro.checkpoints.size).toBe(11)
    for (const [t, h] of uno.checkpoints) expect(otro.checkpoints.get(t)).toBe(h)

    // Guarda contra el test que pasa sin probar nada: el mundo terminó vivo, con
    // cuerpos adentro, y no es el hash de un `Map` vacío.
    expect(uno.fin.bodies.size).toBeGreaterThan(5)
    expect(hashWorldState(uno.fin)).not.toBe(hashWorldState(partida()))
  }, 300_000)

  it('el control negativo: otra semilla, otro hash', () => {
    const a = correr(partida(), 1, 200, 10, 1000)
    const b = correr(partida(), 2, 200, 10, 1000)
    expect(hashWorldState(b.fin)).not.toBe(hashWorldState(a.fin))
    expect(b.journal.chain).not.toBe(a.journal.chain)
  }, 60_000)

  it('el orden de LLEGADA de las intenciones del tick no cambia el hash', () => {
    // La otra mitad del determinismo: dos mentes que contestan en distinto orden
    // no pueden producir dos mundos. `stepWorld` ordena por (actor, seq) antes de
    // tocar nada, y el orden es TOTAL — nunca lo decide la estabilidad del `sort`.
    const s = partida()
    const is = intencionesAlAzar(lcg(7), NOMBRES, 40)
    const derecho = hashWorldState(stepWorld(s, is).state)
    const revés = hashWorldState(stepWorld(s, [...is].reverse()).state)
    expect(revés).toBe(derecho)
  })
})

// ─── (b) restaurar a mitad reproduce el final exacto ─────────────────────────

describe('(b) restaurar un snapshot a mitad reproduce el final exacto', () => {
  const TICKS = 1000
  const POR_TICK = 6
  const A = correr(partida(), 424242, TICKS, POR_TICK, 100)

  it('el mundo entero cabe en ranuras y vuelve idéntico', () => {
    // El viaje de ida y vuelta, sin cadena de por medio: si esto no diera, todo
    // lo de abajo estaría midiendo el snapshot y no el mundo.
    const vuelto = restoreWorld(worldSlots(A.fin))
    expect(hashWorldState(vuelto)).toBe(hashWorldState(A.fin))
    // Y vuelve LEGAL: un estado restaurado que rompe invariantes es un estado que
    // el mundo no habría podido producir.
    expect(revisarInvariantes(vuelto, vuelto)).toEqual([])
  })

  it('guardar en la mitad, restaurar desde lo GUARDADO y seguir da el final exacto', () => {
    // Se restaura desde la CADENA DE DELTAS, no desde la variable en memoria: lo
    // que hay que probar es que lo guardado alcanza.
    const cadena = createSnapshotChain<unknown>()
    cadena.take(0, worldSlots(partida()))
    const d = cadena.take(A.mitad.tick, worldSlots(A.mitad.state))

    const ranuras = restoreAt(cadena.deltas, d.index)
    const desdeElDisco = restoreWorld(ranuras)
    expect(hashWorldState(desdeElDisco)).toBe(hashWorldState(A.mitad.state))

    const final = replay(A.journal, { tick: d.tick, state: desdeElDisco }, pasoDelMundo, {
      hasta: TICKS - 1,
      checkpoints: A.checkpoints,
      hashOf: hashWorldState,
    })
    expect(hashWorldState(final)).toBe(hashWorldState(A.fin))
  }, 120_000)

  it('el delta cobra por lo que cambió y no por el tamaño del mundo', () => {
    // La promesa entera del snapshot por delta. La base son todas las ranuras;
    // los eslabones siguientes, solo lo que se movió. Si esto dejara de valer, el
    // guardado volvería a ser el `structuredClone` que crece con la partida.
    const cadena = createSnapshotChain<unknown>()
    let s = partida()
    const base = cadena.take(0, worldSlots(s))
    const r = lcg(5)
    for (let t = 0; t < 20; t++) s = stepWorld(s, intencionesAlAzar(r, NOMBRES, 4)).state
    const delta = cadena.take(20, worldSlots(s))
    expect(delta.set.length + delta.del.length).toBeLessThan(base.set.length / 2)
    // Y aplicar la cadena entera da el mismo mundo que la foto.
    expect(hashWorldState(restoreWorld(restoreAt(cadena.deltas, 1)))).toBe(hashWorldState(s))
  })
})

// ─── (d) el replay del journal reconstruye el estado exacto ──────────────────

describe('(d) el replay del journal reconstruye el estado exacto', () => {
  const TICKS = 1000
  const A = correr(partida(), 777, TICKS, 6, 100)

  it('reproducir la partida entera desde el journal, con los once checkpoints', () => {
    const rehecho = replay(A.journal, { tick: 0, state: partida() }, pasoDelMundo, {
      hasta: TICKS - 1,
      checkpoints: A.checkpoints,
      hashOf: hashWorldState,
    })
    expect(hashWorldState(rehecho)).toBe(hashWorldState(A.fin))
  }, 120_000)

  it('y el mismo replay a la escala del criterio: 10⁵ intenciones', () => {
    const B = correr(partida(), 20260727, 10_000, 10, 1000)
    const rehecho = replay(B.journal, { tick: 0, state: partida() }, pasoDelMundo, {
      hasta: 9999,
      checkpoints: B.checkpoints,
      hashOf: hashWorldState,
    })
    expect(hashWorldState(rehecho)).toBe(hashWorldState(B.fin))
  }, 300_000)

  it('el replay corre TODOS los ticks, también los que no tienen intención', () => {
    // Las doce leyes corren solas: la brasa se enfría sin que nadie quiera nada.
    // Un replay que saltara del tick 100 al 140 porque en el medio no hubo
    // intenciones no daría un hash distinto: daría un mundo COHERENTE y
    // equivocado. Se verifica con un journal que tiene un hueco de 50 ticks.
    const j = createJournal<Intent>()
    const r = lcg(3)
    for (const i of intencionesAlAzar(r, NOMBRES, 3)) j.append(0, i)
    for (const i of intencionesAlAzar(r, NOMBRES, 3)) j.append(60, i)

    let aMano = partida()
    for (let t = 0; t <= 60; t++) {
      aMano = stepWorld(aMano, j.at(t).map((e) => e.intent)).state
    }
    const rehecho = replay(j, { tick: 0, state: partida() }, pasoDelMundo)
    expect(rehecho.tick).toBe(61)
    expect(hashWorldState(rehecho)).toBe(hashWorldState(aMano))
  })

  /**
   * EL CONTROL NEGATIVO DE (d), Y LO QUE SE APRENDIÓ ESCRIBIÉNDOLO.
   *
   * Salió rojo dos veces, y las dos veces por una razón que vale más que el test.
   *
   * **Primera: el hash es del MUNDO y no de su narración.** El control original
   * cambiaba las intenciones del tick 3 por esperas, y no cambiaba nada: en ese
   * tick las seis intenciones sorteadas habían sido todas rechazadas, así que lo
   * único que se movía eran los eventos. Dos partidas con eventos distintos y el
   * mismo estado tienen el mismo `hashWorldState`, y está bien que así sea —el
   * estado es lo que hay que reproducir— pero significa que **un control negativo
   * tiene que perturbar el ESTADO y no la crónica**.
   *
   * **Segunda: qué olvida este mundo y qué no.** La crónica del mundo de juguete
   * encontró que una intención vieja se borra —el calor se disipa, la humedad se
   * topa contra cero— y concluyó que comparar solo el hash final es una prueba
   * débil. Es cierto **para las magnitudes disipativas**. Acá se mide lo otro: una
   * criatura movida sigue movida a los 200 ticks, porque la posición no se disipa.
   * Las dos mitades juntas son la regla útil: un control negativo sobre calor o
   * humedad se apaga solo y hay que mirarlo con checkpoints; uno sobre posición,
   * existencia o inventario se sostiene. Por eso el criterio (a) de este archivo
   * compara los ONCE checkpoints y no el último.
   */
  it('una intención cambiada se nota, y la posición no se olvida', () => {
    const original = correr(partida(), 31, 200, 6, 1000)
    const tocado = createJournal<Intent>()
    for (const e of original.journal.entries()) {
      // El tick 3 entero se reemplaza por «caminá lejos»: perturba la posición,
      // que es lo que el mundo no puede olvidar.
      tocado.append(
        e.tick,
        e.tick === 3
          ? {
              k: 'goTo',
              by: e.intent.by,
              seq: e.intent.seq,
              commitment: 'reversible',
              to: { x: 300, y: 300 },
              within: 0,
            }
          : e.intent,
      )
    }
    // La cadena de hashes SÍ lo ve siempre: es del journal, no del mundo.
    expect(tocado.chain).not.toBe(original.journal.chain)

    const hastaEl = (j: typeof tocado, t: number) =>
      hashWorldState(replay(j, { tick: 0, state: partida() }, pasoDelMundo, { hasta: t }))
    const cuando = [4, 10, 25, 50, 100, 200]
    const seNota = cuando.filter((t) => hastaEl(tocado, t - 1) !== hastaEl(original.journal, t - 1))
    // Se nota en el tick siguiente —si no, el replay no estaría mirando las
    // intenciones— y se sigue notando doscientos ticks después.
    expect(seNota).toEqual(cuando)

    // Y la otra mitad, medida: el mismo tick 3 cambiado por OTRAS INTENCIONES QUE
    // TAMBIÉN SE RECHAZAN no mueve el estado ni un bit, porque esas seis ya venían
    // rechazadas —`no-esta-a-mano`, `rol-no-cumple`, `no-lo-tiene`, `ya-actuo`—.
    // El hash es del mundo, no de la crónica.
    //
    // Acá había una espera —`wait(1)`— y dejó de servir el día que esperar pasó a
    // durar: un `wait` ahora ESCRIBE en el `Actor` (`Actor.esperando`, ADR II-0009
    // y `tests/espera.test.ts`), así que mueve el estado con todo derecho y no es
    // más el no-op que este control necesita. Se cambió por un `take` de un cuerpo
    // que no existe, y las dos condiciones que hay que respetar son las que hacen
    // que el reemplazo sea equivalente y no sólo parecido:
    //
    //   - lo emite EL MISMO actor, así que gasta el mismo turno (`yaActuo`) y la
    //     sexta sigue saliendo `ya-actuo` como salía;
    //   - se DESPACHA y recién ahí se rechaza, igual que las seis originales. Uno
    //     rechazado en el portón —un actor que no existe— no sería lo mismo: en el
    //     tick 3 hay dos criaturas con una espera abierta, y una espera se corta
    //     cuando el actor gasta el turno en otra cosa. La original la cortaba; una
    //     que no llega a despacharse, no.
    const soloEventos = createJournal<Intent>()
    for (const e of original.journal.entries()) {
      soloEventos.append(
        e.tick,
        e.tick === 3
          ? { k: 'take', by: e.intent.by, seq: e.intent.seq, commitment: 'reversible', what: 'no-existe' }
          : e.intent,
      )
    }
    expect(soloEventos.chain).not.toBe(original.journal.chain)
    expect(hastaEl(soloEventos, 3)).toBe(hastaEl(original.journal, 3))
  }, 120_000)

  it('la crónica sobrevive al viaje por JSON y sigue reproduciendo', () => {
    const A2 = correr(partida(), 88, 200, 6, 1000)
    const viaje = JSON.parse(JSON.stringify(A2.journal.toData())) as ReturnType<
      typeof A2.journal.toData
    >
    // `journalFromData` revalida la cadena entera al cargar: una partida que se
    // corrompió en el disco se descubre al abrirla y no en el tick 12 000.
    const rehecho = replay(viaje.entries, { tick: 0, state: partida() }, pasoDelMundo, { hasta: 199 })
    expect(hashWorldState(rehecho)).toBe(hashWorldState(A2.fin))
  }, 60_000)
})

// ─── (c) 5000 cuerpos a menos de 4 ms por tick ───────────────────────────────
//
// Está medido en `tests/banco-el-tick.test.ts`, que es el único archivo del
// paquete que toca el reloj. Se separó a propósito: un banco mezclado con los
// tests de corrección comparte los núcleos con ellos y mide la contención tanto
// como el código.

// ─── El cuarto criterio, y por qué no se puede cerrar desde acá ──────────────

describe('el mismo hash en dos motores de JavaScript — PENDIENTE, y qué falta', () => {
  /**
   * NO SE PUEDE VERIFICAR DESDE NODE. Node trae V8 y nada más; el criterio pide
   * DOS motores, y lo que compara es que V8 (Chrome, Node) y SpiderMonkey
   * (Firefox) —y ojalá JavaScriptCore (Safari)— produzcan el mismo texto de 16
   * hexadecimales para el mismo mundo.
   *
   * Lo que hace falta, en concreto y por orden de trabajo:
   *
   *   1. una página que importe `@anima/world`, arme la partida de este archivo
   *      con la misma semilla, corra los 10 000 ticks e imprima
   *      `hashWorldState(fin)` y `journal.chain`. El banco del Hito 0
   *      (`pnpm ii:navegador`, que ya levanta una página en localhost:5180) es
   *      donde va: la infraestructura existe;
   *   2. abrirla en Chrome y en Firefox y comparar los dos textos contra las
   *      constantes que este archivo clava más abajo;
   *   3. si difieren, bisecar con los checkpoints —que ya existen— hasta el
   *      primer tick que no coincide.
   *
   * Lo que SÍ está verificado desde acá es la precondición, y no es poco: que en
   * el paso del mundo no haya una sola operación cuya precisión ECMAScript no
   * especifique. Eso lo cuida `tests/ataque-determinismo.test.ts` leyendo los
   * DIEZ fuentes del paquete, no tres. Sin esa precondición, el punto 2 sería una
   * lotería; con ella, una diferencia sería un bug con nombre.
   */
  it('la huella del mundo no se movió: las constantes que el navegador tiene que dar', () => {
    // Estos dos textos son el contrato con el otro motor. Si el paquete cambia de
    // forma canónica, este test se cae acá —en Node, en el pase de siempre— y no
    // en el navegador tres semanas después, cuando ya nadie sabe qué se tocó.
    //
    // Y son el mundo INICIAL, no el final de 10 000 ticks, a propósito: un
    // desacuerdo en el tick 0 es un bug de la forma canónica o del hash; uno que
    // aparece recién al final es un bug de la aritmética de las leyes. Poder
    // distinguir los dos casos vale más que un solo número.
    //
    // ─── CUÁL DE LOS CUATRO SE MOVIÓ CON EL ADR II-0009, Y POR QUÉ ──────────
    //
    // Sólo el TERCERO, y tenía que moverse. El tick 0 no lo toca nadie —el mundo
    // inicial se arma igual— y `hashPhysics` tampoco, porque el hambre es una
    // constante de `@anima/world` y no del catálogo. La cadena del journal
    // tampoco: guarda INTENCIONES, y las intenciones son las mismas. El único que
    // se mueve es el estado tras diez ticks, porque en esos diez ticks las
    // criaturas gastaron `1,0 × 10/20` = 0,5 de `stamina` cada una en vez de
    // `0,01 × 10` = 0,1. Que los otros tres NO se muevan es la mitad de la prueba:
    // si se hubieran movido, el cambio no sería el que se declaró.
    //
    //   el tercero, antes del ADR II-0009: ac45c6b97f3cc082
    const s = partida()
    expect(hashWorldState(s)).toMatchInlineSnapshot(`"be714c54e109f8c5"`)
    expect(hashPhysics(s.phys)).toMatchInlineSnapshot(`"37e26e82459ff975"`)
    const tras10 = correr(partida(), 9, 10, 4, 1000)
    expect(hashWorldState(tras10.fin)).toMatchInlineSnapshot(`"74e1a1910bbf5042"`)
    expect(tras10.journal.chain).toMatchInlineSnapshot(`"63fbe8efeeee7f54"`)
  })
})

// ─── Guardas del propio arnés ────────────────────────────────────────────────

describe('el arnés no se engaña solo', () => {
  it('el hash del mundo mira TODO lo que el mundo tiene', () => {
    // Un hash que ignora un campo hace pasar cualquier test de gemelos. Se cambia
    // un campo por vez y se exige que el hash se mueva.
    const base = partida()
    const h = hashWorldState(base)
    expect(hashWorldState({ ...base, tick: base.tick + 1 })).not.toBe(h)
    expect(hashWorldState({ ...base, nextId: base.nextId + 1 })).not.toBe(h)
    const sinUno = new Map(base.bodies)
    sinUno.delete('c0')
    expect(hashWorldState({ ...base, bodies: sinUno })).not.toBe(h)
    const sinActor = new Map(base.actors)
    sinActor.delete('ana')
    expect(hashWorldState({ ...base, actors: sinActor })).not.toBe(h)
    expect(
      hashWorldState({ ...base, cells: new Map([[0, { wet: 1, oxygen: 1, temperature: 15 }]]) }),
    ).not.toBe(h)
    // Y un cuerpo movido una celda, que es el cambio más chico que existe.
    const movido = new Map(base.bodies)
    const c0 = base.bodies.get('c0') as WorldBody
    movido.set('c0', { ...c0, at: { x: c0.at.x + 1, y: c0.at.y } })
    expect(hashWorldState({ ...base, bodies: movido })).not.toBe(h)
  })

  it('y NO mira el orden de inserción de los mapas', () => {
    // La contracara. `mapaDeCuerpos` ordena, pero el hash no puede depender de
    // que alguien se acuerde de llamarlo: se arma un estado con los mapas al
    // revés, a mano, y tiene que dar lo mismo.
    const base = partida()
    const alReves = new Map([...base.bodies].reverse())
    const actoresAlReves = new Map([...base.actors].reverse())
    expect([...alReves.keys()]).not.toEqual([...base.bodies.keys()])
    expect(hashWorldState({ ...base, bodies: alReves, actors: actoresAlReves })).toBe(
      hashWorldState(base),
    )
  })

  it('el paso del mundo NO toca el estado que le dan', () => {
    // El contrato que sostiene al snapshot por delta: una ranura que entró a un
    // delta no se puede mutar nunca más. `stepWorld` es copia-al-escribir, y esto
    // lo verifica sobre 50 ticks de intenciones arbitrarias en vez de confiar.
    let s = partida()
    const r = lcg(2024)
    for (let t = 0; t < 50; t++) {
      const antes = hashWorldState(s)
      const previo = s
      s = stepWorld(s, intencionesAlAzar(r, NOMBRES, 6)).state
      expect(hashWorldState(previo)).toBe(antes)
    }
  })

  it('mapaDeActores y mapaDeCuerpos dejan el orden canónico, venga como venga', () => {
    const as = [actor('zeta'), actor('ana'), actor('mario')]
    expect([...mapaDeActores(as).keys()]).toEqual(['ana', 'mario', 'zeta'])
    expect([...mapaDeActores([...as].reverse()).keys()]).toEqual(['ana', 'mario', 'zeta'])
  })
})
