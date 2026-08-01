/**
 * (6) LA CONSISTENCIA DEL PRIMER GESTO — el punto que le faltaba al criterio.
 *
 *     pnpm --filter @anima/lang test
 *     ANIMA_BANCO=1 pnpm --filter @anima/lang test    ← el veredicto
 *
 * El documento de arquitectura lo define así, y con estas palabras:
 *
 * > `consistenciaDelPrimerGesto = órdenes donde el primer gesto fue coherente
 * >  con la conducta final / órdenes totales`
 * >
 * > Si está por debajo de 0.85, la especulación está regalando torpeza y hay
 * > que subir el umbral de confianza.
 *
 * ─── LO QUE EL DOCUMENTO NO DEFINE, y hay que definir acá ───────────────────
 *
 * **Qué es «coherente».** Sin eso, este número se puede fabricar: una definición
 * floja da 1,00 siempre y una estricta da 0,00, y las dos pasan por medición.
 *
 * ─── LA PRIMERA DEFINICIÓN ESTABA MAL, y la tabla lo dijo ───────────────────
 *
 * Decía: «coherente si la habilidad aparece también en los ticks de después».
 * Corrida, dio esto:
 *
 *     hacé fuego     deshilachar   ✗ desvío
 *
 * Y es falso. La criatura deshilachó, terminó, y **no lo repitió** — porque no
 * hacía falta. Esa definición penalizaba todo lo que se completa rápido, que es
 * justo lo contrario de lo que hay que premiar.
 *
 * ─── LA QUE SE USA, y es un A/B ─────────────────────────────────────────────
 *
 * > El primer gesto es COHERENTE si **la misma criatura, en la misma escena,
 * > sabiendo desde el principio lo que se le pidió, también lo hubiera hecho**.
 *
 * O sea: se corre la orden DOS veces desde la misma semilla. Una adivinando —el
 * lector local y nada más, que es lo que pasa mientras el modelo piensa— y otra
 * con la lectura ya corregida desde el tick cero. Coherente = el primer gesto de
 * la que adivinó aparece en la conducta de la que sabía.
 *
 * Eso responde exactamente la pregunta que el número tiene que responder:
 * **¿lo que hizo mientras adivinaba, lo habría hecho igual si hubiera sabido?**
 * Y no depende de que una habilidad se repita ni de dónde se corte la ventana.
 *
 * ─── LA VENTANA DE ESPECULACIÓN, que es lo que se mide ──────────────────────
 *
 * El primer gesto no se toma de cualquier momento: se toma **de los ticks que
 * pasan entre que la frase llega y que el modelo contesta**. Ésa es la ventana
 * en la que el sistema está apostando, y es la única en la que la pregunta tiene
 * sentido. Con la lectura ya corregida no hay especulación que medir.
 *
 * ─── Y POR QUÉ SÓLO CUENTAN LAS ÓRDENES QUE ESPECULAN ───────────────────────
 *
 * Una orden que el lector local entiende de una no especula: su primer gesto
 * sale del plan correcto y es coherente **por construcción**. Meterlas en el
 * denominador infla el número sin medir nada — con un corpus lleno de frases
 * fáciles, cualquier sistema saca 0,95.
 *
 * Se publican los dos: el de las que especulan (el que vale) y el de todas (el
 * que se vería mejor). La distancia entre los dos es la medida de cuánto se
 * estaría inflando.
 */

import { buildSeedPhysics } from '@anima/physics'
import { ESQUEMAS } from '@anima/plan'
import { Partida } from '@anima/perceive'
import { Creencias, Mente, vivir } from '@anima/mind'
import { describe, expect, it } from 'vitest'
import { PUENTE } from '../src/alias.js'
import { consultaDe, llaveDe, revisar } from '../src/consulta.js'
import type { RespuestaDelModelo } from '../src/consulta.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { clave } from '../src/normalizar.js'
import { Consistencia } from '../src/relojes.js'
import { actor, criatura, enElPiso, laOrilla, mundo } from './mundo.js'

