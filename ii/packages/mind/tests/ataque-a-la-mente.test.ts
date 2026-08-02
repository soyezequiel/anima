// ─── EL ATAQUE A LA MENTE — tramo G del Hito 5, del lado del adversario ──────
//
//   pnpm --filter @anima/mind test tests/ataque-a-la-mente.test.ts
//
// Los otros ocho archivos del paquete prueban que la mente HACE lo que promete.
// Éste busca lo contrario: qué hace y NO debería. La regla de la casa vale acá
// más que en ningún lado — **un hallazgo sin la salida real de un test que lo
// demuestre no es un hallazgo**— así que cada sección imprime la corrida que la
// sostiene y ningún número de este archivo está estimado.
//
// ─── ESTE ARCHIVO YA NO SÓLO DEMUESTRA: MIDE UNA REPARACIÓN ─────────────────
//
// Lo escribió el adversario contra la mente rota y todos sus hallazgos se
// reprodujeron. Después se repararon los cinco, y en vez de borrar los tests se
// les dio vuelta la aserción: **cada sección conserva en su comentario la corrida
// que medía ANTES y afirma la de ahora**. Los tres `it.fails` que decían «lo que
// se querría» pasaron a ser `it` a secas, que era exactamente lo que su propio
// comentario pedía («el día que se repare, este archivo se pone rojo y hay que
// venir a borrarlo» — se vino, y se los dejó verdes en vez de borrarlos: es lo
// único que hace que la reparación no se pueda deshacer sin que nada se ponga
// rojo).
//
// Lo que NO se reparó queda marcado como tal, con el porqué medido: son las
// mitades que viven en otro paquete.
//
// ─── LO QUE SE ENCONTRÓ, Y QUÉ PASÓ CON CADA COSA ──────────────────────────
//
//   §1  LA META QUE EL PLANIFICADOR RECHAZA SE SOSTENÍA PARA SIEMPRE. `plan()`
//       contesta `gap` con `nearest` vacío y con el motivo «ningún esquema
//       conocido establece holding(tag:vegetal)» — a presupuesto 64 y a
//       presupuesto 4000, o sea que NO era «hoy no se puede», era «no se puede».
//       `planificar` decidía a propósito no tirar la meta, y la criatura se
//       quedaba **12.000 ticks de 20.000** pegada a esa meta con el pozo a UNA
//       celda.  → REPARADO (decisión 7 de `escalera.ts`): D3 saltea las metas que
//       ningún esquema puede establecer, leído de la TABLA y no del `why`.
//
//   §2  LA RUEDA DE D5 ERA UN CICLO DE DOS. `fondoQueFallo` era un índice y el
//       puntero rebotaba entre las dos primeras; `explorar` —la ÚNICA de las tres
//       que mueve el cuerpo— no salía nunca. Medido: 13.645 de 16.823 ticks sin
//       moverse, con una racha de 3.992.  → REPARADO (decisión 8): la cuenta pasó
//       a ser una máscara de tres bits.
//
//   §3  LA CRIATURA SE LEVANTA A SÍ MISMA Y DESPUÉS SE OFRECÍA COMO COMIDA.  →
//       REPARADA LA MITAD DE ESTE PAQUETE: `opportunities()` ya no se lista a sí
//       misma. La otra mitad —que `juntar` levante el propio cuerpo— NO se puede
//       reparar desde acá y queda medida: «no soy yo» no es una cualidad, así que
//       no se puede escribir en un `Where`.
//
//   §4  LA CREENCIA SOBRE LO QUE LLEVA EN LA MANO DEPENDÍA DEL SUELO QUE PISA.  →
//       REPARADO: la mano es un lugar propio en la `ContextKey`.
//
//   §5  EL REFLEJO SE COMÍA UN PASO DEL PLAN.  → REPARADO: D0 devuelve el paso
//       interrumpido a la cabeza de `pasosPendientes` antes de huir.
//
//   §6  lo que aguantó el ataque, medido igual: el determinismo y el tope de la
//       memoria de creencias.

import { beforeEach, describe, expect, it } from 'vitest'

import { Contexto, Partida } from '@anima/perceive'
import type { GoalNode, Step } from '@anima/plan'
import { AGUA_FRANCA, EXPANSIONES_POR_TICK, interpretar, plan } from '@anima/plan'
import type {
  BodyView,
  Cell,
  CellQuality,
  Clock,
  PlaceMemory,
  SelfView,
  Where,
  WhereCell,
} from '@anima/skills'
import type { QualityId } from '@anima/physics'
import { HZ_DE_REFERENCIA } from '@anima/physics'
import type { WorldState } from '@anima/world'
import { COSTO_VIVIR_POR_SEGUNDO } from '@anima/world'

import { Creencias, LUGARES, RASGOS, contextoDe } from '../src/creencias.js'
import { aterrizar, avanzarReloj, decidir, nuevoEstado } from '../src/escalera.js'
import { Mente } from '../src/mente.js'
import { necesidades } from '../src/necesidades.js'
import { metaDe, opportunities } from '../src/oportunidades.js'
import type { Decision, Intencion, Peldano, VistaDeLaMente } from '../src/tipos.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, laOrilla, mundo } from './mundo.js'

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
 * La MISMA escena que usa `la-mente.test.ts` y `hito-5-el-criterio.test.ts`: la
 * orilla de verdad de la semilla, una vara de madera a tres celdas y un matorral
 * de liana a dos. Se copia tal cual a propósito — un hallazgo que sólo aparece en
 * una escena inventada por el adversario es más fácil de descartar que uno que
 * aparece en la escena con la que el hito se declara cumplido.
 */
function laEscena(stamina: number): WorldState {
  const o = laOrilla()
  const p = o.parada
  return mundo({
    dios: o.dios,
    bodies: [
      enElPiso(criatura('ana', stamina), p),
      enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: p.x + 3, y: p.y }),
      enElPiso(cuerpo('matorral', 'liana', 0.2, {}, 'hebra'), { x: p.x - 2, y: p.y + 1 }),
    ],
    actors: [actor('ana', { capacity: 3 })],
  })
}

/** El páramo: la criatura sola en el origen y nada más en el mundo. */
function paramo(tick: number, stamina: number): Partida {
  const w = mundo({
    bodies: [enElPiso(criatura('ana', stamina), { x: 0, y: 0 })],
    actors: [actor('ana')],
  })
  return new Partida({ ...w, tick })
}

interface Corrida {
  readonly peldanos: Readonly<Record<Peldano, number>>
  /** Cuántas veces despegó cada habilidad, por su nombre ya resuelto. */
  readonly despegues: ReadonlyMap<string, number>
  /** `tick:meta` cada vez que `metaEnCurso` cambia. */
  readonly metas: readonly string[]
  /** Ticks en los que la criatura terminó en la misma celda en la que empezó. */
  readonly quietos: number
  /** La racha más larga de ticks sin moverse. */
  readonly rachaQuieta: number
  /** Cuántas celdas distintas pisó en toda la corrida. */
  readonly celdas: number
  /** El tick en el que se fue de `state.actors`, o `-1`. */
  readonly muerta: number
  readonly ticks: number
}

/**
 * Una corrida con UNA mente, anotando lo que este archivo necesita medir: dónde
 * cortó la escalera, qué despegó, cuándo cambió de idea y CUÁNTO SE MOVIÓ.
 *
 * Lo último es lo que los tests de los otros archivos no miran, y es donde vive
 * la mitad de lo que sigue: una criatura que decide 20.000 veces y no cambia de
 * celda pasa cualquier aserción sobre cobertura de peldaños.
 */
