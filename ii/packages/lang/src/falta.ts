/**
 * QUÉ FALTA — y son cuatro respuestas distintas, no una.
 *
 * El caso de aceptación del hito lo pide con todas las letras:
 *
 * > tiene que **informar qué falta** distinguiendo las cuatro clases —plano,
 * > habilidad, proceso o física—
 *
 * Hoy `plan()` devuelve `{k:'gap', missing, nearest, why}`, que es **una sola
 * respuesta para cuatro preguntas distintas del cuidador**. Y la diferencia
 * importa muchísimo, porque decide qué puede hacer él:
 *
 * | falta | qué quiere decir | qué puede hacer el cuidador |
 * |---|---|---|
 * | `plano` | se sabe hacer, no se sabe **esta forma** | describirle la forma, o dejarla inventar |
 * | `habilidad` | hay proceso, nadie escribió el **cómo** | esperar a la fragua (Hito 8) |
 * | `proceso` | el mundo **no tiene esa ley** | nada: hace falta escribir física |
 * | `fisica` | ni la materia existe | nada, y conviene decirlo rápido |
 *
 * ─── EL ORDEN DE LAS PREGUNTAS, que es lo único no obvio ────────────────────
 *
 * Va **de abajo hacia arriba**: primero se pregunta si la materia existe, después
 * si hay una ley que la mueva, después si alguien sabe correrla, y recién al
 * final si falta la forma. Al revés daría respuestas prolijas y falsas —«te falta
 * un plano» cuando lo que falta es una sustancia que el mundo no tiene—, que es
 * la peor de las cuatro porque manda al cuidador a intentar algo imposible.
 *
 * ─── LO QUE ESTE ARCHIVO NO PUEDE DECIDIR, y va escrito ─────────────────────
 *
 * La frontera entre `habilidad` y `plano` es **borrosa por construcción** y no
 * por falta de trabajo: desde el ADR II-0023 una obra se publica como
 * `EsquemaDeObra`, así que «no hay esquema» y «no hay plano registrado» son el
 * mismo hecho visto de dos lados. Se resuelve con una regla declarada y no con
 * una adivinanza: **si la firma es GEOMÉTRICA, falta un plano; si no, falta una
 * habilidad**. Una cualidad de geometría —`catch`, `reach`, `jointCount`,
 * `freeStrandEnds`— sólo se consigue armando algo, y armar algo es lo que un
 * plano describe.
 */

import type { Physics, QualityId, Tag } from '@anima/physics'
import { interpretar } from '@anima/plan'
import type { PlannerCatalogView } from '@anima/plan'
import type { ClaseDeFalta } from './tipos.js'

export interface Falta {
  readonly clase: ClaseDeFalta
  readonly firma: string
  /** En castellano, para el cuidador. No repite la firma: la explica. */
  readonly enVozAlta: string
}

/**
 * Las cualidades que sólo se consiguen ARMANDO algo.
 *
 * No es una lista de gustos: son las que `Predicado` clasifica como
 * `k: 'geometria'` más `catch` y `reach`, que son derivadas de la forma del
 * cuerpo. Ninguna sustancia las trae puestas — una vara sola no tiene `catch`,
 * y una vara atada a una hebra sí.
 */
const DE_LA_FORMA: readonly string[] = ['catch', 'reach', 'jointCount', 'freeStrandEnds', 'longestAxis']

/**
 * La cualidad de la que habla una firma, si habla de una.
 *
 * Devuelve `undefined` para las GEOMETRICAS, y eso costo un rojo: `jointCount`
 * y `freeStrandEnds` **no son `QualityId`**. Son funciones de la forma del
 * cuerpo, y el catalogo cerrado de `quality.ts` no las tiene. La primera version
 * las devolvia con un `as QualityId` y el porton de la fisica —«esta cualidad no
 * existe en este mundo»— las clasificaba a las dos como `fisica`, que es la
 * respuesta que le dice al cuidador que no hay nada que hacer.
 */
function cualidadDe(firma: string): QualityId | undefined {
  const p = interpretar(firma)
  if (p === undefined) return undefined
  return p.k === 'cualidad' ? p.test.q : undefined
}

/** La funcion de geometria de la que habla una firma, si habla de una. */
function geometriaDe(firma: string): string | undefined {
  const p = interpretar(firma)
  if (p === undefined) return undefined
  return p.k === 'geometria' ? p.f : undefined
}

/** El tag del que habla una firma `holding(tag:X)`, si habla de uno. */
function tagDe(firma: string): Tag | undefined {
  const p = interpretar(firma)
  if (p === undefined) return undefined
  return p.k === 'sostiene' ? (p.tag as Tag) : undefined
}

/**
 * QUÉ FALTA PARA ESTA FIRMA.
 *
 * `catalogo` es opcional porque la respuesta más útil —«falta una habilidad»—
 * necesita saber qué hay publicado, y quien pregunta no siempre lo tiene. Sin
 * catálogo, este archivo contesta igual con las tres clases que sólo dependen de
 * la física, y nunca dice `habilidad`: preferir el silencio a una clase inventada
 * es la misma regla que `objetivos.ts` aplica al `bindeaSlot`.
 */
