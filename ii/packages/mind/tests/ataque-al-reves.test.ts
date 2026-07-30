// ═══ EL ATAQUE CON EL LENTE AL REVÉS ════════════════════════════════════════
//
// Los otros archivos de este paquete preguntan «¿lo que la mente hace, lo hace
// bien?». Éste pregunta lo contrario, que es la pregunta que encontró el hallazgo
// más caro del tramo: **¿QUÉ COSAS RAZONABLES NO PUEDE HACER?**
//
// El método es siempre el mismo y no admite atajos: se escribe la conducta que
// una criatura razonable tendría, se la INTENTA de verdad —contra `stepWorld`,
// con el `Ctx` de producción y la mente entera— y se mide qué sale. Un párrafo de
// análisis no vale nada acá; lo que vale es la salida.
//
// ═══ EL HALLAZGO QUE ORDENA TODOS LOS DEMÁS ═════════════════════════════════
//
// **`plan()` sabe emitir SEIS de los diez `Step`, y los cuatro que no emite son
// exactamente las cuatro cosas que le faltan a esta criatura para vivir.**
//
//   emite      ir · sostener · unir · deshilachar · frotar · aplicar
//   NO emite   comer · poner · juntar · explorar
//
// No es un olvido de la regresión: es su forma. `plan()` regresa sobre
// `SCHEMA_INDEX`, y un esquema dice «este PROCESO establece este predicado». Las
// cuatro que faltan no son procesos —no las publica el catálogo, no tienen
// `establishes`, ningún esquema las puede nombrar— así que ninguna cadena hacia
// atrás las puede alcanzar. Y del otro lado del embudo pasa lo mismo: la única
// meta que la mente se fabrica sola es `holding(tag:…)` (`oportunidades.ts`), y
// las tres conductas de fondo de D5 son guarecerse, juntar y deambular.
//
// De ese hueco salen, uno por uno, los seis bloques de abajo:
//
//   `comer`     la criatura pesca y no come. YA ESTÁ MEDIDO en
//               `hito-5-el-criterio.test.ts`; acá se medía la otra mitad: **que
//               tampoco se daba cuenta de que ya pescó**. Con el pescado en la
//               mano, `holding(tag:carnoso)` daba `false`, la meta quedaba puesta
//               para siempre y D4 la volvía a planificar; los 199
//               `aplicar(extraccion)` de la corrida larga no eran gula, era una
//               criatura que no podía tachar nada de la lista.
//               **ESTE ATAQUE GANÓ Y EL BLOQUE 3 ESTÁ DADO VUELTA**: `cumpleCuerpo`
//               contesta los tags desde la vista, la corrida larga tira la caña
//               DOS veces y el `it.fails` que clavaba el hueco se cayó solo. Lo
//               que sigue abierto es lo de al lado: el tag no se pierde al
//               pudrirse, así que el pescado que espera un fuego que no llega
//               cumple la meta barata para siempre.
//   `poner`     no puede soltar nada a propósito, o sea que no puede hacerse un
//               techo — que es la ÚNICA forma que la ley 12 tiene de producir
//               `sheltered`. Medido: 58 intentos de `guarecerse` en 120 ticks y
//               **58 fracasos**, todos con el mismo motivo del mundo: «no hay
//               techo en radio 4 y no me diste con qué hacer uno».
//   `juntar`    no puede querer «un kilo de corteza». La conjunción no se puede
//               escribir y la cantidad no existe en el vocabulario; el `cuantos`
//               de `Step.juntar` es un campo que ningún objetivo puede pedir. Y
//               la mitad que SÍ se escribe —`mass>=1`— sale peor que imposible:
//               **`plan()` la contesta con un plan de cero pasos hasta en un
//               páramo vacío**, porque el cuerpo de la propia criatura pesa 2 kg
//               y `see()` no la excluye. La meta es verdadera antes de nacer.
//   `explorar`  no puede planificar ir a buscar. Deambula a ciegas: en el páramo,
//               los 40 `explorar` de 400 ticks fallan los 40.
//
// ═══ Y EL SEGUNDO, QUE NO ESPERABA ENCONTRAR: LOS BUCLES QUE NO SE VEN ══════
//
// La escalera no se tilda nunca —el contrato lo promete y lo cumple— y eso tapa
// tres bucles distintos en los que **despega una habilidad por tick y no avanza
// un milímetro**. Los tres están medidos abajo:
//
//   1. **el `gap` que se re-ejecuta.** Con un pozo a la vista y sin vara, `plan()`
//      da `gap` y la escalera corre su `nearest` —un solo `ir(pozo)`—. El paso
//      termina BIEN, y al tick siguiente D4 vuelve a dar el mismo `gap` y vuelve a
//      arrancar el mismo paso. **193 vuelos en 200 ticks y CERO fracasos**: todos
//      los contadores dicen que anda bárbaro.
//   2. **la rueda de D5.** `fondoQueFallo` está para que la conducta que acaba de
//      fallar no se re-elija en el acto, y lo que consigue es alternar dos
//      conductas que fallan las dos: **116 vuelos en 120 ticks, 114 fallados**,
//      `guarecerse → juntar → guarecerse → juntar…`
//   3. **el plan que se rehace idéntico.** Cuando lo que el plan nombra lo tiene
//      otro, `@anima/plan` no mira `heldBy` (medido: cero coincidencias en todo
//      `plan/src`) y vuelve a elegir lo mismo. Y no aprende: la mente **no llama
//      a `observe` ni una vez**, así que después de 63 fracasos la criatura sigue
//      informando `n=0` sobre lo mismo que la acaba de fallar.
//
// ═══ LO QUE SALIÓ AL REVÉS DE LO QUE YO ESPERABA, Y VALE MÁS ═══════════════
//
// Dos hipótesis mías se cayeron midiendo, y las dos dejaron un hallazgo mejor:
//
//   · **el libro de lugares SÍ se acuerda del agua** (3 celdas de agua franca
//     después de pescar). Lo que no existe es el otro extremo: `contextoDe` sólo
//     sabe contestar por CUERPOS, así que una celda recordada resuelve a un
//     contexto sin tags y produce CERO oportunidades. El recuerdo llega y se muere
//     en la puerta de al lado.
//   · **la escalera SÍ elige guarecerse** cuando el refugio es lo único que duele.
//     El hueco no es el orden de los peldaños: es que no hay nada del otro lado.
//
// ═══ Y EL TERCERO: EL PRECIO NO HABLA DEL PLAN ══════════════════════════════
//
// `costoEstimado` es lo único que la mente usa para comparar dos cosas que
// querer, y se calcula ANTES de que el plan exista: es la caminata al lugar más
// los segundos del proceso que deja el tag en la mano, y nada más. La prueba no
// admite discusión: **se mueve la vara de 3 celdas a 10 y el presupuesto no se
// mueve ni un bit** (1,6000 las dos veces) mientras el costo real pasa de 2,1500
// a 3,5500. Y del otro lado del mismo hueco, la única aparición de `stamina` en
// toda la mente es `necesidades.laEnergia`, que la convierte en cuánto DUELE y
// nunca en cuánto ALCANZA: con 8 de aliento la criatura elige exactamente la
// misma meta cara que con 310, arranca la cadena de la caña, y se muere en el
// tick 156 con el pescado sacado y sin comer.
//
// Regla de este archivo: **ningún `it.fails` sin la salida medida al lado**, y
// ningún número escrito que no haya salido de una corrida de acá.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it } from 'vitest'

import { qualityOf } from '@anima/physics'
import { COSTO_POR_CELDA, COSTO_VIVIR_POR_SEGUNDO } from '@anima/world'
import type { WorldState } from '@anima/world'
import { Contexto, Partida } from '@anima/perceive'
import { cumple, EXPANSIONES_POR_TICK, interpretar, plan, SCHEMA_INDEX } from '@anima/plan'
import type { GoalNode, Predicado } from '@anima/plan'

import { Creencias } from '../src/creencias.js'
import { Mente } from '../src/mente.js'
import { necesidades } from '../src/necesidades.js'
import { costoEstimado, opportunities } from '../src/oportunidades.js'
import type { Decision, Drive, VistaDeLaMente } from '../src/tipos.js'
import { actor, criatura, cuerpo, enElPiso, laOrilla, mundo, conElla } from './mundo.js'

// ─── EL RESPIRO QUE MANTIENE VIVO AL WORKER DE VITEST ────────────────────────
//
// birpc le pone 60 s de vencimiento al aviso de cada test, y un `for` sincrónico
// largo no deja correr ni el temporizador ni la lectura del socket; cuando suelta
// el hilo, Node corre la fase de temporizadores antes que la de poll y el
// vencimiento gana la carrera aunque la respuesta ya esté en la cola. El síntoma
// es la peor clase de rojo: TODOS los tests en verde y `exit 1` con
// `Timeout calling "onTaskUpdate"`.
//
// Desde que el mundo materializa el decreto (`world/src/step.ts`, `abrirChunk`)
// las corridas de este archivo cuestan diez veces más por tick, así que varias
// cruzan los 60 s. Se arregla con una MACROTAREA de verdad —`setTimeout(…, 0)`;
// un `await` sobre una promesa resuelta es una microtarea y no drena la fase de
// poll— en un `beforeEach` de raíz, que no toca el cuerpo de ningún test ni puede
// mover ninguna medición: corre antes de que el test empiece.
beforeEach(async () => {
  await new Promise((listo) => {
    setTimeout(listo, 0)
  })
})

