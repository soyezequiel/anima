/**
 * EL BANCO DE MUNDOS — Hito 7, tramo D. Puntos 1, 2 y 6.
 *
 * Los mundos donde se prueba una habilidad, **derivados del contrato** y no
 * escritos a mano. Es lo que hace verdadero el punto 2:
 *
 *   > una de pesca se juzga en mundos con río y **nunca saca un 0% falso**
 *
 * Un banco escrito a mano saca 0% falsos todo el tiempo: el que lo escribe no
 * sabe qué necesita la habilidad, así que le pone mundos donde no puede andar y
 * los cuenta como fracasos. Si los mundos salen del contrato, eso no puede
 * pasar por construcción — la habilidad se prueba donde dijo que trabaja.
 *
 * ─── LA MEDICIÓN QUE DECIDIÓ DÓNDE VIVE ESTO ────────────────────────────────
 *
 * Hay **CINCO copias** del armado de un mundo en el árbol, no tres como decía la
 * medición M5 del criterio. La cadena está escrita en sus propios encabezados:
 *
 *   world/tests/mundo-minimo.ts
 *     → perceive/tests/mundo.ts
 *       → plan/tests/los-esquemas-contra-el-mundo.test.ts
 *         → mind/tests/mundo.ts
 *           → lang/tests/mundo.ts
 *
 * Y las dos últimas son **idénticas byte a byte** en el cuerpo: cero líneas de
 * diferencia sin comentarios. Sólo cambian los encabezados.
 *
 * La copia es DELIBERADA y la razón está escrita:
 *
 *   > los `tests/` de un paquete no se exportan, así que compartirlo exigiría
 *   > mover el arnés adentro de `src/`, o sea meterle al paquete **un módulo que
 *   > sólo existe para los tests**.
 *
 * **Esa razón no aplica acá, y por eso este archivo está en `src/` y no en
 * `tests/`.** El juez no arma mundos para sus tests: los arma para trabajar. Del
 * Hito 8 en adelante la fragua le pide un veredicto **con el mundo corriendo**,
 * así que armar mundos es lo que este paquete HACE, no cómo se prueba.
 *
 * Lo que sí queda anotado como hallazgo aparte —y no se toca en este tramo,
 * porque churnear cinco paquetes adentro de otro trabajo es cómo se pierde la
 * atribución de un rojo—: **la objeción venció**. Existe un consumidor de
 * producción, así que el armado ya podría vivir en `@anima/world/src` y las
 * cinco copias colapsar ahí.
 *
 * ─── QUÉ ES UN MUNDO ADVERSO, Y POR QUÉ SE DERIVA ───────────────────────────
 *
 * El criterio pide **1/3 adversario**. Un adversario escrito a mano es un mundo
 * que a alguien le pareció difícil; uno derivado del contrato es un mundo que
 * ataca **lo que la habilidad dijo que necesita**, que es lo único que puede
 * distinguir «funciona» de «funcionó donde la corrigieron» (punto 1).
 *
 * Las cuatro clases, y cada una falla distinto:
 *
 * | clase | qué le pone delante | qué prueba |
 * |---|---|---|
 * | `holgado` | materia que cumple con margen | que ande en su casa |
 * | `al-borde` | materia que cumple por el pelo | que no dependa de un margen |
 * | `justo-abajo` | materia que NO cumple por el pelo | **que sepa NO andar** |
 * | `sin-nada` | ninguna materia | que no invente |
 *
 * Las dos últimas son las adversas, y `justo-abajo` es la que más trabaja:
 * **una habilidad que anda ahí está mintiendo**, porque su propio contrato dice
 * que no puede. Un banco sin esa fila no distingue una habilidad de una que
 * devuelve `ok` siempre.
 */

import { qualityOf } from '@anima/physics'
import type { Body, Physics, QualityId } from '@anima/physics'
import type { Contrato, Predicado } from '@anima/skills/innatas'
import { cumpleElPredicado } from './sintetizar.js'

