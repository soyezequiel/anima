/**
 * EL VEREDICTO — Hito 7, tramo F. Puntos 1 y 6.
 *
 * Va último a propósito. El banco (tramo D) y la ablación (tramo E) se
 * escribieron antes porque **un juez que pone notas antes de tener con qué
 * medirlas siempre dice que sí**.
 *
 * ─── LO QUE ESTE ARCHIVO ARREGLA, y es lo que faltaba de verdad ─────────────
 *
 * Hasta acá el juez leía `outcome.ok`, que es **lo que la habilidad dice de sí
 * misma**. Una que devuelve `done()` sin haber tocado el mundo pasaba entera.
 *
 * El cargo `uso` no le cree: agarra el `establece` del contrato —que es la
 * promesa, escrita como dato— y lo verifica **contra el mundo que quedó**.
 * Prometer y cumplir dejan de ser lo mismo.
 *
 * ─── LOS CUATRO CARGOS, contra una habilidad y no contra un artefacto ───────
 *
 * El caso de aceptación los nombra pensando en algo que se fabrica: plano ·
 * construcción · uso · utilidad. Una innata no tiene plano ni se construye, así
 * que la traducción hay que escribirla y no dar por obvia:
 *
 * | cargo | para un artefacto | acá |
 * |---|---|---|
 * | `plano` | ¿es armable con la materia que existe? | ¿el contrato se puede sintetizar? |
 * | `construccion` | ¿la habilidad que lo arma termina? | ¿termina donde debe, y NO termina donde no debe? |
 * | `uso` | ¿hace lo que promete? | ¿su `establece` quedó cierto en el mundo? |
 * | `utilidad` | ¿sirve de algo? | **no se puede medir todavía** — ver abajo |
 *
 * ─── EL PUNTO 1 SALE SOLO DEL CARGO `construccion` ──────────────────────────
 *
 * > una habilidad que **sólo funciona donde la corrigieron** no promueve
 *
 * No hace falta un mecanismo aparte. El banco trae el mundo `holgado` (todo a
 * favor) y el `al-borde` (cumple por el pelo), y la diferencia entre los dos ES
 * la pregunta:
 *
 *   anduvo en el holgado y falló en el al-borde  →  aprendió el caso
 *   anduvo en los dos                            →  sabe
 *
 * Y la otra mitad, que se olvida: **tiene que FALLAR en los adversos**. Una que
 * dice que sí siempre aprueba todos los mundos amables y no sirve para nada.
 *
 * ─── POR QUÉ `utilidad` SALE `inconcluso`, y no es una excusa ───────────────
 *
 * Porque «sirve» es una pregunta con respecto a algo, y ese algo es un objetivo.
 * Hasta el Hito 8 nadie le pide nada a una habilidad: las innatas están para
 * medir si la API alcanza, no para cumplir metas.
 *
 * Medirlo igual exigiría inventar un criterio de utilidad acá adentro, que es
 * exactamente lo que este hito viene evitando en todos los tramos. `inconcluso`
 * quiere decir «se miró y no alcanza para decidir», y es la verdad.
 *
 * Es además el primer productor de ese grado: hasta este archivo existía como
 * palabra y no lo devolvía nadie.
 */

import { qualityOf } from '@anima/physics'
import type { Physics, QualityId } from '@anima/physics'
import type { Predicado } from '@anima/skills/innatas'
import type { WorldState } from '@anima/world'
import { bancoDe } from './banco.js'
import type { MundoDelBanco } from './banco.js'
import { correrEn } from './ablacion.js'
import type { Corrio, Sujeto } from './ablacion.js'
import { EL_ACTOR } from './escena.js'
import { mundoConObjetivo } from './escena.js'
import { sintetizable } from './sintetizar.js'
import { cumpleElPredicado } from './sintetizar.js'
import { elPeor, SIN_CORRER } from './tipos.js'
import type { Cargo, Dictamen, Grado, Regresion, Veredicto } from './tipos.js'

/** Lo que el cargo `uso` no sabe leer, contado en vez de disimulado. */
export interface Promesa {
  readonly predicado: string
  readonly cumplio: boolean | undefined
  readonly medido: number | undefined
}