// ─── El arnés ────────────────────────────────────────────────────────────────

/**
 * «Con hambre y un río a la vista», sobre la orilla DE VERDAD de la semilla.
 *
 * Es la MISMA escena que `hito-5-el-criterio.test.ts`, copiada a propósito y no
 * importada: los `tests/` no se exportan, y lo que se copia es el armado, ni una
 * regla del mundo ni un número de la física. Los dos parámetros son los mismos y
 * por las mismas razones medidas allá (310 de aliento para que la comida gane;
 * 0,2 kg de matorral para que la vara haga falta).
 */
function laEscena(o: { stamina?: number; conVara?: boolean; ladron?: boolean; varaA?: number } = {}): WorldState {
  const or = laOrilla()
  const p = or.parada
  const cuerpos = [
    enElPiso(criatura('ana', o.stamina ?? 310), p),
    enElPiso(cuerpo('matorral', 'liana', 0.2, {}, 'hebra'), { x: p.x - 2, y: p.y + 1 }),
  ]
  if (o.conVara !== false) {
    cuerpos.push(enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: p.x + (o.varaA ?? 3), y: p.y }))
  }
  const actores = [actor('ana', { capacity: 3 })]
  if (o.ladron === true) {
    // Un segundo actor SIN mente, parado al lado, con la vara ya en la mano. Es
    // «alguien se llevó el matorral» del pedido, escrito con lo que el mundo sabe
    // decir: `heldBy`. No hace falta que se la lleve en vivo —el resultado que se
    // mide es qué hace la mente cuando lo que su plan nombra lo tiene otro— y un
    // ladrón que actúa metería un segundo generador en el tick, que es ruido.
    cuerpos.push(enElPiso(criatura('beto', 500), { x: p.x + 3, y: p.y }))
    actores.push(actor('beto', { holding: ['vara'] }))
    const i = cuerpos.findIndex((c) => c.body.id === 'vara')
    const v = cuerpos[i]
    if (v !== undefined) cuerpos[i] = { ...v, heldBy: 'beto' }
  }
  return mundo({ dios: or.dios, bodies: cuerpos, actors: actores })
}

/** La vista de la mente, armada como la arma la mente: con el `Ctx` de producción. */
function vistaDe(p: Partida, quien: string): VistaDeLaMente {
  return new Contexto(p.proyeccion, { actor: quien, rng: p.dado.tirar, lugares: p.lugares }).ctx
}

function aliento(p: Partida, quien: string): number {
  const b = p.state.bodies.get(`${quien}-cuerpo`)
  return b === undefined ? 0 : qualityOf(b.body, 'stamina', p.state.phys)
}

interface Corrida {
  readonly partida: Partida
  readonly mente: Mente
  /** Qué despegó, en orden, sin el tick adelante. */
  readonly nombres: readonly string[]
  /** En qué tick despegó cada uno, en el mismo orden que `nombres`. */
  readonly cuando: readonly number[]
  /** El aliento al final de cada tick de la corrida. Índice = tick de la corrida. */
  readonly alientoPorTick: readonly number[]
  /** Cuántas veces despegó cada cosa. */
  readonly cuenta: ReadonlyMap<string, number>
  /** Cuántos vuelos terminaron mal, y con qué motivo. */
  readonly fracasos: ReadonlyMap<string, number>
  /** El tick en que la criatura se fue de `state.actors`, o `-1`. */
  readonly murioEn: number
  readonly alientoFinal: number
}

/**
 * `n` ticks con UNA mente puesta, anotando tick a tick.
 *
 * El bucle es el de `vivir` con el `for` afuera —pensar todas, después avanzar el
 * mundo— y no una segunda copia con otro orden: si la mente pensara después de
 * que el mundo avanzó, decidiría sobre un tick y actuaría sobre el siguiente.
 */
function correr(w: WorldState, quien: string, n: number, o: { drive?: Drive } = {}): Corrida {
  const p = new Partida(w)
  const m = new Mente(
    o.drive === undefined
      ? { actor: quien, memoria: new Creencias() }
      : { actor: quien, memoria: new Creencias(), drive: o.drive },
  )
  const nombres: string[] = []
  const cuando: number[] = []
  const alientoPorTick: number[] = []
  const cuenta = new Map<string, number>()
  const fracasos = new Map<string, number>()
  let antes = 0
  let murioEn = -1
  let ultimo = ''
  for (let k = 0; k < n; k++) {
    if (p.state.actors.has(quien)) {
      m.pensar(p)
      if (m.despegues > antes) {
        antes = m.despegues
        ultimo = m.ultimoDespegue ?? '?'
        nombres.push(ultimo)
        cuando.push(k)
        cuenta.set(ultimo, (cuenta.get(ultimo) ?? 0) + 1)
      }
    } else if (murioEn < 0) {
      murioEn = p.state.tick
    }
    p.avanzar(1)
    alientoPorTick.push(aliento(p, quien))
    const vu = p.vuelo(quien)
    if (vu !== undefined && vu.terminado) {
      const out = vu.outcome
      if (out !== undefined && !out.ok) {
        const clave = `${ultimo} → ${out.why}`
        fracasos.set(clave, (fracasos.get(clave) ?? 0) + 1)
      }
    }
  }
  if (murioEn < 0 && !p.state.actors.has(quien)) murioEn = p.state.tick
  return {
    partida: p,
    mente: m,
    nombres,
    cuando,
    alientoPorTick,
    cuenta,
    fracasos,
    murioEn,
    alientoFinal: aliento(p, quien),
  }
}

function dos(x: number): string {
  return x.toFixed(2).replace('.', ',')
}

function cuatro(x: number): string {
  return x.toFixed(4).replace('.', ',')
}

/** La familia de un despegue: `ir(vara)` → `ir`. Es la variante de `Step`, no el argumento. */
function familia(nombre: string): string {
  const i = nombre.indexOf('(')
  return i < 0 ? nombre : nombre.slice(0, i)
}

// ═══ 1 · LAS CUATRO CONDUCTAS QUE NINGÚN PLAN PUEDE NOMBRAR ═════════════════

