// ─── QUÉ SE GUARDA DE UNA PARTIDA, Y QUÉ NO ─────────────────────────────────
//
// El verificable del Hito 10 dice *«cerrar y reabrir la pestaña a mitad de una
// obra no pierde el mundo y la habilidad converge»*. Las dos mitades de esa
// frase son cosas distintas y la segunda es la que decide el diseño.
//
// ─── LA ACTIVIDAD EN VUELO NO SE GUARDA. Es el ADR 0009, y el plan lo repite ─
//
// > **No se serializan generadores ni fronteras.** Al cargar, **se replanifica
// > de forma idempotente**.
//
// Un generador de JavaScript no se puede serializar —no hay forma de guardar en
// qué `yield` quedó— y fingir que sí, guardando un número de paso, produce
// exactamente el bug que `SkillRun.step` ya previene con una excepción: una
// habilidad que cree que llegó a un lugar donde nunca estuvo.
//
// Así que «la habilidad converge» NO quiere decir «la habilidad sigue donde
// estaba». Quiere decir: **la criatura restaurada vuelve a planificar sobre el
// mundo que quedó y llega al mismo resultado**. Es una promesa más fuerte y más
// barata: no hay estado a mitad de camino que pueda quedar inconsistente.
//
// ─── LO QUE SÍ SE GUARDA SON CUATRO COSAS, Y LAS DOS ÚLTIMAS SE AGREGARON ───
//
//   el mundo        `worldSlots` / `restoreWorld`, del Hito 2. Ya existía.
//   el catálogo     el overlay de la sesión. Ya tiene su manifiesto (Gate 5→6).
//   LAS CREENCIAS   lo que la criatura aprendió — y esto NO existía.
//   LA CHARLA       de qué estuvieron hablando — y esto tampoco (C1, versión 2).
//
// La cuarta es el mismo hueco que la tercera, un nivel más arriba: sin ella, una
// partida restaurada se acuerda de dónde estaban las cosas y de si le rindieron,
// y **no de lo que le pediste hace tres turnos**. El log conversacional es lo que
// el tramo de convergencia hace durable, y el resto de sus capas —episodios,
// retrieval— se apoyan en él y son de C2.
//
// La tercera está escrita como hueco desde el Hito 5, en `mind/src/tipos.ts`:
//
//   > un replay desde el journal reconstruye el mundo y **NO las creencias**. La
//   > criatura revivida se acuerda de dónde estaban las cosas y no de si le
//   > rindieron.
//
// Ese hueco es justamente lo que el punto 6 del criterio mide en ticks: sin las
// creencias, una segunda vida tarda lo mismo que la primera, y la herencia no
// compró nada.

import { Creencias } from '@anima/mind'
import type { CreenciaVolcada } from '@anima/mind'
// `import type` y no un import normal, y no es estilo: con `verbatimModuleSyntax`
// la línea entera se borra al compilar, así que este paquete **no gana una arista
// en tiempo de ejecución**. Sigue valiendo lo que el guardián de al lado exige:
// guardar es del estado y tiene que poder correr sin una corrida viva.
import type { Dicho, EncargoGuardado } from '@anima/lang'
import { restoreWorld, worldSlots } from '@anima/world'
import type { WorldState } from '@anima/world'

import { loQueNoAguanta } from './deposito.js'
import type { Deposito } from './deposito.js'

/**
 * LA VERSIÓN DEL FORMATO DE GUARDADO.
 *
 * Sube cuando cambia la FORMA de lo que se escribe, no cuando cambia el mundo.
 * Un save de una versión que esta build no sabe leer se rechaza con su número al
 * lado en vez de explotar tres capas más abajo con «no se puede leer la propiedad
 * de undefined», que es el error que hace que nadie sepa que el problema era el
 * formato.
 *
 * ─── LA 2 AGREGÓ LA CHARLA, Y POR ESO HAY MIGRACIÓN Y NO RECHAZO ───────────
 *
 * La 1 guardaba el mundo y las creencias. La 2 suma el log conversacional (el C1
 * de la convergencia). Una partida guardada con la 1 **no se tira**: entra con la
 * charla vacía, que es exactamente lo que tenía. Rechazarla sería borrarle el
 * mundo a alguien por una lista que ese guardado nunca pudo tener.
 *
 * ─── Y LA 3 SUMA EL ENCARGO (C3) ───────────────────────────────────────────
 *
 * Mismo criterio: una partida de la 1 o de la 2 entra sin encargo, que es lo que
 * tenía. La diferencia con la charla es que el encargo **puede no estar** aunque
 * el guardado sea de la 3 —una partida sin nada pedido no tiene ninguno—, así que
 * su ausencia no distingue una versión de la otra y por eso es opcional.
 */
export const VERSION_DEL_GUARDADO = 3

/**
 * UNA PARTIDA GUARDADA, en datos planos.
 *
 * `mundo` son las ranuras de `worldSlots` como pares, y no un `Map`: un `Map` se
 * convierte en `{}` al pasar por JSON, en silencio y sin lanzar. Es el mismo
 * motivo por el que `SlotPair` existe del lado del mundo.
 */
