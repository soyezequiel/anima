/**
 * QUÉ TENÍAN EN COMÚN LOS MUNDOS DONDE FALLÓ — Hito 8, la segunda mitad del
 * punto 9.
 *
 * ─── El problema, medido contra el modelo de verdad ─────────────────────────
 *
 * La devolución del juez a la fragua era una cuenta:
 *
 *     construccion: no llegó en 12 mundo(s) que debería resolver
 *
 * El modelo lee eso y **no tiene con qué arreglarlo**. Medido: la vuelta 2 salió
 * igual que la vuelta 1 (1 de 4 mundos reservados), y no porque no supiera
 * escribir código —las candidatas compilaban— sino porque el mensaje no dice
 * QUÉ tienen en común esos doce.
 *
 * ─── Y no se puede arreglar diciendo CUÁLES ─────────────────────────────────
 *
 * Ésa es la trampa del punto 9, decidida en el tramo D: *si se le cuentan los
 * mundos donde falló, aprende los mundos y no la habilidad*. La tabla de aquella
 * decisión ya nombraba el nivel correcto, y es exactamente éste:
 *
 *   | el qué y el porqué | «funciona sólo con la materia que practicaste» | ELEGIDO |
 *
 * O sea: **una propiedad, no una lista de mundos**. Este archivo la busca.
 *
 * ─── LAS TRES REGLAS, y las tres salieron de medir ──────────────────────────
 *
 * **1. Se compara DENTRO de cada grupo.** El primer intento comparaba los que
 * fallan contra los que andan, mezclando amables y adversos, y con
 * `soloVaras` —una habilidad que sólo sabe agarrar varas— **no separaba nada**:
 * la forma `malla` aparecía entre los que fallan (un amable) y entre los que
 * andan (un adverso que rechazó bien). Separando por `deberiaCumplir`, la misma
 * habilidad da la línea exacta: *«sólo falla con malla, bloque, filete»*.
 *
 * **2. El lado que ANDA tiene que tener valores en ese eje.** Con `mentirosa`
 * —la que dice que sí sin hacer nada— salían SIETE separadores, todos ciertos y
 * todos inútiles: los mundos que no rechaza son los `justo-abajo`, que son
 * homogéneos, y su único acierto entre los adversos es `sin-nada`, que **no
 * tiene materia**. O sea que el lado que anda no aportaba un solo valor con qué
 * contrastar, y sin contraste todo «separa».
 *
 * La primera versión de esta regla decía otra cosa —«descartar los que enumeran
 * más de medio eje»— y estaba mal: con `soloVaras` la pista buena es
 * `mal = {malla, bloque, filete}` contra `bien = {vara}`, tres de cuatro, y la
 * mataba. Quedó anotado porque el error es fácil de repetir: **lo que hace vacua
 * a una pista no es cuánto enumera, es contra qué se compara.**
 *
 * **3. Primero lo que el contrato NOMBRA.** `portable` está en las
 * precondiciones de `sostener`: fallar ahí es fallar en lo que la habilidad
 * misma dijo que necesitaba. Eso va antes que una correlación de forma o de
 * sustancia, y no es una preferencia de estilo — es la única de las siete que
 * habla de la promesa.
 */

import { qualityOf } from '@anima/physics'
import type { Body, Physics, QualityId } from '@anima/physics'
import type { Contrato } from '@anima/skills/innatas'
import type { CorridaJuzgada } from './juzgar.js'

/**
 * LOS EJES QUE SE MIRAN, y por qué la masa entra una sola vez.
 *
 * La sonda la leía dos veces —`masa`, del `part`, y `mass`, de la física— y
 * salían dos líneas idénticas. Va la de la física, que es la que la habilidad
 * puede leer con `ctx.q`: decirle al modelo un número que no puede consultar no
 * le sirve de nada.
 */
const EJES_DE_FORMA: readonly string[] = ['sustancia', 'forma']

export interface Pista {
  /** En cuál de los dos grupos apareció. Son problemas distintos. */
  readonly grupo: 'deberia-llegar' | 'deberia-plantarse'
  readonly rasgo: string
  readonly valores: readonly string[]
  /** El único valor con el que SÍ anda, si es uno solo. Ver la regla 2. */
  readonly loQueSiAnda: string | undefined
  /** ¿El contrato nombra este rasgo? Ver la regla 3. */
  readonly loNombraElContrato: boolean
}

function rasgosDe(o: Body | undefined, quiereVer: readonly string[], phys: Physics): Record<string, string> {
  if (o === undefined) return {}
  const partes = (o as unknown as { parts: { substance: string }[] }).parts
  const r: Record<string, string> = {
    sustancia: partes[0]?.substance ?? '?',
    forma: (o as unknown as { form: string }).form,
  }
  for (const q of quiereVer) {
    try {
      r[q] = qualityOf(o, q as QualityId, phys).toFixed(3)
    } catch {
      // La cualidad no aplica a esta materia. No es un fallo: es que ese eje no
      // existe para este cuerpo, y un eje que no existe no separa nada.
    }
  }
  return r
}

