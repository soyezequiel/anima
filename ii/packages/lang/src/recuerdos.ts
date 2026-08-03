/**
 * LA MEMORIA EPISÓDICA DE LA CHARLA — y no es un almacén, es una VISTA.
 *
 * El C2 de [la convergencia](../../../../docs/product/convergencia-conversacional.md)
 * pide «resúmenes compactos de promesas, preferencias, enseñanzas, decisiones y
 * resultados», cada uno con `sourceTurnIds`, procedencia, confianza y vigencia.
 *
 * ─── LA DECISIÓN, y el repo ya la había tomado dos veces ────────────────────
 *
 * **Los recuerdos se DERIVAN del log durable; no se guardan aparte.** No es una
 * preferencia de estilo:
 *
 * - `perceive/src/lugares.ts` rechazó `ctx.remember(...)` con este argumento
 *   escrito: sería *«una tercera sede de estado que sobrevive a un guardado»*, y
 *   una habilidad que tiene que acordarse de acordarse se olvida en silencio;
 * - el catálogo de una partida **sale de la crónica**, que es una sola lista
 *   append-only con dos lectores, y no de una variable que alguien mantiene.
 *
 * Acá pasa lo mismo y se gana lo mismo: no hay dos verdades sobre lo que se
 * habló, no hay nada nuevo que guardar ni que migrar, y **la procedencia sale
 * gratis** — el turno del que salió cada recuerdo es su fuente, y está ahí.
 *
 * Y da un control negativo que de otro modo no existiría: con el mismo mundo y el
 * log vacío, no se recuerda nada. Si los recuerdos vivieran aparte, ese control
 * daría verde sin probar nada.
 *
 * ─── LA TABLA, que es todo lo que hay que saber para leer este archivo ──────
 *
 * Cada línea del log se relabela. No hay juicio ni modelo en el medio: es una
 * función de la clase del `Dicho` y de si trae `meta` o `sobre`.
 *
 * | línea del log | condición | recuerdo | procedencia |
 * |---|---|---|---|
 * | `entrada` | con `meta` | `pedido` | cuidador |
 * | `entrada` | sin `meta` | `dicho` | cuidador |
 * | `acuse` | | `promesa` | agente |
 * | `progreso` | con `sobre` | `hecho` | **mundo** |
 * | `progreso` | sin `sobre` | `decision` | agente |
 * | `listo` | | `resultado` | agente |
 * | `aviso` | | `aviso` | agente |
 *
 * ─── LA REGLA DE PROMOCIÓN, que es la fila más importante de la tabla ───────
 *
 * **Una `entrada` sin meta es un `dicho`, y un `dicho` nunca es un `hecho`.**
 * Ahí caen las afirmaciones del cuidador —«hay un pescado acá»— y las
 * enseñanzas. El documento lo pide con todas las letras: *«Una frase del cuidador
 * o del modelo nunca se promueve por sí sola a hecho del mundo»*.
 *
 * `hecho` tiene una sola fuente y es el mundo: sale de lo que la criatura HIZO,
 * anotado después del tick y con el cuerpo al lado. Es la misma frontera que el
 * resto del proyecto sostiene —el modelo propone, el código local dispone— leída
 * del lado del cuidador.
 *
 * ─── LA VIGENCIA es el tick, y no hace falta un campo ───────────────────────
 *
 * Cada `Dicho` ya trae el tick en que se dijo, y la regla la escribió el libro de
 * lugares: **un recuerdo viejo es una hipótesis**. Acá no se le pone fecha de
 * vencimiento a nada porque el que sabe cuánto vale un recuerdo de hace mil ticks
 * es el que pregunta, no el que guarda.
 */

import type { Dicho } from './habla.js'
import { comparaClaves, tokenizar } from './normalizar.js'

/**
 * Las siete clases. Son las cinco del documento —promesas, preferencias,
 * enseñanzas, decisiones y resultados— mapeadas a lo que ESTE chat produce, que
 * es lo único que se puede derivar sin inventar.
 *
 * `preferencia` y `ensenanza` no están, y es a propósito: hoy no hay forma
 * determinista de distinguir «me gusta el pescado» de «hay un pescado acá», así
 * que las dos entran como `dicho` con su texto entero. Partirlas pide un
 * clasificador, y un clasificador que se equivoca convierte una charla en una
 * creencia falsa. Cuando exista, sale de acá y no de otro almacén.
 */
export type ClaseDeRecuerdo = 'pedido' | 'dicho' | 'promesa' | 'decision' | 'hecho' | 'resultado' | 'aviso'

/** De dónde salió. Es lo que separa lo que le contaron de lo que vio. */
export type Procedencia = 'cuidador' | 'agente' | 'mundo'

