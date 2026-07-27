// ═══ LAS PRUEBAS DE PROPIEDAD DEL HITO 1 ═════════════════════════════════════
//
// El criterio verificable del hito dice tres cosas, y las tres están acá:
//
//   1. cien mil transformaciones aleatorias, y NINGUNA cualidad conservada
//      aumenta jamás;
//   2. ninguna sustancia sale del rango que declaró su propia cualidad;
//   3. el determinismo de `fixed.ts`: las mismas entradas dan los mismos bits.
//
// ─── Por qué el generador es propio y no `fast-check` ───────────────────────
//
// `fast-check` existe en el árbol de Ánima I (es devDependency de
// `packages/sim-core`), pero no se resuelve desde `ii/packages/physics` y la
// regla 1 de `ii/README.md` es que de acá no se importa nada de `packages/`.
// Agregarlo como dependencia propia era una opción; el generador con semilla
// FIJA es mejor para lo que hace falta acá, y vale la pena decir por qué:
//
//   - una corrida que falla en la máquina de otro se reproduce con el número de
//     caso y nada más, sin contraejemplo serializado ni `--seed`;
//   - las cien mil transformaciones son SIEMPRE las mismas cien mil, así que
//     este test no puede ponerse verde o rojo solo entre dos corridas — que es
//     exactamente el riesgo que un paquete determinista no puede correr;
//   - `xorshift32` es +, − y desplazamientos: nada de `Math.random`, que está
//     prohibido por la regla 2 de la carpeta.
//
// Lo que se pierde es el shrinking, y se compensa: cuando algo falla, el reporte
// trae el caso entero con el cuerpo y el entorno impresos.
//
// ─── Por qué el sweep también CUENTA lo que ejercitó ────────────────────────
//
// Una prueba de propiedad que nunca dispara nada pasa igual, y no prueba nada.
// Por eso hay un test de cobertura al lado: si el barrido dejara de transmutar,
// de cocinar o de arder, el silencio se convierte en rojo.

import { describe, expect, it } from 'vitest'
import type { Body, FormId, Joint, Part } from '../src/body.js'
import { qualityOf } from '../src/body.js'
import { admitSubstance, tieneCodigo } from '../src/admit.js'
import { fabs, fdiv, fexp, fln, fmul, fpow, fx, unfx, FIXED_MAX, FIXED_MIN } from '../src/fixed.js'
import type { Fixed } from '../src/fixed.js'
import {
  conSustancia,
  correr,
  paso,
  totalConservado,
  unir,
  type Celda,
  type Entorno,
  type LeyId,
  type Montaje,
} from '../src/leyes.js'
import { buildSeedPhysics, type Physics } from '../src/physics.js'
import { CONSERVED, QUALITIES, QUALITY_IDS, specOf } from '../src/quality.js'
import type { QualityId, QualityVector } from '../src/quality.js'
import type { Substance, Tag } from '../src/substance.js'
import { SUSTANCIAS_SEMILLA } from '../src/data/sustancias.js'

// ─── El generador ────────────────────────────────────────────────────────────

/**
 * xorshift32. Entero, determinista y sin estado global: dos corridas del mismo
 * archivo recorren exactamente la misma secuencia, en esta máquina y en la del
 * que revise el hito dentro de un año.
 */
function azar(semilla: number): () => number {
  let s = semilla >>> 0
  if (s === 0) s = 0x9e3779b9
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

const entre = (r: () => number, lo: number, hi: number): number => lo + r() * (hi - lo)
const unoDe = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length]!

// ─── El pool de materia ──────────────────────────────────────────────────────
//
// Las treinta semilla MÁS cuatro que nadie escribió. Están para que el barrido
// no pruebe solamente el mundo que ya conocemos: si una ley se apoyara en algo
// que solo las semilla tienen, estas cuatro lo harían saltar.

