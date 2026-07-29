// ─── EL HITO 5, TRAMO F: EL PREDICADO ────────────────────────────────────────
//
// Este archivo prueba el módulo del que cuelga todo `@anima/plan`: si dos
// escrituras del mismo `establishes` dan dos firmas, el índice tiene dos entradas
// para una cosa; si `interpretar` se traga en silencio lo que no entiende, la
// regresión encadena sobre promesas que nadie hizo.
//
// ─── LOS CRITERIOS, ESCRITOS ANTES DE IMPLEMENTAR ───────────────────────────
//
//   (a) **Las tres formas de la semilla entran, y las seis cláusulas también.**
//       Con el número al lado: cuántos trozos promete la semilla y cuántos
//       entiende la puerta, medido contra `promesasDe` y no afirmado.
//   (b) **Lo que no se entiende devuelve `undefined`**, y hay un negativo por
//       cada positivo. Un parser que acepta de más es peor que uno que rechaza.
//   (c) **La ida y la vuelta cierra**: `textoDe(interpretar(x)!) === firmaDe(x)`
//       sobre las cláusulas REALES de los cuatro procesos, no sobre inventadas.
//   (d) **La firma es una llave**: espacios, signo de matemática, repetidas y
//       orden de las cláusulas colapsan a la misma cadena.
//   (e) **`cumpleCuerpo` contesta con el motor**, contra cuerpos armados con
//       `unir` de la física — la caña de la pesca, no una maqueta.
//
// ─── ERAN DOS LOS QUE NO SE PODÍAN. QUEDA UNO ───────────────────────────────
//
// `freeStrandEnds` SIGUE sin poder contestarse desde una `BodyView` y sigue abajo
// como `it.fails` con la medición de qué falta exactamente en la superficie: no
// está tapado con una fórmula paralela, porque el hueco es de la vista y taparlo
// acá lo volvería invisible donde hay que arreglarlo.
//
// `holding(tag:…)` SÍ se cerró, y la diferencia entre los dos es lo que este
// archivo mide ahora: para `freeStrandEnds` falta un número que la vista no tiene
// (`maxParts(sharpness)`); para el tag faltaba UN CAMPO EN LA SUPERFICIE, y ahora
// está: `BodyView.tags` es `tagsDe(body, phys)` con la `Physics` viva.
//
// ─── Y SE CERRÓ DOS VECES, QUE ES LO QUE ESTE ARCHIVO TIENE QUE CONTAR ──────
//
// El primer cierre leyó el NOMBRE al revés contra un índice derivado del catálogo
// de la semilla, con el argumento de que `name` es la salida de `nameOf` y por lo
// tanto el léxico de la sustancia. El índice era honesto; la lectura mentía,
// porque la ley 4 bautiza a sus residuos `«<madre> hecho tizón»` y el prefijo
// contestaba los tags de la madre sobre un carbón con `nutrition 0`. Los cuatro
// tests de abajo cubren la conjunción entera, la UNIÓN de las partes (el límite
// de la parte dominante se cayó con el nombre), las 30 sustancias en 7 estados, y
// EL TIZÓN — que es el caso que mató a la lectura por nombre, con el cuerpo hecho
// por el motor y no a mano.

import { describe, expect, it } from 'vitest'

import {
  QUALITY_IDS,
  SEED_PROCESSES,
  CELDA_TAPADA,
  HZ_DE_REFERENCIA,
  SUSTANCIAS_SEMILLA,
  TAGS,
  buildSeedPhysics,
  correr,
  dtDeFrecuencia,
  nameOf,
  tagsDe,
  promesasDe,
  qualityOf,
  specOf,
  unir,
  type Body,
  type Physics,
  type QualityId,
} from '@anima/physics'
import type { BodyView, Cell, CellQuality, PlaceMemory, SelfView, Where } from '@anima/skills'

import {
  cumple,
  cumpleCuerpo,
  firmaDe,
  implica,
  interpretar,
  textoDe,
} from '../src/predicado.js'
import type { Predicado, VistaDelPlan } from '../src/tipos.js'

const PHYS: Physics = buildSeedPhysics()

// ─── El banco: cuerpos de verdad, atados con la ley 7 ───────────────────────
//
// Los mismos cuatro cuerpos que usa `world/tests/hito-5-la-pesca.test.ts`, y por
// la misma razón: si la caña deja de tener alcance, o el anzuelo deja de tener
// filo, este archivo se entera en el mismo tick que el mundo. Una maqueta con
// `reach: 5` escrito a mano no se entera nunca.

function vara(id: string): Body {
  return { id, form: 'vara', parts: [{ substance: 'madera', mass: 1, q: {} }], joints: [], state: {} }
}

function hebra(id: string): Body {
  return { id, form: 'hebra', parts: [{ substance: 'liana', mass: 0.2, q: {} }], joints: [], state: {} }
}

/** Un pescado: carne de verdad, con el tag `carnoso` en su sustancia. */
function pescado(id: string): Body {
  return { id, form: 'filete', parts: [{ substance: 'pescado', mass: 0.6, q: {} }], joints: [], state: {} }
}

function atar(a: Body, binder: Body, id: string): Body {
  const b = unir(a, undefined, binder, PHYS, id)
  if (b === undefined) throw new Error(`no se pudo atar ${id}`)
  return b
}

/** La caña pelada: una vara con una liana atada de un solo lado. */
const CANA: Body = atar(vara('v1'), hebra('h1'), 'cana')

/** La misma caña, con una lasca de pedernal. Nadie escribió «anzuelo». */
const ANZUELO: Body = atar(
  {
    id: 'vara-con-filo',
    form: 'vara',
    parts: [
      { substance: 'madera', mass: 1, q: {} },
      { substance: 'pedernal', mass: 0.1, q: {} },
    ],
    joints: [{ a: 0, b: 1, via: 'liana', strength: 1 }],
    state: {},
  },
  hebra('h2'),
  'cana-con-filo',
)

const HEBRA_SOLA: Body = hebra('hs')
const VARA_SOLA: Body = vara('vs')
const BRASA: Body = {
  id: 'brasa',
  form: 'bloque',
  parts: [{ substance: 'madera', mass: 0.3, q: {} }],
  joints: [],
  state: { temperature: 500 },
}
const PESCADO: Body = pescado('p1')

