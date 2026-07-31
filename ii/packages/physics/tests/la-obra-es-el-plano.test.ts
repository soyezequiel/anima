// ─── ¿ESTA OBRA ES ESE PLANO? — puntos F1, F2 y F3 del tramo F ──────────────
//
// Hasta el tramo E, el plano se podía definir y una obra se podía armar, y
// **nadie comparaba las dos cosas**. Sin comparación, «construyó» quiere decir
// «no explotó»: una obra con las piezas correctas mal atadas pasaba, y una bien
// atada con junco donde iba madera también.
//
// Este archivo mide las tres afirmaciones de `realizaElPlano` una por una, y cada
// una con su contraejemplo — que es lo que hace que el verde signifique algo. Un
// juez que dice que sí a todo dice lo mismo que no tener juez.
//
// ─── LOS TRES FRACASOS, Y SON DISTINTOS ────────────────────────────────────
//
//   (1) la CUENTA     · la obra a medio armar tiene menos partes que piezas
//   (2) la TOPOLOGÍA  · la obra bien surtida y mal atada. Es el hallazgo del
//                       tramo C·bis: `unir` no obedece qué se ata con qué, así
//                       que el orden puede dar otra forma con las mismas piezas
//   (3) el `pide`     · la obra bien atada con la pieza equivocada adentro
//
// Y el cuarto, que no es un fracaso de la obra sino de quien la declara: decir
// que la parte 0 es un cuerpo que no es el que se puso.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, qualityOf } from '../src/index.js'
import { unir } from '../src/leyes.js'
import {
  definirPlano,
  realizaElPlano,
  sellarHabilidad,
  selloVigente,
  type AsignacionDeRol,
  type BlueprintCandidate,
  type BlueprintDefinition,
} from '../src/plano.js'
import { cuerpo, parte } from './mundo-de-prueba.js'
import type { Body, Physics } from '../src/index.js'

const PHYS: Physics = buildSeedPhysics()
/** La misma física con el número corrido. Es todo lo que hace falta para el punto 9. */
const OTRA_FISICA: Physics = { ...PHYS, version: PHYS.version + 1 }

// ─── El plano fijo del gate: un aparejo de tres piezas ──────────────────────
//
// Sin proveedor y sin fragua, como manda el §4 del criterio: «se demuestra con un
// candidato de plano fijo —el mismo archivo, sin proveedor— para que el criterio
// corra en CI y no dependa de que el modelo tenga un buen día».
//
// Y no se llama de ninguna manera. Tres roles, dos juntas, cero sustancias: el
// plano no tiene dónde escribir «junco».

