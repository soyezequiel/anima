// ═══ EL CRITERIO DE CORTE DEL PROYECTO, MEDIDO ══════════════════════════════
//
// El documento de arquitectura le pide al Hito 5 cuatro cosas, CON EL PROVEEDOR
// APAGADO, y de las cuatro depende que haya producto aunque el modelo nunca se
// conecte:
//
//   (1) con hambre y un río a la vista, la criatura deshilacha un matorral, ata
//       una vara, va y pesca. Sin una sola llamada al modelo.
//   (2) sobrevive 20.000 ticks sola.
//   (3) p99 de tick < 5 ms con 5000 cuerpos.
//   (4) `ticksPerdidos === 0` durante toda la corrida.
//
// Este archivo mide (1), (2) y (4). El (3) YA ESTÁ MEDIDO Y ACEPTADO fallando
// por 5 a 7× en `world/tests/banco-el-camino-de-intenciones.test.ts`, y acá se
// CITA con su número en vez de volver a medirlo peor: un banco de milisegundos
// corriendo al lado de los otros paquetes mide la contención tanto como el
// código, y ese archivo ya lo dice con la corrida entera. Lo único que se hace
// acá con el (3) es verificar que la cita no envejeció.
//
// ═══ EL VEREDICTO, ARRIBA Y SIN ADORNOS ═════════════════════════════════════
//
//   (1) SE CUMPLE en lo sustancial y NO en la letra.
//
//       La cadena entera sale sola contra `stepWorld`, sin proveedor y sin que
//       nadie le diga qué hacer: de «me falta aliento» a un pescado en la mano,
//       en siete eslabones y 35 ticks. Lo que NO sale es el eslabón
//       `deshilachar` que la frase del documento nombra, y no porque la mente no
//       sepa: porque ESTA FÍSICA NO LO PIDE. Medido con cinco matorrales
//       distintos —de 0,2 a 2 kg, en hebra y en bloque—: los cinco se atan
//       derecho a la vara y ninguno necesita partirse antes. Está clavado en un
//       `it.fails` más abajo para que la diferencia no se pierda.
//
//   (2) NO SE CUMPLE. La criatura se muere de hambre en el tick 6194 de 20.000
//       —el 31%— con 199 pescas hechas y CERO bocados comidos.
//
//       Y no es un problema de escala ni de afinar un número: **el bucle de la
//       necesidad no está cerrado**. Tres mediciones lo dicen entero:
//
//         · la mente NUNCA emite `comer`. No tiene por dónde: `opportunities()`
//           sólo fabrica metas `holding(tag:…)` —tener algo en la mano— y las
//           tres conductas de fondo de D5 son guarecerse, juntar y deambular.
//           Ninguna de las dos puntas del camino nombra la boca;
//         · y aunque la emitiera, la innata RECHAZARÍA el pescado: `comer` filtra
//           por `toxicity <= 0,2` y el pescado crudo que ella misma sacó del agua
//           mide 0,2761. No es que se pudrió: la sustancia `pescado` nace en
//           0,25 en el catálogo de la semilla. El pescado crudo es incomible por
//           diseño, y quien lo baja es la cocción —la ley 5 «sube
//           `digestibility`, baja `toxicity` y `decay`»— o sea el fuego, que la
//           mente tampoco sabe querer. CUÁNTO hay que cocinarlo para cruzar el
//           0,2 este archivo no lo midió: es del mundo, no de la mente;
//         · forzándola a comer, el pescado le da +8,37 de aliento en 2 ticks, o
//           sea 167 ticks de vida. Para llegar a 20.000 le faltaban 13.805 ticks,
//           o sea unos 83 pescados. PESCÓ 199. Se murió de hambre arriba de dos
//           veces y media la comida que necesitaba.
//
//       El número que hace que esto no sea opinable: **20.000 ticks a 20 Hz son
//       1000 segundos de mundo, `COSTO_VIVIR_POR_SEGUNDO` es 1,0 y el tanque de
//       `stamina` topa en 1000.** O sea que el criterio (2), dicho en la moneda
//       del mundo, es literalmente «comé al menos una vez». Medido: con el tanque
//       LLENO tampoco llega — se muere en el 19.995, a CINCO ticks del final,
//       porque además de vivir caminó las cinco celdas de la cadena de la caña.
//       (Antes de la reparación del tramo G eran 18.524: se quedaba pegada a una
//       meta que ningún esquema establece y se pasaba media vida deambulando.)
//
//   (4) SE CUMPLE, y medido con un reloj de pared de verdad, que es la única
//       forma de que el contador pueda moverse. Sin reloj, `porTiempo` es cero
//       POR CONSTRUCCIÓN (`bucle.ts`: «sin reloj de pared no hay ninguna ventana
//       que vencer») y un `expect(0)` no mediría nada. Con reloj: entre 0,11 y
//       0,13 ms de trabajo por tick contra una ventana de 50 ms, y CERO ticks
//       perdidos en los 20.000, ni por tiempo ni por falla. Sobra un factor de
//       unas 400 veces. (Los milisegundos se mueven entre corridas porque son
//       reloj de máquina; los que gobiernan son los que imprime la corrida de
//       hoy, no los de este comentario. Lo que no se mueve es el cero.)
//
//       De ese total, el mundo se lleva ~0,04 ms y la mente ~0,12 —medido
//       aparte, sobre 4000 ticks con una criatura—: la escalera cuesta unas tres
//       veces el `stepWorld` de este mundito, y las dos juntas entran cientos de
//       veces en la ventana. Lo que hace inalcanzable el (3) no es la mente: son
//       5000 cuerpos de física, que es lo que aquel banco ya diagnosticó.
//
// ═══ CÓMO SE MIDE ACÁ ═══════════════════════════════════════════════════════
//
// Los números se IMPRIMEN siempre y se AFIRMAN siempre, salvo el único que
// depende del reloj del sistema (el de pared del criterio 4), que sigue el patrón
// ya decidido del proyecto —`ANIMA_BANCO=1`— porque un test de rendimiento
// adentro de la suite normal es flaky, y un test flaky enseña a ignorar el rojo.
//
// Y lo que no se cumple NO se ablanda: va en `it.fails` con la salida medida al
// lado, que es el idioma con el que este repositorio ya dejó abiertos el techo
// del tick y los diez huecos de `admit()`.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { HZ_DE_REFERENCIA, qualityOf, specOf } from '@anima/physics'
import type { QualityId } from '@anima/physics'
import { COSTO_VIVIR_POR_SEGUNDO } from '@anima/world'
import type { WorldState } from '@anima/world'
import { Contexto, Partida } from '@anima/perceive'
import { EXPANSIONES_POR_TICK, interpretar, plan } from '@anima/plan'
import type { GoalNode, Step } from '@anima/plan'
import { comer } from '@anima/skills/innatas'

