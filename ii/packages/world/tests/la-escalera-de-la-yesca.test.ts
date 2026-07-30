// ─── ¿EL FUEGO SE PAGA UNA SOLA VEZ? ─────────────────────────────────────────
//
// `el-primer-fuego-no-se-paga.test.ts` mide que la razón costo/devuelve del fuego
// es PLANA —de 4,96 a 5,68 entre 0,15 y 4 kg— y saca de ahí que no hay tamaño de
// fuego que cierre la cuenta. La medición es correcta y la conclusión sólo vale
// para lo que ese barrido hace, que es esto:
//
//   **cada fila de esa tabla ENCIENDE SU FUEGO FROTANDO.**
//
// Y por eso la razón es plana: `costoDeEncender` va con la masa (`heatCapacity` es
// extensiva) y lo que el fuego alcanza a cocinar también. Si el numerador dejara
// de ir con la masa de lo que arde, la razón dejaría de ser plana.
//
// Este archivo mide si el mundo tiene esa puerta, y la mide en tres preguntas que
// se contestan en orden porque cada una decide si la siguiente tiene sentido:
//
//   1. ¿QUÉ SE PUEDE FROTAR? `friccion` pide `rigidity >= 0.5` en los DOS palos y
//      su `drive` topa en 400 °C. Eso deja afuera a media tabla, y en particular
//      —y es contra-intuitivo— **deja afuera a la yesca**, que tiene rigidity 0,05.
//      La yesca no se frota: se PRENDE.
//   2. ¿UN FUEGO FROTADO PRENDE ALGO? Y si prende, ¿lo que prende entrega más que
//      él? Ése es el escalón. Sin escalón no hay escalera.
//   3. Y LA CUENTA CON UN SOLO `frotar` PAGADO: si la escalera existe, ¿cuántas
//      piezas cocina el fuego grande al que se llega, contra el precio del único
//      fósforo que se compró?
//
// La regla que gobierna el archivo es la de siempre: **medir el catálogo no es
// medir el mundo.** Los escalones se prenden con `stepWorld` corriendo, no con
// `temperaturaDeEquilibrio` despejada a mano. Las cuentas de catálogo que hay
// —costo de encender, potencia por kilo— salen de `qualityOf`, y están al lado de
// la medición del mundo justamente para que se vea cuándo no coinciden.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, qualityOf, temperaturaDeEquilibrio, SUSTANCIAS_SEMILLA, T_AMBIENTE } from '@anima/physics'
import type { QualityId } from '@anima/physics'

import { crearDios, decretoDe } from '../src/index.js'
import { stepWorld } from '../src/step.js'
import type { WorldBody, WorldState } from '../src/step.js'
import { cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })
const SEGUNDOS_POR_TICK = 1 / 20

/** Lo que rinde de `stamina` una pieza de pescado de 2,887 kg cocida. */
const LO_QUE_PAGA_UNA_PIEZA = 20.31

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

function q(w: WorldState, id: string, cual: QualityId): number {
  const c = w.bodies.get(id)
  if (c === undefined) throw new Error(`no está ${id}`)
  return qualityOf(c.body, cual, w.phys)
}

/** Una cualidad de una sustancia leída del catálogo a través de un cuerpo real. */
function deLaSustancia(sub: string, masa: number, cual: QualityId, estado = {}): number {
  const w = mundo({ bodies: [enElPiso(cuerpo('x', sub, masa, estado), EN(0, 0))] })
  return q(w, 'x', cual)
}

/** El `poweredBy.efficiency` de `friccion`, leído del catálogo y no copiado. */
function eficienciaDeFrotar(): number {
  const w = mundo()
  const e = w.phys.processes.get('friccion')?.effects[0]
  if (e === undefined || e.k !== 'drive' || e.poweredBy === undefined) {
    throw new Error('friccion cambió de forma')
  }
  return e.poweredBy.efficiency
}

/** El `toward` del `drive` de `friccion`: hasta dónde empuja la temperatura. */
function techoDeFrotar(): number {
  const w = mundo()
  const e = w.phys.processes.get('friccion')?.effects[0]
  if (e === undefined || e.k !== 'drive') throw new Error('friccion cambió de forma')
  return e.toward
}

