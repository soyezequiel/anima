// ─── EL CRITERIO DEL ADR II-0008 ─────────────────────────────────────────────
//
// El ADR II-0007 declaró que son DOS PERILLAS Y NO UNA —la frecuencia gobierna el
// rendimiento, las tasas gobiernan el ritmo— y después midió que bajar de 30 a
// 20 Hz hacía que cocinar el cuero pasara de 40 a 60 segundos. O sea que la
// separación estaba ESCRITA pero no CONSTRUIDA.
//
// Este archivo es la diferencia. Mide, a cada frecuencia admisible, cuántos
// SEGUNDOS DE MUNDO tarda cada cosa. Si el ADR está construido, la columna de
// segundos no se mueve; si alguien vuelve a atar una tasa al tick, se mueve acá y
// no en el juego seis meses después.
//
// ─── Lo que este test NO promete ────────────────────────────────────────────
//
// Que las trayectorias sean IDÉNTICAS entre frecuencias. No lo son y no pueden
// serlo: las doce leyes no son lineales, así que muestrear más fino da otra
// curva. Lo que se promete es que el ritmo converge —el error de integración se
// mide acá abajo, no se estima— y que el mismo hecho ocurre en el mismo segundo
// dentro de esa cota. La huella de conducta cuida lo otro: que A LA FRECUENCIA DE
// REFERENCIA no se haya movido ni un bit.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics } from '../src/physics.js'
import type { Physics } from '../src/physics.js'
import { qualityOf } from '../src/body.js'
import type { Body } from '../src/body.js'
import { CELDA_AL_AIRE, conSustancia, correr, paso } from '../src/leyes.js'
import type { Entorno } from '../src/leyes.js'
import {
  dtDeFrecuencia,
  esFrecuenciaAdmisible,
  FRECUENCIAS_ADMISIBLES,
  HZ_DE_REFERENCIA,
  MICROS_POR_SEGUNDO,
  porPaso,
  seg,
  sumarPaso,
} from '../src/fixed.js'
import { DESHILACHAR, EXTRACCION, FRICCION, UNION } from '../src/process.js'

const phys = buildSeedPhysics()

function cosa(substance: string, mass: number, state: Record<string, number> = {}): Body {
  return { id: 'x', form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state }
}

const enLaParrilla: Entorno = {
  celda: CELDA_AL_AIRE,
  fuente: { potencia: 300, distancia: 1, montaje: 'parrilla' },
}
const enElFuego: Entorno = {
  celda: CELDA_AL_AIRE,
  fuente: { potencia: 900, distancia: 0, montaje: 'contacto' },
}
/** La técnica del ADR II-0002: tapado (poco aire) y sobre las brasas. */
const tapadoYAlFuego: Entorno = {
  celda: { oxygen: 0.2, wet: 0, ambiente: 15 },
  fuente: { potencia: 900, distancia: 0, montaje: 'contacto' },
}

/**
 * Cuántos SEGUNDOS DE MUNDO pasan hasta que se cumple `pred`, muestreando a `hz`.
 * `NaN` si no pasa dentro del techo.
 */
function segundosHasta(
  hz: number,
  inicial: Body,
  e: Entorno,
  pred: (b: Body, p: Physics) => boolean,
  techo = 200,
): number {
  const dt = dtDeFrecuencia(hz)
  let b = inicial
  // La sustancia que la ley 4 da de alta se AGREGA a la física antes de volver a
  // preguntar. Sin esto, un cuerpo que transmutó queda hecho de una sustancia que
  // `qualityOf` no encuentra, y todas sus cualidades vuelven al valor por omisión:
  // el caso de la madera tapada medía `charred` volviendo a cero y subiendo de
  // nuevo desde una materia desconocida, o sea el doble de tiempo del real.
  let p = phys
  const pasos = Math.round(techo / dt)
  for (let n = 1; n <= pasos; n++) {
    const r = paso(b, e, p, dt)
    b = r.body
    if (r.nueva !== undefined) p = conSustancia(p, r.nueva)
    if (pred(b, p)) return n * dt
  }
  return Number.NaN
}

const cocido = (meta: number) => (b: Body, p: Physics) => qualityOf(b, 'digestibility', p) >= meta

interface Caso {
  nombre: string
  cuerpo: () => Body
  entorno: Entorno
  pred: (b: Body, p: Physics) => boolean
}