/**
 * El registro de cuerpos por id. Es lo que le falta a `BodyView` para poder
 * preguntarle una cualidad, y en la partida lo pone el mundo: `ctx.q` recibe la
 * vista y busca el cuerpo. Acá se hace lo mismo, en chico.
 */
const CUERPOS: ReadonlyMap<string, Body> = new Map(
  [CANA, ANZUELO, HEBRA_SOLA, VARA_SOLA, BRASA, PESCADO].map((b) => [b.id, b]),
)

const ORIGEN: Cell = { x: 0, y: 0 }

function vistaDe(b: Body): BodyView {
  return {
    id: b.id,
    at: ORIGEN,
    // `name` sale de `nameOf`, igual que en la superficie de verdad. Es la única
    // pista de sustancia que tiene una vista, y abajo se mide que no alcanza.
    name: nameOf(b, PHYS),
    // La superficie de verdad: `tagsDe(body, phys)`, la union de los tags de las
    // partes con la Physics viva. Es lo que `perceive/src/vista.ts` publica.
    tags: tagsDe(b, PHYS),
    madeByMe: true,
    joints: b.joints.map((j) => ({ a: j.a, b: j.b, strength: j.strength })),
  }
}

/** `ctx.q`: la vista entra, el motor contesta sobre el cuerpo de verdad. */
function leer(v: BodyView, q: QualityId): number {
  const b = CUERPOS.get(v.id)
  if (b === undefined) throw new Error(`cuerpo desconocido: ${v.id}`)
  return qualityOf(b, q, PHYS)
}

interface Escenario {
  readonly v: VistaDelPlan
  /** Los `Where` con los que el módulo llamó a `see`. Sirve para probar (e). */
  readonly pedidos: Where[]
}

function escenario(o: { readonly ve?: readonly Body[]; readonly mano?: readonly Body[] }): Escenario {
  const pedidos: Where[] = []
  const yo: SelfView = {
    id: 'criatura',
    at: ORIGEN,
    name: 'criatura',
    // En este mundito nada tiene sustancia, asi que nada tiene clase de materia:
    // `[]` es la respuesta honesta y es la misma que da `cuerpo()` por omision. En
    // la partida la vista lo saca de `tagsDe(body, phys)`.
    tags: [],
    madeByMe: false,
    joints: [],
    holding: (o.mano ?? []).map(vistaDe),
    capacity: 2,
    stamina: 500,
    permits: 'irreversible',
  }
  const v: VistaDelPlan = {
    // Devuelve TODO lo visible sin mirar el `Where`, a propósito: así el filtro
    // que se prueba es el del módulo y no el del doble. Lo que sí se guarda es
    // qué `Where` pidió, que es la otra mitad de lo que hay que verificar.
    see(w: Where): readonly BodyView[] {
      pedidos.push(w)
      return (o.ve ?? []).map(vistaDe)
    },
    recall(): readonly PlaceMemory[] {
      return []
    },
    q: leer,
    qAt(_at: Cell, _q: CellQuality): number {
      return 0
    },
    self: yo,
    clock: { phase: 'dia', secondsToNightfall: 300, dayLength: 600 },
  }
  return { v, pedidos }
}

/** Los seis trozos que prometen los cuatro procesos de la semilla, aplanados. */
const TROZOS_DE_LA_SEMILLA: readonly string[] = SEED_PROCESSES.flatMap((p) =>
  p.establishes.flatMap((e) => e.split('&').map((t) => t.trim())).filter((t) => t.length > 0),
)

// ─── (a) Las tres formas ────────────────────────────────────────────────────

describe('interpretar: las tres formas que la semilla usa de verdad', () => {
  it('una cualidad del catálogo es una cualidad', () => {
    expect(interpretar('temperature>=400')).toEqual({
      k: 'cualidad',
      test: { q: 'temperature', op: '>=', v: 400 },
    })
    expect(interpretar('flexibility>=0.8')).toEqual({
      k: 'cualidad',
      test: { q: 'flexibility', op: '>=', v: 0.8 },
    })
    expect(interpretar('tensile>=0.3')).toEqual({
      k: 'cualidad',
      test: { q: 'tensile', op: '>=', v: 0.3 },
    })
  })

  it('`reach>=2` es CUALIDAD y no geometría, y ésa es la trampa del vocabulario', () => {
    // `reach` está en el catálogo de las 29 —derivada, pero cualidad—; la función
    // geométrica que la calcula se llama `longestAxis` y NO está. Confundirlas
    // manda `reach>=2` por el camino que no sabe contestarla sola.
    expect((QUALITY_IDS as readonly string[]).includes('reach')).toBe(true)
    expect((QUALITY_IDS as readonly string[]).includes('longestAxis')).toBe(false)
    expect(interpretar('reach>=2')).toEqual({ k: 'cualidad', test: { q: 'reach', op: '>=', v: 2 } })
    expect(interpretar('longestAxis>=2')).toEqual({
      k: 'geometria',
      f: 'longestAxis',
      op: '>=',
      v: 2,
    })
  })

  it('las tres funciones geométricas entran como geometría', () => {
    expect(interpretar('freeStrandEnds>=1')).toEqual({
      k: 'geometria',
      f: 'freeStrandEnds',
      op: '>=',
      v: 1,
    })
    expect(interpretar('jointCount>=1')).toEqual({ k: 'geometria', f: 'jointCount', op: '>=', v: 1 })
    expect(interpretar('longestAxis>=2')).toEqual({
      k: 'geometria',
      f: 'longestAxis',
      op: '>=',
      v: 2,
    })
    // Ninguna de las tres es cualidad: si alguna lo fuera, el catálogo tendría
    // dos nombres para lo mismo y este módulo elegiría uno de los dos.
    for (const f of ['freeStrandEnds', 'jointCount', 'longestAxis']) {
      expect((QUALITY_IDS as readonly string[]).includes(f)).toBe(false)
    }
  })

  it('`holding(tag:…)` entra con cualquiera de los siete tags de la física', () => {
    expect(interpretar('holding(tag:carnoso)')).toEqual({ k: 'sostiene', tag: 'carnoso' })
    for (const t of TAGS) {
      expect(interpretar(`holding(tag:${t})`)).toEqual({ k: 'sostiene', tag: t })
    }
  })

  it('los cuatro operadores, y los dos signos de matemática que la puerta también acepta', () => {
    expect(interpretar('mass>0')).toEqual({ k: 'cualidad', test: { q: 'mass', op: '>', v: 0 } })
    expect(interpretar('moisture<=0.2')).toEqual({
      k: 'cualidad',
      test: { q: 'moisture', op: '<=', v: 0.2 },
    })
    expect(interpretar('decay<1')).toEqual({ k: 'cualidad', test: { q: 'decay', op: '<', v: 1 } })
    expect(interpretar('reach≥2')).toEqual(interpretar('reach>=2'))
    expect(interpretar('moisture≤0.2')).toEqual(interpretar('moisture<=0.2'))
  })

  it('LA MEDICIÓN: la semilla promete 6 trozos, la puerta entiende 4, acá entran los 6', () => {
    expect(TROZOS_DE_LA_SEMILLA).toEqual([
      'temperature>=400',
      'freeStrandEnds>=1',
      'reach>=2',
      'flexibility>=0.8',
      'tensile>=0.3',
      'holding(tag:carnoso)',
    ])
    // Lo que entiende el parser de la puerta, contado y no afirmado.
    const porLaPuerta = SEED_PROCESSES.reduce((n, p) => n + promesasDe(p, PHYS).length, 0)
    expect(porLaPuerta).toBe(4)
    // Las dos que se pierden son justo las dos de la pesca.
    expect(promesasDe(SEED_PROCESSES[1]!, PHYS).map((x) => x.q)).toEqual(['reach'])
    expect(promesasDe(SEED_PROCESSES[3]!, PHYS)).toEqual([])
    // Y acá no se pierde ninguna.
    for (const t of TROZOS_DE_LA_SEMILLA) expect(interpretar(t)).toBeDefined()
  })
})

