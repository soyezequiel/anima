// ─── ATAQUE · crear masa o nutrición de la nada ──────────────────────────────
//
// Este archivo lo escribió un adversario. Cada `it` es un intento de colar por
// `admit()` un proceso —o una sustancia— que fabrica materia o comida donde no
// la había. No hay ni un arreglo acá: el trabajo era ENCONTRAR, y arreglar
// borraría la evidencia.
//
// CÓMO SE LEE
//
//   · `it(...)` normal        → la puerta RECHAZÓ el intento. El test afirma el
//                               rechazo y queda como regresión: si mañana alguien
//                               afloja esa regla, esto se pone rojo.
//   · `it.fails(...)`         → HUECO ABIERTO. El cuerpo del test afirma lo que
//     con «HUECO ABIERTO»       la puerta DEBERÍA contestar, y hoy no contesta.
//     en el nombre              Vitest lo cuenta como esperado-que-falle: el día
//                               que se tape el hueco, el test se pone rojo con
//                               «expected to fail but passed» y hay que sacarle
//                               el `.fails`. Ninguno de estos afirma la conducta
//                               rota como si fuera correcta.
//
// Los huecos encontrados, en orden de gravedad:
//
//   1. `transfer` no tiene control de CANTIDAD. Un `drain` que gasta más de lo
//      que el rol garantiza cobra el reparo `costo-mayor-que-la-garantia`; un
//      `transfer` que mueve mil veces más de lo que el origen garantiza no cobra
//      nada. Con eso se llena de nutrición un tronco desde una hoja.
//   2. `nutrition` es INTENSIVA (por unidad de masa) y la regla 1 nunca compara
//      el producto `q · mass`. `quality.ts` lo dice con todas las letras —«la
//      regla 1 de admit() tiene que comparar el producto»— y no está hecho.
//   3. `respalda()` devuelve `true` para `mass` SIEMPRE. Un `transfer` de masa
//      no lo mira ningún número: se puede mover masa desde un guijarro.
//   4. Un proceso puede empujar una cualidad DERIVADA. El código tiene el motivo
//      («no se guarda») y hasta el código de rechazo `cualidad-derivada`, pero lo
//      usa solo en `admitSubstance`. Con un `drive` de `catch` una piedra pesca.
//   5. El costo del `poweredBy` se mide en las unidades de la cualidad EMPUJADA.
//      Subir 385 °C cuesta 1100 de stamina; subir `digestibility` de 0 a 1 cuesta
//      1. O sea: cocinar sin fuego, gratis.
//   6. La envolvente por tag es la UNIÓN de los tags. Agregarle `organico` a una
//      piedra le sube el techo de `nutrition` de 0 a 33.
//   7. La no-dominancia exige que los dos procesos tengan los MISMOS nombres de
//      rol y no mira `completion.at`. Pescar sin caña, o pescar en un tick en vez
//      de treinta, no domina a nadie.
//   8. El punto fijo redondea las mitades ALEJÁNDOSE del cero, y nada le pone
//      piso de masa a un `split`: partir en dos algo de masa 0.001 da 0.002.

import { describe, expect, it } from 'vitest'
import { admit, admitSubstance, consumedRoles, saldoDeclarado, tieneCodigo, tieneReparo, type Verdict } from '../src/admit.js'
import { buildSeedPhysics } from '../src/physics.js'
import { EXTRACCION, PHYSICS_VERSION, type Process } from '../src/process.js'
import type { Substance } from '../src/substance.js'
import { qualityOf, type Body } from '../src/body.js'
import { fdiv, fx, unfx } from '../src/fixed.js'

const phys = buildSeedPhysics()

const codigos = (v: Verdict): readonly string[] => v.razones.map((r) => r.codigo)

/** Un proceso al que solo le importa lo que le pongo encima. */
const proc = (id: string, extra: Partial<Process>): Process => ({
  id,
  lexeme: { nombre: id },
  roles: [{ name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] }],
  arrangement: { k: 'held' },
  gate: [],
  effects: [],
  establishes: [],
  commitment: 'reversible',
  trust: 'borrador',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'modelo' },
  ...extra,
})