import { Creencias } from '../src/creencias.js'
import { Mente, vivir } from '../src/mente.js'
import { necesidades } from '../src/necesidades.js'
import { opportunities } from '../src/oportunidades.js'
import type { VistaDeLaMente } from '../src/tipos.js'
import { actor, criatura, cuerpo, enElPiso, laOrilla, mundo } from './mundo.js'

/** El único número que se afirma contra el reloj del sistema. Ver el encabezado. */
const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

/** Los ticks del criterio (2). No es un largo elegido acá: es el del documento. */
const CRITERIO_TICKS = 20_000

// ─── La escena del documento ─────────────────────────────────────────────────

/**
 * «Con hambre y un río a la vista», sobre la orilla DE VERDAD de la semilla.
 *
 * El río no se inventa: `laOrilla()` barre los chunks del dios hasta encontrar
 * uno con pozo y una celda seca pegada, y el banco de peces lo materializa
 * `stepWorld` desde el decreto. Un cuerpo puesto a mano con el mismo nombre no
 * es un pozo para `extraccion`.
 *
 * Los dos números de la escena y qué compran, medidos:
 *
 *   · **stamina 310 de 1000** — con el tanque lleno `energia` vale 0,0025 y D3
 *     no elige comida. Con 310 vale 0,48, que es lo que hace que la meta gane;
 *   · **el matorral pesa 0,2 kg** — un `hebra` de liana de 1 kg ya es aparejo
 *     solo (`reach = 6 × masa`), y entonces el plan que sale es «andá y pescá
 *     con el matorral», de tres pasos. Con 0,2 kg el alcance cae a 1,2 y la
 *     única forma de llegar a `reach >= 2` es atarlo a la vara, que es la cadena
 *     que el criterio pide.
 */
function laEscenaDelDocumento(stamina = 310, masa = 0.2, forma: 'hebra' | 'bloque' = 'hebra'): WorldState {
  const o = laOrilla()
  const p = o.parada
  return mundo({
    dios: o.dios,
    bodies: [
      enElPiso(criatura('ana', stamina), p),
      enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: p.x + 3, y: p.y }),
      enElPiso(cuerpo('matorral', 'liana', masa, {}, forma), { x: p.x - 2, y: p.y + 1 }),
    ],
    actors: [actor('ana', { capacity: 3 })],
  })
}

function aliento(p: Partida, quien: string): number {
  const b = p.state.bodies.get(`${quien}-cuerpo`)
  return b === undefined ? 0 : qualityOf(b.body, 'stamina', p.state.phys)
}

/** La vista de la mente, armada como la arma la mente: con el `Ctx` de producción. */
function vistaDe(p: Partida, quien: string): VistaDeLaMente {
  return new Contexto(p.proyeccion, { actor: quien, rng: p.dado.tirar, lugares: p.lugares }).ctx
}

// ─── La corrida ──────────────────────────────────────────────────────────────

interface Corrida {
  /** Ticks que avanzó EL MUNDO. Llega a `n` aunque la criatura se muera antes. */
  readonly ticks: number
  readonly ticksPerdidos: number
  readonly porTiempo: number
  readonly porFalla: number
  /** El tick en que la criatura se fue de `state.actors`, o `-1` si llegó viva. */
  readonly murioEn: number
  readonly alientoFinal: number
  /** Qué despegó y en qué tick. Una línea por vuelo, no por tick. */
  readonly volados: readonly string[]
  /** Lo mismo sin el tick adelante, para comparar contra la cadena esperada. */
  readonly nombres: readonly string[]
  /** En qué tick despegó cada vuelo, en el mismo orden que `nombres`. */
  readonly cuando: readonly number[]
  readonly cuenta: ReadonlyMap<string, number>
  readonly aliento: readonly string[]
  readonly ms: number
  readonly partida: Partida
  readonly mente: Mente
}

/**
 * `n` ticks de mundo con UNA mente puesta, por el bucle de producción.
 *
 * Se llama a `vivir(p, mentes, 1)` y no a `vivir(p, mentes, n)` de una: es
 * exactamente el mismo bucle —la única diferencia es dónde está el `for`— y
 * permite anotar tick a tick sin escribir una segunda copia del bucle que
 * después habría que creerle. El mundo sigue avanzando después de que la
 * criatura se muere, porque el criterio (4) habla de LA CORRIDA y no de la
 * criatura: 20.000 ticks son 20.000 ventanas, las viva alguien o no.
 */
function correr(w: WorldState, quien: string, n: number, o: { reloj?: boolean } = {}): Corrida {
  const p =
    o.reloj === true
      ? new Partida(w, { reloj: () => Number(process.hrtime.bigint()) / 1e6 })
      : new Partida(w)
  const m = new Mente({ actor: quien, memoria: new Creencias() })
  const mentes = new Map([[quien, m]])
  const volados: string[] = []
  const nombres: string[] = []
  const cuando: number[] = []
  const cuenta = new Map<string, number>()
  const curva: string[] = []
  let murioEn = -1
  let ultimoAliento = 0

  const t0 = process.hrtime.bigint()
  for (let t = 0; t < n; t++) {
    const antes = m.despegues
    vivir(p, mentes, 1)
    if (m.despegues > antes) {
      const nombre = m.ultimoDespegue ?? '?'
      volados.push(`  ${String(t).padStart(5)}  ${nombre}`)
      nombres.push(nombre)
      cuando.push(t)
      cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1)
    }
    if (murioEn < 0) {
      if (p.state.actors.has(quien)) ultimoAliento = aliento(p, quien)
      else murioEn = t
    }
    if (t % 2000 === 0) curva.push(`${String(t)}:${aliento(p, quien).toFixed(1)}`)
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  const i = p.informe

  return {
    ticks: i.ticks,
    ticksPerdidos: i.ticksPerdidos,
    porTiempo: i.porTiempo,
    porFalla: i.porFalla,
    murioEn,
    alientoFinal: murioEn < 0 ? aliento(p, quien) : ultimoAliento,
    volados,
    nombres,
    cuando,
    cuenta,
    aliento: curva,
    ms,
    partida: p,
    mente: m,
  }
}

