// ─── Segundo ataque adversario · contra la puerta REPARADA ───────────────────
//
// El primer adversario dejó 34 huecos y seis causas raíz. Están reparadas. Este
// archivo ataca LA REPARACIÓN: metadatos raros, roles fantasma, `establishes`
// mentirosos, números en el borde exacto de cada cota nueva, y —lo que más vale—
// procesos que pasan todas las reglas nuevas y aun así producen conducta absurda.
//
// LO QUE ENCONTRÓ, en una línea cada uno:
//
//   · `inverse` sigue sin leerse. La regla nueva del `couple` lee «el techo de lo
//     seguido entra por debajo del piso» como «esto solo baja», y con `inverse`
//     eso significa exactamente lo contrario: filo gratis y fuego gratis.
//   · La no-dominancia se ata a los NOMBRES de los roles y a la igualdad LITERAL
//     de los strings de `establishes`. Los dos los elige quien propone. Tres
//     evasiones de un carácter: renombrar un rol, meter un espacio, o pagar un
//     peaje de 1e-9 en otra cuenta conservada.
//   · `cotasDeRol` colapsa `<` en `<=` y `>` en `>=`, así que una contradicción
//     con desigualdad estricta no la ve ni `rol-contradictorio` ni
//     `compuerta-contradictoria`.
//   · `confianza-autodeclarada` cruza `trust` (autodeclarado) contra `provenance`
//     (también autodeclarado). Se esquiva escribiendo `by: 'semilla'`.
//   · `mass <= 0` en el destino apaga el chequeo de intensivas entero, porque
//     `0 > 0` es falso.
//   · Y la regla 5 RECHAZA un proceso honesto: dos sobre-aproximaciaones
//     declaradas —la arista por un solo test, y un saldo que no resta lo
//     consumido— se multiplican y dan un ciclo rentable que no existe.
//
// CONVENCIÓN DEL ARCHIVO, y hay que respetarla al leerlo:
//
//   it()             — la puerta hace lo correcto. Regresión: si mañana se rompe,
//                      grita.
//   it(«CERRADO ·»)  — era un `it.fails` y la reparación lo tapó. El cuerpo del test
//                      no cambió ni una línea: lo único que cambió es que ahora pasa.
//   it.fails()       — sigue abierto, con lo que falta escrito al lado.
//
// LOS DOCE AGUJEROS ESTÁN CERRADOS. Lo que los cerró:
//
//   1  `techoQueEscribeElAcople` lee `inverse` y compara contra el ESPEJO del piso
//      de lo seguido, no contra su techo.
//   2  la no-dominancia dejó de apoyarse en lo que escribe quien propone:
//      `comparaExigencias` cruza los roles por lo que PIDEN cuando los nombres no
//      coinciden, `prometeLoMismo` usa el mismo parser que la regla 5, y un drenaje
//      que el rol no respalda dejó de contar como costo (era el escudo del peaje de
//      1e-9 — la misma línea que denunciaba el peaje falso lo dejaba actuar).
//   3  con eso, «pescar a mano» vuelve a caer por dominancia con cualquier nombre.
//   4  `cotasEstrictasDeRol` no colapsa `>` en `>=`: `q >= 400 && q < 400` es vacío.
//   5  `trust: 'estable'` se cruza contra el único dato que quien propone NO
//      escribe: si la física ya lo tiene sellado con ese id.
//   6  el parser de promesas lee `≥` y `≤` además del ASCII.
//   7  `mass <= 0` es `rol-irrealizable`: un cuerpo de masa cero no es un cuerpo.
//   8  `saldoDeclarado` resta lo que el proceso consume para acreditar —una vez, no
//      una por efecto—, así que la regla 5 dejó de rechazar lo que la regla 1
//      aprueba. Y `habilita` ignora los tests que TODO cuerpo cumple.
//   9  una copia exacta es el caso degenerado de la dominancia, no una excepción.
//   10 el radio se mide en el punto fijo del mundo: lo que redondea a cero es cero.
//   11 `masaQuePaga` cobra por el TECHO, que es la cota del peor caso, y el reparo
//      de costo se cobra también sin `completion`.
//   12 medio cerrado: un cuerpo no puede pagar su propio cambio con algo que la
//      materia no lleva. La otra mitad quedó anotada con su `it.fails`.
//
// Nada de este archivo tocó `admit.ts` cuando se escribió. Encontrar, no reparar; la
// reparación vino después y se midió contra estos mismos tests.

import { describe, expect, it } from 'vitest'
import { admit, porQue, promesasDe, saldoDeclarado, tieneCodigo, tieneReparo } from '../src/admit.js'
import { buildSeedPhysics } from '../src/physics.js'
import {
  DESHILACHAR,
  EXTRACCION,
  FRICCION,
  PHYSICS_VERSION,
  SEED_PROCESSES,
  UNION,
  type Process,
} from '../src/process.js'

const phys = buildSeedPhysics()

