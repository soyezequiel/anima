// ─── @anima/physics/body.ts ──────────────────────────────────────────────────
//
// Un cuerpo NO tiene `kind`. Tiene forma, partes y juntas — y todo lo demás se
// calcula. Ésa es la diferencia entera con la tabla de recetas: si «caña» fuera
// un tipo, alguien tendría que escribir la fila «caña»; como es un cuerpo con
// dos partes y una junta, la caña la descubre quien ata una hebra a una vara.
//
// Determinismo: acá no hay `Math.exp`, `Math.pow`, `Math.log`, `**`, `Math.random`
// ni `Date`. Solo +, −, ×, ÷ y comparaciones, que ECMAScript sí especifica bit a
// bit (IEEE-754). El recorrido de partes y juntas es por índice creciente, nunca
// por orden de iteración de un objeto.

import type { Physics } from './physics.js'
import type { QualityExpr, QualityId, QualitySpec, QualityVector } from './quality.js'
import type { Substance, SubstanceId } from './substance.js'

// ─── Cotas duras ─────────────────────────────────────────────────────────────
//
// Están decididas acá y no son «mitigación de riesgo»: son lo que hace que el
// cálculo exacto de la geometría del ensamble (camino más largo del grafo de
// juntas, que en general es NP-difícil) sea trivialmente barato y no una
// heurística que cambie de resultado entre versiones.

export const MAX_PARTS = 6
export const MAX_JOINTS = 8

/**
 * Tres, y no dos.
 *
 * Con dos no hay parrilla-sobre-trípode: el trípode ya gasta una junta (vara
 * atada a vara), la parrilla otra (travesaño atado al trípode) y el ensamble
 * completo necesita una tercera para cerrar. Con la cota en 2 esa obra
 * simplemente no existe, y —peor— la auditoría marcó que la violación **no
 * producía error**: el ensamble se construía igual y la cota era decorativa.
 * Por eso además de subirla hay `violationsOf` / `assertWithinCaps`.
 */
export const MAX_ASSEMBLY_DEPTH = 3

export type FormId = 'vara' | 'hebra' | 'filete' | 'malla' | 'bloque' | 'grano'

export interface Part {
  substance: SubstanceId
  mass: number
  q: QualityVector
}

/**
 * `via` es una SUSTANCIA, no una parte: cuando se ata `a` con `b`, el atador se
 * gasta en la atadura y deja de ser un cuerpo aparte. Cuando se ata `a` **sin**
 * `b`, en cambio, el atador sobrevive como parte y le queda una punta suelta —
 * que es exactamente de dónde sale el `catch` de la caña.
 */
export interface Joint {
  a: number
  b: number
  via: SubstanceId
  strength: number
}

export interface Body {
  id: string
  form: FormId
  parts: readonly Part[]
  joints: readonly Joint[]
  state: QualityVector
  madeBy?: string
}

// ─── Verificación de las cotas ───────────────────────────────────────────────

export type CapViolation =
  | { k: 'parts'; found: number; max: number }
  | { k: 'joints'; found: number; max: number }
  | { k: 'depth'; found: number; max: number }
  | { k: 'joint-out-of-range'; joint: number }
  | { k: 'joint-self'; joint: number }

/**
 * Todo lo que este cuerpo tiene de ilegal, en orden fijo. Devuelve una lista y
 * no un booleano porque quien la llama —la puerta del mundo— tiene que poder
 * decir QUÉ está mal, no solo que algo lo está.
 */
export function violationsOf(b: Body): readonly CapViolation[] {
  const malas: CapViolation[] = []
  if (b.parts.length > MAX_PARTS) malas.push({ k: 'parts', found: b.parts.length, max: MAX_PARTS })
  if (b.joints.length > MAX_JOINTS) malas.push({ k: 'joints', found: b.joints.length, max: MAX_JOINTS })
  for (let i = 0; i < b.joints.length; i++) {
    const j = b.joints[i]!
    if (!inRange(j, b.parts.length)) malas.push({ k: 'joint-out-of-range', joint: i })
    else if (j.a === j.b) malas.push({ k: 'joint-self', joint: i })
  }
  const d = assemblyDepthOf(b)
  if (d > MAX_ASSEMBLY_DEPTH) malas.push({ k: 'depth', found: d, max: MAX_ASSEMBLY_DEPTH })
  return malas
}