export function faltaDe(
  firma: string,
  phys: Physics,
  catalogo?: PlannerCatalogView,
): Falta {
  // ── 0 · ¿LA FIRMA SIQUIERA SE PUEDE LEER?
  //
  // Va antes que todo y es la señal más fuerte de las cuatro: si `interpretar`
  // devuelve `undefined`, no es que falte una habilidad — es que la firma habla
  // de algo que este mundo no tiene ni nombre para nombrar. Sin este portón,
  // «magnetismo>=1» salía clasificado como «falta un proceso», que le diría al
  // cuidador que se puede arreglar escribiendo una ley. No se puede.
  if (interpretar(firma) === undefined) {
    return {
      clase: 'fisica',
      firma,
      enVozAlta: 'eso no existe en este mundo: no sé ni cómo se llamaría',
    }
  }

  // ── 1 · ¿EXISTE LA MATERIA? Es la pregunta de más abajo y va primero.
  const tag = tagDe(firma)
  if (tag !== undefined) {
    let cuantas = 0
    for (const s of phys.substances.values()) if (s.tags.includes(tag)) cuantas++
    if (cuantas === 0) {
      return {
        clase: 'fisica',
        firma,
        enVozAlta: `no hay nada de eso en este mundo: ninguna materia es «${tag}»`,
      }
    }
  }

  const q = cualidadDe(firma)
  if (q !== undefined && !phys.qualities.some((spec) => spec.id === q)) {
    return {
      clase: 'fisica',
      firma,
      enVozAlta: `«${q}» no es una propiedad que este mundo tenga`,
    }
  }

  // ── 2 · ¿HAY UNA LEY QUE LA MUEVA? Sin proceso que la establezca, ninguna
  //        habilidad ni ningún plano pueden inventarla.
  let algunProceso = false
  for (const p of phys.processes.values()) {
    for (const e of p.establishes) {
      if (e === firma) algunProceso = true
      else if (q !== undefined && e.startsWith(q)) algunProceso = true
      else if (geometriaDe(firma) !== undefined && e.startsWith(geometriaDe(firma) as string)) {
        algunProceso = true
      }
    }
  }

  // ── 3 · ¿ALGUIEN SABE CORRERLA? Con catálogo se puede contestar; sin él, no
  //        se inventa.
  const publicada =
    catalogo === undefined
      ? undefined
      : catalogo.coreSchemas.some((e) => e.establishes === firma) ||
        catalogo.buildCapabilities.some((c) => c.esquema.establishes === firma) ||
        catalogo.skillCapabilities.some((c) => c.esquema.establishes === firma)

  if (publicada === true) {
    // Hay quien la establece y aun así no salió un plan: lo que falta no es
    // saber, son las condiciones. Se dice así y no se inventa una clase.
    return {
      clase: 'habilidad',
      firma,
      enVozAlta: 'sé cómo se hace, pero acá y ahora no me dan las cosas',
    }
  }

  // ── 4 · La frontera declarada del encabezado: geometría → plano; si no,
  //        habilidad o proceso según haya ley.
  const g = geometriaDe(firma)
  if ((q !== undefined && DE_LA_FORMA.includes(q)) || g !== undefined) {
    // ─── POR QUE ACA NO SIRVE `algunProceso`, y lo destapo `jointCount>=3` ───
    //
    // La pregunta «¿hay una ley que establezca ESTA firma?» contesta que no para
    // `jointCount`, porque `union` declara `freeStrandEnds>=1`, `reach>=2` y
    // `catch>0` y NO declara `jointCount`. Y la conclusion que salia de ahi —«no
    // hay ninguna ley en este mundo que de esa forma»— es falsa de toda
    // falsedad: atar es exactamente hacer juntas.
    //
    // Para las firmas de la FORMA la pregunta correcta es otra: **¿existe alguna
    // ley que ensamble?** Si el mundo sabe unir dos cuerpos, entonces la forma
    // se puede conseguir y lo que falta es saber CUAL forma — que es un plano.
    // Si no sabe unir nada, ahi si falta una ley.
    let sabeEnsamblar = false
    for (const p of phys.processes.values()) {
      for (const e of p.establishes) {
        for (const f of DE_LA_FORMA) if (e.startsWith(f)) sabeEnsamblar = true
      }
    }
    return sabeEnsamblar
      ? { clase: 'plano', firma, enVozAlta: 'sé atar cosas, pero no sé qué forma tiene lo que me pedís' }
      : { clase: 'proceso', firma, enVozAlta: 'no hay ninguna ley en este mundo que dé esa forma' }
  }

  if (!algunProceso) {
    return {
      clase: 'proceso',
      firma,
      enVozAlta: 'no hay ninguna ley en este mundo que lleve a eso',
    }
  }

  return {
    clase: 'habilidad',
    firma,
    enVozAlta: 'la ley existe, pero nadie escribió todavía cómo usarla para esto',
  }
}

/** Las cualidades de la forma, para que un test las barra. */
export const CUALIDADES_DE_LA_FORMA = DE_LA_FORMA