const sustancia = (
  id: string,
  tags: Substance['tags'],
  perUnitMass: Substance['perUnitMass'],
  specificHeat = 1.5,
): Substance => ({
  id,
  lexeme: { nombre: id, genero: 'f', sinonimos: [] },
  tags,
  perUnitMass,
  specificHeat,
  provenance: { by: 'oraculo', atTick: 500 },
})

// ═══ LO QUE LA PUERTA SÍ ATAJA ══════════════════════════════════════════════
//
// Estos entraron primero y rebotaron. Quedan como regresión: son los caminos
// obvios a la comida gratis, y están cerrados.

describe('los caminos directos a la comida gratis están cerrados', () => {
  it('subirle nutrition a la madera con un drive: rechazado', () => {
    const p = proc('madera-nutritiva', {
      roles: [{ name: 'palo', where: [{ q: 'rigidity', op: '>=', v: 0.6 }] }],
      effects: [
        {
          k: 'drive',
          q: 'nutrition',
          on: 'palo',
          toward: 20,
          perTick: 0.5,
          // Con poweredBy y todo: la regla 1 no negocia con la declaración.
          poweredBy: { from: 'palo', q: 'stamina', efficiency: 0.1 },
        },
      ],
      establishes: ['nutrition>=20'],
    })
    expect(tieneCodigo(admit(p, phys), 'conservacion-drive')).toBe(true)
  })

  it('subirle nutrition con un couple a algo que sí la tiene: rechazado', () => {
    const p = proc('madera-por-contagio', {
      roles: [
        { name: 'palo', where: [{ q: 'rigidity', op: '>=', v: 0.6 }] },
        { name: 'carne', where: [{ q: 'nutrition', op: '>', v: 0 }] },
      ],
      arrangement: { k: 'contact' },
      effects: [{ k: 'couple', q: 'nutrition', on: 'palo', follows: { q: 'nutrition', of: 'carne' } }],
      establishes: ['nutrition>=9'],
    })
    expect(tieneCodigo(admit(p, phys), 'conservacion-couple')).toBe(true)
  })

  it('la misma subida escrita como un drain de tasa negativa: rechazado', () => {
    const p = proc('madera-al-reves', {
      roles: [{ name: 'palo', where: [{ q: 'rigidity', op: '>=', v: 0.6 }] }],
      effects: [{ k: 'drain', q: 'nutrition', on: 'palo', perTick: -2 }],
    })
    expect(tieneCodigo(admit(p, phys), 'tasa-negativa')).toBe(true)
  })

  it('duplicar masa con un drive: rechazado', () => {
    const p = proc('duplicar-masa', {
      roles: [{ name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] }],
      effects: [{ k: 'drive', q: 'mass', on: 'a', toward: 500, perTick: 10 }],
      completion: { at: 10, yields: [{ k: 'split', role: 'a', at: 'grain' }] },
      establishes: ['mass>=500'],
    })
    expect(tieneCodigo(admit(p, phys), 'conservacion-drive')).toBe(true)
  })

  it('sacar de un stock que no declara masa: rechazado', () => {
    const p = proc('pescar-del-aire', {
      roles: [{ name: 'lugar', where: [{ q: 'moisture', op: '>=', v: 0.5 }] }],
      arrangement: { k: 'within', radius: 1 },
      completion: { at: 5, yields: [{ k: 'drawFromStock', of: 'lugar', into: 'hands' }] },
      establishes: ['holding(tag:carnoso)'],
    })
    expect(tieneCodigo(admit(p, phys), 'materia-sin-origen')).toBe(true)
  })

  it('trasvasar nutrition desde un rol que puede estar lleno de liana: rechazado', () => {
    // El origen pide `tensile`, y la liana cumple con nutrition 0. Basta con que
    // UNA candidata la traiga en cero para que el respaldo no sea garantía.
    const p = proc('exprimir-la-fibra', {
      roles: [
        { name: 'fibra', where: [{ q: 'tensile', op: '>=', v: 0.4 }] },
        { name: 'boca', where: [] },
      ],
      arrangement: { k: 'contact' },
      effects: [{ k: 'transfer', q: 'nutrition', from: 'fibra', to: 'boca', perTick: 5 }],
      completion: { at: 10, yields: [] },
    })
    expect(tieneCodigo(admit(p, phys), 'conservacion-transfer')).toBe(true)
  })

  it('y el oráculo no puede declarar una piedra nutritiva mientras sea solo mineral', () => {
    const v = admitSubstance(sustancia('piedra-de-pan', ['mineral'], { nutrition: 5 }), phys)
    expect(tieneCodigo(v, 'fuera-de-envolvente')).toBe(true)
  })
})