describe('las cuatro que `plan()` no emite', () => {
  /** Las diez variantes de `Step`, en el orden en que las escribe `plan/src/tipos.ts`. */
  const LOS_DIEZ = [
    'ir',
    'juntar',
    'deshilachar',
    'unir',
    'aplicar',
    'comer',
    'frotar',
    'poner',
    'sostener',
    'explorar',
  ] as const

  it('el planificador construye SIETE de los diez pasos, y los tres que faltan son los que hacen falta', () => {
    // El barrido va sobre la FUENTE de la regresión y no sobre una corrida, y es
    // a propósito: una corrida sólo prueba que en ESA escena no salió `comer`.
    // Lo que hay que mostrar es que no puede salir nunca, y eso se ve en que el
    // literal no está escrito en ningún lado del constructor de pasos.
    const fuente = readFileSync(
      fileURLToPath(new URL('../../plan/src/regresion.ts', import.meta.url)),
      'utf8',
    )
    const emite: string[] = []
    const nunca: string[] = []
    for (const k of LOS_DIEZ) {
      // `k: 'x'` es la forma exacta con la que se construye un `Step`; un `case
      // 'x':` de un `switch` que lee pasos ajenos no cuenta, y por eso el patrón
      // lleva los dos puntos y la coma adelante del nombre.
      ;(fuente.includes(`k: '${k}'`) ? emite : nunca).push(k)
    }
    console.log(
      `\n─── LOS DIEZ \`Step\`, Y CUÁLES SABE CONSTRUIR \`plan()\` ───\n` +
        `  emite (${String(emite.length)}):  ${emite.join(' · ')}\n` +
        `  NUNCA (${String(nunca.length)}):  ${nunca.join(' · ')}\n`,
    )
    // SIETE Y NO SEIS desde que el planificador sabe apoyarse en una LEY y no
    // sólo en un proceso (`EsquemaDeLey`): cocinar es la ley 5, y cocinar
    // necesita `poner` —la comida sobre la parrilla, la parrilla sobre el fuego—.
    // O sea que `poner` cruzó de columna, y lo hizo por la razón correcta: apareció
    // una meta que lo necesitaba, no una fila que lo nombrara.
    expect(emite).toEqual(['ir', 'deshilachar', 'unir', 'aplicar', 'frotar', 'poner', 'sostener'])
    // Y las tres que quedan siguen siendo conducta y no plan: juntar, comer y
    // explorar. `comer` es la que ordena a todas las demás y tiene su `it.fails`
    // abajo — con la diferencia de que ahora la mente la emite igual, como
    // `tragar`, porque el bocado lo cierra la escalera y no la regresión.
    expect(nunca).toEqual(['juntar', 'comer', 'explorar'])
  })

  it('y la razón es estructural: un esquema nombra un proceso o una ley, y ninguna de las tres es ninguno', () => {
    // `SCHEMA_INDEX` es de firma a filas, y una fila va por un PROCESO o por una
    // LEY. O sea que todo lo que la regresión puede proponer sale de esas dos
    // columnas: si una conducta no es ninguna de las dos, no hay esquema que la
    // nombre y no hay cadena hacia atrás que la alcance.
    //
    // `poner` es el caso que muestra que la segunda columna no es decorativa: no
    // es un proceso —sigue estando en `noSonProceso`— y aun así el planificador lo
    // emite, porque la ley 5 necesita que la comida esté APOYADA sobre el fuego.
    // Entró por una ley, no por una fila que lo nombrara.
    //
    // `deshilachar` es la prueba del mecanismo por el lado que SÍ funciona: se
    // llama igual que un `Step` porque ES un proceso —está en el catálogo, tiene
    // roles y tiene `establishes`— y por eso el planificador sabe proponerlo.
    // `unir` entra por su nombre de proceso, `union`; `frotar` por `friccion`; y
    // `aplicar` es la variante genérica que envuelve a cualquiera de los cuatro.
    const procesos = new Set<string>()
    // `f.k === 'proceso'`: desde el tramo H la tabla tiene filas que no van por
    // ningún proceso sino por una LEY —cocinar no es un `ProcessId`— y este conteo
    // es sobre los procesos que el índice conoce.
    for (const filas of SCHEMA_INDEX.values()) for (const f of filas) if (f.k === 'proceso') procesos.add(f.via)
    const sonProceso = LOS_DIEZ.filter((k) => procesos.has(k))
    const noSonProceso = (['juntar', 'comer', 'poner', 'explorar'] as const).filter((k) => !procesos.has(k))
    console.log(
      `\n─── LOS PROCESOS QUE EL ÍNDICE CONOCE ───\n` +
        `  ${[...procesos].sort().join(' · ')}\n` +
        `  firmas indexadas: ${String(SCHEMA_INDEX.size)}\n` +
        `  \`Step\` que además es un proceso del catálogo: ${sonProceso.join(' · ')}\n` +
        `  de las cuatro que faltan, cuántas son un proceso: ${String(4 - noSonProceso.length)}\n`,
    )
    expect(sonProceso).toEqual(['deshilachar'])
    // Ninguna de las cuatro. Y no es que les falte una fila en la tabla: no hay
    // proceso que las publique, así que no hay fila que se pueda escribir.
    expect(noSonProceso).toEqual(['juntar', 'comer', 'poner', 'explorar'])
    expect(procesos.size).toBe(4)
  })

  /**
   * EL HUECO, MARCADO Y NO SÓLO DESCRITO — Y NO ES REPARABLE DESDE ESTE PAQUETE.
   *
   * Los dos tests de arriba afirman el estado de hoy, que es lo que hay que
   * afirmar para que no se mueva sin que nadie se entere. Pero afirmar el defecto
   * no lo marca: el día que `plan()` aprenda a emitir `comer`, esos dos se ponen
   * rojos por el motivo EQUIVOCADO —«cambió la tabla»— y quien los mire va a venir
   * a actualizar los literales. Éste se pone rojo por el motivo correcto: porque
   * lo que faltaba ya está.
   *
   * Y es el que ordena a todos los demás. `comer` es el único paso que sube la
   * `stamina`, o sea el único que cierra el bucle de la necesidad. Sin él la
   * criatura se muere de hambre arriba de la comida —antes pescando 199 veces,
   * hoy con UN pescado en la mano esperando un fuego, medido las dos veces en
   * `hito-5-el-criterio.test.ts`— y el criterio (2) del Hito 5 no se puede cumplir
   * por más que la mente decida perfecto: dicho en la moneda del mundo, 20.000
   * ticks son exactamente un tanque de `stamina`, así que el criterio es
   * literalmente «comé al menos una vez».
   *
   * La reparación es de `plan/src/esquemas.ts` + `plan/src/regresion.ts` —un
   * segundo tipo de fila en el índice, afordancias que no son procesos, con su
   * predicado establecido a mano y verificado contra el mundo igual que los ocho
   * de hoy— y es una DECISIÓN sobre el contrato del planificador, no un parche
   * que la mente pueda escribir de este lado.
   */
  it.fails('LO QUE HARÍA FALTA, Y ES DE `@anima/plan`: que la regresión sepa emitir `comer`', () => {
    const fuente = readFileSync(
      fileURLToPath(new URL('../../plan/src/regresion.ts', import.meta.url)),
      'utf8',
    )
    expect(fuente.includes(`k: 'comer'`)).toBe(true)
  })
})

// ═══ 2 · EL FARDO DE CORTEZA: LA MASA Y LA CANTIDAD ═════════════════════════

describe('«quiero un cuerpo de corteza de un kilo»', () => {
  it('la meta no se puede ESCRIBIR: `Predicado` no tiene forma conjuntiva y la cantidad no existe', () => {
    const casos = [
      // Lo que la conducta pide de verdad: una cosa, de una materia, con una masa.
      'holding(tag:vegetal)&mass>=1',
      'mass>=1&holding(tag:vegetal)',
      // La cantidad, en las tres formas en que a alguien se le ocurriría escribirla.
      'count>=3',
      'cuantos>=3',
      'parts>=3',
    ]
    const filas = casos.map((c) => `  ${c.padEnd(30)} → ${JSON.stringify(interpretar(c))}`)
    // Y las dos mitades por separado, para que se vea que lo que falla es la
    // CONJUNCIÓN y no cada cláusula.
    for (const c of ['mass>=1', 'holding(tag:vegetal)']) {
      filas.push(`  ${c.padEnd(30)} → ${JSON.stringify(interpretar(c))}`)
    }
    console.log(`\n─── QUÉ ENTIENDE EL INTÉRPRETE DE LA MENTE ───\n${filas.join('\n')}\n`)
    for (const c of casos) expect(interpretar(c)).toBeUndefined()
    // Las dos solas sí: el vocabulario tiene la masa y tiene el tag, y no tiene
    // la `&`. Está dicho en `plan/src/predicado.ts` («`Predicado` no tiene forma
    // conjuntiva») y `@anima/plan` tiene `goalGraph()` justamente para eso — pero
    // `escalera.planificar` arma UN `GoalNode` con `interpretar(meta)` y no lo
    // llama nunca. La capacidad existe un piso más abajo y la mente no la usa.
    expect(interpretar('mass>=1')).toBeDefined()
    expect(interpretar('holding(tag:vegetal)')).toBeDefined()
  })

  it('y la mitad que SÍ se escribe se da por cumplida mirando cualquier cosa pesada del paisaje', () => {
    // `cumple` de una cualidad barre `see()`: cualquier cuerpo visto con masa ≥ 1
    // la cumple. O sea que «quiero un kilo» es verdadero apenas hay un kilo EN EL
    // MUNDO, esté donde esté y sea de lo que sea. No habla de la mano ni de mí.
    const p = new Partida(laEscena())
    const v = vistaDe(p, 'ana')
    const meta = interpretar('mass>=1')
    expect(meta).toBeDefined()
    if (meta === undefined) return
    const cumplida = cumple(meta, v)
    const vistos = v
      .see([])
      .filter((b) => v.q(b, 'mass') >= 1)
      .map((b) => `${b.name} (${dos(v.q(b, 'mass'))} kg, a ${String(Math.max(Math.abs(b.at.x - v.self.at.x), Math.abs(b.at.y - v.self.at.y)))} celdas)`)
    console.log(
      `\n─── «mass>=1», CONTRA EL MUNDO ───\n` +
        `  en la mano: ${v.self.holding.length === 0 ? '(nada)' : v.self.holding.map((b) => b.name).join(', ')}\n` +
        `  cumple(mass>=1): ${String(cumplida)}\n` +
        `  lo que la hace verdadera: ${vistos.join(' · ')}\n`,
    )
    expect(cumplida).toBe(true)
    expect(v.self.holding).toEqual([])
    // Y el detalle que remata la cosa: **el cuerpo de distancia 0 es ella misma**.
    // `see()` no la excluye, así que «quiero un cuerpo de un kilo» lo cumple su
    // propia carne, que pesa dos. La meta es verdadera antes de nacer.
    expect(v.q(v.self, 'mass')).toBeGreaterThanOrEqual(1)
  })

  it('y el planificador contesta el fardo con un plan de CERO pasos, hasta en un páramo pelado', () => {
    // Una criatura sola en el páramo: ni un cuerpo alrededor, ni un pozo, nada. Y
    // el planificador igual dice que la meta está lista, con un plan vacío y dos
    // expansiones. No es que no encuentre camino —eso sería un `gap`, que es la
    // respuesta honesta y la que el Hito 8 le lee a la fragua—: es que la da por
    // hecha.
    //
    // Lo que la da por hecha es **el cuerpo de la propia criatura**, que pesa 2 kg
    // y que `see()` no excluye. O sea que «quiero un cuerpo de un kilo» es una
    // meta que se cumple sola, en cualquier mundo, incluido uno vacío.
    //
    // Y como `arrancarPlan` no emite planes de cero pasos —«fabricar un `seguir`
    // sobre un plan vacío sería decir que se está haciendo algo»— la orden del
    // cuidador cae a D5 por una TERCERA vía distinta de las otras dos.
    const p = new Partida(conElla([], { stamina: 500 }))
    const v = vistaDe(p, 'ella')
    const meta = interpretar('mass>=1')
    expect(meta).toBeDefined()
    if (meta === undefined) return
    const g: GoalNode = { id: 'meta', goal: meta as Predicado, after: [], porque: 'el fardo de corteza' }
    const r = plan(g, v, EXPANSIONES_POR_TICK)
    const alrededor = v.see([]).map((b) => `${b.name} ${dos(v.q(b, 'mass'))} kg`)
    console.log(
      `\n─── «mass>=1» POR EL PLANIFICADOR, EN UN PÁRAMO ───\n` +
        `  cuerpos a la vista:  ${alrededor.length === 0 ? '(ninguno)' : alrededor.join(' · ')}\n` +
        `  el cuerpo de ella:   ${dos(v.q(v.self, 'mass'))} kg\n` +
        `  respuesta de plan(): ${r.k}${r.k === 'plan' ? ` con ${String(r.steps.length)} pasos, ${String(r.expansiones)} expansiones` : ''}\n` +
        `  filas de \`SCHEMA_INDEX\` que establezcan masa: ${String(SCHEMA_INDEX.get('mass>=1')?.length ?? 0)}\n`,
    )
    // Ningún esquema sabe fabricar masa…
    expect(SCHEMA_INDEX.get('mass>=1')).toBeUndefined()
    // …y sin embargo la respuesta no es «no sé»: es «ya está».
    expect(r.k).toBe('plan')
    if (r.k !== 'plan') return
    expect(r.steps).toEqual([])
  })

  it('así que el cuidador pide el fardo con peso 1 y la criatura se va a pescar, sin decir que no', () => {
    // Las dos formas del pedido, las dos por D2 con peso 1 —el máximo— y desde el
    // tick 0. Ninguna de las dos llega a ser meta:
    //
    //   `mass>=1`                       `tomarMeta` la descarta por «ya la tengo»
    //                                   (ver el test de arriba) y devuelve `undefined`.
    //   `holding(tag:vegetal)&mass>=1`  `planificar` no la puede interpretar, hace
    //                                   `olvidarMeta`, y también devuelve `undefined`.
    //
    // Y las dos veces `decidir` SIGUE BAJANDO, porque el contrato de la escalera
    // dice que nunca se baja del último peldaño sin una intención. O sea que la
    // orden del cuidador no produce ni un rechazo ni un silencio: produce que la
    // criatura se ponga a hacer lo suyo, que es peor que las dos cosas porque
    // desde afuera se ve igual que obedecer mal.
    const filas: string[] = []
    for (const meta of ['mass>=1', 'holding(tag:vegetal)&mass>=1']) {
      const c = correr(laEscena(), 'ana', 12, { drive: { meta, peso: 1, desdeTick: 0 } })
      const d = c.mente.ultima as Decision
      filas.push(
        `  «${meta}»\n` +
          `      peldaño de la última decisión: ${d.por} (${d.k})\n` +
          `      meta que quedó en curso:       ${String(c.mente.estado.metaEnCurso)}\n` +
          `      qué voló:                      ${[...c.cuenta.entries()].map(([k, n]) => `${k}×${String(n)}`).join(' ')}\n` +
          `      en la mano al final:           ${[...(c.partida.state.actors.get('ana')?.holding ?? [])].join(', ') || '(nada)'}`,
      )
      // Lo único que hay que afirmar: la orden NUNCA es la meta. Ni una sola vez,
      // con el peso en el máximo y la orden recién dada.
      expect(c.mente.estado.metaEnCurso).not.toBe(meta)
      expect(d.por).not.toBe('D2')
    }
    console.log(`\n─── LA ORDEN DEL CUIDADOR, DOS VECES ───\n${filas.join('\n')}\n`)
  })
})

