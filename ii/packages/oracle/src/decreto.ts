// ─── @anima/oracle/decreto.ts ────────────────────────────────────────────────
//
// LA COSTURA: DECRETAR UN CHUNK Y DEJARLO JUGABLE.
//
// `resolveChunk` dice qué hay. `ensureSolvable` dice qué le falta para que se
// pueda pescar. Los dos existían y ninguno llamaba al otro, así que el criterio
// (f) del Hito 3 —«ningún chunk acuático queda sin insumos para armar un aparejo
// en radio 2»— estaba verificado sobre un `ChunkSembrable` de test y NO sobre el
// mundo que el mundo va a ver. Un mundo real podía salir injugable, en silencio,
// que es exactamente el modo de falla que la garantía existe para tapar.
//
// Este archivo es esa llamada, y las tres decisiones que hacían falta para
// poder hacerla:
//
// ─── 1. Quién elige la orilla, y por qué NO alcanza mirar adentro ───────────
//
// `ensureSolvable` exige un ANCLA: el punto alrededor del cual se mide el radio
// 2. En un chunk decretado ese punto tiene que salir del terreno y no de un
// sorteo, porque si saliera de un sorteo el ancla dependería del orden de
// consumo del dado y dos partidas gemelas sembrarían en lugares distintos.
//
// La orilla es la primera celda SECA con agua franca al lado (vecindad de 4),
// en orden por filas. Seca porque es donde se para la criatura; con agua al lado
// porque es desde donde se pesca.
//
// **Y el agua de al lado puede estar en el chunk vecino.** Eso no es un detalle:
// medido sobre 3721 chunks de una semilla, el 88,8% de los chunks de bioma
// `agua-dulce` está ENTERAMENTE bajo el agua —el nivel de agua acuático tiene
// mediana 846 en un campo donde solo el 1,4% de los valores pasa de 800—, así
// que adentro de un lago no hay dónde pararse y la orilla de verdad es el borde
// con el chunk seco de al lado. Mirando solo hacia adentro, la garantía se
// activaba en el medio del lago (donde no sirve) y NO se activaba en la orilla
// (que es el único lugar desde donde se pesca).
//
// ─── 2. La garantía la dispara el AGUA, no el bioma ─────────────────────────
//
// El documento la dispara con `bioma.acuatico`, y con esa condición se pierden
// dos casos que sí importan, los dos medidos: los 184 chunks de `pradera` y
// `bosque` de ese mismo barrido que tienen un charco adentro con su orilla —ahí
// se pesca y la garantía nunca se activaba—, y toda la corona de chunks secos
// alrededor de cada lago, que es donde la criatura se para de verdad.
//
// Acá la condición es «hay una celda seca con agua al lado», que es la forma
// operativa de la misma frase: **donde se pueda pescar tiene que haber con qué
// armar el aparejo**. Un chunk enteramente inundado no recibe garantía porque no
// hay dónde pararse ni de dónde levantar nada; la recibe el vecino.
//
// ─── 3. Un ancla por chunk, no una por cuerpo de agua ───────────────────────
//
// La unidad del decreto es el chunk. Un chunk con dos charcos en esquinas
// opuestas recibe UNA garantía, en la primera orilla. **Queda abierto**: si el
// segundo charco queda sin aparejo a mano, ahí no se puede pescar aunque el
// chunk pase el criterio. Está medido en `ii/docs/hito-3-el-dios.md` y no está
// resuelto; resolverlo es sembrar por cuerpo de agua y cuesta más siembra.
//
// ─── 4. De dónde sale el dado de la garantía ────────────────────────────────
//
// NO del dado de `resolveChunk`: ése ya se consumió adentro (256 tiradas de
// jitter y tres por cosa tirada), y para continuarlo desde acá habría que
// replicar esa cuenta —o sea escribir en este archivo cuántas veces tira el
// otro, que es la clase de conocimiento duplicado que se pudre—. Sale de una
// SAL de dominio, que es el mismo recurso que ya usa el clima (`seed ^
// SAL_HUMEDAD`): misma pregunta, otra semilla, y `fnv1a` sobre la cadena entera
// descorrelaciona las dos secuencias.
//
// El resultado sigue siendo función pura de `(seed, cx, cy)`: decretar el mismo
// chunk hoy, dentro de mil ticks o dos veces seguidas siembra exactamente lo
// mismo, en las mismas celdas.