// ═══ HUECO 1 · el `transfer` no tiene control de cantidad ═══════════════════

describe('HUECO · transferir más de lo que el origen tiene', () => {
  /**
   * Una hoja (nutrition 2) pegada a un tronco, y 90 de nutrición por tick
   * durante 60 ticks: 5400 unidades salidas de un rol que solo garantiza
   * «más que cero».
   *
   * La regla 1 mira si el origen RESPALDA la cualidad —sí, todas las candidatas
   * traen nutrition > 0— y no mira nunca CUÁNTA. La regla 2 sí tiene ese control
   * (`costo-mayor-que-la-garantia`) pero solo lo corre sobre `drive` y `drain`.
   */
  const ENGORDAR: Process = proc('engordar-el-tronco', {
    roles: [
      { name: 'donante', where: [{ q: 'nutrition', op: '>', v: 0 }] },
      { name: 'receptor', where: [{ q: 'nutrition', op: '<=', v: 0 }] },
    ],
    arrangement: { k: 'contact' },
    effects: [{ k: 'transfer', q: 'nutrition', from: 'donante', to: 'receptor', perTick: 90 }],
    establishes: ['nutrition>=90'],
  })

  it.fails('HUECO ABIERTO — mover 90 de nutrition desde un rol que garantiza «> 0» debería rechazarse', () => {
    const v = admit(ENGORDAR, phys)
    // Lo que hoy pasa, para que quede escrito: entra sin una sola razón.
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)
    // Y ni siquiera un reparo sobre la cantidad, que es lo que un `drain` sí cobra.
    expect(tieneReparo(v, 'costo-mayor-que-la-garantia')).toBe(false)

    // ── LO QUE DEBERÍA PASAR, y es lo que hace fallar este test ──
    expect(v.ok).toBe(false)
  })

  it.fails('HUECO ABIERTO — y no consume NADA: la hoja donante queda entera, tick tras tick', () => {
    // `consumedRoles` se deriva de los rendimientos, y este proceso no tiene
    // ninguno: nada se gasta. El efecto corre mientras el arreglo se sostenga.
    expect(consumedRoles(ENGORDAR)).toEqual([])
    expect(admit(ENGORDAR, phys).ok).toBe(true)

    // ── DEBERÍA: un proceso que mueve una conservada sin consumir su fuente
    //    tendría que declarar de dónde sale, o al menos cobrar reparo.
    expect(admit(ENGORDAR, phys).ok).toBe(false)
  })

  it.fails('HUECO ABIERTO — el ciclo consigo mismo da saldo 0 porque el transfer se ASUME conservativo', () => {
    // El proceso promete `nutrition>=90` y su propio rol `donante` pide
    // `nutrition > 0`: se habilita a sí mismo y la regla 5 encuentra el lazo.
    // Y lo deja pasar, porque `saldoDeclarado` le cree al `transfer`: suma el
    // crédito y resta el débito por el mismo número.
    expect(saldoDeclarado(ENGORDAR, 'nutrition', phys)).toBe(0)

    // ── DEBERÍA: el débito no puede valer más que lo que el rol garantiza.
    expect(saldoDeclarado(ENGORDAR, 'nutrition', phys)).toBeLessThan(0)
  })

  it.fails('HUECO ABIERTO — nutrition es INTENSIVA: los mismos «9» en un tronco de 100 son 57 veces más comida', () => {
    // Éste es el hueco 1 llevado hasta donde duele. `quality.ts` avisa:
    // «La regla 1 de admit() tiene que comparar el producto; comparar el
    // intensivo dejaría pasar una bomba de materia». No compara el producto:
    // `entraDe` lee la cota del rol tal cual, sin multiplicar por masa. Y
    // `nutrition` es intensiva: el número es POR UNIDAD DE MASA. Mover «9» de un
    // trocito de 0.1 a un tronco de 100 conserva el número y multiplica el total.
    const trocito: Body = { id: 'trocito', form: 'filete', parts: [{ substance: 'carne', mass: 0.1, q: {} }], joints: [], state: {} }
    const tronco: Body = {
      id: 'tronco',
      form: 'vara',
      parts: [{ substance: 'madera', mass: 100, q: {} }],
      joints: [],
      // Lo único que el `transfer` escribe: la misma nutrición por unidad de
      // masa. La digestibilidad sigue siendo la de la madera, 0.02.
      state: { nutrition: 9 },
    }
    const antes = qualityOf(trocito, 'calories', phys)
    const despues = qualityOf(tronco, 'calories', phys)
    expect(antes).toBeCloseTo(0.315, 6) // 9 × 0.1 × 0.35
    expect(despues).toBeCloseTo(18, 6) // 9 × 100 × 0.02
    expect(despues / antes).toBeCloseTo(57.14, 2)

    // ── DEBERÍA: mover la cualidad intensiva de un cuerpo chico a uno grande no
    //    puede multiplicar el total. La puerta ni se entera de que existe la masa.
    expect(despues).toBeLessThanOrEqual(antes)
  })
})

