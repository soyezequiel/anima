// ─── ATAQUE 2 · masa y nutrición de la nada, contra la puerta YA REPARADA ─────
//
// Segunda vuelta. La primera dejó seis causas raíz y las seis se repararon; la
// más profunda —intensiva contra extensiva, el producto `q · masa`— es CÓDIGO
// NUEVO, y el código nuevo tiene bordes. Este archivo va a buscar esos bordes.
//
// LA PREGUNTA QUE ORGANIZA EL ARCHIVO, y sale de leer la reparación: todas las
// cuentas de conservación de `admit()` se hacen POR EFECTO. `reglaConservacion`
// recorre `for (const q of conservadas) for (const e of p.effects)` y juzga cada
// efecto contra el total que entra, sin llevar NUNCA un acumulado. O sea que lo
// que entra una vez puede pagar N veces, con solo escribir N efectos.
//
// Y la segunda: `masaMaxima()` lee el `mass <= x` del ROL, que es una condición
// de ENTRADA. La propia puerta ya aprendió eso del otro lado —`pisoEfectivo()`
// existe justamente porque «el `where` se comprueba al empezar y nadie lo
// sostiene después»—, pero el techo de masa no tiene su gemelo: un proceso que
// le mete masa al cuerpo mientras corre se juzga contra el peso que el cuerpo
// tenía al entrar.
//
// CÓMO SE LEE
//
//   · `it(...)` normal   → la puerta ACIERTA. O rechaza lo que hay que rechazar,
//                          o acepta lo que hay que aceptar. Queda de regresión.
//   · `it(«CERRADO ·»)`  → era un hueco abierto y la reparación lo tapó. El cuerpo
//                          del test no cambió ni una línea: lo único que cambió es
//                          que ahora pasa.
//
// LOS CINCO ESTÁN CERRADOS, y con tres reparaciones:
//
//   · el PRESUPUESTO ACUMULADO en la regla 1 —lo que entra una vez ya no paga N
//     veces— cierra «dos bocas» y «dos caños»;
//   · `techoEfectivo` —el `mass <= x` del rol más lo que el propio proceso le mete
//     al cuerpo— cierra «engordar el tronco v2», y `mass <= 0` pasó a ser
//     `rol-irrealizable` («un cuerpo de masa cero no es un cuerpo»), que cierra «la
//     miga que no pesa»;
//   · `rolesQueAportan` saca los roles de `drawFromStock` del presupuesto: lo que el
//     dios da, lo da una vez, y cierra «el río paga dos veces».

import { describe, expect, it } from 'vitest'
import { admit, porQue, tieneCodigo, type Verdict } from '../src/admit.js'
import { buildSeedPhysics } from '../src/physics.js'
import { SEED_PROCESSES, PHYSICS_VERSION, type Process } from '../src/process.js'
import { seg } from '../src/fixed.js'

const phys = buildSeedPhysics()

/** Deja el veredicto entero en la salida del test. La evidencia es esto. */
function mostrar(nombre: string, v: Verdict): Verdict {
  console.log(`\n── ${nombre} ──\n${porQue(v)}`)
  return v
}