function correr(p: Partida, ticks: number, quien = 'ana'): Corrida {
  const m = new Mente({ actor: quien, memoria: new Creencias() })
  const peldanos: Record<Peldano, number> = { D0: 0, D1: 0, D2: 0, D3: 0, D4: 0, D5: 0 }
  const despegues = new Map<string, number>()
  const metas: string[] = []
  const pisadas = new Set<string>()
  let ultimaMeta = ''
  let quietos = 0
  let racha = 0
  let rachaQuieta = 0
  let muerta = -1
  let corridos = 0
  let antes = p.state.bodies.get(`${quien}-cuerpo`)?.at

  for (let t = 0; t < ticks; t++) {
    if (!p.state.actors.has(quien)) {
      muerta = t
      break
    }
    const despegoAntes = m.despegues
    const d = m.pensar(p)
    peldanos[d.por] += 1
    if (m.despegues > despegoAntes) {
      const n = m.ultimoDespegue ?? '?'
      despegues.set(n, (despegues.get(n) ?? 0) + 1)
    }
    const meta = String(m.estado.metaEnCurso)
    if (meta !== ultimaMeta) {
      metas.push(`${String(t)}:${meta}`)
      ultimaMeta = meta
    }
    p.avanzar(1)
    corridos += 1
    const ahora = p.state.bodies.get(`${quien}-cuerpo`)?.at
    if (ahora !== undefined) pisadas.add(`${String(ahora.x)},${String(ahora.y)}`)
    if (ahora !== undefined && antes !== undefined && ahora.x === antes.x && ahora.y === antes.y) {
      quietos += 1
      racha += 1
      if (racha > rachaQuieta) rachaQuieta = racha
    } else racha = 0
    antes = ahora
  }

  return {
    peldanos,
    despegues,
    metas,
    quietos,
    rachaQuieta,
    celdas: pisadas.size,
    muerta,
    ticks: corridos,
  }
}

function cuenta(m: ReadonlyMap<string, number>, k: string): number {
  return m.get(k) ?? 0
}

