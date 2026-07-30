// ─── ¿HAY COMIDA SIN FUEGO? ──────────────────────────────────────────────────
//
// Todo el trabajo del Hito 5 alrededor del fuego —la escalera de la yesca, el
// fardo bajo `MAX_PARTS`, las dos palancas de calibración— se apoya en una
// premisa que NADIE midió: que cocinar es la única puerta a la comida. La frase
// está escrita en el traspaso («no hay salida por comerlo crudo») y su prueba es
// UNA sustancia, el pescado, contra UN umbral, el `toxicidadTolerada` de `comer`.
//
// Este archivo la mide donde hay que medirla, que es el mundo decretado y no el
// catálogo, y con la cuenta que la mente usa de verdad. `mordidaDe`
// (`mind/src/oportunidades.ts`) no compara `toxicity` contra un umbral: compara
// un NETO.
//
//     neto = min(calories · STAMINA_POR_CALORIA, margen) − toxicity · masa · K
//
// Las dos constantes viven en `@anima/world/src/step.ts` y se importan de ahí, no
// se copian: el día que alguien mueva `COSTO_POR_TOXICIDAD_Y_KILO` esta tabla se
// mueve sola. `margen` es lo que queda de tanque, y por eso la cuenta se corre
// con los DOS tanques del criterio: el canónico de 310 y el lleno de 1000. Un
// bocado que rinde 14 calorías no rinde 14 si en el tanque entran 3.
//
// La pregunta se contesta en dos, y la segunda sólo tiene sentido si la primera
// da que no:
//
//   1. ¿Qué de lo que el dios suelta en los nueve chunks del arranque se puede
//      comer CRUDO con neto positivo?
//   2. Si no hay nada, ¿cuánto separa al mejor candidato de dar positivo? Porque
//      esa distancia es la que dice si el problema es de calibración o de
//      catálogo.

import { describe, expect, it } from 'vitest'
import { qualityOf, SUSTANCIAS_SEMILLA, T_AMBIENTE } from '@anima/physics'
import type { Body } from '@anima/physics'