/** El `rigidity` que `friccion` le pide a los dos palos, leído de los roles. */
function rigidezQuePideFrotar(): number {
  const w = mundo()
  const p = w.phys.processes.get('friccion')
  const r = p?.roles.find((x) => x.name === 'a')?.where.find((c) => c.q === 'rigidity')
  if (r === undefined) throw new Error('friccion cambió de forma')
  return r.v
}

/**
 * Lo que cuesta llevar `masa` kg de `sub` desde el ambiente hasta su ignición.
 *
 * El cuerpo se arma A LA TEMPERATURA AMBIENTE y no en frío: un cuerpo sin
 * `temperature` escrita lee 0, y con eso el costo sale 5% más caro que el que
 * mide `el-primer-fuego-no-se-paga.test.ts` (218,6 contra 207,6 para la vara de
 * 0,15 kg). Dos archivos que miden el mismo precio tienen que dar el mismo
 * número.
 */
function costoDeEncender(sub: string, masa: number): number {
  const estado = { temperature: T_AMBIENTE }
  const cap = deLaSustancia(sub, masa, 'heatCapacity', estado)
  const ign = deLaSustancia(sub, masa, 'ignitionPoint', estado)
  return (cap * (ign - T_AMBIENTE)) / eficienciaDeFrotar()
}

/** Las sustancias que arden, o sea las que tienen con qué. */
const ARDEN = SUSTANCIAS_SEMILLA.filter((s) => (s.perUnitMass.fuelEnergy ?? 0) > 0)

/**
 * La vara que se frota, y es la más chica que prende la yesca (bloque 2). Las dos
 * escaleras la comparten porque es el único gasto de las dos.
 */
const VARA = 0.5
/** Las masas de yesca del barrido: el segundo escalón va con la masa que arde. */
const YESCAS = [0.3, 0.6, 0.85, 1, 1.5, 2]
/** Y los leños, o sea el fuego al que se quiere llegar sin volver a frotar. */
const LEÑOS = [1, 2, 4, 8]
/** La yesca más chica que prende el leño, medida en el bloque 3. */
const YESCA_QUE_ALCANZA = 1
/** Las mismas veinte semillas del banco de la emergencia, y el mismo arranque. */
const SEMILLA_BASE = 20260728n

/**
 * Dónde puede ir la comida, que es lo único que la criatura elige después de
 * prender: sobre una piedra en la celda del fuego (`parrilla`) o en el piso a
 * tantas celdas. Los nombres son los del mundo (`montajeDe`), no de este archivo.
 */
const DONDE_VA_LA_COMIDA: readonly { como: string; dist: number; sobrePiedra: boolean }[] = [
  { como: 'parrilla d=0', dist: 0, sobrePiedra: true },
  { como: 'piso d=0', dist: 0, sobrePiedra: false },
  { como: 'piso d=1', dist: 1, sobrePiedra: false },
  { como: 'piso d=2', dist: 2, sobrePiedra: false },
  { como: 'piso d=3', dist: 3, sobrePiedra: false },
]