const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

const QUIEN = 'ana'
const CALENTAR = 40
/** Los ticks que el sistema APUESTA, o sea lo que tarda el modelo. Medido: ~10 s. */
const VENTANA_DE_APUESTA = 200
/** Y lo que corre después, ya con la lectura corregida. */
const DESPUES = 300
/** El umbral del criterio. */
const UMBRAL = 0.85

const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const FIRMAS = [...new Set(ESQUEMAS.map((e) => e.establishes))]
const ESTABLECIBLES = new Set(FIRMAS)
const OPC = { phys, lexico, sabeElCatalogo: (f: string): boolean => ESTABLECIBLES.has(f) }

/**
 * El modelo simulado, determinista y gratis.
 *
 * Se usa éste y no uno de verdad porque este archivo corre en CI, y porque el
 * número que interesa es del SISTEMA, no del proveedor: cambiar de modelo cambia
 * qué frases se corrigen, no si el gesto que se dio mientras tanto servía.
 */
const PISTAS: readonly (readonly [string, string])[] = [
  ['rio', 'holding(tag:carnoso)'],
  ['pesca', 'holding(tag:carnoso)'],
  ['hambre', 'holding(tag:carnoso,digestibility>=0.85,toxicity<=0.05)'],
  ['lena', 'emitsPower>0'],
  ['tronco', 'emitsPower>0'],
  ['choza', 'reach>=2'],
  ['silla', 'reach>=2'],
  ['muro', 'reach>=2'],
]

function elModelo(texto: string, llave: string, cuales: readonly number[]): RespuestaDelModelo | undefined {
  const t = clave(texto)
  const out: { indice: number; firma: string }[] = []
  for (const i of cuales) {
    for (const [pista, firma] of PISTAS) {
      if (t.includes(pista)) {
        out.push({ indice: i, firma })
        break
      }
    }
  }
  return out.length === 0 ? undefined : { llave, clausulas: out }
}

const orilla = laOrilla()
function escena(): ReturnType<typeof mundo> {
  return mundo({
    dios: orilla.dios,
    bodies: [enElPiso(criatura(QUIEN, 310), orilla.parada)],
    actors: [actor(QUIEN, { capacity: 3 })],
  })
}

interface Corrida {
  /** La habilidad del primer despegue de la ventana de apuesta. */
  readonly primerGesto: string | undefined
  /** Lo que hizo la criatura que YA SABÍA, desde el principio. */
  readonly loQueHabriaHecho: ReadonlySet<string>
  readonly especulo: boolean
}

/** Las habilidades que despega una criatura con esta meta, en `n` ticks. */
function conducta(meta: string | undefined, n: number): ReadonlySet<string> {
  const p = new Partida(escena(), { vigilar: true })
  const memoria = new Creencias()
  let m = new Mente({ actor: QUIEN, memoria })
  const mentes = new Map([[QUIEN, m]])
  vivir(p, mentes, CALENTAR)
  if (meta !== undefined) {
    m = new Mente({ actor: QUIEN, memoria, drive: { meta, peso: 1, desdeTick: CALENTAR } })
    mentes.set(QUIEN, m)
  }
  const out = new Set<string>()
  for (let k = 0; k < n; k++) {
    const antes = m.despegues
    vivir(p, mentes, 1)
    if (m.despegues > antes) out.add((m.ultimoDespegue ?? '?').split('(')[0] ?? '?')
  }
  return out
}

/** El primer despegue de una criatura con esta meta, en `n` ticks. */
function primerDespegue(meta: string | undefined, n: number): string | undefined {
  const p = new Partida(escena(), { vigilar: true })
  const memoria = new Creencias()
  let m = new Mente({ actor: QUIEN, memoria })
  const mentes = new Map([[QUIEN, m]])
  vivir(p, mentes, CALENTAR)
  if (meta !== undefined) {
    m = new Mente({ actor: QUIEN, memoria, drive: { meta, peso: 1, desdeTick: CALENTAR } })
    mentes.set(QUIEN, m)
  }
  for (let k = 0; k < n; k++) {
    const antes = m.despegues
    vivir(p, mentes, 1)
    if (m.despegues > antes) return (m.ultimoDespegue ?? '?').split('(')[0]
  }
  return undefined
}