/**
 * ¿QUEDÓ CIERTO ESTO EN EL MUNDO?
 *
 * `undefined` cuando este archivo no sabe leerlo, y eso NO cuenta como
 * incumplido: contar como fallo algo que no se supo mirar es fabricar rojos.
 *
 * Los dos sujetos que se leen son `yo` y `el-objetivo`. `lo-que-devuelve` habla
 * del `got` del `Outcome` y `la-celda` de la celda donde quedó parada — los dos
 * se pueden agregar; hoy se cuentan como no leídos y el número sale en el
 * veredicto.
 */
function verificar(p: Predicado, st: WorldState, objetivoId: string | undefined, phys: Physics): Promesa {
  const clave = `${p.sujeto}:${p.q}${p.op}${String(p.v)}`
  const nada: Promesa = { predicado: clave, cumplio: undefined, medido: undefined }

  const actor = st.actors.get(EL_ACTOR)
  if (actor === undefined) return nada

  // `holding` es una RELACIÓN que guarda el mundo, no una cualidad de la
  // materia: se cuenta, no se le pregunta a la física.
  if (p.q === 'holding') {
    const v = actor.holding.length
    return { predicado: clave, cumplio: cumpleElPredicado(p, v), medido: v }
  }

  const cuerpoId = p.sujeto === 'yo' ? actor.body : p.sujeto === 'el-objetivo' ? objetivoId : undefined
  if (cuerpoId === undefined) return nada
  const wb = st.bodies.get(cuerpoId)
  if (wb === undefined) {
    // Que el objetivo YA NO ESTÉ no es «no se pudo leer»: para `existe` es la
    // respuesta, y para el resto es un incumplimiento honesto.
    return { predicado: clave, cumplio: p.q === 'existe' ? cumpleElPredicado(p, 0) : false, medido: 0 }
  }
  if (p.q === 'existe') return { predicado: clave, cumplio: cumpleElPredicado(p, 1), medido: 1 }
  if (p.q === 'at' || p.q === 'permits') return nada

  try {
    const v = qualityOf(wb.body, p.q as QualityId, phys)
    return { predicado: clave, cumplio: cumpleElPredicado(p, v), medido: v }
  } catch {
    return nada
  }
}

export interface CorridaJuzgada {
  readonly mundo: MundoDelBanco
  readonly corrio: Corrio
  /** Lo que se esperaba: llegar en los amables, no llegar en los adversos. */
  readonly comoDebia: boolean
  readonly promesas: readonly Promesa[]
}

/** Corre la habilidad en todo el banco y verifica sus promesas contra el mundo. */
export function correrElBanco<A>(s: Sujeto<A>, phys: Physics): readonly CorridaJuzgada[] {
  const out: CorridaJuzgada[] = []
  for (const m of bancoDe(s.acusada.contrato, phys)) {
    const corrio = correrEn(s, m, phys)
    const llego = corrio.desenlace === 'llego'

    // Las promesas sólo se miran donde la habilidad DIJO que llegó: un
    // `establece` no promete nada sobre una corrida que falló.
    let promesas: readonly Promesa[] = []
    if (llego) {
      const p = mundoConObjetivo(m, phys)
      const args = s.argsDe(p)
      if (args !== undefined) {
        // La celda, igual que en `correrEn`. Ver `Sujeto.cell`.
        const v =
          s.cell === undefined
            ? p.volar(EL_ACTOR, s.skill, args)
            : p.volar(EL_ACTOR, s.skill, args, { cell: s.cell })
        let t = 0
        while (!v.terminado && t < 40) {
          p.tick()
          t++
        }
        promesas = s.acusada.contrato.establece.map((x) => verificar(x, p.state, m.objetivo?.id, phys))
      }
    }

    out.push({ mundo: m, corrio, comoDebia: llego === m.deberiaCumplir, promesas })
  }
  return out
}

function veredicto(cargo: Cargo, grado: Grado, porque: string, cs: readonly CorridaJuzgada[]): Veredicto {
  const adversos = cs.filter((c) => c.mundo.adverso)
  return {
    cargo,
    grado,
    porque,
    corrida: {
      mundos: cs.length,
      aprobados: cs.filter((c) => c.comoDebia).length,
      adversos: adversos.length,
      adversosAprobados: adversos.filter((c) => c.comoDebia).length,
    },
  }
}

