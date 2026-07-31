// ─── LO QUE CUESTA ARMAR UN PLANO, MEDIDO CONTRA `unir` DE VERDAD ───────────
//
// Este archivo existe por la regla número 1 de este repositorio, que está escrita
// como el primero de los números corregidos:
//
//   > **MEDIR EL CATÁLOGO NO ES MEDIR EL MUNDO.** Antes de aceptar «el mundo no
//   > permite X», probá X con `unir`, con varias piezas y con las quince innatas
//   > encadenadas. Y antes de cambiar el mundo para desbloquear algo, medí si ya
//   > está desbloqueado.
//
// El tramo C dejó `BlueprintDefinition` escrito y el punto 5 del gate
// —«construcción incremental e idempotente»— sin empezar. El impulso era diseñar
// un mecanismo de obra: un proyecto con sitio, roles que se llenan de a uno,
// materialización al completarse. Antes de escribir una línea de eso hay que
// contestar una pregunta que nadie hizo: **¿el mundo ya sabe construir un plano?**
//
// Y hay una segunda que salió de leer `unir` y que este archivo mide porque leer
// no alcanza: **¿el atador queda adentro de la obra, o se consume?** De la
// respuesta depende la forma del plano, porque decide qué cuenta contra
// `MAX_PARTS`.
//
// Las cuatro preguntas, y las cuatro se contestan con números:
//
//   (1) ¿qué hace `unir` con el atador en cada uno de sus dos modos?
//   (2) ¿cuántos CUERPOS hace falta juntar para una obra de N piezas?
//   (3) ¿`MAX_PARTS` cuenta las piezas o cuenta los atadores?
//   (4) ¿encadenar uniones anida, o aplana?

import { describe, expect, it } from 'vitest'

import { MAX_ASSEMBLY_DEPTH, MAX_JOINTS, MAX_PARTS, assemblyDepthOf } from '../src/body.js'
import { buildSeedPhysics } from '../src/index.js'
import { unir } from '../src/leyes.js'
import { cuerpo, materiaFantasma, parte } from './mundo-de-prueba.js'
import type { Body, Physics } from '../src/index.js'

const PHYS: Physics = buildSeedPhysics()

/** Una pieza estructural cualquiera. `madera` es rígida y sirve de costilla. */
function pieza(id: string, masa = 0.5): Body {
  return cuerpo(id, 'vara', [parte('madera', masa)])
}

/**
 * Un atador cualquiera. **`liana` y no `fibra`**: este archivo mide contra
 * `buildSeedPhysics()`, o sea el catálogo SEMILLA, y ahí `fibra` no existe —
 * existe sólo en el catálogo local de `mundo-de-prueba.ts`, de donde este
 * archivo importa `cuerpo` y `parte` pero NO la física.
 *
 * Nombrar una sustancia que el catálogo no tiene no explota: `qualityOf`
 * devuelve 0 para todo. Medido con la semilla, `fibra` daba `tensile` 0 y
 * `cohesion` 0, y de ahí `strength` 0 — el atador ataba con fuerza cero y los
 * tests de acá seguían verdes porque sólo miran la FORMA de la obra (cuántas
 * partes, cuántas juntas, qué topología), no con cuánta fuerza quedó atada.
 * Con `liana`: `tensile` 0,72, `cohesion` 0,62, `strength` 0,69.
 */
function atador(id: string, masa = 0.1): Body {
  return cuerpo(id, 'hebra', [parte('liana', masa)])
}

// ─── (0) El chequeo que este archivo no tenía y por eso midió mal ───────────

describe('(0) las dos piezas están hechas de materia que la SEMILLA conoce', () => {
  it('ni la pieza ni el atador nombran una sustancia que `PHYS` no tenga', () => {
    // Este archivo importa `cuerpo` y `parte` de `mundo-de-prueba.ts` pero arma
    // su física con `buildSeedPhysics()`, que es OTRO catálogo. Cruzar los dos no
    // falla: da un cuerpo legal con todas sus cualidades en cero. Acá se afirma
    // que el par cuerpo↔catálogo es el mismo, y sin eso todo lo de abajo mide un
    // atador que no ata.
    expect(materiaFantasma(pieza('p'), PHYS)).toEqual([])
    expect(materiaFantasma(atador('a'), PHYS)).toEqual([])
  })

  it('y el atador ata de VERDAD: la junta sale con fuerza, no con cero', () => {
    // El síntoma que delataba a `fibra`. La forma de la obra —partes, juntas,
    // profundidad— sale igual con un atador fantasma, así que ninguno de los diez
    // tests de abajo se ponía rojo. Lo único que cambiaba era esto.
    const r = unir(pieza('v'), undefined, atador('h'), PHYS, 'cana')
    expect(r?.joints[0]?.strength).toBeGreaterThan(0)
  })
})