/**
 * Una orden, corrida DOS veces desde la misma semilla.
 *
 * La primera adivinando —con lo que el lector local saco solo, que es lo que
 * pasa mientras el modelo piensa— y la segunda con la lectura ya corregida desde
 * el arranque. Las dos parten del mismo mundo y del mismo tick.
 */
function correrOrden(frase: string): Corrida {
  const l = leer(frase, OPC)
  const consulta = consultaDe(l, lexico, FIRMAS)
  const especulo = consulta !== undefined

  const metaLocal = l.clausulas.find((c) => c.firma !== undefined && c.polaridad === 'afirma')?.firma

  let revisada = l
  if (consulta !== undefined) {
    const r = elModelo(frase, llaveDe(frase, lexico), consulta.clausulas)
    if (r !== undefined) {
      revisada = revisar(l, r, lexico, { ofrecidas: consulta.firmas, sabeElCatalogo: OPC.sabeElCatalogo })
    }
  }
  const metaBuena = revisada.clausulas.find((c) => c.firma !== undefined && c.polaridad === 'afirma')?.firma

  return {
    primerGesto: primerDespegue(metaLocal, VENTANA_DE_APUESTA),
    loQueHabriaHecho: conducta(metaBuena, VENTANA_DE_APUESTA + DESPUES),
    especulo,
  }
}

/** Las órdenes con las que se mide. Todas del corpus, y de formas distintas. */
const ORDENES: readonly string[] = [
  'hacé fuego',
  'juntá leña',
  'traé un tronco',
  'andá al río',
  'pescá algo',
  'tengo hambre',
  'conseguí comida',
  'construí una choza',
  'hacé una silla',
  'rompe el muro',
  'fabricá una trampa para peces',
  'asá el pescado',
]