export interface Recuerdo {
  readonly clase: ClaseDeRecuerdo
  readonly texto: string
  /**
   * DE QUÉ TURNOS SALIÓ. Plural, y por eso es una lista.
   *
   * Los repetidos se funden: «agarró madera» tres veces es UN recuerdo con tres
   * turnos, no tres recuerdos. Es la compactación que hace de esto un resumen y
   * no una copia del log — y es la misma que Ánima I ya hacía («choqué contra el
   * muro ×3»), que ahí estaba medida y acá sale de fundir por (clase, texto).
   */
  readonly turnos: readonly number[]
  readonly procedencia: Procedencia
  /** En `[0, 1]`. Lo observado vale 1; lo dicho vale lo que se entendió. */
  readonly confianza: number
  /** El tick del turno más NUEVO que lo sostiene. La vigencia se lee de acá. */
  readonly tick: number
  /** Cuántas veces pasó. Uno salvo que se hayan fundido repetidos. */
  readonly veces: number
  readonly sobre?: string
  /** La meta que pidió, si era un pedido. Es lo que se recupera. */
  readonly meta?: string
}

/** Lo que la criatura VIO vale uno; no hay grado en un hecho del mundo. */
const CONFIANZA_DE_LO_VISTO = 1

/**
 * Lo que vale una línea del agente sin confianza propia.
 *
 * No es 1 ni 0: un acuse es una promesa —«dale, voy»— y una promesa no es un
 * hecho. Medio es lo que dice «esto lo dijo ella y todavía no lo probó el mundo»,
 * y está escrito acá para que se pueda discutir en un solo lugar.
 */
const CONFIANZA_DE_UNA_PROMESA = 0.5

function claseYProcedencia(d: Dicho): { readonly clase: ClaseDeRecuerdo; readonly procedencia: Procedencia } {
  switch (d.clase) {
    case 'entrada':
      return { clase: d.meta === undefined ? 'dicho' : 'pedido', procedencia: 'cuidador' }
    case 'acuse':
      return { clase: 'promesa', procedencia: 'agente' }
    case 'progreso':
      // La única fila cuya procedencia es el mundo, y lo que la distingue es el
      // cuerpo: `sobre` sale de mirar el estado después del tick.
      return d.sobre === undefined
        ? { clase: 'decision', procedencia: 'agente' }
        : { clase: 'hecho', procedencia: 'mundo' }
    case 'listo':
      return { clase: 'resultado', procedencia: 'agente' }
    case 'aviso':
      return { clase: 'aviso', procedencia: 'agente' }
  }
}

function confianzaDe(d: Dicho, procedencia: Procedencia): number {
  if (procedencia === 'mundo') return CONFIANZA_DE_LO_VISTO
  return d.confianza ?? CONFIANZA_DE_UNA_PROMESA
}

/**
 * LOS RECUERDOS DE UN LOG, del más viejo al más nuevo.
 *
 * Determinista y sin estado: el mismo log da la misma lista, que es lo que
 * permite guardarlo una vez y derivar esto cuantas veces haga falta.
 */
export function recuerdosDe(log: readonly Dicho[]): readonly Recuerdo[] {
  const porLlave = new Map<string, Recuerdo>()
  const orden: string[] = []

  for (const d of log) {
    const { clase, procedencia } = claseYProcedencia(d)
    // ─── LA BARRA, Y NO UN CARÁCTER INVISIBLE ───────────────────────────────
    //
    // Acá había un NUL, que es el separador «obvio» porque no aparece en ningún
    // texto. **El guardián de `world/tests/sin-nombres-especiales.test.ts` lo
    // encontró**, y tiene razón: un carácter que no se ve no se puede revisar, y
    // un `git diff` que lo cambie por otro no muestra nada. Es la misma regla que
    // `normalizar.ts` declara para las marcas combinantes.
    //
    // La barra sirve igual: `clase` sale de una unión cerrada que no la contiene,
    // así que la primera siempre cierra la clase y dos pares distintos no pueden
    // dar la misma llave.
    const llave = `${clase}|${d.texto}`
    const previo = porLlave.get(llave)
    const r: Recuerdo = {
      clase,
      texto: d.texto,
      turnos: previo === undefined ? [d.turno] : [...previo.turnos, d.turno],
      procedencia,
      confianza: confianzaDe(d, procedencia),
      tick: d.tick,
      veces: previo === undefined ? 1 : previo.veces + 1,
      ...(d.sobre === undefined ? {} : { sobre: d.sobre }),
      ...(d.meta === undefined ? {} : { meta: d.meta }),
    }
    if (previo === undefined) orden.push(llave)
    porLlave.set(llave, r)
  }

  const out: Recuerdo[] = []
  for (const llave of orden) {
    const r = porLlave.get(llave)
    if (r !== undefined) out.push(r)
  }
  return out
}

/**
 * EL ÚLTIMO PEDIDO QUE SE PUEDA RECUPERAR. Es lo que «lo que te pedí» señala.
 *
 * Una búsqueda exacta y no el retrieval léxico de abajo, y la diferencia importa:
 * «lo que te pedí» no es una consulta difusa, es una referencia a un turno
 * concreto. Devolver el más parecido en vez del último sería contestar otra cosa
 * con cara de acierto.
 */
export function loQuePidio(log: readonly Dicho[]): Dicho | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const d = log[i]
    if (d !== undefined && d.clase === 'entrada' && d.meta !== undefined) return d
  }
  return undefined
}