export interface Guardado {
  readonly version: number
  /** El tick en que se guardó. Sale del mundo, no de ningún reloj de sistema. */
  readonly tick: number
  readonly mundo: readonly (readonly [string, unknown])[]
  /** Lo que la criatura aprendió, sin el instinto adentro. Ver `Creencias.volcar`. */
  readonly creencias: readonly CreenciaVolcada[]
  /**
   * LA CONVERSACIÓN, entera y en orden — la cuarta ranura, del C1.
   *
   * Es `CanalDeHabla.todo`: las cinco clases en una sola lista, cada línea con su
   * turno. Se guarda por lo mismo que las creencias: **sin esto, reabrir la
   * pestaña le restaura el mundo a la criatura y le borra de qué estaban
   * hablando**, y eso se ve como alguien que te vuelve a preguntar lo que acabás
   * de contestarle.
   *
   * Y es lo que hace que la memoria de la charla sea una VISTA y no un segundo
   * almacén: `memoriaDe()` la deriva de acá.
   */
  readonly charla: readonly Dicho[]
  /**
   * EL ENCARGO EN CURSO — la quinta ranura, del C3. Ausente si no hay ninguno.
   *
   * Es el grafo del pedido con lo que ya se probó, y **no** la actividad en
   * vuelo: el `Plan` sigue sin guardarse y se reconstruye contra el mundo que
   * quedó (ver el encabezado de este archivo). Lo que viaja es qué se pidió y
   * qué parte de eso el mundo ya dio por cumplida.
   */
  readonly encargo?: EncargoGuardado
  /**
   * QUIÉN ES. Va guardado porque restaurar sin saber a quién restaurar no sirve,
   * y porque la herencia del punto 5 empieza por acá.
   */
  readonly quien: string
}

/**
 * UN GUARDADO VIEJO, AL DÍA. Lanza si es de una versión que nadie sabe leer.
 *
 * Una función y no un `if` copiado en los tres lectores: `comoSeRestaura`,
 * `loQueHereda` y quien venga después tienen que estar de acuerdo sobre qué se
 * puede leer, o una partida se restaura y no se hereda.
 */
function alDia(g: Guardado): Guardado {
  if (g.version === VERSION_DEL_GUARDADO) return g
  // La 1 no tenía charla y la 2 no tenía encargo. `?? []` y no `[]` a secas: un
  // guardado a medio migrar es un dato que existe, y perderlo en silencio sería
  // peor. El encargo no se rellena: no tenerlo es un estado legítimo.
  if (g.version === 1 || g.version === 2) {
    return { ...g, version: VERSION_DEL_GUARDADO, charla: g.charla ?? [] }
  }
  throw new RangeError(
    `este guardado es de la versión ${String(g.version)} y esta build lee la ${String(VERSION_DEL_GUARDADO)}`,
  )
}

/**
 * LA PARTIDA COMO DATO. No toca el depósito: quien puede esperar la manda.
 *
 * Es la misma frontera de siempre. Esta función es sincrónica y pura, así que se
 * puede probar sin depósito, y lo que la prueba es lo que importa: que lo que
 * sale AGUANTA el viaje.
 */
export function comoSeGuarda(
  state: WorldState,
  creencias: Creencias,
  quien: string,
  charla: readonly Dicho[] = [],
  encargo?: EncargoGuardado,
): Guardado {
  const g: Guardado = {
    version: VERSION_DEL_GUARDADO,
    tick: state.tick,
    mundo: [...worldSlots(state).entries()],
    creencias: [...creencias.volcar()],
    charla: [...charla],
    ...(encargo === undefined ? {} : { encargo }),
    quien,
  }
  // ─── LA PUERTA, Y NO ES UN ASSERT DE LUJO ────────────────────────────────
  //
  // El modo de falla de guardar mal es CALLADO: `JSON.stringify` de un `Map`
  // devuelve `{}` sin lanzar. Sin esta puerta, guardar un mundo con una
  // estructura que no aguanta «funciona», y lo que se descubre tres semanas
  // después es que la partida restaurada no tiene cuerpos. Cuesta un recorrido
  // por guardado, y guardar no pasa por el tick.
  const mal = loQueNoAguanta(g)
  if (mal !== '') {
    throw new TypeError(
      `esto no sobrevive a un guardado: ${mal}. Lo que no aguanta el viaje por JSON no sirve para IndexedDB`,
    )
  }
  return g
}

/** Lo restaurado: mundo, creencias y charla. La habilidad en vuelo NO vuelve: ver el encabezado. */
export interface Restaurado {
  readonly state: WorldState
  readonly creencias: Creencias
  /** El log conversacional. Vacío si el guardado es de la versión 1. */
  readonly charla: readonly Dicho[]
  /** El encargo en curso. Ausente si no había ninguno o si el guardado es viejo. */
  readonly encargo?: EncargoGuardado
}

