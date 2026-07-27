// ─── Ataque adversario · ENERGÍA DE LA NADA ──────────────────────────────────
//
// Este archivo no prueba que `admit()` ande. Prueba que se le puede mentir.
//
// La lente es una sola: sacar trabajo de donde no hay. Móviles perpetuos, cadenas
// de `drive` que se alimentan entre sí, `poweredBy` al filo, `transfer`
// circulares, `couple` que copia una cualidad y la devuelve amplificada, y el
// caso que el documento de arquitectura nombra por su nombre: frotar dos piedras
// para calor infinito.
//
// CÓMO SE LEE ESTE ARCHIVO
//
//   `it(...)`        la puerta RECHAZA el ataque. El test afirma el rechazo y el
//                    código con el que lo rechaza. Es una regresión: si mañana
//                    alguien afloja la regla, esto se pone rojo.
//
//   `it.fails(...)`  EL ATAQUE SE CUELA. El cuerpo del test afirma lo que la
//                    puerta DEBERÍA hacer —rechazar— y hoy no hace, así que el
//                    test falla, y `it.fails` es la marca de «falla conocida».
//                    No está en verde fingiendo que anda: está en verde diciendo
//                    que está roto. Cuando el agujero se tape, el test va a pasar
//                    y `it.fails` lo va a reportar como ROJO — que es la señal de
//                    «sacame el `.fails`», no de «rompiste algo».
//
// Los ocho agujeros abiertos, en una línea cada uno:
//
//   1. `couple` no pasa por la regla 2. Copiar temperatura de un cuerpo a otro
//      no drena nada de nadie y no declara `poweredBy`. El espejo térmico.
//   2. …y como el `couple` acepta cualquier par de cualidades conmensurables,
//      `temperature ← ignitionPoint` enciende cualquier cosa por decreto.
//   3. …y como nadie prohíbe escribir una cualidad DERIVADA en un proceso,
//      `emitsPower ← mass` hace que una piedra irradie por pesar.
//   4. `transfer` tampoco pasa por la regla 2, y no distingue intensivas de
//      extensivas: mover 50 °C de una brasa a un lago crea el calor del lago.
//   5. Un `drive` cuyo `toward` es exactamente el piso que el rol exige se lee
//      como «bajar» y las reglas 1 y 2 lo saltean las dos. Sobre `stamina`, eso
//      es un recargador de aliento invisible.
//   6. Agregarle `stamina > 0` al rol de la piedra-batería la vuelve admisible
//      —y de paso apaga la regla 5, porque el saldo del ciclo pasa a dar cero.
//   7. `respalda()` es binario: un rol que garantiza `nutrition > 0` habilita un
//      `transfer` de 500 de nutrición desde una miga, sin razón ni reparo.
//   8. `poweredBy` no tiene cierre dimensional: frotar una montaña cuesta lo
//      mismo que frotar un guijarro, y la ley 1 después divide por la masa.

import { describe, expect, it } from 'vitest'
import {
  admit,
  ciclosPor,
  saldoDeclarado,
  tieneCodigo,
  type Codigo,
  type Verdict,
} from '../src/admit.js'
import { buildSeedPhysics } from '../src/physics.js'
import { FRICCION, PHYSICS_VERSION, SEED_PROCESSES, type Process } from '../src/process.js'

const phys = buildSeedPhysics()

const codigos = (v: Verdict): readonly Codigo[] => v.razones.map((r) => r.codigo)

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

const DRIVE_DE_FRICCION = (() => {
  const e = FRICCION.effects[0]
  if (e?.k !== 'drive') throw new Error('friccion tiene que traer un drive')
  return e
})()

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE I · LO QUE LA PUERTA SÍ ATAJA
// Sin esto el archivo no dice nada: un adversario que solo muestra agujeros no
// distingue una puerta con una rendija de una puerta que no existe.
// ═══════════════════════════════════════════════════════════════════════════════