import { fx, type Physics, type Process } from '@anima/physics'

import { CANTERA_DEL_MUNDO } from './bioma.js'
import {
  alturaDeAgua,
  canteraDeChunk,
  CELDAS_DE_LADO,
  hayAguaFranca,
  indiceLocal,
  nivelDeAguaDeChunk,
  resolveChunk,
  tieneAgua,
  type ChunkFacts,
  type Suelta,
  type Terreno,
} from './ley.js'
import { rngFor, type Seed } from './pregunta.js'
import {
  chebyshev,
  ensureSolvable,
  sembrablesDelChunk,
  RADIO_DE_COPRESENCIA,
  type ChunkSembrable,
  type Punto,
  type SueltaSembrable,
} from './resolubilidad.js'

/**
 * La sal del dado de la garantía. Es parte del FORMATO: cambiarla cambia qué
 * siembra la resolubilidad en todos los chunks de todas las partidas guardadas,
 * igual que las sales del clima.
 */
const SAL_RESOLUBILIDAD = 0xe5n

/** Un chunk decretado y ya jugable: lo que dice la ley, más lo que la garantía
 *  tuvo que poner para que el lugar no fuera una trampa silenciosa. */
export interface ChunkDecretado extends ChunkFacts {
  /** La celda seca desde la que se pesca, en índice local. `null` cuando no hay
   *  ninguna: un chunk sin agua cerca (nada que garantizar) o un chunk
   *  enteramente inundado (nada donde pararse; la garantía es del vecino). */
  readonly orilla: number | null
  /**
   * LA CELDA DEL POZO: el agua desde la cual se saca, en índice local. `null`
   * cuando el chunk no tiene una sola gota.
   *
   * Es el reflejo exacto de `orilla` y hacen falta las DOS, porque la pesca pasa
   * entre dos celdas distintas: la criatura se para en la seca y el banco de
   * peces está en la mojada. Con una sola, el mundo tendría que buscar la otra
   * por su cuenta —o sea escribir de nuevo esta misma vecindad de 4— y dos
   * implementaciones de la misma cuenta divergen.
   *
   * Y **un chunk enteramente inundado sí tiene pozo aunque no tenga orilla**: ahí
   * es donde vive el pescado, y quien lo saca está parado en el chunk seco de al
   * lado. Medido en el Hito 3: el 88,8% de los chunks de `agua-dulce` está
   * enteramente bajo el agua, así que si el pozo dependiera de la orilla, casi
   * ningún lago tendría peces.
   */
  readonly pozo: number | null
  /** Cuántas celdas de agua franca tiene el chunk. Es el TAMAÑO del pozo, y de
   *  ahí sale la capacidad del stock (`stockDeAgua`). Cero cuando no hay agua. */
  readonly celdasDeAgua: number
  /** Lo que la garantía agregó. Vacío es el caso bueno: el ruido ya alcanzaba.
   *  Es para la crónica —«el dios puso una liana acá porque si no, no había con
   *  qué»— y para que un test pueda preguntar cuánto hizo falta. */
  readonly sembradas: readonly Suelta[]
}

// ─── La orilla ──────────────────────────────────────────────────────────────

/** Los cuatro vecinos, en el mismo orden y con la misma vecindad que usa el
 *  union-find de `compromiso.ts`: por una esquina no pasa el agua. */
const VECINOS: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
]

