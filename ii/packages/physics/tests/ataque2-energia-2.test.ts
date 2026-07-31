// ─── Ataque adversario · SEGUNDA VUELTA SOBRE LA ENERGÍA ─────────────────────
//
// La puerta se reparó por seis causas raíz. Este archivo va a los BORDES de esas
// reparaciones, con una sola lente: sacar energía de la nada sabiendo ya cómo
// están escritos los controles nuevos.
//
// Lo que se buscó, en el orden en que lo pidió el encargo:
//
//   · los bordes de `reglaAcoplesYTransferencias` (couple y transfer);
//   · cadenas de tres o más procesos donde ninguno solo es rentable;
//   · efectos que se cancelan en el papel y no en el mundo;
//   · el saldo que depende del ESTADO DEL MUNDO y no del proceso.
//
// CÓMO SE LEE ESTE ARCHIVO
//
//   `it(...)`        la puerta hizo lo CORRECTO. O rechazó el ataque, o dejó
//                    entrar algo legítimo. Queda como regresión.
//
//   `it(«CERRADO»)`  era un `it.fails` y la reparación lo tapó. El cuerpo del test
//                    no cambió ni una línea: lo único que cambió es que ahora pasa.
//
// LOS SIETE ESTÁN CERRADOS. Lo que los cerró, uno por uno:
//
//   A → `entraDe` pasa por `respalda`: de una piedra no entra aliento aunque el rol
//       se lo escriba, y el camino del consumo era el único que no lo preguntaba.
//   B → presupuesto ACUMULADO en la regla 1: lo que entra una vez ya no paga N veces.
//   C → `techoQueEscribeElAcople` lee `inverse` y compara contra el ESPEJO del piso
//       de lo seguido. Un acople inverso honesto —el que sigue a algo garantizado
//       arriba— sigue entrando.
//   D → el calor específico entra en la cuenta del `transfer` de temperatura, y solo
//       cuando se puede AFIRMAR: los dos roles pinchados y los dos conjuntos de
//       candidatas separados. Si se solapan no se cobra, y por eso `asar` pasa.
//   E → `transferencia-eterna`: un `transfer` sin `completion` corre `porSegundo × ∞` y
//       la puerta juzga cantidades por corrida. Vale para toda cualidad, no solo
//       para las conservadas.
//   F → `promesasEfectivas` lee también `transfer` y `couple`: quien propone ya no
//       elige si su proceso se deja mirar por la regla 5.
//   G → `masaQuePaga` cobra por el TECHO cuando el rol lo declara. Sin ninguna cota
//       se sigue cobrando por una unidad, y eso queda declarado.
//
// ─── LOS SIETE AGUJEROS QUE ESTA VUELTA ENCONTRÓ ────────────────────────────
//
//   A. LA PIEDRA-BATERÍA POR CONSUMO. `respalda()` / `pinaLaMateria()` existen
//      exactamente para que escribirle `stamina >= 100` al rol de una PIEDRA no
//      pague trabajo. Pero `respalda()` NO se llama nunca en el camino del
//      `drive` sobre una conservada: la regla 1 usa `entraDe()`, que lee la cota
//      del rol y nada más, y la regla 2 abre con `if (esConservada) continue`.
//      Consumir la piedra con un `transmute` y acreditarle la stamina al actor
//      entra limpio. La MISMA cuenta hecha con `transfer` se rechaza.
//
//   B. EL DOBLE GASTO. La regla 1 compara CADA efecto contra el total que entra,
//      nunca la SUMA de los efectos. Con una entrada de 100 de stamina, dos
//      `drive` de 100 sobre dos cuerpos distintos pasan los dos.
//
//   C. EL COUPLE INVERSO QUE NADIE MIRA. `inverse` no aparece ni una vez en
//      `admit.ts`. El control nuevo pregunta si el TECHO de lo seguido entra por
//      debajo del piso de lo que sigue; con `inverse`, cuanto MÁS BAJO está lo
//      seguido más ALTO sube lo que sigue, así que la prueba está dada vuelta.
//      Un rol que pide `temperature <= -100` pasa el control y prende el mundo.
//
//   D. EL CALOR ESPECÍFICO. `revisarIntensivaTransfer` compara `ΔT · masa`. La
//      energía es `masa · calor específico · ΔT`, y `specificHeat` está en cada
//      sustancia del catálogo. Mover 200 grados de un pedernal a un cuerpo de
//      agua de la misma masa multiplica la energía por casi cinco.
//
//   E. EL TRANSFER SIN COMPLETION QUE NO ES CONSERVADO. La reparación 5 obliga a
//      declarar `completion` al `transfer` que acredita una CONSERVADA. La
//      temperatura no es conservada y es energía igual: sin `completion` el
//      efecto corre `porSegundo × ∞` y la puerta lo juzgó por un tick.
//
//   F. EL LAZO INVISIBLE. La regla 5 arma su grafo con `promesasEfectivas`, que
//      lee `establishes` y los `drive`. Un `transfer` y un `couple` no prometen
//      NADA, así que un proceso que solo transfiere no tiene aristas de salida y
//      queda fuera de todo ciclo. Medido: el mismo par de procesos es invisible
//      sin `establishes` y forma ciclo con `establishes`. La reparación 6 cerró
//      esto para los `drive` («borrar un string ya no borra una arista») y lo
//      dejó abierto para las otras dos formas de mover el mundo.
//
//   G. `mass <= x` EN VEZ DE `mass >= x`. `masaQuePaga` cobra por la masa
//      GARANTIZADA. Un rol que declara `mass <= 5000` no garantiza nada, así que
//      se cobra por una unidad: frotar la montaña vuelve a costar lo que frotar
//      el guijarro, con un operador cambiado. Está DECLARADO como subestimación
//      en el comentario de `masaQuePaga`, pero el resultado medido es el mismo
//      ataque que la causa 3 dice haber cerrado, y la asimetría con
//      `revisarIntensiva` —que ante la misma falta de cota RECHAZA por
//      indecidible— no está justificada en ningún lado.