/** La misma verificación, pero que se hace notar. Tira si el cuerpo no es legal. */
export function assertWithinCaps(b: Body): void {
  const malas = violationsOf(b)
  if (malas.length === 0) return
  const detalle = malas.map(describeViolation).join('; ')
  throw new Error(`cuerpo ${b.id} fuera de cotas: ${detalle}`)
}

function describeViolation(v: CapViolation): string {
  switch (v.k) {
    case 'parts':
      return `${v.found} partes > ${v.max}`
    case 'joints':
      return `${v.found} juntas > ${v.max}`
    case 'depth':
      return `profundidad de ensamble ${v.found} > ${v.max}`
    case 'joint-out-of-range':
      return `la junta ${v.joint} apunta a una parte que no existe`
    case 'joint-self':
      return `la junta ${v.joint} ata una parte consigo misma`
  }
}

/**
 * Profundidad del ensamble: cuántas juntas tiene la cadena más larga de partes.
 *
 * Una vara suelta es 0. La caña (vara + hebra) es 1. El trípode es 2. La
 * parrilla apoyada y atada sobre el trípode es 3 — de ahí sale la cota.
 */
export function assemblyDepthOf(b: Body): number {
  if (b.parts.length === 0) return 0
  return longestChain(b, () => 1) - 1
}

// ─── Cualidades ──────────────────────────────────────────────────────────────

/**
 * El valor de `q` en este cuerpo, ahora.
 *
 * Tres fuentes, en este orden y por esta razón:
 *   1. si la cualidad es DERIVADA, no se guarda: se calcula. Que esté primero
 *      impide que una ley escriba a mano un `reach` que la geometría contradice.
 *   2. si el cuerpo tiene el valor en `state`, manda: eso es lo que las leyes
 *      escribieron este tick (la ley 5 escribe `mass` a nivel cuerpo cuando
 *      evapora agua, y esa masa es más nueva que la de las partes).
 *   3. si no, se agrega desde las partes, extensiva o intensivamente.
 */
export function qualityOf(b: Body, q: QualityId, phys: Physics): number {
  // La spec se busca UNA vez y se pasa hacia abajo. Antes se buscaba dos —una
  // para evaluar y otra para recortar— y esta función se llama cientos de miles
  // de veces por tick: la segunda búsqueda era el 10% del tick entero.
  const spec = specFor(phys, q)
  // Las dos fuentes de una cualidad GUARDADA, escritas acá y no delegadas a
  // `evalQuality`. No es duplicación por gusto: `evalQuality` es recursiva —una
  // derivada puede pedir otra— y una función recursiva no se puede incrustar, así
  // que el camino de las veintiuna cualidades que se guardan pagaba una llamada
  // que nunca necesitó. La rama derivada sigue siendo la de abajo, una sola.
  if (spec === undefined || spec.derived === undefined) {
    const stored = b.state[q]
    return clampToRange(
      stored !== undefined ? stored : aggregateFromParts(b, q, phys, spec),
      spec,
    )
  }
  return clampToRange(evalQuality(b, q, phys, spec, undefined), spec)
}

/**
 * `inFlight` entra en `undefined` y se crea SOLO si aparece una derivada.
 *
 * Es la misma detección de ciclos de antes —una derivada que se pide a sí misma
 * sigue tirando—, pero sin pagarla cuando no hay ninguna derivada en juego. Las
 * trece cualidades que leen las leyes se guardan todas, así que el `Set` se
 * construía cientos de miles de veces por tick para no usarse nunca.
 */
function evalQuality(
  b: Body,
  q: QualityId,
  phys: Physics,
  spec: QualitySpec | undefined,
  inFlight: Set<QualityId> | undefined,
): number {
  const derived = spec?.derived
  if (derived !== undefined) {
    // Una derivada que se pide a sí misma es un catálogo mal escrito, y colgarse
    // es la peor forma de enterarse: en el mundo eso es un tick que no termina.
    const enVuelo = inFlight ?? new Set<QualityId>()
    if (enVuelo.has(q)) throw new Error(`cualidad derivada circular: ${q}`)
    enVuelo.add(q)
    const v = evalExpr(b, derived, phys, enVuelo)
    enVuelo.delete(q)
    return v
  }
  const stored = b.state[q]
  if (stored !== undefined) return stored
  return aggregateFromParts(b, q, phys, spec)
}