/**
 * ¿Hay agua franca en la celda `(lx, ly)` del chunk, o de sus vecinos?
 *
 * Adentro del chunk lee el terreno ya decretado. Afuera calcula el campo de agua
 * con el nivel del chunk vecino, que es la MISMA cuenta que hace `terrainFor`
 * (`hayAguaFranca(nivel, alturaDeAgua(...))`, las dos funciones de `ley.ts`, no
 * una copia). El nivel del vecino se memoiza por chunk: son dos llamadas a ruido
 * y una tabla, y las 60 celdas de borde preguntarían lo mismo sesenta veces.
 *
 * **Lo único que este camino NO ve es el charco garantizado**: cuando un bioma
 * acuático sale sin una sola gota, `terrainFor` le inunda la celda más baja, y
 * ese arreglo es del chunk y no del campo. O sea que un vecino podría no ver ese
 * charco. El error es en la dirección segura —se pierde una orilla, no se
 * inventa—, y está medido: en 3721 chunks el charco garantizado no se activó
 * ninguna vez, porque el nivel acuático ya está altísimo.
 */
function mojada(
  seed: Seed,
  cx: number,
  cy: number,
  t: Terreno,
  lx: number,
  ly: number,
  nivelVecino: (dcx: number, dcy: number) => number,
): boolean {
  if (lx >= 0 && ly >= 0 && lx < CELDAS_DE_LADO && ly < CELDAS_DE_LADO) return tieneAgua(t, indiceLocal(lx, ly))
  const dcx = lx < 0 ? -1 : lx >= CELDAS_DE_LADO ? 1 : 0
  const dcy = ly < 0 ? -1 : ly >= CELDAS_DE_LADO ? 1 : 0
  const x = cx * CELDAS_DE_LADO + lx
  const y = cy * CELDAS_DE_LADO + ly
  return hayAguaFranca(nivelVecino(dcx, dcy), alturaDeAgua(seed, x, y))
}

/**
 * LA ORILLA: la primera celda seca con agua franca al lado, en orden por filas,
 * mirando también del otro lado del borde del chunk.
 *
 * `null` quiere decir «desde acá no se pesca», y son dos casos bien distintos
 * que el resto del decreto no necesita distinguir: un chunk sin agua a mano, y
 * un chunk enteramente inundado. En los dos, sembrar un aparejo sería el dios
 * dejando una caña donde nadie puede levantarla.
 */
export function orillaLocal(seed: Seed, cx: number, cy: number, t: Terreno): number | null {
  const niveles = new Map<number, number>()
  const nivelVecino = (dcx: number, dcy: number): number => {
    const k = (dcx + 1) * 3 + (dcy + 1)
    let v = niveles.get(k)
    if (v === undefined) {
      v = nivelDeAguaDeChunk(seed, cx + dcx, cy + dcy)
      niveles.set(k, v)
    }
    return v
  }
  for (let ly = 0; ly < CELDAS_DE_LADO; ly++) {
    for (let lx = 0; lx < CELDAS_DE_LADO; lx++) {
      if (tieneAgua(t, indiceLocal(lx, ly))) continue
      for (const [dx, dy] of VECINOS) {
        if (mojada(seed, cx, cy, t, lx + dx, ly + dy, nivelVecino)) return indiceLocal(lx, ly)
      }
    }
  }
  return null
}

/**
 * EL POZO: dónde está el agua de la que se saca, y cuánta hay.
 *
 * Devuelve la celda mojada que da a tierra —la primera, en orden por filas, con
 * al menos un vecino seco— y el total de celdas mojadas del chunk. Si el chunk
 * está enteramente inundado no hay ninguna que dé a tierra y entonces vale la
 * primera mojada a secas: adentro de un lago se pesca desde la orilla del chunk
 * vecino, y `extraccion` alcanza a radio 1, así que lo que importa es que el
 * banco esté en el agua y no en cuál de sus celdas.
 *
 * «Da a tierra» se mira con la MISMA `mojada` que usa `orillaLocal`, o sea que
 * también ve del otro lado del borde del chunk. Sin eso, el pozo de un chunk
 * inundado con orilla justo afuera quedaría marcado como interior.
 *
 * Un solo barrido de 256 celdas: cuenta el agua y se queda con la primera
 * candidata. Contar y elegir por separado serían dos barridos que tienen que
 * estar de acuerdo.
 */