import { describe, expect, it } from 'vitest'
import { admit, ciclosPor, saldoDeclarado, tieneCodigo, type Verdict } from '../src/admit.js'
import { buildSeedPhysics } from '../src/physics.js'
import {
  FRICCION,
  PHYSICS_VERSION,
  SEED_PROCESSES,
  type Process,
  type Role,
} from '../src/process.js'
import { HZ_DE_REFERENCIA, seg } from '../src/fixed.js'
import { SUSTANCIAS_SEMILLA } from '../src/data/sustancias.js'

const phys = buildSeedPhysics()

/** Un proceso mínimo y legal al que colgarle el ataque. */
const proceso = (id: string, extra: Partial<Process> = {}): Process => ({
  id,
  lexeme: { nombre: id },
  roles: [{ name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] }],
  arrangement: { k: 'contact' },
  gate: [],
  effects: [],
  establishes: [],
  commitment: 'reversible',
  trust: 'borrador',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'modelo' },
  ...extra,
})

/** Para poder citar el número en el reporte y no afirmarlo de memoria. */
const calorEspecifico = (id: string): number => {
  const s = SUSTANCIAS_SEMILLA.find((x) => x.id === id)
  if (s === undefined) throw new Error(`no existe la sustancia ${id}`)
  return s.specificHeat
}

const porQueEntro = (v: Verdict): string => v.razones.map((r) => r.codigo).join(', ')

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE 0 · LA REGLA DE ORO
// Una puerta que rechaza todo es trivialmente segura y completamente inútil.
// ═══════════════════════════════════════════════════════════════════════════════