describe('la escalera de la yesca', () => {
  it('1 · QUÉ SE PUEDE FROTAR, y la yesca NO está en la lista', () => {
    // Los dos filtros son del catálogo y no de una tabla de este archivo: el
    // `rigidity` que los roles piden y el `toward` del `drive`.
    const RIG = rigidezQuePideFrotar()
    const TECHO = techoDeFrotar()

    const filas: string[] = [
      '─── QUÉ SE PUEDE ENCENDER FROTANDO ───',
      `  \`friccion\` pide rigidity ≥ ${RIG.toFixed(2)} en los DOS palos y su drive topa en ${TECHO.toFixed(0)} °C`,
      '',
      '  sustancia   │ rigidity │ ignición │ ¿frotable? │ costo/kg │ potencia/kg │ T que entrega (contacto)',
      '  ────────────┼──────────┼──────────┼────────────┼──────────┼─────────────┼─────────────────────────',
    ]

    const frotables: string[] = []
    for (const s of ARDEN) {
      const rig = deLaSustancia(s.id, 1, 'rigidity')
      const ign = deLaSustancia(s.id, 1, 'ignitionPoint')
      const puede = rig >= RIG && ign < TECHO
      if (puede) frotables.push(s.id)
      const costo = costoDeEncender(s.id, 1)
      const pot = deLaSustancia(s.id, 1, 'emitsPower', { temperature: ign + 50 })
      const t = temperaturaDeEquilibrio(pot, 0, 'contacto')
      filas.push(
        `  ${s.id.padEnd(11)} │ ${rig.toFixed(2).padStart(8)} │ ${ign.toFixed(0).padStart(8)} │ ` +
          `${(puede ? 'SÍ' : rig < RIG ? 'no: blanda' : 'no: alta').padStart(10)} │ ` +
          `${costo.toFixed(0).padStart(8)} │ ${pot.toFixed(1).padStart(11)} │ ${t.toFixed(0).padStart(24)}`,
      )
    }
    filas.push('')
    filas.push(`  se pueden frotar: ${frotables.join(' ')}`)
    // La comparación que decide el archivo: la yesca cuesta la mitad por kilo y no
    // se puede frotar.
    filas.push(
      `  la yesca (hoja-seca) cuesta ${costoDeEncender('hoja-seca', 1).toFixed(0)}/kg contra ` +
        `${costoDeEncender('madera', 1).toFixed(0)}/kg de la madera, y NO se puede frotar: ` +
        `rigidity ${deLaSustancia('hoja-seca', 1, 'rigidity').toFixed(2)} contra ${RIG.toFixed(2)}`,
    )
    log(filas)

    expect(frotables).toContain('madera')
    expect(frotables).not.toContain('hoja-seca')
  })

  it('2 · EL PRIMER ESCALÓN, prendido en el mundo y no despejado a mano', () => {
    // La pregunta: la vara de madera más chica que, encendida frotando, PRENDE una
    // yesca apoyada encima. Se corre `stepWorld` y se mira si la yesca empieza a
    // emitir; no se compara ninguna temperatura contra ningún umbral acá.
    const filas: string[] = [
      '─── QUÉ VARA FROTADA PRENDE LA YESCA ───',
      '',
      '  vara (kg) │ costo frotar │ ¿prende la yesca? │ en el tick │ potencia de la yesca',
      '  ──────────┼──────────────┼───────────────────┼────────────┼─────────────────────',
    ]

    let masBarata: { masa: number; costo: number } | undefined
    for (const masa of [0.15, 0.3, 0.4, 0.457, 0.5, 0.6, 0.7132]) {
      const r = prende(masa, 'hoja-seca', 0.3, 400)
      const costo = costoDeEncender('madera', masa)
      if (r.tick >= 0 && masBarata === undefined) masBarata = { masa, costo }
      filas.push(
        `  ${masa.toFixed(4).padStart(9)} │ ${costo.toFixed(1).padStart(12)} │ ` +
          `${(r.tick >= 0 ? 'SÍ' : 'no').padStart(17)} │ ${(r.tick >= 0 ? String(r.tick) : '—').padStart(10)} │ ` +
          `${r.potencia.toFixed(2).padStart(20)}`,
      )
    }
    filas.push('')
    filas.push(
      masBarata === undefined
        ? '  NINGUNA vara frotable prende la yesca: no hay primer escalón.'
        : `  el primer escalón cuesta ${masBarata.costo.toFixed(1)} (vara de ${masBarata.masa.toFixed(4)} kg)`,
    )
    log(filas)

    expect(masBarata).toBeDefined()
  })

  it('3 · LA ESCALERA ENTERA: de la vara frotada al leño que ella sola no podría encender', () => {
    // Tres cuerpos y un solo `frotar` pagado: la vara que se frota, la yesca que la
    // vara prende, y el leño que la yesca prende. Se barre la MASA DE LA YESCA,
    // porque es la que gobierna el segundo escalón: lo que un cuerpo encendido
    // entrega va con su masa y con nada más (ADR II-0011, medido en
    // `el-fuego-no-se-propaga.test.ts`).
    const filas: string[] = [
      '─── LA ESCALERA ───',
      `  frotar la vara de ${VARA.toFixed(2)} kg cuesta ${costoDeEncender('madera', VARA).toFixed(1)} y es lo ÚNICO que se paga`,
      '',
      '  yesca (kg) │ T que entrega │ leño 1 kg │ leño 2 kg │ leño 4 kg │ leño 8 kg',
      '  ───────────┼───────────────┼───────────┼───────────┼───────────┼──────────',
    ]

    let mayorPrendido = 0
    let yescaQueAlcanza = 0
    for (const yesca of YESCAS) {
      const celdas: string[] = []
      const entrega = temperaturaDeEquilibrio(
        deLaSustancia('hoja-seca', yesca, 'emitsPower', { temperature: 400 }),
        0,
        'contacto',
      )
      for (const leño of LEÑOS) {
        const r = escalera(VARA, yesca, leño)
        if (r.tick >= 0) {
          if (leño > mayorPrendido) mayorPrendido = leño
          if (yescaQueAlcanza === 0) yescaQueAlcanza = yesca
        }
        celdas.push((r.tick >= 0 ? `t=${String(r.tick)}` : 'no').padStart(9))
      }
      filas.push(
        `  ${yesca.toFixed(2).padStart(10)} │ ${entrega.toFixed(0).padStart(11)} °C │ ${celdas.join(' │ ')}`,
      )
    }
    filas.push('')
    filas.push(
      `  la madera prende a ${deLaSustancia('madera', 1, 'ignitionPoint').toFixed(0)} °C`,
      mayorPrendido > 0
        ? `  con ${yescaQueAlcanza.toFixed(2)} kg de yesca la escalera llega al leño, y el más grande que prende pesa ` +
          `${mayorPrendido.toFixed(2)} kg — que frotado habría costado ${costoDeEncender('madera', mayorPrendido).toFixed(1)} ` +
          `contra los ${costoDeEncender('madera', VARA).toFixed(1)} que se pagaron`
        : '  y NO prende ningún leño a ninguna masa de yesca: la escalera se corta en la yesca',
    )
    log(filas)

    // LA ESCALERA EXISTE, y va clavada para que moverla se note: con 1 kg de yesca
    // —y no con 0,85— el fuego trepa hasta un leño de 8 kg que frotarlo habría
    // costado dieciséis veces lo que se pagó.
    expect(yescaQueAlcanza).toBe(1)
    expect(mayorPrendido).toBe(8)
  })

  it('4 · LA CUENTA, CON UN SOLO `frotar` PAGADO', () => {
    // La misma cuenta del bloque 4 de `el-primer-fuego-no-se-paga`, con la única
    // diferencia que este archivo existe para medir: el numerador es FIJO. Se paga
    // una vara de 0,5 kg y se cuentan las piezas que cocina todo lo que esa vara
    // llegó a encender.
    //
    // Y SE BARRE LA DISTANCIA, que la primera versión de este bloque no barría y
    // por eso contaba CERO piezas justo en las filas donde la escalera funcionaba:
    // un leño de 8 kg entrega 1217 °C sobre la parrilla y **quema** el pescado en
    // vez de cocinarlo. Un fuego grande no se acerca, se aleja: `formFactor`
    // divide por `(1 + d²)`. Elegir dónde poner la comida es del planificador y
    // acá se mide el techo de lo que el mundo permite.
    const costo = costoDeEncender('madera', VARA)

    const filas: string[] = [
      '─── COSTO FIJO, DEVOLUCIÓN QUE CRECE ───',
      `  un solo frotar pagado: vara de ${VARA.toFixed(2)} kg = ${costo.toFixed(1)} de stamina`,
      `  la yesca va en ${YESCA_QUE_ALCANZA.toFixed(2)} kg, que es la más chica que prende el leño (bloque 3)`,
      '',
      '  leño │ arde (s) │ mejor distancia │ piezas │ devuelve │ costo/devuelve │ neto',
      '  ─────┼──────────┼─────────────────┼────────┼──────────┼────────────────┼──────',
    ]

    let mejorNeto = Number.NEGATIVE_INFINITY
    let mejorFila = ''
    for (const leño of LEÑOS) {
      let piezas = 0
      let arde = 0
      let dondeMejor = ''
      for (const donde of DONDE_VA_LA_COMIDA) {
        const r = cocinaLaEscalera(VARA, YESCA_QUE_ALCANZA, leño, donde)
        arde = Math.max(arde, r.ticksArdiendo)
        if (r.piezas > piezas) {
          piezas = r.piezas
          dondeMejor = donde.como
        }
      }
      const devuelve = piezas * LO_QUE_PAGA_UNA_PIEZA
      const razon = devuelve > 0 ? costo / devuelve : Number.POSITIVE_INFINITY
      const neto = devuelve - costo
      if (neto > mejorNeto) {
        mejorNeto = neto
        mejorFila = `leño ${leño.toFixed(2)} kg, comida ${dondeMejor}`
      }
      filas.push(
        `  ${leño.toFixed(2).padStart(4)} │ ${(arde * SEGUNDOS_POR_TICK).toFixed(1).padStart(8)} │ ` +
          `${(piezas > 0 ? dondeMejor : '—').padStart(15)} │ ${String(piezas).padStart(6)} │ ` +
          `${devuelve.toFixed(1).padStart(8)} │ ` +
          `${(razon === Number.POSITIVE_INFINITY ? '∞' : razon.toFixed(2)).padStart(14)} │ ${neto.toFixed(1).padStart(6)}`,
      )
    }
    filas.push('')
    filas.push(
      mejorNeto > 0
        ? `  LA CUENTA CIERRA SIN TOCAR NINGUNA CONSTANTE: +${mejorNeto.toFixed(1)} de stamina con ${mejorFila}.`
        : `  LA CUENTA NO CIERRA NI ASÍ: el mejor neto es ${mejorNeto.toFixed(1)} (${mejorFila}).`,
      '  Y es un PISO y no un techo: se cocina UNA pieza por vez, mientras que el mismo',
      '  fuego cocina todas las que se le apoyen al lado a la vez.',
    )
    log(filas)

    // EL RESULTADO DEL ARCHIVO, afirmado y no sólo impreso: con un solo `frotar`
    // pagado la cuenta del fuego se da vuelta, sin tocar `eficiencia` ni
    // `STAMINA_POR_CALORIA`. Si esto se pusiera rojo, la decisión de arriba vuelve
    // a ser entre las dos palancas de calibración.
    expect(mejorNeto).toBeGreaterThan(0)
  })

  it('5 · ¿Y EL DIOS PONE ESA YESCA Y ESE LEÑO? — la escalera contra el mundo decretado', () => {
    // La trampa que este proyecto ya pagó tres veces, y que acá viene al revés:
    // los cuatro bloques de arriba miden LA FÍSICA con cuerpos armados a mano. Que
    // la escalera exista en la física no dice nada si el dios no siembra la
    // materia que pide. Se barre el decreto de las mismas veinte semillas del
    // banco de la emergencia, alrededor del mismo arranque.
    //
    // La masa NO tiene que venir en una sola pieza: `union` (ley 7) hace un cuerpo
    // de dos, y la masa de un cuerpo es la suma de sus partes. Por eso se cuenta
    // el TOTAL por sustancia además de la pieza más grande — y por eso queda
    // abierta la pregunta de si hay atador, que es de otro archivo.
    const filas: string[] = [
      '─── LO QUE EL DIOS SIEMBRA, CONTRA LO QUE LA ESCALERA PIDE ───',
      `  la escalera pide: vara frotable de ${VARA.toFixed(2)} kg · yesca de ${YESCA_QUE_ALCANZA.toFixed(2)} kg · leño de 8 kg`,
      '',
      '  semilla   │ yesca: piezas / kg / mayor │ madera: piezas / kg / mayor │ ¿alcanza?',
      '  ──────────┼────────────────────────────┼─────────────────────────────┼──────────',
    ]

    let alcanzan = 0
    for (let k = 0; k < 20; k += 1) {
      const semilla = SEMILLA_BASE + BigInt(k)
      // Una `Physics` nueva por semilla: `decretoDe` memoiza por `(Physics, chunk)`
      // y la semilla NO entra en la llave (número 3 de la sección 5 del método).
      const phys = buildSeedPhysics()
      const dios = crearDios(semilla)
      const y = { piezas: 0, kg: 0, mayor: 0 }
      const m = { piezas: 0, kg: 0, mayor: 0 }
      for (let cx = -1; cx <= 1; cx += 1) {
        for (let cy = -1; cy <= 1; cy += 1) {
          for (const s of decretoDe(dios, phys, cx, cy).chunk.sueltas) {
            const masa = s.masa / 1000
            const donde = s.substance === 'hoja-seca' ? y : s.substance === 'madera' ? m : undefined
            if (donde === undefined) continue
            donde.piezas += 1
            donde.kg += masa
            if (masa > donde.mayor) donde.mayor = masa
          }
        }
      }
      const alcanza = y.kg >= YESCA_QUE_ALCANZA && m.kg >= 8 + VARA && m.mayor >= VARA
      if (alcanza) alcanzan += 1
      filas.push(
        `  ${String(semilla).padStart(9)} │ ${String(y.piezas).padStart(6)} / ${y.kg.toFixed(2).padStart(6)} / ${y.mayor.toFixed(3).padStart(6)} │ ` +
          `${String(m.piezas).padStart(6)} / ${m.kg.toFixed(2).padStart(7)} / ${m.mayor.toFixed(3).padStart(6)} │ ` +
          `${alcanza ? 'SÍ' : 'no'}`,
      )
    }
    filas.push('')
    filas.push(
      `  semillas donde la materia de la escalera está a la vista, en 9 chunks: ${String(alcanzan)} de 20`,
      '  («a la vista» es la suma de las piezas sueltas: juntarlas pide `union`, y si hay',
      '  atador cerca no lo contesta este archivo.)',
    )
    log(filas)

    // Clavado, igual que en `lo-que-el-mundo-si-siembra.test.ts`: no es un umbral
    // que alguien eligió, es lo que el dios decreta hoy. Y es la mitad que falta
    // del hallazgo: la puerta existe en la física y el mundo la abre en 6 de 20
    // paradas, con la yesca en piezas de 77 gramos.
    expect(alcanzan).toBe(6)
  })
})