import { crearDios, PREFIJO_POZO, PREFIJO_SUELTA } from '../src/index.js'
import { COSTO_POR_TOXICIDAD_Y_KILO, STAMINA_POR_CALORIA, stepWorld } from '../src/step.js'
import type { WorldState } from '../src/step.js'
import { actor, criatura, cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

/** Las mismas veinte semillas del banco de la emergencia, y el mismo arranque. */
const SEMILLA_BASE = 20260728n
const SEMILLAS = 20

/**
 * Los dos tanques del criterio. El margen que `mordidaDe` topa es lo que FALTA
 * para llenar el tanque, así que el tanque canónico —que es el que está
 * hambriento— es el que MÁS margen tiene: 690 contra 0.
 */
const TECHO_DEL_TANQUE = 1000
const TANQUE_CANONICO = 310

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

interface Bocado {
  readonly id: string
  readonly sustancia: string
  readonly masa: number
  readonly calorias: number
  readonly toxicidad: number
  /** `min(calorías · S, margen) − toxicidad · masa · K`, la cuenta de `mordidaDe`. */
  readonly neto: number
  /** Lo que el veneno se lleva, aparte, para ver cuál de los dos términos manda. */
  readonly castigo: number
}

/** La misma cuenta de `mordidaDe`, con las constantes importadas y no copiadas. */
function netoDe(b: Body, w: WorldState, margen: number): Bocado {
  const calorias = qualityOf(b, 'calories', w.phys)
  const masa = qualityOf(b, 'mass', w.phys)
  const toxicidad = qualityOf(b, 'toxicity', w.phys)
  const gana = Math.min(calorias * STAMINA_POR_CALORIA, margen)
  const castigo = toxicidad * masa * COSTO_POR_TOXICIDAD_Y_KILO
  return {
    id: b.id,
    sustancia: b.parts[0]?.substance ?? '?',
    masa,
    calorias,
    toxicidad,
    neto: gana - castigo,
    castigo,
  }
}

/** Los nueve chunks que la criatura abre en su primer tick, ya materializados. */
function sueltasDe(semilla: bigint): { readonly w: WorldState; readonly cuerpos: readonly Body[] } {
  const base = mundo({
    bodies: [enElPiso(criatura('medidor'), EN(0, 0))],
    actors: [actor('medidor')],
  })
  const w = stepWorld({ ...base, dios: crearDios(semilla) }, []).state
  const cuerpos = [...w.bodies.values()]
    .filter((c) => c.body.id.startsWith(PREFIJO_SUELTA))
    .map((c) => c.body)
  return { w, cuerpos }
}

describe('¿hay comida sin fuego?', () => {
  it('1 · LO QUE EL DIOS SUELTA, CON LA CUENTA DE `mordidaDe` Y NO CON UN UMBRAL', () => {
    const margen = TECHO_DEL_TANQUE - TANQUE_CANONICO
    const filas: string[] = [
      '─── ¿SE PUEDE COMER ALGO CRUDO EN EL MUNDO DECRETADO? ───',
      `  neto = min(calorías · ${String(STAMINA_POR_CALORIA)}, margen) − toxicidad · masa · ${String(COSTO_POR_TOXICIDAD_Y_KILO)}`,
      `  margen del tanque canónico: ${String(TECHO_DEL_TANQUE)} − ${String(TANQUE_CANONICO)} = ${String(margen)}`,
      '  se agrupa por sustancia y se muestra el MEJOR ejemplar de cada una, en las 20 semillas.',
      '',
      '  sustancia    │ ejemplares │ masa (kg) │ calorías │ toxicidad │ castigo │  neto  │ ¿bocado?',
      '  ─────────────┼────────────┼───────────┼──────────┼───────────┼─────────┼────────┼─────────',
    ]

    // El mejor ejemplar por sustancia, tomado sobre las veinte semillas juntas:
    // lo que se pregunta acá es del CATÁLOGO SEMBRADO, no de una parada.
    const mejorPorSustancia = new Map<string, Bocado>()
    const ejemplares = new Map<string, number>()
    const semillasConBocado: bigint[] = []

    for (let k = 0; k < SEMILLAS; k += 1) {
      const semilla = SEMILLA_BASE + BigInt(k)
      const { w, cuerpos } = sueltasDe(semilla)
      let hayAcá = false
      for (const b of cuerpos) {
        const bocado = netoDe(b, w, margen)
        if (!(bocado.calorias > 0)) continue
        ejemplares.set(bocado.sustancia, (ejemplares.get(bocado.sustancia) ?? 0) + 1)
        const previo = mejorPorSustancia.get(bocado.sustancia)
        if (previo === undefined || bocado.neto > previo.neto) mejorPorSustancia.set(bocado.sustancia, bocado)
        if (bocado.neto > 0) hayAcá = true
      }
      if (hayAcá) semillasConBocado.push(semilla)
    }

    const ordenadas = [...mejorPorSustancia.values()].sort((a, b) => b.neto - a.neto)
    for (const b of ordenadas) {
      filas.push(
        `  ${b.sustancia.padEnd(12)} │ ${String(ejemplares.get(b.sustancia) ?? 0).padStart(10)} │ ` +
          `${b.masa.toFixed(3).padStart(9)} │ ${b.calorias.toFixed(3).padStart(8)} │ ` +
          `${b.toxicidad.toFixed(3).padStart(9)} │ ${b.castigo.toFixed(2).padStart(7)} │ ` +
          `${b.neto.toFixed(2).padStart(6)} │ ${b.neto > 0 ? 'SÍ' : 'no'}`,
      )
    }

    const mejor = ordenadas[0]
    filas.push('')
    if (mejor === undefined) {
      filas.push('  el dios no suelta NADA con calorías en los nueve chunks del arranque.')
    } else if (mejor.neto > 0) {
      filas.push(
        `  HAY COMIDA SIN FUEGO: ${mejor.sustancia} da +${mejor.neto.toFixed(2)} de aliento crudo,`,
        `  y aparece en ${String(semillasConBocado.length)} de ${String(SEMILLAS)} semillas.`,
      )
    } else {
      filas.push(
        `  NO HAY COMIDA SIN FUEGO en ninguna de las ${String(SEMILLAS)} semillas.`,
        `  El que menos pierde es ${mejor.sustancia}: ${mejor.neto.toFixed(2)} de aliento.`,
        `  Le falta ${(-mejor.neto).toFixed(2)} para dar positivo, o sea que el veneno se lleva ` +
          `${(mejor.castigo / Math.max(1e-12, mejor.calorias)).toFixed(2)}× lo que las calorías acreditan.`,
      )
    }
    log(filas)

    // Clavado y no elegido: es lo que el dios decreta hoy con la cuenta que la
    // mente usa hoy. Si esto se pusiera verde, la premisa entera del fuego —«hay
    // que cocinar para comer»— dejaría de valer y el Hito 5 tendría otra puerta.
    expect(mejor).toBeDefined()
    expect(semillasConBocado).toHaveLength(0)
  })

  it('2 · Y CON EL TANQUE VACÍO TAMPOCO: el margen no es lo que lo tapa', () => {
    // El único término de la cuenta que depende del tanque es el tope de lo
    // acreditado, así que la lectura floja del bloque 1 sería «con más margen
    // alcanzaría». Se corre con el margen MÁXIMO posible —tanque en cero, o sea
    // que nada se derrama— y se compara contra el canónico. Si el veredicto no se
    // mueve, lo que tapa la comida cruda es el veneno y no el tanque.
    const margenes = [
      { nombre: 'canónico (310)', v: TECHO_DEL_TANQUE - TANQUE_CANONICO },
      { nombre: 'vacío (0)', v: TECHO_DEL_TANQUE },
      { nombre: 'lleno (1000)', v: 0 },
    ]
    const filas: string[] = [
      '─── EL MISMO CATÁLOGO, CON LOS TRES MÁRGENES ───',
      '',
      '  margen          │ mejor sustancia │ mejor neto │ ¿algún bocado?',
      '  ────────────────┼─────────────────┼────────────┼───────────────',
    ]

    const { w, cuerpos } = sueltasDe(SEMILLA_BASE)
    const conCalorias = cuerpos.filter((b) => qualityOf(b, 'calories', w.phys) > 0)
    let algunoPositivo = false
    for (const m of margenes) {
      const bocados = conCalorias.map((b) => netoDe(b, w, m.v)).sort((a, b) => b.neto - a.neto)
      const top = bocados[0]
      if (top !== undefined && top.neto > 0) algunoPositivo = true
      filas.push(
        `  ${m.nombre.padEnd(15)} │ ${(top?.sustancia ?? '—').padEnd(15)} │ ` +
          `${(top === undefined ? '—' : top.neto.toFixed(2)).padStart(10)} │ ` +
          `${top !== undefined && top.neto > 0 ? 'SÍ' : 'no'}`,
      )
    }
    filas.push(
      '',
      '  El margen sólo TOPA lo acreditado: nunca lo agranda. Subirlo no puede dar vuelta',
      '  un neto negativo, y por eso el veredicto del bloque 1 no es del tanque.',
    )
    log(filas)

    expect(conCalorias.length).toBeGreaterThan(0)
    expect(algunoPositivo).toBe(false)
  })

  it('3 · EL SIGNO NO DEPENDE DE LA MASA, y por eso el pescado del pozo tampoco se salva', () => {
    // Los dos bloques de arriba miran SUELTAS, y la comida del criterio no es una
    // suelta: el pescado sale de un pozo con `draw`, y pesa 2,887 kg contra los 11
    // gramos del grano. La lectura floja sería «con una pieza grande la cuenta
    // cambia», y es falsa por una razón que conviene tener escrita:
    //
    //     neto = calorías − toxicidad · masa · K,  y `calories` es EXTENSIVA
    //          = masa · (calorías/kg − toxicidad · K)
    //
    // La masa sale de factor común. **Comer crudo conviene o no conviene por
    // SUSTANCIA**, y lo único que la masa decide es cuánto se gana o cuánto se
    // pierde. Por eso este bloque barre el catálogo entero por kilo, que cubre de
    // una vez todo lo que el dios pueda soltar y todo lo que un pozo pueda dar.
    const filas: string[] = [
      '─── EL CATÁLOGO ENTERO, POR KILO Y EN CRUDO ───',
      `  crudo conviene ⟺ calorías/kg > toxicidad · ${String(COSTO_POR_TOXICIDAD_Y_KILO)}`,
      '',
      '  sustancia    │ calorías/kg │ toxicidad │ el umbral │ ¿conviene crudo?',
      '  ─────────────┼─────────────┼───────────┼───────────┼─────────────────',
    ]

    const w = mundo()
    const convienen: string[] = []
    const conCalorias = SUSTANCIAS_SEMILLA.filter(
      (s) => qualityOf(unKilo(s.id), 'calories', w.phys) > 0,
    )
    for (const s of conCalorias) {
      const b = unKilo(s.id)
      const porKilo = qualityOf(b, 'calories', w.phys)
      const tox = qualityOf(b, 'toxicity', w.phys)
      const umbral = tox * COSTO_POR_TOXICIDAD_Y_KILO
      const conviene = porKilo > umbral
      if (conviene) convienen.push(s.id)
      filas.push(
        `  ${s.id.padEnd(12)} │ ${porKilo.toFixed(3).padStart(11)} │ ${tox.toFixed(3).padStart(9)} │ ` +
          `${umbral.toFixed(3).padStart(9)} │ ${conviene ? 'SÍ' : 'no'}`,
      )
    }

    // Y LO QUE COCINAR MUEVE, medido corriendo el mundo y no supuesto: el mismo
    // pescado del criterio apoyado sobre una piedra al lado de una brasa.
    const cocido = cocinarUnPescado()

    // LA MITAD QUE FALTABA, y es la que da vuelta la premisa: si el catálogo
    // tiene comida que paga cruda, la pregunta pasa a ser si el dios la PONE.
    // Se cuenta lo que decreta en los nueve chunks del arranque de las veinte
    // semillas, sueltas Y pozos —el pescado del criterio sale de un pozo, así que
    // mirar sólo sueltas dejaría afuera justo la comida del Hito 5—.
    const sembradas = sustanciasQueElDiosDecreta()
    const alaVista = convienen.filter((s) => sembradas.has(s))
    filas.push(
      '',
      `  sustancias con calorías: ${String(conCalorias.length)} · las que convienen crudas: ` +
        `${convienen.length === 0 ? 'NINGUNA' : convienen.join(' ')}`,
      `  lo que el dios decreta con calorías en los 9 chunks del arranque (20 semillas, sueltas y pozos):`,
      `    ${[...sembradas].sort().join(' ')}`,
      `  de las que convienen crudas, decretadas: ${alaVista.length === 0 ? 'NINGUNA' : alaVista.join(' ')}`,
      '',
      '  el pescado del criterio (2,887 kg), antes y después del fuego:',
      `    crudo   → calorías ${cocido.crudo.calorias.toFixed(3)} · toxicidad ${cocido.crudo.toxicidad.toFixed(4)} · ` +
        `neto ${cocido.crudo.neto.toFixed(2)}`,
      cocido.cocido === undefined
        ? '    cocido  → NO LLEGÓ a la ventana de cocción en la corrida'
        : `    cocido  → calorías ${cocido.cocido.calorias.toFixed(3)} · toxicidad ${cocido.cocido.toxicidad.toFixed(4)} · ` +
          `neto ${cocido.cocido.neto.toFixed(2)} (tick ${String(cocido.tick)})`,
      '',
      '  El fuego mueve LOS DOS términos y no uno: las calorías suben 2,16× porque sube',
      '  `digestibility`, y el veneno cae 7,3×. El signo lo da vuelta el segundo.',
    )
    log(filas)

    // ─── LO QUE ESTA MEDICIÓN CORRIGIÓ, y es una premisa del proyecto ────────
    //
    // «Cocinar es la única puerta a la comida que la escena ofrece» estaba escrito
    // como si fuera del MUNDO y es del DECRETO. En el catálogo hay tres sustancias
    // que pagan crudas —las tres de bicho: huevo, médula y grasa— y el dios no
    // suelta ninguna de las tres en los nueve chunks del arranque. La premisa
    // sobrevive para el Hito 5, pero por otro motivo del que estaba escrito, y el
    // motivo nuevo se puede cambiar sin tocar una constante: es dónde el dios
    // siembra, no cuánto castiga el veneno.
    expect(convienen).toEqual(['huevo', 'medula', 'grasa'])
    expect(alaVista).toHaveLength(0)
    expect(cocido.crudo.neto).toBeLessThan(0)
    expect(cocido.cocido?.neto ?? 0).toBeGreaterThan(0)
  })
})

/**
 * Todas las sustancias CON CALORÍAS que el dios pone en los nueve chunks del
 * arranque, en las veinte semillas. Cuenta las sueltas y los pozos: el cuerpo del
 * pozo está hecho de lo que ese pozo entrega (`cuerpoDePozo`), así que su
 * sustancia es la que la criatura se lleva a la mano al extraer.
 */
function sustanciasQueElDiosDecreta(): ReadonlySet<string> {
  const out = new Set<string>()
  for (let k = 0; k < SEMILLAS; k += 1) {
    const base = mundo({
      bodies: [enElPiso(criatura('medidor'), EN(0, 0))],
      actors: [actor('medidor')],
    })
    const w = stepWorld({ ...base, dios: crearDios(SEMILLA_BASE + BigInt(k)) }, []).state
    for (const c of w.bodies.values()) {
      const esDelDios = c.body.id.startsWith(PREFIJO_SUELTA) || c.body.id.startsWith(PREFIJO_POZO)
      if (!esDelDios) continue
      if (!(qualityOf(c.body, 'calories', w.phys) > 0)) continue
      const sub = c.body.parts[0]?.substance
      if (sub !== undefined) out.add(sub)
    }
  }
  return out
}

/** Un kilo de la sustancia, a la temperatura del mundo. */
function unKilo(sub: string): Body {
  return cuerpo('x', sub, 1, { temperature: T_AMBIENTE })
}

/**
 * El pescado del criterio sobre una brasa, hasta que cruza la ventana de la
 * innata. Devuelve la cuenta de `mordidaDe` antes y después, con el margen del
 * tanque canónico.
 */
function cocinarUnPescado(): {
  readonly crudo: Bocado
  readonly cocido: Bocado | undefined
  readonly tick: number
} {
  const margen = TECHO_DEL_TANQUE - TANQUE_CANONICO
  // Sobre una piedra en la MISMA celda de la brasa, que es el montaje `parrilla`.
  // La primera versión de esta escena puso el pescado en el piso a una celda de
  // una brasa de 1 kg: eso le entrega 33 °C y no cocina nada. El montaje decide
  // más que la temperatura de la llama, y por eso va escrito y no elegido al azar.
  let w: WorldState = mundo({
    bodies: [
      enElPiso(cuerpo('brasa', 'madera', 1, { temperature: 400 }), EN(0, 0)),
      enElPiso(cuerpo('piedra', 'piedra', 1), EN(0, 0)),
      {
        ...enElPiso(cuerpo('pez', 'pescado', 2.887, { temperature: T_AMBIENTE }), EN(0, 0)),
        supportedBy: 'piedra',
      },
    ],
  })
  const primero = w.bodies.get('pez')
  if (primero === undefined) throw new Error('no está el pez')
  const crudo = netoDe(primero.body, w, margen)
  for (let tick = 1; tick <= 4_000; tick += 1) {
    w = stepWorld(w, []).state
    const c = w.bodies.get('pez')
    if (c === undefined) break
    if (qualityOf(c.body, 'digestibility', w.phys) >= 0.85) {
      return { crudo, cocido: netoDe(c.body, w, margen), tick }
    }
  }
  return { crudo, cocido: undefined, tick: -1 }
}