describe('la puerta ataja el móvil perpetuo cuando viene por la puerta principal', () => {
  it('frotar dos piedras sin declarar de dónde sale el calor', () => {
    const p = proceso('frotar-dos-piedras', {
      roles: [
        { name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.9 }] },
        { name: 'b', where: [{ q: 'rigidity', op: '>=', v: 0.9 }] },
      ],
      effects: [{ k: 'drive', q: 'temperature', on: 'a', toward: 900, perTick: 20 }],
    })
    expect(tieneCodigo(admit(p, phys), 'sube-gratis')).toBe(true)
  })

  it('la eficiencia al filo: 1 entra, 1.000001 no', () => {
    const alFilo = proceso('frotar-al-filo', {
      roles: FRICCION.roles,
      arrangement: { k: 'held' },
      effects: [{ ...DRIVE_DE_FRICCION, poweredBy: { from: 'actor', q: 'stamina', efficiency: 1 } }],
      // Sin `establishes` que prometa lo mismo que `friccion`, para que el
      // rechazo —si lo hay— sea el de la eficiencia y no el de la dominancia.
      establishes: ['temperature>=399'],
    })
    // Eficiencia 1 está PERMITIDA por diseño: sale exactamente lo que entra. Es
    // el borde, no el error. `MAX_EFFICIENCY` es 1 y la comparación es `>`.
    expect(tieneCodigo(admit(alFilo, phys), 'eficiencia')).toBe(false)

    const pasado = proceso('frotar-pasado-de-rosca', {
      ...alFilo,
      id: 'frotar-pasado-de-rosca',
      effects: [
        { ...DRIVE_DE_FRICCION, poweredBy: { from: 'actor', q: 'stamina', efficiency: 1.000001 } },
      ],
    })
    expect(tieneCodigo(admit(pasado, phys), 'eficiencia')).toBe(true)
  })

  it('una cadena de drive que se alimenta a sí misma: el calor que paga la stamina', () => {
    // El móvil perpetuo de manual: la fricción convierte aliento en calor, así
    // que este otro convierte calor en aliento. Cae por dos lados a la vez.
    const p = proceso('el-calor-me-alimenta', {
      roles: [
        { name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
        { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
      ],
      effects: [
        {
          k: 'drive',
          q: 'stamina',
          on: 'actor',
          toward: 1000,
          perTick: 10,
          poweredBy: { from: 'a', q: 'temperature', efficiency: 0.5 },
        },
      ],
    })
    const v = admit(p, phys)
    expect(tieneCodigo(v, 'conservacion-drive')).toBe(true) // sube una conservada

    // MEDIDO, y no es lo que uno esperaría: `fuente-no-conservada` NO aparece.
    // La regla 2 abre con `if (esConservada(phys, e.q)) continue`, así que
    // cuando lo que sube es una cuenta conservada, el `poweredBy` no se revisa
    // NUNCA — ni la fuente, ni la eficiencia, ni el respaldo. Acá no importa
    // porque la regla 1 lo mata igual; en el agujero 5 sí importa, y mucho.
    expect(tieneCodigo(v, 'fuente-no-conservada')).toBe(false)
  })

  it('el lazo más corto: stamina que se paga con stamina a eficiencia 1', () => {
    const p = proceso('aliento-que-se-paga-solo', {
      roles: [{ name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] }],
      effects: [
        {
          k: 'drive',
          q: 'stamina',
          on: 'actor',
          toward: 1000,
          perTick: 10,
          poweredBy: { from: 'actor', q: 'stamina', efficiency: 1 },
        },
      ],
    })
    expect(tieneCodigo(admit(p, phys), 'conservacion-drive')).toBe(true)
  })

  it('un couple SOBRE una conservada sí está atajado', () => {
    // Éste es el contraste que hace legible el agujero 1: el `couple` está
    // vigilado cuando escribe una cuenta conservada, y no lo está para nada
    // cuando escribe cualquier otra cosa.
    const p = proceso('acoplar-la-nutricion', {
      roles: [
        { name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
        { name: 'b', where: [{ q: 'digestibility', op: '>=', v: 0.3 }] },
      ],
      effects: [{ k: 'couple', q: 'nutrition', on: 'a', follows: { q: 'toughness', of: 'b' } }],
    })
    expect(tieneCodigo(admit(p, phys), 'conservacion-couple')).toBe(true)
  })

  it('la piedra-batería tal cual: transferir aliento desde algo que no lo tiene', () => {
    const p = proceso('piedra-bateria', {
      roles: [
        { name: 'piedra', where: [{ q: 'temperature', op: '>=', v: 400 }] },
        { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
      ],
      arrangement: { k: 'held' },
      effects: [{ k: 'transfer', q: 'stamina', from: 'piedra', to: 'actor', perTick: 10 }],
      completion: { at: 10, yields: [] },
      establishes: ['stamina>=100'],
    })
    expect(tieneCodigo(admit(p, phys), 'conservacion-transfer')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE II · LOS OCHO AGUJEROS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1 · el espejo térmico ───────────────────────────────────────────────────

/**
 * `reglaNadaSubeGratis` empieza con `if (e.k !== 'drive') continue`. O sea que la
 * regla 2 —«nada sube gratis»— solo mira los `drive`. Un `couple` escribe la
 * misma cualidad, sobre el mismo rol, sin cota y sin `poweredBy`, y no lo mira
 * nadie: la regla 1 lo ataja solo si la cualidad es conservada, y `temperature`
 * no lo es.
 *
 * En el mundo: dos piedras en contacto, una caliente. La fría copia la
 * temperatura de la caliente SIN enfriarla. El calor se duplicó. Repetir.
 */
const ESPEJO_TERMICO = proceso('espejo-termico', {
  roles: [
    { name: 'fria', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { name: 'caliente', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
  ],
  effects: [{ k: 'couple', q: 'temperature', on: 'fria', follows: { q: 'temperature', of: 'caliente' } }],
})

describe('agujero 1 · el couple no pasa por la regla 2', () => {
  it('HUECO ABIERTO — hoy entra sin una sola razón', () => {
    expect(codigos(admit(ESPEJO_TERMICO, phys))).toEqual([])
  })

  it.fails('PENDIENTE — copiar temperatura de un cuerpo a otro sin drenar nada se cuela', () => {
    // Hoy: `ok === true`, cero razones. Debería pedir `poweredBy` como cualquier
    // otra cosa que suba `temperature`, o estar prohibido de plano.
    expect(admit(ESPEJO_TERMICO, phys).ok).toBe(false)
  })

  it('y el saldo declarado del espejo es cero: para la regla 5 no existe', () => {
    // La consecuencia de arrastre, y por eso el agujero 1 es peor de lo que
    // parece: `saldoDeclarado` solo cuenta `couple` sobre conservadas, así que
    // un ciclo que pase por acá suma cero y la regla 5 no lo puede ver tampoco.
    for (const q of ['mass', 'nutrition', 'stamina', 'fuelEnergy'] as const) {
      expect([q, saldoDeclarado(ESPEJO_TERMICO, q, phys)]).toEqual([q, 0])
    }
  })
})

// ─── 2 · encender por decreto ────────────────────────────────────────────────

/**
 * El cierre dimensional del `couple` pide dos cosas: misma `extent` y que el
 * rango de lo seguido entre en el rango de lo que sigue. `ignitionPoint`
 * ∈ [0, 2000] entra en `temperature` ∈ [−100, 2000] y las dos son intensivas.
 *
 * Entonces se puede escribir «la temperatura de esto sigue a su propio punto de
 * ignición». Traducido: todo lo que entre en el rol arde, ya. Sin frotar, sin
 * stamina, sin yesca, sin el primer fuego de la partida.
 */
const ENCENDER_POR_DECRETO = proceso('encender-por-decreto', {
  roles: [{ name: 'lenia', where: [{ q: 'flexibility', op: '<=', v: 0.9 }] }],
  effects: [
    { k: 'couple', q: 'temperature', on: 'lenia', follows: { q: 'ignitionPoint', of: 'lenia' } },
  ],
})

describe('agujero 2 · el couple acopla cualquier par conmensurable', () => {
  it('HUECO ABIERTO — hoy entra sin una sola razón', () => {
    expect(codigos(admit(ENCENDER_POR_DECRETO, phys))).toEqual([])
  })

  it.fails('PENDIENTE — «tu temperatura sigue a tu punto de ignición» se cuela', () => {
    expect(admit(ENCENDER_POR_DECRETO, phys).ok).toBe(false)
  })
})

// ─── 3 · la piedra que irradia por pesar ─────────────────────────────────────

/**
 * `admitSubstance` rechaza que una sustancia declare una cualidad DERIVADA
 * (`cualidad-derivada`, regla 4). `admit` de un PROCESO no tiene esa regla: un
 * proceso puede escribir `calories`, `catch`, `reach` o `emitsPower`, que son
 * justamente las que no se guardan porque se calculan.
 *
 * Peor con `emitsPower`, que es potencia: extensiva, rango [0, 20000], y `mass`
 * —extensiva, [0, 10000]— le entra. Una piedra que emite potencia igual a su
 * masa, para siempre, sin `fuelEnergy` y sin arder. Es la definición de energía
 * de la nada, y entra por dos agujeros a la vez (derivada + couple sin regla 2).
 */
const PIEDRA_QUE_IRRADIA = proceso('piedra-que-irradia', {
  roles: [{ name: 'piedra', where: [{ q: 'rigidity', op: '>=', v: 0.9 }] }],
  effects: [{ k: 'couple', q: 'emitsPower', on: 'piedra', follows: { q: 'mass', of: 'piedra' } }],
})

describe('agujero 3 · un proceso puede escribir una cualidad derivada', () => {
  it('HUECO ABIERTO — hoy entra sin una sola razón', () => {
    expect(codigos(admit(PIEDRA_QUE_IRRADIA, phys))).toEqual([])
  })

  it.fails('PENDIENTE — «emitís potencia igual a tu masa» se cuela', () => {
    expect(admit(PIEDRA_QUE_IRRADIA, phys).ok).toBe(false)
  })

  it.fails('PENDIENTE — y ni siquiera hay un código para decirlo sobre un proceso', () => {
    // `cualidad-derivada` existe como `Codigo` pero solo lo emite
    // `revisarValorDeSustancia`. Sobre procesos no lo emite nadie.
    expect(tieneCodigo(admit(PIEDRA_QUE_IRRADIA, phys), 'cualidad-derivada')).toBe(true)
  })
})

// ─── 4 · la bomba de calor sin motor ─────────────────────────────────────────

/**
 * Dos cosas fallan juntas acá.
 *
 * La primera: `transfer`, igual que `couple`, no pasa por la regla 2. El destino
 * SUBE y nadie pide `poweredBy`.
 *
 * La segunda, y es la grave: `transfer` no distingue intensivas de extensivas.
 * `temperature` es intensiva. Mover «50 grados» de una brasa de masa 0.1 a una
 * olla de masa 100 no conserva NADA: la energía es `mass × specificHeat × ΔT`,
 * así que del lado del destino aparece mil veces la que se fue del origen.
 *
 * Y el origen se repone gratis: `temperature` tiene `relaxesTo: ambient`. La
 * brasa vuelve sola a la temperatura ambiente y se la puede volver a ordeñar.
 * Ciclo cerrado, energía de la nada, cero razones en el veredicto.
 */
const BOMBA_DE_CALOR = proceso('bomba-de-calor', {
  roles: [
    { name: 'brasa', where: [{ q: 'temperature', op: '>=', v: 400 }] },
    { name: 'olla', where: [{ q: 'mass', op: '>=', v: 100 }] },
  ],
  effects: [{ k: 'transfer', q: 'temperature', from: 'brasa', to: 'olla', perTick: 50 }],
  completion: { at: 40, yields: [] },
})

describe('agujero 4 · transfer de una cualidad intensiva', () => {
  it('HUECO ABIERTO — hoy entra sin una sola razón', () => {
    expect(codigos(admit(BOMBA_DE_CALOR, phys))).toEqual([])
  })

  it.fails('PENDIENTE — mover 50 °C de una brasa a un lago se cuela', () => {
    expect(admit(BOMBA_DE_CALOR, phys).ok).toBe(false)
  })

  it.fails('PENDIENTE — ni un reparo sobre la cualidad que se está moviendo', () => {
    // El único reparo que hoy levanta este proceso es
    // `completion-sin-rendimientos`, que habla del completion y no del
    // `transfer`. Sobre la temperatura que se duplica, silencio.
    const v = admit(BOMBA_DE_CALOR, phys)
    expect(v.advertencias.some((r) => r.q === 'temperature')).toBe(true)
  })
})

// ─── 5 · el recargador de aliento invisible ──────────────────────────────────

/**
 * Las dos reglas que podrían atajar un `drive` sobre `stamina` lo saltean por la
 * MISMA línea, escrita dos veces:
 *
 *   regla 1: `const lo = cotasDeRol(...).lo; if (e.toward <= lo) continue`
 *   regla 2: `if (e.toward <= lo) continue   // baja: libre, y tiene que serlo`
 *
 * `lo` sale de lo que el ROL exige. Si el rol pide `stamina >= 50` y el `drive`
 * apunta a 50, entonces `toward <= lo` y las dos reglas lo leen como «esto baja».
 * No baja: es un piso. En el mundo, el proceso empuja la stamina HACIA 50 desde
 * donde esté — y desde abajo, eso es subirla.
 *
 * El mismo proceso trae un `drain` de 1 por tick para que quede claro que hay un
 * abajo del que volver: gasta 1, recupera 10. Móvil perpetuo de nueve por tick,
 * con veredicto limpio.
 */
const RECARGADOR = proceso('recargar-el-aliento', {
  roles: [{ name: 'actor', where: [{ q: 'stamina', op: '>=', v: 50 }] }],
  effects: [
    { k: 'drain', q: 'stamina', on: 'actor', perTick: 1 },
    { k: 'drive', q: 'stamina', on: 'actor', toward: 50, perTick: 10 },
  ],
  completion: { at: 10, yields: [{ k: 'split', role: 'actor', at: 'grain' }] },
})

describe('agujero 5 · un drive hacia el piso del propio rol', () => {
  it('HUECO ABIERTO — hoy entra sin una sola razón', () => {
    expect(codigos(admit(RECARGADOR, phys))).toEqual([])
  })

  it.fails('PENDIENTE — recargar stamina hasta el umbral de entrada se cuela', () => {
    expect(admit(RECARGADOR, phys).ok).toBe(false)
  })

  it('y el agujero abre una puerta de atrás: el poweredBy deja de revisarse ENTERO', () => {
    // La regla 1 saltea por `toward <= lo`; la regla 2 saltea por
    // `esConservada(e.q)`. Entre las dos, este `drive` no lo mira NADIE, así que
    // se le puede colgar un `poweredBy` con eficiencia 99 —«sale noventa y nueve
    // veces lo que entra»— desde una cualidad que ni siquiera es una cuenta
    // conservada, y el veredicto sale limpio igual.
    const descarado = proceso('recargar-con-eficiencia-99', {
      ...RECARGADOR,
      id: 'recargar-con-eficiencia-99',
      effects: [
        { k: 'drain', q: 'stamina', on: 'actor', perTick: 1 },
        {
          k: 'drive',
          q: 'stamina',
          on: 'actor',
          toward: 50,
          perTick: 10,
          poweredBy: { from: 'actor', q: 'moisture', efficiency: 99 },
        },
      ],
    })
    const v = admit(descarado, phys)
    expect(codigos(v)).toEqual([])
    expect(tieneCodigo(v, 'eficiencia')).toBe(false)
    expect(tieneCodigo(v, 'fuente-no-conservada')).toBe(false)
  })

  it('y el filo es exactamente el `<=`: un decimal más arriba y lo agarra', () => {
    // Esto no es un agujero, es la PRUEBA de dónde está el borde: la puerta
    // funciona para todo `toward` estrictamente mayor que el piso del rol, y se
    // apaga justo en la igualdad, que es donde el ataque vive.
    const unPeloMas = proceso('recargar-un-pelo-mas', {
      ...RECARGADOR,
      id: 'recargar-un-pelo-mas',
      effects: [
        { k: 'drain', q: 'stamina', on: 'actor', perTick: 1 },
        { k: 'drive', q: 'stamina', on: 'actor', toward: 50.0001, perTick: 10 },
      ],
    })
    expect(tieneCodigo(admit(unPeloMas, phys), 'conservacion-drive')).toBe(true)
  })

  it('y el saldo declarado MIENTE al revés: dice que cuesta 10 cuando rinde 90', () => {
    // `trabajoDe` devuelve 0 porque `recorrido = toward − lo = 0`. O sea que el
    // recargador entra en la contabilidad de la regla 5 como un proceso que solo
    // gasta. Un ciclo que pase por acá va a dar saldo negativo y pasar limpio.
    expect(saldoDeclarado(RECARGADOR, 'stamina', phys)).toBe(-10)
  })
})

// ─── 6 · la piedra-batería con una línea más ─────────────────────────────────

/**
 * `respalda()` es la función que decide si de un rol se puede SACAR una cualidad
 * conservada. Tiene un atajo al principio:
 *
 *     if (garantizaPositivo(r, q)) return true
 *
 * O sea: alcanza con que el rol PIDA `stamina > 0` para que la puerta acepte que
 * de ahí sale stamina. No se cruza contra el catálogo de sustancias —ninguna
 * declara `stamina`, así que la vía de las candidatas nunca se activa— y no se
 * cruza contra nada más.
 *
 * Resultado: la piedra-batería, que es el ejemplo canónico de la regla 1 y tiene
 * su propio test en `admit.test.ts`, se vuelve admisible agregándole UNA LÍNEA al
 * rol. Y el daño colateral es peor que el directo: como ahora `respalda` dice que
 * sí, `saldoDeclarado` le resta el débito al crédito y el `transfer` pasa a valer
 * CERO — con lo cual el ciclo `frotar → piedra-batería → frotar`, que la regla 5
 * rechaza hoy citando 82.857 de stamina por vuelta, deja de dar positivo.
 */
const PIEDRA_BATERIA_V2 = proceso('piedra-bateria-v2', {
  roles: [
    {
      name: 'piedra',
      where: [
        { q: 'temperature', op: '>=', v: 400 },
        { q: 'stamina', op: '>', v: 0 }, // ← la línea entera del ataque
      ],
    },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
  ],
  arrangement: { k: 'held' },
  effects: [{ k: 'transfer', q: 'stamina', from: 'piedra', to: 'actor', perTick: 10 }],
  completion: { at: 10, yields: [] },
  establishes: ['stamina>=100'],
})

const FROTAR_PARA_LA_BATERIA = proceso('frotar-para-la-bateria', {
  roles: [
    { name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 50 }] },
  ],
  arrangement: { k: 'held' },
  effects: [{ ...DRIVE_DE_FRICCION, poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.35 } }],
  establishes: ['temperature>=400'],
})

describe('agujero 6 · pedir una cualidad es garantizarla', () => {
  it('HUECO ABIERTO — hoy entra sin una sola razón', () => {
    expect(codigos(admit(PIEDRA_BATERIA_V2, phys))).toEqual([])
  })

  it.fails('PENDIENTE — la piedra-batería con `stamina > 0` en el rol se cuela', () => {
    expect(admit(PIEDRA_BATERIA_V2, phys).ok).toBe(false)
  })

  it('el ciclo existe y la regla 5 lo enumera', () => {
    // El grafo está bien: la puerta VE el lazo. Lo que falla es la cuenta.
    const con = buildSeedPhysics({ processes: [...SEED_PROCESSES, PIEDRA_BATERIA_V2] })
    const b = ciclosPor(FROTAR_PARA_LA_BATERIA, con)
    const rutas = b.ciclos.map((c) => c.procesos.join(' → '))
    expect(rutas).toContain('frotar-para-la-bateria → piedra-bateria-v2 → frotar-para-la-bateria')
  })

  it.fails('PENDIENTE — pero el saldo del ciclo da negativo y la regla 5 lo deja pasar', () => {
    const con = buildSeedPhysics({ processes: [...SEED_PROCESSES, PIEDRA_BATERIA_V2] })
    expect(tieneCodigo(admit(FROTAR_PARA_LA_BATERIA, con), 'ciclo-rentable')).toBe(true)
  })

  it.fails('PENDIENTE — y el transfer que crea 100 de aliento declara costo cero', () => {
    expect(saldoDeclarado(PIEDRA_BATERIA_V2, 'stamina', phys)).toBeGreaterThan(0)
  })
})

// ─── 7 · quinientos de nutrición desde una miga ──────────────────────────────

/**
 * El otro filo del mismo `respalda()`: es BINARIO. Contesta «este rol tiene de
 * dónde», nunca «tiene cuánto». Un rol que exige `nutrition > 0` respalda un
 * `transfer` de 5 por tick durante 100 ticks: 500 de nutrición desde un cuerpo
 * del que solo se sabe que tiene más que nada.
 *
 * Y `nutrition` es INTENSIVA —está `perUnitMass`, lo dice el catálogo—, así que
 * transferir el número de una miga a un peñasco multiplica el total por la razón
 * de masas. Es exactamente la bomba que el comentario de `quality.ts` manda
 * atajar: «la regla 1 de admit() tiene que comparar el producto; comparar el
 * intensivo dejaría pasar una bomba de materia».
 *
 * Para el `drive` con `poweredBy` y para el `drain`, la puerta SÍ compara el
 * costo contra lo que el rol garantiza y levanta `costo-mayor-que-la-garantia`.
 * Para el `transfer` no hay nada: ni razón, ni reparo.
 */
const TRASVASE = proceso('trasvasar-la-nutricion', {
  roles: [
    { name: 'miga', where: [{ q: 'nutrition', op: '>', v: 0 }] },
    { name: 'peniasco', where: [{ q: 'mass', op: '>=', v: 100 }] },
  ],
  effects: [{ k: 'transfer', q: 'nutrition', from: 'miga', to: 'peniasco', perTick: 5 }],
  completion: { at: 100, yields: [] },
})

describe('agujero 7 · respalda() dice «de dónde», nunca «cuánto»', () => {
  it('HUECO ABIERTO — hoy entra sin una sola razón', () => {
    expect(codigos(admit(TRASVASE, phys))).toEqual([])
  })

  it.fails('PENDIENTE — 500 de nutrición desde un rol que garantiza «más que cero» se cuela', () => {
    expect(admit(TRASVASE, phys).ok).toBe(false)
  })

  it.fails('PENDIENTE — y el transfer no tiene el reparo que el drain sí tiene', () => {
    const v = admit(TRASVASE, phys)
    expect(v.advertencias.some((r) => r.codigo === 'costo-mayor-que-la-garantia')).toBe(true)
  })
})

// ─── 8 · frotar una montaña ──────────────────────────────────────────────────

/**
 * `poweredBy` no tiene cierre dimensional. El `couple` sí lo tiene —compara
 * `extent` y rangos, y rechaza con `acople-inconmensurable`—, pero el par
 * (cualidad que sube, cuenta que paga) no se compara con nada.
 *
 * La consecuencia con `temperature`: el costo declarado es el ΔT, y el ΔT no
 * depende de la masa. Frotar un guijarro de masa 1 y frotar un peñasco de masa
 * 5000 cuestan lo mismo, 17.14 de stamina — mientras la ley 1 del mundo va a
 * calcular la energía real como `mass × specificHeat × ΔT`, o sea cinco mil veces
 * más en el segundo caso. La diferencia la paga el vacío.
 *
 * Y no hay dominancia que lo ataje, porque el proceso pide MÁS que `friccion`
 * (masa ≥ 5000), y `exigeMenosOIgual` corta ahí.
 */
const FROTAR_LA_MONTANIA = proceso('frotar-la-montania', {
  roles: [
    {
      name: 'a',
      where: [
        { q: 'rigidity', op: '>=', v: 0.5 },
        { q: 'mass', op: '>=', v: 5000 },
      ],
    },
    { name: 'b', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
  ],
  arrangement: { k: 'held' },
  effects: [{ ...DRIVE_DE_FRICCION, poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.35 } }],
  establishes: ['temperature>=400'],
})

describe('agujero 8 · poweredBy no tiene cierre dimensional', () => {
  it('el proceso entra sin una sola razón', () => {
    // Esto no está marcado como pendiente porque el proceso, leído solo, es
    // legal: declara su fuente, es conservada, la eficiencia es 0.35. Lo que
    // está mal es el PRECIO, y eso se ve en el test de abajo.
    expect(codigos(admit(FROTAR_LA_MONTANIA, phys))).toEqual([])
  })

  it.fails('PENDIENTE — calentar 5000 de masa cuesta exactamente lo mismo que calentar una', () => {
    const montania = saldoDeclarado(FROTAR_LA_MONTANIA, 'stamina', phys)
    const guijarro = saldoDeclarado(FRICCION, 'stamina', phys)
    // Debería costar MÁS (saldo más negativo). Hoy son idénticos.
    expect(montania).toBeLessThan(guijarro)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE III · LA REGLA 5 SE APAGA BORRANDO UN STRING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El grafo de la regla 5 se arma con `habilita()`, que se arma con `promesasDe()`,
 * que lee `establishes` — un array de strings que escribe quien propone el
 * proceso. Un proceso con `establishes: []` no tiene ninguna arista de salida, y
 * por lo tanto no está en ningún ciclo, y por lo tanto la regla 5 no lo mira.
 *
 * Nada obliga a que `establishes` diga la verdad sobre los efectos. El proceso de
 * abajo es idéntico al que `admit.test.ts` rechaza citando «82.857 de stamina por
 * vuelta»; lo único que cambia es que no promete nada por escrito. En el mundo
 * hace exactamente lo mismo: sube la piedra a 400 °C, y la criatura después le
 * saca el aliento con la piedra-batería. El lazo sigue estando; lo que se fue es
 * la única regla que lo podía ver.
 */
describe('la regla 5 corre sobre lo que el proceso DICE, no sobre lo que hace', () => {
  const PIEDRA_BATERIA_VIEJA = proceso('piedra-bateria-vieja', {
    roles: [
      { name: 'piedra', where: [{ q: 'temperature', op: '>=', v: 400 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
    ],
    arrangement: { k: 'held' },
    effects: [{ k: 'transfer', q: 'stamina', from: 'piedra', to: 'actor', perTick: 10 }],
    completion: { at: 10, yields: [] },
    establishes: ['stamina>=100'],
  })

  const conVieja = buildSeedPhysics({
    processes: [...SEED_PROCESSES, PIEDRA_BATERIA_VIEJA],
  })

  it('con `establishes` puesto, la regla 5 rechaza el ciclo', () => {
    expect(tieneCodigo(admit(FROTAR_PARA_LA_BATERIA, conVieja), 'ciclo-rentable')).toBe(true)
  })

  const CALLADO = proceso('frotar-callado', {
    ...FROTAR_PARA_LA_BATERIA,
    id: 'frotar-callado',
    establishes: [], // ← el ataque entero
  })

  it('HUECO ABIERTO — el MISMO proceso sin `establishes` entra limpio', () => {
    expect(codigos(admit(CALLADO, conVieja))).toEqual([])
    expect(ciclosPor(CALLADO, conVieja).ciclos).toEqual([])
  })

  it.fails('PENDIENTE — el ciclo sigue estando en el mundo y la puerta ya no lo ve', () => {
    expect(admit(CALLADO, conVieja).ok).toBe(false)
  })
})
