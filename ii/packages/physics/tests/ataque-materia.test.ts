// ─── ATAQUE · crear masa o nutrición de la nada ──────────────────────────────
//
// Este archivo lo escribió un adversario. Cada `it` es un intento de colar por
// `admit()` un proceso —o una sustancia— que fabrica materia o comida donde no
// la había. No hay ni un arreglo acá: el trabajo era ENCONTRAR, y arreglar
// borraría la evidencia.
//
// CÓMO SE LEE
//
//   · `it(...)` normal        → la puerta RECHAZA el intento. El test afirma el
//                               rechazo y queda como regresión: si mañana alguien
//                               afloja esa regla, esto se pone rojo.
//   · `it.fails(...)`         → HUECO QUE SIGUE ABIERTO. El cuerpo del test afirma
//     con «SIGUE ABIERTO»       lo que la puerta DEBERÍA contestar y todavía no
//     en el nombre              contesta. Vitest lo cuenta como esperado-que-falle.
//                               Ninguno de estos afirma la conducta rota como si
//                               fuera correcta, y cada uno trae escrito POR QUÉ
//                               sigue abierto.
//
// Los huecos encontrados, en orden de gravedad, y en qué terminaron:
//
//   1. CERRADO · `transfer` no tenía control de CANTIDAD. Un `drain` que gasta
//      más de lo que el rol garantiza cobra el reparo
//      `costo-mayor-que-la-garantia`; un `transfer` que movía mil veces más no
//      cobraba nada. Con eso se llenaba de nutrición un tronco desde una hoja.
//   2. CERRADO EN LA PUERTA · `nutrition` es INTENSIVA (por unidad de masa) y la
//      regla 1 nunca comparaba el producto `q · mass`. `quality.ts` lo dice con
//      todas las letras. Ahora lo compara, y cuando la masa del rol no está
//      acotada rechaza por indecidible. Lo que la puerta NO puede hacer es
//      cambiar lo que dos cuerpos ya pesan: ver el hueco de más abajo.
//   3. CERRADO · `respalda()` devuelve `true` para `mass` SIEMPRE, y sigue siendo
//      cierto que todo cuerpo tiene masa. Lo que se agregó es CUÁNTA: la cota del
//      rol. Mover 10 000 desde un guijarro que no promete un gramo se rechaza.
//   4. CERRADO · un proceso podía empujar una cualidad DERIVADA. El código tenía
//      el motivo («no se guarda») y hasta el código `cualidad-derivada`, pero lo
//      usaba solo en `admitSubstance`. Con un `drive` de `catch` una piedra
//      pescaba.
//   5. ABIERTO · el costo del `poweredBy` se mide en las unidades de la cualidad
//      EMPUJADA. Subir 385 °C cuesta 1100 de stamina; subir `digestibility` de 0
//      a 1 cuesta 1. La puerta no tiene con qué convertir una en otra.
//   6. ABIERTO · la envolvente por tag es la UNIÓN de los tags. Agregarle
//      `organico` a una piedra le sube el techo de `nutrition` de 0 a 33.
//   7. CERRADO · la no-dominancia exigía que los dos procesos tuvieran los MISMOS
//      nombres de rol y no miraba `completion.at`. Pescar sin caña, o pescar en un
//      tick en vez de treinta, no dominaba a nadie.
//   8. ABIERTO · el punto fijo redondea las mitades ALEJÁNDOSE del cero, y nada
//      le pone piso de masa a un `split`: partir en dos algo de masa 0.001 da
//      0.002. Eso es aritmética de `fixed.ts`, no una regla de la puerta.

import { describe, expect, it } from 'vitest'
import { admit, admitSubstance, consumedRoles, saldoDeclarado, tieneCodigo, tieneReparo, type Verdict } from '../src/admit.js'
import { buildSeedPhysics } from '../src/physics.js'
import { EXTRACCION, PHYSICS_VERSION, type Process } from '../src/process.js'
import type { Substance } from '../src/substance.js'
import { qualityOf, type Body } from '../src/body.js'
import { fadd, fdiv, fx, unfx } from '../src/fixed.js'

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

// ═══ HUECO 1 · el `transfer` no tenía control de cantidad ══════════════════