// ─── (b) Un negativo por cada positivo ──────────────────────────────────────

describe('interpretar: lo que NO se entiende dice que no se entiende', () => {
  it('un nombre que no está en ningún catálogo no es una cualidad', () => {
    // `stock` es el ejemplo real: el documento escribe `stock > 0` para el rol
    // `source` de `extraccion` y el catálogo de cualidades es cerrado, así que
    // `mass > 0` ocupó su lugar. Un `establishes` que lo prometiera no se entiende.
    expect(interpretar('stock>0')).toBeUndefined()
    expect(interpretar('hunger>=1')).toBeUndefined()
    expect(interpretar('edible>0')).toBeUndefined()
  })

  it('una función geométrica mal escrita no es una geometría', () => {
    expect(interpretar('longestAxi>=2')).toBeUndefined()
    expect(interpretar('freeStrandEnd>=1')).toBeUndefined()
    expect(interpretar('jointcount>=1')).toBeUndefined()
  })

  it('un tag que no está en la enumeración cerrada no es un `sostiene`', () => {
    // `pescado` es una SUSTANCIA, no un tag. Confundirlas es confundir la materia
    // con la superficie por la que las leyes la agarran.
    expect(interpretar('holding(tag:pescado)')).toBeUndefined()
    expect(interpretar('holding(tag:)')).toBeUndefined()
    expect(interpretar('holding(carnoso)')).toBeUndefined()
    expect(interpretar('holding(tag:carnoso')).toBeUndefined()
    expect(interpretar('holding(tag:carnoso))')).toBeUndefined()
  })

  it('sin operador, sin valor o sin nombre no hay predicado', () => {
    expect(interpretar('temperature')).toBeUndefined()
    expect(interpretar('>=400')).toBeUndefined()
    expect(interpretar('temperature>=')).toBeUndefined()
    expect(interpretar('temperature>=mucho')).toBeUndefined()
    expect(interpretar('')).toBeUndefined()
    expect(interpretar('   ')).toBeUndefined()
  })

  it('`temperature>=` NO entra como `temperature>=0`, que cumpliría cualquier cosa', () => {
    // `Number('')` es 0 y no NaN: sin el control de largo, el predicado más
    // permisivo del sistema se escribía con un error de tipeo.
    expect(Number('')).toBe(0)
    expect(interpretar('temperature>=')).toBeUndefined()
  })

  it('dos cláusulas no son un predicado: `Predicado` no tiene forma conjuntiva', () => {
    expect(interpretar('catch>0 & reach>=2')).toBeUndefined()
    expect(interpretar('catch>0&reach>=2')).toBeUndefined()
    // Pero la FIRMA sí las toma: es la llave del índice, y ahí sí son una cosa.
    expect(firmaDe('catch>0 & reach>=2')).toBe('catch>0&reach>=2')
  })
})

// ─── (c) La ida y la vuelta ─────────────────────────────────────────────────

describe('textoDe: la ida y la vuelta cierra', () => {
  it('sobre las seis cláusulas REALES de la semilla', () => {
    for (const t of TROZOS_DE_LA_SEMILLA) {
      const p = interpretar(t)
      expect(p, t).toBeDefined()
      expect(textoDe(p as Predicado), t).toBe(firmaDe(t))
      // Y el texto canónico se vuelve a interpretar igual: idempotente.
      expect(interpretar(textoDe(p as Predicado))).toEqual(p)
    }
  })

  it('sobre escrituras sucias del mismo predicado', () => {
    const sucias = [
      'temperature >= 400',
      'temperature≥400',
      '  temperature>=400  ',
      'flexibility>=0.80',
      'flexibility >= .8',
      'reach ≥ 2',
      'holding(tag: carnoso)',
      'jointCount > 0',
      'mass>1e2',
    ]
    for (const s of sucias) {
      const p = interpretar(s)
      expect(p, s).toBeDefined()
      expect(textoDe(p as Predicado), s).toBe(firmaDe(s))
    }
  })

  it('el número se canoniza: tres escrituras de 0,8 dan el mismo texto', () => {
    expect(textoDe(interpretar('flexibility>=0.80') as Predicado)).toBe('flexibility>=0.8')
    expect(textoDe(interpretar('flexibility>=.8') as Predicado)).toBe('flexibility>=0.8')
    expect(textoDe(interpretar('flexibility>=8e-1') as Predicado)).toBe('flexibility>=0.8')
  })

  it('NEGATIVO: dos predicados distintos no dan el mismo texto', () => {
    expect(textoDe(interpretar('reach>=2') as Predicado)).not.toBe(
      textoDe(interpretar('reach>=3') as Predicado),
    )
    expect(textoDe(interpretar('reach>=2') as Predicado)).not.toBe(
      textoDe(interpretar('reach>2') as Predicado),
    )
    // Y la cualidad `reach` no se confunde con la geometría `longestAxis`, aunque
    // una sea el alias de la otra: son dos promesas distintas y se indexan aparte.
    expect(textoDe(interpretar('reach>=2') as Predicado)).not.toBe(
      textoDe(interpretar('longestAxis>=2') as Predicado),
    )
  })
})

