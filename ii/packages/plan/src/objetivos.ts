// ─── @anima/plan/objetivos.ts ────────────────────────────────────────────────
//
// DE UNA FRASE A UN GRAFO. El requisito 6 del documento de arquitectura, que es
// el ADR 0053 («el encargo se descompone en pasos») y el ADR 0082 («las
// referencias conservan identidad») de Ánima I portados a un mundo que ya no
// tiene tipos de entidad, sólo cualidades.
//
// «hacé una caña y andá a pescar, después asá el pescado» son TRES nodos, y el
// documento lo dice con todas las letras: orden PARCIAL, no lista. Las dos
// primeras cosas van en cualquier orden —quien las pidió no dijo cuál primero, y
// serializarlas sería inventar una restricción que nadie puso, y después
// perseguirla—; la tercera va después de las dos. Y encima habla de algo que
// TODAVÍA NO EXISTE cuando la frase se lee: el pescado.
//
// ─── LAS TRES DECISIONES DE ESTE ARCHIVO ────────────────────────────────────
//
// 1. EL ORDEN SE ESCRIBE POR GRUPOS, Y LAS ARISTAS SON MÍNIMAS. Una cláusula
//    `'y'` se suma al grupo abierto; una `'despues'` CIERRA el grupo y abre uno
//    nuevo, y cada nodo del grupo nuevo va después de todos los del anterior —de
//    los del anterior y de ninguno más. La transitividad no se escribe: el grupo
//    2 va después del 1, que va después del 0, y `orden()` lo cierra solo. Un
//    `after` con la clausura transitiva adentro diría lo mismo con n² aristas y
//    tendría dos representaciones de la misma verdad, que es la enfermedad que
//    `world/src/reloj.ts` documenta para el reloj guardado.
//
// 2. LA LIGADURA DIFERIDA ES UNA ARISTA MÁS UNA PROMESA, Y SE PIDE APARTE. Una
//    cláusula `'despues'` sin `bindeaSlot` sólo ordena; con `bindeaSlot` además
//    dice «el hueco que nombro lo llena lo que rindió la cláusula anterior», y de
//    ahí sale el `binds`. Sin eso, «el pescado» se resuelve contra la vista de
//    hoy, no encuentra nada —todavía no lo pescó— y el plan se cae en el paso
//    tres. Ése es EXACTAMENTE el bug que el ADR 0082 arregló, y tirar el
//    planificador viejo sin portar esto lo reintroducía intacto.
//
// 3. LO QUE NO SE ENTIENDE, SE GRITA. Una `bindeaSlot` en la PRIMERA cláusula
//    nombra el rendimiento de algo que no existe, y una `bindeaSlot` sobre una
//    cláusula `'y'` pide dos cosas contradictorias: «no me importa el orden» y
//    «usá lo que salga de la anterior». Las dos lanzan. La alternativa —soltar el
//    `binds` y devolver el nodo igual— es el vicio de `parsePromesa`, que descarta
//    en silencio lo que no parsea (`physics/src/admit.ts:2716`): el grafo saldría
//    verde, plausible y con una referencia menos, y el fracaso aparecería tres
//    capas más abajo como un `Ref` que no resuelve.

import type { GoalId, GoalNode, Predicado } from './tipos.js'

/**
 * Una lectura ya hecha: qué pidió alguien, en cláusulas. `@anima/lang` no existe
 * hasta el Hito 6, así que hasta entonces esto lo arma la mente (una necesidad
 * es una cláusula sola) o un test.
 */
export interface Lectura {
  readonly clausulas: readonly {
    readonly goal: Predicado
    /** `'despues'` la ata a la anterior; `'y'` la deja suelta (orden parcial). */
    readonly liga: 'y' | 'despues'
    /** Qué slot de esta cláusula referencia al rendimiento de la anterior. */
    readonly bindeaSlot?: string
    readonly porque: string
  }[]
}

/**
 * El prefijo de los ids. Los ids salen del ÍNDICE DE LA CLÁUSULA y de ningún
 * contador global: dos lecturas iguales tienen que dar dos grafos iguales, y un
 * contador que sobrevive entre lecturas hace que el mismo pedido dé `g7` la
 * primera vez y `g19` la segunda —lo mismo, con otro nombre, y por lo tanto
 * incomparable contra una crónica guardada—.
 */