export type ClaseDeMundo = 'holgado' | 'al-borde' | 'alternativo' | 'justo-abajo' | 'sin-nada'

/** Las dos que atacan. Ver la tabla del encabezado. */
export const ADVERSAS: readonly ClaseDeMundo[] = ['justo-abajo', 'sin-nada']

export interface MundoDelBanco {
  /** Determinista y legible: es lo que se cita cuando algo sale mal. */
  readonly id: string
  readonly clase: ClaseDeMundo
  readonly adverso: boolean
  /**
   * QUÉ PRECONDICIÓN ATACA, cuando ataca una sola.
   *
   * Salió de mirar el primer banco que este archivo produjo: el `justo-abajo` de
   * `frotar` era `raiz/vara`, que mide `rigidity 0,400` contra un umbral de 0,5
   * **y** `moisture 0,480` contra uno de 0,45 — o sea que fallaba las DOS a la
   * vez. Un adversario así prueba menos de lo que parece: si la habilidad lo
   * rechaza, no se sabe por cuál de las dos.
   *
   * Ahora se busca, para cada precondición, materia que falle **ésa y sólo ésa**.
   * Es un adversario más fino y además es exactamente la forma que pide la
   * ablación del punto 4: para saber si una precondición es espuria hay que
   * correr mundos donde falle esa y ninguna otra.
   *
   * `undefined` cuando el mundo no ataca una en particular.
   */
  readonly ataca: string | undefined
  /**
   * Un cuarto del banco que **el juez nunca le muestra a la fragua**. Sin esto,
   * una fragua que ve el banco puede ajustar contra él y aprobar sin aprender.
   */
  readonly reservado: boolean
  /** La materia que se le pone delante. `undefined` en `sin-nada`. */
  readonly objetivo: Body | undefined
  /** Qué se espera: en las adversas, que NO cumpla. */
  readonly deberiaCumplir: boolean
}

/**
 * CUÁNTOS MUNDOS POR CLASE, y por qué dejó de ser uno.
 *
 * ─── Las dos mediciones que lo obligaron ────────────────────────────────────
 *
 * **1. El banco daba 5 mundos y 1 reservado.** El Hito 8 quiso afirmar que una
 * candidata re-forjada *«mejora en los mundos que no le contaron»* —lo que separa
 * aprender de memorizar— y no se pudo: con UN solo mundo reservado, el resultado
 * `1/1 → 0/1` es una moneda. No lo arregla correrlo más veces; diez corridas dan
 * diez monedas.
 *
 * **2. Y el reservado era SIEMPRE `al-borde`.** Peor que el tamaño. La reserva
 * era `i % 4 === 1` sobre una lista ordenada por clase, así que en los tres
 * contratos medidos —sostener, frotar, comer— caía en el mismo índice y en la
 * misma clase. La fragua veía todas las clases menos ésa. Un cuarto reservado que
 * es siempre la misma clase no es una muestra: es una clase escondida.
 *
 * ─── Por qué CUATRO, y de dónde sale la materia ─────────────────────────────
 *
 * Materia sobra: el catálogo da **540 candidatos** por contrato (30 sustancias ×
 * 6 formas × 3 masas) y el banco usaba 3. Lo que acota no es la materia, es el
 * tiempo: **0,77 ms por mundo**, medido. Con 4 por clase el banco queda en ~17
 * mundos y ~13 ms — adentro de la ventana de tick de 50 ms, que es el techo que
 * el Hito 8 le puso a todo lo que corre del lado del mundo.
 *
 * Cuatro es además lo que hace que **la reserva de un cuarto rinda un mundo por
 * clase**: con menos, alguna clase se queda sin representante reservado y vuelve
 * el sesgo de arriba.
 */
export const POR_CLASE = 4

const FORMAS: readonly string[] = ['vara', 'hebra', 'filete', 'malla', 'bloque', 'grano']
const MASAS: readonly number[] = [0.05, 1, 20]

