// ─── ¿EL FUEGO PRENDE OTRA COSA? ─────────────────────────────────────────────
//
// La pregunta que decide CUATRO de las diez secuencias del criterio de emergencia
// del Hito 5 —tapar la fogata para hacer carbón, alimentarla con leños, la cadena
// de la yesca, la fogata que dura la noche—: **un cuerpo que arde, ¿enciende al
// que tiene apoyado encima?**
//
// El documento `ii/docs/hito-5-las-diez-secuencias.md` contesta que NO, y lo
// contesta DERIVANDO de dos fórmulas. Este archivo lo MIDE, porque una conclusión
// que mata cuatro entradas del criterio de corte del proyecto no se puede apoyar
// en una cuenta hecha a mano por nadie.
//
// ─── LA CADENA CAUSAL, para saber qué se está midiendo ──────────────────────
//
// Lo que un cuerpo encendido le entrega a su vecino NO es su temperatura: es una
// POTENCIA, y la potencia no sabe a cuántos grados está la fuente.
//
//   emitsPower = step(T ≥ ignitionPoint) · fuelEnergy · mass · EMISSION_PER_FUEL
//
// El `step` es todo lo que la temperatura de la fuente aporta: prendida o no. Una
// vara a 615 °C —la meseta que el ADR II-0011 le dio al fuego— y una a 301 °C
// entregan EXACTAMENTE la misma potencia. De ahí sale, sin que nadie lo escriba,
// que lo único que gobierna la propagación es LA MASA DE LO QUE ARDE.
//
// Y del otro lado, la ley 1 en régimen (`temperaturaDeEquilibrio`):
//
//   T_eq = ambiente + potencia · EXPOSICION[montaje] / H_PERDIDA
//
// con `contacto = 0,6` y `H_PERDIDA = 0,5`, o sea un factor 1,2 sobre la potencia.
//
// ─── POR QUÉ NO SE PUEDE SALIR POR ARRIBA ───────────────────────────────────
//
// Sumando fuentes, no: `entornoDe` toma UNA —la que MÁS LO CALIENTA, o sea la de
// mayor `potencia · formFactor(distancia, montaje)`— y está dicho en su comentario
// (`src/step.ts`), porque el `Entorno` de la física acepta una sola. Dos fogatas al
// lado de la misma vara valen lo que la que le entrega más calor, y no lo que la
// más grande: eso último es lo que decía acá y era el bug que
// `la-fuente-se-elige-por-calor.test.ts` mide. Para el barrido de abajo no cambia
// nada —hay una sola fuente— y para la conclusión tampoco: la propagación sigue
// gobernada por la masa de lo que arde.
//
// Y la masa de la fuente tiene techo, porque **encender cuesta y `stamina` topa en
// 1000**: llevar m kg de madera a sus 300 °C cuesta `m · 1,7 · 288 / 0,35 + 2,40`
// de `stamina`, o sea que la vara más pesada que alguien puede encender frotando
// pesa 0,713 kg. Ese techo no lo mide este archivo —lo mide `el-fuego.test.ts`—
// pero es la razón por la que la tabla de abajo barre justo ese rango.

import { describe, expect, it } from 'vitest'
import { qualityOf, temperaturaDeEquilibrio } from '@anima/physics'
import type { QualityId } from '@anima/physics'

import { stepWorld } from '../src/step.js'
import type { WorldBody, WorldState } from '../src/step.js'
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

/**
 * La fuente nace YA ENCENDIDA, a 700 °C.
 *
 * No se la enciende frotando a propósito: eso mediría el precio de encender, que
 * ya está medido en otro lado, y encima ataría este archivo al techo de `stamina`.
 * Acá se le REGALA a la fuente el estado que se quiere probar —«hay algo ardiendo
 * de esta masa»— y se pregunta qué le hace al vecino. Si ni siquiera regalado
 * alcanza, regatearlo es peor.
 */
function fuenteYBlanco(masaFuente: number, masaBlanco = 0.2): WorldState {
  const fuente = cuerpo('fuente', 'madera', masaFuente, { temperature: 700 })
  const blanco = cuerpo('blanco', 'madera', masaBlanco, { temperature: 15 })
  const encima: WorldBody = { ...enElPiso(blanco, EN(0, 0)), supportedBy: 'fuente' }
  return mundo({ bodies: [enElPiso(fuente, EN(0, 0)), encima] })
}