export function comoSeRestaura(guardado: Guardado): Restaurado {
  const g = alDia(guardado)
  const creencias = new Creencias()
  // `cargar` SUMA sobre el instinto que el constructor ya puso, y no reemplaza.
  // El porqué está en `Creencias.volcar`: el prior de fábrica es de la heredera.
  creencias.cargar(g.creencias)
  return {
    state: restoreWorld(new Map(g.mundo)),
    creencias,
    charla: g.charla,
    ...(g.encargo === undefined ? {} : { encargo: g.encargo }),
  }
}

/**
 * CUÁNTO VALE LO QUE TE CONTARON, contra lo que viste vos.
 *
 * ─── POR QUÉ ESTE NÚMERO EXISTE, y por qué no es el del ADR ────────────────
 *
 * El ADR 0009 pide que el conocimiento heredado entre *«con confianza limitada
 * (≤0.65)»*, y **ese número no se puede aplicar acá**: 4 de las 5 filas del
 * instinto de fábrica ya están por encima de 0,65 (`INSTINTO`, medias 0,25 y
 * 0,75). Aplicarlo dejaría a la heredera menos segura que una recién nacida, o
 * sea que heredar la haría peor. Ver `Creencias.cargar`.
 *
 * ─── DE DÓNDE SALE EL 0,5, Y QUÉ GARANTIZA ────────────────────────────────
 *
 * De lo que hay que garantizar, que es lo único que el ADR de verdad pide: **que
 * el testimonio valga menos que la evidencia propia**. Y hay una medición que
 * dice cuán poco margen hay: una vida entera de esta criatura produce **UNA sola
 * observación** (medido en el punto 6 del Hito 10 — consigue su meta una vez).
 * Con un solo dato por vida, cualquier peso de 1 haría que lo que le contaron
 * pese exactamente lo mismo que todo lo que vivió.
 *
 * La mitad es el peso más grande que todavía deja «lo vi yo» estrictamente por
 * encima de «me lo contaron», que es la frase del ADR hecha número. No sale de
 * una medición y **se dice**: es una decisión, y el día que una vida produzca
 * cien observaciones en vez de una habrá con qué calibrarla.
 */
export const PESO_DEL_TESTIMONIO = 0.5

/** La clave de un guardado en el depósito. Una función y no un template suelto: se usa de los dos lados. */
export function claveDe(quien: string, ranura = 'ultimo'): string {
  return `partida/${quien}/${ranura}`
}

/**
 * Guardar de verdad. Acá SÍ hay un `await`, y por eso este paquete existe.
 *
 * `charla` entró ANTES que `ranura` y no después, aunque `ranura` sea más vieja:
 * la charla se pasa siempre y la ranura no la pasa nadie (se midió: cero
 * llamadores en todo el árbol). Un parámetro que se usa siempre detrás de uno que
 * no se usa nunca obliga a escribir `undefined` en el medio en cada llamada.
 */
export async function guardar(
  d: Deposito,
  state: WorldState,
  creencias: Creencias,
  quien: string,
  charla: readonly Dicho[] = [],
  encargo?: EncargoGuardado,
  ranura?: string,
): Promise<Guardado> {
  const g = comoSeGuarda(state, creencias, quien, charla, encargo)
  await d.poner(claveDe(quien, ranura), g)
  return g
}

/** Traer lo guardado. `undefined` cuando no hay nada: no estar es una respuesta. */
export async function cargar(d: Deposito, quien: string, ranura?: string): Promise<Restaurado | undefined> {
  const raw = await d.leer(claveDe(quien, ranura))
  if (raw === undefined) return undefined
  return comoSeRestaura(raw as Guardado)
}

/**
 * LO QUE LA HEREDERA RECIBE, que NO es lo que la antecesora tenía.
 *
 * Es la otra mitad del punto 5 del Hito 10 —«ninguna credencial regalada»— y la
 * diferencia con `comoSeRestaura` es de una palabra del ADR 0009: *«El legado es
 * **testimonio**, no memoria»*.
 *
 * Restaurar es acordarse: la misma criatura vuelve, y lo que vivió lo vivió.
 * Heredar es que te cuenten: entra al mismo casillero y **pesa menos**. Ver
 * `PESO_DEL_TESTIMONIO`.
 *
 * ─── EL MUNDO NO SE HEREDA, Y POR ESO ACÁ NO ESTÁ ──────────────────────────
 *
 * Una heredera nace en SU mundo, no en el cadáver del anterior. Devolver el
 * `WorldState` guardado sería revivir la partida de la antecesora con otra
 * criatura adentro, que es lo contrario de una sucesión. Lo único que cruza de
 * una vida a la otra es el testimonio.
 */
export function loQueHereda(guardado: Guardado, peso = PESO_DEL_TESTIMONIO): Creencias {
  const g = alDia(guardado)
  const c = new Creencias()
  c.cargar(g.creencias, peso)
  return c
}

/** La heredera de lo que haya guardado `quien`. `undefined` si no hay nada. */
export async function heredarDe(d: Deposito, quien: string, ranura?: string): Promise<Creencias | undefined> {
  const raw = await d.leer(claveDe(quien, ranura))
  if (raw === undefined) return undefined
  return loQueHereda(raw as Guardado)
}