/** Lo que la criatura tiene en la mano, por sustancia. */
function enLaMano(p: Partida, quien: string): string[] {
  const a = p.state.actors.get(quien)
  const out: string[] = []
  for (const id of a?.holding ?? []) {
    const b = p.state.bodies.get(id)
    if (b !== undefined) out.push(b.body.parts.map((x) => x.substance).join('+'))
  }
  return out
}

function calorias(p: Partida, quien: string): number {
  const a = p.state.actors.get(quien)
  let total = 0
  for (const id of a?.holding ?? []) {
    const b = p.state.bodies.get(id)
    if (b !== undefined) total += qualityOf(b.body, 'calories', p.state.phys)
  }
  return total
}

const dos = (x: number): string => x.toFixed(2)

// ─── Lo medido, para el cuadro final ─────────────────────────────────────────

/**
 * Lo que cada bloque midió, para poder imprimir el cuadro de los cuatro criterios
 * al final con NÚMEROS y no con veredictos. Se llena a medida que corren los
 * tests —vitest corre un archivo en orden— y lo que falte sale como `—`.
 */
const MEDIDO = new Map<string, string>()

// ═══ (0) EL PROVEEDOR ESTÁ APAGADO, Y NO ES UNA PROMESA ═════════════════════

const PAQUETES = fileURLToPath(new URL('../../', import.meta.url))

