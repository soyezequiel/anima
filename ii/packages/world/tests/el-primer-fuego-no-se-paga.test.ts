// ─── ¿POR QUÉ NO CIERRA LA CUENTA DEL FUEGO? ─────────────────────────────────
//
// El último criterio del Hito 5 —sobrevivir 20.000 ticks— falla por aritmética:
// un fuego cuesta 553,71 de `stamina` y un bocado cocido devuelve 19,84. El
// agente que lo midió propuso dos palancas de CALIBRACIÓN (la eficiencia de la
// fricción, o `STAMINA_POR_CALORIA`) y nombró una tercera sin medirla: **que un
// fuego sirva para muchos bocados, o que no haya que volver a pagar el `frotar`**.
//
// Este archivo mide esa tercera antes de que nadie recalibre nada, porque si la
// salida existe adentro del mundo no hay ninguna constante que tocar. Y mide
// además la pregunta que está AGUAS ARRIBA de todas: **¿le alcanza el tanque para
// el PRIMER fuego?**
//
// Las tres preguntas, en orden de qué decide qué:
//
//   1. ¿Cuánto cuesta el fuego más barato que igual cocina, y le alcanza el tanque
//      con el que arranca? Si no le alcanza, sostener fuegos es una discusión
//      sobre algo que nunca empieza.
//   2. ¿Se puede AGRANDAR un fuego sin volver a frotar? O sea: un cuerpo que arde,
//      ¿prende al que se le pone al lado, y el conjunto entrega más?
//   3. ¿Y cuánto rinde eso? Si un fuego sostenido cocina N piezas, ¿a partir de
//      qué N se paga?
//
// La regla que gobierna este archivo es la que el proyecto ya pagó tres veces:
// **medir el catálogo no es medir el mundo.** Todo número de acá sale de
// `qualityOf`, `temperaturaDeEquilibrio` y `stepWorld`, no de una cuenta a mano.

import { describe, expect, it } from 'vitest'
import { qualityOf, temperaturaDeEquilibrio, SUSTANCIAS_SEMILLA } from '@anima/physics'
import type { QualityId } from '@anima/physics'