const INVENTADAS: readonly Substance[] = [
  {
    id: 'inventada-blanda',
    lexeme: { nombre: 'materia blanda', genero: 'f', sinonimos: [] },
    tags: ['organico', 'carnoso'],
    perUnitMass: {
      nutrition: 12.5,
      digestibility: 0.27,
      toxicity: 0.42,
      moisture: 0.31,
      fuelEnergy: 7.5,
      denaturesAt: 58.5,
      pyrolysisAt: 265,
      ignitionPoint: 265,
      toughness: 0.42,
      decay: 0.07,
      rigidity: 0.12,
      flexibility: 0.86,
      tensile: 0.38,
      cohesion: 0.47,
      permeability: 0.28,
      charred: 0,
    },
    specificHeat: 3.15,
    provenance: { by: 'oraculo' },
  },
  {
    id: 'inventada-lenosa',
    lexeme: { nombre: 'materia leñosa', genero: 'f', sinonimos: [] },
    tags: ['organico', 'vegetal', 'fibroso'],
    perUnitMass: {
      nutrition: 0,
      fuelEnergy: 19.5,
      ignitionPoint: 285,
      pyrolysisAt: 268,
      moisture: 0.22,
      rigidity: 0.66,
      flexibility: 0.28,
      toughness: 0.63,
      tensile: 0.52,
      cohesion: 0.61,
      digestibility: 0.03,
      toxicity: 0.07,
      decay: 0.015,
      permeability: 0.14,
      charred: 0,
    },
    specificHeat: 1.75,
    provenance: { by: 'oraculo' },
  },
  {
    id: 'inventada-dura',
    lexeme: { nombre: 'materia dura', genero: 'f', sinonimos: [] },
    tags: ['mineral'],
    perUnitMass: {
      nutrition: 0,
      fuelEnergy: 0,
      moisture: 0.03,
      ignitionPoint: 880,
      pyrolysisAt: 880,
      rigidity: 0.93,
      flexibility: 0.02,
      tensile: 0.13,
      cohesion: 0.87,
      toughness: 0.66,
      sharpness: 0.44,
      digestibility: 0,
      toxicity: 0,
      decay: 0,
      permeability: 0.03,
      charred: 0,
    },
    specificHeat: 0.82,
    provenance: { by: 'oraculo' },
  },
  {
    id: 'inventada-fibrosa',
    lexeme: { nombre: 'materia fibrosa', genero: 'f', sinonimos: [] },
    tags: ['organico', 'fibroso'],
    perUnitMass: {
      nutrition: 1.5,
      digestibility: 0.09,
      toxicity: 0.11,
      moisture: 0.37,
      fuelEnergy: 6.5,
      denaturesAt: 61.5,
      pyrolysisAt: 243,
      ignitionPoint: 243,
      toughness: 0.87,
      rigidity: 0.14,
      flexibility: 0.88,
      tensile: 0.83,
      cohesion: 0.66,
      decay: 0.025,
      permeability: 0.09,
      charred: 0,
    },
    specificHeat: 2.65,
    provenance: { by: 'oraculo' },
  },
]

const POOL: readonly Substance[] = [...SUSTANCIAS_SEMILLA, ...INVENTADAS]

const PHYS: Physics = buildSeedPhysics({ substances: POOL })

const FORMAS: readonly FormId[] = ['vara', 'hebra', 'filete', 'malla', 'bloque', 'grano']
const MONTAJES_TODOS: readonly Montaje[] = ['piso', 'parrilla', 'contacto']

/** Cualidades que un cuerpo puede traer puestas de fábrica. Nunca las derivadas. */
const ESTADO_SEMBRABLE: readonly QualityId[] = [
  'temperature',
  'moisture',
  'charred',
  'decay',
  'toxicity',
  'digestibility',
  'stamina',
]

function cuerpoAzaroso(r: () => number, i: number): Body {
  const n = 1 + Math.floor(r() * 3)
  const parts: Part[] = []
  for (let k = 0; k < n; k++) {
    const s = unoDe(r, POOL)
    parts.push({ substance: s.id, mass: entre(r, 0.01, 20), q: {} })
  }
  const joints: Joint[] = []
  if (n >= 2) {
    const cuantas = Math.floor(r() * n)
    for (let k = 0; k < cuantas; k++) {
      const a = Math.floor(r() * n) % n
      const b = (a + 1 + Math.floor(r() * (n - 1))) % n
      joints.push({ a, b, via: unoDe(r, POOL).id, strength: r() })
    }
  }
  const state: QualityVector = {}
  for (const q of ESTADO_SEMBRABLE) {
    if (r() < 0.55) continue
    const [lo, hi] = specOf(q).range
    state[q] = entre(r, lo, hi)
  }
  // De vez en cuando, una masa escrita a nivel cuerpo: el caso que hace que la
  // masa exista en dos lugares y que uno pueda quedar viejo.
  if (r() < 0.08) state.mass = entre(r, 0.01, 30)
  return { id: `azar-${i}`, form: unoDe(r, FORMAS), parts, joints, state }
}

