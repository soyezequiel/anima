// INNATA 16/16 · «construir» — armar una obra siguiendo un plano. El BuildSkill.

import type { BlueprintJoint, BodyView, Ctx, Intent, Outcome, RolesOf, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { enLaMano } from './comun.js'

export const CONTRATO_CONSTRUIR: Contrato = {
  nombre: 'construir',
  // Lo que queda después: un cuerpo con todas las piezas del plano adentro. No se
  // puede decir más que eso acá, y es un dato: lo que la obra LOGRA no sale del
  // plano, sale de la corrida que lo demostró (ADR II-0023).
  establece: [{ sujeto: 'lo-que-devuelve', q: 'existe', op: '>=', v: 1 }],
  precondiciones: [
    // Todo lo que entra en la obra pasa por las manos: `union` pide
    // `arrangement: { k: 'held' }` para sus tres roles. Con N piezas y N−1
    // atadores, una obra de tres piezas ya necesita cinco manos.
    { sujeto: 'yo', q: 'holding', op: '>=', v: 2 },
  ],
  // N−1 uniones, un segundo de mundo cada una. Es la medición del tramo C·bis.
  cuesta: { segundos: 5, commitment: 'reversible' },
  huecos: [
    'NO SE PUEDE DESHACER UNA UNIÓN. Si la tercera de cinco sale mal, lo armado hasta ahí queda armado y no hay forma de recuperar las piezas: `unir` no tiene inversa. Es el mismo hueco que `unir` ya declaraba, y acá duele más porque una obra a medias es materia inmovilizada',
    'NO SE PUEDE SABER SI UNA UNIÓN VA A ATAR LO QUE UNO QUIERE. `unir` siempre ata la parte 0 del cuerpo izquierdo con la parte 0 del derecho, y eso NO está dicho en ninguna parte de la superficie: se descubrió midiendo el motor. Esta habilidad depende de esa regla y no tiene con qué verificarla desde adentro',
    '`ctx.can` NO ANTICIPA LA COTA DE HONDURA. Un plano de cinco piezas en cadena mide profundidad 4 y el ensamble admite 3, así que la última unión devuelve `blocked` cuando ya hay cuatro piezas atadas. Se puede saber ANTES —`definirPlano` lo calcula— y desde acá no, porque la superficie no publica `MAX_ASSEMBLY_DEPTH`',
  ],
}

/**
 * CONTRATO
 *   establece   existe un cuerpo con todas las piezas del plano, atadas como el
 *               plano dice
 *   precondiciones  cada rol ligado a un cuerpo; todos a mano o alcanzables
 *   cuesta      N−1 segundos de mundo, uno por unión; `reversible`
 *
 * ─── EL ALGORITMO, Y ESTÁ MEDIDO ANTES DE ESTAR ESCRITO ─────────────────────
 *
 * `unir(A, B, atador)` ata **la parte 0 de A con la parte 0 de B**, y el resultado
 * conserva la parte 0 de A en el índice 0. O sea que cada obra a medio armar tiene
 * una CABEZA, la unión ata cabeza con cabeza, y la cabeza del resultado es la de
 * la izquierda.
 *
 * De ahí sale la regla entera, en once líneas: **elegir una raíz, armar el
 * subárbol de cada hijo, y atar el hijo al padre**. Cada unión realiza exactamente
 * una arista del plano. No hay que buscar.
 *
 * Está medido en `physics/tests/el-orden-de-las-uniones-realiza-el-plano.test.ts`
 * para estrella, cadena y árbol mixto, con el control de que **encadenar de a una
 * NO sabe armar la cadena**: eso da una estrella con centro en la primera pieza,
 * que es otra obra con las mismas piezas.
 *
 * ─── POR QUÉ LA RAÍZ ES LA PRIMERA POR TEXTO ────────────────────────────────
 *
 * Determinismo, no estética. Dos corridas del mismo plano tienen que producir el
 * mismo cuerpo, con las juntas en el mismo orden, o el hash del mundo depende de
 * en qué orden se recorrió un objeto. Lo mismo vale para el orden de los hijos.
 *
 * ─── EL MODO SIN `b`, QUE ES LA CAÑA ENTERA ────────────────────────────────
 *
 * Cuando el atador de una junta es uno de sus propios extremos, la unión va SIN
 * `b`: el atador sobrevive como parte, atado de un solo lado, con la punta suelta.
 * Esa punta es `freeStrandEnds`, que es lo único que da `catch`, que es lo único
 * que califica para pescar. Con `b` presente el atador se gasta en la junta y no
 * queda ninguna punta.
 *
 * O sea que la diferencia entre las dos formas de llamar a `union` es la
 * diferencia entre una caña y un palo atado a otro palo, y esta habilidad la
 * decide leyendo el plano y no adivinando.
 */
export function* construir(
  ctx: Ctx,
  args: { juntas: readonly BlueprintJoint[]; roles: Readonly<Record<string, BodyView>> },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('construir')

  const { juntas, roles } = args
  if (juntas.length === 0) return fail('el plano no declara ninguna junta: no hay nada que atar')

  // ─── Las piezas son los roles que alguna junta usa como extremo ───────────
  //
  // Un rol que aparece SÓLO como atador se consume y no queda en la obra. Es la
  // misma regla que `definirPlano` aplica del otro lado, y se deriva del uso en
  // vez de declararse (tramo C·bis).
  const piezas: string[] = []
  for (const j of juntas) {
    if (!piezas.includes(j.a)) piezas.push(j.a)
    if (!piezas.includes(j.b)) piezas.push(j.b)
  }
  piezas.sort(comparaTexto)
  if (piezas.length === 0) return fail('el plano no deja ninguna pieza en la obra')

  // ─── Todo lo que entra tiene que estar en la mano ─────────────────────────
  //
  // `union` pide tenencia, no proximidad, para sus tres roles. Se juntan TODOS
  // antes de la primera unión y no de a uno: no hay ningún paso que vuelva a
  // buscar, y una obra a medias con la criatura caminando es materia que quedó
  // inmovilizada por nada.
  for (const rol of Object.keys(roles).sort(comparaTexto)) {
    const cuerpo = roles[rol]
    if (cuerpo === undefined) return fail(`el plano pide el rol «${rol}» y no vino ningún cuerpo`)
    if (enLaMano(ctx.self, cuerpo)) continue
    if (ctx.self.holding.length >= ctx.self.capacity) {
      return fail(`no me entran las piezas en las manos: llevo ${String(ctx.self.holding.length)}`)
    }
    const irA = yield ctx.goTo(cuerpo, { within: 1 })
    if (irA.status !== 'arrived') return fail(`no llegué a ${cuerpo.name}`)
    const t = yield ctx.take(cuerpo)
    if (t.status !== 'done') return fail(`no pude levantar ${cuerpo.name}: ${t.por ?? t.status}`)
  }

  // ─── El post-orden, iterativo ─────────────────────────────────────────────
  //
  // Iterativo y no recursivo porque un generador recursivo necesita `yield*` en
  // cada nivel, y cada `yield*` es un marco más que el ejecutor tiene que
  // suspender y restaurar en cada guardado. La pila explícita cuesta diez líneas
  // y deja la habilidad con un solo marco.
  const vecinos = new Map<string, string[]>()
  for (const p of piezas) vecinos.set(p, [])
  for (const j of juntas) {
    vecinos.get(j.a)?.push(j.b)
    vecinos.get(j.b)?.push(j.a)
  }
  for (const [, l] of vecinos) l.sort(comparaTexto)

  // La obra a medio armar de cada pieza, por su rol. Empieza siendo el cuerpo
  // suelto y se va reemplazando por el ensamble a medida que se ata.
  const obraDe = new Map<string, BodyView>()
  for (const p of piezas) {
    const c = roles[p]
    if (c === undefined) return fail(`el plano pide la pieza «${p}» y no vino ningún cuerpo`)
    obraDe.set(p, c)
  }

  // ─── ELEGIR LA RAÍZ, Y NO ES UNA CUESTIÓN DE GUSTO ────────────────────────
  //
  // El invariante del que depende todo lo de abajo: **la cabeza de cada subárbol
  // tiene que ser su raíz**. `unir(A, B, atador)` deja la parte 0 de A en el
  // índice 0 del resultado, así que atar padre con hijo realiza la arista del
  // plano SÓLO si la cabeza de cada lado es su propia raíz.
  //
  // Con un atador dedicado eso se conserva solo: la cabeza sigue siendo la de la
  // izquierda, que es el padre. **Hay una forma de romperlo**, y es el caso de la
  // caña llevado un paso más allá: cuando el atador de una junta es uno de sus
  // propios extremos, la unión va SIN `b` y el atador no puede ir de izquierda
  // —`unir(x, undefined, x)` no es nada— así que la cabeza queda en el OTRO
  // extremo. Si ese rol era el padre, el ensamble queda con la cabeza equivocada y
  // la unión siguiente ata las piezas que no son.
  //
  // Medido, con un plano de cuatro roles donde la aguja es atador-extremo de una
  // junta y además cuelga de otra pieza: `realizaElPlano` daba dos razones.
  //
  // La reparación es orientar el árbol: **un atador que además es extremo tiene
  // que quedar de HIJO en esa junta**. Se prueban todas las raíces —el ensamble
  // admite seis piezas, así que son seis intentos de una BFS de seis nodos— y se
  // toma la primera que cumple. Si ninguna cumple, el plano pide que un mismo rol
  // sea hijo de dos padres, que en un árbol no existe: se dice y se falla.
  let bajada: { readonly padre: string; readonly hijo: string }[] | undefined
  let alcanzados = 0
  for (const candidata of piezas) {
    const intento: { padre: string; hijo: string }[] = []
    const vistos = new Set<string>([candidata])
    const cola: string[] = [candidata]
    while (cola.length > 0) {
      const v = cola.shift()
      if (v === undefined) break
      for (const c of vecinos.get(v) ?? []) {
        if (vistos.has(c)) continue
        vistos.add(c)
        intento.push({ padre: v, hijo: c })
        cola.push(c)
      }
    }
    if (vistos.size > alcanzados) alcanzados = vistos.size
    if (vistos.size !== piezas.length) continue
    const sirve = intento.every((paso) => {
      const j = juntaEntre(juntas, paso.padre, paso.hijo)
      if (j === undefined) return false
      // Si el atador no es extremo, cualquier orientación va. Si lo es, tiene que
      // ser el hijo: es el único que puede quedar sin la cabeza.
      return j.binder !== paso.padre
    })
    if (sirve) {
      bajada = intento
      break
    }
  }

  if (alcanzados !== piezas.length) {
    return fail('las juntas del plano no conectan todas las piezas: son dos obras y no una')
  }
  if (bajada === undefined) {
    return fail(
      'este plano no se puede armar: tiene un rol que ata y además es pieza en más de una junta, ' +
        'y ése tendría que quedar de hijo en las dos a la vez',
    )
  }
  const raiz = bajada.length === 0 ? piezas[0] : bajada[0]?.padre
  if (raiz === undefined) return fail('el plano no deja ninguna pieza en la obra')

  for (let i = bajada.length - 1; i >= 0; i--) {
    const paso = bajada[i]
    if (paso === undefined) continue
    const junta = juntaEntre(juntas, paso.padre, paso.hijo)
    if (junta === undefined) return fail(`el plano no dice con qué atar «${paso.padre}» y «${paso.hijo}»`)

    const padre = obraDe.get(paso.padre)
    const hijo = obraDe.get(paso.hijo)
    if (padre === undefined || hijo === undefined) return fail('se perdió una obra a medio armar')

    // ─── LOS DOS MODOS, decididos leyendo el plano ──────────────────────────
    //
    // Si el atador es uno de los dos extremos, la unión va SIN `b`: el atador
    // sobrevive con la punta suelta. Si es un rol aparte, va CON `b` y se gasta.
    const atadorEsExtremo = junta.binder === junta.a || junta.binder === junta.b
    const atador = atadorEsExtremo ? obraDe.get(junta.binder) : roles[junta.binder]
    if (atador === undefined) return fail(`no vino ningún cuerpo para el atador «${junta.binder}»`)

    // El mismo peaje de tipos que paga `unir`: con `exactOptionalPropertyTypes`,
    // `{ b: algoQuePuedeSerUndefined }` no compila. Ver el hueco 2 de `unir`.
    const conEse = atadorEsExtremo ? (junta.binder === paso.padre ? hijo : padre) : padre
    const rolesDeLaUnion: RolesOf<'union'> = atadorEsExtremo
      ? { binder: atador, a: conEse }
      : { binder: atador, a: padre, b: hijo }

    const v = ctx.can('union', rolesDeLaUnion)
    if (!v.ok) {
      if (v.por === 'rol-no-cumple') return fail(`el atador «${junta.binder}» no sirve: ${v.why}`)
      if (v.por === 'arreglo-incorrecto') return fail('las piezas no están todas en la mano')
      return fail(`no puedo atar «${paso.padre}» con «${paso.hijo}»: ${v.why}`)
    }

    const r = yield ctx.apply('union', rolesDeLaUnion)
    if (r.status !== 'done') return fail(`la unión de «${paso.padre}» y «${paso.hijo}» salió ${r.por ?? r.status}`)
    const ensamble = r.got[0]
    if (ensamble === undefined) return fail(`la unión de «${paso.padre}» y «${paso.hijo}» no devolvió ningún cuerpo`)

    // El ensamble pasa a SER las dos piezas: cualquiera de las dos que aparezca
    // más arriba en el árbol tiene que encontrarlo.
    obraDe.set(paso.padre, ensamble)
    obraDe.set(paso.hijo, ensamble)
  }

  const obra = obraDe.get(raiz)
  return obra === undefined ? fail('la obra se armó y no quedó ningún cuerpo') : done(obra)
}

/** La junta que ata estos dos roles, sin importar de qué lado quedó cada uno. */
function juntaEntre(
  juntas: readonly BlueprintJoint[],
  x: string,
  y: string,
): BlueprintJoint | undefined {
  for (const j of juntas) {
    if ((j.a === x && j.b === y) || (j.a === y && j.b === x)) return j
  }
  return undefined
}

/** Sin `localeCompare`: el orden no puede depender del idioma del sistema. */
function comparaTexto(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}