// ─── El armado de las escenas ────────────────────────────────────────────────

/**
 * Una vara encendida con `masa` kg y una pieza de `sub` apoyada ENCIMA (contacto).
 * Devuelve el tick en el que la pieza de arriba empezó a emitir, o −1.
 *
 * La vara nace a la temperatura que `frotar` establece —el `toward` del drive— y
 * no a 700: acá interesa lo que la criatura puede pagar, no lo que se le regala.
 */
function prende(masa: number, sub: string, masaArriba: number, tArranque: number): { tick: number; potencia: number } {
  const fuente = cuerpo('fuente', 'madera', masa, { temperature: tArranque })
  const arriba: WorldBody = {
    ...enElPiso(cuerpo('arriba', sub, masaArriba, { temperature: 15 }), EN(0, 0)),
    supportedBy: 'fuente',
  }
  let w = mundo({ bodies: [enElPiso(fuente, EN(0, 0)), arriba] })
  let potencia = 0
  for (let i = 1; i <= 4000; i += 1) {
    w = stepWorld(w, []).state
    const c = w.bodies.get('arriba')
    if (c === undefined) return { tick: i, potencia: Number.POSITIVE_INFINITY }
    const p = qualityOf(c.body, 'emitsPower', w.phys)
    if (p > 0) return { tick: i, potencia: p }
    potencia = p
  }
  return { tick: -1, potencia }
}