export function juzgar<A>(s: Sujeto<A>, phys: Physics): Dictamen {
  const nombre = s.acusada.nombre

  // ─── plano ───────────────────────────────────────────────────────────────
  // Corta antes de correr nada: si el contrato no se puede sintetizar, no hay
  // mundo donde probarla y todo lo demás mediría otra cosa. Y el punto 3 del
  // criterio: **sin regresiones**, porque nunca corrió nada.
  const sint = sintetizable(s.acusada.contrato, phys)
  if (sint.k === 'no') {
    return {
      habilidad: nombre,
      cargos: [veredicto('plano', 'injuzgable', sint.porque, [])],
      grado: 'injuzgable',
      regresiones: [],
    }
  }

  const cs = correrElBanco(s, phys)
  const amables = cs.filter((c) => !c.mundo.adverso)
  const adversos = cs.filter((c) => c.mundo.adverso)

  const cargos: Veredicto[] = [
    veredicto('plano', 'promueve', `se sintetiza con ${sint.objetivo.substance}/${sint.objetivo.form}`, cs),
  ]

  // ─── construcción · acá vive el punto 1 ──────────────────────────────────
  const fallaronAmables = amables.filter((c) => !c.comoDebia)
  const pasaronAdversos = adversos.filter((c) => !c.comoDebia)
  const soloDondeLeConviene =
    fallaronAmables.some((c) => c.mundo.clase === 'al-borde') &&
    amables.some((c) => c.mundo.clase === 'holgado' && c.comoDebia)

  cargos.push(
    veredicto(
      'construccion',
      fallaronAmables.length === 0 && pasaronAdversos.length === 0 ? 'promueve' : 'no-promueve',
      soloDondeLeConviene
        ? 'SÓLO FUNCIONA DONDE LE CONVIENE: anduvo en el holgado y falló apenas se apretó'
        : pasaronAdversos.length > 0
          ? `anduvo en ${String(pasaronAdversos.length)} mundo(s) donde su propio contrato dice que no puede`
          : fallaronAmables.length > 0
            ? `no llegó en ${String(fallaronAmables.length)} mundo(s) que debería resolver`
            : `llegó en los ${String(amables.length)} amables y se plantó en los ${String(adversos.length)} adversos`,
      cs,
    ),
  )

  // ─── uso · la promesa contra el mundo, no contra el `outcome` ────────────
  const todas = cs.flatMap((c) => c.promesas)
  const rotas = todas.filter((p) => p.cumplio === false)
  const noLeidas = todas.filter((p) => p.cumplio === undefined)
  cargos.push(
    veredicto(
      'uso',
      todas.length === 0
        ? 'inconcluso'
        : rotas.length > 0
          ? 'no-promueve'
          : noLeidas.length === todas.length
            ? 'inconcluso'
            : 'promueve',
      todas.length === 0
        ? 'no llegó en ningún mundo, así que no prometió nada'
        : rotas.length > 0
          ? `DIJO QUE SÍ Y NO ES CIERTO: ${rotas.map((p) => p.predicado).join(', ')}`
          : `${String(todas.length - noLeidas.length)} de ${String(todas.length)} promesas verificadas contra el mundo` +
            (noLeidas.length > 0 ? ` · ${String(noLeidas.length)} el juez no las sabe leer todavía` : ''),
      cs,
    ),
  )

  // ─── utilidad · honestamente, inconcluso ────────────────────────────────
  cargos.push({
    cargo: 'utilidad',
    grado: 'inconcluso',
    porque: 'no hay contra qué: nadie le pide nada a una habilidad hasta que haya objetivos (Hito 8)',
    corrida: SIN_CORRER,
  })

  // ─── las regresiones ────────────────────────────────────────────────────
  // Una por mundo que salió distinto de lo que debía, con el mundo entero
  // citado por su id — que es lo único que hace falta para rearmarlo, porque
  // el banco es determinista.
  const regresiones: Regresion[] = cs
    .filter((c) => !c.comoDebia)
    .map((c) => ({
      habilidad: nombre,
      cargo: 'construccion' as const,
      semilla: c.mundo.id,
      queSeEspera: c.mundo.deberiaCumplir ? 'que llegue' : 'que NO llegue',
    }))

  return { habilidad: nombre, cargos, grado: elPeor(cargos.map((c) => c.grado)), regresiones }
}
