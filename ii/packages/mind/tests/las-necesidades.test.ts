// ─── QUÉ LE DUELE, Y QUÉ LA CALMA ───────────────────────────────────────────
//
// `necesidades` y `satisfaccion` son las dos mitades del primer peldaño de la
// mente: sin ellas D2 no tiene con qué comparar dos oportunidades y la escalera
// entera queda decorativa. Este archivo las ataca por los cuatro lados por los
// que se pueden romper sin que nadie se entere.
//
// ─── LOS CRITERIOS, ESCRITOS ANTES DE MEDIR ─────────────────────────────────
//
//   C1 · LA CURVA DE `energia` EN LOS EXTREMOS Y EN EL CODO. Cero con el tanque
//        lleno, uno con el vacío, y **el incremento tiene que crecer hacia el
//        cero**: una criatura con 50 de stamina está por morirse y una con 950
//        no. El test no afirma la fórmula: afirma los extremos, la monotonía y la
//        razón medida entre el incremento de abajo y el de arriba, así que
//        cualquier otra curva que cumpla lo mismo lo pasa.
//
//   C2 · `refugio` ESCALA CON `dayLength`. Es la prueba T2.1 de
//        `ii/docs/escalera-capacidades.md`, y su control es lo que este archivo
//        tiene de más valioso: *«si al duplicar el día sigue arrancando en el
//        mismo tick absoluto, el largo del día está cableado adentro»*. Se mide
//        el segundo del disparo con `dayLength` 200 y con 400 y se exige la razón
//        2 — y se afirma además que los dos números DIFIEREN, que es la forma
//        negativa del mismo hecho y la única que atrapa el cableo.
//
//   C3 · `satisfaccion` SALE DE PROPIEDADES, NO DE UNA TABLA. Dos sustancias
//        INVENTADAS ACÁ, que nadie previó, tienen que rendir lo que les
//        corresponde por sus números el mismo tick en que existen. Y un guardián
//        lee el fuente con los comentarios sacados y exige que no aparezca ni un
//        nombre de sustancia, ni un nombre de tag, ni un número mayor que 2.
//
//   C4 · UN CASO NEGATIVO POR CADA POSITIVO. Cada `it` que afirma que algo pasa
//        afirma también qué NO pasa, en el mismo bloque. Un test que sólo mira
//        los verdes no distingue una función de la constante que devuelve lo que
//        ese test espera.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Physics, QualityId, Substance } from '@anima/physics'
import { buildSeedPhysics, specOf, SUSTANCIAS_SEMILLA, T_AMBIENTE, TAGS } from '@anima/physics'
import type { Cell, CellQuality, Clock, SelfView } from '@anima/skills'

import { necesidades, promesaDeTag, satisfaccion } from '../src/necesidades.js'
import type { NeedVector, VistaDeLaMente } from '../src/tipos.js'

// ─── El arnés: una vista de mentira que contesta lo que se le pone ──────────
//
// `VistaDeLaMente` es `VistaDelPlan`, que es un subconjunto ESTRUCTURAL del `Ctx`
// de producción: un objeto literal lo cumple sin adaptador. Es el mismo arnés que
// `plan/tests/la-regresion.test.ts`, recortado a lo que estas dos funciones leen.

const TANQUE = specOf('stamina').range[1]
const PISO_TERMICO = specOf('temperature').range[0]

const AQUI: Cell = { x: 0, y: 0 }

function vista(m: {
  stamina?: number
  cuerpo?: number
  celda?: number
  techo?: number
  clock?: Clock
}): VistaDeLaMente {
  const self: SelfView = {
    id: 'yo',
    at: AQUI,
    name: 'criatura',
    madeByMe: false,
    joints: [],
    holding: [],
    capacity: 3,
    stamina: m.stamina ?? TANQUE,
    permits: 'reversible',
  }
  return {
    see: () => [],
    recall: () => [],
    q: (_b, q: QualityId) => (q === 'temperature' ? (m.cuerpo ?? T_AMBIENTE) : 0),
    qAt: (_at: Cell, q: CellQuality) =>
      q === 'temperature' ? (m.celda ?? T_AMBIENTE) : q === 'sheltered' ? (m.techo ?? 0) : 0,
    self,
    clock: m.clock ?? { phase: 'dia', secondsToNightfall: 100, dayLength: 200 },
  }
}