function tabla(m: ReadonlyMap<string, number>): string {
  return [...m]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))
    .map(([k, n]) => `${k}×${String(n)}`)
    .join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 · LA META QUE EL PLANIFICADOR RECHAZA SE SOSTIENE PARA SIEMPRE
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 · la meta que `plan()` rechaza estructuralmente, que se sostenía 12.000 ticks', () => {
  /**
   * Primero el hecho de abajo, porque es el que hace que lo de arriba sea grave:
   * de los cinco tags que la mente puede querer, `plan()` sabe conseguir UNO.
   *
   * Y la respuesta NO depende del presupuesto: con 64 expansiones y con 4000 el
   * resultado es el mismo `gap` con `nearest` vacío y el mismo motivo. O sea que
   * el comentario que justifica no tirar la meta —«D5 manda a deambular, la
   * vista cambia, y la próxima búsqueda corre sobre otro paisaje»— no aplica:
   * ningún paisaje agrega un esquema al catálogo.
   */
  it('`holding(tag:vegetal)` y `holding(tag:fibroso)` no los establece NINGÚN esquema, a ningún presupuesto', () => {
    const p = new Partida(laEscena(1000))
    p.avanzar(1)
    const v = new Contexto(p.proyeccion, { actor: 'ana', rng: p.dado.tirar, lugares: p.lugares }).ctx

    const filas: string[] = []
    const veredicto = new Map<string, string>()
    for (const tag of ['carnoso', 'vegetal', 'fibroso']) {
      const pr = interpretar(metaDe(tag))
      expect(pr, `«${metaDe(tag)}» tiene que ser interpretable: `).toBeDefined()
      if (pr === undefined) continue
      const g: GoalNode = { id: 'meta', goal: pr, after: [], porque: 'el ataque' }
      for (const presupuesto of [EXPANSIONES_POR_TICK, 4000]) {
        const r = plan(g, v, presupuesto)
        const dicho =
          r.k === 'plan'
            ? `plan de ${String(r.steps.length)} pasos`
            : r.k === 'gap'
              ? `gap · nearest=${String(r.nearest.length)} · «${r.why}»`
              : 'parcial (se cortó)'
        filas.push(`  ${tag.padEnd(8)} presupuesto ${String(presupuesto).padStart(4)} → ${dicho}`)
        veredicto.set(`${tag}@${String(presupuesto)}`, r.k)
      }
    }
    console.log('\n─── QUÉ CONTESTA `plan()` PARA CADA TAG QUE EL INSTINTO PUEDE QUERER ───\n' + filas.join('\n') + '\n')

    // Lo único que se sabe conseguir es la comida del pozo.
    expect(veredicto.get(`carnoso@${String(EXPANSIONES_POR_TICK)}`)).toBe('plan')
    expect(veredicto.get('carnoso@4000')).toBe('plan')
    // Las otras dos son `gap` con `nearest` vacío, y subir el presupuesto 62× no
    // las mueve: no es una búsqueda que se cortó, es un vocabulario que no las tiene.
    expect(veredicto.get(`vegetal@${String(EXPANSIONES_POR_TICK)}`)).toBe('gap')
    expect(veredicto.get('vegetal@4000')).toBe('gap')
    expect(veredicto.get(`fibroso@${String(EXPANSIONES_POR_TICK)}`)).toBe('gap')
    expect(veredicto.get('fibroso@4000')).toBe('gap')
  })

  /**
   * EL HALLAZGO, Y LO QUE QUEDÓ DESPUÉS DE REPARARLO.
   *
   * ─── LO QUE MEDÍA ANTES ────────────────────────────────────────────────────
   *
   * Con el tanque lleno `energia` vale cero exacto, así que la satisfacción de
   * `carnoso` es chica y el que ganaba la lista de D3 era `holding(tag:vegetal)`
   * —el de la vara, tres celdas al este—. D3 lo tomaba en el tick 0 y **no lo
   * soltaba hasta el tick 12.000**, porque `planificar` devolvía `undefined` sin
   * tirar la meta y `puedeCambiar` le exigía al retador `MARGEN_DE_HISTERESIS`
   * por encima de un valor que nunca iba a alcanzar hasta que el hambre lo
   * levantara. La corrida entera decía:
   *
   *     peldaños  {"D0":0,"D1":7790,"D2":0,"D3":1,"D4":209,"D5":10524}
   *     metas     0:holding(tag:vegetal)  →  12000:holding(tag:carnoso)
   *     despegues guarecerse×5235 juntar×1×5105 aplicar(extraccion)×210 …
   *     murió en  18524
   *
   * O sea: parada al lado de un pozo que `plan()` sabe pescar en siete pasos, sin
   * intentarlo una sola vez en doce mil ticks.
   *
   * ─── LA REPARACIÓN ─────────────────────────────────────────────────────────
   *
   * Decisión 7 de `escalera.ts`: D3 saltea las oportunidades cuya meta ningún
   * esquema del catálogo puede establecer, y `tomarMeta` se planta antes de
   * escribir nada. Lo que se lee de la tabla y no del `why` en prosa.
   */
  it('REPARADO · con el tanque lleno toma la meta que SÍ se puede planificar, en el tick 0', () => {
    const r = correr(new Partida(laEscena(1000)), 20000)

    console.log(
      '\n─── 20.000 TICKS EN LA ORILLA, CON EL TANQUE LLENO ───\n' +
        `  peldaños ......... ${JSON.stringify(r.peldanos)}\n` +
        `  metas ............ ${r.metas.join('  →  ')}\n` +
        `  despegues ........ ${tabla(r.despegues)}\n` +
        `  murió en ......... ${String(r.muerta)}\n`,
    )

    // ─── LA LISTA DE METAS CRECIÓ A TRES, Y LA DEL MEDIO ES LA NOTICIA ─────
    //
    //     antes de este tramo   0:holding(tag:carnoso) → 98:…toxicity<0.0528
    //     hoy                   0:holding(tag:carnoso) → 97:undefined
    //                                                  → 98:…toxicity<0.0528
    //
    // El `97:undefined` es **el tick en que suelta la meta porque la cumplió**, y
    // antes no existía. La barata se daba por conseguida por el rodeo de la
    // escalera (`EstadoDeLaEscalera.conseguido`) sin que `metaEnCurso` se vaciara
    // nunca; ahora `cumpleCuerpo` de `@anima/plan` contesta `holding(tag:…)` desde
    // la vista, así que la meta se cumple, se suelta, y el tick siguiente D3 elige
    // la que sigue. Lo que este test cuida sigue siendo lo mismo: que la primera
    // sea la planificable y en el tick 0.
    expect(r.metas.length).toBe(3)
    expect(r.metas[0]).toBe('0:holding(tag:carnoso)')
    expect(r.metas[1]).toMatch(/^\d+:undefined$/)
    expect(r.metas[2]).toMatch(/^\d+:holding\(tag:carnoso,toxicity<[\d.]+\)$/)
    // Y la hace: la cadena de la caña entera.
    for (const paso of ['ir(vara)', 'sostener(vara)', 'ir(matorral)', 'sostener(matorral)', 'unir(matorral+vara)']) {
      expect(cuenta(r.despegues, paso), paso).toBe(1)
    }
    // ─── Y ACÁ TRES NÚMEROS SE DIERON VUELTA, POR LA MISMA CAUSA ──────────
    //
    // Este test afirmaba `extraccion > 500`, `D5 === 0` y `muerta > 19900`. Los
    // tres medían la misma cosa desde tres lados: que la criatura se pasaba la
    // corrida entera pescando, porque el pescado que sacaba no contaba y volvía a
    // empezar. Hoy cuenta:
    //
    //     extraccion  2 (uno no pica, el otro saca el pescado)
    //     D5          3144 de 20.000 — el pedido sube a lo cocido, `plan()` se
    //                 corta en la ventana de potencia del fuego y el tick cae a
    //                 las conductas de fondo
    //     muerta      11.619 y no 19.995, porque las conductas de fondo CAMINAN:
    //                 1000 ÷ 11.619 = 0,0861 por tick contra 0,0500 de respirar
    //
    // Está medido entero en `hito-5-el-criterio.test.ts` (DIAGNÓSTICO 6/6). Lo que
    // acá importa es que ninguno de los tres es un retroceso de ESTE hallazgo: la
    // meta sin esquema sigue sin tapar a la planificable, que es lo que §1 ataca.
    expect(cuenta(r.despegues, 'aplicar(extraccion)')).toBe(2)
    expect(r.peldanos.D5).toBeGreaterThan(0)
    // Pero D5 no arranca hasta DESPUÉS de que la cadena entera se hizo: la primera
    // conducta de fondo sale recién cuando el pedido nuevo se queda sin vía.
    //
    // El `-1` entra al techo desde el tramo M: con `COSTO_VIVIR_POR_SEGUNDO` en
    // 0,34 esta corrida **llega viva** en vez de morirse en el 11.619, y lo que el
    // renglón quiere decir —«aguantó lo suficiente para que D5 tenga sentido»— se
    // cumple más que antes. Un `-1` leído como número la haría fallar por el lado
    // bueno, que es la peor clase de rojo.
    const vividos = r.muerta < 0 ? 20000 : r.muerta
    expect(vividos).toBeGreaterThan(10000)
    // ─── Y POR QUÉ ESTE TEST NECESITA UN TECHO EXPLÍCITO ───────────────────
    //
    // 20.000 ticks con mente tardaban menos de los 5 s que vitest da por omisión;
    // hoy tardan 3,3 s solo y se pasan de 5 corriendo al lado de los otros ocho
    // paquetes. La causa está medida en `hito-5-el-criterio.test.ts` (criterio 3):
    // un `plan()` que se CORTA cuesta 0,25 ms y uno que cierra 0,003 —80×—, y desde
    // que la criatura consigue el pescado pasa la corrida pidiendo lo cocido, que
    // se corta. No es un test lento por descuido: es la corrida más larga de este
    // archivo pagando lo que hoy cuesta pensar sin salida.
  }, 300_000)

  /**
   * El contrafáctico, sobre EL MISMO MUNDO: lo único que cambia es la `stamina`
   * inicial, que antes decidía cuál de las dos metas quedaba arriba en el tick 0.
   *
   * Antes: con hambre pescaba 128 veces en 4000 ticks y sin hambre CERO. La
   * diferencia no era el mundo ni el plan, era cuál meta había ganado primero — y
   * una de las dos no se podía ejecutar.
   *
   * Ahora los dos tanques hacen lo mismo, que es lo que se querría de una mente:
   * el hambre cambia CUÁNTO vale la comida, no si la criatura sabe conseguirla.
   *
   * Y el número con el que «lo mismo» se afirma bajó de 128 a DOS, porque el
   * pescado que saca ya cuenta y no vuelve a empezar. La igualdad —que es lo que
   * este test ataca— quedó más limpia que antes: los dos tanques hacen la cadena
   * entera una sola vez y tiran la caña las mismas dos veces.
   */
  it('REPARADO · el mismo mundo pesca lo mismo con el tanque lleno y con hambre', () => {
    // ─── EL HORIZONTE BAJÓ DE 4000 A 3000, Y NO ES ABLANDAR ────────────────
    //
    // Con 4000 las dos corridas NO son comparables, y el motivo no tiene nada que
    // ver con lo que este test ataca: **la del tanque de 310 se muere en el 3743**
    // (medido en `hito-5-el-criterio.test.ts`) y `correr` corta el bucle al morir,
    // así que la del tanque lleno cuenta 257 ticks más de conductas de fondo. Los
    // histogramas salían 397 contra 417 por eso y por nada más.
    //
    // Con 3000 las dos están vivas y la comparación es la que el test quiere hacer.
    //
    // (Con el bucle del `nearest` sin arreglar esto pasaba en 4000 porque las DOS
    // llegaban vivas: el bucle no gasta aliento. Otro verde que se apoyaba en él.)
    const conHambre = correr(new Partida(laEscena(310)), 3000)
    const sinHambre = correr(new Partida(laEscena(1000)), 3000)
    // La premisa del contrafáctico, afirmada y no supuesta: las dos llegan vivas.
    expect(conHambre.muerta).toBe(-1)
    expect(sinHambre.muerta).toBe(-1)

    console.log(
      '\n─── EL MISMO MUNDO, DOS TANQUES ───\n' +
        `  stamina 310 ..... ${tabla(conHambre.despegues)}\n` +
        `                    peldaños ${JSON.stringify(conHambre.peldanos)}\n` +
        `  stamina 1000 .... ${tabla(sinHambre.despegues)}\n` +
        `                    peldaños ${JSON.stringify(sinHambre.peldanos)}\n`,
    )

    expect(cuenta(conHambre.despegues, 'aplicar(extraccion)')).toBe(2)
    expect(cuenta(sinHambre.despegues, 'aplicar(extraccion)')).toBe(
      cuenta(conHambre.despegues, 'aplicar(extraccion)'),
    )
    // La cadena entera, una sola vez, con los dos tanques: es la igualdad que este
    // test ataca, y ahora se puede afirmar paso por paso y no sólo por la pesca.
    for (const paso of ['ir(vara)', 'sostener(vara)', 'ir(matorral)', 'sostener(matorral)', 'unir(matorral+vara)']) {
      expect(cuenta(sinHambre.despegues, paso), paso).toBe(1)
      expect(cuenta(conHambre.despegues, paso), paso).toBe(1)
    }
    // ─── DÓNDE CAEN LOS DOS DESPUÉS: D5, Y VOLVIÓ A SER D5 ──────────────────
    //
    // Hecha la caña y con el pescado en la mano, el pedido sube a lo cocido, no hay
    // vía, y los dos caen a las conductas de fondo. Eso es lo que este par afirma,
    // y es lo mismo que afirmaba antes del tramo K.
    //
    // En el medio hubo una versión que afirmaba **D4 mayoritario y D5 cero**, con
    // `ir(suelta:-6:-7:2)×3899`, y lo escribió como lo que era —«un bucle nuevo y
    // hay que decirlo así»—. Ese bucle está cerrado (`escalera.ts`,
    // `mientrasTantoYaHecho`; medido en `hito-5-el-criterio.test.ts`, DIAGNÓSTICO
    // 11) y D5 volvió a correr, que es lo que la escalera tiene que hacer cuando
    // no hay vía.
    //
    // ─── Y UNA AFIRMACIÓN QUE SE HABÍA AGREGADO DE MÁS, MEDIDA Y SACADA ─────
    //
    // El tramo K agregó acá `expect(sinHambre.peldanos).toEqual(conHambre.peldanos)`
    // —el histograma de peldaños IDÉNTICO tick a tick— y pasaba. Pasaba porque D5
    // no corría ni una vez: con el bucle del `nearest` sin cerrar los dos tanques
    // se quedaban en D4 replanificando, y dos corridas que no hacen nada hacen lo
    // mismo. Con D5 corriendo, es FALSA, y no por un error: **la rueda de D5 se
    // elige con `necesidades(v)`, que lee la `stamina`**, así que el tanque cambia
    // qué conducta de fondo sale. Medido, la primera divergencia:
    //
    //     tick 102   310 → explorar(8t)
    //                1000 → juntar×1 (se cae en el acto) y explorar(8t) en el 103
    //
    // O sea que en 3000 ticks los dos hacen 310 explorar, 310 juntar y 310/311
    // guarecerse: la misma rueda, con un turno de corrimiento.
    //
    // Lo que este test ATACA —que el tanque no cambie si la criatura sabe conseguir
    // la comida— se afirma entero arriba: la cadena de cinco pasos una vez cada
    // una, y las mismas dos tiradas de caña. Que las conductas de FONDO dependan
    // del hambre no es el defecto que este archivo persigue: es lo que D5 promete.
    expect(sinHambre.peldanos.D5).toBeGreaterThan(0)
    expect(conHambre.peldanos.D5).toBeGreaterThan(0)
    // Los dos pasan la mayor parte del tiempo en D1 —haciendo, no pensando— y
    // ninguno se clava en un peldaño. Es la forma comparable que sí es cierta.
    for (const p of [conHambre.peldanos, sinHambre.peldanos]) {
      expect(p.D1).toBeGreaterThan(p.D0 + p.D2 + p.D3 + p.D4 + p.D5)
      expect(p.D4).toBeLessThan(10)
    }
    // Dos corridas de 3000 ticks; mismo motivo que el techo del test de arriba.
  }, 300_000)

  /**
   * EL `it.fails` DEL ADVERSARIO, AHORA VERDE. Estaba escrito así —«se deja como
   * `it.fails` para que el día que se repare este archivo se ponga rojo y haya que
   * venir a borrarlo»— y ese día es hoy: en vez de borrarlo, se lo deja como la
   * aserción positiva que era, que es lo único que hace que la reparación no se
   * pueda deshacer sin que nada se ponga rojo.
   */
  it('lo que se quería: que una meta sin esquema no tape a la que sí se puede planificar', () => {
    const r = correr(new Partida(laEscena(1000)), 3000)
    expect(cuenta(r.despegues, 'aplicar(extraccion)')).toBeGreaterThan(0)
    // EL PLAZO, Y QUÉ LO MOVIÓ: 3000 ticks entraban de sobra en los 5 s de vitest
    // cuando la escena tenía tres cuerpos. Desde que el mundo materializa el decreto
    // (`world/src/step.ts`, `abrirChunk`) tiene más de cien, y las doce leyes corren
    // sobre todos, todos los ticks. Ninguna aserción se tocó.
  }, 300_000)
})