function aggregateFromParts(
  b: Body,
  q: QualityId,
  phys: Physics,
  spec: QualitySpec | undefined,
): number {
  if (b.parts.length === 0) return 0
  const extensive = spec?.extent === 'extensive'
  if (extensive) {
    let total = 0
    for (let i = 0; i < b.parts.length; i++) total += partQuality(b.parts[i]!, q, phys, true)
    return total
  }
  // Intensiva de una sola parte: el valor, sin dividir. No es una optimización:
  // `q·m/m` NO es `q` en punto flotante —0.35 de una parte de masa 0.4 vuelve
  // como 0.3499999999999999— y ese milésimo de milésimo se propaga a toda
  // comparación con un umbral. Con una parte no hay promedio que calcular.
  if (b.parts.length === 1) return partQuality(b.parts[0]!, q, phys, false)
  // Intensiva: promedio pesado por masa. La temperatura de un cuerpo de dos
  // partes no es la suma de las dos temperaturas, y la parte pesada pesa más.
  let num = 0
  let den = 0
  for (let i = 0; i < b.parts.length; i++) {
    const p = b.parts[i]!
    const m = massOf(p)
    num += partQuality(p, q, phys, false) * m
    den += m
  }
  if (den > 0) return num / den
  // Sin masa no hay con qué pesar: promedio plano, que es el límite razonable.
  let plano = 0
  for (let i = 0; i < b.parts.length; i++) plano += partQuality(b.parts[i]!, q, phys, false)
  return plano / b.parts.length
}

// La MISMA sustancia, muchas veces seguidas.
//
// Una lectura de cuerpo pregunta ocho o diez cualidades de las mismas partes, y
// cada una volvía a buscar la sustancia en el mapa con la misma clave. Recordar
// la última la reduce a comparar dos punteros. Memoización pura: la misma
// `Physics` y el mismo id dan la misma sustancia, y cualquier otra combinación
// entra por el mapa y reemplaza lo recordado.
let ultimaSustPhys: Physics | undefined
let ultimaSustId: SubstanceId | undefined
let ultimaSust: Substance | undefined

function sustanciaDe(phys: Physics, id: SubstanceId): Substance | undefined {
  if (phys === ultimaSustPhys && id === ultimaSustId) return ultimaSust
  const s = phys.substances.get(id)
  ultimaSustPhys = phys
  ultimaSustId = id
  ultimaSust = s
  return s
}

function partQuality(p: Part, q: QualityId, phys: Physics, extensive: boolean): number {
  if (q === 'mass') return massOf(p)
  const own = p.q[q]
  if (own !== undefined) return own
  const s: Substance | undefined = sustanciaDe(phys, p.substance)
  const base = s?.perUnitMass[q]
  if (base === undefined) return 0
  // `perUnitMass` es por unidad de masa para las extensivas (nutrición,
  // fuelEnergy) y es el valor liso para las intensivas (rigidez, humedad):
  // «por unidad de masa» de una intensiva es la intensiva.
  return extensive ? base * massOf(p) : base
}

function massOf(p: Part): number {
  return p.q.mass ?? p.mass
}

/**
 * El combustible por unidad de masa que este cuerpo tenía CUANDO ESTABA ENTERO.
 *
 * No pasa por `qualityOf`, y ésa es la única razón por la que existe:
 * `qualityOf` contesta lo que HAY —`state.fuelEnergy`, que la ley 3 baja tick a
 * tick— y hay dos lugares que necesitan lo que HABÍA, que es lo que la materia
 * declaró al nacer. La resta entre los dos números es lo que ya se quemó:
 *
 *   · la ley 3 la usa para que `charred` mida una FRACCIÓN y no un rato — ver
 *     `avanceDeCarbon` en `leyes.ts`;
 *   · `nameOf` la usa para no llamar igual a un tizón entero y a uno gastado.
 *
 * Vive acá y no en `leyes.ts` justamente porque son dos: dos copias de la misma
 * lectura divergen el día que alguien toque una, y entonces el motor y el nombre
 * dirían cosas distintas de la misma cosa.
 *
 * Se le pregunta a la MATERIA y no a una tabla: el `fuelEnergy` que la parte
 * trajo escrito, y si no el de su sustancia. Un hongo que el oráculo invente
 * mañana contesta igual, sin fila propia. Va ponderado por masa por el mismo
 * motivo que `substanceFieldOf`: `fuelEnergy` es POR UNIDAD DE MASA, así que en
 * un cuerpo de dos materias el promedio lo decide cuánto hay de cada una.
 *
 * Cero cuando no hay masa: sin materia no hay volátiles que se puedan ir, y quien
 * llama tiene que mirar ese caso antes de dividir.
 */