const PREFIJO_DE_NODO = 'g'

/**
 * La forma que `idDe` produce, para poder reconocerla al ordenar. El `0|[1-9]…`
 * y no `[0-9]+` es a propósito: sin eso, `g007` y `g7` serían dos ids distintos
 * con el mismo número, y el desempate numérico los declararía empatados.
 */
const ID_CANONICO = /^g(0|[1-9][0-9]*)$/

function idDe(indice: number): GoalId {
  return PREFIJO_DE_NODO + String(indice)
}

/** Lectura → grafo con orden parcial y ligaduras diferidas. */
export function goalGraph(l: Lectura): readonly GoalNode[] {
  const nodos: GoalNode[] = []
  // El grupo YA CERRADO es el único que impone orden sobre lo que viene: los
  // nodos del grupo abierto son hermanos entre sí y no se ordenan entre ellos.
  let grupoCerrado: readonly GoalId[] = []
  let grupoAbierto: GoalId[] = []

  for (const [i, c] of l.clausulas.entries()) {
    // La primera cláusula no puede ir «después» de nada, así que su `liga` no
    // ordena nada y no lanza: una lectura que empieza con «después...» es una
    // lectura de un solo grupo, y eso es coherente. Lo que sí lanza es su
    // `bindeaSlot` —ver abajo—, porque ahí sí hay una referencia que apunta al
    // vacío en vez de una restricción que se cumple sola.
    if (c.liga === 'despues' && i > 0) {
      grupoCerrado = grupoAbierto
      grupoAbierto = []
    }

    const id = idDe(i)
    // Copia por nodo y no el mismo array compartido entre hermanos: `after` es
    // `readonly` para el compilador, no para quien reciba el grafo por un `any`
    // de un borde, y un array compartido convierte un push ajeno en una arista
    // que aparece en tres nodos a la vez.
    const after: readonly GoalId[] = [...grupoCerrado]

    if (c.bindeaSlot === undefined) {
      nodos.push({ id, goal: c.goal, after, porque: c.porque })
    } else {
      if (i === 0) {
        throw new Error(
          `la primera cláusula bindea el slot «${c.bindeaSlot}» al rendimiento de la anterior, y no hay anterior`,
        )
      }
      if (c.liga !== 'despues') {
        throw new Error(
          `la cláusula ${String(i)} liga «y» y bindea el slot «${c.bindeaSlot}»: una ligadura ES un orden —no se puede usar lo que todavía no se produjo—, así que las dos cosas juntas se contradicen`,
        )
      }
      // `from` es la cláusula INMEDIATAMENTE anterior y no todo el grupo
      // cerrado: «asá el pescado» nombra lo que rindió «andá a pescar», que es
      // la que acaba de hablar. Un `binds` contra un grupo entero necesitaría
      // decidir cuál de los hermanos rindió el pescado, y esa decisión no está
      // en la frase.
      nodos.push({
        id,
        goal: c.goal,
        after,
        binds: { slot: c.bindeaSlot, from: idDe(i - 1) },
        porque: c.porque,
      })
    }
    grupoAbierto.push(id)
  }

  return nodos
}

/**
 * La clave de orden de un id, en TRES campos que se comparan en cascada.
 *
 * Y no es adorno: un comparador que mezcla criterios SIN una clave común no es
 * transitivo, y un comparador no transitivo le da a `sort` un resultado que
 * depende del algoritmo interno del motor —o sea, no-determinismo por la puerta
 * de atrás, en el archivo que existe para que el orden sea determinista—.
 *
 * El contraejemplo, que está en el test: comparar «numérico si los dos son
 * canónicos, textual si no» da `g2 < g10` (numérico), `g1x < g2` (textual) y
 * `g10 < g1x` (textual), o sea `g10 < g1x < g2 < g10`. Un ciclo. Con la clave en
 * cascada —canónicos antes que no canónicos, número, y texto como último
 * desempate— el orden es total por construcción, porque comparar tuplas en orden
 * lexicográfico siempre lo es.
 */