const CASOS: readonly Caso[] = [
  {
    nombre: 'la madera llega a 375 °C en el fuego',
    cuerpo: () => cosa('madera', 20, { temperature: 15 }),
    entorno: enElFuego,
    pred: (b, p) => qualityOf(b, 'temperature', p) >= 375,
  },
  {
    nombre: 'el pescado se cocina en la parrilla',
    cuerpo: () => cosa('pescado', 0.8, { temperature: 15, moisture: 0.5 }),
    entorno: enLaParrilla,
    pred: cocido(0.86),
  },
  {
    nombre: 'la carne se cocina en la parrilla',
    cuerpo: () => cosa('carne', 1, { temperature: 15 }),
    entorno: enLaParrilla,
    pred: cocido(0.86),
  },
  {
    nombre: 'el cuero se cocina (el más lento de los tres)',
    cuerpo: () => cosa('cuero', 1, { temperature: 15 }),
    entorno: enLaParrilla,
    pred: cocido(0.86),
  },
  {
    nombre: 'la madera tapada se carboniza del todo',
    cuerpo: () => cosa('madera', 4, { temperature: 400 }),
    entorno: tapadoYAlFuego,
    pred: (b, p) => qualityOf(b, 'charred', p) >= 0.8,
  },
]

describe('el ritmo del mundo no depende de la frecuencia', () => {
  it('las cinco cosas tardan los mismos segundos a 10, 20, 25, 50 y 100 Hz', () => {
    // LA COTA: 3%, y el peor desvío MEDIDO sobre las cinco frecuencias es 1,43%
    // (el cuero cocido tarda 41,00 s a 10 Hz y 41,19 s a 100). No es cero y no
    // puede serlo — las leyes no son lineales, y a 10 Hz cada paso aplica diez
    // veces el cambio que aplica a 100. Es el error de INTEGRACIÓN, y lo que este
    // test promete es que está acotado y medido, no que no exista. El ADR II-0008
    // lo pedía con estas palabras: «hay que medir cuánto se separan las
    // trayectorias entre frecuencias admisibles y decidir un rango soportado, en
    // vez de prometer que cualquiera anda». El rango soportado son las cinco.
    //
    // EL BORDE DE ABAJO YA NO ES LA SATURACIÓN (ADR II-0011). Este comentario
    // decía que el acople de la ley 1 estaba «topado en 1 por estabilidad» y que
    // por eso un cuerpo liviano a 10 Hz saltaba al equilibrio en un paso. Ese tope
    // era el síntoma del Euler explícito y ya no existe: la ley 1 se integra en
    // forma cerrada y `1 − e^(−r·dt)` nunca llega a 1. El caso térmico sigue con
    // masa 20 porque mide otra cosa —el ritmo de un cuerpo grande— y no porque la
    // integración se rompa con masa 1.
    //
    // ─── LA COTA TIENE DOS SUMANDOS, Y EL SEGUNDO NO ES OPCIONAL ─────────────
    //
    // «Cuándo ocurrió algo» no se puede observar mejor que UN TICK, y a 10 Hz un
    // tick son 0,1 s. Con un hecho que pasa a los 1,25 s, la resolución sola vale
    // el 8% — más que la tolerancia entera. Sin este sumando el test no está
    // midiendo la deriva de la integración: está midiendo dónde cae la grilla de
    // muestreo, y se cae o pasa según de qué lado del tick quede el instante.
    // Medido: `la madera llega a 375 °C en el fuego` da 1,30 s a 10 Hz y 1,25 a
    // 20, que es exactamente medio tick de 10 Hz.
    const TOLERANCIA = 0.03
    const filas: string[] = []
    let peor = 0
    for (const c of CASOS) {
      const medidos = FRECUENCIAS_ADMISIBLES.map((hz) =>
        segundosHasta(hz, c.cuerpo(), c.entorno, c.pred),
      )
      for (const s of medidos) {
        expect([c.nombre, Number.isNaN(s)], `${c.nombre} no ocurrió`).toEqual([c.nombre, false])
      }
      const referencia = medidos[FRECUENCIAS_ADMISIBLES.indexOf(HZ_DE_REFERENCIA)] as number
      for (let i = 0; i < medidos.length; i++) {
        const desvio = Math.abs((medidos[i] as number) - referencia) / referencia
        if (desvio > peor) peor = desvio
        // Un tick de la frecuencia que se compara más uno de la de referencia: son
        // las dos grillas de muestreo, y el instante de verdad está adentro de las
        // dos. Es resolución de observación, no deriva.
        const resolucion = (1 / (FRECUENCIAS_ADMISIBLES[i] as number) + 1 / HZ_DE_REFERENCIA) / referencia
        expect(
          [c.nombre, FRECUENCIAS_ADMISIBLES[i], desvio <= TOLERANCIA + resolucion],
          `${c.nombre} a ${String(FRECUENCIAS_ADMISIBLES[i])} Hz tarda ${String(medidos[i])} s contra ${String(referencia)} s a ${String(HZ_DE_REFERENCIA)} Hz`,
        ).toEqual([c.nombre, FRECUENCIAS_ADMISIBLES[i], true])
      }
      filas.push(
        `  ${c.nombre.padEnd(46)}${medidos.map((s) => `${s.toFixed(2)}s`.padStart(9)).join('')}`,
      )
    }
    console.log(
      [
        '',
        `══ EL RITMO, EN SEGUNDOS DE MUNDO ══  peor desvío contra ${String(HZ_DE_REFERENCIA)} Hz: ${(peor * 100).toFixed(2)}%`,
        `  ${'caso'.padEnd(46)}${FRECUENCIAS_ADMISIBLES.map((h) => `${String(h)} Hz`.padStart(9)).join('')}`,
        ...filas,
        '',
      ].join('\n'),
    )
  }, 300_000)

  it('y en PASOS —que es lo que antes fijaba el ritmo— sí cambia, y tiene que cambiar', () => {
    // El control negativo. Si esto no cambiara, el test de arriba no probaría
    // nada: estaría midiendo un mundo que no se mueve.
    const c = CASOS[3] as Caso
    const a10 = segundosHasta(10, c.cuerpo(), c.entorno, c.pred) * 10
    const a100 = segundosHasta(100, c.cuerpo(), c.entorno, c.pred) * 100
    expect(a100 / a10).toBeGreaterThan(9)
  }, 300_000)

  it('la trayectoria SÍ cambia con la frecuencia, y eso es lo correcto', () => {
    // Dos muestreos distintos del mismo mundo no dan la misma traza. Que el ritmo
    // coincida y la traza no es exactamente la separación que el ADR II-0007
    // pedía y el II-0008 construye.
    const b = cosa('carne', 1, { temperature: 15 })
    const a20 = correr(b, enLaParrilla, phys, dtDeFrecuencia(20), 10).body
    const a25 = correr(b, enLaParrilla, phys, dtDeFrecuencia(25), 10).body
    expect(qualityOf(a20, 'digestibility', phys)).not.toBe(
      qualityOf(a25, 'digestibility', phys),
    )
    // Pero cerca: el desvío es de integración, no de calibración.
    expect(qualityOf(a25, 'digestibility', phys)).toBeCloseTo(
      qualityOf(a20, 'digestibility', phys),
      2,
    )
  })
})