// ─────────────────────────────────────────────────────────────────────────────
// §2 · LA RUEDA DE D5 ES UN CICLO DE DOS
// ─────────────────────────────────────────────────────────────────────────────

/** Una vista de mentira, mínima: sólo lo que D0 y `necesidades` van a leer. */
function vistaPelada(o: {
  stamina: number
  temperaturaDelCuerpo: number
  temperaturaDeLaCelda: number
  cobijo: number
  reloj: Clock
  cuerpos?: readonly BodyView[]
}): VistaDeLaMente {
  const self: SelfView = {
    id: 'yo',
    at: { x: 0, y: 0 },
    name: 'criatura',
    // En este mundito nada tiene sustancia, asi que nada tiene clase de materia.
    // En la partida la vista lo saca de `tagsDe(body, phys)`.
    tags: [],
    madeByMe: false,
    joints: [],
    holding: [],
    capacity: 3,
    stamina: o.stamina,
    permits: 'irreversible',
  }
  const cuerpos = o.cuerpos ?? []
  return {
    see: (_w: Where): readonly BodyView[] => cuerpos,
    recall: (_w: WhereCell): readonly PlaceMemory[] => [],
    q: (b: BodyView, q: QualityId): number =>
      b.id === 'yo' && q === 'temperature'
        ? o.temperaturaDelCuerpo
        : b.id === 'yo' && q === 'stamina'
          ? o.stamina
          : q === 'ignitionPoint'
            ? 0
            : q === 'portable'
              ? 1
              : 0,
    qAt: (_at: Cell, q: CellQuality): number =>
      q === 'temperature' ? o.temperaturaDeLaCelda : q === 'sheltered' ? o.cobijo : 0,
    self,
    clock: o.reloj,
  }
}