// ─── (d) La firma es una llave ──────────────────────────────────────────────

describe('firmaDe: dos escrituras del mismo predicado dan la misma llave', () => {
  it('los espacios y el signo de matemática no cuentan', () => {
    expect(firmaDe('  temperature  >=  400 ')).toBe('temperature>=400')
    expect(firmaDe('temperature≥400')).toBe('temperature>=400')
    expect(firmaDe('holding(tag: carnoso)')).toBe('holding(tag:carnoso)')
  })

  it('el orden de las cláusulas no cuenta', () => {
    const a = firmaDe('catch>0 & reach>=2')
    const b = firmaDe('reach>=2&catch>0')
    const c = firmaDe('   reach >= 2   &   catch > 0   ')
    expect(a).toBe('catch>0&reach>=2')
    expect(b).toBe(a)
    expect(c).toBe(a)
  })

  it('el orden es TOTAL: las seis permutaciones de tres cláusulas dan una sola llave', () => {
    const cl = ['reach>=2', 'catch>0', 'flexibility>=0.8']
    const permutaciones: readonly (readonly number[])[] = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ]
    const firmas = new Set(permutaciones.map((p) => firmaDe(p.map((i) => cl[i]!).join(' & '))))
    expect(firmas.size).toBe(1)
    expect([...firmas][0]).toBe('catch>0&flexibility>=0.8&reach>=2')
  })

  it('las repetidas colapsan y las vacías se ignoran', () => {
    expect(firmaDe('reach>=2 & reach>=2')).toBe('reach>=2')
    expect(firmaDe('reach>=2 & reach >= 2 & reach≥2')).toBe('reach>=2')
    expect(firmaDe('&reach>=2&')).toBe('reach>=2')
    expect(firmaDe('')).toBe('')
  })

  it('lo que no se entiende se conserva, sin blancos: la puerta hace lo mismo', () => {
    // No se tira, porque un `establishes` ilegible IGUAL identifica al proceso que
    // lo escribió; y no se interpreta, porque no sabemos qué dice.
    expect(firmaDe('stock > 0')).toBe('stock>0')
    expect(firmaDe('stock > 0 & reach>=2')).toBe('reach>=2&stock>0')
  })

  it('NEGATIVO: dos predicados distintos no comparten llave', () => {
    expect(firmaDe('catch>0&reach>=2')).not.toBe(firmaDe('catch>0&reach>=3'))
    expect(firmaDe('reach>=2')).not.toBe(firmaDe('reach>2'))
    expect(firmaDe('holding(tag:carnoso)')).not.toBe(firmaDe('holding(tag:vegetal)'))
    // Un subconjunto no es el mismo predicado.
    expect(firmaDe('catch>0&reach>=2')).not.toBe(firmaDe('catch>0'))
  })

  it('la misma entrada da la misma llave dos veces: no hay orden que dependa del idioma', () => {
    const s = 'tensile>=0.3 & flexibility>=0.8 & holding(tag:carnoso) & freeStrandEnds>=1'
    expect(firmaDe(s)).toBe(firmaDe(s))
    expect(firmaDe(s)).toBe('flexibility>=0.8&freeStrandEnds>=1&holding(tag:carnoso)&tensile>=0.3')
  })
})

// ─── (e) `cumpleCuerpo` contra el mundo real ────────────────────────────────

