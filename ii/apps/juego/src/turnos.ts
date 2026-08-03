// ─── LA CHARLA SE AGRUPA EN TURNOS ──────────────────────────────────────────
//
// El registro por dentro **sigue siendo plano** y así lo escribe el mundo: una
// lista de `Dicho` con su clase y su turno. Esto no lo cambia — es una VISTA, y
// vive aparte por la misma razón que `criatura.ts` y `con-quien.ts`: es lo único
// de la pantalla con decisiones adentro, así que se prueba sin navegador.
//
// ─── QUÉ PROBLEMA RESUELVE, QUE NO ES DE ESTÉTICA ──────────────────────────
//
// Pintado plano, **el costo de leer la charla crece con el tiempo de partida**:
// cada línea de progreso empuja a la anterior, las tres voces compiten, y para
// saber en qué anda hay que releer todo desde el último pedido. Agrupado, hay un
// solo bloque abierto y siempre mide lo mismo: leer cuesta igual al minuto uno
// que a la hora tres.
//
// ─── LAS CUATRO REGLAS DEL AGRUPADO ────────────────────────────────────────
//
//   1. una `entrada` ABRE un turno, y es la única clase que lo hace. Sale de
//      `quienDijo`, no de un campo nuevo: guardar un «acá empieza» al lado sería
//      un segundo dato que puede contradecir al primero;
//   2. todo lo que sigue le PERTENECE, hasta la próxima `entrada`;
//   3. `acuse`, `aviso` y `listo` son LA RESPUESTA, y son una sola línea: **la
//      última gana**. El desenlace importa más que el acuse de recibo, así que
//      «listo» reemplaza a «dale, voy» en vez de apilarse debajo;
//   4. `progreso` NO es respuesta. Es lo que `ordenes.ts` ya tenía escrito —una
//      acotación verificable, no una frase del personaje— y por eso va a la
//      lista de pasos y no al cuerpo del turno.
//
// ─── Y UN QUINTO CASO QUE EL LOG SÍ PRODUCE ────────────────────────────────
//
// **Turnos huérfanos.** El canal se recorta a cien líneas por arriba, así que un
// log restaurado puede empezar por un `progreso` o por un `listo` sin su
// `entrada`. Tirarlos sería esconder lo que la criatura hizo porque el pedido se
// perdió; se juntan en un turno sin pedido, que se lee como lo que es.

import type { Dicho } from '@anima/lang'

/** Los tres estados de un paso, y son los tres colores de la charla. */
export type EstadoDelPaso = 'hecho' | 'en-curso' | 'pendiente'

export interface Paso {
  readonly texto: string
  readonly estado: EstadoDelPaso
  /**
   * EL TURNO DEL `Dicho` DEL QUE SALIÓ, cuando salió de uno.
   *
   * Falta en las cláusulas del encargo, y esa ausencia dice algo: una cláusula
   * no es una línea del log —es lo que el pedido pidió, leído del encargo— así
   * que no tiene identidad en la conversación y no se la puede ir a buscar.
   */
  readonly turno?: number
  /**
   * EL CUERPO DEL QUE HABLA ESTE PASO, si habla de uno. Viene de `Dicho.sobre`.
   *
   * Su ausencia es lo que distingue un HECHO de un ANUNCIO, y esa distinción no
   * la inventa esta capa: la declara `Dicho.sobre` —«el cuerpo del que habla
   * esta línea, si habla de uno»—. «agarró madera» habla de una vara; «voy por
   * «fuego» (1 de 2)» no habla de ningún cuerpo porque todavía no pasó nada.
   */
  readonly sobre?: string
}

export interface Turno {
  /** El turno del `Dicho` que lo abrió. Es su identidad y no se mueve nunca. */
  readonly turno: number
  /** Lo que pediste, tal cual. Falta en el turno huérfano. */
  readonly pedido?: string
  /**
   * LO ÚLTIMO QUE CONTESTÓ, con su turno. Falta mientras no haya contestado.
   *
   * Va con su turno adentro y no como dos campos sueltos: el turno es la
   * identidad de ESA línea y no la del pedido que la provocó. Separados, la
   * primera vez que alguien pinte la respuesta con el turno del turno, dos
   * nodos del registro comparten identidad y «nada se repite» deja de poder
   * afirmarse. Pasó, y lo encontró el spec de la recarga.
   */
  readonly respuesta?: { readonly turno: number; readonly texto: string }
  readonly pasos: readonly Paso[]
  /** El último es el ABIERTO: es el único que se muestra entero. */
  readonly abierto: boolean
}

/**
 * LO QUE EL ENCARGO EN CURSO SABE Y EL LOG NO.
 *
 * El log guarda pasado: cada `progreso` es algo que YA pasó, así que por sí solo
 * la lista de pasos sería toda de tildes. Los otros dos estados —lo que está
 * haciendo y lo que falta— sólo existen mientras hay un encargo abierto, y el
 * encargo los tiene: sus nodos son las cláusulas del pedido y `hechos` dice
 * cuáles probó el mundo.
 *
 * `turnos` es lo que ata las dos cosas sin adivinar: el encargo guarda de qué
 * turnos del log salió (es su procedencia, la misma idea del C2), así que las
 * cláusulas se cuelgan del turno que las pidió y no «del último», que sería
 * verdad casi siempre y mentira justo cuando alguien dice algo en el medio.
 */
export interface ElEncargoAbierto {
  readonly turnos: readonly number[]
  readonly clausulas: readonly Paso[]
}

