/**
 * ¿SE PUEDE ARMAR UN MUNDO DONDE PROBAR ESTO? — Hito 7, tramo C.
 *
 * Es la puerta que decide `injuzgable`, y por eso va antes que todo lo demás:
 * juzgar una habilidad es correrla, correrla pide un mundo, y un mundo que
 * cumpla sus precondiciones **puede no existir**.
 *
 * ─── La medición que le dio forma a este archivo ────────────────────────────
 *
 * Se volcaron los 17 contratos innatos antes de escribir una línea. Dos cosas
 * salieron de ahí y las dos están adentro del código:
 *
 * **1 · El vocabulario es chico.** Las precondiciones de las 17 usan **15
 * cualidades** y cuatro sujetos. No hace falta un resolutor general.
 *
 * **2 · Los sujetos no se sintetizan igual, y ésa es la partición que manda:**
 *
 * | sujeto | quién lo arma |
 * |---|---|
 * | `yo` | el ARNÉS, poniéndole aliento o cosas en la mano. No hay nada que buscar |
 * | `el-objetivo` | hay que ENCONTRAR materia que lo cumpla. Acá se puede fallar |
 * | `la-celda` | el arnés, decretando la celda |
 * | `lo-que-devuelve` | no es precondición de nadie: habla del resultado |
 *
 * O sea que **sintetizar es buscar materia**, y lo único que puede salir mal es
 * que no exista.
 *
 * ─── UNA CORRECCIÓN A LA PRIMERA MEDICIÓN, que estaba mal ───────────────────
 *
 * La primera pasada probó cada precondición **por separado** y dio «8 de 8 se
 * eligen». Está mal: `unir` pide `flexibility>=0.8` **y** `tensile>=0.3` sobre
 * **el mismo cuerpo**, y dos conjuntos no vacíos pueden tener intersección
 * vacía. Acá se hace la conjunción, que es lo que el contrato dice.
 *
 * ─── Y una hipótesis mía que la medición volteó ─────────────────────────────
 *
 * Se dio por sentado que `catch>0` iba a ser insintetizable —«sin punta libre no
 * hay `catch`», dice `process.ts`, o sea que habría que ATAR algo—. **Falso.**
 * `freeStrandEnds` le da dos puntas libres a toda parte flexible sin juntas: una
 * hebra suelta ya engancha. El comentario hablaba de la caña armada, no de una
 * hebra sola.
 *
 * Queda escrito porque es la clase de error que se repite: una frase correcta
 * sobre un caso, leída como si fuera sobre todos.
 */

import { qualityOf } from '@anima/physics'
import type { Body, Physics, QualityId } from '@anima/physics'
import type { Contrato, Predicado } from '@anima/skills/innatas'

/**
 * Las formas que se prueban al buscar materia.
 *
 * Importa cuáles, y no es decorativo: `reach` pasa por `SLENDERNESS[form]`, así
 * que la MISMA sustancia cumple o no cumple según la forma que tenga. Buscar sin
 * barrer formas declararía injuzgable algo que sólo estaba mal cortado.
 */
const FORMAS: readonly string[] = ['vara', 'hebra', 'filete', 'malla', 'bloque', 'grano']

/**
 * Y las masas, por lo mismo pero del otro lado: las cualidades EXTENSIVAS
 * (`calories`, `heatCapacity`, `mass`) escalan con ella, así que un umbral alto
 * se cumple con una pieza grande y ninguna sustancia es culpable de nada.
 *
 * Tres y no más: chica, de a kilo, y grande. Barrer fino acá multiplica el costo
 * de una puerta que corre por cada contrato y por cada mundo.
 */
const MASAS: readonly number[] = [0.05, 1, 20]

export function cumpleElPredicado(p: Predicado, v: number): boolean {
  switch (p.op) {
    case '>=':
      return v >= p.v
    case '<=':
      return v <= p.v
    case '>':
      return v > p.v
    case '<':
      return v < p.v
    default:
      return v === p.v
  }
}

/** Un cuerpo de una parte: la forma más simple que el mundo admite. */
function cuerpoDe(substance: string, form: string, mass: number): Body {
  return { id: 'sonda', parts: [{ substance, mass, q: {} }], joints: [], state: {}, form } as unknown as Body
}

/**
 * Las cualidades que este archivo NO puede decidir mirando materia suelta,
 * porque no son de la materia: son del actor, de la celda o de una relación que
 * el mundo guarda.
 *
 * `existe` es el caso raro y va acá por el motivo opuesto: lo cumple cualquier
 * cuerpo, así que buscar sería teatro.
 */
const NO_ES_DE_LA_MATERIA: ReadonlySet<string> = new Set(['holding', 'at', 'existe', 'permits'])

export interface MateriaHallada {
  readonly substance: string
  readonly form: string
  readonly mass: number
}

/**
 * Materia que cumple TODOS los predicados a la vez, o nada.
 *
 * Todos a la vez y no uno por uno: ver la corrección del encabezado.
 */
export function materiaPara(ps: readonly Predicado[], phys: Physics): MateriaHallada | undefined {
  const pedidos = ps.filter((p) => !NO_ES_DE_LA_MATERIA.has(p.q))
  if (pedidos.length === 0) return { substance: '—', form: '—', mass: 0 }

  for (const s of phys.substances.values()) {
    for (const form of FORMAS) {
      for (const mass of MASAS) {
        const b = cuerpoDe(s.id, form, mass)
        let todas = true
        for (const p of pedidos) {
          let v: number
          try {
            v = qualityOf(b, p.q as QualityId, phys)
          } catch {
            todas = false
            break
          }
          if (!cumpleElPredicado(p, v)) {
            todas = false
            break
          }
        }
        if (todas) return { substance: s.id, form, mass }
      }
    }
  }
  return undefined
}

export type Sintesis =
  | { readonly k: 'si'; readonly objetivo: MateriaHallada }
  | { readonly k: 'no'; readonly porque: string; readonly culpables: readonly string[] }

/**
 * ¿ES SINTETIZABLE ESTE CONTRATO?
 *
 * Y una decisión que vale su renglón: cuando la conjunción falla, se buscan los
 * culpables **probando cada predicado solo**. Cuesta una segunda pasada y compra
 * lo único que hace útil a un `injuzgable`: saber si el contrato pide algo que
 * no existe (`toxicity>=0.6`, y el catálogo llega a 0,55) o si pide dos cosas
 * que existen y no conviven. Un «no se pudo» sin eso manda a la fragua a
 * adivinar.
 */
export function sintetizable(c: Contrato, phys: Physics): Sintesis {
  const delObjetivo = c.precondiciones.filter((p) => p.sujeto === 'el-objetivo')
  const hallada = materiaPara(delObjetivo, phys)
  if (hallada !== undefined) return { k: 'si', objetivo: hallada }

  const culpables: string[] = []
  for (const p of delObjetivo) {
    if (materiaPara([p], phys) === undefined) culpables.push(`${p.q}${p.op}${String(p.v)}`)
  }
  return culpables.length > 0
    ? {
        k: 'no',
        porque: `ninguna materia del catálogo llega a ${culpables.join(' ni a ')}`,
        culpables,
      }
    : {
        k: 'no',
        porque: 'cada precondición se cumple por separado y ninguna materia las cumple JUNTAS',
        culpables: delObjetivo.map((p) => `${p.q}${p.op}${String(p.v)}`),
      }
}