// ═══ 3 · LA META QUE NO SE PUEDE DAR POR CUMPLIDA ═══════════════════════════

describe('pescó, y AHORA SÍ se entera', () => {
  it('con el pescado en la mano, `holding(tag:carnoso)` da VERDADERO, y deja de pescar', () => {
    // 200 ticks sobre la escena del documento. La cadena de la caña sale entera
    // —eso ya está medido en el criterio— y lo que se mide acá es lo que pasa
    // DESPUÉS de que el pescado está en la mano.
    const c = correr(laEscena(), 'ana', 200)
    const v = vistaDe(c.partida, 'ana')
    const meta = interpretar('holding(tag:carnoso)')
    expect(meta).toBeDefined()
    if (meta === undefined) return
    const enMano = v.self.holding.map((b) => `${b.name} (calorías ${dos(v.q(b, 'calories'))})`)
    console.log(
      `\n─── DESPUÉS DE PESCAR ───\n` +
        `  en la mano:                    ${enMano.join(' · ') || '(nada)'}\n` +
        `  cumple(holding(tag:carnoso)):  ${String(cumple(meta, v))}\n` +
        `  meta en curso de la escalera:  ${String(c.mente.estado.metaEnCurso)}\n` +
        `  vuelos en 200 ticks:           ${[...c.cuenta.entries()].map(([k, n]) => `${k}×${String(n)}`).join(' ')}\n`,
    )
    // ─── ESTE ATAQUE GANÓ, Y ACÁ QUEDA LA MEDICIÓN DE LOS DOS LADOS ────────
    //
    // Lo que este test afirmaba, palabra por palabra, era `expect(cumple(meta,
    // v)).toBe(false)`: la mano NO estaba vacía y el predicado decía que no tenía
    // nada. Era el hueco que `plan/src/predicado.ts` dejaba escrito —`cumpleCuerpo`
    // del caso `sostiene` con un `return false` literal, porque nadie leía los tags
    // de la sustancia desde la `BodyView`— y estaba pinado acá y con un `it.fails`
    // al lado que decía «LO QUE HARÍA FALTA: que soltar el pescado y volver a
    // agarrarlo cambie algo. No cambia».
    //
    // Hoy `cumple` contesta. El `it.fails` se cayó solo —vitest lo reporta como
    // «Expect test to fail», que es la forma que tiene este repositorio de
    // enterarse de que un hueco se tapó— y las dos aserciones se dieron vuelta.
    expect(v.self.holding.length).toBeGreaterThan(0)
    expect(cumple(meta, v)).toBe(true)

    // ─── Y LO QUE ESO LE HACE A LA CONDUCTA, QUE ES EL PUNTO ───────────────
    //
    // Antes: la meta quedaba puesta para siempre, D4 la volvía a planificar y la
    // criatura repetía la pesca hasta morirse — 199 tiros de caña medidos. Después
    // del tramo del bocado eso lo tapaba la memoria de la escalera
    // (`EstadoDeLaEscalera.conseguido`): la mente se acordaba de que un plan suyo
    // había conseguido la meta.
    //
    // Hoy ni siquiera hace falta esa memoria, y por eso `conseguido` sale
    // **`undefined`**: se llena cuando el ÚLTIMO paso de un plan aterriza bien, y
    // el vuelo que sacó el pescado aterriza con `ok:false` porque la propia mente
    // lo interrumpe en el mismo tick en que la meta se cumple. O sea que el rodeo
    // quedó sin usar en este camino, y lo que gobierna es el predicado.
    expect(c.mente.estado.conseguido).toBeUndefined()
    expect(c.mente.estado.metaEnCurso).toBe('holding(tag:carnoso,toxicity<0.0528)')
    // Y DEJA DE PESCAR: dos tiros de caña en 200 ticks —el primero no pica, el
    // segundo saca el pescado— contra los «más de 5» que este mismo test afirmaba.
    expect(c.cuenta.get('aplicar(extraccion)') ?? 0).toBeLessThan(5)
  })

  it('y el hueco que quedaba abierto es el otro: pudrirse no le saca el tag', () => {
    // El `it.fails` que había acá clavaba el hueco de `cumple`, y se tapó. Lo que
    // este bloque sigue teniendo para atacar es lo que el hueco tapaba: el
    // predicado contesta por TAG, y `carnoso` no se pierde al pudrirse. La criatura
    // se queda con el pescado agarrado y la meta barata cumplida para siempre,
    // mientras la única meta que la salvaría —la que le pone techo a `toxicity`—
    // se aleja sola tick a tick.
    //
    // MEDIDO en 200 ticks: `holding(tag:carnoso)` cumplida con un pescado de
    // toxicity 0,2742, o sea 5,2× por encima del 0,0528 que pide lo comestible.
    const c = correr(laEscena(), 'ana', 200)
    const v = vistaDe(c.partida, 'ana')
    const barata = interpretar('holding(tag:carnoso)')
    const cara = interpretar('holding(tag:carnoso,toxicity<0.0528)')
    expect(barata).toBeDefined()
    expect(cara).toBeDefined()
    if (barata === undefined || cara === undefined) return
    const enMano = v.self.holding[0]
    expect(enMano).toBeDefined()
    if (enMano === undefined) return
    const tox = v.q(enMano, 'toxicity')
    console.log(
      `\n─── LA MITAD QUE EL TAG NO MIRA ───\n` +
        `  en la mano: ${enMano.name} con toxicity ${dos(tox)}\n` +
        `  holding(tag:carnoso) ................. ${String(cumple(barata, v))}\n` +
        `  holding(tag:carnoso,toxicity<0.0528) . ${String(cumple(cara, v))}  ` +
        `(le falta un factor de ${dos(tox / 0.0528)})\n`,
    )
    expect(cumple(barata, v)).toBe(true)
    expect(cumple(cara, v)).toBe(false)
    expect(tox).toBeGreaterThan(0.0528)
  })
})