export function combustibleDeOrigen(b: Body, phys: Physics): number {
  let total = 0
  let masa = 0
  for (const p of b.parts) {
    const m = massOf(p)
    const s = sustanciaDe(phys, p.substance)
    total += m * (p.q.fuelEnergy ?? s?.perUnitMass.fuelEnergy ?? 0)
    masa += m
  }
  return masa > 0 ? total / masa : 0
}

/**
 * Un campo de la SUSTANCIA, agregado como cualquier intensiva: pesado por masa
 * (ADR II-0006).
 *
 * Que sea el promedio pesado y no la suma es lo que hace que
 * `mass × specificHeat` dé exactamente `Σ (masa · calor específico)` sobre un
 * ensamble: la masa total multiplica al promedio y los denominadores se cancelan.
 * Con la suma pelada, una parrilla de tres varas tendría el triple de capacidad
 * térmica de la que tiene.
 *
 * El default de 1 para una sustancia que el mundo no conoce es el mismo que
 * tenía la ley 1 antes de esta migración: un cuerpo sin materia conocida se
 * comporta como si su calor específico fuera el de referencia. Devolver 0 sería
 * peor —capacidad térmica cero es una división por cero en la ley 1— y lanzar
 * mataría el tick por una parte huérfana.
 */
function substanceFieldOf(b: Body, f: 'specificHeat', phys: Physics): number {
  if (b.parts.length === 0) return 0
  // Una sola parte: el valor, sin dividir. Misma razón que en
  // `aggregateFromParts`: `q·m/m` no es `q` en punto flotante.
  if (b.parts.length === 1) return fieldOfPart(b.parts[0]!, f, phys)
  let num = 0
  let den = 0
  for (let i = 0; i < b.parts.length; i++) {
    const p = b.parts[i]!
    const m = massOf(p)
    num += fieldOfPart(p, f, phys) * m
    den += m
  }
  if (den > 0) return num / den
  let plano = 0
  for (let i = 0; i < b.parts.length; i++) plano += fieldOfPart(b.parts[i]!, f, phys)
  return plano / b.parts.length
}

function fieldOfPart(p: Part, f: 'specificHeat', phys: Physics): number {
  const s: Substance | undefined = sustanciaDe(phys, p.substance)
  const v = s?.[f]
  return v === undefined || !Number.isFinite(v) ? 1 : v
}

// Por índice y no por desestructuración: `const [lo, hi] = spec.range` levanta el
// protocolo de iteración del array, y esto corre una vez por cada lectura de
// cualidad. Los dos números son los mismos.
function clampToRange(v: number, spec: QualitySpec | undefined): number {
  if (!spec) return v
  const lo = spec.range[0]
  if (v < lo) return lo
  const hi = spec.range[1]
  if (v > hi) return hi
  return v
}

// ─── Evaluación de QualityExpr ───────────────────────────────────────────────

function evalExpr(b: Body, e: QualityExpr, phys: Physics, inFlight: Set<QualityId>): number {
  switch (e.k) {
    case 'const':
      return e.v
    case 'own':
      return evalQuality(b, e.q, phys, specFor(phys, e.q), inFlight)
    case 'sumParts': {
      const extensive = specFor(phys, e.q)?.extent === 'extensive'
      let total = 0
      for (let i = 0; i < b.parts.length; i++) total += partQuality(b.parts[i]!, e.q, phys, extensive)
      return total
    }
    case 'maxParts': {
      if (b.parts.length === 0) return 0
      const extensive = specFor(phys, e.q)?.extent === 'extensive'
      let mejor = partQuality(b.parts[0]!, e.q, phys, extensive)
      for (let i = 1; i < b.parts.length; i++) {
        const v = partQuality(b.parts[i]!, e.q, phys, extensive)
        if (v > mejor) mejor = v
      }
      return mejor
    }
    case 'substance':
      return substanceFieldOf(b, e.f, phys)
    case 'geom':
      return geomOf(b, e.f, phys)
    case 'op': {
      const a = evalExpr(b, e.a, phys, inFlight)
      const c = evalExpr(b, e.b, phys, inFlight)
      switch (e.f) {
        case '+':
          return a + c
        case '-':
          return a - c
        case '*':
          return a * c
        case '/':
          // Dividir por cero da 0 y no ±Infinity a propósito: un NaN o un
          // Infinity metido en una cualidad envenena todas las comparaciones
          // río abajo y aparece cuarenta ticks después, lejos de la causa.
          return c === 0 ? 0 : a / c
        case 'min':
          return a < c ? a : c
        case 'max':
          return a > c ? a : c
        case 'step':
          return a >= c ? 1 : 0
      }
    }
  }
}