describe('cumpleCuerpo: contra cuerpos armados con la física, no con maquetas', () => {
  it('el banco es el de la pesca: la caña tiene alcance y engancha', () => {
    // Los números que sostienen todo lo de abajo, medidos con `qualityOf`.
    expect(qualityOf(CANA, 'reach', PHYS)).toBe(4.8)
    expect(qualityOf(CANA, 'catch', PHYS)).toBe(0.15)
    expect(CANA.joints.length).toBe(1)
    expect(qualityOf(HEBRA_SOLA, 'reach', PHYS)).toBeCloseTo(1.2, 10)
    expect(qualityOf(VARA_SOLA, 'reach', PHYS)).toBe(4)
    expect(VARA_SOLA.joints.length).toBe(0)
  })

  it('una cualidad se pregunta con `q`, o sea con el motor', () => {
    const p = interpretar('reach>=2') as Predicado
    expect(cumpleCuerpo(p, vistaDe(CANA), leer)).toBe(true)
    // NEGATIVO: la hebra sola mide 1,2 y no llega a 2. Nadie escribió el umbral
    // acá: sale del `establishes` de `union` y del cuerpo de verdad.
    expect(cumpleCuerpo(p, vistaDe(HEBRA_SOLA), leer)).toBe(false)
  })

  it('los cuatro operadores contra el mismo cuerpo', () => {
    const v = vistaDe(BRASA)
    expect(cumpleCuerpo(interpretar('temperature>=400') as Predicado, v, leer)).toBe(true)
    expect(cumpleCuerpo(interpretar('temperature>500') as Predicado, v, leer)).toBe(false)
    expect(cumpleCuerpo(interpretar('temperature<=500') as Predicado, v, leer)).toBe(true)
    expect(cumpleCuerpo(interpretar('temperature<400') as Predicado, v, leer)).toBe(false)
    // NEGATIVO: la misma cualidad sobre un cuerpo frío.
    expect(cumpleCuerpo(interpretar('temperature>=400') as Predicado, vistaDe(VARA_SOLA), leer)).toBe(
      false,
    )
  })

  it('`jointCount` se contesta entera: la vista trae las mismas juntas que cuenta el motor', () => {
    const p = interpretar('jointCount>=1') as Predicado
    expect(cumpleCuerpo(p, vistaDe(CANA), leer)).toBe(true)
    expect(cumpleCuerpo(p, vistaDe(ANZUELO), leer)).toBe(true)
    expect(cumpleCuerpo(interpretar('jointCount>=2') as Predicado, vistaDe(ANZUELO), leer)).toBe(true)
    // NEGATIVO: una vara sin atar no tiene ninguna junta.
    expect(cumpleCuerpo(p, vistaDe(VARA_SOLA), leer)).toBe(false)
    expect(cumpleCuerpo(interpretar('jointCount>=2') as Predicado, vistaDe(CANA), leer)).toBe(false)
  })

  it('`longestAxis` se contesta POR ALIAS, y el alias sale del catálogo', () => {
    // El puente entero: `reach` está declarada como `geom(longestAxis)` y nada
    // más. Si el catálogo dejara de decir eso, `longestAxis` se vuelve
    // incontestable desde una vista y hay que enterarse acá y no en la partida.
    expect(specOf('reach').derived).toEqual({ k: 'geom', f: 'longestAxis' })
    const p = interpretar('longestAxis>=2') as Predicado
    expect(cumpleCuerpo(p, vistaDe(CANA), leer)).toBe(true)
    // El número que usa es el del motor, no uno recalculado: mismo umbral justo.
    expect(cumpleCuerpo(interpretar('longestAxis>=4.8') as Predicado, vistaDe(CANA), leer)).toBe(true)
    expect(
      cumpleCuerpo(interpretar('longestAxis>4.8') as Predicado, vistaDe(CANA), leer),
    ).toBe(false)
    // NEGATIVO: la hebra sola.
    expect(cumpleCuerpo(p, vistaDe(HEBRA_SOLA), leer)).toBe(false)
  })

  it('una `f` que no es ninguna de las tres funciones geométricas no cumple nada', () => {
    const inventado: Predicado = { k: 'geometria', f: 'largoDelPalo', op: '>=', v: 0 }
    expect(cumpleCuerpo(inventado, vistaDe(CANA), leer)).toBe(false)
  })
})

// ─── LOS DOS HUECOS DE LA SUPERFICIE, MEDIDOS ───────────────────────────────