describe('(0) el proveedor apagado: no hay con qué llamar a un modelo', () => {
  it('los siete paquetes de `ii/` no dependen de NADA que no sea `ii/`', () => {
    const nombres = readdirSync(PAQUETES, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
    const ajenas: string[] = []
    const filas: string[] = []
    for (const n of nombres) {
      const j = JSON.parse(readFileSync(`${PAQUETES}${n}/package.json`, 'utf8')) as {
        dependencies?: Record<string, string>
      }
      const deps = Object.entries(j.dependencies ?? {})
      for (const [d, v] of deps) if (v !== 'workspace:*') ajenas.push(`${n} → ${d}@${v}`)
      filas.push(`  ${n.padEnd(9)} ${deps.length === 0 ? '(ninguna)' : deps.map(([d]) => d).join(' ')}`)
    }
    console.log(`\n─── LAS DEPENDENCIAS DE RUNTIME DE \`ii/\` ───\n${filas.join('\n')}\n`)
    // Cero dependencias de runtime fuera del workspace. Un cliente de un modelo
    // no es algo que se escriba a mano en 3000 líneas: viene en un paquete, y no
    // hay ninguno. `typescript` y `vitest` son `devDependencies` y no entran acá.
    expect(ajenas).toEqual([])
    expect(nombres).toContain('mind')
  })

  it('y en `src/` no hay una sola llamada a la red, con los comentarios sacados', () => {
    // Con los comentarios sacados porque los hay, y hablan del tema: el sandbox de
    // `@anima/skills` tiene a `fetch`, `XMLHttpRequest` y `WebSocket` en su lista
    // de PROHIBIDOS —«una habilidad no habla con afuera; lo que sabe lo sabe por
    // `ctx`»— y un grep crudo contaría esa prohibición como una llamada.
    // `import(` está en la lista porque un import dinámico puede traer lo que sea
    // y no aparecería en `package.json`. El ÚNICO del repositorio es
    // `export type ApiTS = typeof import('typescript')` en `skills/combustible.ts`
    // —un import de TIPO, que TypeScript borra y que no deja un byte en el
    // bundle— y por eso se lo saca antes de buscar, con su forma exacta y no
    // apagando la regla entera.
    const PROHIBIDO: readonly (readonly [string, RegExp])[] = [
      ['fetch(', /\bfetch\s*\(/],
      ['new XMLHttpRequest', /new\s+XMLHttpRequest/],
      ['new WebSocket', /new\s+WebSocket/],
      ['node:http', /['"]node:https?['"]/],
      ['node:net', /['"]node:net['"]/],
      ['import( dinámico', /\bimport\s*\(/],
    ]
    const hallazgos: string[] = []
    let archivos = 0
    for (const paquete of readdirSync(PAQUETES, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      for (const f of fuentesDe(`${PAQUETES}${paquete.name}/src`)) {
        archivos += 1
        const limpio = sinComentarios(readFileSync(f, 'utf8')).replace(/typeof\s+import\s*\(/g, ' ')
        for (const [nombre, re] of PROHIBIDO) {
          if (re.test(limpio)) hallazgos.push(`${paquete.name}/${f.slice(f.lastIndexOf('/') + 1)}: ${nombre}`)
        }
      }
    }
    console.log(`\n  ${String(archivos)} archivos de \`src/\` barridos, ${String(hallazgos.length)} llamadas a la red\n`)
    expect(hallazgos).toEqual([])
    expect(archivos).toBeGreaterThan(30)
  })

  it('y la corrida canónica no toca `fetch` ni una vez, contado sobre el global', () => {
    // El barrido de arriba dice que no hay código escrito que llame; esto dice que
    // tampoco pasó. Son dos cosas distintas: un `eval`, un `Function(...)` o una
    // dependencia transitiva no aparecerían en el grep y sí acá.
    const real = globalThis.fetch
    let llamadas = 0
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: (...a: unknown[]): never => {
        llamadas += 1
        throw new Error(`la mente llamó a fetch: ${JSON.stringify(a[0])}`)
      },
    })
    try {
      const r = correr(laEscenaDelDocumento(), 'ana', 400)
      expect(r.murioEn).toBe(-1)
      expect(enLaMano(r.partida, 'ana')).toContain('pescado')
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: real })
    }
    expect(llamadas).toBe(0)
    MEDIDO.set('proveedor', '0 llamadas a la red · 0 dependencias de runtime fuera de `ii/`')
  })
})

/** Los `.ts` de un `src/`, recursivo. Un archivo nuevo entra solo. */
function fuentesDe(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...fuentesDe(p))
    else if (e.name.endsWith('.ts')) out.push(p)
  }
  return out
}

/**
 * El fuente sin comentarios de línea ni de bloque.
 *
 * Es deliberadamente ingenuo —no entiende de cadenas que contengan `//`— y es
 * suficiente para lo que se le pide: el barrido busca formas que sólo aparecen
 * como código (`fetch(`, `new WebSocket`), y una cadena que contuviera eso sería
 * un hallazgo que igual habría que mirar.
 */
function sinComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
}

// ═══ (1) LA CADENA DE LA CAÑA, Y QUE LA MENTE LLEGA SOLA ════════════════════

describe('(1) con hambre y un río: la mente llega sola a la caña y al pescado', () => {
  it('nadie le dijo qué hacer: la meta sale de necesidades × creencia / costo', () => {
    // La `Mente` se construye con DOS cosas: quién es y su memoria vacía. No hay
    // `drive` —el campo por donde el chat le diría qué hacer, y que en el Hito 6
    // va a existir— y no hay un objetivo escrito en ningún lado de la escena.
    const p = new Partida(laEscenaDelDocumento())
    const v = vistaDe(p, 'ana')
    const memoria = new Creencias()

    // 1. QUÉ DUELE. Sale del cuerpo, no de una tabla de guion.
    const n = necesidades(v)
    expect(n.energia).toBeGreaterThan(n.calor)
    expect(n.energia).toBeGreaterThan(n.refugio)

    // 2. QUÉ PODRÍA QUERER. Sale de la necesidad, de lo que cree que rinde cada
    //    contexto y de cuánto aliento cuesta llegar. La lista la arma
    //    `opportunities()` sola, mirando el mundo.
    const ops = opportunities(v, memoria, n)
    const mejor = ops[0]
    expect(mejor).toBeDefined()
    if (mejor === undefined) throw new Error('imposible')
    expect(mejor.meta).toBe('holding(tag:carnoso)')
    // Y la creencia con la que gana es INSTINTO, no experiencia y no un modelo:
    // `n = 0` quiere decir que no hay una sola observación propia detrás.
    expect(mejor.porque).toContain('n=0')

    // 3. CÓMO SE HACE. Es `plan()` de `@anima/plan` sobre la misma vista, y da la
    //    cadena entera. Se lo pide acá DIRECTO para que se vea que la mente no
    //    guarda ninguna receta: lo que sabe es regresar la meta contra el mundo.
    const pred = interpretar(mejor.meta)
    expect(pred).toBeDefined()
    if (pred === undefined) throw new Error('imposible')
    const g: GoalNode = { id: 'meta', goal: pred, after: [], porque: 'el test' }
    const r = plan(g, v, EXPANSIONES_POR_TICK)
    expect(r.k).toBe('plan')
    if (r.k !== 'plan') throw new Error('imposible')

    // 4. Y ES EXACTAMENTE LO QUE LA MENTE DECIDE. La escalera no agrega ni saca.
    const m = new Mente({ actor: 'ana', memoria: new Creencias() })
    const d = m.pensar(p)
    expect(d.k).toBe('plan')
    if (d.k !== 'plan') throw new Error('imposible')
    expect(d.por).toBe('D3')
    expect(d.meta).toBe(mejor.meta)
    expect(d.pasos.map(resumir)).toEqual(r.steps.map(resumir))

    console.log(
      `\n─── DE DÓNDE SALE LA META, CAPA POR CAPA ───\n` +
        `  necesidades:  energía ${dos(n.energia)} · calor ${dos(n.calor)} · refugio ${dos(n.refugio)}\n` +
        `  oportunidades (${String(ops.length)}):\n` +
        ops.map((o) => `    ${o.meta.padEnd(22)} valor ${dos(o.valor)}  ${o.id}\n      ${o.porque}`).join('\n') +
        `\n  plan():       ${r.steps.map(resumir).join(' → ')}\n` +
        `  la mente:     D${d.por.slice(1)} · ${d.porque}\n`,
    )
  })

  it('CRITERIO DE CORTE: la cadena entera contra `stepWorld`, y el pescado en la mano', () => {
    const r = correr(laEscenaDelDocumento(), 'ana', 400)

    expect(r.nombres.slice(0, 7)).toEqual([
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(matorral+vara)',
      'ir(pozo:-6:-6)',
      'aplicar(extraccion)',
    ])
    // Y el pescado ESTÁ, sacado del agua por `extraccion` contra un banco que
    // decretó el dios. De «me falta aliento» a «tengo algo carnoso», sin proveedor.
    expect(enLaMano(r.partida, 'ana')).toContain('pescado')
    expect(calorias(r.partida, 'ana')).toBeGreaterThan(0)
    expect(r.ticksPerdidos).toBe(0)
    expect(r.murioEn).toBe(-1)

    const primeraPesca = r.cuando[r.nombres.indexOf('aplicar(extraccion)')]
    MEDIDO.set(
      'cadena',
      `7 eslabones, primera pesca en el tick ${String(primeraPesca ?? -1)}, ` +
        `${dos(calorias(r.partida, 'ana'))} calorías en la mano`,
    )
    console.log(
      `\n─── LA CADENA DE LA CAÑA, CONTRA EL MUNDO DE VERDAD ───\n${r.volados.slice(0, 8).join('\n')}\n` +
        `  en la mano: ${enLaMano(r.partida, 'ana').join(' · ')} (${dos(calorias(r.partida, 'ana'))} calorías)\n`,
    )
  })

  it.fails('LA LETRA DEL DOCUMENTO: «deshilacha un matorral» — esta física no lo pide', () => {
    // POR QUÉ FALLA, Y POR QUÉ NO SE BORRA LA FRASE: el documento describe cuatro
    // eslabones —deshilachar, atar, ir, pescar— y la mente hace tres. El que falta
    // no falta por ignorancia: `deshilachar` está entre las quince, la mente la
    // sabe traducir y correr (medido en `la-mente.test.ts`, tabla de las doce), y
    // el planificador tiene tres esquemas que la usan. Lo que pasa es que NINGUNA
    // de las cinco escenas razonables la necesita.
    //
    // MEDIDO, con cinco matorrales de liana distintos sobre la misma orilla:
    //
    //   0,2 kg hebra   ir → sostener → ir → sostener → unir → ir → aplicar
    //   0,2 kg bloque  ir → sostener → ir → sostener → unir → ir → aplicar
    //   1 kg bloque    ir → sostener → ir → sostener → unir → ir → aplicar
    //   2 kg bloque    ir → sostener → ir → sostener → unir → ir → aplicar
    //   2 kg hebra     ir → ir → aplicar          (¡ni siquiera necesita la vara!)
    //
    // La razón es de la física y está escrita en `esquemas.ts`: lo que `union`
    // necesita del atador es `flexibility >= 0,8`, y la flexibilidad es INTENSIVA
    // —la liana la tiene por ser liana, pese lo que pese—. `deshilachar` no
    // fabrica flexibilidad: convierte en hebra algo que YA era flexible. O sea que
    // el eslabón del documento sólo haría falta si atar exigiera la FORMA `hebra`,
    // y no la exige: exige una punta libre, que sale de que el atador pese menos
    // que aquello a lo que se ata (`freeStrandEnds`, `body.ts`).
    //
    // QUÉ HABRÍA QUE CAMBIAR PARA QUE LA FRASE SEA CIERTA: que el matorral pese
    // MÁS que la vara y que `union` lo rechace por eso, o que el rol `binder` pida
    // forma de hebra. Las dos son decisiones de la física o del catálogo, no de la
    // mente. Queda acá, en rojo esperado, para que nadie lea el (1) verde de
    // arriba y crea que la frase del documento se cumplió palabra por palabra.
    const filas: string[] = []
    let alguna = false
    for (const [masa, forma] of [
      [0.2, 'hebra'],
      [0.2, 'bloque'],
      [1, 'bloque'],
      [2, 'bloque'],
      [2, 'hebra'],
    ] as const) {
      const p = new Partida(laEscenaDelDocumento(310, masa, forma))
      const m = new Mente({ actor: 'ana', memoria: new Creencias() })
      const d = m.pensar(p)
      const pasos = d.k === 'plan' ? d.pasos.map((s) => s.k) : [`${d.k}/${d.por}`]
      if (pasos.includes('deshilachar')) alguna = true
      filas.push(`  ${String(masa).padStart(3)} kg ${forma.padEnd(7)} ${pasos.join(' → ')}`)
    }
    console.log(`\n─── ¿ALGUNA ESCENA PIDE \`deshilachar\`? ───\n${filas.join('\n')}\n`)
    MEDIDO.set('deshilachar', 'ninguna de las 5 escenas lo pide: la mente ata derecho')
    expect(alguna, 'ninguna escena produjo un paso `deshilachar`').toBe(true)
  })
})

/** Cómo se lee un paso. Sólo lo que hace falta para comparar dos planes. */
function resumir(s: Step): string {
  switch (s.k) {
    case 'ir':
      return `ir(${corto(s.a)})`
    case 'sostener':
      return `sostener(${corto(s.que)})`
    case 'unir':
      return `unir(${corto(s.binder)}+${corto(s.a)})`
    case 'deshilachar':
      return `deshilachar(${corto(s.fuente)})`
    case 'aplicar':
      return `aplicar(${s.proceso})`
    default:
      return s.k
  }
}

function corto(r: { readonly k: string; readonly id?: string }): string {
  return r.k === 'id' ? (r.id ?? '?') : r.k
}

// ═══ (2) VEINTE MIL TICKS ═══════════════════════════════════════════════════

describe('(2) sobrevive 20.000 ticks sola', () => {
  it('la aritmética del criterio: 20.000 ticks SON exactamente un tanque de aliento', () => {
    // No es una coincidencia y conviene decirlo antes de la corrida: el criterio
    // (2), traducido a la moneda del mundo, dice «comé al menos una vez».
    const tanque = specOf('stamina').range[1]
    const segundos = CRITERIO_TICKS / HZ_DE_REFERENCIA
    const soloVivir = segundos * COSTO_VIVIR_POR_SEGUNDO
    expect(soloVivir).toBe(tanque)
    console.log(
      `\n─── LA ARITMÉTICA DEL CRITERIO ───\n` +
        `  ${String(CRITERIO_TICKS)} ticks ÷ ${String(HZ_DE_REFERENCIA)} Hz = ${String(segundos)} s de mundo\n` +
        `  × COSTO_VIVIR_POR_SEGUNDO (${String(COSTO_VIVIR_POR_SEGUNDO)}) = ${String(soloVivir)} de aliento SÓLO por estar viva\n` +
        `  y el tanque topa en ${String(tanque)}.  O sea: el criterio (2) es «comé al menos una vez».\n`,
    )
    MEDIDO.set('aritmética', `${String(CRITERIO_TICKS)} ticks = ${String(soloVivir)} de aliento = el tanque entero`)
  })

  it.fails('CRITERIO: 20.000 ticks viva — se muere de hambre a un tercio del camino', () => {
    // LA SALIDA MEDIDA, y está impresa abajo por la corrida de verdad:
    //
    //   murió en el tick 6194 de 20.000 (31%), con el aliento en 0
    //   199 × aplicar(extraccion) · 0 × comer
    //   aliento: 0:309,9 → 2000:209,7 → 4000:109,7 → 6000:9,7   (−0,05 por tick, clavado)
    //
    // Los −0,05 por tick son `COSTO_VIVIR_POR_SEGUNDO / hz` y NADA MÁS: después
    // del tick 66 la criatura no camina, se queda al lado del pozo sacando
    // pescados que no come. O sea que no se muere por gastar de más: se muere
    // porque **no hay ningún camino en esta mente que termine en la boca**.
    //
    // POR QUÉ NO SE ABLANDA A «sobrevive lo que pueda»: el criterio es del
    // documento de arquitectura y es el criterio de corte del proyecto. Los tres
    // tests que siguen miden POR QUÉ no llega, que es lo único que sirve para
    // decidir qué se hace.
    const r = correr(laEscenaDelDocumento(), 'ana', CRITERIO_TICKS)
    const pescas = r.cuenta.get('aplicar(extraccion)') ?? 0
    const comidas = [...r.cuenta].filter(([k]) => k.startsWith('comer')).reduce((a, [, v]) => a + v, 0)

    console.log(
      `\n─── VEINTE MIL TICKS ───\n` +
        `  murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} ` +
        `(${((r.murioEn * 100) / CRITERIO_TICKS).toFixed(0)}%)\n` +
        `  aliento: ${r.aliento.join(' ')}\n` +
        `  vuelos:  ${[...r.cuenta].map(([k, v]) => `${k}×${String(v)}`).join(' · ')}\n` +
        `  pescas ${String(pescas)} · bocados ${String(comidas)} · ` +
        `ticks perdidos ${String(r.ticksPerdidos)} · ${r.ms.toFixed(0)} ms de reloj\n`,
    )
    MEDIDO.set(
      'supervivencia',
      `murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} · ${String(pescas)} pescas · ${String(comidas)} bocados`,
    )

    expect(pescas).toBeGreaterThan(100)
    expect(r.ticksPerdidos).toBe(0)
    // EL CRITERIO, dicho como lo dice el documento.
    expect(r.murioEn, `se murió en el tick ${String(r.murioEn)}`).toBe(-1)
  }, 300_000)

  it('DIAGNÓSTICO 1/3 · la mente no tiene por dónde emitir `comer`', () => {
    // No es que le salga mal: no hay camino. Dos portones, los dos medidos:
    //
    //   · `opportunities()` sólo fabrica metas `holding(tag:…)` —`metaDe(tag)` es
    //     `textoDe({k:'sostiene', tag})`— o sea que todo lo que la criatura puede
    //     querer es TENER algo en la mano. Ninguna meta habla de `stamina`;
    //   · y ningún plan para `holding(...)` puede contener un `comer`, porque
    //     comer destruye el bocado en vez de ponerlo en la mano.
    const p = new Partida(laEscenaDelDocumento())
    const v = vistaDe(p, 'ana')
    const memoria = new Creencias()
    const ops = opportunities(v, memoria, necesidades(v))
    expect(ops.length).toBeGreaterThan(0)
    for (const o of ops) expect(o.meta.startsWith('holding(')).toBe(true)

    // Y el plan de la meta ganadora, paso por paso: ni un `comer`.
    const pred = interpretar(ops[0]?.meta ?? '')
    if (pred === undefined) throw new Error('imposible')
    const r = plan({ id: 'meta', goal: pred, after: [], porque: '' }, v, EXPANSIONES_POR_TICK)
    if (r.k !== 'plan') throw new Error('imposible')
    expect(r.steps.map((s) => s.k)).not.toContain('comer')

    // Y en la corrida larga tampoco apareció por ningún otro lado (D5 tiene tres
    // conductas de fondo y ninguna es comer).
    const larga = correr(laEscenaDelDocumento(), 'ana', 2000)
    expect([...larga.cuenta.keys()].filter((k) => k.startsWith('comer'))).toEqual([])
    console.log(
      `\n  metas que la mente puede querer HOY: ${[...new Set(ops.map((o) => o.meta))].join(', ')}\n` +
        `  vuelos en 2000 ticks: ${[...larga.cuenta.keys()].join(', ')} — ninguno es \`comer\`\n`,
    )
  }, 120_000)

  it('DIAGNÓSTICO 2/3 · y aunque la emitiera, `comer` rechaza el pescado crudo', () => {
    // La innata filtra `calories > 0 && toxicity <= toxicidadTolerada`, con el
    // tolerado en 0,2 por omisión. Y el pescado que ella misma sacó del agua mide
    // 0,2761 — apenas por encima, y no porque se haya podrido: la sustancia
    // `pescado` nace con `toxicity: 0,25` en el catálogo de la semilla.
    //
    // Lo incómodo, y hay que decirlo entero: **el mundo no cobra `toxicity`**. El
    // encabezado de `comer` lo tiene medido como hueco («`grep toxicity` sobre
    // `@anima/world/src` devuelve CERO»). O sea que el rechazo es una decisión de
    // la habilidad, no una regla del mundo — y es la decisión correcta el día que
    // el mundo la cobre. Lo que la vuelve una trampa hoy es que del otro lado no
    // hay nadie que sepa cocinar.
    const r = correr(laEscenaDelDocumento(), 'ana', 200)
    const p = r.partida
    const pez = [...p.state.bodies.values()].find(
      (b) => b.heldBy === 'ana' && b.body.parts.some((x) => x.substance === 'pescado'),
    )
    expect(pez).toBeDefined()
    if (pez === undefined) throw new Error('imposible')
    const q = (x: QualityId): number => qualityOf(pez.body, x, p.state.phys)
    expect(q('calories')).toBeGreaterThan(0)
    expect(q('toxicity')).toBeGreaterThan(0.2)

    // Se le pide comer con el default: se rinde sin gastar el bocado.
    const antes = aliento(p, 'ana')
    p.vuelo('ana')?.abortar('el test toma el mando')
    const v = p.volar('ana', (ctx) => comer(ctx, {}), undefined)
    for (let k = 0; k < 60 && !v.terminado; k++) p.avanzar(1)
    expect(v.outcome?.ok).toBe(false)
    expect(aliento(p, 'ana')).toBeLessThan(antes)

    console.log(
      `\n─── EL PESCADO QUE NO SE PUEDE COMER ───\n` +
        `  ${pez.body.id}: pescado × ${dos(q('mass'))} kg · ${dos(q('calories'))} calorías · ` +
        `toxicity ${q('toxicity').toFixed(4)} · decay ${q('decay').toFixed(4)}\n` +
        `  \`comer\` tolera 0,2 por omisión → ${JSON.stringify(v.outcome)}\n` +
        `  y la sustancia nace en 0,25: no es que se pudrió, el pescado crudo es incomible por diseño\n`,
    )
    MEDIDO.set('toxicidad', `pescado crudo tox ${q('toxicity').toFixed(4)} contra un tolerado de 0,20 → rechazo`)
  })

  it('DIAGNÓSTICO 3/3 · forzada a comer, le sobraba comida: pescó 199 y le hacían falta ~83', () => {
    const r = correr(laEscenaDelDocumento(), 'ana', 200)
    const p = r.partida
    const antes = aliento(p, 'ana')
    p.vuelo('ana')?.abortar('el test toma el mando')
    // Tolerando el veneno, que es exactamente el parámetro que la innata deja
    // abierto para el día en que el mundo lo cobre. No se toca ni una línea de
    // `src/`: se le pasa otro argumento a la misma habilidad.
    const v = p.volar('ana', (ctx) => comer(ctx, { toxicidadTolerada: 1 }), undefined)
    let k = 0
    while (!v.terminado && k < 60) {
      p.avanzar(1)
      k++
    }
    expect(v.outcome?.ok).toBe(true)
    const gana = aliento(p, 'ana') - antes
    expect(gana).toBeGreaterThan(0)

    const porTick = COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA
    const ticksPorPescado = gana / porTick
    const inicial = 310
    const faltaban = CRITERIO_TICKS - inicial / porTick
    const pescadosQueHacianFalta = Math.ceil((faltaban * porTick) / gana)

    console.log(
      `\n─── LO QUE UN PESCADO VALE ───\n` +
        `  comer(tolerando el veneno): ${JSON.stringify(v.outcome)} en ${String(k)} ticks\n` +
        `  aliento ${dos(antes)} → ${dos(aliento(p, 'ana'))}  (+${dos(gana)} = ${ticksPorPescado.toFixed(0)} ticks de vida)\n` +
        `  para llegar a ${String(CRITERIO_TICKS)} le faltaban ${faltaban.toFixed(0)} ticks = ` +
        `${String(pescadosQueHacianFalta)} pescados.  PESCÓ 199.\n`,
    )
    MEDIDO.set(
      'comida',
      `+${dos(gana)} de aliento por pescado (${ticksPorPescado.toFixed(0)} ticks); ` +
        `hacían falta ~${String(pescadosQueHacianFalta)} y pescó 199`,
    )
  })

  it('lo que SÍ aguanta, afirmado siempre: 2000 ticks viva, sin tropiezos y sin perder un tick', () => {
    // La guarda de regresión de lo que hoy anda. No es el criterio —el criterio
    // está arriba, en rojo— pero es lo que no se puede romper mientras se arregla.
    const r = correr(laEscenaDelDocumento(), 'ana', 2000)
    expect(r.ticks).toBe(2000)
    expect(r.murioEn).toBe(-1)
    expect(r.ticksPerdidos).toBe(0)
    expect(r.mente.tropiezo).toBeUndefined()
    expect(r.alientoFinal).toBeGreaterThan(0)
  }, 120_000)

  it('y con el tanque LLENO tampoco llega, que es lo que cierra la discusión', () => {
    // Si el problema fuera «arrancó con poco», esto lo arreglaría. No lo arregla:
    // con 1000 de 1000 se muere igual, y ANTES de los 20.000, porque además de
    // vivir caminó.
    //
    // Y el número se movió con la reparación del tramo G, así que conviene tener
    // los dos: **antes moría en el 18.524** —se quedaba pegada a una meta sin
    // esquema y se pasaba media vida en las conductas de fondo, que caminan— y
    // **ahora muere en el 19.995**, que es lo que sale de gastar el tanque entero
    // sin moverse más que las cinco celdas de la cadena de la caña. Faltan CINCO
    // ticks, y eso es exactamente el punto: 1000 de aliento son 20.000 ticks de
    // estar viva, así que el criterio (2) es literalmente «comé al menos una vez».
    const r = correr(laEscenaDelDocumento(1000), 'ana', CRITERIO_TICKS)
    expect(r.murioEn).toBeGreaterThan(0)
    expect(r.murioEn).toBeLessThan(CRITERIO_TICKS)
    console.log(
      `\n  con el tanque lleno (1000): murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} · ` +
        `${String(r.cuenta.get('aplicar(extraccion)') ?? 0)} pescas · ${r.ms.toFixed(0)} ms\n`,
    )
    MEDIDO.set('tanque lleno', `murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)}`)
  }, 300_000)
})

// ═══ (3) EL p99 DEL TICK — CITADO, NO REMEDIDO ══════════════════════════════

describe('(3) p99 < 5 ms con 5000 cuerpos: el número ya está medido en `@anima/world`', () => {
  it('la cita, verificada contra el archivo que la sostiene', () => {
    // No se vuelve a medir acá, y no por comodidad: `pnpm -r test` corre los
    // paquetes EN PARALELO y un banco de milisegundos contra una máquina ocupada
    // mide la contención tanto como el código —el mismo renglón dio 1,20 ms solo y
    // 7,80 acompañado—. Lo que sí se puede hacer sin medir nada es que la cita no
    // envejezca: si alguien mueve los techos, esto se pone rojo.
    const BANCO = `${PAQUETES}world/tests/banco-el-camino-de-intenciones.test.ts`
    const fuente = readFileSync(BANCO, 'utf8')
    expect(fuente).toContain('const TECHO_P99_MS = 5')
    expect(fuente).toContain('const TECHO_ACEPTADO_MS = 45')
    expect(fuente).toContain('const CUERPOS = 5000')
    // El criterio del Hito 5 sigue clavado como `it.fails` y lo aceptado sigue
    // vigilado en verde. Si el p99 bajara de 5, el `it.fails` se cae solo por
    // «test esperado fallido que pasó», y entonces hay que venir a borrar esto.
    expect(fuente).toContain('it.fails(`p99 < ${TECHO_P99_MS} ms')
    expect(readFileSync(`${PAQUETES}world/tests/banco-el-tick.test.ts`, 'utf8')).toContain(
      'const MIDIENDO_EN_SERIO',
    )

    console.log(
      `\n─── EL (3), CITADO ───\n` +
        `  «p99 de tick < 5 ms con 5000 cuerpos» — NO SE CUMPLE, y está medido y ACEPTADO así.\n` +
        `  world/tests/banco-el-camino-de-intenciones.test.ts, con 5000 cuerpos y 5000 criaturas:\n` +
        `      p50 20,34 ms · p95 24,50 ms · p99 30,94 ms · peor 38,61 ms   →  6,2× el techo\n` +
        `  De esos 30,9 ms, 10,6 son el mundo QUIETO (física sobre 5000 cuerpos, cero actores) y\n` +
        `  20,3 son 5000 criaturas moviéndose (~4,1 µs por criatura y por tick).\n` +
        `  La guarda de regresión de lo aceptado está VERDE en 45 ms; el criterio de 5 sigue en\n` +
        `  \`it.fails\`, y lo que falta no es otra micro-optimización sino un cambio de\n` +
        `  REPRESENTACIÓN de las cualidades (diagnosticado desde el Hito 2).\n`,
    )
    MEDIDO.set('p99', 'p99 30,94 ms contra 5 (6,2×) — medido y aceptado en `@anima/world`, citado acá')
  })

  it('y lo que ESTA mente le agrega al tick, medido donde sí se puede: una criatura', () => {
    // El (3) habla de 5000 cuerpos y de 5000 criaturas, y el que lo mide es el
    // banco del mundo. Lo único que este paquete puede aportar sin repetir aquel
    // trabajo es cuánto cuesta la mente ENCIMA del mundo, con una criatura: es el
    // número que dice si la escalera es un problema de rendimiento o no lo es.
    const conMente = correr(laEscenaDelDocumento(1000), 'ana', 4000)
    const p = new Partida(laEscenaDelDocumento(1000))
    const t0 = process.hrtime.bigint()
    p.avanzar(4000)
    const soloMundo = Number(process.hrtime.bigint() - t0) / 1e6

    const porTick = conMente.ms / 4000
    console.log(
      `\n─── LO QUE LA MENTE LE AGREGA AL TICK (1 criatura, 4000 ticks) ───\n` +
        `  mundo solo ......... ${(soloMundo / 4000).toFixed(4)} ms/tick\n` +
        `  mundo + mente ...... ${porTick.toFixed(4)} ms/tick\n` +
        `  la mente ........... ${((conMente.ms - soloMundo) / 4000).toFixed(4)} ms/tick ` +
        `(la ventana de un tick a ${String(HZ_DE_REFERENCIA)} Hz son ${(1000 / HZ_DE_REFERENCIA).toFixed(0)} ms)\n`,
    )
    MEDIDO.set(
      'la mente',
      `${((conMente.ms - soloMundo) / 4000).toFixed(4)} ms/tick encima de ` +
        `${(soloMundo / 4000).toFixed(4)} del mundo, con 1 criatura`,
    )
    // Sin aserción de tiempo: es informativo y corre al lado de los otros
    // paquetes. Lo único que se afirma es que las dos corridas hicieron el trabajo.
    expect(conMente.ticks).toBe(4000)
    expect(p.informe.ticks).toBe(4000)
  }, 300_000)
})

// ═══ (4) `ticksPerdidos === 0` DURANTE TODA LA CORRIDA ══════════════════════

describe('(4) ticksPerdidos === 0, y contado contra un reloj que puede moverlo', () => {
  it('sin reloj de pared: cero, y sólo dice que el mundo nunca lanzó', () => {
    // La mitad honesta del criterio. Sin `RelojDePared`, `porTiempo` no se puede
    // mover POR CONSTRUCCIÓN —`bucle.ts`: «sin reloj de pared no hay ninguna
    // ventana que vencer»— así que este cero mide `porFalla` y nada más: que
    // `stepWorld` no lanzó una sola vez en 20.000 ticks con una mente encima.
    // Que el contador SÍ se puede mover lo prueba `perceive/tests/el-bucle.test.ts`
    // con un reloj falso que hace que cada tick tarde el doble de su ventana.
    const r = correr(laEscenaDelDocumento(1000), 'ana', CRITERIO_TICKS)
    expect(r.ticks).toBe(CRITERIO_TICKS)
    expect(r.porFalla).toBe(0)
    expect(r.ticksPerdidos).toBe(0)
    expect(r.partida.informe.fallas).toEqual([])
    console.log(
      `\n  ${String(r.ticks)} ticks de mundo, ${String(r.porFalla)} fallas de \`stepWorld\`, ` +
        `${String(r.ticksPerdidos)} ticks perdidos\n`,
    )
  }, 300_000)

  it('CON reloj de pared: la otra mitad, que es la que el criterio pide de verdad', () => {
    const r = correr(laEscenaDelDocumento(1000), 'ana', CRITERIO_TICKS, { reloj: true })
    const ventana = 1000 / r.partida.state.hz
    const porTick = r.ms / r.ticks
    console.log(
      `\n─── EL CRITERIO (4), CON EL RELOJ DE PARED PUESTO ───\n` +
        `  ${String(r.ticks)} ticks en ${r.ms.toFixed(0)} ms = ${porTick.toFixed(3)} ms por tick\n` +
        `  la ventana de un tick a ${String(r.partida.state.hz)} Hz son ${ventana.toFixed(1)} ms ` +
        `→ sobra un factor de ${(ventana / porTick).toFixed(0)}\n` +
        `  ticksPerdidos ${String(r.ticksPerdidos)} (porTiempo ${String(r.porTiempo)}, porFalla ${String(r.porFalla)})\n`,
    )
    MEDIDO.set(
      'ticks perdidos',
      `${String(r.ticksPerdidos)} en ${String(r.ticks)} ticks con reloj de pared ` +
        `(${porTick.toFixed(3)} ms/tick contra una ventana de ${ventana.toFixed(0)})`,
    )

    // Lo determinista se afirma siempre.
    expect(r.porFalla).toBe(0)
    expect(r.ticks).toBe(CRITERIO_TICKS)
    // Y lo que depende del reloj del sistema, sólo midiendo en serio: una pausa
    // del recolector de basura más larga que una ventana suma un tick perdido, y
    // un rojo intermitente enseña a ignorar el rojo. Se imprime siempre.
    if (!MIDIENDO_EN_SERIO) return
    expect(r.ticksPerdidos).toBe(0)
  }, 300_000)
})

// ═══ EL CUADRO ══════════════════════════════════════════════════════════════

describe('los cuatro criterios, con los números de esta corrida', () => {
  it('el cuadro', () => {
    const l = (k: string): string => MEDIDO.get(k) ?? '—'
    console.log(
      [
        '',
        '════ EL HITO 5, MEDIDO ════════════════════════════════════════════════════',
        '',
        `  (0) proveedor apagado ..... ${l('proveedor')}`,
        '',
        `  (1) la cadena de la caña ... CUMPLE en lo sustancial`,
        `        ${l('cadena')}`,
        `      la letra del documento ... NO: ${l('deshilachar')}`,
        '',
        `  (2) 20.000 ticks viva ...... NO CUMPLE`,
        `        ${l('supervivencia')}`,
        `        con el tanque lleno: ${l('tanque lleno')}`,
        `        por qué: ${l('toxicidad')}`,
        `                 ${l('comida')}`,
        `        y la aritmética: ${l('aritmética')}`,
        '',
        `  (3) p99 < 5 ms ............. NO CUMPLE (medido y aceptado en @anima/world)`,
        `        ${l('p99')}`,
        `        lo que esta mente agrega: ${l('la mente')}`,
        '',
        `  (4) ticksPerdidos === 0 .... CUMPLE`,
        `        ${l('ticks perdidos')}`,
        '',
        '═══════════════════════════════════════════════════════════════════════════',
        '',
      ].join('\n'),
    )
    expect(MEDIDO.size).toBeGreaterThan(0)
  })
})