function cuerpoDe(substance: string, form: string, mass: number, id: string): Body {
  return { id, parts: [{ substance, mass, q: {} }], joints: [], state: {}, form } as unknown as Body
}

function valor(b: Body, q: string, phys: Physics): number | undefined {
  try {
    return qualityOf(b, q as QualityId, phys)
  } catch {
    return undefined
  }
}

/**
 * Cuánto le sobra a un cuerpo sobre lo que el predicado pide.
 *
 * Es la distancia al umbral, y sirve para ordenar: el `al-borde` es el que menos
 * margen tiene **cumpliendo**, y el `justo-abajo` el que menos falta le tiene
 * **sin cumplir**. Los dos se eligen midiendo, no a ojo.
 */
function margen(b: Body, ps: readonly Predicado[], phys: Physics): number | undefined {
  let peor = Infinity
  for (const p of ps) {
    const v = valor(b, p.q, phys)
    if (v === undefined) return undefined
    // Hacia dónde es «de más» depende del operador: con `<` cumplir es estar
    // por debajo, así que el margen se mide al revés.
    const m = p.op === '<' || p.op === '<=' ? p.v - v : v - p.v
    if (m < peor) peor = m
  }
  return peor === Infinity ? undefined : peor
}

const NO_ES_DE_LA_MATERIA: ReadonlySet<string> = new Set(['holding', 'at', 'existe', 'permits'])

/**
 * EL BANCO DE UN CONTRATO.
 *
 * Determinista de punta a punta: recorre el catálogo en orden, las formas en
 * orden y las masas en orden, y desempata por el `id` de la sustancia. Dos
 * corridas dan el mismo banco, que es lo que hace que un veredicto se pueda
 * repetir — y un veredicto que no se puede repetir no es un veredicto.
 */