interface ClaveDeOrden {
  /** 0 los que `idDe` produjo, 1 los demás. Los canónicos van primero. */
  readonly canonico: number
  /** El índice de la cláusula. 0 para los no canónicos, que no lo usan. */
  readonly numero: number
  readonly texto: string
}

function claveDe(id: GoalId): ClaveDeOrden {
  const m = ID_CANONICO.exec(id)
  const digitos = m?.[1]
  if (digitos === undefined) return { canonico: 1, numero: 0, texto: id }
  return { canonico: 0, numero: Number(digitos), texto: id }
}

/**
 * El desempate entre dos nodos que el grafo deja sueltos.
 *
 * Es POR ID y no por posición en el array de entrada, y ahí está toda la
 * estabilidad: el mismo grafo con los nodos barajados tiene que dar el mismo
 * orden, porque quien lo arma —hoy la mente, mañana la gramática— no promete
 * ningún orden de array. Y el id lleva adentro el índice de la cláusula, así que
 * ordenar por id termina siendo ordenar por el orden en que la persona lo dijo,
 * que es la única preferencia que hay cuando el grafo no dice nada.
 *
 * `localeCompare` está prohibido por la regla 2 —el resultado dependería del
 * idioma del sistema—; `<` sobre strings compara unidades de código UTF-16, que
 * es la misma respuesta en todos los motores.
 */
function comparaId(a: GoalId, b: GoalId): number {
  const x = claveDe(a)
  const y = claveDe(b)
  if (x.canonico !== y.canonico) return x.canonico < y.canonico ? -1 : 1
  if (x.numero !== y.numero) return x.numero < y.numero ? -1 : 1
  if (x.texto === y.texto) return 0
  return x.texto < y.texto ? -1 : 1
}

/**
 * Un orden topológico estable del grafo. Estable: dos nodos sin relación salen
 * siempre en el mismo orden, o el determinismo se va por acá.
 *
 * Es Kahn, con la lista de listos ordenada por `comparaId` antes de cada
 * elección. La versión ingenua —recorrer un `Set` o un `Map` y emitir lo que
 * venga— da un orden topológico VÁLIDO y distinto según cómo se armó el grafo, y
 * un plan que sale en otro orden es una partida que diverge.
 *
 * LANZA en tres casos, y ninguno es capricho:
 *
 *   · un id repetido: dos nodos con el mismo nombre son dos verdades para el
 *     mismo `binds`, y elegir una en silencio es elegir mal la mitad de las veces;
 *   · un `after` que apunta afuera del grafo: la restricción no se puede cumplir
 *     porque no se puede ni mirar. Ignorarla —tentador, y lo que haría un
 *     topológico escrito de apuro— convierte al nodo en libre y lo deja correr
 *     ANTES de lo que esperaba, que es el fracaso más caro posible: el plan sale
 *     verde y el mundo queda mal;
 *   · un ciclo: se detecta y se nombra. Devolver la lista corta —lo que hace
 *     Kahn si nadie mira el largo— sería entregar un orden que se saltea nodos
 *     sin decirlo.
 *
 * El ciclo se querría devolver como valor y no como excepción, pero la firma del
 * andamio es `readonly GoalId[]` y una lista no tiene dónde poner «hay un ciclo».
 * Está anotado en el informe del tramo.
 */