// ═══ 4 · EL POZO QUE NO RINDE Y LA HERRAMIENTA QUE TIENE OTRO ══════════════

describe('insistir', () => {
  it('cuando lo que su plan nombra lo tiene otro, no aprende nada: reintenta, se rinde, y se cuelga en el fondo', () => {
    // «Alguien se llevó el matorral», dicho con lo que el mundo sabe decir: la
    // vara la tiene `beto` en la mano. `sostener` contesta «lo tiene otro» y
    // falla; `aterrizar(e, false)` tira el plan; D4 replanifica sobre la MISMA
    // vista —y `@anima/plan` no mira `heldBy` en ningún lado, medido: `grep
    // heldBy plan/src/*.ts` da CERO— así que vuelve a elegir la misma vara.
    //
    // Lo que sale medido no es un bucle de tres líneas: es peor y más largo. La
    // criatura reintenta, se aleja explorando, pierde la vara de vista, el plan
    // pasa a ser un `gap` y el resto de la corrida se le va en las conductas de
    // fondo — que fallan TODAS.
    const c = correr(laEscena({ ladron: true }), 'ana', 300)
    const vuelos = c.nombres.length
    let fallados = 0
    for (const n of c.fracasos.values()) fallados += n
    console.log(
      `\n─── LA VARA LA TIENE OTRO, 300 TICKS ───\n` +
        `  vuelos (${String(vuelos)}):  ${[...c.cuenta.entries()].map(([k, n]) => `${k}×${String(n)}`).join(' ')}\n` +
        `  de ésos, terminaron mal: ${String(fallados)} (${dos((100 * fallados) / vuelos)}%)\n` +
        `  ${[...c.fracasos.entries()].map(([k, n]) => `${k} ×${String(n)}`).join('\n  ')}\n` +
        `  meta en curso al final:  ${String(c.mente.estado.metaEnCurso)}\n` +
        `  aliento: 310,00 → ${dos(c.alientoFinal)}\n`,
    )
    // Insiste con lo imposible HASTA EL FINAL DE LA CORRIDA, y eso empeoró con la
    // reparación del tramo G: antes tomaba `holding(tag:vegetal)` —una meta que
    // ningún esquema establece—, se iba a deambular y los 300 ticks se le iban en
    // conductas de fondo (3 intentos de `sostener(vara)`, 67 vuelos, 94% fallados).
    // Ahora que D3 saltea las metas sin vocabulario, la meta que queda es la que
    // SÍ se puede planificar, y el par `ir(vara)` → `sostener(vara)` se repite 149
    // veces sin aprender nada. La mitad exacta de los vuelos termina mal, y la
    // mitad que termina bien es el `ir` que la vuelve a dejar al lado.
    expect(c.cuenta.get('sostener(vara)') ?? 0).toBeGreaterThan(100)
    expect(c.cuenta.get('ir(vara)') ?? 0).toBe(c.cuenta.get('sostener(vara)') ?? 0)
    expect(fallados).toBe(c.cuenta.get('sostener(vara)') ?? 0)
    expect([...c.fracasos.keys()]).toEqual(['sostener(vara) → madera lo tiene otro'])
    // Y la mitad que importa: la creencia con la que eligió la meta NO SE MUEVE.
    // `AffordanceMemory.observe` existe y la mente no lo llama NUNCA (medido:
    // `grep '\.observe(' mind/src` da una sola línea y es la definición, adentro
    // de `creencias.ts`). O sea que después de fallar sesenta veces sigue creyendo
    // exactamente lo mismo que antes de empezar, y con la misma `n`.
    const v = vistaDe(c.partida, 'ana')
    const ops = opportunities(v, new Creencias(), necesidades(v))
    const conEvidencia = ops.filter((o) => !o.porque.includes('n=0'))
    console.log(
      `  lo que cree después de ${String(fallados)} fracasos:\n` +
        ops.map((o) => `      ${o.porque}`).join('\n') +
        `\n  oportunidades con evidencia propia: ${String(conEvidencia.length)}\n`,
    )
    expect(conEvidencia).toEqual([])
  })

  it.fails('LO QUE HARÍA FALTA: que un fracaso repetido baje el valor de la oportunidad. No lo baja', () => {
    // Medido: la mente no le devuelve evidencia a las creencias, así que el valor
    // de la oportunidad al tick 300 es EL MISMO que al tick 0, con cincuenta
    // fracasos en el medio. La aserción de abajo pide que haya bajado.
    const c = correr(laEscena({ ladron: true }), 'ana', 300)
    const v = vistaDe(c.partida, 'ana')
    const memoria = new Creencias()
    const antes = opportunities(vistaDe(new Partida(laEscena({ ladron: true })), 'ana'), memoria, necesidades(v))
    const despues = opportunities(v, memoria, necesidades(v))
    const a = antes[0]
    const d = despues[0]
    expect(a).toBeDefined()
    expect(d).toBeDefined()
    if (a === undefined || d === undefined) return
    expect(d.valor).toBeLessThan(a.valor)
  })
})

// ═══ 5 · GUARECERSE ANTES DE LA NOCHE ══════════════════════════════════════