export function bancoDe(c: Contrato, phys: Physics): readonly MundoDelBanco[] {
  const pide = c.precondiciones.filter((p) => p.sujeto === 'el-objetivo' && !NO_ES_DE_LA_MATERIA.has(p.q))

  // Un contrato que no pide materia no tiene banco de materia: su único mundo
  // es el vacío, y no es adverso — es su caso normal. Decirlo así en vez de
  // devolver una lista vacía evita que el juez lo lea como «no se pudo».
  if (pide.length === 0) {
    return [
      {
        id: `${c.nombre}·sin-objetivo`,
        clase: 'holgado',
        adverso: false,
        ataca: undefined,
        reservado: false,
        objetivo: undefined,
        deberiaCumplir: true,
      },
    ]
  }

  const cumplen: { b: Body; m: number; k: string }[] = []
  const fallan: { b: Body; m: number; k: string }[] = []
  for (const s of phys.substances.values()) {
    for (const form of FORMAS) {
      for (const mass of MASAS) {
        const k = `${s.id}/${form}/${String(mass)}`
        const b = cuerpoDe(s.id, form, mass, k)
        const m = margen(b, pide, phys)
        if (m === undefined) continue
        const todas = pide.every((p) => {
          const v = valor(b, p.q, phys)
          return v !== undefined && cumpleElPredicado(p, v)
        })
        ;(todas ? cumplen : fallan).push({ b, m, k })
      }
    }
  }

  // El orden: por margen y, empatados, por la clave. El desempate por texto es
  // lo que hace determinista al banco cuando dos materias miden exactamente lo
  // mismo — que con umbrales redondos pasa seguido.
  const porMargen = (a: { m: number; k: string }, b: { m: number; k: string }): number =>
    a.m === b.m ? (a.k < b.k ? -1 : 1) : a.m - b.m
  cumplen.sort(porMargen)
  fallan.sort(porMargen)

  const out: MundoDelBanco[] = []
  // Ninguna materia entra dos veces, aunque califique para dos clases: un mundo
  // repetido infla la cuenta sin probar nada nuevo, y el criterio del Hito 7 mira
  // `corrida.mundos`.
  const yaEsta = new Set<string>()
  const meter = (clase: ClaseDeMundo, e: { b: Body; k: string } | undefined, ataca?: string): void => {
    if (e === undefined || yaEsta.has(e.k)) return
    yaEsta.add(e.k)
    out.push({
      id: `${c.nombre}·${clase}·${e.k}`,
      clase,
      adverso: ADVERSAS.includes(clase),
      ataca,
      reservado: false,
      objetivo: e.b,
      deberiaCumplir: !ADVERSAS.includes(clase),
    })
  }

  // El holgado son los de MÁS margen y el al-borde los de MENOS, todos cumpliendo.
  // Se toman de las dos puntas de la misma lista ordenada, y el `yaEsta` impide
  // que se pisen cuando `cumplen` es corta.
  const holgado = cumplen[cumplen.length - 1]
  for (let i = 0; i < POR_CLASE; i++) meter('holgado', cumplen[cumplen.length - 1 - i])
  for (let i = 0; i < POR_CLASE; i++) meter('al-borde', cumplen[i])

  // MATERIALES ALTERNATIVOS — uno de los ocho mundos del caso de aceptación, y
  // el único de los ocho que entra en el sujeto actual (los otros hablan de un
  // dispositivo sobre un pozo; ver `los-ocho-mundos-adversos.test.ts`).
  //
  // Otra SUSTANCIA que cumple lo mismo. No es adverso —la habilidad tiene que
  // andar— pero es el mundo que discrimina: una habilidad que se aprendió el
  // material en vez de la propiedad se cae acá y en ningún otro lado.
  //
  // Se elige la de más margen entre las que no son la del holgado, y no una al
  // azar: la que más margen tiene es la que menos excusa deja.
  if (holgado !== undefined) {
    const sustanciaDelHolgado = holgado.k.split('/')[0]
    // Una por SUSTANCIA distinta, no las N de más margen: si se tomaran por
    // margen a secas saldrían cuatro formas de la misma sustancia, y este mundo
    // existe justamente para cazar a la que se aprendió el material.
    const vistas = new Set<string>([sustanciaDelHolgado ?? ''])
    for (let i = cumplen.length - 1; i >= 0 && vistas.size <= POR_CLASE; i--) {
      const e = cumplen[i]
      const sus = e?.k.split('/')[0]
      if (e === undefined || sus === undefined || vistas.has(sus)) continue
      vistas.add(sus)
      meter('alternativo', e)
    }
  }

  // ─── CUÁNTOS ADVERSOS, y el número sale del CRITERIO ─────────────────────
  //
  // El Hito 7 exige que el banco sea **1/3 adverso**, y eso no es una
  // preferencia: un banco que no ataca no distingue una habilidad de una que
  // devuelve `ok` siempre. Con `POR_CLASE = 4` el primer intento de agrandar el
  // banco lo rompió —5 adversos de 17, o sea 29,4%— y el guardián lo agarró.
  //
  // Así que no se elige: se deriva. Si hay `a` amables y `sin-nada` aporta uno,
  // los `justo-abajo` tienen que ser al menos `a/2 − 1` para que
  // `adversos / total >= 1/3`.
  const amables = out.length
  const adversosQueFaltan = Math.max(1, Math.ceil(amables / 2) - 1)

  // UN `justo-abajo` POR PRECONDICIÓN, y de a vueltas: materia que falle ÉSA y
  // ninguna otra. Ver el porqué en el comentario de `MundoDelBanco.ataca`. Se
  // reparte en ronda entre las precondiciones en vez de vaciar la primera, para
  // que un contrato de tres no quede con tres adversarios de la misma.
  const yaPuesto = new Set<string>()
  const porPrecondicion: { clave: string; lista: { b: Body; m: number; k: string }[] }[] = []
  for (const p of pide) {
    const clave = `${p.q}${p.op}${String(p.v)}`
    const soloEsta = fallan.filter((e) => {
      let rompeEsta = false
      for (const q of pide) {
        const v = valor(e.b, q.q, phys)
        if (v === undefined) return false
        const ok = cumpleElPredicado(q, v)
        if (q === p && ok) return false
        if (q === p) rompeEsta = true
        else if (!ok) return false
      }
      return rompeEsta
    })
    porPrecondicion.push({ clave, lista: soloEsta })
  }

  // La ronda. Los que MENOS les falta primero: el que roza el umbral es el que
  // más aprieta, pero uno solo deja pasar a la que memorizó justo esa materia.
  let puestos = 0
  for (let vuelta = 0; puestos < adversosQueFaltan; vuelta++) {
    let algunoEntro = false
    for (const { clave, lista } of porPrecondicion) {
      if (puestos >= adversosQueFaltan) break
      const elegido = lista[lista.length - 1 - vuelta]
      if (elegido === undefined || yaPuesto.has(elegido.k)) continue
      yaPuesto.add(elegido.k)
      meter('justo-abajo', elegido, clave)
      puestos++
      algunoEntro = true
    }
    // Se acabó la materia que ataca de a una. Mejor un banco más chico que un
    // bucle infinito, y el guardián del 1/3 se va a quejar si no alcanzó.
    if (!algunoEntro) break
  }

  // Y si NINGUNA precondición se puede violar aislada, se cae al adversario
  // grueso: el que menos le falta, falle lo que falle. Peor que el fino y mejor
  // que ninguno — y se distingue porque `ataca` queda `undefined`.
  if (!out.some((m) => m.clase === 'justo-abajo')) meter('justo-abajo', fallan[fallan.length - 1])

  out.push({
    id: `${c.nombre}·sin-nada`,
    clase: 'sin-nada',
    adverso: true,
    ataca: undefined,
    reservado: false,
    objetivo: undefined,
    deberiaCumplir: false,
  })

  return reservarUnCuarto(out)
}