// ─── Geometría del ensamble ──────────────────────────────────────────────────

/**
 * Cuánto «largo» aporta una unidad de masa según la forma. Es una enumeración
 * CERRADA de formas, igual que la exposición de montaje de la ley 1 —no una
 * fila por objeto—: una vara es larga y flaca, un bloque es corto y gordo, y de
 * ahí sale que la vara tenga alcance y el bloque no.
 */
const SLENDERNESS: Record<FormId, number> = {
  vara: 4,
  hebra: 6,
  filete: 1,
  malla: 1,
  bloque: 0.6,
  grano: 0.3,
}

/** Por encima de esto una parte es una hebra: cuelga, no sostiene. */
const STRAND_FLEXIBILITY = 0.8

function geomOf(b: Body, f: 'longestAxis' | 'freeStrandEnds' | 'jointCount', phys: Physics): number {
  switch (f) {
    case 'jointCount':
      return b.joints.length
    case 'longestAxis': {
      const largo = SLENDERNESS[b.form]
      return longestChain(b, (i) => largo * massOf(b.parts[i]!))
    }
    case 'freeStrandEnds': {
      // Cada hebra tiene dos puntas. Una punta deja de estar libre cuando algo
      // la ANCLA, y anclar es cuestión de masa: lo que pesa igual o más que la
      // hebra la sujeta, lo que pesa menos le cuelga.
      //
      // Esa única regla —sin nombrar ningún objeto— da las tres respuestas que
      // hacen falta: la hebra atada de un solo lado a la vara deja una punta
      // libre (la caña); la misma hebra con una espina liviana en esa punta
      // sigue teniendo la punta libre, y encima le sube el `sharpness` (el
      // anzuelo); y una hebra tirante entre dos varas no tiene ninguna punta
      // libre, porque una cuerda tensa no engancha nada.
      let sueltas = 0
      for (let i = 0; i < b.parts.length; i++) {
        const p = b.parts[i]!
        if (partQuality(p, 'flexibility', phys, false) < STRAND_FLEXIBILITY) continue
        let libres = 2
        for (let k = 0; k < b.joints.length; k++) {
          const j = b.joints[k]!
          if (!inRange(j, b.parts.length) || j.a === j.b) continue
          if (j.a !== i && j.b !== i) continue
          const otro = b.parts[j.a === i ? j.b : j.a]!
          if (massOf(otro) >= massOf(p)) libres -= 1
        }
        if (libres > 0) sueltas += libres
      }
      return sueltas
    }
  }
}

function inRange(j: Joint, n: number): boolean {
  return Number.isInteger(j.a) && Number.isInteger(j.b) && j.a >= 0 && j.a < n && j.b >= 0 && j.b < n
}

/**
 * Peso máximo de un camino simple sobre el grafo de juntas.
 *
 * En general esto es NP-difícil; acá no importa, y ésa es la razón de que
 * MAX_PARTS sea 6: 6 nodos y 8 aristas se recorren enteros en microsegundos y
 * el resultado es EXACTO, así que no cambia si mañana alguien mejora la
 * heurística. Una heurística acá haría divergir el replay.
 */
function longestChain(b: Body, weight: (i: number) => number): number {
  const n = b.parts.length
  if (n === 0) return 0
  const incident: number[][] = []
  for (let i = 0; i < n; i++) incident.push([])
  for (let i = 0; i < b.joints.length; i++) {
    const j = b.joints[i]!
    if (!inRange(j, n) || j.a === j.b) continue
    incident[j.a]!.push(i)
    incident[j.b]!.push(i)
  }
  const seen = new Array<boolean>(n).fill(false)
  let best = 0
  const walk = (node: number, acc: number): void => {
    if (acc > best) best = acc
    for (const idx of incident[node]!) {
      const j = b.joints[idx]!
      const other = j.a === node ? j.b : j.a
      if (seen[other]) continue
      seen[other] = true
      walk(other, acc + weight(other))
      seen[other] = false
    }
  }
  for (let i = 0; i < n; i++) {
    seen.fill(false)
    seen[i] = true
    walk(i, weight(i))
  }
  return best
}

// ─── Nombrar es una vista ────────────────────────────────────────────────────