function correr(w0: WorldState, ticks: number): { w: WorldState; pico: number } {
  let w = w0
  let pico = q(w, 'blanco', 'temperature')
  for (let i = 0; i < ticks; i += 1) {
    w = stepWorld(w, []).state
    // El blanco puede desaparecer: si llegara a arder, la ley 4 lo convierte en
    // carbón o ceniza y el id cambia. Que se caiga la lectura ES el resultado.
    if (w.bodies.get('blanco') === undefined) return { w, pico: Number.POSITIVE_INFINITY }
    const t = q(w, 'blanco', 'temperature')
    if (t > pico) pico = t
  }
  return { w, pico }
}

describe('el fuego y su vecino', () => {
  /** El punto de ignición de la madera, leído del catálogo y no copiado. */
  const IGNICION_MADERA = (): number => {
    const w = mundo({ bodies: [enElPiso(cuerpo('x', 'madera', 1), EN(0, 0))] })
    return q(w, 'x', 'ignitionPoint')
  }

  it('LO QUE ENTREGA UNA FUENTE ENCENDIDA depende de su MASA y no de su temperatura', () => {
    // Dos fuentes de la misma masa, una a 350 °C y otra a 700 °C. Si el vecino
    // termina a la misma temperatura, queda probado que la temperatura de la
    // fuente no viaja: lo único que viaja es el `step` de estar prendida.
    const tibia = mundo({
      bodies: [
        enElPiso(cuerpo('fuente', 'madera', 0.5, { temperature: 350 }), EN(0, 0)),
        { ...enElPiso(cuerpo('blanco', 'madera', 0.2, { temperature: 15 }), EN(0, 0)), supportedBy: 'fuente' },
      ],
    })
    const a = correr(tibia, 400)
    const b = correr(fuenteYBlanco(0.5), 400)

    log([
      '─── LA TEMPERATURA DE LA FUENTE NO VIAJA ───',
      `  fuente a 350 °C → el blanco topa en ${a.pico.toFixed(4)} °C`,
      `  fuente a 700 °C → el blanco topa en ${b.pico.toFixed(4)} °C`,
    ])
    expect(a.pico).toBeCloseTo(b.pico, 6)
  })

  it('LA TABLA: qué le hace al vecino cada masa de fuente, medido contra la ley 1', () => {
    /**
     * 100 segundos de mundo. No son un número redondo elegido por gusto: la ley 1
     * es exponencial y a los 20 s el blanco más chico estaba al 98,8% de su
     * asíntota, o sea que la tabla habría reportado temperaturas sistemáticamente
     * bajas y la conclusión —«no llega»— habría salido reforzada por el error de
     * medición en vez de por el mundo. Con 100 s el sesgo queda debajo del cerco.
     */
    const TICKS = 2000
    const MASAS = [0.2, 0.4, 0.6, 0.7132, 0.79, 0.8, 1.0, 2.0]
    const ign = IGNICION_MADERA()
    const filas: string[] = [
      '─── UNA VARA ARDIENDO Y UNA MADERA APOYADA ENCIMA (montaje `contacto`) ───',
      `  el punto de ignición de la madera es ${ign.toFixed(0)} °C`,
      '',
      '  masa fuente │ potencia │ T_eq predicha │  T medida  │ ¿prende?',
      '  ────────────┼──────────┼───────────────┼────────────┼─────────',
    ]

    let primeraQuePrende: number | undefined
    for (const m of MASAS) {
      const w0 = fuenteYBlanco(m)
      const potencia = q(w0, 'fuente', 'emitsPower')
      const predicha = temperaturaDeEquilibrio(potencia, 0, 'contacto')
      const { pico } = correr(w0, TICKS)
      const prende = pico >= ign
      if (prende && primeraQuePrende === undefined) primeraQuePrende = m
      filas.push(
        `  ${m.toFixed(4).padStart(11)} │ ${potencia.toFixed(2).padStart(8)} │ ` +
          `${predicha.toFixed(2).padStart(13)} │ ${(pico === Number.POSITIVE_INFINITY ? 'ardió' : pico.toFixed(2)).padStart(10)} │ ` +
          `${prende ? 'SÍ' : 'no'}`,
      )
      // La ley 1 en régimen tiene que explicar lo que el mundo hizo. Si no lo
      // explica, el modelo del documento está mal y todo lo que se derivó de él
      // hay que tirarlo.
      //
      // Se afirma un CERCO y no una igualdad, y el cerco es asimétrico porque la
      // ley es asimétrica: relajar hacia el equilibrio se acerca DESDE ABAJO y no
      // lo cruza nunca. A 20 s de mundo el blanco de 0,2 kg estaba al 98,8% del
      // asíntota (86,13 contra 87,14) y una igualdad a dos decimales lo daba por
      // roto. Lo que hay que exigir es que no lo pase y que llegue cerca.
      if (!prende) {
        expect(pico).toBeLessThanOrEqual(predicha + 1e-9)
        expect(pico).toBeGreaterThan(predicha * 0.98)
      }
    }

    filas.push('')
    filas.push(
      primeraQuePrende === undefined
        ? '  NINGUNA de las masas probadas prende la madera de al lado.'
        : `  La primera que prende pesa ${primeraQuePrende.toFixed(4)} kg.`,
    )
    log(filas)

    // EL NÚMERO QUE GOBIERNA: la masa a partir de la cual una fuente encendida
    // prende una madera por contacto. Se afirma para que moverlo se note.
    expect(primeraQuePrende).toBeDefined()
    expect(primeraQuePrende).toBeGreaterThan(0.7132)
  })

  it('EL TECHO SE CRUZA: la fuente que prendería la madera es más pesada que la que se puede encender', () => {
    // 0,7132 kg es la vara más pesada que `stamina` (tope 1000) puede llevar a
    // sus 300 °C frotando: `(1000 − 2,40) / (1,7 · 288 / 0,35)`. Está medido en
    // `el-fuego.test.ts`, que verifica que 0,6 llega y 1,0 no.
    const TECHO_DE_LO_QUE_SE_PUEDE_ENCENDER = 0.7132
    const ign = IGNICION_MADERA()

    const w0 = fuenteYBlanco(TECHO_DE_LO_QUE_SE_PUEDE_ENCENDER)
    const potencia = q(w0, 'fuente', 'emitsPower')
    const { pico } = correr(w0, 400)

    // Cuánta masa haría falta, despejando la ley 1: potencia = (ign − 15) · h / exp
    const potenciaNecesaria = ((ign - 15) * 0.5) / 0.6
    const masaNecesaria = (potenciaNecesaria * TECHO_DE_LO_QUE_SE_PUEDE_ENCENDER) / potencia

    log([
      '─── LOS DOS TECHOS, Y EL HUECO ENTRE ELLOS ───',
      `  lo más pesado que se puede ENCENDER frotando ..... ${TECHO_DE_LO_QUE_SE_PUEDE_ENCENDER.toFixed(4)} kg`,
      `  lo más caliente que eso pone al vecino ........... ${pico.toFixed(2)} °C`,
      `  lo que hace falta para PRENDER una madera ........ ${ign.toFixed(0)} °C`,
      `  falta ............................................ ${(ign - pico).toFixed(2)} °C`,
      `  la fuente tendría que pesar ...................... ${masaNecesaria.toFixed(4)} kg`,
      `  o sea un ${(((masaNecesaria - TECHO_DE_LO_QUE_SE_PUEDE_ENCENDER) / TECHO_DE_LO_QUE_SE_PUEDE_ENCENDER) * 100).toFixed(1)}% más de lo que se puede encender`,
    ])

    expect(pico).toBeLessThan(ign)
    expect(masaNecesaria).toBeGreaterThan(TECHO_DE_LO_QUE_SE_PUEDE_ENCENDER)
  })

  it('LO QUE SÍ PRENDE DE REBOTE, y por qué no alcanza para nada', () => {
    // La hoja seca enciende a 180 y la corteza a 250: las dos están abajo de los
    // 272 °C que la vara más grande encendible entrega. O sea que la cadena
    // ARRANCA. Lo que hay que medir es si el segundo eslabón entrega más que el
    // primero, porque si no, la cadena es un escalón que baja.
    const ign = IGNICION_MADERA()
    const filas: string[] = ['─── EL SEGUNDO ESLABÓN DE LA CADENA ───']
    let mejor = 0
    for (const [sust, masa] of [
      ['hoja-seca', 0.08],
      ['corteza', 0.5],
      ['junco', 0.4],
    ] as const) {
      const w = mundo({ bodies: [enElPiso(cuerpo('x', sust, masa, { temperature: 700 }), EN(0, 0))] })
      const p = q(w, 'x', 'emitsPower')
      const entrega = temperaturaDeEquilibrio(p, 0, 'contacto')
      if (entrega > mejor) mejor = entrega
      filas.push(
        `  ${sust.padEnd(10)} a ${masa.toFixed(2)} kg (lo más grande que se siembra) → potencia ${p.toFixed(2)}, entrega ${entrega.toFixed(2)} °C`,
      )
    }
    filas.push('')
    filas.push(`  lo mejor del segundo eslabón entrega ${mejor.toFixed(2)} °C contra los ${ign.toFixed(0)} que pide la madera`)
    log(filas)

    // Si esto se pusiera en verde al revés, la cadena de la yesca volvería a la
    // lista de secuencias y este archivo entero cambiaría de conclusión.
    expect(mejor).toBeLessThan(ign)
  })

  // ─── LA PUERTA QUE SÍ ESTÁ ABIERTA ────────────────────────────────────────
  //
  // Todo lo de arriba mide MADERA CONTRA MADERA, y de ahí sale que falta un
  // 10,8%. Pero la madera no es el mejor combustible del catálogo: la GRASA
  // tiene `fuelEnergy` 30 contra 18, o sea que rinde 1,67 veces más potencia por
  // kilo. Lo que la deja afuera es otra cosa: `rigidity` 0,1 contra el
  // `rigidity >= 0,5` que los dos roles de `friccion` exigen. **No se puede
  // frotar grasa.**
  //
  // Y ahí aparece el movimiento que nadie escribió: ATARLA A UNA VARA. El
  // ensamble promedia la rigidez por masa, así que mientras la madera sea al
  // menos el doble de la grasa el conjunto sigue pasando el umbral del rol — y
  // la potencia sube porque la grasa aporta 30 por kilo.
  //
  // El óptimo, despejado de las dos restricciones y VERIFICADO abajo: la grasa
  // es exactamente un tercio de la masa. Si sale, la propagación existe y las
  // cuatro secuencias que el documento dio por muertas vuelven — con una
  // antorcha, que es lo más parecido a inventar algo que este mundo tiene.

  it('LA ANTORCHA: grasa atada a una vara cruza el umbral que la madera sola no cruza', () => {
    const ign = IGNICION_MADERA()

    /** El umbral del rol `a` de `friccion`, leído del catálogo y no copiado. */
    const rigidezPedida = ((): number => {
      const rol = mundo().phys.processes.get('friccion')?.roles.find((r) => r.name === 'a')
      const t = rol?.where.find((x) => x.q === 'rigidity')
      if (t === undefined) throw new Error('friccion cambió de forma')
      return t.v
    })()

    const filas: string[] = [
      '─── LA ANTORCHA ───',
      `  el rol \`a\` de friccion pide rigidity >= ${rigidezPedida.toFixed(2)}`,
      '',
      '  madera │ grasa  │ rigidez │ costo encender │ potencia │ entrega │ ¿prende madera?',
      '  ───────┼────────┼─────────┼────────────────┼──────────┼─────────┼────────────────',
    ]

    let mejorEntrega = 0
    let mejorReceta = ''
    for (const [w, f] of [
      [0.449, 0.2245],
      [0.4, 0.2],
      [0.5, 0.25],
      [0.3, 0.15],
      [0.449, 0.15],
    ] as const) {
      const antorcha = {
        id: 'antorcha',
        form: 'vara' as const,
        parts: [
          { substance: 'madera', mass: w, q: {} },
          { substance: 'grasa', mass: f, q: {} },
        ],
        joints: [],
        state: { temperature: 15 },
      }
      const frio = mundo({ bodies: [enElPiso(antorcha, EN(0, 0))] })
      const rigidez = q(frio, 'antorcha', 'rigidity')
      const capacidad = q(frio, 'antorcha', 'heatCapacity')
      // Lo que cuesta llevarla a su ignición frotando, con la eficiencia del
      // `poweredBy` leída del catálogo. Es la misma cuenta que `el-fuego.test.ts`
      // hace para la vara pelada, con la capacidad calorífica del ENSAMBLE.
      const eficiencia = ((): number => {
        const e = frio.phys.processes.get('friccion')?.effects[0]
        if (e === undefined || e.k !== 'drive' || e.poweredBy === undefined) {
          throw new Error('friccion cambió de forma')
        }
        return e.poweredBy.efficiency
      })()
      const costo = (capacidad * (ign - 15)) / eficiencia

      const caliente = mundo({
        bodies: [
          enElPiso({ ...antorcha, state: { temperature: 700 } }, EN(0, 0)),
          { ...enElPiso(cuerpo('blanco', 'madera', 0.2, { temperature: 15 }), EN(0, 0)), supportedBy: 'antorcha' },
        ],
      })
      const potencia = q(caliente, 'antorcha', 'emitsPower')
      const entrega = temperaturaDeEquilibrio(potencia, 0, 'contacto')
      const sirve = rigidez >= rigidezPedida && costo <= 1000 && entrega >= ign
      if (sirve && entrega > mejorEntrega) {
        mejorEntrega = entrega
        mejorReceta = `${w.toFixed(3)} kg de madera + ${f.toFixed(4)} kg de grasa`
      }
      filas.push(
        `  ${w.toFixed(3).padStart(6)} │ ${f.toFixed(4).padStart(6)} │ ` +
          `${rigidez.toFixed(4).padStart(7)} │ ${costo.toFixed(2).padStart(14)} │ ` +
          `${potencia.toFixed(2).padStart(8)} │ ${entrega.toFixed(2).padStart(7)} │ ` +
          `${sirve ? 'SÍ' : rigidez < rigidezPedida ? 'no: muy blanda' : costo > 1000 ? 'no: no se paga' : 'no: no alcanza'}`,
      )
    }

    filas.push('')
    filas.push(
      mejorReceta === ''
        ? '  NINGUNA receta de antorcha cruza los tres umbrales a la vez.'
        : `  SÍ SE PUEDE: ${mejorReceta} → entrega ${mejorEntrega.toFixed(2)} °C contra ${ign.toFixed(0)} que pide la madera.`,
    )
    log(filas)

    // Y la prueba de que no es una cuenta: la madera de al lado tiene que arder
    // de verdad, en el mundo, con la antorcha encendida encima.
    const antorcha = {
      id: 'antorcha',
      form: 'vara' as const,
      parts: [
        { substance: 'madera', mass: 0.449, q: {} },
        { substance: 'grasa', mass: 0.2245, q: {} },
      ],
      joints: [],
      state: { temperature: 700 },
    }
    const w0 = mundo({
      bodies: [
        enElPiso(antorcha, EN(0, 0)),
        { ...enElPiso(cuerpo('blanco', 'madera', 0.2, { temperature: 15 }), EN(0, 0)), supportedBy: 'antorcha' },
      ],
    })
    const { pico } = correr(w0, 2000)
    log([`  y en el mundo: el blanco llegó a ${pico === Number.POSITIVE_INFINITY ? 'arder (cambió de sustancia)' : `${pico.toFixed(2)} °C`}`])

    expect(mejorReceta).not.toBe('')
    expect(pico).toBeGreaterThanOrEqual(ign)
  })

  it('Y CUÁNTO MIDE LA VENTANA: el barrido fino, porque el óptimo cae CLAVADO sobre el umbral', () => {
    // La receta de arriba da `rigidity` exactamente 0,5000 —sale de la
    // aritmética: con grasa = madera/2, la rigidez es (0,7 + 0,05)/1,5 = 0,5
    // clavado— y el rol pide `>= 0,5`. O sea que la antorcha óptima pasa POR EL
    // ÚLTIMO BIT, y en el barrido de arriba dos filas con la misma proporción
    // exacta cayeron de lados distintos del umbral.
    //
    // Una mecánica que depende del redondeo no es una mecánica: es un accidente.
    // Lo que este test contesta es si la ventana tiene ANCHO, o si toda la
    // propagación del fuego de este mundo se apoya en un empate de punto
    // flotante. Si el ancho es cero, la antorcha no existe y la conclusión de que
    // el fuego no se propaga queda en pie.
    const ign = IGNICION_MADERA()
    const TANQUE = 1000
    const PASO = 0.01

    const eficiencia = 0.35
    let cuantas = 0
    /**
     * LA GRASA MÍNIMA de todo el conjunto factible, y no es curiosidad: es lo que
     * el bioma tiene que llegar a sembrar. Una antorcha que sólo sale con 0,21 kg
     * obliga a sembrar piezas grandes, y una pieza grande de grasa —nutrition 22,
     * digestibility 0,7— es comida gratis tirada en el piso, que es exactamente lo
     * que el criterio del riesgo 4 no puede permitir. Este número es la bisagra
     * entre «el fuego se propaga» y «se puede vivir de garronear».
     */
    let menosGrasa = Number.POSITIVE_INFINITY
    let mejor: { w: number; f: number; holgura: number; entrega: number; costo: number } | undefined
    for (let w = 0.2; w <= 0.7 + 1e-9; w += PASO) {
      for (let f = 0.02; f <= 0.4 + 1e-9; f += PASO) {
        const b = {
          id: 'a',
          form: 'vara' as const,
          parts: [
            { substance: 'madera', mass: Number(w.toFixed(4)), q: {} },
            { substance: 'grasa', mass: Number(f.toFixed(4)), q: {} },
          ],
          joints: [],
          state: { temperature: 700 },
        }
        const m = mundo({ bodies: [enElPiso(b, EN(0, 0))] })
        const rigidez = q(m, 'a', 'rigidity')
        if (rigidez < 0.5) continue
        const costo = (q(m, 'a', 'heatCapacity') * (ign - 15)) / eficiencia
        if (costo > TANQUE) continue
        const entrega = temperaturaDeEquilibrio(q(m, 'a', 'emitsPower'), 0, 'contacto')
        if (entrega < ign) continue
        cuantas += 1
        if (f < menosGrasa) menosGrasa = f
        // La holgura del peor de los tres umbrales, normalizada. Es lo que dice
        // si la receta vive cómoda o vive del redondeo.
        const holgura = Math.min(
          (rigidez - 0.5) / 0.5,
          (TANQUE - costo) / TANQUE,
          (entrega - ign) / ign,
        )
        if (mejor === undefined || holgura > mejor.holgura) {
          mejor = { w: Number(w.toFixed(4)), f: Number(f.toFixed(4)), holgura, entrega, costo }
        }
      }
    }

    log([
      '─── LA VENTANA DE LA ANTORCHA, barrida de a un centésimo ───',
      `  recetas que cruzan los TRES umbrales: ${String(cuantas)}`,
      mejor === undefined
        ? '  ninguna. La antorcha no existe y el fuego no se propaga.'
        : `  la más holgada: ${mejor.w.toFixed(2)} kg de madera + ${mejor.f.toFixed(2)} kg de grasa\n` +
          `    costo ${mejor.costo.toFixed(2)} de ${String(TANQUE)} · entrega ${mejor.entrega.toFixed(2)} °C de ${ign.toFixed(0)} pedidos\n` +
          `    holgura del umbral más ajustado: ${(mejor.holgura * 100).toFixed(2)}%`,
      `  la que menos grasa pide: ${menosGrasa === Number.POSITIVE_INFINITY ? '—' : `${menosGrasa.toFixed(2)} kg`}`,
    ])

    // Si esto se pone en rojo, la antorcha se murió y con ella vuelven las cuatro
    // secuencias que dependen de que el fuego prenda otra cosa.
    expect(cuantas).toBeGreaterThan(0)
  })

  // ─── EL FARDO: la puerta que estaba abierta todo el tiempo ────────────────
  //
  // Todo lo de arriba mide PIEZAS SUELTAS, una por una, y de ahí sale que la
  // cadena de la yesca no llega: la corteza más grande que un bioma siembra pesa
  // 0,5 kg y entrega 175 °C contra los 300 que la madera pide.
  //
  // Pero la criatura no está obligada a usar una pieza. `union` existe, es una de
  // las quince innatas, y la masa de un ensamble es EXTENSIVA: se suma. Dos
  // cortezas atadas son un cuerpo de 1 kg, y un cuerpo de 1 kg de corteza entrega
  // lo que uno de 0,5 no entrega.
  //
  // Y el primer eslabón ya alcanza: la vara de madera más pesada que se puede
  // encender frotando entrega 271 °C, y la corteza enciende a 250.
  //
  // O sea que la cadena completa es: FROTAR UNA VARA → PRENDER UN FARDO DE
  // CORTEZA → Y CON EL FARDO, PRENDER UN LEÑO. Sin tocar una sola constante de la
  // física, sin sembrar nada nuevo, y con las habilidades que ya existen.

  it('EL FARDO DE CORTEZA: dos piezas atadas prenden lo que ninguna prende sola', () => {
    const ign = IGNICION_MADERA()
    const ignCorteza = ((): number => {
      const w = mundo({ bodies: [enElPiso(cuerpo('c', 'corteza', 0.5), EN(0, 0))] })
      return q(w, 'c', 'ignitionPoint')
    })()

    // Eslabón 1: la vara más pesada que se puede encender, contra la corteza.
    const eslabon1 = temperaturaDeEquilibrio(
      q(fuenteYBlanco(0.7132), 'fuente', 'emitsPower'),
      0,
      'contacto',
    )

    // Eslabón 2: el fardo. Se barre cuántas piezas de corteza hacen falta, con la
    // masa que el bioma REALMENTE siembra (0,05 a 0,5, `oracle/src/bioma.ts`).
    const MAS_GRANDE_QUE_SE_SIEMBRA = 0.5
    const filas: string[] = [
      '─── LA CADENA QUE NADIE PROBÓ ───',
      `  eslabón 1 · vara de 0,7132 kg encendida entrega ${eslabon1.toFixed(2)} °C · la corteza prende a ${ignCorteza.toFixed(0)} → ${eslabon1 >= ignCorteza ? 'PRENDE' : 'no prende'}`,
      '',
      '  piezas │ masa del fardo │ potencia │ entrega │ ¿prende el leño?',
      '  ───────┼────────────────┼──────────┼─────────┼─────────────────',
    ]

    let piezasQueHacenFalta: number | undefined
    for (const n of [1, 2, 3, 4]) {
      const masa = n * MAS_GRANDE_QUE_SE_SIEMBRA
      const fardo = {
        id: 'fardo',
        form: 'vara' as const,
        parts: Array.from({ length: n }, () => ({
          substance: 'corteza',
          mass: MAS_GRANDE_QUE_SE_SIEMBRA,
          q: {},
        })),
        joints: [],
        state: { temperature: 700 },
      }
      const w0 = mundo({
        bodies: [
          enElPiso(fardo, EN(0, 0)),
          { ...enElPiso(cuerpo('blanco', 'madera', 0.2, { temperature: 15 }), EN(0, 0)), supportedBy: 'fardo' },
        ],
      })
      const potencia = q(w0, 'fardo', 'emitsPower')
      const entrega = temperaturaDeEquilibrio(potencia, 0, 'contacto')
      const prende = entrega >= ign
      if (prende && piezasQueHacenFalta === undefined) piezasQueHacenFalta = n
      filas.push(
        `  ${String(n).padStart(6)} │ ${masa.toFixed(2).padStart(14)} │ ${potencia.toFixed(2).padStart(8)} │ ` +
          `${entrega.toFixed(2).padStart(7)} │ ${prende ? 'SÍ' : 'no'}`,
      )
    }
    log(filas)

    // Y la prueba en el mundo, no en la fórmula: el fardo mínimo encendido, con un
    // leño apoyado, y el leño tiene que arder.
    const n = piezasQueHacenFalta ?? 2
    const fardo = {
      id: 'fardo',
      form: 'vara' as const,
      parts: Array.from({ length: n }, () => ({ substance: 'corteza', mass: 0.5, q: {} })),
      joints: [],
      state: { temperature: 700 },
    }
    const { pico } = correr(
      mundo({
        bodies: [
          enElPiso(fardo, EN(0, 0)),
          { ...enElPiso(cuerpo('blanco', 'madera', 0.2, { temperature: 15 }), EN(0, 0)), supportedBy: 'fardo' },
        ],
      }),
      2000,
    )
    log([
      `  y en el mundo: con ${String(n)} piezas el leño llegó a ` +
        `${pico === Number.POSITIVE_INFINITY ? 'arder (cambió de sustancia)' : `${pico.toFixed(2)} °C`}`,
      `  MAX_PARTS del catálogo es 6, así que un fardo de ${String(n)} entra de sobra.`,
    ])

    expect(eslabon1).toBeGreaterThanOrEqual(ignCorteza)
    expect(piezasQueHacenFalta).toBeDefined()
    expect(pico).toBeGreaterThanOrEqual(ign)
  })
})