export function pozoLocal(
  seed: Seed,
  cx: number,
  cy: number,
  t: Terreno,
): { readonly pozo: number | null; readonly celdas: number } {
  const niveles = new Map<number, number>()
  const nivelVecino = (dcx: number, dcy: number): number => {
    const k = (dcx + 1) * 3 + (dcy + 1)
    let v = niveles.get(k)
    if (v === undefined) {
      v = nivelDeAguaDeChunk(seed, cx + dcx, cy + dcy)
      niveles.set(k, v)
    }
    return v
  }
  let celdas = 0
  let daATierra: number | null = null
  let primeraMojada: number | null = null
  for (let ly = 0; ly < CELDAS_DE_LADO; ly++) {
    for (let lx = 0; lx < CELDAS_DE_LADO; lx++) {
      const i = indiceLocal(lx, ly)
      if (!tieneAgua(t, i)) continue
      celdas++
      if (primeraMojada === null) primeraMojada = i
      if (daATierra !== null) continue
      for (const [dx, dy] of VECINOS) {
        if (!mojada(seed, cx, cy, t, lx + dx, ly + dy, nivelVecino)) {
          daATierra = i
          break
        }
      }
    }
  }
  return { pozo: daATierra ?? primeraMojada, celdas }
}

// ─── Dónde cae lo que la garantía siembra ───────────────────────────────────

/**
 * La celda del chunk en la que aterriza algo sembrado a `p`.
 *
 * `ensureSolvable` elige el punto con su dado y puede caer fuera del chunk (el
 * radio 2 cruza el borde) o adentro del agua. Las dos cosas hay que resolverlas
 * acá y no allá: la garantía razona en puntos y es el decreto el que sabe qué
 * celdas existen y cuáles están mojadas.
 *
 * **Nada cae en el agua**, que es la misma regla que ya cumple `scatter`: una
 * rama flotando sería un caso especial —¿se hunde?, ¿se va con la corriente?— y
 * el mundo no tiene corriente. Se busca la celda SECA más cercana al punto
 * elegido, dentro del radio de la garantía, y los empates los rompe el orden
 * por filas. No consume dado: mover algo a la celda de al lado no puede costar
 * una tirada, o la cantidad de tiradas dependería del agua.
 *
 * El radio se conserva: todas las candidatas están a distancia ≤ 2 del ancla,
 * así que reubicar nunca saca nada de la co-presencia que se está garantizando.
 */
function celdaDeSiembra(p: Punto, origen: Punto, ancla: Punto, t: Terreno): number {
  const px = p.x - origen.x
  const py = p.y - origen.y
  if (px >= 0 && py >= 0 && px < CELDAS_DE_LADO && py < CELDAS_DE_LADO && !tieneAgua(t, indiceLocal(px, py))) {
    return indiceLocal(px, py)
  }
  const ax = ancla.x - origen.x
  const ay = ancla.y - origen.y
  let mejor = -1
  let mejorDistancia = Number.POSITIVE_INFINITY
  for (let dy = -RADIO_DE_COPRESENCIA; dy <= RADIO_DE_COPRESENCIA; dy++) {
    for (let dx = -RADIO_DE_COPRESENCIA; dx <= RADIO_DE_COPRESENCIA; dx++) {
      const lx = ax + dx
      const ly = ay + dy
      if (lx < 0 || ly < 0 || lx >= CELDAS_DE_LADO || ly >= CELDAS_DE_LADO) continue
      const i = indiceLocal(lx, ly)
      if (tieneAgua(t, i)) continue
      const d = chebyshev({ x: origen.x + lx, y: origen.y + ly }, p)
      if (d < mejorDistancia) {
        mejorDistancia = d
        mejor = i
      }
    }
  }
  // El ancla es seca por construcción (es la orilla), así que siempre es
  // candidata y esto no puede quedar sin celda. El `-1` es cinturón, no camino.
  return mejor >= 0 ? mejor : indiceLocal(ax, ay)
}