/** Atajos, porque los tres se piden de a uno todo el tiempo. */
const energiaCon = (stamina: number): number => necesidades(vista({ stamina })).energia
const calorCon = (cuerpo: number, celda: number): number => necesidades(vista({ cuerpo, celda })).calor
const refugioCon = (dayLength: number, secondsToNightfall: number, techo = 0): number =>
  necesidades(
    vista({
      techo,
      clock: {
        phase: secondsToNightfall > 0 ? 'dia' : 'noche',
        secondsToNightfall,
        dayLength,
      },
    }),
  ).refugio

const HAMBRE: NeedVector = { energia: 1, calor: 0, refugio: 0 }
const FRIO: NeedVector = { energia: 0, calor: 1, refugio: 0 }
const NOCHE: NeedVector = { energia: 0, calor: 0, refugio: 1 }
const NADA_DUELE: NeedVector = { energia: 0, calor: 0, refugio: 0 }

// ─── C1 · La curva de `energia` ─────────────────────────────────────────────

describe('C1 · la energía sale de la stamina, y acelera hacia el cero', () => {
  it('los dos extremos son exactos, y NINGÚN valor de adentro los toca', () => {
    // Positivo: los extremos que el enunciado fija.
    expect(energiaCon(TANQUE)).toBe(0)
    expect(energiaCon(0)).toBe(1)

    // Negativo: que dé 0 y 1 en las puntas no puede ser porque dé 0 y 1 en todos
    // lados. Se barre el tanque entero de a 1 y se exige el abierto (0, 1) y
    // monotonía estricta: con menos stamina nunca puede doler menos.
    let anterior = 1
    for (let s = 1; s < TANQUE; s++) {
      const e = energiaCon(s)
      expect(e).toBeGreaterThan(0)
      expect(e).toBeLessThan(1)
      expect(e).toBeLessThan(anterior)
      anterior = e
    }
    expect(anterior).toBeGreaterThan(0)
  })

  it('EL CODO: los últimos 50 de stamina valen 39 veces los primeros 50', () => {
    // Positivo: la razón medida entre el incremento de abajo y el de arriba.
    const abajo = energiaCon(0) - energiaCon(50)
    const arriba = energiaCon(TANQUE - 50) - energiaCon(TANQUE)
    expect(abajo).toBeCloseTo(0.0975, 10)
    expect(arriba).toBeCloseTo(0.0025, 10)
    expect(abajo / arriba).toBeCloseTo(39, 6)

    // Y no es una razón de dos puntos elegidos: TODAS las ventanas de 50 crecen
    // hacia el cero, de punta a punta del tanque.
    let ventanaAnterior = 0
    for (let s = TANQUE - 50; s >= 0; s -= 50) {
      const d = energiaCon(s) - energiaCon(s + 50)
      expect(d).toBeGreaterThan(ventanaAnterior)
      ventanaAnterior = d
    }

    // Negativo: por eso NO es la recta. Media stamina no es media necesidad.
    expect(energiaCon(TANQUE / 2)).toBeCloseTo(0.25, 10)
    expect(energiaCon(TANQUE / 2)).not.toBeCloseTo(0.5, 2)
  })

  it('50 de stamina NO es «5% de necesidad» — y el precio de la aceleración, dicho', () => {
    // Positivo: el número que el enunciado exige que no sea chico.
    const e50 = energiaCon(50)
    expect(e50).toBeCloseTo(0.9025, 10)
    expect(e50).toBeGreaterThan(0.9)
    // La lectura ingenua que el enunciado rechaza es «tiene el 5% del tanque, o
    // sea el 5% de necesidad». Acá vale 18 veces más que eso.
    expect(e50 / (50 / TANQUE)).toBeCloseTo(18.05, 6)

    // Negativo, y es el precio que se paga por acelerar: la curva va por DEBAJO
    // de la recta, y tiene que quedar escrito acá para que no se descubra como
    // sorpresa. La demostración de que no se pueden tener las dos cosas está en
    // el encabezado de `src/necesidades.ts`.
    expect(e50).toBeLessThan(1 - 50 / TANQUE)
    expect(1 - 50 / TANQUE - e50).toBeCloseTo(0.0475, 10)
  })

  it('fuera del tanque se acota, y un `NaN` no envenena el vector', () => {
    // Positivo: los dos lados del rango se acotan al extremo que corresponde.
    expect(energiaCon(TANQUE * 5)).toBe(0)
    expect(energiaCon(-37)).toBe(1)

    // Negativo: acotar no puede significar «cualquier cosa rara da 1».
    expect(energiaCon(Number.NaN)).toBe(0)
    expect(energiaCon(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

// ─── C1b · El frío ──────────────────────────────────────────────────────────

describe('C1b · el calor sale del cuerpo CONTRA el ambiente', () => {
  it('a temperatura ambiente no duele, y de más tampoco', () => {
    // Positivo: cómodo es cómodo.
    expect(calorCon(T_AMBIENTE, T_AMBIENTE)).toBe(0)
    // Y el piso del eje térmico duele todo.
    expect(calorCon(PISO_TERMICO, PISO_TERMICO)).toBe(1)

    // Negativo: el calor de MÁS no es esta necesidad. Un cuerpo a 300 °C tiene un
    // problema y no es éste; estirar `calor` para que también lo dijera la
    // volvería no monótona y la escalera no podría ordenar con ella.
    expect(calorCon(300, 300)).toBe(0)
    expect(calorCon(T_AMBIENTE + 1, T_AMBIENTE + 1)).toBe(0)
  })

  it('el ambiente manda aunque el cuerpo todavía no lo sepa, y el cuerpo también', () => {
    const escala = T_AMBIENTE - PISO_TERMICO
    const helada = 15 / escala

    // Positivo A: cuerpo cómodo, celda a 0 °C. La ley 1 lo va a llevar ahí, así
    // que ya duele.
    expect(calorCon(T_AMBIENTE, 0)).toBeCloseTo(helada, 12)
    // Positivo B: y al revés, el cuerpo helado al lado del fuego sigue helado.
    expect(calorCon(0, T_AMBIENTE)).toBeCloseTo(helada, 12)

    // Negativo: no es «cualquier diferencia entre los dos duele». Con los dos
    // cómodos no duele nada, por más que estén distintos.
    expect(calorCon(T_AMBIENTE + 50, T_AMBIENTE)).toBe(0)
  })

  it('la rampa es RECTA, y eso es una consecuencia de que el frío no tenga motor', () => {
    // Positivo: el punto medio del eje vale exactamente la mitad. Ninguna de las
    // doce leyes le saca stamina a un cuerpo por estar frío, así que no hay
    // ningún codo medido que justifique curvarla — y una curva sin medición sería
    // el número inventado que este archivo persigue en todos lados.
    const medio = (T_AMBIENTE + PISO_TERMICO) / 2
    expect(calorCon(medio, medio)).toBeCloseTo(0.5, 12)

    // Negativo: no es recta porque sea constante. Los cuartos también caen donde
    // tienen que caer.
    expect(calorCon((T_AMBIENTE + medio) / 2, (T_AMBIENTE + medio) / 2)).toBeCloseTo(0.25, 12)
  })
})

// ─── C2 · T2.1, el control del día cableado ─────────────────────────────────

describe('C2 · el refugio escala con `dayLength` — prueba T2.1', () => {
  it('amanecer cero, anochecer uno, y la noche entera uno', () => {
    // Positivo: los tres momentos que el reloj de `@anima/world` produce. Al
    // amanecer `secondsToNightfall` vale la mitad del día; de noche vale 0 y no
    // «lo que falta para el próximo anochecer» (`world/src/reloj.ts`).
    expect(refugioCon(200, 100)).toBe(0)
    expect(refugioCon(200, 0)).toBe(1)
    expect(refugioCon(400, 200)).toBe(0)
    expect(refugioCon(400, 0)).toBe(1)

    // Negativo: no es un escalón. Al mediodía ya duele algo, y no duele todo.
    const mediodia = refugioCon(200, 50)
    expect(mediodia).toBeGreaterThan(0)
    expect(mediodia).toBeLessThan(1)
    expect(mediodia).toBeCloseTo(0.25, 12)
  })

  it('INVARIANCIA DE ESCALA: el mismo momento del día duele lo mismo con cualquier día', () => {
    // Positivo: `refugio` es función de la FRACCIÓN de luz que queda y de nada
    // más. Si el día se estira k veces y el momento también, el número no se
    // mueve ni un bit.
    for (const k of [2, 3, 7, 10]) {
      for (const stn of [100, 75, 50, 25, 10, 1, 0]) {
        expect(refugioCon(200 * k, stn * k)).toBe(refugioCon(200, stn))
      }
    }

    // Negativo: y no es que dé lo mismo siempre. Estirar el día SIN mover el
    // momento sí cambia el número, porque a 50 segundos del anochecer de un día
    // de 400 todavía queda mucha más luz proporcional.
    expect(refugioCon(400, 50)).not.toBe(refugioCon(200, 50))
    expect(refugioCon(400, 50)).toBeCloseTo(0.5625, 12)
  })

  it('EL CONTROL: el segundo absoluto del disparo se DUPLICA cuando el día se duplica', () => {
    // Éste es el test que el documento pide con todas las letras: «la maniobra
    // arranca N ticks antes del anochecer y N escala cuando se cambia
    // `dayLength`». `N` se busca por bisección sobre la necesidad, así que el
    // test no depende de la forma de la curva: sirve para cualquiera que sea
    // monótona.
    for (const umbral of [0.25, 0.5, 0.75, 0.9]) {
      const corto = disparo(200, umbral)
      const largo = disparo(400, umbral)
      // Positivo: escala, y escala exacto.
      expect(largo / corto).toBeCloseTo(2, 9)

      // Negativo, que es la mitad que atrapa el cableo: si el largo del día
      // estuviera escrito adentro, los dos números serían EL MISMO. No lo son, y
      // por cuánto no lo son queda medido acá.
      expect(largo).not.toBeCloseTo(corto, 6)
      expect(largo - corto).toBeCloseTo(corto, 9)
    }

    // Y el número del umbral del medio, para que se pueda leer sin correr nada:
    // con un día de 200 s la urgencia pasa de 0,5 a 29,29 s del anochecer, y con
    // uno de 400 a 58,58 s.
    expect(disparo(200, 0.5)).toBeCloseTo(29.2893, 4)
    expect(disparo(400, 0.5)).toBeCloseTo(58.5786, 4)
  })

  it('bajo techo la noche no duele, y a medio techo duele la mitad', () => {
    // Positivo: `refugio` es la única de las tres cuya satisfacción es un LUGAR.
    // Adentro de la cueva, en plena noche, no duele.
    expect(refugioCon(200, 0, 1)).toBe(0)
    expect(refugioCon(200, 0, 0.5)).toBeCloseTo(0.5, 12)

    // Negativo: sin techo, la misma noche duele todo. Y un `sheltered` fuera de
    // rango no puede volver la necesidad negativa.
    expect(refugioCon(200, 0, 0)).toBe(1)
    expect(refugioCon(200, 0, 5)).toBe(0)
    expect(refugioCon(200, 0, -5)).toBe(1)
  })

  it('un día degenerado contesta el extremo en vez de un `NaN`', () => {
    // Positivo: sin luz que gastar, la noche es todo.
    expect(refugioCon(0, 0)).toBe(1)
    // Negativo: y no es que conteste 1 siempre — con techo sigue siendo 0.
    expect(refugioCon(0, 0, 1)).toBe(0)
  })
})

/**
 * `N`: a cuántos segundos del anochecer la necesidad de refugio cruza el umbral.
 *
 * Bisección y no despeje: despejar exigiría invertir la curva, o sea escribir la
 * fórmula de `src/` una segunda vez en el test — que es la forma más común de que
 * un test verifique su propia copia en vez del código.
 */
function disparo(dayLength: number, umbral: number): number {
  let lo = 0
  let hi = dayLength / 2
  for (let i = 0; i < 80; i++) {
    const medio = (lo + hi) / 2
    if (refugioCon(dayLength, medio) >= umbral) lo = medio
    else hi = medio
  }
  return lo
}

// ─── C3 · La satisfacción sale del catálogo ─────────────────────────────────

describe('C3 · qué calma cada tag, derivado de las propiedades', () => {
  it('lo carnoso calma el hambre, y lo mineral no', () => {
    // Positivo: con hambre pura, lo carnoso calma todo lo que hay para calmar —
    // la grasa es la sustancia más calórica de la semilla (9 de `nutrition` por
    // 0,35 de `digestibility` es la carne; la grasa da 15,40) y lleva el tag.
    expect(satisfaccion(HAMBRE, 'carnoso')).toBe(1)

    // Negativo: lo mineral no alimenta, y no porque una fila lo diga sino porque
    // la piedra, el pedernal y la arcilla tienen `nutrition` 0.
    expect(satisfaccion(HAMBRE, 'mineral')).toBe(0)
    expect(satisfaccion(HAMBRE, 'carbonoso')).toBe(0)
  })

  it('lo que arde calma el frío, y no todo arde igual', () => {
    // Positivo: el carbón tiene el `fuelEnergy` más alto del catálogo (32) y es
    // lo único con tag carbonoso, así que ese tag promete el máximo.
    expect(satisfaccion(FRIO, 'carbonoso')).toBe(1)

    // Negativo: lo mineral casi no arde. El único mineral que quema es el hueso
    // —que es mineral Y orgánico— con 4 sobre 32.
    expect(satisfaccion(FRIO, 'mineral')).toBeCloseTo(0.125, 12)
    expect(satisfaccion(FRIO, 'mineral')).toBeLessThan(satisfaccion(FRIO, 'carbonoso') / 8 + 1e-12)
  })

  it('UN HALLAZGO, no una estipulación: lo carnoso también calienta', () => {
    // No lo decidió nadie: la grasa tiene `fuelEnergy` 30 sobre los 32 del
    // carbón, así que el tag que mejor alimenta es además casi el que mejor arde.
    // Se afirma porque es la clase de consecuencia que una tabla escrita a mano
    // no habría tenido nunca, y es la prueba de que esto sale de propiedades.
    expect(promesaDeTag('carnoso').calor).toBeCloseTo(30 / 32, 12)

    // Negativo: y sin embargo NO es que todo tag prometa todo. Lo carbonoso no
    // alimenta ni un poco.
    expect(promesaDeTag('carbonoso').energia).toBe(0)
  })

  it('sin nada que doler no calma nada', () => {
    // Positivo: `satisfaccion` es dolor por promesa, no promesa a secas.
    for (const tag of TAGS) expect(satisfaccion(NADA_DUELE, tag)).toBe(0)
    // Negativo: con dolor, los mismos tags sí contestan.
    expect(satisfaccion(HAMBRE, 'carnoso')).toBeGreaterThan(0)
  })

  it('con dos necesidades a la vez, calma la parte que resuelve', () => {
    const mitades: NeedVector = { energia: 0.5, calor: 0.5, refugio: 0 }
    // Positivo: lo carbonoso arde todo y no alimenta nada, así que con las dos
    // necesidades empatadas calma la mitad.
    expect(satisfaccion(mitades, 'carbonoso')).toBeCloseTo(0.5, 12)
    // Negativo: no es 1, que es lo que daría un máximo en vez de un promedio
    // pesado, ni 0, que es lo que daría exigir las dos.
    expect(satisfaccion(mitades, 'carbonoso')).toBeLessThan(1)
    expect(satisfaccion(mitades, 'carbonoso')).toBeGreaterThan(0)
  })

  it('NINGÚN tag calma el refugio, y acá está el número que se descartó', () => {
    // Positivo: un techo es un LUGAR y no una cosa que se tenga. La ley 12
    // produce `sheltered` con un cuerpo COLOCADO encima, y `satisfaccion` sólo
    // sabe contestar por lo que se tiene.
    for (const tag of TAGS) {
      expect(satisfaccion(NOCHE, tag)).toBe(0)
      expect(promesaDeTag(tag).refugio).toBe(0)
    }

    // Negativo — Y ES EL REGISTRO DEL DISEÑO DESCARTADO. La versión que sí
    // derivaba refugio de `permeability` compila y corre; se la reconstruye acá
    // para poder medir lo que habría hecho, que es lo que la justifica no estar.
    const phys = buildSeedPhysics()
    const oclusion = new Map<string, number>()
    for (const s of phys.substances.values()) {
      const p = s.perUnitMass.permeability
      if (p === undefined) continue
      for (const t of s.tags) oclusion.set(t, Math.max(oclusion.get(t) ?? 0, 1 - p))
    }
    const carnoso = oclusion.get('carnoso') ?? 0
    const mineral = oclusion.get('mineral') ?? 0
    expect(carnoso).toBeCloseTo(0.9, 12)
    expect(mineral).toBeCloseTo(0.99, 12)
    // Un pedazo de grasa en la mano habría sido el 91% de un techo de piedra.
    expect(carnoso / mineral).toBeCloseTo(0.9091, 4)

    // Y el daño en la decisión, medido: criatura recién nacida al caer la noche.
    const reciennacida: NeedVector = { energia: 0.25, calor: 0, refugio: 0.9 }
    const comoEsta = satisfaccion(reciennacida, 'carnoso')
    const conElBug =
      (reciennacida.energia * promesaDeTag('carnoso').energia +
        reciennacida.refugio * (carnoso / mineral)) /
      (reciennacida.energia + reciennacida.calor + reciennacida.refugio)
    expect(comoEsta).toBeCloseTo(0.2174, 4)
    expect(conElBug).toBeCloseTo(0.9289, 4)
  })

  it('el tag viaja pelado o adentro de un predicado, y da lo mismo', () => {
    // Positivo: `@anima/plan` escribe `holding(tag:carnoso)` y la memoria de
    // afordancias guarda tags pelados. Las dos formas tienen que llegar.
    expect(satisfaccion(HAMBRE, 'tag:carnoso')).toBe(satisfaccion(HAMBRE, 'carnoso'))
    expect(satisfaccion(HAMBRE, 'holding(tag:carnoso)')).toBe(satisfaccion(HAMBRE, 'carnoso'))

    // Negativo: y no es que acepte cualquier cosa. Un tag que no existe no
    // promete nada, y tampoco lo hace un tag mal escrito.
    expect(satisfaccion(HAMBRE, 'carnos')).toBe(0)
    expect(satisfaccion(HAMBRE, 'comida')).toBe(0)
    expect(satisfaccion(HAMBRE, '')).toBe(0)
    expect(satisfaccion(HAMBRE, 'holding(tag:)')).toBe(0)
  })
})

// ─── C3b · EL TEST ESTRELLA: la sustancia que nadie previó ──────────────────

describe('C3b · una sustancia inventada rinde por sus propiedades, sin fila propia', () => {
  /**
   * Nadie la previó y nadie va a escribirle una fila: es un mineral que ALIMENTA,
   * que es justo la combinación que la semilla no tiene —sus tres minerales
   * (piedra, pedernal, arcilla) tienen `nutrition` 0— y que además es más
   * calórica que la grasa, que es lo más calórico que había.
   */
  const SAL_VIVA: Substance = {
    id: 'sal-viva',
    lexeme: { nombre: 'sal viva', genero: 'f', sinonimos: [] },
    tags: ['mineral'],
    perUnitMass: {
      nutrition: 30,
      digestibility: 0.8,
      fuelEnergy: 0,
      moisture: 0.05,
      rigidity: 0.4,
      permeability: 0.2,
      toxicity: 0,
      decay: 0,
    },
    specificHeat: 0.9,
    provenance: { by: 'oraculo', atTick: 4200 },
  }

  /** Y una que arde el doble que el carbón, con un tag que ya existía. */
  const RESINA_FOSIL: Substance = {
    id: 'resina-fosil',
    lexeme: { nombre: 'resina fósil', genero: 'f', sinonimos: [] },
    tags: ['vegetal'],
    perUnitMass: {
      nutrition: 0,
      digestibility: 0,
      fuelEnergy: 64,
      ignitionPoint: 200,
      moisture: 0,
      rigidity: 0.5,
      permeability: 0.1,
    },
    specificHeat: 1.2,
    provenance: { by: 'oraculo', atTick: 4200 },
  }

  const conInvento = (...nuevas: Substance[]): Physics =>
    buildSeedPhysics({ substances: [...SUSTANCIAS_SEMILLA, ...nuevas] })

  it('un mineral que alimenta alimenta, el mismo tick en que existe', () => {
    const antes = buildSeedPhysics()
    const despues = conInvento(SAL_VIVA)

    // Negativo primero, que es el control: en la semilla lo mineral no alimenta.
    expect(satisfaccion(HAMBRE, 'mineral', antes)).toBe(0)

    // Positivo: con la sal viva adentro, el mismo tag promete el máximo — porque
    // 30 × 0,8 = 24 calorías por unidad de masa le pasan a las 15,40 de la grasa.
    // No se escribió ninguna fila: la cuenta salió de `nutrition` y
    // `digestibility`, que son dos campos que la sustancia trae puestos.
    expect(satisfaccion(HAMBRE, 'mineral', despues)).toBe(1)
    expect(promesaDeTag('mineral', despues).energia).toBe(1)

    // Negativo: la invención NO contagia a los tags que no lleva. Lo carbonoso
    // sigue sin alimentar, y lo mineral sigue ardiendo lo mismo que antes,
    // porque la sal viva no tiene `fuelEnergy`.
    expect(satisfaccion(HAMBRE, 'carbonoso', despues)).toBe(0)
    expect(promesaDeTag('mineral', despues).calor).toBeCloseTo(
      promesaDeTag('mineral', antes).calor,
      12,
    )
  })

  it('y una resina que arde el doble que el carbón hace lo mismo con el frío', () => {
    const antes = buildSeedPhysics()
    const despues = conInvento(RESINA_FOSIL)

    // Negativo primero: en la semilla, lo vegetal arde bien pero no es lo mejor
    // (la madera dura da 21 contra los 32 del carbón).
    expect(satisfaccion(FRIO, 'vegetal', antes)).toBeCloseTo(21 / 32, 12)

    // Positivo: con la resina, lo vegetal pasa a ser el techo y el carbón queda
    // en la mitad exacta, porque 32 sobre 64 es la mitad.
    expect(satisfaccion(FRIO, 'vegetal', despues)).toBe(1)
    expect(satisfaccion(FRIO, 'carbonoso', despues)).toBeCloseTo(0.5, 12)

    // Negativo: y no le movió el alimento a lo vegetal, que sigue saliendo de la
    // savia (2,60 sobre las 15,40 de la grasa).
    expect(promesaDeTag('vegetal', despues).energia).toBeCloseTo(2.6 / 15.4, 12)
    expect(promesaDeTag('vegetal', despues).energia).toBeCloseTo(
      promesaDeTag('vegetal', antes).energia,
      12,
    )
  })

  it('EL PRECIO, dicho: el techo es compartido, así que inventar algo mejor BAJA lo viejo', () => {
    const antes = buildSeedPhysics()
    const despues = conInvento(SAL_VIVA)

    // Positivo: es deliberado. «1» significa «lo mejor que este mundo tiene hoy»,
    // así que aparecer algo mejor corre la vara para todos. Lo carnoso pasa de 1
    // a 15,40 sobre 24.
    expect(promesaDeTag('carnoso', antes).energia).toBe(1)
    expect(promesaDeTag('carnoso', despues).energia).toBeCloseTo(15.4 / 24, 12)

    // Negativo: bajar no es desaparecer, y el ORDEN entre tags —que es lo único
    // que la escalera usa— no se movió.
    expect(promesaDeTag('carnoso', despues).energia).toBeGreaterThan(
      promesaDeTag('vegetal', despues).energia,
    )
    expect(promesaDeTag('vegetal', despues).energia).toBeGreaterThan(
      promesaDeTag('fibroso', despues).energia,
    )
  })

  it('dos físicas distintas no se pisan la cuenta', () => {
    // Positivo: la tabla se guarda por objeto `Physics`, así que preguntar por
    // una no puede contaminar a la otra. Se pregunta en orden cruzado a propósito.
    const a = buildSeedPhysics()
    const b = conInvento(SAL_VIVA)
    expect(satisfaccion(HAMBRE, 'mineral', a)).toBe(0)
    expect(satisfaccion(HAMBRE, 'mineral', b)).toBe(1)
    expect(satisfaccion(HAMBRE, 'mineral', a)).toBe(0)

    // Negativo: y dos físicas SEMILLA distintas dan lo mismo, o sea que el
    // guardado no está devolviendo la respuesta de la primera que preguntó.
    expect(promesaDeTag('carnoso', buildSeedPhysics())).toEqual(promesaDeTag('carnoso', a))
  })
})

// ─── C3c · El guardián: que no haya tabla ───────────────────────────────────

describe('C3c · no hay una fila por sustancia, ni por tag, ni un día cableado', () => {
  const FUENTE = readFileSync(fileURLToPath(new URL('../src/necesidades.ts', import.meta.url)), 'utf8')

  /**
   * Saca comentarios de bloque y de línea. Es un cortador crudo a propósito —no
   * entiende de strings con `//` adentro— y eso está bien porque el archivo que
   * lee no tiene ninguno: si mañana lo tiene, este guardián se rompe ruidosamente
   * en vez de dejar pasar una tabla escondida adentro de un literal.
   */
  const codigo = FUENTE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

  it('el código no nombra ni una sola sustancia', () => {
    // Positivo: las treinta de la semilla, barridas del dato y no de una lista
    // escrita a mano, así que la trigésima primera entra sola.
    const nombradas = SUSTANCIAS_SEMILLA.map((s) => s.id).filter((id) => codigo.includes(id))
    expect(nombradas).toEqual([])

    // Negativo: el cortador de comentarios funciona, o sea que el verde de arriba
    // no es «no quedó código». Los comentarios SÍ nombran sustancias, y el fuente
    // entero las tiene.
    expect(codigo.length).toBeGreaterThan(600)
    expect(SUSTANCIAS_SEMILLA.some((s) => FUENTE.includes(s.id))).toBe(true)
  })

  it('el código no nombra ni un solo tag', () => {
    // Positivo: ni `carnoso` ni ninguno de los otros seis. Que `carnoso` calme el
    // hambre no está escrito en ningún lado: sale de que las sustancias que lo
    // llevan tienen `nutrition`.
    const nombrados = TAGS.filter((t) => codigo.includes(t))
    expect(nombrados).toEqual([])

    // Negativo: y los comentarios sí los nombran, que es de nuevo la prueba de
    // que el cortador no se comió el archivo.
    expect(TAGS.some((t) => FUENTE.includes(t))).toBe(true)
  })

  it('el código no tiene ningún número mayor que 2 — o sea que el día no está cableado', () => {
    // Es la mitad estructural del control T2.1. Un `100`, un `200`, un `1000` o
    // un `115` escritos acá serían el largo del día, el tanque o la escala
    // térmica copiados a mano; todos salen de `@anima/physics` en tiempo de
    // import. El `lookbehind` evita confundir el `01` de un identificador con un
    // literal.
    const literales = [...codigo.matchAll(/(?<![A-Za-z0-9_$.])\d+(?:\.\d+)?/g)]
      .map((m) => Number(m[0]))
      .filter((n) => n > 2)
    expect(literales).toEqual([])

    // Negativo: hay números, y son los chiquitos de la aritmética (0, 1, 2).
    expect([...codigo.matchAll(/(?<![A-Za-z0-9_$.])\d+/g)].length).toBeGreaterThan(3)
  })

  it('el código no importa `@anima/world`, que es de dónde vendría el día cableado', () => {
    // Positivo: `LARGO_DEL_DIA` vive en `@anima/world` y es exactamente la
    // constante que este módulo NO puede conocer. Importarla sería el mismo cableo
    // con permiso de la dirección de dependencias.
    expect(codigo).not.toContain('@anima/world')
    expect(codigo).not.toContain('LARGO_DEL_DIA')

    // Negativo: sí importa la física, que es de donde salen el tanque y el eje
    // térmico. Un guardián que pasara porque el archivo no importa nada no
    // cuidaría nada.
    expect(codigo).toContain('@anima/physics')
  })
})