describe('la regla de oro: los cuatro semilla siguen entrando', () => {
  for (const p of SEED_PROCESSES) {
    it(`«${p.id}» entra sin una sola razón en contra`, () => {
      const v = admit(p, phys)
      expect(porQueEntro(v)).toBe('')
      expect(v.ok).toBe(true)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE I · AGUJERO A · LA PIEDRA-BATERÍA POR CONSUMO
// ═══════════════════════════════════════════════════════════════════════════════

/** El rol de una piedra que además dice tener aliento. El ataque entero. */
const PIEDRA_CON_ALIENTO: Role = {
  name: 'piedra',
  where: [
    { q: 'rigidity', op: '>=', v: 0.9 },
    // `>` y no `>=` a propósito: `cotasDeRol` cuenta 100 igual para lo que ENTRA,
    // y en cambio la promesa `stamina>=100` del propio drive ya no satisface este
    // test, así que el proceso no arma un lazo consigo mismo y la regla 5 —que es
    // la que atrapa esto por casualidad— no se entera.
    { q: 'stamina', op: '>', v: 100 },
  ],
}

const COMER_PIEDRA = proceso('comer-la-piedra', {
  roles: [PIEDRA_CON_ALIENTO, { name: 'actor', where: [] }],
  arrangement: { k: 'held' },
  effects: [{ k: 'drive', q: 'stamina', on: 'actor', toward: 100, porSegundo: 2000 }],
  completion: { at: seg(0.05), yields: [{ k: 'transmute', role: 'piedra' }] },
})

describe('agujero A · la piedra-batería vuelve por el camino del consumo', () => {
  it('CONTROL · la misma cuenta hecha con `transfer` sí se rechaza', () => {
    // Ésta es la mitad reparada: `respalda()` mira `pinaLaMateria()` y contesta
    // que una piedra no tiene aliento por mucho que el rol se lo escriba.
    const conTransfer = proceso('trasvasar-el-aliento-de-la-piedra', {
      roles: [PIEDRA_CON_ALIENTO, { name: 'actor', where: [] }],
      arrangement: { k: 'held' },
      effects: [{ k: 'transfer', q: 'stamina', from: 'piedra', to: 'actor', porSegundo: 2000 }],
      completion: { at: seg(0.05), yields: [] },
    })
    expect(tieneCodigo(admit(conTransfer, phys), 'conservacion-transfer')).toBe(true)
  })

  it('CONTROL · sin consumir nada, el mismo drive se rechaza por conservación', () => {
    const sinConsumir = proceso('aliento-de-la-nada', {
      roles: [PIEDRA_CON_ALIENTO, { name: 'actor', where: [] }],
      arrangement: { k: 'held' },
      effects: [{ k: 'drive', q: 'stamina', on: 'actor', toward: 100, porSegundo: 2000 }],
    })
    expect(tieneCodigo(admit(sinConsumir, phys), 'conservacion-drive')).toBe(true)
  })

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ ROTO · el mismo aliento imposible entra si en vez de moverlo se CONSUME.  ║
  // ║ `entraDe()` lee la cota del rol y no pregunta si ese rol puede tener la    ║
  // ║ cualidad; `respalda()` —que sí lo pregunta— no se llama en este camino, y  ║
  // ║ la regla 2 se saltea las conservadas de entrada. Comerse una piedra da     ║
  // ║ 100 de aliento.                                                           ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  it('CERRADO · consumir una piedra que «tiene» 100 de aliento paga el trabajo', () => {
    const v = admit(COMER_PIEDRA, phys)
    expect(v.ok).toBe(false)
  })

  it('MEDIDO · el saldo declarado sigue diciendo +100, y ése es el punto', () => {
    // `saldoDeclarado` resta lo que ENTRA, y de una piedra no entra aliento: cero.
    // O sea que el proceso declara CREAR 100 de una cuenta conservada, y ahora la
    // regla 1 lo dice con todas las letras en vez de dejarlo pasar.
    expect(saldoDeclarado(COMER_PIEDRA, 'stamina', phys)).toBe(100)
    expect(tieneCodigo(admit(COMER_PIEDRA, phys), 'conservacion-drive')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE II · AGUJERO B · EL DOBLE GASTO
// ═══════════════════════════════════════════════════════════════════════════════

const DOBLE_GASTO = proceso('repartir-el-mismo-aliento-dos-veces', {
  roles: [
    // Un donante honesto: nada de piedras. Solo pide aliento, que es la criatura.
    { name: 'donante', where: [{ q: 'stamina', op: '>', v: 100 }] },
    { name: 'a', where: [] },
    { name: 'b', where: [] },
  ],
  arrangement: { k: 'held' },
  effects: [
    { k: 'drive', q: 'stamina', on: 'a', toward: 100, porSegundo: 2000 },
    { k: 'drive', q: 'stamina', on: 'b', toward: 100, porSegundo: 2000 },
  ],
  completion: { at: seg(0.05), yields: [{ k: 'transmute', role: 'donante' }] },
})

describe('agujero B · la regla 1 mira efecto por efecto y nunca la suma', () => {
  it('CONTROL · un solo drive por 101 contra una entrada de 100 sí se rechaza', () => {
    const unoSolo = proceso('pasarse-por-uno', {
      ...DOBLE_GASTO,
      id: 'pasarse-por-uno',
      effects: [{ k: 'drive', q: 'stamina', on: 'a', toward: 101, porSegundo: 2020 }],
    })
    expect(tieneCodigo(admit(unoSolo, phys), 'conservacion-drive')).toBe(true)
  })

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ ROTO · dos drives de 100 contra la MISMA entrada de 100 pasan los dos.    ║
  // ║ La regla 1 compara `sale` de cada efecto contra `entraAqui`, y `entraAqui` ║
  // ║ es el presupuesto ENTERO cada vez. Con tres cuerpos de destino salen 300.  ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  it('CERRADO · entran 100 de aliento y salen 200, uno para cada cuerpo', () => {
    expect(admit(DOBLE_GASTO, phys).ok).toBe(false)
  })

  it('MEDIDO · el saldo declarado dice +100: entran 100 y salen 200', () => {
    // 200 acreditados menos los 100 que el donante garantiza, restados UNA vez y no
    // una por efecto. El saldo positivo es exactamente el aliento que se inventa.
    expect(saldoDeclarado(DOBLE_GASTO, 'stamina', phys)).toBe(100)
    const r = admit(DOBLE_GASTO, phys).razones.find((x) => x.codigo === 'conservacion-drive')
    expect([r?.encontrado, r?.cota]).toEqual([200, 100])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE III · AGUJERO C · EL COUPLE INVERSO
// ═══════════════════════════════════════════════════════════════════════════════

const BOMBA_INVERSA = proceso('el-hielo-que-calienta', {
  roles: [
    { name: 'olla', where: [] },
    // El único rol del mundo que pasa el control nuevo: lo más frío que la física
    // admite. Y con `inverse`, es el que más calienta.
    { name: 'hielo', where: [{ q: 'temperature', op: '<=', v: -100 }] },
  ],
  arrangement: { k: 'contact' },
  effects: [
    {
      k: 'couple',
      q: 'temperature',
      on: 'olla',
      follows: { q: 'temperature', of: 'hielo', inverse: true },
    },
  ],
})

describe('agujero C · el control del couple está dado vuelta cuando hay `inverse`', () => {
  it('CONTROL · el mismo acople sin rol frío se rechaza por sube-gratis', () => {
    const sinHielo = proceso('espejo-termico-otra-vez', {
      ...BOMBA_INVERSA,
      id: 'espejo-termico-otra-vez',
      roles: [
        { name: 'olla', where: [] },
        { name: 'hielo', where: [] },
      ],
    })
    expect(tieneCodigo(admit(sinHielo, phys), 'sube-gratis')).toBe(true)
  })

  it('CONTROL · y con el rol tibio (temperature <= 0) también', () => {
    const tibio = proceso('espejo-tibio', {
      ...BOMBA_INVERSA,
      id: 'espejo-tibio',
      roles: [
        { name: 'olla', where: [] },
        { name: 'hielo', where: [{ q: 'temperature', op: '<=', v: 0 }] },
      ],
    })
    expect(tieneCodigo(admit(tibio, phys), 'sube-gratis')).toBe(true)
  })

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ ROTO · «me caliento tanto como frío esté el otro». El control nuevo pide   ║
  // ║ que el TECHO de lo seguido entre por debajo del PISO de lo que sigue, y    ║
  // ║ eso es exactamente lo que cumple un cuerpo a −100. Con `inverse` puesto,   ║
  // ║ cumplir el control es la condición de subir al máximo. `inverse` no        ║
  // ║ aparece ni una vez en admit.ts.                                           ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  it('CERRADO · un acople inverso a lo más frío del mundo entra limpio', () => {
    expect(admit(BOMBA_INVERSA, phys).ok).toBe(false)
  })

  it('MEDIDO · y la cota que cita es el ESPEJO del piso de lo seguido', () => {
    // Con `inverse`, lo que se escribe es el espejo de lo seguido dentro de su
    // rango: `temperature ∈ [−100, 2000]` y el hielo garantiza estar en −100, o sea
    // que la olla puede llegar a 2000. Ése es el número que la puerta dice ahora.
    const r = admit(BOMBA_INVERSA, phys).razones.find((x) => x.codigo === 'sube-gratis')
    expect(r?.encontrado).toBe(2000)
    expect(r?.mensaje).toContain('al revés')
  })

  it('MEDIDO · y un acople inverso HONESTO sigue entrando: el que sigue a algo garantizado ARRIBA', () => {
    // La prueba de que esto no es «rechazar todo»: si el rol seguido garantiza estar
    // en su máximo, el espejo está en el mínimo y el acople provablemente solo baja.
    const honesto = proceso('enfriar-siguiendo-lo-mas-caliente', {
      roles: [
        { name: 'olla', where: [] },
        { name: 'brasa', where: [{ q: 'temperature', op: '>=', v: 2000 }] },
      ],
      effects: [
        {
          k: 'couple',
          q: 'temperature',
          on: 'olla',
          follows: { q: 'temperature', of: 'brasa', inverse: true },
        },
      ],
    })
    expect(porQueEntro(admit(honesto, phys))).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE IV · AGUJERO D · EL CALOR ESPECÍFICO
// ═══════════════════════════════════════════════════════════════════════════════
//
// `revisarIntensivaTransfer` compara `movido · masaMáxima(destino)` contra
// `disponible · masaGarantizada(origen)`. Con las dos masas clavadas en 1, la
// cuenta cierra. La energía no: es `masa · calor específico · ΔT`, y el calor
// específico del agua es 4.2 contra 0.75 del pedernal.

const ORIGEN_MINERAL: Role = {
  name: 'brasa',
  where: [
    { q: 'rigidity', op: '>=', v: 0.95 }, // solo piedra (0.8) y pedernal (0.75)
    { q: 'temperature', op: '>=', v: 500 },
    { q: 'mass', op: '>=', v: 1 },
    { q: 'mass', op: '<=', v: 1 },
  ],
}

const DESTINO_LIQUIDO: Role = {
  name: 'olla',
  where: [
    { q: 'rigidity', op: '<=', v: 0 }, // solo savia (3.9) y agua (4.2)
    { q: 'mass', op: '>=', v: 1 },
    { q: 'mass', op: '<=', v: 1 },
  ],
}

const BOMBA_DE_CALOR_ESPECIFICO = proceso('mojar-la-brasa', {
  roles: [ORIGEN_MINERAL, DESTINO_LIQUIDO],
  arrangement: { k: 'contact' },
  effects: [{ k: 'transfer', q: 'temperature', from: 'brasa', to: 'olla', porSegundo: 200 }],
  completion: { at: seg(1), yields: [] },
})

describe('agujero D · la cuenta del transfer intensivo no sabe de calor específico', () => {
  it('MEDIDO · el catálogo trae los dos números y la razón es de casi cinco', () => {
    const peorOrigen = Math.max(calorEspecifico('piedra'), calorEspecifico('pedernal'))
    const mejorDestino = Math.min(calorEspecifico('agua'), calorEspecifico('savia'))
    expect(peorOrigen).toBe(0.8)
    expect(mejorDestino).toBe(3.9)
    // 200 grados movidos: salen 200·1·0.8 = 160 de energía y entran 200·1·3.9 = 780.
    expect(200 * mejorDestino - 200 * peorOrigen).toBe(620)
  })

  it('CONTROL · sin cota de masa en el destino la puerta sí rechaza', () => {
    const sinCota = proceso('mojar-la-brasa-sin-cota', {
      ...BOMBA_DE_CALOR_ESPECIFICO,
      id: 'mojar-la-brasa-sin-cota',
      roles: [ORIGEN_MINERAL, { name: 'olla', where: [{ q: 'rigidity', op: '<=', v: 0 }] }],
    })
    expect(tieneCodigo(admit(sinCota, phys), 'magnitud-intensiva')).toBe(true)
  })

  it('CONTROL · y si el destino pesa más que el origen, también', () => {
    const ollaGrande = proceso('mojar-la-brasa-en-la-olla-grande', {
      ...BOMBA_DE_CALOR_ESPECIFICO,
      id: 'mojar-la-brasa-en-la-olla-grande',
      roles: [
        ORIGEN_MINERAL,
        {
          name: 'olla',
          where: [
            { q: 'rigidity', op: '<=', v: 0 },
            { q: 'mass', op: '<=', v: 100 },
          ],
        },
      ],
    })
    expect(tieneCodigo(admit(ollaGrande, phys), 'magnitud-intensiva')).toBe(true)
  })

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ ROTO · misma masa, mismos grados, casi cinco veces la energía. La puerta   ║
  // ║ tiene `specificHeat` en cada sustancia del catálogo —lo usa para armar     ║
  // ║ envolventes— y no lo mira al conservar. Repetido en ciclo, es una fogata   ║
  // ║ que se enciende sola.                                                     ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  it('CERRADO · mover 200 grados de pedernal a agua multiplica la energía por 4.9', () => {
    expect(admit(BOMBA_DE_CALOR_ESPECIFICO, phys).ok).toBe(false)
  })

  it('MEDIDO · la razón cita los dos calores específicos, que salen del catálogo', () => {
    const r = admit(BOMBA_DE_CALOR_ESPECIFICO, phys).razones.find(
      (x) => x.codigo === 'magnitud-intensiva',
    )
    // Se cobra con el par MENOS agresivo que sigue mostrando la violación: el peor
    // origen (0.8) contra el mejor destino que sigue siendo más pesado (3.9).
    expect(r?.mensaje).toContain('calor específico 0.8 contra 3.9')
    expect([r?.encontrado, r?.cota]).toEqual([200 * 3.9, 500 * 0.8])
  })

  it('MEDIDO · y solo se cobra cuando se puede AFIRMAR: si los dos conjuntos se solapan, no', () => {
    // `asar` mueve calor del fuego (cp ∈ [0.9, 2.8]) a la comida (cp ∈ [1.9, 3.9]).
    // Los dos conjuntos se solapan, así que existe un mundo donde no hay diferencia
    // que cobrar — y cobrarla sería inventar un número. Ésta es la línea que separa
    // la reparación de un «rechazar todo».
    const asar = proceso('asar-medido', {
      roles: [
        {
          name: 'fuego',
          where: [
            { q: 'fuelEnergy', op: '>=', v: 10 },
            { q: 'temperature', op: '>=', v: 300 },
            { q: 'mass', op: '>=', v: 1 },
          ],
        },
        {
          name: 'comida',
          where: [
            { q: 'nutrition', op: '>=', v: 1 },
            { q: 'mass', op: '<=', v: 3 },
          ],
        },
      ],
      arrangement: { k: 'within', radius: 1 },
      effects: [{ k: 'transfer', q: 'temperature', from: 'fuego', to: 'comida', porSegundo: 40 }],
      completion: { at: seg(2), yields: [{ k: 'transmute', role: 'comida' }] },
    })
    expect(porQueEntro(admit(asar, phys))).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE V · AGUJERO E · EL TRANSFER ETERNO QUE NO ES CONSERVADO
// ═══════════════════════════════════════════════════════════════════════════════

const CHUPAR_CALOR_PARA_SIEMPRE = proceso('el-sifon-de-calor', {
  roles: [ORIGEN_MINERAL, DESTINO_LIQUIDO],
  arrangement: { k: 'contact' },
  // Sin `completion`: mientras el arreglo se sostenga, esto corre.
  effects: [{ k: 'transfer', q: 'temperature', from: 'brasa', to: 'olla', porSegundo: 200 }],
})

describe('agujero E · el `completion` obligatorio solo alcanza a las conservadas', () => {
  it('CONTROL · el mismo sifón sobre una CONSERVADA sí se rechaza', () => {
    const conservada = proceso('el-sifon-de-nutricion', {
      roles: [
        {
          name: 'brasa',
          where: [
            { q: 'nutrition', op: '>=', v: 10 },
            { q: 'mass', op: '>=', v: 1 },
            { q: 'mass', op: '<=', v: 1 },
          ],
        },
        {
          name: 'olla',
          where: [
            { q: 'mass', op: '>=', v: 1 },
            { q: 'mass', op: '<=', v: 1 },
          ],
        },
      ],
      arrangement: { k: 'contact' },
      effects: [{ k: 'transfer', q: 'nutrition', from: 'brasa', to: 'olla', porSegundo: 20 }],
    })
    expect(tieneCodigo(admit(conservada, phys), 'conservacion-transfer')).toBe(true)
  })

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ ROTO · la temperatura no es una cuenta conservada pero es energía igual.   ║
  // ║ Sin `completion`, `movidoPor` la juzga por UN tick (10 grados) y el        ║
  // ║ efecto corre para siempre. Y acá está el saldo que depende del ESTADO DEL  ║
  // ║ MUNDO: la ley 1 relaja la brasa hacia el ambiente cada tick, o sea que la  ║
  // ║ fuente se REPONE sola, y el sifón mueve mucho más de los 500 grados que    ║
  // ║ el rol garantiza una sola vez. La puerta no tiene forma de verlo porque    ║
  // ║ compara cantidades por corrida y acá no hay corrida.                       ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  it('CERRADO · un transfer de temperatura sin completion corre porSegundo × ∞', () => {
    expect(admit(CHUPAR_CALOR_PARA_SIEMPRE, phys).ok).toBe(false)
  })

  it('MEDIDO · y el rechazo dice la tasa, que es lo único que se puede acotar sin corrida', () => {
    const r = admit(CHUPAR_CALOR_PARA_SIEMPRE, phys).razones.find(
      (x) => x.codigo === 'transferencia-eterna',
    )
    expect(r?.encontrado).toBe(200)
    expect(r?.mensaje).toContain('no declara completion')
  })

  it('MEDIDO · y el MISMO sifón con `completion` puesto vuelve a juzgarse por cantidad', () => {
    // No es «rechazar todo transfer»: es pedir que haya una corrida que acotar. Con
    // un segundo declarado, lo que decide es la cuenta de la magnitud intensiva.
    const acotado = { ...CHUPAR_CALOR_PARA_SIEMPRE, completion: { at: seg(1), yields: [] } }
    expect(tieneCodigo(admit(acotado, phys), 'transferencia-eterna')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE VI · AGUJERO F · EL LAZO INVISIBLE
// La cadena de procesos donde ninguno solo es rentable y el ciclo sí — y la
// regla 5 no puede verlo porque un `transfer` no promete nada.
// ═══════════════════════════════════════════════════════════════════════════════

/** Pierna de ida: los grados van del mineral al agua, y la energía se multiplica. */
const IDA = proceso('calor-al-agua', {
  roles: [ORIGEN_MINERAL, DESTINO_LIQUIDO],
  arrangement: { k: 'contact' },
  effects: [{ k: 'transfer', q: 'temperature', from: 'brasa', to: 'olla', porSegundo: 200 }],
  completion: { at: seg(1), yields: [] },
})

/** Pierna de vuelta: los mismos grados vuelven al mineral. El lazo está cerrado. */
const VUELTA = proceso('calor-a-la-piedra', {
  roles: [
    {
      name: 'agua-caliente',
      where: [
        { q: 'rigidity', op: '<=', v: 0 },
        { q: 'temperature', op: '>=', v: 500 },
        { q: 'mass', op: '>=', v: 1 },
        { q: 'mass', op: '<=', v: 1 },
      ],
    },
    {
      name: 'piedra-fria',
      where: [
        { q: 'rigidity', op: '>=', v: 0.95 },
        { q: 'mass', op: '>=', v: 1 },
        { q: 'mass', op: '<=', v: 1 },
      ],
    },
  ],
  arrangement: { k: 'contact' },
  effects: [
    { k: 'transfer', q: 'temperature', from: 'agua-caliente', to: 'piedra-fria', porSegundo: 200 },
  ],
  completion: { at: seg(1), yields: [] },
})

const conLasDosPiernas = buildSeedPhysics({ processes: [...SEED_PROCESSES, IDA, VUELTA] })

describe('agujero F · un transfer no promete nada, así que no cierra ningún ciclo', () => {
  it('MEDIDO · la pierna de IDA ya no entra sola: la para el calor específico', () => {
    // Es el mismo proceso del agujero D, y por eso ahora cae ahí. La de VUELTA sí
    // entra sola —mueve calor de un líquido a un mineral, que es cuesta abajo— y eso
    // está bien: sola no es rentable.
    expect(porQueEntro(admit(IDA, phys))).toBe('magnitud-intensiva')
    expect(porQueEntro(admit(VUELTA, phys))).toBe('')
  })

  it('MEDIDO · el mundo tiene el lazo, y ahora la regla 5 lo ve', () => {
    // Ida deja el agua a 500+, que es exactamente lo que Vuelta le pide a
    // «agua-caliente»; Vuelta deja la piedra caliente, que es lo que Ida le pide
    // a «brasa». Es un ciclo de dos, y ninguno de los dos escribió un `establishes`.
    expect(ciclosPor(VUELTA, conLasDosPiernas).ciclos.length).toBeGreaterThan(0)
    expect(ciclosPor(IDA, conLasDosPiernas).ciclos.length).toBeGreaterThan(0)
  })

  it('MEDIDO · y con `establishes` puesto a mano, el MISMO par sí forma ciclo', () => {
    // La prueba de que la ceguera es del grafo y no del mundo: los efectos son
    // idénticos, lo único que cambia son dos strings que quien propone escribe.
    const idaHabladora: Process = { ...IDA, establishes: ['temperature>=500'] }
    const vueltaHabladora: Process = { ...VUELTA, establishes: ['temperature>=500'] }
    const hablador = buildSeedPhysics({
      processes: [...SEED_PROCESSES, idaHabladora, vueltaHabladora],
    })
    expect(ciclosPor(vueltaHabladora, hablador).ciclos.length).toBeGreaterThan(0)
  })

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ ROTO · la reparación 6 dice «borrar un string ya no borra una arista» y    ║
  // ║ lo cumple para los `drive`. Para `transfer` y `couple` el string sigue     ║
  // ║ siendo lo único que arma la arista: quien propone elige si su proceso es   ║
  // ║ visible para la única regla que puede ver un lazo.                         ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  it('CERRADO · un proceso que solo transfiere es invisible para la regla 5', () => {
    expect(ciclosPor(VUELTA, conLasDosPiernas).ciclos.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE VII · AGUJERO G · `mass <= x` NO ES `mass >= x`
// ═══════════════════════════════════════════════════════════════════════════════

const FROTAR_LA_MONTANIA = proceso('frotar-el-penasco', {
  roles: [
    {
      name: 'penasco',
      where: [
        { q: 'rigidity', op: '>=', v: 0.9 },
        // La montaña entera, declarada por arriba. `masaGarantizada` lee cotas por
        // ABAJO, así que esto no garantiza nada y el trabajo se cobra por 1.
        { q: 'mass', op: '<=', v: 5000 },
      ],
    },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
  ],
  arrangement: { k: 'held' },
  effects: [
    {
      k: 'drive',
      q: 'temperature',
      on: 'penasco',
      toward: 400,
      porSegundo: 120,
      poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.35 },
    },
  ],
  establishes: ['temperature>=399'],
})

const FROTAR_EL_GUIJARRO: Process = {
  ...FROTAR_LA_MONTANIA,
  id: 'frotar-el-guijarro',
  lexeme: { nombre: 'frotar-el-guijarro' },
  roles: [
    {
      name: 'penasco',
      where: [
        { q: 'rigidity', op: '>=', v: 0.9 },
        { q: 'mass', op: '<=', v: 1 },
      ],
    },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
  ],
}

describe('agujero G · la reparación del precio cuenta la masa garantizada, no la posible', () => {
  it('CONTROL · con `mass >= 5000` el precio sí escala: es la mitad reparada', () => {
    const declarada: Process = {
      ...FROTAR_LA_MONTANIA,
      id: 'frotar-el-penasco-declarado',
      roles: [
        {
          name: 'penasco',
          where: [
            { q: 'rigidity', op: '>=', v: 0.9 },
            { q: 'mass', op: '>=', v: 5000 },
          ],
        },
        { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
      ],
    }
    expect(saldoDeclarado(declarada, 'stamina', phys)).toBeLessThan(-50000)
  })

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ ROTO · un operador cambiado y la montaña vuelve a costar lo que el         ║
  // ║ guijarro. `revisarIntensiva` ante la misma falta de cota RECHAZA por       ║
  // ║ indecidible; `masaQuePaga` cobra 1 y sigue. La asimetría está declarada    ║
  // ║ en el comentario pero es el ataque de la causa 3 con otro signo.           ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  it('CERRADO · frotar un peñasco de hasta 5000 cuesta lo mismo que frotar uno de 1', () => {
    expect(saldoDeclarado(FROTAR_LA_MONTANIA, 'stamina', phys)).toBeLessThan(
      saldoDeclarado(FROTAR_EL_GUIJARRO, 'stamina', phys),
    )
  })

  it('MEDIDO · la montaña cuesta 5000 veces lo que el guijarro, que es su techo de masa', () => {
    // Para COBRAR, la cota honesta es la del PEOR caso: el techo, el mismo que
    // `revisarIntensiva` usa para lo que se escribe. Antes el juez usaba el piso
    // para cobrar y el techo para conservar — dos cotas opuestas para la misma masa.
    expect(
      saldoDeclarado(FROTAR_LA_MONTANIA, 'stamina', phys) /
        saldoDeclarado(FROTAR_EL_GUIJARRO, 'stamina', phys),
    ).toBeCloseTo(5000, 6)
  })

  it('MEDIDO · y sin NINGUNA cota de masa se sigue cobrando por una unidad', () => {
    // La subestimación que queda, y sigue siendo declarada: cobrar por el máximo del
    // RANGO —diez mil— mataría a `friccion`, cuyo rol no acota nada, y `friccion` es
    // el primer fuego de la partida.
    //
    // El `0,35` estaba copiado y se puso rojo cuando la eficiencia pasó a 0,85
    // (tramo N). Lo que este bloque mide es la CUENTA —empuje por paso dividido la
    // eficiencia, por UNA unidad de masa— y no el valor de la calibración, así que
    // los dos factores se leen del proceso.
    const drive = FRICCION.effects.find((e) => e.k === 'drive')
    if (drive?.k !== 'drive' || drive.poweredBy === undefined) {
      throw new Error('friccion cambió de forma')
    }
    const porUnidad = drive.porSegundo / HZ_DE_REFERENCIA / drive.poweredBy.efficiency
    expect(saldoDeclarado(FRICCION, 'stamina', phys)).toBeCloseTo(-porUnidad, 6)
  })
})
