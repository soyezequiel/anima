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
//   `it.fails(...)`  EL ATAQUE SE CUELA TODAVÍA. El cuerpo afirma lo que la
//                    puerta DEBERÍA hacer y hoy no hace, así que el test falla, y
//                    `it.fails` es la marca de «falla conocida». No está en verde
//                    fingiendo que anda: está en verde diciendo que está roto.
//                    Cada uno que queda trae escrito POR QUÉ queda.
//
// Los ocho agujeros que este archivo encontró, y en qué terminaron. Los ocho se
// midieron ANTES de tocar `admit.ts`; los siete primeros los cerró la reparación
// de las seis causas raíz.
//
//   1. CERRADO · `couple` no pasaba por la regla 2. Copiar temperatura de un
//      cuerpo a otro no drena nada de nadie. El espejo térmico. Ahora la regla 2
//      mira los `couple`, y como `Effect.couple` no tiene `poweredBy`, un acople
//      que puede subir no tiene con qué pagarse: se rechaza.
//   2. CERRADO · lo mismo para `temperature ← ignitionPoint`, que encendía
//      cualquier cosa por decreto.
//   3. CERRADO · escribir una cualidad DERIVADA en un proceso. `emitsPower ←
//      mass` hacía que una piedra irradiara por pesar. Ahora `cualidad-derivada`
//      también se emite sobre procesos, no solo sobre sustancias.
//   4. CERRADO · `transfer` tampoco pasaba por la regla 2 y no distinguía
//      intensivas de extensivas: mover 50 °C de una brasa a una olla cien veces
//      más pesada crea el calor de la olla. Ahora se compara `q · masa`.
//   5. CERRADO · un `drive` cuyo `toward` es el piso que el rol exige se leía
//      como «bajar». No baja: el rol es una condición de entrada y el propio
//      proceso se lleva la cualidad por abajo. Ver `pisoEfectivo`.
//   6. CERRADO · `stamina > 0` en el rol de la piedra-batería la volvía
//      admisible. Ahora el débito de un `transfer` está topado por lo que el rol
//      GARANTIZA, y «mayor que cero» garantiza cero.
//   7. CERRADO · `respalda()` decía «de dónde» y nunca «cuánto». Ahora la
//      cantidad se compara contra la cota del rol, con razón y con reparo.
//   8. CERRADO · `poweredBy` no tenía cierre dimensional: frotar una montaña
//      costaba lo mismo que frotar un guijarro. Ahora el trabajo se multiplica
//      por la masa que el rol garantiza. Ver `masaQuePaga`.

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
import { seg } from '../src/fixed.js'

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
      effects: [{ k: 'drive', q: 'temperature', on: 'a', toward: 900, porSegundo: 400 }],
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
          porSegundo: 200,
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
          porSegundo: 200,
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
      effects: [{ k: 'transfer', q: 'stamina', from: 'piedra', to: 'actor', porSegundo: 200 }],
      completion: { at: seg(0.5), yields: [] },
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
  it('CERRADO — copiar temperatura de un cuerpo a otro sin drenar nada se rechaza', () => {
    // Cerrado por la causa 1: la regla 2 dejó de mirar solo los `drive`. Un
    // `couple` no mueve nada del mundo, CREA — y no se puede pagar, porque
    // `Effect.couple` no tiene `poweredBy`. El día que haga falta un acople que
    // suba, el campo se le agrega al tipo; no se deja la puerta abierta.
    expect(admit(ESPEJO_TERMICO, phys).ok).toBe(false)
  })

  it('y el rechazo lo dice con «sube-gratis», citando el rol y el techo', () => {
    const v = admit(ESPEJO_TERMICO, phys)
    expect(tieneCodigo(v, 'sube-gratis')).toBe(true)
    const r = v.razones.find((x) => x.codigo === 'sube-gratis')!
    expect(r.regla).toBe(2)
    expect(r.q).toBe('temperature')
    expect(r.rol).toBe('fria')
  })

  it('y el saldo declarado del espejo sigue siendo cero: la regla 5 nunca lo iba a ver', () => {
    // Queda como evidencia de POR QUÉ el agujero 1 tenía que cerrarse en la regla
    // 2 y no en la 5: `saldoDeclarado` solo cuenta `couple` sobre conservadas, así
    // que un ciclo que pasara por acá sumaría cero y la regla 5 no lo vería jamás.
    // Un ataque que ninguna regla ve no se arregla en la regla equivocada.
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
  it('CERRADO — «tu temperatura sigue a tu punto de ignición» se rechaza', () => {
    expect(admit(ENCENDER_POR_DECRETO, phys).ok).toBe(false)
  })

  it('y el cierre dimensional sigue sin ser el que lo ataja: los rangos SÍ encajan', () => {
    // Importa que quede escrito: `ignitionPoint ∈ [0, 2000]` entra en
    // `temperature ∈ [−100, 2000]` y las dos son intensivas, así que
    // `acople-inconmensurable` no dice nada acá. Lo que lo para es la regla 2:
    // el acople puede SUBIR y no tiene con qué pagarlo.
    const v = admit(ENCENDER_POR_DECRETO, phys)
    expect(tieneCodigo(v, 'acople-inconmensurable')).toBe(false)
    expect(tieneCodigo(v, 'sube-gratis')).toBe(true)
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
  it('CERRADO — «emitís potencia igual a tu masa» se rechaza', () => {
    expect(admit(PIEDRA_QUE_IRRADIA, phys).ok).toBe(false)
  })

  it('CERRADO — y ahora sí hay un código para decirlo sobre un proceso', () => {
    // `cualidad-derivada` existía como `Codigo` y solo lo emitía
    // `revisarValorDeSustancia`. Ahora lo emite también `reglaCierreYCotas` sobre
    // TODO efecto que escriba una derivada, sea `drive`, `couple`, `transfer` o
    // `drain`: una derivada no se escribe, se deriva.
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
  effects: [{ k: 'transfer', q: 'temperature', from: 'brasa', to: 'olla', porSegundo: 1000 }],
  completion: { at: seg(2), yields: [] },
})

describe('agujero 4 · transfer de una cualidad intensiva', () => {
  it('CERRADO — mover 50 °C de una brasa a un lago se rechaza', () => {
    expect(admit(BOMBA_DE_CALOR, phys).ok).toBe(false)
  })

  it('CERRADO — y ahora sí hay un reparo sobre la cualidad que se está moviendo', () => {
    // Antes, el único reparo que levantaba este proceso era
    // `completion-sin-rendimientos`, que habla del completion y no del
    // `transfer`. Sobre la temperatura que se duplicaba, silencio. Ahora el
    // `transfer` cobra el mismo reparo de cantidad que el `drain`: mueve 2000 de
    // temperatura en 40 ticks y el rol «brasa» solo garantiza 400.
    const v = admit(BOMBA_DE_CALOR, phys)
    expect(v.advertencias.some((r) => r.q === 'temperature')).toBe(true)
  })

  it('y el rechazo nombra la magnitud intensiva, que es de lo que se trata', () => {
    // `temperature` es intensiva: la energía es `masa · calor específico · ΔT`.
    // El rol «olla» pide `mass >= 100` y no acota por arriba, así que no hay
    // ningún número con el que comparar — y lo que no se puede juzgar no entra.
    const r = admit(BOMBA_DE_CALOR, phys).razones.find((x) => x.codigo === 'magnitud-intensiva')!
    expect(r.q).toBe('temperature')
    expect(r.rol).toBe('olla')
    expect(r.mensaje).toContain('masa')
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
    { k: 'drain', q: 'stamina', on: 'actor', porSegundo: 20 },
    { k: 'drive', q: 'stamina', on: 'actor', toward: 50, porSegundo: 200 },
  ],
  completion: { at: seg(0.5), yields: [{ k: 'split', role: 'actor', at: 'grain' }] },
})

describe('agujero 5 · un drive hacia el piso del propio rol', () => {
  it('CERRADO — recargar stamina hasta el umbral de entrada se rechaza', () => {
    expect(admit(RECARGADOR, phys).ok).toBe(false)
  })

  it('y lo rechaza la regla 1, que es la que corresponde: sube una conservada', () => {
    // `pisoEfectivo` es la reparación: el umbral del rol solo vale como piso
    // mientras el proceso no se lleve la cualidad por abajo él mismo. Éste tiene
    // un `drain` de stamina sobre el MISMO rol, así que el piso real es el del
    // catálogo (cero) y el `drive` hacia 50 sube, no baja.
    expect(tieneCodigo(admit(RECARGADOR, phys), 'conservacion-drive')).toBe(true)
  })

  it('y la puerta de atrás que abría —el poweredBy sin revisar— ya no lleva a ningún lado', () => {
    // El `poweredBy` de un `drive` sobre una cuenta conservada sigue sin
    // revisarse (la regla 2 abre con `if (esConservada(e.q)) continue`), y está
    // bien que sea así: la regla 1 lo mata antes, con mejor mensaje. Lo que
    // cambió es que ahora la regla 1 efectivamente lo mata. Eficiencia 99 desde
    // una cualidad que ni es conservada, y el veredicto ya no sale limpio.
    const descarado = proceso('recargar-con-eficiencia-99', {
      ...RECARGADOR,
      id: 'recargar-con-eficiencia-99',
      effects: [
        { k: 'drain', q: 'stamina', on: 'actor', porSegundo: 20 },
        {
          k: 'drive',
          q: 'stamina',
          on: 'actor',
          toward: 50,
          porSegundo: 200,
          poweredBy: { from: 'actor', q: 'moisture', efficiency: 99 },
        },
      ],
    })
    const v = admit(descarado, phys)
    expect(v.ok).toBe(false)
    expect(tieneCodigo(v, 'conservacion-drive')).toBe(true)
  })

  it('y el filo es exactamente el `<=`: un decimal más arriba y lo agarra', () => {
    // Esto no es un agujero, es la PRUEBA de dónde está el borde: la puerta
    // funciona para todo `toward` estrictamente mayor que el piso del rol, y se
    // apaga justo en la igualdad, que es donde el ataque vive.
    const unPeloMas = proceso('recargar-un-pelo-mas', {
      ...RECARGADOR,
      id: 'recargar-un-pelo-mas',
      effects: [
        { k: 'drain', q: 'stamina', on: 'actor', porSegundo: 20 },
        { k: 'drive', q: 'stamina', on: 'actor', toward: 50.0001, porSegundo: 200 },
      ],
    })
    expect(tieneCodigo(admit(unPeloMas, phys), 'conservacion-drive')).toBe(true)
  })

  it('y el saldo declarado dejó de mentir al revés: da POSITIVO, que es lo que el proceso hace', () => {
    // Antes `trabajoDe` devolvía 0 porque `recorrido = toward − lo = 0`, y el
    // recargador entraba en la contabilidad de la regla 5 como un proceso que
    // solo gasta: −10. Con el piso efectivo, el recorrido son los 50 enteros, así
    // que el saldo es +50 de recarga menos los 10 del drain. Un ciclo que pase por
    // acá ahora suma positivo y la regla 5 lo puede ver.
    expect(saldoDeclarado(RECARGADOR, 'stamina', phys)).toBe(40)
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
  effects: [{ k: 'transfer', q: 'stamina', from: 'piedra', to: 'actor', porSegundo: 200 }],
  completion: { at: seg(0.5), yields: [] },
  establishes: ['stamina>=100'],
})

const FROTAR_PARA_LA_BATERIA = proceso('frotar-para-la-bateria', {
  roles: [
    { name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 50 }] },
  ],
  arrangement: { k: 'held' },
  // Sin `poweredBy` propio: hereda el de `friccion`, que es de lo que este clon es
  // un clon. Estaba escrito `efficiency: 0.35` a mano, o sea copiando el valor de
  // la calibración, y se puso rojo cuando pasó a 0,85 (tramo N).
  effects: [DRIVE_DE_FRICCION],
  establishes: ['temperature>=400'],
})

describe('agujero 6 · pedir una cualidad es garantizarla', () => {
  it('CERRADO — la piedra-batería con `stamina > 0` en el rol se rechaza', () => {
    expect(admit(PIEDRA_BATERIA_V2, phys).ok).toBe(false)
  })

  it('y el rechazo es por CANTIDAD: «mayor que cero» garantiza cero', () => {
    // La reparación de la causa 2. `respalda()` sigue diciendo que sí —el rol
    // pide la cualidad— pero eso ya no alcanza: mover 100 de stamina desde un rol
    // que garantiza 0 es sacar 100 de la nada, y ahora se dice con los dos
    // números. `respalda` contesta «de dónde»; la cota del rol contesta «cuánto».
    const r = admit(PIEDRA_BATERIA_V2, phys).razones.find((x) => x.codigo === 'conservacion-transfer')!
    expect(r.regla).toBe(1)
    expect(r.q).toBe('stamina')
    expect(r.encontrado).toBe(100)
    expect(r.cota).toBe(0)
  })

  it('el ciclo existe y la regla 5 lo enumera', () => {
    // El grafo está bien: la puerta VE el lazo. Lo que falla es la cuenta.
    const con = buildSeedPhysics({ processes: [...SEED_PROCESSES, PIEDRA_BATERIA_V2] })
    const b = ciclosPor(FROTAR_PARA_LA_BATERIA, con)
    const rutas = b.ciclos.map((c) => c.procesos.join(' → '))
    expect(rutas).toContain('frotar-para-la-bateria → piedra-bateria-v2 → frotar-para-la-bateria')
  })

  it('CERRADO — y el saldo del ciclo vuelve a dar positivo, así que la regla 5 lo rechaza', () => {
    const con = buildSeedPhysics({ processes: [...SEED_PROCESSES, PIEDRA_BATERIA_V2] })
    expect(tieneCodigo(admit(FROTAR_PARA_LA_BATERIA, con), 'ciclo-rentable')).toBe(true)
  })

  it('CERRADO — y el transfer que crea 100 de aliento ya no declara costo cero', () => {
    // El daño colateral era peor que el directo: como `respalda` decía que sí, el
    // débito valía lo mismo que el crédito y el `transfer` pasaba a valer CERO —
    // con lo cual el ciclo frotar → batería → frotar dejaba de dar positivo y la
    // regla 5 se apagaba sola. Ahora el débito está topado por la garantía.
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
  effects: [{ k: 'transfer', q: 'nutrition', from: 'miga', to: 'peniasco', porSegundo: 100 }],
  completion: { at: seg(5), yields: [] },
})

describe('agujero 7 · respalda() dice «de dónde», nunca «cuánto»', () => {
  it('CERRADO — 500 de nutrición desde un rol que garantiza «más que cero» se rechaza', () => {
    expect(admit(TRASVASE, phys).ok).toBe(false)
  })

  it('CERRADO — y ahora el transfer tiene el mismo reparo que el drain', () => {
    const v = admit(TRASVASE, phys)
    expect(v.advertencias.some((r) => r.codigo === 'costo-mayor-que-la-garantia')).toBe(true)
  })

  it('y la bomba que el comentario de `quality.ts` mandaba atajar también se nombra', () => {
    // `nutrition` es INTENSIVA: el número es por unidad de masa. Transferirlo de
    // una miga a un peñasco multiplica el total por la razón de masas, que es
    // exactamente lo que `quality.ts` avisó desde el primer día. El rol
    // «peniasco» pide `mass >= 100` y no acota por arriba: indecidible, y lo
    // indecidible no entra.
    expect(tieneCodigo(admit(TRASVASE, phys), 'magnitud-intensiva')).toBe(true)
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
  // Igual que el clon de arriba: hereda el `poweredBy` de `friccion` en vez de
  // copiar el número. Y acá importa el DOBLE, porque el bloque de abajo afirma que
  // la razón entre los dos precios es exactamente 5000 —la masa y nada más—: con
  // la eficiencia copiada, esa razón se ensuciaba con el cociente de eficiencias
  // en cuanto la calibración se moviera, y eso es lo que pasó.
  effects: [DRIVE_DE_FRICCION],
  establishes: ['temperature>=400'],
})

describe('agujero 8 · poweredBy no tiene cierre dimensional', () => {
  it('el proceso entra sin una sola razón', () => {
    // Esto no está marcado como pendiente porque el proceso, leído solo, es
    // legal: declara su fuente, es conservada, y la eficiencia es la de
    // `friccion`, que el guardián de la conservación deja pasar. Lo que está mal
    // es el PRECIO, y eso se ve en el test de abajo.
    expect(codigos(admit(FROTAR_LA_MONTANIA, phys))).toEqual([])
  })

  it('CERRADO — calentar 5000 de masa ya no cuesta lo mismo que calentar una', () => {
    const montania = saldoDeclarado(FROTAR_LA_MONTANIA, 'stamina', phys)
    const guijarro = saldoDeclarado(FRICCION, 'stamina', phys)
    // Cuesta MÁS (saldo más negativo). Antes eran idénticos.
    expect(montania).toBeLessThan(guijarro)
  })

  it('y cuesta exactamente 5000 veces más, que es la masa que el rol garantiza', () => {
    // `masaQuePaga` es la reparación, y es una subestimación DECLARADA: sin cota
    // de masa se cobra por UNA unidad. Cobrar por el máximo del rango —diez mil—
    // mataría a `friccion`, que es el primer fuego de la partida, y una puerta
    // que rechaza todo es trivialmente segura y completamente inútil.
    const montania = saldoDeclarado(FROTAR_LA_MONTANIA, 'stamina', phys)
    const guijarro = saldoDeclarado(FRICCION, 'stamina', phys)
    expect(montania / guijarro).toBeCloseTo(5000, 6)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE III · LA REGLA 5 SE APAGA BORRANDO UN STRING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El grafo de la regla 5 se armaba con `habilita()`, que se armaba con
 * `promesasDe()`, que lee `establishes` — un array de strings que escribe quien
 * propone el proceso. Un proceso con `establishes: []` no tenía ninguna arista de
 * salida, y por lo tanto no estaba en ningún ciclo, y por lo tanto la regla 5 no
 * lo miraba.
 *
 * Nada obligaba a que `establishes` dijera la verdad sobre los efectos. El proceso
 * de abajo es idéntico al que `admit.test.ts` rechaza citando «82.857 de stamina
 * por vuelta»; lo único que cambia es que no promete nada por escrito. En el mundo
 * hace exactamente lo mismo: sube la piedra a 400 °C, y la criatura después le
 * saca el aliento con la piedra-batería.
 *
 * CERRADO por `promesasEfectivas`: el grafo se arma con lo que el proceso HACE
 * —los `drive` y su `toward`— además de con lo que dice. Borrar un string ya no
 * borra una arista.
 */
describe('la regla 5 corre sobre lo que el proceso DICE, no sobre lo que hace', () => {
  const PIEDRA_BATERIA_VIEJA = proceso('piedra-bateria-vieja', {
    roles: [
      { name: 'piedra', where: [{ q: 'temperature', op: '>=', v: 400 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
    ],
    arrangement: { k: 'held' },
    effects: [{ k: 'transfer', q: 'stamina', from: 'piedra', to: 'actor', porSegundo: 200 }],
    completion: { at: seg(0.5), yields: [] },
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

  it('CERRADO — el ciclo sigue estando en el mundo, y ahora la puerta lo ve igual', () => {
    expect(admit(CALLADO, conVieja).ok).toBe(false)
    expect(tieneCodigo(admit(CALLADO, conVieja), 'ciclo-rentable')).toBe(true)
  })

  it('CERRADO — el MISMO proceso sin `establishes` ya no se queda sin aristas', () => {
    // La arista sale del `drive` hacia 400, que es lo que el proceso hace y no
    // depende de que nadie lo escriba. La ruta es la misma que con `establishes`.
    const rutas = ciclosPor(CALLADO, conVieja).ciclos.map((c) => c.procesos.join(' → '))
    expect(rutas).toContain('frotar-callado → piedra-bateria-vieja → frotar-callado')
  })
})