/** El mundo de la escalera: vara frotada → yesca → leño. */
function mundoDeLaEscalera(vara: number, yesca: number, leño: number): WorldState {
  return mundo({
    bodies: [
      enElPiso(cuerpo('vara', 'madera', vara, { temperature: 400 }), EN(0, 0)),
      { ...enElPiso(cuerpo('yesca', 'hoja-seca', yesca, { temperature: 15 }), EN(0, 0)), supportedBy: 'vara' },
      { ...enElPiso(cuerpo('leño', 'madera', leño, { temperature: 15 }), EN(0, 0)), supportedBy: 'yesca' },
    ],
  })
}

function escalera(vara: number, yesca: number, leño: number): { tick: number; potencia: number } {
  let w = mundoDeLaEscalera(vara, yesca, leño)
  for (let i = 1; i <= 8000; i += 1) {
    w = stepWorld(w, []).state
    const c = w.bodies.get('leño')
    if (c === undefined) return { tick: i, potencia: Number.POSITIVE_INFINITY }
    const p = qualityOf(c.body, 'emitsPower', w.phys)
    if (p > 0) return { tick: i, potencia: p }
  }
  return { tick: -1, potencia: 0 }
}

/**
 * La escalera con una parrilla al lado: una piedra en la misma celda y un pescado
 * apoyado en la piedra. Cada vez que el pescado cruza `digestibility >= 0.85` se
 * lo cuenta y se pone uno crudo nuevo, que es lo que haría una criatura que pesca
 * mientras el fuego arde. Se corre hasta que no queda nada emitiendo.
 */