/** Un proceso mínimo y plausible. Cada ataque le rompe una cosa por vez. */
const p = (id: string, extra: Partial<Process> = {}): Process => ({
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

// ═══════════════════════════════════════════════════════════════════════════
// LA REGLA DE ORO — lo primero, porque es lo que hace útil a todo lo demás.
// ═══════════════════════════════════════════════════════════════════════════

describe('la regla de oro: una puerta que rechaza todo es inútil', () => {
  for (const semilla of SEED_PROCESSES) {
    it(`«${semilla.id}» sigue entrando sin una sola razón en contra`, () => {
      const v = admit(semilla, phys)
      expect([semilla.id, v.razones.map((r) => r.codigo)]).toEqual([semilla.id, []])
      expect(v.ok).toBe(true)
    })
  }

  it('los cuatro juntos: friccion, union, deshilachar y extraccion', () => {
    for (const s of [FRICCION, UNION, DESHILACHAR, EXTRACCION]) {
      expect([s.id, admit(s, phys).ok]).toEqual([s.id, true])
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 1 · `inverse` sigue sin leerse, y ahora es peor que antes
// ═══════════════════════════════════════════════════════════════════════════
//
// La regla nueva del `couple` (`reglaAcoplesYTransferencias`) deja pasar un
// acople cuando «lo seguido entra entero por debajo del piso de lo que sigue»:
//
//     if (Number.isFinite(techoSeguido) && techoSeguido <= piso) continue // solo baja
//
// Esa lectura es DIRECCIONAL, y `follows.inverse` da vuelta la dirección. El
// campo existe en el tipo `Effect.couple`, se puede escribir, y la cadena
// «inverse» no aparece ni una sola vez en `admit.ts`. Entonces la condición que
// la puerta lee como «esto no puede subir nunca» es exactamente la condición que
// garantiza que SIEMPRE sube: si lo seguido está clavado en su mínimo, el
// invertido está clavado en su máximo.
//
// La reparación creyó cerrar `bomba-de-calor(couple inverse)`. Lo que cerró fue
// el caso donde el rol seguido no acota nada. Acotándolo por abajo, vuelve.

describe('★ AGUJERO · el `couple` con `inverse` entra por la puerta de «solo baja»', () => {
  /** «Tu filo sigue —al revés— la toxicidad de aquél, y aquél no es tóxico.» */
  const FILO_GRATIS = p('filo-por-decreto', {
    roles: [
      { name: 'a', where: [] },
      // Lo cumplen piedra, pedernal y agua: `toxicity` 0. La puerta lee un techo
      // de 0, o sea «lo seguido nunca pasa de cero», o sea «esto solo baja».
      { name: 'b', where: [{ q: 'toxicity', op: '<=', v: 0 }] },
    ],
    effects: [{ k: 'couple', q: 'sharpness', on: 'a', follows: { q: 'toxicity', of: 'b', inverse: true } }],
  })

  it('MEDIDO · ahora la puerta cita el ESPEJO: toxicity 0 escribiría sharpness 1', () => {
    const v = admit(FILO_GRATIS, phys)
    expect(v.ok).toBe(false)
    const r = v.razones.find((x) => x.codigo === 'sube-gratis')
    expect(r?.encontrado).toBe(1)
    expect(r?.mensaje).toContain('al revés')
    expect(porQue(v)).not.toBe('ADMITIDO')
  })

  it('CERRADO · DEBERÍA rechazarlo: con `inverse`, toxicity 0 escribe sharpness 1, gratis y para siempre', () => {
    // Filo máximo sin drenar ninguna cuenta conservada, sostenido mientras el
    // arreglo se sostenga, sobre una piedra que no es tóxica porque las piedras
    // no son tóxicas. Es el cuchillo gratis: toda la economía de herramientas
    // —lascar, afilar, gastar el filo— se cortocircuita con cuatro líneas.
    expect(admit(FILO_GRATIS, phys).ok).toBe(false)
  })

  /** La bomba de calor, que la reparación da por cerrada. Vuelve con una cota. */
  const BOMBA = p('bomba-de-calor-v2', {
    roles: [
      { name: 'a', where: [] },
      // −100 es el piso del catálogo de `temperature`. La puerta calcula
      // `techoSeguido = −100` y `piso = −100`, y `−100 <= −100` la convence.
      { name: 'b', where: [{ q: 'temperature', op: '<=', v: -100 }] },
    ],
    effects: [
      { k: 'couple', q: 'temperature', on: 'a', follows: { q: 'temperature', of: 'b', inverse: true } },
    ],
  })

  it('MEDIDO · y la bomba de calor cae con el mismo número: el espejo de −100 es 2000', () => {
    const r = admit(BOMBA, phys).razones.find((x) => x.codigo === 'sube-gratis')
    expect(r?.encontrado).toBe(2000)
  })

  it('CERRADO · DEBERÍA rechazarla: «me caliento tanto como frío esté el otro» es trabajo de la nada', () => {
    expect(admit(BOMBA, phys).ok).toBe(false)
  })

  it('el control: el MISMO acople sin `inverse` es correcto, y la puerta bien lo deja pasar', () => {
    // Esto es lo que la regla nueva cree estar admitiendo, y hace bien: la
    // toxicidad de «b» es cero, así que el filo de «a» solo puede bajar a cero.
    const bajaDeVerdad = p('filo-que-se-va', {
      roles: [
        { name: 'a', where: [] },
        { name: 'b', where: [{ q: 'toxicity', op: '<=', v: 0 }] },
      ],
      effects: [{ k: 'couple', q: 'sharpness', on: 'a', follows: { q: 'toxicity', of: 'b' } }],
    })
    expect(admit(bajaDeVerdad, phys).ok).toBe(true)
  })

  it('y el control por el otro lado: un acople que SÍ puede subir se rechaza con «sube-gratis»', () => {
    const sube = p('prender-por-acople-v2', {
      roles: [
        { name: 'a', where: [] },
        { name: 'b', where: [] },
      ],
      effects: [{ k: 'couple', q: 'sharpness', on: 'a', follows: { q: 'toxicity', of: 'b' } }],
    })
    expect(tieneCodigo(admit(sube, phys), 'sube-gratis')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 2 · la no-dominancia se esquiva con un carácter, de tres maneras
// ═══════════════════════════════════════════════════════════════════════════
//
// La regla 4 se llama a sí misma «la última puerta del almuerzo gratis» y la
// reparación le dedicó la reescritura más larga. Sigue apoyada en dos cosas que
// escribe quien propone y que el mundo no verifica:
//
//   · los NOMBRES de los roles (`comparaExigencias` los cruza con `baseRoleName`);
//   · la igualdad LITERAL de los strings de `establishes` (`contieneTodo` usa
//     `Array.includes`, o sea comparación de cadenas).
//
// Y una tercera, que es de forma: la comparación de costos es de Pareto y corta
// en el primer `costoNuevo > costoViejo`. Un peaje de 1e-9 en una cuenta que el
// viejo no toca vuelve «peor en alguna» a un proceso tres veces más barato.

/** El clon barato de `friccion`: misma técnica, eficiencia 0.35 → 0.99. */
const efectoBarato = (rolCalentado: string) =>
  ({
    k: 'drive',
    q: 'temperature',
    on: rolCalentado,
    toward: 400,
    perTick: 6,
    poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.99 },
  }) as const

describe('★ AGUJERO · la no-dominancia mira nombres de rol, y los nombres los elige quien propone', () => {
  const RENOMBRADO = p('frotar-renombrado', {
    // Idéntico a `friccion` salvo que el rol «a» se llama «primero».
    roles: [
      { name: 'primero', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
      { name: 'b', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
    ],
    effects: [efectoBarato('primero')],
    establishes: ['temperature>=400'],
  })

  it('el control: con los nombres de `friccion`, el clon barato SÍ lo agarra la regla 4', () => {
    const conNombresViejos = p('frotar-barato-2', {
      roles: [...FRICCION.roles],
      effects: [efectoBarato('a')],
      establishes: [...FRICCION.establishes],
    })
    expect(tieneCodigo(admit(conNombresViejos, phys), 'dominancia')).toBe(true)
  })

  it('MEDIDO · el renombrado ya no entra: los roles se cruzan por lo que PIDEN', () => {
    expect(admit(RENOMBRADO, phys).ok).toBe(false)
  })

  it('CERRADO · DEBERÍA decir «dominancia»: un rol renombrado es el mismo rol', () => {
    // `comparaExigencias` no encuentra «a» en el nuevo (→ exige menos), y después
    // encuentra «primero» en el nuevo y no en el viejo con `where.length > 0`
    // (→ 'incomparable'). O sea que renombrar CUALQUIER rol que pida algo apaga
    // la regla entera. Y todo proceso que hace algo pide algo de algún rol.
    expect(tieneCodigo(admit(RENOMBRADO, phys), 'dominancia')).toBe(true)
  })

  const ESPACIADO = p('frotar-espaciado', {
    // Idéntico a `friccion`, incluidos los nombres de rol. Lo único que cambia es
    // que la promesa se escribe con espacios alrededor del operador.
    roles: [...FRICCION.roles],
    effects: [efectoBarato('a')],
    establishes: ['temperature >= 400'],
  })

  it('la puerta PARSEA las dos promesas igual: `promesasDe` no ve ninguna diferencia', () => {
    // Ésta es la contradicción interna, y no hace falta discutirla: la puerta
    // tiene un parser de promesas, lo usa para la regla 5 y para `promesa-derivada`,
    // y NO lo usa para la no-dominancia, que compara los strings crudos.
    expect(promesasDe(ESPACIADO, phys)).toEqual(promesasDe(FRICCION, phys))
  })

  it('MEDIDO · y la regla 4 usa ahora el MISMO parser que la regla 5: el espacio no salva', () => {
    expect(admit(ESPACIADO, phys).ok).toBe(false)
  })

  it('CERRADO · DEBERÍA decir «dominancia»: «temperature >= 400» y «temperature>=400» son la misma promesa', () => {
    expect(tieneCodigo(admit(ESPACIADO, phys), 'dominancia')).toBe(true)
  })

  const PEAJE = p('frotar-con-peaje', {
    roles: [...FRICCION.roles],
    effects: [
      efectoBarato('a'),
      // Una milmillonésima de nutrición por tick. En el mundo no se nota; en la
      // regla 4 alcanza para que `costoNuevo > costoViejo` en `nutrition` y el
      // bucle corte con `peorEnAlguna` antes de mirar la stamina.
      { k: 'drain', q: 'nutrition', on: 'actor', perTick: 1e-9 },
    ],
    establishes: [...FRICCION.establishes],
  })

  it('MEDIDO · el peaje falso dejó de ser escudo, y es la MISMA línea la que lo dice', () => {
    const v = admit(PEAJE, phys)
    expect(v.ok).toBe(false)
    // La puerta ya sabía que ese peaje puede valer cero y lo decía como reparo. Ahora
    // `saldoDeclarado` le hace caso: un drenaje que el rol no respalda no es un costo.
    expect(tieneReparo(v, 'drenaje-sin-respaldo')).toBe(true)
  })

  it('CERRADO · DEBERÍA decir «dominancia»: 1e-9 de nutrición no compra 11 de stamina', () => {
    // Ahorra 11.09 de stamina por corrida (17.14 → 6.06) y paga 0.000000001 de
    // nutrición. La comparación de Pareto es defendible como forma; que un
    // infinitésimo la desarme, no.
    expect(tieneCodigo(admit(PEAJE, phys), 'dominancia')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 3 · pescar con la mano vuelve, y con esto se va el motor del juego
// ═══════════════════════════════════════════════════════════════════════════
//
// Es el agujero 2 aplicado al peor lugar posible. `pescar-con-la-mano` está en
// `ataque-reglas.test.ts` como uno de los once cerrados, y lo cierra la
// no-dominancia contra `extraccion`. Pero lo cierra porque el ataque le puso al
// rol el mismo nombre que le puso `extraccion`: «source». Con cualquier otro
// nombre, `comparaExigencias` contesta 'incomparable' y no hay regla que lo mire.

describe('★ AGUJERO · pescar con la mano, en un tick, renombrando un rol', () => {
  const A_MANO = p('pescar-a-mano', {
    roles: [{ name: 'stock', where: [{ q: 'mass', op: '>', v: 0 }] }],
    arrangement: { k: 'within', radius: 1 },
    completion: { at: 1, yields: [{ k: 'drawFromStock', of: 'stock', into: 'hands' }] },
  })

  it('el control: con el rol llamado «source», la puerta lo para con «dominancia»', () => {
    const conElNombreDeExtraccion = p('pescar-con-la-mano-2', {
      roles: [{ name: 'source', where: [{ q: 'mass', op: '>', v: 0 }] }],
      arrangement: { k: 'within', radius: 1 },
      completion: { at: 1, yields: [{ k: 'drawFromStock', of: 'source', into: 'hands' }] },
    })
    expect(tieneCodigo(admit(conElNombreDeExtraccion, phys), 'dominancia')).toBe(true)
  })

  it('MEDIDO · con el rol llamado «stock» la puerta lo para igual, y por lo mismo', () => {
    const v = admit(A_MANO, phys)
    expect(v.ok).toBe(false)
    expect(v.razones.map((r) => r.codigo)).toContain('dominancia')
  })

  it('CERRADO · DEBERÍA decir «dominancia»: saca del mismo stock que `extraccion`, en 1 tick y sin aparejo', () => {
    // `extraccion` cuesta 30 ticks y exige `reach >= 2` y `catch > 0`, o sea haber
    // aprendido a deshilachar y a atar una caña. Éste saca lo mismo en un tick,
    // sin gear, sin aliento y sin haber aprendido nada. El hambre deja de doler en
    // el tick 2 y con ella se va el motor de toda la historia.
    expect(tieneCodigo(admit(A_MANO, phys), 'dominancia')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 4 · la desigualdad estricta se cae del control de contradicciones
// ═══════════════════════════════════════════════════════════════════════════
//
// `cotasDeRol` colapsa los cuatro operadores en dos cotas cerradas:
//
//     if (t.op === '>=' || t.op === '>') { if (t.v > lo) lo = t.v }
//     else if (t.v < hi) hi = t.v
//
// O sea que `q > 400` y `q >= 400` producen el mismo `lo`, y `q < 400` y
// `q <= 400` el mismo `hi`. Entonces `q >= 400 && q < 400` da `lo === hi === 400`,
// y `lo > hi` —la única prueba de contradicción que hay— da falso. El proceso es
// código muerto que no se dispara jamás, que es EXACTAMENTE el fallo silencioso
// que `rol-contradictorio` y `compuerta-contradictoria` existen para evitar.

describe('★ AGUJERO · `>=` y `<` sobre el mismo número no cuentan como contradicción', () => {
  const COMPUERTA = p('compuerta-estricta', {
    gate: [
      { q: 'temperature', op: '>=', v: 400 },
      { q: 'temperature', op: '<', v: 400 },
    ],
  })

  it('el control: con `<=` la puerta SÍ ve la contradicción', () => {
    const conCerrado = p('compuerta-cerrada', {
      gate: [
        { q: 'temperature', op: '>=', v: 400 },
        { q: 'temperature', op: '<=', v: 399 },
      ],
    })
    expect(tieneCodigo(admit(conCerrado, phys), 'compuerta-contradictoria')).toBe(true)
  })

  it('MEDIDO · y el mensaje escribe el operador que corresponde, no un ≥ inventado', () => {
    const r = admit(COMPUERTA, phys).razones.find((x) => x.codigo === 'compuerta-contradictoria')
    expect(r?.mensaje).toContain('≥ 400 y < 400')
  })

  it('CERRADO · DEBERÍA decir «compuerta-contradictoria»: ningún número es ≥ 400 y < 400', () => {
    expect(tieneCodigo(admit(COMPUERTA, phys), 'compuerta-contradictoria')).toBe(true)
  })

  const ROL = p('rol-estricto', {
    roles: [
      {
        name: 'actor',
        where: [
          { q: 'stamina', op: '>=', v: 1 },
          { q: 'stamina', op: '<', v: 1 },
        ],
      },
    ],
    effects: [{ k: 'drain', q: 'stamina', on: 'actor', perTick: 0.1 }],
  })

  it('MEDIDO · y el control por el otro lado: `catch > 0` NO es contradictorio', () => {
    // `extraccion` pide `catch > 0`, que colapsa a `lo === 0` con el piso abierto y
    // el techo en 8. Si la reparación hubiera confundido «abierto» con «vacío», el
    // proceso semilla que da de comer se caería. No se cae.
    expect(tieneCodigo(admit(EXTRACCION, phys), 'rol-contradictorio')).toBe(false)
    expect(admit(EXTRACCION, phys).ok).toBe(true)
  })

  it('CERRADO · DEBERÍA decir «rol-contradictorio»: nadie lo puede llenar nunca', () => {
    // Sobre una cualidad de MATERIA la realizabilidad contra el catálogo lo tapa
    // de casualidad (`rol-irrealizable`). Sobre `stamina` —que ninguna sustancia
    // declara— no hay red abajo, y `stamina` es justamente la cualidad del rol
    // `actor`, que es el rol que aparece en todo proceso que la criatura ejecuta.
    expect(tieneCodigo(admit(ROL, phys), 'rol-contradictorio')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 5 · la confianza se autocertifica igual, mintiendo un campo más
// ═══════════════════════════════════════════════════════════════════════════

describe('★ AGUJERO · `confianza-autodeclarada` se esquiva escribiendo `by: "semilla"`', () => {
  const MIENTE = p('me-declaro-semilla', { trust: 'estable', provenance: { by: 'semilla' } })

  it('el control: con `by: "modelo"` la puerta lo para', () => {
    const honesto = p('me-declaro-estable-2', { trust: 'estable', provenance: { by: 'modelo' } })
    expect(tieneCodigo(admit(honesto, phys), 'confianza-autodeclarada')).toBe(true)
  })

  it('MEDIDO · y los cuatro semilla siguen entrando con su trust «estable»', () => {
    // La reparación no cruza dos campos autodeclarados: cruza `trust` contra el
    // único dato que quien propone NO escribe, que es si la física ya lo tiene
    // sellado con ese id. Los semilla están adentro; el que se autodeclara, no.
    for (const s of SEED_PROCESSES) {
      expect([s.id, s.trust, admit(s, phys).ok]).toEqual([s.id, s.trust, true])
    }
    expect(tieneCodigo(admit(MIENTE, phys), 'confianza-autodeclarada')).toBe(true)
  })

  it('CERRADO · DEBERÍA rechazarlo: `provenance` lo escribe el mismo que escribe `trust`', () => {
    // La regla cruza un campo autodeclarado contra otro campo autodeclarado. Los
    // dos vienen en el mismo objeto, del mismo lado. La única procedencia que vale
    // es la que sabe quién LLAMÓ a `admit`, y `admit` no la recibe: no hay ningún
    // parámetro por el que pueda entrar.
    expect(admit(MIENTE, phys).ok).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 6 · el charlatán vuelve escribiendo «≥» en vez de «>=»
// ═══════════════════════════════════════════════════════════════════════════
//
// `promesasDe` busca el operador con `s.includes('>=')`, y lo que no parsea «no
// promete nada». `reglaPromesas` arranca con `if (promesas.length === 0) return`,
// así que un `establishes` en unicode se lleva puestos los DOS controles: el
// rechazo `promesa-derivada` y el reparo `promesa-sin-respaldo`.

describe('★ AGUJERO · un operador unicode borra las promesas de la vista de la puerta', () => {
  const CHARLATAN = p('charlatan-unicode', { establishes: ['reach≥16', 'sharpness≥1'] })

  it('el control: con `>=` ASCII, el charlatán se rechaza con «promesa-derivada»', () => {
    const enAscii = p('charlatan-ascii', { establishes: ['reach>=16', 'sharpness>=1'] })
    expect(tieneCodigo(admit(enAscii, phys), 'promesa-derivada')).toBe(true)
  })

  it('MEDIDO · el parser lee ahora el unicode, así que las dos escrituras son la misma', () => {
    const enAscii = p('charlatan-ascii-2', { establishes: ['reach>=16', 'sharpness>=1'] })
    expect(promesasDe(CHARLATAN, phys)).toEqual(promesasDe(enAscii, phys))
  })

  it('CERRADO · DEBERÍA cobrar al menos el reparo «promesa-sin-respaldo»: no tiene efectos ni rendimientos', () => {
    // El proceso no hace literalmente nada y promete alcance 16 y filo 1. Que la
    // puerta no lo entienda no lo vuelve inocuo: `establishes` es un array de
    // strings que leen otros —la fragua para planificar, la regla 4 para comparar
    // promesas— y cada uno lo interpreta con su propia regla.
    expect(tieneReparo(admit(CHARLATAN, phys), 'promesa-sin-respaldo')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 7 · `mass <= 0` apaga el chequeo de intensivas entero
// ═══════════════════════════════════════════════════════════════════════════
//
// La causa 3 —la más profunda de la reparación— se apoya en `masaMaxima` y
// compara `cantidad · hi > entraExt`. Con `hi === 0` el producto da 0, y `0 > 0`
// es falso. Un techo de masa igual a cero apaga la comparación en vez de
// hacerla imposible de pasar, y `mass <= 0` está adentro del rango del catálogo,
// así que ni `fuera-de-rango` ni `rol-contradictorio` lo tocan.

describe('★ AGUJERO · el borde exacto de `masaMaxima`: cero apaga la comparación', () => {
  const conTecho = (techo: number, id: string): Process =>
    p(id, {
      roles: [
        { name: 'fuente', where: [{ q: 'nutrition', op: '>=', v: 20 }] },
        { name: 'pan', where: [{ q: 'mass', op: '<=', v: techo }] },
      ],
      effects: [{ k: 'drive', q: 'nutrition', on: 'pan', toward: 15, perTick: 40 }],
      completion: { at: 1, yields: [{ k: 'transmute', role: 'fuente' }] },
    })

  it('el control, un milímetro más arriba: con `mass <= 0.001` la puerta lo para', () => {
    const v = admit(conTecho(0.001, 'pan-de-un-gramo'), phys)
    expect(tieneCodigo(v, 'magnitud-intensiva')).toBe(true)
  })

  it('MEDIDO · `mass <= 0` cae por realizabilidad, que es lo que dice el propio admit.ts', () => {
    const v = admit(conTecho(0, 'pan-de-masa-cero'), phys)
    expect(tieneCodigo(v, 'rol-irrealizable')).toBe(true)
    const r = v.razones.find((x) => x.codigo === 'rol-irrealizable')
    expect(r?.mensaje).toContain('un cuerpo de masa cero no es un cuerpo')
  })

  it('CERRADO · DEBERÍA rechazarlo también: `mass <= 0` no es una cota, es un rol que nadie llena', () => {
    // Las dos salidas son rechazo: o se lo agarra la magnitud intensiva (la
    // fuente no garantiza masa, así que entra 0 de nutrición·masa y sale algo),
    // o se lo agarra la realizabilidad (un cuerpo de masa cero no es un cuerpo,
    // y `admit.ts` lo dice con todas las letras en `respalda`). Hoy no lo agarra
    // ninguna, y el efecto queda escrito en la física para siempre.
    expect(admit(conTecho(0, 'pan-de-masa-cero'), phys).ok).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 8 · la regla 5 rechaza un proceso HONESTO
// ═══════════════════════════════════════════════════════════════════════════
//
// Éste es el más caro de los ocho, porque no deja entrar algo que debería entrar,
// y la regla de oro del archivo dice que ése es el lado que no se perdona.
//
// Se multiplican dos sobre-aproximaciones que están DECLARADAS por separado y que
// nadie miró juntas:
//
//   · `habilita` arma una arista si UNA promesa satisface UN test de UN rol. El
//     proceso empuja `nutrition` hacia 15 y su propio rol de destino pide
//     `nutrition >= 1`: se habilita a sí mismo, y `ciclosPor` no excluye los
//     lazos de largo 1.
//   · `saldoDeclarado` suma el `trabajoDe` de un `drive` sobre una conservada y
//     NO resta lo que el proceso consume para hacerlo. `entraDe` sabe la cuenta
//     —la usa la regla 1, y la deja pasar— pero el saldo no la mira.
//
// Resultado: un lazo de largo 1 con saldo +14 de nutrición, y un `ciclo-rentable`
// que la regla 5 promete que «rinde de verdad en algún estado del mundo». No
// rinde en ninguno: cada vuelta se come un cuerpo de nutrición ≥ 20 y masa ≥ 100
// para escribir 15 en uno de masa ≤ 100.

describe('★ AGUJERO · la regla 5 rechaza un proceso que conserva de sobra', () => {
  /** 20·100 = 2000 de nutrición·masa entran; 15·100 = 1500 salen. Cierra. */
  const HONESTO = p('panificar', {
    roles: [
      {
        name: 'fuente',
        where: [
          { q: 'nutrition', op: '>=', v: 20 },
          { q: 'mass', op: '>=', v: 100 },
        ],
      },
      {
        name: 'pan',
        where: [
          { q: 'nutrition', op: '>=', v: 1 },
          { q: 'mass', op: '<=', v: 100 },
        ],
      },
    ],
    effects: [{ k: 'drive', q: 'nutrition', on: 'pan', toward: 15, perTick: 40 }],
    completion: { at: 1, yields: [{ k: 'transmute', role: 'fuente' }] },
  })

  it('la regla 1 —la que sabe la aritmética— lo deja pasar sin decir nada', () => {
    const v = admit(HONESTO, phys)
    expect(v.razones.filter((r) => r.regla === 1)).toEqual([])
  })

  it('MEDIDO · y la regla 5 dejó de contradecirla: el saldo declarado da NEGATIVO', () => {
    // `saldoDeclarado` resta ahora lo que el proceso consume para acreditar, una vez
    // y no una por efecto: 15 escritos contra 20 consumidos. El ciclo de largo 1
    // sigue existiendo —la arista es real— y ya no suma positivo, que es lo único
    // que la regla 5 puede prometer.
    expect(saldoDeclarado(HONESTO, 'nutrition', phys)).toBeLessThan(0)
    expect(admit(HONESTO, phys).razones.map((r) => r.codigo)).toEqual([])
  })

  it('CERRADO · DEBERÍA entrar: consume 2000 de nutrición·masa para escribir 1500', () => {
    expect(admit(HONESTO, phys).ok).toBe(true)
  })

  it('la prueba de que la razón es la arista y no la aritmética: se le saca un test al rol y entra', () => {
    // MISMO efecto, MISMA cuenta, MISMO saldo. Lo único que cambia es que el rol
    // de destino ya no pide `nutrition >= 1`, así que `habilita` no encuentra
    // arista y no hay ciclo que sumar. La regla 5 depende de un test de rol que
    // no tiene nada que ver con la conservación.
    const sinArista = p('panificar-sin-arista', {
      roles: [
        {
          name: 'fuente',
          where: [
            { q: 'nutrition', op: '>=', v: 20 },
            { q: 'mass', op: '>=', v: 100 },
          ],
        },
        { name: 'pan', where: [{ q: 'mass', op: '<=', v: 100 }] },
      ],
      effects: [{ k: 'drive', q: 'nutrition', on: 'pan', toward: 15, perTick: 40 }],
      completion: { at: 1, yields: [{ k: 'transmute', role: 'fuente' }] },
    })
    expect(admit(sinArista, phys).ok).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 9 · metadatos: clones exactos y un id de ancho cero
// ═══════════════════════════════════════════════════════════════════════════

describe('★ AGUJERO · el mismo proceso, otro id, y la puerta no dice nada', () => {
  // `friccion` + un espacio de ancho cero (U+200B). En cualquier log, en
  // cualquier veredicto y en el `porQue()` de la puerta se lee «friccion».
  const GEMELO = { ...FRICCION, id: 'friccion​' }

  it('MEDIDO · lo paran DOS reglas, y las dos tienen razón', () => {
    const v = admit(GEMELO, phys)
    expect(v.ok).toBe(false)
    // El id difiere de verdad —no es `id-repetido`— y el veredicto lo llama igual
    // que al original: los dos imprimen «friccion».
    expect(GEMELO.id.trim()).not.toBe(FRICCION.id)
    // `dominancia` porque es el caso degenerado: promete lo mismo, pide lo mismo,
    // cuesta lo mismo y tarda lo mismo. Y `confianza-autodeclarada` porque se copió
    // también el `trust: 'estable'` de un proceso que la física sí tiene sellado.
    expect(v.razones.map((r) => r.codigo).sort()).toEqual([
      'confianza-autodeclarada',
      'dominancia',
    ])
  })

  it('CERRADO · DEBERÍA pararlo: `id-repetido` existe justo para que nadie le tape un proceso al mundo', () => {
    // No es dominancia —no es más barato, es idéntico— y por eso la regla 4 lo
    // deja pasar: `mejorEn === undefined && !masRapido && exigencia === 'igual'`
    // hace `continue`. O sea que la puerta admite copias exactas ilimitadas de
    // cualquier proceso, cada una con su propio nodo en el grafo de la regla 5,
    // cuyo presupuesto es exponencial y ya viene con un aviso de truncamiento.
    expect(admit(GEMELO, phys).ok).toBe(false)
  })

  it('y un clon exacto con un id honestamente distinto tampoco entra: no era cosa del unicode', () => {
    expect(tieneCodigo(admit({ ...FRICCION, id: 'friccion-bis' }, phys), 'dominancia')).toBe(true)
  })

  it('pero el MISMO objeto readmitido sí entra: revalidar no es duplicar', () => {
    // La regla de oro del archivo, aplicada acá: si la copia exacta se rechazara sin
    // más, readmitir un proceso ya sellado —que es lo que hace una recalibración—
    // dejaría al mundo sin sus propias leyes.
    expect(admit(FRICCION, phys).ok).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 10 · el radio que no encierra nada
// ═══════════════════════════════════════════════════════════════════════════

describe('★ AGUJERO · un radio de 5e-324 pasa el control de «no encierra nada»', () => {
  const INFINITESIMAL = p('radio-de-nada', {
    arrangement: { k: 'within', radius: Number.MIN_VALUE },
  })

  it('el control: `radius: 0` y `radius: -0` los para «fuera-de-rango»', () => {
    expect(tieneCodigo(admit(p('r0', { arrangement: { k: 'within', radius: 0 } }), phys), 'fuera-de-rango')).toBe(true)
    expect(tieneCodigo(admit(p('r-0', { arrangement: { k: 'within', radius: -0 } }), phys), 'fuera-de-rango')).toBe(true)
  })

  it('el control: `Infinity` y `NaN` los para «numero-no-finito»', () => {
    for (const r of [Number.POSITIVE_INFINITY, Number.NaN]) {
      const v = admit(p('r-raro', { arrangement: { k: 'within', radius: r } }), phys)
      expect(tieneCodigo(v, 'numero-no-finito')).toBe(true)
    }
  })

  it('MEDIDO · el umbral no es un número a dedo: es el del punto fijo con el que el mundo mide', () => {
    // `FIXED_SCALE = 1000`. Un radio que redondea a cero en la representación en la
    // que se van a hacer las comparaciones ES cero. 0.001 es el más chico que el
    // mundo distingue, y ése sí entra.
    expect(admit(INFINITESIMAL, phys).ok).toBe(false)
    expect(admit(p('radio-minimo', { arrangement: { k: 'within', radius: 0.001 } }), phys).ok).toBe(true)
  })

  it('CERRADO · DEBERÍA pararlo: el comentario dice «un radio que no encierra nada», y éste no encierra nada', () => {
    // Es el mismo fallo silencioso que el radio cero, con otro número: el proceso
    // queda en el índice, la búsqueda lo considera, y no se dispara jamás. La
    // cota `<= 0` es la única que hay y no alcanza para lo que dice cazar.
    expect(admit(INFINITESIMAL, phys).ok).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 11 · frotar la montaña, otra vez, declarando el techo y no el piso
// ═══════════════════════════════════════════════════════════════════════════
//
// `masaQuePaga` cobra por la masa GARANTIZADA, o sea por un `mass >= x` en el rol
// que se empuja. Está declarado como subestimación en el comentario. Lo que el
// comentario no dice es que la subestimación es la REGLA y no la excepción:
// ningún proponente escribe `mass >= 5000` en el rol que quiere calentar, y con
// `mass <= 10000` —el rango entero del mundo— el rol admite peñascos y paga por
// una unidad. La cota que el juez usa para cobrar es la que el proponente elige
// no escribir.

describe('★ AGUJERO · el costo por masa se apaga con no declarar el piso de masa', () => {
  const guijarro = p('frotar-el-guijarro', {
    roles: [
      { name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }, { q: 'mass', op: '>=', v: 1 }] },
      { name: 'b', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
    ],
    effects: [
      {
        k: 'drive',
        q: 'temperature',
        on: 'a',
        toward: 400,
        perTick: 6,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.35 },
      },
    ],
    establishes: ['temperature>=400'],
  })

  const montania = p('frotar-la-montania-v2', {
    roles: [
      // El mismo rol, pero acotado por ARRIBA en el máximo del mundo: admite
      // exactamente los mismos cuerpos que el guijarro y muchos más.
      { name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }, { q: 'mass', op: '<=', v: 10000 }] },
      { name: 'b', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
    ],
    effects: [
      {
        k: 'drive',
        q: 'temperature',
        on: 'a',
        toward: 400,
        perTick: 6,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.35 },
      },
    ],
    establishes: ['temperature>=400'],
  })

  it('MEDIDO · el reparo de costo cobra ahora diez mil veces más al que admite pesar diez mil', () => {
    const reparo = (x: Process): number | undefined =>
      admit(x, phys).advertencias.find((r) => r.codigo === 'costo-mayor-que-la-garantia')?.encontrado
    // 6 / 0.35 = 17.143 para el que promete pesar 1; por 10000 para el que admite
    // pesar 10000. Y el reparo se cobra aunque no haya `completion`, que es donde
    // este ataque vivía: un proceso que no declara cuándo termina se quedaba sin la
    // única línea que dice cuánto cuesta.
    expect(reparo(guijarro)).toBeCloseTo(6 / 0.35, 6)
    expect(reparo(montania)).toBeCloseTo((6 / 0.35) * 10000, 3)
  })

  it('MEDIDO · y sigue entrando: el precio es un reparo, no un rechazo', () => {
    // Que quien empiece con lo justo no llegue a terminar es la distancia entre
    // querer y poder, no una violación de la física. Lo que cambió es que el número
    // ahora dice la verdad.
    expect(admit(montania, phys).ok).toBe(true)
  })

  it('CERRADO · DEBERÍA costar más: la energía de subir un grado es masa · calor específico · ΔT', () => {
    // El reparo del adversario anterior anota esto como «calibración». No lo es
    // del todo: la puerta ya eligió una masa con la que cobrar, y eligió la que
    // el proponente controla. La cota honesta para un costo es la del PEOR caso
    // —el techo—, igual que `revisarIntensiva` usa `masaMaxima` para lo que se
    // escribe. Usar el piso para cobrar y el techo para conservar es usar dos
    // cotas opuestas en dos reglas que hablan de la misma masa.
    const reparo = (x: Process): number =>
      admit(x, phys).advertencias.find((r) => r.codigo === 'costo-mayor-que-la-garantia')?.encontrado ?? 0
    expect(reparo(montania)).toBeGreaterThan(reparo(guijarro))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ★ AGUJERO 12 · la piedra-batería vuelve BORRANDO una línea
// ═══════════════════════════════════════════════════════════════════════════
//
// `respalda` cierra la piedra-batería con `pinaLaMateria`: «un rol que además
// dice de qué está hecho el cuerpo ya eligió, y una piedra no tiene aliento por
// mucho que el rol se lo escriba». El control se dispara solo si el rol DICE de
// qué está hecho. Se saca el `rigidity >= 0.5` y el mismo proceso entra.
//
// Salvedad honesta, y va escrita porque el reporte no vale si exagera: quién
// llena el rol lo decide el mundo al buscar cuerpos, no `admit`. Si allá afuera
// nada más que la criatura tiene `stamina > 0`, este rol no lo llena una piedra y
// el proceso es inútil en vez de gratis. Lo que sí queda medido es que la defensa
// que la reparación escribió se apaga borrando un test, y que la puerta —que es
// lo único que juzga antes de que el proceso exista— no vuelve a decir nada.

describe('★ AGUJERO · `pinaLaMateria` se apaga sacándole el pin al rol', () => {
  const CON_PIN = p('piedra-bateria-con-pin', {
    roles: [
      {
        name: 'a',
        where: [
          { q: 'rigidity', op: '>=', v: 0.5 },
          { q: 'stamina', op: '>=', v: 100 },
        ],
      },
    ],
    effects: [
      {
        k: 'drive',
        q: 'temperature',
        on: 'a',
        toward: 400,
        perTick: 6,
        poweredBy: { from: 'a', q: 'stamina', efficiency: 1 },
      },
    ],
    establishes: ['temperature>=400'],
  })

  const SIN_PIN = p('piedra-bateria-sin-pin', {
    // El mismo, sin el `rigidity`. Pide MENOS, o sea que admite todo lo que
    // admitía antes, piedras incluidas.
    roles: [{ name: 'a', where: [{ q: 'stamina', op: '>=', v: 100 }] }],
    effects: [
      {
        k: 'drive',
        q: 'temperature',
        on: 'a',
        toward: 400,
        perTick: 6,
        poweredBy: { from: 'a', q: 'stamina', efficiency: 1 },
      },
    ],
    establishes: ['temperature>=400'],
  })

  it('el control: con el pin puesto, la puerta lo para con «fuente-sin-respaldo»', () => {
    expect(tieneCodigo(admit(CON_PIN, phys), 'fuente-sin-respaldo')).toBe(true)
  })

  it('MEDIDO · lo para la mitad que SÍ se puede cerrar sin inventar un campo nuevo', () => {
    // Un cuerpo que paga SU PROPIO cambio tiene que tener el combustible adentro, y
    // adentro de la materia solo está lo que alguna sustancia declara. `stamina` no
    // la declara ninguna. `fermentar` —que se paga con su propia `nutrition`— pasa.
    const v = admit(SIN_PIN, phys)
    expect(v.ok).toBe(false)
    expect(tieneCodigo(v, 'fuente-sin-respaldo')).toBe(true)
  })

  it.fails('SIGUE ABIERTO · el mismo ataque con la batería en OTRO rol vuelve a entrar', () => {
    // QUÉ FALTA PARA CERRARLO: la puerta no sabe que dos roles los puede llenar el
    // mismo cuerpo, ni cuál de los roles es la criatura. Un rol aparte que solo pida
    // `stamina >= 100` pasa `respalda` —no pincha la materia— y paga el trabajo. La
    // salvedad honesta del propio adversario aplica igual: quién llena el rol lo
    // decide el mundo al buscar cuerpos, así que allá afuera esto puede quedar
    // inútil en vez de gratis. Cerrarlo pide que `Process` diga cuál es el rol de la
    // criatura, o que `admit` reciba con qué se va a llenar cada rol. Es un ADR.
    const CON_BATERIA_APARTE = p('piedra-bateria-en-otro-rol', {
      roles: [
        { name: 'a', where: [] },
        { name: 'bateria', where: [{ q: 'stamina', op: '>=', v: 100 }] },
      ],
      effects: [
        {
          k: 'drive',
          q: 'temperature',
          on: 'a',
          toward: 400,
          perTick: 6,
          poweredBy: { from: 'bateria', q: 'stamina', efficiency: 1 },
        },
      ],
      establishes: ['temperature>=400'],
    })
    expect(admit(CON_BATERIA_APARTE, phys).ok).toBe(false)
  })

  it('CERRADO · DEBERÍA parar los dos: pedir menos no puede volver admisible lo que era inadmisible', () => {
    // Es una monotonía que la puerta rompe: `SIN_PIN` acepta un superconjunto de
    // los cuerpos de `CON_PIN`, hace exactamente lo mismo con ellos, y pasa. Si
    // un proceso es una máquina de movimiento perpetuo sobre las piedras rígidas,
    // lo sigue siendo sobre las piedras rígidas Y todo lo demás.
    expect(admit(SIN_PIN, phys).ok).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// LO QUE LA PUERTA SÍ HACE BIEN — regresiones, para que la reparación no se
// desarme cuando alguien vaya a tapar los agujeros de arriba.
// ═══════════════════════════════════════════════════════════════════════════

describe('la puerta acierta · bordes exactos de las cotas nuevas', () => {
  const conEficiencia = (eff: number, id: string): Process =>
    p(id, {
      roles: [
        { name: 'a', where: [] },
        { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
      ],
      effects: [
        {
          k: 'drive',
          q: 'temperature',
          on: 'a',
          toward: 400,
          perTick: 6,
          poweredBy: { from: 'actor', q: 'stamina', efficiency: eff },
        },
      ],
    })

  it('eficiencia exactamente 1 no es «eficiencia»: el ≤ es ≤', () => {
    expect(tieneCodigo(admit(conEficiencia(1, 'eff-1'), phys), 'eficiencia')).toBe(false)
  })

  it('eficiencia 1 + un ULP sí lo es', () => {
    const v = admit(conEficiencia(1 + Number.EPSILON, 'eff-1-eps'), phys)
    expect(tieneCodigo(v, 'eficiencia')).toBe(true)
  })

  it('eficiencia 0 y −0 se paran las dos', () => {
    expect(tieneCodigo(admit(conEficiencia(0, 'eff-0'), phys), 'eficiencia')).toBe(true)
    expect(tieneCodigo(admit(conEficiencia(-0, 'eff-menos-0'), phys), 'eficiencia')).toBe(true)
  })

  it('`completion.at` de 0, de −1 y de 1e-9 se paran; el 1 exacto pasa', () => {
    for (const at of [0, -1, 1e-9]) {
      const v = admit(p(`at-${String(at)}`, { completion: { at, yields: [] } }), phys)
      expect([at, tieneCodigo(v, 'completion-invalida')]).toEqual([at, true])
    }
    const uno = admit(p('at-1', { completion: { at: 1, yields: [] } }), phys)
    expect(tieneCodigo(uno, 'completion-invalida')).toBe(false)
  })

  it('un `transfer` de conservada sin `completion` se para: perTick × infinito', () => {
    const v = admit(
      p('cano-eterno', {
        roles: [
          { name: 'de', where: [{ q: 'mass', op: '>=', v: 100 }] },
          { name: 'a', where: [] },
        ],
        effects: [{ k: 'transfer', q: 'mass', from: 'de', to: 'a', perTick: 1 }],
      }),
      phys,
    )
    expect(tieneCodigo(v, 'conservacion-transfer')).toBe(true)
  })

  it('un `drive` sobre una derivada se para para los cuatro `k`, y `heatCapacity` incluida', () => {
    const v = admit(
      p('escribir-la-capacidad', {
        roles: [
          { name: 'a', where: [] },
          { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
        ],
        effects: [
          {
            k: 'drive',
            q: 'heatCapacity',
            on: 'a',
            toward: 100,
            perTick: 1,
            poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.5 },
          },
        ],
      }),
      phys,
    )
    expect(tieneCodigo(v, 'cualidad-derivada')).toBe(true)
  })

  it('un proceso honesto que reparte nutrición con la cuenta cerrada entra', () => {
    // El control de la regla de oro para el agujero 7: cuando la masa está acotada
    // de los dos lados y la cuenta cierra, la puerta deja pasar.
    const honesto = p('repartir-la-grasa', {
      roles: [
        {
          name: 'fuente',
          where: [
            { q: 'nutrition', op: '>=', v: 20 },
            { q: 'mass', op: '>=', v: 100 },
          ],
        },
        { name: 'pan', where: [{ q: 'mass', op: '<=', v: 100 }] },
      ],
      effects: [{ k: 'drive', q: 'nutrition', on: 'pan', toward: 15, perTick: 40 }],
      completion: { at: 1, yields: [{ k: 'transmute', role: 'fuente' }] },
    })
    expect(admit(honesto, phys).ok).toBe(true)
  })
})
