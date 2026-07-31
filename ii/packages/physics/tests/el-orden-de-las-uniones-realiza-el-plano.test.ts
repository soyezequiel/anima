// ─── ¿UN ORDEN DE UNIONES REALIZA UN PLANO CUALQUIERA? ──────────────────────
//
// Regla 1 del repositorio, otra vez, y otra vez antes de escribir una línea del
// mecanismo: **medir el catálogo no es medir el mundo**. El tramo C·bis dejó
// escrito el hallazgo que hace falta contestar antes de que exista un
// `BuildSkill`:
//
//   > `unir` siempre agrega la junta `{ a: 0, b: base }`: quién queda atado a
//   > quién **no lo elige el que ata**. El plano puede declarar la forma; el
//   > `BuildSkill` tiene que encontrar el orden.
//
// «Tiene que encontrar el orden» estaba escrito como una esperanza. Este archivo
// la convierte en un número, y contesta las tres preguntas de las que depende que
// el `BuildSkill` sea posible:
//
//   (1) ¿existe un orden que realice EXACTAMENTE las juntas que el plano declara,
//       para un árbol cualquiera y no sólo para la estrella?
//   (2) ¿lo encuentra una regla simple, o hace falta buscar?
//   (3) ¿los pasos intermedios se pasan de las cotas aunque el resultado no?
//
// ─── LA REGLA QUE SE PONE A PRUEBA, EN UNA FRASE ────────────────────────────
//
// `unir(A, B, atador)` ata **la parte 0 de A con la parte 0 de B**, y el
// resultado conserva la parte 0 de A en el índice 0. O sea que cada assembly
// tiene una CABEZA, la unión ata cabeza con cabeza, y la cabeza del resultado es
// la de la izquierda.
//
// Si eso es cierto, la regla es: elegir una raíz, armar el subárbol de cada hijo,
// y atar el hijo al padre. Cada unión realiza exactamente una arista del plano.
// Si es falso, no hay `BuildSkill` genérico y hay que rediseñar el plano.

import { describe, expect, it } from 'vitest'

import { MAX_ASSEMBLY_DEPTH, MAX_PARTS, assemblyDepthOf } from '../src/body.js'
import { buildSeedPhysics } from '../src/index.js'
import { unir } from '../src/leyes.js'
import type { BlueprintJoint } from '../src/plano.js'
import { cuerpo, parte } from './mundo-de-prueba.js'
import type { Body, Physics } from '../src/index.js'

const PHYS: Physics = buildSeedPhysics()

function pieza(id: string): Body {
  return cuerpo(id, 'vara', [parte('madera', 0.5)])
}

/** `liana` y no `fibra`: este archivo mide contra la SEMILLA. Ver el bloque (0). */
function atador(id: string): Body {
  return cuerpo(id, 'hebra', [parte('liana', 0.1)])
}

// ─── El armador que se está midiendo ────────────────────────────────────────

/** Una obra a medio armar: el cuerpo, y en qué índice quedó cada rol. */
interface Armada {
  readonly cuerpo: Body
  /** rol → índice de parte. Es lo que permite comparar juntas contra el plano. */
  readonly indices: ReadonlyMap<string, number>
}