const RESPUESTAS = new Set(['acuse', 'aviso', 'listo'])

export function agrupar(
  registro: readonly Dicho[],
  encargo?: ElEncargoAbierto,
): readonly Turno[] {
  interface Armando {
    turno: number
    pedido?: string
    respuesta?: { turno: number; texto: string }
    pasos: Paso[]
  }
  const turnos: Armando[] = []
  let actual: Armando | undefined

  for (const d of registro) {
    if (d.clase === 'entrada') {
      actual = { turno: d.turno, pedido: d.texto, pasos: [] }
      turnos.push(actual)
      continue
    }
    // El huérfano: lo que llegó antes de la primera `entrada` del log que quedó.
    // Se le pone el turno de su primera línea, que sigue siendo una identidad
    // que no se repite.
    if (actual === undefined) {
      actual = { turno: d.turno, pasos: [] }
      turnos.push(actual)
    }
    if (RESPUESTAS.has(d.clase)) {
      actual.respuesta = { turno: d.turno, texto: d.texto }
      continue
    }
    actual.pasos.push({
      texto: d.texto,
      estado: 'hecho',
      turno: d.turno,
      ...(d.sobre === undefined ? {} : { sobre: d.sobre }),
    })
  }

  // ─── LAS CLÁUSULAS, Y LO QUE SU LLEGADA VUELVE REDUNDANTE ───────────────
  //
  // Van DESPUÉS de lo que ya hizo, que es el orden en que pasan: primero lo
  // hecho, después lo que está haciendo, al final lo que falta.
  //
  // Y al llegar se llevan puestos LOS ANUNCIOS. Con más de una cláusula, el log
  // trae además un «voy por «fuego» (1 de 2)» por cada una, que es exactamente
  // lo que la lista dice —pero dicho en prosa, y con un tilde que MIENTE: eso no
  // se hizo, se anunció. Dos filas para lo mismo, y una de las dos con el estado
  // equivocado.
  //
  // La distinción se lee del dato y no del texto: un `progreso` SIN `sobre` no
  // habla de ningún cuerpo, o sea que no cuenta algo que pasó en el mundo. Nunca
  // se filtra por lo que la frase dice, porque el día que alguien reescriba esa
  // frase el filtro deja de morder sin que nada se ponga rojo.
  if (encargo !== undefined && encargo.clausulas.length > 0) {
    const suyo = turnos.find((t) => encargo.turnos.includes(t.turno))
    if (suyo !== undefined) {
      suyo.pasos = suyo.pasos.filter((p) => p.sobre !== undefined)
      suyo.pasos.push(...encargo.clausulas)
    }
  }

  return turnos.map((t, i) => ({
    turno: t.turno,
    ...(t.pedido === undefined ? {} : { pedido: t.pedido }),
    ...(t.respuesta === undefined ? {} : { respuesta: t.respuesta }),
    pasos: t.pasos,
    abierto: i === turnos.length - 1,
  }))
}

/**
 * LAS CLÁUSULAS DEL ENCARGO, con sus tres estados.
 *
 * `enCastellano` entra por parámetro y no se importa: vive en `ordenes.ts`, que
 * es quien habla con `@anima/lang`, y este archivo no tiene por qué depender de
 * la clase entera para traducir una firma. Es lo mismo que `lexicoDe` hace con
 * el puente, y por el mismo motivo — así esto se prueba con una tabla de dos
 * entradas en vez de con media aplicación.
 *
 * La que está EN CURSO se identifica por su firma y no por su posición: el
 * encargo es un orden PARCIAL —los nodos declaran `after`, no una fila— así que
 * «la siguiente sin hacer» sería inventar una secuencia que el dato no promete.
 */
export function clausulasDe(
  encargo: {
    readonly nodos: readonly { readonly id: string; readonly meta: string }[]
    readonly hechos: readonly { readonly nodo: string }[]
  },
  metaEnCurso: string | undefined,
  enCastellano: (firma: string) => string,
): readonly Paso[] {
  // Con una sola cláusula la lista no agrega nada: el pedido ya está escrito
  // arriba del turno, palabra por palabra, y repetirlo traducido abajo es leer
  // lo mismo dos veces. Los pasos que valen ahí son los que la criatura hizo.
  if (encargo.nodos.length < 2) return []
  const hechos = new Set(encargo.hechos.map((h) => h.nodo))
  return encargo.nodos.map((n) => ({
    texto: enCastellano(n.meta),
    estado: hechos.has(n.id) ? 'hecho' : n.meta === metaEnCurso ? 'en-curso' : 'pendiente',
  }))
}

/**
 * LO QUE CAMBIÓ, en una cadena. El registro se repinta sólo cuando esto se mueve.
 *
 * Un `innerHTML` por cuadro son sesenta reescrituras por segundo para dejar lo
 * mismo, y eso rompe la selección de texto del que está leyendo. El contador de
 * antes era la CANTIDAD pintada y no alcanza más: con turnos, el último bloque
 * cambia por dentro —le entran pasos, la respuesta se reemplaza— sin que aparezca
 * ninguna línea nueva al final.
 */
export function firmaDelRegistro(turnos: readonly Turno[]): string {
  const ultimo = turnos.at(-1)
  return [
    String(turnos.length),
    String(ultimo?.turno ?? 0),
    ultimo?.respuesta?.texto ?? '',
    ...(ultimo?.pasos ?? []).map((p) => `${p.estado}:${p.texto}`),
  ].join('|')
}