describe('la noche', () => {
  /** El mundo a `faltan` ticks del anochecer. A 20 Hz el día son 4000 ticks y la luz 2000. */
  function alAnochecer(faltan: number, stamina: number): WorldState {
    return { ...laEscena({ stamina }), tick: 2000 - faltan }
  }

  it('la anticipación del refugio SÍ escala con `dayLength`, y eso anda', () => {
    // Lo primero es el control positivo, porque hay uno: `elRefugio` mide el
    // tiempo transcurrido como FRACCIÓN de la luz del día, así que en segundos
    // absolutos la anticipación crece con el día. Es lo que el pedido pedía y
    // está bien hecho. Lo que no anda es lo que la escalera hace con el número.
    const filas: string[] = []
    for (const faltan of [2000, 1000, 400, 100, 20, 1]) {
      const p = new Partida(alAnochecer(faltan, 1000))
      const v = vistaDe(p, 'ana')
      const n = necesidades(v)
      filas.push(
        `  faltan ${String(v.clock.secondsToNightfall).padStart(4)} s de ${String(v.clock.dayLength)} → refugio ${cuatro(n.refugio)} · energía ${cuatro(n.energia)}`,
      )
    }
    console.log(`\n─── CÓMO SUBE EL REFUGIO CON LA NOCHE ───\n${filas.join('\n')}\n`)
    const cerca = necesidades(vistaDe(new Partida(alAnochecer(20, 1000)), 'ana'))
    const lejos = necesidades(vistaDe(new Partida(alAnochecer(2000, 1000)), 'ana'))
    expect(cerca.refugio).toBeGreaterThan(lejos.refugio)
    expect(cerca.refugio).toBeGreaterThan(0.9)
  })

  it('el refugio no tiene salida: donde D5 corre lo intenta y falla el 100%, y donde no corre ni lo intenta', () => {
    // Tanque LLENO —`energia` vale lo más chico que esta necesidad puede valer— y
    // el anochecer encima: `refugio` es la necesidad que manda por un factor de
    // cientos. Y el hallazgo es que da igual, por dos caminos distintos.
    //
    // ─── DONDE D5 CORRE: lo intenta y no sirve ────────────────────────────────
    //
    // La innata BUSCA un techo en radio 4 y no hay ninguno, así que se rinde en un
    // tick. La otra vía que `guarecerse` tiene —hacerse uno con
    // `put(..., {covering})`— necesita que alguien le pase `conQue`, y la escalera
    // emite la conducta SIN PARÁMETROS (es la decisión de `tipos.ts`: «no llevan
    // parámetros»). O sea que la única necesidad cuya satisfacción es un LUGAR no
    // tiene ni una salida abierta.
    //
    // ─── DONDE D3 TIENE ALGO PLANIFICABLE: lo intenta TARDE, y falla igual ────
    //
    // Este párrafo se reescribió DOS veces y las dos con la corrida al lado, así
    // que quedan las tres lecturas:
    //
    //   · antes del tramo G, en la orilla D3 tomaba `holding(tag:vegetal)` —que
    //     ningún esquema establece—, la búsqueda no daba nada y el tick caía a
    //     D5: 58 intentos de guarecerse, 58 fallos;
    //   · reparado el tramo G, D3 salteaba esa meta, tomaba la que SÍ se puede
    //     planificar y se iba a pescar: CERO intentos en 120 ticks, porque D3
    //     cortaba antes y no soltaba nunca;
    //   · y hoy, cerrado el eslabón A del criterio, **consigue el pescado**
    //     —`aplicar(extraccion)×2` y adentro de los 120 ticks—, el pedido sube a
    //     lo cocido, que no tiene vía, y recién ahí el tick llega a D5: 2
    //     intentos de guarecerse, los 2 fallados.
    //
    // O sea que la reparación no cambió el veredicto, lo hizo VISIBLE por el
    // segundo camino: ahora las dos escenas llegan a D5 y las dos terminan con
    // `sheltered` en cero. El refugio sigue sin tener una sola salida abierta, y
    // ya no hay forma de leer el cero de la orilla como «no le hizo falta».
    const p = new Partida(alAnochecer(20, 1000))
    const v0 = vistaDe(p, 'ana')
    const n = necesidades(v0)
    const ops = opportunities(v0, new Creencias(), n)
    // El páramo de noche: sin oportunidades, D5 gobierna y `guarecerse` sale.
    const enElParamo = correr({ ...conElla([], { stamina: 1000 }), tick: 2000 - 20 }, 'ella', 120)
    const intentos = enElParamo.cuenta.get('guarecerse') ?? 0
    let fallosDeTecho = 0
    for (const [k, x] of enElParamo.fracasos) if (k.startsWith('guarecerse')) fallosDeTecho += x
    // La orilla de noche: D3 tiene con qué, lo consigue, y RECIÉN AHÍ el refugio
    // llega a decidirse.
    const enLaOrilla = correr(alAnochecer(20, 1000), 'ana', 120)
    const enLaOrillaIntentos = enLaOrilla.cuenta.get('guarecerse') ?? 0
    let enLaOrillaFallos = 0
    for (const [k, x] of enLaOrilla.fracasos) if (k.startsWith('guarecerse')) enLaOrillaFallos += x
    const v = vistaDe(enLaOrilla.partida, 'ana')
    console.log(
      `\n─── LA NOCHE ENCIMA Y EL TANQUE LLENO, 120 TICKS ───\n` +
        `  necesidades:  refugio ${cuatro(n.refugio)} · energía ${cuatro(n.energia)} · calor ${cuatro(n.calor)}\n` +
        `  refugio / energía: ${n.energia === 0 ? 'la energía es CERO EXACTO (tanque lleno): el refugio manda solo' : `${dos(n.refugio / n.energia)}×`}\n` +
        `  oportunidades que igual aparecen (${String(ops.length)}):\n` +
        ops.map((o) => `      valor ${cuatro(o.valor)}  ${o.meta}  ${o.porque}`).join('\n') +
        `\n  EN EL PÁRAMO (D5 gobierna):\n` +
        `      vuelos:  ${[...enElParamo.cuenta.entries()].map(([k, x]) => `${k}×${String(x)}`).join(' ')}\n` +
        `      intentos de guarecerse: ${String(intentos)} · fallados: ${String(fallosDeTecho)}\n` +
        `      ${[...enElParamo.fracasos.entries()].map(([k, x]) => `${k} ×${String(x)}`).join('\n      ')}\n` +
        `  EN LA ORILLA (D3 tiene con qué, lo consigue, y después cae a D5):\n` +
        `      vuelos:  ${[...enLaOrilla.cuenta.entries()].map(([k, x]) => `${k}×${String(x)}`).join(' ')}\n` +
        `      intentos de guarecerse: ${String(enLaOrillaIntentos)} · fallados: ${String(enLaOrillaFallos)}\n` +
        `  sheltered de la celda al final (orilla): ${cuatro(v.qAt(v.self.at, 'sheltered'))}\n`,
    )
    expect(n.refugio).toBeGreaterThan(0.9)
    // Con el tanque lleno la energía es CERO EXACTO —`falta²` con `falta = 0`—,
    // o sea que el refugio es lo único que duele y lo es sin competencia.
    expect(n.energia).toBe(0)
    // Donde lo intenta: no lo consigue NI UNA VEZ en 120 ticks.
    expect(intentos).toBeGreaterThan(0)
    expect(fallosDeTecho).toBe(intentos)
    // ─── Y EN LA ORILLA, EL CERO CAMBIÓ DE MOTIVO POR TERCERA VEZ ───────────
    //
    // Los tres motivos, en orden, porque el título del test cubre los dos extremos
    // y lo que se movió es cuál de los dos aplica acá:
    //
    //   (1) antes de que la pesca cerrara: no llegaba a D5 porque se pasaba la
    //       corrida pescando de nuevo. Cero intentos;
    //   (2) con la pesca cerrada: llegaba a D5 —el pedido subía a lo cocido y ahí no
    //       había vía— y `guarecerse` fallaba el 100%. Intentos > 0, fallos = 100%;
    //   (3) con el mundo materializando el decreto (tramo K): **vuelve a ser CERO**,
    //       y por un motivo nuevo. Con cien cuerpos a la vista D4 —la búsqueda
    //       anytime— siempre tiene algo que planificar y no le suelta el turno a
    //       D5. Medido en `la-mente.test.ts`: `D5: 0` en 2000 ticks.
    //
    // El veredicto no se movió y es el que el test existe para sostener:
    // **`sheltered` termina en cero por los dos caminos**. Donde D5 corre, lo
    // intenta y falla el 100% (el páramo, arriba); donde no corre, ni lo intenta.
    // El refugio sigue sin una sola salida abierta.
    expect(enLaOrillaFallos).toBe(enLaOrillaIntentos)
    expect(v.qAt(v.self.at, 'sheltered')).toBe(0)
  })

  it('y aunque llegara a D5, el refugio no tiene ninguna salida que la mente sepa querer', () => {
    // La otra punta del mismo hueco, y es más profunda que el orden de la
    // escalera: `sheltered` es una cualidad DE CELDA y la única forma que la
    // ley 12 tiene de producirla es un cuerpo COLOCADO encima. Colocar es
    // `Step.poner`, y `plan()` no lo emite nunca (bloque 1). O sea:
    //
    //   · ninguna oportunidad puede pedir refugio — `promesaDeTag` devuelve 0 en
    //     esa coordenada para los siete tags, y está escrito allá con su porqué;
    //   · ningún plan puede fabricar un techo;
    //   · lo único que queda es la conducta de fondo `guarecerse`, que BUSCA uno
    //     que ya exista y se rinde en un tick si no lo encuentra.
    const p = new Partida(alAnochecer(20, 1000))
    const v = vistaDe(p, 'ana')
    const g = interpretar('sheltered>=0.5')
    // Y ni siquiera se puede pedir como meta: `sheltered` es cualidad de CELDA y
    // no de cuerpo, así que no está en el catálogo que el intérprete consulta.
    console.log(
      `\n─── ¿SE PUEDE QUERER UN TECHO? ───\n` +
        `  interpretar('sheltered>=0.5'):        ${JSON.stringify(g)}\n` +
        `  esquemas que establezcan un techo:    ${String(SCHEMA_INDEX.get('sheltered>=0.5')?.length ?? 0)}\n` +
        `  sheltered de la celda donde está:     ${cuatro(v.qAt(v.self.at, 'sheltered'))}\n`,
    )
    expect(g).toBeUndefined()
    expect(SCHEMA_INDEX.get('sheltered>=0.5')).toBeUndefined()
  })
})

// ═══ 6 · VOLVER A DONDE YA PESCÓ ═══════════════════════════════════════════