/**
 * 'pescado crudo' y 'pescado asado' son el MISMO cuerpo con distinta cocción.
 * Nombrar es una vista, no un tipo: no hay `kind: 'pescado-asado'` en ningún
 * lado, y por eso el mundo no tiene que autorizar la transición ni el oráculo
 * tiene que inventar la fila.
 *
 * El nombre no se guarda nunca. Si se guardara, quedaría viejo al tick
 * siguiente, que es el mismo error que el ADR II-0002 evitó con `sheltered`.
 */
export function nameOf(b: Body, phys: Physics): string {
  if (b.parts.length === 0) return b.id
  const core = dominantPart(b)
  const s = phys.substances.get(core.substance)
  const noun = s?.lexeme.nombre ?? core.substance
  const gender = s?.lexeme.genero ?? 'm'
  const partner = otherSubstanceName(b, core.substance, phys)
  const head = partner === undefined ? noun : `${noun} con ${partner}`
  const adjs = adjectivesOf(b, phys, gender)
  return adjs.length === 0 ? head : `${head} ${adjs.join(' ')}`
}

/**
 * LA PARTE QUE MANDA: la de más masa, y con empate gana el índice más chico.
 *
 * Se exporta desde el Hito 12 y por un motivo que conviene dejar escrito: **el
 * color de un cuerpo tiene que salir de la misma parte que su nombre**. Con
 * `parts[0]` —que es lo que uno escribe sin pensarlo— una caña de 0,9 kg de
 * madera atada con 0,05 de liana se llamaría «madera con liana» y saldría color
 * liana, porque la hebra suele agregarse primera.
 */
export function dominantPart(b: Body): Part {
  let best = b.parts[0]!
  let bestMass = massOf(best)
  for (let i = 1; i < b.parts.length; i++) {
    const p = b.parts[i]!
    const m = massOf(p)
    // Estrictamente mayor: con empate gana el índice más chico, que es estable
    // y no depende del orden en que el mundo agregó las partes.
    if (m > bestMass) {
      best = p
      bestMass = m
    }
  }
  return best
}

function otherSubstanceName(b: Body, core: SubstanceId, phys: Physics): string | undefined {
  let best: Part | undefined
  for (let i = 0; i < b.parts.length; i++) {
    const p = b.parts[i]!
    if (p.substance === core) continue
    if (best === undefined || massOf(p) > massOf(best)) best = p
  }
  if (best === undefined) return undefined
  return phys.substances.get(best.substance)?.lexeme.nombre ?? best.substance
}

// ─── EL ESTADO VISIBLE: una banda, y DOS lectores ───────────────────────────
//
// Existe por una regla que el Hito 12 destapó: **el dibujo y el nombre no se
// pueden contradecir**. Si la pantalla decide «esto se ve ardiendo» con un
// umbral suyo y `nameOf` decide «esto se llama chamuscado» con otro, el jugador
// lee dos cosas distintas de la misma cosa y ninguna de las dos está mal.
//
// La reparación no es sincronizar dos tablas de umbrales: es que haya UNA y dos
// lectores, que es el mismo movimiento que el catálogo del gate 5→6 (una sola
// lista append-only, dos lectores). Acá el productor es `estadoVisibleDe` y los
// lectores son `adjectivesOf` —que la traduce a castellano con género— y el
// `RenderDescriptor` del Hito 12 —que la publica para que el dibujo la pinte—.
//
// ─── POR QUÉ ES UNA BANDA Y NO EL NÚMERO ────────────────────────────────────
//
// Porque el descriptor entra a `renderDescriptorHash`, y una cualidad continua
// haría que el hash cambiara **en cada tick en que el fuego sube un grado**. Con
// eso, comparar dos corridas por el hash del dibujo dejaría de significar «se
// dibuja igual» y pasaría a significar «está exactamente a la misma temperatura»,
// que es otra cosa y ya la mide `worldHash`. La banda cambia cuando cambia lo
// que se VE, que es exactamente lo que la tercera capa del E2E tiene que vigilar.
//
// El orden de la cascada es el que ya tenía `adjectivesOf` y no se toca: arder
// gana sobre estar quemado, quemado sobre chamuscado, y la cocción sólo se
// pregunta en lo que alimenta.

/**
 * LO QUE SE VE DE UN CUERPO, en una palabra. `sin-marca` es «nada que decir» y
 * es el caso normal: una piedra no está ni cruda ni mojada ni ardiendo.
 *
 * Se llama así y no `entero` a propósito: `entero` se lee como un adjetivo y
 * alguien lo iba a mandar al nombre. Éste no se puede confundir con uno.
 */