describe('§2 · la rueda de D5, que era un ciclo de dos', () => {
  /**
   * El mecanismo, en aislamiento y sin mundo.
   *
   * ─── LO QUE MEDÍA ANTES ────────────────────────────────────────────────────
   *
   * La rueda es `['guarecerse', 'juntar', 'deambular']`, la necesidad más grande
   * elige el índice, y `fondoQueFallo` —UN índice— empujaba el puntero UNO cuando
   * la elegida acababa de fallar. Con `refugio` arriba —o sea de noche, o al
   * final de la tarde, sin techo— el índice elegido es SIEMPRE 0, así que la
   * rueda alternaba 0 → 1 → 0 → 1 y **nunca llegaba al 2**, que es `explorar`, la
   * única de las tres que camina y la única que dura más de un tick:
   *
   *     emitidas ......... guarecerse×100 juntar×100
   *     los primeros 12 .. guarecerse juntar guarecerse juntar guarecerse juntar…
   *     (`explorar` emitida 0 veces, con alternancia estricta verificada)
   *
   * ─── LA REPARACIÓN ─────────────────────────────────────────────────────────
   *
   * `fondosQueFallaron` es una MÁSCARA de tres bits: no se saltea «la última que
   * falló» sino «las que fallaron desde el último éxito». Con las dos primeras
   * marcadas, la tercera sale sola; cuando las tres fallan, la cuenta se limpia y
   * se vuelve a la que la necesidad pide.
   */
  it('REPARADO · de noche y sin techo la rueda da la vuelta entera: `explorar` sale una de cada tres', () => {
    const v = vistaPelada({
      stamina: 500,
      temperaturaDelCuerpo: 15,
      temperaturaDeLaCelda: 15,
      cobijo: 0,
      // De noche `secondsToNightfall` es 0 por contrato del reloj del mundo, así
      // que `refugio` vale 1 y le gana a `energia` (0,25 con medio tanque).
      reloj: { phase: 'noche', secondsToNightfall: 0, dayLength: 200 },
    })
    const n = necesidades(v)
    const e = nuevoEstado()
    const emitidas: string[] = []

    for (let t = 0; t < 200; t++) {
      avanzarReloj(e)
      const d = decidir(v, e, { actor: 'ana' })
      expect(d.k).toBe('volar')
      if (d.k === 'volar') emitidas.push(d.paso.k)
      // El peor caso de todos: LAS TRES fallan siempre. Es lo que contesta el
      // mundo cuando no hay ni techo, ni combustible, ni nada que encontrar.
      aterrizar(e, false)
    }

    const cuantas = new Map<string, number>()
    for (const k of emitidas) cuantas.set(k, (cuantas.get(k) ?? 0) + 1)
    console.log(
      '\n─── LA RUEDA DE D5 CON `refugio` ARRIBA (200 ticks, sin mundo) ───\n' +
        `  necesidades ...... ${JSON.stringify(n)}\n` +
        `  emitidas ......... ${tabla(cuantas)}\n` +
        `  los primeros 12 .. ${emitidas.slice(0, 12).join(' ')}\n`,
    )

    // Las tres salen, y salen un tercio cada una: con las tres fallando, la rueda
    // recorre `guarecerse → juntar → explorar` y ahí se limpia y vuelve a empezar.
    for (const k of ['guarecerse', 'juntar', 'explorar']) {
      expect(cuantas.get(k) ?? 0, k).toBeGreaterThan(60)
    }
    expect((cuantas.get('guarecerse') ?? 0) + (cuantas.get('juntar') ?? 0) + (cuantas.get('explorar') ?? 0)).toBe(200)
    // Y el patrón es exactamente ése, no un reparto que se promedia: los primeros
    // nueve son tres vueltas iguales.
    expect(emitidas.slice(0, 9)).toEqual([
      'guarecerse',
      'juntar',
      'explorar',
      'guarecerse',
      'juntar',
      'explorar',
      'guarecerse',
      'juntar',
      'explorar',
    ])
  })

  /**
   * Y ahora contra `stepWorld`, que es donde el «se rinden en un tick» deja de
   * ser una hipótesis del arnés. El páramo: la criatura sola, nada que ver.
   *
   * ─── LO QUE MEDÍA ANTES ────────────────────────────────────────────────────
   *
   *     peldaños ............ {"D0":0,"D1":3180,"D5":13643}
   *     despegues ........... guarecerse×6821 juntar×1×6424 explorar(8t)×398
   *     ticks sin moverse ... 13645 de 16823
   *     la racha más larga .. 3992 ticks seguidos en la misma celda
   *     celdas pisadas ...... 25
   *
   * Una criatura que decide dieciséis mil veces y pisa veinticinco celdas en un
   * mundo infinito.
   *
   * ─── Y LO QUE CUESTA LA REPARACIÓN, DICHO SIN MAQUILLAJE ───────────────────
   *
   * Caminar no es gratis, y desde el tramo M lo es MUCHO menos: `COSTO_POR_CELDA`
   * (0,05) era exactamente `COSTO_VIVIR_POR_SEGUNDO / hz` a la frecuencia de
   * referencia —de ahí el «gasta hasta el doble»— y hoy, con vivir en 0,34, una
   * celda cuesta **2,94× lo que cuesta el tick de respirar**. Así que una criatura
   * que explora gasta hasta CUATRO veces lo que una quieta.
   *
   * En un páramo —donde por definición no hay nada que encontrar— eso se paga
   * entero y no se cobra nada: muere ANTES que la que se quedaba tildada. Ésa es la
   * cuenta honesta, y es la misma que hace cualquier animal que sale a buscar: la
   * alternativa no es vivir más, es morirse quieto sin haber mirado.
   */
  it('REPARADO · en el páramo camina, y desde la guarda del mundo AGUANTA los 20.000', () => {
    const r = correr(paramo(0, 1000), 20000)

    console.log(
      '\n─── EL PÁRAMO, 20.000 TICKS ───\n' +
        `  peldaños ............ ${JSON.stringify(r.peldanos)}\n` +
        `  despegues ........... ${tabla(r.despegues)}\n` +
        `  ticks sin moverse ... ${String(r.quietos)} de ${String(r.ticks)}\n` +
        `  la racha más larga .. ${String(r.rachaQuieta)} ticks seguidos en la misma celda\n` +
        `  celdas pisadas ...... ${String(r.celdas)}\n` +
        `  murió en ............ ${String(r.muerta)}\n`,
    )

    // Las tres conductas salen la misma cantidad de veces: la rueda da la vuelta.
    const g = cuenta(r.despegues, 'guarecerse')
    const j = cuenta(r.despegues, 'juntar×1')
    const x = cuenta(r.despegues, 'explorar(8t)')
    expect(g).toBeGreaterThan(0)
    expect(Math.abs(g - j)).toBeLessThanOrEqual(1)
    expect(Math.abs(g - x)).toBeLessThanOrEqual(1)
    // Y ya no se queda tildada: la racha quieta más larga es la de un `explorar`
    // que topa contra un borde, no un día entero de mundo.
    expect(r.rachaQuieta).toBeLessThan(50)
    expect(r.quietos / r.ticks).toBeLessThan(0.4)
    expect(r.celdas).toBeGreaterThan(30)
    // ─── ACÁ DECÍA «MUERE ANTES QUE LA QUIETA», Y DEJÓ DE SER CIERTO ────────
    //
    // Decía: «caminar gasta, y en un páramo no rinde; muere antes que la que se
    // quedaba quieta, y eso es un dato del mundo y no un defecto de la mente», y
    // afirmaba `muerta > 10.000` con el 18.742 medido.
    //
    // La guarda `es-uno-mismo` de `intencionTomar` (2026-08-02) lo dio vuelta.
    // Medido en este mismo archivo, con y sin la guarda, misma semilla:
    //
    //                              sin guarda      con guarda
    //     murió en ............... 18.742          NUNCA (aguanta los 20.000)
    //     celdas por tick ........ 0,59            0,50
    //     ticks sin moverse ...... 27,3%           38,5%
    //     despegues de cada clase  1.704           1.539
    //
    // EL MECANISMO, y hay que decirlo porque no es «ahora camina mejor»: antes,
    // `juntar` se llevaba el propio cuerpo a la mano en el primer intento y daba
    // por cumplido su pedido, así que el diente siguiente de la rueda salía a
    // `explorar` — que camina—. Ahora el mundo le dice que no, `juntar` no
    // completa, y esos ticks NO caminan. Camina menos, y en un páramo caminar es
    // el gasto. Vive 6,7% más porque hace 15% menos de camino.
    //
    // O sea que no es una mejora de la mente: es que se le sacó un gasto que
    // pagaba por un acto ilegal. Y deja algo abierto y dicho: `juntar` ahora gira
    // en falso 1.539 veces, pidiendo algo que el mundo le va a negar siempre.
    const loQueDuraQuieta = (1000 / COSTO_VIVIR_POR_SEGUNDO) * HZ_DE_REFERENCIA
    expect(r.muerta, 'volvió a morirse adentro de los 20.000: el gasto del páramo cambió').toBe(-1)
    // Y el testigo derivado se conserva, que es lo que el tramo M obligó a hacer:
    // si llegara a morir, tiene que ser antes de lo que dura la quieta. Escrito
    // así, la próxima vez que alguien mueva el costo de vivir se mueve solo.
    expect(r.ticks).toBeLessThan(loQueDuraQuieta)
  })

  /**
   * Cuándo arranca el congelamiento, para que no parezca un caso de borde: la
   * necesidad de refugio es `transcurrido²`, o sea que le gana a la de energía en
   * cuanto se pasó la mitad de la luz del día. De ahí hasta el amanecer siguiente
   * —tres cuartos del ciclo— la criatura no camina.
   */
  it('y no es un caso de borde: `refugio` le gana a `energia` desde media tarde hasta el amanecer', () => {
    const filas: string[] = []
    let congelados = 0
    for (let t = 0; t < 4000; t += 250) {
      // El reloj del mundo, escrito a mano con la misma regla: medio día de luz.
      const ticksDeLuz = 2000
      const deNoche = t >= ticksDeLuz
      const reloj: Clock = {
        phase: deNoche ? 'noche' : 'dia',
        secondsToNightfall: deNoche ? 0 : (ticksDeLuz - t) / 20,
        dayLength: 200,
      }
      const v = vistaPelada({
        stamina: 500,
        temperaturaDelCuerpo: 15,
        temperaturaDeLaCelda: 15,
        cobijo: 0,
        reloj,
      })
      const n = necesidades(v)
      const congela = n.refugio > n.energia && n.refugio > n.calor
      if (congela) congelados += 1
      filas.push(
        `  t=${String(t).padStart(4)} ${reloj.phase.padEnd(5)} refugio=${n.refugio.toFixed(3)} energia=${n.energia.toFixed(3)} ${congela ? '← rueda congelada' : ''}`,
      )
    }
    console.log('\n─── CUÁNDO GANA `refugio` (medio tanque, a la intemperie) ───\n' + filas.join('\n') + '\n')
    expect(congelados / filas.length).toBeGreaterThan(0.5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §3 · LA CRIATURA SE LEVANTA A SÍ MISMA
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 · el `juntar` de D5 le mete su propio cuerpo en la mano', () => {
  /**
   * D5 emite `juntar({ fuelEnergy > 0 }, 1)` cuando lo que más duele es el frío o
   * cuando le toca ese diente de la rueda. La carne de la criatura arde —tiene
   * `fuelEnergy = 2`, es lo que la pone en la forma `mc--e`—, pesa 2 kg, o sea que
   * es `portable`, y nadie la tiene agarrada. `juntar` la ve, camina cero celdas y
   * la levanta.
   *
   * ─── LA MITAD QUE SIGUE ROTA, Y NO SE ARREGLA DESDE ESTE PAQUETE ───────────
   *
   * `juntar` filtra con un `Where`, que es una lista de pruebas sobre CUALIDADES:
   * `[{ q: 'fuelEnergy', op: '>', v: 0 }]`. **«No soy yo» no es una cualidad**, así
   * que la mente no tiene con qué escribir ese filtro — el `ALGO_QUE_ARDE` de
   * `escalera.ts` no puede excluirse a sí misma.
   *
   * ─── CERRADO EL 2026-08-02, Y NO ACÁ ───────────────────────────────────────
   *
   * Este párrafo decía que la reparación era de `skills/src/innatas/juntar.ts` o
   * del mundo, y que quedaba un `it.fails` con la medición. **El usuario eligió
   * el mundo**: `intencionTomar` rechaza con `es-uno-mismo`, arriba de todas sus
   * otras guardas, igual que `intencionComer` desde el tramo del veneno.
   *
   * Por qué ésa y no la de `juntar`, dicho para que no haya que volver a
   * decidirlo: el filtro de la habilidad arregla esa habilidad, y la guarda del
   * mundo arregla las OCHO innatas que agarran **y todas las que el modelo
   * escriba después**. Que una habilidad mal escrita no pueda ensuciar el estado
   * es el punto entero de que el modelo escriba sólo habilidades.
   *
   * Lo que este bloque mide sigue siendo lo mismo y sigue valiendo: que la mente
   * SÍ le pide a `juntar` su propio cuerpo. Eso no cambió — lo que cambió es que
   * ahora el mundo dice que no.
   *
   * La escena cambió y hay que decir por qué: antes esto salía en la orilla con el
   * tanque lleno, porque D3 se quedaba pegada a una meta imposible y el tick caía
   * a D5. Reparado eso, en la orilla la criatura pesca y D5 no corre nunca. El
   * páramo es donde D5 gobierna de verdad, y ahí sigue pasando igual.
   */
  const elParamoDeNoche = (): Partida => paramo(1980, 1000)

  it('CERRADO (lo reparó el mundo, no la mente) · lo pide y no lo consigue', () => {
    const p = elParamoDeNoche()
    const m = new Mente({ actor: 'ana', memoria: new Creencias() })
    const filas: string[] = []
    let primerAgarre = -1
    /** Cuántas veces el mundo le dijo «ése sos vos». Es la mitad que da sentido al cero. */
    let rechazosPropios = 0
    for (let t = 0; t < 60; t++) {
      const antes = m.despegues
      m.pensar(p)
      const h = [...(p.state.actors.get('ana')?.holding ?? [])]
      if (primerAgarre < 0 && h.includes('ana-cuerpo')) primerAgarre = t
      if (m.despegues > antes && t < 12) {
        filas.push(`  t=${String(t).padStart(2)} ${(m.ultimoDespegue ?? '?').padEnd(14)} holding=[${h.join(', ')}]`)
      }
      // `tick()` y no `avanzar(1)` por una sola razón: **`avanzar` se come los
      // eventos**. Sin reloj de pared las dos son la misma función.
      for (const e of p.tick()) {
        if (e.k === 'rechazada' && e.por === 'es-uno-mismo') rechazosPropios += 1
      }
    }
    const alFinal = [...(p.state.actors.get('ana')?.holding ?? [])]
    console.log(
      '\n─── LA CRIATURA PIDE SU PROPIO CUERPO, Y EL MUNDO LE DICE QUE NO ───\n' +
        filas.join('\n') +
        `\n  primer agarre del propio cuerpo: tick ${String(primerAgarre)} (−1 = nunca)\n` +
        `  rechazos «es-uno-mismo» en 60 ticks: ${String(rechazosPropios)}\n` +
        `  en la mano al tick 60: [${alFinal.join(', ') || '(vacío)'}]\n`,
    )
    // Lo que se afirma ahora es al revés de lo que este bloque afirmaba, y las
    // dos aserciones son la misma medición leída de los dos lados: la mano nunca
    // tuvo el propio cuerpo, ni en el tick 60 ni en ninguno de los 60.
    expect(primerAgarre, 'la mano agarró el propio cuerpo en algún tick').toBe(-1)
    expect(alFinal).not.toContain('ana-cuerpo')
    // Y la otra mitad, que es la que hace que este cero signifique algo: la mente
    // SIGUE pidiéndolo. Si dejara de pedirlo, el cero de arriba sería cierto sin
    // que la guarda del mundo tuviera nada que ver, y este bloque estaría
    // midiendo otra cosa sin decirlo.
    expect(rechazosPropios, 'la mente dejó de pedir su propio cuerpo: este test ya no mide la guarda').toBeGreaterThan(0)
  })

  /**
   * EL MARCADOR DEL HUECO, para que el día que se repare esto se ponga rojo por el
   * motivo correcto en vez de que el test de arriba se ponga rojo por el
   * equivocado.
   *
   * No es reparable desde `@anima/mind` y el porqué es de tipos: D5 le pide a
   * `juntar` un `Where`, que es una lista de `{ q, op, v }` sobre CUALIDADES. «No
   * soy yo» no es una cualidad de ningún cuerpo, así que no hay `Where` que lo
   * diga. Las dos reparaciones posibles están las dos afuera: que
   * `skills/src/innatas/juntar.ts` excluya `ctx.self` de sus candidatos —al lado
   * del `heldBy === undefined` que ya tiene— o que el mundo rechace `take` sobre
   * el propio cuerpo.
   *
   * Y el daño no es cosmético: el propio cuerpo ocupa una mano de tres para
   * siempre, `juntar` deja una libre, y `union` y `friccion` piden manos libres.
   * Con el propio cuerpo más una cosa más, la criatura ya no puede agarrar nada.
   */
  it('LO QUE HACÍA FALTA, Y LO PUSO EL MUNDO: `juntar` ya no levanta el propio cuerpo', () => {
    const p = elParamoDeNoche()
    const m = new Mente({ actor: 'ana', memoria: new Creencias() })
    for (let t = 0; t < 60; t++) {
      m.pensar(p)
      p.avanzar(1)
    }
    expect([...(p.state.actors.get('ana')?.holding ?? [])]).not.toContain('ana-cuerpo')
  })

  /**
   * LA MITAD QUE SÍ SE REPARÓ, Y ES LA DE ESTE PAQUETE.
   *
   * `lugares()` de `oportunidades.ts` excluía a la criatura del barrido de
   * `see()` —`b.id === v.self.id`— pero **no del barrido de la mano**, que va
   * PRIMERO y entra con distancia 0. Medido antes, con el propio cuerpo agarrado:
   *
   *     9,0566  cuerpo:matorral#fibroso    «creo que liana rinde fibroso»
   *     1,8122  cuerpo:vara#vegetal        «creo que madera rinde vegetal»
   *     0,4324  cuerpo:ana-cuerpo#carnoso  «creo que carne cruda rinde carnoso»
   *     0,3815  cuerpo:pozo:-6:-6#carnoso  «creo que pescado crudo rinde carnoso»
   *
   * O sea que se ofrecía a sí misma como comida POR ENCIMA del pescado del pozo,
   * porque el valor es satisfacción por unidad de esfuerzo y no hay esfuerzo más
   * chico que cero. La reparación es la misma línea que ya estaba del otro lado.
   */
  it('REPARADO · con el propio cuerpo en la mano, no se lista a sí misma', () => {
    // La escena se escribe DIRECTO —la criatura con su propio cuerpo agarrado y un
    // pescado tirado a una celda— en vez de sacarla de una corrida: que la corrida
    // llegue a ese estado lo prueba el test de arriba, y acá lo que se mide es qué
    // hace `opportunities()` UNA VEZ que ese estado existe.
    //
    // Y el contexto se INYECTA (decisión 6 de `oportunidades.ts`) por un motivo
    // que hay que decir: con la reparación de `creencias.ts` un cuerpo agarrado
    // cae en `mano|…`, que no tiene ninguna fila de instinto, así que hoy no
    // rendiría ningún tag ni aunque `lugares()` lo dejara pasar. Los dos arreglos
    // se tapan uno al otro, y un test que no los separe verificaría el de al lado.
    // Con `ctxDe` fijo, TODO lugar rinde `carnoso` y lo único que puede sacar a la
    // criatura de la lista es la exclusión que se reparó acá.
    const w = mundo({
      bodies: [
        enLaMano(criatura('ana', 310), { x: 0, y: 0 }, 'ana'),
        enElPiso(cuerpo('pescado', 'pescado', 1), { x: 1, y: 0 }),
      ],
      actors: [actor('ana', { holding: ['ana-cuerpo'], capacity: 3 })],
    })
    const p = new Partida(w)
    const v = new Contexto(p.proyeccion, { actor: 'ana', rng: p.dado.tirar, lugares: p.lugares }).ctx
    const mem = new Creencias()
    // `tierra|mc--e` es la fila 2 del instinto: «lo que alimenta rinde carne».
    const ops = opportunities(v, mem, necesidades(v), { ctxDe: () => 'tierra|mc--e' })

    console.log(
      '\n─── LA LISTA DE OPORTUNIDADES DE UNA CRIATURA QUE SE TIENE EN LA MANO ───\n' +
        `  self.id ......... ${v.self.id}\n` +
        `  self.holding .... [${v.self.holding.map((b) => b.id).join(', ')}]\n` +
        (ops.length === 0
          ? '  (ninguna)'
          : ops.map((o) => `  ${o.valor.toFixed(4).padStart(8)}  ${o.id.padEnd(26)} «${o.porque}»`).join('\n')) +
        '\n',
    )

    // La premisa: efectivamente se tiene en la mano, y con el contexto inyectado
    // el resto del paisaje SÍ rinde. Si la lista saliera vacía, el `not.toContain`
    // de abajo sería verde sin haber medido nada.
    expect(v.self.holding.map((b) => b.id)).toContain(v.self.id)
    expect(ops.map((o) => o.id)).toContain('cuerpo:pescado#carnoso')
    // Y lo que se repara: no aparece en la lista, ni ganando ni perdiendo.
    expect(ops.some((o) => o.id.includes('ana-cuerpo'))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §4 · LA CREENCIA SOBRE LO QUE LLEVA EN LA MANO DEPENDE DEL SUELO
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 · el contexto de lo que se lleva en la mano se calculaba sobre la celda de la criatura', () => {
  /**
   * ─── LO QUE MEDÍA ANTES ────────────────────────────────────────────────────
   *
   * `contextoDe` arma la clave con `lugarDe(v, b)`, que leía `qAt(b.at, 'wet')`. Y
   * `b.at` de un cuerpo en la mano es la celda de la criatura, no la celda de
   * donde lo levantó. O sea que la primera mitad de la clave —el LUGAR— hablaba
   * de dónde estaba parada la criatura y no de qué era la cosa:
   *
   *     t= 8 wet=1,00 ctx(matorral)=agua|m-a-e    tags=[]          top=vara#vegetal 0,894
   *     t= 9 wet=0,15 ctx(matorral)=tierra|m-a-e  tags=["fibroso"] top=matorral#fibroso 9,810
   *     t=15 wet=1,00 ctx(matorral)=agua|m-a-e    tags=[]          top=vara#vegetal 1,090
   *
   * Dos claves para un cuerpo al que no le pasó nada, y la mejor oportunidad de
   * toda la lista —cinco veces la segunda— apareciendo y desapareciendo según la
   * celda. Quince de veinticinco ticks con la liana en la mano, no rendía nada.
   *
   * ─── LA REPARACIÓN ─────────────────────────────────────────────────────────
   *
   * La mano no es un bioma: es un lugar propio (`MANO` en `creencias.ts`). Un
   * cuerpo agarrado tiene UNA clave, camine la criatura por donde camine. Lo que
   * eso cuesta —que lo agarrado no rinda ningún tag, porque ninguna fila del
   * instinto es de `mano`— está dicho allá y es coherente con lo que una
   * oportunidad significa: lo que ya está en la mano no hay que conseguirlo.
   */
  it('REPARADO · la misma vara en la misma mano tiene UNA clave, pise donde pise', () => {
    // Se mira la VARA y no el matorral porque es la que la corrida pasea por los
    // dos suelos: la levanta en una celda de `wet = 0,60` y sigue viaje hasta el
    // matorral, que está en `wet = 1,00`. El matorral entra a la mano ya adentro
    // del agua y `unir` se lo come cinco ticks después.
    const p = new Partida(laEscena(310))
    const mem = new Creencias()
    const m = new Mente({ actor: 'ana', memoria: mem })
    const filas: string[] = []
    const claves = new Set<string>()
    const celdas = new Set<string>()
    let conLaVara = 0

    for (let t = 0; t < 30; t++) {
      const v = new Contexto(p.proyeccion, { actor: 'ana', rng: p.dado.tirar, lugares: p.lugares }).ctx
      if (v.self.holding.some((b) => b.id === 'vara')) {
        conLaVara += 1
        const clave = contextoDe(v, 'vara')
        claves.add(clave)
        // La misma frontera con la que `lugarDe` separa el agua de la tierra, y
        // leída del mismo lado: `AGUA_FRANCA` de `@anima/plan`.
        celdas.add(v.qAt(v.self.at, 'wet') >= AGUA_FRANCA ? 'agua' : 'tierra')
        if (filas.length < 12) {
          filas.push(
            `  t=${String(t).padStart(2)} wet=${v.qAt(v.self.at, 'wet').toFixed(2)} ctx(vara)=${clave.padEnd(13)} tags=${JSON.stringify(mem.tagsDe(clave))}`,
          )
        }
      }
      m.pensar(p)
      p.avanzar(1)
    }

    console.log(
      '\n─── LA MISMA VARA, EN LA MISMA MANO, EN CELDAS DISTINTAS ───\n' +
        filas.join('\n') +
        `\n  ticks con la vara en la mano: ${String(conLaVara)}\n` +
        `  clases de celda pisadas: ${[...celdas].join(' y ')}\n` +
        `  claves distintas para el mismo cuerpo: ${[...claves].join(' y ')}\n`,
    )

    // La premisa: la corrida efectivamente la pasea por celdas de las dos clases.
    // Sin eso, «una sola clave» sería verdad por no haberse movido.
    expect(conLaVara).toBeGreaterThan(5)
    expect(celdas).toEqual(new Set(['agua', 'tierra']))
    // Y la clave es UNA, la de la mano. Antes eran `tierra|m--re` y `agua|m--re`.
    expect([...claves]).toEqual(['mano|m--re'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §5 · EL REFLEJO SE COME UN PASO DEL PLAN
// ─────────────────────────────────────────────────────────────────────────────

describe('§5 · D0 pisaba `enVuelo` y el paso interrumpido no volvía a la cola', () => {
  /**
   * `entregar` es el único lugar que escribe `enVuelo`, y escribe sin mirar lo
   * que había. Para D5 da igual —cuando D5 corre no hay plan— pero D0 corre
   * PRIMERO, o sea que puede pisar un paso de plan a mitad de camino.
   *
   * Y el paso pisado no vuelve a `pasosPendientes`. Cuando la huida termina bien,
   * D1 sigue por `pasosPendientes[0]`, que es **el paso siguiente al que se
   * estaba haciendo**. Con la cadena de la caña eso es «atá la vara que nunca
   * agarraste».
   *
   * Se demuestra sobre la escalera pelada porque el mecanismo es de ahí: tres
   * pasos, un tick de fuego en el medio, y la lista de lo que efectivamente se
   * entregó al ejecutor.
   */
  /**
   * La corrida: tres pasos, y el fuego cae en el tick 1, **con el primer paso
   * todavía en el aire**. Que esté en el aire es la condición: un `ir` de ocho
   * celdas son ocho ticks, así que ésta es la situación normal y no la rara.
   */
  function laHuidaEnElMedio(): { entregados: string[]; historia: string[]; pendientesTrasElFuego: string[] } {
    const pasos: readonly Step[] = [
      { k: 'sostener', que: { k: 'id', id: 'vara' }, porQue: 'meta' },
      { k: 'sostener', que: { k: 'id', id: 'matorral' }, porQue: 'meta' },
      { k: 'sostener', que: { k: 'id', id: 'piedra' }, porQue: 'meta' },
    ]
    const cuerpos: readonly BodyView[] = ['vara', 'matorral', 'piedra'].map((id) => ({
      id,
      at: { x: 0, y: 0 },
      name: id,
      tags: [],
      madeByMe: false,
      joints: [],
    }))
    const templada = (fuego: boolean): VistaDeLaMente =>
      vistaPelada({
        stamina: 500,
        temperaturaDelCuerpo: 15,
        // 900 °C en la celda es lo que dispara D0; 15 es la temperatura ambiente.
        temperaturaDeLaCelda: fuego ? 900 : 15,
        cobijo: 0,
        reloj: { phase: 'dia', secondsToNightfall: 100, dayLength: 200 },
        cuerpos,
      })

    const e = nuevoEstado()
    e.metaEnCurso = 'holding(tag:carnoso)'
    e.porQuien = 'D3'
    e.pasosPendientes = [...pasos]
    const entregados: string[] = []
    const historia: string[] = []
    let pendientesTrasElFuego: string[] = []

    for (let t = 0; t < 5; t++) {
      avanzarReloj(e)
      const arde = t === 1
      const d: Decision = decidir(templada(arde), e, { actor: 'ana' })
      const que = d.k === 'volar' ? nombre(d.paso) : d.k
      historia.push(
        `  t=${String(t)} ${arde ? 'FUEGO ' : '      '}${d.por}/${d.k} → ${que}` +
          `  | enVuelo=${e.enVuelo === undefined ? '—' : nombre(e.enVuelo)} pendientes=[${e.pasosPendientes.map(nombre).join(', ')}]`,
      )
      if (d.k === 'volar') entregados.push(nombre(d.paso))
      if (arde) pendientesTrasElFuego = e.pasosPendientes.map(nombre)
      // El vuelo del tick 0 NO aterriza: sigue en el aire cuando llega el fuego,
      // que es lo que pasa con cualquier `ir` de más de una celda. Los demás sí.
      if (t !== 0 && e.enVuelo !== undefined) aterrizar(e, true)
    }
    return { entregados, historia, pendientesTrasElFuego }
  }

  it('REPARADO · el paso que la huida interrumpe vuelve a la cabeza de la cola', () => {
    const r = laHuidaEnElMedio()
    console.log(
      '\n─── UN PLAN DE TRES PASOS CON EL FUEGO EN EL TICK 1 ───\n' +
        r.historia.join('\n') +
        `\n  entregados al ejecutor: ${r.entregados.join(' → ')}\n` +
        `  la cola justo después del reflejo: [${r.pendientesTrasElFuego.join(', ')}]\n`,
    )

    // ANTES: la cola justo después del reflejo era `[sostener(matorral),
    // sostener(piedra)]` y `sostener(vara)` se entregaba UNA sola vez —cortado en
    // vuelo y nunca reentregado—, así que el plan se reanudaba salteando el
    // eslabón que estaba a mitad de camino. Con la cadena de la caña eso es «atá
    // la vara que nunca agarraste».
    expect(r.entregados[0]).toBe('sostener(vara)')
    expect(r.entregados[1]).toBe('huir')
    // AHORA: el paso pisado encabeza la cola, y se vuelve a entregar cuando la
    // huida termina. El plan se reanuda DONDE ESTABA, no un eslabón más adelante.
    expect(r.pendientesTrasElFuego).toEqual(['sostener(vara)', 'sostener(matorral)', 'sostener(piedra)'])
    expect(r.entregados.filter((x) => x === 'sostener(vara)').length).toBe(2)
    expect(r.entregados[2]).toBe('sostener(vara)')
    expect(r.entregados[3]).toBe('sostener(matorral)')
    // Y no se pierde ni se duplica ningún otro: los tres pasos del plan se
    // entregan, en orden, con la huida metida en el medio.
    expect(r.entregados.slice(0, 5)).toEqual([
      'sostener(vara)',
      'huir',
      'sostener(vara)',
      'sostener(matorral)',
      'sostener(piedra)',
    ])
  })

  /**
   * LA CONDICIÓN QUE HACE QUE ESTO NO SE VUELVA UN BUCLE: el reflejo NO se
   * re-dispara sobre sí mismo. Mientras `huir` esté en el aire, D0 contesta
   * `seguir`, así que el paso devuelto a la cola no se puede pisar dos veces por
   * el mismo fuego. Se mide con el fuego prendido tres ticks seguidos.
   */
  it('el fuego sostenido no devuelve el paso una vez por tick: la huida se sigue', () => {
    const pasos: readonly Step[] = [
      { k: 'sostener', que: { k: 'id', id: 'vara' }, porQue: 'meta' },
      { k: 'sostener', que: { k: 'id', id: 'matorral' }, porQue: 'meta' },
    ]
    const cuerpos: readonly BodyView[] = ['vara', 'matorral'].map((id) => ({
      id,
      at: { x: 0, y: 0 },
      name: id,
      tags: [],
      madeByMe: false,
      joints: [],
    }))
    const templada = (fuego: boolean): VistaDeLaMente =>
      vistaPelada({
        stamina: 500,
        temperaturaDelCuerpo: 15,
        temperaturaDeLaCelda: fuego ? 900 : 15,
        cobijo: 0,
        reloj: { phase: 'dia', secondsToNightfall: 100, dayLength: 200 },
        cuerpos,
      })

    const e = nuevoEstado()
    e.metaEnCurso = 'holding(tag:carnoso)'
    e.porQuien = 'D3'
    e.pasosPendientes = [...pasos]
    const entregados: string[] = []
    for (let t = 0; t < 6; t++) {
      avanzarReloj(e)
      const d = decidir(templada(t >= 1 && t <= 3), e, { actor: 'ana' })
      if (d.k === 'volar') entregados.push(nombre(d.paso))
      // El primer paso sigue EN EL AIRE cuando llega el fuego —que es la condición
      // del hallazgo— y la huida también dura más de un tick.
      if (t >= 4 && e.enVuelo !== undefined) aterrizar(e, true)
    }
    console.log(`\n─── FUEGO EN LOS TICKS 1-3 ───\n  entregados: ${entregados.join(' → ')}\n`)
    // UNA huida y no tres, y el paso vuelve a la cola UNA vez.
    expect(entregados.filter((x) => x === 'huir').length).toBe(1)
    expect(entregados.filter((x) => x === 'sostener(vara)').length).toBe(2)
    expect(e.pasosPendientes.length).toBeLessThanOrEqual(pasos.length)
  })
})

/** El nombre corto de una intención, sólo para leer las corridas de arriba. */
function nombre(i: Intencion): string {
  if (i.k === 'sostener' && i.que.k === 'id') return `sostener(${i.que.id})`
  return i.k
}

// ─────────────────────────────────────────────────────────────────────────────
// §6 · LO QUE AGUANTÓ EL ATAQUE
// ─────────────────────────────────────────────────────────────────────────────

describe('§6 · lo que no se rompió, medido igual', () => {
  /**
   * El determinismo aguanta. Dos corridas de 2000 ticks sobre la misma semilla
   * dan la MISMA historia de decisiones, peldaño por peldaño y despegue por
   * despegue, y el mundo termina con el mismo hash.
   */
  it('dos corridas de 2000 ticks son idénticas, decisión por decisión', () => {
    const historia = (): string[] => {
      const p = new Partida(laEscena(310))
      const m = new Mente({ actor: 'ana', memoria: new Creencias() })
      const out: string[] = []
      for (let t = 0; t < 2000; t++) {
        if (!p.state.actors.has('ana')) break
        const antes = m.despegues
        const d = m.pensar(p)
        out.push(`${d.por}/${d.k}${m.despegues > antes ? `:${m.ultimoDespegue ?? '?'}` : ''}`)
        p.avanzar(1)
      }
      return out
    }
    // 2000 ticks × 2 sobre el mundo materializado: ver la nota de plazo del §1.
    const a = historia()
    const b = historia()
    console.log(`\n─── DETERMINISMO ───\n  ${String(a.length)} decisiones, ${a.length === b.length && a.every((x, i) => x === b[i]) ? 'idénticas' : 'DISTINTAS'}\n`)
    expect(b).toEqual(a)
  }, 300_000)

  /**
   * La memoria de creencias NO crece, y la razón hay que decirla porque es peor
   * que un tope: no crece porque **nadie escribe nunca**. `observe()` no se llama
   * desde `mente.ts` (está dicho en su decisión 6) y `belief()` no crea casillero.
   *
   * O sea que la pregunta «qué desaloja» no tiene respuesta porque no hay nada
   * que desalojar: después de 20.000 ticks la memoria tiene exactamente las cinco
   * filas del instinto con las que nació, repartidas en cinco contextos de los
   * 64 posibles.
   */
  it('la memoria de creencias después de 20.000 ticks: las mismas 5 filas del instinto', () => {
    const p = new Partida(laEscena(310))
    const mem = new Creencias()
    const m = new Mente({ actor: 'ana', memoria: mem })
    for (let t = 0; t < 20000; t++) {
      if (!p.state.actors.has('ana')) break
      m.pensar(p)
      p.avanzar(1)
    }

    // Las 2 × 32 claves que `contextoDe` puede producir, enumeradas del catálogo.
    let contextos = 0
    let casilleros = 0
    for (const lugar of LUGARES) {
      for (let mascara = 0; mascara < 1 << RASGOS.length; mascara++) {
        let forma = ''
        for (let i = 0; i < RASGOS.length; i++) {
          forma += (mascara & (1 << i)) === 0 ? '-' : (RASGOS[i]?.letra ?? '?')
        }
        const n = mem.tagsDe(`${lugar}|${forma}`).length
        if (n > 0) contextos += 1
        casilleros += n
      }
    }
    console.log(
      `\n─── LA MEMORIA DESPUÉS DE 20.000 TICKS ───\n` +
        `  contextos con algo escrito: ${String(contextos)} de ${String(LUGARES.length * (1 << RASGOS.length))}\n` +
        `  casilleros totales: ${String(casilleros)}\n`,
    )
    expect(casilleros).toBe(5)
    expect(contextos).toBe(5)
    // 20.000 ticks sobre el mundo materializado: ver la nota de plazo del §1.
  }, 900_000)
})