describe('la frecuencia no es libre: `dt` tiene que ser exacto', () => {
  it('admisibles son exactamente las que dividen 10⁶', () => {
    for (const hz of FRECUENCIAS_ADMISIBLES) expect([hz, esFrecuenciaAdmisible(hz)]).toEqual([hz, true])
    // Los 30 Hz que el documento de arquitectura declaraba «fijos» NO dan un `dt`
    // exacto. Ésa es la frecuencia que la auditoría marcó como decretada sin
    // argumento, y habría roto el determinismo el día que el tiempo se hiciera
    // explícito — que es hoy.
    for (const hz of [15, 24, 30, 60, 0, -20, 20.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect([hz, esFrecuenciaAdmisible(hz)]).toEqual([hz, false])
    }
  })

  it('una frecuencia inadmisible se RECHAZA, no se redondea en silencio', () => {
    // Redondear sería lo cómodo y lo fatal: el `dt` se multiplica en cada
    // aplicación de cada ley, así que el error no se ve como un número raro sino
    // como dos motores que divergen en el tick 400 sin causa visible.
    expect(() => dtDeFrecuencia(30)).toThrow(/30 Hz/)
    expect(() => dtDeFrecuencia(30)).toThrow(/exacto/)
    expect(() => dtDeFrecuencia(0)).toThrow()
  })

  it('el `dt` de cada admisible es exacto en la escala de las tasas', () => {
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const micros = dtDeFrecuencia(hz) * MICROS_POR_SEGUNDO
      expect([hz, micros]).toEqual([hz, Math.round(micros)])
    }
  })
})