// ─── El decreto ─────────────────────────────────────────────────────────────

/**
 * DECRETAR UN CHUNK ENTERO: lo que hay, y lo que hizo falta poner.
 *
 * Es la función que el mundo llama al pisar un chunk nuevo, y es la que sostiene
 * el criterio (f) del Hito 3. Pura: `(seed, cx, cy)` entra, el chunk sale, y
 * llamarla dos veces devuelve exactamente lo mismo.
 *
 * `core` y `phys` entran por parámetro y no por import porque la garantía juzga
 * con la FÍSICA —la misma `cumpleRol` con la que el mundo va a juzgar a la
 * criatura— y el catálogo es del mundo, no del dios: cuando la ley 4 dé de alta
 * una sustancia nueva, la garantía la ve sin que este archivo cambie.
 */
export function decretarChunk(
  seed: Seed,
  cx: number,
  cy: number,
  core: readonly Process[],
  phys: Physics,
): ChunkDecretado {
  const base = resolveChunk(seed, cx, cy)
  const orilla = orillaLocal(seed, cx, cy, base.terreno)
  const agua = pozoLocal(seed, cx, cy, base.terreno)
  // Sin orilla no hay desde dónde pescar, y una garantía ahí sería una caña
  // tirada en el medio del lago. Ver el encabezado: la condición NO es el bioma.
  // El POZO sí sale igual: un chunk inundado no tiene dónde pararse pero sí tiene
  // el pescado, y quien lo saca está parado en el vecino.
  if (orilla === null) {
    return { ...base, orilla: null, pozo: agua.pozo, celdasDeAgua: agua.celdas, sembradas: [] }
  }

  const origen: Punto = { x: cx * CELDAS_DE_LADO, y: cy * CELDAS_DE_LADO }
  const ancla: Punto = {
    x: origen.x + (orilla % CELDAS_DE_LADO),
    y: origen.y + Math.floor(orilla / CELDAS_DE_LADO),
  }

  const sembrable: ChunkSembrable = {
    cx,
    cy,
    // `acuatico` es, para `ensureSolvable`, «acá corresponde garantizar». Lo que
    // corresponde garantizar es donde se puede pescar, y eso lo dice la orilla.
    acuatico: true,
    ancla,
    sueltas: sembrablesDelChunk(base.sueltas, CELDAS_DE_LADO, origen, phys),
    // De dónde puede sacar el dios lo que siembre: lo que ALGÚN bioma deja
    // tirado, y no el catálogo entero. Sin este límite la garantía dejaba hebras
    // de agua y plumas en la orilla — ver `CANTERA_DEL_MUNDO`.
    cantera: CANTERA_DEL_MUNDO,
    // Y lo de acá desempata entre las candidatas que valen lo mismo. Se calcula
    // recién ahora, después de saber que hay orilla: son nueve climas más nueve
    // tablas, y en un chunk sin orilla no se usarían para nada.
    canteraLocal: canteraDeChunk(seed, cx, cy),
  }
  const nuevas: readonly SueltaSembrable[] = ensureSolvable(
    sembrable,
    core,
    rngFor({ k: 'chunk', cx, cy }, seed ^ SAL_RESOLUBILIDAD),
    phys,
  )
  if (nuevas.length === 0) {
    return { ...base, orilla, pozo: agua.pozo, celdasDeAgua: agua.celdas, sembradas: [] }
  }

  const sembradas: Suelta[] = nuevas.map((s) => ({
    substance: s.substance,
    i: celdaDeSiembra(s.at, origen, ancla, base.terreno),
    // `fx` sobre las masas de `FORMAS_SEMBRABLES` (1 y 0.3) es exacto: la escala
    // de `Fixed` es 1000 y las dos son múltiplos de una milésima.
    masa: fx(s.mass),
  }))
  return {
    ...base,
    orilla,
    pozo: agua.pozo,
    celdasDeAgua: agua.celdas,
    sembradas,
    sueltas: [...base.sueltas, ...sembradas],
  }
}