describe('la memoria del lugar', () => {
  it('SÍ se acuerda del agua, y no puede hacer nada con el recuerdo: una celda recordada no rinde nada', () => {
    // Ésta es la que salió al revés de lo que yo esperaba, y por eso vale más: el
    // libro de lugares SÍ anota celdas de agua franca. La costura de `recall` está
    // hecha y `oportunidades.ts` ya la consulta (`aguaRecordada`).
    //
    // Lo que está roto es el otro extremo: `contextoDe` **sólo sabe contestar por
    // CUERPOS**. Recorre `see([])` buscando el id y, si no lo encuentra, devuelve
    // el contexto sin tags. Una clave `celda:x,y` no es el id de ningún cuerpo, así
    // que el agua recordada resuelve a un contexto vacío y no produce NI UNA
    // oportunidad. El recuerdo llega y muere en la puerta de al lado.
    const c = correr(laEscena(), 'ana', 200)
    const v = vistaDe(c.partida, 'ana')
    const mojados = v.recall([{ q: 'wet', op: '>=', v: 0.9 }])
    const ops = opportunities(v, new Creencias(), necesidades(v))
    const deCelda = ops.filter((o) => o.id.startsWith('celda:'))
    console.log(
      `\n─── QUÉ SE ACUERDA DESPUÉS DE PESCAR ───\n` +
        `  celdas anotadas por el libro:     ${String(c.partida.lugares.cuantos('ana'))}\n` +
        `  de ésas, con agua franca:         ${String(mojados.length)} → ${mojados.map((r) => `(${String(r.at.x)},${String(r.at.y)})`).join(' ')}\n` +
        `  oportunidades en total:           ${String(ops.length)}\n` +
        `  de ésas, apoyadas en una celda:   ${String(deCelda.length)}\n` +
        ops.map((o) => `      ${o.id.padEnd(34)} ${o.porque}`).join('\n') +
        '\n',
    )
    // El agua está recordada…
    expect(mojados.length).toBeGreaterThan(0)
    // …y no hay una sola oportunidad que salga de ella.
    expect(deCelda).toEqual([])
  })

  it('y sin la vara al lado, el pozo que ve la deja dando vueltas: un ciclo de tres, 63 vuelos en 200 ticks', () => {
    // Esta escena la armé para medir otra cosa —una criatura lejos de todo pozo—
    // y la semilla tenía un segundo pozo a la vista. Lo que salió es peor y es
    // nuevo, así que se queda medido acá.
    //
    // ─── EL `gap` SE RE-EJECUTA UNA VEZ POR TICK, PARA SIEMPRE ────────────────
    //
    // Hay pozo y no hay vara, así que `plan()` no puede llegar a `reach>=2` y
    // devuelve `gap`. La escalera hace lo que su encabezado promete —«el `gap` no
    // es un error: se ejecuta `nearest` y se sigue viviendo»— y `nearest` es un
    // solo paso: `ir(pozo)`. La criatura camina hasta el pozo, el paso termina
    // BIEN, y entonces:
    //
    //   · D1 no tiene nada volando ni nada pendiente → sigue bajando;
    //   · D3 ve que la mejor oportunidad ES la meta en curso → no cambia nada;
    //   · D4 replanifica, vuelve a dar el mismo `gap`, y vuelve a arrancar el
    //     mismo `nearest`.
    //
    // ─── LA FORMA DEL BUCLE CAMBIÓ, Y EL BUCLE NO ──────────────────────────
    //
    // MEDIDO ANTES, con el piso vacío: **193 vuelos de `ir(pozo)` en 200 ticks y
    // CERO fracasos**, un despegue por tick para caminar cero celdas. Eso era lo
    // que lo hacía difícil de ver desde afuera: todos los contadores decían que
    // andaba bárbaro.
    //
    // MEDIDO AHORA, con el mundo materializando el decreto (tramo K): el piso tiene
    // hoja, liana y molusco, así que hay cinco oportunidades en vez de una y el
    // bucle pasa a ser un CICLO DE TRES, repetido veintiún veces:
    //
    //     ir(pozo:-4:-6)×21 → aplicar(extraccion)×21 → ir(suelta:-4:-7:6)×21
    //     de 64 vuelos, terminaron mal 21   (los 21 `aplicar`)
    //
    // O sea que el mundo lleno **no la sacó del bucle: le cambió el largo**, y de
    // paso lo hizo un poco más visible —ahora un tercio de los vuelos falla, donde
    // antes no fallaba ninguno—. El hueco que este test sostiene sigue abierto: la
    // escalera vuelve a arrancar el mismo `nearest` mientras el `gap` no se mueva.
    const or = laOrilla()
    const lejos = { x: or.parada.x + 40, y: or.parada.y }
    const w = mundo({
      dios: or.dios,
      bodies: [enElPiso(criatura('ana', 310), lejos)],
      actors: [actor('ana')],
    })
    const p = new Partida(w)
    const v = vistaDe(p, 'ana')
    const ops = opportunities(v, new Creencias(), necesidades(v))
    const c = correr(w, 'ana', 200)
    const d = c.mente.ultima as Decision
    let fallados = 0
    for (const x of c.fracasos.values()) fallados += x
    const repetido = [...c.cuenta.entries()].sort((a, b) => b[1] - a[1])[0]
    console.log(
      `\n─── UN POZO A LA VISTA Y NINGUNA VARA, 200 TICKS ───\n` +
        `  energía:        ${cuatro(necesidades(v).energia)}\n` +
        `  oportunidades:  ${String(ops.length)}\n` +
        ops.map((o) => `      ${o.id.padEnd(30)} valor ${cuatro(o.valor)}  ${o.porque}`).join('\n') +
        `\n  decide:         ${d.por} · ${d.k}\n      ${d.porque}\n` +
        `  vuela:          ${[...c.cuenta.entries()].map(([k, n]) => `${k}×${String(n)}`).join(' ')}\n` +
        `  de ${String(c.nombres.length)} vuelos, terminaron mal ${String(fallados)}\n`,
    )
    // Ninguna oportunidad sale de una celda recordada: todas son de lo que tiene
    // delante de los ojos (ver el test de arriba).
    expect(ops.every((o) => !o.id.startsWith('celda:'))).toBe(true)
    // Y el bucle: el paso más repetido sigue siendo un `ir`, y se repite decenas de
    // veces en 200 ticks. El número exacto ya no se clava —depende de cuántas
    // sueltas le tocaron alrededor, que es cosa de la semilla y no de la mente— y
    // lo que se afirma es la FORMA: un ciclo corto que se repite y no llega a nada.
    expect(repetido).toBeDefined()
    if (repetido === undefined) return
    expect(repetido[0].startsWith('ir(')).toBe(true)
    expect(repetido[1]).toBeGreaterThan(15)
    // Los vuelos que fallan son los `aplicar(extraccion)` sin vara, y son
    // exactamente los que el bucle repite. Cero ya no: el ciclo nuevo sí falla.
    expect(fallados).toBeGreaterThan(0)
    expect(c.nombres.length - fallados).toBeGreaterThan(fallados)
  })
})

// ═══ 7 · EL BUCLE DE FONDO: DOS CONDUCTAS IMPOSIBLES, ALTERNADAS ═══════════

describe('la rueda de D5', () => {
  /**
   * ESTE BLOQUE MIDE UNA REPARACIÓN, Y ARRANCA CON LO QUE MEDÍA ANTES.
   *
   * Lo que este archivo encontró: `fondoQueFallo` era UN índice y `elFondo`
   * corría el puntero UNO cuando la elegida fallaba. Con `refugio` arriba —que es
   * lo normal desde media tarde hasta el amanecer— el índice que la necesidad
   * elegía era siempre 0, así que el puntero rebotaba 0 → 1 → 0 → 1 y `explorar`,
   * la única de las tres que camina y la única que dura más de un tick, NO SALÍA
   * NUNCA. Medido entonces, en la escena de la noche: **116 vuelos en 120 ticks,
   * casi uno por tick, y 114 de los 116 terminaron mal.**
   *
   * La reparación fue que lo que se recuerda deje de ser «cuál falló» y pase a ser
   * «cuáles fallaron desde el último éxito»: tres bits en vez de un índice. Lo que
   * sigue mide que la rueda ahora da la vuelta entera, en el páramo, que es donde
   * D5 de verdad gobierna la vida.
   */
  it('la rueda da la vuelta entera: las dos que se rinden en un tick le dejan el turno a `explorar`', () => {
    // El páramo de noche: no hay techo, no hay nada que juntar y no hay ninguna
    // oportunidad, así que las seis decisiones caen en D5 o en el D1 que sigue lo
    // que D5 puso a volar. Es el peor caso de la rueda y por eso es el que se mide.
    const w = { ...conElla([], { stamina: 500 }), tick: 1980 }
    const c = correr(w, 'ella', 120)
    let fallados = 0
    for (const x of c.fracasos.values()) fallados += x
    console.log(
      `\n─── LA RUEDA DE D5 EN EL PÁRAMO DE NOCHE, 120 TICKS ───\n` +
        `  vuelos: ${String(c.nombres.length)} en 120 ticks (${dos(c.nombres.length / 120)} por tick)\n` +
        `  ${[...c.cuenta.entries()].map(([k, x]) => `${k}×${String(x)}`).join(' · ')}\n` +
        `  terminaron mal: ${String(fallados)} (${dos((100 * fallados) / c.nombres.length)}%)\n` +
        `  ${[...c.fracasos.entries()].map(([k, x]) => `${k} ×${String(x)}`).join('\n  ')}\n` +
        `  los primeros nueve, en orden: ${c.nombres.slice(0, 9).join(' → ')}\n`,
    )

    // LO QUE REPARA: `explorar` sale, y sale una de cada tres vueltas.
    const explora = c.cuenta.get('explorar(8t)') ?? 0
    expect(explora).toBeGreaterThan(0)
    // Las tres salen, y ninguna se lleva más de la mitad de los despegues.
    for (const k of ['guarecerse', 'juntar×1', 'explorar(8t)']) {
      expect(c.cuenta.get(k) ?? 0, k).toBeGreaterThan(0)
      expect(c.cuenta.get(k) ?? 0, k).toBeLessThan(c.nombres.length)
    }
    // Y el despegue por tick se cae: `explorar` dura ocho ticks, así que ocho de
    // cada diez los cubre D1 sin decidir ni traducir ni arrancar nada.
    expect(c.nombres.length / 120).toBeLessThan(0.4)

    // LO QUE NO REPARA, Y HAY QUE DECIRLO: las tres siguen terminando mal. En un
    // mundo sin techo y sin nada que juntar, `guarecerse` y `juntar` no tienen
    // ninguna salida, y `explorar` no encuentra porque no hay. La rueda gira; el
    // páramo sigue siendo un páramo.
    //
    // No es `toBe(c.nombres.length)` por una cuestión de CONTABILIDAD y no de
    // conducta: `correr` mira el vuelo vigente al final de cada tick, así que el
    // que sigue en el aire cuando la corrida se corta todavía no falló, y uno que
    // termina en el mismo tick en que despega el siguiente ya no está para mirar.
    // Son a lo sumo dos de treinta y pico; el resto falla, uno por uno.
    expect(c.nombres.length - fallados).toBeLessThanOrEqual(2)
    expect(fallados).toBeGreaterThan(0)
  })
})

// ═══ 7 · NO HACER NADA, QUE A VECES ES LO CORRECTO ═════════════════════════