function entornoAzaroso(r: () => number): Entorno {
  const celda: Celda = { oxygen: r(), wet: r(), ambiente: entre(r, -20, 45) }
  if (r() < 0.35) return { celda }
  return {
    celda,
    fuente: {
      potencia: entre(r, 0, 2000),
      distancia: Math.floor(r() * 5),
      montaje: unoDe(r, MONTAJES_TODOS),
    },
  }
}

// ─── El barrido ──────────────────────────────────────────────────────────────

const CASOS = 100000

interface Reporte {
  casos: number
  /** Una línea por violación. Vacío o el hito no está cumplido. */
  conservacion: string[]
  rango: string[]
  noFinito: string[]
  /** Cuántas veces corrió cada ley. Una propiedad que nunca dispara no prueba nada. */
  cobertura: Map<LeyId, number>
  /** Cuántos casos tocaron cada cuenta conservada con un total estrictamente positivo. */
  conMateria: Map<QualityId, number>
}

function barrer(casos: number, semilla: number): Reporte {
  const r = azar(semilla)
  const rep: Reporte = {
    casos,
    conservacion: [],
    rango: [],
    noFinito: [],
    cobertura: new Map<LeyId, number>(),
    conMateria: new Map<QualityId, number>(),
  }
  for (const q of CONSERVED) rep.conMateria.set(q, 0)

  for (let i = 0; i < casos; i++) {
    const antes = cuerpoAzaroso(r, i)
    const entorno = entornoAzaroso(r)
    const paso1 = paso(antes, entorno, PHYS)
    // Si la ley 4 transmutó, la sustancia nueva TIENE que entrar a la física
    // antes de medir: leer el cuerpo nuevo contra el catálogo viejo daría cero
    // en todo y la conservación pasaría por la peor de las razones.
    const despuesPhys = paso1.nueva === undefined ? PHYS : conSustancia(PHYS, paso1.nueva)

    for (const ley of paso1.leyes) rep.cobertura.set(ley, (rep.cobertura.get(ley) ?? 0) + 1)

    for (const q of CONSERVED) {
      const t0 = totalConservado(antes, q, PHYS)
      const t1 = totalConservado(paso1.body, q, despuesPhys)
      if (t0 > 0) rep.conMateria.set(q, (rep.conMateria.get(q) ?? 0) + 1)
      if (!Number.isFinite(t1)) {
        rep.noFinito.push(`caso ${i}: ${q} quedó en ${String(t1)}`)
        continue
      }
      if (t1 > t0) {
        rep.conservacion.push(
          `caso ${i}: ${q} pasó de ${t0} a ${t1} (+${t1 - t0}) — ${describir(antes, entorno)}`,
        )
      }
    }

    // Rango: se mira el valor GUARDADO, no el leído. `qualityOf` recorta al
    // leer, así que preguntarle a él sería preguntarle al que arregla si hay
    // algo roto. Lo que tiene que estar sano es el estado.
    for (const [q, v] of Object.entries(paso1.body.state)) {
      if (v === undefined) continue
      const sp = specOf(q as QualityId)
      if (!Number.isFinite(v)) {
        rep.noFinito.push(`caso ${i}: state.${q} = ${String(v)}`)
        continue
      }
      if (v < sp.range[0] || v > sp.range[1]) {
        rep.rango.push(`caso ${i}: state.${q} = ${v} fuera de [${sp.range[0]}, ${sp.range[1]}]`)
      }
    }
    for (const p of paso1.body.parts) {
      if (!Number.isFinite(p.mass) || p.mass < 0) {
        rep.noFinito.push(`caso ${i}: una parte quedó con masa ${String(p.mass)}`)
      }
    }
    // Y las derivadas, que no se guardan pero sí se leen: un `NaN` acá envenena
    // todas las comparaciones río abajo y aparece cuarenta ticks después.
    if (i % 7 === 0) {
      for (const q of QUALITY_IDS) {
        const v = qualityOf(paso1.body, q, despuesPhys)
        if (!Number.isFinite(v)) rep.noFinito.push(`caso ${i}: ${q} leída como ${String(v)}`)
        const sp = specOf(q)
        if (v < sp.range[0] || v > sp.range[1]) {
          rep.rango.push(`caso ${i}: ${q} leída ${v} fuera de [${sp.range[0]}, ${sp.range[1]}]`)
        }
      }
    }
  }
  return rep
}