function cocinaLaEscalera(
  vara: number,
  yesca: number,
  leño: number,
  donde: { dist: number; sobrePiedra: boolean },
): { piezas: number; ticksArdiendo: number } {
  const base = mundoDeLaEscalera(vara, yesca, leño)
  let w: WorldState = mundo({
    bodies: [
      ...[...base.bodies.values()],
      enElPiso(cuerpo('piedra', 'piedra', 1), EN(donde.dist, 0)),
      pezEn(0, donde),
    ],
  })
  let piezas = 0
  let ticksArdiendo = 0
  let cual = 0
  for (let i = 1; i <= 20_000; i += 1) {
    w = stepWorld(w, []).state
    let ardiendo = false
    for (const c of w.bodies.values()) {
      if (c.body.id.startsWith('pez')) continue
      if (qualityOf(c.body, 'emitsPower', w.phys) > 0) ardiendo = true
    }
    if (ardiendo) ticksArdiendo = i
    const pez = w.bodies.get(`pez-${String(cual)}`)
    if (pez === undefined) {
      // Se quemó: se repone crudo igual, porque lo que se está midiendo es cuánto
      // cocina el fuego y no si la criatura llega a tiempo a sacarlo.
      cual += 1
      w = reponer(w, cual, donde)
      continue
    }
    if (qualityOf(pez.body, 'digestibility', w.phys) >= 0.85) {
      piezas += 1
      cual += 1
      w = quitar(w, `pez-${String(cual - 1)}`)
      w = reponer(w, cual, donde)
    }
    if (!ardiendo && i > 40) break
  }
  return { piezas, ticksArdiendo }
}

function quitar(w: WorldState, id: string): WorldState {
  const bodies = [...w.bodies.values()].filter((c) => c.body.id !== id)
  return mundo({ bodies, tick: w.tick, nextId: w.nextId })
}

function reponer(w: WorldState, cual: number, donde: { dist: number; sobrePiedra: boolean }): WorldState {
  const bodies: WorldBody[] = [...[...w.bodies.values()], pezEn(cual, donde)]
  return mundo({ bodies, tick: w.tick, nextId: w.nextId })
}

/** Un pescado crudo puesto donde la criatura elegiría ponerlo. */
function pezEn(cual: number, donde: { dist: number; sobrePiedra: boolean }): WorldBody {
  const b = enElPiso(cuerpo(`pez-${String(cual)}`, 'pescado', 2.887, { temperature: 15 }), EN(donde.dist, 0))
  return donde.sobrePiedra ? { ...b, supportedBy: 'piedra' } : b
}