describe('lo que una `BodyView` no puede contestar', () => {
  it('MEDICIÓN: la caña TIENE una punta libre, y el motor lo sabe', () => {
    // `catch = freeStrandEnds · (0.15 + maxParts(sharpness)·0.5)`. En la caña
    // pelada no hay filo en ninguna parte, así que el factor es 0,15 exacto y el
    // `catch` medido dice que hay exactamente una punta libre.
    expect(qualityOf(CANA, 'catch', PHYS)).toBe(0.15)
    expect(qualityOf(CANA, 'catch', PHYS) / 0.15).toBe(1)
    // Y en el anzuelo, con la lasca de pedernal, sigue habiendo UNA.
    expect(qualityOf(ANZUELO, 'catch', PHYS)).toBe(0.575)
    expect(qualityOf(ANZUELO, 'catch', PHYS) / (0.15 + 0.85 * 0.5)).toBeCloseTo(1, 10)
  })

  it('MEDICIÓN: lo que falta es `maxParts`, y la vista sólo sabe dar `own`', () => {
    // Éste es el número exacto del hueco. `maxParts(sharpness)` del anzuelo es el
    // filo del pedernal, 0,85; `own(sharpness)` —lo único que `ctx.q` sabe dar—
    // es el promedio PESADO POR MASA de las tres partes, 0,0653…
    const own = qualityOf(ANZUELO, 'sharpness', PHYS)
    expect(own).toBeCloseTo(0.06538461538461539, 12)
    const maxParts = 0.85
    expect(PHYS.substances.get('pedernal')?.perUnitMass.sharpness).toBe(maxParts)
    // Y despejar `freeStrandEnds` con el que se puede leer da 3,1473684… puntas
    // libres donde hay 1. No es un error chico: es otro cuerpo.
    const despejado = qualityOf(ANZUELO, 'catch', PHYS) / (0.15 + own * 0.5)
    expect(despejado).toBeCloseTo(3.1473684210526316, 12)
    expect(despejado).not.toBeCloseTo(1, 1)
  })

  it.fails('HUECO 1: `freeStrandEnds>=1` sobre la caña que SÍ la tiene', () => {
    // Falla, y tiene que fallar hasta que la superficie cambie. El motor calcula
    // las tres funciones geométricas en `geomOf(b: Body, …)`, que necesita `form`,
    // `parts` (masa y sustancia de cada una) y `joints`. Una `BodyView` trae
    // `joints` y NADA MÁS de esa lista, y para `freeStrandEnds` hacen falta las
    // masas y la flexibilidad de cada parte.
    //
    // La otra puerta —despejar desde `catch`— está medida arriba y da 3,147 en vez
    // de 1, porque exige `maxParts(sharpness)` y `ctx.q` sólo da `own`.
    //
    // QUÉ FALTA, EXACTAMENTE: o `BodyView` expone sus partes (masa, sustancia y
    // cualidades), o la superficie suma una lectura de geometría —un
    // `ctx.geom(b, f)` que llame a `geomOf`—, o el catálogo declara una cualidad
    // que sea alias exacto de `geom(freeStrandEnds)` como `reach` lo es de
    // `longestAxis`. La tercera es la más barata y la que menos superficie abre.
    //
    // MIENTRAS TANTO: `union` promete `freeStrandEnds>=1` y el planificador no
    // puede verificar que ya lo tiene, así que ataría una caña que ya está atada.
    expect(cumpleCuerpo(interpretar('freeStrandEnds>=1') as Predicado, vistaDe(CANA), leer)).toBe(
      true,
    )
  })

  it('HUECO 1, el lado que sí anda: contesta `false` en vez de romper el tick', () => {
    // De los dos errores posibles, éste es el barato: rehacer algo que ya se tiene
    // cuesta trabajo; creer que se tiene algo que no, manda a la criatura al río
    // con las manos vacías. Y no lanza: una excepción acá voltea el tick entero.
    expect(() =>
      cumpleCuerpo(interpretar('freeStrandEnds>=1') as Predicado, vistaDe(CANA), leer),
    ).not.toThrow()
    expect(cumpleCuerpo(interpretar('freeStrandEnds>=1') as Predicado, vistaDe(CANA), leer)).toBe(
      false,
    )
  })

  it('EL HUECO 2 ESTÁ CERRADO: `holding(tag:carnoso)` con un pescado en la mano', () => {
    // ─── ERA UN `it.fails` Y AHORA NO, Y ÉSTA ES LA DIFERENCIA ──────────────
    //
    // Decía que no se podía: los tags son de la SUSTANCIA y una `BodyView` no la
    // trae. La primera mitad sigue siendo cierta; la segunda dejó de serlo cuando
    // la superficie empezó a traerla: `BodyView.tags` es `tagsDe(body, phys)` con
    // la `Physics` VIVA, calculado en `perceive/src/vista.ts` al lado de `name` y
    // por el mismo precio. (En el medio hubo un cierre que leía el NOMBRE al revés
    // contra un índice del catálogo de la semilla; mentía sobre los residuos de la
    // ley 4 y se fue entero — ver el test del TIZÓN más abajo.)
    //
    // LO QUE COSTABA, medido en `mind/tests/hito-5-el-criterio.test.ts`: 196
    // rechazos `sin-pozo` en 6300 ticks, porque una meta de comida no se daba por
    // cumplida NUNCA y todo plan arrancaba con «pescá uno».
    const { v } = escenario({ mano: [PESCADO] })
    // Las dos puntas de la cadena, afirmadas contra el motor y el catálogo: el
    // nombre lo escribe `nameOf`, los tags los tiene la sustancia.
    expect(nameOf(PESCADO, PHYS)).toContain('pescado')
    expect(PHYS.substances.get('pescado')?.tags).toContain('carnoso')
    expect(cumple(interpretar('holding(tag:carnoso)') as Predicado, v)).toBe(true)
    // Y no contesta que sí a cualquier tag: la enumeración es plana y `carnoso` no
    // arrastra a `mineral`. Sin esto, un `true` podría ser un índice que dice que sí
    // a todo.
    expect(cumple(interpretar('holding(tag:mineral)') as Predicado, v)).toBe(false)
    // La CONJUNCIÓN entera, sobre el mismo cuerpo: el pescado crudo de este banco
    // tiene `toxicity` 0,25, así que cumple el tag y no cumple el umbral de lo
    // cocido. Contestar la mitad que se puede daría `true` acá, que es el error caro.
    expect(cumple(interpretar('holding(tag:carnoso,toxicity<=0.05)') as Predicado, v)).toBe(false)
    expect(cumple(interpretar('holding(tag:carnoso,toxicity<=0.3)') as Predicado, v)).toBe(true)
  })

  it('EL LÍMITE QUE SE CAYÓ: los tags son la UNIÓN de las partes, no los de la dominante', () => {
    // ─── ACÁ ESTABA PINADA LA LECTURA ESTRICTA, Y ERA UNA CONSECUENCIA DEL BUG ─
    //
    // Cuando `holding(tag:…)` se contestaba leyendo `BodyView.name`, los tags eran
    // por fuerza los de la parte DOMINANTE —es lo único que `nameOf` nombra—, así
    // que «una caña con un pescado atado no es carnosa» quedaba escrito como un
    // límite aceptado. Con `BodyView.tags = tagsDe(body, phys)` el límite no
    // existe: `tagsDe` une los tags de TODAS las partes, que es la misma lectura
    // con la que la física decide qué ley le toca a qué cuerpo.
    //
    // La caña pelada sigue sin ser carnosa, y ahora por el motivo correcto: no
    // tiene una sola parte de carne. Lo que cambia es la caña CON el pescado.
    expect(nameOf(CANA, PHYS)).toContain('madera')
    const { v } = escenario({ mano: [CANA] })
    expect(cumple(interpretar('holding(tag:carnoso)') as Predicado, v)).toBe(false)
    // Y lo que la caña SÍ es, lo contesta bien: la madera es vegetal.
    expect(cumple(interpretar('holding(tag:vegetal)') as Predicado, v)).toBe(true)

    // La caña con el pescado atado: `nameOf` la sigue llamando por la madera —la
    // parte más pesada es la vara de 1 kg— y los tags dicen las dos cosas.
    const conPescado = atar(CANA, pescado('atado'), 'cana-con-pescado')
    expect(nameOf(conPescado, PHYS)).toContain('madera')
    // Los tags, medidos y no supuestos: la unión de madera + liana + pescado. Van
    // los cuatro y no un `toContain`, para que agrandar la unión sin querer se note.
    expect([...tagsDe(conPescado, PHYS)].sort()).toEqual(['carnoso', 'fibroso', 'organico', 'vegetal'])
    const { v: v2 } = escenario({ mano: [conPescado] })
    expect(cumple(interpretar('holding(tag:carnoso)') as Predicado, v2)).toBe(true)
    expect(cumple(interpretar('holding(tag:vegetal)') as Predicado, v2)).toBe(true)
  })

  it('la respuesta sale del CATÁLOGO y no del nombre: las 30 sustancias, en 7 estados', () => {
    // La cota que hace que esto no sea una lista escrita a mano: para las TREINTA
    // sustancias de la semilla, y en los estados de cocción y de fuego que
    // `nameOf` sabe adjetivar, la vista publica los tags EXACTOS del catálogo. El
    // adjetivo de estado no toca la respuesta, que es justo lo que la lectura por
    // nombre no podía garantizar.
    const estados: readonly Record<string, number>[] = [
      {},
      { temperature: 900 },
      { charred: 1 },
      { charred: 0.3 },
      { digestibility: 0.95 },
      { moisture: 0.9 },
      { decay: 0.8 },
    ]
    let cuantos = 0
    for (const s of SUSTANCIAS_SEMILLA) {
      for (const estado of estados) {
        const b: Body = {
          id: `probe-${s.id}`,
          form: 'bloque',
          parts: [{ substance: s.id, mass: 1, q: {} }],
          joints: [],
          state: estado,
        }
        expect([...vistaDe(b).tags].sort(), `«${nameOf(b, PHYS)}»`).toEqual([...s.tags].sort())
        cuantos++
      }
    }
    expect(cuantos).toBe(SUSTANCIAS_SEMILLA.length * estados.length)
  })

  it('EL TIZÓN: un pescado pasado de fuego YA NO se da por carnoso, y el motor lo fabrica', () => {
    // ─── EL BUG QUE CERRÓ ESTE TEST, MEDIDO Y NO ARGUMENTADO ─────────────────
    //
    // `cumpleCuerpo` contestaba `holding(tag:…)` con un índice `nombre → tags`
    // derivado de `SUSTANCIAS_SEMILLA` y buscado por PREFIJO sobre `BodyView.name`.
    // El índice era honesto; lo que mentía era la entrada: `residuoDe`
    // (`physics/src/leyes.ts`) bautiza a lo que la ley 4 da de alta
    // ``${madre.lexeme.nombre} hecho tizón``, así que un pescado que se pasó de
    // fuego se llama «pescado hecho tizón …» y el prefijo contestaba los tags del
    // pescado. Los 60 residuos de las 30 sustancias de la semilla heredan el
    // prefijo: era la regla de bautismo y no un borde.
    //
    // Y es EL ESLABÓN SIGUIENTE de la cadena del Hito 5 (pescar → cocinar →
    // pasarse de cocción): con `holding(tag:carnoso)` dada por cumplida sobre un
    // carbón, la meta de comida queda satisfecha para siempre y la criatura deja
    // de tener hambre con cero calorías en la mano.
    //
    // Acá no se fabrica el tizón a mano: se le da un pescado al MOTOR, en una
    // celda tapada (oxígeno bajo, que es lo que la ley 4 lee para decidir residuo
    // carbonoso) y a temperatura de fuego, y se lo deja andar.
    const phys = buildSeedPhysics()
    const crudo: Body = {
      id: 'pescado-al-fuego',
      form: 'bloque',
      parts: [{ substance: 'pescado', mass: 2.887, q: {} }],
      joints: [],
      state: { temperature: 700 },
    }
    const r = correr(
      crudo,
      { celda: { ...CELDA_TAPADA, ambiente: 700 } },
      phys,
      dtDeFrecuencia(HZ_DE_REFERENCIA),
      200,
    )
    // El motor dio de alta una sustancia nueva, y no es carnosa.
    expect(r.nuevas.length).toBeGreaterThan(0)
    for (const s of r.nuevas) expect(s.tags).not.toContain('carnoso')
    // El NOMBRE sigue empezando con «pescado », que es lo que hacía mentir al
    // índice viejo. Se pina para que el día que alguien vuelva a leer el nombre,
    // este test le muestre por qué no se puede.
    const nombre = nameOf(r.body, r.phys)
    expect(nombre.startsWith('pescado ')).toBe(true)
    // Y no alimenta: cero calorías.
    expect(qualityOf(r.body, 'calories', r.phys)).toBe(0)

    // LA VISTA, construida como la construye `perceive/src/vista.ts`: con la
    // `Physics` que salió de la corrida, que es la que tiene la sustancia nueva.
    const vista: BodyView = {
      id: r.body.id,
      at: ORIGEN,
      name: nombre,
      tags: tagsDe(r.body, r.phys),
      madeByMe: true,
      joints: [],
    }
    const leerConNueva = (_v: BodyView, q: QualityId): number => qualityOf(r.body, q, r.phys)

    console.log(
      `\n── EL TIZÓN, VISTO POR LA SUPERFICIE ${'─'.repeat(30)}\n` +
        `  nombre: «${nombre}» (empieza con «pescado »: sí)\n` +
        `  sustancias nuevas: ${r.nuevas.map((s) => `${s.id} ${JSON.stringify(s.tags)}`).join(' · ')}\n` +
        `  tags que publica la vista: [${vista.tags.join(', ')}]\n` +
        `  calories ${qualityOf(r.body, 'calories', r.phys).toFixed(4)} · ` +
        `nutrition ${qualityOf(r.body, 'nutrition', r.phys).toFixed(4)}\n`,
    )

    // LO QUE CIERRA EL HUECO: el tizón NO es carnoso, y sí es carbonoso.
    expect([...vista.tags]).not.toContain('carnoso')
    expect(cumpleCuerpo(interpretar('holding(tag:carnoso)') as Predicado, vista, leerConNueva)).toBe(false)
    expect(cumpleCuerpo(interpretar('holding(tag:carbonoso)') as Predicado, vista, leerConNueva)).toBe(true)
  })

  it('HUECO 2, el lado que sí anda: con la mano vacía contesta que no, y es verdad', () => {
    const { v } = escenario({ mano: [] })
    expect(cumple(interpretar('holding(tag:carnoso)') as Predicado, v)).toBe(false)
    // Y no mira lo que se VE: un pescado en la orilla no es un pescado en la mano.
    const { v: v2 } = escenario({ ve: [PESCADO], mano: [] })
    expect(cumple(interpretar('holding(tag:carnoso)') as Predicado, v2)).toBe(false)
  })
})

