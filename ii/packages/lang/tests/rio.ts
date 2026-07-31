/**
 * EL RÍO — el arnés mínimo para poder pedirle un plan a una frase.
 *
 * Copiado de `plan/tests/la-cocina.test.ts` y NO importado, que es la regla del
 * repo: los `tests/` no se exportan, y un archivo de test que depende del de al
 * lado se rompe cuando el de al lado se reordena. **Lo que se copia es el arnés,
 * ni una regla del mundo** — los números de las cualidades son los mismos que
 * ese archivo usa, para que un plan que sale acá sea el mismo que sale allá.
 *
 * Es la escena canónica del Hito 5: un matorral del que sacar una hebra, una
 * vara para atarla, un pozo del que pescar, y una piedra. Con eso alcanza para
 * que `catch>0` y `holding(tag:carnoso)` den plan de verdad.
 */

import type { QualityId } from '@anima/physics'
import { evalQuality, specOf } from '@anima/physics'
import type { BodyId, BodyView, Cell, CellQuality, Clock, SelfView, Tag, Where } from '@anima/skills'
import type { VistaDelPlan } from '@anima/plan'

type Cualidades = Partial<Record<QualityId, number>>

export function cuerpo(id: string, x: number, y: number, tags: readonly Tag[] = []): BodyView {
  return { id, at: { x, y }, name: id, tags, madeByMe: false, joints: [] }
}

/** `portable` la contesta EL MOTOR con la expresión del catálogo, no el fixture. */
function portableDe(mass: number): number {
  const d = specOf('portable').derived
  if (d === undefined) throw new Error('`portable` dejó de ser derivada: el arnés se quedó viejo')
  const noHace = (): never => {
    throw new RangeError('`portable` sólo depende de `own(mass)`')
  }
  return evalQuality(d, {
    own: (q) => (q === 'mass' ? mass : 0),
    geom: noHace,
    sumParts: noHace,
    maxParts: noHace,
    substance: noHace,
  })
}

export function criatura(o?: { holding?: readonly BodyView[]; stamina?: number }): SelfView {
  return {
    id: 'yo',
    at: { x: 0, y: 0 },
    name: 'criatura',
    tags: [],
    madeByMe: false,
    joints: [],
    holding: o?.holding ?? [],
    capacity: 3,
    stamina: o?.stamina ?? 1000,
    permits: 'irreversible',
  }
}

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

export function vista(m: {
  self?: SelfView
  cuerpos?: readonly BodyView[]
  qs?: ReadonlyMap<BodyId, Cualidades>
  /**
   * Las celdas con agua. NO es opcional de adorno: el esquema de `extraccion`
   * lleva `cellHints: { source: [wet >= AGUA_FRANCA] }`, o sea que un pozo en
   * tierra seca NO es un pozo del que se pueda pescar. Sin esto,
   * «pesca algo» daba `gap` con «ningun esquema conocido establece mass>0»,
   * que es el planificador buscando otro camino porque el bueno estaba cerrado.
   */
  mojadas?: readonly Cell[]
}): VistaDelPlan {
  const self = m.self ?? criatura()
  const cuerpos = m.cuerpos ?? []
  const mojadas = m.mojadas ?? []
  const qde = (b: BodyView, q: QualityId): number => {
    if (b.id === self.id && q === 'stamina') return self.stamina
    const puesta = m.qs?.get(b.id)?.[q]
    if (puesta !== undefined) return puesta
    return q === 'portable' ? portableDe(qde(b, 'mass')) : 0
  }
  return {
    see(w: Where): readonly BodyView[] {
      const out: BodyView[] = []
      for (const b of cuerpos) {
        let ok = true
        for (const t of w) {
          const v = qde(b, t.q)
          const pasa =
            t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
          if (!pasa) ok = false
        }
        if (ok) out.push(b)
      }
      return out
    },
    recall: () => [],
    q: qde,
    qAt: (at: Cell, q: CellQuality): number =>
      q === 'wet' && mojadas.some((c) => c.x === at.x && c.y === at.y) ? 1 : 0,
    self,
    clock: RELOJ,
  }
}

/** El río sin fuego: matorral, vara, pozo y piedra. Los números son los de `la-cocina`. */
export function elRio(): VistaDelPlan {
  return vista({
    cuerpos: [
      cuerpo('matorral', 2, 0),
      cuerpo('vara', 5, 0),
      cuerpo('pozo', 8, 0),
      cuerpo('piedra', 1, 0),
    ],
    qs: new Map<BodyId, Cualidades>([
      ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
      // Los seis primeros son los de `la-cocina`. Los TRES ULTIMOS los agrego aca
      // y con motivo: sin `fuelEnergy`, `ignitionPoint` ni `moisture`, «hace fuego»
      // daba `gap` — y el gap tenia razon, porque una vara que no arde no arde. El
      // arnes de `la-cocina` no los necesitaba porque ese archivo le pone el fuego
      // a la escena; este pide que lo HAGA.
      ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1,
                 fuelEnergy: 20, ignitionPoint: 300, moisture: 0.1 }],
      ['pozo', { mass: 50 }],
      ['piedra', { mass: 0.5, rigidity: 0.9, heatCapacity: 0.8 }],
    ]),
    // El pozo esta EN el agua, que es lo que lo hace un pozo.
    mojadas: [{ x: 8, y: 0 }],
  })
}