describe('(6) la consistencia del primer gesto', () => {
  it('se mide sobre las órdenes que ESPECULAN, y se publica el otro número al lado', () => {
    const conApuesta = new Consistencia()
    const todas = new Consistencia()
    const filas: string[] = []

    for (const frase of ORDENES) {
      const c = correrOrden(frase)
      // Sin primer gesto no hubo apuesta que juzgar: la criatura no hizo nada en
      // la ventana. No es coherente ni incoherente, y contarlo como cualquiera de
      // las dos sería inventar.
      if (c.primerGesto === undefined) {
        filas.push(`  ${frase.padEnd(32)} (no se movió en la ventana)`)
        continue
      }
      const coherente = c.loQueHabriaHecho.has(c.primerGesto)
      todas.anotar(coherente)
      if (c.especulo) conApuesta.anotar(coherente)
      filas.push(
        `  ${frase.padEnd(32)} ${c.especulo ? 'apuesta' : '  segura'}  ${c.primerGesto.padEnd(13)} ${coherente ? '✓' : '✗ desvío'}`,
      )
    }

    const v = conApuesta.valor()
    const t = todas.valor()
    console.log('\n── (6) CONSISTENCIA DEL PRIMER GESTO ──')
    for (const f of filas) console.log(f)
    console.log(
      `\n  las que ESPECULAN ... ${v === undefined ? 'sin muestras' : v.toFixed(2)}  (${String(conApuesta.total)} órdenes)   ← el número`,
    )
    console.log(
      `  todas ............... ${t === undefined ? 'sin muestras' : t.toFixed(2)}  (${String(todas.total)} órdenes)   ← el que se vería mejor`,
    )
    console.log(`  el umbral del criterio es ${String(UMBRAL)}\n`)

    if (!MIDIENDO_EN_SERIO) return
    expect(conApuesta.total, 'ninguna orden especuló: el número no mide nada').toBeGreaterThan(2)
    expect(v ?? 0).toBeGreaterThanOrEqual(UMBRAL)
  })

  it('EL CONTROL POSITIVO: una especulación que SÍ diverge da cero', () => {
    // ─── POR QUÉ ESTE CONTROL Y NO EL DE ANTES ────────────────────────────────
    //
    // El primero preguntaba si `bailar-un-tango` estaba en la conducta. Daba 0,
    // claro, y no probaba nada: que un nombre inventado no esté sólo prueba que
    // el `Set` funciona.
    //
    // Lo que hay que probar es que la MÉTRICA distingue, y para eso hace falta
    // una especulación de verdad que salga mal: la criatura arranca creyendo que
    // le pidieron fuego —deshilacha una hebra— y resulta que le habían pedido
    // comida. Si `deshilachar` no está en lo que hace una criatura que va a
    // pescar, ese arranque fue tiempo tirado y el número tiene que decirlo.
    const arrancaCreyendoFuego = primerDespegue('emitsPower>0', VENTANA_DE_APUESTA)
    const loQueHaceSiEraComida = conducta('holding(tag:carnoso)', VENTANA_DE_APUESTA + DESPUES)
    const loQueHaceSiEraFuego = conducta('emitsPower>0', VENTANA_DE_APUESTA + DESPUES)

    console.log(`
  ── el control positivo ──`)
    console.log(`  arranca creyendo fuego y hace ......... ${String(arrancaCreyendoFuego)}`)
    console.log(`  si de verdad era fuego, eso ¿sirve? ... ${loQueHaceSiEraFuego.has(arrancaCreyendoFuego ?? '') ? 'sí' : 'NO'}`)
    console.log(`  si de verdad era comida, ¿sirve? ...... ${loQueHaceSiEraComida.has(arrancaCreyendoFuego ?? '') ? 'sí' : 'NO'}`)
    console.log(`  lo que hace por comida: ${[...loQueHaceSiEraComida].sort().join(' ')}
`)

    expect(arrancaCreyendoFuego, 'la criatura no se movió: el control no controla').toBeDefined()
    // Acertando, coherente.
    expect(loQueHaceSiEraFuego.has(arrancaCreyendoFuego ?? '')).toBe(true)
    // Errando, NO. Si esto fuera `true`, la métrica no distinguiría nada y el
    // 1,00 de arriba sería un cero disfrazado.
    expect(
      loQueHaceSiEraComida.has(arrancaCreyendoFuego ?? ''),
      'la métrica no distingue: un arranque equivocado cuenta como coherente',
    ).toBe(false)
  })

  it('y por qué el número del corpus da 1,00 — que es un HALLAZGO, no un éxito', () => {
    // Las cinco órdenes que especulan arrancan TODAS con `ir`. Y `ir` está en
    // casi toda conducta de este mundo, porque para hacer cualquier cosa hay que
    // caminar hasta las cosas.
    //
    // O sea que la especulación no es coherente por astuta: es coherente porque
    // **cuando el lector local no sabe, la criatura camina**, y caminar casi
    // nunca está de más. Es una propiedad del mundo y del fondo de la escalera,
    // no un mérito del lector.
    //
    // Vale escribirlo porque decide cómo leer el 1,00: NO dice «la lectura
    // especulativa acierta». Dice «el costo de equivocarse es bajo en este
    // mundo». El día que el fondo haga algo caro o irreversible, este número se
    // mueve y hay que volver a mirarlo.
    const cuantasEmpiezanCaminando = ORDENES.map((f) => correrOrden(f)).filter(
      (c) => c.especulo && c.primerGesto === 'ir',
    ).length
    console.log(`  de las que especulan, arrancan caminando: ${String(cuantasEmpiezanCaminando)}`)
    expect(cuantasEmpiezanCaminando).toBeGreaterThan(0)
  })
})