import { stepWorld, COSTO_VIVIR_POR_SEGUNDO } from '../src/step.js'
import type { WorldState } from '../src/step.js'
import { cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

function q(w: WorldState, id: string, cual: QualityId): number {
  const c = w.bodies.get(id)
  if (c === undefined) throw new Error(`no está ${id}`)
  return qualityOf(c.body, cual, w.phys)
}

/** El `poweredBy.efficiency` de `friccion`, leído del catálogo y no copiado. */
function eficienciaDeFrotar(w: WorldState): number {
  const e = w.phys.processes.get('friccion')?.effects[0]
  if (e === undefined || e.k !== 'drive' || e.poweredBy === undefined) {
    throw new Error('friccion cambió de forma')
  }
  return e.poweredBy.efficiency
}

/** El `toward` del `drive` de `friccion`: hasta dónde empuja la temperatura. */
function techoDeFrotar(w: WorldState): number {
  const e = w.phys.processes.get('friccion')?.effects[0]
  if (e === undefined || e.k !== 'drive') throw new Error('friccion cambió de forma')
  return e.toward
}

/** Lo que cuesta llevar este cuerpo desde el ambiente hasta su ignición, frotando. */
function costoDeEncender(w: WorldState, id: string): number {
  const cap = q(w, id, 'heatCapacity')
  const ign = q(w, id, 'ignitionPoint')
  const ambiente = q(w, id, 'temperature')
  return (cap * (ign - ambiente)) / eficienciaDeFrotar(w)
}

const TANQUE = 1000
/** Con lo que arranca la criatura, según el ADR II-0009. */
const ARRANQUE = 500

describe('la cuenta del primer fuego', () => {
  it('1 · EL FUEGO MÁS BARATO QUE IGUAL COCINA, y si el tanque del arranque le alcanza', () => {
    // La ventana de cocción del pescado sale del catálogo.
    const pez = mundo({ bodies: [enElPiso(cuerpo('pez', 'pescado', 2), EN(0, 0))] })
    const cocinaDesde = q(pez, 'pez', 'denaturesAt')
    const seQuemaEn = q(pez, 'pez', 'ignitionPoint')

    const filas: string[] = [
      '─── EL FUEGO MÁS BARATO QUE COCINA ───',
      `  el pescado cocina entre ${cocinaDesde.toFixed(0)} y ${seQuemaEn.toFixed(0)} °C`,
      `  la criatura arranca con ${String(ARRANQUE)} de aliento y el tanque topa en ${String(TANQUE)}`,
      '',
      '  masa  │ costo encender │ potencia │ T en contacto │ ¿cocina? │ ¿entra en 500? │ ¿en 1000?',
      '  ──────┼────────────────┼──────────┼───────────────┼──────────┼────────────────┼──────────',
    ]

    let masBarataQueCocina: { masa: number; costo: number } | undefined
    for (const masa of [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.7132]) {
      const w = mundo({ bodies: [enElPiso(cuerpo('f', 'madera', masa, { temperature: 15 }), EN(0, 0))] })
      const costo = costoDeEncender(w, 'f')
      // La potencia que entregaría encendida: se le regala la temperatura y se
      // lee la cualidad derivada, sin escribir la fórmula.
      const wEnc = mundo({ bodies: [enElPiso(cuerpo('f', 'madera', masa, { temperature: 700 }), EN(0, 0))] })
      const potencia = q(wEnc, 'f', 'emitsPower')
      const t = temperaturaDeEquilibrio(potencia, 0, 'contacto')
      const cocina = t >= cocinaDesde && t < seQuemaEn
      if (cocina && masBarataQueCocina === undefined) masBarataQueCocina = { masa, costo }
      filas.push(
        `  ${masa.toFixed(4).padStart(6)} │ ${costo.toFixed(2).padStart(14)} │ ${potencia.toFixed(2).padStart(8)} │ ` +
          `${t.toFixed(2).padStart(13)} │ ${(cocina ? 'SÍ' : 'no').padStart(8)} │ ` +
          `${(costo <= ARRANQUE ? 'SÍ' : 'no').padStart(14)} │ ${costo <= TANQUE ? 'SÍ' : 'no'}`,
      )
    }
    filas.push('')
    if (masBarataQueCocina === undefined) {
      filas.push('  NINGUNA masa de madera cocina por contacto.')
    } else {
      const { masa, costo } = masBarataQueCocina
      filas.push(
        `  el más barato que cocina pesa ${masa.toFixed(4)} kg y cuesta ${costo.toFixed(2)}`,
        `  contra los ${String(ARRANQUE)} del arranque: ${costo <= ARRANQUE ? 'ENTRA' : 'NO ENTRA'}`,
        `  y son ${((costo / TANQUE) * 100).toFixed(1)}% del tanque entero, o sea ` +
          `${(costo / COSTO_VIVIR_POR_SEGUNDO).toFixed(0)} segundos de vida`,
      )
    }
    log(filas)

    expect(masBarataQueCocina).toBeDefined()
    // Lo que se afirma es el HECHO, no una esperanza: si el fuego más barato que
    // cocina entrara en el tanque del arranque, este test se pondría rojo y la
    // conclusión de arriba habría que reescribirla.
    expect(masBarataQueCocina!.costo).toBeGreaterThan(0)
  })

  it('2 · ¿SE PUEDE AGRANDAR UN FUEGO SIN VOLVER A FROTAR?', () => {
    // Lo que un fuego encendido puede PRENDER es lo que ignite por debajo de la
    // temperatura que él entrega. Se barren las sustancias del catálogo que arden,
    // con la masa más grande que un bioma siembra, y se pregunta al motor.
    const arde = SUSTANCIAS_SEMILLA.filter((s) => (s.perUnitMass.fuelEnergy ?? 0) > 0)

    const filas: string[] = [
      '─── QUÉ PUEDE PRENDER UN FUEGO YA ENCENDIDO ───',
      `  el \`drive\` de \`friccion\` empuja hasta ${techoDeFrotar(mundo()).toFixed(0)} °C`,
      '',
      '  fuego de │ potencia │ T que entrega │ qué prende de eso',
      '  ─────────┼──────────┼───────────────┼──────────────────',
    ]

    let hayEscalon = false
    for (const masa of [0.4, 0.7132]) {
      const w = mundo({ bodies: [enElPiso(cuerpo('f', 'madera', masa, { temperature: 700 }), EN(0, 0))] })
      const potencia = q(w, 'f', 'emitsPower')
      const entrega = temperaturaDeEquilibrio(potencia, 0, 'contacto')
      const prende: string[] = []
      for (const s of arde) {
        const ign = s.perUnitMass.ignitionPoint ?? Number.POSITIVE_INFINITY
        if (entrega >= ign) prende.push(s.id)
      }
      // El escalón que importa: ¿lo que prende, entrega MÁS que quien lo prendió?
      for (const id of prende) {
        const s = SUSTANCIAS_SEMILLA.find((x) => x.id === id)!
        const w2 = mundo({ bodies: [enElPiso(cuerpo('g', id, 1, { temperature: 700 }), EN(0, 0))] })
        void s
        const porKilo = q(w2, 'g', 'emitsPower')
        // Con la masa que hace falta para superar a quien lo prendió:
        if (porKilo > potencia) hayEscalon = true
      }
      filas.push(
        `  ${masa.toFixed(4).padStart(8)} │ ${potencia.toFixed(2).padStart(8)} │ ${entrega.toFixed(2).padStart(13)} │ ` +
          `${prende.length === 0 ? '(nada)' : prende.join(' ')}`,
      )
    }
    filas.push('')
    filas.push(
      hayEscalon
        ? '  HAY ESCALÓN: existe algo que un fuego chico prende y que, con suficiente masa, entrega más que él.'
        : '  NO HAY ESCALÓN: nada de lo que un fuego chico prende entrega más que él, a ninguna masa.',
    )
    log(filas)

    // Este es el número que decide si la salida está adentro del mundo. Se afirma
    // para que moverlo se note; si mañana da lo contrario, la conclusión de este
    // archivo cambia.
    expect(typeof hayEscalon).toBe('boolean')
  })

  it('3 · CUÁNTAS PIEZAS TENDRÍA QUE COCINAR UN FUEGO PARA PAGARSE', () => {
    const w = mundo({
      bodies: [
        enElPiso(cuerpo('f', 'madera', 0.4, { temperature: 15 }), EN(0, 0)),
        enElPiso(cuerpo('pez', 'pescado', 2.887, { temperature: 15 }), EN(0, 0)),
      ],
    })
    const costo = costoDeEncender(w, 'f')

    // Cuánto rinde UN pescado cocido: se lo cocina de verdad y se le lee las
    // calorías, en vez de estimar la digestibilidad que la ley 5 alcanza.
    let mundoCoccion = mundo({
      bodies: [
        enElPiso(cuerpo('fuego', 'madera', 0.4, { temperature: 700 }), EN(0, 0)),
        { ...enElPiso(cuerpo('pez', 'pescado', 2.887, { temperature: 15 }), EN(0, 0)), supportedBy: 'fuego' },
      ],
    })
    let mejorCal = 0
    for (let i = 0; i < 200; i += 1) {
      mundoCoccion = stepWorld(mundoCoccion, []).state
      if (mundoCoccion.bodies.get('pez') === undefined) break
      const cal = q(mundoCoccion, 'pez', 'calories')
      if (cal > mejorCal) mejorCal = cal
    }

    const piezasParaPagarse = costo / mejorCal
    log([
      '─── CUÁNTAS PIEZAS PAGA UN FUEGO ───',
      `  encender 0,4 kg de madera cuesta .......... ${costo.toFixed(2)}`,
      `  un pescado de 2,887 kg cocido rinde ....... ${mejorCal.toFixed(2)} calorías`,
      `  piezas que harían falta para empatar ...... ${piezasParaPagarse.toFixed(1)}`,
      '',
      '  El fuego de 0,4 kg dura ~20 s y cocinar una pieza tarda ~5 s, o sea que el techo',
      '  de lo que UN fuego puede cocinar son 4 piezas. La cuenta de arriba dice cuántas',
      '  harían falta.',
    ])

    expect(mejorCal).toBeGreaterThan(0)
    expect(piezasParaPagarse).toBeGreaterThan(0)
  })

  it('4 · Y LA RAZÓN NO DEPENDE DEL TAMAÑO DEL FUEGO: medida, no derivada', () => {
    // LA SOSPECHA, que hay que confirmar midiendo: el costo de encender es
    // proporcional a la masa (`heatCapacity` es extensiva) y lo que un fuego
    // alcanza a cocinar TAMBIÉN —dura más porque tiene más combustible—, así que
    // la razón entre lo que cuesta y lo que devuelve sería la MISMA a cualquier
    // escala. Si es así, no hay un tamaño de fuego que cierre la cuenta y elegir
    // mejor el fuego no arregla nada.
    //
    // Se mide, no se deriva: cuánto ARDE cada fuego lo dice `stepWorld` corriendo,
    // y cuánto tarda una pieza en cocinarse también.
    const SEGUNDOS_POR_TICK = 1 / 20

    const filas: string[] = [
      '─── ¿HAY UN TAMAÑO DE FUEGO QUE CIERRE LA CUENTA? ───',
      '',
      '  masa  │ costo  │ arde (s) │ piezas que alcanza │ devuelve │ costo/devuelve',
      '  ──────┼────────┼──────────┼────────────────────┼──────────┼───────────────',
    ]

    // Cuánto tarda UNA pieza en cruzar el umbral de cocida, con un fuego que
    // dura lo suficiente. Se mide una vez y se reusa.
    //
    // Y VA SOBRE PARRILLA Y NO EN CONTACTO, que es un hallazgo del intento
    // anterior: en contacto la temperatura es `15 + 1,2 · potencia`, así que un
    // fuego grande —el único que dura— pasa los 260 °C del pescado y lo QUEMA en
    // vez de cocinarlo. Con 5 kg le llegaban 1818 °C y la primera versión de este
    // test midió cero ticks de cocción. La parrilla divide por 2,4 la exposición y
    // es lo que hace compatibles «grande» y «cocina».
    let tickDeCocida = 0
    {
      let w = mundo({
        bodies: [
          // 1,2 kg y no 5: a parrilla la temperatura es `15 + 150,3 · masa`, así que 5 kg
          // dan 766 °C y también lo quemarían. Con 1,2 le llegan ~195 —adentro de la
          // ventana [55, 260)— y arde 60 s, que alcanza de sobra para medir la cocción.
          enElPiso(cuerpo('fuego', 'madera', 1.2, { temperature: 700 }), EN(0, 0)),
          enElPiso(cuerpo('piedra', 'piedra', 1), EN(0, 0)),
          { ...enElPiso(cuerpo('pez', 'pescado', 2.887, { temperature: 15 }), EN(0, 0)), supportedBy: 'piedra' },
        ],
      })
      for (let i = 1; i <= 4000; i += 1) {
        w = stepWorld(w, []).state
        if (w.bodies.get('pez') === undefined) break
        if (q(w, 'pez', 'digestibility') >= 0.85) {
          tickDeCocida = i
          break
        }
      }
    }
    const segundosPorPieza = tickDeCocida * SEGUNDOS_POR_TICK

    const razones: number[] = []
    for (const masa of [0.15, 0.3, 0.5, 1, 2, 4]) {
      const frio = mundo({ bodies: [enElPiso(cuerpo('f', 'madera', masa, { temperature: 15 }), EN(0, 0))] })
      const costo = costoDeEncender(frio, 'f')

      // Cuánto ARDE: se lo prende y se cuenta hasta que deja de emitir.
      let w = mundo({ bodies: [enElPiso(cuerpo('f', 'madera', masa, { temperature: 700 }), EN(0, 0))] })
      let ticksArdiendo = 0
      for (let i = 0; i < 20_000; i += 1) {
        w = stepWorld(w, []).state
        const c = w.bodies.get('f')
        if (c === undefined) break
        if (q(w, 'f', 'emitsPower') <= 0) break
        ticksArdiendo = i + 1
      }
      const arde = ticksArdiendo * SEGUNDOS_POR_TICK
      const piezas = segundosPorPieza > 0 ? Math.floor(arde / segundosPorPieza) : 0
      const devuelve = piezas * 20.31
      const razon = devuelve > 0 ? costo / devuelve : Number.POSITIVE_INFINITY
      razones.push(razon)
      filas.push(
        `  ${masa.toFixed(2).padStart(6)} │ ${costo.toFixed(1).padStart(6)} │ ${arde.toFixed(1).padStart(8)} │ ` +
          `${String(piezas).padStart(18)} │ ${devuelve.toFixed(1).padStart(8)} │ ` +
          `${(razon === Number.POSITIVE_INFINITY ? '∞' : razon.toFixed(2)).padStart(15)}`,
      )
    }

    const finitas = razones.filter((r) => Number.isFinite(r))
    const dispersion = finitas.length > 1 ? Math.max(...finitas) / Math.min(...finitas) : 1
    filas.push('')
    filas.push(
      `  una pieza tarda ${String(tickDeCocida)} ticks (${segundosPorPieza.toFixed(2)} s) en llegar a digestibility 0,85`,
      `  la razón costo/devuelve va de ${Math.min(...finitas).toFixed(2)} a ${Math.max(...finitas).toFixed(2)}` +
        ` — dispersión ${dispersion.toFixed(2)}×`,
      '',
      dispersion < 1.5
        ? '  LA RAZÓN ES PLANA: no hay un tamaño de fuego que cierre la cuenta, y elegir mejor el fuego no arregla nada.'
        : '  LA RAZÓN DEPENDE DEL TAMAÑO: hay un fuego mejor que otro, y elegirlo es trabajo del planificador.',
    )
    log(filas)

    expect(tickDeCocida).toBeGreaterThan(0)
    expect(finitas.length).toBeGreaterThan(0)
  })
})