// ═══ HUECO 2 · la masa se mueve sin que nadie la cuente ════════════════════

describe('HUECO · transferir masa desde un guijarro', () => {
  const TRASVASE: Process = proc('trasvasar-la-masa', {
    roles: [
      { name: 'chico', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
      { name: 'grande', where: [] },
    ],
    arrangement: { k: 'contact' },
    effects: [{ k: 'transfer', q: 'mass', from: 'chico', to: 'grande', perTick: 500 }],
    completion: { at: 20, yields: [] },
    establishes: ['mass>=500'],
  })

  it.fails('HUECO ABIERTO — 10 000 de masa desde un rol que no promete ni un gramo', () => {
    // `respalda()` corta en seco: `if (q === 'mass') return true`. El comentario
    // dice «la masa la tiene todo cuerpo por definición», y es cierto — pero de
    // ahí no se sigue que tenga DIEZ MIL. Es exactamente el agujero que la
    // piedra-batería tiene tapado para `stamina` y abierto para `mass`.
    const v = admit(TRASVASE, phys)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)
    expect(saldoDeclarado(TRASVASE, 'mass', phys)).toBe(0)

    // ── DEBERÍA: sacar 10 000 de masa de un guijarro es materia de la nada.
    expect(v.ok).toBe(false)
  })
})

// ═══ HUECO 3 · empujar una cualidad DERIVADA ═══════════════════════════════