function pistasDeUnGrupo(
  cs: readonly CorridaJuzgada[],
  grupo: Pista['grupo'],
  quiereVer: readonly string[],
  delContrato: ReadonlySet<string>,
  phys: Physics,
): readonly Pista[] {
  const mal = cs.filter((c) => !c.comoDebia)
  const bien = cs.filter((c) => c.comoDebia)
  // Sin los dos lados no hay contraste, y sin contraste no hay pista: si falló
  // en todos, lo que separa es «todo», que es lo mismo que nada.
  if (mal.length === 0 || bien.length === 0) return []

  const rMal = mal.map((c) => rasgosDe(c.mundo.objetivo, quiereVer, phys))
  const rBien = bien.map((c) => rasgosDe(c.mundo.objetivo, quiereVer, phys))

  const out: Pista[] = []
  for (const rasgo of new Set(rMal.flatMap((r) => Object.keys(r)))) {
    const enMal = new Set(rMal.map((r) => r[rasgo]).filter((v): v is string => v !== undefined))
    const enBien = new Set(rBien.map((r) => r[rasgo]).filter((v): v is string => v !== undefined))
    if (enMal.size === 0) continue
    if ([...enMal].some((v) => enBien.has(v))) continue

    // REGLA 2: el lado que ANDA tiene que tener valores en este eje.
    //
    // La primera versión de esta regla descartaba «los que enumeran más de medio
    // eje», y estaba mal: con `soloVaras` la pista buena es `mal = {malla,
    // bloque, filete}` contra `bien = {vara}` —tres de cuatro— y la mataba.
    //
    // Lo que de verdad hacía vacuas a las siete pistas de `mentirosa` era otra
    // cosa: su único acierto entre los adversos es `sin-nada`, que **no tiene
    // materia**, así que el lado que anda no tiene ningún valor con qué
    // contrastar. Sin contraste, todo «separa» y nada informa.
    if (enBien.size === 0) continue

    out.push({
      grupo,
      rasgo,
      valores: [...enMal].sort(),
      // Lo que sí anda, cuando es una sola cosa. Es la forma útil del mismo
      // hecho: «sólo anda con vara» le dice al modelo qué mirar; «falla con
      // malla, bloque y filete» le deja la lista para adivinar.
      loQueSiAnda: enBien.size === 1 ? [...enBien][0] : undefined,
      loNombraElContrato: delContrato.has(rasgo),
    })
  }

  // REGLA 3: lo que el contrato nombra va primero. Después, el que menos valores
  // enumera — el que más acota.
  return out.sort((a, b) => {
    if (a.loNombraElContrato !== b.loNombraElContrato) return a.loNombraElContrato ? -1 : 1
    if (a.valores.length !== b.valores.length) return a.valores.length - b.valores.length
    return a.rasgo < b.rasgo ? -1 : 1
  })
}

/**
 * LO QUE TENÍAN EN COMÚN LOS MUNDOS DONDE FALLÓ.
 *
 * Vacío quiere decir que no hay ninguna propiedad que los separe limpiamente, y
 * eso también es información: falló por algo que la materia no explica.
 */
export function pistasDe(cs: readonly CorridaJuzgada[], c: Contrato, phys: Physics): readonly Pista[] {
  const delContrato = new Set(
    [...c.precondiciones, ...c.establece].filter((p) => p.sujeto === 'el-objetivo').map((p) => String(p.q)),
  )
  // Las cualidades que se miran son las del contrato más la masa, que es la que
  // más varía en el banco. Mirar las veintidós sería ruido: la mayoría no
  // cambia entre dos cuerpos de la misma sustancia.
  const quiereVer = [...new Set([...delContrato, 'mass'])].filter((q) => !EJES_DE_FORMA.includes(q))

  return [
    ...pistasDeUnGrupo(
      cs.filter((x) => x.mundo.deberiaCumplir),
      'deberia-llegar',
      quiereVer,
      delContrato,
      phys,
    ),
    ...pistasDeUnGrupo(
      cs.filter((x) => !x.mundo.deberiaCumplir),
      'deberia-plantarse',
      quiereVer,
      delContrato,
      phys,
    ),
  ]
}

/**
 * LA PISTA, EN CASTELLANO LLANO, para que entre al encargo tal cual.
 *
 * Los `porque` del juez se escribieron desde el Hito 7 para que un panel los
 * mostrara sin traducir. Éste se escribe para que un MODELO los pueda usar, que
 * resultó ser el mismo requisito.
 */
export function comoSeLee(p: Pista): string {
  const q = p.valores.length === 1 ? `${p.rasgo} = ${p.valores[0] ?? ''}` : `${p.rasgo} ∈ {${p.valores.join(', ')}}`
  if (p.grupo === 'deberia-plantarse') return `deja pasar lo que no debería cuando ${q}`
  // La forma positiva primero: dice qué mirar en vez de qué evitar.
  return p.loQueSiAnda === undefined
    ? `sólo falla cuando ${q} — con el resto anda, así que el problema es ése`
    : `ANDA sólo con ${p.rasgo} = ${p.loQueSiAnda}, y falla con ${q}. Estás resolviendo un caso, no el problema`
}

/** Las N mejores, ya escritas. Vacío si ninguna propiedad los separa. */
export function loQueTenianEnComun(
  cs: readonly CorridaJuzgada[],
  c: Contrato,
  phys: Physics,
  cuantas = 2,
): readonly string[] {
  return pistasDe(cs, c, phys).slice(0, cuantas).map(comoSeLee)
}