describe('esperar', () => {
  it('la mente no puede elegir esperar: en el páramo deambula, y deambular cuesta el doble que estar viva', () => {
    // `esperar` es una de las quince innatas y la mente no la emite nunca —está
    // dicho en `mente.ts`—: D5 deambula porque deambular «es lo único que no le
    // pide NADA al mundo». Pero deambular no es gratis, y acá está el número.
    //
    // El mundo cobra dos cosas por tick: `COSTO_VIVIR_POR_SEGUNDO / hz` por
    // existir, y `COSTO_POR_CELDA` por cada celda entrada. Quedarse quieta paga
    // la primera; caminar paga las dos.
    const hz = 20
    const vivir = COSTO_VIVIR_POR_SEGUNDO / hz
    const caminar = COSTO_POR_CELDA
    const n = 400
    const c = correr(conElla([], { stamina: 500 }), 'ella', n)
    const gastado = 500 - c.alientoFinal
    const porTick = gastado / n
    let fallados = 0
    for (const x of c.fracasos.values()) fallados += x
    console.log(
      `\n─── 400 TICKS EN EL PÁRAMO ───\n` +
        `  vuelos (${String(c.nombres.length)}):  ${[...c.cuenta.entries()].map(([k, x]) => `${k}×${String(x)}`).join(' ')}\n` +
        `  de ésos, terminaron mal:   ${String(fallados)}\n` +
        `  ${[...c.fracasos.entries()].map(([k, x]) => `${k} ×${String(x)}`).join('\n  ')}\n` +
        `  aliento gastado:           ${dos(gastado)} en ${String(n)} ticks → ${cuatro(porTick)} por tick\n` +
        `  el piso de estar viva:     ${cuatro(vivir)} por tick\n` +
        `  lo que agrega caminar:     ${cuatro(caminar)} por celda\n` +
        `  la cuenta contra el piso:  ${dos(porTick / vivir)}×\n` +
        `  ticks de vida a este ritmo: ${String(Math.floor(500 / porTick))} · quedándose quieta: ${String(Math.floor(500 / vivir))}\n`,
    )
    // Deambular cuesta claramente más que estar viva, y la diferencia es la mitad
    // de la vida de la criatura: a este ritmo el tanque le dura la mitad de lo que
    // le duraría quieta. `COSTO_POR_CELDA` y `COSTO_VIVIR_POR_SEGUNDO / hz` valen
    // exactamente lo mismo a la frecuencia de referencia, así que el techo del
    // sobreprecio es 2× y se alcanza caminando todos los ticks.
    expect(porTick).toBeGreaterThan(vivir * 1.4)
    expect(porTick).toBeLessThanOrEqual(vivir + caminar)
    // Y ni un solo vuelo es una espera: las tres conductas de fondo son las únicas
    // que la escalera sabe emitir cuando no hay nada que hacer, y ninguna de las
    // tres es «quedate quieta».
    expect([...c.cuenta.keys()].some((k) => familia(k) === 'esperar')).toBe(false)
  })
})

// ═══ 8 · EL PUNTO DE NO RETORNO ════════════════════════════════════════════

describe('lo que cuesta contra lo que queda', () => {
  it('nada en la mente compara el precio de un plan con el aliento que le queda', () => {
    // `costoEstimado` cotiza DOS cosas: la caminata hasta el lugar y los segundos
    // del proceso que deja el tag en la mano. Y nada más. El plan que D4 va a
    // producir —ir a la vara, agarrarla, ir al matorral, agarrarlo, atar, ir al
    // pozo— no entra en el precio, porque el precio se calcula ANTES de que
    // exista el plan.
    //
    // Acá se mide la diferencia entre lo que la mente creía que costaba llegar al
    // pescado y lo que le costó de verdad.
    const w = laEscena()
    const p0 = new Partida(w)
    const v0 = vistaDe(p0, 'ana')
    const ops = opportunities(v0, new Creencias(), necesidades(v0))
    const mejor = ops[0]
    expect(mejor).toBeDefined()
    if (mejor === undefined) return
    const presupuestado = costoEstimado(v0, mejor.id)

    // Y ahora lo que costó DE VERDAD, cortando en el tick exacto en que el
    // segundo `aplicar(extraccion)` despega —o sea cuando el primer pescado ya
    // está en la mano— y no al final de la corrida: los 200 ticks incluyen vivir
    // sin hacer nada, y cobrar eso contra el presupuesto sería hacer trampa a
    // favor de la conclusión.
    const c = correr(w, 'ana', 200)
    const i = c.nombres.indexOf('aplicar(extraccion)')
    expect(i).toBeGreaterThanOrEqual(0)
    const tickDelPescado = c.cuando[i] ?? 0
    const alPescar = c.alientoPorTick[tickDelPescado + 2] ?? c.alientoFinal
    const gastadoReal = 310 - alPescar
    console.log(
      `\n─── LO QUE CREÍA QUE COSTABA, Y LO QUE COSTÓ ───\n` +
        `  la meta:        ${mejor.meta}\n` +
        `  presupuestado:  ${cuatro(presupuestado)} de aliento (la caminata al pozo + los segundos del proceso)\n` +
        `  la cadena que hubo que hacer, y que el presupuesto no mira:\n` +
        `      ${c.nombres
          .slice(0, i + 1)
          .map((x, j) => `${String(c.cuando[j] ?? 0)}:${x}`)
          .join(' → ')}\n` +
        `  gastado hasta tener el pescado (tick ${String(tickDelPescado + 2)}): ${cuatro(gastadoReal)}\n` +
        `  subestimación: ${dos(gastadoReal / presupuestado)}×\n`,
    )
    // El presupuesto cotiza la caminata al pozo y el proceso, y NADA de la cadena
    // de la caña. No es una diferencia de afinado: es que el número se calcula
    // antes de que el plan exista, así que no puede hablar de él.
    expect(presupuestado).toBeLessThan(gastadoReal)

    // ─── LA PRUEBA DE QUE EL PRECIO ES CIEGO AL PLAN ─────────────────────────
    //
    // Y acá está sin discusión posible: **se mueve la vara y el precio no se
    // mueve**. Con la vara a 3 celdas y con la vara a 10 la criatura tiene que
    // caminar catorce celdas más, y `costoEstimado` contesta EXACTAMENTE el mismo
    // número, porque sólo mide la distancia al pozo y los segundos de
    // `extraccion`. El plan que va a haber que hacer no entra en la cuenta.
    const lejos = laEscena({ varaA: 10 })
    const vLejos = vistaDe(new Partida(lejos), 'ana')
    const opsLejos = opportunities(vLejos, new Creencias(), necesidades(vLejos))
    const mejorLejos = opsLejos[0]
    expect(mejorLejos).toBeDefined()
    if (mejorLejos === undefined) return
    const presupuestoLejos = costoEstimado(vLejos, mejorLejos.id)
    const cLejos = correr(lejos, 'ana', 200)
    const iLejos = cLejos.nombres.indexOf('aplicar(extraccion)')
    const tickLejos = cLejos.cuando[iLejos] ?? 0
    const realLejos = 310 - (cLejos.alientoPorTick[tickLejos + 2] ?? cLejos.alientoFinal)
    console.log(
      `─── LA MISMA CUENTA CON LA VARA MÁS LEJOS ───\n` +
        `  vara a  3 celdas → presupuesto ${cuatro(presupuestado)} · real ${cuatro(gastadoReal)} · pescado en el tick ${String(tickDelPescado)}\n` +
        `  vara a 10 celdas → presupuesto ${cuatro(presupuestoLejos)} · real ${cuatro(realLejos)} · pescado en el tick ${String(tickLejos)}\n` +
        `  el presupuesto se movió: ${cuatro(presupuestoLejos - presupuestado)}\n` +
        `  el costo real se movió:  ${cuatro(realLejos - gastadoReal)}\n`,
    )
    // El presupuesto es el mismo bit por bit.
    expect(presupuestoLejos).toBe(presupuestado)
    // Y lo que costó de verdad, no.
    expect(realLejos).toBeGreaterThan(gastadoReal)
  })

  it('y con el tanque casi vacío toma la misma meta cara que con el tanque medio, sin mirar si llega', () => {
    // El mismo paisaje, dos criaturas: una con 310 de aliento y otra con 8. La de
    // 8 tiene 160 ticks de vida por delante (a 0,05 por tick sin caminar) y la
    // cadena de la caña le come casi todos. Una criatura razonable elegiría lo más
    // barato que tenga cerca, o se quedaría quieta.
    //
    // Las dos eligen exactamente lo mismo, porque la única aparición de `stamina`
    // en toda la mente es `necesidades.laEnergia`, que la convierte en cuánto
    // DUELE — nunca en cuánto ALCANZA.
    const filas: string[] = []
    const metas: string[] = []
    for (const stamina of [310, 8]) {
      const p = new Partida(laEscena({ stamina }))
      const v = vistaDe(p, 'ana')
      const n = necesidades(v)
      const ops = opportunities(v, new Creencias(), n)
      const mejor = ops[0]
      const c = correr(laEscena({ stamina }), 'ana', 400)
      metas.push(mejor?.meta ?? '(ninguna)')
      filas.push(
        `  aliento ${String(stamina).padStart(3)} → energía ${cuatro(n.energia)} · elige «${mejor?.meta ?? '—'}» ` +
          `(valor ${cuatro(mejor?.valor ?? 0)}, costo estimado ${cuatro(costoEstimado(v, mejor?.id ?? ''))})\n` +
          `                 murió en el tick ${String(c.murioEn)}${c.murioEn < 0 ? ' (llegó viva)' : ''}, ` +
          `con ${String(c.nombres.length)} vuelos: ${c.nombres.slice(0, 8).join(' → ')}`,
      )
    }
    console.log(`\n─── LA MISMA META CON EL TANQUE LLENO Y CON EL TANQUE EN RESERVA ───\n${filas.join('\n')}\n`)
    expect(metas[0]).toBe(metas[1])
  })
})