describe('CERRADO · transferir más de lo que el origen tiene', () => {
  /**
   * Una hoja (nutrition 2) pegada a un tronco, y 90 de nutrición por tick
   * durante 60 ticks: 5400 unidades salidas de un rol que solo garantiza
   * «más que cero».
   *
   * La regla 1 miraba si el origen RESPALDA la cualidad —sí, todas las
   * candidatas traen nutrition > 0— y no miraba nunca CUÁNTA. La regla 2 sí tenía
   * ese control (`costo-mayor-que-la-garantia`) pero solo lo corría sobre `drive`
   * y `drain`.
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

  it('CERRADO — mover 90 de nutrition desde un rol que garantiza «> 0» se rechaza', () => {
    const v = admit(ENGORDAR, phys)
    expect(v.ok).toBe(false)

    // Y con los dos números, que es lo que la fragua puede corregir: mueve 90 y
    // el rol garantiza cero, porque «mayor que cero» garantiza cero.
    const r = v.razones.find((x) => x.codigo === 'conservacion-transfer')!
    expect(r.regla).toBe(1)
    expect(r.q).toBe('nutrition')
    expect(r.encontrado).toBe(90)
    expect(r.cota).toBe(0)
  })

  it('CERRADO — y no consume NADA: por eso hace falta que TERMINE alguna vez', () => {
    // `consumedRoles` se deriva de los rendimientos, y este proceso no tiene
    // ninguno: nada se gasta. Sin `completion`, el efecto corre mientras el
    // arreglo se sostenga, o sea `perTick × ∞`. Un proceso sin completion que
    // solo GASTA es legítimo (`friccion` es exactamente eso); uno que ACREDITA
    // una cuenta conservada sin consumir nada, no.
    expect(consumedRoles(ENGORDAR)).toEqual([])
    const v = admit(ENGORDAR, phys)
    expect(v.ok).toBe(false)
    expect(v.razones.some((r) => r.mensaje.includes('completion'))).toBe(true)
  })

  it('CERRADO — y el saldo del lazo consigo mismo dejó de dar 0: el transfer ya no se ASUME conservativo', () => {
    // El proceso promete `nutrition>=90` y su propio rol `donante` pide
    // `nutrition > 0`: se habilita a sí mismo y la regla 5 encuentra el lazo.
    // Antes lo dejaba pasar, porque `saldoDeclarado` le creía al `transfer`:
    // sumaba el crédito y restaba el débito por el mismo número. Ahora el débito
    // está topado por lo que el rol garantiza, que son cero.
    //
    // OJO, Y HAY QUE DECIRLO: el adversario había escrito acá
    // `toBeLessThan(0)` —esperaba que el saldo se volviera NEGATIVO— y ése es el
    // signo equivocado. Un proceso que acredita 90 donde el origen respalda 0 no
    // gasta: CREA 90, y el saldo tiene que dar +90. El signo importa porque es el
    // que hace que la regla 5 vea el lazo: con saldo negativo el ciclo suma
    // negativo y pasa limpio, que era exactamente el ataque. La afirmación se
    // corrigió al signo correcto, y el test de al lado
    // (`ciclo-rentable`) es la prueba de que ese signo es el que sirve.
    expect(saldoDeclarado(ENGORDAR, 'nutrition', phys)).toBe(90)
    expect(tieneCodigo(admit(ENGORDAR, phys), 'ciclo-rentable')).toBe(true)
  })

  it.fails('SIGUE ABIERTO — nutrition es INTENSIVA: los mismos «9» en un tronco de 100 son 57 veces más comida', () => {
    // POR QUÉ SIGUE ABIERTO: este test no es sobre la puerta. Las tres primeras
    // afirmaciones miden dos CUERPOS con `qualityOf`, y la última pide que 18 sea
    // menor o igual que 0.315. Ninguna regla de `admit()` puede cambiar lo que
    // pesan dos cuerpos que ya existen: eso es `body.ts`.
    //
    // Lo que la puerta SÍ hace ahora es no dejar entrar el proceso que movería
    // esos 9 —`magnitud-intensiva`, y el test de acá arriba lo comprueba—, que es
    // todo lo que una puerta puede hacer. El día que se quiera que un `transfer`
    // de intensiva reescale el número por la razón de masas, eso es una ley del
    // mundo y va en `leyes.ts`, no acá.
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

// ═══ HUECO 2 · la masa se movía sin que nadie la contara ═══════════════════

describe('CERRADO · transferir masa desde un guijarro', () => {
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

  it('CERRADO — 10 000 de masa desde un rol que no promete ni un gramo', () => {
    // `respalda()` sigue cortando en seco con `if (q === 'mass') return true`, y
    // sigue siendo cierto: la masa la tiene todo cuerpo por definición. Lo que no
    // se seguía de ahí es que tenga DIEZ MIL. La respuesta no era sacarle el
    // atajo a `respalda` —un cuerpo de masa cero no es un cuerpo— sino separar
    // las dos preguntas: `respalda` contesta «de dónde» y la cota del rol
    // contesta «cuánto».
    const v = admit(TRASVASE, phys)
    expect(v.ok).toBe(false)
    const r = v.razones.find((x) => x.codigo === 'conservacion-transfer')!
    expect(r.q).toBe('mass')
    expect(r.encontrado).toBe(10000)
    expect(r.cota).toBe(0)
  })

  it('CERRADO — y el saldo lo dice: crea 10 000 de masa por corrida', () => {
    expect(saldoDeclarado(TRASVASE, 'mass', phys)).toBe(10000)
  })
})

// ═══ HUECO 3 · empujar una cualidad DERIVADA ═══════════════════════════════

describe('CERRADO · un drive sobre una cualidad que no se guarda', () => {
  /**
   * `catch` es derivada: sale de `freeStrandEnds · (0.15 + sharpness·0.5)`, o
   * sea de la GEOMETRÍA del ensamble. Es lo único que separa una piedra de una
   * caña, y por lo tanto lo único que separa a la criatura de la comida.
   *
   * `admitSubstance` rechazaba que una sustancia declare una derivada, con el
   * código `cualidad-derivada` y el motivo escrito. `reglaCierreYCotas` miraba si
   * la cualidad está en el catálogo —y una derivada lo está— y no miraba si es
   * derivada. Un `drive` de `catch` entraba.
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

  it('CERRADO — una piedra con `catch` 8 y `reach` 16 ya no califica para `extraccion` sin atar nada', () => {
    const v = admit(AGARRE_MAGICO, phys)
    expect(v.ok).toBe(false)

    // Lo que habilitaba es literalmente pescar: `extraccion` pide reach ≥ 2 y
    // catch > 0 sobre el aparejo, que es todo lo que este proceso regalaba.
    expect(EXTRACCION.roles.find((r) => r.name === 'gear')?.where).toEqual([
      { q: 'reach', op: '>=', v: 2 },
      { q: 'catch', op: '>', v: 0 },
    ])

    // `cualidad-derivada` existía como código de rechazo y ahora se lo lleva.
    // Una derivada no se escribe: se calcula.
    expect(tieneCodigo(v, 'cualidad-derivada')).toBe(true)
    // Y por partida doble, porque también PROMETE lo que no puede hacer: `reach`
    // es geometría pura y solo la cambia un rendimiento.
    expect(tieneCodigo(v, 'promesa-derivada')).toBe(true)
  })

  it('CERRADO — y tampoco se puede empujar `calories`, que ES la comida', () => {
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
    // `calories = nutrition · mass · digestibility` y nutrition es conservada.
    // Empujar el resultado era saltearse la conservación por la puerta de atrás.
    expect(v.ok).toBe(false)
    expect(tieneCodigo(v, 'cualidad-derivada')).toBe(true)
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

  it.fails('SIGUE ABIERTO — llevar digestibility a 1 sale 1 de stamina y no lo frena nadie', () => {
    // POR QUÉ SIGUE ABIERTO, y es una decisión, no un olvido: la puerta no tiene
    // ninguna tabla que diga cuánta stamina vale un punto de `digestibility`. Ese
    // número es CALIBRACIÓN —lo mismo que `EMISSION_PER_FUEL` o la eficiencia
    // 0.35 de `friccion`—, y la puerta no calibra: juzga contra lo que ya está
    // calibrado. Las dos salidas que se probaron y se descartaron:
    //
    //   · pedir cierre dimensional entre la cualidad empujada y la cuenta que
    //     paga (como hace el `couple`). Mata a `friccion`: `temperature` es
    //     intensiva y `stamina` extensiva, y ésa es la técnica del primer fuego.
    //   · normalizar el trabajo por el rango de la cualidad. Es inventar una
    //     constante de conversión adentro del juez, que es exactamente el número
    //     libre que este paquete no quiere tener.
    //
    // Lo que sí se cerró de este agujero es la mitad que sí era de la puerta: el
    // costo ahora escala con la MASA que se empuja (`masaQuePaga`), así que
    // ablandar un tronco cuesta más que ablandar un bocado. La conversión entre
    // cualidades sigue sin existir, y hasta que exista esto entra.
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

  it.fails('SIGUE ABIERTO — y bajar toxicity a cero es gratis del todo: «bajar es libre»', () => {
    // POR QUÉ SIGUE ABIERTO: «bajar es libre» está escrito y defendido en
    // `admit.ts`, y tiene su propio test verde (`bajar es libre: enfriar no
    // necesita declarar de dónde saca nada`). Sacarlo obligaría a que enfriar
    // pague, y enfriarse es lo que hace el mundo solo cada tick.
    //
    // El adversario ya lo anota como discutible abajo. Lo que la reparación SÍ
    // tocó de esta familia es el caso en que «bajar» era mentira: un `drive`
    // hacia el umbral del propio rol cuando el proceso se lleva la cualidad por
    // abajo (ver `pisoEfectivo` y el agujero 5 de `ataque-energia`). Acá no hay
    // nada de eso: el proceso baja la toxicidad y punto. Que eso sea la mitad del
    // premio de cocinar es una decisión de calibración, y va con su ADR.
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

describe('SIGUE ABIERTO · el oráculo inventa comida agregando un tag', () => {
  it.fails('SIGUE ABIERTO — la misma piedra de pan entra si además se declara `organico`', () => {
    // POR QUÉ SIGUE ABIERTO: esto no es la puerta de los PROCESOS, es
    // `admitSubstance`, y la unión de envolventes es una decisión de la regla 3
    // con su motivo escrito y su propio test verde. Cambiarla por la
    // intersección (el mínimo de los techos de sus tags) cerraría este ataque
    // —el techo mineral de `nutrition` es exactamente 0— y NO puede rechazar
    // ninguna sustancia que ya esté en el catálogo, porque cada envolvente se
    // calcula incluyéndola. Pero rompe el test `algo organico no puede tener el
    // poder calorífico del plutonio`, que fija la cota en 45 (el techo orgánico)
    // y con intersección sería 31.5 (el vegetal). Ese 45 es una calibración
    // declarada, y moverla es un ADR, no una reparación de la puerta.
    //
    // Queda medido y anotado: la reparación de las seis causas no lo tocaba.
    //
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

  it.fails('SIGUE ABIERTO — y madera que alimenta, sin salirse de la envolvente vegetal', () => {
    // POR QUÉ SIGUE ABIERTO, y éste es más profundo que el de arriba: la
    // envolvente es POR CUALIDAD, y este ataque no se sale de ninguna. Sus
    // números son todos plausibles por separado; lo implausible es la
    // COMBINACIÓN —nutrición de grano con rigidez y fibra de tronco—, y para
    // rechazar eso hace falta una envolvente conjunta (una correlación entre
    // pares de cualidades derivada del catálogo), que es una regla 3 nueva y no
    // una reparación de las seis causas. Queda medido.
    //
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

// ═══ HUECO 6 · la no-dominancia no cubría pescar más barato ════════════════

describe('CERRADO · pescar sin caña y pescar treinta veces más rápido', () => {
  it('CERRADO — sacar del stock con la mano: mismo rendimiento, sin aparejo', () => {
    const p = proc('manotazo', {
      roles: [{ name: 'source', where: [{ q: 'mass', op: '>', v: 0 }] }],
      arrangement: { k: 'within', radius: 1 },
      completion: { at: 1, yields: [{ k: 'drawFromStock', of: 'source', into: 'hands' }] },
      establishes: ['holding(tag:carnoso)'],
    })
    const v = admit(p, phys)
    expect(v.ok).toBe(false)

    // Promete lo mismo que `extraccion` y no pide el aparejo. La no-dominancia no
    // lo veía porque `exigeMenosOIgual` arrancaba comparando la CANTIDAD de
    // roles, y sacarle un rol al proceso lo volvía incomparable — cuando sacarle
    // un rol es la forma más pura de exigir menos.
    expect(tieneCodigo(v, 'dominancia')).toBe(true)
  })

  it('CERRADO — o el clon exacto de `extraccion` que termina en 1 tick en vez de 30', () => {
    const p: Process = { ...EXTRACCION, id: 'extraccion-rapida', completion: { at: 1, yields: EXTRACCION.completion!.yields } }
    const v = admit(p, phys)
    expect(v.ok).toBe(false)

    // La no-dominancia compara SALDOS de cuentas conservadas, y los dos siguen
    // valiendo 0 en las cuatro: sin efectos que cuesten, «más barato» en materia
    // es invisible. Lo que cambió es que el TIEMPO también es precio.
    for (const q of ['mass', 'nutrition', 'stamina', 'fuelEnergy'] as const) {
      expect([q, saldoDeclarado(p, q, phys), saldoDeclarado(EXTRACCION, q, phys)]).toEqual([q, 0, 0])
    }

    // Treinta veces más pescado por tick es la misma técnica con el precio bajado
    // a mano, que es justo lo que la regla de dominancia existe para atajar.
    const r = v.razones.find((x) => x.codigo === 'dominancia')!
    expect(r.proceso).toBe('extraccion')
    expect(r.encontrado).toBe(1)
    expect(r.cota).toBe(30)
  })
})

// ═══ HUECO 7 · el redondeo del punto fijo, una milésima por vuelta ═════════

describe('SIGUE ABIERTO · partir en dos y quedarse con más', () => {
  it.fails('SIGUE ABIERTO — la mitad de 0.001 es 0.001, y `split` no tiene piso de masa', () => {
    // POR QUÉ SIGUE ABIERTO: la afirmación final de este test es sobre
    // `fixed.ts`, no sobre la puerta. Pide que `fdiv(fx(0.001), fx(2))` sumado
    // consigo mismo dé 0.001, o sea que el punto fijo redondee las mitades HACIA
    // el cero — y redondea alejándose por una razón defendida y con su propio
    // test verde: la simetría de signo, para que enfriarse sea calentarse con el
    // signo cambiado. `admit()` no puede cambiar eso.
    //
    // Las dos salidas reales están fuera de esta reparación: o `split` exige masa
    // mínima (una regla nueva con un número de calibración adentro), o la
    // aritmética de partir trunca hacia cero (un cambio en `fixed.ts` que toca la
    // simetría). Las dos merecen ADR.
    //
    // Lo que sí cambió: `desmenuzar` ya no entra. No por la masa, sino porque es
    // un clon barato de `deshilachar` —mismo `split at grain`, sin actor, sin
    // stamina y en 2 ticks en vez de 40— y la no-dominancia reparada lo ve.
    // `fixed.ts` redondea las mitades ALEJÁNDOSE del cero, y lo hace por una
    // buena razón (la simetría de signo, para que enfriarse sea calentarse con
    // el signo cambiado). El precio es este: cerca del piso de resolución,
    // partir conserva de más.
    expect(unfx(fdiv(fx(0.001), fx(2)))).toBeCloseTo(0.001, 9) // media unidad → una unidad
    expect(unfx(fdiv(fx(0.003), fx(2)))).toBeCloseTo(0.002, 9) // 1.5 → 2

    // Dos mitades de un cuerpo de masa 0.001 pesan 0.002: la masa se DUPLICA
    // por vuelta, y `deshilachar` es exactamente un `split` que se puede repetir.
    const mitad = fdiv(fx(0.001), fx(2))
    expect(unfx(fadd(mitad, mitad))).toBeCloseTo(0.002, 9)

    // Y sobre la MASA la puerta sigue sin tener nada que decir: ninguna regla le
    // pone masa mínima al rol de un `split`, y no existe código de rechazo para
    // eso. (Este proceso igual no entra, pero por dominancia: ver arriba.)
    const p = proc('desmenuzar', {
      roles: [{ name: 'source', where: [{ q: 'tensile', op: '>=', v: 0.3 }] }],
      completion: { at: 2, yields: [{ k: 'split', role: 'source', at: 'grain' }] },
      establishes: ['flexibility>=0.8'],
    })
    expect(codigos(admit(p, phys)).includes('dominancia')).toBe(true)

    // ── DEBERÍA: o el `split` exige masa suficiente para que partir no gane
    //    materia, o la aritmética de partir trunca hacia cero. Hoy no hace ninguna.
    expect(unfx(fadd(mitad, mitad))).toBeCloseTo(0.001, 9)
  })
})