describe('HUECO · un drive sobre una cualidad que no se guarda', () => {
  /**
   * `catch` es derivada: sale de `freeStrandEnds · (0.15 + sharpness·0.5)`, o
   * sea de la GEOMETRÍA del ensamble. Es lo único que separa una piedra de una
   * caña, y por lo tanto lo único que separa a la criatura de la comida.
   *
   * `admitSubstance` rechaza que una sustancia declare una derivada, con el
   * código `cualidad-derivada` y el motivo escrito. `reglaCierreYCotas` mira si
   * la cualidad está en el catálogo —y una derivada lo está— y no mira si es
   * derivada. Un `drive` de `catch` entra.
   */
  const AGARRE_MAGICO: Process = proc('darle-agarre-a-la-piedra', {
    roles: [
      { name: 'gear', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
    ],
    effects: [
      {
        k: 'drive',
        q: 'catch',
        on: 'gear',
        toward: 8,
        perTick: 0.5,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 1 },
      },
      {
        k: 'drive',
        q: 'reach',
        on: 'gear',
        toward: 16,
        perTick: 1,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 1 },
      },
    ],
    establishes: ['catch>=8', 'reach>=16'],
  })

  it.fails('HUECO ABIERTO — una piedra con `catch` 8 y `reach` 16 califica para `extraccion` sin atar nada', () => {
    const v = admit(AGARRE_MAGICO, phys)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)

    // Y lo que habilita es literalmente pescar: `extraccion` pide reach ≥ 2 y
    // catch > 0 sobre el aparejo, que es todo lo que este proceso regala.
    expect(EXTRACCION.roles.find((r) => r.name === 'gear')?.where).toEqual([
      { q: 'reach', op: '>=', v: 2 },
      { q: 'catch', op: '>', v: 0 },
    ])

    // ── DEBERÍA: `cualidad-derivada` existe como código de rechazo y esto tendría
    //    que llevárselo. Una derivada no se escribe: se calcula.
    expect(tieneCodigo(v, 'cualidad-derivada')).toBe(true)
  })

  it.fails('HUECO ABIERTO — y también se puede empujar `calories`, que ES la comida', () => {
    const p = proc('inventar-calorias', {
      roles: [
        { name: 'plato', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
        { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
      ],
      effects: [
        {
          k: 'drive',
          q: 'calories',
          on: 'plato',
          toward: 100000,
          perTick: 1,
          poweredBy: { from: 'actor', q: 'stamina', efficiency: 1 },
        },
      ],
      establishes: ['calories>=100000'],
    })
    const v = admit(p, phys)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)

    // ── DEBERÍA: `calories = nutrition · mass · digestibility` y nutrition es
    //    conservada. Empujar el resultado es saltearse la conservación por la
    //    puerta de atrás.
    expect(v.ok).toBe(false)
  })
})

// ═══ HUECO 4 · el poweredBy cobra en las unidades equivocadas ═══════════════