describe('`porPaso` divide por la frecuencia y no multiplica por `dt`', () => {
  it('y la diferencia se mide: `0.2 × 0.05` no da `0.01` y `0.2 ÷ 20` sí', () => {
    // Es la razón entera de que `porPaso` no sea `tasa * dt`. `dt` es `1/Hz`
    // REDONDEADO —0,05 no es representable en binario— y ese redondeo se le pega
    // a toda tasa que toque; la frecuencia, en cambio, es un entero exacto.
    const dt = dtDeFrecuencia(HZ_DE_REFERENCIA)
    expect(0.2 * dt).not.toBe(0.01)
    expect(porPaso(0.2, dt)).toBe(0.01)
  })

  it('las diez tasas de las leyes vuelven EXACTAS a la calibración del barrido', () => {
    // Las que el barrido térmico del Hito 0 midió por tick, una por una. Si
    // alguna se corriera un ulp, la huella de conducta se movería y una migración
    // que no cambió nada quedaría indistinguible de una que sí.
    const dt = dtDeFrecuencia(HZ_DE_REFERENCIA)
    const pares: readonly (readonly [number, number])[] = [
      [0.2, 0.01], // cocción
      [0.6, 0.03], // destoxifica
      [0.16, 0.008], // despudre
      [0.011999999999999999, 0.0006], // evaporación
      [0.2, 0.01], // carbonización
      [1, 0.05], // combustión
      [0.008, 0.0004], // descomposición
      [0.0004, 0.00002], // secado por grado
      [0.2, 0.01], // mojado
      [10, 0.5], // acoplamiento térmico
    ]
    for (const [porSegundo, porTick] of pares) {
      expect([porSegundo, porPaso(porSegundo, dt)]).toEqual([porSegundo, porTick])
    }
  })
})

describe('el tiempo transcurrido se acumula sin deriva', () => {
  it('veinte pasos de 0,05 dan UN segundo exacto, y la suma ingenua no', () => {
    // El caso más común de todos: `union` completa en un segundo. Con la suma
    // ingenua, veinte veces 0,05 da 0,9999999999999999 y atar tardaría veintiún
    // ticks — siempre, y sin que ningún test dijera por qué.
    const dt = dtDeFrecuencia(20)
    let ingenua = 0
    let honesta = seg(0)
    for (let i = 0; i < 20; i++) {
      ingenua += dt
      honesta = sumarPaso(honesta, dt)
    }
    expect(ingenua).not.toBe(1)
    expect(honesta).toBe(1)
    expect(honesta >= (UNION.completion?.at ?? 0)).toBe(true)
  })

  it('y en las cinco frecuencias admisibles, las tres duraciones semilla caen justas', () => {
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const dt = dtDeFrecuencia(hz)
      for (const at of [UNION.completion!.at, DESHILACHAR.completion!.at, EXTRACCION.completion!.at]) {
        const pasos = Math.round(at / dt)
        let t = seg(0)
        for (let i = 0; i < pasos; i++) t = sumarPaso(t, dt)
        expect([hz, at, t >= at]).toEqual([hz, at, true])
        // Y ni un paso antes: el proceso no se completa con `pasos - 1`.
        let antes = seg(0)
        for (let i = 0; i < pasos - 1; i++) antes = sumarPaso(antes, dt)
        expect([hz, at, antes >= at]).toEqual([hz, at, false])
      }
    }
  })
})

describe('los cuatro procesos semilla, en segundos', () => {
  it('las tasas y las duraciones dicen segundos y no ticks', () => {
    const drive = FRICCION.effects[0]
    if (drive?.k !== 'drive') throw new Error('friccion tiene que traer un drive')
    // 120 °C por segundo. A la frecuencia de referencia son los 6 por tick del
    // documento; a 10 Hz son 12 por tick, y la madera tarda los mismos 3 segundos
    // en llegar a 375.
    expect(drive.porSegundo).toBe(120)
    expect(UNION.completion?.at).toBe(1)
    expect(DESHILACHAR.completion?.at).toBe(2)
    expect(DESHILACHAR.effects[0]?.k === 'drain' && DESHILACHAR.effects[0].porSegundo).toBe(2)
    // Segundo y medio, que en ticks no se podía escribir: `completion.at` pedía un
    // entero, y medio tick no existía.
    expect(EXTRACCION.completion?.at).toBe(1.5)
  })

  it('a cualquier frecuencia admisible cuestan los mismos segundos de reloj', () => {
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      const dt = dtDeFrecuencia(hz)
      // `friccion` no declara `completion`: lo que se mide es cuánto empuja por
      // segundo, y eso es la tasa por paso multiplicada por los pasos del segundo.
      const drive = FRICCION.effects[0]
      if (drive?.k !== 'drive') throw new Error('imposible')
      const porSegundoReal = porPaso(drive.porSegundo, dt) * hz
      expect([hz, porSegundoReal]).toEqual([hz, 120])
    }
  })
})