/** Sin `localeCompare`: el orden no puede depender del idioma del sistema. */
function comparaTexto(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

interface Arbol {
  readonly vecinos: ReadonlyMap<string, readonly string[]>
  /** Con qué se ata cada arista, por su clave canónica. */
  readonly atadorDe: ReadonlyMap<string, string>
}

function claveDeArista(a: string, b: string): string {
  return comparaTexto(a, b) <= 0 ? `${a} ${b}` : `${b} ${a}`
}

function arbolDe(joints: readonly BlueprintJoint[]): Arbol {
  const vecinos = new Map<string, string[]>()
  const atadorDe = new Map<string, string>()
  const anotar = (x: string, y: string): void => {
    const l = vecinos.get(x)
    if (l === undefined) vecinos.set(x, [y])
    else l.push(y)
  }
  for (const j of joints) {
    anotar(j.a, j.b)
    anotar(j.b, j.a)
    atadorDe.set(claveDeArista(j.a, j.b), j.binder)
  }
  return { vecinos, atadorDe }
}

/**
 * ARMA EL SUBÁRBOL DE `v`, colgando de `padre`. Post-orden.
 *
 * Ésta es la regla candidata, escrita entera en once líneas. Si el bloque (1) da
 * verde, esto es el corazón del `BuildSkill` y no hay que buscar nada.
 *
 * Los hijos se recorren ORDENADOS por texto, y no es cosmética: dos corridas del
 * mismo plano tienen que producir el mismo cuerpo, con las juntas en el mismo
 * orden, o el hash del mundo depende del orden de un `Map`.
 */
function armarSubarbol(v: string, padre: string | undefined, t: Arbol, n: { i: number }): Armada | undefined {
  let a: Armada = { cuerpo: pieza(`${v}-cuerpo`), indices: new Map([[v, 0]]) }
  for (const c of [...(t.vecinos.get(v) ?? [])].sort(comparaTexto)) {
    if (c === padre) continue
    const b = armarSubarbol(c, v, t, n)
    if (b === undefined) return undefined
    const at = t.atadorDe.get(claveDeArista(v, c)) ?? 'atador'
    n.i += 1
    const obra = unir(a.cuerpo, b.cuerpo, atador(`${at}-${String(n.i)}`), PHYS, `paso-${String(n.i)}`)
    if (obra === undefined) return undefined
    // Las partes de `b` quedan corridas por cuántas traía `a`. Es lo único que
    // hay que saber para seguirle el rastro a un rol.
    const base = a.cuerpo.parts.length
    const indices = new Map(a.indices)
    for (const [rol, i] of b.indices) indices.set(rol, i + base)
    a = { cuerpo: obra, indices }
  }
  return a
}

/** Arma el plano entero. La raíz es el rol primero por texto: determinismo. */
function armarPlano(joints: readonly BlueprintJoint[], piezas: readonly string[]): Armada | undefined {
  const raiz = [...piezas].sort(comparaTexto)[0]
  if (raiz === undefined) return undefined
  return armarSubarbol(raiz, undefined, arbolDe(joints), { i: 0 })
}

/** Las juntas de la obra, dichas en ROLES y en forma comparable con el plano. */
function juntasEnRoles(a: Armada): readonly string[] {
  const rolDe = new Map<number, string>()
  for (const [rol, i] of a.indices) rolDe.set(i, rol)
  return a.cuerpo.joints
    .map((j) => {
      const x = rolDe.get(j.a) ?? `?${String(j.a)}`
      const y = rolDe.get(j.b) ?? `?${String(j.b)}`
      return claveDeArista(x, y)
    })
    .sort(comparaTexto)
}

function juntasDelPlano(joints: readonly BlueprintJoint[]): readonly string[] {
  return joints.map((j) => claveDeArista(j.a, j.b)).sort(comparaTexto)
}

// ─── Los tres planos que se miden ───────────────────────────────────────────

/** La ESTRELLA: todo cuelga del centro. Es lo que sale de encadenar. */
const ESTRELLA: readonly BlueprintJoint[] = [
  { a: 'centro', b: 'rayo-a', binder: 'atadura' },
  { a: 'centro', b: 'rayo-b', binder: 'atadura' },
  { a: 'centro', b: 'rayo-c', binder: 'atadura' },
]

/** La CADENA: el caso que encadenar NO sabe armar. Cuatro piezas en fila. */
const CADENA: readonly BlueprintJoint[] = [
  { a: 'p1', b: 'p2', binder: 'atadura' },
  { a: 'p2', b: 'p3', binder: 'atadura' },
  { a: 'p3', b: 'p4', binder: 'atadura' },
]

/** Mixto: un tronco con dos ramas de un lado y una del otro. */
const MIXTO: readonly BlueprintJoint[] = [
  { a: 'tronco', b: 'rama-a', binder: 'atadura' },
  { a: 'tronco', b: 'rama-b', binder: 'atadura' },
  { a: 'rama-b', b: 'hoja', binder: 'atadura' },
]

const PIEZAS = {
  estrella: ['centro', 'rayo-a', 'rayo-b', 'rayo-c'],
  cadena: ['p1', 'p2', 'p3', 'p4'],
  mixto: ['tronco', 'rama-a', 'rama-b', 'hoja'],
} as const

// ─── (0) El par cuerpo↔catálogo, que ya mordió una vez ──────────────────────

describe('(0) la materia de este archivo existe en la SEMILLA', () => {
  it('el atador ata de VERDAD: la junta sale con fuerza, no con cero', () => {
    // Este archivo importa `cuerpo` y `parte` de `mundo-de-prueba.ts` pero arma su
    // física con `buildSeedPhysics()`, que es OTRO catálogo. Cruzar los dos no
    // falla: `qualityOf` devuelve 0 en silencio y sale un cuerpo legal con todas
    // sus cualidades en cero. Lo midió el tramo D·bis con `fibra`, que existe sólo
    // en el catálogo local del fixture.
    //
    // Se afirma el SÍNTOMA y no el par cuerpo↔catálogo, porque el síntoma es lo
    // único que un atador fantasma cambia: todo lo demás de este archivo mide la
    // FORMA de la obra —partes, juntas, topología— y la forma sale igual atada con
    // fuerza cero.
    const r = unir(pieza('v'), undefined, atador('h'), PHYS, 'cana')
    expect(r?.joints[0]?.strength).toBeGreaterThan(0)
  })
})

// ─── (1) La pregunta del archivo ────────────────────────────────────────────

describe('(1) el post-orden realiza EXACTAMENTE las juntas que el plano declara', () => {
  for (const [nombre, joints, piezas] of [
    ['estrella', ESTRELLA, PIEZAS.estrella],
    ['cadena', CADENA, PIEZAS.cadena],
    ['mixto', MIXTO, PIEZAS.mixto],
  ] as const) {
    it(`«${nombre}»: las juntas de la obra son las del plano, dichas en roles`, () => {
      const a = armarPlano(joints, piezas)
      expect(a, `no se pudo armar «${nombre}»`).toBeDefined()
      if (a === undefined) return
      expect(a.cuerpo.parts.length).toBe(piezas.length)
      expect(juntasEnRoles(a)).toEqual(juntasDelPlano(joints))
    })
  }

  it('y la CADENA es el caso que encadenar de a una NO sabe armar', () => {
    // El control que hace que el bloque de arriba signifique algo. Si encadenar
    // diera lo mismo, no habría nada que buscar y este archivo sobraría.
    // Encadenar produce una estrella con centro en la primera pieza; la cadena
    // pide un camino. Son dos obras distintas con las mismas cuatro piezas.
    let obra: Body | undefined = pieza('p1')
    for (let i = 2; i <= 4; i++) {
      if (obra === undefined) break
      obra = unir(obra, pieza(`p${String(i)}`), atador(`at${String(i)}`), PHYS, `enc-${String(i)}`)
    }
    expect(obra?.joints.map((j) => `${String(j.a)}-${String(j.b)}`)).toEqual(['0-1', '0-2', '0-3'])
    // La cadena, en cambio, no sale toda de la parte 0.
    const a = armarPlano(CADENA, PIEZAS.cadena)
    expect(a?.cuerpo.joints.every((j) => j.a === 0)).toBe(false)
  })
})

// ─── (2) Determinismo y repetibilidad ───────────────────────────────────────

describe('(2) el mismo plano da la misma obra, junta por junta y en el mismo orden', () => {
  it('dos corridas dan juntas idénticas, en el mismo orden', () => {
    const a = armarPlano(MIXTO, PIEZAS.mixto)
    const b = armarPlano(MIXTO, PIEZAS.mixto)
    expect(a?.cuerpo.joints.map((j) => `${String(j.a)}-${String(j.b)}`)).toEqual(
      b?.cuerpo.joints.map((j) => `${String(j.a)}-${String(j.b)}`),
    )
  })

  it('y el orden en que el plano ESCRIBIÓ sus juntas no cambia la obra', () => {
    // Es la mitad que le toca al armador de lo que `definirPlano` ya normaliza:
    // dos planos que dicen lo mismo escrito distinto tienen que construir lo
    // mismo, o el sello del plano no dice nada sobre la obra que sale.
    const alReves = [...MIXTO].reverse()
    const a = armarPlano(MIXTO, PIEZAS.mixto)
    const b = armarPlano(alReves, PIEZAS.mixto)
    expect(juntasEnRoles(a as Armada)).toEqual(juntasEnRoles(b as Armada))
    expect(a?.cuerpo.joints.map((j) => `${String(j.a)}-${String(j.b)}`)).toEqual(
      b?.cuerpo.joints.map((j) => `${String(j.a)}-${String(j.b)}`),
    )
  })
})

// ─── (3) Las cotas, en los pasos intermedios ────────────────────────────────

describe('(3) ningún paso intermedio se pasa de las cotas', () => {
  it('la cadena de cuatro piezas mide la hondura del techo, y llega', () => {
    // Medido en el tramo C·bis: un árbol de cuatro armado como dos pares mide 3,
    // que es `MAX_ASSEMBLY_DEPTH` exacto. La cadena de cuatro mide lo mismo, así
    // que este caso es el borde y no un caso cómodo.
    const a = armarPlano(CADENA, PIEZAS.cadena)
    expect(a).toBeDefined()
    expect(assemblyDepthOf(a?.cuerpo as Body)).toBe(MAX_ASSEMBLY_DEPTH)
  })

  it('y una cadena de CINCO no se puede armar, aunque cinco piezas entren en `MAX_PARTS`', () => {
    // El hallazgo que le toca al `BuildSkill`: la cota que lo frena no es cuántas
    // piezas pide el plano. Cinco piezas entran de sobra en las seis de
    // `MAX_PARTS`, y la obra igual no existe porque el camino mide 4.
    const cinco: readonly BlueprintJoint[] = [
      ...CADENA,
      { a: 'p4', b: 'p5', binder: 'atadura' },
    ]
    expect(MAX_PARTS).toBeGreaterThanOrEqual(5)
    expect(armarPlano(cinco, ['p1', 'p2', 'p3', 'p4', 'p5'])).toBeUndefined()
  })

  it('la estrella de seis sí entra: la hondura de una estrella es 2 y no crece', () => {
    const seis: BlueprintJoint[] = []
    const piezas = ['centro']
    for (let i = 1; i <= 5; i++) {
      seis.push({ a: 'centro', b: `rayo-${String(i)}`, binder: 'atadura' })
      piezas.push(`rayo-${String(i)}`)
    }
    const a = armarPlano(seis, piezas)
    expect(a?.cuerpo.parts.length).toBe(MAX_PARTS)
    expect(assemblyDepthOf(a?.cuerpo as Body)).toBe(2)
  })
})