// ─── `cumple` sobre el mundo visible ────────────────────────────────────────

describe('cumple: el mundo tal como se ve hoy', () => {
  it('una cualidad se cumple si hay algún cuerpo visible que la cumpla', () => {
    const { v } = escenario({ ve: [VARA_SOLA, BRASA] })
    expect(cumple(interpretar('temperature>=400') as Predicado, v)).toBe(true)
    // NEGATIVO: sin la brasa, nadie la cumple.
    const { v: frio } = escenario({ ve: [VARA_SOLA, HEBRA_SOLA] })
    expect(cumple(interpretar('temperature>=400') as Predicado, frio)).toBe(false)
  })

  it('el filtro se le pide al mundo cuando se puede, y se hace acá cuando no', () => {
    // Una cualidad ES un `Where`, así que se la resuelve el índice del mundo.
    const { v, pedidos } = escenario({ ve: [BRASA] })
    cumple(interpretar('temperature>=400') as Predicado, v)
    expect(pedidos).toEqual([[{ q: 'temperature', op: '>=', v: 400 }]])
    // Una geometría no se puede escribir como `QualityTest`: se pide lo visible.
    const { v: v2, pedidos: p2 } = escenario({ ve: [CANA] })
    cumple(interpretar('jointCount>=1') as Predicado, v2)
    expect(p2).toEqual([[]])
  })

  it('una geometría contestable se cumple contra lo visible', () => {
    const { v } = escenario({ ve: [VARA_SOLA, CANA] })
    expect(cumple(interpretar('jointCount>=1') as Predicado, v)).toBe(true)
    expect(cumple(interpretar('longestAxis>=4.8') as Predicado, v)).toBe(true)
    // NEGATIVO: sin la caña no hay ninguna junta a la vista.
    const { v: pelado } = escenario({ ve: [VARA_SOLA, HEBRA_SOLA] })
    expect(cumple(interpretar('jointCount>=1') as Predicado, pelado)).toBe(false)
  })

  it('con nada a la vista no se cumple nada', () => {
    const { v } = escenario({})
    expect(cumple(interpretar('reach>=2') as Predicado, v)).toBe(false)
    expect(cumple(interpretar('jointCount>=0') as Predicado, v)).toBe(false)
    expect(cumple(interpretar('holding(tag:carnoso)') as Predicado, v)).toBe(false)
  })
})