// ─── (1) Los dos modos de `unir` ────────────────────────────────────────────

describe('(1) qué hace `unir` con el atador, en sus dos modos', () => {
  it('SIN `b`: el atador SOBREVIVE y queda como parte de la obra', () => {
    // Es el modo de la caña: se ata una hebra a una vara y la hebra queda ahí,
    // atada de un solo lado, con la punta suelta que es todo el asunto.
    const r = unir(pieza('vara'), undefined, atador('hebra'), PHYS, 'cana')
    expect(r).toBeDefined()
    expect(r?.parts.length).toBe(2)
    expect(r?.parts.map((p) => p.substance).sort()).toEqual(['liana', 'madera'])
  })

  it('CON `b`: el atador SE CONSUME y NO queda como parte', () => {
    // Éste es el hallazgo que cambia la forma del plano. Con dos cuerpos que
    // unir, el atador aporta su sustancia y su fuerza a la junta y desaparece:
    // la obra tiene las dos piezas y nada más.
    const r = unir(pieza('vara-a'), pieza('vara-b'), atador('hebra'), PHYS, 'dos')
    expect(r).toBeDefined()
    expect(r?.parts.length).toBe(2)
    expect(r?.parts.map((p) => p.substance)).toEqual(['madera', 'madera'])
    expect(r?.parts.some((p) => p.substance === 'liana')).toBe(false)
  })

  it('pero su SUSTANCIA queda escrita en la junta: el atador se nota aunque no esté', () => {
    // No desaparece del todo, y eso importa para el juez: la junta dice con qué
    // se ató, así que una obra atada con junco y otra con tendón no son la misma
    // obra aunque tengan las mismas piezas.
    const r = unir(pieza('vara-a'), pieza('vara-b'), atador('hebra'), PHYS, 'dos')
    expect(r?.joints[0]?.via).toBe('liana')
  })
})

// ─── (2) y (3) La cuenta de una obra de varias piezas ───────────────────────

/** Encadena piezas de a una, gastando un atador por unión. Devuelve la obra. */
function armar(n: number): { obra: Body | undefined; atadores: number } {
  let obra: Body | undefined = pieza('p0')
  let atadores = 0
  for (let i = 1; i < n; i++) {
    if (obra === undefined) break
    atadores += 1
    obra = unir(obra, pieza(`p${String(i)}`), atador(`at${String(i)}`), PHYS, `obra-${String(i)}`)
  }
  return { obra, atadores }
}

describe('(2) y (3) cuántos cuerpos cuesta una obra, y qué cuenta contra la cota', () => {
  it('una obra de N piezas gasta N−1 atadores, y los atadores NO cuentan en `MAX_PARTS`', () => {
    // La cuenta que hay que tener en la cabeza al escribir un plano: una obra de
    // seis piezas necesita ONCE cuerpos —seis piezas y cinco atadores— y la cota
    // de seis se le aplica sólo a las piezas.
    const filas: string[] = []
    for (let n = 2; n <= MAX_PARTS; n++) {
      const { obra, atadores } = armar(n)
      expect(obra, `no se pudo armar una obra de ${String(n)} piezas`).toBeDefined()
      expect(obra?.parts.length).toBe(n)
      expect(atadores).toBe(n - 1)
      filas.push(
        `  ${String(n)} piezas → ${String(obra?.parts.length ?? 0)} partes · ${String(atadores)} atadores · ` +
          `${String(n + atadores)} cuerpos en total · ${String(obra?.joints.length ?? 0)} juntas`,
      )
    }
    console.log(`\n─── LO QUE CUESTA UNA OBRA, MEDIDO ───\n${filas.join('\n')}\n`)
  })

  it('y pasada la cota, `unir` NO devuelve nada: no hay obra de más de `MAX_PARTS` piezas', () => {
    const { obra } = armar(MAX_PARTS + 1)
    expect(obra).toBeUndefined()
  })

  it('las juntas también tienen su cota, y una cadena las gasta de a una', () => {
    const { obra } = armar(MAX_PARTS)
    expect(obra?.joints.length).toBe(MAX_PARTS - 1)
    expect(obra?.joints.length).toBeLessThanOrEqual(MAX_JOINTS)
  })
})

// ─── (4) La topología: `unir` NO ata las piezas que uno le pide ─────────────
//
// ─── EL HALLAZGO DEL ARCHIVO, Y ES EL QUE CAMBIA EL PLANO ───────────────────
//
// La hipótesis con la que se escribió este bloque era «encadenar aplana, la
// profundidad queda en 1». **Es falsa, y falsa por un motivo que importa mucho
// más que el número.**
//
// `unir` siempre agrega UNA junta y siempre es `{ a: 0, b: base }`: la parte 0
// del cuerpo izquierdo con la primera parte del derecho. O sea que **quién queda
// atado a quién no lo elige el que ata: lo decide la forma de la llamada.**
// Encadenar de a una pieza sobre la misma obra produce una ESTRELLA con centro
// en la primera, y la estrella de seis mide profundidad 2.
//
// Lo que eso le hace al `BlueprintDefinition` del tramo C: el plano declara
// juntas nombrando dos roles —`costilla-a` con `costilla-b`— y **`unir` no tiene
// cómo obedecer esa instrucción**. Lo que sí se puede elegir es el ORDEN de las
// uniones, y de ahí sale la topología. Ver el cuadro que este bloque imprime.

