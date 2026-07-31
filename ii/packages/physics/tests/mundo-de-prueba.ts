// Un catálogo mínimo para probar cuerpos y procesos, escrito ACÁ y no importado
// de `quality.ts` a propósito: lo que se prueba es el evaluador, no los números
// de la semilla. Si mañana la semilla recalibra `reach`, estos tests siguen
// diciendo la verdad sobre `qualityOf`, que es lo suyo.
//
// ─── LA TRAMPA DE ESTE ARCHIVO, Y YA MORDIÓ UNA VEZ ─────────────────────────
//
// Los cuerpos de acá abajo SÓLO tienen sentido leídos contra `mundo()`. Dos de
// las cinco sustancias —`fibra` y `espina`— existen únicamente en este archivo:
// no están en `SUSTANCIAS_SEMILLA`. Y `qualityOf` no explota con una sustancia
// que el catálogo no conoce: **devuelve 0 para todo, en silencio**.
//
// O sea que importar `cuerpo`/`parte` de acá y medir contra `buildSeedPhysics()`
// da un cuerpo que parece bien armado y mide cero en todo lo que dependa de su
// materia. Medido: `CANA` da `catch` 0,15 contra `mundo()` y 0 contra la semilla.
// Y al revés también: una `CANA` de `liana` da 0,15 contra la semilla y 0 contra
// `mundo()`, porque acá no hay `liana`. No es que una sustancia sea mejor —
// **es que el cuerpo y el catálogo tienen que ser el mismo par**.
//
// Contra eso está `materiaFantasma`, más abajo. Un fixture nuevo que cruce mal
// los catálogos se caza con una línea.

import type { QualitySpec } from '../src/quality.js'
import type { Substance } from '../src/substance.js'
import { buildSeedPhysics, type Physics } from '../src/physics.js'
import type { Body, Part } from '../src/body.js'

const intensiva = (id: QualitySpec['id'], hi = 1): QualitySpec => ({
  id,
  range: [0, hi],
  extent: 'intensive',
  conserved: false,
})

const extensiva = (id: QualitySpec['id'], conserved: boolean, hi = 1000): QualitySpec => ({
  id,
  range: [0, hi],
  extent: 'extensive',
  conserved,
})

export const CUALIDADES: readonly QualitySpec[] = [
  extensiva('mass', true),
  extensiva('nutrition', true),
  extensiva('stamina', true, 100),
  extensiva('fuelEnergy', true),
  intensiva('temperature', 2000),
  intensiva('ignitionPoint', 2000),
  intensiva('moisture'),
  intensiva('charred'),
  intensiva('rigidity'),
  intensiva('toughness'),
  intensiva('flexibility'),
  intensiva('tensile'),
  intensiva('sharpness'),
  intensiva('digestibility'),
  intensiva('toxicity'),
  intensiva('decay'),
  // Las tres derivadas del documento, tal cual están escritas ahí.
  {
    id: 'reach',
    range: [0, 100],
    extent: 'intensive',
    conserved: false,
    derived: { k: 'geom', f: 'longestAxis' },
  },
  {
    id: 'catch',
    range: [0, 100],
    extent: 'intensive',
    conserved: false,
    derived: {
      k: 'op',
      f: '*',
      a: { k: 'geom', f: 'freeStrandEnds' },
      b: {
        k: 'op',
        f: '+',
        a: { k: 'const', v: 0.15 },
        b: { k: 'op', f: '*', a: { k: 'maxParts', q: 'sharpness' }, b: { k: 'const', v: 0.5 } },
      },
    },
  },
  {
    id: 'calories',
    // OJO — el documento escribe `calories = nutrition × mass × digestibility`,
    // y esa `nutrition` es la POR UNIDAD DE MASA (9 para el pescado). Leída
    // sobre el cuerpo, `nutrition` ya es extensiva —tiene que serlo, porque es
    // conservada y conservar es sobre el TOTAL— así que ya trae la masa adentro.
    // Multiplicar por `mass` otra vez da 0.504 donde el documento dice 1.26: la
    // masa entraría al cuadrado. La cuenta correcta sobre cualidades de cuerpo
    // es nutrition × digestibility, y da exactamente el 1.26 del documento.
    range: [0, 100000],
    extent: 'extensive',
    conserved: false,
    derived: {
      k: 'op',
      f: '*',
      a: { k: 'own', q: 'nutrition' },
      b: { k: 'own', q: 'digestibility' },
    },
  },
]

const semilla = (by: 'semilla') => ({ by })