describe('HUECO · cocinar sin fuego por un suspiro de stamina', () => {
  /**
   * El costo de un `drive` es `trabajo / eficiencia`, y el «trabajo» está medido
   * en las unidades de la cualidad EMPUJADA. Subir la temperatura 385 grados
   * cuesta 1100 de stamina; subir `digestibility` de 0 a 1 —que es todo el
   * recorrido posible— cuesta 1.
   *
   * O sea que la técnica que el Hito 0 calibró durante un barrido entero, con su
   * tensión «comer antes o comer mejor», se puede saltear por 1 de stamina.
   */
  const MASTICAR_BIEN: Process = proc('ablandar-a-mano', {
    roles: [
      { name: 'comida', where: [{ q: 'denaturesAt', op: '>=', v: 40 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
    ],
    effects: [
      {
        k: 'drive',
        q: 'digestibility',
        on: 'comida',
        toward: 1,
        perTick: 0.05,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 1 },
      },
    ],
    completion: { at: 20, yields: [] },
    establishes: ['digestibility>=1'],
  })

  it.fails('HUECO ABIERTO — llevar digestibility a 1 sale 1 de stamina y no lo frena nadie', () => {
    const v = admit(MASTICAR_BIEN, phys)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)
    // Ni siquiera el reparo de costo: 1 de stamina es justo lo que el rol garantiza.
    expect(tieneReparo(v, 'costo-mayor-que-la-garantia')).toBe(false)

    // El premio, en calorías: el tubérculo crudo rinde 0.18 y así rinde 1.
    const crudo: Body = { id: 'crudo', form: 'bloque', parts: [{ substance: 'tuberculo', mass: 1, q: {} }], joints: [], state: {} }
    const ablandado: Body = { ...crudo, id: 'ablandado', state: { digestibility: 1 } }
    expect(qualityOf(crudo, 'calories', phys)).toBeCloseTo(1.26, 6)
    expect(qualityOf(ablandado, 'calories', phys)).toBeCloseTo(7, 6)

    // ── DEBERÍA: multiplicar por 5.5 la comida del mundo no puede costar lo
    //    mismo que rascarse. El costo del `poweredBy` tiene que estar en la
    //    cuenta conservada, no en las unidades de lo que se empuja.
    expect(v.ok).toBe(false)
  })

  it.fails('HUECO ABIERTO — y bajar toxicity a cero es gratis del todo: «bajar es libre»', () => {
    const p = proc('lavar-el-hongo', {
      roles: [{ name: 'comida', where: [{ q: 'toxicity', op: '>', v: 0 }] }],
      effects: [{ k: 'drive', q: 'toxicity', on: 'comida', toward: 0, perTick: 0.1 }],
      completion: { at: 10, yields: [] },
      establishes: ['toxicity<=0'],
    })
    const v = admit(p, phys)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)

    // ── DEBERÍA (y acá el adversario reconoce que es discutible): «bajar es
    //    libre» está escrito y defendido en `admit.ts`. Pero la mitad del premio
    //    de cocinar el hongo es justamente bajarle la toxicidad, y esto lo
    //    regala sin fuego y sin costo. Queda anotado como consecuencia, no como
    //    bug de una línea.
    expect(v.ok).toBe(false)
  })
})

// ═══ HUECO 5 · la envolvente por tag se compra con un tag ═══════════════════

describe('HUECO · el oráculo inventa comida agregando un tag', () => {
  it.fails('HUECO ABIERTO — la misma piedra de pan entra si además se declara `organico`', () => {
    // La envolvente de un conjunto de tags es la UNIÓN, «porque los tags no son
    // excluyentes: el hueso es organico y mineral a la vez». Cierto. Y por eso
    // el techo de `nutrition` de cualquier cosa que se declare `organico` es el
    // de la grasa (22 × 1.5 = 33), venga con el tag que venga.
    const pan = sustancia('piedra-de-pan-2', ['mineral', 'organico'], {
      nutrition: 20,
      digestibility: 0.9,
      rigidity: 0.9,
    }, 0.8)
    const v = admitSubstance(pan, phys)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)

    // ── DEBERÍA: el test de la casa afirma «ni el oráculo puede inventar piedra
    //    nutritiva». Con un tag de más, puede.
    expect(v.ok).toBe(false)
  })

  it.fails('HUECO ABIERTO — y madera que alimenta, sin salirse de la envolvente vegetal', () => {
    // El grano es `organico+vegetal` con nutrition 13, así que el techo vegetal
    // es 19.5. Una sustancia leñosa —fibrosa, rígida, con el fuelEnergy de la
    // madera— con nutrition 13 y digestibility 0.6 entra sin una razón en contra.
    const tronco = sustancia('tronco-de-pan', ['organico', 'vegetal', 'fibroso'], {
      nutrition: 13,
      digestibility: 0.6,
      fuelEnergy: 18,
      ignitionPoint: 300,
      pyrolysisAt: 280,
      moisture: 0.25,
      rigidity: 0.7,
      tensile: 0.55,
      toughness: 0.6,
    }, 1.7)
    const v = admitSubstance(tronco, phys)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)

    // ── DEBERÍA: `sustancias.ts` promete «NO PUEDE inventar madera nutritiva, y
    //    no porque una lista lo impida». La envolvente derivada no lo impide.
    expect(v.ok).toBe(false)
  })
})

// ═══ HUECO 6 · la no-dominancia no cubre pescar más barato ══════════════════