describe('(4) la topología de la obra sale del ORDEN de las uniones, no del plano', () => {
  it('encadenar de a una sobre la misma obra da una ESTRELLA, no una cadena', () => {
    // Todas las juntas salen de la parte 0. No es una fila que se pueda cambiar:
    // es la única junta que `unir` sabe agregar.
    const { obra } = armar(4)
    expect(obra).toBeDefined()
    if (obra === undefined) return
    expect(obra.joints.map((j) => `${String(j.a)}-${String(j.b)}`)).toEqual(['0-1', '0-2', '0-3'])
    expect(assemblyDepthOf(obra)).toBe(2)
  })

  it('pero uniendo DOS OBRAS se consigue otra forma: la topología es elegible', () => {
    // Y ésta es la mitad que salva al plano. Armando dos pares y uniéndolos, la
    // junta nueva ata las dos RAÍCES, así que se puede construir cualquier ÁRBOL
    // eligiendo el orden — lo que no se puede es pedir una junta suelta entre dos
    // piezas cualquiera de una obra ya armada.
    const izq = unir(pieza('a'), pieza('b'), atador('at1'), PHYS, 'izq')
    const der = unir(pieza('c'), pieza('d'), atador('at2'), PHYS, 'der')
    expect(izq).toBeDefined()
    expect(der).toBeDefined()
    if (izq === undefined || der === undefined) return
    const obra = unir(izq, der, atador('at3'), PHYS, 'arbol')
    expect(obra).toBeDefined()
    expect(obra?.joints.map((j) => `${String(j.a)}-${String(j.b)}`)).toEqual(['0-1', '2-3', '0-2'])

    // ─── Y ACÁ APARECE LA COTA DE VERDAD, que no es `MAX_PARTS` ──────────────
    //
    // El camino más largo es 1—0—2—3: TRES juntas, o sea profundidad 3, que es
    // exactamente `MAX_ASSEMBLY_DEPTH`. Con CUATRO piezas. La estrella de seis
    // mide 2 y esto mide 3, así que **lo que acota la forma de una obra no es
    // cuántas piezas tiene sino qué tan honda es**, y un plano de cuatro piezas
    // armado como dos pares ya está pegado al techo.
    //
    // La consecuencia para el plano: hay árboles de pocas piezas que NO son
    // construibles, y `definirPlano` hoy no lo mira.
    expect(assemblyDepthOf(obra as Body)).toBe(3)
    expect(assemblyDepthOf(obra as Body)).toBe(MAX_ASSEMBLY_DEPTH)
  })

  it('LA COTA QUE EL PLANO TIENE QUE RESPETAR: las juntas son PIEZAS − 1, siempre', () => {
    // Cada unión agrega exactamente una junta y exactamente una pieza, así que
    // una obra de N piezas tiene N−1 juntas y ni una más. Un plano que declare
    // otra cantidad **no es construible**, y hoy `definirPlano` lo deja pasar:
    // es el hueco que esta medición encontró.
    const filas: string[] = []
    for (let n = 2; n <= MAX_PARTS; n++) {
      const { obra } = armar(n)
      filas.push(`  ${String(n)} piezas → ${String(obra?.joints.length ?? 0)} juntas · profundidad ${String(assemblyDepthOf(obra as Body))}`)
      expect(obra?.joints.length).toBe(n - 1)
    }
    console.log(`\n─── LA FORMA DE LA OBRA, MEDIDA ───\n${filas.join('\n')}\n`)
  })

  it('y CADA PASO INTERMEDIO es un cuerpo legal, que es lo que hace posible retomar', () => {
    // La otra mitad de «incremental»: si un paso intermedio fuera ilegal, la
    // criatura no podría soltar la obra a medias e ir a buscar la pieza que le
    // falta — y con tres manos y once cuerpos, ir a buscar es obligatorio.
    let obra: Body | undefined = pieza('p0')
    for (let i = 1; i < MAX_PARTS; i++) {
      if (obra === undefined) break
      obra = unir(obra, pieza(`p${String(i)}`), atador(`at${String(i)}`), PHYS, `paso-${String(i)}`)
      expect(obra, `el paso ${String(i)} dejó una obra ilegal`).toBeDefined()
      expect(obra?.parts.length).toBe(i + 1)
    }
  })
})