const CANDIDATO: BlueprintCandidate = {
  parts: [
    { rol: 'brazo', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'cola', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
    { rol: 'punta', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
    { rol: 'atadura', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
  ],
  joints: [
    { a: 'brazo', b: 'cola', binder: 'atadura' },
    { a: 'cola', b: 'punta', binder: 'atadura' },
  ],
}

function definicion(phys: Physics = PHYS): BlueprintDefinition {
  const d = definirPlano(CANDIDATO, phys)
  if (d.k !== 'ok') throw new Error(`el candidato del gate no se define: ${JSON.stringify(d.verdict.razones)}`)
  return d.def
}

// ─── Los cuerpos con los que se llena ───────────────────────────────────────

const rigido = (id: string): Body => cuerpo(id, 'vara', [parte('madera', 0.5)])
const flexible = (id: string): Body => cuerpo(id, 'hebra', [parte('liana', 0.2)])

// ─── El armador: la regla medida en `el-orden-de-las-uniones-realiza-el-plano` ──
//
// Raíz, subárbol de cada hijo, atar el hijo al padre. Acá va escrito a mano y
// para un árbol concreto —brazo—cola—punta— porque lo que este archivo mide es el
// JUEZ y no el constructor. El constructor genérico es la innata `construir`.

interface Armada {
  readonly obra: Body
  readonly asignacion: readonly AsignacionDeRol[]
}

/** brazo—cola—punta, armado como el post-orden manda: (cola+punta) y después brazo. */
function armarBien(): Armada {
  const cola = flexible('cola')
  const punta = flexible('punta')
  const brazo = rigido('brazo')
  // `unir(cola, punta, atadura)`: ata la parte 0 de cola con la parte 0 de punta.
  const media = unir(cola, punta, flexible('at1'), PHYS, 'media')
  if (media === undefined) throw new Error('no se pudo atar cola con punta')
  // `unir(cola-armada, brazo, atadura)` ataría cola con brazo — que es la otra
  // junta. El orden importa: la cabeza del resultado es la del cuerpo izquierdo.
  const obra = unir(media, brazo, flexible('at2'), PHYS, 'obra')
  if (obra === undefined) throw new Error('no se pudo atar el brazo')
  // parts = [cola, punta, brazo]. Las juntas: {0,1} = cola—punta, {0,2} = cola—brazo.
  return {
    obra,
    asignacion: [
      { rol: 'cola', parte: 0, comoEntro: cola },
      { rol: 'punta', parte: 1, comoEntro: punta },
      { rol: 'brazo', parte: 2, comoEntro: brazo },
    ],
  }
}

// ─── (a) La obra que SÍ es el plano ─────────────────────────────────────────

describe('(a) una obra armada como el plano dice, lo realiza', () => {
  it('el veredicto es `ok` y no trae ni una razón', () => {
    const { obra, asignacion } = armarBien()
    const v = realizaElPlano(obra, definicion(), asignacion, PHYS)
    expect(v.razones).toEqual([])
    expect(v.ok).toBe(true)
  })

  it('y la obra que sale tiene las tres piezas y las dos juntas que el plano pide', () => {
    // El control de que el armado del archivo no es una casualidad de nombres.
    const { obra } = armarBien()
    expect(obra.parts.length).toBe(3)
    expect(obra.joints.length).toBe(2)
    expect(obra.joints.map((j) => `${String(j.a)}-${String(j.b)}`)).toEqual(['0-1', '0-2'])
  })
})

// ─── (1) La cuenta ──────────────────────────────────────────────────────────

describe('(1) la obra a medio armar NO realiza el plano', () => {
  it('dos piezas donde el plano pide tres: rechaza, y dice los dos números', () => {
    const cola = flexible('cola')
    const punta = flexible('punta')
    const media = unir(cola, punta, flexible('at1'), PHYS, 'media')
    expect(media).toBeDefined()
    if (media === undefined) return
    const v = realizaElPlano(
      media,
      definicion(),
      [
        { rol: 'cola', parte: 0, comoEntro: cola },
        { rol: 'punta', parte: 1, comoEntro: punta },
      ],
      PHYS,
    )
    expect(v.ok).toBe(false)
    // Dos razones: falta declarar dónde quedó el brazo, y la cuenta no cierra.
    expect(v.razones.map((r) => r.codigo)).toContain('obra-no-es-el-plano')
    expect(v.razones.some((r) => r.encontrado === 2 && r.cota === 3)).toBe(true)
  })
})

// ─── (2) La topología ───────────────────────────────────────────────────────

describe('(2) la obra bien surtida y MAL ATADA no realiza el plano', () => {
  it('la estrella con centro en el brazo tiene las tres piezas y no es este plano', () => {
    // ─── EL CASO QUE JUSTIFICA TODO EL ARCHIVO ────────────────────────────────
    //
    // Es exactamente el hallazgo del tramo C·bis: `unir` siempre ata `{a:0,
    // b:base}`, así que encadenar de a una sobre la misma obra da una ESTRELLA.
    // Las piezas son las mismas tres, cada una cumple su `pide`, la cuenta cierra
    // — y la obra es otra. Sin este chequeo, «construyó el plano» sería falso y
    // nadie se enteraría.
    const brazo = rigido('brazo')
    const cola = flexible('cola')
    const punta = flexible('punta')
    const a = unir(brazo, cola, flexible('at1'), PHYS, 'a')
    if (a === undefined) throw new Error('no ató')
    const estrella = unir(a, punta, flexible('at2'), PHYS, 'estrella')
    if (estrella === undefined) throw new Error('no ató')
    // parts = [brazo, cola, punta]; juntas {0,1} = brazo—cola y {0,2} = brazo—punta.
    expect(estrella.parts.length).toBe(3)

    const v = realizaElPlano(
      estrella,
      definicion(),
      [
        { rol: 'brazo', parte: 0, comoEntro: brazo },
        { rol: 'cola', parte: 1, comoEntro: cola },
        { rol: 'punta', parte: 2, comoEntro: punta },
      ],
      PHYS,
    )
    expect(v.ok).toBe(false)
    const mensajes = v.razones.map((r) => r.mensaje).join(' | ')
    expect(mensajes).toContain('cola punta')
    expect(mensajes).toContain('brazo punta')
  })
})

// ─── (3) El `pide` ──────────────────────────────────────────────────────────

describe('(3) la pieza que no cumple su rol se caza, aunque la obra esté bien atada', () => {
  it('una hebra donde el plano pide algo rígido: `pieza-no-cumple`, con el número medido', () => {
    // La obra sale idéntica en forma — tres piezas, dos juntas, la misma
    // topología— y no es el plano, porque el brazo mide `rigidity` 0,15 y el plano
    // pide 0,5. Es el fracaso que ni la cuenta ni la topología ven.
    const cola = flexible('cola')
    const punta = flexible('punta')
    const brazoBlando = flexible('brazo')
    const media = unir(cola, punta, flexible('at1'), PHYS, 'media')
    if (media === undefined) throw new Error('no ató')
    const obra = unir(media, brazoBlando, flexible('at2'), PHYS, 'obra')
    if (obra === undefined) throw new Error('no ató')

    const v = realizaElPlano(
      obra,
      definicion(),
      [
        { rol: 'cola', parte: 0, comoEntro: cola },
        { rol: 'punta', parte: 1, comoEntro: punta },
        { rol: 'brazo', parte: 2, comoEntro: brazoBlando },
      ],
      PHYS,
    )
    expect(v.ok).toBe(false)
    const r = v.razones.find((x) => x.codigo === 'pieza-no-cumple')
    expect(r).toBeDefined()
    expect(r?.rol).toBe('brazo')
    expect(r?.q).toBe('rigidity')
    expect(r?.cota).toBe(0.5)
    expect(r?.encontrado).toBeLessThan(0.5)
  })

  it('y el `pide` se mide contra el cuerpo COMO ENTRÓ, no contra la obra — medido', () => {
    // ─── LA DIFERENCIA ES SHARP, Y VA EN LA DIRECCIÓN PELIGROSA ───────────────
    //
    // Ver el encabezado de `realizaElPlano`: una parte de un ensamble ya no es un
    // cuerpo. `reach` pasa por `SLENDERNESS[form]` y por la cadena más larga, así
    // que la hebra suelta mide **1,20** y la obra entera **5,40**.
    //
    // O sea que un rol que pide `reach >= 3` NO se cumple con esa hebra, y un juez
    // que midiera sobre la obra diría que sí. El plano habla de la pieza que se
    // pone; medirlo sobre el ensamble contesta otra pregunta.
    const cola = flexible('cola')
    const { obra, asignacion } = armarBien()
    expect(qualityOf(cola, 'reach', PHYS)).toBeLessThan(3)
    expect(qualityOf(obra, 'reach', PHYS)).toBeGreaterThan(3)

    const conAlcance: BlueprintCandidate = {
      ...CANDIDATO,
      parts: CANDIDATO.parts.map((p) =>
        p.rol === 'cola' ? { rol: 'cola', pide: [{ q: 'reach', op: '>=', v: 3 } as const] } : p,
      ),
    }
    const d = definirPlano(conAlcance, PHYS)
    expect(d.k).toBe('ok')
    if (d.k !== 'ok') return
    const v = realizaElPlano(obra, d.def, asignacion, PHYS)
    expect(v.ok).toBe(false)
    const r = v.razones.find((x) => x.codigo === 'pieza-no-cumple')
    expect(r?.rol).toBe('cola')
    expect(r?.encontrado).toBeLessThan(3)
  })

  it('y el `pide` que SÍ cumple la pieza suelta pasa, aunque la obra no lo cumpla', () => {
    // La otra dirección, para que el bloque de arriba no se pueda satisfacer con
    // un juez que diga que no a todo: `catch` mide 0,30 en la hebra suelta y 0,15
    // en la obra, porque unir le ancla una punta. Un rol que pide `catch >= 0,3`
    // se cumple con la pieza y NO con el ensamble.
    const { obra, asignacion } = armarBien()
    expect(qualityOf(flexible('cola'), 'catch', PHYS)).toBeGreaterThanOrEqual(0.3)
    expect(qualityOf(obra, 'catch', PHYS)).toBeLessThan(0.3)

    const conEnganche: BlueprintCandidate = {
      ...CANDIDATO,
      parts: CANDIDATO.parts.map((p) =>
        p.rol === 'cola' ? { rol: 'cola', pide: [{ q: 'catch', op: '>=', v: 0.3 } as const] } : p,
      ),
    }
    const d = definirPlano(conEnganche, PHYS)
    if (d.k !== 'ok') throw new Error('no se definió')
    const v = realizaElPlano(obra, d.def, asignacion, PHYS)
    expect(v.ok, `razones: ${JSON.stringify(v.razones)}`).toBe(true)
  })
})

// ─── (4) La declaración mentirosa ───────────────────────────────────────────

describe('(4) no se puede declarar un cuerpo que no es el que se puso', () => {
  it('declarar una madera donde quedó una liana se rechaza', () => {
    // Sin este chequeo, la asignación sería una PROMESA: se declara cualquier
    // cuerpo que cumpla el `pide` y la obra está hecha de otra cosa. El veredicto
    // diría que sí, y no habría forma de notarlo mirando la obra.
    const { obra, asignacion } = armarBien()
    const mentida = asignacion.map((a) => (a.rol === 'cola' ? { ...a, comoEntro: rigido('no-es-esta') } : a))
    const v = realizaElPlano(obra, definicion(), mentida, PHYS)
    expect(v.ok).toBe(false)
    expect(v.razones.some((r) => r.mensaje.includes('no es el que quedo'))).toBe(true)
  })

  it('y tampoco asignar dos roles a la misma parte', () => {
    const { obra, asignacion } = armarBien()
    const chocada = asignacion.map((a) => (a.rol === 'punta' ? { ...a, parte: 0 } : a))
    const v = realizaElPlano(obra, definicion(), chocada, PHYS)
    expect(v.ok).toBe(false)
    expect(v.razones.some((r) => r.mensaje.includes('dos roles'))).toBe(true)
  })
})

// ─── (5) Los sellos: construir y usar, separados ────────────────────────────

describe('(5) construir y usar se sellan por separado', () => {
  it('dos sellos de la misma revisión y distinta clase son dos afirmaciones', () => {
    const def = definicion()
    const c = sellarHabilidad('construir', def, 'traza-de-la-obra', PHYS)
    const u = sellarHabilidad('usar', def, 'traza-del-uso', PHYS)
    expect(c.k).toBe('ok')
    expect(u.k).toBe('ok')
    if (c.k !== 'ok' || u.k !== 'ok') return
    expect(c.sello.revision).toBe(u.sello.revision)
    expect(c.sello.clase).not.toBe(u.sello.clase)
    // Y cada uno lleva su propia corrida: no se comparten.
    expect(c.sello.traza).not.toBe(u.sello.traza)
  })

  it('un sello SIN corrida detrás no se emite: sería una promesa autodeclarada', () => {
    // Es la misma regla que `admit()` le aplica a un proceso con
    // `confianza-autodeclarada`, y se usa el mismo código a propósito.
    const s = sellarHabilidad('construir', definicion(), '', PHYS)
    expect(s.k).toBe('rechazado')
    if (s.k !== 'rechazado') return
    expect(s.verdict.razones.map((r) => r.codigo)).toContain('confianza-autodeclarada')
  })
})

// ─── (6) La otra mitad del punto 9: la física se mueve ──────────────────────

describe('(6) un cambio de física invalida los sellos, y por DOS caminos', () => {
  it('camino 1 — `selloVigente` rechaza contra otra versión, con `version-de-fisica`', () => {
    const s = sellarHabilidad('construir', definicion(), 'traza', PHYS)
    if (s.k !== 'ok') throw new Error('no selló')
    expect(selloVigente(s.sello, PHYS).ok).toBe(true)
    const v = selloVigente(s.sello, OTRA_FISICA)
    expect(v.ok).toBe(false)
    // El MISMO código que `admit()` usa para un proceso sellado contra otra
    // física. Un código nuevo sería una segunda verdad sobre lo mismo.
    expect(v.razones.map((r) => r.codigo)).toEqual(['version-de-fisica'])
  })

  it('camino 2 — el plano se define con OTRA revisión, así que el sello viejo apunta a nada', () => {
    // Ésta es la que no depende de que nadie se acuerde de llamar a `selloVigente`:
    // la versión está adentro del hash de la revisión, así que el mismo candidato
    // contra otra física ES otro plano.
    expect(definicion(OTRA_FISICA).revision).not.toBe(definicion(PHYS).revision)
  })

  it('y no se puede sellar contra una física que no es la del plano', () => {
    const s = sellarHabilidad('usar', definicion(PHYS), 'traza', OTRA_FISICA)
    expect(s.k).toBe('rechazado')
    if (s.k !== 'rechazado') return
    expect(s.verdict.razones.map((r) => r.codigo)).toContain('version-de-fisica')
  })

  it('y `realizaElPlano` también lo mira: una obra correcta contra otra física no vale', () => {
    // El plano se puede definir mucho antes de que la obra se arme. Si en el medio
    // la física se movió, «algo con rigidity >= 0,5» promete otra cosa.
    const { obra, asignacion } = armarBien()
    const v = realizaElPlano(obra, definicion(PHYS), asignacion, OTRA_FISICA)
    expect(v.ok).toBe(false)
    expect(v.razones.map((r) => r.codigo)).toEqual(['version-de-fisica'])
  })
})