export const SUSTANCIAS: readonly Substance[] = [
  {
    id: 'madera',
    lexeme: { nombre: 'madera', genero: 'f', sinonimos: ['leño', 'palo'] },
    tags: ['organico', 'vegetal', 'fibroso'],
    specificHeat: 1.7,
    perUnitMass: {
      fuelEnergy: 18,
      ignitionPoint: 300,
      moisture: 0.25,
      rigidity: 0.7,
      flexibility: 0.2,
      tensile: 0.4,
      nutrition: 0,
    },
    provenance: semilla('semilla'),
  },
  {
    id: 'fibra',
    lexeme: { nombre: 'fibra', genero: 'f', sinonimos: ['hilo', 'liana'] },
    tags: ['organico', 'vegetal', 'fibroso'],
    specificHeat: 1.4,
    perUnitMass: {
      fuelEnergy: 12,
      ignitionPoint: 250,
      moisture: 0.2,
      rigidity: 0.05,
      flexibility: 0.9,
      tensile: 0.5,
      nutrition: 0,
    },
    provenance: semilla('semilla'),
  },
  {
    id: 'espina',
    lexeme: { nombre: 'espina', genero: 'f', sinonimos: [] },
    tags: ['organico', 'mineral'],
    specificHeat: 0.9,
    perUnitMass: { rigidity: 0.8, flexibility: 0.05, sharpness: 0.8, nutrition: 0, ignitionPoint: 600 },
    provenance: semilla('semilla'),
  },
  {
    id: 'pescado',
    lexeme: { nombre: 'pescado', genero: 'm', sinonimos: ['pez'] },
    tags: ['organico', 'carnoso'],
    specificHeat: 3.5,
    perUnitMass: {
      nutrition: 9,
      digestibility: 0.35,
      toxicity: 0.3,
      moisture: 0.72,
      fuelEnergy: 2,
      ignitionPoint: 280,
      denaturesAt: 55,
      toughness: 0.18,
    },
    provenance: semilla('semilla'),
  },
  {
    id: 'carne',
    lexeme: { nombre: 'carne', genero: 'f', sinonimos: [] },
    tags: ['organico', 'carnoso'],
    specificHeat: 3.5,
    perUnitMass: {
      nutrition: 9,
      digestibility: 0.35,
      toxicity: 0.3,
      moisture: 0.72,
      fuelEnergy: 2,
      ignitionPoint: 280,
      denaturesAt: 63,
      toughness: 0.3,
    },
    provenance: semilla('semilla'),
  },
]

export function mundo(): Physics {
  return buildSeedPhysics({ qualities: CUALIDADES, substances: SUSTANCIAS })
}

export function parte(substance: string, mass: number, q: Part['q'] = {}): Part {
  return { substance, mass, q }
}

export function cuerpo(
  id: string,
  form: Body['form'],
  parts: readonly Part[],
  joints: readonly Body['joints'][number][] = [],
  state: Body['state'] = {},
): Body {
  return { id, form, parts, joints, state }
}

/**
 * Las sustancias que un cuerpo NOMBRA y esta física NO conoce — partes y juntas.
 *
 * Existe porque nombrar materia inexistente no falla: `qualityOf` da 0 y el
 * cuerpo sigue pareciendo legal. Un fixture así no mide lo que dice medir. Ver
 * el encabezado.
 */
export function materiaFantasma(b: Body, phys: Physics): readonly string[] {
  const nombradas = [...b.parts.map((p) => p.substance), ...b.joints.map((j) => j.via)]
  return [...new Set(nombradas.filter((s) => !phys.substances.has(s)))].sort()
}

/** Vara sola: alcanza, pero no engancha nada. */
export const VARA = cuerpo('vara-1', 'vara', [parte('madera', 0.5)])

/** Vara + hebra atada de un solo lado. Nadie escribió «caña». */
export const CANA = cuerpo(
  'cana-1',
  'vara',
  [parte('madera', 0.5), parte('fibra', 0.2)],
  [{ a: 0, b: 1, via: 'fibra', strength: 0.4 }],
)

/** La misma caña con una espina liviana colgando de la punta. */
export const CANA_CON_ANZUELO = cuerpo(
  'cana-2',
  'vara',
  [parte('madera', 0.5), parte('fibra', 0.2), parte('espina', 0.02)],
  [
    { a: 0, b: 1, via: 'fibra', strength: 0.4 },
    { a: 1, b: 2, via: 'fibra', strength: 0.3 },
  ],
)
