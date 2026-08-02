// ─── RE-EJECUTAR LAS HABILIDADES Y COMPARAR LA TRAZA ─────────────────────────
//
// El Hito 10 lo pide con todas las letras:
//
//   > replay de 20.000 ticks reproduce el hash exacto **y re-ejecuta las
//   > habilidades comparando la traza**
//
// La primera mitad cumple desde el Hito 2. La segunda no tenía por dónde
// empezar, y el porqué está medido (M2 del criterio):
//
//     interface JournalEntry<I> { tick; seq; intent }     ← eso, y nada más
//
// Una `Intent` es **lo que la habilidad ya produjo**. Replayarla salta la
// habilidad entera: el generador no se vuelve a correr ni una vez.
//
// ─── Y LA MITAD QUE FALTABA NO ES COSMÉTICA ─────────────────────────────────
//
// Un replay de intenciones prueba que **el mundo** es determinista. No prueba
// nada sobre la habilidad. Una habilidad con una fuente de no-determinismo
// adentro pasa ese replay sin despeinarse, porque nunca corre.
//
// Y hay una clase entera de divergencia que el hash del mundo **no puede ver**:
// `ctx.phase()` va a la traza y no toca un solo cuerpo. Dos corridas que emiten
// las mismas intenciones y distintas fases dan el MISMO hash de mundo y trazas
// distintas. Eso es exactamente lo que este módulo caza, y es lo que el control
// del punto 3 del criterio demuestra.
//
// ─── LO QUE ESTE MÓDULO NO HACE, Y POR QUÉ ──────────────────────────────────
//
// **No re-vuela una habilidad desde un registro.** No puede: `Partida.volar`
// recibe una FUNCIÓN —la mente le pasa una clausura con los argumentos ya
// adentro (`aHabilidad` en `@anima/mind`)— y una función no sobrevive a un
// journal. Guardar `(nombre, args)` exigiría que toda habilidad volable fuera
// nombrable y sus argumentos serializables, y hoy no lo son.
//
// Lo que sí se puede, y es lo que el verificable necesita, es **correr la
// simulación de nuevo desde el mismo mundo y comparar las trazas vuelo por
// vuelo**. Las habilidades se re-ejecutan de verdad —el generador corre otra
// vez, entero— y la comparación es la que dice si dieron lo mismo.

import { hashTrace } from '@anima/skills'
import type { ActorId } from '@anima/skills'

/**
 * UN VUELO ATERRIZADO, anotado.
 *
 * Es lo mínimo que hace falta para comparar dos corridas y poder decir DÓNDE
 * divergieron. El `nombre` no participa de la comparación —es texto que arma
 * quien vuela— pero sin él una divergencia dice «el tercer vuelo de ana» y con
 * él dice «`unir(vara+hebra)`», que es la diferencia entre buscar diez minutos
 * y no buscar.
 */
export interface VueloAnotado {
  /** El tick del mundo en que el vuelo ATERRIZÓ. */
  readonly tick: number
  readonly actor: ActorId
  /** Lo que el llamador dijo que era. Vacío si no dijo nada. */
  readonly nombre: string
  /** `hashTrace` de `@anima/skills`, que ya existía y ya se usaba para otra cosa. */
  readonly traza: string
  /** Cuántos pasos avanzó el generador. Parte del informe, no de la llave. */
  readonly pasos: number
  readonly ok: boolean
}

/** En qué se diferencian dos corridas, dicho en el primer lugar donde se separan. */
export type Divergencia =
  | {
      readonly k: 'traza'
      readonly i: number
      readonly tick: number
      readonly actor: ActorId
      readonly nombre: string
      readonly esperada: string
      readonly obtenida: string
    }
  | {
      readonly k: 'otro-vuelo'
      readonly i: number
      readonly esperado: string
      readonly obtenido: string
    }
  | { readonly k: 'faltan'; readonly i: number; readonly cuantos: number }
  | { readonly k: 'sobran'; readonly i: number; readonly cuantos: number }

/**
 * DÓNDE SE SEPARAN DOS CORRIDAS. Vacío quiere decir que dieron lo mismo.
 *
 * ─── CORTA EN LA PRIMERA, y es la misma decisión que `replay` ya tomó ────────
 *
 * `replay` de `@anima/world` lleva checkpoints justamente para cortar en el
 * primer tick que no da, y su comentario explica por qué: *«la diferencia entre
 * encontrar un bug de determinismo en diez minutos y no encontrarlo nunca suele
 * ser exactamente ésta»*. Acá vale igual, y más: una divergencia temprana hace
 * divergir todo lo que sigue, así que devolver cuatrocientas es devolver una
 * sola con ruido encima.
 */
export function compararVuelos(
  esperados: readonly VueloAnotado[],
  obtenidos: readonly VueloAnotado[],
): readonly Divergencia[] {
  const n = Math.min(esperados.length, obtenidos.length)
  for (let i = 0; i < n; i++) {
    const a = esperados[i]
    const b = obtenidos[i]
    if (a === undefined || b === undefined) continue
    // El vuelo tiene que ser EL MISMO antes de comparar su traza: dos trazas
    // distintas de dos habilidades distintas no son una divergencia de traza,
    // son otra corrida. Decirlo con el mismo nombre confundiría el diagnóstico.
    if (a.tick !== b.tick || a.actor !== b.actor || a.nombre !== b.nombre) {
      return [{ k: 'otro-vuelo', i, esperado: comoSeLee(a), obtenido: comoSeLee(b) }]
    }
    if (a.traza !== b.traza) {
      return [
        { k: 'traza', i, tick: a.tick, actor: a.actor, nombre: a.nombre, esperada: a.traza, obtenida: b.traza },
      ]
    }
  }
  if (obtenidos.length < esperados.length) {
    return [{ k: 'faltan', i: n, cuantos: esperados.length - obtenidos.length }]
  }
  if (obtenidos.length > esperados.length) {
    return [{ k: 'sobran', i: n, cuantos: obtenidos.length - esperados.length }]
  }
  return []
}

/** Un vuelo en una línea, para el mensaje de la divergencia. */
export function comoSeLee(v: VueloAnotado): string {
  return `tick ${String(v.tick)} · ${v.actor} · ${v.nombre === '' ? '(sin nombre)' : v.nombre} · traza ${v.traza}`
}

/**
 * Una divergencia en castellano, para que el `expect` diga qué pasó.
 *
 * Va acá y no en el test porque el test no es el único que la va a leer: el
 * Hito 11 pone estos números en CI, y un fallo de CI que dice `[object Object]`
 * no lo mira nadie.
 */
export function porQueDivergen(d: Divergencia): string {
  switch (d.k) {
    case 'traza':
      return (
        `el vuelo ${String(d.i)} (tick ${String(d.tick)}, ${d.actor}, ${d.nombre}) corrió otra vez y dejó OTRA traza: ` +
        `${d.esperada} → ${d.obtenida}. El mundo puede haber quedado igual: una fase no toca ningún cuerpo`
      )
    case 'otro-vuelo':
      return `el vuelo ${String(d.i)} no es el mismo: se esperaba «${d.esperado}» y salió «${d.obtenido}»`
    case 'faltan':
      return `la segunda corrida se quedó corta: faltan ${String(d.cuantos)} vuelos desde el ${String(d.i)}`
    case 'sobran':
      return `la segunda corrida voló ${String(d.cuantos)} veces de más desde el ${String(d.i)}`
  }
}

/** El hash de una traza, re-exportado para que quien anota no tenga que importar el ejecutor. */
export { hashTrace }