// ─── (7) `implica`: el orden que el índice no tenía ─────────────────────────

describe('implica: cumplir esto garantiza cumplir aquello', () => {
  /** El atajo que hace legible la tabla de abajo: dos textos, una respuesta. */
  function garantiza(a: string, b: string): boolean {
    const x = interpretar(a)
    const y = interpretar(b)
    if (x === undefined || y === undefined) throw new Error(`«${a}» o «${b}» no se interpretan`)
    return implica(x, y)
  }

  it('la reflexividad, sobre las seis promesas REALES de la semilla', () => {
    // Es la propiedad de la que depende que este cambio no rompa nada: la
    // comparación vieja era la igualdad de texto, y la igualdad de texto tiene que
    // seguir estando adentro. Las seis salen de `SEED_PROCESSES`, no de una lista.
    const promesas = SEED_PROCESSES.flatMap((p) => p.establishes)
    expect(promesas.length).toBe(6)
    for (const t of promesas) expect(garantiza(t, t), `«${t}» no se implica a sí misma`).toBe(true)
  })

  it('hacia arriba: un umbral más alto garantiza los más bajos, y no al revés', () => {
    expect(garantiza('temperature>=400', 'temperature>=399')).toBe(true)
    expect(garantiza('temperature>=400', 'temperature>=20')).toBe(true)
    expect(garantiza('temperature>=399', 'temperature>=400')).toBe(false)
    // Y con geometría, que es la otra forma con orden.
    expect(garantiza('freeStrandEnds>=2', 'freeStrandEnds>=1')).toBe(true)
    expect(garantiza('freeStrandEnds>=1', 'freeStrandEnds>=2')).toBe(false)
  })

  it('hacia abajo: `<=` es simétrico de `>=`, y los dos sentidos no se cruzan', () => {
    expect(garantiza('heatCapacity<=0.9', 'heatCapacity<=9')).toBe(true)
    expect(garantiza('heatCapacity<=9', 'heatCapacity<=0.9')).toBe(false)
    // Cruzar direcciones NO se decide acá, ni siquiera cuando la aritmética
    // alcanzaría: `q <= -1` implica `q < 0`, y saberlo pide el rango del catálogo.
    // Una implicación que dependa del rango cambia cuando alguien recalibra.
    expect(garantiza('temperature<=10', 'temperature>=5')).toBe(false)
    expect(garantiza('temperature>=5', 'temperature<=10')).toBe(false)
  })

  it('EL CASO DE LA SEMILLA: `catch>0` no garantiza `catch>0.0001`', () => {
    // El puente promete `catch > 0` y nada más. El 0,00005 cumple el primero y no
    // el segundo, así que un objetivo `catch > 0.0001` NO tiene plan — y eso está
    // bien. Lo que estaba mal era el mensaje del `gap`, que decía que nadie sabe
    // establecer `catch`.
    expect(garantiza('catch>0', 'catch>0.0001')).toBe(false)
    expect(garantiza('catch>0', 'catch>=0')).toBe(true)
    // Contestarle a un pedido ESTRICTO con una promesa que no lo es necesita un
    // umbral estrictamente mejor.
    expect(garantiza('temperature>=400', 'temperature>400')).toBe(false)
    expect(garantiza('temperature>=401', 'temperature>400')).toBe(true)
    expect(garantiza('temperature>400', 'temperature>=400')).toBe(true)
  })

  it('dos magnitudes distintas no se implican, aunque una se derive de la otra', () => {
    // `catch` sale de `geom(freeStrandEnds)` multiplicada por un factor que
    // depende de `maxParts(sharpness)`, y despejarla pide una parte de la vista
    // que no existe. Que el catálogo las relacione no las vuelve comparables acá.
    expect(garantiza('freeStrandEnds>=1', 'catch>0')).toBe(false)
    expect(garantiza('catch>0', 'freeStrandEnds>=1')).toBe(false)
    expect(garantiza('reach>=4', 'longestAxis>=2')).toBe(false)
  })

  it('`sostiene` no tiene orden: sólo se implica a sí mismo', () => {
    const carnoso: Predicado = { k: 'sostiene', tag: 'carnoso' }
    const organico: Predicado = { k: 'sostiene', tag: 'organico' }
    expect(implica(carnoso, carnoso)).toBe(true)
    // `carnoso` y `organico` conviven en la misma sustancia —el pescado los tiene
    // los dos— y aun así no se implican: eso sería conocimiento sobre las
    // sustancias, no sobre los predicados, y viviría en el catálogo de tags.
    expect(implica(carnoso, organico)).toBe(false)
    expect(implica(organico, carnoso)).toBe(false)
    // Y no se cruza con las otras dos formas.
    const temp = interpretar('temperature>=400')
    if (temp === undefined) throw new Error('no se interpreta')
    expect(implica(carnoso, temp)).toBe(false)
    expect(implica(temp, carnoso)).toBe(false)
  })
})