describe('HUECO · pescar sin caña y pescar treinta veces más rápido', () => {
  it.fails('HUECO ABIERTO — sacar del stock con la mano: mismo rendimiento, sin aparejo', () => {
    const p = proc('manotazo', {
      roles: [{ name: 'source', where: [{ q: 'mass', op: '>', v: 0 }] }],
      arrangement: { k: 'within', radius: 1 },
      completion: { at: 1, yields: [{ k: 'drawFromStock', of: 'source', into: 'hands' }] },
      establishes: ['holding(tag:carnoso)'],
    })
    const v = admit(p, phys)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)

    // ── DEBERÍA: promete lo mismo que `extraccion` y no pide el aparejo. La
    //    no-dominancia no lo ve porque `exigeMenosOIgual` arranca comparando la
    //    CANTIDAD de roles, y sacarle un rol al proceso lo vuelve incomparable.
    expect(tieneCodigo(v, 'dominancia')).toBe(true)
  })

  it.fails('HUECO ABIERTO — o el clon exacto de `extraccion` que termina en 1 tick en vez de 30', () => {
    const p: Process = { ...EXTRACCION, id: 'extraccion-rapida', completion: { at: 1, yields: EXTRACCION.completion!.yields } }
    const v = admit(p, phys)
    expect(codigos(v)).toEqual([])
    expect(v.ok).toBe(true)

    // La no-dominancia compara SALDOS de cuentas conservadas, y los dos valen 0
    // en las cuatro: sin efectos que cuesten, «más barato» es invisible.
    for (const q of ['mass', 'nutrition', 'stamina', 'fuelEnergy'] as const) {
      expect([q, saldoDeclarado(p, q, phys), saldoDeclarado(EXTRACCION, q, phys)]).toEqual([q, 0, 0])
    }

    // ── DEBERÍA: treinta veces más pescado por tick es la misma técnica con el
    //    precio bajado a mano, que es justo lo que la regla de dominancia dice
    //    que existe para atajar. `completion.at` no entra en la comparación.
    expect(tieneCodigo(v, 'dominancia')).toBe(true)
  })
})

// ═══ HUECO 7 · el redondeo del punto fijo, una milésima por vuelta ═════════

describe('HUECO · partir en dos y quedarse con más', () => {
  it.fails('HUECO ABIERTO — la mitad de 0.001 es 0.001, y `split` no tiene piso de masa', () => {
    // `fixed.ts` redondea las mitades ALEJÁNDOSE del cero, y lo hace por una
    // buena razón (la simetría de signo, para que enfriarse sea calentarse con
    // el signo cambiado). El precio es este: cerca del piso de resolución,
    // partir conserva de más.
    expect(unfx(fdiv(fx(0.001), fx(2)))).toBeCloseTo(0.001, 9) // media unidad → una unidad
    expect(unfx(fdiv(fx(0.003), fx(2)))).toBeCloseTo(0.002, 9) // 1.5 → 2

    // Dos mitades de un cuerpo de masa 0.001 pesan 0.002: la masa se DUPLICA
    // por vuelta, y `deshilachar` es exactamente un `split` que se puede repetir.
    const mitad = fdiv(fx(0.001), fx(2))
    expect(unfx(mitad + mitad)).toBeCloseTo(0.002, 9)

    // Y la puerta no tiene nada que decir: ninguna regla le pone masa mínima al
    // rol de un `split`, y no existe código de rechazo para eso.
    const p = proc('desmenuzar', {
      roles: [{ name: 'source', where: [{ q: 'tensile', op: '>=', v: 0.3 }] }],
      completion: { at: 2, yields: [{ k: 'split', role: 'source', at: 'grain' }] },
      establishes: ['flexibility>=0.8'],
    })
    expect(admit(p, phys).ok).toBe(true)

    // ── DEBERÍA: o el `split` exige masa suficiente para que partir no gane
    //    materia, o la aritmética de partir trunca hacia cero. Hoy no hace ninguna.
    expect(unfx(mitad + mitad)).toBeCloseTo(0.001, 9)
  })
})