function describir(b: Body, e: Entorno): string {
  const partes = b.parts.map((p) => `${p.substance}×${p.mass.toFixed(3)}`).join(' + ')
  const fuente =
    e.fuente === undefined
      ? 'sin fuente'
      : `${e.fuente.potencia.toFixed(0)}W ${e.fuente.montaje} d${e.fuente.distancia}`
  return `${b.form}[${partes}] estado=${JSON.stringify(b.state)} ${fuente} O₂=${e.celda.oxygen.toFixed(2)}`
}

// El barrido corre UNA vez y los tests leen el reporte. Cien mil ticks tres
// veces para contestar tres preguntas sería tirar dos tercios del tiempo.
const REPORTE = barrer(CASOS, 0x5eed1)

// El título se escribe a mano y no con `toLocaleString`: el formato de número
// depende del locale, y `leyes.test.ts` prohíbe justamente eso en el paquete.
describe('las cien mil transformaciones', () => {
  it('ninguna cualidad conservada aumenta jamás', () => {
    // LA propiedad del hito. Las cuatro cuentas conservadas se miden como
    // TOTAL: `mass` y `stamina` son extensivas y valen lo que dicen, pero
    // `nutrition` y `fuelEnergy` son POR UNIDAD DE MASA y lo que se conserva es
    // el producto `q · mass`. Comparar el intensivo dejaría pasar la bomba de
    // materia que `quality.ts` describe con esas palabras: partir un cuerpo en
    // dos y quedarse con el doble de comida.
    expect(REPORTE.conservacion.slice(0, 5)).toEqual([])
    expect(REPORTE.conservacion).toHaveLength(0)
  })

  it('ninguna cualidad sale del rango que declaró', () => {
    expect(REPORTE.rango.slice(0, 5)).toEqual([])
    expect(REPORTE.rango).toHaveLength(0)
  })

  it('ningún número deja de ser un número', () => {
    // Un `NaN` o un `Infinity` sueltos no rompen nada en el tick en que nacen:
    // rompen cuarenta ticks después, lejos de la causa, y ahí ya no hay quien
    // los rastree.
    expect(REPORTE.noFinito.slice(0, 5)).toEqual([])
    expect(REPORTE.noFinito).toHaveLength(0)
  })

  it('el barrido ejercitó de verdad las seis leyes', () => {
    // Sin esto, las tres propiedades de arriba se cumplirían perfecto sobre cien
    // mil ticks en los que no pasó nada. La cota es baja a propósito: lo que
    // importa es que ninguna rama quede en cero, no cuánto pesa cada una.
    const leyes: readonly LeyId[] = [
      'termica',
      'humedad',
      'combustion',
      'desnaturalizacion',
      'descomposicion',
      'transmutacion',
    ]
    for (const ley of leyes) {
      expect(REPORTE.cobertura.get(ley) ?? 0, `la ley ${ley} nunca corrió`).toBeGreaterThan(50)
    }
  })

  it('el barrido tocó materia de verdad en las cuatro cuentas conservadas', () => {
    // Conservar cero es fácil. Cada cuenta tiene que haber tenido algo que
    // perder en una fracción decente de los casos.
    for (const q of CONSERVED) {
      expect(REPORTE.conMateria.get(q) ?? 0, `${q} nunca fue positiva`).toBeGreaterThan(CASOS / 100)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LA MISMA PROPIEDAD, PERO SOBRE CORRIDAS LARGAS
//
// Un tick conserva; mil ticks seguidos también tienen que conservar, y no es lo
// mismo: es donde se acumulan los redondeos, donde la ley 5 evapora mil veces y
// donde el intensivo `nutrition` se reescala mil veces contra una masa que baja.

describe('mil ticks seguidos tampoco crean nada', () => {
  it('cien corridas de mil ticks, ninguna cuenta sube', () => {
    const r = azar(0xc0ffee)
    const fallas: string[] = []
    for (let i = 0; i < 100; i++) {
      const b0 = cuerpoAzaroso(r, i)
      const e = entornoAzaroso(r)
      const antes = new Map<QualityId, number>()
      for (const q of CONSERVED) antes.set(q, totalConservado(b0, q, PHYS))
      const fin = correr(b0, e, PHYS, 1000)
      for (const q of CONSERVED) {
        const t1 = totalConservado(fin.body, q, fin.phys)
        const t0 = antes.get(q) ?? 0
        if (t1 > t0) fallas.push(`corrida ${i}: ${q} ${t0} → ${t1} — ${describir(b0, e)}`)
      }
    }
    expect(fallas).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ATAR TAMPOCO CREA NADA
//
// La ley 7 no es un tick: junta dos cuerpos en uno. Es el otro lugar donde la
// materia podría aparecer, y el que más barato sale de romper — basta con
// contar dos veces al atador.

describe('atar no crea materia', () => {
  it('el ensamble pesa y alimenta exactamente lo que pesaban y alimentaban las partes', () => {
    const r = azar(0xa7a2)
    const fallas: string[] = []
    for (let i = 0; i < 10000; i++) {
      const a = cuerpoAzaroso(r, i)
      const binder = cuerpoAzaroso(r, i + 500000)
      const conB = r() < 0.5
      const b = conB ? cuerpoAzaroso(r, i + 900000) : undefined
      const ens = unir(a, b, binder, PHYS, `ens-${i}`)
      if (ens === undefined) continue
      const otro = b ?? binder
      for (const q of CONSERVED) {
        const suma = totalConservado(a, q, PHYS) + totalConservado(otro, q, PHYS)
        const total = totalConservado(ens, q, PHYS)
        // Tolerancia relativa mínima: sumar dos doubles y volver a sumarlos en
        // otro orden puede diferir en el último bit, y eso no es materia nueva.
        if (total > suma + Math.abs(suma) * 1e-12 + 1e-12) {
          fallas.push(`unión ${i}: ${q} ${suma} → ${total}`)
        }
      }
    }
    expect(fallas).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PROPIEDAD 2 · NINGUNA SUSTANCIA SALE DE SU RANGO DECLARADO
//
// Dos mitades. La de arriba (el barrido) prueba que el MOTOR no saca a nadie de
// rango; ésta prueba que la PUERTA no deja entrar a nadie que ya venga fuera.
// Sin la segunda, el motor cuidaría un invariante que la puerta regala.

describe('ninguna sustancia entra fuera de su rango declarado', () => {
  it('las treinta y cuatro del pool están todas adentro', () => {
    for (const s of POOL) {
      for (const [k, v] of Object.entries(s.perUnitMass)) {
        const sp = specOf(k as QualityId)
        expect(Number.isFinite(v), `${s.id}.${k}`).toBe(true)
        expect(v, `${s.id}.${k} = ${String(v)} < ${sp.range[0]}`).toBeGreaterThanOrEqual(sp.range[0])
        expect(v, `${s.id}.${k} = ${String(v)} > ${sp.range[1]}`).toBeLessThanOrEqual(sp.range[1])
      }
    }
  })

  it('cien mil sustancias al azar: la puerta dice «fuera-de-rango» exactamente cuando lo está', () => {
    const r = azar(0x5ab5)
    const TAGS_POSIBLES: readonly Tag[] = [
      'organico',
      'vegetal',
      'mineral',
      'fibroso',
      'carnoso',
      'carbonoso',
      'liquido',
    ]
    // Solo las que se GUARDAN: `admitSubstance` rechaza las derivadas con otro
    // código (`cualidad-derivada`) y a `mass`/`temperature` con otro más
    // (`cualidad-de-estado`), así que meterlas acá mediría otra cosa.
    const GUARDABLES = QUALITIES.filter(
      (q) => q.derived === undefined && q.id !== 'mass' && q.id !== 'temperature',
    )
    let fuera = 0
    let dentro = 0
    const fallas: string[] = []
    for (let i = 0; i < 100000; i++) {
      const perUnitMass: QualityVector = {}
      const cuantas = 1 + Math.floor(r() * 4)
      for (let k = 0; k < cuantas; k++) {
        const sp = unoDe(r, GUARDABLES)
        const [lo, hi] = sp.range
        const ancho = hi - lo
        // Un tercio de las veces, a propósito afuera. Sin eso el test mediría
        // solamente que la puerta no molesta.
        perUnitMass[sp.id] = r() < 0.33 ? entre(r, hi + 0.001, hi + 1 + ancho) : entre(r, lo, hi)
      }
      // El veredicto se lee del vector FINAL y no de una bandera que se prende
      // al generar: la misma cualidad puede salir sorteada dos veces y la
      // segunda escritura pisa a la primera. Con la bandera, el test se acusaba
      // a sí mismo de un fallo de la puerta que era suyo.
      let seSale = false
      for (const [k, v] of Object.entries(perUnitMass)) {
        const [lo, hi] = specOf(k as QualityId).range
        if (v < lo || v > hi) seSale = true
      }
      const s: Substance = {
        id: `azarosa-${i}`,
        lexeme: { nombre: `azarosa ${i}`, genero: 'm', sinonimos: [] },
        tags: [unoDe(r, TAGS_POSIBLES)],
        perUnitMass,
        specificHeat: entre(r, 0.1, 5),
        provenance: { by: 'modelo' },
      }
      const v = admitSubstance(s, PHYS)
      const dijo = tieneCodigo(v, 'fuera-de-rango')
      if (seSale) {
        fuera += 1
        if (!dijo && fallas.length < 5) fallas.push(`sustancia ${i}: se sale y la puerta no lo dijo`)
        if (v.ok && fallas.length < 5) fallas.push(`sustancia ${i}: se sale y ENTRÓ`)
      } else {
        dentro += 1
        if (dijo && fallas.length < 5) fallas.push(`sustancia ${i}: está adentro y la puerta la acusó`)
      }
    }
    expect(fallas).toEqual([])
    // Que el generador haya producido las dos clases, o el test de arriba mide
    // una sola rama y pasa por la mitad equivocada.
    expect(fuera).toBeGreaterThan(10000)
    expect(dentro).toBeGreaterThan(10000)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PROPIEDAD 3 · EL DETERMINISMO DE `fixed.ts`
//
// «Las mismas entradas dan los mismos bits.» El adverbio importa: no alcanza con
// que den el mismo número aproximado, ni con que den lo mismo dentro de una
// corrida. Tienen que dar el MISMO ENTERO, siempre, en cualquier orden, en
// cualquier máquina. Eso es lo que hace que un replay de diez mil ticks termine
// igual en Chrome y en Firefox, y es la razón entera por la que `fixed.ts`
// existe en vez de `Math`.

/** FNV-1a de 32 bits sobre los enteros del resultado. Entero puro: sin doubles, sin locale. */
function huella(valores: readonly number[]): number {
  let h = 0x811c9dc5
  for (const v of valores) {
    let x = v | 0
    for (let b = 0; b < 4; b++) {
      h = (h ^ (x & 0xff)) >>> 0
      h = Math.imul(h, 0x01000193) >>> 0
      x >>= 8
    }
  }
  return h >>> 0
}

/**
 * El barrido de referencia: seis funciones sobre 4000 pares deterministas. No
 * usa el generador de arriba a propósito — un LCG entero de dos líneas es más
 * fácil de replicar en otro lenguaje si algún día hay que comparar contra un
 * motor que no sea éste.
 */
function barridoDeFixed(): number[] {
  const out: number[] = []
  let s = 12345
  const sig = (): number => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return s
  }
  for (let i = 0; i < 4000; i++) {
    const a = (sig() % 4294968) - 2147484
    const b = (sig() % 4294968) - 2147484
    out.push(fmul(a, b))
    out.push(fdiv(a, b))
    out.push(fexp(a % 15000))
    out.push(fln(fabs(a)))
    out.push(fpow(b % 4000, 2000))
    out.push(fpow(fabs(b % 4000) + 1, 1500))
    out.push(fx(unfx(a)))
  }
  return out
}

describe('`fixed.ts` es determinista bit a bit', () => {
  it('la misma entrada da el mismo entero, siempre', () => {
    const uno = barridoDeFixed()
    const dos = barridoDeFixed()
    expect(dos).toHaveLength(uno.length)
    for (let i = 0; i < uno.length; i++) {
      // `Object.is` y no `===`: `-0 === 0` es verdadero y acá lo que se compara
      // son BITS, no valores. Un cero con signo que aparece a veces y a veces no
      // es exactamente la clase de diferencia que este test tiene que ver.
      expect(Object.is(uno[i], dos[i]), `posición ${i}: ${String(uno[i])} vs ${String(dos[i])}`).toBe(
        true,
      )
    }
  })

  it('todo resultado es un entero: nunca queda fracción viva en un `Fixed`', () => {
    // El invariante de la representación. Si alguna operación dejara una
    // fracción, el `Fixed` dejaría de ser un entero escalado y el redondeo
    // pasaría a depender de la historia del valor.
    for (const v of barridoDeFixed()) expect(Number.isInteger(v)).toBe(true)
  })

  it('la huella del barrido no se movió', () => {
    // ÉSTE es el test que cruza máquinas. Los otros dos comprueban que el módulo
    // es puro dentro de una corrida; este número es el que tiene que dar igual
    // en la máquina del que revise el hito, en el navegador y dentro de un año.
    // Si cambia, o alguien tocó una constante de `fixed.ts` —y entonces se movió
    // la calibración del barrido térmico— o el motor de JavaScript dejó de
    // cumplir IEEE-754 en `+ − × ÷`, que sería una noticia mucho más grande.
    expect(huella(barridoDeFixed())).toBe(3391390248)
  })

  it('el orden de evaluación no cambia ni un bit', () => {
    // Pureza: sin acumuladores, sin caché, sin estado. Calcular al derecho y al
    // revés tiene que dar exactamente lo mismo para cada entrada.
    const entradas: Fixed[] = []
    for (let i = -2000; i <= 2000; i += 7) entradas.push(i * 1013)
    const alDerecho = entradas.map((x) => [fexp(x % 14000), fln(fabs(x)), fpow(x % 3000, 2000)])
    const alReves: number[][] = []
    for (let i = entradas.length - 1; i >= 0; i--) {
      const x = entradas[i]!
      alReves[i] = [fexp(x % 14000), fln(fabs(x)), fpow(x % 3000, 2000)]
    }
    for (let i = 0; i < entradas.length; i++) {
      for (let k = 0; k < 3; k++) {
        expect(Object.is(alDerecho[i]![k], alReves[i]![k]), `entrada ${entradas[i]!}`).toBe(true)
      }
    }
  })

  it('satura en los bordes en vez de dar la vuelta', () => {
    // Determinismo también es esto: en el borde, todas las máquinas tienen que
    // equivocarse igual. `FIXED_MAX` es una respuesta; el desbordamiento de un
    // i32 es una respuesta distinta en cada motor.
    expect(fmul(FIXED_MAX, FIXED_MAX)).toBe(FIXED_MAX)
    expect(fmul(FIXED_MIN, FIXED_MAX)).toBe(FIXED_MIN)
    expect(fexp(FIXED_MAX)).toBe(FIXED_MAX)
    expect(fexp(FIXED_MIN)).toBe(0)
    expect(fln(0)).toBe(FIXED_MIN)
    expect(fdiv(1, 0)).toBe(FIXED_MAX)
  })

  it('un cero con signo se puede escapar de `fdiv`, y queda anotado acá', () => {
    // NO es un fallo de determinismo: `fdiv(0, −5)` devuelve `−0` SIEMPRE, en
    // todas las máquinas, así que el replay no diverge. Pero `−0` no es `0` para
    // `Object.is` ni para un hash de bits, y hay exactamente un lugar del mundo
    // donde importa de verdad: `1/−0` es `−Infinity`.
    //
    // Queda clavado en vez de arreglado porque arreglarlo (normalizar el cero en
    // `clampFixed`) rompería la simetría de signo que `fixed.test.ts` testea —
    // `fdiv(0,−b)` daría `0` y `−fdiv(0,b)` daría `−0`— y esa simetría es un
    // invariante más caro que éste. Si alguna vez el mundo divide por un `Fixed`
    // que puede ser cero, hay que volver acá.
    expect(Object.is(fdiv(0, -5), -0)).toBe(true)
    expect(fdiv(0, -5) === 0).toBe(true)
  })
})
