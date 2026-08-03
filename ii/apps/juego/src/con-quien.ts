// ─── CON QUIÉN ESTÁ HABLANDO ESTA PARTIDA ───────────────────────────────────
//
// El juego se apoya en dos modelos que no hacen lo mismo y hasta hoy no había
// dónde verlo:
//
//   **Codex** dibuja. Es el único que el juego usa de verdad: el botón «dibujar
//   uno» sale por el depósito y termina en un `codex exec`;
//   **Claude** todavía no hace nada acá. `Ordenes` tiene el hueco puesto
//   —`preguntar`, la frontera que dejó el C1— y nadie se lo llena, porque
//   aplicar la respuesta del proveedor es el tramo C4.
//
// ─── LO QUE ESTE ARCHIVO NO PUEDE HACER, Y ES LA MITAD DEL DISEÑO ──────────
//
// No puede decir «conectado» a secas. Lo que el backend sondea es si el CLI
// contesta `--version` (ver `apps/sprites/src/quien-hay.ts`), o sea que la luz
// prendida significa **está instalado en la máquina del depósito**, no que la
// cuenta ande ni —en el caso de Claude— que el juego le hable. Un indicador que
// dijera «conectado con Claude» estaría mintiendo dos veces, así que cada luz
// viene con su rol al lado y el rol es el que dice la verdad incómoda.
//
// ─── POR QUÉ ESTO ES UNA FUNCIÓN Y NO CUATRO `if` EN `main.ts` ─────────────
//
// Es la misma razón que `panel()` tiene escrita en su encabezado: lo que decide
// se prueba, lo que pinta no. Acá está toda la decisión —qué luz, qué rótulo,
// qué se le dice al que pasa el mouse— y del otro lado quedan tres `classList`.

/** Los tres estados de una luz, que son las tres clases del CSS. */
export type Luz = 'buscando' | 'vive' | 'no'

export interface Lampara {
  readonly luz: Luz
  /** El rol, en dos o tres palabras. Va al lado del nombre, en gris. */
  readonly rol: string
  /** La frase entera, para el que pase el mouse por arriba. */
  readonly detalle: string
}

export interface ConQuien {
  readonly codex: Lampara
  readonly claude: Lampara
  /**
   * La aclaración de abajo, vacía cuando no hace falta.
   *
   * Existe por un solo caso y es el que más importa: con las dos luces apagadas,
   * un panel que no diga nada más parece una falla. No lo es — el juego dibuja
   * procedural y lee las órdenes con su propio léxico— y decirlo es la misma
   * cortesía que «apagado (se juega igual)» en la línea del depósito.
   */
  readonly nota: string
}

const BUSCANDO_UNO: Lampara = {
  luz: 'buscando',
  rol: 'preguntando…',
  detalle: 'el depósito está sondeando qué hay en la máquina',
}

/** Lo que se muestra antes de la primera respuesta. */
export const BUSCANDO: ConQuien = { codex: BUSCANDO_UNO, claude: BUSCANDO_UNO, nota: '' }

interface Sondeado {
  readonly vive: boolean
  readonly version?: string
}

/** Un campo `{vive, version}` de la respuesta, leído sin confiar en nada. */
function leerModelo(crudo: unknown): Sondeado | undefined {
  if (typeof crudo !== 'object' || crudo === null) return undefined
  const o = crudo as Record<string, unknown>
  if (typeof o['vive'] !== 'boolean') return undefined
  return { vive: o['vive'], ...(typeof o['version'] === 'string' ? { version: o['version'] } : {}) }
}

function conVersion(base: string, m: Sondeado): string {
  return m.version === undefined ? base : `${base} — ${m.version}`
}

/**
 * CODEX: el único que el juego usa hoy, así que su rol depende de dos cosas
 * distintas y hay que separarlas. Que el CLI esté en la máquina no lo convierte
 * en el dibujante de este depósito: `dibuja` lo dice el servidor, y un depósito
 * que sólo reparta lo que otros dibujaron contesta `null` teniendo Codex
 * instalado al lado.
 */
function elDeCodex(m: Sondeado | undefined, dibuja: string | undefined): Lampara {
  if (m === undefined) return BUSCANDO_UNO
  if (!m.vive) {
    return {
      luz: 'no',
      rol: 'no está',
      detalle: 'el CLI de Codex no contesta en la máquina del depósito: los dibujos salen procedurales',
    }
  }
  if (dibuja !== 'codex') {
    return {
      luz: 'vive',
      rol: 'no dibuja acá',
      detalle: conVersion('el CLI está, pero este depósito no lo tiene de dibujante: sólo guarda y reparte', m),
    }
  }
  return {
    luz: 'vive',
    rol: 'dibuja',
    detalle: conVersion('los sprites que faltan se los pide el depósito a Codex, de a uno y a tu cuenta', m),
  }
}

/**
 * CLAUDE: la luz honesta del par. Prendida significa que el CLI está, y nada
 * más — el juego todavía no le manda una sola frase. El rol lo dice con las
 * palabras más cortas que encontré y el detalle explica por qué.
 */
function elDeClaude(m: Sondeado | undefined): Lampara {
  if (m === undefined) return BUSCANDO_UNO
  if (!m.vive) {
    return {
      luz: 'no',
      rol: 'no está',
      detalle: 'el CLI de Claude no contesta en la máquina del depósito',
    }
  }
  return {
    luz: 'vive',
    rol: 'en espera',
    detalle: conVersion(
      'el CLI está listo, pero el juego todavía no le habla: lo que decís lo entiende el léxico del propio juego',
      m,
    ),
  }
}

/**
 * De lo que contestó `/salud` a lo que se ve. `undefined` es «no contestó», y se
 * pinta apagado y no buscando: el depósito caído es una respuesta.
 */
export function conQuien(crudo: unknown): ConQuien {
  if (typeof crudo !== 'object' || crudo === null) {
    const apagado: Lampara = {
      luz: 'no',
      rol: 'sin depósito',
      detalle: 'el depósito no contesta, así que no hay forma de saber qué modelos hay',
    }
    return { codex: apagado, claude: apagado, nota: 'se juega igual, con los dibujos del motor' }
  }
  const o = crudo as Record<string, unknown>
  const dibuja = typeof o['dibuja'] === 'string' ? o['dibuja'] : undefined
  const modelos = typeof o['modelos'] === 'object' && o['modelos'] !== null
    ? (o['modelos'] as Record<string, unknown>)
    : undefined

  const codex = elDeCodex(modelos === undefined ? undefined : leerModelo(modelos['codex']), dibuja)
  const claude = elDeClaude(modelos === undefined ? undefined : leerModelo(modelos['claude']))
  const ninguno = codex.luz === 'no' && claude.luz === 'no'
  return { codex, claude, nota: ninguno ? 'se juega igual, con los dibujos del motor' : '' }
}