/**
 * EL CUARTO RESERVADO, uno de cada cuatro DENTRO DE CADA CLASE.
 *
 * ─── La versión anterior escondía una clase entera, y está medido ───────────
 *
 * Era `i % 4 === 1` sobre la lista completa. La lista sale ordenada por clase
 * —holgado, al-borde, alternativo, justo-abajo, sin-nada— así que con cinco
 * mundos el índice 1 es **siempre `al-borde`**. Medido sobre los tres contratos
 * que tienen banco de materia: sostener, frotar y comer, los tres reservaban
 * `al-borde` y nada más.
 *
 * O sea que la fragua veía cuatro de las cinco clases **completas** y de la
 * quinta no veía nada. Eso no es una muestra: es una clase escondida, y una
 * habilidad que sólo falla al borde del umbral queda invisible en la devolución.
 *
 * ─── Lo que hay ahora ───────────────────────────────────────────────────────
 *
 * Se cuenta el índice **adentro de cada clase**, así que el reservado es una
 * muestra de TODAS: con `POR_CLASE = 4` sale uno por clase.
 *
 * Sigue sin azar —el banco tiene que ser reproducible, regla 2— y sigue
 * empezando por el segundo de cada clase por el motivo de siempre: el primero de
 * `holgado` es el mundo más fácil que hay, y guardarlo no defiende de nada.
 *
 * Una clase con un solo mundo —`sin-nada`— no aporta reservado, y es correcto:
 * no hay dos, así que reservarlo sería esconder el único.
 */
function reservarUnCuarto(ms: readonly MundoDelBanco[]): readonly MundoDelBanco[] {
  const vistosPorClase = new Map<ClaseDeMundo, number>()
  return ms.map((m) => {
    const i = vistosPorClase.get(m.clase) ?? 0
    vistosPorClase.set(m.clase, i + 1)
    return { ...m, reservado: i % 4 === 1 }
  })
}

/** Lo que el juez le puede mostrar a la fragua. El resto es el cuarto reservado. */
export function loQueSeMuestra(b: readonly MundoDelBanco[]): readonly MundoDelBanco[] {
  return b.filter((m) => !m.reservado)
}

export function cuantosAdversos(b: readonly MundoDelBanco[]): number {
  return b.filter((m) => m.adverso).length
}