export type BandaDeEstado =
  | 'ardiendo'
  | 'consumido'
  | 'quemado'
  | 'chamuscado'
  | 'asado'
  | 'a-medio-cocinar'
  | 'crudo'
  | 'mojado'
  | 'sin-marca'

/**
 * `podrido` va aparte de la banda porque es ORTOGONAL: un pescado puede estar
 * asado y podrido a la vez, y la cascada de arriba elige una sola cosa.
 */
export interface EstadoVisible {
  readonly banda: BandaDeEstado
  readonly podrido: boolean
}

/** La única lectura de umbrales de estado que hay en el proyecto. */
export function estadoVisibleDe(b: Body, phys: Physics): EstadoVisible {
  const temperature = qualityOf(b, 'temperature', phys)
  const ignition = qualityOf(b, 'ignitionPoint', phys)
  const charred = qualityOf(b, 'charred', phys)
  const nutrition = qualityOf(b, 'nutrition', phys)
  const podrido = qualityOf(b, 'decay', phys) >= 0.5

  let banda: BandaDeEstado = 'sin-marca'
  if (ignition > 0 && temperature >= ignition) banda = 'ardiendo'
  else if (charred >= 0.8) banda = seConsumio(b, phys) ? 'consumido' : 'quemado'
  else if (charred >= 0.25) banda = 'chamuscado'
  else if (nutrition > 0) {
    // Solo lo que alimenta se dice crudo o asado. La madera no está cruda, y no
    // hace falta ningún tag ni ninguna lista de comestibles para saberlo: le
    // basta con tener `nutrition` en cero, que es una cualidad conservada y
    // ninguna ley la puede subir.
    const dig = qualityOf(b, 'digestibility', phys)
    banda = dig >= 0.85 ? 'asado' : dig <= 0.45 ? 'crudo' : 'a-medio-cocinar'
  } else if (qualityOf(b, 'moisture', phys) >= 0.6) banda = 'mojado'

  return { banda, podrido }
}

/**
 * Como mucho dos adjetivos: uno de fuego-o-cocción y uno de estado. Un nombre
 * de seis adjetivos no lo lee nadie, y el nombre existe para que la criatura y
 * el cuidador hablen de la misma cosa.
 *
 * Los umbrales ya no están acá: los tiene `estadoVisibleDe`. Esto es la mitad
 * que traduce, y es la única que sabe de género.
 */
function adjectivesOf(b: Body, phys: Physics, gender: 'm' | 'f'): string[] {
  const { banda, podrido } = estadoVisibleDe(b, phys)
  const out: string[] = []
  // `ardiendo` es un gerundio y no concuerda: `agree` lo dejaría en «ardienda».
  // `a-medio-cocinar` lleva el guión porque es una banda y no una frase; el
  // nombre la quiere con espacios.
  if (banda === 'ardiendo') out.push('ardiendo')
  else if (banda === 'a-medio-cocinar') out.push('a medio cocinar')
  else if (banda !== 'sin-marca') out.push(agree(banda, gender))

  if (podrido) out.push(agree('podrido', gender))
  return out
}

// ─── EL PORTE: el tamaño, en bandas, y por qué el tamaño estaba prohibido ────
//
// `escena.ts` lista entre lo que NO se publica «sin tamaño de dibujo», y tenía
// razón con lo que quería decir: **la pantalla no puede inventar cuán grande se
// dibuja algo**. Pero de ahí se seguía algo que nadie quiso: un guijarro y un
// peñasco de la misma sustancia y la misma forma se dibujaban idénticos, y la
// masa es estado del mundo, no cosmética.
//
// La salida es la misma que con el estado: **no viaja el número, viaja la
// banda**. Así el hash no cambia porque una gota de agua se evaporó, y el
// dibujo igual puede decir que un leño no es una astilla.
//
// ─── DE DÓNDE SALEN LOS TRES CORTES ─────────────────────────────────────────
//
// De la materia que el dios efectivamente decreta, no de una escala redonda.
// Medido en el catálogo semilla y en las veinte semillas del arranque:
//
//   hoja-seca sembrada .......... 0,10 – 0,20 kg   → menudo
//   la vara del primer fósforo ... 0,47 – 0,62 kg   → chico
//   la madera que el dios suelta . 2,33 – 2,90 kg   → mediano
//   el leño de la escalera ....... 8,00 kg          → grande
//
// Cada banda tiene habitantes reales, que es la única prueba de que una escala
// no es decorativa. Los cortes van por factor cuatro para que la banda de arriba
// nunca sea «todo lo demás».