// ─── EL RETRIEVAL ───────────────────────────────────────────────────────────

/**
 * QUÉ SE BUSCA. El documento lo arma con cuatro cosas —el mensaje de ahora, el
 * encargo activo, las entidades referenciadas y la percepción— y acá entran las
 * tres primeras: la percepción no se mezcla porque el log no habla de celdas.
 */
export interface QueBuscar {
  readonly texto: string
  /** Ids de cuerpos que la frase señala. Un turno que los nombra pesa más. */
  readonly entidades?: readonly string[]
  readonly topeDeTurnos?: number
  readonly topeDeRecuerdos?: number
}

export interface LoRecuperado {
  readonly turnos: readonly Dicho[]
  readonly recuerdos: readonly Recuerdo[]
  /** Cuántas líneas se miraron. Sin esto, un tope no se puede auditar. */
  readonly mirados: number
}

/**
 * CUÁNTO VUELVE, y los dos números son DECISIONES y no mediciones.
 *
 * Se dice porque este proyecto distingue las dos cosas: un número medido tiene su
 * corrida al lado y éstos no la tienen. Salen de para qué sirve el retrieval —
 * resolver una elipsis mira el turno que la creó, no la conversación entera— y de
 * que el historial durable **no se copia entero a cada prompt**, que es la regla
 * que el documento fija para toda esta capa.
 *
 * El día que haya un prompt de verdad al que alimentar, se miden contra él.
 */
export const TOPE_DE_TURNOS = 3
export const TOPE_DE_RECUERDOS = 5

/**
 * CUÁNTO PESA UN TÉRMINO, sin `Math.log`.
 *
 * La fórmula de siempre para esto es la IDF, `log(N/df)`, y **`Math.log` está
 * prohibido en `src/`**: ECMAScript no especifica su precisión, así que dos
 * motores pueden devolver el último bit distinto y con eso dos máquinas ordenan
 * distinto el mismo log. Esto es una función racional con la misma forma —cae
 * cuando el término aparece en más líneas— y es exacta en todos lados.
 *
 * Lo que compra: **las palabras de relleno se apagan solas**. «lo», «que» y «te»
 * están en casi todas las líneas, así que pesan casi nada sin que nadie escriba
 * una lista de palabras vacías — que es justo la lista que envejece mal y que
 * habría que escribir en castellano rioplatense a mano.
 */
function peso(n: number, df: number): number {
  return (n - df + 1) / (df + 1)
}

/**
 * LOS TURNOS Y RECUERDOS QUE MÁS TIENEN QUE VER, con tope.
 *
 * Coincidencia léxica determinista, que es el piso que el documento fija:
 * *«embeddings o reordenamiento por LLM son una mejora posterior, no un requisito
 * de este tramo»*.
 */
export function recuperar(log: readonly Dicho[], q: QueBuscar): LoRecuperado {
  const terminos = new Set(tokenizar(q.texto))
  const n = log.length
  if (n === 0 || terminos.size === 0) return { turnos: [], recuerdos: [], mirados: n }

  // Cuántas líneas contienen cada término. Una pasada, y se reusa para todas.
  const df = new Map<string, number>()
  const porLinea: (readonly string[])[] = []
  for (const d of log) {
    const ts = [...new Set(tokenizar(d.texto))]
    porLinea.push(ts)
    for (const t of ts) if (terminos.has(t)) df.set(t, (df.get(t) ?? 0) + 1)
  }

  const entidades = new Set(q.entidades ?? [])
  const puntos: { readonly d: Dicho; readonly punto: number }[] = []
  for (const [i, d] of log.entries()) {
    let punto = 0
    for (const t of porLinea[i] ?? []) {
      if (!terminos.has(t)) continue
      punto += peso(n, df.get(t) ?? 1)
    }
    // Un turno que habla de un cuerpo que la frase señala vale más aunque no
    // comparta una palabra: «el otro» no dice «madera» en ningún lado.
    if (d.sobre !== undefined && entidades.has(d.sobre)) punto += peso(n, 1)
    if (punto > 0) puntos.push({ d, punto })
  }

  // Por puntaje; a igual puntaje gana el más nuevo, y a igual turno no hay
  // empate posible. Sin `localeCompare` y sin depender del orden de un `Map`.
  puntos.sort((a, b) => (b.punto - a.punto) || (b.d.turno - a.d.turno))

  const turnos = puntos.slice(0, q.topeDeTurnos ?? TOPE_DE_TURNOS).map((x) => x.d)
  // Los recuerdos salen de los turnos que ganaron, no de otro barrido: así lo
  // que se cita y lo que se recuperó no pueden discrepar.
  const recuerdos = recuerdosDe([...turnos].sort((a, b) => a.turno - b.turno)).slice(
    0,
    q.topeDeRecuerdos ?? TOPE_DE_RECUERDOS,
  )
  return { turnos, recuerdos, mirados: n }
}

/** Los términos de un texto, para que un test pueda ver qué se comparó. */
export function terminosDe(texto: string): readonly string[] {
  return [...new Set(tokenizar(texto))].sort(comparaClaves)
}
