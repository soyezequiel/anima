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

export type ClaseDeMundo = 'holgado' | 'al-borde' | 'justo-abajo' | 'sin-nada'

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
  const meter = (clase: ClaseDeMundo, e: { b: Body; k: string } | undefined, ataca?: string): void => {
    if (e === undefined) return
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

  // El holgado es el de MÁS margen y el al-borde el de menos, los dos cumpliendo.
  meter('holgado', cumplen[cumplen.length - 1])
  if (cumplen.length > 1) meter('al-borde', cumplen[0])

  // UN `justo-abajo` POR PRECONDICIÓN: materia que falle ÉSA y ninguna otra.
  // Ver el porqué en el comentario de `MundoDelBanco.ataca`.
  const yaPuesto = new Set<string>()
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
    const elegido = soloEsta[soloEsta.length - 1]
    if (elegido !== undefined && !yaPuesto.has(elegido.k)) {
      yaPuesto.add(elegido.k)
      meter('justo-abajo', elegido, clave)
    }
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
 * EL CUARTO RESERVADO, elegido por posición y no por sorteo.
 *
 * Sin azar porque el banco tiene que ser reproducible (regla 2), y **uno de cada
 * cuatro empezando por el segundo** porque empezar por el primero reservaría
 * siempre el `holgado`, que es el menos informativo: guardar el mundo fácil no
 * defiende de nada.
 */
function reservarUnCuarto(ms: readonly MundoDelBanco[]): readonly MundoDelBanco[] {
  return ms.map((m, i) => ({ ...m, reservado: i % 4 === 1 }))
}

/** Lo que el juez le puede mostrar a la fragua. El resto es el cuarto reservado. */
export function loQueSeMuestra(b: readonly MundoDelBanco[]): readonly MundoDelBanco[] {
  return b.filter((m) => !m.reservado)
}

export function cuantosAdversos(b: readonly MundoDelBanco[]): number {
  return b.filter((m) => m.adverso).length
}