export type Porte = 'menudo' | 'chico' | 'mediano' | 'grande'

/** El tamaño en una palabra. Total: todo cuerpo tiene porte. */
export function porteDe(b: Body, phys: Physics): Porte {
  const m = qualityOf(b, 'mass', phys)
  if (m < 0.25) return 'menudo'
  if (m < 1) return 'chico'
  if (m < 4) return 'mediano'
  return 'grande'
}

/**
 * ¿A esto ya no le queda nada para arder?
 *
 * ─── LA LEÑA FALSA, Y POR QUÉ SE ARREGLA EN EL NOMBRE ───────────────────────
 *
 * Un tizón entero y un tizón gastado son la MISMA sustancia: los dos son
 * `residuo-carbonoso-de-madera`, los dos tienen `charred` 1, y hasta acá los dos
 * se llamaban «madera hecho tizón quemada». Lo único que los distingue es el
 * combustible que les queda —5,76 contra 0— y la mente del Hito 5 iba a juntar el
 * segundo creyendo que servía. Lo mismo con el carbón, que nace con `charred` 1 y
 * arde hasta cero sin cambiar de materia ni de nombre.
 *
 * Distinguirlos con `q(b,'fuelEnergy')` siempre se pudo. Lo que faltaba es que se
 * NOTARA sin preguntar, que es como se ven las cosas: lo que se consumió se ve
 * consumido.
 *
 * `deOrigen > 0` es la mitad que importa: la ceniza tiene el combustible en cero
 * desde que nació y nunca tuvo nada que perder, así que sigue siendo «ceniza
 * quemada» y no «ceniza consumida» — no se consumió, nunca ardió.
 */
function seConsumio(b: Body, phys: Physics): boolean {
  if (combustibleDeOrigen(b, phys) <= 0) return false
  return qualityOf(b, 'fuelEnergy', phys) <= 0
}

function agree(adj: string, gender: 'm' | 'f'): string {
  return gender === 'f' && adj.endsWith('o') ? `${adj.slice(0, -1)}a` : adj
}

// ─── Caché de specs ──────────────────────────────────────────────────────────
//
// `qualityOf` se llama miles de veces por tick y `Physics.qualities` es un
// array. La caché es por objeto Physics, así que al recalibrar (Physics nuevo)
// se tira sola y no queda una spec vieja contestando.

const SPEC_CACHE = new WeakMap<Physics, Map<QualityId, QualitySpec>>()

// El tick entero corre con UNA `Physics`, así que la búsqueda en el `WeakMap` da
// siempre lo mismo cientos de miles de veces seguidas. Recordar la última la
// reduce a comparar dos punteros. Es una memoización pura: la misma `Physics`
// tiene el mismo índice, y una `Physics` nueva —recalibrar, transmutar— entra
// por el camino largo y lo reemplaza.
let ultimaPhys: Physics | undefined
let ultimoIndice: Map<QualityId, QualitySpec> | undefined

function indiceDe(phys: Physics): Map<QualityId, QualitySpec> {
  if (phys === ultimaPhys && ultimoIndice !== undefined) return ultimoIndice
  let index = SPEC_CACHE.get(phys)
  if (index === undefined) {
    index = new Map<QualityId, QualitySpec>()
    for (const s of phys.qualities) if (!index.has(s.id)) index.set(s.id, s)
    SPEC_CACHE.set(phys, index)
  }
  ultimaPhys = phys
  ultimoIndice = index
  return index
}

function specFor(phys: Physics, q: QualityId): QualitySpec | undefined {
  return indiceDe(phys).get(q)
}

/**
 * ¿`q` se calcula en ESTA física, o se guarda?
 *
 * `isDerived` de `quality.ts` contesta lo mismo para el catálogo cerrado; esto
 * contesta para la física que se está corriendo, que un test puede haber armado
 * con otro catálogo. La diferencia importa para quien quiera razonar sobre de
 * qué depende una lectura: una cualidad guardada mira `state[q]` y las partes, y
 * nada más; una derivada puede mirar las juntas, la forma o cualquier otra
 * cualidad, y entonces no se puede decidir nada sin evaluarla.
 */
export function esDerivadaEn(phys: Physics, q: QualityId): boolean {
  return specFor(phys, q)?.derived !== undefined
}