export function orden(g: readonly GoalNode[]): readonly GoalId[] {
  const porId = new Map<GoalId, GoalNode>()
  for (const n of g) {
    if (porId.has(n.id)) throw new Error(`el grafo tiene dos nodos con el id «${n.id}»`)
    porId.set(n.id, n)
  }

  // Dependencias sin repetidos, y hay que decir la parte incómoda: HOY esta
  // línea no cambia ninguna salida, y está medido —quitarla deja los 27 tests de
  // `los-objetivos` en verde—. Un `after: ['g0','g0']` sin deduplicar cuenta
  // grado 2 y también
  // empuja `g1` DOS VECES a los hijos de `g0`, así que recibe dos descuentos y
  // se cancela. Se deduplica igual porque esa cancelación es un accidente de que
  // el conteo y el descuento salgan del MISMO bucle: el día que `hijos` se arme
  // aparte —o venga precomputado por quien llame— el nodo se queda esperando
  // para siempre y el mensaje dice «ciclo» sobre un grafo que no tiene ninguno.
  // Deduplicar acá hace que `deps` sea un conjunto de verdad, que es lo que
  // `buscarCiclo` y cualquier lector futuro van a suponer que es.
  const deps = new Map<GoalId, readonly GoalId[]>()
  const hijos = new Map<GoalId, GoalId[]>()
  for (const n of g) {
    const propias: GoalId[] = []
    for (const d of n.after) {
      if (!porId.has(d)) {
        throw new Error(`«${n.id}» dice ir después de «${d}», que no es un nodo de este grafo`)
      }
      if (propias.includes(d)) continue
      propias.push(d)
      const previos = hijos.get(d)
      if (previos === undefined) hijos.set(d, [n.id])
      else previos.push(n.id)
    }
    deps.set(n.id, propias)
  }

  const grado = new Map<GoalId, number>()
  const listos: GoalId[] = []
  for (const n of g) {
    const cuantas = deps.get(n.id)?.length ?? 0
    grado.set(n.id, cuantas)
    if (cuantas === 0) listos.push(n.id)
  }

  const salida: GoalId[] = []
  const emitido = new Set<GoalId>()
  while (listos.length > 0) {
    // Ordenar la lista entera en cada vuelta es O(n² log n), y está bien: `n` es
    // la cantidad de cláusulas de una frase. Un montículo binario sería más
    // rápido y necesitaría el mismo desempate total, así que compraría constante
    // y pagaría con una estructura donde el determinismo se esconde adentro.
    listos.sort(comparaId)
    const id = listos.shift()
    // No puede pasar —el `while` lo garantiza—, pero `noUncheckedIndexedAccess`
    // no lo sabe y un `!` sería justo el atajo que este repo no usa.
    if (id === undefined) break
    salida.push(id)
    emitido.add(id)
    for (const h of hijos.get(id) ?? []) {
      const queda = (grado.get(h) ?? 0) - 1
      grado.set(h, queda)
      if (queda === 0) listos.push(h)
    }
  }

  if (salida.length !== g.length) {
    const restantes = g.filter((n) => !emitido.has(n.id)).map((n) => n.id)
    const ciclo = buscarCiclo(restantes, deps, emitido)
    throw new Error(
      `el grafo de objetivos tiene un ciclo: ${ciclo.join(' → ')} — ${String(restantes.length)} nodo(s) nunca podrían empezar`,
    )
  }
  return salida
}

/**
 * Un ciclo CONCRETO entre los que quedaron trabados, no la lista de trabados.
 *
 * No son lo mismo y la diferencia es la que hace útil el mensaje: si `g0 → g1 →
 * g0` es el ciclo y `g2` va después de `g1`, los trabados son tres y el culpable
 * son dos. Decir «tres nodos trabados» manda a mirar a `g2`, que no hizo nada.
 *
 * Termina siempre: cada nodo trabado tiene, por definición de «trabado», al menos
 * una dependencia todavía sin emitir, así que el paseo nunca se queda sin próximo
 * y en un conjunto finito tiene que repetir. Y es determinista porque en cada
 * paso elige la dependencia MENOR: sin ese desempate, dos nodos con dos ciclos
 * distintos reportarían uno u otro según el orden del array.
 */
function buscarCiclo(
  restantes: readonly GoalId[],
  deps: ReadonlyMap<GoalId, readonly GoalId[]>,
  emitido: ReadonlySet<GoalId>,
): readonly GoalId[] {
  const pendientes = [...restantes].sort(comparaId)
  const arranque = pendientes[0]
  if (arranque === undefined) return []
  let actual: GoalId = arranque
  const camino: GoalId[] = []
  const enCamino = new Set<GoalId>()
  while (!enCamino.has(actual)) {
    camino.push(actual)
    enCamino.add(actual)
    const siguientes = (deps.get(actual) ?? []).filter((d) => !emitido.has(d)).sort(comparaId)
    const siguiente = siguientes[0]
    if (siguiente === undefined) return camino
    actual = siguiente
  }
  // Cerrado: el primer nodo repetido aparece a los dos extremos, así que
  // `g0 → g1 → g0` se lee como ciclo y no como camino.
  return [...camino.slice(camino.indexOf(actual)), actual]
}