const proc = (id: string, extra: Partial<Process>): Process => ({
  id,
  lexeme: { nombre: id },
  roles: [{ name: 'a', where: [] }],
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

// ═══ 1 · LO QUE ENTRA UNA VEZ PAGA N VECES ══════════════════════════════════
//
// La cuenta es por efecto y nunca acumulada. Ningún efecto miente por su cuenta:
// cada uno, mirado solo, cierra clavado. Lo que no cierra es la SUMA, y la suma
// no la mira nadie.

describe('la conservación se juzga por efecto y nunca en total', () => {
  // Una miga que garantiza `nutrition > 9` y `mass >= 1`: entran 9 de
  // nutrición · masa, y la puerta lo calcula bien (`entraExtensivoDe`). Dos
  // panes de `mass <= 1` reciben 9 cada uno. Cada `drive`, mirado solo:
  // 9 · 1 = 9 contra 9 que entran → cierra exacto. Los dos juntos: 18 contra 9.
  //
  // Es la bomba de materia de la primera vuelta con una línea de más, y sobrevive
  // ENTERA a la reparación de la causa 3, porque la reparación también cuenta por
  // efecto.
  it('CERRADO · dos bocas comen la misma miga: 9 de nutrición pagan 18', () => {
    const p = proc('dos-bocas-una-miga', {
      roles: [
        {
          name: 'miga',
          where: [
            { q: 'nutrition', op: '>', v: 9 },
            { q: 'mass', op: '>=', v: 1 },
          ],
        },
        { name: 'pan1', where: [{ q: 'mass', op: '<=', v: 1 }] },
        { name: 'pan2', where: [{ q: 'mass', op: '<=', v: 1 }] },
      ],
      effects: [
        { k: 'drive', q: 'nutrition', on: 'pan1', toward: 9, porSegundo: 20 },
        { k: 'drive', q: 'nutrition', on: 'pan2', toward: 9, porSegundo: 20 },
      ],
      completion: { at: seg(0.45), yields: [{ k: 'transmute', role: 'miga' }] },
    })
    const v = mostrar('dos-bocas-una-miga', admit(p, phys))
    // Entra 9 de nutrición·masa y salen 18. Tendría que rechazar.
    expect(v.ok).toBe(false)
  })

  // Lo mismo sobre `mass`, que es EXTENSIVA y por eso ni siquiera pasa por el
  // código nuevo: dos caños salen de la misma cantera, cada uno se lleva
  // exactamente lo que la cantera garantiza, y salen dos veces.
  it('CERRADO · dos caños vacían la misma cantera: 100 garantizados dan 200', () => {
    const p = proc('dos-canios-una-cantera', {
      roles: [
        { name: 'cantera', where: [{ q: 'mass', op: '>=', v: 100 }] },
        { name: 'balde1', where: [] },
        { name: 'balde2', where: [] },
      ],
      effects: [
        { k: 'transfer', q: 'mass', from: 'cantera', to: 'balde1', porSegundo: 200 },
        { k: 'transfer', q: 'mass', from: 'cantera', to: 'balde2', porSegundo: 200 },
      ],
      completion: { at: seg(0.5), yields: [] },
    })
    const v = mostrar('dos-canios-una-cantera', admit(p, phys))
    expect(v.ok).toBe(false)
  })
})

// ═══ 2 · EL TECHO DE MASA ES UNA CONDICIÓN DE ENTRADA ═══════════════════════
//
// `masaMaxima()` es el corazón de la reparación de la causa 3: sin `mass <= x`
// en el rol de destino, la puerta rechaza por indecidible. Con `mass <= x`,
// juzga contra ese x. Pero x es lo que el cuerpo pesaba AL ENTRAR, y el mismo
// proceso puede engordarlo mientras corre.
//
// La puerta ya sabe que esto pasa del otro lado: `pisoEfectivo()` existe porque
// «`Role.where` es una condición de ENTRADA, no un invariante». No hay
// `techoEfectivo()`.

describe('el mass <= x del rol no sobrevive al propio proceso', () => {
  it('CERRADO · engordar el tronco v2: se declara mass <= 1 y se le transfieren 100', () => {
    const p = proc('el-techo-no-es-invariante', {
      roles: [
        {
          name: 'miga',
          where: [
            { q: 'nutrition', op: '>', v: 9 },
            { q: 'mass', op: '>=', v: 1 },
          ],
        },
        { name: 'cantera', where: [{ q: 'mass', op: '>=', v: 100 }] },
        // Con este `mass <= 1`, `revisarIntensiva` juzga 9 · 1 = 9 contra los 9
        // que entran: cierra clavado. Y abajo se le meten 100 de masa.
        { name: 'masa', where: [{ q: 'mass', op: '<=', v: 1 }] },
      ],
      effects: [
        { k: 'drive', q: 'nutrition', on: 'masa', toward: 9, porSegundo: 20 },
        { k: 'transfer', q: 'mass', from: 'cantera', to: 'masa', porSegundo: 200 },
      ],
      completion: { at: seg(0.5), yields: [{ k: 'transmute', role: 'miga' }] },
    })
    const v = mostrar('el-techo-no-es-invariante', admit(p, phys))
    // La masa entra por la puerta de al lado: el cuerpo termina pesando 101 con
    // nutrition 9, o sea 909 de nutrición·masa, contra 9 que entraron.
    expect(v.ok).toBe(false)
  })

  // El borde exacto de la masa cero. `revisarIntensiva` compara con `>`
  // estricto: cuando el rol declara `mass <= 0`, `sale = 9 · 0 = 0` y lo que
  // entra también es 0 —la miga no promete un gramo—, así que `0 > 0` es falso
  // y el `drive` pasa. Después se le transfiere la masa por otro efecto.
  //
  // Es la versión más pura del ataque: NO entra ni un gramo de nutrición·masa, y
  // sale un cuerpo de masa 100 con nutrición 9.
  it('CERRADO · la miga que no pesa: 0 > 0 es falso, y el cero se puede engordar', () => {
    const p = proc('la-miga-que-no-pesa', {
      roles: [
        { name: 'miga', where: [{ q: 'nutrition', op: '>', v: 9 }] },
        { name: 'cantera', where: [{ q: 'mass', op: '>=', v: 100 }] },
        { name: 'masa', where: [{ q: 'mass', op: '<=', v: 0 }] },
      ],
      effects: [
        { k: 'drive', q: 'nutrition', on: 'masa', toward: 9, porSegundo: 20 },
        { k: 'transfer', q: 'mass', from: 'cantera', to: 'masa', porSegundo: 200 },
      ],
      completion: { at: seg(0.5), yields: [{ k: 'transmute', role: 'miga' }] },
    })
    const v = mostrar('la-miga-que-no-pesa', admit(p, phys))
    expect(v.ok).toBe(false)
  })
})

// ═══ 3 · EL AGUJERO DEL DIOS, COBRADO DOS VECES ═════════════════════════════

describe('drawFromStock paga el pescado y además paga un drive', () => {
  // `consumedRoles()` mete el rol de `drawFromStock` entre lo consumido, y
  // `entraExtensivoDe()` le cuenta al banco de peces su `nutrition · mass`
  // garantizado como INSUMO. Pero de ese banco ya sale un cuerpo entero por el
  // rendimiento: el stock paga el pescado Y paga, además, la nutrición que se le
  // escribe a un tercer cuerpo que no tiene nada que ver.
  //
  // La regla 5 lo ve —`ciclo-con-aporte`— pero eso es una ADVERTENCIA, no cierra
  // la puerta, y con razón: el saldo del stock es estado del mundo. Lo que sí es
  // de la puerta es que el mismo aporte se cobre dos veces en el mismo proceso.
  it('CERRADO · el río paga dos veces: sale el pescado y además 900 de nutrición·masa', () => {
    const p = proc('el-rio-paga-dos-veces', {
      roles: [
        {
          name: 'banco',
          where: [
            { q: 'mass', op: '>=', v: 1000 },
            { q: 'nutrition', op: '>=', v: 8 },
          ],
        },
        { name: 'plato', where: [{ q: 'mass', op: '<=', v: 100 }] },
      ],
      effects: [{ k: 'drive', q: 'nutrition', on: 'plato', toward: 8, porSegundo: 20 }],
      completion: { at: seg(0.4), yields: [{ k: 'drawFromStock', of: 'banco', into: 'hands' }] },
    })
    const v = mostrar('el-rio-paga-dos-veces', admit(p, phys))
    expect(v.ok).toBe(false)
  })
})

// ═══ 4 · LO QUE LA PUERTA SÍ ATAJA ══════════════════════════════════════════
//
// Estos rebotaron. Quedan de regresión: son los bordes de la causa 3 que la
// reparación SÍ cubrió, y si mañana alguien afloja `magnitud-intensiva` esto se
// pone rojo.

describe('los bordes de la causa 3 que la reparación sí cerró', () => {
  it('un rol de destino SIN cota de masa: rechazado por indecidible', () => {
    const p = proc('destino-sin-cota', {
      roles: [
        {
          name: 'miga',
          where: [
            { q: 'nutrition', op: '>', v: 9 },
            { q: 'mass', op: '>=', v: 1 },
          ],
        },
        { name: 'pan', where: [] },
      ],
      effects: [{ k: 'drive', q: 'nutrition', on: 'pan', toward: 9, porSegundo: 20 }],
      completion: { at: seg(0.45), yields: [{ k: 'transmute', role: 'miga' }] },
    })
    expect(tieneCodigo(admit(p, phys), 'magnitud-intensiva')).toBe(true)
  })

  it('un insumo SIN masa garantizada no aporta ni una caloría: rechazado', () => {
    const p = proc('insumo-sin-masa', {
      roles: [
        // Sin `mass >= x`: de este cuerpo no se puede contar con ningún gramo, y
        // por lo tanto con ninguna caloría. `entraExtensivoDe` da 0.
        { name: 'miga', where: [{ q: 'nutrition', op: '>', v: 9 }] },
        { name: 'pan', where: [{ q: 'mass', op: '<=', v: 1 }] },
      ],
      effects: [{ k: 'drive', q: 'nutrition', on: 'pan', toward: 9, porSegundo: 20 }],
      completion: { at: seg(0.45), yields: [{ k: 'transmute', role: 'miga' }] },
    })
    expect(tieneCodigo(admit(p, phys), 'magnitud-intensiva')).toBe(true)
  })

  it('mover nutrición a un cuerpo sin cota de masa: rechazado', () => {
    const p = proc('trasvase-sin-cota', {
      roles: [
        {
          name: 'origen',
          where: [
            { q: 'nutrition', op: '>=', v: 9 },
            { q: 'mass', op: '>=', v: 100 },
          ],
        },
        { name: 'destino', where: [] },
      ],
      effects: [{ k: 'transfer', q: 'nutrition', from: 'origen', to: 'destino', porSegundo: 20 }],
      completion: { at: seg(0.45), yields: [] },
    })
    expect(tieneCodigo(admit(p, phys), 'magnitud-intensiva')).toBe(true)
  })

  it('sacar más masa de la que el rol garantiza, en UN solo caño: rechazado', () => {
    const p = proc('un-canio-goloso', {
      roles: [
        { name: 'cantera', where: [{ q: 'mass', op: '>=', v: 100 }] },
        { name: 'balde', where: [] },
      ],
      effects: [{ k: 'transfer', q: 'mass', from: 'cantera', to: 'balde', porSegundo: 400 }],
      completion: { at: seg(0.5), yields: [] },
    })
    expect(tieneCodigo(admit(p, phys), 'conservacion-transfer')).toBe(true)
  })
})

// ═══ 5 · LA REGLA DE ORO ════════════════════════════════════════════════════
//
// Una puerta que rechaza todo es trivialmente segura y completamente inútil.

describe('la puerta sigue dejando pasar lo que tiene que pasar', () => {
  it('los cuatro procesos semilla entran sin una sola razón en contra', () => {
    for (const p of SEED_PROCESSES) {
      const v = admit(p, phys)
      expect([p.id, v.razones.map((r) => r.codigo)]).toEqual([p.id, []])
    }
  })

  it('un proceso de nutrición HONESTO —uno solo, y la cuenta cierra— entra', () => {
    // Se consume médula (nutrition 18) de al menos 1 de masa: entran 18 de
    // nutrición·masa. Se escriben 9 en un cuerpo de hasta 2 de masa: salen 18.
    // Cierra exacto, y la puerta lo deja pasar. Esto es lo que prueba que
    // `magnitud-intensiva` no es un «rechazar todo» disfrazado.
    const p = proc('repartir-la-medula', {
      roles: [
        {
          name: 'fuente',
          where: [
            { q: 'nutrition', op: '>=', v: 18 },
            { q: 'mass', op: '>=', v: 1 },
          ],
        },
        { name: 'porcion', where: [{ q: 'mass', op: '<=', v: 2 }] },
      ],
      effects: [{ k: 'drive', q: 'nutrition', on: 'porcion', toward: 9, porSegundo: 20 }],
      completion: { at: seg(0.45), yields: [{ k: 'transmute', role: 'fuente' }] },
    })
    const v = mostrar('repartir-la-medula', admit(p, phys))
    expect(v.razones.map((r) => r.codigo)).toEqual([])
  })
})
